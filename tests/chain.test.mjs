import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import ganache from 'ganache';
import { QkiWallet, QKI, qkiChain, mapGameAction, playerToGame, discoverWallets } from '../dist/chain.mjs';
import { createGame, advance, collect, craft, upgrade, deliver, assign, boost, expand } from '../dist/engine.mjs';

const artifact=JSON.parse(fs.readFileSync(new URL('../dist/contracts/QKIMinerTown.json',import.meta.url)));
const memoryStorage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};

test('wallet discovery finds late injection and deduplicates EIP-6963 announcements',()=>{
  const scope=new EventTarget();const first=discoverWallets(scope);assert.equal(first.size,0);
  const provider={request:async()=>[]};scope.ethereum=provider;
  const second=discoverWallets(scope);assert.equal(second,first);assert.equal(second.size,1);
  const announcement=new Event('eip6963:announceProvider');announcement.detail={provider,info:{uuid:'test-wallet',name:'Test Wallet'}};scope.dispatchEvent(announcement);
  assert.equal(second.size,1,'The same provider should not appear twice');
});

test('QKI contract: wallet deployment, rule parity, replay rejection and player isolation',async()=>{
  const provider=ganache.provider({logging:{quiet:true},chain:{chainId:20181205,hardfork:'petersburg'},wallet:{totalAccounts:3,defaultBalance:1000}});
  try{
    const storage=memoryStorage(),wallet=new QkiWallet({storage,artifact});
    const eip1193={request:({method,params=[]})=>provider.request({method:method==='eth_requestAccounts'?'eth_accounts':method,params}),on:provider.on.bind(provider),removeListener:provider.removeListener.bind(provider)};
    await wallet.connect(eip1193,'Isolated local EVM');
    assert.equal(qkiChain(wallet.chainId),true);
    assert(wallet.balance>0n);
    let draft=await wallet.prepare('deploy',[],'Deploy test contract');
    assert.equal(draft.tx.value,'0x0');assert.equal(draft.tx.chainId,QKI.chainId);assert(draft.maxFee>0n);
    await wallet.send(draft);
    const restored=new QkiWallet({storage,artifact});assert.equal(restored.pending.hash,wallet.pending.hash,'Pending hash survives reload');
    let result=await wallet.checkPending();assert.equal(result.status,'confirmed');assert(wallet.verified);assert(wallet.contract);
    assert.equal(await wallet.readPlayer(),null);
    await assert.rejects(()=>wallet.verifyContract(wallet.account),/不是此版本/);

    async function send(name,args=[]){const d=await wallet.prepare(name,args,name);await wallet.send(d);const r=await wallet.checkPending();assert.equal(r.status,'confirmed');const block=await provider.request({method:'eth_getBlockByNumber',params:[r.receipt.blockNumber,false]});return Number(BigInt(block.timestamp))*1000;}
    const start=await send('register');let local=createGame(start);
    await assert.rejects(()=>wallet.prepare('register'),/ALREADY_REGISTERED|revert/);
    async function parity(){const s=await wallet.readPlayer();advance(local,s.lastTick);assert.deepEqual(s.inventory,local.inventory);assert.deepEqual(s.mines,local.mines);assert.equal(s.score,local.score);assert.equal(s.delivered,local.delivered);assert.equal(s.machines,local.machines);assert.equal(s.boosts,local.boosts);assert.deepEqual(s.orders,local.orders);assert.deepEqual(s.stats,local.stats);return s;}
    await provider.request({method:'evm_increaseTime',params:[60]});await provider.request({method:'evm_mine',params:[]});await parity();
    let at=await send('collectAll');advance(local,at);for(const id of ['copper','energy','crystal'])collect(local,id);await parity();
    at=await send('craft',[3,5]);advance(local,at);assert(craft(local,'alloy',5));await parity();
    at=await send('upgrade',[0]);advance(local,at);assert(upgrade(local,'copper'));await parity();
    at=await send('deliver',[0,0]);advance(local,at);assert.equal(deliver(local,0),18);await parity();
    await assert.rejects(()=>wallet.prepare('deliver',[0,0]),/STALE_ORDER|revert/);
    at=await send('setMachines',[0,0]);advance(local,at);assert(assign(local,'copper',-1));
    at=await send('setMachines',[1,2]);advance(local,at);assert(assign(local,'energy',1));await parity();
    await assert.rejects(()=>wallet.prepare('setMachines',[2,6]),/NO_FREE_MACHINE|revert/);
    for(let i=0;i<3;i++){at=await send('boost');advance(local,at);assert(boost(local));await parity();}
    await assert.rejects(()=>wallet.prepare('boost'),/NO_BOOSTS|revert/);
    at=await send('craft',[4,1]);advance(local,at);assert(craft(local,'gear'));await parity();
    at=await send('craft',[3,1]);advance(local,at);assert(craft(local,'alloy'));await parity();
    at=await send('craft',[5,1]);advance(local,at);assert(craft(local,'drill'));await parity();
    at=await send('expand');advance(local,at);assert(expand(local));await parity();
    const before=await wallet.readPlayer();
    await assert.rejects(()=>wallet.prepare('craft',[7,10]),/INSUFFICIENT_MATERIALS|revert/);
    assert.deepEqual((await wallet.readPlayer()).inventory,before.inventory,'Rejected action cannot burn inventory');
    const accounts=await provider.request({method:'eth_accounts',params:[]});
    const other={request:({method,params})=>method==='eth_requestAccounts'||method==='eth_accounts'?Promise.resolve([accounts[1]]):provider.request({method,params}),on(){},removeListener(){}};
    const second=new QkiWallet({artifact});await second.connect(other);await second.verifyContract(wallet.contract);assert.equal(await second.readPlayer(),null,'Players cannot inherit another account state');
    const d=await second.prepare('register');await second.send(d);await second.checkPending();assert.equal((await second.readPlayer()).score,0);assert.equal((await wallet.readPlayer()).score,18);
    const tooMuchValue={from:wallet.account,to:wallet.contract,data:'0x',value:'0x1'};
    await assert.rejects(()=>provider.request({method:'eth_estimateGas',params:[tooMuchValue]}),/revert/,'Contract rejects QKI deposits');
    wallet.setGas('500');assert.equal(wallet.gasGwei,'500');assert.throws(()=>wallet.setGas('-1'));assert.throws(()=>wallet.setGas('0'));wallet.setGas('');
    await provider.request({method:'evm_increaseTime',params:[36000]});await provider.request({method:'evm_mine',params:[]});await parity();
  }finally{await provider.disconnect();}
});

test('wallet switch: add is followed by explicit selection; changed session cannot submit',async()=>{
  class Mock extends EventEmitter {
    constructor(){super();this.chain='0x1';this.known=false;this.calls=[];this.account='0x1111111111111111111111111111111111111111';}
    async request({method,params}){
      this.calls.push(method);
      if(method==='eth_requestAccounts'||method==='eth_accounts')return [this.account];
      if(method==='eth_chainId')return this.chain;
      if(method==='eth_getBalance')return '0x3635c9adc5dea00000';
      if(method==='eth_gasPrice')return '0xba43b74000';
      if(method==='eth_estimateGas')return '0x2dc6c0';
      if(method==='wallet_switchEthereumChain'){if(!this.known)throw Object.assign(new Error('Unknown chain'),{code:4902});this.chain=params[0].chainId;this.emit('chainChanged',this.chain);return null;}
      if(method==='wallet_addEthereumChain'){this.known=true;assert.equal(params[0].chainId,QKI.chainId);return null;}
      throw new Error('Unexpected method '+method);
    }
  }
  const p=new Mock(),w=new QkiWallet({artifact});await w.connect(p);await w.switchChain();
  assert.equal(w.chainId,QKI.chainId);
  assert.deepEqual(p.calls.filter(s=>s.startsWith('wallet_')),['wallet_switchEthereumChain','wallet_addEthereumChain','wallet_switchEthereumChain']);
  const draft=await w.prepare('deploy');
  p.account='0x2222222222222222222222222222222222222222';p.emit('accountsChanged',[p.account]);
  await assert.rejects(()=>w.send(draft),/已变化/);assert(!p.calls.includes('eth_sendTransaction'));
  const rejected={request:async()=>{throw Object.assign(new Error('No'),{code:4001})}};
  await assert.rejects(()=>w.connect(rejected));assert.equal(w.account,'');assert.equal(w.provider,null);
});

test('game action encoding preserves order serials and maps all five recipes',()=>{
  const s=createGame();assert.deepEqual(mapGameAction('deliver','0',1,s),['deliver',[0,0],'交付小镇订单']);
  for(const [id,n] of [['alloy',3],['gear',4],['drill',5],['battery',6],['beacon',7]])assert.deepEqual(mapGameAction('craft',id,5,s).slice(0,2),['craft',[n,5]]);
  assert.deepEqual(mapGameAction('assign-minus','energy',1,s).slice(0,2),['setMachines',[1,0]]);
  assert.equal(playerToGame({exists:false},0),null);
});

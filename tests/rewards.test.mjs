import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ganache from 'ganache';
import solc from 'solc';
import { Interface, toQuantity, parseEther } from 'ethers';
import { QkiWallet } from '../dist/chain.mjs';

const source=fs.readFileSync(new URL('../dist/contracts/QKIMinerTown.sol',import.meta.url),'utf8');
const fixture=`// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;
import "./QKIMinerTown.sol";
interface IVault { function enroll(uint256) external; function sync(uint256) external; function currentEpoch() external view returns(uint256); function claim(uint256,address payable) external; }
contract RewardGameMock {
 mapping(address=>QKIMinerTown.Player) private data;
 function gameId() external pure returns(bytes32){return keccak256("QKI_MINER_TOWN_V1");}
 function set(address a,uint64 score,uint64 created,uint64 delivered) external {data[a].exists=true;data[a].score=score;data[a].created=created;data[a].delivered=delivered;}
 function getState(address a) external view returns(QKIMinerTown.Player memory,uint256){return(data[a],block.timestamp);}
}
contract RewardReceiver {
 address public target; uint256 public epoch; bool public reject; bool public reentrySucceeded;
 function configure(bool value) external {reject=value;}
 function enroll(address v) external {IVault(v).enroll(IVault(v).currentEpoch());}
 function sync(address v) external {IVault(v).sync(IVault(v).currentEpoch());}
 function claim(address v,uint256 e) external {target=v;epoch=e;IVault(v).claim(e,payable(address(this)));}
 receive() external payable {require(!reject,"REJECT");(reentrySucceeded,)=target.call(abi.encodeWithSignature("claim(uint256,address)",epoch,address(this)));}
}`;
const input={language:'Solidity',sources:{'QKIMinerTown.sol':{content:source},'Fixtures.sol':{content:fixture}},settings:{optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'petersburg',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
const compiled=JSON.parse(solc.compile(JSON.stringify(input)));
if(compiled.errors?.some(e=>e.severity==='error'))throw new Error(compiled.errors.map(e=>e.formattedMessage).join('\n'));
const vaultArtifact=JSON.parse(fs.readFileSync(new URL('../dist/contracts/QKIRewardsVault.json',import.meta.url)));
const gameArtifact=JSON.parse(fs.readFileSync(new URL('../dist/contracts/QKIMinerTown.json',import.meta.url)));
const V=new Interface(vaultArtifact.abi),M=new Interface(compiled.contracts['Fixtures.sol'].RewardGameMock.abi),R=new Interface(compiled.contracts['Fixtures.sol'].RewardReceiver.abi);
const Q=parseEther;
async function environment(price=Q('100')){
 const p=ganache.provider({logging:{quiet:true},chain:{chainId:20181205,hardfork:'petersburg',vmErrorsOnRPCResponse:true},wallet:{totalAccounts:10,defaultBalance:1000}});
 const accounts=await p.request({method:'eth_accounts',params:[]});
 async function tx(from,to,data,value=0n){const request={from,data,value:toQuantity(value),gas:toQuantity(12000000),gasPrice:toQuantity(2000000000)};if(to)request.to=to;const hash=await p.request({method:'eth_sendTransaction',params:[request]});const receipt=await p.request({method:'eth_getTransactionReceipt',params:[hash]});assert.equal(BigInt(receipt.status),1n);return receipt;}
 async function deploy(artifact,args=[]){const iface=new Interface(artifact.abi);const bytecode=artifact.bytecode||'0x'+artifact.evm.bytecode.object;return (await tx(accounts[0],null,bytecode+iface.encodeDeploy(args).slice(2))).contractAddress;}
 const game=await deploy(compiled.contracts['Fixtures.sol'].RewardGameMock);
 const vault=await deploy(vaultArtifact,[game,price]);
 const call=async(iface,address,name,args=[])=>iface.decodeFunctionResult(name,await p.request({method:'eth_call',params:[{to:address,data:iface.encodeFunctionData(name,args)},'latest']}));
 const act=async(who,name,args=[],value=0n)=>{if(['enroll','sync','sponsor','buySkin'].includes(name)&&args.length===0)args=[(await call(V,vault,'currentEpoch'))[0]];return tx(who,vault,V.encodeFunctionData(name,args),value);};
 const seed=(who,score,created,orders=10)=>tx(accounts[0],game,M.encodeFunctionData('set',[who,score,created,orders]));
 const now=async()=>Number(BigInt((await p.request({method:'eth_getBlockByNumber',params:['latest',false]})).timestamp));
 const time=async(seconds)=>{await p.request({method:'evm_increaseTime',params:[seconds]});await p.request({method:'evm_mine',params:[]});};
 const overview=async(who,e=0)=>call(V,vault,'overview',[e,who]);
 const balance=async()=>BigInt(await p.request({method:'eth_getBalance',params:[vault,'latest']}));
 return {p,accounts,tx,deploy,call,act,seed,now,time,overview,balance,game,vault};
}

test('reward money: funded budgets, cap, ranking, claims and operator isolation',async()=>{
 const x=await environment();try{
  const [operator,a,b,c,d,buyer,,, ,recipient]=x.accounts;const created=(await x.now())-172800;
  for(const who of [a,b,c,d]){await x.seed(who,1000,created);await x.act(who,'enroll');}
  await x.act(operator,'sponsor',[],Q('50'));
  await x.act(buyer,'buySkin',[],Q('100'));
  await assert.rejects(()=>x.act(buyer,'buySkin',[],Q('100')),/SKIN_ALREADY_OWNED/);
  await assert.rejects(()=>x.act(buyer,'enroll'),/NOT_ELIGIBLE/,'A purchase creates no participation right');
  for(const [who,score]of [[a,3000],[b,1600],[c,1400],[d,1200]]){await x.seed(who,score,created);await x.act(who,'sync');}
  let snap=await x.overview(a);assert.equal(snap.pool.prizeBudget,Q('110'));assert.equal(snap.pool.dividendBudget,Q('20'));assert.equal(snap.pool.totalWeight,2200n);assert.equal(snap.entry.weight,1000n);assert.equal(snap.entry.points,2000n);
  assert.deepEqual(Array.from(snap.pool.leaders).map(a=>a.toLowerCase()),[a,b,c]);
  await assert.rejects(()=>x.act(a,'sync'),/NO_NEW_POINTS/);
  await assert.rejects(()=>x.act(a,'withdrawProject',[recipient]),/TREASURY_ONLY/);
  await assert.rejects(()=>x.act(a,'settle',[0]),/SEASON_NOT_ENDED/);
  await x.time(604801);await assert.rejects(()=>x.act(operator,'sponsor',[0],1n),/EPOCH_CHANGED/);await x.act(operator,'settle',[0]);
  await x.seed(d,1000000,created);await assert.rejects(()=>x.act(d,'sync'),/ENROLL_FIRST/,'New season points cannot enter the closed season');
  let paid=0n;
  for(const [who,prize,weight]of [[a,Q('55'),1000n],[b,Q('33'),600n],[c,Q('22'),400n],[d,0n,200n]]){
   const due=await x.call(V,x.vault,'claimable',[0,who]);assert.equal(due.prize,prize);assert.equal(due.dividend,Q('20')*weight/2200n);
   await x.act(who,'claim',[0,recipient]);paid+=due.prize+due.dividend;
   await assert.rejects(()=>x.act(who,'claim',[0,recipient]),/ALREADY_CLAIMED/);
  }
  const config=await x.call(V,x.vault,'config');assert.equal(config.operatorFunds,Q('20'));
  await x.act(operator,'withdrawProject',[recipient]);
  assert.equal(await x.balance(),Q('150')-paid-Q('20'));
  snap=await x.overview(a);assert.equal(snap.pool.prizeRemaining,0n);assert.equal(snap.pool.dividendRemaining,0n);
  const next=await x.overview(a,1);assert.equal(next.pool.prizeBudget,await x.balance());
  assert.equal((await x.call(V,x.vault,'config')).accounted,await x.balance());
 }finally{await x.p.disconnect();}
});

test('reward deadlines: old score excluded, entry gate, ties and unexpired claims',async()=>{
 const x=await environment();try{
  const [operator,a,b]=x.accounts;let now=await x.now();
  await x.seed(a,1000,now,10);await assert.rejects(()=>x.act(a,'enroll'),/NOT_ELIGIBLE/);
  await x.seed(a,1000,now-172800,9);await assert.rejects(()=>x.act(a,'enroll'),/NOT_ELIGIBLE/);
  await x.seed(a,1000,now-172800,10);await x.act(a,'enroll');await assert.rejects(()=>x.act(a,'enroll'),/ALREADY_ENROLLED/);
  await x.seed(b,9000,now-172800,10);await x.act(b,'enroll');
  await x.seed(b,9050,now-172800);await x.act(b,'sync');await x.seed(a,1050,now-172800);await x.act(a,'sync');
  const s=await x.overview(a);assert.equal(s.entry.points,50n);assert.equal(s.pool.leaders[0].toLowerCase(),a,'Earlier enrollment wins a tie, not sync order');
  await x.act(operator,'sponsor',[],Q('10'));await x.time(604800*4+1);
  await x.act(operator,'settle',[0]);const due=await x.call(V,x.vault,'claimable',[0,a]);assert.equal(due.prize,Q('5'));
  await x.act(a,'claim',[0,a]);assert.equal((await x.overview(a)).entry.claimed,true);
  assert.equal((await x.overview(a,4)).pool.prizeBudget,Q('2'),'Missing third place goes to current open season after skipped seasons');
 }finally{await x.p.disconnect();}
});

test('reward safety: a rejecting recipient cannot block other claims; reentry is rejected',async()=>{
 const x=await environment();try{
  const [operator]=x.accounts;const receiver=await x.deploy(compiled.contracts['Fixtures.sol'].RewardReceiver);const created=(await x.now())-172800;
  await x.seed(receiver,0,created);await x.tx(operator,receiver,R.encodeFunctionData('enroll',[x.vault]));await x.seed(receiver,100,created);await x.tx(operator,receiver,R.encodeFunctionData('sync',[x.vault]));
  await x.act(operator,'sponsor',[],Q('10'));await x.time(604801);await x.tx(operator,receiver,R.encodeFunctionData('configure',[true]));
  await assert.rejects(()=>x.tx(operator,receiver,R.encodeFunctionData('claim',[x.vault,0])),/TRANSFER_FAILED/);
  assert.equal((await x.overview(receiver)).entry.claimed,false);assert.equal(await x.balance(),Q('10'));
  await x.tx(operator,receiver,R.encodeFunctionData('configure',[false]));await x.tx(operator,receiver,R.encodeFunctionData('claim',[x.vault,0]));
  assert.equal((await x.call(R,receiver,'reentrySucceeded'))[0],false);assert.equal((await x.overview(receiver)).entry.claimed,true);assert.equal(await x.balance(),Q('5'));
 }finally{await x.p.disconnect();}
});

test('reward accounting: empty seasons and one-wei rounding never increase liabilities',async()=>{
 const x=await environment(5n);try{
  const [operator,a,b]=x.accounts;await x.act(operator,'buySkin',[],5n);await x.time(604801);await x.act(a,'settle',[0]);
  let s=await x.overview(a,1);assert.equal(s.pool.prizeBudget,4n);assert.equal((await x.call(V,x.vault,'config')).operatorFunds,1n);
  const created=(await x.now())-172800;for(const who of [a,b]){await x.seed(who,0,created);await x.act(who,'enroll');await x.seed(who,1,created);await x.act(who,'sync');}
  await x.act(a,'buySkin',[],5n);await x.time(604801);await x.act(a,'claim',[1,a]);await x.act(b,'claim',[1,b]);
  const c=await x.call(V,x.vault,'config');assert.equal(c.accounted,await x.balance());
  s=await x.overview(a,1);assert.equal(s.pool.dividendRemaining,0n);
 }finally{await x.p.disconnect();}
});

test('wallet funding drafts include payment plus gas and verify the linked game',async()=>{
 const x=await environment();try{
  const realGame=await x.deploy(gameArtifact);
  const adapter={request:({method,params=[]})=>x.p.request({method:method==='eth_requestAccounts'?'eth_accounts':method,params}),on:x.p.on.bind(x.p),removeListener:x.p.removeListener.bind(x.p)};
  const wallet=new QkiWallet({artifact:gameArtifact});wallet.rewardArtifact=vaultArtifact;await wallet.connect(adapter);await wallet.verifyContract(realGame);
  const deployment=await wallet.prepareReward('deploy',[Q('0.1')],'Deploy vault');await wallet.send(deployment);assert.equal((await wallet.checkPending()).status,'confirmed');const realVault=wallet.rewardContract.toLowerCase();await wallet.verifyRewardContract(realVault);
  const draft=await wallet.prepareReward('sponsor',[0],'Test funding',Q('1'));assert.equal(BigInt(draft.tx.value),Q('1'));assert.equal(draft.maxDebit,draft.maxFee+Q('1'));assert.equal(draft.tx.to.toLowerCase(),realVault);
  await wallet.send(draft);assert.equal((await wallet.checkPending()).status,'confirmed');assert.equal((await wallet.readRewards()).data.pool.prizeBudget,Q('1'));
  await assert.rejects(()=>wallet.verifyRewardContract(x.vault),/另一份游戏/);
 }finally{await x.p.disconnect();}
});

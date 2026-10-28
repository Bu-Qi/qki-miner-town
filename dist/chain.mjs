import { Interface, getAddress, isAddress, keccak256, parseUnits, formatEther, toQuantity } from './vendor/ethers.js';
import { createGame, newOrder } from './engine.mjs';

export const QKI = {
  chainId: '0x133f0d5', chainName: 'QKI Mainnet',
  nativeCurrency: { name: 'QKI', symbol: 'QKI', decimals: 18 },
  rpcUrls: ['https://rpc1.qkiscan.io', 'https://rpc2.qkiscan.io', 'https://rpc3.qkiscan.io'],
  blockExplorerUrls: ['https://qkiscan.io'],
};
export const ITEM_IDS = ['copper','energy','crystal','alloy','gear','drill','battery','beacon'];
const CONFIG_KEY = 'qki-miner-chain-config-v1';
const PENDING_KEY = 'qki-miner-pending-v1';
const HASH = /^0x[0-9a-fA-F]{64}$/;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
export const shortAddress = a => a ? `${a.slice(0,6)}…${a.slice(-4)}` : '';
export const qkiAmount = value => Number(formatEther(value)).toLocaleString('en-US', { maximumFractionDigits: 6 });
export const exactQki = value => formatEther(value);
export const parseQki = value => parseUnits(String(value).trim(),18);
export const explorerTx = hash => HASH.test(hash) ? `${QKI.blockExplorerUrls[0]}/tx/${hash}` : '';
export const explorerAddress = a => isAddress(a) ? `${QKI.blockExplorerUrls[0]}/address/${a}` : '';
export function qkiChain(id) { try { return BigInt(id) === BigInt(QKI.chainId); } catch { return false; } }
export function chainError(e) {
  const code = Number(e?.code ?? e?.error?.code ?? e?.data?.originalError?.code);
  if (code === 4001 || e?.code === 'ACTION_REJECTED') return '你已在钱包中取消操作，游戏进度没有改变。';
  if (code === -32002) return '钱包里已有待处理请求，请先打开钱包处理。';
  if ([4900,4901].includes(code)) return '钱包连接已断开，请重新连接 QKI 网络。';
  const text = String(e?.shortMessage || e?.message || '连接失败，请稍后重试。');
  const reasons = { INSUFFICIENT_MATERIALS:'链上材料不足，请刷新矿区后再试。', STALE_ORDER:'这张订单已更新，请刷新后交付。', ALREADY_REGISTERED:'这个地址已经有链上矿区，请直接进入。', NOT_REGISTERED:'请先创建这个地址的链上矿区。', NOTHING_TO_COLLECT:'当前区块还没有可收取的资源，请稍等。', NO_FREE_MACHINE:'没有闲置矿机，请先从其他矿场调出。', MAX_LEVEL:'矿场已达到最高等级。', NO_BOOSTS:'本轮的加速次数已用完。', MAX_MACHINES:'矿队已达到 6 台上限。' };
  Object.assign(reasons,{EPOCH_CHANGED:'赛季已切换，请刷新奖池后重新准备交易。',NOT_ELIGIBLE:'参与门槛：矿区创建满 24 小时，并完成至少 10 张链上订单。',ENROLL_FIRST:'请先报名本赛季，报名后的新增积分才会计入。',ALREADY_ENROLLED:'当前地址已报名本赛季。',NO_NEW_POINTS:'没有尚未同步的新增订单积分。',SEASON_NOT_ENDED:'该赛季尚未结束，结束后才能结算和领取。',ALREADY_SETTLED:'该赛季已结算。',ALREADY_CLAIMED:'这个地址已经领取过该赛季奖励。',NOTHING_TO_CLAIM:'当前没有可领取的金额。',SKIN_ALREADY_OWNED:'当前地址已经拥有金色矿帽。',WRONG_PRICE:'外观价格不匹配，请刷新后再试。',TREASURY_ONLY:'只有合约中记录的运营地址可以领取运营收入。',TRANSFER_FAILED:'收款地址未能接收 QKI，本次领取已回退，权益保留。'});
  for (const [reason,message] of Object.entries(reasons)) if(text.includes(reason)) return message;
  if(/insufficient funds/i.test(text)) return 'QKI 余额不足以支付这笔交易的 Gas。';
  return text.slice(0,180);
}
function safeNumber(v) { const n=Number(v); if(!Number.isSafeInteger(n)||n<0)throw new Error('链上数值超出显示范围。'); return n; }
export function playerToGame(p, timestamp, prefs = {}) {
  if (!p.exists) return null;
  const now=safeNumber(timestamp)*1000, s=createGame(now);
  s.created=safeNumber(p.created)*1000; s.lastTick=now;
  for(const id of ['score','delivered','machines','boosts','nextOrder'])s[id]=safeNumber(p[id]);
  ITEM_IDS.forEach((id,i)=>s.inventory[id]=safeNumber(p.inventory[i]));
  ITEM_IDS.slice(0,3).forEach((id,i)=>{
    const m=p.mines[i];s.mines[id]={level:safeNumber(m.level),assigned:safeNumber(m.assigned),pending:safeNumber(m.pending),work:safeNumber(m.work)*1000};
  });
  s.orders=Array.from(p.orders,serial=>newOrder(safeNumber(serial)));
  s.stats={collected:safeNumber(p.collected),crafted:safeNumber(p.crafted),upgrades:safeNumber(p.upgrades)};
  s.muted=prefs.muted!==false;s.motion=prefs.motion!==false;s.guideHidden=prefs.guideHidden===true;
  return s;
}
export function mapGameAction(action,id,qty,s) {
  const mine=ITEM_IDS.indexOf(id);
  if(action==='collect-all')return ['collectAll',[],'收取全部矿场资源'];
  if(action==='collect')return ['collectMine',[mine],`收取${['铜矿','能量','晶石'][mine]}`];
  if(action==='craft')return ['craft',[ITEM_IDS.indexOf(id),qty||1],'制造材料与设备'];
  if(action==='assign-plus'||action==='assign-minus')return ['setMachines',[mine,s.mines[id].assigned+(action==='assign-plus'?1:-1)],'调整矿机分配'];
  if(action==='upgrade')return ['upgrade',[mine],'升级矿场'];
  if(action==='deliver'){const slot=s.orders.findIndex(o=>o.id===Number(id));if(slot<0)throw new Error('订单已更新，请刷新。');return ['deliver',[slot,s.orders[slot].id],'交付小镇订单'];}
  if(action==='expand')return ['expand',[],'扩建矿队'];
  if(action==='boost')return ['boost',[],'加速生产 60 秒'];
  throw new Error('不支持的链上操作。');
}

export class QkiWallet extends EventTarget {
  constructor({ storage = null, fetcher = globalThis.fetch, artifact = null, rpcUrls = QKI.rpcUrls } = {}) {
    super();this.storage=storage;this.fetcher=(...args)=>fetcher.call(globalThis,...args);this.rpcUrls=rpcUrls;this.artifact=artifact;
    this.provider=null;this.account='';this.chainId='';this.balance=0n;this.walletName='';
    this.contract='';this.verified=false;this.gasGwei='';this.pending=null;this.busy=false;this.generation=0;this.clockOffset=0;this.block=0;this.networkGas='';
    this.listeners=[];
    this.rewardContract='';this.rewardVerified=false;this.rewardArtifact=null;
    try { const c=JSON.parse(storage?.getItem(CONFIG_KEY)||'{}');if(isAddress(c.contract))this.contract=getAddress(c.contract);if(typeof c.gasGwei==='string'&&/^\d+(\.\d{1,9})?$/.test(c.gasGwei))this.gasGwei=c.gasGwei; } catch {}
    try { const c=JSON.parse(storage?.getItem(CONFIG_KEY)||'{}');if(isAddress(c.rewardContract))this.rewardContract=getAddress(c.rewardContract); } catch {}
    try { const p=JSON.parse(storage?.getItem(PENDING_KEY)||'null');if(p&&HASH.test(p.hash)&&isAddress(p.from)&&['deploy','game','rewards-deploy','rewards'].includes(p.kind))this.pending=p; } catch {}
  }
  changed() { this.dispatchEvent(new Event('change')); }
  persist() { try { this.storage?.setItem(CONFIG_KEY,JSON.stringify({contract:this.contract,rewardContract:this.rewardContract,gasGwei:this.gasGwei})); } catch {} }
  setGas(value) {
    const v=String(value).trim();
    if(v&&(!/^\d+(\.\d{1,9})?$/.test(v)||parseUnits(v,'gwei')<=0n||parseUnits(v,'gwei')>parseUnits('1000000','gwei')))throw new Error('请输入大于 0 的 Gas 单价，最多 9 位小数。');
    this.gasGwei=v;this.persist();this.changed();
  }
  async getArtifact() {
    if(!this.artifact){const r=await this.fetcher(new URL('./contracts/QKIMinerTown.json',import.meta.url).href);if(!r.ok)throw new Error('游戏合约文件加载失败，请刷新重试。');this.artifact=await r.json();}
    this.iface ||= new Interface(this.artifact.abi);return this.artifact;
  }
  async getRewardArtifact() {
    if(!this.rewardArtifact){const r=await this.fetcher(new URL('./contracts/QKIRewardsVault.json',import.meta.url).href);if(!r.ok)throw new Error('奖池合约文件加载失败。');this.rewardArtifact=await r.json();}
    this.rewardIface ||= new Interface(this.rewardArtifact.abi);return this.rewardArtifact;
  }
  async rewardCall(name,args=[],address=this.rewardContract,block='latest') {
    await this.getRewardArtifact();
    const raw=await this.provider.request({method:'eth_call',params:[{to:address,data:this.rewardIface.encodeFunctionData(name,args)},block]});
    return this.rewardIface.decodeFunctionResult(name,raw);
  }
  async verifyRewardContract(address) {
    await this.assertSession();if(!this.verified)await this.verifyContract(this.contract);await this.getRewardArtifact();
    if(!isAddress(address))throw new Error('请输入有效的奖池合约地址。');
    const generation=this.generation,game=this.contract,a=getAddress(address);
    const code=await this.provider.request({method:'eth_getCode',params:[a,'latest']});
    if(code==='0x'||keccak256(code)!==this.rewardArtifact.runtimeHash)throw new Error('奖池合约代码不匹配。');
    const config=await this.rewardCall('config',[],a);
    if(getAddress(config.gameAddress)!==game)throw new Error('该奖池绑定了另一份游戏合约，请核对地址。');
    if(generation!==this.generation||game!==this.contract)throw new Error('钱包或游戏合约已变化。');
    this.rewardContract=a;this.rewardVerified=true;this.persist();this.changed();return config;
  }
  async readRewards(epoch=null) {
    await this.assertSession();if(!this.rewardVerified)await this.verifyRewardContract(this.rewardContract);
    const generation=this.generation,account=this.account,address=this.rewardContract;
    const block=await this.provider.request({method:'eth_blockNumber'});
    const config=await this.rewardCall('config',[],address,block);
    const currentEpoch=Math.floor((Number(config.timestamp)-Number(config.start))/604800);
    const e=epoch===null?currentEpoch:Number(epoch);
    if(!Number.isSafeInteger(e)||e<0||e>currentEpoch)throw new Error('请输入已经开始的赛季编号。');
    const data=await this.rewardCall('overview',[e,account],address,block);
    if(generation!==this.generation||account!==this.account||address!==this.rewardContract)throw new Error('钱包状态已变化，请刷新奖池。');
    return {config,data,epoch:e,currentEpoch,account,address};
  }
  async publicRequest(method,params=[]) {
    let error;
    for(const url of this.rpcUrls){
      try{
        const r=await this.fetcher(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(8000)});
        if(!r.ok)throw new Error(`RPC HTTP ${r.status}`);
        const data=await r.json();if(data.error)throw new Error(data.error.message);if(data.result===undefined)throw new Error('RPC 响应不完整');return data.result;
      }catch(e){error=e;}
    }
    throw error||new Error('QKI 节点暂时不可用。');
  }
  async request(method,params=[]) {
    if(this.provider&&qkiChain(this.chainId))return this.provider.request({method,params});
    return this.publicRequest(method,params);
  }
  async networkStatus() {
    const chain=await this.publicRequest('eth_chainId');if(!qkiChain(chain))throw new Error('节点返回了错误的网络，已停止使用。');
    const [block,price]=await Promise.all([this.publicRequest('eth_blockNumber'),this.publicRequest('eth_gasPrice')]);
    this.block=Number(BigInt(block));this.networkGas=String(Number(BigInt(price))/1e9);this.changed();return this.block;
  }
  async connect(provider,name='EVM 钱包') {
    if(!provider?.request)throw new Error('未检测到 EVM 钱包，请在钱包内置浏览器或安装钱包的浏览器中打开。');
    this.unbind();this.provider=provider;this.walletName=String(name).slice(0,60);this.generation++;
    this.account='';this.chainId='';this.balance=0n;this.verified=false;this.rewardVerified=false;
    let accounts;
    try{accounts=await provider.request({method:'eth_requestAccounts'});}
    catch(e){this.provider=null;this.walletName='';this.changed();throw e;}
    this.account=accounts?.[0]&&isAddress(accounts[0])?getAddress(accounts[0]):'';
    this.chainId=await provider.request({method:'eth_chainId'});
    this.bind();await this.refresh();this.changed();
    if(!this.account)throw new Error('钱包没有提供可用地址。');
  }
  bind() {
    const invalidate=()=>{this.verified=false;this.rewardVerified=false;this.generation++;};
    const accountsChanged=accounts=>{invalidate();this.account=accounts?.[0]&&isAddress(accounts[0])?getAddress(accounts[0]):'';this.balance=0n;this.changed();this.refresh().catch(()=>{});};
    const chainChanged=id=>{invalidate();this.chainId=id;this.balance=0n;this.changed();this.refresh().catch(()=>{});};
    const disconnected=()=>{invalidate();this.account='';this.chainId='';this.balance=0n;this.changed();};
    this.listeners=[['accountsChanged',accountsChanged],['chainChanged',chainChanged],['disconnect',disconnected]];
    for(const [name,fn] of this.listeners)this.provider?.on?.(name,fn);
  }
  unbind() { for(const [name,fn] of this.listeners)this.provider?.removeListener?.(name,fn);this.listeners=[]; }
  disconnect() { this.unbind();this.provider=null;this.account='';this.chainId='';this.balance=0n;this.verified=false;this.rewardVerified=false;this.generation++;this.changed(); }
  async switchChain() {
    if(!this.provider)throw new Error('请先连接钱包。');
    try { await this.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:QKI.chainId}]}); }
    catch(e){
      const code=Number(e?.code??e?.data?.originalError?.code);
      if(code!==4902)throw e;
      await this.provider.request({method:'wallet_addEthereumChain',params:[QKI]});
      // EIP-3085 does not imply selection; request selection explicitly and verify it.
      await this.provider.request({method:'wallet_switchEthereumChain',params:[{chainId:QKI.chainId}]});
    }
    this.chainId=await this.provider.request({method:'eth_chainId'});
    this.generation++;this.verified=false;this.rewardVerified=false;
    if(!qkiChain(this.chainId))throw new Error('钱包尚未切换到 QKI 主网。');
    await this.refresh();this.changed();
  }
  async refresh() {
    if(!this.provider||!this.account)return;
    const generation=this.generation,account=this.account;
    if(!qkiChain(this.chainId))return;
    const value=await this.provider.request({method:'eth_getBalance',params:[account,'latest']});
    if(generation!==this.generation||account!==this.account)return;
    this.balance=BigInt(value);this.changed();
  }
  async assertSession(expected) {
    if(!this.provider||!this.account)throw new Error('请先连接钱包。');
    const [chain,accounts]=await Promise.all([this.provider.request({method:'eth_chainId'}),this.provider.request({method:'eth_accounts'})]);
    if(!qkiChain(chain))throw new Error('请先切换到 QKI 主网，操作已停止。');
    if(!accounts?.[0]||getAddress(accounts[0])!==this.account)throw new Error('钱包账户已变化，请重新连接。');
    if(expected&&(expected.from!==this.account||expected.generation!==this.generation))throw new Error('钱包或网络已变化，请重新准备交易。');
  }
  async verifyContract(address) {
    await this.assertSession();await this.getArtifact();
    if(!isAddress(address))throw new Error('请输入有效的游戏合约地址。');
    const generation=this.generation,account=this.account,a=getAddress(address);
    const code=await this.provider.request({method:'eth_getCode',params:[a,'latest']});
    if(code==='0x'||keccak256(code)!==this.artifact.runtimeHash)throw new Error('该地址不是此版本的矿工小镇合约，请检查网络和地址。');
    if(generation!==this.generation||account!==this.account)throw new Error('账户或网络已变化，请重新连接合约。');
    if(this.contract!==a)this.rewardVerified=false;
    this.contract=a;this.verified=true;this.persist();this.changed();return a;
  }
  async readPlayer(prefs={}) {
    await this.assertSession();await this.getArtifact();
    if(!this.verified)await this.verifyContract(this.contract);
    const generation=this.generation,account=this.account,contract=this.contract;
    const raw=await this.provider.request({method:'eth_call',params:[{to:contract,data:this.iface.encodeFunctionData('getState',[account])},'latest']});
    if(generation!==this.generation||account!==this.account||contract!==this.contract)throw new Error('钱包状态已变化，请重新进入矿区。');
    const [player,timestamp]=this.iface.decodeFunctionResult('getState',raw);
    this.clockOffset=Number(timestamp)*1000-Date.now();return playerToGame(player,timestamp,prefs);
  }
  async prepare(name,args=[],label='游戏交易') {
    await this.assertSession();await this.getArtifact();
    if(this.pending)throw new Error('有一笔交易仍待确认，请先查看交易状态。');
    if(name!=='deploy'&&!this.verified)await this.verifyContract(this.contract);
    const data=name==='deploy'?this.artifact.bytecode:this.iface.encodeFunctionData(name,args);
    return this.estimateDraft({name,label,kind:name==='deploy'?'deploy':'game',data,to:name==='deploy'?null:this.contract,value:0n});
  }
  async prepareReward(name,args=[],label='奖池操作',value=0n) {
    await this.assertSession();if(!this.verified)await this.verifyContract(this.contract);await this.getRewardArtifact();
    if(name!=='deploy'&&!this.rewardVerified)await this.verifyRewardContract(this.rewardContract);
    const allowed=['deploy','sponsor','buySkin','enroll','sync','settle','claim','withdrawProject'];
    if(!allowed.includes(name))throw new Error('不支持的奖池操作。');
    const data=name==='deploy'?this.rewardArtifact.bytecode+this.rewardIface.encodeDeploy([this.contract,...args]).slice(2):this.rewardIface.encodeFunctionData(name,args);
    return this.estimateDraft({name,label,kind:name==='deploy'?'rewards-deploy':'rewards',data,to:name==='deploy'?null:this.rewardContract,value:BigInt(value),gameAddress:this.contract});
  }
  async estimateDraft({name,label,kind,data,to,value,gameAddress}) {
    if(this.pending)throw new Error('有交易尚未确认，请先查看状态。');
    const context={from:this.account,generation:this.generation};
    const tx={from:this.account,data,value:toQuantity(value),chainId:QKI.chainId};if(to)tx.to=to;
    const price=this.gasGwei?parseUnits(this.gasGwei,'gwei'):BigInt(await this.provider.request({method:'eth_gasPrice'}));
    const estimate=BigInt(await this.provider.request({method:'eth_estimateGas',params:[{...tx,gasPrice:toQuantity(price)}]}));
    const gas=(estimate*120n+99n)/100n;
    const balance=BigInt(await this.provider.request({method:'eth_getBalance',params:[context.from,'latest']}));
    await this.assertSession(context);
    return {...context,kind,name,label,gameAddress,issuedAt:Date.now(),tx:{...tx,gas:toQuantity(gas),gasPrice:toQuantity(price)},gas,price,maxFee:gas*price,maxDebit:gas*price+value,balance,sufficient:balance>=gas*price+value};
  }
  async send(prepared) {
    if(this.busy||this.pending)throw new Error('交易正在处理中，请勿重复提交。');
    this.busy=true;this.changed();
    try {
      await this.assertSession(prepared);
      if(Date.now()-prepared.issuedAt>120000)throw new Error('这份 Gas 估算已过期，请重新准备交易。');
      if(!prepared.sufficient)throw new Error('QKI 余额不足以支付金额及 Gas。');
      if(prepared.kind==='game'&&prepared.tx.to!==this.contract)throw new Error('游戏合约已变化，请重新准备交易。');
      if(prepared.kind==='rewards'&&prepared.tx.to!==this.rewardContract)throw new Error('奖池合约已变化，请重新准备交易。');
      if(prepared.gameAddress&&prepared.gameAddress!==this.contract)throw new Error('奖池绑定的游戏合约已变化。');
      const hash=await this.provider.request({method:'eth_sendTransaction',params:[prepared.tx]});
      if(!HASH.test(hash))throw new Error('钱包未返回有效交易哈希，请在钱包中核对交易状态。');
      this.pending={hash,from:prepared.from,kind:prepared.kind,label:prepared.label,to:prepared.tx.to||'',gameAddress:prepared.gameAddress||'',created:Date.now()};
      try{this.storage?.setItem(PENDING_KEY,JSON.stringify(this.pending));}catch{}
      this.changed();return hash;
    } finally { this.busy=false;this.changed(); }
  }
  async checkPending() {
    if(!this.pending)return null;
    const pending=this.pending;
    const receipt=await this.request('eth_getTransactionReceipt',[pending.hash]);
    if(!receipt)return {status:'pending',hash:pending.hash};
    // Old nodes may omit status: do not assume success without an explicit receipt status.
    if(receipt.status===undefined||receipt.status===null)throw new Error('节点未返回交易执行状态，请在浏览器核对。');
    const ok=BigInt(receipt.status)===1n;
    if(ok&&pending.kind==='deploy'){
      if(!receipt.contractAddress||!isAddress(receipt.contractAddress))throw new Error('交易回执未包含有效游戏合约地址。');
      await this.getArtifact();
      const code=await this.request('eth_getCode',[receipt.contractAddress,'latest']);
      if(keccak256(code)!==this.artifact.runtimeHash)throw new Error('部署后的合约代码与游戏版本不符。');
      this.contract=getAddress(receipt.contractAddress);this.verified=!!this.account&&qkiChain(this.chainId);this.persist();
    }
    if(ok&&pending.kind==='rewards-deploy'){
      if(!receipt.contractAddress||!isAddress(receipt.contractAddress))throw new Error('回执未包含奖池合约地址。');
      await this.getRewardArtifact();
      const code=await this.request('eth_getCode',[receipt.contractAddress,'latest']);
      if(keccak256(code)!==this.rewardArtifact.runtimeHash)throw new Error('部署后的奖池代码不匹配。');
      this.rewardContract=getAddress(receipt.contractAddress);this.rewardVerified=!!this.account&&qkiChain(this.chainId)&&pending.gameAddress===this.contract;this.persist();
    }
    if(this.pending?.hash===pending.hash){this.pending=null;try{this.storage?.removeItem(PENDING_KEY);}catch{}}
    this.changed();return {status:ok?'confirmed':'reverted',hash:pending.hash,kind:pending.kind,from:pending.from,receipt};
  }
  async waitPending(timeout=120000,pollMs=3500) {
    const started=Date.now();
    while(this.pending&&Date.now()-started<timeout){const result=await this.checkPending();if(result?.status!=='pending')return result;await wait(pollMs);}
    return this.pending?{status:'pending',hash:this.pending.hash}:null;
  }
}

const walletRegistries=new WeakMap();
export function discoverWallets(scope=window) {
  const first=!walletRegistries.has(scope);
  const found=walletRegistries.get(scope)||new Map();
  walletRegistries.set(scope,found);
  const add=(provider,name,key)=>{if(provider?.request&&!found.has(key)&&![...found.values()].some(w=>w.provider===provider)){found.set(key,{provider,name,key});scope.dispatchEvent(new Event('qki:wallets'));}};
  if(first)scope.addEventListener('eip6963:announceProvider',e=>{const d=e.detail;if(d?.provider&&d.info?.uuid)add(d.provider,String(d.info.name||'EVM 钱包'),d.info.uuid);});
  scope.dispatchEvent(new Event('eip6963:requestProvider'));
  if(scope.ethereum){const providers=scope.ethereum.providers||[scope.ethereum];providers.forEach((p,i)=>add(p,p.isTokenPocket?'TokenPocket':p.isMetaMask?'MetaMask':p.isCoinbaseWallet?'Coinbase Wallet':'EVM 钱包',`injected-${i}`));}
  return found;
}

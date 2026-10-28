import { icon } from './art.mjs';
import { chainError, exactQki, qkiAmount, shortAddress, parseQki, qkiChain } from './chain.mjs';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v).toLocaleString('zh-CN');
const date=v=>new Date(Number(v)*1000).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export function createRewardsUI({chainUI,render,toast,getView,navigate}) {
  const wallet=chainUI.wallet;
  let snapshot=null,loading=false,selected=null;
  const valid=()=>snapshot&&snapshot.account===wallet.account&&snapshot.address===wallet.rewardContract&&wallet.rewardVerified&&qkiChain(wallet.chainId);
  function cosmetic(){document.body.classList.toggle('gold-hat',!!(valid()&&snapshot.data.skinOwned));}
  wallet.addEventListener('change',()=>{if(snapshot&&!valid()){snapshot=null;cosmetic();if(getView()==='rewards')render();}});
  async function reload(epoch=selected) {
    if(loading)return;loading=true;
    try{snapshot=await wallet.readRewards(epoch);selected=snapshot.epoch;cosmetic();render();}
    finally{loading=false;}
  }
  function model() {
    return `<section class="rewards-hero"><span class="section-kicker">A REWARD FOR BUILDING TOGETHER</span><h2>让小镇的收入，回到建设者手里。</h2><p>奖池来自实际到账的外观收入与赞助。按赛季表现和活跃贡献领取，没有固定回报。</p><div class="revenue-bar"><span>60% 赛季奖池</span><span>20% 活跃分配</span><span>20% 运营</span></div></section>`;
  }
  function setup() {
    const ready=wallet.account&&qkiChain(wallet.chainId)&&wallet.verified;
    return `<section class="card reward-card"><div class="card-heading"><h2>连接奖池合约</h2><span class="count-label">${wallet.rewardVerified?'已核验':'独立奖池模块'}</span></div><p class="chain-copy">奖池绑定当前游戏合约。先在「链上」连接钱包与游戏合约，再接入或部署同一份奖池供玩家使用。</p><label class="field-label" for="reward-vault">奖池合约地址</label><div class="contract-input-row"><input id="reward-vault" class="chain-input" placeholder="0x…" value="${esc(wallet.rewardContract)}" spellcheck="false"><button class="btn btn-primary" data-reward="attach" ${ready?'':'disabled'}>连接奖池</button></div><div class="reward-deploy"><div><label class="field-label" for="skin-price">新合约的永久金帽售价 / QKI</label><input id="skin-price" class="chain-input" inputmode="decimal" value="0.1"></div><button class="btn btn-outline" data-reward="deploy" ${ready&&!chainUI.busy()?'':'disabled'}>部署奖池</button></div><div class="chain-code-links"><a class="text-link" href="/contracts/QKIRewardsVault.sol" target="_blank" rel="noopener">查看奖池源码${icon('arrow')}</a><button class="text-link" data-chain="open">${ready?'查看钱包':'先连接游戏钱包'}${icon('arrow')}</button></div><p class="chain-fine-print">部署者是运营收入领取地址；售价和分配比例在部署后固定。部署本身只支付 Gas，不会自动注资。</p></section>`;
  }
  function season() {
    if(!valid())return `<section class="card reward-card reward-empty">${icon('crown')}<h3>连上真实奖池，再查看可领取金额。</h3><p>未连接时不显示模拟资金。你可以继续试玩，或先查看右侧的资金分配规则。</p></section>`;
    const s=snapshot,{config:c,data:d}=s,p=d.pool,a=d.entry;
    const current=s.epoch===s.currentEpoch,closed=!current;
    const eligible=Number(d.created)>0&&Number(d.timestamp)>=Number(d.created)+86400&&Number(d.delivered)>=10;
    const unsynced=current&&a.enrolled?Math.max(0,Number(d.score)-Number(a.baseline)-Number(a.points)):0;
    const claim=BigInt(d.prize)+BigInt(d.dividend);
    const locked=chainUI.busy();
    return `<section class="card reward-card"><div class="card-heading"><div><span class="section-kicker">SEASON ${s.epoch+1}</span><h2>第 ${s.epoch+1} 期 · ${closed?'已结束':'进行中'}</h2></div><button class="btn btn-outline btn-small" data-reward="refresh">${icon('reset')}刷新</button></div><p class="chain-copy">截止：${date(Number(c.start)+(s.epoch+1)*604800)}（北京时间）。须在截止前同步积分。</p><div class="pool-stats"><div><span>赛季奖池</span><strong>${qkiAmount(p.prizeBudget)}</strong><small>QKI</small></div><div><span>活跃分配池</span><strong>${qkiAmount(p.dividendBudget)}</strong><small>QKI</small></div><div><span>你的可领取</span><strong>${qkiAmount(claim)}</strong><small>QKI${closed?'':' · 结束后结算'}</small></div></div><div class="season-selector"><label class="field-label" for="reward-season">查看赛季</label><input id="reward-season" class="chain-input" type="number" min="1" max="${s.currentEpoch+1}" value="${s.epoch+1}"><button class="btn btn-outline btn-small" data-reward="season">查看</button><span class="subtle">当前第 ${s.currentEpoch+1} 期</span></div><div class="contribution-box"><div class="card-heading"><h3>你的本期贡献</h3><span class="count-label">${a.enrolled?'已报名':'尚未报名'}</span></div><dl class="network-facts"><div><dt>已同步新增积分</dt><dd>${num(a.points)}</dd></div><div><dt>待同步积分</dt><dd>${num(unsynced)}</dd></div><div><dt>活跃分配权重</dt><dd>${num(a.weight)} / 1000</dd></div><div><dt>本期总权重</dt><dd>${num(p.totalWeight)}</dd></div><div><dt>累计链上订单</dt><dd>${num(d.delivered)} / 10 起</dd></div></dl><div class="chain-actions">${current?`<button class="btn btn-primary" data-reward="enroll" ${eligible&&!a.enrolled&&!locked?'':'disabled'}>${a.enrolled?'已报名本期':'报名本赛季'}</button><button class="btn btn-outline" data-reward="sync" ${a.enrolled&&unsynced>0&&!locked?'':'disabled'}>同步新增积分</button>`:`<button class="btn btn-outline" data-reward="settle" ${p.settled||locked?'disabled':''}>${p.settled?'已结算':'结算本赛季'}</button><button class="btn btn-primary" data-reward="claim" ${claim>0n&&!a.claimed&&!locked?'':'disabled'}>${a.claimed?'本期已领取':'领取奖池与活跃分配'}</button>`}</div>${current&&!eligible?'<p class="chain-fine-print">参与门槛：矿区创建满 24 小时且累计完成 10 张链上订单。购买外观或赞助不会代替这些条件。</p>':''}<p class="chain-fine-print">仅报名后的新增订单积分有效；活跃分配权重每地址每期最多 1000。赛季排名使用实际新增积分。</p></div></section><section class="card reward-card"><div class="card-heading"><h2>赛季前三名</h2><span class="subtle">${num(p.participants)} 个报名地址</span></div><div class="reward-ranks">${Array.from(p.leaders,(address,i)=>{const exists=!/^0x0{40}$/i.test(address);return `<div class="reward-rank"><span class="rank-medal">${i+1}</span><div><strong>${exists?shortAddress(address):'席位待产生'}</strong><small>${exists?num(p.topPoints[i])+' 新增积分':'空缺份额滚入后续赛季'}</small></div><span>${[50,30,20][i]}%<small>${exists?qkiAmount(p.prizeBudget*BigInt([50,30,20][i])/100n)+' QKI':'—'}</small></span></div>`;}).join('')}</div><p class="chain-fine-print">前三名分配赛季池的 50% / 30% / 20%。同分时，较早报名的地址优先。排名在截止前仍会变化。</p></section>`;
  }
  function view(){return model()+setup()+season();}
  function side(){
    const s=valid()?snapshot:null,c=s?.config,d=s?.data,ready=!!s&&!chainUI.busy();
    return `<section class="card reward-card"><span class="section-kicker">REAL INCOME. FINITE BUDGET.</span><h2>收入如何分配</h2><table class="split-table"><tbody><tr><td>赛季奖池</td><td>60%</td></tr><tr><td>活跃贡献分配</td><td>20%</td></tr><tr><td>项目运营</td><td>20%</td></tr></tbody></table><p class="chain-fine-print">例如外观实际销售收入为 100 QKI，则分别分配 60、20、20 QKI。此处是分配示例，不是收入预测。</p></section><section class="card reward-card"><div class="gold-hat-preview">${icon('crown')}</div><h2>永久金色矿帽</h2><p class="chain-copy">让角色头像戴上金色矿帽。纯外观效果，不增加产量、排名或分配权重。</p><div class="skin-price"><strong>${c?exactQki(c.price):'—'}</strong><span>QKI · 一次购买</span></div><button class="btn btn-gold btn-full" data-reward="buy" ${ready&&!d?.skinOwned?'':'disabled'}>${d?.skinOwned?'金帽已拥有':'购买金色矿帽'}</button></section><section class="card reward-card"><h2>${s?`赞助第 ${s.currentEpoch+1} 期奖池`:'赞助当前赛季奖池'}</h2><p class="chain-copy">赞助金额 100% 进入当前赛季奖池，不增加个人积分或权重，不提供退还本金。</p><label class="field-label" for="sponsor-qki">赞助金额 / QKI</label><input id="sponsor-qki" class="chain-input" inputmode="decimal" value="1"><button class="btn btn-primary btn-full" data-reward="sponsor" ${ready?'':'disabled'}>赞助奖池</button></section><section class="card reward-card"><h2>资金记录</h2><dl class="network-facts"><div><dt>奖池合约余额</dt><dd>${c?qkiAmount(c.balance)+' QKI':'—'}</dd></div><div><dt>运营可领取</dt><dd>${c?qkiAmount(c.operatorFunds)+' QKI':'—'}</dd></div><div><dt>运营地址</dt><dd>${c?shortAddress(c.operator):'部署时确定'}</dd></div></dl><p class="chain-fine-print">合约余额包含历史尚未领取的权益。运营地址只能提取运营份额，不能提取玩家奖池。</p>${c&&wallet.account.toLowerCase()===c.operator.toLowerCase()?`<button class="btn btn-outline btn-full" data-reward="project" ${ready&&c.operatorFunds>0n?'':'disabled'}>领取运营收入</button>`:''}</section><section class="card reward-card"><h2>参与规则</h2><p class="chain-copy">报名 → 完成新订单 → 截止前同步积分 → 赛季结束后领取。历史已赚取的奖励不会因为进入下一期而过期。</p><p class="chain-fine-print">按地址计算的门槛与权重上限不等于真人去重。无需购买外观即可参与；没有固定收益率。无人参与或空缺的排名份额滚入后续赛季奖池。</p></section>`;
  }
  async function action(name) {
    try{
      if(name==='attach'){await wallet.verifyRewardContract(document.querySelector('#reward-vault').value.trim());selected=null;await reload(null);toast('奖池代码与游戏绑定核验通过。','shield');}
      else if(name==='deploy'){const price=parseQki(document.querySelector('#skin-price').value);if(price<=0n)throw new Error('金帽售价必须大于 0。');await chainUI.requestReward('deploy',[price],'部署收入分配奖池（运营地址为当前钱包）');}
      else if(name==='refresh')await reload();
      else if(name==='season'){const e=Number(document.querySelector('#reward-season').value)-1;await reload(e);}
      else if(name==='enroll')await chainUI.requestReward('enroll',[snapshot.currentEpoch],'报名当前赛季（不收费，仅支付 Gas）');
      else if(name==='sync')await chainUI.requestReward('sync',[snapshot.currentEpoch],'同步报名后的新增订单积分');
      else if(name==='settle')await chainUI.requestReward('settle',[snapshot.epoch],`结算第 ${snapshot.epoch+1} 期奖池`);
      else if(name==='claim'){const total=snapshot.data.prize+snapshot.data.dividend;await chainUI.requestReward('claim',[snapshot.epoch,wallet.account],`领取第 ${snapshot.epoch+1} 期 ${exactQki(total)} QKI 至当前钱包`);}
      else if(name==='buy')await chainUI.requestReward('buySkin',[snapshot.currentEpoch],'购买永久金色矿帽（不增加奖励权重）',snapshot.config.price);
      else if(name==='sponsor'){const value=parseQki(document.querySelector('#sponsor-qki').value);if(value<=0n)throw new Error('赞助金额必须大于 0。');await chainUI.requestReward('sponsor',[snapshot.currentEpoch],`赞助第 ${snapshot.currentEpoch+1} 期奖池（100% 入池，不可撤回）`,value);}
      else if(name==='project')await chainUI.requestReward('withdrawProject',[wallet.account],'领取已到账的运营收入至当前钱包');
    }catch(e){toast(chainError(e),'help');}
  }
  document.addEventListener('click',e=>{const el=e.target.closest('[data-reward]');if(el&&!el.disabled)action(el.dataset.reward);});
  setInterval(()=>{if(getView()==='rewards'&&valid()&&!loading&&!chainUI.busy()&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input'))reload().catch(()=>{});},20000);
  return {view,side,reload,hasSkin:()=>!!(valid()&&snapshot.data.skinOwned),onReceipt:async()=>{selected=null;await reload(null);}};
}

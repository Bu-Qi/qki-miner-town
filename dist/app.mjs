import { SAVE_KEY, ITEMS, MINES, RECIPES, MILESTONES, createGame, loadGame, advance, capacity, output, canAfford, collect, craft, upgradeCost, upgrade, assign, deliver, expand, boost, guideStep } from './engine.mjs';
import { icon, itemIcon, scene } from './art.mjs';
import { createChainUI } from './chain-ui.mjs';

const $ = q => document.querySelector(q);
let storageOK = true;
let rawSave;
try { rawSave = localStorage.getItem(SAVE_KEY); } catch { storageOK = false; }
let state = rawSave ? loadGame(rawSave) : createGame();
let localState = state;
let chainMode = false;
let chainUI;
let chainRefreshing = false;
const advanceGame = () => advance(state, Date.now() + (chainMode ? chainUI.wallet.clockOffset : 0));
const CHAIN_ACTIONS = new Set(['collect-all','collect','craft','assign-minus','assign-plus','upgrade','deliver','expand','boost']);
const VIEWS = {
  home: { name: '我的矿区', short: '矿区', icon: 'map', title: '早安，矿工<span class="heading-dot">。</span>', subtitle: '新的一天，从山谷里的第一块铜矿开始。' },
  workshop: { name: '山谷工坊', short: '制造', icon: 'hammer', title: '好手艺，让小镇转起来。', subtitle: '矿石到合金，零件到设备，每一步都有新的可能。' },
  orders: { name: '小镇订单', short: '订单', icon: 'orders', title: '小镇，正需要你。', subtitle: '把仓库里的材料，变成山谷里实实在在的改变。' },
  season: { name: '成长手册', short: '成长', icon: 'crown', title: '每一点进步，都算数。', subtitle: '交付订单、积累积分，留下属于你的山谷足迹。' },
  inventory: { name: '我的仓库', short: '仓库', icon: 'box', title: '努力，装得满满当当。', subtitle: '把材料存好，把下一次升级安排好。' },
  chain: { name: 'QKI 链上矿区', short: '链上', icon: 'wallet', title: '你的小镇，连接 QKI。', subtitle: '连接钱包，读取真实余额，让游戏进度由链上合约记录。' },
};
let view = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
let lastSave = 0;
let audioContext;
const quantities = {};
const dialog = $('#game-dialog');
const fmt = n => n.toLocaleString('zh-CN');
const totalPending = () => Object.values(state.mines).reduce((sum, m) => sum + m.pending, 0);
const assigned = () => Object.values(state.mines).reduce((sum, m) => sum + m.assigned, 0);

function save() {
  if (chainMode) for (const pref of ['muted','motion','guideHidden']) localState[pref]=state[pref];
  if (storageOK) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(chainMode ? localState : state)); lastSave = Date.now(); }
    catch { storageOK = false; toast('当前无法保存进度，请保持页面开启。', 'help'); }
  }
  $('#save-state').innerHTML = icon(chainMode ? 'shield' : storageOK ? 'check' : 'help') + (chainMode ? '链上进度 · 已读取' : storageOK ? '试玩进度已保存' : '当前进度未保存');
}
function enterChain(s) {
  const wasActive=chainMode;
  if(!wasActive){save();localState=state;}
  state=s;chainMode=true;
  if(!wasActive){view='home';location.hash='home';window.scrollTo({top:0,behavior:'instant'});}
  render();save();
}
function leaveChain() {
  if(!chainMode)return;
  for(const pref of ['muted','motion','guideHidden'])localState[pref]=state[pref];
  state=localState;chainMode=false;advanceGame();render();save();
}
function sound(high = false) {
  if (state.muted) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator(), gain = audioContext.createGain();
    osc.connect(gain); gain.connect(audioContext.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(high ? 740 : 520, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(high ? 990 : 690, audioContext.currentTime + .09);
    gain.gain.setValueAtTime(.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .23);
    osc.start(); osc.stop(audioContext.currentTime + .24);
  } catch {}
}
function toast(text, glyph = 'check') {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = icon(glyph) + `<span>${text}</span>`;
  $('#toast-stack').append(el);
  while ($('#toast-stack').children.length > 3) $('#toast-stack').firstChild.remove();
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 260); }, 2900);
}
function celebrate() {
  if (!state.motion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 28; i++) {
    const el = document.createElement('i'); el.className = 'confetti';
    el.style.cssText = `left:${15 + Math.random()*75}vw;background:${['#d9b466','#92ad7d','#cc9169','#8ab7a7'][i%4]};--drift:${Math.random()*160-80}px;animation-delay:${Math.random()*.4}s`;
    $('#celebration').append(el); setTimeout(() => el.remove(), 3400);
  }
}
function costChips(cost, qty = 1) {
  return `<div class="cost-list">${Object.entries(cost).map(([id, n]) => `<span class="cost-chip ${state.inventory[id] < n*qty ? 'short' : ''}" title="${ITEMS[id].name}：拥有 ${state.inventory[id]}，需要 ${n*qty}">${itemIcon(id)}<span>${fmt(state.inventory[id])}<span class="need"> / ${n*qty}</span></span></span>`).join('')}</div>`;
}
function resources() {
  $('#resources').innerHTML = ['copper','energy','crystal','alloy','gear'].map(id => `<div class="resource">${itemIcon(id)}<div class="resource-info"><span class="resource-label">${ITEMS[id].name}</span><strong class="resource-value" data-stock="${id}">${fmt(state.inventory[id])}</strong></div></div>`).join('') + `<div class="resource score">${icon('star')}<div class="resource-info"><span class="resource-label">订单积分</span><strong class="resource-value">${fmt(state.score)}</strong></div><span class="score-label">努力有回响</span></div>`;
}
function mineCard(id) {
  const m = state.mines[id], def = MINES[id];
  return `<article class="card mine-card ${id}"><div class="mine-title"><div class="mine-item-box">${itemIcon(id)}</div><div><h3>${def.name}</h3><span class="level">LV.${String(m.level).padStart(2,'0')} <span>· ${def.tag}</span></span></div></div><div class="mine-rate"><span>${m.assigned ? '开采中' : '等待矿机'}</span><strong>每 ${def.seconds} 秒 +${output(state,id)*m.assigned}</strong></div><div class="progress-track"><div class="progress-fill" data-live-progress="${id}" style="width:${m.work/(def.seconds*1000)*100}%"></div></div><div class="mine-production"><div><strong class="pending-number" data-pending="${id}">${m.pending}</strong><span class="pending-cap"> / ${capacity(state,id)}</span></div><button class="btn btn-soft collect-btn" data-action="collect" data-id="${id}" ${m.pending ? '' : 'disabled'}>收取${icon('down')}</button></div><div class="assign-row"><div class="assignment"><span>矿机</span><button class="assign-control" data-action="assign-minus" data-id="${id}" aria-label="减少${def.name}矿机" ${m.assigned ? '' : 'disabled'}>${icon('minus')}</button><span class="assignment-count">${m.assigned}</span><button class="assign-control" data-action="assign-plus" data-id="${id}" aria-label="增加${def.name}矿机" ${assigned() >= state.machines ? 'disabled' : ''}>${icon('plus')}</button></div><button class="upgrade-link" data-action="upgrade-info" data-id="${id}">${m.level < 5 ? '升级' : '满级'}${icon('arrow')}</button></div></article>`;
}
function guide() {
  if (state.guideHidden) return '';
  const step = guideStep(state);
  const steps = [
    ['第一步，收下山谷的礼物', '三个矿场都备好了材料，点击「一键收取」。', '去收取', 'box'],
    ['第二步，炼出第一块合金', '4 份铜矿 + 2 份能量，就能造出新材料。', '去制造', 'hammer'],
    ['第三步，帮小镇交付订单', '订单积分能解锁成长徽章，材料备好就出发。', '去交付', 'orders'],
    ['第四步，让矿场更进一步', '留好一块合金，升级铜矿场，提高每轮产出。', '去升级', 'pick'],
    ['你已经是一名合格的小镇矿工了', '接下来试试分配矿机，或组装一台精密钻机。', '去工坊', 'sprout'],
  ];
  const [title, desc, cta, glyph] = steps[step];
  return `<section class="guide-card" aria-label="新手引导"><div class="guide-icon">${icon(glyph)}</div><div class="guide-body"><strong>${title}</strong><span class="guide-step">${step < 4 ? `${step+1} / 4` : '已完成'}</span><p>${desc}</p></div><button class="btn btn-outline" data-action="guide-next">${cta}${icon('arrow')}</button><button class="guide-close" data-action="guide-hide" aria-label="收起新手引导">${icon('close')}</button></section>`;
}
function home() {
  return `<section class="card valley-card"><div class="valley-top"><div><div class="valley-title-row"><h2>我的矿区</h2><span class="weather"><span class="sun-dot"></span>晴 · 适宜开采</span></div><div class="valley-id">NO.001 / MORNING VALLEY</div></div><button class="btn btn-outline btn-small" data-action="boost-info">${icon('bolt')}生产加速<span class="subtle">×${state.boosts}</span></button></div><div class="scene-wrap">${scene()}<div class="map-hint">${icon('help')}点击矿场，也可以收取资源</div><div class="map-compass"><span>N</span><span class="compass-diamond"></span></div></div><div class="valley-footer"><div class="valley-summary"><span>${icon('pick')} <strong>${state.machines}</strong> 台矿机</span><span class="tiny-sep"></span><span>待收取 <strong data-total-pending>${totalPending()}</strong> 份资源</span></div><button class="btn btn-primary" data-action="collect-all" ${totalPending() ? '' : 'disabled'}>${icon('down')}一键收取</button></div></section>${guide()}<div class="section-heading"><div><h2>生产调度</h2><p>把矿机安排在最需要它的地方。</p></div><div class="machine-badge">${icon('pick')}闲置 <strong>${state.machines-assigned()}</strong> / ${state.machines}</div></div><section class="mine-grid" aria-label="矿场生产">${Object.keys(MINES).map(mineCard).join('')}</section>`;
}
function orderCard(order, large = false) {
  const ready = canAfford(state, order.cost);
  return `<article class="order"><div class="order-top"><div><div class="order-client">${order.client}</div><h3>${order.title}</h3></div><span class="order-reward">${icon('star')}+${order.reward}</span></div>${large ? `<p class="order-desc">${order.desc}</p>` : ''}${costChips(order.cost)}<div class="order-bottom"><span class="order-ready">${icon(ready ? 'check' : 'clock')}${ready ? '材料已备齐' : '等待备料'}</span><button class="btn ${ready ? 'btn-primary' : 'btn-soft'}" data-action="deliver" data-id="${order.id}" ${ready ? '' : 'disabled'}>交付订单${icon('arrow')}</button></div></article>`;
}
function rightSide() {
  const next = MILESTONES.find(m => m.score > state.score) || MILESTONES.at(-1);
  const completed = state.score >= 500;
  return `<section class="card orders-panel"><div class="card-heading"><h2>小镇订单</h2><span class="count-label">${state.orders.filter(o=>canAfford(state,o.cost)).length} 项可交付</span></div>${state.orders.map(o=>orderCard(o)).join('')}<div class="order-footer-note">${icon('reset')}交付后，新的委托会送到这里</div></section><section class="card season-mini"><div class="card-heading"><span class="section-kicker">GROW AT YOUR OWN PACE</span><span class="subtle">成长手册</span></div><h3>${completed ? '晨曦矿业家' : `下一站 · ${next.title}`}</h3><p>${completed ? '全部成长徽章已解锁，继续建设你的小镇。' : `再获得 ${next.score-state.score} 积分，点亮新徽章。`}</p><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,state.score/next.score*100)}%"></div></div><span class="subtle">${state.score} / ${next.score} 积分</span><br><button class="text-link" data-view="season">翻开成长手册${icon('arrow')}</button></section><section class="card quick-workshop"><div class="card-heading"><h2>工坊速造</h2><button class="text-link" data-view="workshop">全部配方${icon('chevron')}</button></div><p>下一次升级，从一块合金开始。</p><div class="quick-craft-line"><div>${itemIcon('alloy')}合金 ×1</div><button class="btn btn-outline btn-small" data-action="craft" data-id="alloy" ${canAfford(state,RECIPES[0].cost) ? '' : 'disabled'}>熔炼${icon('hammer')}</button></div>${costChips(RECIPES[0].cost)}</section>`;
}
function recipeCard(r) {
  const qty = quantities[r.id] || 1;
  const cost = Object.fromEntries(Object.entries(r.cost).map(([id,n])=>[id,n*qty]));
  return `<article class="card recipe-card"><div class="recipe-heading"><div class="recipe-art">${itemIcon(r.id)}</div><div><h3>${r.name}</h3><p>${r.subtitle}</p></div></div><span class="subtle">所需材料 <span>· 拥有 / 需要</span></span>${costChips(r.cost,qty)}<div class="recipe-footer"><span class="stock-note">已拥有 ${fmt(state.inventory[r.id])} 份</span><div class="craft-controls"><select class="quantity-select" data-quantity="${r.id}" aria-label="${r.name}制造数量"><option value="1" ${qty===1?'selected':''}>×1</option><option value="5" ${qty===5?'selected':''}>×5</option><option value="10" ${qty===10?'selected':''}>×10</option></select><button class="btn btn-primary btn-small" data-action="craft" data-id="${r.id}" data-qty="${qty}" ${canAfford(state,cost)?'':'disabled'}>${canAfford(state,cost)?'立即制造':'材料不足'}</button></div></div></article>`;
}
function workshop() {
  return `<section class="view-intro"><div><span class="section-kicker">THE VALLEY WORKSHOP</span><h2>把材料，变成可能。</h2><p>五种配方，一间小工坊。先熔炼合金，再锻造齿轮，精密钻机能让你的矿队更壮大。</p></div><div class="intro-art">${itemIcon('drill')}</div></section><div class="section-heading"><h2>制造配方</h2><span class="subtle">材料即时消耗 · 成品进入仓库</span></div><section class="recipe-grid">${RECIPES.map(recipeCard).join('')}</section><div class="note-card">${icon('leaf')}<span>小建议：先留出一块合金升级矿场，再考虑交付订单。升级提高每轮产量，也能扩大矿场的待收取容量。</span></div>`;
}
function ordersView() {
  return `<section class="view-intro"><div><span class="section-kicker">GOOD THINGS, DELIVERED</span><h2>每一份委托，都是一段小故事。</h2><p>按自己的节奏交付，没有倒计时。完成一单，就会收到新的委托。积分用于解锁成长徽章。</p></div><div class="intro-art">${icon('orders')}</div></section><div class="section-heading"><h2>当前委托</h2><span class="subtle">已交付 ${state.delivered} 单</span></div><section class="order-list">${state.orders.map(o=>orderCard(o,true)).join('')}</section>`;
}
function inventory() {
  return `<section class="view-intro"><div><span class="section-kicker">EVERY LITTLE THING COUNTS</span><h2>一点一滴，都是积累。</h2><p>矿场产出先存放在待收取区，收取后才进入仓库。普通资源和制造成品都在这里。</p></div><div class="intro-art">${itemIcon('gear')}</div></section><section class="inventory-grid">${Object.entries(ITEMS).map(([id,item])=>`<article class="card inventory-item">${itemIcon(id)}<h3>${item.name}</h3><div class="inventory-count">${fmt(state.inventory[id])}</div><span class="inventory-type">${item.type}</span></article>`).join('')}</section><section class="card expand-card"><div><h3>让矿队，再壮大一点。</h3><p>使用 1 台精密钻机，增加 1 台可分配矿机。最多 6 台。</p>${costChips({drill:1})}</div><button class="btn btn-primary" data-action="expand" ${state.inventory.drill>=1&&state.machines<6?'':'disabled'}>${icon('plus')}${state.machines>=6?'矿队已满员':`扩建矿队 · ${state.machines} / 6`}</button></section><div class="note-card">${icon('save')}<span>${chainMode?'这份仓库由 QKI 游戏合约记录。材料是游戏数值，当前合约不提供兑换、提现或转出功能。':'当前试玩进度保存在这台设备的浏览器里。清理浏览器数据会移除存档；试玩资源没有兑换或提现功能。'}</span></div>`;
}
function season() {
  const next=MILESTONES.find(m=>m.score>state.score);
  return `<section class="season-hero"><div class="eyebrow">YOUR STORY IN MORNING VALLEY</div><h2>山谷的成长手册</h2><p>每一张订单，都会成为你在这里生活过的证明。</p><div class="season-score">${fmt(state.score)}<small>累计订单积分</small></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,state.score/500*100)}%"></div></div><p>${next?`距离「${next.title}」还有 ${next.score-state.score} 积分`:'全部成长徽章已点亮。山谷的故事，还在继续。'}</p></section><div class="section-heading"><h2>你的成长足迹</h2><span class="subtle">${MILESTONES.filter(m=>state.score>=m.score).length} / 4 枚徽章已点亮</span></div><section class="milestones">${MILESTONES.map(m=>`<article class="milestone ${state.score>=m.score?'unlocked':''}"><div class="milestone-icon">${icon(m.icon)}</div><div><h3>${m.title}</h3><p>${m.desc}</p></div><div class="milestone-status"><strong>${state.score>=m.score?icon('check'):`${m.score} 积分`}</strong>${state.score>=m.score?'已解锁':'等待点亮'}</div></article>`).join('')}</section><div class="note-card">${icon('shield')}<span>${chainMode?'成长手册展示该钱包在 QKI 合约中的订单积分。徽章为游戏内成就，当前没有 QKI 奖池。':'成长手册展示你自己的试玩记录。徽章为游戏内成就；本版本没有真实 QKI 奖池或链上排行榜。'}</span></div>`;
}
function render() {
  const active = document.activeElement;
  const focusAction = active?.dataset?.action, focusId = active?.dataset?.id;
  document.body.classList.toggle('no-motion', !state.motion);
  $('#navigation').innerHTML=Object.entries(VIEWS).map(([id,v])=>`<button class="nav-item ${view===id?'active':''}" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(v.icon)}<span>${v.short}</span></button>`).join('');
  $('#current-page').textContent=VIEWS[view].name;
  $('#page-title').innerHTML=VIEWS[view].title;
  $('#page-subtitle').textContent=VIEWS[view].subtitle;
  $('#player-level').textContent=`矿工等级 LV.${String(1+Math.floor(state.score/100)).padStart(2,'0')}`;
  resources();$('#resources').hidden=view==='chain';
  $('#mode-bar').innerHTML=view==='chain'?'':chainUI.modeBar();
  $('#view-content').innerHTML=view==='chain'?chainUI.view():({home,workshop,orders:ordersView,season,inventory})[view]();
  $('#right-content').innerHTML=view==='chain'?chainUI.side():rightSide();
  if(chainMode&&chainUI.busy())document.querySelectorAll('[data-action]').forEach(el=>{if(CHAIN_ACTIONS.has(el.dataset.action))el.disabled=true;});
  updateLive();
  if(focusAction&&!dialog.open){
    const candidates=[...document.querySelectorAll(`[data-action="${focusAction}"]`)];
    const target=candidates.find(el=>el.dataset.id===focusId&&!el.disabled);
    target?.focus({preventScroll:true});
  }
}
function updateLive() {
  const total=totalPending();
  for(const id of Object.keys(MINES)) {
    const m=state.mines[id];
    document.querySelectorAll(`[data-pending="${id}"], [data-scene-pending="${id}"]`).forEach(el=>el.textContent=m.pending);
    document.querySelectorAll(`[data-live-progress="${id}"]`).forEach(el=>el.style.width=`${m.work/(MINES[id].seconds*1000)*100}%`);
    document.querySelectorAll(`[data-action="collect"][data-id="${id}"]`).forEach(el=>el.disabled=!m.pending);
  }
  document.querySelectorAll('[data-total-pending]').forEach(el=>el.textContent=total);
  document.querySelectorAll('[data-action="collect-all"]').forEach(el=>el.disabled=!total);
}
function navigate(id) {
  if(!VIEWS[id])return;
  view=id; location.hash=id; render(); window.scrollTo({top:0,behavior:'instant'});
}
window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(VIEWS[id]&&id!==view){view=id;render();}});
function openDialog(title,body) {
  $('#dialog-content').innerHTML=`<div class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="btn btn-icon" data-action="dialog-close" aria-label="关闭弹窗">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;
  if(!dialog.open)dialog.showModal();
}
function help() {
  openDialog('欢迎来到晨曦矿谷',`<p>这是「QKI 矿工小镇」的第一版免费试玩。安排矿机，制造设备，用你自己的节奏建设一座小镇。</p><div class="help-step"><span>01</span><div><h3>采集与调度</h3><p>三个矿场自动生产。点击矿场或「一键收取」，资源进入仓库。用 − / + 调整矿机分配。</p></div></div><div class="help-step"><span>02</span><div><h3>制造与升级</h3><p>在工坊熔炼合金、打造零件。升级矿场能增加产量；制造精密钻机可以扩建矿队。</p></div></div><div class="help-step"><span>03</span><div><h3>订单与成长</h3><p>交付材料获得积分，解锁成长徽章。订单长期有效，你可以先留材料升级。</p></div></div><div class="info-box"><strong>关于 QKI 版本</strong><br>你可以免费试玩，也可以在「链上」页面连接 QKI 钱包。链上矿区的采集、制造、升级和订单由合约执行，交易需要支付 QKI Gas。两种矿区分别保存，试玩资源不会导入链上。<br>离开页面也会积累产出，最多结算 4 小时，并受矿场待收取容量限制。</div><button class="btn btn-primary btn-full" data-action="dialog-close">开始我的小镇${icon('arrow')}</button>`);
}
function upgradeInfo(id) {
  if(!MINES[id])return;
  const m=state.mines[id];
  if(m.level>=5){openDialog(MINES[id].name,`<div class="upgrade-visual">${itemIcon(id)}</div><p>矿场已达到 LV.05。试试扩建矿队，再分配更多矿机到这里。</p><button class="btn btn-primary btn-full" data-action="go-inventory">查看矿队${icon('arrow')}</button>`);return;}
  const cost=upgradeCost(state,id), ready=canAfford(state,cost);
  openDialog(`升级${MINES[id].name}`,`<div class="upgrade-visual"><div class="upgrade-level">${itemIcon(id)}<span>LV.${String(m.level).padStart(2,'0')}</span></div>${icon('arrow')}<div class="upgrade-level next">${itemIcon(id)}<span>LV.${String(m.level+1).padStart(2,'0')}</span></div></div><p>${MINES[id].desc} 升级会立即提升每台矿机的产出。</p><div class="upgrade-stats"><div class="upgrade-stat">每轮 / 每台产出<strong>${output(state,id)} → ${output(state,id)+1}</strong></div><div class="upgrade-stat">待收取容量<strong>${capacity(state,id)} → ${capacity(state,id)+8}</strong></div></div><span class="subtle">升级材料 · 拥有 / 需要</span>${costChips(cost)}<button class="btn btn-primary btn-full" data-action="upgrade" data-id="${id}" ${ready?'':'disabled'}>${ready?'确认升级':'材料还没备齐'}${icon('arrow')}</button>${!ready?'<button class="btn btn-outline btn-full" data-action="go-workshop">去工坊备料</button>':''}`);
}
function settings() {
  openDialog('小镇设置',`<p>按你喜欢的方式，享受在山谷里的时间。</p><div class="setting-row"><div><strong>游戏音效</strong><span>采集、制造与交付的轻提示音</span></div><button role="switch" aria-checked="${!state.muted}" aria-label="游戏音效" class="toggle ${state.muted?'':'on'}" data-action="toggle-sound"></button></div><div class="setting-row"><div><strong>场景动态</strong><span>烟雾、晶石闪光与成长庆祝</span></div><button role="switch" aria-checked="${state.motion}" aria-label="场景动态" class="toggle ${state.motion?'on':''}" data-action="toggle-motion"></button></div><div class="info-box">${icon('save')} ${storageOK?'进度会自动保存在当前浏览器。':'当前浏览器无法保存进度。'}<br>${chainMode?'当前为 QKI 链上矿区':'试玩为单人体验'}，当前矿队 ${state.machines} 台，累计交付 ${state.delivered} 单。</div><div class="reset-area"><p>想从头再体验一次？重置会清除这台浏览器的试玩进度。</p>${chainMode?'<span class="subtle">链上记录无法在本站重置，可返回试玩矿区。</span>':`<button class="btn btn-outline btn-small" data-action="reset-ask">${icon('reset')}重新开始试玩</button>`}<div id="reset-confirm"></div></div>`);
}
function handleAction(action,id,el) {
  advanceGame();
  if(chainMode&&CHAIN_ACTIONS.has(action)){chainUI.gameAction(action,id,Number(el?.dataset.qty||1));return;}
  const beforeMilestones=MILESTONES.filter(m=>state.score>=m.score).length;
  let changed=false;
  if(action==='collect-all') {
    let parts=[];
    for(const mine of Object.keys(MINES)){const n=collect(state,mine);if(n)parts.push(`${ITEMS[mine].name} +${n}`);}
    if(parts.length){toast(parts.join('　'),'box');sound();changed=true;}
  } else if(action==='collect') {
    const n=collect(state,id);if(n){toast(`${ITEMS[id].name} +${n}`,'box');sound();changed=true;}else toast('矿机正在开采，再等一下就好。','clock');
  } else if(action==='craft') {
    const qty=Number(el?.dataset.qty||1);
    if(craft(state,id,qty)){toast(`${ITEMS[id].name} +${qty}，已放入仓库。`,'hammer');sound();changed=true;}else toast('材料不足，先去矿场收取一些资源。','help');
  } else if(action==='assign-minus'||action==='assign-plus') {
    changed=assign(state,id,action==='assign-plus'?1:-1);
    if(!changed)toast('没有闲置矿机了，可先从其他矿场调出。','pick');
  } else if(action==='upgrade-info')upgradeInfo(id);
  else if(action==='upgrade') {
    if(upgrade(state,id)){dialog.close();toast(`${MINES[id].name}升到 LV.${String(state.mines[id].level).padStart(2,'0')}，产量增加！`,'star');sound(true);changed=true;}
    else{upgradeInfo(id);toast('升级材料不足。','help');}
  } else if(action==='deliver') {
    const reward=deliver(state,Number(id));
    if(reward){toast(`交付完成！订单积分 +${reward}`,'star');sound(true);changed=true;
      if(MILESTONES.filter(m=>state.score>=m.score).length>beforeMilestones){celebrate();setTimeout(()=>toast(`成长徽章已点亮：${MILESTONES.filter(m=>state.score>=m.score).at(-1).title}`,'crown'),500);}
    }else toast('材料还未备齐，去工坊或矿区看看吧。','help');
  } else if(action==='expand') {
    if(expand(state)){toast('矿队新增 1 台矿机！去矿区分配它吧。','pick');sound(true);changed=true;}else toast(state.machines>=6?'矿队已达到 6 台上限。':'需要先制造 1 台精密钻机。','help');
  } else if(action==='boost-info') {
    openDialog('给生产，一点小小的加速',`<div class="upgrade-visual">${icon('bolt')}<h3>立即推进 60 秒生产</h3></div><p>所有已分配矿机的矿场，会按当前等级推进 1 分钟生产。产出仍受待收取容量限制，使用前可以先收取已有资源。</p><div class="info-box">本轮试玩还剩 <strong>${state.boosts}</strong> 次生产加速。${chainMode?'链上加速需要支付网络 Gas，不收额外游戏费用。':'试玩加速不消耗 QKI。'}</div><button class="btn btn-primary btn-full" data-action="boost" ${state.boosts?'':'disabled'}>${state.boosts?'使用 1 次加速':'加速次数已用完'}${icon('bolt')}</button>`);
  } else if(action==='boost') {
    if(boost(state)){dialog.close();toast('矿机已完成 1 分钟生产，快去收取吧。','bolt');sound();changed=true;}
  } else if(action==='guide-next') {
    const step=guideStep(state);
    if(step===0){handleAction('collect-all');return;}
    if(step===1||step===4)navigate('workshop');
    if(step===2)navigate('orders');
    if(step===3)upgradeInfo('copper');
  } else if(action==='guide-hide'){state.guideHidden=true;changed=true;}
  else if(action==='dialog-close'){chainUI.cancelDraft();dialog.close();}
  else if(action==='go-workshop'){dialog.close();navigate('workshop');}
  else if(action==='go-inventory'){dialog.close();navigate('inventory');}
  else if(action==='help')help();
  else if(action==='settings')settings();
  else if(action==='toggle-sound'){state.muted=!state.muted;save();settings();sound();}
  else if(action==='toggle-motion'){state.motion=!state.motion;save();document.body.classList.toggle('no-motion',!state.motion);settings();}
  else if(action==='reset-ask'){if(chainMode){toast('链上矿区保存在合约中，不能通过本站重置。','shield');return;}$('#reset-confirm').innerHTML='<div class="reset-confirm"><p>确认清除当前试玩存档？此操作无法撤销。</p><button class="btn btn-danger btn-small" data-action="reset-confirm">确认重新开始</button><button class="btn btn-outline btn-small" data-action="reset-cancel">保留进度</button></div>';}
  else if(action==='reset-cancel')$('#reset-confirm').innerHTML='';
  else if(action==='reset-confirm'){if(chainMode)return;state=createGame();localState=state;dialog.close();navigate('home');toast('新的一天，重新出发。','sprout');changed=true;}
  if(changed){save();render();}
}
document.addEventListener('click',e=>{
  const viewLink=e.target.closest('[data-view],[data-view-link]');
  if(viewLink){navigate(viewLink.dataset.view||viewLink.dataset.viewLink);return;}
  const mine=e.target.closest('[data-mine]');
  if(mine){handleAction('collect',mine.dataset.mine);return;}
  const el=e.target.closest('[data-action]');
  if(el&&!el.disabled)handleAction(el.dataset.action,el.dataset.id,el);
});
document.addEventListener('keydown',e=>{
  const target=e.target.closest('.scene-building');
  if(target&&['Enter',' '].includes(e.key)){e.preventDefault();target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-quantity]')){quantities[e.target.dataset.quantity]=Number(e.target.value);render();document.querySelector(`[data-quantity="${e.target.dataset.quantity}"]`)?.focus({preventScroll:true});}
});
dialog.addEventListener('cancel',()=>chainUI.cancelDraft());
dialog.addEventListener('close',()=>chainUI.cancelDraft());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
document.addEventListener('visibilitychange',()=>{advanceGame();if(!document.hidden)updateLive();save();});
window.addEventListener('pagehide',()=>{advanceGame();save();});
for(const [target,glyph] of [['#brand-icon','pick'],['#leaf-icon','sprout'],['#help-icon','help'],['#settings-icon','settings'],['#map-icon','leaf']])$(target).innerHTML=icon(glyph);
chainUI=createChainUI({openDialog,closeDialog:()=>dialog.close(),toast,render,enter:enterChain,leave:leaveChain,prefs:()=>localState,getState:()=>state,isOnchain:()=>chainMode});
render();save();
setInterval(()=>{advanceGame();updateLive();if(Date.now()-lastSave>5000&&storageOK)save();},500);
setInterval(async()=>{if(!chainMode||chainRefreshing||chainUI.busy()||dialog.open||document.activeElement?.matches('input,select'))return;chainRefreshing=true;try{await chainUI.refreshPlayer();}catch{}finally{chainRefreshing=false;}},15000);

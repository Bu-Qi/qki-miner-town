export const SAVE_KEY = 'qki-miner-town-v1';
export const MAX_OFFLINE_MS = 4 * 60 * 60 * 1000;
export const ITEMS = {
  copper: { name: '铜矿', short: '铜', color: '#c7784b', type: '原料' },
  energy: { name: '能量', short: '能', color: '#d2a62e', type: '原料' },
  crystal: { name: '晶石', short: '晶', color: '#59a29e', type: '原料' },
  alloy: { name: '合金', short: '合', color: '#86949e', type: '材料' },
  gear: { name: '齿轮', short: '齿', color: '#9a8771', type: '材料' },
  drill: { name: '精密钻机', short: '钻', color: '#b16b41', type: '装备' },
  battery: { name: '蓄能电池', short: '电', color: '#b19c37', type: '材料' },
  beacon: { name: '勘探信标', short: '标', color: '#699da0', type: '装备' },
};
export const MINES = {
  copper: { name: '赤铜矿场', desc: '山谷深处，藏着第一桶金。', seconds: 6, yield: 3, tag: '基础原料' },
  energy: { name: '日光能源站', desc: '把每一束阳光，变成动力。', seconds: 8, yield: 2, tag: '生产动力' },
  crystal: { name: '青晶矿洞', desc: '一点耐心，换一抹稀有的蓝。', seconds: 12, yield: 1, tag: '稀有原料' },
};
export const RECIPES = [
  { id: 'alloy', name: '熔炼合金', subtitle: '所有好设备的起点', cost: { copper: 4, energy: 2 }, out: 1 },
  { id: 'gear', name: '锻造齿轮', subtitle: '让矿区转得更快一点', cost: { alloy: 2, copper: 1 }, out: 1 },
  { id: 'drill', name: '组装精密钻机', subtitle: '可用于扩建矿队', cost: { alloy: 3, gear: 1, crystal: 1 }, out: 1 },
  { id: 'battery', name: '制造蓄能电池', subtitle: '为小镇储备一份能量', cost: { energy: 3, copper: 1 }, out: 1 },
  { id: 'beacon', name: '装配勘探信标', subtitle: '高阶订单需要的好东西', cost: { crystal: 2, alloy: 2, battery: 1 }, out: 1 },
];
const ORDER_DECK = [
  { title: '小镇建设，开工！', client: '镇长 · 阿木', desc: '新来的矿工，先帮小镇备点材料吧。', cost: { copper: 6, energy: 2 }, reward: 18 },
  { title: '点亮山谷的夜晚', client: '工程师 · 林', desc: '修好路灯，晚归的矿工就能找到家。', cost: { alloy: 2, energy: 4 }, reward: 32 },
  { title: '寻找青色的光', client: '勘探员 · 小石', desc: '带回晶石样本，看看矿洞里有什么。', cost: { crystal: 3, copper: 4 }, reward: 26 },
  { title: '老矿车的新齿轮', client: '修理师 · 老周', desc: '一副新齿轮，换一条顺畅的运输线。', cost: { gear: 1, alloy: 1 }, reward: 46 },
  { title: '晴天也要存电', client: '工程师 · 林', desc: '为下一个阴天，留一点温暖的能量。', cost: { battery: 2, crystal: 1 }, reward: 38 },
  { title: '山那边的信号', client: '勘探员 · 小石', desc: '让信标为远方的矿工指路。', cost: { beacon: 1, copper: 10 }, reward: 72 },
  { title: '新的运输路线', client: '镇长 · 阿木', desc: '矿区越来越热闹，材料也要跟上。', cost: { copper: 18, energy: 12 }, reward: 36 },
  { title: '扩建山谷工坊', client: '修理师 · 老周', desc: '打好地基，才能造出更好的设备。', cost: { alloy: 4, crystal: 3 }, reward: 58 },
];
export const MILESTONES = [
  { score: 30, title: '山谷新面孔', desc: '第一枚属于你的矿工徽章', icon: 'sprout' },
  { score: 90, title: '熟练的手艺', desc: '合成、交付，小镇因你忙碌', icon: 'hammer' },
  { score: 200, title: '小镇建设者', desc: '把这一片山谷，变成家', icon: 'crown' },
  { score: 500, title: '晨曦矿业家', desc: '解锁本轮试玩的最终徽章', icon: 'star' },
];
export function newOrder(serial) { return { ...ORDER_DECK[serial % ORDER_DECK.length], cost: { ...ORDER_DECK[serial % ORDER_DECK.length].cost }, id: serial }; }
export function createGame(now = Date.now()) {
  return {
    version: 1, created: now, lastTick: now, score: 0, delivered: 0, machines: 3, boosts: 3,
    inventory: { copper: 12, energy: 8, crystal: 2, alloy: 0, gear: 0, drill: 0, battery: 0, beacon: 0 },
    mines: Object.fromEntries(Object.keys(MINES).map((id, i) => [id, { assigned: 1, level: 1, work: 0, pending: [6, 4, 1][i] }])),
    orders: [newOrder(0), newOrder(1), newOrder(2)], nextOrder: 3,
    stats: { collected: 0, crafted: 0, upgrades: 0 }, muted: true, motion: true, guideHidden: false,
  };
}
const integer = (v, fallback = 0, min = 0, max = 1e9) => Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : fallback;
export function loadGame(raw, now = Date.now()) {
  const s = createGame(now);
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!v || v.version !== 1) return s;
    for (const k of Object.keys(ITEMS)) s.inventory[k] = integer(v.inventory?.[k]);
    s.created = integer(v.created, now, now - 365 * 86400000, now);
    s.lastTick = integer(v.lastTick, now, 0, now);
    s.score = integer(v.score); s.delivered = integer(v.delivered);
    s.machines = integer(v.machines, 3, 3, 6); s.boosts = integer(v.boosts, 3, 0, 3);
    let remaining = s.machines;
    for (const id of Object.keys(MINES)) {
      const m = v.mines?.[id];
      s.mines[id] = { level: integer(m?.level, 1, 1, 5), assigned: integer(m?.assigned, 0, 0, remaining), work: integer(m?.work, 0, 0, MINES[id].seconds * 1000 - 1), pending: integer(m?.pending, 0, 0, 80) };
      remaining -= s.mines[id].assigned;
    }
    if (Array.isArray(v.orders) && v.orders.length === 3) {
      const ids = v.orders.map(o => integer(o?.id, 0, 0, 1e7));
      if (new Set(ids).size === 3) { s.orders = ids.map(newOrder); s.nextOrder = Math.max(...ids) + 1; }
    }
    for (const k of Object.keys(s.stats)) s.stats[k] = integer(v.stats?.[k]);
    s.muted = v.muted !== false; s.motion = v.motion !== false; s.guideHidden = v.guideHidden === true;
    advance(s, now);
    return s;
  } catch { return s; }
}
export const capacity = (s, id) => 32 + s.mines[id].level * 8;
export const output = (s, id) => MINES[id].yield + s.mines[id].level - 1;
export function advance(s, now = Date.now()) {
  if (!Number.isFinite(now) || now <= s.lastTick) return;
  const elapsed = Math.min(MAX_OFFLINE_MS, now - s.lastTick);
  for (const id of Object.keys(MINES)) {
    const m = s.mines[id];
    if (!m.assigned) continue;
    const work = m.work + elapsed;
    const period = MINES[id].seconds * 1000;
    const cycles = Math.floor(work / period);
    m.work = work % period;
    m.pending = Math.min(capacity(s, id), m.pending + cycles * output(s, id) * m.assigned);
  }
  s.lastTick = now;
}
export const canAfford = (s, cost) => Object.entries(cost).every(([id, qty]) => s.inventory[id] >= qty);
function pay(s, cost) { for (const [id, qty] of Object.entries(cost)) s.inventory[id] -= qty; }
export function collect(s, id) {
  if (!MINES[id]) return 0;
  const qty = s.mines[id].pending;
  s.inventory[id] += qty; s.mines[id].pending = 0; s.stats.collected += qty;
  return qty;
}
export function craft(s, id, qty = 1) {
  const recipe = RECIPES.find(r => r.id === id);
  if (!recipe || !Number.isInteger(qty) || qty < 1 || qty > 10) return false;
  const cost = Object.fromEntries(Object.entries(recipe.cost).map(([k, v]) => [k, v * qty]));
  if (!canAfford(s, cost)) return false;
  pay(s, cost); s.inventory[id] += recipe.out * qty; s.stats.crafted += qty;
  return true;
}
export function upgradeCost(s, id) {
  const level = s.mines[id].level;
  if (level === 1) return { copper: 8, energy: 4, alloy: 1 };
  return { alloy: level, gear: level - 1, crystal: level };
}
export function upgrade(s, id) {
  if (!MINES[id] || s.mines[id].level >= 5) return false;
  const cost = upgradeCost(s, id);
  if (!canAfford(s, cost)) return false;
  pay(s, cost); s.mines[id].level++; s.stats.upgrades++; return true;
}
export function assign(s, id, delta) {
  if (!MINES[id] || ![-1, 1].includes(delta)) return false;
  const assigned = Object.values(s.mines).reduce((sum, m) => sum + m.assigned, 0);
  if (delta === 1 && assigned >= s.machines || delta === -1 && s.mines[id].assigned <= 0) return false;
  s.mines[id].assigned += delta; return true;
}
export function deliver(s, id) {
  const slot = s.orders.findIndex(o => o.id === id);
  if (slot < 0 || !canAfford(s, s.orders[slot].cost)) return 0;
  const order = s.orders[slot];
  pay(s, order.cost); s.score += order.reward; s.delivered++;
  s.orders[slot] = newOrder(s.nextOrder++);
  return order.reward;
}
export function expand(s) {
  if (s.machines >= 6 || s.inventory.drill < 1) return false;
  s.inventory.drill--; s.machines++; return true;
}
export function boost(s) {
  if (s.boosts < 1) return false;
  s.boosts--;
  const now = s.lastTick;
  s.lastTick -= 60000; advance(s, now);
  return true;
}
export function guideStep(s) {
  if (!s.stats.collected) return 0;
  if (!s.stats.crafted) return 1;
  if (!s.delivered) return 2;
  if (!s.stats.upgrades) return 3;
  return 4;
}

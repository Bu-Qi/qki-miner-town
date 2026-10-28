const paths = {
  wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4M5 7H3v14h18V7Zm16 5h-6v5h6m-3-2.5h.01"/>',
  pick: '<path d="m4 20 9-9m-5-7c5-2 10 0 13 4l-3 3c-2-4-6-6-10-7Z"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  hammer: '<path d="m14 4 6 6-3 3-2-2-8 9-4-4 9-8-2-2Zm-1 1 3-3 6 6-3 3"/>',
  orders: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 9h6m-6 4h6m-6 4h3"/>',
  crown: '<path d="m3 6 4 4 5-7 5 7 4-4-2 13H5Zm2 10h14"/>',
  box: '<path d="m3 7 9-4 9 4v11l-9 4-9-4Zm0 0 9 4 9-4m-9 4v11M7 5l9 4"/>',
  settings: '<path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
  sprout: '<path d="M12 21v-9C6 12 3 9 3 3c6 0 9 3 9 9Zm0 2c0-7 3-10 9-10 0 6-3 9-9 9"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sound: '<path d="M4 9h4l5-4v14l-5-4H4Zm13-1c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3Zm13 0 6 6m-6 0 6-6"/>',
  save: '<path d="M4 3h13l4 4v14H3V3Zm3 0v6h9V3M7 21v-8h10v8"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 8M4 3v7h7"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6Zm-4 9 3 3 5-6"/>',
  leaf: '<path d="M20 3C10 1 3 6 5 13s12 7 15-10ZM3 21 15 9"/>',
  flag: '<path d="M5 22V3c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',
};
export function icon(name, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`; }
export function itemIcon(id, cls = '') {
  const art = {
    copper: '<path d="m5 9 8-5 7 6-3 9-9 1-6-6Z" fill="#d99560"/><path d="m5 9 8 3 7-2-7-6Z" fill="#efb77d"/><path d="m13 12 4 7-9 1Z" fill="#b5663c"/><path d="m5 9 3 11 5-8Z" fill="#d1834f"/>',
    energy: '<path d="m14 2-10 12h7l-1 9L22 9h-8Z" fill="#e4b63c"/><path d="m14 2-3 12H4Z" fill="#f7d87b"/>',
    crystal: '<path d="m12 1 7 7-3 14H8L5 8Z" fill="#64b4b0"/><path d="M12 1 9 9l3 13L5 8Z" fill="#a3dbd0"/><path d="m12 1 2 8-2 13 7-14Z" fill="#398f95"/><path d="m9 9 5 0-2 13Z" fill="#76c7be"/>',
    alloy: '<path d="m5 8 12-3 5 7-4 7-14 2-3-7Z" fill="#8e9d9c"/><path d="m5 8 12-3 5 7-15 3-6-1Z" fill="#c6d1cb"/><path d="m7 15 15-3-4 7-14 2Z" fill="#768c88"/>',
    gear: '<path d="m10 2 5 0 1 4 4 0 2 5-3 3 1 4-4 3-4-2-4 2-4-3 1-4-3-3 2-5 4 0Z" fill="#a99575"/><path d="m10 4 4 0 1 4 4 0 1 3-3 3 1 3-3 2-3-2-4 2-2-2 1-3-3-3 1-3 4 0Z" fill="#c6b58f"/><circle cx="12" cy="12" r="4" fill="#7b765d"/><circle cx="12" cy="11" r="3" fill="#f4efdf"/>',
    drill: '<path d="m5 4 10 1 5 9-5 6-11-4Z" fill="#bd7548"/><path d="m5 4 10 1 5 6-11-1Z" fill="#edb168"/><path d="m10 10 11 1 2 4-9 6-5-6Z" fill="#889a91"/><path d="m13 12 3 7m1-9 3 6" stroke="#d2ded0" stroke-width="2"/><path d="m3 15 7 2v5H3Z" fill="#536e58"/>',
    battery: '<rect x="6" y="4" width="13" height="18" rx="3" fill="#8aa68a"/><path d="M10 1h5v4h-5Z" fill="#5a7567"/><path d="M9 7h7v12H9Z" fill="#e9cb67"/><path d="m14 8-4 6h3l-1 4 5-7h-3Z" fill="#fff4b6"/>',
    beacon: '<path d="m12 3 7 6-3 7H8L5 9Z" fill="#78b9b8"/><path d="m12 3 2 7-2 6-7-7Z" fill="#b5ded0"/><path d="m10 15-3 7h10l-3-7Z" fill="#728775"/><path d="M5 3 2 6m17-3 3 3" stroke="#c6aa5a" stroke-width="1.5"/>',
  };
  return `<svg viewBox="0 0 24 24" class="item-icon ${cls}" aria-hidden="true">${art[id] || art.copper}</svg>`;
}
const point = (x, y) => [500 + (x - y) * 45, 44 + (x + y) * 22];
const pt = a => a.join(',');
const poly = (points, fill, extra = '') => `<polygon points="${points.map(pt).join(' ')}" fill="${fill}" ${extra}/>`;
function box(x, y, w, d, h, top = '#efc28e', left = '#d39b6a', right = '#ba815c') {
  return poly([[x,y-h],[x+w,y+d-h],[x,y+2*d-h],[x-w,y+d-h]],top)+poly([[x-w,y+d-h],[x,y+2*d-h],[x,y+2*d],[x-w,y+d]],left)+poly([[x,y+2*d-h],[x+w,y+d-h],[x+w,y+d],[x,y+2*d]],right);
}
function tree(x,y,s=1) { return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="4" rx="20" ry="8" fill="#486644" opacity=".14"/><path d="M-3-15h7v19h-7Z" fill="#8f7755"/><path d="m0-69 23 39H12L28-8 0 4-27-9l16-22h-11Z" fill="#3e755a"/><path d="m0-69 0 73-27-13 16-22h-11Z" fill="#578b61"/><path d="m0-69 0 24-15 5Z" fill="#70a06e"/></g>`; }
function rock(x,y,s=1) {return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="4" rx="18" ry="7" fill="#486644" opacity=".13"/><path d="m-18-2 8-19 16-3 14 15-3 12-20 6Z" fill="#9aab92"/><path d="m-18-2 16-5 8-17-16 3Z" fill="#bbc4aa"/><path d="m-2-7 19 10-20 6Z" fill="#7e9581"/></g>`;}
function miner(x,y,rotate=false) { return `<g transform="translate(${x} ${y}) ${rotate?'scale(-1 1)':''}"><ellipse cy="4" rx="9" ry="4" fill="#4c624b" opacity=".2"/><path d="m-4-4-1 8m9-8 2 8" stroke="#435b56" stroke-width="4"/><path d="M-6-18h12v16H-6Z" fill="#819ba2"/><path d="m-5-14-5 9m15-9 5 7" stroke="#f0bd91" stroke-width="4"/><circle cy="-24" r="7" fill="#edb887"/><path d="M-9-25c0-12 17-12 17 0Z" fill="#e7b94c"/><path d="M-10-25h20" stroke="#f1cd6b" stroke-width="3"/></g>`; }
const label = (x,y,id,name,tag) => `<g class="scene-label" transform="translate(${x} ${y})" pointer-events="none"><rect x="-73" y="0" width="146" height="37" rx="12" fill="#fffcf1" stroke="#d8dfc7"/><circle cx="-55" cy="18" r="4" fill="${id==='energy'?'#d4ad40':id==='crystal'?'#60a9a3':'#c7804e'}"/><text x="-44" y="23" font-size="13" font-weight="600" fill="#3e5245">${name}</text><rect x="38" y="8" width="27" height="21" rx="7" fill="#edf1e4"/><text data-scene-pending="${id}" x="51" y="23" text-anchor="middle" font-size="12" font-weight="700" fill="#496348">${tag}</text></g>`;
export function scene() {
  let tiles='';
  const greens=['#a5bd82','#adc58a','#b2c990','#a4bc81','#acc387'];
  for(let y=0;y<8;y++)for(let x=0;x<9;x++){
    const pts=[point(x,y),point(x+1,y),point(x+1,y+1),point(x,y+1)];
    tiles+=poly(pts,greens[(x*3+y*7)%greens.length]);
    if((x*7+y*3)%5===0){const [px,py]=point(x+.5,y+.5);tiles+=`<path d="m${px-8} ${py+2} 0-5 4 3 1-6 4 4 3-3" stroke="#789c66" stroke-width="1.2" fill="none" opacity=".6"/>`;}
  }
  const a=point(0,8),b=point(9,8),c=point(9,0);
  const soil=poly([a,b,[b[0],b[1]+17],[a[0],a[1]+17]],'#82975b')+poly([b,c,[c[0],c[1]+17],[b[0],b[1]+17]],'#6c8653');
  const route = [[2,6],[3,5],[4,4],[6,4],[7,3]].map(p=>pt(point(...p))).join(' ');
  const road=`<polyline points="${route}" fill="none" stroke="#91a56e" stroke-width="27" stroke-linejoin="round"/><polyline points="${route}" fill="none" stroke="#ded2a6" stroke-width="22" stroke-linejoin="round"/><path d="M455 198 455 154M545 242 545 294" stroke="#ded2a6" stroke-width="22"/>`;
  const copper=`<g class="scene-building mine-building" data-mine="copper" role="button" tabindex="0" aria-label="收取赤铜矿场产出"><g transform="translate(455 149)"><ellipse cy="11" rx="68" ry="25" fill="#738459" opacity=".25"/><path d="m-64-5 17-50 31-25 37 9 37 43-3 34-40 19-43-5Z" fill="#89927c"/><path d="m-64-5 17-50 31-25 13 42-26 37Z" fill="#a6ad92"/><path d="m-16-80 37 9 37 43-34 6-27-16Z" fill="#bdc0a4"/><path d="m-35 1 3-39 22-15 25 9 9 40-27 15Z" fill="#344a40"/><path d="m-34 1 0-41 25-17 29 11 7 39" stroke="#b68c56" stroke-width="7" fill="none"/><path d="m-35-40 53-7M-29-8l48 15" stroke="#dec38a" stroke-width="3"/><path d="m-6 0-20 32m33-30 1 38" stroke="#63766a" stroke-width="3"/><path d="m-17 19 23 7m-29 0 31 10" stroke="#9a8864" stroke-width="3"/><g transform="translate(35 13)">${box(0,0,17,8,16,'#d8a267','#966b42','#b0824f')}<path d="m-11-7 7-13 12 3 5 11Z" fill="#d58b53"/><circle cx="-10" cy="15" r="5" fill="#506558"/><circle cx="10" cy="15" r="5" fill="#506558"/></g><path d="m-47-30 6-9 9 3-4 11Z" fill="#d5a16e"/><path d="m31-35 7-11 9 7-4 10Z" fill="#d5a16e"/></g></g>${label(447,198,'copper','赤铜矿场','6')}`;
  const solar=`<g class="scene-building mine-building" data-mine="energy" role="button" tabindex="0" aria-label="收取日光能源站产出"><g transform="translate(716 240)"><ellipse cy="10" rx="74" ry="26" fill="#738459" opacity=".25"/>${box(-28,-8,23,12,39,'#f2e8c9','#c9c5a4','#a7b7a0')}<path d="m-47-24 38 2-5-25-29-3Z" fill="#e6b84b"/><path d="m-32-18-8 12h7l-2 9 13-15h-8Z" fill="#f6d56e"/><path d="M8 5v-26m46 41v-25" stroke="#718776" stroke-width="5"/><path d="m-7-27 39-21 43 22-39 22Z" fill="#537d86" stroke="#deead7" stroke-width="3"/><path d="m5-33 43 22m-29-29 43 22m-16-25-39 21m52-14-39 21" stroke="#99b9b8" stroke-width="1.3"/><path d="M-29-51v-31" stroke="#788872" stroke-width="3"/><circle cx="-29" cy="-85" r="5" fill="#e2bc5a"/><path d="M-40-85h-6m11-10-4-4m10 2v-6m9 8 4-4m-2 14h6" stroke="#e4ca7a" stroke-width="2"/></g></g>${label(720,283,'energy','日光能源站','4')}`;
  const crystals=`<g class="scene-building mine-building" data-mine="crystal" role="button" tabindex="0" aria-label="收取青晶矿洞产出"><g transform="translate(301 258)"><ellipse cy="3" rx="66" ry="25" fill="#738459" opacity=".25"/><path d="m-64-5 7-24 30-15 40 1 35 20 16 24-30 20-66-6Z" fill="#8b9f8a"/><path d="m-57-29 30-15 40 1-21 27-30 12Z" fill="#bcc7aa"/><path d="m-27-9 0-46 14-23 14 24L-8 1Z" fill="#64b8b2"/><path d="m-27-55 14-23 5 79-19-10Z" fill="#a9d8c6"/><path d="m-13-78 14 24L-8 1Z" fill="#438c91"/><path d="m7 4 0-68 18-28 17 35L28 13Z" fill="#63aaa9"/><path d="m7-64 18-28 3 105L7 4Z" fill="#ace0ce"/><path d="m25-92 17 35-14 70Z" fill="#4e9498"/><path d="m-1 13 0-31 12-16 12 20-7 34Z" fill="#8acfc2"/><path d="m-1-18 12-16 5 54L-1 13Z" fill="#b9e6d0"/><path d="m43-4 3-31 12-13 8 18-12 35Z" fill="#91c6b6"/><path d="m46-35 12-13-4 53-11-9Z" fill="#c1e5cc"/><circle class="crystal-spark" cx="-32" cy="-66" r="3" fill="#f7f8d7"/><path d="M49-72v-12m-6 6h12" stroke="#faf4ce" stroke-width="2"/></g></g>${label(300,291,'crystal','青晶矿洞','1')}`;
  const forge=`<g class="scene-building" data-view-link="workshop" role="button" tabindex="0" aria-label="打开山谷工坊"><g transform="translate(533 285)"><ellipse cy="15" rx="70" ry="24" fill="#5b7652" opacity=".2"/>${box(0,-9,51,25,54,'#f6ddaa','#e6c38d','#c1a477')}<path d="m-60-38 55-51 65 36-54 27Z" fill="#bc7750"/><path d="m-60-38 55-51 2 31-52 31Z" fill="#df9565"/><path d="m-5-89 65 36-54 27-9-32Z" fill="#c88156"/><path d="m-37-53 48 25m-34-39 48 26m-32-37 49 27" stroke="#b16f4e" stroke-width="2" opacity=".6"/>${box(23,-48,11,5,40,'#b0aa8c','#8d8c73','#767d66')}<g class="smoke" opacity=".5"><ellipse cx="25" cy="-103" rx="9" ry="8" fill="#f8f3df"/><ellipse cx="32" cy="-119" rx="13" ry="10" fill="#f8f3df"/><ellipse cx="21" cy="-139" rx="16" ry="11" fill="#f8f3df"/></g><path d="m-37-19 18 8v29l-18-8Z" fill="#92764c"/><path d="m15-7 18-9v22l-18 9Z" fill="#688b89"/><path d="m24-11 0 22m-9-11 18-8" stroke="#f0d3a4" stroke-width="2"/><path d="m-48 19 49 24 49-24" fill="none" stroke="#dfc99b" stroke-width="7"/><path d="m-9-1 4 9 9-5-5-8Z" fill="#ecbd60"/></g></g><g transform="translate(533 346)" pointer-events="none"><rect x="-50" y="-2" width="100" height="28" rx="10" fill="#fffbef" stroke="#d8dfc7"/><text x="0" y="17" text-anchor="middle" font-size="12" font-weight="600" fill="#4c6150">山谷工坊 ↗</text></g>`;
  const decor=[tree(529,102,.9),tree(574,112,.66),tree(618,159,.85),tree(752,268,.7),tree(393,129,.8),tree(212,235,.8),tree(253,203,.6),tree(415,347,.75),tree(604,376,.8),tree(647,349,.6),rock(556,73,.75),rock(802,267,.75),rock(244,260,.6),rock(472,362,.6),miner(427,238),miner(611,265,true),miner(366,301),`<g transform="translate(619 313)">${box(0,0,18,9,20,'#dfbf82','#c09b60','#a78251')}<path d="m-18-8 36 0M0-17v35" stroke="#936e45" stroke-width="2"/></g>`].join('');
  return `<svg class="valley-svg" viewBox="90 5 850 458" role="img" aria-label="晨曦矿谷：点击赤铜矿场、日光能源站或青晶矿洞收取资源，点击工坊制造材料"><defs><filter id="map-shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="12"/></filter></defs><ellipse cx="521" cy="368" rx="300" ry="55" fill="#718a63" opacity=".12" filter="url(#map-shadow)"/><g>${soil}${tiles}${road}${decor.slice(0,0)}${tree(529,102,.9)}${tree(574,112,.66)}${tree(618,159,.85)}${tree(393,129,.8)}${rock(556,73,.75)}${tree(253,203,.6)}${copper}${solar}${crystals}${forge}${tree(212,235,.8)}${tree(752,268,.7)}${tree(415,347,.75)}${tree(604,376,.8)}${tree(647,349,.6)}${rock(802,267,.75)}${rock(244,260,.6)}${rock(472,362,.6)}${miner(427,238)}${miner(611,265,true)}${miner(366,301)}<g transform="translate(619 313)">${box(0,0,18,9,20,'#dfbf82','#c09b60','#a78251')}<path d="m-18-8 36 0M0-17v35" stroke="#936e45" stroke-width="2"/></g><g transform="translate(562 360)"><path d="M0 0v-42" stroke="#8f7952" stroke-width="3"/><path d="m0-42 23 6-23 8Z" fill="#e4a760"/></g></g></svg>`;
}

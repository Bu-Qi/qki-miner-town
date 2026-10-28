import { QKI, QkiWallet, discoverWallets, shortAddress, qkiAmount, exactQki, qkiChain, chainError, mapGameAction } from './chain.mjs';
import { icon } from './art.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createChainUI({ openDialog, closeDialog, toast, render, enter, leave, prefs, getState, isOnchain }) {
  let storage;try{storage=localStorage;}catch{}
  const wallet=new QkiWallet({storage});
  const wallets=discoverWallets();
  let prepared=null,preparing=false,watching=false,activeIdentity='',draftGeneration=0;
  const identity=()=>`${wallet.account}:${wallet.chainId}:${wallet.contract}`;
  const busy=()=>preparing||wallet.busy||!!wallet.pending;
  const link=()=>`<a class="text-link" href="${QKI.blockExplorerUrls[0]}" target="_blank" rel="noopener noreferrer">打开 QKI 区块浏览器${icon('arrow')}</a>`;
  function header() {
    const el=document.querySelector('#wallet-button');if(!el)return;
    el.innerHTML=icon('wallet')+(wallet.account?`${shortAddress(wallet.account)}<span class="wallet-balance">${qkiChain(wallet.chainId)?qkiAmount(wallet.balance)+' QKI':'切换 QKI'}</span>`:'连接 QKI 钱包');
    el.classList.toggle('connected',!!wallet.account&&qkiChain(wallet.chainId));
  }
  wallet.addEventListener('change',()=>{
    header();
    if(isOnchain()&&(identity()!==activeIdentity||!wallet.account||!qkiChain(wallet.chainId))){leave();toast('钱包或网络已变化，已返回试玩矿区。','help');}
    if(location.hash==='#chain'&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input'))render();
  });
  function modeBar() {
    return `<div class="mode-bar ${isOnchain()?'is-chain':''}"><span>${icon(isOnchain()?'shield':'leaf')}<strong>${isOnchain()?'QKI 链上矿区':'试玩矿区'}</strong><span>${isOnchain()?`${shortAddress(wallet.account)} · 交易确认后更新`:'浏览器存档 · 可免费体验'}</span></span><button class="text-link" data-chain="${isOnchain()?'leave':'open'}">${isOnchain()?'返回试玩':'进入链上矿区'}${icon('arrow')}</button></div>`;
  }
  function pendingPanel() {
    if(!wallet.pending)return '';
    return `<div class="chain-pending"><div class="card-heading"><strong>${icon('clock')}交易已提交，等待确认</strong><button class="text-link" data-chain="check">刷新状态</button></div><p>${esc(wallet.pending.label)}</p><code class="hash-text">${esc(wallet.pending.hash)}</code><div class="pending-links">${link()}<button class="text-link" data-chain="copy-hash">复制哈希</button></div></div>`;
  }
  function view() {
    const connected=!!wallet.account,correct=connected&&qkiChain(wallet.chainId);
    return `<section class="chain-hero"><div><span class="section-kicker">YOUR VALLEY. ON QKI.</span><h2>把小镇，带到链上。</h2><p>钱包拥有矿区，合约执行规则。采集、合成、升级和订单，每一步都留下链上记录。</p></div><div class="chain-emblem">${icon('shield')}<span>QKI</span></div></section>${pendingPanel()}<section class="card chain-card"><div class="chain-step-heading"><span class="chain-step-number">01</span><div><h3>连接你的钱包</h3><p>支持 MetaMask、TokenPocket 等 EVM 钱包。</p></div><span class="chain-step-state ${correct?'ok':''}">${correct?'已连接 QKI':connected?'等待切换网络':'尚未连接'}</span></div>${connected?`<div class="wallet-account"><div><span>当前地址</span><code>${esc(wallet.account)}</code></div><div class="balance-big">${correct?qkiAmount(wallet.balance):'—'}<small>QKI</small></div></div><div class="chain-actions">${!correct?'<button class="btn btn-primary" data-chain="switch">切换 / 添加 QKI 主网</button>':'<button class="btn btn-outline" data-chain="refresh">刷新余额</button>'}<button class="btn btn-outline" data-chain="disconnect">断开站点连接</button></div>`:`<div class="wallet-options">${wallets.size?[...wallets.values()].map(w=>`<button class="wallet-option" data-chain="connect" data-wallet="${esc(w.key)}"><span>${icon('wallet')}${esc(w.name)}</span>${icon('arrow')}</button>`).join(''):'<div class="no-wallet">'+icon('wallet')+'<strong>当前浏览器没有检测到钱包</strong><p>请在已安装 EVM 钱包的浏览器中打开，或将本页链接粘贴到钱包内置浏览器。</p><button class="btn btn-outline btn-small" data-chain="detect">重新检测钱包</button></div>'}</div>`}</section><section class="card chain-card"><div class="chain-step-heading"><span class="chain-step-number">02</span><div><h3>接入游戏合约</h3><p>已有合约可以直接连接，也可以部署一份新的矿谷。</p></div><span class="chain-step-state ${wallet.verified?'ok':''}">${wallet.verified?'代码已核验':'等待接入'}</span></div><label class="field-label" for="game-contract">QKI 游戏合约地址</label><div class="contract-input-row"><input id="game-contract" class="chain-input" value="${esc(wallet.contract)}" placeholder="0x…" spellcheck="false" autocomplete="off"><button class="btn btn-primary" data-chain="attach" ${correct?'':'disabled'}>连接合约</button></div><div class="deploy-row"><span>还没有游戏合约？部署会产生一次 QKI Gas。</span><button class="text-link" data-chain="deploy" ${correct&&!busy()?'':'disabled'}>${icon('plus')}部署新合约</button></div><div class="chain-code-links"><a class="text-link" href="/contracts/QKIMinerTown.sol" target="_blank" rel="noopener">查看合约源码${icon('arrow')}</a><span>V1 · 无充值功能 · 无管理员</span></div></section><section class="card chain-card"><div class="chain-step-heading"><span class="chain-step-number">03</span><div><h3>进入你的链上矿区</h3><p>已有链上进度会自动读取，新地址需要创建矿区。</p></div></div><div class="chain-actions"><button class="btn btn-primary" data-chain="enter" ${correct&&wallet.verified&&!busy()?'':'disabled'}>${icon('map')}读取 / 创建链上矿区</button><button class="btn btn-outline" data-chain="leave">继续免费试玩</button></div><div class="info-box">试玩矿区和链上矿区分别保存。链上初始资源由合约发放，试玩积分不会导入。游戏操作不收额外 QKI，交易需要支付网络 Gas。</div></section>`;
  }
  function side() {
    return `<section class="card chain-card"><span class="section-kicker">QKI NETWORK</span><div class="card-heading"><h2>网络信息</h2><span class="count-label">主网</span></div><dl class="network-facts"><div><dt>Chain ID</dt><dd>20181205</dd></div><div><dt>原生币</dt><dd>QKI</dd></div><div><dt>节点区块</dt><dd>${wallet.block?wallet.block.toLocaleString('en-US'):'点击刷新读取'}</dd></div><div><dt>节点 Gas 单价</dt><dd>${wallet.networkGas?esc(wallet.networkGas)+' gwei':'—'}</dd></div></dl><button class="btn btn-outline btn-small btn-full" data-chain="network">刷新节点状态${icon('reset')}</button></section><section class="card chain-card"><h2>交易 Gas</h2><p class="chain-copy">默认跟随钱包节点报价；也可以指定单价。</p><label class="field-label" for="gas-gwei">自定义 Gas 单价 / gwei</label><div class="contract-input-row"><input id="gas-gwei" class="chain-input" inputmode="decimal" value="${esc(wallet.gasGwei)}" placeholder="自动，可填 500 / 1000"><button class="btn btn-outline btn-small" data-chain="gas">保存</button></div><p class="chain-fine-print">发送前会展示 Gas 估算和费用上限，最终以钱包确认及交易回执为准。</p></section><section class="card chain-card"><h2>链上记录什么？</h2><ul class="chain-feature-list"><li>${icon('check')}材料与制造成品</li><li>${icon('check')}矿机分配与矿场等级</li><li>${icon('check')}订单积分与成长进度</li></ul><p class="chain-fine-print">当前合约中的资源是游戏数值，没有 QKI 兑换、提现或 NFT 转出功能。</p>${link()}</section>`;
  }
  function cancelDraft(){prepared=null;draftGeneration++;}
  async function request(name,args,label) {
    if(preparing||wallet.busy||wallet.pending)throw new Error('有一笔交易正在处理中，请先等待确认。');
    preparing=true;prepared=null;const job=++draftGeneration;
    openDialog('准备链上操作',`<div class="tx-preparing">${icon('clock')}<strong>正在模拟执行并估算 Gas…</strong><p>请稍等，准备完成后再由你确认。</p></div>`);
    try {
      const draft=await wallet.prepare(name,args,label);
      if(!document.querySelector('#game-dialog[open]')||job!==draftGeneration)return;
      prepared=draft;
      openDialog(name==='deploy'?'部署游戏合约':'确认链上操作',`<p>${esc(label)}。请核对网络、地址和预计费用。</p><dl class="tx-summary"><div><dt>网络</dt><dd>QKI 主网 · 20181205</dd></div><div><dt>操作</dt><dd>${esc(label)}</dd></div><div><dt>发起地址</dt><dd>${esc(shortAddress(draft.from))}</dd></div><div><dt>合约</dt><dd>${name==='deploy'?'部署新合约':esc(shortAddress(draft.tx.to))}</dd></div><div><dt>转入合约金额</dt><dd>0 QKI</dd></div><div><dt>Gas 上限（含余量）</dt><dd>${draft.gas.toLocaleString('en-US')}</dd></div><div><dt>Gas 单价</dt><dd>${Number(draft.price)/1e9} gwei</dd></div><div class="tx-total"><dt>网络费用上限</dt><dd>${exactQki(draft.maxFee)} QKI</dd></div></dl><p class="chain-fine-print">未使用的 Gas 不会收取。只有你在钱包确认后才会提交交易。</p>${draft.sufficient?'':'<div class="info-box tx-warning">当前 QKI 余额不足以支付此费用上限。</div>'}<button class="btn btn-primary btn-full" data-chain="confirm" ${draft.sufficient?'':'disabled'}>${icon('wallet')}在钱包中确认</button><button class="btn btn-outline btn-full" data-chain="cancel">取消</button>`);
    } catch(e){closeDialog();throw e;}finally{preparing=false;}
  }
  async function refreshPlayer(activate=false) {
    const s=await wallet.readPlayer(prefs());
    if(!s)return null;
    if(activate||isOnchain()){activeIdentity=identity();enter(s);}
    return s;
  }
  async function watch() {
    if(watching||!wallet.pending)return;watching=true;
    try {
      const result=await wallet.waitPending();
      if(result?.status==='confirmed'){
        toast(result.kind==='deploy'?'游戏合约已部署，地址已保存。':'QKI 交易已确认，正在读取矿区。','check');
        if(wallet.account&&qkiChain(wallet.chainId)){
          await wallet.refresh();
          if(result.kind==='deploy')render();
          else if(result.from===wallet.account)await refreshPlayer(true);
        }
      }else if(result?.status==='reverted')toast('交易执行失败，材料与进度未改变；网络仍会收取已使用的 Gas。','help');
      else if(result?.status==='pending')toast('交易仍待确认，可在链上页面刷新状态。','clock');
    }catch(e){toast(chainError(e),'help');}finally{watching=false;render();}
  }
  async function action(name,el) {
    try {
      if(name==='open'){location.hash='chain';render();return;}
      if(name==='connect'){
        const selected=wallets.get(el?.dataset.wallet);if(!selected)throw new Error('未检测到钱包，请重新检测。');
        await wallet.connect(selected.provider,selected.name);toast(qkiChain(wallet.chainId)?'QKI 钱包已连接。':'钱包已连接，请切换到 QKI 主网。','wallet');
        if(wallet.pending)watch();
      }else if(name==='detect'){discoverWallets();toast('已重新发起钱包发现，请稍候。','wallet');}
      else if(name==='switch'){await wallet.switchChain();toast('已切换到 QKI 主网。','check');}
      else if(name==='disconnect'){wallet.disconnect();leave();toast('已断开本站的钱包连接。','wallet');}
      else if(name==='refresh'){await wallet.refresh();toast('QKI 余额已刷新。','check');}
      else if(name==='network'){await wallet.networkStatus();toast('QKI 节点状态已更新。','check');}
      else if(name==='gas'){wallet.setGas(document.querySelector('#gas-gwei').value);toast(wallet.gasGwei?`Gas 单价已设为 ${wallet.gasGwei} gwei。`:'已恢复节点自动报价。','check');}
      else if(name==='attach'){await wallet.verifyContract(document.querySelector('#game-contract').value.trim());toast('游戏合约代码核验通过。','shield');}
      else if(name==='deploy'){await request('deploy',[],'部署 QKI 矿工小镇 V1');return;}
      else if(name==='enter'){
        const s=await refreshPlayer(true);
        if(!s){await request('register',[],'创建我的链上矿区');return;}
        toast('已读取这个地址的链上矿区。','shield');
      }else if(name==='leave'){leave();location.hash='home';render();return;}
      else if(name==='cancel'){cancelDraft();closeDialog();return;}
      else if(name==='confirm'){
        if(!prepared)throw new Error('交易准备已取消，请重新操作。');
        const draft=prepared;prepared=null;
        closeDialog();toast('请在钱包中核对并确认交易。','wallet');
        await wallet.send(draft);toast('交易已提交，确认前不会改变矿区进度。','clock');render();watch();return;
      }else if(name==='check'){
        if(watching){const result=await wallet.checkPending();if(result?.status==='confirmed'){await wallet.refresh();if(result.from===wallet.account&&result.kind!=='deploy')await refreshPlayer(true);toast('交易已确认。','check');}else if(result?.status==='reverted')toast('交易执行失败，请查看交易回执。','help');else toast('交易仍待确认。','clock');}
        else watch();
      }else if(name==='copy-hash'){await navigator.clipboard.writeText(wallet.pending?.hash||'');toast('交易哈希已复制。','check');}
      header();render();
    }catch(e){toast(chainError(e),'help');header();render();}
  }
  async function gameAction(name,id,qty) {
    try{const [method,args,label]=mapGameAction(name,id,qty,getState());await request(method,args,label);}catch(e){toast(chainError(e),'help');}
  }
  document.addEventListener('click',e=>{const el=e.target.closest('[data-chain]');if(el&&!el.disabled)action(el.dataset.chain,el);});
  window.addEventListener('qki:wallets',()=>{if(location.hash==='#chain'&&!document.querySelector('dialog[open]'))render();});
  header();
  return {wallet,view,side,modeBar,busy,gameAction,cancelDraft,header,refreshPlayer,checkPending:watch};
}

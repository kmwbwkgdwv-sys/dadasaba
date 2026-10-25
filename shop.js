/* =========================================================
 *  shop.js  ― ショップ（コインで装備・設計図・エッセンスを買う）
 *   ・6枠（3つ × 2列）。12時間ごと（0時・12時）に品物が入れ替わる
 *   ・1,000コインで今すぐ入れ替え（1日3回まで）
 *   ・確率と値段は config.js の SHOP
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { $, $$, esc, fmt, toast, modal } = U;
  const SH = C.SHOP;
  const AWNING = '<svg viewBox="0 0 120 70" aria-hidden="true"><g stroke="#231a3a" stroke-width="3" stroke-linejoin="round">'
    + '<rect x="12" y="30" width="96" height="36" rx="4" fill="#ffe7b0"/><rect x="40" y="40" width="40" height="26" fill="#8a5a33"/>'
    + '<path d="M6 30 L14 6 H106 L114 30 Z" fill="#ff5a6e"/>'
    + '<path d="M6 30 Q14 40 22 30 Q30 40 38 30 Q46 40 54 30 Q62 40 70 30 Q78 40 86 30 Q94 40 102 30 Q110 40 114 30" fill="#ff5a6e"/>'
    + '<path d="M30 6 L26 30 M50 6 L48 30 M70 6 L72 30 M90 6 L94 30" stroke="#fff" stroke-width="5"/></g>'
    + '<path d="M30 6 L26 30 M50 6 L48 30 M70 6 L72 30 M90 6 L94 30" stroke="#231a3a" stroke-width="1" opacity=".25"/></svg>';

  const hms = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  function itemName(it) {
    if (it.kind === 'bp') return `ランダム設計図 ×${it.n}`;
    if (it.kind === 'essence') return `エッセンス ×${fmt(it.n)}`;
    return C.ITEMS[it.item].name;
  }
  // 素材の使い道（ショップの枠・購入画面・確率表に出す）
  const USE = {
    essence: 'キャラの強化に使う',
    bp: '装備の強化に使う',
  };
  const USE_LONG = {
    essence: 'キャラのレベルアップに使います。装備画面でキャラをタップ →「スキル・強さ」から強化できます',
    bp: '装備のレベルアップに使います。武器・防具・ベルト・靴のどれかの設計図がランダムでもらえます',
  };
  function art(it) {
    if (it.kind === 'bp') return `<div class="icard r-none shop-misc bp">${A.blueprint('random')}<span class="icard-count">×${it.n}</span></div>`;
    if (it.kind === 'essence') return `<div class="icard r-none shop-misc ess">${A.essence()}<span class="icard-count">×${fmt(it.n)}</span></div>`;
    return U.itemCard(it.item, it.rarity);
  }

  function render() {
    const el = $('#screen-shop');
    el.innerHTML = `
      <div class="screen-bg shop-bg"></div>
      <div class="screen-scroll">
        <div class="shop-head">
          <span class="shop-awning">${AWNING}</span>
          <div><b class="shop-title outline">ショップ</b><small>次の入れ替えまで <span id="shop-left">--:--:--</span></small></div>
        </div>
        <div class="shop-grid" id="shop-grid"></div>
        <button class="btn btn-yellow shop-refresh" id="shop-refresh"></button>
        <p class="note shop-note">品物は12時間ごと（0時と12時）に入れ替わります。どの枠も1回だけ買えます。<br>
          装備の種類（武器・防具・ベルト・靴）はランダムで、コモン〜エピックが並びます。ごくまれに（0.1%）S装備も並びます。<br>
          ${A.essence()}<b>エッセンス</b>はキャラの強化、${A.blueprint('random')}<b>設計図</b>は装備の強化に使います。</p>
        <button class="link-btn" id="shop-rates">並ぶ確率と値段</button>
      </div>`;
    $('#shop-refresh', el).addEventListener('click', doRefresh);
    $('#shop-rates', el).addEventListener('click', showRates);
    draw();
    setInterval(tick, 1000);
  }

  let lastPeriod = '';
  function draw() {
    const grid = $('#shop-grid');
    if (!grid) return;
    const info = S.shopInfo();
    lastPeriod = S.data.shop.period;
    grid.innerHTML = info.items.map((it, i) => `
      <div class="shop-cell ${it.sold ? 'sold' : ''} ${it.kind === 'item' ? 'rr-' + it.rarity : ''} ${it.s ? 'rr-s' : ''}">
        ${art(it)}
        <b class="shop-name">${esc(itemName(it))}</b>
        ${it.kind === 'item' ? U.rarityLabel(it.rarity) + (it.s ? '<span class="rlabel rl-s">S</span>' : '') : `<span class="rlabel rl-misc">素材</span><small class="shop-use">${USE[it.kind]}</small>`}
        <button class="btn btn-small ${it.sold ? 'btn-gray' : S.data.coins >= it.price ? 'btn-green' : 'btn-gray short'} shop-buy" data-i="${i}" ${it.sold ? 'disabled' : ''}>
          ${it.sold ? '売り切れ' : `${A.coin()}${fmt(it.price)}`}</button>
        ${it.sold ? '<span class="sold-stamp">SOLD OUT</span>' : ''}
      </div>`).join('');
    $$('.shop-buy', grid).forEach((b) => b.addEventListener('click', () => confirmBuy(+b.dataset.i)));
    const rb = $('#shop-refresh');
    rb.innerHTML = `品物を入れ替える <span class="gb-cost">${A.coin()}${fmt(SH.refreshCost)}</span><small>今日あと${info.refreshLeft}回</small>`;
    rb.disabled = info.refreshLeft <= 0;
    rb.classList.toggle('short', S.data.coins < SH.refreshCost);
    tick();
  }
  function tick() {
    const el = $('#shop-left');
    if (!el) return;
    const per = S.shopPeriod(Date.now());
    if (S.data.shop && per.key !== lastPeriod) { draw(); return; }
    el.textContent = hms(per.ends - Date.now());
  }
  function update() { draw(); }

  function confirmBuy(i) {
    const it = S.shopInfo().items[i];
    if (!it || it.sold) return;
    if (S.data.coins < it.price) { toast(`コインが足りません（あと ${fmt(it.price - S.data.coins)}）`, 'error'); return; }
    modal({
      title: '購入',
      body: `<div class="buy-box">${art(it)}<b>${esc(itemName(it))}</b>${it.kind === 'item' ? U.rarityLabel(it.rarity) + (it.s ? '<span class="rlabel rl-s">S</span>' : '') : `<small class="buy-use">${USE_LONG[it.kind]}</small>`}
        <p class="center">${A.coin()}<b>${fmt(it.price)}</b> コインで買いますか？</p></div>`,
      buttons: [{ label: 'やめる', cls: 'btn-gray' }, { label: '買う', cls: 'btn-green', onClick: () => buy(i) }],
    });
  }
  function buy(i) {
    const it = S.shopInfo().items[i];
    const r = S.buyShop(i);
    if (!r) { toast('買えませんでした', 'error'); return; }
    if (DS.sound) DS.sound.play('equip');
    if (it.kind === 'item') toast(`${C.ITEMS[it.item].name}（${S.RARITY[it.rarity].name}${it.s ? 'S' : ''}）を買いました。装備画面で装備できます`, 'good', 3000);
    else if (it.kind === 'bp') toast(`ランダム設計図：${C.SLOTS.filter((s) => r.bp[s.key]).map((s) => `${s.name}×${r.bp[s.key]}`).join('・')}`, 'good', 3000);
    else toast(`エッセンス +${fmt(r.essence)}`, 'good');
    draw();
  }
  function doRefresh() {
    const info = S.shopInfo();
    if (info.refreshLeft <= 0) { toast('今日はもう入れ替えられません', 'error'); return; }
    if (S.data.coins < SH.refreshCost) { toast(`コインが足りません（あと ${fmt(SH.refreshCost - S.data.coins)}）`, 'error'); return; }
    modal({
      title: '品物の入れ替え',
      body: `<p class="center">${A.coin()}<b>${fmt(SH.refreshCost)}</b> コインで品物を全部入れ替えますか？<br><small>（今日あと${info.refreshLeft}回）</small></p>`,
      buttons: [{ label: 'やめる', cls: 'btn-gray' }, { label: '入れ替える', cls: 'btn-yellow', onClick: () => { if (S.refreshShop()) { if (DS.sound) DS.sound.play('gachaOpen'); draw(); } } }],
    });
  }
  function showRates() {
    const names = { common: 'コモン装備', uncommon: 'アンコモン装備', rare: 'レア装備', epic: 'エピック装備', s: 'S装備（エピック）', bp: `ランダム設計図 ×${SH.bpAmount}<small class="rate-use">装備の強化に使う</small>`, essence: `エッセンス ×${SH.essenceAmount}<small class="rate-use">キャラの強化に使う</small>` };
    modal({
      title: 'ショップの品物', cls: 'modal-wide',
      body: `<table class="rate-table shop-rate-table"><thead><tr><th>品物</th><th>並ぶ確率</th><th>値段</th></tr></thead>
        <tbody>${Object.keys(SH.rates).map((k) => `<tr><td>${S.RARITY[k] || k === 's' ? U.rarityLabel(k) : `<b>${names[k]}</b>`}</td><td><b>${SH.rates[k]}%</b></td><td>${A.coin()}${fmt(SH.prices[k])}</td></tr>`).join('')}</tbody></table>
        <p class="note dark">エッセンス：キャラのレベルアップに使います（装備画面でキャラをタップ →「スキル・強さ」）。<br>
          設計図：装備のレベルアップに使います。</p>
        <p class="note dark">1枠ごとに上の確率で品物が決まります。装備の種類はランダムです（S装備は${S.S_ITEMS.length}種類の中から）。入れ替えは ${fmt(SH.refreshCost)} コインで1日${SH.refreshPerDay}回まで。</p>`,
      buttons: [{ label: 'とじる', cls: 'btn-blue' }],
    });
  }

  DS.shop = { render, update };
})();

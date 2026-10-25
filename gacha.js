/* =========================================================
 *  gacha.js  ― 装備ガチャ / キャラガチャ
 *   1回 3,000 コイン / 10回 30,000 コイン
 *   確率は config.js の GACHA_RATES
 *     装備: コモン60% アンコモン23% レア10% エピック5% S装備2%（レジェンドは合成でだけ作れる）
 *           S装備（ライトセイバーなど4種）はエピックから。同じレアリティの普通の装備より1.3倍強い
 *     キャラ: コモン65% アンコモン20% レア12% エピック2.5% レジェンド0.45% レジェンド+0.05%
 *   レアリティを抽選したあと、その中から等確率で1つ選びます。
 *   キャラガチャはステージ2をクリアすると解放されます。
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { $, $$, esc, fmt, fmtBig, toast, modal } = U;
  const RATES = C.GACHA_RATES;
  const ITEM_KEYS = Object.keys(C.ITEMS);
  const CHAR_KEYS = Object.keys(C.CHARACTERS);
  const rarName = (k) => (k === 's' ? 'S装備' : C.RARITIES.find((r) => r.key === k).name);
  const S_KEYS = S.S_ITEMS, NORMAL_KEYS = S.NORMAL_ITEMS;
  const pctTxt = (v) => String(+v.toFixed(4)) + '%';
  // ガチャ画面での並び順（上から 武器 → 防具 → ベルト → 靴）
  const ORDERED_ITEMS = C.GACHA_ORDER.flatMap((slot) => NORMAL_KEYS.filter((k) => C.ITEMS[k].slot === slot));
  const ORDERED_S = C.GACHA_ORDER.flatMap((slot) => S_KEYS.filter((k) => C.ITEMS[k].slot === slot));
  const sfx = (n) => { if (DS.sound) DS.sound.play(n); };
  let mode = 'item';
  const TICKET = '<svg viewBox="0 0 32 22" aria-hidden="true"><path d="M2 3 H30 V8 a3 3 0 0 0 0 6 V19 H2 V14 a3 3 0 0 0 0 -6 Z" fill="#ff7ad9" stroke="#231a3a" stroke-width="2" stroke-linejoin="round"/><path d="M11 4 V18" stroke="#231a3a" stroke-width="1.6" stroke-dasharray="2 2"/><path d="M19 7 l1.5 3 3.2.4 -2.4 2.2 .7 3.2 -3 -1.7 -3 1.7 .7 -3.2 -2.4 -2.2 3.2 -.4 Z" fill="#fff6c2"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="12" rx="3" fill="#ffd23d" stroke="#231a3a" stroke-width="2.2"/><path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none" stroke="#231a3a" stroke-width="2.6"/><circle cx="12" cy="15.5" r="2" fill="#231a3a"/></svg>';

  // 0以上1未満の乱数（使えれば crypto を使う）
  function rand() {
    if (window.crypto && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    return Math.random();
  }
  /**
   * レアリティを抽選する。kind: 'item' | 'char'
   * limited = true のときは、エピック以上の分がレアになる（装備ガチャ・ステージ1クリア前）
   */
  function rollRarity(limited, kind = 'item') {
    const rates = RATES[kind];
    const keys = Object.keys(rates), total = keys.reduce((a, k) => a + rates[k], 0);
    let r = rand() * total, out = keys[0];
    for (const k of keys) { if (r < rates[k]) { out = k; break; } r -= rates[k]; }
    if (limited && !C.EARLY_RARITIES.includes(out)) out = C.EARLY_RARITIES[C.EARLY_RARITIES.length - 1];
    return out;
  }
  /** 今のガチャの確率表（limited のときはレアに合算） */
  function rateTable(limited, kind = 'item') {
    const rates = RATES[kind];
    const rows = Object.keys(rates).map((k) => ({ key: k, name: rarName(k), w: rates[k], open: true }));
    if (limited) {
      const top = rows.find((r) => r.key === C.EARLY_RARITIES[C.EARLY_RARITIES.length - 1]);
      rows.forEach((r) => { if (!C.EARLY_RARITIES.includes(r.key)) { top.w += r.w; r.w = 0; r.open = false; } });
    }
    const total = rows.reduce((a, r) => a + r.w, 0);
    rows.forEach((r) => { r.pct = +(r.w / total * 100).toFixed(4); r.label = r.open ? r.pct + '%' : '—'; });
    return rows;
  }
  const limitedNow = () => !S.fullRarity();
  const rollItem = () => NORMAL_KEYS[Math.floor(rand() * NORMAL_KEYS.length)];
  const rollSItem = () => S_KEYS[Math.floor(rand() * S_KEYS.length)];
  function rollChar(rarity) {
    const pool = CHAR_KEYS.filter((k) => C.CHARACTERS[k].rarity === rarity);
    return pool[Math.floor(rand() * pool.length)];
  }
  const costOf = (n) => (n === 1 ? C.GACHA.singleCost : C.GACHA.multiCost);

  /** 装備ガチャを n 回引く。ticket=true ならチケットを使う。引けなければ null */
  function pull(n, ticket) {
    if (ticket ? !S.useTicket('item10') : !S.spendCoins(costOf(n))) return null;
    const limited = limitedNow();
    const results = [];
    for (let i = 0; i < n; i++) {
      const r = rollRarity(limited);
      // 's' は S装備（エピック）
      const item = r === 's' ? rollSItem() : rollItem(), rarity = r === 's' ? C.S_GEAR.minRarity : r;
      results.push({ kind: 'item', item, rarity, s: r === 's', isNew: S.addItem(item, rarity) });
    }
    S.data.totalPulls += n;
    S.data.stats.itemPulls += n;
    S.persist();
    return results;
  }
  /** キャラガチャを n 回引く */
  function pullChar(n, ticket) {
    if (!S.charGachaUnlocked()) return null;
    if (ticket ? !S.useTicket('char10') : !S.spendCoins(costOf(n))) return null;
    const results = [];
    for (let i = 0; i < n; i++) {
      const rarity = rollRarity(false, 'char'), key = rollChar(rarity);
      results.push({ kind: 'char', key, rarity, isNew: S.addChar(key) });
    }
    S.data.stats.charPulls += n;
    S.persist();
    return results;
  }

  /* ---------- 画面 ---------- */
  function render() {
    const el = $('#screen-gacha');
    el.innerHTML = `
      <div class="screen-bg gacha-bg"></div>
      <div class="screen-scroll">
        <div class="seg gacha-seg" role="tablist">
          <button class="seg-btn" data-mode="item" role="tab">装備ガチャ</button>
          <button class="seg-btn" data-mode="char" role="tab">キャラガチャ<i class="lock-ic" id="char-lock-ic">${LOCK}</i></button>
        </div>
        <div id="gacha-panel"></div>
      </div>`;
    $$('.gacha-seg .seg-btn', el).forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; drawPanel(); }));
    drawPanel();
  }

  function drawPanel() {
    const panel = $('#gacha-panel');
    if (!panel) return;
    $$('.gacha-seg .seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    const isChar = mode === 'char';
    const locked = isChar && !S.charGachaUnlocked();
    const limited = !isChar && limitedNow();
    // 最初の画面は目玉だけを見せる（ほかは「提供割合」から見られる）
    //  ・装備ガチャ：S装備だけ
    //  ・キャラガチャ：エピック以上だけ（レジェンド+ がいちばん目立つ）
    const lineup = isChar
      ? charFeature()
      : `<div class="s-feature">
          <div class="s-feature-head"><b class="s-feature-s">S</b><span><b>S装備</b>　出る確率 ${limited ? '—' : RATES.item.s + '%'}</span></div>
          <div class="s-feature-items">${ORDERED_S.map((k) => `<span class="s-feature-cell">${U.itemCard(k, C.S_GEAR.minRarity, { cls: 'mini' })}<small>${esc(C.ITEMS[k].name)}</small></span>`).join('')}</div>
          <small class="s-feature-note">${limited ? 'S装備はステージ1をクリアすると出るようになります' : `同じレアリティの装備より ${C.S_GEAR.mult}倍強い！ ほかの装備は「提供割合」で見られます`}</small>
        </div>`;
    const tKey = isChar ? 'char10' : 'item10';
    const tickets = S.data.tickets[tKey] || 0;
    const rates = rateTable(limited, isChar ? 'char' : 'item');
    panel.innerHTML = `
      <div class="gacha-banner ${isChar ? 'char' : ''} ${locked ? 'locked' : ''}">
        <div class="gacha-head">
          <span class="gacha-title outline">${isChar ? 'キャラガチャ' : '装備ガチャ'}</span>
          <span class="gacha-sub">${isChar ? 'レア以上は特殊スキル付き！レアリティが高いほど強い' : '武器・防具・ベルト・靴が当たる！'}</span>
        </div>
        ${isChar ? '' : `<div class="gacha-chest">${A.chest()}</div>`}
        ${lineup}
        ${locked ? `<div class="gacha-lock"><span class="lock-big">${LOCK}</span><b>ステージ${C.CHAR_TICKET_STAGE + 1}「${esc(C.STAGES[C.CHAR_TICKET_STAGE].name)}」をクリアすると解放</b><small>クリアするとキャラガチャ10連無料チケットがもらえます。<br>キャラの見た目は「装備」画面からいつでも変えられます。</small></div>` : ''}
      </div>
      <div class="rate-strip">
        ${rates.map((r) => `<span class="rate rt-${r.key} ${r.open ? '' : 'off'}"><b>${r.name}</b>${r.label}</span>`).join('')}
      </div>
      ${limited ? `<p class="rate-note">ステージ1をクリアするまでは、コモン・アンコモン・レアだけが出ます</p>` : ''}
      ${!isChar ? '<p class="rate-note">レジェンドは合成でだけ作れます（エピック❸を3つ）</p>' : ''}
      <button class="link-btn" id="btn-rates">提供割合・${isChar ? 'キャラ' : '全部の装備'}の詳細</button>
      <div class="gacha-buttons">
        <button class="btn btn-blue gacha-btn" data-n="1" ${locked ? 'disabled' : ''}>
          <span class="gb-label">1回引く</span><span class="gb-cost">${A.coin()}${fmt(C.GACHA.singleCost)}</span></button>
        ${tickets > 0 && !locked
          ? `<button class="btn btn-pink gacha-btn ticket" data-n="${C.GACHA.multiCount}" data-ticket="1">
              <span class="gb-label">${C.GACHA.multiCount}回引く</span><span class="gb-cost"><i class="tk">${TICKET}</i>無料チケット ×${tickets}</span></button>`
          : `<button class="btn btn-yellow gacha-btn" data-n="${C.GACHA.multiCount}" ${locked ? 'disabled' : ''}>
              <span class="gb-label">${C.GACHA.multiCount}回引く</span><span class="gb-cost">${A.coin()}${fmt(C.GACHA.multiCost)}</span></button>`}
      </div>`;
    $$('.gacha-btn', panel).forEach((b) => b.addEventListener('click', () => run(+b.dataset.n, !!b.dataset.ticket)));
    $('#btn-rates', panel).addEventListener('click', isChar ? showCharRates : showRates);
    update();
  }

  /** キャラガチャの目玉：レジェンド+ を大きく、その下にレジェンド・エピック */
  function charFeature() {
    const R = C.GACHA_RATES.char;
    const of = (r) => CHAR_KEYS.filter((k) => C.CHARACTERS[k].rarity === r);
    const rname = (r) => S.RARITY[r].name;
    const cell = (k) => `<span class="cf-cell">${U.charCard(k, { cls: 'mini' })}<small>${esc(C.CHARACTERS[k].name)}</small></span>`;
    const tier = (r) => of(r).length ? `<div class="cf-tier cf-${r}"><div class="cf-tier-head">${U.rarityLabel(r)}<b>${R[r]}%</b></div>
        <div class="cf-tier-cells">${of(r).map(cell).join('')}</div></div>` : '';
    const lp = of('legendPlus');
    return `<div class="char-feature">
      ${lp.length ? `<div class="cf-lp">
        <span class="cf-rays"></span>
        <div class="cf-lp-head"><b class="cf-lp-title">${rname('legendPlus')}</b><span class="cf-lp-rate">出る確率 <b>${R.legendPlus}%</b></span></div>
        <div class="cf-lp-chars">${lp.map((k) => {
          const d = C.CHARACTERS[k];
          return `<div class="cf-lp-one">
            ${U.charCard(k, { cls: 'cf-big' })}
            <div class="cf-lp-info">
              <b class="cf-lp-name outline">${esc(d.name)}</b>
              <span class="cf-chip">ATK・HP ×${C.CHAR_MULT.legendPlus}</span>
              ${d.skill ? `<span class="cf-chip skill">スキル「${esc(d.skill.name)}」</span>` : ''}
              <small>いちばん強い最高レアのキャラ！</small>
            </div></div>`;
        }).join('')}</div>
      </div>` : ''}
      <div class="cf-tiers">${tier('legend')}${tier('epic')}</div>
      <small class="cf-note">コモン〜レアのキャラは「提供割合」で見られます</small>
    </div>`;
  }

  let lastKey = '';
  function update() {
    const coins = S.data.coins;
    $$('#screen-gacha .gacha-btn').forEach((b) => b.classList.toggle('short', !b.dataset.ticket && coins < costOf(+b.dataset.n)));
    const ic = $('#char-lock-ic');
    if (ic) ic.classList.toggle('hidden', S.charGachaUnlocked());
    // チケット・解放の状態が変わったら描き直す
    const key = [S.charGachaUnlocked(), S.fullRarity(), S.data.tickets.item10, S.data.tickets.char10].join();
    if (key !== lastKey) { lastKey = key; drawPanel(); }
  }
  function setMode(m) { mode = m; drawPanel(); }

  const perOne = (pct, n) => (n ? (pct / n).toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + '%' : '—');
  const statTxt = (k, m = 1) => { const r = C.RARITIES.find((x) => x.key === k); return `<span class="c-atk">ATK+${fmtBig(Math.round(r.atk * m))}</span><br><span class="c-hp">HP+${fmtBig(Math.round(r.hp * m))}</span>`; };

  function showRates() {
    modal({
      title: '提供割合',
      cls: 'modal-wide',
      body: `
        <table class="rate-table">
          <thead><tr><th>レアリティ</th><th>確率</th><th>上昇値</th><th>追加効果</th></tr></thead>
          <tbody>${rateTable(limitedNow()).map((r) => r.key === 's'
            // S装備はエピックのすぐ下
            ? `<tr class="s-rowt"><td>${U.rarityLabel('s')}<small class="per1">エピックのS</small></td><td><b>${r.label}</b><small class="per1">1種 ${r.open ? perOne(r.pct, S_KEYS.length) : '—'}</small></td><td class="st-cell">${statTxt('epic', C.S_GEAR.mult)}</td><td class="rfx-cell">エピックと同じ<br>（Sが付くと${C.S_GEAR.mult}倍強い）</td></tr>`
            : `<tr><td>${U.rarityLabel(r.key)}</td><td><b>${r.label}</b><small class="per1">1種 ${r.open ? perOne(r.pct, NORMAL_KEYS.length) : '—'}</small></td><td class="st-cell">${statTxt(r.key)}</td><td class="rfx-cell">${(C.RARITY_EFFECTS[r.key] || {}).text || 'なし'}</td></tr>`).join('')}
            ${['legend', 'legendPlus'].map((k) => `<tr class="lp-row"><td>${U.rarityLabel(k)}</td><td><b>—</b><small class="per1">合成のみ</small></td><td class="st-cell">${statTxt(k)}</td><td class="rfx-cell">${(C.RARITY_EFFECTS[k] || {}).text}</td></tr>`).join('')}</tbody>
        </table>
        <div class="s-explain">
          <b class="s-big">S</b>
          <div><b>Sが付くと${C.S_GEAR.mult}倍強くなります</b>
            <small>エピックとエピックのSでは、エピックのSが${C.S_GEAR.mult}倍強い<br>レジェンドとレジェンドのSでは、レジェンドのSが${C.S_GEAR.mult}倍強い</small>
            <small class="s-list">S装備：${S_KEYS.map((k) => esc(C.ITEMS[k].name)).join('・')}（エピックから。合成でレジェンド・レジェンド+にしても S のまま）</small></div>
        </div>
        <p class="note dark">追加効果の%はキャラの総合力（ATK・HP）に対する値で、下のレアリティの効果もすべて得られます（例：レジェンドは 攻撃+15%・体力+15%・パッシブ）。パッシブはエピック以上の装備で発動します。</p>
        ${limitedNow() ? `<p class="note dark">ステージ1をクリアするまでは、エピックとS装備の分がレアになります。クリア後は ${rateTable(false).map((r) => r.name + r.label).join('・')} です。</p>` : ''}
        <p class="note dark">武器・ベルトは <b class="c-atk">ATK</b>、防具・靴は <b class="c-hp">HP</b> が上昇値ぶん上がります。見た目と名前はレアリティ共通で、背景の色だけが変わります。各レアリティの中で ${NORMAL_KEYS.length} 種類の装備が同じ確率で出ます（S装備は別枠）。同じ装備を${C.FUSION.need}つ集めると合成できます（${C.FUSION.marks.slice(1).map((m, i) => `${m} ${C.FUSION.mult[i + 1]}倍`).join('・')}）。${C.FUSION.marks[3]}を${C.FUSION.gradeNeed}つで次のレアリティに、レジェンド${C.FUSION.marks[3]}を${C.FUSION.plusNeed}つでレジェンド+になります。レジェンドは装備ガチャからは出ません（エピック${C.FUSION.marks[3]}を${C.FUSION.gradeNeed}つ合成で作れます）。装備は「設計図」とコインでレベルアップもできます。</p>
        <h3 class="sub-head">装備の種類と効果</h3>
        <div class="item-list">${ORDERED_ITEMS.concat(ORDERED_S).map((k, idx) => {
          const d = C.ITEMS[k];
          const slot = C.SLOTS.find((s) => s.key === d.slot);
          return `${idx === ORDERED_ITEMS.length ? '<h3 class="sub-head s-head">S装備（エピックから）</h3>' : ''}<div class="item-row">${U.itemCard(k, d.s ? C.S_GEAR.minRarity : 'common', { cls: 'mini' })}
            <div><b>${esc(d.name)}</b> <span class="slot-tag">${slot.name}</span>
            <div class="effs">${U.effectLines(k).map((e) => `<span class="eff ${e.good ? 'good' : 'bad'}">${esc(e.text)}</span>`).join('')}</div>
            ${d.passive ? `<div class="effs"><span class="eff skill">パッシブ「${esc(d.passive.name)}」${esc(d.passive.desc)}</span></div>` : ''}
            <small>${esc(d.desc)}</small></div></div>`;
        }).join('')}</div>`,
      buttons: [{ label: 'とじる', cls: 'btn-blue' }],
    });
  }

  function showCharRates() {
    modal({
      title: 'キャラガチャ',
      cls: 'modal-wide',
      body: `
        <table class="rate-table">
          <thead><tr><th>レアリティ</th><th>出る確率</th><th>1体あたり</th><th>ATK・HPの増加</th></tr></thead>
          <tbody>${rateTable(false, 'char').map((r) => `<tr><td>${U.rarityLabel(r.key)}</td><td><b>${r.label}</b></td><td>${perOne(r.pct, CHAR_KEYS.filter((k) => C.CHARACTERS[k].rarity === r.key).length)}</td><td>×${C.CHAR_MULT[r.key]}</td></tr>`).join('')}</tbody>
        </table>
        <p class="note dark">「出る確率」がガチャから出る確率です。「ATK・HPの増加」は、そのキャラを設定したときに自分の ATK と HP にかかる倍率です（×1.2 なら1.2倍）。キャラは「装備」画面で設定でき、見た目とスキルは別々に選べます。レア以上は試合中に使える特殊スキルを持っています。</p>
        <h3 class="sub-head">キャラ一覧</h3>
        <div class="item-list">${CHAR_KEYS.map((k) => {
          const d = C.CHARACTERS[k];
          return `<div class="item-row">${U.charCard(k, { cls: 'mini' })}
            <div><b>${esc(d.name)}</b> ${U.rarityLabel(d.rarity)} <span class="slot-tag">ATK・HP ×${C.CHAR_MULT[d.rarity]}</span>
            ${d.skill ? `<div class="effs"><span class="eff skill">${esc(d.skill.name)}：${esc(d.skill.desc)}</span></div>` : ''}
            <small>${esc(d.desc)}</small></div></div>`;
        }).join('')}</div>`,
      buttons: [{ label: 'とじる', cls: 'btn-blue' }],
    });
  }

  /* ---------- 演出 ---------- */
  function run(n, ticket) {
    const cost = costOf(n);
    if (!ticket && S.data.coins < cost) { toast(`コインが足りません（あと ${fmt(cost - S.data.coins)}）。ステージをクリアしてミッション報酬を受け取ろう`, 'error', 3200); return; }
    const results = mode === 'char' ? pullChar(n, ticket) : pull(n, ticket);
    if (!results) return;
    sfx('gacha');
    showResults(n, results);
  }

  function showResults(n, results) {
    const best = results.reduce((b, r) => (S.RARITY[r.rarity].rank > S.RARITY[b].rank ? r.rarity : b), 'common');
    const ov = document.createElement('div');
    ov.className = `gacha-ov best-${best}`;
    ov.style.setProperty('--best', S.RARITY[best].color);
    ov.innerHTML = `
      <div class="gacha-ov-rays"></div>
      <div class="gacha-ov-chest">${A.chest('chest-art')}</div>
      <div class="gacha-flash"></div>
      <div class="gacha-results n${n === 1 ? 1 : 10}">
        ${results.map((r, i) => `<div class="res-card" style="--d:${i * 110}ms">
          ${r.kind === 'char' ? U.charCard(r.key, { isNew: r.isNew }) : U.itemCard(r.item, r.rarity, { isNew: r.isNew })}
          <div class="res-name">${esc(r.kind === 'char' ? C.CHARACTERS[r.key].name : C.ITEMS[r.item].name)}</div>
          ${U.rarityLabel(r.rarity)}${r.s ? '<span class="rlabel rl-s">S</span>' : ''}
        </div>`).join('')}
      </div>
      <div class="gacha-ov-foot">
        <button class="btn btn-blue" id="g-again">もう一度（${n}回）</button>
        ${results[0].kind === 'item' && S.equipBest(true) ? '<button class="btn btn-green" id="g-best">おすすめ装備</button>' : ''}
        <button class="btn btn-yellow" id="g-ok">OK</button>
      </div>
      <p class="tap-skip">タップでスキップ</p>`;
    $('#app').appendChild(ov);

    const timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const finish = () => { timers.forEach(clearTimeout); ov.classList.add('opened', 'revealed', 'done'); };
    requestAnimationFrame(() => ov.classList.add('show'));
    later(() => { ov.classList.add('opened'); sfx(S.RARITY[best].rank >= 3 ? 'gachaBig' : 'gachaOpen'); }, 1000);
    later(() => ov.classList.add('revealed'), 1450);
    later(() => ov.classList.add('done'), 1450 + results.length * 110 + 450);
    ov.addEventListener('click', (e) => { if (!ov.classList.contains('done') && !e.target.closest('button')) finish(); });

    const cost = costOf(n);
    const again = $('#g-again', ov);
    if (S.data.coins < cost) again.classList.add('short');
    again.addEventListener('click', () => {
      if (S.data.coins < cost) { toast(`コインが足りません（あと ${fmt(cost - S.data.coins)}）`, 'error'); return; }
      ov.remove(); run(n);
    });
    $('#g-ok', ov).addEventListener('click', () => { ov.classList.remove('show'); setTimeout(() => ov.remove(), 200); });
    const gb = $('#g-best', ov);
    if (gb) gb.addEventListener('click', () => { S.equipBest(); toast('一番強くなる装備に付け替えました', 'good'); if (DS.sound) DS.sound.play('equip'); gb.remove(); });

    const lp = results.filter((r) => r.rarity === 'legendPlus').length;
    const sn = results.filter((r) => r.s).length;
    if (sn) later(() => toast(`S装備を ${sn} 個ゲット！`, 'good', 3200), 1500);
    const legend = results.filter((r) => r.rarity === 'legend').length;
    if (lp) later(() => toast(`レジェンド+キャラをゲット！！`, 'good', 3600), 1600);
    else if (legend) later(() => toast(`レジェンド${results[0].kind === 'char' ? 'キャラ' : '装備'}を ${legend} 個ゲット！`, 'good', 3000), 1600);
  }

  DS.gacha = { render, update, pull, pullChar, rollRarity, rateTable, setMode };
})();

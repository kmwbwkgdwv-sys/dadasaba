/* =========================================================
 *  adventure.js  ― 冒険（v29・下のバーのいちばん右）
 *
 *  何もしなくても報酬がたまります。
 *    コイン　　　　：tickMin 分（5分）ごとに、クリアしたステージの数 × coinsPerStage 枚（5枚）
 *    ランダム設計図：bpTickMin 分（10分）ごとに、クリアしたステージの数 × bpPerStage 枚（1枚）
 *  maxHours 時間（24時間）分までたまり、それより長く放っておいても増えません。
 *  「冒険から受け取る」で受け取ります（state.js の adventureInfo / claimAdventure）。
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { $, esc, fmt } = U;
  const AD = C.ADVENTURE;

  /** 〇時間〇分 */
  function hm(ms) {
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
    return h ? `${h}時間${String(m % 60).padStart(2, '0')}分` : `${m}分`;
  }
  /** 分:秒 */
  function ms2(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  let lastScene = '';
  function render() {
    const el = $('#screen-adventure');
    if (!el) return;
    el.innerHTML = `
      <div class="screen-bg adv-bg"></div>
      <div class="screen-scroll">
        <div class="adv-head">
          <span class="adv-ic">${A.navIcon('adventure')}</span>
          <div><b class="adv-title outline">冒険</b><small>放っておくだけで報酬がたまります（最大${AD.maxHours}時間分）</small></div>
        </div>
        <div class="adv-card">
          <div class="adv-scene" id="adv-scene"></div>
          <div class="adv-time"><small>たまった時間</small><b id="adv-elapsed">0分</b><span>/ ${AD.maxHours}時間</span></div>
          <div class="adv-bar"><i id="adv-bar"></i></div>
          <p class="adv-next" id="adv-next"></p>
          <div class="adv-rewards">
            <div class="adv-rw">${A.blueprint('random')}<b id="adv-bp">×0</b><small>ランダム設計図</small></div>
            <div class="adv-rw">${A.coin()}<b id="adv-coins">+0</b><small>コイン</small></div>
          </div>
          <button class="btn btn-big btn-yellow adv-claim" id="adv-claim">冒険から受け取る</button>
          <p class="adv-rate" id="adv-rate"></p>
        </div>
        <p class="note adv-note">コインは ${AD.tickMin}分ごと、設計図は ${AD.bpTickMin}分ごとに増えます。先のステージをクリアするほど、たくさんたまるようになります。<br>
          ${AD.maxHours}時間たつと止まるので、1日1回は受け取りに来てね。</p>
      </div>`;
    lastScene = '';
    $('#adv-claim', el).addEventListener('click', claim);
    update();
  }

  function update() {
    const el = $('#screen-adventure');
    const i = S.adventureInfo();
    updateBadge(i);
    if (!el || !$('#adv-claim', el)) return;
    // 絵：クリアしたいちばん先のステージを、自分のキャラが歩いている
    const idx = Math.max(0, Math.min(C.STAGES.length - 1, i.stages - 1));
    const st = C.STAGES[idx], look = S.data.look || '';
    const key = st.key + '|' + look + '|' + (i.stages > 0);
    if (key !== lastScene) {
      lastScene = key;
      // 絵が枠いっぱいになるように（はみ出したところは切る）
      const art = A.stage(st.biome).replace('<svg ', '<svg preserveAspectRatio="xMidYMid slice" ');
      $('#adv-scene', el).innerHTML = `<div class="adv-stage">${art}</div>
        <div class="adv-hero">${look ? A.charSvg(look) : A.hero(C.PLAYER_COLORS[0])}</div>
        <span class="adv-where">${i.stages > 0 ? `STAGE ${st.no}「${esc(st.name)}」を冒険中…` : 'ステージ1をクリアすると冒険に出発！'}</span>`;
    }
    $('#adv-scene', el).classList.toggle('full', i.full);
    $('#adv-elapsed', el).textContent = hm(i.elapsed);
    $('#adv-bar', el).style.width = Math.min(100, i.elapsed / i.max * 100) + '%';
    $('#adv-next', el).innerHTML = i.full
      ? '<b class="adv-full">いっぱいです！</b>受け取らないと、これ以上たまりません'
      : `次のコインまで <b>${ms2(i.nextCoin)}</b>　次の設計図まで <b>${ms2(i.nextBp)}</b>`;
    $('#adv-bp', el).textContent = '×' + fmt(i.bp);
    $('#adv-coins', el).textContent = '+' + fmt(i.coins);
    const btn = $('#adv-claim', el), can = i.can;
    btn.disabled = !can;
    btn.classList.toggle('pulse', can && i.full);
    $('#adv-rate', el).innerHTML = i.stages > 0
      ? `${AD.tickMin}分ごとに <b>コイン ${fmt(i.coinsPer)}枚</b>・${AD.bpTickMin}分ごとに <b>ランダム設計図 ${fmt(i.bpPer)}枚</b><small>クリアしたステージの数 ${i.stages} × コイン${AD.coinsPerStage}枚・設計図${AD.bpPerStage}枚</small>`
      : 'ステージをクリアすると、報酬がたまるようになります';
  }

  /** 下のバーの印：1時間分たまったら「!」、24時間分たまったら「MAX」 */
  function updateBadge(i) {
    const nav = document.querySelector('.nav-btn[data-screen="4"]');
    if (!nav) return;
    i = i || S.adventureInfo();
    let b = nav.querySelector('.badge');
    if (!b) { b = document.createElement('b'); b.className = 'badge nav-badge'; nav.appendChild(b); }
    const show = i.stages > 0 && (i.full || i.elapsed >= 3600000);
    b.textContent = i.full ? 'MAX' : '!';
    b.classList.toggle('hidden', !show);
    b.classList.toggle('max', i.full);
  }

  function claim() {
    const got = S.claimAdventure();
    if (!got.length) return;
    update();
    if (DS.mission && DS.mission.showGot) DS.mission.showGot(got, '冒険の報酬');
  }

  // 冒険の画面を開いているときは1秒ごと、それ以外は30秒ごとに印だけ更新
  let n = 0;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    n++;
    if (DS.nav && DS.nav.current === 4) update();
    else if (n % 30 === 0) updateBadge();
  }, 1000);

  DS.adventure = { render, update, claim };
})();

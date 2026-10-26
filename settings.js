/* =========================================================
 *  settings.js  ― 設定（音量・ボタンの大きさと配置）
 *  この端末だけに保存します（引き継ぎコードでは引き継がれません）。
 * ========================================================= */
(function () {
  const U = DS.ui;
  const { $, $$, toast, modal } = U;
  const KEY = 'survivors-arena/settings/v1';
  const DEFAULTS = {
    bgmOn: true, bgm: 60, se: 80,
    skillSize: 100, skillX: 0.84, skillY: 0.8,     // スキルボタン（位置は画面に対する割合、ボタンの中心）
    joyMode: 'float', joySize: 100, joyX: 0.24, joyY: 0.8,   // float: 触った場所に出る / fixed: 決まった場所
    mapSize: 100,
    hurtFlash: true,
    lite: false,        // 軽量化モード（画面を少し粗くして、動き続ける飾りやエフェクトを減らす）
  };
  const listeners = new Set();
  let cur = load();

  function load() {
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  /** 軽量化モードを画面（CSS）に反映 */
  function applyLite() { document.documentElement.classList.toggle('lite', !!cur.lite); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* noop */ }
    applyLite();
    if (DS.sound) { DS.sound.setVolume(cur.bgm, cur.se); DS.sound.setBgmOn(cur.bgmOn); }
    listeners.forEach((f) => f(cur));
  }
  function set(k, v) { cur[k] = v; save(); }
  function reset() { cur = Object.assign({}, DEFAULTS); save(); }

  /* ---------- 画面 ---------- */
  const slider = (id, label, min, max, step, unit = '%', stack) => `
    <label class="set-row ${stack ? 'stack' : ''}"><span>${label}</span>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${cur[id]}">
      <b id="${id}-v">${cur[id]}${unit}</b></label>`;

  function open() {
    const m = modal({
      title: '設定',
      cls: 'modal-wide',
      body: `
        <h3 class="sub-head">サウンド</h3>
        <div class="set-row bgm-row"><span>BGM</span>
          <div class="seg set-seg bgm-seg"><button class="seg-btn" data-bgm="1">ON</button><button class="seg-btn" data-bgm="0">OFF</button></div></div>
        ${slider('bgm', 'BGMの音量', 0, 100, 5)}
        ${slider('se', '効果音', 0, 100, 5)}
        <p class="note dark">音は最初に画面をタップしたときから鳴ります。鳴らないときは、端末の音量と、ほかのアプリで音楽を流していないかを確認してください。</p>
        <h3 class="sub-head">軽量化モード</h3>
        <div class="set-row bgm-row"><span>軽量化モード</span>
          <div class="seg set-seg bgm-seg lite-seg"><button class="seg-btn" data-lite="1">ON</button><button class="seg-btn" data-lite="0">OFF</button></div></div>
        <p class="note dark">ONにすると、バトル画面を少し粗く・1秒30コマで描き、ずっと動き続ける飾りのアニメーション（キラキラ・回る光など）を止めます。スマホが熱くなる・カクカクする・電池の減りが早いときにおすすめです。</p>
        <h3 class="sub-head">操作とバトル画面の配置</h3>
        <div class="set-layout">
          <div class="layout-col">
            <div class="layout" id="layout">
              <div class="lp-top"><span class="lp-time">00:00</span><span class="lp-map" id="lp-map"></span></div>
              <div class="lp-hero"></div>
              <div class="lp-joy" id="lp-joy"><i></i></div>
              <div class="lp-skill" id="lp-skill">${DS.art.skillButtonIcon('freya')}</div>
            </div>
            <small class="lp-hint">ボタンをドラッグして<br>位置を変えられます</small>
          </div>
          <div class="set-col">
            <span class="set-label">ジョイスティック</span>
            <div class="seg set-seg"><button class="seg-btn" data-joy="float">触った場所</button><button class="seg-btn" data-joy="fixed">固定</button></div>
            ${slider('joySize', 'ジョイスティックの大きさ', 70, 150, 5, '%', true)}
            ${slider('skillSize', 'スキルボタンの大きさ', 60, 150, 5, '%', true)}
            ${slider('mapSize', 'ミニマップの大きさ', 70, 160, 5, '%', true)}
          </div>
        </div>
        <label class="set-row check-row"><span>ダメージを受けたとき画面のふちを赤く光らせる</span><input type="checkbox" id="hurtFlash" ${cur.hurtFlash ? 'checked' : ''}></label>`,
      buttons: [
        { label: '初期設定に戻す', cls: 'btn-gray', keepOpen: true, onClick: () => { reset(); sync(); toast('初期設定に戻しました'); } },
        { label: 'とじる', cls: 'btn-blue' },
      ],
    });
    const el = m.el;
    const units = { bgm: '%', se: '%', joySize: '%', skillSize: '%', mapSize: '%' };
    Object.keys(units).forEach((k) => {
      const inp = $('#' + k, el);
      inp.addEventListener('input', () => {
        set(k, +inp.value);
        $('#' + k + '-v', el).textContent = inp.value + units[k];
        drawLayout();
      });
      if (k === 'se') inp.addEventListener('change', () => DS.sound && DS.sound.play('levelup'));
    });
    $$('[data-joy]', el).forEach((b) => b.addEventListener('click', () => { set('joyMode', b.dataset.joy); sync(); }));
    $$('[data-bgm]', el).forEach((b) => b.addEventListener('click', () => { set('bgmOn', b.dataset.bgm === '1'); sync(); }));
    $$('[data-lite]', el).forEach((b) => b.addEventListener('click', () => {
      const on = b.dataset.lite === '1';
      if (on !== !!cur.lite) { set('lite', on); toast(on ? '軽量化モードをONにしました' : '軽量化モードをOFFにしました', 'good'); }
      sync();
    }));
    $('#hurtFlash', el).addEventListener('change', (e) => set('hurtFlash', e.target.checked));

    // ---- 配置のプレビュー（実際の画面と同じ縦横比） ----
    const app = document.getElementById('app').getBoundingClientRect();
    const lay = $('#layout', el);
    const W = 136, H = Math.round(W * app.height / app.width);
    const k = W / app.width;
    lay.style.width = W + 'px'; lay.style.height = Math.min(H, 300) + 'px';
    function drawLayout() {
      const h = lay.clientHeight;
      const sk = $('#lp-skill', el), js = $('#lp-joy', el), mp = $('#lp-map', el);
      const ss = 78 * cur.skillSize / 100 * k, jsz = 112 * cur.joySize / 100 * k, ms = 112 * cur.mapSize / 100 * k;
      Object.assign(sk.style, { width: ss + 'px', height: ss + 'px', left: (cur.skillX * W - ss / 2) + 'px', top: (cur.skillY * h - ss / 2) + 'px' });
      Object.assign(js.style, { width: jsz + 'px', height: jsz + 'px', left: (cur.joyX * W - jsz / 2) + 'px', top: (cur.joyY * h - jsz / 2) + 'px' });
      js.classList.toggle('float', cur.joyMode !== 'fixed');
      Object.assign(mp.style, { width: ms + 'px', height: ms + 'px' });
    }
    function drag(node, kx, ky) {
      node.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (node.classList.contains('float')) { toast('「決まった場所」にすると、ジョイスティックを動かせます'); return; }
        node.setPointerCapture(e.pointerId);
        const r = lay.getBoundingClientRect();
        const move = (ev) => {
          cur[kx] = Math.max(0.08, Math.min(0.92, (ev.clientX - r.left) / r.width));
          cur[ky] = Math.max(0.3, Math.min(0.94, (ev.clientY - r.top) / r.height));
          drawLayout();
        };
        const up = () => { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); save(); };
        node.addEventListener('pointermove', move);
        node.addEventListener('pointerup', up);
      });
    }
    drag($('#lp-skill', el), 'skillX', 'skillY');
    drag($('#lp-joy', el), 'joyX', 'joyY');

    function sync() {
      Object.keys(units).forEach((kk) => { $('#' + kk, el).value = cur[kk]; $('#' + kk + '-v', el).textContent = cur[kk] + units[kk]; });
      $$('[data-joy]', el).forEach((b) => b.classList.toggle('active', b.dataset.joy === cur.joyMode));
      $$('[data-bgm]', el).forEach((b) => b.classList.toggle('active', (b.dataset.bgm === '1') === !!cur.bgmOn));
      $$('[data-lite]', el).forEach((b) => b.classList.toggle('active', (b.dataset.lite === '1') === !!cur.lite));
      $('#bgm', el).closest('.set-row').classList.toggle('dim', !cur.bgmOn);
      $('#hurtFlash', el).checked = cur.hurtFlash;
      drawLayout();
    }
    sync();
  }

  if (DS.sound) { DS.sound.setVolume(cur.bgm, cur.se); DS.sound.setBgmOn(cur.bgmOn); }
  applyLite();
  /** 軽量化モードか */
  const lite = () => !!cur.lite;
  /** 画面の細かさ（軽量化モードなら1倍、ふだんは端末に合わせて最大2倍） */
  const dpr = () => (cur.lite ? 1 : Math.min(2, window.devicePixelRatio || 1));
  DS.settings = { get: () => cur, set, open, onChange: (f) => { listeners.add(f); return () => listeners.delete(f); }, DEFAULTS, lite, dpr };
})();

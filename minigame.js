/* =========================================================
 *  minigame.js  ― ミニゲームの画面（全員が使う）
 *
 *  ・ホストは DS.MgSim（mgsim.js）を動かし、全員にスナップショットとイベントを送る
 *  ・全員（ホストも）この画面で、自分の操作・描画・当たり判定・投票・結果を行う
 *  ・武器・スキル・パッシブの攻撃はなし。移動速度と、攻撃ではない効果だけが使える
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui, MG = DS.mg, T = MG.T, MGC = C.MINIGAMES;
  const { esc, toast, modal } = U;
  const TAU = Math.PI * 2;
  const COLORS = C.PLAYER_COLORS;
  const STEP = 1 / 60;
  const SNAP_MS = { dodge: 80, defender: 80, peak: 100, draw: 250 };
  const INPUT_MS = 50, INTERP_MS = 120;
  const GROUND_STAGE = { dodge: 10, draw: 10, peak: 0, defender: 20 };   // 地面の模様（ステージの番号）
  const BASE_SPEED = DS.gameConfig.PLAYER.baseSpeed;
  const mmss = (t) => { t = Math.max(0, Math.ceil(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const clamp = MG.clamp;

  /* ---------- ミニゲームのアイコン ---------- */
  const ICONS = {
    dodge: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="#3b2a6e" stroke="#231a3a" stroke-width="3"/>'
      + '<circle cx="32" cy="35" r="18" fill="#54449a" stroke="#c9a6ff" stroke-width="2.2" stroke-dasharray="4 3"/>'
      + '<path d="M8 14 L20 22 M56 14 L44 22 M10 54 L21 46" stroke="#ff9ae6" stroke-width="3" stroke-linecap="round" opacity=".6"/>'
      + '<circle cx="21" cy="22" r="4.6" fill="#ff7ad9" stroke="#231a3a" stroke-width="1.8"/><circle cx="43" cy="22" r="4.6" fill="#ff7ad9" stroke="#231a3a" stroke-width="1.8"/><circle cx="22" cy="46" r="4.6" fill="#ff7ad9" stroke="#231a3a" stroke-width="1.8"/>'
      + '<circle cx="34" cy="36" r="6.5" fill="#ffd8b0" stroke="#231a3a" stroke-width="2"/><path d="M28 33 Q34 26 40 33" fill="#5a3a22" stroke="#231a3a" stroke-width="1.6"/>'
      + '<path d="M47 52 L54 38 L60 52 Z" fill="#6b3fd4" stroke="#231a3a" stroke-width="2" stroke-linejoin="round"/></svg>',
    draw: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="#151024" stroke="#231a3a" stroke-width="3"/>'
      + '<circle cx="36" cy="30" r="21" fill="#f3d48a" opacity=".9"/><circle cx="36" cy="30" r="25" fill="none" stroke="#f3d48a" stroke-width="3" opacity=".35"/>'
      + '<path d="M22 38 L30 18 L38 38 L18 26 L42 26 Z" fill="none" stroke="#231a3a" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>'
      + '<circle cx="42" cy="26" r="5" fill="#ffd8b0" stroke="#231a3a" stroke-width="2"/>'
      + '<path d="M10 54 L16 48 L22 54" stroke="#ffd23d" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="16" cy="54" r="2.5" fill="#ffd23d"/></svg>',
    peak: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="#6cc35a" stroke="#231a3a" stroke-width="3"/>'
      + '<path d="M8 8 H36 M8 8 V36 M36 8 V20 M8 36 H20" stroke="#8a5a33" stroke-width="4.5" stroke-linecap="round"/><path d="M8 8 H36 M8 8 V36" stroke="#231a3a" stroke-width="1" opacity=".3"/>'
      + '<circle cx="20" cy="21" r="6" fill="#7fd36a" stroke="#231a3a" stroke-width="2"/><circle cx="18" cy="20" r="1.3" fill="#231a3a"/><circle cx="22.5" cy="20" r="1.3" fill="#231a3a"/>'
      + '<circle cx="44" cy="42" r="6" fill="#7fd36a" stroke="#231a3a" stroke-width="2"/><circle cx="42" cy="41" r="1.3" fill="#231a3a"/><circle cx="46.5" cy="41" r="1.3" fill="#231a3a"/>'
      + '<circle cx="52" cy="52" r="5.5" fill="#7fd36a" stroke="#231a3a" stroke-width="2"/>'
      + '<circle cx="34" cy="34" r="6.5" fill="#ffd8b0" stroke="#231a3a" stroke-width="2"/><path d="M34 34 L44 42" stroke="#fff" stroke-width="1.6" stroke-dasharray="2 2"/></svg>',
    defender: '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="2" y="2" width="60" height="60" rx="14" fill="#ff7a4a" stroke="#231a3a" stroke-width="3"/>'
      + '<circle cx="32" cy="32" r="27" fill="none" stroke="#3a1020" stroke-width="3" stroke-dasharray="3 4" opacity=".55"/>'
      + '<circle cx="32" cy="32" r="15" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 3" opacity=".8"/>'
      + '<g stroke="#231a3a" stroke-width="1.8"><circle cx="17" cy="32" r="6.5" fill="#c7d2e0"/><circle cx="47" cy="32" r="6.5" fill="#c7d2e0"/></g>'
      + '<path d="M17 25.5 V38.5 M10.5 32 H23.5 M47 25.5 V38.5 M40.5 32 H53.5" stroke="#231a3a" stroke-width="1.6"/>'
      + '<circle cx="32" cy="32" r="6.5" fill="#ffd8b0" stroke="#231a3a" stroke-width="2"/></svg>',
  };
  const icon = (key) => ICONS[key] || ICONS.dodge;
  const effectNames = (eff) => ['shield', 'miss', 'guts', 'revive'].filter((k) => eff[k]).map((k) => MG.EFFECT_NAMES[k])
    .concat(eff.skill ? [MG.EFFECT_NAMES[eff.skill]] : []);

  /* ---------- 地上絵：線の圧縮と描画 ---------- */
  function simplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const [ax, ay] = pts[a], [bx, by] = pts[b];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      let md = 0, mi = -1;
      for (let i = a + 1; i < b; i++) {
        const d = L < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L;
        if (d > md) { md = d; mi = i; }
      }
      if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }
  function encodeArt(pts) {
    const out = [];
    let px = 0, py = 0;
    simplify(pts, 1.6).forEach(([x, y], i) => {
      x = Math.round(x); y = Math.round(y);
      if (i === 0) out.push(x, y); else out.push(x - px, y - py);
      px = x; py = y;
    });
    return out;
  }
  function decodeArt(a) {
    if (!a) return [];
    const d = a.pts ? null : [].concat(...(a.parts || []).map((p) => p || []));
    if (a.pts) return a.pts;
    const pts = [];
    let x = 0, y = 0;
    for (let i = 0; i + 1 < d.length; i += 2) {
      if (i === 0) { x = d[0]; y = d[1]; } else { x += d[i]; y += d[i + 1]; }
      pts.push([x, y]);
    }
    return pts;
  }
  /** 絵をキャンバスに収まるように描く */
  function paintArt(cv, pts) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.fillStyle = '#f6ecd2'; x.fillRect(0, 0, W, H);
    if (pts.length < 2) {
      x.fillStyle = '#9a8a6a'; x.font = `900 ${Math.round(W / 12)}px "M PLUS Rounded 1c", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('（まっしろ）', W / 2, H / 2);
      return;
    }
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    pts.forEach(([px, py]) => { l = Math.min(l, px); t = Math.min(t, py); r = Math.max(r, px); b = Math.max(b, py); });
    const pad = 18, bw = Math.max(80, r - l), bh = Math.max(80, b - t);
    const k = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh);
    const ox = (W - bw * k) / 2 - l * k + (bw - (r - l)) * k / 2, oy = (H - bh * k) / 2 - t * k + (bh - (b - t)) * k / 2;
    x.strokeStyle = '#1b1426'; x.lineCap = 'round'; x.lineJoin = 'round';
    x.lineWidth = Math.max(2, 14 * k);
    x.beginPath();
    pts.forEach(([px, py], i) => { const sx = ox + px * k, sy = oy + py * k; if (i) x.lineTo(sx, sy); else x.moveTo(sx, sy); });
    x.stroke();
    x.fillStyle = '#3ddc84'; x.strokeStyle = '#231a3a'; x.lineWidth = 2;
    x.beginPath(); x.arc(ox + pts[0][0] * k, oy + pts[0][1] * k, Math.max(3, 5 * k), 0, TAU); x.fill(); x.stroke();
  }

  /* =========================================================
   *  描画（バトルの Renderer の絵をそのまま使う）
   * ========================================================= */
  const RU = DS.Renderer.util;
  class MgRenderer extends DS.Renderer {
    constructor(canvas, game) {
      super(canvas, GROUND_STAGE[game]);
      this.game = game;
      this.viewShort = T.view[game];
    }
    resize(w, h, dpr) {
      super.resize(w, h, dpr);
      this.scale = Math.min(w, h) / this.viewShort;
    }
    begin(cam, bg) {
      const c = this.ctx, k = this.scale * this.dpr;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = bg || this.ground.g.edge;
      c.fillRect(0, 0, this.cv.width, this.cv.height);
      c.setTransform(k, 0, 0, k, (this.w / 2 - cam.x * this.scale) * this.dpr, (this.h / 2 - cam.y * this.scale) * this.dpr);
      const hv = this.halfView;
      this.vb = { L: cam.x - hv.vw, T: cam.y - hv.vh, R: cam.x + hv.vw, B: cam.y + hv.vh };
      return this.vb;
    }
    screen() { this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
    toScreen(x, y, cam) { return [this.w / 2 + (x - cam.x) * this.scale, this.h / 2 + (y - cam.y) * this.scale]; }
    tiles(W, H) {
      const c = this.ctx, v = this.vb, TL = RU.TILE;
      const tx0 = Math.max(0, Math.floor(v.L / TL)), tx1 = Math.min(Math.ceil(W / TL) - 1, Math.floor(v.R / TL));
      const ty0 = Math.max(0, Math.floor(v.T / TL)), ty1 = Math.min(Math.ceil(H / TL) - 1, Math.floor(v.B / TL));
      for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
        c.drawImage(this.ground.tiles[Math.floor(RU.hash(tx, ty) * 8)], tx * TL, ty * TL, TL + 0.5, TL + 0.5);
      }
    }
    seen(x, y, m = 120) { const v = this.vb; return x > v.L - m && x < v.R + m && y > v.T - m && y < v.B + m; }
    hero(id, slot, x, y, look, buff, isMe) {
      this.drawPlayer([id, slot, x, y, 1, 1, 0, 0, 0, 0, 0, 0, look, 0, 0, buff], isMe);
    }
    tag(x, y, name, slot) {
      const c = this.ctx;
      c.font = '900 13px "M PLUS Rounded 1c", sans-serif';
      const tw = c.measureText(name).width + 16, yy = y - 70;
      c.fillStyle = COLORS[slot]; c.strokeStyle = '#231a3a'; c.lineWidth = 3;
      c.beginPath(); c.roundRect(x - tw / 2, yy - 11, tw, 22, 11); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.strokeText(name, x, yy + 1); c.fillText(name, x, yy + 1);
    }
    grave(x, y, slot) { const img = this.sp['t_' + slot]; if (img) this.ctx.drawImage(img, x - 22, y - 34, 44, 51); }
    zombie(type, x, y, flip, w) {
      const img = this.sp['e_' + type + (flip ? '_f' : '')] || this.sp['e_' + type];
      if (img) this.ctx.drawImage(img, x - w / 2, y - w * 0.58, w, w);
    }
    popText(x, y, text, color, age) {
      const c = this.ctx;
      c.globalAlpha = Math.max(0, 1 - age / 1.2);
      c.font = '900 22px "M PLUS Rounded 1c", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 5; c.strokeStyle = '#231a3a'; c.fillStyle = color || '#fff';
      c.strokeText(text, x, y - 60 - age * 40); c.fillText(text, x, y - 60 - age * 40);
      c.globalAlpha = 1;
    }
    burst(x, y, color, age) {
      const c = this.ctx, k = age / 0.6;
      if (k > 1) return;
      c.strokeStyle = color; c.globalAlpha = 1 - k; c.lineWidth = 6 * (1 - k) + 1;
      c.beginPath(); c.arc(x, y, 10 + 60 * k, 0, TAU); c.stroke();
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + 0.3, r0 = 14 + 50 * k, r1 = r0 + 16 * (1 - k);
        c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  /* =========================================================
   *  ミニゲーム本体
   * ========================================================= */
  let current = null;

  class Minigame {
    constructor(o) {
      this.o = o;
      this.game = o.game;
      this.def = MG.gameDef(o.game);
      this.isHost = !!o.isHost;
      this.session = o.session || null;
      this.selfId = o.selfId;
      this.members = o.members;
      this.names = {}; this.slots = {}; this.looks = {};
      o.members.forEach((m) => { this.names[m.id] = m.name; this.slots[m.id] = m.slot; this.looks[m.id] = m.look || ''; });
      this.self = o.members.find((m) => m.id === o.selfId) || o.members[0];
      this.eff = MG.effectsOf(this.self, this.game);
      const sp = MG.spawnPos(this.game, this.self.slot);
      this.me = { x: sp[0], y: sp[1] };
      this.alive = true;
      this.keys = {}; this.joy = { x: 0, y: 0, id: null };
      this.snaps = []; this.view = null; this.lastSnap = 0; this.lastInput = 0; this.acc = 0;
      this.off = null;
      this.fx = [];
      this.graves = new Map();
      this.B = new Map();                 // 弾よけ：弾 id → [x, y, vx, vy, t0]
      this.arts = {};                     // 地上絵：id → { n, parts } / 自分は { pts }
      this.path = [];
      this.done = false;
      this.voted = null;
      this.ended = false;
      // 効果の状態
      this.inv = 0; this.shieldUp = !!this.eff.shield; this.shieldCd = 0; this.gutsCd = 0; this.reviveLeft = !!this.eff.revive;
      this.skillCd = this.eff.skill ? Math.round(T.effects[this.eff.skill].cd / 3) : 0; this.skillAct = 0;
      this.spectate = null;
      this.onGame = this.onGame.bind(this);
      this.onLeft = this.onLeft.bind(this);
      this.frame = this.frame.bind(this);
      this.alive_ = true;
    }

    /* ---------- 準備 ---------- */
    async init() {
      const root = document.createElement('div');
      root.className = 'battle mg mg-' + this.game;
      const sk = this.eff.skill;
      root.innerHTML = `
        <canvas class="bt-canvas"></canvas>
        <div class="bt-hurt"></div>
        <div class="bt-hud mg-hud">
          <div class="mg-top">
            <div class="mg-leftcol">
              <div class="mg-left">
                <button class="bt-menu" aria-label="メニュー">Ⅱ</button>
                <div class="mg-title"><span class="mg-ic">${icon(this.game)}</span><b>${esc(this.def.name)}</b></div>
              </div>
              <div class="mg-info"></div>
              <div class="mg-board"></div>
            </div>
            <canvas class="bt-map mg-map" width="240" height="240"></canvas>
          </div>
          <div class="bt-banner"></div>
          <div class="mg-sub"></div>
        </div>
        <div class="bt-joy hidden"><div class="bt-joy-knob"></div></div>
        ${sk ? `<button class="bt-skill" aria-label="特殊スキル"><span class="bt-skill-ic">${A.skillButtonIcon(this.self.char)}</span><svg class="bt-skill-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg><b class="bt-skill-cd"></b><small class="bt-skill-name">${esc(MG.EFFECT_NAMES[sk])}</small></button>` : ''}
        ${this.game === 'draw' ? '<button class="btn btn-yellow mg-finish hidden">完成！</button>' : ''}
        <div class="mg-spec hidden"><button class="mg-spec-btn" data-d="-1">‹</button><span class="mg-spec-name"></span><button class="mg-spec-btn" data-d="1">›</button></div>
        <div class="mg-ready"></div>
        <div class="bt-menu-panel hidden"></div>
        <div class="mg-vote hidden"></div>
        <div class="bt-result hidden"></div>
        <div class="bt-loading">ミニゲームの準備中…</div>`;
      document.getElementById('app').appendChild(root);
      this.root = root;
      const q = (s) => root.querySelector(s);
      this.el = {
        canvas: q('.bt-canvas'), map: q('.mg-map'), info: q('.mg-info'), board: q('.mg-board'), banner: q('.bt-banner'), sub: q('.mg-sub'),
        joy: q('.bt-joy'), knob: q('.bt-joy-knob'), skill: q('.bt-skill'), menu: q('.bt-menu-panel'), result: q('.bt-result'),
        ready: q('.mg-ready'), vote: q('.mg-vote'), finish: q('.mg-finish'), spec: q('.mg-spec'), specName: q('.mg-spec-name'),
        loading: q('.bt-loading'), hurt: q('.bt-hurt'),
      };
      if (this.el.skill) {
        this.el.skillCd = q('.bt-skill-cd'); this.el.skillRing = q('.bt-skill-ring circle');
        this.el.skill.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.useSkill(); });
      }
      if (this.el.finish) this.el.finish.addEventListener('click', () => this.confirmFinish());
      root.querySelectorAll('.mg-spec-btn').forEach((b) => b.addEventListener('click', () => this.cycleSpectate(+b.dataset.d)));

      this.renderer = new MgRenderer(this.el.canvas, this.game);
      this.resize();
      await this.renderer.load();
      if (!this.alive_) return;
      if (this.game === 'draw') this.initPaper();

      if (this.isHost) this.sim = new DS.MgSim({ game: this.game, time: this.o.time, members: this.members });
      if (this.session) {
        this.session.on('game', this.onGame);
        if (this.isHost) this.session.on('left', this.onLeft);
      }
      this.bindInput();
      this._offSet = DS.settings ? DS.settings.onChange(() => this.applyLayout()) : null;
      this.applyLayout();
      if (DS.sound) DS.sound.bgm('battle');
      this.el.loading.remove();
      this.renderReady();
      this.raf = requestAnimationFrame(this.frame);
    }
    resize() {
      const r = this.root.getBoundingClientRect();
      this.renderer.resize(r.width, r.height, Math.min(2, window.devicePixelRatio || 1));
      this.applyLayout();
    }
    applyLayout() {
      if (!this.root) return;
      const st = DS.settings ? DS.settings.get() : {};
      const r = this.root.getBoundingClientRect();
      const W = r.width, H = r.height;
      const sk = this.el.skill;
      if (sk) {
        const ss = 78 * (st.skillSize || 100) / 100;
        Object.assign(sk.style, { width: ss + 'px', height: ss + 'px', right: 'auto', bottom: 'auto',
          left: clamp((st.skillX != null ? st.skillX : 0.84) * W - ss / 2, 6, W - ss - 6) + 'px',
          top: clamp((st.skillY != null ? st.skillY : 0.8) * H - ss / 2, 120, H - ss - 30) + 'px' });
        sk.style.setProperty('--ic', ss / 78);
      }
      const js = 112 * (st.joySize || 100) / 100;
      this.joyR = 56 * (st.joySize || 100) / 100;
      Object.assign(this.el.joy.style, { width: js + 'px', height: js + 'px', margin: `${-js / 2}px 0 0 ${-js / 2}px` });
      const kn = 48 * (st.joySize || 100) / 100;
      Object.assign(this.el.knob.style, { width: kn + 'px', height: kn + 'px' });
      this.joyFixed = st.joyMode === 'fixed';
      if (this.joyFixed) {
        this.joyHome = { x: clamp(st.joyX * W, js / 2 + 4, W - js / 2 - 4), y: clamp(st.joyY * H, 160, H - js / 2 - 10) };
        this.el.joy.style.left = this.joyHome.x + 'px'; this.el.joy.style.top = this.joyHome.y + 'px';
        if (this.joy.id == null) this.el.joy.classList.remove('hidden');
        this.el.joy.classList.add('fixed');
      } else {
        this.el.joy.classList.remove('fixed');
        if (this.joy.id == null) this.el.joy.classList.add('hidden');
      }
      const ms = 112 * (st.mapSize || 100) / 100;
      this.el.map.style.width = ms + 'px'; this.el.map.style.height = ms + 'px';
    }

    /* ---------- 操作 ---------- */
    bindInput() {
      const root = this.root;
      this._kd = (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.keys[k] = true; e.preventDefault(); }
        if (k === 'escape') this.toggleMenu();
        if (k === ' ' || k === 'e') { this.useSkill(); e.preventDefault(); }
      };
      this._ku = (e) => { this.keys[e.key.toLowerCase()] = false; };
      window.addEventListener('keydown', this._kd);
      window.addEventListener('keyup', this._ku);
      this._rs = () => this.resize();
      window.addEventListener('resize', this._rs);
      const canvas = this.el.canvas;
      canvas.addEventListener('pointerdown', (e) => {
        if (this.joy.id != null) return;
        const rb = root.getBoundingClientRect();
        this.joy.id = e.pointerId;
        if (this.joyFixed) { this.joy.ox = rb.left + this.joyHome.x; this.joy.oy = rb.top + this.joyHome.y; }
        else {
          this.joy.ox = e.clientX; this.joy.oy = e.clientY;
          this.el.joy.style.left = (e.clientX - rb.left) + 'px'; this.el.joy.style.top = (e.clientY - rb.top) + 'px';
        }
        this.el.joy.classList.remove('hidden');
        this.el.knob.style.transform = 'translate(-50%,-50%)';
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.joy.id) return;
        let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const R = this.joyR || 56, d = Math.hypot(dx, dy);
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        this.joy.x = dx / R; this.joy.y = dy / R;
        this.el.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      });
      const end = (e) => {
        if (e.pointerId !== this.joy.id) return;
        this.joy.id = null; this.joy.x = 0; this.joy.y = 0;
        if (this.joyFixed) this.el.knob.style.transform = 'translate(-50%,-50%)';
        else this.el.joy.classList.add('hidden');
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      root.querySelector('.bt-menu').addEventListener('click', () => this.toggleMenu());
    }
    inputVec() {
      if (this.bot) return this.bot();
      const k = this.keys;
      let x = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
      let y = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
      if (!x && !y) { x = this.joy.x; y = this.joy.y; }
      const d = Math.hypot(x, y);
      if (d > 1) { x /= d; y /= d; }
      return { x, y };
    }
    get dashOn() { return this.eff.skill === 'dash' && this.skillAct > 0; }
    flags() { return (this.inv > 0 ? 1 : 0) | (this.dashOn ? 2 : 0) | (this.shieldUp ? 8 : 0); }
    send(msg) {
      if (this.isHost) this.sim.input(this.selfId, msg);
      else if (this.session) this.session.sendGame(msg);
    }
    useSkill() {
      const sk = this.eff.skill;
      if (!sk || this.ended || !this.alive || this.skillCd > 0 || !this.view || this.view.ph !== 'play') return;
      const E = T.effects[sk];
      this.skillCd = E.cd; this.skillAct = E.dur;
      if (sk === 'iron') this.inv = Math.max(this.inv, E.dur);
      if (sk === 'veil') this.send({ k: 'skill', key: 'veil' });
      if (DS.sound) DS.sound.play('skill');
      this.pop(this.me.x, this.me.y, MG.EFFECT_NAMES[sk] + '！', '#ffe066');
    }

    /* ---------- 時計 ---------- */
    hostNow() { return this.isHost ? this.sim.t : performance.now() / 1000 + (this.off || 0); }
    elNow() {
      if (this.isHost) return this.sim.el;
      const last = this.snaps[this.snaps.length - 1];
      if (!last) return 0;
      return last.s.ph === 'play' ? last.s.el + Math.max(0, this.hostNow() - last.s.t) : last.s.el;
    }

    /* ---------- メインループ ---------- */
    frame(ts) {
      if (!this.alive_) return;
      const now = ts / 1000;
      const dt = Math.min(0.05, now - (this.lastT || now));
      this.lastT = now;
      if (this.isHost) this.hostTick(dt, ts); else this.guestTick(dt, ts);
      if (this.view) { this.update(dt); this.draw(now); this.hud(); }
      this.raf = requestAnimationFrame(this.frame);
    }
    hostTick(dt, ts) {
      const sim = this.sim;
      sim.input(this.selfId, { k: 'in', x: this.me.x, y: this.me.y, f: this.flags() });
      this.acc += dt;
      let n = 0;
      while (this.acc >= STEP && n < 5) { sim.step(STEP); this.acc -= STEP; n++; }
      if (n >= 5) this.acc = 0;
      if (sim.out.length) {
        const evs = sim.out; sim.out = [];
        for (const e of evs) { if (this.session) this.session.sendGame({ k: 'ev', e }); this.onEvent(e); }
      }
      const snap = sim.snapshot();
      if (this.session && ts - this.lastSnap >= SNAP_MS[this.game]) { this.lastSnap = ts; this.session.sendGame({ k: 's', s: snap }); }
      if (this.game === 'peak') snap.Z = unpackZ(snap.Z);
      this.view = snap;
    }
    guestTick(dt, ts) {
      if (ts - this.lastInput >= INPUT_MS && this.view) {
        this.lastInput = ts;
        if (this.alive || this.game === 'peak' || this.game === 'draw') this.send({ k: 'in', x: Math.round(this.me.x), y: Math.round(this.me.y), f: this.flags() });
      }
      if (this.snaps.length) this.view = this.interpolate(performance.now() - INTERP_MS);
    }
    interpolate(rt) {
      const a = this.snaps;
      if (a.length < 2 || rt <= a[0].at) return a[0].s;
      let i = a.length - 2;
      while (i > 0 && a[i].at > rt) i--;
      const s0 = a[i], s1 = a[i + 1];
      if (rt >= s1.at) return s1.s;
      const k = (rt - s0.at) / (s1.at - s0.at);
      const lerp = (la, lb) => {
        if (!la || !lb) return lb;
        const m = new Map(); for (const e of la) m.set(e[0], e);
        return lb.map((e) => { const o = m.get(e[0]); if (!o) return e; const n = e.slice(); n[1] = o[1] + (e[1] - o[1]) * k; n[2] = o[2] + (e[2] - o[2]) * k; return n; });
      };
      return Object.assign({}, s1.s, { P: lerp(s0.s.P, s1.s.P), Z: this.game === 'draw' ? s1.s.Z : lerp(s0.s.Z, s1.s.Z) });
    }

    /* ---------- 通信 ---------- */
    onGame(from, d) {
      if (!d || !this.alive_) return;
      if (this.isHost) { if (this.sim) this.sim.input(from, d); return; }
      if (d.k === 's') {
        const s = d.s;
        if (this.game === 'peak') s.Z = unpackZ(s.Z);
        const nowS = performance.now() / 1000, sample = s.t - nowS;
        if (this.off == null || sample > this.off || this.off - sample > 0.6) this.off = sample;
        else this.off += (sample - this.off) * 0.02;
        this.snaps.push({ at: performance.now(), s });
        if (this.snaps.length > 8) this.snaps.shift();
      } else if (d.k === 'ev') this.onEvent(d.e);
    }
    onLeft(m) {
      if (this.sim) this.sim.removePlayer(m.id);
    }
    onEvent(e) {
      const snd = (k) => { if (DS.sound) DS.sound.play(k); };
      switch (e.type) {
        case 'go':
          this.started = true;
          snd('alarm');
          this.banner(this.game === 'draw' ? `スタート！\nお題「${this.topic()}」` : 'スタート！', 1600, 'good');
          if (this.game === 'draw') { this.path = [[this.me.x, this.me.y]]; if (this.el.finish) this.el.finish.classList.remove('hidden'); }
          break;
        case 'b': {
          for (const b of e.l) this.B.set(b[0], b.slice(1));
          break;
        }
        case 'dead': {
          this.graves.set(e.id, { x: e.x, y: e.y });
          this.fx.push({ kind: 'burst', x: e.x, y: e.y, color: '#ff4f6a', t0: performance.now() / 1000 });
          if (e.id === this.selfId) break;
          if (e.by && this.names[e.by]) this.banner(`${this.names[e.by]} が ${this.names[e.id]} を倒した！`, 2000, 'warn');
          else if (e.by === 'zombie') this.banner(`${this.names[e.id] || ''} がゾンビにつかまった！`, 2000, 'warn');
          else this.banner(`${this.names[e.id] || ''} が脱落！`, 1800, 'warn');
          snd('down');
          if (this.spectate === e.id) this.cycleSpectate(1);
          break;
        }
        case 'catch': if (e.id === this.selfId) snd('click'); break;
        case 'steal':
          if (e.id === this.selfId) { snd('box'); this.banner(`${this.names[e.from] || ''} の柵からゾンビを取った！`, 1600, 'good'); }
          else if (e.from === this.selfId) { snd('down'); this.banner(`${this.names[e.id] || ''} に柵のゾンビを取られた！`, 1800, 'warn'); }
          break;
        case 'release':
          if (e.id === this.selfId) { snd('box'); this.pop(this.me.x, this.me.y, `+${e.n}`, '#7dff9a'); }
          break;
        case 'skill':
          if (e.key === 'veil') this.banner(`${this.names[e.id] || ''}：ブラックヴェール！\nゾンビが遅くなった`, 1800, 'skill');
          break;
        case 'art':
          if (e.id !== this.selfId) { const a = this.arts[e.id] || (this.arts[e.id] = { n: e.n, parts: [] }); a.n = e.n; a.parts[e.i] = e.d; }
          break;
        case 'done': break;
        case 'timeup':
          if (!this.done) { this.banner('時間切れ！', 1600, 'warn'); this.finishDraw(); }
          break;
        case 'vote': this.showVote(e.order, e.sec); break;
        case 'voted': this.votedN = (this.votedN || 0) + 1; this.updateVoteWait(); break;
        case 'left':
          this.banner(`${this.names[e.id] || ''} が退出しました`, 1800);
          break;
        case 'end': this.showResult(e.r); break;
        default: break;
      }
    }
    topic() { return (this.view && this.view.tp) || (this.sim && this.sim.topic) || ''; }

    /* ---------- 毎フレームの更新（自分の移動・当たり判定） ---------- */
    update(dt) {
      const v = this.view;
      const play = v.ph === 'play' && !this.ended;
      this.inv = Math.max(0, this.inv - dt);
      this.skillCd = Math.max(0, this.skillCd - dt);
      this.skillAct = Math.max(0, this.skillAct - dt);
      if (this.eff.shield && !this.shieldUp) { this.shieldCd -= dt; if (this.shieldCd <= 0) this.shieldUp = true; }
      this.gutsCd = Math.max(0, this.gutsCd - dt);
      const frozen = !play || !this.alive || (this.game === 'draw' && this.done);
      if (!frozen) this.moveSelf(dt);
      if (play && this.alive) {
        if (this.game === 'dodge') this.hitDodge();
        else if (this.game === 'defender') this.hitDefender();
      }
      // 弾よけ：画面外に出た弾を消す
      if (this.game === 'dodge' && this.B.size) {
        const now = this.hostNow(), D = T.dodge, lim = (D.rz + 160) ** 2;
        for (const [id, b] of this.B) {
          const x = b[0] + b[2] * (now - b[4]) - D.W / 2, y = b[1] + b[3] * (now - b[4]) - D.H / 2;
          if (now > b[4] + 0.5 && x * x + y * y > lim) this.B.delete(id);
        }
      }
    }
    moveSelf(dt) {
      const v = this.inputVec();
      const sp = BASE_SPEED * this.eff.speed / 100 * (this.dashOn ? 1 + T.effects.dash.spd / 100 : 1);
      let x = this.me.x + v.x * sp * dt, y = this.me.y + v.y * sp * dt;
      const pr = T.pr;
      if (this.game === 'dodge') {
        const D = T.dodge, dx = x - D.W / 2, dy = y - D.H / 2, d = Math.hypot(dx, dy), lim = D.ra - pr;
        if (d > lim) { x = D.W / 2 + dx / d * lim; y = D.H / 2 + dy / d * lim; }
      } else if (this.game === 'draw') {
        x = clamp(x, pr, T.draw.W - pr); y = clamp(y, pr, T.draw.H - pr);
      } else if (this.game === 'peak') {
        [x, y] = MG.pushOut(x, y, pr, MG.peakWalls());
        x = clamp(x, pr, T.peak.W - pr); y = clamp(y, pr, T.peak.H - pr);
      } else {
        x = clamp(x, pr, T.defender.W - pr); y = clamp(y, pr, T.defender.H - pr);
      }
      this.me.x = x; this.me.y = y;
      if (this.game === 'draw' && this.started && !this.done) this.recordPath();
    }
    hitDodge() {
      const now = this.hostNow(), D = T.dodge, R = T.hitR + D.br;
      for (const b of this.B.values()) {
        if (now < b[4]) continue;
        const x = b[0] + b[2] * (now - b[4]), y = b[1] + b[3] * (now - b[4]);
        if (Math.abs(x - this.me.x) > R || Math.abs(y - this.me.y) > R) continue;
        if ((x - this.me.x) ** 2 + (y - this.me.y) ** 2 < R * R) { this.onHit(''); if (!this.alive) return; }
      }
    }
    hitDefender() {
      const v = this.view, D = T.defender, now = this.hostNow(), R = T.hitR + D.dr;
      for (const p of v.P) {
        if (p[0] === this.selfId || !p[4]) continue;
        const slot = this.slots[p[0]];
        for (let k = 0; k < 2; k++) {
          if (!(p[5] & (1 << k))) continue;
          const [dx, dy] = MG.defPos(p[1], p[2], now, slot, k);
          if ((dx - this.me.x) ** 2 + (dy - this.me.y) ** 2 < R * R) { this.onHit(p[0]); if (!this.alive) return; }
        }
      }
      // ゾンビの輪
      const r = MG.ringR(this.elNow()), cx = D.W / 2, cy = D.H / 2;
      const d = Math.hypot(this.me.x - cx, this.me.y - cy);
      if (d > r - T.pr * 0.5) this.onHit('zombie', true);
    }
    /** 当たったとき：無敵 → 見切り → シールド → 不屈 → 不死の加護 → 脱落 の順に調べる */
    onHit(by, ring) {
      if (this.inv > 0) return;
      const pushIn = () => {
        if (!ring) return;
        const cx = T.defender.W / 2, cy = T.defender.H / 2, r = MG.ringR(this.elNow());
        const dx = this.me.x - cx, dy = this.me.y - cy, d = Math.hypot(dx, dy) || 1, to = Math.max(0, r - 110);
        this.me.x = cx + dx / d * to; this.me.y = cy + dy / d * to;
      };
      if (this.eff.miss && Math.random() < T.effects.miss.chance) { this.inv = 0.8; this.pop(this.me.x, this.me.y, 'MISS', '#9fe8ff'); pushIn(); return; }
      if (this.shieldUp) { this.shieldUp = false; this.shieldCd = T.effects.shield.cd; this.inv = 1.2; this.pop(this.me.x, this.me.y, 'ガード！', '#bfe9ff'); if (DS.sound) DS.sound.play('zap'); pushIn(); return; }
      if (this.eff.guts && this.gutsCd <= 0) { this.gutsCd = T.effects.guts.cd; this.inv = T.effects.guts.dur; this.pop(this.me.x, this.me.y, '不屈！', '#ffe066'); if (DS.sound) DS.sound.play('skill'); pushIn(); return; }
      if (this.reviveLeft) { this.reviveLeft = false; this.inv = T.effects.revive.inv; this.pop(this.me.x, this.me.y, '不死の加護で復活！', '#7dff9a'); if (DS.sound) DS.sound.play('revive'); pushIn(); return; }
      this.die(by);
    }
    die(by) {
      if (!this.alive) return;
      this.alive = false;
      this.send({ k: 'dead', td: Math.round(this.hostNow() * 1000) / 1000, by: by || '', x: Math.round(this.me.x), y: Math.round(this.me.y) });
      this.graves.set(this.selfId, { x: this.me.x, y: this.me.y });
      if (DS.sound) DS.sound.play('lose');
      if (this.el.hurt) { this.el.hurt.classList.remove('on'); void this.el.hurt.offsetWidth; this.el.hurt.classList.add('on'); }
      this.banner('脱落…\n観戦モードになります', 2200, 'warn');
      if (this.el.skill) this.el.skill.classList.add('hidden');
      setTimeout(() => this.cycleSpectate(1), 800);
    }
    cycleSpectate(dir) {
      if (this.alive || !this.view) return;
      const ids = this.view.P.filter((p) => p[4] && p[0] !== this.selfId).map((p) => p[0]);
      if (!ids.length) { this.spectate = null; this.el.spec.classList.add('hidden'); return; }
      let i = ids.indexOf(this.spectate);
      i = i < 0 ? 0 : (i + dir + ids.length) % ids.length;
      this.spectate = ids[i];
      this.el.spec.classList.remove('hidden');
      this.el.specName.innerHTML = `観戦中：<b style="color:${COLORS[this.slots[this.spectate]]}">${esc(this.names[this.spectate] || '')}</b>`;
    }
    pop(x, y, text, color) { this.fx.push({ kind: 'text', x, y, text, color, t0: performance.now() / 1000 }); }

    /* ---------- 地上絵 ---------- */
    initPaper() {
      const D = T.draw;
      const cv = document.createElement('canvas');
      cv.width = D.W; cv.height = D.H;
      const x = cv.getContext('2d');
      x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#17121f'; x.lineWidth = 14;
      this.paper = cv; this.px = x;
    }
    recordPath() {
      const last = this.path[this.path.length - 1];
      if (!last) { this.path.push([this.me.x, this.me.y]); return; }
      if (Math.hypot(this.me.x - last[0], this.me.y - last[1]) < T.draw.minStep) return;
      const x = this.px;
      x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(this.me.x, this.me.y); x.stroke();
      this.path.push([this.me.x, this.me.y]);
    }
    confirmFinish() {
      if (this.done || !this.started) return;
      modal({
        title: '完成！',
        body: '<p class="center">これで完成にしますか？<br><small>（完成にすると、もう描けません）</small></p>',
        buttons: [{ label: 'まだ描く', cls: 'btn-gray' }, { label: '完成にする', cls: 'btn-yellow', onClick: () => this.finishDraw() }],
      });
    }
    finishDraw() {
      if (this.done) return;
      this.done = true;
      if (this.el.finish) this.el.finish.classList.add('hidden');
      this.arts[this.selfId] = { pts: this.path.slice() };
      const data = encodeArt(this.path);
      const CH = 1600, n = Math.max(1, Math.ceil(data.length / CH));
      for (let i = 0; i < n; i++) this.send({ k: 'art', i, n, d: data.slice(i * CH, (i + 1) * CH) });
      this.send({ k: 'done' });
      if (DS.sound) DS.sound.play('equip');
    }
    showVote(order, sec) {
      this.voteOrder = order;
      this.voteEnd = performance.now() / 1000 + sec;
      this.votedN = 0;
      const el = this.el.vote;
      const others = order.filter((id) => id !== this.selfId);
      el.classList.remove('hidden');
      el.innerHTML = `<div class="mg-vote-card">
        <div class="lv-title outline">投票タイム</div>
        <p class="mg-vote-topic">お題「<b>${esc(this.topic())}</b>」</p>
        <p class="mg-vote-help">${others.length ? 'いちばん上手だと思う絵に1票！（自分の絵には投票できません）' : '投票できる絵がありません'}</p>
        <div class="mg-gallery n${order.length}">${order.map((id, i) => `
          <button class="mg-art ${id === this.selfId ? 'mine' : ''}" data-id="${esc(id)}" ${id === this.selfId ? 'disabled' : ''}>
            <canvas width="300" height="300"></canvas>
            <span class="mg-art-label">${id === this.selfId ? 'あなたの絵' : String.fromCharCode(65 + i)}</span>
          </button>`).join('')}</div>
        <div class="mg-vote-foot"><span class="mg-vote-time"></span><span class="mg-vote-wait"></span></div>
      </div>`;
      el.querySelectorAll('.mg-art').forEach((b) => {
        paintArt(b.querySelector('canvas'), decodeArt(this.arts[b.dataset.id]));
        b.addEventListener('click', () => {
          if (this.voted || b.dataset.id === this.selfId) return;
          this.voted = b.dataset.id;
          this.send({ k: 'vote', to: this.voted });
          el.querySelectorAll('.mg-art').forEach((x) => x.classList.toggle('picked', x === b));
          if (DS.sound) DS.sound.play('equip');
          this.updateVoteWait();
        });
      });
      this.updateVoteWait();
    }
    updateVoteWait() {
      const w = this.el.vote && this.el.vote.querySelector('.mg-vote-wait');
      if (!w) return;
      const total = this.members.length;
      w.textContent = this.voted ? `投票しました！ みんなを待っています（${this.votedN}/${total}）` : `投票 ${this.votedN}/${total}`;
    }

    /* ---------- 描画 ---------- */
    camTarget() {
      if (this.alive || this.game === 'draw' || this.game === 'peak') return this.me;
      const p = this.spectate && this.view.P.find((q) => q[0] === this.spectate);
      if (p) return { x: p[1], y: p[2] };
      return this.graves.get(this.selfId) || this.me;
    }
    draw(now) {
      const cam = this.camTarget();
      this.cam = cam;
      const R = this.renderer;
      if (this.game === 'dodge') this.drawDodge(R, cam, now);
      else if (this.game === 'draw') this.drawDraw(R, cam, now);
      else if (this.game === 'peak') this.drawPeak(R, cam, now);
      else this.drawDefender(R, cam, now);
      // エフェクト
      const tnow = performance.now() / 1000;
      this.fx = this.fx.filter((f) => tnow - f.t0 < 1.3);
      for (const f of this.fx) {
        if (f.kind === 'text') R.popText(f.x, f.y, f.text, f.color, tnow - f.t0);
        else R.burst(f.x, f.y, f.color, tnow - f.t0);
      }
      R.screen();
      this.drawEdgePins(R, cam);
      this.mapTick = (this.mapTick || 0) + 1;
      if (this.mapTick % 3 === 0) this.drawMinimap();
    }
    players() {
      // 自分の位置は手元の値（遅れなし）
      return this.view.P.map((p) => (p[0] === this.selfId ? [p[0], this.me.x, this.me.y, this.flags(), this.alive ? 1 : 0, p[5], p[6]] : p));
    }
    drawHeroes(R, list) {
      const ps = list.filter((p) => p[4]).sort((a, b) => a[2] - b[2]);
      for (const p of ps) if (R.seen(p[1], p[2])) R.hero(p[0], this.slots[p[0]], p[1], p[2], this.looks[p[0]], p[3], p[0] === this.selfId);
      for (const p of ps) if (R.seen(p[1], p[2])) R.tag(p[1], p[2], this.names[p[0]] || '', this.slots[p[0]]);
    }
    drawGraves(R) { for (const [id, g] of this.graves) if (R.seen(g.x, g.y)) R.grave(g.x, g.y, this.slots[id] || 0); }

    drawDodge(R, cam, now) {
      const D = T.dodge, cx = D.W / 2, cy = D.H / 2, c = R.ctx;
      R.begin(cam, '#120d2e');
      R.tiles(D.W, D.H);
      // 円の外は暗く
      c.fillStyle = 'rgba(10,6,30,.55)';
      c.beginPath(); c.rect(0, 0, D.W, D.H); c.arc(cx, cy, D.ra, 0, TAU, true); c.fill();
      // 魔法陣のふち
      c.strokeStyle = 'rgba(201,166,255,.85)'; c.lineWidth = 5; c.setLineDash([22, 14]); c.lineDashOffset = -now * 30;
      c.beginPath(); c.arc(cx, cy, D.ra, 0, TAU); c.stroke(); c.setLineDash([]);
      c.strokeStyle = 'rgba(255,122,217,.35)'; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, D.ra - 16, 0, TAU); c.stroke();
      this.drawGraves(R);
      // 魔法使いゾンビ
      for (const z of this.view.Z || []) {
        const [, x, y, ch, born] = z;
        if (!R.seen(x, y, 160)) continue;
        if (born) { c.fillStyle = 'rgba(185,140,255,.35)'; c.beginPath(); c.arc(x, y, 40, 0, TAU); c.fill(); }
        if (ch > 0) {
          c.fillStyle = `rgba(255,122,217,${0.18 + ch / 250})`; c.beginPath(); c.arc(x, y - 10, 26 + ch * 0.2, 0, TAU); c.fill();
          c.strokeStyle = `rgba(255,190,240,${ch / 100})`; c.lineWidth = 3; c.beginPath(); c.arc(x, y - 10, 46 - ch * 0.2, 0, TAU); c.stroke();
        }
        R.zombie('mageZombie', x, y, x > cx, 54);
      }
      this.drawHeroes(R, this.players());
      // 弾
      const tnow = this.hostNow();
      for (const b of this.B.values()) {
        if (tnow < b[4]) continue;
        const x = b[0] + b[2] * (tnow - b[4]), y = b[1] + b[3] * (tnow - b[4]);
        if (!R.seen(x, y, 30)) continue;
        c.fillStyle = 'rgba(255,122,217,.35)'; c.beginPath(); c.arc(x, y, D.br + 7, 0, TAU); c.fill();
        c.fillStyle = '#ff7ad9'; c.strokeStyle = '#231a3a'; c.lineWidth = 2.4;
        c.beginPath(); c.arc(x, y, D.br, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x - 3, y - 3, 3.4, 0, TAU); c.fill();
      }
    }
    drawDraw(R, cam) {
      const D = T.draw, c = R.ctx, cx = D.W / 2, cy = D.H / 2;
      R.begin(cam, '#0b0812');
      c.fillStyle = '#efe2c2'; c.fillRect(0, 0, D.W, D.H);
      c.fillStyle = 'rgba(160,130,80,.18)';
      for (let gx = 50; gx < D.W; gx += 100) for (let gy = 50; gy < D.H; gy += 100) { c.beginPath(); c.arc(gx, gy, 3, 0, TAU); c.fill(); }
      c.strokeStyle = '#6b4a22'; c.lineWidth = 10; c.strokeRect(0, 0, D.W, D.H);
      // スタート地点
      c.strokeStyle = 'rgba(61,220,132,.9)'; c.lineWidth = 4; c.setLineDash([8, 8]);
      c.beginPath(); c.arc(cx, cy, 34, 0, TAU); c.stroke(); c.setLineDash([]);
      c.drawImage(this.paper, 0, 0, D.W, D.H);
      R.hero(this.selfId, this.self.slot, this.me.x, this.me.y, this.self.look || '', this.flags(), true);
      // まわりを暗く（自分のまわりだけ見える）
      R.screen();
      const [sx, sy] = R.toScreen(this.me.x, this.me.y, cam);
      const L = D.light * R.scale;
      const g = c.createRadialGradient(sx, sy - 10, L * 0.5, sx, sy - 10, L * 1.45);
      g.addColorStop(0, 'rgba(6,4,14,0)'); g.addColorStop(0.55, 'rgba(6,4,14,.72)'); g.addColorStop(1, 'rgba(6,4,14,.97)');
      c.fillStyle = g; c.fillRect(0, 0, R.w, R.h);
    }
    drawPeak(R, cam, now) {
      const P = T.peak, c = R.ctx, pens = MG.peakPens();
      R.begin(cam, '#3d7a35');
      R.tiles(P.W, P.H);
      c.strokeStyle = '#231a3a'; c.lineWidth = 10; c.strokeRect(0, 0, P.W, P.H);
      const owner = {};
      this.view.P.forEach((p) => { if (!p[6]) owner[this.slots[p[0]]] = p[0]; });
      const sc = {};
      (this.view.SC || []).forEach(([id, n]) => { sc[id] = n; });
      // 柵の中
      for (const pen of pens) {
        const id = owner[pen.slot], col = id ? COLORS[pen.slot] : '#8a8a8a';
        c.fillStyle = id ? hexA(col, 0.16) : 'rgba(60,60,60,.18)';
        c.fillRect(pen.x, pen.y, pen.w, pen.h);
        // 真ん中（ここに来るとゾンビが入る）
        const mine = id === this.selfId;
        const carrying = mine && this.myCarry() > 0;
        c.strokeStyle = hexA(col, carrying ? 0.6 + 0.4 * Math.sin(now * 8) : 0.7); c.lineWidth = carrying ? 7 : 4; c.setLineDash([14, 10]);
        c.beginPath(); c.arc(pen.cx, pen.cy, P.releaseR, 0, TAU); c.stroke(); c.setLineDash([]);
        if (id && R.seen(pen.cx, pen.cy, 400)) {
          c.font = '900 30px "M PLUS Rounded 1c", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.lineWidth = 7; c.strokeStyle = '#231a3a'; c.fillStyle = col;
          const label = `${this.names[id] || ''}の柵`;
          c.strokeText(label, pen.cx, pen.cy - 26); c.fillText(label, pen.cx, pen.cy - 26);
          c.font = '900 40px "M PLUS Rounded 1c", sans-serif'; c.fillStyle = '#fff';
          c.strokeText(`${sc[id] || 0}匹`, pen.cx, pen.cy + 20); c.fillText(`${sc[id] || 0}匹`, pen.cx, pen.cy + 20);
        }
      }
      // 柵（木のさく）
      for (const w of MG.peakWalls()) {
        if (!R.seen(w.x + w.w / 2, w.y + w.h / 2, Math.max(w.w, w.h))) continue;
        c.fillStyle = '#a8743f'; c.strokeStyle = '#231a3a'; c.lineWidth = 3;
        c.beginPath(); c.roundRect(w.x, w.y, w.w, w.h, 5); c.fill(); c.stroke();
        c.fillStyle = '#7a4f28';
        const horiz = w.w > w.h, len = horiz ? w.w : w.h;
        for (let s = 10; s < len - 6; s += 46) {
          if (horiz) { c.fillRect(w.x + s, w.y - 6, 12, w.h + 12); c.strokeRect(w.x + s, w.y - 6, 12, w.h + 12); }
          else { c.fillRect(w.x - 6, w.y + s, w.w + 12, 12); c.strokeRect(w.x - 6, w.y + s, w.w + 12, 12); }
        }
      }
      // ゾンビ
      const veil = this.view.veil > 0;
      const zs = (this.view.Z || []).filter((z) => R.seen(z[1], z[2], 60)).sort((a, b) => a[2] - b[2]);
      for (const z of zs) {
        const [, x, y, code] = z;
        if (code >= 10) { c.fillStyle = hexA(COLORS[code - 10], 0.45); c.beginPath(); c.arc(x, y + 6, 24, 0, TAU); c.fill(); }
        R.zombie('zombie', x, y, Math.sin(z[0] * 7.3) > 0, 52);
        if (veil) { c.fillStyle = 'rgba(120,70,220,.28)'; c.beginPath(); c.arc(x, y - 6, 22, 0, TAU); c.fill(); }
      }
      this.drawHeroes(R, this.players());
    }
    myCarry() { const p = this.view.P.find((q) => q[0] === this.selfId); return p ? p[5] : 0; }
    drawDefender(R, cam, now) {
      const D = T.defender, c = R.ctx, cx = D.W / 2, cy = D.H / 2;
      R.begin(cam, '#4a5a72');
      R.tiles(D.W, D.H);
      const r = MG.ringR(this.elNow());
      // 輪の外：ゾンビの群れ（暗い赤）
      c.fillStyle = 'rgba(60,10,20,.5)';
      c.beginPath(); c.rect(-200, -200, D.W + 400, D.H + 400); c.arc(cx, cy, r, 0, TAU, true); c.fill();
      c.strokeStyle = `rgba(255,70,90,${0.55 + 0.35 * Math.sin(now * 5)})`; c.lineWidth = 5; c.setLineDash([18, 12]);
      c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.stroke(); c.setLineDash([]);
      // 輪のゾンビ
      const gap = 46, n = Math.max(12, Math.floor(TAU * (r + 26) / gap));
      for (let i = 0; i < n; i++) {
        const a = i * TAU / n + now * 0.03;
        const rr = r + 26 + Math.sin(now * 3 + i * 1.7) * 4;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (!R.seen(x, y, 60)) continue;
        R.zombie('zombie', x, y + Math.sin(now * 6 + i) * 2, x > cx, 50);
      }
      // 外側にもう1列（にぎやかに）
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) * TAU / n - now * 0.02, rr = r + 74;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        if (!R.seen(x, y, 60)) continue;
        c.globalAlpha = 0.75; R.zombie('zombie', x, y, x > cx, 46); c.globalAlpha = 1;
      }
      this.drawGraves(R);
      const list = this.players();
      // ディフェンサー（自分の色の輪っか＋歯車）
      const tnow = this.hostNow();
      const gear = R.sp.p_gear;
      for (const p of list) {
        if (!p[4]) continue;
        const slot = this.slots[p[0]];
        for (let k = 0; k < 2; k++) {
          if (!(p[5] & (1 << k))) continue;
          const [x, y] = MG.defPos(p[1], p[2], tnow, slot, k);
          if (!R.seen(x, y, 40)) continue;
          c.fillStyle = hexA(COLORS[slot], 0.5); c.beginPath(); c.arc(x, y, D.dr + 7, 0, TAU); c.fill();
          c.strokeStyle = COLORS[slot]; c.lineWidth = 3; c.beginPath(); c.arc(x, y, D.dr + 7, 0, TAU); c.stroke();
          if (gear) { c.save(); c.translate(x, y); c.rotate(tnow * 8); c.drawImage(gear, -D.dr * 1.25, -D.dr * 1.25, D.dr * 2.5, D.dr * 2.5); c.restore(); }
        }
        if (R.seen(p[1], p[2])) {
          c.strokeStyle = hexA(COLORS[slot], 0.35); c.lineWidth = 2; c.setLineDash([6, 8]);
          c.beginPath(); c.arc(p[1], p[2], D.orbit, 0, TAU); c.stroke(); c.setLineDash([]);
        }
      }
      this.drawHeroes(R, list);
    }
    drawEdgePins(R, cam) {
      if (this.game === 'draw') return;
      const W = R.w, H = R.h;
      for (const p of this.view.P) {
        if (p[0] === this.selfId || !p[4] || p[6]) continue;
        const [sx, sy] = R.toScreen(p[1], p[2], cam);
        if (sx > 10 && sx < W - 10 && sy > 10 && sy < H - 10) continue;
        R.edgePin(sx, sy, COLORS[this.slots[p[0]]], this.names[p[0]] || '', W, H, false);
      }
      if (this.game === 'peak') {
        const pen = MG.peakPens()[this.self.slot];
        const [sx, sy] = R.toScreen(pen.cx, pen.cy, cam);
        if (sx < 0 || sx > W || sy < 0 || sy > H) R.edgePin(sx, sy, COLORS[this.self.slot], '自分の柵', W, H, false, true);
      }
    }
    drawMinimap() {
      const mc = this.el.map, x = mc.getContext('2d'), S2 = mc.width;
      x.clearRect(0, 0, S2, S2);
      x.fillStyle = 'rgba(20,14,50,.82)'; x.beginPath(); x.roundRect(0, 0, S2, S2, 24); x.fill();
      const G = T[this.game], k = (S2 - 24) / G.W, ox = 12, oy = 12;
      const P = (px, py) => [ox + px * k, oy + py * k];
      const dot = (px, py, r, col, stroke) => { const [a, b] = P(px, py); x.fillStyle = col; x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); if (stroke) { x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke(); } };
      if (this.game === 'draw') {
        x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 3; x.strokeRect(ox, oy, G.W * k, G.H * k);
        const [a, b] = P(G.W / 2, G.H / 2);
        x.fillStyle = '#3ddc84'; x.font = '900 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('★', a, b);
        x.fillStyle = 'rgba(255,255,255,.8)'; x.font = '900 18px sans-serif'; x.fillText('スタート', a, b + 30);
        return;
      }
      if (this.game === 'dodge') {
        const [a, b] = P(G.W / 2, G.H / 2);
        x.strokeStyle = 'rgba(201,166,255,.9)'; x.lineWidth = 3; x.beginPath(); x.arc(a, b, G.ra * k, 0, TAU); x.stroke();
        for (const z of this.view.Z || []) dot(z[1], z[2], 4, z[3] > 0 ? '#ff7ad9' : '#9a7ad9');
      } else if (this.game === 'defender') {
        const [a, b] = P(G.W / 2, G.H / 2);
        x.strokeStyle = '#ff4a5e'; x.lineWidth = 4; x.beginPath(); x.arc(a, b, MG.ringR(this.elNow()) * k, 0, TAU); x.stroke();
      } else {
        x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 2; x.strokeRect(ox, oy, G.W * k, G.H * k);
        const owner = {};
        this.view.P.forEach((p) => { if (!p[6]) owner[this.slots[p[0]]] = p[0]; });
        for (const pen of MG.peakPens()) {
          const [a, b] = P(pen.x, pen.y);
          x.fillStyle = owner[pen.slot] ? hexA(COLORS[pen.slot], 0.4) : 'rgba(255,255,255,.1)';
          x.fillRect(a, b, pen.w * k, pen.h * k);
          x.strokeStyle = owner[pen.slot] ? COLORS[pen.slot] : 'rgba(255,255,255,.3)'; x.lineWidth = 2; x.strokeRect(a, b, pen.w * k, pen.h * k);
        }
        for (const z of this.view.Z || []) dot(z[1], z[2], 2.6, z[3] === 0 ? '#9cff7a' : z[3] >= 10 ? '#fff' : '#5c9a4a');
      }
      for (const p of this.players()) {
        if (!p[4] && this.game !== 'peak') continue;
        dot(p[1], p[2], p[0] === this.selfId ? 8 : 6.5, COLORS[this.slots[p[0]]], p[0] === this.selfId);
      }
    }

    /* ---------- HUD ---------- */
    hud() {
      const v = this.view, el = this.el;
      const live = v.P.filter((p) => !p[6]);
      const aliveN = v.P.filter((p) => p[4] && !p[6]).length;
      let info = '';
      if (this.game === 'dodge') info = `<span class="mg-chip">生存 <b>${aliveN}</b>/${live.length}</span><span class="mg-chip time">${mmss(v.ph === 'play' ? this.elNow() : 0)}</span>`;
      else if (this.game === 'defender') {
        info = `<span class="mg-chip">生存 <b>${aliveN}</b>/${live.length}</span><span class="mg-chip time">${mmss(v.ph === 'play' ? this.elNow() : 0)}</span>`;
      } else if (this.game === 'draw') {
        const left = v.ph === 'play' ? v.dur - this.elNow() : v.dur;
        const doneN = v.P.filter((p) => p[5]).length;
        info = `<span class="mg-chip topic">お題「<b>${esc(this.topic())}</b>」</span><span class="mg-chip time ${left < 10 && v.ph === 'play' ? 'hurry' : ''}">${mmss(left)}</span><span class="mg-chip">完成 ${doneN}/${live.length}</span>`;
      } else {
        const left = v.ph === 'play' ? v.dur - this.elNow() : v.dur;
        info = `<span class="mg-chip time ${left < 10 && v.ph === 'play' ? 'hurry' : ''}">${mmss(left)}</span><span class="mg-chip carry">運搬中 <b>${this.myCarry()}</b>/${T.peak.carry}</span>`
          + (v.veil > 0 ? '<span class="mg-chip veil">ゾンビが遅い！</span>' : '');
      }
      if (info !== this._info) { this._info = info; el.info.innerHTML = info; }
      // ゾンビピークの得点表
      if (this.game === 'peak') {
        const sc = (v.SC || []).slice().sort((a, b) => b[1] - a[1]);
        const html = sc.map(([id, n]) => `<span class="mg-score ${id === this.selfId ? 'me' : ''}" style="--pc:${COLORS[this.slots[id]]}"><i></i>${esc(this.names[id] || '')}<b>${n}</b></span>`).join('');
        if (html !== this._board) { this._board = html; el.board.innerHTML = html; }
      }
      // 下の案内
      let sub = '';
      if (this.game === 'draw' && this.done && v.ph === 'play') sub = '完成！ みんなが描き終わるのを待っています…';
      if (this.game === 'peak' && this.myCarry() >= T.peak.carry) sub = 'いっぱい！自分の柵の真ん中に連れて行こう';
      if (sub !== this._sub) { this._sub = sub; el.sub.textContent = sub; el.sub.classList.toggle('on', !!sub); }
      // スキルボタン
      if (el.skill) {
        const sk = this.eff.skill, E = T.effects[sk];
        el.skill.classList.toggle('ready', this.skillCd <= 0 && this.alive && v.ph === 'play');
        el.skill.classList.toggle('active', this.skillAct > 0);
        el.skillCd.textContent = this.skillAct > 0 ? Math.ceil(this.skillAct) : this.skillCd > 0 ? Math.ceil(this.skillCd) : '';
        el.skillRing.style.strokeDashoffset = String(289 * (this.skillCd > 0 ? this.skillCd / E.cd : 0));
      }
      // 投票ののこり時間
      if (this.voteEnd && !this.ended) {
        const vt = el.vote.querySelector('.mg-vote-time');
        const sec = Math.max(0, Math.ceil(this.voteEnd - performance.now() / 1000));
        if (vt && vt.dataset.s !== String(sec)) { vt.dataset.s = sec; vt.textContent = `のこり ${sec}秒`; }
      }
      // 始まる前の説明
      if (v.ph === 'ready') this.updateReady(); else if (!this.readyHidden) { this.readyHidden = true; el.ready.classList.add('hide'); setTimeout(() => el.ready.classList.add('hidden'), 400); }
    }
    renderReady() {
      const eff = effectNames(this.eff);
      const d = this.def;
      this.el.ready.innerHTML = `<div class="mg-ready-card">
        <span class="mg-ready-ic">${icon(this.game)}</span>
        <div class="mg-ready-title outline">${esc(d.name)}</div>
        <div class="mg-ready-topic hidden"></div>
        <ul class="mg-rules">${d.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        <div class="mg-ready-eff">${eff.length ? `あなたの有効な効果：${eff.map((e) => `<b>${esc(e)}</b>`).join('')}` : ''}${this.eff.speed !== 100 ? `<b>移動速度 ${this.eff.speed}%</b>` : ''}</div>
        <div class="mg-ready-count outline">…</div>
      </div>`;
    }
    updateReady() {
      const left = Math.max(0, T.ready - this.hostNow());
      const n = Math.ceil(left);
      const cnt = this.el.ready.querySelector('.mg-ready-count');
      if (cnt && cnt.textContent !== String(n || 'GO')) {
        cnt.textContent = n > 0 ? n : 'GO!';
        if (n > 0 && n <= 3 && DS.sound) DS.sound.play('beep');
      }
      const tp = this.el.ready.querySelector('.mg-ready-topic');
      if (this.game === 'draw' && tp && this.topic() && tp.classList.contains('hidden')) {
        tp.innerHTML = `お題<b>${esc(this.topic())}</b>`; tp.classList.remove('hidden');
      }
    }
    banner(text, ms = 2200, cls = '') {
      const b = this.el.banner;
      b.textContent = text;
      b.className = 'bt-banner show ' + cls;
      clearTimeout(this._bt);
      this._bt = setTimeout(() => { b.className = 'bt-banner'; }, ms);
    }

    /* ---------- メニュー ---------- */
    toggleMenu() {
      if (this.ended) return;
      const m = this.el.menu;
      if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
      const quitLabel = this.isHost ? 'ミニゲームを終了する（全員）' : 'ロビーから抜ける';
      m.innerHTML = `<div class="bt-menu-card">
        <div class="lv-title outline">メニュー</div>
        <p>対戦中は時間は止まりません。</p>
        <button class="btn btn-green btn-big" data-a="resume">つづける</button>
        <button class="btn btn-blue btn-big" data-a="settings">設定</button>
        <button class="btn btn-red btn-big" data-a="quit">${quitLabel}</button></div>`;
      m.classList.remove('hidden');
      m.querySelector('[data-a=resume]').addEventListener('click', () => this.toggleMenu());
      m.querySelector('[data-a=settings]').addEventListener('click', () => DS.settings && DS.settings.open());
      m.querySelector('[data-a=quit]').addEventListener('click', () => {
        m.classList.add('hidden');
        if (this.isHost) this.sim.end({ winners: [], rank: this.sim.list.map((p) => ({ id: p.id, name: p.name, slot: p.slot, gone: p.gone })), aborted: true });
        else if (this.o.onLeave) this.o.onLeave();
      });
    }

    /* ---------- 結果 ---------- */
    showResult(r) {
      if (this.ended) return;
      this.ended = true;
      this.el.menu.classList.add('hidden'); this.el.vote.classList.add('hidden');
      if (this.el.finish) this.el.finish.classList.add('hidden');
      if (this.el.skill) this.el.skill.classList.add('hidden');
      this.el.spec.classList.add('hidden');
      const win = r.winners.includes(this.selfId);
      const solo = r.winners.length === 1;
      if (DS.sound) { DS.sound.bgm(null); DS.sound.play(win ? 'win' : 'lose'); }
      const title = r.aborted ? '中断' : win && solo ? 'WIN!' : win ? 'ひきわけ' : r.winners.length ? 'LOSE…' : 'ひきわけ';
      const headline = r.aborted ? 'ホストがミニゲームを終了しました'
        : r.winners.length ? `${r.winners.map((id) => esc(this.names[id] || '')).join('・')} の${solo ? '勝ち！' : '引き分け！'}` : '勝者なし';
      const metric = (x) => {
        if (this.game === 'dodge') return x.alive ? '<b>生き残り！</b>' : `${x.time}秒`;
        if (this.game === 'defender') return `${x.alive ? '<b>生き残り！</b>' : x.time + '秒'}<small>撃破 ${x.kills || 0}</small>`;
        if (this.game === 'peak') return `<b>${x.score || 0}</b>匹`;
        return `<b>${x.score || 0}</b>票`;
      };
      const rows = (r.rank || []).map((x, i) => `<tr class="${x.id === this.selfId ? 'me' : ''} ${r.winners.includes(x.id) ? 'win' : ''}">
        <td class="mg-rk">${r.winners.includes(x.id) ? A.crown() : i + 1}</td>
        <td><i style="background:${COLORS[x.slot]}"></i>${esc(x.name || '')}${x.gone ? '<small>（退出）</small>' : ''}</td>
        <td class="mg-met">${r.aborted ? '' : metric(x)}</td></tr>`).join('');
      const gallery = this.game === 'draw' && r.order && r.order.length ? `<div class="mg-gallery result n${r.order.length}">${r.order.map((id) => `
          <div class="mg-art ${r.winners.includes(id) ? 'win' : ''}" data-id="${esc(id)}"><canvas width="240" height="240"></canvas>
            <span class="mg-art-label" style="--pc:${COLORS[this.slots[id]]}">${r.winners.includes(id) ? A.crown() : ''}${esc(this.names[id] || '')}<b>${(r.counts || {})[id] || 0}票</b></span></div>`).join('')}</div>
        <p class="mg-topic-line">お題「<b>${esc(r.topic || this.topic())}</b>」</p>` : '';
      const el = this.el.result;
      el.classList.remove('hidden');
      el.innerHTML = `<div class="rs-card mg-rs ${win ? 'win' : 'lose'}">
        <div class="rs-title outline">${title}</div>
        <div class="rs-stage">${icon(this.game)}<span>${esc(this.def.name)}</span></div>
        <div class="mg-headline">${headline}</div>
        ${gallery}
        <table class="rs-table mg-table">${rows}</table>
        <button class="btn btn-yellow btn-big rs-exit">ロビーに戻る</button>
      </div>`;
      el.querySelectorAll('.mg-art').forEach((a) => paintArt(a.querySelector('canvas'), decodeArt(this.arts[a.dataset.id])));
      el.querySelector('.rs-exit').addEventListener('click', () => {
        const cb = this.o.onExit;
        stop();
        if (cb) cb(r);
      });
    }

    destroy() {
      this.alive_ = false;
      if (this._offSet) this._offSet();
      if (DS.sound) DS.sound.bgm('lobby');
      cancelAnimationFrame(this.raf);
      window.removeEventListener('keydown', this._kd);
      window.removeEventListener('keyup', this._ku);
      window.removeEventListener('resize', this._rs);
      if (this.session) { this.session.off('game', this.onGame); this.session.off('left', this.onLeft); }
      if (this.root) this.root.remove();
    }
  }

  function unpackZ(Z) {
    if (!Array.isArray(Z) || (Z.length && Array.isArray(Z[0]))) return Z || [];
    const out = [];
    for (let i = 0; i + 3 < Z.length; i += 4) out.push([Z[i], Z[i + 1], Z[i + 2], Z[i + 3]]);
    return out;
  }
  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* =========================================================
   *  ロビーから使う部品
   * ========================================================= */
  function start(o) {
    stop();
    if (DS.battle && DS.battle.active) DS.battle.stop();
    current = new Minigame(o);
    current.init();
    return current;
  }
  function stop() { if (current) { current.destroy(); current = null; } }

  DS.minigame = {
    start, stop, icon, effectNames,
    get active() { return !!current; },
    get current() { return current; },
    _test: { encodeArt, decodeArt, simplify },
  };
})();

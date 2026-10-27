/* =========================================================
 *  game.js  ― バトル画面の進行（操作・HUD・通信・結果）
 *
 *  ホスト : DS.Sim を動かし、15回/秒で全員に状態（スナップショット）を送る
 *  ゲスト : 自分の位置を20回/秒でホストに送り、届いた状態を補間して描画する
 *  ソロ   : session が null のホストとして動く
 * ========================================================= */
(function () {
  const GC = DS.gameConfig, C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { esc, fmt, fmtBig, toast } = U;
  const STEP = 1 / 60;
  const SNAP_MS = 83, INPUT_MS = 50, INTERP_MS = 130;

  // 通信量を減らすため、敵のリストは数字を平らに並べて送る（1体 = 5つの数）
  function packSnap(s) {
    const E = [];
    for (const e of s.E) E.push(e[0], e[1], e[2], e[3], (e[4] << 4) | (e[8] << 3) | (e[7] << 2) | (e[6] << 1) | e[5]);
    return Object.assign({}, s, { E });
  }
  function unpackSnap(s) {
    const E = [];
    for (let i = 0; i < s.E.length; i += 5) {
      const f = s.E[i + 4];
      E.push([s.E[i], s.E[i + 1], s.E[i + 2], s.E[i + 3], f >> 4, f & 1, (f >> 1) & 1, (f >> 2) & 1, (f >> 3) & 1]);
    }
    s.E = E;
    return s;
  }
  const owMin = () => Math.round(((GC.OVERWHELM && GC.OVERWHELM.seconds) || 180) / 60);
  const PHASE_LABEL = { warp: 'まもなくワープ', intro: 'まもなくボス', boss: 'BOSS' };
  const isLite = () => !!(DS.settings && DS.settings.lite());

  const mmss = (t) => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const parseBuild = (str) => {
    const [a, b] = String(str || '|').split('|');
    const conv = (x) => (x ? x.split(',').filter(Boolean).map((s) => { const [k, v] = s.split(':'); return { key: k, star: +v }; }) : []);
    return { skills: conv(a), abilities: conv(b) };
  };
  function optInfo(o) {
    if (o.kind === 'heal') return { name: 'HPを回復', tag: '回復', desc: 'HPを30%回復する', icon: A.skillIcon('heal') };
    if (o.kind === 'coins') return { name: `コイン +${fmt(o.n || GC.MAXED_COINS || 1000)}`, tag: 'ボーナス', desc: '試合が終わるともらえる（負けてももらえる）', icon: A.coin() };
    const d = o.kind === 'skill' ? GC.SKILLS[o.key] : GC.ABILITIES[o.key];
    return { name: d.name, tag: o.kind === 'skill' ? (d.weapon ? '武器' : 'スキル') : 'アビリティ', desc: d.desc(o.star), icon: A.skillIcon(o.key), evo: o.star >= (GC.EVO_STAR || 6) };
  }
  // ★5 の次は赤★1（進化）
  const starHtml = (n) => (n >= (GC.EVO_STAR || 6)
    ? `<b class="evo-star">赤<i>★</i>1</b><em class="evo-tag">進化</em>`
    : Array.from({ length: GC.MAX_STAR }, (_, i) => `<i class="${i < n ? 'on' : ''}">★</i>`).join(''));
  const starText = (n) => (n >= (GC.EVO_STAR || 6) ? '赤★1（進化）' : '★' + n);

  let current = null;

  class Battle {
    constructor(o) {
      this.o = o;
      this.stageIndex = o.stageIndex || 0;
      this.stage = C.STAGES[this.stageIndex];
      this.isHost = !!o.isHost;
      this.session = o.session || null;
      this.selfId = o.selfId;
      this.names = {};
      o.members.forEach((m) => { this.names[m.id] = m.name; });
      this.self = o.members.find((m) => m.id === o.selfId) || o.members[0];
      const ang = (this.self.slot || 0) * Math.PI / 2;
      this.me = { x: GC.WORLD.w / 2 + Math.cos(ang) * 60, y: GC.WORLD.h / 2 + Math.sin(ang) * 60 };
      this.keys = {}; this.joy = { x: 0, y: 0, id: null };
      this.snaps = [];
      this.acc = 0; this.lastSnap = 0; this.lastInput = 0;
      this.menuPaused = false;
      this.alive = true;
      this.lastHp = null; this.buildStr = '';
      this.lvSeq = 0; this.picked = true;
      this.ended = false;
      this.onGame = this.onGame.bind(this);
      this.onLeft = this.onLeft.bind(this);
      this.frame = this.frame.bind(this);
    }

    /* ---------- 準備 ---------- */
    async init() {
      const root = document.createElement('div');
      root.className = 'battle';
      root.innerHTML = `
        <canvas class="bt-canvas"></canvas>
        <div class="bt-hurt"></div>
        <div class="bt-hud">
          <div class="bt-xp"><div class="bt-xp-fill"></div><span class="bt-lv">Lv 1</span></div>
          <div class="bt-row">
            <div class="bt-left">
              <div class="bt-timebox"><button class="bt-menu" aria-label="メニュー">Ⅱ</button><span class="bt-time">00:00</span></div>
              <div class="bt-sub"><span class="bt-phase"></span><span class="bt-kills">撃破 0</span><span class="bt-ow hidden">圧倒</span>${this.o.members.length > 1 ? `<span class="bt-diff">難易度×${GC.DIFFICULTY.party}</span>` : ''}</div>
              <div class="bt-build"></div>
            </div>
            <canvas class="bt-map" width="240" height="240"></canvas>
          </div>
          <div class="bt-boss hidden"><div class="bt-boss-name"></div><div class="bt-boss-bar"><div class="bt-boss-fill"></div><span class="bt-boss-hp"></span></div></div>
          <div class="bt-banner"></div>
          <div class="bt-count hidden"></div>
          <div class="bt-down hidden">ダウン中…<small>仲間がそばに3秒いると復活できます</small></div>
          <div class="bt-hint">画面をドラッグして移動（PCは WASD / 矢印キー）</div>
        </div>
        <div class="bt-joy hidden"><div class="bt-joy-knob"></div></div>
        <button class="bt-skill hidden" aria-label="特殊スキル"><span class="bt-skill-ic"></span><svg class="bt-skill-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46"/></svg><b class="bt-skill-cd"></b><small class="bt-skill-name"></small></button>
        <div class="bt-lvl hidden"></div>
        <div class="bt-roul hidden"></div>
        <div class="bt-menu-panel hidden"></div>
        <div class="bt-result hidden"></div>
        <div class="bt-loading">バトルの準備中…</div>`;
      document.getElementById('app').appendChild(root);
      this.root = root;
      const q = (s) => root.querySelector(s);
      this.el = {
        canvas: q('.bt-canvas'), map: q('.bt-map'), xp: q('.bt-xp-fill'), lv: q('.bt-lv'), time: q('.bt-time'),
        phase: q('.bt-phase'), kills: q('.bt-kills'), ow: q('.bt-ow'), build: q('.bt-build'), boss: q('.bt-boss'), bossName: q('.bt-boss-name'),
        bossFill: q('.bt-boss-fill'), bossHp: q('.bt-boss-hp'), banner: q('.bt-banner'), count: q('.bt-count'), down: q('.bt-down'),
        joy: q('.bt-joy'), knob: q('.bt-joy-knob'), lvl: q('.bt-lvl'), roul: q('.bt-roul'), menu: q('.bt-menu-panel'), result: q('.bt-result'),
        loading: q('.bt-loading'), hurt: q('.bt-hurt'),
        skill: q('.bt-skill'), skillCd: q('.bt-skill-cd'), skillRing: q('.bt-skill-ring circle'),
      };
      // 特殊スキルのボタン（レア以上のキャラ）
      const ch = C.CHARACTERS[this.self.char];
      this.cs = ch && ch.skill ? ch.skill : null;
      if (this.cs) {
        const b = this.el.skill;
        b.classList.remove('hidden');
        b.classList.toggle('passive', !!this.cs.passive);
        b.querySelector('.bt-skill-ic').innerHTML = A.skillButtonIcon(this.self.char);
        b.querySelector('.bt-skill-name').textContent = this.cs.passive ? '常時発動' : this.cs.name;
        b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.useSkill(); });
      }

      this.renderer = new DS.Renderer(this.el.canvas, this.stageIndex);
      this.resize();
      await this.renderer.load();
      if (!this.alive) return;

      if (this.isHost) {
        this.sim = new DS.Sim({ stageIndex: this.stageIndex, players: this.o.members, overwhelm: !!this.o.overwhelm });
        const p = this.sim.players.get(this.selfId);
        if (p) { this.me.x = p.x; this.me.y = p.y; }
      }
      if (this.session) {
        this.session.on('game', this.onGame);
        if (this.isHost) this.session.on('left', this.onLeft);
      }
      this.bindInput();
      this._lite = isLite();
      this._offSet = DS.settings ? DS.settings.onChange(() => {
        // 軽量化モードが変わったら、画面の細かさから作り直す
        if (this._lite !== isLite()) { this._lite = isLite(); this.renderer.lite = this._lite; this.resize(); } else this.applyLayout();
      }) : null;
      this.renderer.lite = this._lite;
      this.applyLayout();
      if (DS.sound) DS.sound.bgm('battle');
      this.el.loading.remove();
      this.banner(`STAGE ${this.stage.no}\n${this.stage.name}${this.o.overwhelm ? `\n圧倒モード：${owMin()}分でボス戦！` : ''}`, this.o.overwhelm ? 3200 : 2600);
      setTimeout(() => { const h = this.root && this.root.querySelector('.bt-hint'); if (h) h.classList.add('off'); }, 6000);
      this.raf = requestAnimationFrame(this.frame);
    }

    resize() {
      const r = this.root.getBoundingClientRect();
      this.renderer.resize(r.width, r.height, DS.settings ? DS.settings.dpr() : Math.min(2, window.devicePixelRatio || 1));
      this.applyLayout();
    }
    /** 設定（ボタンの大きさと配置）を画面に反映 */
    applyLayout() {
      if (!this.root) return;
      const st = DS.settings ? DS.settings.get() : {};
      const r = this.root.getBoundingClientRect();
      const W = r.width, H = r.height;
      const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
      const sk = this.el.skill, ss = 78 * (st.skillSize || 100) / 100;
      Object.assign(sk.style, { width: ss + 'px', height: ss + 'px', right: 'auto', bottom: 'auto',
        left: clamp((st.skillX != null ? st.skillX : 0.84) * W - ss / 2, 6, W - ss - 6) + 'px',
        top: clamp((st.skillY != null ? st.skillY : 0.8) * H - ss / 2, 120, H - ss - 30) + 'px' });
      sk.style.setProperty('--ic', ss / 78);
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
      this.hurtFlash = st.hurtFlash !== false;
    }

    /* ---------- 操作（ジョイスティック・キーボード） ---------- */
    bindInput() {
      const root = this.root;
      this._kd = (e) => {
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
      // ジョイスティックを元に戻す（指を離したのに届かなかったときなどに、動きっぱなしにならないように）
      this.resetJoy = () => {
        this.joy.id = null; this.joy.x = 0; this.joy.y = 0;
        if (this.joyFixed) this.el.knob.style.transform = 'translate(-50%,-50%)';
        else this.el.joy.classList.add('hidden');
      };
      canvas.addEventListener('pointerdown', (e) => {
        // 前の指の「離した」が届いていなかったら、新しくさわった指に切りかえる
        if (this.joy.id != null && this.joy.id !== e.pointerId) this.resetJoy();
        if (this.joy.id != null) return;
        const rb = root.getBoundingClientRect();
        this.joy.id = e.pointerId;
        if (this.joyFixed) {
          // 決まった場所のジョイスティック：中心からの向きで動く
          this.joy.ox = rb.left + this.joyHome.x; this.joy.oy = rb.top + this.joyHome.y;
        } else {
          this.joy.ox = e.clientX; this.joy.oy = e.clientY;
          this.el.joy.style.left = (e.clientX - rb.left) + 'px';
          this.el.joy.style.top = (e.clientY - rb.top) + 'px';
        }
        this.el.joy.classList.remove('hidden');
        this.el.knob.style.transform = 'translate(-50%,-50%)';
        try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
      });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerId !== this.joy.id) return;
        let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
        const R = this.joyR || 56;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        this.joy.x = dx / R; this.joy.y = dy / R;
        this.el.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      });
      const end = (e) => {
        if (e.pointerId !== this.joy.id) return;
        this.resetJoy();
      };
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
      canvas.addEventListener('lostpointercapture', end);
      // レベルアップ画面などが上に出ていても、指を離したことを必ず受け取る（画面全体で見る）
      this._pu = end;
      window.addEventListener('pointerup', this._pu, true);
      window.addEventListener('pointercancel', this._pu, true);
      // アプリを切りかえた・画面が隠れたときも止める
      this._blur = () => this.resetJoy();
      window.addEventListener('blur', this._blur);
      document.addEventListener('visibilitychange', this._blur);
      root.querySelector('.bt-menu').addEventListener('click', () => this.toggleMenu());
    }
    inputVec() {
      const k = this.keys;
      let x = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
      let y = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
      if (!x && !y) { x = this.joy.x; y = this.joy.y; }
      const d = Math.hypot(x, y);
      if (d > 1) { x /= d; y /= d; }
      return { x, y };
    }
    useSkill() {
      if (!this.cs || this.cs.passive || this.ended) return;
      if (this.isHost) this.sim.useSkill(this.selfId);
      else this.session.sendGame({ k: 'skill' });
    }
    moveSelf(dt) {
      const v = this.inputVec();
      const dash = this.speedBuff && this.cs && this.cs.spd ? 1 + this.cs.spd / 100 : 1;   // ダックのダッシュ
      const sp = GC.PLAYER.baseSpeed * (this.self.spd || 100) / 100 * dash;
      const r = GC.PLAYER.radius;
      this.me.x = Math.max(r, Math.min(GC.WORLD.w - r, this.me.x + v.x * sp * dt));
      this.me.y = Math.max(r, Math.min(GC.WORLD.h - r, this.me.y + v.y * sp * dt));
    }

    /* ---------- メインループ ---------- */
    frame(ts) {
      if (!this.alive) return;
      const now = ts / 1000;
      const dt = Math.min(0.05, now - (this.lastT || now));
      this.lastT = now;
      const view = this.isHost ? this.hostTick(dt, ts) : this.guestTick(dt, ts);
      // 軽量化モード：描くのは2回に1回（1秒30コマ）。計算と操作は毎回
      this._fc = (this._fc || 0) + 1;
      if (view && (!this._lite || this._fc % 2 === 0)) this.draw(view, now);
      this.raf = requestAnimationFrame(this.frame);
    }
    hostTick(dt, ts) {
      const sim = this.sim;
      const selfP = sim.players.get(this.selfId);
      const frozen = sim.paused || sim.ended || this.menuPaused;
      if (!frozen && selfP && !selfP.down) this.moveSelf(dt);
      const hv = this.renderer.halfView;
      sim.setPlayerPos(this.selfId, this.me.x, this.me.y, hv.vw, hv.vh);
      if (selfP) { this.me.x = selfP.x; this.me.y = selfP.y; }
      if (!frozen) {
        this.acc += dt;
        let n = 0;
        while (this.acc >= STEP && n < 5) { sim.step(STEP); this.acc -= STEP; n++; }
        if (n >= 5) this.acc = 0;
      } else if (sim.roulette && !this.menuPaused && !sim.ended) sim.stepRoulette(Math.min(dt, 0.1));   // ルーレットの時間だけ進める
      this.hostEvents();
      const snap = sim.snapshot();
      if (this.session && ts - this.lastSnap >= SNAP_MS) { this.lastSnap = ts; this.session.sendGame({ k: 's', s: packSnap(snap) }); }
      return snap;
    }
    guestTick(dt, ts) {
      const last = this.snaps[this.snaps.length - 1];
      if (!last) return null;
      const s = last.s;
      const selfP = s.P.find((p) => p[0] === this.selfId);
      const frozen = !!s.lu || !!s.rl || s.ph === 'win' || s.ph === 'lose' || (selfP && selfP[6]);
      if (!frozen) this.moveSelf(dt);
      if (ts - this.lastInput >= INPUT_MS) {
        this.lastInput = ts;
        const hv = this.renderer.halfView;
        this.session.sendGame({ k: 'in', x: Math.round(this.me.x), y: Math.round(this.me.y), vw: Math.round(hv.vw), vh: Math.round(hv.vh) });
      }
      return this.interpolate(performance.now() - INTERP_MS);
    }
    interpolate(rt) {
      const a = this.snaps;
      if (a.length < 2 || rt <= a[0].t) return a[0].s;
      let i = a.length - 2;
      while (i > 0 && a[i].t > rt) i--;
      const s0 = a[i], s1 = a[i + 1];
      if (rt >= s1.t) return s1.s;
      const k = (rt - s0.t) / (s1.t - s0.t);
      const lerp = (la, lb, id, xi, yi) => {
        const m = new Map(); for (const e of la) m.set(e[id], e);
        return lb.map((e) => {
          const o = m.get(e[id]);
          if (!o) return e;
          const n = e.slice(); n[xi] = o[xi] + (e[xi] - o[xi]) * k; n[yi] = o[yi] + (e[yi] - o[yi]) * k;
          return n;
        });
      };
      return Object.assign({}, s1.s, {
        P: lerp(s0.s.P, s1.s.P, 0, 2, 3), E: lerp(s0.s.E, s1.s.E, 0, 2, 3), K: lerp(s0.s.K, s1.s.K, 0, 2, 3),
        Q: lerp(s0.s.Q, s1.s.Q, 0, 2, 3), O: lerp(s0.s.O, s1.s.O, 5, 1, 2), BM: lerp(s0.s.BM || [], s1.s.BM || [], 0, 1, 2),
      });
    }

    /* ---------- 通信 ---------- */
    onGame(from, d) {
      if (!d || !this.alive) return;
      if (this.isHost) {
        if (d.k === 'in') this.sim.setPlayerPos(from, +d.x, +d.y, +d.vw, +d.vh);
        else if (d.k === 'pick') this.sim.choose(from, d.seq, d.i | 0);
        else if (d.k === 'skill') this.sim.useSkill(from);
        return;
      }
      if (d.k === 's') {
        this.snaps.push({ t: performance.now(), s: unpackSnap(d.s) });
        if (this.snaps.length > 8) this.snaps.shift();
      } else if (d.k === 'lvl') this.showLevelup(d.seq, d.opts);
      else if (d.k === 'ev') this.onEvent(d.e);
    }
    onLeft(m) {
      if (!this.sim) return;
      this.sim.removePlayer(m.id);
      this.banner(`${m.name} が退出しました`);
    }
    hostEvents() {
      const evs = this.sim.events;
      if (!evs.length) return;
      this.sim.events = [];
      for (const e of evs) {
        if (e.type === 'levelup') {
          const lu = this.sim.levelup;
          if (!lu) continue;
          Object.keys(lu.options).forEach((id) => {
            if (id === this.selfId) this.showLevelup(lu.seq, lu.options[id]);
            else if (this.session) this.session.sendGame({ k: 'lvl', seq: lu.seq, opts: lu.options[id] }, id);
          });
          continue;
        }
        if (this.session && e.type !== 'resume') this.session.sendGame({ k: 'ev', e });
        this.onEvent(e);
      }
    }
    onEvent(e) {
      const snd = { midboss: 'boss', rush: 'rush', bossWarp: 'alarm', boss: 'boss', down: 'down', revive: 'revive', skill: 'skill', suitRevive: 'revive' }[e.type];
      if (snd && DS.sound) DS.sound.play(snd);
      if (e.type === 'boss' && DS.sound) DS.sound.bgm('boss');
      switch (e.type) {
        case 'midboss': this.banner(`中ボス「${e.name || 'でかいゾンビ'}」出現！`, 2600, 'warn'); break;
        case 'rush': {
          const ro = GC.stageRoster(this.stageIndex);
          const names = [...new Set((ro.rush || []).map((t) => GC.ENEMIES[t] && GC.ENEMIES[t].name).filter(Boolean))];
          const who = names.length === 1 ? names[0] + 'の群れ' : names.length ? names.join('と') + 'の大群' : '敵の大群';
          this.banner(`ラッシュ！\n${who}が突撃してくる！`, 2800, 'warn'); break;
        }
        // v23：特殊スキルを使ったときの帯（「○○：スキル名！」）は出さない（画面の真ん中が見えにくくなるため）
        case 'skill': break;
        case 'midbossDown': this.banner(e.chest ? '中ボスを倒した！\n宝箱を開けると★が上がる！' : '中ボスを倒した！', 2600, 'good'); break;
        case 'roulette': this.showRoulette(e); break;
        case 'chest': {
          const u = e.ups && e.ups[this.selfId];
          let what = 'HPが回復した';
          if (u && u.kind !== 'heal') {
            // v30：2つ・3つ上がったときは全部
            what = (u.list || [u]).map((x) => { const d = x.kind === 'skill' ? GC.SKILLS[x.key] : GC.ABILITIES[x.key]; return `${d ? d.name : ''} ${starText(x.star)}`; }).join('\n');
          }
          if (e.roulette) { this.endRoulette(); this.banner(`${what}！`, 1500, 'good'); }
          else this.banner(`${e.id === this.selfId ? '' : e.name + ' が'}宝箱を開けた！\n${what}`, 2600, 'good');
          break;
        }
        case 'bossWarp': this.banner(`${this._ow ? owMin() : Math.round((GC.MATCH_REAL || GC.MATCH_SECONDS) / 60)}分経過！\n${e.sec || 5}秒後にボス戦の場所へワープ！`, 3200, 'warn low'); break;
        case 'boss': this.banner(`ボス戦！\nボス「${e.name}」出現！`, 3000, 'warn'); break;
        case 'warp': {
          // ボス戦の場所へワープ（自分の位置を合わせる）
          const pos = e.pos && e.pos[this.selfId];
          if (pos) { this.me.x = pos[0]; this.me.y = pos[1]; this.snaps = this.snaps.slice(-1); }
          this.banner(`ボス出現まで${e.wait || 10}秒！\n前の回復アイテムを取っておこう`, 3000, 'good low');
          if (DS.sound) DS.sound.play('heal');
          break;
        }
        case 'down': this.banner(`${e.name} がダウン！`, 2000, 'warn'); break;
        case 'revive': this.banner(`${e.name} が復活！`, 2000, 'good'); break;
        case 'suitRevive': this.banner(`${e.name}：不死の加護で復活！`, 2200, 'good'); break;
        case 'end': this.showResult(e.result); break;
        default: break;
      }
    }

    /* ---------- 描画・HUD ---------- */
    draw(view, now) {
      // 自分の位置は手元の値を使う（遅延なし）
      const P = view.P.map((p) => (p[0] === this.selfId ? Object.assign(p.slice(), { 2: this.me.x, 3: this.me.y }) : p));
      const v = Object.assign({}, view, { P });
      this.renderer.draw(v, this.me, now, this.selfId, this.names);
      this.mapTick = (this.mapTick || 0) + 1;
      if (this.mapTick % (this._lite ? 4 : 3) === 0) this.renderer.drawMinimap(this.el.map, v, this.me, this.selfId, this.renderer.halfView);
      this.hud(v);
    }
    hud(v) {
      const el = this.el;
      el.xp.style.width = Math.min(100, (v.xp / v.nd) * 100) + '%';
      el.lv.textContent = 'Lv ' + v.lv;
      el.time.textContent = mmss(v.tm);
      const ow = !!(v.ow || (v.ow == null && this.o.overwhelm));
      if (ow !== this._ow) { this._ow = ow; el.ow.classList.toggle('hidden', !ow); }
      el.phase.textContent = PHASE_LABEL[v.ph] || '';
      el.phase.classList.toggle('on', !!PHASE_LABEL[v.ph]);
      const me = v.P.find((p) => p[0] === this.selfId);
      if (me) {
        el.kills.textContent = '撃破 ' + fmt(me[8]);
        if (me[9] !== this.buildStr) { this.buildStr = me[9]; this.renderBuild(me[9]); }
        if (this.lastHp != null && me[4] < this.lastHp - 0.5) {
          if (this.hurtFlash) { el.hurt.classList.remove('on'); void el.hurt.offsetWidth; el.hurt.classList.add('on'); }
          if (DS.sound) DS.sound.play('hurt');
        }
        this.lastHp = me[4];
        el.down.classList.toggle('hidden', !me[6] || this.ended);
        this.speedBuff = !!(me[15] & 2);
        if (this.cs && !this.cs.passive) {
          const cd = me[13] || 0, act = me[14] || 0;
          const b = el.skill;
          b.classList.toggle('ready', cd <= 0 && !me[6]);
          b.classList.toggle('active', act > 0);
          el.skillCd.textContent = act > 0 ? Math.ceil(act) : cd > 0 ? Math.ceil(cd) : '';
          const ratio = cd > 0 ? 1 - cd / this.cs.cd : 1;
          el.skillRing.style.strokeDashoffset = String(289 * (1 - ratio));
        }
      }
      // ボスのゲージ
      if (v.boss) {
        const d = GC.BOSSES[v.boss[1]];
        el.boss.classList.remove('hidden');
        el.bossName.textContent = `${d.title}　${d.name}`;
        el.bossFill.style.width = Math.max(0, v.boss[2] / v.boss[3] * 100) + '%';
        el.bossHp.textContent = `${fmtBig(Math.max(0, v.boss[2]))} / ${fmtBig(v.boss[3])}`;
      } else el.boss.classList.add('hidden');
      // ワープまで・ボス出現までのカウントダウン
      const cnt = this.ended ? null : v.wp != null ? [v.wp, 'ボス戦の場所へワープ'] : v.altar ? [v.altar[3], 'ボス出現まで'] : null;
      if (cnt) {
        el.count.classList.remove('hidden');
        const sec = Math.max(1, Math.ceil(cnt[0]));
        if (sec !== this._lastCount) { this._lastCount = sec; if (DS.sound && sec <= 5) DS.sound.play('beep'); }
        el.count.innerHTML = `<b>${sec}</b><small>${cnt[1]}</small>`;
        el.count.classList.add('big');
      } else { el.count.classList.add('hidden'); this._lastCount = null; }
      // 宝箱のルーレット：カチカチ音／（結果が届かなかったときの）片づけ
      if (this.rlPlan && !this.rlDone) this.rouletteTick();
      if (!v.rl && !this.el.roul.classList.contains('hidden') && this.rlShownAt && performance.now() - this.rlShownAt > 2500) this.endRoulette();
      // レベルアップ待ち
      if (!v.lu && !this.el.lvl.classList.contains('hidden') && this.picked) this.el.lvl.classList.add('hidden');
      if (v.lu && this.picked && !this.el.lvl.classList.contains('hidden')) {
        const w = this.el.lvl.querySelector('.lv-wait');
        if (w) w.innerHTML = '仲間の選択を待っています…<br>' + v.lu.map((id) => `<span>${esc(this.names[id] || '')}</span>`).join('');
      }
    }
    renderBuild(str) {
      const b = parseBuild(str);
      const slot = (list, n) => Array.from({ length: n }, (_, i) => {
        const x = list[i];
        return x ? `<span class="bt-ic ${x.star >= (GC.EVO_STAR || 6) ? 'evo' : ''}">${A.skillIcon(x.key)}<i>${x.star >= (GC.EVO_STAR || 6) ? '<b>★</b>' : '★'.repeat(x.star)}</i></span>` : '<span class="bt-ic empty"></span>';
      }).join('');
      this.el.build.innerHTML = `<div>${slot(b.skills, GC.SLOTS.skills)}</div><div>${slot(b.abilities, GC.SLOTS.abilities)}</div>`;
    }
    banner(text, ms = 2200, cls = '') {
      const b = this.el.banner;
      b.textContent = text;
      b.className = 'bt-banner show ' + cls;
      clearTimeout(this._bt);
      this._bt = setTimeout(() => { b.className = 'bt-banner ' + (cls.includes('low') ? 'low' : ''); }, ms);
    }

    /* ---------- レベルアップ ---------- */
    showLevelup(seq, opts) {
      if (this.resetJoy) this.resetJoy();   // レベルアップ画面が出たら、ジョイスティックを離したことにする
      if (DS.sound) DS.sound.play('levelup');
      this.lvSeq = seq; this.picked = false;
      const el = this.el.lvl;
      el.classList.remove('hidden');
      el.innerHTML = `
        <div class="lv-title outline">LEVEL UP!</div>
        <div class="lv-sub">スキルかアビリティを1つ選ぼう（選び終わるまで時間は止まります）</div>
        <div class="lv-cards">${opts.map((o, i) => {
          const f = optInfo(o);
          return `<button class="lv-card ${o.kind} ${f.evo ? 'evo' : ''}" data-i="${i}">
            <span class="lv-icon">${f.icon}</span>
            <span class="lv-body">
              <span class="lv-head"><b>${esc(f.name)}</b><em>${f.tag}</em>${o.star === 1 && o.kind !== 'heal' && o.kind !== 'coins' ? '<strong>NEW</strong>' : ''}</span>
              ${o.kind === 'heal' || o.kind === 'coins' ? '' : `<span class="lv-stars">${starHtml(o.star)}</span>`}
              <span class="lv-desc">${esc(f.desc)}</span>
            </span></button>`;
        }).join('')}</div>`;
      el.querySelectorAll('.lv-card').forEach((b) => b.addEventListener('click', () => this.pick(+b.dataset.i)));
    }
    pick(i) {
      if (this.picked) return;
      this.picked = true;
      if (this.resetJoy) this.resetJoy();
      if (this.isHost) this.sim.choose(this.selfId, this.lvSeq, i);
      else this.session.sendGame({ k: 'pick', seq: this.lvSeq, i });
      this.el.lvl.innerHTML = '<div class="lv-title outline">LEVEL UP!</div><div class="lv-wait">仲間の選択を待っています…</div>';
    }

    /* ---------- 宝箱のルーレット ---------- */
    // 時間が止まっている間に、自分のスキル・アビリティが並んだリールが回って、★が上がるものが決まる
    // 結果はホストが先に決めている（e.plan）。止まる場所をそこに合わせて回す
    showRoulette(e) {
      if (this.resetJoy) this.resetJoy();
      const el = this.el.roul;
      clearTimeout(this.rlTimer);
      this.rlShownAt = performance.now(); this.rlDone = false; this.rlPlan = null; this.rlCell = -1;
      el.classList.remove('hidden', 'out');
      const pl = e.plan && e.plan[this.selfId];
      const who = e.id === this.selfId ? 'あなた' : e.name;
      const head = `<div class="rl-title outline">宝箱ルーレット！</div>
        <div class="rl-sub"><b>${esc(who)}</b> が宝箱を開けた！<br>${this.o.members.length > 1 ? '全員が' : ''}スキルかアビリティの★が上がる<small>（20%で2つ・10%で3つ！）</small></div>`;
      if (DS.sound) DS.sound.play('gachaOpen');
      if (!pl || !pl.cands) {
        el.innerHTML = `${head}<div class="rl-result show"><span class="rl-big">${A.skillIcon('heal')}</span><b>全部MAX！</b><span>HP 30%回復</span></div>`;
        this.rlDone = true;
        return;
      }
      const cands = pl.cands.map((c) => ({ kind: c[0] === 's' ? 'skill' : 'ability', key: c[1], star: c[2] }));
      // v30：2つ・3つ上がるときは、止まったあとにもう一度回る
      const picks = (pl.picks && pl.picks.length ? pl.picks : [pl.pick]).filter((i) => cands[i]);
      const n = cands.length, CW = 78;
      const loops = Math.max(8, Math.ceil(60 / n)) + picks.length;
      const items = [];
      for (let i = 0; i < loops; i++) cands.forEach((c) => items.push(c));
      const base = loops - 1 - picks.length;                 // 右にも並びが見えるように、最後の数周の手前で止まる
      const stops = picks.map((pk, j) => (base + j) * n + pk);
      el.innerHTML = `${head}
        <div class="rl-win"><div class="rl-strip">${items.map((c, i) => `<span class="rl-cell ${c.kind}" data-i="${i}">${A.skillIcon(c.key)}<i>${c.star >= (GC.EVO_STAR || 6) ? '' : '★' + c.star}</i></span>`).join('')}</div><i class="rl-mark"></i></div>
        <div class="rl-bonus"></div>
        <div class="rl-result ${picks.length > 1 ? 'multi' : ''}"></div>`;
      const strip = el.querySelector('.rl-strip'), win = el.querySelector('.rl-win');
      const W = win.clientWidth || 320;
      const posOf = (idx) => -(idx * CW + CW / 2 - W / 2);
      const spin = Math.max(2, ((GC.CHEST && GC.CHEST.roulette) || e.dur || 5) - 1.1);   // 止まってから約1秒は結果を見せる
      this.rlPlan = { cands, picks, stops, step: 0, strip, CW, W, posOf };
      strip.style.transition = 'none';
      strip.style.transform = `translateX(${W / 2 - CW / 2}px)`;
      void strip.offsetWidth;
      strip.style.transition = `transform ${spin}s cubic-bezier(.1, .62, .1, 1)`;
      strip.style.transform = `translateX(${posOf(stops[0])}px)`;
      this.rlTimer = setTimeout(() => this.landRoulette(), spin * 1000 + 30);
    }
    /** リールが1マス進むごとにカチッと鳴らす */
    rouletteTick() {
      const R = this.rlPlan;
      if (!R || !R.strip.isConnected) return;
      const m = getComputedStyle(R.strip).transform;
      const x = m && m !== 'none' ? parseFloat(m.split(',')[4]) : 0;
      const cell = Math.floor((R.W / 2 - x) / R.CW);
      if (cell !== this.rlCell) { this.rlCell = cell; if (DS.sound) DS.sound.play('tick'); }
    }
    /** 今のリールを止めて、結果を1つ出す。まだ残っていれば（2つ・3つのとき）もう一度回す。instant：すぐに全部止める */
    landRoulette(instant) {
      const R = this.rlPlan;
      if (!R || this.rlDone) return;
      clearTimeout(this.rlTimer);
      const idx = R.stops[R.step], c = R.cands[R.picks[R.step]];
      R.strip.style.transition = 'none';
      R.strip.style.transform = `translateX(${R.posOf(idx)}px)`;
      R.strip.querySelectorAll('.rl-cell.hit').forEach((x) => x.classList.remove('hit'));
      const cell = R.strip.querySelector(`.rl-cell[data-i="${idx}"]`);
      if (cell) cell.classList.add('hit');
      const next = Math.min(GC.EVO_STAR || 6, c.star + 1);
      const f = optInfo(Object.assign({}, c, { star: next }));
      const r = this.el.roul.querySelector('.rl-result');
      if (r) {
        r.insertAdjacentHTML('beforeend', `<div class="rl-row"><b>${esc(f.name)}</b><span class="rl-stars">${starHtml(c.star)}<em>→</em>${starHtml(next)}</span></div>`);
        r.classList.add('show');
      }
      if (DS.sound && !instant) DS.sound.play('levelup');
      R.step++;
      if (R.step >= R.picks.length) { this.rlDone = true; return; }
      if (instant) { this.landRoulette(true); return; }
      // もう1つ！
      const bonus = this.el.roul.querySelector('.rl-bonus');
      if (bonus) {
        bonus.textContent = R.step === 1 ? (R.picks.length >= 3 ? 'ラッキー！あと2つ★アップ！' : 'ラッキー！もう1つ★アップ！') : 'さらにもう1つ！';
        bonus.classList.remove('show'); void bonus.offsetWidth; bonus.classList.add('show');
      }
      if (DS.sound) DS.sound.play('gachaOpen');
      this.rlTimer = setTimeout(() => {
        if (!this.rlPlan || this.rlDone) return;
        R.strip.style.transition = 'transform 1s cubic-bezier(.2, .7, .2, 1)';
        R.strip.style.transform = `translateX(${R.posOf(R.stops[R.step])}px)`;
        this.rlTimer = setTimeout(() => this.landRoulette(), 1030);
      }, 500);
    }
    /** ルーレットを閉じる（ホストから結果が届いたとき） */
    endRoulette() {
      clearTimeout(this.rlTimer);
      if (this.rlPlan && !this.rlDone) this.landRoulette(true);
      this.rlPlan = null; this.rlShownAt = 0;
      const el = this.el.roul;
      el.classList.add('out');
      setTimeout(() => { if (el.classList.contains('out')) el.classList.add('hidden'); el.classList.remove('out'); }, 220);
    }

    /* ---------- メニュー ---------- */
    toggleMenu() {
      if (this.ended) return;
      if (this.resetJoy) this.resetJoy();
      const m = this.el.menu;
      if (!m.classList.contains('hidden')) { m.classList.add('hidden'); this.menuPaused = false; return; }
      const solo = !this.session;
      const quitLabel = this.isHost ? (solo ? 'あきらめる' : '試合を終了する（全員）') : 'ロビーから抜ける';
      m.innerHTML = `<div class="bt-menu-card">
        <div class="lv-title outline">${solo ? '一時停止' : 'メニュー'}</div>
        <p>${solo ? '' : '協力プレイ中は時間は止まりません。'}</p>
        <button class="btn btn-green btn-big" data-a="resume">つづける</button>
        <button class="btn btn-blue btn-big" data-a="settings">設定</button>
        <button class="btn btn-red btn-big" data-a="quit">${quitLabel}</button></div>`;
      m.classList.remove('hidden');
      this.menuPaused = solo;
      m.querySelector('[data-a=resume]').addEventListener('click', () => this.toggleMenu());
      m.querySelector('[data-a=settings]').addEventListener('click', () => DS.settings && DS.settings.open());
      m.querySelector('[data-a=quit]').addEventListener('click', () => {
        m.classList.add('hidden'); this.menuPaused = false;
        if (this.isHost) this.sim.finish(false);
        else if (this.o.onLeave) this.o.onLeave();
      });
    }

    /* ---------- 結果 ---------- */
    showResult(r) {
      if (this.ended) return;
      this.ended = true;
      this.el.lvl.classList.add('hidden'); this.el.menu.classList.add('hidden');
      this.el.down.classList.add('hidden'); this.el.count.classList.add('hidden');
      const mine = (r.stats && r.stats[this.selfId]) || { kills: 0, coins: 0 };
      const before = S.missionStatus();
      // v21：パーティーでクリアしたら、まだそのステージまで進んでいない人も「クリア」になる
      // （例：自分はステージ1まで、ホストのステージ3をクリア → 自分もステージ3までクリア）
      const cleared = r.win;
      const got = S.recordMatch({ win: cleared, stageKey: this.stage.key, kills: mine.kills, coins: (mine.coins || 0) + (mine.bonus || 0) }) || [];
      if (DS.sound) { DS.sound.bgm(null); DS.sound.play(r.win ? 'win' : 'lose'); }
      const unlockHtml = got.map((g) => {
        if (g.startsWith('filled:')) return `<div class="unlock">パーティーでクリアしたので、あなたも <b>STAGE ${this.stage.no} までクリア</b>になった！</div>`;
        if (g === 'fullRarity') return '<div class="unlock">装備ガチャで<b>エピック</b>も出るようになった！</div>';
        if (g === 'charTicket') return '<div class="unlock">キャラガチャ解放！<b>キャラガチャ10連無料チケット</b>を手に入れた！</div>';
        if (g === 'present') return '<div class="unlock">ロビー左上の<b>プレゼントボックス</b>に運営からのプレゼントが届いた！</div>';
        if (g.startsWith('level:')) return `<div class="unlock lvup">アカウントレベルが <b>Lv ${+g.slice(6)}</b> に上がった！</div>`;
        if (g.startsWith('stage:')) { const st = C.STAGES[+g.slice(6)]; return `<div class="unlock">STAGE ${st.no}「${esc(st.name)}」が遊べるようになった！</div>`; }
        return '';
      }).join('');
      const xpGot = got.find((g) => g.startsWith('xp:'));
      const acc = S.accountInfo();
      const after = S.missionStatus();
      const MC = GC.MISSIONS;
      const rows = Object.keys(r.stats || {}).map((id) => {
        const m = this.o.members.find((x) => x.id === id);
        const col = C.PLAYER_COLORS[m ? m.slot : 0];
        return `<tr${id === this.selfId ? ' class="me"' : ''}><td><i style="background:${col}"></i>${esc(this.names[id] || '')}</td><td>${fmt(r.stats[id].kills)}体</td></tr>`;
      }).join('');
      const dr = got.drops;
      const dropHtml = dr ? `<div class="rs-drops">
          <div class="rs-drops-title">ステージクリア報酬</div>
          <div class="rs-drop-row">
            <span class="rs-drop">${A.coin()}<b>+${fmt(dr.killCoins != null ? dr.killCoins : dr.coins)}</b><small>撃破数×${C.STAGE_DROPS.killCoin}</small></span>
            ${dr.clearCoins ? `<span class="rs-drop">${A.coin()}<b>+${fmt(dr.clearCoins)}</b><small>クリアボーナス</small></span>` : ''}
            ${dr.essence ? `<span class="rs-drop">${A.essence()}<b>+${fmt(dr.essence)}</b><small>エッセンス</small></span>` : ''}
            ${C.SLOTS.filter((sl) => dr.bp[sl.key]).map((sl) => `<span class="rs-drop">${A.blueprint(sl.key)}<b>×${dr.bp[sl.key]}</b><small>${sl.name}</small></span>`).join('')}
          </div>
          <div class="rs-drop-items">${dr.items.map((it) => `<span class="rs-drop-item">${U.itemCard(it.item, it.rarity, { cls: 'mini', isNew: it.isNew })}<small>${esc(C.ITEMS[it.item].name)}</small>${U.rarityLabel(it.rarity)}</span>`).join('')}</div>
        </div>` : '';
      const el = this.el.result;
      el.classList.remove('hidden');
      el.innerHTML = `<div class="rs-card ${r.win ? 'win' : 'lose'}">
        <div class="rs-title outline">${r.win ? 'STAGE CLEAR!' : 'GAME OVER'}</div>
        <div class="rs-stage">STAGE ${this.stage.no}　${esc(this.stage.name)}</div>
        <div class="rs-stats"><span><small>時間</small><b>${mmss(r.time)}</b></span><span><small>レベル</small><b>${r.level}</b></span><span><small>自分の撃破</small><b>${fmt(mine.kills)}</b></span></div>
        <table class="rs-table">${rows}</table>
        ${unlockHtml ? `<div class="unlocks">${unlockHtml}</div>` : ''}
        ${dropHtml}
        <div class="rs-rewards">
          ${xpGot ? `<div class="rs-acc"><span class="acc-lv">Lv ${acc.lv}</span>アカウント経験値 <b>+${fmt(+xpGot.slice(3))}</b><i class="acc-bar"><i style="width:${acc.max ? 100 : Math.round(acc.xp / acc.need * 100)}%"></i></i></div>` : ''}
          ${mine.coins ? `<div>${A.coin()}コイン獲得アビリティ <b>+${fmt(mine.coins)}</b></div>` : ''}
          ${mine.bonus ? `<div>${A.coin()}レベルアップのボーナス <b>+${fmt(mine.bonus)}</b></div>` : ''}
          ${cleared ? `<div class="m">ミッション：ステージクリア　<b>+${fmt(MC.stageClearReward)}</b> 受け取り可能</div>` : ''}
          <div class="m">ミッション：撃破（累計 ${fmt(after.kills)}体）${after.killN > before.killN ? `<b>+${fmt((after.killN - before.killN) * MC.killReward)}</b> 受け取り可能` : `次の報酬まであと${MC.killStep - after.killProgress}体`}</div>
          <div class="m">ミッションの報酬はロビーの「ミッション」で受け取れます</div>
        </div>
        <button class="btn btn-yellow btn-big rs-exit">${this.session ? 'ロビーに戻る' : 'ホームに戻る'}</button>
      </div>`;
      el.querySelector('.rs-exit').addEventListener('click', () => {
        const cb = this.o.onExit;
        const opened = got.find((g) => g.startsWith('stage:'));
        stop();
        if (cb) cb(r);
        // 新しいステージが遊べるようになったら、ロビーでそのステージを表示する
        if (opened && DS.lobby && DS.lobby.goToStage) DS.lobby.goToStage(+opened.slice(6));
      });
    }

    destroy() {
      this.alive = false;
      if (this._offSet) this._offSet();
      if (DS.sound) DS.sound.bgm('lobby');
      cancelAnimationFrame(this.raf);
      window.removeEventListener('keydown', this._kd);
      window.removeEventListener('keyup', this._ku);
      window.removeEventListener('resize', this._rs);
      if (this._pu) { window.removeEventListener('pointerup', this._pu, true); window.removeEventListener('pointercancel', this._pu, true); }
      if (this._blur) { window.removeEventListener('blur', this._blur); document.removeEventListener('visibilitychange', this._blur); }
      if (this.session) { this.session.off('game', this.onGame); this.session.off('left', this.onLeft); }
      if (this.root) this.root.remove();
    }
  }

  function start(o) {
    stop();
    current = new Battle(o);
    current.init();
    return current;
  }
  function stop() { if (current) { current.destroy(); current = null; } }

  DS.battle = { start, stop, get active() { return !!current; }, get current() { return current; } };

  // ロビーの「出撃」から呼ばれる
  DS.hooks = DS.hooks || {};
  DS.hooks.onGameStart = (p) => {
    start({
      stageIndex: p.stageIndex, members: p.members, selfId: p.selfId, isHost: p.isHost,
      session: p.session, onExit: p.onExit, onLeave: p.onLeave, overwhelm: !!p.overwhelm,
    });
    return true;
  };
})();

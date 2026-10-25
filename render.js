/* =========================================================
 *  render.js  ― バトル画面の描画（Canvas）
 *  上から見下ろした視点で、自分のキャラが画面の中心に来ます。
 * ========================================================= */
(function () {
  const GC = DS.gameConfig;
  const TAU = Math.PI * 2;
  const COLORS = DS.config.PLAYER_COLORS;
  // DS.Sim.PROJ_KINDS と同じ順番
  const PROJ_COLORS = {
    magic: '#ff7ad9', bone: '#f2efe4', seed: '#7a5a2b', stone: '#8b8f9c', ice: '#bfe9ff', fire: '#ff8a1e', soul: '#b98cff',
    fireMagic: '#ff3b3b', iceMagic: '#7fdcff', heal: '#5cf08a', snowball: '#ffffff', sand: '#e6c27a', bubble: '#8ff0ff',
    spore: '#d98cff', needle: '#c8f07a', petal: '#ff9ad5', poison: '#7ddc4a', gold: '#ffd23d', feather: '#fff6e0',
    dark: '#6b3fd4', laser: '#ff4a6a', blood: '#d6264a', darkMagic: '#9a5cff',
  };
  const RARITY_GLOW = { rare: [90, 174, 255], epic: [181, 108, 255], legend: [255, 210, 61], legendPlus: [255, 59, 59] };

  /* ---------- SVG → 画像 ---------- */
  function svgToCanvas(svg, w, h) {
    return new Promise((res) => {
      const img = new Image();
      const src = svg.replace('<svg ', `<svg width="${w}" height="${h}" `);
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c);
      };
      img.onerror = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; res(c); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
    });
  }
  function flipped(c) {
    const f = document.createElement('canvas');
    f.width = c.width; f.height = c.height;
    const x = f.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
    return f;
  }
  // 古いブラウザ向け：roundRect がなければ代わりを用意
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
    };
  }
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /* ---------- 地面のタイル（ステージごと） ---------- */
  const GROUND = {
    meadow:  { base: '#86d36a', alt: '#82cf66', edge: '#3d7a35' },
    desert:  { base: '#f3d48a', alt: '#f0cf82', edge: '#9a6a2a' },
    snow:    { base: '#eef6ff', alt: '#e8f2fd', edge: '#7a9cc0' },
    volcano: { base: '#5a3a3e', alt: '#56373b', edge: '#1e1015' },
    ruins:   { base: '#4f477a', alt: '#4b4375', edge: '#1b1438' },
  };
  const TILE = 128, TPX = 256;
  function makeTiles(stageKey) {
    const g = GROUND[stageKey] || GROUND.meadow;
    const tiles = [];
    for (let v = 0; v < 8; v++) {
      const c = document.createElement('canvas');
      c.width = c.height = TPX;
      const x = c.getContext('2d');
      const k = TPX / TILE;
      x.scale(k, k);
      x.fillStyle = v % 2 ? g.alt : g.base;
      x.fillRect(0, 0, TILE, TILE);
      const r = (i) => hash(v * 31 + i, i * 7 + v);
      x.lineCap = 'round'; x.lineJoin = 'round';
      if (stageKey === 'meadow') {
        x.strokeStyle = '#5fae4a'; x.lineWidth = 2.4;
        for (let i = 0; i < 5; i++) { const px = r(i) * 120 + 4, py = r(i + 9) * 120 + 4; x.beginPath(); x.moveTo(px - 4, py + 4); x.lineTo(px - 2, py - 4); x.moveTo(px, py + 4); x.lineTo(px + 1, py - 6); x.moveTo(px + 4, py + 4); x.lineTo(px + 5, py - 3); x.stroke(); }
        const fl = ['#ff6b8a', '#ffe066', '#fff'];
        for (let i = 0; i < 3; i++) { x.fillStyle = fl[i]; x.beginPath(); x.arc(r(i + 20) * 120 + 4, r(i + 30) * 120 + 4, 3, 0, TAU); x.fill(); }
        if (v === 3 || v === 6) { // 茂み
          x.fillStyle = '#3cb44b'; x.strokeStyle = '#231a3a'; x.lineWidth = 2.4;
          [[60, 64, 16], [46, 70, 11], [74, 70, 11]].forEach(([a, b, rr]) => { x.beginPath(); x.arc(a, b, rr, 0, TAU); x.fill(); x.stroke(); });
        }
      } else if (stageKey === 'desert') {
        x.strokeStyle = '#d9b060'; x.lineWidth = 2.4;
        for (let i = 0; i < 3; i++) { const py = r(i) * 110 + 8; x.beginPath(); x.moveTo(r(i + 3) * 40, py); x.quadraticCurveTo(60, py - 8, 120 - r(i + 6) * 30, py); x.stroke(); }
        if (v === 2 || v === 5) { x.fillStyle = '#43b05c'; x.strokeStyle = '#231a3a'; x.lineWidth = 2.4; x.beginPath(); x.roundRect(56, 40, 14, 44, 7); x.fill(); x.stroke(); x.beginPath(); x.roundRect(42, 52, 10, 20, 5); x.fill(); x.stroke(); }
        if (v === 7) { x.fillStyle = '#b9a07a'; x.strokeStyle = '#231a3a'; x.lineWidth = 2; x.beginPath(); x.ellipse(40, 90, 12, 8, 0, 0, TAU); x.fill(); x.stroke(); }
      } else if (stageKey === 'snow') {
        x.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(r(i) * 110 + 9, r(i + 4) * 110 + 9, 14, 6, 0, 0, TAU); x.fill(); }
        x.fillStyle = '#c9e6ff';
        for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(r(i + 10) * 124, r(i + 16) * 124, 1.8, 0, TAU); x.fill(); }
        if (v === 1 || v === 6) { x.fillStyle = '#2e7d5b'; x.strokeStyle = '#231a3a'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(64, 24); x.lineTo(84, 84); x.lineTo(44, 84); x.closePath(); x.fill(); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(64, 24); x.lineTo(72, 46); x.lineTo(56, 46); x.closePath(); x.fill(); }
      } else if (stageKey === 'volcano') {
        x.strokeStyle = '#ff7a2e'; x.lineWidth = 2.6;
        if (v % 3 === 0) { x.beginPath(); x.moveTo(10, r(1) * 120); x.lineTo(50, r(2) * 120); x.lineTo(70, r(3) * 120); x.lineTo(118, r(4) * 120); x.stroke(); }
        x.fillStyle = '#3e2529'; x.strokeStyle = '#231a3a'; x.lineWidth = 2;
        for (let i = 0; i < 2; i++) { x.beginPath(); x.ellipse(r(i + 7) * 110 + 9, r(i + 8) * 110 + 9, 10, 7, 0, 0, TAU); x.fill(); x.stroke(); }
        x.fillStyle = '#ffb347'; x.beginPath(); x.arc(r(30) * 124, r(31) * 124, 1.8, 0, TAU); x.fill();
      } else {
        x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2;
        x.strokeRect(2, 2, 60, 60); x.strokeRect(66, 2, 60, 60); x.strokeRect(2, 66, 60, 60); x.strokeRect(66, 66, 60, 60);
        if (v === 4) { x.fillStyle = '#7a6f9a'; x.strokeStyle = '#231a3a'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(52, 90); x.lineTo(52, 66); x.quadraticCurveTo(64, 54, 76, 66); x.lineTo(76, 90); x.closePath(); x.fill(); x.stroke(); }
        x.fillStyle = 'rgba(255,226,122,.5)'; x.beginPath(); x.arc(r(5) * 124, r(6) * 124, 1.6, 0, TAU); x.fill();
      }
      tiles.push(c);
    }
    return { tiles, g };
  }

  class Renderer {
    constructor(canvas, stageIndex) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.stageIndex = stageIndex || 0;
      const st = DS.config.STAGES[this.stageIndex] || DS.config.STAGES[0];
      this.stageKey = st.biome;
      this.roster = GC.stageRoster(this.stageIndex);
      this.seenFx = new Map();
      this.ground = makeTiles(this.stageKey);
    }

    async load() {
      const A = DS.art;
      const jobs = [];
      const add = (key, svg, w, h, flip) => jobs.push(svgToCanvas(svg, w, h).then((c) => { this.sp[key] = c; if (flip) this.sp[key + '_f'] = flipped(c); }));
      this.sp = {};
      // このステージで使う絵だけを用意する（雑魚はすべて、中ボスとボスはこのステージの分だけ）
      DS.Sim.ENEMY_TYPES.forEach((t) => {
        const d = GC.ENEMIES[t];
        if (d.midboss && t !== this.roster.midboss) return;
        add('e_' + t, A.enemySvg(t), d.midboss ? 256 : 128, d.midboss ? 256 : 128, true);
      });
      add('b_' + this.roster.boss, A.bossSvg(this.roster.boss), 320, 320, true);
      COLORS.forEach((c, i) => { add('h_' + i, A.hero(c), 120, 140, true); add('t_' + i, A.propSvg('tomb', c), 72, 84, false); });
      ['gear', 'bossGear', 'ball', 'drone', 'healDrone', 'bottle', 'meteor'].forEach((k) => add('p_' + k, A.propSvg(k), 96, k === 'bottle' ? 107 : 96, false));
      add('kunai', A.item('kunai'), 96, 96, false);
      Object.keys(DS.config.CHARACTERS).forEach((k) => add('c_' + k, A.charSvg(k, 'char-art', { aura: false }), 120, 140, false));
      add('box', A.boxSvg(), 72, 72, false);
      add('heal', A.healSvg(), 72, 72, false);
      await Promise.all(jobs);
    }

    resize(w, h, dpr) {
      this.w = w; this.h = h; this.dpr = dpr;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
      this.scale = Math.max(w, h) / GC.VIEW_LONG_SIDE;
    }
    get halfView() { return { vw: this.w / this.scale / 2, vh: this.h / this.scale / 2 }; }

    /**
     * view: snapshot 形式（P/E/K/Q/Z/O/X/boss/altar）
     * cam : { x, y } 画面中心のワールド座標
     */
    draw(view, cam, now, selfId, names) {
      const c = this.ctx, S = this.scale * this.dpr;
      const W = this.w, H = this.h;
      const hv = this.halfView;
      const L = cam.x - hv.vw, T = cam.y - hv.vh, R = cam.x + hv.vw, B = cam.y + hv.vh;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = this.ground.g.edge;
      c.fillRect(0, 0, this.cv.width, this.cv.height);
      c.setTransform(S, 0, 0, S, (W / 2 - cam.x * this.scale) * this.dpr, (H / 2 - cam.y * this.scale) * this.dpr);
      c.imageSmoothingEnabled = true;

      // ---- 地面 ----
      const WW = GC.WORLD.w, WH = GC.WORLD.h;
      const tx0 = Math.max(0, Math.floor(L / TILE)), tx1 = Math.min(WW / TILE - 1, Math.floor(R / TILE));
      const ty0 = Math.max(0, Math.floor(T / TILE)), ty1 = Math.min(WH / TILE - 1, Math.floor(B / TILE));
      for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = ty0; ty <= ty1; ty++) {
          const v = Math.floor(hash(tx, ty) * 8);
          c.drawImage(this.ground.tiles[v], tx * TILE, ty * TILE, TILE + 0.5, TILE + 0.5);
        }
      }
      // マップの端
      c.strokeStyle = '#231a3a'; c.lineWidth = 10;
      c.strokeRect(0, 0, WW, WH);
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.setLineDash([18, 14]);
      c.strokeRect(14, 14, WW - 28, WH - 28); c.setLineDash([]);

      // ---- ボスの祭壇 ----
      if (view.altar) this.drawAltar(view.altar, now);

      // ---- 地面の効果（電気・炎） ----
      for (const z of view.Z) this.drawZone(z, now);
      // ---- ボスの攻撃の予告（赤い円・突進の線） ----
      for (const w of view.W || []) if (w[1] !== 2) this.drawWarn(w, now, false);

      // ---- プレイヤーのまわりの効果 ----
      for (const p of view.P) {
        if (p[6]) continue;
        if (p[10]) this.drawGravity(p[2], p[3], p[10], now);
        if (p[11] & 1) this.ring(p[2], p[3], 160, 'rgba(140,220,255,.55)', now * 0.4);
        if (p[11] & 2) this.ring(p[2], p[3], 160, 'rgba(255,214,90,.55)', -now * 0.4);
      }

      // ---- ダンボールと回復アイテム ----
      for (const b of view.BX || []) {
        if (b[1] < L - 60 || b[1] > R + 60 || b[2] < T - 60 || b[2] > B + 60) continue;
        c.drawImage(this.sp.box, b[1] - 30, b[2] - 34, 60, 60);
      }
      for (const h of view.HL || []) {
        if (h[1] < L - 60 || h[1] > R + 60 || h[2] < T - 60 || h[2] > B + 60) continue;
        const bob = Math.sin(now * 4 + h[0]) * 4;
        c.fillStyle = 'rgba(255,90,110,.25)'; c.beginPath(); c.arc(h[1], h[2], 26 + Math.sin(now * 6) * 3, 0, TAU); c.fill();
        c.drawImage(this.sp.heal, h[1] - 22, h[2] - 26 + bob, 44, 44);
      }

      // ---- 敵（奥から順に） ----
      const ents = [];
      for (const e of view.E) if (e[2] > L - 200 && e[2] < R + 200 && e[3] > T - 200 && e[3] < B + 200) ents.push(e);
      ents.sort((a, b) => a[3] - b[3]);
      for (const e of ents) this.drawEnemy(e, view.boss);

      // ---- プレイヤー ----
      const ps = view.P.slice().sort((a, b) => a[3] - b[3]);
      for (const p of ps) this.drawPlayer(p, p[0] === selfId, names);

      // ---- 回る物・弾 ----
      for (const o of view.O) this.drawOrb(o, now);
      for (const w of view.W || []) if (w[1] === 2 || w[1] === 3) this.drawWarn(w, now, true);   // 落ちてくるメテオ・板
      for (const k of view.K) {
        if (k[1] === 3) { // ミニガンの弾
          c.save(); c.translate(k[2], k[3]); c.rotate(k[4]);
          c.strokeStyle = 'rgba(255,170,40,.55)'; c.lineWidth = 6; c.beginPath(); c.moveTo(-16, 0); c.lineTo(4, 0); c.stroke();
          c.strokeStyle = '#fff3a0'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(-12, 0); c.lineTo(5, 0); c.stroke();
          c.restore();
          continue;
        }
        if (k[1] === 0 || k[1] === 2) {
          const img = this.sp.kunai;
          c.save(); c.translate(k[2], k[3]); c.rotate(k[4] + 50 * Math.PI / 180);
          c.drawImage(img, -17, -17, 34, 34); c.restore();
        } else {
          c.fillStyle = '#ffe14d'; c.strokeStyle = '#231a3a'; c.lineWidth = 1.6;
          c.beginPath(); c.arc(k[2], k[3], 5, 0, TAU); c.fill(); c.stroke();
        }
      }
      for (const q of view.Q) {
        const col = PROJ_COLORS[DS.Sim.PROJ_KINDS[q[1]]] || '#fff';
        c.fillStyle = col; c.strokeStyle = '#231a3a'; c.lineWidth = 2.4;
        c.beginPath(); c.arc(q[2], q[3], q[4], 0, TAU); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(q[2] - q[4] * 0.3, q[3] - q[4] * 0.3, q[4] * 0.35, 0, TAU); c.fill();
      }

      // ---- エフェクト（一度見たものを短い間だけ表示） ----
      const SND = { 0: 'zap', 2: 'kill', 3: 'boss', 4: 'shot', 6: 'swing', 8: 'box', 9: 'heal', 11: 'swing', 12: 'boss', 15: 'zap', 16: 'revive', 18: 'boss', 19: 'zap', 20: 'click' };
      for (const f of view.X) {
        if (this.seenFx.has(f[0])) continue;
        this.seenFx.set(f[0], { f, t0: now });
        // 自分の近くで起きたことだけ音を鳴らす
        if (DS.sound && SND[f[1]] && Math.abs(f[2] - cam.x) < hv.vw + 80 && Math.abs(f[3] - cam.y) < hv.vh + 80) DS.sound.play(SND[f[1]]);
      }
      for (const [id, v] of this.seenFx) {
        const age = now - v.t0;
        if (age > 1.4) { this.seenFx.delete(id); continue; }
        this.drawFx(v.f, age, view.P);
      }

      // ---- 名前のピンとHPバー ----
      for (const p of ps) this.drawTag(p, p[0] === selfId, names);
      for (const e of ents) if (e[7]) this.drawEnemyBar(e);

      // ---- 画面外の仲間の矢印 ----
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      for (const p of view.P) {
        if (p[0] === selfId) continue;
        const sx = W / 2 + (p[2] - cam.x) * this.scale, sy = H / 2 + (p[3] - cam.y) * this.scale;
        if (sx > 10 && sx < W - 10 && sy > 10 && sy < H - 10) continue;
        this.edgePin(sx, sy, COLORS[p[1]], (names[p[0]] || '') + (p[6] ? '（ダウン）' : ''), W, H, p[6]);
      }
      if (view.altar) {
        const sx = W / 2 + (view.altar[0] - cam.x) * this.scale, sy = H / 2 + (view.altar[1] - cam.y) * this.scale;
        if (sx < 0 || sx > W || sy < 0 || sy > H) this.edgePin(sx, sy, '#ffd23d', 'ボスの祭壇', W, H, false, true);
      }
    }

    ring(x, y, r, col, rot) {
      const c = this.ctx;
      c.save(); c.translate(x, y); c.rotate(rot);
      c.strokeStyle = col; c.lineWidth = 3; c.setLineDash([10, 12]);
      c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke(); c.setLineDash([]); c.restore();
    }
    drawGravity(x, y, r, now) {
      const c = this.ctx;
      const g = c.createRadialGradient(x, y, 10, x, y, r);
      g.addColorStop(0, 'rgba(120,60,220,.35)'); g.addColorStop(1, 'rgba(120,60,220,.06)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(200,160,255,.7)'; c.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = now * 1.6 + i * TAU / 3;
        c.beginPath(); c.arc(x, y, r * (0.45 + 0.15 * i), a, a + 1.4); c.stroke();
      }
    }
    drawAltar(a, now) {
      const c = this.ctx, [x, y, r] = a;
      const pulse = 0.5 + 0.5 * Math.sin(now * 3);
      c.fillStyle = `rgba(255,210,61,${0.15 + 0.12 * pulse})`;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.strokeStyle = '#231a3a'; c.lineWidth = 8; c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      c.strokeStyle = '#ffd23d'; c.lineWidth = 4; c.setLineDash([22, 14]);
      c.save(); c.translate(x, y); c.rotate(now * 0.3); c.beginPath(); c.arc(0, 0, r - 2, 0, TAU); c.stroke(); c.restore(); c.setLineDash([]);
      c.fillStyle = '#7a6f9a'; c.strokeStyle = '#231a3a'; c.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const ang = i * TAU / 6;
        c.beginPath(); c.arc(x + Math.cos(ang) * (r - 30), y + Math.sin(ang) * (r - 30), 14, 0, TAU); c.fill(); c.stroke();
      }
      c.fillStyle = `rgba(255,240,180,${0.5 + 0.4 * pulse})`;
      c.beginPath(); c.arc(x, y, 26, 0, TAU); c.fill();
    }
    drawZone(z, now) {
      const c = this.ctx, [, kind, x, y, r, life] = z;
      const a = Math.min(1, life * 3);
      if (kind === 2) { // ブラックホール（破壊の力）
        const g = c.createRadialGradient(x, y, 0, x, y, r * 1.6);
        g.addColorStop(0, `rgba(0,0,0,${0.95 * a})`); g.addColorStop(0.45, `rgba(20,0,40,${0.9 * a})`);
        g.addColorStop(0.62, `rgba(120,50,220,${0.55 * a})`); g.addColorStop(0.8, `rgba(255,90,210,${0.3 * a})`); g.addColorStop(1, 'rgba(255,90,210,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.6, 0, TAU); c.fill();
        c.lineWidth = 3; c.lineCap = 'round';
        for (let i = 0; i < 4; i++) {   // うずまき
          const base = now * 3.2 + i * TAU / 4 + z[0];
          c.strokeStyle = i % 2 ? `rgba(255,140,230,${0.8 * a})` : `rgba(190,150,255,${0.8 * a})`;
          c.beginPath();
          for (let j = 0; j <= 14; j++) {
            const k = j / 14, ang = base + k * 2.6, rr = r * (1.5 - k * 1.1);
            const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.9;
            if (j) c.lineTo(px, py); else c.moveTo(px, py);
          }
          c.stroke();
        }
        c.lineCap = 'butt';
        c.fillStyle = `rgba(0,0,0,${a})`; c.beginPath(); c.arc(x, y, r * 0.42, 0, TAU); c.fill();
        c.strokeStyle = `rgba(255,170,240,${0.9 * a})`; c.lineWidth = 2.4; c.beginPath(); c.arc(x, y, r * 0.42, 0, TAU); c.stroke();
        return;
      }
      if (kind === 0) {
        c.fillStyle = `rgba(110,220,255,${0.22 * a})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        c.strokeStyle = `rgba(200,250,255,${0.9 * a})`; c.lineWidth = 2.4;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
        c.strokeStyle = `rgba(255,255,140,${a})`; c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const ang = (now * 7 + i * 2.1 + z[0]) % TAU;
          c.beginPath(); c.moveTo(x, y);
          for (let j = 1; j <= 4; j++) c.lineTo(x + Math.cos(ang + Math.sin(now * 20 + j) * 0.5) * r * j / 4, y + Math.sin(ang + Math.cos(now * 17 + j) * 0.5) * r * j / 4);
          c.stroke();
        }
      } else {
        const g = c.createRadialGradient(x, y, 4, x, y, r);
        g.addColorStop(0, `rgba(255,230,90,${0.75 * a})`); g.addColorStop(0.6, `rgba(255,120,30,${0.55 * a})`); g.addColorStop(1, `rgba(220,40,40,${0.12 * a})`);
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        c.fillStyle = `rgba(255,200,60,${0.85 * a})`;
        for (let i = 0; i < 5; i++) {
          const ang = i * TAU / 5 + z[0], rr = r * 0.55;
          const fy = Math.sin(now * 9 + i) * 4;
          c.beginPath(); c.ellipse(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr + fy, 5, 9, 0, 0, TAU); c.fill();
        }
      }
    }
    drawEnemy(e, boss) {
      const c = this.ctx;
      const [, ti, x, y, , flip, slow, , frozen] = e;
      if (ti === -1 && boss) {
        const d = GC.BOSSES[boss[1]];
        const img = this.sp['b_' + boss[1] + (flip ? '_f' : '')] || this.sp['b_' + boss[1]];
        const w = d.r * 2.7;
        if (img) c.drawImage(img, x - w / 2, y - w * 0.55, w, w);
        return;
      }
      const type = DS.Sim.ENEMY_TYPES[ti];
      const d = GC.ENEMIES[type];
      const img = this.sp['e_' + type + (flip ? '_f' : '')];
      const w = d.r * 2.9;
      if (img) c.drawImage(img, x - w / 2, y - w * 0.58, w, w);
      if (slow) { c.fillStyle = 'rgba(150,120,255,.25)'; c.beginPath(); c.arc(x, y, d.r, 0, TAU); c.fill(); }
      if (frozen) { // フロストブーツで凍った敵
        c.fillStyle = 'rgba(170,230,255,.55)'; c.strokeStyle = '#e8fbff'; c.lineWidth = 3;
        c.beginPath(); c.roundRect(x - d.r * 1.15, y - d.r * 1.6, d.r * 2.3, d.r * 2.3, 6); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - d.r * 0.7, y - d.r * 1.2); c.lineTo(x - d.r * 0.2, y - d.r * 0.4); c.stroke();
      }
    }
    /** ボスの攻撃の予告（0:衝撃 1:降ってくる攻撃 2:メテオ 9:突進の線） */
    /** サイコロ（cx, cy を中心に大きさ size、目 face） */
    drawDie(cx, cy, size, face, rot) {
      const c = this.ctx, h = size / 2;
      c.save(); c.translate(cx, cy); c.rotate(rot || 0);
      c.fillStyle = '#fff'; c.strokeStyle = '#231a3a'; c.lineWidth = Math.max(2, size / 14);
      c.beginPath(); c.roundRect(-h, -h, size, size, size * 0.2); c.fill(); c.stroke();
      const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
        5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[face] || [];
      c.fillStyle = face === 1 || face === 6 ? '#e8102e' : '#231a3a';
      for (const [px, py] of P) { c.beginPath(); c.arc(px * size * 0.26, py * size * 0.26, size * (face === 1 ? 0.15 : 0.09), 0, TAU); c.fill(); }
      c.restore();
    }
    drawWarn(w, now, top) {
      const c = this.ctx, [, kind, x, y, r, k] = w;
      if (kind === 3) { // アカギ：上から落ちてくる長方形とサイコロ
        const hh = w[6], face = w[7];
        if (!top) {
          c.fillStyle = `rgba(40,0,12,${0.12 + 0.32 * k})`; c.fillRect(x - r, y - hh, r * 2, hh * 2);
          c.strokeStyle = `rgba(255,59,59,${0.55 + 0.45 * Math.sin(now * 16)})`; c.lineWidth = 4; c.setLineDash([18, 10]);
          c.strokeRect(x - r, y - hh, r * 2, hh * 2); c.setLineDash([]);
          return;
        }
        const d = Math.max(0, (k - 0.3) / 0.7), e = d * d;
        if (d > 0) {
          const sc = 0.55 + 0.45 * e, sy = y - 560 * (1 - e);
          c.save(); c.translate(x, sy); c.scale(sc, sc); c.globalAlpha = 0.35 + 0.6 * d;
          c.fillStyle = '#17121c'; c.strokeStyle = '#c8102e'; c.lineWidth = 14;
          c.beginPath(); c.roundRect(-r, -hh, r * 2, hh * 2, 24); c.fill(); c.stroke();
          c.strokeStyle = '#ffd34d'; c.lineWidth = 3; c.beginPath(); c.roundRect(-r + 16, -hh + 16, r * 2 - 32, hh * 2 - 32, 14); c.stroke();
          c.globalAlpha = 1; c.restore();
          this.drawDie(x, sy, Math.min(r, hh) * 0.9 * sc, face, 0);
        }
        // 頭の上でサイコロが回る → 目が決まる
        const rolling = k < 0.45;
        const shown = rolling ? 1 + Math.floor((now * 14) % 6) : face;
        const pop = rolling ? 1 : 1 + 0.25 * Math.max(0, 1 - (k - 0.45) * 6);
        this.drawDie(x, y - 120 - (rolling ? Math.abs(Math.sin(now * 12)) * 16 : 0), 46 * pop, shown, rolling ? now * 9 : 0);
        return;
      }
      if (kind === 9) {
        const x2 = w[6], y2 = w[7];
        const a = Math.atan2(y2 - y, x2 - x), len = Math.hypot(x2 - x, y2 - y);
        c.save(); c.translate(x, y); c.rotate(a);
        c.fillStyle = `rgba(255,60,80,${0.15 + 0.2 * k})`; c.fillRect(0, -r * 0.8, len, r * 1.6);
        c.strokeStyle = `rgba(255,60,80,${0.5 + 0.5 * Math.sin(now * 20)})`; c.lineWidth = 4; c.setLineDash([16, 10]);
        c.strokeRect(0, -r * 0.8, len, r * 1.6); c.setLineDash([]);
        c.fillStyle = 'rgba(255,60,80,.8)';
        c.beginPath(); c.moveTo(len, 0); c.lineTo(len - 40, -30); c.lineTo(len - 40, 30); c.closePath(); c.fill();
        c.restore();
        return;
      }
      if (kind === 2) { // メテオ（プレイヤーの攻撃）
        c.fillStyle = `rgba(255,190,80,${0.15 + 0.25 * k})`; c.beginPath(); c.arc(x, y, r * (0.4 + 0.6 * k), 0, TAU); c.fill();
        const fy = y - 520 * (1 - k), fx = x + 260 * (1 - k);
        const img = this.sp.p_meteor;
        if (img) { c.save(); c.translate(fx, fy); c.rotate(-0.5); c.drawImage(img, -40, -40, 80, 80); c.restore(); }
        return;
      }
      const col = kind === 0 ? '255,60,80' : '255,150,40';
      c.fillStyle = `rgba(${col},${0.12 + 0.18 * k})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      c.fillStyle = `rgba(${col},${0.25 + 0.2 * k})`; c.beginPath(); c.arc(x, y, r * k, 0, TAU); c.fill();
      c.strokeStyle = `rgba(${col},${0.6 + 0.4 * Math.sin(now * 18)})`; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke();
      if (kind === 1) { // 上から落ちてくる
        const fy = y - 300 * (1 - k);
        c.fillStyle = `rgba(${col},.9)`; c.strokeStyle = '#231a3a'; c.lineWidth = 2.5;
        c.beginPath(); c.arc(x, fy, 12, 0, TAU); c.fill(); c.stroke();
      }
    }
    drawEnemyBar(e) {
      const c = this.ctx, [, ti, x, y, hp] = e;
      const r = ti === -1 ? 0 : GC.ENEMIES[DS.Sim.ENEMY_TYPES[ti]].r;
      if (!r) return;
      const w = 90, yy = y - r * 1.75;
      c.fillStyle = '#231a3a'; c.fillRect(x - w / 2 - 2, yy - 2, w + 4, 11);
      c.fillStyle = '#ff4a5e'; c.fillRect(x - w / 2, yy, w * hp / 100, 7);
    }
    drawPlayer(p, isMe) {
      const c = this.ctx;
      const [, slot, x, y, , , down, revive] = p;
      if (down) {
        c.fillStyle = 'rgba(255,255,255,.12)';
        c.beginPath(); c.arc(x, y, GC.PLAYER.reviveRadius, 0, TAU); c.fill();
        c.strokeStyle = COLORS[slot]; c.lineWidth = 3; c.setLineDash([8, 8]);
        c.beginPath(); c.arc(x, y, GC.PLAYER.reviveRadius, 0, TAU); c.stroke(); c.setLineDash([]);
        if (revive > 0) {
          c.strokeStyle = '#3ddc84'; c.lineWidth = 7;
          c.beginPath(); c.arc(x, y, GC.PLAYER.reviveRadius, -Math.PI / 2, -Math.PI / 2 + TAU * revive); c.stroke();
        }
        c.drawImage(this.sp['t_' + slot], x - 22, y - 34, 44, 51);
        return;
      }
      const ch = p[12];
      const img = (ch && this.sp['c_' + ch]) || this.sp['h_' + slot];
      const buff = p[15] || 0;
      if (buff & 4) { // ファストドロー
        c.fillStyle = 'rgba(255,214,90,.35)'; c.beginPath(); c.arc(x, y - 10, 46, 0, TAU); c.fill();
      }
      if (buff & 2) { // ダッシュ
        c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4; c.lineCap = 'round';
        for (let i = 0; i < 3; i++) { const yy = y - 30 + i * 16; c.beginPath(); c.moveTo(x - 40 - i * 6, yy); c.lineTo(x - 58 - i * 10, yy); c.stroke(); }
      }
      // レアリティが高いキャラほど強そうなオーラ
      const glow = ch && RARITY_GLOW[(DS.config.CHARACTERS[ch] || {}).rarity];
      if (glow) {
        const t = performance.now() / 1000, rar = DS.config.CHARACTERS[ch].rarity;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);
        const big = rar === 'legend' || rar === 'legendPlus', R0 = rar === 'legendPlus' ? 64 : big ? 58 : 46;
        const g = c.createRadialGradient(x, y - 14, 6, x, y - 14, R0);
        g.addColorStop(0, `rgba(${glow},${rar === 'rare' ? 0.18 : 0.4 + 0.15 * pulse})`); g.addColorStop(1, `rgba(${glow},0)`);
        c.fillStyle = g; c.beginPath(); c.arc(x, y - 14, R0, 0, TAU); c.fill();
        c.strokeStyle = `rgba(${glow},${0.55 + 0.3 * pulse})`; c.lineWidth = big ? 3.5 : 2.5;
        c.beginPath(); c.ellipse(x, y + 18, 26, 8, 0, 0, TAU); c.stroke();
        if (rar === 'legendPlus') { // 赤い炎が立ちのぼる
          for (let i = 0; i < 6; i++) {
            const k = (t * 0.9 + i / 6) % 1, px = x + Math.sin(i * 2.1 + t * 2) * 24, py = y + 16 - k * 70;
            c.fillStyle = `rgba(255,${80 + 120 * k | 0},${80 + 100 * k | 0},${0.85 * (1 - k)})`;
            c.beginPath(); c.arc(px, py, 4.5 * (1 - k) + 1.5, 0, TAU); c.fill();
          }
        }
        if (big) {
          c.fillStyle = rar === 'legendPlus' ? 'rgba(255,214,214,.95)' : 'rgba(255,246,194,.9)';
          for (let i = 0; i < 4; i++) {
            const a = t * 1.6 + i * TAU / 4, rr = 34 + 4 * Math.sin(t * 4 + i);
            c.beginPath(); c.arc(x + Math.cos(a) * rr, y - 14 + Math.sin(a) * rr * 0.9, 2.6, 0, TAU); c.fill();
          }
        }
      }
      if (buff & 32) { // レザーベルト：攻撃力アップ中
        const t = performance.now() / 1000;
        c.strokeStyle = `rgba(255,120,60,${0.55 + 0.3 * Math.sin(t * 8)})`; c.lineWidth = 3;
        c.beginPath(); c.ellipse(x, y + 18, 30, 9, 0, 0, TAU); c.stroke();
        c.fillStyle = 'rgba(255,140,60,.18)'; c.beginPath(); c.arc(x, y - 12, 42, 0, TAU); c.fill();
      }
      if (buff & 16) { // デュアルリボルバー
        c.fillStyle = 'rgba(255,236,150,.35)'; c.beginPath(); c.arc(x, y - 10, 44, 0, TAU); c.fill();
      }
      if (buff & 8) { // 鎧のシールド：体が青白く光る
        const t = performance.now() / 1000, pl = 0.5 + 0.5 * Math.sin(t * 3.2);
        const g = c.createRadialGradient(x, y - 14, 8, x, y - 14, 50);
        g.addColorStop(0, `rgba(235,248,255,${0.55 + 0.2 * pl})`); g.addColorStop(0.6, `rgba(150,215,255,${0.3 + 0.15 * pl})`); g.addColorStop(1, 'rgba(120,200,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y - 14, 50, 0, TAU); c.fill();
      }
      c.drawImage(img, x - 31, y - 52, 62, 72);
      if (buff & 8) { // 鎧のシールド（青白い六角形のバリア）
        const t = performance.now() / 1000;
        c.save();
        c.shadowColor = 'rgba(170,225,255,.95)'; c.shadowBlur = 14;
        c.strokeStyle = `rgba(225,245,255,${0.7 + 0.25 * Math.sin(t * 4)})`; c.lineWidth = 3.5;
        c.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + t * 0.6; const px = x + Math.cos(a) * 44, py = y - 12 + Math.sin(a) * 44; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
        c.closePath(); c.stroke();
        c.fillStyle = 'rgba(200,235,255,.12)'; c.fill();
        c.restore();
      }
      if (buff & 1) { // 無敵
        const t = performance.now() / 1000;
        c.fillStyle = 'rgba(120,200,255,.25)'; c.strokeStyle = `rgba(160,230,255,${0.7 + 0.3 * Math.sin(t * 10)})`; c.lineWidth = 4;
        c.beginPath(); c.arc(x, y - 12, 50, 0, TAU); c.fill(); c.stroke();
      }
      if (isMe) {
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2.5;
        c.beginPath(); c.ellipse(x, y + 18, 24, 7, 0, 0, TAU); c.stroke();
      }
    }
    drawTag(p, isMe, names) {
      const c = this.ctx;
      const [id, slot, x, y, hp, maxHp, down] = p;
      // HPバー
      if (!down) {
        const w = 52, yy = y + 26;
        c.fillStyle = '#231a3a'; c.fillRect(x - w / 2 - 2, yy - 2, w + 4, 10);
        c.fillStyle = isMe ? '#3ddc84' : COLORS[slot]; c.fillRect(x - w / 2, yy, w * Math.max(0, hp / maxHp), 6);
      }
      // 名前のピン
      const name = (names[id] || '') + (isMe ? '' : '');
      c.font = '900 13px "M PLUS Rounded 1c", sans-serif';
      const tw = c.measureText(name).width + 16;
      const yy = y - (down ? 52 : 70);
      c.fillStyle = COLORS[slot]; c.strokeStyle = '#231a3a'; c.lineWidth = 3;
      c.beginPath(); c.roundRect(x - tw / 2, yy - 11, tw, 22, 11); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x - 6, yy + 10); c.lineTo(x, yy + 18); c.lineTo(x + 6, yy + 10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = COLORS[slot]; c.fillRect(x - 5, yy + 8, 10, 4);
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeText(name, x, yy + 1); c.fillText(name, x, yy + 1);
    }
    drawOrb(o, now) {
      const c = this.ctx, [kind, x, y, r] = o;
      if (kind === 0 || kind === 3) {
        const img = this.sp[kind === 0 ? 'p_gear' : 'p_bossGear'];
        const s = r * 2 * 48 / 42;
        c.save(); c.translate(x, y); c.rotate(now * (kind === 0 ? 5 : -4)); c.drawImage(img, -s / 2, -s / 2, s, s); c.restore();
      } else if (kind === 1) {
        const s = r * 2 * 48 / 42;
        c.save(); c.translate(x, y); c.rotate(now * 6); c.drawImage(this.sp.p_ball, -s / 2, -s / 2, s, s); c.restore();
      } else if (kind === 2) {
        if (o[6] != null) {
          c.strokeStyle = 'rgba(80,230,255,.9)'; c.lineWidth = 3;
          c.setLineDash([6, 10]); c.lineDashOffset = -now * 200;
          c.beginPath(); c.moveTo(x, y); c.lineTo(o[6], o[7]); c.stroke(); c.setLineDash([]);
          const miss = o[8] ? 34 : 4;   // 外れた弾は大きくそれる
          c.fillStyle = 'rgba(255,255,160,.9)'; c.beginPath(); c.arc(o[6] + Math.sin(now * 50) * miss, o[7] + Math.cos(now * 43) * miss, 4, 0, TAU); c.fill();
        }
        c.drawImage(this.sp.p_drone, x - 18, y - 18, 36, 36);
      } else if (kind === 4) {
        c.save(); c.translate(x, y); c.rotate(now * 10); c.drawImage(this.sp.p_bottle, -12, -14, 24, 27); c.restore();
      } else if (kind === 5) { // キティースの回復ドローン
        c.drawImage(this.sp.p_healDrone, x - 17, y - 17, 34, 34);
      }
    }
    drawFx(f, age, P) {
      const c = this.ctx, [, k, x, y, r, tx, ty, o] = f;
      if (k === 0) { // 雷
        const a = 1 - age / 0.35;
        if (a <= 0) return;
        c.strokeStyle = `rgba(255,255,170,${a})`; c.lineWidth = 6;
        c.beginPath(); let yy = y - 420; c.moveTo(x, yy);
        let i = 0;
        while (yy < y) { yy += 50; c.lineTo(x + (hash(f[0], i++) - 0.5) * 50, Math.min(y, yy)); }
        c.stroke();
        c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 2; c.stroke();
        c.fillStyle = `rgba(255,255,180,${a * 0.6})`; c.beginPath(); c.arc(x, y, 34, 0, TAU); c.fill();
      } else if (k === 2 || k === 3) { // 撃破
        const dur = k === 3 ? 0.6 : 0.3, a = 1 - age / dur;
        if (a <= 0) return;
        const rr = (r || 16) * (1 + age * (k === 3 ? 6 : 3));
        c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = k === 3 ? 10 : 4;
        c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
      } else if (k === 4) { // リボルバーの弾道
        const a = 1 - age / 0.18;
        if (a <= 0) return;
        c.strokeStyle = `rgba(255,236,150,${a})`; c.lineWidth = 4;
        c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke();
        c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.arc(tx, ty, 9 * a + 4, 0, TAU); c.fill();
      } else if (k === 5) { // 矢の雨
        const a = 1 - age / 0.45;
        if (a <= 0) return;
        const fall = Math.min(1, age / 0.2);
        const ay = y - 120 * (1 - fall);
        c.strokeStyle = `rgba(255,240,200,${a})`; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x + 18, ay - 40); c.lineTo(x, ay); c.stroke();
        c.fillStyle = `rgba(255,210,61,${a})`; c.beginPath(); c.moveTo(x, ay); c.lineTo(x + 2, ay - 12); c.lineTo(x + 9, ay - 8); c.closePath(); c.fill();
      } else if (k === 6) { // ライトセイバー：向いている方向に90度の斬撃（今いる位置について回る）
        const dur = 0.24, a = 1 - age / dur;
        if (a <= 0) return;
        let cx = x, cy = y;
        const pl = P && P.find((q) => q[1] === o);
        if (pl) { cx = pl[2]; cy = pl[3]; }
        const arc = GC.SKILL_PARAMS.lightsaber.arc;
        const sweep = Math.min(1, age / (dur * 0.7)) * arc;
        const start = (f[8] || 0) - arc / 2;
        c.save(); c.translate(cx, cy - 8);
        c.fillStyle = `rgba(95,233,255,${0.22 * a})`;
        c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, start, start + sweep); c.closePath(); c.fill();
        c.strokeStyle = `rgba(220,255,255,${a})`; c.lineWidth = 6;
        c.beginPath(); c.arc(0, 0, r - 4, start + Math.max(0, sweep - 2.2), start + sweep); c.stroke();
        c.strokeStyle = `rgba(63,224,255,${0.7 * a})`; c.lineWidth = 14;
        c.beginPath(); c.arc(0, 0, r - 4, start + Math.max(0, sweep - 1.2), start + sweep); c.stroke();
        c.restore();
      } else if (k === 11) { // 大回転斬り（ライトセイバーのパッシブ）
        const dur = 0.45, a = 1 - age / dur;
        if (a <= 0) return;
        let cx = x, cy = y;
        const pl = P && P.find((q) => q[1] === o);
        if (pl) { cx = pl[2]; cy = pl[3]; }
        const sweep = Math.min(1, age / (dur * 0.7)) * TAU;
        c.save(); c.translate(cx, cy - 8);
        c.fillStyle = `rgba(95,233,255,${0.25 * a})`; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
        c.strokeStyle = `rgba(220,255,255,${a})`; c.lineWidth = 9;
        c.beginPath(); c.arc(0, 0, r - 6, sweep - 2.4, sweep); c.stroke();
        c.strokeStyle = `rgba(63,224,255,${0.7 * a})`; c.lineWidth = 20;
        c.beginPath(); c.arc(0, 0, r - 6, sweep - 1.2, sweep); c.stroke();
        c.restore();
      } else if (k === 12 || k === 14) { // メテオの着弾・爆発
        const dur = k === 12 ? 0.6 : 0.4, a = 1 - age / dur;
        if (a <= 0) return;
        const rr = (r || 40) * (0.6 + age / dur * 0.6);
        const g = c.createRadialGradient(x, y, 4, x, y, rr);
        g.addColorStop(0, `rgba(255,250,200,${a})`); g.addColorStop(0.5, `rgba(255,150,40,${0.8 * a})`); g.addColorStop(1, `rgba(220,40,40,0)`);
        c.fillStyle = g; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
        c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 5; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.stroke();
      } else if (k === 13) { // ボスの瞬間移動・手下を呼ぶ煙
        const a = 1 - age / 0.5;
        if (a <= 0) return;
        c.fillStyle = `rgba(185,140,255,${0.5 * a})`;
        for (let i = 0; i < 8; i++) {
          const ang = i * TAU / 8 + f[0], d = (r || 60) * (0.4 + age * 1.6);
          c.beginPath(); c.arc(x + Math.cos(ang) * d, y - 20 + Math.sin(ang) * d * 0.7, 18 * a + 6, 0, TAU); c.fill();
        }
      } else if (k === 15 || k === 16) { // シールドで防いだ・復活
        const a = 1 - age / 0.6;
        if (a <= 0) return;
        let cx = x, cy = y;
        const pl = P && P.find((q) => q[1] === o);
        if (pl) { cx = pl[2]; cy = pl[3]; }
        c.strokeStyle = k === 15 ? `rgba(255,230,120,${a})` : `rgba(120,255,200,${a})`; c.lineWidth = 6;
        c.beginPath(); c.arc(cx, cy - 12, 44 + age * 70, 0, TAU); c.stroke();
        if (k === 16) { c.fillStyle = `rgba(255,255,255,${a * 0.5})`; c.beginPath(); c.arc(cx, cy - 12, 60, 0, TAU); c.fill(); }
      } else if (k === 18) { // アカギの長方形が落ちた
        const a = 1 - age / 0.9, hh = tx, face = ty;
        if (a <= 0) return;
        c.fillStyle = `rgba(255,${age < 0.08 ? 255 : 80},${age < 0.08 ? 255 : 80},${a * 0.5})`; c.fillRect(x - r, y - hh, r * 2, hh * 2);
        c.strokeStyle = `rgba(255,59,59,${a})`; c.lineWidth = 10; c.strokeRect(x - r - age * 40, y - hh - age * 40, (r + age * 40) * 2, (hh + age * 40) * 2);
        c.strokeStyle = `rgba(35,10,20,${a})`; c.lineWidth = 3;
        for (let i = 0; i < 10; i++) {
          const ang = hash(f[0], i) * TAU, len = 60 + hash(f[0], i + 20) * 140;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len * 0.5 + 10, y + Math.sin(ang) * len * 0.5); c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); c.stroke();
        }
        c.globalAlpha = a; this.drawDie(x, y - 30 * age, 70, face, 0); c.globalAlpha = 1;
        c.font = '900 34px "M PLUS Rounded 1c", sans-serif'; c.textAlign = 'center';
        c.lineWidth = 6; c.strokeStyle = `rgba(35,26,58,${a})`; c.fillStyle = face >= 5 ? `rgba(255,214,61,${a})` : `rgba(255,255,255,${a})`;
        const txt = `×${face}`; c.strokeText(txt, x, y + 70 - age * 30); c.fillText(txt, x, y + 70 - age * 30);
      } else if (k === 19) { // 破壊の力：ブラックホールを撃つ光
        const a = 1 - age / 0.3;
        if (a <= 0) return;
        c.strokeStyle = `rgba(190,120,255,${a})`; c.lineWidth = 7; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x, y); c.lineTo(tx, ty); c.stroke();
        c.strokeStyle = `rgba(255,220,250,${a})`; c.lineWidth = 2.4; c.stroke(); c.lineCap = 'butt';
      } else if (k === 20) { // ハイブーツ：攻撃を見切った
        const a = 1 - age / 0.7;
        if (a <= 0) return;
        let cx = x, cy = y;
        const pl = P && P.find((q) => q[1] === o);
        if (pl) { cx = pl[2]; cy = pl[3]; }
        c.font = '900 18px "M PLUS Rounded 1c", sans-serif'; c.textAlign = 'center';
        c.lineWidth = 4; c.strokeStyle = `rgba(35,26,58,${a})`; c.fillStyle = `rgba(160,240,255,${a})`;
        c.strokeText('MISS', cx, cy - 58 - age * 30); c.fillText('MISS', cx, cy - 58 - age * 30);
      } else if (k === 17) { // フロストブーツの凍結ビーム
        const a = 1 - age / 0.35;
        if (a <= 0) return;
        c.strokeStyle = `rgba(160,230,255,${a})`; c.lineWidth = 5;
        c.beginPath(); c.moveTo(tx, ty - 10); c.lineTo(x, y - 10); c.stroke();
        c.fillStyle = `rgba(220,250,255,${a})`; c.beginPath(); c.arc(x, y - 10, 26 * a + 8, 0, TAU); c.fill();
      } else if (k === 7) { // アローレインの範囲
        const a = 1 - age / 0.6;
        if (a <= 0) return;
        c.strokeStyle = `rgba(255,214,90,${a})`; c.lineWidth = 6;
        c.beginPath(); c.arc(x, y, r * Math.min(1, age / 0.25), 0, TAU); c.stroke();
      } else if (k === 8) { // ダンボールが壊れた
        const a = 1 - age / 0.45;
        if (a <= 0) return;
        c.fillStyle = `rgba(201,138,74,${a})`; c.strokeStyle = `rgba(35,26,58,${a})`; c.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const ang = i * TAU / 6 + f[0], d = 10 + age * 140;
          c.save(); c.translate(x + Math.cos(ang) * d, y - 10 + Math.sin(ang) * d + age * age * 200); c.rotate(age * 8 + i);
          c.fillRect(-6, -5, 12, 10); c.strokeRect(-6, -5, 12, 10); c.restore();
        }
      } else if (k === 9) { // 回復
        const a = 1 - age / 0.8;
        if (a <= 0) return;
        let cx = x, cy = y;
        const pl = P && P.find((q) => q[1] === o);
        if (pl) { cx = pl[2]; cy = pl[3]; }
        c.fillStyle = `rgba(80,230,120,${a})`;
        c.font = '900 22px sans-serif'; c.textAlign = 'center';
        for (let i = 0; i < 4; i++) c.fillText('✚', cx + (i - 1.5) * 18, cy - 40 - age * 60 - (i % 2) * 10);
      } else if (k === 10) { // 回復ドローンの弾
        const dur = 0.35, a = 1 - age / dur;
        if (a <= 0) return;
        let tx2 = tx, ty2 = ty;
        const pl = P && P.find((q) => q[1] === o);
        if (pl) { tx2 = pl[2]; ty2 = pl[3] - 12; }
        const k2 = Math.min(1, age / 0.18);
        const bx = x + (tx2 - x) * k2, by = y + (ty2 - y) * k2;
        c.fillStyle = `rgba(92,240,138,${a})`; c.beginPath(); c.arc(bx, by, 6, 0, TAU); c.fill();
        c.fillStyle = `rgba(255,255,255,${a})`; c.beginPath(); c.arc(bx, by, 2.6, 0, TAU); c.fill();
        if (k2 >= 1) { c.strokeStyle = `rgba(92,240,138,${a})`; c.lineWidth = 3; c.beginPath(); c.arc(tx2, ty2 + 12, 22 * (1.4 - a), 0, TAU); c.stroke(); }
      }
    }
    edgePin(sx, sy, color, label, W, H, down, star) {
      const c = this.ctx;
      const cx = W / 2, cy = H / 2;
      const ang = Math.atan2(sy - cy, sx - cx);
      const m = 34, top = 150, bottom = 60;
      let px = cx + Math.cos(ang) * 2000, py = cy + Math.sin(ang) * 2000;
      const kx = Math.cos(ang) > 0 ? (W - m - cx) / (px - cx) : (m - cx) / (px - cx);
      const ky = Math.sin(ang) > 0 ? (H - bottom - cy) / (py - cy) : (top - cy) / (py - cy);
      const k = Math.min(Math.abs(kx), Math.abs(ky));
      px = cx + (px - cx) * k; py = cy + (py - cy) * k;
      c.save(); c.translate(px, py);
      c.save(); c.rotate(ang);
      c.fillStyle = color; c.strokeStyle = '#231a3a'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(22, 0); c.lineTo(2, -13); c.lineTo(2, 13); c.closePath(); c.fill(); c.stroke();
      c.restore();
      c.fillStyle = color; c.strokeStyle = '#231a3a'; c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill(); c.stroke();
      if (star) { c.fillStyle = '#231a3a'; c.font = '900 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 0, 1); }
      else if (down) { c.fillStyle = '#231a3a'; c.font = '900 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('✚', 0, 1); }
      c.font = '900 11px "M PLUS Rounded 1c", sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const ly = py > H / 2 ? -26 : 26;
      c.lineWidth = 3; c.strokeStyle = '#231a3a'; c.fillStyle = '#fff';
      c.strokeText(label, 0, ly); c.fillText(label, 0, ly);
      c.restore();
    }

    /** 右上のミニマップ */
    drawMinimap(mc, view, cam, selfId, hv) {
      const x = mc.getContext('2d');
      const w = mc.width, h = mc.height;
      const sx = w / GC.WORLD.w, sy = h / GC.WORLD.h;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, w, h);
      x.fillStyle = 'rgba(20,14,50,.7)'; x.fillRect(0, 0, w, h);
      x.fillStyle = this.ground.g.base; x.globalAlpha = 0.45; x.fillRect(0, 0, w, h); x.globalAlpha = 1;
      x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 1;
      for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(w * i / 6, 0); x.lineTo(w * i / 6, h); x.moveTo(0, h * i / 6); x.lineTo(w, h * i / 6); x.stroke(); }
      // 視界
      x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5;
      x.strokeRect((cam.x - hv.vw) * sx, (cam.y - hv.vh) * sy, hv.vw * 2 * sx, hv.vh * 2 * sy);
      // ダンボール・回復アイテム
      x.fillStyle = '#d9a15a';
      for (const b of view.BX || []) x.fillRect(b[1] * sx - 2, b[2] * sy - 2, 4, 4);
      x.fillStyle = '#ff6b7f';
      for (const h of view.HL || []) { x.beginPath(); x.arc(h[1] * sx, h[2] * sy, 3, 0, TAU); x.fill(); }
      // 祭壇・ボス・中ボス
      if (view.altar) { x.fillStyle = '#ffd23d'; x.beginPath(); x.arc(view.altar[0] * sx, view.altar[1] * sy, 6, 0, TAU); x.fill(); x.strokeStyle = '#231a3a'; x.lineWidth = 2; x.stroke(); }
      for (const e of view.E) {
        if (e[1] === -1 || e[7]) { x.fillStyle = '#ff3b5c'; x.beginPath(); x.arc(e[2] * sx, e[3] * sy, e[1] === -1 ? 6 : 4.5, 0, TAU); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); }
      }
      // プレイヤー
      for (const p of view.P) {
        const me = p[0] === selfId;
        const px = (me ? cam.x : p[2]) * sx, py = (me ? cam.y : p[3]) * sy;
        x.fillStyle = p[6] ? '#9aa0b0' : COLORS[p[1]];
        x.strokeStyle = me ? '#fff' : '#231a3a'; x.lineWidth = me ? 2.5 : 2;
        x.beginPath(); x.arc(px, py, me ? 5.5 : 4.5, 0, TAU); x.fill(); x.stroke();
      }
      x.strokeStyle = '#231a3a'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3);
    }
  }

  DS.Renderer = Renderer;
  // ミニゲームの描画でも使う道具
  DS.Renderer.util = { svgToCanvas, flipped, hash, TILE, makeTiles };
})();

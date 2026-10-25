/* =========================================================
 *  mgsim.js  ― ミニゲームの進行（ホストが動かす）
 *
 *  4つのミニゲーム（フレンドと2〜4人で対戦）
 *   dodge    : 弾よけサバイバル   … 魔法使いゾンビの弾をよけて最後まで生き残る
 *   draw     : 地上絵バトル       … 暗い中で歩いた道が線になる。お題の絵を描いて投票
 *   peak     : ゾンビピーク       … ゾンビを捕まえて自分の柵に入れた数を競う
 *   defender : ディフェンサーバトル … まわりを回るディフェンサーを相手に当てる
 *
 *  ・ホストだけがこのクラスを動かし、全員に「スナップショット」と「イベント」を送る
 *  ・プレイヤーの位置は各自の端末が決めて送ってくる（自分の画面のとおりに動ける）
 *  ・弾やディフェンサーに「当たったか」は、当たった本人の端末が判定して知らせる
 *    （通信の遅れで、よけたのに当たった…とならないように）
 * ========================================================= */
(function () {
  const C = DS.config, MGC = C.MINIGAMES;
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const r1 = (v) => Math.round(v * 10) / 10;
  const r3 = (v) => Math.round(v * 1000) / 1000;

  /* ---------- 調整用の数値 ---------- */
  const T = {
    pr: 20,                // プレイヤーの半径（見た目）
    hitR: 14,              // 当たり判定の半径（見た目より少し小さめ）
    ready: 3.5,            // 始まる前の説明の時間（秒）
    finishGrace: 0.5,      // 最後の1人が決まってから結果を出すまで（ほぼ同時の脱落は引き分け）
    tieWindow: 0.25,
    speedMin: 60, speedMax: 150,   // 装備の移動速度（%）の範囲
    view: { dodge: 700, draw: 560, peak: 800, defender: 780 },   // 画面の短い辺に映る距離
    dodge: {
      W: 2000, H: 2000, ra: 380, rz: 478,       // ra: プレイヤーが動ける円 / rz: 魔法使いゾンビがいる円
      start: 5, addEvery: 6, max: 28,           // 最初5体、6秒ごとに1体ふえる（最大28体）
      cd0: [2.6, 3.8], cd1: [1.0, 1.7],         // 弾を撃つ間隔（最初 → 120秒後）
      warn: 0.6,                                // 撃つ前に光る時間
      sp0: 220, sp1: 330, ramp: 120,            // 弾の速さ（最初 → ramp 秒後）
      br: 10,                                   // 弾の半径
      spread3: 40, spread5: 100,                // この秒数をすぎると3方向・5方向に撃つことがある
    },
    draw: { W: 1400, H: 1400, light: 150, minStep: 6, grace: 8, voteTime: 30 },
    peak: {
      W: 2800, H: 2800, pen: 660, inset: 90, gate: 240, wall: 18,
      wild: 34, wildMin: 22, respawn: 2.2, max: 130,   // 野生のゾンビの数・補充
      carry: 3, catchR: 40, releaseR: 120, zr: 18,
      zsp: 75, penSp: 40, veil: 0.55,                  // ゾンビの速さ（veil：ブラックヴェール中の倍率）
    },
    defender: {
      W: 2000, H: 2000, r0: 820, r1: 190, r2: 70,      // ゾンビの輪の半径（最初 → せまくなった後 → 最後）
      shrinkAt: 12, shrinkDur: 95, finalDur: 50,
      orbit: 82, spin: 3.3, dr: 19, spawnR: 430,
    },
    effects: {
      shield: { cd: 60 }, miss: { chance: 0.1 }, guts: { cd: 60, dur: 3 }, revive: { inv: 3 },
      dash: { cd: 30, dur: 5, spd: 100 }, iron: { cd: 30, dur: 3 }, veil: { cd: 30, dur: 10 },
    },
  };

  /* ---------- みんなが使う形 ---------- */
  const gameDef = (key) => MGC.list.find((g) => g.key === key) || MGC.list[0];
  function spawnPos(game, slot) {
    const a = slot * Math.PI / 2 + Math.PI / 4;
    if (game === 'dodge') return [T.dodge.W / 2 + Math.cos(a) * 150, T.dodge.H / 2 + Math.sin(a) * 150];
    if (game === 'draw') return [T.draw.W / 2, T.draw.H / 2];
    if (game === 'peak') { const p = peakPens()[slot]; return [p.cx, p.cy]; }
    return [T.defender.W / 2 + Math.cos(a) * T.defender.spawnR, T.defender.H / 2 + Math.sin(a) * T.defender.spawnR];
  }

  // ゾンビピークの柵（0:左上 1:右上 2:左下 3:右下）。マップの中心がわの2辺に入口がある
  let pensCache = null, wallsCache = null;
  function peakPens() {
    if (pensCache) return pensCache;
    const P = T.peak, s = P.pen, i = P.inset;
    pensCache = [[i, i], [P.W - i - s, i], [i, P.H - i - s], [P.W - i - s, P.H - i - s]].map(([x, y], k) => ({
      slot: k, x, y, w: s, h: s, cx: x + s / 2, cy: y + s / 2,
      gx: k % 2 === 0 ? 'right' : 'left', gy: k < 2 ? 'bottom' : 'top',
    }));
    return pensCache;
  }
  function peakWalls() {
    if (wallsCache) return wallsCache;
    const P = T.peak, th = P.wall, g = P.gate, out = [];
    for (const p of peakPens()) {
      const sides = { top: [p.x, p.y, p.w, 0], bottom: [p.x, p.y + p.h, p.w, 0], left: [p.x, p.y, 0, p.h], right: [p.x + p.w, p.y, 0, p.h] };
      Object.keys(sides).forEach((name) => {
        const [x, y, w, h] = sides[name];
        const gate = name === p.gx || name === p.gy;
        if (w) {
          if (gate) { const a = (w - g) / 2; out.push({ x: x - th / 2, y: y - th / 2, w: a + th / 2, h: th }, { x: x + a + g, y: y - th / 2, w: a + th / 2, h: th }); }
          else out.push({ x: x - th / 2, y: y - th / 2, w: w + th, h: th });
        } else if (gate) { const a = (h - g) / 2; out.push({ x: x - th / 2, y: y - th / 2, w: th, h: a + th / 2 }, { x: x - th / 2, y: y + a + g, w: th, h: a + th / 2 }); }
        else out.push({ x: x - th / 2, y: y - th / 2, w: th, h: h + th });
      });
    }
    wallsCache = out;
    return out;
  }
  /** 円（x, y, 半径 r）を壁の外に押し出す */
  function pushOut(x, y, r, walls) {
    for (const w of walls) {
      const nx = clamp(x, w.x, w.x + w.w), ny = clamp(y, w.y, w.y + w.h);
      const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-6) { const d = Math.sqrt(d2); x = nx + dx / d * r; y = ny + dy / d * r; }
      else {
        const l = x - w.x, rr = w.x + w.w - x, t = y - w.y, b = w.y + w.h - y, m = Math.min(l, rr, t, b);
        if (m === l) x = w.x - r; else if (m === rr) x = w.x + w.w + r; else if (m === t) y = w.y - r; else y = w.y + w.h + r;
      }
    }
    return [x, y];
  }
  const inRect = (x, y, p, pad = 0) => x > p.x - pad && x < p.x + p.w + pad && y > p.y - pad && y < p.y + p.h + pad;
  const inPen = (x, y) => peakPens().find((p) => inRect(x, y, p));

  // ディフェンサーバトル：ゾンビの輪の半径（el = 試合が始まってからの秒数）
  function ringR(el) {
    const D = T.defender;
    if (el < D.shrinkAt) return D.r0;
    const k = (el - D.shrinkAt) / D.shrinkDur;
    if (k < 1) return lerp(D.r0, D.r1, k);
    return lerp(D.r1, D.r2, Math.min(1, (el - D.shrinkAt - D.shrinkDur) / D.finalDur));
  }
  // ディフェンサーの位置（t = ホストの時計。全員が同じ角度で描ける）
  function defPos(px, py, t, slot, k) {
    const a = t * T.defender.spin + slot * 0.7 + k * Math.PI;
    return [px + Math.cos(a) * T.defender.orbit, py + Math.sin(a) * T.defender.orbit];
  }

  /* ---------- 装備・キャラから、ミニゲームで使える効果を決める ---------- */
  function effectsOf(member, game) {
    const allow = gameDef(game).effects || [];
    const EPIC = DS.state.RARITY.epic.rank;
    const pas = {};
    C.SLOTS.forEach(({ key }) => {
      const [item, rr] = String((member.gear && member.gear[key]) || '').split(':');
      const R = DS.state.RARITY[rr];
      if (C.ITEMS[item] && C.ITEMS[item].passive && R && R.rank >= EPIC) pas[item] = true;
    });
    const e = {};
    if (allow.includes('speed')) e.speed = clamp(member.spd || 100, T.speedMin, T.speedMax);
    else e.speed = 100;
    if (allow.includes('shield') && pas.plateArmor) e.shield = true;
    if (allow.includes('miss') && pas.highBoots) e.miss = true;
    if (allow.includes('guts') && pas.eternalBelt) e.guts = true;
    if (allow.includes('revive') && pas.eternalSuit) e.revive = true;
    const skill = { duck: 'dash', large: 'iron', widow: 'veil' }[member.char];
    if (skill && allow.includes(skill)) e.skill = skill;
    return e;
  }
  const EFFECT_NAMES = {
    shield: 'ガードシールド', miss: '見切り', guts: '不屈', revive: '不死の加護',
    dash: 'ダッシュ', iron: 'アイアンボディ', veil: 'ブラックヴェール',
  };

  /* =========================================================
   *  ホストのシミュレーション
   * ========================================================= */
  class MgSim {
    constructor({ game, time, members }) {
      this.game = game;
      this.def = gameDef(game);
      this.dur = this.def.times ? (this.def.times.includes(+time) ? +time : this.def.time) : 0;
      this.t = 0; this.el = 0; this.ph = 'ready';
      this.out = [];
      this.nid = 1;
      this.players = new Map();
      members.forEach((m) => {
        const sp = spawnPos(game, m.slot);
        this.players.set(m.id, { id: m.id, slot: m.slot, name: m.name, look: m.look || '', x: sp[0], y: sp[1], f: 0, alive: true, td: 0, kills: 0, gone: false, carry: [], done: false });
      });
      this.nStart = this.players.size;
      if (game === 'dodge') this.Z = [];
      if (game === 'draw') {
        const tp = MGC.topics;
        this.topic = tp[Math.floor(Math.random() * tp.length)];
        this.arts = {}; this.votes = {}; this.order = null;
      }
      if (game === 'peak') {
        this.Z = []; this.spawnT = 0; this.veilUntil = -1;
        for (let i = 0; i < T.peak.wild; i++) this.spawnWild(true);
      }
    }
    emit(e) { this.out.push(e); }
    get list() { return [...this.players.values()]; }

    /* ----- 端末からの知らせ ----- */
    input(id, d) {
      const p = this.players.get(id);
      if (!p || !d || p.gone) return;
      if (d.k === 'in') {
        const W = T[this.game].W, H = T[this.game].H;
        if (!p.alive && (this.game === 'dodge' || this.game === 'defender')) return;
        p.x = clamp(+d.x || 0, 0, W); p.y = clamp(+d.y || 0, 0, H); p.f = d.f | 0;
        return;
      }
      if (d.k === 'dead') {
        if (this.ph !== 'play' || !p.alive || (this.game !== 'dodge' && this.game !== 'defender')) return;
        p.alive = false;
        p.td = clamp(Number(d.td) || this.t, this.t - 2, this.t);
        if (Number.isFinite(+d.x)) { p.x = +d.x; p.y = +d.y; }
        const killer = d.by && this.players.get(d.by);
        if (killer && killer.id !== id) killer.kills++;
        this.emit({ type: 'dead', id, by: d.by || '', x: Math.round(p.x), y: Math.round(p.y) });
        return;
      }
      if (d.k === 'skill' && d.key === 'veil' && this.game === 'peak' && this.ph === 'play') {
        this.veilUntil = this.t + T.effects.veil.dur;
        this.emit({ type: 'skill', id, key: 'veil' });
        return;
      }
      if (this.game !== 'draw') return;
      if (d.k === 'art' && !p.done) {
        const n = clamp(d.n | 0, 1, 64), i = d.i | 0;
        if (i < 0 || i >= n || !Array.isArray(d.d)) return;
        const a = this.arts[id] || (this.arts[id] = { n, parts: [] });
        a.parts[i] = d.d.slice(0, 4000).map((v) => v | 0);
        this.emit({ type: 'art', id, i, n, d: a.parts[i] });
      } else if (d.k === 'done' && !p.done && this.ph === 'play') {
        p.done = true;
        this.emit({ type: 'done', id });
      } else if (d.k === 'vote' && this.ph === 'vote') {
        if (!this.order || !this.order.includes(d.to) || d.to === id || this.votes[id]) return;
        this.votes[id] = d.to;
        this.emit({ type: 'voted', id });
      }
    }
    removePlayer(id) {
      const p = this.players.get(id);
      if (!p || p.gone) return;
      p.gone = true;
      if (p.alive) { p.alive = false; p.td = this.t; }
      if (this.game === 'peak') {
        this.Z.forEach((z) => { if (z.s === 2 && z.o === id) { z.s = 0; z.o = -1; z.wait = 0.5; } });
        p.carry = [];
      }
      this.emit({ type: 'left', id });
    }

    /* ----- 1コマ進める ----- */
    step(dt) {
      this.t += dt;
      if (this.ph === 'ready') {
        if (this.t >= T.ready) { this.ph = 'play'; this.emit({ type: 'go' }); }
        return;
      }
      if (this.ph === 'play') {
        this.el += dt;
        if (this.game === 'dodge') this.stepDodge(dt);
        else if (this.game === 'defender') this.stepDefender();
        else if (this.game === 'peak') this.stepPeak(dt);
        else this.stepDraw(dt);
      } else if (this.ph === 'vote') this.stepVote();
    }

    /* ----- 生き残り系（弾よけ・ディフェンサー）の終わり ----- */
    checkSurvival() {
      const alive = this.list.filter((p) => p.alive && !p.gone);
      if (this.finishAt == null && (alive.length === 0 || (alive.length <= 1 && this.nStart >= 2))) this.finishAt = this.t + T.finishGrace;
      if (this.finishAt == null || this.t < this.finishAt) return;
      const all = this.list;
      let winners;
      if (alive.length) winners = alive.map((p) => p.id);
      else {
        const best = Math.max(...all.filter((p) => !p.gone).map((p) => p.td), -1);
        winners = all.filter((p) => !p.gone && p.td >= best - T.tieWindow).map((p) => p.id);
      }
      const rank = all.slice().sort((a, b) => (b.alive - a.alive) || (b.td - a.td)).map((p) => ({
        id: p.id, name: p.name, slot: p.slot, alive: p.alive, gone: p.gone,
        time: r1(p.alive ? this.el : Math.max(0, p.td - T.ready)), kills: p.kills,
      }));
      this.end({ winners, rank });
    }
    end(r) {
      if (this.ph === 'end') return;
      this.ph = 'end';
      this.emit({ type: 'end', r: Object.assign({ game: this.game, el: r1(this.el) }, r) });
    }

    /* ----- 弾よけサバイバル ----- */
    stepDodge(dt) {
      const D = T.dodge, cx = D.W / 2, cy = D.H / 2;
      const want = Math.min(D.max, D.start + Math.floor(this.el / D.addEvery));
      while (this.Z.length < want) {
        let a = rand(0, TAU);
        // なるべく他のゾンビと離れた場所に出す
        for (let tries = 0; tries < 8; tries++) {
          const near = this.Z.some((z) => Math.abs(Math.atan2(Math.sin(z.a - a), Math.cos(z.a - a))) < 0.22);
          if (!near) break;
          a = rand(0, TAU);
        }
        this.Z.push({ id: this.nid++, a, w: rand(-0.12, 0.12), cd: rand(1.2, 3.2), ch: 0, born: this.t });
      }
      const k = Math.min(1, this.el / D.ramp);
      const alive = this.list.filter((p) => p.alive && !p.gone);
      const shots = [];
      for (const z of this.Z) {
        z.a += z.w * dt;
        if (Math.random() < dt * 0.25) z.w = rand(-0.16, 0.16);
        z.cd -= dt;
        z.ch = z.cd < D.warn ? 1 - Math.max(0, z.cd) / D.warn : 0;
        if (z.cd > 0) continue;
        z.cd = rand(lerp(D.cd0[0], D.cd1[0], k), lerp(D.cd0[1], D.cd1[1], k));
        if (!alive.length) continue;
        const tg = alive[Math.floor(Math.random() * alive.length)];
        const zx = cx + Math.cos(z.a) * D.rz, zy = cy + Math.sin(z.a) * D.rz;
        const base = Math.atan2(tg.y - zy, tg.x - zx) + rand(-0.12, 0.12);
        const sp = lerp(D.sp0, D.sp1, k) * rand(0.92, 1.08);
        const roll = Math.random();
        const n = this.el > D.spread5 && roll < 0.18 ? 5 : this.el > D.spread3 && roll < 0.3 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.2;
          shots.push([this.nid++, Math.round(zx), Math.round(zy), Math.round(Math.cos(a) * sp), Math.round(Math.sin(a) * sp), r3(this.t)]);
        }
      }
      if (shots.length) this.emit({ type: 'b', l: shots });
      this.checkSurvival();
    }

    /* ----- ディフェンサーバトル ----- */
    // ディフェンサーはこわれない（ずっと2枚）。ディフェンサーどうしはすり抜ける。
    // 相手に当たったかは、当たった本人の端末が判定する（minigame.js）
    stepDefender() {
      this.checkSurvival();
    }

    /* ----- ゾンビピーク ----- */
    randomOpen(nearX, nearY, range) {
      const P = T.peak;
      for (let i = 0; i < 30; i++) {
        const x = nearX != null ? clamp(nearX + rand(-range, range), 60, P.W - 60) : rand(60, P.W - 60);
        const y = nearY != null ? clamp(nearY + rand(-range, range), 60, P.H - 60) : rand(60, P.H - 60);
        if (!peakPens().some((p) => inRect(x, y, p, 50))) return [x, y];
      }
      return [P.W / 2 + rand(-200, 200), P.H / 2 + rand(-200, 200)];
    }
    spawnWild(initial) {
      const P = T.peak;
      let pos;
      for (let i = 0; i < 12; i++) {
        pos = this.randomOpen();
        if (initial || this.list.every((p) => Math.hypot(p.x - pos[0], p.y - pos[1]) > 260)) break;
      }
      const tg = this.randomOpen(pos[0], pos[1], 400);
      this.Z.push({ id: this.nid++, x: pos[0], y: pos[1], s: 0, o: -1, tx: tg[0], ty: tg[1], wait: rand(0, 1.5), sp: P.zsp * rand(0.8, 1.2), run: 0 });
    }
    stepPeak(dt) {
      const P = T.peak, pens = peakPens();
      const slow = this.t < this.veilUntil ? P.veil : 1;
      const players = this.list.filter((p) => !p.gone);
      for (const z of this.Z) {
        if (z.s === 2) continue;   // 運ばれているゾンビは下でまとめて動かす
        if (z.wait > 0) { z.wait -= dt; continue; }
        const dx = z.tx - z.x, dy = z.ty - z.y, d = Math.hypot(dx, dy);
        if (z.run > 0) z.run -= dt;
        const sp = (z.s === 1 ? P.penSp : z.sp * (z.run > 0 ? 1.9 : 1)) * slow;
        if (d < 8) {
          z.wait = z.s === 1 ? rand(0.6, 3.2) : rand(0.3, 1.8);
          if (z.s === 1) { const pen = pens[z.o]; z.tx = rand(pen.x + 50, pen.x + pen.w - 50); z.ty = rand(pen.y + 50, pen.y + pen.h - 50); }
          else { const tg = this.randomOpen(z.x, z.y, 500); z.tx = tg[0]; z.ty = tg[1]; if (Math.random() < 0.12) z.run = rand(0.8, 1.6); }
          continue;
        }
        const mv = Math.min(d, sp * dt);
        z.x += dx / d * mv; z.y += dy / d * mv;
        if (z.s === 0) {
          // 野生のゾンビは柵に入らない（ぶつかったら別の方向へ）
          const pen = pens.find((p) => inRect(z.x, z.y, p, P.zr + 12));
          if (pen) {
            const cx = pen.cx, cy = pen.cy, ox = z.x - cx, oy = z.y - cy;
            if (Math.abs(ox) > Math.abs(oy)) z.x = cx + Math.sign(ox) * (pen.w / 2 + P.zr + 13);
            else z.y = cy + Math.sign(oy) * (pen.h / 2 + P.zr + 13);
            const tg = this.randomOpen(); z.tx = tg[0]; z.ty = tg[1];
          }
          z.x = clamp(z.x, 40, P.W - 40); z.y = clamp(z.y, 40, P.H - 40);
        } else {
          const pen = pens[z.o];
          z.x = clamp(z.x, pen.x + 30, pen.x + pen.w - 30); z.y = clamp(z.y, pen.y + 30, pen.y + pen.h - 30);
        }
      }
      // 運ばれているゾンビ：プレイヤーのうしろに1列でついてくる
      for (const p of players) {
        let lx = p.x, ly = p.y;
        p.carry = p.carry.filter((id) => this.Z.some((z) => z.id === id && z.s === 2 && z.o === p.id));
        for (const id of p.carry) {
          const z = this.Z.find((q) => q.id === id);
          const dx = z.x - lx, dy = z.y - ly, d = Math.hypot(dx, dy) || 1;
          if (d > 34) { z.x = lx + dx / d * 34; z.y = ly + dy / d * 34; }
          lx = z.x; ly = z.y;
        }
      }
      // 捕まえる・柵に入れる
      for (const p of players) {
        const own = pens[p.slot];
        if (p.carry.length && Math.hypot(p.x - own.cx, p.y - own.cy) < P.releaseR) {
          for (const id of p.carry) {
            const z = this.Z.find((q) => q.id === id);
            z.s = 1; z.o = p.slot; z.wait = 0;
            z.tx = rand(own.x + 50, own.x + own.w - 50); z.ty = rand(own.y + 50, own.y + own.h - 50);
          }
          this.emit({ type: 'release', id: p.id, n: p.carry.length });
          p.carry = [];
        }
        if (p.carry.length >= P.carry) continue;
        for (const z of this.Z) {
          if (z.s === 2 || (z.s === 1 && z.o === p.slot)) continue;
          if (Math.abs(z.x - p.x) > P.catchR || Math.abs(z.y - p.y) > P.catchR) continue;
          if (Math.hypot(z.x - p.x, z.y - p.y) >= P.catchR) continue;
          const from = z.s === 1 ? z.o : -1;
          z.s = 2; z.o = p.id; z.run = 0;
          p.carry.push(z.id);
          if (from >= 0) {
            const victim = players.find((q) => q.slot === from);
            this.emit({ type: 'steal', id: p.id, from: victim ? victim.id : '' });
          } else this.emit({ type: 'catch', id: p.id });
          break;
        }
      }
      // 野生のゾンビの補充
      this.spawnT -= dt;
      const wild = this.Z.filter((z) => z.s === 0).length;
      if (wild < P.wildMin && this.Z.length < P.max && this.spawnT <= 0) { this.spawnWild(false); this.spawnT = P.respawn; }
      if (this.el >= this.dur) {
        const sc = this.scores();
        const best = Math.max(0, ...this.list.filter((p) => !p.gone).map((p) => sc[p.id] || 0));
        const winners = best > 0 ? this.list.filter((p) => !p.gone && sc[p.id] === best).map((p) => p.id) : [];
        const rank = this.list.slice().sort((a, b) => (sc[b.id] || 0) - (sc[a.id] || 0)).map((p) => ({ id: p.id, name: p.name, slot: p.slot, gone: p.gone, score: sc[p.id] || 0 }));
        this.end({ winners, rank });
      }
    }
    scores() {
      const sc = {};
      this.list.forEach((p) => { sc[p.id] = this.Z.filter((z) => z.s === 1 && z.o === p.slot).length; });
      return sc;
    }

    /* ----- 地上絵バトル ----- */
    stepDraw() {
      if (this.el >= this.dur && !this.timeUp) { this.timeUp = true; this.emit({ type: 'timeup' }); }
      const live = this.list.filter((p) => !p.gone);
      const allDone = live.every((p) => p.done);
      if (allDone || this.el >= this.dur + T.draw.grace) {
        const ok = (id) => { const a = this.arts[id]; return a && a.parts.filter(Boolean).length === a.n; };
        const order = live.filter((p) => p.done && ok(p.id)).map((p) => p.id);
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        this.order = order;
        this.ph = 'vote';
        this.voteEnd = this.t + T.draw.voteTime;
        this.emit({ type: 'vote', order, sec: T.draw.voteTime });
      }
    }
    stepVote() {
      const live = this.list.filter((p) => !p.gone);
      const voters = live.filter((p) => this.order.some((id) => id !== p.id));
      const all = voters.every((p) => this.votes[p.id]);
      if (!all && this.t < this.voteEnd && this.order.length > 1) return;
      const counts = {};
      this.order.forEach((id) => { counts[id] = 0; });
      Object.values(this.votes).forEach((to) => { if (counts[to] != null) counts[to]++; });
      const best = Math.max(0, ...Object.values(counts));
      const winners = best > 0 ? this.order.filter((id) => counts[id] === best) : (this.order.length === 1 ? this.order.slice() : []);
      const rank = this.list.slice().sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).map((p) => ({ id: p.id, name: p.name, slot: p.slot, gone: p.gone, score: counts[p.id] || 0, drew: this.order.includes(p.id) }));
      this.end({ winners, rank, votes: this.votes, counts, order: this.order, topic: this.topic });
    }

    /* ----- 全員に送る今の状態 ----- */
    snapshot() {
      const s = { t: r3(this.t), ph: this.ph, el: r1(this.el), dur: this.dur };
      s.P = this.list.map((p) => {
        const extra = this.game === 'defender' ? 3   // ディフェンサー2枚（こわれない）
          : this.game === 'peak' ? p.carry.length : this.game === 'draw' ? (p.done ? 1 : 0) : 0;
        return [p.id, Math.round(p.x), Math.round(p.y), p.f, p.alive && !p.gone ? 1 : 0, extra, p.gone ? 1 : 0];
      });
      if (this.game === 'dodge') {
        const D = T.dodge, cx = D.W / 2, cy = D.H / 2;
        s.Z = this.Z.map((z) => [z.id, Math.round(cx + Math.cos(z.a) * D.rz), Math.round(cy + Math.sin(z.a) * D.rz), Math.round(z.ch * 100), z.born > this.t - 1 ? 1 : 0]);
      } else if (this.game === 'peak') {
        const Z = [];
        const slotOf = new Map(this.list.map((p) => [p.id, p.slot]));
        for (const z of this.Z) Z.push(z.id, Math.round(z.x), Math.round(z.y), z.s === 0 ? 0 : z.s === 1 ? 1 + z.o : 10 + (slotOf.get(z.o) || 0));
        s.Z = Z;
        const sc = this.scores();
        s.SC = this.list.map((p) => [p.id, sc[p.id] || 0]);
        s.veil = this.t < this.veilUntil ? r1(this.veilUntil - this.t) : 0;
      } else if (this.game === 'draw') {
        s.tp = this.topic;
      }
      return s;
    }
  }

  DS.MgSim = MgSim;
  DS.mg = { T, gameDef, spawnPos, peakPens, peakWalls, pushOut, inPen, ringR, defPos, effectsOf, EFFECT_NAMES, clamp, lerp };
})();

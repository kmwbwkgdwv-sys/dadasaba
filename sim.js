/* =========================================================
 *  sim.js  ― バトルの中身（ホストの端末だけで動く）
 *
 *  ・敵の出現/移動/攻撃、スキル、経験値、ボス、復活、勝敗をすべてここで計算
 *  ・プレイヤーの位置だけは各端末から送られてきた値を使う（操作の遅れをなくすため）
 *  ・snapshot() で画面描画・通信用の軽いデータを作る
 * ========================================================= */
(function () {
  const GC = DS.gameConfig;
  const SP = GC.SKILL_PARAMS;
  const EV = GC.EVOLVE, EVO = GC.EVO_STAR || 6;   // 赤★1（進化）
  const BB = GC.BOSS_BUFF || { hp: 1, cd: 1, speed: 1, staticWalk: 0 };
  /** 試合時間（分）による雑魚の体力の倍率 */
  function hpCurve(min) {
    const c = GC.ENEMY_HP_CURVE;
    if (!c) return 1 + (GC.ENEMY_HP_GROWTH_PER_MIN || 0) * min;
    if (min <= c[0][0]) return c[0][1];
    for (let i = 1; i < c.length; i++) {
      if (min <= c[i][0]) { const [m0, v0] = c[i - 1], [m1, v1] = c[i]; return v0 + (v1 - v0) * (min - m0) / (m1 - m0); }
    }
    return c[c.length - 1][1];
  }
  const ITEMS = DS.config.ITEMS;
  const ENEMY_TYPES = Object.keys(GC.ENEMIES);
  const PROJ_KINDS = ['magic', 'bone', 'seed', 'stone', 'ice', 'fire', 'soul', 'fireMagic', 'iceMagic', 'heal',
    'snowball', 'sand', 'bubble', 'spore', 'needle', 'petal', 'poison', 'gold', 'feather', 'dark', 'laser', 'blood', 'darkMagic'];
  const TAU = Math.PI * 2;
  const WEAPONS = Object.keys(ITEMS).filter((k) => ITEMS[k].slot === 'weapon');
  const RANK = {};
  DS.config.RARITIES.forEach((r, i) => { RANK[r.key] = i; });
  const EPIC = RANK.epic;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- 近くの敵をすばやく探すための格子 ---------- */
  class Grid {
    constructor(cell) { this.cell = cell; this.map = new Map(); }
    clear() { this.map.clear(); }
    insert(e) {
      const k = Math.floor(e.x / this.cell) * 65536 + Math.floor(e.y / this.cell);
      let a = this.map.get(k);
      if (!a) { a = []; this.map.set(k, a); }
      a.push(e);
    }
    each(x, y, r, fn) {
      const c = this.cell;
      const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
      const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const a = this.map.get(cx * 65536 + cy);
          if (a) for (let i = 0; i < a.length; i++) fn(a[i]);
        }
      }
    }
  }

  class Sim {
    /**
     * @param {object} o
     *  stageIndex: 0〜49
     *  players: [{ id, slot, name, atk, hp, spd, weapon, gear:{weapon:'kunai:epic',...}, char, look }]
     */
    constructor(o) {
      this.stageIndex = clamp(o.stageIndex || 0, 0, DS.config.STAGES.length - 1);
      this.stage = DS.config.STAGES[this.stageIndex];
      this.roster = GC.stageRoster(this.stageIndex);
      const sc = GC.stageScale(this.stageIndex);
      this.atkMult = sc.atk;
      this.hpMult = sc.hp;
      this.W = GC.WORLD.w; this.H = GC.WORLD.h;
      this.t = 0;
      this.phase = 'battle';       // battle →（8分）warp（ワープ待ち）→ intro（ボス出現待ち）→ boss → win / lose
      this.introT = 0;             // warp・intro の残り秒
      this.roulette = null;        // 宝箱のルーレット { seq, left, plan:{pid:{cands,pick}|{heal}}, by, name }
      this.rlSeq = 0;
      this.level = 1; this.xp = 0;
      this.pendingLv = 0;
      this.levelup = null;         // { seq, options:{pid:[...]}, chosen:{pid:true} }
      this.lvSeq = 0;
      this.nextId = 1;
      this.enemies = []; this.shots = []; this.eshots = []; this.zones = []; this.bottles = [];
      this.blasts = [];            // 少し遅れて爆発する攻撃（ボスの衝撃・降ってくる攻撃・メテオ）
      this.fx = []; this.events = [];
      this.grid = new Grid(80);
      this.spawnTimer = 1;
      this.midbossDone = 0;
      this.altar = null; this.countdown = -1;
      this.boss = null;
      this.ended = false;
      this.clock = 0;              // 一時停止中以外は進み続ける時計（エフェクト用）
      // 1人なら1倍、パーティーなら3倍の難易度
      this.partyDiff = (o.players || []).length > 1 ? GC.DIFFICULTY.party : GC.DIFFICULTY.solo;
      // 試合の時計（this.t）を tScale 倍の速さで進めて、8分の流れを縮める
      // v27：ふだんは5分（MATCH_REAL）、v22 の圧倒モードは3分（OVERWHELM.seconds）
      const OW = GC.OVERWHELM;
      this.overwhelm = !!(o.overwhelm && OW);
      this.realSeconds = this.overwhelm ? OW.seconds : (GC.MATCH_REAL || GC.MATCH_SECONDS);
      this.tScale = GC.MATCH_SECONDS / this.realSeconds;
      this.boxes = []; this.heals = []; this.boxTimer = 60;
      this.chests = [];   // 中ボスの宝箱
      this.bombs = [];    // ダンボールから出た爆弾
      this.rush = 0; this.rushDone = 0; this.rushTimer = 0; this.rushDir = 0;
      this.widowT = 0; this.widowSpd = 0;

      this.players = new Map();
      (o.players || []).forEach((p, i) => this.addPlayer(p, i));
      this.need = this.calcNeed();
      this.spawnBoxes(GC.BOXES.initial);
    }

    /* ======================= プレイヤー ======================= */
    addPlayer(p, i) {
      const PL = GC.PLAYER;
      const ang = (p.slot != null ? p.slot : i) * Math.PI / 2;
      // 装備（アイテム名とレアリティ）からパッシブと補正を決める
      const gear = {};
      ['weapon', 'armor', 'belt', 'boots'].forEach((slot) => {
        const [item, rar] = String((p.gear && p.gear[slot]) || '').split(':');
        if (ITEMS[item] && ITEMS[item].slot === slot) gear[slot] = { item, rank: RANK[rar] != null ? RANK[rar] : 0 };
      });
      if (!gear.weapon && WEAPONS.includes(p.weapon)) gear.weapon = { item: p.weapon, rank: 0 };
      const pas = {};
      let dmgTaken = 0;
      Object.values(gear).forEach((g) => {
        const d = ITEMS[g.item];
        if (d.bonus && d.bonus.dmgTaken) dmgTaken += d.bonus.dmgTaken;
        if (g.rank >= EPIC && d.passive) { pas[g.item] = d.passive; if (d.passive.dmgTaken) dmgTaken += d.passive.dmgTaken; }
      });
      const auraOf = (slot, key) => (gear[slot] && ITEMS[gear[slot].item].aura && ITEMS[gear[slot].item].aura[key] ? ITEMS[gear[slot].item].aura : null);
      const pl = {
        id: p.id, slot: p.slot != null ? p.slot : i, name: p.name || 'プレイヤー',
        x: this.W / 2 + Math.cos(ang) * 60, y: this.H / 2 + Math.sin(ang) * 60,
        r: PL.radius, face: ang + Math.PI,
        baseAtk: Math.max(1, p.atk || 100), maxHp: Math.max(1, p.hp || 1000),
        spd: p.spd || 100,
        hp: Math.max(1, p.hp || 1000),
        weapon: gear.weapon ? gear.weapon.item : 'kunai',
        down: false, revive: 0,
        kills: 0,
        vw: 220, vh: 450,
        skills: {}, abilities: {}, order: [], aorder: [],
        cd: {}, gearAng: 0, drone: null, ball: null, droneAcc: 0,
        frost: auraOf('boots', 'enemySpd'),
        stella: auraOf('belt', 'enemyAtkSpd'),
        pas, dmgTaken,
        shield: !!pas.plateArmor,          // 鎧のシールド（最初から張っている）
        suit: !!pas.eternalSuit,           // エターナルバトルスーツの復活（1回）
      };
      pl.skills[pl.weapon] = 1; pl.order.push(pl.weapon);
      // キャラの特殊スキル
      const ch = DS.config.CHARACTERS[p.char];
      pl.char = ch ? p.char : '';
      pl.look = p.look && DS.config.CHARACTERS[p.look] ? p.look : '';
      pl.cs = ch && ch.skill ? ch.skill : null;
      pl.scd = pl.cs && !pl.cs.passive ? Math.round(pl.cs.cd / 3) : 0;   // 最初は少し待つと使える
      pl.buff = { inv: 0, spd: 0, fast: 0, dual: 0, lbelt: 0, mgBurst: 0 };
      pl.movingT = 0; pl.legT = 0;
      this.players.set(pl.id, pl);
      return pl;
    }
    removePlayer(id) {
      this.players.delete(id);
      if (this.levelup) { delete this.levelup.options[id]; this.checkLevelupDone(); }
      this.need = this.calcNeed();
    }
    /** 各端末から届いた位置（と画面の大きさ）を反映。動いた向きを「向いている方向」にする */
    setPlayerPos(id, x, y, vw, vh) {
      const p = this.players.get(id);
      if (!p || p.down) return;
      const nx = clamp(x, p.r, this.W - p.r), ny = clamp(y, p.r, this.H - p.r);
      const dx = nx - p.x, dy = ny - p.y;
      if (dx * dx + dy * dy > 0.25) { p.face = Math.atan2(dy, dx); p.movingT = 0.25; }
      p.x = nx; p.y = ny;
      if (vw) { p.vw = clamp(vw, 120, 700); p.vh = clamp(vh, 120, 700); }
    }
    alivePlayers() { const a = []; this.players.forEach((p) => { if (!p.down) a.push(p); }); return a; }
    /** 人数による倍率。表（[0人,1人,2人,3人,4人]）か、1人増えるごとの値 */
    partyMul(k) {
      const n = this.players.size;
      if (Array.isArray(k)) return k[Math.min(n, k.length - 1)] || 1;
      return 1 + k * Math.max(0, n - 1);
    }
    /** 今の攻撃力（弾薬・破壊者コート・破壊者フットアーマー込み） */
    atkOf(p) {
      let a = p.baseAtk * (1 + 0.1 * (p.abilities.ammo || 0));
      const mb = this.musicBuff(p);
      if (mb) a *= 1 + mb.atk / 100;                                  // 楽器の広場：攻撃アップ
      if (p.pas.leatherBelt && p.buff.lbelt > 0) a *= 1 + p.pas.leatherBelt.atk / 100;   // レザーベルト：回復アイテムで攻撃力アップ
      if (p.pas.destroyerCoat) a *= 1 + (p.pas.destroyerCoat.max - 1) * clamp(1 - p.hp / p.maxHp, 0, 1);
      if (p.pas.destroyerFoot) {
        let downs = 0; this.players.forEach((q) => { if (q !== p && q.down) downs++; });
        a *= Math.min(p.pas.destroyerFoot.max, 1 + downs);
      }
      return a;
    }
    cdMul(p) { const mb = this.musicBuff(p); return 1 / (1 + 0.1 * (p.abilities.battery || 0) + (mb && mb.spd ? mb.spd / 100 : 0)); }
    /** 楽器の広場の中にいるときのバフ（いちばん高いものだけ。重ならない）。いなければ null */
    musicBuff(p) { return p.musicLv ? SP.music.buffs[p.musicLv] || null : null; }
    /** ガス注入：弾の速さの倍率（★ごとに+10%） */
    bulletMul(p) { return 1 + 0.1 * (p.abilities.gas || 0); }
    gravityR(p) { return SP.gravity.r * ((p.skills.gravity || 0) >= EVO ? EV.gravity.r : 1) * this.areaMul(p); }
    /** 拡大モジュール：攻撃の当たり判定の倍率（★ごとに+10%、赤★1で+60%） */
    areaMul(p) { return 1 + 0.1 * (p.abilities.expand || 0); }
    /** 武器の攻撃間隔の倍率（ガンマンのファストドロー中は 1/2） */
    wcd(p) { return p.buff.fast > 0 && p.cs && p.cs.rate ? 1 / p.cs.rate : 1; }

    /* ---------- キャラの特殊スキル ---------- */
    useSkill(id) {
      const p = this.players.get(id);
      if (!p || p.down || !p.cs || p.cs.passive || p.scd > 0 || this.ended || this.levelup) return false;
      const s = p.cs;
      p.scd = s.cd;
      if (p.char === 'widow') { this.widowT = Math.max(this.widowT, s.dur); this.widowSpd = s.enemySpd; }
      else if (p.char === 'duck') p.buff.spd = s.dur;
      else if (p.char === 'large') p.buff.inv = s.dur;
      else if (p.char === 'gunman') p.buff.fast = s.dur;
      else if (p.char === 'akagi') {
        // サイコロを振って、出た目 × ATK のダメージの長方形を自分を中心に落とす
        let r = Math.random() * s.dice.reduce((a, b) => a + b, 0), face = s.dice.length;
        for (let i = 0; i < s.dice.length; i++) { if (r < s.dice[i]) { face = i + 1; break; } r -= s.dice[i]; }
        this.blasts.push({ id: this.nextId++, kind: 3, x: p.x, y: p.y, r: s.w / 2, hh: s.h / 2, face, t: s.delay, max: s.delay,
          dmg: this.atkOf(p) * face, hurts: 'enemies', owner: p.id, rect: true });
        this.events.push({ type: 'skill', id: p.id, name: p.name, char: p.char, face });
        return true;
      }
      else if (p.char === 'freya') {
        const dmg = this.atkOf(p) * s.dmg;
        this.fx.push({ id: this.nextId++, k: 7, x: p.x, y: p.y, r: s.radius, rt: this.clock });
        this.enemiesNear(p.x, p.y, s.radius).forEach((e, i) => {
          if (i < 40) this.fx.push({ id: this.nextId++, k: 5, x: e.x, y: e.y, rt: this.clock });
          this.damageEnemy(e, dmg, p.id);
        });
      }
      this.events.push({ type: 'skill', id: p.id, name: p.name, char: p.char });
      return true;
    }

    /* ---------- ダンボールと回復アイテム ---------- */
    spawnBoxes(n) {
      const B = GC.BOXES;
      for (let i = 0; i < n && this.boxes.length < B.max; i++) {
        let x, y, tries = 0;
        do {
          x = rand(200, this.W - 200); y = rand(200, this.H - 200); tries++;
        } while (tries < 20 && [...this.players.values()].some((p) => dist2(p.x, p.y, x, y) < 300 * 300));
        this.boxes.push({ id: this.nextId++, x, y, r: B.r });
      }
    }
    /** こちらの攻撃が (x, y) の半径 r に当たった：ダンボールを壊す・魔法使いゾンビの弾を消す（body：体当たりのときは弾を消さない） */
    hitBoxes(x, y, r, body) {
      if (!body) this.cutShots(x, y, r);
      if (!this.boxes.length) return;
      for (const b of this.boxes) {
        if (!b.broken && dist2(x, y, b.x, b.y) < (r + b.r) * (r + b.r)) this.breakBox(b);
      }
    }
    /** v23：魔法使いゾンビの弾は、こちらの攻撃（弾・斬撃・爆発・炎など）が当たると消える */
    cutShots(x, y, r) {
      if (!this.mageShots) return;
      for (const s of this.eshots) {
        if (!s.mage || s.life <= 0) continue;
        if (dist2(x, y, s.x, s.y) < (r + s.r) * (r + s.r)) {
          s.life = 0; this.mageShots--;
          this.fx.push({ id: this.nextId++, k: 25, x: s.x, y: s.y, rt: this.clock, r: s.r });
        }
      }
    }
    breakBox(b) {
      b.broken = true;
      this.fx.push({ id: this.nextId++, k: 8, x: b.x, y: b.y, rt: this.clock });
      if (Math.random() < GC.BOXES.dropRate) this.heals.push({ id: this.nextId++, x: b.x, y: b.y });
      // 10分の1で爆弾：近くの敵に向かって飛んでいって爆発する（壊した人＝いちばん近いプレイヤーの ATK）
      const BM = GC.BOXES.bomb;
      if (BM && Math.random() < BM.rate) {
        let owner = null, bd = Infinity;
        this.players.forEach((p) => { const d = dist2(p.x, p.y, b.x, b.y); if (!p.down && d < bd) { bd = d; owner = p; } });
        this.bombs.push({ id: this.nextId++, x: b.x, y: b.y, tgt: this.nearestEnemy(b.x, b.y, BM.range), owner: owner ? owner.id : null, t: 0 });
      }
    }
    /** 爆弾を動かす（敵を追いかけて、着いたら爆発） */
    stepBombs(dt) {
      if (!this.bombs.length) return;
      const BM = GC.BOXES.bomb;
      for (const b of this.bombs) {
        b.t += dt;
        if (b.t < 0.25) continue;                       // 箱から出てくる
        if (!b.tgt || b.tgt.dead) b.tgt = this.nearestEnemy(b.x, b.y, BM.range);
        const t = b.tgt;
        let boom = !t && b.t > 0.8;
        if (t) {
          const dx = t.x - b.x, dy = t.y - b.y, d = Math.hypot(dx, dy) || 1, mv = BM.speed * dt;
          if (d <= mv + t.r * 0.5) { b.x = t.x; b.y = t.y; boom = true; }
          else { b.x += dx / d * mv; b.y += dy / d * mv; }
        }
        if (b.t > 3) boom = true;
        if (!boom) continue;
        b.done = true;
        this.fx.push({ id: this.nextId++, k: 12, x: b.x, y: b.y, rt: this.clock, r: BM.r });
        const p = this.players.get(b.owner) || this.alivePlayers()[0];
        if (p) {
          const dmg = this.atkOf(p) * BM.dmg;
          this.enemiesNear(b.x, b.y, BM.r).forEach((e) => this.damageEnemy(e, dmg, p.id));   // ボスも入る
        }
        this.hitBoxes(b.x, b.y, BM.r * 0.6);            // 近くのダンボールもこわれる（連鎖）
      }
      this.bombs = this.bombs.filter((b) => !b.done);
    }
    /**
     * 宝箱を開けた：時間を止めて、全員がそれぞれルーレット（持っているスキル・アビリティから1つ★が上がる）
     * 結果はここで決めておき、ルーレットが終わったとき（finishRoulette）に★を上げる
     */
    openChest(p, ch) {
      ch.taken = true;
      const plan = {};
      this.players.forEach((q) => {
        const cands = [];
        q.order.forEach((k) => { if (q.skills[k] < EVO) cands.push(['s', k, q.skills[k]]); });
        q.aorder.forEach((k) => { if (q.abilities[k] < EVO) cands.push(['a', k, q.abilities[k]]); });
        plan[q.id] = cands.length ? { cands, pick: Math.floor(Math.random() * cands.length) } : { heal: true };
      });
      this.rlSeq++;
      this.roulette = { seq: this.rlSeq, left: GC.CHEST.roulette || 5, plan, by: p.id, name: p.name };
      this.fx.push({ id: this.nextId++, k: 21, x: ch.x, y: ch.y, rt: this.clock, o: p.slot });
      this.events.push({ type: 'roulette', seq: this.rlSeq, id: p.id, name: p.name, plan, dur: this.roulette.left });
    }
    /** 一時停止中（ルーレット）の時間を進める。ゲームの時間は止まったまま */
    stepRoulette(dt) {
      if (!this.roulette || this.ended) return;
      this.roulette.left -= dt;
      if (this.roulette.left <= 0) this.finishRoulette();
    }
    finishRoulette() {
      const R = this.roulette;
      if (!R) return;
      this.roulette = null;
      const ups = {};
      this.players.forEach((q) => {
        const pl = R.plan[q.id];
        const c = pl && pl.cands ? pl.cands[pl.pick] : null;
        const opt = c ? { kind: c[0] === 's' ? 'skill' : 'ability', key: c[1] } : null;
        const cur = opt ? (opt.kind === 'skill' ? q.skills[opt.key] : q.abilities[opt.key]) : null;
        if (!opt || !cur || cur >= EVO) { ups[q.id] = this.chestUp(q); return; }   // 途中から入った人など
        this.applyOption(q, opt);
        ups[q.id] = { kind: opt.kind, key: opt.key, star: opt.kind === 'skill' ? q.skills[opt.key] : q.abilities[opt.key] };
      });
      this.events.push({ type: 'chest', id: R.by, name: R.name, ups, seq: R.seq, roulette: true });
    }
    /** 宝箱：全員のスキルかアビリティ（どれか1つ）の★を1つ上げる。上げられるものがなければHP回復 */
    chestUp(p) {
      const cands = [];
      Object.keys(p.skills).forEach((k) => { if (p.skills[k] < EVO) cands.push({ kind: 'skill', key: k }); });
      Object.keys(p.abilities).forEach((k) => { if (p.abilities[k] < EVO) cands.push({ kind: 'ability', key: k }); });
      if (!cands.length) { if (!p.down) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3); return { kind: 'heal' }; }
      const c = cands[Math.floor(Math.random() * cands.length)];
      this.applyOption(p, c);
      return { kind: c.kind, key: c.key, star: c.kind === 'skill' ? p.skills[c.key] : p.abilities[c.key] };
    }

    hurtPlayer(p, dmg) {
      if (p.down || this.ended || p.buff.inv > 0 || !(dmg > 0)) return;
      // 鎧：どんな攻撃でも1発は防ぐシールド
      if (p.shield) {
        p.shield = false; p.cd.plateArmor = p.pas.plateArmor.cd; p.buff.inv = Math.max(p.buff.inv, 0.4);
        this.fx.push({ id: this.nextId++, k: 15, x: p.x, y: p.y, rt: this.clock, o: p.slot });
        return;
      }
      // 見切り：★ごとに5%の確率で攻撃をよける（ダメージなし。赤★1で30%）
      if (p.abilities.dodge && Math.random() < 0.05 * p.abilities.dodge) {
        if (!(this.clock - (p.missFx || -9) < 0.6)) { p.missFx = this.clock; this.fx.push({ id: this.nextId++, k: 20, x: p.x, y: p.y, rt: this.clock, o: p.slot }); }
        return;
      }
      // ハイブーツ：10%の確率で攻撃を無効にする
      if (p.pas.highBoots && Math.random() < p.pas.highBoots.chance) {
        p.buff.inv = Math.max(p.buff.inv, 0.15);
        this.fx.push({ id: this.nextId++, k: 20, x: p.x, y: p.y, rt: this.clock, o: p.slot });
        return;
      }
      let d = dmg * (1 - 0.1 * (p.abilities.vest || 0)) * (1 + p.dmgTaken / 100);
      if (p.pas.leatherArmor) d *= 1 - p.pas.leatherArmor.cut / 100;      // レザーアーマー：毎回3%軽減
      const mb = this.musicBuff(p);
      if (mb && mb.cut) d *= 1 - mb.cut / 100;                             // 楽器の広場：受けるダメージ減少
      if (p.pas.waistSensor && p.hp <= p.maxHp * p.pas.waistSensor.below) d *= 1 - p.pas.waistSensor.cut / 100;   // ウエストセンサー
      p.hp -= d;
      // エターナルベルト：攻撃を受けたときから3秒間無敵（60秒に1度）
      if (p.pas.eternalBelt && !(p.cd.eternalBelt > 0) && p.hp > 0) {
        p.cd.eternalBelt = p.pas.eternalBelt.cd; p.buff.inv = Math.max(p.buff.inv, p.pas.eternalBelt.dur);
        this.fx.push({ id: this.nextId++, k: 15, x: p.x, y: p.y, rt: this.clock, o: p.slot });
      }
      if (p.hp <= 0) {
        // エターナルバトルスーツ：1度だけ復活（3秒無敵）
        if (p.suit) {
          p.suit = false; p.hp = p.maxHp * p.pas.eternalSuit.hp; p.buff.inv = p.pas.eternalSuit.inv;
          this.fx.push({ id: this.nextId++, k: 16, x: p.x, y: p.y, rt: this.clock, o: p.slot });
          this.events.push({ type: 'suitRevive', id: p.id, name: p.name });
          return;
        }
        p.hp = 0; p.down = true; p.revive = 0;
        p.drone = null; p.hdrone = null;
        this.events.push({ type: 'down', id: p.id, name: p.name });
        if (this.alivePlayers().length === 0) this.finish(false);
      }
    }

    /* ======================= 経験値・レベル ======================= */
    calcNeed() {
      const X = GC.XP;
      return Math.round(Math.min(X.cap || Infinity, X.base + X.growth * (this.level - 1)) * this.partyMul(GC.PARTY.xpNeed));
    }
    xpMul() {
      let s = 0;
      this.players.forEach((p) => { s += 0.1 * (p.abilities.scroll || 0) + (p.pas.militaryBoots ? p.pas.militaryBoots.xp / 100 : 0); });
      return (1 + s) * (this.overwhelm ? GC.OVERWHELM.xp || 1 : GC.MATCH_XP || 1);
    }
    gainXp(n) {
      this.xp += n * this.xpMul();
      while (this.xp >= this.need) {
        this.xp -= this.need;
        this.level++; this.pendingLv++;
        this.need = this.calcNeed();
      }
      if (this.pendingLv > 0 && !this.levelup && !this.ended) this.startLevelup();
    }
    optionsFor(p) {
      const cands = [];
      const MAX = EVO;   // ★5 の次は赤★1（進化）まで
      const ownedS = Object.keys(p.skills).length, ownedA = Object.keys(p.abilities).length;
      Object.keys(GC.SKILLS).forEach((k) => {
        const d = GC.SKILLS[k];
        if (d.weapon && k !== p.weapon) return;                 // 別の武器のスキルは出ない
        const s = p.skills[k] || 0;
        if (s >= MAX) return;                                  // 赤★1 は出ない
        if (!s && ownedS >= GC.SLOTS.skills) return;           // 枠がいっぱいなら新しいスキルは出ない
        cands.push({ kind: 'skill', key: k, star: s + 1 });
      });
      Object.keys(GC.ABILITIES).forEach((k) => {
        const s = p.abilities[k] || 0;
        if (s >= MAX) return;
        if (!s && ownedA >= GC.SLOTS.abilities) return;
        cands.push({ kind: 'ability', key: k, star: s + 1 });
      });
      const picked = shuffle(cands).slice(0, 3);
      if (!picked.length) picked.push({ kind: 'heal', key: 'heal', star: 0 });
      return picked;
    }
    startLevelup() {
      this.lvSeq++;
      const options = {};
      this.players.forEach((p) => { options[p.id] = this.optionsFor(p); });
      this.levelup = { seq: this.lvSeq, options, chosen: {} };
      this.events.push({ type: 'levelup', seq: this.lvSeq, level: this.level - this.pendingLv + 1 });
    }
    choose(id, seq, index) {
      const lu = this.levelup;
      if (!lu || lu.seq !== seq || lu.chosen[id] || !lu.options[id]) return false;
      const opt = lu.options[id][index] || lu.options[id][0];
      const p = this.players.get(id);
      if (p && opt) this.applyOption(p, opt);
      lu.chosen[id] = true;
      this.checkLevelupDone();
      return true;
    }
    checkLevelupDone() {
      const lu = this.levelup;
      if (!lu) return;
      const all = Object.keys(lu.options).every((id) => lu.chosen[id]);
      if (!all) return;
      this.levelup = null;
      this.pendingLv = Math.max(0, this.pendingLv - 1);
      this.events.push({ type: 'resume' });
      if (this.pendingLv > 0 && !this.ended) this.startLevelup();
    }
    applyOption(p, opt) {
      if (opt.kind === 'skill') {
        if (!p.skills[opt.key]) p.order.push(opt.key);
        p.skills[opt.key] = Math.min(EVO, (p.skills[opt.key] || 0) + 1);
      } else if (opt.kind === 'ability') {
        if (!p.abilities[opt.key]) p.aorder.push(opt.key);
        p.abilities[opt.key] = Math.min(EVO, (p.abilities[opt.key] || 0) + 1);
      } else if (opt.kind === 'heal' && !p.down) {
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
      }
    }
    get paused() { return !!this.levelup || !!this.roulette; }

    /* ======================= 敵 ======================= */
    spawnEnemy(type, x, y, extra) {
      const d = GC.ENEMIES[type];
      const min = this.t / 60;
      let hpMul;
      if (d.midboss) hpMul = GC.MIDBOSS_HP_SCALE * this.hpMult * this.partyDiff;
      else hpMul = hpCurve(min) * this.hpMult * (d.noParty ? 1 : this.partyDiff);
      const e = Object.assign({
        id: this.nextId++, type, ti: ENEMY_TYPES.indexOf(type), def: d,
        x: clamp(x, 30, this.W - 30), y: clamp(y, 30, this.H - 30), r: d.r,
        hp: d.hp * hpMul, maxHp: d.hp * hpMul, atk: d.atk * this.atkMult,
        burst: d.kamikaze ? d.kamikaze * this.atkMult : 0,
        speed: d.speed * rand(0.92, 1.08), xpv: d.xp,
        cd: d.ranged ? rand(1, d.ranged.cd) : 0,
        slow: 1, atkSlow: 1, flip: false, hits: null, last: null, frozen: 0,
        dashT: d.dash ? rand(1, d.dash.cd) : 0, dashS: null,
      }, extra);
      this.enemies.push(e);
      return e;
    }
    spawnGroup() {
      const alive = this.alivePlayers();
      if (!alive.length) return;
      const pool = this.roster.spawns.filter((s) => this.t >= s.from);
      let total = pool.reduce((a, s) => a + s.w, 0), r = Math.random() * total, pick = pool[0];
      for (const s of pool) { if (r < s.w) { pick = s; break; } r -= s.w; }
      const d = GC.ENEMIES[pick.type];
      const grow = Math.min(1, this.t / (GC.SPAWN.packFullAt || 1));
      const n = d.pack ? randi(Math.max(2, Math.round(d.pack[0] * (0.5 + 0.5 * grow))), Math.round(d.pack[0] + (d.pack[1] - d.pack[0]) * grow)) : randi(1, 2);
      const p = alive[Math.floor(Math.random() * alive.length)];
      const a = Math.random() * TAU, dd = rand(620, 760);
      const cx = p.x + Math.cos(a) * dd, cy = p.y + Math.sin(a) * dd;
      const F = GC.FLOOD, flood = F && this.t / 60 > F.from;
      for (let i = 0; i < n; i++) { const e = this.spawnEnemy(pick.type, cx + rand(-60, 60), cy + rand(-60, 60)); if (flood && F.speed) e.speed *= F.speed; }
    }
    /** 画面にいてほしい敵の数（終盤になるほど一気に増える） */
    desiredCount() {
      const S = GC.SPAWN, F = GC.FLOOD, min = this.t / 60;
      let n = S.base + S.perMin * min + (S.perMin2 || 0) * min * min;
      if (F && min > F.from) n = Math.max(n, n + (F.count - n) * clamp((min - F.from) / (F.full - F.from), 0, 1));   // 終盤の大群
      return Math.min(GC.MAX_ENEMIES, Math.round(n * this.partyMul(GC.PARTY.spawn)));
    }
    /** 終盤の大群の間は、出現の間隔を短くする */
    spawnInterval() {
      const F = GC.FLOOD, min = this.t / 60;
      return (F && min > F.from ? F.interval : GC.SPAWN.interval) / this.partyMul(GC.PARTY.spawn);
    }
    spawnMidboss() {
      const alive = this.alivePlayers();
      if (!alive.length) return;
      const p = alive[Math.floor(Math.random() * alive.length)];
      const a = Math.random() * TAU;
      const kind = this.roster.midboss || 'bigZombie';
      const e = this.spawnEnemy(kind, p.x + Math.cos(a) * 560, p.y + Math.sin(a) * 560, { mid: true });
      this.events.push({ type: 'midboss', id: e.id, name: GC.ENEMIES[kind].name });
    }
    spawnRushPack() {
      const alive = this.alivePlayers();
      if (!alive.length) return;
      const R = GC.RUSH;
      const p = alive[Math.floor(Math.random() * alive.length)];
      const a = this.rushDir + rand(-0.7, 0.7);
      const cx = p.x + Math.cos(a) * R.dist, cy = p.y + Math.sin(a) * R.dist;
      const types = this.roster.rush || ['wolf'];
      const n = randi(R.pack[0], R.pack[1]);
      const nx = -Math.sin(a), ny = Math.cos(a);
      for (let i = 0; i < n && this.enemies.length < R.max; i++) {
        const off = (i - n / 2) * 34, back = (i % 3) * 40;
        const e = this.spawnEnemy(types[i % types.length], cx + nx * off + Math.cos(a) * back, cy + ny * off + Math.sin(a) * back, { rush: true });
        e.speed *= R.speedMul;
      }
    }
    /** 試合の終わり（ふだん5分・圧倒モード3分）：雑魚と中ボスを消して、BOSS_INTRO.warp 秒後にボス戦の場所へワープする */
    startBossPhase() {
      const BI = GC.BOSS_INTRO;
      // 消える煙（プレイヤーの近くの敵だけ）
      let n = 0;
      for (const e of this.enemies) {
        if (e.dead || n >= 80) continue;
        let near = false;
        this.players.forEach((p) => { if (dist2(e.x, e.y, p.x, p.y) < 900 * 900) near = true; });
        if (!near) continue;
        this.fx.push({ id: this.nextId++, k: 13, x: e.x, y: e.y, rt: this.clock, r: e.r });
        n++;
      }
      this.bombs.forEach((b) => { b.tgt = null; });   // 消える雑魚を追いかけない
      this.enemies = []; this.eshots = []; this.blasts = this.blasts.filter((B) => B.hurts === 'enemies'); this.rush = 0;
      this.phase = 'warp'; this.introT = BI.warp;
      this.events.push({ type: 'bossWarp', sec: BI.warp });
    }
    /** ボス戦の場所へワープ：全員を横一列に並べ、少し前に回復アイテムを人数分置く。BOSS_INTRO.wait 秒後にボス */
    warpToBoss() {
      const BI = GC.BOSS_INTRO;
      const all = [...this.players.values()], alive = all.filter((p) => !p.down);
      const src = alive.length ? alive : all;
      if (!src.length) return;
      const cx = clamp(src.reduce((a, p) => a + p.x, 0) / src.length, 900, this.W - 900);
      const cy = clamp(src.reduce((a, p) => a + p.y, 0) / src.length, 1100, this.H - 900);
      this.bossHome = { x: cx, y: cy };
      const bx = cx, by = cy - GC.ALTAR.radius - 170;      // ボスが出てくる場所（北側）
      this.altar = { x: bx, y: by, r: BI.summonR };       // 出現の魔法陣
      // 全員を横一列でワープ（ボスの方を向く）
      const pos = {}, rowY = cy + 130;
      all.forEach((p, i) => {
        p.x = cx + (i - (all.length - 1) / 2) * BI.gap; p.y = rowY; p.face = -Math.PI / 2;
        pos[p.id] = [Math.round(p.x), Math.round(p.y)];
        if (p.ball) { p.ball.x = p.x; p.ball.y = p.y; }
        if (p.ball2) { p.ball2.x = p.x; p.ball2.y = p.y; }
        // 少し前に回復アイテム（だれでも取れる）
        this.heals.push({ id: this.nextId++, x: p.x, y: rowY - BI.healAhead, ratio: BI.healRatio });
        this.fx.push({ id: this.nextId++, k: 13, x: p.x, y: p.y, rt: this.clock, r: 30 });
      });
      // 開けていない宝箱もボス戦の場所へ
      this.chests.forEach((c, i) => { c.x = cx - 200 + (i % 5) * 100; c.y = cy + 260; });
      this.boxes = this.boxes.filter((b) => dist2(b.x, b.y, cx, cy) > 700 * 700);   // 近くのダンボールはどける
      this.phase = 'intro'; this.introT = BI.wait;
      this.events.push({ type: 'warp', pos, wait: BI.wait });
    }
    spawnBoss() {
      const key = this.roster.boss, d = GC.BOSSES[key];
      const n = this.players.size;
      const BP = GC.BOSS_PARTY;
      const hp = GC.BOSS_BASE_HP * (d.hp || 1) * BB.hp * this.hpMult * (n > 1 ? BP.timeRatio * (1 + BP.perExtra * (n - 1)) : 1);
      this.bombs.forEach((b) => { b.tgt = null; });
      this.enemies = []; this.eshots = []; this.blasts = this.blasts.filter((B) => B.hurts === 'enemies'); this.rush = 0;   // 雑魚は残さない（自分たちの攻撃は残す）
      const home = this.bossHome || { x: this.altar.x, y: this.altar.y + GC.ALTAR.radius + 170 };
      // ボスはワープした場所の北側（魔法陣）に出現
      this.boss = this.spawnEnemy('bigZombie', home.x, home.y - GC.ALTAR.radius - 170, {
        isBoss: true, bossKey: key, bdef: d, r: d.r, hp, maxHp: hp, speed: 0, xpv: 0, mid: false,
        cd: 2.5, gearAng: 0, ti: -1, home, mv: { st: 'walk', t: (d.move.cd || 4) * 0.6, ang: -Math.PI / 2 },
        atkT: d.attacks.map((a) => (a.cd || 3) * BB.cd * rand(0.3, 0.6)), spiralAng: 0, spiralOn: 0, ringRot: 0,
      });
      this.phase = 'boss';
      this.fx.push({ id: this.nextId++, k: 3, x: this.boss.x, y: this.boss.y, rt: this.clock, r: d.r });
      this.events.push({ type: 'boss', name: d.name });
    }
    damageEnemy(e, amount, owner) {
      if (e.hp <= 0) return;
      // キマイラ：与えたダメージの1%ぶん回復
      const p = this.players.get(owner);
      if (p && p.pas.chimera && !p.down) p.hp = Math.min(p.maxHp, p.hp + Math.min(amount, e.hp) * p.pas.chimera.steal);
      e.hp -= amount; e.last = owner;
      if (e.hp <= 0) this.killEnemy(e);
    }
    killEnemy(e) {
      e.dead = true;
      const p = this.players.get(e.last);
      if (p) {
        p.kills++;
        // ジャケット：200体倒すごとにHP5%回復
        if (p.pas.jacket && !p.down && p.kills % p.pas.jacket.kills === 0) {
          p.hp = Math.min(p.maxHp, p.hp + p.maxHp * p.pas.jacket.heal);
          this.fx.push({ id: this.nextId++, k: 9, x: p.x, y: p.y, rt: this.clock, o: p.slot });
        }
      }
      this.fx.push({ id: this.nextId++, k: e.isBoss ? 3 : 2, x: e.x, y: e.y, rt: this.clock, r: e.r });
      if (e.isBoss) { this.finish(true); return; }
      if (e.mid) {
        this.chests.push({ id: this.nextId++, x: e.x, y: e.y });
        this.events.push({ type: 'midbossDown', chest: true });
      }
      this.gainXp(e.xpv);
    }
    nearestEnemy(x, y, range, exclude) {
      let best = null, bd = range * range;
      this.grid.each(x, y, range, (e) => {
        if (e.dead || (exclude && exclude.has(e.id))) return;
        const d = dist2(x, y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      });
      return best;
    }
    enemiesNear(x, y, range) {
      const out = [];
      this.grid.each(x, y, range + 90, (e) => {
        if (!e.dead && dist2(x, y, e.x, e.y) < (range + e.r) * (range + e.r)) out.push(e);
      });
      return out;
    }

    /* ======================= 1ステップ ======================= */
    step(dt) {
      if (this.ended) return;
      if (this.roulette) { this.stepRoulette(dt); return; }   // 宝箱のルーレット中は時間が止まる
      if (this.levelup) return;
      this.clock += dt;
      const players = this.alivePlayers();

      // ---- 時間と流れ ----
      if (this.phase === 'battle') {
        this.t += dt * this.tScale;
        GC.MIDBOSS_TIMES.forEach((tm, i) => {
          if (this.midbossDone <= i && this.t >= tm) { this.midbossDone = i + 1; this.spawnMidboss(); }
        });
        if (this.t >= GC.MATCH_SECONDS) {
          this.t = GC.MATCH_SECONDS;
          this.startBossPhase();
        }
      } else if (this.phase === 'warp') {
        this.introT -= dt;
        if (this.introT <= 0) this.warpToBoss();
      } else if (this.phase === 'intro') {
        this.introT -= dt;
        if (this.introT <= 0) this.spawnBoss();
      }

      // ---- 中ボスの少し前のラッシュ ----
      if (this.phase === 'battle') {
        GC.MIDBOSS_TIMES.forEach((tm, i) => {
          if (this.rushDone <= i && this.t >= tm - GC.RUSH.before) {
            this.rushDone = i + 1; this.rush = GC.RUSH.duration / this.tScale; this.rushTimer = 0; this.rushDir = rand(0, TAU);
            this.events.push({ type: 'rush' });
          }
        });
        // 1分ごとにダンボールを追加
        this.boxTimer -= dt * this.tScale;
        if (this.boxTimer <= 0) { this.boxTimer += 60; this.spawnBoxes(GC.BOXES.perMinute); }
      }
      if (this.rush > 0 && this.phase === 'battle') {
        this.rush -= dt; this.rushTimer -= dt;
        if (this.rushTimer <= 0) { this.rushTimer = GC.RUSH.every / Math.sqrt(this.tScale); this.spawnRushPack(); }
      }

      // ---- 特殊スキル・パッシブの時間 ----
      if (this.widowT > 0) this.widowT -= dt;
      this.players.forEach((p) => {
        if (p.scd > 0) p.scd = Math.max(0, p.scd - dt);
        for (const k in p.buff) if (p.buff[k] > 0) p.buff[k] = Math.max(0, p.buff[k] - dt);
        if (p.cd.eternalBelt > 0) p.cd.eternalBelt -= dt;
        if (p.pas.plateArmor && !p.shield) {          // 鎧のシールドを張り直す
          p.cd.plateArmor = (p.cd.plateArmor || 0) - dt;
          if (p.cd.plateArmor <= 0 && !p.down) p.shield = true;
        }
      });

      // ---- ダンボールを壊す・回復アイテムを拾う ----
      for (const p of players) {
        this.hitBoxes(p.x, p.y, p.r, true);
        for (const h of this.heals) {
          if (!h.taken && dist2(p.x, p.y, h.x, h.y) < (p.r + 24) * (p.r + 24)) {
            h.taken = true;
            p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (h.ratio || GC.BOXES.healRatio));
            if (p.pas.leatherBelt) p.buff.lbelt = p.pas.leatherBelt.dur;
            this.fx.push({ id: this.nextId++, k: 9, x: p.x, y: p.y, rt: this.clock, o: p.slot });
          }
        }
      }
      // ---- 中ボスの宝箱を開ける（だれかが開けると、全員がルーレットで★を1つ上げる） ----
      for (const p of players) {
        if (this.roulette) break;
        for (const ch of this.chests) {
          if (ch.taken || dist2(p.x, p.y, ch.x, ch.y) > (p.r + GC.CHEST.r) * (p.r + GC.CHEST.r)) continue;
          this.openChest(p, ch);
          break;      // 1回に開けるのは1つ（ほかの宝箱はルーレットが終わってから）
        }
      }
      if (this.chests.some((c) => c.taken)) this.chests = this.chests.filter((c) => !c.taken);
      this.stepBombs(dt);
      if (this.boxes.some((b) => b.broken)) this.boxes = this.boxes.filter((b) => !b.broken);
      if (this.heals.some((h) => h.taken)) this.heals = this.heals.filter((h) => !h.taken);

      // ---- 回復・復活 ----
      let teamHeal = 0;    // ファッションベルト：どこにいても味方と自分を毎秒1%回復
      players.forEach((p) => { if (p.pas.fashionBelt) teamHeal += p.pas.fashionBelt.heal; });
      this.players.forEach((p) => {
        if (!p.down) {
          let regen = teamHeal;
          if (p.abilities.drink) regen += 0.01 * p.abilities.drink;          // エナジードリンク：★1で毎秒1%、★ごとに+1%（赤★1で6%）
          if (p.pas.eternalBoots) regen += p.pas.eternalBoots.heal;
          const mb = this.musicBuff(p);
          if (mb && mb.regen) regen += mb.regen / 100;                       // 楽器の広場：毎秒回復
          if (regen) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * regen * dt);
        }
        if (p.down) {
          const helper = players.some((q) => dist2(q.x, q.y, p.x, p.y) < GC.PLAYER.reviveRadius * GC.PLAYER.reviveRadius);
          p.revive = helper ? p.revive + dt : 0;
          if (p.revive >= GC.PLAYER.reviveSeconds) {
            p.down = false; p.revive = 0; p.hp = p.maxHp * GC.PLAYER.reviveHpRatio;
            this.events.push({ type: 'revive', id: p.id, name: p.name });
          }
        }
      });

      // ---- 出現 ----
      if (this.phase === 'battle') {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = this.spawnInterval();
          if (this.enemies.length < this.desiredCount()) this.spawnGroup();
        }
      }

      // ---- 格子を作り直す ----
      this.grid.clear();
      const baseSlow = this.widowT > 0 ? Math.max(0.1, 1 + this.widowSpd / 100) : 1;   // ウィドウのスキル
      for (const e of this.enemies) {
        e.slow = baseSlow; e.atkSlow = 1;
        if (e.frozen > 0) e.frozen -= dt;
        this.grid.insert(e);
      }

      // ---- 楽器の広場：中にいる味方（自分も）のバフの強さ（いちばん高い★だけ） ----
      this.players.forEach((p) => {
        let lv = 0;
        if (!p.down) for (const z of this.zones) if (z.kind === 3 && z.lv > lv && dist2(p.x, p.y, z.x, z.y) < z.r * z.r) lv = z.lv;
        p.musicLv = lv;
      });

      // ---- プレイヤーのまわりの効果（重力・フロストブーツ・ステラベルト） ----
      for (const p of players) {
        const g = p.skills.gravity;
        if (g) {
          // 重力発生機（進化：範囲1.6倍・ダメージ2倍）。拡大モジュールで範囲が広がる
          const gs = Math.min(g, EVO), ge = g >= EVO;
          const amt = Math.min(0.9, SP.gravity.slow + SP.gravity.slowStep * (gs - 1));
          const dps = (SP.gravity.dps + SP.gravity.dpsStep * (gs - 1)) * (ge ? EV.gravity.dps : 1) * this.atkOf(p);
          for (const e of this.enemiesNear(p.x, p.y, this.gravityR(p))) {
            if (!e.isBoss) e.slow = Math.min(e.slow, 1 - amt);
            this.damageEnemy(e, dps * dt, p.id);
          }
        }
        if (p.frost) for (const e of this.enemiesNear(p.x, p.y, p.frost.radius)) e.slow = Math.min(e.slow, 1 + p.frost.enemySpd / 100);
        if (p.stella) for (const e of this.enemiesNear(p.x, p.y, p.stella.radius)) e.atkSlow = Math.min(e.atkSlow, 1 + p.stella.enemyAtkSpd / 100);
      }

      // ---- 敵の行動 ----
      const FAR2 = 1800 * 1800;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.isBoss) { this.bossAct(e, players, dt); continue; }
        let tgt = null, td = Infinity;
        for (const p of players) { const d = dist2(e.x, e.y, p.x, p.y); if (d < td) { td = d; tgt = p; } }
        if (!tgt) continue;
        if (td > FAR2 && !e.mid) { e.dead = true; e.gone = true; continue; }   // 遠すぎる敵は消して近くに出し直す
        if (e.frozen > 0) continue;                                             // 凍っている敵は動けない
        const d = Math.sqrt(td);
        const dx = (tgt.x - e.x) / (d || 1), dy = (tgt.y - e.y) / (d || 1);
        const sp = e.speed * e.slow;
        const R = e.def.ranged;
        let mv = 1;
        if (R) {
          if (R.keep && d < R.keep) mv = -0.6; else if (R.keep && d < R.range) mv = 0.15;
          e.cd -= dt * e.atkSlow;
          if (e.cd <= 0 && d < R.range) {
            e.cd = R.cd;
            const mage = e.type === 'mageZombie';
            const proj = mage && this.roster.mageProj ? this.roster.mageProj : R.proj;
            this.eshots.push({ id: this.nextId++, kind: PROJ_KINDS.indexOf(proj), x: e.x, y: e.y - 10, vx: dx * R.speed, vy: dy * R.speed, r: R.pr, atk: e.atk, life: R.range / R.speed + 0.6, mage });
            if (mage) this.mageShots = (this.mageShots || 0) + 1;
          }
        }
        // 突進する中ボス（デュラハン）
        if (e.def.dash) {
          const D = e.def.dash;
          if (e.dashS) {
            e.dashS.t -= dt;
            if (e.dashS.st === 'wind') { mv = 0; if (e.dashS.t <= 0) { e.dashS.st = 'go'; e.dashS.t = D.dur; } }
            else {
              e.x += Math.cos(e.dashS.a) * D.speed * dt; e.y += Math.sin(e.dashS.a) * D.speed * dt; mv = 0;
              if (e.dashS.t <= 0) { e.dashS = null; e.dashT = D.cd; }
            }
          } else {
            e.dashT -= dt;
            if (e.dashT <= 0 && d < 600) e.dashS = { st: 'wind', t: D.wind, a: Math.atan2(dy, dx) };
          }
        }
        e.x += dx * sp * mv * dt; e.y += dy * sp * mv * dt;
        if (Math.abs(dx) > 0.2) e.flip = dx < 0;
        // 火の玉：ぶつかると爆発して消える
        if (e.burst && d < e.r + tgt.r + 4) {
          this.hurtPlayer(tgt, e.burst);
          e.dead = true;
          this.fx.push({ id: this.nextId++, k: 14, x: e.x, y: e.y, rt: this.clock, r: 50 });
          continue;
        }
        // 近接：触れている間ダメージ（クールタイムなし）
        if (e.def.melee && d < e.r + tgt.r + 4) this.hurtPlayer(tgt, e.atk * e.atkSlow * dt);
      }
      // 押し合い（重なりすぎ防止）
      for (const e of this.enemies) {
        if (e.dead || e.isBoss || e.def.phase) continue;
        this.grid.each(e.x, e.y, e.r * 2, (o) => {
          if (o === e || o.dead || o.def.phase) return;
          const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r;
          const d2 = dx * dx + dy * dy;
          if (d2 > 0 && d2 < rr * rr) {
            const d = Math.sqrt(d2), push = (rr - d) * 0.25;
            const w = o.isBoss || o.mid ? 1 : 0.5;
            e.x += dx / d * push * w * 2; e.y += dy / d * push * w * 2;
          }
        });
        e.x = clamp(e.x, 20, this.W - 20); e.y = clamp(e.y, 20, this.H - 20);
      }

      // ---- スキル ----
      for (const p of players) {
        this.skillsAct(p, dt);
        this.passivesAct(p, dt);
        if (p.char === 'kitties' && p.cs) this.healDroneAct(p, dt, players);
      }

      // ---- 弾 ----
      this.updateShots(dt);
      this.updateEnemyShots(dt, players);
      this.updateZones(dt);
      this.updateBlasts(dt, players);

      // ---- 掃除 ----
      if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
      this.fx = this.fx.filter((f) => this.clock - f.rt < 0.8);
    }

    /* ---------- ボス ---------- */
    nearestPlayer(x, y, players) {
      let tgt = null, td = Infinity;
      for (const p of players) { const d = dist2(x, y, p.x, p.y); if (d < td) { td = d; tgt = p; } }
      return tgt;
    }
    bossShot(b, a, A) {
      this.eshots.push({ id: this.nextId++, kind: PROJ_KINDS.indexOf(A.proj || 'magic'), x: b.x, y: b.y - 20,
        vx: Math.cos(a) * A.speed, vy: Math.sin(a) * A.speed, r: A.pr || 12, atk: A.atk * this.atkMult * GC.BOSS_DMG, life: 4.5 });
    }
    bossAct(b, players, dt) {
      const d = b.bdef, M = d.move || { t: 'static' };
      if (!players.length) return;
      const tgt = this.nearestPlayer(b.x, b.y, players);
      const slow = b.slow;
      // ---- 動き ----
      const mv = b.mv;
      if (M.t === 'static' && BB.staticWalk) {
        // 動かないボスも、ゆっくり近づいてくる（くっつきすぎない）
        const dx = tgt.x - b.x, dy = tgt.y - b.y, dd = Math.hypot(dx, dy);
        if (dd > b.r + 140) { b.x += dx / dd * BB.staticWalk * slow * dt; b.y += dy / dd * BB.staticWalk * slow * dt; }
        b.flip = dx < 0;
      } else if (M.t === 'walk' || M.t === 'dash') {
        if (mv.st === 'walk') {
          const a = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          b.x += Math.cos(a) * (M.speed || 40) * BB.speed * slow * dt; b.y += Math.sin(a) * (M.speed || 40) * BB.speed * slow * dt;
          b.flip = Math.cos(a) < 0;
          if (M.t === 'dash') {
            mv.t -= dt * BB.speed;
            if (mv.t <= 0) { mv.st = 'wind'; mv.t = M.wind; mv.ang = a; mv.len = M.dash * M.dur; }
          }
        } else if (mv.st === 'wind') {
          mv.t -= dt;
          if (mv.t <= 0) { mv.st = 'go'; mv.t = M.dur; }
        } else if (mv.st === 'go') {
          mv.t -= dt;
          b.x += Math.cos(mv.ang) * M.dash * dt; b.y += Math.sin(mv.ang) * M.dash * dt;
          if (mv.t <= 0) { mv.st = 'walk'; mv.t = M.cd; }
        }
      } else if (M.t === 'teleport') {
        mv.t -= dt * BB.speed;
        if (mv.t <= 0) {
          mv.t = M.cd;
          const p = players[Math.floor(Math.random() * players.length)];
          const a = rand(0, TAU), dd = rand(230, 330);
          this.fx.push({ id: this.nextId++, k: 13, x: b.x, y: b.y, rt: this.clock, r: b.r });
          b.x = p.x + Math.cos(a) * dd; b.y = p.y + Math.sin(a) * dd;
          this.fx.push({ id: this.nextId++, k: 13, x: b.x, y: b.y, rt: this.clock, r: b.r });
          // 現れてすぐは撃たない
          b.atkT = b.atkT.map((t) => Math.max(t, 0.6));
        }
      } else if (M.t === 'orbit') {
        mv.ang += (M.speed || 0.4) * BB.speed * slow * dt;
        const tx = b.home.x + Math.cos(mv.ang) * (M.radius || 260), ty = b.home.y + Math.sin(mv.ang) * (M.radius || 260);
        b.x += (tx - b.x) * Math.min(1, dt * 2); b.y += (ty - b.y) * Math.min(1, dt * 2);
        b.flip = Math.sin(mv.ang) > 0;
      }
      // 祭壇から離れすぎない
      const hx = b.x - b.home.x, hy = b.y - b.home.y, hd = Math.hypot(hx, hy), AR = GC.BOSS_ARENA;
      if (hd > AR) { b.x = b.home.x + hx / hd * AR; b.y = b.home.y + hy / hd * AR; if (mv.st === 'go') { mv.st = 'walk'; mv.t = M.cd || 4; } }
      // 触れるとダメージ（動くボス）
      if (d.touch) {
        for (const p of players) {
          if (dist2(b.x, b.y, p.x, p.y) < (b.r * 0.8 + p.r) * (b.r * 0.8 + p.r)) this.hurtPlayer(p, d.touch * this.atkMult * GC.BOSS_DMG * (mv.st === 'go' ? 2 : 1) * dt);
        }
      }
      // ---- 攻撃 ----
      const busy = mv.st === 'wind' || mv.st === 'go';
      d.attacks.forEach((A, i) => {
        if (A.t === 'gears') {
          b.gearAng += A.speed * dt;
          for (let k = 0; k < A.count; k++) {
            const a = b.gearAng + k * TAU / A.count;
            const gx = b.x + Math.cos(a) * A.radius, gy = b.y + Math.sin(a) * A.radius;
            for (const p of players) {
              if (dist2(gx, gy, p.x, p.y) < (A.r + p.r) * (A.r + p.r)) this.hurtPlayer(p, A.dps * this.atkMult * GC.BOSS_DMG * b.atkSlow * dt);
            }
          }
          return;
        }
        if (A.t === 'spiral' && b.spiralOn > 0) {
          b.spiralOn -= dt; b.spiralAng += A.spin * dt;
          b.spiralAcc = (b.spiralAcc || 0) + dt;
          while (b.spiralAcc >= A.every) {
            b.spiralAcc -= A.every;
            for (let k = 0; k < A.arms; k++) this.bossShot(b, b.spiralAng + k * TAU / A.arms, A);
          }
        }
        b.atkT[i] -= dt * b.atkSlow;
        if (b.atkT[i] > 0 || busy) return;
        b.atkT[i] = A.cd * BB.cd;
        const base = Math.atan2(tgt.y - b.y, tgt.x - b.x);
        if (A.t === 'aim') {
          for (let k = 0; k < A.n; k++) this.bossShot(b, base + (A.n > 1 ? (k / (A.n - 1) - 0.5) * A.spread : 0), A);
        } else if (A.t === 'ring') {
          b.ringRot += 0.37;
          for (let k = 0; k < A.n; k++) this.bossShot(b, b.ringRot + k * TAU / A.n, A);
        } else if (A.t === 'spiral') {
          b.spiralOn = A.dur; b.spiralAng = base; b.spiralAcc = 0;
        } else if (A.t === 'slam') {
          players.forEach((p) => this.blasts.push({ id: this.nextId++, kind: 0, x: p.x, y: p.y, r: A.r, t: A.delay, max: A.delay, dmg: A.atk * this.atkMult * GC.BOSS_DMG, hurts: 'players' }));
        } else if (A.t === 'rain') {
          for (let k = 0; k < A.n; k++) {
            const p = players[k % players.length];
            const a = rand(0, TAU), dd = k < players.length ? rand(0, 40) : rand(60, 200);
            this.blasts.push({ id: this.nextId++, kind: 1, x: p.x + Math.cos(a) * dd, y: p.y + Math.sin(a) * dd, r: A.r, t: A.delay + k * 0.06, max: A.delay + k * 0.06, dmg: A.atk * this.atkMult * GC.BOSS_DMG, hurts: 'players' });
          }
        } else if (A.t === 'summon') {
          const types = this.roster.spawns.map((s) => s.type).filter((t) => !GC.ENEMIES[t].midboss);
          for (let k = 0; k < A.n && this.enemies.length < 120; k++) {
            const a = k * TAU / A.n + rand(-0.2, 0.2);
            this.spawnEnemy(types[k % types.length], b.x + Math.cos(a) * (b.r + 50), b.y + Math.sin(a) * (b.r + 50), { summoned: true });
          }
          this.fx.push({ id: this.nextId++, k: 13, x: b.x, y: b.y, rt: this.clock, r: b.r * 1.6 });
        }
      });
    }
    /** 遅れて爆発する攻撃（ボスの衝撃・降ってくる攻撃・メテオ） */
    updateBlasts(dt, players) {
      if (!this.blasts.length) return;
      for (const B of this.blasts) {
        B.t -= dt;
        if (B.t > 0) continue;
        B.done = true;
        if (B.rect) {
          // 長方形（アカギのサイコロ）：範囲の中の敵すべてにダメージ
          this.fx.push({ id: this.nextId++, k: 18, x: B.x, y: B.y, rt: this.clock, r: B.r, tx: B.hh, ty: B.face });
          for (const e of this.enemies) {
            if (!e.dead && Math.abs(e.x - B.x) < B.r + e.r && Math.abs(e.y - B.y) < B.hh + e.r) this.damageEnemy(e, B.dmg, B.owner);
          }
          for (const b of this.boxes) if (!b.broken && Math.abs(b.x - B.x) < B.r && Math.abs(b.y - B.y) < B.hh) this.breakBox(b);
          continue;
        }
        this.fx.push({ id: this.nextId++, k: B.kind === 2 ? 12 : 14, x: B.x, y: B.y, rt: this.clock, r: B.r });
        if (B.hurts === 'players') {
          for (const p of players) if (dist2(B.x, B.y, p.x, p.y) < (B.r + p.r) * (B.r + p.r)) this.hurtPlayer(p, B.dmg);
        } else {
          for (const e of this.enemiesNear(B.x, B.y, B.r)) this.damageEnemy(e, B.dmg, B.owner);
          this.hitBoxes(B.x, B.y, B.r);
        }
      }
      this.blasts = this.blasts.filter((B) => !B.done);
    }

    /* ---------- プレイヤーのスキル ---------- */
    ready(p, key, cd, dt) {
      p.cd[key] = (p.cd[key] == null ? 0.3 : p.cd[key]) - dt;
      if (p.cd[key] > 0) return false;
      p.cd[key] = cd * this.cdMul(p);
      return true;
    }
    /** パッシブ用のタイマー（攻撃速度の影響を受けない） */
    pready(p, key, cd, dt) {
      const k = 'p_' + key;
      p.cd[k] = (p.cd[k] == null ? cd * 0.5 : p.cd[k]) - dt;
      if (p.cd[k] > 0) return false;
      p.cd[k] = cd;
      return true;
    }
    /** キティースの回復ドローン：近くの味方か自分の中で一番HPの割合が低い人を回復 */
    healDroneAct(p, dt, players) {
      const cs = p.cs;
      const ox = p.x + 34, oy = p.y - 50 + Math.sin(this.clock * 3.2) * 5;
      if (!p.hdrone) p.hdrone = { x: ox, y: oy, acc: 0 };
      const d = p.hdrone;
      d.x += (ox - d.x) * Math.min(1, dt * 8); d.y += (oy - d.y) * Math.min(1, dt * 8);
      d.acc += dt * cs.rate;
      if (d.acc < 1) return;
      d.acc -= 1;
      let tgt = null, low = 1;
      for (const q of players) {
        if (q.hp >= q.maxHp || dist2(p.x, p.y, q.x, q.y) > cs.radius * cs.radius) continue;
        const r = q.hp / q.maxHp;
        if (r < low) { low = r; tgt = q; }
      }
      if (!tgt) return;
      tgt.hp = Math.min(tgt.maxHp, tgt.hp + tgt.maxHp * cs.heal);
      this.fx.push({ id: this.nextId++, k: 10, x: d.x, y: d.y, tx: tgt.x, ty: tgt.y, rt: this.clock, o: tgt.slot });
    }
    /** ライトセイバーの範囲（★と剣聖で広がる） */
    saberRange(p) {
      const L = SP.lightsaber, s = p.skills.lightsaber || 1;
      return L.r * (1 + L.rStep * (Math.min(s, EVO) - 1)) * (s >= EVO ? EV.lightsaber.range : 1) * (p.cs && p.cs.saberRange ? p.cs.saberRange : 1) * this.areaMul(p);
    }
    skillsAct(p, dt) {
      const atk = this.atkOf(p);
      const S = p.skills;
      const am = this.areaMul(p);                       // 拡大モジュール
      const evo = (k) => (S[k] || 0) >= EVO;            // 赤★1（進化）
      const st = (k) => Math.min(S[k] || 0, EVO);

      const bm = this.bulletMul(p);                     // ガス注入：弾が速くなる
      // クナイ：追尾して必中（進化：0.4秒ごとに8本）
      if (S.kunai && this.ready(p, 'kunai', (evo('kunai') ? EV.kunai.cd : SP.kunai.cd) * this.wcd(p), dt)) {
        const used = new Set(), targets = [];
        const count = evo('kunai') ? EV.kunai.count : S.kunai;
        for (let i = 0; i < count; i++) {
          const t = this.nearestEnemy(p.x, p.y, SP.kunai.range, used) || targets[i % Math.max(1, targets.length)];
          if (!t) break;
          used.add(t.id); targets.push(t);
        }
        if (!targets.length) p.cd.kunai = 0.1;
        targets.forEach((t, i) => {
          const a = Math.atan2(t.y - p.y, t.x - p.x) + (i - (targets.length - 1) / 2) * 0.25;
          this.shots.push({ id: this.nextId++, kind: 0, owner: p.id, x: p.x, y: p.y, vx: Math.cos(a) * SP.kunai.speed * bm, vy: Math.sin(a) * SP.kunai.speed * bm, sp: SP.kunai.speed * bm, tgt: t, dmg: atk * SP.kunai.dmg, life: 2.5, r: 8 * am });
        });
      }
      // ショットガン：散弾（進化：0.35秒ごとに広い散弾）
      if (S.shotgun) {
        const E = evo('shotgun');
        const cd = E ? EV.shotgun.cd : SP.shotgun.cd - SP.shotgun.cdStep * (S.shotgun - 1);
        if (this.ready(p, 'shotgun', cd * this.wcd(p), dt)) {
          // 近くの敵に向けて撃つ（オートエイム）。少し遠い敵にも向けて撃ち始める
          const t = this.nearestEnemy(p.x, p.y, SP.shotgun.range * (SP.shotgun.aim || 1) + 40);
          if (!t) p.cd.shotgun = 0.1;
          else {
            const base = Math.atan2(t.y - p.y, t.x - p.x);
            const n = E ? EV.shotgun.pellets : SP.shotgun.pellets, spread = E ? EV.shotgun.spread : SP.shotgun.spread;
            const per = atk * SP.shotgun.total * Math.pow(SP.shotgun.mult, st('shotgun') - 1) / n;
            for (let i = 0; i < n; i++) {
              const a = base + (i / (n - 1) - 0.5) * spread + rand(-0.04, 0.04);
              this.shots.push({ id: this.nextId++, kind: 1, owner: p.id, x: p.x, y: p.y, vx: Math.cos(a) * SP.shotgun.speed * bm, vy: Math.sin(a) * SP.shotgun.speed * bm, dmg: per, life: SP.shotgun.range / (SP.shotgun.speed * bm), r: 5 * am });
            }
          }
        }
      }
      // ライトセイバー：近くの敵を自動で狙って（オートエイム）90度の範囲を斬る
      // 届くところに敵（なければダンボール）がいないときは、振らずに待つ
      // 進化：0.4秒ごとに全方向を回転斬り（いつも発動）
      if (S.lightsaber) {
        const L = SP.lightsaber;
        const r = this.saberRange(p);
        const dmg = atk * L.dmg * Math.pow(L.mult, st('lightsaber') - 1);
        if (evo('lightsaber')) {
          if (this.ready(p, 'lightsaber', EV.lightsaber.cd * this.wcd(p), dt)) {
            this.enemiesNear(p.x, p.y, r).forEach((e) => this.damageEnemy(e, dmg, p.id));
            this.hitBoxes(p.x, p.y, r);
            this.fx.push({ id: this.nextId++, k: 11, x: p.x, y: p.y, r, rt: this.clock, o: p.slot });
          }
        } else {
          const cd = Math.max(0.2, L.cd - L.cdStep * (S.lightsaber - 1));
          let tgt = this.nearestEnemy(p.x, p.y, r + 60);
          if (tgt && Math.hypot(tgt.x - p.x, tgt.y - p.y) > r + tgt.r) tgt = null;
          if (!tgt) tgt = this.boxes.find((bx) => !bx.broken && dist2(p.x, p.y, bx.x, bx.y) < (r + bx.r) * (r + bx.r)) || null;
          if (!tgt) p.cd.lightsaber = Math.max(0, (p.cd.lightsaber == null ? 0.3 : p.cd.lightsaber) - dt);
          else if (this.ready(p, 'lightsaber', cd * this.wcd(p), dt)) {
            const aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
            this.enemiesNear(p.x, p.y, r).forEach((e) => {
              const a = Math.atan2(e.y - p.y, e.x - p.x);
              const slack = Math.asin(Math.min(1, e.r / Math.max(1, Math.hypot(e.x - p.x, e.y - p.y))));   // 大きい敵は少し外れても当たる
              if (Math.abs(angDiff(a, aim)) <= L.arc / 2 + slack) this.damageEnemy(e, dmg, p.id);
            });
            this.hitBoxes(p.x + Math.cos(aim) * r * 0.6, p.y + Math.sin(aim) * r * 0.6, r * 0.5);
            this.fx.push({ id: this.nextId++, k: 6, x: p.x, y: p.y, r, a: aim, rt: this.clock, o: p.slot });
          }
        }
      }
      // ミニガン：10秒撃ち続けて、リロード（★でリロードが短くなる）。近くの敵を自動で狙う
      // 進化：リロードなしで1秒に30発
      if (S.minigun) {
        const M = SP.minigun, E = evo('minigun');
        if (!p.mg) p.mg = { st: 'fire', t: M.fire, acc: 0 };
        const mg = p.mg;
        if (E && mg.st === 'reload') { mg.st = 'fire'; mg.t = M.fire; }
        if (mg.st === 'reload') {
          mg.t -= dt;
          if (mg.t <= 0) { mg.st = 'fire'; mg.t = M.fire; }
        } else {
          const t = this.nearestEnemy(p.x, p.y, M.range);
          if (t) {
            if (!E) mg.t -= dt;
            const burst = p.pas.minigun && p.buff.mgBurst > 0 ? p.pas.minigun.rate : 1;
            mg.acc += (E ? EV.minigun.rate : M.rate) * burst * dt / (this.cdMul(p) * this.wcd(p));
            while (mg.acc >= 1) {
              mg.acc -= 1;
              const a = Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.06, 0.06);
              this.shots.push({ id: this.nextId++, kind: 3, owner: p.id, x: p.x, y: p.y - 6, vx: Math.cos(a) * M.speed * bm, vy: Math.sin(a) * M.speed * bm, dmg: atk * M.dmg, life: M.range / (M.speed * bm), r: 5 * am });
            }
            if (mg.t <= 0) { mg.st = 'reload'; mg.t = Math.max(0.5, M.reload - M.reloadStep * (S.minigun - 1)); mg.acc = 0; }
          } else mg.acc = Math.min(mg.acc, 1);
        }
      }
      // 破壊の力：近くの敵を自動で狙ってブラックホールを撃つ（進化：2秒ごとに大きなブラックホール）
      if (S.destroyerPower) {
        const D = SP.destroyerPower, E = evo('destroyerPower');
        if (this.ready(p, 'destroyerPower', (E ? EV.destroyerPower.cd : D.cd) * this.wcd(p), dt)) {
          const t = this.nearestEnemy(p.x, p.y, D.range);
          if (!t) p.cd.destroyerPower = 0.2;
          else this.spawnHole(p, t.x, t.y, E ? EV.destroyerPower.scale : 1, E ? EV.destroyerPower.dur : D.dur + D.durStep * (S.destroyerPower - 1), atk);
        }
      }
      // リボルバー：近くの敵1体を撃ち抜く（デュアル中は2発）（進化：0.25秒ごと）
      if (S.revolver) {
        const V = SP.revolver;
        const cd = evo('revolver') ? EV.revolver.cd : Math.max(0.1, V.cd - V.cdStep * (S.revolver - 1));
        if (this.ready(p, 'revolver', cd * this.wcd(p), dt)) {
          const shots = p.buff.dual > 0 ? 2 : 1;
          const used = new Set();
          for (let i = 0; i < shots; i++) {
            const t = this.nearestEnemy(p.x, p.y, V.range, used) || (i > 0 ? this.nearestEnemy(p.x, p.y, V.range) : null);
            if (!t) { if (i === 0) p.cd.revolver = 0.05; break; }
            used.add(t.id);
            this.fx.push({ id: this.nextId++, k: 4, x: p.x + (i ? 8 : -4), y: p.y - 6, tx: t.x, ty: t.y, rt: this.clock });
            this.damageEnemy(t, atk * V.dmg * Math.pow(V.mult, st('revolver') - 1), p.id);
            // 拡大モジュール：撃ち抜いた敵のまわりにも少し当たる
            if (am > 1) this.enemiesNear(t.x, t.y, 30 * (am - 1) * 2).forEach((e) => { if (e !== t) this.damageEnemy(e, atk * V.dmg * 0.5, p.id); });
          }
        }
      }
      // ディフェンサー：回る歯車（進化：8つ・速く回る・当たる間隔が半分）
      if (S.defender) {
        const E = evo('defender');
        p.gearAng += (E ? EV.defender.speed : SP.defender.angSpeed) * dt;
        const n = E ? EV.defender.count : S.defender + 1;
        const gr = SP.defender.r * am, hitCd = E ? EV.defender.hitCd : SP.defender.hitCd;
        for (let i = 0; i < n; i++) {
          const a = p.gearAng + i * TAU / n;
          const gx = p.x + Math.cos(a) * SP.defender.orbit, gy = p.y + Math.sin(a) * SP.defender.orbit;
          this.hitBoxes(gx, gy, gr);
          this.grid.each(gx, gy, gr + 60, (e) => {
            if (e.dead || dist2(gx, gy, e.x, e.y) > (gr + e.r) * (gr + e.r)) return;
            if (this.hitReady(e, 'g' + p.id, hitCd)) this.damageEnemy(e, atk * SP.defender.dmg, p.id);
          });
        }
      }
      // ドローン：近くの敵を狙って撃つ（命中率50%）（進化：発射数1.5倍・必中）
      if (S.drone) {
        const E = evo('drone');
        const ox = p.x - 34, oy = p.y - 46 + Math.sin(this.clock * 4) * 4;
        if (!p.drone) p.drone = { x: ox, y: oy, tgt: null, miss: 0 };
        p.drone.x += (ox - p.drone.x) * Math.min(1, dt * 8); p.drone.y += (oy - p.drone.y) * Math.min(1, dt * 8);
        let t = p.drone.tgt;
        if (!t || t.dead || dist2(p.x, p.y, t.x, t.y) > SP.drone.range * SP.drone.range) t = p.drone.tgt = this.nearestEnemy(p.x, p.y, SP.drone.range);
        if (t) {
          p.droneAcc += (SP.drone.rate + SP.drone.rateStep * (st('drone') - 1)) * (E ? EV.drone.rate : 1) * dt / this.cdMul(p);
          const acc = E ? EV.drone.accuracy : SP.drone.accuracy;
          while (p.droneAcc >= 1 && !t.dead) {
            p.droneAcc -= 1;
            if (Math.random() < acc) this.damageEnemy(t, atk * SP.drone.dmg, p.id);
            else p.drone.miss = this.clock;        // 外れた（描画で弾がそれる）
          }
        } else p.droneAcc = 0;
      }
      // 雷発生機（進化：0.7秒ごとに6本）
      if (S.thunder && this.ready(p, 'thunder', evo('thunder') ? EV.thunder.cd : SP.thunder.cd, dt)) {
        const cands = this.byDistance(p, this.enemiesNear(p.x, p.y, SP.thunder.range));
        if (!cands.length) p.cd.thunder = 0.2;
        const fr = SP.thunder.fieldR * am;
        cands.slice(0, evo('thunder') ? EV.thunder.count : S.thunder).forEach((t) => {
          this.fx.push({ id: this.nextId++, k: 0, x: t.x, y: t.y, rt: this.clock });
          this.zones.push({ id: this.nextId++, kind: 0, owner: p.id, x: t.x, y: t.y, r: fr, dps: atk * SP.thunder.fieldDps, life: SP.thunder.fieldTime, max: SP.thunder.fieldTime });
          this.damageEnemy(t, atk * SP.thunder.dmg, p.id);
        });
      }
      // サッカーボール：画面の端で跳ね返る（進化：2つ・速い）
      if (S.soccer) {
        const E = evo('soccer');
        const r = (SP.soccer.r + SP.soccer.rStep * (Math.min(S.soccer, GC.MAX_STAR) - 1)) * am;   // 進化しても大きさは★5のまま（2つになる）
        const sp = (SP.soccer.speed + SP.soccer.speedStep * (st('soccer') - 1)) * (E ? EV.soccer.speed : 1);
        const aimFrom = (b) => {   // オートエイム：ボールから一番近い敵の方へ
          const t = this.nearestEnemy(b.x, b.y, 520);
          if (t) { const a = Math.atan2(t.y - b.y, t.x - b.x); b.vx = Math.cos(a); b.vy = Math.sin(a); }
        };
        if (!p.ball) { const a = rand(0, TAU); p.ball = { x: p.x, y: p.y, vx: Math.cos(a), vy: Math.sin(a) }; aimFrom(p.ball); }
        if (E && !p.ball2) { const a = rand(0, TAU); p.ball2 = { x: p.x, y: p.y, vx: Math.cos(a), vy: Math.sin(a) }; }
        [p.ball, E ? p.ball2 : null].forEach((b, bi) => {
          if (!b) return;
          const len = Math.hypot(b.vx, b.vy) || 1;
          b.vx /= len; b.vy /= len;
          b.x += b.vx * sp * dt; b.y += b.vy * sp * dt;
          const L = p.x - p.vw + r, R = p.x + p.vw - r, T = p.y - p.vh + r, B = p.y + p.vh - r;
          let bounced = false;
          if (b.x < L) { b.x = L; b.vx = Math.abs(b.vx); bounced = true; } else if (b.x > R) { b.x = R; b.vx = -Math.abs(b.vx); bounced = true; }
          if (b.y < T) { b.y = T; b.vy = Math.abs(b.vy); bounced = true; } else if (b.y > B) { b.y = B; b.vy = -Math.abs(b.vy); bounced = true; }
          if (bounced && bi === 0) aimFrom(b);
          b.r = r;
          this.hitBoxes(b.x, b.y, r);
          this.grid.each(b.x, b.y, r + 60, (e) => {
            if (e.dead || dist2(b.x, b.y, e.x, e.y) > (r + e.r) * (r + e.r)) return;
            if (this.hitReady(e, 'b' + bi + p.id, SP.soccer.hitCd)) this.damageEnemy(e, atk * SP.soccer.dmg, p.id);
          });
        });
      }
      // 火炎瓶（進化：1.2秒ごとに4つ）
      if (S.molotov && this.ready(p, 'molotov', evo('molotov') ? EV.molotov.cd : SP.molotov.cd, dt)) {
        const near = this.byDistance(p, this.enemiesNear(p.x, p.y, 320));
        const nb = SP.molotov.bottles + SP.molotov.moreAt.filter((n) => S.molotov >= n).length, s2 = st('molotov');   // ★2・★4・赤★1 で1本ずつ増える
        for (let i = 0; i < nb; i++) {
          let tx, ty;
          if (near[i]) { tx = near[i].x; ty = near[i].y; }
          else { const a = rand(0, TAU); tx = p.x + Math.cos(a) * SP.molotov.throwDist; ty = p.y + Math.sin(a) * SP.molotov.throwDist; }
          this.bottles.push({ id: this.nextId++, owner: p.id, x0: p.x, y0: p.y, x1: tx, y1: ty, t: 0, dur: 0.6 / bm,
            r: (SP.molotov.r + SP.molotov.rStep * (s2 - 1)) * am, dps: atk * (SP.molotov.dps + SP.molotov.dpsStep * (s2 - 1)) });
        }
      }
      // ロケット：近くの敵へ撃って爆発（★3・★5 で1発ずつ増える。進化：1.2秒ごとに5発・大きな爆発）
      if (S.rocket) {
        const R = SP.rocket, E = evo('rocket');
        if (this.ready(p, 'rocket', E ? EV.rocket.cd : R.cd, dt)) {
          const n = E ? EV.rocket.count : R.count + R.moreAt.filter((m) => S.rocket >= m).length;
          const used = new Set(), targets = [];
          for (let i = 0; i < n; i++) {
            const t = this.nearestEnemy(p.x, p.y, R.range, used) || targets[i % Math.max(1, targets.length)];
            if (!t) break;
            used.add(t.id); targets.push(t);
          }
          if (!targets.length) p.cd.rocket = 0.2;
          const lv = st('rocket');
          const dmg = atk * (R.dmg + R.dmgStep * (lv - 1));
          const er = (R.r + R.rStep * (lv - 1)) * (E ? EV.rocket.scale : 1) * am;
          const sp = R.speed * bm;
          targets.forEach((t, i) => {
            const a = Math.atan2(t.y - p.y, t.x - p.x) + (i - (targets.length - 1) / 2) * 0.45;
            this.shots.push({ id: this.nextId++, kind: 4, owner: p.id, x: p.x, y: p.y - 8, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, tgt: t, dmg, er, life: R.range * 1.5 / sp, r: 10 * am });
          });
        }
      }
      // エネルギーブレード：まわりの敵を一掃（★ごとに1秒短く・広く。進化：3秒ごと・さらに広く強く）
      if (S.energyBlade) {
        const B = SP.energyBlade, E = evo('energyBlade'), lv = st('energyBlade');
        const cd = E ? EV.energyBlade.cd : Math.max(1, B.cd - B.cdStep * (lv - 1));
        if (this.ready(p, 'energyBlade', cd, dt)) {
          const r = (B.r + B.rStep * (lv - 1)) * (E ? EV.energyBlade.r : 1) * am;
          const dmg = atk * B.dmg * (E ? EV.energyBlade.dmg : 1);
          this.enemiesNear(p.x, p.y, r).forEach((e) => this.damageEnemy(e, dmg, p.id));
          this.hitBoxes(p.x, p.y, r);
          this.fx.push({ id: this.nextId++, k: 24, x: p.x, y: p.y, r, rt: this.clock, o: p.slot });
        }
      }
      // 楽器：その場に音楽の広場を置く（前の広場は消える）。中の味方にバフ（ダメージなし）
      if (S.music) {
        const lv = st('music'), r = (SP.music.r + SP.music.rStep * (lv - 1)) * (lv >= EVO ? EV.music.r : 1) * am;   // ★が上がるたびに広くなる
        const mine = this.zones.find((z) => z.kind === 3 && z.owner === p.id);
        if (mine) { mine.lv = lv; mine.r = r; }                   // ★が上がったらすぐ反映
        if (this.ready(p, 'music', SP.music.cd, dt)) {
          this.zones = this.zones.filter((z) => !(z.kind === 3 && z.owner === p.id));
          const life = SP.music.cd + 0.5;
          this.zones.push({ id: this.nextId++, kind: 3, owner: p.id, x: p.x, y: p.y, r, dps: 0, life, max: life, lv, slot: p.slot });
          this.fx.push({ id: this.nextId++, k: 23, x: p.x, y: p.y, rt: this.clock, r, o: p.slot });
        }
      }
    }
    /** 装備のパッシブ（エピック以上） */
    passivesAct(p, dt) {
      const P = p.pas;
      if (!P) return;
      const atk = this.atkOf(p);
      // クナイ：5秒に1度、5個拡散して投げる
      if (P.kunai && this.pready(p, 'kunai', P.kunai.cd, dt)) {
        const t = this.nearestEnemy(p.x, p.y, 700);
        const base = t ? Math.atan2(t.y - p.y, t.x - p.x) : p.face;
        for (let i = 0; i < P.kunai.count; i++) {
          const a = base + (i - (P.kunai.count - 1) / 2) * 0.22;
          const bm = this.bulletMul(p);
          this.shots.push({ id: this.nextId++, kind: 2, owner: p.id, x: p.x, y: p.y, vx: Math.cos(a) * SP.kunai.speed * bm, vy: Math.sin(a) * SP.kunai.speed * bm, dmg: atk * P.kunai.dmg, life: 0.95 / bm, r: 9 * this.areaMul(p) });
        }
      }
      // ショットガン：10秒に1度、全方向に撃つ
      if (P.shotgun && this.pready(p, 'shotgun', P.shotgun.cd, dt)) {
        for (let i = 0; i < P.shotgun.count; i++) {
          const a = i * TAU / P.shotgun.count + rand(-0.08, 0.08);
          const bm = this.bulletMul(p);
          this.shots.push({ id: this.nextId++, kind: 1, owner: p.id, x: p.x, y: p.y, vx: Math.cos(a) * SP.shotgun.speed * bm, vy: Math.sin(a) * SP.shotgun.speed * bm, dmg: atk * P.shotgun.dmg, life: SP.shotgun.range * 1.2 / (SP.shotgun.speed * bm), r: 5 * this.areaMul(p) });
        }
        this.fx.push({ id: this.nextId++, k: 7, x: p.x, y: p.y, r: 90, rt: this.clock });
      }
      // ライトセイバー：15秒に1度、全方向に大きく回転斬り
      if (P.lightsaber && this.pready(p, 'lightsaber', P.lightsaber.cd, dt)) {
        const L = SP.lightsaber, s = p.skills.lightsaber || 1;
        const r = this.saberRange(p) * P.lightsaber.range;
        const dmg = atk * L.dmg * Math.pow(L.mult, Math.min(s, EVO) - 1) * P.lightsaber.dmg;
        this.enemiesNear(p.x, p.y, r).forEach((e) => this.damageEnemy(e, dmg, p.id));
        this.hitBoxes(p.x, p.y, r);
        this.fx.push({ id: this.nextId++, k: 11, x: p.x, y: p.y, r, rt: this.clock, o: p.slot });
      }
      // リボルバー：10秒に1度、3秒間デュアルリボルバー
      if (P.revolver && this.pready(p, 'revolver', P.revolver.cd, dt)) p.buff.dual = P.revolver.dur;
      // ミニガン：10秒に1度、3秒間 連射速度3倍
      if (P.minigun && this.pready(p, 'minigun', P.minigun.cd, dt)) p.buff.mgBurst = P.minigun.dur;
      // 破壊の力：20秒に1度、大きなブラックホール
      if (P.destroyerPower && this.pready(p, 'destroyerPower', P.destroyerPower.cd, dt)) {
        let t = this.nearestEnemy(p.x, p.y, 600);
        if (this.boss && !this.boss.dead && dist2(p.x, p.y, this.boss.x, this.boss.y) < 700 * 700) t = this.boss;
        if (t) this.spawnHole(p, t.x, t.y, P.destroyerPower.scale, P.destroyerPower.dur, atk);
        else p.cd.p_destroyerPower = 0.5;
      }
      // クローン義足：移動している間、3秒ごとにHP1%回復
      if (P.cloneLeg) {
        if (p.movingT > 0) {
          p.movingT -= dt; p.legT += dt;
          if (p.legT >= P.cloneLeg.every) { p.legT -= P.cloneLeg.every; p.hp = Math.min(p.maxHp, p.hp + p.maxHp * P.cloneLeg.heal); }
        }
      }
      // ステラベルト：45秒に1度、メテオ
      if (P.stellaBelt && this.pready(p, 'stella', P.stellaBelt.cd, dt)) {
        let t = this.nearestEnemy(p.x, p.y, 600);
        if (this.boss && !this.boss.dead && dist2(p.x, p.y, this.boss.x, this.boss.y) < 700 * 700) t = this.boss;
        const x = t ? t.x : p.x + Math.cos(p.face) * 200, y = t ? t.y : p.y + Math.sin(p.face) * 200;
        this.blasts.push({ id: this.nextId++, kind: 2, x, y, r: P.stellaBelt.r * this.areaMul(p), t: 0.7, max: 0.7, dmg: atk * P.stellaBelt.dmg, hurts: 'enemies', owner: p.id });
      }
      // フロストブーツ：10秒に1度、一番近い敵を凍らせる（中ボス・ボス以外）
      if (P.frostBoots && this.pready(p, 'frost', P.frostBoots.cd, dt)) {
        let best = null, bd = 600 * 600;
        this.grid.each(p.x, p.y, 600, (e) => {
          if (e.dead || e.mid || e.isBoss || e.frozen > 0) return;
          const d = dist2(p.x, p.y, e.x, e.y);
          if (d < bd) { bd = d; best = e; }
        });
        if (best) { best.frozen = P.frostBoots.dur; this.fx.push({ id: this.nextId++, k: 17, x: best.x, y: best.y, tx: p.x, ty: p.y, rt: this.clock }); }
        else p.cd.p_frost = 0.5;
      }
    }
    /** 近い順に並べる（オートエイム用） */
    byDistance(p, list) {
      return list.map((e) => [dist2(p.x, p.y, e.x, e.y), e]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    }
    /** ブラックホールをつくる（破壊の力） */
    spawnHole(p, x, y, scale, dur, atk) {
      const D = SP.destroyerPower, s = Math.min(p.skills.destroyerPower || 1, EVO);
      const r = (D.r + D.rStep * (s - 1)) * scale * this.areaMul(p);
      this.zones.push({ id: this.nextId++, kind: 2, owner: p.id, x, y, r, dps: atk * D.dps, life: dur, max: dur, pull: D.pull, pullR: r * D.pullR });
      this.fx.push({ id: this.nextId++, k: 19, x: p.x, y: p.y - 10, tx: x, ty: y, rt: this.clock });
    }
    hitReady(e, key, cd) {
      if (!e.hits) e.hits = {};
      const last = e.hits[key];
      if (last != null && this.clock - last < cd) return false;
      e.hits[key] = this.clock;
      return true;
    }

    updateShots(dt) {
      for (const s of this.shots) {
        s.life -= dt;
        if (s.kind === 0) {
          // クナイ：標的を追いかける。倒されていたら近くの別の敵へ
          if (!s.tgt || s.tgt.dead) s.tgt = this.nearestEnemy(s.x, s.y, 320);
          if (s.tgt) {
            const dx = s.tgt.x - s.x, dy = s.tgt.y - s.y, d = Math.hypot(dx, dy) || 1;
            const sp = s.sp || SP.kunai.speed;
            s.vx += (dx / d * sp - s.vx) * Math.min(1, dt * 14);
            s.vy += (dy / d * sp - s.vy) * Math.min(1, dt * 14);
            if (d < s.tgt.r + s.r + 6) { this.damageEnemy(s.tgt, s.dmg, s.owner); s.life = 0; continue; }
          }
          s.x += s.vx * dt; s.y += s.vy * dt;
          this.cutShots(s.x, s.y, s.r);
        } else if (s.kind === 4) {
          // ロケット：標的に向かって曲がりながら飛び、敵に当たるか届かなくなったら爆発
          if (!s.tgt || s.tgt.dead) s.tgt = this.nearestEnemy(s.x, s.y, 320);
          if (s.tgt) {
            const dx = s.tgt.x - s.x, dy = s.tgt.y - s.y, d = Math.hypot(dx, dy) || 1;
            const k = Math.min(1, dt * SP.rocket.turn);
            s.vx += (dx / d * s.sp - s.vx) * k; s.vy += (dy / d * s.sp - s.vy) * k;
          }
          s.x += s.vx * dt; s.y += s.vy * dt;
          let hit = false;
          this.grid.each(s.x, s.y, s.r + 60, (e) => { if (!hit && !e.dead && dist2(s.x, s.y, e.x, e.y) < (s.r + e.r) * (s.r + e.r)) hit = true; });
          if (hit || s.life <= 0) this.explodeRocket(s);
        } else {
          s.x += s.vx * dt; s.y += s.vy * dt;
          this.hitBoxes(s.x, s.y, s.r);
          this.grid.each(s.x, s.y, s.r + 60, (e) => {
            if (s.life <= 0 || e.dead) return;
            if (dist2(s.x, s.y, e.x, e.y) < (s.r + e.r) * (s.r + e.r)) { this.damageEnemy(e, s.dmg, s.owner); s.life = 0; }
          });
        }
      }
      this.shots = this.shots.filter((s) => s.life > 0);

      for (const b of this.bottles) {
        b.t += dt;
        if (b.t >= b.dur) {
          b.done = true;
          this.zones.push({ id: this.nextId++, kind: 1, owner: b.owner, x: b.x1, y: b.y1, r: b.r, dps: b.dps, life: SP.molotov.time, max: SP.molotov.time });
        }
      }
      this.bottles = this.bottles.filter((b) => !b.done);
    }
    /** ロケットの爆発：まわりの敵にまとめてダメージ（ボスにも当たる）。近くのダンボールもこわれる */
    explodeRocket(s) {
      if (s.boom) return;
      s.boom = true; s.life = 0;
      this.fx.push({ id: this.nextId++, k: 22, x: s.x, y: s.y, rt: this.clock, r: s.er });
      this.enemiesNear(s.x, s.y, s.er).forEach((e) => this.damageEnemy(e, s.dmg, s.owner));
      this.hitBoxes(s.x, s.y, s.er * 0.6);
    }
    updateEnemyShots(dt, players) {
      for (const s of this.eshots) {
        if (s.life <= 0) continue;   // こちらの攻撃で消された弾
        s.life -= dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        for (const p of players) {
          if (dist2(s.x, s.y, p.x, p.y) < (s.r + p.r) * (s.r + p.r)) { this.hurtPlayer(p, s.atk); s.life = 0; break; }
        }
      }
      this.eshots = this.eshots.filter((s) => s.life > 0);
      this.mageShots = this.eshots.reduce((n, s) => n + (s.mage ? 1 : 0), 0);
    }
    updateZones(dt) {
      for (const z of this.zones) {
        z.life -= dt;
        if (z.pull) {   // ブラックホール：まわりの敵を吸い寄せる（中ボス・ボス以外）
          this.grid.each(z.x, z.y, z.pullR, (e) => {
            if (e.dead || e.isBoss || e.mid) return;
            const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy);
            if (d > z.pullR || d < 4) return;
            const step = Math.min(d - 2, z.pull * dt * (1 + (1 - d / z.pullR)));
            e.x += dx / d * step; e.y += dy / d * step;
          });
        }
        if (z.kind === 3) continue;   // 楽器の広場はダメージなし
        this.hitBoxes(z.x, z.y, z.r);
        for (const e of this.enemiesNear(z.x, z.y, z.r)) this.damageEnemy(e, z.dps * dt, z.owner);
      }
      this.zones = this.zones.filter((z) => z.life > 0);
    }

    finish(win) {
      if (this.ended) return;
      this.ended = true;
      this.phase = win ? 'win' : 'lose';
      this.levelup = null; this.roulette = null;
      const stats = {};
      this.players.forEach((p) => { stats[p.id] = { kills: p.kills, coins: 300 * (p.abilities.coin || 0) }; });
      this.result = { win, time: this.t / this.tScale, level: this.level, stats, stage: this.stageIndex, ow: this.overwhelm ? 1 : 0 };
      this.events.push({ type: 'end', result: this.result });
    }

    /* ======================= 描画・通信用データ ======================= */
    buildOf(p) {
      return p.order.map((k) => k + ':' + p.skills[k]).join(',') + '|' + p.aorder.map((k) => k + ':' + p.abilities[k]).join(',');
    }
    snapshot() {
      const R = Math.round;
      const P = [], E = [], K = [], Q = [], Z = [], O = [], X = [], W = [];
      this.players.forEach((p) => {
        P.push([p.id, p.slot, R(p.x), R(p.y), R(p.hp), R(p.maxHp), p.down ? 1 : 0, +(p.revive / GC.PLAYER.reviveSeconds).toFixed(2), p.kills,
          this.buildOf(p), p.skills.gravity ? Math.round(this.gravityR(p)) : 0, (p.frost ? 1 : 0) | (p.stella ? 2 : 0),
          p.look, +p.scd.toFixed(1), +Math.max(p.buff.inv, p.buff.spd, p.buff.fast, p.char === 'widow' ? Math.max(0, this.widowT) : 0).toFixed(1),
          (p.buff.inv > 0 ? 1 : 0) | (p.buff.spd > 0 ? 2 : 0) | (p.buff.fast > 0 ? 4 : 0) | (p.shield ? 8 : 0) | (p.buff.dual > 0 ? 16 : 0) | (p.buff.lbelt > 0 ? 32 : 0) | (p.musicLv ? 64 : 0),
          +p.face.toFixed(2)]);
        if (p.down) return;
        if (p.skills.defender) {
          const n = p.skills.defender >= EVO ? EV.defender.count : p.skills.defender + 1;
          const gr = R(SP.defender.r * this.areaMul(p));
          for (let i = 0; i < n; i++) {
            const a = p.gearAng + i * TAU / n;
            O.push([0, R(p.x + Math.cos(a) * SP.defender.orbit), R(p.y + Math.sin(a) * SP.defender.orbit), gr, p.slot, p.id + 'g' + i]);
          }
        }
        if (p.ball) O.push([1, R(p.ball.x), R(p.ball.y), p.ball.r || 20, p.slot, p.id + 'b']);
        if (p.ball2 && p.skills.soccer >= EVO) O.push([1, R(p.ball2.x), R(p.ball2.y), p.ball2.r || 20, p.slot, p.id + 'b2']);
        if (p.hdrone) O.push([5, R(p.hdrone.x), R(p.hdrone.y), 14, p.slot, p.id + 'h']);
        if (p.drone) {
          const t = p.drone.tgt && !p.drone.tgt.dead ? p.drone.tgt : null;
          O.push([2, R(p.drone.x), R(p.drone.y), 14, p.slot, p.id + 'd', t ? R(t.x) : null, t ? R(t.y) : null, this.clock - (p.drone.miss || -9) < 0.15 ? 1 : 0]);
        }
      });
      for (const e of this.enemies) {
        if (e.dead) continue;
        E.push([e.id, e.ti, R(e.x), R(e.y), R(e.hp / e.maxHp * 100), e.flip ? 1 : 0, e.slow < 1 ? 1 : 0, e.mid ? 1 : 0, e.frozen > 0 ? 1 : 0]);
        if (e.isBoss) {
          e.bdef.attacks.forEach((A) => {
            if (A.t !== 'gears') return;
            for (let i = 0; i < A.count; i++) {
              const a = e.gearAng + i * TAU / A.count;
              O.push([3, R(e.x + Math.cos(a) * A.radius), R(e.y + Math.sin(a) * A.radius), A.r, -1, 'bg' + i]);
            }
          });
          if (e.mv && e.mv.st === 'wind') W.push([e.id * 10 + 7, 9, R(e.x), R(e.y), R(e.r), +(1 - e.mv.t / (e.bdef.move.wind || 1)).toFixed(2), R(e.x + Math.cos(e.mv.ang) * e.mv.len), R(e.y + Math.sin(e.mv.ang) * e.mv.len)]);
        } else if (e.dashS && e.dashS.st === 'wind') {
          W.push([e.id * 10 + 7, 9, R(e.x), R(e.y), R(e.r), +(1 - e.dashS.t / e.def.dash.wind).toFixed(2), R(e.x + Math.cos(e.dashS.a) * e.def.dash.speed * e.def.dash.dur), R(e.y + Math.sin(e.dashS.a) * e.def.dash.speed * e.def.dash.dur)]);
        }
      }
      for (const B of this.blasts) W.push(B.rect ? [B.id, B.kind, R(B.x), R(B.y), R(B.r), +(1 - B.t / B.max).toFixed(2), R(B.hh), B.face]
        : [B.id, B.kind, R(B.x), R(B.y), R(B.r), +(1 - B.t / B.max).toFixed(2)]);
      for (const s of this.shots) K.push([s.id, s.kind, R(s.x), R(s.y), +Math.atan2(s.vy, s.vx).toFixed(2)]);
      for (const s of this.eshots) if (s.life > 0) Q.push([s.id, s.kind, R(s.x), R(s.y), s.r]);
      for (const z of this.zones) Z.push([z.id, z.kind, R(z.x), R(z.y), R(z.r), +(z.life / z.max).toFixed(2), z.slot != null ? z.slot : -1]);
      for (const b of this.bottles) {
        const k = b.t / b.dur;
        O.push([4, R(b.x0 + (b.x1 - b.x0) * k), R(b.y0 + (b.y1 - b.y0) * k - Math.sin(k * Math.PI) * 60), 12, -1, 'm' + b.id]);
      }
      for (const f of this.fx) X.push([f.id, f.k, R(f.x), R(f.y), R(f.r || 0), f.tx != null ? R(f.tx) : null, f.ty != null ? R(f.ty) : null, f.o != null ? f.o : -1, f.a != null ? +f.a.toFixed(2) : 0]);
      const BX = this.boxes.map((b) => [b.id, R(b.x), R(b.y)]);
      const HL = this.heals.map((h) => [h.id, R(h.x), R(h.y)]);
      const CH = this.chests.map((c) => [c.id, R(c.x), R(c.y)]);
      const BM = this.bombs.map((b) => [b.id, R(b.x), R(b.y), b.t < 0.25 ? 1 : 0]);
      const boss = this.boss && !this.boss.dead ? [this.boss.id, this.boss.bossKey, R(this.boss.hp), R(this.boss.maxHp)] : null;
      // ボス出現の魔法陣（intro の間）と残り秒
      const altar = this.altar && this.phase === 'intro' && !this.ended
        ? [R(this.altar.x), R(this.altar.y), this.altar.r, +Math.max(0, this.introT).toFixed(1), 0, 0] : null;
      return {
        tm: +(this.t / this.tScale).toFixed(2), ph: this.phase, ow: this.overwhelm ? 1 : 0, lv: this.level, xp: R(this.xp), nd: this.need,
        lu: this.levelup ? Object.keys(this.levelup.options).filter((id) => !this.levelup.chosen[id]) : null,
        P, E, K, Q, Z, O, X, W, boss, altar, BX, HL, CH, BM,
        rs: this.rush > 0 ? 1 : 0, wd: this.widowT > 0 ? 1 : 0, pd: this.partyDiff,
        wp: this.phase === 'warp' ? +Math.max(0, this.introT).toFixed(1) : null,      // ワープまでの残り秒
        rl: this.roulette ? [this.roulette.seq, +this.roulette.left.toFixed(1)] : null, // 宝箱のルーレット中
      };
    }
  }

  DS.Sim = Sim;
  DS.Sim.ENEMY_TYPES = ENEMY_TYPES;
  DS.Sim.PROJ_KINDS = PROJ_KINDS;
})();

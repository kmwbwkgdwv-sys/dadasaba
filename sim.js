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
      this.phase = 'battle';       // battle → gather → countdown → boss → win / lose
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
      this.boxes = []; this.heals = []; this.boxTimer = 60;
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
      if (p.pas.leatherBelt && p.buff.lbelt > 0) a *= 1 + p.pas.leatherBelt.atk / 100;   // レザーベルト：回復アイテムで攻撃力アップ
      if (p.pas.destroyerCoat) a *= 1 + (p.pas.destroyerCoat.max - 1) * clamp(1 - p.hp / p.maxHp, 0, 1);
      if (p.pas.destroyerFoot) {
        let downs = 0; this.players.forEach((q) => { if (q !== p && q.down) downs++; });
        a *= Math.min(p.pas.destroyerFoot.max, 1 + downs);
      }
      return a;
    }
    cdMul(p) { return 1 / (1 + 0.1 * (p.abilities.battery || 0)); }
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
    hitBoxes(x, y, r) {
      if (!this.boxes.length) return;
      for (const b of this.boxes) {
        if (!b.broken && dist2(x, y, b.x, b.y) < (r + b.r) * (r + b.r)) this.breakBox(b);
      }
    }
    breakBox(b) {
      b.broken = true;
      this.fx.push({ id: this.nextId++, k: 8, x: b.x, y: b.y, rt: this.clock });
      if (Math.random() < GC.BOXES.dropRate) this.heals.push({ id: this.nextId++, x: b.x, y: b.y });
    }

    hurtPlayer(p, dmg) {
      if (p.down || this.ended || p.buff.inv > 0 || !(dmg > 0)) return;
      // 鎧：どんな攻撃でも1発は防ぐシールド
      if (p.shield) {
        p.shield = false; p.cd.plateArmor = p.pas.plateArmor.cd; p.buff.inv = Math.max(p.buff.inv, 0.4);
        this.fx.push({ id: this.nextId++, k: 15, x: p.x, y: p.y, rt: this.clock, o: p.slot });
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
      return 1 + s;
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
      const MAX = GC.MAX_STAR;
      const ownedS = Object.keys(p.skills).length, ownedA = Object.keys(p.abilities).length;
      Object.keys(GC.SKILLS).forEach((k) => {
        const d = GC.SKILLS[k];
        if (d.weapon && k !== p.weapon) return;                 // 別の武器のスキルは出ない
        const s = p.skills[k] || 0;
        if (s >= MAX) return;                                  // ★5 は出ない
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
        p.skills[opt.key] = Math.min(GC.MAX_STAR, (p.skills[opt.key] || 0) + 1);
      } else if (opt.kind === 'ability') {
        if (!p.abilities[opt.key]) p.aorder.push(opt.key);
        p.abilities[opt.key] = Math.min(GC.MAX_STAR, (p.abilities[opt.key] || 0) + 1);
      } else if (opt.kind === 'heal' && !p.down) {
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
      }
    }
    get paused() { return !!this.levelup; }

    /* ======================= 敵 ======================= */
    spawnEnemy(type, x, y, extra) {
      const d = GC.ENEMIES[type];
      const min = this.t / 60;
      let hpMul;
      if (d.midboss) hpMul = GC.MIDBOSS_HP_SCALE * this.hpMult * this.partyDiff;
      else hpMul = (1 + GC.ENEMY_HP_GROWTH_PER_MIN * min) * this.hpMult * (d.noParty ? 1 : this.partyDiff);
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
      for (let i = 0; i < n; i++) this.spawnEnemy(pick.type, cx + rand(-60, 60), cy + rand(-60, 60));
    }
    /** 画面にいてほしい敵の数（終盤になるほど一気に増える） */
    desiredCount() {
      const S = GC.SPAWN, min = this.t / 60;
      return Math.min(GC.MAX_ENEMIES, Math.round((S.base + S.perMin * min + (S.perMin2 || 0) * min * min) * this.partyMul(GC.PARTY.spawn)));
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
    spawnBoss() {
      const key = this.roster.boss, d = GC.BOSSES[key];
      const n = this.players.size;
      const BP = GC.BOSS_PARTY;
      const hp = GC.BOSS_BASE_HP * (d.hp || 1) * this.hpMult * (n > 1 ? BP.timeRatio * (1 + BP.perExtra * (n - 1)) : 1);
      this.enemies = []; this.eshots = []; this.blasts = this.blasts.filter((B) => B.hurts === 'enemies'); this.rush = 0;   // ボス出現と同時に雑魚は消える（自分たちの攻撃は残す）
      const home = { x: this.altar.x, y: this.altar.y };
      // ボスは祭壇の少し奥（北側）に出現。集まったプレイヤーと重ならないようにする
      this.boss = this.spawnEnemy('bigZombie', home.x, home.y - this.altar.r - 170, {
        isBoss: true, bossKey: key, bdef: d, r: d.r, hp, maxHp: hp, speed: 0, xpv: 0, mid: false,
        cd: 2.5, gearAng: 0, ti: -1, home, mv: { st: 'walk', t: (d.move.cd || 4) * 0.6, ang: -Math.PI / 2 },
        atkT: d.attacks.map((a) => (a.cd || 3) * rand(0.35, 0.7)), spiralAng: 0, spiralOn: 0, ringRot: 0,
      });
      this.phase = 'boss';
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
      if (e.mid) this.events.push({ type: 'midbossDown' });
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
      if (this.ended || this.levelup) return;
      this.clock += dt;
      const players = this.alivePlayers();

      // ---- 時間と流れ ----
      if (this.phase === 'battle') {
        this.t += dt;
        GC.MIDBOSS_TIMES.forEach((tm, i) => {
          if (this.midbossDone <= i && this.t >= tm) { this.midbossDone = i + 1; this.spawnMidboss(); }
        });
        if (this.t >= GC.MATCH_SECONDS) {
          this.t = GC.MATCH_SECONDS;
          this.phase = 'gather';
          this.altar = { x: this.W / 2, y: this.H / 2, r: GC.ALTAR.radius };
          this.events.push({ type: 'gather' });
        }
      }
      if (this.phase === 'gather' || this.phase === 'countdown') {
        const inside = players.filter((p) => dist2(p.x, p.y, this.altar.x, this.altar.y) < this.altar.r * this.altar.r).length;
        this.altar.inside = inside; this.altar.total = players.length;
        if (players.length && inside === players.length) {
          if (this.phase === 'gather') { this.phase = 'countdown'; this.countdown = GC.ALTAR.countdown; }
          this.countdown -= dt;
          if (this.countdown <= 0) this.spawnBoss();
        } else if (this.phase === 'countdown') { this.phase = 'gather'; this.countdown = -1; }
      }

      // ---- 中ボスの少し前のラッシュ ----
      if (this.phase === 'battle') {
        GC.MIDBOSS_TIMES.forEach((tm, i) => {
          if (this.rushDone <= i && this.t >= tm - GC.RUSH.before) {
            this.rushDone = i + 1; this.rush = GC.RUSH.duration; this.rushTimer = 0; this.rushDir = rand(0, TAU);
            this.events.push({ type: 'rush' });
          }
        });
        // 1分ごとにダンボールを追加
        this.boxTimer -= dt;
        if (this.boxTimer <= 0) { this.boxTimer += 60; this.spawnBoxes(GC.BOXES.perMinute); }
      }
      if (this.rush > 0 && this.phase === 'battle') {
        this.rush -= dt; this.rushTimer -= dt;
        if (this.rushTimer <= 0) { this.rushTimer = GC.RUSH.every; this.spawnRushPack(); }
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
        this.hitBoxes(p.x, p.y, p.r);
        for (const h of this.heals) {
          if (!h.taken && dist2(p.x, p.y, h.x, h.y) < (p.r + 24) * (p.r + 24)) {
            h.taken = true;
            p.hp = Math.min(p.maxHp, p.hp + p.maxHp * GC.BOXES.healRatio);
            if (p.pas.leatherBelt) p.buff.lbelt = p.pas.leatherBelt.dur;
            this.fx.push({ id: this.nextId++, k: 9, x: p.x, y: p.y, rt: this.clock, o: p.slot });
          }
        }
      }
      if (this.boxes.some((b) => b.broken)) this.boxes = this.boxes.filter((b) => !b.broken);
      if (this.heals.some((h) => h.taken)) this.heals = this.heals.filter((h) => !h.taken);

      // ---- 回復・復活 ----
      let teamHeal = 0;    // ファッションベルト：どこにいても味方と自分を毎秒1%回復
      players.forEach((p) => { if (p.pas.fashionBelt) teamHeal += p.pas.fashionBelt.heal; });
      this.players.forEach((p) => {
        if (!p.down) {
          let regen = teamHeal;
          if (p.abilities.drink) regen += 0.03 + 0.01 * p.abilities.drink;
          if (p.pas.eternalBoots) regen += p.pas.eternalBoots.heal;
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
      if (this.phase !== 'boss') {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnTimer = GC.SPAWN.interval / this.partyMul(GC.PARTY.spawn);
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

      // ---- プレイヤーのまわりの効果（重力・フロストブーツ・ステラベルト） ----
      for (const p of players) {
        const g = p.skills.gravity;
        if (g) {
          const amt = Math.min(0.9, SP.gravity.slow + SP.gravity.slowStep * (g - 1));
          const dps = (SP.gravity.dps + SP.gravity.dpsStep * (g - 1)) * this.atkOf(p);
          for (const e of this.enemiesNear(p.x, p.y, SP.gravity.r)) {
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
            const proj = e.type === 'mageZombie' && this.roster.mageProj ? this.roster.mageProj : R.proj;
            this.eshots.push({ id: this.nextId++, kind: PROJ_KINDS.indexOf(proj), x: e.x, y: e.y - 10, vx: dx * R.speed, vy: dy * R.speed, r: R.pr, atk: e.atk, life: R.range / R.speed + 0.6 });
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
      if (M.t === 'walk' || M.t === 'dash') {
        if (mv.st === 'walk') {
          const a = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          b.x += Math.cos(a) * (M.speed || 40) * slow * dt; b.y += Math.sin(a) * (M.speed || 40) * slow * dt;
          b.flip = Math.cos(a) < 0;
          if (M.t === 'dash') {
            mv.t -= dt;
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
        mv.t -= dt;
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
        mv.ang += (M.speed || 0.4) * slow * dt;
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
        b.atkT[i] = A.cd;
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
      return L.r * (1 + L.rStep * (s - 1)) * (p.cs && p.cs.saberRange ? p.cs.saberRange : 1);
    }
    skillsAct(p, dt) {
      const atk = this.atkOf(p);
      const S = p.skills;

      // クナイ：追尾して必中
      if (S.kunai && this.ready(p, 'kunai', SP.kunai.cd * this.wcd(p), dt)) {
        const used = new Set(), targets = [];
        for (let i = 0; i < S.kunai; i++) {
          const t = this.nearestEnemy(p.x, p.y, SP.kunai.range, used) || targets[i % Math.max(1, targets.length)];
          if (!t) break;
          used.add(t.id); targets.push(t);
        }
        if (!targets.length) p.cd.kunai = 0.1;
        targets.forEach((t, i) => {
          const a = Math.atan2(t.y - p.y, t.x - p.x) + (i - (targets.length - 1) / 2) * 0.25;
          this.shots.push({ id: this.nextId++, kind: 0, owner: p.id, x: p.x, y: p.y, vx: Math.cos(a) * SP.kunai.speed, vy: Math.sin(a) * SP.kunai.speed, tgt: t, dmg: atk * SP.kunai.dmg, life: 2.5, r: 8 });
        });
      }
      // ショットガン：散弾
      if (S.shotgun) {
        const cd = SP.shotgun.cd - SP.shotgun.cdStep * (S.shotgun - 1);
        if (this.ready(p, 'shotgun', cd * this.wcd(p), dt)) {
          const t = this.nearestEnemy(p.x, p.y, SP.shotgun.range + 40);
          if (!t) p.cd.shotgun = 0.1;
          else {
            const base = Math.atan2(t.y - p.y, t.x - p.x);
            const n = SP.shotgun.pellets;
            const per = atk * SP.shotgun.total * Math.pow(SP.shotgun.mult, S.shotgun - 1) / n;
            for (let i = 0; i < n; i++) {
              const a = base + (i / (n - 1) - 0.5) * SP.shotgun.spread + rand(-0.04, 0.04);
              this.shots.push({ id: this.nextId++, kind: 1, owner: p.id, x: p.x, y: p.y, vx: Math.cos(a) * SP.shotgun.speed, vy: Math.sin(a) * SP.shotgun.speed, dmg: per, life: SP.shotgun.range / SP.shotgun.speed, r: 5 });
            }
          }
        }
      }
      // ライトセイバー：近くの敵を自動で狙って（オートエイム）90度の範囲を斬る
      // 届くところに敵（なければダンボール）がいないときは、振らずに待つ
      if (S.lightsaber) {
        const L = SP.lightsaber;
        const cd = Math.max(0.2, L.cd - L.cdStep * (S.lightsaber - 1));
        const r = this.saberRange(p);
        let tgt = this.nearestEnemy(p.x, p.y, r + 60);
        if (tgt && Math.hypot(tgt.x - p.x, tgt.y - p.y) > r + tgt.r) tgt = null;
        if (!tgt) tgt = this.boxes.find((bx) => !bx.broken && dist2(p.x, p.y, bx.x, bx.y) < (r + bx.r) * (r + bx.r)) || null;
        if (!tgt) p.cd.lightsaber = Math.max(0, (p.cd.lightsaber == null ? 0.3 : p.cd.lightsaber) - dt);
        else if (this.ready(p, 'lightsaber', cd * this.wcd(p), dt)) {
          const aim = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          const dmg = atk * L.dmg * Math.pow(L.mult, S.lightsaber - 1);
          this.enemiesNear(p.x, p.y, r).forEach((e) => {
            const a = Math.atan2(e.y - p.y, e.x - p.x);
            const slack = Math.asin(Math.min(1, e.r / Math.max(1, Math.hypot(e.x - p.x, e.y - p.y))));   // 大きい敵は少し外れても当たる
            if (Math.abs(angDiff(a, aim)) <= L.arc / 2 + slack) this.damageEnemy(e, dmg, p.id);
          });
          this.hitBoxes(p.x + Math.cos(aim) * r * 0.6, p.y + Math.sin(aim) * r * 0.6, r * 0.5);
          this.fx.push({ id: this.nextId++, k: 6, x: p.x, y: p.y, r, a: aim, rt: this.clock, o: p.slot });
        }
      }
      // ミニガン：10秒撃ち続けて、リロード（★でリロードが短くなる）。近くの敵を自動で狙う
      if (S.minigun) {
        const M = SP.minigun;
        if (!p.mg) p.mg = { st: 'fire', t: M.fire, acc: 0 };
        const mg = p.mg;
        if (mg.st === 'reload') {
          mg.t -= dt;
          if (mg.t <= 0) { mg.st = 'fire'; mg.t = M.fire; }
        } else {
          const t = this.nearestEnemy(p.x, p.y, M.range);
          if (t) {
            mg.t -= dt;
            const burst = p.pas.minigun && p.buff.mgBurst > 0 ? p.pas.minigun.rate : 1;
            mg.acc += M.rate * burst * dt / (this.cdMul(p) * this.wcd(p));
            while (mg.acc >= 1) {
              mg.acc -= 1;
              const a = Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.06, 0.06);
              this.shots.push({ id: this.nextId++, kind: 3, owner: p.id, x: p.x, y: p.y - 6, vx: Math.cos(a) * M.speed, vy: Math.sin(a) * M.speed, dmg: atk * M.dmg, life: M.range / M.speed, r: 5 });
            }
            if (mg.t <= 0) { mg.st = 'reload'; mg.t = Math.max(0.5, M.reload - M.reloadStep * (S.minigun - 1)); mg.acc = 0; }
          } else mg.acc = Math.min(mg.acc, 1);
        }
      }
      // 破壊の力：近くの敵を自動で狙ってブラックホールを撃つ
      if (S.destroyerPower) {
        const D = SP.destroyerPower;
        if (this.ready(p, 'destroyerPower', D.cd * this.wcd(p), dt)) {
          const t = this.nearestEnemy(p.x, p.y, D.range);
          if (!t) p.cd.destroyerPower = 0.2;
          else this.spawnHole(p, t.x, t.y, 1, D.dur + D.durStep * (S.destroyerPower - 1), atk);
        }
      }
      // リボルバー：近くの敵1体を撃ち抜く（デュアル中は2発）
      if (S.revolver) {
        const V = SP.revolver;
        const cd = Math.max(0.1, V.cd - V.cdStep * (S.revolver - 1));
        if (this.ready(p, 'revolver', cd * this.wcd(p), dt)) {
          const shots = p.buff.dual > 0 ? 2 : 1;
          const used = new Set();
          for (let i = 0; i < shots; i++) {
            const t = this.nearestEnemy(p.x, p.y, V.range, used) || (i > 0 ? this.nearestEnemy(p.x, p.y, V.range) : null);
            if (!t) { if (i === 0) p.cd.revolver = 0.05; break; }
            used.add(t.id);
            this.fx.push({ id: this.nextId++, k: 4, x: p.x + (i ? 8 : -4), y: p.y - 6, tx: t.x, ty: t.y, rt: this.clock });
            this.damageEnemy(t, atk * V.dmg * Math.pow(V.mult, S.revolver - 1), p.id);
          }
        }
      }
      // ディフェンサー：回る歯車
      if (S.defender) {
        p.gearAng += SP.defender.angSpeed * dt;
        const n = S.defender + 1;
        for (let i = 0; i < n; i++) {
          const a = p.gearAng + i * TAU / n;
          const gx = p.x + Math.cos(a) * SP.defender.orbit, gy = p.y + Math.sin(a) * SP.defender.orbit;
          this.hitBoxes(gx, gy, SP.defender.r);
          this.grid.each(gx, gy, SP.defender.r + 60, (e) => {
            if (e.dead || dist2(gx, gy, e.x, e.y) > (SP.defender.r + e.r) * (SP.defender.r + e.r)) return;
            if (this.hitReady(e, 'g' + p.id, SP.defender.hitCd)) this.damageEnemy(e, atk * SP.defender.dmg, p.id);
          });
        }
      }
      // ドローン：近くの敵を狙って撃つ（命中率50%）
      if (S.drone) {
        const ox = p.x - 34, oy = p.y - 46 + Math.sin(this.t * 4) * 4;
        if (!p.drone) p.drone = { x: ox, y: oy, tgt: null, miss: 0 };
        p.drone.x += (ox - p.drone.x) * Math.min(1, dt * 8); p.drone.y += (oy - p.drone.y) * Math.min(1, dt * 8);
        let t = p.drone.tgt;
        if (!t || t.dead || dist2(p.x, p.y, t.x, t.y) > SP.drone.range * SP.drone.range) t = p.drone.tgt = this.nearestEnemy(p.x, p.y, SP.drone.range);
        if (t) {
          p.droneAcc += (SP.drone.rate + SP.drone.rateStep * (S.drone - 1)) * dt / this.cdMul(p);
          while (p.droneAcc >= 1 && !t.dead) {
            p.droneAcc -= 1;
            if (Math.random() < SP.drone.accuracy) this.damageEnemy(t, atk * SP.drone.dmg, p.id);
            else p.drone.miss = this.clock;        // 外れた（描画で弾がそれる）
          }
        } else p.droneAcc = 0;
      }
      // 雷発生機
      if (S.thunder && this.ready(p, 'thunder', SP.thunder.cd, dt)) {
        const cands = this.byDistance(p, this.enemiesNear(p.x, p.y, SP.thunder.range));
        if (!cands.length) p.cd.thunder = 0.2;
        cands.slice(0, S.thunder).forEach((t) => {
          this.fx.push({ id: this.nextId++, k: 0, x: t.x, y: t.y, rt: this.clock });
          this.zones.push({ id: this.nextId++, kind: 0, owner: p.id, x: t.x, y: t.y, r: SP.thunder.fieldR, dps: atk * SP.thunder.fieldDps, life: SP.thunder.fieldTime, max: SP.thunder.fieldTime });
          this.damageEnemy(t, atk * SP.thunder.dmg, p.id);
        });
      }
      // サッカーボール：画面の端で跳ね返る
      if (S.soccer) {
        const r = SP.soccer.rPerStar * S.soccer, sp = SP.soccer.speed + SP.soccer.speedStep * (S.soccer - 1);
        const aimFrom = (b) => {   // オートエイム：ボールから一番近い敵の方へ
          const t = this.nearestEnemy(b.x, b.y, 520);
          if (t) { const a = Math.atan2(t.y - b.y, t.x - b.x); b.vx = Math.cos(a); b.vy = Math.sin(a); }
        };
        if (!p.ball) { const a = rand(0, TAU); p.ball = { x: p.x, y: p.y, vx: Math.cos(a), vy: Math.sin(a) }; aimFrom(p.ball); }
        const b = p.ball;
        const len = Math.hypot(b.vx, b.vy) || 1;
        b.vx /= len; b.vy /= len;
        b.x += b.vx * sp * dt; b.y += b.vy * sp * dt;
        const L = p.x - p.vw + r, R = p.x + p.vw - r, T = p.y - p.vh + r, B = p.y + p.vh - r;
        let bounced = false;
        if (b.x < L) { b.x = L; b.vx = Math.abs(b.vx); bounced = true; } else if (b.x > R) { b.x = R; b.vx = -Math.abs(b.vx); bounced = true; }
        if (b.y < T) { b.y = T; b.vy = Math.abs(b.vy); bounced = true; } else if (b.y > B) { b.y = B; b.vy = -Math.abs(b.vy); bounced = true; }
        if (bounced) aimFrom(b);
        b.r = r;
        this.hitBoxes(b.x, b.y, r);
        this.grid.each(b.x, b.y, r + 60, (e) => {
          if (e.dead || dist2(b.x, b.y, e.x, e.y) > (r + e.r) * (r + e.r)) return;
          if (this.hitReady(e, 'b' + p.id, SP.soccer.hitCd)) this.damageEnemy(e, atk * SP.soccer.dmg, p.id);
        });
      }
      // 火炎瓶
      if (S.molotov && this.ready(p, 'molotov', SP.molotov.cd, dt)) {
        const near = this.byDistance(p, this.enemiesNear(p.x, p.y, 320));
        for (let i = 0; i < SP.molotov.bottles; i++) {
          let tx, ty;
          if (near[i]) { tx = near[i].x; ty = near[i].y; }
          else { const a = rand(0, TAU); tx = p.x + Math.cos(a) * SP.molotov.throwDist; ty = p.y + Math.sin(a) * SP.molotov.throwDist; }
          this.bottles.push({ id: this.nextId++, owner: p.id, x0: p.x, y0: p.y, x1: tx, y1: ty, t: 0, dur: 0.6,
            r: SP.molotov.r + SP.molotov.rStep * (S.molotov - 1), dps: atk * (SP.molotov.dps + SP.molotov.dpsStep * (S.molotov - 1)) });
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
          this.shots.push({ id: this.nextId++, kind: 2, owner: p.id, x: p.x, y: p.y, vx: Math.cos(a) * SP.kunai.speed, vy: Math.sin(a) * SP.kunai.speed, dmg: atk * P.kunai.dmg, life: 0.95, r: 9 });
        }
      }
      // ショットガン：10秒に1度、全方向に撃つ
      if (P.shotgun && this.pready(p, 'shotgun', P.shotgun.cd, dt)) {
        for (let i = 0; i < P.shotgun.count; i++) {
          const a = i * TAU / P.shotgun.count + rand(-0.08, 0.08);
          this.shots.push({ id: this.nextId++, kind: 1, owner: p.id, x: p.x, y: p.y, vx: Math.cos(a) * SP.shotgun.speed, vy: Math.sin(a) * SP.shotgun.speed, dmg: atk * P.shotgun.dmg, life: SP.shotgun.range * 1.2 / SP.shotgun.speed, r: 5 });
        }
        this.fx.push({ id: this.nextId++, k: 7, x: p.x, y: p.y, r: 90, rt: this.clock });
      }
      // ライトセイバー：15秒に1度、全方向に大きく回転斬り
      if (P.lightsaber && this.pready(p, 'lightsaber', P.lightsaber.cd, dt)) {
        const L = SP.lightsaber, s = p.skills.lightsaber || 1;
        const r = this.saberRange(p) * P.lightsaber.range;
        const dmg = atk * L.dmg * Math.pow(L.mult, s - 1) * P.lightsaber.dmg;
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
        this.blasts.push({ id: this.nextId++, kind: 2, x, y, r: P.stellaBelt.r, t: 0.7, max: 0.7, dmg: atk * P.stellaBelt.dmg, hurts: 'enemies', owner: p.id });
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
      const D = SP.destroyerPower, s = p.skills.destroyerPower || 1;
      const r = (D.r + D.rStep * (s - 1)) * scale;
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
            const sp = SP.kunai.speed;
            s.vx += (dx / d * sp - s.vx) * Math.min(1, dt * 14);
            s.vy += (dy / d * sp - s.vy) * Math.min(1, dt * 14);
            if (d < s.tgt.r + s.r + 6) { this.damageEnemy(s.tgt, s.dmg, s.owner); s.life = 0; continue; }
          }
          s.x += s.vx * dt; s.y += s.vy * dt;
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
    updateEnemyShots(dt, players) {
      for (const s of this.eshots) {
        s.life -= dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        for (const p of players) {
          if (dist2(s.x, s.y, p.x, p.y) < (s.r + p.r) * (s.r + p.r)) { this.hurtPlayer(p, s.atk); s.life = 0; break; }
        }
      }
      this.eshots = this.eshots.filter((s) => s.life > 0);
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
        this.hitBoxes(z.x, z.y, z.r);
        for (const e of this.enemiesNear(z.x, z.y, z.r)) this.damageEnemy(e, z.dps * dt, z.owner);
      }
      this.zones = this.zones.filter((z) => z.life > 0);
    }

    finish(win) {
      if (this.ended) return;
      this.ended = true;
      this.phase = win ? 'win' : 'lose';
      this.levelup = null;
      const stats = {};
      this.players.forEach((p) => { stats[p.id] = { kills: p.kills, coins: 300 * (p.abilities.coin || 0) }; });
      this.result = { win, time: this.t, level: this.level, stats, stage: this.stageIndex };
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
          this.buildOf(p), p.skills.gravity ? SP.gravity.r : 0, (p.frost ? 1 : 0) | (p.stella ? 2 : 0),
          p.look, +p.scd.toFixed(1), +Math.max(p.buff.inv, p.buff.spd, p.buff.fast, p.char === 'widow' ? Math.max(0, this.widowT) : 0).toFixed(1),
          (p.buff.inv > 0 ? 1 : 0) | (p.buff.spd > 0 ? 2 : 0) | (p.buff.fast > 0 ? 4 : 0) | (p.shield ? 8 : 0) | (p.buff.dual > 0 ? 16 : 0) | (p.buff.lbelt > 0 ? 32 : 0),
          +p.face.toFixed(2)]);
        if (p.down) return;
        if (p.skills.defender) {
          const n = p.skills.defender + 1;
          for (let i = 0; i < n; i++) {
            const a = p.gearAng + i * TAU / n;
            O.push([0, R(p.x + Math.cos(a) * SP.defender.orbit), R(p.y + Math.sin(a) * SP.defender.orbit), SP.defender.r, p.slot, p.id + 'g' + i]);
          }
        }
        if (p.ball) O.push([1, R(p.ball.x), R(p.ball.y), p.ball.r || 20, p.slot, p.id + 'b']);
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
      for (const s of this.eshots) Q.push([s.id, s.kind, R(s.x), R(s.y), s.r]);
      for (const z of this.zones) Z.push([z.id, z.kind, R(z.x), R(z.y), z.r, +(z.life / z.max).toFixed(2)]);
      for (const b of this.bottles) {
        const k = b.t / b.dur;
        O.push([4, R(b.x0 + (b.x1 - b.x0) * k), R(b.y0 + (b.y1 - b.y0) * k - Math.sin(k * Math.PI) * 60), 12, -1, 'm' + b.id]);
      }
      for (const f of this.fx) X.push([f.id, f.k, R(f.x), R(f.y), R(f.r || 0), f.tx != null ? R(f.tx) : null, f.ty != null ? R(f.ty) : null, f.o != null ? f.o : -1, f.a != null ? +f.a.toFixed(2) : 0]);
      const BX = this.boxes.map((b) => [b.id, R(b.x), R(b.y)]);
      const HL = this.heals.map((h) => [h.id, R(h.x), R(h.y)]);
      const boss = this.boss && !this.boss.dead ? [this.boss.id, this.boss.bossKey, R(this.boss.hp), R(this.boss.maxHp)] : null;
      const altar = this.altar && this.phase !== 'boss' && !this.ended
        ? [R(this.altar.x), R(this.altar.y), this.altar.r, this.phase === 'countdown' ? +this.countdown.toFixed(1) : -1, this.altar.inside || 0, this.altar.total || 0] : null;
      return {
        tm: +this.t.toFixed(2), ph: this.phase, lv: this.level, xp: R(this.xp), nd: this.need,
        lu: this.levelup ? Object.keys(this.levelup.options).filter((id) => !this.levelup.chosen[id]) : null,
        P, E, K, Q, Z, O, X, W, boss, altar, BX, HL,
        rs: this.rush > 0 ? 1 : 0, wd: this.widowT > 0 ? 1 : 0, pd: this.partyDiff,
      };
    }
  }

  DS.Sim = Sim;
  DS.Sim.ENEMY_TYPES = ENEMY_TYPES;
  DS.Sim.PROJ_KINDS = PROJ_KINDS;
})();

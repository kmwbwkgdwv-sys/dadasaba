/* =========================================================
 *  state.js  ― プレイヤーデータ（コイン・装備・キャラ・ミッション）
 *  localStorage に保存します（引き継ぎ設定時はクラウドにも保存）。
 *
 *  所持装備は「アイテム : レアリティ : 合成段階」ごとに個数で管理します。
 *    inventory: { 'kunai:common:0': 2, 'frostBoots:epic:1': 1, ... }
 *    equipped : { weapon: 'kunai:common:0', belt: null, armor: null, boots: null }
 *  キャラ：
 *    chars: { smoke: 1, widow: 2 }   char: 'widow' または null（初期キャラ）
 *  装備のレベル（設計図とコインで上げる。同じキーの装備はレベルを共有）：
 *    levels: { 'kunai:rare:2': 5 }   blueprints: { weapon: 12, armor: 3, belt: 0, boots: 7 }
 * ========================================================= */
(function () {
  const C = DS.config;
  const F = C.FUSION, LV = C.LEVELS;
  const listeners = new Set();
  const SLOT_KEYS = C.SLOTS.map((s) => s.key);
  const rnd = () => (window.crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 : Math.random());
  /** 重み付きの抽選（{ key: 重み }） */
  function pickWeighted(rates) {
    const ks = Object.keys(rates);
    let r = rnd() * ks.reduce((a, k) => a + rates[k], 0);
    for (const k of ks) { if (r < rates[k]) return k; r -= rates[k]; }
    return ks[ks.length - 1];
  }
  const emptyBp = () => ({ weapon: 0, armor: 0, belt: 0, boots: 0 });
  // mgPlay / mgWin：ミニゲームの試合数・勝った数（mgP_dodge などはゲームごと）
  const emptyStats = () => {
    const st = { itemPulls: 0, charPulls: 0, fuses: 0, levelUps: 0, charsGot: 0, charLevelUps: 0, shopBuys: 0, mgPlay: 0, mgWin: 0 };
    ((C.MINIGAMES && C.MINIGAMES.list) || []).forEach((g) => { st['mgP_' + g.key] = 0; st['mgW_' + g.key] = 0; });
    return st;
  };
  const emptyPity = () => ({ ie: 0, is: 0, ce: 0, cl: 0 });
  const SG = C.S_GEAR;
  const S_ITEMS = Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].s);
  const NORMAL_ITEMS = Object.keys(C.ITEMS).filter((k) => !C.ITEMS[k].s);
  const emptyTrades = () => ({ out: {}, inc: {}, done: {} });
  const TICKET_KINDS = ['item10', 'char10', 'epic1', 's1'];
  const GIFT_MAX_COINS = 100000000;
  /** 管理ページから届いたプレゼントの形をそろえる（変な値は入れない） */
  function cleanGift(g) {
    if (!g || typeof g !== 'object') return null;
    const coins = Math.floor(Number(g.coins));
    if (!(coins >= 0)) return null;
    const tickets = {};
    TICKET_KINDS.forEach((k) => { const n = Math.floor(Number(g.tickets && g.tickets[k]) || 0); if (n > 0) tickets[k] = Math.min(n, 999); });
    const out = { title: String(g.title || '運営からのプレゼント').slice(0, 40), text: String(g.text || '').slice(0, 300),
      coins: Math.min(coins, GIFT_MAX_COINS), tickets, at: Number(g.at) || 0 };
    if (Number(g.until) > 0) out.until = Number(g.until);   // 受け取れる期限（全員へのプレゼント）
    return out;
  }
  function cleanTrades(t) {
    const o = emptyTrades();
    if (!t || typeof t !== 'object') return o;
    Object.keys(t.out || {}).forEach((uid) => { const x = t.out[uid]; if (x && x.id && validTradeKey(x.give)) o.out[uid] = Object.assign({}, x); });
    Object.keys(t.inc || {}).forEach((id) => { const x = t.inc[id]; if (x && x.from && validTradeKey(x.give)) o.inc[id] = Object.assign({}, x); });
    // 終わったトレードは新しい100件だけ覚える
    Object.keys(t.done || {}).map((id) => [id, Number(t.done[id]) || 0]).sort((a, b) => b[1] - a[1]).slice(0, 100).forEach(([id, at]) => { o.done[id] = at; });
    return o;
  }
  const emptyLimited = () => ({ start: 0, days: [], base: null, claimed: {}, ms: {} });
  /** 端末の時計での日付（YYYY-MM-DD） */
  function dayKey(t) { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  const RARITY = {};
  C.RARITIES.forEach((r, i) => { RARITY[r.key] = Object.assign({ rank: i }, r); });

  function makeKey(item, rarity, lv = 0) { return item + ':' + rarity + ':' + (lv | 0); }
  function parseKey(key) {
    if (!key) return null;
    const [item, rarity, lvs] = String(key).split(':');
    // レジェンド+ には合成段階がない
    const lv = rarity === 'legendPlus' ? 0 : Math.max(0, Math.min(F.max, parseInt(lvs || '0', 10) || 0));
    if (!C.ITEMS[item] || !RARITY[rarity] || RARITY[rarity].hidden) return null;
    return { key: makeKey(item, rarity, lv), item, rarity, lv, def: C.ITEMS[item], rar: RARITY[rarity], slot: C.ITEMS[item].slot, s: !!C.ITEMS[item].s };
  }
  /** S装備はエピックより下のレアリティには存在しない */
  const validRarity = (item, rarity) => !(C.ITEMS[item] && C.ITEMS[item].s) || RARITY[rarity].rank >= RARITY[SG.minRarity].rank;

  function randomName() {
    return 'サバイバー' + String(Math.floor(1000 + Math.random() * 9000));
  }

  function freshSave() {
    const s = {
      version: 7,
      name: randomName(),
      coins: C.START_COINS,
      inventory: {},
      equipped: { weapon: null, belt: null, armor: null, boots: null },
      // char: スキルと強さを使うキャラ（持っているキャラだけ） / look: 見た目（いつでも誰でも）
      chars: {}, char: null, look: null,
      tickets: Object.assign({}, C.START_TICKETS),
      flags: {},
      totalPulls: 0,
      // ミッションの進み具合（回数を数えて、受け取った回数との差が受け取れる報酬）
      missions: { clears: 0, clearsClaimed: 0, kills: 0, killsClaimed: 0, stages: {} },
      account: { xp: 0 },           // アカウントレベルの経験値（ステージクリアでもらえる）
      presents: { claimed: {}, gifts: {}, all: {} },   // 受け取った運営プレゼント / gifts：管理ページから自分に届いたもの / all：全員へのもの
      trades: emptyTrades(),        // フレンドとのトレード（送った申し込み・受けている途中・終わったもの）
      levels: {},                   // 装備のレベル（キーごと。書いていなければ Lv1）
      blueprints: emptyBp(),        // 設計図（武器・防具・ベルト・靴）
      stats: emptyStats(),          // ガチャを引いた回数など（7日間限定ミッション用）
      limited: emptyLimited(),      // 7日間限定ミッション
      tools: {},                    // どうぐ（エピック装備選択BOX など）
      icon: null,                   // 左上のアイコン（null なら見た目のキャラ）
      essence: 0,                   // エッセンス（キャラのレベルアップに使う）
      charLv: {},                   // キャラのレベル { widow: 5 }
      ach: {},                      // 受け取ったミッション（1回きりは true、何度でもは受け取った回数）
      daily: null,                  // デイリーミッション { day, base, claimed, ms }
      shop: null,                   // ショップ { period, items, refDay, refN }
      friendId: '',                 // フレンドID（引き継ぎのプレイヤーIDとは別）
      pity: emptyPity(),            // ガチャの天井：前に出てから引いた回数（ie:装備エピック is:装備S ce:キャラエピック cl:キャラレジェンド）
      updatedAt: Date.now(),
    };
    C.STARTER_ITEMS.forEach((st) => {
      const k = makeKey(st.item, st.rarity, 0);
      s.inventory[k] = (s.inventory[k] || 0) + 1;
      if (st.equip) s.equipped[C.ITEMS[st.item].slot] = k;
    });
    return s;
  }

  /** 読み込んだデータを正しい形に整える（古い形式の移行もここで） */
  function normalize(obj) {
    const old = obj || {};
    const s = Object.assign(freshSave(), old);
    s.missions = Object.assign(freshSave().missions, s.missions || {});
    s.flags = s.flags && typeof s.flags === 'object' ? s.flags : {};
    s.tickets = Object.assign({ item10: 0, char10: 0, epic1: 0, s1: 0 }, s.tickets || {});
    if ((old.version || 1) < 3) {
      // 前のバージョンからの移行：まだガチャを引いていなければ最初のチケットを渡す
      s.tickets.item10 = (old.totalPulls || 0) > 0 ? 0 : C.START_TICKETS.item10;
      s.tickets.char10 = 0;
      s.look = old.char || null;
    }
    if ((old.version || 1) < 4) {
      // 5ステージ時代のクリア記録を新しいステージ番号（s1〜s5）に移す
      const OLD = ['meadow', 'desert', 'snow', 'volcano', 'ruins'];
      const st = {};
      Object.keys(s.missions.stages || {}).forEach((k) => {
        const i = OLD.indexOf(k);
        const nk = i >= 0 ? 's' + (i + 1) : k;
        st[nk] = (st[nk] || 0) + (s.missions.stages[k] | 0);
      });
      s.missions.stages = st;
      // これまでのクリア回数ぶんのアカウント経験値をまとめて渡す
      let xp = 0;
      Object.keys(st).forEach((k) => { const sg = C.STAGES.find((x) => x.key === k); if (sg) xp += C.ACCOUNT.clearXp(sg.no) * (st[k] | 0); });
      s.account = { xp: Math.max(xp, (s.account && s.account.xp) || 0) };
    }
    s.account = { xp: Math.max(0, Math.floor(Number(s.account && s.account.xp) || 0)) };
    const gifts = {};
    Object.keys((s.presents && s.presents.gifts) || {}).forEach((gid) => { const g = cleanGift(s.presents.gifts[gid]); if (g) gifts[gid] = g; });
    const all = {};
    Object.keys((s.presents && s.presents.all) || {}).forEach((gid) => { const g = cleanGift(s.presents.all[gid]); if (g) all[gid] = g; });
    s.presents = { claimed: Object.assign({}, s.presents && s.presents.claimed), gifts, all };
    s.trades = cleanTrades(s.trades);
    s.chars = s.chars && typeof s.chars === 'object' ? s.chars : {};
    // 装備のキーを「アイテム:レアリティ:合成段階」にそろえる
    const inv = {};
    let sRefund = 0;
    Object.keys(s.inventory || {}).forEach((k) => {
      const p = parseKey(k);
      const n = Math.floor(Number(s.inventory[k]) || 0);
      if (!p || n <= 0) return;
      // S装備になった装備のうち、エピックより下のもの（もう存在しない）はコインに交換する
      if (!validRarity(p.item, p.rarity)) {
        sRefund += n * Math.pow(F.need, p.lv) * (C.SHOP.prices[p.rarity] || 500);
        const lv = Math.floor(Number(s.levels && s.levels[k]) || 0);
        if (lv > 1) {
          let bp = 0, coins = 0;
          for (let i = 1; i < lv; i++) { bp += LV.bp(i); coins += LV.coins(i); }
          sRefund += coins;
          s.blueprints = s.blueprints || {}; s.blueprints[p.slot] = (Number(s.blueprints[p.slot]) || 0) + bp;
        }
        return;
      }
      inv[p.key] = (inv[p.key] || 0) + n;
    });
    if (sRefund) { s.coins = (Number(s.coins) || 0) + sRefund; s.flags.sRefund = (s.flags.sRefund || 0) + sRefund; }
    s.inventory = inv;
    const eq = { weapon: null, belt: null, armor: null, boots: null };
    C.SLOTS.forEach(({ key }) => {
      const p = parseKey(s.equipped && s.equipped[key]);
      if (p && inv[p.key] && p.slot === key) eq[key] = p.key;
    });
    // 武器は必ず1つ
    if (!eq.weapon) {
      const w = Object.keys(inv).map(parseKey).find((p) => p.slot === 'weapon');
      if (w) eq.weapon = w.key;
      else { const k = makeKey('kunai', 'common', 0); inv[k] = 1; eq.weapon = k; }
    }
    s.equipped = eq;
    Object.keys(s.chars).forEach((k) => { if (!C.CHARACTERS[k] || !(s.chars[k] > 0)) delete s.chars[k]; });
    if (s.char && !s.chars[s.char]) s.char = null;
    if (s.look && !C.CHARACTERS[s.look]) s.look = null;
    if (s.icon && !C.CHARACTERS[s.icon]) s.icon = null;
    ['item10', 'char10', 'epic1', 's1'].forEach((k) => { s.tickets[k] = Math.max(0, Math.floor(Number(s.tickets[k]) || 0)); });
    // 装備のレベル：持っている装備だけ、そのレアリティの上限まで
    const lvs = {};
    Object.keys(s.levels || {}).forEach((k) => {
      const p = parseKey(k), n = Math.floor(Number(s.levels[k]) || 0);
      if (p && inv[p.key] && n > 1) lvs[p.key] = Math.min(n, LV.max[p.rarity] || 1);
    });
    s.levels = lvs;
    const bp = emptyBp();
    SLOT_KEYS.forEach((k) => { bp[k] = Math.max(0, Math.floor(Number(s.blueprints && s.blueprints[k]) || 0)); });
    s.blueprints = bp;
    const stt = emptyStats();
    Object.keys(stt).forEach((k) => { stt[k] = Math.max(0, Math.floor(Number(s.stats && s.stats[k]) || 0)); });
    if ((old.version || 1) < 5) stt.itemPulls = Math.max(stt.itemPulls, s.totalPulls | 0);
    s.stats = stt;
    const lim = Object.assign(emptyLimited(), s.limited && typeof s.limited === 'object' ? s.limited : {});
    lim.start = Number(lim.start) || 0;
    lim.days = Array.isArray(lim.days) ? lim.days.filter((d) => typeof d === 'string').slice(0, 30) : [];
    lim.claimed = Object.assign({}, lim.claimed); lim.ms = Object.assign({}, lim.ms);
    s.limited = lim;
    const tools = {};
    Object.keys(s.tools || {}).forEach((k) => { const n = Math.floor(Number(s.tools[k]) || 0); if (C.TOOLS[k] && n > 0) tools[k] = n; });
    s.tools = tools;
    // v6：エッセンス・キャラのレベル・ミッション・デイリー・ショップ
    s.essence = Math.max(0, Math.floor(Number(s.essence) || 0));
    const clv = {};
    Object.keys(s.charLv || {}).forEach((k) => { const n = Math.floor(Number(s.charLv[k]) || 0); if (C.CHARACTERS[k] && s.chars[k] && n > 1) clv[k] = Math.min(n, C.CHAR_LEVEL.max); });
    s.charLv = clv;
    s.ach = Object.assign({}, s.ach && typeof s.ach === 'object' ? s.ach : {});
    if ((old.version || 1) < 6) s.stats.charsGot = Math.max(s.stats.charsGot, Object.values(s.chars).reduce((a, n) => a + (n | 0), 0));
    if (!s.daily || typeof s.daily !== 'object' || typeof s.daily.day !== 'string') s.daily = null;
    if (!s.shop || typeof s.shop !== 'object' || !Array.isArray(s.shop.items)) s.shop = null;
    s.friendId = typeof s.friendId === 'string' ? s.friendId.replace(/\D/g, '').slice(0, 9) : '';
    const pt = emptyPity();
    Object.keys(pt).forEach((k) => { pt[k] = Math.max(0, Math.floor(Number(s.pity && s.pity[k]) || 0)); });
    s.pity = pt;
    noteFlags(s);
    s.version = 7;
    grantProgressRewards(s);
    return s;
  }

  /** 持っている装備・キャラから「初めて〇〇を手に入れた」の印をつける（一度ついたら消えない） */
  function noteFlags(s) {
    const f = s.flags;
    Object.keys(s.inventory).forEach((k) => {
      const p = parseKey(k);
      if (!p) return;
      if (p.rar.rank >= RARITY.epic.rank) f.gotEpic = true;
      if (p.rar.rank >= RARITY.legend.rank) f.gotLegend = true;
    });
    Object.keys(s.chars).forEach((k) => {
      const r = C.CHARACTERS[k] && C.CHARACTERS[k].rarity;
      if (r === 'legend' || r === 'legendPlus') f.gotLegendChar = true;
      if (r === 'legendPlus') f.gotLegendPlusChar = true;
    });
    if (C.SLOTS.every(({ key }) => s.equipped[key])) f.fullGear = true;
  }

  /* ---------- 進み具合（ステージ解放・ガチャ解放・チケット） ---------- */
  /** 一番先までクリアしたステージ（0 始まり）。1つもクリアしていなければ -1 */
  function progressOf(s) {
    let p = -1;
    C.STAGES.forEach((st, i) => { if ((s.missions.stages[st.key] || 0) > 0) p = Math.max(p, i); });
    return p;
  }
  /** 進み具合に応じたごほうびを渡す（何度呼んでも1回だけ）。新しく起きたことを配列で返す */
  function grantProgressRewards(s) {
    const p = progressOf(s), got = [];
    if (p >= C.FULL_RARITY_UNLOCK && !s.flags.fullRarity) { s.flags.fullRarity = true; got.push('fullRarity'); }
    if (p >= C.CHAR_TICKET_STAGE && !s.flags.charTicket) {
      s.flags.charTicket = true;
      s.tickets.char10 = (s.tickets.char10 || 0) + 1;
      got.push('charTicket');
    }
    return got;
  }

  function load() {
    try {
      const raw = localStorage.getItem(C.SAVE_KEY);
      return raw ? normalize(JSON.parse(raw)) : freshSave();
    } catch (e) {
      return freshSave();
    }
  }

  let save = load();
  const progress = () => progressOf(save);
  /** 遊べる一番先のステージ（0 始まり）。前のステージをクリアすると次が遊べる */
  const maxStage = () => Math.min(C.STAGES.length - 1, progress() + 1);
  const isStageOpen = (i) => i <= maxStage();
  const fullRarity = () => !!save.flags.fullRarity;

  function persist() {
    save.updatedAt = Date.now();
    try { localStorage.setItem(C.SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 保存できない環境では無視 */ }
    listeners.forEach((fn) => fn(save));
  }
  persist(); // 初回起動時のデータもすぐ保存しておく

  // ---------- ステータス計算 ----------
  /** 装備の素の値（レアリティ × 合成段階の倍率 × レベルの倍率） */
  function itemValue(p, level) {
    const slotDef = C.SLOTS.find((s) => s.key === p.slot);
    const mult = p.rarity === 'legendPlus' ? 1 : F.mult[p.lv];
    const lv = level == null ? itemLevel(p.key) : level;
    const sm = p.def.s ? SG.mult : 1;
    return { stat: slotDef.stat, value: Math.round(p.rar[slotDef.stat] * mult * sm * (1 + LV.perLevel * (lv - 1))), level: lv };
  }

  /* ---------- 装備のレベル ---------- */
  const levelMax = (rarity) => LV.max[rarity] || 1;
  function itemLevel(key) {
    const p = parseKey(key);
    return p ? Math.max(1, Math.min(levelMax(p.rarity), save.levels[p.key] | 0 || 1)) : 1;
  }
  /** Lv1 から lv まで上げるのに使った設計図とコイン */
  function levelSpent(lv) {
    let bp = 0, coins = 0;
    for (let n = 1; n < lv; n++) { bp += LV.bp(n); coins += LV.coins(n); }
    return { bp, coins };
  }
  /** { lv, max, next: { bp, coins } | null, have: 持っている設計図, can: 上げられるか, spent } */
  function levelInfo(key) {
    const p = parseKey(key);
    if (!p) return null;
    const lv = itemLevel(p.key), max = levelMax(p.rarity);
    const next = lv < max ? { bp: LV.bp(lv), coins: LV.coins(lv) } : null;
    const have = save.blueprints[p.slot] || 0;
    return { lv, max, next, have, slot: p.slot, spent: levelSpent(lv),
      can: !!next && !!save.inventory[p.key] && have >= next.bp && save.coins >= next.coins };
  }
  /** 1つレベルを上げる（times 回まで、上げられるだけ）。上がった数を返す */
  function levelUp(key, times = 1) {
    const p = parseKey(key);
    let n = 0;
    while (n < times) {
      const li = levelInfo(key);
      if (!li || !li.can) break;
      save.blueprints[p.slot] -= li.next.bp; save.coins -= li.next.coins;
      save.levels[p.key] = li.lv + 1;
      save.stats.levelUps++;
      n++;
    }
    if (n) persist();
    return n;
  }
  /** レベルを1に戻して、使った設計図とコインを返す。返したもの { bp, coins, slot } */
  function resetLevel(key, silent) {
    const p = parseKey(key);
    if (!p) return null;
    const lv = save.levels[p.key] | 0;
    delete save.levels[p.key];
    if (lv <= 1) return null;
    const sp = levelSpent(lv);
    save.blueprints[p.slot] += sp.bp; save.coins += sp.coins;
    if (!silent) persist();
    return Object.assign({ slot: p.slot }, sp);
  }

  /* ---------- 設計図・どうぐ・報酬 ---------- */
  /** ランダム設計図 n 枚：1枚ずつ 武器・防具・ベルト・靴 のどれかになる。{ weapon: 3, ... } を返す */
  function addRandomBlueprints(n) {
    const got = emptyBp();
    for (let i = 0; i < n; i++) got[SLOT_KEYS[Math.floor(rnd() * SLOT_KEYS.length)]]++;
    SLOT_KEYS.forEach((k) => { save.blueprints[k] += got[k]; });
    return got;
  }
  /** 報酬 { coins, bp, ticket, tool } を渡す。もらったものの説明 { coins, bp: {...}, ticket, tool } を返す */
  function grantReward(r) {
    const out = {};
    if (r.coins) { save.coins += r.coins; out.coins = r.coins; }
    if (r.bp) out.bp = addRandomBlueprints(r.bp);
    if (r.essence) { save.essence += r.essence; out.essence = r.essence; }
    if (r.ticket) { const n = r.ticketN || 1; save.tickets[r.ticket] = (save.tickets[r.ticket] || 0) + n; out.ticket = r.ticket; out.ticketN = n; }
    if (r.tool) { const n = r.toolN || 1; save.tools[r.tool] = (save.tools[r.tool] || 0) + n; out.tool = r.tool; out.toolN = n; }
    return out;
  }
  const toolCount = () => Object.keys(save.tools).reduce((a, k) => a + (save.tools[k] | 0), 0);
  /** エピック装備選択BOX などを使う。手に入れた装備のキーを返す */
  function useTool(tool, item) {
    const T = C.TOOLS[tool];
    // エピックS装備選択BOX は S装備だけ、エピック装備選択BOX は S装備以外だけ選べる
    if (!T || !(save.tools[tool] > 0) || !C.ITEMS[item] || !!C.ITEMS[item].s !== !!T.s) return null;
    save.tools[tool]--;
    if (!save.tools[tool]) delete save.tools[tool];
    addItem(item, T.pick);
    persist();
    return makeKey(item, T.pick, 0);
  }

  /* ---------- ステージクリア報酬 ---------- */
  function dropRow(stageNo) {
    const T = C.STAGE_DROPS.table;
    return T.find((r) => stageNo <= r.upTo) || T[T.length - 1];
  }
  /** クリアしたときに、倒した数のコイン・ランダム設計図・ランダム装備を渡す */
  function giveStageDrops(stageNo, kills) {
    const row = dropRow(stageNo);
    const coins = Math.max(0, kills | 0) * C.STAGE_DROPS.killCoin;
    save.coins += coins;
    const bp = addRandomBlueprints(row.bp);
    const er = C.STAGE_DROPS.essenceRand || 0;
    const essence = Math.round(row.essence * (1 - er + rnd() * er * 2) / 10) * 10;
    save.essence += essence;
    const items = [];
    for (let i = 0; i < row.items; i++) {
      const item = NORMAL_ITEMS[Math.floor(rnd() * NORMAL_ITEMS.length)], rarity = pickWeighted(row.rates);
      items.push({ item, rarity, isNew: addItem(item, rarity) });
    }
    return { coins, bp, bpTotal: row.bp, essence, items };
  }
  /** そのレアリティまでに得られる追加効果（下のレアリティの分も全部） */
  function rarityEffects(rarity) {
    const r = RARITY[rarity];
    const out = { atk: 0, hp: 0, passive: false, skill: false, list: [] };
    if (!r) return out;
    C.RARITIES.forEach((x, i) => {
      const e = C.RARITY_EFFECTS[x.key];
      if (!e || i > r.rank) return;
      out.atk += e.atk || 0; out.hp += e.hp || 0;
      if (e.passive) out.passive = true;
      if (e.skill) out.skill = true;
      out.list.push({ rarity: x.key, text: e.text });
    });
    return out;
  }
  const hasPassive = (p) => !!p && p.rar.rank >= RARITY.epic.rank && !!p.def.passive;

  function itemStats(key, level) {
    const p = parseKey(key);
    if (!p) return null;
    const iv = itemValue(p, level);
    const bonus = p.def.bonus || {};
    const re = rarityEffects(p.rarity);
    return {
      atk: iv.stat === 'atk' ? iv.value : 0,
      hp: iv.stat === 'hp' ? iv.value : 0,
      spd: bonus.spd || 0,
      atkPct: (bonus.atk || 0) + re.atk + (hasPassive(p) && p.def.passive.atk ? p.def.passive.atk : 0),
      hpPct: (bonus.hp || 0) + re.hp,
      dmgTaken: bonus.dmgTaken || 0,
      level: iv.level,
      rarityStat: iv,
      bonus, rarityFx: re,
      passive: hasPassive(p) ? p.def.passive : null,
      aura: p.def.aura || null,
    };
  }

  function charInfo(key) {
    const d = C.CHARACTERS[key];
    if (!d) return null;
    const lv = charLevel(key);
    const mult = +(C.CHAR_MULT[d.rarity] * (1 + C.CHAR_LEVEL.perLevel * (lv - 1))).toFixed(3);
    return Object.assign({ key, baseMult: C.CHAR_MULT[d.rarity], mult, lv, rar: RARITY[d.rarity] }, d);
  }

  /* ---------- キャラのレベル・分解 ---------- */
  const CL = C.CHAR_LEVEL;
  function charLevel(key) { return Math.max(1, Math.min(CL.max, (save && save.charLv && save.charLv[key]) | 0 || 1)); }
  /** { lv, max, next: { coins, essence } | null, can, owned } */
  function charLevelInfo(key) {
    if (!C.CHARACTERS[key]) return null;
    const lv = charLevel(key), owned = (save.chars[key] || 0) > 0;
    const next = lv < CL.max ? { coins: CL.coins(lv), essence: CL.essence(lv) } : null;
    return { lv, max: CL.max, next, owned, can: owned && !!next && save.coins >= next.coins && save.essence >= next.essence };
  }
  function charLevelUp(key, times = 1) {
    let n = 0;
    while (n < times) {
      const li = charLevelInfo(key);
      if (!li || !li.can) break;
      save.coins -= li.next.coins; save.essence -= li.next.essence;
      save.charLv[key] = li.lv + 1;
      save.stats.charLevelUps++;
      n++;
    }
    if (n) persist();
    return n;
  }
  /** 被ったキャラを n 体分解してエッセンスにする（1体は残る）。もらったエッセンスを返す */
  function dismantleChar(key, n) {
    const d = C.CHARACTERS[key], have = save.chars[key] || 0;
    n = Math.min(Math.max(0, n | 0), have - 1);
    if (!d || n <= 0) return 0;
    const got = n * (C.DISMANTLE[d.rarity] || 0);
    save.chars[key] = have - n;
    save.essence += got;
    persist();
    return got;
  }
  /** 全部のキャラの被りを分解（各1体残す） */
  function dismantleAll() {
    let got = 0;
    Object.keys(save.chars).forEach((k) => {
      const n = (save.chars[k] || 0) - 1;
      if (n > 0) { got += n * (C.DISMANTLE[C.CHARACTERS[k].rarity] || 0); save.chars[k] = 1; }
    });
    if (got) { save.essence += got; persist(); }
    return got;
  }

  /**
   * ATK・HP の計算
   *   (基礎 + 装備の値) × キャラの倍率 × (1 + 補正%の合計)
   *   補正% = 装備の補正（例：エターナルベルト ATK+30%）+ レアリティの追加効果（例：レジェンド ATK・HP+15%）
   */
  function getStats(equipped, charKey) {
    const eq = equipped || save.equipped;
    const ch = charInfo(charKey === undefined ? save.char : charKey);
    const t = Object.assign({}, C.BASE_STATS);
    let atkPct = 0, hpPct = 0, dmgTaken = 0;
    const auras = [], passives = [];
    C.SLOTS.forEach(({ key }) => {
      const st = itemStats(eq[key]);
      if (!st) return;
      t.atk += st.atk; t.hp += st.hp; t.spd += st.spd;
      atkPct += st.atkPct; hpPct += st.hpPct; dmgTaken += st.dmgTaken;
      const p = parseKey(eq[key]);
      if (st.aura) auras.push(Object.assign({ from: p.def.name }, st.aura));
      if (st.passive) passives.push(p.item);
    });
    const m = ch ? ch.mult : 1;
    return {
      atk: Math.max(1, Math.round(t.atk * m * Math.max(0.1, 1 + atkPct / 100))),
      hp: Math.max(1, Math.round(t.hp * m * Math.max(0.1, 1 + hpPct / 100))),
      spd: Math.max(10, t.spd), auras, passives, charMult: m, atkPct, hpPct, dmgTaken,
    };
  }

  /** 持っている装備で一番強くなる組み合わせ（ATKとHPの伸びを同じくらい大事にする） */
  function bestLoadout() {
    const eq = Object.assign({}, save.equipped);
    const owned = Object.keys(save.inventory).map(parseKey).filter((p) => p && save.inventory[p.key] > 0);
    for (let pass = 0; pass < 2; pass++) {
      C.SLOTS.forEach(({ key }) => {
        const base = getStats(eq);
        const score = (st) => st.atk / base.atk + st.hp / base.hp + st.spd / 2000;
        let best = eq[key], bestScore = eq[key] ? score(base) : -1;
        if (key !== 'weapon') { const st = getStats(Object.assign({}, eq, { [key]: null })); if (score(st) > bestScore + 1e-9) { best = null; bestScore = score(st); } }
        owned.filter((p) => p.slot === key).forEach((p) => {
          const st = getStats(Object.assign({}, eq, { [key]: p.key }));
          const sc = score(st);
          if (sc > bestScore + 1e-9) { bestScore = sc; best = p.key; }
        });
        eq[key] = best;
      });
    }
    return eq;
  }
  /** おすすめ装備に付け替える。変わったスロットの数を返す */
  function equipBest(dry) {
    const eq = bestLoadout();
    const changed = C.SLOTS.filter(({ key }) => (eq[key] || null) !== (save.equipped[key] || null)).length;
    if (!dry && changed) { save.equipped = eq; persist(); }
    return changed;
  }

  /** バトルで使うプレイヤー情報 */
  function getLoadout() {
    const stats = getStats();
    const w = parseKey(save.equipped.weapon);
    const gear = {};
    C.SLOTS.forEach(({ key }) => { const p = parseKey(save.equipped[key]); gear[key] = p ? p.item + ':' + p.rarity : null; });
    return {
      name: save.name,
      atk: stats.atk, hp: stats.hp, spd: stats.spd,
      auras: stats.auras,
      weapon: w ? Object.assign({ item: w.item, rarity: w.rarity }, w.def.weapon) : null,
      equipped: Object.assign({}, save.equipped),
      gear, passives: stats.passives, dmgTaken: stats.dmgTaken,
      char: save.char,
      look: save.look,
    };
  }

  // ---------- 操作 ----------
  function addCoins(n) { save.coins = Math.max(0, save.coins + n); persist(); }

  function spendCoins(n) {
    if (save.coins < n) return false;
    save.coins -= n; persist();
    return true;
  }

  /** 所持装備に追加。初入手なら true を返す */
  function addItem(item, rarity, lv = 0) {
    if (!validRarity(item, rarity)) rarity = SG.minRarity;
    const k = makeKey(item, rarity, lv);
    const isNew = !save.inventory[k];
    save.inventory[k] = (save.inventory[k] || 0) + 1;
    noteItem(rarity);
    return isNew;
  }
  function noteItem(rarity) {
    const r = RARITY[rarity];
    if (!r) return;
    if (r.rank >= RARITY.epic.rank) save.flags.gotEpic = true;
    if (r.rank >= RARITY.legend.rank) save.flags.gotLegend = true;
  }

  function equip(key) {
    const p = parseKey(key);
    if (!p || !save.inventory[p.key]) return false;   // 所持していない装備は装着不可
    save.equipped[p.slot] = p.key;
    if (C.SLOTS.every(({ key: sk }) => save.equipped[sk])) save.flags.fullGear = true;
    persist();
    return true;
  }

  function unequip(slot) {
    if (slot === 'weapon') return false;            // 武器は必ず1つ装備
    save.equipped[slot] = null;
    persist();
    return true;
  }

  /**
   * 合成のルール
   *   ・同じ装備（種類・レアリティ・合成段階がすべて同じ）を3つ → 1段階上（❶ → ❷ → ❸）
   *   ・❸を3つ → 次のレアリティ（素）にグレードアップ
   *   ・レジェンド❸を5つ → レジェンド+
   * fuseInfo(key) は { kind: 'level'|'grade'|'plus', need, to } か null を返す
   */
  const RANKS = C.RARITIES.map((r) => r.key);
  function fuseInfo(key) {
    const p = parseKey(key);
    if (!p || p.rarity === 'legendPlus') return null;
    if (p.lv < F.max) return { kind: 'level', need: F.need, to: makeKey(p.item, p.rarity, p.lv + 1) };
    if (p.rarity === 'legend') return { kind: 'plus', need: F.plusNeed, to: makeKey(p.item, 'legendPlus', 0) };
    return { kind: 'grade', need: F.gradeNeed, to: makeKey(p.item, RANKS[RANKS.indexOf(p.rarity) + 1], 0) };
  }
  function canFuse(key) {
    const p = parseKey(key), f = fuseInfo(key);
    return !!p && !!f && (save.inventory[p.key] || 0) >= f.need;
  }
  function fuse(key, silent) {
    if (!canFuse(key)) return null;
    const p = parseKey(key), f = fuseInfo(key);
    save.inventory[p.key] -= f.need;
    // 全部なくなったら、その装備のレベルはリセット（設計図とコインが戻る）
    if (save.inventory[p.key] <= 0) { delete save.inventory[p.key]; resetLevel(p.key, true); }
    save.inventory[f.to] = (save.inventory[f.to] || 0) + 1;
    save.stats.fuses++;
    noteItem(parseKey(f.to).rarity);
    // 装備中の装備がなくなったら、合成後の装備をそのまま装備する
    if (save.equipped[p.slot] === p.key && !save.inventory[p.key]) save.equipped[p.slot] = f.to;
    if (!silent) persist();
    return f.to;
  }
  /** 合成できるものを全部合成（低いレアリティ・低い段階から順に）。合成結果の一覧を返す */
  function fuseAll() {
    const made = [];
    let again = true;
    const order = (k) => { const p = parseKey(k); return p.rar.rank * 10 + p.lv; };
    while (again) {
      again = false;
      for (const k of Object.keys(save.inventory).sort((a, b) => order(a) - order(b))) {
        while (canFuse(k)) { made.push(fuse(k, true)); again = true; }
      }
    }
    if (made.length) persist();
    return made;
  }
  function fusibleList() { return inventoryList().filter((x) => canFuse(x.key)); }

  // ---------- キャラ ----------
  function addChar(key) {
    if (!C.CHARACTERS[key]) return false;
    const isNew = !save.chars[key];
    save.chars[key] = (save.chars[key] || 0) + 1;
    save.stats.charsGot++;
    const r = C.CHARACTERS[key].rarity;
    if (r === 'legend' || r === 'legendPlus') save.flags.gotLegendChar = true;
    if (r === 'legendPlus') save.flags.gotLegendPlusChar = true;
    return isNew;
  }
  function setChar(key) {
    if (key && !save.chars[key]) return false;
    save.char = key || null;
    persist();
    return true;
  }
  function charList() {
    return Object.keys(C.CHARACTERS).map((k) => Object.assign(charInfo(k), { count: save.chars[k] || 0 }))
      .sort((a, b) => b.rar.rank - a.rar.rank);
  }
  function charGachaUnlocked() { return progress() >= C.CHAR_TICKET_STAGE; }
  function setLook(key) {
    if (key && !C.CHARACTERS[key]) return false;
    save.look = key || null;
    persist();
    return true;
  }
  function useTicket(kind) {
    if (!(save.tickets[kind] > 0)) return false;
    save.tickets[kind]--;
    return true;
  }

  function setIcon(key) {
    if (key && !C.CHARACTERS[key]) return false;
    save.icon = key || null;
    persist();
    return true;
  }

  function setName(name) {
    save.name = String(name).trim().slice(0, 10) || save.name;
    persist();
  }

  function inventoryList() {
    return Object.keys(save.inventory)
      .map((k) => { const p = parseKey(k); return p && Object.assign(p, { count: save.inventory[k] }); })
      .filter(Boolean)
      .sort((a, b) => b.rar.rank - a.rar.rank || b.lv - a.lv
        || C.SLOTS.findIndex((s) => s.key === a.slot) - C.SLOTS.findIndex((s) => s.key === b.slot)
        || a.item.localeCompare(b.item));
  }

  function resetSave() { save = freshSave(); persist(); }
  /** アカウント削除：この端末のデータを消す（次に開いたときは最初から） */
  function wipeLocal() {
    try { localStorage.removeItem(C.SAVE_KEY); } catch (e) { /* 無視 */ }
    save = freshSave();
  }

  /** クラウドから復元したデータで置き換える */
  function replaceSave(data) {
    save = normalize(data);
    persist();
  }
  /** クラウド保存用のデータ */
  function exportSave() { return JSON.parse(JSON.stringify(save)); }

  // ---------- アカウントレベル ----------
  /** { lv, xp: 今のレベルでたまった経験値, need: 次のレベルまでの経験値, max } */
  function accountInfo(xpTotal) {
    const A = C.ACCOUNT;
    let x = xpTotal == null ? save.account.xp : xpTotal, lv = 1;
    while (lv < A.maxLevel && x >= A.need(lv)) { x -= A.need(lv); lv++; }
    return { lv, xp: lv >= A.maxLevel ? 0 : x, need: lv >= A.maxLevel ? 0 : A.need(lv), max: lv >= A.maxLevel };
  }

  // ---------- 運営からのプレゼント ----------
  /** 受け取れる状態のプレゼント一覧（まだ条件を満たしていないものは入らない） */
  function presentList() {
    const cleared = progress() + 1;
    // 管理ページから届いたもの（id は 'g:' ＋ 届いたときの番号）。古い順に並べる（画面では新しい順）
    const G = save.presents.gifts, AL = save.presents.all;
    // 全員へのもの（id は 'a:' ＋ 番号）。期限が過ぎたものは、受け取っていなければ出さない
    const now = Date.now();
    const gifts = Object.keys(G).map((gid) => Object.assign({ id: 'g:' + gid, gift: gid }, G[gid]))
      .concat(Object.keys(AL).map((gid) => Object.assign({ id: 'a:' + gid, allGift: gid }, AL[gid])))
      .filter((g) => !(g.until && now > g.until && !save.presents.claimed[g.id]))
      .sort((a, b) => (a.at || 0) - (b.at || 0));
    return (C.PRESENTS || []).filter((pr) => cleared >= (pr.after || 0)).concat(gifts)
      .map((pr) => Object.assign({ claimed: !!save.presents.claimed[pr.id] }, pr));
  }
  const presentCount = () => presentList().filter((p) => !p.claimed).length;
  const presentsVisible = () => (progress() >= 0 && (C.PRESENTS || []).length > 0) || Object.keys(save.presents.gifts).length > 0 || Object.keys(save.presents.all).length > 0;
  /**
   * プレゼントを受け取る（id を省略すると全部）
   * { coins: コインの合計, got: grantReward の結果の配列, gifts: 受け取った管理ページのプレゼントの番号 } を返す
   */
  function claimPresent(id) {
    let coins = 0;
    const got = [], gifts = [], allGifts = [];
    presentList().forEach((pr) => {
      if (pr.claimed || (id && pr.id !== id)) return;
      save.presents.claimed[pr.id] = Date.now();
      if (pr.coins) { got.push(grantReward({ coins: pr.coins })); coins += pr.coins; }
      Object.keys(pr.tickets || {}).forEach((k) => { got.push(grantReward({ ticket: k, ticketN: pr.tickets[k] })); });
      if (pr.gift) gifts.push(pr.gift);
      if (pr.allGift) allGifts.push(pr.allGift);
    });
    persist();
    return { coins, got, gifts, allGifts };
  }
  /**
   * サーバーにある管理ページのプレゼント（{ 番号: { title, text, coins, tickets, at, claimed } }）と合わせる
   *   ・新しいもの → プレゼントボックスに入れる
   *   ・ほかの端末で受け取り済み → 受け取り済みにする（もう一度はもらえない）
   *   ・まだ受け取っていないのにサーバーから消えた（管理ページで取り消した）→ 消す
   * { added: 新しく届いた数, report: 受け取ったことをサーバーに書く番号 } を返す
   */
  function syncGifts(remote) {
    const G = save.presents.gifts, CL = save.presents.claimed;
    let added = 0, changed = false;
    const report = [];
    Object.keys(remote || {}).forEach((gid) => {
      const r = remote[gid], g = cleanGift(r);
      if (!g) return;
      if (!G[gid]) { G[gid] = g; changed = true; if (!r.claimed && !CL['g:' + gid]) added++; }
      if (r.claimed && !CL['g:' + gid]) { CL['g:' + gid] = Number(r.claimed) || Date.now(); changed = true; }
      if (!r.claimed && CL['g:' + gid]) report.push(gid);
    });
    Object.keys(G).forEach((gid) => {
      if (!(remote && remote[gid]) && !CL['g:' + gid]) { delete G[gid]; changed = true; }
    });
    if (changed) persist();
    return { added, report };
  }

  /**
   * 全員へのプレゼント（giftsAll）と合わせる。新しいものを入れ、受け取っていないのに消えた・期限が過ぎたものは消す
   * 新しく届いた数を返す
   */
  function syncGiftsAll(remote) {
    const AL = save.presents.all, CLM = save.presents.claimed, now = Date.now();
    let added = 0, changed = false;
    Object.keys(remote || {}).forEach((gid) => {
      const g = cleanGift(remote[gid]);
      if (!g || AL[gid]) return;
      if (g.until && now > g.until) return;
      AL[gid] = g; changed = true;
      if (!CLM['a:' + gid]) added++;
    });
    Object.keys(AL).forEach((gid) => {
      if (CLM['a:' + gid]) return;
      if (!(remote && remote[gid]) || (AL[gid].until && now > AL[gid].until)) { delete AL[gid]; changed = true; }
    });
    if (changed) persist();
    return added;
  }

  /* ---------- フレンドとのトレード（装備・キャラを出す・受け取る） ---------- */
  // トレードで使うキー：装備は 'kunai:epic:0'、キャラは 'c:widow'
  function charOfKey(k) { return typeof k === 'string' && k.startsWith('c:') && C.CHARACTERS[k.slice(2)] ? k.slice(2) : null; }
  function validTradeKey(k) { return !!charOfKey(k) || !!parseKey(k); }
  /** キャラのレベルを1に戻して、使ったコインとエッセンスを返す */
  function resetCharLevel(c) {
    const lv = charLevel(c);
    delete save.charLv[c];
    let coins = 0, essence = 0;
    for (let n = 1; n < lv; n++) { coins += CL.coins(n); essence += CL.essence(n); }
    save.coins += coins; save.essence += essence;
    return { coins, essence };
  }
  /** トレードに出せるか：持っていて、装備中の武器の最後の1つでない（キャラは持っていれば出せる） */
  function canGive(key) {
    const c = charOfKey(key);
    if (c) return (save.chars[c] || 0) > 0;
    const p = parseKey(key);
    if (!p || !(save.inventory[p.key] > 0)) return false;
    return !(p.slot === 'weapon' && save.equipped.weapon === p.key && save.inventory[p.key] <= 1);
  }
  /**
   * 1つ手放す。最後の1つならレベルを戻し（装備：設計図とコイン／キャラ：コインとエッセンスが戻る）、
   * 装備していれば外す（使っているキャラなら「キャラなし」になる）
   */
  function takeItem(key) {
    if (!canGive(key)) return false;
    const c = charOfKey(key);
    if (c) {
      save.chars[c]--;
      if (save.chars[c] <= 0) {
        delete save.chars[c];
        resetCharLevel(c);
        if (save.char === c) save.char = null;
      }
      return true;
    }
    const p = parseKey(key);
    save.inventory[p.key]--;
    if (save.inventory[p.key] <= 0) {
      delete save.inventory[p.key];
      resetLevel(p.key, true);
      if (save.equipped[p.slot] === p.key) save.equipped[p.slot] = null;
    }
    return true;
  }
  /** 1つもらう（装備は合成段階もそのまま。キャラは1体増える） */
  function putItem(key) {
    const c = charOfKey(key);
    if (c) {
      save.chars[c] = (save.chars[c] || 0) + 1;
      const r = C.CHARACTERS[c].rarity;
      if (r === 'legend' || r === 'legendPlus') save.flags.gotLegendChar = true;
      if (r === 'legendPlus') save.flags.gotLegendPlusChar = true;
      return true;
    }
    const p = parseKey(key);
    if (!p) return false;
    save.inventory[p.key] = (save.inventory[p.key] || 0) + 1;
    noteItem(p.rarity);
    return true;
  }

  // ---------- 7日間限定ミッション ----------
  const LM = C.LIMITED;
  const counters = () => ({
    kills: save.missions.kills, clears: save.missions.clears,
    itemPulls: save.stats.itemPulls, charPulls: save.stats.charPulls, fuses: save.stats.fuses, levelUps: save.stats.levelUps,
  });
  /** 引き継ぎコードを発行したときに呼ぶ（2回目以降は何もしない） */
  function startLimited(t) {
    if (save.limited.start) return false;
    save.limited = Object.assign(emptyLimited(), { start: t || Date.now(), base: counters() });
    touchLogin(true);
    persist();
    return true;
  }
  const limitedEnds = () => save.limited.start + LM.durationMs;
  const limitedActive = (now) => !!save.limited.start && (now || Date.now()) < limitedEnds();
  /** 今日ログインしたことを記録（期間中だけ）。新しい日なら true */
  function touchLogin(silent) {
    if (!limitedActive()) return false;
    const k = dayKey(Date.now());
    if (save.limited.days.includes(k)) return false;
    save.limited.days.push(k);
    if (!silent) persist();
    return true;
  }
  function limitedProgress(m) {
    const b = save.limited.base || counters(), c = counters();
    switch (m.type) {
      case 'login': return save.limited.days.length;
      case 'stage': return progress() + 1 >= m.n ? m.n : 0;
      case 'kills': return c.kills - b.kills;
      case 'clears': return c.clears - b.clears;
      case 'pulls': return c.itemPulls + c.charPulls - b.itemPulls - b.charPulls;
      case 'charPulls': return c.charPulls - b.charPulls;
      case 'fuse': return c.fuses - b.fuses;
      case 'levelUp': return c.levelUps - b.levelUps;
      default: return 0;
    }
  }
  /** 7日間限定ミッションの状態 */
  function limitedInfo(now) {
    now = now || Date.now();
    const L = save.limited;
    const open = Math.min(LM.days.length, L.days.length);
    const days = LM.days.map((list, d) => list.map((m, i) => {
      const id = d + '-' + i, prog = Math.max(0, limitedProgress(m));
      return Object.assign({ id, day: d, idx: i, prog: Math.min(prog, m.n), done: prog >= m.n, claimed: !!L.claimed[id], open: d < open }, m);
    }));
    const claimedN = Object.keys(L.claimed).length;
    const ready = days.flat().filter((m) => m.open && m.done && !m.claimed).length;
    const ms = LM.milestones.map((x) => Object.assign({ reached: claimedN >= x.n, claimed: !!L.ms[x.n] }, x));
    return {
      started: !!L.start, active: limitedActive(now), start: L.start, ends: L.start ? limitedEnds() : 0,
      left: L.start ? Math.max(0, limitedEnds() - now) : 0,
      loginDays: L.days.length, open, days, claimedN, total: days.flat().length, ready,
      milestones: ms, msReady: ms.filter((x) => x.reached && !x.claimed).length,
    };
  }
  /** ミッションの報酬を受け取る（id を省略すると受け取れるもの全部）。もらったものの一覧を返す */
  function claimLimited(id) {
    const li = limitedInfo();
    if (!li.active) return [];
    const got = [];
    li.days.flat().forEach((m) => {
      if (!m.open || !m.done || m.claimed || (id && m.id !== id)) return;
      save.limited.claimed[m.id] = Date.now();
      got.push(grantReward(m.reward));
    });
    if (got.length) persist();
    return got;
  }
  /** 達成数のごほうびを受け取る（n を省略すると全部） */
  function claimLimitedMilestone(n) {
    const li = limitedInfo();
    if (!li.active) return [];
    const got = [];
    li.milestones.forEach((x) => {
      if (!x.reached || x.claimed || (n && x.n !== n)) return;
      save.limited.ms[x.n] = Date.now();
      got.push(grantReward(x.reward));
    });
    if (got.length) persist();
    return got;
  }

  // ---------- 試合結果とミッション ----------
  /** 試合が終わったら呼ぶ：倒した数・クリア・コイン獲得（アビリティ）・アカウント経験値を記録 */
  function recordMatch({ win, stageKey, kills, coins }) {
    const m = save.missions;
    const before = maxStage();
    const lvBefore = accountInfo().lv;
    const presentsBefore = presentCount();
    m.kills += Math.max(0, kills | 0);
    let xp = 0, drops = null;
    if (win) {
      m.clears++; m.stages[stageKey] = (m.stages[stageKey] || 0) + 1;
      const st = C.STAGES.find((x) => x.key === stageKey);
      xp = st ? C.ACCOUNT.clearXp(st.no) : 0;
      save.account.xp += xp;
      if (st) drops = giveStageDrops(st.no, kills);
    }
    if (coins > 0) save.coins += coins;
    const got = grantProgressRewards(save);
    got.drops = drops;
    if (maxStage() > before) got.push('stage:' + maxStage());
    const lvAfter = accountInfo().lv;
    if (xp) got.push('xp:' + xp);
    if (lvAfter > lvBefore) got.push('level:' + lvAfter);
    if (presentCount() > presentsBefore) got.push('present');
    persist();
    return got;
  }
  /** ミニゲームの結果を記録する（win：勝った・引き分けで勝者に入っていた） */
  function recordMinigame(game, win) {
    const st = save.stats;
    st.mgPlay++;
    if (st['mgP_' + game] != null) st['mgP_' + game]++;
    if (win) { st.mgWin++; if (st['mgW_' + game] != null) st['mgW_' + game]++; }
    persist();
  }
  /* ---------- ミッション（1回きり・何度でも） ---------- */
  const missionsUnlocked = () => progress() >= C.MISSION_UNLOCK;
  function setCodeIssued() { if (!save.flags.codeIssued) { save.flags.codeIssued = true; persist(); } }
  function achValue(a) {
    const f = save.flags, st = save.stats;
    switch (a.check) {
      case 'code': return f.codeIssued ? 1 : 0;
      case 'levelUps': return st.levelUps;
      case 'fuses': return st.fuses;
      case 'charsGot': return st.charsGot;
      case 'stage': return progress() + 1;
      case 'accountLv': return accountInfo().lv;
      case 'pulls': return st.itemPulls + st.charPulls;
      case 'charLevelUps': return st.charLevelUps;
      case 'shopBuys': return st.shopBuys;
      case 'mgPlay': return st.mgPlay;
      case 'mgWin': return st.mgWin;
      default: return f[a.check] ? 1 : 0;
    }
  }
  /** ミッションの一覧 { id, name, reward, prog, need, ready（受け取れる回数）, claimed（1回きりで受取済）, step } */
  function achievementList() {
    noteFlags(save);
    return C.ACHIEVEMENTS.map((a) => {
      const v = achValue(a);
      if (a.step) {
        const got = save.ach[a.id] | 0, n = Math.floor(v / a.step);
        return Object.assign({ prog: v % a.step, need: a.step, total: v, ready: Math.max(0, n - got), claimed: false }, a);
      }
      const need = a.n || 1, claimed = !!save.ach[a.id];
      return Object.assign({ prog: Math.min(v, need), need, ready: !claimed && v >= need ? 1 : 0, claimed }, a);
    });
  }
  /** id を省略すると受け取れるもの全部。もらったもの（grantReward の結果）の配列を返す */
  function claimAchievement(id) {
    if (!missionsUnlocked()) return [];
    const got = [];
    achievementList().forEach((a) => {
      if (!a.ready || (id && a.id !== id)) return;
      for (let i = 0; i < a.ready; i++) got.push(grantReward(a.reward));
      if (a.step) save.ach[a.id] = (save.ach[a.id] | 0) + a.ready; else save.ach[a.id] = true;
    });
    if (got.length) persist();
    return got;
  }

  /* ---------- デイリーミッション（毎日0時にリセット） ---------- */
  const DC = C.DAILY;
  const dailyCounters = () => ({ kills: save.missions.kills, clears: save.missions.clears, pulls: save.stats.itemPulls + save.stats.charPulls, levelUps: save.stats.levelUps });
  function ensureDaily() {
    const today = dayKey(Date.now());
    if (!save.daily || save.daily.day !== today) { save.daily = { day: today, base: dailyCounters(), claimed: {}, ms: {} }; return true; }
    return false;
  }
  function dailyInfo() {
    if (ensureDaily()) persist();
    const D = save.daily, c = dailyCounters(), b = D.base || c;
    const list = DC.missions.map((m) => {
      const v = m.type === 'login' ? 1 : Math.max(0, (c[m.type] || 0) - (b[m.type] || 0));
      return Object.assign({ prog: Math.min(v, m.n), done: v >= m.n, claimed: !!D.claimed[m.id] }, m);
    });
    const points = list.filter((m) => m.claimed).reduce((a, m) => a + m.point, 0);
    const ms = DC.milestones.map((x) => Object.assign({ reached: points >= x.n, claimed: !!D.ms[x.n] }, x));
    const next = new Date(); next.setHours(24, 0, 0, 0);
    return { list, points, max: DC.milestones[DC.milestones.length - 1].n, ms, ready: list.filter((m) => m.done && !m.claimed).length + ms.filter((x) => x.reached && !x.claimed).length, left: next - Date.now() };
  }
  /** id を省略すると全部。達成ポイントのごほうびもまとめて受け取る */
  function claimDaily(id) {
    if (!missionsUnlocked()) return [];
    const info = dailyInfo(), got = [];
    info.list.forEach((m) => { if (m.done && !m.claimed && (!id || id === m.id)) { save.daily.claimed[m.id] = true; got.push(grantReward(m.reward)); } });
    const pts = dailyInfo().points;
    DC.milestones.forEach((x) => { if (pts >= x.n && !save.daily.ms[x.n] && (!id || id === 'ms')) { save.daily.ms[x.n] = true; got.push(grantReward(x.reward)); } });
    if (got.length) persist();
    return got;
  }

  /* ---------- ショップ ---------- */
  const SH = C.SHOP;
  function shopPeriod(t) {
    const d = new Date(t), h = SH.hours;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(d.getHours() / h) * h, 0, 0, 0);
    return { key: dayKey(t) + '-' + Math.floor(d.getHours() / h), ends: start.getTime() + h * 3600000 };
  }
  function rollShopItem() {
    const kind = pickWeighted(SH.rates);
    if (kind === 'bp') return { kind, n: SH.bpAmount, price: SH.prices.bp, sold: false };
    if (kind === 'essence') return { kind, n: SH.essenceAmount, price: SH.prices.essence, sold: false };
    if (kind === 's') return { kind: 'item', s: true, item: S_ITEMS[Math.floor(rnd() * S_ITEMS.length)], rarity: SG.minRarity, price: SH.prices.s, sold: false };
    return { kind: 'item', item: NORMAL_ITEMS[Math.floor(rnd() * NORMAL_ITEMS.length)], rarity: kind, price: SH.prices[kind], sold: false };
  }
  function restock(per) { save.shop = Object.assign(save.shop || {}, { period: per.key, items: Array.from({ length: SH.slots }, rollShopItem) }); }
  /** 前のバージョンで並んだ品物を今の設定に合わせる。
   *  ・あとからS装備になった装備（破壊者コートなど）が通常装備として残っていたら、その枠だけ並べ直す
   *  ・値段と個数は今の config の値にそろえる（値上げ・値下げがすぐ反映される） */
  function fixShopStock() {
    let fixed = false;
    save.shop.items = save.shop.items.map((it) => {
      if (!it || typeof it !== 'object') { fixed = true; return rollShopItem(); }
      if (it.sold) return it;
      if (it.kind === 'item') {
        const def = C.ITEMS[it.item];
        if (!def || !!def.s !== !!it.s || (it.s ? it.rarity !== SG.minRarity : !SH.prices[it.rarity])) { fixed = true; return rollShopItem(); }
      } else if (it.kind !== 'bp' && it.kind !== 'essence') { fixed = true; return rollShopItem(); }
      const price = SH.prices[it.kind === 'item' ? (it.s ? 's' : it.rarity) : it.kind];
      const fix = { price };
      if (it.kind === 'bp') fix.n = SH.bpAmount;
      if (it.kind === 'essence') fix.n = SH.essenceAmount;
      if (Object.keys(fix).some((k) => it[k] !== fix[k])) { fixed = true; return Object.assign({}, it, fix); }
      return it;
    });
    return fixed;
  }
  /** ショップの状態 { items, ends（次の自動更新の時刻）, refreshLeft（今日あと何回更新できるか） } */
  function shopInfo() {
    const now = Date.now(), per = shopPeriod(now);
    let changed = false;
    if (!save.shop || save.shop.period !== per.key) { restock(per); changed = true; }
    const today = dayKey(now);
    if (save.shop.refDay !== today) { save.shop.refDay = today; save.shop.refN = 0; changed = true; }
    if (fixShopStock()) changed = true;
    if (changed) persist();
    return { items: save.shop.items, ends: per.ends, refreshLeft: Math.max(0, SH.refreshPerDay - (save.shop.refN | 0)) };
  }
  /** i 番目を買う。買えたら grantReward の結果か { item } を返す */
  function buyShop(i) {
    const info = shopInfo(), it = info.items[i];
    if (!it || it.sold || save.coins < it.price) return null;
    save.coins -= it.price; it.sold = true; save.stats.shopBuys++;
    let out;
    if (it.kind === 'item') out = { item: it.item, rarity: it.rarity, isNew: addItem(it.item, it.rarity) };
    else out = grantReward(it.kind === 'bp' ? { bp: it.n } : { essence: it.n });
    persist();
    return out;
  }
  /** コインを払って品物を入れ替える（1日 refreshPerDay 回まで） */
  function refreshShop() {
    const info = shopInfo();
    if (info.refreshLeft <= 0 || save.coins < SH.refreshCost) return false;
    save.coins -= SH.refreshCost; save.shop.refN = (save.shop.refN | 0) + 1;
    restock(shopPeriod(Date.now()));
    persist();
    return true;
  }

  function missionStatus() {
    const MC = DS.gameConfig.MISSIONS, m = save.missions;
    const clearN = Math.max(0, m.clears - m.clearsClaimed);
    const killN = Math.max(0, Math.floor(m.kills / MC.killStep) - m.killsClaimed);
    return {
      clears: m.clears, kills: m.kills, stages: m.stages,
      clearN, clearCoins: clearN * MC.stageClearReward,
      killN, killCoins: killN * MC.killReward,
      killProgress: m.kills % MC.killStep, killStep: MC.killStep,
      claimable: clearN + killN,
    };
  }
  /** kind: 'clear' | 'kill'。受け取ったコインの数を返す */
  function claimMission(kind) {
    const st = missionStatus(), m = save.missions;
    let coins = 0;
    if (kind === 'clear' && st.clearN) { coins = st.clearCoins; m.clearsClaimed += st.clearN; }
    if (kind === 'kill' && st.killN) { coins = st.killCoins; m.killsClaimed += st.killN; }
    if (coins) { save.coins += coins; persist(); }
    return coins;
  }

  DS.state = {
    get data() { return save; },
    RARITY, makeKey, parseKey, itemStats, itemValue, rarityEffects, getStats, getLoadout, S_ITEMS, NORMAL_ITEMS, validRarity,
    charLevel, charLevelInfo, charLevelUp, dismantleChar, dismantleAll,
    missionsUnlocked, setCodeIssued, achievementList, claimAchievement, dailyInfo, claimDaily, ensureDaily,
    shopInfo, buyShop, refreshShop, shopPeriod,
    addCoins, spendCoins, addItem, equip, unequip, setName, setIcon, pickWeighted, rnd,
    itemLevel, levelInfo, levelUp, resetLevel, levelSpent, levelMax,
    addRandomBlueprints, grantReward, toolCount, useTool, dropRow,
    startLimited, touchLogin, limitedInfo, claimLimited, claimLimitedMilestone, dayKey,
    canFuse, fuse, fuseAll, fusibleList, fuseInfo, bestLoadout, equipBest,
    accountInfo, presentList, presentCount, presentsVisible, claimPresent, syncGifts, syncGiftsAll, cleanGift, TICKET_KINDS,
    canGive, takeItem, putItem, validTradeKey, charOfKey,
    addChar, setChar, setLook, charInfo, charList, charGachaUnlocked, useTicket,
    progress, maxStage, isStageOpen, fullRarity, recordMinigame,
    inventoryList, persist, resetSave, wipeLocal, replaceSave, exportSave, normalize,
    recordMatch, missionStatus, claimMission,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();

/* =========================================================
 *  config.js  ― ゲーム全体の設定値
 *  数値バランスの調整はこのファイルだけで完結するようにしています。
 * ========================================================= */
window.DS = window.DS || {};

DS.config = {
  // ---- タイトル（好きな名前に変えてください） ----
  GAME_TITLE: 'SURVIVORS ARENA',
  GAME_SUBTITLE: 'サバイバーズ・アリーナ',

  // ---- セーブ ----
  SAVE_KEY: 'survivors-arena/save/v1',
  CLOUD_KEY: 'survivors-arena/cloud/v1',

  // ---- コイン ----
  START_COINS: 0,              // 初回起動時のコイン（配布なし）
  DEBUG_COIN_BUTTON: false,    // true にするとコイン横に「＋」ボタン（テスト用）が出る
  DEBUG_COIN_AMOUNT: 30000,

  // ---- はじめのチケットと解放 ----
  START_TICKETS: { item10: 1, char10: 0 },   // 最初に装備ガチャ10連無料チケットを1枚
  // ステージ1をクリアするまでは、ガチャからコモン・アンコモン・レアだけが出る（リセマラ防止）
  // その間はエピックの分がレアになる（コモン65% / アンコモン20% / レア15%）
  EARLY_RARITIES: ['common', 'uncommon', 'rare'],
  FULL_RARITY_UNLOCK: 0,       // このステージ（0=ステージ1）をクリアすると全レアリティ解放
  CHAR_TICKET_STAGE: 1,        // このステージ（1=ステージ2）をクリアするとキャラガチャ10連無料チケット

  // ---- プレイヤー基礎ステータス（装備なしの値） ----
  BASE_STATS: { atk: 100, hp: 1000, spd: 100 },

  // ---- マルチプレイ ----
  MAX_PLAYERS: 4,
  NET: {
    // 'auto'  : PeerJS（オンライン）を使い、読み込めない時はローカルに切替
    // 'online': PeerJS のみ
    // 'local' : 同じブラウザのタブ同士だけで通信（開発・テスト用）
    // URL に ?net=local を付けても切り替えられます
    MODE: 'auto',
    PEERJS_URLS: [
      'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
      'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    ],
    PEER_OPTIONS: {},          // 自前の PeerServer を使う時は { host, port, path, secure } を指定
    ID_PREFIX: 'survivors-arena-v1-lobby-',
    HEARTBEAT_MS: 3000,
    TIMEOUT_MS: 30000,
  },

  // ---- ガチャ ----
  GACHA: {
    singleCost: 3000,
    multiCost: 30000,
    multiCount: 10,
  },
  // 出る確率（%）。装備ガチャからはレジェンドは出ない（合成でだけ作れる）
  // 装備の 's' は「S装備（エピック）」。S装備はエピックより下のレアリティはありません
  GACHA_RATES: {
    item: { common: 60, uncommon: 23, rare: 10, epic: 5, s: 2 },
    char: { common: 65, uncommon: 20, rare: 12, epic: 2.5, legend: 0.45, legendPlus: 0.05 },
  },

  // ---- レアリティ ----
  // 武器・ベルトは atk が、防具・靴は hp が上がります（合成・レベルアップでさらに上がる）。
  // HP はもともと高い（基礎1000）ので、HP の上昇値は ATK の5倍にしてあります。
  // 各レアリティの素の強さは「1つ下のレアリティの❸（2倍）」より強くなるようにしてあります。
  RARITIES: [
    { key: 'common',     name: 'コモン',      atk: 60,   hp: 300,   color: '#ffffff' },
    { key: 'uncommon',   name: 'アンコモン',  atk: 130,  hp: 650,  color: '#3ccf5a' },
    { key: 'rare',       name: 'レア',        atk: 280,  hp: 1400,  color: '#3c8dff' },
    { key: 'epic',       name: 'エピック',    atk: 600,  hp: 3000,  color: '#a74dff' },
    { key: 'legend',     name: 'レジェンド',  atk: 1300, hp: 6500, color: '#ffc21a' },
    { key: 'legendPlus', name: 'レジェンド+', atk: 4000, hp: 20000, color: '#ff3b3b' },
    // ミシック：レジェンド+より上。今は「武器一覧」で見られるだけ（まだ手に入らない）
    { key: 'mythic',     name: 'ミシック',    atk: 0,    hp: 0,     color: '#b9f3ff', hidden: true },
  ],
  // ---- S装備 ----
  // ITEMS の s: true の装備。エピックからしか存在せず、同じレアリティの普通の装備より mult 倍強い
  // （レジェンド+ になっても S のまま。金色の S マーク）
  S_GEAR: { mult: 1.3, minRarity: 'epic' },
  // レアリティごとの追加効果。値はキャラの総合力（ATK・HP）に対する%。
  // 下のレアリティの効果もすべて持つ（例：レジェンドならアンコモン〜レジェンドの効果を全部得られる）
  RARITY_EFFECTS: {
    common:     null,
    uncommon:   { atk: 5,  text: '攻撃 +5%' },
    rare:       { hp: 5,   text: '体力 +5%' },
    epic:       { passive: true, text: 'パッシブ追加' },
    legend:     { atk: 10, hp: 10, text: '攻撃・体力 +10%' },
    legendPlus: { skill: true, text: 'スキル追加（近日実装）' },
  },

  // ---- 装備スロット ----
  SLOTS: [
    { key: 'weapon', name: '武器',   stat: 'atk' },
    { key: 'belt',   name: 'ベルト', stat: 'atk' },
    { key: 'armor',  name: '防具',   stat: 'hp'  },
    { key: 'boots',  name: '靴',     stat: 'hp'  },
  ],

  // ガチャ画面に並べる順番（上から 武器 → 防具 → ベルト → 靴）
  GACHA_ORDER: ['weapon', 'armor', 'belt', 'boots'],

  // ---- 装備アイテム ----
  // 見た目と名前はレアリティ共通。背景と ATK/HP だけがレアリティで変わります。
  // bonus  : 装備としての補正。atk・hp は「総合力に対する%」、spd は速度、dmgTaken は受けるダメージの%
  // aura   : 一定範囲内の敵へのデバフ
  // passive: エピック以上で使えるパッシブ（何もしなくても発動する効果）
  ITEMS: {
    kunai: {
      slot: 'weapon', name: 'クナイ',
      desc: '遠くの敵に単発の攻撃をすばやく連射する。',
      weapon: { pattern: 'single', range: 'long' },
      traits: ['遠距離', '単発連射'],
      passive: { name: '拡散クナイ', desc: '5秒に1度、クナイを5個拡散して投げる', cd: 5, count: 5, dmg: 1.0 },
    },
    shotgun: {
      slot: 'weapon', name: 'ショットガン',
      desc: '弾が扇状に拡散する。近距離ほど多くの弾が当たり、高いダメージを出せる。',
      weapon: { pattern: 'spread', range: 'short' },
      traits: ['近距離', '拡散'],
      passive: { name: '全方位射撃', desc: '10秒に1度、全方向に弾を撃つ（拡散が広い）', cd: 10, count: 28, dmg: 0.8 },
    },
    lightsaber: {
      slot: 'weapon', name: 'ライトセイバー', s: true,
      desc: '近くの敵に自動で狙いをつけて、剣を振って斬る（90度くらい）。★が上がるたびに攻撃範囲が広がる。',
      weapon: { pattern: 'swing', range: 'short' },
      traits: ['近距離', 'オートエイム'],
      passive: { name: '大回転斬り', desc: '15秒に1度、全方向に大きく回転斬りをする', cd: 15, range: 1.6, dmg: 3.0 },   // v20：範囲 2.2倍 → 1.6倍（エネルギーブレードに合わせた）
    },
    revolver: {
      slot: 'weapon', name: 'リボルバー',
      desc: '0.8秒ごとに近くの敵1体を撃ち抜く。',
      weapon: { pattern: 'single', range: 'middle' },
      traits: ['単発', '中距離'],
      passive: { name: 'デュアルリボルバー', desc: '10秒に1度、3秒間デュアルリボルバーになる（攻撃2倍）', cd: 10, dur: 3 },
    },
    minigun: {
      slot: 'weapon', name: 'ミニガン',
      desc: '10秒間撃ち続けて、3秒リロードする。1秒に20発、近くの敵を自動で狙う（1発 ATK×0.5）。',
      weapon: { pattern: 'rapid', range: 'middle' },
      traits: ['連射', 'オートエイム'],
      passive: { name: 'フルバースト', desc: '10秒に1度、3秒間 連射速度が1.5倍になる（撃っている間）', cd: 10, dur: 3, rate: 1.5 },
    },
    destroyerPower: {
      slot: 'weapon', name: '破壊の力', s: true,
      desc: '5秒に1回、近くの敵を自動で狙ってブラックホールを撃つ。ブラックホールは敵を吸い寄せながら3秒間ダメージを与え続ける（ATK で強くなる）。★が上がるたびに範囲と持続時間がのびる。',
      weapon: { pattern: 'blackhole', range: 'middle' },
      traits: ['範囲', '持続', 'オートエイム'],
      passive: { name: '事象の地平線', desc: '20秒に1度、2倍の大きさのブラックホールを4秒間つくる', cd: 20, scale: 2, dur: 4 },
    },
    plateArmor: {
      slot: 'armor', name: '鎧',
      desc: '耐久力は高いが、重くて移動速度が落ちる。',
      bonus: { hp: 30, spd: -10 },
      passive: { name: 'ガードシールド', desc: '60秒に1度、どんな攻撃でも1発は防ぐシールドを張る（張っている間は青白く光る）', cd: 60 },
    },
    leatherArmor: {
      slot: 'armor', name: 'レザーアーマー',
      desc: '鎧より耐久は落ちるが、身軽に動ける。',
      bonus: { hp: 15 },
      passive: { name: 'しなやかな革', desc: 'ダメージを受けるたびに、そのダメージを3%軽減する', cut: 3 },
    },
    eternalSuit: {
      slot: 'armor', name: 'エターナルバトルスーツ', s: true,
      desc: 'とても軽く動きやすいバトルスーツ。',
      bonus: { spd: 10, hp: 35 },   // v24：HP +10% → +35%（S装備が普通のエピック（鎧 HP+30%）より弱くならないように）
      passive: { name: '不死の加護', desc: '1度だけ、倒れても復活できる（復活時3秒無敵）', inv: 3, hp: 0.5 },
    },
    destroyerCoat: {
      slot: 'armor', name: '破壊者コート', s: true,
      desc: '守りを捨てて攻撃に振り切った黒いコート。',
      bonus: { hp: -30, atk: 30 },
      passive: { name: '背水の陣', desc: 'HPが少ないほど攻撃力が上がる（最大3倍）', max: 3 },
    },
    chimera: {
      slot: 'armor', name: 'キマイラ',
      desc: '獅子とヤギとヘビの力を宿した鎧。守りは弱いが、身軽で敵の力を吸い取る。',
      bonus: { hp: -30, spd: 10 },
      passive: { name: '吸血の牙', desc: '敵に与えたダメージの1%ぶん、HPを回復する', steal: 0.01 },
    },
    jacket: {
      slot: 'armor', name: 'ジャケット',
      desc: '動きやすいジャケット。',
      bonus: { hp: 10, spd: 10 },
      passive: { name: '戦場の勘', desc: 'モンスターを200体倒すたびに、HPを5%回復する', kills: 200, heal: 0.05 },
    },
    stellaBelt: {
      slot: 'belt', name: 'ステラベルト', s: true,
      desc: '星の力を宿すベルト。周囲の敵の攻撃速度を下げる。',
      bonus: { atk: 45 },           // v24：ATK +45% を追加（普通のエピックの破壊者ベルト（ATK+30%・パッシブ+10%）より強く）
      aura: { radius: 160, enemyAtkSpd: -10 },
      passive: { name: 'メテオ', desc: '45秒に1度、隕石を落として敵に当てる', cd: 45, r: 170, dmg: 12 },
    },
    eternalBelt: {
      slot: 'belt', name: 'エターナルベルト', s: true,
      desc: '尽きない力を秘めたベルト。攻撃力が上がる。',
      bonus: { atk: 50 },           // v24：ATK +30% → +50%
      passive: { name: '不屈', desc: '60秒に1度、攻撃を受けたときから3秒間無敵になる', cd: 60, dur: 3 },
    },
    destroyerBelt: {
      slot: 'belt', name: '破壊者ベルト',
      desc: '破壊の力を引き出すトゲ付きベルト。',
      bonus: { hp: -30, atk: 30 },
      passive: { name: '破壊衝動', desc: '受けるダメージが10%増える代わりに、攻撃力 +10%', dmgTaken: 10, atk: 10 },
    },
    fashionBelt: {
      slot: 'belt', name: 'ファッションベルト',
      desc: 'おしゃれ重視のベルト。動きにくく、守りも弱くなる。',
      bonus: { spd: -20, dmgTaken: 10 },
      passive: { name: 'みんなで元気', desc: 'どこにいても、味方と自分のHPを毎秒0.25%回復する', heal: 0.0025 },
    },
    waistSensor: {
      slot: 'belt', name: 'ウエストセンサー',
      desc: '体の調子を見張るセンサー付きのベルト。',
      bonus: { hp: 15, spd: 10 },
      passive: { name: '危険察知', desc: 'HPが50%以下のとき、受けるダメージ -20%', below: 0.5, cut: 20 },
    },
    leatherBelt: {
      slot: 'belt', name: 'レザーベルト',
      desc: 'しっかりした革のベルト。',
      bonus: { atk: 10, hp: 10 },
      passive: { name: '気合い', desc: '回復アイテムを拾うと、10秒間 攻撃力 +20%', dur: 10, atk: 20 },
    },
    eternalBoots: {
      slot: 'boots', name: 'エターナルブーツ', s: true,
      desc: '羽のように軽いブーツ。移動速度が上がる。',
      bonus: { spd: 10, hp: 50, atk: 20 },   // v24：HP +50%・ATK +20% を追加（軍用ブーツ・ハイブーツより弱くならないように）
      passive: { name: '再生', desc: '毎秒HPを1%回復する', heal: 0.01 },
    },
    frostBoots: {
      slot: 'boots', name: 'フロストブーツ',
      desc: '冷気をまとうブーツ。自分は遅くなるが、周囲の敵も凍えて遅くなる。',
      bonus: { spd: -15 },
      aura: { radius: 160, enemySpd: -5 },
      passive: { name: '絶対零度', desc: '10秒に1度、一番近い敵を完全に凍らせて動けなくする（中ボス・ボス以外）', cd: 10, dur: 5 },
    },
    destroyerFoot: {
      slot: 'boots', name: '破壊者フットアーマー', s: true,
      desc: '重い鉄のすね当て。攻撃に力が乗る。',
      bonus: { atk: 30, hp: -30 },
      passive: { name: '弔い合戦', desc: 'ダウンしている味方が多いほどダメージが高くなる（最大4倍）', max: 4 },
    },
    cloneLeg: {
      slot: 'boots', name: 'クローン義足',
      desc: '機械でできた義足。少し重いが、力が入る。',
      bonus: { spd: -10, atk: 10 },
      passive: { name: '自己修復', desc: '移動している間、3秒ごとにHPを1%回復する', every: 3, heal: 0.01 },
    },
    highBoots: {
      slot: 'boots', name: 'ハイブーツ',
      desc: 'ひざまである長いブーツ。少し重いが、攻撃に力が乗る。',
      bonus: { spd: -10, atk: 15 },
      passive: { name: '見切り', desc: '敵の攻撃を10%の確率で無効にする', chance: 0.1 },
    },
    militaryBoots: {
      slot: 'boots', name: '軍用ブーツ',
      desc: '頑丈な軍用ブーツ。体力は上がるが重い。',
      bonus: { hp: 50, spd: -20 },
      passive: { name: '鍛錬', desc: '経験値の獲得量 +10%', xp: 10 },
    },
  },

  // ---- ミシック装備（武器一覧で見られるだけ。説明は「現在不明」） ----
  MYTHIC_ITEMS: {
    hybridLance: { slot: 'weapon', name: 'ハイブリットランス', desc: '現在不明', mark: 'SS' },
  },

  // ---- 合成 ----
  // 同じ装備（種類・レアリティ・合成段階が同じ）を3つで1段階上に。❸が最大。
  // mult: 合成段階ごとの ATK/HP 倍率（合成していない状態から見て）
  // ❸を3つ集めると次のレアリティ（素）にグレードアップ。レジェンド❸を5つでレジェンド+。
  FUSION: { need: 3, max: 3, mult: [1, 1.3, 1.6, 2], marks: ['', '❶', '❷', '❸'], gradeNeed: 3, plusNeed: 5 },

  // ---- 装備のレベルアップ（設計図とコイン） ----
  // Lv n → n+1 に 設計図 bp(n) 枚（その装備の種類の設計図）と コイン coins(n) が必要
  // レベルが1上がるごとに、その装備の ATK・HP が「素の値 × perLevel」ずつ上がる
  // リセットするといつでも使った設計図とコインが全部返ってくる
  LEVELS: {
    max: { common: 10, uncommon: 20, rare: 30, epic: 40, legend: 50, legendPlus: 60, mythic: 70 },
    perLevel: 0.04,
    bp: (lv) => lv,
    coins: (lv) => 150 * lv,
  },
  BLUEPRINTS: { weapon: '武器の設計図', armor: '防具の設計図', belt: 'ベルトの設計図', boots: '靴の設計図' },

  // ---- ステージクリア報酬（クリアするたびにもらえる） ----
  // コイン = 倒した敵の数 × killCoin、ランダム設計図（武器・防具・ベルト・靴のどれかになる）、ランダム装備
  // 先のステージほど、たくさん・いいレアリティの装備が出る（%）
  // essence：キャラのレベルアップに使うエッセンス（±essenceRand の幅でばらつく）
  // v27：報酬を増やした（コイン：撃破数×1 → ×2 に、クリアボーナス coins を追加 / 設計図・エッセンス 2倍 / 装備 +1個）
  STAGE_DROPS: {
    killCoin: 2,
    essenceRand: 0.2,
    table: [
      { upTo: 10, coins: 2000,  bp: 20, essence: 600,  items: 2, rates: { common: 80, uncommon: 20 } },
      { upTo: 20, coins: 3000,  bp: 30, essence: 1000, items: 2, rates: { common: 55, uncommon: 35, rare: 10 } },
      { upTo: 30, coins: 5000,  bp: 40, essence: 2000, items: 3, rates: { common: 35, uncommon: 40, rare: 22, epic: 3 } },
      { upTo: 40, coins: 7000,  bp: 50, essence: 3000, items: 3, rates: { uncommon: 45, rare: 45, epic: 10 } },
      { upTo: 50, coins: 10000, bp: 60, essence: 4000, items: 4, rates: { uncommon: 30, rare: 52, epic: 18 } },
    ],
  },

  // ---- キャラのレベル（コインとエッセンスで上げる） ----
  // Lv n → n+1 に コイン coins(n) と エッセンス essence(n)。1レベルごとに ATK・HP の倍率が +perLevel
  CHAR_LEVEL: { max: 99, perLevel: 0.02, coins: (n) => 1000 * n, essence: (n) => 300 * n },
  // 被ったキャラの分解でもらえるエッセンス（1体あたり。その種類のキャラは1体残る）
  DISMANTLE: { common: 30, uncommon: 100, rare: 300, epic: 1000, legend: 3000, legendPlus: 10000 },

  // ---- ショップ（コインで買える。hours 時間ごとに品物が変わる） ----
  // rates：その枠に何が並ぶか（%）。s = S装備（エピック）、bp = ランダム設計図、essence = エッセンス。装備の種類はランダム
  SHOP: {
    hours: 12, slots: 6, refreshCost: 1000, refreshPerDay: 3,
    rates: { common: 29.9, uncommon: 20, rare: 15, epic: 5, s: 0.1, bp: 20, essence: 10 },
    prices: { common: 500, uncommon: 1000, rare: 2000, epic: 10000, s: 15000, bp: 500, essence: 1000 },
    bpAmount: 10, essenceAmount: 300,
  },

  // ---- ガチャの天井（この回数のうちに必ず1回出る） ----
  // 出た時点で数え直し（例：10回目でエピックが出たら、次のエピック確定はまた20回後）
  //   itemEpic  : 装備ガチャのエピック（S装備もエピックなので、S装備が出ても数え直し）
  //   itemS     : 装備ガチャのS装備
  //   charEpic  : キャラガチャのエピック以上
  //   charLegend: キャラガチャのレジェンド以上（エピックの数も一緒に数え直し）
  // ※ 装備ガチャはステージ1をクリアするまで（エピックが出ない間）は数えません
  GACHA_PITY: { itemEpic: 20, itemS: 50, charEpic: 40, charLegend: 222 },

  // ---- 確定ガチャ（装備ガチャの下。限定チケット1枚で1回引ける） ----
  //   epic1：エピック装備が必ず出る。sRate の確率で S装備（エピック）になる（S装備の確定はなし）
  //   s1   ：S装備（エピック）が必ず出る
  //   チケットはミッションの報酬でもらえる（ACHIEVEMENTS の ticket: 'epic1' / 's1'）。天井の回数には入らない
  SPECIAL_GACHA: {
    epic1: { name: 'エピック確定ガチャ', ticket: 'エピック確定チケット', desc: 'エピック装備が必ず1つ出る（10%の確率でS装備）', sRate: 0.1 },
    s1: { name: 'S装備確定ガチャ', ticket: 'S装備確定チケット', desc: 'S装備（エピック）が必ず1つ出る' },
  },

  // ---- キャラクター ----
  // キャラガチャで手に入り、装備画面で設定。レアリティが高いほど ATK と HP の倍率が高い。
  CHAR_MULT: { common: 1.2, uncommon: 1.5, rare: 1.8, epic: 2.2, legend: 3.0, legendPlus: 5.0 },
  // キャラガチャはステージ2クリアで解放（CHAR_TICKET_STAGE と同じステージ）
  // 見た目はキャラを持っていなくても、ステージをクリアしていなくても、いつでも変更できる
  CHARACTERS: {
    smoke:   { rarity: 'common',   name: 'スモーク',   desc: '髭がよく似合うイケおじ。' },
    jasper:  { rarity: 'common',   name: 'ジャスパー', desc: 'オレンジ髪のスパイ。' },
    aiko:    { rarity: 'common',   name: 'アイコ',     desc: '黒ひげのおじさん。' },
    patty:   { rarity: 'common',   name: 'パティー',   desc: 'ぱさぱさの赤髪。' },
    johnson: { rarity: 'uncommon', name: 'ジョンソン', desc: '白髪のイケおじ。' },
    jay:     { rarity: 'uncommon', name: 'ジェイ',     desc: '青い髪の怖いお姉さん。' },
    seed:    { rarity: 'uncommon', name: 'シード',     desc: '14歳くらいの金髪の男の子。' },
    charlotte: { rarity: 'uncommon', name: 'シャーロット', desc: '海外のお嬢様。' },
    widow:   { rarity: 'rare',     name: 'ウィドウ',   desc: '黒い服を着た怖い女性。',
               skill: { name: 'ブラックヴェール', cd: 30, dur: 10, enemySpd: -10, desc: '10秒間、すべての敵の移動速度 -10' } },
    kitties: { rarity: 'rare',     name: 'キティース', desc: '服を着た二足歩行の猫。',
               skill: { name: 'ヒールドローン', passive: true, radius: 400, rate: 1, heal: 0.01, desc: '回復ドローンがいつも飛んでいて、近くの味方か自分の中で一番HPが少ない人を毎秒1%回復（常に発動）' } },
    duck:    { rarity: 'rare',     name: 'ダック',     desc: '二足歩行の黄色いアヒル。',
               skill: { name: 'ダッシュ', cd: 30, dur: 5, spd: 100, desc: '5秒間、自分の移動速度 +100%' } },
    large:   { rarity: 'epic',     name: 'ラージ',     desc: '二足歩行のロボット。',
               skill: { name: 'アイアンボディ', cd: 30, dur: 3, desc: '3秒間、自分が無敵になる' } },
    freya:   { rarity: 'epic',     name: 'フレイヤ',   desc: '茶髪の弓使い。',
               skill: { name: 'アローレイン', cd: 60, radius: 400, dmg: 3, desc: '自分から一定範囲内の敵全員に矢を放つ' } },
    sword:   { rarity: 'legend',   name: 'ソード',     desc: '金髪の女性剣士。', s: true,
               skill: { name: '剣聖', passive: true, saberRange: 1.5, desc: 'ライトセイバー使用中、攻撃範囲が1.5倍（常に発動）' } },
    gunman:  { rarity: 'legend',   name: 'ガンマン',   desc: '西部のガンマン。', s: true,
               skill: { name: 'ファストドロー', cd: 30, dur: 8, rate: 2, desc: '8秒間、武器の攻撃速度が2倍' } },
    // レジェンド+（ATK・HP ×5）
    akagi:   { rarity: 'legendPlus', name: 'アカギ', desc: '白髪で黒と赤のスーツを着たイケおじ。', s: true,
               // w・h：落とす長方形の大きさ（横はプレイヤー10体分）/ delay：落ちてくるまでの秒数
               skill: { name: 'ギャンブルダイス', cd: 30, w: 440, h: 300, delay: 0.9,
                 dice: [35, 25, 20, 15, 4.5, 0.5],   // 1〜6の目が出る確率（%）
                 desc: 'サイコロを振り、出た目 × ATK のダメージを与える長方形を、自分を中心に上から落とす（範囲はプレイヤー10体分）' } },
  },

  // ---- 引き継ぎ（Firebase） ----
  // README の手順で Firebase を作り、apiKey と databaseURL を貼り付けると
  // 「プレイヤーID + 4桁パスワード」でデータを別の端末に引き継げるようになります。
  CLOUD: {
    // ↓ Firebase の apiKey を '' の間に貼り付ける（例: 'AIzaSyB...'）
    apiKey: 'AIzaSyDNDeSkWsKiPrQmf3m78kkZnd7s_vAqaCk',
    // ↓ Realtime Database の URL を '' の間に貼り付ける（例: 'https://xxxx-default-rtdb.asia-southeast1.firebasedatabase.app'）
    databaseURL: 'https://dadasabaiba-d19b3-default-rtdb.asia-southeast1.firebasedatabase.app',
    emailDomain: 'player.survivors-arena.game',   // 内部用（メールは送られません）
    autoSaveSec: 15,
  },

  // 最初から持っている装備（武器は外せないので必ず1つ）
  STARTER_ITEMS: [{ item: 'kunai', rarity: 'common', equip: true }],

  // ---- ステージ（5つのエリア × 10ステージ = 50ステージ） ----
  // 前のステージをクリアすると次のステージが遊べるようになります。
  BIOMES: [
    { key: 'meadow',  name: '草原', accent: '#5fd35a', desc: 'ゾンビと狼がうろつく、のどかな草原。',
      names: ['はじまりの草原', '風の丘', '花畑の小道', 'きのこの森', '小川のほとり', '古い風車', '蜂蜜の森', '霧の湿原', '竜の牧場', '森の聖域'] },
    { key: 'desert',  name: '砂漠', accent: '#ffb547', desc: '炎狼やサソリがひそむ灼熱の砂漠。',
      names: ['灼熱の砂漠', '砂嵐の谷', 'サソリの巣', 'ピラミッドの入口', 'サボテン街道', 'スフィンクスの門', '怪鳥の岩山', '幻のオアシス', '砂に埋もれた神殿', '冥府の門'] },
    { key: 'snow',    name: '氷',   accent: '#7cd3ff', desc: '氷狼の大群が吹雪の中から襲ってくる雪原。',
      names: ['凍てつく雪原', '吹雪の峠', '氷の湖', 'ふくろうの森', '氷結の海岸', '氷の洞窟', '白銀の城門', 'ペンギン王国', '吹雪の目', '氷竜の巣'] },
    { key: 'volcano', name: '火山', accent: '#ff6a3d', desc: '溶岩が流れる灼熱地帯。敵の攻撃が激しい。',
      names: ['怒れる火山', '溶岩の川', 'マグマの洞窟', '地獄の門', '火とかげの谷', '不死鳥の巣', '灼熱の海岸', '噴火口', '炎の城', '火竜の玉座'] },
    { key: 'ruins',   name: '廃墟', accent: '#b07cff', desc: '月明かりの下、亡霊たちがさまよう廃墟。',
      names: ['月夜の廃墟都市', '亡霊の路地', '騎士の墓所', '古代の遺跡', '蜘蛛の塔', '吸血鬼の館', '影の神殿', '骨竜の墓場', '機械仕掛けの城', '冥王の玉座'] },
  ],
  STAGES: [],   // ↑ から自動で作られます（このファイルの一番下）

  // ---- 運営からのプレゼント（ロビー左上のプレゼントボックス） ----
  // after: このステージ数をクリアすると受け取れる（1 = ステージ1をクリアしたら）
  // id はプレゼントごとに別の名前にしてください（受け取ったかどうかの記録に使います）
  PRESENTS: [
    { id: 'thanks-1', title: 'ゲームプレイありがとうございます', text: 'ステージ1クリアおめでとうございます！運営からのささやかなプレゼントです。これからも楽しんでください。', coins: 30000, after: 1 },
  ],

  // ---- ミッション（ステージ unlockStage+1 をクリアすると解放） ----
  // 1回だけのミッションと、step ごとに何度でももらえるミッション
  // check：何を見て達成にするか（state.js の achievementProgress）
  MISSION_UNLOCK: 0,
  ACHIEVEMENTS: [
    { id: 'code', name: '引き継ぎコードを発行する', check: 'code', reward: { coins: 30000 } },
    { id: 'firstLevel', name: '初めて装備のレベルを上げる', check: 'levelUps', n: 1, reward: { ticket: 'item10' } },
    { id: 'level10', name: '装備のレベルを10上げる', check: 'levelUps', step: 10, reward: { bp: 10 } },
    { id: 'firstFuse', name: '初めて装備を合成する', check: 'fuses', n: 1, reward: { ticket: 'item10' } },
    { id: 'fuse10', name: '装備を10回合成する', check: 'fuses', step: 10, reward: { bp: 10 } },
    { id: 'fullGear', name: '初めて全身装備をつける（武器・防具・ベルト・靴）', check: 'fullGear', reward: { ticket: 'item10' } },
    { id: 'firstEpic', name: '初めてエピック装備を手に入れる', check: 'gotEpic', reward: { tool: 'sEpicBox' } },
    { id: 'firstLegend', name: '初めてレジェンド装備を手に入れる', check: 'gotLegend', reward: { tool: 'sEpicBox', toolN: 3 } },
    { id: 'firstChar', name: '初めてキャラを手に入れる', check: 'charsGot', n: 1, reward: { ticket: 'char10' } },
    { id: 'char10', name: 'キャラを10体手に入れる', check: 'charsGot', step: 10, reward: { coins: 300 } },
    { id: 'firstLegendChar', name: '初めてレジェンドキャラを手に入れる', check: 'gotLegendChar', reward: { coins: 30000 } },
    { id: 'firstLegendPlusChar', name: '初めてレジェンド+キャラを手に入れる', check: 'gotLegendPlusChar', reward: { coins: 30000, bp: 300 } },
    // v11：ステージ・アカウントレベル・ガチャ・ミニゲームなど
    //   check: stage（クリアしたステージの番号）/ accountLv / pulls（ガチャの合計）/ mgPlay・mgWin（ミニゲーム）
    //          charLevelUps（キャラのレベルアップ回数）/ shopBuys（ショップで買った回数）
    { id: 'stage5', name: 'ステージ5をクリアする', check: 'stage', n: 5, reward: { coins: 5000, bp: 10 } },
    { id: 'stage10', name: 'ステージ10をクリアする', check: 'stage', n: 10, reward: { tool: 'epicBox' } },
    { id: 'stage20', name: 'ステージ20をクリアする', check: 'stage', n: 20, reward: { coins: 30000, essence: 1000 } },
    { id: 'stage30', name: 'ステージ30をクリアする', check: 'stage', n: 30, reward: { tool: 'epicBox', toolN: 2 } },
    { id: 'stage40', name: 'ステージ40をクリアする（むずかしい）', check: 'stage', n: 40, reward: { tool: 'sEpicBox' } },
    { id: 'stage50', name: 'ステージ50（最後のステージ）をクリアする', check: 'stage', n: 50, reward: { coins: 100000, essence: 5000 } },
    { id: 'lv10', name: 'アカウントレベル10になる', check: 'accountLv', n: 10, reward: { coins: 10000 } },
    { id: 'lv20', name: 'アカウントレベル20になる', check: 'accountLv', n: 20, reward: { tool: 'epicBox' } },
    { id: 'lv30', name: 'アカウントレベル30になる', check: 'accountLv', n: 30, reward: { coins: 50000, essence: 3000 } },
    { id: 'pull50', name: 'ガチャを合計50回引く', check: 'pulls', n: 50, reward: { ticket: 'item10' } },
    { id: 'pull200', name: 'ガチャを合計200回引く', check: 'pulls', n: 200, reward: { tool: 'epicBox' } },
    { id: 'charLv10', name: 'キャラのレベルを10回上げる', check: 'charLevelUps', step: 10, reward: { essence: 1000 } },
    { id: 'shop10', name: 'ショップで10回買い物をする', check: 'shopBuys', step: 10, reward: { bp: 20 } },
    { id: 'mgFirst', name: 'ミニゲームを初めて遊ぶ', check: 'mgPlay', n: 1, reward: { coins: 3000 } },
    { id: 'mgPlay10', name: 'ミニゲームを10回遊ぶ', check: 'mgPlay', step: 10, reward: { bp: 10 } },
    { id: 'mgWin1', name: 'ミニゲームで初めて勝つ', check: 'mgWin', n: 1, reward: { ticket: 'item10' } },
    { id: 'mgWin10', name: 'ミニゲームで10回勝つ', check: 'mgWin', n: 10, reward: { tool: 'epicBox' } },
    { id: 'mgWin30', name: 'ミニゲームで30回勝つ', check: 'mgWin', n: 30, reward: { coins: 50000, ticket: 'char10' } },
    // 確定ガチャのチケット（epic1：エピック確定チケット / s1：S装備確定チケット）
    //   エピック確定：全部で10枚（かんたん3枚 ＋ かんたんではない7枚）
    //   S装備確定  ：全部で3枚（エピック確定のミッションより むずかしい）。ほかに7日間限定ミッションの「3つクリア」でも1枚
    { id: 'stage3', name: 'ステージ3をクリアする', check: 'stage', n: 3, reward: { ticket: 'epic1' } },            // かんたん
    { id: 'lvUp5', name: '装備のレベルを合計5回上げる', check: 'levelUps', n: 5, reward: { ticket: 'epic1' } },     // かんたん
    { id: 'pull30', name: 'ガチャを合計30回引く', check: 'pulls', n: 30, reward: { ticket: 'epic1' } },             // かんたん
    { id: 'stage15', name: 'ステージ15をクリアする', check: 'stage', n: 15, reward: { ticket: 'epic1' } },
    { id: 'stage25', name: 'ステージ25をクリアする', check: 'stage', n: 25, reward: { ticket: 'epic1', ticketN: 2 } },
    { id: 'lv25', name: 'アカウントレベル25になる', check: 'accountLv', n: 25, reward: { ticket: 'epic1' } },
    { id: 'mgWin20', name: 'ミニゲームで20回勝つ', check: 'mgWin', n: 20, reward: { ticket: 'epic1' } },
    { id: 'pull500', name: 'ガチャを合計500回引く', check: 'pulls', n: 500, reward: { ticket: 'epic1', ticketN: 2 } },
    { id: 'stage35', name: 'ステージ35をクリアする（むずかしい）', check: 'stage', n: 35, reward: { ticket: 's1' } },
    { id: 'lv40', name: 'アカウントレベル40になる（むずかしい）', check: 'accountLv', n: 40, reward: { ticket: 's1' } },
    { id: 'pull1000', name: 'ガチャを合計1000回引く（むずかしい）', check: 'pulls', n: 1000, reward: { ticket: 's1' } },
  ],

  // ---- デイリーミッション（毎日0時にリセット） ----
  // 1つクリアするごとにデイリーポイント point。ポイントがたまるとごほうび
  DAILY: {
    missions: [
      { id: 'login', name: 'ログインする', type: 'login', n: 1, point: 20, reward: { coins: 1000 } },
      { id: 'kills', name: '敵を100体倒す', type: 'kills', n: 100, point: 20, reward: { coins: 300 } },
      { id: 'pull', name: 'ガチャを引く', type: 'pulls', n: 1, point: 20, reward: { bp: 10 } },
      { id: 'level', name: '装備のレベルを上げる', type: 'levelUps', n: 1, point: 20, reward: { bp: 10 } },
      { id: 'clear', name: 'ステージをクリアする', type: 'clears', n: 1, point: 20, reward: { bp: 10 } },
    ],
    milestones: [
      { n: 20, reward: { coins: 500 } },
      { n: 40, reward: { bp: 10 } },
      { n: 60, reward: { essence: 300 } },
      { n: 80, reward: { bp: 20 } },
      { n: 100, reward: { coins: 3000 } },
    ],
  },

  // ---- フレンド（Firebase を設定したときだけ使える） ----
  // onlineSec：この秒数以内に開いていた人を「オンライン」と表示 / inviteMin：招待の有効時間（分）
  FRIENDS: { max: 50, onlineSec: 150, inviteMin: 10, pollSec: 8, heartbeatSec: 60 },

  // ---- ランキングの総合力 ----
  // 総合力 = ATK × atkWeight ＋ HP。HP はおおよそ ATK の6倍なので、6倍すると ATK と HP が同じ重さになる
  RANKING: { atkWeight: 6 },

  // ---- 7日間限定ミッション（引き継ぎコードを発行した日からスタート） ----
  // 1日目・2日目…はその日にログインすると解放。7日23時間59分59秒で消える
  // type: login（ログイン日数）/ stage（ステージ n をクリア）/ kills（敵を倒した合計）/ pulls（ガチャを引いた合計）
  //       charPulls（キャラガチャを引いた合計）/ fuse（合成した回数）/ levelUp（装備をレベルアップした回数）/ clears（ステージクリアの合計）
  // reward: coins（コイン）/ bp（ランダム設計図）/ ticket（item10・char10）/ tool（どうぐ）
  LIMITED: {
    durationMs: (8 * 24 * 3600 - 1) * 1000,
    // v23：ステージクリアのミッションは「1日目にステージ1 → 7日目にステージ7」（v22でステージ3から手ごわくしたので、1日1ステージずつ）
    days: [
      [{ type: 'login', n: 1, reward: { coins: 300 } }, { type: 'stage', n: 1, reward: { bp: 10 } }, { type: 'kills', n: 3000, reward: { coins: 300 } }, { type: 'pulls', n: 20, reward: { bp: 10 } }],
      [{ type: 'login', n: 2, reward: { coins: 300 } }, { type: 'stage', n: 2, reward: { bp: 10 } }, { type: 'kills', n: 6000, reward: { coins: 300 } }, { type: 'pulls', n: 30, reward: { bp: 10 } }],
      [{ type: 'login', n: 3, reward: { coins: 300 } }, { type: 'stage', n: 3, reward: { bp: 10 } }, { type: 'kills', n: 9000, reward: { coins: 300 } }, { type: 'fuse', n: 3, reward: { bp: 10 } }],
      [{ type: 'login', n: 4, reward: { coins: 300 } }, { type: 'stage', n: 4, reward: { bp: 10 } }, { type: 'kills', n: 12000, reward: { coins: 300 } }, { type: 'levelUp', n: 5, reward: { bp: 10 } }],
      [{ type: 'login', n: 5, reward: { coins: 300 } }, { type: 'stage', n: 5, reward: { bp: 10 } }, { type: 'kills', n: 15000, reward: { coins: 300 } }, { type: 'charPulls', n: 10, reward: { bp: 10 } }],
      [{ type: 'login', n: 6, reward: { coins: 300 } }, { type: 'stage', n: 6, reward: { bp: 10 } }, { type: 'kills', n: 18000, reward: { coins: 300 } }, { type: 'pulls', n: 50, reward: { bp: 10 } }],
      [{ type: 'login', n: 7, reward: { coins: 300 } }, { type: 'stage', n: 7, reward: { bp: 10 } }, { type: 'kills', n: 21000, reward: { coins: 300 } }, { type: 'clears', n: 20, reward: { bp: 10 } }],
    ],
    // クリアしたミッションの数に応じたごほうび
    milestones: [
      { n: 3, reward: { ticket: 's1' } },          // v15：3つクリアで S装備確定チケット
      { n: 6, reward: { bp: 20 } },
      { n: 10, reward: { ticket: 'item10' } },
      { n: 15, reward: { bp: 40 } },
      { n: 20, reward: { tool: 'sEpicBox' } },
      { n: 25, reward: { ticket: 'char10' } },
      { n: 28, reward: { coins: 50000 } },
    ],
  },

  // ---- どうぐ（ロビー左上の「どうぐ」から使う） ----
  TOOLS: {
    epicBox: { name: 'エピック装備選択BOX', desc: 'エピック装備（武器・防具・ベルト・靴）の中から好きなものを1つ選んで手に入れる（S装備は選べません）', pick: 'epic' },
    sEpicBox: { name: 'エピックS装備選択BOX', desc: 'エピックのS装備の中から好きなものを1つ選んで手に入れる', pick: 'epic', s: true },
  },

  // ---- アカウントレベル ----
  // ステージをクリアするたびに経験値がもらえ、レベルが上がります（最大99）。
  // 先のステージほど多くもらえ、レベルが上がるほど次のレベルまでの経験値が増えます。
  // ステージ1〜50を1回ずつクリアすると、だいたいレベル40くらいになります。
  ACCOUNT: {
    maxLevel: 99,
    clearXp: (no) => 50 + 25 * no,                          // ステージ no をクリアしたときの経験値
    need: (lv) => Math.round(40 + 6 * Math.pow(lv, 1.6)),    // レベル lv → lv+1 に必要な経験値
  },

  // ロビー内のプレイヤー枠の色（P1〜P4）
  PLAYER_COLORS: ['#ff5a5f', '#3fa9ff', '#39d17a', '#ffc93c'],

  // ---- ミニゲーム（フレンドと2〜4人で対戦） ----
  // 武器・スキル・パッシブの「攻撃」はすべて使えません。
  // 移動速度と、攻撃ではない効果（effects に書いたもの）だけが有利に働きます。
  //   speed     : 装備の移動速度（ミニゲームでは 60〜150% の間におさえる）
  //   shield    : 鎧「ガードシールド」… 60秒に1度、1発だけ防ぐ
  //   miss      : ハイブーツ「見切り」… 10%の確率で当たらない
  //   guts      : エターナルベルト「不屈」… 60秒に1度、当たっても3秒間無敵
  //   revive    : エターナルバトルスーツ「不死の加護」… 1度だけ復活（3秒無敵）
  //   dash      : ダック「ダッシュ」… 5秒間 移動速度 +100%（30秒に1度）
  //   iron      : ラージ「アイアンボディ」… 3秒間 無敵（30秒に1度）
  //   veil      : ウィドウ「ブラックヴェール」… 10秒間 ゾンビが遅くなる（30秒に1度）
  MINIGAMES: {
    minPlayers: 2,
    list: [
      { key: 'dodge', name: '弾よけサバイバル', color: '#b06bff',
        desc: 'まわりの魔法使いゾンビが全方向から魔法の弾を撃ってくる。1発でも当たったら脱落！最後まで生き残った人の勝ち。',
        rules: ['円の中を逃げ回って、魔法の弾をよけよう', '1発当たったら脱落（観戦になる）', '時間がたつほど魔法使いゾンビが増える'],
        effects: ['speed', 'shield', 'miss', 'guts', 'revive', 'dash', 'iron'] },
      { key: 'draw', name: '地上絵バトル', color: '#ffb547', times: [60, 120, 180], time: 120,
        desc: '真っ暗な中、歩いたところが黒い線になる。お題の絵を一筆書きでうまく描こう！最後はみんなで投票。',
        rules: ['歩いた道がそのまま線になる（消せない・一筆書き）', '暗くて自分のまわりしか見えない', 'ミニマップにはスタート地点だけ表示', '描き終わったら自分以外の絵に1票'],
        effects: ['speed', 'dash'] },
      { key: 'peak', name: 'ゾンビピーク', color: '#5fd35a', times: [180, 300], time: 180,
        desc: '広いマップを歩き回るゾンビを捕まえて、自分の柵に連れて帰ろう。柵の中のゾンビがいちばん多い人の勝ち！',
        rules: ['ゾンビに重なると捕まえる（一度に3匹まで）', '自分の柵の真ん中に行くとゾンビが柵に入る', '他の人の柵からゾンビを取ることもできる', 'ゾンビは攻撃してこない'],
        effects: ['speed', 'dash', 'veil'] },
      { key: 'defender', name: 'ディフェンサーバトル', color: '#ff6a3d',
        desc: '自分のまわりを回るディフェンサー1枚で相手を倒そう。相手のディフェンサーに当たったら1発で脱落！',
        rules: ['自分のディフェンサーを相手に当てると倒せる', 'ディフェンサーはこわれない（ディフェンサーどうしはすり抜ける）', '時間がたつとゾンビの輪がせまってくる（さわると脱落）', '最後まで生き残った人の勝ち'],
        effects: ['speed', 'shield', 'miss', 'guts', 'revive', 'dash', 'iron'] },
    ],
    // 地上絵バトルのお題（ランダムに1つ）
    topics: ['ねこ', 'いぬ', 'さかな', 'うさぎ', 'ぞう', 'へび', 'かめ', 'とり', 'ぶた', 'くま',
      'いえ', 'くるま', 'じてんしゃ', 'ロケット', 'ふね', 'ひこうき', 'かさ', 'めがね', 'とけい', 'でんしゃ',
      'りんご', 'バナナ', 'ケーキ', 'アイスクリーム', 'おにぎり', 'ドーナツ',
      'ほし', 'ハート', 'たいよう', 'つき', 'はな', 'き', 'やま', 'くも', 'にじ', 'ゆきだるま',
      'かお', 'ゾンビ', 'おばけ', 'ロボット', 'かんむり', 'つるぎ', 'たからばこ', 'かぎ', 'ギター', 'サッカーボール'],
  },
};

// ステージの一覧を作る（BIOMES の名前を順番に並べる）
DS.config.STAGES = DS.config.BIOMES.flatMap((b, bi) => b.names.map((name, i) => ({
  key: 's' + (bi * 10 + i + 1), no: bi * 10 + i + 1, biome: b.key, area: b.name, name,
  diff: Math.min(5, bi + 1), desc: b.desc, accent: b.accent,
})));

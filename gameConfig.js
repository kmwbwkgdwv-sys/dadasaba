/* =========================================================
 *  gameConfig.js  ― バトルの設定値（敵・ボス・スキル・経験値）
 *  距離の単位は「ゲーム内ピクセル」。プレイヤーの半径が 20（直径40＝プレイヤー1人分）。
 *  時間の単位は秒。ダメージ倍率は「自分のATK × 倍率」。
 *
 *  ★ 敵の体力・攻撃力は「ステージ1の値」で書いてあります。
 *    実際の値 = 表の値 × そのステージの倍率（STAGE_TARGET から自動計算）
 * ========================================================= */
window.DS = window.DS || {};
// スキルの説明で使う（説明を出すときに読む）
const GC_SP = () => DS.gameConfig.SKILL_PARAMS;
const GC_EV = () => DS.gameConfig.EVOLVE;
// 火炎瓶を一度に投げる数（★2・★4・赤★1 で1本ずつ増える）
const molotovN = (s) => GC_SP().molotov.bottles + GC_SP().molotov.moreAt.filter((n) => s >= n).length;
// v17：ロケットの数（★3・★5 で1発ずつ増える。赤★1 は EVOLVE の数）
const rocketN = (s) => (s >= 6 ? GC_EV().rocket.count : GC_SP().rocket.count + GC_SP().rocket.moreAt.filter((n) => s >= n).length);
// v17：楽器のバフ（★ごと）。atk：攻撃+% / cut：受けるダメージ-% / regen：毎秒HP回復% / spd：攻撃速度+%
// v20：ライトセイバーの届く長さ（人分）
const saberR = (s) => Math.round(GC_SP().lightsaber.r * (1 + GC_SP().lightsaber.rStep * (Math.min(6, s) - 1)) * (s >= 6 ? GC_EV().lightsaber.range : 1) / 20 * 10) / 10;
// v19：エネルギーブレードの範囲（人分）
const bladeR = (s) => Math.round((GC_SP().energyBlade.r + GC_SP().energyBlade.rStep * (Math.min(6, s) - 1)) * (s >= 6 ? GC_EV().energyBlade.r : 1) / 20 * 10) / 10;
const musicR = (s) => Math.round((GC_SP().music.r + GC_SP().music.rStep * (Math.min(6, s) - 1)) * (s >= 6 ? GC_EV().music.r : 1) / 20 * 10) / 10;   // 広場の広さ（人分）
const musicBuffText = (s) => { const b = GC_SP().music.buffs[Math.min(6, s)] || {}; return [`攻撃+${b.atk}%`, b.cut ? `受けるダメージ-${b.cut}%` : '', b.regen ? `毎秒HP${b.regen}%回復` : '', b.spd ? `攻撃速度+${b.spd}%` : ''].filter(Boolean).join('・'); };

DS.gameConfig = {
  // ---- 試合の流れ ----
  MATCH_SECONDS: 480,          // 試合の流れの長さ（「試合の時計」で8分）。中ボス・ラッシュ・大群などの時間はこの8分の時計で書いてある
  // 実際の試合の長さ（秒）。v27で5分にしたが、v32で8分に戻した（MATCH_SECONDS と同じなら縮めない）
  //      MATCH_XP：経験値の倍率（試合を短くしたときに、スキルがそろうように上げる）
  MATCH_REAL: 480,
  MATCH_XP: 1,
  // v15：8分になったら warp 秒後にボス戦の場所へワープ（横一列）→ wait 秒後にボスが出現
  //      ワープした場所の少し前（healAhead）に、HP を healRatio 回復するアイテムを人数分置く（だれでも取れる）
  BOSS_INTRO: { warp: 5, wait: 10, healAhead: 110, healRatio: 0.3, gap: 90, summonR: 150 },
  MIDBOSS_TIMES: [180, 360],   // 3分と6分に中ボス
  // v22：圧倒モード。パーティー全員の戦闘力（ATK×6＋HP）がステージの目安の ratio 倍以上なら、
  //      試合の流れ（中ボス・ラッシュ・大群）を seconds 秒（3分）に縮めて、そのあとボス戦
  //      xp：経験値の倍率（短い時間でもスキルがそろうように）
  OVERWHELM: { ratio: 2, seconds: 180, xp: 1.6 },
  ALTAR: { radius: 230, countdown: 5 },   // ボス戦の場所の大きさ

  // ---- マップ（とても広い） ----
  WORLD: { w: 9000, h: 9000 },
  VIEW_LONG_SIDE: 900,         // 画面の長い辺に映る距離

  // ---- プレイヤー ----
  PLAYER: {
    radius: 20,
    baseSpeed: 210,            // 装備の「速度100」のときの移動速度
    reviveRadius: 70,          // この範囲に仲間が留まると復活
    reviveSeconds: 3,
    reviveHpRatio: 0.5,
  },

  // ---- ステージごとの目安の強さ（装備画面の ATK・HP） ----
  // 敵の体力はATKの目安に、敵の攻撃力はHPの目安に合わせて大きくなります（目安ちょうどの強さで、自動プレイのクリア率がおよそ8割）。
  // ステージ1は最初の無料10連で「ぎりぎり」クリアできるくらい。
  // v22：ステージ3から大きく変更（友達と遊んでいて、ステージ3の時点で ATK 1万を超えた）。
  // v26：ステージ1・2は最初の装備でも遊べるように前のまま。ステージ3は ATK 5,000、そこから1ステージごとに約2,000ずつ上がって、ステージ50で 10万（HP は ATK の約6.2倍）
  STAGE_TARGET: {
    atk: [330, 609, 5000, 7000, 9000, 11100, 13100, 15100, 17100, 19100,
      21200, 23200, 25200, 27200, 29300, 31300, 33300, 35300, 37300, 39400,
      41400, 43400, 45400, 47400, 49500, 51500, 53500, 55500, 57600, 59600,
      61600, 63600, 65600, 67700, 69700, 71700, 73700, 75700, 77800, 79800,
      81800, 83800, 85900, 87900, 89900, 91900, 93900, 96000, 98000, 100000],
    hp: [2560, 3840, 31000, 43400, 55800, 68800, 81200, 93600, 106000, 118000,
      131000, 144000, 156000, 169000, 182000, 194000, 206000, 219000, 231000, 244000,
      257000, 269000, 281000, 294000, 307000, 319000, 332000, 344000, 357000, 370000,
      382000, 394000, 407000, 420000, 432000, 445000, 457000, 469000, 482000, 495000,
      507000, 520000, 533000, 545000, 557000, 570000, 582000, 595000, 608000, 620000],
  },
  // 下の ENEMIES・BOSSES の体力・攻撃力は「ATK 950・HP 1800 のプレイヤー」に合わせて書いてあります。
  // 実際の値は「目安の強さ ÷ この値」の倍率をかけて使います。
  UNIT: { atk: 950, hp: 1800 },
  // 目安の装備でも、先のステージほど少しずつ手ごわくなる（ステージ1 → ステージ50）
  // v20：スキルが増えて回復（エナジードリンク）が弱くなったので、敵の攻撃力を少し下げた（atk [1, 1.2] → [0.85, 1.05]）
  STAGE_DANGER: { hp: [1, 1.1], atk: [0.85, 1.05] },
  // エリアごとの調整：先のエリアは敵の種類が多くて手ごわいので、そのぶん体力・攻撃力を少し下げる
  // （自動プレイで、目安の装備のときにクリアできる確率がそろうように合わせた値）
  BIOME_SCALE: { meadow: 1, desert: 0.85, snow: 0.72, volcano: 0.7, ruins: 0.66 },
  // 試合時間による雑魚の体力の倍率（[分, 倍率] を直線でつなぐ）
  // 終盤はスキルが育つので、雑魚は弱くして「ほとんどワンパン」の爽快感を出す
  ENEMY_HP_CURVE: [[0, 1], [3, 0.95], [5, 0.78], [7, 0.6], [8, 0.58]],   // v32：8分に戻したので v27 の調整も元に戻した

  // ---- 敵の数：終盤になるほど大量に湧く ----
  // 画面にいる敵の目標数 = base + perMin × 分 + perMin2 × 分 × 分（× 人数補正）
  MAX_ENEMIES: 400,
  SPAWN: { base: 8, perMin: 9, perMin2: 2.6, interval: 0.3, packFullAt: 240 },
  // ---- 終盤の大群：雑魚がワンパンで倒せるころ（from 分）から増え始め、full 分で画面を覆いつくす数（count）になる ----
  // 目安の ATK・HP ならワンパンでどんどん倒せるが、足りないと倒しきれずに囲まれて負ける
  FLOOD: { from: 5, full: 6.5, count: 380, interval: 0.1, speed: 1.15 },   // speed：大群の雑魚は少し速い

  // ---- 難易度：1人討伐は1倍、パーティー討伐は3倍 ----
  // 雑魚敵（狼・コウモリ以外）と中ボスの体力にかかります。
  DIFFICULTY: { solo: 1, party: 3 },
  // ボスは「1人で約30秒、パーティーで約50秒」で倒せるように、パーティーでは
  // 体力 = 1人のときの体力 × timeRatio × (1 + perExtra × 増えた人数)（2人で3倍、4人で6倍）
  BOSS_PARTY: { timeRatio: 1.5, perExtra: 1 },

  // ---- 人数による調整（左から 0人, 1人, 2人, 3人, 4人 のときの倍率） ----
  PARTY: { spawn: [1, 1, 0.9, 1.3, 1.75], xpNeed: [1, 1, 1.0, 1.4, 1.9] },

  // 中ボスの体力倍率（下の表の体力 × この値 × ステージ倍率 × 難易度）
  MIDBOSS_HP_SCALE: 3,

  // ---- ラッシュ：中ボスが出る30秒前から、敵の群れが一気に突撃してくる ----
  RUSH: { before: 30, duration: 18, every: 0.9, pack: [8, 13], speedMul: 1.2,   // v20：群れを少し小さく・遅く（[10,16]・1.25倍 → [8,13]・1.2倍）
    dist: 720, max: 320 },

  // ---- ダンボール：壊すと 1/8 で回復アイテム（最大HPの30%回復） ----
  // ダンボール：initial 最初の数 / perMinute 1分ごとに増える数 / dropRate 回復アイテムが出る確率
  //   bomb：壊すと bomb.rate の確率で爆弾が出て、近くの敵に飛んでいって爆発（ATK×dmg、半径 r）
  // v20：回復アイテムが少し出やすい（1/8 → 1/6）
  BOXES: { initial: 14, perMinute: 4, dropRate: 1 / 6, healRatio: 0.3, r: 22, max: 72,
    bomb: { rate: 0.1, dmg: 6, r: 130, speed: 520, range: 700 } },
  // 中ボスを倒すと出る宝箱：開けると全員のスキルかアビリティ（どれか1つ）の★が1つ上がる
  // 中ボスの宝箱：拾うと時間が止まり、roulette 秒のルーレットで、持っているスキル・アビリティのどれかの★が1つ上がる
  //（パーティーなら1つの宝箱で全員がそれぞれルーレット）
  // v30：multi … [何個, 確率]。20%で2つ・10%で3つのスキル・アビリティの★が上がる（1人ずつ抽選）。1つ増えるごとにルーレットが extraSec 秒長くなる
  CHEST: { r: 30, roulette: 5, multi: [[3, 0.1], [2, 0.2]], extraSec: 1.8 },
  // v31：スキル・アビリティが全部上がりきったあとのレベルアップで「HP30%回復」と一緒に選べるコイン（試合が終わるともらえる）
  MAXED_COINS: 1000,

  // ---- 経験値とレベル ----
  // v14：スキルとアビリティが4つずつ。終盤の大群で経験値が多く入るので、レベル25より上で必要な経験値が増え続けるようにした（cap 500 → 1000）
  XP: { base: 4, growth: 18, cap: 1000 },   // v20：レベルが少し上がりやすい（growth 21 → 18）

  // ---- 敵キャラ（ステージ1の値） ----
  // atk: 近接は「触れている間 1秒あたり」のダメージ、遠距離は弾1発のダメージ
  // 雑魚はステージに見合う装備で「2発くらい」（狼とコウモリは1発）で倒れる体力にしてあります
  ENEMIES: {
    wolf:          { name: '狼',           hp: 800, atk: 16, speed: 150, r: 16, xp: 1, melee: true, pack: [6, 10], noParty: true },
    fireWolf:      { name: '炎狼',         hp: 800, atk: 16, speed: 150, r: 16, xp: 1, melee: true, pack: [6, 10], noParty: true },
    iceWolf:       { name: '氷狼',         hp: 800, atk: 16, speed: 150, r: 16, xp: 1, melee: true, pack: [6, 10], noParty: true },
    hellHound:     { name: '地獄の猟犬',   hp: 850, atk: 18, speed: 165, r: 16, xp: 1, melee: true, pack: [6, 10], noParty: true },
    zombie:        { name: 'ゾンビ',       hp: 1700, atk: 47, speed: 55,  r: 18, xp: 2, melee: true, pack: [3, 6] },
    mageZombie:    { name: '魔法使いゾンビ', hp: 1100, atk: 47, speed: 70, r: 18, xp: 3, ranged: { cd: 3, range: 430, keep: 280, speed: 260, proj: 'magic', pr: 9 } },
    armorSkeleton: { name: '鎧スケルトン', hp: 2200, atk: 55, speed: 45,  r: 20, xp: 4, ranged: { cd: 3, range: 460, keep: 300, speed: 300, proj: 'bone', pr: 9 } },
    slime:         { name: 'スライム',     hp: 1800, atk: 40, speed: 60,  r: 20, xp: 2, melee: true, pack: [3, 5] },
    magmaSlime:    { name: 'マグマスライム', hp: 2000, atk: 50, speed: 62, r: 20, xp: 2, melee: true, pack: [3, 5] },
    scorpion:      { name: 'サソリ',       hp: 1100, atk: 55, speed: 120, r: 18, xp: 2, melee: true, pack: [2, 4] },
    mummy:         { name: 'ミイラ',       hp: 3000, atk: 60, speed: 40,  r: 20, xp: 3, melee: true, pack: [2, 3] },
    snowman:       { name: '雪だるま',     hp: 1800, atk: 55, speed: 40,  r: 20, xp: 3, ranged: { cd: 3.5, range: 440, keep: 300, speed: 240, proj: 'snowball', pr: 13 } },
    iceBat:        { name: '氷コウモリ',   hp: 600,  atk: 22, speed: 190, r: 14, xp: 1, melee: true, pack: [5, 8], noParty: true },
    fireWisp:      { name: '火の玉',       hp: 800,  atk: 0,  speed: 150, r: 15, xp: 2, pack: [2, 3], kamikaze: 140 },   // ぶつかると爆発（kamikaze のダメージ）して消える
    ghost:         { name: 'ゴースト',     hp: 1400, atk: 42, speed: 95,  r: 18, xp: 2, melee: true, pack: [2, 4], phase: true },  // 押し合わずにすり抜ける
    bat:           { name: 'コウモリ',     hp: 600,  atk: 22, speed: 190, r: 14, xp: 1, melee: true, pack: [5, 8], noParty: true },
    // ---- 中ボス（エリアごとに変わる） ----
    bigZombie:     { name: 'でかいゾンビ',   hp: 6300,  atk: 314, speed: 50, r: 46, xp: 60,  melee: true, midboss: true },
    bigMummy:      { name: 'ミイラ巨人',     hp: 8000,  atk: 360, speed: 46, r: 48, xp: 70,  melee: true, midboss: true },
    bigSnowman:    { name: 'ビッグスノーマン', hp: 9000, atk: 330, speed: 42, r: 50, xp: 80,  melee: true, midboss: true,
                     ranged: { cd: 2.6, range: 520, keep: 0, speed: 260, proj: 'snowball', pr: 22 } },
    eliteZombie:   { name: 'エリートゾンビ', hp: 12600, atk: 628, speed: 50, r: 50, xp: 120, melee: true, midboss: true },   // でかいゾンビの2倍の強さ
    dullahan:      { name: 'デュラハン',     hp: 13000, atk: 600, speed: 70, r: 48, xp: 130, melee: true, midboss: true, dash: { cd: 5, speed: 520, wind: 0.8, dur: 0.8 } },
  },

  // ---- エリアごとの出現キャラ ----
  // spawns: from=出現し始める秒数、w=出現の重み、at=エリアの何ステージ目から出るか（0〜9）
  // rush: ラッシュで突撃してくる敵（rushLate は6ステージ目から追加）
  BIOME_ENEMIES: {
    meadow: { midboss: 'bigZombie', mageProj: 'magic', rush: ['wolf'], rushLate: ['zombie'],
      spawns: [{ type: 'wolf', w: 4, from: 0 }, { type: 'zombie', w: 4, from: 0 }, { type: 'mageZombie', w: 1.5, from: 45 },
        { type: 'slime', w: 2, from: 60, at: 2 }, { type: 'armorSkeleton', w: 0.8, from: 150, at: 7 }] },
    desert: { midboss: 'bigMummy', mageProj: 'fireMagic', rush: ['fireWolf'], rushLate: ['scorpion'],
      spawns: [{ type: 'fireWolf', w: 4, from: 0 }, { type: 'zombie', w: 3, from: 0 }, { type: 'scorpion', w: 2.5, from: 30 },
        { type: 'mageZombie', w: 1.4, from: 40 }, { type: 'mummy', w: 1.5, from: 60, at: 3 }, { type: 'armorSkeleton', w: 1.0, from: 90 }] },
    snow: { midboss: 'bigSnowman', mageProj: 'iceMagic', rush: ['iceWolf', 'iceWolf', 'zombie'], rushLate: ['iceBat'],
      spawns: [{ type: 'iceWolf', w: 5, from: 0 }, { type: 'zombie', w: 3, from: 0 }, { type: 'snowman', w: 1.5, from: 40 },
        { type: 'mageZombie', w: 1.3, from: 30 }, { type: 'iceBat', w: 2, from: 60, at: 3 }, { type: 'armorSkeleton', w: 1.1, from: 60 }] },
    volcano: { midboss: 'eliteZombie', mageProj: 'fire', rush: ['hellHound', 'zombie', 'zombie'], rushLate: ['fireWisp'],
      spawns: [{ type: 'hellHound', w: 4, from: 0 }, { type: 'zombie', w: 4, from: 0 }, { type: 'fireWisp', w: 2, from: 45 },
        { type: 'mageZombie', w: 1.4, from: 20 }, { type: 'magmaSlime', w: 1.6, from: 60, at: 3 }, { type: 'armorSkeleton', w: 1.0, from: 45 }] },
    ruins: { midboss: 'dullahan', mageProj: 'darkMagic', rush: ['wolf', 'zombie', 'armorSkeleton'], rushLate: ['bat'],
      spawns: [{ type: 'wolf', w: 4, from: 0 }, { type: 'zombie', w: 4, from: 0 }, { type: 'ghost', w: 2, from: 20 },
        { type: 'mageZombie', w: 1.3, from: 30 }, { type: 'bat', w: 2.5, from: 30, at: 3 }, { type: 'armorSkeleton', w: 1.0, from: 60 }] },
  },

  // ---- ボス（ステージごとに全部ちがう） ----
  // ボスの体力 = BOSS_BASE_HP × hp × ステージ倍率（ステージに見合う装備で、1人で約30秒）
  // move   : static（動かない）/ walk（歩いて追いかける）/ dash（突進）/ teleport（瞬間移動）/ orbit（祭壇のまわりを回る）
  // attacks: aim（狙い撃ち）/ ring（全方向）/ spiral（うずまき）/ gears（回る歯車）/ slam（足元に衝撃）/ rain（降ってくる）/ summon（手下を呼ぶ）
  // atk・dps は「ステージ1の値」。touch は触れている間の1秒あたりのダメージ
  BOSS_BASE_HP: 300000,
  BOSS_DMG: 0.6,               // ボスの攻撃（弾・衝撃・歯車・体当たり）のダメージ倍率（v20：0.75 → 0.6）
  // ボスの強化：hp 体力の倍率 / cd 攻撃の間隔の倍率（小さいほどよく撃つ）/ speed 動く速さの倍率
  //   staticWalk：動かないボス（static）も、この速さでゆっくり近づいてくる
  BOSS_BUFF: { hp: 2.5, cd: 0.8, speed: 1.3, staticWalk: 38 },
  BOSSES: {
    // ===== 草原 =====
    aurott:       { name: 'オーロット', title: '木の怪物', r: 74, art: { sp: 'aurott' }, move: { t: 'static' },
      attacks: [{ t: 'aim', cd: 5, n: 1, speed: 280, atk: 190, proj: 'seed', pr: 14 }, { t: 'gears', count: 4, radius: 170, speed: 1.1, dps: 90, r: 22 }] },
    kingSlime:    { name: 'キングスライム', title: 'ぷるぷるの王', r: 72, art: { sp: 'slime', c: { main: '#5fd35a', dark: '#2f9e44', light: '#b7f5a8' } }, move: { t: 'walk', speed: 45 }, touch: 120,
      attacks: [{ t: 'ring', cd: 4, n: 10, speed: 220, atk: 150, proj: 'bubble', pr: 12 }] },
    mushKing:     { name: 'マッシュ大王', title: 'きのこの王様', r: 72, art: { sp: 'mushroom', c: { main: '#ff5a6a', dark: '#c2304a', light: '#fff4e0' } }, move: { t: 'static' },
      attacks: [{ t: 'rain', cd: 5, n: 6, r: 60, delay: 1.1, atk: 260 }, { t: 'aim', cd: 3.5, n: 3, spread: 0.5, speed: 260, atk: 170, proj: 'spore', pr: 12 }] },
    bigBoar:      { name: 'ビッグボア', title: '暴れイノシシ', r: 70, art: { sp: 'beast', c: { main: '#a8713a', dark: '#6b4320', light: '#e6c79a' }, v: 'boar' }, move: { t: 'dash', speed: 40, cd: 4, dash: 640, wind: 0.8, dur: 0.9 }, touch: 200,
      attacks: [{ t: 'aim', cd: 4, n: 1, speed: 300, atk: 220, proj: 'stone', pr: 18 }] },
    beetle:       { name: 'ジャイアントビートル', title: '甲虫の騎士', r: 70, art: { sp: 'insect', c: { main: '#2fbf8a', dark: '#1a6b5a', light: '#9ff5d0' }, v: 'beetle' }, move: { t: 'walk', speed: 55 }, touch: 130,
      attacks: [{ t: 'aim', cd: 3, n: 3, spread: 0.4, speed: 280, atk: 170, proj: 'poison', pr: 12 }, { t: 'ring', cd: 6, n: 12, speed: 220, atk: 150, proj: 'poison', pr: 11 }] },
    roseQueen:    { name: 'ローズクイーン', title: '花の女王', r: 72, art: { sp: 'flower', c: { main: '#ff7ad9', dark: '#c2307a', light: '#ffe0f4' } }, move: { t: 'static' },
      attacks: [{ t: 'spiral', cd: 7, dur: 3, every: 0.14, arms: 3, spin: 1.8, speed: 210, atk: 110, proj: 'petal', pr: 11 }, { t: 'slam', cd: 6, r: 90, delay: 1.2, atk: 360 }] },
    woodGolem:    { name: 'ウッドゴーレム', title: '森の巨人', r: 76, art: { sp: 'golem', c: { main: '#a8713a', dark: '#6b4320', light: '#5fb15a' } }, move: { t: 'walk', speed: 40 }, touch: 150,
      attacks: [{ t: 'slam', cd: 4.5, r: 110, delay: 1.0, atk: 420 }, { t: 'aim', cd: 4, n: 2, spread: 0.3, speed: 280, atk: 200, proj: 'stone', pr: 16 }] },
    queenBee:     { name: 'クイーンビー', title: '蜂の女王', r: 68, art: { sp: 'insect', c: { main: '#ffd23d', dark: '#231a3a', light: '#fff6c2' }, v: 'bee' }, move: { t: 'teleport', cd: 6 },
      attacks: [{ t: 'summon', cd: 9, n: 6 }, { t: 'aim', cd: 2.5, n: 5, spread: 0.8, speed: 300, atk: 150, proj: 'needle', pr: 10 }] },
    greenDragon:  { name: 'グリーンドラゴン', title: '森の竜', r: 76, art: { sp: 'dragon', c: { main: '#3cb44b', dark: '#1f6b2a', light: '#c8f5b0' } }, move: { t: 'orbit', speed: 0.35, radius: 260 },
      attacks: [{ t: 'aim', cd: 3, n: 5, spread: 0.7, speed: 280, atk: 180, proj: 'poison', pr: 12 }, { t: 'rain', cd: 6, n: 5, r: 70, delay: 1.2, atk: 280 }] },
    ancientTrent: { name: 'エンシェントトレント', title: '森の守護神', r: 80, hp: 1.25, art: { sp: 'aurott', v: 'ancient' }, move: { t: 'static' },
      attacks: [{ t: 'gears', count: 6, radius: 200, speed: 1.3, dps: 100, r: 24 }, { t: 'spiral', cd: 8, dur: 3, every: 0.15, arms: 4, spin: 1.5, speed: 220, atk: 140, proj: 'seed', pr: 12 }, { t: 'slam', cd: 7, r: 100, delay: 1.1, atk: 420 }] },
    // ===== 砂漠 =====
    orock:        { name: 'オーロック', title: '石の怪物', r: 78, art: { sp: 'orock' }, move: { t: 'static' },
      attacks: [{ t: 'aim', cd: 4, n: 1, speed: 300, atk: 520, proj: 'stone', pr: 24 }, { t: 'ring', cd: 7, n: 10, speed: 220, atk: 160, proj: 'sand', pr: 12 }] },
    sandworm:     { name: 'サンドワーム', title: '砂の大蛇', r: 72, art: { sp: 'serpent', c: { main: '#e0b066', dark: '#9a6a2a', light: '#fff0c8' }, v: 'worm' }, move: { t: 'teleport', cd: 5 }, touch: 160,
      attacks: [{ t: 'ring', cd: 5, n: 14, speed: 240, atk: 170, proj: 'sand', pr: 12 }, { t: 'slam', cd: 5, r: 100, delay: 1.0, atk: 420 }] },
    scorpionKing: { name: 'スコーピオンキング', title: '毒針の王', r: 74, art: { sp: 'insect', c: { main: '#c2603a', dark: '#7a3018', light: '#ffc49a' }, v: 'scorpion' }, move: { t: 'dash', speed: 60, cd: 5, dash: 600, wind: 0.8, dur: 0.8 }, touch: 200,
      attacks: [{ t: 'aim', cd: 2.5, n: 3, spread: 0.35, speed: 340, atk: 180, proj: 'poison', pr: 12 }] },
    pharaoh:      { name: 'ファラオ', title: '砂漠の王', r: 70, art: { sp: 'knight', c: { main: '#ffd23d', dark: '#2a5ad6', light: '#fff6c2' }, v: 'pharaoh' }, move: { t: 'teleport', cd: 6 },
      attacks: [{ t: 'summon', cd: 9, n: 6 }, { t: 'spiral', cd: 7, dur: 3, every: 0.14, arms: 2, spin: 2.2, speed: 230, atk: 150, proj: 'gold', pr: 12 }] },
    cactusKing:   { name: 'サボテンキング', title: 'トゲの王', r: 72, art: { sp: 'cactus', c: { main: '#43b05c', dark: '#1f6b2a', light: '#ffe066' } }, move: { t: 'static' },
      attacks: [{ t: 'ring', cd: 3.5, n: 16, speed: 250, atk: 150, proj: 'needle', pr: 10 }, { t: 'rain', cd: 6, n: 6, r: 60, delay: 1.1, atk: 260 }] },
    sphinx:       { name: 'スフィンクス', title: '謎かけの番人', r: 74, art: { sp: 'beast', c: { main: '#e6b45a', dark: '#9a6a2a', light: '#2a5ad6' }, v: 'lion' }, move: { t: 'dash', speed: 45, cd: 5, dash: 620, wind: 0.8, dur: 0.9 }, touch: 220,
      attacks: [{ t: 'aim', cd: 3, n: 5, spread: 0.8, speed: 290, atk: 170, proj: 'gold', pr: 12 }] },
    roc:          { name: 'ロック鳥', title: '砂嵐の怪鳥', r: 74, art: { sp: 'bird', c: { main: '#c98a4a', dark: '#7a4a22', light: '#ffe2a1' }, v: 'roc' }, move: { t: 'orbit', speed: 0.45, radius: 280 },
      attacks: [{ t: 'rain', cd: 5, n: 6, r: 65, delay: 1.0, atk: 270 }, { t: 'aim', cd: 2.6, n: 3, spread: 0.5, speed: 300, atk: 170, proj: 'feather', pr: 11 }] },
    oasisCrab:    { name: 'オアシスクラブ', title: '泉のヌシ', r: 72, art: { sp: 'crab', c: { main: '#2fb8c8', dark: '#1a6b7a', light: '#bff5ff' } }, move: { t: 'walk', speed: 50 }, touch: 180,
      attacks: [{ t: 'aim', cd: 3, n: 4, spread: 0.6, speed: 260, atk: 170, proj: 'bubble', pr: 12 }, { t: 'slam', cd: 5, r: 110, delay: 1.0, atk: 420 }] },
    sandEye:      { name: 'サンドアイ', title: '砂嵐の目', r: 68, art: { sp: 'eye', c: { main: '#e0b066', dark: '#9a6a2a', light: '#ffe2a1' } }, move: { t: 'teleport', cd: 5 },
      attacks: [{ t: 'spiral', cd: 6, dur: 3.5, every: 0.1, arms: 3, spin: 2, speed: 230, atk: 130, proj: 'sand', pr: 11 }, { t: 'ring', cd: 5, n: 12, speed: 230, atk: 160, proj: 'sand', pr: 12 }] },
    anubis:       { name: 'アヌビス', title: '冥府の番犬', r: 74, hp: 1.25, art: { sp: 'knight', c: { main: '#2b2540', dark: '#ffd23d', light: '#5fd3ff' }, v: 'anubis' }, move: { t: 'dash', speed: 50, cd: 4.5, dash: 650, wind: 0.75, dur: 0.85 }, touch: 220,
      attacks: [{ t: 'gears', count: 4, radius: 170, speed: 1.6, dps: 110, r: 22 }, { t: 'aim', cd: 3, n: 5, spread: 0.9, speed: 300, atk: 180, proj: 'gold', pr: 12 }] },
    // ===== 氷 =====
    frostGolem:   { name: 'フロストゴーレム', title: '氷の巨人', r: 80, art: { sp: 'frostGolem' }, move: { t: 'static' },
      attacks: [{ t: 'aim', cd: 4, n: 3, spread: 0.5, speed: 320, atk: 230, proj: 'ice', pr: 14 }, { t: 'gears', count: 3, radius: 190, speed: 1.4, dps: 110, r: 24 }] },
    yeti:         { name: 'イエティ', title: '雪山の怪物', r: 76, art: { sp: 'beast', c: { main: '#f4fbff', dark: '#8fb6d6', light: '#5fa8ff' }, v: 'yeti' }, move: { t: 'walk', speed: 55 }, touch: 200,
      attacks: [{ t: 'slam', cd: 4, r: 120, delay: 1.0, atk: 450 }, { t: 'aim', cd: 3.5, n: 1, speed: 280, atk: 300, proj: 'snowball', pr: 22 }] },
    iceSlime:     { name: 'アイススライム', title: '氷の王冠', r: 72, art: { sp: 'slime', c: { main: '#8ec5ef', dark: '#3f86d6', light: '#e3f7ff' } }, move: { t: 'walk', speed: 50 }, touch: 150,
      attacks: [{ t: 'ring', cd: 3.5, n: 12, speed: 230, atk: 160, proj: 'ice', pr: 12 }, { t: 'summon', cd: 10, n: 6 }] },
    snowOwl:      { name: 'スノーオウル', title: '白銀の夜目', r: 70, art: { sp: 'bird', c: { main: '#f4fbff', dark: '#8fa6c8', light: '#ffd34d' }, v: 'owl' }, move: { t: 'orbit', speed: 0.5, radius: 300 },
      attacks: [{ t: 'aim', cd: 2.4, n: 5, spread: 0.7, speed: 300, atk: 170, proj: 'feather', pr: 11 }, { t: 'rain', cd: 6, n: 6, r: 65, delay: 1.1, atk: 260 }] },
    iceCrab:      { name: 'アイスクラブ', title: '氷結のハサミ', r: 72, art: { sp: 'crab', c: { main: '#8ec5ef', dark: '#3f6fb8', light: '#f0fbff' } }, move: { t: 'dash', speed: 50, cd: 4.5, dash: 600, wind: 0.8, dur: 0.85 }, touch: 200,
      attacks: [{ t: 'ring', cd: 5, n: 14, speed: 230, atk: 160, proj: 'ice', pr: 12 }] },
    frostSerpent: { name: 'フロストサーペント', title: '氷の大蛇', r: 72, art: { sp: 'serpent', c: { main: '#8ec5ef', dark: '#3f6fb8', light: '#f0fbff' } }, move: { t: 'teleport', cd: 5 }, touch: 160,
      attacks: [{ t: 'spiral', cd: 6, dur: 3.5, every: 0.1, arms: 4, spin: 1.8, speed: 230, atk: 140, proj: 'ice', pr: 11 }, { t: 'slam', cd: 6, r: 100, delay: 1.0, atk: 420 }] },
    iceKnight:    { name: 'アイスナイト', title: '白銀の騎士', r: 72, art: { sp: 'knight', c: { main: '#bfe6ff', dark: '#3f6fb8', light: '#ffffff' }, v: 'knight' }, move: { t: 'dash', speed: 55, cd: 4, dash: 640, wind: 0.75, dur: 0.85 }, touch: 220,
      attacks: [{ t: 'gears', count: 4, radius: 160, speed: 1.8, dps: 120, r: 22 }, { t: 'aim', cd: 2.8, n: 3, spread: 0.4, speed: 320, atk: 200, proj: 'ice', pr: 12 }] },
    emperorPenguin: { name: 'エンペラーペンギン', title: '氷の皇帝', r: 72, art: { sp: 'bird', c: { main: '#2b2f45', dark: '#ffd34d', light: '#ffffff' }, v: 'penguin' }, move: { t: 'dash', speed: 50, cd: 3.5, dash: 680, wind: 0.7, dur: 0.9 }, touch: 220,
      attacks: [{ t: 'ring', cd: 4.5, n: 16, speed: 230, atk: 160, proj: 'ice', pr: 12 }, { t: 'summon', cd: 10, n: 6 }] },
    blizzardEye:  { name: 'ブリザードアイ', title: '吹雪の目', r: 68, art: { sp: 'eye', c: { main: '#bfe6ff', dark: '#3f86d6', light: '#ffffff' } }, move: { t: 'teleport', cd: 4.5 },
      attacks: [{ t: 'spiral', cd: 5.5, dur: 3.5, every: 0.09, arms: 4, spin: 2.2, speed: 230, atk: 140, proj: 'ice', pr: 11 }, { t: 'rain', cd: 5, n: 7, r: 65, delay: 1.0, atk: 270 }] },
    iceDragon:    { name: 'アイスドラゴン', title: '氷竜', r: 78, hp: 1.25, art: { sp: 'dragon', c: { main: '#8ec5ef', dark: '#3f6fb8', light: '#f0fbff' } }, move: { t: 'orbit', speed: 0.4, radius: 280 },
      attacks: [{ t: 'aim', cd: 2.6, n: 7, spread: 1.0, speed: 300, atk: 180, proj: 'ice', pr: 12 }, { t: 'slam', cd: 6, r: 110, delay: 1.0, atk: 450 }, { t: 'ring', cd: 7, n: 16, speed: 220, atk: 160, proj: 'ice', pr: 12 }] },
    // ===== 火山 =====
    ifrit:        { name: 'イフリート', title: '炎の魔人', r: 80, art: { sp: 'ifrit' }, move: { t: 'static' },
      attacks: [{ t: 'aim', cd: 3.5, n: 5, spread: 0.9, speed: 300, atk: 220, proj: 'fire', pr: 14 }, { t: 'ring', cd: 6, n: 12, speed: 230, atk: 170, proj: 'fire', pr: 12 }] },
    magmaKing:    { name: 'マグマキング', title: '溶岩の王冠', r: 72, art: { sp: 'slime', c: { main: '#ff8a1e', dark: '#c2304a', light: '#ffe066' } }, move: { t: 'walk', speed: 55 }, touch: 180,
      attacks: [{ t: 'ring', cd: 3.2, n: 14, speed: 230, atk: 170, proj: 'fire', pr: 12 }, { t: 'slam', cd: 5, r: 110, delay: 1.0, atk: 450 }] },
    lavaGolem:    { name: 'ラーヴァゴーレム', title: '溶岩の巨人', r: 78, art: { sp: 'golem', c: { main: '#4a2a35', dark: '#2e1b26', light: '#ff8a1e' }, v: 'lava' }, move: { t: 'walk', speed: 45 }, touch: 200,
      attacks: [{ t: 'slam', cd: 3.8, r: 120, delay: 1.0, atk: 480 }, { t: 'aim', cd: 3, n: 3, spread: 0.5, speed: 300, atk: 230, proj: 'fire', pr: 14 }] },
    hellKing:     { name: 'ヘルハウンドキング', title: '地獄の番犬', r: 74, art: { sp: 'beast', c: { main: '#3b2a35', dark: '#1e1015', light: '#ff5a1f' }, v: 'hound' }, move: { t: 'dash', speed: 55, cd: 3.8, dash: 700, wind: 0.7, dur: 0.85 }, touch: 240,
      attacks: [{ t: 'aim', cd: 2.5, n: 5, spread: 0.8, speed: 310, atk: 190, proj: 'fire', pr: 12 }] },
    salamander:   { name: 'サラマンダー', title: '火とかげの主', r: 72, art: { sp: 'serpent', c: { main: '#ff6a3d', dark: '#a8321f', light: '#ffe066' }, v: 'lizard' }, move: { t: 'teleport', cd: 4.5 }, touch: 180,
      attacks: [{ t: 'spiral', cd: 5.5, dur: 3.5, every: 0.09, arms: 3, spin: 2.4, speed: 240, atk: 150, proj: 'fire', pr: 11 }, { t: 'rain', cd: 5, n: 7, r: 65, delay: 1.0, atk: 280 }] },
    phoenix:      { name: 'フェニックス', title: '不死鳥', r: 74, art: { sp: 'bird', c: { main: '#ff8a1e', dark: '#d6264a', light: '#ffe066' }, v: 'phoenix' }, move: { t: 'orbit', speed: 0.55, radius: 300 },
      attacks: [{ t: 'rain', cd: 4.5, n: 8, r: 65, delay: 1.0, atk: 280 }, { t: 'aim', cd: 2.4, n: 5, spread: 0.8, speed: 310, atk: 190, proj: 'fire', pr: 12 }, { t: 'ring', cd: 7, n: 16, speed: 220, atk: 160, proj: 'fire', pr: 12 }] },
    magmaCrab:    { name: 'マグマクラブ', title: '灼熱のハサミ', r: 74, art: { sp: 'crab', c: { main: '#ff5a1f', dark: '#8f1d18', light: '#ffd27a' } }, move: { t: 'dash', speed: 55, cd: 4, dash: 640, wind: 0.75, dur: 0.85 }, touch: 230,
      attacks: [{ t: 'ring', cd: 4, n: 16, speed: 230, atk: 170, proj: 'fire', pr: 12 }, { t: 'slam', cd: 5, r: 110, delay: 1.0, atk: 460 }] },
    volcanoEye:   { name: 'ボルケーノアイ', title: '噴火口の目', r: 70, art: { sp: 'eye', c: { main: '#ff6a3d', dark: '#8f1d18', light: '#ffe066' } }, move: { t: 'teleport', cd: 4 },
      attacks: [{ t: 'spiral', cd: 5, dur: 3.5, every: 0.08, arms: 4, spin: 2.4, speed: 240, atk: 150, proj: 'fire', pr: 11 }, { t: 'slam', cd: 5.5, r: 110, delay: 1.0, atk: 460 }] },
    flameKnight:  { name: 'フレイムナイト', title: '炎の騎士', r: 74, art: { sp: 'knight', c: { main: '#d6264a', dark: '#2b2540', light: '#ffb13d' }, v: 'knight' }, move: { t: 'dash', speed: 55, cd: 3.6, dash: 680, wind: 0.7, dur: 0.85 }, touch: 240,
      attacks: [{ t: 'gears', count: 5, radius: 170, speed: 2, dps: 130, r: 22 }, { t: 'aim', cd: 2.6, n: 5, spread: 0.7, speed: 310, atk: 200, proj: 'fire', pr: 12 }] },
    fireDragon:   { name: 'ファイアドラゴン', title: '火竜', r: 80, hp: 1.3, art: { sp: 'dragon', c: { main: '#e0402a', dark: '#7a1a18', light: '#ffd27a' } }, move: { t: 'orbit', speed: 0.45, radius: 290 },
      attacks: [{ t: 'aim', cd: 2.4, n: 7, spread: 1.1, speed: 310, atk: 200, proj: 'fire', pr: 12 }, { t: 'rain', cd: 5, n: 8, r: 70, delay: 1.0, atk: 290 }, { t: 'ring', cd: 6.5, n: 18, speed: 220, atk: 170, proj: 'fire', pr: 12 }] },
    // ===== 廃墟 =====
    phantomKing:  { name: 'ファントムキング', title: '亡霊の王', r: 84, art: { sp: 'phantom' }, move: { t: 'static' },
      attacks: [{ t: 'aim', cd: 3.8, n: 7, spread: 1.8, speed: 300, atk: 220, proj: 'soul', pr: 15 }, { t: 'gears', count: 5, radius: 200, speed: 1.6, dps: 120, r: 24 }] },
    ghostSlime:   { name: 'ゴーストスライム', title: 'さまよう王冠', r: 72, art: { sp: 'slime', c: { main: '#b98cff', dark: '#6b3fd4', light: '#efe7ff' }, v: 'ghost' }, move: { t: 'teleport', cd: 4.5 },
      attacks: [{ t: 'ring', cd: 3.2, n: 16, speed: 230, atk: 170, proj: 'soul', pr: 12 }, { t: 'summon', cd: 9, n: 7 }] },
    deathKnight:  { name: 'デスナイト', title: '黒い死神騎士', r: 74, art: { sp: 'knight', c: { main: '#3b3550', dark: '#14101f', light: '#b98cff' }, v: 'knight' }, move: { t: 'dash', speed: 60, cd: 3.4, dash: 720, wind: 0.7, dur: 0.85 }, touch: 250,
      attacks: [{ t: 'aim', cd: 2.4, n: 5, spread: 0.7, speed: 320, atk: 210, proj: 'dark', pr: 12 }, { t: 'slam', cd: 5, r: 110, delay: 1.0, atk: 480 }] },
    guardian:     { name: 'ガーディアン', title: '古代兵器', r: 76, art: { sp: 'mech', c: { main: '#8b96aa', dark: '#4a5068', light: '#4fe0ff' } }, move: { t: 'walk', speed: 40 }, touch: 200,
      attacks: [{ t: 'spiral', cd: 5.5, dur: 3.5, every: 0.08, arms: 4, spin: 2, speed: 240, atk: 150, proj: 'laser', pr: 10 }, { t: 'slam', cd: 5, r: 120, delay: 1.0, atk: 480 }] },
    arachne:      { name: 'アラクネ', title: '蜘蛛の女王', r: 74, art: { sp: 'insect', c: { main: '#6b3fd4', dark: '#2b1a5a', light: '#ff7ad9' }, v: 'spider' }, move: { t: 'walk', speed: 65 }, touch: 220,
      attacks: [{ t: 'summon', cd: 8, n: 8 }, { t: 'rain', cd: 4.5, n: 8, r: 65, delay: 1.0, atk: 280 }, { t: 'aim', cd: 2.6, n: 3, spread: 0.4, speed: 320, atk: 210, proj: 'poison', pr: 12 }] },
    vampireLord:  { name: 'ヴァンパイアロード', title: '夜の貴族', r: 74, art: { sp: 'phantom', c: { main: '#d6264a', dark: '#2b1a2a', light: '#ffe0e8' }, v: 'vampire' }, move: { t: 'teleport', cd: 3.8 },
      attacks: [{ t: 'spiral', cd: 5.5, dur: 3, every: 0.1, arms: 4, spin: 2.2, speed: 230, atk: 140, proj: 'blood', pr: 11 }, { t: 'aim', cd: 2.6, n: 3, spread: 0.6, speed: 300, atk: 200, proj: 'blood', pr: 12 }] },
    shadowEye:    { name: 'シャドウアイ', title: '影の目', r: 70, art: { sp: 'eye', c: { main: '#4a3a7a', dark: '#14101f', light: '#b98cff' } }, move: { t: 'teleport', cd: 3.6 },
      attacks: [{ t: 'ring', cd: 3.6, n: 18, speed: 230, atk: 170, proj: 'dark', pr: 12 }, { t: 'spiral', cd: 6, dur: 3.5, every: 0.08, arms: 4, spin: 2.6, speed: 240, atk: 150, proj: 'dark', pr: 11 }] },
    boneDragon:   { name: 'ボーンドラゴン', title: '骨竜', r: 80, art: { sp: 'dragon', c: { main: '#f2efe4', dark: '#8b8f9c', light: '#b98cff' }, v: 'bone' }, move: { t: 'orbit', speed: 0.5, radius: 300 },
      attacks: [{ t: 'aim', cd: 2.3, n: 7, spread: 1.1, speed: 310, atk: 210, proj: 'bone', pr: 12 }, { t: 'rain', cd: 4.5, n: 8, r: 70, delay: 1.0, atk: 300 }, { t: 'slam', cd: 6, r: 120, delay: 1.0, atk: 480 }] },
    machineGolem: { name: 'マシンゴーレムΩ', title: '機械仕掛けの王', r: 78, hp: 1.2, art: { sp: 'mech', c: { main: '#ffd23d', dark: '#8a5a1a', light: '#ff4a5e' }, v: 'omega' }, move: { t: 'walk', speed: 45 }, touch: 230,
      attacks: [{ t: 'gears', count: 6, radius: 200, speed: 2, dps: 140, r: 24 }, { t: 'spiral', cd: 5, dur: 3.5, every: 0.08, arms: 4, spin: 2.2, speed: 240, atk: 160, proj: 'laser', pr: 10 }, { t: 'slam', cd: 5, r: 120, delay: 1.0, atk: 500 }] },
    hades:        { name: 'ハデス', title: '冥王', r: 88, hp: 1.4, art: { sp: 'hades' }, move: { t: 'teleport', cd: 5.5 },
      attacks: [{ t: 'aim', cd: 2.8, n: 5, spread: 1.2, speed: 300, atk: 220, proj: 'dark', pr: 13 }, { t: 'ring', cd: 5, n: 16, speed: 220, atk: 170, proj: 'soul', pr: 12 },
        { t: 'slam', cd: 6, r: 120, delay: 1.1, atk: 480 }, { t: 'summon', cd: 12, n: 6 }, { t: 'gears', count: 4, radius: 220, speed: 1.4, dps: 120, r: 24 }] },
  },
  // ステージの順番に並べたボス（ステージ1 → 50）
  STAGE_BOSSES: [
    'aurott', 'kingSlime', 'mushKing', 'bigBoar', 'beetle', 'roseQueen', 'woodGolem', 'queenBee', 'greenDragon', 'ancientTrent',
    'orock', 'sandworm', 'scorpionKing', 'pharaoh', 'cactusKing', 'sphinx', 'roc', 'oasisCrab', 'sandEye', 'anubis',
    'frostGolem', 'yeti', 'iceSlime', 'snowOwl', 'iceCrab', 'frostSerpent', 'iceKnight', 'emperorPenguin', 'blizzardEye', 'iceDragon',
    'ifrit', 'magmaKing', 'lavaGolem', 'hellKing', 'salamander', 'phoenix', 'magmaCrab', 'volcanoEye', 'flameKnight', 'fireDragon',
    'phantomKing', 'ghostSlime', 'deathKnight', 'guardian', 'arachne', 'vampireLord', 'shadowEye', 'boneDragon', 'machineGolem', 'hades',
  ],
  BOSS_ARENA: 620,             // 動くボスは祭壇からこの距離より遠くへは行かない

  // ---- スキル（武器を含めて3枠） ----
  // 武器スキルは最初から★1。取得するたびに★が1つ上がる（★5 の次は「赤★1」＝進化。赤★1 が最大）
  //   スキルが赤★1：いつも発動して大幅パワーアップ（EVOLVE の値）
  //   アビリティが赤★1：もう1段階（+10%など）
  SLOTS: { skills: 4, abilities: 4 },   // v14：スキル（武器を含む）とアビリティを4つずつ持てる
  MAX_STAR: 5,
  EVO_STAR: 6,
  SKILLS: {
    kunai:    { name: 'クナイ',       weapon: true, desc: (s) => (s >= 6 ? `【進化】${GC_EV().kunai.cd}秒ごとにクナイを${GC_EV().kunai.count}本投げ続ける。敵を追いかけて必ず当たる（ATK×${GC_SP().kunai.dmg}）`
      : `1秒ごとにクナイを${s}本投げる。敵を追いかけて必ず当たる（ATK×${GC_SP().kunai.dmg}）`) },
    shotgun:  { name: 'ショットガン', weapon: true, desc: (s) => (s >= 6 ? `【進化】${GC_EV().shotgun.cd}秒ごとに大きく散弾を撃ち続ける（${GC_EV().shotgun.pellets}発。全弾命中でATK×${(GC_SP().shotgun.total * Math.pow(1.1, 5)).toFixed(2)}）`
      : `${(1.5 - 0.2 * (s - 1)).toFixed(1)}秒ごとに散弾を撃つ。全弾命中でATK×${(GC_SP().shotgun.total * Math.pow(1.1, s - 1)).toFixed(2)}`) },
    lightsaber: { name: 'ライトセイバー', weapon: true, desc: (s) => (s >= 6 ? `【進化】${GC_EV().lightsaber.cd}秒ごとに全方向を回転斬りし続ける（範囲${saberR(6)}人分、ATK×${(GC_SP().lightsaber.dmg * Math.pow(1.2, 5)).toFixed(2)}）`
      : `${(1 - 0.1 * (s - 1)).toFixed(1)}秒ごとに近くの敵を自動で狙って斬る（90度・範囲${saberR(s)}人分、ATK×${(GC_SP().lightsaber.dmg * Math.pow(1.2, s - 1)).toFixed(2)}）`) },
    revolver: { name: 'リボルバー',   weapon: true, desc: (s) => (s >= 6 ? `【進化】${GC_EV().revolver.cd}秒ごとに近くの敵を撃ち抜き続ける（ATK×${(GC_SP().revolver.dmg * Math.pow(1.2, 5)).toFixed(2)}）`
      : `0.8秒ごとに近くの敵1体を撃ち抜く（ATK×${(GC_SP().revolver.dmg * Math.pow(1.2, s - 1)).toFixed(2)}）`) },
    minigun:  { name: 'ミニガン',     weapon: true, desc: (s) => (s >= 6 ? `【進化】リロードなしで、1秒に${GC_EV().minigun.rate}発ずつ撃ち続ける（1発 ATK×${GC_SP().minigun.dmg}）`
      : `10秒間、1秒に20発ずつ近くの敵を撃ち続け、${(3 - 0.5 * (s - 1)).toFixed(1)}秒リロードする（1発 ATK×${GC_SP().minigun.dmg}）`) },
    destroyerPower: { name: '破壊の力', weapon: true, desc: (s) => (s >= 6 ? `【進化】${GC_EV().destroyerPower.cd}秒ごとに大きなブラックホールを撃ち続ける。${GC_EV().destroyerPower.dur}秒間、毎秒ATK×${GC_SP().destroyerPower.dps}`
      : `5秒ごとに近くの敵へブラックホールを撃つ。${(3 + 0.5 * (s - 1)).toFixed(1)}秒間、敵を吸い寄せて毎秒ATK×${GC_SP().destroyerPower.dps}（範囲${2 + 0.5 * (s - 1)}人分）`) },
    defender: { name: 'ディフェンサー', desc: (s) => (s >= 6 ? `【進化】歯車が${GC_EV().defender.count}つ、速く回り続ける。触れた敵にATK×${GC_SP().defender.dmg}（当たる間隔が半分）`
      : `自分の周りを歯車が${s + 1}つ回る。触れた敵にATK×${GC_SP().defender.dmg}`) },
    drone:    { name: 'ドローン',     desc: (s) => (s >= 6 ? `【進化】毎秒${((3.5 + 1.5 * 5) * GC_EV().drone.rate).toFixed(1)}発を必ず当てる（1発ATK×${GC_SP().drone.dmg}）`
      : `近くの敵を狙って毎秒${(3.5 + 1.5 * (s - 1)).toFixed(1)}発撃つ（命中率50%、1発ATK×${GC_SP().drone.dmg}）`) },
    thunder:  { name: '雷発生機',     desc: (s) => (s >= 6 ? `【進化】${GC_EV().thunder.cd}秒ごとに雷を${GC_EV().thunder.count}本落とし続ける（ATK×${GC_SP().thunder.dmg}、電気は毎秒ATK×${GC_SP().thunder.fieldDps}）`
      : `雷を${s}本落とし、5秒間電気が残る（ATK×${GC_SP().thunder.dmg}、電気は毎秒ATK×${GC_SP().thunder.fieldDps}）`) },
    soccer:   { name: 'サッカーボール', desc: (s) => (s >= 6 ? `【進化】ボールが${GC_EV().soccer.balls}つになり、速く跳ね回る（ATK×${GC_SP().soccer.dmg}）`
      : `画面の端で跳ね返るボール（★ごとに大きく速くなる、ATK×${GC_SP().soccer.dmg}）`) },
    molotov:  { name: '火炎瓶',       desc: (s) => (s >= 6 ? `【進化】${GC_EV().molotov.cd}秒ごとに火炎瓶を${molotovN(s)}つ投げ続ける（範囲${s + 1}人分、毎秒ATK×${(GC_SP().molotov.dps + GC_SP().molotov.dpsStep * 5).toFixed(2)}）`
      : `火炎瓶を${molotovN(s)}つ投げて炎を残す（範囲${s + 1}人分、毎秒ATK×${(GC_SP().molotov.dps + GC_SP().molotov.dpsStep * (s - 1)).toFixed(2)}）`) },
    rocket:   { name: 'ロケット',     desc: (s) => (s >= 6 ? `【進化】${GC_EV().rocket.cd}秒ごとにロケットを${rocketN(s)}発撃ち続ける。大きな爆発でまわりの敵にATK×${(GC_SP().rocket.dmg + GC_SP().rocket.dmgStep * 5).toFixed(1)}（爆発の大きさ${Math.round((GC_SP().rocket.r + GC_SP().rocket.rStep * 5) * GC_EV().rocket.scale / 20 * 10) / 10}人分）`
      : `${GC_SP().rocket.cd}秒ごとに近くの敵へロケットを${rocketN(s)}発撃つ。当たると爆発してまわりの敵にATK×${(GC_SP().rocket.dmg + GC_SP().rocket.dmgStep * (s - 1)).toFixed(1)}（爆発の大きさ${Math.round((GC_SP().rocket.r + GC_SP().rocket.rStep * (s - 1)) / 20 * 10) / 10}人分）`) },
    music:    { name: '楽器',         desc: (s) => (s >= 6 ? `【進化】その場に大きな音楽の広場を作る（範囲${musicR(6)}人分）。中にいる味方全員：${musicBuffText(6)}（ダメージはなし）`
      : `その場に音楽の広場を作る（範囲${musicR(s)}人分・${GC_SP().music.cd}秒ごとに置き直す）。中にいる味方全員：${musicBuffText(s)}（ダメージはなし・重ならない）`) },
    energyBlade: { name: 'エネルギーブレード', desc: (s) => (s >= 6 ? `【進化】${GC_EV().energyBlade.cd}秒ごとに大きなエネルギーの刃で周りの敵を一掃し続ける（ATK×${GC_SP().energyBlade.dmg * GC_EV().energyBlade.dmg}、範囲${bladeR(6)}人分）`
      : `${GC_SP().energyBlade.cd - GC_SP().energyBlade.cdStep * (s - 1)}秒ごとにエネルギーの刃で周りの敵を一掃する（ATK×${GC_SP().energyBlade.dmg}、範囲${bladeR(s)}人分）`) },
    gravity:  { name: '重力発生機',   desc: (s) => (s >= 6 ? `【進化】範囲${Math.round(GC_EV().gravity.r * 100)}%の重力で敵を90%遅くし、毎秒ATK×${((GC_SP().gravity.dps + GC_SP().gravity.dpsStep * 5) * GC_EV().gravity.dps).toFixed(2)}`
      : `周りの敵を${Math.round(Math.min(0.9, 0.5 + 0.1 * (s - 1)) * 100)}%遅くし、毎秒ATK×${(GC_SP().gravity.dps + GC_SP().gravity.dpsStep * (s - 1)).toFixed(2)}`) },
  },
  // v13：すべてのスキルを少し強化（ダメージ +15%）
  SKILL_PARAMS: {
    kunai:    { cd: 1.0, dmg: 1.15, speed: 760, range: 620 },
    shotgun:  { cd: 1.5, cdStep: 0.2, pellets: 7, spread: 0.55, total: 2.3, mult: 1.1, speed: 950, range: 380, aim: 1.25 },   // v15：近くの敵に向けて狭く撃つ（aim：狙う距離の倍率）
    // ライトセイバー：向いている方向に arc（ラジアン）の扇形で斬る。★が上がるたびに範囲が rStep ずつ広がる
    lightsaber: { cd: 1.0, cdStep: 0.1, r: 90, rStep: 0.12, arc: Math.PI / 2, dmg: 1.15, mult: 1.2 },   // v20：エネルギーブレードに合わせて範囲を少し狭くした（100＋15%/★ → 90＋12%/★）
    // リボルバー：0.8秒ごとに1発（★を上げても間隔は変わらず、ダメージが上がる）
    revolver: { cd: 0.8, cdStep: 0, dmg: 1.15, mult: 1.2, range: 520 },
    // ミニガン：fire 秒撃ち続けて reload 秒リロード（★ごとに reloadStep 短く）。1秒に rate 発、1発 ATK×dmg
    minigun:  { rate: 20, fire: 10, reload: 3, reloadStep: 0.5, dmg: 0.58, speed: 950, range: 560 },
    // 破壊の力：cd 秒ごとにブラックホール。半径 r（★ごとに rStep）、dur 秒（★ごとに durStep）、毎秒 ATK×dps。pull の速さで吸い寄せる
    destroyerPower: { cd: 5, r: 40, rStep: 10, dur: 3, durStep: 0.5, dps: 1.75, pullR: 2.6, pull: 90, range: 520 },
    defender: { orbit: 105, angSpeed: 2.1, r: 16, dmg: 1.15, hitCd: 0.7 },   // v14：回る速さを少し上げた（1.8 → 2.1）
    // ドローン：命中率50%
    drone:    { rate: 3.5, rateStep: 1.5, dmg: 0.23, range: 460, accuracy: 0.5 },
    thunder:  { cd: 2.5, dmg: 1.15, fieldR: 60, fieldTime: 5, fieldDps: 0.7, range: 520 },
    // サッカーボール：半径 r（★ごとに rStep 大きく）。v13で前の3分の1くらいの大きさにして、そのぶんダメージを上げた
    soccer:   { r: 16, rStep: 4.5, speed: 200, speedStep: 70, dmg: 3.0, hitCd: 0.5 },
    // 火炎瓶：投げる数は bottles 本。★2・★4・赤★1 で1本ずつ増える（2 → 3 → 4 → 5本）
    molotov:  { cd: 4, bottles: 2, moreAt: [2, 4, 6], r: 40, rStep: 20, time: 3, dps: 0.7, dpsStep: 0.23, throwDist: 230 },
    gravity:  { r: 150, dps: 0.23, dpsStep: 0.23, slow: 0.5, slowStep: 0.1 },
    // v17 ロケット：cd 秒ごとに count 発（★3・★5 で1発ずつ増える）。爆発 ATK×dmg（★ごとに dmgStep）、爆発の半径 r（★ごとに rStep）
    rocket:   { cd: 3, count: 1, moreAt: [3, 5], dmg: 2.0, dmgStep: 0.4, r: 60, rStep: 12, speed: 520, range: 700, turn: 5 },
    // v19 エネルギーブレード：cd 秒ごと（★ごとに cdStep 短く）に、まわり半径 r（★ごとに rStep 広く）の敵に ATK×dmg（雑魚は一撃）
    energyBlade: { cd: 10, cdStep: 1, r: 100, rStep: 15, dmg: 8 },   // v20：範囲を狭くした（150＋30/★ → 100＋15/★）
    // v17 楽器：cd 秒ごとに、その場に半径 r の広場を置き直す（前の広場は消える）。中にいる味方にバフ（重ならない＝いちばん高いものだけ）
    music:    { cd: 10, r: 170, rStep: 15, buffs: [null,   // 広場の半径 r（★が上がるごとに rStep 広がる）
      { atk: 10 }, { atk: 12 }, { atk: 14, cut: 14 }, { atk: 16, cut: 16 }, { atk: 18, cut: 18, regen: 1 },
      { atk: 20, cut: 20, regen: 1.2, spd: 10 }] },
  },
  // ---- 進化（赤★1）したスキル：いつも発動して大幅パワーアップ ----
  EVOLVE: {
    kunai:    { cd: 0.4, count: 8 },                       // 0.4秒ごとに8本
    shotgun:  { cd: 0.35, pellets: 11, spread: 0.9 },      // 0.35秒ごとに広い散弾
    lightsaber: { cd: 0.4, range: 1.25 },                  // 全方向の回転斬り（範囲さらに1.25倍）
    revolver: { cd: 0.25 },                                // 0.25秒ごと
    minigun:  { rate: 30 },                                // リロードなし・1秒に30発
    destroyerPower: { cd: 2, dur: 6, scale: 1.3 },         // 2秒ごとに大きなブラックホール
    defender: { count: 8, speed: 3.1, hitCd: 0.35 },       // 歯車8つ・速く回る
    drone:    { rate: 1.5, accuracy: 1 },                  // 発射数1.5倍・必中
    thunder:  { cd: 0.7, count: 6 },                       // 0.7秒ごとに6本
    soccer:   { balls: 2, speed: 1.3 },                    // ボール2つ・速い
    molotov:  { cd: 1.2 },                                 // 1.2秒ごと（数は赤★1で5本）
    gravity:  { r: 1.6, dps: 2 },                          // 範囲1.6倍・ダメージ2倍
    rocket:   { cd: 1.2, count: 5, scale: 1.3 },           // 1.2秒ごとに5発・爆発1.3倍（ダメージ・大きさは★6段目まで上がる）
    music:    { r: 1.2 },                                  // 広場さらに1.2倍（バフは buffs の6番目＝赤★1）
    energyBlade: { cd: 3, r: 1.2, dmg: 1.5 },              // 3秒ごと・範囲さらに1.2倍・ダメージ1.5倍
  },

  // ---- アビリティ（3枠） ----
  ABILITIES: {
    drink:   { name: 'エナジードリンク', desc: (s) => `毎秒HPを${s}%回復` },   // v18：★1で1%、★ごとに+1%（赤★1で6%）
    ammo:    { name: '弾薬',             desc: (s) => `攻撃力 +${10 * s}%` },
    battery: { name: 'エネルギー装置',   desc: (s) => `攻撃速度 +${10 * s}%` },
    vest:    { name: '防弾チョッキ',     desc: (s) => `受けるダメージ -${10 * s}%` },
    scroll:  { name: '巻物',             desc: (s) => `チーム全体の経験値 +${10 * s}%` },
    coin:    { name: 'コイン獲得',       desc: (s) => `試合終了後にコイン +${300 * s}` },
    expand:  { name: '拡大モジュール',   desc: (s) => `攻撃の当たり判定が ${10 * s}% 大きくなる` },
    dodge:   { name: '見切り',           desc: (s) => `敵の攻撃を ${5 * s}% の確率でよける（よけた攻撃はダメージなし）` },   // v19。v20で ★ごとに10% → 5%
    gas:     { name: 'ガス注入',         desc: (s) => `弾の速さが ${10 * s}% 速くなる（クナイ・散弾・ミニガン・ロケット・火炎瓶など）` },   // v17
  },

  // ---- ミッション ----
  MISSIONS: {
    stageClearReward: 3000,    // ステージを1つクリアするたびに
    killStep: 100,             // 敵を100体倒すごとに
    killReward: 200,
  },
};

/* ---------- ステージごとの倍率（上の表から自動計算） ---------- */
(function () {
  const GC = DS.gameConfig, T = GC.STAGE_TARGET, D = GC.STAGE_DANGER;
  const n = T.atk.length;
  const lerp = (a, k) => a[0] + (a[1] - a[0]) * k;
  /** ステージ（0始まり）の { hp: 敵の体力の倍率, atk: 敵の攻撃力の倍率, bossKey, biome } */
  GC.stageScale = function (i) {
    i = Math.max(0, Math.min(n - 1, i | 0));
    const k = n > 1 ? i / (n - 1) : 0;
    const st = DS.config.STAGES[i];
    const bs = (GC.BIOME_SCALE && st && GC.BIOME_SCALE[st.biome]) || 1;
    return {
      hp: T.atk[i] / GC.UNIT.atk * lerp(D.hp, k) * bs,
      atk: T.hp[i] / GC.UNIT.hp * lerp(D.atk, k) * bs,
      target: { atk: T.atk[i], hp: T.hp[i] },
    };
  };
  /** 戦闘力（ATK×6＋HP。ランキングの総合力と同じ） */
  GC.power = (atk, hp) => Math.round((Number(atk) || 0) * ((DS.config.RANKING && DS.config.RANKING.atkWeight) || 6) + (Number(hp) || 0));
  /** 圧倒モードになる戦闘力（ステージの目安の OVERWHELM.ratio 倍） */
  GC.overwhelmNeed = function (i) {
    const t = GC.stageScale(i).target;
    return Math.round(GC.power(t.atk, t.hp) * ((GC.OVERWHELM && GC.OVERWHELM.ratio) || 2));
  };
  /** メンバー全員（[{atk,hp}]）が圧倒モードの条件を満たしているか */
  GC.overwhelmOk = function (i, members) {
    if (!GC.OVERWHELM || !members || !members.length) return false;
    const need = GC.overwhelmNeed(i);
    return members.every((m) => GC.power(m.atk, m.hp) >= need);
  };
  /** そのステージの出現キャラ（エリアの表 + ステージ番号で決まる） */
  GC.stageRoster = function (i) {
    const st = DS.config.STAGES[i] || DS.config.STAGES[0];
    const b = GC.BIOME_ENEMIES[st.biome];
    const inArea = (st.no - 1) % 10;
    return {
      boss: GC.STAGE_BOSSES[i] || GC.STAGE_BOSSES[0],
      midboss: b.midboss,
      mageProj: b.mageProj,
      rush: inArea >= 5 ? b.rush.concat(b.rushLate || []) : b.rush,
      spawns: b.spawns.filter((s) => (s.at || 0) <= inArea),
    };
  };
})();

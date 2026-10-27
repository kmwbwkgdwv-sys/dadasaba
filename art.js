/* =========================================================
 *  art.js  ― すべてのイラストを SVG で描画
 *  画像ファイルを使わないので、GitHub にそのまま置いても軽量です。
 *  各関数は SVG 文字列を返します。
 * ========================================================= */
(function () {
  const O = '#231a3a';          // 共通の輪郭線の色
  let seq = 0;
  const uid = () => 'g' + (++seq).toString(36);   // グラデーション ID の衝突を防ぐ

  function lg(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
    return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${
      stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  }
  function rg(id, stops, cx = 0.5, cy = 0.5, r = 0.5) {
    return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${
      stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('')}</radialGradient>`;
  }
  function starPts(cx, cy, R, r, n = 5, rot = -90) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (rot + i * 180 / n) * Math.PI / 180;
      const rr = i % 2 ? r : R;
      pts.push((cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1));
    }
    return pts.join(' ');
  }
  function sparkle(cx, cy, s, fill = '#fff', op = 1) {
    return `<path d="M${cx} ${cy - s}Q${cx} ${cy} ${cx + s} ${cy}Q${cx} ${cy} ${cx} ${cy + s}Q${cx} ${cy} ${cx - s} ${cy}Q${cx} ${cy} ${cx} ${cy - s}Z" fill="${fill}" opacity="${op}"/>`;
  }
  const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

  /* ---------------------------------------------------------
   *  装備アイテム（viewBox 0 0 100 100）
   * --------------------------------------------------------- */
  const BOOT = 'M34 18 L60 18 L61 52 Q62 60 70 62 L82 65 Q92 68 92 76 L92 82 L32 82 L32 60 Q31 40 34 18 Z';
  const BOOT_SOLE = 'M29 80 L95 80 Q96 88 89 89 L34 89 Q28 88 29 80 Z';
  const STRAP = 'M4 44 Q50 32 86 42 L96 50 L86 58 Q50 48 4 60 Z';

  const ITEM_ART = {
    kunai() {
      const u = uid();
      return `<defs>${lg('b' + u, [[0, '#ffffff'], [0.48, '#c9d4e4'], [0.52, '#8796ad'], [1, '#56637a']], 0, 0, 1, 0)}</defs>
      <g transform="rotate(40 50 50)" stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <circle cx="50" cy="88" r="7" fill="none" stroke-width="7"/>
        <circle cx="50" cy="88" r="7" fill="none" stroke="#f2b33d" stroke-width="3"/>
        <rect x="45" y="58" width="10" height="24" rx="2" fill="#3b2f5c"/>
        <path d="M45 63 L55 67 M45 69 L55 73 M45 75 L55 79" stroke="#ff5a6a" stroke-width="2.4"/>
        <rect x="40" y="53" width="20" height="6" rx="2.5" fill="#f2b33d"/>
        <path d="M50 5 L62 35 L50 55 L38 35 Z" fill="url(#b${u})"/>
        <path d="M50 11 L50 50" stroke="#fff" stroke-width="1.6" opacity=".75"/>
      </g>
      ${sparkle(74, 20, 6)}${sparkle(84, 34, 3.5, '#fff', 0.8)}`;
    },

    shotgun() {
      const u = uid();
      return `<defs>${lg('w' + u, [[0, '#e0904a'], [1, '#8a4a22']])}${lg('s' + u, [[0, '#d7deea'], [0.5, '#8d98ad'], [1, '#4c566c']])}</defs>
      <g transform="rotate(-28 50 54)" stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M6 52 L30 44 L34 57 L22 63 L11 72 Q3 68 4 60 Z" fill="url(#w${u})"/>
        <path d="M34 54 Q35 65 45 61" fill="none" stroke-width="2.6"/>
        <rect x="28" y="40" width="23" height="15" rx="3" fill="#4a5068"/>
        <rect x="49" y="40" width="46" height="7.5" rx="2" fill="url(#s${u})"/>
        <rect x="49" y="48" width="38" height="5" rx="2" fill="#363b4f"/>
        <rect x="57" y="46" width="21" height="10" rx="3.5" fill="url(#w${u})"/>
        <path d="M62 48 L62 54 M67 48 L67 54 M72 48 L72 54" stroke-width="1.8"/>
        <rect x="92" y="38.5" width="5" height="10.5" rx="1.5" fill="#2b2f3d"/>
        <circle cx="38" cy="47" r="2.2" fill="#f2b33d" stroke-width="1.5"/>
      </g>
      ${sparkle(82, 16, 5)}`;
    },

    // ミシック：ハイブリットランス（先に黄色い歯車が付いた杖と、漆黒の槍が × に重なっている）
    hybridLance() {
      const u = uid();
      const cx = 77, cy = 21, R = 12, r2 = 15.5;
      const teeth = Array.from({ length: 10 }, (_, i) => {
        const a0 = (i * 36 - 8) * Math.PI / 180, a1 = (i * 36 + 8) * Math.PI / 180;
        const P = (a, rr) => (cx + Math.cos(a) * rr).toFixed(1) + ' ' + (cy + Math.sin(a) * rr).toFixed(1);
        return `L${P(a0, R)} L${P(a0 + 0.05, r2)} L${P(a1 - 0.05, r2)} L${P(a1, R)}`;
      }).join(' ');
      return `<defs>${rg('ha' + u, [[0, '#fffbe0'], [0.45, 'rgba(255,214,120,.55)'], [1, 'rgba(160,220,255,0)']])}
        ${lg('hs' + u, [[0, '#4a4458'], [0.5, '#0d0b14'], [1, '#2a2338']], 0, 0, 1, 1)}
        ${lg('hb' + u, [[0, '#6b5cff'], [0.5, '#16121f'], [1, '#000']], 0, 0, 1, 1)}
        ${lg('hg' + u, [[0, '#fff6a8'], [0.5, '#ffd23d'], [1, '#d68400']], 0, 0, 1, 1)}
        ${lg('hw' + u, [[0, '#fff8e8'], [1, '#c9a46a']], 0, 0, 1, 1)}</defs>
      <circle cx="50" cy="50" r="46" fill="url(#ha${u})"/>
      <!-- 漆黒の槍（右下 → 左上） -->
      <g stroke="${O}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
        <path d="M76 80 L27 31" stroke-width="14"/><path d="M76 80 L27 31" stroke="url(#hs${u})" stroke-width="9"/>
        <circle cx="76" cy="80" r="6" fill="#1a1622"/>
        <path d="M30 25 L36 34 L25 37 Z" fill="#1a1622"/>
        <path d="M27 31 L8 6 L14 22 L4 13 L19 33 Z" fill="url(#hb${u})"/>
        <path d="M24 22 L32 21 L34 30" fill="none" stroke="#9a7cff" stroke-width="1.6"/>
        <path d="M66 74 L74 66 M60 68 L68 60" stroke="#6b5cff" stroke-width="2.6"/>
      </g>
      <path d="M10 9 L21 26" stroke="#c9b8ff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>
      <!-- 杖（左下 → 右上）と先端の黄色い歯車 -->
      <g stroke="${O}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
        <path d="M24 80 L68 31" stroke-width="14"/><path d="M24 80 L68 31" stroke="url(#hw${u})" stroke-width="9"/>
        <circle cx="24" cy="80" r="6" fill="#ffd23d"/>
        <path d="M31 66 L39 74 M37 59 L45 67" stroke="#ffd23d" stroke-width="3.4"/>
        <path d="M${cx + R} ${cy} ${teeth} Z" fill="url(#hg${u})"/>
        <circle cx="${cx}" cy="${cy}" r="6.4" fill="#5fe9ff"/>
      </g>
      <circle cx="${cx - 2}" cy="${cy - 2}" r="2.2" fill="#fff"/>
      <!-- 交わるところの光る輪 -->
      <circle cx="51" cy="56" r="8" fill="none" stroke="#fff3a0" stroke-width="3" opacity=".9"/>
      <circle cx="51" cy="56" r="8" fill="none" stroke="${O}" stroke-width="1.2"/>
      ${sparkle(88, 50, 6, '#fff')}${sparkle(14, 58, 4.5, '#fff6c2')}${sparkle(60, 8, 4, '#dffcff')}`;
    },
    // 破壊の力（S）：ブラックホールを宿したガントレット
    destroyerPower() {
      const u = uid();
      return `<defs>${rg('bh' + u, [[0, '#000'], [0.45, '#14002a'], [0.7, '#6b2bd6'], [0.86, '#ff5ad1'], [1, 'rgba(255,90,209,0)']])}
        ${lg('ga' + u, [[0, '#5a5470'], [0.5, '#211d2e'], [1, '#0d0b14']], 0, 0, 1, 1)}${lg('gr' + u, [[0, '#ff7ad9'], [1, '#8a2be2']])}</defs>
      <circle cx="58" cy="36" r="30" fill="url(#bh${u})"/>
      <g fill="none" stroke-linecap="round">
        <path d="M34 30 Q44 12 66 14 Q84 18 86 36" stroke="#c9a2ff" stroke-width="2.6" opacity=".9"/>
        <path d="M80 48 Q70 62 50 58 Q34 54 32 40" stroke="#ff9ae6" stroke-width="2.2" opacity=".9"/>
        <path d="M44 26 Q58 20 70 30" stroke="#fff" stroke-width="1.6" opacity=".7"/>
      </g>
      <circle cx="58" cy="36" r="9" fill="#000" stroke="#ff7ad9" stroke-width="2"/>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M22 92 L18 70 Q16 58 26 56 L44 54 Q52 54 52 62 L50 72 Q49 80 42 84 L40 92 Z" fill="url(#ga${u})"/>
        <path d="M26 56 L28 46 Q30 42 34 44 L34 55 M34 55 L36 42 Q38 38 42 40 L42 54 M42 54 L44 44 Q46 40 50 42 L49 56" fill="url(#ga${u})"/>
        <path d="M20 70 L50 66" stroke="url(#gr${u})" stroke-width="4"/>
        <path d="M29 76 L37 70 L44 76 L37 82 Z" fill="#ff5ad1" stroke-width="2.2"/>
      </g>
      <circle cx="36" cy="76" r="2" fill="#fff"/>
      ${sparkle(88, 64, 5, '#ffd6f5')}${sparkle(20, 22, 4, '#e0c8ff')}`;
    },
    // ミニガン：回る6本の銃身
    minigun() {
      const u = uid();
      return `<defs>${lg('m' + u, [[0, '#e6ecf5'], [0.5, '#9aa6ba'], [1, '#4a5068']])}${lg('o' + u, [[0, '#ffb13d'], [1, '#d9640c']])}</defs>
      <g transform="rotate(-24 50 52)" stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <rect x="8" y="44" width="26" height="22" rx="5" fill="#4a5068"/>
        <path d="M14 66 L10 84 L22 84 L26 66 Z" fill="url(#o${u})"/>
        <rect x="30" y="38" width="20" height="32" rx="6" fill="url(#o${u})"/>
        <rect x="48" y="40" width="44" height="8" rx="3" fill="url(#m${u})"/>
        <rect x="48" y="50" width="44" height="8" rx="3" fill="url(#m${u})"/>
        <rect x="48" y="60" width="44" height="8" rx="3" fill="url(#m${u})"/>
        <rect x="60" y="37" width="7" height="34" rx="2" fill="#3a3f52"/>
        <rect x="82" y="37" width="7" height="34" rx="2" fill="#3a3f52"/>
        <path d="M18 44 Q24 30 38 38" fill="none" stroke-width="3"/>
        <path d="M33 46 L47 46 M33 54 L47 54 M33 62 L47 62" stroke-width="1.6" opacity=".6"/>
      </g>
      <g fill="#ffe14d" stroke="${O}" stroke-width="1.4"><rect x="70" y="72" width="5" height="9" rx="1.5" transform="rotate(30 72 76)"/><rect x="60" y="80" width="5" height="9" rx="1.5" transform="rotate(10 62 84)"/><rect x="78" y="82" width="5" height="9" rx="1.5" transform="rotate(50 80 86)"/></g>
      ${sparkle(90, 14, 6, '#fff6c2')}`;
    },
    // キマイラ：獅子の頭・ヤギの角・ヘビのしっぽの鎧
    chimera() {
      const u = uid();
      return `<defs>${lg('c' + u, [[0, '#d98a4a'], [0.5, '#9a5a2a'], [1, '#5a2e14']], 0, 0, 1, 1)}${lg('s' + u, [[0, '#8ae07a'], [1, '#2f8a3c']])}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M78 70 Q96 66 92 50 Q88 40 96 34" fill="none" stroke-width="8"/>
        <path d="M78 70 Q96 66 92 50 Q88 40 96 34" fill="none" stroke="url(#s${u})" stroke-width="4.4"/>
        <path d="M93 31 L100 30 L97 37 Z" fill="#8ae07a" stroke-width="2"/>
        <path d="M30 28 Q50 20 70 28 Q76 44 72 56 Q74 70 64 80 Q50 88 36 80 Q26 70 28 56 Q24 44 30 28 Z" fill="url(#c${u})"/>
        <path d="M30 30 Q18 20 14 30 Q12 40 22 44 Q16 52 24 58 L30 52 M70 30 Q82 20 86 30 Q88 40 78 44 Q84 52 76 58 L70 52" fill="#e0a84a"/>
        <path d="M36 26 Q30 10 20 10 Q28 16 30 28 M64 26 Q70 10 80 10 Q72 16 70 28" fill="#efe3c6"/>
        <circle cx="50" cy="48" r="13" fill="#e0a84a"/>
        <path d="M44 46 L46 44 M56 46 L54 44" stroke-width="2.4"/>
        <path d="M46 54 L50 57 L54 54" fill="none" stroke-width="2.4"/>
        <path d="M40 68 Q50 74 60 68 M38 76 Q50 82 62 76" fill="none" stroke-width="2.2"/>
      </g>
      <circle cx="45" cy="47" r="1.8" fill="#ff4a5e"/><circle cx="55" cy="47" r="1.8" fill="#ff4a5e"/>
      ${sparkle(14, 74, 5)}`;
    },
    // ジャケット
    jacket() {
      const u = uid();
      return `<defs>${lg('j' + u, [[0, '#5aa8ff'], [1, '#1f4fa8']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M34 18 L22 24 Q12 30 12 46 L12 76 L24 78 L26 48 L30 84 L70 84 L74 48 L76 78 L88 76 L88 46 Q88 30 78 24 L66 18 Q58 28 50 28 Q42 28 34 18 Z" fill="url(#j${u})"/>
        <path d="M34 18 Q42 34 48 36 L48 84 M66 18 Q58 34 52 36 L52 84" fill="none" stroke-width="2.4"/>
        <path d="M38 20 L46 38 L42 40 L34 26 Z M62 20 L54 38 L58 40 L66 26 Z" fill="#ffd34d" stroke-width="2"/>
        <rect x="30" y="56" width="12" height="9" rx="2" fill="#2f6fd6" stroke-width="2"/><rect x="58" y="56" width="12" height="9" rx="2" fill="#2f6fd6" stroke-width="2"/>
        <path d="M12 70 L24 71 M76 71 L88 70" stroke="#fff" stroke-width="3"/>
      </g>
      <path d="M50 40 L50 82" stroke="#e6ecf5" stroke-width="1.6" stroke-dasharray="2 3"/>
      ${sparkle(88, 18, 5)}`;
    },
    // ウエストセンサー：光るセンサー付きのベルト
    waistSensor() {
      const u = uid();
      return `<defs>${lg('w' + u, [[0, '#4a5068'], [1, '#1d2232']])}${rg('l' + u, [[0, '#d6ffe8'], [0.5, '#3ddc84'], [1, '#0f7a3a']])}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="${STRAP}" fill="url(#w${u})"/>
        <path d="M8 52 Q50 42 84 50" fill="none" stroke="#3ddc84" stroke-width="1.8" stroke-dasharray="4 4"/>
        <rect x="30" y="34" width="34" height="28" rx="7" fill="#c9d4e6"/>
        <rect x="35" y="39" width="24" height="18" rx="4" fill="#0d1320" stroke-width="2"/>
        <circle cx="47" cy="48" r="6" fill="url(#l${u})" stroke-width="1.8"/>
        <path d="M37 52 L41 52 L43 46 L45 54 L47 48 L58 48" fill="none" stroke="#7affc0" stroke-width="1.6"/>
      </g>
      <circle cx="47" cy="48" r="12" fill="#3ddc84" opacity=".18"/>
      ${sparkle(76, 26, 5, '#d6ffe8')}`;
    },
    // レザーベルト
    leatherBelt() {
      const u = uid();
      return `<defs>${lg('b' + u, [[0, '#c98a4a'], [1, '#6b3a17']])}${lg('g' + u, [[0, '#f4f8ff'], [1, '#9aa6ba']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="${STRAP}" fill="url(#b${u})"/>
        <path d="M8 49 Q50 39 84 47 M8 56 Q50 46 84 54" fill="none" stroke="#f2d9a8" stroke-width="1.4" stroke-dasharray="3 3"/>
        <circle cx="74" cy="47.5" r="2.2" fill="${O}" stroke-width="1"/><circle cx="82" cy="49" r="2.2" fill="${O}" stroke-width="1"/>
        <rect x="30" y="34" width="26" height="30" rx="4" fill="none" stroke="url(#g${u})" stroke-width="6"/>
        <rect x="30" y="34" width="26" height="30" rx="4" fill="none"/>
        <rect x="36" y="40" width="14" height="18" rx="2" fill="none" stroke-width="2"/>
        <path d="M43 40 L56 48" stroke="url(#g${u})" stroke-width="4"/>
      </g>
      ${sparkle(70, 24, 5)}`;
    },
    // クローン義足：機械の脚
    cloneLeg() {
      const u = uid();
      return `<defs>${lg('k' + u, [[0, '#f4f8ff'], [0.5, '#b8c6da'], [1, '#6b7a94']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <rect x="36" y="6" width="22" height="26" rx="6" fill="url(#k${u})"/>
        <circle cx="47" cy="36" r="8" fill="#4a5068"/>
        <circle cx="47" cy="36" r="3" fill="#5fe9ff" stroke-width="1.6"/>
        <path d="M42 42 L40 62 L54 62 L52 42 Z" fill="url(#k${u})"/>
        <path d="M44 46 L44 58 M50 46 L50 58" stroke="#5fe9ff" stroke-width="2"/>
        <circle cx="47" cy="66" r="6" fill="#4a5068"/>
        <path d="M36 70 L58 70 L62 76 Q80 76 90 80 L90 86 L32 86 Q30 76 36 70 Z" fill="url(#k${u})"/>
        <path d="M30 88 L92 88" stroke-width="3.4"/>
      </g>
      <path d="M40 10 Q38 20 40 28" stroke="#fff" stroke-width="2.4" opacity=".6" fill="none" stroke-linecap="round"/>
      ${sparkle(80, 52, 5, '#dffcff')}`;
    },
    // ハイブーツ：ひざまである長いブーツ
    highBoots() {
      const u = uid();
      return `<defs>${lg('h' + u, [[0, '#7a3a8a'], [1, '#3a1546']], 0, 0, 1, 1)}${lg('g' + u, [[0, '#fff3a6'], [1, '#d99400']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M32 4 L62 4 L61 52 Q62 60 70 62 L82 65 Q92 68 92 76 L92 82 L32 82 L32 60 Q30 30 32 4 Z" fill="url(#h${u})"/>
        <path d="${BOOT_SOLE}" fill="#1d1426"/>
        <path d="M30 4 L64 4 L62 14 L32 14 Z" fill="url(#g${u})"/>
        <path d="M60 30 L50 34 L60 38 L50 42 L60 46 L50 50" fill="none" stroke="#ffd34d" stroke-width="2"/>
        <path d="M31 84 L93 84" stroke-width="2"/>
        <path d="M86 82 L90 92 L80 92 Z" fill="#9aa6ba" stroke-width="2"/>
      </g>
      <path d="M38 20 Q36 44 38 70" stroke="#fff" stroke-width="2.6" opacity=".35" fill="none" stroke-linecap="round"/>
      ${sparkle(84, 42, 5)}`;
    },
    lightsaber() {
      const u = uid();
      return `<defs>${lg('h' + u, [[0, '#f4f8ff'], [0.5, '#a9b6ca'], [1, '#5d6b82']], 0, 0, 1, 0)}</defs>
      <g transform="rotate(45 50 50)" stroke-linecap="round">
        <line x1="50" y1="7" x2="50" y2="60" stroke="#3fe0ff" stroke-width="17" opacity=".28"/>
        <line x1="50" y1="7" x2="50" y2="60" stroke="#5fe9ff" stroke-width="11" opacity=".6"/>
        <line x1="50" y1="7" x2="50" y2="60" stroke="#f2ffff" stroke-width="5"/>
        <g stroke="${O}" stroke-width="3" stroke-linejoin="round">
          <rect x="43" y="60" width="14" height="31" rx="3" fill="url(#h${u})"/>
          <rect x="40" y="57" width="20" height="7" rx="2.5" fill="#4a5068"/>
          <path d="M43 70 L57 70 M43 76 L57 76 M43 82 L57 82" stroke-width="2.4"/>
          <circle cx="50" cy="66" r="2.4" fill="#ff4a5e" stroke-width="1.5"/>
        </g>
      </g>
      ${sparkle(80, 18, 6)}${sparkle(66, 10, 3.5, '#dffcff')}`;
    },

    revolver() {
      const u = uid();
      return `<defs>${lg('w' + u, [[0, '#d98a4a'], [1, '#7a4220']])}${lg('s' + u, [[0, '#e6ecf5'], [0.5, '#9aa6ba'], [1, '#56607a']])}</defs>
      <g transform="rotate(-20 50 52)" stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M26 54 L40 56 Q35 72 41 86 L23 88 Q12 70 26 54 Z" fill="url(#w${u})"/>
        <path d="M24 62 L36 63 M23 70 L35 71" stroke="#4a2810" stroke-width="1.6"/>
        <path d="M38 57 Q41 70 52 63" fill="none" stroke-width="2.6"/>
        <path d="M22 36 L46 36 L46 57 L26 59 Z" fill="#4a5068"/>
        <rect x="44" y="37" width="50" height="9" rx="2" fill="url(#s${u})"/>
        <rect x="48" y="46" width="30" height="5" rx="2" fill="#3a3f52"/>
        <rect x="88" y="32" width="4" height="6" rx="1" fill="#2b2f3d" stroke-width="2"/>
        <rect x="28" y="34" width="22" height="21" rx="6" fill="url(#s${u})"/>
        <path d="M34 36 L34 53 M40 36 L40 53 M46 36 L46 53" stroke-width="1.8" opacity=".7"/>
        <path d="M22 37 L15 28 L24 31 Z" fill="#4a5068" stroke-width="2.4"/>
      </g>
      ${sparkle(84, 16, 6)}`;
    },

    plateArmor() {
      const u = uid();
      return `<defs>${lg('p' + u, [[0, '#f4f8ff'], [0.45, '#b8c6da'], [1, '#6b7a94']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <ellipse cx="22" cy="37" rx="15" ry="12" fill="url(#p${u})"/>
        <ellipse cx="78" cy="37" rx="15" ry="12" fill="url(#p${u})"/>
        <path d="M12 38 Q22 30 32 38 M68 38 Q78 30 88 38" fill="none" stroke-width="2"/>
        <path d="M30 26 Q50 18 70 26 Q74 40 72 52 Q74 66 66 78 Q50 88 34 78 Q26 66 28 52 Q26 40 30 26 Z" fill="url(#p${u})"/>
        <path d="M40 23 Q50 35 60 23 Q50 20 40 23 Z" fill="#2b2540"/>
        <path d="M37 24 Q50 39 63 24" fill="none" stroke="#f2b33d" stroke-width="3.2"/>
        <path d="M50 38 L50 84" stroke-width="2" opacity=".55"/>
        <path d="M30 61 Q50 69 70 61 M33 71 Q50 79 67 71" fill="none" stroke-width="2.4"/>
        <path d="M50 39 L57 47 L50 55 L43 47 Z" fill="#ff4a5e"/>
        <circle cx="36" cy="38" r="2.2" fill="#eef3fa" stroke-width="1.5"/>
        <circle cx="64" cy="38" r="2.2" fill="#eef3fa" stroke-width="1.5"/>
      </g>
      <path d="M35 32 Q39 28 44 31 Q38 40 37 52 Q33 44 35 32 Z" fill="#fff" opacity=".55"/>
      ${sparkle(85, 18, 5)}`;
    },

    leatherArmor() {
      const u = uid();
      return `<defs>${lg('l' + u, [[0, '#e8a265'], [1, '#93542a']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <rect x="43" y="22" width="14" height="60" fill="#f6e7c8"/>
        <path d="M29 26 L45 21 Q45 50 47 82 L31 82 Q22 60 27 42 Z" fill="url(#l${u})"/>
        <path d="M71 26 L55 21 Q55 50 53 82 L69 82 Q78 60 73 42 Z" fill="url(#l${u})"/>
        <ellipse cx="29" cy="30" rx="9" ry="7" fill="#7a4220"/>
        <ellipse cx="71" cy="30" rx="9" ry="7" fill="#7a4220"/>
        <path d="M46 33 L54 39 M54 33 L46 39 M46 45 L54 51 M54 45 L46 51 M46 57 L54 63 M54 57 L46 63 M46 69 L54 75 M54 69 L46 75" stroke="#5a3216" stroke-width="2.2"/>
        <rect x="31" y="56" width="11" height="11" rx="2" fill="#b86d35" stroke-width="2.4"/>
        <path d="M31 60 L42 60" stroke-width="2"/>
      </g>
      <g fill="none" stroke="#ffd9a8" stroke-width="1.4" stroke-dasharray="3 2.6">
        <path d="M41 27 Q41 52 43 78"/><path d="M59 27 Q59 52 57 78"/>
        <path d="M31 46 Q29 62 34 78"/><path d="M69 46 Q71 62 66 78"/>
      </g>
      ${sparkle(86, 18, 5)}`;
    },

    eternalBoots() {
      const u = uid();
      return `<defs>${lg('e' + u, [[0, '#8ff7ea'], [1, '#169aa6']], 0, 0, 1, 1)}${lg('g' + u, [[0, '#fff2a0'], [1, '#e6a400']])}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M38 26 Q22 10 6 17 Q13 21 15 25 Q3 27 3 37 Q13 35 17 37 Q7 43 9 51 Q21 45 36 46 Z" fill="#fff"/>
        <path d="M14 26 Q24 28 32 33 M12 37 Q24 38 33 40" fill="none" stroke="#9fd8ff" stroke-width="2"/>
        <path d="${BOOT}" fill="url(#e${u})"/>
        <path d="${BOOT_SOLE}" fill="#3a2f5c"/>
        <rect x="31" y="12" width="32" height="10" rx="4" fill="url(#g${u})"/>
        <path d="M61 54 Q66 63 79 66" fill="none" stroke="#fff2a0" stroke-width="3"/>
        <circle cx="47" cy="40" r="6.5" fill="url(#g${u})"/>
        <circle cx="47" cy="40" r="2.6" fill="#5ff0e4" stroke-width="1.5"/>
      </g>
      <path d="M38 28 Q40 46 38 66" stroke="#fff" stroke-width="3" opacity=".45" fill="none" stroke-linecap="round"/>
      ${sparkle(86, 50, 6)}${sparkle(76, 40, 3.5, '#fff', 0.8)}`;
    },

    frostBoots() {
      const u = uid();
      const flake = (x, y, s) => [0, 60, 120].map((a) =>
        `<g transform="rotate(${a} ${x} ${y})"><path d="M${x} ${y - s}L${x} ${y + s}M${x - 3} ${y - s + 3}L${x} ${y - s + 6}L${x + 3} ${y - s + 3}M${x - 3} ${y + s - 3}L${x} ${y + s - 6}L${x + 3} ${y + s - 3}"/></g>`).join('');
      return `<defs>${lg('f' + u, [[0, '#f4feff'], [0.5, '#8fd2f7'], [1, '#3f86d6']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="${BOOT}" fill="url(#f${u})"/>
        <path d="${BOOT_SOLE}" fill="#2f4a7a"/>
        <path d="M30 20 L33 6 L38 16 L43 2 L48 15 L53 5 L57 16 L62 8 L64 20 Z" fill="#e3f7ff"/>
        <path d="M66 63 L70 52 L74 63 M78 66 L83 57 L86 67" fill="#e3f7ff"/>
      </g>
      <g stroke="#2a6bb8" stroke-width="4.6" stroke-linecap="round" fill="none">${flake(47, 44, 10)}</g>
      <g stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none">${flake(47, 44, 10)}</g>
      <circle cx="16" cy="40" r="2.4" fill="#cdefff"/><circle cx="20" cy="56" r="1.8" fill="#cdefff"/>
      ${sparkle(14, 26, 5, '#e8f9ff')}${sparkle(88, 46, 5, '#fff')}`;
    },

    stellaBelt() {
      const u = uid();
      return `<defs>${lg('n' + u, [[0, '#6c71ea'], [1, '#262a7a']])}${lg('g' + u, [[0, '#fff3a6'], [1, '#e2a000']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="${STRAP}" fill="url(#n${u})"/>
        <ellipse cx="74" cy="48" rx="2" ry="2.6" fill="${O}" stroke-width="1"/>
        <ellipse cx="82" cy="49.5" rx="2" ry="2.6" fill="${O}" stroke-width="1"/>
        <polygon points="${starPts(40, 48, 24, 10.5)}" fill="url(#g${u})"/>
        <polygon points="${starPts(40, 48.5, 11, 5)}" fill="#fff8cf" stroke-width="1.8"/>
        <circle cx="40" cy="49" r="3.2" fill="#7fe3ff" stroke-width="1.5"/>
        <polygon points="${starPts(13, 51, 5, 2.2)}" fill="#ffe27a" stroke-width="1.4"/>
        <polygon points="${starPts(64, 45.5, 5, 2.2)}" fill="#ffe27a" stroke-width="1.4"/>
      </g>
      ${sparkle(70, 26, 6)}${sparkle(20, 30, 4, '#fff8cf')}${sparkle(84, 66, 3.5, '#fff', 0.8)}`;
    },

    eternalBelt() {
      const u = uid();
      return `<defs>${lg('r' + u, [[0, '#ff6b7f'], [1, '#8f1d38']])}${lg('g' + u, [[0, '#fff3a6'], [1, '#d99400']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="${STRAP}" fill="url(#r${u})"/>
        <circle cx="12" cy="51.5" r="2.4" fill="#ffd34d" stroke-width="1.4"/>
        <circle cx="21" cy="49.5" r="2.4" fill="#ffd34d" stroke-width="1.4"/>
        <circle cx="72" cy="47" r="2.4" fill="#ffd34d" stroke-width="1.4"/>
        <circle cx="80" cy="48.5" r="2.4" fill="#ffd34d" stroke-width="1.4"/>
        <rect x="29" y="33" width="38" height="31" rx="8" fill="url(#g${u})"/>
        <rect x="34" y="38" width="28" height="21" rx="5" fill="#fff4bf" stroke-width="2"/>
        <path d="M40 48.5 C40 42.5 46 42.5 48 48.5 C50 54.5 56 54.5 56 48.5 C56 42.5 50 42.5 48 48.5 C46 54.5 40 54.5 40 48.5 Z" fill="none" stroke="#b3123a" stroke-width="3.4"/>
      </g>
      <path d="M33 36 L40 36" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
      ${sparkle(76, 24, 6)}${sparkle(22, 30, 4, '#ffe3e8')}`;
    },

    eternalSuit() {
      const u = uid();
      return `<defs>${lg('s' + u, [[0, '#ffffff'], [0.55, '#cfe9ff'], [1, '#7fb3e6']], 0, 0, 1, 1)}${lg('c' + u, [[0, '#7ff7ea'], [1, '#1aa6b8']])}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M14 30 Q8 18 22 12 L36 18 Q30 26 30 36 Z" fill="url(#c${u})"/>
        <path d="M86 30 Q92 18 78 12 L64 18 Q70 26 70 36 Z" fill="url(#c${u})"/>
        <path d="M32 16 Q50 24 68 16 L72 40 Q74 62 66 86 L34 86 Q26 62 28 40 Z" fill="url(#s${u})"/>
        <path d="M42 16 Q50 26 58 16 L56 22 Q50 30 44 22 Z" fill="#2b2f45"/>
        <path d="M50 30 L50 84" stroke-width="2"/>
        <path d="M34 50 Q50 58 66 50 L66 58 Q50 66 34 58 Z" fill="#ffd23d"/>
        <circle cx="50" cy="40" r="5.5" fill="#4fe0ff"/>
      </g>
      <path d="M38 28 Q36 46 40 70 M62 28 Q64 46 60 70" fill="none" stroke="#4fe0ff" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M34 26 Q38 22 44 24" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
      ${sparkle(86, 54, 6)}${sparkle(14, 56, 4, '#dffcff')}`;
    },

    destroyerCoat() {
      const u = uid();
      return `<defs>${lg('k' + u, [[0, '#4a4060'], [1, '#17121f']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M18 26 L8 14 L24 20 Z M82 26 L92 14 L76 20 Z M24 22 L18 8 L32 18 Z M76 22 L82 8 L68 18 Z" fill="#cfd4e0" stroke-width="2.4"/>
        <path d="M26 20 Q50 12 74 20 Q84 30 80 50 L86 92 L58 88 L50 64 L42 88 L14 92 L20 50 Q16 30 26 20 Z" fill="url(#k${u})"/>
        <path d="M40 18 L50 46 L60 18" fill="#d6264a"/>
        <path d="M36 20 L44 48 L36 52 L30 26 Z M64 20 L56 48 L64 52 L70 26 Z" fill="#2b2540"/>
        <path d="M24 60 L40 60 M60 60 L76 60" stroke="#d6264a" stroke-width="3"/>
        <circle cx="50" cy="56" r="3" fill="#ffd23d" stroke-width="1.6"/>
        <circle cx="50" cy="68" r="3" fill="#ffd23d" stroke-width="1.6"/>
      </g>
      <path d="M28 30 Q24 50 26 70" stroke="#fff" stroke-width="2.4" opacity=".25" fill="none" stroke-linecap="round"/>
      ${sparkle(86, 40, 5, '#ffb3c0')}`;
    },

    destroyerBelt() {
      const u = uid();
      return `<defs>${lg('d' + u, [[0, '#4a4060'], [1, '#17121f']])}${lg('m' + u, [[0, '#e6ecf5'], [1, '#7a8296']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="${STRAP}" fill="url(#d${u})"/>
        <path d="M10 46 L13 36 L17 46 M22 44 L25 34 L29 44 M68 42 L71 32 L75 42 M80 44 L84 34 L87 45" fill="url(#m${u})" stroke-width="2.2"/>
        <path d="M30 34 L66 34 L70 48 L66 64 L30 64 L26 48 Z" fill="url(#m${u})"/>
        <path d="M38 40 Q48 32 58 40 Q60 50 54 54 L54 58 L42 58 L42 54 Q36 50 38 40 Z" fill="#f2efe4" stroke-width="2.4"/>
      </g>
      <circle cx="44" cy="45" r="3" fill="#ff2a4a"/><circle cx="52" cy="45" r="3" fill="#ff2a4a"/>
      <path d="M45 54 L45 58 M48 54 L48 58 M51 54 L51 58" stroke="${O}" stroke-width="1.4"/>
      ${sparkle(80, 24, 5, '#ffb3c0')}`;
    },

    fashionBelt() {
      const u = uid();
      return `<defs>${lg('f' + u, [[0, '#ffb0e6'], [1, '#e0489e']])}${lg('h' + u, [[0, '#fff3a6'], [1, '#e2a000']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="${STRAP}" fill="url(#f${u})"/>
        <path d="M58 46 Q70 30 80 36 Q82 44 66 50 Q82 54 82 64 Q70 68 58 52 Z" fill="#ff7ad9" stroke-width="2.4"/>
        <path d="M44 66 Q26 54 26 42 Q26 32 35 32 Q41 32 44 38 Q47 32 53 32 Q62 32 62 42 Q62 54 44 66 Z" fill="url(#h${u})"/>
        <path d="M44 58 Q33 50 33 43 Q33 38 37 38 Q41 38 44 43 Q47 38 51 38 Q55 38 55 43 Q55 50 44 58 Z" fill="#ff4a8a" stroke-width="2"/>
      </g>
      <circle cx="12" cy="52" r="3" fill="#7fe3ff" stroke="${O}" stroke-width="1.4"/><circle cx="20" cy="50" r="3" fill="#fff" stroke="${O}" stroke-width="1.4"/>
      <circle cx="40" cy="42" r="2" fill="#fff" opacity=".9"/>
      ${sparkle(80, 22, 6, '#fff')}${sparkle(20, 30, 4, '#ffe0f4')}`;
    },

    destroyerFoot() {
      const u = uid();
      return `<defs>${lg('a' + u, [[0, '#6b6080'], [1, '#1b1428']], 0, 0, 1, 1)}${lg('m' + u, [[0, '#e6ecf5'], [1, '#7a8296']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="${BOOT}" fill="url(#a${u})"/>
        <path d="${BOOT_SOLE}" fill="#2b1f3a"/>
        <path d="M30 16 L64 16 L62 26 L32 26 Z" fill="url(#m${u})"/>
        <path d="M34 34 L22 28 L34 42 Z M34 50 L20 46 L34 58 Z" fill="url(#m${u})" stroke-width="2.4"/>
        <path d="M62 56 L68 46 L72 60 Z M76 64 L82 54 L86 66 Z" fill="url(#m${u})" stroke-width="2.2"/>
        <path d="M38 34 L58 34 M38 44 L58 44" stroke="#ff2a4a" stroke-width="2.6"/>
      </g>
      <circle cx="48" cy="56" r="4.5" fill="#ff2a4a" stroke="${O}" stroke-width="2"/>
      <circle cx="47" cy="55" r="1.5" fill="#ffd0d8"/>
      ${sparkle(86, 40, 5, '#ffb3c0')}`;
    },

    militaryBoots() {
      const u = uid();
      return `<defs>${lg('o' + u, [[0, '#9aa86a'], [1, '#4f5a2e']], 0, 0, 1, 1)}</defs>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
        <path d="M33 8 L60 8 L61 52 Q62 60 70 62 L82 65 Q92 68 92 76 L92 82 L32 82 L32 60 Q31 34 33 8 Z" fill="url(#o${u})"/>
        <path d="${BOOT_SOLE}" fill="#3a2a1a"/>
        <path d="M29 84 L95 84" stroke-width="2"/>
        <path d="M38 18 L56 24 M56 18 L38 24 M38 30 L56 36 M56 30 L38 36 M38 42 L56 48 M56 42 L38 48" stroke="#f2e6c0" stroke-width="2.2"/>
        <rect x="31" y="6" width="31" height="7" rx="3" fill="#6b7a3e"/>
        <path d="M62 60 Q70 66 82 68" fill="none" stroke-width="2"/>
      </g>
      <path d="M36 54 Q38 66 36 76" stroke="#fff" stroke-width="2.6" opacity=".3" fill="none" stroke-linecap="round"/>
      ${sparkle(84, 40, 5)}`;
    },
  };

  function item(itemKey, cls = 'item-art') {
    const f = ITEM_ART[itemKey];
    return f ? svg('0 0 100 100', f(), cls) : '';
  }

  /* ---------------------------------------------------------
   *  プレイヤーキャラ（ちびキャラ）
   * --------------------------------------------------------- */
  function heroBody(color, hair = '#4a2e1f') {
    return `<ellipse cx="60" cy="133" rx="30" ry="6" fill="#000" opacity=".22"/>
    <g stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <rect x="46" y="106" width="11" height="21" rx="4" fill="#3b3f63"/>
      <rect x="63" y="106" width="11" height="21" rx="4" fill="#3b3f63"/>
      <ellipse cx="50" cy="128" rx="9.5" ry="5.5" fill="#2a2140"/>
      <ellipse cx="70" cy="128" rx="9.5" ry="5.5" fill="#2a2140"/>
      <ellipse cx="33" cy="95" rx="7" ry="12" fill="${color}" transform="rotate(14 33 95)"/>
      <ellipse cx="87" cy="95" rx="7" ry="12" fill="${color}" transform="rotate(-14 87 95)"/>
      <circle cx="31" cy="107" r="6" fill="#ffd9b8"/>
      <circle cx="89" cy="107" r="6" fill="#ffd9b8"/>
      <path d="M38 84 Q60 74 82 84 L84 112 Q60 118 36 112 Z" fill="${color}"/>
      <path d="M37 103 Q60 108 83 103 L83 110 Q60 115 37 110 Z" fill="#2a2140"/>
      <rect x="55" y="102" width="10" height="9" rx="2" fill="#ffd34d" stroke-width="2"/>
      <path d="M92 41 L110 33 L105 45 L113 52 L94 48 Z" fill="${color}"/>
      <circle cx="60" cy="50" r="34" fill="#ffd9b8"/>
      <path d="M26 52 Q22 16 60 13 Q98 16 94 52 Q89 35 78 33 Q70 41 56 37 Q44 43 34 37 Q28 43 26 52 Z" fill="${hair}"/>
      <path d="M27 40 Q60 25 93 40 L92 48 Q60 34 28 48 Z" fill="${color}"/>
    </g>
    <ellipse cx="47" cy="57" rx="4.6" ry="6.4" fill="${O}"/>
    <ellipse cx="73" cy="57" rx="4.6" ry="6.4" fill="${O}"/>
    <circle cx="48.6" cy="54.6" r="1.8" fill="#fff"/><circle cx="74.6" cy="54.6" r="1.8" fill="#fff"/>
    <ellipse cx="38" cy="67" rx="5.5" ry="3.2" fill="#ff8f9a" opacity=".6"/>
    <ellipse cx="82" cy="67" rx="5.5" ry="3.2" fill="#ff8f9a" opacity=".6"/>
    <path d="M54 68 Q60 74 66 68" fill="none" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M38 41 Q60 31 82 41" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>`;
  }
  function hero(color = '#ff5a5f', cls = 'hero-art') { return svg('0 0 120 140', heroBody(color), cls); }
  function heroFace(color = '#ff5a5f', cls = 'face-art') { return svg('22 12 80 80', heroBody(color), cls); }

  const foe = (...a) => (DS.art.foeInline ? DS.art.foeInline(...a) : '');
  const cloud = (x, y, s = 1, c = '#fff', op = 0.95) =>
    `<g transform="translate(${x} ${y}) scale(${s})" fill="${c}" opacity="${op}"><circle cx="0" cy="0" r="12"/><circle cx="14" cy="-6" r="15"/><circle cx="30" cy="0" r="11"/><rect x="0" y="-2" width="30" height="13" rx="6"/></g>`;
  const tree = (x, y, s = 1, c = '#2f9e44') =>
    `<g transform="translate(${x} ${y}) scale(${s})" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"><rect x="-4" y="-16" width="8" height="16" rx="2" fill="#8a5a2b"/><circle cx="0" cy="-28" r="16" fill="${c}"/><circle cx="-10" cy="-20" r="10" fill="${c}"/><circle cx="10" cy="-20" r="10" fill="${c}"/><circle cx="-5" cy="-33" r="4" fill="#fff" stroke="none" opacity=".35"/></g>`;
  const pine = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"><rect x="-3" y="-8" width="6" height="8" fill="#6b4423"/><path d="M0 -50 L14 -26 L8 -26 L18 -8 L-18 -8 L-8 -26 L-14 -26 Z" fill="#2e7d5b"/><path d="M0 -50 L7 -38 Q0 -34 -7 -38 Z M-9 -26 Q0 -22 9 -26 L12 -20 Q0 -16 -12 -20 Z" fill="#fff" stroke="none"/></g>`;
  const cactus = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})" stroke="${O}" stroke-width="2.4" stroke-linejoin="round" fill="#43b05c"><rect x="-6" y="-40" width="12" height="40" rx="6"/><path d="M-6 -20 L-14 -20 Q-18 -20 -18 -24 L-18 -32" fill="none" stroke-width="7" stroke="${O}"/><path d="M-6 -20 L-14 -20 Q-18 -20 -18 -24 L-18 -32" fill="none" stroke-width="3.6" stroke="#43b05c"/><path d="M6 -26 L13 -26 Q17 -26 17 -30 L17 -36" fill="none" stroke-width="7" stroke="${O}"/><path d="M6 -26 L13 -26 Q17 -26 17 -30 L17 -36" fill="none" stroke-width="3.6" stroke="#43b05c"/></g>`;

  /* ---------------------------------------------------------
   *  ステージイラスト（viewBox 0 0 360 200）
   * --------------------------------------------------------- */
  const STAGE_ART = {
    meadow(u) {
      return `<defs>${lg('sky' + u, [[0, '#6fcdfd'], [1, '#d8f5ff']])}${rg('sun' + u, [[0, '#fff6b0'], [0.6, '#ffe066'], [1, '#ffe066', 0]])}</defs>
      <rect width="360" height="200" fill="url(#sky${u})"/>
      <circle cx="300" cy="44" r="40" fill="url(#sun${u})"/><circle cx="300" cy="44" r="20" fill="#ffe066" stroke="${O}" stroke-width="2.4"/>
      ${cloud(40, 40, 1.1)}${cloud(170, 28, 0.8)}${cloud(240, 70, 0.6, '#fff', 0.8)}
      <path d="M0 118 Q60 78 130 110 Q200 70 270 104 Q320 86 360 98 L360 200 L0 200 Z" fill="#82d86c"/>
      ${tree(46, 122, 0.9, '#3cb44b')}${tree(318, 116, 1, '#2f9e44')}${tree(286, 120, 0.7, '#3cb44b')}
      <path d="M0 150 Q90 120 180 146 Q270 122 360 150 L360 200 L0 200 Z" fill="#4fb24a" stroke="${O}" stroke-width="2.4"/>
      <path d="M150 200 Q170 170 200 160 Q240 150 260 140 L272 142 Q250 158 214 168 Q186 178 176 200 Z" fill="#f2d48c" opacity=".9"/>
      <g fill="#ff6b8a"><circle cx="70" cy="170" r="3"/><circle cx="96" cy="182" r="3"/><circle cx="300" cy="176" r="3"/></g>
      <g fill="#ffe066"><circle cx="82" cy="160" r="2.6"/><circle cx="316" cy="188" r="2.6"/><circle cx="40" cy="186" r="2.6"/></g>
      ${foe('wolf', 92, 150, 40)}${foe('mageZombie', 284, 172, 52, true)}${foe('zombie', 132, 182, 62)}${foe('wolf', 222, 192, 50, true)}`;
    },
    desert(u) {
      return `<defs>${lg('sky' + u, [[0, '#ff9f5a'], [1, '#ffe2a1']])}${rg('sun' + u, [[0, '#fff6c8'], [0.5, '#ffd25a'], [1, '#ffb347', 0]])}</defs>
      <rect width="360" height="200" fill="url(#sky${u})"/>
      <circle cx="96" cy="64" r="56" fill="url(#sun${u})"/><circle cx="96" cy="64" r="26" fill="#ffd25a" stroke="${O}" stroke-width="2.4"/>
      <path d="M210 120 L262 52 L314 120 Z" fill="#f2b45a" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M262 52 L314 120 L278 120 Z" fill="#d98f3a"/><path d="M230 96 L294 96 M244 78 L280 78" stroke="${O}" stroke-width="1.6" opacity=".4"/>
      <path d="M0 128 Q80 100 170 124 Q260 104 360 124 L360 200 L0 200 Z" fill="#f6c76b"/>
      ${cactus(40, 140, 1)}${cactus(330, 136, 0.8)}
      <path d="M0 158 Q120 132 220 160 Q300 146 360 156 L360 200 L0 200 Z" fill="#eaa84a" stroke="${O}" stroke-width="2.4"/>
      <g stroke="${O}" stroke-width="1.8" fill="#fff8e7"><circle cx="300" cy="182" r="6"/><rect x="292" y="186" width="16" height="4" rx="2"/></g>
      <circle cx="298" cy="181" r="1.6" fill="${O}"/><circle cx="303" cy="181" r="1.6" fill="${O}"/>
      ${foe('mageZombie', 186, 160, 40, true)}${foe('zombie', 140, 184, 58)}${foe('armorSkeleton', 232, 182, 56, true)}${foe('fireWolf', 82, 192, 44)}`;
    },
    snow(u) {
      return `<defs>${lg('sky' + u, [[0, '#8fcaf5'], [1, '#eaf7ff']])}</defs>
      <rect width="360" height="200" fill="url(#sky${u})"/>
      <path d="M-10 130 L70 46 L120 100 L180 34 L260 112 L300 70 L370 130 Z" fill="#9ab4d6" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M70 46 L88 66 L78 64 L68 72 L58 60 Z M180 34 L202 56 L188 54 L178 64 L164 52 Z M300 70 L314 84 L304 82 L296 88 L288 82 Z" fill="#fff"/>
      ${pine(30, 146, 0.9)}${pine(60, 150, 0.7)}${pine(326, 146, 1)}${pine(296, 150, 0.7)}
      <path d="M0 146 Q90 128 180 144 Q270 128 360 146 L360 200 L0 200 Z" fill="#f4fbff" stroke="${O}" stroke-width="2.4"/>
      <path d="M200 170 Q240 162 290 168 Q260 178 210 176 Z" fill="#bfe6ff"/>
      <g fill="#fff">${[[30, 30], [90, 20], [140, 70], [220, 30], [260, 90], [330, 30], [20, 100], [120, 120], [350, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</g>
      ${foe('iceWolf', 250, 178, 44, true)}${foe('iceWolf', 104, 188, 50)}${foe('armorSkeleton', 172, 186, 60)}`;
    },
    volcano(u) {
      return `<defs>${lg('sky' + u, [[0, '#3b1030'], [0.7, '#c2402f'], [1, '#ff8a3d']])}${lg('lava' + u, [[0, '#ffe066'], [1, '#ff5a1f']])}</defs>
      <rect width="360" height="200" fill="url(#sky${u})"/>
      <path d="M150 34 Q160 14 176 24 Q186 6 202 20 Q218 12 222 32 Z" fill="#5b3a4a" opacity=".85"/>
      <path d="M90 150 L160 52 L210 52 L290 150 Z" fill="#4a2a35" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M160 52 L210 52 L204 60 Q186 56 166 60 Z" fill="url(#lava${u})"/>
      <path d="M176 56 Q170 90 182 110 Q190 130 176 150 L196 150 Q206 126 196 104 Q188 84 194 56 Z" fill="url(#lava${u})" stroke="${O}" stroke-width="2"/>
      <path d="M0 150 Q90 136 180 150 Q270 136 360 150 L360 200 L0 200 Z" fill="#2e1b26" stroke="${O}" stroke-width="2.4"/>
      <path d="M0 176 Q60 168 110 178 Q150 186 200 176 L200 182 Q150 192 110 184 Q60 174 0 182 Z" fill="url(#lava${u})"/>
      <g stroke="${O}" stroke-width="2" fill="#5a3a45"><path d="M300 160 L316 146 L334 158 L326 168 Z"/><path d="M30 156 L44 146 L58 160 Z"/></g>
      <g fill="#ffb347">${[[60, 60], [120, 90], [250, 70], [300, 110], [330, 40], [40, 120]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`).join('')}</g>
      ${foe('mageZombie', 126, 172, 56)}${foe('armorSkeleton', 250, 178, 60, true)}${foe('wolf', 318, 194, 40, true)}`;
    },
    ruins(u) {
      const win = (x, y) => `<rect x="${x}" y="${y}" width="6" height="8" fill="#ffe27a"/>`;
      return `<defs>${lg('sky' + u, [[0, '#1b1242'], [1, '#6b3fa4']])}${rg('moon' + u, [[0, '#fff8d6'], [0.55, '#fff3c4', 0.6], [1, '#fff3c4', 0]])}</defs>
      <rect width="360" height="200" fill="url(#sky${u})"/>
      <g fill="#fff">${[[20, 20], [70, 50], [120, 16], [200, 40], [240, 14], [340, 60], [160, 70], [30, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4"/>`).join('')}</g>
      <circle cx="286" cy="50" r="46" fill="url(#moon${u})"/><circle cx="286" cy="50" r="22" fill="#fff3c4" stroke="${O}" stroke-width="2.4"/>
      <circle cx="279" cy="44" r="4" fill="#efdca0"/><circle cx="292" cy="58" r="3" fill="#efdca0"/>
      <g stroke="${O}" stroke-width="2.4" stroke-linejoin="round" fill="#2c2350">
        <path d="M14 150 L14 70 L30 64 L38 74 L54 66 L54 150 Z"/>
        <path d="M70 150 L70 92 L96 92 L102 84 L110 96 L110 150 Z"/>
        <path d="M236 150 L236 80 L252 72 L262 86 L276 78 L276 150 Z"/>
        <path d="M300 150 L300 104 L340 98 L348 110 L348 150 Z"/>
      </g>
      ${win(22, 84)}${win(38, 100)}${win(22, 118)}${win(80, 104)}${win(244, 96)}${win(260, 116)}${win(312, 118)}${win(330, 112)}
      <path d="M150 60 l-8 -4 l-4 4 l4 2 l-6 6 l8 -4 l6 4 l6 -4 l8 4 l-6 -6 l4 -2 l-4 -4 l-8 4 Z" fill="${O}"/>
      <path d="M200 90 l-6 -3 l-3 3 l3 1.5 l-4.5 4.5 l6 -3 l4.5 3 l4.5 -3 l6 3 l-4.5 -4.5 l3 -1.5 l-3 -3 l-6 3 Z" fill="${O}"/>
      <path d="M0 150 Q90 136 180 150 Q270 136 360 150 L360 200 L0 200 Z" fill="#3a2f5c" stroke="${O}" stroke-width="2.4"/>
      <g stroke="${O}" stroke-width="2" fill="#7a6f9a"><path d="M40 176 L40 162 Q48 154 56 162 L56 176 Z"/><path d="M300 180 L300 168 Q306 162 312 168 L312 180 Z"/></g>
      ${foe('armorSkeleton', 282, 168, 46, true)}${foe('zombie', 140, 180, 58)}${foe('mageZombie', 222, 188, 58, true)}`;
    },
  };

  function stage(key, cls = 'stage-art') {
    const f = STAGE_ART[key];
    return f ? svg('0 0 360 200', f(uid()), cls) : '';
  }

  /* ---------------------------------------------------------
   *  ガチャの宝箱（viewBox 0 0 220 190）
   * --------------------------------------------------------- */
  function chest(cls = 'chest-art') {
    const u = uid();
    const rays = Array.from({ length: 12 }, (_, i) =>
      `<path d="M110 100 L${110 + Math.cos((i * 30 - 6) * Math.PI / 180) * 200} ${100 + Math.sin((i * 30 - 6) * Math.PI / 180) * 200} L${110 + Math.cos((i * 30 + 6) * Math.PI / 180) * 200} ${100 + Math.sin((i * 30 + 6) * Math.PI / 180) * 200} Z"/>`).join('');
    return svg('0 0 220 190', `<defs>
        ${lg('w' + u, [[0, '#c9773b'], [1, '#7a3f1d']])}${lg('g' + u, [[0, '#fff2a0'], [1, '#e09a00']])}
        ${rg('glow' + u, [[0, '#fff7c2', 0.95], [0.5, '#ffd34d', 0.5], [1, '#ffd34d', 0]])}
        <clipPath id="lid${u}"><path d="M40 96 L40 76 Q40 40 110 37 Q180 40 180 76 L180 96 Z"/></clipPath>
      </defs>
      <g class="chest-rays" fill="#fff6c2" opacity=".35">${rays}</g>
      <circle class="chest-glow" cx="110" cy="96" r="90" fill="url(#glow${u})"/>
      <g stroke="${O}" stroke-width="4" stroke-linejoin="round">
        <rect x="40" y="92" width="140" height="74" rx="8" fill="url(#w${u})"/>
        <path d="M44 128 L176 128" stroke-width="2.4" opacity=".5"/>
        <rect x="58" y="92" width="16" height="74" fill="url(#g${u})" stroke-width="3"/>
        <rect x="146" y="92" width="16" height="74" fill="url(#g${u})" stroke-width="3"/>
        <rect x="36" y="156" width="148" height="12" rx="5" fill="url(#g${u})" stroke-width="3"/>
      </g>
      <g class="chest-lid">
        <path d="M40 96 L40 76 Q40 40 110 37 Q180 40 180 76 L180 96 Z" fill="url(#w${u})" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
        <g clip-path="url(#lid${u})" fill="url(#g${u})" stroke="${O}" stroke-width="3">
          <rect x="58" y="30" width="16" height="70"/><rect x="146" y="30" width="16" height="70"/>
        </g>
        <path d="M52 62 Q110 46 168 62" fill="none" stroke="#fff" stroke-width="3" opacity=".3" stroke-linecap="round"/>
        <rect x="36" y="88" width="148" height="12" rx="5" fill="url(#g${u})" stroke="${O}" stroke-width="3"/>
        <circle cx="110" cy="58" r="7" fill="#ff4a8a" stroke="${O}" stroke-width="2.6"/>
        <circle cx="108" cy="56" r="2" fill="#fff"/>
      </g>
      <g stroke="${O}" stroke-width="3" stroke-linejoin="round">
        <rect x="95" y="86" width="30" height="32" rx="7" fill="url(#g${u})"/>
        <circle cx="110" cy="99" r="4.6" fill="${O}" stroke="none"/><path d="M107.5 101 L112.5 101 L111.5 110 L108.5 110 Z" fill="${O}" stroke="none"/>
      </g>
      ${sparkle(30, 70, 8)}${sparkle(196, 54, 7)}${sparkle(186, 130, 5, '#fff7c2')}${sparkle(24, 140, 5, '#fff7c2')}`, cls);
  }

  /* ---------------------------------------------------------
   *  小物アイコン
   * --------------------------------------------------------- */
  function coin(cls = 'coin-art') {
    const u = uid();
    return svg('0 0 32 32', `<defs>${lg('c' + u, [[0, '#fff3a0'], [0.5, '#ffd23d'], [1, '#e09a00']], 0, 0, 1, 1)}</defs>
      <circle cx="16" cy="16" r="13.5" fill="url(#c${u})" stroke="#8a5500" stroke-width="2"/>
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="#b87800" stroke-width="1.6" opacity=".7"/>
      <polygon points="${starPts(16, 16.5, 6, 2.6)}" fill="#fff6c2" stroke="#b87800" stroke-width="1"/>`, cls);
  }

  /* 設計図（右下の丸の色と印で種類が分かる） */
  const BP_COL = { weapon: '#ff7a59', armor: '#3ccf8a', belt: '#ffc23d', boots: '#a77bff', random: '#ff5aa8' };
  const BP_GLYPH = {
    weapon: 'M27.6 20.8 L29.2 22.4 L24.2 27.4 L22.6 25.8 Z M21.2 25.2 L24.8 28.8 L23.8 29.8 L20.2 26.2 Z',
    armor: 'M25 20.6 L29 22 Q29 26.6 25 29.4 Q21 26.6 21 22 Z',
    belt: 'M20.2 23.4 H29.8 V26.6 H20.2 Z M23.4 22.2 H26.6 V27.8 H23.4 Z',
    boots: 'M21.6 20.8 H25.2 V25 H29.2 V28.6 H21.6 Z',
  };
  function blueprint(slot = 'random', cls = 'bp-art') {
    const c = BP_COL[slot] || BP_COL.random;
    return svg('0 0 32 32', `
      <path d="M4 4 H22 L26 8 V27 H4 Z" fill="#3d7fe0" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M22 4 V8 H26" fill="#9cc8ff" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M7 10 H23 M7 14 H23 M7 18 H23 M7 22 H23 M10 6 V25 M15 6 V25 M20 6 V25" stroke="#9cc8ff" stroke-width=".8" opacity=".6"/>
      <path d="M8 21 L13 11 L18 21 Z M13 11 V21" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="25" cy="25" r="6.4" fill="${c}" stroke="${O}" stroke-width="1.8"/>
      ${slot === 'random' || !BP_GLYPH[slot] ? '<text x="25" y="28.6" text-anchor="middle" font-size="9.5" font-weight="900" fill="#fff" font-family="sans-serif">?</text>' : `<path d="${BP_GLYPH[slot]}" fill="#fff" stroke="${O}" stroke-width=".6"/>`}`, cls);
  }
  /* エッセンス（キャラのレベルアップ素材） */
  function essence(cls = 'ess-art') {
    const u = uid();
    return svg('0 0 32 32', `<defs>${lg('es' + u, [[0, '#f0dcff'], [0.5, '#b56cff'], [1, '#6a2bd0']], 0, 0, 1, 1)}</defs>
      <path d="M16 2 L26 13 L16 30 L6 13 Z" fill="url(#es${u})" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M16 2 L19.5 13 L16 30 L12.5 13 Z" fill="#fff" opacity=".45"/><path d="M6 13 H26" stroke="${O}" stroke-width="1.6"/>
      ${sparkle(26, 5, 3.4, '#fff')}`, cls);
  }
  /* エピック装備選択BOX */
  function epicBox(cls = 'tool-art', sGear) {
    const u = uid();
    if (sGear) {
      return svg('0 0 48 48', `<defs>${lg('eb' + u, [[0, '#d39bff'], [1, '#7a2fd6']])}${lg('es' + u, [[0, '#fff6b0'], [0.5, '#ffd23d'], [1, '#c77a00']])}</defs>
      <g stroke="${O}" stroke-width="2.6" stroke-linejoin="round">
        <rect x="7" y="20" width="34" height="22" rx="3" fill="url(#eb${u})"/>
        <rect x="5" y="13" width="38" height="9" rx="3" fill="url(#es${u})"/>
        <rect x="21" y="13" width="6" height="29" fill="url(#es${u})" stroke-width="2"/>
        <path d="M24 13 Q15 3 12 9 Q12 14 24 13 Q33 3 36 9 Q36 14 24 13 Z" fill="#ffe066" stroke-width="2.2"/>
      </g>
      <text x="14" y="38" text-anchor="middle" font-size="14" font-weight="900" font-style="italic" font-family="sans-serif" fill="#ffe066" stroke="${O}" stroke-width="1.4" paint-order="stroke">S</text>
      ${sparkle(41, 8, 4.5)}${sparkle(6, 10, 3.5, '#fff6c2')}`, cls);
    }
    return svg('0 0 48 48', `<defs>${lg('eb' + u, [[0, '#d39bff'], [1, '#7a2fd6']])}</defs>
      <g stroke="${O}" stroke-width="2.6" stroke-linejoin="round">
        <rect x="7" y="20" width="34" height="22" rx="3" fill="url(#eb${u})"/>
        <rect x="5" y="13" width="38" height="9" rx="3" fill="#c07bff"/>
        <rect x="21" y="13" width="6" height="29" fill="#ffe066" stroke-width="2"/>
        <path d="M24 13 Q15 3 12 9 Q12 14 24 13 Q33 3 36 9 Q36 14 24 13 Z" fill="#ffe066" stroke-width="2.2"/>
      </g>
      <polygon points="${starPts(14, 31, 4.6, 2)}" fill="#fff" opacity=".9"/>${sparkle(41, 8, 4.5)}`, cls);
  }

  const NAV = {
    shop() {
      return `<g stroke="${O}" stroke-width="2.6" stroke-linejoin="round">
        <rect x="8" y="22" width="32" height="20" rx="3" fill="#ffe7b0"/>
        <rect x="19" y="29" width="10" height="13" fill="#8a5a33"/>
        <path d="M5 21 L10 7 H38 L43 21 Z" fill="#ff5a6e"/>
        <path d="M5 21 Q9.5 27 14 21 Q18.5 27 23 21 Q27.5 27 32 21 Q36.5 27 43 21" fill="#ff5a6e"/>
        <path d="M17 7 L15 21 M24 7 V21 M31 7 L33 21" stroke="#fff" stroke-width="3"/>
      </g><circle cx="38" cy="38" r="8" fill="#ffd34d" stroke="${O}" stroke-width="2.4"/><polygon points="${starPts(38, 38.4, 4.4, 1.9)}" fill="#fff6c2"/>`;
    },
    gacha() {
      const u = uid();
      return `<defs>${lg('w' + u, [[0, '#ff9a5a'], [1, '#c4502a']])}</defs>
      <g stroke="${O}" stroke-width="2.6" stroke-linejoin="round">
        <rect x="8" y="22" width="32" height="18" rx="3" fill="url(#w${u})"/>
        <path d="M8 24 L8 18 Q8 8 24 8 Q40 8 40 18 L40 24 Z" fill="#ff7a59"/>
        <rect x="14" y="8" width="5" height="32" fill="#ffd34d" stroke-width="2"/><rect x="29" y="8" width="5" height="32" fill="#ffd34d" stroke-width="2"/>
        <rect x="20" y="19" width="8" height="10" rx="2" fill="#ffd34d"/>
      </g>${sparkle(42, 8, 4.5)}`;
    },
    lobby() {
      const sword = (rot) => `<g transform="rotate(${rot} 24 24)" stroke="${O}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
        <path d="M24 3 L28 8 L28 30 L20 30 L20 8 Z" fill="#e8eef8"/><rect x="15" y="29" width="18" height="5" rx="2" fill="#ffd34d"/>
        <rect x="21.5" y="34" width="5" height="9" rx="2" fill="#7a4a2a"/></g>`;
      return sword(-38) + sword(38);
    },
    equip() {
      const u = uid();
      return `<defs>${lg('s' + u, [[0, '#7fd0ff'], [1, '#2f6fd6']])}</defs>
      <g stroke="${O}" stroke-width="2.6" stroke-linejoin="round">
        <path d="M24 4 L41 10 Q42 32 24 44 Q6 32 7 10 Z" fill="url(#s${u})"/>
        <path d="M24 10 L35 14 Q35 30 24 38 Q13 30 13 14 Z" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>
        <polygon points="${starPts(24, 24, 9, 4)}" fill="#ffd34d" stroke-width="2"/>
      </g>`;
    },
    // v29：冒険（宝の地図）
    adventure() {
      return `<g stroke="${O}" stroke-width="2.6" stroke-linejoin="round">
        <path d="M5 12 L17 7 L31 12 L43 7 L43 36 L31 41 L17 36 L5 41 Z" fill="#ffe7b0"/>
        <path d="M17 7 V36 M31 12 V41" fill="none" stroke-width="1.8" opacity=".5"/>
      </g>
      <path d="M10 33 Q14 24 21 27 T31 20" fill="none" stroke="#ff5a6e" stroke-width="2.6" stroke-dasharray="3.2 3" stroke-linecap="round"/>
      <path d="M32 13 L39 20 M39 13 L32 20" stroke="${O}" stroke-width="5.4" stroke-linecap="round"/>
      <path d="M32 13 L39 20 M39 13 L32 20" stroke="#ff3b3b" stroke-width="3" stroke-linecap="round"/>`;
    },
  };
  function navIcon(key) { return svg('0 0 48 48', NAV[key](), 'nav-art'); }

  /** ロビー参加画面の 4 人イラスト */
  function squad() {
    const cols = DS.config.PLAYER_COLORS;
    const pos = [[6, 34, 92], [74, 22, 104], [150, 22, 104], [222, 34, 92]];
    return svg('0 0 320 170', `
      <ellipse cx="160" cy="160" rx="150" ry="10" fill="#000" opacity=".15"/>
      ${pos.map(([x, y, w], i) => `<svg x="${x}" y="${y}" width="${w}" height="${w * 140 / 120}" viewBox="0 0 120 140">${heroBody(cols[i])}</svg>`).join('')}
      ${sparkle(20, 24, 7)}${sparkle(300, 20, 8)}${sparkle(160, 12, 6, '#fff7c2')}`, 'squad-art');
  }

  function crown(cls = 'crown-art') {
    return svg('0 0 32 24', `<path d="M3 20 L5 6 L11 13 L16 3 L21 13 L27 6 L29 20 Z" fill="#ffd34d" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="16" cy="15" r="2.4" fill="#ff4a5e"/>`, cls);
  }

  /** ロビー画面の背景（空・雲・丘） */
  function lobbyBg() {
    return svg('0 0 400 800', `
      ${cloud(20, 120, 1.4)}${cloud(250, 90, 1.1)}${cloud(300, 250, 0.8, '#fff', 0.7)}${cloud(-10, 330, 0.9, '#fff', 0.6)}
      ${sparkle(360, 150, 7, '#fff', 0.8)}${sparkle(60, 230, 5, '#fff', 0.7)}${sparkle(330, 380, 5, '#fff', 0.6)}
      <path d="M0 640 Q80 590 170 626 Q260 580 400 620 L400 800 L0 800 Z" fill="#7fd36b"/>
      ${tree(40, 640, 1.2, '#3cb44b')}${tree(360, 630, 1.4, '#2f9e44')}${tree(320, 640, 0.9, '#3cb44b')}
      <path d="M0 690 Q100 650 200 684 Q300 650 400 686 L400 800 L0 800 Z" fill="#4fb24a" stroke="${O}" stroke-width="3"/>
      <g fill="#ff6b8a"><circle cx="60" cy="720" r="4"/><circle cx="330" cy="740" r="4"/></g>
      <g fill="#ffe066"><circle cx="90" cy="740" r="3.5"/><circle cx="300" cy="714" r="3.5"/></g>`, 'lobby-bg-art')
      .replace('<svg ', '<svg preserveAspectRatio="xMidYMax slice" ');
  }

  DS.art = { item, hero, heroFace, stage, chest, coin, navIcon, squad, crown, sparkle, starPts, lobbyBg, blueprint, epicBox, essence };
})();

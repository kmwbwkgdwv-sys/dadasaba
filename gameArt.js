/* =========================================================
 *  gameArt.js  ― バトル用のイラスト（敵・ボス・スキルの小物）
 *  すべて SVG 文字列。バトル画面ではこれを画像に変換して高速に描画します。
 * ========================================================= */
(function () {
  const O = '#231a3a';
  let seq = 0;
  const uid = () => 'b' + (++seq).toString(36);
  const lg = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
  const G = (body, sw = 3) => `<g stroke="${O}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round">${body}</g>`;

  /* ---------------------------------------------------------
   *  雑魚敵（viewBox 0 0 100 100、右向き。中心 (50,58) が当たり判定の中心）
   * --------------------------------------------------------- */
  function wolfArt(c, extra = '') {
    return `<ellipse cx="50" cy="90" rx="36" ry="5" fill="#000" opacity=".22"/>
      ${G(`<path d="M24 58 Q8 52 5 33 Q16 42 28 48 Z" fill="${c.mid}"/>
        <rect x="25" y="66" width="9" height="20" rx="4" fill="${c.dark}"/>
        <rect x="39" y="68" width="9" height="18" rx="4" fill="${c.mid}"/>
        <rect x="57" y="68" width="9" height="18" rx="4" fill="${c.dark}"/>
        <rect x="69" y="66" width="9" height="20" rx="4" fill="${c.mid}"/>
        <ellipse cx="50" cy="60" rx="31" ry="16" fill="${c.body}"/>
        <path d="M62 50 L70 25 L80 40 Z" fill="${c.mid}"/>
        <circle cx="77" cy="50" r="15" fill="${c.head}"/>
        <path d="M82 29 L90 44 L79 42 Z" fill="${c.head}"/>
        <path d="M86 49 L98 55 Q98 62 87 62 Z" fill="${c.head}"/>
        <circle cx="97" cy="55" r="2.6" fill="${O}"/>`)}
      ${extra}
      <path d="M30 67 Q50 75 68 67" fill="none" stroke="${c.belly}" stroke-width="3" stroke-linecap="round"/>
      <path d="M74 44 L86 48" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="81" cy="51" rx="3.4" ry="2.8" fill="${c.eye}" stroke="${O}" stroke-width="1.2"/>
      <circle cx="82" cy="51" r="1.4" fill="${O}"/>
      <path d="M88 61 L90 66 L92 61" fill="#fff" stroke="${O}" stroke-width="1.2"/>`;
  }
  const ENEMY = {
    wolf() { return wolfArt({ dark: '#5f6787', mid: '#7d86a6', body: '#8d97b5', head: '#9aa4c2', belly: '#c9d0e6', eye: '#ffd34d' }); },
    // ステージ2：燃えている炎狼
    fireWolf() {
      return wolfArt({ dark: '#a8321f', mid: '#d24a2a', body: '#ef6a3a', head: '#f7834a', belly: '#ffd27a', eye: '#fff3a0' },
        `<path d="M30 48 Q26 30 36 22 Q36 34 42 36 Q42 20 54 12 Q52 28 58 34 Q62 24 70 22 Q64 34 66 46 Z" fill="#ffb13d" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
         <path d="M38 46 Q38 36 44 32 Q46 40 50 40 Q52 30 58 26 Q56 38 60 46 Z" fill="#fff07a"/>
         <path d="M10 32 Q2 20 8 10 Q10 20 16 22 Q14 12 22 6 Q22 20 26 30 Z" fill="#ffb13d" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
         <path d="M13 30 Q10 22 14 16 Q16 24 20 26 Z" fill="#fff07a"/>`);
    },
    // ステージ3：凍っている氷狼
    iceWolf() {
      return wolfArt({ dark: '#6f9fc8', mid: '#8ec5ef', body: '#bfe6ff', head: '#d8f1ff', belly: '#ffffff', eye: '#4fe0ff' },
        `<g fill="#f4fdff" stroke="${O}" stroke-width="2.2" stroke-linejoin="round">
           <path d="M32 47 L36 30 L42 46 Z"/><path d="M42 45 L48 24 L54 45 Z"/><path d="M54 46 L60 30 L64 47 Z"/>
           <path d="M8 40 L2 26 L14 34 Z"/><path d="M14 44 L10 30 L20 40 Z"/>
         </g>
         <path d="M48 28 L48 40 M36 34 L38 42 M60 34 L60 42" stroke="#8fe3ff" stroke-width="1.6"/>
         <circle cx="24" cy="78" r="2" fill="#fff"/><circle cx="72" cy="80" r="1.6" fill="#fff"/>`);
    },
    zombie() {
      return `<ellipse cx="50" cy="92" rx="24" ry="5" fill="#000" opacity=".22"/>
      ${G(`<rect x="37" y="72" width="10" height="17" rx="4" fill="#4b4f70"/>
        <rect x="53" y="72" width="10" height="17" rx="4" fill="#4b4f70"/>
        <path d="M33 50 Q50 44 67 50 L68 78 L60 74 L54 79 L47 74 L40 79 L32 76 Z" fill="#5a7bd6"/>
        <rect x="58" y="51" width="32" height="9" rx="4.5" fill="#8fd67f"/>
        <rect x="55" y="63" width="29" height="9" rx="4.5" fill="#8fd67f"/>
        <circle cx="50" cy="31" r="21" fill="#8fd67f"/>
        <path d="M36 16 Q44 8 54 12 Q50 16 44 17 Z" fill="#4e8a43"/>`)}
      <circle cx="43" cy="31" r="6.4" fill="#fff" stroke="${O}" stroke-width="2"/><circle cx="44" cy="31" r="2.6" fill="${O}"/>
      <circle cx="59" cy="29" r="4.2" fill="#fff" stroke="${O}" stroke-width="2"/><circle cx="60" cy="29" r="1.8" fill="${O}"/>
      <path d="M41 42 L45 39 L49 42 L53 39 L57 42" fill="none" stroke="${O}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M60 18 L66 22 M62 15 L58 21" stroke="${O}" stroke-width="1.6"/>`;
    },
    mageZombie() {
      return `<ellipse cx="50" cy="92" rx="24" ry="5" fill="#000" opacity=".22"/>
      ${G(`<path d="M76 20 L76 88" stroke-width="7"/><path d="M76 20 L76 88" stroke="#8a5a2b" stroke-width="3.6"/>
        <path d="M31 88 Q34 60 38 48 Q50 42 62 48 Q66 60 69 88 Z" fill="#7a4fd0"/>
        <path d="M44 50 L50 88 L56 50" fill="none" stroke="#ffd34d" stroke-width="2.4"/>
        <rect x="58" y="56" width="20" height="9" rx="4.5" fill="#8fd67f"/>
        <circle cx="49" cy="36" r="17" fill="#8fd67f"/>
        <path d="M30 28 Q50 20 70 28 L66 32 Q50 26 34 32 Z" fill="#5b2fa8"/>
        <path d="M36 28 Q42 6 56 2 Q52 10 62 26 Z" fill="#7a4fd0"/>
        <path d="M37 25 Q49 21 61 25" fill="none" stroke="#ffd34d" stroke-width="2.4"/>`)}
      <circle cx="76" cy="16" r="8" fill="#ff7ad9" stroke="${O}" stroke-width="2.6"/>
      <circle cx="74" cy="14" r="2.4" fill="#fff"/>
      <circle cx="43" cy="37" r="4.6" fill="#fff" stroke="${O}" stroke-width="1.8"/><circle cx="44" cy="37" r="2" fill="${O}"/>
      <circle cx="56" cy="36" r="3.4" fill="#fff" stroke="${O}" stroke-width="1.8"/><circle cx="57" cy="36" r="1.5" fill="${O}"/>
      <path d="M44 46 Q50 43 56 46" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/>`;
    },
    armorSkeleton() {
      return `<ellipse cx="50" cy="92" rx="24" ry="5" fill="#000" opacity=".22"/>
      ${G(`<rect x="40" y="72" width="7" height="17" rx="3" fill="#f2efe4"/>
        <rect x="54" y="72" width="7" height="17" rx="3" fill="#f2efe4"/>
        <path d="M34 48 Q50 42 66 48 L64 76 Q50 80 36 76 Z" fill="#8b96aa"/>
        <path d="M38 56 L62 56 M39 64 L61 64" stroke-width="2"/>
        <path d="M80 30 Q96 56 80 82" fill="none" stroke-width="6"/>
        <path d="M80 30 Q96 56 80 82" fill="none" stroke="#a8692c" stroke-width="3"/>
        <path d="M80 30 L80 82" stroke="#e9e3d0" stroke-width="1.4"/>
        <rect x="60" y="52" width="22" height="7" rx="3.5" fill="#f2efe4"/>
        <circle cx="50" cy="31" r="18" fill="#f2efe4"/>
        <path d="M30 32 Q30 10 50 9 Q70 10 70 32 L66 30 Q64 20 50 19 Q36 20 34 30 Z" fill="#6f7a90"/>
        <path d="M33 16 L24 6 L38 12 M67 16 L76 6 L62 12" fill="#e9e3d0" stroke-width="2.2"/>
        <rect x="42" y="42" width="16" height="7" rx="2" fill="#f2efe4" stroke-width="2"/>`)}
      <ellipse cx="43" cy="33" rx="5" ry="5.4" fill="${O}"/><ellipse cx="57" cy="33" rx="5" ry="5.4" fill="${O}"/>
      <circle cx="43" cy="33" r="2.2" fill="#ff4a5e"/><circle cx="57" cy="33" r="2.2" fill="#ff4a5e"/>
      <path d="M46 42 L46 49 M50 42 L50 49 M54 42 L54 49" stroke="${O}" stroke-width="1.3"/>`;
    },
    bigZombie() {
      return `<ellipse cx="50" cy="93" rx="38" ry="6" fill="#000" opacity=".25"/>
      ${G(`<rect x="30" y="74" width="15" height="16" rx="5" fill="#3e4263"/>
        <rect x="55" y="74" width="15" height="16" rx="5" fill="#3e4263"/>
        <ellipse cx="50" cy="58" rx="34" ry="26" fill="#6b9a52"/>
        <path d="M24 66 Q50 92 76 66 L76 74 Q50 96 24 74 Z" fill="#a0523a"/>
        <circle cx="13" cy="62" r="11" fill="#79c06a"/>
        <circle cx="87" cy="62" r="11" fill="#79c06a"/>
        <circle cx="50" cy="26" r="17" fill="#79c06a"/>`, 3.4)}
      <path d="M38 46 Q50 60 64 48 M46 54 L48 58 M54 53 L56 57" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="38" cy="54" rx="10" ry="6" fill="#fff" opacity=".18"/>
      <circle cx="43" cy="25" r="4.6" fill="#ff4a5e" stroke="${O}" stroke-width="1.8"/>
      <circle cx="57" cy="24" r="3.6" fill="#ff4a5e" stroke="${O}" stroke-width="1.8"/>
      <path d="M38 18 L47 21 M62 17 L54 20" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M42 34 L46 31 L50 34 L54 31 L58 34" fill="none" stroke="${O}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    },
    // ステージ4・5の中ボス：鎧を着たエリートゾンビ（でかいゾンビの2倍の強さ）
    eliteZombie() {
      return `<ellipse cx="50" cy="93" rx="40" ry="6" fill="#000" opacity=".28"/>
      <ellipse cx="50" cy="58" rx="46" ry="40" fill="#ff2a4a" opacity=".16"/>
      ${G(`<rect x="29" y="74" width="16" height="17" rx="4" fill="#2b2f45"/>
        <rect x="55" y="74" width="16" height="17" rx="4" fill="#2b2f45"/>
        <ellipse cx="50" cy="58" rx="35" ry="27" fill="#5b7f6a"/>
        <path d="M22 52 Q50 36 78 52 L76 74 Q50 90 24 74 Z" fill="#4a5068"/>
        <path d="M30 58 L70 58 M32 67 L68 67" stroke-width="2.2"/>
        <path d="M44 48 L50 40 L56 48 L50 56 Z" fill="#ff3b5c" stroke-width="2.2"/>
        <circle cx="12" cy="56" r="13" fill="#6b7790"/>
        <circle cx="88" cy="56" r="13" fill="#6b7790"/>
        <path d="M4 50 L-2 38 L12 46 Z M96 50 L102 38 L88 46 Z M10 44 L8 32 L18 42 Z M90 44 L92 32 L82 42 Z" fill="#d8dde8" stroke-width="2.2"/>
        <circle cx="12" cy="72" r="8" fill="#6f9a7c"/><circle cx="88" cy="72" r="8" fill="#6f9a7c"/>
        <circle cx="50" cy="25" r="18" fill="#6f9a7c"/>
        <path d="M30 24 Q30 4 50 4 Q70 4 70 24 L66 22 Q64 12 50 12 Q36 12 34 22 Z" fill="#4a5068"/>
        <path d="M32 12 L22 -2 L38 8 Z M68 12 L78 -2 L62 8 Z" fill="#d8dde8" stroke-width="2.2"/>`, 3.4)}
      <path d="M38 20 L48 24 M62 20 L52 24" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="43" cy="27" r="4.4" fill="#ff2a4a" stroke="${O}" stroke-width="1.8"/>
      <circle cx="57" cy="27" r="4.4" fill="#ff2a4a" stroke="${O}" stroke-width="1.8"/>
      <circle cx="42" cy="26" r="1.4" fill="#ffd0d8"/><circle cx="56" cy="26" r="1.4" fill="#ffd0d8"/>
      <path d="M41 35 L45 32 L48 36 L52 32 L55 36 L59 33" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M26 54 Q36 48 46 50" stroke="#fff" stroke-width="2.4" opacity=".3" fill="none" stroke-linecap="round"/>`;
    },
  };

  /* ---------- エリアごとに追加した雑魚 ---------- */
  function slimeArt(c, extra = '') {
    return `<ellipse cx="50" cy="90" rx="30" ry="5" fill="#000" opacity=".22"/>
      ${G(`<path d="M16 86 Q12 56 34 42 Q50 30 66 42 Q88 56 84 86 Q50 92 16 86 Z" fill="${c.main}"/>
        <path d="M24 84 Q26 74 22 70 M78 84 Q76 72 80 68" fill="none" stroke="${c.dark}" stroke-width="3"/>`)}
      <path d="M30 52 Q36 42 46 40" stroke="${c.light}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>
      ${extra}
      <ellipse cx="44" cy="64" rx="5" ry="6.5" fill="${O}"/><ellipse cx="62" cy="64" rx="5" ry="6.5" fill="${O}"/>
      <circle cx="45.5" cy="62" r="1.8" fill="#fff"/><circle cx="63.5" cy="62" r="1.8" fill="#fff"/>
      <path d="M48 74 Q53 78 58 74" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  function batArt(c) {
    return `<ellipse cx="50" cy="92" rx="18" ry="4" fill="#000" opacity=".18"/>
      ${G(`<path d="M44 50 Q30 30 6 34 Q14 42 12 50 Q20 46 24 54 Q30 48 36 58 Z" fill="${c.wing}"/>
        <path d="M56 50 Q70 30 94 34 Q86 42 88 50 Q80 46 76 54 Q70 48 64 58 Z" fill="${c.wing}"/>
        <ellipse cx="50" cy="56" rx="15" ry="16" fill="${c.body}"/>
        <path d="M38 44 L36 30 L46 40 Z M62 44 L64 30 L54 40 Z" fill="${c.body}"/>`, 2.6)}
      <circle cx="44" cy="54" r="3.6" fill="${c.eye}" stroke="${O}" stroke-width="1.4"/><circle cx="56" cy="54" r="3.6" fill="${c.eye}" stroke="${O}" stroke-width="1.4"/>
      <path d="M45 64 L47 68 L49 64 M51 64 L53 68 L55 64" fill="#fff" stroke="${O}" stroke-width="1.2" stroke-linejoin="round"/>`;
  }
  Object.assign(ENEMY, {
    // 地獄の猟犬：黒い体に溶岩のひび（火山）
    hellHound() {
      return wolfArt({ dark: '#1e1015', mid: '#3b2a35', body: '#4a3540', head: '#5a4048', belly: '#ff8a1e', eye: '#ff3b3b' },
        `<path d="M34 58 L42 54 L40 62 L50 58 M60 56 L66 62 L72 58" stroke="#ff8a1e" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M36 46 Q34 34 42 28 Q42 38 48 40 Q50 28 58 22 Q56 36 62 44 Z" fill="#ff5a1f" stroke="${O}" stroke-width="2.2" stroke-linejoin="round"/>
         <path d="M42 44 Q42 38 46 36 Q48 42 52 42 Z" fill="#ffd27a"/>`);
    },
    slime() { return slimeArt({ main: '#6fdc5a', dark: '#2f9e44', light: '#d4ffc8' }); },
    magmaSlime() {
      return slimeArt({ main: '#ff7a2e', dark: '#a8321f', light: '#ffe066' },
        `<circle cx="70" cy="56" r="4" fill="#ffe066" stroke="${O}" stroke-width="1.6"/><circle cx="30" cy="72" r="3" fill="#ffe066" stroke="${O}" stroke-width="1.4"/>
         <path d="M60 30 Q62 22 58 16 Q66 20 66 28" fill="#ffb13d" stroke="${O}" stroke-width="1.8"/>`);
    },
    scorpion() {
      return `<ellipse cx="50" cy="90" rx="34" ry="5" fill="#000" opacity=".2"/>
      ${G(`<path d="M30 62 Q14 56 10 38 Q8 24 22 20 Q30 18 34 26" fill="none" stroke-width="9"/>
        <path d="M30 62 Q14 56 10 38 Q8 24 22 20 Q30 18 34 26" fill="none" stroke="#c2603a" stroke-width="5"/>
        <path d="M34 26 L40 22 L36 32 Z" fill="#ffd27a" stroke-width="2"/>
        <path d="M30 74 L18 86 M38 76 L30 90 M60 76 L68 90 M68 74 L80 86" stroke-width="4"/>
        <ellipse cx="50" cy="68" rx="24" ry="13" fill="#c2603a"/>
        <path d="M36 64 L64 64 M38 72 L62 72" stroke-width="2"/>
        <path d="M70 62 Q82 54 86 44" fill="none" stroke-width="5"/>
        <path d="M80 36 Q94 34 94 46 Q88 44 86 50 Q80 44 80 36 Z" fill="#d97848"/>
        <circle cx="70" cy="62" r="9" fill="#d97848"/>`)}
      <circle cx="72" cy="58" r="2.6" fill="${O}"/><circle cx="66" cy="58" r="2.2" fill="${O}"/>`;
    },
    mummy() {
      return `<ellipse cx="50" cy="92" rx="24" ry="5" fill="#000" opacity=".22"/>
      ${G(`<rect x="37" y="72" width="11" height="18" rx="4" fill="#e9dcc0"/>
        <rect x="53" y="72" width="11" height="18" rx="4" fill="#e9dcc0"/>
        <path d="M32 48 Q50 42 68 48 L68 78 Q50 82 32 78 Z" fill="#efe3c8"/>
        <rect x="58" y="50" width="32" height="9" rx="4.5" fill="#efe3c8"/>
        <circle cx="50" cy="31" r="19" fill="#efe3c8"/>`)}
      <path d="M34 26 L66 22 M32 36 L68 32 M36 54 L66 58 M34 64 L66 68 M36 74 L64 76 M62 52 L88 56" stroke="#b8a888" stroke-width="2" fill="none"/>
      <rect x="38" y="27" width="24" height="7" rx="3" fill="${O}"/>
      <circle cx="56" cy="30.5" r="3" fill="#7fffd4"/><circle cx="44" cy="30.5" r="2" fill="#3a7a6a"/>`;
    },
    snowman() {
      return `<ellipse cx="50" cy="92" rx="26" ry="5" fill="#000" opacity=".2"/>
      ${G(`<path d="M24 54 L8 44 M76 54 L92 42" stroke="#7a4a22" stroke-width="3.4"/>
        <circle cx="50" cy="70" r="22" fill="#ffffff"/>
        <circle cx="50" cy="38" r="16" fill="#ffffff"/>
        <path d="M34 50 Q50 58 66 50 L64 58 Q50 64 36 58 Z" fill="#ff5a6a"/>
        <path d="M60 54 L70 70 L64 70 Z" fill="#ff5a6a"/>
        <path d="M36 26 L64 26 L60 8 L40 8 Z" fill="#4a5068"/>
        <rect x="32" y="24" width="36" height="5" rx="2" fill="#4a5068"/>`, 2.8)}
      <circle cx="44" cy="36" r="2.6" fill="${O}"/><circle cx="56" cy="36" r="2.6" fill="${O}"/>
      <path d="M50 40 L66 44 L50 44 Z" fill="#ff8a1e" stroke="${O}" stroke-width="1.4" stroke-linejoin="round"/>
      <circle cx="50" cy="66" r="2.4" fill="${O}"/><circle cx="50" cy="76" r="2.4" fill="${O}"/>
      <path d="M38 62 Q42 58 46 60" stroke="#c9e6ff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    },
    iceBat() { return batArt({ wing: '#8ec5ef', body: '#bfe6ff', eye: '#4fe0ff' }); },
    bat() { return batArt({ wing: '#5b3f8a', body: '#3b2a5a', eye: '#ff4a5e' }); },
    fireWisp() {
      return `<ellipse cx="50" cy="92" rx="16" ry="4" fill="#000" opacity=".16"/>
      <path d="M50 8 Q60 26 72 30 Q66 34 76 46 Q84 66 70 80 Q58 90 44 88 Q24 84 22 64 Q20 48 32 40 Q30 50 38 52 Q34 36 44 28 Q46 20 50 8 Z" fill="#ff7a2e" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M50 36 Q58 48 64 52 Q70 66 60 76 Q50 82 42 78 Q32 72 36 60 Q40 66 46 64 Q42 52 50 36 Z" fill="#ffe066"/>
      <ellipse cx="44" cy="64" rx="3.4" ry="4.6" fill="${O}"/><ellipse cx="57" cy="64" rx="3.4" ry="4.6" fill="${O}"/>
      <path d="M45 74 Q50 78 56 74" fill="none" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>`;
    },
    ghost() {
      return `<ellipse cx="50" cy="94" rx="18" ry="4" fill="#000" opacity=".14"/>
      ${G(`<path d="M24 86 L24 44 Q24 16 50 16 Q76 16 76 44 L76 86 L68 78 L60 88 L50 78 L40 88 L32 78 Z" fill="#f4f0ff"/>
        <path d="M76 52 Q88 50 92 40 Q90 56 76 62 Z" fill="#f4f0ff" stroke-width="2.4"/>`)}
      <path d="M30 40 Q32 26 44 22" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <ellipse cx="42" cy="46" rx="5" ry="7" fill="${O}"/><ellipse cx="60" cy="46" rx="5" ry="7" fill="${O}"/>
      <ellipse cx="51" cy="62" rx="5" ry="6" fill="${O}"/>
      <ellipse cx="34" cy="56" rx="4" ry="2.4" fill="#d6b8ff" opacity=".7"/><ellipse cx="68" cy="56" rx="4" ry="2.4" fill="#d6b8ff" opacity=".7"/>`;
    },
    // ---- 中ボス ----
    bigMummy() {
      return `<ellipse cx="50" cy="93" rx="38" ry="6" fill="#000" opacity=".25"/>
      ${G(`<rect x="30" y="74" width="15" height="17" rx="5" fill="#e9dcc0"/>
        <rect x="55" y="74" width="15" height="17" rx="5" fill="#e9dcc0"/>
        <ellipse cx="50" cy="58" rx="33" ry="26" fill="#efe3c8"/>
        <path d="M30 40 Q50 50 70 40 L74 48 Q50 60 26 48 Z" fill="#ffd23d"/>
        <circle cx="14" cy="60" r="11" fill="#efe3c8"/><circle cx="86" cy="60" r="11" fill="#efe3c8"/>
        <circle cx="50" cy="26" r="17" fill="#efe3c8"/>`, 3.4)}
      <path d="M22 58 L78 54 M24 68 L76 72 M30 78 L70 80 M36 18 L64 14 M34 34 L66 32 M6 58 L22 64 M78 56 L94 62" stroke="#b8a888" stroke-width="2.2" fill="none"/>
      <path d="M40 46 L44 52 M50 48 L50 54 M60 46 L56 52" stroke="#2a5ad6" stroke-width="3" stroke-linecap="round"/>
      <rect x="36" y="22" width="28" height="8" rx="3.5" fill="${O}"/>
      <circle cx="43" cy="26" r="3.2" fill="#7fffd4"/><circle cx="57" cy="26" r="3.2" fill="#7fffd4"/>`;
    },
    bigSnowman() {
      return `<ellipse cx="50" cy="93" rx="40" ry="6" fill="#000" opacity=".22"/>
      ${G(`<path d="M18 58 L2 44 L6 40 M82 58 L98 42" stroke="#7a4a22" stroke-width="4"/>
        <circle cx="50" cy="68" r="28" fill="#ffffff"/>
        <circle cx="50" cy="30" r="20" fill="#ffffff"/>
        <path d="M28 46 Q50 56 72 46 L70 56 Q50 66 30 56 Z" fill="#3fa9ff"/>
        <path d="M64 52 L74 72 L66 72 Z" fill="#3fa9ff"/>
        <path d="M32 16 L36 2 L44 12 L50 0 L56 12 L64 2 L68 16 Z" fill="#ffd23d"/>
        <circle cx="94" cy="40" r="7" fill="#ffffff" stroke-width="2.4"/>`, 3.2)}
      <path d="M38 22 L46 26 M62 22 L54 26" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="43" cy="29" r="3" fill="${O}"/><circle cx="57" cy="29" r="3" fill="${O}"/>
      <path d="M50 33 L70 38 L50 39 Z" fill="#ff8a1e" stroke="${O}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M42 41 L46 39 L50 42 L54 39 L58 41" fill="none" stroke="${O}" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="50" cy="66" r="3" fill="${O}"/><circle cx="50" cy="78" r="3" fill="${O}"/>`;
    },
    dullahan() {
      return `<ellipse cx="50" cy="93" rx="38" ry="6" fill="#000" opacity=".26"/>
      <ellipse cx="50" cy="56" rx="44" ry="40" fill="#b98cff" opacity=".14"/>
      ${G(`<rect x="31" y="72" width="15" height="19" rx="4" fill="#2b2540"/>
        <rect x="55" y="72" width="15" height="19" rx="4" fill="#2b2540"/>
        <path d="M24 40 Q50 30 76 40 L74 76 Q50 84 26 76 Z" fill="#3b3550"/>
        <path d="M30 50 L70 50 M32 62 L68 62" stroke-width="2.2"/>
        <circle cx="18" cy="44" r="12" fill="#4a4068"/><circle cx="82" cy="44" r="12" fill="#4a4068"/>
        <path d="M86 50 L98 10 L102 12 L92 52 Z" fill="#cfd4e0"/>
        <circle cx="16" cy="66" r="12" fill="#cfd4e0"/>
        <path d="M6 64 Q16 52 26 64 L24 68 L8 68 Z" fill="#4a4068"/>`, 3.2)}
      <path d="M40 34 Q42 18 50 10 Q52 22 58 18 Q60 28 60 34 Z" fill="#b98cff" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M45 32 Q47 24 50 20 Q52 26 55 32 Z" fill="#efe7ff"/>
      <rect x="10" y="64" width="12" height="4" rx="2" fill="${O}"/>
      <circle cx="13" cy="66" r="1.6" fill="#ff3b5c"/><circle cx="19" cy="66" r="1.6" fill="#ff3b5c"/>
      <path d="M44 46 L50 40 L56 46 L50 54 Z" fill="#b98cff" stroke="${O}" stroke-width="2"/>`;
    },
  });

  /* ---------------------------------------------------------
   *  ボス（viewBox 0 0 200 200、中心 (100,110)）
   * --------------------------------------------------------- */
  const SPECIES = {
    aurott(u, c, v) {
      return `<defs>${lg('t' + u, [[0, '#a8713a'], [1, '#6b4320']], 0, 0, 1, 0)}</defs>
      <ellipse cx="100" cy="186" rx="76" ry="11" fill="#000" opacity=".25"/>
      ${G(`<path d="M62 178 Q40 182 28 192 M138 178 Q160 182 172 192 M90 182 Q86 192 76 198 M112 182 Q116 192 126 198" fill="none" stroke-width="7"/>
        <path d="M62 178 Q40 182 28 192 M138 178 Q160 182 172 192 M90 182 Q86 192 76 198 M112 182 Q116 192 126 198" fill="none" stroke="#7a4a22" stroke-width="3.5"/>
        <path d="M70 116 Q40 108 20 80 M130 116 Q160 108 180 80" fill="none" stroke-width="12"/>
        <path d="M70 116 Q40 108 20 80 M130 116 Q160 108 180 80" fill="none" stroke="#8a5a2b" stroke-width="7"/>
        <path d="M24 86 L10 82 M30 96 L22 104 M176 86 L190 82 M170 96 L178 104" stroke-width="4"/>
        <path d="M62 182 Q56 130 70 92 L130 92 Q144 130 138 182 Z" fill="url(#t${u})"/>
        <path d="M78 104 Q74 140 80 176 M120 104 Q126 140 120 176" fill="none" stroke-width="2" opacity=".5"/>
        <circle cx="100" cy="58" r="50" fill="#2f9e44"/>
        <circle cx="60" cy="80" r="30" fill="#3cb44b"/>
        <circle cx="140" cy="80" r="30" fill="#3cb44b"/>
        <circle cx="100" cy="82" r="32" fill="#3cb44b"/>`)}
      <circle cx="82" cy="40" r="9" fill="#5fd35a"/><circle cx="125" cy="52" r="7" fill="#5fd35a"/>
      <circle cx="70" cy="70" r="5" fill="#ff4a5e" stroke="${O}" stroke-width="2"/><circle cx="132" cy="68" r="5" fill="#ff4a5e" stroke="${O}" stroke-width="2"/>
      <path d="M76 124 L94 132 L78 140 Z M124 124 L106 132 L122 140 Z" fill="#ffd34d" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M80 160 L88 152 L96 160 L104 152 L112 160 L120 152" fill="none" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
      ${v === 'ancient' ? `<path d="M64 18 L72 0 L84 14 L100 -4 L116 14 L128 0 L136 18 Q100 8 64 18 Z" fill="#ffd23d" stroke="${O}" stroke-width="3" stroke-linejoin="round" transform="translate(0 6)"/>
        ${[[56, 62], [146, 58], [96, 40], [120, 92], [76, 96]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="7" fill="#ff7ad9" stroke="${O}" stroke-width="2"/><circle r="2.6" fill="#ffe066"/></g>`).join('')}
        <path d="M30 120 Q20 140 26 160 M170 120 Q180 140 174 160" fill="none" stroke="#2f9e44" stroke-width="5" stroke-linecap="round"/>` : ''}`;
    },
    orock(u) {
      return `<defs>${lg('s' + u, [[0, '#b8bcc8'], [1, '#6b6f7c']], 0, 0, 1, 1)}</defs>
      <ellipse cx="100" cy="186" rx="80" ry="11" fill="#000" opacity=".25"/>
      ${G(`<circle cx="28" cy="128" r="24" fill="url(#s${u})"/>
        <circle cx="172" cy="128" r="24" fill="url(#s${u})"/>
        <path d="M40 178 Q24 110 52 62 Q76 26 112 30 Q156 36 166 86 Q178 140 160 180 Z" fill="url(#s${u})"/>
        <path d="M70 70 L84 92 L76 110 M140 100 L128 120 L138 140 M96 150 L104 166" fill="none" stroke-width="2.6"/>`, 4)}
      <path d="M58 58 Q80 30 112 34 Q140 36 152 56 Q120 46 98 52 Q74 56 58 58 Z" fill="#5fb15a" stroke="${O}" stroke-width="3"/>
      <path d="M66 96 L94 104 L68 112 Z M134 96 L106 104 L132 112 Z" fill="#ff8a1e" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M78 140 Q100 130 122 140" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="58" cy="176" r="9" fill="#8b8f9c" stroke="${O}" stroke-width="3"/><circle cx="150" cy="180" r="7" fill="#8b8f9c" stroke="${O}" stroke-width="3"/>`;
    },
    frostGolem(u) {
      return `<defs>${lg('i' + u, [[0, '#f0fbff'], [0.5, '#9fd8ff'], [1, '#3f86d6']], 0, 0, 1, 1)}</defs>
      <ellipse cx="100" cy="186" rx="80" ry="11" fill="#000" opacity=".25"/>
      ${G(`<path d="M20 120 L36 84 L56 100 L46 140 Z M180 120 L164 84 L144 100 L154 140 Z" fill="url(#i${u})"/>
        <path d="M50 180 L44 110 L64 60 L100 40 L136 60 L156 110 L150 180 Z" fill="url(#i${u})"/>
        <path d="M64 60 L56 30 L76 52 M136 60 L144 30 L124 52 M100 40 L100 14 L110 38" fill="#e3f7ff"/>
        <path d="M64 60 L100 96 L136 60 M44 110 L100 96 L156 110 M100 96 L100 180" fill="none" stroke-width="2" opacity=".5"/>`, 4)}
      <path d="M70 92 L92 98 L72 106 Z M130 92 L108 98 L128 106 Z" fill="#fff" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M84 132 L92 126 L100 132 L108 126 L116 132" fill="none" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>`;
    },
    ifrit(u) {
      return `<defs>${lg('f' + u, [[0, '#ffe066'], [0.5, '#ff8a1e'], [1, '#d6264a']])}</defs>
      <ellipse cx="100" cy="186" rx="76" ry="11" fill="#000" opacity=".25"/>
      ${G(`<path d="M28 120 Q20 90 40 70 Q42 92 56 100 Z M172 120 Q180 90 160 70 Q158 92 144 100 Z" fill="url(#f${u})"/>
        <path d="M54 182 Q40 130 58 96 Q60 120 72 124 Q66 84 90 50 Q92 80 104 86 Q102 60 120 34 Q124 70 138 92 Q150 82 146 64 Q170 108 150 182 Z" fill="url(#f${u})"/>
        <path d="M70 76 L56 52 L78 68 M130 76 L144 52 L122 68" fill="#3b2f5c"/>`, 4)}
      <path d="M72 112 L94 120 L74 128 Z M128 112 L106 120 L126 128 Z" fill="#fff6b0" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M80 150 Q100 166 120 150 Q100 158 80 150 Z" fill="${O}"/>`;
    },
    phantom(u, c, v) {
      c = c || {};
      const vamp = v === 'vampire';
      return `<defs>${lg('p' + u, [[0, c.light || '#efe7ff'], [1, c.main || '#8f6ad8']])}</defs>
      ${vamp ? G(`<path d="M30 70 Q10 40 24 18 Q36 44 56 52 Z M170 70 Q190 40 176 18 Q164 44 144 52 Z" fill="${c.dark}"/>`) : ''}
      <ellipse cx="100" cy="190" rx="70" ry="9" fill="#000" opacity=".22"/>
      ${G(`<path d="M30 110 Q18 100 14 80 Q34 88 50 86 Z M170 110 Q182 100 186 80 Q166 88 150 86 Z" fill="url(#p${u})"/>
        <path d="M44 176 Q36 70 100 56 Q164 70 156 176 L140 166 L126 180 L112 166 L100 180 L88 166 L74 180 L60 166 Z" fill="url(#p${u})"/>
        ${vamp ? `<path d="M64 72 Q100 50 136 72 L130 80 Q100 64 70 80 Z" fill="${c.dark}"/>` : `<path d="M58 72 L66 36 L82 58 L100 26 L118 58 L134 36 L142 72 Q100 60 58 72 Z" fill="#ffd34d"/>`}`, 4)}
      <circle cx="100" cy="46" r="6" fill="#ff4a8a" stroke="${O}" stroke-width="2.4"/>
      <circle cx="74" cy="60" r="4" fill="#5fd3ff" stroke="${O}" stroke-width="2"/><circle cx="126" cy="60" r="4" fill="#5fd3ff" stroke="${O}" stroke-width="2"/>
      <ellipse cx="82" cy="108" rx="9" ry="12" fill="${O}"/><ellipse cx="118" cy="108" rx="9" ry="12" fill="${O}"/>
      <circle cx="82" cy="110" r="3.6" fill="#ff4a5e"/><circle cx="118" cy="110" r="3.6" fill="#ff4a5e"/>
      ${vamp ? `<path d="M88 136 Q100 146 112 136 L108 142 L104 150 L100 142 L96 150 L92 142 Z" fill="#fff" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` : `<ellipse cx="100" cy="140" rx="8" ry="10" fill="${O}"/>`}`;
    },
    // ---------- ここから下は色と形を変えて使い回す「種類」 ----------
    slime(u, c, v) {
      const ghost = v === 'ghost';
      return `<defs>${lg('s' + u, [[0, c.light], [0.45, c.main], [1, c.dark]], 0, 0, 0.4, 1)}</defs>
      <ellipse cx="100" cy="186" rx="80" ry="11" fill="#000" opacity="${ghost ? 0.12 : 0.25}"/>
      <g opacity="${ghost ? 0.88 : 1}">${G(`<path d="M18 180 Q10 112 52 82 Q100 50 148 82 Q190 112 182 180 Q100 194 18 180 Z" fill="url(#s${u})"/>
        <path d="M34 176 Q38 160 30 150 M166 176 Q162 158 170 148 M100 186 Q104 172 98 164" fill="none" stroke="${c.dark}" stroke-width="5"/>
        <path d="M60 70 L66 40 L84 58 L100 30 L116 58 L134 40 L140 70 Q100 58 60 70 Z" fill="#ffd34d"/>`, 4)}</g>
      <circle cx="100" cy="44" r="6" fill="#ff4a8a" stroke="${O}" stroke-width="2.4"/>
      <path d="M44 108 Q54 84 80 76" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" opacity=".55"/>
      <ellipse cx="78" cy="126" rx="10" ry="14" fill="${O}"/><ellipse cx="122" cy="126" rx="10" ry="14" fill="${O}"/>
      <circle cx="81" cy="121" r="4" fill="#fff"/><circle cx="125" cy="121" r="4" fill="#fff"/>
      <path d="M84 152 Q100 164 116 152" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="60" cy="146" rx="9" ry="5" fill="#ff8f9a" opacity=".5"/><ellipse cx="140" cy="146" rx="9" ry="5" fill="#ff8f9a" opacity=".5"/>`;
    },
    mushroom(u, c) {
      return `<defs>${lg('m' + u, [[0, c.main], [1, c.dark]])}</defs>
      <ellipse cx="100" cy="188" rx="64" ry="10" fill="#000" opacity=".25"/>
      ${G(`<path d="M30 132 Q18 124 22 110 Q34 116 46 120 Z M170 132 Q182 124 178 110 Q166 116 154 120 Z" fill="${c.light}"/>
        <path d="M60 184 Q52 140 64 108 L136 108 Q148 140 140 184 Z" fill="${c.light}"/>
        <rect x="70" y="176" width="22" height="12" rx="5" fill="#8a5a2b"/><rect x="108" y="176" width="22" height="12" rx="5" fill="#8a5a2b"/>
        <path d="M10 108 Q14 30 100 22 Q186 30 190 108 Q150 122 100 116 Q50 122 10 108 Z" fill="url(#m${u})"/>
        <path d="M24 106 Q100 126 176 106" fill="none" stroke-width="3"/>`, 4)}
      ${[[54, 62, 13], [100, 46, 16], [146, 64, 12], [76, 92, 8], [128, 94, 9], [30, 88, 7], [170, 90, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff4e0" stroke="${O}" stroke-width="2.6"/>`).join('')}
      <ellipse cx="84" cy="142" rx="8" ry="11" fill="${O}"/><ellipse cx="116" cy="142" rx="8" ry="11" fill="${O}"/>
      <circle cx="86" cy="138" r="3" fill="#fff"/><circle cx="118" cy="138" r="3" fill="#fff"/>
      <path d="M78 128 L92 132 M122 128 L108 132" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M90 162 Q100 156 110 162" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`;
    },
    beast(u, c, v) {
      const ear = v === 'yeti' ? `<path d="M50 56 L40 22 L70 44 Z M150 56 L160 22 L130 44 Z" fill="${c.light}"/>`
        : v === 'boar' ? `<path d="M48 62 L34 30 L72 50 Z M152 62 L166 30 L128 50 Z" fill="${c.dark}"/>`
        : `<path d="M50 60 L46 30 L74 48 Z M150 60 L154 30 L126 48 Z" fill="${c.main}"/>`;
      const mane = v === 'lion' ? `<path d="M100 18 Q160 18 176 80 Q180 130 140 150 L60 150 Q20 130 24 80 Q40 18 100 18 Z" fill="${c.light}"/>
          <path d="M44 60 L156 60 M40 82 L160 82 M42 104 L158 104" stroke="#ffd34d" stroke-width="6"/>`
        : v === 'hound' ? `<path d="M30 70 Q28 40 48 30 Q50 50 62 50 Q60 26 80 16 Q84 38 96 40 Q100 20 118 14 Q118 36 132 42 Q140 24 158 26 Q150 46 166 64 Z" fill="#ff5a1f"/>` : '';
      const fur = v === 'yeti' ? `<path d="M36 120 L28 132 L42 130 M164 120 L172 132 L158 130 M70 176 L64 188 M130 176 L136 188" stroke="${O}" stroke-width="3"/>` : '';
      return `<defs>${lg('b' + u, [[0, c.main], [1, c.dark]])}</defs>
      <ellipse cx="100" cy="186" rx="78" ry="11" fill="#000" opacity=".25"/>
      ${G(`${mane}
        <path d="M30 186 Q20 120 52 92 L148 92 Q180 120 170 186 Z" fill="url(#b${u})"/>
        <ellipse cx="44" cy="170" rx="22" ry="16" fill="${c.dark}"/><ellipse cx="156" cy="170" rx="22" ry="16" fill="${c.dark}"/>
        ${ear}
        <ellipse cx="100" cy="88" rx="56" ry="46" fill="${v === 'lion' ? c.main : c.main}"/>
        <ellipse cx="100" cy="112" rx="${v === 'boar' ? 30 : 24}" ry="${v === 'boar' ? 20 : 16}" fill="${v === 'yeti' ? '#bfe6ff' : c.light}"/>`, 4)}
      ${fur}
      ${v === 'boar' ? `<path d="M74 118 Q62 106 66 92 Q74 104 82 110 Z M126 118 Q138 106 134 92 Q126 104 118 110 Z" fill="#fff8e7" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
        <ellipse cx="90" cy="112" rx="5" ry="7" fill="${O}"/><ellipse cx="110" cy="112" rx="5" ry="7" fill="${O}"/>`
      : `<path d="M92 106 Q100 100 108 106 Q100 116 92 106 Z" fill="${O}"/><path d="M88 124 Q100 132 112 124" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
        ${v === 'hound' || v === 'yeti' ? `<path d="M86 126 L90 136 L94 127 M106 127 L110 136 L114 126" fill="#fff" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>` : ''}`}
      <path d="M62 70 L86 78 M138 70 L114 78" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="76" cy="84" rx="8" ry="7" fill="${v === 'hound' ? '#ff3b3b' : v === 'lion' ? '#2a5ad6' : '#ffd34d'}" stroke="${O}" stroke-width="2.4"/>
      <ellipse cx="124" cy="84" rx="8" ry="7" fill="${v === 'hound' ? '#ff3b3b' : v === 'lion' ? '#2a5ad6' : '#ffd34d'}" stroke="${O}" stroke-width="2.4"/>
      <circle cx="77" cy="84" r="3" fill="${O}"/><circle cx="123" cy="84" r="3" fill="${O}"/>
      ${v === 'lion' ? `<path d="M70 40 L100 26 L130 40 L124 52 L76 52 Z" fill="#ffd34d" stroke="${O}" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="38" r="5" fill="#ff4a5e" stroke="${O}" stroke-width="2"/>` : ''}`;
    },
    insect(u, c, v) {
      const legs = `<path d="M60 130 L24 112 L12 136 M58 146 L20 150 L14 176 M64 162 L34 180 M140 130 L176 112 L188 136 M142 146 L180 150 L186 176 M136 162 L166 180" fill="none" stroke-width="6"/>
        <path d="M60 130 L24 112 L12 136 M58 146 L20 150 L14 176 M64 162 L34 180 M140 130 L176 112 L188 136 M142 146 L180 150 L186 176 M136 162 L166 180" fill="none" stroke="${c.dark}" stroke-width="2.6"/>`;
      let body = '';
      if (v === 'beetle') {
        body = `${legs}<ellipse cx="100" cy="132" rx="60" ry="54" fill="${c.main}"/>
          <path d="M100 80 L100 184" stroke-width="3"/>
          <ellipse cx="100" cy="74" rx="34" ry="24" fill="${c.dark}"/>
          <path d="M92 58 Q86 20 100 4 Q114 20 108 58 Z" fill="${c.dark}"/>
          <path d="M100 4 Q118 6 120 22 Q110 18 104 24 Z" fill="${c.dark}"/>`;
      } else if (v === 'bee') {
        body = `<ellipse cx="44" cy="76" rx="40" ry="24" fill="#e8f7ff" opacity=".9" transform="rotate(-24 44 76)"/>
          <ellipse cx="156" cy="76" rx="40" ry="24" fill="#e8f7ff" opacity=".9" transform="rotate(24 156 76)"/>
          ${legs}
          <ellipse cx="100" cy="138" rx="52" ry="46" fill="${c.main}"/>
          <path d="M52 124 Q100 136 148 124 L150 140 Q100 152 50 140 Z M56 158 Q100 170 144 158 L138 170 Q100 182 62 170 Z" fill="${c.dark}"/>
          <path d="M92 182 L100 198 L108 182 Z" fill="${c.dark}"/>
          <circle cx="100" cy="78" r="30" fill="${c.main}"/>
          <path d="M70 52 L76 30 L88 44 L100 24 L112 44 L124 30 L130 52 Q100 42 70 52 Z" fill="#ffd34d"/>`;
      } else if (v === 'scorpion') {
        body = `${legs}
          <path d="M100 120 Q150 110 160 70 Q166 30 132 20 Q110 18 104 40" fill="none" stroke-width="16"/>
          <path d="M100 120 Q150 110 160 70 Q166 30 132 20 Q110 18 104 40" fill="none" stroke="${c.main}" stroke-width="10"/>
          <path d="M104 40 L92 30 L112 28 Z" fill="${c.light}" stroke-width="3"/>
          <ellipse cx="100" cy="140" rx="54" ry="38" fill="${c.main}"/>
          <path d="M58 132 L142 132 M62 150 L138 150" stroke-width="3"/>
          <path d="M52 118 Q24 104 22 76" fill="none" stroke-width="10"/><path d="M148 118 Q176 104 178 76" fill="none" stroke-width="10"/>
          <path d="M8 70 Q20 46 40 62 Q30 68 32 80 Q16 86 8 70 Z" fill="${c.light}"/>
          <path d="M192 70 Q180 46 160 62 Q170 68 168 80 Q184 86 192 70 Z" fill="${c.light}"/>
          <ellipse cx="100" cy="100" rx="30" ry="20" fill="${c.main}"/>`;
      } else {
        body = `<path d="M60 112 L18 70 L6 106 M56 128 L10 128 L4 166 M60 146 L22 178 M140 112 L182 70 L194 106 M144 128 L190 128 L196 166 M140 146 L178 178" fill="none" stroke-width="7"/>
          <path d="M60 112 L18 70 L6 106 M56 128 L10 128 L4 166 M60 146 L22 178 M140 112 L182 70 L194 106 M144 128 L190 128 L196 166 M140 146 L178 178" fill="none" stroke="${c.dark}" stroke-width="3"/>
          <ellipse cx="100" cy="146" rx="54" ry="44" fill="${c.main}"/>
          <path d="M100 116 L84 136 L100 156 L116 136 Z" fill="${c.light}"/>
          <ellipse cx="100" cy="90" rx="34" ry="28" fill="${c.dark}"/>`;
      }
      const eyes = v === 'spider'
        ? [[86, 84, 6], [114, 84, 6], [76, 96, 4], [124, 96, 4], [92, 100, 3.4], [108, 100, 3.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff4a5e" stroke="${O}" stroke-width="1.6"/>`).join('')
        : v === 'beetle' ? `<circle cx="86" cy="76" r="6" fill="#ffe066" stroke="${O}" stroke-width="2"/><circle cx="114" cy="76" r="6" fill="#ffe066" stroke="${O}" stroke-width="2"/>`
        : v === 'bee' ? `<ellipse cx="88" cy="80" rx="7" ry="9" fill="${O}"/><ellipse cx="112" cy="80" rx="7" ry="9" fill="${O}"/><circle cx="90" cy="76" r="2.6" fill="#fff"/><circle cx="114" cy="76" r="2.6" fill="#fff"/><path d="M92 94 Q100 100 108 94" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`
        : `<circle cx="88" cy="96" r="6" fill="${O}"/><circle cx="112" cy="96" r="6" fill="${O}"/><circle cx="89" cy="94" r="2" fill="#ff4a5e"/><circle cx="113" cy="94" r="2" fill="#ff4a5e"/>`;
      return `<ellipse cx="100" cy="188" rx="80" ry="10" fill="#000" opacity=".22"/>
      ${G(body, 4)}
      ${v === 'beetle' ? `<path d="M60 120 Q66 100 84 94" stroke="#fff" stroke-width="6" fill="none" opacity=".45" stroke-linecap="round"/>` : ''}
      ${eyes}`;
    },
    flower(u, c) {
      const petals = Array.from({ length: 8 }, (_, i) => {
        const a = i * 45;
        return `<ellipse cx="100" cy="46" rx="26" ry="40" fill="${i % 2 ? c.main : c.light}" transform="rotate(${a} 100 100)"/>`;
      }).join('');
      return `<ellipse cx="100" cy="188" rx="70" ry="10" fill="#000" opacity=".22"/>
      ${G(`<path d="M30 190 Q40 160 70 150 M170 190 Q160 160 130 150 M60 186 Q20 170 18 140 M140 186 Q180 170 182 140" fill="none" stroke-width="9"/>
        <path d="M30 190 Q40 160 70 150 M170 190 Q160 160 130 150 M60 186 Q20 170 18 140 M140 186 Q180 170 182 140" fill="none" stroke="#3cb44b" stroke-width="5"/>
        <path d="M18 140 Q8 126 20 116 Q28 130 18 140 Z M182 140 Q192 126 180 116 Q172 130 182 140 Z" fill="#3cb44b"/>
        ${petals}
        <circle cx="100" cy="100" r="40" fill="#ffe066"/>`, 4)}
      <circle cx="100" cy="100" r="30" fill="#ffd23d"/>
      <ellipse cx="86" cy="96" rx="6" ry="8" fill="${O}"/><ellipse cx="114" cy="96" rx="6" ry="8" fill="${O}"/>
      <circle cx="88" cy="93" r="2.4" fill="#fff"/><circle cx="116" cy="93" r="2.4" fill="#fff"/>
      <path d="M88 114 Q100 124 112 114" fill="${c.dark}" stroke="${O}" stroke-width="3" stroke-linecap="round"/>
      <path d="M78 84 L92 88 M122 84 L108 88" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`;
    },
    golem(u, c, v) {
      const lava = v === 'lava';
      return `<defs>${lg('g' + u, [[0, c.main], [1, c.dark]], 0, 0, 1, 1)}</defs>
      <ellipse cx="100" cy="186" rx="80" ry="11" fill="#000" opacity=".25"/>
      ${G(`<rect x="10" y="98" width="40" height="56" rx="12" fill="url(#g${u})"/>
        <rect x="150" y="98" width="40" height="56" rx="12" fill="url(#g${u})"/>
        <rect x="56" y="150" width="34" height="36" rx="8" fill="url(#g${u})"/>
        <rect x="110" y="150" width="34" height="36" rx="8" fill="url(#g${u})"/>
        <path d="M40 160 L34 88 Q40 50 100 44 Q160 50 166 88 L160 160 Z" fill="url(#g${u})"/>
        <rect x="68" y="16" width="64" height="46" rx="14" fill="url(#g${u})"/>
        ${lava ? `<path d="M60 90 L80 110 L72 130 L92 150 M140 92 L124 112 L136 134 M100 60 L106 80" fill="none" stroke="#ff8a1e" stroke-width="5"/>` : `<path d="M60 90 L80 110 L72 130 M140 92 L124 112 L136 134" fill="none" stroke-width="2.6"/>`}`, 4)}
      ${!lava ? `<path d="M68 26 Q84 8 100 16 Q118 6 132 26 Q120 22 110 28 Q98 20 86 28 Q76 22 68 26 Z" fill="${c.light}" stroke="${O}" stroke-width="3"/>
        <path d="M36 92 Q46 80 60 86 Q50 96 36 92 Z M164 92 Q154 80 140 86 Q150 96 164 92 Z" fill="${c.light}" stroke="${O}" stroke-width="2.4"/>` : `<circle cx="22" cy="104" r="6" fill="#ffd27a"/><circle cx="178" cy="110" r="5" fill="#ffd27a"/>`}
      <rect x="78" y="34" width="44" height="12" rx="5" fill="${O}"/>
      <circle cx="90" cy="40" r="4.6" fill="${lava ? '#ffe066' : '#ffd34d'}"/><circle cx="110" cy="40" r="4.6" fill="${lava ? '#ffe066' : '#ffd34d'}"/>
      <path d="M86 110 Q100 100 114 110" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round" opacity=".6"/>
      <circle cx="100" cy="88" r="10" fill="${lava ? '#ff5a1f' : c.light}" stroke="${O}" stroke-width="3"/>`;
    },
    dragon(u, c, v) {
      const bone = v === 'bone';
      return `<defs>${lg('d' + u, [[0, c.main], [1, c.dark]])}</defs>
      <ellipse cx="100" cy="188" rx="80" ry="10" fill="#000" opacity=".25"/>
      ${G(`<path d="M76 104 Q30 70 6 86 Q12 100 4 116 Q20 110 26 126 Q36 112 46 126 Q52 112 66 124 Z" fill="${bone ? 'none' : c.dark}" ${bone ? `stroke-width="5"` : ''}/>
        <path d="M124 104 Q170 70 194 86 Q188 100 196 116 Q180 110 174 126 Q164 112 154 126 Q148 112 134 124 Z" fill="${bone ? 'none' : c.dark}" ${bone ? `stroke-width="5"` : ''}/>
        <path d="M54 186 Q44 130 70 100 L130 100 Q156 130 146 186 Z" fill="url(#d${u})"/>
        <path d="M78 116 Q100 126 122 116 M74 136 Q100 148 126 136 M74 158 Q100 170 126 158" fill="none" stroke-width="2.6"/>
        <path d="M66 40 L52 6 L80 30 Z M134 40 L148 6 L120 30 Z" fill="${c.light}"/>
        <path d="M58 70 Q56 30 100 26 Q144 30 142 70 Q140 92 100 98 Q60 92 58 70 Z" fill="url(#d${u})"/>
        <path d="M74 80 Q100 112 126 80 Q122 104 100 110 Q78 104 74 80 Z" fill="${bone ? c.main : c.light}"/>`, 4)}
      ${bone ? `<path d="M80 124 L120 124 M80 140 L120 140 M82 156 L118 156" stroke="${O}" stroke-width="5"/>` : ''}
      <path d="M76 56 L92 62 L76 68 Z M124 56 L108 62 L124 68 Z" fill="${bone ? '#b98cff' : '#ffe066'}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="90" cy="86" r="3" fill="${O}"/><circle cx="110" cy="86" r="3" fill="${O}"/>
      <path d="M86 96 L90 104 L94 97 M106 97 L110 104 L114 96" fill="#fff" stroke="${O}" stroke-width="2" stroke-linejoin="round"/>`;
    },
    serpent(u, c, v) {
      const worm = v === 'worm', liz = v === 'lizard';
      return `<defs>${lg('n' + u, [[0, c.main], [1, c.dark]])}</defs>
      <ellipse cx="100" cy="186" rx="80" ry="11" fill="#000" opacity=".25"/>
      ${G(`<ellipse cx="100" cy="164" rx="80" ry="24" fill="url(#n${u})"/>
        <path d="M40 160 Q100 190 160 160" fill="none" stroke="${c.light}" stroke-width="6"/>
        <path d="M70 164 Q60 120 84 88 Q100 66 96 40" fill="none" stroke-width="44"/>
        <path d="M70 164 Q60 120 84 88 Q100 66 96 40" fill="none" stroke="url(#n${u})" stroke-width="36"/>
        ${worm ? `<path d="M64 130 Q80 136 92 128 M70 104 Q86 112 98 104" fill="none" stroke-width="2.4"/>` : `<path d="M72 128 Q84 124 90 116 M80 102 Q90 96 94 88" fill="none" stroke="${c.light}" stroke-width="4"/>`}
        ${liz ? `<path d="M30 150 L14 174 M170 150 L186 174" stroke-width="10"/><path d="M30 150 L14 174 M170 150 L186 174" stroke="${c.main}" stroke-width="5"/>` : ''}
        ${worm ? `<circle cx="98" cy="40" r="38" fill="url(#n${u})"/><circle cx="98" cy="40" r="24" fill="#5a1a2a"/>`
        : `<ellipse cx="104" cy="40" rx="40" ry="30" fill="url(#n${u})"/>`}`, 4)}
      ${worm ? Array.from({ length: 10 }, (_, i) => { const a = i * 36 * Math.PI / 180; return `<path d="M${98 + Math.cos(a) * 24} ${40 + Math.sin(a) * 24} L${98 + Math.cos(a) * 14} ${40 + Math.sin(a) * 14}" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`; }).join('')
        : `<path d="M70 50 Q104 64 140 46" fill="none" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M78 28 L94 34 L78 40 Z M130 26 L116 32 L130 38 Z" fill="#ffe066" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M100 56 L104 76 L98 70 L96 80" fill="none" stroke="#ff4a5e" stroke-width="3.4" stroke-linecap="round"/>
        ${liz ? `<path d="M90 10 Q96 -4 106 6 Q112 -6 120 8" fill="#ffb13d" stroke="${O}" stroke-width="2.6"/>` : ''}`}`;
    },
    knight(u, c, v) {
      const head = v === 'pharaoh'
        ? `<path d="M56 96 Q48 40 100 30 Q152 40 144 96 L130 104 L126 60 L74 60 L70 104 Z" fill="${c.main}"/>
           <path d="M58 70 L142 70 M56 84 L144 84" stroke="${c.dark}" stroke-width="6"/>
           <rect x="74" y="50" width="52" height="56" rx="20" fill="#ffe7a0"/>
           <path d="M90 104 L100 124 L110 104 Z" fill="${c.dark}"/>`
        : v === 'anubis'
        ? `<path d="M64 60 L58 4 L86 40 Z M136 60 L142 4 L114 40 Z" fill="${c.main}"/>
           <path d="M66 96 Q60 46 100 40 Q140 46 134 96 Q120 120 100 122 Q80 120 66 96 Z" fill="${c.main}"/>
           <path d="M84 96 Q100 110 116 96 L114 116 Q100 128 86 116 Z" fill="${c.main}"/>`
        : `<path d="M64 98 Q58 36 100 30 Q142 36 136 98 Z" fill="${c.main}"/>
           <path d="M100 30 L100 8 Q118 0 126 18 Q112 14 104 22" fill="${c.light}"/>
           <rect x="72" y="66" width="56" height="10" rx="4" fill="${O}"/>`;
      return `<defs>${lg('k' + u, [[0, c.light], [0.4, c.main], [1, c.dark]], 0, 0, 1, 1)}</defs>
      <ellipse cx="100" cy="188" rx="76" ry="10" fill="#000" opacity=".25"/>
      ${G(`<path d="M158 30 L170 30 L168 150 L160 150 Z" fill="#e6ecf5"/>
        <rect x="150" y="146" width="28" height="10" rx="4" fill="${c.dark}"/>
        <rect x="158" y="156" width="12" height="24" rx="4" fill="#8a5a2b"/>
        <path d="M44 186 Q36 130 58 104 L142 104 Q164 130 156 186 Z" fill="url(#k${u})"/>
        <path d="M70 120 L130 120 M66 146 L134 146" stroke-width="3"/>
        <ellipse cx="50" cy="114" rx="20" ry="16" fill="url(#k${u})"/><ellipse cx="150" cy="114" rx="20" ry="16" fill="url(#k${u})"/>
        <path d="M10 120 Q14 96 40 100 L48 160 Q24 168 12 150 Z" fill="${c.dark}"/>
        <path d="M24 118 L34 150" stroke="${c.light}" stroke-width="5"/>
        ${head}`, 4)}
      ${v === 'pharaoh' ? `<path d="M84 76 L94 80 L84 84 Z M116 76 L106 80 L116 84 Z" fill="#2a5ad6" stroke="${O}" stroke-width="2.4"/><path d="M90 96 Q100 100 110 96" fill="none" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`
        : v === 'anubis' ? `<path d="M80 70 L94 76 L80 80 Z M120 70 L106 76 L120 80 Z" fill="${c.dark}" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M60 104 Q100 120 140 104" fill="none" stroke="${c.dark}" stroke-width="7"/>`
        : `<circle cx="88" cy="71" r="4" fill="${c.light}"/><circle cx="112" cy="71" r="4" fill="${c.light}"/>`}
      <path d="M100 126 L92 138 L100 150 L108 138 Z" fill="${c.light}" stroke="${O}" stroke-width="2.6"/>`;
    },
    cactus(u, c) {
      return `<defs>${lg('c' + u, [[0, c.main], [1, c.dark]], 0, 0, 1, 0)}</defs>
      <ellipse cx="100" cy="188" rx="66" ry="10" fill="#000" opacity=".22"/>
      ${G(`<path d="M50 130 Q20 130 20 100 L20 70 Q20 56 34 56 Q46 56 46 70 L46 96 L60 96" fill="url(#c${u})"/>
        <path d="M150 116 Q180 116 180 86 L180 60 Q180 46 166 46 Q154 46 154 60 L154 86 L140 86" fill="url(#c${u})"/>
        <rect x="56" y="40" width="88" height="146" rx="44" fill="url(#c${u})"/>
        <path d="M82 54 L82 176 M118 54 L118 176" fill="none" stroke-width="2.4" opacity=".6"/>
        <path d="M70 46 L76 30 L88 42 L100 24 L112 42 L124 30 L130 46 Q100 36 70 46 Z" fill="#ffd34d"/>`, 4)}
      ${[[66, 70], [134, 72], [64, 120], [136, 126], [100, 160], [30, 76], [170, 66]].map(([x, y]) => `<path d="M${x} ${y} l-7 -4 M${x} ${y} l7 -4 M${x} ${y} l0 -8" stroke="${O}" stroke-width="2.2" stroke-linecap="round"/>`).join('')}
      <circle cx="152" cy="40" r="8" fill="${c.light}" stroke="${O}" stroke-width="2.4"/><circle cx="152" cy="40" r="3" fill="#ff7ad9"/>
      <ellipse cx="86" cy="96" rx="7" ry="9" fill="${O}"/><ellipse cx="114" cy="96" rx="7" ry="9" fill="${O}"/>
      <path d="M78 82 L92 88 M122 82 L108 88" stroke="${O}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M86 118 Q100 110 114 118" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`;
    },
    bird(u, c, v) {
      const peng = v === 'penguin', owl = v === 'owl', phx = v === 'phoenix';
      const wing = (side) => {
        const sx = side < 0 ? '' : `transform="translate(200 0) scale(-1 1)"`;
        return peng ? `<path d="M52 100 Q24 130 30 170 Q50 150 60 130 Z" fill="${c.main}" ${sx}/>`
          : `<path d="M70 96 Q30 60 2 70 Q16 80 10 92 Q26 90 22 104 Q38 100 36 116 Q52 108 58 122 Z" fill="${phx ? c.dark : c.main}" ${sx}/>
             ${phx ? `<path d="M40 74 Q20 50 26 30 Q40 50 56 58 Z" fill="${c.light}" ${sx}/>` : ''}`;
      };
      return `<defs>${lg('w' + u, [[0, c.light], [1, c.main]])}</defs>
      <ellipse cx="100" cy="188" rx="70" ry="10" fill="#000" opacity=".22"/>
      ${G(`${wing(-1)}${wing(1)}
        <ellipse cx="100" cy="124" rx="${peng ? 48 : 44}" ry="${peng ? 62 : 56}" fill="${peng ? c.main : 'url(#w' + u + ')'}"/>
        ${peng ? `<ellipse cx="100" cy="132" rx="32" ry="48" fill="${c.light}"/>` : `<ellipse cx="100" cy="136" rx="28" ry="36" fill="${c.light}"/>`}
        <path d="M76 184 L70 194 L84 192 Z M124 184 L130 194 L116 192 Z" fill="#ffb13d"/>
        <circle cx="100" cy="66" r="${owl ? 40 : 34}" fill="${peng ? c.main : 'url(#w' + u + ')'}"/>
        ${owl ? `<path d="M62 40 L56 12 L80 32 Z M138 40 L144 12 L120 32 Z" fill="${c.main}"/>` : ''}
        ${phx ? `<path d="M86 34 Q80 8 92 -2 Q96 18 100 22 Q104 4 116 0 Q112 20 114 36 Z" fill="${c.light}"/>` : ''}
        ${peng ? `<path d="M70 40 L76 22 L88 34 L100 16 L112 34 L124 22 L130 40 Q100 32 70 40 Z" fill="${c.dark}"/>` : ''}`, 4)}
      ${owl ? `<circle cx="84" cy="64" r="14" fill="#fff" stroke="${O}" stroke-width="3"/><circle cx="116" cy="64" r="14" fill="#fff" stroke="${O}" stroke-width="3"/>
        <circle cx="84" cy="64" r="7" fill="${c.light}" stroke="${O}" stroke-width="2"/><circle cx="116" cy="64" r="7" fill="${c.light}" stroke="${O}" stroke-width="2"/>
        <circle cx="84" cy="64" r="3" fill="${O}"/><circle cx="116" cy="64" r="3" fill="${O}"/>`
      : `<circle cx="86" cy="62" r="6" fill="${peng ? '#fff' : O}" stroke="${O}" stroke-width="2"/><circle cx="114" cy="62" r="6" fill="${peng ? '#fff' : O}" stroke="${O}" stroke-width="2"/>
        <circle cx="87" cy="62" r="2.6" fill="${peng ? O : '#fff'}"/><circle cx="115" cy="62" r="2.6" fill="${peng ? O : '#fff'}"/>
        <path d="M74 48 L92 54 M126 48 L108 54" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`}
      <path d="M90 76 L100 ${owl ? 92 : 100} L110 76 Z" fill="#ffb13d" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`;
    },
    crab(u, c) {
      return `<defs>${lg('r' + u, [[0, c.main], [1, c.dark]])}</defs>
      <ellipse cx="100" cy="186" rx="84" ry="11" fill="#000" opacity=".25"/>
      ${G(`<path d="M50 150 L16 176 M60 160 L34 188 M150 150 L184 176 M140 160 L166 188" fill="none" stroke-width="9"/>
        <path d="M50 150 L16 176 M60 160 L34 188 M150 150 L184 176 M140 160 L166 188" fill="none" stroke="${c.main}" stroke-width="5"/>
        <path d="M54 120 Q30 104 34 78" fill="none" stroke-width="14"/><path d="M146 120 Q170 104 166 78" fill="none" stroke-width="14"/>
        <path d="M54 120 Q30 104 34 78" fill="none" stroke="${c.main}" stroke-width="8"/><path d="M146 120 Q170 104 166 78" fill="none" stroke="${c.main}" stroke-width="8"/>
        <path d="M6 56 Q14 20 48 30 Q56 46 42 54 Q52 66 40 82 Q14 84 6 56 Z" fill="url(#r${u})"/>
        <path d="M194 56 Q186 20 152 30 Q144 46 158 54 Q148 66 160 82 Q186 84 194 56 Z" fill="url(#r${u})"/>
        <path d="M24 60 L44 48 M176 60 L156 48" stroke-width="3"/>
        <path d="M24 150 Q16 96 100 90 Q184 96 176 150 Q140 172 100 170 Q60 172 24 150 Z" fill="url(#r${u})"/>
        <path d="M78 98 L74 64 M122 98 L126 64" stroke-width="7"/>
        <circle cx="74" cy="60" r="11" fill="#fff"/><circle cx="126" cy="60" r="11" fill="#fff"/>`, 4)}
      <circle cx="76" cy="60" r="5" fill="${O}"/><circle cx="124" cy="60" r="5" fill="${O}"/>
      <path d="M60 116 Q72 106 86 110" stroke="${c.light}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M86 140 Q100 132 114 140" fill="none" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="140" cy="128" r="5" fill="${c.light}" opacity=".7"/><circle cx="60" cy="140" r="4" fill="${c.light}" opacity=".7"/>`;
    },
    eye(u, c) {
      const tent = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.2, x1 = 100 + Math.cos(a) * 60, y1 = 104 + Math.sin(a) * 60, x2 = 100 + Math.cos(a + 0.35) * 92, y2 = 104 + Math.sin(a + 0.35) * 92;
        return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${(100 + Math.cos(a) * 84).toFixed(1)} ${(104 + Math.sin(a) * 84).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${O}" stroke-width="14" stroke-linecap="round"/>
          <path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${(100 + Math.cos(a) * 84).toFixed(1)} ${(104 + Math.sin(a) * 84).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${c.main}" stroke-width="8" stroke-linecap="round"/>`;
      }).join('');
      return `<defs><radialGradient id="e${u}" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#f0e8f0"/><stop offset="1" stroke-color="#c8b8c8" stop-color="#c8b8c8"/></radialGradient></defs>
      <ellipse cx="100" cy="190" rx="54" ry="8" fill="#000" opacity=".18"/>
      ${tent}
      ${G(`<circle cx="100" cy="104" r="64" fill="url(#e${u})"/>`, 4)}
      <path d="M50 92 Q60 98 64 86 M150 118 Q140 112 138 126 M70 150 Q78 140 84 152" fill="none" stroke="#ff5a6a" stroke-width="2.4" stroke-linecap="round"/>
      <circle cx="100" cy="104" r="34" fill="${c.main}" stroke="${O}" stroke-width="4"/>
      <circle cx="100" cy="104" r="22" fill="${c.dark}"/>
      <ellipse cx="100" cy="104" rx="7" ry="18" fill="${O}"/>
      <circle cx="88" cy="90" r="7" fill="#fff" opacity=".9"/>
      <path d="M36 80 Q100 20 164 80" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>`;
    },
    mech(u, c, v) {
      return `<defs>${lg('h' + u, [[0, c.main], [1, c.dark]], 0, 0, 1, 1)}</defs>
      <ellipse cx="100" cy="188" rx="80" ry="10" fill="#000" opacity=".25"/>
      ${G(`<rect x="8" y="96" width="34" height="62" rx="8" fill="url(#h${u})"/><rect x="158" y="96" width="34" height="62" rx="8" fill="url(#h${u})"/>
        <rect x="14" y="156" width="22" height="14" rx="4" fill="${c.dark}"/><rect x="164" y="156" width="22" height="14" rx="4" fill="${c.dark}"/>
        <rect x="58" y="150" width="30" height="36" rx="6" fill="${c.dark}"/><rect x="112" y="150" width="30" height="36" rx="6" fill="${c.dark}"/>
        <path d="M44 156 L40 90 Q46 64 100 60 Q154 64 160 90 L156 156 Z" fill="url(#h${u})"/>
        <rect x="64" y="12" width="72" height="56" rx="16" fill="url(#h${u})"/>
        <path d="M100 12 L100 -4" stroke-width="5"/><circle cx="100" cy="-2" r="6" fill="${c.light}"/>
        <rect x="72" y="30" width="56" height="20" rx="10" fill="#14101f"/>`, 4)}
      <rect x="80" y="36" width="40" height="8" rx="4" fill="${c.light}"/>
      <circle cx="100" cy="40" r="6" fill="#fff" opacity=".8"/>
      <circle cx="100" cy="108" r="18" fill="#14101f" stroke="${O}" stroke-width="3"/>
      ${v === 'omega' ? `<text x="100" y="117" text-anchor="middle" font-size="26" font-weight="900" fill="${c.light}" font-family="sans-serif">Ω</text>` : `<circle cx="100" cy="108" r="9" fill="${c.light}"/>`}
      <path d="M58 136 L142 136" stroke="${O}" stroke-width="3"/>
      <circle cx="25" cy="120" r="5" fill="${c.light}" stroke="${O}" stroke-width="2"/><circle cx="175" cy="120" r="5" fill="${c.light}" stroke="${O}" stroke-width="2"/>`;
    },
    hades(u) {
      return `<defs>${lg('h' + u, [[0, '#4a3a7a'], [1, '#14101f']])}${lg('f' + u, [[0, '#bff5ff'], [1, '#3f86d6']])}</defs>
      <ellipse cx="100" cy="190" rx="80" ry="9" fill="#000" opacity=".3"/>
      <circle cx="100" cy="100" r="96" fill="#6b3fd4" opacity=".14"/>
      ${G(`<path d="M168 8 L176 8 L172 190 L166 190 Z" fill="#8b8f9c"/>
        <path d="M172 10 Q210 20 196 60 Q184 34 160 30 Z" fill="#e6ecf5"/>
        <path d="M26 188 Q20 110 60 80 L140 80 Q180 110 174 188 L150 176 L130 190 L112 176 L100 190 L88 176 L70 190 L50 176 Z" fill="url(#h${u})"/>
        <path d="M60 84 Q100 120 140 84 L132 100 Q100 132 68 100 Z" fill="#2b2540"/>
        <path d="M56 54 Q50 20 100 14 Q150 20 144 54 Q146 86 100 94 Q54 86 56 54 Z" fill="#f2efe4"/>
        <path d="M58 30 L52 -2 L76 18 L92 -6 L100 14 L108 -6 L124 18 L148 -2 L142 30 Q100 18 58 30 Z" fill="url(#f${u})"/>`, 4)}
      <ellipse cx="82" cy="54" rx="11" ry="13" fill="${O}"/><ellipse cx="118" cy="54" rx="11" ry="13" fill="${O}"/>
      <circle cx="82" cy="56" r="5" fill="#4fe0ff"/><circle cx="118" cy="56" r="5" fill="#4fe0ff"/>
      <path d="M96 68 L100 76 L104 68 Z" fill="${O}"/>
      <path d="M80 82 L84 88 L88 82 L92 88 L96 82 L100 88 L104 82 L108 88 L112 82 L116 88 L120 82" fill="none" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>
      <path d="M100 120 L90 136 L100 152 L110 136 Z" fill="#4fe0ff" stroke="${O}" stroke-width="3"/>`;
    },
  };

  /* ---------------------------------------------------------
   *  小物
   * --------------------------------------------------------- */
  function gearPath(R, r, teeth) {
    const pts = [];
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const w = Math.PI / teeth * 0.55;
      [[a - w * 1.25, r], [a - w * 0.75, R], [a + w * 0.75, R], [a + w * 1.25, r]].forEach(([aa, rr]) =>
        pts.push((Math.cos(aa) * rr).toFixed(1) + ' ' + (Math.sin(aa) * rr).toFixed(1)));
    }
    return 'M' + pts.join(' L') + ' Z';
  }
  const PROP = {
    gear: () => svg('-24 -24 48 48', `<path d="${gearPath(21, 15.5, 8)}" fill="#ffd23d" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <circle r="11" fill="#ffe680"/><circle r="5" fill="#b87800" stroke="${O}" stroke-width="2.4"/>`),
    bossGear: () => svg('-24 -24 48 48', `<path d="${gearPath(21, 14, 10)}" fill="#8b8f9c" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <circle r="9" fill="#5b5f6c" stroke="${O}" stroke-width="2.4"/><circle r="3.4" fill="#ff4a5e"/>`),
    ball: () => svg('-24 -24 48 48', `<circle r="21" fill="#fff" stroke="${O}" stroke-width="3"/>
      <polygon points="0,-7 6.7,-2.2 4.1,5.7 -4.1,5.7 -6.7,-2.2" fill="${O}"/>
      <path d="M0 -7 L0 -14 M6.7 -2.2 L13 -4.5 M4.1 5.7 L8 11.5 M-4.1 5.7 L-8 11.5 M-6.7 -2.2 L-13 -4.5" stroke="${O}" stroke-width="2"/>
      <path d="M-5 -19 L5 -19 L0 -14 Z M17 -9 L19 2 L13 -4.5 Z M12 16 L3 19 L8 11.5 Z M-12 16 L-3 19 L-8 11.5 Z M-17 -9 L-19 2 L-13 -4.5 Z" fill="${O}"/>`),
    drone: () => svg('-24 -24 48 48', `<g stroke="${O}" stroke-width="2.4" stroke-linecap="round">
      <path d="M-14 -10 L14 10 M14 -10 L-14 10" stroke-width="4"/>
      <ellipse cx="-15" cy="-11" rx="8" ry="3" fill="#bfe6ff"/><ellipse cx="15" cy="-11" rx="8" ry="3" fill="#bfe6ff"/>
      <ellipse cx="-15" cy="11" rx="8" ry="3" fill="#bfe6ff"/><ellipse cx="15" cy="11" rx="8" ry="3" fill="#bfe6ff"/>
      <rect x="-9" y="-7" width="18" height="14" rx="5" fill="#5a6378"/></g>
      <circle r="3.4" fill="#4fe0ff"/>`),
    healDrone: () => svg('-24 -24 48 48', `<g stroke="${O}" stroke-width="2.4" stroke-linecap="round">
      <path d="M-14 -10 L14 10 M14 -10 L-14 10" stroke-width="4"/>
      <ellipse cx="-15" cy="-11" rx="8" ry="3" fill="#c9ffd9"/><ellipse cx="15" cy="-11" rx="8" ry="3" fill="#c9ffd9"/>
      <ellipse cx="-15" cy="11" rx="8" ry="3" fill="#c9ffd9"/><ellipse cx="15" cy="11" rx="8" ry="3" fill="#c9ffd9"/>
      <rect x="-10" y="-8" width="20" height="16" rx="6" fill="#ffffff"/></g>
      <path d="M-2.5 -6 L2.5 -6 L2.5 -2.5 L6 -2.5 L6 2.5 L2.5 2.5 L2.5 6 L-2.5 6 L-2.5 2.5 L-6 2.5 L-6 -2.5 L-2.5 -2.5 Z" fill="#3ddc84"/>`),
    bottle: () => svg('-26 -34 52 58', `<g stroke="${O}" stroke-width="2.6" stroke-linejoin="round">
      <path d="M-4 -14 L4 -14 L4 -6 Q12 -2 12 8 L12 18 Q0 22 -12 18 L-12 8 Q-12 -2 -4 -6 Z" fill="#5fcf7a"/>
      <path d="M-4 -14 L4 -14 L5 -19 L-5 -19 Z" fill="#f3e2c0"/></g>
      <path d="M0 -19 Q-6 -26 0 -32 Q2 -26 6 -28 Q6 -22 0 -19 Z" fill="#ff8a1e" stroke="${O}" stroke-width="1.6"/>
      <path d="M-8 4 Q-8 12 -6 14" stroke="#fff" stroke-width="2.4" fill="none" opacity=".6" stroke-linecap="round"/>`),
    meteor: () => svg('-30 -30 60 60', `<path d="M-6 -26 Q10 -18 20 -24 Q14 -10 26 -6 Q14 0 18 12 L4 4 Z" fill="#ffb13d" opacity=".9"/>
      <circle cx="-4" cy="6" r="16" fill="#8b6a5a" stroke="${O}" stroke-width="3"/>
      <circle cx="-10" cy="2" r="4" fill="#6b4a3a"/><circle cx="2" cy="12" r="3" fill="#6b4a3a"/>
      <path d="M-14 -4 Q-8 -10 0 -8" stroke="#ffe066" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
    tomb: (color = '#ff5a5f') => svg('-30 -40 60 70', `<ellipse cx="0" cy="26" rx="24" ry="5" fill="#000" opacity=".25"/>
      <path d="M-18 24 L-18 -14 Q-18 -32 0 -32 Q18 -32 18 -14 L18 24 Z" fill="#a3a9b8" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M0 -22 L0 4 M-9 -12 L9 -12" stroke="${O}" stroke-width="4" stroke-linecap="round"/>
      <path d="M-18 10 L18 10 L18 17 L-18 17 Z" fill="${color}" stroke="${O}" stroke-width="2.4"/>`),
  };

  /* ---------- 公開関数 ---------- */
  function enemySvg(kind) { return ENEMY[kind] ? svg('0 0 100 100', ENEMY[kind]()) : ''; }
  /** ボスの絵（gameConfig の art: { sp: 種類, c: 色, v: 形のちがい } から作る） */
  function bossBody(kind) {
    const d = DS.gameConfig.BOSSES[kind];
    if (!d) return '';
    const a = d.art || { sp: kind };
    const f = SPECIES[a.sp];
    return f ? f(uid(), a.c, a.v) : '';
  }
  function bossSvg(kind) { const b = bossBody(kind); return b ? svg('0 0 200 200', b) : ''; }
  function propSvg(kind, arg) { return PROP[kind] ? PROP[kind](arg) : ''; }
  /** ステージ絵の中に敵を置く（足元が x,y） */
  function foeInline(kind, x, y, size = 46, flip = false) {
    if (!ENEMY[kind]) return '';
    const s = size;
    const inner = `<svg x="${-s / 2}" y="${-s * 0.92}" width="${s}" height="${s}" viewBox="0 0 100 100">${ENEMY[kind]()}</svg>`;
    return `<g transform="translate(${x} ${y}) scale(${flip ? -1 : 1} 1)">${inner}</g>`;
  }
  /** 敵の顔アイコン（丸い枠用） */
  function enemyIcon(kind, cls = 'foe-icon') {
    if (ENEMY[kind]) return `<svg class="${cls}" viewBox="8 4 84 84" xmlns="http://www.w3.org/2000/svg">${ENEMY[kind]()}</svg>`;
    if (DS.gameConfig.BOSSES[kind]) return `<svg class="${cls}" viewBox="10 10 180 180" xmlns="http://www.w3.org/2000/svg">${bossBody(kind)}</svg>`;
    return '';
  }

  Object.assign(DS.art, { enemySvg, bossSvg, propSvg, foeInline, enemyIcon });
})();

/* ---------- スキル・アビリティのアイコン（HUD とレベルアップ画面用） ---------- */
(function () {
  const O = '#231a3a';
  const box = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="${bg}" stroke="${O}" stroke-width="3"/>${body}</svg>`;
  const ICON = {
    kunai: () => box(`<svg x="4" y="4" width="40" height="40" viewBox="0 0 100 100">${DS.art.item('kunai').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#ffe08a'),
    shotgun: () => box(`<svg x="4" y="4" width="40" height="40" viewBox="0 0 100 100">${DS.art.item('shotgun').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#ffe08a'),
    lightsaber: () => box(`<svg x="4" y="4" width="40" height="40" viewBox="0 0 100 100">${DS.art.item('lightsaber').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#ffe08a'),
    revolver: () => box(`<svg x="4" y="4" width="40" height="40" viewBox="0 0 100 100">${DS.art.item('revolver').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#ffe08a'),
    minigun: () => box(`<svg x="4" y="4" width="40" height="40" viewBox="0 0 100 100">${DS.art.item('minigun').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#ffe08a'),
    destroyerPower: () => box(`<svg x="4" y="4" width="40" height="40" viewBox="0 0 100 100">${DS.art.item('destroyerPower').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#e0c8ff'),
    defender: () => box(`<svg x="7" y="7" width="34" height="34" viewBox="-24 -24 48 48">${DS.art.propSvg('gear').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#7fd0ff'),
    drone: () => box(`<svg x="5" y="5" width="38" height="38" viewBox="-24 -24 48 48">${DS.art.propSvg('drone').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#a6f0c6'),
    thunder: () => box(`<path d="M27 6 L12 27 L22 27 L18 42 L36 19 L25 19 L30 6 Z" fill="#ffe14d" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`, '#5b5fd8'),
    soccer: () => box(`<svg x="6" y="6" width="36" height="36" viewBox="-24 -24 48 48">${DS.art.propSvg('ball').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#8fe08a'),
    molotov: () => box(`<svg x="7" y="5" width="34" height="38" viewBox="-26 -34 52 58">${DS.art.propSvg('bottle').replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#ffb36b'),
    gravity: () => box(`<circle cx="24" cy="24" r="15" fill="#3b1f7a" stroke="${O}" stroke-width="2.6"/><path d="M24 12 Q36 14 34 26 Q32 34 24 32 Q18 30 20 24 Q22 20 26 22" fill="none" stroke="#d6b8ff" stroke-width="3" stroke-linecap="round"/>`, '#b98cff'),
    drink: () => box(`<rect x="15" y="9" width="18" height="30" rx="5" fill="#3ddc84" stroke="${O}" stroke-width="2.6"/><rect x="15" y="17" width="18" height="10" fill="#fff"/><path d="M22 18 L19 23 L23 23 L21 27 L27 21 L23 21 L25 18 Z" fill="#ff5a5f"/>`, '#d2ffe3'),
    ammo: () => box(`${[12, 21, 30].map((x) => `<path d="M${x} 38 L${x} 20 Q${x + 3.5} 10 ${x + 7} 20 L${x + 7} 38 Z" fill="#ffc94d" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/><path d="M${x} 32 L${x + 7} 32" stroke="${O}" stroke-width="2"/>`).join('')}`, '#ffd6c2'),
    battery: () => box(`<rect x="12" y="14" width="22" height="24" rx="4" fill="#ffe14d" stroke="${O}" stroke-width="2.6"/><rect x="18" y="9" width="10" height="5" fill="${O}"/><path d="M24 18 L18 27 L23 27 L21 34 L28 24 L24 24 Z" fill="${O}"/>`, '#c7e8ff'),
    vest: () => box(`<path d="M14 12 L20 10 Q24 16 28 10 L34 12 L36 38 L12 38 Z" fill="#5d6b4a" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/><rect x="17" y="22" width="14" height="9" rx="2" fill="#7b8a62" stroke="${O}" stroke-width="2"/>`, '#e4e8d2'),
    scroll: () => box(`<rect x="12" y="12" width="24" height="24" fill="#fff1cf" stroke="${O}" stroke-width="2.6"/><circle cx="12" cy="24" r="4" fill="#c9883a" stroke="${O}" stroke-width="2"/><circle cx="36" cy="24" r="4" fill="#c9883a" stroke="${O}" stroke-width="2"/><path d="M17 19 L31 19 M17 24 L31 24 M17 29 L27 29" stroke="#b07a3a" stroke-width="2"/>`, '#ffe6a6'),
    coin: () => box(`<svg x="8" y="8" width="32" height="32" viewBox="0 0 32 32">${DS.art.coin().replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`, '#fff3b0'),
    heal: () => box(`<path d="M24 38 Q10 28 10 19 Q10 11 17 11 Q22 11 24 16 Q26 11 31 11 Q38 11 38 19 Q38 28 24 38 Z" fill="#ff5a6a" stroke="${O}" stroke-width="2.6" stroke-linejoin="round"/>`, '#ffd6dc'),
  };
  DS.art.skillIcon = (key) => (ICON[key] ? ICON[key]() : '');
})();

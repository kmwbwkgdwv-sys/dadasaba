/* =========================================================
 *  ui.js  ― 画面共通の小さな部品（トースト・モーダル・カード）
 * ========================================================= */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmt = (n) => Number(n).toLocaleString('ja-JP');
  /** 大きな数を「12.3万」「4.56億」のように短く書く（10万未満はそのまま） */
  function fmtBig(n) {
    n = Math.round(Number(n) || 0);
    const a = Math.abs(n), sgn = n < 0 ? '-' : '';
    const cut = (v, d) => String(+v.toFixed(d));
    if (a < 100000) return n.toLocaleString('ja-JP');
    if (a < 1e8) return sgn + (a < 1e6 ? cut(a / 1e4, 1) : Math.floor(a / 1e4).toLocaleString('ja-JP')) + '万';
    if (a < 1e12) return sgn + (a < 1e10 ? cut(a / 1e8, 2) : Math.floor(a / 1e8).toLocaleString('ja-JP')) + '億';
    return sgn + cut(a / 1e12, 2) + '兆';
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg, type = 'info', ms = 2200) {
    const root = $('#toast-root');
    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = msg;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
  }

  /**
   * modal({ title, body, buttons:[{label, cls, onClick, keepOpen}], cls, closable })
   * body は HTML 文字列 または 要素
   */
  function modal(opts) {
    const root = $('#modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal ' + (opts.cls || '');
    wrap.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-card" role="dialog" aria-modal="true">
        ${opts.title ? `<div class="modal-ribbon"><span class="outline">${opts.title}</span></div>` : ''}
        ${opts.closable !== false ? '<button class="modal-x" aria-label="閉じる">×</button>' : ''}
        <div class="modal-body"></div>
        <div class="modal-buttons"></div>
      </div>`;
    const body = $('.modal-body', wrap);
    if (typeof opts.body === 'string') body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    const close = () => {
      if (!wrap.isConnected) return;
      wrap.classList.remove('show');
      setTimeout(() => wrap.remove(), 200);
      if (opts.onClose) opts.onClose();
    };
    (opts.buttons || []).forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || 'btn-gray');
      btn.innerHTML = b.label;
      if (b.disabled) btn.disabled = true;
      btn.addEventListener('click', () => {
        const r = b.onClick ? b.onClick(btn) : undefined;
        if (!b.keepOpen && r !== false) close();
      });
      $('.modal-buttons', wrap).appendChild(btn);
    });
    if (opts.closable !== false) {
      $('.modal-x', wrap).addEventListener('click', close);
      $('.modal-backdrop', wrap).addEventListener('click', close);
    }
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    return { el: wrap, body, close };
  }

  /** 装備カード（レアリティ背景＋アイテムの絵） */
  // ❸ の装備のまわりを走る稲妻
  const BOLTS = `<svg class="icard-bolts" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M8 30 L18 22 L14 36 L26 28" /><path d="M92 62 L82 70 L86 56 L74 64" />
      <path d="M62 6 L56 16 L68 14 L60 26" /><path d="M30 94 L38 84 L26 86 L34 74" /></svg>`;
  /** S装備・SS（ミシック）の金色のマーク */
  function gearMark(itemKey) {
    const C = DS.config;
    if (C.MYTHIC_ITEMS && C.MYTHIC_ITEMS[itemKey]) return C.MYTHIC_ITEMS[itemKey].mark || 'SS';
    return C.ITEMS[itemKey] && C.ITEMS[itemKey].s ? 'S' : '';
  }
  const markHtml = (m) => (m ? `<span class="s-mark ${m === 'SS' ? 'ss' : ''}">${m}</span>` : '');
  function itemCard(itemKey, rarity, extra = {}) {
    const lv = rarity === 'legendPlus' || rarity === 'mythic' ? 0 : extra.lv | 0;
    const mark = DS.config.FUSION.marks[lv] || '';
    const sm = gearMark(itemKey);
    return `<div class="icard r-${rarity} ${lv ? 'fz fz' + lv : ''} ${sm ? 'has-s' : ''} ${extra.cls || ''}" ${extra.attrs || ''}>
      ${lv >= 3 ? BOLTS : ''}${rarity === 'legendPlus' ? '<span class="icard-aura"></span><span class="icard-plus">+</span>' : ''}
      ${rarity === 'mythic' ? '<span class="icard-aura myth"></span><span class="icard-rays"></span>' : ''}
      ${DS.art.item(itemKey)}${markHtml(sm)}
      ${mark ? `<span class="icard-fz">${mark}</span>` : ''}
      ${extra.count > 1 ? `<span class="icard-count">×${extra.count}</span>` : ''}
      ${extra.equipped ? '<span class="icard-eq">E</span>' : ''}
      ${extra.isNew ? '<span class="icard-new">NEW</span>' : ''}
      ${extra.tag ? `<span class="icard-tag">${extra.tag}</span>` : ''}
      ${extra.level > 1 ? `<span class="icard-lv">Lv${extra.level}</span>` : ''}
    </div>`;
  }

  /** キャラのカード（レアリティ背景＋キャラの絵） */
  function charCard(key, extra = {}) {
    const d = DS.config.CHARACTERS[key];
    const rarity = d ? d.rarity : 'common';
    const art = key ? DS.art.charSvg(key) : DS.art.hero(DS.config.PLAYER_COLORS[0]);
    const sm = d && d.s ? 'S' : '';
    return `<div class="icard ccard r-${key ? rarity : 'none'} ${sm ? 'has-s' : ''} ${extra.dim ? 'dim' : ''} ${extra.cls || ''}" ${extra.attrs || ''}>
      ${rarity === 'legendPlus' && key ? '<span class="icard-aura"></span><span class="icard-plus">+</span>' : ''}
      ${art}${markHtml(sm)}
      ${extra.level > 1 ? `<span class="icard-lv">Lv${extra.level}</span>` : ''}
      ${extra.locked ? '<span class="ccard-lock">？</span>' : ''}
      ${extra.count > 1 ? `<span class="icard-count">×${extra.count}</span>` : ''}
      ${extra.equipped ? '<span class="icard-eq">E</span>' : ''}
      ${extra.isNew ? '<span class="icard-new">NEW</span>' : ''}
    </div>`;
  }

  function rarityLabel(rarity) {
    if (rarity === 's') return '<span class="rlabel rl-s">S装備</span>';
    const r = DS.state.RARITY[rarity];
    return `<span class="rlabel rl-${rarity}">${r.name}</span>`;
  }

  const STAT_NAME = { atk: 'ATK', hp: 'HP', spd: '速度' };
  const sign = (n) => (n > 0 ? '+' : '') + n;

  /** 装備の補正・特殊効果を文章の配列にする（ATK・HP は総合力に対する%） */
  function effectLines(itemKey) {
    const d = DS.config.ITEMS[itemKey];
    const out = [];
    if (d.bonus) Object.keys(d.bonus).forEach((k) => {
      const v = d.bonus[k];
      if (k === 'dmgTaken') out.push({ text: `受けるダメージ ${sign(v)}%`, good: v < 0 });
      else out.push({ text: `${STAT_NAME[k]} ${sign(v)}${k === 'spd' ? '' : '%'}`, good: v > 0 });
    });
    if (d.aura) {
      if (d.aura.enemySpd) out.push({ text: `周囲の敵の移動速度 ${sign(d.aura.enemySpd)}`, good: true });
      if (d.aura.enemyAtkSpd) out.push({ text: `周囲の敵の攻撃速度 ${sign(d.aura.enemyAtkSpd)}`, good: true });
    }
    if (d.traits) d.traits.forEach((t) => out.push({ text: t, good: true, tag: true }));
    return out;
  }

  /** パッシブの説明（エピック以上で発動） */
  function passiveLine(itemKey) {
    const d = DS.config.ITEMS[itemKey];
    return d && d.passive ? d.passive : null;
  }

  DS.ui = { $, $$, fmt, fmtBig, esc, toast, modal, itemCard, charCard, rarityLabel, effectLines, passiveLine, sign, STAT_NAME, gearMark };
})();

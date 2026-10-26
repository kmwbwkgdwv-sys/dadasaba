/* =========================================================
 *  record.js  ― 戦績とランキング
 *
 *  戦績：クリアしたステージ・ミニゲームの試合数と勝った数・今の装備・使っているキャラとレベル
 *    ・自分の戦績：左上の名前 →「戦績を見る」
 *    ・フレンドの戦績：フレンド一覧でフレンドをタップ
 *  ランキング：総合力（ATK × 6 ＋ HP。ATK と HP を同じ重さで見る）の順位
 *    ・全体（上位100人）とフレンドの中での順位
 *    ・引き継ぎコードを発行している人が、Firebase の profiles/{uid} に戦績を載せて参加する
 *      { name, fid, icon, lv, seen, pw（総合力）, rec（戦績） }
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { $$, esc, fmt, fmtBig, modal } = U;
  const TOP = 100;
  const TROPHY = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 5 H23 V12 Q23 20 16 21 Q9 20 9 12 Z" fill="#ffd23d" stroke="#231a3a" stroke-width="2.2" stroke-linejoin="round"/>'
    + '<path d="M9 8 H5 Q4 14 10 15 M23 8 H27 Q28 14 22 15" fill="none" stroke="#231a3a" stroke-width="2.2"/><path d="M14 21 H18 V25 H14 Z" fill="#ffb400" stroke="#231a3a" stroke-width="2"/>'
    + '<rect x="10" y="25" width="12" height="4" rx="1.5" fill="#c77a00" stroke="#231a3a" stroke-width="2"/><path d="M13 9 V13" stroke="#fff6c2" stroke-width="2" stroke-linecap="round"/></svg>';

  /** 総合力：HP はおおよそ ATK の6倍なので、ATK を6倍して足す（ATK と HP を同じ重さで見る） */
  function power(atk, hp) { return Math.round(atk * ((C.RANKING && C.RANKING.atkWeight) || 6) + hp); }

  /* ---------- 自分の戦績を作る ---------- */
  function mine() {
    const sv = S.data, st = S.getStats(), stt = sv.stats;
    const gear = {};
    C.SLOTS.forEach(({ key }) => {
      const p = S.parseKey(sv.equipped[key]);
      gear[key] = p ? [p.item, p.rarity, p.lv, S.itemLevel(p.key)].join(':') : '';
    });
    const g = {};
    C.MINIGAMES.list.forEach((x) => { g[x.key] = [stt['mgP_' + x.key] | 0, stt['mgW_' + x.key] | 0]; });
    const atk = Math.round(st.atk), hp = Math.round(st.hp);
    return {
      name: sv.name, icon: sv.icon || sv.look || '', lv: S.accountInfo().lv,
      atk, hp, pw: power(atk, hp),
      stage: S.progress() + 1,
      gear, char: sv.char || '', charLv: sv.char ? S.charLevel(sv.char) : 0, look: sv.look || '',
      mg: { p: stt.mgPlay | 0, w: stt.mgWin | 0, g },
    };
  }

  /* ---------- 戦績の画面 ---------- */
  function gearCell(slot, str) {
    const sl = C.SLOTS.find((x) => x.key === slot);
    const [item, rarity, lv, level] = String(str || '').split(':');
    if (!C.ITEMS[item] || !S.RARITY[rarity]) return `<div class="rec-gear empty"><span class="rec-gear-none">なし</span><small>${esc(sl.name)}</small></div>`;
    return `<div class="rec-gear">${U.itemCard(item, rarity, { cls: 'mini', lv: lv | 0, level: level | 0 })}
      <b>${esc(C.ITEMS[item].name)}</b><small>${esc(sl.name)}　${U.rarityLabel(rarity)}</small></div>`;
  }
  function recordHtml(r, o = {}) {
    const st = Math.max(0, Math.min(C.STAGES.length, r.stage | 0));
    const sg = st ? C.STAGES[st - 1] : null;
    const mg = r.mg || { p: 0, w: 0, g: {} };
    const rate = mg.p ? Math.round(mg.w / mg.p * 100) : 0;
    const ch = C.CHARACTERS[r.char];
    return `<div class="prec">
      <div class="rec-head">
        <span class="rec-face">${A.charFace(C.CHARACTERS[r.icon] ? r.icon : null)}</span>
        <div class="rec-name"><b>${esc(r.name || '')}</b><span class="acc-lv">Lv ${r.lv | 0}</span>${o.seen ? `<small>${o.seen}</small>` : ''}</div>
        ${o.rank ? `<span class="rec-rank">${TROPHY}<b>${o.rank}</b>位</span>` : ''}
      </div>
      <div class="rec-power"><small>総合力（ATK×6＋HP）</small><b>${fmtBig(r.pw || 0)}</b>
        <span><b class="c-atk">ATK</b> ${fmtBig(r.atk || 0)}　<b class="c-hp">HP</b> ${fmtBig(r.hp || 0)}</span></div>
      <h3 class="sub-head">ステージ</h3>
      <div class="rec-stage">${sg
        ? `<b>STAGE ${sg.no}</b><span>「${esc(sg.name)}」までクリア</span>`
        : '<span>まだステージをクリアしていません</span>'}
        <span class="rec-bar"><i style="width:${st / C.STAGES.length * 100}%"></i><em>${st} / ${C.STAGES.length}</em></span></div>
      <h3 class="sub-head">ミニゲーム</h3>
      <div class="rec-mg">
        <div class="rec-mg-total"><span><small>試合</small><b>${fmt(mg.p | 0)}</b></span><span><small>勝利</small><b>${fmt(mg.w | 0)}</b></span><span><small>勝率</small><b>${rate}%</b></span></div>
        <div class="rec-mg-list">${C.MINIGAMES.list.map((x) => {
          const v = (mg.g && mg.g[x.key]) || [0, 0];
          return `<span class="rec-mg-one"><i>${DS.minigame.icon(x.key)}</i><small>${esc(x.name)}</small><b>${v[0] | 0}戦 ${v[1] | 0}勝</b></span>`;
        }).join('')}</div>
      </div>
      <h3 class="sub-head">装備</h3>
      <div class="rec-gears">${C.SLOTS.map(({ key }) => gearCell(key, r.gear && r.gear[key])).join('')}</div>
      <h3 class="sub-head">キャラ</h3>
      <div class="rec-char">${ch
        ? `${U.charCard(r.char, { cls: 'mini', level: r.charLv | 0 })}<div><b>${esc(ch.name)}</b>${U.rarityLabel(ch.rarity)}<span class="rec-clv">キャラLv <b>${r.charLv | 0}</b></span>
            ${ch.skill ? `<small>${esc(ch.skill.name)}：${esc(ch.skill.desc)}</small>` : ''}</div>`
        : '<span class="rec-none">キャラを使っていません</span>'}</div>
    </div>`;
  }
  function show(r, o = {}) {
    if (!r) {
      modal({ title: '戦績', body: `<p class="center">${esc(o.name || '')} さんの戦績はまだありません。<br><small>（相手が新しいバージョンで遊ぶと表示されます）</small></p>`, buttons: [{ label: 'とじる', cls: 'btn-gray' }] });
      return;
    }
    modal({ title: o.title || '戦績', cls: 'modal-wide modal-rec', body: recordHtml(r, o), buttons: [{ label: 'とじる', cls: 'btn-gray' }] });
  }
  function showMine() { show(mine(), { title: 'あなたの戦績', rank: myRankCache || null }); }

  /* ---------- ランキング ---------- */
  let myRankCache = 0;
  const seenText = (t) => {
    if (!t) return '';
    const m = Math.floor((Date.now() - t) / 60000);
    return m < 3 ? 'オンライン' : m < 60 ? `${m}分前` : m < 1440 ? `${Math.floor(m / 60)}時間前` : `${Math.floor(m / 1440)}日前`;
  };
  function unavailable(st) {
    modal({
      title: 'ランキング',
      body: st === 'test'
        ? '<p class="center">ランキングは <b>Firebase を設定すると</b> 使えます。<br><small>（いまはテストモードです）</small></p>'
        : '<p class="center">ランキングは <b>引き継ぎコードを発行すると</b> 参加できます。</p>',
      buttons: st === 'noacct'
        ? [{ label: 'とじる', cls: 'btn-gray' }, { label: '引き継ぎコードを発行', cls: 'btn-yellow', onClick: () => DS.cloud.openProfile() }]
        : [{ label: 'とじる', cls: 'btn-gray' }],
    });
  }
  async function loadAll() {
    const api = DS.cloud.api, me = api.uid();
    const r = (await api.query('profiles', { orderBy: '"pw"', limitToLast: TOP })) || {};
    const list = Object.keys(r).map((uid) => Object.assign({ uid }, r[uid])).filter((x) => x && x.name).sort((a, b) => (b.pw || 0) - (a.pw || 0));
    let myRank = list.findIndex((x) => x.uid === me) + 1;
    if (!myRank) {
      // 上位に入っていないとき：自分より総合力が高い人を数える
      const pw = mine().pw;
      const above = (await api.query('profiles', { orderBy: '"pw"', startAt: pw + 1, limitToFirst: 1000 }).catch(() => null)) || {};
      myRank = Object.keys(above).length + 1;
    }
    return { list, myRank };
  }
  async function loadFriends() {
    const me = DS.cloud.api.uid(), m = mine();
    const fr = await DS.friends.list();
    const list = fr.map((f) => ({ uid: f.uid, name: f.name, icon: f.icon, lv: f.lv, seen: f.seen, pw: f.pw || 0, rec: f.rec }))
      .concat([{ uid: me, name: m.name, icon: m.icon, lv: m.lv, pw: m.pw, rec: m, seen: Date.now() }])
      .sort((a, b) => (b.pw || 0) - (a.pw || 0));
    return { list, myRank: list.findIndex((x) => x.uid === me) + 1 };
  }
  async function openRanking() {
    const st = DS.friends.state();
    if (st !== 'ok') { unavailable(st); return; }
    const m = modal({
      title: 'ランキング', cls: 'modal-wide modal-rank',
      body: `<p class="rk-lead">${TROPHY}<span><b>総合力（ATK×6＋HP）</b>の順位です。ATK と HP を同じ重さで見ています。引き継ぎコードを発行している人がのっています</span></p>
        <div class="seg rk-seg"><button class="seg-btn active" data-t="all">全体</button><button class="seg-btn" data-t="friends">フレンド</button></div>
        <div class="rk-body"><p class="center rk-loading">読み込み中…</p></div>`,
      buttons: [{ label: 'とじる', cls: 'btn-gray' }],
    });
    const body = m.el.querySelector('.rk-body');
    let tab = 'all', token = 0;
    const load = async () => {
      const my = ++token;
      body.innerHTML = '<p class="center rk-loading">読み込み中…</p>';
      try {
        await DS.friends.heartbeat().catch(() => {});      // 自分の最新の総合力を載せてから読む
        const r = tab === 'all' ? await loadAll() : await loadFriends();
        if (my !== token || !m.el.isConnected) return;
        if (tab === 'all') myRankCache = r.myRank;
        const me = DS.cloud.api.uid();
        const mineRow = r.list.find((x) => x.uid === me);
        body.innerHTML = `
          <div class="rk-me"><span>あなたの順位</span><b>${r.myRank ? `${fmt(r.myRank)}位` : '—'}</b><small>総合力 ${fmtBig(mineRow ? mineRow.pw : mine().pw)}</small></div>
          ${r.list.length ? `<div class="rk-list">${r.list.map((x, i) => `
            <button class="rk-row ${x.uid === me ? 'me' : ''} ${i < 3 ? 'top' + (i + 1) : ''}" data-i="${i}">
              <span class="rk-no">${i < 3 ? `<i>${i + 1}</i>` : i + 1}</span>
              <span class="rk-face">${A.charFace(C.CHARACTERS[x.icon] ? x.icon : null)}</span>
              <span class="rk-txt"><b>${esc(x.name || '')}</b><small>Lv ${x.lv | 0}${x.rec ? `　STAGE ${x.rec.stage | 0}` : ''}</small></span>
              <span class="rk-pw"><b>${fmtBig(x.pw || 0)}</b><small>総合力</small></span>
            </button>`).join('')}</div>`
            : '<p class="center">まだだれものっていません</p>'}
          ${tab === 'all' ? `<p class="note dark center">上位${TOP}人まで表示しています。名前をタップすると戦績が見られます</p>` : '<p class="note dark center">名前をタップすると戦績が見られます</p>'}`;
        $$('.rk-row', body).forEach((b) => b.addEventListener('click', () => {
          const x = r.list[+b.dataset.i];
          show(x.rec, { name: x.name, rank: +b.dataset.i + 1, seen: x.uid === me ? '' : seenText(x.seen), title: x.uid === me ? 'あなたの戦績' : `${x.name} さんの戦績` });
        }));
      } catch (e) {
        if (my !== token || !m.el.isConnected) return;
        const code = e && e.code;
        // 前のルールのまま（profiles 全体が読めない・並べ替えの設定がない）
        body.innerHTML = `<p class="center warn-text">${esc(DS.cloud.message(code === 'denied' ? 'index' : code))}</p>`;
      }
    };
    $$('.rk-seg .seg-btn', m.el).forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.t;
      $$('.rk-seg .seg-btn', m.el).forEach((x) => x.classList.toggle('active', x === b));
      load();
    }));
    load();
  }

  DS.record = { mine, show, showMine, openRanking, recordHtml, TROPHY };
})();

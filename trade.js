/* =========================================================
 *  trade.js  ― フレンドと装備・キャラをトレードする（Firebase を設定したときだけ）
 *
 *  流れ
 *    1. A さんが「出す装備」と「もらいたい装備（なし＝プレゼントも可）」を選んで申し込む
 *       → 出す装備は A さんの持ち物から預かり（いったん減る）、申し込みを書く
 *    2. B さんに申し込みが届く → 承認すると、B さんの「出す装備」が減って A さんの装備が増える
 *       断ると何も変わらない
 *    3. A さんの画面が結果を見つけて、承認なら B さんの装備が増える／断られたら預けた装備が戻る
 *    A さんは、相手が承認する前なら取り消せる（預けた装備が戻る）
 *
 *  Realtime Database の形（README のルールで守る）
 *    tradeInv/{uid}         : { inv: { 装備のキー: 数 }, eq: [装備中のキー], ch: { キャラ: 数 }, at }  … フレンドだけが見られる持ち物
 *    （トレードのキー：装備は 'kunai:epic:0'、キャラは 'c:widow'）
 *    trades/{相手}/{自分}   : { id, give, want, name, fid, at, state }           … トレードの申し込み（1人に1つまで）
 *        state：'offer'（申し込み中）→ 'accepted'（承認）/ 'declined'（断った）/ 'canceled'（取り消し）
 *        状態はルールで「申し込み中」からしか変えられないので、承認と取り消しが同時でも片方だけが通る
 *
 *  ※ 装備のレベル（設計図で上げたもの）は相手に移りません。最後の1つを出すと、
 *     その装備のレベルは1に戻り、使った設計図とコインが戻ります（合成と同じ）
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { $, $$, esc, toast, modal } = U;
  const TS = { '.sv': 'timestamp' };
  const api = () => DS.cloud.api;
  const me = () => api().uid();
  const usable = () => DS.friends && DS.friends.state() === 'ok';
  const T = () => S.data.trades;
  const errMsg = (e) => DS.cloud.message(e && e.code);
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const SWAP = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 11h17l-4-4M26 21H9l4 4" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- 見た目のための小物 ---------- */
  // トレードのキー：装備は 'kunai:epic:0'、キャラは 'c:widow'
  const SLOT_ORDER = C.SLOTS.map((x) => x.key).concat(['char']);
  /** キーを表示用の形にする { key, name, rar, lv, slot（キャラは 'char'）, char, item, rarity, count } */
  function entry(key, count) {
    const c = S.charOfKey(key);
    if (c) { const d = C.CHARACTERS[c]; return { key, char: c, name: d.name, rar: S.RARITY[d.rarity], rarity: d.rarity, lv: 0, slot: 'char', count: count | 0 }; }
    const p = S.parseKey(key);
    return p ? Object.assign(p, { name: p.def.name, count: count | 0 }) : null;
  }
  function itemName(key) {
    const e = entry(key);
    if (!e) return '？';
    return e.char ? `${e.rar.name}キャラ ${e.name}` : `${e.rar.name}${C.FUSION.marks[e.lv] || ''} ${e.name}`;
  }
  const card = (key, extra) => {
    const e = entry(key);
    if (!e) return '';
    return e.char ? U.charCard(e.char, extra || {}) : U.itemCard(e.item, e.rarity, Object.assign({ lv: e.lv }, extra || {}));
  };
  const order = (a, b) => b.rar.rank - a.rar.rank || b.lv - a.lv
    || SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.name.localeCompare(b.name);

  /* ---------- 自分の持ち物を、フレンドが見られる場所に書く ---------- */
  let invSig = '';
  function publishInv(force) {
    if (!usable()) return Promise.resolve();
    const inv = {};
    Object.keys(S.data.inventory).forEach((k) => { if (S.data.inventory[k] > 0 && S.parseKey(k)) inv[k] = S.data.inventory[k]; });
    const eq = C.SLOTS.map(({ key }) => S.data.equipped[key]).filter(Boolean);
    const ch = {};   // キャラ（v15）
    Object.keys(S.data.chars).forEach((k) => { if (S.data.chars[k] > 0 && C.CHARACTERS[k]) ch[k] = S.data.chars[k]; });
    const sig = JSON.stringify([inv, eq, ch]);
    if (!force && sig === invSig) return Promise.resolve();
    invSig = sig;
    return api().put('tradeInv/' + me(), { inv, eq, ch, at: TS }).catch(() => { invSig = ''; });
  }
  /** フレンドの持ち物（新しいバージョンを開いていない人は null） */
  async function theirInv(uid) {
    const r = await api().get('tradeInv/' + uid);
    return r && r.inv ? r : null;
  }

  /* ---------- 申し込む（自分 → 相手） ---------- */
  function refundOut(uid) {
    const o = T().out[uid];
    if (!o) return null;
    S.putItem(o.give);
    delete T().out[uid];
    T().done[o.id] = Date.now();
    S.persist();
    return o;
  }
  /**
   * トレードを申し込む。give：自分が出す装備のキー / want：相手からもらう装備のキー（null ならプレゼント）
   * { ok, msg } を返す
   */
  async function send(f, give, want) {
    if (!usable()) return { ok: false, msg: errMsg({ code: 'test' }) };
    if (T().out[f.uid]) return { ok: false, msg: 'この人には、もう申し込み中のトレードがあります' };
    if (!S.canGive(give)) return { ok: false, msg: '出せません（装備中の武器の最後の1つは出せません）' };
    const path = `trades/${f.uid}/${me()}`;
    // 前のトレードの記録が残っていたら片づける
    const old = await api().get(path).catch(() => undefined);
    if (old === undefined) return { ok: false, msg: errMsg({ code: 'network' }) };
    if (old) {
      try {
        if (old.state === 'offer') await api().put(path + '/state', 'canceled');
        await api().del(path);
      } catch (e) { return { ok: false, msg: errMsg(e) }; }
    }
    const id = newId();
    S.takeItem(give);
    T().out[f.uid] = { id, give, want: want || null, name: f.name, at: Date.now(), st: 'sending' };
    S.persist();
    const v = { id, give, name: S.data.name, fid: S.data.friendId || '', at: TS, state: 'offer' };
    if (want) v.want = want;
    try {
      await api().put(path, v);
      T().out[f.uid].st = 'sent'; S.persist();
      return { ok: true, msg: `${f.name} さんにトレードを申し込みました` };
    } catch (e) {
      if (e.code === 'network') return { ok: true, msg: '通信が不安定です。申し込めたかどうか、あとで確かめます' };
      const cur = await api().get(path).catch(() => null);
      if (cur && cur.id === id) { T().out[f.uid].st = 'sent'; S.persist(); return { ok: true, msg: `${f.name} さんにトレードを申し込みました` }; }
      refundOut(f.uid);
      return { ok: false, msg: e.code === 'denied' ? 'トレードできませんでした（フレンドでなくなったか、Firebase のルールが古い可能性があります）' : errMsg(e) };
    }
  }
  /** 申し込みを取り消す（相手がまだ承認していなければ、預けた装備が戻る） */
  async function cancel(uid) {
    const o = T().out[uid];
    if (!o) return;
    o.st = 'canceling'; S.persist();
    try { await api().put(`trades/${uid}/${me()}/state`, 'canceled'); }
    catch (e) { if (e.code === 'network') throw e; }   // 断られた・承認された後なら、下で結果を受け取る
    await pollOut();
  }

  /** 自分が申し込んだトレードの結果を見る */
  async function pollOut() {
    const done = [];
    for (const uid of Object.keys(T().out)) {
      const o = T().out[uid];
      const path = `trades/${uid}/${me()}`;
      let cur;
      try { cur = await api().get(path); } catch (e) { continue; }
      if (cur && cur.id !== o.id) cur = null;
      if (!cur) {
        // 送っている途中（まだ届いていないかもしれない）なら少し待つ
        if (o.st === 'sending' && Date.now() - o.at < 60000) continue;
        refundOut(uid);
        if (o.st === 'sent') done.push({ kind: 'gone', o });
        continue;
      }
      if (cur.state === 'offer') {
        if (o.st === 'sending') { o.st = 'sent'; S.persist(); }
        if (o.st === 'canceling') { try { await api().put(path + '/state', 'canceled'); } catch (e) { /* 次に */ } }
        continue;
      }
      if (cur.state === 'accepted') {
        if (o.want) S.putItem(o.want);
        delete T().out[uid];
        T().done[o.id] = Date.now();
        S.persist();
        done.push({ kind: 'accepted', o });
      } else {
        refundOut(uid);
        if (cur.state === 'declined') done.push({ kind: 'declined', o });
        else if (o.st !== 'canceling') done.push({ kind: 'gone', o });
        else done.push({ kind: 'canceled', o });
      }
      api().del(path).catch(() => {});   // 終わった記録を消す（消えなくても、次に申し込むときに片づける）
    }
    done.forEach(showResult);
    return done;
  }
  function showResult(d) {
    const o = d.o;
    if (d.kind === 'accepted') {
      if (DS.sound) DS.sound.play('gachaOpen');
      modal({
        title: 'トレード成立！',
        body: `<p class="center"><b>${esc(o.name)}</b> さんがトレードを承認しました</p>
          ${dealHtml(o.give, o.want, 'あげた', 'もらった')}`,
        buttons: [{ label: 'OK', cls: 'btn-green' }],
      });
    } else if (d.kind === 'declined') toast(`${o.name} さんがトレードを断りました。${itemName(o.give)} は戻りました`, 'error', 4000);
    else if (d.kind === 'canceled') toast(`トレードを取り消しました。${itemName(o.give)} は戻りました`, 'good', 3200);
    else toast(`${o.name} さんへのトレードが取り消されました。${itemName(o.give)} は戻りました`, 'error', 4000);
  }

  /* ---------- 届いた申し込み（相手 → 自分） ---------- */
  async function incoming() {
    const r = (await api().get('trades/' + me())) || {};
    return Object.keys(r).map((from) => Object.assign({ from }, r[from]))
      .filter((x) => x.state === 'offer' && x.id && S.validTradeKey(x.give) && (!x.want || S.validTradeKey(x.want)) && !T().done[x.id] && !T().inc[x.id])
      .sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  function finishInc(id, success) {
    const j = T().inc[id];
    if (!j) return null;
    if (success) S.putItem(j.give);
    else if (j.want) S.putItem(j.want);
    delete T().inc[id];
    T().done[id] = Date.now();
    S.persist();
    return j;
  }
  /** 承認の途中で止まったものを片づける（通信が切れたときなど） */
  async function resolveInc(id) {
    const j = T().inc[id];
    if (!j) return { ok: false };
    const path = `trades/${me()}/${j.from}`;
    let cur;
    try { cur = await api().get(path); } catch (e) { return { ok: false, pending: true, msg: errMsg(e) }; }
    if (cur && cur.id === id && cur.state === 'offer') {
      try { await api().put(path + '/state', 'accepted'); cur.state = 'accepted'; }
      catch (e) { if (e.code === 'network') return { ok: false, pending: true, msg: errMsg(e) }; cur = await api().get(path).catch(() => null); }
    }
    if (cur && cur.id === id && cur.state === 'accepted') { finishInc(id, true); return { ok: true, j }; }
    finishInc(id, false);
    return { ok: false, msg: `${j.name || '相手'} さんがトレードを取り消しました` };
  }
  /** 承認する：出す装備が減って、もらう装備が増える */
  async function accept(t) {
    if (T().inc[t.id] || T().done[t.id]) return { ok: false, msg: 'このトレードはもう終わっています' };
    if (t.want && !S.canGive(t.want)) {
      return { ok: false, msg: have(t.want) > 0 ? '装備中の武器の最後の1つなので出せません。ほかの武器に変えてから承認してください' : `${itemName(t.want)} を持っていません` };
    }
    if (t.want) S.takeItem(t.want);
    T().inc[t.id] = { from: t.from, give: t.give, want: t.want || null, name: t.name || '', at: Date.now() };
    S.persist();
    try {
      await api().put(`trades/${me()}/${t.from}/state`, 'accepted');
      finishInc(t.id, true);
      return { ok: true };
    } catch (e) {
      if (e.code === 'network') return { ok: false, pending: true, msg: '通信が不安定です。つながったら続きをします' };
      return resolveInc(t.id);
    }
  }
  async function decline(t) {
    try { await api().put(`trades/${me()}/${t.from}/state`, 'declined'); }
    catch (e) { if (e.code === 'network') throw e; }   // もう取り消されていたら何もしない
    T().done[t.id] = Date.now();
    S.persist();
  }

  /* ---------- 定期チェック ---------- */
  let polling = false, incCount = 0;
  const seen = new Set();
  async function poll() {
    if (!usable() || polling) return;
    polling = true;
    try {
      for (const id of Object.keys(T().inc)) await resolveInc(id);
      await pollOut();
      const inc = await incoming();
      incCount = inc.length;
      const fresh = inc.filter((x) => !seen.has(x.id));
      fresh.forEach((x) => seen.add(x.id));
      if (fresh.length && !(DS.battle && DS.battle.active) && !(DS.minigame && DS.minigame.active)) {
        toast(`${fresh[0].name || 'フレンド'} さんからトレードの申し込みが届きました（ロビーの「フレンド」から見られます）`, 'good', 4200);
      }
      if (DS.friends.updateBadge) DS.friends.updateBadge(true);
    } catch (e) { /* 次に */ } finally { polling = false; }
  }
  const count = () => incCount;

  /* ---------- 画面 ---------- */
  /** 名前を2行で（上：装備の名前 / 下：レアリティ） */
  const name2 = (key) => {
    const e = entry(key);
    if (!e) return '<b>？</b>';
    return `<b>${esc(e.name)}</b><em class="tr-r r-${e.rarity}">${esc(e.rar.name)}${e.char ? '・キャラ' : C.FUSION.marks[e.lv] || ''}</em>`;
  };
  const side = (key, label, none) => `<div class="tr-side"><small>${label}</small>${key ? card(key) : `<div class="tr-gift">なし${none ? `<br><small>${none}</small>` : ''}</div>`}${key ? name2(key) : '<b>　</b>'}</div>`;
  /** 左（出す・あげた）と右（もらう）を矢印で並べる。キーが null なら「なし」 */
  function dealHtml(left, right, l1, l2) {
    return `<div class="tr-deal">${side(left, l1)}<span class="tr-arrow">${SWAP}</span>${side(right, l2, 'プレゼント')}</div>`;
  }
  const NOTE = 'レベルは移りません。最後の1つを出すと、装備はレベル1に戻って使った設計図とコインが、キャラはレベル1に戻って使ったコインとエッセンスが戻ります。';

  /** フレンド画面に出す「トレード」の欄（届いた申し込み・申し込み中） */
  function sectionHtml(inc, friends) {
    const outs = Object.keys(T().out).map((uid) => Object.assign({ uid }, T().out[uid]));
    if (!inc.length && !outs.length) return '';
    const nameOf = (uid, fb) => { const f = friends.find((x) => x.uid === uid); return f ? f.name : fb || '（不明）'; };
    return `<h3 class="sub-head">トレード</h3><div class="fr-list tr-list">
      ${inc.map((t, i) => `<div class="fr-row tr-row in"><span class="tr-mini">${card(t.give, { cls: 'mini' })}</span>
        <div class="fr-txt"><b>${esc(nameOf(t.from, t.name))} さんから</b><small>${esc(itemName(t.give))} ⇄ ${t.want ? esc(itemName(t.want)) : 'なし（プレゼント）'}</small></div>
        <button class="btn btn-small btn-pink tr-see" data-i="${i}">見る</button></div>`).join('')}
      ${outs.map((o) => `<div class="fr-row tr-row out"><span class="tr-mini">${card(o.give, { cls: 'mini' })}</span>
        <div class="fr-txt"><b>${esc(nameOf(o.uid, o.name))} さんに申し込み中</b><small>${esc(itemName(o.give))} ⇄ ${o.want ? esc(itemName(o.want)) : 'なし（プレゼント）'}</small></div>
        <button class="mini-btn dark tr-cancel" data-uid="${o.uid}">取り消す</button></div>`).join('')}
    </div>`;
  }
  function bindSection(el, inc, redraw) {
    $$('.tr-see', el).forEach((b) => b.addEventListener('click', () => openOffer(inc[+b.dataset.i], redraw)));
    $$('.tr-cancel', el).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = '取り消し中…';
      try { await cancel(b.dataset.uid); } catch (e) { toast(errMsg(e), 'error'); }
      redraw();
    }));
  }

  /** 持っている数（装備・キャラ） */
  const have = (key) => { const c = S.charOfKey(key); return c ? S.data.chars[c] | 0 : S.data.inventory[key] | 0; };
  /** 届いた申し込みを見る（承認・断る） */
  function openOffer(t, redraw) {
    if (!t) return;
    const lack = t.want && !S.canGive(t.want);
    modal({
      title: 'トレードの申し込み',
      cls: 'modal-wide',
      body: `<p class="center"><b>${esc(t.name || 'フレンド')}</b> さんからトレードの申し込みです</p>
        ${dealHtml(t.want, t.give, 'あげる', 'もらう')}
        ${t.want ? `<p class="note dark center">あなたの ${esc(itemName(t.want))}：<b>${have(t.want)}${S.charOfKey(t.want) ? '体' : '個'}</b> 持っています</p>` : ''}
        ${lack ? `<p class="warn-text center">${have(t.want) > 0 ? '装備中の武器の最後の1つなので出せません。<br>ほかの武器に変えてから承認してください' : '持っていないので承認できません'}</p>` : ''}
        <p class="note dark">${NOTE}</p>`,
      buttons: [
        { label: '断る', cls: 'btn-gray', onClick: async () => { try { await decline(t); toast('トレードを断りました'); } catch (e) { toast(errMsg(e), 'error'); } if (redraw) redraw(); updateBadgeSoon(); } },
        { label: '承認する', cls: 'btn-green', disabled: !!lack, onClick: async () => {
          const r = await accept(t);
          if (r.ok) {
            if (DS.sound) DS.sound.play('gachaOpen');
            modal({ title: 'トレード成立！', body: `<p class="center"><b>${esc(t.name || 'フレンド')}</b> さんとトレードしました</p>${dealHtml(t.want, t.give, 'あげた', 'もらった')}`,
              buttons: [{ label: 'OK', cls: 'btn-green' }] });
          } else toast(r.msg || 'トレードできませんでした', 'error', 3600);
          if (redraw) redraw();
          updateBadgeSoon();
        } },
      ],
    });
  }
  const updateBadgeSoon = () => setTimeout(() => { incoming().then((x) => { incCount = x.length; DS.friends.updateBadge(true); }).catch(() => {}); }, 300);

  /** フレンドにトレードを申し込む画面 */
  async function compose(f, redraw) {
    if (!usable()) return;
    if (T().out[f.uid]) { toast('この人には、もう申し込み中のトレードがあります（取り消すと新しく申し込めます）', 'error', 3600); return; }
    const m = modal({ title: `${f.name} さんとトレード`, cls: 'modal-wide modal-trade', body: '<p class="center fr-loading">読み込み中…</p>', buttons: [{ label: 'やめる', cls: 'btn-gray' }] });
    let them = null;
    try { them = await theirInv(f.uid); } catch (e) { if (m.el.isConnected) m.body.innerHTML = `<p class="center warn-text">${esc(errMsg(e))}</p>`; return; }
    if (!m.el.isConnected) return;
    let give = null, want = null, slot = 'all';
    const myChars = () => Object.keys(S.data.chars).filter((k) => S.data.chars[k] > 0).map((k) => entry('c:' + k, S.data.chars[k])).filter(Boolean);
    const mine = () => S.inventoryList().map((p) => Object.assign(p, { name: p.def.name })).concat(myChars().sort(order))
      .filter((p) => slot === 'all' || p.slot === slot);
    const theirs = () => {
      if (!them) return [];
      const eq = them.eq || [];
      const items = Object.keys(them.inv).map((k) => { const e = entry(k, them.inv[k]); return e && Object.assign(e, { eqLast: eq.includes(e.key) && e.count <= 1 && e.slot === 'weapon' }); });
      const chars = Object.keys(them.ch || {}).map((k) => entry('c:' + k, them.ch[k]));
      return items.filter(Boolean).sort(order).concat(chars.filter(Boolean).sort(order))
        .filter((p) => p.count > 0 && (slot === 'all' || p.slot === slot));
    };
    const cellCard = (p, extra) => (p.char ? U.charCard(p.char, Object.assign({ count: p.count, cls: 'mini' }, extra))
      : U.itemCard(p.item, p.rarity, Object.assign({ lv: p.lv, count: p.count, cls: 'mini' }, extra)));
    const draw = () => {
      const eq = C.SLOTS.map(({ key }) => S.data.equipped[key]);
      m.body.innerHTML = `
        ${dealHtml0()}
        <div class="seg tr-seg">${[['all', 'すべて']].concat(C.SLOTS.map((x) => [x.key, x.name]), [['char', 'キャラ']]).map(([k, n]) => `<button class="seg-btn ${slot === k ? 'active' : ''}" data-s="${k}">${n}</button>`).join('')}</div>
        <h3 class="sub-head">あなたが出すもの（装備・キャラ）</h3>
        <div class="tr-grid" id="tr-mine">${mine().map((p) => {
          const ok = S.canGive(p.key);
          return `<button class="tr-cell ${give === p.key ? 'sel' : ''} ${ok ? '' : 'off'}" data-k="${p.key}" ${ok ? '' : 'disabled'}>${cellCard(p, { equipped: p.char ? S.data.char === p.char : eq.includes(p.key) })}</button>`;
        }).join('') || '<p class="note dark">出せるものがありません</p>'}</div>
        <h3 class="sub-head">${esc(f.name)} さんからもらうもの</h3>
        ${them ? '' : '<p class="note dark">相手がまだ新しいバージョンを開いていないので、持ち物が見られません。「なし（プレゼント）」だけ選べます</p>'}
        ${them && !them.ch ? '<p class="note dark">相手が新しいバージョン（v15）を開くと、キャラも選べるようになります</p>' : ''}
        <div class="tr-grid" id="tr-theirs"><button class="tr-cell tr-none ${!want ? 'sel' : ''}" data-k="">なし<small>プレゼント</small></button>${theirs().map((p) =>
          `<button class="tr-cell ${want === p.key ? 'sel' : ''} ${p.eqLast ? 'off' : ''}" data-k="${p.key}" ${p.eqLast ? 'disabled' : ''}>${cellCard(p, p.eqLast ? { tag: '装備中' } : {})}</button>`).join('')}</div>
        <p class="note dark">${NOTE} 使っているキャラを出すと「キャラなし」になります。相手が承認するまで、出したものは預かります（取り消すと戻ります）。</p>`;
      $$('.tr-seg .seg-btn', m.el).forEach((b) => b.addEventListener('click', () => { slot = b.dataset.s; draw(); }));
      $$('#tr-mine .tr-cell', m.el).forEach((b) => b.addEventListener('click', () => { give = give === b.dataset.k ? null : b.dataset.k; draw(); }));
      $$('#tr-theirs .tr-cell', m.el).forEach((b) => b.addEventListener('click', () => { want = b.dataset.k || null; draw(); }));
      sendBtn.disabled = !give;
    };
    const dealHtml0 = () => `<div class="tr-deal pick">
      ${give ? side(give, 'あげる') : '<div class="tr-side"><small>あげる</small><div class="tr-gift q">？</div><b>下から選ぶ</b></div>'}
      <span class="tr-arrow">${SWAP}</span>
      ${side(want, 'もらう', 'プレゼント')}
    </div>`;
    const btns = m.el.querySelector('.modal-buttons');
    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn btn-green'; sendBtn.textContent = '申し込む';
    btns.appendChild(sendBtn);
    sendBtn.addEventListener('click', async () => {
      if (!give) return;
      sendBtn.disabled = true; sendBtn.textContent = '送信中…';
      const r = await send(f, give, want).catch((e) => ({ ok: false, msg: errMsg(e) }));
      toast(r.msg, r.ok ? 'good' : 'error', 3600);
      if (r.ok) { m.close(); if (redraw) redraw(); }
      else { sendBtn.disabled = false; sendBtn.textContent = '申し込む'; }
    });
    draw();
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    let t = null;
    // 持ち物が変わったら、少し待ってからフレンド用の持ち物を書き直す
    S.onChange(() => { if (t || !usable()) return; t = setTimeout(() => { t = null; publishInv(); }, 5000); });
    setTimeout(() => { publishInv(true); poll(); }, 2500);
    setInterval(() => { if (document.visibilityState === 'visible') poll(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); });
  }

  DS.trade = { start, poll, count, compose, incoming, sectionHtml, bindSection, openOffer, send, accept, decline, cancel, pollOut, publishInv, itemName };
})();

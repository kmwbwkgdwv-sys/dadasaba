/* =========================================================
 *  friends.js  ― フレンド（Firebase を設定したときだけ使える）
 *
 *  ・引き継ぎのプレイヤーIDとは別の「フレンドID（9桁の数字）」で申請する
 *    （プレイヤーIDはパスワードが4桁なので、人に教えないようにするため）
 *  ・申請 → 相手が承認するとフレンド
 *  ・ロビー（待機室）から、フレンドを呼べる。呼ばれた人の画面に招待が出て、参加を押すとそのまま入れる
 *
 *  Realtime Database の形（README のルールで守る）
 *    friendIds/{フレンドID}      : { uid }                     … フレンドID → だれか
 *    profiles/{uid}              : { name, fid, icon, lv, seen } … 名前・最後に開いた時刻
 *    friendReq/{相手}/{自分}     : { name, fid, at }           … フレンド申請
 *    friends/{自分}/{相手}       : { at }                      … フレンド
 *    invites/{相手}/{自分}       : { name, lobby, pass, stage, at } … ロビーへの招待
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { $, $$, esc, fmt, toast, modal } = U;
  const FC = C.FRIENDS;
  const TS = { '.sv': 'timestamp' };
  const PEOPLE = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="#d8f7e2" stroke="#231a3a" stroke-width="3"/><circle cx="31" cy="17" r="6.5" fill="#3ddc84" stroke="#231a3a" stroke-width="2.4"/><path d="M20 37 Q21 25 31 25 Q41 25 42 37 Z" fill="#3ddc84" stroke="#231a3a" stroke-width="2.4" stroke-linejoin="round"/><circle cx="17" cy="19" r="7" fill="#ffd23d" stroke="#231a3a" stroke-width="2.4"/><path d="M5 40 Q6 27 17 27 Q28 27 29 40 Z" fill="#ffd23d" stroke="#231a3a" stroke-width="2.4" stroke-linejoin="round"/></svg>';

  const api = () => DS.cloud.api;
  const me = () => api().uid();
  /** 使える状態か：'ok' | 'test'（Firebase 未設定）| 'noacct'（引き継ぎコードがない） */
  function state() {
    if (!DS.cloud.configured) return 'test';
    if (!api().ready()) return 'noacct';
    return 'ok';
  }
  const fmtFid = (f) => String(f || '').replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');
  const cleanFid = (s) => String(s || '').replace(/\D/g, '').slice(0, 9);
  const errMsg = (e) => DS.cloud.message(e && e.code);

  /* ---------- フレンドID と プロフィール ---------- */
  let fidReady = null;
  /** 自分のフレンドIDを用意する（まだなければ作って登録する） */
  function ensureFid() {
    if (fidReady) return fidReady;
    fidReady = (async () => {
      const cur = S.data.friendId;
      if (cur) {
        try { await api().put('friendIds/' + cur, { uid: me() }); return cur; }
        catch (e) { if (e.code !== 'denied') throw e; }   // ほかの人に使われていたら作り直す
      }
      for (let i = 0; i < 6; i++) {
        const id = String(Math.floor(100000000 + Math.random() * 900000000));
        try {
          await api().put('friendIds/' + id, { uid: me() });
          S.data.friendId = id; S.persist();
          return id;
        } catch (e) { if (e.code !== 'denied') throw e; }
      }
      throw Object.assign(new Error('server'), { code: 'server' });
    })().catch((e) => { fidReady = null; throw e; });
    return fidReady;
  }
  /** 名前・アイコン・レベルと「今開いている」ことを書く */
  async function heartbeat() {
    if (state() !== 'ok') return;
    const fid = await ensureFid();
    await api().put('profiles/' + me(), { name: S.data.name, fid, icon: S.data.icon || S.data.look || '', lv: S.accountInfo().lv, seen: TS });
  }

  /* ---------- 申請・承認 ---------- */
  async function lookup(fid) {
    const r = await api().get('friendIds/' + fid);
    return r && r.uid ? r.uid : null;
  }
  async function friendUids() { return Object.keys((await api().get('friends/' + me())) || {}); }
  async function requests() {
    const r = (await api().get('friendReq/' + me())) || {};
    return Object.keys(r).map((uid) => Object.assign({ uid }, r[uid])).sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  /** フレンドIDで申請する。相手からも申請が来ていたら、そのままフレンドになる */
  async function sendRequest(fidInput) {
    const fid = cleanFid(fidInput);
    if (fid.length !== 9) return { ok: false, msg: 'フレンドIDは9桁の数字です' };
    const myFid = await ensureFid();
    if (fid === myFid) return { ok: false, msg: '自分のフレンドIDです' };
    const uid = await lookup(fid);
    if (!uid) return { ok: false, msg: 'そのフレンドIDの人が見つかりません' };
    const list = await friendUids();
    if (list.includes(uid)) return { ok: false, msg: 'もうフレンドです' };
    if (list.length >= FC.max) return { ok: false, msg: `フレンドは${FC.max}人までです` };
    const theirs = await api().get(`friendReq/${me()}/${uid}`);
    if (theirs) { await accept(uid); return { ok: true, msg: 'フレンドになりました！', became: true }; }
    await api().put(`friendReq/${uid}/${me()}`, { name: S.data.name, fid: myFid, at: TS });
    return { ok: true, msg: 'フレンド申請を送りました' };
  }
  async function accept(uid) {
    await api().patch('', { [`friends/${me()}/${uid}`]: { at: TS }, [`friends/${uid}/${me()}`]: { at: TS }, [`friendReq/${me()}/${uid}`]: null });
  }
  const decline = (uid) => api().del(`friendReq/${me()}/${uid}`);
  const removeFriend = (uid) => api().patch('', { [`friends/${me()}/${uid}`]: null, [`friends/${uid}/${me()}`]: null });

  /** フレンド一覧（名前・オンラインかどうか） */
  async function list() {
    const uids = await friendUids();
    const now = Date.now();
    const out = await Promise.all(uids.map(async (uid) => {
      const p = (await api().get('profiles/' + uid).catch(() => null)) || {};
      return { uid, name: p.name || '（不明）', fid: p.fid || '', icon: p.icon || '', lv: p.lv || 1, seen: p.seen || 0, online: !!p.seen && now - p.seen < FC.onlineSec * 1000 };
    }));
    return out.sort((a, b) => (b.online - a.online) || (b.seen - a.seen));
  }

  /* ---------- 招待 ---------- */
  async function invite(uid, room) {
    const v = { name: S.data.name, lobby: room.lobbyId, pass: room.password, stage: room.stage, at: TS };
    if (room.mg) v.mg = room.mg;   // ミニゲームのロビー
    await api().put(`invites/${uid}/${me()}`, v);
  }
  const shownInvites = new Set();
  let inviteOpen = false;
  async function pollInvites() {
    if (state() !== 'ok' || inviteOpen || document.visibilityState !== 'visible') return;
    if (DS.battle && DS.battle.active) return;
    if (DS.minigame && DS.minigame.active) return;
    if (DS.lobby && DS.lobby.inRoom && DS.lobby.inRoom()) return;
    const r = (await api().get('invites/' + me()).catch(() => null)) || {};
    const now = Date.now();
    for (const from of Object.keys(r)) {
      const v = r[from];
      const key = from + ':' + v.at;
      if (!v.at || now - v.at > FC.inviteMin * 60000) { api().del(`invites/${me()}/${from}`).catch(() => {}); continue; }
      if (shownInvites.has(key)) continue;
      shownInvites.add(key);
      showInvite(from, v);
      break;
    }
  }
  function showInvite(from, v) {
    inviteOpen = true;
    const st = C.STAGES[v.stage] || C.STAGES[0];
    const mg = v.mg && C.MINIGAMES.list.find((g) => g.key === v.mg);
    if (DS.sound) DS.sound.play('gachaOpen');
    modal({
      title: 'ロビーへの招待',
      closable: false,
      body: `<div class="inv-card"><span class="inv-ic">${PEOPLE}</span>
        <p class="center"><b>${esc(v.name)}</b> さんから<br>ロビーに招待されました！</p>
        ${mg ? `<div class="inv-stage inv-mg"><span class="inv-mg-ic">${DS.minigame.icon(mg.key)}</span><span class="stage-chip">ミニゲーム</span><b>${esc(mg.name)}</b></div>`
          : `<div class="inv-stage"><span class="stage-chip">STAGE ${st.no}</span><b>${esc(st.name)}</b></div>`}</div>`,
      onClose: () => { inviteOpen = false; },
      buttons: [
        { label: 'あとで', cls: 'btn-gray', onClick: () => { api().del(`invites/${me()}/${from}`).catch(() => {}); } },
        { label: '参加する', cls: 'btn-green', onClick: () => {
          api().del(`invites/${me()}/${from}`).catch(() => {});
          if (DS.lobby && DS.lobby.joinLobbyById) DS.lobby.joinLobbyById(v.lobby, v.pass);
        } },
      ],
    });
  }

  /* ---------- 画面 ---------- */
  function unavailableHtml(st) {
    return st === 'test'
      ? '<p class="center">フレンド機能は <b>Firebase を設定すると</b> 使えます。<br><small>（いまはテストモードです。README の「引き継ぎ（Firebase）の設定」を見てください）</small></p>'
      : '<p class="center">フレンド機能は <b>引き継ぎコードを発行すると</b> 使えます。</p>';
  }
  const faceHtml = (f) => `<span class="fr-face">${A.charFace(f.icon || null)}${f.online ? '<i class="fr-on"></i>' : ''}</span>`;
  const seenText = (f) => (f.online ? '<b class="on">オンライン</b>' : f.seen ? agoText(f.seen) : '');
  function agoText(t) {
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 60) return `${Math.max(1, m)}分前`;
    if (m < 60 * 24) return `${Math.floor(m / 60)}時間前`;
    return `${Math.floor(m / 1440)}日前`;
  }

  async function open() {
    const st = state();
    if (st !== 'ok') {
      modal({ title: 'フレンド', body: unavailableHtml(st),
        buttons: st === 'noacct' ? [{ label: 'とじる', cls: 'btn-gray' }, { label: '引き継ぎコードを発行', cls: 'btn-yellow', onClick: () => DS.cloud.openProfile() }] : [{ label: 'とじる', cls: 'btn-gray' }] });
      return;
    }
    const m = modal({ title: 'フレンド', cls: 'modal-wide modal-fr', body: '<p class="center fr-loading">読み込み中…</p>', buttons: [{ label: 'とじる', cls: 'btn-gray' }] });
    const draw = async () => {
      let fid = '', reqs = [], friends = [];
      try { [fid, reqs, friends] = await Promise.all([ensureFid(), requests(), list()]); }
      catch (e) { if (m.el.isConnected) m.body.innerHTML = `<p class="center warn-text">${esc(errMsg(e))}</p>`; return; }
      if (!m.el.isConnected) return;
      m.body.innerHTML = `
        <div class="fr-me"><small>あなたのフレンドID</small><b class="code-val">${fmtFid(fid)}</b><button class="mini-btn dark" id="fr-copy">コピー</button></div>
        <p class="note dark">フレンドIDを教えあって申請しよう。<b>引き継ぎのプレイヤーIDとパスワードは、人に教えないでください。</b></p>
        <div class="fr-add"><input id="fr-input" inputmode="numeric" maxlength="11" placeholder="フレンドID（9桁）" autocomplete="off"><button class="btn btn-green btn-small" id="fr-send">申請</button></div>
        ${reqs.length ? `<h3 class="sub-head">フレンド申請（${reqs.length}）</h3>
          <div class="fr-list">${reqs.map((r) => `<div class="fr-row req"><span class="fr-face">${A.charFace(null)}</span>
            <div class="fr-txt"><b>${esc(r.name || '')}</b><small>ID ${fmtFid(r.fid)}</small></div>
            <button class="btn btn-small btn-gray fr-no" data-uid="${r.uid}">断る</button><button class="btn btn-small btn-green fr-yes" data-uid="${r.uid}">承認</button></div>`).join('')}</div>` : ''}
        <h3 class="sub-head">フレンド（${friends.length} / ${FC.max}）</h3>
        ${friends.length ? `<div class="fr-list">${friends.map((f) => `<div class="fr-row">${faceHtml(f)}
            <div class="fr-txt"><b>${esc(f.name)}</b><small>Lv ${f.lv}　${seenText(f)}</small></div>
            <button class="mini-btn dark fr-del" data-uid="${f.uid}" data-name="${esc(f.name)}">削除</button></div>`).join('')}</div>`
          : '<p class="note dark center">まだフレンドがいません</p>'}`;
      $('#fr-copy', m.el).addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(fmtFid(fid)); toast('フレンドIDをコピーしました', 'good'); } catch (e) { toast('コピーできませんでした', 'error'); }
      });
      const inp = $('#fr-input', m.el);
      inp.addEventListener('input', () => { const v = cleanFid(inp.value); inp.value = v.length > 6 ? `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}` : v.length > 3 ? `${v.slice(0, 3)}-${v.slice(3)}` : v; });
      $('#fr-send', m.el).addEventListener('click', async (e) => {
        e.target.disabled = true;
        try { const r = await sendRequest(inp.value); toast(r.msg, r.ok ? 'good' : 'error', 2800); if (r.ok) draw(); }
        catch (er) { toast(errMsg(er), 'error', 3200); }
        e.target.disabled = false;
      });
      $$('.fr-yes', m.el).forEach((b) => b.addEventListener('click', async () => { try { await accept(b.dataset.uid); toast('フレンドになりました！', 'good'); updateBadge(); draw(); } catch (e) { toast(errMsg(e), 'error'); } }));
      $$('.fr-no', m.el).forEach((b) => b.addEventListener('click', async () => { try { await decline(b.dataset.uid); updateBadge(); draw(); } catch (e) { toast(errMsg(e), 'error'); } }));
      $$('.fr-del', m.el).forEach((b) => b.addEventListener('click', () => {
        modal({ title: 'フレンド削除', body: `<p class="center"><b>${b.dataset.name}</b> さんをフレンドから削除しますか？</p>`,
          buttons: [{ label: 'やめる', cls: 'btn-gray' }, { label: '削除する', cls: 'btn-red', onClick: async () => { try { await removeFriend(b.dataset.uid); draw(); } catch (e) { toast(errMsg(e), 'error'); } } }] });
      }));
    };
    draw();
  }

  /** ロビー（待機室）からフレンドを呼ぶ */
  async function openInvite(room) {
    const st = state();
    if (st !== 'ok') { modal({ title: 'フレンドを呼ぶ', body: unavailableHtml(st), buttons: [{ label: 'とじる', cls: 'btn-gray' }] }); return; }
    const m = modal({ title: 'フレンドを呼ぶ', cls: 'modal-wide modal-fr', body: '<p class="center fr-loading">読み込み中…</p>', buttons: [{ label: 'とじる', cls: 'btn-gray' }] });
    let friends = [];
    try { friends = await list(); } catch (e) { m.body.innerHTML = `<p class="center warn-text">${esc(errMsg(e))}</p>`; return; }
    if (!m.el.isConnected) return;
    m.body.innerHTML = friends.length
      ? `<p class="note dark center">呼ぶと、相手の画面に招待が出ます（${FC.inviteMin}分間）。オンラインの人がおすすめです</p>
        <div class="fr-list">${friends.map((f) => `<div class="fr-row">${faceHtml(f)}
          <div class="fr-txt"><b>${esc(f.name)}</b><small>Lv ${f.lv}　${seenText(f)}</small></div>
          <button class="btn btn-small btn-yellow fr-call" data-uid="${f.uid}">呼ぶ</button></div>`).join('')}</div>`
      : '<p class="center">まだフレンドがいません。<br><small>ロビー右上の「フレンド」から申請できます</small></p>';
    $$('.fr-call', m.el).forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = '送信中…';
      try { await invite(b.dataset.uid, room()); b.textContent = '呼びました'; b.classList.replace('btn-yellow', 'btn-gray'); }
      catch (e) { toast(errMsg(e), 'error'); b.disabled = false; b.textContent = '呼ぶ'; }
    }));
  }

  /* ---------- バッジ・定期チェック ---------- */
  let reqCount = 0;
  async function updateBadge() {
    const b = $('#friend-badge');
    if (state() !== 'ok') { if (b) b.classList.add('hidden'); return; }
    try { reqCount = (await requests()).length; } catch (e) { return; }
    if (b) { b.textContent = reqCount; b.classList.toggle('hidden', !reqCount); }
  }
  /** アカウント削除のとき：自分のフレンド情報を全部消す */
  async function cleanup() {
    if (state() !== 'ok') return;
    const uid = me(), upd = {};
    const uids = await friendUids().catch(() => []);
    uids.forEach((f) => { upd[`friends/${f}/${uid}`] = null; });
    upd[`friends/${uid}`] = null; upd[`friendReq/${uid}`] = null; upd[`invites/${uid}`] = null; upd[`profiles/${uid}`] = null;
    if (S.data.friendId) upd[`friendIds/${S.data.friendId}`] = null;
    await api().patch('', upd);
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    let lastBeat = 0, lastReq = 0;
    const loop = () => {
      if (state() !== 'ok' || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastBeat > FC.heartbeatSec * 1000) { lastBeat = now; heartbeat().catch(() => {}); }
      if (now - lastReq > 30000) { lastReq = now; updateBadge(); }
      pollInvites().catch(() => {});
    };
    setInterval(loop, FC.pollSec * 1000);
    setTimeout(loop, 1500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { lastBeat = 0; loop(); } });
    // 名前やアイコンを変えたら、すぐに知らせる
    let lastSig = '';
    S.onChange(() => {
      const sig = [S.data.name, S.data.icon, S.data.look, S.accountInfo().lv].join('|');
      if (sig !== lastSig) { lastSig = sig; if (state() === 'ok') heartbeat().catch(() => {}); }
    });
  }

  DS.friends = { open, openInvite, start, state, sendRequest, accept, decline, removeFriend, list, requests, invite, pollInvites, heartbeat, ensureFid, cleanup, updateBadge, ICON: PEOPLE, fmtFid };
})();

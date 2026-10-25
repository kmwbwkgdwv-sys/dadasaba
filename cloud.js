/* =========================================================
 *  cloud.js  ― 引き継ぎ（プレイヤーID + 4桁パスワード）
 *
 *  Firebase（Authentication + Realtime Database）の REST API を使います。
 *  SDK は不要。js/config.js の CLOUD に apiKey と databaseURL を入れると有効になります。
 *
 *  ・初回起動時にプレイヤーIDとパスワードを発行し、保存するよう警告します
 *  ・データが変わると自動でクラウドに保存します
 *  ・別の端末では ID とパスワードを入れるとデータを復元できます
 *
 *  Firebase 未設定のときは「テストモード」になり、同じブラウザの中だけで
 *  発行・復元の流れを試せます（別の端末には引き継げません）。
 * ========================================================= */
(function () {
  const C = DS.config, CL = C.CLOUD, S = DS.state, U = DS.ui;
  const { $, esc, toast, modal } = U;
  const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 見間違えやすい 0/O/1/I は使わない
  const configured = !!(CL.apiKey && CL.databaseURL);

  const randId = () => Array.from({ length: 8 }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join('');
  const randPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const fmtId = (id) => id.slice(0, 4) + '-' + id.slice(4);
  const cleanId = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const err = (code) => { const e = new Error(code); e.code = code; return e; };

  // ID と PIN から Firebase 用のメールアドレスとパスワードを作る（Firebase のパスワードは6文字以上が必要なため）
  const emailOf = (id) => id.toLowerCase() + '@' + CL.emailDomain;
  const passOf = (id, pin) => 'sa-' + pin + '-' + id;

  /* ---------- 端末に覚えておく情報 ---------- */
  function loadAcct() { try { return JSON.parse(localStorage.getItem(C.CLOUD_KEY) || 'null'); } catch (e) { return null; } }
  function saveAcct(a) { try { localStorage.setItem(C.CLOUD_KEY, JSON.stringify(a)); } catch (e) { /* noop */ } }
  let acct = loadAcct();
  // テストモードで発行したコードは Firebase では使えないので、設定後は発行し直す（遊んだデータはそのまま残る）
  if (acct && acct.test && configured) { acct = null; try { localStorage.removeItem(C.CLOUD_KEY); } catch (e) { /* noop */ } }

  /* =========================================================
   *  Firebase（REST）
   * ========================================================= */
  const FB = {
    async auth(path, body) {
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${path}?key=${encodeURIComponent(CL.apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).catch(() => { throw err('network'); });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const m = (j.error && j.error.message) || '';
        if (m.startsWith('EMAIL_EXISTS')) throw err('exists');
        if (m.startsWith('INVALID_LOGIN_CREDENTIALS') || m.startsWith('INVALID_PASSWORD') || m.startsWith('EMAIL_NOT_FOUND')) throw err('badlogin');
        if (m.startsWith('TOO_MANY_ATTEMPTS')) throw err('toomany');
        throw err('server');
      }
      return { uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (Number(j.expiresIn) || 3600) * 1000 - 60000 };
    },
    async refresh(a) {
      const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(CL.apiKey)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(a.refreshToken),
      }).catch(() => { throw err('network'); });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw err('server');
      return { idToken: j.id_token, refreshToken: j.refresh_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60000 };
    },
    url(uid, token) { return `${CL.databaseURL.replace(/\/$/, '')}/saves/${uid}.json?auth=${encodeURIComponent(token)}`; },
    async signUp(id, pin) { return FB.auth('signUp', { email: emailOf(id), password: passOf(id, pin), returnSecureToken: true }); },
    async signIn(id, pin) { return FB.auth('signInWithPassword', { email: emailOf(id), password: passOf(id, pin), returnSecureToken: true }); },
    async put(a, data, keepalive) {
      const r = await fetch(FB.url(a.uid, a.idToken), { method: 'PUT', body: JSON.stringify(data), keepalive: !!keepalive })
        .catch(() => { throw err('network'); });
      if (!r.ok) throw err(r.status === 401 ? 'auth' : 'server');
    },
    async get(a) {
      const r = await fetch(FB.url(a.uid, a.idToken)).catch(() => { throw err('network'); });
      if (!r.ok) throw err(r.status === 401 ? 'auth' : 'server');
      return r.json();
    },
    /** アカウント削除：保存データを消してから、ログイン情報も消す */
    async remove(a) {
      const r = await fetch(FB.url(a.uid, a.idToken), { method: 'DELETE' }).catch(() => { throw err('network'); });
      if (!r.ok) throw err(r.status === 401 ? 'auth' : 'server');
      await FB.auth('delete', { idToken: a.idToken });
    },
  };

  /* =========================================================
   *  テストモード（Firebase 未設定）：同じブラウザの localStorage を「サーバー」の代わりにする
   * ========================================================= */
  const FAKE_KEY = 'survivors-arena/test-cloud';
  const fakeDb = () => { try { return JSON.parse(localStorage.getItem(FAKE_KEY) || '{"users":{},"saves":{}}'); } catch (e) { return { users: {}, saves: {} }; } };
  const fakeSave = (db) => { try { localStorage.setItem(FAKE_KEY, JSON.stringify(db)); } catch (e) { /* noop */ } };
  const LOCAL = {
    async signUp(id, pin) {
      const db = fakeDb();
      if (db.users[id]) throw err('exists');
      db.users[id] = { pass: passOf(id, pin), uid: 'local-' + id };
      fakeSave(db);
      return { uid: db.users[id].uid, idToken: 'local', refreshToken: 'local', exp: Infinity };
    },
    async signIn(id, pin) {
      const u = fakeDb().users[id];
      if (!u || u.pass !== passOf(id, pin)) throw err('badlogin');
      return { uid: u.uid, idToken: 'local', refreshToken: 'local', exp: Infinity };
    },
    async refresh(a) { return a; },
    async put(a, data) { const db = fakeDb(); db.saves[a.uid] = data; fakeSave(db); },
    async get(a) { return fakeDb().saves[a.uid] || null; },
    async remove(a) { const db = fakeDb(); delete db.saves[a.uid]; delete db.users[a.id]; fakeSave(db); },
  };

  const B = configured ? FB : LOCAL;

  /* =========================================================
   *  データベースを直接読み書きする（フレンド機能などで使う。Firebase を設定したときだけ）
   *  path は 'profiles/xxxx' のような形。PATCH を '' に送ると、いくつもの場所をまとめて書き換えられる
   * ========================================================= */
  async function dbReq(method, path, body, retried) {
    if (!configured) throw err('test');
    const a = await session();
    const url = `${CL.databaseURL.replace(/\/$/, '')}/${path || ''}.json?auth=${encodeURIComponent(a.idToken)}`;
    const r = await fetch(url, { method, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => { throw err('network'); });
    if (r.status === 401) {
      const t = await r.text().catch(() => '');
      if (!retried && /expired|token/i.test(t)) { acct.exp = 0; return dbReq(method, path, body, true); }
      throw err('denied');
    }
    if (!r.ok) throw err('server');
    return r.json();
  }
  const api = {
    get: (p) => dbReq('GET', p),
    put: (p, d) => dbReq('PUT', p, d),
    patch: (p, d) => dbReq('PATCH', p, d),
    del: (p) => dbReq('DELETE', p),
    uid: () => (acct ? acct.uid : null),
    ready: () => configured && !!acct,
  };

  /* ---------- トークンの更新 ---------- */
  async function session() {
    if (!acct) throw err('noacct');
    if (acct.exp && Date.now() < acct.exp) return acct;
    try {
      Object.assign(acct, await B.refresh(acct));
    } catch (e) {
      if (e.code === 'network') throw e;
      Object.assign(acct, await B.signIn(acct.id, acct.pin));   // 更新できなければログインし直す
    }
    saveAcct(acct);
    return acct;
  }

  /* ---------- 保存 ---------- */
  let timer = null, saving = false, dirty = false, lastSaved = acct && acct.savedAt || 0, lastErr = null;
  const listeners = new Set();
  const notify = () => listeners.forEach((f) => f(status()));

  async function saveNow(keepalive) {
    if (!acct) return false;
    if (saving) { dirty = true; return false; }
    saving = true; dirty = false; clearTimeout(timer);
    try {
      const a = await session();
      await B.put(a, Object.assign(S.exportSave(), { playerId: acct.id }), keepalive);
      lastSaved = Date.now(); lastErr = null;
      acct.savedAt = lastSaved; saveAcct(acct);
      return true;
    } catch (e) {
      lastErr = e.code || 'server';
      if (e.code === 'auth') acct.exp = 0;
      schedule(30);
      return false;
    } finally {
      saving = false;
      notify();
      if (dirty) schedule(3);
    }
  }
  function schedule(sec) {
    if (!acct) return;
    clearTimeout(timer);
    timer = setTimeout(() => saveNow(), (sec != null ? sec : CL.autoSaveSec) * 1000);
  }

  /* ---------- 発行と復元 ---------- */
  async function issue() {
    const pin = randPin();
    for (let i = 0; i < 5; i++) {
      const id = randId();
      try {
        const a = await B.signUp(id, pin);
        acct = Object.assign({ id, pin, createdAt: Date.now(), test: !configured }, a);
        saveAcct(acct);
        S.startLimited(acct.createdAt);   // 発行した日から7日間限定ミッションが始まる
        S.setCodeIssued();                // ミッション「引き継ぎコードを発行する」
        await saveNow();
        return { id, pin };
      } catch (e) {
        if (e.code !== 'exists') throw e;
      }
    }
    throw err('server');
  }
  async function restore(idInput, pin) {
    const id = cleanId(idInput);
    if (id.length !== 8) throw err('badid');
    if (!/^\d{4}$/.test(pin)) throw err('badpin');
    const a = await B.signIn(id, pin);
    const data = await B.get(Object.assign({ id, pin }, a));
    if (!data) throw err('nodata');
    return { account: Object.assign({ id, pin, test: !configured }, a), data };
  }
  function applyRestore(r) {
    acct = r.account; acct.savedAt = Date.now(); saveAcct(acct);
    S.replaceSave(r.data);
    location.reload();
  }

  const MESSAGES = {
    network: '通信できませんでした。インターネット接続を確認してください。',
    server: 'サーバーでエラーが起きました。時間をおいて試してください。',
    badlogin: 'プレイヤーIDかパスワードが違います。',
    badid: 'プレイヤーIDは8文字（例：ABCD-1234）で入力してください。',
    badpin: 'パスワードは4桁の数字で入力してください。',
    nodata: 'このIDのデータが見つかりませんでした。',
    toomany: '入力ミスが続いたため、しばらく試せません。時間をおいてください。',
    auth: 'ログインの期限が切れました。もう一度お試しください。',
    denied: 'サーバーに断られました。Firebase のルールが新しいものになっているか確認してください。',
    test: 'この機能は Firebase を設定すると使えます（今はテストモードです）。',
  };
  const message = (code) => MESSAGES[code] || MESSAGES.server;

  function status() {
    return { configured, hasAccount: !!acct, id: acct && acct.id, pin: acct && acct.pin, lastSaved, error: lastErr, saving, test: !configured };
  }

  /* =========================================================
   *  画面
   * ========================================================= */
  const idPinHtml = (id, pin) => `
    <div class="code-box">
      <div class="code-row"><small>プレイヤーID</small><b class="code-val">${fmtId(id)}</b></div>
      <div class="code-row"><small>パスワード（4桁）</small><b class="code-val">${pin}</b></div>
    </div>`;

  async function copyCode(id, pin) {
    const text = `【${C.GAME_TITLE}】引き継ぎコード\nプレイヤーID: ${fmtId(id)}\nパスワード: ${pin}`;
    try { await navigator.clipboard.writeText(text); toast('コピーしました。メモ帳などに貼って保存してください', 'good', 3200); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('コピーしました', 'good'); } catch (e2) { toast('コピーできませんでした。画面を撮影して保存してください', 'error', 3200); }
      ta.remove();
    }
  }

  /** 発行した ID とパスワードを見せて、保存したか確認する（保存するまで閉じられない） */
  function showIssued(id, pin, onDone) {
    const m = modal({
      title: '引き継ぎコード',
      closable: false,
      body: `
        <p class="center warn-text">これを保存しないと<br>データが消える可能性があります！</p>
        ${idPinHtml(id, pin)}
        <p class="note dark">機種変更・ブラウザのデータ削除・アプリの入れ直しのときに、このIDとパスワードでデータを戻せます。<b>スクリーンショットを撮るか、メモに貼り付けて保存してください。</b></p>
        ${configured ? '' : '<p class="note dark test-note">テストモード：Firebase が未設定のため、同じブラウザの中でしか引き継げません。</p>'}
        <button class="btn btn-blue btn-big" id="code-copy">IDとパスワードをコピー</button>
        <label class="check"><input type="checkbox" id="code-ok"><span>IDとパスワードを保存しました</span></label>`,
      buttons: [{ label: 'OK', cls: 'btn-green', disabled: true, onClick: () => { if (onDone) onDone(); } }],
    });
    const okBtn = m.el.querySelector('.modal-buttons .btn');
    $('#code-copy', m.el).addEventListener('click', () => copyCode(id, pin));
    $('#code-ok', m.el).addEventListener('change', (e) => { okBtn.disabled = !e.target.checked; });
  }

  /** はじめての起動：コードを発行する（引き継ぐ人は入力画面へ） */
  function welcome() {
    const m = modal({
      title: 'ようこそ！',
      closable: false,
      body: `
        <div class="welcome-art">${DS.art.squad()}</div>
        <p class="center">はじめに、データを守るための<br><b>引き継ぎコード</b>（プレイヤーIDとパスワード）を発行します。</p>
        <button class="btn btn-yellow btn-big" id="wc-issue">引き継ぎコードを発行する</button>
        <button class="link-btn dark" id="wc-restore">別の端末のデータを引き継ぐ</button>
        <button class="link-btn dark small" id="wc-later">あとで発行する</button>`,
    });
    const btn = $('#wc-issue', m.el);
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = '発行中…';
      try {
        const r = await issue();
        m.close();
        showIssued(r.id, r.pin, readyCb);
      } catch (e) {
        toast(message(e.code), 'error', 3600);
        btn.disabled = false; btn.textContent = 'もう一度発行する';
      }
    });
    $('#wc-restore', m.el).addEventListener('click', () => { m.close(); openRestore(() => welcome()); });
    $('#wc-later', m.el).addEventListener('click', () => {
      m.close();
      try { sessionStorage.setItem('sa-skip-issue', '1'); } catch (e) { /* noop */ }
      toast('引き継ぎコードがないとデータが消える可能性があります。プレイヤー情報から発行できます', 'error', 4200);
      notify();
      readyCb();
    });
  }

  /** ID とパスワードを入れて復元する */
  function openRestore(onCancel) {
    const m = modal({
      title: 'データを引き継ぐ',
      body: `
        <label class="field"><span>プレイヤーID</span><input id="rs-id" autocomplete="off" autocapitalize="characters" maxlength="9" placeholder="ABCD-1234"></label>
        <label class="field"><span>パスワード（4桁）</span><input id="rs-pin" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="0000"></label>
        <p class="note dark">引き継ぐと、<b>この端末の今のデータは上書きされます。</b></p>`,
      onClose: () => { if (onCancel && !done) onCancel(); },
      buttons: [
        { label: 'やめる', cls: 'btn-gray' },
        {
          label: '引き継ぐ', cls: 'btn-green', keepOpen: true,
          onClick: async (btn) => {
            btn.disabled = true; btn.textContent = '確認中…';
            try {
              const r = await restore($('#rs-id', m.el).value, $('#rs-pin', m.el).value.trim());
              done = true; m.close();
              confirmRestore(r);
            } catch (e) {
              toast(message(e.code), 'error', 3600);
              btn.disabled = false; btn.textContent = '引き継ぐ';
            }
          },
        },
      ],
    });
    let done = false;
    $('#rs-id', m.el).addEventListener('input', (e) => {
      const v = cleanId(e.target.value).slice(0, 8);
      e.target.value = v.length > 4 ? v.slice(0, 4) + '-' + v.slice(4) : v;
    });
    $('#rs-pin', m.el).addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
  }
  function confirmRestore(r) {
    const d = S.normalize(r.data);
    const items = Object.values(d.inventory).reduce((a, n) => a + n, 0);
    modal({
      title: 'このデータを引き継ぎますか？',
      closable: false,
      body: `<div class="restore-sum">
          <div><small>名前</small><b>${esc(d.name)}</b></div>
          <div><small>コイン</small><b>${U.fmt(d.coins)}</b></div>
          <div><small>装備</small><b>${items}個</b></div>
          <div><small>ステージクリア</small><b>${d.missions.clears}回</b></div>
        </div>
        <p class="note dark center">この端末の今のデータは消えて、上のデータに置き換わります。</p>`,
      buttons: [
        { label: 'やめる', cls: 'btn-gray', onClick: () => { if (!acct && !skipped()) welcome(); } },
        { label: '引き継ぐ', cls: 'btn-green', onClick: () => applyRestore(r) },
      ],
    });
  }
  const skipped = () => { try { return sessionStorage.getItem('sa-skip-issue') === '1'; } catch (e) { return false; } };

  /** アカウント削除（クラウドのデータと、この端末のデータを消す） */
  async function deleteAccount() {
    if (acct) {
      // フレンドの情報も消す（Firebase を設定しているときだけ）
      if (configured && DS.friends && DS.friends.cleanup) { try { await DS.friends.cleanup(); } catch (e) { if (e.code === 'network') throw e; } }
      const a = await session();
      await B.remove(Object.assign({ id: acct.id }, a));
    }
    clearTimeout(timer); acct = null;
    try { localStorage.removeItem(C.CLOUD_KEY); } catch (e) { /* noop */ }
    try { sessionStorage.removeItem('sa-skip-issue'); } catch (e) { /* noop */ }
    S.wipeLocal();
  }
  function openDelete() {
    const st = status();
    const m = modal({
      title: 'アカウント削除',
      body: `
        <p class="warn-text center">すべてのデータが消えます。<br>元に戻すことはできません！</p>
        <p class="note dark">コイン・装備・キャラ・ステージのクリア記録・アカウントレベル${st.hasAccount ? '、クラウドに保存したデータと引き継ぎコード（プレイヤーID ' + fmtId(st.id) + '）' : ''}がすべて削除され、最初からになります。</p>
        <label class="check"><input type="checkbox" id="del-ok"><span>すべてのデータが消えることを理解しました</span></label>`,
      buttons: [
        { label: 'やめる', cls: 'btn-gray' },
        {
          label: '削除する', cls: 'btn-red', disabled: true, keepOpen: true,
          onClick: async (btn) => {
            btn.disabled = true; btn.textContent = '削除中…';
            try {
              await deleteAccount();
              m.close();
              modal({ title: '削除しました', closable: false, body: '<p class="center">アカウントを削除しました。<br>最初から始まります。</p>',
                buttons: [{ label: 'OK', cls: 'btn-green', onClick: () => location.reload() }] });
            } catch (e) {
              toast(message(e.code), 'error', 3600);
              btn.disabled = false; btn.textContent = '削除する';
            }
          },
        },
      ],
    });
    const btn = m.el.querySelectorAll('.modal-buttons .btn')[1];
    $('#del-ok', m.el).addEventListener('change', (e) => { btn.disabled = !e.target.checked; });
  }

  /** 左上のアイコンを選ぶ欄 */
  function iconPicker() {
    const cur = S.data.icon || '';
    const keys = Object.keys(C.CHARACTERS).sort((a, b) => S.RARITY[C.CHARACTERS[a].rarity].rank - S.RARITY[C.CHARACTERS[b].rarity].rank);
    return `<div class="icon-grid">
      <button class="icon-cell ${!cur ? 'sel' : ''}" data-k="">${DS.art.charFace(S.data.look)}<small>見た目と同じ</small></button>
      ${keys.map((k) => `<button class="icon-cell r-${C.CHARACTERS[k].rarity} ${cur === k ? 'sel' : ''}" data-k="${k}">${DS.art.charFace(k)}<small>${esc(C.CHARACTERS[k].name)}</small></button>`).join('')}
    </div>`;
  }

  /** プレイヤー情報（名前の変更・アイコン・引き継ぎコード・アカウント削除） */
  function openProfile() {
    const st = status();
    const time = st.lastSaved ? new Date(st.lastSaved).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'まだ保存されていません';
    const m = modal({
      title: 'プレイヤー',
      cls: 'modal-wide',
      body: `
        <div class="name-edit"><span id="pf-face">${DS.art.charFace(S.data.icon || S.data.look)}</span>
          <label class="field"><span>名前（10文字まで）</span><input id="name-input" maxlength="10" value="${esc(S.data.name)}"></label></div>
        <h3 class="sub-head">アイコン</h3>
        <div id="pf-icons">${iconPicker()}</div>
        <h3 class="sub-head">引き継ぎコード</h3>
        ${st.hasAccount ? `
          <div class="code-box">
            <div class="code-row"><small>プレイヤーID</small><b class="code-val">${fmtId(st.id)}</b></div>
            <div class="code-row"><small>パスワード（4桁）</small><b class="code-val" id="pf-pin">••••</b><button class="mini-btn dark" id="pf-show">表示</button></div>
          </div>
          <p class="sync ${st.error ? 'bad' : ''}">${st.error ? '保存できませんでした：' + esc(message(st.error)) : 'クラウドに保存済み：' + time}${st.test ? '<br><b>テストモード（この端末の中だけ）</b>' : ''}</p>
          <div class="pf-btns"><button class="btn btn-blue btn-small" id="pf-copy">コピー</button><button class="btn btn-green btn-small" id="pf-save">今すぐ保存</button></div>`
        : `<p class="warn-text center">まだ引き継ぎコードがありません。<br>データが消える可能性があります。</p>
          <button class="btn btn-yellow btn-big" id="pf-issue">引き継ぎコードを発行する</button>`}
        <button class="link-btn dark" id="pf-restore">別の端末のデータを引き継ぐ</button>
        <button class="link-btn danger small" id="pf-delete">アカウントを削除する</button>`,
      buttons: [
        { label: 'とじる', cls: 'btn-gray' },
        { label: '名前を決定', cls: 'btn-green', onClick: () => { const v = $('#name-input', m.el).value; if (v.trim() && v.trim() !== S.data.name) { S.setName(v); toast('名前を変更しました', 'good'); } } },
      ],
    });
    const q = (s) => $(s, m.el);
    if (q('#pf-show')) q('#pf-show').addEventListener('click', (e) => { const p = q('#pf-pin'); const show = p.textContent.includes('•'); p.textContent = show ? st.pin : '••••'; e.target.textContent = show ? '隠す' : '表示'; });
    if (q('#pf-copy')) q('#pf-copy').addEventListener('click', () => copyCode(st.id, st.pin));
    if (q('#pf-save')) q('#pf-save').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const ok = await saveNow();
      toast(ok ? '保存しました' : message(lastErr), ok ? 'good' : 'error');
      e.target.disabled = false;
    });
    if (q('#pf-issue')) q('#pf-issue').addEventListener('click', async (e) => {
      e.target.disabled = true; e.target.textContent = '発行中…';
      try { const r = await issue(); m.close(); showIssued(r.id, r.pin); }
      catch (er) { toast(message(er.code), 'error', 3600); e.target.disabled = false; e.target.textContent = '引き継ぎコードを発行する'; }
    });
    q('#pf-restore').addEventListener('click', () => { m.close(); openRestore(); });
    q('#pf-delete').addEventListener('click', () => { m.close(); openDelete(); });
    const bindIcons = () => q('#pf-icons').querySelectorAll('.icon-cell').forEach((b) => b.addEventListener('click', () => {
      S.setIcon(b.dataset.k || null);
      q('#pf-icons').innerHTML = iconPicker();
      q('#pf-face').innerHTML = DS.art.charFace(S.data.icon || S.data.look);
      bindIcons();
    }));
    bindIcons();
  }

  /* ---------- 起動時 ---------- */
  let onReady = null;
  const readyCb = () => { const f = onReady; onReady = null; if (f) setTimeout(f, 250); };
  /** onReadyFn: 引き継ぎコードの案内が終わったら呼ばれる（すでにコードがあればすぐ） */
  function init(onReadyFn) {
    onReady = onReadyFn || null;
    // ブラウザに「このサイトのデータを消さないで」とお願いする（対応ブラウザのみ）
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* noop */ }
    S.onChange(() => { if (acct) schedule(); });
    const flush = () => { if (acct && (timer || dirty)) saveNow(true); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    // 引き継ぎコードを持っているのに7日間限定ミッションがまだ始まっていなければ（この機能が入る前に発行した人）、今日から始める
    if (acct) { S.startLimited(Date.now()); S.setCodeIssued(); }
    if (!acct && !skipped()) setTimeout(welcome, 300);
    else { if (acct) schedule(2); readyCb(); }
  }

  DS.cloud = { init, issue, restore, saveNow, status, openProfile, openRestore, openDelete, welcome, onChange: (f) => listeners.add(f), configured, api, message, _fmtId: fmtId };
})();

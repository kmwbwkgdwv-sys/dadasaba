/* =========================================================
 *  gifts.js  ― 管理ページ（admin.html）から届くプレゼント
 *
 *  管理ページで送ったコインやチケットは、Realtime Database の
 *    gifts/{プレイヤーID（小文字）}/{番号} : { title, text, coins, tickets, at, claimed }
 *  に入ります。ゲームはここを時々見て、プレゼントボックスに入れます。
 *  受け取ったら claimed（受け取った時刻）を書きます（管理ページで「受け取り済み」と出ます）。
 *
 *  全員へのプレゼント（v15）は giftsAll/{番号} : { title, text, coins, tickets, at, until（期限・なくてもよい） }
 *  受け取ったら giftsAllGot/{番号}/{uid} に時刻を書きます（管理ページで受け取った人数が分かります）。
 *
 *  ※ 管理ページはゲームの中には出てきません（admin.html を直接開いたときだけ）
 *  ※ README の手順4のルール（gifts）を貼っていないときは、何もしません
 * ========================================================= */
(function () {
  const S = DS.state, U = DS.ui;
  const POLL_SEC = 180;           // 何秒ごとに見るか
  let busy = null, last = 0;

  const api = () => DS.cloud.api;
  const pid = () => { const st = DS.cloud.status(); return st.id ? String(st.id).toLowerCase() : null; };
  const usable = () => DS.cloud.configured && api().ready() && !!pid();

  /** 届いていないか見る。新しく届いた数を返す（force：間隔を空けずに見る） */
  function check(force) {
    if (!usable()) return Promise.resolve(0);
    if (busy) return busy;
    if (!force && Date.now() - last < POLL_SEC * 1000 * 0.9) return Promise.resolve(0);
    last = Date.now();
    busy = (async () => {
      try {
        const id = pid();
        // 自分あて（gifts）と全員あて（giftsAll）。片方が読めなくても、もう片方は使う
        const [mine, all] = await Promise.all([
          api().get('gifts/' + id).catch(() => undefined),
          api().get('giftsAll').catch(() => undefined),
        ]);
        let added = 0;
        if (mine !== undefined) {
          const r = S.syncGifts(mine || {});
          if (r.report.length) report(r.report);
          added += r.added;
        }
        if (all !== undefined) added += S.syncGiftsAll(all || {});
        if (added) {
          if (DS.lobby) DS.lobby.updatePresentBadge();
          U.toast(`プレゼントが${added > 1 ? added + 'つ' : ''}届きました！ロビーのプレゼントボックスを見てください`, 'good', 3600);
          if (DS.sound) DS.sound.play('gachaOpen');
        }
        return added;
      } catch (e) {
        return 0;   // ルールを貼っていない（denied）・通信できない → 何もしない
      } finally {
        busy = null;
      }
    })();
    return busy;
  }

  /** 受け取ったことをサーバーに書く（失敗しても、次に見たときにもう一度書く） */
  async function report(gids) {
    if (!usable()) return;
    const id = pid();
    for (const gid of gids) {
      try { await api().put(`gifts/${id}/${gid}/claimed`, Date.now()); } catch (e) { /* 次に見たときにもう一度 */ }
    }
  }

  /** 全員へのプレゼントを受け取ったことを書く（管理ページで「何人が受け取ったか」を数えるため） */
  async function reportAll(gids) {
    if (!usable()) return;
    for (const gid of gids) {
      try { await api().put(`giftsAllGot/${gid}/${api().uid()}`, Date.now()); } catch (e) { /* 数えるだけなので、失敗してもよい */ }
    }
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    setTimeout(() => check(true), 3000);
    setInterval(() => { if (document.visibilityState === 'visible') check(); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }

  DS.gifts = { start, check, report, reportAll };
})();

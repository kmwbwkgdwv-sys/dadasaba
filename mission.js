/* =========================================================
 *  mission.js  ― ミッション（ステージ1クリアで解放）
 *   ・デイリーミッション（毎日0時にリセット。デイリーポイントでごほうび）
 *   ・ステージを1つクリアするたびに 3,000 コイン / 敵を100体倒すごとに 200 コイン
 *   ・1回きりのミッション・何度でももらえるミッション（config.js の ACHIEVEMENTS）
 *   ・7日間限定ミッション・どうぐ
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { $, $$, esc, fmt, toast, modal } = U;

  let tab = 'daily';
  function leftHms(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(t / 3600)).padStart(2, '0')}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }
  function dailyBody() {
    const d = S.dailyInfo();
    return `
      <div class="dl-head"><b>デイリーミッション</b><small>のこり <span id="dl-left">${leftHms(d.left)}</span>（毎日0時に新しくなります）</small></div>
      <div class="lm-ms dl-ms">
        <div class="lm-ms-top"><span>デイリーポイント <b>${d.points}</b> / ${d.max}</span>
          ${d.ms.some((x) => x.reached && !x.claimed) ? '<button class="btn btn-small btn-green" id="dl-ms">ごほうびを受け取る</button>' : ''}</div>
        <div class="lm-track"><i style="width:${Math.min(100, d.points / d.max * 100)}%"></i>
          ${d.ms.map((x) => `<span class="lm-node ${x.reached ? 'on' : ''} ${x.claimed ? 'got' : ''}" style="left:${x.n / d.max * 100}%"><span class="lm-node-rw">${rewardChip(x.reward, true)}</span><em>${x.n}</em></span>`).join('')}
        </div>
      </div>
      <div class="lm-list">${d.list.map((x) => `
        <div class="lm-row ${x.claimed ? 'claimed' : x.done ? 'ready' : ''}">
          <div class="lm-txt"><b>${esc(x.name)}</b>
            <span class="ms-bar"><i style="width:${x.prog / x.n * 100}%"></i><em>${fmt(x.prog)} / ${fmt(x.n)}</em></span></div>
          <span class="dp">+${x.point}<small>pt</small></span>${rewardChip(x.reward)}
          ${x.claimed ? '<span class="lm-done">受取済</span>' : x.done ? `<button class="btn btn-small btn-green dl-claim" data-id="${x.id}">受け取る</button>` : '<span class="lm-not">未達成</span>'}
        </div>`).join('')}</div>
`;
  }
  function achBody() {
    const list = S.achievementList();
    const order = (a) => (a.ready ? 0 : a.claimed ? 2 : 1);
    return `<div class="lm-list ach-list">${list.slice().sort((a, b) => order(a) - order(b)).map((a) => `
      <div class="lm-row ${a.claimed ? 'claimed' : a.ready ? 'ready' : ''}">
        <div class="lm-txt"><b>${esc(a.name)}</b>${a.step ? `<small class="ach-rep">${a.step}回ごとに何度でも${a.check === 'charsGot' ? '' : ''}（合計 ${fmt(a.total)}）</small>` : ''}
          <span class="ms-bar"><i style="width:${(a.ready ? a.need : a.prog) / a.need * 100}%"></i><em>${a.ready && a.step ? `×${a.ready} 受け取れます` : `${fmt(a.ready ? a.need : a.prog)} / ${fmt(a.need)}`}</em></span></div>
        <span class="rw-multi">${rewardChips(a.reward)}</span>
        ${a.claimed ? '<span class="lm-done">受取済</span>' : a.ready ? `<button class="btn btn-small btn-green ach-claim" data-id="${a.id}">受け取る</button>` : '<span class="lm-not">未達成</span>'}
      </div>`).join('')}</div>
`;
  }
  /** ミッションのバッジに出す数 */
  function readyCount() {
    if (!S.missionsUnlocked()) return 0;
    const st = S.missionStatus();
    return (st.clearN ? 1 : 0) + (st.killN ? 1 : 0) + S.achievementList().reduce((a, x) => a + (x.ready ? 1 : 0), 0) + S.dailyInfo().ready;
  }

  /** デイリー・ミッション・ステージクリア・敵を倒す の受け取れるものを全部受け取る（v22） */
  function claimAll() {
    const got = [];
    // 受け取ったことで次のものが受け取れるようになることもあるので、なくなるまで（念のため3回まで）
    for (let i = 0; i < 3; i++) {
      const n = got.length;
      ['clear', 'kill'].forEach((k) => { const c = S.claimMission(k); if (c) got.push({ coins: c }); });
      got.push(...S.claimAchievement());
      got.push(...S.claimDaily());
      if (got.length === n) break;
    }
    return got;
  }

  function body() {
    const st = S.missionStatus();
    const dn = S.dailyInfo().ready, an = S.achievementList().filter((a) => a.ready).length + (st.clearN ? 1 : 0) + (st.killN ? 1 : 0);
    const tabs = `${dn + an ? `<button class="btn btn-green ms-all" id="ms-all">まとめて受け取る<small>デイリーとミッション ${dn + an}件</small></button>` : ''}
      <div class="seg ms-tabs">
        <button class="seg-btn ${tab === 'daily' ? 'active' : ''}" data-t="daily">デイリー${dn ? `<b class="dot-n">${dn}</b>` : ''}</button>
        <button class="seg-btn ${tab === 'main' ? 'active' : ''}" data-t="main">ミッション${an ? `<b class="dot-n">${an}</b>` : ''}</button></div>`;
    if (tab === 'daily') return tabs + dailyBody();
    const MC = DS.gameConfig.MISSIONS;
    const claimBtn = (k, n, coins) => n
      ? `<button class="btn btn-green ms-claim" data-k="${k}">受け取る<small>${A.coin()}+${fmt(coins)}</small></button>`
      : '<button class="btn btn-gray ms-claim" disabled>未達成</button>';
    return tabs + `
      <div class="ms-list">
        <div class="ms-card ${st.clearN ? 'ready' : ''}">
          <span class="ms-ic">${A.navIcon('lobby')}</span>
          <div class="ms-body">
            <b>ステージをクリアする</b>
            <small>1回ごとに ${A.coin()}${fmt(MC.stageClearReward)}</small>
            <span class="ms-prog-text">クリア ${fmt(st.clears)}回</span>
          </div>
          ${claimBtn('clear', st.clearN, st.clearCoins)}
        </div>
        <div class="ms-card ${st.killN ? 'ready' : ''}">
          <span class="ms-ic foe">${A.enemyIcon('zombie')}</span>
          <div class="ms-body">
            <b>敵を${MC.killStep}体倒す</b>
            <small>${MC.killStep}体ごとに ${A.coin()}${fmt(MC.killReward)}</small>
            <span class="ms-bar"><i style="width:${st.killProgress / st.killStep * 100}%"></i><em>${st.killProgress} / ${st.killStep}</em></span>
            <span class="ms-prog-text">累計 ${fmt(st.kills)}体</span>
          </div>
          ${claimBtn('kill', st.killN, st.killCoins)}
        </div>
      </div>
      <h3 class="sub-head">ミッション</h3>
      ${achBody()}
      <h3 class="sub-head">ステージのクリア状況</h3>
      <div class="ms-stages">${C.STAGES.map((s) => {
        const n = st.stages[s.key] || 0;
        return `<div class="ms-stage ${n ? 'done' : ''}"><span>STAGE ${s.no}</span><b>${esc(s.name)}</b><em>${n ? `クリア ${n}回` : '未クリア'}</em></div>`;
      }).join('')}</div>`;
  }

  function open(startTab) {
    if (!S.missionsUnlocked()) { toast(`ミッションはステージ${C.MISSION_UNLOCK + 1}をクリアすると解放されます`, 'info', 2800); return; }
    if (startTab) tab = startTab;
    const m = modal({ title: 'ミッション', cls: 'modal-wide modal-ms', body: body(), buttons: [{ label: 'とじる', cls: 'btn-blue' }] });
    const redraw = () => { m.body.innerHTML = body(); bind(); };
    const bind = () => {
      $$('.ms-tabs .seg-btn', m.el).forEach((b) => b.addEventListener('click', () => { tab = b.dataset.t; redraw(); }));
      $$('.ms-claim[data-k]', m.el).forEach((b) => b.addEventListener('click', () => {
        const coins = S.claimMission(b.dataset.k);
        if (coins) toast(`${fmt(coins)} コインを受け取りました`, 'good');
        redraw();
      }));
      $$('.dl-claim', m.el).forEach((b) => b.addEventListener('click', () => { const g = S.claimDaily(b.dataset.id); redraw(); if (g.length) showGot(g); }));
      const all = $('#ms-all', m.el);
      if (all) all.addEventListener('click', () => {
        const g = claimAll(); redraw();
        if (g.length) showGot(g, `${g.length}個まとめて受け取り！`);
        if (DS.lobby) DS.lobby.updateMissionBadge();
      });
      const dlm = $('#dl-ms', m.el); if (dlm) dlm.addEventListener('click', () => { const g = S.claimDaily('ms'); redraw(); if (g.length) showGot(g, 'デイリーポイントのごほうび'); });
      $$('.ach-claim', m.el).forEach((b) => b.addEventListener('click', () => { const g = S.claimAchievement(b.dataset.id); redraw(); if (g.length) showGot(g); }));
    };
    bind();
    const tick = setInterval(() => {
      if (!m.el.isConnected) { clearInterval(tick); return; }
      const el = $('#dl-left', m.el);
      if (el) { const d = S.dailyInfo(); el.textContent = leftHms(d.left); }
    }, 1000);
  }

  /* =========================================================
   *  報酬の表示
   * ========================================================= */
  const TICKET_NAME = { item10: '装備ガチャ10連チケット', char10: 'キャラガチャ10連チケット', epic1: 'エピック確定チケット', s1: 'S装備確定チケット' };
  const TICKET_SHORT = { item10: ['装備', '装備10連'], char10: ['キャラ', 'キャラ10連'], epic1: ['エピ確定', 'エピック確定'], s1: ['S確定', 'S装備確定'] };
  const TICKET_IC = '<svg viewBox="0 0 32 22" aria-hidden="true"><path d="M2 3 H30 V8 a3 3 0 0 0 0 6 V19 H2 V14 a3 3 0 0 0 0 -6 Z" fill="#ff7ad9" stroke="#231a3a" stroke-width="2" stroke-linejoin="round"/><path d="M11 4 V18" stroke="#231a3a" stroke-width="1.6" stroke-dasharray="2 2"/></svg>';
  /** 報酬の小さな表示（{ coins } / { bp } / { ticket } / { tool }） */
  function rewardChip(r, compact) {
    if (r.coins) return `<span class="rw">${A.coin()}<b>${compact ? U.fmtBig(r.coins) : fmt(r.coins)}</b></span>`;
    if (r.bp) return `<span class="rw">${A.blueprint('random')}<b>×${r.bp}</b></span>`;
    if (r.essence) return `<span class="rw">${A.essence()}<b>${compact ? '' : '×'}${fmt(r.essence)}</b></span>`;
    if (r.ticket) return `<span class="rw tk tk-${r.ticket}">${TICKET_IC}<b>${(TICKET_SHORT[r.ticket] || ['', ''])[compact ? 0 : 1]}${r.ticketN > 1 ? '×' + r.ticketN : ''}</b></span>`;
    if (r.tool) return `<span class="rw">${toolIcon(r.tool)}<b>${C.TOOLS[r.tool] && C.TOOLS[r.tool].s ? 'S選択BOX' : '選択BOX'}${r.toolN > 1 ? '×' + r.toolN : ''}</b></span>`;
    return '';
  }
  const toolIcon = (t) => A.epicBox('tool-art', !!(C.TOOLS[t] && C.TOOLS[t].s));
  /** 報酬がいくつかあるときは全部並べる */
  function rewardChips(r) {
    return ['coins', 'bp', 'essence', 'ticket', 'tool'].filter((k) => r[k]).map((k) => rewardChip(k === 'tool' ? { tool: r.tool, toolN: r.toolN } : k === 'ticket' ? { ticket: r.ticket, ticketN: r.ticketN } : { [k]: r[k] })).join('');
  }
  /** もらったもの（grantReward の結果の配列）をまとめて見せる */
  function showGot(list, title) {
    let coins = 0, essence = 0; const bp = { weapon: 0, armor: 0, belt: 0, boots: 0 }; const tickets = []; const tools = [];
    list.forEach((g) => {
      coins += g.coins || 0; essence += g.essence || 0;
      if (g.bp) Object.keys(bp).forEach((k) => { bp[k] += g.bp[k] || 0; });
      if (g.ticket) for (let i = 0; i < (g.ticketN || 1); i++) tickets.push(g.ticket);
      if (g.tool) for (let i = 0; i < (g.toolN || 1); i++) tools.push(g.tool);
    });
    const bpN = Object.values(bp).reduce((a, n) => a + n, 0);
    if (DS.sound) DS.sound.play('equip');
    modal({
      title: title || '受け取りました',
      body: `<div class="got-list">
        ${coins ? `<div class="got">${A.coin()}<b>コイン +${fmt(coins)}</b></div>` : ''}
        ${essence ? `<div class="got">${A.essence()}<b>エッセンス +${fmt(essence)}</b></div>` : ''}
        ${bpN ? `<div class="got bp"><span class="got-bp">${C.SLOTS.filter((sl) => bp[sl.key]).map((sl) => `<span>${A.blueprint(sl.key)}<small>${sl.name}</small><b>×${bp[sl.key]}</b></span>`).join('')}</span><small>ランダム設計図 ${bpN}枚</small></div>` : ''}
        ${tickets.map((t) => `<div class="got tk-${t}">${TICKET_IC}<b>${TICKET_NAME[t]}</b>${t === 'epic1' || t === 's1' ? '<small>ガチャ画面の確定ガチャで使えます</small>' : ''}</div>`).join('')}
        ${tools.map((t) => `<div class="got">${toolIcon(t)}<b>${esc(C.TOOLS[t].name)}</b><small>ロビー左上の「どうぐ」から使えます</small></div>`).join('')}
      </div>`,
      buttons: [{ label: 'OK', cls: 'btn-yellow' }],
    });
  }

  /* =========================================================
   *  7日間限定ミッション
   * ========================================================= */
  const LM = C.LIMITED;
  function missionText(m) {
    switch (m.type) {
      case 'login': return `${m.n}日ログインする`;
      case 'stage': return `ステージ${m.n}をクリアする`;
      case 'kills': return `敵を合計${fmt(m.n)}体倒す`;
      case 'pulls': return `ガチャを合計${m.n}回引く`;
      case 'charPulls': return `キャラガチャを合計${m.n}回引く`;
      case 'fuse': return `装備を合計${m.n}回合成する`;
      case 'levelUp': return `装備を合計${m.n}回レベルアップする`;
      case 'clears': return `ステージを合計${m.n}回クリアする`;
      default: return '';
    }
  }
  function leftText(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), mi = Math.floor(t % 3600 / 60), se = t % 60;
    return `${d}日 ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')}`;
  }
  /** バッジに出す数（受け取れるもの） */
  function limitedReady() {
    const li = S.limitedInfo();
    return li.active ? li.ready + li.msReady : 0;
  }

  function openLimited() {
    const li0 = S.limitedInfo();
    if (!li0.started) {
      modal({
        title: '7日間限定ミッション',
        body: `<div class="lm-intro"><span class="lm-seven big">7</span>
          <p class="center"><b>引き継ぎコードを発行した日</b>から7日間だけ遊べる特別なミッションです。</p>
          <p class="note dark center">ミッションを20個クリアすると、好きなエピックのS装備を1つもらえる<b>エピックS装備選択BOX</b>が手に入ります！</p></div>`,
        buttons: [{ label: 'とじる', cls: 'btn-gray' }, { label: '引き継ぎコードを発行', cls: 'btn-yellow', onClick: () => DS.cloud.openProfile() }],
      });
      return;
    }
    if (!li0.active) { toast('7日間限定ミッションは終了しました', 'info'); return; }
    S.touchLogin();
    let day = Math.max(0, Math.min(LM.days.length - 1, S.limitedInfo().open - 1));
    // まだ受け取っていないものがある日を先に見せる
    const firstReady = S.limitedInfo().days.findIndex((list) => list.some((m) => m.open && m.done && !m.claimed));
    if (firstReady >= 0) day = firstReady;
    const m = modal({ title: '7日間限定ミッション', cls: 'modal-wide modal-lm', body: '<div id="lm-body"></div>', buttons: [{ label: 'とじる', cls: 'btn-gray' }] });
    const draw = () => {
      const li = S.limitedInfo();
      if (!li.active) { m.close(); toast('7日間限定ミッションは終了しました', 'info'); return; }
      const maxN = LM.milestones[LM.milestones.length - 1].n;
      const list = li.days[day];
      $('#lm-body', m.el).innerHTML = `
        <div class="lm-head"><span class="lm-seven">7</span>
          <div><b>のこり <span id="lm-left">${leftText(li.left)}</span></b><small>ログイン ${li.loginDays}日目・毎日ログインすると次の日のミッションが解放されます</small></div></div>
        <div class="lm-ms">
          <div class="lm-ms-top"><span>クリアしたミッション <b>${li.claimedN}</b> / ${li.total}</span>
            ${li.msReady ? '<button class="btn btn-small btn-green" id="lm-ms-claim">ごほうびを受け取る</button>' : ''}</div>
          <div class="lm-track"><i style="width:${Math.min(100, li.claimedN / maxN * 100)}%"></i>
            ${li.milestones.map((x) => `<span class="lm-node ${x.reached ? 'on' : ''} ${x.claimed ? 'got' : ''} ${x.reward.tool ? 'big' : ''}" style="left:${x.n / maxN * 100}%">
              <span class="lm-node-rw">${rewardChip(x.reward, true)}</span><em>${x.n}</em></span>`).join('')}
          </div>
        </div>
        <div class="lm-tabs">${LM.days.map((_, d) => {
          const dl = li.days[d], open = d < li.open, ready = dl.some((x) => x.open && x.done && !x.claimed), all = dl.every((x) => x.claimed);
          return `<button class="lm-tab ${d === day ? 'active' : ''} ${open ? '' : 'locked'} ${all ? 'all' : ''}" data-d="${d}">${open ? '' : '<i class="lk">🔒</i>'}${d + 1}日目${ready ? '<b class="dot"></b>' : ''}</button>`;
        }).join('')}</div>
        ${day < li.open ? `<div class="lm-list">${list.map((x) => `
          <div class="lm-row ${x.claimed ? 'claimed' : x.done ? 'ready' : ''}">
            <div class="lm-txt"><b>${esc(missionText(x))}</b>
              <span class="ms-bar"><i style="width:${x.prog / x.n * 100}%"></i><em>${fmt(x.prog)} / ${fmt(x.n)}</em></span></div>
            ${rewardChip(x.reward)}
            ${x.claimed ? '<span class="lm-done">受取済</span>' : x.done ? `<button class="btn btn-small btn-green lm-claim" data-id="${x.id}">受け取る</button>` : '<span class="lm-not">未達成</span>'}
          </div>`).join('')}</div>`
        : `<div class="lm-locked">🔒 ログイン${day + 1}日目に解放されます<small>（あと${day + 1 - li.loginDays}日ログイン）</small></div>`}
        ${li.ready + li.msReady > 1 ? '<button class="btn btn-green lm-all" id="lm-all">まとめて受け取る</button>' : ''}
        <p class="note dark">敵の数・ガチャ・合成などの「合計」は、ミッションが始まってからの数です。3つクリアで<b>S装備確定チケット</b>、20個以上クリアで<b>エピックS装備選択BOX</b>（好きなエピックのS装備を1つ）がもらえます。</p>`;
      $$('.lm-tab', m.el).forEach((b) => b.addEventListener('click', () => { day = +b.dataset.d; draw(); }));
      $$('.lm-claim', m.el).forEach((b) => b.addEventListener('click', () => { const g = S.claimLimited(b.dataset.id); draw(); if (g.length) showGot(g); }));
      const all = $('#lm-all', m.el);
      if (all) all.addEventListener('click', () => {
        const g = S.claimLimited(); g.push(...S.claimLimitedMilestone()); draw();
        if (g.length) showGot(g, `${g.length}個まとめて受け取り！`);
      });
      const ms = $('#lm-ms-claim', m.el);
      if (ms) ms.addEventListener('click', () => { const g = S.claimLimitedMilestone(); draw(); if (g.length) showGot(g, '達成ごほうび'); });
    };
    draw();
    const tick = setInterval(() => {
      if (!m.el.isConnected) { clearInterval(tick); return; }
      const li = S.limitedInfo(), el = $('#lm-left', m.el);
      if (!li.active) { clearInterval(tick); draw(); return; }
      if (el) el.textContent = leftText(li.left);
    }, 1000);
  }

  /* =========================================================
   *  どうぐ（選択BOX・設計図・チケット）
   * ========================================================= */
  function toolsBody() {
    const d = S.data, tools = Object.keys(d.tools).filter((k) => d.tools[k] > 0);
    return `
      <h3 class="sub-head">選択BOX</h3>
      ${tools.length ? `<div class="tool-list">${tools.map((k) => `<div class="tool-row">
          <span class="tool-ic">${toolIcon(k)}</span>
          <div class="tool-txt"><b>${esc(C.TOOLS[k].name)}</b><small>${esc(C.TOOLS[k].desc)}</small></div>
          <span class="tool-n">×${d.tools[k]}</span>
          <button class="btn btn-small btn-yellow tool-use" data-k="${k}">開ける</button></div>`).join('')}</div>`
        : '<p class="note dark center">選択BOXは持っていません。<br>7日間限定ミッションやミッションでもらえます。</p>'}
      <h3 class="sub-head">設計図</h3>
      <div class="bp-bar in-modal">${C.SLOTS.map((sl) => `<span class="bp-chip">${A.blueprint(sl.key)}<small>${sl.name}</small><b>${fmt(d.blueprints[sl.key] || 0)}</b></span>`).join('')}</div>
      <p class="note dark">設計図とコインで装備をレベルアップできます（装備画面で装備をタップ）。ランダム設計図は、もらったときに武器・防具・ベルト・靴のどれかになります。</p>
      <h3 class="sub-head">エッセンス</h3>
      <div class="tool-list"><div class="tool-row"><span class="tool-ic">${A.essence()}</span><div class="tool-txt"><b>エッセンス</b><small>キャラのレベルアップに使います（装備画面でキャラをタップ →「スキル・強さ」）</small></div><span class="tool-n">${fmt(d.essence)}</span></div></div>
      <h3 class="sub-head">チケット</h3>
      <div class="tool-list">
        <div class="tool-row"><span class="tool-ic tk">${TICKET_IC}</span><div class="tool-txt"><b>${TICKET_NAME.item10}</b></div><span class="tool-n">×${d.tickets.item10 || 0}</span></div>
        <div class="tool-row"><span class="tool-ic tk">${TICKET_IC}</span><div class="tool-txt"><b>${TICKET_NAME.char10}</b></div><span class="tool-n">×${d.tickets.char10 || 0}</span></div>
        <div class="tool-row"><span class="tool-ic tk tk-epic1">${TICKET_IC}</span><div class="tool-txt"><b>${TICKET_NAME.epic1}</b><small>ガチャ画面の「エピック確定ガチャ」で使います</small></div><span class="tool-n">×${d.tickets.epic1 || 0}</span></div>
        <div class="tool-row"><span class="tool-ic tk tk-s1">${TICKET_IC}</span><div class="tool-txt"><b>${TICKET_NAME.s1}</b><small>ガチャ画面の「S装備確定ガチャ」で使います</small></div><span class="tool-n">×${d.tickets.s1 || 0}</span></div>
      </div>`;
  }
  function openTools() {
    const m = modal({ title: 'どうぐ', cls: 'modal-wide', body: toolsBody(), buttons: [{ label: 'とじる', cls: 'btn-gray' }] });
    const bind = () => $$('.tool-use', m.el).forEach((b) => b.addEventListener('click', () => {
      openPicker(b.dataset.k, () => { m.body.innerHTML = toolsBody(); bind(); });
    }));
    bind();
  }
  /** 選択BOX：好きな装備を1つ選ぶ */
  function openPicker(tool, onDone) {
    const T = C.TOOLS[tool];
    let sel = null;
    const m = modal({
      title: T.name, cls: 'modal-wide',
      body: `<p class="note dark center">好きな${S.RARITY[T.pick].name}${T.s ? 'S' : ''}装備を1つ選んでください${T.s ? '' : '（S装備は選べません）'}</p>
        ${C.GACHA_ORDER.map((slot) => `<div class="pick-row"><span class="gacha-row-label">${C.SLOTS.find((x) => x.key === slot).name}</span>
          <div class="pick-items">${Object.keys(C.ITEMS).filter((k) => C.ITEMS[k].slot === slot && !!C.ITEMS[k].s === !!T.s).map((k) => `<button class="pick-cell" data-k="${k}">${U.itemCard(k, T.pick, { cls: 'mini' })}<small>${esc(C.ITEMS[k].name)}</small></button>`).join('')}</div></div>`).join('')}
        <div class="pick-info" id="pick-info">装備をタップすると説明が出ます</div>`,
      buttons: [
        { label: 'やめる', cls: 'btn-gray' },
        { label: 'これにする', cls: 'btn-yellow', disabled: true, keepOpen: true, onClick: () => {
          if (!sel) return;
          const key = S.useTool(tool, sel);
          if (!key) return;
          m.close();
          if (DS.sound) DS.sound.play('gachaBig');
          const p = S.parseKey(key);
          modal({ title: 'ゲット！', cls: 'modal-fz3',
            body: `<div class="fused"><div class="fused-item">${U.itemCard(p.item, p.rarity)}<b>${esc(p.def.name)}</b>${U.rarityLabel(p.rarity)}</div></div>
              <p class="note dark center">装備画面で装備できます</p>`,
            buttons: [{ label: 'OK', cls: 'btn-yellow' }] });
          if (onDone) onDone();
        } },
      ],
    });
    const okBtn = m.el.querySelectorAll('.modal-buttons .btn')[1];
    $$('.pick-cell', m.el).forEach((b) => b.addEventListener('click', () => {
      sel = b.dataset.k;
      $$('.pick-cell', m.el).forEach((x) => x.classList.toggle('sel', x === b));
      const d = C.ITEMS[sel];
      $('#pick-info', m.el).innerHTML = `<b>${esc(d.name)}</b> <span class="slot-tag">${C.SLOTS.find((x) => x.key === d.slot).name}</span>
        <div class="effs">${U.effectLines(sel).map((e) => `<span class="eff ${e.good ? 'good' : 'bad'}">${esc(e.text)}</span>`).join('')}
        ${d.passive ? `<span class="eff skill">パッシブ「${esc(d.passive.name)}」${esc(d.passive.desc)}</span>` : ''}</div><small>${esc(d.desc)}</small>`;
      okBtn.disabled = false;
    }));
  }

  DS.mission = { open, openLimited, openTools, limitedReady, showGot, rewardChip, rewardChips, readyCount };
})();

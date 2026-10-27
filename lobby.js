/* =========================================================
 *  lobby.js  ― ロビー画面
 *   ・タブ1「ステージ選択」: ステージを選んでロビーを作成（ホスト）
 *   ・タブ2「ロビーに参加」: ロビーID + パスワードで参加（ゲスト）
 *   ・ルーム画面: 最大4人の待機室。ホストがステージを選んで出撃
 * ========================================================= */
(function () {
  const C = DS.config, S = DS.state, A = DS.art, U = DS.ui;
  const { $, $$, esc, fmt, fmtBig, toast, modal } = U;
  const GC = DS.gameConfig;
  const GIFT = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="#ffd6ec" stroke="#231a3a" stroke-width="3"/><rect x="9" y="20" width="30" height="20" rx="3" fill="#ff5aa8" stroke="#231a3a" stroke-width="2.6"/><rect x="7" y="14" width="34" height="8" rx="3" fill="#ff7ac0" stroke="#231a3a" stroke-width="2.6"/><path d="M24 14 V40" stroke="#ffe066" stroke-width="5"/><path d="M24 14 V40" stroke="#231a3a" stroke-width="1.2" opacity=".4"/><path d="M24 14 Q14 4 12 10 Q12 15 24 14 Q34 4 36 10 Q36 15 24 14 Z" fill="#ffe066" stroke="#231a3a" stroke-width="2.4" stroke-linejoin="round"/></svg>';

  const SEVEN = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="#fff4d6" stroke="#231a3a" stroke-width="3"/><path d="M3 15 V12 A9.5 9.5 0 0 1 12.5 3 H35.5 A9.5 9.5 0 0 1 45 12.5 V15 Z" fill="#ff4a5e" stroke="#231a3a" stroke-width="2.4" stroke-linejoin="round"/><circle cx="15" cy="9" r="2.4" fill="#fff"/><circle cx="33" cy="9" r="2.4" fill="#fff"/><text x="24" y="41" text-anchor="middle" font-size="27" font-weight="900" font-family="\'M PLUS Rounded 1c\', sans-serif" fill="#ff4a5e" stroke="#231a3a" stroke-width="1.6" paint-order="stroke">7</text></svg>';
  const TOOLBOX = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="#d9f2ff" stroke="#231a3a" stroke-width="3"/><path d="M18 17 V12 Q18 9 21 9 H27 Q30 9 30 12 V17" fill="none" stroke="#231a3a" stroke-width="3"/><rect x="7" y="16" width="34" height="23" rx="4" fill="#ff7a59" stroke="#231a3a" stroke-width="2.6"/><path d="M7 25 H41" stroke="#231a3a" stroke-width="2.4"/><rect x="20" y="22" width="8" height="7" rx="2" fill="#ffd34d" stroke="#231a3a" stroke-width="2"/></svg>';

  let stageIndex = 0;
  // スキル一覧（本と星）
  const BOOK = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="#e6dcff" stroke="#231a3a" stroke-width="3"/><path d="M10 12 Q17 9 24 13 Q31 9 38 12 V37 Q31 34 24 38 Q17 34 10 37 Z" fill="#fff8ea" stroke="#231a3a" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 13 V38" stroke="#231a3a" stroke-width="2.2"/><path d="M17 17 l1.6 3.4 3.6.4 -2.7 2.4 .8 3.6 -3.3-1.9 -3.3 1.9 .8-3.6 -2.7-2.4 3.6-.4 Z" fill="#ffd23d" stroke="#231a3a" stroke-width="1.4" stroke-linejoin="round"/><path d="M27 19 H34 M27 24 H34 M27 29 H32" stroke="#8a7cc0" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="12" rx="3" fill="#ffd23d" stroke="#231a3a" stroke-width="2.2"/><path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none" stroke="#231a3a" stroke-width="2.6"/><circle cx="12" cy="15.5" r="2" fill="#231a3a"/></svg>';
  let session = null;
  let roomPassword = '';
  let showPass = false;
  let lastRoomStage = -1;

  const stars = (n) => Array.from({ length: 5 }, (_, i) => `<span class="star ${i < n ? 'on' : ''}">★</span>`).join('');

  function myProfile() {
    const l = S.getLoadout();
    const itemOf = (slot) => { const k = l.equipped[slot]; return k ? k.split(':')[0] : null; };
    return {
      name: l.name, atk: l.atk, hp: l.hp, spd: l.spd,
      weapon: l.weapon ? l.weapon.item : 'kunai',
      weaponRarity: l.weapon ? l.weapon.rarity : 'common',
      weaponLv: (S.parseKey(l.equipped.weapon) || {}).lv || 0,
      belt: itemOf('belt'), boots: itemOf('boots'),
      gear: l.gear,
      char: l.char || '',
      look: l.look || '',
    };
  }

  /* ---------------------------------------------------------
   *  ロビー（ホーム）画面
   * --------------------------------------------------------- */
  function render() {
    stageIndex = S.maxStage();   // 一番先の遊べるステージから
    const el = $('#screen-lobby');
    el.innerHTML = `
      <div class="screen-bg lobby-bg">${A.lobbyBg()}</div>
      <div class="screen-scroll">
        <div class="lobby-head">
          <div class="side-col side-grid">
            <button class="side-btn lm-btn hidden" id="btn-limited" aria-label="7日間限定ミッション">
              <span class="side-ic">${SEVEN}</span><span class="side-label">7日間限定<br>ミッション</span>
              <b class="badge hidden" id="limited-badge"></b>
            </button>
            <button class="side-btn" id="btn-tools" aria-label="どうぐ">
              <span class="side-ic">${TOOLBOX}</span><span class="side-label">どうぐ</span>
              <b class="badge hidden" id="tools-badge"></b>
            </button>
            <button class="side-btn" id="btn-mission" aria-label="ミッション">
              <span class="side-ic">${A.skillIcon('scroll')}</span><span class="side-label">ミッション</span>
              <b class="badge hidden" id="mission-badge"></b>
            </button>
            <button class="side-btn hidden" id="btn-present" aria-label="プレゼント">
              <span class="side-ic">${GIFT}</span><span class="side-label">プレゼント</span>
              <b class="badge hidden" id="present-badge"></b>
            </button>
          </div>
          <div class="game-logo">
            <span class="logo-main outline">${esc(C.GAME_TITLE).replace(' ', '<br>')}</span>
            <span class="logo-sub">${esc(C.GAME_SUBTITLE)}</span>
            <span class="logo-btns"><button class="rank-btn" id="btn-ranking">${DS.record.TROPHY}<span>ランキング</span></button><button class="rank-btn sk-btn" id="btn-skills">${BOOK}<span>スキル一覧</span></button></span>
          </div>
          <div class="side-col right-col">
          <button class="side-btn" id="btn-settings" aria-label="設定">
            <span class="side-ic gear-ic"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="#b7c3d6" stroke="#231a3a" stroke-width="3"/>
              <path d="M24 9 l3 4 5-1 1 5 4 3 -2 4 2 4 -4 3 -1 5 -5 -1 -3 4 -3 -4 -5 1 -1 -5 -4 -3 2 -4 -2 -4 4 -3 1 -5 5 1 Z" fill="#6b7a94" stroke="#231a3a" stroke-width="2.4" stroke-linejoin="round"/>
              <circle cx="24" cy="24" r="6" fill="#e9eef6" stroke="#231a3a" stroke-width="2.4"/></svg></span>
            <span class="side-label">設定</span>
          </button>
          <button class="side-btn" id="btn-friends" aria-label="フレンド">
            <span class="side-ic">${DS.friends.ICON}</span><span class="side-label">フレンド</span>
            <b class="badge hidden" id="friend-badge"></b>
          </button>
          </div>
        </div>

        <div class="seg" role="tablist">
          <button class="seg-btn active" data-tab="stage" role="tab">ステージ選択</button>
          <button class="seg-btn" data-tab="join" role="tab">ロビーに参加</button>
          <button class="seg-btn seg-mg" data-tab="mini" role="tab">ミニゲーム</button>
        </div>

        <div class="panel active" data-panel="stage">
          <div class="stage-card">
            <div class="stage-frame" id="stage-frame">
              <div class="stage-art-wrap" id="stage-track"></div>
              <span class="stage-no outline" id="stage-no"></span>
              <span class="stage-area" id="stage-area"></span>
              <span class="stage-clear hidden" id="stage-clear">CLEAR</span>
              <div class="stage-lock hidden" id="stage-lock"><span class="lock-big"></span><b id="stage-lock-text"></b></div>
              <button class="arrow arrow-l" id="stage-prev" aria-label="前のステージ">‹</button>
              <button class="arrow arrow-r" id="stage-next" aria-label="次のステージ">›</button>
            </div>
            <div class="stage-info">
              <h2 class="stage-name" id="stage-name"></h2>
              <div class="stage-rec" id="stage-rec"></div>
              <div class="ow-row hidden" id="stage-ow"></div>
              <p class="stage-desc" id="stage-desc"></p>
              <div class="stage-foes" id="stage-foes"></div>
            </div>
            <div class="stage-nav">
              <div class="area-pips" id="stage-dots"></div>
              <button class="btn btn-small btn-white" id="btn-stage-list">一覧</button>
            </div>
          </div>
          <div class="party-hint">
            <span class="party-heads">${C.PLAYER_COLORS.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
            最大${C.MAX_PLAYERS}人で協力プレイ！
          </div>
          <div class="stage-actions">
            <button class="btn btn-blue btn-big" id="btn-solo">ソロで出撃</button>
            <button class="btn btn-yellow btn-big" id="btn-create">ロビーを作成</button>
          </div>
        </div>

        <div class="panel" data-panel="mini">
          <div class="mg-panel">
            <p class="mg-menu-lead">フレンドと<b>2〜4人</b>で対戦！ 武器やスキルの攻撃はなし。<br>移動速度と、ガードシールドなどの<b>攻撃ではない効果</b>が有利に働きます。</p>
            <div class="mg-list" id="mg-list">${C.MINIGAMES.list.map((g, i) => `
              <button class="mg-item ${i === 0 ? 'sel' : ''}" data-k="${g.key}" style="--gc:${g.color}">
                <span class="mg-item-ic">${DS.minigame.icon(g.key)}</span>
                <span class="mg-item-body"><b>${esc(g.name)}</b><small>${esc(g.desc)}</small>
                  <em>${g.times ? `制限時間 ${g.times.map((t) => t + '秒').join(' / ')}` : '最後の1人になるまで'}</em></span>
              </button>`).join('')}</div>
            <button class="btn btn-pink btn-big" id="btn-mg-create">ミニゲームのロビーを作成</button>
            <p class="note">参加する人は「ロビーに参加」タブでロビーIDとパスワードを入力するか、フレンドの招待から入れます。ゲームはロビーの中でも変えられます。</p>
          </div>
        </div>

        <div class="panel" data-panel="join">
          <div class="join-art">${A.squad()}</div>
          <div class="form-card">
            <label class="field"><span>ロビーID</span>
              <input id="join-id" inputmode="numeric" autocomplete="off" maxlength="7" placeholder="6桁の数字"></label>
            <label class="field"><span>パスワード</span>
              <input id="join-pass" autocomplete="off" maxlength="12" placeholder="ホストに教えてもらおう"></label>
            <button class="btn btn-green btn-big" id="btn-join">ロビーに参加</button>
          </div>
          <p class="note">ホストから「ロビーID」と「パスワード」を教えてもらって入力してください。</p>
        </div>
      </div>`;
    bindHome(el);
    updateStage();
  }

  function bindHome(el) {
    $$('.seg-btn', el).forEach((b) => b.addEventListener('click', () => {
      $$('.seg-btn', el).forEach((x) => x.classList.toggle('active', x === b));
      $$('.panel', el).forEach((p) => p.classList.toggle('active', p.dataset.panel === b.dataset.tab));
    }));
    $('#stage-prev', el).addEventListener('click', () => setStage(stageIndex - 1));
    $('#stage-next', el).addEventListener('click', () => setStage(stageIndex + 1));
    $('#btn-stage-list', el).addEventListener('click', () => openStageList({ current: stageIndex, max: S.maxStage(), onPick: (i) => setStage(i) }));
    $('#btn-present', el).addEventListener('click', () => openPresents());
    enableSwipe($('#stage-frame', el), (dir) => setStage(stageIndex + dir));
    $('#btn-create', el).addEventListener('click', () => openCreateDialog());
    // ミニゲームのタブ
    let mgPick = C.MINIGAMES.list[0].key;
    $$('#mg-list .mg-item', el).forEach((b) => b.addEventListener('click', () => {
      mgPick = b.dataset.k;
      $$('#mg-list .mg-item', el).forEach((x) => x.classList.toggle('sel', x === b));
    }));
    $('#btn-mg-create', el).addEventListener('click', () => openCreateDialog(mgPick));
    $('#btn-solo', el).addEventListener('click', startSolo);
    $('#stage-ow', el).addEventListener('click', (e) => {
      if (!e.target.closest('.ow-chip')) return;
      S.data.flags.owOff = !S.data.flags.owOff; S.persist();
      toast(S.data.flags.owOff ? `圧倒モードを OFF にしました（いつもの${normalMin()}分の試合）` : `圧倒モードを ON にしました（${Math.round(GC.OVERWHELM.seconds / 60)}分でボス戦）`, 'info');
      updateStage(false);
    });
    $('#btn-mission', el).addEventListener('click', () => DS.mission.open());
    $('#btn-limited', el).addEventListener('click', () => DS.mission.openLimited());
    $('#btn-tools', el).addEventListener('click', () => DS.mission.openTools());
    $('#btn-settings', el).addEventListener('click', () => DS.settings.open());
    $('#btn-friends', el).addEventListener('click', () => DS.friends.open());
    $('#btn-ranking', el).addEventListener('click', () => DS.record.openRanking());
    $('#btn-skills', el).addEventListener('click', () => openSkillList());
    updateMissionBadge();
    $('#btn-join', el).addEventListener('click', doJoin);
    $('#join-id', el).addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); });
    $('#join-pass', el).addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
  }

  function enableSwipe(target, onSwipe) {
    let x0 = null, y0 = 0;
    target.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; x0 = e.clientX; y0 = e.clientY; });
    target.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
    });
    target.addEventListener('pointercancel', () => { x0 = null; });
  }

  let lastArt = '', lastDir = 1;
  function setStage(i) {
    lastDir = i < stageIndex ? -1 : 1;
    stageIndex = (i + C.STAGES.length) % C.STAGES.length;
    updateStage(true);
  }
  const cleared = (i) => (S.data.missions.stages[C.STAGES[i].key] || 0) > 0;

  /** 目安の強さと今の強さを比べる行 */
  /* ---------- 圧倒モード（v22）：戦闘力が目安よりとても高いと、3分でボス戦 ---------- */
  /** 表示（ok：条件を満たしている / on：使う設定 / canToggle：押して切りかえられる） */
  function owRender(el, ok, on, canToggle) {
    if (!el) return;
    el.classList.toggle('hidden', !ok);
    if (!ok) { el.innerHTML = ''; el.dataset.k = ''; return; }
    const html = `<${canToggle ? 'button' : 'span'} class="ow-chip ${on ? 'on' : 'off'}">
      <span class="ow-bolt" aria-hidden="true">${OW_ICON}</span>
      <span class="ow-txt"><b>圧倒モード</b><small>${on ? `${Math.round(GC.OVERWHELM.seconds / 60)}分でボス戦！` : `いつもの${normalMin()}分の試合`}</small></span>
      <em>${on ? 'ON' : 'OFF'}</em></${canToggle ? 'button' : 'span'}>`;
    if (el.dataset.k !== html) { el.dataset.k = html; el.innerHTML = html; }
  }
  const normalMin = () => Math.round((GC.MATCH_REAL || GC.MATCH_SECONDS) / 60);
  const OW_ICON = '<svg viewBox="0 0 24 24"><path d="M14 2 L4 14 H11 L9 22 L20 9 H13 Z" fill="#ffe14d" stroke="#231a3a" stroke-width="2" stroke-linejoin="round"/></svg>';
  /** 出撃するときに圧倒モードになるか */
  function owActive(stage, members, off) { return !off && GC.overwhelmOk(stage, members); }

  function recHtml(i) {
    const t = GC.stageScale(i).target, st = S.getStats();
    const ok = (mine, need) => (mine >= need ? 'ok' : mine >= need * 0.6 ? 'near' : 'low');
    return `<small>目安</small><span class="rec ${ok(st.atk, t.atk)}"><b class="c-atk">ATK</b>${fmtBig(t.atk)}</span><span class="rec ${ok(st.hp, t.hp)}"><b class="c-hp">HP</b>${fmtBig(t.hp)}</span>`;
  }

  function updateStage(anim) {
    const s = C.STAGES[stageIndex];
    const wrap = $('#stage-track');
    if (lastArt !== s.biome || !wrap.firstChild) {
      wrap.innerHTML = A.stage(s.biome);
      lastArt = s.biome;
    }
    if (anim) { wrap.classList.remove('swap-l', 'swap-r'); void wrap.offsetWidth; wrap.classList.add(lastDir < 0 ? 'swap-l' : 'swap-r'); }
    $('#stage-no').textContent = 'STAGE ' + s.no;
    $('#stage-area').textContent = `${s.area} ${((s.no - 1) % 10) + 1}/10`;
    $('#stage-clear').classList.toggle('hidden', !cleared(stageIndex));
    $('#stage-name').textContent = s.name;
    $('#stage-desc').textContent = s.desc;
    $('#stage-rec').innerHTML = recHtml(stageIndex);
    owRender($('#stage-ow'), S.isStageOpen(stageIndex) && GC.overwhelmOk(stageIndex, [S.getStats()]), !S.data.flags.owOff, true);
    const ro = GC.stageRoster(stageIndex);
    const boss = GC.BOSSES[ro.boss];
    const mid = ro.midboss || 'bigZombie';
    const foes = [...new Set(ro.spawns.map((x) => x.type))].concat(mid);
    // 雑魚敵と中ボスを1行目、ボスは1行下に
    $('#stage-foes').innerHTML = `<small>出現する敵</small>
      <div class="foe-row">${foes.map((t) => `<span class="foe${t === mid ? ' mid' : ''}" title="${DS.gameConfig.ENEMIES[t].name}">${A.enemyIcon(t)}</span>`).join('')}</div>
      <div class="foe-row boss-row"><span class="foe boss" title="${boss.name}">${A.enemyIcon(ro.boss)}</span><span class="foe-boss"><em>BOSS</em>${esc(boss.name)}</span></div>`;
    // 前のステージをクリアしていないステージはロック
    const open = S.isStageOpen(stageIndex);
    $('#stage-lock').classList.toggle('hidden', open);
    if (!open) {
      $('#stage-lock .lock-big').innerHTML = LOCK;
      $('#stage-lock-text').textContent = `STAGE ${stageIndex}「${C.STAGES[stageIndex - 1].name}」をクリアすると解放`;
    }
    $('#btn-solo').disabled = !open; $('#btn-create').disabled = !open;
    $('#stage-frame').style.setProperty('--accent', s.accent);
    // 今のエリアの10ステージ
    const a0 = Math.floor(stageIndex / 10) * 10;
    $('#stage-dots').innerHTML = Array.from({ length: 10 }, (_, k) => {
      const i = a0 + k;
      return `<button class="pip ${i === stageIndex ? 'active' : ''} ${cleared(i) ? 'done' : ''} ${S.isStageOpen(i) ? '' : 'locked'}" data-i="${i}" aria-label="ステージ${i + 1}">${i + 1}</button>`;
    }).join('');
    $$('#stage-dots .pip').forEach((d) => d.addEventListener('click', () => setStage(+d.dataset.i)));
    updatePresentBadge();
  }

  /** ステージ一覧（エリアごとに10ステージ） */
  function openStageList({ current, max, onPick, title }) {
    const m = modal({
      title: title || 'ステージ一覧', cls: 'modal-wide stage-list-modal',
      body: C.BIOMES.map((b, bi) => `
        <div class="sl-area" style="--accent:${b.accent}">
          <h3 class="sl-head"><span>${esc(b.name)}</span><small>STAGE ${bi * 10 + 1}〜${bi * 10 + 10}</small></h3>
          <div class="sl-grid">${Array.from({ length: 10 }, (_, k) => {
            const i = bi * 10 + k;
            const lock = i > max;
            return `<button class="sl-cell ${i === current ? 'sel' : ''} ${lock ? 'locked' : ''} ${cleared(i) ? 'done' : ''}" data-i="${i}">
              <span class="sl-boss">${A.enemyIcon(GC.STAGE_BOSSES[i])}</span><b>${i + 1}</b>${cleared(i) ? '<i class="sl-ok">✓</i>' : ''}${lock ? `<i class="sl-lock">${LOCK}</i>` : ''}</button>`;
          }).join('')}</div>
        </div>`).join(''),
      buttons: [{ label: 'とじる', cls: 'btn-gray' }],
    });
    $$('.sl-cell', m.el).forEach((b) => b.addEventListener('click', () => {
      const i = +b.dataset.i;
      if (i > max) { toast(`STAGE ${i}「${C.STAGES[i - 1].name}」をクリアすると解放`, 'error'); return; }
      m.close(); onPick(i);
    }));
    const sel = $('.sl-cell.sel', m.el);
    if (sel) setTimeout(() => sel.scrollIntoView({ block: 'center' }), 50);
  }

  /* ---------- スキル・アビリティ一覧（★1〜赤★1 の強化内容） ---------- */
  const EVO = GC.EVO_STAR || 6;
  const starLabel = (n) => (n >= EVO ? '<b class="sk-evo">赤★1</b>' : `<b class="sk-st">${'★'.repeat(n)}</b>`);
  function openSkillList(tab) {
    let mode = tab || 'skill';
    const m = modal({ title: 'スキル・アビリティ一覧', cls: 'modal-wide modal-sk', body: '', buttons: [{ label: 'とじる', cls: 'btn-gray' }] });
    const draw = () => {
      const isSkill = mode === 'skill';
      const defs = isSkill ? GC.SKILLS : GC.ABILITIES;
      const keys = Object.keys(defs).sort((a, b) => (isSkill ? (defs[b].weapon ? 1 : 0) - (defs[a].weapon ? 1 : 0) : 0));
      m.body.innerHTML = `
        <div class="seg sk-seg"><button class="seg-btn ${isSkill ? 'active' : ''}" data-m="skill">スキル（${Object.keys(GC.SKILLS).length}）</button><button class="seg-btn ${!isSkill ? 'active' : ''}" data-m="ability">アビリティ（${Object.keys(GC.ABILITIES).length}）</button></div>
        <p class="note dark">${isSkill
          ? `1試合で武器を含めて<b>${GC.SLOTS.skills}つ</b>まで持てます。<b>武器</b>のスキルは、装備している武器のものだけ出ます。★5の次は<b>赤★1（進化）</b>で、いつも発動して大きくパワーアップします。`
          : `1試合で<b>${GC.SLOTS.abilities}つ</b>まで持てます。★5の次は<b>赤★1</b>（もう1段階）です。`}　名前をタップすると開きます。</p>
        <div class="sk-list">${keys.map((k, i) => {
          const d = defs[k];
          const tag = isSkill ? (d.weapon ? '武器' : 'スキル') : 'アビリティ';
          return `<details class="sk-item ${isSkill ? (d.weapon ? 'weapon' : 'skill') : 'ability'}" ${i === 0 ? 'open' : ''}>
            <summary><span class="sk-ic">${A.skillIcon(k)}</span><span class="sk-name"><b>${esc(d.name)}</b><em>${tag}</em></span><i class="sk-open"></i></summary>
            <table class="sk-tbl">${[1, 2, 3, 4, 5, EVO].map((n) => `<tr class="${n >= EVO ? 'evo' : ''}"><th>${starLabel(n)}</th><td>${esc(d.desc(n)).replace('【進化】', '')}</td></tr>`).join('')}</table>
          </details>`;
        }).join('')}</div>`;
      $$('.sk-seg .seg-btn', m.el).forEach((b) => b.addEventListener('click', () => { mode = b.dataset.m; draw(); m.body.scrollTop = 0; }));
    };
    draw();
  }

  /* ---------- 運営からのプレゼント ---------- */
  function updatePresentBadge() {
    const btn = $('#btn-present');
    if (!btn) return;
    btn.classList.toggle('hidden', !S.presentsVisible());
    const n = S.presentCount();
    const b = $('#present-badge');
    b.textContent = n; b.classList.toggle('hidden', !n);
    btn.classList.toggle('has', !!n);
  }
  function openPresents(noCheck) {
    const list = S.presentList().slice().reverse();
    const m = modal({
      title: 'プレゼントボックス', cls: 'modal-wide',
      body: list.length ? `<div class="pr-list">${list.map((p) => `
        <div class="pr-item ${p.claimed ? 'claimed' : ''}">
          <span class="pr-ic">${GIFT}</span>
          <div class="pr-text"><b>${esc(p.title)}</b><small>${esc(p.text || '')}</small>
            ${p.coins || !(Object.keys(p.tickets || {}).length || p.bp || p.essence) ? `<span class="pr-reward">${A.coin()}コイン ×${fmt(p.coins || 0)}</span>` : ''}
            ${p.bp ? `<span class="pr-reward pr-tk">${DS.mission.rewardChip({ bp: p.bp })}<small>ランダム設計図</small></span>` : ''}
            ${p.essence ? `<span class="pr-reward pr-tk">${DS.mission.rewardChip({ essence: p.essence })}<small>エナジーエッセンス</small></span>` : ''}
            ${Object.keys(p.tickets || {}).map((k) => `<span class="pr-reward pr-tk">${DS.mission.rewardChip({ ticket: k, ticketN: p.tickets[k] })}</span>`).join('')}
            ${(p.gift || p.allGift) && p.at ? `<span class="pr-date">${new Date(p.at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} に届きました${p.until && !p.claimed ? `（${new Date(p.until).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })} まで）` : ''}</span>` : ''}</div>
          ${p.claimed ? '<span class="pr-done">受け取り済み</span>' : `<button class="btn btn-small btn-pink" data-id="${esc(p.id)}">受け取る</button>`}
        </div>`).join('')}</div>` : '<p class="center">プレゼントはありません。</p>',
      buttons: [
        { label: 'とじる', cls: 'btn-gray' },
        { label: 'まとめて受け取る', cls: 'btn-pink', disabled: !S.presentCount(), onClick: () => showClaimed(claim()) },
      ],
    });
    const claim = (id) => {
      const r = S.claimPresent(id);
      // 管理ページから届いたものは、受け取ったことをサーバーにも書く
      if (r.gifts.length && DS.gifts) DS.gifts.report(r.gifts);
      if (r.allGifts.length && DS.gifts) DS.gifts.reportAll(r.allGifts);
      updatePresentBadge();
      return r;
    };
    // チケットが入っていたら、もらったものの画面を（プレゼントボックスの上に）出す
    const showClaimed = (r) => {
      if (r.got.some((g) => g.ticket || g.bp || g.essence)) DS.mission.showGot(r.got, 'プレゼントを受け取りました');
      else if (r.coins) { toast(`${fmt(r.coins)} コインを受け取りました！`, 'good'); if (DS.sound) DS.sound.play('gachaOpen'); }
    };
    $$('.pr-item .btn', m.el).forEach((b) => b.addEventListener('click', () => { const r = claim(b.dataset.id); m.close(); openPresents(true); showClaimed(r); }));
    // 開いたときに、管理ページからのプレゼントが届いていないか見る（届いていたら開き直す）
    if (DS.gifts && !noCheck) DS.gifts.check(true).then((n) => { if (n && m.el.isConnected) { m.close(); openPresents(true); } });
  }

  function updateMissionBadge() {
    const b = $('#mission-badge');
    if (!b) return;
    const n = DS.mission.readyCount();
    b.textContent = n;
    b.classList.toggle('hidden', !n);
    $('#btn-mission').classList.toggle('locked', !S.missionsUnlocked());
    // 7日間限定ミッション：期間中（と、まだ始まっていないとき）だけ出す。終わったら消える
    const li = S.limitedInfo();
    $('#btn-limited').classList.toggle('hidden', li.started && !li.active);
    const ln = DS.mission.limitedReady();
    $('#limited-badge').textContent = ln;
    $('#limited-badge').classList.toggle('hidden', !ln);
    $('#btn-limited').classList.toggle('not-started', !li.started);
    const tn = S.toolCount();
    $('#tools-badge').textContent = tn;
    $('#tools-badge').classList.toggle('hidden', !tn);
  }

  /* ---------- ソロで出撃（通信なし） ---------- */
  function startSolo() {
    if (DS.battle.active || partyGuard()) return;
    if (!S.isStageOpen(stageIndex)) { toast('前のステージをクリアすると遊べます', 'error'); return; }
    const me = Object.assign({ id: 'solo', slot: 0, isHost: true }, myProfile());
    DS.battle.start({ stageIndex, members: [me], selfId: 'solo', isHost: true, session: null, onExit: () => {},
      overwhelm: owActive(stageIndex, [me], S.data.flags.owOff) });
  }

  /* ---------- ロビー作成 ---------- */
  function openCreateDialog(miniGame) {
    if (partyGuard()) return;
    if (!miniGame && !S.isStageOpen(stageIndex)) { toast('前のステージをクリアすると遊べます', 'error'); return; }
    const s = C.STAGES[stageIndex];
    const mg = miniGame && C.MINIGAMES.list.find((g) => g.key === miniGame);
    const pass = String(Math.floor(1000 + Math.random() * 9000));
    const m = modal({
      title: mg ? 'ミニゲームのロビーを作成' : 'ロビーを作成',
      body: `
        ${mg ? `<div class="create-stage create-mg" style="--gc:${mg.color}"><span class="create-mg-ic">${DS.minigame.icon(mg.key)}</span><span class="outline">${esc(mg.name)}</span></div>`
          : `<div class="create-stage">${A.stage(s.biome)}<span class="outline">STAGE ${s.no}　${esc(s.name)}</span></div>`}
        <label class="field"><span>パスワード（4〜12文字）</span>
          <input id="create-pass" autocomplete="off" maxlength="12" value="${pass}"></label>
        <p class="note dark">参加する仲間に「ロビーID」と「パスワード」を伝えてください。ロビーIDは作成後に表示されます。</p>`,
      buttons: [
        { label: 'やめる', cls: 'btn-gray' },
        {
          label: '作成する', cls: 'btn-yellow', keepOpen: true,
          onClick: async (btn) => {
            const pw = $('#create-pass', m.el).value.trim();
            if (pw.length < 4) { toast('パスワードは4文字以上にしてください', 'error'); return; }
            btn.disabled = true; btn.textContent = '作成中…';
            try {
              const sess = await DS.net.createLobby({ password: pw, stage: stageIndex, profile: myProfile(), maxStage: S.maxStage(),
                mode: mg ? 'mini' : 'battle', mg: mg ? { game: mg.key } : null, owOff: !!S.data.flags.owOff });
              m.close();
              if (DS.net.fellBackToLocal) toast('オンラインに接続できないため、ローカルモードで作成しました', 'info', 3500);
              openRoom(sess, pw);
            } catch (e) {
              toast(DS.net.message(e.code), 'error', 3200);
              btn.disabled = false; btn.textContent = '作成する';
            }
          },
        },
      ],
    });
  }

  /* ---------- ロビー参加 ---------- */
  let joining = false;
  async function doJoin() {
    if (partyGuard()) return;
    const id = $('#join-id').value.replace(/\D/g, '');
    const pw = $('#join-pass').value.trim();
    if (id.length !== 6) { toast(DS.net.message('badid'), 'error'); return; }
    if (!pw) { toast('パスワードを入力してください', 'error'); return; }
    if (await joinLobbyById(id, pw)) $('#join-pass').value = '';
  }
  /** ロビーIDとパスワードで参加する（フレンドの招待からも使う） */
  async function joinLobbyById(id, pw) {
    if (partyGuard()) return false;
    if (joining || session || (DS.battle && DS.battle.active) || (DS.minigame && DS.minigame.active)) return false;
    const btn = $('#btn-join');
    joining = true;
    if (btn) { btn.disabled = true; btn.textContent = '接続中…'; }
    try {
      const sess = await DS.net.joinLobby({ lobbyId: String(id), password: pw, profile: myProfile() });
      openRoom(sess, pw);
      return true;
    } catch (e) {
      toast(DS.net.message(e.code), 'error', 3200);
      return false;
    } finally {
      joining = false;
      if (btn) { btn.disabled = false; btn.textContent = 'ロビーに参加'; }
    }
  }

  /* ---------------------------------------------------------
   *  ルーム画面（待機室）
   * --------------------------------------------------------- */
  function openRoom(sess, password) {
    session = sess;
    roomPassword = password;
    showPass = false;
    lastRoomStage = -1;
    lastMgKey = '';
    const room = $('#room');
    room.innerHTML = `
      <div class="room-bg" id="room-bg"></div>
      <div class="room-scroll">
        <header class="room-head">
          <button class="btn btn-red btn-small" id="room-leave">退出</button>
          <h2 class="room-title outline">ロビー</h2>
          <span class="net-chip" id="net-chip"></span>
        </header>
        <div class="room-go" id="room-go">
          <small>パーティー<br>のまま</small>
          <button class="room-go-btn" data-go="1"><span class="room-go-ic">${A.navIcon('gacha')}</span>ガチャ</button>
          <button class="room-go-btn" data-go="3"><span class="room-go-ic">${A.navIcon('equip')}</span>装備</button>
          <button class="room-go-btn" data-go="0"><span class="room-go-ic">${A.navIcon('shop')}</span>ショップ</button>
        </div>
        <div class="cred">
          <div class="cred-item"><small>ロビーID</small><b id="room-id"></b></div>
          <div class="cred-item"><small>パスワード</small>
            <span class="cred-row"><b id="room-pass"></b><button class="mini-btn" id="toggle-pass">表示</button></span></div>
          <button class="mini-btn copy" id="copy-cred">コピー</button>
        </div>
        <button class="btn btn-small btn-green call-friends" id="call-friends">${DS.friends.ICON}フレンドを呼ぶ</button>
        <div class="room-stage" id="room-stage">
          <div class="room-stage-art" id="room-stage-art"></div>
          <button class="arrow arrow-l" id="room-prev" aria-label="前のステージ">‹</button>
          <button class="arrow arrow-r" id="room-next" aria-label="次のステージ">›</button>
          <div class="room-stage-label">
            <span class="stage-chip" id="room-stage-no"></span>
            <b id="room-stage-name"></b>
            <span class="room-stars" id="room-stars"></span>
          </div>
          <button class="mini-btn room-list" id="room-list">一覧</button>
        </div>
        <div class="room-mg hidden" id="room-mg"></div>
        <div class="stage-rec room-rec" id="room-rec"></div>
        <div class="ow-row room-ow hidden" id="room-ow"></div>
        <p class="room-note" id="room-note"></p>
        <span class="room-diff" id="room-diff"></span>
        <div class="slots" id="slots"></div>
      </div>
      <div class="room-foot">
        <p class="room-status" id="room-status"></p>
        <button class="btn btn-big" id="room-action"></button>
      </div>`;
    room.classList.remove('hidden', 'min');
    roomMin = false;
    requestAnimationFrame(() => room.classList.add('show'));

    $('#room-leave').addEventListener('click', confirmLeave);
    $('#toggle-pass').addEventListener('click', () => { showPass = !showPass; renderRoom(); });
    $('#copy-cred').addEventListener('click', copyCredentials);
    $('#call-friends').addEventListener('click', () => DS.friends.openInvite(() => ({
      lobbyId: session.state.lobbyId, password: roomPassword, stage: session.state.stage,
      mg: session.state.mode === 'mini' && session.state.mg ? session.state.mg.game : '' })));
    $('#room-mg').addEventListener('click', (e) => {
      if (!session || !session.isHost || session.state.mode !== 'mini') return;
      const list = C.MINIGAMES.list, cur = session.state.mg || {};
      const i = list.findIndex((g) => g.key === cur.game);
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.dir) session.setMinigame(list[(i + +b.dataset.dir + list.length) % list.length].key);
      else if (b.dataset.t) session.setMinigame(cur.game, +b.dataset.t);
    });
    $('#room-prev').addEventListener('click', () => session.setStage(session.state.stage - 1));
    $('#room-next').addEventListener('click', () => session.setStage(session.state.stage + 1));
    $('#room-list').addEventListener('click', () => {
      if (!session.isHost) return;
      const st = session.state;
      openStageList({ current: st.stage, max: st.maxStage != null ? st.maxStage : C.STAGES.length - 1, onPick: (i) => session.setStage(i), title: 'ステージを選ぶ' });
    });
    enableSwipe($('#room-stage'), (dir) => { if (session.isHost) session.setStage(session.state.stage + dir); });
    $('#room-ow').addEventListener('click', (e) => {
      if (!session || !session.isHost || !e.target.closest('.ow-chip')) return;
      const on = !!session.state.owOff;   // 今 OFF なら ON にする
      S.data.flags.owOff = !on; S.persist();
      session.setOverwhelm(on);
    });
    $('#room-action').addEventListener('click', onAction);
    $('#room-go').addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) minimizeRoom(+b.dataset.go); });

    sess.on('state', () => renderRoom());
    sess.on('joined', (m) => toast(`${m.name} が参加しました`, 'good'));
    sess.on('left', (m) => toast(`${m.name} が退出しました`));
    sess.on('start', (st) => { if (roomMin) showRoomAgain(); showStart(st); });
    sess.on('closed', (reason) => {
      if (DS.battle && DS.battle.active) DS.battle.stop();
      if (DS.minigame && DS.minigame.active) DS.minigame.stop();
      closeRoom();
      modal({ title: 'ロビー', body: `<p class="center">${esc(DS.net.message(reason))}</p>`, buttons: [{ label: 'OK', cls: 'btn-blue' }] });
    });
    window.addEventListener('pagehide', onPageHide);
    renderRoom();
  }

  function onPageHide() { if (session) session.leave(); }

  /* ---------- パーティーに入ったまま、ガチャ・装備・ショップに行く（v22） ---------- */
  let roomMin = false;
  function minimizeRoom(screen) {
    if (!session || !session.state || session.state.status !== 'waiting') return;
    const me = session.me, wasReady = !session.isHost && me && me.ready;
    roomMin = true;
    $('#room').classList.add('min');
    session.setAway(true);
    if (DS.nav) DS.nav.go(screen);
    updateRoomPill();
    if (wasReady) toast('準備OKを外しました。もどったら、もう一度押してね', 'info', 2800);
  }
  /** ルームの画面を出し直す（装備が変わっていたら仲間にも伝える） */
  function restoreRoom() {
    if (!session) return;
    showRoomAgain();
    session.setAway(false, myProfile());
  }
  function showRoomAgain() {
    roomMin = false;
    $('#room').classList.remove('min');
    updateRoomPill();
  }
  /** 下に出る「パーティーにもどる」ボタン */
  function updateRoomPill() {
    let pill = $('#room-pill');
    $('#app').classList.toggle('has-room-pill', !!(session && roomMin));
    if (!session || !roomMin) { if (pill) pill.remove(); return; }
    if (!pill) {
      pill = document.createElement('button');
      pill.id = 'room-pill'; pill.className = 'room-pill';
      pill.addEventListener('click', restoreRoom);
      $('#app').appendChild(pill);
    }
    const st = session.state, mini = st.mode === 'mini';
    pill.innerHTML = `<span class="room-pill-ic">${A.navIcon('lobby')}</span><span class="room-pill-txt"><b>${mini ? 'ミニゲーム' : 'パーティー'}にもどる</b><small>${mini ? '' : 'STAGE ' + C.STAGES[st.stage].no + '・'}${st.members.length}/${C.MAX_PLAYERS}人</small></span>`;
  }
  /** パーティーに入っている間は、ソロ出撃・別のロビーには行けない（ルームを出し直す） */
  function partyGuard() {
    if (!session) return false;
    toast('パーティーに参加中です', 'info');
    if (roomMin) restoreRoom();
    return true;
  }

  function closeRoom() {
    const room = $('#room');
    room.classList.remove('show');
    roomMin = false;
    room.classList.remove('min');
    const pill = $('#room-pill'); if (pill) pill.remove();
    $('#app').classList.remove('has-room-pill');
    setTimeout(() => { if (!session) { room.classList.add('hidden'); room.innerHTML = ''; } }, 250);
    session = null;
    window.removeEventListener('pagehide', onPageHide);
  }

  function confirmLeave() {
    if (!session) return;
    const host = session.isHost;
    modal({
      title: host ? 'ロビーを解散' : 'ロビーを退出',
      body: `<p class="center">${host ? 'ロビーを解散しますか？<br>参加中の仲間も退出になります。' : 'ロビーから退出しますか？'}</p>`,
      buttons: [
        { label: 'もどる', cls: 'btn-gray' },
        { label: host ? '解散する' : '退出する', cls: 'btn-red', onClick: () => { if (session) session.leave(); closeRoom(); } },
      ],
    });
  }

  function copyCredentials() {
    const st = session.state;
    const text = `【${C.GAME_TITLE}】ロビーに参加してね！\nロビーID: ${st.lobbyId}\nパスワード: ${roomPassword}`;
    const done = () => toast('ロビーIDとパスワードをコピーしました', 'good');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('コピーできませんでした', 'error'); }
    ta.remove();
  }

  function onAction() {
    if (!session) return;
    if (session.isHost) {
      if (session.state.mode === 'mini' && session.state.members.length < C.MINIGAMES.minPlayers) { toast(`ミニゲームは${C.MINIGAMES.minPlayers}人以上で遊べます`, 'error'); return; }
      if (!session.start()) toast('全員の準備OKを待っています', 'error');
    } else {
      const me = session.me;
      session.setReady(!(me && me.ready));
    }
  }

  function renderRoom() {
    if (!session || !session.state) return;
    const st = session.state;
    const host = session.isHost;
    const stg = C.STAGES[st.stage];
    const waiting = st.status === 'waiting';

    $('#room-id').textContent = st.lobbyId.slice(0, 3) + ' ' + st.lobbyId.slice(3);
    $('#room-pass').textContent = showPass ? roomPassword : '•'.repeat(Math.max(4, roomPassword.length));
    $('#toggle-pass').textContent = showPass ? '隠す' : '表示';
    $('#net-chip').textContent = st.transport === 'online' ? 'オンライン' : 'ローカル';
    $('#net-chip').classList.toggle('local', st.transport !== 'online');

    const mini = st.mode === 'mini';
    $('#room').classList.toggle('mini', mini);
    $('#room-go').classList.toggle('off', !waiting);
    updateRoomPill();
    $('.room-title').textContent = mini ? 'ミニゲーム' : 'ロビー';
    ['#room-stage', '#room-rec', '#room-diff'].forEach((q) => $(q).classList.toggle('hidden', mini));
    owRender($('#room-ow'), !mini && GC.overwhelmOk(st.stage, st.members), !st.owOff, host && waiting);
    $('#room-mg').classList.toggle('hidden', !mini);
    if (mini) renderRoomMg(st, host && waiting);
    if (!mini && lastRoomStage !== st.stage) {
      $('#room-stage-art').innerHTML = A.stage(stg.biome);
      $('#room-rec').innerHTML = recHtml(st.stage);
      $('#room-bg').style.setProperty('--accent', stg.accent);
      lastRoomStage = st.stage;
    }
    $('#room-stage-no').textContent = 'STAGE ' + stg.no;
    $('#room-stage-name').textContent = stg.name;
    $('#room-stars').innerHTML = stars(stg.diff);
    $('#room-stage').classList.toggle('can-pick', host && waiting);
    $('#room-note').textContent = mini
      ? (host ? 'あなたはホストです。ゲームを選んで、2人以上集まったらスタート！' : 'ゲームはホストが選びます。')
      : host ? 'あなたはホストです。ステージを選んで出撃しよう！'
        : S.isStageOpen(st.stage) ? 'ステージはホストが選びます。'
          : `ステージはホストが選びます。クリアすると、あなたも STAGE ${stg.no} までクリアになります！`;
    const party = st.members.length > 1, GCD = DS.gameConfig.DIFFICULTY;
    $('#room-diff').textContent = party ? `パーティー討伐：難易度×${GCD.party}（敵の体力${GCD.party}倍）` : `1人討伐：難易度×${GCD.solo}`;
    $('#room-diff').classList.toggle('solo', !party);

    // 4人分の枠
    $('#slots').innerHTML = [0, 1, 2, 3].map((i) => {
      const m = st.members.find((x) => x.slot === i);
      const color = C.PLAYER_COLORS[i];
      if (!m) {
        return `<div class="slot empty" style="--pc:${color}">
          <div class="slot-top">P${i + 1}</div>
          <div class="slot-q">?</div>
          <div class="slot-name">募集中…</div>
        </div>`;
      }
      const isMe = m.id === session.selfId;
      const badge = m.away ? `<span class="slot-badge away">${m.isHost ? 'HOST・' : ''}おでかけ中</span>`
        : m.isHost ? '<span class="slot-badge host">HOST</span>'
        : m.ready ? '<span class="slot-badge ready">準備OK</span>' : '<span class="slot-badge wait">準備中</span>';
      return `<div class="slot ${isMe ? 'me' : ''}" style="--pc:${color}">
        <div class="slot-top">P${i + 1}${m.isHost ? A.crown() : ''}${isMe ? '<em>あなた</em>' : ''}</div>
        <div class="slot-hero">${m.look ? A.charSvg(m.look) : A.hero(color)}</div>
        <div class="slot-name">${esc(m.name)}</div>
        ${mini ? slotMgHtml(m, st.mg.game) : `<div class="slot-stats"><span><b class="c-atk">ATK</b>${fmtBig(m.atk)}</span><span><b class="c-hp">HP</b>${fmtBig(m.hp)}</span></div>
        <div class="slot-weapon">${U.itemCard(m.weapon, m.weaponRarity, { cls: 'mini', lv: m.weaponLv })}</div>`}
        ${badge}
      </div>`;
    }).join('');

    // 下のボタン
    const btn = $('#room-action');
    const status = $('#room-status');
    const guests = st.members.filter((x) => !x.isHost);
    const readyN = guests.filter((x) => x.ready).length;
    btn.className = 'btn btn-big';
    if (!waiting) {
      btn.classList.add('btn-gray'); btn.disabled = true; btn.textContent = mini ? '対戦中…' : '出撃中…';
      status.textContent = '';
    } else if (host && mini) {
      const need = C.MINIGAMES.minPlayers;
      btn.classList.add('btn-pink');
      btn.disabled = !session.canStart();
      btn.textContent = `スタート！（${st.members.length}/${C.MAX_PLAYERS}人）`;
      status.textContent = st.members.length < need
        ? `あと${need - st.members.length}人以上集まるとスタートできます。フレンドを呼ぼう！`
        : readyN === guests.length ? '全員準備OK！スタートできます' : `仲間の準備を待っています（${readyN}/${guests.length}）`;
    } else if (host) {
      btn.classList.add('btn-yellow');
      btn.disabled = !session.canStart();
      btn.textContent = `出撃！（${st.members.length}/${C.MAX_PLAYERS}人）`;
      status.textContent = guests.length === 0
        ? '1人でも出撃できます。仲間を呼ぶなら ID とパスワードを伝えよう'
        : readyN === guests.length ? '全員準備OK！出撃できます'
          : guests.some((x) => x.away) ? `ガチャ・装備に行っている仲間がいます（準備OK ${readyN}/${guests.length}）` : `仲間の準備を待っています（${readyN}/${guests.length}）`;
    } else {
      const me = session.me;
      btn.disabled = false;
      if (me && me.ready) { btn.classList.add('btn-gray'); btn.textContent = '準備OKを取り消す'; status.textContent = mini ? 'ホストのスタートを待っています…' : 'ホストの出撃を待っています…'; }
      else { btn.classList.add('btn-green'); btn.textContent = '準備OK！'; status.textContent = '準備ができたらボタンを押してね'; }
    }
  }

  /* ---------- ミニゲームのルーム ---------- */
  let lastMgKey = '';
  function renderRoomMg(st, canPick) {
    const g = C.MINIGAMES.list.find((x) => x.key === (st.mg && st.mg.game)) || C.MINIGAMES.list[0];
    const key = [g.key, st.mg && st.mg.time, canPick].join('|');
    if (key === lastMgKey) return;
    lastMgKey = key;
    $('#room-mg').style.setProperty('--gc', g.color);
    $('#room-mg').innerHTML = `
      ${canPick ? '<button class="arrow arrow-l" data-dir="-1" aria-label="前のゲーム">‹</button><button class="arrow arrow-r" data-dir="1" aria-label="次のゲーム">›</button>' : ''}
      <div class="room-mg-head"><span class="room-mg-ic">${DS.minigame.icon(g.key)}</span>
        <div class="room-mg-txt"><b class="outline">${esc(g.name)}</b><small>${esc(g.desc)}</small></div></div>
      <div class="room-mg-times">${g.times
        ? `<span>制限時間</span>${g.times.map((t) => `<button class="mg-time ${st.mg.time === t ? 'on' : ''}" data-t="${t}" ${canPick ? '' : 'disabled'}>${t}秒</button>`).join('')}`
        : '<span>最後の1人になるまで</span>'}</div>
      <div class="room-mg-dots">${C.MINIGAMES.list.map((x) => `<i class="${x.key === g.key ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  function slotMgHtml(m, game) {
    const e = DS.mg.effectsOf(m, game);
    const names = DS.minigame.effectNames(e);
    return `<div class="slot-mg"><span class="slot-spd ${e.speed > 100 ? 'up' : e.speed < 100 ? 'down' : ''}">速度 ${e.speed}%</span>
      ${names.map((n) => `<span class="slot-eff">${esc(n)}</span>`).join('')}</div>`;
  }

  /* ---------- 出撃演出（ゲーム本編はここから呼び出す） ---------- */
  function showStart(st) {
    const room = $('#room');
    const old = $('.start-ov', room);
    if (old) old.remove();
    const stg = C.STAGES[st.stage];
    const mini = st.mode === 'mini' && st.mg;
    const mgDef = mini && C.MINIGAMES.list.find((g) => g.key === st.mg.game);
    const ov = document.createElement('div');
    ov.className = 'start-ov' + (mini ? ' mini' : '');
    ov.innerHTML = `
      <div class="start-art">${mini ? `<span class="start-mg-ic">${DS.minigame.icon(mgDef.key)}</span>` : A.stage(stg.biome)}</div>
      <div class="start-title outline">${mini ? `ミニゲーム<br>${esc(mgDef.name)}` : `STAGE ${stg.no}<br>${esc(stg.name)}`}</div>
      <div class="start-faces">${st.members.map((m) => `<span class="start-face" style="--pc:${C.PLAYER_COLORS[m.slot]}">${m.look ? A.charFace(m.look) : A.heroFace(C.PLAYER_COLORS[m.slot])}<small>${esc(m.name)}</small></span>`).join('')}</div>
      <div class="start-count outline" id="start-count">3</div>
      <div class="start-msg hidden" id="start-msg">
        <p>ゲーム本編は次のステップで実装します。</p>
        <button class="btn btn-blue" id="start-back">ロビーに戻る</button>
      </div>`;
    room.appendChild(ov);
    const sess = session;
    let n = 3;
    const cnt = $('#start-count', ov);
    const tick = setInterval(() => {
      n--;
      if (n > 0) { cnt.textContent = n; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); return; }
      clearInterval(tick);
      cnt.textContent = 'GO!';
      setTimeout(() => {
        const payload = {
          stage: stg, stageIndex: st.stage, members: st.members, selfId: sess && sess.selfId, isHost: sess && sess.isHost, session: sess, loadout: S.getLoadout(),
          overwhelm: !mini && owActive(st.stage, st.members, st.owOff),
          // バトルが終わってロビーに戻るとき
          onExit: () => { ov.remove(); if (sess && sess.isHost && !sess.ended) sess.endGame(); },
          // バトル中にロビーから抜けるとき（ゲスト）
          onLeave: () => { if (DS.battle) DS.battle.stop(); if (DS.minigame) DS.minigame.stop(); ov.remove(); if (sess) sess.leave(); closeRoom(); },
        };
        if (mini) {
          DS.minigame.start(Object.assign(payload, { game: st.mg.game, time: st.mg.time }));
          return;
        }
        if (DS.hooks && typeof DS.hooks.onGameStart === 'function' && DS.hooks.onGameStart(payload) === true) return;
        cnt.classList.add('hidden');
        $('#start-msg', ov).classList.remove('hidden');
      }, 600);
    }, 800);
    $('#start-back', ov).addEventListener('click', () => {
      ov.remove();
      if (sess && sess.isHost) sess.endGame();
    });
  }

  DS.lobby = {
    render, updateMissionBadge, updatePresentBadge, openStageList, openPresents, joinLobbyById, openSkillList,
    inRoom: () => !!session,
    refreshStage: () => { if ($('#stage-track')) { stageIndex = Math.min(stageIndex, C.STAGES.length - 1); updateStage(false); } },
    goToStage: (i) => { if ($('#stage-track')) { stageIndex = i; updateStage(true); } },
    get session() { return session; },
  };
})();

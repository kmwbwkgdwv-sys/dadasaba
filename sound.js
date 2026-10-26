/* =========================================================
 *  sound.js  ― 効果音と BGM（WebAudio で作るので音声ファイルは不要）
 *
 *  DS.sound.play('levelup')       効果音
 *  DS.sound.bgm('battle')         BGM を切り替え（'lobby' | 'battle' | 'boss' | null）
 *  DS.sound.setVolume(bgm, se)    0〜100
 *  DS.sound.setBgmOn(true/false)  BGM の ON / OFF
 *  ブラウザの決まりで、最初に画面をタップするまで音は鳴りません。
 *  iPhone では「タップして指を離したとき」でないと音を出す許可がもらえないので、touchend / click でも準備します。
 * ========================================================= */
(function () {
  let ctx = null, bgmGain = null, seGain = null, noiseBuf = null;
  let vol = { bgm: 60, se: 80 };
  let bgmOn = true;
  let wantBgm = null, curBgm = null, seqTimer = null, seq = null;
  const last = {};
  // v22：iPhone の音の鳴らし方（Audio Session API）
  //  'ambient' ：ほかのアプリ（YouTube・音楽）と一緒に鳴る。止めないし、画面の上（再生中の表示）にも出ない。マナーモード中は鳴らない
  //  'playback'：マナーモードでも鳴るが、ほかのアプリの音は止まり、再生中の表示が出る
  let sessionType = 'ambient';
  function applySession() {
    try { if (navigator.audioSession && navigator.audioSession.type !== sessionType) navigator.audioSession.type = sessionType; } catch (e) { /* noop */ }
  }
  applySession();   // 音を鳴らす前に決めておく

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    bgmGain = ctx.createGain(); seGain = ctx.createGain();
    bgmGain.connect(ctx.destination); seGain.connect(ctx.destination);
    applyVolume();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  let primed = false;
  function unlock() {
    applySession();
    if (!init()) return;
    if (!primed) {
      // 無音を一瞬鳴らして、音を出せる状態にする（iPhone 向け）
      try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); primed = true; } catch (e) { /* noop */ }
    }
    const go = () => { if (ctx.state === 'running' && wantBgm !== curBgm) startBgm(wantBgm); };
    if (ctx.state !== 'running') ctx.resume().then(go).catch(() => {}); else go();
  }
  ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.visibilityState === 'hidden') { try { ctx.suspend(); } catch (e) { /* noop */ } }
    else ctx.resume().then(() => { if (wantBgm !== curBgm) startBgm(wantBgm); }).catch(() => {});
  });

  const curve = (v) => Math.pow(Math.max(0, Math.min(100, v)) / 100, 2);
  function applyVolume() {
    if (!ctx) return;
    bgmGain.gain.setTargetAtTime(curve(vol.bgm) * 0.32, ctx.currentTime, 0.05);
    seGain.gain.setTargetAtTime(curve(vol.se) * 0.7, ctx.currentTime, 0.02);
  }
  function setVolume(bgm, se) { vol = { bgm, se }; applyVolume(); }

  /* ---------- 音の部品 ---------- */
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);     // MIDIノート番号 → 周波数
  function tone(out, t, { f = 440, f2, type = 'square', dur = 0.1, vol: v = 0.3, a = 0.005, det = 0 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(out, t, { dur = 0.1, vol: v = 0.3, freq = 2000, q = 1, type = 'bandpass', f2 }) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const arp = (out, t, notes, step, o) => notes.forEach((n, i) => tone(out, t + i * step, Object.assign({ f: hz(n) }, o)));

  /* ---------- 効果音 ---------- */
  // limit: 同じ音を鳴らす最短の間隔（秒）。敵を倒す音などが鳴りすぎないように
  const SFX = {
    click:    { limit: 0.04, fn: (o, t) => tone(o, t, { f: 880, f2: 660, dur: 0.06, vol: 0.18 }) },
    equip:    { fn: (o, t) => arp(o, t, [76, 83], 0.07, { type: 'triangle', dur: 0.12, vol: 0.3 }) },
    gacha:    { fn: (o, t) => { tone(o, t, { f: 180, f2: 900, type: 'sawtooth', dur: 0.8, vol: 0.12 }); noise(o, t, { dur: 0.8, vol: 0.08, freq: 600, f2: 5000 }); } },
    gachaOpen:{ fn: (o, t) => arp(o, t, [72, 76, 79, 84], 0.07, { type: 'triangle', dur: 0.22, vol: 0.3 }) },
    gachaBig: { fn: (o, t) => { arp(o, t, [72, 76, 79, 84, 88, 91, 96], 0.06, { type: 'square', dur: 0.3, vol: 0.18 }); noise(o, t + 0.2, { dur: 1.2, vol: 0.12, freq: 8000, type: 'highpass' }); } },
    levelup:  { fn: (o, t) => arp(o, t, [72, 76, 79, 84, 88], 0.06, { type: 'square', dur: 0.16, vol: 0.2 }) },
    kill:     { limit: 0.06, fn: (o, t) => tone(o, t, { f: 420 + Math.random() * 80, f2: 120, type: 'triangle', dur: 0.08, vol: 0.12 }) },
    hurt:     { limit: 0.25, fn: (o, t) => { tone(o, t, { f: 180, f2: 60, type: 'sine', dur: 0.18, vol: 0.45 }); noise(o, t, { dur: 0.1, vol: 0.12, freq: 900 }); } },
    zap:      { limit: 0.15, fn: (o, t) => { noise(o, t, { dur: 0.25, vol: 0.18, freq: 3000, q: 0.7 }); tone(o, t, { f: 1200, f2: 200, type: 'sawtooth', dur: 0.15, vol: 0.08 }); } },
    swing:    { limit: 0.2, fn: (o, t) => noise(o, t, { dur: 0.2, vol: 0.14, freq: 600, f2: 3000, q: 2 }) },
    shot:     { limit: 0.12, fn: (o, t) => { noise(o, t, { dur: 0.08, vol: 0.14, freq: 1800 }); tone(o, t, { f: 300, f2: 90, type: 'square', dur: 0.06, vol: 0.06 }); } },
    box:      { limit: 0.1, fn: (o, t) => noise(o, t, { dur: 0.14, vol: 0.25, freq: 700, q: 1.5 }) },
    heal:     { limit: 0.2, fn: (o, t) => arp(o, t, [84, 91], 0.08, { type: 'sine', dur: 0.3, vol: 0.25 }) },
    skill:    { fn: (o, t) => { noise(o, t, { dur: 0.35, vol: 0.2, freq: 400, f2: 4000, q: 3 }); arp(o, t + 0.05, [79, 86], 0.08, { type: 'triangle', dur: 0.2, vol: 0.2 }); } },
    rush:     { fn: (o, t) => { for (let i = 0; i < 3; i++) tone(o, t + i * 0.32, { f: 520, f2: 820, type: 'sawtooth', dur: 0.3, vol: 0.12 }); } },
    alarm:    { fn: (o, t) => { for (let i = 0; i < 2; i++) arp(o, t + i * 0.5, [81, 76], 0.18, { type: 'square', dur: 0.16, vol: 0.14 }); } },
    boss:     { fn: (o, t) => { tone(o, t, { f: 55, type: 'sawtooth', dur: 1.2, vol: 0.3, a: 0.05 }); tone(o, t, { f: 82, type: 'sawtooth', dur: 1.2, vol: 0.2, a: 0.05, det: 8 }); noise(o, t, { dur: 1.0, vol: 0.2, freq: 120, type: 'lowpass' }); } },
    beep:     { fn: (o, t) => tone(o, t, { f: 988, dur: 0.12, vol: 0.2 }) },
    tick:     { limit: 0.03, fn: (o, t) => tone(o, t, { f: 1480, f2: 1100, type: 'triangle', dur: 0.04, vol: 0.14 }) },   // ルーレットのカチカチ
    down:     { fn: (o, t) => arp(o, t, [67, 63, 58], 0.12, { type: 'triangle', dur: 0.2, vol: 0.3 }) },
    revive:   { fn: (o, t) => arp(o, t, [72, 79, 84, 91], 0.07, { type: 'sine', dur: 0.3, vol: 0.3 }) },
    win:      { fn: (o, t) => { arp(o, t, [72, 76, 79], 0.12, { type: 'square', dur: 0.14, vol: 0.2 }); tone(o, t + 0.36, { f: hz(84), type: 'square', dur: 0.8, vol: 0.2 }); tone(o, t + 0.36, { f: hz(76), type: 'triangle', dur: 0.8, vol: 0.2 }); } },
    lose:     { fn: (o, t) => arp(o, t, [69, 65, 62, 57], 0.22, { type: 'triangle', dur: 0.35, vol: 0.3 }) },
  };
  function play(name) {
    if (!ctx || ctx.state !== 'running' || vol.se <= 0) return;
    const s = SFX[name];
    if (!s) return;
    const now = ctx.currentTime;
    if (s.limit && last[name] && now - last[name] < s.limit) return;
    last[name] = now;
    try { s.fn(seGain, now + 0.005); } catch (e) { /* noop */ }
  }

  /* ---------- BGM（小さなシーケンサー） ---------- */
  // コード進行（ルート音）と、1小節16ステップの伴奏パターン
  const SONGS = {
    lobby: { bpm: 104, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
      lead: [76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 76, 0, 72, 0, 0, 0, 74, 0, 76, 0, 79, 0, 76, 74, 72, 0, 74, 0, 67, 0, 0, 0],
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [0, 0, 1, 0], lv: 0.06 },
    battle: { bpm: 136, chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]],
      lead: [81, 0, 81, 84, 0, 81, 79, 0, 77, 0, 77, 79, 0, 77, 76, 0, 76, 0, 79, 0, 84, 0, 83, 81, 79, 0, 76, 0, 74, 0, 76, 0],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1], snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], hat: [1, 0, 1, 1], lv: 0.05 },
    boss: { bpm: 152, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
      lead: [74, 74, 0, 77, 0, 74, 81, 0, 79, 0, 77, 0, 76, 0, 73, 0, 74, 74, 0, 77, 0, 81, 84, 0, 82, 0, 81, 0, 79, 0, 76, 0],
      kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1], snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0], hat: [1, 1, 1, 1], lv: 0.05 },
  };
  function startBgm(name) {
    stopBgm();
    if (!bgmOn || !name || !ctx || ctx.state !== 'running' || !SONGS[name]) return;
    curBgm = name;
    const song = SONGS[name];
    const out = ctx.createGain(); out.gain.value = 1; out.connect(bgmGain);
    const stepDur = 60 / song.bpm / 4;
    seq = { song, out, step: 0, next: ctx.currentTime + 0.08, stepDur };
    seqTimer = setInterval(tick, 25);
  }
  function stopBgm() {
    clearInterval(seqTimer); seqTimer = null;
    if (seq) {
      const o = seq.out;
      try { o.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08); setTimeout(() => o.disconnect(), 600); } catch (e) { /* noop */ }
    }
    seq = null; curBgm = null;
  }
  function tick() {
    if (!seq || !ctx) return;
    const { song, out, stepDur } = seq;
    // 止まっていた（画面を切り替えた など）あとは、遅れた分を飛ばして今から鳴らす
    if (seq.next < ctx.currentTime - 0.5) seq.next = ctx.currentTime + 0.05;
    while (seq.next < ctx.currentTime + 0.15) {
      const t = seq.next, st = seq.step, bar = Math.floor(st / 16) % song.chords.length, i = st % 16;
      const ch = song.chords[bar];
      if (i % 4 === 0) tone(out, t, { f: hz(ch[0] - 12), type: 'triangle', dur: stepDur * 3.6, vol: 0.5 });
      if (i % 4 === 2) tone(out, t, { f: hz(ch[0] - 12 + 7), type: 'triangle', dur: stepDur * 1.6, vol: 0.3 });
      if (i % 8 === 4) ch.forEach((n) => tone(out, t, { f: hz(n), type: 'sawtooth', dur: stepDur * 3, vol: 0.05, a: 0.02 }));
      const ln = song.lead[st % song.lead.length];
      if (ln) tone(out, t, { f: hz(ln), type: 'square', dur: stepDur * 1.8, vol: song.lv * 2 });
      if (song.kick[i]) tone(out, t, { f: 150, f2: 40, type: 'sine', dur: 0.16, vol: 0.9 });
      if (song.snare[i]) noise(out, t, { dur: 0.12, vol: 0.35, freq: 1800, q: 0.8 });
      if (song.hat[i % song.hat.length]) noise(out, t, { dur: 0.03, vol: 0.14, freq: 9000, type: 'highpass' });
      seq.next += stepDur; seq.step++;
    }
  }
  function bgm(name) {
    wantBgm = name;
    if (!ctx || ctx.state !== 'running') return;   // タップされたら始まる
    if (name !== curBgm) startBgm(name);
  }
  function setBgmOn(on) {
    bgmOn = !!on;
    if (!bgmOn) stopBgm();
    else if (ctx && ctx.state === 'running' && wantBgm) startBgm(wantBgm);
  }

  // ボタンを押したときの音
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.btn, .nav-btn, .seg-btn, .chip, .arrow, .side-btn');
    if (b && !b.disabled) play('click');
  });

  /** ほかのアプリの音と一緒に鳴らすか（true：YouTube などを止めない） */
  function setMix(on) {
    const t = on ? 'ambient' : 'playback';
    if (t === sessionType) return;
    sessionType = t;
    applySession();
    // 鳴らし方は音を出し直したときに切りかわるので、いったん止めて再開する
    if (ctx && ctx.state === 'running') ctx.suspend().then(() => ctx.resume()).catch(() => {});
  }

  DS.sound = { play, bgm, setVolume, setBgmOn, setMix, get ready() { return !!ctx && ctx.state === 'running'; }, get playing() { return curBgm; } };
})();

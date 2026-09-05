/* Backswing — app
   Router, views, symptom planner, guided player, pain log, storage. No framework. */

(() => {
  const STORE_KEY = 'backswing.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (iso) => { const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
  const fmtMin = (secs) => { const m = Math.round(secs / 60); return m < 1 ? '1 min' : m + ' min'; };

  /* ---------- storage ---------- */
  let store = { log: [], done: [], plan: { area: null, timing: null, feel: null }, theme: null, sound: true };
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) store = Object.assign(store, JSON.parse(raw)); } catch (e) { /* storage unavailable: run in memory */ }
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }

  const SAMPLE_LOG = (() => {
    const out = []; const base = new Date(); const rows = [
      [34, 6, false, 'walk-carry', 18, 'Cold start, stiff by the 14th'], [27, 5, false, 'walk-carry', 18, ''], [21, 3, true, 'walk-push', 18, 'Warmed up in the car park'],
      [14, 4, true, 'cart', 18, ''], [9, 2, true, 'walk-push', 9, 'Did the cool-down'], [3, 2, true, 'walk-push', 18, 'Best it has felt in months']
    ];
    rows.forEach(([ago, pain, warm, move, holes, note]) => {
      const d = new Date(base); d.setDate(d.getDate() - ago);
      out.push({ id: 's' + ago, date: d.toISOString().slice(0, 10), area: 'lowback', pain, warm, move, holes, note, sample: true });
    });
    return out;
  })();

  function entries() { return store.log.length ? store.log.slice().sort((a, b) => a.date < b.date ? -1 : 1) : SAMPLE_LOG; }
  function usingSamples() { return store.log.length === 0; }

  function streak() {
    const days = new Set(store.done.map(d => d.date));
    let n = 0; const d = new Date();
    if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------- theme ---------- */
  function applyTheme() {
    const root = document.documentElement;
    if (store.theme) root.dataset.theme = store.theme; else delete root.dataset.theme;
    const btn = $('#theme-btn');
    if (btn) btn.querySelector('span').textContent = store.theme === 'dark' ? 'Dark' : store.theme === 'light' ? 'Light' : 'Auto theme';
  }
  function cycleTheme() {
    store.theme = store.theme === null ? 'dark' : store.theme === 'dark' ? 'light' : null;
    save(); applyTheme();
  }

  /* ---------- toast ---------- */
  let toastT = null;
  function toast(msg) {
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600);
  }

  /* ---------- shared renderers ---------- */
  function exCard(ex, extra = '') {
    return `<button class="excard" data-ex="${ex.id}" type="button">
      ${figureSVG(ex.pose, { size: 72, label: ex.name })}
      <div><b>${esc(ex.name)}</b><span>${esc(ex.reps)}</span><span class="tag tag-type-${ex.type}">${TYPES[ex.type]}</span>${extra}</div>
    </button>`;
  }
  function icon(name) {
    const I = {
      play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
      pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
      x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      next: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
      prev: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
      check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
      flag: '<svg class="level-flag" viewBox="0 0 46 62"><path d="M6 0h4v62H6z"/><path d="M10 4h32l-9 10 9 10H10z"/></svg>'
    };
    return I[name] || '';
  }

  /* ---------- exercise modal ---------- */
  function openExercise(id) {
    const ex = EX[id]; if (!ex) return;
    closeModal();
    const m = document.createElement('div');
    m.className = 'modal'; m.id = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', ex.name);
    m.innerHTML = `<div class="modal-card">
      <div class="modal-head"><button class="btn btn-ghost btn-sm" data-close type="button">${icon('x')} Close</button></div>
      <div class="modal-body">
        <div>${figureSVG(ex.pose, { size: 160, label: ex.name })}</div>
        <div>
          <h2>${esc(ex.name)}</h2>
          <p class="muted">${esc(ex.why)}</p>
          <div class="modal-meta">
            <span class="tag tag-type-${ex.type}">${TYPES[ex.type]}</span>
            <span class="tag ${ex.where === 'course' ? 'tag-course' : ''}">${ex.where === 'course' ? 'Works at the course' : 'At home'}</span>
            <span class="tag">${esc(ex.gear)}</span>
            <span class="tag">${esc(ex.reps)}</span>
          </div>
          <div class="modal-section"><h4>How</h4><ol>${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>
          <div class="modal-section"><div class="cue">${esc(ex.cue)}</div></div>
          <div class="modal-section"><h4>Watch out for</h4><p>${esc(ex.avoid)}</p></div>
          <div class="modal-section"><h4>Why it matters for your swing</h4><p>${esc(ex.golf)}</p></div>
          <div class="modal-actions">
            <button class="btn btn-primary" data-start type="button">${icon('play')} Start ${ex.sides ? 'both sides' : ''} (${fmtMin(ex.secs * (ex.sides ? 2 : 1))})</button>
          </div>
        </div>
      </div></div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
    $('[data-start]', m).addEventListener('click', () => { closeModal(); startPlayer({ title: ex.name, blocks: [{ ex: ex.id, secs: ex.secs }] }); });
    $('[data-close]', m).focus();
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }

  /* ---------- player ---------- */
  let player = null;
  function expandBlocks(blocks) {
    const out = [];
    blocks.forEach(b => {
      const ex = EX[b.ex]; if (!ex) return;
      if (ex.sides) { out.push({ ex, secs: b.secs, side: 'First side' }); out.push({ ex, secs: b.secs, side: 'Other side' }); }
      else out.push({ ex, secs: b.secs, side: null });
    });
    return out;
  }
  let audio = null;
  function beep(kind) {
    if (!store.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = kind === 'done' ? 880 : 660;
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (kind === 'done' ? 0.5 : 0.18));
      o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + 0.55);
    } catch (e) { /* no audio */ }
  }

  function startPlayer(opts) {
    closePlayer();
    const blocks = expandBlocks(opts.blocks);
    if (!blocks.length) return;
    const total = blocks.reduce((s, b) => s + b.secs, 0);
    player = { opts, blocks, i: 0, left: blocks[0].secs, running: true, tick: null, total, elapsed: 0 };
    const el = document.createElement('div');
    el.className = 'player'; el.id = 'player'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', opts.title);
    document.body.appendChild(el);
    if (window.Lab) Lab.stop();
    renderPlayer();
    player.tick = setInterval(() => {
      if (!player || !player.running) return;
      player.left -= 1; player.elapsed += 1;
      if (player.left <= 0) {
        if (player.i >= player.blocks.length - 1) { finishPlayer(); return; }
        player.i++; player.left = player.blocks[player.i].secs; beep('next'); renderPlayer();
      } else { updateTimer(); if (player.left <= 3) beep('tick'); }
    }, 1000);
  }

  function renderPlayer() {
    if (!player) return;
    const el = $('#player'); const b = player.blocks[player.i]; const ex = b.ex;
    const r = 52, circ = 2 * Math.PI * r;
    el.innerHTML = `
      <div class="player-top">
        <b>${esc(player.opts.title)}</b>
        <div class="player-progress" aria-hidden="true">${player.blocks.map((x, i) => `<i class="${i < player.i ? 'done' : i === player.i ? 'now' : ''}"></i>`).join('')}</div>
        <button class="btn btn-ghost btn-sm" data-close type="button">${icon('x')} Close</button>
      </div>
      <div class="player-main">
        <div class="player-fig">${figureSVG(ex.pose, { size: 380, label: ex.name })}</div>
        <div class="player-info">
          <span class="small">${player.i + 1} of ${player.blocks.length}${b.side ? ' · ' + b.side : ''}</span>
          <h1>${esc(ex.name)}</h1>
          <div class="cue">${esc(ex.cue)}</div>
          <ol>${ex.steps.slice(0, 3).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
          <div class="timer">
            <div class="timer-num">
              <svg class="ring" viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="${r}"/><circle class="arc" id="ring-arc" cx="60" cy="60" r="${r}" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="0"/></svg>
              <span class="num" id="timer-num">${player.left}</span>
            </div>
            <div class="timer-side">${esc(ex.reps)}<small>${fmtMin(player.total - player.elapsed)} left in total</small></div>
          </div>
        </div>
      </div>
      <div class="player-controls">
        <button class="btn" data-prev type="button" ${player.i === 0 ? 'disabled' : ''}>${icon('prev')} Back</button>
        <button class="btn btn-primary btn-lg" data-toggle type="button">${player.running ? icon('pause') + ' Pause' : icon('play') + ' Resume'}</button>
        <button class="btn" data-next type="button">Skip ${icon('next')}</button>
        <button class="btn btn-ghost" data-sound type="button" aria-pressed="${store.sound}">${store.sound ? 'Sound on' : 'Sound off'}</button>
      </div>`;
    $('[data-close]', el).onclick = () => closePlayer();
    $('[data-toggle]', el).onclick = () => { player.running = !player.running; renderPlayer(); };
    $('[data-next]', el).onclick = () => { if (player.i >= player.blocks.length - 1) { finishPlayer(); return; } player.elapsed += player.left; player.i++; player.left = player.blocks[player.i].secs; renderPlayer(); };
    $('[data-prev]', el).onclick = () => { if (player.i === 0) return; player.elapsed -= (player.blocks[player.i].secs - player.left); player.i--; player.left = player.blocks[player.i].secs; player.elapsed -= player.left; renderPlayer(); };
    $('[data-sound]', el).onclick = () => { store.sound = !store.sound; save(); renderPlayer(); };
    updateTimer();
  }
  function updateTimer() {
    if (!player) return;
    const b = player.blocks[player.i]; const n = $('#timer-num'); const arc = $('#ring-arc');
    if (n) n.textContent = player.left;
    if (arc) { const circ = parseFloat(arc.getAttribute('stroke-dasharray')); arc.style.strokeDashoffset = (circ * (1 - player.left / b.secs)).toFixed(1); }
  }
  function finishPlayer() {
    if (!player) return;
    clearInterval(player.tick); player.tick = null; player.running = false;
    beep('done');
    const id = player.opts.routineId || null;
    store.done.push({ date: todayISO(), routine: id, title: player.opts.title, secs: player.total });
    save();
    const el = $('#player');
    el.innerHTML = `<div class="player-top"><b>${esc(player.opts.title)}</b><span></span><button class="btn btn-ghost btn-sm" data-close type="button">${icon('x')} Close</button></div>
      <div class="player-done">
        <span class="num">${streak()}</span>
        <h1>Done. ${streak() > 1 ? streak() + ' days in a row.' : 'Day one.'}</h1>
        <p class="muted">${fmtMin(player.total)} logged. Your back will not thank you today, but it will in three weeks.</p>
        <div class="plan-actions">
          <button class="btn btn-primary" data-close type="button">${icon('check')} Finish</button>
          <a class="btn" href="#log" data-close>Log a round</a>
        </div>
      </div>`;
    $$('[data-close]', el).forEach(b => b.addEventListener('click', () => closePlayer()));
    updateRail();
  }
  function closePlayer() {
    if (player && player.tick) clearInterval(player.tick);
    player = null;
    const el = $('#player'); if (el) el.remove();
    if (location.hash.replace('#', '') === 'lab' || !location.hash) if (window.Lab) Lab.start();
  }

  /* ---------- views ---------- */
  const view = () => $('#view');
  const routes = ['lab', 'fix', 'routines', 'exercises', 'prevent', 'log'];

  function route() {
    const r = location.hash.replace('#', '').split('/')[0];
    return routes.includes(r) ? r : 'lab';
  }

  function render() {
    const r = route();
    closeModal();
    $$('.nav a').forEach(a => { if (a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const lab = $('#lab-view');
    if (r === 'lab') { lab.hidden = false; view().hidden = true; view().innerHTML = ''; bootLab(); return; }
    lab.hidden = true; view().hidden = false;
    if (window.Lab) Lab.stop();
    ({ fix: renderFix, routines: renderRoutines, exercises: renderExercises, prevent: renderPrevent, log: renderLog })[r]();
    window.scrollTo({ top: 0 });
  }

  /* ----- lab ----- */
  let labBooted = false;
  function bootLab() {
    const canvas = $('#lab-canvas');
    if (!window.Lab) return;
    if (!labBooted) {
      let ok = false;
      const qs = new URLSearchParams(location.search); const dbgT = qs.get('t');
      try { ok = Lab.init(canvas, { noAuto: dbgT !== null }); } catch (e) { console.error(e); ok = false; }
      const loading = $('#lab-loading');
      if (!ok) { loading.textContent = 'The 3D lab needs WebGL and the three.js scripts. Check your connection and reload.'; return; }
      loading.hidden = true;
      labBooted = true;
      wireLab();
      if (dbgT !== null) { Lab.seek(parseFloat(dbgT) || 0); if (qs.get('cam')) Lab.setCamera(qs.get('cam'), true); }
    }
    Lab.start();
    updateLabToday();
  }

  function wireLab() {
    const scrub = $('#scrub'), playBtn = $('#play-btn');
    Lab.on('frame', (f) => {
      $('#lab-phase').firstChild.textContent = f.phase;
      const L = f.load;
      $('#ro-hip').textContent = Math.round(Math.abs(L.hipTurn)) + '°';
      $('#ro-sh').textContent = Math.round(Math.abs(L.shoulderTurn)) + '°';
      $('#ro-x').textContent = Math.round(Math.abs(L.xfactor)) + '°';
      const s = L.stress.lumbar; const bar = $('#load-fill');
      bar.style.width = Math.min(100, s / 1.3 * 100).toFixed(1) + '%';
      bar.className = s >= 1 ? 'stop' : s >= 0.7 ? 'warn' : '';
      $('#load-deg').textContent = Math.round(Math.abs(L.lu)) + '° of 13°';
      $('#load-msg').textContent = s >= 1 ? 'Over capacity. This is where lower back pain starts.' : s >= 0.7 ? 'Working hard. Fine for a good swing, tiring over 18 holes.' : 'Comfortable. The hips and mid back are doing their share.';
      if (!scrub.matches(':active')) { scrub.value = Math.round(f.t * 1000); scrub.style.setProperty('--pct', (f.t * 100) + '%'); }
    });
    Lab.on('play', (p) => { playBtn.innerHTML = p ? icon('pause') : icon('play'); playBtn.setAttribute('aria-label', p ? 'Pause swing' : 'Play swing'); });
    Lab.on('hover', (h) => { const r = $('#lab-hover'); if (h) { r.textContent = h.label; r.hidden = false; } else r.hidden = true; });
    Lab.on('select', (s) => {
      const box = $('#lab-selection');
      if (!s) { box.className = 'selection'; box.innerHTML = '<h4>Tap a body part</h4><p>Pick where it hurts on the 3D body and we will build a plan for it.</p>'; return; }
      const plan = PLANS[s.area];
      box.className = 'selection on';
      box.innerHTML = `<h4>${esc(s.label)}</h4><p>${esc(plan ? plan.key : '')}</p><a class="btn btn-primary btn-sm" href="#fix">Build a plan for the ${esc(AREAS[s.area].label.toLowerCase())}</a>`;
      store.plan.area = s.area; store.plan.timing = null; store.plan.feel = null; save();
    });
    playBtn.addEventListener('click', () => Lab.toggle());
    scrub.addEventListener('input', () => { Lab.seek(scrub.value / 1000); scrub.style.setProperty('--pct', (scrub.value / 10) + '%'); });
    $$('.lab-speed button').forEach(b => b.addEventListener('click', () => { $$('.lab-speed button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); Lab.setSpeed(b.dataset.speed); }));
    $$('.lab-cams button').forEach(b => b.addEventListener('click', () => { $$('.lab-cams button').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); Lab.setCamera(b.dataset.cam); }));
    $$('.switch[data-fault]').forEach(b => b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); Lab.setFault(b.dataset.fault, on); }));
    $('#loop-btn').addEventListener('click', (e) => { const b = e.currentTarget; const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); Lab.setLoop(on); });
    document.addEventListener('keydown', (e) => {
      if (route() !== 'lab' || player || $('#modal')) return;
      if (e.target.matches('input, textarea, select')) return;
      if (e.code === 'Space') { e.preventDefault(); Lab.toggle(); }
      if (e.key === 'ArrowRight') { Lab.seek(Lab.getState().t + 0.02); }
      if (e.key === 'ArrowLeft') { Lab.seek(Lab.getState().t - 0.02); }
    });
  }

  function updateLabToday() {
    const el = $('#lab-today'); if (!el) return;
    const last = entries().slice(-1)[0];
    const n = streak();
    el.innerHTML = `${n ? `<b>${n} day${n > 1 ? 's' : ''} in a row.</b> ` : ''}${last ? `Last round: pain ${last.pain} of 10${last.warm ? ', warmed up' : ', no warm-up'}${last.sample ? ' (sample)' : ''}.` : 'No rounds logged yet.'}`;
  }

  /* ----- fix it ----- */
  const BODY_HOT = [
    ['neck', 100, 72, 'Neck'], ['shoulder', 54, 94, 'Shoulder'], ['shoulder', 146, 94, ''], ['upback', 100, 132, 'Mid back'], ['lowback', 100, 204, 'Lower back'],
    ['hip', 70, 254, 'Hip'], ['hip', 130, 254, ''], ['elbow', 34, 164, 'Elbow'], ['elbow', 166, 164, ''], ['wrist', 28, 232, 'Wrist'], ['wrist', 172, 232, ''],
    ['knee', 74, 322, 'Knee'], ['knee', 126, 322, '']
  ];
  function bodyMap(sel) {
    return `<svg viewBox="0 0 200 420" role="group" aria-label="Body map, back view">
      <path class="bm-limb-outline" d="M52 92 L36 164 L28 232 M148 92 L164 164 L172 232"/>
      <path class="bm-limb-outline bm-leg-outline" d="M76 250 L74 322 L72 404 M124 250 L126 322 L128 404"/>
      <path class="bm-limb bm-leg" d="M76 250 L74 322 L72 404 M124 250 L126 322 L128 404"/>
      <path class="bm-limb" d="M52 92 L36 164 L28 232 M148 92 L164 164 L172 232"/>
      <path class="bm-body" d="M50 86 Q100 66 150 86 L142 236 Q100 252 58 236 Z"/>
      <rect class="bm-body" x="88" y="56" width="24" height="24" rx="6"/>
      <circle class="bm-body" cx="100" cy="36" r="24"/>
      <path class="bm-spine" d="M100 80 L100 236"/>
      ${BODY_HOT.map(([area, x, y, label]) => `<g class="bm-hot ${sel === area ? 'on' : ''}" data-area="${area}" tabindex="0" role="button" aria-label="${AREAS[area].label}">
        <circle cx="${x}" cy="${y}" r="14"/>${label ? `<text x="${x}" y="${y + 30}" text-anchor="middle">${label}</text>` : ''}</g>`).join('')}
    </svg>`;
  }

  function renderFix() {
    const p = store.plan;
    const ready = p.area && p.timing && p.feel;
    view().innerHTML = `
      <div class="view-head"><div><h1>Where does it hurt?</h1><p>Three quick questions. Then a plan you can start right now, and what to change so it does not come back.</p></div></div>
      <div class="fix">
        <div class="bodymap" id="bodymap">${bodyMap(p.area)}</div>
        <div class="fix-steps">
          <div class="fix-step"><h3>1. The spot</h3><div class="chips" id="area-chips">${Object.keys(PLANS).map(a => `<button class="chip" type="button" data-area="${a}" aria-pressed="${p.area === a}">${AREAS[a].label}</button>`).join('')}</div></div>
          <div class="fix-step"><h3>2. When it shows up</h3><div class="chips" id="timing-chips">${Object.entries(TIMINGS).map(([k, t]) => `<button class="chip" type="button" data-timing="${k}" aria-pressed="${p.timing === k}"><b>${t.label}</b><small>${t.hint}</small></button>`).join('')}</div></div>
          <div class="fix-step"><h3>3. What it feels like</h3><div class="chips" id="feel-chips">${Object.entries(FEELS).map(([k, t]) => `<button class="chip" type="button" data-feel="${k}" aria-pressed="${p.feel === k}"><b>${t.label}</b><small>${t.hint}</small></button>`).join('')}</div></div>
          <div id="plan">${ready ? renderPlan(p.area, p.timing, p.feel) : `<div class="empty">${p.area ? 'Answer the two questions above to get your plan.' : 'Tap the body or pick a spot to begin.'}</div>`}</div>
        </div>
      </div>
      <p class="disclaimer">Backswing gives general exercise and injury-prevention guidance for golfers. It is not medical advice and cannot examine you. If you are unsure, in a lot of pain, or any of the "see someone" signs apply, get assessed by a doctor or physiotherapist.</p>`;
    const setArea = (a) => { p.area = a; save(); renderFix(); };
    $$('#bodymap .bm-hot').forEach(g => { g.addEventListener('click', () => setArea(g.dataset.area)); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setArea(g.dataset.area); } }); });
    $$('#area-chips .chip').forEach(b => b.addEventListener('click', () => setArea(b.dataset.area)));
    $$('#timing-chips .chip').forEach(b => b.addEventListener('click', () => { p.timing = b.dataset.timing; save(); renderFix(); if (p.area && p.feel) $('#plan').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    $$('#feel-chips .chip').forEach(b => b.addEventListener('click', () => { p.feel = b.dataset.feel; save(); renderFix(); if (p.area && p.timing) $('#plan').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    wirePlan();
  }

  function renderPlan(area, timing, feel) {
    const plan = PLANS[area]; const level = assessLevel(area, timing, feel); const lv = LEVELS[level];
    const exs = plan.feel[feel].map(id => EX[id]).filter(Boolean);
    const routine = ROUTINE[plan.daily];
    const total = exs.reduce((s, e) => s + e.secs * (e.sides ? 2 : 1), 0);
    const see = `<div class="plan-section"><h3>See someone if</h3><ul class="plan-list stop">${plan.see.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
    return `<div class="plan">
      <div class="level level-${level}">${icon('flag')}<div><h2>${lv.label}</h2><p>${lv.sub}</p></div></div>
      ${level === 'pickup' ? see : ''}
      <div class="plan-section"><h3>What is probably going on</h3><p>${esc(plan.intro)}</p><p>${esc(plan.key)}</p><p><b>${esc(TIMINGS[timing].label)}:</b> ${esc(plan.timing[timing])}</p></div>
      <div class="plan-section"><h3>${level === 'pickup' ? 'Gentle movement only, if it is comfortable' : 'Do these now'} <span class="muted small">${fmtMin(total)}</span></h3>
        <div class="exlist">${exs.map(e => exCard(e)).join('')}</div>
        <div class="plan-actions" style="margin-top:14px"><button class="btn btn-primary" type="button" data-start-plan>${icon('play')} Start the ${fmtMin(total)} plan</button></div>
      </div>
      <div class="plan-section"><h3>Then, most days</h3><p>The ${routine.name.toLowerCase()} routine. ${esc(routine.tagline)}</p>
        <div class="plan-actions" style="margin-top:12px"><button class="btn" type="button" data-start-routine="${routine.id}">${icon('play')} ${routine.name} (${routine.minutes} min)</button><a class="btn btn-ghost" href="#routines">All routines</a></div></div>
      <div class="plan-section"><h3>In your swing</h3><div class="faults">${plan.faults.map(id => FAULT[id]).map(f => `<div class="fault"><h4>${esc(f.name)}</h4><p>${esc(f.what)} ${esc(f.body)}</p></div>`).join('')}</div>
        <p class="small muted" style="margin-top:10px">See what these do to the spine in the <a href="#lab">3D swing lab</a>, and the full list under <a href="#prevent">Prevent</a>.</p></div>
      <div class="plan-section"><h3>Avoid for now</h3><ul class="plan-list">${plan.avoid.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
      ${level !== 'pickup' ? see : ''}
    </div>`;
  }
  function wirePlan() {
    $$('.excard').forEach(b => b.addEventListener('click', () => openExercise(b.dataset.ex)));
    const p = store.plan;
    const s = $('[data-start-plan]');
    if (s) s.addEventListener('click', () => {
      const plan = PLANS[p.area]; const exs = plan.feel[p.feel];
      startPlayer({ title: AREAS[p.area].label + ' plan', blocks: exs.map(id => ({ ex: id, secs: EX[id].secs })), routineId: 'plan:' + p.area });
    });
    $$('[data-start-routine]').forEach(b => b.addEventListener('click', () => startRoutine(b.dataset.startRoutine)));
  }
  function startRoutine(id) {
    const r = ROUTINE[id]; if (!r) return;
    startPlayer({ title: r.name, blocks: r.steps, routineId: r.id });
  }

  /* ----- routines ----- */
  function renderRoutines() {
    view().innerHTML = `
      <div class="view-head"><div><h1>Routines</h1><p>Guided, timed, one exercise at a time. The two course routines are standing only, so you can do them in the car park.</p></div></div>
      <div class="routines">${ROUTINES.map(r => {
        const secs = r.steps.reduce((s, st) => s + st.secs * (EX[st.ex].sides ? 2 : 1), 0);
        return `<article class="routine" data-routine="${r.id}">
          <div class="routine-head"><div><h3>${esc(r.name)}</h3><span class="tag ${r.where === 'course' ? 'tag-course' : ''}">${r.where === 'course' ? 'At the course' : 'At home'}</span></div><span class="num">${Math.round(secs / 60)}<small>min</small></span></div>
          <p>${esc(r.tagline)}</p>
          <div class="routine-steps" aria-hidden="true">${r.steps.map(st => figureSVG(EX[st.ex].pose, { size: 40 })).join('')}</div>
          <div class="routine-list" hidden><ol class="plan-list">${r.steps.map(st => `<li><button class="linkchip" type="button" data-ex="${st.ex}">${esc(EX[st.ex].name)}</button> <span class="small muted">${st.secs}s${EX[st.ex].sides ? ' each side' : ''}</span></li>`).join('')}</ol></div>
          <div class="routine-foot"><button class="btn btn-ghost btn-sm" type="button" data-expand>${r.steps.length} exercises</button><button class="btn btn-primary" type="button" data-start>${icon('play')} Start</button></div>
        </article>`; }).join('')}</div>`;
    $$('.routine').forEach(card => {
      $('[data-start]', card).addEventListener('click', () => startRoutine(card.dataset.routine));
      $('[data-expand]', card).addEventListener('click', (e) => { const l = $('.routine-list', card); l.hidden = !l.hidden; e.currentTarget.textContent = l.hidden ? `${ROUTINE[card.dataset.routine].steps.length} exercises` : 'Hide list'; });
      $$('[data-ex]', card).forEach(b => b.addEventListener('click', () => openExercise(b.dataset.ex)));
    });
  }

  /* ----- exercises ----- */
  const exFilter = { area: 'all', type: 'all', where: 'all', q: '' };
  function renderExercises() {
    view().innerHTML = `
      <div class="view-head"><div><h1>Exercises</h1><p>${EXERCISES.length} exercises, each with the golf reason behind it. Tap one for the steps and a timer.</p></div></div>
      <div class="filters">
        <div class="filters-row"><input class="search" id="ex-q" type="search" placeholder="Search, e.g. hip, elbow, rotation" value="${esc(exFilter.q)}" aria-label="Search exercises"></div>
        <div class="filters-row chips" id="f-area"><button class="chip" data-v="all" aria-pressed="${exFilter.area === 'all'}" type="button">All areas</button>${Object.keys(PLANS).map(a => `<button class="chip" type="button" data-v="${a}" aria-pressed="${exFilter.area === a}">${AREAS[a].short}</button>`).join('')}</div>
        <div class="filters-row chips" id="f-type"><button class="chip" data-v="all" aria-pressed="${exFilter.type === 'all'}" type="button">Any type</button>${Object.entries(TYPES).map(([k, v]) => `<button class="chip" type="button" data-v="${k}" aria-pressed="${exFilter.type === k}">${v}</button>`).join('')}
          <span style="width:12px"></span><button class="chip" data-w="all" aria-pressed="${exFilter.where === 'all'}" type="button">Anywhere</button><button class="chip" data-w="course" aria-pressed="${exFilter.where === 'course'}" type="button">Works at the course</button><button class="chip" data-w="home" aria-pressed="${exFilter.where === 'home'}" type="button">At home</button></div>
      </div>
      <div class="exgrid" id="exgrid"></div>`;
    const grid = $('#exgrid');
    const draw = () => {
      const q = exFilter.q.trim().toLowerCase();
      const list = EXERCISES.filter(e => (exFilter.area === 'all' || e.areas.includes(exFilter.area)) && (exFilter.type === 'all' || e.type === exFilter.type) && (exFilter.where === 'all' || e.where === exFilter.where) &&
        (!q || [e.name, e.why, e.golf, e.gear, ...e.areas.map(a => AREAS[a].label)].join(' ').toLowerCase().includes(q)));
      grid.innerHTML = list.length ? list.map(e => exCard(e, `<span class="small">${e.areas.filter(a => a !== 'full').map(a => AREAS[a].short).join(', ')}</span>`)).join('') : '<div class="empty">Nothing matches. Try fewer filters.</div>';
      $$('.excard', grid).forEach(b => b.addEventListener('click', () => openExercise(b.dataset.ex)));
    };
    $('#ex-q').addEventListener('input', (e) => { exFilter.q = e.target.value; draw(); });
    $$('#f-area .chip').forEach(b => b.addEventListener('click', () => { exFilter.area = b.dataset.v; $$('#f-area .chip').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }));
    $$('#f-type .chip[data-v]').forEach(b => b.addEventListener('click', () => { exFilter.type = b.dataset.v; $$('#f-type .chip[data-v]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }));
    $$('#f-type .chip[data-w]').forEach(b => b.addEventListener('click', () => { exFilter.where = b.dataset.w; $$('#f-type .chip[data-w]').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); }));
    draw();
  }

  /* ----- prevent ----- */
  function renderPrevent() {
    const groups = ['Before', 'During', 'After', 'Always'];
    view().innerHTML = `
      <div class="view-head"><div><h1>Prevent</h1><p>The seven golf injuries, the swing faults behind them, and the round-day habits that stop most of them.</p></div></div>
      <div class="prevent">
        <section><h2 style="margin-bottom:16px">The injuries</h2><div class="injuries">${INJURIES.map(inj => `<article class="injury">
          <div class="injury-head"><h3>${esc(inj.name)}</h3><span class="small">${esc(inj.stat)}</span></div>
          <p>${esc(inj.why)}</p>
          <div><b class="small">Swing faults to check</b><div class="links" style="margin-top:6px">${inj.faults.map(f => `<a class="linkchip" href="#prevent/fault-${f}" data-fault="${f}">${esc(FAULT[f].name)}</a>`).join('')}</div></div>
          <div><b class="small">Habits that help</b><ul style="margin-top:6px">${inj.habits.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>
          <div class="plan-actions"><button class="btn btn-sm" type="button" data-start-routine="${inj.routine}">${icon('play')} ${esc(ROUTINE[inj.routine].name)}</button><a class="btn btn-ghost btn-sm" href="#fix" data-area="${inj.id}">Plan for this</a></div>
        </article>`).join('')}</div></section>
        <section><h2 style="margin-bottom:6px">Swing faults and what they cost</h2><p class="muted" style="margin-bottom:16px">Each fault is usually a body limitation wearing a golf costume. Fix the body, then the swing.</p>
          <div class="faultgrid">${FAULTS.map(f => `<article class="faultcard" id="fault-${f.id}">
            <h3>${esc(f.name)}</h3><p>${esc(f.what)}</p><p class="muted"><b>Usually the body:</b> ${esc(f.body)}</p><p class="risk">${esc(f.risk)}</p>
            <div class="drill"><b>Drill:</b> ${esc(f.drill)}</div>
            <div class="links">${f.fix.map(id => `<button class="linkchip" type="button" data-ex="${id}">${esc(EX[id].name)}</button>`).join('')}</div>
          </article>`).join('')}</div></section>
        <section><h2 style="margin-bottom:16px">Round-day habits</h2>
          ${groups.map(g => `<h3 style="margin:18px 0 4px">${g}</h3><div class="habits">${HABITS.filter(h => h.when === g).map(h => `<div class="habit"><h4>${esc(h.title)}</h4><p>${esc(h.text)}</p></div>`).join('')}</div>`).join('')}
        </section>
      </div>`;
    $$('[data-ex]').forEach(b => b.addEventListener('click', () => openExercise(b.dataset.ex)));
    $$('[data-start-routine]').forEach(b => b.addEventListener('click', () => startRoutine(b.dataset.startRoutine)));
    $$('a[data-area]').forEach(a => a.addEventListener('click', () => { store.plan.area = a.dataset.area; store.plan.timing = null; store.plan.feel = null; save(); }));
    $$('a[data-fault]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); const t = $('#fault-' + a.dataset.fault); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.style.borderColor = 'var(--accent-text)'; setTimeout(() => t.style.borderColor = '', 1600); } }));
  }

  /* ----- log ----- */
  const form = { date: todayISO(), area: 'lowback', pain: 3, warm: true, move: 'walk-push', holes: 18, note: '' };
  const MOVES = { 'walk-carry': 'Walked, carried', 'walk-push': 'Walked, push cart', 'cart': 'Rode a cart' };
  function renderLog() {
    const list = entries();
    const withWarm = list.filter(e => e.warm), noWarm = list.filter(e => !e.warm);
    const avg = (arr) => arr.length ? (arr.reduce((s, e) => s + e.pain, 0) / arr.length).toFixed(1) : '–';
    view().innerHTML = `
      <div class="view-head"><div><h1>Round log</h1><p>Thirty seconds after each round. In a month you will know exactly what your back responds to.</p></div></div>
      <div class="log">
        <form class="logform" id="logform">
          <div class="field"><label for="f-date">Date</label><input id="f-date" type="date" value="${form.date}" max="${todayISO()}"></div>
          <div class="field"><label for="f-area">Where</label><select id="f-area">${Object.keys(PLANS).map(a => `<option value="${a}" ${form.area === a ? 'selected' : ''}>${AREAS[a].label}</option>`).join('')}</select></div>
          <div class="field"><b>Pain after the round</b><div class="painscale" id="pain">${Array.from({ length: 11 }, (_, i) => `<button type="button" data-v="${i}" aria-pressed="${form.pain === i}">${i}</button>`).join('')}</div><div class="painscale-labels"><span>None</span><span>Worst</span></div></div>
          <div class="field"><b>Warmed up first?</b><div class="seg" id="warm"><button type="button" data-v="1" aria-pressed="${form.warm}">Yes</button><button type="button" data-v="0" aria-pressed="${!form.warm}">No</button></div></div>
          <div class="field"><b>Got around by</b><div class="seg" id="move">${Object.entries(MOVES).map(([k, v]) => `<button type="button" data-v="${k}" aria-pressed="${form.move === k}">${v.split(', ')[1] || v}</button>`).join('')}</div></div>
          <div class="field"><b>Holes</b><div class="seg" id="holes"><button type="button" data-v="9" aria-pressed="${form.holes === 9}">9</button><button type="button" data-v="18" aria-pressed="${form.holes === 18}">18</button></div></div>
          <div class="field"><label for="f-note">Note</label><textarea id="f-note" placeholder="Stiff on the back nine, new shoes, hit 60 balls before…">${esc(form.note)}</textarea></div>
          <button class="btn btn-primary" type="submit">${icon('check')} Save round</button>
        </form>
        <div>
          <div class="stats">
            <div class="stat"><span class="num">${list.length}</span><span class="small">rounds logged${usingSamples() ? ' (sample)' : ''}</span></div>
            <div class="stat"><span class="num">${avg(withWarm)}<small> vs ${avg(noWarm)}</small></span><span class="small">average pain, warm-up vs none</span></div>
            <div class="stat"><span class="num">${streak()}</span><span class="small">day streak of routines</span></div>
          </div>
          <div class="chart-card">
            <div class="chart-head"><h3>Pain after each round</h3><div class="legend"><span><i style="background:var(--chart-a)"></i>Warmed up</span><span><i style="background:var(--chart-b)"></i>No warm-up</span></div></div>
            <div class="chart" id="chart">${chartSVG(list.slice(-14))}</div>
            <button class="btn btn-ghost btn-sm table-toggle" type="button" id="tbl-toggle">Show as table</button>
            <div id="tbl" hidden><table class="datatable"><thead><tr><th>Date</th><th>Pain</th><th>Warm-up</th><th>Got around</th><th>Holes</th></tr></thead><tbody>${list.slice(-14).map(e => `<tr><td>${fmtDate(e.date)}</td><td>${e.pain}</td><td>${e.warm ? 'Yes' : 'No'}</td><td>${MOVES[e.move]}</td><td>${e.holes}</td></tr>`).join('')}</tbody></table></div>
            ${usingSamples() ? '<p class="sample-note">These are sample rounds so you can see how the log works. Save your first round to replace them.</p>' : ''}
          </div>
          <div class="entries">${list.slice().reverse().map(e => `<div class="entry"><span>${fmtDate(e.date)}<br><span class="small">${AREAS[e.area].short}</span></span><span class="num ${e.pain >= 6 ? 'hi' : e.pain >= 4 ? 'mid' : 'lo'}">${e.pain}</span><span><span class="small">${e.warm ? 'Warmed up' : 'No warm-up'} · ${MOVES[e.move]} · ${e.holes} holes</span>${e.note ? `<br>${esc(e.note)}` : ''}</span>${e.sample ? '<span class="small muted">sample</span>' : `<button class="btn btn-ghost" type="button" data-del="${e.id}">Delete</button>`}</div>`).join('')}</div>
        </div>
      </div>`;
    const seg = (id, key, parse) => $$('#' + id + ' button').forEach(b => b.addEventListener('click', () => { form[key] = parse(b.dataset.v); $$('#' + id + ' button').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
    seg('pain', 'pain', Number); seg('warm', 'warm', v => v === '1'); seg('move', 'move', String); seg('holes', 'holes', Number);
    $('#f-date').addEventListener('change', e => form.date = e.target.value);
    $('#f-area').addEventListener('change', e => form.area = e.target.value);
    $('#f-note').addEventListener('input', e => form.note = e.target.value);
    $('#logform').addEventListener('submit', (e) => {
      e.preventDefault();
      store.log.push({ id: 'r' + Date.now(), date: form.date, area: form.area, pain: form.pain, warm: form.warm, move: form.move, holes: form.holes, note: form.note.trim() });
      save(); form.note = ''; toast('Round saved'); renderLog(); updateRail();
    });
    $$('[data-del]').forEach(b => b.addEventListener('click', () => { store.log = store.log.filter(e => e.id !== b.dataset.del); save(); renderLog(); }));
    $('#tbl-toggle').addEventListener('click', (e) => { const t = $('#tbl'); t.hidden = !t.hidden; e.currentTarget.textContent = t.hidden ? 'Show as table' : 'Hide table'; });
    wireChart(list.slice(-14));
  }

  function chartSVG(list) {
    const W = 640, H = 220, padL = 28, padB = 26, padT = 14;
    const iw = W - padL - 8, ih = H - padB - padT;
    const n = Math.max(list.length, 1); const slot = iw / n; const bw = Math.min(34, slot - 4);
    const y = (v) => padT + ih - (v / 10) * ih;
    const grid = [0, 5, 10].map(v => `<line class="grid" x1="${padL}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${padL - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
    const maxPain = Math.max(...list.map(e => e.pain));
    const bars = list.map((e, i) => {
      const x = padL + i * slot + (slot - bw) / 2; const top = y(e.pain); const h = Math.max(y(0) - top, 0);
      const r = Math.min(4, h);
      const path = h > 0 ? `M${x} ${y(0)} V${top + r} q0 -${r} ${r} -${r} h${bw - 2 * r} q${r} 0 ${r} ${r} V${y(0)} Z` : `M${x} ${y(0) - 2} h${bw} v2 h-${bw} Z`;
      const label = (e.pain === maxPain || i === list.length - 1) ? `<text class="lbl" x="${x + bw / 2}" y="${top - 5}" text-anchor="middle">${e.pain}</text>` : '';
      return `<g class="bar" data-i="${i}"><rect x="${x - 2}" y="${padT}" width="${bw + 4}" height="${ih}" fill="transparent"/><path d="${path}" fill="${e.warm ? 'var(--chart-a)' : 'var(--chart-b)'}"/>${label}<text class="axis" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${fmtDate(e.date)}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pain after each round, 0 to 10">${grid}${bars}</svg>`;
  }
  function wireChart(list) {
    const chart = $('#chart'); if (!chart) return;
    let tip = null;
    $$('.bar', chart).forEach(g => {
      g.addEventListener('pointerenter', (ev) => {
        const e = list[Number(g.dataset.i)];
        tip = tip || document.createElement('div'); tip.className = 'tip';
        tip.innerHTML = `<b>${fmtDate(e.date)}</b> · pain ${e.pain} of 10<br><span class="muted">${e.warm ? 'Warmed up' : 'No warm-up'} · ${MOVES[e.move]} · ${e.holes} holes</span>${e.note ? `<br>${esc(e.note)}` : ''}`;
        chart.appendChild(tip);
        const r = g.getBoundingClientRect(), c = chart.getBoundingClientRect();
        tip.style.left = (r.left - c.left + r.width / 2) + 'px'; tip.style.top = (r.top - c.top + 8) + 'px';
      });
      g.addEventListener('pointerleave', () => { if (tip) tip.remove(); });
    });
  }

  /* ---------- rail ---------- */
  function updateRail() {
    const n = streak(); const el = $('#streak-num'); if (el) el.textContent = n;
    const t = $('#streak-txt'); if (t) t.textContent = n === 1 ? 'day streak' : 'day streak';
    updateLabToday();
  }

  /* ---------- boot ---------- */
  function boot() {
    load(); applyTheme();
    document.body.insertAdjacentHTML('afterbegin', figureDefs());
    $('#theme-btn').addEventListener('click', cycleTheme);
    $$('.quick a[data-routine]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); startRoutine(a.dataset.routine); }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('#modal')) closeModal(); else if (player) closePlayer(); } });
    window.addEventListener('hashchange', render);
    updateRail();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

/* Free Relief — growth module. Registers its views through window.FR (see js/app.js plugin API).
   Home (launch screen), onboarding, achievements, share cards and the evidence page.
   Everything is content: no build step, no dependencies, no network. */

(() => {
  const FR = window.FR;
  if (!FR || !FR.registerView) return;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => FR.esc(s);
  const QS = new URLSearchParams(location.search);
  const DAY = 86400000;

  /* ---------- dates ----------
     Every stored date is a local ISO day string. Anchoring at noon keeps the arithmetic
     honest across daylight saving, where midnight days can be 23 or 25 hours long. */
  const parseISO = (iso) => new Date(String(iso) + 'T12:00:00');
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY);
  const daysSince = (iso) => { try { return daysBetween(iso, FR.todayISO()); } catch (e) { return 9999; } };
  const fmtDay = (iso) => { try { return parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (e) { return iso; } };
  const fmtLong = (iso) => { try { return parseISO(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return iso; } };
  const agoWords = (iso) => { const d = daysSince(iso); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? d + ' days ago' : d < 14 ? 'last week' : d < 60 ? Math.round(d / 7) + ' weeks ago' : Math.round(d / 30) + ' months ago'; };

  const ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/></svg>',
    evidence: '<svg viewBox="0 0 24 24"><path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5"/><path d="M9 13h6M9 16h4"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8.5 7.5L12 4l3.5 3.5"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    body: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><path d="M12 7v6l-4 6M12 13l4 6M8 10l4-2 4 2"/></svg>',
    flag: '<svg viewBox="0 0 24 24"><path d="M7 3v18"/><path d="M7 4h11l-3 4 3 4H7z"/></svg>'
  };

  /* ---------- store helpers ---------- */
  const store = () => FR.store();
  const profile = () => FR.profile();
  const usingSamples = () => !(store().log && store().log.length);
  const log = () => (store().log || []);
  const done = () => (store().done || []);
  const growth = () => (store().growth = store().growth || {});

  function lastRound() {
    const rows = FR.entries();
    return rows.length ? rows[rows.length - 1] : null;
  }
  function doneToday() { const t = FR.todayISO(); return done().filter(d => d.date === t); }
  function didToday(id) { return doneToday().some(d => d.routine === id); }

  function roundDay() {
    const rd = store().roundDay;
    return (rd && rd.date === FR.todayISO() && rd.on) ? rd : null;
  }
  function setRoundDay(on) {
    store().roundDay = { date: FR.todayISO(), on: !!on };
    FR.save();
  }

  function program() {
    const p = store().programs;
    return (p && p.active) ? p : null;
  }
  /* store.programs is written by another module; read it defensively. */
  function programCount(p) {
    const c = p && p.completed;
    if (Array.isArray(c)) return c.length;
    if (typeof c === 'number') return c;
    if (c && typeof c === 'object') return Object.keys(c).length;
    return 0;
  }
  function programWeek(p) {
    if (p.week) return p.week;
    if (p.startDate) return Math.max(1, Math.floor(daysSince(p.startDate) / 7) + 1);
    return Math.max(1, Math.floor(programCount(p) / 5) + 1);
  }
  function programName(p) {
    if (p.title) return String(p.title);
    const id = String(p.active);
    return id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' ');
  }

  function mobility() {
    const m = profile().mobility;
    return (m && typeof m.score === 'number') ? m : null;
  }

  /* ---------- debug hooks (query string, memory only) ----------
     ?seed=1 fills the store with a plausible month so the "with data" states can be seen,
     ?onboard=1 forces the onboarding modal, ?ach=1 unlocks every badge, ?card=streak
     renders a share card inline for screenshots. None of them call FR.save(). */
  function seedDemo() {
    const st = store();
    const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return FR.localISO(d); };
    st.log = [
      { id: 'd1', date: iso(26), area: 'lowback', pain: 6, warm: false, move: 'walk-carry', holes: 18, note: 'Cold start, stiff by the 14th' },
      { id: 'd2', date: iso(19), area: 'lowback', pain: 5, warm: true, move: 'walk-push', holes: 18, note: '' },
      { id: 'd3', date: iso(12), area: 'lowback', pain: 4, warm: true, move: 'cart', holes: 18, note: '' },
      { id: 'd4', date: iso(5), area: 'lowback', pain: 3, warm: true, move: 'walk-push', holes: 9, note: 'Did the cool-down' },
      { id: 'd5', date: iso(2), area: 'lowback', pain: 2, warm: true, move: 'walk-push', holes: 18, note: 'Best it has felt in months' }
    ];
    st.done = [];
    [0, 1, 2, 3, 4, 6, 7, 8, 10, 11, 13, 14, 16, 18, 19, 21, 24, 26, 28].forEach((n, i) => {
      const id = ['daily', 'tspine', 'warmup', 'strength', 'cooldown'][i % 5];
      st.done.push({ date: iso(n), routine: id, title: (FR.data().ROUTINE[id] || {}).name || id, secs: 400 });
    });
    const p = profile();
    p.onboarded = true; p.handed = 'right'; p.ageBand = '40to59'; p.complaint = 'lowback'; p.roundsPerMonth = 6;
    p.mobility = { score: 64, date: iso(9), hipIR: 0.62, thoracic: 0.55 };
    st.programs = { active: 'lowback-8', startDate: iso(16), completed: ['w1d1', 'w1d2', 'w1d3', 'w1d4', 'w1d5', 'w2d1', 'w2d2', 'w2d3'] };
    growth().scores = [{ score: 51, date: iso(38) }, { score: 64, date: iso(9) }];
  }

  /* ================================================================
     Achievements
     ================================================================ */
  const BADGES = [
    { id: 'first-routine', name: 'Day one', blurb: 'Finished your first routine.', mark: 'flag',
      test: (s) => done().length >= 1 },
    { id: 'streak3', name: 'Three in a row', blurb: 'Three days of routines back to back.', mark: 'fire',
      test: (s) => s.streak >= 3 },
    { id: 'streak7', name: 'A full week', blurb: 'Seven days in a row.', mark: 'fire',
      test: (s) => s.streak >= 7 },
    { id: 'streak30', name: 'Thirty days', blurb: 'A month without missing a day.', mark: 'crown',
      test: (s) => s.streak >= 30 },
    { id: 'routines10', name: 'Ten routines', blurb: 'Ten routines finished.', mark: 'ten',
      test: (s) => done().length >= 10 },
    { id: 'routines50', name: 'Fifty routines', blurb: 'Fifty routines finished. That is a habit.', mark: 'crown',
      test: (s) => done().length >= 50 },
    { id: 'first-round', name: 'First card in', blurb: 'Logged your first round.', mark: 'ball',
      test: (s) => log().length >= 1 },
    { id: 'warm5', name: 'Warm five', blurb: 'Warmed up before five rounds.', mark: 'sun',
      test: (s) => log().filter(r => r.warm).length >= 5 },
    { id: 'warm-month', name: 'Never cold', blurb: 'Warmed up before every round for a month.', mark: 'sun',
      test: (s) => { const m = log().filter(r => daysSince(r.date) <= 30); return m.length >= 4 && m.every(r => r.warm); } },
    { id: 'screen-done', name: 'Measured', blurb: 'Finished the five-minute mobility screen.', mark: 'gauge',
      test: (s) => !!mobility() },
    { id: 'screen-improved', name: 'Moving better', blurb: 'Scored higher on a re-screen than before.', mark: 'up',
      test: (s) => { const sc = (growth().scores || []).map(x => x.score); return sc.length >= 2 && sc[sc.length - 1] > Math.min.apply(null, sc.slice(0, -1)); } },
    { id: 'program-week', name: 'Week one down', blurb: 'Completed a full week of your program.', mark: 'cal',
      test: (s) => { const p = store().programs; return !!p && programCount(p) >= 5; } },
    { id: 'program-done', name: 'Programme finished', blurb: 'Saw a whole program through to the end.', mark: 'crown',
      test: (s) => { const p = store().programs; if (!p) return false; return p.finished === true || !!p.completedAt || programCount(p) >= 40; } }
  ];

  const MARK = {
    flag: '<svg viewBox="0 0 24 24"><path d="M7 3v18"/><path d="M7 4h11l-3 4 3 4H7z"/></svg>',
    fire: '<svg viewBox="0 0 24 24"><path d="M13 2.5c.4 3-1.1 4.3-2.7 5.9C8.4 10.1 7 11.9 7 14.2A5.4 5.4 0 0 0 12.4 19.6 5.4 5.4 0 0 0 17.8 14.2c0-3.6-2.6-5.9-4.8-11.7z"/><path d="M12.4 19.6c-1.5 0-2.7-1.2-2.7-2.7 0-1.5 1.3-2.2 2.7-4 1.4 1.8 2.7 2.5 2.7 4 0 1.5-1.2 2.7-2.7 2.7z"/></svg>',
    crown: '<svg viewBox="0 0 24 24"><path d="M4 8l3.5 4L12 5l4.5 7L20 8l-1.5 10h-13z"/></svg>',
    ten: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16.5l8 4 8-4"/></svg>',
    ball: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/><g fill="currentColor" stroke="none"><circle cx="9.4" cy="9.6" r=".85"/><circle cx="12.6" cy="8.6" r=".85"/><circle cx="14.8" cy="11.6" r=".85"/><circle cx="10.6" cy="12.8" r=".85"/><circle cx="13.4" cy="15.2" r=".85"/></g></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>',
    gauge: '<svg viewBox="0 0 24 24"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4.5-5"/><circle cx="12" cy="17" r="1.4"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M4 17l5-5 3.5 3L20 7"/><path d="M20 12V7h-5"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M8.5 14.5l2 2 4-4"/></svg>'
  };
  const markSVG = (m) => MARK[m] || MARK.flag;
  const BADGE = Object.fromEntries(BADGES.map(b => [b.id, b]));

  function unlocked() { return (store().achievements = store().achievements || {}); }

  function checkAchievements(opts) {
    const s = { streak: FR.streak() };
    const have = unlocked();
    const fresh = [];
    BADGES.forEach(b => {
      if (have[b.id]) return;
      let ok = false;
      try { ok = !!b.test(s); } catch (e) { ok = false; }
      if (ok) { have[b.id] = FR.todayISO(); fresh.push(b); }
    });
    if (!fresh.length) return fresh;
    FR.save();
    if (!(opts && opts.quiet)) {
      const first = fresh[0];
      FR.toast(fresh.length > 1
        ? `${fresh.length} badges unlocked: ${first.name} and ${fresh.length - 1} more`
        : `Badge unlocked: ${first.name}`);
    }
    return fresh;
  }

  function recordScore(score) {
    if (typeof score !== 'number' || !isFinite(score)) return;
    const g = growth();
    g.scores = g.scores || [];
    const today = FR.todayISO();
    const last = g.scores[g.scores.length - 1];
    if (last && last.date === today) last.score = score; else g.scores.push({ score, date: today });
    if (g.scores.length > 24) g.scores = g.scores.slice(-24);
    FR.save();
  }

  function badgeHTML(b, isOn, date) {
    return `<div class="ach-badge${isOn ? ' is-on' : ''}">
      <span class="ach-mark" aria-hidden="true">${markSVG(b.mark)}</span>
      <b>${esc(b.name)}</b>
      <span class="small">${esc(b.blurb)}</span>
      <span class="ach-when small">${isOn ? 'Unlocked ' + esc(fmtDay(date)) : 'Locked'}</span>
    </div>`;
  }

  function achSectionHTML() {
    const have = unlocked();
    const n = BADGES.filter(b => have[b.id]).length;
    return `<section class="plan-section ach-section" id="achievements">
      <div class="ach-head">
        <div>
          <h3>Achievements</h3>
          <p class="small muted">${n} of ${BADGES.length} unlocked. They are all earned from what you actually do, nothing is bought or unlocked by time alone.</p>
        </div>
        <div class="ach-actions">
          <button class="btn btn-sm" type="button" data-share="streak">${ICON.share} Share the streak</button>
          ${mobility() ? `<button class="btn btn-sm" type="button" data-share="mobility">${ICON.share} Share the score</button>` : ''}
        </div>
      </div>
      <div class="ach-grid">${BADGES.map(b => badgeHTML(b, !!have[b.id], have[b.id])).join('')}</div>
    </section>`;
  }

  function achStripHTML() {
    const have = unlocked();
    const on = BADGES.filter(b => have[b.id]);
    const show = on.length ? on.slice(-6) : BADGES.slice(0, 4);
    return `<div class="ach-strip">
      <div class="ach-strip-head">
        <b>${on.length ? 'Badges' : 'Badges to come'}</b>
        <a class="small" href="#home" data-jump="achievements">${on.length} of ${BADGES.length} ${ICON.arrow}</a>
      </div>
      <div class="ach-strip-row">
        ${show.map(b => `<span class="ach-chip${have[b.id] ? ' is-on' : ''}" title="${esc(b.name)}${have[b.id] ? '' : ' — locked'}"><span aria-hidden="true">${markSVG(b.mark)}</span><span class="sr">${esc(b.name)}</span></span>`).join('')}
      </div>
      <p class="small muted">${on.length ? esc(on[on.length - 1].name) + ' — ' + esc(on[on.length - 1].blurb) : 'Finish one routine and the first one is yours.'}</p>
    </div>`;
  }

  /* ================================================================
     Share cards — 1080x1350 canvas, drawn from scratch, no assets
     ================================================================ */
  const BRAND = { ground: '#0e261b', raised: '#143323', gold: '#f6c544', ink: '#eef3ea', ink2: '#a9bfb0' };

  function roundRect(x, a, b, w, h, r) {
    x.beginPath();
    x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r);
    x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r);
    x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath();
  }

  function drawMark(x, cx, cy, size) {
    /* the app icon: a ball seam drawn as two arcs with a dot in the middle */
    const s = size / 32;
    x.save();
    x.translate(cx - size / 2, cy - size / 2); x.scale(s, s);
    x.lineWidth = 2.4; x.strokeStyle = BRAND.gold; x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(16, 5);
    x.bezierCurveTo(13, 8, 11, 12, 11, 16); x.bezierCurveTo(11, 20, 13, 24, 16, 27);
    x.bezierCurveTo(19, 24, 21, 20, 21, 16); x.bezierCurveTo(21, 12, 19, 8, 16, 5);
    x.closePath(); x.stroke();
    x.beginPath(); x.arc(16, 16, 2.2, 0, Math.PI * 2); x.fillStyle = BRAND.gold; x.fill();
    x.restore();
  }

  const DISPLAY = '"Archivo", "Helvetica Neue", Arial, sans-serif';
  const BODY = '"Atkinson Hyperlegible", "Helvetica Neue", Arial, sans-serif';

  function fitText(x, text, max, start, font) {
    let size = start;
    for (; size > 18; size -= 4) { x.font = font(size); if (x.measureText(text).width <= max) break; }
    return size;
  }

  function drawCard(spec) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    if (!x) return null;

    x.fillStyle = BRAND.ground; x.fillRect(0, 0, W, H);
    /* a soft pool of light behind the number, so the flat green does not read as a screenshot */
    const g = x.createRadialGradient(W / 2, 620, 60, W / 2, 620, 720);
    g.addColorStop(0, 'rgba(27, 65, 48, 0.95)'); g.addColorStop(1, 'rgba(14, 38, 27, 0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    /* fairway arcs, bottom right */
    x.save(); x.globalAlpha = 0.10; x.strokeStyle = BRAND.ink; x.lineWidth = 2;
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(W - 60, H + 120, 260 + i * 90, Math.PI, Math.PI * 1.5); x.stroke(); }
    x.restore();

    /* wordmark */
    drawMark(x, 96, 104, 56);
    x.fillStyle = BRAND.ink; x.textBaseline = 'middle'; x.textAlign = 'left';
    x.font = '800 34px ' + DISPLAY;
    x.letterSpacing && (x.letterSpacing = '2px');
    x.fillText('FREE RELIEF', 140, 106);
    x.letterSpacing && (x.letterSpacing = '0px');

    /* eyebrow */
    x.fillStyle = BRAND.gold; x.font = '700 30px ' + BODY;
    x.fillText(String(spec.eyebrow || '').toUpperCase(), 96, 300);

    /* big number */
    x.textAlign = 'center';
    const big = String(spec.big);
    const size = fitText(x, big, W - 180, big.length > 4 ? 300 : 420, (s) => '800 ' + s + 'px ' + DISPLAY);
    x.font = '800 ' + size + 'px ' + DISPLAY;
    x.fillStyle = BRAND.gold;
    x.fillText(big, W / 2, 620);

    /* label under the number */
    x.fillStyle = BRAND.ink; x.font = '800 62px ' + DISPLAY;
    const lsize = fitText(x, spec.label, W - 180, 62, (s) => '800 ' + s + 'px ' + DISPLAY);
    x.font = '800 ' + lsize + 'px ' + DISPLAY;
    x.fillText(spec.label, W / 2, 860);

    /* rule */
    x.strokeStyle = 'rgba(238,243,234,0.18)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(96, 960); x.lineTo(W - 96, 960); x.stroke();

    /* caption, wrapped */
    x.textAlign = 'left'; x.fillStyle = BRAND.ink2; x.font = '400 34px ' + BODY;
    const words = String(spec.caption || '').split(' ');
    let line = '', y = 1020;
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (x.measureText(t).width > W - 192 && line) { x.fillText(line, 96, y); y += 48; line = w; }
      else line = t;
    });
    if (line) x.fillText(line, 96, y);

    /* footer pill */
    x.fillStyle = 'rgba(246,197,68,0.14)';
    roundRect(x, 96, H - 190, 480, 84, 42); x.fill();
    x.fillStyle = BRAND.gold; x.font = '700 30px ' + BODY;
    x.fillText(spec.foot || 'Golf back care, free', 132, H - 148);
    return c;
  }

  function cardSpec(kind, extra) {
    const p = profile();
    if (kind === 'streak') {
      const n = FR.streak();
      return {
        eyebrow: 'Streak', big: String(n), label: n === 1 ? 'day in a row' : 'days in a row',
        caption: n >= 2 ? `${n} days of back care in a row. Ten minutes a day so the golf keeps happening.` : 'Day one of looking after my back so I can keep playing.',
        foot: 'Free Relief · golf back care', file: 'free-relief-streak.png'
      };
    }
    if (kind === 'round') {
      const r = (extra && extra.round) || lastRound();
      if (!r) return null;
      const AREAS = FR.data().AREAS;
      return {
        eyebrow: fmtDay(r.date), big: r.pain + '/10', label: 'back pain after the round',
        caption: `${r.warm ? 'Warmed up' : 'No warm-up'} · ${r.holes} holes · ${(AREAS[r.area] || {}).short || 'Back'}${r.sample ? ' · sample round' : ''}. Logged in Free Relief.`,
        foot: 'Free Relief · round log', file: 'free-relief-round.png'
      };
    }
    if (kind === 'mobility') {
      const m = mobility(); if (!m) return null;
      return {
        eyebrow: 'Mobility screen', big: String(Math.round(m.score)), label: 'out of 100',
        caption: `Five-minute golf mobility screen, ${fmtDay(m.date || FR.todayISO())}. Hips and mid back measured, then the plan built around them.`,
        foot: 'Free Relief · 5-minute screen', file: 'free-relief-mobility.png'
      };
    }
    if (kind === 'badge') {
      const b = BADGE[extra && extra.id]; if (!b) return null;
      return {
        eyebrow: 'Badge unlocked', big: b.name, label: 'Free Relief', caption: b.blurb,
        foot: 'Free Relief · golf back care', file: 'free-relief-badge.png'
      };
    }
    return null;
  }

  function canvasBlob(c) {
    return new Promise((res) => {
      try { c.toBlob(res, 'image/png'); } catch (e) { res(null); }
    });
  }

  async function shareCard(kind, extra) {
    const spec = cardSpec(kind, extra);
    if (!spec) { FR.toast('Nothing to share yet'); return; }
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* fonts optional */ }
    let blob = null, c = null;
    try { c = drawCard(spec); blob = c ? await canvasBlob(c) : null; } catch (e) { blob = null; }
    if (!blob) { FR.toast('Could not build the image on this device'); return; }
    /* phones: hand the PNG to the share sheet */
    try {
      if (window.File && navigator.canShare && navigator.share) {
        const file = new File([blob], spec.file, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Free Relief', text: spec.caption });
          return;
        }
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;   /* the user closed the sheet */
    }
    /* everywhere else: download it */
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = spec.file; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { } }, 8000);
      FR.toast('Image saved to your downloads');
    } catch (e) {
      FR.toast('Sharing is not available here');
    }
  }

  function wireShare(root) {
    $$('[data-share]', root).forEach(b => b.addEventListener('click', () => {
      shareCard(b.dataset.share, b.dataset.shareId ? { id: b.dataset.shareId } : null);
    }));
  }

  /* ================================================================
     Onboarding — four questions, then the screen offer
     ================================================================ */
  const HANDED = [
    { v: 'right', label: 'Right-handed', sub: 'Trail hip and shoulder on the right' },
    { v: 'left', label: 'Left-handed', sub: 'Trail hip and shoulder on the left' }
  ];
  const AGEBANDS = [
    { v: 'under40', label: 'Under 40', sub: 'Mobility is usually there. Strength and speed are the lever.' },
    { v: '40to59', label: '40 to 59', sub: 'Desk life and mileage. Mid back and hips first.' },
    { v: '60plus', label: '60 or over', sub: 'Keep the turn and the balance. Gently, most days.' }
  ];
  const COMPLAINTS = ['lowback', 'upback', 'neck', 'shoulder', 'hip', 'elbow', 'wrist', 'knee'];
  const ROUNDS = [
    { v: 1, label: 'Once a month or less' },
    { v: 3, label: 'Two or three a month' },
    { v: 6, label: 'About one a week' },
    { v: 12, label: 'Two or more a week' }
  ];

  let onbState = null;

  function optionHTML(name, v, label, sub, on) {
    return `<button class="onb-opt${on ? ' is-on' : ''}" type="button" role="radio" aria-checked="${on}" data-field="${name}" data-value="${esc(String(v))}">
      <span class="onb-opt-tick" aria-hidden="true">${ICON.check}</span>
      <span><b>${esc(label)}</b>${sub ? `<span class="small">${esc(sub)}</span>` : ''}</span>
    </button>`;
  }

  function onbStepHTML(i) {
    const p = onbState.draft;
    const AREAS = FR.data().AREAS;
    if (i === 0) return `
      <p class="onb-eyebrow small">Question 1 of 4</p>
      <h2>Which way do you swing?</h2>
      <p class="muted">It decides which hip turns away from the ball, and which side of your back takes the load.</p>
      <div class="onb-opts" role="radiogroup" aria-label="Handedness">${HANDED.map(o => optionHTML('handed', o.v, o.label, o.sub, p.handed === o.v)).join('')}</div>`;
    if (i === 1) return `
      <p class="onb-eyebrow small">Question 2 of 4</p>
      <h2>Roughly how old are you?</h2>
      <p class="muted">Only to set the starting dose. Nothing here is off limits at any age.</p>
      <div class="onb-opts" role="radiogroup" aria-label="Age band">${AGEBANDS.map(o => optionHTML('ageBand', o.v, o.label, o.sub, p.ageBand === o.v)).join('')}</div>`;
    if (i === 2) return `
      <p class="onb-eyebrow small">Question 3 of 4</p>
      <h2>What bothers you most right now?</h2>
      <p class="muted">Pick the one that would stop you enjoying a round. You can change it any time.</p>
      <div class="chips onb-chips" role="radiogroup" aria-label="Main complaint">
        ${COMPLAINTS.map(a => `<button class="chip" type="button" role="radio" aria-checked="${p.complaint === a}" aria-pressed="${p.complaint === a}" data-field="complaint" data-value="${a}" data-noadvance="1">${esc(AREAS[a].label)}</button>`).join('')}
        <button class="chip" type="button" role="radio" aria-checked="${p.complaint === null}" aria-pressed="${p.complaint === null}" data-field="complaint" data-value="" data-noadvance="1">Nothing right now</button>
      </div>
      <p class="small muted onb-note">Nothing hurting is the best answer there is. Free Relief will point you at prevention instead.</p>`;
    if (i === 3) return `
      <p class="onb-eyebrow small">Question 4 of 4</p>
      <h2>How often do you play?</h2>
      <p class="muted">Rounds per month, near enough. It sets how much warm-up and recovery you get nudged about.</p>
      <div class="onb-opts" role="radiogroup" aria-label="Rounds per month">${ROUNDS.map(o => optionHTML('roundsPerMonth', o.v, o.label, '', p.roundsPerMonth === o.v)).join('')}</div>`;
    return `
      <p class="onb-eyebrow small">Last thing</p>
      <h2>Five-minute mobility screen</h2>
      <p class="muted">Eight quick tests you can do on a carpet: hip rotation, mid-back turn, hamstrings, shoulders. It personalises your 3D avatar and builds the plan around your actual stiff spots instead of the average golfer's.</p>
      <ul class="onb-list">
        <li>${ICON.check}<span>A score out of 100 you can re-test in a month</span></li>
        <li>${ICON.check}<span>Your avatar in the swing lab moves the way you move</span></li>
        <li>${ICON.check}<span>Everything stays on this device</span></li>
      </ul>`;
  }

  function renderOnb() {
    const m = $('#onb-modal'); if (!m) return;
    const i = onbState.step, last = i === 4;
    const p = onbState.draft;
    const answered = [p.handed !== undefined, p.ageBand !== undefined, p.complaint !== undefined, p.roundsPerMonth !== undefined][i];
    $('.onb-body', m).innerHTML = onbStepHTML(i);
    $('.onb-dots', m).innerHTML = [0, 1, 2, 3, 4].map(n => `<i class="${n === i ? 'is-on' : n < i ? 'is-done' : ''}"></i>`).join('');
    $('.onb-foot', m).innerHTML = last
      ? `<button class="btn btn-ghost" type="button" data-onb="later">Later</button>
         <button class="btn btn-primary btn-lg" type="button" data-onb="screen">${ICON.play} Start the screen</button>`
      : `<button class="btn btn-ghost" type="button" data-onb="back" ${i === 0 ? 'disabled' : ''}>${ICON.back} Back</button>
         <button class="btn btn-primary" type="button" data-onb="next" ${answered ? '' : 'disabled'}>Next ${ICON.arrow}</button>`;

    $$('[data-field]', m).forEach(b => b.addEventListener('click', () => {
      const f = b.dataset.field;
      let v = b.dataset.value;
      if (f === 'roundsPerMonth') v = Number(v);
      if (f === 'complaint') v = v || null;
      onbState.draft[f] = v;
      if (b.dataset.noadvance) renderOnb();
      else { renderOnb(); setTimeout(() => { if ($('#onb-modal') && onbState.step === i) { onbState.step = i + 1; renderOnb(); } }, 170); }
    }));
    $$('.onb-foot [data-onb]', m).forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.onb;
      if (a === 'back') { onbState.step = Math.max(0, i - 1); renderOnb(); return; }
      if (a === 'next') { onbState.step = Math.min(4, i + 1); if (onbState.step === 4) commitOnb(); renderOnb(); return; }
      if (a === 'later') { commitOnb(); closeOnb(); FR.toast('Saved. The screen is on your Home screen whenever you want it.'); return; }
      if (a === 'screen') { commitOnb(); closeOnb(); FR.navigate('#screen'); return; }
    }));
    const first = $('.onb-body [data-field], .onb-foot .btn-primary', m);
    if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
  }

  function commitOnb() {
    if (!onbState || onbState.saved) return;
    const p = profile(), d = onbState.draft;
    if (d.handed !== undefined) p.handed = d.handed;
    if (d.ageBand !== undefined) p.ageBand = d.ageBand;
    if (d.complaint !== undefined) p.complaint = d.complaint;
    if (d.roundsPerMonth !== undefined) p.roundsPerMonth = d.roundsPerMonth;
    p.onboarded = true;
    onbState.saved = true;
    FR.save();
    FR.emit('profile:changed', p);
    if (FR.route() === 'home') setTimeout(() => { if (FR.route() === 'home') FR.render(); }, 0);
  }

  function closeOnb() {
    const m = $('#onb-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', onbKeys, true);
    onbState = null;
  }

  function onbKeys(e) {
    if (!$('#onb-modal')) return;
    if (e.key === 'Escape') { e.stopPropagation(); commitOnb(); closeOnb(); return; }
    if (e.key === 'Tab') {
      const f = $$('#onb-modal button:not([disabled])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function openOnboarding(opts) {
    closeOnb();
    const p = profile();
    const edit = !!(opts && opts.edit);
    onbState = {
      step: 0, saved: false, edit,
      draft: {
        handed: p.handed, ageBand: p.ageBand,
        complaint: p.complaint === undefined ? undefined : p.complaint,
        roundsPerMonth: p.roundsPerMonth
      }
    };
    const m = document.createElement('div');
    m.className = 'modal onb'; m.id = 'onb-modal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', edit ? 'Edit your profile' : 'Welcome to Free Relief');
    m.innerHTML = `<div class="modal-card onb-card">
      <div class="onb-top">
        <div class="onb-brand">
          <svg class="onb-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5c-3 3-5 7-5 11s2 8 5 11c3-3 5-7 5-11s-2-8-5-11z" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="16" cy="16" r="2.2" fill="currentColor"/></svg>
          <span>${edit ? 'Your profile' : 'Free Relief'}</span>
        </div>
        <div class="onb-dots" aria-hidden="true"></div>
        <button class="btn btn-ghost btn-sm" type="button" data-onb="later" aria-label="Close">${ICON.x}</button>
      </div>
      <div class="onb-body"></div>
      <div class="onb-foot"></div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) { commitOnb(); closeOnb(); } });
    $('.onb-top [data-onb]', m).addEventListener('click', () => { commitOnb(); closeOnb(); });
    document.addEventListener('keydown', onbKeys, true);
    renderOnb();
  }

  /* ================================================================
     Home — the daily launch screen
     ================================================================ */
  const COMPLAINT_ROUTINE = {
    lowback: 'daily', upback: 'tspine', neck: 'tspine', shoulder: 'tspine',
    hip: 'daily', elbow: 'elbow', wrist: 'elbow', knee: 'strength'
  };

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Still up.';
    if (h < 12) return 'Good morning.';
    if (h < 18) return 'Good afternoon.';
    return 'Good evening.';
  }

  /* The one right action for today. Order matters: a round beats a program,
     a program beats a guess, and a painful round beats the calendar. */
  function todayPlan() {
    const D = FR.data(), R = D.ROUTINE, p = profile();
    const rd = roundDay(), prog = program();
    const real = log().slice().sort((a, b) => a.date < b.date ? -1 : 1);
    const last = real.length ? real[real.length - 1] : null;
    const day = new Date().getDay();
    const weekday = day >= 1 && day <= 5;
    const mk = (id, eyebrow, why) => ({
      kind: 'routine', id, eyebrow, why,
      title: R[id].name, minutes: R[id].minutes, tagline: R[id].tagline,
      cta: 'Start · ' + R[id].minutes + ' min'
    });

    if (rd && !didToday('warmup')) return mk('warmup', 'Before you tee off',
      'Round today. Seven minutes in the car park does more for your back than anything else you will do today.');
    if (rd && !didToday('cooldown')) return mk('cooldown', 'After the round',
      'Warm-up done. Six minutes at the cart before the drive home is what makes tomorrow morning bearable.');
    if (prog) {
      const n = programCount(prog);
      return {
        kind: 'link', eyebrow: 'Your program', hash: '#programs',
        title: programName(prog) + ' · week ' + programWeek(prog),
        why: 'Session ' + (n + 1) + ' is queued up. A program beats willpower, because the plan already knows what today is.',
        cta: 'Open the program'
      };
    }
    if (last && last.pain >= 5 && daysSince(last.date) <= 3 && !didToday('daily')) return mk('daily', 'Because of your last round',
      'That round finished at ' + last.pain + ' out of 10. The answer to a sore back is ten minutes of movement, not the sofa.');
    const c = p.complaint && COMPLAINT_ROUTINE[p.complaint];
    if (c && !didToday(c)) {
      const short = (D.AREAS[p.complaint] || {}).short || 'back';
      return mk(c, 'For your ' + short.toLowerCase(), R[c].tagline + ' Chosen because you told us the ' + short.toLowerCase() + ' is what bothers you.');
    }
    if (weekday && !didToday('tspine')) return mk('tspine', 'Desk day',
      'Eight hours in a chair takes half your mid-back turn away. Six minutes gets it back before it costs you on Saturday.');
    if (!weekday && !didToday('strength')) return mk('strength', 'Weekend',
      'No desk today. Glutes, legs and trunk twice a week is the difference between a back that copes and one that does not.');
    if (!didToday('daily')) return mk('daily', 'Keep it going', R.daily.tagline + ' Ten minutes is the whole ask.');
    return {
      kind: 'rest', eyebrow: 'Today', title: 'Done for today.',
      why: 'You have already put the work in. Rest is part of the plan — come back tomorrow, or do the ninety-second reset if you are stiff tonight.',
      cta: 'Between-holes reset · 2 min', id: 'turn'
    };
  }

  function todayHTML(plan) {
    const prog = program();
    const secondary = (plan.kind !== 'link' && prog)
      ? `<a class="home-today-alt small" href="#programs">Your ${esc(programName(prog))} program is also waiting ${ICON.arrow}</a>` : '';
    const alt = plan.kind === 'rest'
      ? `<a class="btn" href="#routines">All routines</a>`
      : `<a class="btn" href="#routines">Something else</a>`;
    const main = plan.hash
      ? `<a class="btn btn-primary btn-lg" href="${plan.hash}">${ICON.arrow} ${esc(plan.cta)}</a>`
      : `<button class="btn btn-primary btn-lg" type="button" data-routine="${esc(plan.id)}">${ICON.play} ${esc(plan.cta)}</button>`;
    return `<article class="home-today${plan.kind === 'rest' ? ' is-rest' : ''}">
      <div class="home-today-head">
        <span class="tag home-today-tag">${esc(plan.eyebrow)}</span>
        <span class="small muted">${esc(fmtLong(FR.todayISO()))}</span>
      </div>
      <h2>${esc(plan.title)}</h2>
      <p class="home-why">${esc(plan.why)}</p>
      <div class="home-today-actions">${main}${alt}</div>
      ${secondary}
    </article>`;
  }

  function roundSwitchHTML() {
    const on = !!roundDay();
    const warm = didToday('warmup'), cool = didToday('cooldown');
    const loggedToday = log().some(r => r.date === FR.todayISO());
    const step = (state, label, sub, action) => `<li class="home-step is-${state}">
      <span class="home-step-dot" aria-hidden="true">${state === 'done' ? ICON.check : ''}</span>
      <span class="home-step-txt"><b>${esc(label)}</b><span class="small muted">${esc(sub)}</span></span>
      ${state === 'done' ? '<span class="tag home-done-tag">Done</span>' : action}
    </li>`;
    return `<div class="home-round${on ? ' is-on' : ''}">
      <button class="switch home-switch" type="button" id="home-round-toggle" aria-pressed="${on}">
        <i></i>
        <div>
          <b>Round today?</b>
          <span>${on ? 'Switched on for today. We will get you ready and remind you to cool down.' : 'Switch on and Home turns into a round-day checklist.'}</span>
        </div>
      </button>
      ${on ? `<ol class="home-steps">
        ${step(warm ? 'done' : 'now', 'Warm up', '7 minutes, car park to first tee', '<button class="btn btn-sm btn-primary" type="button" data-routine="warmup">Start</button>')}
        ${step(warm && !cool ? 'now' : 'wait', 'Play', 'Between holes, ninety seconds if you stiffen up', '<button class="btn btn-sm" type="button" data-routine="turn">Reset</button>')}
        ${step(cool ? 'done' : 'wait', 'Cool down', '6 minutes at the cart, before the drive home', '<button class="btn btn-sm" type="button" data-routine="cooldown">Start</button>')}
        ${step(loggedToday ? 'done' : 'wait', 'Log the round', 'Thirty seconds. It is how the app learns what your back responds to', '<a class="btn btn-sm" href="#log">Log</a>')}
      </ol>` : ''}
    </div>`;
  }

  function calendarHTML() {
    const doneDays = new Set(done().map(d => d.date));
    const rounds = FR.entries();
    const roundDays = new Set(rounds.map(r => r.date));
    const today = FR.todayISO();
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;              /* 0 = Monday */
    const start = new Date(now); start.setDate(now.getDate() - dow - 28);
    const cells = [];
    for (let i = 0; i < 35; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = FR.localISO(d);
      const r = roundDays.has(iso), w = doneDays.has(iso);
      const state = r && w ? 'both' : w ? 'routine' : r ? 'round' : 'none';
      const future = iso > today;
      const label = `${fmtLong(iso)}: ${state === 'both' ? 'routine and a round' : state === 'routine' ? 'routine done' : state === 'round' ? 'round played' : 'nothing'}`;
      cells.push(`<span class="home-cell is-${state}${future ? ' is-future' : ''}${iso === today ? ' is-today' : ''}" title="${esc(label)}"><span class="sr">${esc(label)}</span></span>`);
    }
    const nDone = done().filter(d => daysSince(d.date) <= 34).length;
    return `<div class="home-cal">
      <div class="home-cal-head">
        <div><h3>Last five weeks</h3><p class="small muted">${nDone} routine${nDone === 1 ? '' : 's'} in the last 35 days.</p></div>
        <button class="btn btn-sm" type="button" data-share="streak">${ICON.share} Share</button>
      </div>
      <div class="home-cal-dows" aria-hidden="true">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="home-cal-grid" role="img" aria-label="Calendar of the last five weeks: dots mark days with a routine or a round">${cells.join('')}</div>
      <div class="home-legend small">
        <span><i class="is-routine"></i>Routine</span>
        <span><i class="is-round"></i>Round</span>
        <span><i class="is-both"></i>Both</span>
      </div>
      ${usingSamples() ? '<p class="home-sample small">Round dots come from the sample rounds until you log one of your own.</p>' : ''}
    </div>`;
  }

  function mobilityHTML() {
    const m = mobility();
    if (!m) {
      return `<div class="home-card home-mob is-empty">
        <h3>Do the 5-minute screen</h3>
        <p class="small muted">Eight tests on a carpet: hip rotation, mid-back turn, hamstrings, shoulders. It scores you out of 100, personalises your 3D avatar and points the plan at your actual stiff spots.</p>
        <a class="btn btn-primary" href="#screen">${ICON.body} Start the screen</a>
      </div>`;
    }
    const age = daysSince(m.date || FR.todayISO());
    const due = age >= 28;
    const score = Math.max(0, Math.min(100, Math.round(m.score)));
    const band = score >= 75 ? 'ok' : score >= 50 ? 'warn' : 'stop';
    return `<div class="home-card home-mob">
      <div class="home-mob-head">
        <div><h3>Mobility score</h3><p class="small muted">Screened ${esc(m.date ? agoWords(m.date) : 'recently')}${m.date ? ' · ' + esc(fmtDay(m.date)) : ''}</p></div>
        <span class="num home-mob-num is-${band}">${score}</span>
      </div>
      <div class="home-bar" aria-hidden="true"><i class="is-${band}" style="width:${score}%"></i></div>
      <div class="home-mob-scale small muted"><span>Stiff</span><span>Golf ready</span></div>
      ${due
        ? `<p class="small home-due">It has been ${age} days. Re-screen and see what the work has changed.</p>
           <div class="home-mob-actions"><a class="btn btn-primary btn-sm" href="#screen">Re-screen</a><button class="btn btn-sm" type="button" data-share="mobility">${ICON.share} Share</button></div>`
        : `<p class="small muted">Re-screen in ${28 - age} day${28 - age === 1 ? '' : 's'} to see what has changed.</p>
           <div class="home-mob-actions"><a class="btn btn-sm" href="#screen">Screen again</a><button class="btn btn-sm" type="button" data-share="mobility">${ICON.share} Share</button></div>`}
    </div>`;
  }

  function lastRoundHTML() {
    const r = lastRound();
    if (!r) {
      return `<div class="home-card is-empty">
        <h3>No rounds yet</h3>
        <p class="small muted">Thirty seconds after each round. In a month you will know exactly what your back responds to.</p>
        <a class="btn" href="#log">Log a round</a>
      </div>`;
    }
    const D = FR.data();
    const MOVES = { 'walk-carry': 'Carried', 'walk-push': 'Push cart', 'cart': 'Rode a cart' };
    const band = r.pain >= 6 ? 'hi' : r.pain >= 4 ? 'mid' : 'lo';
    return `<div class="home-card home-last">
      <div class="home-last-head">
        <div>
          <h3>Last round</h3>
          <p class="small muted">${esc(fmtDay(r.date))} · ${esc(agoWords(r.date))}${r.sample ? ' · sample' : ''}</p>
        </div>
        <span class="num home-pain is-${band}">${r.pain}<small>/10</small></span>
      </div>
      <div class="home-tags">
        <span class="tag ${r.warm ? 'tag-course' : ''}">${r.warm ? 'Warmed up' : 'No warm-up'}</span>
        <span class="tag">${esc((D.AREAS[r.area] || {}).short || 'Back')}</span>
        <span class="tag">${r.holes} holes</span>
        <span class="tag">${esc(MOVES[r.move] || r.move || '')}</span>
      </div>
      ${r.note ? `<p class="small home-note">“${esc(r.note)}”</p>` : ''}
      <div class="home-last-actions">
        <a class="btn btn-sm" href="#log">Log a round</a>
        <button class="btn btn-sm" type="button" data-share="round">${ICON.share} Share</button>
      </div>
      ${r.sample ? '<p class="home-sample small">This is a sample round so the card is not empty. Save your first round to replace it.</p>' : ''}
    </div>`;
  }

  function subline() {
    const s = FR.streak(), n = done().length;
    const rd = roundDay();
    if (rd) return 'Round day. Warm up, play, cool down, log it.';
    if (s >= 2) return `${s} days in a row. ${n} routine${n === 1 ? '' : 's'} in the bank.`;
    if (n > 0) return 'One thing today keeps the streak alive.';
    return 'Ten minutes a day is what keeps a golfing back playing. Here is today’s.';
  }

  function renderHome(el) {
    const plan = todayPlan();
    el.innerHTML = `
      <div class="view-head home-head">
        <div>
          <p class="home-eyebrow small">${esc(fmtLong(FR.todayISO()))}</p>
          <h1>${esc(greeting())}</h1>
          <p>${esc(subline())}</p>
        </div>
        <div class="home-head-side">
          <div class="home-streak"><span class="num">${FR.streak()}</span><span class="small muted">day<br>streak</span></div>
          <button class="btn btn-sm" type="button" id="home-edit">${ICON.gear} Edit profile</button>
        </div>
      </div>

      <div class="home-grid">
        <div class="home-main">
          ${todayHTML(plan)}
          ${roundSwitchHTML()}
          ${calendarHTML()}
        </div>
        <aside class="home-side">
          ${mobilityHTML()}
          ${lastRoundHTML()}
          ${achStripHTML()}
        </aside>
      </div>

      <div class="quick home-quick">
        <a class="primary" href="#routines" data-routine="warmup"><b>Warm me up</b><span>First-tee warm-up, 7 minutes, no floor work</span></a>
        <a href="#fix"><b>My back hurts</b><span>Three questions, then a plan for right now</span></a>
        <a href="#routines" data-routine="cooldown"><b>Cool me down</b><span>Post-round, 6 minutes at the cart</span></a>
        <a href="#lab"><b>Swing lab</b><span>See where the load goes in your own swing</span></a>
      </div>

      ${achSectionHTML()}

      <p class="disclaimer">Free Relief gives general exercise and injury-prevention guidance for golfers. It is not medical advice and cannot examine you. If you are unsure, in a lot of pain, or any of the “see someone” signs apply, get assessed by a doctor or physiotherapist. <a href="#evidence">The evidence behind it</a>.</p>`;

    $$('[data-routine]', el).forEach(b => b.addEventListener('click', (e) => { e.preventDefault(); FR.startRoutine(b.dataset.routine); }));
    const edit = $('#home-edit', el);
    if (edit) edit.addEventListener('click', () => openOnboarding({ edit: true }));
    const tog = $('#home-round-toggle', el);
    if (tog) tog.addEventListener('click', () => {
      const on = tog.getAttribute('aria-pressed') === 'true';
      setRoundDay(!on);
      FR.toast(!on ? 'Round day. Warm up before you tee off.' : 'Round day switched off.');
      FR.render();
    });
    $$('[data-jump]', el).forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const t = document.getElementById(a.dataset.jump);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    wireShare(el);
    if (QS.get('card')) {
      const spec = cardSpec(QS.get('card'));
      const c = spec && drawCard(spec);
      if (c) {
        const wrap = document.createElement('div');
        wrap.className = 'home-cardpreview';
        wrap.innerHTML = '<h3>Share card preview</h3>';
        c.style.width = '360px'; c.style.height = 'auto';
        wrap.appendChild(c);
        el.appendChild(wrap);
      }
    }
  }

  /* ================================================================
     Evidence — every reference below was checked against PubMed or the
     publisher before it was written down. Where the popular claim did not
     survive the check, the entry says so rather than quietly dropping it.
     ================================================================ */
  const doi = (d) => `https://doi.org/${d}`;
  const pmid = (p) => `https://pubmed.ncbi.nlm.nih.gov/${p}/`;

  const EVIDENCE = [
    {
      claim: 'The lower back barely rotates.',
      plain: 'Measured in living people with three-dimensional radiography, each lumbar joint gives about two degrees of axial rotation. Across the five levels that is roughly ten degrees in total — a fraction of the turn a golf swing asks for.',
      pop: 'Healthy adult volunteers, in vivo',
      cite: 'Pearcy MJ, Tibrewal SB. Axial rotation and lateral bending in the normal lumbar spine measured by three-dimensional radiography. Spine. 1984;9(6):582–7.',
      links: [['doi', doi('10.1097/00007632-198409000-00008')], ['PubMed', pmid('6495028')]],
      take: 'The turn has to come from somewhere else. That is the whole idea behind this app.'
    },
    {
      claim: 'The mid back is where the turn lives.',
      plain: 'Three-dimensional CT of trunk rotation puts thoracic rotation (T1 relative to L1) at about 25 degrees to one side, with the freest levels between T6 and T11. That is roughly two and a half times what the lumbar spine offers.',
      pop: '13 healthy volunteers, in vivo 3D CT',
      cite: 'Fujimori T, Iwasaki M, Nagamoto Y, et al. Kinematics of the thoracic spine in trunk rotation: in vivo 3-dimensional analysis. Spine. 2012;37(21):E1318–28.',
      links: [['doi', doi('10.1097/BRS.0b013e318267254b')], ['PubMed', pmid('22772578')]],
      take: 'Free the ribs and the lumbar spine stops being asked to do a job it cannot do.'
    },
    {
      claim: 'The golf swing puts big loads through the spine — and it is not only a beginner problem.',
      plain: 'The classic measurement study found peak compression of about 7,600 N in professionals against 6,100 N in amateurs — roughly eight times body weight. Amateurs produced the higher peak shear (596 N against 329 N). Professionals load more; amateurs load worse.',
      pop: '4 professional and 4 amateur golfers, five-iron',
      cite: 'Hosea TM, Gatt CJ, Galli KM, Langrana NA, Zawadsky JP. Biomechanical analysis of the golfer’s back. In: Cochran AJ, ed. Science and Golf: Proceedings of the First World Scientific Congress of Golf. London: E &amp; FN Spon; 1990:43–48. See also Hosea TM, Gatt CJ Jr. Back pain in golf. Clin Sports Med. 1996;15(1):37–53.',
      links: [['PubMed (1996 review)', pmid('8903708')]],
      take: 'A swing that shears is a swing that hurts. Sequence matters more than effort.',
      note: 'Book chapter: no DOI. Eight golfers in total — treat the exact newtons as an order of magnitude, not gospel.'
    },
    {
      claim: 'The lower back is the most commonly injured area in golf, and most golf injuries are overuse.',
      plain: 'A review of the golf injury literature puts the low back at the top of the list for both professionals and amateurs. A survey of 703 golfers found 82.6% of injuries were overuse rather than a single traumatic event: back, wrist and shoulder in professionals; elbow, back and shoulder in amateurs.',
      pop: 'Literature review; 703 professional and amateur golfers surveyed',
      cite: 'McHardy A, Pollard H, Luo K. Golf injuries: a review of the literature. Sports Med. 2006;36(2):171–87. · Gosheger G, Liem D, Ludwig K, Greshake O, Winkelmann W. Injuries and overuse syndromes in golf. Am J Sports Med. 2003;31(3):438–43.',
      links: [['doi (review)', doi('10.2165/00007256-200636020-00006')], ['doi (survey)', doi('10.1177/03635465030310031901')], ['PubMed', pmid('12750140')]],
      take: 'Nothing snapped. It accumulated. Which means it can be un-accumulated.'
    },
    {
      claim: 'Warming up is worth it — but only if you actually do enough of it.',
      plain: 'In the 703-golfer survey, a warm-up reduced injury only when it lasted at least ten minutes. A separate study of golfers’ actual habits found most warm-ups were far shorter than that, or absent. The randomised-trial evidence for warm-up across sport is positive but thinner than coaches assume.',
      pop: 'Amateur and professional golfers; plus a review of randomised trials across sport',
      cite: 'Fradkin AJ, Gabbe BJ, Cameron PA. Does warming up prevent injury in sport? The evidence from randomised controlled trials? J Sci Med Sport. 2006;9(3):214–20. · Fradkin AJ, Finch CF, Sherman CA. Warm up practices of golfers: are they adequate? Br J Sports Med. 2001;35(2):125–7. · Fradkin AJ, Cameron PA, Gabbe BJ. Golf injuries — common and potentially avoidable. J Sci Med Sport. 2005;8(2):163–70.',
      links: [['doi', doi('10.1016/j.jsams.2006.03.026')], ['doi (BJSM)', doi('10.1136/bjsm.35.2.125')], ['PubMed', pmid('16679062')]],
      take: 'Two practice swings is not a warm-up. Ten minutes is the number to beat.'
    },
    {
      claim: 'Golfers with low back pain move differently on the backswing.',
      plain: 'Elite golfers with low back pain flexed more at address, used significantly more side bending towards the target on the backswing, and had less trunk rotation available — so they rotated relatively further into their own limit. The pain-free golfers had more than twice the trunk flexion velocity coming down.',
      pop: '6 male professionals with low back pain vs 6 without',
      cite: 'Lindsay D, Horton J. Comparison of spine motion in elite golfers with and without low back pain. J Sports Sci. 2002;20(8):599–605.',
      links: [['doi', doi('10.1080/026404102320183158')], ['PubMed', pmid('12190279')]],
      take: 'Leaning away from the target at the top is the pattern to hunt for. Twelve golfers, though — this is a signpost, not a law.'
    },
    {
      claim: '“Crunch factor” and reverse spine angle are useful pictures, not proven causes.',
      plain: 'The crunch factor (side bending multiplied by rotation velocity) is widely taught as the mechanism behind golf back pain, and it appears in the peer-reviewed reviews. But when it was measured directly, peak crunch factors and their timing did not separate golfers with low back pain from golfers without it.',
      pop: '12 golfers with low back pain vs 15 controls',
      cite: 'Cole MH, Grimshaw PN. The crunch factor’s role in golf-related low back pain. Spine J. 2014;14(5):799–807. · Background review: Gluck GS, Bendo JA, Spivak JM. The lumbar spine and low back pain in golf: a literature review of swing biomechanics and injury prevention. Spine J. 2008;8(5):778–88.',
      links: [['doi', doi('10.1016/j.spinee.2013.09.019')], ['doi (review)', doi('10.1016/j.spinee.2007.07.388')], ['PubMed', pmid('24291405')]],
      take: 'We show it in the swing lab because it explains the load well. We are not going to pretend it is settled.'
    },
    {
      claim: 'Stiff lead-hip internal rotation goes with low back pain in golfers.',
      plain: 'Among 42 professional golfers, a third had a history of low back pain. That history was significantly associated with reduced lead hip internal rotation, a reduced FABERE distance and reduced lumbar extension. The trail hip showed no such difference.',
      pop: '42 male professional golfers, cross-sectional',
      cite: 'Vad VB, Bhat AL, Basrai D, Gebeh A, Aspergren DD, Andrews JR. Low back pain in professional golfers: the role of associated hip and low back range-of-motion deficits. Am J Sports Med. 2004;32(2):494–7.',
      links: [['doi', doi('10.1177/0363546503261729')], ['PubMed', pmid('14977679')]],
      take: 'The lead hip is the one to test. Association, not proof — but it is cheap to fix and free to try.'
    },
    {
      claim: 'Golfers get tennis elbow more often than golfer’s elbow.',
      plain: 'The review of upper limb injuries in golf reports lateral elbow injuries outnumbering medial ones by about five to one, and elbow problems making up a quarter to a third of all amateur injuries against 7–10% in professionals.',
      pop: 'Review of amateur and professional golfers',
      cite: 'McHardy AJ, Pollard HP. Golf and upper limb injuries: a summary and review of the literature. Chiropr Osteopat. 2005;13:7.',
      links: [['doi', doi('10.1186/1746-1340-13-7')], ['PubMed', pmid('15967021')]],
      take: 'If the outside of your elbow hurts, the name of the condition is misleading you. Treat what is actually sore.'
    },
    {
      claim: 'A fractured hook of hamate is a golf injury with a specific mechanism.',
      plain: 'The butt of the club is driven into the palm of the leading hand — usually hitting a root, a mat, or fat ground — and the hook of the hamate fractures against it. It is easily missed on a plain X-ray and it is the leading hand that goes.',
      pop: 'Clinical review; golfers of all levels',
      cite: 'Woo SH, Lee YK, Kim JM, Cheon HJ, Chung WH. Hand and wrist injuries in golfers and their treatment. Hand Clin. 2017;33(1):81–96.',
      links: [['doi', doi('10.1016/j.hcl.2016.08.012')], ['PubMed', pmid('27886842')]],
      take: 'Deep palm pain in the lead hand after a fat shot is not a bruise until someone has imaged it properly.'
    },
    {
      claim: 'Heavy slow loading is the treatment tendons respond to.',
      plain: 'The landmark study put fifteen recreational athletes with chronic Achilles tendinosis through twelve weeks of heavy-load eccentric calf work. All fifteen returned to full running with significantly less pain and normalised strength; the comparison group treated conventionally all ended up in surgery.',
      pop: '15 recreational athletes, prospective case series (not a randomised trial)',
      cite: 'Alfredson H, Pietilä T, Jonsson P, Lorentzon R. Heavy-load eccentric calf muscle training for the treatment of chronic Achilles tendinosis. Am J Sports Med. 1998;26(3):360–6.',
      links: [['doi', doi('10.1177/03635465980260030301')], ['PubMed', pmid('9617396')]],
      take: 'This is why the elbow routine is slow lowering rather than rest. Tendons need load, not silence.'
    },
    {
      claim: 'Good players sequence the swing from the ground up.',
      plain: 'Comparing nineteen amateurs with nineteen touring professionals across eighteen downswing variables, the professionals showed the cleaner proximal-to-distal sequence: pelvis, then torso, then arms, then club, each peaking and slowing as the next accelerates.',
      pop: '19 amateurs vs 19 PGA touring professionals, 3D motion analysis',
      cite: 'Cheetham PJ, Rose GA, Hinrichs RN, et al. Comparison of kinematic sequence parameters between amateur and professional golfers. In: Crews D, Lutz R, eds. Science and Golf V: Proceedings of the World Scientific Congress of Golf. Mesa, AZ: Energy in Motion; 2008:30–36.',
      links: [],
      take: 'Out of order means the back makes up the difference.',
      note: 'Conference proceedings, not a journal paper, and not indexed on PubMed. No DOI exists.'
    },
    {
      claim: 'Separation between torso and pelvis relates to distance.',
      plain: 'In a hundred recreational golfers, greater torso–pelvis separation at the top of the swing, and greater maximum separation, correlated moderately with higher ball velocity. The related idea that the separation increases at the start of the downswing — the “X-factor stretch” — comes from a separate conference paper.',
      pop: '100 recreational golfers',
      cite: 'Myers J, Lephart S, Tsai YS, Sell T, Smoliga J, Jolly J. The role of upper torso and pelvis rotation in driving performance during the golf swing. J Sports Sci. 2008;26(2):181–8. · Cheetham PJ, Martin PE, Mottram RE, St Laurent BF. The importance of stretching the “X-Factor” in the downswing of golf: the “X-Factor Stretch”. In: Thomas PR, ed. Optimising Performance in Golf. Brisbane: Australian Academic Press; 2001:192–199.',
      links: [['doi', doi('10.1080/02640410701373543')], ['PubMed', pmid('17852693')]],
      take: 'Separation is worth having. Buying it from the lumbar spine is not.'
    },
    {
      claim: 'The 3:1 tempo ratio is a coaching idea, not a finding.',
      plain: 'The three-to-one backswing-to-downswing ratio comes from a golf book, not a laboratory. The one study we could find on golf swing timing favoured a chain-like temporal structure over a fixed proportional one — evidence against a universal ratio, not for it.',
      pop: 'Popular coaching book; plus a motor-behaviour study of golfers across ages',
      cite: 'Novosel J, Garrity J. Tour Tempo: Golf’s Last Secret Finally Revealed. New York: Doubleday; 2004. ISBN 9780385509275. · Jagacinski RJ, Greenberg N, Liao MJ. Tempo, rhythm, and aging in golf. J Mot Behav. 1997;29(2):159–73.',
      links: [['doi', doi('10.1080/00222899709600830')], ['PubMed', pmid('12453792')]],
      take: 'A metronome is a useful practice tool. It is not a law of the swing, and we will not sell it as one.'
    },
    {
      claim: 'Golf-specific conditioning improves the things golfers care about.',
      plain: 'An eight-week golf-specific program in recreational golfers improved torso rotational and hip abduction strength, every flexibility measure taken, and club velocity, ball velocity, carry and total distance. A systematic review of thirteen strength and conditioning studies found all but two reported increased club head speed.',
      pop: '15 recreational male golfers (mean 47 years, handicap 12); systematic review of 13 studies',
      cite: 'Lephart SM, Smoliga JM, Myers JB, Sell TC, Tsai YS. An eight-week golf-specific exercise program improves physical characteristics, swing mechanics, and golf performance in recreational golfers. J Strength Cond Res. 2007;21(3):860–9. · Smith CJ, Callister R, Lubans DR. A systematic review of strength and conditioning programmes designed to improve fitness characteristics in golfers. J Sports Sci. 2011;29(9):933–43.',
      links: [['doi', doi('10.1519/R-20606.1')], ['doi (review)', doi('10.1080/02640414.2011.571273')], ['PubMed', pmid('17685707')]],
      take: 'Training for golf makes you play better as well as hurt less. Neither study measured pain, so we will not claim it did.'
    }
  ];

  const DROPPED = [
    ['“The lumbar spine rotates 13 degrees”, attributed to White &amp; Panjabi', 'We could not verify that figure in a source we could read. The measured number we could verify is about two degrees per level, so roughly ten in total.'],
    ['Thoracic rotation of 35 degrees per side', 'The in vivo measurement study we found reports about 25 degrees per side. We use that instead.'],
    ['Morgan et al. (1997) on the crunch factor', 'A conference abstract rather than a peer-reviewed paper. The idea is covered above through sources that were.'],
    ['Reverse spine angle as a proven cause of low back pain', 'We found no validating study. The closest real evidence is the side-bending finding above, so that is what we cite.'],
    ['Specific prevalence percentages for golfers’ low back pain', 'The commonly quoted “15–34% of amateurs” numbers trace back to secondary summaries we could not confirm at source. “The most commonly injured area” is what the reviews actually say.']
  ];

  function evItemHTML(e, i) {
    return `<article class="ev-item">
      <div class="ev-n num">${String(i + 1).padStart(2, '0')}</div>
      <div class="ev-body">
        <h3>${e.claim}</h3>
        <p>${e.plain}</p>
        <p class="ev-take"><b>So what</b> ${e.take}</p>
        <p class="ev-pop small"><span class="tag">${e.pop}</span></p>
        <p class="ev-cite small">${e.cite}</p>
        ${e.links.length ? `<p class="ev-links">${e.links.map(([l, h]) => `<a class="linkchip" href="${h}" target="_blank" rel="noopener noreferrer">${l}</a>`).join('')}</p>` : ''}
        ${e.note ? `<p class="ev-note small">${e.note}</p>` : ''}
      </div>
    </article>`;
  }

  function renderEvidence(el) {
    el.innerHTML = `
      <div class="view-head">
        <div>
          <h1>Where this comes from.</h1>
          <p>Every claim Free Relief makes, with the paper behind it. We checked each reference against PubMed or the publisher before writing it down. Where the popular version of a claim did not survive that check, we say so instead of quietly rounding it up.</p>
        </div>
        <p class="small muted">${EVIDENCE.length} claims · checked ${esc(fmtDay(FR.todayISO()))}</p>
      </div>

      <div class="ev-list">${EVIDENCE.map(evItemHTML).join('')}</div>

      <section class="plan-section ev-dropped">
        <h3>What we took out</h3>
        <p class="small muted">Things golf apps repeat that we could not stand behind.</p>
        <dl class="ev-drops">${DROPPED.map(([a, b]) => `<div><dt>${a}</dt><dd class="small">${b}</dd></div>`).join('')}</dl>
      </section>

      <section class="plan-section ev-about" id="about">
        <h3>About Free Relief</h3>
        <div class="ev-about-grid">
          <div>
            <h4>What this is</h4>
            <p class="small">A free golf back-care app: a 3D swing lab that shows where the load goes, a symptom-to-exercise planner, guided warm-ups and cool-downs, a round log and a mobility screen. Built for the golfer whose back is the reason they play less than they want to.</p>
          </div>
          <div>
            <h4>What this is not</h4>
            <p class="small">It is general exercise and injury-prevention guidance, not a diagnosis and not medical advice. It cannot examine you. If you are in a lot of pain, if pain wakes you at night, if there is numbness, weakness or any change in bladder or bowel control, stop and see a doctor or physiotherapist.</p>
          </div>
          <div>
            <h4>Your data</h4>
            <p class="small">Everything — your rounds, your routines, your screen scores, your profile — is stored in this browser on this device. There is no account, no server and no analytics. Clearing your browser data deletes it. Share cards are drawn on your device and only leave it if you choose to share one.</p>
          </div>
          <div>
            <h4>Credits</h4>
            <p class="small">Anatomy adapted from BodyParts3D, © The Database Center for Life Science, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>; a subset of skeletal structures was selected, simplified and re-rigged for animation.</p>
          </div>
        </div>
      </section>

      <p class="disclaimer">Citations are given so you can check us. Following a link takes you to the publisher or to PubMed; we do not host the papers and cannot give you full text.</p>`;
  }

  /* ================================================================
     Registration and wiring
     ================================================================ */
  FR.registerView('home', {
    render: (el) => renderHome(el),
    nav: { label: 'Home', icon: ICON.home, primary: true, first: true }
  });
  FR.registerView('evidence', {
    render: (el) => renderEvidence(el),
    nav: { label: 'Evidence', icon: ICON.evidence, primary: false }
  });

  /* Re-render Home once the guided player is out of the way, so the streak,
     the calendar and the round-day checklist reflect what just happened. */
  function refreshHomeSoon() {
    if (FR.route() !== 'home') return;
    if (!document.getElementById('player')) { FR.render(); return; }
    try {
      const mo = new MutationObserver(() => {
        if (document.getElementById('player')) return;
        mo.disconnect();
        if (FR.route() === 'home') FR.render();
      });
      mo.observe(document.body, { childList: true });
    } catch (e) { /* no observer: Home refreshes on the next navigation */ }
  }

  FR.on('routine:done', () => { checkAchievements(); refreshHomeSoon(); });
  FR.on('round:saved', () => { checkAchievements(); });
  FR.on('screen:done', (p) => {
    if (p && typeof p.score === 'number') recordScore(p.score);
    checkAchievements();
    refreshHomeSoon();
  });
  FR.on('profile:changed', () => { checkAchievements({ quiet: true }); });

  let booted = false;
  function onBoot() {
    if (booted) return;
    booted = true;
    if (QS.get('seed')) seedDemo();
    if (QS.get('ach')) { const h = unlocked(); BADGES.forEach(b => { h[b.id] = h[b.id] || FR.todayISO(); }); }
    if (QS.get('round')) store().roundDay = { date: FR.todayISO(), on: QS.get('round') !== '0' };
    checkAchievements({ quiet: true });
    const force = QS.get('onboard');
    if (force === '0') return;
    if (force || !profile().onboarded) setTimeout(() => {
      openOnboarding({});
      const step = Number(QS.get('step'));
      if (onbState && step >= 1 && step <= 5) { onbState.step = step - 1; renderOnb(); }
    }, 60);
  }
  FR.on('boot', onBoot);
  /* If app.js has already booted by the time this file runs, catch up. */
  if (document.readyState !== 'loading') setTimeout(() => { if (!booted) { onBoot(); FR.render(); } }, 0);
})();

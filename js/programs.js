/* Free Relief — Programs, Tempo trainer, Voice coach.
   Three features registered through the FR plugin API in js/app.js:
     - view 'programs': multi-week progressions built from the existing exercise library
     - view 'tempo':    a 3:1 swing tempo metronome and a tap-to-measure mode
     - voice coach:     speechSynthesis narration of the guided player, toggled from both views
   Everything here is content plus wiring. No other file is touched. */

(() => {
  const FR = window.FR;
  if (!FR) return;
  const esc = (s) => FR.esc(s);
  const DAYMS = 86400000;
  const parseISO = (iso) => new Date(iso + 'T12:00:00');
  const shiftISO = (iso, n) => FR.localISO(new Date(parseISO(iso).getTime() + n * DAYMS));
  const dayDiff = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAYMS);
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* ==========================================================================
     Store
     store.programs = { active, startDate, completed: { 'w1d1': iso }, paused, pausedOn }
     store.settings.voice = bool
     profile.tempo = { back, down, ratio, date }
     ========================================================================== */
  function progStore() {
    const s = FR.store();
    const p = (s.programs = s.programs || {});
    if (typeof p.active === 'undefined') p.active = null;
    if (typeof p.startDate === 'undefined') p.startDate = null;
    /* completed is a map of 'w1d1' -> ISO date. Coerce anything else (an older
       shape, or a list written by another module) rather than trusting it. */
    if (Array.isArray(p.completed)) {
      const map = {};
      p.completed.forEach(k => { if (typeof k === 'string') map[k] = p.startDate || FR.todayISO(); });
      p.completed = map;
    }
    if (!p.completed || typeof p.completed !== 'object') p.completed = {};
    if (p.active && !programById(p.active)) { p.active = null; p.startDate = null; p.completed = {}; }
    if (typeof p.paused !== 'boolean') p.paused = false;
    if (typeof p.pausedOn === 'undefined') p.pausedOn = null;
    return p;
  }
  function settings() {
    const s = FR.store();
    const st = (s.settings = s.settings || {});
    if (typeof st.voice !== 'boolean') st.voice = false;
    return st;
  }

  /* ==========================================================================
     Voice coach
     ========================================================================== */
  const VOICE = {
    ok: (() => { try { return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'; } catch (e) { return false; } })(),
    picked: null
  };
  function pickVoice() {
    if (!VOICE.ok) return null;
    try {
      const list = window.speechSynthesis.getVoices() || [];
      if (!list.length) return null;
      const en = list.filter(v => /^en(-|_|$)/i.test(v.lang || ''));
      VOICE.picked = en.find(v => v.localService && /^en-(GB|US)/i.test(v.lang)) || en.find(v => v.localService) || en[0] || null;
    } catch (e) { VOICE.picked = null; }
    return VOICE.picked;
  }
  if (VOICE.ok) {
    try {
      pickVoice();
      if (typeof window.speechSynthesis.addEventListener === 'function') window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
    } catch (e) { /* nothing to do */ }
  }
  function speak(text, force) {
    if (!VOICE.ok || !text) return;
    if (!force && !settings().voice) return;
    try {
      window.speechSynthesis.cancel();
      const u = new window.SpeechSynthesisUtterance(String(text));
      const v = VOICE.picked || pickVoice();
      if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
      u.rate = 1; u.pitch = 1; u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch (e) { /* degrade silently */ }
  }
  function hushVoice() { if (!VOICE.ok) return; try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }

  /* The player re-emits player:block on pause, resume and sound toggle, so narrate on change only. */
  let lastBlockKey = null;
  FR.on('player:block', (b) => {
    if (!b || !b.ex) return;
    const key = [b.index, b.total, b.ex.id, b.side || ''].join('|');
    if (key === lastBlockKey) return;
    lastBlockKey = key;
    if (!settings().voice) return;
    const bits = [b.ex.name];
    if (b.side) bits.push(b.side);
    if (b.ex.cue) bits.push(b.ex.cue);
    speak(bits.join('. '));
  });
  FR.on('routine:done', () => { lastBlockKey = null; speak('Done'); });
  FR.on('route', () => { lastBlockKey = null; hushVoice(); });

  function voiceToggleHTML() {
    const on = settings().voice;
    if (!VOICE.ok) {
      return `<div class="prog-voice prog-voice-off"><i aria-hidden="true"></i><div><b>Voice coach</b><span>This browser has no speech synthesis, so the coach stays quiet.</span></div></div>`;
    }
    return `<div class="prog-voice-row">
      <button class="switch prog-voice" type="button" data-voice aria-pressed="${on}">
        <i aria-hidden="true"></i>
        <div><b>Voice coach: speak each exercise</b><span>${on ? 'On. The player reads the name, the side and the cue out loud.' : 'Off. Turn it on to be talked through a session without looking at the screen.'}</span></div>
      </button>
      <button class="btn btn-ghost btn-sm" type="button" data-voice-test>Test voice</button>
    </div>`;
  }
  function wireVoice(el, after) {
    const t = el.querySelector('[data-voice]');
    if (t) t.addEventListener('click', () => {
      const st = settings();
      st.voice = !st.voice;
      FR.save();
      if (st.voice) speak('Voice coach on. I will read each exercise.', true);
      else { hushVoice(); FR.toast('Voice coach off'); }
      if (after) after();
    });
    const test = el.querySelector('[data-voice-test]');
    if (test) test.addEventListener('click', () => {
      if (!VOICE.ok) { FR.toast('No speech synthesis in this browser'); return; }
      speak('Open book. First side. Follow your hand with your eyes and let the ribs turn.', true);
    });
  }

  /* ==========================================================================
     Programs: content
     Every block references an exercise id that already exists in js/data.js.
     Blocks whose exercise has sides:true are run twice by the player, so the
     minutes below are computed from the real expanded length.
     ========================================================================== */
  const b = (ex, secs) => ({ ex, secs });
  let PROGRAMS = null;

  function buildPrograms() {
    if (PROGRAMS) return PROGRAMS;
    const D = FR.data();
    const EX = D.EX, ROUTINE = D.ROUTINE;
    const R = (id) => ROUTINE[id].steps.map(s => ({ ex: s.ex, secs: s.secs }));
    const S = (title, note, blocks) => ({ title, note, blocks });
    const rest = (note) => ({ rest: true, note });

    /* ---------- 1. Golfer's elbow: 6 weeks, daily ---------- */
    const elbowBlocks = {
      1: [b('wristrot', 30), b('gripsqueeze', 45), b('gripsqueeze', 45), b('gripsqueeze', 45), b('gripsqueeze', 45), b('wristflex', 30), b('wristext', 30), b('wristflex', 30)],
      2: [b('wristrot', 30), b('gripsqueeze', 60), b('gripsqueeze', 60), b('gripsqueeze', 60), b('gripsqueeze', 60), b('wristflex', 30), b('wristext', 30)],
      3: [b('wristrot', 30), b('eccwrist', 45), b('eccwrist', 45), b('gripsqueeze', 45), b('wristflex', 30), b('wristext', 30)],
      4: [b('wristrot', 30), b('eccwrist', 60), b('eccwrist', 60), b('gripsqueeze', 60), b('wristflex', 30), b('wristext', 30)],
      5: [b('wristrot', 30), b('eccwrist', 60), b('eccwrist', 60), b('pronation', 40), b('gripsqueeze', 45), b('wristflex', 30)],
      6: [b('wristrot', 30), b('eccwrist', 60), b('eccwrist', 60), b('pronation', 45), b('gripsqueeze', 60), b('wristflex', 30)]
    };
    /* Weeks 5-6 hitting days: the loading first, then the graded swings. */
    const elbowSwing = {
      5: [b('wristrot', 30), b('eccwrist', 60), b('eccwrist', 60), b('pronation', 40), b('gripsqueeze', 45), b('pswings', 75)],
      6: [b('wristrot', 30), b('eccwrist', 60), b('eccwrist', 60), b('pronation', 45), b('pswings', 75)]
    };
    const elbowTitle = {
      1: 'Isometric holds and stretch', 2: 'Longer isometric holds', 3: 'Eccentrics, light and slow',
      4: 'Eccentrics, heavier', 5: 'Heavy-slow loading and rotation', 6: 'Full loading'
    };
    const elbowNotes = {
      1: ['Find a grip pressure that gives an ache of about 3 out of 10 in the elbow. No more.', 'Same again. Boring is the treatment.', '', 'Keep the elbow tucked in at your side for the holds.', '', 'No hitting this week. Chipping counts as hitting.', 'End of week one. Was it the same or better each morning? If it was worse, do week one again before moving on.'],
      2: ['Holds go to 60 seconds. The load, not the burn, is the point.', '', 'If the ache stays under 4 out of 10 and settles overnight, you are on track.', '', '', 'Still no hitting. One more week.', 'End of week two. Better mornings? Move on to eccentrics.'],
      3: ['Eccentrics start here: lift with the good hand, lower slowly with the sore one. Three seconds down.', '', 'Light weight. A tin of beans is enough to start.', 'Some ache during is expected and allowed. Sharp pain is not.', '', 'Short game only if you are itching to hit: 15 chips, no more.', 'End of week three.'],
      4: ['Same movement, heavier or slower. Change one, not both.', '', '', 'Four seconds down if you would rather not add weight.', '', '20 chips and pitches if the mornings have been quiet.', 'End of week four. Two weeks of loading behind you.'],
      5: ['Heavy-slow loading now, plus forearm rotation with a club.', 'Hitting day: 20 chips and pitches. No full swings.', 'Recovery day. Just the exercises.', '', 'Hitting day: 20 chips, then 15 half swings with a wedge. Stop at 35 balls.', '', 'End of week five. If the elbow is quiet by morning, week six adds full swings.'],
      6: ['Last week. Keep the load, add the swings.', 'Hitting day: 15 half swings, then 15 full swings with a 9-iron. Stop there.', '', 'Hitting day: half swings to warm, then 25 full shots, wedge through 7-iron.', '', 'Hitting day: a full small bucket, driver included, or nine holes.', 'Done. Keep two sessions a week going for another two months, or the tendon will find you again.']
    };
    const elbowDays = (w) => Array.from({ length: 7 }, (_, i) => {
      const swingDay = (w === 5 && (i === 1 || i === 4)) || (w === 6 && (i === 1 || i === 3 || i === 5));
      const blocks = swingDay ? elbowSwing[w] : elbowBlocks[w];
      return S(swingDay ? elbowTitle[w] + ' plus swings' : elbowTitle[w], elbowNotes[w][i], blocks);
    });

    const elbow = {
      id: 'elbow',
      name: "Golfer's elbow: 6 weeks",
      short: "Golfer's elbow",
      tagline: 'Daily, six to eight minutes. Isometrics, then eccentrics, then heavy-slow loading and a graded return to hitting.',
      weeks: 6,
      cadence: 'Every day, 7 sessions a week',
      overview: 'Golfer\'s elbow is a load problem in the tendons that bend the wrist and turn the forearm, where they attach to the bony point on the inside of the elbow. Rest alone makes it feel better and leaves the tendon just as weak, which is why it comes back on the first heavy range day. This programme does the opposite: it gives the tendon load it can tolerate, every day, and adds a little each fortnight. Weeks one and two settle the pain with isometric holds. Weeks three and four load the tendon slowly on the way down. Weeks five and six go heavier and slower, add forearm rotation, and walk you back to hitting: chips, then half swings, then full.',
      forWho: 'An ache on the inside of the elbow that came on gradually, hurts when you grip, and is worse after a range session or a round on hard ground.',
      notFor: 'A sudden pop, real swelling or bruising, pins and needles into the ring and little finger, an elbow that will not straighten, or pain that followed a fall. That is a different problem. Get it looked at.',
      evidence: 'Tendon rehab has a well-established shape: isometric holds for pain first, then slow, heavy, progressive loading. Six weeks is the floor, not the finish line — tendons are commonly quoted in months.',
      rule: 'Tolerable pain rule: an ache up to 4 out of 10 during the session, and for an hour or so after, is fine. It must have settled by the next morning. If the elbow is worse the next morning, repeat the previous week before moving up.',
      stopTitle: 'See someone if',
      stop: ['The pain travels into the forearm with pins and needles or numbness.', 'You lose grip strength — dropping a club or a mug.', 'The elbow is swollen, hot, or will not fully straighten.', 'Six weeks of honest loading changes nothing.'],
      note: 'The library has no cable or dumbbell rotation, so forearm rotation is the club version: pronation and supination with a club, choked up or down the shaft to change the load.',
      weeksData: [1, 2, 3, 4, 5, 6].map(w => ({
        title: ['Settle it down', 'Longer holds', 'Eccentrics begin', 'Eccentrics, heavier', 'Heavy-slow loading, chipping', 'Full loading, full swings'][w - 1],
        focus: ['Isometrics and gentle stretch', 'Isometrics and gentle stretch', 'Eccentric loading', 'Eccentric loading', 'Heavy-slow loading, rotation, chip to half swings', 'Heavy-slow loading and a return to full swings'][w - 1],
        days: elbowDays(w)
      }))
    };

    /* ---------- 2. Return to golf after a back flare: 4 weeks ---------- */
    const flareMob = [b('pelvictilt', 45), b('kneeside', 45), b('catcow', 60), b('childs', 40), b('hipflexor', 30), b('deadbug', 45)];
    const flareMobStab = [b('catcow', 60), b('kneeside', 45), b('deadbug', 45), b('birddog', 45), b('bridge', 45), b('childs', 40)];
    const flareStab = [b('deadbug', 60), b('birddog', 60), b('sideplank', 25), b('hinge', 45), b('pallof', 40), b('bridge', 60)];
    const flareHinge = [b('hinge', 45), b('clubrot', 45), b('slrdl', 40), b('pallof', 40), b('deadbug', 60), b('latstretch', 30)];
    const flareSwing = [b('hinge', 45), b('clubrot', 45), b('pswings', 75), b('deadbug', 60), b('pallof', 40), b('latstretch', 30)];
    const flareStrength = [b('bridge', 60), b('slrdl', 40), b('splitsquat', 40), b('hipairplane', 40), b('sideplank', 30), b('pallof', 40)];

    const flare = {
      id: 'flare',
      name: 'Return to golf after a back flare: 4 weeks',
      short: 'Back flare return',
      tagline: 'Graded exposure. Walking and gentle mobility, then stability and half swings, then nine holes with a cart, then eighteen.',
      weeks: 4,
      cadence: '5 sessions a week, 2 rest days',
      overview: 'A settling back flare does not need protecting, it needs loading in steps small enough that nothing spikes. Week one is walking, gentle mobility and the first stability work — no swings at all. Week two adds the hinge, anti-rotation and half swings on the range. Week three is nine holes with a cart, with the full first-tee warm-up before and the cool-down after. Week four is eighteen. If a week hurts more than it should, stay on it. Nobody is timing you.',
      forWho: 'A lower back flare that is heading in the right direction: you can walk, sit and sleep, it is easing week to week, and the pain stays in your back.',
      notFor: 'Pain, pins and needles or weakness travelling down a leg; numbness around the saddle area; any change in bladder or bowel control; fever; or a back that went after a fall. Stop and see someone today.',
      evidence: 'Guidelines for non-specific low back pain agree on the direction of travel: stay active, skip bed rest, and rebuild load gradually. This is that advice put on a calendar. It is not a cure and it cannot examine you.',
      rule: 'Traffic-light rule: soreness that settles within 24 hours means carry on. Soreness that is still there after 48 hours means repeat the week. Symptoms down the leg mean stop and get assessed.',
      stopTitle: 'Stop and see someone if',
      stop: ['Pain, pins and needles, numbness or weakness travels below the knee — radicular symptoms are a stop sign, not a soreness to push through.', 'You cannot lift your foot properly, or your leg gives way.', 'Numbness in the saddle area, or any change in bladder or bowel control. That is an emergency, go today.', 'Night pain that wakes you, unexplained weight loss, or a fever alongside the back pain.'],
      note: 'The walking dose is written in the day notes rather than run through the player — no timer needed for a walk.',
      weeksData: [
        {
          title: 'Walk, move, brace', focus: 'Walking daily, gentle mobility, the first stability work. No swings.',
          days: [
            S('Gentle mobility', 'Walk 20 minutes on flat ground today, easy pace. The session is small on purpose.', flareMob),
            S('Gentle mobility', 'Walk 20 minutes. Move often at work: get up every half hour.', flareMob),
            rest('Rest day. Walk 20 minutes and leave it there. Bed rest makes this worse, not better.'),
            S('Mobility and first stability', 'Walk 25 minutes. Brace gently, breathe out on the effort.', flareMobStab),
            S('Mobility and first stability', 'Walk 25 minutes.', flareMobStab),
            rest('Rest day. Walk 25 minutes. No swinging yet, not even in the garden.'),
            S('Mobility and first stability', 'Walk 30 minutes. End of week one: if the pain is settling and staying in your back, week two adds half swings.', flareMobStab)
          ]
        },
        {
          title: 'Stability, the hinge, half swings', focus: 'Trunk stability and hinging, then 20 half swings on the range.',
          days: [
            S('Stability', 'Walk 30 minutes. The hinge is the movement that gets you to the ball for the next 30 years, so learn it properly.', flareStab),
            S('Hinge and rotation', 'Practise picking the ball out of the hole with a hinge, not a slump.', flareHinge),
            rest('Rest day. Keep the walk.'),
            S('Stability', 'Walk 30 minutes.', flareStab),
            S('Half swings on the range', 'Range day: after this session, 20 half swings with a wedge and a 9-iron. Off a mat or good turf. Stop at 20 even if it feels good.', flareSwing),
            rest('Rest day. Nothing but the walk.'),
            S('Hinge and rotation', 'End of week two. Quiet back the morning after the range day? Week three is nine holes.', flareHinge)
          ]
        },
        {
          title: 'Nine holes with a cart', focus: 'The first real round: nine holes, cart, full warm-up and cool-down.',
          days: [
            S('Stability', 'Walk 30 minutes.', flareStab),
            S('Hinge and rotation', 'Book the cart for the day-four round now. Carrying a bag is a week-four decision at the earliest.', flareHinge),
            rest('Rest day before the round. Walk, and go to bed at a sensible hour.'),
            S('First-tee warm-up', 'Round day: nine holes with a cart. Do this warm-up in the car park, not on the first tee. If the back starts talking, stop at seven holes. Nobody will notice.', R('warmup')),
            S('Post-round cool-down', 'The day after nine holes. Some stiffness is normal, sharp pain is not.', R('cooldown')),
            rest('Rest day.'),
            S('Stability', 'End of week three. Nine holes survived? Week four is eighteen.', flareStab)
          ]
        },
        {
          title: 'Eighteen holes', focus: 'Strength alongside the stability, then a full round.',
          days: [
            S('Strength and stability', 'Walk 30 minutes. Strength is what keeps this from happening again.', flareStrength),
            S('Half swings and rotation', 'Range day: 20 half swings, then 20 full shots, wedge through 7-iron.', flareSwing),
            rest('Rest day.'),
            S('Strength and stability', 'Two days out from eighteen holes. Keep it steady.', flareStrength),
            rest('Rest day before the round. Walk and hydrate.'),
            S('First-tee warm-up', 'Round day: eighteen holes. Cart or a push trolley — do not go back to carrying in the same week you go back to eighteen.', R('warmup')),
            S('Post-round cool-down', 'Last session. Do this before you get in the car. Then keep the daily back care routine going twice a week for good.', R('cooldown'))
          ]
        }
      ]
    };

    /* ---------- 3. Swing speed foundations: 8 weeks ---------- */
    const spdHips = [b('legswing', 30), b('wgs', 40), b('hip9090', 60), b('hipflexor', 30), b('figure4', 30), b('hamstring', 30), b('ohsquat', 40)];
    const spdT = [b('catcow', 60), b('openbook', 45), b('thread', 40), b('text', 45), b('wallangel', 45), b('clubrot', 45), b('latstretch', 30)];
    const spdBoth = [b('wgs', 40), b('hip9090', 60), b('openbook', 45), b('clubrot', 45), b('ohsquat', 40), b('pswings', 75)];
    const spdStab1 = [b('deadbug', 60), b('birddog', 60), b('sideplank', 30), b('pallof', 40), b('hinge', 45), b('bridge', 60)];
    const spdStab2 = [b('openbook', 45), b('hip9090', 60), b('hipairplane', 40), b('pallof', 40), b('curlup', 60), b('sideplank', 30)];
    const spdStab3 = [b('hinge', 45), b('slrdl', 40), b('pallof', 40), b('deadbug', 60), b('clubrot', 45), b('pswings', 75)];
    const spdStr1 = [b('bridge', 60), b('splitsquat', 40), b('slrdl', 40), b('calfraise', 40), b('wallsit', 40), b('sideplank', 30)];
    const spdStr2 = [b('ytw', 60), b('bander', 40), b('wallangel', 45), b('pallof', 40), b('thread', 40), b('text', 45)];
    const spdStr3 = [b('splitsquat', 45), b('bridge', 60), b('slrdl', 45), b('pallof', 45), b('clubrot', 45), b('pswings', 75)];
    const spdPow1 = [b('wgs', 40), b('clubrot', 45), b('pallof', 30), b('hipairplane', 40), b('slrdl', 40), b('pswings', 75)];
    const spdPow2 = [b('legswing', 30), b('ohsquat', 40), b('splitsquat', 40), b('pallof', 30), b('bander', 40), b('pswings', 75)];
    const spdPow3 = [b('legswing', 30), b('wgs', 40), b('clubrot', 45), b('hinge', 30), b('pswings', 75), b('pswings', 75)];

    /* Rest days carry their own copy: a blank day in a programme is a decision,
       and it should read like one. A note written for a particular week wins. */
    const REST_COPY = [
      'Rest day. Walk if you like. The adaptation happens between the sessions, not during them.',
      'Rest day. If you are playing today, the round is the session.',
      'Rest day. Keep the walking going — it is the cheapest thing you can do for a golf back.',
      'Rest day. Two days off before the next block is deliberate: strength needs the gap.'
    ];
    const restNote = (given, i) => (given && !/^Rest day\.?$/.test(given.trim()) && given !== 'Rest day. Walk if you like.') ? given : REST_COPY[i];
    const spdWeek = (title, focus, a, bS, c, notes) => ({
      title, focus,
      days: [
        S(a[0], notes[0], a[1]), rest(restNote(notes[3], 0)),
        S(bS[0], notes[1], bS[1]), rest(restNote(notes[4], 1)),
        S(c[0], notes[2], c[1]), rest(restNote(notes[5], 2)),
        rest(restNote(notes[6], 3))
      ]
    });

    const speed = {
      id: 'speed',
      name: 'Swing speed foundations: 8 weeks',
      short: 'Speed foundations',
      tagline: 'Three sessions a week for eight weeks. Mobility, then stability, then strength, then rotational work.',
      weeks: 8,
      cadence: '3 sessions a week (days 1, 3 and 5), 4 rest days',
      overview: 'Speed comes from three places: how far you can turn, how much force you can put into the ground, and whether your technique lets any of it reach the clubhead. This programme builds the first two. Weeks one and two open the hips and the mid back, because a body that cannot turn has nothing to accelerate. Weeks three and four build the trunk stability that stops the turn leaking. Weeks five and six are strength — glutes, legs, trunk and cuff. Weeks seven and eight put it together with rotational work and full-effort practice swings.',
      forWho: 'A golfer with no current pain who wants more clubhead speed and is willing to spend eight weeks on the boring half of it.',
      notFor: 'Anyone in a flare, anyone with a back that is still settling, or anyone hoping to skip to week seven. Use the back flare programme first.',
      evidence: 'The honest version: mobility, strength and technique each contribute to clubhead speed, and training programmes that combine them tend to add a few miles an hour over a couple of months. This is a foundation, not a speed-training device. It has no radar, no overspeed sticks and no weighted clubs, and it will not make you long on its own — get a coach for the technique half.',
      rule: 'Effort rule: full-effort practice swings only when you are warm and only in the last two weeks. Speed work on a cold, stiff body is how golfers meet their physio.',
      stopTitle: 'Back off if',
      stop: ['Anything hurts in the lower back during or after the rotational weeks.', 'Soreness from a session is still there 48 hours later — take the extra rest day.', 'You feel a pull or a catch in the trunk during full-effort swings. Stop for the day.'],
      note: 'The library has no medicine ball, cable or weighted-club work, so the rotational power sessions use what exists: fast Pallof presses for anti-rotation, hip airplanes for control of the turn, and progressive practice swings for the speed itself. That is the honest substitution — this trains the foundation for speed, not speed itself.',
      weeksData: [
        spdWeek('Open the hips', 'Hip and thoracic mobility. Find the range first.', ['Hips', spdHips], ['Mid back', spdT], ['Hips, mid back and a few swings', spdBoth],
          ['First session. Range of motion, not effort. Breathe out at the end of each stretch.', 'Desk life takes the mid back first. This is where the turn should come from.', 'Six easy practice swings at the end, half speed. Feel the new range.', 'Rest day. Walk if you like.', 'Rest day.', 'Rest day.', 'Rest day. End of week one.']),
        spdWeek('Own the range', 'The same mobility, held longer and taken further.', ['Hips', spdHips], ['Mid back', spdT], ['Hips, mid back and a few swings', spdBoth],
          ['Same session, further into the range. It should feel easier than last week.', 'Add a breath at the end of each rotation and let the ribs go a little more.', 'Practice swings at three-quarter speed today.', 'Rest day.', 'Rest day.', 'Rest day.', 'Rest day. End of week two: two weeks of mobility banked.']),
        spdWeek('Stability begins', 'Trunk and pelvis control. Stop the turn leaking.', ['Trunk stability', spdStab1], ['Mobility and control', spdStab2], ['Hinge and rotation', spdStab3],
          ['Quality over time. If your lower back is doing the work, make the movement smaller.', 'Keep the mobility going alongside the stability. Losing range while you get stiff and strong is the classic mistake.', 'The hinge is the position you swing from. Get it right here and it is free on the course.', 'Rest day.', 'Rest day.', 'Rest day.', 'Rest day.']),
        spdWeek('Stability under load', 'Longer holds, more control, the same movements.', ['Trunk stability', spdStab1], ['Mobility and control', spdStab2], ['Hinge and rotation', spdStab3],
          ['Slow every rep down by a count. That is the progression.', 'Hip airplanes are the hardest thing here. Hold something if you need to.', 'Practice swings at full length, three-quarter effort.', 'Rest day.', 'Rest day.', 'Rest day.', 'Rest day. End of week four, halfway.']),
        spdWeek('Strength: lower and upper', 'Glutes, legs, trunk and rotator cuff.', ['Lower body strength', spdStr1], ['Upper body and cuff', spdStr2], ['Full body and swings', spdStr3],
          ['Add a dumbbell, a kettlebell or a loaded rucksack to the bridge and split squat once the bodyweight version is easy.', 'The cuff work is insurance. Nobody enjoys it and everybody who skips it regrets it.', 'Strength first, swings last, always.', 'Rest day.', 'Rest day.', 'Rest day.', 'Rest day.']),
        spdWeek('Strength: add load', 'Same sessions, more weight or slower reps. Change one.', ['Lower body strength', spdStr1], ['Upper body and cuff', spdStr2], ['Full body and swings', spdStr3],
          ['More load than last week, or slower. Not both.', 'Keep the mid-back work in — strength without range is a slower swing.', 'Practice swings at full effort for the last two only.', 'Rest day.', 'Rest day.', 'Rest day.', 'Rest day. End of week six.']),
        spdWeek('Rotational work', 'Fast anti-rotation, control of the turn, and speed swings.', ['Rotation and control', spdPow1], ['Ground force and cuff', spdPow2], ['Warm up and swing fast', spdPow3],
          ['Pallof presses are fast out and controlled back. Ribs down, hips still.', 'Split squats drive through the whole foot. That is where speed comes from.', 'Three sets of five full-effort swings, full recovery between sets. Warm first. Always warm first.', 'Rest day.', 'Rest day.', 'Rest day.', 'Rest day.']),
        spdWeek('Put it together', 'The last block. Full effort, fully warm.', ['Rotation and control', spdPow1], ['Ground force and cuff', spdPow2], ['Warm up and swing fast', spdPow3],
          ['Last week. Nothing new, just sharper.', 'Keep the cuff work forever, not just for eight weeks.', 'Final session: three sets of five at full effort. Then take the mobility work with you and keep two sessions a week.', 'Rest day.', 'Rest day.', 'Rest day.', 'Programme complete. Keep two sessions a week or the range goes back where it came from.'])
      ]
    };

    const list = [elbow, flare, speed];
    /* Attach keys, minutes and figure poses. */
    list.forEach(p => {
      p.sessions = {};
      p.sessionCount = 0;
      p.weeksData.forEach((wk, wi) => {
        wk.n = wi + 1;
        wk.days.forEach((d, di) => {
          d.week = wi + 1; d.day = di + 1; d.key = `w${wi + 1}d${di + 1}`; d.index = wi * 7 + di + 1;
          if (!d.rest) {
            d.secs = d.blocks.reduce((s, x) => s + x.secs * (EX[x.ex] && EX[x.ex].sides ? 2 : 1), 0);
            d.poses = d.blocks.map(x => EX[x.ex] && EX[x.ex].pose).filter(Boolean);
            p.sessionCount++;
          }
          p.sessions[d.key] = d;
        });
      });
      const all = Object.values(p.sessions).filter(s => !s.rest);
      p.minLow = Math.round(Math.min.apply(null, all.map(s => s.secs)) / 60);
      p.minHigh = Math.round(Math.max.apply(null, all.map(s => s.secs)) / 60);
      p.totalDays = p.weeks * 7;
    });
    PROGRAMS = list;
    return PROGRAMS;
  }
  const programById = (id) => buildPrograms().find(p => p.id === id) || null;

  /* ==========================================================================
     Programs: state maths
     ========================================================================== */
  function active() {
    const ps = progStore();
    return ps.active ? programById(ps.active) : null;
  }
  function dayIndex(ps, p) {
    if (!ps.startDate) return 0;
    const ref = ps.paused && ps.pausedOn ? ps.pausedOn : FR.todayISO();
    return dayDiff(ps.startDate, ref) + 1;
  }
  function stats(p, ps) {
    const idx = dayIndex(ps, p);
    const capped = Math.min(idx, p.totalDays);
    let due = 0, done = 0, doneAll = 0;
    Object.values(p.sessions).forEach(s => {
      if (s.rest) return;
      const isDone = !!ps.completed[s.key];
      if (isDone) doneAll++;
      if (s.index <= capped) { due++; if (isDone) done++; }
    });
    return { idx, capped, due, done, doneAll, finished: idx > p.totalDays, week: Math.max(1, Math.min(p.weeks, Math.ceil(idx / 7))), pct: due ? Math.round(done / due * 100) : 0 };
  }
  function sessionAt(p, idx) {
    if (idx < 1 || idx > p.totalDays) return null;
    const w = Math.ceil(idx / 7), d = idx - (w - 1) * 7;
    return p.sessions[`w${w}d${d}`] || null;
  }
  function dateFor(ps, idx) { return ps.startDate ? shiftISO(ps.startDate, idx - 1) : null; }

  function startProgram(id) {
    const ps = progStore();
    ps.active = id; ps.startDate = FR.todayISO(); ps.completed = {}; ps.paused = false; ps.pausedOn = null;
    FR.save();
  }
  function playSession(p, s) {
    if (!s || s.rest) return;
    FR.startPlayer({
      title: `${p.short}: week ${s.week} day ${s.day}`,
      blocks: s.blocks,
      routineId: `program:${p.id}:${s.key}`
    });
  }

  /* Mark the session complete when the player finishes it. */
  FR.on('routine:done', (e) => {
    if (!e || !e.routine) return;
    const m = /^program:([a-z]+):(w\d+d\d+)$/.exec(e.routine);
    if (!m) return;
    const ps = progStore();
    if (ps.active !== m[1]) return;
    ps.completed[m[2]] = e.date || FR.todayISO();
    FR.save();
    repaintPrograms();
  });

  /* ==========================================================================
     Programs: view
     ========================================================================== */
  let progMount = null;
  let ui = { confirmSwitch: null, confirmLeave: false, openWeek: null, browse: false };

  function repaintPrograms() {
    if (!progMount || !document.body.contains(progMount)) return;
    renderPrograms(progMount);
  }

  function figsHTML(poses, size) {
    if (typeof window.figureSVG !== 'function') return '';
    return `<div class="prog-figs" aria-hidden="true">${poses.slice(0, 9).map(pz => window.figureSVG(pz, { size: size || 36 })).join('')}</div>`;
  }

  function todayCardHTML(p, ps, st) {
    if (st.finished) {
      return `<section class="prog-today prog-done">
        <span class="tag tag-course">Programme complete</span>
        <h2>${esc(p.name)} — done.</h2>
        <p class="muted">${st.doneAll} of ${p.sessionCount} sessions logged over ${p.weeks} weeks. Whatever the number, you turned up for the boring part, which is the whole trick.</p>
        <div class="prog-actions">
          <button class="btn btn-primary" type="button" data-restart>Run it again</button>
          <button class="btn" type="button" data-browse>Pick a different programme</button>
          <button class="btn btn-ghost" type="button" data-leave>Finish and clear</button>
        </div>
      </section>`;
    }
    if (ps.paused) {
      return `<section class="prog-today prog-paused">
        <span class="tag">Paused</span>
        <h2>Paused on day ${st.idx} of ${p.totalDays}.</h2>
        <p class="muted">Nothing is due while you are paused, and the schedule will not run away from you. Resuming moves the remaining days forward, it does not skip them.</p>
        <div class="prog-actions"><button class="btn btn-primary" type="button" data-resume>Resume the programme</button></div>
      </section>`;
    }
    const s = sessionAt(p, st.idx);
    const iso = dateFor(ps, st.idx);
    const label = `Week ${st.week}, day ${st.idx - (st.week - 1) * 7}`;
    if (!s) return '';
    if (s.rest) {
      return `<section class="prog-today prog-rest-card">
        <span class="tag">${esc(label)} · rest day</span>
        <h2>Nothing due today.</h2>
        <p class="muted">${esc(s.note || 'A rest day is part of the programme, not a gap in it. Adaptation happens between the sessions.')}</p>
        <div class="prog-actions"><button class="btn" type="button" data-peek="${esc(nextSessionKey(p, st.idx))}">Look at the next session</button></div>
      </section>`;
    }
    const done = !!ps.completed[s.key];
    return `<section class="prog-today${done ? ' is-done' : ''}">
      <div class="prog-today-head">
        <div>
          <span class="tag ${done ? 'tag-course' : ''}">${esc(label)}${done ? ' · done' : ' · due today'}${iso ? '' : ''}</span>
          <h2>${esc(s.title)}</h2>
          <p class="muted">${esc(s.note || p.weeksData[s.week - 1].focus)}</p>
        </div>
        <span class="num prog-mins">${Math.round(s.secs / 60)}<small>min</small></span>
      </div>
      ${figsHTML(s.poses, 40)}
      <div class="prog-actions">
        <button class="btn btn-primary" type="button" data-start-session="${s.key}">${FR.icon('play')} ${done ? 'Do it again' : 'Start'}</button>
        <button class="btn btn-ghost" type="button" data-list="${s.key}">${s.blocks.length} exercises</button>
      </div>
      <div class="prog-list" id="prog-list-${s.key}" hidden>${blockListHTML(s)}</div>
    </section>`;
  }
  function nextSessionKey(p, idx) {
    for (let i = idx + 1; i <= p.totalDays; i++) { const s = sessionAt(p, i); if (s && !s.rest) return s.key; }
    return '';
  }
  function blockListHTML(s) {
    const EX = FR.data().EX;
    return `<ol class="plan-list">${s.blocks.map(x => {
      const ex = EX[x.ex]; if (!ex) return '';
      return `<li><button class="linkchip" type="button" data-ex="${esc(ex.id)}">${esc(ex.name)}</button> <span class="small muted">${x.secs}s${ex.sides ? ' each side' : ''}</span></li>`;
    }).join('')}</ol>`;
  }

  function calendarHTML(p, ps, st) {
    return `<div class="prog-cal">${p.weeksData.map(wk => {
      const wSess = wk.days.filter(d => !d.rest);
      const wMin = Math.round(wSess.reduce((a, d) => a + d.secs, 0) / 60);
      return `<div class="prog-wk">
        <div class="prog-wk-label"><b>Week ${wk.n}</b><span class="small muted">${esc(wk.title)}</span><span class="small muted">${wSess.length} session${wSess.length === 1 ? '' : 's'} · ${wMin} min</span></div>
        <div class="prog-days">${wk.days.map(d => {
          const iso = dateFor(ps, d.index);
          const doneOn = ps.completed[d.key];
          const state = d.rest ? 'rest' : doneOn ? 'done' : (!ps.paused && d.index === st.idx) ? 'now' : d.index < st.idx ? 'miss' : 'future';
          const dayName = iso ? WD[parseISO(iso).getDay()] : 'D' + d.day;
          const title = d.rest ? 'Rest day' : `${d.title} · ${Math.round(d.secs / 60)} min${doneOn ? ' · done ' + doneOn : ''}`;
          if (d.rest) return `<div class="prog-day is-rest${!ps.paused && d.index === st.idx ? ' is-today-rest' : ''}" title="Rest day"><span class="prog-day-d">${esc(dayName)}</span><span class="prog-day-mark">·</span></div>`;
          return `<button class="prog-day is-${state}" type="button" data-start-session="${d.key}" title="${esc(title)}" aria-label="Week ${d.week} day ${d.day}, ${esc(title)}">
            <span class="prog-day-d">${esc(dayName)}</span>
            <span class="prog-day-mark">${state === 'done' ? '&#10003;' : Math.round(d.secs / 60)}</span>
          </button>`;
        }).join('')}</div>
      </div>`;
    }).join('')}
    <div class="prog-legend small muted">
      <span><i class="k-now"></i> today</span><span><i class="k-done"></i> done</span><span><i class="k-miss"></i> missed</span><span><i class="k-rest"></i> rest</span>
      <span class="prog-legend-note">Any square starts that session — useful if you want to jump ahead or repeat one.</span>
    </div></div>`;
  }

  const sentence = (t) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  function detailHTML(p) {
    return `<div class="prog-detail">
      <div class="plan-section"><h3>What this is</h3><p>${esc(p.overview)}</p></div>
      <div class="prog-two">
        <div class="plan-section"><h3>Who it is for</h3><p>${esc(p.forWho)}</p></div>
        <div class="plan-section"><h3>Who it is not for</h3><p>${esc(p.notFor)}</p></div>
      </div>
      <div class="plan-section"><h3>Evidence note</h3><p class="small">${esc(p.evidence)}</p></div>
      <div class="prog-rule"><b>${esc(p.rule.split(':')[0])}</b><span>${esc(sentence(p.rule.split(':').slice(1).join(':').trim()))}</span></div>
      <div class="plan-section"><h3>${esc(p.stopTitle)}</h3><ul class="plan-list stop">${p.stop.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
      ${p.note ? `<p class="small muted prog-sub">${esc(p.note)}</p>` : ''}
    </div>`;
  }

  function cardHTML(p, activeId) {
    const isActive = activeId === p.id;
    return `<article class="prog-card${isActive ? ' is-active' : ''}">
      <div class="prog-card-head">
        <div><h3>${esc(p.name)}</h3><span class="tag">${p.weeks} weeks</span> <span class="tag">${esc(p.cadence)}</span> <span class="tag">${p.minLow === p.minHigh ? p.minLow : p.minLow + '&ndash;' + p.minHigh} min</span></div>
        <span class="num prog-mins">${p.weeks}<small>wk</small></span>
      </div>
      <p>${esc(p.tagline)}</p>
      <p class="small muted">${esc(p.forWho)}</p>
      <div class="prog-actions">
        ${isActive ? `<span class="tag tag-course">Active</span>` : ui.confirmSwitch === p.id
          ? `<span class="small">Switch? Your current progress is cleared.</span><button class="btn btn-primary btn-sm" type="button" data-confirm-switch="${p.id}">Yes, switch</button><button class="btn btn-ghost btn-sm" type="button" data-cancel-switch>Cancel</button>`
          : `<button class="btn btn-primary" type="button" data-start-program="${p.id}">${activeId ? 'Switch to this' : 'Start program'}</button>`}
        <button class="btn btn-ghost btn-sm" type="button" data-detail="${p.id}">${ui.openWeek === p.id ? 'Hide the detail' : 'Read the detail'}</button>
      </div>
      ${ui.openWeek === p.id ? detailHTML(p) : ''}
    </article>`;
  }

  function renderPrograms(el) {
    progMount = el;
    buildPrograms();
    const ps = progStore();
    const p = active();
    const head = `<div class="view-head">
      <div><h1>Programs</h1><p>Three multi-week progressions built from the same exercises as the rest of the app. One at a time, a session a day, and the app keeps track of where you are.</p></div>
    </div>`;

    if (!p) {
      el.innerHTML = head + voiceToggleHTML() + `
        <div class="prog-cards">${buildPrograms().map(x => cardHTML(x, null)).join('')}</div>
        <p class="disclaimer">These are general exercise progressions for golfers, not a treatment plan written for you. If you are in a lot of pain, getting worse, or any of the "see someone" signs apply, get assessed by a doctor or physiotherapist first.</p>`;
      wirePrograms(el);
      return;
    }

    const st = stats(p, ps);
    el.innerHTML = head + voiceToggleHTML() + `
      ${todayCardHTML(p, ps, st)}
      <div class="prog-stats">
        <div class="prog-stat"><span class="num">${st.done}<small>/${st.due}</small></span><span class="small muted">sessions done of those due</span></div>
        <div class="prog-stat"><span class="num">${st.pct}<small>%</small></span><span class="small muted">adherence so far</span></div>
        <div class="prog-stat"><span class="num">${st.finished ? p.weeks : st.week}<small>/${p.weeks}</small></span><span class="small muted">current week</span></div>
        <div class="prog-stat"><span class="num">${st.doneAll}<small>/${p.sessionCount}</small></span><span class="small muted">of the whole programme</span></div>
      </div>
      <div class="prog-head2">
        <div><h2>${esc(p.name)}</h2><p class="muted">${esc(p.tagline)}</p></div>
        <div class="prog-actions">
          ${st.finished ? '' : ps.paused ? `<button class="btn" type="button" data-resume>Resume</button>` : `<button class="btn" type="button" data-pause>Pause</button>`}
          <button class="btn btn-ghost" type="button" data-browse>${ui.browse ? 'Hide the other programmes' : 'Switch program'}</button>
        </div>
      </div>
      ${calendarHTML(p, ps, st)}
      ${detailHTML(p)}
      ${ui.browse ? `<div class="prog-cards prog-browse">${buildPrograms().map(x => cardHTML(x, p.id)).join('')}</div>` : ''}
      <div class="prog-actions prog-foot">
        ${ui.confirmLeave
          ? `<span class="small">Leave the programme and clear your progress?</span><button class="btn btn-primary btn-sm" type="button" data-confirm-leave>Yes, leave it</button><button class="btn btn-ghost btn-sm" type="button" data-cancel-leave>Cancel</button>`
          : `<button class="btn btn-ghost btn-sm" type="button" data-leave>Leave this programme</button>`}
      </div>
      <p class="disclaimer">These are general exercise progressions for golfers, not a treatment plan written for you. If you are in a lot of pain, getting worse, or any of the "see someone" signs apply, get assessed by a doctor or physiotherapist first.</p>`;
    wirePrograms(el);
  }

  function wirePrograms(el) {
    const $$ = (s) => Array.from(el.querySelectorAll(s));
    const ps = progStore();
    wireVoice(el, repaintPrograms);
    $$('[data-start-program]').forEach(x => x.addEventListener('click', () => {
      const id = x.dataset.startProgram;
      if (ps.active && ps.active !== id) { ui.confirmSwitch = id; repaintPrograms(); return; }
      startProgram(id); ui = { confirmSwitch: null, confirmLeave: false, openWeek: null, browse: false };
      FR.toast('Programme started. Day one is today.'); repaintPrograms();
    }));
    $$('[data-confirm-switch]').forEach(x => x.addEventListener('click', () => {
      startProgram(x.dataset.confirmSwitch);
      ui = { confirmSwitch: null, confirmLeave: false, openWeek: null, browse: false };
      FR.toast('Switched. Day one is today.'); repaintPrograms();
    }));
    $$('[data-cancel-switch]').forEach(x => x.addEventListener('click', () => { ui.confirmSwitch = null; repaintPrograms(); }));
    $$('[data-detail]').forEach(x => x.addEventListener('click', () => { ui.openWeek = ui.openWeek === x.dataset.detail ? null : x.dataset.detail; repaintPrograms(); }));
    $$('[data-browse]').forEach(x => x.addEventListener('click', () => { ui.browse = !ui.browse; repaintPrograms(); }));
    $$('[data-pause]').forEach(x => x.addEventListener('click', () => {
      ps.paused = true; ps.pausedOn = FR.todayISO(); FR.save(); FR.toast('Paused. Nothing is due until you resume.'); repaintPrograms();
    }));
    $$('[data-resume]').forEach(x => x.addEventListener('click', () => {
      if (ps.pausedOn && ps.startDate) {
        const gap = dayDiff(ps.pausedOn, FR.todayISO());
        if (gap > 0) ps.startDate = shiftISO(ps.startDate, gap);
      }
      ps.paused = false; ps.pausedOn = null; FR.save(); FR.toast('Back on. Picking up where you left off.'); repaintPrograms();
    }));
    $$('[data-leave]').forEach(x => x.addEventListener('click', () => { ui.confirmLeave = true; repaintPrograms(); }));
    $$('[data-cancel-leave]').forEach(x => x.addEventListener('click', () => { ui.confirmLeave = false; repaintPrograms(); }));
    $$('[data-confirm-leave]').forEach(x => x.addEventListener('click', () => {
      ps.active = null; ps.startDate = null; ps.completed = {}; ps.paused = false; ps.pausedOn = null; FR.save();
      ui = { confirmSwitch: null, confirmLeave: false, openWeek: null, browse: false }; repaintPrograms();
    }));
    $$('[data-restart]').forEach(x => x.addEventListener('click', () => { startProgram(ps.active); FR.toast('Round two. Day one is today.'); repaintPrograms(); }));
    $$('[data-start-session]').forEach(x => x.addEventListener('click', () => {
      const p = active(); if (!p) return;
      playSession(p, p.sessions[x.dataset.startSession]);
    }));
    $$('[data-peek]').forEach(x => x.addEventListener('click', () => {
      const p = active(); if (!p || !x.dataset.peek) return;
      playSession(p, p.sessions[x.dataset.peek]);
    }));
    $$('[data-list]').forEach(x => x.addEventListener('click', () => {
      const box = el.querySelector('#prog-list-' + x.dataset.list); if (!box) return;
      box.hidden = !box.hidden;
      x.textContent = box.hidden ? `${(active().sessions[x.dataset.list].blocks.length)} exercises` : 'Hide the list';
    }));
    $$('[data-ex]').forEach(x => x.addEventListener('click', () => FR.openExercise(x.dataset.ex)));
  }

  /* ==========================================================================
     Tempo trainer
     Tour Tempo frame counts at 30 frames a second: backswing three times the
     downswing, whatever the total. 21/7 = 0.70/0.23 s, 24/8 = 0.80/0.27 s,
     27/9 = 0.90/0.30 s.
     ========================================================================== */
  const FRAMES = [
    { id: '21/7', back: 21, down: 7, label: 'Quick', blurb: 'The fast end. Short, brisk backswing.' },
    { id: '24/8', back: 24, down: 8, label: 'Middle', blurb: 'The middle setting, and the one most golfers land on.' },
    { id: '27/9', back: 27, down: 9, label: 'Smooth', blurb: 'The slow end. A good place to start if you feel rushed.' }
  ];
  const frameDef = (id) => FRAMES.find(f => f.id === id) || FRAMES[1];
  const T = { ctx: null, running: false, frames: '24/8', countIn: true, first: 0, next: 0, back: 0, down: 0, gap: 1.9, cycle: 0, timer: null, raf: 0, nodes: [], keepAlive: false };
  const M = { taps: [], result: null, bad: false };

  function ensureCtx() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!T.ctx) T.ctx = new AC();
      if (T.ctx.state === 'suspended' && T.ctx.resume) T.ctx.resume();
      return T.ctx;
    } catch (e) { return null; }
  }
  function tone(ctx, at, freq, dur, vol) {
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(freq, at);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(at); o.stop(at + dur + 0.04);
      T.nodes.push(o);
      o.onended = () => { const i = T.nodes.indexOf(o); if (i >= 0) T.nodes.splice(i, 1); };
    } catch (e) { /* ignore */ }
  }
  function scheduleTempo() {
    const ctx = T.ctx;
    if (!T.running || !ctx) return;
    while (T.next < ctx.currentTime + 0.4) {
      const t = T.next;
      tone(ctx, t, 587, 0.09, 0.16);                       /* takeaway */
      tone(ctx, t + T.back, 784, 0.09, 0.16);              /* top */
      tone(ctx, t + T.back + T.down, 1319, 0.12, 0.22);    /* impact */
      T.next += T.cycle;
    }
  }
  /* The context is created and resumed on the click that starts the beat. If the
     browser still refuses (no gesture, or a policy we cannot see), its clock never
     advances — so check, and say so, rather than sitting on "count in" for ever. */
  function startTempo() {
    const ctx = ensureCtx();
    if (!ctx) { FR.toast('This browser has no Web Audio.'); return; }
    if (ctx.state === 'suspended' && ctx.resume) {
      const go = () => beginTempo(ctx);
      try { const r = ctx.resume(); if (r && r.then) { r.then(go, go); return; } } catch (e) { /* fall through */ }
    }
    beginTempo(ctx);
  }
  function beginTempo(ctx) {
    stopTempo(true);
    const f = frameDef(T.frames);
    T.back = f.back / 30; T.down = f.down / 30; T.cycle = T.back + T.down + T.gap;
    const lead = T.countIn ? 2.0 : 0.3;
    T.first = ctx.currentTime + lead;
    if (T.countIn) for (let i = 3; i > 0; i--) tone(ctx, T.first - i * 0.6, 392, 0.07, 0.09);
    T.next = T.first; T.running = true;
    scheduleTempo();
    T.timer = setInterval(scheduleTempo, 60);
    tempoLoop();
    paintTempoControls();
    const t0 = ctx.currentTime;
    setTimeout(() => {
      if (!T.running || T.ctx !== ctx) return;
      if (ctx.currentTime - t0 < 0.2) { stopTempo(); FR.toast('The browser blocked the audio. Tap start once more.'); }
    }, 900);
  }
  function stopTempo(quiet) {
    T.running = false;
    if (T.timer) { clearInterval(T.timer); T.timer = null; }
    if (T.raf) { cancelAnimationFrame(T.raf); T.raf = 0; }
    T.nodes.slice().forEach(o => { try { o.stop(); } catch (e) { /* already stopped */ } });
    T.nodes.length = 0;
    if (!quiet) paintTempoControls();
  }
  function tempoLoop() {
    T.raf = requestAnimationFrame(() => {
      if (!T.running || !T.ctx) return;
      paintTempoStage();
      tempoLoop();
    });
  }
  function tempoPhase() {
    if (!T.running || !T.ctx) return { name: 'idle', pos: 0 };
    const el = T.ctx.currentTime - T.first;
    if (el < 0) return { name: 'count', pos: 0 };
    const p = el % T.cycle;
    if (p < T.back) return { name: 'back', pos: p / T.back };
    if (p < T.back + T.down) return { name: 'down', pos: (p - T.back) / T.down };
    return { name: 'wait', pos: (p - T.back - T.down) / T.gap };
  }
  function paintTempoStage() {
    const stage = document.getElementById('tempo-stage'); if (!stage) return;
    const ph = tempoPhase();
    stage.dataset.phase = ph.name;
    const dots = stage.querySelectorAll('.tempo-dot');
    const litIndex = ph.name === 'back' ? 0 : ph.name === 'down' ? 1 : ph.name === 'wait' ? 2 : -1;
    dots.forEach((d, i) => d.classList.toggle('is-lit', i === litIndex));
    const fill = stage.querySelector('.tempo-fill');
    if (fill) {
      const f = frameDef(T.frames);
      const total = T.back + T.down;
      let w = 0;
      if (ph.name === 'back') w = (ph.pos * T.back) / total * 100;
      else if (ph.name === 'down') w = (T.back + ph.pos * T.down) / total * 100;
      else if (ph.name === 'wait') w = 100;
      fill.style.width = w.toFixed(1) + '%';
      fill.dataset.phase = ph.name;
    }
    const say = stage.querySelector('.tempo-say');
    if (say) say.textContent = ph.name === 'count' ? 'Count in…' : ph.name === 'back' ? 'Back' : ph.name === 'down' ? 'Down' : T.running ? 'Reset' : 'Ready';
  }
  function paintTempoControls() {
    const el = document.getElementById('tempo-run'); if (!el) return;
    el.innerHTML = T.running
      ? `${FR.icon('pause')} Stop`
      : `${FR.icon('play')} Start the beat`;
    el.setAttribute('aria-pressed', String(T.running));
    const stage = document.getElementById('tempo-stage');
    if (stage && !T.running) {
      stage.dataset.phase = 'idle';
      stage.querySelectorAll('.tempo-dot').forEach(d => d.classList.remove('is-lit'));
      const fill = stage.querySelector('.tempo-fill'); if (fill) fill.style.width = '0%';
      const say = stage.querySelector('.tempo-say'); if (say) say.textContent = 'Ready';
    }
  }

  /* ----- measure ----- */
  function tapTempo() {
    const now = (window.performance && performance.now ? performance.now() : Date.now()) / 1000;
    if (M.taps.length && now - M.taps[M.taps.length - 1] > 5) M.taps = [];
    if (M.taps.length >= 3) M.taps = [];
    M.taps.push(now);
    M.bad = false;
    if (M.taps.length === 3) commitTaps();
    paintMeasure();
  }
  function commitTaps() {
    const a = M.taps[0], b2 = M.taps[1], c = M.taps[2];
    const back = b2 - a, down = c - b2;
    if (back < 0.2 || down < 0.06 || back > 4 || down > 3) { M.bad = true; M.taps = []; return; }
    M.result = { back, down, ratio: back / down, date: FR.todayISO() };
    const prof = FR.profile();
    prof.tempo = { back: Math.round(back * 1000) / 1000, down: Math.round(down * 1000) / 1000, ratio: Math.round(back / down * 100) / 100, date: M.result.date };
    FR.save();
    M.taps = [];
  }
  function verdict(r) {
    const ratio = r.ratio, total = r.back + r.down;
    let head, body;
    if (ratio >= 2.8 && ratio <= 3.2) { head = 'Three to one. Right on it.'; body = 'Your backswing takes about three times as long as your downswing, which is what the tour swings share. Keep it.'; }
    else if (ratio >= 2.5 && ratio < 2.8) { head = 'Close, a shade quick going back.'; body = 'Slightly under 3:1. Usually a takeaway that snatches away. Let the club start slower and keep the transition where it is.'; }
    else if (ratio > 3.2 && ratio <= 3.6) { head = 'Close, a shade quick coming down.'; body = 'Slightly over 3:1. The backswing is long and unhurried and then the transition rushes. Start down with the ground, not the hands.'; }
    else if (ratio < 2.5) { head = 'Quick back, slow down.'; body = 'Well under 3:1. The backswing is hurried relative to the downswing. Practise to the beat at 27/9 and let the takeaway breathe.'; }
    else { head = 'Slow back, snatched down.'; body = 'Well over 3:1. A long, slow backswing followed by a rush from the top is the most common amateur pattern, and it is the one that costs the lower back. Practise to the beat and try to arrive at the top a fraction earlier.'; }
    let pace;
    if (total < 0.85) pace = 'Your total swing is quicker than the fast tour setting.';
    else if (total > 1.35) pace = 'Your total swing is slower than the slow tour setting. Ratio matters more than total, but there is room to be brisker.';
    else pace = 'Your total swing sits in the tour range.';
    return { head, body, pace };
  }
  function nearestFrames(r) {
    const bf = r.back * 30, df = r.down * 30;
    let best = FRAMES[0], d = Infinity;
    FRAMES.forEach(f => { const dist = Math.abs(f.back - bf) + Math.abs(f.down - df) * 3; if (dist < d) { d = dist; best = f; } });
    return { bf: Math.round(bf), df: Math.round(df), best };
  }
  function paintMeasure() {
    const box = document.getElementById('tempo-measure'); if (!box) return;
    box.innerHTML = measureInnerHTML();
    wireMeasure(box);
  }
  function measureInnerHTML() {
    const step = M.taps.length;
    const label = ['Tap at the takeaway', 'Tap at the top', 'Tap at impact'][step] || 'Tap at the takeaway';
    const prof = FR.profile();
    const saved = M.result || (prof.tempo && prof.tempo.back ? prof.tempo : null);
    const dots = [0, 1, 2].map(i => `<i class="tempo-tapdot${i < step ? ' is-on' : ''}"></i>`).join('');
    let res = '';
    if (M.bad) {
      res = `<div class="tempo-result"><b>That did not look like a swing.</b><p class="small muted">Three taps: takeaway, top, impact. If you leave more than five seconds between taps it starts again.</p></div>`;
    } else if (saved) {
      const v = verdict(saved);
      const nf = nearestFrames(saved);
      res = `<div class="tempo-result">
        <div class="tempo-nums">
          <div class="tempo-num"><span class="num">${saved.back.toFixed(2)}<small>s</small></span><span class="small muted">backswing</span></div>
          <div class="tempo-num"><span class="num">${saved.down.toFixed(2)}<small>s</small></span><span class="small muted">downswing</span></div>
          <div class="tempo-num tempo-ratio"><span class="num">${saved.ratio.toFixed(1)}<small>:1</small></span><span class="small muted">your ratio</span></div>
          <div class="tempo-num"><span class="num">${nf.bf}<small>/${nf.df}</small></span><span class="small muted">frames at 30 fps</span></div>
        </div>
        <div class="tempo-verdict"><b>${esc(v.head)}</b><p>${esc(v.body)}</p><p class="small muted">${esc(v.pace)} Closest setting: <b>${esc(nf.best.id)}</b>.${M.result ? '' : ' Measured ' + esc(saved.date) + '.'}</p></div>
        <div class="prog-actions">
          <button class="btn btn-sm" type="button" data-use-frames="${esc(nf.best.id)}">Practise to ${esc(nf.best.id)}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-clear-taps>Measure again</button>
        </div>
      </div>`;
    }
    return `<button class="tempo-tap" type="button" data-tap aria-label="${esc(label)}">
        <span class="tempo-tap-label">${esc(label)}</span>
        <span class="tempo-taps" aria-hidden="true">${dots}</span>
        <span class="small">Tap here or press the spacebar, three times, while you make a swing</span>
      </button>${res}`;
  }
  function wireMeasure(box) {
    const t = box.querySelector('[data-tap]');
    if (t) t.addEventListener('click', tapTempo);
    const c = box.querySelector('[data-clear-taps]');
    if (c) c.addEventListener('click', () => { M.taps = []; M.result = null; M.bad = false; const prof = FR.profile(); delete prof.tempo; FR.save(); paintMeasure(); });
    const u = box.querySelector('[data-use-frames]');
    if (u) u.addEventListener('click', () => { T.frames = u.dataset.useFrames; renderTempo(tempoMount); startTempo(); });
  }

  let tempoMount = null;
  function renderTempo(el) {
    tempoMount = el;
    const f = frameDef(T.frames);
    el.innerHTML = `
      <div class="view-head">
        <div><h1>Tempo</h1><p>The one thing nearly every good swing has in common: the backswing takes about three times as long as the downswing. Not how fast — how the two halves relate.</p></div>
      </div>
      ${voiceToggleHTML()}
      <section class="tempo-model">
        <div class="tempo-model-head">
          <h2>3 to 1</h2>
          <p class="muted">John Novosel's Tour Tempo counted frames of tour swings filmed at 30 frames a second and found the same ratio again and again: three frames of backswing for every one of downswing. Three settings cover almost everyone. The ratio is the finding; the frame numbers are just that ratio at three total speeds.</p>
        </div>
        <div class="tempo-frames" role="group" aria-label="Tempo setting">
          ${FRAMES.map(x => `<button class="tempo-frame chip${x.id === T.frames ? ' on' : ''}" type="button" data-frames="${x.id}" aria-pressed="${x.id === T.frames}">
            <b>${x.id}</b><span class="small">${(x.back / 30).toFixed(2)}s / ${(x.down / 30).toFixed(2)}s</span><span class="small muted">${esc(x.label)}</span>
          </button>`).join('')}
        </div>
        <p class="small muted tempo-blurb">${esc(f.blurb)} Backswing ${(f.back / 30).toFixed(2)} seconds, downswing ${(f.down / 30).toFixed(2)} seconds, ${((f.back + f.down) / 30).toFixed(2)} seconds from takeaway to impact.</p>
      </section>

      <section class="tempo-trainer">
        <h3>Swing to the beat</h3>
        <p class="small muted">Three tones: low at the takeaway, higher at the top, sharp at impact. Make the swing, do not chase the tones — start moving on the first one and let the third arrive as the club does.</p>
        <div class="tempo-stage" id="tempo-stage" data-phase="idle">
          <div class="tempo-track"><i class="tempo-seg tempo-seg-back" style="flex:${f.back}"><span>backswing</span></i><i class="tempo-seg tempo-seg-down" style="flex:${f.down}"><span>down</span></i><div class="tempo-fill"></div></div>
          <div class="tempo-dots" aria-hidden="true"><span class="tempo-dot"></span><span class="tempo-dot"></span><span class="tempo-dot"></span></div>
          <div class="tempo-say" role="status">Ready</div>
        </div>
        <div class="tempo-controls">
          <button class="btn btn-primary btn-lg" type="button" id="tempo-run" aria-pressed="false">${FR.icon('play')} Start the beat</button>
          <button class="chip" type="button" data-countin aria-pressed="${T.countIn}">Count-in</button>
          <a class="btn btn-ghost" href="#lab" data-to-lab>Swing to it in the lab</a>
        </div>
      </section>

      <section class="tempo-measure-wrap">
        <h3>Measure my tempo</h3>
        <p class="small muted">Make a real swing and tap three times: takeaway, top, impact. The spacebar works too, which is easier if the phone is in your pocket and the laptop is on the bench.</p>
        <div id="tempo-measure">${measureInnerHTML()}</div>
      </section>
      <p class="disclaimer">Tempo is a rhythm tool, not a swing lesson. If a change in tempo makes something hurt, that is your body objecting to the change, not to the ratio.</p>`;

    wireVoice(el, () => renderTempo(el));
    el.querySelectorAll('[data-frames]').forEach(x => x.addEventListener('click', () => {
      T.frames = x.dataset.frames;
      const wasRunning = T.running;
      renderTempo(el);
      if (wasRunning) startTempo();
    }));
    const run = el.querySelector('#tempo-run');
    if (run) run.addEventListener('click', () => { if (T.running) stopTempo(); else startTempo(); });
    const ci = el.querySelector('[data-countin]');
    if (ci) ci.addEventListener('click', () => {
      T.countIn = !T.countIn; ci.setAttribute('aria-pressed', String(T.countIn)); ci.classList.toggle('on', T.countIn);
      if (T.running) startTempo();
    });
    const lab = el.querySelector('[data-to-lab]');
    if (lab) lab.addEventListener('click', (e) => {
      e.preventDefault();
      T.keepAlive = T.running;
      if (T.running) FR.toast('The beat keeps running. Come back to Tempo to stop it.');
      FR.navigate('#lab');
    });
    wireMeasure(el.querySelector('#tempo-measure'));
    paintTempoControls();
  }

  /* Spacebar taps, only on the tempo view and only when nothing else owns the key. */
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (FR.route() !== 'tempo') return;
    if (document.getElementById('player') || document.getElementById('modal')) return;
    const t = e.target;
    if (t && t.matches && t.matches('input, textarea, select')) return;
    if (t && t.closest && t.closest('button, a') && !(t.closest('[data-tap]'))) return;
    e.preventDefault();
    tapTempo();
  });

  /* Leaving tempo stops the beat, unless it was sent to the lab on purpose. */
  FR.on('route', (r) => {
    if (r === 'tempo') { T.keepAlive = false; return; }
    if (T.keepAlive && r === 'lab') return;
    T.keepAlive = false;
    if (T.running) stopTempo(true);
  });

  /* ==========================================================================
     Registration + debug hooks
     ?program=elbow|flare|speed&day=12&done=8   seed an active programme
     ?program=none                             clear it
     ?tempo=21|24|27                           preselect a setting
     ?tapdemo=1                                seed a measured tempo
     ?voice=on|off                             set the voice coach
     ========================================================================== */
  FR.registerView('programs', {
    render(el) { renderPrograms(el); },
    nav: { label: 'Programs', after: 'routines', primary: false, icon: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8.5 14.5l2 2 4-4"/></svg>' }
  });
  FR.registerView('tempo', {
    render(el) { renderTempo(el); },
    nav: { label: 'Tempo', after: 'programs', primary: false, icon: '<svg viewBox="0 0 24 24"><path d="M9.5 3h5l3.5 18H6z"/><path d="M7.4 15h9.2"/><path d="M12 20l4.5-12"/></svg>' }
  });

  /* Debug surface: lets a script or the console inspect the schedules without
     going through the DOM. Read-only, no behaviour of its own. */
  window.FRPrograms = { all: buildPrograms, stats, sessionAt, store: progStore, frames: FRAMES, verdict, tempo: T, taps: M };

  FR.on('boot', () => {
    let qs;
    try { qs = new URLSearchParams(location.search); } catch (e) { return; }
    const v = qs.get('voice');
    if (v) { settings().voice = v !== 'off' && v !== '0'; FR.save(); }
    const tf = qs.get('tempo');
    if (tf) { const hit = FRAMES.find(f => f.id === tf || String(f.back) === tf); if (hit) T.frames = hit.id; }
    if (qs.get('tapdemo')) {
      M.result = { back: 0.86, down: 0.24, ratio: 0.86 / 0.24, date: FR.todayISO() };
    }
    const pid = qs.get('program');
    if (!pid) return;
    const ps = progStore();
    if (pid === 'none') { ps.active = null; ps.startDate = null; ps.completed = {}; ps.paused = false; ps.pausedOn = null; FR.save(); return; }
    const p = programById(pid);
    if (!p) return;
    const day = Math.max(1, Math.min(p.totalDays + 1, parseInt(qs.get('day') || '1', 10) || 1));
    ps.active = p.id;
    ps.startDate = shiftISO(FR.todayISO(), -(day - 1));
    ps.completed = {};
    ps.paused = qs.get('paused') === '1';
    ps.pausedOn = ps.paused ? FR.todayISO() : null;
    const wanted = parseInt(qs.get('done') || '0', 10) || 0;
    if (wanted > 0) {
      let n = 0;
      for (let i = 1; i <= p.totalDays && n < wanted; i++) {
        const s = sessionAt(p, i);
        if (!s || s.rest) continue;
        ps.completed[s.key] = shiftISO(ps.startDate, i - 1);
        n++;
      }
    }
    FR.save();
  });
})();

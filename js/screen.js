/* Free Relief — mobility screen
   A TPI-style physical screen, cut down so a golfer can run it alone at home with a phone.

   Six tests, each scored pass / limited / fail (or skipped if it hurts). Out of them come
   three numbers the rest of the app reads from the profile:
     score     0..100, weighted towards the three tests that decide how much of the turn
               comes from the hips and ribs rather than the lumbar spine
     hipIR     hip internal rotation as a fraction of normal (1 = full, 0.5 = clearly limited)
     thoracic  mid-back rotation on the same 0..1 scale
   The 3D lab uses hipIR and thoracic to drive the avatar; the plan uses the score and the
   individual test results.

   Debug hooks (query string, no effect when absent):
     ?screenstep=3   jump straight to test 3 (1..6, or 0 for the intro)
     ?screendone=1   fill in a demo set of answers and show the results
     ?screensaved=1  seed a saved result and some history to show the re-screen view          */

(() => {
  'use strict';

  /* score value of each answer */
  const VALUE = { pass: 1, limited: 0.5, fail: 0 };
  /* range estimate of each answer. A failed test is a limit, not an absence of movement,
     so the hip and mid-back estimates floor out around a third of normal rather than at zero. */
  const RANGE = { pass: 1, limited: 0.6, fail: 0.32 };
  const LABEL = { pass: 'Passed', limited: 'Limited', fail: 'Failed', skip: 'Skipped' };

  const TESTS = [
    {
      id: 'pelvicRotation',
      name: 'Pelvic rotation',
      short: 'Pelvis',
      pose: 'hinge',
      weight: 22,
      gear: 'A mirror or a propped-up phone',
      why: 'The backswing is a separation: the pelvis turns under a chest that holds, then the chest turns over it. If the pelvis will not move on its own, the lumbar spine becomes the hinge instead of the hips — and it only has about 10 degrees to give.',
      setup: [
        'Stand in your golf posture: knees soft, hips back, chest out over the ball line.',
        'Fold your arms across your chest. Head and shoulders stay dead still.',
        'Prop your phone up in front of you, or use a mirror, so you can see the cheating.'
      ],
      doIt: [
        'Turn only your belt buckle to the right, as far as it will go, then to the left.',
        'The shoulders stay square to the ball line and the knees stay where they started.',
        'Three slow reps each way. Rushing hides the fault.'
      ],
      look: 'How far the belt line turns before the shoulders, head or knees get dragged along with it.',
      criteria: {
        pass: 'Smooth turn both ways, roughly a fist-width of hip travel each side, shoulders and head still.',
        limited: 'It moves, but the range is small, one side clearly beats the other, or the shoulders start to follow.',
        fail: 'The pelvis will not go on its own — the whole body turns as one block, or you cannot find the movement at all.'
      },
      impact: 'Your pelvis and chest move as one block, so the swing has no separation to work with. The turn still has to happen, and the lumbar spine is the joint that gives.'
    },
    {
      id: 'torsoRotation',
      name: 'Torso rotation',
      short: 'Torso',
      pose: 'standClub',
      weight: 22,
      gear: 'A chair and a club',
      why: 'This is the turn the swing is meant to come from. The thoracic spine has around 35 degrees of rotation, the lumbar spine about 13. When the chest will not turn, the lower back borrows the difference on every single swing.',
      setup: [
        'Sit on the front half of a chair, feet flat, knees together — sitting locks the pelvis for you.',
        'Rest a club across the front of your shoulders and hold it there with both hands.',
        'Sit tall, chin level, weight even on both sit bones.'
      ],
      doIt: [
        'Turn your chest to the right as far as it goes, without the knees or hips moving.',
        'Hold a second, come back to the middle, then the same to the left.',
        'Squeeze a headcover between your knees if the hips keep trying to help.'
      ],
      look: 'How far round the club goes before the knees swing round with you.',
      criteria: {
        pass: 'About 45 degrees or more each way — the club points well past your knee line — with the knees still.',
        limited: 'Somewhere between 30 and 45 degrees, or one side noticeably shorter than the other.',
        fail: 'Under about 30 degrees, or the hips and knees have to come round to get you there.'
      },
      impact: 'Your mid back supplies less of the turn, so the lower back makes up the difference — every swing, every hole, for four hours.'
    },
    {
      id: 'overheadSquat',
      name: 'Overhead deep squat',
      short: 'Squat',
      pose: 'squatTee',
      weight: 14,
      gear: 'A club, bare feet',
      why: 'One move that asks the ankles, hips, mid back and shoulders to work together. It is the closest thing here to a whole-body MOT, and it shows whether you can hold your posture while the legs are loaded — which is what the downswing asks for.',
      setup: [
        'Bare feet, shoulder-width apart, toes pointing straight ahead.',
        'Hold a club overhead with straight arms, hands wide, the club above the crown of your head.'
      ],
      doIt: [
        'Squat down slowly, as deep as you can, heels flat and the club still above your head.',
        'Stand back up. Three reps, and judge the best one.'
      ],
      look: 'The heels, the club and the low back — whichever gives up first is your limit.',
      criteria: {
        pass: 'Thighs get below parallel, heels stay down, club stays over the head, back stays long.',
        limited: 'You reach about parallel, or the heels lift, the club drifts forward, or the back rounds at the bottom.',
        fail: 'Nowhere near parallel, you fall backwards, or the club ends up out in front of your face.'
      },
      impact: 'You lose posture as soon as the legs are loaded, so your spine angle changes mid-swing. That is the classic route to a sore back and inconsistent contact.'
    },
    {
      id: 'toeTouch',
      name: 'Toe touch',
      short: 'Toe touch',
      pose: 'hamstringStand',
      weight: 10,
      gear: 'Nothing, bare feet',
      why: 'A toe touch shares one movement between the spine, the hips and the hamstrings. Golfers who cannot touch their toes usually reach address by rounding the lower back instead of hinging at the hips, then stay there for eighteen holes.',
      setup: [
        'Bare feet, heels and toes together.',
        'Stand somewhere clear — no coffee table in front of you.'
      ],
      doIt: [
        'Reach slowly down towards your toes, knees straight, chin tucked to your chest.',
        'Go to a comfortable end range, not a heroic one. No bouncing.'
      ],
      look: 'Where the fingertips stop, and whether one part of the back refuses to bend.',
      criteria: {
        pass: 'Fingertips reach the toes with the knees straight, and the back rounds evenly from top to bottom.',
        limited: 'You get to mid-shin or the ankle bone, or the knees have to soften to get there.',
        fail: 'Below the knee is as far as it goes, or a flat segment of the back will not bend at all.'
      },
      impact: 'You reach the ball by rounding the lower back rather than hinging at the hips, so the back starts the round already loaded.'
    },
    {
      id: 'singleLegBalance',
      name: 'Single-leg balance',
      short: 'Balance',
      pose: 'legSwing',
      weight: 10,
      timer: true,
      gear: 'A wall to catch yourself on, bare feet',
      why: 'Every swing spends time on one leg, and the move from trail leg to lead leg is a balance skill before it is a power skill. Poor balance turns up as a slide, as early extension, or as a trunk that braces hard just to keep you upright.',
      setup: [
        'Stand near a wall or a worktop you can touch if you wobble — but do not hold it.',
        'Bare feet on a firm floor. Carpet flatters you.'
      ],
      doIt: [
        'Lift one foot until the thigh is about level with the floor, hands on hips, eyes open.',
        'Hold for 25 seconds, then do the other leg.',
        'If both are easy, try 10 seconds with your eyes closed. That one is the real test.'
      ],
      look: 'Wobble, a foot that keeps touching down, and the difference between your two legs.',
      criteria: {
        pass: '25 seconds on each leg with the eyes open and barely a wobble — and around 10 seconds with the eyes shut.',
        limited: 'You make 25 seconds but wobble hard or touch down, or one leg is much worse than the other.',
        fail: 'You cannot hold 25 seconds on one or both legs.'
      },
      impact: 'Weight transfer costs you control, so the trunk stiffens to keep you upright and the swing shortens to stay safe.'
    },
    {
      id: 'hip9090',
      name: '90/90 hip rotation',
      short: 'Hips',
      pose: 'seated9090',
      weight: 22,
      gear: 'A firm chair',
      why: 'Hip internal rotation is the most golf-specific number on this list. The trail hip has to rotate inwards on the backswing and the lead hip through impact — about 45 degrees each. When the hip runs out, the pelvis and the lumbar spine keep going without it.',
      setup: [
        'Sit tall on a firm chair, thighs together, knees bent to a right angle, feet flat.',
        'Hands on your knees to stop the pelvis rocking and hide the fault.'
      ],
      doIt: [
        'Keep the knee where it is and swing that foot out to the side as far as it goes — the shin sweeps out, the thigh rolls inwards. That is internal rotation.',
        'Note where it stops, bring it back, then do the other leg and compare the two.'
      ],
      look: 'How far the foot travels, whether the pelvis lifts to help, and how different the two sides are.',
      criteria: {
        pass: 'The shin swings out to about 45 degrees on both sides — roughly a foot and a half of foot travel — with the pelvis still.',
        limited: 'It travels a fair way but stops well short of 45, or one hip is clearly tighter than the other.',
        fail: 'Barely any movement, a hard block, or the pelvis has to lift off the chair to get any at all.'
      },
      impact: 'Your hips supply less of the turn, so the lower back makes up the difference. It also shows up as a slide off the ball and as early extension through impact.'
    }
  ];

  const T = Object.fromEntries(TESTS.map(t => [t.id, t]));
  const TOTAL_WEIGHT = TESTS.reduce((s, t) => s + t.weight, 0);

  const BANDS = [
    { min: 85, label: 'Golf-ready', note: 'Nothing here is asking your lower back to cover for a stiff joint. Keep it that way — mobility is a use-it-or-lose-it account.' },
    { min: 70, label: 'Good, with one weak link', note: 'Most of your turn comes from where it should. Fix the one or two limits below and your back stops paying for them.' },
    { min: 50, label: 'Clear limits', note: 'Enough is restricted that your swing is already borrowing range from the lumbar spine. This is the most common place for a golfer with a sore back to start.' },
    { min: 0, label: 'A lot to gain', note: 'Several joints are not doing their share, and the back is covering for all of them. The good news: this is the profile that improves fastest.' }
  ];

  /* ---------- state (memory only until the golfer taps Save) ---------- */
  const state = { stage: null, i: 0, answers: {}, debug: false, focus: false };
  const timer = { id: null, key: null, left: 0, total: 0, held: {} };
  let root = null, FR = null, keysBound = false;

  const esc = (s) => (FR ? FR.esc(s) : String(s));
  const saved = () => { const p = FR.profile(); return p && p.mobility && p.mobility.score != null ? p.mobility : null; };
  const answered = () => TESTS.filter(t => state.answers[t.id]).length;
  const fig = (pose, label, size) => (typeof figureSVG === 'function' ? figureSVG(pose, { size: size || 150, label }) : '');

  function daysSince(iso) {
    if (!iso) return null;
    const then = new Date(iso + 'T12:00:00'), now = new Date();
    return Math.round((now - then) / 86400000);
  }
  function whenText(iso) {
    const d = daysSince(iso);
    if (d == null) return '';
    if (d <= 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 28) return d + ' days ago';
    const m = Math.round(d / 30);
    return m <= 1 ? 'about a month ago' : 'about ' + m + ' months ago';
  }
  function dueText(iso) {
    const d = daysSince(iso);
    if (d == null) return '';
    const left = 28 - d;
    if (left <= 0) return 'Due for a re-screen';
    return 'Re-screen in ' + left + ' day' + (left === 1 ? '' : 's');
  }

  /* ---------- the model ---------- */
  function compute(a) {
    let num = 0, den = 0, skipped = [];
    TESTS.forEach(t => {
      const v = a[t.id];
      if (v === 'skip') { skipped.push(t.id); return; }
      if (!v) return;
      num += t.weight * VALUE[v]; den += t.weight;
    });
    const score = den ? Math.round(100 * num / den) : 0;

    /* an estimate blends the tests that actually load that joint, and renormalises
       over whatever was not skipped, so one skipped test does not read as a failure */
    const est = (parts, fallback) => {
      let n = 0, d = 0;
      parts.forEach(([id, w]) => { const v = a[id]; if (!v || v === 'skip') return; n += w * RANGE[v]; d += w; });
      return d ? Math.round((n / d) * 100) / 100 : fallback;
    };
    const hipIR = est([['hip9090', 0.6], ['pelvicRotation', 0.25], ['overheadSquat', 0.15]], 0.8);
    const thoracic = est([['torsoRotation', 0.7], ['overheadSquat', 0.3]], 0.8);

    const band = BANDS.find(b => score >= b.min) || BANDS[BANDS.length - 1];
    const limits = TESTS.filter(t => a[t.id] === 'limited' || a[t.id] === 'fail');
    const passes = TESTS.filter(t => a[t.id] === 'pass');
    const coverage = Math.round(100 * den / TOTAL_WEIGHT);
    return { score, hipIR, thoracic, band, limits, passes, skipped, coverage, done: den > 0 };
  }

  /* pick the routine that answers the biggest limit, and say why in one line */
  function recommend(a, hipIR, thoracic) {
    const bal = a.singleLegBalance;
    const cands = [
      {
        id: 'tspine', deficit: 1 - thoracic,
        why: 'Your mid back is the tightest link. This one is six minutes of rotation work for the ribs, so the turn stops coming out of the lumbar spine.'
      },
      {
        id: 'daily', deficit: Math.max(1 - hipIR, a.toeTouch === 'fail' ? 0.3 : a.toeTouch === 'limited' ? 0.18 : 0),
        why: 'Your hips are the limit. This routine opens the hips and teaches the trunk to hold still while they move — the exact swap your back needs.'
      },
      {
        id: 'strength', deficit: bal === 'fail' ? 0.62 : bal === 'limited' ? 0.34 : 0.04,
        why: 'Balance and single-leg control are your weak link. Strength work on the glutes, legs and trunk is what fixes that, twice a week.'
      }
    ];
    cands.sort((x, y) => y.deficit - x.deficit);
    const top = cands[0];
    if (top.deficit < 0.12) {
      return { id: 'strength', why: 'Nothing is holding your swing back today, so the job is keeping it. Twice a week of strength work protects the range you already have.' };
    }
    return top;
  }

  /* ---------- small pieces ---------- */
  /* the profile carries fractions of normal (0..1). Be forgiving about a value that arrives
     as a percentage or a raw angle from somewhere else, so a bad number cannot draw a 3400% bar. */
  function frac(v) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return 0;
    if (n <= 1) return n;
    if (n <= 100) return n / 100;
    return 1;
  }

  function meter(label, value, hint) {
    value = frac(value);
    const pct = Math.round(value * 100);
    const tone = value >= 0.85 ? 'ok' : value >= 0.6 ? 'warn' : 'stop';
    return `<div class="screen-meter screen-${tone}">
      <div class="screen-meter-head"><b>${esc(label)}</b><span class="num">${pct}<small>%</small></span></div>
      <div class="screen-meter-bar" role="img" aria-label="${esc(label)}: ${pct} percent of normal range"><i style="width:${Math.max(4, Math.min(100, pct))}%"></i></div>
      <p class="small muted">${esc(hint)}</p>
    </div>`;
  }

  /* The sparkline is drawn at the real pixel width, like the round-log chart, so the dots stay
     round and 10px text stays 10px on a phone. Scores cluster in a narrow band, so the y-axis
     follows the data (at least a 30-point window) and both ends are labelled. */
  function sparkSVG(history, width) {
    const pts = (history || []).slice(-12);
    if (!pts.length) return '';
    const W = Math.round(width || 280), H = 74, pad = 8, padB = 20, iw = W - pad * 2, ih = H - pad - padB;
    const vals = pts.map(p => p.score);
    const lo0 = Math.min.apply(null, vals), hi0 = Math.max.apply(null, vals);
    const span = Math.max(30, hi0 - lo0 + 14);
    let lo = Math.max(0, Math.min(lo0 - (span - (hi0 - lo0)) / 2, 100 - span));
    const hi = Math.min(100, lo + span); lo = Math.max(0, hi - span);
    const x = (i) => pts.length === 1 ? W / 2 : pad + (i / (pts.length - 1)) * iw;
    const y = (v) => pad + ih - ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * ih;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.score).toFixed(1)).join(' ');
    const area = pts.length > 1 ? `<path class="screen-spark-area" d="${d} L${x(pts.length - 1).toFixed(1)} ${(pad + ih).toFixed(1)} L${x(0).toFixed(1)} ${(pad + ih).toFixed(1)} Z"/>` : '';
    const dots = pts.map((p, i) => `<circle class="screen-spark-dot${i === pts.length - 1 ? ' on' : ''}" cx="${x(i).toFixed(1)}" cy="${y(p.score).toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 2.8}"/>`).join('');
    const first = pts[0], last = pts[pts.length - 1];
    const ends = pts.length > 1
      ? `<text class="screen-spark-lbl" x="${pad}" y="${H - 6}">${first.score} · ${esc(whenText(first.date))}</text>
         <text class="screen-spark-lbl on" x="${W - pad}" y="${H - 6}" text-anchor="end">${last.score} · ${esc(whenText(last.date))}</text>`
      : `<text class="screen-spark-lbl on" x="${W / 2}" y="${H - 6}" text-anchor="middle">${last.score} · first screen</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Mobility score history: ${pts.map(p => p.score).join(', ')}">
      <line class="screen-spark-base" x1="${pad}" x2="${W - pad}" y1="${(pad + ih).toFixed(1)}" y2="${(pad + ih).toFixed(1)}"/>
      ${area}<path class="screen-spark-line" d="${d}"/>${dots}${ends}</svg>`;
  }

  function sparkline(history) {
    const pts = (history || []).slice(-12);
    if (!pts.length) return '';
    const delta = pts.length > 1 ? pts[pts.length - 1].score - pts[0].score : 0;
    state.spark = pts;
    return `<div class="screen-spark"><div id="screen-spark-svg"></div>
      <span class="small muted">${pts.length} screen${pts.length === 1 ? '' : 's'}${pts.length > 1 ? (delta === 0 ? ', level' : ', ' + (delta > 0 ? 'up ' : 'down ') + Math.abs(delta) + ' point' + (Math.abs(delta) === 1 ? '' : 's')) : ''}</span></div>`;
  }

  function stepBar() {
    return `<ol class="screen-steps" aria-label="Screen progress">${TESTS.map((t, i) => {
      const a = state.answers[t.id];
      const cls = i === state.i ? 'on' : a ? 'done ' + (a === 'skip' ? 'skip' : a) : '';
      return `<li><button type="button" class="screen-stepdot ${cls}" data-goto="${i}" aria-current="${i === state.i}"
        aria-label="Test ${i + 1}: ${esc(t.name)}${a ? ' — ' + LABEL[a] : ''}"><span>${i + 1}</span><em>${esc(t.short)}</em></button></li>`;
    }).join('')}</ol>`;
  }

  /* ---------- views ---------- */
  function viewIntro() {
    const last = saved();
    const resume = answered() > 0 && answered() < TESTS.length;
    return `<div class="view-head">
        <div>
          <h1>Mobility screen</h1>
          <p>Six tests, about five minutes, done alone in your living room. It finds the joints that have stopped doing their share — because whatever they stop doing, your lower back picks up.</p>
        </div>
        ${last ? `<p class="small muted">Last screened ${esc(whenText(last.date))} · scored ${last.score}</p>` : ''}
      </div>
      <div class="screen-intro">
        <div class="screen-card screen-intro-main">
          <h3>What happens</h3>
          <p>You do one test at a time. Each screen tells you how to set it up, what to do, and exactly what a pass, a limit and a fail look like — you mark your own result. Nothing is timed except the balance test, which has a timer built in.</p>
          <p>At the end you get a mobility score, an estimate of how much turn your hips and mid back can actually supply, and a routine aimed at whatever came out worst. You can push the result onto the 3D swing avatar and watch what your own limits do to the load on your spine.</p>
          <h3 class="screen-mt">What you need</h3>
          <ul class="screen-need">
            <li><b>A wall</b><span>Something to catch yourself on during the balance test.</span></li>
            <li><b>A chair</b><span>Firm, no arms — a dining chair. Two of the tests are seated.</span></li>
            <li><b>A club</b><span>Any iron. Used overhead and across the shoulders.</span></li>
            <li><b>Bare feet and a mirror</b><span>Or a phone propped up where you can see yourself.</span></li>
          </ul>
        </div>
        <div class="screen-card screen-intro-side">
          <div class="screen-facts">
            <div><span class="num">5</span><span class="small">minutes</span></div>
            <div><span class="num">6</span><span class="small">tests</span></div>
            <div><span class="num">4</span><span class="small">weeks between</span></div>
          </div>
          <p class="small">Mobility changes slowly. Screen again every four weeks — often enough to see the work paying off, far enough apart that you are not measuring noise.</p>
          <div class="screen-safety">
            <h4>Before you start</h4>
            <p>Move slowly and stay inside comfortable range. If a test hurts, stop it and tap <b>Skip — this hurts</b>; the score is worked out from the tests you did do.</p>
            <p>This is a movement screen, not a diagnosis. It cannot see a disc, a nerve or a joint. Pain that shoots down a leg, will not settle, or wakes you at night belongs with a doctor or physiotherapist, not an app.</p>
          </div>
          ${resume
            ? `<button class="btn btn-primary btn-lg screen-go" type="button" data-act="resume">Resume — ${answered()} of ${TESTS.length} done</button>
               <button class="btn btn-ghost" type="button" data-act="start">Start over</button>`
            : `<button class="btn btn-primary btn-lg screen-go" type="button" data-act="start">Start the screen</button>`}
          ${last ? `<button class="btn btn-ghost" type="button" data-act="summary">Back to my last result</button>` : ''}
        </div>
      </div>`;
  }

  function viewTest() {
    const t = TESTS[state.i];
    const a = state.answers[t.id];
    const choice = (key, title) => `<button class="screen-choice screen-${key}" type="button" data-pick="${key}" aria-pressed="${a === key}">
        <span class="screen-choice-key" aria-hidden="true">${key === 'pass' ? FR.icon('check') : key === 'limited' ? '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>' : FR.icon('x')}</span>
        <span class="screen-choice-txt"><b>${title}</b><span class="small">${esc(t.criteria[key])}</span></span>
      </button>`;
    return `<div class="view-head screen-head">
        <div>
          <p class="screen-eyebrow small">Test ${state.i + 1} of ${TESTS.length}${t.timer ? ' · timed' : ''}</p>
          <h1 tabindex="-1" id="screen-title">${esc(t.name)}</h1>
          <p>${esc(t.why)}</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-act="quit">${FR.icon('x')} Leave the screen</button>
      </div>
      ${stepBar()}
      <div class="screen-test">
        <div class="screen-card screen-how">
          <div class="screen-fig">${fig(t.pose, t.name, 190)}<span class="tag">${esc(t.gear)}</span></div>
          <div class="screen-how-txt">
            <h4>Set it up</h4>
            <ol class="screen-list">${t.setup.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
            <h4>Do this</h4>
            <ol class="screen-list">${t.doIt.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
            <p class="screen-look"><b>Watch for:</b> ${esc(t.look)}</p>
          </div>
        </div>
        <div class="screen-card screen-answer">
          ${t.timer ? timerBlock() : ''}
          <h4>How did it go?</h4>
          <p class="small muted">Be honest — a soft pass here just hides the thing that is hurting your back.</p>
          <div class="screen-choices">${choice('pass', 'Passed')}${choice('limited', 'Limited')}${choice('fail', 'Failed')}</div>
          <button class="screen-skip ${a === 'skip' ? 'on' : ''}" type="button" data-pick="skip" aria-pressed="${a === 'skip'}">Skip — this hurts</button>
          <div class="screen-nav">
            <button class="btn btn-ghost" type="button" data-act="prev" ${state.i === 0 ? 'disabled' : ''}>${FR.icon('prev')} Back</button>
            <button class="btn btn-primary" type="button" data-act="next" ${a ? '' : 'disabled'}>${state.i === TESTS.length - 1 ? 'See my results' : 'Next test'} ${FR.icon('next')}</button>
          </div>
          <p class="small muted screen-keys">Keyboard: <b>1</b> passed, <b>2</b> limited, <b>3</b> failed, <b>S</b> skip, arrow keys to move.</p>
        </div>
      </div>`;
  }

  function timerBlock() {
    const legs = [
      { key: 'left', label: 'Left leg', secs: 25, note: 'eyes open' },
      { key: 'right', label: 'Right leg', secs: 25, note: 'eyes open' },
      { key: 'closed', label: 'Eyes closed', secs: 10, note: 'optional' }
    ];
    return `<div class="screen-timer" id="screen-timer">
      <div class="screen-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="screen-ring-track" cx="60" cy="60" r="52"/>
          <circle class="screen-ring-arc" id="screen-arc" cx="60" cy="60" r="52" stroke-dasharray="326.7" stroke-dashoffset="0" transform="rotate(-90 60 60)"/>
        </svg>
        <span class="num" id="screen-count" role="timer" aria-live="off">25</span>
      </div>
      <div class="screen-timer-side">
        <h4>Hold timer</h4>
        <div class="chips screen-timer-chips">${legs.map(l => `<button class="chip" type="button" data-timer="${l.key}" data-secs="${l.secs}">${l.label} <small>${l.secs}s ${l.note}</small></button>`).join('')}</div>
        <p class="small muted" id="screen-timer-msg">Pick a leg, then stand up straight and tap it. Tap again to stop the moment you have to grab something.</p>
      </div>
    </div>`;
  }

  function viewResults(readonly) {
    const a = state.answers;
    const r = compute(a);
    const rec = recommend(a, r.hipIR, r.thoracic);
    const D = FR.data();
    const routine = D.ROUTINE[rec.id] || D.ROUTINES[0];
    const rSecs = routine.steps.reduce((s, st) => s + st.secs * (D.EX[st.ex] && D.EX[st.ex].sides ? 2 : 1), 0);
    const last = saved();
    const prev = last && last.history && last.history.length > 1 ? last.history[last.history.length - 2] : null;
    return `<div class="view-head">
        <div>
          <p class="screen-eyebrow small">${readonly ? 'Screened ' + esc(whenText(last && last.date)) : 'Screen complete'}</p>
          <h1 tabindex="-1" id="screen-title">${esc(r.band.label)}</h1>
          <p>${esc(r.band.note)}</p>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" data-act="restart">Screen again</button>
      </div>
      <div class="screen-results">
        <div class="screen-col">
        <div class="screen-card screen-scorecard">
          <div class="screen-score">
            <span class="num">${r.score}</span>
            <span class="small muted">mobility score<br>out of 100</span>
          </div>
          ${prev ? `<p class="small ${r.score >= prev.score ? 'screen-up' : 'screen-down'}">${r.score === prev.score ? 'Level with your last screen.' : (r.score > prev.score ? '+' + (r.score - prev.score) + ' since your last screen.' : (r.score - prev.score) + ' since your last screen.')}</p>` : ''}
          ${r.coverage < 100 ? `<p class="small muted">Worked out from the ${TESTS.length - r.skipped.length} tests you did. ${r.skipped.length} skipped.</p>` : ''}
          <p class="small muted screen-weighting"><b>How it is weighted.</b> Pelvic rotation, torso rotation and the 90/90 are two thirds of the score between them, because those three decide how much of the turn comes from the hips and the ribs — and therefore how much your lower back has to find. The squat is worth about half of one of those, and the toe touch and the balance test fill in the picture.</p>
        </div>
        <div class="screen-card screen-findings-card">
          <h3>${r.limits.length ? 'What is limited, and what it costs you' : 'Nothing came out limited'}</h3>
          ${r.limits.length ? `<ul class="screen-findings">${r.limits.map(t => `<li class="screen-${a[t.id]}">
              <div class="screen-finding-head"><b>${esc(t.name)}</b><span class="tag screen-tag-${a[t.id]}">${LABEL[a[t.id]]}</span></div>
              <p class="small">${esc(t.impact)}</p></li>`).join('')}</ul>`
            : `<p class="small">Every test you completed came back clean. Your hips and mid back are supplying the turn, so the lumbar spine is only being asked for the 10 degrees it has. Screen again in four weeks.</p>`}
          ${r.passes.length ? `<p class="small muted screen-passes">Passed: ${r.passes.map(t => esc(t.name)).join(', ')}.</p>` : ''}
          ${r.skipped.length ? `<p class="small muted">Skipped because it hurt: ${r.skipped.map(id => esc(T[id].name)).join(', ')}. Pain in a screening test is worth mentioning to a physio.</p>` : ''}
        </div>
        </div>
        <div class="screen-col">
        <div class="screen-card screen-estimates">
          <h3>What your joints can supply</h3>
          ${meter('Hip internal rotation', r.hipIR, r.hipIR >= 0.85 ? 'Both hips can turn in under you. The backswing and the follow-through have somewhere to go.' : 'Below normal. Range the hips do not give has to come from the pelvis and the spine instead.')}
          ${meter('Mid-back rotation', r.thoracic, r.thoracic >= 0.85 ? 'The ribs are doing their share of the turn — which is the point.' : 'Below normal. The lumbar spine, with about 10 degrees to its name, is covering the shortfall.')}
          <button class="btn" type="button" data-act="lab">See it on the 3D body</button>
          <p class="small muted">Saves your result, then loads it onto the swing avatar so you can watch the load move.</p>
        </div>
        <div class="screen-card screen-rec">
          <h3>Start here</h3>
          <div class="screen-rec-head"><div><b>${esc(routine.name)}</b><span class="tag ${routine.where === 'course' ? 'tag-course' : ''}">${routine.where === 'course' ? 'At the course' : 'At home'}</span></div><span class="num">${Math.round(rSecs / 60)}<small>min</small></span></div>
          <p class="small">${esc(rec.why)}</p>
          <div class="screen-rec-figs" aria-hidden="true">${routine.steps.slice(0, 6).map(st => fig(D.EX[st.ex].pose, D.EX[st.ex].name, 44)).join('')}</div>
          <div class="screen-actions">
            <button class="btn btn-primary" type="button" data-act="routine" data-routine="${routine.id}">${FR.icon('play')} Start ${esc(routine.name)}</button>
            ${readonly ? '' : `<button class="btn" type="button" data-act="save">${FR.icon('check')} Save results</button>`}
          </div>
          ${readonly ? '<p class="small muted">Saved to your profile. The plan and the 3D lab are already using it.</p>' : '<p class="small muted">Saving keeps the result on this device, adds it to your history, and lets the rest of the app use it.</p>'}
        </div>
        </div>
      </div>
      <p class="disclaimer">A movement screen is not a diagnosis. It tells you where you are stiff, not what is wrong with you. Pain that travels down a limb, does not settle with rest, or wakes you at night needs a doctor or physiotherapist.</p>`;
  }

  function viewSummary() {
    const m = saved();
    if (!m) { state.stage = 'intro'; return viewIntro(); }
    state.answers = Object.assign({}, m.tests || {});
    (m.skipped || []).forEach(id => { state.answers[id] = 'skip'; });
    const hist = m.history || [];
    const r = compute(state.answers);
    return `<div class="view-head">
        <div>
          <p class="screen-eyebrow small">Screened ${esc(whenText(m.date))} · ${esc(dueText(m.date))}</p>
          <h1>Your mobility</h1>
          <p>${esc(r.band.note)}</p>
        </div>
        <button class="btn btn-primary" type="button" data-act="restart">Screen again</button>
      </div>
      <div class="screen-summary">
        <div class="screen-col">
        <div class="screen-card screen-scorecard">
          <div class="screen-score"><span class="num">${m.score}</span><span class="small muted">mobility score<br>${esc(r.band.label.toLowerCase())}</span></div>
          ${sparkline(hist)}
          <p class="small muted">Every four weeks is the right gap. Mobility work shows up in a month, not in a week.</p>
        </div>
        <div class="screen-card screen-estimates">
          <h3>What your joints can supply</h3>
          ${meter('Hip internal rotation', m.hipIR != null ? frac(m.hipIR) : r.hipIR, 'Trail hip on the way back, lead hip through impact.')}
          ${meter('Mid-back rotation', m.thoracic != null ? frac(m.thoracic) : r.thoracic, 'The turn the swing is supposed to come from.')}
          <button class="btn" type="button" data-act="lab">See it on the 3D body</button>
        </div>
        </div>
        <div class="screen-col">
        <div class="screen-card screen-findings-card">
          <h3>Last results</h3>
          <ul class="screen-grid-results">${TESTS.map(t => {
            const v = state.answers[t.id] || 'skip';
            return `<li class="screen-${v}"><div class="screen-finding-head"><b>${esc(t.name)}</b><span class="tag screen-tag-${v}">${LABEL[v]}</span></div>${v === 'pass' ? '' : `<p class="small">${esc(t.impact)}</p>`}</li>`;
          }).join('')}</ul>
        </div>
        </div>
      </div>`;
  }

  /* ---------- timer (balance test) ---------- */
  const CIRC = 2 * Math.PI * 52;
  const TIMER_NAME = { left: 'Left leg', right: 'Right leg', closed: 'Eyes closed' };

  function paintTimer(msg) {
    const count = document.getElementById('screen-count'), arc = document.getElementById('screen-arc');
    if (!count || !arc) return;
    const left = timer.id ? timer.left : (timer.total || 25);
    count.textContent = left;
    const frac = timer.total ? left / timer.total : 1;
    arc.setAttribute('stroke-dasharray', CIRC.toFixed(1));
    arc.setAttribute('stroke-dashoffset', (CIRC * (1 - frac)).toFixed(1));
    Array.from(root.querySelectorAll('[data-timer]')).forEach(c => {
      const k = c.dataset.timer;
      c.classList.toggle('on', timer.id != null && timer.key === k);
      c.classList.toggle('done', timer.held[k] != null);
      const s = c.querySelector('small');
      if (s && timer.held[k] != null) s.textContent = 'held ' + timer.held[k] + 's';
    });
    const m = document.getElementById('screen-timer-msg');
    if (m && msg) m.textContent = msg;
  }

  function stopTimer(manual) {
    if (timer.id) {
      clearInterval(timer.id);
      const held = timer.total - timer.left;
      if (manual) {
        const best = Math.max(timer.held[timer.key] || 0, held);
        timer.held[timer.key] = best;
      }
      const key = timer.key;
      timer.id = null;
      if (manual && root) paintTimer(TIMER_NAME[key] + ': held ' + timer.held[key] + ' seconds. That is your number for that leg.');
    }
    timer.id = null;
  }

  function startTimer(key, secs) {
    if (timer.id && timer.key === key) { stopTimer(true); return; }
    stopTimer();
    timer.key = key; timer.total = secs; timer.left = secs;
    paintTimer('Hold. ' + secs + ' seconds, ' + TIMER_NAME[key].toLowerCase() + '. Tap the same button the moment you have to grab something.');
    timer.id = setInterval(() => {
      timer.left -= 1;
      if (timer.left <= 0) {
        timer.left = 0;
        clearInterval(timer.id); timer.id = null;
        timer.held[key] = secs;
        paintTimer(TIMER_NAME[key] + ': ' + secs + ' seconds, clean. ' + (key === 'left' ? 'Now the right leg.' : key === 'right' ? 'Try 10 seconds with the eyes closed if both felt steady.' : 'That is the whole test.'));
        try { FR.toast('Time — ' + TIMER_NAME[key].toLowerCase() + ' done'); } catch (e) { /* no toast */ }
        return;
      }
      paintTimer();
    }, 1000);
  }

  /* ---------- persistence ---------- */
  function saveResults() {
    const a = state.answers, r = compute(a), p = FR.profile(), date = FR.todayISO();
    const tests = {};
    TESTS.forEach(t => { const v = a[t.id]; if (v && v !== 'skip') tests[t.id] = v; });
    const prev = (p.mobility && Array.isArray(p.mobility.history)) ? p.mobility.history : [];
    const history = prev.filter(h => h && h.date !== date)
      .concat([{ date, score: r.score, hipIR: r.hipIR, thoracic: r.thoracic }]).slice(-24);
    p.mobility = { date, tests, skipped: r.skipped.slice(), hipIR: r.hipIR, thoracic: r.thoracic, score: r.score, history };
    FR.save();
    pushToLab(p.mobility);
    FR.emit('screen:done', p.mobility);
    return p.mobility;
  }

  /* the 3D avatar takes the same 0..1 scale. The method is owned by the lab, so guard it. */
  function pushToLab(m) {
    const L = FR.lab();
    if (!L || typeof L.setMobility !== 'function' || !m) return;
    try { L.setMobility({ hips: frac(m.hipIR), tspine: frac(m.thoracic) }); } catch (e) { /* lab not ready */ }
  }

  /* ---------- interaction ---------- */
  function go(stage, focus) { state.stage = stage; state.focus = focus !== false; draw(); }

  function pick(key) {
    const t = TESTS[state.i];
    state.answers[t.id] = state.answers[t.id] === key ? undefined : key;
    if (!state.answers[t.id]) delete state.answers[t.id];
    draw();
  }
  function step(delta) {
    const next = state.i + delta;
    if (next < 0) return;
    if (next >= TESTS.length) { go('results'); return; }
    state.i = next; go('test');
  }

  function wire() {
    const on = (sel, fn) => Array.from(root.querySelectorAll(sel)).forEach(el => el.addEventListener('click', () => fn(el)));
    on('[data-pick]', el => pick(el.dataset.pick));
    on('[data-goto]', el => { state.i = Number(el.dataset.goto); go('test'); });
    on('[data-timer]', el => startTimer(el.dataset.timer, Number(el.dataset.secs)));
    on('[data-act]', el => {
      const act = el.dataset.act;
      if (act === 'start') { state.answers = {}; state.i = 0; timer.held = {}; go('test'); }
      else if (act === 'resume') go('test');
      /* leaving mid-screen lands on the intro, where the part-done screen can be resumed;
         leaving with nothing answered goes back to the last result if there is one */
      else if (act === 'quit') go(answered() > 0 ? 'intro' : (saved() ? 'summary' : 'intro'));
      else if (act === 'summary') go('summary');
      else if (act === 'prev') step(-1);
      else if (act === 'next') step(1);
      else if (act === 'restart') { state.answers = {}; state.i = 0; timer.held = {}; go('test'); }
      else if (act === 'save') { saveResults(); FR.toast('Mobility screen saved'); go('saved'); }
      else if (act === 'lab') {
        /* only a freshly finished screen is worth saving: from the re-screen view this is
           just a jump to the avatar, and re-saving would stamp today's date on an old result */
        const m = state.stage === 'results' ? saveResults() : saved();
        pushToLab(m); FR.navigate('#lab');
      }
      else if (act === 'routine') { saveIfUnsaved(); FR.startRoutine(el.dataset.routine); }
    });
  }
  function saveIfUnsaved() { if (state.stage === 'results') { saveResults(); FR.toast('Mobility screen saved'); state.stage = 'saved'; } }

  function bindKeys() {
    if (keysBound) return; keysBound = true;
    document.addEventListener('keydown', (e) => {
      if (!FR || FR.route() !== 'screen' || state.stage !== 'test') return;
      if (document.getElementById('modal') || document.getElementById('player')) return;
      const t = e.target;
      if (t && t.matches && t.matches('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (k === '1') { e.preventDefault(); pick('pass'); }
      else if (k === '2') { e.preventDefault(); pick('limited'); }
      else if (k === '3') { e.preventDefault(); pick('fail'); }
      else if (k === 's') { e.preventDefault(); pick('skip'); }
      else if (e.key === 'ArrowRight') { if (state.answers[TESTS[state.i].id]) { e.preventDefault(); step(1); } }
      else if (e.key === 'ArrowLeft') { if (state.i > 0) { e.preventDefault(); step(-1); } }
    });
  }

  /* ---------- debug hooks ---------- */
  const DEMO = { pelvicRotation: 'limited', torsoRotation: 'fail', overheadSquat: 'limited', toeTouch: 'pass', singleLegBalance: 'limited', hip9090: 'limited' };
  function applyDebug() {
    if (state.debug) return; state.debug = true;
    let qs; try { qs = new URLSearchParams(location.search); } catch (e) { return; }
    if (qs.get('screensaved')) {
      const p = FR.profile();
      const base = new Date();
      const iso = (ago) => { const d = new Date(base); d.setDate(d.getDate() - ago); return FR.localISO(d); };
      p.mobility = {
        date: iso(6), tests: Object.assign({}, DEMO, { torsoRotation: 'limited' }), skipped: [],
        hipIR: 0.68, thoracic: 0.72, score: 61,
        history: [
          { date: iso(96), score: 42, hipIR: 0.48, thoracic: 0.5 },
          { date: iso(68), score: 47, hipIR: 0.53, thoracic: 0.55 },
          { date: iso(38), score: 55, hipIR: 0.6, thoracic: 0.66 },
          { date: iso(6), score: 61, hipIR: 0.68, thoracic: 0.72 }
        ]
      };
      state.stage = 'summary';
      return;
    }
    if (qs.get('screendone')) { state.answers = Object.assign({}, DEMO); state.stage = 'results'; return; }
    const s = qs.get('screenstep');
    if (s != null) {
      const n = Number(s);
      if (n <= 0) { state.stage = 'intro'; return; }
      state.i = Math.max(0, Math.min(TESTS.length - 1, n - 1));
      TESTS.slice(0, state.i).forEach(t => { state.answers[t.id] = DEMO[t.id]; });
      state.stage = 'test';
    }
  }

  /* ---------- render ---------- */
  function draw() {
    if (!root) return;
    stopTimer();
    const s = state.stage;
    root.innerHTML = s === 'test' ? viewTest()
      : s === 'results' ? viewResults(false)
      : s === 'saved' ? viewResults(true)
      : s === 'summary' ? viewSummary()
      : viewIntro();
    wire();
    const spark = root.querySelector('#screen-spark-svg');
    if (spark && state.spark) {
      const w = Math.round(spark.getBoundingClientRect().width) || 280;
      spark.innerHTML = sparkSVG(state.spark, Math.max(240, w));
    }
    if (s === 'test' && TESTS[state.i].timer) paintTimer();
    if (state.focus) {
      state.focus = false;
      const h = root.querySelector('#screen-title');
      if (h) h.focus({ preventScroll: true });
    }
  }

  function render(el, api) {
    root = el; FR = api;
    bindKeys();
    applyDebug();
    if (!state.stage) state.stage = saved() ? 'summary' : 'intro';
    if (state.stage === 'summary' && !saved()) state.stage = 'intro';
    draw();
  }

  const NAV_ICON = '<svg viewBox="0 0 24 24"><circle cx="11" cy="4" r="2"/><path d="M11 6.5v6.5M7 9h8M8.5 20l2.5-7 2.5 7"/><path d="M18.5 4.5a10 10 0 0 1 0 15"/></svg>';

  window.FR.registerView('screen', {
    render,
    nav: { label: 'Screen', icon: NAV_ICON, primary: false, after: 'routines' }
  });

  /* keep the avatar in step with the saved screen, and drop the timer when the golfer leaves */
  window.FR.on('route', (r) => {
    FR = FR || window.FR;
    if (r !== 'screen') stopTimer();
    if (r === 'lab') { const m = FR.profile().mobility; if (m) pushToLab(m); }
  });
})();

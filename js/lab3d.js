/* Free Relief — 3D swing lab
   A holographic golfer with a fully articulated spine. Built procedurally with three.js r147:
   the spine is a chain of 24 bones; the swing's rotation is distributed across hips, thoracic
   spine, lumbar spine and shoulder girdle according to how compliant each region is. Stiff
   regions push the work elsewhere, and the lumbar vertebrae glow when they take more rotation
   than they are built for.

   The procedural skeleton renders immediately and is also the fallback. After first paint the
   lab fetches assets/anatomy/spine.bin and, if it arrives intact, swaps real BodyParts3D bones
   onto the same 24 joints — see applyAnatomy(). The rotation model is untouched by that swap.

   Anatomy: BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution
   4.0 International. https://creativecommons.org/licenses/by/4.0/ — the running app carries the
   credit on screen; see ATTRIBUTION.md for the full notice. */

const Lab = (() => {
  const DEG = Math.PI / 180;
  const ARM = { upper: 0.30, fore: 0.27 };
  const LEG = { thigh: 0.43, shin: 0.42 };
  const CAP = { girdle: 15, thoracic: 40, lumbar: 10, cervical: 80 };
  const COMPLIANCE = { girdle: 0.35, thoracic: 1.0, thoracicStiff: 0.4, lumbar: 0.23 };

  /* Clubs. `len` is the modelled shaft length in this (slightly compressed) figure's scale; the
     ratios match real 45.5" / 37" / 35.5" clubs. `tilt`/`side` are posture deltas on the authored
     7-iron keyframes: a driver stands taller with more tilt away from the target, a wedge is
     steeper and more centred. `ballX` moves the ball (and with it the whole swing arc) along the
     target line — forward off the lead heel for the driver, centre for the wedge. `tee` lifts the
     ball off the turf. `carry` is yards per mph of clubhead speed for the estimate in the HUD. */
  const CLUBS = {
    driver: { label: 'driver', len: 1.082, tilt: -4, side: 6, ballX: 0.13, tee: 0.038, headScale: 1.9, arc: 1.00, turn: 1.00, pace: 1.00, carry: 2.42 },
    iron: { label: '7-iron', len: 0.880, tilt: 0, side: 0, ballX: 0.00, tee: 0.000, headScale: 1.0, arc: 1.00, turn: 1.00, pace: 1.00, carry: 1.86 },
    wedge: { label: 'wedge', len: 0.844, tilt: 3, side: -3, ballX: -0.09, tee: 0.000, headScale: 0.92, arc: 0.88, turn: 0.90, pace: 1.12, carry: 1.25 }
  };
  let clubSpec = CLUBS.iron;
  let CLUB_LEN = clubSpec.len;
  /* +1 right-handed, -1 left-handed. Mirrors every x position and flips every yaw / side-bend
     sign; the readouts are taken before the mirror so they stay positive-is-backswing. */
  let MIR = 1;

  /* Where the arms and the legs hang off the skeleton, in the parent bone's local frame:
     shoulders on T2, hips on the pelvis. These are variables rather than literals because the
     real BodyParts3D bones sit a couple of centimetres from where the procedural ones do. When
     the anatomy asset lands they shift by exactly that much, which puts the shoulder joint back
     in the world position it occupies today and keeps the arm IK, the club and all nine
     keyframes valid. Read by pose(), ghostSegments() and the shoulder/hip hit regions. */
  const ANCHOR = { shX: 0.20, shY: -0.010, shZ: 0.0, hipX: 0.09, hipY: -0.03, hipZ: 0.02 };

  const COLORS = {
    bg: 0x061a11, bone: 0xe9dfc6, disc: 0x7fb9c9, skin: 0x8fd9b6, rim: 0xbff5dc,
    accent: 0xf6c544, stop: 0xf0564f, ground: 0x143523, groundAlt: 0x0f2b1c, metal: 0xcfd6d3,
    ok: 0x5ccb8c, warn: 0xf08a3e, ember: 0xff7a2f,
    fog: 0x0b2a21, skyZenith: 0x020d0a, skyMid: 0x05221d, skyHorizon: 0x0d4f48, skySun: 0xff9d4e
  };

  /* Swing keyframes for a right-handed golfer with a 7-iron. Turns in degrees, positive =
     backswing (away from target), negative = through. hands and club are in root space:
     +x toward target, +y up, +z toward the ball. `club` is a unit shaft direction pointing from
     the grip to the clubhead; null means "derive it by aiming the shaft at the ball", which is
     what makes address and impact land on the ball whatever the club length.
     `face` is the clubface yaw in the same positive-is-backswing convention (0 = square to the
     target); `rise` lifts the pelvis, which is how the lead leg extends through impact.

     Reference frame for the numbers, all for a right-handed player:
       address    trunk flexion 35-40 deg, spine tilted a few degrees away from the target
       top        pelvis 45 (35-55), thorax 90-100, X-factor 45-55  [McTeigue 1994; TPI 3D norms]
       transition pelvis reverses first, X-factor stretches ~10% early down  [Cheetham 2001]
       impact     pelvis open 35-45, thorax open 20-30, trail side bend 25-35, shaft lean 8-12
       finish     pelvis 90+ open, chest past the target                                        */
  const KEYS = [
    { t: 0.000, pelvis: 0,   torso: 0,    tilt: 36, side: 5,  ext: 0,  head: 0,   shift: 0.00,  rise: 0.000, hands: [0.02, 0.840, 0.350],   club: null,                      face: 0,    trailHeel: 0,    leadHeel: 0 },
    { t: 0.090, pelvis: 3,   torso: 12,   tilt: 36, side: 5,  ext: 0,  head: -2,  shift: -0.01, rise: 0.000, hands: [-0.16, 0.845, 0.300],  club: [-0.245, -0.909, 0.335],   face: 14,   trailHeel: 0,    leadHeel: 0 },
    { t: 0.180, pelvis: 8,   torso: 30,   tilt: 36, side: 6,  ext: 0,  head: -5,  shift: -0.02, rise: 0.000, hands: [-0.32, 0.860, 0.220],  club: [-0.560, -0.725, 0.400],   face: 28,   trailHeel: 0,    leadHeel: 0 },
    { t: 0.340, pelvis: 28,  torso: 65,   tilt: 35, side: 8,  ext: 0,  head: -10, shift: -0.03, rise: 0.000, hands: [-0.48, 1.120, -0.020], club: [-0.280, 0.945, -0.170],   face: 72,   trailHeel: 0,    leadHeel: 0.06 },
    { t: 0.440, pelvis: 39,  torso: 84,   tilt: 34, side: 9,  ext: 1,  head: -15, shift: -0.03, rise: -0.005, hands: [-0.44, 1.380, -0.180], club: [0.320, 0.860, -0.400],   face: 88,   trailHeel: 0,    leadHeel: 0.10 },
    { t: 0.500, pelvis: 45,  torso: 95,   tilt: 34, side: 10, ext: 2,  head: -18, shift: -0.03, rise: -0.010, hands: [-0.30, 1.500, -0.220], club: [0.878, 0.408, -0.250],   face: 92,   trailHeel: 0,    leadHeel: 0.12 },
    { t: 0.535, pelvis: 40,  torso: 97,   tilt: 34, side: 11, ext: 2,  head: -18, shift: -0.02, rise: -0.008, hands: [-0.34, 1.440, -0.240], club: [0.722, 0.201, -0.662],   face: 86,   trailHeel: 0.02, leadHeel: 0.10 },
    { t: 0.575, pelvis: 28,  torso: 83,   tilt: 34, side: 12, ext: 1,  head: -16, shift: -0.01, rise: -0.005, hands: [-0.42, 1.260, -0.180], club: [-0.420, 0.160, -0.893],  face: 76,   trailHeel: 0.05, leadHeel: 0.04 },
    { t: 0.600, pelvis: 8,   torso: 62,   tilt: 34, side: 14, ext: 0,  head: -12, shift: 0.02,  rise: 0.000, hands: [-0.42, 1.050, -0.020],  club: [-0.910, 0.062, -0.412],  face: 58,   trailHeel: 0.12, leadHeel: 0 },
    { t: 0.625, pelvis: -8,  torso: 42,   tilt: 34, side: 17, ext: 1,  head: -10, shift: 0.03,  rise: 0.007, hands: [-0.30, 1.000, 0.100],   club: [-0.968, -0.236, -0.094], face: 42,   trailHeel: 0.18, leadHeel: 0 },
    { t: 0.650, pelvis: -22, torso: 18,   tilt: 33, side: 20, ext: 1,  head: -8,  shift: 0.04,  rise: 0.015, hands: [-0.16, 0.950, 0.220],   club: [-0.790, -0.560, 0.250],  face: 26,   trailHeel: 0.24, leadHeel: 0 },
    { t: 0.675, pelvis: -32, torso: -6,   tilt: 33, side: 25, ext: 2,  head: -6,  shift: 0.05,  rise: 0.023, hands: [0.05, 0.885, 0.320],    club: [-0.505, -0.814, 0.281],  face: 12,   trailHeel: 0.31, leadHeel: 0 },
    { t: 0.700, pelvis: -40, torso: -24,  tilt: 32, side: 28, ext: 2,  head: -4,  shift: 0.06,  rise: 0.030, hands: [0.24, 0.845, 0.375],    club: null,                     face: 0,    trailHeel: 0.38, leadHeel: 0 },
    { t: 0.735, pelvis: -52, torso: -46,  tilt: 30, side: 25, ext: 4,  head: 6,   shift: 0.07,  rise: 0.038, hands: [0.40, 0.890, 0.395],    club: [0.386, -0.897, 0.215],   face: -20,  trailHeel: 0.50, leadHeel: 0 },
    { t: 0.800, pelvis: -70, torso: -80,  tilt: 24, side: 16, ext: 8,  head: 35,  shift: 0.08,  rise: 0.050, hands: [0.52, 1.020, 0.300],    club: [0.854, 0.386, 0.351],    face: -48,  trailHeel: 0.70, leadHeel: 0 },
    { t: 0.900, pelvis: -82, torso: -105, tilt: 14, side: 9,  ext: 13, head: 65,  shift: 0.09,  rise: 0.060, hands: [0.46, 1.440, 0.020],    club: [0.301, 0.723, -0.622],   face: -90,  trailHeel: 0.90, leadHeel: 0 },
    { t: 1.000, pelvis: -92, torso: -128, tilt: 6,  side: 4,  ext: 18, head: 95,  shift: 0.10,  rise: 0.070, hands: [0.05, 1.550, -0.350],   club: [-0.676, -0.541, -0.500], face: -125, trailHeel: 1.0,  leadHeel: 0 }
  ];
  const CHANNELS = ['pelvis', 'torso', 'tilt', 'side', 'ext', 'head', 'shift', 'rise', 'face', 'trailHeel', 'leadHeel'];
  const T_TOP = 0.50, T_IMPACT = 0.70;

  /* Tempo. The keyframe t is a phase, not a clock. Running it linearly gave a 2.5:1
     backswing:downswing ratio against a published ~3:1 (backswing 0.75-0.9 s, downswing
     0.25-0.3 s), and worse, a clubhead that peaked halfway down and slowed into the ball,
     because the keyframes are not evenly spaced along the arc. These three phases fix the ratio
     — 0.80 s back, 0.27 s down (2.96:1), 0.43 s through, of a 1.5 s swing — and buildTempo()
     then divides each phase between its keyframe intervals so the clubhead covers its own arc at
     the speed a real swing has there: slow at the top, fastest at impact. */
  const TEMPO = [[0, T_TOP, 0.5333], [T_TOP, T_IMPACT, 0.1800], [T_IMPACT, 1, 0.2867]];
  const DURATION = { study: 4.6, real: 1.5 };
  /* Clubhead speed through the swing, in arbitrary units: the shape, not the magnitude. */
  const SPEED_SHAPE = [
    [0.00, 0.06], [0.12, 0.50], [0.28, 0.62], [0.42, 0.42], [0.50, 0.20], [0.55, 0.44],
    [0.62, 0.72], [0.66, 0.88], [0.70, 1.00], [0.74, 0.97], [0.82, 0.70], [0.92, 0.34], [1.00, 0.10]
  ];

  const REGION_LABELS = {
    neck: 'Neck · C1 to C7', upback: 'Mid back · T1 to T12', lowback: 'Lower back · L1 to L5',
    'shoulder:L': 'Lead shoulder', 'shoulder:R': 'Trail shoulder', 'hip:L': 'Lead hip', 'hip:R': 'Trail hip',
    'elbow:L': 'Lead elbow', 'elbow:R': 'Trail elbow', 'wrist:L': 'Lead wrist', 'wrist:R': 'Trail wrist',
    'knee:L': 'Lead knee', 'knee:R': 'Trail knee'
  };

  const CAMERAS = {
    free:   { pos: [2.4, 1.55, 2.7], target: [0, 1.0, 0.1] },
    face:   { pos: [0.15, 1.25, 3.5], target: [0, 1.0, 0.15] },
    line:   { pos: [-3.5, 1.35, 0.4], target: [0, 1.0, 0.25] },
    behind: { pos: [0.1, 1.45, -3.4], target: [0, 1.05, 0] },
    above:  { pos: [0.6, 4.4, 1.0], target: [0, 0.9, 0.2] }
  };

  let renderer, scene, camera, composer, controls, clock, raf = null, container;
  let F = null;            // figure
  let ball, particles, groundRing;
  let spriteTex = null, sky = null, sunDisc = null, shafts = null, hexRing = null;
  let clubTrail = null, handTrail = null;
  let arcHip = null, arcSh = null, arcX = null, labHip = null, labSh = null, labX = null, arcGroup = null;
  let embers = null, lumbarLight = null;
  let shock = null, flashLight = null, ballMesh = null, ballHome = null, ballTeeMesh = null;
  let ghostGroup = null, ghostDirty = true;
  let finishPass = null;
  let lastInteract = 0, shakeAmt = 0, prevT = 0, fxOk = true;
  const impact = { ring: 0, flash: 0, launch: -1 };
  let hitMeshes = [];
  let hover = null, selected = null;
  let listeners = {};
  let camTween = null;
  let lastHud = 0;
  let reduced = false;
  let inited = false;

  const state = {
    t: 0, playing: false, loop: false, speed: 'study', dir: 1, holdUntil: 0,
    faults: { hips: false, tspine: false, reverse: false },
    camera: 'free', ghosts: false, trace: true,
    handed: 'right', club: 'iron', motion: false,
    mobility: { hips: 1, tspine: 1 },     // 1 = full normal mobility, 0.5 = the old stiff toggles
    turns: { pelvis: 1, torso: 1 },       // multipliers on the authored 45 / 95 degree top
    estimate: null                        // { mph, yards } once measured
  };
  const TOP = { pelvis: 45, torso: 95 };  // what the keyframes are authored at, for setTurns()

  /* ---------- helpers ---------- */
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  function emit(name, data) { (listeners[name] || []).forEach(fn => fn(data)); }

  /* ---------- interpolation ----------
     Every channel runs through one non-uniform Catmull-Rom (Hermite with chord-length tangents),
     so the swing is C1: velocity is continuous across a keyframe instead of easing to zero at
     each one. The old sample() smoothstepped inside each span, which parked the clubhead at every
     key — including impact, where the derivative has to be non-zero for the speed estimate to
     mean anything. Tangents are pinned to zero at the two ends so address and finish settle.

     A track is built per channel over the same t axis. Vector channels (hands, club) are three
     scalar tracks; the club track is re-normalised after interpolation. */
  let tracks = null;
  const TIMES = KEYS.map(k => k.t);

  function trackTangent(v, i) {
    if (i <= 0 || i >= v.length - 1) return 0;         // pinned: still at address, settled at the finish
    const dt = TIMES[i + 1] - TIMES[i - 1];
    return dt > 1e-6 ? (v[i + 1] - v[i - 1]) / dt : 0;
  }
  function makeTrack(values) {
    const m = values.map((_, i) => trackTangent(values, i));
    return { v: values, m };
  }
  function trackAt(tr, i, u, h) {
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * tr.v[i] + (u3 - 2 * u2 + u) * tr.m[i] * h
      + (-2 * u3 + 3 * u2) * tr.v[i + 1] + (u3 - u2) * tr.m[i + 1] * h;
  }
  function spanOf(t) {
    let i = 0;
    while (i < KEYS.length - 2 && t > TIMES[i + 1]) i++;
    const h = TIMES[i + 1] - TIMES[i];
    return { i, h, u: clamp((t - TIMES[i]) / (h || 1), 0, 1) };
  }
  function vecAt(name, t, out) {
    const s = spanOf(clamp(t, 0, 1)), g = tracks[name];
    out.set(trackAt(g[0], s.i, s.u, s.h), trackAt(g[1], s.i, s.u, s.h), trackAt(g[2], s.i, s.u, s.h));
    out.x *= MIR;
    return out;
  }
  function scalarAt(name, t) {
    const s = spanOf(clamp(t, 0, 1));
    return trackAt(tracks[name], s.i, s.u, s.h);
  }

  function sample(t) {
    t = clamp(t, 0, 1);
    const s = spanOf(t), out = {};
    for (let c = 0; c < CHANNELS.length; c++) out[CHANNELS[c]] = trackAt(tracks[CHANNELS[c]], s.i, s.u, s.h);
    out.shift *= MIR;
    out.hands = vecAt('hands', t, V3());
    out.club = vecAt('club', t, V3()).normalize();
    out.t = t;
    return out;
  }

  /* Rebuild every track. Called at init and whenever the club, the handedness or the golfer's own
     turn numbers change. The two null club directions (address, impact) are resolved here by
     aiming the shaft at the ball, so the clubhead meets the ball for any shaft length. */
  function buildTracks() {
    const sc = state.turns, cs = clubSpec;
    const dt = cs.tilt, ds = cs.side, dx = cs.ballX, arc = cs.arc, turn = cs.turn;
    const val = (k, c) => {
      let v = k[c];
      if (c === 'pelvis' || c === 'torso') {
        const f = (c === 'pelvis' ? sc.pelvis : sc.torso) * turn;
        v = v > 0 ? v * f : v * (1 + (f - 1) * 0.5);   // a smaller turn back means a smaller turn through, but less so
      } else if (c === 'tilt') v += dt * (0.35 + 0.65 * clamp(k.tilt / 36, 0, 1));
      else if (c === 'side') v += ds * (k.t < T_IMPACT ? 1 : Math.max(0, 1 - (k.t - T_IMPACT) / 0.3));
      return v;
    };
    tracks = {};
    CHANNELS.forEach(c => { tracks[c] = makeTrack(KEYS.map(k => val(k, c))); });

    /* The hand path scales about the address grip, which is how a shorter club makes a shorter,
       tighter swing arc without re-authoring a keyframe, then shifts with the ball position. */
    const k0 = KEYS[0].hands;
    const hand = (k, j) => k0[j] + (k.hands[j] - k0[j]) * arc + (j === 0 ? dx : 0);

    // address: aim the shaft at where the ball will be, then place the ball at the clubhead
    const h0 = V3(hand(KEYS[0], 0), hand(KEYS[0], 1), hand(KEYS[0], 2));
    const aim = V3(0.10 + dx, 0.03 + cs.tee, 0.62).sub(h0).normalize();
    ballTee = cs.tee;
    ballPos.set(h0.x + aim.x * CLUB_LEN, ballTee, h0.z + aim.z * CLUB_LEN + 0.015);
    const dirs = KEYS.map(k => {
      if (k.club) return V3(k.club[0], k.club[1], k.club[2]).normalize();
      return ballPos.clone().sub(V3(hand(k, 0), hand(k, 1), hand(k, 2))).normalize();
    });
    tracks.hands = [0, 1, 2].map(j => makeTrack(KEYS.map(k => hand(k, j))));
    tracks.club = [makeTrack(dirs.map(d => d.x)), makeTrack(dirs.map(d => d.y)), makeTrack(dirs.map(d => d.z))];
    buildTempo();
  }

  function phaseName(t) {
    if (t < 0.06) return 'Address';
    if (t < 0.46) return 'Backswing';
    if (t < 0.54) return 'Top';
    if (t < 0.68) return 'Downswing';
    if (t < 0.73) return 'Impact';
    if (t < 0.9) return 'Follow-through';
    return 'Finish';
  }

  /* ---------- materials ---------- */
  let skinMat, boneMat, discMat, metalMat, gripMat, glowMat;

  function makeMaterials() {
    boneMat = new THREE.MeshPhysicalMaterial({ color: COLORS.bone, roughness: 0.55, metalness: 0.0, clearcoat: 0.35, clearcoatRoughness: 0.5 });
    discMat = new THREE.MeshPhysicalMaterial({ color: COLORS.disc, roughness: 0.4, metalness: 0.0, transparent: true, opacity: 0.85, clearcoat: 0.6 });
    metalMat = new THREE.MeshStandardMaterial({ color: COLORS.metal, roughness: 0.22, metalness: 0.95 });
    gripMat = new THREE.MeshStandardMaterial({ color: 0x1b1f1d, roughness: 0.9, metalness: 0.0 });
    glowMat = new THREE.MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });

    skinMat = new THREE.MeshPhysicalMaterial({
      color: COLORS.skin, roughness: 0.35, metalness: 0.0, transparent: true, opacity: 0.16,
      depthWrite: false, side: THREE.DoubleSide, emissive: COLORS.skin, emissiveIntensity: 0.08
    });
    skinMat.onBeforeCompile = (shader) => {
      shader.uniforms.uRimColor = { value: new THREE.Color(COLORS.rim) };
      shader.uniforms.uRimPower = { value: 2.6 };
      shader.uniforms.uRimStrength = { value: 0.95 };
      shader.uniforms.uBaseAlpha = { value: 0.10 };
      shader.uniforms.uRimAlpha = { value: 0.75 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHoloN; varying vec3 vHoloV; varying float vHoloY;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvHoloN = normalize(transformedNormal); vHoloV = mvPosition.xyz; vHoloY = (modelMatrix * vec4(transformed, 1.0)).y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHoloN; varying vec3 vHoloV; varying float vHoloY;\nuniform vec3 uRimColor; uniform float uRimPower; uniform float uRimStrength; uniform float uBaseAlpha; uniform float uRimAlpha;')
        .replace('#include <output_fragment>', `#include <output_fragment>
          float fres = pow(1.0 - clamp(abs(dot(normalize(vHoloN), normalize(-vHoloV))), 0.0, 1.0), uRimPower);
          float scan = 0.5 + 0.5 * sin(vHoloY * 220.0);
          gl_FragColor.rgb += uRimColor * fres * uRimStrength;
          gl_FragColor.rgb += uRimColor * 0.035 * scan;
          gl_FragColor.a = clamp(uBaseAlpha + fres * uRimAlpha + 0.03 * scan, 0.0, 1.0);`);
    };
  }

  /* ---------- geometry builders ---------- */
  function capsule(r, len, mat, opts = {}) {
    const g = new THREE.CapsuleGeometry(r, Math.max(len - 2 * r, 0.001), 6, 18);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = opts.shadow !== false; m.receiveShadow = false;
    return m;
  }
  function sphere(r, mat, seg = 24) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat);
    m.castShadow = true;
    return m;
  }
  function box(w, h, d, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    return m;
  }

  /* Vertebra proportions by index along the chain (0 = L5 ... 23 = C1). */
  function vertebraSpec(i) {
    if (i < 5) { // lumbar
      const k = i / 4;
      return { region: 'lumbar', r: lerp(0.031, 0.027, k), h: lerp(0.029, 0.026, k), d: 0.011, base: -8, label: 'L' + (5 - i) };
    }
    if (i < 17) { // thoracic
      const k = (i - 5) / 11;
      return { region: 'thoracic', r: lerp(0.026, 0.018, k), h: lerp(0.023, 0.017, k), d: 0.006, base: 4, label: 'T' + (12 - (i - 5)) };
    }
    const k = (i - 17) / 6; // cervical
    return { region: 'cervical', r: lerp(0.016, 0.012, k), h: lerp(0.015, 0.012, k), d: 0.004, base: -3.6, label: 'C' + (7 - (i - 17)) };
  }

  function buildVertebra(spec, mat) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(spec.r, spec.r * 1.04, spec.h, 22), mat);
    body.scale.z = 0.82; body.position.y = spec.h / 2; body.castShadow = true;
    g.add(body);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(spec.r * 0.92, spec.r * 0.92, spec.d, 22), discMat);
    disc.scale.z = 0.82; disc.position.y = -spec.d / 2;
    g.add(disc);
    // arch plate behind the body, transverse processes, spinous process
    const arch = box(spec.r * 1.5, spec.h * 0.72, 0.011, mat);
    arch.position.set(0, spec.h / 2, -spec.r * 0.82 - 0.004);
    g.add(arch);
    const trans = box(spec.r * 2 + 0.028, 0.006, 0.009, mat);
    trans.position.set(0, spec.h / 2 + 0.002, -spec.r * 0.82 + 0.004);
    g.add(trans);
    const spin = box(0.011, 0.009, spec.r * 0.9 + 0.012, mat);
    spin.position.set(0, spec.h / 2 - 0.005, -spec.r * 0.82 - 0.012 - (spec.r * 0.9 + 0.012) / 2);
    spin.rotation.x = 0.55;
    g.add(spin);
    return g;
  }

  function buildRib(side, k) { // k: 0..1 along the thoracic spine (0 = T1)
    const wProfile = k < 0.55 ? lerp(0.075, 0.135, k / 0.55) : lerp(0.135, 0.105, (k - 0.55) / 0.45);
    const drop = lerp(0.045, 0.085, k);
    const floating = k > 0.85;
    const w = wProfile * side;
    const pts = [V3(0, 0, 0.005), V3(w * 0.55, -drop * 0.25, 0.015), V3(w, -drop * 0.7, 0.10), V3(w * 0.62, -drop * 1.05, 0.185)];
    if (!floating) pts.push(V3(0.022 * side, -drop * 1.2, 0.215));
    else pts.pop();
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.0048, 7, false), boneMat);
    tube.castShadow = true;
    return tube;
  }

  /* Bind the holographic torso to the bone chain by world height.
     Called once at build time, and again if the real vertebrae arrive, because they change the
     chain's offsets. Both halves have to be redone: the weights are a linear scan that assumes
     strictly ascending bone Ys, and torso.bind() snapshots the bone inverses — so both are
     computed against the *rest* chain (pelvis at its build position, every rotation zero), which
     is the pose the lathe profile below was authored against. The caller re-poses afterwards. */
  function skinTorso(root, bones, torso) {
    const savedPelvis = bones[0].position.clone();
    const savedRot = bones.map(b => b.rotation.clone());
    bones[0].position.set(0, 0.95, 0);
    bones.forEach(b => b.rotation.set(0, 0, 0));
    root.updateMatrixWorld(true);

    const geo = torso.geometry, pos = geo.attributes.position;
    const boneYs = bones.map(b => b.getWorldPosition(V3()).y);
    const idx = new Uint16Array(pos.count * 4), wgt = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      let j = 0;
      while (j < bones.length - 2 && boneYs[j + 1] < y) j++;
      const y0 = boneYs[j], y1 = boneYs[j + 1];
      let w = clamp((y - y0) / Math.max(y1 - y0, 1e-4), 0, 1);
      if (y < boneYs[0]) w = 0;
      idx[i * 4] = j; idx[i * 4 + 1] = j + 1;
      wgt[i * 4] = 1 - w; wgt[i * 4 + 1] = w;
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
    /* Re-binding reuses the skeleton so a rebind does not orphan its bone texture. */
    torso.bind(torso.skeleton || new THREE.Skeleton(bones));

    bones.forEach((b, i) => b.rotation.copy(savedRot[i]));
    bones[0].position.copy(savedPelvis);
    root.updateMatrixWorld(true);
  }

  /* ---------- figure ---------- */
  function buildFigure() {
    const root = new THREE.Group();
    const bones = [];
    const vertebrae = [];

    const pelvis = new THREE.Bone();
    pelvis.name = 'pelvis';
    pelvis.position.set(0, 0.95, 0);
    pelvis.userData.base = { x: 0, y: 0, z: 0 };
    root.add(pelvis);
    bones.push(pelvis);

    // pelvis geometry
    const pelvisGroup = new THREE.Group();
    const sacrum = box(0.075, 0.09, 0.03, boneMat);
    sacrum.position.set(0, -0.01, -0.005); sacrum.rotation.x = -0.35;
    pelvisGroup.add(sacrum);
    [-1, 1].forEach(s => {
      const wing = sphere(0.055, boneMat, 18);
      wing.scale.set(1.15, 1.25, 0.45);
      wing.position.set(s * 0.085, 0.015, 0.01);
      wing.rotation.y = s * 0.55;
      pelvisGroup.add(wing);
      const hipCup = sphere(0.028, boneMat, 14);
      hipCup.position.set(s * 0.09, -0.03, 0.02);
      pelvisGroup.add(hipCup);
    });
    const pubis = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 24, Math.PI), boneMat);
    pubis.rotation.x = Math.PI / 2; pubis.rotation.z = Math.PI; pubis.position.set(0, -0.04, 0.02); pubis.scale.z = 0.8;
    pubis.castShadow = true;
    pelvisGroup.add(pubis);
    pelvis.add(pelvisGroup);
    pelvis.userData.proc = [pelvisGroup];   // handed to applyAnatomy() when the real pelvis lands

    // spine chain
    let parent = pelvis;
    let prevTop = 0.045; // sacrum top offset
    for (let i = 0; i < 24; i++) {
      const spec = vertebraSpec(i);
      const b = new THREE.Bone();
      b.name = spec.label;
      b.position.set(0, prevTop + spec.d, 0);
      b.userData.base = { x: (i === 0 ? 16 : 0) * DEG + spec.base * DEG, y: 0, z: 0 };
      b.userData.spec = spec;
      const mat = boneMat.clone();
      b.userData.mat = mat;
      const mesh = buildVertebra(spec, mat);
      b.add(mesh);
      /* Everything procedural about this vertebra is remembered here so the real BodyParts3D
         mesh can take its place later without disturbing the bone, its hit regions or its ribs'
         siblings. See applyAnatomy(). */
      b.userData.proc = [mesh];
      if (spec.region === 'thoracic') {
        const k = (12 - parseInt(spec.label.slice(1))) / 11;
        const ribL = buildRib(1, k), ribR = buildRib(-1, k);
        b.add(ribL); b.add(ribR);
        b.userData.proc.push(ribL, ribR);
      }
      parent.add(b);
      bones.push(b);
      vertebrae.push(b);
      parent = b;
      prevTop = spec.h;
    }

    // skull on top of C1
    const skull = new THREE.Bone();
    skull.name = 'skull';
    skull.position.set(0, prevTop + 0.01, 0);
    skull.userData.base = { x: 0, y: 0, z: 0 };
    parent.add(skull);
    bones.push(skull);
    const cranium = sphere(0.088, boneMat, 28);
    cranium.scale.set(0.92, 1.04, 1.0); cranium.position.set(0, 0.075, 0.015);
    skull.add(cranium);
    const jaw = box(0.078, 0.035, 0.06, boneMat);
    jaw.position.set(0, 0.0, 0.035);
    skull.add(jaw);
    const headSkin = sphere(0.107, skinMat, 32);
    headSkin.scale.set(0.93, 1.08, 1.0); headSkin.position.set(0, 0.07, 0.02); headSkin.renderOrder = 10;
    headSkin.castShadow = true;
    skull.add(headSkin);

    // shoulder girdle on T2
    const t2 = vertebrae.find(b => b.name === 'T2');
    const girdle = new THREE.Group();
    [-1, 1].forEach(s => {
      const clav = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V3(s * 0.012, 0.0, 0.075), V3(s * 0.09, 0.012, 0.075), V3(s * 0.17, 0.02, 0.03), V3(s * 0.20, 0.01, 0.0)]), 16, 0.0065, 7, false), boneMat);
      clav.castShadow = true;
      girdle.add(clav);
      const scap = box(0.095, 0.13, 0.008, boneMat);
      scap.position.set(s * 0.095, -0.085, -0.075); scap.rotation.y = s * 0.35; scap.rotation.z = s * 0.12;
      girdle.add(scap);
      const cup = sphere(0.02, boneMat, 12);
      cup.position.set(s * 0.20, -0.01, 0.0);
      girdle.add(cup);
    });
    /* The girdle is authored around T2's procedural origin. If the real vertebrae land, T2's
       origin moves, and applyAnatomy() translates the whole group by that delta rather than
       re-authoring the clavicles, scapulae and sockets. */
    t2.add(girdle);

    // torso skin as a skinned lathe
    const profile = [
      [0.80, 0.165], [0.86, 0.172], [0.92, 0.170], [0.98, 0.156], [1.04, 0.150], [1.10, 0.154], [1.16, 0.163],
      [1.22, 0.174], [1.28, 0.186], [1.34, 0.196], [1.39, 0.204], [1.43, 0.200], [1.46, 0.150], [1.485, 0.085],
      [1.52, 0.066], [1.58, 0.062], [1.64, 0.064]
    ];
    const lathePts = profile.map(([y, r]) => new THREE.Vector2(r, y));
    const torsoGeo = new THREE.LatheGeometry(lathePts, 56);
    // flatten depth and push the mass in front of the spine
    const pos = torsoGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, pos.getZ(i) * 0.62 + 0.055);
    }
    torsoGeo.computeVertexNormals();
    const torso = new THREE.SkinnedMesh(torsoGeo, skinMat);
    torso.renderOrder = 10; torso.castShadow = true; torso.frustumCulled = false;
    root.add(torso);
    skinTorso(root, bones, torso);

    // limbs (posed by IK every frame)
    const limb = (rSkin, rBone, len) => {
      const g = new THREE.Group();
      const skin = capsule(rSkin, len, skinMat); skin.renderOrder = 10;
      const bone = capsule(rBone, len, boneMat);
      g.add(skin); g.add(bone);
      root.add(g);
      return g;
    };
    const joint = (r) => { const m = sphere(r, boneMat, 14); root.add(m); return m; };
    const arms = {}, legs = {};
    ['L', 'R'].forEach(s => {
      arms[s] = { upper: limb(0.046, 0.011, ARM.upper), fore: limb(0.038, 0.009, ARM.fore), elbow: joint(0.017), hand: box(0.085, 0.03, 0.05, skinMat) };
      arms[s].hand.renderOrder = 10; root.add(arms[s].hand);
      legs[s] = { thigh: limb(0.076, 0.016, LEG.thigh), shin: limb(0.056, 0.013, LEG.shin), knee: joint(0.025), foot: capsule(0.045, 0.25, skinMat) };
      legs[s].foot.renderOrder = 10; root.add(legs[s].foot);
    });

    /* club. Shaft length and head size come from the club spec, so setClub() only has to call
       shapeClub() again — the swing itself is club-independent because the shaft is aimed at the
       ball at address and impact. The blade sits on local +x (the toe) with its face on local -z,
       which is the pairing pose() rolls to the keyframed face angle. */
    const clubGroup = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0045, 1, 12), metalMat);
    shaft.castShadow = true;
    clubGroup.add(shaft);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.26, 12), gripMat);
    grip.position.y = -0.12;
    clubGroup.add(grip);
    const head = new THREE.Group();
    const blade = box(0.085, 0.052, 0.014, metalMat);
    blade.position.set(0.035, 0.02, 0.0); blade.rotation.x = -0.35;
    head.add(blade);
    const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.05, 10), metalMat);
    hosel.position.set(0, 0.02, 0);
    head.add(hosel);
    clubGroup.add(head);
    root.add(clubGroup);
    const club = clubGroup;

    // hit regions (invisible until hovered). Attached to bones where possible.
    const regions = [];
    const region = (key, mesh, parentObj) => {
      mesh.visible = false; mesh.userData.region = key; mesh.material = glowMat;
      (parentObj || root).add(mesh); regions.push(mesh); return mesh;
    };
    /* Proxy volumes are sized to the REAL spine: the BodyParts3D lumbar segment is ~32 mm
       shorter than the procedural one it replaced, so the pre-swap box heights reached past
       their own region and a click on T12 answered "Lower back" (and T1 answered "Neck"). */
    region('neck', sphere(0.064, glowMat, 16), vertebrae.find(b => b.name === 'C4'));
    const ub = region('upback', new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.31, 0.16), glowMat), vertebrae.find(b => b.name === 'T7')); ub.position.set(0, 0.0025, -0.03);
    const lb = region('lowback', new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.15), glowMat), vertebrae.find(b => b.name === 'L3')); lb.position.set(0, 0.0, -0.02);
    const dyn = {};
    [-1, 1].forEach(s => {
      const side = s > 0 ? 'L' : 'R';
      const sh = region('shoulder:' + side, sphere(0.08, glowMat, 16), t2); sh.position.set(s * ANCHOR.shX, ANCHOR.shY, ANCHOR.shZ);
      const hp = region('hip:' + side, sphere(0.085, glowMat, 16), pelvis); hp.position.set(s * ANCHOR.hipX, ANCHOR.hipY, ANCHOR.hipZ);
      dyn['elbow:' + side] = region('elbow:' + side, sphere(0.065, glowMat, 16));
      dyn['wrist:' + side] = region('wrist:' + side, sphere(0.055, glowMat, 16));
      dyn['knee:' + side] = region('knee:' + side, sphere(0.075, glowMat, 16));
    });

    return { root, bones, vertebrae, pelvis, t2, skull, girdle, torso, arms, legs, club, clubShaft: shaft, clubHead: head, regions, dyn };
  }

  /* Stretch the shaft and size the head for the current club. */
  function shapeClub() {
    if (!F) return;
    F.clubShaft.scale.y = CLUB_LEN;
    F.clubShaft.position.y = -CLUB_LEN / 2;
    F.clubHead.position.y = -CLUB_LEN;
    F.clubHead.scale.setScalar(clubSpec.headScale);
  }

  /* Shoulder, hip and their hit regions follow the handedness mirror. */
  function applyAnchors() {
    if (!F) return;
    F.regions.forEach(r => {
      switch (r.userData.region) {
        case 'shoulder:L': r.position.set(ANCHOR.shX * MIR, ANCHOR.shY, ANCHOR.shZ); break;
        case 'shoulder:R': r.position.set(-ANCHOR.shX * MIR, ANCHOR.shY, ANCHOR.shZ); break;
        case 'hip:L': r.position.set(ANCHOR.hipX * MIR, ANCHOR.hipY, ANCHOR.hipZ); break;
        case 'hip:R': r.position.set(-ANCHOR.hipX * MIR, ANCHOR.hipY, ANCHOR.hipZ); break;
      }
    });
  }

  /* ---------- posing ---------- */
  const tmp = { a: V3(), b: V3(), c: V3(), d: V3(), q: new THREE.Quaternion(), up: V3(0, 1, 0) };

  function placeSegment(group, A, B, baseLen) {
    group.position.copy(A).add(B).multiplyScalar(0.5);
    tmp.a.copy(B).sub(A);
    const len = tmp.a.length() || 1e-6;
    tmp.a.divideScalar(len);
    group.quaternion.setFromUnitVectors(tmp.up, tmp.a);
    /* When the target is past the joint's reach the bone stretches a little
       rather than the hand letting go of the club. Capped so it never rubbers. */
    group.scale.y = baseLen ? clamp(len / baseLen, 1, 1.16) : 1;
  }

  /* Solves the elbow (or knee) position. It never moves H: a hand that is out of
     reach keeps hold of the club and the arm straightens toward it, because a
     detached hand reads as a broken figure while a slightly long arm does not. */
  function solveIK(S, H, Lu, Lf, pole) {
    const d = tmp.a.copy(H).sub(S);
    let L = d.length();
    const maxL = Lu + Lf - 0.004;
    if (L > maxL) {
      const dn2 = tmp.b.copy(d).divideScalar(L);
      return V3().copy(S).add(dn2.multiplyScalar(Lu * (L / (Lu + Lf))));
    }
    const dn = tmp.b.copy(d).divideScalar(L);
    const a = clamp((Lu * Lu - Lf * Lf + L * L) / (2 * L), -Lu, Lu);
    const h = Math.sqrt(Math.max(Lu * Lu - a * a, 0));
    const pd = tmp.c.copy(pole).sub(S);
    pd.sub(tmp.d.copy(dn).multiplyScalar(pd.dot(dn)));
    if (pd.lengthSq() < 1e-6) pd.set(0, 0, 1);
    pd.normalize();
    return V3().copy(S).add(dn.multiplyScalar(a)).add(pd.multiplyScalar(h));
  }

  /* Lets a shoulder (or hip) slide toward an out-of-reach target, the way the
     shoulder blade actually glides on the ribcage. Mutates S in place. */
  const GIRDLE_GIVE = 0.085;
  function reachOut(S, H) {
    const d = tmp.d.copy(H).sub(S);
    const L = d.length();
    const over = L - (ARM.upper + ARM.fore - 0.004);
    if (over > 0) S.add(d.divideScalar(L).multiplyScalar(Math.min(over, GIRDLE_GIVE)));
    return S;
  }

  let ballPos = V3(0.10, 0.03, 0.62), ballTee = 0;
  const feet = { L: V3(0.22, 0.045, 0.0), R: V3(-0.22, 0.045, 0.0) };

  /* Thoracic compliance as a continuous function of mobility. Anchored so 1 reproduces a normal
     mid back (compliance 1.0) and 0.5 reproduces exactly what the old "stiff mid back" toggle
     did (0.4): 0.5^k = 0.4, so k = ln0.4/ln0.5. Everything between is a real, continuous value,
     which is what makes the lumbar load respond to a slider rather than a switch. */
  const TSPINE_K = Math.log(0.4) / Math.log(0.5);

  function computeLoad(p) {
    const mob = state.mobility;
    let P = p.pelvis;
    if (P > 0) P *= clamp(mob.hips, 0, 1);         // less hip turn available on the way back
    const S = p.torso - P;                         // what the trunk must supply
    const cT = COMPLIANCE.thoracic * Math.pow(clamp(mob.tspine, 0, 1), TSPINE_K);
    const sum = COMPLIANCE.girdle + cT + COMPLIANCE.lumbar;
    const g = S * COMPLIANCE.girdle / sum, th = S * cT / sum, lu = S * COMPLIANCE.lumbar / sum;
    const t1yaw = -(P + lu + th);                  // rotation.y convention: + toward target
    const cerv = p.head - t1yaw;
    let side = p.side;
    let extraLumbar = 0;
    if (state.faults.reverse && p.t < 0.62) {
      const k = smooth(clamp(p.t / 0.5, 0, 1)) * (p.t > 0.5 ? 1 - (p.t - 0.5) / 0.12 : 1);
      side = lerp(p.side, -14, k);
      extraLumbar = 0.6 * k;
    }
    const lumbarStress = Math.abs(lu) / CAP.lumbar + extraLumbar + Math.abs(p.ext) / 60;
    return {
      P, S, g, th, lu, cerv, side, ext: p.ext,
      stress: {
        lumbar: lumbarStress,
        thoracic: Math.abs(th) / CAP.thoracic,
        girdle: Math.abs(g) / CAP.girdle,
        cervical: Math.abs(cerv) / CAP.cervical
      },
      hipTurn: P, shoulderTurn: p.torso, xfactor: p.torso - P
    };
  }

  const stressColor = new THREE.Color();
  const cAccent = new THREE.Color(COLORS.accent), cStop = new THREE.Color(COLORS.stop), cBone = new THREE.Color(COLORS.bone);

  function applyStress(bone, s, weight = 1) {
    const v = s * weight;
    const mat = bone.userData.mat;
    if (v < 0.45) { mat.emissive.setHex(0x000000); mat.emissiveIntensity = 0; mat.color.copy(cBone); return; }
    if (v < 1.0) {
      const k = (v - 0.45) / 0.55;
      mat.emissive.copy(cAccent); mat.emissiveIntensity = 0.15 + 0.85 * k; mat.color.copy(cBone).lerp(cAccent, 0.4 * k);
    } else {
      const k = clamp((v - 1.0) / 0.6, 0, 1);
      stressColor.copy(cAccent).lerp(cStop, k);
      mat.emissive.copy(stressColor); mat.emissiveIntensity = 1.0 + 1.4 * k; mat.color.copy(stressColor);
    }
  }

  function pose(t) {
    const p = sample(t);
    const L = computeLoad(p);
    const f = F;

    /* pelvis. `rise` is the lead leg extending: the pelvis climbs 3 cm by impact and 7 cm by the
       finish, which is what pulls the lead knee straight through the strike. */
    f.pelvis.position.set(p.shift, 0.95 + p.rise - Math.abs(p.shift) * 0.20, 0);
    f.pelvis.rotation.set(p.tilt * DEG, -L.P * DEG * MIR, 0);

    // distribute spine rotation, side bend, extension
    const perLu = -L.lu / 5 * MIR, perTh = -L.th / 12 * MIR, perCe = L.cerv / 7 * MIR;
    const sideLu = L.side * 0.45 / 5 * MIR, sideTh = L.side * 0.55 / 12 * MIR;
    const extLu = -L.ext * 0.6 / 5, extTh = -L.ext * 0.4 / 12;
    f.vertebrae.forEach((b, i) => {
      const base = b.userData.base, r = b.userData.spec.region;
      if (r === 'lumbar') {
        b.rotation.set(base.x + extLu * DEG, base.y + perLu * DEG, base.z + sideLu * DEG);
        applyStress(b, L.stress.lumbar, 0.85 + 0.15 * (4 - i) / 4);
      } else if (r === 'thoracic') {
        b.rotation.set(base.x + extTh * DEG, base.y + perTh * DEG, base.z + sideTh * DEG);
        applyStress(b, L.stress.thoracic, 1);
      } else {
        b.rotation.set(base.x, base.y + perCe * DEG, base.z - L.side * 0.4 / 7 * DEG * MIR);
        applyStress(b, L.stress.cervical, 1);
      }
    });
    f.root.updateMatrixWorld(true);

    // arms: shoulders from T2, hands from keyframes
    const shL = f.t2.localToWorld(V3(ANCHOR.shX * MIR, ANCHOR.shY, ANCHOR.shZ));
    const shR = f.t2.localToWorld(V3(-ANCHOR.shX * MIR, ANCHOR.shY, ANCHOR.shZ));
    const chestFwd = f.t2.localToWorld(V3(0, 0, 1)).sub(f.t2.getWorldPosition(V3())).normalize();
    const clubDir = p.club.clone();
    const grip = p.hands.clone();
    const handL = grip.clone().sub(clubDir.clone().multiplyScalar(0.02));
    const handR = grip.clone().add(clubDir.clone().multiplyScalar(0.07));
    const poleL = shL.clone().add(V3(0.5 * MIR, -0.4, 0)).sub(chestFwd.clone().multiplyScalar(0.3));
    const poleR = shR.clone().add(V3(-0.5 * MIR, -0.4, 0)).sub(chestFwd.clone().multiplyScalar(0.3));
    /* The shoulder girdle travels: the lead shoulder protracts across the chest
       at the top and the trail shoulder reaches through the finish. Without this
       the keyframed hand path is out of reach and the hands leave the grip. */
    reachOut(shL, handL); reachOut(shR, handR);
    const elL = solveIK(shL, handL, ARM.upper, ARM.fore, poleL);
    const elR = solveIK(shR, handR, ARM.upper, ARM.fore, poleR);
    placeSegment(f.arms.L.upper, shL, elL, ARM.upper); placeSegment(f.arms.L.fore, elL, handL, ARM.fore);
    placeSegment(f.arms.R.upper, shR, elR, ARM.upper); placeSegment(f.arms.R.fore, elR, handR, ARM.fore);
    f.arms.L.elbow.position.copy(elL); f.arms.R.elbow.position.copy(elR);
    f.dyn['elbow:L'].position.copy(elL); f.dyn['elbow:R'].position.copy(elR);
    f.dyn['wrist:L'].position.copy(handL); f.dyn['wrist:R'].position.copy(handR);

    // club follows the grip
    f.club.position.copy(grip);
    f.club.quaternion.setFromUnitVectors(V3(0, -1, 0), clubDir);
    /* Roll the head about the shaft to the keyframed face angle: 0 is square to the target,
       positive rolls with the backswing, so the face is square at impact and on plane at the top.
       The old code aimed the *toe* at the target, which left the face ninety degrees open through
       the strike. The blade's normal is the club group's local -z for a right-handed head. */
    const fa = p.face * DEG;
    const want = V3(Math.cos(fa) * MIR, 0, Math.sin(fa));
    want.addScaledVector(clubDir, -want.dot(clubDir));
    if (want.lengthSq() < 0.0025) want.set(0, 1, 0).addScaledVector(clubDir, -clubDir.y);
    want.normalize();
    const faceNow = V3(0, 0, -MIR).applyQuaternion(f.club.quaternion);
    const twist = Math.atan2(faceNow.clone().cross(want).dot(clubDir), faceNow.dot(want));
    f.club.rotateOnAxis(V3(0, -1, 0), twist);
    ['L', 'R'].forEach(s => {
      const h = f.arms[s].hand; h.position.copy(s === 'L' ? handL : handR); h.quaternion.copy(f.club.quaternion);
    });

    // legs: hips from pelvis, feet fixed (trail heel lifts through impact)
    const hipL = f.pelvis.localToWorld(V3(ANCHOR.hipX * MIR, ANCHOR.hipY, ANCHOR.hipZ));
    const hipR = f.pelvis.localToWorld(V3(-ANCHOR.hipX * MIR, ANCHOR.hipY, ANCHOR.hipZ));
    const ankle = (s, heel) => {
      const toe = feet[s].clone().add(V3(0, -0.015, 0.16));
      toe.x *= MIR;
      const phi = heel * 62 * DEG;
      return { a: toe.clone().add(V3(0, 0.18 * Math.sin(phi) + 0.015, -0.18 * Math.cos(phi))), phi, toe };
    };
    const aL = ankle('L', p.leadHeel), aR = ankle('R', p.trailHeel);
    const knL = solveIK(hipL, aL.a, LEG.thigh, LEG.shin, hipL.clone().add(V3(0.15 * MIR, -0.5, 1.2)));
    const knR = solveIK(hipR, aR.a, LEG.thigh, LEG.shin, hipR.clone().add(V3(-0.15 * MIR, -0.5, 1.2)));
    placeSegment(f.legs.L.thigh, hipL, knL, LEG.thigh); placeSegment(f.legs.L.shin, knL, aL.a, LEG.shin);
    placeSegment(f.legs.R.thigh, hipR, knR, LEG.thigh); placeSegment(f.legs.R.shin, knR, aR.a, LEG.shin);
    f.legs.L.knee.position.copy(knL); f.legs.R.knee.position.copy(knR);
    f.dyn['knee:L'].position.copy(knL); f.dyn['knee:R'].position.copy(knR);
    [['L', aL], ['R', aR]].forEach(([s, a]) => {
      const foot = f.legs[s].foot;
      foot.position.copy(a.toe).add(V3(0, 0.03, -0.09));
      foot.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2 - a.phi, (s === 'L' ? -0.2 : 0.05) * MIR, 0, 'YXZ'));
      // rotate about the toe for heel lift
      if (a.phi > 0) {
        const off = foot.position.clone().sub(a.toe);
        off.applyAxisAngle(V3(1, 0, 0), a.phi);
        foot.position.copy(a.toe).add(off);
      }
    });

    // skull keeps eyes down until the finish
    f.skull.rotation.set(lerp(0.15, -0.1, smooth(clamp((t - 0.75) / 0.25, 0, 1))), 0, 0);

    return { p, L };
  }

  /* ================= real anatomy =================
     The skeleton above is procedural and is what you see the instant the lab opens. If
     assets/anatomy/spine.bin arrives — BodyParts3D 4.0 vertebrae, discs, sacrum, hip bones,
     ribs, costal cartilage and sternum, decimated and re-origined onto this joint chain at
     build time — the boxes and cylinders are swapped out for it in place.

     What deliberately does NOT change: every bone object, its name, its userData.base rest
     angle, its per-bone material, its region, and the order of vertebrae[]. pose() still writes
     the same Euler on the same bone, computeLoad() never sees geometry at all, and CAP.lumbar
     is untouched. So the hip / shoulder / X-factor readouts, the lumbar degrees and the overload
     meter are numerically identical with the asset and without it — the asset is pure skin.

     What does change: b.position, the chain offset, which becomes a full 3-vector measured
     between real disc centres instead of a bare +Y. That is the one thing that must move, or
     the real vertebrae interpenetrate. Everything downstream of a moved bone origin is fixed up
     here: the shoulder and hip anchors, the girdle group, and the torso's skin bind. */
  const ANATOMY_URL = 'assets/anatomy/spine.bin.gz';   // gzipped: the host will not compress octet-stream
  let anatomyState = 'idle';   // idle | loading | ready | failed | skipped

  function warn(msg, err) { if (window.console && console.warn) console.warn(msg, err && err.message ? err.message : err); }

  function disposeSubtree(obj) {
    /* Geometries are per-instance here; materials are shared (boneMat, discMat, the per-bone
       clone) and are still in use, so they are never disposed. */
    obj.traverse(o => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
  }

  function realMesh(geo, mat, shadow) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = !!shadow; m.receiveShadow = false;
    return m;
  }

  /* Swap the loaded geometry onto the live figure. Throws if the payload does not match the rig;
     everything is validated before a single object is removed, so a bad asset leaves the
     procedural skeleton exactly as it was rather than half-dismantled. */
  function applyAnatomy(a) {
    if (!F || !a || !a.parts || !a.rig || !a.rig.bones) throw new Error('anatomy payload is unusable');
    const rig = a.rig, rb = rig.bones, parts = a.parts;
    if (rb.length !== F.vertebrae.length) throw new Error('anatomy rig has ' + rb.length + ' bones, the lab has ' + F.vertebrae.length);
    for (let i = 0; i < rb.length; i++) {
      const name = F.vertebrae[i].name;
      if (rb[i].label !== name) throw new Error('anatomy rig bone ' + i + ' is "' + rb[i].label + '", the lab has "' + name + '"');
      if (!rb[i].offset || rb[i].offset.length !== 3) throw new Error('anatomy rig bone ' + name + ' has no offset');
      if (!parts['vert_' + name]) throw new Error('anatomy is missing vert_' + name);
    }
    if (!parts.sacrum || !parts.hip_L || !parts.hip_R) throw new Error('anatomy is missing the pelvis');

    // 1. the chain. Offsets are now full 3-vectors: the Z terms are the real lordosis/kyphosis.
    const hosts = { pelvis: F.pelvis };
    F.vertebrae.forEach((b, i) => { b.position.fromArray(rb[i].offset); hosts[b.name] = b; });

    // 2. retire the procedural meshes. Only the objects buildFigure() tagged, so the hit-region
    //    proxies, the ribs' bones and the girdle all survive untouched.
    F.bones.forEach(b => {
      const proc = b.userData.proc;
      if (!proc) return;
      proc.forEach(o => { b.remove(o); disposeSubtree(o); });
      b.userData.proc = null;
    });

    // 3. attach the real parts. Geometry is already in its target bone's local frame, so every
    //    child transform is identity. Vertebrae take the bone's own material — that is the hook
    //    applyStress() lights up. Discs keep the shared discMat, so discs still never glow.
    let attached = 0;
    for (let i = 0; i < a.order.length; i++) {
      const geo = parts[a.order[i]], md = (geo && geo.userData) || {};
      const host = hosts[md.bone];
      if (!geo || !host) continue;
      let mat = boneMat, shadow = true;
      if (md.group === 'disc') { mat = discMat; shadow = false; }          // interior, never casts
      else if (md.group === 'cartilage') { shadow = false; }               // interior, never casts
      else if (md.group === 'vertebra') { mat = host.userData.mat || boneMat; }
      host.add(realMesh(geo, mat, shadow));
      attached++;
    }
    if (!attached) throw new Error('anatomy contained no attachable parts');

    // 4. anchors. T2's origin has moved down and forward; shifting the shoulder anchor by the
    //    same amount puts the joint back at the identical world point, so the arm IK, reachOut,
    //    the club and the keyframes are unaffected. The girdle meshes ride along.
    const sa = rig.shoulderAnchor && rig.shoulderAnchor.new;
    if (sa && sa.length === 3) {
      const dy = sa[1] - ANCHOR.shY, dz = sa[2] - ANCHOR.shZ;
      ANCHOR.shX = Math.abs(sa[0]); ANCHOR.shY = sa[1]; ANCHOR.shZ = sa[2];
      if (F.girdle) F.girdle.position.set(0, dy, dz);
    }
    const ha = rig.hipAnchorHint;   // the real femoral head centres, pelvis-local
    if (ha && ha.length === 3) { ANCHOR.hipX = Math.abs(ha[0]); ANCHOR.hipY = ha[1]; ANCHOR.hipZ = ha[2]; }
    applyAnchors();

    // 5. the skinned torso was bound to the old chain; rebind it to the new one.
    if (F.torso) skinTorso(F.root, F.bones, F.torso);

    // 6. the ghosts are polylines through the bone origins, which have just moved.
    ghostDirty = true;
    if (state.ghosts && ghostGroup) { try { buildGhosts(); } catch (e) { warn('lab3d: ghost rebuild failed', e); } }

    pose(state.t);
    return attached;
  }

  /* Fetch and decode off the critical path. Never blocks first paint, never blocks the swing:
     init() has already built, posed and started the scene before this runs, and every failure
     path just leaves the procedural skeleton on screen. */
  function loadAnatomy() {
    if (anatomyState !== 'idle' || !inited || !F) return;
    if (!window.Anatomy || !window.Anatomy.load || !window.Promise) { anatomyState = 'skipped'; return; }
    anatomyState = 'loading';
    let p;
    try { p = window.Anatomy.load(ANATOMY_URL, { sliceMs: 6, timeoutMs: 12000 }); }
    catch (e) { anatomyState = 'failed'; warn('lab3d: anatomy loader refused the request', e); return; }
    p.then(a => {
      try {
        const n = applyAnatomy(a);
        anatomyState = 'ready';
        emit('anatomy', { ok: true, parts: n, triangles: a.counts ? a.counts.trianglesOnScreen : 0, licence: a.licence });
      } catch (err) {
        anatomyState = 'failed';
        warn('lab3d: real anatomy could not be applied, keeping the procedural spine', err);
        emit('anatomy', { ok: false, error: String(err && err.message || err) });
      }
    }, err => {
      anatomyState = 'failed';
      warn('lab3d: anatomy asset unavailable, keeping the procedural spine', err);
      emit('anatomy', { ok: false, error: String(err && err.message || err) });
    });
  }

  /* ---------- scene ---------- */
  function makeGroundTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const g = c.getContext('2d');
    const a = '#' + COLORS.ground.toString(16).padStart(6, '0'), b = '#' + COLORS.groundAlt.toString(16).padStart(6, '0');
    const band = 46;
    for (let y = 0; y < 1024; y += band) { g.fillStyle = (Math.floor(y / band) % 2) ? a : b; g.fillRect(0, y, 1024, band); }
    // grain
    const img = g.getImageData(0, 0, 1024, 1024), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4.9, 4.9);
    tex.anisotropy = 8;
    return tex;
  }

  function makeSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.35, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.fog);
    scene.fog = new THREE.FogExp2(COLORS.fog, 0.055);
    spriteTex = makeSprite();

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const hemi = new THREE.HemisphereLight(0x9fd0b8, 0x08150f, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1d8, 2.6);
    key.position.set(2.5, 4.2, 3.0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -2.2;
    key.shadow.camera.right = key.shadow.camera.top = 2.2;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 12;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ec9ff, 0.7);
    fill.position.set(-3, 2, -1);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffb063, 1.15);   // stands in for the low sun behind the golfer
    rim.position.copy(SUN_DIR).multiplyScalar(6);
    scene.add(rim);

    // ground
    const groundGeo = new THREE.RingGeometry(0.0001, 30, 96, 12);
    const gp = groundGeo.attributes.position;
    const gc = new Float32Array(gp.count * 3);
    for (let i = 0; i < gp.count; i++) {
      const rr = Math.hypot(gp.getX(i), gp.getY(i)) / 30;
      const k = 1 - 0.86 * smooth(clamp((rr - 0.06) / 0.5, 0, 1));
      gc[i * 3] = gc[i * 3 + 1] = gc[i * 3 + 2] = k;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
      map: makeGroundTexture(), roughness: 0.72, metalness: 0.03, vertexColors: true, envMapIntensity: 0.35
    }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);
    groundRing = new THREE.Mesh(new THREE.RingGeometry(1.22, 1.25, 96), new THREE.MeshBasicMaterial({ color: COLORS.rim, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    groundRing.rotation.x = -Math.PI / 2; groundRing.position.y = 0.004;
    scene.add(groundRing);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.9, 1.905, 96), new THREE.MeshBasicMaterial({ color: COLORS.rim, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
    ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.004;
    scene.add(ring2);

    // ball and tee
    ball = new THREE.Group();
    const b = sphere(0.0214, new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.8, transparent: true, opacity: 1 }), 24);
    b.position.y = 0.0214 + 0.028;
    ball.add(b);
    ballMesh = b; ballHome = b.position.clone();
    const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.004, 0.035, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
    tee.position.y = 0.0175; tee.castShadow = true;
    ball.add(tee);
    ballTeeMesh = tee;
    scene.add(ball);

    // dew particles
    const N = 380, arr = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 7; arr[i * 3 + 1] = Math.random() * 2.6; arr[i * 3 + 2] = (Math.random() - 0.5) * 7;
      vel[i] = 0.04 + Math.random() * 0.08;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: COLORS.rim, size: 0.035, map: spriteTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    particles.userData.vel = vel;
    scene.add(particles);

    // figure
    makeMaterials();
    F = buildFigure();
    scene.add(F.root);
    hitMeshes = F.regions;

    // tracks resolve the address and impact shaft directions, which is what places the ball
    buildTracks();
    buildEffects();
    placeBall();
  }

  /* Ball, tee and the struck-ball origin. ballPos.y is the tee height, so a driver ball sits up
     and a wedge ball sits on the turf; the shaft is aimed at it, so the clubhead meets it for
     any shaft length or ball position. */
  function placeBall() {
    if (!ball) return;
    ball.position.set(ballPos.x * MIR, 0, ballPos.z);
    if (ballMesh) { ballMesh.position.y = 0.0214 + 0.028 + ballTee; ballHome = ballMesh.position.clone(); }
    if (ballTeeMesh) { ballTeeMesh.visible = ballTee > 0.001; ballTeeMesh.scale.y = 1 + ballTee / 0.035; ballTeeMesh.position.y = 0.0175 * ballTeeMesh.scale.y; }
    if (shock) shock.position.set(ballPos.x * MIR, 0.014, ballPos.z);
    if (flashLight) flashLight.position.set(ballPos.x * MIR, 0.12 + ballTee, ballPos.z);
  }

  /* ================= atmosphere, trace, gauges, embers, ghosts =================
     Everything below is decoration: it reads the swing but never drives it, and every
     builder is wrapped by the caller so a failure on a software renderer can only cost
     an effect, never the scene. */

  const SUN_DIR = new THREE.Vector3(-0.34, 0.075, -1).normalize();

  function makeGlowTexture(size, stops) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => rg.addColorStop(o, col));
    g.fillStyle = rg; g.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  /* Dawn sky: a big inverted sphere, gradient in the fragment shader, warm band at the sun. */
  function buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color(COLORS.skyZenith) },
        uMid: { value: new THREE.Color(COLORS.skyMid) },
        uHorizon: { value: new THREE.Color(COLORS.skyHorizon) },
        uGold: { value: new THREE.Color(COLORS.skySun) },
        uSun: { value: SUN_DIR.clone() }
      },
      vertexShader: 'varying vec3 vDir;\nvoid main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uZenith, uMid, uHorizon, uGold, uSun;',
        'void main(){',
        '  vec3 d = normalize(vDir);',
        '  float h = d.y;',
        '  vec3 col = mix(uMid, uZenith, smoothstep(0.06, 0.70, h));',
        '  col = mix(uHorizon, col, smoothstep(-0.03, 0.26, h));',
        '  float sd = max(dot(d, normalize(uSun)), 0.0);',
        '  float band = exp(-abs(h) * 20.0);',
        '  col += uGold * pow(sd, 3.0) * band * 0.42;',
        '  col += uGold * pow(sd, 22.0) * exp(-abs(h) * 6.0) * 0.20;',
        '  col += uGold * pow(sd, 90.0) * 0.55;',
        '  col *= mix(0.22, 1.0, smoothstep(-0.32, 0.0, h));',
        '  gl_FragColor = vec4(col, 1.0);',
        '  #include <tonemapping_fragment>',
        '}'
      ].join('\n')
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(34, 40, 24), mat);
    sky.frustumCulled = false; sky.renderOrder = -20;
    scene.add(sky);

    sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(128, [[0, 'rgba(255,245,215,1)'], [0.12, 'rgba(255,206,132,0.75)'], [0.38, 'rgba(255,158,80,0.16)'], [1, 'rgba(255,150,70,0)']]),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.62
    }));
    sunDisc.position.copy(SUN_DIR).multiplyScalar(26);
    sunDisc.scale.set(5.4, 5.4, 1);
    sunDisc.renderOrder = 1;
    scene.add(sunDisc);
  }

  /* Three billboarded gradient planes near the sun read as light shafts through the trees. */
  function buildShafts() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 256;
    const g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, 256);
    lg.addColorStop(0, 'rgba(255,214,150,0)'); lg.addColorStop(0.42, 'rgba(255,214,150,0.75)'); lg.addColorStop(1, 'rgba(255,214,150,0)');
    g.fillStyle = lg; g.fillRect(0, 0, 32, 256);
    const hg = g.createLinearGradient(0, 0, 32, 0);
    hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = hg; g.fillRect(0, 0, 32, 256);
    const tex = new THREE.CanvasTexture(c);
    shafts = new THREE.Group();
    const base = Math.atan2(SUN_DIR.x, SUN_DIR.z);
    [[-0.15, 1.7, 0.085], [0.02, 1.0, 0.10], [0.21, 2.3, 0.06]].forEach(([off, w, op], i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 13), new THREE.MeshBasicMaterial({
        map: tex, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide
      }));
      const a = base + off;
      m.position.set(Math.sin(a) * 16, 5.2, Math.cos(a) * 16);
      m.rotation.order = 'YXZ';
      m.rotation.z = (i - 1) * 0.1;
      m.userData.phase = i * 2.1;
      m.userData.y0 = 5.2;
      shafts.add(m);
    });
    scene.add(shafts);
  }

  /* Slowly turning hex/scan plate under the golfer. */
  function makeHexTexture() {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    const r = 26, h = Math.sqrt(3) / 2 * r;
    g.strokeStyle = 'rgba(191,245,220,0.55)'; g.lineWidth = 1.1;
    for (let row = -1; row * h * 2 < S + 60; row++) {
      for (let col = -1; col * r * 1.5 < S + 60; col++) {
        const cx = col * r * 1.5, cy = row * h * 2 + (col % 2 ? h : 0);
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = k * Math.PI / 3;
          const x = cx + r * 0.86 * Math.cos(a), y = cy + r * 0.86 * Math.sin(a);
          k ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath(); g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-atop';
    for (let y = 0; y < S; y += 6) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, y, S, 3); }
    g.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 48; k++) {
      const a = k / 48 * Math.PI * 2, long = k % 4 === 0;
      g.strokeStyle = long ? 'rgba(246,197,68,0.75)' : 'rgba(191,245,220,0.5)';
      g.lineWidth = long ? 2.4 : 1.2;
      g.beginPath();
      g.moveTo(S / 2 + Math.cos(a) * (long ? 214 : 224), S / 2 + Math.sin(a) * (long ? 214 : 224));
      g.lineTo(S / 2 + Math.cos(a) * 244, S / 2 + Math.sin(a) * 244);
      g.stroke();
    }
    return new THREE.CanvasTexture(c);
  }

  function buildHexRing() {
    const mat = new THREE.MeshBasicMaterial({
      map: makeHexTexture(), transparent: true, opacity: 0.30, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
    });
    hexRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 1.21, 96, 1), mat);
    hexRing.rotation.x = -Math.PI / 2;
    hexRing.position.y = 0.006;
    hexRing.renderOrder = 3;
    scene.add(hexRing);
  }

  /* ---------- swing trace ----------
     The club head is a pure function of t (grip curve + shaft direction), so the trail is
     rebuilt from the last slice of the swing every frame: no history to clear on seek. */
  const TRACE = { club: 44, hand: 26, spanClub: 0.255, spanHand: 0.13 };
  const tracePts = [];
  for (let i = 0; i < 64; i++) tracePts.push(V3());
  const traceTmp = { dir: V3(), cam: V3(), side: V3(), col: new THREE.Color() };

  function traceAt(t, out, head) {
    vecAt('hands', t, out);
    if (head) { vecAt('club', t, traceTmp.dir); out.addScaledVector(traceTmp.dir.normalize(), CLUB_LEN); }
    return out;
  }

  function makeRibbon(n) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 9), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 9), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint16Array((n - 1) * 12);
    for (let i = 0; i < n - 1; i++) {
      const a = i * 3;
      idx.set([a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4], i * 12);
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    }));
    mesh.frustumCulled = false; mesh.renderOrder = 8;
    mesh.userData.n = n;
    return mesh;
  }

  function updateRibbon(mesh, t, span, head, width, color, gain) {
    const n = mesh.userData.n;
    const P = mesh.geometry.attributes.position, C = mesh.geometry.attributes.color;
    for (let i = 0; i < n; i++) traceAt(Math.max(t - span * (i / (n - 1)), 0), tracePts[i], head);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const a = tracePts[Math.max(i - 1, 0)], b = tracePts[Math.min(i + 1, n - 1)], c = tracePts[i];
      traceTmp.dir.copy(b).sub(a);
      traceTmp.cam.copy(camera.position).sub(c);
      traceTmp.side.crossVectors(traceTmp.dir, traceTmp.cam);
      const l = traceTmp.side.length();
      if (l > 1e-6) traceTmp.side.multiplyScalar(1 / l); else traceTmp.side.set(0, 1, 0);
      const w = width * (0.26 + 0.74 * (1 - u)) * 0.5;
      const b3 = i * 3;
      P.setXYZ(b3, c.x + traceTmp.side.x * w, c.y + traceTmp.side.y * w, c.z + traceTmp.side.z * w);
      P.setXYZ(b3 + 1, c.x, c.y, c.z);
      P.setXYZ(b3 + 2, c.x - traceTmp.side.x * w, c.y - traceTmp.side.y * w, c.z - traceTmp.side.z * w);
      const alive = (t - span * u) > 0 ? 1 : 0;
      let f = Math.pow(1 - u, 1.7) * gain * alive;
      if (i < 3) f += (3 - i) * 0.12 * alive;
      traceTmp.col.copy(color).multiplyScalar(f);
      const e = 0.22;
      C.setXYZ(b3, traceTmp.col.r * e, traceTmp.col.g * e, traceTmp.col.b * e);
      C.setXYZ(b3 + 1, traceTmp.col.r, traceTmp.col.g, traceTmp.col.b);
      C.setXYZ(b3 + 2, traceTmp.col.r * e, traceTmp.col.g * e, traceTmp.col.b * e);
    }
    P.needsUpdate = true; C.needsUpdate = true;
  }

  function buildTrails() {
    clubTrail = makeRibbon(TRACE.club);
    handTrail = makeRibbon(TRACE.hand);
    scene.add(clubTrail); scene.add(handTrail);
  }

  /* ---------- rotation gauges ---------- */
  const ARCSEG = 64;
  const cOk = new THREE.Color(COLORS.ok), cWarn = new THREE.Color(COLORS.warn), cRim = new THREE.Color(COLORS.rim);
  const arcCol = new THREE.Color();

  function makeArc(y, r0, r1, color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((ARCSEG + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((ARCSEG + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = new Uint16Array(ARCSEG * 6);
    for (let i = 0; i < ARCSEG; i++) { const a = i * 2; idx.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    }));
    mesh.frustumCulled = false; mesh.renderOrder = 7;
    mesh.userData = { y, r0, r1, color: new THREE.Color(color) };
    return mesh;
  }

  function updateArc(mesh, cx, a0, a1, color) {
    const u = mesh.userData, P = mesh.geometry.attributes.position, C = mesh.geometry.attributes.color;
    const c = color || u.color, span = a1 - a0;
    for (let i = 0; i <= ARCSEG; i++) {
      const k = i / ARCSEG, a = a0 + span * k;
      const s = Math.sin(a), co = Math.cos(a);
      P.setXYZ(i * 2, cx + u.r0 * s, u.y, u.r0 * co);
      P.setXYZ(i * 2 + 1, cx + u.r1 * s, u.y, u.r1 * co);
      const lead = 0.42 + 1.15 * Math.pow(k, 2.5);
      C.setXYZ(i * 2, c.r * lead, c.g * lead, c.b * lead);
      C.setXYZ(i * 2 + 1, c.r * lead * 0.45, c.g * lead * 0.45, c.b * lead * 0.45);
    }
    P.needsUpdate = true; C.needsUpdate = true;
    mesh.material.opacity = clamp((Math.abs(span) - 0.04) / 0.10, 0, 1);   // dead zone: no gauge under ~2 degrees
    return a0 + span; // leading angle, for the label
  }

  function makeLabel() {
    const c = document.createElement('canvas'); c.width = 192; c.height = 84;
    const tex = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, opacity: 0 }));
    sp.scale.set(0.36, 0.157, 1);
    sp.renderOrder = 30;
    sp.userData = { c, tex, last: '' };
    return sp;
  }

  function setLabel(sp, num, caption, css) {
    const key = num + '|' + caption + '|' + css;
    if (sp.userData.last === key) return;
    sp.userData.last = key;
    const c = sp.userData.c, g = c.getContext('2d');
    g.clearRect(0, 0, 192, 84);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 10;
    g.fillStyle = css;
    g.font = '800 46px Archivo, system-ui, sans-serif';
    g.fillText(num + '°', 96, 32);
    g.font = '700 20px Atkinson Hyperlegible, system-ui, sans-serif';
    g.fillStyle = 'rgba(233,244,236,0.85)';
    g.fillText(caption, 96, 66);
    sp.userData.tex.needsUpdate = true;
  }

  function buildArcs() {
    arcGroup = new THREE.Group();
    arcHip = makeArc(0.90, 0.40, 0.475, COLORS.ok);
    arcSh = makeArc(1.40, 0.52, 0.595, COLORS.accent);
    arcX = makeArc(1.17, 0.475, 0.515, COLORS.warn);
    labHip = makeLabel(); labSh = makeLabel(); labX = makeLabel();
    [arcHip, arcSh, arcX, labHip, labSh, labX].forEach(o => arcGroup.add(o));
    scene.add(arcGroup);
  }

  function updateGauges(L, p) {
    if (!arcGroup) return;
    const cx = p.shift;
    const aHip = -L.hipTurn * DEG * MIR, aSh = -p.torso * DEG * MIR;
    updateArc(arcHip, cx, 0, aHip);
    updateArc(arcSh, cx, 0, aSh);
    const x = Math.abs(L.xfactor);
    arcCol.copy(cOk).lerp(cWarn, clamp((x - 30) / 22, 0, 1)).lerp(cStop, clamp((x - 52) / 20, 0, 1));
    updateArc(arcX, cx, aHip, aSh, arcCol);
    const place = (sp, arc, a, r) => {
      sp.position.set(cx + Math.sin(a) * r, arc.userData.y + 0.075, Math.cos(a) * r);
      sp.material.opacity = arc.material.opacity;
    };
    place(labHip, arcHip, aHip, 0.60);
    place(labSh, arcSh, aSh, 0.72);
    place(labX, arcX, (aHip + aSh) / 2, 0.66);
    setLabel(labHip, Math.round(Math.abs(L.hipTurn)), 'hips', '#5ccb8c');
    setLabel(labSh, Math.round(Math.abs(p.torso)), 'shoulders', '#f6c544');
    setLabel(labX, Math.round(x), 'X-factor', '#' + arcCol.getHexString());
  }

  /* ---------- lumbar overload ---------- */
  const EMB = 96;
  const embHot = new THREE.Color(0xffd08a), embMid = new THREE.Color(COLORS.ember), embCold = new THREE.Color(COLORS.stop);
  const embCol = new THREE.Color();

  function buildEmbers() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(EMB * 3);
    for (let i = 0; i < EMB; i++) pos[i * 3 + 1] = -50;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(EMB * 3), 3).setUsage(THREE.DynamicDrawUsage));
    embers = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.075, map: spriteTex, vertexColors: true, transparent: true, opacity: 1,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false
    }));
    embers.frustumCulled = false; embers.renderOrder = 9;
    embers.userData = { life: new Float32Array(EMB), vel: new Float32Array(EMB * 3), cursor: 0, budget: 0 };
    scene.add(embers);
    lumbarLight = new THREE.PointLight(0xff7a3c, 0, 0.85, 2);
    scene.add(lumbarLight);
  }

  function updateEmbers(dt, stress) {
    if (!embers) return;
    const d = embers.userData, P = embers.geometry.attributes.position, C = embers.geometry.attributes.color;
    const over = clamp(stress - 1, 0, 1.2);
    const lum = F.vertebrae[2];
    lum.getWorldPosition(tmp.a);
    if (lumbarLight) {
      const pulse = reduced ? 0.85 : 0.6 + 0.4 * Math.sin(clock.elapsedTime * 5.5);
      lumbarLight.position.copy(tmp.a);
      lumbarLight.intensity += ((over > 0 ? 0.9 + over * 4.5 * pulse : 0) - lumbarLight.intensity) * Math.min(1, dt * 9);
      lumbarLight.color.copy(embMid).lerp(embCold, clamp(over, 0, 1));
    }
    if (over > 0 && !reduced) {
      d.budget += dt * (20 + over * 70);
      while (d.budget >= 1) {
        d.budget -= 1;
        const i = d.cursor; d.cursor = (d.cursor + 1) % EMB;
        const v = F.vertebrae[Math.floor(Math.random() * 5)];
        const ang = Math.random() * Math.PI * 2;
        tmp.b.set(Math.sin(ang) * 0.15, (Math.random() - 0.5) * 0.04, Math.cos(ang) * 0.13 - 0.02);
        v.localToWorld(tmp.b);
        P.setXYZ(i, tmp.b.x, tmp.b.y, tmp.b.z);
        d.vel[i * 3] = (Math.random() - 0.5) * 0.14;
        d.vel[i * 3 + 1] = 0.20 + Math.random() * 0.36;
        d.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.14;
        d.life[i] = 1;
      }
    }
    let any = false;
    for (let i = 0; i < EMB; i++) {
      if (d.life[i] <= 0) continue;
      any = true;
      d.life[i] = Math.max(0, d.life[i] - dt / (0.75 + (i % 5) * 0.09));
      const l = d.life[i];
      P.setXYZ(i, P.getX(i) + d.vel[i * 3] * dt, P.getY(i) + d.vel[i * 3 + 1] * dt, P.getZ(i) + d.vel[i * 3 + 2] * dt);
      d.vel[i * 3 + 1] += dt * 0.10;
      embCol.copy(embCold).lerp(embMid, clamp(l * 1.6, 0, 1)).lerp(embHot, clamp((l - 0.72) / 0.28, 0, 1));
      const f = clamp(l * 5, 0, 1) * Math.pow(l, 0.45) * 1.7;
      C.setXYZ(i, embCol.r * f, embCol.g * f, embCol.b * f);
      if (l <= 0) { P.setXYZ(i, 0, -50, 0); C.setXYZ(i, 0, 0, 0); }
    }
    embers.visible = any;
    if (any) { P.needsUpdate = true; C.needsUpdate = true; }
  }

  /* ---------- impact ---------- */
  function buildImpact() {
    shock = new THREE.Mesh(new THREE.RingGeometry(0.84, 1.0, 80), new THREE.MeshBasicMaterial({
      color: 0xffe9b8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    }));
    shock.rotation.x = -Math.PI / 2;
    shock.position.set(ballPos.x, 0.014, ballPos.z);
    shock.visible = false; shock.renderOrder = 6;
    scene.add(shock);
    flashLight = new THREE.PointLight(0xfff0c8, 0, 3.5, 2);
    flashLight.position.set(ballPos.x, 0.12, ballPos.z);
    scene.add(flashLight);
  }

  function fireImpact() {
    impact.ring = 1; impact.flash = 1;
    if (state.playing) impact.launch = 0;
    if (!reduced) shakeAmt = 1;
  }

  function resetImpact() {
    impact.ring = 0; impact.flash = 0; impact.launch = -1; shakeAmt = 0;
    if (shock) { shock.visible = false; shock.material.opacity = 0; }
    if (flashLight) flashLight.intensity = 0;
    if (ballMesh && ballHome) { ballMesh.position.copy(ballHome); ballMesh.material.opacity = 1; ballMesh.visible = true; }
  }

  function updateImpact(dt) {
    if (impact.ring > 0 && shock) {
      impact.ring = Math.max(0, impact.ring - dt / 0.75);
      const k = 1 - impact.ring;
      shock.visible = true;
      shock.scale.setScalar(0.12 + k * k * 2.0);
      shock.material.opacity = Math.pow(impact.ring, 1.1);
      if (impact.ring === 0) shock.visible = false;
    }
    if (impact.flash > 0 && flashLight) {
      impact.flash = Math.max(0, impact.flash - dt / 0.22);
      flashLight.intensity = impact.flash * impact.flash * 12;
    }
    if (impact.launch >= 0 && ballMesh) {
      impact.launch += dt / 1.5;
      const u = impact.launch;
      if (u >= 1) { impact.launch = -1; ballMesh.visible = false; }
      else {
        ballMesh.visible = true;
        ballMesh.position.set(ballHome.x + 12 * u * MIR, ballHome.y + (7.6 * u - 6.2 * u * u), ballHome.z - 0.9 * u);
        ballMesh.material.opacity = clamp(1 - (u - 0.45) / 0.55, 0, 1);
      }
    }
    if (shakeAmt > 0) shakeAmt = Math.max(0, shakeAmt - dt / 0.42);
  }

  /* ---------- ghosts ---------- */
  const GHOSTS = [
    { t: 0.00, color: 0x8ff0d4 },
    { t: 0.50, color: 0xffd166 },
    { t: 0.70, color: 0xff9d70 }
  ];

  function ghostSegments() {
    const segs = [];
    let prev = F.pelvis.getWorldPosition(V3());
    F.vertebrae.forEach(b => { const q = b.getWorldPosition(V3()); segs.push([prev, q]); prev = q; });
    segs.push([prev, F.skull.localToWorld(V3(0, 0.11, 0.015))]);
    const shL = F.t2.localToWorld(V3(ANCHOR.shX * MIR, ANCHOR.shY, ANCHOR.shZ)), shR = F.t2.localToWorld(V3(-ANCHOR.shX * MIR, ANCHOR.shY, ANCHOR.shZ));
    const hipL = F.pelvis.localToWorld(V3(ANCHOR.hipX * MIR, ANCHOR.hipY, ANCHOR.hipZ)), hipR = F.pelvis.localToWorld(V3(-ANCHOR.hipX * MIR, ANCHOR.hipY, ANCHOR.hipZ));
    segs.push([shL.clone(), shR.clone()]);
    segs.push([hipL.clone(), hipR.clone()]);
    ['L', 'R'].forEach(s => {
      const sh = (s === 'L' ? shL : shR).clone(), hp = (s === 'L' ? hipL : hipR).clone();
      const el = F.arms[s].elbow.position.clone(), hd = F.arms[s].hand.position.clone();
      const kn = F.legs[s].knee.position.clone(), ft = F.legs[s].foot.position.clone();
      segs.push([sh, el], [el.clone(), hd], [hp, kn], [kn.clone(), ft]);
    });
    const grip = F.club.position.clone();
    const dir = V3(0, -1, 0).applyQuaternion(F.club.quaternion).multiplyScalar(CLUB_LEN);
    segs.push([grip, grip.clone().add(dir)]);
    return segs;
  }

  function disposeGhosts() {
    if (!ghostGroup) return;
    scene.remove(ghostGroup);
    ghostGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    ghostGroup = null;
  }

  function buildGhosts() {
    if (!inited || !F) return;
    disposeGhosts();
    ghostGroup = new THREE.Group();
    const keep = state.t;
    GHOSTS.forEach(gh => {
      pose(gh.t);
      const segs = ghostSegments();
      const arr = new Float32Array(segs.length * 6), jnt = new Float32Array(segs.length * 3);
      segs.forEach((sg, i) => {
        arr.set([sg[0].x, sg[0].y, sg[0].z, sg[1].x, sg[1].y, sg[1].z], i * 6);
        jnt.set([sg[1].x, sg[1].y, sg[1].z], i * 3);
      });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const line = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
        color: gh.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false
      }));
      line.renderOrder = 4; line.userData.t = gh.t; line.frustumCulled = false;
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.BufferAttribute(jnt, 3));
      const dots = new THREE.Points(pg, new THREE.PointsMaterial({
        color: gh.color, size: 0.034, map: spriteTex, transparent: true, opacity: 0.75,
        depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false
      }));
      dots.renderOrder = 4; dots.userData.t = gh.t; dots.frustumCulled = false;
      ghostGroup.add(line); ghostGroup.add(dots);
    });
    pose(keep);
    ghostGroup.visible = state.ghosts;
    scene.add(ghostGroup);
    ghostDirty = false;
  }

  function updateGhosts() {
    if (!ghostGroup || !ghostGroup.visible) return;
    ghostGroup.children.forEach(o => {
      const near = clamp((Math.abs(state.t - o.userData.t) - 0.012) / 0.05, 0, 1);
      o.material.opacity = (o.isPoints ? 0.75 : 0.7) * near;
      o.visible = near > 0.01;
    });
  }

  /* ---------- vignette + grain ---------- */
  const FinishShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.03 }, uVig: { value: 0.55 } },
    vertexShader: 'varying vec2 vUv;\nvoid main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; uniform float uVig;',
      'varying vec2 vUv;',
      'float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'void main(){',
      '  vec2 d = vUv - 0.5;',
      '  float r2 = dot(d, d);',
      '  vec2 off = d * r2 * 0.010;',
      '  vec4 c = texture2D(tDiffuse, vUv);',
      '  c.r = texture2D(tDiffuse, vUv + off).r;',
      '  c.b = texture2D(tDiffuse, vUv - off).b;',
      '  float vig = pow(clamp(1.0 - r2 * 1.15, 0.0, 1.0), 1.2);',
      '  c.rgb *= mix(1.0, vig, uVig);',
      '  float g = hash(vUv * vec2(1024.0, 700.0) + fract(uTime * 0.7) * 91.0) - 0.5;',
      '  c.rgb += g * uGrain * (0.35 + 0.65 * (1.0 - vig));',
      '  gl_FragColor = c;',
      '}'
    ].join('\n')
  };

  function buildEffects() {
    const steps = [buildSky, buildShafts, buildHexRing, buildTrails, buildArcs, buildEmbers, buildImpact];
    steps.forEach(fn => { try { fn(); } catch (e) { if (window.console) console.warn('lab3d: effect skipped', e); } });
  }

  /* Per-frame effect update. Never throws into the render loop. */
  function updateEffects(dt, r) {
    const p = r.p, L = r.L;
    if (clubTrail && state.trace) {
      updateRibbon(clubTrail, state.t, TRACE.spanClub, true, 0.075, cAccent, 1.35);
      updateRibbon(handTrail, state.t, TRACE.spanHand, false, 0.04, cRim, 0.6);
    }
    updateGauges(L, p);
    updateEmbers(dt, L.stress.lumbar);
    updateImpact(dt);
    updateGhosts();
    if (hexRing) {
      hexRing.rotation.z -= dt * (reduced ? 0.02 : 0.09);
      hexRing.material.opacity = 0.22 + 0.10 * Math.sin(clock.elapsedTime * 0.9);
    }
    if (shafts) {
      shafts.children.forEach(m => {
        m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
        if (!reduced) m.position.y = m.userData.y0 + Math.sin(clock.elapsedTime * 0.16 + m.userData.phase) * 0.4;
      });
    }
    if (finishPass) finishPass.uniforms.uTime.value = clock.elapsedTime;
  }

  /* ---------- rendering ---------- */
  function setupRenderer() {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
    camera.position.set(...CAMERAS.free.pos);
  }

  function setupPost() {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { samples: 4 });
    composer = new THREE.EffectComposer(renderer, target);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.32, 0.88);
    composer.addPass(bloom);
    composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    try {
      finishPass = new THREE.ShaderPass(FinishShader);
      composer.addPass(finishPass);
    } catch (e) { finishPass = null; }
  }

  function resize() {
    if (!renderer || !container) return;
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
    camera.aspect = w / h; camera.updateProjectionMatrix();
    composer.setSize(w, h);
  }

  /* Camera presets mirror with the golfer, so "face on" is still face on for a left-hander. */
  function camPreset(name) {
    const c = CAMERAS[name] || CAMERAS.free;
    return { pos: V3(c.pos[0] * MIR, c.pos[1], c.pos[2]), target: V3(c.target[0] * MIR, c.target[1], c.target[2]) };
  }
  function setCamera(name, instant) {
    if (!camera || !controls) return;
    const c = camPreset(name);
    state.camera = CAMERAS[name] ? name : 'free';
    touch();
    if (instant) { camera.position.copy(c.pos); controls.target.copy(c.target); controls.update(); return; }
    camTween = { from: camera.position.clone(), to: c.pos, tFrom: controls.target.clone(), tTo: c.target, t: 0 };
  }

  /* Phase per second, sampled on a fine grid. rate = target clubhead speed / how far the clubhead
     moves per unit of phase, so playing the swing reproduces SPEED_SHAPE exactly whatever the
     keyframe spacing; each of the three phases is then scaled to its share of the clock, which is
     what holds the 3:1 tempo. Rebuilt whenever the tracks are, because the arc lengths move with
     the club and the golfer's own numbers. */
  const RN = 240;
  let RATE = null;

  function shapeAt(t) {
    let i = 0;
    while (i < SPEED_SHAPE.length - 2 && t > SPEED_SHAPE[i + 1][0]) i++;
    const a = SPEED_SHAPE[i], b = SPEED_SHAPE[i + 1];
    return lerp(a[1], b[1], clamp((t - a[0]) / (b[0] - a[0]), 0, 1));
  }

  function buildTempo() {
    const a = V3(), b = V3(), r = new Float64Array(RN), e = 0.5 / RN;
    for (let i = 0; i < RN; i++) {
      const t = (i + 0.5) / RN;
      traceAt(Math.max(t - e, 0), a, true);
      traceAt(Math.min(t + e, 1), b, true);
      const perPhase = b.distanceTo(a) / (2 * e);          // metres of clubhead per unit of phase
      r[i] = shapeAt(t) / Math.max(perPhase, 0.05);
    }
    // scale each phase so it takes its share of the swing
    for (let q = 0; q < TEMPO.length; q++) {
      const ph = TEMPO[q];
      let secs = 0;
      for (let i = 0; i < RN; i++) { const t = (i + 0.5) / RN; if (t >= ph[0] && t < ph[1]) secs += (1 / RN) / r[i]; }
      if (!(secs > 0)) continue;
      const k = secs / ph[2];
      for (let i = 0; i < RN; i++) { const t = (i + 0.5) / RN; if (t >= ph[0] && t < ph[1]) r[i] *= k; }
    }
    RATE = r;
  }

  function rate(t) {
    const dur = (DURATION[state.speed] || DURATION.study) * clubSpec.pace;
    if (!RATE) return 1 / dur;
    return RATE[clamp(Math.floor(clamp(t, 0, 0.9999) * RN), 0, RN - 1)] / dur;
  }

  function step(dt) {
    if (state.playing) {
      if (state.holdUntil > 0) {
        state.holdUntil -= dt;
        if (state.holdUntil <= 0) { state.holdUntil = 0; if (state.loop) { state.t = 0; resetImpact(); } else { state.dir = -1; } }
      } else if (state.dir > 0) {
        state.t += dt * rate(state.t);
        if (state.t >= 1) { state.t = 1; state.holdUntil = 0.9; }
      } else {
        state.t -= dt / 1.1;
        if (state.t <= 0) { state.t = 0; state.dir = 1; state.playing = false; emit('play', false); }
      }
    }
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt / 0.9);
      const k = smooth(camTween.t);
      camera.position.lerpVectors(camTween.from, camTween.to, k);
      controls.target.lerpVectors(camTween.tFrom, camTween.tTo, k);
      if (camTween.t >= 1) camTween = null;
    }
    // particles drift
    if (particles && !reduced) {
      const a = particles.geometry.attributes.position, v = particles.userData.vel;
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) + v[i] * dt;
        if (y > 2.8) y = 0;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    }
    if (groundRing) groundRing.material.opacity = 0.28 + 0.1 * Math.sin(clock.elapsedTime * 1.4);

    // the ball is struck the moment playback crosses the impact key
    if (state.playing && state.dir > 0 && prevT < T_IMPACT && state.t >= T_IMPACT) fireImpact();
    if (state.t < T_IMPACT - 0.04 && impact.launch < 0 && ballMesh && ballMesh.visible === false) resetImpact();
    prevT = state.t;

    // idle cinematic: nothing has happened for a while, so drift the camera
    if (controls) {
      const idle = !reduced && !state.playing && !camTween && (performance.now() - lastInteract) > 8000;
      controls.autoRotate = idle;
      controls.autoRotateSpeed = 0.3;
    }
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
    const r = pose(state.t);
    controls.update();
    if (motion.on) { try { updateMotion(dt); } catch (e) { stopMotion(); } }
    if (fxOk) { try { updateEffects(dt, r); } catch (e) { fxOk = false; if (window.console) console.warn('lab3d: effects disabled', e); } }
    let sx = 0, sy = 0, sz = 0;
    if (shakeAmt > 0) {
      const a = shakeAmt * shakeAmt * 0.05;
      sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a; sz = (Math.random() - 0.5) * a;
      camera.position.set(camera.position.x + sx, camera.position.y + sy, camera.position.z + sz);
      camera.updateMatrixWorld();
    }
    composer.render();
    if (sx || sy || sz) camera.position.set(camera.position.x - sx, camera.position.y - sy, camera.position.z - sz);
    const now = performance.now();
    if (now - lastHud > 90) {
      lastHud = now;
      emit('frame', {
        t: state.t, phase: phaseName(state.t), load: r.L, playing: state.playing,
        speed: state.speed, club: clubSpec.label, handed: state.handed,
        estimate: state.speed === 'real' ? state.estimate : null
      });
    }
  }

  /* ---------- interaction ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;

  function pick(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(hitMeshes, false);
    return hits.length ? hits[0].object : null;
  }

  function setHover(mesh) {
    if (hover === mesh) return;
    if (hover && hover !== selected) hover.visible = false;
    hover = mesh;
    if (hover) hover.visible = true;
    renderer.domElement.style.cursor = hover ? 'pointer' : '';
    emit('hover', hover ? { key: hover.userData.region, label: REGION_LABELS[hover.userData.region] } : null);
  }

  function select(mesh) {
    if (selected && selected !== mesh) selected.visible = false;
    selected = mesh;
    if (selected) selected.visible = true;
    emit('select', selected ? { key: selected.userData.region, area: selected.userData.region.split(':')[0], label: REGION_LABELS[selected.userData.region] } : null);
  }

  function touch() { lastInteract = performance.now(); if (controls) controls.autoRotate = false; }

  function bindPointer() {
    const el = renderer.domElement;
    el.addEventListener('pointerdown', touch);
    el.addEventListener('wheel', touch, { passive: true });
    el.addEventListener('pointermove', (ev) => { if (!downAt) setHover(pick(ev)); });
    el.addEventListener('pointerleave', () => setHover(null));
    el.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY]; });
    el.addEventListener('pointerup', (ev) => {
      if (downAt && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) < 6) {
        const m = pick(ev);
        select(m);
      }
      downAt = null;
    });
  }

  /* ---------- clubhead speed and carry ----------
     An estimate for THIS model, not a launch monitor. The clubhead is a known function of the
     swing phase, so its speed at impact is |d(head)/d(phase)| times the real-time phase rate
     through the downswing. The figure is modelled a little smaller than a real golfer and the
     shaft a little short, so one calibration constant maps model metres per second onto the mph a
     club golfer actually produces — anchored so the default 7-iron lands at about 80 mph, the
     middle of the 75-85 mph amateur band. Carry is a yards-per-mph factor per club, anchored on
     7-iron 80 mph -> ~149 yd, driver 95 mph -> ~230 yd. */
  const SPEED_CAL = 2.50;                 // model m/s -> mph, anchored on the default 7-iron at ~80 mph
  const measTmp = { a: V3(), b: V3() };

  function measure() {
    try {
      if (!tracks || !RATE) return null;
      const e = 0.008;
      traceAt(T_IMPACT - e, measTmp.a, true);
      traceAt(T_IMPACT, measTmp.b, true);
      const perPhase = measTmp.b.distanceTo(measTmp.a) / e;                  // metres per unit phase
      const phasePerSec = RATE[clamp(Math.floor((T_IMPACT - e / 2) * RN), 0, RN - 1)] / (DURATION.real * clubSpec.pace);
      const mph = perPhase * phasePerSec * SPEED_CAL;
      state.estimate = { mph: Math.round(mph), yards: Math.round(mph * clubSpec.carry), club: clubSpec.label };
    } catch (e) { state.estimate = null; }
    return state.estimate;
  }

  /* Rebuild everything that depends on the club, the handedness or the golfer's own numbers.
     Every step is guarded: a bad input must never leave the scene half-posed or blank. */
  function reconfigure() {
    try {
      buildTracks();
      shapeClub();
      applyAnchors();
      placeBall();
      measure();
      ghostDirty = true;
      if (state.ghosts && ghostGroup) { try { buildGhosts(); } catch (e) { warn('lab3d: ghost rebuild failed', e); } }
      if (inited && F) pose(state.t);
      emit('config', { handed: state.handed, club: state.club, mobility: state.mobility, turns: state.turns, estimate: state.estimate });
    } catch (e) { warn('lab3d: reconfigure failed', e); }
  }

  function setHanded(h) {
    const want = h === 'left' ? 'left' : 'right';
    if (want === state.handed) return state.handed;
    state.handed = want;
    MIR = want === 'left' ? -1 : 1;
    reconfigure();
    if (inited) setCamera(state.camera, true);
    return state.handed;
  }

  /* 1 = full normal mobility, 0.5 = exactly what the old stiff toggles did, 0 = none. */
  function setMobility(m) {
    if (!m) return state.mobility;
    if (typeof m.hips === 'number' && isFinite(m.hips)) state.mobility.hips = clamp(m.hips, 0, 1);
    if (typeof m.tspine === 'number' && isFinite(m.tspine)) state.mobility.tspine = clamp(m.tspine, 0, 1);
    state.faults.hips = state.mobility.hips < 0.995;
    state.faults.tspine = state.mobility.tspine < 0.995;
    ghostDirty = true;
    if (state.ghosts && ghostGroup) { try { buildGhosts(); } catch (e) { } }
    if (inited && F) pose(state.t);
    return state.mobility;
  }

  function setClub(name) {
    const spec = CLUBS[name];
    if (!spec) return state.club;
    state.club = name;
    clubSpec = spec;
    CLUB_LEN = spec.len;
    reconfigure();
    return state.club;
  }

  /* A golfer's own numbers from a lesson or a launch monitor, in degrees at the top. */
  function setTurns(o) {
    if (!o) return state.turns;
    const p = Number(o.pelvisTop), s = Number(o.torsoTop);
    if (isFinite(p) && p > 0) state.turns.pelvis = clamp(p, 5, 90) / TOP.pelvis;
    if (isFinite(s) && s > 0) state.turns.torso = clamp(s, 20, 140) / TOP.torso;
    reconfigure();
    return { pelvisTop: Math.round(state.turns.pelvis * TOP.pelvis), torsoTop: Math.round(state.turns.torso * TOP.torso) };
  }

  /* ---------- phone motion orbit ----------
     Off by default. iOS 13+ only grants DeviceOrientationEvent from inside a user gesture, so
     setMotion(true) has to be called straight from a click handler. Anything missing (desktop,
     a refused permission, a browser without the API) resolves false and changes nothing. */
  const motion = { on: false, az: 0, pol: 0, base: null, handler: null, radius: 3.4 };

  function onOrient(ev) {
    if (ev.alpha === null && ev.beta === null && ev.gamma === null) return;
    const b = (ev.beta || 0), g = (ev.gamma || 0);
    if (!motion.base) motion.base = { b, g };
    motion.az = clamp((g - motion.base.g) / 45, -1, 1) * 1.5;
    motion.pol = clamp((b - motion.base.b) / 45, -1, 1) * 0.55;
  }

  function stopMotion() {
    if (motion.handler) { try { window.removeEventListener('deviceorientation', motion.handler); } catch (e) { } }
    motion.handler = null; motion.on = false; motion.base = null;
    if (controls) controls.enabled = true;
  }

  function setMotion(on) {
    const P = window.Promise;
    if (!on) { stopMotion(); return P ? P.resolve(false) : false; }
    const ok = () => {
      if (!window.DeviceOrientationEvent) return false;
      motion.handler = onOrient;
      motion.base = null;
      const c = camPreset(state.camera);
      motion.radius = camera ? camera.position.distanceTo(controls.target) : c.pos.length();
      window.addEventListener('deviceorientation', motion.handler);
      motion.on = true;
      if (controls) controls.enabled = false;
      touch();
      return true;
    };
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') {
        return D.requestPermission().then(r => (r === 'granted' ? ok() : false), () => false);
      }
      const r = ok();
      return P ? P.resolve(r) : r;
    } catch (e) { stopMotion(); return P ? P.resolve(false) : false; }
  }

  const motionTmp = { sph: null };
  function updateMotion(dt) {
    if (!motion.on || !camera || !controls) return;
    if (!motionTmp.sph) motionTmp.sph = new THREE.Spherical();
    const base = camPreset(state.camera);
    const off = tmp.a.copy(base.pos).sub(base.target);
    motionTmp.sph.setFromVector3(off);
    motionTmp.sph.theta += motion.az;
    motionTmp.sph.phi = clamp(motionTmp.sph.phi - motion.pol, 0.25, 1.55);
    motionTmp.sph.radius = motion.radius;
    tmp.b.setFromSpherical(motionTmp.sph).add(base.target);
    camera.position.lerp(tmp.b, Math.min(1, dt * 6));
    controls.target.lerp(base.target, Math.min(1, dt * 6));
    camera.lookAt(controls.target);
  }

  /* ---------- shared user profile ----------
     The lab reads the app's profile if there is one and re-reads it when the app says it changed.
     Everything is optional and everything is guarded: no profile, a partial profile or a hostile
     one all leave the lab exactly as it was. Mobility is accepted either as a 0-1 fraction or as
     degrees (hip internal rotation out of a normal 45, thoracic rotation out of a normal 45). */
  function mobilityFrom(v, normal) {
    const n = Number(v);
    if (!isFinite(n) || n <= 0) return null;
    return clamp(n <= 1 ? n : n / normal, 0.1, 1);
  }
  function readProfile() {
    try {
      const FR = window.FR;
      if (!FR || typeof FR.profile !== 'function') return;
      const pr = FR.profile() || {};
      if (pr.handed === 'left' || pr.handed === 'right') setHanded(pr.handed);
      if (pr.club && CLUBS[pr.club]) setClub(pr.club);
      const m = pr.mobility || {};
      const hips = mobilityFrom(m.hipIR, 45), tsp = mobilityFrom(m.thoracic, 45);
      if (hips !== null || tsp !== null) setMobility({ hips: hips === null ? undefined : hips, tspine: tsp === null ? undefined : tsp });
      const tn = pr.turns || {};
      if (tn.pelvisTop || tn.torsoTop) setTurns({ pelvisTop: tn.pelvisTop, torsoTop: tn.torsoTop });
    } catch (e) { warn('lab3d: profile unreadable', e); }
  }
  /* lab3d.js loads before the app defines window.FR, so the hook is registered from init(). */
  let profileHooked = false;
  function hookProfile() {
    if (profileHooked) return;
    try {
      const FR = window.FR;
      if (!FR || typeof FR.on !== 'function') return;
      FR.on('profile:changed', () => { if (inited) readProfile(); });
      profileHooked = true;
    } catch (e) { /* optional */ }
  }

  /* ---------- public ---------- */
  function init(el, opts = {}) {
    if (inited) return true;
    if (typeof THREE === 'undefined' || !THREE.EffectComposer || !THREE.RoomEnvironment) return false;
    container = el;
    reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    clock = new THREE.Clock();
    if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
    setupRenderer();
    buildScene();
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 1.5; controls.maxDistance = 7;
    controls.maxPolarAngle = 1.62; controls.enablePan = false;
    controls.target.set(...CAMERAS.free.target);
    setupPost();
    resize();
    bindPointer();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(container);
    else window.addEventListener('resize', resize);
    inited = true;
    lastInteract = performance.now();
    shapeClub();
    hookProfile();
    readProfile();
    measure();
    pose(0);
    if (!reduced && !opts.noAuto) { setTimeout(() => play(), 900); }
    /* The real spine is an upgrade, never a dependency: the lab is already built, posed and
       about to render by this point, and if the asset is slow, missing or broken nothing here
       changes. Deliberately after first paint. */
    if (!opts.noAnatomy) setTimeout(loadAnatomy, 400);
    return true;
  }

  function start() { if (inited && raf === null) { clock.getDelta(); frame(); } }
  function stop() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }
  function play() { if (!inited) return; touch(); if (state.t >= 1) { state.t = 0; resetImpact(); } state.dir = 1; state.holdUntil = 0; state.playing = true; emit('play', true); }
  function pause() { state.playing = false; state.holdUntil = 0; state.dir = 1; emit('play', false); }
  function toggle() { touch(); state.playing ? pause() : play(); }
  function seek(t) { touch(); pause(); state.t = clamp(t, 0, 1); prevT = state.t; resetImpact(); }
  /* Kept for callers that still think in switches: the two mobility faults are now the ends of a
     slider, and "on" is the 0.5 the toggle always meant. */
  function setFault(k, v) {
    if (k === 'hips' || k === 'tspine') return setMobility({ [k]: v ? 0.5 : 1 });
    state.faults[k] = !!v;
    ghostDirty = true;
    if (state.ghosts) { try { buildGhosts(); } catch (e) { } }
    if (inited && F) pose(state.t);
  }
  function setSpeed(s) { state.speed = DURATION[s] ? s : 'study'; }
  function setLoop(v) { state.loop = !!v; }
  function setGhosts(v) {
    state.ghosts = !!v;
    try {
      if (state.ghosts && (!ghostGroup || ghostDirty)) buildGhosts();
      if (ghostGroup) ghostGroup.visible = state.ghosts;
    } catch (e) { if (window.console) console.warn('lab3d: ghosts unavailable', e); }
    return state.ghosts;
  }
  function setTrace(v) {
    state.trace = !!v;
    if (clubTrail) clubTrail.visible = state.trace;
    if (handTrail) handTrail.visible = state.trace;
    return state.trace;
  }
  function selectRegion(key) { const m = hitMeshes.find(h => h.userData.region === key); select(m || null); }
  function getState() { return state; }

  function getEstimate() { return state.estimate ? Object.assign({}, state.estimate) : null; }

  return {
    init, start, stop, play, pause, toggle, seek, setFault, setSpeed, setLoop, setCamera,
    setGhosts, setTrace, selectRegion, on, getState, phaseName, CAP,
    setHanded, setMobility, setClub, setTurns, setMotion, getEstimate, CLUBS
  };
})();

window.Lab = Lab;

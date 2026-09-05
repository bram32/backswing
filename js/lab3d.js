/* Free Relief — 3D swing lab
   A holographic golfer with a fully articulated spine. Built procedurally with three.js r147:
   no model files, everything is geometry. The spine is a chain of 24 bones; the swing's
   rotation is distributed across hips, thoracic spine, lumbar spine and shoulder girdle
   according to how compliant each region is. Stiff regions push the work elsewhere, and the
   lumbar vertebrae glow when they take more rotation than they are built for. */

const Lab = (() => {
  const DEG = Math.PI / 180;
  const CLUB_LEN = 0.88;
  const ARM = { upper: 0.30, fore: 0.27 };
  const LEG = { thigh: 0.43, shin: 0.42 };
  const CAP = { girdle: 15, thoracic: 40, lumbar: 13, cervical: 80 };
  const COMPLIANCE = { girdle: 0.35, thoracic: 1.0, thoracicStiff: 0.4, lumbar: 0.30 };

  const COLORS = {
    bg: 0x061a11, bone: 0xe9dfc6, disc: 0x7fb9c9, skin: 0x8fd9b6, rim: 0xbff5dc,
    accent: 0xf6c544, stop: 0xf0564f, ground: 0x143523, groundAlt: 0x0f2b1c, metal: 0xcfd6d3,
    ok: 0x5ccb8c, warn: 0xf08a3e, ember: 0xff7a2f,
    fog: 0x0b2a21, skyZenith: 0x020d0a, skyMid: 0x05221d, skyHorizon: 0x0d4f48, skySun: 0xff9d4e
  };

  /* Swing keyframes. Turns in degrees, positive = backswing (away from target), negative = through.
     hands and club are in root space: +x toward target, +y up, +z toward the ball. */
  const KEYS = [
    { t: 0.00, pelvis: 0,   torso: 0,    tilt: 32, side: 0,  ext: 0,  head: 0,   shift: 0.00, hands: [0.02, 0.84, 0.35],  club: null,                    trailHeel: 0,    leadHeel: 0 },
    { t: 0.18, pelvis: 8,   torso: 30,   tilt: 32, side: 2,  ext: 0,  head: -5,  shift: -0.02, hands: [-0.32, 0.86, 0.22], club: [-0.85, -0.15, 0.50],   trailHeel: 0,    leadHeel: 0 },
    { t: 0.34, pelvis: 28,  torso: 65,   tilt: 31, side: 6,  ext: 0,  head: -10, shift: -0.03, hands: [-0.48, 1.12, -0.02], club: [-0.25, 0.85, -0.45],   trailHeel: 0,    leadHeel: 0.15 },
    { t: 0.50, pelvis: 45,  torso: 95,   tilt: 30, side: 10, ext: 2,  head: -18, shift: -0.03, hands: [-0.30, 1.50, -0.22], club: [0.85, 0.15, -0.50],    trailHeel: 0,    leadHeel: 0.3 },
    { t: 0.60, pelvis: 15,  torso: 65,   tilt: 31, side: 14, ext: 0,  head: -12, shift: 0.02,  hands: [-0.42, 1.05, -0.02], club: [-0.55, -0.75, 0.35],   trailHeel: 0.1,  leadHeel: 0 },
    { t: 0.70, pelvis: -40, torso: -22,  tilt: 30, side: 22, ext: 2,  head: -5,  shift: 0.06,  hands: [0.08, 0.88, 0.40],   club: null,                    trailHeel: 0.35, leadHeel: 0 },
    { t: 0.80, pelvis: -70, torso: -80,  tilt: 22, side: 16, ext: 8,  head: 35,  shift: 0.08,  hands: [0.52, 1.02, 0.30],   club: [0.75, 0.20, 0.62],     trailHeel: 0.7,  leadHeel: 0 },
    { t: 1.00, pelvis: -90, torso: -125, tilt: 6,  side: 4,  ext: 18, head: 95,  shift: 0.10,  hands: [0.05, 1.55, -0.35],  club: [-0.30, -0.35, -0.88],  trailHeel: 1.0,  leadHeel: 0 }
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
  let shock = null, flashLight = null, ballMesh = null, ballHome = null;
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
    camera: 'free', ghosts: false, trace: true
  };

  /* ---------- helpers ---------- */
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); }
  function emit(name, data) { (listeners[name] || []).forEach(fn => fn(data)); }

  /* Interpolate the keyframes at t (0..1). Positions use Catmull-Rom for a smooth arc. */
  let handCurve = null, clubCurve = null;
  /* keyframe index -> curve parameter, shared by sample() and the swing trace */
  function keySpan(t) {
    t = clamp(t, 0, 1);
    let i = 0;
    while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    return { i, a, b, u: smooth(clamp((t - a.t) / (b.t - a.t), 0, 1)) };
  }
  function curveParam(t) { const k = keySpan(t); return (k.i + k.u) / (KEYS.length - 1); }
  function sample(t) {
    t = clamp(t, 0, 1);
    const k = keySpan(t), a = k.a, b = k.b, u = k.u;
    const out = {};
    ['pelvis', 'torso', 'tilt', 'side', 'ext', 'head', 'shift', 'trailHeel', 'leadHeel'].forEach(k2 => out[k2] = lerp(a[k2], b[k2], u));
    // curve parameter runs over keyframe indices
    const cu = (k.i + u) / (KEYS.length - 1);
    out.hands = handCurve.getPoint(cu);
    out.club = clubCurve.getPoint(cu).normalize();
    out.t = t;
    return out;
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
      if (spec.region === 'thoracic') {
        const k = (12 - parseInt(spec.label.slice(1))) / 11;
        b.add(buildRib(1, k)); b.add(buildRib(-1, k));
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
    root.updateMatrixWorld(true);
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
    torsoGeo.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    torsoGeo.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
    const torso = new THREE.SkinnedMesh(torsoGeo, skinMat);
    torso.renderOrder = 10; torso.castShadow = true; torso.frustumCulled = false;
    root.add(torso);
    torso.bind(new THREE.Skeleton(bones));

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

    // club
    const club = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0045, CLUB_LEN, 12), metalMat);
    shaft.position.y = -CLUB_LEN / 2; shaft.castShadow = true;
    club.add(shaft);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.010, 0.26, 12), gripMat);
    grip.position.y = -0.12;
    club.add(grip);
    const head = new THREE.Group();
    const blade = box(0.085, 0.052, 0.014, metalMat);
    blade.position.set(0.035, 0.02, 0.0); blade.rotation.x = -0.35;
    head.add(blade);
    const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.05, 10), metalMat);
    hosel.position.set(0, 0.02, 0);
    head.add(hosel);
    head.position.y = -CLUB_LEN;
    club.add(head);
    root.add(club);

    // hit regions (invisible until hovered). Attached to bones where possible.
    const regions = [];
    const region = (key, mesh, parentObj) => {
      mesh.visible = false; mesh.userData.region = key; mesh.material = glowMat;
      (parentObj || root).add(mesh); regions.push(mesh); return mesh;
    };
    region('neck', sphere(0.075, glowMat, 16), vertebrae.find(b => b.name === 'C4'));
    const ub = region('upback', new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.30, 0.16), glowMat), vertebrae.find(b => b.name === 'T7')); ub.position.set(0, 0.01, -0.03);
    const lb = region('lowback', new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.21, 0.15), glowMat), vertebrae.find(b => b.name === 'L3')); lb.position.set(0, 0.0, -0.02);
    const dyn = {};
    [-1, 1].forEach(s => {
      const side = s > 0 ? 'L' : 'R';
      const sh = region('shoulder:' + side, sphere(0.08, glowMat, 16), t2); sh.position.set(s * 0.20, -0.01, 0.0);
      const hp = region('hip:' + side, sphere(0.085, glowMat, 16), pelvis); hp.position.set(s * 0.09, -0.03, 0.02);
      dyn['elbow:' + side] = region('elbow:' + side, sphere(0.065, glowMat, 16));
      dyn['wrist:' + side] = region('wrist:' + side, sphere(0.055, glowMat, 16));
      dyn['knee:' + side] = region('knee:' + side, sphere(0.075, glowMat, 16));
    });

    return { root, bones, vertebrae, pelvis, t2, skull, arms, legs, club, clubHead: head, regions, dyn };
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

  let ballPos = V3(0.10, 0.03, 0.62);
  const feet = { L: V3(0.22, 0.045, 0.0), R: V3(-0.22, 0.045, 0.0) };

  function computeLoad(p) {
    const f = state.faults;
    let P = p.pelvis;
    if (f.hips && P > 0) P *= 0.5;                 // stiff hips: backswing hip turn halves
    const S = p.torso - P;                         // what the trunk must supply
    const cT = f.tspine ? COMPLIANCE.thoracicStiff : COMPLIANCE.thoracic;
    const sum = COMPLIANCE.girdle + cT + COMPLIANCE.lumbar;
    const g = S * COMPLIANCE.girdle / sum, th = S * cT / sum, lu = S * COMPLIANCE.lumbar / sum;
    const t1yaw = -(P + lu + th);                  // rotation.y convention: + toward target
    const cerv = p.head - t1yaw;
    let side = p.side;
    let extraLumbar = 0;
    if (f.reverse && p.t < 0.62) {
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

    // pelvis
    f.pelvis.position.set(p.shift, 0.95 - Math.abs(p.shift) * 0.35, 0);
    f.pelvis.rotation.set(p.tilt * DEG, -L.P * DEG, 0);

    // distribute spine rotation, side bend, extension
    const perLu = -L.lu / 5, perTh = -L.th / 12, perCe = L.cerv / 7;
    const sideLu = L.side * 0.45 / 5, sideTh = L.side * 0.55 / 12;
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
        b.rotation.set(base.x, base.y + perCe * DEG, base.z - L.side * 0.4 / 7 * DEG);
        applyStress(b, L.stress.cervical, 1);
      }
    });
    f.root.updateMatrixWorld(true);

    // arms: shoulders from T2, hands from keyframes
    const shL = f.t2.localToWorld(V3(0.20, -0.01, 0.0));
    const shR = f.t2.localToWorld(V3(-0.20, -0.01, 0.0));
    const chestFwd = f.t2.localToWorld(V3(0, 0, 1)).sub(f.t2.getWorldPosition(V3())).normalize();
    const clubDir = p.club.clone();
    const grip = p.hands.clone();
    const handL = grip.clone().sub(clubDir.clone().multiplyScalar(0.02));
    const handR = grip.clone().add(clubDir.clone().multiplyScalar(0.07));
    const poleL = shL.clone().add(V3(0.5, -0.4, 0)).sub(chestFwd.clone().multiplyScalar(0.3));
    const poleR = shR.clone().add(V3(-0.5, -0.4, 0)).sub(chestFwd.clone().multiplyScalar(0.3));
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
    // twist the club so the face points roughly toward the target
    const toe = V3(1, 0, 0).applyQuaternion(f.club.quaternion);
    const want = V3(1, 0, 0).sub(clubDir.clone().multiplyScalar(clubDir.x)).normalize();
    const twist = Math.atan2(toe.clone().cross(want).dot(clubDir), toe.dot(want));
    f.club.rotateOnAxis(V3(0, -1, 0), twist);
    ['L', 'R'].forEach(s => {
      const h = f.arms[s].hand; h.position.copy(s === 'L' ? handL : handR); h.quaternion.copy(f.club.quaternion);
    });

    // legs: hips from pelvis, feet fixed (trail heel lifts through impact)
    const hipL = f.pelvis.localToWorld(V3(0.09, -0.03, 0.02));
    const hipR = f.pelvis.localToWorld(V3(-0.09, -0.03, 0.02));
    const ankle = (s, heel) => {
      const toe = feet[s].clone().add(V3(0, -0.015, 0.16));
      const phi = heel * 62 * DEG;
      return { a: toe.clone().add(V3(0, 0.18 * Math.sin(phi) + 0.015, -0.18 * Math.cos(phi))), phi, toe };
    };
    const aL = ankle('L', p.leadHeel), aR = ankle('R', p.trailHeel);
    const knL = solveIK(hipL, aL.a, LEG.thigh, LEG.shin, hipL.clone().add(V3(0.15, -0.5, 1.2)));
    const knR = solveIK(hipR, aR.a, LEG.thigh, LEG.shin, hipR.clone().add(V3(-0.15, -0.5, 1.2)));
    placeSegment(f.legs.L.thigh, hipL, knL, LEG.thigh); placeSegment(f.legs.L.shin, knL, aL.a, LEG.shin);
    placeSegment(f.legs.R.thigh, hipR, knR, LEG.thigh); placeSegment(f.legs.R.shin, knR, aR.a, LEG.shin);
    f.legs.L.knee.position.copy(knL); f.legs.R.knee.position.copy(knR);
    f.dyn['knee:L'].position.copy(knL); f.dyn['knee:R'].position.copy(knR);
    [['L', aL], ['R', aR]].forEach(([s, a]) => {
      const foot = f.legs[s].foot;
      foot.position.copy(a.toe).add(V3(0, 0.03, -0.09));
      foot.quaternion.setFromEuler(new THREE.Euler(Math.PI / 2 - a.phi, s === 'L' ? -0.2 : 0.05, 0, 'YXZ'));
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

    // place the ball where the club head sits at address
    handCurve = new THREE.CatmullRomCurve3(KEYS.map(k => V3(...k.hands)), false, 'catmullrom', 0.5);
    const addressDir = V3().copy(ballPos).sub(V3(...KEYS[0].hands)).normalize();
    const impactDir = V3().copy(ballPos).sub(V3(...KEYS[5].hands)).normalize();
    clubCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.club ? V3(...k.club).normalize() : (k.t === 0 ? addressDir : impactDir)), false, 'catmullrom', 0.5);
    ball.position.copy(V3(...KEYS[0].hands).add(addressDir.multiplyScalar(CLUB_LEN))).setY(0);
    ball.position.z += 0.015;
    ballPos.copy(ball.position);

    buildEffects();
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
    const cu = curveParam(t);
    handCurve.getPoint(cu, out);
    if (head) { clubCurve.getPoint(cu, traceTmp.dir); out.addScaledVector(traceTmp.dir.normalize(), CLUB_LEN); }
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
    const aHip = -L.hipTurn * DEG, aSh = -p.torso * DEG;
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
        ballMesh.position.set(ballHome.x + 12 * u, ballHome.y + (7.6 * u - 6.2 * u * u), ballHome.z - 0.9 * u);
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
    const shL = F.t2.localToWorld(V3(0.20, -0.01, 0)), shR = F.t2.localToWorld(V3(-0.20, -0.01, 0));
    const hipL = F.pelvis.localToWorld(V3(0.09, -0.03, 0.02)), hipR = F.pelvis.localToWorld(V3(-0.09, -0.03, 0.02));
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

  function setCamera(name, instant) {
    const c = CAMERAS[name] || CAMERAS.free;
    state.camera = name;
    touch();
    if (instant) { camera.position.set(...c.pos); controls.target.set(...c.target); controls.update(); return; }
    camTween = { from: camera.position.clone(), to: V3(...c.pos), tFrom: controls.target.clone(), tTo: V3(...c.target), t: 0 };
  }

  function step(dt) {
    if (state.playing) {
      const dur = state.speed === 'real' ? 1.5 : 4.6;
      // at real speed the strike gets a short slow-motion dilation
      let adv = dt;
      if (state.speed === 'real' && state.dir > 0 && state.t > 0.655 && state.t < 0.745) adv *= 0.28;
      if (state.holdUntil > 0) {
        state.holdUntil -= dt;
        if (state.holdUntil <= 0) { state.holdUntil = 0; if (state.loop) { state.t = 0; resetImpact(); } else { state.dir = -1; } }
      } else if (state.dir > 0) {
        state.t += adv / dur;
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
    if (state.playing && state.dir > 0 && prevT < 0.70 && state.t >= 0.70) fireImpact();
    if (state.t < 0.66 && impact.launch < 0 && ballMesh && ballMesh.visible === false) resetImpact();
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
      emit('frame', { t: state.t, phase: phaseName(state.t), load: r.L, playing: state.playing });
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
    pose(0);
    if (!reduced && !opts.noAuto) { setTimeout(() => play(), 900); }
    return true;
  }

  function start() { if (inited && raf === null) { clock.getDelta(); frame(); } }
  function stop() { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } }
  function play() { if (!inited) return; touch(); if (state.t >= 1) { state.t = 0; resetImpact(); } state.dir = 1; state.holdUntil = 0; state.playing = true; emit('play', true); }
  function pause() { state.playing = false; state.holdUntil = 0; state.dir = 1; emit('play', false); }
  function toggle() { touch(); state.playing ? pause() : play(); }
  function seek(t) { touch(); pause(); state.t = clamp(t, 0, 1); prevT = state.t; resetImpact(); }
  function setFault(k, v) { state.faults[k] = !!v; ghostDirty = true; if (state.ghosts) { try { buildGhosts(); } catch (e) { } } }
  function setSpeed(s) { state.speed = s; }
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

  return { init, start, stop, play, pause, toggle, seek, setFault, setSpeed, setLoop, setCamera, setGhosts, setTrace, selectRegion, on, getState, phaseName, CAP };
})();

window.Lab = Lab;

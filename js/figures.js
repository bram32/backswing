/* Backswing — exercise figures
   Volumetric human figures built from an anatomical joint rig on a 120 x 120 grid.

   Proportions (head height H = 13.5 units, body ≈ 7.6 H):
     neck 11 (C7 -> head centre) · torso 33 (hip -> C7)
     upper arm 18 · forearm 16 · hand 8 · thigh 25 · shin 23 · foot 15.5

   A pose supplies: the trunk (hip, neck, head), the two arms (wrist, optional elbow,
   bend sign) and the two legs (ankle, toe, optional knee, bend sign). Index 0 is the
   FAR side (muted tone, drawn behind the trunk), index 1 the NEAR side. Elbows and
   knees are solved with a two-bone IK that clamps the reach, so limbs can never
   hyperextend and joints always fold the anatomically correct way. */

const RIG = {
  torso: 33, neck: 11,
  upper: 18, fore: 16, hand: 8,
  thigh: 25, shin: 23, foot: 11.5, heel: 4.6,
  r: { sh: 4.15, el: 3.05, wr: 2.25, hip: 5.5, kn: 4.0, an: 2.7, neck: 3.3 },
  headR: 4.95, headH: 6.7
};

/* Trunk half-width profiles: [t (0 = hip, 1 = C7), back, front] */
const PROF = {
  s: [[0, 5.9, 5.6], [0.16, 5.1, 4.7], [0.4, 4.8, 4.4], [0.66, 5.5, 5.4], [0.87, 5.4, 5.0], [1, 4.5, 4.0]],
  f: [[0, 7.2, 7.2], [0.18, 6.4, 6.4], [0.44, 6.5, 6.5], [0.7, 8.0, 8.0], [0.88, 8.3, 8.3], [1, 7.4, 7.4]]
};

/* ---------------------------------------------------------------- poses ---- */
const POSES = {
  stand: {
    v: 'f', hip: [60, 60], neck: [60, 27], head: [60, 16], floor: 112, hi: ['torso'],
    legs: [{ a: [54, 108], t: [47, 111], b: 1 }, { a: [66, 108], t: [73, 111], b: 1 }],
    arms: [{ w: [46.5, 61], b: -1 }, { w: [73.5, 61], b: 1 }]
  },
  standClub: {
    v: 'f', hip: [60, 64], neck: [60, 31], head: [60, 20], floor: 112, hi: ['torso'],
    legs: [{ a: [51, 110], t: [44, 113], b: 1 }, { a: [69, 110], t: [76, 113], b: 1 }],
    arms: [{ w: [30, 30], b: -1 }, { w: [90, 30], b: 1 }],
    props: [{ club: [[22, 30], [98, 30]] }, { arrow: [[18, 42], [18, 22]], bend: 0 }, { arrow: [[102, 22], [102, 42]], bend: 0 }]
  },
  legSwing: {
    v: 's', f: 1, hip: [58, 64], neck: [58, 31], head: [59, 20], floor: 112, hi: ['leg0'],
    legs: [{ a: [98, 78], t: [109, 74], b: 1 }, { a: [60, 108], t: [71, 111], b: 1 }],
    arms: [{ w: [56, 66], b: -1 }, { w: [34, 52], b: -1 }],
    props: [{ post: [30, 14, 112], z: 'back' }, { arc: [58, 64, 44, 62, 16] }]
  },
  hinge: {
    v: 's', f: 1, hip: [46, 68], neck: [70, 45], head: [78, 37], floor: 112, hi: ['torso'],
    legs: [{ a: [58, 108], t: [69, 111], b: 1 }, { a: [62, 108], t: [73, 111], b: 1 }],
    arms: [{ e: [88, 50], w: [80, 32] }, { w: [42, 66], b: 1 }],
    props: [{ line: [[38, 67], [79, 27]] }]
  },
  lungeReach: {
    v: 's', f: 1, hip: [50, 80], neck: [76, 60], head: [88, 50], floor: 106, hi: ['torso'],
    legs: [{ a: [18, 98], t: [28, 105], b: 1 }, { a: [86, 102], t: [98, 105], b: 1 }],
    arms: [{ w: [78, 28], b: 1 }, { w: [88, 92], b: 1 }],
    props: [{ arrow: [[88, 38], [82, 18]], bend: 0.18 }]
  },
  quadruped: {
    v: 's', f: -1, hip: [84, 60], neck: [51, 54], head: [42, 60], curve: -8, floor: 90, hi: ['torso'],
    legs: [{ k: [84, 84], a: [100, 86], t: [109, 83] }, { k: [88, 86], a: [104, 88], t: [113, 85] }],
    arms: [{ w: [52, 82], b: -1 }, { w: [48, 83], b: -1 }],
    props: [{ arc: [64, 38, 17, 154, 26] }]
  },
  birddog: {
    v: 's', f: -1, hip: [72, 60], neck: [39, 55], head: [29, 51], floor: 90, hi: ['torso'],
    legs: [{ k: [74, 84], a: [90, 87], t: [99, 84] }, { a: [114, 64], t: [120, 68], b: -1 }],
    arms: [{ w: [12, 50], b: 1 }, { w: [38, 82], b: -1 }],
    props: []
  },
  threadNeedle: {
    v: 's', f: -1, hip: [88, 58], neck: [56, 72], head: [46, 80], floor: 90, hi: ['arm0'],
    legs: [{ k: [86, 84], a: [102, 86], t: [111, 83] }, { k: [90, 86], a: [106, 88], t: [115, 85] }],
    arms: [{ w: [22, 87], b: -1 }, { e: [60, 78], w: [48, 85] }],
    props: []
  },
  supineKnees: {
    v: 's', f: 1, hip: [64, 88], neck: [31, 88], head: [20, 88], floor: 96, hi: ['lowback'],
    legs: [{ a: [90, 92], t: [101, 94], b: 1 }, { a: [95, 93], t: [106, 95], b: 1 }],
    arms: [{ w: [56, 82], b: 1 }, { w: [58, 84], b: 1 }],
    props: [{ arc: [64, 84, 13, 128, 12] }]
  },
  bridge: {
    v: 's', f: 1, hip: [62, 79], neck: [30, 88], head: [19, 90], floor: 96, hi: ['hip'],
    legs: [{ a: [88, 93], t: [99, 95], b: 1 }, { a: [93, 94], t: [104, 96], b: 1 }],
    arms: [{ w: [54, 93], b: 1 }, { w: [56, 94], b: 1 }],
    props: [{ arrow: [[62, 88], [62, 70]], bend: 0 }]
  },
  deadbug: {
    v: 's', f: 1, hip: [64, 88], neck: [31, 88], head: [20, 88], floor: 96, hi: ['torso'],
    legs: [{ a: [111, 84], t: [120, 80], b: 1 }, { k: [66, 63], a: [88, 62], t: [98, 58] }],
    arms: [{ w: [10, 76], b: -1 }, { w: [34, 56], b: -1 }],
    props: [{ arrow: [[100, 72], [112, 78]], bend: 0.2 }, { arrow: [[26, 62], [14, 70]], bend: 0.2 }]
  },
  sidePlank: {
    v: 's', f: 1, hip: [64, 81], neck: [32, 73], head: [21, 71], floor: 96, hi: ['torso'],
    legs: [{ a: [106, 92], t: [115, 97], b: -1 }, { a: [110, 93], t: [119, 98], b: -1 }],
    arms: [{ w: [37, 41], b: 1 }, { e: [30, 92], w: [46, 95] }],
    props: []
  },
  sideLying: {
    v: 's', f: 1, hip: [72, 58], neck: [39, 58], head: [28, 58], hi: ['upback'],
    legs: [{ k: [80, 80], a: [60, 88], t: [49, 91] }, { k: [82, 84], a: [62, 92], t: [51, 95] }],
    arms: [{ w: [42, 90], b: -1 }, { w: [42, 26], b: 1 }],
    props: [{ mat: [12, 8, 96, 104], z: 'back' }, { arc: [40, 58, 47, 78, -78] }]
  },
  halfKneel: {
    v: 's', f: 1, hip: [44, 80], neck: [46, 47], head: [47, 36], floor: 108, hi: ['hip'],
    legs: [{ k: [42, 104], a: [22, 106], t: [12, 108] }, { a: [80, 106], t: [92, 109], b: 1 }],
    arms: [{ w: [41, 20], b: 1 }, { w: [66, 76], b: 1 }],
    props: []
  },
  seated9090: {
    v: 's', f: 1, hip: [56, 98], neck: [57, 65], head: [58, 54], floor: 110, hi: ['hip'],
    legs: [{ k: [30, 96], a: [22, 110], t: [33, 112] }, { k: [80, 100], a: [64, 110], t: [52, 112] }],
    arms: [{ w: [34, 88], b: -1 }, { w: [80, 90], b: 1 }],
    props: [{ arc: [56, 96, 27, -22, -158] }]
  },
  childsPose: {
    v: 's', f: -1, hip: [102, 80], neck: [72, 94], head: [62, 98], curve: -5, floor: 106, hi: ['lowback'],
    legs: [{ k: [84, 100], a: [107, 101], t: [115, 98] }, { k: [86, 102], a: [109, 103], t: [117, 100] }],
    arms: [{ w: [42, 99], b: -1 }, { w: [40, 96], b: -1 }],
    props: []
  },
  wallAngel: {
    v: 's', f: 1, hip: [41, 62], neck: [41, 29], head: [42, 18], floor: 112, hi: ['upback'],
    legs: [{ a: [50, 106], t: [61, 109], b: 1 }, { a: [54, 106], t: [65, 109], b: 1 }],
    arms: [{ e: [38, 47], w: [37, 31] }, { e: [36, 46], w: [35, 30] }],
    props: [{ wall: [34, -1], z: 'back' }, { arrow: [[24, 48], [24, 22]], bend: 0 }]
  },
  chairExt: {
    v: 's', f: -1, hip: [78, 82], neck: [93, 53], head: [97, 42], curve: -5, floor: 112, hi: ['upback'],
    legs: [{ k: [54, 86], a: [52, 108], t: [40, 111] }, { k: [56, 88], a: [54, 110], t: [42, 113] }],
    arms: [{ e: [80, 49], w: [90, 42] }, { e: [78, 51], w: [88, 44] }],
    props: [{ chair: [48, 88, 46, 30], z: 'back' }]
  },
  splitSquat: {
    v: 's', f: 1, hip: [56, 76], neck: [57, 43], head: [58, 32], floor: 112, hi: ['leg1'],
    legs: [{ k: [41, 97], a: [19, 99], t: [29, 109] }, { a: [80, 108], t: [92, 111], b: 1 }],
    arms: [{ w: [52, 76], b: -1 }, { w: [62, 76], b: 1 }],
    props: [{ arrow: [[34, 82], [34, 94]], bend: 0 }]
  },
  singleLegRDL: {
    v: 's', f: -1, hip: [62, 66], neck: [32, 52], head: [22, 47], floor: 112, hi: ['torso'],
    legs: [{ a: [104, 48], t: [115, 45], b: -1 }, { a: [66, 108], t: [55, 111], b: 1 }],
    arms: [{ w: [26, 82], b: 1 }, { w: [41, 86], b: 1 }],
    props: []
  },
  crossBody: {
    v: 'f', hip: [60, 60], neck: [60, 27], head: [60, 16], floor: 112, hi: ['shoulder0'],
    legs: [{ a: [54, 108], t: [47, 111], b: 1 }, { a: [66, 108], t: [73, 111], b: 1 }],
    arms: [{ w: [40, 40], b: -1 }, { e: [46, 52], w: [50, 40], hd: [56, 36] }],
    props: [{ arrow: [[30, 32], [40, 38]], bend: -0.28 }]
  },
  wristStretch: {
    v: 's', f: 1, hip: [46, 62], neck: [46, 29], head: [47, 18], floor: 112, hi: ['fore1'],
    legs: [{ a: [46, 108], t: [57, 111], b: 1 }, { a: [50, 108], t: [61, 111], b: 1 }],
    arms: [{ w: [76, 46], b: 1, hd: [84, 50] }, { w: [80, 34], b: 1, hd: [86, 44] }],
    props: [{ arrow: [[94, 44], [94, 58]], bend: 0.25 }]
  },
  bandER: {
    v: 'f', hip: [60, 60], neck: [60, 27], head: [60, 16], floor: 112, hi: ['shoulder1'],
    legs: [{ a: [54, 108], t: [47, 111], b: 1 }, { a: [66, 108], t: [73, 111], b: 1 }],
    arms: [{ w: [46.5, 61], b: -1 }, { e: [71, 46], w: [88, 50] }],
    props: [{ band: [[10, 54], [90, 50]], z: 'back' }, { arrow: [[96, 62], [102, 44]], bend: 0.3 }]
  },
  chinTuck: {
    v: 's', f: 1, hip: [56, 62], neck: [57, 29], head: [58, 18], floor: 112, hi: ['neck'],
    legs: [{ a: [56, 108], t: [67, 111], b: 1 }, { a: [60, 108], t: [71, 111], b: 1 }],
    arms: [{ w: [54, 64], b: -1 }, { w: [60, 64], b: -1 }],
    props: [{ arrow: [[78, 20], [67, 20]], bend: 0 }]
  },
  wallSit: {
    v: 's', f: 1, hip: [41, 76], neck: [41, 43], head: [42, 32], floor: 104, hi: ['thigh1'],
    legs: [{ k: [62, 79], a: [63, 101], t: [74, 104] }, { k: [66, 77], a: [67, 100], t: [78, 103] }],
    arms: [{ w: [52, 72], b: 1 }, { w: [58, 71], b: 1 }],
    props: [{ wall: [34, -1], z: 'back' }]
  },
  calfRaise: {
    v: 's', f: 1, hip: [56, 58], neck: [56, 25], head: [57, 14], floor: 114, hi: ['shin1'],
    legs: [{ a: [54, 103], t: [64, 113], b: 1 }, { a: [58, 104], t: [68, 114], b: 1 }],
    arms: [{ w: [56, 60], b: -1 }, { w: [84, 50], b: 1 }],
    props: [{ post: [92, 20, 114], z: 'back' }, { arrow: [[42, 110], [42, 94]], bend: 0 }]
  },
  figure4Stand: {
    v: 'f', hip: [58, 64], neck: [58, 31], head: [58, 20], floor: 112, hi: ['hip'],
    legs: [{ k: [38, 84], a: [60, 86], t: [70, 84] }, { k: [68, 86], a: [66, 110], t: [73, 113] }],
    arms: [{ w: [38, 52], b: -1 }, { w: [88, 54], b: 1 }],
    props: [{ post: [94, 22, 112], z: 'back' }]
  },
  hamstringStand: {
    v: 's', f: 1, hip: [40, 64], neck: [65, 42], head: [74, 35], floor: 112, hi: ['thigh1'],
    legs: [{ a: [36, 108], t: [47, 111], b: 1 }, { a: [82, 86], t: [92, 78], b: 1 }],
    arms: [{ w: [58, 72], b: 1 }, { w: [70, 68], b: 1 }],
    props: [{ box: [76, 88, 36, 24], z: 'back' }]
  },
  latStretch: {
    v: 's', f: 1, hip: [40, 72], neck: [72, 63], head: [82, 60], floor: 112, hi: ['upback'],
    legs: [{ a: [48, 108], t: [59, 111], b: 1 }, { a: [52, 108], t: [63, 111], b: 1 }],
    arms: [{ w: [98, 52], b: 1 }, { w: [100, 54], b: 1 }],
    props: [{ post: [110, 46, 112], z: 'back' }, { line: [[96, 46], [118, 46]] }]
  },
  swing: {
    v: 's', f: 1, hip: [56, 68], neck: [58, 36], head: [55, 25], floor: 112, hi: ['torso'],
    legs: [{ a: [50, 108], t: [61, 111], b: 1 }, { a: [64, 108], t: [75, 111], b: 1 }],
    arms: [{ w: [70, 32], b: 1 }, { w: [74, 27], b: 1 }],
    props: [{ club: [[76, 25], [40, 7]] }, { arc: [58, 46, 42, -16, 46] }]
  },
  curlUp: {
    v: 's', f: 1, hip: [62, 88], neck: [30, 84], head: [20, 80], floor: 96, hi: ['torso'],
    legs: [{ a: [110, 90], t: [119, 87], b: 1 }, { k: [84, 72], a: [90, 93], t: [101, 95] }],
    arms: [{ w: [54, 92], b: 1 }, { w: [58, 94], b: 1 }],
    props: [{ arrow: [[14, 70], [20, 62]], bend: 0.2 }]
  },
  pallof: {
    v: 's', f: 1, hip: [46, 62], neck: [46, 29], head: [47, 18], floor: 112, hi: ['torso'],
    legs: [{ a: [46, 108], t: [57, 111], b: 1 }, { a: [50, 108], t: [61, 111], b: 1 }],
    arms: [{ w: [76, 43], b: 1 }, { w: [78, 41], b: 1 }],
    props: [{ band: [[4, 50], [80, 42]], z: 'back' }, { arrow: [[94, 40], [106, 40]], bend: 0 }]
  },
  ytw: {
    v: 'f', hip: [60, 62], neck: [60, 29], head: [60, 18], hi: ['upback'],
    legs: [{ a: [54, 110], t: [50, 116], b: 1 }, { a: [66, 110], t: [70, 116], b: 1 }],
    arms: [{ w: [25, 14], b: -1 }, { w: [95, 14], b: 1 }],
    props: [{ mat: [24, 2, 72, 116], z: 'back' }, { arrow: [[14, 20], [10, 10]], bend: 0.2 }, { arrow: [[106, 20], [110, 10]], bend: -0.2 }]
  },
  squatTee: {
    v: 'f', hip: [60, 72], neck: [60, 39], head: [60, 28], floor: 114, hi: ['hip'],
    legs: [{ k: [42, 90], a: [47, 112], t: [40, 115] }, { k: [78, 90], a: [73, 112], t: [80, 115] }],
    arms: [{ w: [36, 14], b: -1 }, { w: [84, 14], b: 1 }],
    props: [{ club: [[26, 8], [96, 8]] }]
  },
  armCircles: {
    v: 'f', hip: [60, 60], neck: [60, 27], head: [60, 16], floor: 112, hi: ['shoulder1'],
    legs: [{ a: [54, 108], t: [47, 111], b: 1 }, { a: [66, 108], t: [73, 111], b: 1 }],
    arms: [{ w: [46.5, 61], b: -1 }, { w: [90, 16], b: 1 }],
    props: [{ arc: [80, 38, 27, -100, 118] }]
  },
  wristCurl: {
    v: 's', f: -1, hip: [86, 82], neck: [80, 52], head: [75, 43], floor: 112, hi: ['fore1'],
    legs: [{ k: [62, 86], a: [58, 108], t: [46, 111] }, { k: [60, 88], a: [56, 110], t: [44, 113] }],
    arms: [{ w: [70, 86], b: -1 }, { e: [80, 73], w: [64, 79], hd: [60, 88] }],
    props: [{ box: [66, 86, 46, 26], z: 'back' }, { ball: [60, 91, 5.2] }]
  },
  pronation: {
    v: 's', f: 1, hip: [46, 62], neck: [46, 29], head: [47, 18], floor: 112, hi: ['fore1'],
    legs: [{ a: [46, 108], t: [57, 111], b: 1 }, { a: [50, 108], t: [61, 111], b: 1 }],
    arms: [{ w: [44, 64], b: -1 }, { e: [48, 50], w: [64, 46] }],
    props: [{ club: [[70, 45], [78, 10]] }, { arc: [70, 44, 27, -108, -18] }]
  },
  hipAirplane: {
    v: 's', f: -1, hip: [62, 66], neck: [32, 52], head: [22, 47], floor: 112, hi: ['hip'],
    legs: [{ a: [104, 48], t: [115, 45], b: -1 }, { a: [66, 108], t: [55, 111], b: 1 }],
    arms: [{ w: [54, 32], b: -1 }, { w: [34, 82], b: 1 }],
    props: [{ arc: [64, 66, 24, -68, 58] }]
  },
  kneesSide: {
    v: 's', f: 1, hip: [66, 58], neck: [33, 58], head: [22, 58], hi: ['lowback'],
    legs: [{ k: [86, 76], a: [68, 88], t: [56, 92] }, { k: [88, 81], a: [70, 93], t: [58, 97] }],
    arms: [{ w: [36, 26], b: 1 }, { w: [36, 90], b: -1 }],
    props: [{ mat: [12, 14, 96, 92], z: 'back' }, { arc: [66, 58, 31, -64, 34] }]
  },
  sleeper: {
    v: 's', f: 1, hip: [80, 78], neck: [47, 78], head: [36, 78], hi: ['shoulder0'],
    legs: [{ k: [102, 88], a: [84, 100], t: [72, 103] }, { k: [104, 92], a: [86, 104], t: [74, 107] }],
    arms: [{ e: [50, 58], w: [35, 52], hd: [28, 49] }, { e: [60, 68], w: [44, 62], hd: [38, 58] }],
    props: [{ mat: [18, 36, 94, 78], z: 'back' }, { arrow: [[30, 42], [41, 53]], bend: 0.2 }]
  },
  stepBack: {
    v: 's', f: 1, hip: [56, 64], neck: [55, 31], head: [52, 20], floor: 112, hi: ['hip'],
    legs: [{ a: [34, 108], t: [45, 111], b: 1 }, { a: [76, 108], t: [87, 111], b: 1 }],
    arms: [{ w: [40, 10], b: 1 }, { w: [60, 66], b: 1 }],
    props: []
  },
  neckStretch: {
    v: 'f', hip: [60, 60], neck: [60, 27], head: [52, 18], floor: 112, hi: ['neck'],
    legs: [{ a: [54, 108], t: [47, 111], b: 1 }, { a: [66, 108], t: [73, 111], b: 1 }],
    arms: [{ w: [44, 64], b: -1 }, { e: [80, 36], w: [64, 26], hd: [55, 21] }],
    props: [{ arc: [62, 28, 18, -58, -118] }]
  },
  squeeze: {
    v: 'f', hip: [60, 60], neck: [60, 27], head: [60, 16], floor: 112, hi: ['fore1'],
    legs: [{ a: [54, 108], t: [47, 111], b: 1 }, { a: [66, 108], t: [73, 111], b: 1 }],
    arms: [{ w: [46.5, 61], b: -1 }, { w: [78, 60], b: 1, hd: [82, 68] }],
    props: [{ ball: [84, 72, 5.4] }]
  },
  doorway: {
    v: 'f', hip: [58, 62], neck: [58, 29], head: [57, 18], floor: 112, hi: ['shoulder1'],
    legs: [{ a: [48, 106], t: [41, 109], b: 1 }, { a: [66, 110], t: [74, 113], b: 1 }],
    arms: [{ w: [44, 62], b: -1 }, { e: [84, 34], w: [89, 17] }],
    props: [{ post: [95, 4, 112], z: 'back' }, { arc: [58, 40, 22, -30, -108] }]
  }
};

/* ------------------------------------------------------------- geometry ---- */
const _n = v => Math.round(v * 100) / 100;
const _p = p => _n(p[0]) + ',' + _n(p[1]);
const _sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const _add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const _mul = (a, k) => [a[0] * k, a[1] * k];
const _len = a => Math.hypot(a[0], a[1]);
const _unit = a => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const _go = (from, dir, d) => [from[0] + dir[0] * d, from[1] + dir[1] * d];
const _toward = (from, to, d) => _go(from, _unit(_sub(to, from)), d);

function _circleD(c, r) {
  return 'M' + _n(c[0] - r) + ',' + _n(c[1]) + 'a' + _n(r) + ',' + _n(r) + ' 0 1,0 ' + _n(2 * r) + ',0a' + _n(r) + ',' + _n(r) + ' 0 1,0 ' + _n(-2 * r) + ',0Z';
}

/* Hull of two circles: a limb segment with rounded, differently sized ends. */
function _cap(p0, r0, p1, r1) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy);
  if (d < 0.02) return _circleD(p0, Math.max(r0, r1));
  if (d <= Math.abs(r1 - r0)) return _circleD(r0 > r1 ? p0 : p1, Math.max(r0, r1));
  const th = Math.atan2(dy, dx), ph = Math.acos((r0 - r1) / d);
  const at = (p, r, a) => [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
  const a1 = at(p0, r0, th + ph), b1 = at(p1, r1, th + ph);
  const b2 = at(p1, r1, th - ph), a2 = at(p0, r0, th - ph);
  const l1 = 2 * ph > Math.PI ? 1 : 0, l0 = 2 * Math.PI - 2 * ph > Math.PI ? 1 : 0;
  return 'M' + _p(a1) + 'L' + _p(b1) + 'A' + _n(r1) + ',' + _n(r1) + ' 0 ' + l1 + ',0 ' + _p(b2) +
    'L' + _p(a2) + 'A' + _n(r0) + ',' + _n(r0) + ' 0 ' + l0 + ',1 ' + _p(a1) + 'Z';
}

function _chain(pts, radii) {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) d += _cap(pts[i], radii[i], pts[i + 1], radii[i + 1]);
  return d;
}

/* Two-bone IK. sign +1 puts the joint on the body's front side; the reach is
   clamped so the chain can never straighten past its bones (no hyperextension). */
function _ik(root, end, l1, l2, sign, front) {
  let v = _sub(end, root), d = _len(v);
  const min = Math.abs(l1 - l2) + 0.8, max = (l1 + l2) * 0.985;
  d = Math.max(min, Math.min(max, d));
  const u = _unit(v);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mid = _go(root, u, a);
  const perp = _unit([-u[1], u[0]]);
  const s = (perp[0] * front[0] + perp[1] * front[1]) >= 0 ? 1 : -1;
  return { j: _go(mid, _mul(perp, s * sign), h), e: _go(root, u, d) };
}

function _profAt(prof, t) {
  for (let i = 1; i < prof.length; i++) {
    if (t <= prof[i][0] || i === prof.length - 1) {
      const a = prof[i - 1], b = prof[i];
      const k = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0] || 1)));
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return [prof[0][1], prof[0][2]];
}

function _smoothClosed(P) {
  const n = P.length;
  let d = 'M' + _p(P[0]);
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += 'C' + _p(c1) + ' ' + _p(c2) + ' ' + _p(p2);
  }
  return d + 'Z';
}

/* --------------------------------------------------------------- the rig ---- */
function buildRig(p) {
  const view = p.v || 'f';
  const f = view === 'f' ? 1 : (p.f || 1);
  const hip = p.hip.slice();
  const neck = _toward(hip, p.neck, RIG.torso);
  const u = _unit(_sub(neck, hip));                 // hip -> neck
  const down = [-u[0], -u[1]];
  const front = [-u[1] * f, u[0] * f];              // belly side
  const lat = [-u[1], u[0]];                        // in-plane lateral (front view)
  const head = _toward(neck, p.head, RIG.neck);
  const headUp = _unit(_sub(head, neck));
  const headAng = Math.atan2(headUp[0], -headUp[1]) * 180 / Math.PI;

  // spine: cubic with a natural lumbar/thoracic S, bent further by pose.curve
  const c = p.curve || 0;
  const s0 = hip, s3 = neck;
  const s1 = _add(_go(hip, u, RIG.torso * 0.32), _mul(front, 1.9 + c * 0.5));
  const s2 = _add(_go(hip, u, RIG.torso * 0.70), _mul(front, -1.1 + c * 0.9));
  const bez = t => {
    const m = 1 - t;
    return [m * m * m * s0[0] + 3 * m * m * t * s1[0] + 3 * m * t * t * s2[0] + t * t * t * s3[0],
            m * m * m * s0[1] + 3 * m * m * t * s1[1] + 3 * m * t * t * s2[1] + t * t * t * s3[1]];
  };
  const tan = t => {
    const m = 1 - t;
    return _unit([3 * m * m * (s1[0] - s0[0]) + 6 * m * t * (s2[0] - s1[0]) + 3 * t * t * (s3[0] - s2[0]),
                  3 * m * m * (s1[1] - s0[1]) + 6 * m * t * (s2[1] - s1[1]) + 3 * t * t * (s3[1] - s2[1])]);
  };

  const shC = _go(neck, down, view === 'f' ? 1.4 : 2.6);
  const hipC = hip;
  let shA, shB, hipA, hipB;
  if (view === 'f') {
    shA = _go(shC, lat, -9.4); shB = _go(shC, lat, 9.4);
    hipA = _go(hipC, lat, -5.2); hipB = _go(hipC, lat, 5.2);
  } else {
    shA = _go(shC, front, -1.9); shB = _go(shC, front, 1.5);
    hipA = _go(hipC, front, -1.4); hipB = _go(hipC, front, 1.0);
  }

  const arms = (p.arms || []).map((a, i) => {
    const sh = i === 0 ? shA : shB;
    let el, wr;
    if (a.e) { el = a.e.slice(); wr = a.w.slice(); }
    else {
      const r = _ik(sh, a.w, RIG.upper, RIG.fore, (a.b === undefined ? -1 : a.b), front);
      el = r.j; wr = r.e;
    }
    const hdir = a.hd ? _unit(_sub(a.hd, wr)) : _unit(_sub(wr, el));
    return { s: sh, e: el, w: wr, hm: _go(wr, hdir, 3.4), ht: _go(wr, hdir, 7.4) };
  });

  const legs = (p.legs || []).map((l, i) => {
    const hp = i === 0 ? hipA : hipB;
    let kn, an;
    if (l.k) { kn = l.k.slice(); an = l.a.slice(); }
    else {
      const r = _ik(hp, l.a, RIG.thigh, RIG.shin, (l.b === undefined ? 1 : l.b), front);
      kn = r.j; an = r.e;
    }
    const toe = l.t ? l.t.slice() : _go(an, [f, 0.28], RIG.foot);
    const fd = _unit(_sub(toe, an));
    return { h: hp, k: kn, a: an, t: toe, heel: _go(an, [-fd[0], -fd[1]], RIG.heel) };
  });

  return { view, f, hip, neck, head, headAng, u, down, front, lat, bez, tan, shC, shA, shB, hipA, hipB, arms, legs, p };
}

/* ----------------------------------------------------------------- parts ---- */
function _torsoD(R, grow) {
  const prof = PROF[R.view === 'f' ? 'f' : 's'];
  const N = 15, fr = [], bk = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, pt = R.bez(t), tg = R.tan(t);
    const w = _profAt(prof, t);
    const nrm = R.view === 'f' ? [-tg[1], tg[0]] : [-tg[1] * R.f, tg[0] * R.f];
    fr.push(_go(pt, nrm, w[1] + grow));
    bk.push(_go(pt, nrm, -(w[0] + grow)));
  }
  const poly = fr.concat(bk.reverse());
  let d = _smoothClosed(poly);
  d += _cap(R.shA, RIG.r.sh + grow, R.shB, RIG.r.sh + grow);
  d += _cap(R.hipA, RIG.r.hip + grow, R.hipB, RIG.r.hip + grow);
  return d;
}

function _spineD(R) {
  const prof = PROF[R.view === 'f' ? 'f' : 's'];
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = 0.06 + (i / 10) * 0.86, pt = R.bez(t), tg = R.tan(t);
    const w = _profAt(prof, t);
    const nrm = R.view === 'f' ? [-tg[1], tg[0]] : [-tg[1] * R.f, tg[0] * R.f];
    pts.push(_go(pt, nrm, R.view === 'f' ? 0 : -(w[0] * 0.52)));
  }
  let d = 'M' + _p(pts[0]);
  for (let i = 1; i < pts.length; i++) d += 'L' + _p(pts[i]);
  return d;
}

const HEAD_S = 'M0,-6.7C3.4,-6.7 5,-4.4 5,-1.5C5,0.5 4.6,1.8 3.9,3C3.2,4.8 1.8,6.3 -0.7,6.3C-3.3,6.3 -5,4.1 -5,0.7C-5,-3.5 -3.3,-6.7 0,-6.7Z';
const HEAD_F = 'M0,-6.8C3.5,-6.8 4.9,-4.4 4.9,-1.4C4.9,1.9 3.3,6.4 0,6.4C-3.3,6.4 -4.9,1.9 -4.9,-1.4C-4.9,-4.4 -3.5,-6.8 0,-6.8Z';

function _headEl(R, cls) {
  const a = R.p.hAng === undefined ? R.headAng : R.p.hAng;
  const d = R.view === 'f' ? HEAD_F : HEAD_S;
  return '<path class="' + cls + '" d="' + d + '" transform="translate(' + _p(R.head) + ') scale(' + R.f + ',1) rotate(' + _n(a * R.f) + ')"/>';
}

function _armD(A) {
  return _chain([A.s, A.e, A.w], [RIG.r.sh, RIG.r.el, RIG.r.wr]) +
    _chain([A.w, A.hm, A.ht], [RIG.r.wr, 3.0, 2.1]);
}
function _legD(L) {
  return _chain([L.h, L.k, L.a], [RIG.r.hip, RIG.r.kn, RIG.r.an]) +
    _chain([L.heel, L.a, L.t], [3.0, 3.25, 2.05]);
}

/* ----------------------------------------------------------- highlighting ---- */
function _hiSpot(R, key) {
  const A = R.arms, L = R.legs, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const arm = i => A[i] && { c: mid(A[i].e, mid(A[i].s, A[i].w)), r: 20 };
  const fore = i => A[i] && { c: mid(A[i].e, A[i].w), r: 16 };
  const leg = i => L[i] && { c: mid(L[i].k, mid(L[i].h, L[i].a)), r: 22 };
  const map = {
    torso: { c: R.bez(0.5), r: 27 },
    upback: { c: R.bez(0.78), r: 22 },
    lowback: { c: R.bez(0.2), r: 20 },
    hip: { c: R.hip, r: 20 },
    neck: { c: mid(R.neck, R.head), r: 14 },
    head: { c: R.head, r: 15 },
    shoulder0: { c: R.shA, r: 15 }, shoulder1: { c: R.shB, r: 15 },
    arm0: arm(0), arm1: arm(1), fore0: fore(0), fore1: fore(1),
    wrist0: A[0] && { c: A[0].w, r: 13 }, wrist1: A[1] && { c: A[1].w, r: 13 },
    leg0: leg(0), leg1: leg(1),
    thigh0: L[0] && { c: mid(L[0].h, L[0].k), r: 17 }, thigh1: L[1] && { c: mid(L[1].h, L[1].k), r: 17 },
    shin0: L[0] && { c: mid(L[0].k, L[0].a), r: 15 }, shin1: L[1] && { c: mid(L[1].k, L[1].a), r: 15 },
    knee0: L[0] && { c: L[0].k, r: 13 }, knee1: L[1] && { c: L[1].k, r: 13 }
  };
  return map[key] || null;
}

const _HIPART = {
  torso: 'torso', upback: 'torso', lowback: 'torso', hip: 'torso',
  neck: 'head', head: 'head',
  shoulder0: 'arm0', shoulder1: 'arm1',
  arm0: 'arm0', arm1: 'arm1', fore0: 'arm0', fore1: 'arm1', wrist0: 'arm0', wrist1: 'arm1',
  leg0: 'leg0', leg1: 'leg1', thigh0: 'leg0', thigh1: 'leg1',
  shin0: 'leg0', shin1: 'leg1', knee0: 'leg0', knee1: 'leg1'
};

/* ----------------------------------------------------------------- props ---- */
function _arrowD(a, b, bend) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const k = bend === undefined ? 0.22 : bend;
  return 'M' + _p(a) + 'Q' + _p([mx - dy * k, my + dx * k]) + ' ' + _p(b);
}

function _arcD(cx, cy, r, a0, a1) {
  const p0 = [cx + r * Math.cos(a0 * Math.PI / 180), cy + r * Math.sin(a0 * Math.PI / 180)];
  const p1 = [cx + r * Math.cos(a1 * Math.PI / 180), cy + r * Math.sin(a1 * Math.PI / 180)];
  let sweep = a1 > a0 ? 1 : 0;
  let delta = Math.abs(a1 - a0);
  return 'M' + _p(p0) + 'A' + _n(r) + ',' + _n(r) + ' 0 ' + (delta > 180 ? 1 : 0) + ',' + sweep + ' ' + _p(p1);
}

function _prop(pr) {
  const o = [];
  if (pr.line) o.push('<path class="fig-prop" d="M' + _p(pr.line[0]) + 'L' + _p(pr.line[1]) + '"/>');
  if (pr.club) {
    const a = pr.club[0], b = pr.club[1], d = _unit(_sub(b, a));
    o.push('<path class="fig-prop fx-shaft" d="M' + _p(a) + 'L' + _p(b) + '"/>');
    o.push('<path class="fig-prop fx-grip" d="M' + _p(a) + 'L' + _p(_go(a, d, 9)) + '"/>');
  }
  if (pr.post) o.push('<path class="fig-prop" d="M' + _n(pr.post[0]) + ',' + _n(pr.post[1]) + 'L' + _n(pr.post[0]) + ',' + _n(pr.post[2]) + '"/>');
  if (pr.wall) {
    const x = pr.wall[0], s = pr.wall[1];
    let d = 'M' + _n(x) + ',2L' + _n(x) + ',118';
    for (let y = 8; y < 118; y += 13) d += 'M' + _n(x) + ',' + _n(y) + 'L' + _n(x + s * 6) + ',' + _n(y + 6);
    o.push('<path class="fig-prop fx-thin" d="' + d + '"/>');
  }
  if (pr.box) {
    const b = pr.box;
    o.push('<path class="fig-prop fx-thin" d="M' + _n(b[0]) + ',' + _n(b[1] + b[3]) + 'L' + _n(b[0]) + ',' + _n(b[1]) + 'L' + _n(b[0] + b[2]) + ',' + _n(b[1]) + 'L' + _n(b[0] + b[2]) + ',' + _n(b[1] + b[3]) + '"/>');
  }
  if (pr.chair) {
    const c = pr.chair, x = c[0], y = c[1], w = c[2], h = c[3];
    o.push('<path class="fig-prop" d="M' + _n(x) + ',' + _n(y) + 'L' + _n(x + w) + ',' + _n(y) +
      'M' + _n(x + w - 4) + ',' + _n(y) + 'L' + _n(x + w - 4) + ',' + _n(y - h) +
      'M' + _n(x + 4) + ',' + _n(y) + 'L' + _n(x + 4) + ',' + _n(y + 22) +
      'M' + _n(x + w - 4) + ',' + _n(y) + 'L' + _n(x + w - 4) + ',' + _n(y + 22) + '"/>');
  }
  if (pr.mat) {
    const m = pr.mat;
    o.push('<rect class="fig-prop fx-thin" x="' + _n(m[0]) + '" y="' + _n(m[1]) + '" width="' + _n(m[2]) + '" height="' + _n(m[3]) + '" rx="6"/>');
  }
  if (pr.ball) o.push('<circle class="fig-prop fx-ball" cx="' + _n(pr.ball[0]) + '" cy="' + _n(pr.ball[1]) + '" r="' + _n(pr.ball[2]) + '"/>');
  if (pr.band) {
    o.push('<path class="fig-prop fig-dash" d="M' + _p(pr.band[0]) + 'L' + _p(pr.band[1]) + '"/>');
    o.push('<path class="fig-prop" d="M' + _n(pr.band[0][0] - 3) + ',' + _n(pr.band[0][1] - 7) + 'L' + _n(pr.band[0][0] - 3) + ',' + _n(pr.band[0][1] + 7) + '"/>');
  }
  if (pr.arrow) o.push('<path class="fig-arrow" marker-end="url(#fx-ah)" d="' + _arrowD(pr.arrow[0], pr.arrow[1], pr.bend) + '"/>');
  if (pr.arc) o.push('<path class="fig-arrow" marker-end="url(#fx-ah)" d="' + _arcD(pr.arc[0], pr.arc[1], pr.arc[2], pr.arc[3], pr.arc[4]) + '"/>');
  return o.join('');
}

/* -------------------------------------------------------------- renderer ---- */
function figureSVG(poseKey, opts = {}) {
  const p = POSES[poseKey] || POSES.stand;
  const size = opts.size || 120;
  const R = buildRig(p);
  const hi = p.hi || [];
  const hiParts = new Set(hi.map(k => _HIPART[k]).filter(Boolean));
  const tone = part => hiParts.has(part) ? 'fx fx-acc' : (part.slice(-1) === '0' ? 'fx fx-far' : 'fx fx-near');
  const label = String(opts.label || poseKey).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const o = [];
  o.push('<svg class="figure" viewBox="0 0 120 120" width="' + size + '" height="' + size + '" role="img" aria-label="' + label + '">');

  // floor and contact shadow
  if (p.floor) {
    const xs = [];
    R.legs.forEach(l => { [l.a, l.t, l.heel, l.k].forEach(q => { if (q[1] > p.floor - 9) xs.push(q[0]); }); });
    R.arms.forEach(a => { [a.w, a.ht].forEach(q => { if (q[1] > p.floor - 9) xs.push(q[0]); }); });
    if (xs.length) {
      const lo = Math.min.apply(null, xs), hiX = Math.max.apply(null, xs);
      o.push('<ellipse class="fx-shadow" cx="' + _n((lo + hiX) / 2) + '" cy="' + _n(p.floor) + '" rx="' + _n((hiX - lo) / 2 + 13) + '" ry="3.6"/>');
    }
    o.push('<path class="fig-floor" d="M4,' + _n(p.floor) + 'L116,' + _n(p.floor) + '"/>');
  }

  // accent glow behind the target region
  hi.forEach(k => {
    const s = _hiSpot(R, k);
    if (s) o.push('<circle class="fx-glow" cx="' + _p(s.c).split(',')[0] + '" cy="' + _p(s.c).split(',')[1] + '" r="' + _n(s.r) + '"/>');
  });

  const props = p.props || [];
  props.filter(pr => pr.z === 'back').forEach(pr => o.push(_prop(pr)));

  // far limbs
  if (R.arms[0]) o.push('<path class="' + tone('arm0') + '" d="' + _armD(R.arms[0]) + '"/>');
  if (R.legs[0]) o.push('<path class="' + tone('leg0') + '" d="' + _legD(R.legs[0]) + '"/>');

  // neck (rooted inside the trunk so the trapezius reads), trunk, then head
  const headBase = _go(R.head, _unit(_sub(R.neck, R.head)), 4.4);
  o.push('<path class="' + tone('head') + '" d="' + _cap(_go(R.neck, R.down, 4.5), 4.5, headBase, 3.15) + '"/>');
  o.push('<path class="' + tone('torso') + '" d="' + _torsoD(R, 0) + '"/>');
  o.push('<path class="fx-spine" d="' + _spineD(R) + '"/>');
  o.push(_headEl(R, tone('head')));

  // near limbs
  if (R.legs[1]) o.push('<path class="' + tone('leg1') + '" d="' + _legD(R.legs[1]) + '"/>');
  if (R.arms[1]) o.push('<path class="' + tone('arm1') + '" d="' + _armD(R.arms[1]) + '"/>');

  props.filter(pr => pr.z !== 'back').forEach(pr => o.push(_prop(pr)));
  o.push('</svg>');
  return o.join('');
}

/* Shared gradients, arrowhead and figure styling — injected once per document. */
function figureDefs() {
  return '<style id="fx-style">' +
    ':root{--fx-rim:color-mix(in srgb, var(--ground) 55%, var(--raised));' +
    '--fx-line:color-mix(in srgb, var(--ground) 58%, var(--ink));}' +
    '.figure{display:block;overflow:visible}' +
    '.figure .fx{stroke:var(--fx-rim);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round;paint-order:stroke fill}' +
    '.figure .fx-near{fill:url(#fxNear)}' +
    '.figure .fx-far{fill:url(#fxFar)}' +
    '.figure .fx-acc{fill:url(#fxAcc)}' +
    '.figure .fx-spine{fill:none;stroke:var(--fx-line);stroke-width:1.15;stroke-linecap:round;opacity:.7}' +
    '.figure .fx-glow{fill:url(#fxGlow)}' +
    '.figure .fx-shadow{fill:url(#fxShadow)}' +
    '.figure .fig-floor{fill:none;stroke:var(--line-strong);stroke-width:1.4;stroke-linecap:round}' +
    '.figure .fig-prop{fill:none;stroke:var(--ink-3);stroke-width:2.3;stroke-linecap:round;stroke-linejoin:round}' +
    '.figure .fx-thin{stroke-width:1.5;opacity:.85}' +
    '.figure .fx-shaft{stroke-width:1.7}' +
    '.figure .fx-grip{stroke-width:3.4;stroke:var(--ink-2)}' +
    '.figure .fx-ball{fill:color-mix(in srgb, var(--accent) 26%, var(--ground));stroke:var(--ink-3);stroke-width:1.6}' +
    '.figure .fig-dash{stroke-dasharray:3.4 3.6;stroke-width:1.9}' +
    '.figure .fig-arrow{fill:none;stroke:var(--accent-text);stroke-width:2.1;stroke-linecap:round}' +
    /* flat-colour fallback where color-mix() is unavailable */
    '@supports not (color: color-mix(in srgb, #000, #fff)){' +
    ':root{--fx-rim:var(--ground);--fx-line:var(--ink-3)}' +
    '.figure .fx-near{fill:var(--ink)}.figure .fx-far{fill:var(--ink-3)}' +
    '.figure .fx-acc{fill:var(--accent-text)}.figure .fx-ball{fill:var(--accent-soft)}}' +
    '#fx-defs .a0{stop-color:var(--ink)}' +
    '#fx-defs .a1{stop-color:color-mix(in srgb, var(--ink) 70%, var(--ground))}' +
    '#fx-defs .b0{stop-color:color-mix(in srgb, var(--ink) 44%, var(--ground))}' +
    '#fx-defs .b1{stop-color:color-mix(in srgb, var(--ink) 29%, var(--ground))}' +
    '#fx-defs .c0{stop-color:color-mix(in srgb, var(--ink) 58%, var(--accent))}' +
    '#fx-defs .c1{stop-color:color-mix(in srgb, var(--ink) 42%, var(--accent))}' +
    '#fx-defs .g0{stop-color:var(--accent);stop-opacity:.3}' +
    '#fx-defs .g1{stop-color:var(--accent);stop-opacity:0}' +
    '#fx-defs .s0{stop-color:var(--ink);stop-opacity:.22}' +
    '#fx-defs .s1{stop-color:var(--ink);stop-opacity:0}' +
    '</style>' +
    '<svg id="fx-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<linearGradient id="fxNear" gradientUnits="userSpaceOnUse" x1="24" y1="4" x2="98" y2="116">' +
    '<stop offset="0" class="a0"/><stop offset="1" class="a1"/></linearGradient>' +
    '<linearGradient id="fxFar" gradientUnits="userSpaceOnUse" x1="24" y1="4" x2="98" y2="116">' +
    '<stop offset="0" class="b0"/><stop offset="1" class="b1"/></linearGradient>' +
    '<linearGradient id="fxAcc" gradientUnits="userSpaceOnUse" x1="24" y1="4" x2="98" y2="116">' +
    '<stop offset="0" class="c0"/><stop offset="1" class="c1"/></linearGradient>' +
    '<radialGradient id="fxGlow"><stop offset="0" class="g0"/><stop offset="0.42" class="g0"/><stop offset="1" class="g1"/></radialGradient>' +
    '<radialGradient id="fxShadow"><stop offset="0" class="s0"/><stop offset="1" class="s1"/></radialGradient>' +
    '<marker id="fx-ah" markerWidth="5" markerHeight="5" refX="3.4" refY="2.5" orient="auto" markerUnits="strokeWidth">' +
    '<path d="M0,0 L4.4,2.5 L0,5 Z" fill="var(--accent-text)"/></marker>' +
    '<marker id="fig-arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto" markerUnits="strokeWidth">' +
    '<path d="M0,0 L5,3 L0,6" class="fig-arrow-head"/></marker>' +
    '</defs></svg>';
}

#!/usr/bin/env node
/*
 * build-anatomy.mjs — bake the Free Relief anatomical spine asset.
 *
 * Reads the human-atlas (BodyParts3D 4.0) mesh chunks, pulls the 72 skeletal parts the app
 * needs, decimates them to a phone budget, re-origins each one onto the lab's existing bone
 * chain, and writes ONE compact binary plus a small JSON index:
 *
 *     assets/anatomy/spine.bin      the asset (self-describing: JSON header + 6 varint streams)
 *     assets/anatomy/spine.bin.gz   precompressed (gzip -9)
 *     assets/anatomy/spine.bin.br   precompressed (brotli q11)
 *     assets/anatomy/spine.json     the same header, standalone, for build tooling and humans
 *     assets/anatomy/LICENSE.txt    CC BY 4.0 attribution that must also ship in the UI
 *
 * ---------------------------------------------------------------------------------------
 * SOURCE DATA LIVES OUTSIDE THIS REPO. It is ~60 MB of BodyParts3D meshes and is not vendored.
 * Clone https://github.com/ashemag/human-atlas and point this script at its models directory:
 *
 *     node tools/build-anatomy.mjs --atlas /path/to/human-atlas/public/models
 *
 * or set ANATOMY_ATLAS_DIR, or edit DEFAULT_ATLAS_DIR just below.
 * ---------------------------------------------------------------------------------------
 *
 * Re-runnable and deterministic: same input, byte-identical output.
 *
 * Anatomy data: BodyParts3D 4.0, (c) The Database Center for Life Science, CC BY 4.0.
 * Commercial use is permitted WITH attribution; the attribution has to be visible in the app.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

/* The atlas checkout used to produce the committed asset. Override with --atlas or $ANATOMY_ATLAS_DIR. */
const DEFAULT_ATLAS_DIR =
  '/private/tmp/claude-501/-Users-brammacbook-Developer-new-project/4cdf0de1-a47d-4580-82a3-37ead199aeb1/scratchpad/human-atlas/public/models';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ constants from study 01 */

/* Uniform atlas -> lab scale. Preserves L5->C1 arc length (lab 0.60400 m / atlas 0.57481 m). */
const SCALE = 1.051;
/* The lab's pelvis bone sits here in root space (lab3d.js buildFigure). */
const LAB_PELVIS_POS = [0, 0.95, 0];
/* The lab's pelvis -> L5 link length, which the pelvis pivot is chosen to preserve. */
const PELVIS_TO_L5 = 0.056;
/* Address-pose pelvis tilt, degrees (keyframe t=0: tilt 32). Used only for the report + the
 * T2 shoulder-anchor compensation; it is NOT baked into any geometry. */
const ADDRESS_TILT_DEG = 32;

const DEG = Math.PI / 180;
const ORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];

/* ------------------------------------------------------------------ cli */

function parseArgs(argv) {
  const out = { atlas: process.env.ANATOMY_ATLAS_DIR || DEFAULT_ATLAS_DIR, out: path.join(REPO, 'assets/anatomy'), quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--atlas') out.atlas = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--quiet') out.quiet = true;
    else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else die('unknown argument: ' + a + '\n' + usageText());
  }
  return out;
}
function usageText() {
  return [
    'usage: node tools/build-anatomy.mjs [--atlas <human-atlas/public/models>] [--out <dir>] [--quiet]',
    '',
    '  --atlas  directory holding atlas.json and body-*.bin (default: $ANATOMY_ATLAS_DIR or DEFAULT_ATLAS_DIR)',
    '  --out    output directory (default: <repo>/assets/anatomy)',
  ].join('\n');
}
function usage() { console.log(usageText()); }
function die(msg) { console.error('build-anatomy: ' + msg); process.exit(1); }

/* ------------------------------------------------------------------ atlas io */

function openAtlas(dir) {
  const manifest = path.join(dir, 'atlas.json');
  if (!fs.existsSync(manifest)) {
    die(
      'cannot find atlas.json at ' + manifest + '\n\n' +
      'The BodyParts3D source data is not vendored in this repo (~60 MB).\n' +
      'Clone it, then re-run pointing at its models directory:\n\n' +
      '    git clone https://github.com/ashemag/human-atlas\n' +
      '    node tools/build-anatomy.mjs --atlas human-atlas/public/models\n\n' +
      'You can also set ANATOMY_ATLAS_DIR, or edit DEFAULT_ATLAS_DIR at the top of this file.\n' +
      'The committed asset in assets/anatomy/ is already built; you only need this to rebuild it.'
    );
  }
  const atlas = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const chunkBuf = [];
  const byName = new Map();
  for (const p of atlas.parts) {
    if (p.system !== 'skeletal') continue;         // 'rib' also matches intercostal muscles; 'disk' matches viscera
    if (!byName.has(p.name)) byName.set(p.name, p);
  }
  function chunk(i) {
    if (!chunkBuf[i]) {
      const f = path.join(dir, path.basename(atlas.chunks[i].url));
      if (!fs.existsSync(f)) die('missing geometry chunk ' + f + ' (is the human-atlas checkout complete?)');
      chunkBuf[i] = fs.readFileSync(f);
    }
    return chunkBuf[i];
  }
  /* Binary layout, verified in study 01/02:
   *   positions Float32 x3 at part.positions
   *   normals   Int16   x3 at part.normals   (unused here — invalid after decimation, recomputed at load)
   *   indices   Uint32     at part.indices   (NOT Uint16 — reading them as u16 silently halves every mesh)
   */
  function part(name) {
    const p = byName.get(name);
    if (!p) die('atlas has no skeletal part named "' + name + '" — is this the expected atlas version?');
    const b = chunk(p.chunk);
    const vc = p.vertexCount, ic = p.indexCount;
    if (p.positions + vc * 12 > b.length) die('positions overrun for ' + name);
    if (p.indices + ic * 4 > b.length) die('indices overrun for ' + name);
    const pos = new Float64Array(vc * 3);
    for (let i = 0; i < vc * 3; i++) pos[i] = b.readFloatLE(p.positions + i * 4);
    const tri = new Uint32Array(ic);
    for (let i = 0; i < ic; i++) {
      const v = b.readUInt32LE(p.indices + i * 4);
      if (v >= vc) die('index out of range in ' + name + ' (' + v + ' >= ' + vc + ')');
      tri[i] = v;
    }
    return { name, id: p.id, pos, tri };
  }
  return { atlas, part, has: (n) => byName.has(n) };
}

/* ------------------------------------------------------------------ mesh helpers */

function bbox(pos) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) { const v = pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  }
  return { mn, mx, size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]] };
}

function surfaceArea(pos, tri) {
  let s = 0;
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    s += Math.sqrt(cx * cx + cy * cy + cz * cz);
  }
  return s / 2;
}

/* Area-weighted surface centroid — the pivot definition from study 01 §5. */
function areaCentroid(pos, tri) {
  let ax = 0, ay = 0, az = 0, aw = 0;
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const w = Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
    ax += w * (pos[a] + pos[b] + pos[c]) / 3;
    ay += w * (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3;
    az += w * (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3;
    aw += w;
  }
  return [ax / aw, ay / aw, az / aw];
}

/*
 * Grid vertex clustering (study 02 §3.2). Snap to a uniform lattice, replace each occupied
 * cell with the centroid of its members, remap, drop degenerates / duplicate faces / orphans.
 * Doubles as a repair pass: the atlas meshes arrive cracked (L5 = 3 components, 408 boundary
 * edges) and come out welded, which is what makes recomputed vertex normals shade cleanly.
 */
function clusterDecimate(pos, tri, cell) {
  const n = pos.length / 3;
  const b = bbox(pos);
  const dim = [0, 0, 0];
  for (let k = 0; k < 3; k++) dim[k] = Math.floor(b.size[k] / cell) + 1;
  const span = dim[0] * dim[1] * dim[2];
  if (!(span > 0) || span > 2 ** 50) die('cluster grid overflow (' + span + ') — cell too small');

  const lin = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const kx = Math.floor((pos[i * 3] - b.mn[0]) / cell);
    const ky = Math.floor((pos[i * 3 + 1] - b.mn[1]) / cell);
    const kz = Math.floor((pos[i * 3 + 2] - b.mn[2]) / cell);
    lin[i] = (kx * dim[1] + ky) * dim[2] + kz;
  }
  /* stable cluster ids: ascending linear cell id, matching the reference numpy implementation */
  const uniq = Array.from(new Set(lin)).sort((x, y) => x - y);
  const cid = new Map();
  for (let i = 0; i < uniq.length; i++) cid.set(uniq[i], i);
  const map = new Int32Array(n);
  for (let i = 0; i < n; i++) map[i] = cid.get(lin[i]);

  const acc = new Float64Array(uniq.length * 3), cnt = new Float64Array(uniq.length);
  for (let i = 0; i < n; i++) {
    const c = map[i];
    acc[c * 3] += pos[i * 3]; acc[c * 3 + 1] += pos[i * 3 + 1]; acc[c * 3 + 2] += pos[i * 3 + 2];
    cnt[c] += 1;
  }
  const cpos = new Float64Array(uniq.length * 3);
  for (let c = 0; c < uniq.length; c++) { cpos[c * 3] = acc[c * 3] / cnt[c]; cpos[c * 3 + 1] = acc[c * 3 + 1] / cnt[c]; cpos[c * 3 + 2] = acc[c * 3 + 2] / cnt[c]; }

  const seen = new Set();
  const keep = [];
  for (let t = 0; t < tri.length; t += 3) {
    const a = map[tri[t]], b2 = map[tri[t + 1]], c = map[tri[t + 2]];
    if (a === b2 || b2 === c || a === c) continue;              // degenerate after the weld
    const s = a < b2 ? (b2 < c ? [a, b2, c] : a < c ? [a, c, b2] : [c, a, b2]) : (a < c ? [b2, a, c] : b2 < c ? [b2, c, a] : [c, b2, a]);
    const key = s[0] * 4294967296 + s[1] * 65536 + s[2];        // clusters are far below 65536 per axis here
    const key2 = (s[0] < 65536 && s[1] < 65536 && s[2] < 65536) ? key : s.join(',');
    if (seen.has(key2)) continue;                                // duplicate face
    seen.add(key2);
    keep.push(a, b2, c);
  }
  /* drop orphaned vertices, renumber in first-use order */
  const remap = new Int32Array(uniq.length).fill(-1);
  const outPos = [];
  const outTri = new Uint32Array(keep.length);
  for (let i = 0; i < keep.length; i++) {
    const v = keep[i];
    if (remap[v] < 0) { remap[v] = outPos.length / 3; outPos.push(cpos[v * 3], cpos[v * 3 + 1], cpos[v * 3 + 2]); }
    outTri[i] = remap[v];
  }
  return { pos: Float64Array.from(outPos), tri: outTri };
}

/* mean / max distance from every source vertex to its cluster representative */
function clusterError(pos, cell) {
  const n = pos.length / 3;
  const b = bbox(pos);
  const dim = [0, 0, 0];
  for (let k = 0; k < 3; k++) dim[k] = Math.floor(b.size[k] / cell) + 1;
  const acc = new Map();
  const lin = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const kx = Math.floor((pos[i * 3] - b.mn[0]) / cell), ky = Math.floor((pos[i * 3 + 1] - b.mn[1]) / cell), kz = Math.floor((pos[i * 3 + 2] - b.mn[2]) / cell);
    const l = (kx * dim[1] + ky) * dim[2] + kz;
    lin[i] = l;
    let e = acc.get(l); if (!e) { e = [0, 0, 0, 0]; acc.set(l, e); }
    e[0] += pos[i * 3]; e[1] += pos[i * 3 + 1]; e[2] += pos[i * 3 + 2]; e[3] += 1;
  }
  let sum = 0, max = 0;
  for (let i = 0; i < n; i++) {
    const e = acc.get(lin[i]);
    const dx = pos[i * 3] - e[0] / e[3], dy = pos[i * 3 + 1] - e[1] / e[3], dz = pos[i * 3 + 2] - e[2] / e[3];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    sum += d; if (d > max) max = d;
  }
  return { mean: sum / n * 1000, max: max * 1000 };
}

/* ------------------------------------------------------------------ the rig (study 01) */

/* lab3d.js vertebraSpec(i), reimplemented read-only so we can reproduce the OLD chain for the report. */
function vertebraSpec(i) {
  const lerp = (a, b, k) => a + (b - a) * k;
  if (i < 5) { const k = i / 4; return { region: 'lumbar', h: lerp(0.029, 0.026, k), d: 0.011, base: -8, label: 'L' + (5 - i) }; }
  if (i < 17) { const k = (i - 5) / 11; return { region: 'thoracic', h: lerp(0.023, 0.017, k), d: 0.006, base: 4, label: 'T' + (12 - (i - 5)) }; }
  const k = (i - 17) / 6; return { region: 'cervical', h: lerp(0.015, 0.012, k), d: 0.004, base: -3.6, label: 'C' + (7 - (i - 17)) };
}

function levelNames(i) {
  if (i < 5) {
    const n = 5 - i;                                             // L5..L1
    return { vertebra: ORD[n - 1] + ' lumbar vertebra', disc: 'Intervertebral disk of ' + ORD[n - 1].toLowerCase() + ' lumbar vertebra' };
  }
  if (i < 17) {
    const n = 12 - (i - 5);                                      // T12..T1
    /* The T12/L1 disc is the one part named just "Intervertebral disk" (id FJ3211) — easy to miss. */
    return { vertebra: ORD[n - 1] + ' thoracic vertebra', disc: n === 12 ? 'Intervertebral disk' : 'Intervertebral disk of ' + ORD[n - 1].toLowerCase() + ' thoracic vertebra' };
  }
  const n = 7 - (i - 17);                                        // C7..C1
  if (n === 1) return { vertebra: 'Atlas', disc: null };         // no C1/C2 disc exists
  if (n === 2) return { vertebra: 'Axis', disc: 'Intervertebral disk of axis' };
  return { vertebra: ORD[n - 1] + ' cervical vertebra', disc: 'Intervertebral disk of ' + ORD[n - 1].toLowerCase() + ' cervical vertebra' };
}

/* Rotation about X only — every rest rotation in the lab chain is Rx. */
function rotX(v, deg) {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const r4 = (a) => a.map((v) => Math.round(v * 1e5) / 1e5);   // 0.01 mm — finer than the 0.1 mm lattice

/* ------------------------------------------------------------------ part manifest */

const HERO = 0.0040, MID = 0.0065, FAR = 0.0090;                 // tier cell sizes, metres (study 02 §3.4)

function buildManifest(levels) {
  const parts = [];
  const push = (o) => { parts.push(o); return o; };
  const tierOf = (t) => (t === HERO ? 'hero' : t === MID ? 'mid' : 'far');

  /* pelvis group */
  push({ key: 'sacrum', name: 'Sacrum', bone: 'pelvis', group: 'pelvis', tier: HERO, stage: 1 });
  push({ key: 'hip_L', name: 'Left hip bone', bone: 'pelvis', group: 'pelvis', tier: MID, stage: 1 });
  push({ key: 'hip_R', name: 'Right hip bone', bone: 'pelvis', group: 'pelvis', tier: MID, stage: 1 });

  /* vertebrae + the disc below each */
  for (const lv of levels) {
    const lab = lv.label;
    let tier = FAR, stage = 2;
    if (lv.region === 'lumbar') { tier = HERO; stage = 1; }
    else if (lv.region === 'thoracic') {
      const n = +lab.slice(1);
      if (n >= 10) { tier = HERO; stage = 1; }
      else if (n >= 8) { tier = MID; stage = 1; }
      else { tier = FAR; stage = 2; }
    }
    push({ key: 'vert_' + lab, name: lv.vertebraName, bone: lab, group: 'vertebra', tier, stage });
    if (lv.discName) push({ key: 'disc_' + lab, name: lv.discName, bone: lab, group: 'disc', tier, stage });
  }

  /* ribs + costal cartilage: right side only, mirrored in X at load (asymmetry 1.2–1.5 mm mean,
   * smaller than the decimation error, and it halves the payload). */
  for (let n = 1; n <= 12; n++) {
    push({ key: 'rib_R_' + n, name: 'Right ' + ORD[n - 1].toLowerCase() + ' rib', bone: 'T' + n, group: 'rib', tier: MID, stage: 2, mirror: 'rib_L_' + n });
  }
  for (let n = 1; n <= 7; n++) {
    push({ key: 'cart_R_' + n, name: 'Right ' + ORD[n - 1].toLowerCase() + ' costal cartilage', bone: 'T' + n, group: 'cartilage', tier: MID, stage: 2, mirror: 'cart_L_' + n });
  }

  /* sternum — bone assignment resolved later from its own height */
  push({ key: 'sternum_manubrium', name: 'Manubrium', bone: null, group: 'sternum', tier: MID, stage: 2 });
  push({ key: 'sternum_body', name: 'Body of sternum', bone: null, group: 'sternum', tier: MID, stage: 2 });
  push({ key: 'sternum_xiphoid', name: 'Xiphoid process', bone: null, group: 'sternum', tier: MID, stage: 2 });

  for (const p of parts) p.tierName = tierOf(p.tier);
  return parts;
}

/* ------------------------------------------------------------------ varint codec */

function zig(n) { return n < 0 ? -n * 2 - 1 : n * 2; }
class ByteSink {
  constructor() { this.buf = new Uint8Array(1 << 16); this.n = 0; }
  push(b) { if (this.n === this.buf.length) { const g = new Uint8Array(this.buf.length * 2); g.set(this.buf); this.buf = g; } this.buf[this.n++] = b; }
  varint(v) { v = v >>> 0; while (v >= 0x80) { this.push((v & 0x7f) | 0x80); v = v >>> 7; } this.push(v); }
  bytes() { return this.buf.subarray(0, this.n); }
}

/* 8-bit -> 24-bit bit spread, for a 48-bit Morton code held exactly in a double */
const SPREAD = new Uint32Array(256);
for (let i = 0; i < 256; i++) { let v = 0; for (let b = 0; b < 8; b++) if (i & (1 << b)) v |= 1 << (3 * b); SPREAD[i] = v >>> 0; }
function morton(x, y, z) {
  const hi = SPREAD[(x >>> 8) & 255] | (SPREAD[(y >>> 8) & 255] << 1) | (SPREAD[(z >>> 8) & 255] << 2);
  const lo = SPREAD[x & 255] | (SPREAD[y & 255] << 1) | (SPREAD[z & 255] << 2);
  return (hi >>> 0) * 16777216 + (lo >>> 0);
}

/* ------------------------------------------------------------------ main */

const args = parseArgs(process.argv.slice(2));
const log = args.quiet ? () => {} : (...a) => console.log(...a);
const src = openAtlas(args.atlas);

log('build-anatomy — Free Relief spine asset');
log('  atlas   ' + args.atlas);
log('  version ' + src.atlas.version + '  (' + src.atlas.sex + ', ' + src.atlas.triangles.toLocaleString() + ' source triangles)');
log('  out     ' + args.out);
log('');

/* --- 1. levels, raw meshes, pivots ------------------------------------------------------- */

const levels = [];
for (let i = 0; i < 24; i++) {
  const spec = vertebraSpec(i);
  const nm = levelNames(i);
  levels.push({
    index: i, label: spec.label, region: spec.region,
    baseX: (i === 0 ? 16 : 0) + spec.base,          // lab3d: L5 gets an extra +16 out of the pelvis
    vertebraName: nm.vertebra, discName: nm.disc,
    oldOffsetY: (i === 0 ? 0.045 : vertebraSpec(i - 1).h) + spec.d,
  });
}

const raw = new Map();
function rawMesh(name) { if (!raw.has(name)) raw.set(name, src.part(name)); return raw.get(name); }

/* pivot = area-weighted centroid of the disc immediately below the vertebra */
for (const lv of levels) {
  if (lv.discName) { const m = rawMesh(lv.discName); lv.pivot = areaCentroid(m.pos, m.tri); }
}
/* the atlas midline: the 23 disc centroids all sit on it (x = -0.0007 +/- 0.0002) */
const withDisc = levels.filter((l) => l.pivot);
const midlineX = withDisc.reduce((s, l) => s + l.pivot[0], 0) / withDisc.length;
/* C1 has no disc below it. Pivot = the atlanto-axial joint = centroid of the lowest 20% of
 * Atlas vertices (its inferior articular facets), x snapped to the midline. */
{
  const c1 = levels[23], m = rawMesh('Atlas');
  const ys = [];
  for (let i = 1; i < m.pos.length; i += 3) ys.push(m.pos[i]);
  ys.sort((a, b) => a - b);
  const cut = ys[Math.max(0, Math.ceil(ys.length * 0.2) - 1)];
  let sx = 0, sy = 0, sz = 0, n = 0;
  for (let i = 0; i < m.pos.length; i += 3) if (m.pos[i + 1] <= cut) { sx += m.pos[i]; sy += m.pos[i + 1]; sz += m.pos[i + 2]; n++; }
  c1.pivot = [midlineX, sy / n, sz / n];
}
/* pelvis pivot: placed so the existing pelvis -> L5 link keeps its 0.056 m length */
const pelvisPivot = [levels[0].pivot[0], levels[0].pivot[1] - PELVIS_TO_L5 / SCALE, levels[0].pivot[2]];

/* accumulated rest rotation (X only) through and including each level */
let acc = 0;
for (const lv of levels) { lv.accParent = acc; acc += lv.baseX; lv.acc = acc; }

/* new local bone offsets: off_i = Rx(-acc_{i-1}) . S . (P_i - P_{i-1}) */
for (let i = 0; i < 24; i++) {
  const lv = levels[i];
  const prev = i === 0 ? pelvisPivot : levels[i - 1].pivot;
  lv.offset = rotX(mul3(sub3(lv.pivot, prev), SCALE), -lv.accParent);
}

/* --- 2. resolve the sternum's attachment bone from its own height ------------------------ */

const manifest = buildManifest(levels);
for (const p of manifest) {
  if (p.bone !== null) continue;
  const m = rawMesh(p.name);
  const c = bbox(m.pos);
  const y = (c.mn[1] + c.mx[1]) / 2;
  let best = null;
  for (const lv of levels) if (lv.region === 'thoracic') { const d = Math.abs(lv.pivot[1] - y); if (!best || d < best.d) best = { d, lv }; }
  p.bone = best.lv.label;
  p.boneNote = 'nearest thoracic pivot to its own mid-height (y=' + y.toFixed(3) + ')';
}
const boneOf = new Map(levels.map((l) => [l.label, l]));

/* --- 3. decimate + re-origin ------------------------------------------------------------- */

log('decimating ' + manifest.length + ' parts …');
const AUDIT = new Set(['First lumbar vertebra', 'Fifth lumbar vertebra', 'Seventh thoracic vertebra', 'Sacrum']);
const auditRows = [];
let rawTris = 0, shipTris = 0, shipVerts = 0, screenTris = 0;
const areaPcts = [];

for (const p of manifest) {
  const m = rawMesh(p.name);
  const bb = bbox(m.pos);
  /* flatness clamp: a 6 mm cervical disc must not get a 9 mm cell (it melts to 51% area) */
  const minExt = Math.min(bb.size[0], bb.size[1], bb.size[2]);
  p.cell = Math.min(p.tier, Math.max(0.0015, minExt / 3));

  const dec = clusterDecimate(m.pos, m.tri, p.cell);
  const err = clusterError(m.pos, p.cell);
  const a0 = surfaceArea(m.pos, m.tri), a1 = surfaceArea(dec.pos, dec.tri);
  p.rawTriangles = m.tri.length / 3;
  p.triangleCount = dec.tri.length / 3;
  p.vertexCount = dec.pos.length / 3;
  p.areaPct = a1 / a0 * 100;
  p.errMeanMm = err.mean; p.errMaxMm = err.max;
  areaPcts.push(p.areaPct);
  rawTris += p.rawTriangles;
  shipTris += p.triangleCount;
  shipVerts += p.vertexCount;
  screenTris += p.triangleCount * (p.mirror ? 2 : 1);

  if (AUDIT.has(p.name)) {
    const b1 = bbox(dec.pos);
    auditRows.push({
      name: p.name, rawT: p.rawTriangles, decT: p.triangleCount, cell: p.cell,
      before: bb, after: b1,
      dMin: b1.mn.map((v, k) => (v - bb.mn[k]) * 1000),
      dMax: b1.mx.map((v, k) => (v - bb.mx[k]) * 1000),
      areaPct: p.areaPct,
    });
  }

  /* re-origin into the bone's local frame:  v_local = Rx(-acc_i) . S . (v - P_i)
   * (pelvis: acc = 0, P = pelvisPivot). Study 01 §5 proves the whole reconstructed rest spine
   * then collapses to one rigid similarity transform of the atlas. */
  const lv = p.bone === 'pelvis' ? null : boneOf.get(p.bone);
  const P = lv ? lv.pivot : pelvisPivot;
  const A = lv ? lv.acc : 0;
  const local = new Float64Array(dec.pos.length);
  for (let i = 0; i < dec.pos.length; i += 3) {
    const v = rotX([(dec.pos[i] - P[0]) * SCALE, (dec.pos[i + 1] - P[1]) * SCALE, (dec.pos[i + 2] - P[2]) * SCALE], -A);
    local[i] = v[0]; local[i + 1] = v[1]; local[i + 2] = v[2];
  }
  p.local = local;
  p.decPos = dec.pos;      // decimated, still in atlas space — kept for the closure check below
  p.tri = dec.tri;
}

/* --- 4. quantise onto one global 0.1 mm lattice ------------------------------------------ */

const STEP = 0.0001;
const gmn = [Infinity, Infinity, Infinity], gmx = [-Infinity, -Infinity, -Infinity];
for (const p of manifest) for (let i = 0; i < p.local.length; i += 3) for (let k = 0; k < 3; k++) { const v = p.local[i + k]; if (v < gmn[k]) gmn[k] = v; if (v > gmx[k]) gmx[k] = v; }
const origin = gmn.map((v) => Math.floor(v / STEP) * STEP);
for (let k = 0; k < 3; k++) {
  const steps = Math.ceil((gmx[k] - origin[k]) / STEP);
  if (steps > 65535) die('quantisation range overflow on axis ' + k + ' (' + steps + ' steps > 65535)');
}

/* --- 5. encode: Morton order, zigzag varint deltas, six SoA streams ---------------------- */

const sx = new ByteSink(), sy = new ByteSink(), sz = new ByteSink();
const t0 = new ByteSink(), t1 = new ByteSink(), t2 = new ByteSink();

for (const p of manifest) {
  const n = p.vertexCount;
  const q = new Uint16Array(n * 3);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) q[i * 3 + k] = Math.round((p.local[i * 3 + k] - origin[k]) / STEP);

  /* Morton (Z-order) sort makes consecutive vertices spatially adjacent, so the deltas are ~1 byte */
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  const code = new Float64Array(n);
  for (let i = 0; i < n; i++) code[i] = morton(q[i * 3], q[i * 3 + 1], q[i * 3 + 2]);
  const ord = Array.from(order).sort((a, b) => (code[a] - code[b]) || (a - b));
  const inv = new Int32Array(n);
  for (let i = 0; i < n; i++) inv[ord[i]] = i;

  let px = 0, py = 0, pz = 0;
  for (let i = 0; i < n; i++) {
    const s = ord[i] * 3;
    sx.varint(zig(q[s] - px)); sy.varint(zig(q[s + 1] - py)); sz.varint(zig(q[s + 2] - pz));
    px = q[s]; py = q[s + 1]; pz = q[s + 2];
  }

  /* triangles: rotate so the smallest index leads, sort by it, delta-code the lead index */
  const tris = [];
  for (let t = 0; t < p.tri.length; t += 3) {
    let a = inv[p.tri[t]], b = inv[p.tri[t + 1]], c = inv[p.tri[t + 2]];
    if (b < a && b <= c) { const x = a; a = b; b = c; c = x; }
    else if (c < a && c < b) { const x = a; a = c; c = b; b = x; }
    tris.push([a, b, c]);
  }
  tris.sort((u, v) => (u[0] - v[0]) || (u[1] - v[1]) || (u[2] - v[2]));
  let prev = 0;
  for (const t of tris) { t0.varint(zig(t[0] - prev)); t1.varint(zig(t[1] - t[0])); t2.varint(zig(t[2] - t[0])); prev = t[0]; }

  /* keep the encoded vertex order so the audit below can compare like for like */
  p.encOrder = ord;
}

/* --- 6. header + container --------------------------------------------------------------- */

/* T2 shoulder-anchor compensation: forward-sim the old and new chains at address (t = 0) and
 * solve for the local offset that leaves the world anchor bit-identical. */
function chainWorld(offsets) {
  let pos = LAB_PELVIS_POS.slice(), a = ADDRESS_TILT_DEG;
  const out = [];
  for (let i = 0; i < 24; i++) {
    pos = add3(pos, rotX(offsets[i], a));
    a += levels[i].baseX;
    out.push({ label: levels[i].label, pos, acc: a });
  }
  return out;
}
const oldChain = chainWorld(levels.map((l) => [0, l.oldOffsetY, 0]));
const newChain = chainWorld(levels.map((l) => l.offset));
const t2Old = oldChain.find((b) => b.label === 'T2'), t2New = newChain.find((b) => b.label === 'T2');
const OLD_SH = [0.20, -0.010, 0.0];
const worldAnchor = add3(t2Old.pos, rotX(OLD_SH, t2Old.acc));
const newSh = rotX(sub3(worldAnchor, t2New.pos), -t2New.acc);

const header = {
  format: 'free-relief-anatomy',
  version: 1,
  generator: 'tools/build-anatomy.mjs',
  source: {
    dataset: 'BodyParts3D 4.0',
    copyright: 'The Database Center for Life Science (DBCLS)',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    via: 'human-atlas (github.com/ashemag/human-atlas)',
    note: 'Attribution must be visible in the shipped app, not just in the repo.',
  },
  quant: { origin: origin.map((v) => Math.round(v * 1e7) / 1e7), step: STEP },
  counts: {
    parts: manifest.length,
    partsOnScreen: manifest.length + manifest.filter((p) => p.mirror).length,
    vertices: shipVerts,
    triangles: shipTris,
    trianglesOnScreen: screenTris,
    rawTriangles: rawTris,
  },
  streams: { x: sx.n, y: sy.n, z: sz.n, t0: t0.n, t1: t1.n, t2: t2.n },
  rig: {
    scale: SCALE,
    /* lab = SCALE * atlas + translate, for anything that needs to go back to atlas space */
    translate: r4(sub3(LAB_PELVIS_POS, mul3(pelvisPivot, SCALE))),
    pelvisPivot: r4(pelvisPivot),
    labPelvisPosition: LAB_PELVIS_POS,
    midlineX: Math.round(midlineX * 1e6) / 1e6,
    /* Per-bone REPLACEMENT for b.position in buildFigure(). base.x is unchanged from lab3d.js. */
    bones: levels.map((l) => ({
      label: l.label, region: l.region,
      baseXDeg: Math.round(l.baseX * 1e4) / 1e4,
      accXDeg: Math.round(l.acc * 1e4) / 1e4,
      offset: r4(l.offset),
    })),
    /* buildFigure() shoulder cup/hit region and pose() shL/shR must move by this much so the
     * arms, the club and all nine keyframes keep working untouched. */
    shoulderAnchor: { old: OLD_SH, new: r4(newSh), bone: 'T2' },
    /* If the procedural pelvis is replaced, the leg-IK hip anchors move here (pelvis-local). */
    hipAnchorHint: [0.0917, -0.0471, 0.0082],
  },
  parts: manifest.map((p) => {
    const o = {
      key: p.key, name: p.name, bone: p.bone, group: p.group, stage: p.stage,
      vertexCount: p.vertexCount, triangleCount: p.triangleCount,
    };
    if (p.mirror) o.mirror = p.mirror;                 // loader also emits an X-mirrored copy under this key
    return o;
  }),
};

const headerJson = Buffer.from(JSON.stringify(header), 'utf8');
const pad = (4 - (headerJson.length % 4)) % 4;
const head = Buffer.concat([headerJson, Buffer.alloc(pad, 0x20)]);
const pre = Buffer.alloc(12);
pre.write('FRAN', 0, 'ascii');
pre.writeUInt16LE(1, 4);       // container version
pre.writeUInt16LE(0, 6);       // reserved
pre.writeUInt32LE(head.length, 8);
const bin = Buffer.concat([pre, head, Buffer.from(sx.bytes()), Buffer.from(sy.bytes()), Buffer.from(sz.bytes()), Buffer.from(t0.bytes()), Buffer.from(t1.bytes()), Buffer.from(t2.bytes())]);

fs.mkdirSync(args.out, { recursive: true });
const binPath = path.join(args.out, 'spine.bin');
fs.writeFileSync(binPath, bin);
const gz = zlib.gzipSync(bin, { level: 9 });
const br = zlib.brotliCompressSync(bin, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bin.length } });
fs.writeFileSync(binPath + '.gz', gz);
fs.writeFileSync(binPath + '.br', br);

/* the standalone JSON index — same header, plus per-part build stats for tooling and review */
const index = JSON.parse(JSON.stringify(header));
index.asset = { file: 'spine.bin', bytes: bin.length, gzipBytes: gz.length, brotliBytes: br.length, headerBytes: head.length };
/* the index carries the working values the binary header does not need to spend bytes on */
index.rig.bones = levels.map((l) => ({
  index: l.index, label: l.label, region: l.region,
  baseXDeg: Math.round(l.baseX * 1e4) / 1e4,
  accXDeg: Math.round(l.acc * 1e4) / 1e4,
  offset: r4(l.offset),
  oldOffset: [0, Math.round(l.oldOffsetY * 1e6) / 1e6, 0],
  pivotAtlas: l.pivot.map((v) => Math.round(v * 1e5) / 1e5),
  addressWorldY: Math.round(newChain[l.index].pos[1] * 1e4) / 1e4,
  oldAddressWorldY: Math.round(oldChain[l.index].pos[1] * 1e4) / 1e4,
  movesMm: r4(sub3(newChain[l.index].pos, oldChain[l.index].pos)).map((v) => Math.round(v * 1e5) / 100),
}));
index.parts = manifest.map((p) => ({
  key: p.key, name: p.name, bone: p.bone, group: p.group, stage: p.stage, mirror: p.mirror || null,
  tier: p.tierName, cellMm: Math.round(p.cell * 100000) / 100,
  rawTriangles: p.rawTriangles, triangleCount: p.triangleCount, vertexCount: p.vertexCount,
  areaRetentionPct: Math.round(p.areaPct * 10) / 10,
  errMeanMm: Math.round(p.errMeanMm * 100) / 100, errMaxMm: Math.round(p.errMaxMm * 100) / 100,
}));
fs.writeFileSync(path.join(args.out, 'spine.json'), JSON.stringify(index, null, 1) + '\n');

fs.writeFileSync(path.join(args.out, 'LICENSE.txt'), [
  'Free Relief — anatomical spine asset (assets/anatomy/spine.bin)',
  '',
  'Geometry derived from BodyParts3D 4.0.',
  'Copyright (c) The Database Center for Life Science (DBCLS), Japan.',
  'Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).',
  'https://creativecommons.org/licenses/by/4.0/',
  '',
  'Obtained via human-atlas (https://github.com/ashemag/human-atlas), application code MIT (c) ashemag.',
  '',
  'The meshes here are modified: a subset of skeletal parts, decimated by grid vertex clustering,',
  'rescaled by ' + SCALE + ', re-origined onto the Free Relief joint chain and re-encoded.',
  '',
  'CC BY 4.0 permits commercial use WITH attribution. The attribution must be visible in the',
  'running app (credits/about panel), not only in this repository.',
].join('\n') + '\n');

/* --- 7. verification --------------------------------------------------------------------- */

log('');
log('decimation audit — bounds are atlas metres, deltas millimetres');
for (const r of auditRows) {
  log('  ' + r.name);
  log('    triangles  ' + String(r.rawT).padStart(6) + ' -> ' + String(r.decT).padStart(5) +
      '   (' + (r.decT / r.rawT * 100).toFixed(1) + '%)   cell ' + (r.cell * 1000).toFixed(1) + ' mm   area retained ' + r.areaPct.toFixed(1) + '%');
  log('    bbox before  min ' + r.before.mn.map((v) => v.toFixed(4)).join(' ') + '   max ' + r.before.mx.map((v) => v.toFixed(4)).join(' '));
  log('    bbox after   min ' + r.after.mn.map((v) => v.toFixed(4)).join(' ') + '   max ' + r.after.mx.map((v) => v.toFixed(4)).join(' '));
  log('    moved        min ' + r.dMin.map((v) => (v >= 0 ? '+' : '') + v.toFixed(2)).join(' ') + '   max ' + r.dMax.map((v) => (v >= 0 ? '+' : '') + v.toFixed(2)).join(' ') + '  (mm)');
}
const worstBound = Math.max(...auditRows.flatMap((r) => r.dMin.concat(r.dMax).map(Math.abs)));
log('  worst audited bound movement: ' + worstBound.toFixed(2) + ' mm');

/* End-to-end: forward-simulate the rebuilt rest chain and confirm every part's local geometry,
 * pushed back through its bone, lands on the plain similarity transform of the atlas. */
let worldErr = 0;
{
  const T = sub3(LAB_PELVIS_POS, mul3(pelvisPivot, SCALE));
  const bonePos = new Map([['pelvis', LAB_PELVIS_POS.slice()]]);
  let p = LAB_PELVIS_POS.slice(), a = 0;
  for (const lv of levels) { p = add3(p, rotX(lv.offset, a)); a += lv.baseX; bonePos.set(lv.label, p); }
  for (const part of manifest) {
    const lv = part.bone === 'pelvis' ? null : boneOf.get(part.bone);
    const bp = bonePos.get(part.bone), A = lv ? lv.acc : 0;
    for (let i = 0; i < part.local.length; i += 3) {
      /* where the vertex actually lands once the rebuilt bone chain is walked */
      const got = add3(bp, rotX([part.local[i], part.local[i + 1], part.local[i + 2]], A));
      /* where it must land: the decimated ATLAS vertex under the one rigid similarity lab = S·atlas + T */
      const want = add3(mul3([part.decPos[i], part.decPos[i + 1], part.decPos[i + 2]], SCALE), T);
      const d = Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]);
      if (d > worldErr) worldErr = d;
    }
  }
}
log('  rest-chain closure: max |forward-sim − S·atlas+T| = ' + (worldErr * 1000).toExponential(2) + ' mm over all ' + manifest.length + ' parts');

/* --- 8. summary --------------------------------------------------------------------------- */

areaPcts.sort((a, b) => a - b);
const pct = (q) => areaPcts[Math.min(areaPcts.length - 1, Math.floor(areaPcts.length * q))];
const byGroup = new Map();
for (const p of manifest) {
  const g = byGroup.get(p.group) || { parts: 0, raw: 0, ship: 0, screen: 0 };
  g.parts++; g.raw += p.rawTriangles; g.ship += p.triangleCount; g.screen += p.triangleCount * (p.mirror ? 2 : 1);
  byGroup.set(p.group, g);
}
log('');
log('group            parts     raw t    ship t   screen t');
for (const [g, v] of byGroup) log('  ' + g.padEnd(13) + String(v.parts).padStart(5) + String(v.raw).padStart(10) + String(v.ship).padStart(10) + String(v.screen).padStart(11));
log('  ' + 'TOTAL'.padEnd(13) + String(manifest.length).padStart(5) + String(rawTris).padStart(10) + String(shipTris).padStart(10) + String(screenTris).padStart(11));
log('');
log('quality   area retention  min ' + areaPcts[0].toFixed(0) + '%  p10 ' + pct(0.1).toFixed(0) + '%  median ' + pct(0.5).toFixed(0) + '%');
log('          vertices ' + shipVerts + (shipVerts < 65536 ? '  (< 65536 — Uint16 indices are safe merged)' : '  (>= 65536 — merged mesh needs Uint32 indices!)'));
log('');
log('bytes     header ' + head.length + '   streams xyz ' + (sx.n + sy.n + sz.n) + '   idx ' + (t0.n + t1.n + t2.n));
log('          spine.bin      ' + bin.length.toLocaleString() + ' raw');
log('          spine.bin.gz   ' + gz.length.toLocaleString() + ' gzip -9   (' + (bin.length / shipTris).toFixed(2) + ' B/tri raw, ' + (gz.length / shipTris).toFixed(2) + ' B/tri gzip)');
log('          spine.bin.br   ' + br.length.toLocaleString() + ' brotli q11');
log('');
log('rig       T2 shoulder anchor: (±0.20, ' + OLD_SH[1] + ', ' + OLD_SH[2] + ')  ->  (±0.20, ' + newSh[1].toFixed(4) + ', ' + newSh[2].toFixed(4) + ')');
log('          joints that move at address (mm): ' + newChain.map((b, i) => b.label + ' ' + ((b.pos[1] - oldChain[i].pos[1]) * 1000).toFixed(0)).filter((_, i) => i % 4 === 0 || i === 23).join('  '));
log('          sternum attachment: ' + manifest.filter((p) => p.group === 'sternum').map((p) => p.name + '→' + p.bone).join(', '));
log('');
log('wrote ' + path.join(args.out, 'spine.bin') + ' (+ .gz, .br), spine.json, LICENSE.txt');

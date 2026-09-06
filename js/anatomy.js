/*! Anatomy geometry adapted from BodyParts3D, (c) The Database Center for Life Science,
    licensed under CC Attribution 4.0 International. https://creativecommons.org/licenses/by/4.0/
    Modified: subset selected, re-simplified, re-rigged. Via Human Atlas (MIT, (c) 2026 ashemag).
    Full notice: see "Credits and licences" in the app. */
/*
 * anatomy.js — loader for the Free Relief anatomical spine asset (assets/anatomy/spine.bin).
 *
 *   Anatomy.load('assets/anatomy/spine.bin').then(onReady, onFail);
 *
 *     onReady(a)   a.parts['vert_L5']  THREE.BufferGeometry, already in L5's bone-local frame
 *                  a.parts['rib_L_6']  mirrored copy, generated here
 *                  a.rig.bones         the new per-bone offsets buildFigure() should use
 *     onFail(err)  do nothing - the procedural skeleton is already on screen and stays
 *
 * Plain ES5 IIFE. No modules, no bundler; three.js is expected as the global THREE (r147+).
 * Every failure path rejects cleanly — the caller is expected to keep whatever is already
 * on screen. Nothing here touches the DOM, the scene, or any global other than window.Anatomy.
 *
 * Container (written by tools/build-anatomy.mjs):
 *   0   'FRAN'         magic
 *   4   uint16         container version (1)
 *   6   uint16         reserved
 *   8   uint32         header length
 *   12  utf8 JSON      header: quant lattice, rig, per-part vertex/triangle counts, stream sizes
 *   ..  six byte streams, concatenated in order: x, y, z, t0, t1, t2
 *
 * Vertices are Morton-ordered and stored as zigzag-varint deltas of a global 0.1 mm integer
 * lattice, one stream per axis. Triangles are stored as zigzag varints of (i0 - previous i0),
 * (i1 - i0) and (i2 - i0). Normals are not stored — they are invalid after decimation, so they
 * are recomputed here (area-weighted, over the welded mesh, which is why they come out smooth).
 *
 * Geometry data: BodyParts3D 4.0 (c) The Database Center for Life Science, CC BY 4.0.
 * That attribution must be visible in the running app. `result.licence` carries the string.
 */
(function (global) {
  'use strict';

  var CONTAINER_VERSION = 1;
  var SLICE_MS = 8;               // main-thread budget per decode slice

  /* ---------------------------------------------------------------- small utilities */

  function fail(msg) { var e = new Error('Anatomy: ' + msg); e.anatomy = true; return e; }

  function utf8(bytes) {
    if (global.TextDecoder) return new global.TextDecoder('utf-8').decode(bytes);
    var s = '', i = 0, n = bytes.length, c;
    while (i < n) {
      c = bytes[i++];
      if (c < 0x80) s += String.fromCharCode(c);
      else if (c < 0xe0) s += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
      else s += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    }
    return s;
  }

  /* varint cursor. Values here never exceed ~2^17, but the decode is written with multiplication
   * rather than shifts so it stays correct past 31 bits. */
  function Cursor(bytes) { this.a = bytes; this.p = 0; }
  Cursor.prototype.varint = function () {
    var r = 0, sh = 1, b;
    do {
      if (this.p >= this.a.length) throw fail('stream underrun');
      b = this.a[this.p++];
      r += (b & 0x7f) * sh;
      sh *= 128;
    } while (b & 0x80);
    return r;
  };
  Cursor.prototype.zig = function () { var n = this.varint(); return (n % 2) ? -(n + 1) / 2 : n / 2; };

  function schedule(fn) {
    if (global.setTimeout) global.setTimeout(fn, 0);
    else fn();
  }

  function now() { return (global.performance && global.performance.now) ? global.performance.now() : Date.now(); }

  /* ---------------------------------------------------------------- header */

  function readHeader(buffer) {
    if (!buffer || typeof buffer.byteLength !== 'number') throw fail('not an ArrayBuffer');
    if (buffer.byteLength < 16) throw fail('asset too small (' + buffer.byteLength + ' bytes)');
    var u8 = new Uint8Array(buffer);
    if (u8[0] !== 70 || u8[1] !== 82 || u8[2] !== 65 || u8[3] !== 78) throw fail('bad magic — not a spine.bin');
    var dv = new DataView(buffer);
    var ver = dv.getUint16(4, true);
    if (ver !== CONTAINER_VERSION) throw fail('container version ' + ver + ', expected ' + CONTAINER_VERSION);
    var hlen = dv.getUint32(8, true);
    if (12 + hlen > buffer.byteLength) throw fail('header length overruns the file');
    var header;
    try { header = JSON.parse(utf8(u8.subarray(12, 12 + hlen))); }
    catch (e) { throw fail('header is not valid JSON'); }
    if (!header || !header.parts || !header.streams || !header.quant) throw fail('header is missing required fields');

    var names = ['x', 'y', 'z', 't0', 't1', 't2'];
    var at = 12 + hlen, cur = {}, i;
    for (i = 0; i < names.length; i++) {
      var len = header.streams[names[i]];
      if (typeof len !== 'number' || len < 0) throw fail('stream "' + names[i] + '" has no length');
      if (at + len > buffer.byteLength) throw fail('stream "' + names[i] + '" overruns the file');
      cur[names[i]] = new Cursor(u8.subarray(at, at + len));
      at += len;
    }
    if (at !== buffer.byteLength) throw fail('trailing bytes after the last stream (' + (buffer.byteLength - at) + ')');
    return { header: header, cur: cur };
  }

  /* ---------------------------------------------------------------- geometry */

  function computeNormals(pos, idx) {
    var nrm = new Float32Array(pos.length), i;
    for (i = 0; i < idx.length; i += 3) {
      var a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      var ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
      var vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      /* unnormalised cross product == 2 * area, so this weights by triangle area for free */
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      nrm[a] += nx; nrm[a + 1] += ny; nrm[a + 2] += nz;
      nrm[b] += nx; nrm[b + 1] += ny; nrm[b + 2] += nz;
      nrm[c] += nx; nrm[c + 1] += ny; nrm[c + 2] += nz;
    }
    for (i = 0; i < nrm.length; i += 3) {
      var l = Math.sqrt(nrm[i] * nrm[i] + nrm[i + 1] * nrm[i + 1] + nrm[i + 2] * nrm[i + 2]);
      if (l > 1e-12) { nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l; }
      else { nrm[i] = 0; nrm[i + 1] = 1; nrm[i + 2] = 0; }
    }
    return nrm;
  }

  function makeGeometry(THREE, pos, nrm, idx, meta) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.userData = meta;
    if (g.computeBoundingSphere) g.computeBoundingSphere();
    return g;
  }

  /* Mirror across the bone-local X = 0 plane. The atlas midline runs through every spinal pivot,
   * so local X = 0 IS the body midline; a mirrored right rib is the left rib to ~1.4 mm mean,
   * which is finer than the decimation error. Negating X inverts triangle winding, so the index
   * order is reversed and the normals' X is negated (M(u x v) for M = diag(-1,1,1)). */
  function mirrorPart(THREE, pos, nrm, idx, meta) {
    var mp = new Float32Array(pos.length), mn = new Float32Array(nrm.length), i;
    for (i = 0; i < pos.length; i += 3) {
      mp[i] = -pos[i]; mp[i + 1] = pos[i + 1]; mp[i + 2] = pos[i + 2];
      mn[i] = -nrm[i]; mn[i + 1] = nrm[i + 1]; mn[i + 2] = nrm[i + 2];
    }
    var mi = new idx.constructor(idx.length);
    for (i = 0; i < idx.length; i += 3) { mi[i] = idx[i]; mi[i + 1] = idx[i + 2]; mi[i + 2] = idx[i + 1]; }
    return makeGeometry(THREE, mp, mn, mi, meta);
  }

  /* ---------------------------------------------------------------- part decode */

  function decodePart(THREE, spec, cur, quant, out) {
    var n = spec.vertexCount | 0, m = spec.triangleCount | 0, i;
    if (n <= 0 || m <= 0) throw fail('part "' + spec.key + '" has no geometry');

    var pos = new Float32Array(n * 3);
    var ox = quant.origin[0], oy = quant.origin[1], oz = quant.origin[2], st = quant.step;
    var px = 0, py = 0, pz = 0;
    for (i = 0; i < n; i++) {
      px += cur.x.zig(); py += cur.y.zig(); pz += cur.z.zig();
      pos[i * 3] = ox + px * st; pos[i * 3 + 1] = oy + py * st; pos[i * 3 + 2] = oz + pz * st;
    }

    var idx = n > 65535 ? new Uint32Array(m * 3) : new Uint16Array(m * 3);
    var prev = 0;
    for (i = 0; i < m; i++) {
      var i0 = prev + cur.t0.zig();
      var i1 = i0 + cur.t1.zig();
      var i2 = i0 + cur.t2.zig();
      if (i0 < 0 || i1 < 0 || i2 < 0 || i0 >= n || i1 >= n || i2 >= n) throw fail('part "' + spec.key + '" has an out-of-range index');
      idx[i * 3] = i0; idx[i * 3 + 1] = i1; idx[i * 3 + 2] = i2;
      prev = i0;
    }

    var nrm = computeNormals(pos, idx);
    var meta = {
      key: spec.key, name: spec.name, bone: spec.bone, group: spec.group,
      stage: spec.stage, mirrored: false, triangleCount: m,
    };
    out.parts[spec.key] = makeGeometry(THREE, pos, nrm, idx, meta);
    out.order.push(spec.key);

    if (spec.mirror) {
      var mmeta = {
        key: spec.mirror, name: spec.name + ' (mirrored)', bone: spec.bone, group: spec.group,
        stage: spec.stage, mirrored: true, mirrorOf: spec.key, triangleCount: m,
      };
      out.parts[spec.mirror] = mirrorPart(THREE, pos, nrm, idx, mmeta);
      out.order.push(spec.mirror);
    }
  }

  /* ---------------------------------------------------------------- decode driver */

  function newResult(header) {
    return {
      header: header,
      rig: header.rig || null,
      quant: header.quant,
      counts: header.counts || null,
      licence: header.source
        ? (header.source.dataset + ', © ' + header.source.copyright + ', ' + header.source.licence)
        : '',
      parts: {},
      order: [],
    };
  }

  /* Decode everything in one go. ~45 ms on a laptop, ~150-220 ms on a mid-range phone, so
   * prefer decode() unless you know you are off the critical path already. */
  function decodeSync(buffer) {
    var THREE = global.THREE;
    if (!THREE || !THREE.BufferGeometry) throw fail('three.js global (THREE) is not loaded');
    var h = readHeader(buffer);
    var out = newResult(h.header);
    for (var i = 0; i < h.header.parts.length; i++) decodePart(THREE, h.header.parts[i], h.cur, h.header.quant, out);
    return out;
  }

  /* Same, but yields to the event loop every ~8 ms so the swing animation does not hitch.
   * opts.sync === true decodes in one block; opts.sliceMs overrides the budget. */
  function decode(buffer, opts) {
    opts = opts || {};
    return new global.Promise(function (resolve, reject) {
      var THREE = global.THREE;
      if (!THREE || !THREE.BufferGeometry) { reject(fail('three.js global (THREE) is not loaded')); return; }
      var h, out;
      try { h = readHeader(buffer); out = newResult(h.header); }
      catch (e) { reject(e); return; }
      if (opts.sync) {
        try { for (var k = 0; k < h.header.parts.length; k++) decodePart(THREE, h.header.parts[k], h.cur, h.header.quant, out); resolve(out); }
        catch (e2) { reject(e2); }
        return;
      }
      var budget = opts.sliceMs > 0 ? opts.sliceMs : SLICE_MS;
      var i = 0;
      function step() {
        var t = now();
        try {
          while (i < h.header.parts.length) {
            decodePart(THREE, h.header.parts[i], h.cur, h.header.quant, out);
            i++;
            if (now() - t > budget) break;
          }
        } catch (e3) { reject(e3); return; }
        if (i < h.header.parts.length) schedule(step);
        else resolve(out);
      }
      schedule(step);
    });
  }

  /* ---------------------------------------------------------------- fetch */

  function fetchBuffer(url, opts) {
    return new global.Promise(function (resolve, reject) {
      var timeoutMs = opts.timeoutMs > 0 ? opts.timeoutMs : 8000;

      if (global.fetch && global.AbortController) {
        var ac = new global.AbortController();
        var timer = global.setTimeout(function () { ac.abort(); }, timeoutMs);
        global.fetch(url, { signal: ac.signal, credentials: 'same-origin' }).then(function (res) {
          if (!res.ok) throw fail('fetch ' + url + ' returned HTTP ' + res.status);
          return res.arrayBuffer();
        }).then(function (buf) {
          global.clearTimeout(timer);
          resolve(buf);
        }, function (err) {
          global.clearTimeout(timer);
          reject(err && err.anatomy ? err : fail('fetch ' + url + ' failed (' + (err && err.message ? err.message : err) + ')'));
        });
        return;
      }

      if (!global.XMLHttpRequest) { reject(fail('no fetch and no XMLHttpRequest in this environment')); return; }
      var xhr = new global.XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.timeout = timeoutMs;
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response) resolve(xhr.response);
        else reject(fail('fetch ' + url + ' returned HTTP ' + xhr.status));
      };
      xhr.onerror = function () { reject(fail('fetch ' + url + ' failed')); };
      xhr.ontimeout = function () { reject(fail('fetch ' + url + ' timed out after ' + timeoutMs + ' ms')); };
      xhr.send();
    });
  }

  /*
   * load(url, opts) -> Promise<{ parts, order, rig, header, counts, licence, quant }>
   *
   *   parts   { partKey: THREE.BufferGeometry } — positions already in the target bone's local
   *           frame, so the geometry can be dropped straight onto the existing bone with an
   *           identity child transform. userData carries { key, name, bone, group, stage }.
   *   rig     { scale, bones: [{label, region, baseXDeg, accXDeg, offset}], shoulderAnchor, ... }
   *
   * opts: { timeoutMs = 8000, sync = false, sliceMs = 8 }
   *
   * Rejects — never throws — on: no THREE, network error, non-2xx, timeout, bad magic, wrong
   * container version, malformed header, truncated or corrupt streams.
   */
  /* Cloudflare Pages does not compress application/octet-stream, so a plain .bin ships at its full
     172 KB. Rather than depend on host config, the asset is stored gzipped and inflated here:
     108 KB over the wire, and a smaller iOS bundle too. DecompressionStream is Safari 16.4+, well
     under this app's floor; without it we fall back to the uncompressed sibling if one is served,
     and failing that the caller keeps the procedural skeleton. */
  function inflate(buf) {
    var head = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
    if (!(head[0] === 0x1f && head[1] === 0x8b)) return global.Promise.resolve(buf); // already plain
    if (typeof global.DecompressionStream !== 'function' || typeof global.Response !== 'function') {
      return global.Promise.reject(fail('asset is gzipped but DecompressionStream is unavailable'));
    }
    var stream = new global.Response(buf).body.pipeThrough(new global.DecompressionStream('gzip'));
    return new global.Response(stream).arrayBuffer();
  }

  function load(url, opts) {
    opts = opts || {};
    if (!global.Promise) { throw fail('Promise is not available in this environment'); }
    if (!url) return global.Promise.reject(fail('load() needs a url'));
    return fetchBuffer(url, opts)
      .then(inflate)
      .then(function (buf) { return decode(buf, opts); });
  }

  global.Anatomy = {
    VERSION: CONTAINER_VERSION,
    load: load,
    decode: decode,
    decodeSync: decodeSync,
    readHeader: function (buffer) { return readHeader(buffer).header; },
  };
})(typeof window !== 'undefined' ? window : this);

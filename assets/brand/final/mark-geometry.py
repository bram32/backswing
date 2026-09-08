#!/usr/bin/env python3
"""Uncoil brand mark - the single geometric source for every icon and mark file.

The mark is one continuous stroke: a true Archimedean spiral (r = a + b.theta,
so the pitch between turns is constant) that leaves its outer end tangentially
into a straight shaft. Uniform width, round caps, no joins to break.

Run it to regenerate icon-master-1024.svg, mark.svg and mark-tile.svg:

    python3 mark-geometry.py

Then rasterise the master once and derive the rest (see README.md):

    chrome --headless=new --window-size=8192,8192 --screenshot=raw.png <master at 8x>
    magick raw.png -filter Box -resize 1024x1024 -alpha off icon-1024.png
    sips -z 512 512 icon-1024.png --out icon-512.png            # 192 / 180 likewise
"""
import math, os

TAU   = math.pi * 2
GREEN = '#0e261b'          # fairway
GOLD  = '#f6c544'          # pin flag

# ---- locked design parameters ------------------------------------------------
TURNS      = 1.20          # full turns of spiral before the release
GAP_RATIO  = 1.00          # green gap between turns, in stroke widths (>= 1 keeps 29 px open)
ALPHA_DEG  = 60.0          # shaft angle above the horizontal
R_START    = 0.50          # inner terminus radius, in stroke widths (cap lands on the centre)
OPTICAL_K  = 0.20          # bbox centre nudged this far toward the ink centroid
ICON_STROKE = 0.090        # stroke as a fraction of the icon tile      -> 92.16 px at 1024
ICON_SPAN   = 0.715        # mark's longest dimension as a fraction     -> 732.2 px at 1024
STROKE_OF_SPAN = ICON_STROKE / ICON_SPAN     # keeps the shape identical at any size

# ---- spiral ------------------------------------------------------------------
# Screen coordinates (y grows downward). P(t) = C + r(t) * (cos t, -sin t), so
# increasing t runs counter-clockwise on screen and the release points up-right.
def geom(turns=TURNS, gap=GAP_RATIO, alpha_deg=ALPHA_DEG, r_start=R_START):
    b     = (1.0 + gap) / TAU                 # radial growth per radian (stroke widths)
    r_end = r_start + TAU * turns * b
    alpha = math.radians(alpha_deg)
    # tangent of the spiral is parallel to the shaft exactly when
    #   b.sin(t - alpha) + r.cos(t - alpha) = 0  ->  t = alpha - atan2(r_end, b)
    t_end   = alpha - math.atan2(r_end, b)
    t_start = t_end - TAU * turns
    return dict(b=b, a=r_start - b * t_start, r_start=r_start, r_end=r_end,
                t_start=t_start, t_end=t_end, alpha=alpha)

def P(g, t):
    r = g['a'] + g['b'] * t
    return (r * math.cos(t), -r * math.sin(t))

def dP(g, t):
    r, b = g['a'] + g['b'] * t, g['b']
    return (b * math.cos(t) - r * math.sin(t), -b * math.sin(t) - r * math.cos(t))

def centreline(g, L, steps=900):
    pts = [P(g, g['t_start'] + (g['t_end'] - g['t_start']) * i / steps) for i in range(steps + 1)]
    ex, ey = P(g, g['t_end'])
    ux, uy = math.cos(g['alpha']), -math.sin(g['alpha'])
    pts += [(ex + ux * L * i / 200, ey + uy * L * i / 200) for i in range(1, 201)]
    return pts

def bbox(pts, half=0.5):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return (min(xs) - half, min(ys) - half, max(xs) + half, max(ys) + half)

def centroid(pts):
    sx = sy = sl = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        l = math.hypot(x1 - x0, y1 - y0)
        sx += (x0 + x1) / 2 * l; sy += (y0 + y1) / 2 * l; sl += l
    return sx / sl, sy / sl, sl

def solve_shaft(g, span_u, lo=0.0, hi=40.0):
    """Shaft length that makes the mark's longest dimension exactly span_u stroke widths."""
    span = lambda L: max(bbox(centreline(g, L, 300))[2] - bbox(centreline(g, L, 300))[0],
                         bbox(centreline(g, L, 300))[3] - bbox(centreline(g, L, 300))[1])
    for _ in range(80):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if span(mid) < span_u else (lo, mid)
    return (lo + hi) / 2

# ---- path --------------------------------------------------------------------
def build(canvas, span_frac, prec, seg_deg=22.0):
    """Cubic-Bezier approximation of the spiral (exact position and tangent at every
    segment end, <=22 degrees per segment) plus one straight line for the shaft."""
    w = canvas * span_frac * STROKE_OF_SPAN
    g = geom()
    L = solve_shaft(g, (canvas * span_frac) / w)
    pts  = centreline(g, L)
    bb   = bbox(pts)
    cxb, cyb = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
    gx, gy, arclen = centroid(pts)
    ox = canvas / 2 + (-cxb + OPTICAL_K * (cxb - gx)) * w
    oy = canvas / 2 + (-cyb + OPTICAL_K * (cyb - gy)) * w
    m  = lambda p: (p[0] * w + ox, p[1] * w + oy)
    f  = lambda v: ('%.' + str(prec) + 'f') % v

    sweep = g['t_end'] - g['t_start']
    n     = max(1, int(math.ceil(abs(sweep) / math.radians(seg_deg))))
    h     = sweep / n
    p0    = m(P(g, g['t_start']))
    d     = ['M %s %s' % (f(p0[0]), f(p0[1]))]
    for i in range(n):
        t0, t1 = g['t_start'] + h * i, g['t_start'] + h * (i + 1)
        a0, a1, d0, d1 = P(g, t0), P(g, t1), dP(g, t0), dP(g, t1)
        c1 = m((a0[0] + h / 3 * d0[0], a0[1] + h / 3 * d0[1]))
        c2 = m((a1[0] - h / 3 * d1[0], a1[1] - h / 3 * d1[1]))
        e  = m(a1)
        d.append('C %s %s %s %s %s %s' % (f(c1[0]), f(c1[1]), f(c2[0]), f(c2[1]), f(e[0]), f(e[1])))
    ex, ey = P(g, g['t_end'])
    tip = m((ex + math.cos(g['alpha']) * L, ey - math.sin(g['alpha']) * L))
    d.append('L %s %s' % (f(tip[0]), f(tip[1])))
    ink = arclen * w * w + math.pi * (w / 2) ** 2
    return dict(d=' '.join(d), w=w, g=g, L=L * w, tip=tip,
                bbox=(bb[2] - bb[0]) * w, bboxh=(bb[3] - bb[1]) * w,
                edges=[bb[0] * w + ox, bb[1] * w + oy, bb[2] * w + ox, bb[3] * w + oy],
                coil=(2 * g['r_end'] + 1) * w, gap=(TAU * g['b'] - 1) * w,
                pitch=TAU * g['b'] * w, ink=ink / (canvas * canvas))

def stroke(r, colour, prec):
    return ('<path d="%s" fill="none" stroke="%s" stroke-width="%s" '
            'stroke-linecap="round" stroke-linejoin="round"/>'
            % (r['d'], colour, ('%.' + str(prec) + 'f') % r['w']))

def main(outdir=None):
    out = outdir or os.path.dirname(os.path.abspath(__file__))
    icon, mark, tile = build(1024.0, ICON_SPAN, 2), build(32.0, 30.0 / 32.0, 3), build(32.0, ICON_SPAN, 3)

    open(os.path.join(out, 'icon-master-1024.svg'), 'w').write(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">'
        '<title>Uncoil app icon</title><rect width="1024" height="1024" fill="%s"/>%s</svg>\n'
        % (GREEN, stroke(icon, GOLD, 2)))

    open(os.path.join(out, 'mark.svg'), 'w').write(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" '
        'fill="none" role="img" aria-label="Uncoil"><title>Uncoil</title>%s</svg>\n'
        % stroke(mark, 'currentColor', 3))

    R = 32 * 0.2237
    open(os.path.join(out, 'mark-tile.svg'), 'w').write(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" '
        'role="img" aria-label="Uncoil"><title>Uncoil</title>'
        '<rect width="32" height="32" rx="%.3f" ry="%.3f" fill="%s"/>%s</svg>\n'
        % (R, R, GREEN, stroke(tile, GOLD, 3)))

    g = icon['g']
    tx, ty = dP(g, g['t_end'])
    print('icon 1024: stroke %.2f px (%.1f%%)  coil d %.1f  gap %.1f = %.2f strokes  pitch %.1f'
          % (icon['w'], 100 * icon['w'] / 1024, icon['coil'], icon['gap'], icon['gap'] / icon['w'], icon['pitch']))
    print('           shaft %.1f px at %.0f deg   mark %.0f x %.0f px (%.1f%% of the tile)  gold %.1f%%'
          % (icon['L'], ALPHA_DEG, icon['bbox'], icon['bboxh'], 100 * icon['bbox'] / 1024, 100 * icon['ink']))
    print('           margins L%.0f R%.0f T%.0f B%.0f   tip (%.0f, %.0f)'
          % (icon['edges'][0], 1024 - icon['edges'][2], icon['edges'][1], 1024 - icon['edges'][3], icon['tip'][0], icon['tip'][1]))
    print('           exit tangent %.10f deg vs shaft %.1f deg' % (math.degrees(math.atan2(-ty, tx)), ALPHA_DEG))
    print('mark.svg stroke %.3f / 32   mark-tile.svg stroke %.3f / 32' % (mark['w'], tile['w']))

if __name__ == '__main__':
    main()

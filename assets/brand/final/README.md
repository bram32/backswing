# Uncoil — app icon and brand mark

**Name:** Uncoil (6 characters, `.com` / `.app` / `.golf` all plausible)
**Tagline:** Turn freely. Play longer.
**App Store name:** `Uncoil: Golf Mobility` (21 / 30)
**App Store subtitle:** `Golf mobility and swing tempo` (29 / 30)

Golf-native and rotation-native, with no medical purpose in it: *uncoil* is what a
golfer does from the top of the backswing. It says turn, release and tempo. It says
nothing about pain, relief, therapy, rehab, injury or the spine, so it does not read
as a medical device claim to an EU/UK regulator, and it is not the name of a golf or
fitness app on the App Store. It also fixes the problem with "Free Relief": that name
promised relief (a health claim) and buried the fact this is a golf app.

## The mark

One unbroken gold stroke winds in to a centre and releases up and to the right at 60°.
Two readings, both correct: a coiled spring letting go, and a club at address whose
head is the coil and whose shaft is the release. It is a single continuous path — no
joins, no counters, nothing that can break at 29 px.

The geometry is a **true Archimedean spiral** (`r = a + b·θ`, so the pitch between
turns is constant) that leaves its outer end **tangentially** into the straight shaft,
with a uniform stroke width and round caps. All of it comes from `mark-geometry.py`;
`icon-master-1024.svg` is the single source every raster is made from.

| | |
|---|---|
| Stroke | 92.16 px = 9.0% of the tile, uniform · 5.4 px at 60 px, 2.6 px at 29 px |
| Coil | 1.20 turns, radius 46.1 → 267.3 px, pitch 184.3 px, outer diameter 626.7 px |
| Green gap between turns | 92.2 px = **1.00 stroke width** (2.6 px at 29 px) |
| Release | spiral tangent at the exit is 60.0000000000° against a 60° shaft (error 7×10⁻¹⁵°) |
| Shaft | 411.7 px beyond the release, round cap centred at (842, 264) |
| Composition | mark 732 × 576 px = **71.5%** of the canvas · margins L156 R136 T218 B230 |
| Gold coverage | **14.9%** (the candidate raster was 12.6%) |
| Contrast | #F6C544 on #0E261B = 9.9 : 1 — holds on light and dark Home Screens |

### What changed against `candidates/uncoil-mark-3.png`

1. **Rebuilt as vector.** The candidate was an AI raster snapped to two colours: the
   stroke wobbled between 51 and 57 px, the turn spacing drifted and the caps were not
   semicircles. Everything now derives from one parametric source. Uniform width is
   checkable: the shaft's horizontal cut is 106–107 px at every height, exactly
   92.16 / sin 60°.
2. **Coil simplified**, ~2 turns → **1.20**, and the gap is a full stroke width instead
   of ~65 px. `method-and-prompts.txt` sets out why 1.5 turns is not reachable together
   with a full-width gap, a 9% stroke and a ≤72% mark: at 1.5 turns the coil alone is
   72% of the canvas and there is no shaft left. 1.20 keeps a wrap, a centre and a
   release, and the centre no longer fuses at Settings/Spotlight size.
3. **Stroke thickened** 52 px → 92.16 px (5% → 9% of the canvas; 3 px → 5.4 px at 60 px).
   Gold coverage 12.6% → 14.9%, so it no longer sits light beside bolder neighbours.
4. **Recomposed.** 813 × 805 px (79%) → 732 × 576 px (71.5%). Margins are 156/136/218/230
   instead of ~106, and the top cap is now at (842, 264), well clear of the iOS corner
   curve (superellipse load 0.31 where 1.0 is the edge). The bounding box is centred and
   then nudged 20% of the way toward the ink centroid, so the coil's mass reads centred
   rather than bottom-left; the shaft was steepened to 60°, the top of the brief's range.
5. **Golf pennant: tested, not shipped.** A solid pennant at the tip does read at 60 px,
   but it turns the silhouette into a French horn — the trap `fullturn-mark-3` fell into
   — and its straight edges fight the single-stroke logic. The palette already says golf.
   The "sole line" alternative was rejected because flattening the outer curve destroys
   the constant pitch that this rebuild exists to establish.
6. **Contrast** unchanged at 9.9 : 1.
7. **60 px and 29 px checks are in the pipeline.** `check-small-sizes.png` renders both
   sizes as real Lanczos downsamples of the master, side by side with the old candidate,
   and lists the measured numbers. Regenerate it whenever the mark is touched — never
   judge from the 1024 or 180 px view.

## Files

| File | What it is |
|---|---|
| `icon-master-1024.svg` | **The source.** Green tile + one gold path, 1024 viewBox. |
| `mark-geometry.py` | Generates the three SVGs from the locked parameters. `python3 mark-geometry.py` rewrites them byte-identically. |
| `icon-1024.png` | 1024×1024 PNG24, RGB, **no alpha**, corners exactly `#0E261B`. App Store / `ios/FreeRelief/Assets.xcassets/AppIcon.appiconset/icon-1024.png`. |
| `icon-512.png` | 512×512, for `manifest.webmanifest` (`purpose: any`). |
| `icon-192.png` | 192×192, for `manifest.webmanifest`. |
| `icon-maskable-512.png` | 512×512, art at 80% with `#0E261B` padding, for `purpose: maskable`. |
| `apple-touch-icon-180.png` | 180×180, for `<link rel="apple-touch-icon">`. |
| `mark.svg` | 32×32 viewBox, gold-on-transparent glyph, `stroke="currentColor"` so it takes the theme colour. Fills 30 of 32 units; reads at 30 px. |
| `mark-tile.svg` | 32×32 viewBox, rounded green tile + gold mark at the icon's proportions. Drop-in for `.brand-mark` in the sidebar. |
| `check-60.png`, `check-29.png` | True 60 px and 29 px renders of the master (Lanczos). |
| `check-small-sizes.png` | The small-size check sheet, new against old, with measurements. |
| `preview.html`, `preview.png` | The spec sheet: icon sizes on the iOS mask, both lock-ups, Home Screen mock, geometry. |
| `method-and-prompts.txt` | Method, the maths, every option tested and rejected, and the exact raster commands. Records that **no generative image prompt was used** for the final artwork, and why. |

Rasterising, if the geometry is ever changed: run `mark-geometry.py`, render
`icon-master-1024.svg` at 8192 in headless Chrome, box-filter to 1024 with ImageMagick,
then derive 512 / 192 / 180 / maskable with `sips`. Full commands are in
`method-and-prompts.txt`. Everything must come from that one render.

## Renaming the app to Uncoil — every place it touches

Nothing outside `assets/brand/final/` has been changed. Apply the list below in one
pass. `Free Relief` → `Uncoil` unless a cell says otherwise.

### Web app

| File | Where |
|---|---|
| `index.html` | line 6 `<title>`; line 13 `apple-mobile-web-app-title`; lines 15 & 21 `og:title` / `twitter:title` (`Free Relief — Golf back care` → `Uncoil — Golf mobility`); lines 16 & 22 `og:description` / `twitter:description`; line 24 the inline data-URI favicon — replace with the path from `mark-tile.svg`; line 38 `<span class="brand-name">`; the inline `<svg class="brand-mark">` on line 37 — replace with `mark-tile.svg`'s contents; line 157 the disclaimer sentence. |
| `manifest.webmanifest` | `name`, `short_name`, `description` (drop "back care" wording), and the three `icons[].src` paths if the files move. |
| `sw.js` | line 1 header comment; line 2 `const VERSION = 'freerelief-v3'` → `'uncoil-v4'` — **bump it**, or returning users keep the old shell and old icons. |
| `js/app.js` | line 1 header comment; line 5 `const STORE_KEY = 'freerelief.v1'`; line 30 `LEGACY_STORE_KEYS = ['backswing.v1']` → add `'freerelief.v1'` so existing users keep their plan, log and streak; prose on lines 497 and 516. The `window.FreeRelief` native-bridge global (lines 190, 197, 269, 274) is **not** a display string — rename it only in lockstep with the Swift side, or leave it. |
| `js/growth.js` | line 1 comment; line 300 `x.fillText('FREE RELIEF', …)` on the share card; `foot:` strings on lines 351, 361, 369, 376; the four `file: 'free-relief-*.png'` share filenames; `navigator.share` title on line 400; native share title on line 409; onboarding copy on lines 481 and 583; disclaimer on line 853. `window.FreeRelief` on lines 408–409 is the bridge global — see above. |
| `js/screen.js` | line 1 header comment. |
| `privacy.html` | lines 6, 7, 85, 92, 96, 127, 133, 148, 149. |
| `terms.html` | lines 6, 7, 94, 101, 105, 107, 108, 110, 111, 131, 134, 137, 143, 146, 153, 156, 170, 171. |
| `ATTRIBUTION.md` | lines 3, 21, 34, 38, 44. |
| `README.md` (repo root) | line 1 heading and body prose. Line 49's `--project-name backswing` is the Cloudflare Pages project, not a display name — renaming it changes the deploy URL, so decide separately. |
| `build.js` | line 80 rewrites `privacy`/`terms` links to `https://backswing-dkg.pages.dev/…`. Only if the Pages project is renamed too. |
| `assets/` | copy `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` and `apple-touch-icon-180.png` from this folder over the existing ones, and `icon-1024.png` over `assets/app-icon-1024.png`. `assets/social-1200x630.png` (referenced by `index.html` lines 17 and 23) has to be re-cut with the new mark and name. The stale `app-icon-alt-green.png`, `app-icon-alt-spine.png` and `app-icon-vector.png` can go. |

### iOS

| File | Where |
|---|---|
| `ios/project.yml` | line 1 `name: FreeRelief`; lines 33–34 `CFBundleDisplayName` / `CFBundleName`; line 69 `PRODUCT_NAME`. Line 68 `PRODUCT_BUNDLE_IDENTIFIER: com.brampek.backswing` and line 59 `CFBundleURLName` are the **legacy bundle id — do not change them**, the App Store Connect record hangs off it. The `freerelief://` scheme on line 53/61 is internal; change it only with the WKWebView loader. |
| `ios/FreeRelief/Info.plist` | line 8 `CFBundleDisplayName`, line 16 `CFBundleName`. |
| `ios/FreeRelief/Assets.xcassets/AppIcon.appiconset/icon-1024.png` | replace with `icon-1024.png` from this folder. |
| `ios/fastlane/asc_app_name.rb` | line 5 `NEW_NAME = ENV['ASC_APP_NAME'] \|\| 'Free Relief'` — this is the script that performs the App Store Connect rename; set it to `Uncoil: Golf Mobility`. |
| `ios/fastlane/asc_metadata.rb` | line 25 `SUBTITLE`; line 45 `KEYWORDS` (drop `back`/`spine` weight toward `mobility,rotation,tempo,warmup`); line 27 `DESCRIPTION`; line 47 `PROMOTIONAL`; the review notes. Every field is length-checked on lines 153–157, so re-run it after editing. |
| `ios/fastlane/asc_rename_groups.rb` | line 5 `NEW_NAME`; line 24 `RENAMES` — add `'Free Relief internal' => 'Uncoil internal'`, `'Free Relief testers' => 'Uncoil testers'`. |
| `ios/fastlane/asc_listing_state.rb` | line 6 `NEW_NAME`. |
| `ios/fastlane/Fastfile` | line 1 comment; lines 19–20 `PROJECT` / `SCHEME` (only if the Xcode target is renamed — that also moves `ios/FreeRelief/` and `ios/sync-web.sh`'s paths); line 24–25 `INTERNAL_GROUP` / `EXTERNAL_GROUP`; line 28 the signing temp dir; line 52 `name:`; line 71 the name guidance comment. |
| `ios/sync-web.sh` | `ios/FreeRelief/web` paths, only if the target folder is renamed. |
| `ios/README.md` | prose. |

### Store copy

| File | Where |
|---|---|
| `docs/app-store-listing.md` | line 1 heading; line 13 app name → `Uncoil: Golf Mobility` (21/30); line 23 fallback; line 33 subtitle → `Golf mobility and swing tempo` (29/30); lines 133, 162, 233 body copy; line 320 nomination name; line 346's note about the URL still saying "backswing". Re-check every character count — the file records them. |
| `docs/app-review-checklist.md` | any name mentions. |

Not a rename, but do it in the same pass: `docs/screenshots/` and `docs/simulator/`
still show the old name in the UI chrome, and the App Store screenshots have to be
regenerated after the rename anyway.

# Free Relief

Golf back care in the browser. A 3D swing lab, a symptom-to-exercise planner, guided warm-up and cool-down routines, an exercise library, an injury prevention guide, and a round-by-round pain log.

No build step is needed to run it. Open `index.html` or serve the folder:

```
python3 -m http.server 8765
# then open http://localhost:8765
```

## What is in it

- **Swing lab** (`js/lab3d.js`). A procedurally built golfer in three.js r147: 24 articulated vertebrae with discs, ribcage, pelvis, shoulder girdle and skull inside a holographic body, with IK-driven arms, legs and club. The swing is keyframed; trunk rotation is distributed across hips, thoracic spine, lumbar spine and shoulder girdle according to how compliant each is. Toggling stiff hips, a stiff mid back or a reverse spine angle pushes rotation into the lumbar spine, which lights up as it goes past its roughly 13 degrees of capacity. Click any body part to start a plan for it.
- **Fix it**. Pick a spot, when it hurts and what it feels like. You get a Play on / Take a drop / Pick up verdict, what is probably going on, a timed set of exercises to start now, a daily routine, the swing faults that usually cause it, what to avoid, and when to see someone.
- **Routines**. Seven guided routines with a timer: first-tee warm-up, post-round cool-down, daily back care, mid-back unlock, elbow rehab, strength basics, and a 90-second between-holes reset.
- **Exercises**. 45 exercises with line-drawn figures, steps, cues, mistakes and the golf reason for each.
- **Prevent**. The seven common golf injuries, ten swing faults with body causes and fixes, and round-day habits.
- **Log**. Pain after each round, warm-up yes or no, how you got around. A chart shows whether warming up is paying off.

Everything is saved in the browser with `localStorage`. Nothing leaves your device.

## Files

```
index.html        shell and 3D lab markup
css/styles.css    design tokens (dark and light), layout, components
js/data.js        exercises, routines, planner content, faults, injuries, habits
js/figures.js     2D pose drawings for the exercise cards
js/lab3d.js       the three.js swing lab
js/app.js         router, views, planner, player, log
build.js          bundles everything into dist/index.html (single file)
```

Run `node build.js` to produce `dist/index.html`, a single self-contained file (fonts and three.js still load from their CDNs).

## Deploying

The site is static. Any static host works. For Cloudflare Pages with direct upload:

```
node build.js && npx wrangler pages deploy dist/site --project-name backswing
```

There is also a GitHub Actions workflow in `.github/workflows/deploy.yml` that deploys on every push to `main`. It needs two repository secrets: `CLOUDFLARE_API_TOKEN` (a token with the Cloudflare Pages edit permission) and `CLOUDFLARE_ACCOUNT_ID`.

## A note on the content

The exercises and guidance are general, physio-informed advice for recreational golfers. They are not a diagnosis. The app is explicit about red-flag symptoms that need a doctor or physiotherapist, and it says so on every plan.

/* Build: produce dist/index.html (single-file app) and dist/artifact.html (body fragment for hosted previews). */
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');
const css = read('css/styles.css');
const JS_FILES = ['js/data.js', 'js/figures.js', 'js/anatomy.js', 'js/lab3d.js', 'js/app.js'];
const js = JS_FILES.map(read).join('\n;\n');
html = html.replace('<link rel="stylesheet" href="css/styles.css">', `<style>\n${css}\n</style>`);
const scriptTags = new RegExp(JS_FILES.map((f) => `<script src="${f.replace(/[./]/g, (c) => '\\' + c)}"><\\/script>`).join('\\s*'));
if (!scriptTags.test(html)) throw new Error('build: the <script> block in index.html does not match ' + JS_FILES.join(', '));
html = html.replace(scriptTags, `<script>\n${js}\n</script>`);
if (/<script src="js\//.test(html)) throw new Error('build: a js/ <script> tag survived inlining');
// Licence gate, BEFORE anything is written. The BodyParts3D geometry is CC BY 4.0, so the rendered
// credit is a condition of shipping, not a nicety. Checking the markup (not just the phrase) matters:
// 'The Database Center for Life Science' also appears in the inlined js/anatomy.js banner, so a
// phrase check passed even with the visible credit deleted.
const CREDIT_MARK = 'class="credit"';
const CREDIT_TEXT = 'Anatomy adapted from BodyParts3D';
if (!html.includes(CREDIT_MARK) || !html.includes(CREDIT_TEXT)) {
  throw new Error(`build: index.html is missing the rendered BodyParts3D attribution (${CREDIT_MARK} + "${CREDIT_TEXT}") - refusing to write dist/`);
}

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);
// fragment: strip document wrapper, keep title/style/links/body content/scripts
let frag = html.replace(/^[\s\S]*?<head>/, '').replace(/<\/head>\s*<body>/, '').replace(/<\/body>\s*<\/html>\s*$/, '');
frag = frag.replace(/<meta [^>]*>\s*/g, '').replace(/<!doctype html>/i, '');
fs.writeFileSync(path.join(root, 'dist/artifact.html'), frag.trim() + '\n');
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
console.log('dist/artifact.html', (frag.length / 1024).toFixed(0) + ' KB');
// dist/site: the deployable static site (index + css + js), nothing else
const site = path.join(root, 'dist/site');
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(site, 'css'), { recursive: true });
fs.mkdirSync(path.join(site, 'js'), { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(site, 'index.html'));
fs.copyFileSync(path.join(root, 'css/styles.css'), path.join(site, 'css/styles.css'));
for (const f of JS_FILES) fs.copyFileSync(path.join(root, f), path.join(site, f));
// assets: png files only (app icons, Open Graph image)
const assetsSrc = path.join(root, 'assets');
if (fs.existsSync(assetsSrc)) {
  const pngs = fs.readdirSync(assetsSrc).filter((f) => f.toLowerCase().endsWith('.png'));
  if (pngs.length) {
    fs.mkdirSync(path.join(site, 'assets'), { recursive: true });
    for (const f of pngs) fs.copyFileSync(path.join(assetsSrc, f), path.join(site, 'assets', f));
  }
  console.log('dist/site/assets', pngs.length, 'png');
  // anatomy: the spine geometry ships as a separate binary, fetched lazily after first paint.
  // Deliberately NOT inlined into dist/index.html - base64 would add 33% and put ~100 KB on the
  // critical path. Only spine.bin is staged: the app fetches that one URL, and the host negotiates
  // content-encoding itself, so shipping .gz/.br siblings just put ~203 KB of unreachable bytes
  // into dist/site - and from there into the iOS bundle via sync-web.sh.
  const anatomySrc = path.join(assetsSrc, 'anatomy');
  if (fs.existsSync(anatomySrc)) {
    // spine.json is build metadata (per-part decimation stats); the runtime header lives inside spine.bin
    const files = fs.readdirSync(anatomySrc).filter((f) => /\.(bin|txt)$/.test(f));
    if (files.length) {
      fs.mkdirSync(path.join(site, 'assets/anatomy'), { recursive: true });
      let bytes = 0;
      for (const f of files) {
        fs.copyFileSync(path.join(anatomySrc, f), path.join(site, 'assets/anatomy', f));
        if (f === 'spine.bin') bytes = fs.statSync(path.join(anatomySrc, f)).size;
      }
      console.log('dist/site/assets/anatomy', files.length, 'files, spine.bin', (bytes / 1024).toFixed(0) + ' KB');
    }
  }
}
// The single-file build sits in dist/ and fetches 'assets/anatomy/spine.bin' relative to itself.
// Stage the binary beside it as well, so dist/index.html shows the real spine instead of 404ing on
// a loader it already carries. dist/artifact.html cannot have siblings and falls back by design.
{
  const anatomySrc = path.join(root, 'assets', 'anatomy');
  if (fs.existsSync(anatomySrc)) {
    const files = fs.readdirSync(anatomySrc).filter((f) => /\.(bin|txt)$/.test(f));
    if (files.length) {
      fs.mkdirSync(path.join(root, 'dist/assets/anatomy'), { recursive: true });
      for (const f of files) fs.copyFileSync(path.join(anatomySrc, f), path.join(root, 'dist/assets/anatomy', f));
      console.log('dist/assets/anatomy', files.length, 'files (for the single-file build)');
    }
  }
}
console.log('dist/site staged');
// PWA: manifest + service worker (icon PNGs are already covered by the assets copy above)
for (const f of ['manifest.webmanifest', 'sw.js']) {
  if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(site, f));
}
const pwaIcons = ['assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon-180.png'];
const missingIcons = pwaIcons.filter((f) => !fs.existsSync(path.join(site, f)));
if (missingIcons.length) console.warn('dist/site missing PWA icons:', missingIcons.join(', '));
console.log('dist/site pwa: manifest.webmanifest, sw.js,', pwaIcons.length - missingIcons.length, 'icons');
// Attribution: the BodyParts3D geometry is CC BY 4.0, so the credit is a licence condition, not a
// nicety. It has to survive into the shipped artifacts as rendered text - a source comment would
// vanish the day a minifier is added - so the build fails loudly if it ever goes missing.
if (fs.existsSync(path.join(root, 'ATTRIBUTION.md'))) fs.copyFileSync(path.join(root, 'ATTRIBUTION.md'), path.join(site, 'ATTRIBUTION.md'));
// Belt and braces: confirm the credit survived into every artifact that actually landed.
for (const f of ['dist/index.html', 'dist/artifact.html', 'dist/site/index.html']) {
  if (!fs.existsSync(path.join(root, f))) continue;
  const html = read(f);
  if (!html.includes(CREDIT_MARK) || !html.includes(CREDIT_TEXT)) {
    throw new Error(`build: ${f} is missing the rendered BodyParts3D attribution (${CREDIT_MARK} + "${CREDIT_TEXT}")`);
  }
}
console.log('attribution: BodyParts3D CC BY 4.0 credit rendered in index.html, artifact.html and site/index.html');

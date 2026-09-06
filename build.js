/* Build: produce dist/index.html (single-file app) and dist/artifact.html (body fragment for hosted previews). */
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');
const CSS_FILES = ['css/styles.css', 'css/screen.css', 'css/programs.css', 'css/growth.css'];
const css = CSS_FILES.map(read).join('\n');
const JS_FILES = ['js/data.js', 'js/figures.js', 'js/anatomy.js', 'js/lab3d.js', 'js/app.js', 'js/screen.js', 'js/programs.js', 'js/growth.js'];
const js = JS_FILES.map(read).join('\n;\n');
// three.js r147 is vendored under js/vendor/three so the app runs with no network at all: the iOS
// bundle and the offline PWA both need it, and App Review must never hang on a CDN. The paths under
// js/vendor/three mirror the package layout exactly, so a single prefix swap turns them back into
// jsDelivr URLs for dist/artifact.html, whose host CSP allows the CDN but has no siblings to serve.
const VENDOR_DIR = 'js/vendor';
const VENDOR_CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
const VENDOR_LOCAL = 'js/vendor/three/';
const VENDOR_FILES = [
  'build/three.min.js',
  'examples/js/controls/OrbitControls.js',
  'examples/js/shaders/CopyShader.js',
  'examples/js/shaders/LuminosityHighPassShader.js',
  'examples/js/shaders/GammaCorrectionShader.js',
  'examples/js/postprocessing/EffectComposer.js',
  'examples/js/postprocessing/RenderPass.js',
  'examples/js/postprocessing/ShaderPass.js',
  'examples/js/postprocessing/UnrealBloomPass.js',
  'examples/js/environments/RoomEnvironment.js',
].map((f) => VENDOR_LOCAL + f);
{
  const missing = VENDOR_FILES.filter((f) => !fs.existsSync(path.join(root, f)));
  if (missing.length) throw new Error('build: vendored three.js is missing: ' + missing.join(', ') + '\n  re-download with: curl -sSfL ' + VENDOR_CDN + '<path> -o js/vendor/three/<path>');
  const referenced = VENDOR_FILES.filter((f) => !html.includes(`<script src="${f}"></script>`));
  if (referenced.length) throw new Error('build: index.html no longer loads the vendored three.js files: ' + referenced.join(', '));
}
// Fonts are vendored for the same reason and swapped back the same way: a hosted fragment cannot
// serve sibling .woff2 files, but its CSP does allow fonts.googleapis.com.
const FONTS_LOCAL = '<link rel="stylesheet" href="js/vendor/fonts/fonts.css">';
const FONTS_CDN = '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Atkinson+Hyperlegible:wght@400;700&display=swap">';
if (!html.includes(FONTS_LOCAL)) throw new Error('build: index.html no longer links the vendored fonts (' + FONTS_LOCAL + ')');
if (!fs.existsSync(path.join(root, 'js/vendor/fonts/fonts.css'))) throw new Error('build: js/vendor/fonts/fonts.css is missing');
// Static pages that ship beside the app (linked from the disclaimer, and required by App Review).
const PAGES = ['privacy.html', 'terms.html'];
html = html.replace('<link rel="stylesheet" href="css/styles.css">', `<style>\n${css}\n</style>`);
for (const f of CSS_FILES.slice(1)) html = html.replace(`<link rel="stylesheet" href="${f}">\n`, '');
const scriptTags = new RegExp(JS_FILES.map((f) => `<script src="${f.replace(/[./]/g, (c) => '\\' + c)}"><\\/script>`).join('\\s*'));
if (!scriptTags.test(html)) throw new Error('build: the <script> block in index.html does not match ' + JS_FILES.join(', '));
html = html.replace(scriptTags, `<script>\n${js}\n</script>`);
// js/vendor is exempt: three.js stays an external <script> in every artifact (inlining 600 KB of
// minified library into the single-file build would double it for no gain), so only app sources
// are expected to have been folded in above.
if (/<script src="js\/(?!vendor\/)/.test(html)) throw new Error('build: a js/ <script> tag survived inlining');
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
// artifact.html is a single fragment pasted into a host page: it has no siblings to serve
// js/vendor from, and that host's CSP allows exactly these CDNs. So the vendored three.js tags go
// back to their jsDelivr originals here, and only here.
frag = frag.split(`<script src="${VENDOR_LOCAL}`).join(`<script src="${VENDOR_CDN}`);
if (/src="js\/vendor\//.test(frag)) throw new Error('build: a js/vendor <script> tag survived the artifact CDN rewrite');
if ((frag.match(new RegExp(VENDOR_CDN.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'g')) || []).length !== VENDOR_FILES.length) {
  throw new Error(`build: dist/artifact.html should reference ${VENDOR_FILES.length} jsDelivr three.js files`);
}
frag = frag.replace(FONTS_LOCAL, FONTS_CDN);
// Same reason: relative links to the legal pages cannot resolve inside a hosted fragment.
frag = frag.replace(/href="(privacy|terms)\.html"/g, 'href="https://backswing-dkg.pages.dev/$1.html"');
fs.writeFileSync(path.join(root, 'dist/artifact.html'), frag.trim() + '\n');
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB');
console.log('dist/artifact.html', (frag.length / 1024).toFixed(0) + ' KB');
// dist/site: the deployable static site (index + css + js), nothing else
const site = path.join(root, 'dist/site');
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(site, 'css'), { recursive: true });
fs.mkdirSync(path.join(site, 'js'), { recursive: true });
fs.copyFileSync(path.join(root, 'index.html'), path.join(site, 'index.html'));
for (const f of CSS_FILES) fs.copyFileSync(path.join(root, f), path.join(site, f));
for (const f of JS_FILES) fs.copyFileSync(path.join(root, f), path.join(site, f));
// Vendored three.js: needed by dist/site (the deployed site and, via sync-web.sh, the iOS bundle)
// and by dist/index.html, which loads it as a sibling. Only dist/artifact.html goes back to the CDN.
const copyTree = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
};
for (const dest of [site, path.join(root, 'dist')]) {
  fs.rmSync(path.join(dest, VENDOR_DIR), { recursive: true, force: true });
  copyTree(path.join(root, VENDOR_DIR), path.join(dest, VENDOR_DIR));
}
{
  const bytes = VENDOR_FILES.reduce((n, f) => n + fs.statSync(path.join(site, f)).size, 0);
  console.log('dist/site/js/vendor', VENDOR_FILES.length, 'three.js files,', (bytes / 1024).toFixed(0) + ' KB');
}
// Privacy policy and terms: App Store Connect needs a reachable privacy URL, and the in-app
// disclaimer links to both, so they have to exist beside index.html in every deployable artifact.
for (const f of PAGES) {
  if (!fs.existsSync(path.join(root, f))) throw new Error(`build: ${f} is missing - the disclaimer links to it and App Review requires a privacy policy`);
  fs.copyFileSync(path.join(root, f), path.join(site, f));
  fs.copyFileSync(path.join(root, f), path.join(root, 'dist', f));
}
console.log('dist/site pages:', PAGES.join(', '));
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
    const files = fs.readdirSync(anatomySrc).filter((f) => /\.(bin\.gz|txt)$/.test(f));
    if (files.length) {
      fs.mkdirSync(path.join(site, 'assets/anatomy'), { recursive: true });
      let bytes = 0;
      for (const f of files) {
        fs.copyFileSync(path.join(anatomySrc, f), path.join(site, 'assets/anatomy', f));
        if (f === 'spine.bin.gz') bytes = fs.statSync(path.join(anatomySrc, f)).size;
      }
      console.log('dist/site/assets/anatomy', files.length, 'files, spine.bin.gz', (bytes / 1024).toFixed(0) + ' KB over the wire');
    }
  }
}
// The single-file build sits in dist/ and fetches 'assets/anatomy/spine.bin' relative to itself.
// Stage the binary beside it as well, so dist/index.html shows the real spine instead of 404ing on
// a loader it already carries. dist/artifact.html cannot have siblings and falls back by design.
{
  const anatomySrc = path.join(root, 'assets', 'anatomy');
  fs.rmSync(path.join(root, 'dist/assets'), { recursive: true, force: true });
  if (fs.existsSync(anatomySrc)) {
    const files = fs.readdirSync(anatomySrc).filter((f) => /\.(bin\.gz|txt)$/.test(f));
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

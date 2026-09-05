/* Build: produce dist/index.html (single-file app) and dist/artifact.html (body fragment for hosted previews). */
const fs = require('fs');
const path = require('path');
const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');
const css = read('css/styles.css');
const js = ['js/data.js', 'js/figures.js', 'js/lab3d.js', 'js/app.js'].map(read).join('\n;\n');
html = html.replace('<link rel="stylesheet" href="css/styles.css">', `<style>\n${css}\n</style>`);
html = html.replace(/<script src="js\/data\.js"><\/script>\s*<script src="js\/figures\.js"><\/script>\s*<script src="js\/lab3d\.js"><\/script>\s*<script src="js\/app\.js"><\/script>/, `<script>\n${js}\n</script>`);
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
for (const f of ['data.js', 'figures.js', 'lab3d.js', 'app.js']) fs.copyFileSync(path.join(root, 'js', f), path.join(site, 'js', f));
// assets: png files only (app icons, Open Graph image)
const assetsSrc = path.join(root, 'assets');
if (fs.existsSync(assetsSrc)) {
  const pngs = fs.readdirSync(assetsSrc).filter((f) => f.toLowerCase().endsWith('.png'));
  if (pngs.length) {
    fs.mkdirSync(path.join(site, 'assets'), { recursive: true });
    for (const f of pngs) fs.copyFileSync(path.join(assetsSrc, f), path.join(site, 'assets', f));
  }
  console.log('dist/site/assets', pngs.length, 'png');
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

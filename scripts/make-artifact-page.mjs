// Turns dist-artifact/index.html into the page body the Artifact tool publishes (the viewer
// wraps it in its own <!doctype>/<head>/<body>), and lists the supporting files to upload.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-artifact';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1].replace(/^\.\//, ''));
const styles = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1].replace(/^\.\//, ''));
const preloads = [...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1].replace(/^\.\//, ''));

const page = `<title>TOUCHLINE!</title>
<meta name="description" content="Build a club full of footballers you remember, then watch them become heroes.">
<meta name="theme-color" content="#101C32">
<style>html,body{background:#070e1b;height:100%}#root{min-height:100%}</style>
${styles.map((s) => `<link rel="stylesheet" href="${s}">`).join('\n')}
${preloads.map((s) => `<link rel="modulepreload" href="${s}">`).join('\n')}
<div id="root"></div>
<noscript>TOUCHLINE! needs JavaScript to run.</noscript>
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
`;
writeFileSync(join(dir, 'touchline.html'), page);

const files = {};
let total = 0;
for (const f of readdirSync(join(dir, 'assets'))) {
  const p = join(dir, 'assets', f);
  files[`assets/${f}`] = p;
  total += statSync(p).size;
}
writeFileSync(join(dir, 'artifact-files.json'), JSON.stringify(files, null, 2));
console.log(`page: ${join(dir, 'touchline.html')}  supporting files: ${Object.keys(files).length}  total ${(total / 1024 / 1024).toFixed(2)} MB`);

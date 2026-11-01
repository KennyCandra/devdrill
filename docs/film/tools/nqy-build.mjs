// Assembles docs/film/not-quite-yet.html from what the real session produced: session.json, the
// recording from nqy-realapp.mjs, the app's fonts, and the film's own code.
// node docs/film/tools/nqy-build.mjs
/* global console, URL */
import { spawnSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const capture = JSON.parse(readFileSync(here('../out/nqy-real/capture.json'), 'utf8'));
const session = JSON.parse(readFileSync(here('../session.json'), 'utf8'));
const script = readFileSync(here('./nqy-script.mjs'), 'utf8').replace(/^export /gm, '');
const film = readFileSync(here('./nqy-film.js'), 'utf8');

const font = (file) =>
  `url(data:font/woff2;base64,${readFileSync(here(`../../../node_modules/${file}`)).toString('base64')}) format("woff2")`;
const codicon = () =>
  `url(data:font/ttf;base64,${readFileSync(here('../../../node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.ttf')).toString('base64')}) format("truetype")`;

// ---------------------------------------------------------------- the editor recording
// A frame can differ only in what the film draws itself, like the caret's blink: those don't
// count as changes. Everything Chrome would raster at a fixed scale loses its layer hint.
const canon = (html) =>
  html
    .replace(/ cursor-(?:blink|smooth|phase|expand|solid)/g, '')
    .replace(/visibility: (?:hidden|inherit|visible);/g, (m, off, str) =>
      str.lastIndexOf('class="cursor', off) > str.lastIndexOf('<div', off - 1) - 1 ? '' : m,
    )
    .replace(/transform: translate3d\(0px, 0px, 0px\);/g, '')
    .replace(/will-change: [a-z-]+;/g, '');

const frags = [];
const fragIndex = new Map();
const internFrag = (s) => {
  let i = fragIndex.get(s);
  if (i === undefined) {
    i = frags.length;
    frags.push(s);
    fragIndex.set(s, i);
  }
  return i;
};
const keys = [];
let lastHtml = null;
for (const r of capture.rec) {
  const html = canon(r.html);
  if (html === lastHtml) continue;
  lastHtml = html;
  keys.push({
    t: +r.t.toFixed(3),
    f: html.split(/(?=<div style="top:)|(?=<span class="mtk)/).map(internFrag),
  });
}

// ---------------------------------------------------------------- the pages
const page = (html) => html.replace(/^<div id="root">/, '').replace(/<\/div>$/, '');
const pages = Object.fromEntries(
  ['1-bug', '3-not-quite-yet', '4-real-fix', '5-solved'].map((n) => [n, page(capture.pages[n])]),
);

// ---------------------------------------------------------------- the icons in the real pages
const icons = {};
const addIcons = (html) => {
  for (const m of html.matchAll(/<svg[^>]*class="lucide lucide-([a-z-]+)[^"]*"[^>]*>.*?<\/svg>/g)) {
    icons[m[1]] ??= m[0];
  }
};
Object.values(capture.pages).forEach(addIcons);
for (const need of ['rotate-ccw', 'play', 'send', 'check', 'x', 'eye-off', 'book-open']) {
  if (!icons[need]) throw new Error(`The real pages have no ${need} icon`);
}
// Never rendered in this session, but TestRow's markup asks for it.
icons.circle ??= icons.check;

// ---------------------------------------------------------------- the app's CSS
const used = new Set();
for (const s of [...frags, ...Object.values(pages)]) {
  for (const m of s.matchAll(/codicon-[a-z0-9-]+/g)) used.add(m[0]);
}
const INTER = '@fontsource-variable/inter/files/inter';
const MONO = '@fontsource-variable/jetbrains-mono/files/jetbrains-mono';
const css = capture.css
  // Only the codicons this session shows: the full set is 155 KB of rules.
  .filter((r) => {
    const m = /^\.codicon-([a-z0-9-]+)::before/.exec(r);
    return !m || used.has(`codicon-${m[1]}`);
  })
  // Inter and JetBrains Mono's latin faces carry every letter here; ⌘ and ↵ fall back to the
  // same system font as in the app. The other scripts stay out of the file.
  .map((r) => {
    if (!r.startsWith('@font-face')) return r;
    const file = /files\/([a-z-]+-(?:wght|standard)-normal)\.woff2/.exec(r)?.[1];
    if (r.includes('codicon')) return r.replace(/src: [^;]+;/, `src: ${codicon()};`);
    const family = r.includes('Inter Variable') ? INTER : MONO;
    if (!file || !/-latin(-ext)?-wght-normal$/.test(file)) return '';
    const name = file.replace(/^(?:inter|jetbrains-mono)/, '');
    return r.replace(/src: [^;]+;/, `src: ${font(`${family}${name}.woff2`)};`);
  })
  .filter(Boolean)
  .join('\n');

const leftover = /url\("?\/[^)]*\)/.exec(css);
if (leftover) console.log(`warning: the CSS still points outside the file: ${leftover[0]}`);

// ---------------------------------------------------------------- the file
const asJson = (v) => JSON.stringify(v).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<title>Not quite yet</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
/* The film moves everything itself, from t. */
*, *::before, *::after { animation: none !important; transition: none !important; will-change: auto !important; caret-color: transparent; }
html, body { margin: 0; height: 100%; overflow: hidden; background: #1e1e1e; }
#stage { position: absolute; left: 0; top: 0; width: 1440px; height: 810px; transform-origin: 0 0; overflow: hidden; background: #1e1e1e; }
#root { width: 1440px; height: 810px; }
#root .monaco-editor .cursors-layer .cursor { visibility: hidden !important; }
#root[data-caret="1"] .monaco-editor.focused .cursors-layer .cursor { visibility: visible !important; display: block !important; }
#root .editor-scrollable > .scrollbar.vertical { opacity: var(--sb, 0) !important; visibility: visible !important; }
#mouse { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 100; }
#mouse svg { position: absolute; left: 0; top: 0; display: none; overflow: visible; }
#term { display: none; position: absolute; inset: 0; background: #181818; color: #cccccc; font: 400 30px/1.5 'JetBrains Mono Variable', monospace; font-feature-settings: "liga" 0, "calt" 0; padding: 64px 72px; white-space: pre; }
.term-prompt { color: #8b8b8b; }
.term-caret { display: inline-block; width: 16px; height: 34px; margin-left: 1px; vertical-align: -6px; background: #cccccc; }
</style>
</head>
<body>
<div id="stage">
<div id="root"></div>
<div id="term"></div>
<div id="mouse">
<svg id="cursor-arrow" width="16" height="22" viewBox="0 0 16 22"><path d="M2 2 L2 17.2 L5.6 13.9 L8 19.4 L10.7 18.2 L8.3 12.9 L13 12.9 Z" fill="#000" stroke="#fff" stroke-width="1.3" stroke-linejoin="round" paint-order="stroke"/></svg>
<svg id="cursor-text" width="12" height="20" viewBox="0 0 12 20"><path d="M3 1.5 C4.6 1.5 5.6 2.1 6 3 C6.4 2.1 7.4 1.5 9 1.5 M6 3 L6 17 M3 18.5 C4.6 18.5 5.6 17.9 6 17 C6.4 17.9 7.4 18.5 9 18.5 M4.3 10 L7.7 10" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M3 1.5 C4.6 1.5 5.6 2.1 6 3 C6.4 2.1 7.4 1.5 9 1.5 M6 3 L6 17 M3 18.5 C4.6 18.5 5.6 17.9 6 17 C6.4 17.9 7.4 18.5 9 18.5 M4.3 10 L7.7 10" fill="none" stroke="#000" stroke-width="1.15" stroke-linecap="round"/></svg>
<svg id="cursor-hand" width="18" height="22" viewBox="0 0 18 22"><path d="M5.6 11.2 L5.6 3.2 C5.6 1.4 8 1.4 8 3.2 L8 9 L8 7.7 C8 6.1 10.3 6.1 10.3 7.7 L10.3 9.2 L10.3 8.5 C10.3 6.9 12.6 6.9 12.6 8.5 L12.6 9.8 L12.6 9.3 C12.6 7.8 14.9 7.8 14.9 9.3 L14.9 14.4 C14.9 17.5 13.4 19.8 13.4 19.8 L6.9 19.8 C6.9 19.8 5.8 17.8 4.6 16.2 L2.5 13.5 C1.4 12 3.2 10.5 4.5 11.7 Z" fill="#fff" stroke="#000" stroke-width="1.15" stroke-linejoin="round"/><path d="M8 9.6 L8 13.5 M10.3 9.6 L10.3 13.5 M12.6 9.8 L12.6 13.5" stroke="#000" stroke-width="0.9" stroke-linecap="round" fill="none"/></svg>
</div>
</div>
<script type="text/plain" id="session">${asJson(session)}</script>
<script type="text/plain" id="pages">${asJson(pages)}</script>
<script type="text/plain" id="frags">${asJson(frags)}</script>
<script type="text/plain" id="keys">${asJson(keys)}</script>
<script type="text/plain" id="icons">${asJson(icons)}</script>
<script type="text/plain" id="appcss">${css.replace(/<\//g, '<\\/')}</script>
<script>
const appStyle = document.createElement('style');
appStyle.textContent = document.getElementById('appcss').textContent.replace(/<\\\//g, '</');
document.head.prepend(appStyle);
const read = (id) => JSON.parse(document.getElementById(id).textContent);
const SESSION = read('session');
const PAGES = read('pages');
const FRAGS = read('frags');
const KEYS = read('keys');
const ICONS = read('icons');
</script>
<script>
${script}
</script>
<script>
{
${film}
}
</script>
</body>
</html>
`;
const out = here('../not-quite-yet.html');
writeFileSync(out, html);
// The app's data sits in text/plain blocks, so Prettier only formats the film's own code.
spawnSync('npx', ['prettier', '--write', out], { stdio: 'ignore' });
console.log(
  `wrote not-quite-yet.html: ${(Buffer.byteLength(html) / 1e6).toFixed(2)} MB; ${keys.length} editor frames, ${frags.length} fragments, ${(Buffer.byteLength(JSON.stringify(frags)) / 1e6).toFixed(2)} MB of them; css ${(css.length / 1e3).toFixed(0)} KB`,
);

#!/usr/bin/env node
// Erzeugt die Übersichtsseite _site/index.html für GitHub Pages: listet alle gebauten Pakete mit Titel und Tagline aus pack.json.
//   node tools/build-index.mjs [--site=_site]
// Aufgenommen wird jedes Paket unter packs/ (Namen mit „_“ am Anfang ausgelassen), zu dem <site>/<paket>/index.html existiert.
// Schlicht, barrierearm, hell/dunkel, ohne externe Abrufe. Nur Node-Standardbibliothek.
import fs from 'fs';
import path from 'path';
import { ROOT } from './check-lib.mjs';

const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
const SITE = path.resolve(ROOT, typeof flags.site === 'string' ? flags.site : '_site');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const items = [];
const packsDir = path.join(ROOT, 'packs');
for (const id of fs.existsSync(packsDir) ? fs.readdirSync(packsDir).sort() : []) {
  if (id.startsWith('_') || id.startsWith('.')) continue;
  if (!fs.existsSync(path.join(SITE, id, 'index.html'))) continue;
  let pj = {};
  try { pj = JSON.parse(fs.readFileSync(path.join(packsDir, id, 'pack.json'), 'utf8')); } catch (e) { /* ohne Titel */ }
  let n = '';
  try { n = String(JSON.parse(fs.readFileSync(path.join(packsDir, id, 'plan.json'), 'utf8')).journeys.length); } catch (e) { /* ohne Zahl */ }
  items.push({ id, title: pj.title || id, tagline: String(pj.tagline || '').replace(/\{n\}/g, n) });
}

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Museen</title>
<style>
:root { --bg: #f6f2ea; --ink: #1d2433; --muted: #596175; --card: #fff; --line: #d8d0c0; --link: #7a3f17; }
@media (prefers-color-scheme: dark) { :root { --bg: #0e1420; --ink: #e9edf5; --muted: #a6b0c4; --card: #161e2e; --line: #2c3750; --link: #e3ad72; } }
body { margin: 0; background: var(--bg); color: var(--ink); font: 18px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 1.9rem; line-height: 1.2; }
ul { list-style: none; padding: 0; margin: 24px 0; display: grid; gap: 12px; }
li a { display: block; padding: 16px 18px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; color: var(--link); text-decoration: none; }
li a:hover, li a:focus-visible { border-color: var(--link); outline: 3px solid transparent; box-shadow: 0 0 0 3px var(--link); }
li strong { display: block; font-size: 1.15rem; text-decoration: underline; }
li span { color: var(--muted); }
p.fuss { color: var(--muted); font-size: .9rem; }
</style>
</head>
<body>
<main>
<h1>Museen</h1>
<p>Vernetzte Wissensgebiete zum Erkunden. Wähle ein Museum.</p>
${items.length ? '<ul>\n' + items.map(i => `<li><a href="${esc(i.id)}/index.html"><strong>${esc(i.title)}</strong>${i.tagline ? `<span>${esc(i.tagline)}</span>` : ''}</a></li>`).join('\n') + '\n</ul>' : '<p>Noch keine Museen veröffentlicht.</p>'}
<p class="fuss">Erstellt mit Museum Studio. Diese Seiten setzen keine Cookies und laden nichts von Dritten nach.</p>
</main>
</body>
</html>
`;
fs.mkdirSync(SITE, { recursive: true });
fs.writeFileSync(path.join(SITE, 'index.html'), html);
console.log(`✓ ${path.relative(ROOT, path.join(SITE, 'index.html'))}: ${items.length} Paket${items.length === 1 ? '' : 'e'} (${items.map(i => i.id).join(', ')})`);

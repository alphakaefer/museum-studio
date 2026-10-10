#!/usr/bin/env node
// Museum Studio – Zusammenbau: Engine + Paket + Skins -> fertige statische Seite (läuft auch per file://).
//
//   node tools/build.mjs <paket> [--out=dist/<paket>] [--skins=all|a,b|none] [--default-skin=id]
//
// <paket>        Ordnername unter packs/ (oder ein Pfad)
// --skins        Liste der einzubindenden Skins aus themes/ (Standard: nur der Standard-Skin des Pakets, falls vorhanden)
// --default-skin Standard-Skin (Standard: pack.json defaultSkin, sonst der erste eingebundene)
//
// Erzeugt in <out>:
//   index.html           aus engine/index.template.html
//   css/engine.css, css/exhibits.css, css/journey-colors.css   (Reisefarben --j-<id> und --jp-<n> aus journeys.js)
//   skins/<id>/…         ausgewählte Skins (theme.css, theme.json, weitere Dateien des Skins). Aus theme.json liest der Build name, description, map, mode;
//                        id = Ordnername (Abweichung: Warnung), fonts nur Information (nicht gelesen). Prüfung: node tools/check-skin.mjs <skin>
//   js/*.js              Engine (inkl. js/viz.js, der Abbildungs-Baukasten MUSEUM.viz; lädt vor den Paket-Abbildungen und -Exponaten)
//   data/pack.js         MUSEUM.pack  (aus pack.json)
//   data/skins.js        MUSEUM.skins (aus den theme.json)
//   data/orders.js       MUSEUM.data.orders (aus plan.json)
//   data/journeys.js, data/stationen/*.js, data/material.js, data/layout.js, data/exhibits/*.js, data/visuals/*.js   (Paketdateien)
//   Nur mit packs/<id>/spielplan.json (Spielplan, Format spielplan/0, siehe docs/SPIELPLAN-ARBEITSSTAND.md; erzeugt von tools/spielplan-aus-plan.mjs):
//   data/spielplan.js (MUSEUM.data.spielplan), js/spielplan.js (Kern), js/spiel.js (Anbindung), css/spiel.css. Der Adapter
//   (js/spielplan-adapter.js, xAPI und SCORM) wird nie eingebunden. Ohne spielplan.json bleibt die Ausgabe unverändert.
// Nur Node-Standardbibliothek.
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const POS = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));

function die(msg) { console.error('✗ ' + msg); process.exit(1); }
if (!POS[0]) die('Aufruf: node tools/build.mjs <paket> [--out=dist/<paket>] [--skins=all|a,b|none] [--default-skin=id]');

const PACK_DIR = fs.existsSync(path.join(ROOT, 'packs', POS[0])) ? path.join(ROOT, 'packs', POS[0]) : path.resolve(POS[0]);
if (!fs.existsSync(PACK_DIR)) die(`Paket nicht gefunden: ${POS[0]}`);
const PACK_ID = path.basename(PACK_DIR);
const OUT = path.resolve(ROOT, typeof args.out === 'string' ? args.out : path.join('dist', PACK_ID));
const ENGINE = path.join(ROOT, 'engine');
const THEMES = path.join(ROOT, 'themes');

/* ---------------------------------------------------------------- Helfer */

const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { die(`${path.relative(ROOT, f)}: nicht lesbar (${e.message})`); } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const exists = f => fs.existsSync(f);
function copyFile(src, dst) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); }
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
const listJs = dir => exists(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort() : [];
const orderBy = (files, wanted) => {
  const w = (wanted || []).map(x => String(x).endsWith('.js') ? x : x + '.js');
  const first = w.filter(f => files.includes(f));
  return first.concat(files.filter(f => !first.includes(f)));
};

/* ---------------------------------------------------------------- Paketdaten */

const packFile = path.join(PACK_DIR, 'pack.json');
if (!exists(packFile)) die(`${path.relative(ROOT, packFile)} fehlt`);
const pack = readJSON(packFile);
// Lokale Überschreibung (nicht im Repo): packs/<id>/pack.local.json, z. B. Impressum und Datenschutz der eigenen Domain.
// Objekte werden zusammengeführt, alles andere (auch Listen) ersetzt.
const localFile = path.join(PACK_DIR, 'pack.local.json');
if (exists(localFile)) {
  const merge = (a, b) => { for (const k of Object.keys(b)) a[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k]; return a; };
  merge(pack, readJSON(localFile));
  console.log('• pack.local.json eingemischt');
}
if (!pack.title) die('pack.json: "title" fehlt');
const planFile = path.join(PACK_DIR, 'plan.json');
if (!exists(planFile)) die(`${path.relative(ROOT, planFile)} fehlt`);
const plan = readJSON(planFile);
if (!plan.orders || !Array.isArray(plan.stations)) die('plan.json: "stations" oder "orders" fehlt');
const journeysFile = path.join(PACK_DIR, 'journeys.js');
if (!exists(journeysFile)) die(`${path.relative(ROOT, journeysFile)} fehlt`);

// journeys.js ausführen (nur Daten), um Reisefarben und Reihenfolge zu lesen
const sandbox = {}; sandbox.window = sandbox;
try { vm.runInNewContext(fs.readFileSync(journeysFile, 'utf8'), sandbox, { filename: journeysFile }); }
catch (e) { die(`journeys.js lässt sich nicht auswerten: ${e.message}`); }
const journeys = sandbox.MUSEUM && sandbox.MUSEUM.data && sandbox.MUSEUM.data.journeys;
if (!Array.isArray(journeys) || !journeys.length) die('journeys.js: MUSEUM.data.journeys fehlt oder ist leer');

/* ---------------------------------------------------------------- Reisefarben */

function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
const HEX = /^#[0-9a-f]{6}$/i;
journeys.forEach((j, i) => {
  const c = j.color || {};
  const hue = (i * 137.508) % 360;
  if (!HEX.test(c.light || '')) { c.light = hsl(hue, 58, 40); if (j.color) console.warn(`! Reise ${j.id}: color.light fehlt oder ungültig, Ersatzfarbe ${c.light}`); }
  if (!HEX.test(c.dark || '')) { c.dark = hsl(hue, 70, 66); }
  j._c = c;
});
const JP_COUNT = 12;
function colorBlock(mode) {
  const lines = journeys.map(j => `--j-${j.id}:${j._c[mode]};`);
  for (let k = 1; k <= JP_COUNT; k++) lines.push(`--jp-${k}:var(--j-${journeys[(k - 1) % journeys.length].id});`);
  return lines.join('\n  ');
}
const journeyColorsCss = `/* erzeugt von tools/build.mjs aus journeys.js: Reisefarben --j-<id> und Positionsfarben --jp-<n> */
:root {
  ${colorBlock('light')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
  ${colorBlock('dark')}
  }
}
:root[data-theme="dark"],
.gm-hero,
.gm-dark,
.gm-header[data-tone="dark"] {
  ${colorBlock('dark')}
}
`;

/* ---------------------------------------------------------------- Skins */

const listSkins = () => exists(THEMES) ? fs.readdirSync(THEMES, { withFileTypes: true }).filter(e => e.isDirectory() && exists(path.join(THEMES, e.name, 'theme.css'))).map(e => e.name).sort() : [];
const available = listSkins();
let wanted;
const skinArg = args.skins;
if (skinArg === 'all') wanted = available;
else if (skinArg === 'none') wanted = [];
else if (typeof skinArg === 'string') {
  wanted = skinArg.split(',').map(s => s.trim()).filter(Boolean);
  for (const s of wanted) if (!available.includes(s)) die(`Skin "${s}" nicht gefunden (themes/${s}/theme.css). Vorhanden: ${available.join(', ') || '(keine)'}`);
} else {
  const d = pack.defaultSkin;
  wanted = d && available.includes(d) ? [d] : [];
  if (d && !wanted.length) console.warn(`! Standard-Skin "${d}" liegt nicht unter themes/; die Seite wird ohne Skin gebaut.`);
}
const skins = wanted.map(id => {
  const meta = exists(path.join(THEMES, id, 'theme.json')) ? readJSON(path.join(THEMES, id, 'theme.json')) : {};
  const map = meta.map || {};
  // id gilt immer der Ordnername; "fonts" ist nur Information für Menschen (die Engine liest sie nicht)
  if (meta.id !== undefined && meta.id !== id) console.warn(`! themes/${id}/theme.json: "id" ist "${meta.id}", gilt aber der Ordnername "${id}". Prüfen: node tools/check-skin.mjs ${id}`);
  return {
    id, name: meta.name || id, description: meta.description || '',
    map: { lines: map.lines === 'smooth' ? 'smooth' : 'octilinear', nodes: map.nodes === 'shapes' ? 'shapes' : 'icons' },
    mode: ['light', 'dark'].includes(meta.mode) ? meta.mode : 'both'
  };
});
let defaultSkin = typeof args['default-skin'] === 'string' ? args['default-skin'] : (pack.defaultSkin || '');
if (skins.length && !skins.some(s => s.id === defaultSkin)) {
  if (typeof args['default-skin'] === 'string') die(`--default-skin=${defaultSkin} ist nicht unter den eingebundenen Skins (${wanted.join(', ')})`);
  defaultSkin = skins[0].id;
}
if (!skins.length) defaultSkin = '';

/* ---------------------------------------------------------------- Spielplan (optional) */

const spielplanFile = path.join(PACK_DIR, 'spielplan.json');
let spielplan = null;
if (exists(spielplanFile)) {
  spielplan = readJSON(spielplanFile);
  if (!spielplan || typeof spielplan !== 'object' || Array.isArray(spielplan) || !Array.isArray(spielplan.einheiten)) die(`${path.relative(ROOT, spielplanFile)}: kein Spielplan (erwartet ein Objekt mit "einheiten"). Erzeugen: node tools/spielplan-aus-plan.mjs ${PACK_ID}`);
  if (!String(spielplan.format || '').startsWith('spielplan/')) console.warn(`! ${path.relative(ROOT, spielplanFile)}: format ist "${spielplan.format}", erwartet "spielplan/0".`);
}

/* ---------------------------------------------------------------- Ausgabe */

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Engine
const ENGINE_JS = ['core', 'icons', 'viz', 'hero', 'map', 'journey', 'timeline', 'passport', 'search', 'app'];
for (const n of ENGINE_JS) { const f = path.join(ENGINE, 'js', n + '.js'); if (!exists(f)) die(`engine/js/${n}.js fehlt`); copyFile(f, path.join(OUT, 'js', n + '.js')); }
copyFile(path.join(ENGINE, 'css', 'engine.css'), path.join(OUT, 'css', 'engine.css'));
copyFile(path.join(ENGINE, 'css', 'exhibits.css'), path.join(OUT, 'css', 'exhibits.css'));
fs.writeFileSync(path.join(OUT, 'css', 'journey-colors.css'), journeyColorsCss);
if (spielplan) {   // nur mit Spielplan: Kern, Anbindung und Stile (nie der Adapter spielplan-adapter.js)
  for (const n of ['spielplan', 'spiel']) { const f = path.join(ENGINE, 'js', n + '.js'); if (!exists(f)) die(`engine/js/${n}.js fehlt`); copyFile(f, path.join(OUT, 'js', n + '.js')); }
  if (!exists(path.join(ENGINE, 'css', 'spiel.css'))) die('engine/css/spiel.css fehlt');
  copyFile(path.join(ENGINE, 'css', 'spiel.css'), path.join(OUT, 'css', 'spiel.css'));
  if (!exists(path.join(ENGINE, 'css', 'spiel-ansichten.css'))) die('engine/css/spiel-ansichten.css fehlt');
  copyFile(path.join(ENGINE, 'css', 'spiel-ansichten.css'), path.join(OUT, 'css', 'spiel-ansichten.css'));
}

// Skins
for (const s of skins) copyDir(path.join(THEMES, s.id), path.join(OUT, 'skins', s.id));

// Paketdaten als Skripte
const dataDir = path.join(OUT, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const wrap = body => `(function(){'use strict';\nwindow.MUSEUM=window.MUSEUM||{};\n${body}\n})();\n`;
fs.writeFileSync(path.join(dataDir, 'pack.js'), wrap(`MUSEUM.pack=${JSON.stringify(pack, null, 1)};`));
fs.writeFileSync(path.join(dataDir, 'skins.js'), wrap(`MUSEUM.skins=${JSON.stringify(skins, null, 1)};`));
fs.writeFileSync(path.join(dataDir, 'orders.js'), wrap(`MUSEUM.data=MUSEUM.data||{};\nMUSEUM.data.orders=${JSON.stringify(plan.orders, null, 1)};`));
copyFile(journeysFile, path.join(dataDir, 'journeys.js'));

const dataScripts = ['data/journeys.js'];
const stationFiles = orderBy(listJs(path.join(PACK_DIR, 'stationen')), pack.stationFiles);
for (const f of stationFiles) { copyFile(path.join(PACK_DIR, 'stationen', f), path.join(dataDir, 'stationen', f)); dataScripts.push('data/stationen/' + f); }
for (const f of ['material.js', 'layout.js']) if (exists(path.join(PACK_DIR, f))) { copyFile(path.join(PACK_DIR, f), path.join(dataDir, f)); dataScripts.push('data/' + f); }
dataScripts.push('data/orders.js');
if (spielplan) {
  fs.writeFileSync(path.join(dataDir, 'spielplan.js'), wrap(`MUSEUM.data=MUSEUM.data||{};\nMUSEUM.data.spielplan=${JSON.stringify(spielplan)};`));
  dataScripts.push('data/spielplan.js');
}
const exhibitFiles = orderBy(listJs(path.join(PACK_DIR, 'exhibits')), pack.exhibits);
for (const f of exhibitFiles) { copyFile(path.join(PACK_DIR, 'exhibits', f), path.join(dataDir, 'exhibits', f)); dataScripts.push('data/exhibits/' + f); }
const visualFiles = listJs(path.join(PACK_DIR, 'visuals'));
for (const f of visualFiles) { copyFile(path.join(PACK_DIR, 'visuals', f), path.join(dataDir, 'visuals', f)); dataScripts.push('data/visuals/' + f); }

// index.html
const tpl = path.join(ENGINE, 'index.template.html');
if (!exists(tpl)) die('engine/index.template.html fehlt');
const styles = ['css/engine.css', 'css/exhibits.css', ...(spielplan ? ['css/spiel.css', 'css/spiel-ansichten.css'] : []), 'css/journey-colors.css', ...skins.map(s => `skins/${s.id}/theme.css`)]
  .map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
const scripts = ['data/pack.js', 'data/skins.js', 'js/core.js', 'js/icons.js', 'js/viz.js', ...dataScripts, ...(spielplan ? ['js/spielplan.js', 'js/spiel.js'] : []), 'js/hero.js', 'js/map.js', 'js/journey.js', 'js/timeline.js', 'js/passport.js', 'js/search.js', 'js/app.js']
  .map(s => `<script src="${s}"></script>`).join('\n');
const favColors = [0, 2, 4].map(i => journeys[i % journeys.length]._c.dark.replace('#', '%23'));
const favicon = `data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E%3Crect%20width='32'%20height='32'%20rx='8'%20fill='%230E1420'/%3E%3Cg%20fill='none'%20stroke-width='2.2'%20stroke-linecap='round'%3E%3Cpath%20d='M4%209C13%209%2012%2016%2016%2016S21%2023%2028%2023'%20stroke='${favColors[0]}'/%3E%3Cpath%20d='M4%2023C13%2023%2012%2016%2016%2016S21%209%2028%209'%20stroke='${favColors[1]}'/%3E%3Cpath%20d='M4%2016H28'%20stroke='${favColors[2]}'/%3E%3Ccircle%20cx='16'%20cy='16'%20r='4.6'%20fill='%230E1420'%20stroke='%23FCB300'%20stroke-width='2.4'/%3E%3C/g%3E%3C/svg%3E`;
const lang = pack.lang || 'de';
const subs = {
  LANG: esc(lang),
  HTML_ATTRS: '',
  PAGE_TITLE: esc(pack.pageTitle || pack.title),
  TITLE: esc(pack.title),
  DESCRIPTION: esc(pack.description || [pack.title, pack.eyebrow, pack.tagline && String(pack.tagline).replace(/\{\w+\}/g, '')].filter(Boolean).join(' – ')),
  AUTHOR_META: pack.author ? `<meta name="author" content="${esc(pack.author)}">\n` : '',
  OG_LOCALE: lang.length === 2 ? `${lang}_${lang.toUpperCase()}` : lang.replace('-', '_'),
  FAVICON: favicon,
  SKIN_IDS: JSON.stringify(skins.map(s => s.id)),
  DEFAULT_SKIN: JSON.stringify(defaultSkin),
  STYLES: styles,
  SCRIPTS: scripts
};
let html = fs.readFileSync(tpl, 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => { if (!(k in subs)) die(`Platzhalter {{${k}}} im Template unbekannt`); return subs[k]; });
fs.writeFileSync(path.join(OUT, 'index.html'), html);

/* ---------------------------------------------------------------- Bericht */

const used = new Set(); Object.values(plan.orders).forEach(o => o.forEach(s => used.add(s)));
const count = {}; Object.values(plan.orders).forEach(o => new Set(o).forEach(s => { count[s] = (count[s] || 0) + 1; }));
const crossings = Object.values(count).filter(n => n > 1).length;
const jWithStations = journeys.filter(j => (plan.orders[j.id] || []).length).length;
console.log(`✓ ${path.relative(ROOT, OUT) || '.'}/index.html  (Paket ${PACK_ID}: ${plan.stations.length} Stationen, ${jWithStations} Reisen, ${crossings} Kreuzungen)`);
if (spielplan) console.log(`  Spielplan: ${spielplan.einheiten.length} Einheiten, ${(spielplan.regeln || []).length} Regeln (data/spielplan.js, js/spielplan.js, js/spiel.js, css/spiel.css)`);
console.log(`  Skins: ${skins.length ? skins.map(s => s.id + (s.id === defaultSkin ? '*' : '')).join(', ') : '(keine)'}  Stationsdateien: ${stationFiles.length}, Exponate: ${exhibitFiles.length}, Abbildungen: ${visualFiles.length}`);

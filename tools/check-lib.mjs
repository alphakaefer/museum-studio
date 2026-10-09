// Gemeinsame Helfer der Prüfskripte (check-plan, check-data, check-material, check-pack) und von derive-pack.
// Kein eigener Befehl. Nur Node, keine Abhängigkeiten.
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const KINDS = ['konzept', 'person', 'ereignis', 'methode', 'mythos', 'instrument', 'ort'];
export const DEFAULT_LIMITS = { min: 11, max: 28 };
export const DEFAULT_VISUAL_SHARE = 0.3;   // Mindestanteil der Stationen mit Abbildung oder Exponat (pack.json limits.visualShare)
export const VISUAL_KINDS = ['abbildung', 'exponat', 'keine'];
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Ergebnisbehälter einer Prüfung. */
export function newReport() {
  const r = { errors: [], warnings: [], info: {} };
  r.err = m => r.errors.push(m);
  r.warn = m => r.warnings.push(m);
  return r;
}

export function mergeReport(into, from) {
  into.errors.push(...from.errors);
  into.warnings.push(...from.warnings);
  Object.assign(into.info, from.info);
}

/** Paketname -> Verzeichnis. Akzeptiert auch einen Pfad zu einem Paketverzeichnis. */
export function resolvePack(arg) {
  if (!arg) return null;
  // Ohne Pfadtrenner ist es immer ein Ordnername unter packs/; mit Pfadtrenner ein Pfad zu einem Paketordner
  const dir = /[\\/]/.test(arg) ? path.resolve(arg) : path.join(ROOT, 'packs', arg);
  return { dir, name: path.basename(dir), rel: p => path.relative(ROOT, path.join(dir, p || '')) || '.' };
}

/** Standard-Kopf für CLI: Paket aus argv holen oder mit Hinweis abbrechen. */
export function packFromArgv(scriptName, extra) {
  const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!pos.length) {
    console.error(`Aufruf: node tools/${scriptName} <paket>${extra || ''}\n  <paket> ist der Ordnername unter packs/, z. B. beispiel-gehirn.`);
    process.exit(2);
  }
  const P = resolvePack(pos[0]);
  if (!fs.existsSync(P.dir) || !fs.statSync(P.dir).isDirectory()) {
    console.error(`✗ Paketordner nicht gefunden: ${path.relative(ROOT, P.dir)}. Vorhandene Pakete: ${listPacks().join(', ') || '(keine)'}`);
    process.exit(2);
  }
  return { P, rest: pos.slice(1), flags: Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; })) };
}

export function listPacks() {
  try { return fs.readdirSync(path.join(ROOT, 'packs')).filter(n => fs.statSync(path.join(ROOT, 'packs', n)).isDirectory()); } catch { return []; }
}

export function readJson(file, report, relName) {
  let txt;
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return null; }
  try { return JSON.parse(txt); } catch (e) {
    if (report) report.err(`${relName}: kein gültiges JSON (${e.message}). Häufig: fehlendes Komma, überzähliges Komma am Ende, einfache statt doppelte Anführungszeichen.`);
    return undefined;
  }
}

export function loadPackJson(P, report) {
  const rel = P.rel('pack.json');
  const j = readJson(path.join(P.dir, 'pack.json'), report, rel);
  return j; // null = fehlt, undefined = defekt
}

export function loadPlan(P, report) {
  const rel = P.rel('plan.json');
  const j = readJson(path.join(P.dir, 'plan.json'), report, rel);
  if (j === null) report.err(`${rel}: Datei fehlt. Der Stationsplan ist Pflicht (journeys, stations, orders).`);
  return j || null;
}

/** Grenzen Stationen je Reise aus pack.json limits (min/max), sonst 11-28. */
export function limitsOf(pack) {
  const l = (pack && pack.limits) || {};
  const min = Number.isInteger(l.min) ? l.min : DEFAULT_LIMITS.min;
  const max = Number.isInteger(l.max) ? l.max : DEFAULT_LIMITS.max;
  const vs = typeof l.visualShare === 'number' && l.visualShare >= 0 && l.visualShare <= 1 ? l.visualShare : DEFAULT_VISUAL_SHARE;
  return { min, max, minCrossJourneys: Number.isInteger(l.minCrossJourneys) ? l.minCrossJourneys : null, visualShare: vs };
}

/** Exponat-IDs aus pack.json exhibits (Liste von Strings). */
export function exhibitsOf(pack) {
  const e = pack && pack.exhibits;
  return Array.isArray(e) ? e.filter(x => typeof x === 'string') : [];
}

/** Icon-Schlüssel aus engine/js/icons.js: Datei in einer Attrappe ausführen (robust gegen Umformatierung), Rückfall: Textsuche. */
let iconCache;
export function iconKeys() {
  if (iconCache) return iconCache;
  const file = path.join(ROOT, 'engine/js/icons.js');
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { return (iconCache = null); }
  try {
    const ctx = { console };
    ctx.window = ctx;
    vm.runInNewContext(src, ctx, { filename: file, timeout: 3000 });
    const k = ctx.MUSEUM && ctx.MUSEUM.icons && ctx.MUSEUM.icons.keys;
    if (Array.isArray(k) && k.length) return (iconCache = new Set(k));
  } catch { /* Rückfall */ }
  const body = src.split(/var D = \{/)[1] || '';
  const found = new Set();
  for (const m of body.matchAll(/^\s{4}(?:'([a-z0-9-]+)'|"([a-z0-9-]+)"|([a-z][a-z0-9]*))\s*:/gm)) found.add(m[1] || m[2] || m[3]);
  return (iconCache = found.size ? found : null);
}

function runFile(file, rel, ctx) {
  const src = fs.readFileSync(file, 'utf8');
  vm.runInNewContext(src, ctx, { filename: rel, timeout: 5000 });
}

/** Alle stationen/*.js laden. Liefert { files:[{rel,ids}], all:{id:station}, owner:{id:rel}, dupes:[...] }. Ladefehler gehen in report. */
export function loadStations(P, report, onlyFiles) {
  const dir = path.join(P.dir, 'stationen');
  const out = { files: [], all: {}, owner: {}, dupes: [], exists: fs.existsSync(dir) };
  let names;
  if (onlyFiles && onlyFiles.length) names = onlyFiles.map(f => path.resolve(f));
  else if (out.exists) names = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort().map(f => path.join(dir, f));
  else names = [];
  for (const f of names) {
    const rel = path.relative(ROOT, f);
    const got = {};
    const ctx = { console };
    ctx.window = ctx;
    ctx.MUSEUM = { addStations: o => { for (const [id, s] of Object.entries(o || {})) { if (Object.prototype.hasOwnProperty.call(got, id)) out.dupes.push({ id, rel, first: rel }); got[id] = s; } }, data: {} };
    try { runFile(f, rel, ctx); } catch (e) { report.err(`${rel}: Ladefehler, Datei lässt sich nicht ausführen (${e.message}). Prüfe Klammern, Kommas und Anführungszeichen.`); continue; }
    for (const [id, s] of Object.entries(got)) {
      if (out.owner[id]) out.dupes.push({ id, rel, first: out.owner[id] });
      out.all[id] = s; out.owner[id] = rel;
    }
    out.files.push({ rel, ids: Object.keys(got) });
  }
  return out;
}

/** journeys.js laden -> Array. */
export function loadJourneysJs(P, report) {
  const f = path.join(P.dir, 'journeys.js'), rel = P.rel('journeys.js');
  if (!fs.existsSync(f)) { report.err(`${rel}: Datei fehlt. Sie enthält Name, Farbe und Texte jeder Reise (MUSEUM.data.journeys).`); return null; }
  const ctx = { console }; ctx.window = ctx; ctx.MUSEUM = { data: {} };
  try { runFile(f, rel, ctx); } catch (e) { report.err(`${rel}: Ladefehler (${e.message}).`); return null; }
  const arr = ctx.MUSEUM.data && ctx.MUSEUM.data.journeys;
  if (!Array.isArray(arr)) { report.err(`${rel}: MUSEUM.data.journeys ist kein Array. Erwartet: MUSEUM.data.journeys=[ {id,typ,name,kurz,tagline,intro,outro,icon,color:{light,dark}}, … ];`); return null; }
  return arr;
}

/** quellen.txt -> Set erlaubter URLs oder null, wenn die Datei fehlt. Zeilen mit # sind Kommentare. */
export function loadSources(P) {
  let f = path.join(P.dir, 'quellen.txt');
  if (!fs.existsSync(f)) f = path.join(P.dir, 'blog-urls.txt'); // älterer Name
  if (!fs.existsSync(f)) return null;
  return new Set(fs.readFileSync(f, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')));
}

export function wellFormedHttps(u) {
  if (typeof u !== 'string') return false;
  try { const x = new URL(u); return x.protocol === 'https:' && !!x.hostname.includes('.') && !/\s/.test(u); } catch { return false; }
}

export const wordCount = s => String(s).trim().split(/\s+/).filter(Boolean).length;

/** Platzhalter „TODO“ in beliebig verschachtelten Werten finden. Liefert Liste von Pfaden. */
export function findTodos(value, base = '') {
  const hits = [];
  (function walk(v, p) {
    if (typeof v === 'string') { if (/\bTODO\b/.test(v)) hits.push(p || '(Wert)'); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k.startsWith('_')) continue; walk(x, p ? `${p}.${k}` : k); }
  })(value, base);
  return hits;
}

/** Relative Leuchtdichte und Kontrast (WCAG). */
export function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Ausgabe + Exit-Code für CLI. */
export function finish(report, okText, summaryLine) {
  if (summaryLine) console.log(summaryLine);
  for (const w of report.warnings) console.log('! Warnung: ' + w);
  if (report.errors.length) {
    console.log(report.errors.map(e => '✗ ' + e).join('\n'));
    console.log(`\n${report.errors.length} Fehler${report.warnings.length ? `, ${report.warnings.length} Warnungen` : ''}`);
    process.exit(1);
  }
  console.log(`✓ ${okText}${report.warnings.length ? ` (${report.warnings.length} Warnungen)` : ''}`);
  process.exit(0);
}

export function isMain(metaUrl) {
  return process.argv[1] && fileURLToPath(metaUrl) === path.resolve(process.argv[1]);
}

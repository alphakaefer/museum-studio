#!/usr/bin/env node
// Museum Studio – Vergleich zweier gebauter Museen: verhält sich die neue Fassung wie die alte?
//
//   node tools/spiel-vergleich.mjs <alt> <neu> [--diffs=<ordner>]
//
// <alt> und <neu> sind gebaute Ordner (mit index.html), zum Beispiel dasselbe Paket ohne Spielplan, einmal mit der Engine von früher und einmal mit der heutigen:
//   git worktree add /tmp/engine-alt <commit>   &&   (cd /tmp/engine-alt && node tools/build.mjs <paket> --skins=all --out=dist/<paket>)
//   node tools/build.mjs <paket> --skins=all --out=dist/neu
//   node tools/spiel-vergleich.mjs /tmp/engine-alt/dist/<paket> dist/neu
// Geprüft wird (1) dass alle Dateien außer js/*.js gleich sind (Seite, Daten, Stile, Skins) und (2) dass die Seite in elf Zuständen Zeichen für Zeichen dieselbe ist:
//   Eingang, Station, Mythos-Karte, Exponat, Reise-Modus (Einführung, erste und vierte Station), Große Rundreise, Netzplan, Reisepass, Suche. Der Zufall ist festgelegt,
//   Bewegung ausgeschaltet; die Leinwand des Eingangs zählt nicht (sie hat keinen Text). Das ist die Zusicherung „ein Paket ohne spielplan.json verhält sich wie bisher“.
// Mit --diffs=<ordner> landen abweichende Zustände als <zustand>-alt.html und <zustand>-neu.html dort. Rückgabewert 1 bei Unterschieden, 2 ohne Playwright.
import fs from 'fs';
import path from 'path';
import { loadPlaywright, launch } from './pw-lib.mjs';

const argv = process.argv.slice(2);
const POS = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
if (POS.length !== 2) { console.error('Aufruf: node tools/spiel-vergleich.mjs <alt> <neu> [--diffs=<ordner>]'); process.exit(2); }
const [ALT, NEU] = POS.map(p => path.resolve(p));
for (const d of [ALT, NEU]) if (!fs.existsSync(path.join(d, 'index.html'))) { console.error(`✗ ${d}/index.html fehlt (erst bauen)`); process.exit(2); }

let bad = 0;

// 1. Dateien außer js/*.js
function dateien(dir, rel = '') {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap(e => {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) return dateien(dir, r);
    return /^js[\\/][^\\/]+\.js$/.test(r) ? [] : [r];
  }).sort();
}
const fa = dateien(ALT), fn = dateien(NEU);
if (fa.join('\n') !== fn.join('\n')) { bad++; console.log('✗ Dateien: verschieden. Nur alt: ' + fa.filter(f => !fn.includes(f)).join(', ') + ' | nur neu: ' + fn.filter(f => !fa.includes(f)).join(', ')); }
const anders = fa.filter(f => fn.includes(f) && !fs.readFileSync(path.join(ALT, f)).equals(fs.readFileSync(path.join(NEU, f))));
if (anders.length) { bad++; console.log('✗ Dateien mit anderem Inhalt: ' + anders.slice(0, 8).join(', ')); } else console.log(`✓ ${fa.length} Dateien außer js/*.js sind gleich`);

// 2. Zustände im Browser
const { chromium } = loadPlaywright('Dann:  PLAYWRIGHT_MODULE_DIR=~/pw node tools/spiel-vergleich.mjs <alt> <neu>');
const browser = await launch(chromium);
async function zustaende(dist) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { Math.random = (() => { let s = 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(); });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  await page.goto('file://' + dist + '/index.html');
  await page.waitForTimeout(1500);
  const out = {};
  const html = () => page.evaluate(() => document.documentElement.outerHTML.replace(/<canvas[^>]*>/g, '<canvas>'));
  const geheZu = async (h, ms = 800) => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(ms); };
  out.eingang = await html();
  out['MUSEUM.spiel'] = await page.evaluate(() => typeof MUSEUM.spiel);
  const ids = await page.evaluate(() => {
    const st = Object.values(MUSEUM.data.stations);
    return { sid: st[0].id, jid: MUSEUM.data.journeys[0].id, exh: (st.find(s => s.exhibit) || {}).id, myth: (st.find(s => s.kind === 'mythos') || {}).id };
  });
  await geheZu('#/station/' + ids.sid, 900); out.station = await html();
  if (ids.myth) { await geheZu('#/station/' + ids.myth, 700); await page.click('.gm-flip-btn').catch(() => {}); await page.waitForTimeout(300); out.mythos = await html(); }
  if (ids.exh) { await geheZu('#/station/' + ids.exh, 700); await page.click('.gm-plaque-actions button').catch(() => {}); await page.waitForTimeout(500); out.exponat = await html(); }
  await geheZu('#/reise/' + ids.jid, 900); out.reiseEinfuehrung = await html();
  await page.click('.gm-reise-next'); await page.waitForTimeout(700); out.reiseStation1 = await html();
  for (let i = 0; i < 3; i++) { await page.click('.gm-reise-next'); await page.waitForTimeout(400); }
  out.reiseStation4 = await html();
  await geheZu('#/reise/rundreise', 900); out.rundreise = await html();
  await geheZu('#/karte', 900); out.netzplan = await html();
  await geheZu('#/reisepass', 900); out.reisepass = await html();
  await page.evaluate(() => MUSEUM.search.open('a')); await page.waitForTimeout(800); out.suche = await html();
  await ctx.close();
  return { out, fehler };
}
const a = await zustaende(ALT), n = await zustaende(NEU);
if (typeof args.diffs === 'string') fs.mkdirSync(path.resolve(args.diffs), { recursive: true });
for (const k of Object.keys(a.out)) {
  const gleich = a.out[k] === n.out[k];
  if (!gleich) {
    bad++;
    if (typeof args.diffs === 'string') { fs.writeFileSync(path.join(path.resolve(args.diffs), k + '-alt.html'), String(a.out[k])); fs.writeFileSync(path.join(path.resolve(args.diffs), k + '-neu.html'), String(n.out[k])); }
  }
  console.log(`${gleich ? '✓' : '✗'} ${k}${gleich ? '' : ': verschieden'}`);
}
if (JSON.stringify(a.fehler) !== JSON.stringify(n.fehler) || n.fehler.length) { bad++; console.log('✗ Konsolenfehler: alt ' + JSON.stringify(a.fehler) + ', neu ' + JSON.stringify(n.fehler)); }
await browser.close();
console.log(bad ? `\n✗ ${bad} Unterschied(e)` : '\n✓ Alt und neu verhalten sich gleich');
process.exit(bad ? 1 : 0);

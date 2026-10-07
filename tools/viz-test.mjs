#!/usr/bin/env node
// Museum Studio – Browser-Test des Abbildungs-Baukastens (engine/js/viz.js, MUSEUM.viz).
//
//   node tools/viz-test.mjs [paket] [--skins=a,b|all] [--shots=<ordner>]
//
// Baut das Paket (Standard: _vorlage) in einen temporären Ordner, öffnet es per file:// und hängt alle Bausteine
// (Regler, Schalter, Auswahl, Matrix, Kurve, Balken waagerecht und senkrecht, Netz, Schrittfolge) in die Seite ein.
// Dann wird bedient (Klick, Pfeiltasten, Enter) und geprüft, ob sich etwas ändert, ob Konsolenfehler auftreten
// und ob die Seite horizontal scrollt. Läuft in jedem Skin, hell und dunkel, Desktop und Handy, einmal mit reduzierter Bewegung.
// Playwright wird ohne feste Pfade gefunden (siehe tools/pw-lib.mjs). Rückgabewert 1 bei Meldungen, 2 bei fehlendem Playwright.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { loadPlaywright, launch } from './pw-lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const POS = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
const PACK = POS[0] || '_vorlage';
const { chromium } = loadPlaywright('Dann:  PLAYWRIGHT_MODULE_DIR=~/pw node tools/viz-test.mjs');

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'viz-test-'));
const SHOTS = path.resolve(typeof args.shots === 'string' ? args.shots : path.join(OUT, '_shots'));
fs.mkdirSync(SHOTS, { recursive: true });
try { execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.mjs'), PACK, `--out=${OUT}`, `--skins=${typeof args.skins === 'string' ? args.skins : 'all'}`], { stdio: 'pipe' }); }
catch (e) { console.error('✗ Bau fehlgeschlagen:\n' + String(e.stdout || e.message)); process.exit(2); }
const skins = fs.existsSync(path.join(OUT, 'skins')) ? fs.readdirSync(path.join(OUT, 'skins')) : [null];

/** Läuft im Browser: baut alle Bausteine in einen Abschnitt am Anfang der Seite. */
function demo() {
  const V = MUSEUM.viz;
  const sec = document.createElement('section');
  sec.id = 'viz-test'; sec.style.cssText = 'position:relative;z-index:50;background:var(--bg);padding:16px;margin-top:70px';
  const root = V.el('div', { 'class': 'gx-root' }); sec.appendChild(root);
  document.body.insertBefore(sec, document.body.firstChild);
  const T = window.__viz = {};
  T.slider = V.slider({ label: 'Regler', min: 0, max: 10, step: 1, value: 4, unit: 'cm', ends: ['klein', 'groß'] });
  T.toggle = V.toggle({ label: 'Schalter', checked: false });
  T.choice = V.choice({ label: 'Auswahl', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }], value: 'a' });
  T.button = V.button({ label: 'Knopf', onClick: function () { T.clicked = (T.clicked || 0) + 1; } });
  T.readout = V.readout({ label: 'Anzeige', value: 12.5, unit: 'kg', tone: 'good' });
  root.appendChild(V.el('div', { 'class': 'gx-controls' }, T.slider.el, T.toggle.el, T.choice.el, V.el('div', null, T.button.el), T.readout.el));
  root.appendChild(V.legend([{ label: 'Serie eins', cls: 1 }, { label: 'Serie zwei', cls: 2, dash: true }]));
  T.matrix = V.matrix({ rows: ['Kooperieren', 'Verraten'], cols: ['Kooperieren', 'Verraten'], rowTitle: 'Du', colTitle: 'Die andere Person', pairLabels: ['Du', 'Andere'],
    cells: [[[3, 3], [0, 5]], [[5, 0], [1, 1]]], selectable: true, highlight: [{ r: 1, c: 1, tone: 'bad' }], onSelect: function (r, c) { T.selected = [r, c]; } });
  root.appendChild(T.matrix.el);
  T.plot = V.plot({ xDomain: [0, 10], yDomain: [0, 100], xLabel: 'x-Achse', yLabel: 'y-Achse', series: [{ name: 'Linear', f: (x, p) => p.a * x }, { name: 'Quadrat', f: (x, p) => p.a * x * x / 10, dash: true, cls: 2 }],
    controls: [{ key: 'a', label: 'Steilheit', min: 1, max: 10, step: 1, value: 5 }],
    marks: p => ({ points: [{ x: 5, y: p.a * 5, label: 'Punkt' }], bands: [{ y0: 20, y1: 40, label: 'Band' }], vlines: [{ x: 5 }] }), readout: p => [{ label: 'y bei 5', value: p.a * 5 }] });
  root.appendChild(T.plot.el);
  T.bars = V.bars({ series: [{ name: 'A' }, { name: 'B' }], groups: [{ label: 'Gruppe 1', values: [30, 60] }, { label: 'Gruppe 2', values: [80, 20] }], max: 100, unit: '%', target: { from: 40, to: 60, label: 'Zielbereich' } });
  root.appendChild(T.bars.el);
  T.barsV = V.bars({ items: [{ label: 'Eins', value: 3 }, { label: 'Zwei', value: 7 }, { label: 'Drei', value: 5 }], max: 10, orientation: 'v' });
  root.appendChild(T.barsV.el);
  T.graph = V.graph({ layout: 'circle', directed: true, nodes: ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, label: 'Knoten ' + id, short: id })),
    edges: [{ from: 'A', to: 'B', label: '2' }, { from: 'B', to: 'A' }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }, { from: 'D', to: 'E' }, { from: 'E', to: 'A' }], onSelect: function (id) { T.node = id; } });
  root.appendChild(T.graph.el);
  T.stepper = V.stepper({ steps: [{ title: 'Eins', text: 'Erster Schritt.' }, { title: 'Zwei', text: 'Zweiter Schritt.' }, { title: 'Drei', text: 'Dritter Schritt.' }], onStep: function (i) { T.step = i; } });
  root.appendChild(T.stepper.el);
  root.appendChild(V.figure(V.el('p', null, 'Inhalt'), 'Bildunterschrift', 'Alt-Text'));
  return true;
}

const VIEWPORTS = { desktop: { width: 1280, height: 900 }, phone: { width: 390, height: 844 } };
const problems = [];
let shots = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await launch(chromium);
const runs = [];
for (const skin of skins) { runs.push({ skin, vp: 'desktop', theme: 'light', reduced: false }); runs.push({ skin, vp: 'phone', theme: 'dark', reduced: false }); }
runs.push({ skin: skins[0], vp: 'desktop', theme: 'light', reduced: true });

for (const r of runs) {
  const tag = `${r.skin || 'ohne-skin'}-${r.vp}-${r.theme}${r.reduced ? '-reduziert' : ''}`;
  const ctx = await browser.newContext({ viewport: VIEWPORTS[r.vp], colorScheme: r.theme, reducedMotion: r.reduced ? 'reduce' : 'no-preference', hasTouch: r.vp === 'phone', isMobile: r.vp === 'phone' });
  if (r.skin) await ctx.addInitScript(id => { try { localStorage.setItem('gm:skin', JSON.stringify(id)); } catch (e) { /* egal */ } }, r.skin);
  const page = await ctx.newPage();
  let where = 'Start';
  const at = n => { where = n; if (process.env.VIZ_DEBUG) console.error('step', tag, n); };
  const bad = (kind, text) => problems.push({ tag, where, kind, text: String(text).slice(0, 300) });
  page.on('console', m => { if (m.type() === 'error') bad('Konsolenfehler', m.text()); });
  page.on('pageerror', e => bad('Seitenfehler', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  const expect = (cond, text) => { if (!cond) bad('Verhalten', text); };
  try {
    await page.goto('file://' + path.join(OUT, 'index.html'), { waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.classList.contains('gm-ready'), null, { timeout: 15000 });
    at('Aufbau');
    expect(await page.evaluate(demo), 'Aufbau der Bausteine lieferte nichts');
    await sleep(900);
    const q = sel => page.locator('#viz-test ' + sel);

    at('Regler');
    const before = await q('.gx-plot-svg path.gx-line').first().getAttribute('d');
    await q('.gx-plot input[type=range]').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await sleep(200);
    expect(await q('.gx-plot-svg path.gx-line').first().getAttribute('d') !== before, 'Kurve ändert sich nicht, wenn man den Regler bewegt');
    expect(/6|7/.test(await q('.gx-plot .gx-slider-val').textContent()), 'Reglerwert wird nicht angezeigt');
    await q('.gx-slider >> nth=0').locator('input').focus(); await page.keyboard.press('ArrowRight'); await sleep(100);
    expect((await q('.gx-slider >> nth=0').locator('.gx-slider-val').textContent()).includes('5'), 'Einfacher Regler zeigt den Wert nicht');

    at('Schalter, Auswahl, Knopf');
    await q('.gx-toggle input').focus(); await page.keyboard.press('Space'); await sleep(100);
    expect(await q('.gx-toggle input').isChecked(), 'Schalter lässt sich nicht mit der Tastatur umlegen');
    await q('.gx-choice-opt >> nth=1').locator('label').click(); await sleep(100);
    expect(await page.evaluate(() => __viz.choice.get()) === 'b', 'Auswahl nimmt den Klick nicht an');
    await q('.gx-btn >> nth=0').click(); expect(await page.evaluate(() => __viz.clicked) === 1, 'Knopf löst nichts aus');

    at('Matrix');
    await q('.gx-mx-btn >> nth=0').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter'); await sleep(100);
    expect(JSON.stringify(await page.evaluate(() => __viz.selected)) === '[0,1]', 'Matrix: Pfeiltaste und Enter wählen nicht die Nachbarzelle');
    expect(await q('.gx-mx-cell.is-selected').count() === 1, 'Matrix: genau eine Zelle soll gewählt sein');
    expect(await q('.gx-mx-cell.is-hl').count() === 1, 'Matrix: Hervorhebung fehlt');

    at('Balken');
    await page.evaluate(() => __viz.bars.set([[10, 20], [90, 95]])); await sleep(900);
    const w = await q('.gx-bars >> nth=0').locator('.gx-bar-fill').nth(3).evaluate(n => n.getBoundingClientRect().width / n.parentElement.getBoundingClientRect().width);
    expect(w > 0.9, `Balken wächst nicht auf den neuen Wert (Anteil ${w.toFixed(2)})`);
    const hv = await q('.gx-bars.is-vert .gx-bar-fill >> nth=1').evaluate(n => n.getBoundingClientRect().height / n.parentElement.getBoundingClientRect().height);
    expect(hv > 0.6 && hv < 0.8, `Senkrechter Balken hat falsche Höhe (Anteil ${hv.toFixed(2)}, erwartet 0,7)`);

    at('Netz');
    await q('.gx-node >> nth=1').focus(); await page.keyboard.press('Enter'); await sleep(150);
    expect(await page.evaluate(() => __viz.node) === 'B', 'Netz: Enter wählt den Knoten nicht');
    expect(await q('.gx-node.is-selected').count() === 1, 'Netz: gewählter Knoten ist nicht markiert');
    await page.evaluate(() => __viz.graph.highlight({ nodes: ['A', 'B'], edges: [['A', 'B']] })); await sleep(100);
    expect(await q('.gx-edge.is-hot').count() === 1 && await q('.gx-node.is-dim').count() === 3, 'Netz: Hervorhebung falsch');

    at('Schrittfolge');
    await q('.gx-stepper').locator('.gx-btn >> nth=1').click(); await sleep(100);
    expect(await page.evaluate(() => __viz.step) === 1 && (await q('.gx-step-count').textContent()).includes('2'), 'Stepper: „Weiter“ schaltet nicht um');
    await q('.gx-stepper').locator('.gx-btn >> nth=1').focus(); await page.keyboard.press('ArrowLeft'); await sleep(100);
    expect(await page.evaluate(() => __viz.step) === 0, 'Stepper: Pfeiltaste links geht nicht zurück');

    at('Seite');
    const o = await page.evaluate(() => { const d = document.documentElement; return { sw: d.scrollWidth, cw: d.clientWidth }; });
    expect(o.sw <= o.cw + 1, `horizontales Scrollen (${o.sw} > ${o.cw})`);
    const over = await page.evaluate(() => Array.from(document.querySelectorAll('#viz-test svg, #viz-test table, #viz-test .gx-bars')).filter(n => n.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
    expect(over === 0, `${over} Baustein(e) ragen über den Bildschirmrand`);
    const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll('#viz-test svg[role=img]')).filter(s => !(s.querySelector('title') && s.querySelector('title').textContent.trim())).length);
    expect(unnamed === 0, `${unnamed} SVG ohne Titel (Alt-Text)`);
    await page.locator('#viz-test').screenshot({ path: path.join(SHOTS, `viz-${tag}.png`) }); shots++;
  } catch (e) { bad('Testfehler', e.message); }
  await ctx.close();
  process.stdout.write(`  ${tag}: ${problems.filter(p => p.tag === tag).length ? 'Probleme' : 'ok'}\n`);
}
await browser.close();
console.log(`Bilder: ${shots} in ${SHOTS}`);
if (problems.length) {
  console.log(`\n✗ ${problems.length} Meldung(en):`);
  const seen = new Set();
  for (const p of problems) { const k = `${p.kind}|${p.where}|${p.text}`; if (seen.has(k)) continue; seen.add(k); console.log(`  [${p.tag}] ${p.where}: ${p.kind}: ${p.text}`); }
  process.exit(1);
}
console.log('✓ Baukasten-Test bestanden.');

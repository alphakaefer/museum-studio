#!/usr/bin/env node
// Test: onboarding.html (im Browser durchgeklickt) erzeugt denselben Auftrag wie das Terminal-Onboarding (--config).
//   PLAYWRIGHT_MODULE_DIR=<ordner mit playwright> node tools/onboarding-test.mjs [--shots=<ordner>]
// Legt kurz ein Testpaket packs/zz-onbtest-<pid>/ an und löscht es wieder. Braucht Playwright mit Chromium (siehe npm run doctor).
// Prüft außerdem: Seite aktuell (Generator --check), keine Netzwerkzugriffe, Fehlermeldungen im Formular, hell/dunkel, Handy-Breite ohne Querscroll.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { ROOT } from './check-lib.mjs';
import { loadPlaywright, launch } from './pw-lib.mjs';

const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
const SHOTS = typeof flags.shots === 'string' ? path.resolve(flags.shots) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
let failed = 0;
const ok = (c, m) => { if (c) console.log('✓ ' + m); else { failed++; console.log('✗ ' + m); } };

const SCENARIOS = {
  minimal: { cfg: { name: 'Mini' }, ui: { name: 'Mini' } },
  voll: {
    cfg: { name: 'Quantenwelt', untertitel: 'Was ist wirklich?', thema: 'Quantenphysik für Neugierige. Nicht dabei: Mathematik.', zielgruppe: 'gemischt', sprache: 'en', anrede: 'Sie', geschichte: 'ja', groesse: 'umfassend', reisenamen: ['Welle oder Teilchen?', 'Messung, und was dann?'], skin: 'quelltext', skinWahl: false, anschauung: 'zentral', heikel: ['gesundheit', 'gewalt'], quellen: ['offen', 'eigene', 'domain'], materialHost: 'https://www.beispiel.de/', spielplan: 'ja', zugang: 'freischalten', urheber: 'Karl Hosang', lizenz: 'cc0-1.0', impressumUrl: 'https://www.beispiel.de/impressum' },
    ui: { name: 'Quantenwelt', untertitel: 'Was ist wirklich?', thema: 'Quantenphysik für Neugierige. Nicht dabei: Mathematik.', zielgruppe: 'gemischt', sprache: 'en', anrede: 'Sie', geschichte: 'ja', groesse: 'umfassend', reisenamen: 'Welle oder Teilchen?; Messung, und was dann?', skin: 'quelltext', skinWahl: false, anschauung: 'zentral', heikel: ['gesundheit', 'gewalt'], quellen: ['offen', 'eigene', 'domain'], materialHost: 'https://www.beispiel.de/', spielplan: 'ja', zugang: 'freischalten', urheber: 'Karl Hosang', lizenz: 'cc0-1.0', impressumUrl: 'https://www.beispiel.de/impressum' }
  },
  // Spielplan ja bei einem Gesundheitsthema, Zugang nicht angefasst: der Standard folgt dem heiklen Thema (frei als Standard), in Terminal und Seite gleich
  gesund: { cfg: { name: 'Gesund', heikel: ['gesundheit'], spielplan: 'ja' }, ui: { name: 'Gesund', heikel: ['gesundheit'], spielplan: 'ja' } },
  // Spielplan ja ohne heikles Thema: Standard mit Freischalten
  lernen: { cfg: { name: 'Lernen', spielplan: 'ja' }, ui: { name: 'Lernen', spielplan: 'ja' } },
  nein: { cfg: { name: 'Ohne Spiel', spielplan: 'nein' }, ui: { name: 'Ohne Spiel', spielplan: 'nein' } }
};

// Was der Spielplan-Teil des Auftrags je Szenario enthalten muss (md: Textstücke, nicht: darf nicht vorkommen)
const WIRKUNG = {
  minimal: { md: ['## Spielplan', 'Später entscheiden', 'Richte keinen ein'], nicht: ['Schritt 6b'], spielplan: 'spaeter', zugang: '', spielFrei: false, standard: ['spielplan'] },
  voll: { md: ['Ja, einrichten', 'Mit Freischalten', 'Schritt 6b', 'spielplan-aus-plan.mjs', '„Ich kann …“-Sätze'], spielplan: 'ja', zugang: 'freischalten', spielFrei: false, gewaehlt: ['spielplan', 'zugang'] },
  gesund: { md: ['Ja, einrichten', 'Frei als Standard', '"spielFrei": true', 'Schritt 6b'], spielplan: 'ja', zugang: 'frei', spielFrei: true, gewaehlt: ['spielplan'], standard: ['zugang'] },
  lernen: { md: ['Mit Freischalten', 'Schritt 6b'], nicht: ['"spielFrei": true'], spielplan: 'ja', zugang: 'freischalten', spielFrei: false, gewaehlt: ['spielplan'], standard: ['zugang'] },
  nein: { md: ['## Spielplan', 'keinen** Spielplan'], nicht: ['Schritt 6b', 'Frei als Standard', 'Mit Freischalten'], spielplan: 'nein', zugang: '', spielFrei: false, gewaehlt: ['spielplan'] }
};

function terminal(cfg, id) {
  const file = path.join(ROOT, 'packs', `.onbtest-${process.pid}.json`);
  fs.writeFileSync(file, JSON.stringify(Object.assign({}, cfg, { id })));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'onboarding.mjs'), '--skip-doctor', '--yes', '--config=' + file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const dir = path.join(ROOT, 'packs', id);
    return { md: fs.readFileSync(path.join(dir, 'BRIEFING.md'), 'utf8'), json: fs.readFileSync(path.join(dir, 'BRIEFING.json'), 'utf8'), pack: JSON.parse(fs.readFileSync(path.join(dir, 'pack.json'), 'utf8')), arbeitsstand: fs.readFileSync(path.join(dir, 'ARBEITSSTAND.md'), 'utf8') };
  } finally { fs.rmSync(file, { force: true }); fs.rmSync(path.join(ROOT, 'packs', id), { recursive: true, force: true }); }
}

async function fillBlock(page, ui, keys) {
  for (const k of keys) {
    if (!(k in ui)) continue;
    const v = ui[k];
    const q = await page.evaluate(key => { const w = document.querySelector(`.q[data-key="${key}"]`); return { radios: !!w.querySelector('input[type=radio]'), checks: !!w.querySelector('input[type=checkbox]'), select: !!w.querySelector('select') }; }, k);
    if (q.select) await page.selectOption(`#f-${k}`, v);
    else if (q.radios) await page.locator(`.q[data-key="${k}"] input[value="${typeof v === 'boolean' ? (v ? 'ja' : 'nein') : v}"]`).check({ force: true });
    else if (q.checks) {
      const all = await page.locator(`.q[data-key="${k}"] input[type=checkbox]`).all();
      for (const c of all) { const val = await c.getAttribute('value'); const want = v.includes(val); if ((await c.isChecked()) !== want) await c.click({ force: true }); }
      for (const val of v) await page.locator(`.q[data-key="${k}"] input[value="${val}"]`).check({ force: true });
    } else await page.fill(`#f-${k}`, v);
  }
}

const BLOCKS = [['name', 'id', 'untertitel', 'thema'], ['zielgruppe', 'sprache', 'anrede'], ['geschichte', 'groesse', 'reisenamen'], ['skin', 'skinWahl', 'anschauung'], ['heikel', 'quellen', 'materialHost'], ['spielplan', 'zugang'], ['urheber', 'lizenz', 'impressumUrl']];

async function runUi(page, ui, shotName) {
  const idBase = ui.id;
  await page.goto('file://' + path.join(ROOT, 'onboarding.html'));
  await page.click('#start');
  for (let i = 0; i < BLOCKS.length; i++) {
    await fillBlock(page, ui, BLOCKS[i]);
    if (SHOTS && shotName === 'voll' && (i === 0 || i === 4 || i === 5)) await page.screenshot({ path: path.join(SHOTS, `schritt-${i + 1}.png`), fullPage: true });
    await page.click('#next');
  }
  if (SHOTS && shotName === 'voll') await page.screenshot({ path: path.join(SHOTS, 'zusammenfassung.png'), fullPage: true });
  await page.click('#gen');
  const get = async k => page.inputValue('#r-' + k);
  if (SHOTS && shotName === 'voll') await page.screenshot({ path: path.join(SHOTS, 'ergebnis.png'), fullPage: true });
  return { md: await get('md'), json: await get('json'), prompt: await get('prompt') };
}

const { chromium } = loadPlaywright('Aufruf: PLAYWRIGHT_MODULE_DIR=<ordner> node tools/onboarding-test.mjs');
const browser = await launch(chromium);
try {
  try { execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-onboarding-html.mjs'), '--check'], { stdio: 'pipe' }); ok(true, 'onboarding.html ist aktuell (Generator --check)'); }
  catch (e) { ok(false, 'onboarding.html ist nicht aktuell: node tools/build-onboarding-html.mjs'); }
  const html = fs.readFileSync(path.join(ROOT, 'onboarding.html'), 'utf8');
  ok(!/(src|href)\s*=\s*["']https?:/i.test(html) && !/@import|url\(\s*["']?https?:/i.test(html), 'keine externen Ressourcen in der Seite');

  const ctxB = await browser.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  const requests = [];
  ctxB.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  for (const [name, sc] of Object.entries(SCENARIOS)) {
    const page = await ctxB.newPage();
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    const id = `zz-onbtest-${process.pid}-${name}`;
    const t = terminal(sc.cfg, id);
    const u = await runUi(page, Object.assign({}, sc.ui, { id }), name);
    const normUi = s => s.split(id).join('<ID>');
    ok(normUi(u.md) === t.md.split(id).join('<ID>'), `[${name}] BRIEFING.md: Browser = Terminal (${u.md.length} Zeichen)`);
    ok(normUi(u.json) === t.json.split(id).join('<ID>'), `[${name}] BRIEFING.json: Browser = Terminal`);
    ok(u.prompt.includes(u.md.trim()) && u.prompt.includes('AGENTS.md'), `[${name}] Prompt enthält das Briefing und verweist auf AGENTS.md`);
    ok(errors.length === 0, `[${name}] keine JavaScript-Fehler${errors.length ? ': ' + errors[0] : ''}`);
    const w = WIRKUNG[name];
    if (w) {
      const fehlt = w.md.filter(x => !t.md.includes(x)), zuviel = (w.nicht || []).filter(x => t.md.includes(x));
      ok(!fehlt.length && !zuviel.length, `[${name}] Briefing: Spielplan-Abschnitt passt${fehlt.length ? ' (fehlt: ' + fehlt.join(' | ') + ')' : ''}${zuviel.length ? ' (zuviel: ' + zuviel.join(' | ') + ')' : ''}`);
      const j = JSON.parse(t.json);
      ok(j.spielplan === w.spielplan && j.zugang === w.zugang, `[${name}] BRIEFING.json: spielplan „${j.spielplan}“, zugang „${j.zugang}“`);
      ok((t.pack.spielFrei === true) === w.spielFrei && (w.spielFrei || !('spielFrei' in t.pack)), `[${name}] pack.json: spielFrei ${w.spielFrei ? 'gesetzt (frei als Standard)' : 'nicht gesetzt'}`);
      ok((w.standard || []).every(k => j.standardUebernommen.includes(k)) && (w.gewaehlt || []).every(k => !j.standardUebernommen.includes(k)), `[${name}] Standardwerte und ausdrückliche Wahl richtig getrennt`);
    }
    await page.close();
  }

  // Beispielkonfigurationen (docs/beispiele) laden mit dem Terminal-Werkzeug und tragen das Spielplan-Feld
  for (const [datei, erwartet] of [['tschechisch.json', { md: 'Mit Freischalten', frei: false }], ['adhs.json', { md: 'Frei als Standard', frei: true }]]) {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'beispiele', datei), 'utf8'));
    const t = terminal(cfg, `zz-onbtest-${process.pid}-${datei.replace('.json', '')}`);
    ok(cfg.spielplan === 'ja' && t.md.includes('## Spielplan') && t.md.includes(erwartet.md) && t.md.includes('Schritt 6b') && (t.pack.spielFrei === true) === erwartet.frei,
      `docs/beispiele/${datei}: lädt, Spielplan „ja“, Zugang „${erwartet.md}“${erwartet.frei ? ', pack.json spielFrei' : ''}`);
  }
  // Ein Zugang ohne Spielplan „ja“ wird nicht beachtet
  { const t = terminal({ name: 'Zugang ohne Spiel', spielplan: 'nein', zugang: 'frei' }, `zz-onbtest-${process.pid}-zugang`);
    ok(JSON.parse(t.json).zugang === '' && !('spielFrei' in t.pack) && !t.md.includes('Frei als Standard'), 'Feld „zugang“ ohne Spielplan „ja“ wird ignoriert'); }
  // Ein Paket mit Spielplan „später“ hat einen Hinweis in ARBEITSSTAND.md, bei „ja“ einen offenen Punkt
  { const a = terminal({ name: 'Hinweis' }, `zz-onbtest-${process.pid}-hinweis`), b = terminal({ name: 'Hinweis ja', spielplan: 'ja' }, `zz-onbtest-${process.pid}-hinweisja`);
    ok(a.arbeitsstand.includes('Spielplan: im Abschlussbericht darauf hinweisen') && b.arbeitsstand.includes('Spielplan einrichten (Schritt 6b'), 'ARBEITSSTAND.md: Hinweis bei „später“, offener Punkt bei „ja“'); }

  // Fehlerfälle und Bedienung
  const p = await ctxB.newPage();
  await p.goto('file://' + path.join(ROOT, 'onboarding.html'));
  await p.click('#start');
  await p.fill('#f-name', 'x'.repeat(90)); await p.click('#next');
  ok((await p.textContent('#e-name')).includes('zu lang') && (await p.textContent('#st-0')) !== null, 'Name zu lang: Fehlermeldung, kein Weiter');
  await p.fill('#f-name', 'Spieltheorie mit sehr langem Namen hier'); await p.fill('#f-id', 'Ungültig Ä'); await p.click('#next');
  ok((await p.textContent('#e-id')).includes('geht nicht'), 'ungültige ID: Fehlermeldung');
  await p.fill('#f-id', ''); await p.click('#next');
  ok((await p.textContent('#plabel')).includes('Schritt 2 von 8'), 'Fortschritt: Schritt 2 von 8 nach gültigem Block');
  ok((await p.textContent('#pmsg')).includes('Noch 6 Schritte'), 'Fortschritt: „Noch 6 Schritte“');
  await p.click('#back');
  ok((await p.inputValue('#f-name')).startsWith('Spieltheorie'), 'Zurück behält die Eingaben');
  await p.click('#next'); await p.click('#next'); await p.click('#next'); await p.click('#next');
  await p.locator('.q[data-key="quellen"] input[value="offen"]').uncheck({ force: true });
  await p.click('#next');
  ok((await p.textContent('#e-quellen')).includes('mindestens eine'), 'Quellen leer: Fehlermeldung');
  await p.locator('.q[data-key="quellen"] input[value="domain"]').check({ force: true });
  ok(await p.locator('.q[data-key="materialHost"]').isVisible(), 'Nachfrage Domain erscheint');
  await p.fill('#f-materialHost', 'www.beispiel.de'); await p.click('#next');
  ok((await p.textContent('#e-materialHost')).includes('https://'), 'ungültige Domain: Fehlermeldung');
  await p.fill('#f-materialHost', 'https://www.beispiel.de/'); await p.click('#next');
  // Spielgefühl: Standard „später“, die Nachfrage Zugang erscheint erst bei „Ja“, ihr Standard folgt dem heiklen Thema
  const gewaehlt = async k => p.locator(`.q[data-key="${k}"] input:checked`).getAttribute('value');
  ok(await gewaehlt('spielplan') === 'spaeter' && await p.locator('.q[data-key="zugang"]').isHidden(), 'Spielplan: Standard „später“, Zugang verborgen');
  ok(await p.locator('.q[data-key="spielplan"] input[type=radio]').count() === 3, 'Spielplan: ja, später, nein zur Wahl');
  await p.locator('.q[data-key="spielplan"] input[value="ja"]').check({ force: true });
  ok(await p.locator('.q[data-key="zugang"]').isVisible() && await gewaehlt('zugang') === 'freischalten', 'Spielplan „Ja“: Zugang erscheint, Standard „mit Freischalten“ (kein heikles Thema)');
  await p.click('#back'); await p.locator('.q[data-key="heikel"] input[value="gesundheit"]').check({ force: true }); await p.click('#next');
  ok(await gewaehlt('zugang') === 'frei', 'Heikles Thema Gesundheit: Standard des Zugangs wechselt zu „frei als Standard“');
  await p.locator('.q[data-key="zugang"] input[value="freischalten"]').check({ force: true });
  await p.click('#back'); await p.locator('.q[data-key="heikel"] input[value="gewalt"]').check({ force: true }); await p.click('#next');
  ok(await gewaehlt('zugang') === 'freischalten', 'Ausdrücklich gewählter Zugang bleibt, auch wenn sich das heikle Thema ändert');
  await p.locator('.q[data-key="spielplan"] input[value="nein"]').check({ force: true });
  ok(await p.locator('.q[data-key="zugang"]').isHidden(), 'Spielplan „Nein“: Zugang wieder verborgen');
  await p.click('#next');
  ok(await p.locator('.q[data-key="lizenz"] input[type=radio]').count() === 3, 'Lizenz: genau drei freie Lizenzen zur Wahl');
  const lic = await p.locator('.q[data-key="lizenz"] label.opt strong').allTextContents();
  ok(JSON.stringify(lic) === JSON.stringify(['CC BY 4.0', 'CC BY-SA 4.0', 'CC0 1.0']), `Lizenzliste: ${lic.join(', ')}`);
  await p.close();

  // Kopieren/Speichern und Handy, dunkel
  const m = await browser.newContext({ viewport: { width: 390, height: 780 }, acceptDownloads: true, colorScheme: 'dark', isMobile: true, hasTouch: true });
  const mp = await m.newPage();
  const u = await runUi(mp, Object.assign({}, SCENARIOS.voll.ui, { id: 'handy-test' }), 'handy');
  const [dl] = await Promise.all([mp.waitForEvent('download'), mp.click('#card-json button:has-text("Als Datei speichern")')]);
  ok(dl.suggestedFilename() === 'BRIEFING.json', `Speichern: Datei „${dl.suggestedFilename()}“`);
  const saved = fs.readFileSync(await dl.path(), 'utf8'); ok(saved === u.json, 'gespeicherte Datei = angezeigter Text');
  await mp.click('#card-md button:has-text("Kopieren")'); await mp.waitForTimeout(500);
  const st = await mp.textContent('#card-md .status'); ok(/Kopiert|markiert/.test(st), `Kopieren (file://-Rückfall): „${st.slice(0, 60)}…“`);
  await mp.click('#card-md button:has-text("Text markieren")');
  const selLen = await mp.evaluate(() => { const t = document.getElementById('r-md'); return t.selectionEnd - t.selectionStart; });
  ok(selLen === u.md.length, 'Text markieren markiert den ganzen Text');
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow <= 0, `Handy-Breite: kein Querscroll (Überstand ${overflow}px)`);
  const dark = await mp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(dark === 'rgb(14, 20, 32)', `dunkles Schema folgt dem System (${dark})`);
  if (SHOTS) { await mp.screenshot({ path: path.join(SHOTS, 'handy-ergebnis-dunkel.png'), fullPage: false }); await mp.evaluate(() => window.scrollTo(0, 0)); }
  await m.close();
  ok(requests.length === 0, 'keine Netzwerkzugriffe' + (requests.length ? ': ' + requests[0] : ''));
} finally { await browser.close(); }
console.log(failed ? `\n✗ ${failed} Prüfung(en) fehlgeschlagen.` : '\n✓ Alle Prüfungen bestanden.');
process.exit(failed ? 1 : 0);

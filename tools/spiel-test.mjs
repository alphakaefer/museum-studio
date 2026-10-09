#!/usr/bin/env node
// Museum Studio – Test der Spielplan-Anbindung im Browser (engine/js/spiel.js und die Stellen in core.js, journey.js, app.js, search.js).
//
//   node tools/spiel-test.mjs [--paket=<paket>] [--ohne=<paket>] [--schnell] [--shots=<ordner>] [--behalte]
//
// --paket: das Paket, aus dem das Testpaket entsteht (Standard: das Paket mit den meisten Exponaten und Mythos-Karten unter packs/, mit mindestens zwei Reisen).
// --ohne:  ein Paket ohne Spielplan für die letzte Prüfung (Standard _vorlage).  --behalte: den Temp-Ordner nicht löschen.
//
// Baut aus dem Paket ein Testpaket (in einem Temp-Ordner, das Paket selbst bleibt unberührt): das Skelett aus tools/spielplan-aus-plan.mjs
// plus Regeln, die ohne feste Ids aus dem Skelett gebildet werden (zweite und dritte Reise gesperrt, ein Werkzeug, eine Fähigkeit, eine
// gesperrte Station, eine Pause als Alternative, Rhythmus). Geprüft wird in Chromium (Playwright, siehe tools/pw-lib.mjs):
//   Eingang mit genau einer Aufgabe, gesperrte Reisen angedeutet, Hinweisbild bei Adresse, Suche, Ereignisse (erkundet, geschafft, Weiter,
//   Mythos-Karte, Exponat, Einsatz, Teilen), Enthüllung (nicht blockierend, aria-live, Weiter/Ansehen), Freier Zugang, Wiedersehen und
//   Verwitterung ohne Strafton, Speicher nur lokal, Übernahme alter Besuche, Zurücksetzen, Darstellung in allen Skins (hell/dunkel,
//   Handy/Desktop, Kontrast, kein seitliches Scrollen) und: ein Paket ohne Spielplan (--ohne) bleibt, wie es war.
// --schnell: nur der Skin halle für die Darstellung.  Ohne Playwright endet das Programm mit Hinweis (Exit-Code 2); Exit-Code 1 bei Fehlern.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { loadPlaywright, launch } from './pw-lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
function waehlePaket() {
  const dir = path.join(ROOT, 'packs');
  let beste = null;
  for (const n of fs.readdirSync(dir).filter(n => !n.startsWith('_') && fs.existsSync(path.join(dir, n, 'plan.json'))).sort()) {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, n, 'plan.json'), 'utf8'));
      if ((p.journeys || []).length < 2) continue;
      const wert = p.stations.filter(s => s.exhibit).length * 2 + p.stations.filter(s => s.kind === 'mythos').length;
      if (!beste || wert > beste.wert) beste = { n, wert };
    } catch (e) { /* kein lesbarer Plan: nicht geeignet */ }
  }
  return beste ? beste.n : '_vorlage';
}
const PAKET = typeof args.paket === 'string' ? args.paket : waehlePaket();
const OHNE = typeof args.ohne === 'string' ? args.ohne : '_vorlage';
const SHOTS = typeof args.shots === 'string' ? path.resolve(args.shots) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const { chromium } = loadPlaywright('Dann:  PLAYWRIGHT_MODULE_DIR=~/pw node tools/spiel-test.mjs');

/* ------------------------------------------------------------------ *
 * Testpaket bauen
 * ------------------------------------------------------------------ */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'spiel-test-'));
const sh = (...a) => execFileSync('node', a, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });

function baueTestpaket() {
  const dst = path.join(TMP, 'pack', PAKET);
  fs.cpSync(path.join(ROOT, 'packs', PAKET), dst, { recursive: true });
  for (const n of ['spielplan.json', 'spielplan-kern.yaml', 'spielplan-zuordnung']) fs.rmSync(path.join(dst, n), { recursive: true, force: true });
  const skel = path.join(TMP, 'skelett.json');
  sh('tools/spielplan-aus-plan.mjs', PAKET, '--skelett', '--out=' + skel);
  const sp = JSON.parse(fs.readFileSync(skel, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(path.join(dst, 'plan.json'), 'utf8'));
  const eps = sp.einheiten.filter(u => u.art === 'episode');
  if (eps.length < 2) throw new Error(`Das Paket „${PAKET}“ hat weniger als zwei Reisen; der Test braucht mindestens zwei (--paket=…).`);
  const inEp = id => sp.einheiten.filter(u => u.art === 'inhalt' && (Array.isArray(u.in) ? u.in.includes(id) : u.in === id));
  const [e0, e1, e2] = eps.map(u => u.id);
  const s0 = inEp(e0);
  if (s0.length < 4) throw new Error('Die erste Reise hat weniger als vier Stationen.');
  if (e2) eps[2].sichtbar = 'verborgen';                  // die dritte Reise bleibt ungenannt, bis sie aufgeht
  eps[0].etappe = 'onboarding';
  eps[0].auftakt = 'Du betrittst die erste Reise. Es ist ruhig hier, und niemand hetzt dich.';
  eps[0].abschluss = 'Die erste Reise liegt hinter dir. Die Türen nebenan stehen jetzt offen.';
  s0.slice(0, 2).forEach(u => { u.gewicht = 'kritisch'; });
  sp.einheiten.push({ id: 'skill/test-skill', art: 'skill', name: 'Hinschauen', kann: 'Ich kann genauer hinschauen, bevor ich urteile.' });
  s0.slice(0, 3).forEach(u => { u.uebt = ['skill/test-skill']; });
  const stationOf = u => u.id.split('/')[1];
  const kindOf = id => ((plan.stations.find(s => s.id === id) || {}).kind);
  const quest = sp.einheiten.find(u => u.art === 'quest' && s0.some(x => stationOf(x) === u.id.split('/')[1].replace(/-mythos$/, '')));
  const erl = sp.einheiten.find(u => u.art === 'erlebnis');
  const ort = erl ? erl.id : s0[0].id;
  sp.einheiten.push({ id: 'werkzeug/test-werkzeug', art: 'werkzeug', name: 'Prüfstein', sorte: 'technik', adresse: '#/reisepass', einsatz: [ort] });
  const sperr = s0[s0.length - 1];
  sp.regeln = [];
  sp.regeln.push({ id: 'r-zweite-reise', schaltet: [e1], wenn: { art: 'inhalt', in: e0, stufe: 2, mindestens: 2 }, enthuellung: 'Zwei Stationen sind geschafft. Eine neue Reise geht für dich auf.' });
  if (e2) sp.regeln.push({ id: 'r-dritte-reise', schaltet: [e2], wenn: { eine: [{ einheit: e1, stufe: 2 }, { alle: [{ einheit: s0[0].id, stufe: 2 }, { wartezeit: { einheit: s0[0].id, stufe: 2, stunden: 3 } }] }] }, enthuellung: 'Die dritte Reise öffnet sich, wenn du magst.' });
  sp.regeln.push({ id: 'r-werkzeug', schaltet: ['werkzeug/test-werkzeug'], wenn: { einheit: s0[1].id, stufe: 2 }, enthuellung: 'Du hast einen Prüfstein gefunden. Er passt an manchen Orten.' });
  if (quest) sp.regeln.push({ id: 'r-station', schaltet: [sperr.id], wenn: { einheit: quest.id, stufe: 2 }, enthuellung: 'Diese Station war verschlossen. Jetzt steht sie offen.' });
  sp.rhythmus = { takt: { laenge: 'woche', beginn: 'erstes-ereignis' }, wiederkehr: { abstand_tage: [2, 7], fuer: { art: 'inhalt' } }, verfall_tage: 30 };
  sp.stufen = { anteil: '2/3', bis: 2 };
  fs.writeFileSync(path.join(dst, 'spielplan.json'), JSON.stringify(sp, null, 2));
  const pruef = sh('tools/check-spielplan.mjs', path.join(dst, 'spielplan.json'));
  if (!/Spielplan in Ordnung/.test(pruef)) throw new Error('Das Testpaket besteht die Spielplan-Prüfung nicht:\n' + pruef);
  const out = path.join(TMP, 'dist', 'mit');
  sh('tools/build.mjs', dst, '--skins=all', '--out=' + out);
  const jids = plan.journeys.map(j => j.id);
  const stations = plan.stations;
  const myth = quest ? quest.id.split('/')[1].replace(/-mythos$/, '') : null;
  return {
    dst, out, e0, e1, e2: e2 || null, j0: e0.split('/')[1], j1: e1.split('/')[1], j2: e2 ? e2.split('/')[1] : null,
    s0: s0.map(stationOf), erste: stationOf(s0[0]), zweite: stationOf(s0[1]), dritte: stationOf(s0[2]), sperr: quest ? stationOf(sperr) : null,
    quest: quest ? quest.id : null, myth, erlebnis: erl ? erl.id : null, exStation: erl ? (stations.find(s => s.exhibit === erl.id.split('/')[1]) || {}).id : null,
    kreuzung: e2 ? (plan.stations.find(st => (st.journeys || []).includes(e0.split('/')[1]) && (st.journeys || []).includes(e2.split('/')[1])) || {}).id || null : null,
    jids, kindOf, skins: fs.readdirSync(path.join(out, 'skins')).sort()
  };
}

/* ------------------------------------------------------------------ *
 * Läufer
 * ------------------------------------------------------------------ */

let ok = 0, schlecht = 0, uebersprungen = 0;
const fehlerListe = [];
async function t(name, fn) {
  try {
    const r = await fn();
    if (r === 'skip') { uebersprungen++; console.log('- ' + name + ' (übersprungen)'); return; }
    ok++; console.log('✓ ' + name);
  } catch (e) { schlecht++; fehlerListe.push(name + ': ' + e.message); console.log('✗ ' + name + '\n    ' + String(e.message).split('\n').join('\n    ')); }
}
const wahr = (c, msg) => { if (!c) throw new Error(msg); };
const gleich = (a, b, msg) => { if (a !== b) throw new Error(`${msg}: erwartet ${JSON.stringify(b)}, erhalten ${JSON.stringify(a)}`); };
const VERBOTEN = /\b(Serie|Serien|Streak|verpasst|Rückstand|Punkte)\b/i;

const browser = await launch(chromium);
async function seite(dist, { viewport = { width: 1280, height: 800 }, theme = 'light', skin = null, reduced = false, heute = '2026-10-10T10:00:00Z', verweil = 0.02, storage = null, kein_frei = true } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme: theme, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: viewport.width < 600, isMobile: viewport.width < 600 });
  await ctx.addInitScript(o => {
    if (o.heute) window.__SP_HEUTE = o.heute;
    window.__SP_VERWEIL = o.verweil;
    try {
      if (o.skin) localStorage.setItem('gm:skin', JSON.stringify(o.skin));
      localStorage.setItem('gm:theme', JSON.stringify(o.theme));
      if (o.storage) for (const k of Object.keys(o.storage)) localStorage.setItem(k, o.storage[k]);
    } catch (e) { /* egal */ }
  }, { heute, verweil, skin, theme, storage });
  const page = await ctx.newPage();
  const logs = [], anfragen = [];
  page.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  page.on('request', r => anfragen.push(r.url()));
  await page.goto('file://' + dist + '/index.html');
  await page.waitForFunction(() => document.documentElement.classList.contains('gm-ready'), null, { timeout: 8000 });
  await page.waitForTimeout(350);
  return { ctx, page, logs, anfragen };
}
const geheZu = async (page, hash, ms = 700) => { await page.evaluate(h => { location.hash = h; }, hash); await page.waitForTimeout(ms); };
const liesBisEnde = async page => { await page.evaluate(() => { const n = document.querySelector('.gm-reise-scroll') && !document.getElementById('reise').hidden ? document.querySelector('.gm-reise-scroll') : document.querySelector('.gm-panel-scroll'); if (n) n.scrollTop = n.scrollHeight; }); };
const warteStufe = (page, uid, n = 2, ms = 9000) => page.waitForFunction(([u, s]) => { const e = MUSEUM.spiel.einheit(u); return e && e.stufe >= s; }, [uid, n], { timeout: ms });
const da = (page, sel) => page.evaluate(s => Array.from(document.querySelectorAll(s)).some(n => n.getClientRects().length > 0), sel);
const einheit = (page, uid) => page.evaluate(u => MUSEUM.spiel.einheit(u), uid);
const ereignisse = page => page.evaluate(() => { const k = Object.keys(localStorage).find(x => /^gm:sp:.*:ereignisse$/.test(x)); return k ? JSON.parse(localStorage.getItem(k)) : []; });
const sichtbarerText = (page, sel) => page.evaluate(s => Array.from(document.querySelectorAll(s)).filter(n => n.getClientRects().length).map(n => n.innerText).join('\n'), sel);
const schliesseKarten = page => page.evaluate(() => document.querySelectorAll('.gm-spiel-moment').forEach(k => Array.from(k.querySelectorAll('button')).find(b => b.textContent === 'Weiter').click()));
async function foto(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

/** Kontrast aller Texte unter den Spielplan-Blöcken (Farbe gegen den gemischten Hintergrund). Gibt Verstöße zurück. */
const kontrast = (page, wurzeln) => page.evaluate(sel => {
  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  cv.canvas.width = cv.canvas.height = 1;
  const parse = c => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (f, b) => { const a = f[3] + b[3] * (1 - f[3]); return a === 0 ? [0, 0, 0, 0] : [0, 1, 2].map(i => (f[i] * f[3] + b[i] * b[3] * (1 - f[3])) / a).concat(a); };
  const lum = c => { const l = c.slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
  const bgOf = n => { const chain = []; for (let x = n; x; x = x.parentElement) { const bg = parse(getComputedStyle(x).backgroundColor); chain.push(bg); if (bg[3] >= 1) break; } let acc = [255, 255, 255, 1]; for (let i = chain.length - 1; i >= 0; i--) acc = over(chain[i], acc); return acc; };
  const bad = [];
  document.querySelectorAll(sel).forEach(root => {
    if (!root.getClientRects().length) return;
    root.querySelectorAll('*').forEach(n => {
      if (!n.getClientRects().length) return;
      const hasText = Array.from(n.childNodes).some(c => c.nodeType === 3 && c.textContent.trim());
      if (!hasText) return;
      const cs = getComputedStyle(n);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) return;
      const bg = bgOf(n), fg0 = parse(cs.color), fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * (+cs.opacity || 1)], bg);
      const l1 = lum(fg), l2 = lum(bg), r = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const px = parseFloat(cs.fontSize), fett = +cs.fontWeight >= 700, gross = px >= 24 || (px >= 18.66 && fett);
      if (r < (gross ? 3 : 4.5)) bad.push(`${n.className || n.tagName}: ${r.toFixed(2)}:1 („${n.textContent.trim().slice(0, 30)}“)`);
    });
  });
  return bad;
}, wurzeln);

/* ------------------------------------------------------------------ *
 * Die Prüfungen
 * ------------------------------------------------------------------ */

console.log(`Spielplan-Anbindung: Testpaket aus „${PAKET}“ (Temp: ${TMP})`);
const F = baueTestpaket();
const DIST = F.out;
console.log(`  Reisen ${F.j0}${F.j1 ? ', ' + F.j1 : ''}${F.j2 ? ', ' + F.j2 : ''}; Mythos-Karte ${F.quest || '–'}; Exponat ${F.erlebnis || '–'}; gesperrte Station ${F.sperr || '–'}\n`);

await t('1 Eingang: der Spielplan ist aktiv, nichts wirft, die Seite sendet nichts', async () => {
  const { ctx, page, logs, anfragen } = await seite(DIST);
  gleich(await page.evaluate(() => !!(MUSEUM.spiel && MUSEUM.spiel.aktiv)), true, 'MUSEUM.spiel.aktiv');
  for (const f of ['aktiv', 'stand', 'melde', 'bei', 'zugang', 'naechsteAufgabe', 'setFrei']) wahr(await page.evaluate(k => k in MUSEUM.spiel, f), 'MUSEUM.spiel.' + f + ' fehlt');
  gleich(await page.evaluate(() => MUSEUM.spiel.frei), false, 'frei am Anfang');
  await geheZu(page, '#/station/' + F.erste); await geheZu(page, '#/reise/' + F.j0);
  gleich(logs.join('; '), '', 'Konsolenfehler');
  const fremd = anfragen.filter(u => !/^(file|data|blob|about):/.test(u));
  gleich(fremd.join(', '), '', 'Anfragen ins Netz');
  const schluessel = await page.evaluate(() => Object.keys(localStorage));
  wahr(schluessel.every(k => k.startsWith('gm:')), 'Speicherschlüssel ohne Präfix gm: ' + schluessel.join(','));
  wahr(!(await page.evaluate(() => /spielplan-adapter/.test(Array.from(document.scripts).map(s => s.src).join()))), 'der Adapter ist eingebunden');
  await ctx.close();
});

await t('2 Eingang: genau eine nächste Aufgabe, mit dem Satz, was sie bringt, ohne Statistik', async () => {
  const { ctx, page } = await seite(DIST);
  const n = await page.evaluate(() => document.querySelectorAll('.gm-spiel-weiter').length);
  gleich(n, 1, 'Blöcke mit der nächsten Aufgabe');
  gleich(await page.evaluate(() => document.querySelectorAll('.gm-spiel-weiter .gm-spiel-t').length), 1, 'Aufgaben im Block');
  const a = await page.evaluate(() => MUSEUM.spiel.naechsteAufgabe());
  wahr(a && a.text && a.bringt, 'keine Aufgabe oder ohne „bringt“');
  gleich(await page.evaluate(() => document.querySelector('.gm-spiel-weiter .gm-spiel-t').textContent), a.text, 'Text der Aufgabe');
  const b = await page.evaluate(() => document.querySelector('.gm-spiel-weiter .gm-spiel-b').textContent);
  wahr(b === a.bringt || (a.noch_einheiten === 1 && /^Danach geht /.test(b)), 'Satz, was sie bringt: ' + b + ' (Kern: ' + a.bringt + ')');
  wahr(!/Noch \d+ Schritte/.test(b) || a.noch_einheiten > 1 || a.noch === 1, 'der Satz zählt Stufen statt Einheiten: ' + b);
  gleich(await page.evaluate(() => document.querySelector('.gm-spiel-weiter .gm-spiel-k').textContent), 'Dein Einstieg', 'Kicker beim ersten Besuch');
  gleich(await page.evaluate(() => document.querySelector('.gm-spiel-weiter a.gm-spiel-los').getAttribute('href')), a.adresse, 'Ziel des Knopfes');
  const text = await sichtbarerText(page, '.gm-spiel-weiter');
  wahr(!VERBOTEN.test(text), 'verbotenes Wort im Eingang: ' + text);
  wahr(!/\d+\s*(%|von\s+\d+\s+Punkte)/.test(text), 'Statistik im Eingang: ' + text);
  gleich(await page.evaluate(() => document.querySelectorAll('.gm-tabs .gm-tab').length), 3, 'Reiter: Karte, Zeitstrahl, Reisepass; kein zusätzlicher mit Statistik (das ist nicht das Ziel)');
  await foto(page, '01-eingang');
  await ctx.close();
});

await t('3 Gesperrte Reisen sind angedeutet: Titel, Symbol, Satz mit der Bedingung, kein Inhalt, keine Sackgasse', async () => {
  const { ctx, page } = await seite(DIST);
  await page.evaluate(() => document.querySelector('#reisen').scrollIntoView());
  const k = await page.evaluate(id => { const c = document.querySelector(`.gm-card[data-journey="${id}"]`); return { zu: c.classList.contains('is-locked'), schloss: !c.querySelector('.gm-card-lock').hidden, tag: c.querySelector('.gm-card-tag').textContent, strip: c.querySelector('.gm-strip').hidden, knopf: c.querySelector('.gm-card-foot .gm-btn').textContent.trim(), titel: c.querySelector('.gm-card-title').textContent, href: c.querySelector('.gm-card-foot a').getAttribute('href') }; }, F.j1);
  wahr(k.zu && k.schloss, 'Karte nicht als gesperrt markiert');
  wahr(/^Zum Öffnen: /.test(k.tag), 'Satz mit der Bedingung fehlt: ' + k.tag);
  wahr(k.strip, 'Stationen der gesperrten Reise sind angedeutet sichtbar');
  gleich(k.href, '#/reise/' + F.j1, 'der Knopf führt zum Hinweisbild, nicht ins Leere');
  const reisen = await page.evaluate(id => MUSEUM.data.journeyById[id].tagline, F.j1);
  wahr(!k.tag.includes(reisen), 'Tagline (Inhalt) einer gesperrten Reise sichtbar');
  const offen = await page.evaluate(id => document.querySelector(`.gm-card[data-journey="${id}"]`).classList.contains('is-locked'), F.j0);
  gleich(offen, false, 'die erste Reise ist offen');
  await foto(page, '02-karten');
  await ctx.close();
});

await t('4 Adresse einer gesperrten Reise: ruhiges Hinweisbild mit der Bedingung und einem Weg zur nächsten Aufgabe', async () => {
  const { ctx, page } = await seite(DIST);
  await geheZu(page, '#/reise/' + F.j1, 900);
  const s = await page.evaluate(() => { const n = document.querySelector('.gm-spiel-sperre'); const sicht = x => !!x && x.getClientRects().length > 0; return n && { text: n.textContent, weg: !!n.querySelector('.gm-spiel-sperre-weg button, .gm-spiel-sperre-weg a'), frei: !!n.querySelector('input[role="switch"]'), reise: sicht(document.querySelector('.gm-reise-root')), station: sicht(document.querySelector('.gm-panel-scroll .gm-station')), titel: document.title }; });
  wahr(s, 'kein Hinweisbild');
  wahr(/Noch verschlossen/.test(s.text) && /Zum Öffnen: /.test(s.text), 'Hinweis ohne Bedingung: ' + s.text);
  wahr(s.weg, 'kein Weg zur nächsten Aufgabe (Sackgasse)');
  wahr(s.frei, 'kein Schalter für den Freien Zugang');
  wahr(!s.reise && !s.station, 'trotzdem Reise-Modus oder Station geöffnet');
  const a = await page.evaluate(() => MUSEUM.spiel.naechsteAufgabe());
  wahr(s.text.includes(a.text), 'die nächste Aufgabe steht nicht im Hinweis');
  await foto(page, '03-sperre-reise');
  // der Knopf führt zur Aufgabe
  await page.click('.gm-spiel-sperre-weg button');
  await page.waitForTimeout(700);
  wahr(await page.evaluate(h => location.hash === h, a.adresse), 'der Knopf führt nicht zur Aufgabe: ' + await page.evaluate(() => location.hash));
  await ctx.close();
});

await t('5 Adresse einer gesperrten Station: Hinweisbild statt Inhalt, Nachbarn bleiben verborgen', async () => {
  if (!F.sperr) return 'skip';
  const { ctx, page } = await seite(DIST);
  await geheZu(page, '#/station/' + F.sperr, 900);
  const s = await page.evaluate(() => ({ sperre: !!document.querySelector('.gm-spiel-sperre'), artikel: !!document.querySelector('.gm-panel-scroll .gm-station'), prev: document.querySelector('.gm-panel-step') && document.querySelector('.gm-panel-step').disabled, text: document.querySelector('.gm-spiel-sperre') && document.querySelector('.gm-spiel-sperre').innerText }));
  wahr(s.sperre && !s.artikel, 'kein Hinweisbild oder Inhalt trotzdem da');
  wahr(s.prev, 'Vor und zurück bleiben beim Hinweis gesperrt');
  const titel = await page.evaluate(id => MUSEUM.data.stations[id].title, F.sperr);
  const body = await page.evaluate(id => MUSEUM.data.stations[id].text[0].slice(0, 40), F.sperr);
  wahr(!s.text.includes(body), 'Text der Station im Hinweis');
  wahr(s.text.includes('Zum Öffnen'), 'Bedingung fehlt');
  void titel;
  await ctx.close();
});

await t('5b Verborgenes bleibt ungenannt: keine Karte, kein Suchtreffer, Hinweisbild ohne Namen und Bedingung', async () => {
  if (!F.e2) return 'skip';
  const { ctx, page } = await seite(DIST);
  const name = await page.evaluate(id => MUSEUM.data.journeyById[id].name, F.j2);
  gleich(await page.evaluate(id => document.querySelector(`.gm-card[data-journey="${id}"]`).hidden, F.j2), true, 'Karte der verborgenen Reise');
  const a = await page.evaluate(id => MUSEUM.spiel.anzeige(id), F.e2);
  wahr(a.gesperrt && a.verborgen && !a.titel.includes(name) && a.bedingung === '', 'anzeige verrät etwas: ' + JSON.stringify(a));
  await page.evaluate(q => MUSEUM.search.open(q), name.slice(0, 8));
  await page.waitForTimeout(600);
  wahr(!(await page.evaluate(n => document.getElementById('suche-overlay').textContent.includes(n), name)), 'die Suche nennt die verborgene Reise');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  if (F.kreuzung) {   // eine Station, die auf einer offenen und der verborgenen Reise liegt, nennt die verborgene nirgends
    await geheZu(page, '#/station/' + F.kreuzung, 900);
    wahr(!(await page.evaluate(n => document.querySelector('.gm-panel-scroll').textContent.includes(n), name)), 'die Station nennt die verborgene Reise (Chips, Kreuzung)');
    await geheZu(page, '#/reise/' + F.j0 + '/' + F.kreuzung, 1000);
    wahr(!(await page.evaluate(n => document.getElementById('reise').textContent.includes(n), name)), 'der Reise-Modus nennt die verborgene Reise (Linienplan, Kreuzung)');
    await geheZu(page, '', 500);
  }
  await geheZu(page, '#/reise/' + F.j2, 900);
  const text = await page.evaluate(() => document.querySelector('.gm-spiel-sperre').textContent);
  wahr(/Noch verborgen/.test(text) && !text.includes(name) && !/Zum Öffnen/.test(text), 'das Hinweisbild verrät etwas: ' + text);
  wahr(!(await page.evaluate(n => document.title.includes(n), name)), 'der Seitentitel nennt den Namen');
  await page.evaluate(() => MUSEUM.spiel.setFrei(true));
  gleich(await page.evaluate(id => document.querySelector(`.gm-card[data-journey="${id}"]`).hidden, F.j2), false, 'mit Freiem Zugang ist sie sichtbar');
  await ctx.close();
});

await t('6 Suche: gesperrte Treffer nur angedeutet, nie mit Text', async () => {
  const { ctx, page } = await seite(DIST);
  const name = await page.evaluate(id => MUSEUM.data.journeyById[id].name, F.j1);
  await page.evaluate(q => MUSEUM.search.open(q), name.slice(0, 8));
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => Array.from(document.querySelectorAll('.gm-suche-opt.is-locked')).map(n => n.textContent));
  wahr(r.length >= 1 && /Noch verschlossen/.test(r[0]) && /Zum Öffnen/.test(r[0]), 'gesperrte Reise nicht angedeutet: ' + JSON.stringify(r));
  if (F.sperr) {
    const wort = await page.evaluate(id => { const s = MUSEUM.data.stations[id]; const w = s.text.join(' ').split(/\s+/).filter(x => x.length > 8 && !s.title.toLowerCase().includes(x.toLowerCase())); return w[Math.floor(w.length / 2)]; }, F.sperr);
    await page.evaluate(q => MUSEUM.search.setQuery(q), wort);
    await page.waitForTimeout(600);
    const treffer = await page.evaluate(id => Array.from(document.querySelectorAll('.gm-suche-opt.is-locked')).some(n => n.textContent.includes(MUSEUM.data.stations[id].title)), F.sperr);
    wahr(!treffer, 'die gesperrte Station erscheint über ihren Text');
  }
  await foto(page, '04-suche');
  await ctx.close();
});

await t('7 Station lesen: erkundet, dann geschafft (Scroll plus Verweildauer), Rückmeldung am Ort', async () => {
  const { ctx, page, logs } = await seite(DIST);
  await geheZu(page, '#/station/' + F.erste, 900);
  await page.waitForFunction(id => MUSEUM.store.isVisited(id), F.erste, { timeout: 5000 });
  const ev1 = await ereignisse(page);
  wahr(ev1.some(e => e.verb === 'erkundet' && e.objekt === 'inhalt/' + F.erste), 'erkundet fehlt');
  wahr(!ev1.some(e => e.verb === 'geschafft' && e.objekt === 'inhalt/' + F.erste), 'geschafft schon vor dem Lesen');
  await page.waitForTimeout(1200);
  gleich((await einheit(page, 'inhalt/' + F.erste)).stufe, 1, 'Stufe ohne Scrollen und Verweilen (die Marke am Ende ist noch nicht erreicht)');
  await liesBisEnde(page);
  await warteStufe(page, 'inhalt/' + F.erste, 2);
  const ev2 = await ereignisse(page);
  wahr(ev2.some(e => e.verb === 'geschafft' && e.objekt === 'inhalt/' + F.erste), 'geschafft fehlt');
  const rueck = await page.evaluate(() => (document.querySelector('.gm-spiel-fuss .gm-spiel-rueck:not([hidden])') || {}).textContent);
  wahr(rueck && /Noch \d+ Schritt|geschafft/.test(rueck), 'keine Rückmeldung am Ort: ' + rueck);
  gleich(await page.evaluate(() => document.querySelector('.gm-st-seen > span').textContent), 'Geschafft', 'Abzeichen im Kopf der Station');
  wahr(ev2.every(e => /^[a-z0-9:._/\-]+$/i.test(e.objekt) && e.objekt.length < 120), 'Ereignisse mit Freitext');
  wahr(ev2.every(e => !('text' in e) && !('eingabe' in e)), 'Ereignisse tragen mehr als Kennungen');
  gleich(logs.join('; '), '', 'Konsolenfehler');
  await foto(page, '05-station-geschafft');
  await ctx.close();
});

await t('8 Enthüllung: sofort dort, wo du handelst, nicht blockierend, mit Ansage; Ansehen und Weiter', async () => {
  const { ctx, page } = await seite(DIST);
  await geheZu(page, '#/station/' + F.erste, 700); await liesBisEnde(page); await warteStufe(page, 'inhalt/' + F.erste);
  await geheZu(page, '#/station/' + F.zweite, 700); await liesBisEnde(page); await warteStufe(page, 'inhalt/' + F.zweite);
  await page.waitForSelector('.gm-spiel-moment', { timeout: 4000 });
  const k = await page.evaluate(() => { const n = document.querySelector('.gm-spiel-moment'); const r = n.getBoundingClientRect(); return { rolle: n.getAttribute('role'), label: n.getAttribute('aria-labelledby'), knoepfe: Array.from(n.querySelectorAll('button')).map(b => b.textContent), text: n.innerText, host: n.parentElement.id || n.parentElement.tagName, inert: !!n.closest('[inert]'), innen: r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.top >= 0, live: document.getElementById('gm-live').textContent, neu: n.classList.contains('is-neu') }; });
  gleich(k.rolle, 'region', 'Rolle');
  wahr(k.label && await page.evaluate(id => !!document.getElementById(id), k.label), 'aria-labelledby ohne Ziel');
  wahr(k.knoepfe.includes('Ansehen') && k.knoepfe.includes('Weiter'), 'Schaltflächen Ansehen und Weiter fehlen: ' + k.knoepfe);
  wahr(k.text.includes('Zwei Stationen sind geschafft. Eine neue Reise geht für dich auf.'), 'Enthüllungstext fehlt: ' + k.text);
  wahr(!k.inert && k.innen, 'blockiert oder außerhalb des Bildes');
  wahr(k.neu, 'ohne reduzierte Bewegung fehlt die Bewegung');
  await page.waitForFunction(() => /Neu geöffnet/.test(document.getElementById('gm-live').textContent), null, { timeout: 3000 });
  gleich(await page.evaluate(() => document.getElementById('gm-live').getAttribute('aria-live')), 'polite', 'aria-live');
  await foto(page, '06-moment');
  // nicht blockierend: der Hintergrund bleibt bedienbar (das Panel ist offen, sein Schließen-Knopf reagiert, die Karte bleibt unberührt)
  await page.click('.gm-panel-step:not([disabled])');
  await page.waitForTimeout(400);
  wahr(await page.evaluate(() => !!document.querySelector('.gm-spiel-moment')), 'die Karte verschwand durch eine Bedienung dahinter');
  await page.evaluate(() => Array.from(document.querySelectorAll('.gm-spiel-moment button')).find(b => b.textContent === 'Ansehen').click());
  await page.waitForTimeout(900);
  wahr(await page.evaluate(h => location.hash === h, '#/reise/' + F.j1), 'Ansehen führt nicht zur neuen Reise: ' + await page.evaluate(() => location.hash));
  wahr(!(await da(page, '.gm-spiel-sperre')), 'die neue Reise ist noch gesperrt');
  await ctx.close();
});

await t('9 Enthüllung bei reduzierter Bewegung: keine Bewegung, trotzdem sichtbar und angesagt', async () => {
  const { ctx, page } = await seite(DIST, { reduced: true });
  await page.evaluate(([a, b]) => { MUSEUM.spiel.melde('geschafft', 'inhalt/' + a); MUSEUM.spiel.melde('geschafft', 'inhalt/' + b); }, [F.erste, F.zweite]);
  await page.waitForSelector('.gm-spiel-moment', { timeout: 4000 });
  const k = await page.evaluate(() => { const n = document.querySelector('.gm-spiel-moment'); return { neu: n.classList.contains('is-neu'), anim: getComputedStyle(n).animationName, sw: getComputedStyle(document.querySelector('.gm-spiel-weiter')).animationName }; });
  wahr(!k.neu && (k.anim === 'none'), 'Bewegung trotz reduce: ' + JSON.stringify(k));
  await ctx.close();
});

await t('10 Reise-Modus: Weiter zählt die vorige Station als geschafft; Gesperrtes wird erklärt; Auftakt und Etappe', async () => {
  const { ctx, page } = await seite(DIST);
  await geheZu(page, '#/reise/' + F.j0, 900);
  wahr(await page.evaluate(() => /Du betrittst die erste Reise/.test(document.querySelector('.gm-reise-stage').innerText)), 'Auftakt der Episode fehlt in der Einführung');
  gleich(await page.evaluate(() => document.querySelector('.gm-reise-kicker').textContent), 'Dein Einstieg', 'Etappe in der Einführung');
  wahr((await ereignisse(page)).some(e => e.verb === 'begonnen' && e.objekt === F.e0), 'Reise geöffnet = begonnen fehlt');
  await page.click('.gm-reise-next'); await page.waitForTimeout(1200);
  await page.click('.gm-reise-next'); await page.waitForTimeout(500);   // Weiter: die erste Station war lange genug offen
  await page.waitForFunction(u => (MUSEUM.spiel.einheit(u) || {}).stufe >= 2, 'inhalt/' + F.erste, { timeout: 4000 });
  if (F.sperr) {
    await page.evaluate(([j, sid]) => MUSEUM.nav.openJourney(j, MUSEUM.data.orders[j].indexOf(sid)), [F.j0, F.sperr]);
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => ({ sperre: !!document.querySelector('.gm-reise-stage .gm-spiel-sperre'), weiter: !document.querySelector('.gm-reise-next').disabled, stop: !!document.querySelector('.gm-reise-stop.is-locked') }));
    wahr(s.sperre && s.weiter, 'gesperrte Station im Reise-Modus nicht erklärt oder Weiter blockiert');
    wahr(s.stop, 'die Haltestelle im Linienplan ist nicht als gesperrt markiert');
  }
  await ctx.close();
});

await t('11 Mythos-Karte, Exponat, Einsatz des Werkzeugs und Teilen melden nur Kennungen', async () => {
  if (!F.exStation) return 'skip';
  const { ctx, page } = await seite(DIST);
  await page.evaluate(([a, b]) => { MUSEUM.spiel.melde('geschafft', 'inhalt/' + a); MUSEUM.spiel.melde('geschafft', 'inhalt/' + b); }, [F.erste, F.zweite]);
  await page.waitForTimeout(600); await schliesseKarten(page); await page.waitForTimeout(700); await schliesseKarten(page);
  if (F.myth && F.kindOf(F.myth) === 'mythos') {
    await geheZu(page, '#/station/' + F.myth, 900);
    await page.click('.gm-flip-btn');
    await warteStufe(page, F.quest);
    wahr(await page.evaluate(() => /geschafft/.test(Array.from(document.querySelectorAll('.gm-spiel-rueck')).map(n => n.textContent).join(' '))), 'keine Rückmeldung an der Mythos-Karte');
    await schliesseKarten(page); await page.waitForTimeout(500); await schliesseKarten(page);
  }
  await page.evaluate(() => document.querySelectorAll('.gm-spiel-moment').forEach(n => n.remove()));
  await geheZu(page, '#/station/' + F.exStation, 900);
  await page.click('.gm-plaque-actions button');
  await page.waitForTimeout(300);
  gleich((await einheit(page, F.erlebnis)).stufe, 1, 'Exponat gestartet = begonnen');
  await page.mouse.click(700, 420);
  await warteStufe(page, F.erlebnis);
  wahr(await page.evaluate(() => /ausprobiert/.test(Array.from(document.querySelectorAll('.gm-spiel-rueck')).map(n => n.textContent).join(' '))), 'keine Rückmeldung am Exponat');
  await liesBisEnde(page); await page.waitForTimeout(500);
  const einsatz = await page.$('.gm-spiel-einsatz button');
  wahr(einsatz, 'der Einsatz des Werkzeugs wird nicht angeboten (das Werkzeug ist offen, der Ort geschafft)');
  await einsatz.click();
  await warteStufe(page, 'werkzeug/test-werkzeug');
  await page.click('.gm-spiel-teilen-knopf');
  await page.waitForTimeout(500);
  const ev = await ereignisse(page);
  wahr(ev.some(e => e.verb === 'geteilt' && e.objekt === 'inhalt/' + F.exStation), 'Link kopiert = geteilt fehlt');
  wahr(ev.some(e => e.verb === 'geschafft' && e.objekt === F.erlebnis && (e.mit || []).includes('werkzeug/test-werkzeug')), 'Einsatz nicht mit mit: [werkzeug] gemeldet');
  wahr(ev.every(e => Object.keys(e).every(k => ['wer', 'verb', 'objekt', 'zeit', 'app', 'mit', 'herkunft', 'ergebnis', 'beleg'].includes(k))), 'unerwartete Felder in Ereignissen');
  await ctx.close();
});

await t('12 Freier Zugang: der Schalter öffnet alles, die Pausen entfallen, gezählt wird weiter', async () => {
  const { ctx, page } = await seite(DIST);
  await geheZu(page, '#/reise/' + F.j1, 900);
  await page.click('.gm-spiel-sperre .gm-spiel-frei-l');
  await page.waitForTimeout(900);
  gleich(await page.evaluate(() => MUSEUM.spiel.frei), true, 'frei');
  gleich(await page.evaluate(() => localStorage.getItem('gm:sp:frei')), '1', 'gm:sp:frei');
  wahr(!(await da(page, '.gm-spiel-sperre')) && await da(page, '.gm-reise-root'), 'die Reise ist trotz Freiem Zugang nicht offen');
  await page.evaluate(() => document.querySelector('.gm-reise-close').click()); await page.waitForTimeout(500);
  const sichtbarOffen = await page.evaluate(ids => ids.every(id => !document.querySelector(`.gm-card[data-journey="${id}"]`).classList.contains('is-locked')), F.jids);
  wahr(sichtbarOffen, 'Karten bleiben gesperrt');
  const vor = (await ereignisse(page)).length;
  await geheZu(page, '#/station/' + F.zweite, 700); await liesBisEnde(page); await warteStufe(page, 'inhalt/' + F.zweite);
  wahr((await ereignisse(page)).length > vor, 'Ereignisse werden im Freien Zugang nicht gesammelt');
  if (F.j2) {
    const e = await page.evaluate(([a, b]) => { MUSEUM.spiel.melde('geschafft', 'inhalt/' + a); return MUSEUM.spiel.einheit(b); }, [F.erste, F.e2]);
    gleich(e.zugang, 'offen', 'die Pause (3 Stunden) entfällt: dritte Reise sofort offen durch den Weg mit Wartezeit');
  }
  await page.reload(); await page.waitForTimeout(800);
  gleich(await page.evaluate(() => MUSEUM.spiel.frei), true, 'Schalter nach dem Neuladen');
  await geheZu(page, '', 600);
  await page.click('.gm-spiel-weiter .gm-spiel-frei-l');
  gleich(await page.evaluate(() => MUSEUM.spiel.frei), false, 'Schalter ausschalten im Eingang');
  await ctx.close();
});

await t('12b Vorbelegung: pack.json "spielFrei" schaltet den Freien Zugang ein; wer ihn bedient hat, behält seine Wahl', async () => {
  const dst2 = path.join(TMP, 'pack-frei', PAKET);
  fs.cpSync(F.dst, dst2, { recursive: true });
  const pj = JSON.parse(fs.readFileSync(path.join(dst2, 'pack.json'), 'utf8'));
  pj.spielFrei = true;
  fs.writeFileSync(path.join(dst2, 'pack.json'), JSON.stringify(pj, null, 2));
  const out2 = path.join(TMP, 'dist', 'frei');
  sh('tools/build.mjs', dst2, '--skins=none', '--out=' + out2);
  const { ctx, page } = await seite(out2);
  gleich(await page.evaluate(() => MUSEUM.spiel.frei), true, 'vorbelegt');
  wahr(await page.evaluate(() => document.querySelector('.gm-spiel-weiter input[role="switch"]').checked), 'Schalter im Eingang zeigt es nicht');
  gleich(await page.evaluate(id => MUSEUM.spiel.zugang(id).offen, F.e1), true, 'alles offen');
  await page.click('.gm-spiel-weiter .gm-spiel-frei-l');
  gleich(await page.evaluate(() => localStorage.getItem('gm:sp:frei')), '0', 'ausgeschaltet gespeichert');
  await page.reload(); await page.waitForTimeout(700);
  gleich(await page.evaluate(() => MUSEUM.spiel.frei), false, 'die Wahl bleibt nach dem Neuladen');
  await ctx.close();
});

await t('13 Rhythmus: Wiedersehen als freundliche Aufgabe, Verwitterung ohne Strafton, keine Serien', async () => {
  const { ctx, page } = await seite(DIST);
  await geheZu(page, '#/station/' + F.erste, 700); await liesBisEnde(page); await warteStufe(page, 'inhalt/' + F.erste);
  await geheZu(page, '', 400);
  await page.evaluate(() => { window.__SP_HEUTE = '2026-10-14T10:00:00Z'; MUSEUM.spiel.aktualisiere(); });
  await page.waitForTimeout(300);
  const e = await page.evaluate(() => ({ k: document.querySelector('.gm-spiel-weiter .gm-spiel-k').textContent, t: document.querySelector('.gm-spiel-weiter').innerText }));
  gleich(e.k, 'Ein Wiedersehen', 'fällige Wiederkehr im Eingang');
  wahr(!VERBOTEN.test(e.t) && !/Pflicht|muss(t)? du|überfällig|zu spät/i.test(e.t), 'Strafton im Eingang: ' + e.t);
  const a = await page.evaluate(() => MUSEUM.spiel.naechsteAufgabe());
  wahr(a.art === 'wiederkehr', 'die Aufgabe ist kein Wiedersehen');
  await geheZu(page, a.adresse, 900);
  wahr(await page.evaluate(() => /Schön, dass du wieder da bist/.test((document.querySelector('.gm-spiel-wieder') || {}).textContent || '')), 'kein freundlicher Satz beim Wiedersehen');
  await liesBisEnde(page);
  await page.waitForFunction(() => /Aufgefrischt/.test((document.querySelector('.gm-spiel-rueck:not([hidden])') || {}).textContent || ''), null, { timeout: 6000 });
  gleich((await einheit(page, 'inhalt/' + F.erste)).faellig, false, 'das Wiedersehen ist eingelöst');
  // lange weg: nur eine freundliche Aufgabe, keine Liste, nichts geht verloren
  await page.evaluate(() => { window.__SP_HEUTE = '2026-12-20T10:00:00Z'; MUSEUM.spiel.aktualisiere(); });
  gleich(await page.evaluate(() => document.querySelectorAll('.gm-spiel-weiter .gm-spiel-t').length), 1, 'nach langer Pause: genau eine Aufgabe');
  const u = await einheit(page, 'inhalt/' + F.erste);
  wahr(u.stufe >= 2 && u.verwittert === true, 'Stufe geht nicht verloren, verwittert wird nur angezeigt: ' + JSON.stringify(u));
  await ctx.close();
});

await t('14 Speicher: nur lokal, nur gm:, Neuladen behält alles, keine Enthüllung doppelt', async () => {
  const { ctx, page } = await seite(DIST);
  await page.evaluate(([a, b]) => { MUSEUM.spiel.melde('geschafft', 'inhalt/' + a); MUSEUM.spiel.melde('geschafft', 'inhalt/' + b); }, [F.erste, F.zweite]);
  await page.waitForSelector('.gm-spiel-moment', { timeout: 4000 });
  const vor = await page.evaluate(() => MUSEUM.spiel.stand().einheiten);
  await page.reload(); await page.waitForTimeout(1500);
  const nach = await page.evaluate(() => MUSEUM.spiel.stand().einheiten);
  for (const id of Object.keys(vor)) if (vor[id].zugang === 'offen') gleich(nach[id].zugang, 'offen', 'nach dem Neuladen offen: ' + id);
  gleich(await page.evaluate(() => document.querySelectorAll('.gm-spiel-moment').length), 0, 'Enthüllung nach dem Neuladen noch einmal');
  const keys = await page.evaluate(() => Object.keys(localStorage));
  wahr(keys.every(k => /^gm:/.test(k)), 'fremde Schlüssel: ' + keys.join());
  wahr(keys.some(k => /^gm:sp:/.test(k)), 'kein Schlüssel mit dem Präfix gm:sp:');
  const cookies = await ctx.cookies();
  gleich(cookies.length, 0, 'Cookies');
  await ctx.close();
});

await t('15 Alte Besuche und Stempel werden einmal übernommen (herkunft migration), nichts geht verloren, keine Enthüllungswelle', async () => {
  const sid = F.s0.slice(0, 3);
  const { ctx, page } = await seite(DIST, { storage: { 'gm:visited': JSON.stringify(sid.concat(['gibt-es-nicht'])), 'gm:stamps': JSON.stringify([F.j0, 'rundreise']), 'gm:stampdates': JSON.stringify({ [F.j0]: '2026-10-01' }) } });
  const ev = await ereignisse(page);
  const mig = ev.filter(e => e.herkunft === 'migration');
  wahr(mig.length >= 4, 'zu wenige übernommene Ereignisse: ' + mig.length);
  wahr(mig.some(e => e.verb === 'geschafft' && e.objekt === F.e0 && e.zeit.startsWith('2026-10-01')), 'Stempel nicht als Episode geschafft mit seinem Datum übernommen');
  wahr(sid.every(s => mig.some(e => e.objekt === 'inhalt/' + s)), 'besuchte Stationen fehlen');
  wahr(!mig.some(e => /gibt-es-nicht/.test(e.objekt)), 'Unbekanntes übernommen');
  gleich(await page.evaluate(() => localStorage.getItem('gm:visited')), JSON.stringify(sid.concat(['gibt-es-nicht'])), 'gm:visited bleibt unverändert');
  gleich(await page.evaluate(() => document.querySelectorAll('.gm-spiel-moment').length), 0, 'Enthüllungen beim Übernehmen');
  await page.reload(); await page.waitForTimeout(800);
  gleich((await ereignisse(page)).filter(e => e.herkunft === 'migration').length, mig.length, 'zweites Übernehmen');
  await ctx.close();
});

await t('16 Zurücksetzen im Reisepass setzt auch den Spielstand zurück', async () => {
  const { ctx, page } = await seite(DIST);
  await page.evaluate(([a, b]) => { MUSEUM.spiel.melde('geschafft', 'inhalt/' + a); MUSEUM.spiel.melde('geschafft', 'inhalt/' + b); }, [F.erste, F.zweite]);
  await page.waitForTimeout(500);
  await page.evaluate(() => MUSEUM.store.reset());
  await page.waitForTimeout(400);
  gleich((await ereignisse(page)).length, 0, 'Ereignisse nach dem Zurücksetzen');
  gleich((await einheit(page, F.e1)).zugang, 'gesperrt', 'zweite Reise wieder zu');
  gleich(await page.evaluate(() => document.querySelector('.gm-spiel-weiter .gm-spiel-k').textContent), 'Dein Einstieg', 'Kicker nach dem Zurücksetzen');
  await ctx.close();
});

await t('17 Tastatur und Screenreader: Schalter, Hinweisbild und Enthüllung sind ohne Maus erreichbar', async () => {
  const { ctx, page } = await seite(DIST);
  await geheZu(page, '#/reise/' + F.j1, 900);
  const f = await page.evaluate(() => { const i = document.querySelector('.gm-spiel-sperre input[role="switch"]'); const sec = document.querySelector('.gm-spiel-sperre'); return { switch: i.getAttribute('role'), desc: !!document.getElementById(i.getAttribute('aria-describedby')), lab: sec.getAttribute('aria-labelledby'), h: document.getElementById(sec.getAttribute('aria-labelledby')).tagName, panelLabel: document.getElementById('stationspanel').getAttribute('aria-labelledby') }; });
  gleich(f.switch, 'switch', 'Rolle des Schalters'); wahr(f.desc, 'Schalter ohne Beschreibung'); gleich(f.h, 'H2', 'Überschrift des Hinweises'); gleich(f.panelLabel, f.lab, 'Beschriftung des Panels');
  // Tab erreicht den Schalter; Leertaste schaltet
  let erreicht = false;
  for (let i = 0; i < 12 && !erreicht; i++) { await page.keyboard.press('Tab'); erreicht = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('role') === 'switch'); }
  wahr(erreicht, 'der Schalter ist per Tab nicht erreichbar');
  await page.keyboard.press('Space'); await page.waitForTimeout(700);
  gleich(await page.evaluate(() => MUSEUM.spiel.frei), true, 'Leertaste schaltet den Freien Zugang');
  // im Eingang bleibt der Fokus am Schalter und am Knopf der Aufgabe, auch wenn der Stand neu gerechnet wird (jede halbe Minute und bei jeder Meldung)
  await geheZu(page, '', 600);
  await page.focus('.gm-spiel-weiter input[role="switch"]');
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  wahr(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('role') === 'switch'), 'der Fokus ging am Schalter verloren');
  await page.focus('.gm-spiel-weiter a.gm-spiel-los');
  await page.evaluate(() => { MUSEUM.spiel.aktualisiere(); MUSEUM.spiel.aktualisiere(); });
  wahr(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('gm-spiel-los')), 'der Fokus ging am Knopf der Aufgabe verloren');
  await ctx.close();
});

const skins = args.schnell ? ['halle'] : F.skins;
await t(`18 Darstellung: ${skins.length} Skins × hell/dunkel × Handy/Desktop, Kontrast ≥ 4,5:1, nichts läuft seitlich über`, async () => {
  const probleme = [];
  for (const skin of skins) for (const theme of ['light', 'dark']) for (const [vn, vp] of [['desktop', { width: 1280, height: 800 }], ['handy', { width: 390, height: 844 }]]) {
    const { ctx, page, logs } = await seite(DIST, { skin, theme, viewport: vp });
    const tag = `${skin}/${theme}/${vn}`;
    const pruefe = async was => {
      const bad = await kontrast(page, '.gm-spiel-weiter, .gm-spiel-sperre, .gm-spiel-moment, .gm-spiel-story, .gm-spiel-fuss, .gm-card.is-locked');
      bad.forEach(b => probleme.push(`${tag} ${was}: Kontrast ${b}`));
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) probleme.push(`${tag} ${was}: seitliches Scrollen`);
    };
    await page.evaluate(() => scrollTo(0, 0)); await pruefe('Eingang');
    await foto(page, `18-${skin}-${theme}-${vn}-eingang`);
    await page.evaluate(() => document.querySelector('#reisen').scrollIntoView()); await page.waitForTimeout(300); await pruefe('Karten');
    await geheZu(page, '#/reise/' + F.j1, 800); await pruefe('Hinweisbild');
    await foto(page, `18-${skin}-${theme}-${vn}-sperre`);
    await page.evaluate(([a, b]) => { MUSEUM.spiel.melde('geschafft', 'inhalt/' + a); MUSEUM.spiel.melde('geschafft', 'inhalt/' + b); }, [F.erste, F.zweite]);
    await page.waitForSelector('.gm-spiel-moment', { timeout: 4000 }).catch(() => probleme.push(`${tag}: keine Enthüllung`));
    await page.waitForTimeout(700); await pruefe('Enthüllung');
    await foto(page, `18-${skin}-${theme}-${vn}-moment`);
    await schliesseKarten(page); await page.waitForTimeout(600); await schliesseKarten(page);
    await geheZu(page, '#/station/' + F.erste, 900); await liesBisEnde(page); await page.waitForTimeout(1500); await pruefe('Station');
    await foto(page, `18-${skin}-${theme}-${vn}-station`);
    logs.forEach(l => probleme.push(`${tag}: ${l}`));
    await ctx.close();
  }
  if (probleme.length) throw new Error(`${probleme.length} Probleme:\n` + probleme.slice(0, 25).join('\n'));
});

await t('19 Texte: keine Serien, kein Streak, nichts „verpasst“, kein Rückstand, keine Punkte (Quelltext der Anbindung und Oberfläche)', async () => {
  const quellen = ['engine/js/spiel.js', 'engine/css/spiel.css'].map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]);
  const treffer = [];
  for (const [f, s] of quellen) s.split('\n').forEach((z, i) => { if (VERBOTEN.test(z)) treffer.push(`${f}:${i + 1}: ${z.trim().slice(0, 80)}`); });
  gleich(treffer.join('\n'), '', 'verbotene Wörter');
});

await t(`20 Ein Paket ohne Spielplan („${OHNE}“) verhält sich wie bisher: nichts Neues in Seite, Speicher und Ansichten`, async () => {
  const out = path.join(TMP, 'dist', 'ohne');
  sh('tools/build.mjs', OHNE, '--skins=all', '--out=' + out);
  for (const f of ['js/spielplan.js', 'js/spiel.js', 'css/spiel.css', 'data/spielplan.js', 'js/spielplan-adapter.js']) wahr(!fs.existsSync(path.join(out, f)), 'Datei in der Ausgabe: ' + f);
  wahr(!/spiel/i.test(fs.readFileSync(path.join(out, 'index.html'), 'utf8').replace(/spieltheorie/gi, '')), 'Verweis auf den Spielplan in index.html');
  const { ctx, page, logs } = await seite(out);
  gleich(await page.evaluate(() => typeof MUSEUM.spiel), 'undefined', 'MUSEUM.spiel');
  const ids = await page.evaluate(() => ({ s: Object.keys(MUSEUM.data.stations)[0], j: MUSEUM.data.journeys[0].id }));
  await geheZu(page, '#/station/' + ids.s, 900); await geheZu(page, '#/reise/' + ids.j, 900);
  await page.click('.gm-reise-next'); await page.waitForTimeout(500);
  await page.evaluate(() => MUSEUM.search.open('a')); await page.waitForTimeout(500);
  await geheZu(page, '#/reisepass', 600);
  const n = await page.evaluate(() => document.querySelectorAll('[class*="gm-spiel"], .gm-card-lock, .is-locked, .is-verwittert').length);
  gleich(n, 0, 'Elemente des Spielplans');
  const keys = await page.evaluate(() => Object.keys(localStorage));
  wahr(!keys.some(k => k.startsWith('gm:sp:')), 'Speicherschlüssel des Spielplans: ' + keys.join());
  gleich(logs.join('; '), '', 'Konsolenfehler');
  await ctx.close();
});

await browser.close();
if (!args.behalte) fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${schlecht ? '✗' : '✓'} ${ok} von ${ok + schlecht} Prüfungen${uebersprungen ? `, ${uebersprungen} übersprungen` : ''}`);
if (schlecht) { console.log(fehlerListe.map(f => '  - ' + f.split('\n')[0]).join('\n')); process.exit(1); }

#!/usr/bin/env node
// Museum Studio – Abnahme-Spieler für den Spielplan (Playwright, schlank).
//
//   node tools/spielplan-sim.mjs [--paket=beispiel-gehirn] [--auto] [--shots=<ordner>] [--skins=halle,kabinett]
//
// Ein frischer Spieler folgt immer der einen nächsten Aufgabe, bis nichts mehr aussteht (keine Sackgasse). Geprüft wird dabei:
//   Enthüllung im Moment der Handlung, gesperrte Reisen angedeutet mit Bedingungssatz, Freier Zugang (öffnet alles, ändert keine Ereignisse),
//   Pause von 60 Tagen (Stufen bleiben, kein Strafton), Speicher nur gm:sp: mit Kennungen, keine Netzanfragen.
// --auto: der Spielplan wird mit tools/spielplan-aus-plan.mjs --auto frisch erzeugt (Kopie in einem Temp-Ordner, das Paket bleibt unberührt).
// Mit --shots entstehen Bilder je Skin (hell/dunkel, 1280 und 390 Pixel) von Enthüllung, Eingang, Reisepass und Netzplan.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { loadPlaywright, launch } from './pw-lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
const PAKET = typeof args.paket === 'string' ? args.paket : 'beispiel-gehirn';
const SHOTS = typeof args.shots === 'string' ? path.resolve(args.shots) : null;
const SKINS = (typeof args.skins === 'string' ? args.skins : 'halle,kabinett').split(',');
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = loadPlaywright('Dann:  PLAYWRIGHT_MODULE_DIR=~/pw node tools/spielplan-sim.mjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'spiel-sim-'));
const sh = (...a) => execFileSync('node', a, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
let src = path.join(ROOT, 'packs', PAKET);
if (args.auto) {
  src = path.join(TMP, 'pack', PAKET);
  fs.cpSync(path.join(ROOT, 'packs', PAKET), src, { recursive: true });
  for (const n of ['spielplan.json', 'spielplan-kern.yaml', 'spielplan-zuordnung']) fs.rmSync(path.join(src, n), { recursive: true, force: true });
  sh('tools/spielplan-aus-plan.mjs', src, '--auto');
}
const OUT = path.join(TMP, 'out');
sh('tools/build.mjs', src, '--skins=all', '--out=' + OUT);

let fehler = 0;
const ok = (c, t) => { if (c) console.log('✓ ' + t); else { fehler++; console.log('✗ ' + t); } };
const STRAF = /\b(Serie|Streak|verpasst|Rückstand|Punkte|Tage in Folge)\b/i;

const browser = await launch(chromium);
async function neu(skin, w, h, scheme) {
  scheme = scheme || 'light';
  const ctx = await browser.newContext({ viewport: { width: w || 1280, height: h || 800 }, colorScheme: scheme || 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const probleme = [], netz = [];
  page.on('pageerror', e => probleme.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') probleme.push(m.text()); });
  page.on('request', r => { const u = r.url(); if (!/^(file:|data:|blob:|about:)/.test(u)) netz.push(u); });
  await page.addInitScript(a => { try { localStorage.setItem('gm:skin', JSON.stringify(a[0])); localStorage.setItem('gm:theme', JSON.stringify(a[1])); } catch (e) { /* egal */ } }, [skin, scheme]);
  await page.goto('file://' + path.join(OUT, 'index.html') + (skin ? '' : ''));
  await page.waitForFunction(() => window.MUSEUM && window.MUSEUM.spiel, null, { timeout: 15000 });
  return { ctx, page, probleme, netz };
}

/* ---------- 1. Spieler folgt der nächsten Aufgabe ---------- */
{
  const { ctx, page, probleme, netz } = await neu('halle');
  const aktiv = await page.evaluate(() => window.MUSEUM.spiel.aktiv);
  ok(aktiv, 'Spielplan ist aktiv (' + PAKET + (args.auto ? ', --auto' : '') + ')');
  const start = await page.evaluate(() => {
    const S = window.MUSEUM.spiel, st = S.stand(), ids = Object.keys(st.einheiten);
    const zu = ids.filter(i => st.einheiten[i].zugang === 'gesperrt' || !S.zugang(i).offen);
    const ang = zu.filter(i => S.zugang(i).sichtbar && S.zugang(i).bedingung);
    return { n: ids.length, gesperrt: zu.length, angedeutet: ang.length, auf: !!S.naechsteAufgabe() };
  });
  ok(start.auf, 'frisch: genau eine nächste Aufgabe');
  ok(start.gesperrt === 0 || start.angedeutet > 0, 'gesperrte Einheiten (' + start.gesperrt + ') sind angedeutet mit Bedingungssatz (' + start.angedeutet + ')');

  // gesperrte Reise im Eingang: Karte mit Bedingung
  const eingang = await page.evaluate(() => { location.hash = '#/'; return document.body.innerText; });
  ok(!STRAF.test(eingang), 'Eingang ohne Strafwörter');

  let schritte = 0, enth = 0, stau = 0, letzte = '';
  const log = await page.evaluate(() => { window.__sp_enth = []; window.MUSEUM.spiel.bei('freigeschaltet', f => window.__sp_enth.push(f.einheit)); return 1; });
  for (; schritte < 400; schritte++) {
    const r = await page.evaluate(() => {
      const S = window.MUSEUM.spiel, a = S.naechsteAufgabe();
      if (!a) return { ende: true, wartet: (S.stand().wartet || []).length };
      const id = a.einheit, art = id.split('/')[0];
      const vorher = window.__sp_enth.length;
      if (art === 'inhalt') { S.melde('erkundet', id); S.melde('geschafft', id); } else S.melde('geschafft', id);
      return { id, art, neu: window.__sp_enth.length - vorher };
    });
    if (r.ende) { stau = r.wartet; break; }
    enth += r.neu;
    if (r.id === letzte) {
      // dieselbe Aufgabe zweimal: vermutlich Wartezeit; Zeit um 3 Tage vorstellen
      await page.evaluate(() => { window.__SP_HEUTE = Date.now() + (window.__sp_tage = (window.__sp_tage || 0) + 3) * 864e5; window.MUSEUM.spiel.aktualisiere(); });
    }
    letzte = r.id;
  }
  const endstand = await page.evaluate(() => {
    const S = window.MUSEUM.spiel, st = S.stand(), ids = Object.keys(st.einheiten);
    return { zu: ids.filter(i => !S.zugang(i).offen).length, n: ids.length, tage: window.__sp_tage || 0 };
  });
  ok(schritte < 400 && endstand.zu === 0, 'Aufgaben bis zum Ende gefolgt (' + schritte + ' Schritte, ' + endstand.tage + ' Tage vorgestellt): alles offen, ' + endstand.zu + ' von ' + endstand.n + ' noch zu');
  ok(enth > 0, 'Enthüllungen im Moment der Handlung: ' + enth);

  // Freier Zugang: frischer Spieler, Ereignisse vorher/nachher gleich
  const ctx2 = await neu('halle');
  const fz = await ctx2.page.evaluate(() => {
    const S = window.MUSEUM.spiel, ids = Object.keys(S.stand().einheiten);
    const ev = () => (JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /^gm:sp:.*:ereignisse$/.test(k)) || 'x') || '[]')).length;
    const e0 = ev(), zu0 = ids.filter(i => !S.zugang(i).offen).length;
    S.setFrei(true);
    const zu1 = ids.filter(i => !S.zugang(i).offen).length, e1 = ev();
    S.setFrei(false);
    return { zu0, zu1, e0, e1, zurueck: ids.filter(i => !S.zugang(i).offen).length };
  });
  ok(fz.zu1 === 0 && fz.e0 === fz.e1 && fz.zurueck === fz.zu0, 'Freier Zugang: offen (' + fz.zu0 + ' -> ' + fz.zu1 + '), Ereignisse unverändert (' + fz.e0 + '), Zurückschalten stellt her');
  await ctx2.ctx.close();

  // Pause: 60 Tage
  const pa = await page.evaluate(() => {
    const S = window.MUSEUM.spiel, st = S.stand(), vor = {};
    Object.keys(st.einheiten).forEach(i => vor[i] = st.einheiten[i].stufe);
    window.__SP_HEUTE = Date.now() + ((window.__sp_tage || 0) + 60) * 864e5; S.aktualisiere();
    const s2 = S.stand(), geaendert = Object.keys(vor).filter(i => s2.einheiten[i].stufe !== vor[i]).length;
    const verw = Object.keys(s2.einheiten).filter(i => s2.einheiten[i].verwittert).length;
    location.hash = '#/reisepass';
    return { geaendert, verw, a: !!S.naechsteAufgabe() };
  });
  await page.waitForTimeout(400);
  const txt = await page.evaluate(() => document.body.innerText);
  ok(pa.geaendert === 0, 'Pause 60 Tage: Stufen unverändert (' + pa.geaendert + ' geändert), verwittert: ' + pa.verw);
  ok(!STRAF.test(txt), 'Reisepass nach der Pause ohne Strafwörter');

  // Speicher
  const sp = await page.evaluate(() => {
    const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); out[k] = localStorage.getItem(k); } return out;
  });
  const sk = Object.keys(sp).filter(k => k.startsWith('gm:sp:'));
  ok(sk.length > 0 && Object.keys(sp).every(k => k.startsWith('gm:')), 'localStorage nur gm:-Schlüssel (' + sk.length + ' mit gm:sp:)');
  const bad = sk.filter(k => /ereignisse$/.test(k)).some(k => JSON.parse(sp[k]).some(e => Object.keys(e).some(f => !['wer', 'verb', 'objekt', 'zeit', 'app', 'herkunft', 'mit', 'ergebnis'].includes(f))));
  ok(!bad, 'Ereignisse enthalten nur Kennungen (keine Freitextfelder)');
  ok(netz.length === 0, 'keine Netzwerkanfragen (' + netz.length + ')');
  ok(probleme.length === 0, 'keine Konsolen-/Seitenfehler' + (probleme.length ? ': ' + probleme[0] : ''));
  await ctx.close();
}

/* ---------- 2. Darstellung ---------- */
if (SHOTS) {
  for (const skin of SKINS) for (const scheme of ['light', 'dark']) for (const [w, h, tag] of [[1280, 800, 'desk'], [390, 800, 'handy']]) {
    const { ctx, page, probleme } = await neu(skin, w, h, scheme);
    const base = `${skin}-${scheme}-${tag}`;
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS, base + '-eingang.png') });
    // Enthüllung: die erste Aufgabe erledigen
    await page.evaluate(() => { const S = window.MUSEUM.spiel; for (let i = 0; i < 12; i++) { const a = S.naechsteAufgabe(); if (!a) break; const id = a.einheit; if (id.startsWith('inhalt/')) S.melde('erkundet', id); S.melde('geschafft', id); if (document.querySelector('.gm-spiel-moment')) break; } });
    await page.waitForTimeout(500);
    const moment = await page.evaluate(() => !!document.querySelector('.gm-spiel-moment'));
    if (moment) await page.screenshot({ path: path.join(SHOTS, base + '-moment.png') });
    for (const v of ['reisepass', 'karte']) {
      await page.evaluate(h => { location.hash = h; }, '#/' + v); await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SHOTS, base + '-' + v + '.png') });
    }
    const ueberlauf = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(!ueberlauf && probleme.length === 0, `Darstellung ${base}: kein seitliches Scrollen, keine Fehler, Enthüllung ${moment ? 'gesehen' : 'nicht gesehen'}`);
    await ctx.close();
  }
}
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log(fehler ? '\n✗ ' + fehler + ' Fehler' : '\n✓ Abnahme-Spieler bestanden');
process.exit(fehler ? 1 : 0);

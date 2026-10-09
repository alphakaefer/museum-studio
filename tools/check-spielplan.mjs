#!/usr/bin/env node
// Museum Studio – Prüfung eines Spielplans (Format spielplan/0, docs/spielplan-standard.md, Abschnitt 10).
//
//   node tools/check-spielplan.mjs <datei.yaml | datei.json | paket> [--streng] [--json]
//
// <paket> ist der Ordnername unter packs/ (geprüft wird packs/<paket>/spielplan.json, ersatzweise .yaml).
// Lädt YAML oder JSON, ruft Spielplan.pruefe auf (engine/js/spielplan.js) und meldet auf Deutsch, immer mit der Einheiten-ID:
//   Fehler:    unbekannte ids in in, uebt, braucht, nach, mit, wartezeit und in Regeln; doppelte ids; unbekannte Arten, gewicht, sichtbar;
//              skill ohne kann; Einheiten, die nie aufgehen (Erreichbarkeitsrechnung, Zyklen ohne Einstieg, Stufen über stufen.bis);
//              ungültige Bedingungen und Rhythmus-Angaben
//   Warnungen: Regeln ohne enthuellung; episode ohne etappe; quest ohne staerke; unbekannte Sorte; mehr als ein Drittel verborgen;
//              Sammel-Einheiten ohne Inhalt oder nur mit optionalen Einheiten; Felder an der falschen Art
// Exit-Code 1 bei Fehlern (mit --streng auch bei Warnungen), 2 bei Aufrufproblemen. --json gibt das Ergebnis maschinenlesbar aus.
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { newReport, ROOT, isMain } from './check-lib.mjs';
import { parseDatei, YamlFehler } from './yaml-lite.mjs';

/**
 * Lädt engine/js/spielplan.js (und optional spielplan-adapter.js) wie ein Browser: als klassisches Skript mit window.
 * Läuft im eigenen Realm (runInThisContext), die Ergebnisse sind also gewöhnliche Objekte. Gibt { Spielplan, window } zurück.
 */
export function ladeKern({ adapter = false, window: vorgabe = {} } = {}) {
  const win = Object.defineProperties({}, Object.getOwnPropertyDescriptors(vorgabe));      // Zugriffsfunktionen (Getter) bleiben erhalten
  const hatte = Object.prototype.hasOwnProperty.call(globalThis, 'window'), vorher = globalThis.window;
  globalThis.window = win;
  try {
    const dateien = ['spielplan.js'].concat(adapter ? ['spielplan-adapter.js'] : []);
    for (const f of dateien) {
      const datei = path.join(ROOT, 'engine', 'js', f);
      vm.runInThisContext(fs.readFileSync(datei, 'utf8'), { filename: datei });
    }
  } finally {
    if (hatte) globalThis.window = vorher; else delete globalThis.window;
  }
  return { Spielplan: win.Spielplan, window: win };
}

/** Argument (Datei oder Paketname) -> Dateipfad des Spielplans. */
export function findeSpielplan(arg) {
  if (!arg) return null;
  if (fs.existsSync(arg) && fs.statSync(arg).isFile()) return path.resolve(arg);
  const dir = /[\\/]/.test(arg) ? path.resolve(arg) : path.join(ROOT, 'packs', arg);
  for (const n of ['spielplan.json', 'spielplan.yaml', 'spielplan.yml']) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Spielplan laden und prüfen. Wirft YamlFehler bei unlesbarer Datei. */
export function pruefeDatei(datei, kern) {
  const K = kern || ladeKern().Spielplan;
  const plan = parseDatei(fs.readFileSync(datei, 'utf8'), path.relative(ROOT, datei));
  return { plan, ergebnis: K.pruefe(plan) };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const pos = argv.filter(a => !a.startsWith('--')), flags = new Set(argv.filter(a => a.startsWith('--')));
  if (!pos.length) {
    console.error('Aufruf: node tools/check-spielplan.mjs <datei.yaml | datei.json | paket> [--streng] [--json]\n  Für ein Paket wird packs/<paket>/spielplan.json geprüft.');
    process.exit(2);
  }
  const datei = findeSpielplan(pos[0]);
  if (!datei) {
    console.error(`✗ Kein Spielplan gefunden: „${pos[0]}“ ist weder eine Datei noch ein Paket mit packs/<paket>/spielplan.json.`);
    process.exit(2);
  }
  let r;
  try { r = pruefeDatei(datei); }
  catch (e) {
    if (e instanceof YamlFehler) { console.error('✗ ' + e.message); process.exit(1); }
    throw e;
  }
  const rel = path.relative(ROOT, datei);
  if (flags.has('--json')) {
    console.log(JSON.stringify({ datei: rel, ...r.ergebnis }, null, 2));
    process.exit(r.ergebnis.fehler.length || (flags.has('--streng') && r.ergebnis.warnungen.length) ? 1 : 0);
  }
  const rep = newReport();
  r.ergebnis.fehler.forEach(m => rep.err(m));
  r.ergebnis.warnungen.forEach(m => (flags.has('--streng') ? rep.err(m + ' (streng: Warnung gilt als Fehler)') : rep.warn(m)));
  const i = r.ergebnis.info;
  const arten = Object.entries(i.arten || {}).filter(([, n]) => n).map(([a, n]) => `${n} ${a}`).join(', ');
  console.log(`Spielplan ${r.plan && r.plan.id ? r.plan.id : '(ohne id)'} (${rel}): ${i.einheiten} Einheiten (${arten}), ${i.regeln} Regeln, höchste Stufe ${i.stufenBis}`);
  for (const w of rep.warnings) console.log('! Warnung: ' + w);
  if (rep.errors.length) {
    console.log(rep.errors.map(e => '✗ Fehler: ' + e).join('\n'));
    console.log(`\n${rep.errors.length} Fehler${rep.warnings.length ? `, ${rep.warnings.length} Warnungen` : ''}`);
    process.exit(1);
  }
  console.log(`✓ Spielplan in Ordnung${rep.warnings.length ? ` (${rep.warnings.length} Warnungen)` : ''}`);
}

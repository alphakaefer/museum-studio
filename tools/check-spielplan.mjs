#!/usr/bin/env node
// Museum Studio – Prüfung eines Spielplans (Format spielplan/0, Abschnitt 10 des Standard-Entwurfs; Überblick: docs/SPIELPLAN-ARBEITSSTAND.md).
//
//   node tools/check-spielplan.mjs <datei.yaml | datei.json | paket> [--streng] [--json] [--bericht] [--wege] [--minuten=4]
//   --bericht  dazu: was beim Start offen ist, Regeln je Reise, Spielzeit (der Aufgabe folgen, Schritte bis alles offen)
//   --wege     dazu: Engpass-Analyse (welche einzelne Einheit würde eine gesperrte Einheit für immer sperren, wenn sie ausfiele); langsamer
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

/* ------------------------------------------------------------------------------------------------------------------
   Auswertungen eines Spielplans mit dem Kern als Spielerin (Auslegungen E10 und E11 in docs/spielplan-auslegung.md):
   startBild (was beim Start offen ist), regelBild (wie viele Regeln je gesperrter Einheit), wegeAnalyse (Engpässe),
   spielzeit (Schritte, wenn man jeweils der nächsten Aufgabe folgt). Alles Rechnung, keine Messung mit Menschen.
   ------------------------------------------------------------------------------------------------------------------ */

const AKTIONSARTEN = ['inhalt', 'quest', 'erlebnis', 'werkzeug', 'episode'];
const TAG_MS = 86400000;

/** Einheiten, an denen man etwas tun kann: Arten wie im Kern, ohne Mitglieder (keine Sammel-Einheit). */
function aktionsfaehige(plan) {
  const eltern = new Set();
  for (const u of plan.einheiten || []) { for (const p of [].concat(u.in || [])) eltern.add(p); for (const s of u.uebt || []) eltern.add(s); }
  return (plan.einheiten || []).filter(u => AKTIONSARTEN.includes(u.art) && !eltern.has(u.id)).map(u => u.id);
}

/** Einheiten, die mindestens eine Regel oder Kurzform (nach, braucht) sperrt. */
function gesperrteEinheiten(plan) {
  const ids = new Set();
  for (const r of plan.regeln || []) for (const z of r.schaltet || []) ids.add(z);
  for (const u of plan.einheiten || []) if (u.nach || (u.braucht && u.braucht.length)) ids.add(u.id);
  return ids;
}

/** Wie viele Regeln (Alternativen) nennen eine Einheit; Kurzformen an der Einheit zählen zusammen als eine. */
function regelZahl(plan, id) {
  const u = (plan.einheiten || []).find(x => x.id === id);
  return (plan.regeln || []).filter(r => (r.schaltet || []).includes(id)).length + (u && (u.nach || (u.braucht && u.braucht.length)) ? 1 : 0);
}

/** Der Spielstand ohne jedes Ereignis: was ist beim Start offen, was angedeutet gesperrt, was verborgen? */
export function startBild(plan, SP, jetzt = '2026-10-09T09:00:00Z') {
  const s = SP.spielstand(plan, [], jetzt);
  const arten = {};
  let verborgen = 0;
  for (const u of plan.einheiten || []) {
    const e = s.einheiten[u.id], a = arten[u.art] || (arten[u.art] = { offen: 0, gesperrt: 0 });
    if (e.zugang === 'offen') a.offen++; else { a.gesperrt++; if (e.sichtbar === 'verborgen') verborgen++; }
  }
  const offen = Object.values(arten).reduce((n, a) => n + a.offen, 0), gesperrt = Object.values(arten).reduce((n, a) => n + a.gesperrt, 0);
  return { arten, offen, gesperrt, verborgen, reisenOffen: (arten.episode || { offen: 0 }).offen, reisenGesperrt: (arten.episode || { gesperrt: 0 }).gesperrt,
    aufgabe: s.aufgabe, gesperrteIds: (plan.einheiten || []).filter(u => s.einheiten[u.id].zugang !== 'offen').map(u => u.id) };
}

/** Regeln je gesperrter Einheit der angegebenen Art (Standard: episode): { id, regeln } und das Minimum. */
export function regelBild(plan, art = 'episode') {
  const gesperrt = gesperrteEinheiten(plan);
  const liste = (plan.einheiten || []).filter(u => u.art === art && gesperrt.has(u.id)).map(u => ({ id: u.id, regeln: regelZahl(plan, u.id) }));
  return { art, ziele: liste, minimum: liste.length ? Math.min(...liste.map(x => x.regeln)) : null };
}

/** Das Ereignis, das eine Einheit auf die höchste vergebene Stufe bringt (bis = stufen.bis, Museum: 2). */
function volleEreignisse(id, bis, zeit) {
  const e = (verb, extra) => Object.assign({ wer: 'lokal:sim', verb, objekt: id, zeit }, extra);
  if (bis <= 1) return [e('begonnen')];
  if (bis === 2) return [e('geschafft')];
  const a = e('angewendet', { beleg: { art: 'eigen', fall: 'a' } });
  return bis === 3 ? [a] : [a, e('angewendet', { beleg: { art: 'eigen', fall: 'b' } })];
}

/**
 * Engpass-Analyse (Auslegung G3 und E10): Für jede Einheit, an der man etwas tun kann, spielt der Kern eine Spielerin, die diese eine Einheit nie anfasst,
 * alles andere Offene aber bis zur höchsten Stufe spielt und beliebig lange wartet. Was dadurch nie mehr aufgeht, hat diese Einheit als Engpass.
 * Eine gesperrte Einheit ohne Engpass geht auf, auch wenn irgendein einzelner Schlüssel fehlt. Kandidaten sind kritische Einheiten, in Regeln genannte
 * Einheiten und Mitglieder kleiner Sammlungen (bei höchstens zwei wesentlichen Mitgliedern braucht die Stufe alle).
 */
export function wegeAnalyse(plan, SP, { alleKandidaten = false } = {}) {
  const K = SP.kompiliere(plan), bis = (plan.stufen && plan.stufen.bis) || 4;
  const jetzt = SP.isoZeit(Date.UTC(2200, 0, 1)), t0 = Date.UTC(2030, 0, 1);
  const handlungen = aktionsfaehige(plan), ziele = [...gesperrteEinheiten(plan)];
  const lauf = sperre => {
    const ev = [], fertig = new Set();
    let s = null;
    for (let runde = 0; runde < handlungen.length + 4; runde++) {
      s = SP.spielstand(K, ev, jetzt);
      let neu = false;
      for (const id of handlungen) {
        if (fertig.has(id) || sperre.has(id) || s.einheiten[id].zugang !== 'offen') continue;
        fertig.add(id); neu = true;
        volleEreignisse(id, bis, SP.isoZeit(t0 + ev.length * 60000)).forEach(e => ev.push(e));
      }
      if (!neu) break;
    }
    return new Set((plan.einheiten || []).filter(u => s.einheiten[u.id].zugang === 'offen').map(u => u.id));
  };
  const basis = lauf(new Set());
  // Kandidaten
  const genannt = new Set();
  const sammeln = kn => { if (!kn || typeof kn !== 'object') return; for (const k of ['alle', 'eine', 'von']) for (const c of kn[k] || []) sammeln(c); if (kn.einheit && !/\*/.test(kn.einheit)) genannt.add(kn.einheit); if (kn.wartezeit && kn.wartezeit.einheit) genannt.add(kn.wartezeit.einheit); };
  for (const r of plan.regeln || []) sammeln(r.wenn);
  for (const u of plan.einheiten || []) { if (u.nach) genannt.add(u.nach); for (const w of u.braucht || []) genannt.add(w); }
  const mitglieder = {};
  for (const u of plan.einheiten || []) for (const p of [].concat(u.in || [])) (mitglieder[p] = mitglieder[p] || []).push(u);
  const kleineSammlung = new Set();
  for (const [p, ms] of Object.entries(mitglieder)) { const ws = ms.filter(m => (m.gewicht || 'wesentlich') === 'wesentlich'); if (ws.length <= 2) ms.forEach(m => kleineSammlung.add(m.id)); }
  const kandidaten = handlungen.filter(id => {
    const u = plan.einheiten.find(x => x.id === id);
    return alleKandidaten || u.gewicht === 'kritisch' || genannt.has(id) || kleineSammlung.has(id);
  });
  const engpass = Object.fromEntries(ziele.map(z => [z, []]));
  for (const id of kandidaten) {
    const offen = lauf(new Set([id]));
    for (const z of ziele) if (basis.has(z) && !offen.has(z)) engpass[z].push(id);
  }
  return {
    kandidaten: kandidaten.length,
    ziele: ziele.map(z => { const u = plan.einheiten.find(x => x.id === z); return { id: z, art: u ? u.art : '?', regeln: regelZahl(plan, z), geht_auf: basis.has(z), engpass: engpass[z] }; })
  };
}

/**
 * Spielzeit (Auslegung E11): Eine Spielerin folgt jeweils der einen nächsten Aufgabe. Ein Schritt bringt eine Einheit (Station, Karte, Exponat) auf die
 * höchste vergebene Stufe (Museum: 2); zwischen zwei Schritten vergehen `minuten`. Gibt es nichts zu tun und ist noch etwas gesperrt, vergeht eine Woche.
 * Liefert die Schritte bis zur ersten Freischaltung, bis alles offen ist und bis keine Aufgabe mehr übrig ist, dazu die Momente (Freischaltungen mit Schritt).
 */
export function spielzeit(plan, SP, { minuten = 4, maxSchritte = 8000 } = {}) {
  const K = SP.kompiliere(plan), bis = (plan.stufen && plan.stufen.bis) || 4;
  const ids = (plan.einheiten || []).map(u => u.id), name = Object.fromEntries((plan.einheiten || []).map(u => [u.id, u.name]));
  let t = Date.UTC(2026, 9, 1, 9, 0), schritte = 0, wochen = 0;
  const ev = [], momente = [], gesehen = new Set();
  const res = { schritte: 0, erste: null, alleOffen: null, fertig: null, momente, minuten, wochen: 0, haengt: false, einheitenOffen: 0, einheiten: ids.length };
  let s = null, ohneFortschritt = 0;
  for (let n = 0; n < maxSchritte; n++) {
    s = SP.spielstand(K, ev, SP.isoZeit(t));
    for (const f of s.freigeschaltet) if (!gesehen.has(f.einheit)) { gesehen.add(f.einheit); momente.push({ schritt: schritte, einheit: f.einheit, art: f.art, name: f.name }); if (res.erste === null) res.erste = schritte; }
    const alleOffen = ids.every(id => s.einheiten[id].zugang === 'offen');
    if (alleOffen && res.alleOffen === null) res.alleOffen = schritte;
    if (!s.aufgabe) {
      if (alleOffen) { res.fertig = schritte; break; }
      if (++wochen > 80) { res.haengt = true; break; }
      t += 7 * TAG_MS; continue;
    }
    const a = s.aufgabe, vorher = s.einheiten[a.einheit].stufe;
    if (a.art === 'wiederkehr') ev.push({ wer: 'lokal:sim', verb: 'erkundet', objekt: a.einheit, zeit: SP.isoZeit(t) });
    else volleEreignisse(a.einheit, Math.min(bis, Math.max(a.stufe, 2)), SP.isoZeit(t)).forEach(e => ev.push(e));
    schritte++; t += minuten * 60000;
    if (a.art !== 'wiederkehr' && SP.spielstand(K, ev, SP.isoZeit(t)).einheiten[a.einheit].stufe <= vorher) { if (++ohneFortschritt > 3) { res.haengt = true; break; } } else ohneFortschritt = 0;
  }
  res.schritte = schritte; res.wochen = wochen;
  res.einheitenOffen = ids.filter(id => s && s.einheiten[id].zugang === 'offen').length;
  res.minutenGesamt = schritte * minuten;
  return res;
}

const stundenText = min => (min < 90 ? `${Math.round(min)} Min.` : `${(min / 60).toFixed(1).replace('.', ',')} Std.`);

/** Der Bericht als Zeilen (für check-spielplan und tools/spielplan-aus-plan.mjs). */
export function berichtZeilen(plan, SP, { wege = false, minuten = 4 } = {}) {
  const z = [];
  const st = startBild(plan, SP), rb = regelBild(plan, 'episode');
  const arten = Object.entries(st.arten).filter(([, a]) => a.gesperrt).map(([a, x]) => `${x.gesperrt} ${a}`).join(', ');
  z.push(`Start: ${st.reisenOffen} von ${st.reisenOffen + st.reisenGesperrt} Episoden offen, ${st.reisenGesperrt} angedeutet gesperrt; Einheiten offen ${st.offen}, gesperrt ${st.gesperrt}${arten ? ` (${arten})` : ''}${st.verborgen ? `, davon verborgen ${st.verborgen}` : ''}`);
  if (rb.ziele.length) z.push(`Wege: ${rb.ziele.length} gesperrte ${rb.ziele.length === 1 ? 'Episode' : 'Episoden'}, Regeln je Episode ${rb.ziele.map(x => x.regeln).join('/')} (Minimum ${rb.minimum})`);
  const sz = spielzeit(plan, SP, { minuten });
  const erste = sz.momente[0];
  const schritte = n => (n === null ? '–' : `${n} ${n === 1 ? 'Schritt' : 'Schritten'}`);
  z.push(`Spielzeit (der Aufgabe folgen, ein Schritt = eine Einheit, ${minuten} Min. je Schritt gerechnet): erste Freischaltung nach ${schritte(sz.erste)}${erste ? ` („${erste.name}“)` : ''}, `
    + `alles offen nach ${sz.alleOffen === null ? '–' : schritte(sz.alleOffen) + ' (' + stundenText(sz.alleOffen * minuten) + ')'}, `
    + `keine Aufgabe mehr nach ${sz.fertig === null ? '–' : schritte(sz.fertig) + ' (' + stundenText(sz.fertig * minuten) + ')'}${sz.wochen ? `, dazu ${sz.wochen} Woche(n) Warten` : ''}${sz.haengt ? ' – HÄNGT' : ''}`);
  const epMomente = sz.momente.filter(m => m.art === 'episode' || m.art === 'gebiet');
  if (epMomente.length) z.push(`Momente (Episoden und Gebiete): ${epMomente.map(m => `${m.schritt} ${m.name}`).join(' · ')}`);
  if (wege) {
    const w = wegeAnalyse(plan, SP);
    const mehrere = w.ziele.filter(x => x.regeln >= 2), einer = w.ziele.filter(x => x.regeln < 2);
    const mitEngpass = mehrere.filter(x => x.engpass.length);
    z.push(`Engpässe (${w.kandidaten} Kandidaten einzeln gesperrt, geprüft bei ${mehrere.length} Einheiten mit mindestens zwei Regeln): ${mitEngpass.length ? mitEngpass.length + ' hängen an einer einzelnen Einheit: ' + mitEngpass.slice(0, 6).map(x => `${x.id} ← ${x.engpass.slice(0, 2).join(', ')}${x.engpass.length > 2 ? ' …' : ''}`).join('; ') : 'keine, jede geht auch ohne irgendeine einzelne Einheit auf'}`);
    if (einer.length) z.push(`Nur ein Weg: ${einer.length} gesperrte Einheiten (${[...new Set(einer.map(x => x.art))].join(', ')}), bewusst eine Freischaltung nach einer Station oder einem Meilenstein`);
    const nie = w.ziele.filter(x => !x.geht_auf);
    if (nie.length) z.push(`Geht nie auf: ${nie.map(x => x.id).join(', ')}`);
  }
  return z;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const pos = argv.filter(a => !a.startsWith('--')), flags = new Set(argv.filter(a => a.startsWith('--') && !a.startsWith('--minuten=')));
  const minutenArg = argv.find(a => a.startsWith('--minuten=')), minuten = minutenArg ? Math.max(1, Number(minutenArg.slice(10)) || 4) : 4;
  if (!pos.length) {
    console.error('Aufruf: node tools/check-spielplan.mjs <datei.yaml | datei.json | paket> [--streng] [--json] [--bericht] [--wege] [--minuten=4]\n  Für ein Paket wird packs/<paket>/spielplan.json geprüft.\n  --bericht: dazu Start, Regeln je Reise und Spielzeit (der Aufgabe folgen); --wege: dazu die Engpass-Analyse (langsamer).');
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
  if (flags.has('--bericht') || flags.has('--wege')) for (const z of berichtZeilen(r.plan, ladeKern().Spielplan, { wege: flags.has('--wege'), minuten })) console.log('  ' + z);
}

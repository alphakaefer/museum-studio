#!/usr/bin/env node
// Museum Studio – Test des Spielplan-Generators (tools/spielplan-aus-plan.mjs) und der Auswertungen in tools/check-spielplan.mjs.
//
//   node tools/spielplan-generator-test.mjs
//
// Baut Wegwerf-Pakete (1, 2, 4 und 8 Reisen, mit und ohne Mythos-Karten, Kreuzungen, Exponate, Werkzeug-Reise, historische Reise) in einem
// temporären Ordner, lässt den Generator mit --auto darauf laufen und prüft, was der Auftrag verlangt:
//   - jede Ausgabe besteht Spielplan.pruefe ohne Fehler und Warnungen (außer der dokumentierten bei fehlender Mythos-Karte),
//   - ein Drittel der Reisen offen (mindestens eine, höchstens vier), jede gesperrte Reise mit mindestens zwei Regeln,
//   - keine einzelne Einheit sperrt etwas für immer (Engpass-Analyse), alles geht beim Spielen auf (Spielzeit),
//   - gleiche Eingabe, gleiche Ausgabe (kanonisches JSON), kein Fachbezug im Quelltext des Generators.
// Dazu die echten Beispielpakete, soweit sie im Repository liegen. Keine Abhängigkeiten, kein Netz.
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { ROOT, resolvePack } from './check-lib.mjs';
import { ladeKern, startBild, spielzeit, wegeAnalyse, regelBild } from './check-spielplan.mjs';
import { leiteAb, autoKern, leseKern } from './spielplan-aus-plan.mjs';

const { Spielplan: SP } = ladeKern();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-gen-'));
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
const gleich = (a, b, m) => assert.deepStrictEqual(a, b, m);
const wahr = (c, m) => assert.ok(c, m);

/** Wegwerf-Paket: reisen Reisen mit je `je` Stationen; die letzten `kreuz` Stationen jeder Reise liegen auch auf der nächsten. */
function bauePaket(name, o = {}) {
  const { reisen = 3, je = 12, kreuz = 3, exponate = true, mythos = true, werkzeugReise = false, historisch = 0, vocab, vertiefung = false } = o;
  const dir = path.join(TMP, name);
  fs.mkdirSync(path.join(dir, 'stationen'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'exhibits'), { recursive: true });
  const journeys = [], stations = [], orders = {};
  for (let r = 0; r < reisen; r++) {
    const jid = 'r' + (r + 1), hist = r >= reisen - historisch;
    journeys.push({ id: jid, typ: hist ? 'historisch' : 'funktional', name: `Reise ${r + 1}`, kurz: `R${r + 1}`, tagline: `Tagline der Reise ${r + 1}`, intro: `Erster Satz ${r + 1}. Zweiter Satz. Dritter Satz. Vierter.`, outro: `Abschluss eins ${r + 1}. Abschluss zwei.`, ...(werkzeugReise && r === reisen - 1 ? { tool: true } : {}) });
    orders[jid] = [];
    for (let k = 0; k < je; k++) {
      const sid = `s${r + 1}-${k + 1}`;
      stations.push({ id: sid, title: `Station ${r + 1}.${k + 1}`, kind: mythos && k === 2 ? 'mythos' : (k % 3 === 0 ? 'methode' : 'konzept'), journeys: [jid], why: vertiefung && k === je - 1 ? 'Eine Vertiefung für Neugierige.' : 'Darum.', ...(exponate && k === 1 ? { exhibit: `ex${r + 1}` } : {}) });
      orders[jid].push(sid);
    }
  }
  for (let r = 0; r < reisen - 1; r++) for (let k = 0; k < kreuz; k++) {
    const s = stations.find(x => x.id === `s${r + 1}-${je - k}`);
    s.journeys.push('r' + (r + 2));
    const weg = `s${r + 2}-${k + 4}`;                      // die Kreuzungsstation ersetzt eine eigene Station der nächsten Reise
    stations.splice(stations.findIndex(x => x.id === weg), 1);
    orders['r' + (r + 2)] = orders['r' + (r + 2)].filter(x => x !== weg);
    orders['r' + (r + 2)].splice(1 + k, 0, s.id);
  }
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ journeys: journeys.map(j => ({ id: j.id, typ: j.typ, name: j.name })), stations, orders }));
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({ id: name, title: 'Wegwerf', ...(vocab ? { vocab } : {}), journeyTypes: { funktional: 'Funktionale Reisen', historisch: { pl: 'Historische Reisen', sg: 'Historische Reise', sub: 'Wege durch die Zeit' } } }));
  fs.writeFileSync(path.join(dir, 'journeys.js'), `(function(){window.MUSEUM=window.MUSEUM||{};MUSEUM.data=MUSEUM.data||{};MUSEUM.data.journeys=${JSON.stringify(journeys)};})();`);
  const st = Object.fromEntries(stations.map(s => [s.id, { id: s.id, title: s.title, kind: s.kind, journeys: s.journeys, teaser: `Teaser zu ${s.title}.`, text: ['x'], myth: s.kind === 'mythos' ? { glaube: 'a', wahrheit: 'b' } : null, exhibit: s.exhibit || null }]));
  fs.writeFileSync(path.join(dir, 'stationen', 's.js'), `window.MUSEUM=window.MUSEUM||{};window.MUSEUM.addStations(${JSON.stringify(st)});`);
  for (const s of stations) if (s.exhibit) fs.writeFileSync(path.join(dir, 'exhibits', s.exhibit + '.js'), `window.MUSEUM.exhibits=window.MUSEUM.exhibits||{};window.MUSEUM.exhibits['${s.exhibit}']={title:'Exponat ${s.exhibit}'};`);
  return dir;
}

const jetzt = '2026-10-09T09:00:00Z';
/** Generator mit --auto (und optional Kern) auf ein Paket anwenden und alles prüfen, was für jedes Ergebnis gilt. */
function auto(dir, { kern = null, nichtPruefen = false, zuordnung = true } = {}) {
  const P = resolvePack(dir);
  const { R, spielplan, meta } = leiteAb(P, { auto: true, kern, zuordnung });
  gleich(R.errors, [], 'Fehler des Generators');
  wahr(spielplan, 'kein Spielplan');
  const p = SP.pruefe(spielplan);
  if (!nichtPruefen) { gleich(p.fehler, [], 'Fehler der Prüfung'); }
  return { plan: spielplan, meta, pruef: p, R };
}
const episoden = plan => plan.einheiten.filter(u => u.art === 'episode');
const regelnFuer = (plan, id) => plan.regeln.filter(r => r.schaltet.includes(id));

/* ---------------------------------------------------------------- Pakete verschiedener Größe */

test('Eine Reise: Kapitel statt gesperrter Reisen, spielbar, ohne Fehler und Warnungen', () => {
  const { plan, pruef } = auto(bauePaket('eins', { reisen: 1, je: 14, kreuz: 0 }));
  gleich(pruef.warnungen, []);
  gleich(episoden(plan).length, 1);
  gleich(plan.einheiten.filter(u => u.art === 'gebiet').length, 0, 'bei einer Reise kein Gebiet');
  const kapitel = plan.regeln.filter(r => r.id.startsWith('kapitel-'));
  wahr(kapitel.length >= 2 && kapitel.every(r => r.enthuellung.length > 20), 'zwei Kapitel-Übergänge mit Enthüllung');
  const st = startBild(plan, SP, jetzt);
  gleich(st.reisenOffen, 1); wahr(st.gesperrt > 0 && st.offen > 0, 'ein Teil der Stationen ist angedeutet gesperrt, ein Teil offen');
  const z = spielzeit(plan, SP, {});
  wahr(z.erste !== null && z.erste <= 3, `erste Freischaltung nach höchstens drei Schritten (${z.erste})`);
  wahr(z.alleOffen !== null && z.fertig !== null && !z.haengt, 'alles geht auf, am Ende keine Aufgabe');
});

test('Zwei Reisen (kleiner Fall): eine offen, eine gesperrt mit zwei Wegen, erster Moment nach höchstens zwei Schritten', () => {
  const { plan, pruef } = auto(bauePaket('zwei', { reisen: 2, je: 12, kreuz: 2, historisch: 1 }));
  gleich(pruef.warnungen, []);
  const st = startBild(plan, SP, jetzt);
  gleich([st.reisenOffen, st.reisenGesperrt], [1, 1]);
  gleich(plan.einheiten.filter(u => u.art === 'gebiet').length, 0, 'zwei Reisen unterschiedlichen Typs brauchen kein Gebiet');
  const r = regelnFuer(plan, 'episode/r2');
  wahr(r.length >= 2, 'mindestens zwei Regeln');
  wahr(r.every(x => x.enthuellung && x.enthuellung.includes('Reise 2')), 'jede Enthüllung nennt die Reise');
  const e = Object.fromEntries(episoden(plan).map(u => [u.id, u]));
  gleich([e['episode/r1'].etappe, e['episode/r2'].etappe], ['onboarding', 'entdecken'], 'historische Reise: entdecken');
  const z = spielzeit(plan, SP, {});
  wahr(z.erste <= 2 && z.alleOffen !== null, `erste Freischaltung nach ${z.erste} Schritten`);
  gleich(wegeAnalyse(plan, SP).ziele.filter(x => x.regeln >= 2 && x.engpass.length), [], 'kein Engpass');
});

test('Acht Reisen: ein Drittel offen (aus beiden Teilen des Gebiets), die übrigen mit mindestens zwei Regeln, ohne Engpass, alles geht auf', () => {
  const { plan, pruef, meta } = auto(bauePaket('acht', { reisen: 8, je: 14, kreuz: 2 }));
  gleich(pruef.warnungen, []);
  const gebiete = plan.einheiten.filter(u => u.art === 'gebiet');
  gleich(gebiete.length, 2, 'ab sechs Reisen eines Typs wird das Gebiet geteilt');
  wahr(gebiete.every(g => /Teil \d/.test(g.name)));
  const st = startBild(plan, SP, jetzt);
  gleich([st.reisenOffen, st.reisenGesperrt], [3, 5]);
  const offen = meta.offen.map(id => episoden(plan).find(u => u.id === 'episode/' + id).in);
  gleich(new Set(offen).size, 2, 'offene Reisen kommen aus beiden Gebieten');
  const rb = regelBild(plan);
  gleich(rb.ziele.length, 5); wahr(rb.minimum >= 2, `Minimum ${rb.minimum}`);
  gleich(wegeAnalyse(plan, SP).ziele.filter(x => x.regeln >= 2 && x.engpass.length), [], 'kein Engpass');
  const z = spielzeit(plan, SP, {});
  wahr(z.alleOffen !== null && z.fertig !== null && !z.haengt, 'alles geht auf');
  wahr(z.erste <= 2, `erste Freischaltung nach ${z.erste} Schritten`);
  gleich(plan.einheiten.filter(u => u.art === 'episode' && u.etappe === 'endgame').length, 1, 'genau eine Endgame-Reise');
});

test('Viele Reisen: höchstens vier offen (16 Reisen)', () => {
  const { plan } = auto(bauePaket('sechzehn', { reisen: 16, je: 11, kreuz: 1 }), { nichtPruefen: true });
  const st = startBild(plan, SP, jetzt);
  gleich(st.reisenOffen, 4);
  gleich(plan.einheiten.filter(u => u.art === 'gebiet').length, 4, 'vier Gebiete zu je vier Reisen');
});

test('Ohne Kreuzungen und ohne Exponate bleibt jede gesperrte Reise erreichbar: die Zeit allein öffnet als letzter Weg', () => {
  const { plan, pruef } = auto(bauePaket('ohnekreuz', { reisen: 4, je: 12, kreuz: 0, exponate: false }));
  gleich(pruef.warnungen, []);
  for (const e of episoden(plan).filter(u => u.id !== 'episode/r1')) wahr(regelnFuer(plan, e.id).length >= 2, e.id);
  wahr(plan.regeln.some(r => r.wenn.takt !== undefined), 'Rückfall auf den Takt');
  const z = spielzeit(plan, SP, {});
  wahr(z.alleOffen !== null && z.fertig !== null && !z.haengt);
});

test('Ohne Mythos-Karten: kein Fehler, Hinweis statt endgame, die Prüfung warnt nur vor dem Onboarding ohne Quest', () => {
  const { plan, pruef, R } = auto(bauePaket('ohnemythos', { reisen: 3, je: 12, kreuz: 2, mythos: false }));
  gleich(plan.einheiten.filter(u => u.art === 'quest').length, 0);
  gleich(plan.einheiten.filter(u => u.etappe === 'endgame').length, 0, 'ohne Quest der Stärke 3 kein endgame');
  gleich(pruef.warnungen.length, 1); wahr(/onboarding ohne Quest/.test(pruef.warnungen[0]));
  wahr(R.hinweise.some(h => /keine Mythos-Karte/.test(h)), R.hinweise.join(' | '));
});

test('Mythos-Karten: Stärke nach der Etappe der Heimat-Reise (1, 2, 3), Gewicht: Kreuzungen und erste Stationen kritisch, Mythos wesentlich, Vertiefung optional', () => {
  const { plan, pruef } = auto(bauePaket('gewicht', { reisen: 3, je: 12, kreuz: 2, vertiefung: true }));
  gleich(pruef.warnungen, []);
  const q = Object.fromEntries(plan.einheiten.filter(u => u.art === 'quest').map(u => [u.id, u.staerke]));
  gleich(q, { 'quest/s1-3-mythos': 1, 'quest/s2-3-mythos': 2, 'quest/s3-3-mythos': 3 });
  const g = id => plan.einheiten.find(u => u.id === id).gewicht;
  gleich([g('inhalt/s1-1'), g('inhalt/s1-2'), g('inhalt/s2-1'), g('inhalt/s1-12'), g('inhalt/s1-11')], ['kritisch', 'kritisch', 'kritisch', 'optional', 'kritisch'], 'erste und Kreuzungsstationen; „Vertiefung“ im why geht vor der Kreuzung');
  gleich([g('inhalt/s1-3'), g('inhalt/s1-4')], [undefined, undefined], 'Mythos und übrige wesentlich (Standard)');
  gleich(g('inhalt/s3-12'), 'optional', 'why nennt Vertiefung');
});

test('Werkzeug-Reise und historische Reise: ein Werkzeug je Station der Arten konzept, methode, instrument, offen nach der Station, als Nebenquest', () => {
  const { plan, pruef } = auto(bauePaket('werkzeug', { reisen: 4, je: 12, kreuz: 1, werkzeugReise: true, historisch: 1 }), { nichtPruefen: true });
  gleich(pruef.fehler, []);
  const w = plan.einheiten.filter(u => u.art === 'werkzeug');
  wahr(w.length > 0 && w.every(u => u.gewicht === 'optional' && u.adresse.startsWith('#/station/') && ['modell', 'methode', 'technik'].includes(u.sorte)));
  for (const u of w) {
    const r = plan.regeln.filter(x => x.schaltet.includes(u.id));
    gleich(r.length, 1); gleich(r[0].wenn, { einheit: 'inhalt/' + u.id.slice(9), stufe: 2 });
    wahr(r[0].enthuellung.startsWith('Neu in deiner Ausrüstung:'), r[0].enthuellung);
  }
});

test('Wortschatz des Pakets: abweichende Wörter ohne Artikel ergeben einen Hinweis, mit Artikel keinen', () => {
  const dir = bauePaket('vokabel', { reisen: 3, je: 12, vocab: { journey: 'Pfad', journeys: 'Pfade', station: 'Halt', stations: 'Halte' } });
  let { plan, R } = auto(dir);
  gleich([plan.begriffe.episode.sg, plan.begriffe.inhalt.pl], ['Pfad', 'Halte']);
  wahr(R.hinweise.filter(h => /Artikel/.test(h)).length === 2, R.hinweise.join(' | '));
  const dir2 = bauePaket('vokabel2', { reisen: 3, je: 12, vocab: { journey: 'Pfad', journeys: 'Pfade', journeyArticle: 'der', station: 'Station', stations: 'Stationen' } });
  ({ plan, R } = auto(dir2));
  gleich(plan.begriffe.episode.art, 'der'); gleich(R.hinweise.filter(h => /Artikel/.test(h)), []);
});

/* ---------------------------------------------------------------- Betriebsarten und Eigenschaften */

test('Gleiche Eingabe, gleiche Ausgabe: zweimal erzeugt ist byte-gleich; Schlüssel stehen in fester Reihenfolge', () => {
  const dir = bauePaket('gleich', { reisen: 5, je: 12, kreuz: 2 });
  const a = JSON.stringify(auto(dir).plan, null, 2), b = JSON.stringify(auto(dir).plan, null, 2);
  gleich(a, b);
  const p = JSON.parse(a);
  gleich(Object.keys(p), ['format', 'id', 'name', 'basis', 'nur_lokal', 'stufen', 'begriffe', 'rhythmus', 'einheiten', 'regeln']);
  gleich(Object.keys(p.regeln[0]), ['id', 'schaltet', 'wenn', 'enthuellung']);
  gleich(p.nur_lokal, true); gleich(p.stufen, { anteil: '2/3', bis: 2 });
  gleich(p.rhythmus.wiederkehr.abstand_tage, [2, 7, 21]); gleich(p.rhythmus.verfall_tage, 35); gleich(p.rhythmus.takt, { laenge: 'woche', beginn: 'erstes-ereignis' });
});

test('--skelett: alles offen, keine Regeln; ohne Schalter und ohne Kern: Einheiten ohne Regeln', () => {
  const dir = bauePaket('skelett', { reisen: 3, je: 12 });
  const P = resolvePack(dir);
  let r = leiteAb(P, { skelett: true });
  gleich(r.spielplan.regeln, []);
  gleich(startBild(r.spielplan, SP, jetzt).gesperrt, 0);
  r = leiteAb(P, {});
  gleich(r.spielplan.regeln, []); gleich(SP.pruefe(r.spielplan).fehler, []);
});

test('Kern über Automatik: ersetzte Regeln, offene Einheiten, eigene Etappe und Skills; der Generator nennt, was er ersetzt', () => {
  const dir = bauePaket('kern', { reisen: 4, je: 12, kreuz: 2 });
  const kern = {
    offen: ['episode/r2'],
    episoden_zusatz: [{ id: 'r3', etappe: 'entdecken', auftakt: 'Eigener Auftakt.' }],
    regeln: [{ id: 'eigen-r4', schaltet: ['episode/r4'], wenn: { einheit: 'episode/r3', stufe: 2 }, enthuellung: 'Eine eigene Tür.' }],
    skills: [{ id: 'skill/x', name: 'X', kann: 'Ich kann X.', geuebt_durch: ['inhalt/s1-1'] }],
    gewichte: { optional: ['inhalt/s1-1'] }
  };
  const { plan, R } = auto(dir, { kern });
  const st = startBild(plan, SP, jetzt);
  wahr(st.gesperrteIds.includes('episode/r3') && !st.gesperrteIds.includes('episode/r2'), 'r2 bleibt offen (Kern), r3 gesperrt');
  gleich(regelnFuer(plan, 'episode/r4').map(r => r.id), ['eigen-r4'], 'Regeln der Automatik für r4 entfallen');
  gleich(regelnFuer(plan, 'episode/r2'), [], 'für r2 keine Regel mehr');
  const e = id => plan.einheiten.find(u => u.id === id);
  gleich([e('episode/r3').etappe, e('episode/r3').auftakt], ['entdecken', 'Eigener Auftakt.']);
  gleich(e('inhalt/s1-1').gewicht, 'optional'); gleich(e('inhalt/s1-1').uebt, ['skill/x']);
  wahr(R.hinweise.some(h => /eigen-r4|episode\/r4/.test(h)) && R.hinweise.some(h => /bleibt offen/.test(h)) && R.hinweise.some(h => /episode\/r3/.test(h) && /etappe/.test(h)), R.hinweise.join('\n'));
});

test('Kern-Datei als YAML: --kern=datei, Fehler mit Zeilennummer, fehlende Datei', () => {
  const dir = bauePaket('yaml', { reisen: 3, je: 12 });
  fs.writeFileSync(path.join(dir, 'k.yaml'), 'offen: [episode/r2]\nrhythmus:\n  takt: { laenge: tag }\n');
  const P = resolvePack(dir), R0 = { errors: [], warnings: [], err(m) { this.errors.push(m); }, warn(m) { this.warnings.push(m); } };
  const { kern } = leseKern(P, R0, path.join(dir, 'k.yaml'));
  gleich(kern.rhythmus.takt, { laenge: 'tag' });
  const { plan } = auto(dir, { kern });
  gleich(plan.rhythmus, { takt: { laenge: 'tag' } }, 'Kern ersetzt den Rhythmus');
  fs.writeFileSync(path.join(dir, 'k2.yaml'), 'a: [1, 2\n');
  leseKern(P, R0, path.join(dir, 'k2.yaml')); wahr(R0.errors.length === 1 && /Zeile/.test(R0.errors[0]), R0.errors.join(' '));
  leseKern(P, R0, path.join(dir, 'gibtsnicht.yaml')); wahr(R0.errors.length === 2 && /nicht gefunden/.test(R0.errors[1]));
});

test('Zuordnung: gewicht, uebt, staerke, name und reihenfolge an Stationen und an vollen Einheiten-ids', () => {
  const dir = bauePaket('zuordnung', { reisen: 2, je: 12, kreuz: 1 });
  fs.mkdirSync(path.join(dir, 'spielplan-zuordnung'));
  fs.writeFileSync(path.join(dir, 'spielplan-zuordnung', 'a.json'), JSON.stringify({ 's1-1': { gewicht: 'optional', uebt: ['x'] }, 'quest/s1-3-mythos': { staerke: 2, name: 'Eigener Name', reihenfolge: 0 } }));
  const kern = { skills: [{ id: 'skill/x', name: 'X', kann: 'Ich kann X.' }] };
  const { plan } = auto(dir, { kern });
  const e = id => plan.einheiten.find(u => u.id === id);
  gleich([e('inhalt/s1-1').gewicht, e('inhalt/s1-1').uebt], ['optional', ['skill/x']]);
  gleich([e('quest/s1-3-mythos').staerke, e('quest/s1-3-mythos').name, e('quest/s1-3-mythos').reihenfolge], [2, 'Eigener Name', 0]);
});

test('Texte: Enthüllungen nennen Namen aus den Paketdaten, enden mit Satzzeichen und enthalten kein Fachwort des Generators', () => {
  const { plan } = auto(bauePaket('texte', { reisen: 5, je: 12, kreuz: 2 }));
  wahr(plan.regeln.length >= 8);
  for (const r of plan.regeln) {
    wahr(/[.!?]$/.test(r.enthuellung), r.enthuellung);
    wahr(r.enthuellung.length < 280, 'ein bis zwei Sätze: ' + r.enthuellung);
    wahr(/Reise \d/.test(r.enthuellung), r.enthuellung);
  }
  for (const u of plan.einheiten.filter(x => x.art === 'episode')) wahr(u.auftakt && u.abschluss && /Tagline der Reise/.test(u.auftakt), u.id);
});

test('Spielbarkeit: der Aufgabe folgen öffnet alles und bringt alles auf Stufe 2; jede Aufgabe ist offen, kein Schritt ohne Wirkung', () => {
  for (const [name, o] of [['sp1', { reisen: 1, je: 14, kreuz: 0 }], ['sp3', { reisen: 3, je: 12, kreuz: 2 }], ['sp6', { reisen: 6, je: 12, kreuz: 1, historisch: 2 }]]) {
    const { plan } = auto(bauePaket(name, o), { nichtPruefen: true });
    const z = spielzeit(plan, SP, {});
    wahr(!z.haengt && z.fertig !== null && z.alleOffen !== null, `${name}: ${JSON.stringify({ ...z, momente: z.momente.length })}`);
    gleich(z.einheitenOffen, z.einheiten, `${name}: alles offen`);
    const nur = plan.einheiten.filter(u => ['inhalt', 'quest', 'erlebnis', 'werkzeug'].includes(u.art));
    wahr(z.fertig >= nur.length * 0.9, `${name}: Schritte ${z.fertig} für ${nur.length} Einheiten`);
  }
});

test('Vorlage docs/spielplan-vorlage-kern.yaml: lässt sich lesen, nennt jeden Abschnitt des Kerns und ergibt mit einem passenden Paket einen gültigen Spielplan', () => {
  const datei = path.join(ROOT, 'docs', 'spielplan-vorlage-kern.yaml'), text = fs.readFileSync(datei, 'utf8');
  for (const k of ['id', 'name', 'basis', 'nur_lokal', 'stufen', 'offen', 'gebiete', 'episoden_zusatz', 'gewichte', 'quests', 'aufgaben', 'skills', 'werkzeuge', 'regeln', 'rhythmus', 'begriffe', 'quest_vorsatz', 'einheiten'])
    wahr(new RegExp(`^#?${k}:`, 'm').test(text), `Abschnitt ${k} fehlt in der Vorlage`);
  wahr(/Sprachenlernen/.test(text) && /Sensible Themen/.test(text) && /Freier Zugang/.test(text) && /Wiederkehr ist für Wortschatz/.test(text), 'Hinweise für Sprachenlernen und sensible Themen');
  // ein Paket, zu dem die Ids der Vorlage passen
  const dir = path.join(TMP, 'garten');
  fs.mkdirSync(path.join(dir, 'stationen'), { recursive: true }); fs.mkdirSync(path.join(dir, 'exhibits'), { recursive: true });
  const J = ['saeen', 'pflege', 'ernte'].map(id => ({ id, typ: 'funktional', name: id[0].toUpperCase() + id.slice(1), tagline: 'Ein Satz', intro: 'Eins. Zwei.', outro: 'Ende. Gut.' }));
  const S = [
    ['boden', 'konzept', ['saeen']], ['erde', 'konzept', ['saeen'], 'bodenprobe'], ['mondkalender', 'mythos', ['saeen']], ['pflanzplan', 'methode', ['saeen']],
    ['giessen', 'konzept', ['pflege']], ['schnitt', 'methode', ['pflege', 'ernte']], ['ernte-1', 'konzept', ['ernte']]
  ].map(([id, kind, journeys, exhibit]) => ({ id, title: id, kind, journeys, why: 'Darum.', ...(exhibit ? { exhibit } : {}) }));
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ journeys: J.map(j => ({ id: j.id, typ: j.typ, name: j.name })), stations: S, orders: Object.fromEntries(J.map(j => [j.id, S.filter(s => s.journeys.includes(j.id)).map(s => s.id)])) }));
  fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify({ id: 'garten', title: 'Garten' }));
  fs.writeFileSync(path.join(dir, 'journeys.js'), `(function(){window.MUSEUM=window.MUSEUM||{};MUSEUM.data=MUSEUM.data||{};MUSEUM.data.journeys=${JSON.stringify(J)};})();`);
  fs.writeFileSync(path.join(dir, 'stationen', 's.js'), `window.MUSEUM=window.MUSEUM||{};window.MUSEUM.addStations(${JSON.stringify(Object.fromEntries(S.map(s => [s.id, { ...s, myth: s.kind === 'mythos' ? { glaube: 'a', wahrheit: 'b' } : null, text: ['x'] }])))});`);
  fs.writeFileSync(path.join(dir, 'exhibits', 'bodenprobe.js'), `window.MUSEUM.exhibits=window.MUSEUM.exhibits||{};window.MUSEUM.exhibits['bodenprobe']={title:'Bodenprobe'};`);
  const R0 = { errors: [], warnings: [], err(m) { this.errors.push(m); }, warn(m) { this.warnings.push(m); } };
  const { kern } = leseKern(resolvePack(dir), R0, datei);
  gleich(R0.errors, []); wahr(kern && kern.regeln.length === 4 && kern.skills.length === 1);
  for (const auto_ of [false, true]) {
    const r = leiteAb(resolvePack(dir), { auto: auto_, kern });
    gleich(r.R.errors, [], 'Fehler des Generators'); gleich(r.R.warnings, [], 'Warnungen des Generators');
    const p = SP.pruefe(r.spielplan);
    gleich(p.fehler, [], 'Fehler der Prüfung'); gleich(p.warnungen, [], 'Warnungen der Prüfung (auto: ' + auto_ + ')');
    const e = id => r.spielplan.einheiten.find(u => u.id === id);
    gleich([e('episode/pflege').etappe, e('skill/boden-lesen').uebt, e('inhalt/boden').gewicht], ['scaffolding', undefined, 'kritisch']);
    gleich(e('inhalt/erde') && e('erlebnis/bodenprobe').uebt, ['skill/boden-lesen']);
    gleich(SP.spielstand(r.spielplan, [], jetzt).einheiten['episode/ernte'].zugang, 'offen', 'offen: [episode/ernte]');
  }
});

/* ---------------------------------------------------------------- Die Beispielpakete im Repository */

for (const name of ['_vorlage', 'spieltheorie', 'beispiel-gehirn']) {
  test(`Paket ${name}: --auto ohne Fehler und Warnungen, gesperrte Reisen mit zwei Wegen, ohne Engpass, spielbar`, () => {
    const P = resolvePack(name);
    if (!fs.existsSync(path.join(P.dir, 'plan.json'))) return;
    const { plan, pruef } = auto(name, { zuordnung: false });     // rein automatisch: die Zuordnung eines Pakets nennt Fähigkeiten, die nur sein Kern kennt
    gleich(pruef.warnungen, []);
    const st = startBild(plan, SP, jetzt);
    wahr(st.reisenOffen >= 1 && st.reisenOffen <= 4 && st.reisenOffen + st.reisenGesperrt === episoden(plan).length);
    const rb = regelBild(plan);
    if (rb.ziele.length) wahr(rb.minimum >= 2, `Minimum ${rb.minimum}`);
    gleich(wegeAnalyse(plan, SP).ziele.filter(x => x.regeln >= 2 && x.engpass.length), []);
    const z = spielzeit(plan, SP, {});
    wahr(!z.haengt && z.alleOffen !== null && z.fertig !== null && z.erste <= 2, JSON.stringify({ ...z, momente: z.momente.length }));
  });
}

/* ---------------------------------------------------------------- Werkzeuge als Programm, Hygiene */

test('Programm: Aufruf ohne Paket und unbekanntes Paket enden mit 2, --auto zusammen mit --skelett auch; --stdout schreibt nichts in den Paketordner', () => {
  const run = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools', 'spielplan-aus-plan.mjs'), ...a], { encoding: 'utf8' });
  gleich(run().status, 2); gleich(run(path.join(TMP, 'gibtsnicht')).status, 2);
  const dir = bauePaket('cli', { reisen: 3, je: 12 });
  gleich(run(dir, '--auto', '--skelett').status, 2);
  const r = run(dir, '--auto', '--stdout');
  gleich(r.status, 0); gleich(JSON.parse(r.stdout).format, 'spielplan/0'); wahr(!fs.existsSync(path.join(dir, 'spielplan.json')));
  const w = run(dir, '--auto', '--wege', '--minuten=3');
  gleich(w.status, 0); wahr(/Spielzeit/.test(w.stdout) && /Engpässe/.test(w.stdout) && /3 Min\./.test(w.stdout), w.stdout);
  wahr(fs.existsSync(path.join(dir, 'spielplan.json')));
  const c = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'check-spielplan.mjs'), dir, '--streng', '--bericht', '--wege'], { encoding: 'utf8' });
  gleich(c.status, 0, c.stdout + c.stderr); wahr(/Engpässe/.test(c.stdout));
});

test('Hygiene: kein Fachbezug, keine Domain, keine Abhängigkeit im Quelltext von Generator, Auswertung und Test', () => {
  const verboten = /gehirn|kaffee|spieltheorie|phrenolog|trauma|tschechisch|adhs|https?:\/\/(?!example\.org|adlnet)/i;
  for (const f of ['tools/spielplan-aus-plan.mjs', 'tools/check-spielplan.mjs', 'tools/spielplan-generator-test.mjs']) {
    const code = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter(z => !/^\s*\/\//.test(z));
    const treffer = code.filter(z => verboten.test(z));
    // der Test selbst nennt die Wörter in der Liste der verbotenen Wörter und in Pfaden der Beispielpakete
    gleich(treffer.filter(z => !/const verboten|\['_vorlage'|requireVisual|name of/.test(z)), [], f);
    wahr(!/^\s*import .* from '(?!fs|path|vm|os|assert|child_process|url|\.\/)/m.test(code.join('\n')), 'nur Node-Standardbibliothek: ' + f);
    if (!f.endsWith('-test.mjs')) wahr(!/\bfetch\(|XMLHttpRequest|https?\.request/.test(code.join('\n')), 'keine Netzwerkzugriffe: ' + f);
  }
});

/* ---------------------------------------------------------------- Lauf */
let schlecht = 0;
const t0 = Date.now();
for (const t of tests) {
  try { t.fn(); console.log(`✓ ${t.name}`); }
  catch (e) { schlecht++; console.log(`✗ ${t.name}\n    ${String(e && e.message || e).split('\n').slice(0, 10).join('\n    ')}`); if (process.env.SP_TRACE && e.stack) console.log(e.stack); }
}
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${schlecht ? '✗' : '✓'} ${tests.length - schlecht} von ${tests.length} Tests (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(schlecht ? 1 : 0);

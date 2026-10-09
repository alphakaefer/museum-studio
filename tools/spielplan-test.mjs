#!/usr/bin/env node
// Museum Studio – Test des Spielplan-Kerns (engine/js/spielplan.js, engine/js/spielplan-adapter.js) und von tools/yaml-lite.mjs.
//
//   node tools/spielplan-test.mjs [--kurz] [--schlecht]      --kurz: weniger Zufallsläufe;  --schlecht: Teile zeigen, die Zeit brauchen
//
// Gruppen:
//   1 yaml-lite            Lesen der YAML-Teilmenge, Fehler mit Zeilennummer, Rundlauf mit zufälligen Strukturen
//   2 Konformität Kaffee   das Beispiel aus dem Anhang des Standards (docs/spielplan-beispiel-kaffee.yaml), Zeile für Zeile
//   3 Regeln               kritisch, wesentlich, optional, wartezeit, Transfer, Zugang, Aufgabe, Sätze, Rhythmus, Ereignisse, Prüfung
//   4 Eigenschaften        Zufallspläne und -ereignisse (fester Startwert) gegen ein unabhängig geschriebenes Orakel:
//                          Reihenfolge egal, nichts sinkt oder sperrt wieder zu, Fixpunkt stabil, Pausen ändern keine Stufe
//   5 xAPI                 Übersetzung (Fixtures, Gültigkeit der Statements)
//   6 Brücke               Speicher, Hörer, Datenschutz, Ausfall des Speichers
//   7 Adapter              xAPI gegen einen Mock-LRS (node:http), SCORM gegen Attrappen-APIs
//   8 Werkzeug             check-spielplan als Programm (Exit-Codes)
// Alles ohne Netz außerhalb von 127.0.0.1, ohne Abhängigkeiten. Rückgabewert 1 bei Fehlschlägen.
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { execFileSync } from 'child_process';
import { ROOT } from './check-lib.mjs';
import { ladeKern } from './check-spielplan.mjs';
import { parseYaml, parseDatei, ladeDatei, YamlFehler } from './yaml-lite.mjs';

const KURZ = process.argv.includes('--kurz');
const { Spielplan: SP } = ladeKern();

/* ---------------------------------------------------------------- Rahmen */

const tests = [];
let gruppeName = '';
const gruppen = [];
function gruppe(name) { gruppeName = name; gruppen.push({ name, ok: 0, bad: 0 }); }
function test(name, fn) { tests.push({ gruppe: gruppen[gruppen.length - 1], name, fn }); }
function gleich(a, b, msg) { assert.deepStrictEqual(a, b, msg); }
function wahr(c, msg) { assert.ok(c, msg); }
const T = (h, m = 0, tag = 9) => `2026-10-${String(tag).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
const E = (verb, objekt, zeit, extra = {}) => Object.assign({ wer: 'lokal:test', verb, objekt, zeit, app: 'test' }, extra);
const BELEG = (fall, art = 'messung') => ({ art, quelle: 'test:messung', fall });
function tief(x) { if (x && typeof x === 'object') { Object.values(x).forEach(tief); Object.freeze(x); } return x; }
const klon = x => JSON.parse(JSON.stringify(x));

/** Kleiner Plan-Baukasten: einheit(id, art, extra) usw. */
function plan(einheiten, regeln = [], rest = {}) { return Object.assign({ format: 'spielplan/0', id: 'test', name: 'Test', basis: 'https://example.org/sp/test/', einheiten, regeln }, rest); }
const U = (id, extra = {}) => Object.assign({ id, art: id.split('/')[0], name: id.split('/')[1] }, extra);
const ST = (p, ev, jetzt, opts) => SP.spielstand(p, ev, jetzt, opts);
const stufe = (s, id) => s.einheiten[id].stufe;
const zugang = (s, id) => s.einheiten[id].zugang;

/* ================================================================ 1. yaml-lite */

gruppe('1 yaml-lite');

test('Skalare: Zahlen, Wahrheitswerte, null, Zeichenketten, Datumsangaben bleiben Text', () => {
  gleich(parseYaml('a: 1\nb: -2\nc: 0.67\nd: 1e3\ne: true\nf: False\ng: null\nh: ~\ni:\nj: 2026-11-02\nk: Wort mit Leerzeichen\nl: 007'),
    { a: 1, b: -2, c: 0.67, d: 1000, e: true, f: false, g: null, h: null, i: null, j: '2026-11-02', k: 'Wort mit Leerzeichen', l: 7 });
  gleich(parseYaml('a: yes\nb: 1.2.3\nc: 12abc\nd: +5\ne: .5\nf: 5.'), { a: 'yes', b: '1.2.3', c: '12abc', d: 5, e: 0.5, f: 5 });
});
test('Zeichenketten in Anführungszeichen mit Escapes und verdoppeltem Apostroph', () => {
  gleich(parseYaml('a: "Zeile\\nzwei \\"zitat\\" \\\\ \\u00e4"\nb: \'it\'\'s # kein Kommentar\'\nc: "a # b"\nd: "1"\ne: ""'),
    { a: 'Zeile\nzwei "zitat" \\ ä', b: "it's # kein Kommentar", c: 'a # b', d: '1', e: '' });
});
test('Kommentare: am Zeilenende, als eigene Zeile, Hash im Wort bleibt', () => {
  gleich(parseYaml('# Kopf\na: 1 # Ende\nb: x#y\n   # eingerückt\nc: Karl\'s Haus # und Kommentar\nd: http://x/#/y'), { a: 1, b: 'x#y', c: "Karl's Haus", d: 'http://x/#/y' });
});
test('Block-Abbildung und Block-Liste, verschachtelt, Liste auf der Höhe des Schlüssels', () => {
  const y = 'a:\n  b:\n    c: 1\n  d: [1, 2]\nliste:\n- x\n- y\nandere:\n  - 1\n  - 2\nleer:\nende: 1';
  gleich(parseYaml(y), { a: { b: { c: 1 }, d: [1, 2] }, liste: ['x', 'y'], andere: [1, 2], leer: null, ende: 1 });
});
test('Abbildung im Listeneintrag und verschachtelte Listen', () => {
  const y = 'regeln:\n  - id: a\n    schaltet: [x/y]\n    wenn: { einheit: q, stufe: 2 }\n  - id: b\n    wenn:\n      alle:\n        - { art: quest, mindestens: 5 }\n        - eine:\n            - { takt: 4 }\n- - 1';
  // letzte Zeile ist absichtlich ungültig (Liste nach Abbildung): erst ohne sie
  gleich(parseYaml(y.split('\n- - 1')[0]), { regeln: [{ id: 'a', schaltet: ['x/y'], wenn: { einheit: 'q', stufe: 2 } }, { id: 'b', wenn: { alle: [{ art: 'quest', mindestens: 5 }, { eine: [{ takt: 4 }] }] } }] });
  gleich(parseYaml('- - a\n  - b\n- - c'), [['a', 'b'], ['c']]);
  gleich(parseYaml('-\n  a: 1\n-\n  - x'), [{ a: 1 }, ['x']]);
});
test('Flow: Abbildungen und Listen, mehrzeilig, mit Komma am Ende, Anführungszeichen, Kommentare in den Zeilen', () => {
  gleich(parseYaml('a: { x: 1, y: [a, "b, c", \'d\'], z: { k: v } }'), { a: { x: 1, y: ['a', 'b, c', 'd'], z: { k: 'v' } } });
  gleich(parseYaml('- { id: a,   # Kommentar\n    name: "x, y",\n    in: [p, q], }\n- [1, 2,\n   3]'), [{ id: 'a', name: 'x, y', in: ['p', 'q'] }, [1, 2, 3]]);
  gleich(parseYaml('a: { }\nb: []'), { a: {}, b: [] });
  gleich(parseYaml('{ a: 1, b: [x] }'), { a: 1, b: ['x'] });
  gleich(parseYaml('x: { einheit: quest/reise-03-*, stufe: 2 }\ny: { ab: 2026-11-02 }'), { x: { einheit: 'quest/reise-03-*', stufe: 2 }, y: { ab: '2026-11-02' } });
});
test('Blockzeichenketten | und > mit Abschneiden', () => {
  gleich(parseYaml('a: |\n  eins\n  zwei\nb: >\n  lang\n  gefaltet\n\n  neu\nc: |-\n  ohne\nd: 1'), { a: 'eins\nzwei\n', b: 'lang gefaltet\nneu\n', c: 'ohne', d: 1 });
  gleich(parseYaml('- |\n  x # kein Kommentar\n- y'), ['x # kein Kommentar\n', 'y']);
});
test('Dokumentanfang --- und leere Dokumente', () => {
  gleich(parseYaml('---\na: 1'), { a: 1 });
  gleich(parseYaml(''), null);
  gleich(parseYaml('# nur Kommentar\n\n'), null);
  gleich(parseYaml('hallo'), 'hallo');
});
test('JSON direkt, JSON-Fehler mit Ort', () => {
  gleich(parseDatei('{"a": [1, 2, {"b": null}]}'), { a: [1, 2, { b: null }] });
  assert.throws(() => parseDatei('{\n  "a": 1,\n  "b": ,\n}', 'x.json'), e => e instanceof YamlFehler && /x\.json/.test(e.message));
});
const FEHLER = [
  ['Tabulator in der Einrückung', 'a:\n\tb: 1', 2, /Tabulator/],
  ['doppelter Schlüssel', 'a: 1\nb: 2\na: 3', 3, /doppelt/],
  ['Flow-Klammer nicht geschlossen', 'a: 1\nb: { x: 1,\n  y: 2', 2, /Klammer|„}“/],
  ['Zeichenkette nicht geschlossen', 'a: 1\nb: "offen', 2, /nicht geschlossen/],
  ['Anker', 'a: &x 1', 1, /Anker/],
  ['Alias', 'a: *x', 1, /Alias|Anker/],
  ['Tag', 'a: !!str 1', 1, /Tag|Anker/],
  ['Merge-Schlüssel', 'a: 1\n<<: x', 2, /Merge/],
  ['falsche Einrückung', 'a:\n  b: 1\n c: 2', 3, /Einrückung|unerwartet/],
  ['Fortsetzungszeile', 'a: eins\n  zwei', 1, /Fortsetzung/],
  ['Doppelpunkt im Wert', 'a: b: c', 1, /Doppelpunkt/],
  ['Doppelpunkt im Flow-Wert', 'a: { x: y: z }', 1, /Doppelpunkt/],
  ['Listeneintrag in Abbildung', 'a: 1\n- b', 2, /Listeneintrag|Abbildung/],
  ['zweites Dokument', 'a: 1\n---\nb: 2', 2, /Dokument/],
  ['ungültiges Escape', 'a: "\\q"', 1, /Escape/],
  ['fehlender Doppelpunkt im Flow', 'a: { x 1 }', 1, /„:“/],
];
for (const [name, text, zeile, muster] of FEHLER) {
  test('Fehler mit Zeilennummer: ' + name, () => {
    assert.throws(() => parseYaml(text), e => e instanceof YamlFehler && e.zeile === zeile && muster.test(e.message), `erwartet Zeile ${zeile}`);
  });
}
/** Zufallszahlen mit festem Startwert (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = n => Math.floor(f() * n);
  f.pick = a => a[Math.floor(f() * a.length)];
  f.chance = p => f() < p;
  f.shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  return f;
}
/** Schreibt eine Struktur als Block-YAML (mit gelegentlichem Flow), um den Leser im Rundlauf zu prüfen. */
function alsYaml(wert, r, einzug = 0) {
  const sp = ' '.repeat(einzug);
  const sk = x => typeof x === 'string' ? (/^[A-Za-zÄÖÜäöüß][\wäöüß\/\- ]*$/.test(x) && !/^(true|false|null|yes|no)$/i.test(x) && !/\s$/.test(x) ? x : JSON.stringify(x)) : JSON.stringify(x);
  const flow = x => Array.isArray(x) ? '[' + x.map(flow).join(', ') + ']' : (x && typeof x === 'object') ? '{ ' + Object.entries(x).map(([k, v]) => `${JSON.stringify(k)}: ${flow(v)}`).join(', ') + ' }' : sk(x);
  if (Array.isArray(wert)) {
    if (!wert.length) return sp + '[]\n';
    return wert.map(x => {
      if (x && typeof x === 'object' && (Array.isArray(x) ? x.length : Object.keys(x).length) && r.chance(0.35)) return `${sp}- ${flow(x)}\n`;
      if (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length) { const t = alsYaml(x, r, einzug + 2); return sp + '- ' + t.slice(einzug + 2); }
      if (Array.isArray(x) && x.length) return sp + '-\n' + alsYaml(x, r, einzug + 2);
      return `${sp}- ${x && typeof x === 'object' ? flow(x) : sk(x)}\n`;
    }).join('');
  }
  if (wert && typeof wert === 'object') {
    const keys = Object.keys(wert);
    if (!keys.length) return sp + '{}\n';
    return keys.map(k => {
      const v = wert[k];
      if (v && typeof v === 'object' && (Array.isArray(v) ? v.length : Object.keys(v).length)) {
        if (r.chance(0.3)) return `${sp}${JSON.stringify(k)}: ${flow(v)}\n`;
        if (Array.isArray(v) && r.chance(0.5)) return `${sp}${JSON.stringify(k)}:\n${alsYaml(v, r, einzug)}`;
        return `${sp}${JSON.stringify(k)}:\n${alsYaml(v, r, einzug + 2)}`;
      }
      return `${sp}${JSON.stringify(k)}: ${v && typeof v === 'object' ? flow(v) : sk(v)}${r.chance(0.3) ? '   # Kommentar' : ''}\n`;
    }).join('');
  }
  return sp + sk(wert) + '\n';
}
test('Rundlauf: zufällige Strukturen als Block-YAML und als JSON werden gleich gelesen', () => {
  const r = rng(20261009);
  const worte = ['eins', 'zwei drei', 'Ähre', 'a/b-c', '2026-11-02', 'ja', '12', 'true', 'x: y', 'mit # Hash', "Karl's", 'Zeile\nzwei', '', ' führend'];
  const wert = d => {
    const t = r.int(d > 2 ? 4 : 7);
    if (t === 0) return r.pick(worte);
    if (t === 1) return r.int(1000) - 300;
    if (t === 2) return r.chance(0.5);
    if (t === 3) return r.chance(0.3) ? null : Math.round(r() * 1000) / 100;
    if (t < 6) return Array.from({ length: r.int(4) }, () => wert(d + 1));
    const o = {}; for (let i = 0, n = r.int(4); i < n; i++) o['k' + r.pick(['a', 'b ü', 'c-d', 'e/f', 'g'])] = wert(d + 1);
    return o;
  };
  for (let i = 0; i < (KURZ ? 60 : 300); i++) {
    const w = { wurzel: wert(0), liste: [wert(1), wert(1)] };
    const y = alsYaml(w, r);
    let gelesen; try { gelesen = parseYaml(y); } catch (e) { throw new Error(`Lauf ${i}: ${e.message}\n${y}`); }
    gleich(gelesen, w, `Lauf ${i}:\n${y}`);
    gleich(parseDatei(JSON.stringify(w)), w);
  }
});
test('Das Kaffee-Beispiel wird vollständig gelesen (mehrzeilige Flow-Abbildung, Kommentare, Schrägstriche, Doppelpunkte in Adressen)', () => {
  const p = ladeDatei(path.join(ROOT, 'docs', 'spielplan-beispiel-kaffee.yaml'));
  gleich(p.format, 'spielplan/0'); gleich(p.basis, 'https://zukunftsgut.org/spielplan/museum-kaffee/');
  gleich(p.einheiten.length, 11); gleich(p.regeln.length, 2);
  const tasse = p.einheiten.find(u => u.id === 'episode/tasse');
  gleich(tasse.etappe, 'onboarding'); gleich(tasse.auftakt, 'Eine Kirsche, ein Kern, zwölf Hände – bis zu deiner Tasse.');
  gleich(p.rhythmus, { takt: { laenge: 'woche', beginn: 'erstes-ereignis' }, wiederkehr: { abstand_tage: [2, 7, 21], fuer: { art: 'skill' } }, verfall_tage: 35 });
  gleich(p.regeln[0].enthuellung, 'Du hast die Röstkurve – damit liest du jede Röstung wie ein Profi.');
});
test('Die Beispiele des Standards (Abschnitt 3.1, 5, 5.1, 5.5, 10) werden gelesen', () => {
  const md = fs.readFileSync(path.join(ROOT, 'docs', 'spielplan-standard.md'), 'utf8');
  const bloecke = [...md.matchAll(/```yaml\n([\s\S]*?)```/g)].map(m => m[1]);
  wahr(bloecke.length >= 5, 'weniger YAML-Blöcke als erwartet: ' + bloecke.length);
  bloecke.forEach((b, i) => { try { const w = parseYaml(b.replace(/\[ … \]/g, '[]').replace(/\{ … \}/g, '{}')); wahr(w && typeof w === 'object', 'Block ' + i); } catch (e) { throw new Error(`YAML-Block ${i + 1} des Standards: ${e.message}\n${b.slice(0, 200)}`); } });
});

/* ================================================================ 2. Konformität Kaffee */

gruppe('2 Konformität Kaffee');
const KAFFEE = ladeDatei(path.join(ROOT, 'docs', 'spielplan-beispiel-kaffee.yaml'));
const KA = (verb, objekt, zeit, extra) => E(verb, objekt, zeit, Object.assign({ app: 'museum/kaffee' }, extra));

test('Prüfung: keine Fehler; die beiden Abweichungen des Beispiels werden als Warnung gemeldet', () => {
  const p = SP.pruefe(KAFFEE);
  gleich(p.fehler, []);
  gleich(p.warnungen.length, 2);
  wahr(p.warnungen.some(w => /erlebnis\/roestung/.test(w) && /braucht/.test(w)), 'braucht an erlebnis');
  wahr(p.warnungen.some(w => /episode\/weltmarkt/.test(w) && /Sammel-Einheit ohne Inhalt/.test(w)), 'Episode ohne Inhalt');
});
test('Anfang: Röstkurve, Röstung, Handel, Weltmarkt gesperrt und angedeutet mit Satz; der Rest offen', () => {
  const s = ST(KAFFEE, [], T(10));
  for (const id of ['werkzeug/roestkurve', 'erlebnis/roestung', 'gebiet/handel', 'episode/weltmarkt']) gleich(zugang(s, id), 'gesperrt', id);
  for (const id of ['gebiet/anbau', 'episode/tasse', 'inhalt/kaldi', 'quest/kaldi-mythos', 'inhalt/bohnensorten', 'skill/quellen', 'skill/roesten']) gleich(zugang(s, id), 'offen', id);
  gleich(s.einheiten['werkzeug/roestkurve'].sichtbar, 'angedeutet');
  gleich(s.einheiten['werkzeug/roestkurve'].bedingung, 'Zum Öffnen: „Mythos oder Geschichte?“ geschafft.');
  gleich(s.einheiten['gebiet/handel'].bedingung, 'Zum Öffnen: „Von der Pflanze zur Tasse“ geschafft.');
  gleich(s.einheiten['erlebnis/roestung'].bedingung, 'Zum Öffnen: „Röstkurve“ ausprobiert.');
  gleich(s.freigeschaltet, []);
});
test('Die erste Aufgabe ist genau eine, mit Satz „was sie bringt“ (Grundsatz 4, 5.6)', () => {
  const s = ST(KAFFEE, [], T(10));
  gleich(s.aufgabe.einheit, 'quest/kaldi-mythos');
  wahr(s.aufgabe.bringt.includes('Röstkurve'), s.aufgabe.bringt);
  wahr(typeof s.aufgabe.text === 'string' && s.aufgabe.text.length > 5);
});
test('Mythos geschafft: Regel „roestkurve“ geht auf, Enthüllung wörtlich aus dem Plan, Röstkurve wird die nächste Aufgabe', () => {
  const s = ST(KAFFEE, [KA('geschafft', 'quest/kaldi-mythos', T(10, 12))], T(10, 15));
  gleich(s.freigeschaltet.length, 1);
  gleich(s.freigeschaltet[0], { einheit: 'werkzeug/roestkurve', art: 'werkzeug', name: 'Röstkurve', regel: 'roestkurve', am: T(10, 12), enthuellung: 'Du hast die Röstkurve – damit liest du jede Röstung wie ein Profi.' });
  gleich(zugang(s, 'werkzeug/roestkurve'), 'offen');
  gleich(s.einheiten['werkzeug/roestkurve'].seit, T(10, 12));
  gleich(s.aufgabe.einheit, 'werkzeug/roestkurve');
  gleich(stufe(s, 'skill/quellen'), 2, 'Skill hebt sich über uebt');
});
test('Die Röstung braucht die Röstkurve: offen und schon einmal benutzt (5.4)', () => {
  const mythos = KA('geschafft', 'quest/kaldi-mythos', T(10, 12));
  gleich(zugang(ST(KAFFEE, [mythos], T(11)), 'erlebnis/roestung'), 'gesperrt', 'offen, aber noch nicht benutzt');
  gleich(zugang(ST(KAFFEE, [mythos, KA('begonnen', 'werkzeug/roestkurve', T(11, 5))], T(11, 10)), 'erlebnis/roestung'), 'offen');
  gleich(zugang(ST(KAFFEE, [KA('begonnen', 'werkzeug/roestkurve', T(9))], T(11)), 'erlebnis/roestung'), 'gesperrt', 'benutzt, aber selbst noch gesperrt: zählt nicht');
});
test('Anhang: Episode geübt, sobald die kritische Mythos-Quest und zwei Drittel der wesentlichen Einheiten geschafft sind; Bohnensorten sind Nebenquest', () => {
  const m = KA('geschafft', 'quest/kaldi-mythos', T(10, 0)), k = KA('geschafft', 'inhalt/kaldi', T(10, 5));
  const w = KA('begonnen', 'werkzeug/roestkurve', T(10, 6)), r = KA('geschafft', 'erlebnis/roestung', T(10, 10)), b = KA('geschafft', 'inhalt/bohnensorten', T(10, 11));
  gleich(stufe(ST(KAFFEE, [m, k], T(12)), 'episode/tasse'), 0, 'Röstung (wesentlich) fehlt: zwei Drittel von 2 sind 2');
  gleich(stufe(ST(KAFFEE, [m, k, w, r], T(12)), 'episode/tasse'), 2);
  gleich(stufe(ST(KAFFEE, [k, w, r], T(12)), 'episode/tasse'), 0, 'die kritische Quest fehlt');
  gleich(stufe(ST(KAFFEE, [m, w, r, b], T(12)), 'episode/tasse'), 0, 'Nebenquest ersetzt kein wesentliches (kaldi fehlt)');
  const s = ST(KAFFEE, [m, k, w, r, b], T(12));
  gleich(s.nebenquests, { erledigt: ['inhalt/bohnensorten'], gesamt: 1 });
  gleich(stufe(ST(KAFFEE, [m, k, w, r], T(12)), 'gebiet/anbau'), 2, 'Gebiet aus der Episode');
});
test('Episode geübt öffnet Handel (Regel) und Weltmarkt (nach), im selben Augenblick', () => {
  const ev = [KA('geschafft', 'quest/kaldi-mythos', T(10, 0)), KA('geschafft', 'inhalt/kaldi', T(10, 5)), KA('begonnen', 'werkzeug/roestkurve', T(10, 6)), KA('geschafft', 'erlebnis/roestung', T(10, 10))];
  const s = ST(KAFFEE, ev, T(12));
  gleich(zugang(s, 'gebiet/handel'), 'offen'); gleich(zugang(s, 'episode/weltmarkt'), 'offen');
  const h = s.freigeschaltet.find(f => f.einheit === 'gebiet/handel');
  gleich(h.regel, 'handel'); gleich(h.am, T(10, 10)); gleich(h.enthuellung, 'Hinter der Tasse liegt ein Markt. Das Gebiet Handel ist offen.');
  const w = s.freigeschaltet.find(f => f.einheit === 'episode/weltmarkt');
  gleich(w.regel, 'kurz/episode/weltmarkt'); wahr(w.enthuellung.includes('Der Weltmarkt'), 'Standardsatz für Kurzformen');
});
test('Wiederkehr der Skills (2, 7, 21 Tage): fällig, eingelöst, fertig; Pausen kosten nichts', () => {
  const m = KA('geschafft', 'quest/kaldi-mythos', T(10, 0, 1));
  let s = ST(KAFFEE, [m], T(10, 0, 2));
  gleich(s.einheiten['skill/quellen'].faellig, false);
  s = ST(KAFFEE, [m], T(10, 1, 3));
  gleich(s.einheiten['skill/quellen'].faellig, true); gleich(s.aufgabe.art, 'wiederkehr'); gleich(s.aufgabe.faellig, 'skill/quellen'); gleich(s.aufgabe.einheit, 'quest/kaldi-mythos');
  const w1 = KA('geschafft', 'quest/kaldi-mythos', T(9, 0, 4));
  s = ST(KAFFEE, [m, w1], T(9, 0, 5));
  gleich(s.einheiten['skill/quellen'].wiederkehr.schritt, 1); gleich(s.einheiten['skill/quellen'].faellig, false);
  s = ST(KAFFEE, [m, w1], T(9, 0, 12));
  gleich(s.einheiten['skill/quellen'].faellig, true, 'sieben Tage nach dem letzten Ereignis');
  const w2 = KA('geschafft', 'quest/kaldi-mythos', T(9, 0, 12)), w3 = KA('geschafft', 'quest/kaldi-mythos', '2026-11-02T09:00:00Z');
  s = ST(KAFFEE, [m, w1, w2, w3], '2026-12-20T00:00:00Z');
  gleich(s.einheiten['skill/quellen'].wiederkehr.eingeloest, true); gleich(s.einheiten['skill/quellen'].faellig, false);
  gleich(s.einheiten['skill/quellen'].verwittert, true, 'länger als 35 Tage her: verwittert, aber Stufe bleibt');
  gleich(stufe(s, 'skill/quellen'), 2);
});
test('Wiederkehr beginnt erst bei Stufe 2; nur Berührtes (Stufe 1) wird nicht „wiedergesehen“; Verwitterung nur bei Stufe ab 1, auch bei Sammel-Einheiten', () => {
  const p = plan([U('episode/e'), U('quest/a', { in: 'episode/e' }), U('quest/b', { in: 'episode/e' }), U('quest/c', { in: 'episode/e' })], [], { rhythmus: { wiederkehr: { abstand_tage: [1, 3] }, verfall_tage: 10 } });
  let s = ST(p, [E('begonnen', 'quest/a', T(10, 0, 1))], T(10, 0, 8));
  gleich([s.einheiten['quest/a'].faellig, s.einheiten['quest/a'].wiederkehr], [false, undefined], 'Stufe 1: nichts zu wiederholen'); gleich(s.aufgabe.art === 'wiederkehr', false);
  s = ST(p, [E('geschafft', 'quest/a', T(10, 0, 1))], T(10, 0, 3));
  gleich([s.einheiten['quest/a'].faellig, s.einheiten['quest/a'].wiederkehr.schritt], [true, 0]); gleich(s.aufgabe.art, 'wiederkehr');
  s = ST(p, [E('geschafft', 'quest/a', T(10, 0, 1))], '2026-10-30T00:00:00Z');
  gleich(s.einheiten['episode/e'].stufe, 0, 'ein Drittel reicht nicht'); gleich(s.einheiten['episode/e'].verwittert, false, 'Stufe 0 verwittert nicht, auch wenn Mitglieder berührt sind'); gleich(s.einheiten['quest/a'].verwittert, true);
  s = ST(p, ['a', 'b', 'c'].map(i => E('geschafft', 'quest/' + i, T(10, 0, 1))), '2026-10-30T00:00:00Z');
  gleich(s.einheiten['episode/e'].verwittert, true, 'Sammel-Einheit: jüngstes Ereignis ihrer Mitglieder');
  s = ST(p, ['a', 'b', 'c'].map(i => E('geschafft', 'quest/' + i, T(10, 0, 1))).concat(E('erkundet', 'quest/c', '2026-10-28T00:00:00Z')), '2026-10-30T00:00:00Z');
  gleich(s.einheiten['episode/e'].verwittert, false, 'ein Ereignis an einem Mitglied frischt die Sammel-Einheit auf');
});
test('Verwitterte Einheiten kommen als Wiederkehr-Aufgabe zurück (4.3), auch wenn die Wiederkehr schon eingelöst ist; ohne Wiederkehr-Angabe genügt verfall_tage', () => {
  const ev = [KA('geschafft', 'quest/kaldi-mythos', T(10, 0, 1)), KA('geschafft', 'quest/kaldi-mythos', T(10, 0, 4)), KA('geschafft', 'quest/kaldi-mythos', T(10, 0, 12)), KA('geschafft', 'quest/kaldi-mythos', '2026-11-02T10:00:00Z')];
  let s = ST(KAFFEE, ev, '2026-11-20T00:00:00Z');
  gleich([s.einheiten['skill/quellen'].wiederkehr.eingeloest, s.einheiten['skill/quellen'].verwittert, s.aufgabe && s.aufgabe.art === 'wiederkehr'], [true, false, false]);
  s = ST(KAFFEE, ev, '2026-12-20T00:00:00Z');
  gleich([s.einheiten['skill/quellen'].verwittert, s.aufgabe.art, s.aufgabe.einheit, s.aufgabe.faellig], [true, 'wiederkehr', 'quest/kaldi-mythos', 'skill/quellen']);
  const p = plan([U('quest/q'), U('quest/r')], [], { rhythmus: { verfall_tage: 5 } });
  s = ST(p, [E('geschafft', 'quest/q', T(10, 0, 1)), E('geschafft', 'quest/r', T(10, 0, 8))], T(10, 0, 9));
  gleich([s.einheiten['quest/q'].verwittert, s.aufgabe.art, s.aufgabe.einheit], [true, 'wiederkehr', 'quest/q']);
  s = ST(p, [E('begonnen', 'quest/q', T(10, 0, 1))], T(10, 0, 9)); gleich(s.aufgabe.art === 'wiederkehr', true, 'auch Stufe 1 verwittert');
});
test('Takt: erstes Ereignis beginnt Takt 1, jede Woche ein weiterer; Rückblick nennt, was aufging', () => {
  const ev = [KA('geschafft', 'quest/kaldi-mythos', T(10, 0, 9))];
  let s = ST(KAFFEE, ev, T(11, 0, 9)); gleich(s.takt, 1);
  gleich(s.rueckblick.aufgegangen, ['werkzeug/roestkurve']); wahr(s.rueckblick.gestiegen.includes('skill/quellen'));
  s = ST(KAFFEE, ev, T(11, 0, 16)); gleich(s.takt, 2); gleich(s.rueckblick.aufgegangen, []); gleich(s.rueckblick.vorher.aufgegangen, ['werkzeug/roestkurve']);
  gleich(ST(KAFFEE, [], T(11)).takt, 0, 'ohne Ereignis kein Takt');
});
test('Verwitterung: nach 35 Tagen ohne Ereignis; Stufe und Freischaltung bleiben (Grundsatz 3)', () => {
  const ev = [KA('geschafft', 'quest/kaldi-mythos', T(10, 0, 1))];
  const s0 = ST(KAFFEE, ev, '2026-10-20T00:00:00Z'), s1 = ST(KAFFEE, ev, '2026-12-31T00:00:00Z');
  gleich(s0.einheiten['quest/kaldi-mythos'].verwittert, false); gleich(s1.einheiten['quest/kaldi-mythos'].verwittert, true);
  gleich(stufe(s1, 'quest/kaldi-mythos'), 2); gleich(zugang(s1, 'werkzeug/roestkurve'), 'offen');
});

/* ================================================================ 3. Regeln */

gruppe('3 Regeln');

// --- Sammeln: kritisch, wesentlich, optional
function sammelPlan(gew, extra = {}) {
  const einh = [U('gebiet/g'), U('episode/e', { in: 'gebiet/g' })];
  gew.forEach((g, i) => einh.push(U('inhalt/x' + i, { in: 'episode/e', gewicht: g })));
  return plan(einh, [], extra);
}
const geschafftAlle = (ids, tag = 1) => ids.map((id, i) => E('geschafft', 'inhalt/' + id, T(10, i, tag)));
test('wesentlich: zwei Drittel, aufgerundet (n=1..9, Standardanteil)', () => {
  const erwartet = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 4, 6: 4, 7: 5, 8: 6, 9: 6 };
  for (const n of Object.keys(erwartet)) {
    const p = sammelPlan(Array(+n).fill('wesentlich'));
    const k = erwartet[n];
    const ids = Array.from({ length: +n }, (_, i) => 'x' + i);
    gleich(stufe(ST(p, geschafftAlle(ids.slice(0, k)), T(12, 0, 2)), 'episode/e'), 2, `n=${n}: ${k} genügen`);
    gleich(stufe(ST(p, geschafftAlle(ids.slice(0, k - 1)), T(12, 0, 2)), 'episode/e'), k - 1 >= 1 ? 0 : 0, `n=${n}: ${k - 1} genügen nicht`);
  }
});
test('kritisch: muss erreicht sein, auch wenn alle wesentlichen erledigt sind', () => {
  const p = sammelPlan(['kritisch', 'wesentlich', 'wesentlich', 'wesentlich']);
  gleich(stufe(ST(p, geschafftAlle(['x1', 'x2', 'x3']), T(12, 0, 2)), 'episode/e'), 0);
  gleich(stufe(ST(p, geschafftAlle(['x0', 'x1', 'x2']), T(12, 0, 2)), 'episode/e'), 2);
  gleich(stufe(ST(p, geschafftAlle(['x0']), T(12, 0, 2)), 'episode/e'), 0, 'zwei Drittel der wesentlichen fehlen');
});
test('kritisch ohne wesentliche: allein ausreichend; nur kritische: alle nötig', () => {
  gleich(stufe(ST(sammelPlan(['kritisch']), geschafftAlle(['x0']), T(12, 0, 2)), 'episode/e'), 2);
  gleich(stufe(ST(sammelPlan(['kritisch', 'kritisch']), geschafftAlle(['x0']), T(12, 0, 2)), 'episode/e'), 0);
});
test('optional zählt nicht für die Stufe, taucht aber als erledigte Nebenquest auf', () => {
  const p = sammelPlan(['wesentlich', 'optional', 'optional']);
  let s = ST(p, geschafftAlle(['x1', 'x2']), T(12, 0, 2));
  gleich(stufe(s, 'episode/e'), 0); gleich(s.nebenquests, { erledigt: ['inhalt/x1', 'inhalt/x2'], gesamt: 2 });
  s = ST(p, geschafftAlle(['x0']), T(12, 0, 2));
  gleich(stufe(s, 'episode/e'), 2); gleich(s.nebenquests.erledigt, []);
});
test('nur optionale Mitglieder: die Sammel-Einheit steigt nie aus dem Inhalt (Auslegung A4)', () => {
  gleich(stufe(ST(sammelPlan(['optional', 'optional']), geschafftAlle(['x0', 'x1']), T(12, 0, 2)), 'episode/e'), 0);
});
test('stufen.anteil ändert den Anteil (0.5, 1, "2/3"); ungültig fällt auf zwei Drittel zurück', () => {
  const g = Array(4).fill('wesentlich'), ids = ['x0', 'x1', 'x2', 'x3'];
  gleich(stufe(ST(sammelPlan(g, { stufen: { anteil: 0.5 } }), geschafftAlle(ids.slice(0, 2)), T(12, 0, 2)), 'episode/e'), 2);
  gleich(stufe(ST(sammelPlan(g, { stufen: { anteil: 1 } }), geschafftAlle(ids.slice(0, 3)), T(12, 0, 2)), 'episode/e'), 0);
  gleich(stufe(ST(sammelPlan(g, { stufen: { anteil: '2/3' } }), geschafftAlle(ids.slice(0, 3)), T(12, 0, 2)), 'episode/e'), 2);
  gleich(stufe(ST(sammelPlan(g, { stufen: { anteil: 7 } }), geschafftAlle(ids.slice(0, 3)), T(12, 0, 2)), 'episode/e'), 2);
  gleich(stufe(ST(sammelPlan(Array(3).fill('wesentlich'), { stufen: { anteil: 0.67 } }), geschafftAlle(ids.slice(0, 2)), T(12, 0, 2)), 'episode/e'), 0, 'Befund: 0.67 verlangt bei drei Einheiten alle drei');
});
test('Stufe einer Sammel-Einheit ist die höchste, die alle kritischen und der Anteil der wesentlichen erreicht haben (Stufen 1 bis 4)', () => {
  const p = sammelPlan(['kritisch', 'wesentlich', 'wesentlich']), x = ['x0', 'x1', 'x2'];
  const s = ev => stufe(ST(p, ev, T(12)), 'episode/e');
  gleich(s([E('geschafft', 'inhalt/x0', T(10)), E('geschafft', 'inhalt/x1', T(10)), E('begonnen', 'inhalt/x2', T(10))]), 1, 'die schwächste der nötigen Einheiten bestimmt die Stufe');
  gleich(s(x.map(i => E('geschafft', 'inhalt/' + i, T(10)))), 2);
  gleich(s([E('angewendet', 'inhalt/x0', T(10), { beleg: BELEG('a') }), E('angewendet', 'inhalt/x1', T(10), { beleg: BELEG('a') }), E('geschafft', 'inhalt/x2', T(10))]), 2, 'zwei Drittel von zwei sind zwei: auch x2 muss 3 erreichen');
  gleich(s(x.map(i => E('angewendet', 'inhalt/' + i, T(10), { beleg: BELEG('a') }))), 3);
  gleich(s(x.flatMap(i => [E('angewendet', 'inhalt/' + i, T(10), { beleg: BELEG('a') }), E('angewendet', 'inhalt/' + i, T(11), { beleg: BELEG('b') })])), 4);
});
test('Direkte Ereignisse an einer Sammel-Einheit zählen zusätzlich: die höhere Stufe gilt', () => {
  const p = sammelPlan(['wesentlich', 'wesentlich']);
  gleich(stufe(ST(p, [E('geschafft', 'episode/e', T(10))], T(12)), 'episode/e'), 2);
  gleich(stufe(ST(p, [E('begonnen', 'episode/e', T(10)), E('geschafft', 'inhalt/x0', T(10)), E('geschafft', 'inhalt/x1', T(10))], T(12)), 'episode/e'), 2);
  gleich(stufe(ST(p, [E('geschafft', 'episode/e', T(10)), E('geschafft', 'inhalt/x0', T(10))], T(12)), 'gebiet/g'), 2, 'und reicht nach oben durch');
});
test('Stufen an einer Einheit: begonnen/erkundet 1, geschafft/bestanden 2, angewendet mit Beleg 3 (Abschnitt 4)', () => {
  const p = plan([U('quest/q')]);
  const s = v => stufe(ST(p, v, T(12)), 'quest/q');
  gleich(s([]), 0); gleich(s([E('begonnen', 'quest/q', T(10))]), 1); gleich(s([E('erkundet', 'quest/q', T(10))]), 1);
  gleich(s([E('geschafft', 'quest/q', T(10))]), 2); gleich(s([E('bestanden', 'quest/q', T(10))]), 2);
  gleich(s([E('angewendet', 'quest/q', T(10))]), 2, 'ohne Beleg wie geschafft');
  gleich(s([E('angewendet', 'quest/q', T(10), { beleg: { art: 'unbekannt', fall: 'x' } })]), 2, 'Belegart ungültig: kein Beleg');
  gleich(s([E('angewendet', 'quest/q', T(10), { beleg: BELEG('a') })]), 3);
  gleich(s([E('geteilt', 'quest/q', T(10))]), 1, 'geteilt allein ist nur berührt (Auslegung A6)');
});
test('Stufe 4 (Transfer): zwei verschiedene Fälle oder angewendet und geteilt', () => {
  const p = plan([U('quest/q')]);
  const s = v => stufe(ST(p, v, T(12)), 'quest/q');
  gleich(s([E('angewendet', 'quest/q', T(10), { beleg: BELEG('a') }), E('angewendet', 'quest/q', T(11), { beleg: BELEG('b') })]), 4);
  gleich(s([E('angewendet', 'quest/q', T(10), { beleg: BELEG('a') }), E('angewendet', 'quest/q', T(11), { beleg: BELEG('a', 'eigen') })]), 3, 'derselbe Fall zweimal');
  gleich(s([E('angewendet', 'quest/q', T(10), { beleg: BELEG(' A ') }), E('angewendet', 'quest/q', T(11), { beleg: BELEG('a') })]), 3, 'Fall ohne Groß/Klein und Leerzeichen verglichen');
  gleich(s([E('angewendet', 'quest/q', T(10), { beleg: { art: 'messung' } }), E('angewendet', 'quest/q', T(11), { beleg: { art: 'messung' } })]), 3, 'ohne fall keine zwei Fälle');
  gleich(s([E('angewendet', 'quest/q', T(10), { beleg: BELEG('a') }), E('geteilt', 'quest/q', T(11))]), 4);
  gleich(s([E('geteilt', 'quest/q', T(9)), E('angewendet', 'quest/q', T(10), { beleg: BELEG('a') })]), 4, 'Reihenfolge egal');
  gleich(s([E('angewendet', 'quest/q', T(10)), E('geteilt', 'quest/q', T(11))]), 2, 'ohne Beleg kein Transfer');
});
test('Werkzeug: Ereignisse über mit (geschafft, bestanden, angewendet mit Fall); Transfer an neuen Fällen', () => {
  const p = plan([U('werkzeug/w'), U('quest/a'), U('quest/b')]);
  const s = v => stufe(ST(p, v, T(12)), 'werkzeug/w');
  gleich(s([E('geschafft', 'quest/a', T(10), { mit: ['werkzeug/w'] })]), 2);
  gleich(s([E('begonnen', 'quest/a', T(10), { mit: ['werkzeug/w'] })]), 0, 'begonnen wird nicht durchgereicht');
  gleich(s([E('angewendet', 'quest/a', T(10), { mit: ['werkzeug/w'], beleg: BELEG('f1') })]), 3);
  gleich(s([E('angewendet', 'quest/a', T(10), { mit: ['werkzeug/w'], beleg: BELEG('f1') }), E('angewendet', 'quest/b', T(11), { mit: ['werkzeug/w'], beleg: BELEG('f2') })]), 4);
  gleich(s([E('geschafft', 'quest/a', T(10), { mit: ['quest/b'] })]), 0, 'mit nennt kein Werkzeug: ignoriert');
  gleich(stufe(ST(p, [E('geschafft', 'quest/a', T(10), { mit: ['werkzeug/w'] })], T(12)), 'quest/a'), 2, 'die Quest selbst auch');
});
test('wartezeit: drei Stunden nach Erreichen der Stufe; Zeit-Genauigkeit Stunden; Überspringen nur mit ohneWartezeit', () => {
  const p = plan([U('quest/a'), U('werkzeug/w')], [{ id: 'w', schaltet: ['werkzeug/w'], wenn: { wartezeit: { einheit: 'quest/a', stufe: 2, stunden: 3 } }, enthuellung: 'Pause vorbei.' }]);
  const ev = [E('geschafft', 'quest/a', T(10, 0))];
  gleich(zugang(ST(p, ev, T(12, 59)), 'werkzeug/w'), 'gesperrt');
  gleich(zugang(ST(p, ev, T(13, 0)), 'werkzeug/w'), 'offen');
  gleich(ST(p, ev, T(13, 0)).freigeschaltet[0].am, T(13, 0), 'am = Zeitpunkt der Freigabe, nicht des Ereignisses');
  gleich(zugang(ST(p, ev, T(10, 1), { ohneWartezeit: true }), 'werkzeug/w'), 'offen');
  gleich(zugang(ST(p, [], T(10, 1), { ohneWartezeit: true }), 'werkzeug/w'), 'gesperrt', 'ohne die Stufe auch ohne Pause nicht');
  const s = ST(p, ev, T(11, 30));
  gleich(s.einheiten['werkzeug/w'].bedingung, 'Zum Öffnen: noch 1 Std. 30 Min. Pause nach „a“.');
  gleich(s.wartet, [{ einheit: 'werkzeug/w', regel: 'w', bis: T(13, 0) }]);
  gleich(ST(p, [], T(11)).einheiten['werkzeug/w'].bedingung, 'Zum Öffnen: 3 Std. Pause, nachdem „a“ geschafft ist.');
  gleich(zugang(ST(p, ev, '2026-10-09'), 'werkzeug/w'), 'gesperrt', 'reines Datum gilt als 00:00 UTC');
  gleich(zugang(ST(p, ev, T(23, 0, 9)), 'werkzeug/w'), 'offen');
});
test('wartezeit für eine Sammel-Einheit: der Zeitpunkt wird aus den Ereignissen der Mitglieder abgeleitet', () => {
  const p = plan([U('episode/e'), U('inhalt/a', { in: 'episode/e' }), U('inhalt/b', { in: 'episode/e' }), U('werkzeug/w')], [{ id: 'r', schaltet: ['werkzeug/w'], wenn: { wartezeit: { einheit: 'episode/e', stufe: 2, stunden: 2 } }, enthuellung: 'x' }]);
  const ev = [E('geschafft', 'inhalt/a', T(8)), E('geschafft', 'inhalt/b', T(9))];
  gleich(zugang(ST(p, ev, T(10, 59)), 'werkzeug/w'), 'gesperrt'); gleich(zugang(ST(p, ev, T(11, 0)), 'werkzeug/w'), 'offen');
});
test('ab: ab einem Tag; takt: ab dem n-ten Takt (erstes Ereignis oder fester Beginn)', () => {
  const p = plan([U('quest/a'), U('quest/b'), U('quest/c')], [
    { id: 'ab', schaltet: ['quest/a'], wenn: { ab: '2026-11-02' }, enthuellung: 'x' },
    { id: 'takt', schaltet: ['quest/b'], wenn: { takt: 3 }, enthuellung: 'x' },
    { id: 'fest', schaltet: ['quest/c'], wenn: { takt: 2 }, enthuellung: 'x' }], { rhythmus: { takt: { laenge: 'woche', beginn: '2026-10-05' } } });
  gleich(zugang(ST(p, [], '2026-11-01T23:59:00Z'), 'quest/a'), 'gesperrt'); gleich(zugang(ST(p, [], '2026-11-02T00:00:00Z'), 'quest/a'), 'offen');
  gleich(zugang(ST(p, [], '2026-10-11T23:00:00Z'), 'quest/c'), 'gesperrt'); gleich(zugang(ST(p, [], '2026-10-12T00:00:00Z'), 'quest/c'), 'offen', 'fester Beginn: alle im selben Takt');
  gleich(ST(p, [], '2026-10-26T00:00:00Z').takt, 4); gleich(zugang(ST(p, [], '2026-10-19T00:00:00Z'), 'quest/b'), 'offen');
  const p2 = plan([U('quest/a'), U('quest/b')], [{ id: 't', schaltet: ['quest/b'], wenn: { takt: 2 }, enthuellung: 'x' }], { rhythmus: { takt: { laenge: 'tag', beginn: 'erstes-ereignis' } } });
  const ev = [E('begonnen', 'quest/a', T(15, 0, 9))];
  gleich(zugang(ST(p2, ev, T(23, 59, 9)), 'quest/b'), 'gesperrt'); gleich(zugang(ST(p2, ev, T(0, 0, 10)), 'quest/b'), 'offen', 'Takt 2 beginnt mit dem nächsten Kalendertag (UTC) des ersten Ereignisses');
  const p3 = plan([U('quest/a')], [], { rhythmus: { takt: { laenge: 'monat', beginn: '2026-01-31' } } });
  gleich([ST(p3, [], '2026-02-27T00:00:00Z').takt, ST(p3, [], '2026-02-28T00:00:00Z').takt, ST(p3, [], '2026-03-31T00:00:00Z').takt], [1, 2, 3], 'Monate mit kurzem Monatsende');
});
test('Bausteine: mindestens, alle, art, in, Muster; Verknüpfungen alle, eine, mindestens-von', () => {
  const p = plan([U('episode/r1'), U('quest/r1-a', { in: 'episode/r1' }), U('quest/r1-b', { in: 'episode/r1' }), U('quest/r1-c', { in: 'episode/r1' }), U('inhalt/s', { in: 'episode/r1' }),
    U('werkzeug/w1'), U('werkzeug/w2'), U('werkzeug/w3'), U('werkzeug/w4'), U('werkzeug/w5')], [
    { id: 'a', schaltet: ['werkzeug/w1'], wenn: { art: 'quest', in: 'episode/r1', stufe: 2, mindestens: 2 }, enthuellung: 'x' },
    { id: 'b', schaltet: ['werkzeug/w2'], wenn: { einheit: 'quest/r1-*', mindestens: 'alle' }, enthuellung: 'x' },
    { id: 'c', schaltet: ['werkzeug/w3'], wenn: { eine: [{ einheit: 'inhalt/s', stufe: 3 }, { einheit: 'quest/r1-a' }] }, enthuellung: 'x' },
    { id: 'd', schaltet: ['werkzeug/w4'], wenn: { mindestens: 2, von: [{ einheit: 'quest/r1-a' }, { einheit: 'quest/r1-b' }, { einheit: 'quest/r1-c' }] }, enthuellung: 'x' },
    { id: 'e', schaltet: ['werkzeug/w5'], wenn: { alle: [{ einheit: 'quest/r1-a' }, { eine: [{ einheit: 'quest/r1-c' }, { takt: 9 }] }] }, enthuellung: 'x' }], { rhythmus: { takt: { laenge: 'woche' } } });
  const g = id => E('geschafft', 'quest/r1-' + id, T(10));
  const o = (ev) => { const s = ST(p, ev, T(12)); return ['w1', 'w2', 'w3', 'w4', 'w5'].map(w => s.einheiten['werkzeug/' + w].zugang === 'offen' ? w : '-').join(' '); };
  gleich(o([g('a')]), '- - w3 - -');
  gleich(o([g('a'), g('b')]), 'w1 - w3 w4 -');
  gleich(o([g('a'), g('b'), g('c')]), 'w1 w2 w3 w4 w5');
  gleich(o([g('c')]), '- - - - -');
});
test('Ketten: eine Regel darf nach Einheiten fragen, die selbst erst aufgehen (Werkzeug → Quest → Gebiet)', () => {
  const p = plan([U('quest/a'), U('werkzeug/w'), U('quest/b'), U('gebiet/g')], [
    { id: '1', schaltet: ['werkzeug/w'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' },
    { id: '2', schaltet: ['quest/b'], wenn: { einheit: 'werkzeug/w', stufe: 1 }, enthuellung: 'x' },
    { id: '3', schaltet: ['gebiet/g'], wenn: { einheit: 'quest/b' }, enthuellung: 'x' }]);
  const ev = [E('geschafft', 'quest/a', T(10)), E('begonnen', 'werkzeug/w', T(10, 5)), E('geschafft', 'quest/b', T(10, 10))];
  gleich(['quest/b', 'gebiet/g'].map(i => zugang(ST(p, ev.slice(0, 1), T(12)), i)), ['gesperrt', 'gesperrt']);
  gleich(['quest/b', 'gebiet/g'].map(i => zugang(ST(p, ev, T(12)), i)), ['offen', 'offen']);
  gleich(ST(p, ev, T(12)).freigeschaltet.map(f => f.einheit + '@' + f.am), ['werkzeug/w@' + T(10), 'quest/b@' + T(10, 5), 'gebiet/g@' + T(10, 10)]);
});
test('Zugang wird über in vererbt; mehrere Eltern: offen, sobald einer offen ist (Umsteigen)', () => {
  const p = plan([U('episode/e1'), U('episode/e2'), U('inhalt/s', { in: ['episode/e1', 'episode/e2'] }), U('inhalt/t', { in: 'episode/e1' }), U('quest/a')], [
    { id: '1', schaltet: ['episode/e1'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' },
    { id: '2', schaltet: ['episode/e2'], wenn: { einheit: 'quest/a', stufe: 3 }, enthuellung: 'x' }]);
  let s = ST(p, [], T(12));
  gleich(['episode/e1', 'inhalt/s', 'inhalt/t'].map(i => zugang(s, i)), ['gesperrt', 'gesperrt', 'gesperrt']);
  wahr(s.einheiten['inhalt/t'].bedingung.includes('„e1“ muss offen sein'), s.einheiten['inhalt/t'].bedingung);
  s = ST(p, [E('geschafft', 'quest/a', T(10))], T(12));
  gleich(['episode/e1', 'inhalt/s', 'inhalt/t', 'episode/e2'].map(i => zugang(s, i)), ['offen', 'offen', 'offen', 'gesperrt']);
});
test('braucht und nach an derselben Einheit gelten zusammen, mehrere Regeln dagegen sind Alternativen (Auslegung A5)', () => {
  const p = plan([U('quest/a'), U('quest/b'), U('werkzeug/w'), U('quest/z', { nach: 'quest/a', braucht: ['werkzeug/w'] }), U('quest/y', { nach: 'quest/a' })],
    [{ id: 'alt', schaltet: ['quest/y'], wenn: { einheit: 'quest/b' }, enthuellung: 'x' }]);
  const z = ev => zugang(ST(p, ev, T(12)), 'quest/z'), y = ev => zugang(ST(p, ev, T(12)), 'quest/y');
  gleich(z([E('geschafft', 'quest/a', T(10))]), 'gesperrt'); gleich(z([E('geschafft', 'quest/a', T(10)), E('begonnen', 'werkzeug/w', T(10))]), 'offen');
  gleich(z([E('begonnen', 'werkzeug/w', T(10))]), 'gesperrt');
  gleich(y([E('geschafft', 'quest/b', T(10))]), 'offen', 'explizite Regel und nach: eine genügt'); gleich(y([E('geschafft', 'quest/a', T(10))]), 'offen');
});
test('verborgen: kein Satz an der gesperrten Einheit, wirksam auch für Einheiten darin; angedeutet ist der Standard', () => {
  const p = plan([U('gebiet/g', { sichtbar: 'verborgen' }), U('quest/in-g', { in: 'gebiet/g' }), U('quest/a'), U('quest/h', { sichtbar: 'verborgen' }), U('quest/s')],
    [{ id: '1', schaltet: ['gebiet/g', 'quest/h', 'quest/s'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' }]);
  const s = ST(p, [], T(12));
  gleich(s.einheiten['gebiet/g'].sichtbar, 'verborgen'); gleich(s.einheiten['gebiet/g'].bedingung, undefined);
  gleich(s.einheiten['quest/in-g'].sichtbar, 'verborgen'); gleich(s.einheiten['quest/in-g'].bedingung, undefined);
  gleich(s.einheiten['quest/s'].sichtbar, 'angedeutet'); wahr(s.einheiten['quest/s'].bedingung);
  const a = ST(p, [], T(12)).aufgabe; wahr(!/„h“|„g“/.test(a.bringt), 'die Aufgabe verrät keine verborgene Einheit: ' + a.bringt);
});
test('Sätze nennen verborgene, gesperrte Einheiten nicht beim Namen („etwas Verborgenes“)', () => {
  const p = plan([U('quest/a', { sichtbar: 'verborgen' }), U('quest/b'), U('werkzeug/w'), U('quest/c')], [
    { id: '1', schaltet: ['quest/a'], wenn: { einheit: 'quest/c' }, enthuellung: 'x' },
    { id: '2', schaltet: ['quest/b'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' },
    { id: '3', schaltet: ['werkzeug/w'], wenn: { wartezeit: { einheit: 'quest/a', stunden: 2 } }, enthuellung: 'x' }]);
  let s = ST(p, [], T(10));
  gleich(s.einheiten['quest/b'].bedingung, 'Zum Öffnen: etwas Verborgenes geschafft.');
  gleich(s.einheiten['werkzeug/w'].bedingung, 'Zum Öffnen: 2 Std. Pause, nachdem etwas Verborgenes geschafft ist.');
  s = ST(p, [E('geschafft', 'quest/c', T(10))], T(11));
  gleich(s.einheiten['quest/b'].bedingung, 'Zum Öffnen: „a“ geschafft.', 'offen heißt nicht mehr verborgen');
});
test('Zählsatz wie im Standard: „3 Reisen geschafft – 1 fehlt“', () => {
  const einh = [U('gebiet/emotion')]; for (let i = 1; i <= 4; i++) einh.push(U('episode/r' + i));
  const p = plan(einh, [{ id: 'e', schaltet: ['gebiet/emotion'], wenn: { art: 'episode', stufe: 2, mindestens: 3 }, enthuellung: 'x' }], { begriffe: { episode: { art: 'die', sg: 'Reise', pl: 'Reisen' } } });
  gleich(ST(p, [], T(12)).einheiten['gebiet/emotion'].bedingung, 'Zum Öffnen: 3 Reisen geschafft.');
  const ev = [E('geschafft', 'episode/r1', T(10)), E('geschafft', 'episode/r2', T(10))];
  gleich(ST(p, ev, T(12)).einheiten['gebiet/emotion'].bedingung, 'Zum Öffnen: 3 Reisen geschafft – 1 fehlt.');
  const p2 = plan(einh, [{ id: 'e', schaltet: ['gebiet/emotion'], wenn: { art: 'episode', mindestens: 'alle' }, enthuellung: 'x' }]);
  gleich(ST(p2, ev, T(12)).einheiten['gebiet/emotion'].bedingung, 'Zum Öffnen: alle 4 Episoden geschafft – 2 fehlen.');
});
test('Bedingung als Satz: alle, eine, mindestens-von, Takt, Datum', () => {
  const p = plan([U('quest/a'), U('quest/b'), U('werkzeug/w'), U('werkzeug/x'), U('werkzeug/y')], [
    { id: '1', schaltet: ['werkzeug/w'], wenn: { alle: [{ einheit: 'quest/a' }, { einheit: 'quest/b', stufe: 3 }] }, enthuellung: 'x' },
    { id: '2', schaltet: ['werkzeug/x'], wenn: { eine: [{ einheit: 'quest/a' }, { takt: 4 }] }, enthuellung: 'x' },
    { id: '3', schaltet: ['werkzeug/y'], wenn: { alle: [{ ab: '2026-12-24' }, { mindestens: 2, von: [{ einheit: 'quest/a' }, { einheit: 'quest/b' }] }] }, enthuellung: 'x' }], { rhythmus: { takt: { laenge: 'woche' } } });
  const s = ST(p, [E('geschafft', 'quest/a', T(10))], T(11));
  gleich(s.einheiten['werkzeug/w'].bedingung, 'Zum Öffnen: „b“ angewendet.');
  gleich(s.einheiten['werkzeug/x'].zugang, 'offen');
  gleich(s.einheiten['werkzeug/y'].bedingung, 'Zum Öffnen: ab dem 24.12.2026 und noch 1 von: „b“ geschafft.');
  gleich(ST(p, [], T(11)).einheiten['werkzeug/x'].bedingung, 'Zum Öffnen: „a“ geschafft oder ab Woche 4.');
});
test('Nächste Aufgabe 5.6: Wiederkehr vor Freischaltung vor Gewicht; immer mit „bringt“; genau eine', () => {
  const p = plan([U('episode/e', { reihenfolge: 1 }), U('inhalt/h1', { in: 'episode/e', gewicht: 'optional', reihenfolge: 1 }), U('inhalt/h2', { in: 'episode/e', gewicht: 'kritisch', reihenfolge: 2 }), U('inhalt/h3', { in: 'episode/e', gewicht: 'wesentlich', reihenfolge: 1 }),
    U('quest/q', { reihenfolge: 9 }), U('werkzeug/w'), U('skill/s', { kann: 'Ich kann etwas.' })].map(u => u.id === 'quest/q' ? Object.assign(u, { uebt: ['skill/s'] }) : u),
    [{ id: 'r', schaltet: ['werkzeug/w'], wenn: { einheit: 'quest/q' }, enthuellung: 'x' }], { rhythmus: { wiederkehr: { abstand_tage: [1, 3], fuer: { art: 'skill' } } } });
  let s = ST(p, [], T(10));
  gleich(s.aufgabe.art, 'regel'); gleich(s.aufgabe.einheit, 'quest/q'); wahr(s.aufgabe.bringt.includes('„w“'), s.aufgabe.bringt);
  const p2 = plan(p.einheiten, [], { rhythmus: p.rhythmus });
  s = ST(p2, [], T(10));
  gleich(s.aufgabe.art, 'weiter'); gleich(s.aufgabe.einheit, 'inhalt/h2', 'kritisch vor wesentlich vor optional');
  s = ST(p2, [E('geschafft', 'inhalt/h2', T(10))], T(11));
  gleich(s.aufgabe.einheit, 'inhalt/h3', 'dann wesentlich');
  s = ST(p2, [E('geschafft', 'inhalt/h2', T(10)), E('geschafft', 'inhalt/h3', T(10))], T(11));
  gleich(s.aufgabe.einheit, 'quest/q', 'wesentliche vor optionalen');
  s = ST(p2, ['inhalt/h2', 'inhalt/h3', 'quest/q', 'werkzeug/w'].map(i => E('geschafft', i, T(10))), T(11));
  gleich(s.aufgabe.einheit, 'inhalt/h1', 'die Nebenquest kommt zuletzt');
  s = ST(p2, [E('geschafft', 'quest/q', T(10, 0, 1))], T(10, 0, 3));
  gleich(s.aufgabe.art, 'wiederkehr'); gleich(s.aufgabe.faellig, 'skill/s'); gleich(s.aufgabe.einheit, 'quest/q');
  wahr(s.aufgabe.bringt.includes('Ich kann etwas.'), s.aufgabe.bringt);
  const alle = ST(p2, ['h1', 'h2', 'h3'].map(i => E('geschafft', 'inhalt/' + i, T(10))).concat(E('geschafft', 'quest/q', T(10)), E('geschafft', 'werkzeug/w', T(10))), T(10, 1), { bis: 2 });
  gleich(alle.aufgabe, null, 'alles bis zur höchsten vergebenen Stufe: keine Aufgabe');
});
test('Nächste Aufgabe: die Regel mit den wenigsten Schritten gewinnt; Reihenfolge der Eltern, dann höhere Stufe zuerst', () => {
  const p = plan([U('episode/e1', { reihenfolge: 1 }), U('episode/e2', { reihenfolge: 2 }), U('inhalt/a', { in: 'episode/e1', reihenfolge: 1 }), U('inhalt/b', { in: 'episode/e1', reihenfolge: 2 }), U('inhalt/c', { in: 'episode/e2', reihenfolge: 1 }), U('werkzeug/w'), U('werkzeug/v')],
    [{ id: 'weit', schaltet: ['werkzeug/w'], wenn: { alle: [{ einheit: 'inhalt/a' }, { einheit: 'inhalt/b' }] }, enthuellung: 'x' }, { id: 'nah', schaltet: ['werkzeug/v'], wenn: { einheit: 'inhalt/c' }, enthuellung: 'x' }]);
  let s = ST(p, [], T(10));
  gleich(s.aufgabe.regel, 'nah'); gleich(s.aufgabe.einheit, 'inhalt/c'); gleich(s.aufgabe.noch, 2, 'zwei Schritte bis Stufe 2'); wahr(/^Noch 2 Schritte, dann geht das Werkzeug „v“ auf\.$/.test(s.aufgabe.bringt), s.aufgabe.bringt);
  s = ST(p, [E('begonnen', 'inhalt/c', T(10))], T(11));
  gleich(s.aufgabe.noch, 1); gleich(s.aufgabe.bringt, 'Danach geht das Werkzeug „v“ auf.');
});
test('Nächste Aufgabe: Gesperrtes wird nie vorgeschlagen; Pausen erscheinen in „wartet“, nicht als Aufgabe', () => {
  const p = plan([U('quest/a'), U('quest/b')], [{ id: 'r', schaltet: ['quest/b'], wenn: { wartezeit: { einheit: 'quest/a', stufe: 2, stunden: 3 } }, enthuellung: 'x' }]);
  const s = ST(p, [E('geschafft', 'quest/a', T(10))], T(11));
  gleich(s.aufgabe && s.aufgabe.einheit !== 'quest/b', true); gleich(s.wartet.length, 1);
});
test('Ereignisse: Unbrauchbares wird übersprungen und genannt, nichts wirft', () => {
  const p = plan([U('quest/q')]);
  const s = ST(p, [null, 5, 'x', {}, E('erfunden', 'quest/q', T(10)), E('geschafft', 'quest/gibtsnicht', T(10)), E('geschafft', 'quest/q', 'gestern'), E('freigeschaltet', 'quest/q', T(10)), E('geschafft', 'quest/q', T(10))], T(12));
  gleich(stufe(s, 'quest/q'), 2); gleich(s.ignoriert.map(i => i.nr), [0, 1, 2, 3, 4, 5, 6, 7]);
  wahr(s.ignoriert[4].grund.includes('erfunden')); wahr(s.ignoriert[7].grund.includes('abgeleitet'));
  gleich(ST(p, null, T(12)).einheiten['quest/q'].stufe, 0); gleich(ST(p, undefined, T(12)).einheiten['quest/q'].stufe, 0);
});
test('Ereignisse aus der Zukunft (falsche Uhr) zählen, aber erst ab jetzt; Ereignisse anderer Personen mit opts.wer ausfiltern', () => {
  const p = plan([U('quest/q')]);
  const s = ST(p, [E('geschafft', 'quest/q', '2030-01-01T00:00:00Z')], T(12));
  gleich(stufe(s, 'quest/q'), 2); gleich(s.einheiten['quest/q'].letzte, T(12));
  gleich(stufe(ST(p, [E('geschafft', 'quest/q', T(10), { wer: 'lokal:anderer' })], T(12), { wer: 'lokal:test' }), 'quest/q'), 0);
});
test('Reine Funktion: Eingaben bleiben unverändert (eingefroren), gleiche Eingabe gibt gleichen Spielstand', () => {
  const p = tief(klon(KAFFEE)), ev = tief([KA('geschafft', 'quest/kaldi-mythos', T(10)), KA('geschafft', 'inhalt/kaldi', T(10, 5))]);
  gleich(ST(p, ev, T(12)), ST(p, ev, T(12)));
  gleich(JSON.parse(JSON.stringify(ST(p, ev, T(12)))), ST(p, ev, T(12)), 'nur JSON-Werte');
});
test('jetzt: ISO mit Offset, Date, Millisekunden; Unlesbares wirft einen klaren Fehler', () => {
  const p = plan([U('quest/q')]);
  const ev = [E('geschafft', 'quest/q', '2026-10-09T12:00:00+02:00')];
  gleich(ST(p, ev, '2026-10-09T10:00:00Z').einheiten['quest/q'].letzte, '2026-10-09T10:00:00Z');
  gleich(ST(p, ev, new Date('2026-10-09T10:00:00Z')).jetzt, T(10)); gleich(ST(p, ev, Date.parse(T(10))).jetzt, T(10));
  gleich(ST(p, ev, '2026-10-09T10:00:00').jetzt, T(10), 'ohne Offset gilt UTC');
  assert.throws(() => ST(p, ev, 'morgen'), /jetzt/);
  assert.throws(() => SP.spielstand(null, [], T(10)), /plan/);
});

// --- Prüfung
const pr = (einheiten, regeln = [], rest = {}) => SP.pruefe(plan(einheiten, regeln, rest));
const hat = (liste, muster) => liste.some(m => muster.test(m));
test('pruefe: unbekannte ids in in, uebt, braucht, nach, Regeln und wartezeit', () => {
  const r = pr([U('quest/a', { in: 'episode/x', uebt: ['skill/y'], braucht: ['werkzeug/z'], nach: 'quest/n' }), U('werkzeug/w')],
    [{ id: 'r', schaltet: ['quest/zz'], wenn: { alle: [{ einheit: 'quest/qq' }, { wartezeit: { einheit: 'quest/ww', stunden: 2 } }] }, enthuellung: 'x' }]);
  for (const m of [/Einheit quest\/a: in verweist auf unbekannte Einheit „episode\/x“/, /uebt verweist auf unbekannte Einheit „skill\/y“/, /braucht verweist auf unbekannte Einheit „werkzeug\/z“/, /nach verweist auf unbekannte Einheit „quest\/n“/,
    /Regel r: schaltet verweist auf unbekannte Einheit „quest\/zz“/, /Regel r: .*quest\/qq.* trifft keine Einheit/, /Regel r: wartezeit verweist auf unbekannte Einheit „quest\/ww“/]) wahr(hat(r.fehler, m), String(m) + '\n' + r.fehler.join('\n'));
});
test('pruefe: doppelte ids, unbekannte Art, gewicht und sichtbar, falsche ids', () => {
  const r = pr([U('quest/a'), U('quest/a'), { id: 'quest/b', art: 'ding', name: 'b' }, U('quest/c', { gewicht: 'wichtig', sichtbar: 'weg' }), { id: 'Quest/D', art: 'quest', name: 'd' }]);
  for (const m of [/quest\/a: id doppelt/, /quest\/b: art „ding“ unbekannt/, /quest\/c: gewicht „wichtig“ unbekannt/, /quest\/c: sichtbar „weg“ unbekannt/, /Quest\/D: id darf nur Kleinbuchstaben/]) wahr(hat(r.fehler, m), String(m) + '\n' + r.fehler.join('\n'));
});
test('pruefe: skill ohne kann ist ein Fehler, kann ohne „Ich kann“ eine Warnung', () => {
  const r = pr([U('skill/a'), U('skill/b', { kann: 'Quellen prüfen' }), U('skill/c', { kann: 'Ich kann das.' })]);
  wahr(hat(r.fehler, /skill\/a: skill ohne kann/)); wahr(hat(r.warnungen, /skill\/b: kann beginnt nicht mit „Ich kann“/)); gleich(r.fehler.filter(m => /skill\/[bc]/.test(m)), []);
});
test('pruefe: Regeln ohne enthuellung, Episoden ohne etappe, Quests ohne staerke, unbekannte Sorte sind Warnungen', () => {
  const r = pr([U('episode/e'), U('quest/q'), U('werkzeug/w', { sorte: 'baustein' }), U('werkzeug/v', { sorte: 'zauber' }), U('quest/z')], [{ id: 'r', schaltet: ['quest/z'], wenn: { einheit: 'quest/q' } }]);
  gleich(r.fehler, []);
  for (const m of [/Regel r: enthuellung fehlt/, /episode\/e: episode ohne etappe/, /quest\/q: quest ohne staerke/, /werkzeug\/w: sorte „baustein“/, /werkzeug\/v: sorte „zauber“/]) wahr(hat(r.warnungen, m), String(m) + '\n' + r.warnungen.join('\n'));
});
test('pruefe: Einheiten, die nie aufgehen: Zyklus ohne Einstieg, Stufe über stufen.bis, fehlender Takt, unerreichbare Voraussetzung', () => {
  const zyklus = pr([U('quest/a'), U('quest/b')], [{ id: '1', schaltet: ['quest/a'], wenn: { einheit: 'quest/b' }, enthuellung: 'x' }, { id: '2', schaltet: ['quest/b'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' }]);
  wahr(hat(zyklus.fehler, /Zyklus ohne Einstieg: quest\/[ab] → quest\/[ab] → quest\/[ab]/), zyklus.fehler.join('\n'));
  const bis = pr([U('quest/a'), U('quest/b')], [{ id: '1', schaltet: ['quest/b'], wenn: { einheit: 'quest/a', stufe: 3 }, enthuellung: 'x' }], { stufen: { bis: 2 } });
  wahr(hat(bis.fehler, /quest\/b: geht nie auf.*verlangt Stufe 3.*höchstens Stufe 2/), bis.fehler.join('\n'));
  const takt = pr([U('quest/a'), U('quest/b')], [{ id: '1', schaltet: ['quest/b'], wenn: { takt: 2 }, enthuellung: 'x' }]);
  wahr(hat(takt.fehler, /takt-Bedingung, aber rhythmus\.takt fehlt/), takt.fehler.join('\n')); wahr(hat(takt.fehler, /quest\/b: geht nie auf/));
  const kette = pr([U('quest/a'), U('quest/b'), U('quest/c')], [{ id: '1', schaltet: ['quest/b'], wenn: { einheit: 'quest/c' }, enthuellung: 'x' }, { id: '2', schaltet: ['quest/c'], wenn: { einheit: 'quest/b' }, enthuellung: 'x' }, { id: '3', schaltet: ['quest/a'], wenn: { einheit: 'quest/c' }, enthuellung: 'x' }]);
  wahr(hat(kette.fehler, /Zyklus ohne Einstieg/) && hat(kette.fehler, /quest\/a: geht nie auf.*hängt von quest\/c/), kette.fehler.join('\n'));
  const gut = pr([U('quest/a'), U('quest/b')], [{ id: '1', schaltet: ['quest/b'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' }]);
  gleich(gut.fehler, []); gleich(gut.info.nieAufgehend, 0);
});
test('pruefe: kritische Einheit, die nie aufgeht, blockiert die Sammlung (Hinweis im Fehler); Folgen werden zusammengefasst', () => {
  const r = pr([U('episode/e'), U('quest/k', { in: 'episode/e', gewicht: 'kritisch' }), U('inhalt/i', { in: 'episode/e' })], [{ id: '1', schaltet: ['quest/k'], wenn: { einheit: 'quest/k' }, enthuellung: 'x' }]);
  wahr(hat(r.fehler, /quest\/k: .*kritisch/), r.fehler.join('\n'));
});
test('pruefe: mehr als ein Drittel verborgen, sichtbar ohne Wirkung, Sammel-Einheit ohne Inhalt oder nur mit Optionalem', () => {
  const einh = [U('quest/a'), U('quest/b', { sichtbar: 'verborgen' }), U('quest/c', { sichtbar: 'verborgen' }), U('quest/d'), U('episode/leer'), U('episode/opt'), U('inhalt/o', { in: 'episode/opt', gewicht: 'optional' })];
  const r = pr(einh, [{ id: '1', schaltet: ['quest/b', 'quest/c'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' }]);
  wahr(hat(r.warnungen, /mehr als ein Drittel der Einheiten ist verborgen \(2 von 7\)/) === false, 'zwei von sieben sind nicht mehr als ein Drittel');
  const r2 = pr([U('quest/a'), U('quest/b', { sichtbar: 'verborgen' }), U('quest/c', { sichtbar: 'verborgen' })], [{ id: '1', schaltet: ['quest/b', 'quest/c'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' }]);
  wahr(hat(r2.warnungen, /mehr als ein Drittel.*\(2 von 3\)/), r2.warnungen.join('\n'));
  wahr(hat(r.warnungen, /episode\/leer: Sammel-Einheit ohne Inhalt/) && hat(r.warnungen, /episode\/opt: enthält nur optionale/), r.warnungen.join('\n'));
  wahr(hat(pr([U('quest/a', { sichtbar: 'verborgen' })]).warnungen, /sichtbar hat keine Wirkung/));
});
test('pruefe: Tippfehler und ungültige Angaben in Bedingungen und Rhythmus', () => {
  const r = pr([U('quest/a'), U('quest/b')], [{ id: 'r', schaltet: ['quest/b'], wenn: { einheit: 'quest/a', stuffe: 2, mindestens: 'viele' }, enthuellung: 'x' }, { id: 's', schaltet: ['quest/b'], wenn: { takt: 'x' }, enthuellung: 'x' }, { id: 't', schaltet: ['quest/b'], wenn: { ab: 'irgendwann' }, enthuellung: 'x' }, { id: 'u', schaltet: ['quest/b'], wenn: { wartezeit: { einheit: 'quest/a', stunden: -1 } }, enthuellung: 'x' }, { id: 'u', schaltet: ['quest/b'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' }],
    { rhythmus: { takt: { laenge: 'jahr', beginn: 'gestern' }, wiederkehr: { abstand_tage: [1, 'x'] }, verfall_tage: -3 }, stufen: { anteil: 3, bis: 9 } });
  for (const m of [/unbekanntes Feld „stuffe“/, /mindestens „viele“ ungültig/, /takt braucht eine ganze Zahl/, /ab „irgendwann“ ist kein Datum/, /wartezeit\.stunden/, /Regel u: id doppelt/, /takt\.laenge „jahr“/, /takt\.beginn „gestern“/, /abstand_tage muss eine Liste positiver Zahlen/, /verfall_tage muss/, /stufen\.anteil muss/, /stufen\.bis muss/]) wahr(hat(r.fehler.concat(r.warnungen), m), String(m) + '\n' + r.fehler.concat(r.warnungen).join('\n'));
});
test('pruefe: Kopf (format, id, basis), zyklisches in, Felder an der falschen Art, Anteil 0.67 als Befund', () => {
  const r = SP.pruefe({ einheiten: [U('episode/a', { in: 'episode/b', kann: 'x', staerke: 1 }), U('episode/b', { in: 'episode/a' })] });
  wahr(hat(r.fehler, /id fehlt/) && hat(r.fehler, /in führt im Kreis/), r.fehler.join('\n')); wahr(hat(r.warnungen, /format fehlt/) && hat(r.warnungen, /basis fehlt/) && hat(r.warnungen, /kann gehört nur an skill/) && hat(r.warnungen, /staerke gehört nur an quest/), r.warnungen.join('\n'));
  wahr(hat(SP.pruefe(plan([U('quest/a')], [], { format: 'andere/1' })).fehler, /format „andere\/1“ ist kein Spielplan-Format/));
  wahr(hat(SP.pruefe(plan([U('quest/a')], [], { stufen: { anteil: 0.67 } })).warnungen, /nicht zwei Drittel/));
  gleich(SP.pruefe('kein plan'), { fehler: ['Der Spielplan ist kein Objekt (erwartet: format, id, einheiten, regeln).'], warnungen: [], info: {} });
});
test('pruefe: Sammel-Einheit, die nur durch direkte Ereignisse aufgeht (vorsichtige Rechnung) ist eine Warnung', () => {
  const r = pr([U('episode/e'), U('quest/z')], [{ id: '1', schaltet: ['quest/z'], wenn: { einheit: 'episode/e' }, enthuellung: 'x' }]);
  gleich(r.fehler, []); wahr(hat(r.warnungen, /Sammel-Einheit ohne Inhalt/));
  const r2 = pr([U('episode/e'), U('inhalt/i', { in: 'episode/e', gewicht: 'optional' }), U('quest/z')], [{ id: '1', schaltet: ['quest/z'], wenn: { einheit: 'episode/e' }, enthuellung: 'x' }]);
  wahr(hat(r2.warnungen, /gehen nur auf, wenn direkt an einer Sammel-Einheit .* gemeldet wird.*quest\/z/), r2.warnungen.join('\n'));
});
test('Abgeleitete Ereignisse (freigeschaltet) und Wurzelstufe', () => {
  const s = ST(KAFFEE, [KA('geschafft', 'quest/kaldi-mythos', T(10, 12))], T(11));
  gleich(SP.abgeleiteteEreignisse(s, { wer: 'lokal:a', app: 'museum/kaffee' }), [{ wer: 'lokal:a', verb: 'freigeschaltet', objekt: 'werkzeug/roestkurve', zeit: T(10, 12), app: 'museum/kaffee', regel: 'roestkurve' }]);
  gleich(SP.wurzelStufe(KAFFEE, s), 0);
  const p = plan([U('gebiet/a'), U('gebiet/b'), U('episode/x', { in: 'gebiet/a' }), U('episode/y', { in: 'gebiet/b' })]);
  const s2 = ST(p, [E('geschafft', 'episode/x', T(10)), E('geschafft', 'episode/y', T(10))], T(11));
  gleich(SP.wurzelStufe(p, s2), 2, 'mehrere Wurzeln: Sammel-Regel über sie'); gleich(SP.wurzelStufe(p, ST(p, [E('geschafft', 'episode/x', T(10))], T(11))), 0);
});

/* ================================================================ 4. Eigenschaften */

gruppe('4 Eigenschaften');

const TAGMS = 86400000, STUNDEMS = 3600000;
const ISO = ms => new Date(ms).toISOString().replace('.000Z', 'Z');

/** Zufallsplan: Gebiete, Episoden, Einheiten, Skills, Regeln, Kurzformen, Rhythmus; alle Verweise gültig, Zyklen erlaubt. */
function genPlan(r) {
  const einh = [], regeln = [];
  const gew = () => r.pick(['wesentlich', 'wesentlich', 'wesentlich', 'kritisch', 'optional']);
  const sicht = () => r.chance(0.15) ? 'verborgen' : undefined;
  const nG = 1 + r.int(2), nE = 2 + r.int(3), nS = 1 + r.int(3), nL = 5 + r.int(8);
  const gebiete = Array.from({ length: nG }, (_, i) => 'gebiet/g' + i);
  const episoden = Array.from({ length: nE }, (_, i) => 'episode/e' + i);
  const skills = Array.from({ length: nS }, (_, i) => 'skill/s' + i);
  gebiete.forEach((id, i) => einh.push({ id, art: 'gebiet', name: 'G' + i, gewicht: gew(), sichtbar: sicht() }));
  episoden.forEach((id, i) => einh.push({ id, art: 'episode', name: 'E' + i, in: r.chance(0.8) ? (r.chance(0.2) && i > 0 ? episoden[r.int(i)] : r.pick(gebiete)) : undefined, gewicht: gew(), reihenfolge: r.chance(0.7) ? i + 1 : undefined, sichtbar: sicht(), uebt: r.chance(0.2) ? [r.pick(skills)] : undefined }));
  skills.forEach((id, i) => einh.push({ id, art: 'skill', name: 'S' + i, kann: 'Ich kann ' + i + '.', gewicht: gew() }));
  const werkzeuge = [], leafs = [];
  for (let i = 0; i < nL; i++) {
    const art = r.pick(['inhalt', 'inhalt', 'quest', 'quest', 'erlebnis', 'werkzeug']);
    const id = art + '/l' + i;
    (art === 'werkzeug' ? werkzeuge : leafs).push(id);
    const eltern = art !== 'werkzeug' || r.chance(0.2) ? (r.chance(0.2) ? [r.pick(episoden), r.pick(episoden)] : (r.chance(0.8) ? r.pick(episoden) : undefined)) : undefined;
    einh.push({ id, art, name: 'L' + i, in: eltern, gewicht: gew(), reihenfolge: r.chance(0.6) ? 1 + r.int(5) : undefined, sichtbar: sicht(), uebt: art !== 'werkzeug' && r.chance(0.4) ? [r.pick(skills)] : undefined });
  }
  const alleIds = einh.map(u => u.id);
  einh.forEach(u => {
    if (u.art === 'gebiet') return;
    if (r.chance(0.18)) { const o = r.pick(alleIds); if (o !== u.id) u.nach = o; }
    if (werkzeuge.length && r.chance(0.12) && u.art !== 'werkzeug') u.braucht = [r.pick(werkzeuge)];
  });
  const hatTakt = r.chance(0.7);
  const stufeZ = () => r.pick([1, 2, 2, 2, 3, 4]);
  const baustein = () => {
    const t = r.int(10);
    if (t < 5) return { einheit: r.pick(alleIds), stufe: stufeZ() };
    if (t === 5) return { art: r.pick(['inhalt', 'quest', 'erlebnis', 'werkzeug', 'episode']), stufe: stufeZ(), mindestens: r.pick([1, 2, 3, 'alle']) };
    if (t === 6) return { art: r.pick(['inhalt', 'quest', 'erlebnis']), in: r.pick(episoden), stufe: stufeZ(), mindestens: r.pick([1, 2]) };
    if (t === 7) return { einheit: r.pick(['quest/*', 'inhalt/l*', '*/l1*', 'episode/*']), stufe: stufeZ(), mindestens: r.pick([1, 2, 'alle']) };
    if (t === 8) return r.chance(0.5) && hatTakt ? { takt: 1 + r.int(4) } : { ab: ISO(Date.UTC(2026, 9, 1 + r.int(40))).slice(0, 10) };
    return { wartezeit: { einheit: r.pick(alleIds), stufe: r.pick([1, 2, 3]), stunden: r.pick([1, 3, 24, 50]) } };
  };
  const cond = d => {
    if (d < 2 && r.chance(0.3)) {
      const n = 2 + r.int(2), von = Array.from({ length: n }, () => cond(d + 1));
      const k = r.int(3);
      return k === 0 ? { alle: von } : k === 1 ? { eine: von } : { mindestens: 1 + r.int(n), von };
    }
    return baustein();
  };
  const nR = r.int(6);
  for (let i = 0; i < nR; i++) regeln.push({ id: 'r' + i, schaltet: r.shuffle(alleIds).slice(0, 1 + r.int(2)), wenn: cond(0), enthuellung: 'Enthüllung ' + i });
  const p = { format: 'spielplan/0', id: 'zufall', name: 'Zufall', basis: 'https://example.org/z/', einheiten: einh, regeln };
  if (hatTakt) p.rhythmus = { takt: { laenge: r.pick(['tag', 'woche', 'monat']), beginn: r.chance(0.7) ? 'erstes-ereignis' : '2026-09-' + String(10 + r.int(20)) }, wiederkehr: { abstand_tage: [1, 3, 7], fuer: r.chance(0.5) ? { art: 'skill' } : undefined }, verfall_tage: r.pick([10, 35]) };
  else if (r.chance(0.5)) p.rhythmus = { verfall_tage: 20, wiederkehr: { abstand_tage: [2, 5] } };
  if (r.chance(0.25)) p.stufen = { anteil: r.pick([0.5, 0.75, 1, '2/3']) };
  if (r.chance(0.2)) p.stufen = Object.assign(p.stufen || {}, { bis: r.pick([2, 3]) });
  return JSON.parse(JSON.stringify(p));
}
function genEreignisse(r, p, n) {
  const ids = p.einheiten.map(u => u.id), werkzeuge = ids.filter(i => i.startsWith('werkzeug/'));
  const start = Date.UTC(2026, 9, 1), ev = [];
  for (let i = 0; i < n; i++) {
    const verb = r.pick(['begonnen', 'erkundet', 'geschafft', 'geschafft', 'bestanden', 'angewendet', 'angewendet', 'geteilt']);
    const e = { wer: 'lokal:z', verb, objekt: r.pick(ids), zeit: ISO(start + r.int(60) * TAGMS + r.int(24) * STUNDEMS + r.int(60) * 60000), app: 'zufall' };
    if (verb === 'angewendet' && r.chance(0.75)) e.beleg = { art: r.pick(['messung', 'bestaetigung', 'eigen']), fall: r.chance(0.8) ? r.pick(['a', 'b', 'c']) : undefined };
    if (werkzeuge.length && r.chance(0.25)) e.mit = [r.pick(werkzeuge)];
    ev.push(JSON.parse(JSON.stringify(e)));
  }
  return ev;
}

/** Das Orakel: eine zweite, bewusst einfache Umsetzung der Regeln des Standards (und der Auslegung), nur für den Vergleich. Rechnet naiv für ein jetzt. */
function orakel(p, ereignisse, jetztMs, opts = {}) {
  const by = Object.fromEntries(p.einheiten.map(u => [u.id, u])), ids = p.einheiten.map(u => u.id);
  const par = id => [].concat(by[id].in || []);
  const gewicht = id => by[id].gewicht || 'wesentlich';
  const anteil = p.stufen && p.stufen.anteil !== undefined ? (p.stufen.anteil === '2/3' ? 2 / 3 : p.stufen.anteil) : 2 / 3;
  const brauch = n => n === 0 ? 0 : Math.ceil(n * anteil - 1e-9);
  const members = id => ids.filter(m => par(m).includes(id) || (by[id].art === 'skill' && (by[m].uebt || []).includes(id)));
  const ev = ereignisse.map(e => Object.assign({}, e, { z: Math.min(Date.parse(e.zeit), jetztMs) }));
  const DURCH = ['geschafft', 'bestanden', 'angewendet'];
  function direkt(id, evs) {
    const mine = [];
    for (const e of evs) {
      if (e.objekt === id) mine.push(e);
      else if (by[id].art === 'werkzeug' && (e.mit || []).includes(id) && DURCH.includes(e.verb)) mine.push(Object.assign({}, e, { objekt: id }));
    }
    if (!mine.length) return 0;
    let L = 1;
    if (mine.some(e => DURCH.includes(e.verb))) L = 2;
    const bel = mine.filter(e => e.verb === 'angewendet' && e.beleg && ['messung', 'bestaetigung', 'eigen'].includes(e.beleg.art));
    if (bel.length) L = 3;
    const faelle = new Set(bel.map(e => e.beleg.fall).filter(f => f !== undefined && f !== null && String(f).trim() !== '').map(f => String(f).trim().toLowerCase()));
    if (bel.length && (faelle.size >= 2 || mine.some(e => e.verb === 'geteilt'))) L = 4;
    return L;
  }
  function stufen(evs) {
    const s = {};
    ids.forEach(id => { s[id] = direkt(id, evs); });
    for (let geaendert = true; geaendert;) {
      geaendert = false;
      for (const id of ids) {
        const mem = members(id);
        if (!mem.length) continue;
        const kr = mem.filter(m => gewicht(m) === 'kritisch'), ws = mem.filter(m => gewicht(m) === 'wesentlich');
        if (!kr.length && !ws.length) continue;
        let best = 0;
        for (let L = 1; L <= 4; L++) if (kr.every(m => s[m] >= L) && ws.filter(m => s[m] >= L).length >= brauch(ws.length)) best = L;
        if (best > s[id]) { s[id] = best; geaendert = true; }
      }
    }
    return s;
  }
  const zeiten = [...new Set(ev.map(e => e.z))].sort((a, b) => a - b), cache = new Map();
  const stufenBei = t => { if (!cache.has(t)) cache.set(t, stufen(ev.filter(e => e.z <= t))); return cache.get(t); };
  const sJetzt = stufen(ev);
  function erreicht(id, sigma) { if (sigma <= 0) return -Infinity; for (const t of zeiten) if (stufenBei(t)[id] >= sigma) return t; return Infinity; }
  // Takt
  const tk = p.rhythmus && p.rhythmus.takt, erstes = ev.length ? Math.min(...ev.map(e => e.z)) : null;
  const tagAnfang = ms => ms - (((ms % TAGMS) + TAGMS) % TAGMS);
  const anker = !tk ? null : ((tk.beginn || 'erstes-ereignis') === 'erstes-ereignis' ? (erstes === null ? null : tagAnfang(erstes)) : Date.parse(tk.beginn));
  function taktStart(n) {
    if (tk.laenge === 'tag') return anker + (n - 1) * TAGMS;
    if (tk.laenge === 'woche') return anker + (n - 1) * 7 * TAGMS;
    const d = new Date(anker), letzter = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 0)).getUTCDate();
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n - 1, Math.min(d.getUTCDate(), letzter));
  }
  function taktIndex(t) { if (anker === null || t < anker) return 0; let n = 1; while (taktStart(n + 1) <= t) n++; return n; }
  // Regeln samt Kurzformen
  const regeln = (p.regeln || []).map(x => ({ ziele: x.schaltet, wenn: x.wenn }));
  for (const u of p.einheiten) {
    const teile = [];
    if (u.nach) teile.push({ einheit: u.nach });
    (u.braucht || []).forEach(w => teile.push({ einheit: w, stufe: 1, offen: true }));
    if (teile.length) regeln.push({ ziele: [u.id], wenn: teile.length === 1 ? teile[0] : { alle: teile } });
  }
  const gesperrtVon = {};
  regeln.forEach(x => x.ziele.forEach(z => { (gesperrtVon[z] = gesperrtVon[z] || []).push(x); }));
  const globRe = m => new RegExp('^' + m.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  const vorfahren = id => { const out = new Set(), todo = [...par(id)]; while (todo.length) { const q = todo.pop(); if (out.has(q) || q === id) continue; out.add(q); todo.push(...par(q)); } return out; };
  const passend = c => ids.filter(id => (!c.einheit || globRe(c.einheit).test(id)) && (!c.art || by[id].art === c.art) && (!c.in || [...vorfahren(id)].some(a => globRe(c.in).test(a))));
  function gilt(c, offen) {
    if (c.alle) return c.alle.every(x => gilt(x, offen));
    if (c.eine) return c.eine.some(x => gilt(x, offen));
    if (c.von) return c.von.filter(x => gilt(x, offen)).length >= c.mindestens;
    if (c.takt !== undefined) return tk ? taktIndex(jetztMs) >= c.takt : false;
    if (c.ab !== undefined) return Date.parse(c.ab) <= jetztMs;
    if (c.wartezeit) { const t = erreicht(c.wartezeit.einheit, c.wartezeit.stufe === undefined ? 2 : c.wartezeit.stufe); return t + (opts.ohneWartezeit ? 0 : c.wartezeit.stunden * STUNDEMS) <= jetztMs; }
    const m = passend(c), sigma = c.stufe === undefined ? 2 : c.stufe, k = c.mindestens === 'alle' ? m.length : (c.mindestens === undefined ? 1 : c.mindestens);
    if (!m.length || k > m.length) return false;
    return m.filter(id => (sigma <= 0 || sJetzt[id] >= sigma) && (!c.offen || offen.has(id))).length >= k;
  }
  const eigenOffen = (id, offen) => !gesperrtVon[id] || gesperrtVon[id].some(x => gilt(x.wenn, offen));
  const elternOffen = (id, offen) => !par(id).length || par(id).some(q => offen.has(q));
  const offen = new Set();
  for (let geaendert = true; geaendert;) {
    geaendert = false;
    for (const id of ids) if (!offen.has(id) && elternOffen(id, offen) && eigenOffen(id, offen)) { offen.add(id); geaendert = true; }
  }
  return { stufe: sJetzt, offen, takt: tk ? taktIndex(jetztMs) : 0, gated: new Set(Object.keys(gesperrtVon)), gilt, eigenOffen, elternOffen };
}
const zeigePlan = p => JSON.stringify(p).slice(0, 1500);
const LAEUFE = KURZ ? 60 : 400;
function zufallsfall(r) {
  const p = genPlan(r), ev = genEreignisse(r, p, r.int(26));
  const letzte = ev.length ? Math.max(...ev.map(e => Date.parse(e.zeit))) : Date.UTC(2026, 9, 5);
  return { p, ev, jetzt: letzte + r.int(15 * 24) * STUNDEMS + r.int(60) * 60000 };
}

test('Orakel: Stufen, Zugang, Takt und Freischaltungen stimmen mit einer unabhängigen, naiven Rechnung überein (auch zu früheren Zeitpunkten und ohne Wartezeit)', () => {
  const r = rng(20261009);
  let offenGesamt = 0, gesperrtGesamt = 0, hoch = 0;
  for (let i = 0; i < LAEUFE; i++) {
    const { p, ev, jetzt } = zufallsfall(r);
    const fruehe = ev.length ? Date.parse(ev[0].zeit) + r.int(30 * 24) * STUNDEMS : jetzt;
    for (const [j, evs, opts] of [[jetzt, ev, {}], [Math.min(fruehe, jetzt), ev.filter(e => Date.parse(e.zeit) <= Math.min(fruehe, jetzt)), {}], [jetzt, ev, { ohneWartezeit: true }]]) {
      const s = SP.spielstand(p, evs, ISO(j), opts), o = orakel(p, evs, j, opts);
      const wo = `Lauf ${i}, jetzt ${ISO(j)}, ${JSON.stringify(opts)}\nPlan: ${zeigePlan(p)}\nEreignisse: ${JSON.stringify(evs).slice(0, 900)}`;
      for (const u of p.einheiten) {
        assert.strictEqual(s.einheiten[u.id].stufe, o.stufe[u.id], `Stufe ${u.id}\n${wo}`);
        assert.strictEqual(s.einheiten[u.id].zugang === 'offen', o.offen.has(u.id), `Zugang ${u.id}\n${wo}`);
        if (o.offen.has(u.id)) offenGesamt++; else gesperrtGesamt++;
        if (o.stufe[u.id] >= 3) hoch++;
      }
      assert.strictEqual(s.takt, o.takt, `Takt\n${wo}`);
      const erwartet = [...o.gated].filter(id => o.offen.has(id)).sort();
      assert.deepStrictEqual(s.freigeschaltet.map(f => f.einheit).sort(), erwartet, `freigeschaltet\n${wo}`);
    }
  }
  wahr(offenGesamt > 1000 && gesperrtGesamt > 300 && hoch > 50, `der Zufall muss offene, gesperrte und hohe Stufen treffen (${offenGesamt}/${gesperrtGesamt}/${hoch})`);
});
test('Fixpunkt stabil: keine Regel, die gilt, lässt ein Ziel gesperrt (unabhängige Auswertung der Regeln auf dem ausgegebenen Spielstand)', () => {
  const r = rng(77);
  for (let i = 0; i < LAEUFE; i++) {
    const { p, ev, jetzt } = zufallsfall(r), s = SP.spielstand(p, ev, ISO(jetzt)), o = orakel(p, ev, jetzt);
    const offen = new Set(p.einheiten.filter(u => s.einheiten[u.id].zugang === 'offen').map(u => u.id));
    for (const u of p.einheiten) if (!offen.has(u.id)) assert.ok(!(o.elternOffen(u.id, offen) && o.eigenOffen(u.id, offen)), `Lauf ${i}: ${u.id} müsste offen sein\n${zeigePlan(p)}`);
  }
});
test('Reihenfolge der Ereignisse, der Einheiten und der Regeln ändert den Spielstand nicht (ganzer Spielstand, auch Sätze und Aufgabe)', () => {
  const r = rng(31337);
  for (let i = 0; i < LAEUFE; i++) {
    const { p, ev, jetzt } = zufallsfall(r);
    const basis = JSON.stringify(SP.spielstand(p, ev, ISO(jetzt)));
    const p2 = Object.assign({}, p, { einheiten: r.shuffle(p.einheiten), regeln: r.shuffle(p.regeln) });
    const s2 = JSON.stringify(SP.spielstand(p2, r.shuffle(ev), ISO(jetzt)));
    assert.strictEqual(s2, basis, `Lauf ${i}\nPlan: ${zeigePlan(p)}\nEreignisse: ${JSON.stringify(ev).slice(0, 600)}`);
  }
});
test('Zusätzliche Ereignisse senken nie eine Stufe, sperren nie etwas zu und verschieben keine Freischaltung nach hinten', () => {
  const r = rng(555);
  for (let i = 0; i < LAEUFE; i++) {
    const { p, ev, jetzt } = zufallsfall(r);
    const mehr = ev.concat(genEreignisse(r, p, 1 + r.int(10)).map(e => Object.assign(e, { zeit: ISO(Math.min(Date.parse(e.zeit), jetzt)) })));
    const a = SP.spielstand(p, ev, ISO(jetzt)), b = SP.spielstand(p, mehr, ISO(jetzt));
    const wo = `Lauf ${i}\n${zeigePlan(p)}`;
    for (const u of p.einheiten) {
      wahr(b.einheiten[u.id].stufe >= a.einheiten[u.id].stufe, `Stufe ${u.id} sinkt: ${wo}`);
      if (a.einheiten[u.id].zugang === 'offen') gleich(b.einheiten[u.id].zugang, 'offen', `${u.id} geht zu: ${wo}`);
    }
    wahr(b.takt >= a.takt, 'Takt sinkt');
    const am = Object.fromEntries(b.freigeschaltet.map(f => [f.einheit, f.am]));
    for (const f of a.freigeschaltet) wahr(f.einheit in am && am[f.einheit] <= f.am, `Freischaltung ${f.einheit} verschwindet oder verspätet sich: ${wo}`);
  }
});
test('Pausen verändern keine Stufe: spätere Zeitpunkte liefern dieselben Stufen, nie weniger offene Einheiten', () => {
  const r = rng(909);
  for (let i = 0; i < LAEUFE; i++) {
    const { p, ev, jetzt } = zufallsfall(r);
    const a = SP.spielstand(p, ev, ISO(jetzt)), b = SP.spielstand(p, ev, ISO(jetzt + (1 + r.int(400)) * STUNDEMS));
    for (const u of p.einheiten) {
      gleich(b.einheiten[u.id].stufe, a.einheiten[u.id].stufe, `Stufe ${u.id}: ${zeigePlan(p)}`);
      if (a.einheiten[u.id].zugang === 'offen') gleich(b.einheiten[u.id].zugang, 'offen');
    }
    wahr(b.takt >= a.takt);
    const aus = SP.spielstand(p, ev, ISO(jetzt), { ohneWartezeit: true });
    for (const u of p.einheiten) if (a.einheiten[u.id].zugang === 'offen') gleich(aus.einheiten[u.id].zugang, 'offen', 'ohne Wartezeit nie weniger offen');
  }
});
test('Ereignisse aus der Zukunft (falsche Uhr): wenn die Zeit weiterläuft, sinkt keine Stufe und geht nichts wieder zu', () => {
  const r = rng(321);
  let zukunft = 0;
  for (let i = 0; i < LAEUFE; i++) {
    const { p, ev } = zufallsfall(r), j1 = Date.parse('2026-10-20T00:00:00Z') + r.int(10 * 24) * STUNDEMS, j2 = j1 + (1 + r.int(30 * 24)) * STUNDEMS;
    zukunft += ev.filter(e => Date.parse(e.zeit) > j1).length;
    const a = SP.spielstand(p, ev, ISO(j1)), b = SP.spielstand(p, ev, ISO(j2));
    for (const u of p.einheiten) {
      wahr(b.einheiten[u.id].stufe >= a.einheiten[u.id].stufe, `Stufe ${u.id} sinkt\n${zeigePlan(p)}`);
      if (a.einheiten[u.id].zugang === 'offen') gleich(b.einheiten[u.id].zugang, 'offen', `${u.id} geht wieder zu\n${zeigePlan(p)}`);
    }
  }
  wahr(zukunft > 100, 'der Zufall muss Ereignisse nach jetzt treffen');
});
test('Doppelte Ereignisse ändern nichts; der Spielstand ist reines JSON', () => {
  const r = rng(1234);
  for (let i = 0; i < LAEUFE / 2; i++) {
    const { p, ev, jetzt } = zufallsfall(r);
    const a = SP.spielstand(p, ev, ISO(jetzt)), b = SP.spielstand(p, ev.concat(ev), ISO(jetzt));
    gleich(JSON.stringify(b), JSON.stringify(a));
    gleich(JSON.parse(JSON.stringify(a)), a, 'keine undefined, Infinity oder NaN im Spielstand');
  }
});
test('Aufgabe und Sätze: immer offen und mit „bringt“; nie eine verborgene Einheit; Satz genau an gesperrten, angedeuteten Einheiten', () => {
  const r = rng(808);
  let mitAufgabe = 0, ohne = 0;
  for (let i = 0; i < LAEUFE; i++) {
    const { p, ev, jetzt } = zufallsfall(r), s = SP.spielstand(p, ev, ISO(jetzt)), by = Object.fromEntries(p.einheiten.map(u => [u.id, u]));
    const verborgen = p.einheiten.filter(u => s.einheiten[u.id].sichtbar === 'verborgen');
    for (const u of p.einheiten) {
      const e = s.einheiten[u.id];
      if (e.zugang === 'offen') wahr(e.bedingung === undefined && e.sichtbar === undefined, `${u.id}: offene Einheit ohne Satz`);
      else if (e.sichtbar === 'angedeutet') wahr(typeof e.bedingung === 'string' && e.bedingung.length > 12, `${u.id}: gesperrte, angedeutete Einheit braucht einen Satz`);
      else gleich(e.bedingung, undefined, `${u.id}: verborgen hat keinen Satz`);
    }
    for (const v of verborgen) for (const u of p.einheiten) {
      const b = s.einheiten[u.id].bedingung;
      if (b !== undefined) wahr(!b.includes('„' + v.name + '“'), `der Satz an ${u.id} verrät die verborgene Einheit ${v.id}: ${b}`);
    }
    if (s.aufgabe) {
      mitAufgabe++;
      wahr(by[s.aufgabe.einheit] && s.einheiten[s.aufgabe.einheit].zugang === 'offen', 'Aufgabe an gesperrter oder unbekannter Einheit');
      wahr(typeof s.aufgabe.bringt === 'string' && s.aufgabe.bringt.length > 8 && typeof s.aufgabe.text === 'string' && s.aufgabe.text.length > 5, 'Aufgabe ohne Sätze');
      for (const v of verborgen) wahr(!s.aufgabe.bringt.includes('„' + v.name + '“'), `die Aufgabe verrät ${v.id}: ${s.aufgabe.bringt}`);
      wahr(Object.keys(s.aufgabe).includes('einheit') && !Array.isArray(s.aufgabe), 'genau eine Aufgabe');
    } else {
      ohne++;
      const bis = s.bis;
      const hatMitglieder = id => p.einheiten.some(u => [].concat(u.in || []).includes(id) || (by[id].art === 'skill' && (u.uebt || []).includes(id)));
      const offeneTaten = p.einheiten.filter(u => ['inhalt', 'quest', 'erlebnis', 'werkzeug', 'episode'].includes(u.art) && !hatMitglieder(u.id) && s.einheiten[u.id].zugang === 'offen' && s.einheiten[u.id].stufe < bis);
      gleich(offeneTaten.map(u => u.id), [], `keine Aufgabe, obwohl noch etwas zu tun ist: ${zeigePlan(p)}`);
    }
    for (const f of s.freigeschaltet) wahr(f.enthuellung.length > 5 && Date.parse(f.am) <= jetzt, 'Freischaltung ohne Satz oder aus der Zukunft');
  }
  wahr(mitAufgabe > LAEUFE / 4 && ohne > 0, `Zufall trifft beide Fälle (${mitAufgabe}/${ohne})`);
});
test('Der Aufgabe folgen führt zum Ende: Schritt für Schritt wird alles Erreichbare geöffnet und bis zur höchsten vergebenen Stufe gebracht (Spielbarkeit)', () => {
  const r = rng(2468);
  let zuEnde = 0, geoeffnet = 0, schritteGesamt = 0;
  const actionable = (p, id) => { const u = p.einheiten.find(x => x.id === id); return ['inhalt', 'quest', 'erlebnis', 'werkzeug', 'episode'].includes(u.art) && !p.einheiten.some(m => [].concat(m.in || []).includes(id) || (u.art === 'skill' && (m.uebt || []).includes(id))); };
  const ereignisFuer = (a, zeit) => {
    const e = { wer: 'lokal:z', objekt: a.einheit, zeit, app: 'zufall' };
    if (a.art === 'wiederkehr') return Object.assign(e, { verb: 'erkundet' });
    if (a.stufe <= 1) return Object.assign(e, { verb: 'begonnen' });
    if (a.stufe === 2) return Object.assign(e, { verb: 'geschafft' });
    return Object.assign(e, { verb: 'angewendet', beleg: { art: 'eigen', fall: a.stufe === 3 ? 'a' : 'b' } });
  };
  for (let i = 0; i < Math.min(LAEUFE, 250); i++) {
    const p = genPlan(r);
    const bis = (p.stufen && p.stufen.bis) || 4;
    const ev = [], FERN = Date.UTC(2030, 0, 1);
    let t = Date.UTC(2026, 9, 1), schritte = 0, ende = null;
    for (; schritte < 4000; schritte++) {
      const s = SP.spielstand(p, ev, ISO(t));
      if (s.aufgabe) {
        const a = s.aufgabe;
        wahr(s.einheiten[a.einheit].zugang === 'offen', `Aufgabe an gesperrter Einheit (Lauf ${i})`);
        const vorher = s.einheiten[a.einheit].stufe;
        ev.push(ereignisFuer(a, ISO(t)));
        if (a.art !== 'wiederkehr') { const nach = SP.spielstand(p, ev, ISO(t)).einheiten[a.einheit].stufe; wahr(nach > vorher, `Die Aufgabe ${JSON.stringify(a)} bringt die Stufe nicht voran (${vorher} → ${nach}); Lauf ${i}\n${zeigePlan(p)}`); }
        t += 3600000; continue;
      }
      // keine Aufgabe: geht durch bloßes Warten noch etwas auf?
      const jetztOffen = p.einheiten.filter(u => s.einheiten[u.id].zugang === 'offen').length;
      const spaeter = SP.spielstand(p, ev, ISO(t + 90 * TAGMS));
      if (p.einheiten.filter(u => spaeter.einheiten[u.id].zugang === 'offen').length > jetztOffen) { t += 90 * TAGMS; continue; }
      ende = s; break;
    }
    wahr(ende, `Lauf ${i}: kein Ende nach ${schritte} Schritten\n${zeigePlan(p)}`);
    // Was durch vollständiges Spielen überhaupt offen werden kann (unabhängig gerechnet): Ereignisse nur an aktionsfähige Einheiten, bis zur höchsten Stufe, unendlich lange warten
    const ids = p.einheiten.map(u => u.id), vollEv = [], fertig = new Set();
    for (let runde = 0; runde < ids.length + 3; runde++) {
      const st = SP.spielstand(p, vollEv, ISO(FERN)); let neu = false;
      for (const id of ids) if (st.einheiten[id].zugang === 'offen' && !fertig.has(id) && actionable(p, id)) {
        fertig.add(id); neu = true;
        const z = ISO(Date.UTC(2026, 9, 1) + vollEv.length * 60000);
        if (bis <= 1) vollEv.push({ wer: 'a', verb: 'begonnen', objekt: id, zeit: z });
        else if (bis === 2) vollEv.push({ wer: 'a', verb: 'geschafft', objekt: id, zeit: z });
        else { vollEv.push({ wer: 'a', verb: 'angewendet', objekt: id, zeit: z, beleg: { art: 'eigen', fall: 'a' } }); if (bis >= 4) vollEv.push({ wer: 'a', verb: 'angewendet', objekt: id, zeit: z, beleg: { art: 'eigen', fall: 'b' } }); }
      }
      if (!neu) break;
    }
    const erreichbar = new Set(ids.filter(id => SP.spielstand(p, vollEv, ISO(FERN)).einheiten[id].zugang === 'offen'));
    const gefolgt = new Set(ids.filter(id => ende.einheiten[id].zugang === 'offen'));
    // Hinweis: Wiederkehr-Ereignisse und Aufgaben-Ereignisse ändern die Stufen nur nach oben; offen ist, was offen sein kann
    gleich([...gefolgt].sort(), [...erreichbar].sort(), `Lauf ${i}: der Aufgabe folgen öffnet nicht dasselbe wie vollständiges Spielen\n${zeigePlan(p)}`);
    for (const id of gefolgt) if (actionable(p, id)) wahr(ende.einheiten[id].stufe >= bis, `${id} bleibt unter Stufe ${bis}: Lauf ${i}`);
    zuEnde++; geoeffnet += gefolgt.size; schritteGesamt += schritte;
  }
  wahr(zuEnde === Math.min(LAEUFE, 250) && schritteGesamt / zuEnde > 10, `Zufall spielt wirklich (${zuEnde} Pläne, im Mittel ${(schritteGesamt / zuEnde).toFixed(0)} Schritte)`);
});
test('Fuzz: Kaffee-Plan mit 1 bis 4 zufällig verdorbenen Feldern und Ereignissen: nichts wirft (außer TypeError bei nachXapi), nichts hängt', () => {
  const r = rng(7);
  const junk = () => r.pick([null, undefined, 0, -1, 1.5, NaN, Infinity, '', 'x', 'quest/kaldi-mythos', [], [1, 2], {}, { a: 1 }, true, false, '2026-13-45', 'Ich kann', ['quest/kaldi-mythos'], { einheit: 'quest/kaldi-mythos' }, { alle: [] }, { eine: 5 }, '*', 1e308, -1e308, 'x'.repeat(5000)]);
  const pfade = (o, pf = []) => { const out = []; if (o && typeof o === 'object') for (const k of Object.keys(o)) { out.push(pf.concat(k)); out.push(...pfade(o[k], pf.concat(k))); } return out; };
  const setze = (o, pf, v) => { let x = o; for (let i = 0; i < pf.length - 1; i++) x = x[pf[i]]; if (v === undefined) delete x[pf[pf.length - 1]]; else x[pf[pf.length - 1]] = v; };
  const lagerStumm = { getItem: () => null, setItem() {}, removeItem() {} };
  const t0 = Date.now();
  for (let i = 0; i < (KURZ ? 300 : 1500); i++) {
    const p = klon(KAFFEE);
    for (let k = 0, n = 1 + r.int(4); k < n; k++) setze(p, r.pick(pfade(p)), junk());
    const ev = [{ wer: 'a', verb: 'geschafft', objekt: 'quest/kaldi-mythos', zeit: '2026-10-09T10:00:00Z' }, { wer: 'a', verb: 'angewendet', objekt: 'erlebnis/roestung', zeit: '2026-10-10T10:00:00Z', beleg: junk(), mit: junk(), ergebnis: junk() }, junk()];
    try {
      SP.pruefe(p); SP.spielstand(p, [], '2026-11-01T00:00:00Z', { bis: junk(), wer: junk(), ohneWartezeit: junk() });
      const st = SP.spielstand(p, ev, '2026-11-01T00:00:00Z'); SP.abgeleiteteEreignisse(st, { wer: junk(), app: junk() }); SP.wurzelStufe(p, st);
      for (const e of ev) { try { SP.nachXapi(e, p, { homePage: junk(), registration: junk(), activityId: junk(), kontext: junk() }); } catch (x) { if (!(x instanceof TypeError)) throw x; } }
      const sp = SP.verbinde({ plan: p, jetzt: () => '2026-11-01T00:00:00Z', lager: lagerStumm }); sp.melde('geschafft', 'quest/kaldi-mythos', { mit: junk(), ergebnis: junk(), beleg: junk(), fall: junk() }); sp.stand(); sp.aktualisiere();
    } catch (e) { throw new Error(`Lauf ${i}: ${e.constructor.name}: ${e.message}\n${JSON.stringify(p).slice(0, 500)}`); }
  }
  wahr(Date.now() - t0 < 30000, 'zu langsam');
});
test('Prüfung wirft bei Zufallsplänen nie; Spielstand und Prüfung auch bei kaputten Plänen nicht', () => {
  const r = rng(4711);
  for (let i = 0; i < LAEUFE / 2; i++) {
    const { p } = zufallsfall(r);
    const pr1 = SP.pruefe(p);
    wahr(Array.isArray(pr1.fehler) && Array.isArray(pr1.warnungen));
    const kaputt = JSON.parse(JSON.stringify(p));
    const u = r.pick(kaputt.einheiten);
    r.pick([() => { delete u.id; }, () => { u.art = 5; }, () => { u.in = { x: 1 }; }, () => { u.uebt = 'text'; }, () => { kaputt.regeln = 'x'; }, () => { kaputt.regeln.push(null, 3, { id: 1 }); }, () => { kaputt.stufen = 5; }, () => { kaputt.rhythmus = []; }, () => { u.gewicht = null; }, () => { kaputt.regeln.forEach(x => { x.wenn = r.pick([null, [], { alle: 3 }, { takt: -1 }, { einheit: 7 }]); }); }])();
    const pr2 = SP.pruefe(kaputt);
    wahr(Array.isArray(pr2.fehler));
    SP.spielstand(kaputt, [], '2026-10-09T10:00:00Z');
  }
});

/* ================================================================ 5. xAPI */

gruppe('5 xAPI');

const IRI = /^[a-z][a-z0-9+.\-]*:[^\s]+$/i, UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DAUER = /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/;
/** Prüft ein Statement gegen die Pflichten aus xAPI 1.0.3 (Teil 2), soweit sie ohne LRS prüfbar sind. Gibt eine Liste von Meldungen zurück. */
function pruefeStatement(st) {
  const f = [];
  const obj = (x, w) => { if (!x || typeof x !== 'object' || Array.isArray(x)) { f.push(w + ' fehlt oder ist kein Objekt'); return false; } return true; };
  const sprachen = (m, w) => { if (!obj(m, w)) return; Object.entries(m).forEach(([k, v]) => { if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]+)*$/.test(k) || typeof v !== 'string') f.push(`${w}: ungültige Sprachtabelle`); }); };
  const aktivitaet = (a, w) => { if (!obj(a, w)) return; if (a.objectType !== undefined && a.objectType !== 'Activity') f.push(w + '.objectType'); if (typeof a.id !== 'string' || !IRI.test(a.id)) f.push(w + '.id ist keine IRI: ' + a.id); if (a.definition) { if (a.definition.name) sprachen(a.definition.name, w + '.definition.name'); if (a.definition.type && !IRI.test(a.definition.type)) f.push(w + '.definition.type keine IRI'); } };
  const erweiterungen = (e, w) => { if (e === undefined) return; if (!obj(e, w)) return; Object.keys(e).forEach(k => { if (!IRI.test(k)) f.push(`${w}: Schlüssel ${k} ist keine IRI`); }); };
  if (!st || typeof st !== 'object') return ['kein Statement'];
  const erlaubt = ['id', 'actor', 'verb', 'object', 'result', 'context', 'timestamp', 'stored', 'authority', 'version', 'attachments'];
  Object.keys(st).forEach(k => { if (!erlaubt.includes(k)) f.push('unbekannte Eigenschaft ' + k); });
  if (st.id !== undefined && !UUID.test(st.id)) f.push('id ist keine UUID: ' + st.id);
  if (obj(st.actor, 'actor')) {
    const ifi = ['mbox', 'mbox_sha1sum', 'openid', 'account'].filter(k => st.actor[k] !== undefined);
    if (st.actor.objectType !== undefined && !['Agent', 'Group'].includes(st.actor.objectType)) f.push('actor.objectType');
    if (ifi.length !== 1) f.push('actor braucht genau eine IFI, hat ' + ifi.length);
    if (st.actor.account && (!IRI.test(st.actor.account.homePage || '') || typeof st.actor.account.name !== 'string' || !st.actor.account.name)) f.push('actor.account braucht homePage (IRI) und name');
  }
  if (obj(st.verb, 'verb')) { if (!IRI.test(st.verb.id || '')) f.push('verb.id keine IRI'); if (st.verb.display) sprachen(st.verb.display, 'verb.display'); }
  aktivitaet(st.object, 'object');
  if (st.result !== undefined && obj(st.result, 'result')) {
    const r = st.result;
    ['completion', 'success'].forEach(k => { if (r[k] !== undefined && typeof r[k] !== 'boolean') f.push('result.' + k + ' kein Boolean'); });
    if (r.duration !== undefined && !DAUER.test(r.duration)) f.push('result.duration keine ISO-8601-Dauer: ' + r.duration);
    if (r.score) {
      const sc = r.score;
      if (typeof sc.raw !== 'number') f.push('score.raw');
      if (sc.scaled !== undefined && !(sc.scaled >= -1 && sc.scaled <= 1)) f.push('score.scaled außerhalb -1..1');
      if (sc.min !== undefined && sc.max !== undefined && !(sc.min <= sc.raw && sc.raw <= sc.max && sc.min < sc.max)) f.push('score min/raw/max widersprüchlich');
    }
    erweiterungen(r.extensions, 'result.extensions');
  }
  if (st.context !== undefined && obj(st.context, 'context')) {
    const c = st.context;
    if (c.registration !== undefined && !UUID.test(c.registration)) f.push('context.registration keine UUID');
    if (c.contextActivities) Object.entries(c.contextActivities).forEach(([k, v]) => { if (!['parent', 'grouping', 'category', 'other'].includes(k)) f.push('contextActivities.' + k); (Array.isArray(v) ? v : [v]).forEach((a, i) => aktivitaet(a, `contextActivities.${k}[${i}]`)); });
    erweiterungen(c.extensions, 'context.extensions');
  }
  if (st.timestamp !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(st.timestamp)) f.push('timestamp kein ISO-8601 mit Zone: ' + st.timestamp);
  return f;
}
const BASIS = 'https://zukunftsgut.org/spielplan/museum-kaffee/', EXT = 'https://zukunftsgut.org/spielplan/ext/';
const FIX = [
  { name: 'geschafft mit Ergebnis, Werkzeug und App',
    e: { wer: 'lokal:7f3a9c21', verb: 'geschafft', objekt: 'quest/kaldi-mythos', zeit: '2026-10-09T10:12:00Z', app: 'museum/kaffee', mit: ['werkzeug/roestkurve'], ergebnis: { dauer_s: 240, punkte: 8, max: 10 } },
    soll: { actor: { objectType: 'Agent', account: { homePage: BASIS, name: 'lokal:7f3a9c21' } }, verb: { id: 'http://adlnet.gov/expapi/verbs/completed', display: { de: 'geschafft' } },
      object: { objectType: 'Activity', id: BASIS + 'quest/kaldi-mythos', definition: { name: { de: 'Mythos oder Geschichte?' }, type: 'https://zukunftsgut.org/spielplan/arten/quest' } },
      result: { completion: true, score: { raw: 8, min: 0, max: 10, scaled: 0.8 }, duration: 'PT4M' },
      context: { contextActivities: { grouping: [{ objectType: 'Activity', id: BASIS }], parent: [{ objectType: 'Activity', id: BASIS + 'episode/tasse' }] }, extensions: { [EXT + 'mit']: [BASIS + 'werkzeug/roestkurve'], [EXT + 'app']: 'museum/kaffee' } },
      timestamp: '2026-10-09T10:12:00.000Z' } },
  { name: 'angewendet mit Beleg (Messung) und Fall',
    e: { wer: 'lokal:7f3a9c21', verb: 'angewendet', objekt: 'erlebnis/roestung', zeit: '2026-10-10T08:00:00Z', app: 'museum/kaffee', beleg: { art: 'messung', quelle: 'zwilling:akademie/kurs_teilnehmer', fall: 'akademie' } },
    soll: { actor: { objectType: 'Agent', account: { homePage: BASIS, name: 'lokal:7f3a9c21' } }, verb: { id: 'https://zukunftsgut.org/spielplan/verben/angewendet', display: { de: 'angewendet' } },
      object: { objectType: 'Activity', id: BASIS + 'erlebnis/roestung', definition: { name: { de: 'Die Röstung am Exponat' }, type: 'https://zukunftsgut.org/spielplan/arten/erlebnis' } },
      result: { extensions: { [EXT + 'beleg']: { art: 'messung', quelle: 'zwilling:akademie/kurs_teilnehmer', fall: 'akademie' } } },
      context: { contextActivities: { grouping: [{ objectType: 'Activity', id: BASIS }], parent: [{ objectType: 'Activity', id: BASIS + 'episode/tasse' }] }, extensions: { [EXT + 'app']: 'museum/kaffee' } },
      timestamp: '2026-10-10T08:00:00.000Z' } },
  { name: 'begonnen, kleinste Form',
    e: { wer: 'lokal:a', verb: 'begonnen', objekt: 'inhalt/kaldi', zeit: '2026-10-09T09:00:00Z' },
    soll: { actor: { objectType: 'Agent', account: { homePage: BASIS, name: 'lokal:a' } }, verb: { id: 'http://adlnet.gov/expapi/verbs/attempted', display: { de: 'begonnen' } },
      object: { objectType: 'Activity', id: BASIS + 'inhalt/kaldi', definition: { name: { de: 'Kaldi und die Ziegen' }, type: 'https://zukunftsgut.org/spielplan/arten/inhalt' } },
      context: { contextActivities: { grouping: [{ objectType: 'Activity', id: BASIS }], parent: [{ objectType: 'Activity', id: BASIS + 'episode/tasse' }] } }, timestamp: '2026-10-09T09:00:00.000Z' } },
  { name: 'bestanden, Erfolg und Dauer über eine Stunde',
    e: { wer: 'lokal:a', verb: 'bestanden', objekt: 'skill/quellen', zeit: '2026-10-09T09:00:00+02:00', ergebnis: { dauer_s: 3725, erfolg: true } },
    soll: { actor: { objectType: 'Agent', account: { homePage: BASIS, name: 'lokal:a' } }, verb: { id: 'http://adlnet.gov/expapi/verbs/passed', display: { de: 'bestanden' } },
      object: { objectType: 'Activity', id: BASIS + 'skill/quellen', definition: { name: { de: 'Quellen prüfen' }, type: 'https://zukunftsgut.org/spielplan/arten/skill' } },
      result: { completion: true, success: true, duration: 'PT1H2M5S' }, context: { contextActivities: { grouping: [{ objectType: 'Activity', id: BASIS }] } }, timestamp: '2026-10-09T07:00:00.000Z' } },
  { name: 'freigeschaltet (abgeleitet) mit Regel',
    e: { wer: 'lokal:a', verb: 'freigeschaltet', objekt: 'werkzeug/roestkurve', zeit: '2026-10-09T10:12:00Z', app: 'museum/kaffee', regel: 'roestkurve' },
    soll: { actor: { objectType: 'Agent', account: { homePage: BASIS, name: 'lokal:a' } }, verb: { id: 'https://zukunftsgut.org/spielplan/verben/freigeschaltet', display: { de: 'freigeschaltet' } },
      object: { objectType: 'Activity', id: BASIS + 'werkzeug/roestkurve', definition: { name: { de: 'Röstkurve' }, type: 'https://zukunftsgut.org/spielplan/arten/werkzeug' } },
      context: { contextActivities: { grouping: [{ objectType: 'Activity', id: BASIS }] }, extensions: { [EXT + 'app']: 'museum/kaffee', [EXT + 'regel']: 'roestkurve' } }, timestamp: '2026-10-09T10:12:00.000Z' } },
];
for (const fx of FIX) {
  test('xAPI-Fixture: ' + fx.name, () => {
    const st = SP.nachXapi(fx.e, KAFFEE), soll = Object.assign({ id: st.id }, fx.soll);
    gleich(st, soll);
    gleich(pruefeStatement(st), [], 'Statement ist gültig');
    wahr(UUID.test(st.id), 'id ist UUID-förmig');
    gleich(SP.nachXapi(klon(fx.e), KAFFEE).id, st.id, 'gleiches Ereignis, gleiche id');
  });
}
test('xAPI: Optionen (homePage, registration, activityId, actor, kontext) und Statement-id fest vergeben', () => {
  const e = { wer: 'lokal:a', verb: 'geschafft', objekt: 'quest/kaldi-mythos', zeit: T(10), app: 'museum/kaffee' };
  const reg = '9f2d1c5e-1b6a-4d7a-8f10-3c4e5a6b7c8d';
  const st = SP.nachXapi(e, KAFFEE, { homePage: 'https://lms.example.org', registration: reg, activityId: 'https://lms.example.org/kurs/kaffee', actor: { objectType: 'Agent', account: { homePage: 'https://lms.example.org', name: 'u-17' } },
    kontext: { extensions: { 'https://w3id.org/xapi/cmi5/context/extensions/sessionid': 'abc' }, contextActivities: { category: [{ objectType: 'Activity', id: 'https://w3id.org/xapi/cmi5/context/categories/cmi5' }] } }, id: '11111111-2222-4333-8444-555555555555' });
  gleich(st.id, '11111111-2222-4333-8444-555555555555'); gleich(st.context.registration, reg); gleich(st.actor.account.name, 'u-17');
  gleich(st.context.contextActivities.grouping[0].id, 'https://lms.example.org/kurs/kaffee'); gleich(st.context.contextActivities.category[0].id, 'https://w3id.org/xapi/cmi5/context/categories/cmi5');
  gleich(st.context.extensions['https://w3id.org/xapi/cmi5/context/extensions/sessionid'], 'abc'); gleich(pruefeStatement(st), []);
  const st2 = SP.nachXapi(e, KAFFEE, { homePage: 'https://lms.example.org' });
  gleich(st2.actor.account.homePage, 'https://lms.example.org');
});
test('xAPI: ohne basis gilt urn:spielplan:<id>:, unbekanntes Objekt wird ohne Definition übersetzt, Unbrauchbares wirft TypeError', () => {
  const p = { format: 'spielplan/0', id: 'x', einheiten: [] };
  const st = SP.nachXapi({ wer: 'a', verb: 'begonnen', objekt: 'quest/y', zeit: T(10) }, p);
  gleich(st.object.id, 'urn:spielplan:x:quest/y'); gleich(st.object.definition, undefined); gleich(pruefeStatement(st), []);
  for (const e of [null, { wer: 'a', verb: 'tanzen', objekt: 'quest/y', zeit: T(10) }, { wer: 'a', verb: 'begonnen', zeit: T(10) }, { wer: 'a', verb: 'begonnen', objekt: 'q', zeit: 'nie' }, { verb: 'begonnen', objekt: 'q', zeit: T(10) }]) assert.throws(() => SP.nachXapi(e, p), TypeError);
});
test('xAPI: Zufallsereignisse ergeben gültige Statements, verschiedene Ereignisse verschiedene ids', () => {
  const r = rng(99), ids = new Set();
  let n = 0;
  for (let i = 0; i < (KURZ ? 20 : 120); i++) {
    const { p } = zufallsfall(r), ev = genEreignisse(r, p, 12);
    for (const e of ev.concat([{ wer: 'lokal:z', verb: 'freigeschaltet', objekt: ev[0] ? ev[0].objekt : p.einheiten[0].id, zeit: T(10), regel: 'r0' }])) {
      e.ergebnis = r.chance(0.3) ? { dauer_s: r.int(5000), punkte: r.int(10), max: 10, erfolg: r.chance(0.5) } : undefined;
      const st = SP.nachXapi(JSON.parse(JSON.stringify(e)), p);
      gleich(pruefeStatement(st), [], JSON.stringify(e));
      n++; ids.add(p.id + JSON.stringify(e) + st.id);
    }
  }
  const nurIds = new Set([...ids].map(x => x.slice(-36)));
  wahr(nurIds.size >= ids.size * 0.97, `zu viele gleiche ids: ${nurIds.size} von ${ids.size}`);
  wahr(n > 100);
  const a = SP.nachXapi(E('geschafft', 'quest/kaldi-mythos', T(10)), KAFFEE), b = SP.nachXapi(E('geschafft', 'quest/kaldi-mythos', T(10), { ergebnis: { punkte: 1 } }), KAFFEE), c = SP.nachXapi(E('geschafft', 'quest/kaldi-mythos', T(10, 1)), KAFFEE);
  wahr(new Set([a.id, b.id, c.id]).size === 3, 'Ergebnis und Zeit gehen in die id ein');
});

/* ================================================================ 6. Brücke */

gruppe('6 Brücke');

function fakeLager(start = {}) {
  const d = Object.assign({}, start);
  return { d, getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; } };
}
function bruecke(extra = {}, kern) {
  const k = kern || ladeKern({ window: extra.window || {} });
  const uhr = { t: extra.start || T(10) };
  const sp = k.Spielplan.verbinde(Object.assign({ plan: KAFFEE, app: 'museum/kaffee', jetzt: () => uhr.t }, extra.opt || {}));
  return { sp, uhr, k, lager: (extra.opt || {}).lager };
}
test('Brücke: speichert unter gm:sp:<plan>:… in der Kurzform; Kennung lokal:<8 Hexzeichen> bleibt über Neuladen gleich', () => {
  const lager = fakeLager();
  const b = bruecke({ opt: { lager } });
  b.sp.melde('geschafft', 'quest/kaldi-mythos', { mit: ['werkzeug/roestkurve'], ergebnis: { dauer_s: 60 } });
  gleich(Object.keys(lager.d).sort(), ['gm:sp:museum-kaffee:ereignisse', 'gm:sp:museum-kaffee:wer']);
  const gespeichert = JSON.parse(lager.d['gm:sp:museum-kaffee:ereignisse']);
  gleich(gespeichert, [{ wer: b.sp.wer, verb: 'geschafft', objekt: 'quest/kaldi-mythos', zeit: T(10), app: 'museum/kaffee', mit: ['werkzeug/roestkurve'], ergebnis: { dauer_s: 60 } }]);
  wahr(/^lokal:[0-9a-f]{8}$/.test(b.sp.wer), b.sp.wer);
  const b2 = bruecke({ opt: { lager } });
  gleich(b2.sp.wer, b.sp.wer); gleich(b2.sp.ereignisse().length, 1); gleich(b2.sp.stand().einheiten['quest/kaldi-mythos'].stufe, 2);
  gleich(new Set(Array.from({ length: 6 }, () => bruecke({ opt: { lager: fakeLager() } }).sp.wer)).size >= 5, true, 'Kennungen sind zufällig');
  const praef = fakeLager(); bruecke({ opt: { lager: praef, praefix: 'x:' } }).sp.melde('begonnen', 'inhalt/kaldi'); wahr(Object.keys(praef.d).every(k => k.startsWith('x:museum-kaffee:')), 'eigenes Präfix');
});
test('Brücke: Standardlager ist window.localStorage mit Präfix gm:sp:', () => {
  const l = fakeLager(), b = bruecke({ window: { localStorage: l } });
  b.sp.melde('begonnen', 'inhalt/kaldi');
  wahr(l.d['gm:sp:museum-kaffee:ereignisse'], 'in window.localStorage geschrieben'); gleich(b.sp.speicher, 'lokal');
});
test('Brücke: ohne Speicher (Zugriff wirft, Quota voll, privater Modus) läuft die Seite im Arbeitsspeicher weiter', () => {
  const gesperrt = { get localStorage() { throw new Error('SecurityError'); } };
  let b = bruecke({ window: gesperrt });
  b.sp.melde('geschafft', 'quest/kaldi-mythos'); gleich(b.sp.stand().einheiten['werkzeug/roestkurve'].zugang, 'offen'); gleich(b.sp.speicher, 'arbeitsspeicher');
  const voll = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => { throw new Error('x'); } };
  b = bruecke({ opt: { lager: voll } });
  b.sp.melde('geschafft', 'quest/kaldi-mythos'); gleich(b.sp.stand().einheiten['quest/kaldi-mythos'].stufe, 2); b.sp.zuruecksetzen(); gleich(b.sp.ereignisse(), []);
  b = bruecke({ window: {} }); b.sp.melde('begonnen', 'inhalt/kaldi'); gleich(b.sp.ereignisse().length, 1);
  const lesenWirft = { getItem: () => { throw new Error('x'); }, setItem() {}, removeItem() {} };
  b = bruecke({ opt: { lager: lesenWirft } }); gleich(b.sp.ereignisse(), []);
});
test('Brücke: beschädigter oder fremder Speicherinhalt wird als leer behandelt, nichts wirft', () => {
  for (const roh of ['{kaputt', '42', '"text"', 'null', '[1,2,3]', '[{"verb":"geschafft"}]', '']) {
    const b = bruecke({ opt: { lager: fakeLager({ 'gm:sp:museum-kaffee:ereignisse': roh, 'gm:sp:museum-kaffee:gesehen': '{kaputt', 'gm:sp:museum-kaffee:wer': '<script>' }) } });
    gleich(b.sp.ereignisse(), [], roh); wahr(/^lokal:[0-9a-f]{8}$/.test(b.sp.wer), 'ungültige Kennung wird ersetzt');
    b.sp.melde('begonnen', 'inhalt/kaldi'); gleich(b.sp.ereignisse().length, 1);
  }
  const gemischt = fakeLager({ 'gm:sp:museum-kaffee:ereignisse': JSON.stringify([{ wer: 'a', verb: 'geschafft', objekt: 'quest/kaldi-mythos', zeit: T(10) }, 5, null, { verb: 'x' }]) });
  gleich(bruecke({ opt: { lager: gemischt } }).sp.ereignisse().length, 1);
});
test('Brücke: melde prüft Verb, Objekt, Zeit; freigeschaltet schreibt keine App; Fehler stehen in letzterFehler', () => {
  const b = bruecke(), sp = b.sp;
  gleich(sp.melde('tanzen', 'quest/kaldi-mythos'), null); wahr(/Verb „tanzen“ unbekannt/.test(sp.letzterFehler));
  gleich(sp.melde('freigeschaltet', 'quest/kaldi-mythos'), null); wahr(/nie eine App/.test(sp.letzterFehler));
  gleich(sp.melde('geschafft', 'quest/gibtsnicht'), null); wahr(/steht nicht im Spielplan/.test(sp.letzterFehler));
  gleich(sp.melde('geschafft', 'quest/kaldi-mythos', { zeit: 'später' }), null); wahr(/zeit/.test(sp.letzterFehler));
  gleich(sp.melde('geschafft'), null); gleich(sp.melde(), null);
  gleich(sp.ereignisse(), []);
  const e = sp.melde('geschafft', 'quest/kaldi-mythos', { zeit: '2026-10-01T08:00:00+02:00' });
  gleich(e.zeit, '2026-10-01T06:00:00Z'); gleich(sp.letzterFehler, '');
});
test('Brücke: Doppelte binnen einer Minute werden nicht noch einmal gespeichert', () => {
  const b = bruecke();
  b.sp.melde('erkundet', 'inhalt/kaldi'); b.uhr.t = T(10, 0).replace(':00Z', ':30Z'); b.sp.melde('erkundet', 'inhalt/kaldi'); gleich(b.sp.ereignisse().length, 1);
  b.uhr.t = T(10, 2); b.sp.melde('erkundet', 'inhalt/kaldi'); gleich(b.sp.ereignisse().length, 2);
  b.sp.melde('geschafft', 'inhalt/kaldi'); gleich(b.sp.ereignisse().length, 3, 'anderes Verb ist kein Doppeltes');
});
test('Brücke, Datenschutz: nur Kennungen und Zahlen werden gespeichert, keine Texte', () => {
  const b = bruecke(), sp = b.sp;
  const e = sp.melde('angewendet', 'erlebnis/roestung', { ergebnis: { punkte: 3, antwort: 'Mein Chef heißt Müller', dauer_s: -5, erfolg: 'ja' }, beleg: { art: 'messung', quelle: 'Frau Müller sagt es', fall: 'Firma Müller GmbH', text: 'geheim' }, text: 'nochmal geheim', name: 'Karl' });
  gleich(e.ergebnis, { punkte: 3 }); gleich(e.beleg, { art: 'messung' }); gleich(Object.keys(e).sort(), ['app', 'beleg', 'ergebnis', 'objekt', 'verb', 'wer', 'zeit']);
  wahr(/fall ist keine Kennung/.test(sp.letzterFehler) || /quelle/.test(sp.letzterFehler), sp.letzterFehler);
  const e2 = sp.melde('angewendet', 'erlebnis/roestung', { beleg: { art: 'bestaetigung', quelle: 'Zwilling:Akademie/Kurs_1', fall: ' Akademie-1 ' }, zeit: T(11) });
  gleich(e2.beleg, { art: 'bestaetigung', quelle: 'zwilling:akademie/kurs_1', fall: 'akademie-1' });
  const e3 = sp.melde('angewendet', 'erlebnis/roestung', { beleg: { art: 'zufall', fall: 'x' }, zeit: T(12) });
  gleich(e3.beleg, undefined, 'ungültige Belegart: kein Beleg'); const e4 = sp.melde('angewendet', 'erlebnis/roestung', { fall: 'x', zeit: T(13) }); gleich(e4.beleg, undefined, 'fall ohne Beleg wird nicht gespeichert');
  const e5 = sp.melde('angewendet', 'erlebnis/roestung', { beleg: { art: 'eigen' }, fall: 'kurzform', zeit: T(14) }); gleich(e5.beleg, { art: 'eigen', fall: 'kurzform' }, 'fall als Kurzform in den Optionen');
  const alles = JSON.stringify(sp.ereignisse()); wahr(!/Müller|geheim|Karl|Chef/.test(alles), alles);
  const e6 = sp.melde('geschafft', 'quest/kaldi-mythos', { mit: ['werkzeug/roestkurve', 'quest/kaldi-mythos', 'werkzeug/gibtsnicht', 5] }); gleich(e6.mit, ['werkzeug/roestkurve']);
});
test('Brücke: Transfer über die Brücke (zwei Fälle) ergibt Stufe 4 am Werkzeug', () => {
  const b = bruecke({ opt: { plan: plan([U('werkzeug/w'), U('quest/a'), U('quest/b')]) } });
  b.sp.melde('angewendet', 'quest/a', { mit: ['werkzeug/w'], beleg: { art: 'messung', fall: 'f1' } });
  gleich(b.sp.stand().einheiten['werkzeug/w'].stufe, 3);
  b.uhr.t = T(11); b.sp.melde('angewendet', 'quest/b', { mit: ['werkzeug/w'], beleg: { art: 'messung', fall: 'f2' } });
  gleich(b.sp.stand().einheiten['werkzeug/w'].stufe, 4);
});
test('Brücke: Hörer freigeschaltet (einmal, mit Enthüllung), stufe, melde; Abmelden; ein werfender Hörer stört nicht', () => {
  const b = bruecke(), got = { f: [], s: [], m: [] };
  const aus = b.sp.bei('freigeschaltet', f => got.f.push(f));
  b.sp.bei('freigeschaltet', () => { throw new Error('kaputter Hörer'); });
  b.sp.bei('stufe', s => got.s.push(s)); b.sp.bei('melde', e => got.m.push(e.verb + ' ' + e.objekt));
  b.sp.melde('geschafft', 'quest/kaldi-mythos');
  gleich(got.f.length, 1); gleich(got.f[0].einheit, 'werkzeug/roestkurve'); gleich(got.f[0].enthuellung, 'Du hast die Röstkurve – damit liest du jede Röstung wie ein Profi.'); gleich(got.f[0].am, T(10));
  gleich(got.s.map(x => `${x.einheit} ${x.von}->${x.nach}`).sort(), ['quest/kaldi-mythos 0->2', 'skill/quellen 0->2']);
  gleich(got.m, ['geschafft quest/kaldi-mythos']);
  b.sp.melde('erkundet', 'inhalt/kaldi'); gleich(got.f.length, 1, 'nicht noch einmal');
  aus(); b.uhr.t = T(12); b.sp.melde('geschafft', 'inhalt/kaldi'); b.sp.melde('begonnen', 'werkzeug/roestkurve'); gleich(got.f.length, 1, 'abgemeldet');
});
test('Brücke: Freischaltungen werden nach dem Neuladen nicht noch einmal gezeigt (Merkzettel), neue Hörer bekommen Verpasstes, aktualisiere() findet Zeit-Freischaltungen', () => {
  const lager = fakeLager(), p = plan([U('quest/a'), U('werkzeug/w')], [{ id: 'w', schaltet: ['werkzeug/w'], wenn: { wartezeit: { einheit: 'quest/a', stufe: 2, stunden: 3 } }, enthuellung: 'Pause vorbei.' }]);
  let b = bruecke({ opt: { lager, plan: p } }); const got = [];
  b.sp.bei('freigeschaltet', f => got.push(f.einheit + '@' + f.am));
  b.sp.melde('geschafft', 'quest/a'); gleich(got, []);
  b.uhr.t = T(12, 59); b.sp.aktualisiere(); gleich(got, []);
  b.uhr.t = T(13, 0); b.sp.aktualisiere(); gleich(got, ['werkzeug/w@' + T(13)]);
  b.sp.aktualisiere(); gleich(got.length, 1);
  b = bruecke({ opt: { lager, plan: p }, start: T(14) }); const got2 = []; b.sp.bei('freigeschaltet', f => got2.push(f)); b.sp.aktualisiere(); gleich(got2, [], 'schon gesehen');
  const lager2 = fakeLager(lager.d); delete lager2.d['gm:sp:test:gesehen'];
  b = bruecke({ opt: { lager: lager2, plan: p }, start: T(14) }); const got3 = []; b.sp.bei('freigeschaltet', f => got3.push(f)); b.sp.aktualisiere(); gleich(got3.length, 1, 'ohne Merkzettel: Verpasstes wird nachgeholt');
});
test('Brücke: einheit(id) gibt den Eintrag im Spielstand, null für Unbekanntes', () => {
  const b = bruecke(); gleich(b.sp.einheit('werkzeug/roestkurve').zugang, 'gesperrt'); gleich(b.sp.einheit('gibt/es-nicht'), null); gleich(b.sp.einheit(), null);
  b.sp.melde('geschafft', 'quest/kaldi-mythos'); gleich(b.sp.einheit('werkzeug/roestkurve').zugang, 'offen');
});
test('Brücke: stand() ist zwischengespeichert (gleiches Objekt bis zur nächsten Meldung), stand(zeit) rechnet frisch', () => {
  const b = bruecke(); const a = b.sp.stand(); wahr(a === b.sp.stand(), 'gleiches Objekt'); b.sp.melde('begonnen', 'inhalt/kaldi'); wahr(a !== b.sp.stand());
  gleich(b.sp.stand('2030-01-01T00:00:00Z').jetzt, '2030-01-01T00:00:00Z');
});
test('Brücke: zuruecksetzen löscht Ereignisse, Merkzettel und Kennung', () => {
  const lager = fakeLager(), b = bruecke({ opt: { lager } }); const alt = b.sp.wer;
  b.sp.bei('freigeschaltet', () => {}); b.sp.melde('geschafft', 'quest/kaldi-mythos');
  b.sp.zuruecksetzen(); gleich(b.sp.ereignisse(), []); wahr(b.sp.wer !== alt); gleich(lager.d['gm:sp:museum-kaffee:wer'], b.sp.wer);
  gleich(lager.d['gm:sp:museum-kaffee:ereignisse'], undefined); gleich(lager.d['gm:sp:museum-kaffee:gesehen'], undefined); gleich(b.sp.stand().freigeschaltet, []);
});
test('Brücke: importiere nimmt fremde Ereignisse ohne Doppelte auf und meldet Neues', () => {
  const b = bruecke(), f = [];
  b.sp.bei('freigeschaltet', x => f.push(x.einheit));
  const e = { wer: 'lms:1', verb: 'geschafft', objekt: 'quest/kaldi-mythos', zeit: T(9), app: 'kurs' };
  gleich(b.sp.importiere([e, e, { verb: 'x' }, null]), 1); gleich(b.sp.importiere([e]), 0); gleich(f, ['werkzeug/roestkurve']); gleich(b.sp.ereignisse().length, 1);
});
test('Brücke: Adapter hängen sich an (speicher: [lokal, adapter]); nur_lokal verweigert sie; nicht geladene Adapter werden genannt', () => {
  const log = [], ad = { name: 'probe', verbinde: sp => log.push('verbinde'), melde: e => log.push('melde ' + e.verb), stand: s => log.push('stand ' + s.takt), zuruecksetzen: () => log.push('reset'), trenne: () => log.push('trenne') };
  const b = bruecke({ opt: { speicher: ['lokal', ad], lager: fakeLager() } });
  b.sp.melde('begonnen', 'inhalt/kaldi'); b.sp.zuruecksetzen(); b.sp.trenne();
  gleich(log, ['verbinde', 'melde begonnen', 'stand 1', 'reset', 'trenne']);
  const nl = bruecke({ opt: { plan: Object.assign({}, KAFFEE, { nur_lokal: true }), speicher: ['lokal', ad, 'xapi'], lager: fakeLager() } });
  gleich(nl.sp.adapter.length, 0); gleich(nl.sp.verweigert.length, 2); wahr(/nur_lokal/.test(nl.sp.verweigert[0]) || /nur_lokal/.test(nl.sp.verweigert[1]));
  const keiner = bruecke({ opt: { speicher: ['lokal', 'xapi'], lager: fakeLager() } }); wahr(/nicht geladen/.test(keiner.sp.verweigert[0]), keiner.sp.verweigert.join());
  const nurAd = bruecke({ opt: { speicher: [ad] } }); nurAd.sp.melde('begonnen', 'inhalt/kaldi'); gleich(nurAd.sp.ereignisse().length, 1, 'ohne lokal: Arbeitsspeicher');
});
test('Brücke: postMessage aus einer Übung im iframe (sp:melde) wird angenommen, fremde Herkunft und Fremdes nicht', () => {
  const listener = {};
  const win = { location: { origin: 'https://museum.example' }, addEventListener: (t, f) => { listener[t] = f; }, removeEventListener: t => { delete listener[t]; } };
  const b = bruecke({ opt: { lager: fakeLager() } });
  const ab = b.sp.horche(win);
  listener.message({ origin: 'https://museum.example', data: { type: 'sp:melde', verb: 'geschafft', objekt: 'quest/kaldi-mythos', ergebnis: { punkte: 5 } } });
  gleich(b.sp.ereignisse().length, 1);
  listener.message({ origin: 'https://boese.example', data: { type: 'sp:melde', verb: 'geschafft', objekt: 'inhalt/kaldi' } });
  listener.message({ origin: 'https://museum.example', data: { type: 'anderes', verb: 'geschafft', objekt: 'inhalt/kaldi' } });
  listener.message({ origin: 'https://museum.example', data: 'text' }); listener.message({ origin: 'https://museum.example', data: { type: 'sp:melde', verb: 'freigeschaltet', objekt: 'quest/kaldi-mythos' } });
  gleich(b.sp.ereignisse().length, 1); ab(); gleich(listener.message, undefined);
  const l2 = {}; const w2 = { location: { origin: 'null' }, addEventListener: (t, f) => { l2[t] = f; }, removeEventListener() {} };
  b.sp.horche(w2); l2.message({ origin: 'null', data: { type: 'sp:melde', verb: 'erkundet', objekt: 'inhalt/kaldi' } }); gleich(b.sp.ereignisse().length, 2, 'unter file:// ist die Herkunft "null" gegen "null"');
  b.sp.horche(w2, { erlaubt: ev => ev.origin === 'x' }); l2.message({ origin: 'null', data: { type: 'sp:melde', verb: 'erkundet', objekt: 'quest/kaldi-mythos' } }); gleich(b.sp.ereignisse().length, 2, 'eigene Prüfung');
});
test('Brücke: ein zweiter Tab (storage-Ereignis) wird übernommen und gemeldet', () => {
  const ls = {}, lager = fakeLager(), win = { localStorage: lager, addEventListener: (t, f) => { ls[t] = f; }, removeEventListener() {} };
  const b = bruecke({ window: win }), got = [];
  b.sp.bei('freigeschaltet', f => got.push(f.einheit));
  lager.d['gm:sp:museum-kaffee:ereignisse'] = JSON.stringify([{ wer: 'lokal:tab2', verb: 'geschafft', objekt: 'quest/kaldi-mythos', zeit: T(9), app: 'museum/kaffee' }]);
  ls.storage({ key: 'gm:sp:museum-kaffee:ereignisse' });
  gleich(b.sp.ereignisse().length, 1); gleich(got, ['werkzeug/roestkurve']);
  ls.storage({ key: 'anderer-schluessel' }); gleich(got.length, 1);
});
test('Die Seite sendet nichts: kein fetch, XMLHttpRequest, sendBeacon, WebSocket, Image, wenn nur der Kern läuft', () => {
  const aufrufe = [], falle = n => function () { aufrufe.push(n); throw new Error('Netzwerk: ' + n); };
  const win = { fetch: falle('fetch'), XMLHttpRequest: falle('xhr'), WebSocket: falle('ws'), Image: falle('image'), EventSource: falle('es'), navigator: { sendBeacon: falle('beacon') }, localStorage: fakeLager(), addEventListener() {}, removeEventListener() {} };
  const b = bruecke({ window: win });
  b.sp.bei('freigeschaltet', () => {}); b.sp.melde('geschafft', 'quest/kaldi-mythos', { ergebnis: { dauer_s: 5 } }); b.sp.aktualisiere(); b.sp.stand(); b.sp.zuruecksetzen();
  SP.nachXapi(E('geschafft', 'quest/kaldi-mythos', T(10)), KAFFEE);
  gleich(aufrufe, []);
  const quelle = fs.readFileSync(path.join(ROOT, 'engine', 'js', 'spielplan.js'), 'utf8');
  wahr(!/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|new Image/.test(quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'spielplan.js enthält keinen Netzwerkzugriff');
  const build = fs.readFileSync(path.join(ROOT, 'tools', 'build.mjs'), 'utf8');
  wahr(!/spielplan-adapter/.test(build), 'der Build bindet den Adapter nicht ein');
});
test('Brücke: jetzt als Funktion, Text oder Zahl; ohne plan wirft verbinde einen klaren Fehler', () => {
  const k = ladeKern();
  gleich(k.Spielplan.verbinde({ plan: KAFFEE, jetzt: '2026-10-09T10:00:00Z', lager: fakeLager() }).melde('begonnen', 'inhalt/kaldi').zeit, T(10));
  gleich(k.Spielplan.verbinde({ plan: KAFFEE, jetzt: Date.parse(T(11)), lager: fakeLager() }).melde('begonnen', 'inhalt/kaldi').zeit, T(11));
  assert.throws(() => k.Spielplan.verbinde({}), /plan/); assert.throws(() => k.Spielplan.verbinde(), /Optionen/);
  const sp = k.Spielplan.verbinde({ plan: KAFFEE, lager: fakeLager() }); wahr(Math.abs(Date.parse(sp.melde('begonnen', 'inhalt/kaldi').zeit) - Date.now()) < 5000, 'ohne jetzt gilt die Uhr');
});

/* ================================================================ 7. Adapter */

gruppe('7 Adapter');

/** Ein Learning Record Store als kleiner Node-Server: Token-Abruf (cmi5 fetch), POST statements, GET LMS.LaunchData; mit Ausfall-Modi. */
async function mockLrs() {
  const lrs = { statements: new Map(), anfragen: [], modus: 'ok', token: 'dGVzdDpwdw==', tokenVergeben: false, ablehnen: /^$/, launch: { contextTemplate: { extensions: { 'https://w3id.org/xapi/cmi5/context/extensions/sessionid': 'sitzung-42' } }, launchMode: 'Normal' } };
  const server = http.createServer((req, res) => {
    const teile = [];
    req.on('data', c => teile.push(c));
    req.on('end', () => {
      const body = Buffer.concat(teile).toString('utf8'), url = new URL(req.url, 'http://x');
      lrs.anfragen.push({ methode: req.method, pfad: url.pathname, kopf: req.headers, body });
      const sende = (code, obj, extra = {}) => { res.writeHead(code, Object.assign({ 'Content-Type': 'application/json', 'X-Experience-API-Version': '1.0.3' }, extra)); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
      if (url.pathname === '/token' && req.method === 'POST') {
        if (lrs.tokenVergeben) return sende(400, { 'error-code': '1', 'error-text': 'Der Abruf-Link wurde schon benutzt' });
        lrs.tokenVergeben = true; return sende(200, { 'auth-token': lrs.token });
      }
      if (lrs.modus === 'tot') return req.socket.destroy();
      if (lrs.modus === 'down') return sende(503, { fehler: 'wartung' });
      if (lrs.modus === 'langsam429') return sende(429, {});
      if (!url.pathname.startsWith('/xapi/')) return sende(404, {});
      if (req.headers['x-experience-api-version'] === undefined || !/^1\.0\./.test(req.headers['x-experience-api-version'])) return sende(400, 'Version fehlt');
      if (req.headers.authorization !== 'Basic ' + lrs.token || lrs.modus === 'auth') return sende(401, { fehler: 'Anmeldung' });
      if (url.pathname === '/xapi/activities/state' && req.method === 'GET') return url.searchParams.get('stateId') === 'LMS.LaunchData' ? sende(200, lrs.launch) : sende(404, {});
      if (url.pathname === '/xapi/statements' && req.method === 'POST') {
        let j; try { j = JSON.parse(body); } catch (e) { return sende(400, 'kein JSON'); }
        const liste = Array.isArray(j) ? j : [j], fehler = [];
        liste.forEach((st, i) => { pruefeStatement(st).forEach(m => fehler.push(`[${i}] ${m}`)); if (lrs.ablehnen.test(JSON.stringify(st))) fehler.push(`[${i}] vom Mock abgelehnt`); if (!st.id) fehler.push(`[${i}] id fehlt`); });
        if (fehler.length) return sende(400, fehler.join('; '));
        const ids = [];
        for (const st of liste) {
          const alt = lrs.statements.get(st.id);
          if (alt && JSON.stringify(alt) !== JSON.stringify(st)) return sende(409, 'Statement-id vergeben, anderer Inhalt');
          if (!alt) lrs.statements.set(st.id, st);
          ids.push(st.id);
        }
        return sende(200, ids);
      }
      return sende(404, {});
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  lrs.port = server.address().port; lrs.url = `http://127.0.0.1:${lrs.port}`; lrs.endpoint = lrs.url + '/xapi/';
  lrs.liste = () => [...lrs.statements.values()];
  lrs.verben = () => lrs.liste().map(s => s.verb.id.split('/').pop());
  lrs.schliesse = () => new Promise(r => { server.closeAllConnections && server.closeAllConnections(); server.close(() => r()); });
  return lrs;
}
const kernMitAdapter = (fenster = {}) => ladeKern({ adapter: true, window: fenster });
const mitLrs = async fn => { const lrs = await mockLrs(); try { await fn(lrs); } finally { await lrs.schliesse(); } };
const warte = ms => new Promise(r => setTimeout(r, ms));
/** Plan mit Wurzel, damit „completed“ prüfbar ist. */
const KURS = plan([U('gebiet/kurs'), U('episode/e', { in: 'gebiet/kurs' }), U('inhalt/a', { in: 'episode/e' }), U('inhalt/b', { in: 'episode/e' }), U('werkzeug/w')], [{ id: 'w', schaltet: ['werkzeug/w'], wenn: { einheit: 'inhalt/a' }, enthuellung: 'Werkzeug da.' }], { id: 'kurs', basis: 'https://example.org/kurs/' });
const ACTOR = { objectType: 'Agent', account: { homePage: 'https://lms.example.org', name: 'teilnehmer-17' } };
const REG = '9f2d1c5e-1b6a-4d7a-8f10-3c4e5a6b7c8d', ACT = 'https://lms.example.org/au/kurs-1';

test('Adapter: cmi5-Startparameter aus dem Suchtext (Escapes, JSON-Actor), Objekte unverändert', () => {
  const { Spielplan: S } = kernMitAdapter();
  const q = '?endpoint=' + encodeURIComponent('https://lrs.example.org/xapi/') + '&fetch=' + encodeURIComponent('https://lms.example.org/fetch?x=1') + '&actor=' + encodeURIComponent(JSON.stringify(ACTOR)) + '&registration=' + REG + '&activityId=' + encodeURIComponent(ACT);
  gleich(S.adapter.cmi5Start(q), { endpoint: 'https://lrs.example.org/xapi/', fetch: 'https://lms.example.org/fetch?x=1', actor: ACTOR, registration: REG, activityId: ACT });
  gleich(S.adapter.cmi5Start('actor=%7Bkaputt&x=1&y'), { x: '1', y: '' }); gleich(S.adapter.cmi5Start({ a: 1 }), { a: 1 }); gleich(S.adapter.cmi5Start(''), {});
});
test('Node ohne Browser: In einem CommonJS-Kontext liefert require() die API (module.exports), auch der Adapter hängt sich an', async () => {
  const { createRequire } = await import('module');
  const d = path.join(TMP, 'cjs'); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), '{"type":"commonjs"}');
  for (const f of ['spielplan.js', 'spielplan-adapter.js']) fs.copyFileSync(path.join(ROOT, 'engine', 'js', f), path.join(d, f));
  const req = createRequire(path.join(d, 'x.js')), API = req('./spielplan.js');
  gleich(typeof API.spielstand, 'function'); gleich(API.format, 'spielplan/0'); gleich(typeof API.verbinde, 'function'); gleich(typeof globalThis.Spielplan, 'undefined', 'keine globale Verschmutzung');
  gleich(JSON.stringify(API.spielstand(KAFFEE, [KA('geschafft', 'quest/kaldi-mythos', T(10))], T(11))), JSON.stringify(SP.spielstand(KAFFEE, [KA('geschafft', 'quest/kaldi-mythos', T(10))], T(11))), 'gleiches Ergebnis wie im Browser-Laden');
  const ad = req('./spielplan-adapter.js'); gleich(typeof ad.xapi, 'function'); gleich(API.adapter, ad); gleich(typeof API.adapter.scorm, 'function');
  const sp = API.verbinde({ plan: KAFFEE, lager: fakeLager(), jetzt: () => T(10) }); sp.melde('geschafft', 'quest/kaldi-mythos'); gleich(sp.stand().einheiten['werkzeug/roestkurve'].zugang, 'offen');
});
test('Adapter: Der Build lädt den Adapter nicht, der Adapter hängt sich nur an window.Spielplan.adapter', () => {
  const k1 = ladeKern(), k2 = kernMitAdapter();
  gleich(Object.keys(k1.Spielplan.adapter), []); gleich(Object.keys(k2.Spielplan.adapter).sort(), ['cmi5Start', 'entpacke', 'ereignisseAusStufen', 'findeApi', 'kompakt', 'scorm', 'xapi']);
  assert.throws(() => { const w = { }; const vorher = globalThis.window; globalThis.window = w; try { new Function(fs.readFileSync(path.join(ROOT, 'engine', 'js', 'spielplan-adapter.js'), 'utf8'))(); } finally { if (vorher === undefined) delete globalThis.window; else globalThis.window = vorher; } }, /spielplan\.js muss zuerst geladen sein/);
});
test('xAPI-Adapter (cmi5): Start mit fetch-Token, LaunchData, initialized; Ereignisse kommen mit Actor, Registration und contextTemplate an; Freischaltung und completed folgen', () => mitLrs(async lrs => {
  const k = kernMitAdapter(), lager = fakeLager();
  const start = { endpoint: lrs.endpoint, fetch: lrs.url + '/token', actor: ACTOR, registration: REG, activityId: ACT };
  const sp = k.Spielplan.verbinde({ plan: KURS, app: 'kurs/x', lager, speicher: ['lokal', { adapter: 'xapi', start, lager: fakeLager() }] });
  const ad = sp.adapter[0];
  await ad.bereit;
  gleich(lrs.verben(), ['initialized']);
  const init = lrs.liste()[0];
  gleich(init.actor, ACTOR); gleich(init.context.registration, REG); gleich(init.object.id, ACT); gleich(init.context.extensions['https://w3id.org/xapi/cmi5/context/extensions/sessionid'], 'sitzung-42');
  gleich(init.context.contextActivities.category[0].id, 'https://w3id.org/xapi/cmi5/context/categories/cmi5');
  wahr(lrs.anfragen.some(a => a.pfad === '/xapi/activities/state'), 'LMS.LaunchData gelesen');
  sp.melde('geschafft', 'inhalt/a'); sp.melde('begonnen', 'inhalt/b', { zeit: T(10, 2) }); await ad.letzte;
  const kern = lrs.liste().filter(s => s.object.id !== ACT);
  gleich(kern.map(s => s.verb.id.split('/').pop()).sort(), ['attempted', 'completed', 'freigeschaltet'], 'die beiden Ereignisse und die abgeleitete Freischaltung');
  kern.forEach(s => { gleich(s.actor, ACTOR); gleich(s.context.registration, REG); gleich(s.context.extensions['https://w3id.org/xapi/cmi5/context/extensions/sessionid'], 'sitzung-42'); });
  const frei = kern.find(s => s.verb.id.endsWith('freigeschaltet'));
  gleich(frei.object.id, 'https://example.org/kurs/werkzeug/w'); gleich(frei.context.extensions['https://zukunftsgut.org/spielplan/ext/regel'], 'w');
  wahr(!lrs.liste().some(s => s.verb.id.endsWith('completed') && s.object.id === ACT), 'noch nicht abgeschlossen');
  gleich(SP.wurzelStufe(KURS, sp.stand()), 1, 'Wurzel steht bei Stufe 1'); sp.melde('geschafft', 'inhalt/b', { zeit: T(10, 3) }); await ad.letzte;
  const fertig = lrs.liste().filter(s => s.verb.id.endsWith('/completed') && s.object.id === ACT);
  gleich(fertig.length, 1, 'completed der Lerneinheit, sobald die Wurzel Stufe 2 erreicht'); gleich(fertig[0].result, { completion: true });
  sp.aktualisiere(); sp.melde('erkundet', 'inhalt/a', { zeit: T(23) }); await ad.letzte;
  gleich(lrs.liste().filter(s => s.verb.id.endsWith('/completed') && s.object.id === ACT).length, 1, 'completed nur einmal');
  await ad.beenden(); gleich(lrs.verben().filter(v => v === 'terminated').length, 1);
  wahr(lrs.anfragen.filter(a => a.pfad === '/token').length === 1, 'das fetch wird genau einmal benutzt');
  const post = lrs.anfragen.find(a => a.pfad === '/xapi/statements');
  gleich(post.kopf['x-experience-api-version'], '1.0.3'); gleich(post.kopf.authorization, 'Basic ' + lrs.token); wahr(/application\/json/.test(post.kopf['content-type']));
  gleich(ad.fehler, []); gleich(ad.warteschlange(), []);
}));
test('xAPI-Adapter: ohne cmi5, mit endpoint und auth; lokales Konto als Actor; nur Spielplan-Statements (kein initialized)', () => mitLrs(async lrs => {
  const k = kernMitAdapter();
  const sp = k.Spielplan.verbinde({ plan: KAFFEE, app: 'museum/kaffee', jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.url + '/xapi', auth: 'Basic ' + lrs.token, lager: fakeLager() }] });
  const ad = sp.adapter[0]; await ad.bereit;
  sp.melde('geschafft', 'quest/kaldi-mythos', { mit: ['werkzeug/roestkurve'] }); await ad.letzte;
  gleich(lrs.verben().sort(), ['completed', 'freigeschaltet', 'freigeschaltet'], 'die Quest und beide Freischaltungen (Röstkurve, und die Röstung, weil das Werkzeug über mit Stufe 2 hat)');
  const c = lrs.liste().find(s => s.verb.id.endsWith('/completed'));
  gleich(c.actor.account.name, sp.wer); gleich(c.actor.account.homePage, BASIS); gleich(c.context.registration, undefined);
}));
test('xAPI-Adapter: Ausfall des LRS (503, Verbindung weg, 429, 401): alles bleibt in der Warteschlange und wird in Reihenfolge nachgereicht', () => mitLrs(async lrs => {
  const k = kernMitAdapter(), lager = fakeLager();
  const sp = k.Spielplan.verbinde({ plan: KAFFEE, app: 'museum/kaffee', jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager }] });
  const ad = sp.adapter[0]; await ad.bereit;
  for (const modus of ['down', 'tot', 'langsam429', 'auth']) {
    lrs.modus = modus;
    const n = ad.warteschlange().length;
    sp.melde('erkundet', 'inhalt/kaldi', { zeit: T(10, 10 + ['down', 'tot', 'langsam429', 'auth'].indexOf(modus)) }); await ad.letzte;
    gleich(ad.warteschlange().length, n + 1, modus); gleich(lrs.statements.size, 0, modus + ': nichts angekommen');
  }
  gleich(ad.warteschlange().length, 4); wahr(ad.fehler.length >= 3, 'Fehler werden gemerkt: ' + ad.fehler.join(' | '));
  const gespeichert = JSON.parse(lager.d['gm:sp:museum-kaffee:xapi:warteschlange']); gleich(gespeichert.length, 4, 'die Warteschlange liegt im Speicher');
  lrs.modus = 'ok';
  const z = await ad.nachreichen();
  gleich(z, { gesendet: 4, offen: 0, verworfen: 0 }); gleich(lrs.statements.size, 4); gleich(ad.warteschlange(), []);
  gleich(lrs.liste().map(s => s.timestamp), [T(10, 10), T(10, 11), T(10, 12), T(10, 13)].map(t => t.replace(':00Z', ':00.000Z')), 'in der Reihenfolge der Ereignisse');
  gleich(JSON.parse(lager.d['gm:sp:museum-kaffee:xapi:warteschlange']), []);
}));
test('xAPI-Adapter: ein einzelnes Statement bei 401/403 bleibt in der Warteschlange (kein Aussondern bei Anmeldeproblemen)', () => mitLrs(async lrs => {
  const k = kernMitAdapter(), p = plan([U('quest/q')], [], { id: 'ein', basis: 'https://example.org/e/' });
  lrs.modus = 'auth';
  const sp = k.Spielplan.verbinde({ plan: p, jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager: fakeLager() }] });
  await sp.adapter[0].bereit; sp.melde('geschafft', 'quest/q'); await sp.adapter[0].letzte;
  gleich(sp.adapter[0].warteschlange().length, 1); gleich(sp.adapter[0].verworfen.length, 0);
  lrs.modus = 'ok'; gleich(await sp.adapter[0].nachreichen(), { gesendet: 1, offen: 0, verworfen: 0 });
}));
test('xAPI-Adapter: Nachreichen ist idempotent (gleiche id: nichts doppelt; 409 gilt als angekommen); neue Instanz mit gleichem Speicher setzt fort', () => mitLrs(async lrs => {
  const k = kernMitAdapter(), lager = fakeLager(), lager2 = fakeLager();
  lrs.modus = 'down';
  let sp = k.Spielplan.verbinde({ plan: KAFFEE, app: 'museum/kaffee', jetzt: () => T(10), lager: lager2, speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager }] });
  await sp.adapter[0].bereit; sp.melde('geschafft', 'quest/kaldi-mythos'); await sp.adapter[0].letzte;
  gleich(sp.adapter[0].warteschlange().length, 2);
  lrs.modus = 'ok';
  const k2 = kernMitAdapter();
  const sp2 = k2.Spielplan.verbinde({ plan: KAFFEE, app: 'museum/kaffee', jetzt: () => T(10), lager: lager2, speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager }] });
  await sp2.adapter[0].bereit;
  gleich(lrs.statements.size, 2, 'die Warteschlange der ersten Instanz wurde gesendet');
  sp2.adapter[0].verbinde(sp2); await sp2.adapter[0].bereit; sp2.aktualisiere(); await sp2.adapter[0].nachreichen();
  gleich(lrs.statements.size, 2, 'Erneutes Senden legt nichts doppelt an');
  const st = lrs.liste()[0]; lrs.anfragen.length = 0;
  const kopie = JSON.parse(JSON.stringify(st));
  const sp3 = k2.Spielplan.verbinde({ plan: KAFFEE, app: 'museum/kaffee', jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager: fakeLager() }] });
  await sp3.adapter[0].bereit;
  // dasselbe Statement noch einmal in die Warteschlange: der LRS antwortet 200 (identisch), die Warteschlange wird leer
  sp3.adapter[0].melde(JSON.parse(JSON.stringify(sp.ereignisse()[0]))); await sp3.adapter[0].letzte;
  gleich(sp3.adapter[0].warteschlange(), []); gleich(lrs.statements.size, 2); gleich(lrs.liste()[0], kopie);
  lrs.statements.set(st.id, Object.assign({}, st, { timestamp: '2020-01-01T00:00:00.000Z' }));      // anderer Inhalt unter derselben id: 409
  sp3.adapter[0].melde(JSON.parse(JSON.stringify(sp.ereignisse()[0]))); await sp3.adapter[0].letzte; gleich(sp3.adapter[0].warteschlange(), [], '409 gilt als angekommen');
}));
test('xAPI-Adapter: ein ungültiges Statement im Stapel wird ausgesondert, die anderen kommen an', () => mitLrs(async lrs => {
  const k = kernMitAdapter(), p = plan([U('quest/ok1'), U('quest/schlecht'), U('quest/ok2')], [], { id: 'sk', basis: 'https://example.org/sk/' });
  lrs.modus = 'down'; lrs.ablehnen = /quest\/schlecht/;
  const sp = k.Spielplan.verbinde({ plan: p, jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager: fakeLager() }] });
  await sp.adapter[0].bereit;
  sp.melde('geschafft', 'quest/ok1'); sp.melde('geschafft', 'quest/schlecht', { zeit: T(10, 1) }); sp.melde('geschafft', 'quest/ok2', { zeit: T(10, 2) }); await sp.adapter[0].letzte;
  gleich(sp.adapter[0].warteschlange().length, 3);
  lrs.modus = 'ok';
  const z = await sp.adapter[0].nachreichen();
  gleich(z, { gesendet: 2, offen: 0, verworfen: 1 }); gleich(lrs.liste().map(s => s.object.id.split('/').pop()).sort(), ['ok1', 'ok2']);
  gleich(sp.adapter[0].verworfen.length, 1); wahr(/vom Mock abgelehnt/.test(sp.adapter[0].verworfen[0].grund));
  sp.melde('begonnen', 'quest/schlecht', { zeit: T(11) }); await sp.adapter[0].letzte;
  gleich(sp.adapter[0].warteschlange(), [], 'auch ein einzelnes ungültiges Statement wird ausgesondert, statt ewig zu hängen'); gleich(sp.adapter[0].verworfen.length, 2);
}));
test('xAPI-Adapter: Stapel von höchstens 50, auch bei 120 wartenden Ereignissen', () => mitLrs(async lrs => {
  const k = kernMitAdapter(), p = plan(Array.from({ length: 120 }, (_, i) => U('quest/q' + i)), [], { id: 'viel', basis: 'https://example.org/v/' });
  lrs.modus = 'down';
  const sp = k.Spielplan.verbinde({ plan: p, jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager: fakeLager() }] });
  await sp.adapter[0].bereit;
  for (let i = 0; i < 120; i++) sp.melde('begonnen', 'quest/q' + i, { zeit: ISO(Date.parse(T(10)) + i * 60000) });
  await sp.adapter[0].letzte; lrs.modus = 'ok'; lrs.anfragen.length = 0;
  gleich(await sp.adapter[0].nachreichen(), { gesendet: 120, offen: 0, verworfen: 0 });
  const posts = lrs.anfragen.filter(a => a.pfad === '/xapi/statements').map(a => JSON.parse(a.body).length);
  gleich(posts, [50, 50, 20]); gleich(lrs.statements.size, 120);
}));
test('xAPI-Adapter: ohne fetch-Funktion oder ohne Endpunkt bleibt es bei der Warteschlange, nichts wirft; kaputter Speicher stört nicht', () => mitLrs(async lrs => {
  const k = kernMitAdapter(), kaputt = { getItem() { throw new Error('x'); }, setItem() { throw new Error('y'); }, removeItem() {} };
  let sp = k.Spielplan.verbinde({ plan: KAFFEE, jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager: kaputt, fetch: null }] });
  const ad = sp.adapter[0]; await ad.bereit; sp.melde('geschafft', 'quest/kaldi-mythos'); await ad.letzte;
  wahr(ad.warteschlange().length >= 2 || lrs.statements.size >= 2, 'entweder gesendet (globales fetch) oder wartend');
  const k2 = ladeKern({ adapter: true, window: { fetch: undefined } });
  sp = k2.Spielplan.verbinde({ plan: KAFFEE, jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: lrs.endpoint, auth: lrs.token, lager: fakeLager(), fetch: () => { throw new Error('Netz weg'); } }] });
  await sp.adapter[0].bereit; sp.melde('geschafft', 'quest/kaldi-mythos'); await sp.adapter[0].letzte;
  gleich(sp.adapter[0].warteschlange().length, 2); wahr(sp.adapter[0].fehler.some(f => /Netz weg/.test(f)), sp.adapter[0].fehler.join());
  sp = k2.Spielplan.verbinde({ plan: KAFFEE, jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', lager: fakeLager() }] });
  await sp.adapter[0].bereit; sp.melde('geschafft', 'quest/kaldi-mythos'); gleich(await sp.adapter[0].nachreichen(), { gesendet: 0, offen: 2, verworfen: 0 }, 'ohne Endpunkt bleibt alles in der Warteschlange');
}));
test('xAPI-Adapter: das cmi5-fetch ist nur einmal benutzbar; ein zweiter Start meldet das, behält aber die Warteschlange', () => mitLrs(async lrs => {
  const k = kernMitAdapter(), start = { endpoint: lrs.endpoint, fetch: lrs.url + '/token', actor: ACTOR, registration: REG, activityId: ACT };
  const a = k.Spielplan.verbinde({ plan: KURS, jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', start, lager: fakeLager() }] }); await a.adapter[0].bereit;
  const b = k.Spielplan.verbinde({ plan: KURS, jetzt: () => T(10), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', start, lager: fakeLager() }] }); await b.adapter[0].bereit;
  wahr(b.adapter[0].fehler.some(f => /fetch: kein Zugangstoken \(Status 400/.test(f)), b.adapter[0].fehler.join());
  b.melde('geschafft', 'inhalt/a'); await b.adapter[0].letzte; wahr(b.adapter[0].warteschlange().length >= 2, 'bleibt wartend');
}));
test('xAPI-Adapter: nur_lokal und fehlender Adapter-Code (der Seite) verweigern; Adapter-Datei ist nicht im Build', () => {
  const k = kernMitAdapter();
  const sp = k.Spielplan.verbinde({ plan: Object.assign({}, KAFFEE, { nur_lokal: true }), lager: fakeLager(), speicher: ['lokal', { adapter: 'xapi', endpoint: 'http://127.0.0.1:1/' }] });
  gleich(sp.adapter.length, 0); wahr(/nur_lokal/.test(sp.verweigert[0]));
});

/* ---- SCORM */

function mockScorm12(o = {}) {
  const d = Object.assign({ 'cmi.core.lesson_status': 'not attempted', 'cmi.suspend_data': '' }, o.start || {}), api = { d, log: [], commits: 0, fehler: '0', init: false, beendet: false };
  const grenze = o.grenze || 4096;
  api.LMSInitialize = () => { if (o.initFehler) { api.fehler = '101'; return 'false'; } api.init = true; return 'true'; };
  api.LMSGetValue = k => (k in d ? d[k] : '');
  api.LMSSetValue = (k, v) => {
    if (o.setzeFehler) { api.fehler = '405'; return 'false'; }
    if (k === 'cmi.suspend_data' && String(v).length > grenze) { api.fehler = '405'; return 'false'; }
    if (k === 'cmi.core.lesson_status' && !['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'].includes(v)) { api.fehler = '405'; return 'false'; }
    d[k] = String(v); api.log.push([k, String(v)]); return 'true';
  };
  api.LMSCommit = () => { api.commits++; return 'true'; };
  api.LMSFinish = () => { api.beendet = true; return 'true'; };
  api.LMSGetLastError = () => api.fehler;
  return api;
}
function mockScorm2004(o = {}) {
  const d = Object.assign({ 'cmi.completion_status': 'unknown', 'cmi.suspend_data': '' }, o.start || {}), api = { d, log: [], commits: 0, fehler: '0', beendet: false };
  const grenze = o.grenze || 64000;
  api.Initialize = () => 'true'; api.GetValue = k => (k in d ? d[k] : ''); api.Commit = () => { api.commits++; return 'true'; }; api.Terminate = () => { api.beendet = true; return 'true'; }; api.GetLastError = () => api.fehler;
  api.SetValue = (k, v) => {
    if (k === 'cmi.suspend_data' && String(v).length > grenze) { api.fehler = '405'; return 'false'; }
    if (k === 'cmi.completion_status' && !['completed', 'incomplete', 'not attempted', 'unknown'].includes(v)) { api.fehler = '406'; return 'false'; }
    if (k === 'cmi.progress_measure' && !(+v >= 0 && +v <= 1)) { api.fehler = '406'; return 'false'; }
    d[k] = String(v); api.log.push([k, String(v)]); return 'true';
  };
  return api;
}
/** Fenster-Kette wie im Lernsystem: iframe in Rahmen in oberstem Fenster, die API sitzt oben. */
function fensterKette(apiName, api, tiefe = 3) {
  const oben = { [apiName]: api }; oben.parent = oben;
  let w = oben; for (let i = 0; i < tiefe; i++) w = { parent: w };
  return w;
}
const scormPlan = KURS;
const scormSitzung = (k, api, name, extra = {}, plan = scormPlan, jetzt = () => T(10)) => k.Spielplan.verbinde({ plan, app: 'kurs/x', jetzt, lager: fakeLager(), speicher: ['lokal', { adapter: 'scorm', fenster: fensterKette(name, api), ...extra }] });

test('SCORM: findet die API im Fensterbaum (parent, opener), bevorzugt 2004, meldet das Fehlen ohne zu werfen', () => {
  const { Spielplan: S } = kernMitAdapter(), a12 = mockScorm12(), a04 = mockScorm2004();
  gleich(S.adapter.findeApi(fensterKette('API', a12, 5), 'API'), a12); gleich(S.adapter.findeApi({ parent: null }, 'API'), null);
  const mitOpener = { parent: null, opener: { parent: { API_1484_11: a04 } } }; mitOpener.parent = mitOpener; gleich(S.adapter.findeApi(mitOpener, 'API_1484_11'), a04);
  const beide = fensterKette('API_1484_11', a04); beide.parent.API = a12; let w = beide; while (w.parent !== w) w = w.parent; w.API = a12;
  const k = kernMitAdapter(), sp = k.Spielplan.verbinde({ plan: scormPlan, lager: fakeLager(), speicher: ['lokal', { adapter: 'scorm', fenster: beide }] }); gleich(sp.adapter[0].version, '2004');
  const sp2 = k.Spielplan.verbinde({ plan: scormPlan, lager: fakeLager(), speicher: ['lokal', { adapter: 'scorm', fenster: beide, version: '1.2' }] }); gleich(sp2.adapter[0].version, '1.2');
  const keine = k.Spielplan.verbinde({ plan: scormPlan, lager: fakeLager(), speicher: ['lokal', { adapter: 'scorm', fenster: { parent: null } }] });
  keine.melde('geschafft', 'inhalt/a'); wahr(/keine SCORM-API/.test(keine.adapter[0].fehler[0]), keine.adapter[0].fehler.join());
  const hang = { get parent() { throw new Error('fremder Ursprung'); } }; gleich(S.adapter.findeApi(hang, 'API'), null);
});
test('SCORM 1.2: incomplete beim Start, completed bei Stufe 2 der Wurzel, kompakte suspend_data (≤ 4096), Commit, Finish', () => {
  const k = kernMitAdapter(), api = mockScorm12(), sp = scormSitzung(k, api, 'API'), ad = sp.adapter[0];
  gleich(ad.version, '1.2'); gleich(api.d['cmi.core.lesson_status'], 'incomplete');
  sp.melde('geschafft', 'inhalt/a');
  gleich(api.d['cmi.core.lesson_status'], 'incomplete', 'Wurzel noch nicht bei Stufe 2'); wahr(api.d['cmi.suspend_data'].startsWith('SP0|E|'), api.d['cmi.suspend_data']);
  sp.melde('begonnen', 'inhalt/b', { zeit: T(10, 2) }); gleich(api.d['cmi.core.lesson_status'], 'incomplete', 'Stufe 1 der Wurzel genügt nicht');
  sp.melde('geschafft', 'inhalt/b', { zeit: T(10, 5) });
  gleich(api.d['cmi.core.lesson_status'], 'completed'); wahr(api.d['cmi.suspend_data'].length <= 4096 && api.commits >= 3, `commits ${api.commits}`);
  sp.melde('erkundet', 'inhalt/a', { zeit: T(11) }); gleich(api.d['cmi.core.lesson_status'], 'completed', 'bleibt completed');
  gleich(ad.beenden(), true); gleich(api.beendet, true); gleich(ad.fehler, []); gleich(api.d['cmi.core.exit'], undefined, 'abgeschlossen: kein suspend');
  const api2 = mockScorm12(), sp2 = scormSitzung(kernMitAdapter(), api2, 'API'); sp2.melde('geschafft', 'inhalt/a'); sp2.adapter[0].beenden(); gleich(api2.d['cmi.core.exit'], 'suspend', 'unterbrochen: suspend, damit die suspend_data bleiben');
});
test('SCORM 1.2: Wiederaufnahme aus suspend_data (Ereignisse, Minutengenau): Stufen, Freischaltungen, Fälle kommen zurück', () => {
  const k = kernMitAdapter(), api = mockScorm12(), p = plan([U('gebiet/g'), U('werkzeug/w'), U('quest/a', { in: 'gebiet/g' }), U('quest/b', { in: 'gebiet/g' })], [{ id: 'r', schaltet: ['werkzeug/w'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' }], { id: 'wieder' });
  const sp = scormSitzung(k, api, 'API', {}, p);
  sp.melde('geschafft', 'quest/a', { mit: ['werkzeug/w'], zeit: '2026-10-09T10:00:00Z' }); sp.melde('angewendet', 'quest/b', { beleg: { art: 'messung', fall: 'Akademie' }, zeit: '2026-10-09T11:30:00Z' });
  sp.melde('angewendet', 'quest/b', { beleg: { art: 'eigen', fall: 'dorf' }, zeit: '2026-10-10T09:00:00Z' });
  const vorher = sp.stand('2026-10-11T00:00:00Z');
  const k2 = kernMitAdapter(), sp2 = scormSitzung(k2, api, 'API', {}, p, () => '2026-10-11T00:00:00Z');
  const nachher = sp2.stand('2026-10-11T00:00:00Z');
  gleich(nachher.einheiten, vorher.einheiten); gleich(nachher.freigeschaltet, vorher.freigeschaltet); gleich(sp2.ereignisse().length, 3);
  gleich(nachher.einheiten['quest/b'].stufe, 4, 'zwei Fälle bleiben zwei Fälle'); gleich(nachher.einheiten['werkzeug/w'].stufe, 2);
});
test('SCORM 1.2: ist der Plan zu groß für 4096 Zeichen, bleiben nur Stufen und Freischaltungen (Form S); daraus wird der Stand wiederhergestellt', () => {
  const r = rng(2026), einh = [U('gebiet/g')];
  for (let i = 0; i < 40; i++) einh.push(U('episode/e' + i, { in: 'gebiet/g' }));
  for (let i = 0; i < 200; i++) einh.push(U('inhalt/s' + i, { in: 'episode/e' + (i % 40) }));
  const p = plan(einh, [{ id: 'g2', schaltet: ['episode/e39'], wenn: { einheit: 'episode/e0' }, enthuellung: 'x' }], { id: 'gross' });
  const k = kernMitAdapter(), api = mockScorm12(), sp = scormSitzung(k, api, 'API', {}, p);
  for (let i = 0; i < 200; i++) { sp.melde('begonnen', 'inhalt/s' + i, { zeit: ISO(Date.parse(T(10)) + i * 600000) }); if (r.chance(0.7)) sp.melde('geschafft', 'inhalt/s' + i, { zeit: ISO(Date.parse(T(10)) + i * 600000 + 300000) }); }
  wahr(api.d['cmi.suspend_data'].startsWith('SP0|X|') && api.d['cmi.suspend_data'].length <= 4096, `Form X (Nummern statt ids), ${api.d['cmi.suspend_data'].length} Zeichen: ${api.d['cmi.suspend_data'].slice(0, 20)}`);
  for (let i = 0; i < 400; i++) sp.melde('erkundet', 'inhalt/s' + (i % 200), { zeit: ISO(Date.parse(T(11)) + i * 600000) });
  const text = api.d['cmi.suspend_data'];
  wahr(text.startsWith('SP0|S|') && text.length <= 4096, `Form S, ${text.length} Zeichen: ${text.slice(0, 20)}`);
  gleich(api.log.filter(l => l[0] === 'cmi.suspend_data' && l[1].length > 4096), [], 'nie mehr als 4096 geschrieben (die Attrappe lehnt es sonst ab)'); gleich(sp.adapter[0].fehler, []);
  const k2 = kernMitAdapter(), sp2 = scormSitzung(k2, api, 'API', {}, p, () => ISO(Date.parse(T(12))));
  const vorher = sp.stand(ISO(Date.parse(T(12)))), nachher = sp2.stand(ISO(Date.parse(T(12))));
  for (const u of einh.filter(x => x.art === 'inhalt')) gleich(nachher.einheiten[u.id].stufe, vorher.einheiten[u.id].stufe, u.id);
  gleich(nachher.einheiten['episode/e0'].stufe, vorher.einheiten['episode/e0'].stufe); gleich(nachher.einheiten['episode/e39'].zugang, vorher.einheiten['episode/e39'].zugang);
});
test('SCORM: Form S und X lassen sich nicht auf einen anderen Plan gleicher Größe anwenden (Hash der Einheiten)', () => {
  const { Spielplan: S } = kernMitAdapter();
  const mach = pre => plan(Array.from({ length: 30 }, (_, i) => U('quest/' + pre + '-einheit-nummer-' + i)));
  const a = mach('a'), b = mach('b'), obj = i => 'quest/a-einheit-nummer-' + i;
  const ev = [E('geschafft', obj(1), T(10)), E('begonnen', obj(2), T(11)), E('geschafft', obj(3), T(12)), E('erkundet', obj(4), T(13)), E('geschafft', obj(5), T(14))];
  const e1 = S.adapter.kompakt(a, ev, 1 << 20), x1 = S.adapter.kompakt(a, ev, e1.length - 1), s1 = S.adapter.kompakt(a, ev, x1.length - 1, S.spielstand(a, ev, T(15)));
  wahr(e1.startsWith('SP0|E|') && x1.startsWith('SP0|X|') && s1.startsWith('SP0|S|'), [e1, x1, s1].map(t => t.slice(0, 7) + t.length).join(' '));
  wahr(S.adapter.entpacke(a, e1) && S.adapter.entpacke(a, x1) && S.adapter.entpacke(a, s1), 'gleicher Plan: lesbar');
  gleich(S.adapter.entpacke(b, s1), null); gleich(S.adapter.entpacke(b, x1), null);
  gleich(S.adapter.entpacke(b, e1.replace(/quest\/a-/g, 'quest/b-')).ereignisse.length, 5, 'Form E trägt die ids selbst');
});
test('SCORM: Form S mit geändertem Plan wird nicht gelesen (Hinweis, kein Wurf); fremde suspend_data ebenso', () => {
  const k = kernMitAdapter();
  for (const text of ['SP0|S|abc|0000|', 'irgendwas', 'SP0|E|x|a|b|c.d', 'SP0|E|0|quest/a||9.0.0']) {
    const api = mockScorm12({ start: { 'cmi.suspend_data': text } }), sp = scormSitzung(k, api, 'API', {}, scormPlan);
    gleich(sp.ereignisse(), [], text); wahr(sp.adapter[0].fehler.some(f => /suspend_data nicht lesbar/.test(f)), text + ': ' + sp.adapter[0].fehler.join());
  }
});
test('SCORM 2004: completion_status, progress_measure, große suspend_data in Form E; Wiederaufnahme', () => {
  const k = kernMitAdapter(), api = mockScorm2004(), sp = scormSitzung(k, api, 'API_1484_11'), ad = sp.adapter[0];
  gleich(ad.version, '2004'); gleich(api.d['cmi.completion_status'], 'incomplete');
  sp.melde('geschafft', 'inhalt/a'); gleich(api.d['cmi.progress_measure'], '0.2'); gleich(api.d['cmi.completion_status'], 'incomplete');
  sp.melde('geschafft', 'inhalt/b', { zeit: T(10, 5) }); gleich(api.d['cmi.completion_status'], 'completed');
  wahr(+api.d['cmi.progress_measure'] >= 0.8 && +api.d['cmi.progress_measure'] <= 1);
  gleich(ad.beenden(), true); gleich(api.beendet, true);
  const sp2 = scormSitzung(kernMitAdapter(), api, 'API_1484_11'); gleich(sp2.ereignisse().length, 2); gleich(sp2.stand().einheiten['gebiet/kurs'].stufe, 2);
  gleich(api.d['cmi.completion_status'], 'completed', 'ein abgeschlossener Kurs wird nicht zurückgesetzt');
});
test('SCORM: eine API, die Werte ablehnt oder nicht startet, bringt die Seite nicht zum Absturz', () => {
  const k = kernMitAdapter();
  let api = mockScorm12({ setzeFehler: true }), sp = scormSitzung(k, api, 'API'); sp.melde('geschafft', 'inhalt/a'); wahr(sp.adapter[0].fehler.some(f => /SetValue .* abgelehnt/.test(f)), sp.adapter[0].fehler.join());
  api = mockScorm12({ initFehler: true }); sp = scormSitzung(k, api, 'API'); sp.melde('geschafft', 'inhalt/a'); wahr(sp.adapter[0].fehler.some(f => /Initialize fehlgeschlagen/.test(f)), sp.adapter[0].fehler.join()); gleich(sp.adapter[0].beenden(), false);
  api = mockScorm12({ grenze: 100 }); sp = scormSitzung(k, api, 'API'); sp.melde('geschafft', 'inhalt/a'); gleich(api.d['cmi.suspend_data'].length <= 100, true, 'zu große Daten werden gar nicht erst geschrieben');
  const werfend = { LMSInitialize: () => { throw new Error('boom'); } }; sp = scormSitzung(k, werfend, 'API'); sp.melde('geschafft', 'inhalt/a'); wahr(sp.adapter[0].fehler.some(f => /boom/.test(f)));
});
test('SCORM: kompakt/entpacke im Rundlauf für Zufallsereignisse (Minutengenauigkeit), Grenze wird nie überschritten', () => {
  const { Spielplan: S } = kernMitAdapter(), r = rng(8080);
  let xFaelle = 0;
  for (let i = 0; i < (KURZ ? 40 : 200); i++) {
    const { p } = zufallsfall(r), ev = genEreignisse(r, p, r.int(40)).map(e => Object.assign(e, { zeit: ISO(Math.floor(Date.parse(e.zeit) / 60000) * 60000) }));
    ev.forEach(e => { delete e.wer; delete e.app; });
    const t = S.adapter.kompakt(p, ev, 1 << 20);
    wahr(t.startsWith('SP0|E|'), t.slice(0, 20));
    const z = S.adapter.entpacke(p, t, {});
    const norm = l => l.map(e => ({ verb: e.verb, objekt: e.objekt, zeit: e.zeit, mit: e.mit || undefined, beleg: e.beleg ? { art: e.beleg.art, fall: e.beleg.fall || undefined } : undefined })).sort((a, b) => (a.zeit + a.objekt + a.verb < b.zeit + b.objekt + b.verb ? -1 : 1));
    gleich(JSON.parse(JSON.stringify(norm(z.ereignisse))), JSON.parse(JSON.stringify(norm(ev))), `Lauf ${i}`);
    const jetzt = '2026-12-31T00:00:00Z';
    gleich(JSON.stringify(S.spielstand(p, z.ereignisse, jetzt).einheiten), JSON.stringify(S.spielstand(p, ev, jetzt).einheiten), 'derselbe Spielstand aus den wiederhergestellten Ereignissen');
    for (const grenze of [60, 300, 4096]) { const k = S.adapter.kompakt(p, ev, grenze); wahr(k.length <= grenze, `${k.length} > ${grenze}`); }
    const x = S.adapter.kompakt(p, ev, t.length - 1);                       // knapper als E: X (kürzer), sonst S
    if (x.startsWith('SP0|X|')) {
      xFaelle++;
      const zx = S.adapter.entpacke(p, x, {});
      gleich(JSON.parse(JSON.stringify(norm(zx.ereignisse))), JSON.parse(JSON.stringify(norm(ev))), `Form X, Lauf ${i}`);
      gleich(S.adapter.entpacke(Object.assign({}, p, { einheiten: p.einheiten.concat([{ id: 'quest/neu', art: 'quest', name: 'neu' }]) }), x, {}), null, 'anderer Plan: Form X wird nicht gelesen');
    }
  }
  wahr(xFaelle >= 5, `Form X kommt im Zufall vor (${xFaelle})`);
  gleich(S.adapter.entpacke(scormPlan, 5), null); gleich(S.adapter.entpacke(scormPlan, 'SP0|Q|'), null);
});

/* ================================================================ 8. Werkzeug */

gruppe('8 Werkzeug check-spielplan');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'spielplan-test-'));
const CLI = path.join(ROOT, 'tools', 'check-spielplan.mjs');
function cli(args) {
  try { return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') }; }
}
const schreibe = (name, text) => { const f = path.join(TMP, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
test('check-spielplan: Kaffee-Beispiel in Ordnung (Exit 0), Warnungen sichtbar, --streng macht sie zu Fehlern', () => {
  const r = cli([path.join(ROOT, 'docs', 'spielplan-beispiel-kaffee.yaml')]);
  gleich(r.code, 0); wahr(/✓ Spielplan in Ordnung \(2 Warnungen\)/.test(r.out) && /erlebnis\/roestung: braucht/.test(r.out), r.out);
  const s = cli([path.join(ROOT, 'docs', 'spielplan-beispiel-kaffee.yaml'), '--streng']); gleich(s.code, 1);
  const j = JSON.parse(cli([path.join(ROOT, 'docs', 'spielplan-beispiel-kaffee.yaml'), '--json']).out); gleich(j.fehler, []); gleich(j.warnungen.length, 2); gleich(j.info.einheiten, 11);
});
test('check-spielplan: Fehler mit Einheiten-ID, Exit 1; YAML-Fehler mit Zeile; JSON-Fehler; fehlende Datei Exit 2', () => {
  const f = schreibe('schlecht.yaml', 'format: spielplan/0\nid: t\nname: T\nbasis: https://x.org/t/\neinheiten:\n  - { id: skill/a, art: skill, name: A }\n  - { id: quest/b, art: quest, name: B, in: episode/gibtsnicht, staerke: 1 }\n  - { id: quest/c, art: quest, name: C, staerke: 1 }\nregeln:\n  - { id: r, schaltet: [quest/c], wenn: { einheit: quest/c } }\n');
  const r = cli([f]);
  gleich(r.code, 1);
  for (const m of [/Einheit skill\/a: skill ohne kann/, /Einheit quest\/b: in verweist auf unbekannte Einheit „episode\/gibtsnicht“/, /Einheit quest\/c: geht nie auf/, /Zyklus ohne Einstieg: quest\/c/, /Regel r: enthuellung fehlt/]) wahr(m.test(r.out), String(m) + '\n' + r.out);
  const y = cli([schreibe('kaputt.yaml', 'a: 1\nb: [1, 2\n')]); gleich(y.code, 1); wahr(/Zeile 2/.test(y.out), y.out);
  const js = cli([schreibe('kaputt.json', '{\n "einheiten": [\n  { "id": }\n ]\n}')]); gleich(js.code, 1); wahr(/kein gültiges JSON/.test(js.out), js.out);
  gleich(cli([path.join(TMP, 'gibtsnicht.yaml')]).code, 2); gleich(cli([]).code, 2); gleich(cli(['kein-paket-dieses-namens']).code, 2);
});
test('check-spielplan: Paketordner (spielplan.json), eingeschlossen in einen Ordner; leerer Spielplan; JSON-Datei', () => {
  const plan1 = { format: 'spielplan/0', id: 'p', name: 'P', basis: 'https://x.org/p/', einheiten: [{ id: 'episode/a', art: 'episode', name: 'A', etappe: 'onboarding' }, { id: 'quest/q', art: 'quest', name: 'Q', in: 'episode/a', staerke: 1, gewicht: 'kritisch' }], regeln: [] };
  const dir = path.join(TMP, 'paket'); schreibe('paket/spielplan.json', JSON.stringify(plan1));
  const r = cli([dir]); gleich(r.code, 0); wahr(/Spielplan p \(/.test(r.out) && /2 Einheiten/.test(r.out), r.out);
  gleich(cli([path.join(dir, 'spielplan.json')]).code, 0);
  const e = cli([schreibe('leer.json', '{}')]); gleich(e.code, 1); wahr(/einheiten fehlt/.test(e.out), e.out);
  const paket = path.join(ROOT, 'packs', 'beispiel-gehirn', 'spielplan.json');
  if (fs.existsSync(paket)) { const q = cli(['beispiel-gehirn']); wahr(q.code === 0, 'packs/beispiel-gehirn/spielplan.json: ' + q.out.slice(0, 600)); }
});
test('Spielplan-Dateien der Pakete im Repo bestehen die Prüfung (soweit vorhanden)', () => {
  for (const n of fs.readdirSync(path.join(ROOT, 'packs'))) {
    const f = path.join(ROOT, 'packs', n, 'spielplan.json');
    if (!fs.existsSync(f)) continue;
    const r = SP.pruefe(JSON.parse(fs.readFileSync(f, 'utf8')));
    gleich(r.fehler, [], `packs/${n}/spielplan.json`);
  }
});

/* ================================================================ Konformitätsset */

gruppe('8b Konformitätsset (docs/spielplan-konformitaet.json)');

/** Fälle, an denen eine zweite Umsetzung prüfen kann, ob sie dieselben Stufen, Zugänge, Takte und Freischaltungen rechnet. Die Erwartung stammt aus dem Kern und wird im Test vom unabhängigen Orakel bestätigt. */
function konformitaetsFaelle() {
  const F = [];
  const fall = (name, beschreibung, p, ereignisse, jetzt, optionen) => F.push({ name, beschreibung, plan: klon(p), ereignisse: klon(ereignisse), jetzt, optionen: optionen || {} });
  fall('kaffee-anfang', 'Der Anhang des Standards ohne Ereignisse: Röstkurve, Röstung, Handel, Weltmarkt gesperrt.', KAFFEE, [], T(10));
  fall('kaffee-mythos', 'Die kritische Mythos-Quest schaltet die Röstkurve frei (Regel), das Werkzeug ist noch nicht benutzt, also bleibt die Röstung gesperrt (braucht).', KAFFEE, [KA('geschafft', 'quest/kaldi-mythos', T(10, 12))], T(11));
  fall('kaffee-episode-geuebt', 'Mythos, Kaldi, Röstkurve benutzt, Röstung geschafft: Episode geübt (zwei Drittel von zwei wesentlichen sind zwei), Handel und Weltmarkt gehen im selben Augenblick auf.', KAFFEE,
    [KA('geschafft', 'quest/kaldi-mythos', T(10, 0)), KA('geschafft', 'inhalt/kaldi', T(10, 5)), KA('begonnen', 'werkzeug/roestkurve', T(10, 6)), KA('geschafft', 'erlebnis/roestung', T(10, 10))], T(12));
  fall('sammeln-kritisch-wesentlich-optional', 'Eine kritische, vier wesentliche, zwei optionale Einheiten: die Episode braucht die kritische und drei von vier wesentlichen (zwei Drittel, aufgerundet); Optionales zählt nicht.', sammelPlan(['kritisch', 'wesentlich', 'wesentlich', 'wesentlich', 'wesentlich', 'optional', 'optional']),
    ['x0', 'x1', 'x2', 'x3', 'x5', 'x6'].map((id, i) => E('geschafft', 'inhalt/' + id, T(10, i))), T(12));
  fall('sammeln-zwei-drittel-von-drei', 'Drei wesentliche, zwei geschafft: zwei Drittel von drei sind zwei.', sammelPlan(['wesentlich', 'wesentlich', 'wesentlich']), ['x0', 'x1'].map((id, i) => E('geschafft', 'inhalt/' + id, T(10, i))), T(12));
  fall('sammeln-anteil-067', 'Mit stufen.anteil 0.67 verlangen drei wesentliche Einheiten alle drei (Befund B2).', sammelPlan(['wesentlich', 'wesentlich', 'wesentlich'], { stufen: { anteil: 0.67 } }), ['x0', 'x1'].map((id, i) => E('geschafft', 'inhalt/' + id, T(10, i))), T(12));
  const q = plan([U('quest/q'), U('werkzeug/w')]);
  fall('stufen-treppe', 'Begonnen 1, geschafft 2, angewendet ohne Beleg 2, angewendet mit Beleg 3.', q, [E('angewendet', 'quest/q', T(10)), E('begonnen', 'quest/q', T(9)), E('angewendet', 'quest/q', T(11), { beleg: { art: 'eigen', fall: 'a' } })], T(12));
  fall('transfer-zwei-faelle', 'Zwei verschiedene Fälle (ohne Groß- und Kleinschreibung verglichen) ergeben Stufe 4.', q, [E('angewendet', 'quest/q', T(10), { beleg: { art: 'messung', fall: 'Akademie' } }), E('angewendet', 'quest/q', T(11), { beleg: { art: 'eigen', fall: 'dorf' } })], T(12));
  fall('transfer-derselbe-fall', 'Derselbe Fall zweimal bleibt bei Stufe 3.', q, [E('angewendet', 'quest/q', T(10), { beleg: { art: 'messung', fall: 'a' } }), E('angewendet', 'quest/q', T(11), { beleg: { art: 'eigen', fall: 'A' } })], T(12));
  fall('transfer-geteilt', 'Angewendet mit Beleg und geteilt: Stufe 4; geteilt allein nur Stufe 1.', plan([U('quest/q'), U('quest/r')]), [E('angewendet', 'quest/q', T(10), { beleg: { art: 'messung', fall: 'a' } }), E('geteilt', 'quest/q', T(11)), E('geteilt', 'quest/r', T(11))], T(12));
  fall('werkzeug-ueber-mit', 'Geschafft und angewendet mit Beleg werden über mit ans Werkzeug gereicht; begonnen nicht.', plan([U('werkzeug/w'), U('quest/a'), U('quest/b'), U('quest/c')]),
    [E('begonnen', 'quest/c', T(9), { mit: ['werkzeug/w'] }), E('angewendet', 'quest/a', T(10), { mit: ['werkzeug/w'], beleg: { art: 'messung', fall: 'f1' } }), E('angewendet', 'quest/b', T(11), { mit: ['werkzeug/w'], beleg: { art: 'messung', fall: 'f2' } })], T(12));
  const wz = plan([U('quest/a'), U('werkzeug/w')], [{ id: 'w', schaltet: ['werkzeug/w'], wenn: { wartezeit: { einheit: 'quest/a', stufe: 2, stunden: 3 } }, enthuellung: 'Pause vorbei.' }]);
  fall('wartezeit-davor', 'Drei Stunden nach dem Erreichen der Stufe 2: zwei Stunden 59 danach noch gesperrt.', wz, [E('geschafft', 'quest/a', T(10, 0))], T(12, 59));
  fall('wartezeit-danach', 'Genau drei Stunden danach offen, „am“ ist der Zeitpunkt der Freigabe.', wz, [E('geschafft', 'quest/a', T(10, 0))], T(13, 0));
  fall('wartezeit-uebersprungen', 'Mit der Option ohneWartezeit zählt die Pause als vorbei.', wz, [E('geschafft', 'quest/a', T(10, 0))], T(10, 1), { ohneWartezeit: true });
  const tk = plan([U('quest/a'), U('quest/b'), U('quest/c')], [{ id: 't3', schaltet: ['quest/b'], wenn: { takt: 3 }, enthuellung: 'x' }, { id: 'ab', schaltet: ['quest/c'], wenn: { ab: '2026-10-20' }, enthuellung: 'x' }], { rhythmus: { takt: { laenge: 'woche', beginn: 'erstes-ereignis' } } });
  fall('takt-erstes-ereignis', 'Der Takt beginnt am UTC-Kalendertag des ersten Ereignisses; Woche 3 beginnt 14 Tage später um 00:00.', tk, [E('begonnen', 'quest/a', T(15, 0, 9))], '2026-10-22T23:59:00Z');
  fall('takt-und-datum', 'Dasselbe zwei Minuten später: Takt 3, und das Datum 20.10. ist erreicht.', tk, [E('begonnen', 'quest/a', T(15, 0, 9))], '2026-10-23T00:00:00Z');
  const ve = plan([U('episode/e1'), U('episode/e2'), U('inhalt/s', { in: ['episode/e1', 'episode/e2'] }), U('inhalt/t', { in: 'episode/e1' }), U('quest/a')], [{ id: '1', schaltet: ['episode/e1'], wenn: { einheit: 'quest/a' }, enthuellung: 'x' }, { id: '2', schaltet: ['episode/e2'], wenn: { einheit: 'quest/a', stufe: 3 }, enthuellung: 'x' }]);
  fall('vererbung-eltern', 'Gesperrte Eltern sperren ihre Einheiten; eine Einheit mit zwei Eltern ist offen, sobald einer offen ist (Befund B1).', ve, [E('geschafft', 'quest/a', T(10))], T(12));
  const nb = plan([U('quest/a'), U('werkzeug/w'), U('quest/z', { nach: 'quest/a', braucht: ['werkzeug/w'] })]);
  fall('nach-und-braucht-zusammen', 'nach und braucht an derselben Einheit gelten zusammen (Befund B3); braucht verlangt das Werkzeug offen und benutzt.', nb, [E('geschafft', 'quest/a', T(10))], T(12));
  fall('nach-und-braucht-erfuellt', 'Mit benutztem Werkzeug geht die Quest auf.', nb, [E('geschafft', 'quest/a', T(10)), E('begonnen', 'werkzeug/w', T(11))], T(12));
  const wk = plan([U('skill/s', { kann: 'Ich kann es.' }), U('quest/q', { uebt: ['skill/s'] })], [], { rhythmus: { wiederkehr: { abstand_tage: [2, 7], fuer: { art: 'skill' } }, verfall_tage: 20 } });
  fall('wiederkehr-faellig', 'Zwei Tage nach dem Erreichen der Stufe 2 ist die erste Wiederkehr des Skills fällig.', wk, [E('geschafft', 'quest/q', T(10, 0, 1))], T(10, 0, 3));
  fall('wiederkehr-eingeloest', 'Ein Ereignis nach dem ersten Abstand löst ihn ein; der zweite Abstand (sieben Tage) beginnt dann neu; nach 20 Tagen ohne Ereignis ist die Einheit verwittert.', wk, [E('geschafft', 'quest/q', T(10, 0, 1)), E('geschafft', 'quest/q', T(10, 0, 4))], '2026-10-25T00:00:00Z');
  fall('zukunft-gekappt', 'Ein Ereignis nach jetzt (falsche Uhr) zählt, mit dem Zeitpunkt jetzt (Auslegung A13).', q, [E('geschafft', 'quest/q', '2030-01-01T00:00:00Z')], T(12));
  return F;
}
function konformitaetsDatei() {
  const faelle = konformitaetsFaelle().map(f => {
    const s = SP.spielstand(f.plan, f.ereignisse, f.jetzt, f.optionen);
    const einheiten = {};
    for (const [id, e] of Object.entries(s.einheiten)) einheiten[id] = { stufe: e.stufe, zugang: e.zugang, verwittert: e.verwittert, faellig: e.faellig };
    return Object.assign(f, { erwartet: { takt: s.takt, einheiten, freigeschaltet: s.freigeschaltet.map(x => ({ einheit: x.einheit, regel: x.regel, am: x.am })) } });
  });
  return { format: 'spielplan-konformitaet/0', hinweis: 'Erzeugt von tools/spielplan-test.mjs --schreibe-konformitaet. Jede Umsetzung des Standards, die für plan, ereignisse, jetzt und optionen dieselben Stufen, Zugänge, Takte und Freischaltungen (mit Zeitpunkt) rechnet, setzt die Auslegungen aus docs/spielplan-auslegung.md gleich um. Zeiten sind UTC. Stufe, Zugang, Takt und Freischaltungen hat zusätzlich ein unabhängig geschriebenes Orakel bestätigt; „verwittert“ und „faellig“ (4.3, 5.5; Auslegungen A9 und A11) kommen nur aus dem Kern. Sätze und nächste Aufgabe gehören nicht dazu.', faelle };
}
if (process.argv.includes('--schreibe-konformitaet')) {
  fs.writeFileSync(path.join(ROOT, 'docs', 'spielplan-konformitaet.json'), JSON.stringify(konformitaetsDatei(), null, 1) + '\n');
  console.log('docs/spielplan-konformitaet.json geschrieben'); process.exit(0);
}
test('Konformitätsset: die Datei im Repo ist aktuell, und das unabhängige Orakel bestätigt jede Erwartung (Stufe, Zugang, Takt, Freischaltungen)', () => {
  const datei = path.join(ROOT, 'docs', 'spielplan-konformitaet.json');
  wahr(fs.existsSync(datei), 'docs/spielplan-konformitaet.json fehlt: node tools/spielplan-test.mjs --schreibe-konformitaet');
  const gespeichert = JSON.parse(fs.readFileSync(datei, 'utf8')), neu = JSON.parse(JSON.stringify(konformitaetsDatei()));
  gleich(neu, gespeichert, 'Konformitätsset veraltet: node tools/spielplan-test.mjs --schreibe-konformitaet');
  for (const f of gespeichert.faelle) {
    const o = orakel(f.plan, f.ereignisse, Date.parse(f.jetzt), f.optionen);
    for (const [id, e] of Object.entries(f.erwartet.einheiten)) {
      assert.strictEqual(e.stufe, o.stufe[id], `${f.name}: Stufe ${id}`); assert.strictEqual(e.zugang === 'offen', o.offen.has(id), `${f.name}: Zugang ${id}`);
    }
    assert.strictEqual(f.erwartet.takt, o.takt, `${f.name}: Takt`);
    assert.deepStrictEqual(f.erwartet.freigeschaltet.map(x => x.einheit).sort(), [...o.gated].filter(id => o.offen.has(id)).sort(), `${f.name}: freigeschaltet`);
  }
  wahr(gespeichert.faelle.length >= 20, 'zu wenige Fälle');
});

/* ================================================================ 9. Browser (nur wenn Playwright und Chromium da sind) */

gruppe('9 Browser (Chromium, falls vorhanden)');

async function browserOderNull() {
  const { createRequire } = await import('module');
  const dirs = [process.env.PLAYWRIGHT_MODULE_DIR, ROOT].concat(String(process.env.NODE_PATH || '').split(path.delimiter)).filter(Boolean).map(d => path.resolve(d));
  let pw = null;
  for (const d of dirs) for (const base of [path.join(d, 'noop.js'), path.join(d, '..', 'noop.js')]) { if (!pw) { try { pw = createRequire(base)('playwright'); } catch (e) { /* weiter */ } } }
  if (!pw) return null;
  try { return await pw.chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--allow-file-access-from-files'] }); }
  catch (e) { return null; }
}
test('Browser: Kern läuft als klassisches Skript unter file://, speichert in localStorage (gm:sp:), überlebt Neuladen, sendet nichts, ohne Konsolenfehler', async () => {
  const browser = await browserOderNull();
  if (!browser) { console.log('  (übersprungen: Playwright oder Chromium nicht gefunden; PLAYWRIGHT_MODULE_DIR setzen)'); return; }
  try {
    const seite = path.join(TMP, 'browser.html');
    fs.writeFileSync(seite, `<!doctype html><meta charset="utf-8"><title>t</title><script src="file://${path.join(ROOT, 'engine', 'js', 'spielplan.js')}"></script>
<script>window.PLAN = ${JSON.stringify(KAFFEE)};</script>`);
    const ctx = await browser.newContext(), page = await ctx.newPage(), anfragen = [], fehler = [];
    page.on('request', r => anfragen.push(r.url())); page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); }); page.on('pageerror', e => fehler.push(String(e)));
    await page.goto('file://' + seite);
    const r1 = await page.evaluate(() => {
      const sp = Spielplan.verbinde({ plan: PLAN, app: 'museum/kaffee' });
      const got = []; sp.bei('freigeschaltet', f => got.push(f.einheit));
      sp.melde('geschafft', 'quest/kaldi-mythos', { ergebnis: { dauer_s: 12 } });
      return { api: Object.keys(Spielplan).sort(), got, keys: Object.keys(localStorage), speicher: sp.speicher, stufe: sp.stand().einheiten['skill/quellen'].stufe, wer: sp.wer, aufgabe: sp.stand().aufgabe.einheit, adapter: Object.keys(Spielplan.adapter) };
    });
    gleich(r1.got, ['werkzeug/roestkurve']); gleich(r1.keys.filter(k => k.startsWith('gm:sp:')).sort(), ['gm:sp:museum-kaffee:ereignisse', 'gm:sp:museum-kaffee:gesehen', 'gm:sp:museum-kaffee:wer']);
    gleich(r1.speicher, 'lokal'); gleich(r1.stufe, 2); gleich(r1.adapter, [], 'ohne Adapter-Datei gibt es keine Adapter'); wahr(/^lokal:[0-9a-f]{8}$/.test(r1.wer));
    wahr(['spielstand', 'verbinde', 'pruefe', 'nachXapi'].every(k => r1.api.includes(k)), r1.api.join());
    await page.reload();
    const r2 = await page.evaluate(() => { const sp = Spielplan.verbinde({ plan: PLAN, app: 'museum/kaffee' }); let n = 0; sp.bei('freigeschaltet', () => n++); sp.aktualisiere(); return { wer: sp.wer, n, ereignisse: sp.ereignisse().length, zugang: sp.stand().einheiten['werkzeug/roestkurve'].zugang }; });
    gleich(r2.wer, r1.wer); gleich(r2.n, 0, 'schon gesehen'); gleich(r2.ereignisse, 1); gleich(r2.zugang, 'offen');
    const r3 = await page.evaluate(() => Spielplan.pruefe(PLAN).fehler.length);
    gleich(r3, 0);
    gleich(anfragen.filter(u => !u.startsWith('file://') && !u.startsWith('data:')), [], 'keine Netzwerkanfragen'); gleich(fehler, [], 'Konsolenfehler');
    await ctx.close();
  } finally { await browser.close(); }
});
test('Browser: gesperrter localStorage (privates Fenster) und Übung im iframe per postMessage', async () => {
  const browser = await browserOderNull();
  if (!browser) return;
  try {
    const seite = path.join(TMP, 'browser2.html');
    fs.writeFileSync(seite, `<!doctype html><meta charset="utf-8"><title>t</title><script src="file://${path.join(ROOT, 'engine', 'js', 'spielplan.js')}"></script>
<script>window.PLAN = ${JSON.stringify(KAFFEE)};</script><iframe id="f" srcdoc="<script>parent.postMessage({type:'sp:melde', verb:'geschafft', objekt:'inhalt/kaldi', ergebnis:{punkte:3}}, '*')</script>"></iframe>`);
    const ctx = await browser.newContext(), page = await ctx.newPage(), fehler = [];
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } }); });
    page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); }); page.on('pageerror', e => fehler.push(String(e)));
    await page.addInitScript(() => { window.__nachrichten = 0; });
    await page.route('**/*', r => r.continue());
    await page.goto('file://' + seite);
    const r = await page.evaluate(async () => {
      const sp = Spielplan.verbinde({ plan: PLAN, app: 'museum/kaffee' });
      sp.horche(window);
      document.getElementById('f').srcdoc = document.getElementById('f').srcdoc;       // neu laden: die Nachricht kommt jetzt, wo wir hören
      await new Promise(r => setTimeout(r, 600));
      sp.melde('geschafft', 'quest/kaldi-mythos');
      return { speicher: sp.speicher, n: sp.ereignisse().map(e => e.objekt + ' ' + (e.ergebnis ? JSON.stringify(e.ergebnis) : '')), zugang: sp.stand().einheiten['werkzeug/roestkurve'].zugang };
    });
    gleich(r.speicher, 'arbeitsspeicher'); gleich(r.zugang, 'offen'); wahr(r.n.includes('inhalt/kaldi {"punkte":3}'), JSON.stringify(r.n)); gleich(fehler, []);
    await ctx.close();
  } finally { await browser.close(); }
});

/* ================================================================ Abschluss */
async function laufe() {
  let schlecht = 0;
  for (const t of tests) {
    if (process.env.SP_NUR && !(t.gruppe.name + ' ' + t.name).includes(process.env.SP_NUR)) continue;
    try { await Promise.race([Promise.resolve().then(t.fn), new Promise((_, nein) => setTimeout(() => nein(new Error('Zeitüberschreitung nach 20 s')), 20000).unref())]); t.gruppe.ok++; }
    catch (e) { t.gruppe.bad++; schlecht++; console.log(`✗ [${t.gruppe.name}] ${t.name}\n    ${String(e && e.message || e).split('\n').slice(0, 8).join('\n    ')}`); if (process.env.SP_TRACE && e.stack) console.log(e.stack); }
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  let ok = 0;
  for (const g of gruppen) { ok += g.ok; console.log(`${g.bad ? '✗' : '✓'} ${g.name}: ${g.ok} von ${g.ok + g.bad}`); }
  console.log(`\n${schlecht ? '✗' : '✓'} ${ok} von ${ok + schlecht} Tests`);
  process.exit(schlecht ? 1 : 0);
}
laufe();

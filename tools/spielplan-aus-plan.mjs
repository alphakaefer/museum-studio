#!/usr/bin/env node
// Museum Studio – Spielplan aus dem Stationsplan ableiten (Format spielplan/0, docs/spielplan-standard.md).
//
//   node tools/spielplan-aus-plan.mjs <paket> [--skelett] [--out=datei] [--stdout] [--trotzdem]
//
// Erzeugt packs/<paket>/spielplan.json (kanonisches JSON; der Zusammenbau liefert es als data/spielplan.js aus) aus
//   plan.json + journeys.js + pack.json      die mechanisch ableitbaren Einheiten (Auslegung S1 in docs/spielplan-auslegung.md)
//   spielplan-kern.yaml (oder .json)         die kuratierte Schicht: gebiete, episoden_zusatz, gewichte, quests, aufgaben, skills,
//                                            werkzeuge, regeln, rhythmus, stufen, begriffe (Format: Kopf von packs/gehirn/spielplan-kern.yaml)
//   spielplan-zuordnung/*.json               Zuordnung je Station: uebt, braucht, staerke, gewicht (siehe unten)
// --skelett: ohne kuratierte Schicht (Kern und Zuordnung werden ignoriert): alles offen, keine Regeln. Nur zum Testen der Oberfläche
//            und als Grundlage, aus der ein Mensch den Kern schreibt.
// Das Ergebnis wird mit Spielplan.pruefe (engine/js/spielplan.js) geprüft; bei Fehlern wird nichts geschrieben (--trotzdem schreibt doch).
//
// Ableitung (je Quelle eine Einheit):
//   gebiete[]                      gebiet/<name>         (aus dem Kern: name, reihenfolge, sichtbar, auftakt, abschluss)
//   journeys.js + episoden_zusatz  episode/<reise-id>    in: Gebiet, etappe, reihenfolge, auftakt, abschluss, sichtbar; adresse #/reise/<id>
//   plan.stations                  inhalt/<id>           name = Titel, in = Reisen (Text bei einer), reihenfolge = Platz in der ersten Reise,
//                                                        adresse #/station/<id>
//   Stationen der Art mythos       quest/<id>-mythos     name = „Mythos-Check: “ + Titel, in wie die Station, staerke aus quests/Zuordnung
//   Stationen mit exhibit          erlebnis/<exponat>    name = Exponat-Titel (aus exhibits/<id>.js), in wie die Station
//   werkzeuge[], skills[]          werkzeug/…, skill/…   skills.geuebt_durch setzt uebt an den genannten Einheiten
//   gewichte, aufgaben             gewicht und aufgabe an der Einheit (alles Übrige ist wesentlich)
//   regeln, rhythmus, stufen, begriffe, nur_lokal, basis   unverändert in den Kopf
// Zuordnungsdateien (JSON): { "<station-id>": { uebt, braucht, staerke, gewicht }, … } oder eine Liste von Einträgen mit "station" statt des Schlüssels;
//   der Schlüssel darf auch eine volle Einheiten-id sein (z. B. "quest/phrenologie-mythos"). uebt nennt Skills, braucht Werkzeuge (kurze Namen
//   ohne Art werden zu skill/… bzw. werkzeug/…). Mehrere Dateien werden in Namensfolge gemischt; Listen vereinigen sich, Einzelwerte überschreiben.
// Nur Node-Standardbibliothek und die Werkzeuge in tools/.
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { newReport, ROOT, isMain, resolvePack, loadPackJson, loadPlan, loadJourneysJs } from './check-lib.mjs';
import { parseDatei, YamlFehler } from './yaml-lite.mjs';
import { ladeKern } from './check-spielplan.mjs';

const KEY_ORDER = ['id', 'art', 'name', 'sorte', 'in', 'etappe', 'gewicht', 'staerke', 'sichtbar', 'reihenfolge', 'adresse', 'kann', 'bereich',
  'uebt', 'braucht', 'nach', 'aus', 'herkunft', 'kurz', 'einsatz', 'aufgabe', 'auftakt', 'abschluss', 'material'];
const HEAD_ORDER = ['format', 'id', 'name', 'basis', 'nur_lokal', 'stufen', 'begriffe', 'rhythmus', 'einheiten', 'regeln'];
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const list = x => (x === undefined || x === null ? [] : Array.isArray(x) ? x : [x]);
const uniq = a => [...new Set(a)];
const clone = x => JSON.parse(JSON.stringify(x));

function ordered(unit) {
  const o = {};
  for (const k of KEY_ORDER) if (unit[k] !== undefined) o[k] = unit[k];
  for (const k of Object.keys(unit)) if (!(k in o) && unit[k] !== undefined) o[k] = unit[k];
  return o;
}

/** Titel eines Exponats aus exhibits/<id>.js (Datei im Browser-Rahmen ausführen; Rückfall: erster Treffer von title:). */
function exhibitTitles(P, ids) {
  const out = {};
  for (const id of ids) {
    const f = path.join(P.dir, 'exhibits', id + '.js');
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    try {
      const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop, construct: () => ({}) });
      const ctx = { console: { log() {}, warn() {}, error() {} }, document: noop, navigator: {}, setTimeout, clearTimeout, requestAnimationFrame: () => 0 };
      ctx.window = ctx; ctx.MUSEUM = { exhibits: {}, data: {}, viz: noop };
      vm.runInNewContext(src, ctx, { filename: f, timeout: 2000 });
      const ex = ctx.MUSEUM.exhibits[id];
      if (ex && typeof ex.title === 'string' && ex.title.trim()) { out[id] = ex.title.trim(); continue; }
    } catch { /* Rückfall */ }
    const m = /\btitle:\s*(['"])((?:\\.|(?!\1).)*)\1/.exec(src);
    if (m) out[id] = m[2].replace(/\\(['"])/g, '$1').trim();
  }
  return out;
}

function readZuordnung(P, R) {
  const dir = path.join(P.dir, 'spielplan-zuordnung');
  const res = {};
  if (!fs.existsSync(dir)) return res;
  for (const n of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const rel = P.rel('spielplan-zuordnung/' + n);
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')); } catch (e) { R.err(`${rel}: kein gültiges JSON (${e.message}).`); continue; }
    let eintraege = [];
    const wurzel = isObj(j) && (isObj(j.stationen) || Array.isArray(j.stationen)) ? j.stationen : j;
    if (Array.isArray(wurzel)) eintraege = wurzel.filter(isObj).map(e => [e.station || e.id, e]);
    else if (isObj(wurzel)) eintraege = Object.entries(wurzel).filter(([k, v]) => isObj(v) && !k.startsWith('_'));
    else R.err(`${rel}: erwartet { "<station>": { uebt, braucht, staerke, gewicht } } oder eine Liste.`);
    for (const [k, e] of eintraege) {
      if (typeof k !== 'string' || !k) { R.warn(`${rel}: Eintrag ohne Stations-id übersprungen.`); continue; }
      const t = res[k] || (res[k] = { uebt: [], braucht: [] });
      t.uebt = uniq(t.uebt.concat(list(e.uebt)));
      t.braucht = uniq(t.braucht.concat(list(e.braucht)));
      if (e.staerke !== undefined) t.staerke = e.staerke;
      if (e.gewicht !== undefined) t.gewicht = e.gewicht;
    }
  }
  return res;
}

const GENERISCH = {
  gebiet: { art: 'das', sg: 'Gebiet', pl: 'Gebiete' }, episode: { art: 'die', sg: 'Reise', pl: 'Reisen' }, inhalt: { art: 'die', sg: 'Station', pl: 'Stationen' },
  quest: { art: 'die', sg: 'Mythos-Karte', pl: 'Mythos-Karten' }, erlebnis: { art: 'das', sg: 'Exponat', pl: 'Exponate' },
  werkzeug: { art: 'das', sg: 'Werkzeug', pl: 'Werkzeuge' }, skill: { art: 'die', sg: 'Fähigkeit', pl: 'Fähigkeiten' }
};

/** Die drei Sätze, die eine Reise erzählt: aus Tagline, Einleitung und Ausblick des Pakets (für Reisen ohne Eintrag im Kern). */
function saetze(text, n) {
  const t = String(text || '').trim();
  if (!t) return '';
  const teile = t.match(/[^.!?]+[.!?]+(?:["“”»«]+)?(?:\s+|$)/g);
  if (!teile) return t;
  return teile.slice(0, n).join('').trim();
}

export function leiteAb(P, { skelett = false, kern = null, kernDatei = '' } = {}) {
  const R = newReport();
  const pack = loadPackJson(P, R) || {};
  const plan = loadPlan(P, R);
  const journeys = loadJourneysJs(P, R) || [];
  if (!plan) { R.err(`${P.rel('plan.json')}: nicht lesbar.`); return { R, spielplan: null }; }
  const K = skelett ? {} : (kern || {});
  const W = m => R.warn(m);

  const stationenById = Object.fromEntries(plan.stations.map(s => [s.id, s]));
  const einheiten = [];
  const by = {};
  const add = u => { if (by[u.id]) { R.err(`Einheit ${u.id}: id doppelt (zweite Quelle: ${u.art}).`); return null; } by[u.id] = u; einheiten.push(u); return u; };

  // --- Gebiete
  for (const g of list(K.gebiete)) {
    if (!isObj(g) || !g.id) { W('gebiete: Eintrag ohne id übersprungen.'); continue; }
    add({ ...g, art: 'gebiet' });
  }

  // --- Episoden (Reisen)
  const zusatz = Object.fromEntries(list(K.episoden_zusatz).filter(isObj).map(e => [e.id, e]));
  journeys.forEach((j, i) => {
    const id = 'episode/' + j.id;
    const z = zusatz[id] || {};
    if (!skelett && K.episoden_zusatz && !zusatz[id]) W(`${id}: kein Eintrag in episoden_zusatz (Gebiet, Etappe, Auftakt, Abschluss werden aus journeys.js abgeleitet).`);
    const u = {
      id, art: 'episode', name: j.name, in: z.gebiet, etappe: z.etappe || (i === 0 ? 'onboarding' : 'scaffolding'),
      reihenfolge: z.reihenfolge !== undefined ? z.reihenfolge : i + 1, sichtbar: z.sichtbar, adresse: '#/reise/' + j.id,
      auftakt: z.auftakt || [j.tagline && (/[.!?]$/.test(j.tagline) ? j.tagline : j.tagline + '.'), saetze(j.intro, 2)].filter(Boolean).join(' '),
      abschluss: z.abschluss || saetze(j.outro, 3)
    };
    for (const k of Object.keys(z)) if (!['id', 'gebiet'].includes(k) && u[k] === undefined) u[k] = z[k];
    add(u);
  });
  for (const id of Object.keys(zusatz)) if (!by[id]) W(`episoden_zusatz: ${id} gehört zu keiner Reise des Pakets (übersprungen).`);

  // --- Stationen, Mythos-Karten, Exponate
  const exIds = uniq(plan.stations.map(s => s.exhibit).filter(Boolean));
  const exTitel = exhibitTitles(P, exIds);
  const vorsatz = typeof K.quest_vorsatz === 'string' ? K.quest_vorsatz : 'Mythos-Check: ';
  const homeOf = s => (Array.isArray(s.journeys) ? s.journeys : []);
  for (const s of plan.stations) {
    const reisen = homeOf(s).filter(j => by['episode/' + j]);
    const inn = reisen.length ? reisen.map(j => 'episode/' + j) : undefined;
    const pos = (reisen.length && Array.isArray(plan.orders[reisen[0]]) ? plan.orders[reisen[0]].indexOf(s.id) : -1) + 1;
    const adresse = '#/station/' + s.id;
    const gemeinsam = { in: inn && (inn.length === 1 ? inn[0] : inn), reihenfolge: pos || undefined };
    add({ id: 'inhalt/' + s.id, art: 'inhalt', name: s.title, ...gemeinsam, adresse });
    if (s.kind === 'mythos') add({ id: 'quest/' + s.id + '-mythos', art: 'quest', name: vorsatz + s.title, ...gemeinsam, adresse, staerke: 1 });
    if (s.exhibit) {
      const eid = 'erlebnis/' + s.exhibit;
      if (by[eid]) { W(`${eid}: Exponat steht an mehreren Stationen; es zählt nur die erste (${by[eid].adresse}).`); continue; }
      add({ id: eid, art: 'erlebnis', name: exTitel[s.exhibit] || s.exhibit, ...gemeinsam, adresse });
    }
  }

  // --- Kuratierte Schicht: Werkzeuge, Fähigkeiten
  for (const w of list(K.werkzeuge)) {
    if (!isObj(w) || !w.id) { W('werkzeuge: Eintrag ohne id übersprungen.'); continue; }
    add({ adresse: '#/reisepass', ...w, art: 'werkzeug' });
  }
  const geuebt = [];
  for (const s of list(K.skills)) {
    if (!isObj(s) || !s.id) { W('skills: Eintrag ohne id übersprungen.'); continue; }
    const { geuebt_durch, ...rest } = s;
    add({ ...rest, art: 'skill' });
    for (const x of list(geuebt_durch)) geuebt.push([s.id, x]);
  }
  for (const [skill, x] of geuebt) {
    if (!by[x]) { W(`skills: ${skill} nennt „${x}“ unter geuebt_durch, das es im Paket nicht gibt (übersprungen).`); continue; }
    by[x].uebt = uniq(list(by[x].uebt).concat(skill));
  }

  // --- Gewicht, Stärke, Aufgabe (Kern), dann Zuordnungsdateien
  for (const g of ['kritisch', 'optional', 'wesentlich']) {
    for (const id of list(K.gewichte && K.gewichte[g])) {
      if (!by[id]) { W(`gewichte.${g}: „${id}“ gibt es im Paket nicht (übersprungen).`); continue; }
      by[id].gewicht = g;
    }
  }
  for (const q of list(K.quests)) {
    if (!isObj(q) || !by[q.id]) { W(`quests: „${q && q.id}“ gibt es im Paket nicht (übersprungen).`); continue; }
    by[q.id].staerke = q.staerke;
  }
  for (const a of list(K.aufgaben)) {
    if (!isObj(a) || !by[a.id]) { W(`aufgaben: „${a && a.id}“ gibt es im Paket nicht (übersprungen).`); continue; }
    by[a.id].aufgabe = a.aufgabe;
  }
  if (!skelett) {
    const zu = readZuordnung(P, R);
    const normSkill = x => (String(x).includes('/') ? String(x) : 'skill/' + x);
    const normWerk = x => (String(x).includes('/') ? String(x) : 'werkzeug/' + x);
    for (const [k, t] of Object.entries(zu)) {
      const ziele = by[k] ? [by[k]] : [by['inhalt/' + k]].filter(Boolean);
      if (!ziele.length) { W(`spielplan-zuordnung: „${k}“ ist weder eine Station noch eine Einheit des Pakets (übersprungen).`); continue; }
      const inhalt = ziele[0];
      const station = inhalt.id.startsWith('inhalt/') ? inhalt.id.slice(7) : null;
      const quest = station && by['quest/' + station + '-mythos'];
      const erlebnis = station && stationenById[station] && stationenById[station].exhibit && by['erlebnis/' + stationenById[station].exhibit];
      if (t.uebt.length) inhalt.uebt = uniq(list(inhalt.uebt).concat(t.uebt.map(normSkill)));
      if (t.gewicht !== undefined) inhalt.gewicht = t.gewicht;
      if (t.staerke !== undefined) { const q = inhalt.art === 'quest' ? inhalt : quest; if (q) q.staerke = t.staerke; else W(`spielplan-zuordnung: ${k}: staerke ohne Mythos-Karte an dieser Station (übersprungen).`); }
      if (t.braucht.length) {
        const ziel = inhalt.art === 'quest' ? inhalt : (quest || erlebnis || inhalt);
        ziel.braucht = uniq(list(ziel.braucht).concat(t.braucht.map(normWerk)));
        if (ziel.art !== 'quest') W(`spielplan-zuordnung: ${k}: braucht gilt laut Standard 3.1 für Mythos-Karten; hier an ${ziel.id} gesetzt.`);
      }
    }
  }

  // --- Kopf
  const kopf = {
    format: 'spielplan/0', id: K.id || 'museum-' + (pack.id || P.name), name: K.name || pack.title || P.name,
    basis: K.basis || 'https://zukunftsgut.org/spielplan/museum-' + (pack.id || P.name) + '/',
    nur_lokal: K.nur_lokal === undefined ? false : K.nur_lokal,
    stufen: K.stufen || { anteil: '2/3', bis: 2 },
    begriffe: K.begriffe || GENERISCH,
    rhythmus: K.rhythmus || { takt: { laenge: 'woche', beginn: 'erstes-ereignis' }, wiederkehr: { abstand_tage: [2, 7, 21, 60], fuer: { art: 'inhalt' } }, verfall_tage: 90 }
  };
  if (!K.begriffe) {
    const v = pack.vocab || {};
    if (v.journey) kopf.begriffe = { ...GENERISCH, episode: { ...GENERISCH.episode, sg: v.journey, pl: v.journeys || v.journey } };
    if (v.station) kopf.begriffe = { ...kopf.begriffe, inhalt: { ...GENERISCH.inhalt, sg: v.station, pl: v.stations || v.station } };
    if (v.exhibit) kopf.begriffe = { ...kopf.begriffe, erlebnis: { ...GENERISCH.erlebnis, sg: v.exhibit, pl: v.exhibits || v.exhibit } };
  }
  for (const k of Object.keys(K)) {
    if (!['format', 'id', 'name', 'basis', 'nur_lokal', 'stufen', 'begriffe', 'rhythmus', 'gebiete', 'episoden_zusatz', 'gewichte', 'quests', 'aufgaben', 'skills', 'werkzeuge', 'regeln', 'quest_vorsatz', 'einheiten'].includes(k) && !k.startsWith('_')) {
      W(`${kernDatei || 'Kern'}: unbekannter Abschnitt „${k}“ wird nicht übernommen.`);
    }
  }
  // zusätzliche Einheiten des Kerns (freie Form), z. B. Querthemen, die die Ableitung nicht kennt
  for (const u of list(K.einheiten)) if (isObj(u) && u.id) add(clone(u));

  const spielplan = { ...kopf, einheiten: einheiten.map(ordered), regeln: skelett ? [] : clone(list(K.regeln)) };
  const out = {};
  for (const k of HEAD_ORDER) out[k] = spielplan[k];
  return { R, spielplan: out };
}

export function leseKern(P, R) {
  for (const n of ['spielplan-kern.yaml', 'spielplan-kern.yml', 'spielplan-kern.json']) {
    const f = path.join(P.dir, n);
    if (!fs.existsSync(f)) continue;
    try { return { kern: parseDatei(fs.readFileSync(f, 'utf8'), P.rel(n)), datei: P.rel(n) }; }
    catch (e) { if (e instanceof YamlFehler) { R.err(`${P.rel(n)}: ${e.message}`); return { kern: null, datei: P.rel(n) }; } throw e; }
  }
  return { kern: null, datei: '' };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const pos = argv.filter(a => !a.startsWith('--'));
  const flags = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
  if (!pos.length) {
    console.error('Aufruf: node tools/spielplan-aus-plan.mjs <paket> [--skelett] [--out=datei] [--stdout] [--trotzdem]\n  Erzeugt packs/<paket>/spielplan.json aus plan.json, spielplan-kern.yaml und spielplan-zuordnung/*.json.');
    process.exit(2);
  }
  const P = resolvePack(pos[0]);
  if (!fs.existsSync(P.dir)) { console.error(`✗ Paketordner nicht gefunden: ${path.relative(ROOT, P.dir)}`); process.exit(2); }
  const skelett = flags.skelett === true;
  const R0 = newReport();
  const { kern, datei } = skelett ? { kern: null, datei: '' } : leseKern(P, R0);
  if (!skelett && !kern && !R0.errors.length) console.error(`! Kein spielplan-kern.yaml in ${path.relative(ROOT, P.dir)}: es entsteht ein Plan ohne Regeln (wie --skelett, aber mit den Zuordnungsdateien).`);
  const { R, spielplan } = leiteAb(P, { skelett, kern, kernDatei: datei });
  R.errors.unshift(...R0.errors);
  let pruef = { fehler: [], warnungen: [], info: {} };
  if (spielplan && !R.errors.length) pruef = ladeKern().Spielplan.pruefe(spielplan);
  const fehler = R.errors.concat(pruef.fehler), warn = R.warnings.concat(pruef.warnungen);
  for (const w of warn) console.error('! Warnung: ' + w);
  for (const e of fehler) console.error('✗ Fehler: ' + e);
  const text = spielplan ? JSON.stringify(spielplan, null, 2) + '\n' : '';
  const ziel = typeof flags.out === 'string' ? path.resolve(flags.out) : path.join(P.dir, 'spielplan.json');
  if (fehler.length && flags.trotzdem !== true) {
    console.error(`\n${fehler.length} Fehler${warn.length ? `, ${warn.length} Warnungen` : ''}: es wurde nichts geschrieben (--trotzdem schreibt doch).`);
    process.exit(1);
  }
  if (flags.stdout === true) process.stdout.write(text);
  else {
    fs.writeFileSync(ziel, text);
    const i = pruef.info || {};
    const arten = Object.entries(i.arten || {}).filter(([, n]) => n).map(([a, n]) => `${n} ${a}`).join(', ');
    console.log(`✓ ${path.relative(ROOT, ziel)}: ${spielplan.einheiten.length} Einheiten (${arten}), ${spielplan.regeln.length} Regeln${skelett ? ' (Skelett: alles offen)' : ''}${warn.length ? `, ${warn.length} Warnungen` : ''}`);
  }
}

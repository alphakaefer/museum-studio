#!/usr/bin/env node
// Museum Studio – Spielplan aus dem Stationsplan ableiten (Format spielplan/0, Entscheidungen E1 bis E12 in docs/spielplan-auslegung.md).
//
//   node tools/spielplan-aus-plan.mjs <paket> [--auto | --skelett] [--kern=datei] [--wege] [--minuten=4] [--out=datei] [--stdout] [--trotzdem]
//
// Erzeugt packs/<paket>/spielplan.json (kanonisches JSON, deterministisch; der Zusammenbau liefert es als data/spielplan.js aus) aus
//   plan.json + journeys.js + pack.json      die mechanisch ableitbaren Einheiten (Auslegung E1 in docs/spielplan-auslegung.md)
//   stationen/*.js                           (nur lesend) Mythos-Karten (Feld myth) und Teaser für Texte
//   spielplan-kern.yaml (oder .json)         die kuratierte Schicht von Hand: gebiete, episoden_zusatz, gewichte, quests, aufgaben, skills,
//                                            werkzeuge, regeln, rhythmus, stufen, begriffe, offen, einheiten (Vorlage: docs/spielplan-vorlage-kern.yaml)
//   spielplan-zuordnung/*.json               Zuordnung je Station: uebt, braucht, staerke, gewicht (siehe unten)
// Betriebsarten:
//   (ohne Schalter)  nur das Mechanische plus die kuratierte Schicht: ohne Kern entstehen Einheiten ohne Regeln (alles offen).
//   --auto           ein spielbarer Standard-Spielplan ohne jede Handarbeit (siehe unten). Ist ein Kern da, überschreibt er die Automatik
//                    abschnittsweise; was er ersetzt, steht als Hinweis in der Ausgabe.
//   --skelett        ohne kuratierte Schicht, ohne Automatik: alles offen, keine Regeln. Nur zum Testen der Oberfläche.
//   --kern=datei     eine andere Kern-Datei als packs/<paket>/spielplan-kern.yaml.
// Das Ergebnis wird mit Spielplan.pruefe (engine/js/spielplan.js) geprüft; bei Fehlern wird nichts geschrieben (--trotzdem schreibt doch).
// Danach steht ein kurzer Bericht: was beim Start offen ist, wie viele Regeln eine gesperrte Reise hat, wie viele Schritte es dauert, wenn man
// jeweils der einen nächsten Aufgabe folgt (--minuten=4 rechnet die Zeit je Schritt, --wege prüft zusätzlich, ob eine einzelne Einheit etwas für
// immer sperren könnte; beides Rechnung mit dem Kern, keine Messung mit Menschen).
//
// Ableitung (je Quelle eine Einheit):
//   gebiete[]                      gebiet/<name>         (aus dem Kern oder der Automatik)
//   journeys.js + episoden_zusatz  episode/<reise-id>    in: Gebiet, etappe, reihenfolge, auftakt, abschluss, sichtbar; adresse #/reise/<id>
//   plan.stations                  inhalt/<id>           name = Titel, in = Reisen (Text bei einer), reihenfolge = Platz in der ersten Reise,
//                                                        adresse #/station/<id>
//   Stationen mit myth (Kind mythos)  quest/<id>-mythos  name = „Mythos-Check: “ + Titel, in wie die Station, staerke aus Kern, Zuordnung oder Automatik
//   Stationen mit exhibit          erlebnis/<exponat>    name = Exponat-Titel (aus exhibits/<id>.js), in wie die Station
//   Stationen einer Werkzeug-Reise werkzeug/<id>         (journeys.js: tool: true; nur Stationen der Arten konzept, methode, instrument)
//   werkzeuge[], skills[]          werkzeug/…, skill/…   skills.geuebt_durch setzt uebt an den genannten Einheiten
//   gewichte, aufgaben             gewicht und aufgabe an der Einheit (alles Übrige ist wesentlich)
//   regeln, rhythmus, stufen, begriffe, nur_lokal, basis   unverändert in den Kopf (nur_lokal gilt ohne Angabe als true: das Museum sendet nichts)
// Die Automatik (--auto) kennt keine Fachbegriffe; alle Texte entstehen aus Namen, Tagline, Einleitung und Ausblick der Reisen und aus Stationstiteln:
//   Gebiete       aus den Reisetypen (je Typ eines; ab sechs Reisen eines Typs geteilt in Teile zu höchstens fünf); bei einer einzigen Reise keines
//   Etappen       erste Reise onboarding, historische Reisen entdecken, die übrigen scaffolding, die letzte nicht historische Reise endgame (nur wenn eine
//                 Mythos-Karte in ihr zu Hause ist, sonst scaffolding); Stärke der Mythos-Karte nach der Etappe der Heimat-Reise: 1, 2, 3
//   Start         ein Drittel der Reisen offen (mindestens eine, höchstens vier), verteilt über die Gebiete; die übrigen angedeutet gesperrt
//   Wege          jede gesperrte Reise hat mindestens zwei Regeln (Alternativen): die erste gesperrte schon nach zwei Stationen der ersten Reise;
//                 die vorige Reise auf Stufe 2; eine Kreuzungsstation (zu einer früheren oder offenen Reise); ein Exponat einer früheren oder offenen
//                 Reise; als letzte Rückfalloption der nächste Takt (die Zeit allein öffnet). Eine einzige Reise wird in drei Kapitel geteilt.
//   Gewicht       Stationen auf mehr als einer Reise und die zwei ersten Stationen einer Reise kritisch; Mythos-Karten und ihre Stationen wesentlich;
//                 Stationen, deren why-Feld „Vertiefung“ nennt, optional; alles übrige wesentlich
//   Werkzeuge     je Station einer Werkzeug-Reise ein Werkzeug, offen nach der Station (Moment: „Neu in deiner Ausrüstung“), als Nebenquest
//   Skills        keine: ein Skill braucht ein „Ich kann …“, das Menschen schreiben
//   Rhythmus      Takt Woche, Wiederkehr nach 2, 7, 21 Tagen, Verwitterung nach 35 Tagen; Stufen: zwei Drittel, höchste Stufe 2 (Museum)
// Zuordnungsdateien (JSON): { "<station-id>": { uebt, braucht, staerke, gewicht, name, reihenfolge }, … } oder eine Liste von Einträgen mit "station" statt des Schlüssels;
//   der Schlüssel darf auch eine volle Einheiten-id sein (z. B. "quest/<station>-mythos"). uebt nennt Skills, braucht Werkzeuge (kurze Namen
//   ohne Art werden zu skill/… bzw. werkzeug/…). Mehrere Dateien werden in Namensfolge gemischt; Listen vereinigen sich, Einzelwerte überschreiben.
// Nur Node-Standardbibliothek und die Werkzeuge in tools/.
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { newReport, ROOT, isMain, resolvePack, loadPackJson, loadPlan, loadJourneysJs, loadStations } from './check-lib.mjs';
import { parseDatei, YamlFehler } from './yaml-lite.mjs';
import { ladeKern, berichtZeilen } from './check-spielplan.mjs';

const KEY_ORDER = ['id', 'art', 'name', 'sorte', 'in', 'etappe', 'gewicht', 'staerke', 'sichtbar', 'reihenfolge', 'adresse', 'kann', 'bereich',
  'uebt', 'braucht', 'nach', 'aus', 'herkunft', 'kurz', 'einsatz', 'aufgabe', 'auftakt', 'abschluss', 'material'];
const HEAD_ORDER = ['format', 'id', 'name', 'basis', 'nur_lokal', 'stufen', 'begriffe', 'rhythmus', 'einheiten', 'regeln'];
const RULE_ORDER = ['id', 'schaltet', 'wenn', 'enthuellung'];
const WHEN_ORDER = ['alle', 'eine', 'mindestens', 'von', 'einheit', 'art', 'in', 'stufe', 'offen', 'takt', 'ab', 'wartezeit'];
const KERN_ABSCHNITTE = ['format', 'id', 'name', 'basis', 'nur_lokal', 'stufen', 'begriffe', 'rhythmus', 'gebiete', 'episoden_zusatz', 'gewichte', 'quests', 'aufgaben',
  'skills', 'werkzeuge', 'regeln', 'quest_vorsatz', 'einheiten', 'offen'];
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
/** Schlüssel einer bedingung in feste Reihenfolge (rekursiv), damit die Ausgabe immer gleich aussieht. */
function geordnet(x, reihenfolge) {
  if (Array.isArray(x)) return x.map(v => geordnet(v, reihenfolge));
  if (!isObj(x)) return x;
  const o = {};
  for (const k of reihenfolge) if (x[k] !== undefined) o[k] = geordnet(x[k], WHEN_ORDER);
  for (const k of Object.keys(x)) if (!(k in o)) o[k] = geordnet(x[k], WHEN_ORDER);
  return o;
}
function geordneteRegel(r) {
  const o = {};
  for (const k of RULE_ORDER) if (r[k] !== undefined) o[k] = k === 'wenn' ? geordnet(r[k], WHEN_ORDER) : r[k];
  for (const k of Object.keys(r)) if (!(k in o)) o[k] = r[k];
  return o;
}

/* ------------------------------------------------------------------------------------------------ Texte (ohne Fachbezug) */

const q = t => '„' + t + '“';
const endePunkt = t => { t = String(t || '').trim(); return !t ? '' : /[.!?…]$/.test(t) ? t : t + '.'; };
const gross = t => t.charAt(0).toUpperCase() + t.slice(1);
const slug = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
/** „A“, „B“ und „C“ */
function aufzaehlung(namen) {
  const z = namen.map(q);
  return z.length <= 1 ? (z[0] || '') : z.slice(0, -1).join(', ') + ' und ' + z[z.length - 1];
}
/** Die ersten n Sätze eines Textes (für Auftakt und Abschluss aus Einleitung und Ausblick). */
function saetze(text, n) {
  const t = String(text || '').trim();
  if (!t) return '';
  const teile = t.match(/[^.!?]+[.!?]+(?:["“”»«]+)?(?:\s+|$)/g);
  if (!teile) return t;
  return teile.slice(0, n).join('').trim();
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
      if (e.name !== undefined) t.name = e.name;
      if (e.reihenfolge !== undefined) t.reihenfolge = e.reihenfolge;
    }
  }
  return res;
}

const GENERISCH = {
  gebiet: { art: 'das', sg: 'Gebiet', pl: 'Gebiete' }, episode: { art: 'die', sg: 'Reise', pl: 'Reisen' }, inhalt: { art: 'die', sg: 'Station', pl: 'Stationen' },
  quest: { art: 'die', sg: 'Mythos-Karte', pl: 'Mythos-Karten' }, erlebnis: { art: 'das', sg: 'Exponat', pl: 'Exponate' },
  werkzeug: { art: 'das', sg: 'Werkzeug', pl: 'Werkzeuge' }, skill: { art: 'die', sg: 'Fähigkeit', pl: 'Fähigkeiten' }
};
const STANDARD_RHYTHMUS = { takt: { laenge: 'woche', beginn: 'erstes-ereignis' }, wiederkehr: { abstand_tage: [2, 7, 21], fuer: { art: 'inhalt' } }, verfall_tage: 35 };
const STANDARD_STUFEN = { anteil: '2/3', bis: 2 };
const WERKZEUG_KINDS = { konzept: 'modell', methode: 'methode', instrument: 'technik' };   // Art der Station -> Sorte des Werkzeugs; andere Arten sind keine Werkzeuge

/** Wörter der Arten für die Sätze des Kerns: aus pack.vocab (journey, station, exhibit); der Artikel steht nur für die Standardwörter fest. */
function begriffeAusPack(pack, hinweis) {
  const v = pack.vocab || {}, b = clone(GENERISCH);
  const paare = [['episode', 'journey', 'journeys', 'Reise'], ['inhalt', 'station', 'stations', 'Station'], ['erlebnis', 'exhibit', 'exhibits', 'Exponat']];
  for (const [art, k, kp, standard] of paare) {
    if (!v[k] || typeof v[k] !== 'string') continue;
    b[art] = { ...b[art], sg: v[k], pl: typeof v[kp] === 'string' ? v[kp] : v[k] };
    if (v[k] !== standard) {
      if (['der', 'die', 'das'].includes(v[k + 'Article'])) b[art].art = v[k + 'Article'];
      else hinweis(`vocab.${k} „${v[k]}“ weicht vom Standardwort ab: der Artikel ist nicht bekannt, es gilt „${b[art].art}“. Setze vocab.${k}Article (der, die oder das) in pack.json oder begriffe im Kern.`);
    }
  }
  return b;
}

/* ------------------------------------------------------------------------------------------------ Daten laden */

function ladeDaten(P, R) {
  const pack = loadPackJson(P, R) || {};
  const plan = loadPlan(P, R);
  const journeys = loadJourneysJs(P, R) || [];
  let text = {};
  try { text = loadStations(P, newReport()).all || {}; } catch { text = {}; }
  return { pack, plan, journeys, text };
}

const istMythos = (s, text) => s.kind === 'mythos' || (text[s.id] && isObj(text[s.id].myth));

/* ------------------------------------------------------------------------------------------------ Automatik (--auto) */

/**
 * Baut aus dem Stationsplan eine kuratierte Schicht im Format des Kerns (gebiete, episoden_zusatz, gewichte, quests, regeln, rhythmus, stufen, begriffe).
 * Alles hängt an den Paketdaten; es kommen keine Fachtexte vor. Liefert { kern, meta } (meta für Bericht und Tests).
 */
export function autoKern(D, hinweis = () => {}) {
  const { pack, plan, journeys, text } = D;
  const n = journeys.length;
  const jIdx = Object.fromEntries(journeys.map((j, i) => [j.id, i]));
  const stationen = plan.stations;
  const sById = Object.fromEntries(stationen.map(s => [s.id, s]));
  const reihe = id => (plan.orders && Array.isArray(plan.orders[id]) ? plan.orders[id] : stationen.filter(s => (s.journeys || []).includes(id)).map(s => s.id));
  const istHist = i => journeys[i].typ === 'historisch';
  const reisenVon = s => (s.journeys || []).filter(j => j in jIdx).map(j => jIdx[j]);
  const heimat = s => { const r = reisenVon(s); return r.length ? r[0] : -1; };
  const vocab = pack.vocab || {};

  // --- Gebiete aus den Reisetypen
  const gruppen = [];
  journeys.forEach((j, i) => { const typ = j.typ || 'funktional'; let g = gruppen.find(x => x.typ === typ); if (!g) gruppen.push(g = { typ, idx: [] }); g.idx.push(i); });
  const typName = typ => {
    const t = pack.journeyTypes && pack.journeyTypes[typ];
    if (typeof t === 'string' && t.trim()) return t.trim();
    if (isObj(t) && typeof t.pl === 'string') return t.pl;
    return gross(typ) + 'e ' + (vocab.journeys || 'Reisen');
  };
  const typUnter = typ => { const t = pack.journeyTypes && pack.journeyTypes[typ]; return isObj(t) && typeof t.sub === 'string' ? t.sub.trim() : ''; };
  const gebiete = [], gebietVon = {}, teile = [];
  if (n >= 2) {
    for (const g of gruppen) {
      const k = g.idx.length > 5 ? Math.ceil(g.idx.length / 4) : 1;
      let start = 0;
      for (let c = 0; c < k; c++) {
        const len = Math.floor(g.idx.length / k) + (c < g.idx.length % k ? 1 : 0);
        const idx = g.idx.slice(start, start + len); start += len;
        teile.push(idx);
        if (idx.length < 2) continue;                      // ein Gebiet mit einer einzigen Reise sagt nichts, was die Reise nicht schon sagt
        const id = 'gebiet/' + slug(g.typ) + (k > 1 ? '-' + (c + 1) : '');
        const namen = idx.map(i => journeys[i].name);
        const unter = typUnter(g.typ);
        gebiete.push({
          id, name: typName(g.typ) + (k > 1 ? ` – Teil ${c + 1}` : ''), reihenfolge: gebiete.length + 1,
          auftakt: `${unter ? endePunkt(unter) + ' ' : ''}Hier liegen ${aufzaehlung(namen)}.`,
          abschluss: 'Dieses Gebiet kennst du jetzt gut genug, um dich darin frei zu bewegen.'
        });
        idx.forEach(i => { gebietVon[i] = id; });
      }
    }
  } else teile.push(n ? [0] : []);

  // --- Etappen und Stärke der Mythos-Karten
  const etappe = journeys.map((j, i) => (i === 0 ? 'onboarding' : istHist(i) ? 'entdecken' : 'scaffolding'));
  let letzteFunktional = -1;
  journeys.forEach((j, i) => { if (i > 0 && !istHist(i)) letzteFunktional = i; });
  const mythosVon = i => stationen.filter(s => istMythos(s, text) && heimat(s) === i);
  if (letzteFunktional > 0) {
    if (mythosVon(letzteFunktional).length) etappe[letzteFunktional] = 'endgame';
    else hinweis(`Etappe: „${journeys[letzteFunktional].name}“ ist die letzte Reise, hat aber keine Mythos-Karte zu Hause; sie bleibt scaffolding (endgame braucht eine Quest der Stärke 3).`);
  }
  const staerkeVon = e => (e === 'endgame' ? 3 : e === 'scaffolding' ? 2 : 1);
  if (n && !mythosVon(0).length) hinweis(`Etappe onboarding: In „${journeys[0].name}“ ist keine Mythos-Karte zu Hause; die Prüfung warnt dann (3.3: kurzer Einstieg mit Quest der Stärke 1). Eine Mythos-Karte (Feld myth) in einer der ersten Stationen behebt das.`);
  const quests = [];
  for (const s of stationen) if (istMythos(s, text)) { const h = heimat(s); quests.push({ id: 'quest/' + s.id + '-mythos', staerke: h >= 0 ? staerkeVon(etappe[h]) : 1 }); }

  // --- Gewicht
  const kritisch = new Set(), optional = new Set(), mythos = new Set();
  journeys.forEach(j => reihe(j.id).slice(0, 2).forEach(id => kritisch.add(id)));
  for (const s of stationen) {
    if (reisenVon(s).length > 1) kritisch.add(s.id);
    if (istMythos(s, text)) mythos.add(s.id);
    if (/vertief/i.test(String(s.why || ''))) optional.add(s.id);
  }
  const istKritisch = id => kritisch.has(id) && !mythos.has(id) && !optional.has(id);
  const gewichte = { kritisch: [], optional: [], wesentlich: [] };
  for (const s of stationen) {
    const id = 'inhalt/' + s.id;
    if (optional.has(s.id)) gewichte.optional.push(id);
    else if (istKritisch(s.id)) gewichte.kritisch.push(id);
  }

  // --- Start: ein Drittel der Reisen offen, verteilt über die Gebiete
  const m = n <= 1 ? n : Math.min(4, Math.max(1, Math.round(n / 3)));
  const offen = new Set(n ? [0] : []);
  for (const durchgang of ['erste', 'mitte', 'letzte']) {
    for (const g of teile) {
      if (offen.size >= m || !g.length) break;
      offen.add(durchgang === 'erste' ? g[0] : durchgang === 'mitte' ? g[Math.floor(g.length / 2)] : g[g.length - 1]);
    }
  }
  const gesperrt = journeys.map((j, i) => i).filter(i => !offen.has(i));

  // --- Regeln
  const regeln = [];
  const tagline = i => endePunkt(journeys[i].tagline);
  const mitTag = (satz, i) => [satz, tagline(i)].filter(Boolean).join(' ');
  const exTitel = exhibitTitles(D.P, uniq(stationen.map(s => s.exhibit).filter(Boolean)));
  const titelVon = id => (sById[id] && sById[id].title) || id;
  const wege = {};     // episode-id -> Liste der Wege (für den Bericht)
  const frueherOderOffen = (j, i) => offen.has(j) || j < i;

  if (n >= 2) {
    const erste2 = reihe(journeys[0].id).slice(0, 2);
    const genutzt = new Set();       // Schlüssel (Kreuzungsstationen, Exponate) öffnen möglichst nur eine Reise: sonst öffnet eine Station alles auf einmal
    gesperrt.forEach((i, ord) => {
      const Z = journeys[i], zid = 'episode/' + Z.id, vor = i - 1, wege_ = [];
      const weg = (name, wenn, satz, notwendig) => { wege_.push({ name, wenn, satz, notwendig: new Set(notwendig) }); };
      const kritischIn = jid => reihe(jid).filter(istKritisch).map(sid => 'inhalt/' + sid);
      // 1. die erste gesperrte Reise geht früh auf: der Moment des Onboardings (zwei Stationen der ersten Reise)
      if (ord === 0 && erste2.length) {
        const wenn = erste2.length === 1 ? { einheit: 'inhalt/' + erste2[0], stufe: 2 } : { alle: erste2.map(id => ({ einheit: 'inhalt/' + id, stufe: 2 })) };
        weg('schnell', wenn, `Zwei Stationen, und schon bewegt sich etwas: ${q(Z.name)} steht dir jetzt offen.`, erste2.map(id => 'inhalt/' + id));
      }
      // 2. die vorige Reise auf Stufe 2 (entfällt, wenn der schnelle Weg sie ohnehin einschließt)
      if (!(ord === 0 && vor === 0)) weg('weiter', { einheit: 'episode/' + journeys[vor].id, stufe: 2 }, `${q(journeys[vor].name)} liegt hinter dir – und dahinter öffnet sich ${q(Z.name)}.`, kritischIn(journeys[vor].id));
      // 3. eine Kreuzungsstation zu einer früheren oder offenen Reise
      const kand = [];
      reihe(Z.id).forEach((sid, pos) => {
        const st = sById[sid];
        if (!st) return;
        const partner = reisenVon(st).filter(j => j !== i && frueherOderOffen(j, i));
        if (!partner.length) return;
        kand.push({ sid, partner, pos, optional: optional.has(sid), genutzt: genutzt.has('inhalt/' + sid), imSchnellen: ord === 0 && erste2.includes(sid), nurVor: partner.every(p => p === vor), kritisch: istKritisch(sid), anfangs: partner.some(p => offen.has(p)) });
      });
      kand.sort((a, b) => (a.optional - b.optional) || (a.genutzt - b.genutzt) || (a.imSchnellen - b.imSchnellen) || (a.nurVor - b.nurVor) || (b.anfangs - a.anfangs) || (a.kritisch - b.kritisch) || a.pos - b.pos);
      const kreuzung = c => { genutzt.add('inhalt/' + c.sid); return c; };
      if (kand.length) { const c = kreuzung(kand.shift()); weg('kreuzung', { einheit: 'inhalt/' + c.sid, stufe: 2 }, `Hier kreuzen sich zwei Wege: ${q(Z.name)} steht dir jetzt offen.`, ['inhalt/' + c.sid]); }
      // 4. ein Exponat einer früheren oder offenen Reise
      const ex = [];
      stationen.forEach((st, pos) => {
        if (!st.exhibit) return;
        const rs = reisenVon(st);
        const partner = rs.filter(j => j !== i && frueherOderOffen(j, i));
        if (!partner.length || (rs.length === 1 && rs[0] === i)) return;
        ex.push({ sid: st.id, exhibit: st.exhibit, pos, genutzt: genutzt.has('erlebnis/' + st.exhibit), nurVor: partner.every(p => p === vor), anfangs: partner.some(p => offen.has(p)) });
      });
      ex.sort((a, b) => (a.genutzt - b.genutzt) || (a.nurVor - b.nurVor) || (b.anfangs - a.anfangs) || a.pos - b.pos);
      if (ex.length) { genutzt.add('erlebnis/' + ex[0].exhibit); weg('exponat', { einheit: 'erlebnis/' + ex[0].exhibit, stufe: 2 }, `${q(exTitel[ex[0].exhibit] || titelVon(ex[0].sid))} hat etwas freigelegt: Ab jetzt steht dir ${q(Z.name)} offen.`, ['erlebnis/' + ex[0].exhibit]); }
      // 5. Hängt jeder Weg an derselben Einheit (oder gibt es nur einen), kommt eine zweite Kreuzung, zuletzt die Zeit allein (niemand steht für immer vor einer Tür)
      const gemeinsam = () => { const [e0, ...rest] = wege_.map(w => w.notwendig); return e0 ? [...e0].filter(x => rest.every(r => r.has(x))) : []; };
      if ((wege_.length < 2 || gemeinsam().length) && kand.length) {
        const c = kreuzung(kand.find(x => !gemeinsam().includes('inhalt/' + x.sid)) || kand[0]);
        weg('kreuzung-2', { einheit: 'inhalt/' + c.sid, stufe: 2 }, `Hier kreuzen sich zwei Wege: ${q(Z.name)} steht dir jetzt offen.`, ['inhalt/' + c.sid]);
      }
      if (wege_.length < 2 || gemeinsam().length) weg('takt', { takt: ord + 2 }, `Eine neue Woche, ein neuer Weg: ${q(Z.name)} ist von selbst aufgegangen.`, []);
      wege_.forEach(w => regeln.push({ id: `auf-${slug(Z.id)}-${w.name}`, schaltet: [zid], wenn: w.wenn, enthuellung: mitTag(w.satz, i) }));
      wege[zid] = wege_.map(w => w.name);
    });
  } else if (n === 1) {
    // Eine einzige Reise: drei Kapitel; das nächste geht auf, wenn zwei Stationen des vorigen geschafft sind (oder ein Exponat des vorigen Kapitels, oder nach einer Woche)
    const st = reihe(journeys[0].id);
    if (st.length >= 6) {
      const k = 3, teilen = [];
      let start = 0;
      for (let c = 0; c < k; c++) { const len = Math.floor(st.length / k) + (c < st.length % k ? 1 : 0); teilen.push(st.slice(start, start + len)); start += len; }
      for (let c = 1; c < k; c++) {
        const vorher = teilen[c - 1];
        const ziele = [];
        for (const sid of teilen[c]) {
          ziele.push('inhalt/' + sid);
          if (istMythos(sById[sid], text)) ziele.push('quest/' + sid + '-mythos');
          if (sById[sid].exhibit) ziele.push('erlebnis/' + sById[sid].exhibit);
        }
        const satz = `Das nächste Kapitel von ${q(journeys[0].name)} geht auf: ${teilen[c].length} neue Stationen, zum Beispiel ${q(titelVon(teilen[c][0]))}.`;
        const weg = [];
        const r = (w, wenn, txt) => { weg.push(w); regeln.push({ id: `kapitel-${c + 1}-${w}`, schaltet: uniq(ziele), wenn, enthuellung: txt }); };
        r('stationen', { mindestens: Math.min(2, Math.ceil(vorher.length / 2)), von: vorher.map(id => ({ einheit: 'inhalt/' + id, stufe: 2 })) }, satz);
        const ex = vorher.map(id => sById[id]).find(s => s && s.exhibit);          // ein Exponat des vorigen Kapitels (nicht eines früheren: sonst öffnet eines alles)
        if (ex) r('exponat', { einheit: 'erlebnis/' + ex.exhibit, stufe: 2 }, `${q(exTitel[ex.exhibit] || ex.title)} hat etwas freigelegt. ${satz}`);
        else r('takt', { takt: c + 1 }, `Eine neue Woche, ein neues Kapitel. ${satz}`);
        wege['kapitel-' + (c + 1)] = weg;
      }
    }
  }

  // --- Werkzeuge: je Station einer Werkzeug-Reise offen nach der Station (die Einheiten selbst entstehen in der Ableitung)
  const werkzeugStationen = [];
  journeys.forEach(j => { if (j.tool === true) for (const sid of reihe(j.id)) { const s = sById[sid]; if (s && WERKZEUG_KINDS[s.kind] && !werkzeugStationen.includes(sid)) werkzeugStationen.push(sid); } });
  for (const sid of werkzeugStationen) {
    const t = text[sid] && typeof text[sid].teaser === 'string' ? text[sid].teaser.trim() : '';
    regeln.push({ id: 'werkzeug-' + sid, schaltet: ['werkzeug/' + sid], wenn: { einheit: 'inhalt/' + sid, stufe: 2 }, enthuellung: ['Neu in deiner Ausrüstung: ' + q(titelVon(sid)) + '.', endePunkt(t)].filter(Boolean).join(' ') });
  }

  const kern = {
    gebiete, episoden_zusatz: journeys.map((j, i) => ({ id: 'episode/' + j.id, ...(gebietVon[i] ? { gebiet: gebietVon[i] } : {}), etappe: etappe[i] })),
    gewichte, quests, regeln, rhythmus: clone(STANDARD_RHYTHMUS), stufen: clone(STANDARD_STUFEN), begriffe: begriffeAusPack(pack, hinweis)
  };
  const meta = { offen: [...offen].map(i => journeys[i].id), gesperrt: gesperrt.map(i => journeys[i].id), etappen: Object.fromEntries(journeys.map((j, i) => [j.id, etappe[i]])), wege, werkzeuge: werkzeugStationen.length };
  return { kern, meta };
}

/* ------------------------------------------------------------------------------------------------ Kern über Automatik legen */

/** Legt die kuratierte Schicht K über die Automatik A (Abschnitt für Abschnitt) und nennt, was sie ersetzt. */
export function vereine(A, K, hinweis) {
  const E = { ...A };
  const normEp = id => (String(id).includes('/') ? String(id) : 'episode/' + id);
  const normGeb = id => (String(id).includes('/') ? String(id) : 'gebiet/' + id);
  for (const k of ['id', 'name', 'basis', 'nur_lokal', 'stufen', 'begriffe', 'rhythmus', 'quest_vorsatz']) {
    if (K[k] !== undefined) { if (A[k] !== undefined && JSON.stringify(A[k]) !== JSON.stringify(K[k])) hinweis(`Kern ersetzt ${k} der Automatik.`); E[k] = K[k]; }
  }
  if (K.gebiete !== undefined) {
    if (list(A.gebiete).length) hinweis(`Kern ersetzt die ${list(A.gebiete).length} automatischen Gebiete durch ${list(K.gebiete).length}.`);
    E.gebiete = K.gebiete;
  }
  const zus = new Map();
  for (const e of list(A.episoden_zusatz)) if (isObj(e) && e.id) zus.set(normEp(e.id), { ...e, id: normEp(e.id) });
  for (const e of list(K.episoden_zusatz)) {
    if (!isObj(e) || !e.id) continue;
    const id = normEp(e.id), alt = zus.get(id);
    if (alt) { const f = Object.keys(e).filter(k => k !== 'id' && alt[k] !== undefined && JSON.stringify(alt[k]) !== JSON.stringify(e[k])); if (f.length) hinweis(`Kern ersetzt bei ${id}: ${f.join(', ')}.`); }
    zus.set(id, { ...(alt || {}), ...e, id });
  }
  const gebietIds = new Set(list(E.gebiete).filter(g => isObj(g) && g.id).map(g => g.id));
  for (const [id, e] of zus) if (e.gebiet && !gebietIds.has(normGeb(e.gebiet))) { hinweis(`${id}: Gebiet „${e.gebiet}“ gibt es nicht mehr (Kern ersetzt die Gebiete); die Reise liegt in keinem Gebiet.`); delete e.gebiet; }
  E.episoden_zusatz = [...zus.values()];
  const gew = { kritisch: list(A.gewichte && A.gewichte.kritisch).slice(), optional: list(A.gewichte && A.gewichte.optional).slice(), wesentlich: list(A.gewichte && A.gewichte.wesentlich).slice() };
  for (const g of ['kritisch', 'optional', 'wesentlich']) for (const id of list(K.gewichte && K.gewichte[g])) {
    for (const h of ['kritisch', 'optional', 'wesentlich']) { const p = gew[h].indexOf(id); if (p >= 0 && h !== g) { gew[h].splice(p, 1); hinweis(`Kern setzt ${id} auf ${g} (Automatik: ${h}).`); } }
    if (!gew[g].includes(id)) gew[g].push(id);
  }
  E.gewichte = gew;
  const nachId = (a, b, wasName) => {
    const mm = new Map(list(a).filter(x => isObj(x) && x.id).map(x => [x.id, x]));
    for (const x of list(b)) if (isObj(x) && x.id) { if (mm.has(x.id) && JSON.stringify(mm.get(x.id)) !== JSON.stringify(x)) hinweis(`Kern ersetzt ${wasName} ${x.id} der Automatik.`); mm.set(x.id, { ...(mm.get(x.id) || {}), ...x }); }
    return [...mm.values()];
  };
  E.quests = nachId(A.quests, K.quests, 'quest');
  E.aufgaben = nachId(A.aufgaben, K.aufgaben, 'aufgabe');
  E.skills = nachId(A.skills, K.skills, 'skill');
  E.werkzeuge = nachId(A.werkzeuge, K.werkzeuge, 'werkzeug');
  E.einheiten = nachId(A.einheiten, K.einheiten, 'einheit');
  // Regeln: Regeln des Kerns gehen vor; Regeln der Automatik für dieselben Ziele entfallen, ebenso für Einheiten, die der Kern offen lässt
  const offenKern = new Set(list(K.offen).map(x => String(x)));
  const kernZiele = new Set();
  for (const r of list(K.regeln)) if (isObj(r)) for (const z of list(r.schaltet)) kernZiele.add(z);
  const kernRegelIds = new Set(list(K.regeln).filter(isObj).map(r => r.id));
  const behalten = [];
  for (const r of list(A.regeln)) {
    if (kernRegelIds.has(r.id)) { hinweis(`Kern ersetzt die Automatik-Regel ${r.id} (gleiche id).`); continue; }
    const ziele = list(r.schaltet).filter(z => !kernZiele.has(z) && !offenKern.has(z));
    const weg = list(r.schaltet).filter(z => kernZiele.has(z) || offenKern.has(z));
    if (weg.length) hinweis(`Automatik-Regel ${r.id}: ${weg.join(', ')} ${weg.some(z => offenKern.has(z)) ? 'bleibt offen (Kern: offen)' : 'wird von einer Regel des Kerns geöffnet'}; die Automatik-Regel entfällt dafür.`);
    if (ziele.length) behalten.push({ ...r, schaltet: ziele });
  }
  E.regeln = behalten.concat(clone(list(K.regeln)));
  return E;
}

/* ------------------------------------------------------------------------------------------------ Ableitung */

export function leiteAb(P, { skelett = false, auto = false, kern = null, kernDatei = '', zuordnung = true } = {}) {
  const R = newReport();
  R.hinweise = [];
  const hinweis = t => R.hinweise.push(t);
  const D = ladeDaten(P, R);
  D.P = P;
  const { pack, plan, journeys, text } = D;
  if (!plan) { R.err(`${P.rel('plan.json')}: nicht lesbar.`); return { R, spielplan: null }; }
  const W = m => R.warn(m);

  // --- Kuratierte Schicht (Automatik, dann Kern darüber)
  let K = {}, meta = null;
  if (!skelett) {
    if (auto) {
      const a = autoKern(D, hinweis);
      meta = a.meta;
      K = kern ? vereine(a.kern, kern, hinweis) : a.kern;
    } else K = kern || {};
  }
  const stationenById = Object.fromEntries(plan.stations.map(s => [s.id, s]));
  const einheiten = [];
  const by = {}, abgeleitet = new Set();
  const add = (u, ersetzbar = false) => {
    if (by[u.id]) {
      if (abgeleitet.has(u.id) && !ersetzbar) { const i = einheiten.indexOf(by[u.id]); einheiten[i] = u; by[u.id] = u; abgeleitet.delete(u.id); return u; }
      R.err(`Einheit ${u.id}: id doppelt (zweite Quelle: ${u.art}).`); return null;
    }
    by[u.id] = u; einheiten.push(u); if (ersetzbar) abgeleitet.add(u.id); return u;
  };
  const normGeb = id => (String(id).includes('/') ? String(id) : 'gebiet/' + id);
  const normEp = id => (String(id).includes('/') ? String(id) : 'episode/' + id);

  // --- Gebiete
  for (const g of list(K.gebiete)) {
    if (!isObj(g) || !g.id) { W('gebiete: Eintrag ohne id übersprungen.'); continue; }
    add({ ...g, id: normGeb(g.id), art: 'gebiet' });
  }

  // --- Episoden (Reisen)
  const zusatz = Object.fromEntries(list(K.episoden_zusatz).filter(isObj).filter(e => e.id).map(e => [normEp(e.id), e]));
  journeys.forEach((j, i) => {
    const id = 'episode/' + j.id;
    const z = zusatz[id] || {};
    if (!skelett && !auto && K.episoden_zusatz && !zusatz[id]) W(`${id}: kein Eintrag in episoden_zusatz (Gebiet, Etappe, Auftakt, Abschluss werden aus journeys.js abgeleitet).`);
    const u = {
      id, art: 'episode', name: j.name, in: z.gebiet ? normGeb(z.gebiet) : undefined, etappe: z.etappe || (i === 0 ? 'onboarding' : 'scaffolding'),
      reihenfolge: z.reihenfolge !== undefined ? z.reihenfolge : i + 1, sichtbar: z.sichtbar, adresse: '#/reise/' + j.id,
      auftakt: z.auftakt || [j.tagline && endePunkt(j.tagline), saetze(j.intro, 2)].filter(Boolean).join(' '),
      abschluss: z.abschluss || saetze(j.outro, 3)
    };
    for (const k of Object.keys(z)) if (!['id', 'gebiet'].includes(k) && u[k] === undefined) u[k] = z[k];
    add(u);
  });
  for (const id of Object.keys(zusatz)) if (!by[id]) W(`episoden_zusatz: ${id} gehört zu keiner Reise des Pakets (übersprungen).`);

  // --- Stationen, Mythos-Karten, Exponate, Werkzeuge der Werkzeug-Reisen
  const exIds = uniq(plan.stations.map(s => s.exhibit).filter(Boolean));
  const exTitel = exhibitTitles(P, exIds);
  const vorsatz = typeof K.quest_vorsatz === 'string' ? K.quest_vorsatz : 'Mythos-Check: ';
  const homeOf = s => (Array.isArray(s.journeys) ? s.journeys : []);
  const werkzeugReisen = new Set(journeys.filter(j => j.tool === true).map(j => j.id));
  for (const s of plan.stations) {
    const reisen = homeOf(s).filter(j => by['episode/' + j]);
    const inn = reisen.length ? reisen.map(j => 'episode/' + j) : undefined;
    const pos = (reisen.length && Array.isArray(plan.orders[reisen[0]]) ? plan.orders[reisen[0]].indexOf(s.id) : -1) + 1;
    const adresse = '#/station/' + s.id;
    const gemeinsam = { in: inn && (inn.length === 1 ? inn[0] : inn), reihenfolge: pos || undefined };
    add({ id: 'inhalt/' + s.id, art: 'inhalt', name: s.title, ...gemeinsam, adresse });
    if (istMythos(s, text)) add({ id: 'quest/' + s.id + '-mythos', art: 'quest', name: vorsatz + s.title, ...gemeinsam, adresse, staerke: 1 });
    if (s.exhibit) {
      const eid = 'erlebnis/' + s.exhibit;
      if (by[eid]) { W(`${eid}: Exponat steht an mehreren Stationen; es zählt nur die erste (${by[eid].adresse}).`); }
      else add({ id: eid, art: 'erlebnis', name: exTitel[s.exhibit] || s.exhibit, ...gemeinsam, adresse });
    }
    if (homeOf(s).some(j => werkzeugReisen.has(j))) {
      if (WERKZEUG_KINDS[s.kind]) add({ id: 'werkzeug/' + s.id, art: 'werkzeug', name: s.title, sorte: WERKZEUG_KINDS[s.kind], adresse, ...(auto && !skelett ? { gewicht: 'optional' } : {}) }, true);
      else hinweis(`Station ${s.id} (Art ${s.kind}) liegt in einer Werkzeug-Reise, ist aber kein Werkzeug (nur konzept, methode, instrument).`);
    }
  }

  // --- Kuratierte Schicht: Werkzeuge, Fähigkeiten, freie Einheiten
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
  for (const qq of list(K.quests)) {
    if (!isObj(qq) || !by[qq.id]) { W(`quests: „${qq && qq.id}“ gibt es im Paket nicht (übersprungen).`); continue; }
    by[qq.id].staerke = qq.staerke;
  }
  for (const a of list(K.aufgaben)) {
    if (!isObj(a) || !by[a.id]) { W(`aufgaben: „${a && a.id}“ gibt es im Paket nicht (übersprungen).`); continue; }
    by[a.id].aufgabe = a.aufgabe;
  }
  if (!skelett && zuordnung) {
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
      if (t.name !== undefined) inhalt.name = t.name;
      if (t.reihenfolge !== undefined) inhalt.reihenfolge = t.reihenfolge;
      if (t.staerke !== undefined) { const qu = inhalt.art === 'quest' ? inhalt : quest; if (qu) qu.staerke = t.staerke; else W(`spielplan-zuordnung: ${k}: staerke ohne Mythos-Karte an dieser Station (übersprungen).`); }
      if (t.braucht.length) {
        const ziel = inhalt.art === 'quest' ? inhalt : (quest || erlebnis || inhalt);
        ziel.braucht = uniq(list(ziel.braucht).concat(t.braucht.map(normWerk)));
        if (ziel.art !== 'quest') W(`spielplan-zuordnung: ${k}: braucht gilt laut Standard 3.1 für Mythos-Karten; hier an ${ziel.id} gesetzt.`);
      }
    }
  }

  // --- Kopf
  const kopf = {
    format: 'spielplan/0', id: K.id || 'museum-' + slug(pack.id || P.name), name: K.name || pack.title || P.name,
    basis: K.basis || 'https://example.org/spielplan/museum-' + slug(pack.id || P.name) + '/',
    nur_lokal: K.nur_lokal === undefined ? true : K.nur_lokal,
    stufen: K.stufen || clone(STANDARD_STUFEN),
    begriffe: K.begriffe || begriffeAusPack(pack, hinweis),
    rhythmus: K.rhythmus || clone(STANDARD_RHYTHMUS)
  };
  for (const k of Object.keys(K)) {
    if (!KERN_ABSCHNITTE.includes(k) && !k.startsWith('_')) W(`${kernDatei || 'Kern'}: unbekannter Abschnitt „${k}“ wird nicht übernommen.`);
  }
  // zusätzliche Einheiten des Kerns (freie Form), z. B. Querthemen, die die Ableitung nicht kennt
  for (const u of list(K.einheiten)) if (isObj(u) && u.id) add(clone(u));

  const spielplan = { ...kopf, einheiten: einheiten.map(ordered), regeln: skelett ? [] : clone(list(K.regeln)).map(geordneteRegel) };
  const out = {};
  for (const k of HEAD_ORDER) out[k] = spielplan[k];
  return { R, spielplan: out, meta };
}

export function leseKern(P, R, datei = '') {
  const kandidaten = datei ? [datei] : ['spielplan-kern.yaml', 'spielplan-kern.yml', 'spielplan-kern.json'].map(n => path.join(P.dir, n));
  for (const f0 of kandidaten) {
    const f = path.isAbsolute(f0) ? f0 : (fs.existsSync(path.resolve(f0)) ? path.resolve(f0) : path.join(P.dir, f0));
    const rel = path.relative(ROOT, f);
    if (!fs.existsSync(f)) { if (datei) { R.err(`${rel}: Kern-Datei nicht gefunden.`); return { kern: null, datei: rel }; } continue; }
    try { return { kern: parseDatei(fs.readFileSync(f, 'utf8'), rel), datei: rel }; }
    catch (e) { if (e instanceof YamlFehler) { R.err(`${rel}: ${e.message}`); return { kern: null, datei: rel }; } throw e; }
  }
  return { kern: null, datei: '' };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const pos = argv.filter(a => !a.startsWith('--'));
  const flags = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
  if (!pos.length) {
    console.error('Aufruf: node tools/spielplan-aus-plan.mjs <paket> [--auto | --skelett] [--kern=datei] [--wege] [--minuten=4] [--out=datei] [--stdout] [--trotzdem]\n'
      + '  Erzeugt packs/<paket>/spielplan.json aus plan.json, journeys.js, spielplan-kern.yaml und spielplan-zuordnung/*.json.\n'
      + '  --auto erzeugt ohne Handarbeit einen spielbaren Standard-Spielplan (Gebiete, Etappen, Regeln mit Enthüllung, Rhythmus); ein vorhandener Kern überschreibt ihn abschnittsweise.\n'
      + '  --skelett: alles offen, keine Regeln (nur zum Testen). Vorlage für den Kern: docs/spielplan-vorlage-kern.yaml.');
    process.exit(2);
  }
  const P = resolvePack(pos[0]);
  if (!fs.existsSync(P.dir)) { console.error(`✗ Paketordner nicht gefunden: ${path.relative(ROOT, P.dir)}`); process.exit(2); }
  const skelett = flags.skelett === true, auto = flags.auto === true;
  if (skelett && auto) { console.error('✗ --auto und --skelett schließen sich aus.'); process.exit(2); }
  const R0 = newReport();
  const { kern, datei } = skelett ? { kern: null, datei: '' } : leseKern(P, R0, typeof flags.kern === 'string' ? flags.kern : '');
  if (!skelett && !auto && !kern && !R0.errors.length) console.error(`! Kein spielplan-kern.yaml in ${path.relative(ROOT, P.dir)}: es entsteht ein Plan ohne Regeln (wie --skelett, aber mit den Zuordnungsdateien). Mit --auto entsteht ein spielbarer Standard.`);
  const { R, spielplan, meta } = leiteAb(P, { skelett, auto, kern, kernDatei: datei });
  R.errors.unshift(...R0.errors);
  const SP = ladeKern().Spielplan;
  let pruef = { fehler: [], warnungen: [], info: {} };
  if (spielplan && !R.errors.length) pruef = SP.pruefe(spielplan);
  const fehler = R.errors.concat(pruef.fehler), warn = R.warnings.concat(pruef.warnungen);
  for (const h of R.hinweise || []) console.error('Hinweis: ' + h);
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
    const modus = skelett ? 'Skelett: alles offen' : auto ? (kern ? 'automatisch, Kern darüber' : 'automatisch') : (kern ? 'kuratiert' : 'ohne Regeln');
    console.log(`✓ ${path.relative(ROOT, ziel)}: ${spielplan.einheiten.length} Einheiten (${arten}), ${spielplan.regeln.length} Regeln (${modus})${warn.length ? `, ${warn.length} Warnungen` : ''}`);
    if (!skelett) {
      const minuten = typeof flags.minuten === 'string' ? Math.max(1, Number(flags.minuten) || 4) : 4;
      try { for (const z of berichtZeilen(spielplan, SP, { wege: flags.wege === true, minuten })) console.log('  ' + z); } catch (e) { console.error('! Bericht nicht möglich: ' + e.message); }
    }
  }
}

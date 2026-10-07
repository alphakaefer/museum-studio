// Legt ein neues Paket aus einer Vorlage an: packs/<id>/ mit pack.json, plan.json, journeys.js, ARBEITSSTAND.md und Stationsrümpfen
// (je Reise 11 Stationen, mit Kreuzungen zwischen benachbarten Reisen; Dateien stationen/<reise-id>.js nach Heimat-Reise).
// Aufruf: node tools/new-pack.mjs <id> --title="Name des Museums" [--journeys=3] [--historical=0] [--stations=11]
//   --journeys=<n>    Zahl der Reisen, 2 bis 16 (Standard 3)
//   --stations=<n>    Stationen je Reise (Mitgliedschaften), 11 bis 28 (Standard 11)
//   --historical=<n>  die letzten n Reisen sind historisch (typ:'historisch', mit year/yearLabel, chronologisch), 0 bis 3 und kleiner als --journeys
// Jede Station bekommt einen Platzhalter für das Plan-Feld "visual" (Anschauung); pack.json setzt requireVisualPlan:true.
// Alle noch auszufüllenden Stellen sind mit „TODO“ markiert; `node tools/check-pack.mjs <id>` meldet sie als Fehler,
// bis sie durch echten Inhalt ersetzt sind. Ein fertiges Muster zum Abschauen: packs/_vorlage/.
// Programmatisch nutzbar: import { createPack } from './new-pack.mjs'; createPack({ id, title, journeys, historical, stations, journeyNames, pack, extraFiles, dryRun, empty }).
//   empty: true  legt KEIN Gerüst an (das Onboarding nutzt das): plan.json mit leerem Plan (journeys:[], stations:[], orders:{}) und TODO-Markierung,
//                journeys.js ohne Reisen, keine Stationsdateien. check-pack meldet dann „Plan noch leer“. Reisen und Stationen plant der Agent (docs/AGENTEN.md, Schritt 1 und 2).
// Das Paket wird erst in einem versteckten Ordner angelegt und dann umbenannt: es gibt nie ein halbes Paket.
import fs from 'fs';
import path from 'path';
import { ROOT, SLUG, isMain } from './check-lib.mjs';

export class PackError extends Error {}
const fail = m => { throw new PackError(m); };

/** Prüft die Optionen und gibt die bereinigten Werte zurück (wirft PackError). */
export function normalizeOptions(o) {
  const id = o.id;
  if (o.empty) {
    if (!id) fail('Aufruf: node tools/new-pack.mjs <id> --title="Name des Museums"');
    if (!SLUG.test(id)) fail(`ID „${id}“ ist ungültig. Erlaubt: Kleinbuchstaben, Ziffern und einzelne Bindestriche, keine Umlaute oder Leerzeichen (z. B. spieltheorie).`);
    return { id, N: 0, H: 0, PER: 11, title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'TODO: Name des Museums', names: [] };
  }
  if (!id) fail('Aufruf: node tools/new-pack.mjs <id> --title="Name des Museums" [--journeys=3] [--historical=0] [--stations=11]\n  <id>: Kleinbuchstaben, Ziffern, Bindestriche (z. B. quantenphysik).');
  if (!SLUG.test(id)) fail(`ID „${id}“ ist ungültig. Erlaubt: Kleinbuchstaben, Ziffern und einzelne Bindestriche, keine Umlaute oder Leerzeichen (z. B. spieltheorie).`);
  const num = (v, d) => v === undefined || v === null || v === '' ? d : (typeof v === 'number' ? v : (/^-?\d+$/.test(String(v).trim()) ? parseInt(v, 10) : NaN));
  const N = num(o.journeys, 3), H = num(o.historical, 0), PER = num(o.stations, 11);
  if (!Number.isInteger(N) || N < 2 || N > 16) fail('--journeys muss eine Zahl von 2 bis 16 sein.');
  if (!Number.isInteger(H) || H < 0 || H > 3 || H >= N) fail('--historical muss eine Zahl von 0 bis 3 sein und kleiner als --journeys (mindestens eine funktionale Reise).');
  if (!Number.isInteger(PER) || PER < 11 || PER > 28) fail('--stations muss eine Zahl von 11 bis 28 sein (Stationen je Reise).');
  const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'TODO: Name des Museums';
  const names = Array.isArray(o.journeyNames) ? o.journeyNames.map(x => String(x).trim()).filter(Boolean) : [];
  return { id, N, H, PER, title, names };
}

export function createPack(opts = {}) {
  const { id, N, H, PER, title, names } = normalizeOptions(opts);
  const dir = path.join(ROOT, 'packs', id);
  if (fs.existsSync(dir)) fail(`packs/${id}/ existiert schon. Wähle eine andere ID oder lösche den Ordner bewusst selbst.`);

// Jede Reise bekommt 11 Stationen (Mindestzahl, siehe limits). Reise k deckt ein Fenster im Ring aus NS Stationen ab;
// benachbarte Fenster überlappen (= Kreuzungen). Ab 6 Reisen verlangt check-plan Kreuzungen zu je 4 anderen Reisen, daher dichter gepackt.
// Dichte der Rümpfe: ab 6 Reisen so, dass jede Reise vier andere kreuzt (Fenster ≥ 2 Schritte + 1) und insgesamt höchstens ~200 Stationen entstehen.
// Mit PER = 11 ergibt das wie bisher 5 bzw. 8 Stationen Schrittweite. Die Rümpfe sind ein Gerüst, nicht die Zielzahl: überzählige löscht man im Plan.
const EMPTY = !!opts.empty;
const SP = N >= 6 ? Math.max(3, Math.min(Math.floor((PER - 1) / 2), Math.floor(200 / N))) : Math.max(8, Math.round(PER * 0.6));
const NS = EMPTY ? 0 : Math.max(N * SP, PER + 5);
const JID = Array.from({ length: N }, (_, k) => 'reise-' + String.fromCharCode(97 + k)); // reise-a, reise-b, …
const isHist = k => k >= N - H;
const sid = i => 'station-' + String(i + 1).padStart(2, '0');
const members = JID.map((_, k) => { const start = Math.round(k * NS / N); return Array.from({ length: PER }, (_, i) => (start + i) % NS); });
const journeysOf = i => JID.filter((_, k) => members[k].includes(i));
const yearOf = i => 1800 + i * 2;   // Platzhalter-Jahr, nur damit die Chronologie stimmt; echte Jahre eintragen
const COLORS = [['#8A4B1F', '#D9A066'], ['#1F6F82', '#5FB4C4'], ['#5B3C84', '#A888CF'], ['#2A7AB0', '#4DB0EA'], ['#3E8E41', '#62CF66'], ['#BE4070', '#F66777'], ['#948C1B', '#D6C54A'], ['#B5651D', '#E8944A'],
  ['#0F766E', '#4FD1C5'], ['#9B2C2C', '#F28B82'], ['#4C51BF', '#9FA8F5'], ['#6B5B00', '#E3D26F'], ['#7B3F61', '#D69ABC'], ['#2F5D3A', '#8FCB9B'], ['#9C4221', '#F2A07B'], ['#37474F', '#9FB3BD']];
const ICONS = ['seed', 'hourglass', 'compass', 'book', 'lightbulb', 'puzzle', 'map', 'tree', 'flag', 'network', 'key', 'bridge', 'star', 'leaf', 'chess', 'toolbox'];
const jname = k => names[k] || `TODO: Name der Reise ${k + 1}`;

const J = JSON.stringify;
// plan.json: je Reise geordnet nach Reihenfolge im Ring
const histStation = i => journeysOf(i).some(j => isHist(JID.indexOf(j)));
const stations = Array.from({ length: NS }, (_, i) => {
  const o = { id: sid(i), title: `TODO: Titel der Station ${i + 1}`, kind: 'konzept', journeys: journeysOf(i), why: 'TODO: Ein Satz, warum diese Station hier steht und was man lernt.',
    visual: { kind: 'TODO', idea: 'TODO: Was sieht oder tut man hier? kind: abbildung | exponat | keine (bei keine: reason mit ehrlicher Begründung statt idea)' } };
  if (histStation(i)) { o.year = yearOf(i); o.yearLabel = 'TODO: Jahr'; }
  return o;
});
const orders = {};
JID.forEach((j, k) => { orders[j] = (isHist(k) ? members[k].slice().sort((a, b) => a - b) : members[k]).map(sid); });
const plan = EMPTY
  ? { _TODO: 'TODO: Plan noch leer. Reisen und Stationen planen: docs/AGENTEN.md, Schritt 1 (Reisen finden) und Schritt 2 (Stationsplan). Format: journeys [{id,typ,name}], stations [{id,title,kind,journeys,why,visual}], orders {reiseId:[stationIds]}. Dieses Feld danach löschen.', journeys: [], stations: [], orders: {} }
  : { journeys: JID.map((j, k) => ({ id: j, typ: isHist(k) ? 'historisch' : 'funktional', name: jname(k) })), stations, orders };

// journeys.js
const jsrc = EMPTY ? `// TODO: Reisen. Noch leer: erst Reisen und Plan entwerfen (docs/AGENTEN.md, Schritt 1 bis 3), dann hier je Reise eintragen:
// { id, typ:'funktional'|'historisch', name, kurz (≤ 14 Zeichen), tagline (≤ 70), intro, outro, color:{light,dark}, icon }. ids wie in plan.json.
// Muster: packs/_vorlage/journeys.js. Icons: node tools/list-icons.mjs
(function(){'use strict';
window.MUSEUM=window.MUSEUM||{};
MUSEUM.data=MUSEUM.data||{};
MUSEUM.data.journeys=[];
})();
` : `// TODO: Reisen. Name, Kurzname (≤ 14 Zeichen), Tagline (≤ 70 Zeichen), Intro (2–3 Sätze), Outro (1–2 Sätze, offene Frage), Icon, Farbe.
// typ:'historisch' = Zeitstrahl-Reise (Stationen mit year/yearLabel, chronologisch); sonst 'funktional'.
// color: light = Farbe auf hellem Grund (≥ 3:1 Kontrast), dark = aufgehellte Variante für dunklen Grund. Reisen müssen gut unterscheidbar sein.
// icon: ein Schlüssel aus engine/js/icons.js (Liste: node tools/list-icons.mjs). ids müssen mit plan.json übereinstimmen.
(function(){'use strict';
window.MUSEUM=window.MUSEUM||{};
MUSEUM.data=MUSEUM.data||{};
MUSEUM.data.journeys=[
${JID.map((j, k) => `{ id:${J(j)}, typ:'${isHist(k) ? 'historisch' : 'funktional'}', name:${J(jname(k))}, kurz:'TODO: Kurzname',
  tagline:'TODO: Versprechen in höchstens 70 Zeichen',
  intro:'TODO: 2–3 Sätze Einladung an die Besucher.',
  outro:'TODO: 1–2 Sätze Ausblick, am besten eine offene Frage.',
  color:{ light:'${COLORS[k][0]}', dark:'${COLORS[k][1]}' },
  icon:'${ICONS[k]}' }`).join(',\n')}
];
})();
`;

// Stationsrümpfe: eine Datei je Heimat-Reise (erste Reise der Station)
const byHome = {};
for (let i = 0; i < NS; i++) (byHome[journeysOf(i)[0]] = byHome[journeysOf(i)[0]] || []).push(i);
const stub = i => {
  const js = journeysOf(i);
  const cross = js.slice(1).map(j => `    ${J(j)}: ${J('TODO: Ein konkreter Satz, warum man hier zur Reise „' + j + '“ umsteigt.')}`).join(',\n');
  return `${J(sid(i))}: {
  id: ${J(sid(i))},
  title: 'TODO: Titel der Station ${i + 1}',
  kind: 'konzept',                      // konzept | person | ereignis | methode | mythos | instrument | ort
  journeys: ${J(js)},   // die ERSTE ist die Heimat-Reise; Reihenfolge wie in plan.json
${histStation(i) ? `  year: ${yearOf(i)}, yearLabel: 'TODO: Jahr',   // wie im Plan; v. Chr. negativ; Ungefähres: yearLabel:'um 1250'\n` : ''}  icon: 'lightbulb',                    // Schlüssel aus engine/js/icons.js (Liste: node tools/list-icons.mjs)
  teaser: 'TODO: ersetze diesen ganzen Satz durch einen Teaser (≤ 140 Zeichen), der neugierig macht.',
  text: [
    'TODO: ersetze diesen Absatz. Insgesamt 90–200 Wörter in 2–4 Absätzen; der erste Satz ist ein Bild oder eine Szene, keine Definition.',
    'TODO: ersetze diesen zweiten Absatz (Phänomen, Grenzen, Streitpunkte).'
  ],
  facts: [
    'TODO: ein kurzer, überprüfbarer Fakt (≤ 160 Zeichen).',
    'TODO: zweiter Fakt.'
  ],
  quote: null,                          // nur sicher belegte Zitate: { text:'…', who:'Name', src:'Werk, Jahr' }
  myth: null,                           // Pflicht bei kind:'mythos': { glaube:'…', wahrheit:'…' }
  cross: {${cross ? '\n' + cross + '\n  ' : ''}},                          // ein Satz für JEDE andere Reise der Station
  exhibit: null,                        // ID eines Exponats aus pack.json "exhibits" oder null
  further: ['TODO: Lesetipp, nur real existierende Werke.']
}`;
};
const files = {};
for (const [home, idxs] of Object.entries(byHome)) {
  files[`stationen/${home}.js`] = `// Stationen der Reise „${home}“ (Heimat-Reise). Schema und Regeln: docs/INHALT-SCHREIBEN.md. Prüfen: node tools/check-data.mjs ${id} packs/${id}/stationen/${home}.js
(function(){
'use strict';
window.MUSEUM = window.MUSEUM || {};
window.MUSEUM.addStations({

${idxs.map(stub).join(',\n\n')}

});
})();
`;
}

const pack = {
  _hinweis: 'Metadaten und Wortschatz. Felder mit _ am Anfang sind Kommentare. Alle TODO-Stellen ersetzen; Muster: packs/_vorlage/pack.json. Prüfen: node tools/check-pack.mjs ' + id,
  id,
  title,
  eyebrow: 'TODO: Zeile über dem Titel (kurze Einordnung des Gebiets)',
  tagline: 'TODO: Ein Satz als Untertitel der Eingangshalle',
  lang: 'de',
  defaultSkin: 'halle',
  vocab: { journey: 'Reise', journeys: 'Reisen', station: 'Station', stations: 'Stationen', interchange: 'Kreuzung', interchanges: 'Kreuzungen', transfer: 'Umsteigen', passport: 'Reisepass', grandTour: 'Große Rundreise', networkMap: 'Netzplan', timeline: 'Zeitstrahl' },
  journeyTypes: { funktional: 'Funktionale Reisen', historisch: 'Historische Reisen' },
  exhibits: [],
  limits: { min: 11, max: EMPTY ? 28 : Math.min(28, PER + 6), visualShare: 0.3 },
  requireVisualPlan: true,
  footer: 'TODO: Hinweis am Seitenende (Text ohne HTML; Leerzeile = neuer Absatz), z. B. Bildung statt Beratung, bei heiklen Themen Hilfsangebote',
  license: 'TODO: Lizenz der Inhalte',
  credits: 'TODO: Autorinnen, Autoren, Quellen'
};

if (opts.pack && typeof opts.pack === 'object') Object.assign(pack, opts.pack);
const out = {};
out['pack.json'] = JSON.stringify(pack, null, 2) + '\n';
out['plan.json'] = JSON.stringify(plan, null, 1) + '\n';
out['journeys.js'] = jsrc;
const tplState = path.join(ROOT, 'packs', '_vorlage', 'ARBEITSSTAND.md');
if (typeof opts.arbeitsstand === 'string') out['ARBEITSSTAND.md'] = opts.arbeitsstand;
else if (fs.existsSync(tplState)) out['ARBEITSSTAND.md'] = fs.readFileSync(tplState, 'utf8').replace(/\{\{TITEL\}\}/g, title).replace(/\{\{ID\}\}/g, id);
for (const [f, src] of Object.entries(files)) out[f] = src;
for (const [f, src] of Object.entries(opts.extraFiles || {})) out[f] = src;

const info = { id, dir, journeys: N, historical: H, perJourney: PER, stubs: NS, crossings: stations.filter(s => s.journeys.length > 1).length, journeyIds: JID, files: Object.keys(out), pack };
if (opts.dryRun) return info;
// atomar: erst in einen versteckten Ordner, dann umbenennen
const tmp = path.join(ROOT, 'packs', `.${id}.tmp-${process.pid}`);
try {
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const [f, src] of Object.entries(out)) { const p = path.join(tmp, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, src); }
  if (fs.existsSync(dir)) fail(`packs/${id}/ existiert schon.`);
  fs.renameSync(tmp, dir);
} catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
return info;
}

function nextSteps(r) {
  return `✓ packs/${r.id}/ angelegt: ${r.journeys} Beispiel-Reisen (${r.journeyIds.join(', ')}${r.historical ? `; historisch: ${r.journeyIds.slice(r.journeys - r.historical).join(', ')}` : ''}), je ${r.perJourney} Stationen, ${r.stubs} Stationsrümpfe insgesamt, ${r.crossings} Kreuzungen, Dateien stationen/<reise-id>.js, ARBEITSSTAND.md.
Nächste Schritte:
  0. Rahmen und Annahmen in ARBEITSSTAND.md festhalten.
  1. Reisen und Stationen planen (plan.json), Reisen beschreiben (journeys.js), pack.json ausfüllen. Rümpfe, die du nicht brauchst, löschst du in plan.json UND in den Stationsdateien; jede Reise braucht ${r.pack.limits.min}–${r.pack.limits.max} Stationen.
  1b. Anschauung planen: für JEDE Station in plan.json das Feld "visual" entscheiden (abbildung | exponat | keine mit Begründung); mindestens 30 % der Stationen, bei abstrakten Themen mehr (docs/AGENTEN.md, „Anschauung planen“; Baukasten MUSEUM.viz, Muster: packs/_vorlage/visuals/).
  2. Stationstexte schreiben (stationen/*.js), Vorbild: packs/_vorlage/; danach die geplanten Abbildungen und Exponate bauen.
  3. Prüfen: node tools/check-pack.mjs ${r.id}   (meldet jedes verbliebene TODO als Fehler)
  4. Layout: node tools/layout-map.mjs ${r.id}`;
}

if (isMain(import.meta.url)) {
  const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
  try {
    const r = createPack({ id: pos[0], title: flags.title, journeys: flags.journeys, historical: flags.historical, stations: flags.stations });
    console.log(nextSteps(r));
  } catch (e) {
    if (!(e instanceof PackError)) throw e;
    console.error('✗ ' + e.message); process.exit(2);
  }
}

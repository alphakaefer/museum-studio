// Legt ein neues Paket aus einer Vorlage an: packs/<id>/ mit pack.json, plan.json, journeys.js, ARBEITSSTAND.md und Stationsrümpfen
// (je Reise 11 Stationen, mit Kreuzungen zwischen benachbarten Reisen; Dateien stationen/<reise-id>.js nach Heimat-Reise).
// Aufruf: node tools/new-pack.mjs <id> --title="Name des Museums" [--journeys=3] [--historical=0]
//   --journeys=<n>    Zahl der Reisen, 2 bis 8 (Standard 3)
//   --historical=<n>  die letzten n Reisen sind historisch (typ:'historisch', mit year/yearLabel, chronologisch), 0 bis 3 und kleiner als --journeys
// Alle noch auszufüllenden Stellen sind mit „TODO“ markiert; `node tools/check-pack.mjs <id>` meldet sie als Fehler,
// bis sie durch echten Inhalt ersetzt sind. Ein fertiges Muster zum Abschauen: packs/_vorlage/.
import fs from 'fs';
import path from 'path';
import { ROOT, SLUG } from './check-lib.mjs';

const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
const id = pos[0];
const die = m => { console.error('✗ ' + m); process.exit(2); };
if (!id) die('Aufruf: node tools/new-pack.mjs <id> --title="Name des Museums" [--journeys=3] [--historical=0]\n  <id>: Kleinbuchstaben, Ziffern, Bindestriche (z. B. quantenphysik).');
if (!SLUG.test(id)) die(`ID „${id}“ ist ungültig. Erlaubt: Kleinbuchstaben, Ziffern und einzelne Bindestriche, keine Umlaute oder Leerzeichen (z. B. spieltheorie).`);
const N = flags.journeys === undefined ? 3 : parseInt(flags.journeys, 10);
if (!Number.isInteger(N) || N < 2 || N > 8) die('--journeys muss eine Zahl von 2 bis 8 sein.');
const H = flags.historical === undefined ? 0 : parseInt(flags.historical, 10);
if (!Number.isInteger(H) || H < 0 || H > 3 || H >= N) die('--historical muss eine Zahl von 0 bis 3 sein und kleiner als --journeys (mindestens eine funktionale Reise).');
const dir = path.join(ROOT, 'packs', id);
if (fs.existsSync(dir)) die(`packs/${id}/ existiert schon. Wähle eine andere ID oder lösche den Ordner bewusst selbst.`);
const title = typeof flags.title === 'string' && flags.title.trim() ? flags.title.trim() : 'TODO: Name des Museums';

// Jede Reise bekommt 11 Stationen (Mindestzahl, siehe limits). Reise k deckt ein Fenster im Ring aus NS Stationen ab;
// benachbarte Fenster überlappen (= Kreuzungen). Ab 6 Reisen verlangt check-plan Kreuzungen zu je 4 anderen Reisen, daher dichter gepackt.
const PER = 11;
const SP = N >= 6 ? 5 : 8;
const NS = Math.max(N * SP, PER + 5);
const JID = Array.from({ length: N }, (_, k) => 'reise-' + String.fromCharCode(97 + k)); // reise-a, reise-b, …
const isHist = k => k >= N - H;
const sid = i => 'station-' + String(i + 1).padStart(2, '0');
const members = JID.map((_, k) => { const start = Math.round(k * NS / N); return Array.from({ length: PER }, (_, i) => (start + i) % NS); });
const journeysOf = i => JID.filter((_, k) => members[k].includes(i));
const yearOf = i => 1800 + i * 2;   // Platzhalter-Jahr, nur damit die Chronologie stimmt; echte Jahre eintragen
const COLORS = [['#8A4B1F', '#D9A066'], ['#1F6F82', '#5FB4C4'], ['#5B3C84', '#A888CF'], ['#2A7AB0', '#4DB0EA'], ['#3E8E41', '#62CF66'], ['#BE4070', '#F66777'], ['#948C1B', '#D6C54A'], ['#B5651D', '#E8944A']];
const ICONS = ['seed', 'hourglass', 'compass', 'book', 'lightbulb', 'puzzle', 'map', 'tree'];

const J = JSON.stringify;
// plan.json: je Reise geordnet nach Reihenfolge im Ring
const histStation = i => journeysOf(i).some(j => isHist(JID.indexOf(j)));
const stations = Array.from({ length: NS }, (_, i) => {
  const o = { id: sid(i), title: `TODO: Titel der Station ${i + 1}`, kind: 'konzept', journeys: journeysOf(i), why: 'TODO: Ein Satz, warum diese Station hier steht und was man lernt.' };
  if (histStation(i)) { o.year = yearOf(i); o.yearLabel = 'TODO: Jahr'; }
  return o;
});
const orders = {};
JID.forEach((j, k) => { orders[j] = (isHist(k) ? members[k].slice().sort((a, b) => a - b) : members[k]).map(sid); });
const plan = { journeys: JID.map((j, k) => ({ id: j, typ: isHist(k) ? 'historisch' : 'funktional', name: `TODO: Name der Reise ${k + 1}` })), stations, orders };

// journeys.js
const jsrc = `// TODO: Reisen. Name, Kurzname (≤ 14 Zeichen), Tagline (≤ 70 Zeichen), Intro (2–3 Sätze), Outro (1–2 Sätze, offene Frage), Icon, Farbe.
// typ:'historisch' = Zeitstrahl-Reise (Stationen mit year/yearLabel, chronologisch); sonst 'funktional'.
// color: light = Farbe auf hellem Grund (≥ 3:1 Kontrast), dark = aufgehellte Variante für dunklen Grund. Reisen müssen gut unterscheidbar sein.
// icon: ein Schlüssel aus engine/js/icons.js (Liste: node tools/list-icons.mjs). ids müssen mit plan.json übereinstimmen.
(function(){'use strict';
window.MUSEUM=window.MUSEUM||{};
MUSEUM.data=MUSEUM.data||{};
MUSEUM.data.journeys=[
${JID.map((j, k) => `{ id:${J(j)}, typ:'${isHist(k) ? 'historisch' : 'funktional'}', name:'TODO: Name der Reise ${k + 1}', kurz:'TODO: Kurzname',
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
  limits: { min: 11, max: 28 },
  footer: 'TODO: Hinweis am Seitenende (Text ohne HTML; Leerzeile = neuer Absatz), z. B. Bildung statt Beratung, bei heiklen Themen Hilfsangebote',
  license: 'TODO: Lizenz der Inhalte',
  credits: 'TODO: Autorinnen, Autoren, Quellen'
};

fs.mkdirSync(path.join(dir, 'stationen'), { recursive: true });
fs.writeFileSync(path.join(dir, 'pack.json'), JSON.stringify(pack, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 1) + '\n');
fs.writeFileSync(path.join(dir, 'journeys.js'), jsrc);
const tplState = path.join(ROOT, 'packs', '_vorlage', 'ARBEITSSTAND.md');
if (fs.existsSync(tplState)) fs.writeFileSync(path.join(dir, 'ARBEITSSTAND.md'), fs.readFileSync(tplState, 'utf8').replace(/\{\{TITEL\}\}/g, title).replace(/\{\{ID\}\}/g, id));
for (const [f, src] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), src);

console.log(`✓ packs/${id}/ angelegt: ${N} Beispiel-Reisen (${JID.join(', ')}${H ? `; historisch: ${JID.slice(N - H).join(', ')}` : ''}), je ${PER} Stationen, ${NS} Stationsrümpfe insgesamt, ${stations.filter(s => s.journeys.length > 1).length} Kreuzungen, Dateien stationen/<reise-id>.js, ARBEITSSTAND.md.
Nächste Schritte:
  0. Rahmen und Annahmen in ARBEITSSTAND.md festhalten.
  1. Reisen und Stationen planen (plan.json), Reisen beschreiben (journeys.js), pack.json ausfüllen. Rümpfe, die du nicht brauchst, löschst du in plan.json UND in den Stationsdateien; jede Reise braucht ${pack.limits.min}–${pack.limits.max} Stationen.
  2. Stationstexte schreiben (stationen/*.js), Vorbild: packs/_vorlage/.
  3. Prüfen: node tools/check-pack.mjs ${id}   (meldet jedes verbliebene TODO als Fehler)
  4. Layout: node tools/layout-map.mjs ${id}`);

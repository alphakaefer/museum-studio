// Leitet aus einem Paket ein kleineres ab: nur die gewählten Reisen und die Stationen, die auf mindestens einer davon liegen.
// Aufruf: node tools/derive-pack.mjs <quelle> <ziel-id> --journeys=a,b,c [--title="…"]
//   - plan.json, orders, journeys.js, cross-Sätze und Stationsdateien werden auf die gewählten Reisen beschnitten
//   - material.js, quellen.txt/blog-urls.txt und die blog-Felder der Stationen entfallen (keine Verweise nach außen)
//   - Exponate bleiben nur, wenn ihre Station bleibt (Dateien exhibits/<id>.js und visuals/<station>.js werden kopiert)
//   - pack.json wird neu geschrieben, limits werden begründet angepasst, layout.js wird neu berechnet, am Ende läuft check-pack
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ROOT, SLUG, newReport, resolvePack, loadPackJson, loadPlan, loadJourneysJs, loadStations, limitsOf, exhibitsOf } from './check-lib.mjs';

const pos = process.argv.slice(2).filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
const die = m => { console.error('✗ ' + m); process.exit(2); };
if (pos.length < 2 || typeof flags.journeys !== 'string') die('Aufruf: node tools/derive-pack.mjs <quelle> <ziel-id> --journeys=a,b,c [--title="…"]');

const SRC = resolvePack(pos[0]);
const tid = pos[1];
if (!fs.existsSync(SRC.dir)) die(`Quellpaket ${pos[0]} nicht gefunden.`);
if (!SLUG.test(tid)) die(`Ziel-ID „${tid}“ ungültig (Kleinbuchstaben, Ziffern, Bindestriche).`);
const DST = resolvePack(tid);
if (DST.dir === SRC.dir) die('Quelle und Ziel sind identisch.');
if (fs.existsSync(DST.dir) && fs.readdirSync(DST.dir).length) {
  if (!flags.force) die(`${DST.rel()} existiert schon und ist nicht leer. Mit --force wird es vorher gelöscht.`);
  fs.rmSync(DST.dir, { recursive: true, force: true });
}

const R = newReport();
const plan = loadPlan(SRC, R);
if (!plan) die(R.errors.join('\n'));
const spack = loadPackJson(SRC, R) || {};
const sJ = loadJourneysJs(SRC, R);
if (!sJ) die(R.errors.join('\n'));
const st = loadStations(SRC, R);
if (R.errors.length) die(R.errors.join('\n'));

const want = flags.journeys.split(',').map(x => x.trim()).filter(Boolean);
for (const j of want) if (!plan.orders[j]) die(`Reise „${j}“ gibt es in ${SRC.rel('plan.json')} nicht. Vorhanden: ${Object.keys(plan.orders).join(', ')}`);
if (new Set(want).size !== want.length) die('--journeys enthält eine Reise doppelt.');
const wantSet = new Set(want);

// ---- Plan
const keep = plan.stations.filter(s => s.journeys.some(j => wantSet.has(j)));
const keepIds = new Set(keep.map(s => s.id));
const nPlan = {
  journeys: plan.journeys.filter(j => wantSet.has(j.id)),
  stations: keep.map(s => { const o = { ...s, journeys: s.journeys.filter(j => wantSet.has(j)) }; delete o.blog; return o; }), // blog-Verweise entfallen
  orders: Object.fromEntries(plan.journeys.filter(j => wantSet.has(j.id)).map(j => [j.id, plan.orders[j.id].filter(id => keepIds.has(id))]))
};
// Reihenfolge der Reisen wie in der Quelle (journeys.js bestimmt die Anzeige)
const nJ = sJ.filter(j => wantSet.has(j.id));

// ---- Stationen
const homeOf = {};
const byHome = {};
for (const s of nPlan.stations) { homeOf[s.id] = s.journeys[0]; (byHome[s.journeys[0]] = byHome[s.journeys[0]] || []).push(s.id); }
const stationFiles = {};
let missingText = [];
for (const [home, ids] of Object.entries(byHome)) {
  const obj = {};
  for (const id of ids) {
    const src = st.all[id];
    if (!src) { missingText.push(id); continue; }
    const p = nPlan.stations.find(s => s.id === id);
    const s = { ...src, journeys: p.journeys.slice() };
    delete s.blog;
    const cross = {};
    for (const [j, t] of Object.entries(src.cross || {})) if (p.journeys.includes(j) && j !== p.journeys[0]) cross[j] = t;
    s.cross = cross;
    obj[id] = s;
  }
  stationFiles[home] = obj;
}
if (missingText.length) die('Für diese Stationen fehlt der Text in der Quelle: ' + missingText.join(', '));

// ---- Exponate und Abbildungen
const usedEx = [...new Set(nPlan.stations.map(s => s.exhibit).filter(Boolean))];
const copies = [];
for (const id of usedEx) copies.push(['exhibits/' + id + '.js']);
for (const s of nPlan.stations) if (fs.existsSync(path.join(SRC.dir, 'visuals', s.id + '.js'))) copies.push(['visuals/' + s.id + '.js']);
const missingCopy = copies.filter(([f]) => !fs.existsSync(path.join(SRC.dir, f)));
if (missingCopy.length) die('Dateien fehlen in der Quelle: ' + missingCopy.map(c => c[0]).join(', '));

// ---- Grenzen
const lim = limitsOf(spack);
const counts = Object.fromEntries(Object.entries(nPlan.orders).map(([j, o]) => [j, o.length]));
const cmin = Math.min(...Object.values(counts)), cmax = Math.max(...Object.values(counts));
const nb = Object.fromEntries(Object.keys(nPlan.orders).map(j => [j, new Set()]));
for (const s of nPlan.stations) for (const a of s.journeys) for (const b of s.journeys) if (a !== b) nb[a].add(b);
const needDefault = Object.keys(nb).length >= 6 ? 4 : Math.min(1, Object.keys(nb).length - 1);
const minNb = Math.min(...Object.values(nb).map(x => x.size));
const limits = { min: lim.min, max: lim.max };
const notes = [];
if (cmin < lim.min) { limits.min = cmin; notes.push(`min ${cmin}: die kleinste Reise hat nur ${cmin} Stationen`); }
if (cmax > lim.max) { limits.max = cmax; notes.push(`max ${cmax}: die größte Reise hat ${cmax} Stationen`); }
if (minNb < needDefault) { limits.minCrossJourneys = minNb; notes.push(`minCrossJourneys ${minNb}: nicht jede Reise kreuzt ${needDefault} andere`); }

// ---- pack.json
const title = typeof flags.title === 'string' ? flags.title : `${spack.title || SRC.name} (Beispiel)`;
const names = nJ.map(j => j.name);
const OVERRIDE = ['_hinweis', 'id', 'title', 'pageTitle', 'description', 'eyebrow', 'exhibits', 'limits', 'stationFiles', 'grandTour', 'vocab', '_hinweis_limits'];
const pack = { _hinweis: `Abgeleitet aus „${SRC.name}“ mit node tools/derive-pack.mjs ${SRC.name} ${tid} --journeys=${want.join(',')}. Felder mit _ sind Kommentare.` };
Object.assign(pack, { id: tid, title });
for (const [k, v] of Object.entries(spack)) if (!OVERRIDE.includes(k)) pack[k] = v;
pack.eyebrow = `Auszug: ${want.length} von ${plan.journeys.length} Reisen aus „${spack.title || SRC.name}“`;
pack.pageTitle = `${title} – ${want.length} Reisen, ${nPlan.stations.length} Stationen`;
pack.description = `Beispielpaket des Museum-Studio-Frameworks: ein Auszug aus „${spack.title || SRC.name}“ mit ${want.length} Reisen (${names.join(', ')}) und ${nPlan.stations.length} Stationen, mit Exponaten, Netzplan und Reisepass.`;
if (!pack.lang) pack.lang = 'de';
if (!pack.tagline) pack.tagline = 'TODO: Untertitel';
if (spack.vocab) {
  const v = { ...spack.vocab };
  // Texte, die den Inhalt des vollständigen Pakets beschreiben, passen nicht zum Auszug
  delete v.viewTimelineLead;
  if (v.step1Text) v.step1Text = `{n} Linien führen durch ${names.join(', ')}. Such dir die aus, die dich neugierig macht.`;
  pack.vocab = v;
}
if (spack.grandTour) {
  const g = { ...spack.grandTour, start: want[0] };
  g.end = (g.end || []).filter(id => keepIds.has(id));
  if (!g.end.length) delete g.end;
  if (!g.openEnd || !keepIds.has(g.openEnd)) { delete g.openEnd; delete g.outroOpen; }
  pack.grandTour = g;
}
pack.stationFiles = Object.keys(stationFiles).map(h => h);
pack.exhibits = usedEx;
pack.limits = limits;
if (notes.length) pack._hinweis_limits = 'Grenzen angepasst, weil der Auszug kleiner ist als das vollständige Paket (Standard: 11–28 Stationen je Reise, mehrere Kreuzungen je Reise): ' + notes.join('; ') + '.';

// ---- Schreiben
const w = (rel, txt) => { const f = path.join(DST.dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); };
w('pack.json', JSON.stringify(pack, null, 2) + '\n');
w('plan.json', JSON.stringify(nPlan, null, 1) + '\n');
w('journeys.js', `// Reise-Daten (aus „${SRC.name}“ abgeleitet). Schema: docs/ARCHITEKTUR.md\n(function(){'use strict';\nwindow.MUSEUM=window.MUSEUM||{};\nMUSEUM.data=MUSEUM.data||{};\nMUSEUM.data.journeys=[\n${nJ.map(j => JSON.stringify(j, null, 2)).join(',\n')}\n];\n})();\n`);
for (const [home, obj] of Object.entries(stationFiles)) {
  w(`stationen/${home}.js`, `// Stationen der Reise „${home}“ (Heimat-Reise), abgeleitet aus „${SRC.name}“.\n(function(){\n'use strict';\nwindow.MUSEUM = window.MUSEUM || {};\nwindow.MUSEUM.addStations(${JSON.stringify(obj, null, 2)});\n})();\n`);
}
for (const [f] of copies) { fs.mkdirSync(path.dirname(path.join(DST.dir, f)), { recursive: true }); fs.copyFileSync(path.join(SRC.dir, f), path.join(DST.dir, f)); }

console.log(`Paket ${DST.rel()} geschrieben: ${nPlan.journeys.length} Reisen (${want.join(', ')}), ${nPlan.stations.length} Stationen, ${usedEx.length} Exponate (${usedEx.join(', ') || '–'}), ${copies.length - usedEx.length} Abbildungen.`);
if (notes.length) console.log('limits angepasst: ' + notes.join('; '));

// ---- Layout und Prüfung
const lay = spawnSync(process.execPath, [path.join(ROOT, 'tools/layout-map.mjs'), tid, '--multi=4'], { stdio: ['ignore', 'inherit', 'inherit'] });
if (lay.status !== 0) console.error('! layout-map fehlgeschlagen; später nachholen: node tools/layout-map.mjs ' + tid);
const chk = spawnSync(process.execPath, [path.join(ROOT, 'tools/check-pack.mjs'), tid], { stdio: 'inherit' });
process.exit(chk.status || 0);

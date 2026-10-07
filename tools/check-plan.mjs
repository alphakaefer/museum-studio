// Prüft packs/<paket>/plan.json (Struktur, Reisen, Kreuzungen, Chronologie, Exponate).
// Aufruf: node tools/check-plan.mjs <paket>
// Grenzen (Stationen je Reise) stehen in pack.json "limits" {min,max}; Standard 11–28.
// Exponat-IDs stammen aus pack.json "exhibits".
import fs from 'fs';
import path from 'path';
import { newReport, loadPlan, loadPackJson, limitsOf, exhibitsOf, packFromArgv, finish, isMain, SLUG, KINDS } from './check-lib.mjs';

export function checkPlan(P) {
  const R = newReport();
  const planRel = P.rel('plan.json');
  const plan = loadPlan(P, R);
  if (!plan) return R;
  const pack = loadPackJson(P, R) || null;
  if (!pack) R.warn(`${P.rel('pack.json')} fehlt oder ist defekt: Standardgrenzen 11–28 und keine Exponate angenommen.`);
  const { min, max, minCrossJourneys } = limitsOf(pack);
  const EXH = exhibitsOf(pack);
  const JOURNEYS = Array.isArray(plan.journeys) ? plan.journeys : [];
  const STATIONS = Array.isArray(plan.stations) ? plan.stations : [];
  if (!Array.isArray(plan.stations)) R.err(`${planRel}: "stations" fehlt oder ist kein Array.`);
  if (!plan.orders || typeof plan.orders !== 'object') { R.err(`${planRel}: "orders" fehlt (Objekt {reiseId:[stationIds]}).`); return R; }
  if (!JOURNEYS.length) R.err(`${planRel}: "journeys" fehlt oder ist leer (Liste von {id,typ,name}).`);
  const JIDS = Object.keys(plan.orders);
  const HIST = JOURNEYS.filter(j => j.typ === 'historisch').map(j => j.id);

  const byId = {};
  for (const s of STATIONS) {
    if (!s || typeof s.id !== 'string') { R.err(`${planRel}: Eine Station hat keine "id".`); continue; }
    if (!SLUG.test(s.id)) R.err(`${planRel}: Station „${s.id}“: ungültige ID (erlaubt: Kleinbuchstaben, Ziffern, Bindestriche, ohne Umlaute).`);
    if (byId[s.id]) R.err(`${planRel}: Station „${s.id}“ kommt doppelt vor.`);
    byId[s.id] = s;
    if (!s.title) R.err(`${planRel}: Station „${s.id}“: "title" fehlt.`);
    if (!KINDS.includes(s.kind)) R.err(`${planRel}: Station „${s.id}“: kind „${s.kind}“ ungültig (erlaubt: ${KINDS.join(', ')}).`);
    if (!s.why || typeof s.why !== 'string') R.err(`${planRel}: Station „${s.id}“: "why" fehlt (ein Satz, warum die Station hier steht).`);
    if (!Array.isArray(s.journeys) || !s.journeys.length) R.err(`${planRel}: Station „${s.id}“: "journeys" fehlt oder ist leer.`);
  }
  const jseen = new Set();
  for (const j of JOURNEYS) {
    if (!j.id || !SLUG.test(j.id)) R.err(`${planRel}: Reise mit ungültiger id „${j.id}“.`);
    if (jseen.has(j.id)) R.err(`${planRel}: Reise „${j.id}“ steht doppelt in "journeys".`);
    jseen.add(j.id);
    if (j.typ !== 'funktional' && j.typ !== 'historisch') R.err(`${planRel}: Reise „${j.id}“: typ „${j.typ}“ ungültig (erlaubt: funktional, historisch).`);
    if (!j.name) R.err(`${planRel}: Reise „${j.id}“: "name" fehlt.`);
    if (!JIDS.includes(j.id)) R.err(`${planRel}: "orders" fehlt für Reise „${j.id}“.`);
  }
  for (const j of JIDS) if (!JOURNEYS.find(x => x.id === j)) R.err(`${planRel}: orders enthält Reise „${j}“, die nicht in "journeys" steht.`);

  const appears = {};
  for (const j of JIDS) {
    const o = Array.isArray(plan.orders[j]) ? plan.orders[j] : [];
    if (!Array.isArray(plan.orders[j])) R.err(`${planRel}: orders.${j} ist kein Array.`);
    if (o.length < min || o.length > max) R.err(`${planRel}: Reise „${j}“ hat ${o.length} Stationen (erlaubt ${min}–${max}; Grenzen in pack.json "limits" anpassbar).`);
    if (new Set(o).size !== o.length) R.err(`${planRel}: Reise „${j}“: eine Station kommt in orders doppelt vor.`);
    for (const id of o) { if (!byId[id]) R.err(`${planRel}: Reise „${j}“ verweist auf unbekannte Station „${id}“.`); else (appears[id] = appears[id] || new Set()).add(j); }
  }
  for (const s of STATIONS) {
    if (!s || !Array.isArray(s.journeys)) continue;
    const a = [...(appears[s.id] || [])].sort().join(','), b = [...new Set(s.journeys)].sort().join(',');
    if (!a) R.err(`${planRel}: Station „${s.id}“ steht in keiner Reihenfolge (orders), also auf keiner Reise (Waise). Trage sie in orders ein oder lösche sie.`);
    else if (a !== b) R.err(`${planRel}: Station „${s.id}“: journeys [${b}] passen nicht zu orders [${a}]. orders ist die Wahrheit; gleiche das Feld "journeys" an.`);
    if (s.journeys.some(j => HIST.includes(j)) && !(typeof s.year === 'number' && s.year !== 0 && s.yearLabel)) R.err(`${planRel}: Station „${s.id}“ liegt auf einer historischen Reise und braucht "year" (Zahl, ≠ 0, v. Chr. negativ) und "yearLabel".`);
    if (s.exhibit && !EXH.includes(s.exhibit)) R.err(`${planRel}: Station „${s.id}“: Exponat „${s.exhibit}“ steht nicht in pack.json "exhibits" (${EXH.join(', ') || 'leer'}). Trage die ID dort ein, lege exhibits/${s.exhibit}.js an und setze dieselbe ID in der Stationsdatei (exhibit:\'${s.exhibit}\').`);
  }
  for (const h of HIST) {
    const o = plan.orders[h] || [];
    const ys = o.map(id => byId[id] && byId[id].year);
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1]) { R.err(`${planRel}: Historische Reise „${h}“ ist nicht chronologisch bei Station „${o[i]}“ (${ys[i]} nach ${ys[i - 1]}).`); break; }
  }
  const used = STATIONS.map(s => s.exhibit).filter(Boolean);
  const dupEx = used.filter((e, i) => used.indexOf(e) !== i);
  if (dupEx.length) R.err(`${planRel}: Exponat mehrfach vergeben: ${[...new Set(dupEx)].join(', ')} (jedes Exponat gehört genau einer Station).`);
  for (const e of EXH) if (!used.includes(e)) R.err(`${planRel}: Exponat „${e}“ steht in pack.json "exhibits", aber keine Station hat "exhibit":"${e}". Eintrag aus pack.json entfernen oder einer Station zuweisen.`);

  const cross = STATIONS.filter(s => Array.isArray(s.journeys) && new Set(s.journeys).size >= 2);
  const nb = {}; for (const j of JIDS) nb[j] = new Set();
  for (const s of cross) for (const a of s.journeys) for (const b of s.journeys) if (a !== b && nb[a]) nb[a].add(b);
  const need = minCrossJourneys !== null ? minCrossJourneys : (JIDS.length >= 6 ? 4 : Math.min(1, JIDS.length - 1));
  for (const j of JIDS) if (nb[j].size < need) R.err(`${planRel}: Reise „${j}“ kreuzt nur ${nb[j].size} andere Reise(n), verlangt sind mindestens ${need} (Umsteigen ist der Kern des Netzes; füge Kreuzungsstationen hinzu oder setze in pack.json limits.minCrossJourneys).`);
  if (JIDS.length) {
    const seen = new Set([JIDS[0]]), q = [JIDS[0]];
    while (q.length) { const x = q.pop(); for (const y of nb[x]) if (!seen.has(y)) { seen.add(y); q.push(y); } }
    if (seen.size !== JIDS.length) R.err(`${planRel}: Der Reise-Graph ist nicht zusammenhängend (nicht erreichbar von „${JIDS[0]}“: ${JIDS.filter(j => !seen.has(j)).join(', ')}). Jede Reise muss über Kreuzungen erreichbar sein.`);
  }
  R.info = { reisen: JIDS.length, stationen: STATIONS.length, kreuzungen: cross.length, plan: { byId, JIDS, cross, HIST } };
  return R;
}

if (isMain(import.meta.url)) {
  const { P } = packFromArgv('check-plan.mjs');
  const R = checkPlan(P);
  const i = R.info;
  finish(R, 'Plan ok', i.reisen !== undefined ? `Reisen ${i.reisen}, Stationen ${i.stationen}, Kreuzungen ${i.kreuzungen}` : null);
}

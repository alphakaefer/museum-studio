// Prüft packs/<paket>/stationen/*.js gegen plan.json (Schema aus docs/ARCHITEKTUR.md).
// Aufruf: node tools/check-data.mjs <paket> [stationsdatei ...]
// Icon-Schlüssel aus engine/js/icons.js, Exponate aus pack.json "exhibits", Links gegen quellen.txt (falls vorhanden, sonst nur "https://…" wohlgeformt).
import fs from 'fs';
import path from 'path';
import { newReport, loadPlan, loadPackJson, exhibitsOf, loadStations, loadSources, iconKeys, wellFormedHttps, wordCount, findTodos, packFromArgv, finish, isMain, KINDS } from './check-lib.mjs';

export const WORDS_MIN = 90, WORDS_MAX = 200, WORDS_TARGET = 190, FACT_MAX = 160;

export function checkData(P, onlyFiles) {
  const R = newReport();
  const plan = loadPlan(P, R);
  if (!plan) return R;
  const pack = loadPackJson(P, R) || null;
  const EXH = exhibitsOf(pack);
  const planBy = Object.fromEntries((plan.stations || []).map(s => [s.id, s]));
  const sources = loadSources(P);
  const ICONS = iconKeys();
  if (!ICONS) R.warn('engine/js/icons.js: Icon-Schlüssel nicht lesbar, Icons werden nicht geprüft.');
  const st = loadStations(P, R, onlyFiles);
  if (!st.exists && !(onlyFiles && onlyFiles.length)) R.err(`${P.rel('stationen')}: Ordner fehlt. Die Stationstexte stehen in stationen/*.js (MUSEUM.addStations({...})).`);
  for (const d of st.dupes) R.err(`${d.rel}: Station „${d.id}“ ist doppelt definiert (auch in ${d.first}). Jede Station nur einmal.`);
  let total = 0;
  for (const f of st.files) {
    for (const id of f.ids) {
      const s = st.all[id];
      total++;
      const E = m => R.err(`${f.rel}, Station „${id}“: ${m}`);
      const W = m => R.warn(`${f.rel}, Station „${id}“: ${m}`);
      if (!s || typeof s !== 'object') { E('Wert ist kein Objekt.'); continue; }
      const Pl = planBy[id];
      if (!Pl) { E('steht nicht in plan.json (stations). Entweder dort eintragen (und in orders) oder die Station hier löschen.'); continue; }
      const todos = findTodos(s);
      if (todos.length) E(`enthält noch Platzhalter „TODO“ in: ${todos.join(', ')}. Ersetze jedes TODO durch echten Inhalt (Hinweise dazu in den TODO-Texten, Regeln in docs/INHALT-SCHREIBEN.md).`);
      if (s.id !== id) E(`Feld id „${s.id}“ passt nicht zum Schlüssel „${id}“.`);
      if (!s.title) E('title fehlt.');
      if (JSON.stringify(s.journeys) !== JSON.stringify(Pl.journeys)) E(`journeys ${JSON.stringify(s.journeys)} weichen vom Plan ab ${JSON.stringify(Pl.journeys)} (Reihenfolge zählt, die erste ist die Heimat-Reise).`);
      if (!KINDS.includes(s.kind)) E(`kind „${s.kind}“ ungültig (erlaubt: ${KINDS.join(', ')}).`);
      if (s.kind !== Pl.kind) E(`kind „${s.kind}“ weicht vom Plan ab („${Pl.kind}“).`);
      if (Pl.year !== undefined && s.year !== Pl.year) E(`year ${s.year} weicht vom Plan ab (${Pl.year}).`);
      if (Pl.year !== undefined && !s.yearLabel) E('yearLabel fehlt (Pflicht bei Stationen mit Jahr).');
      if (ICONS && !ICONS.has(s.icon)) E(`unbekanntes Icon „${s.icon}“ (gültige Schlüssel stehen in engine/js/icons.js, z. B. ${[...ICONS].slice(0, 6).join(', ')}).`);
      if (!s.teaser) E('teaser fehlt (ein Satz, höchstens 140 Zeichen).');
      else if (s.teaser.length > 140) E(`teaser ist ${s.teaser.length} Zeichen lang (erlaubt ≤ 140, also ${s.teaser.length - 140} zu viel): „${s.teaser.slice(0, 50)}…“`);
      if (!Array.isArray(s.text)) E('text fehlt oder ist keine Liste von Absätzen.');
      else if (s.text.length < 2 || s.text.length > 4) E(`text hat ${s.text.length} Absätze (nötig: 2–4).`);
      else {
        const w = wordCount(s.text.join(' '));
        // Wortgrenze: Fehler außerhalb 90–200 (Ziel 90–190); bei Platzhaltern wird sie nicht geprüft, dort meldet schon das TODO
        if (w < WORDS_MIN && !todos.length) E(`text hat ${w} Wörter, ${WORDS_MIN - w} zu wenig (erlaubt ${WORDS_MIN}–${WORDS_MAX}, Ziel ${WORDS_MIN}–${WORDS_TARGET}). Absätze: ${s.text.map(p => wordCount(p)).join(' + ')} Wörter.`);
        else if (w > WORDS_MAX && !todos.length) E(`text hat ${w} Wörter, ${w - WORDS_MAX} zu viel (erlaubt ${WORDS_MIN}–${WORDS_MAX}, Ziel ${WORDS_MIN}–${WORDS_TARGET}). Absätze: ${s.text.map(p => wordCount(p)).join(' + ')} Wörter. Kürzen oder in zwei Stationen teilen.`);
        if (s.text.some(p => typeof p !== 'string' || !p.trim())) E('text enthält einen leeren oder nicht-textuellen Absatz.');
        else {
          const joined = s.text.join(' ');
          if (/"/.test(joined)) W('gerade Anführungszeichen " im Text; typografisch korrekt wären „…“.');
          if (/ {2,}/.test(joined)) W('doppelte Leerzeichen im Text.');
        }
      }
      if (!Array.isArray(s.facts)) E('facts fehlt oder ist keine Liste (2–4 Einträge, je ≤ 160 Zeichen).');
      else {
        if (s.facts.length < 2 || s.facts.length > 4) E(`facts hat ${s.facts.length} Einträge (nötig: 2–4).`);
        s.facts.forEach((x, i) => {
          if (typeof x !== 'string' || !x.trim()) E(`facts[${i}] ist leer oder kein Text.`);
          else if (x.length > FACT_MAX) E(`facts[${i}] ist ${x.length} Zeichen lang (erlaubt ≤ ${FACT_MAX}, ${x.length - FACT_MAX} zu viel): „${x.slice(0, 50)}…“`);
        });
      }
      if (s.quote && !(s.quote.text && s.quote.who && s.quote.src)) E('quote unvollständig (text, who, src nötig) oder null setzen.');
      if (s.quote === undefined) W('quote fehlt; setze quote:null, wenn es kein sicher belegtes Zitat gibt.');
      if (s.kind === 'mythos' && !(s.myth && s.myth.glaube && s.myth.wahrheit)) E('kind "mythos" braucht myth:{glaube,wahrheit}.');
      const home = Pl.journeys[0];
      for (const j of Pl.journeys) if (j !== home && (!s.cross || !s.cross[j])) E(`cross['${j}'] fehlt (ein konkreter Satz, warum hier zur Reise „${j}“ umgestiegen wird).`);
      if (s.cross) for (const [j, t] of Object.entries(s.cross)) {
        if (!Pl.journeys.includes(j)) E(`cross enthält die Reise „${j}“, die nicht zur Station gehört.`);
        if ((!t || t.length < 20) && !todos.length) E(`cross['${j}'] ist zu kurz (mindestens ein konkreter Satz, ≥ 20 Zeichen).`);
      }
      // Exponat: Plan, Stationsdatei und pack.json müssen dasselbe sagen (drei Stellen: plan.json "exhibit", Station "exhibit", pack.json "exhibits")
      const exPlan = Pl.exhibit || null, exSt = s.exhibit || null;
      if (exPlan !== exSt) {
        if (exPlan && !exSt) E(`plan.json nennt für diese Station das Exponat „${exPlan}“, die Station hat aber exhibit:null. Trage in der Stationsdatei exhibit:'${exPlan}' ein (oder entferne "exhibit" im Plan und das Exponat aus pack.json "exhibits").`);
        else if (!exPlan && exSt) E(`die Station nennt exhibit:'${exSt}', plan.json hat bei dieser Station aber kein "exhibit". Trage "exhibit":"${exSt}" bei der Station in plan.json ein (und „${exSt}“ in pack.json "exhibits"), oder setze hier exhibit:null.`);
        else E(`exhibit '${exSt}' in der Stationsdatei, aber "exhibit":"${exPlan}" im Plan. Beide müssen dieselbe Exponat-ID tragen.`);
      }
      if (exSt && !EXH.includes(exSt)) E(`Exponat „${exSt}“ steht nicht in pack.json "exhibits" (${EXH.join(', ') || 'leer'}). Trage die ID dort ein und lege exhibits/${exSt}.js an.`);
      const blog = s.blog || [];
      if (!Array.isArray(blog)) E('blog muss ein Array sein.');
      else {
        if (blog.length > 3) E('blog: höchstens 3 Links.');
        for (const b of blog) {
          if (!b || !b.t || !b.u) { E(`blog-Eintrag unvollständig (t und u nötig): ${JSON.stringify(b)}`); continue; }
          if (!wellFormedHttps(b.u)) E(`blog-Link keine wohlgeformte https-URL: ${b.u}`);
          else if (sources && !sources.has(b.u)) E(`blog-Link nicht in ${P.rel('quellen.txt')} erlaubt: ${b.u}`);
        }
      }
      if (!Array.isArray(s.further)) E('further fehlt oder ist keine Liste (1–3 Lesetipps als Text, nur real existierende Werke).');
      else {
        if (s.further.length < 1 || s.further.length > 3) E(`further hat ${s.further.length} Einträge (nötig: 1–3 Lesetipps, nur real existierende Werke).`);
        s.further.forEach((x, i) => { if (typeof x !== 'string' || !x.trim()) E(`further[${i}] ist leer oder kein Text.`); });
      }
    }
  }
  R.info = { stationsdateien: st.files.length, stationen: total, geladen: st };
  return R;
}

if (isMain(import.meta.url)) {
  const { P, rest } = packFromArgv('check-data.mjs', ' [stationsdatei …]');
  const R = checkData(P, rest);
  finish(R, `${R.info.stationen} Stationen ok`);
}

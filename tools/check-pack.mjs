// Prüft ein Museum-Studio-Paket vollständig: pack.json, plan.json, journeys.js, stationen/*.js, material.js, exhibits, visuals, layout.js.
// Aufruf: node tools/check-pack.mjs <paket>      (Exit-Code 1 bei Fehlern; Warnungen allein sind kein Fehler)
// Ruft check-plan, check-data und check-material auf und ergänzt Konsistenzprüfungen zwischen den Dateien.
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { VISUAL_KINDS, newReport, loadPackJson, loadPlan, loadJourneysJs, loadStations, exhibitsOf, limitsOf, iconKeys, findTodos, contrast, SLUG, KINDS, packFromArgv, isMain, ROOT } from './check-lib.mjs';
import { checkPlan } from './check-plan.mjs';
import { checkData } from './check-data.mjs';
import { checkMaterial } from './check-material.mjs';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const BG_LIGHT = '#F6F2EA', BG_DARK = '#0E1420';

function syntaxOnly(file, rel, R, what) {
  try { new vm.Script(fs.readFileSync(file, 'utf8'), { filename: rel }); return true; }
  catch (e) { R.err(`${rel}: ${what} nicht lesbar (Syntaxfehler: ${e.message}).`); return false; }
}

export function checkPack(P, opts = {}) {
  const R = newReport();
  const add = sub => { for (const e of sub.errors) if (!R.errors.includes(e)) R.errors.push(e); for (const w of sub.warnings) if (!R.warnings.includes(w)) R.warnings.push(w); };

  // ---- pack.json
  const packRel = P.rel('pack.json');
  const pack = loadPackJson(P, R);
  if (pack === null) R.err(`${packRel}: Datei fehlt. Pflicht sind id, title, tagline, lang (siehe packs/_vorlage/pack.json).`);
  if (pack) {
    if (typeof pack !== 'object' || Array.isArray(pack)) R.err(`${packRel}: muss ein JSON-Objekt sein.`);
    else {
      for (const k of ['id', 'title', 'tagline', 'lang']) if (typeof pack[k] !== 'string' || !pack[k].trim()) R.err(`${packRel}: Pflichtfeld "${k}" fehlt oder ist leer.`);
      if (typeof pack.id === 'string' && pack.id) {
        if (!/^_?[a-z0-9]+(-[a-z0-9]+)*$/.test(pack.id)) R.err(`${packRel}: id „${pack.id}“ ungültig (Kleinbuchstaben, Ziffern, Bindestriche; ein führender Unterstrich ist nur für Vorlagen üblich).`);
        if (pack.id !== P.name) R.err(`${packRel}: id „${pack.id}“ muss dem Ordnernamen „${P.name}“ entsprechen.`);
      }
      if (typeof pack.title === 'string' && pack.title.trim().length > 30) R.warn(`${packRel}: title ist ${pack.title.trim().length} Zeichen lang (Richtwert ≈ 24, Warnung ab 30): „${pack.title}“. Lange Namen brechen Kopfleiste und Eingang einiger Skins um oder kürzen sie. Halte den Namen kurz und setze den Untertitel in "eyebrow" oder "tagline".`);
      if (typeof pack.lang === 'string' && !/^[a-z]{2}(-[A-Za-z]{2,})?$/.test(pack.lang)) R.err(`${packRel}: lang „${pack.lang}“ ist kein Sprachcode wie "de" oder "en".`);
      for (const k of ['eyebrow', 'defaultSkin', 'footer', 'license', 'credits']) if (pack[k] === undefined) R.warn(`${packRel}: empfohlenes Feld "${k}" fehlt (Engine nutzt Standardwerte).`);
      for (const k of ['eyebrow', 'defaultSkin', 'license']) if (pack[k] !== undefined && typeof pack[k] !== 'string') R.err(`${packRel}: "${k}" muss Text sein.`);
      const ft = pack.footer;
      if (ft !== undefined) {
        if (typeof ft === 'string') { if (/<[a-z][^>]*>/i.test(ft)) R.err(`${packRel}: "footer" darf kein HTML enthalten (nur Text; Links als [Text](https://…)).`); }
        else if (ft && Array.isArray(ft.columns)) ft.columns.forEach((c, i) => { if (!c || typeof c.title !== 'string' || !Array.isArray(c.paragraphs) || c.paragraphs.some(x => typeof x !== 'string')) R.err(`${packRel}: footer.columns[${i}] braucht "title" (Text) und "paragraphs" (Liste von Texten).`); });
        else R.err(`${packRel}: "footer" muss Text sein oder {columns:[{title,paragraphs:[…]}]}.`);
      }
      if (pack.stationFiles !== undefined) {
        if (!Array.isArray(pack.stationFiles)) R.err(`${packRel}: "stationFiles" muss eine Liste von Dateinamen (ohne .js) sein.`);
        else {
          for (const n of pack.stationFiles) if (!fs.existsSync(path.join(P.dir, 'stationen', n + '.js'))) R.err(`${packRel}: stationFiles nennt „${n}“, aber ${P.rel('stationen/' + n + '.js')} fehlt.`);
          const dir = path.join(P.dir, 'stationen');
          if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) if (!pack.stationFiles.includes(f.slice(0, -3))) R.warn(`${P.rel('stationen/' + f)} steht nicht in pack.json "stationFiles"; sie wird trotzdem eingebunden, aber hinter den aufgeführten Dateien (Ladereihenfolge).`);
        }
      }
      if (pack.credits !== undefined && typeof pack.credits !== 'string' && !Array.isArray(pack.credits)) R.err(`${packRel}: "credits" muss Text oder Liste sein.`);
      if (pack.vocab === undefined) R.warn(`${packRel}: "vocab" fehlt (Wortschatz journey/journeys/station/stations …); es gelten die deutschen Standardwerte.`);
      else if (!pack.vocab || typeof pack.vocab !== 'object' || Array.isArray(pack.vocab)) R.err(`${packRel}: "vocab" muss ein Objekt sein, z. B. {"journey":"Reise","journeys":"Reisen","station":"Station","stations":"Stationen"}.`);
      else {
        for (const [k, v] of Object.entries(pack.vocab)) if (typeof v !== 'string' || !v.trim()) R.err(`${packRel}: vocab.${k} muss ein nichtleerer Text sein.`);
        for (const k of ['journey', 'journeys', 'station', 'stations']) if (!pack.vocab[k]) R.warn(`${packRel}: vocab.${k} fehlt (Standardwert wird genutzt).`);
      }
      if (pack.journeyTypes !== undefined && (typeof pack.journeyTypes !== 'object' || !pack.journeyTypes)) R.err(`${packRel}: "journeyTypes" muss ein Objekt {funktional:'…', historisch:'…'} sein.`);
      if (pack.exhibits !== undefined && (!Array.isArray(pack.exhibits) || pack.exhibits.some(x => typeof x !== 'string' || !SLUG.test(x)))) R.err(`${packRel}: "exhibits" muss eine Liste von IDs sein (Kleinbuchstaben, Bindestriche).`);
      if (pack.limits !== undefined) {
        const l = pack.limits;
        if (!l || typeof l !== 'object' || (l.min !== undefined && !Number.isInteger(l.min)) || (l.max !== undefined && !Number.isInteger(l.max))) R.err(`${packRel}: "limits" muss {"min":Zahl,"max":Zahl} sein.`);
        else { const { min, max } = limitsOf(pack); if (min > max) R.err(`${packRel}: limits.min (${min}) ist größer als limits.max (${max}).`); if (min < 2) R.err(`${packRel}: limits.min muss mindestens 2 sein.`); }
      }
      if (pack.limits && pack.limits.visualShare !== undefined && !(typeof pack.limits.visualShare === 'number' && pack.limits.visualShare >= 0 && pack.limits.visualShare <= 1)) R.err(`${packRel}: limits.visualShare muss eine Zahl von 0 bis 1 sein (Standard 0,3 = 30 % der Stationen mit Abbildung oder Exponat).`);
      if (pack.requireVisualPlan !== undefined && typeof pack.requireVisualPlan !== 'boolean') R.err(`${packRel}: "requireVisualPlan" muss true oder false sein.`);
      if (pack.kinds !== undefined) {
        if (!pack.kinds || typeof pack.kinds !== 'object') R.err(`${packRel}: "kinds" muss ein Objekt {art: Beschriftung} sein.`);
        else for (const k of Object.keys(pack.kinds)) if (!KINDS.includes(k)) R.err(`${packRel}: kinds.${k} ist keine Stationsart (erlaubt: ${KINDS.join(', ')}).`);
      }
      if (pack.grandTour !== undefined) {
        const g = pack.grandTour, pl = loadPlan(P, newReport());
        if (!g || typeof g !== 'object') R.err(`${packRel}: "grandTour" muss ein Objekt sein.`);
        else if (pl) {
          const jids = (pl.journeys || []).map(j => j.id), sids = new Set((pl.stations || []).map(s => s.id));
          if (g.start && !jids.includes(g.start)) R.err(`${packRel}: grandTour.start „${g.start}“ ist keine Reise aus plan.json.`);
          for (const id of [].concat(g.end || [], g.openEnd || [])) if (!sids.has(id)) R.err(`${packRel}: grandTour verweist auf unbekannte Station „${id}“.`);
        }
      }
      const todos = findTodos(pack);
      if (todos.length) R.err(`${packRel}: Platzhalter „TODO“ nicht ersetzt in: ${todos.join(', ')}.`);
    }
  }

  // ---- Teilprüfungen
  const rp = checkPlan(P); add(rp);
  const rd = checkData(P); add(rd);
  const rm = checkMaterial(P, { register: opts.register }); add(rm);
  const plan = loadPlan(P, newReport());
  const planRel = P.rel('plan.json');
  const stations = (rd.info.geladen && rd.info.geladen.all) || {};
  const owner = (rd.info.geladen && rd.info.geladen.owner) || {};

  // ---- journeys.js
  const jsRel = P.rel('journeys.js');
  const J = loadJourneysJs(P, R);
  const icons = iconKeys();
  const journeysInPlan = (plan && plan.journeys) || [];
  if (J) {
    const seenId = new Set(), seenName = new Set(), seenColor = new Map();
    J.forEach((j, i) => {
      const E = m => R.err(`${jsRel}, Reise ${j && j.id ? `„${j.id}“` : '#' + (i + 1)}: ${m}`);
      const W = m => R.warn(`${jsRel}, Reise ${j && j.id ? `„${j.id}“` : '#' + (i + 1)}: ${m}`);
      if (!j || typeof j !== 'object') { E('kein Objekt.'); return; }
      if (!j.id || !SLUG.test(j.id)) E(`id „${j.id}“ fehlt oder ist ungültig.`);
      if (seenId.has(j.id)) E('id kommt doppelt vor.'); seenId.add(j.id);
      if (j.typ !== 'funktional' && j.typ !== 'historisch') E(`typ „${j.typ}“ ungültig (funktional oder historisch).`);
      for (const k of ['name', 'kurz', 'tagline', 'intro', 'outro']) if (typeof j[k] !== 'string' || !j[k].trim()) E(`Feld "${k}" fehlt oder ist leer.`);
      if (seenName.has(j.name)) E(`name „${j.name}“ kommt doppelt vor.`); seenName.add(j.name);
      if (j.tagline && j.tagline.length > 70) E(`tagline hat ${j.tagline.length} Zeichen (erlaubt ≤ 70).`);
      if (j.kurz && j.name && j.kurz.length > 24) W(`kurz „${j.kurz}“ ist lang (${j.kurz.length} Zeichen); Kurznamen erscheinen in Chips und sollten unter ~24 Zeichen bleiben.`);
      if (icons && !icons.has(j.icon)) E(`unbekanntes Icon „${j.icon}“ (gültige Schlüssel stehen in engine/js/icons.js).`);
      const c = j.color;
      if (!c || typeof c !== 'object') E('Feld "color" fehlt. Erwartet: color:{light:\'#RRGGBB\', dark:\'#RRGGBB\'} (dunkel = aufgehellte Variante).');
      else {
        let okL = HEX.test(c.light || ''), okD = HEX.test(c.dark || '');
        if (!okL) E(`color.light „${c.light}“ ist kein #RRGGBB-Wert (sechsstellig, mit #).`);
        if (!okD) E(`color.dark „${c.dark}“ ist kein #RRGGBB-Wert (sechsstellig, mit #).`);
        if (okL) { const k = contrast(c.light, BG_LIGHT); if (k < 3) W(`color.light ${c.light} hat nur ${k.toFixed(1)}:1 Kontrast zum hellen Hintergrund (${BG_LIGHT}); nötig sind mindestens 3:1. Wähle die Farbe dunkler.`); }
        if (okD) { const k = contrast(c.dark, BG_DARK); if (k < 3) W(`color.dark ${c.dark} hat nur ${k.toFixed(1)}:1 Kontrast zum dunklen Hintergrund (${BG_DARK}); nötig sind mindestens 3:1. Wähle die Farbe heller.`); }
        if (okL) { const key = c.light.toLowerCase(); if (seenColor.has(key)) W(`color.light ${c.light} ist identisch mit der Farbe von „${seenColor.get(key)}“; Reisen sind dann nicht unterscheidbar.`); else seenColor.set(key, j.id); }
      }
      const todos = findTodos(j); if (todos.length) E(`Platzhalter „TODO“ nicht ersetzt in: ${todos.join(', ')}.`);
    });
    // Konsistenz mit plan.json
    const planIds = journeysInPlan.map(j => j.id);
    for (const j of J) if (j && j.id && !planIds.includes(j.id)) R.err(`${jsRel}: Reise „${j.id}“ steht nicht in plan.json (journeys). Dort ergänzen (mit orders) oder hier löschen.`);
    for (const pj of journeysInPlan) {
      const jj = J.find(x => x && x.id === pj.id);
      if (!jj) R.err(`${planRel}: Reise „${pj.id}“ hat keinen Eintrag in ${jsRel}. Ergänze ihn (Name, Farben, Texte).`);
      else { if (jj.typ !== pj.typ) R.err(`Reise „${pj.id}“: typ „${jj.typ}“ in ${jsRel} weicht von „${pj.typ}“ in ${planRel} ab.`); if (pj.name && jj.name !== pj.name) R.warn(`Reise „${pj.id}“: name in ${jsRel} („${jj.name}“) weicht von ${planRel} („${pj.name}“) ab.`); }
    }
    const idsJ = J.map(j => j && j.id).filter(x => planIds.includes(x)).join(','), idsP = planIds.filter(x => J.some(j => j && j.id === x)).join(',');
    if (idsJ !== idsP) R.warn(`Reihenfolge der Reisen in ${jsRel} (${idsJ}) weicht von ${planRel} ab (${idsP}); angezeigt wird die Reihenfolge aus journeys.js.`);
    if (pack && pack.journeyTypes && journeysInPlan.some(j => j.typ === 'historisch') && !pack.journeyTypes.historisch) R.warn(`${packRel}: journeyTypes.historisch fehlt, obwohl es historische Reisen gibt.`);
  }

  // ---- Plan <-> Stationsdateien
  if (plan && Array.isArray(plan.stations)) {
    const titles = new Map();
    for (const s of plan.stations) {
      if (!stations[s.id] && rd.info.stationen !== undefined) R.err(`${planRel}: Station „${s.id}“ hat keinen Text. Lege sie in stationen/*.js an (MUSEUM.addStations).`);
      if (s.title) { const t = s.title.trim().toLowerCase(); if (titles.has(t)) R.warn(`${planRel}: Stationen „${titles.get(t)}“ und „${s.id}“ haben denselben Titel (Dublette?).`); else titles.set(t, s.id); }
    }
    const teasers = new Map();
    for (const [id, s] of Object.entries(stations)) {
      if (s && s.teaser && !/\bTODO\b/.test(s.teaser)) { const t = s.teaser.trim().toLowerCase(); if (teasers.has(t)) R.warn(`${owner[id]}: Stationen „${teasers.get(t)}“ und „${id}“ haben denselben teaser.`); else teasers.set(t, id); }
    }
    const ptodo = findTodos(plan);
    if (ptodo.length) R.err(`${planRel}: Platzhalter „TODO“ nicht ersetzt in: ${ptodo.slice(0, 8).join(', ')}${ptodo.length > 8 ? ` … (${ptodo.length} Stellen)` : ''}.`);
    // Verweise in cross-Sätzen auf Reisen sind durch check-data abgedeckt; hier: Waisen und Plan-Reise ohne Stationen
    for (const j of journeysInPlan) if (!(plan.orders && (plan.orders[j.id] || []).length)) R.err(`${planRel}: Reise „${j.id}“ hat keine Stationen.`);
  }

  // ---- Exponate und Abbildungen
  const exDir = path.join(P.dir, 'exhibits'), viDir = path.join(P.dir, 'visuals');
  for (const id of exhibitsOf(pack)) {
    const f = path.join(exDir, id + '.js'), rel = P.rel('exhibits/' + id + '.js');
    if (!fs.existsSync(f)) { R.err(`${rel}: Datei fehlt, obwohl „${id}“ in pack.json "exhibits" steht. Datei anlegen oder Eintrag samt Station-Zuweisung entfernen.`); continue; }
    if (syntaxOnly(f, rel, R, 'Exponat')) { const src = fs.readFileSync(f, 'utf8'); if (!new RegExp(`exhibits\\s*(\\.\\s*${id.replace(/-/g, '\\-')}\\b|\\[\\s*['"]${id}['"]\\s*\\])`).test(src)) R.warn(`${rel}: registriert kein MUSEUM.exhibits.${id} (oder ['${id}']); das Exponat würde nicht angezeigt.`); }
  }
  if (fs.existsSync(exDir)) for (const f of fs.readdirSync(exDir).filter(f => f.endsWith('.js'))) if (!exhibitsOf(pack).includes(f.slice(0, -3))) R.warn(`${P.rel('exhibits/' + f)}: Exponat nicht in pack.json "exhibits" aufgeführt; es wird nicht eingebunden.`);
  if (fs.existsSync(viDir)) for (const f of fs.readdirSync(viDir).filter(f => f.endsWith('.js'))) {
    const rel = P.rel('visuals/' + f);
    syntaxOnly(path.join(viDir, f), rel, R, 'Abbildung');
    if (plan && !(plan.stations || []).some(s => s.id === f.slice(0, -3))) R.warn(`${rel}: Dateiname ist keine Stations-ID aus plan.json; die Abbildung wird keiner Station zugeordnet.`);
  }
  for (const f of ['material.js', 'layout.js']) {
    const ff = path.join(P.dir, f);
    if (fs.existsSync(ff)) syntaxOnly(ff, P.rel(f), R, f);
  }


  // ---- Anschauung: Plan-Feld "visual" je Station, Anteil, geplant gegen gebaut
  const anschauung = { geplant: 0, gebaut: 0, anteilGeplant: null, anteilGebaut: null, hinweise: [] };
  if (plan && Array.isArray(plan.stations) && plan.stations.length) {
    const PS = plan.stations.filter(s => s && typeof s.id === 'string');
    const need = !!(pack && pack.requireVisualPlan === true);
    const share = limitsOf(pack).visualShare;
    const hasV = id => fs.existsSync(path.join(viDir, id + '.js'));
    const hasE = s => !!(s.exhibit && exhibitsOf(pack).includes(s.exhibit) && fs.existsSync(path.join(exDir, s.exhibit + '.js')));
    const builtAny = s => hasV(s.id) || hasE(s);
    const cap = (list, n = 12) => list.slice(0, n).join(', ') + (list.length > n ? ` … (${list.length} insgesamt)` : '');
    const withField = PS.filter(s => s.visual !== undefined);
    const missing = PS.filter(s => s.visual === undefined).map(s => s.id);
    const todoKind = PS.filter(s => s.visual && s.visual.kind === 'TODO').map(s => s.id);
    const builtCount = PS.filter(builtAny).length;
    anschauung.gebaut = builtCount;
    const pct = x => Math.round(x * 100) + ' %';
    if (!withField.length) {
      anschauung.anteilGebaut = builtCount / PS.length;
      if (need) R.err(`${planRel}: pack.json verlangt einen Anschauungsplan ("requireVisualPlan": true), aber keine Station hat das Feld "visual". Entscheide für JEDE Station: {"kind":"abbildung"|"exponat"|"keine","idea":"was sieht oder tut man?","reason":"bei keine: warum nicht"} (siehe docs/AGENTEN.md, Schritt „Anschauung planen“).`);
      else R.warn(`Anschauung nicht geplant: ${planRel} hat bei keiner Station das Feld "visual". Gebaut sind ${builtCount} von ${PS.length} Stationen mit Abbildung oder Exponat (${pct(builtCount / PS.length)}; Richtwert mindestens ${pct(share)}). Plane für jede Station "visual" (docs/AGENTEN.md, Schritt „Anschauung planen“); mit pack.json "requireVisualPlan": true wird das Pflicht.`);
    } else {
      if (missing.length) {
        const m = `${planRel}: ${missing.length} Station(en) ohne Feld "visual": ${cap(missing)}. Die Entscheidung ist Pflicht, auch „keine“ mit Begründung (reason).`;
        if (need) R.err(m); else R.warn(m);
      }
      let planned = 0, builtOfPlanned = 0;
      for (const s of withField) {
        const v = s.visual, E = m => R.err(`${planRel}, Station „${s.id}“: visual ${m}`);
        if (!v || typeof v !== 'object' || Array.isArray(v)) { E('muss ein Objekt sein: {"kind":"abbildung|exponat|keine","idea":"…","reason":"…"}.'); continue; }
        if (v.kind === 'TODO') continue;
        if (!VISUAL_KINDS.includes(v.kind)) { E(`kind „${v.kind}“ ungültig (erlaubt: ${VISUAL_KINDS.join(', ')}).`); continue; }
        if (v.kind === 'keine') {
          if (typeof v.reason !== 'string' || v.reason.trim().length < 10) E('kind „keine“ braucht "reason": ein ehrlicher Satz, warum es hier nichts zu zeigen gibt.');
          if (hasV(s.id) || hasE(s)) R.warn(`${planRel}, Station „${s.id}“: visual.kind ist „keine“, aber es gibt ${hasV(s.id) ? 'eine Abbildung' : 'ein Exponat'}. Plan anpassen.`);
          continue;
        }
        if (typeof v.idea !== 'string' || v.idea.trim().length < 15) E(`kind „${v.kind}“ braucht "idea": ein Satz, was man sieht oder tut (mindestens 15 Zeichen).`);
        planned++;
        if (v.kind === 'abbildung') {
          if (hasV(s.id)) builtOfPlanned++;
          else R.warn(`${planRel}, Station „${s.id}“: Abbildung geplant (Idee: ${String(v.idea || '').length > 70 ? String(v.idea).slice(0, 70).replace(/\s+\S*$/, '') + ' …' : v.idea}), aber ${P.rel('visuals/' + s.id + '.js')} fehlt noch.`);
          if (s.exhibit) R.warn(`${planRel}, Station „${s.id}“: visual.kind ist „abbildung“, die Station hat aber auch ein Exponat („${s.exhibit}“). Zähle es als kind „exponat“ oder lass beides bewusst.`);
        } else {
          if (hasE(s)) builtOfPlanned++;
          else if (!s.exhibit) R.warn(`${planRel}, Station „${s.id}“: Exponat geplant, aber die Station hat kein Feld "exhibit". Ergänze die ID in plan.json, pack.json "exhibits" und der Stationsdatei und lege exhibits/<id>.js an.`);
          else R.warn(`${planRel}, Station „${s.id}“: Exponat „${s.exhibit}“ geplant, aber ${P.rel('exhibits/' + s.exhibit + '.js')} fehlt noch (oder die ID fehlt in pack.json "exhibits").`);
        }
      }
      anschauung.geplant = planned;
      anschauung.anteilGeplant = planned / PS.length;
      if (planned / PS.length < share && !todoKind.length) R.warn(`Anschauung: nur ${planned} von ${PS.length} Stationen (${pct(planned / PS.length)}) planen eine Abbildung oder ein Exponat; Richtwert mindestens ${pct(share)} (limits.visualShare in pack.json), also etwa ${Math.ceil(share * PS.length)}. Je abstrakter das Thema, desto mehr; Katalog der Muster: docs/AGENTEN.md.`);
      anschauung.gebaut = builtCount;
      anschauung.anteilGebaut = builtCount / PS.length;
    }
    // Hinweis (nur Info): Zahlen- oder Strukturlast im Text, aber nichts zu sehen
    const LOAD = /Prozent|\d\s?%|Matrix|Auszahlung|Kurve|Diagramm|Wahrscheinlichkeit|Verteilung|Gleichung|Formel|Größenordnung|Tabelle/i;
    const hints = [];
    for (const s of PS) {
      const v = s.visual, vis = (v && (v.kind === 'abbildung' || v.kind === 'exponat')) || builtAny(s);
      if (vis) continue;
      const st = stations[s.id]; if (!st) continue;
      const txt = [].concat(st.text || [], st.teaser || '').join(' ');
      const nums = (txt.match(/\d+[.,]?\d*/g) || []).length;
      const kw = LOAD.exec(txt);
      if (kw || nums >= 7) hints.push({ id: s.id, why: kw ? `„${kw[0]}“ im Text` : `${nums} Zahlen im Text`, decided: !!(v && v.kind === 'keine') });
    }
    anschauung.hinweise = hints.filter(h => !h.decided).slice(0, 5).map(h => `Station „${h.id}“ (${h.why}) hat keine Abbildung; vielleicht lässt sich das zeigen statt erzählen.`);
    anschauung.hinweiseMehr = Math.max(0, hints.filter(h => !h.decided).length - anschauung.hinweise.length);
  }

  // ---- layout.js
  const layoutFile = path.join(P.dir, 'layout.js');
  if (!fs.existsSync(layoutFile)) R.warn(`${P.rel('layout.js')} fehlt: die Engine rechnet das Netzplan-Layout selbst (schlechter). Erzeugen mit: node tools/layout-map.mjs ${P.name}`);
  else if (plan) {
    const ctx = { console }; ctx.window = ctx; ctx.MUSEUM = {};
    try {
      vm.runInNewContext(fs.readFileSync(layoutFile, 'utf8'), ctx, { timeout: 3000 });
      const L = ctx.MUSEUM.mapLayout;
      if (!L || !L.SEED) R.err(`${P.rel('layout.js')}: MUSEUM.mapLayout.SEED fehlt. Neu erzeugen: node tools/layout-map.mjs ${P.name}`);
      else {
        const miss = (plan.stations || []).filter(s => !L.SEED[s.id]).map(s => s.id);
        const extra = Object.keys(L.SEED).filter(id => !(plan.stations || []).some(s => s.id === id));
        if (miss.length || extra.length) R.warn(`${P.rel('layout.js')} ist veraltet (fehlt: ${miss.slice(0, 5).join(', ') || '–'}; überzählig: ${extra.slice(0, 5).join(', ') || '–'}). Neu erzeugen: node tools/layout-map.mjs ${P.name}`);
      }
    } catch (e) { R.err(`${P.rel('layout.js')}: Ladefehler (${e.message}).`); }
  }

  // ---- Zusammenfassung
  const pi = rp.info;
  R.info = {
    reisen: pi.reisen, stationen: pi.stationen, kreuzungen: pi.kreuzungen, exponate: exhibitsOf(pack).length,
    materialLinks: rm.info.links || 0, anschauung
  };
  return R;
}

if (isMain(import.meta.url)) {
  const { P, flags } = packFromArgv('check-pack.mjs');
  const R = checkPack(P, { register: flags.register === true ? undefined : flags.register });
  const i = R.info;
  console.log(`Paket „${P.name}“: ${i.reisen ?? '?'} Reisen, ${i.stationen ?? '?'} Stationen, ${i.kreuzungen ?? '?'} Kreuzungen, ${i.exponate} Exponate, ${i.materialLinks} Material-Links`);
  const A = i.anschauung;
  if (A && A.anteilGebaut !== null) console.log(`Anschauung: ${A.geplant} geplant, ${A.gebaut} gebaut (${A.anteilGeplant === null ? 'kein Plan' : Math.round(A.anteilGeplant * 100) + ' % geplant'}, ${Math.round(A.anteilGebaut * 100)} % der Stationen mit Abbildung oder Exponat)`);
  for (const w of R.warnings) console.log('! Warnung: ' + w);
  if (A && A.hinweise.length) { for (const h of A.hinweise) console.log('i Hinweis: ' + h); if (A.hinweiseMehr) console.log(`i Hinweis: … und ${A.hinweiseMehr} weitere Stationen mit Zahlen- oder Strukturlast ohne Abbildung.`); }
  for (const e of R.errors) console.log('✗ ' + e);
  console.log(R.errors.length ? `\nErgebnis: ${R.errors.length} Fehler, ${R.warnings.length} Warnungen. Bitte die Fehler beheben und erneut prüfen.` : `\n✓ Paket „${P.name}“ ist in Ordnung (${R.warnings.length} Warnungen).`);
  process.exit(R.errors.length ? 1 : 0);
}

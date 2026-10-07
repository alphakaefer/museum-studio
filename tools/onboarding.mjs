#!/usr/bin/env node
// Museum Studio – Einrichtung (Onboarding). Nur Node-Standardbibliothek.
//
//   npm run setup            oder   node tools/onboarding.mjs
//   node tools/onboarding.mjs --config=datei.json   nicht interaktiv, Felder wie in packs/<id>/BRIEFING.json
//   --yes        keine Abschlussfrage (die Fragen kommen trotzdem)
//   --defaults   keine Fragen, alle Standardwerte (mit --config: Standardwerte für fehlende Felder)
//   --dry-run    nichts schreiben, nur zeigen, was entstünde
//   --help       diese Hilfe
//
// Fragt Thema, Umfang und Rahmen eines neuen Museums ab und erzeugt daraus packs/<id>/ (über tools/new-pack.mjs) mit ausgefülltem
// pack.json, BRIEFING.md (Auftrag für KI-Agenten und Redaktion), BRIEFING.json (maschinenlesbar) und vorbefülltem ARBEITSSTAND.md.
// Geschrieben wird erst ganz am Ende und in einem Zug (nie ein halbes Paket); ein bestehendes Paket wird nie überschrieben.
// Funktioniert auch mit Antworten aus einer Pipe:  printf 'Mein Museum\n\n…' | node tools/onboarding.mjs
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { ROOT, SLUG, isMain } from './check-lib.mjs';
import { createPack, PackError } from './new-pack.mjs';
import { runDoctor, printDoctor } from './doctor.mjs';

// ───────────────────────────── Grundbausteine ─────────────────────────────

class Abort extends Error { constructor(msg, code) { super(msg); this.code = code === undefined ? 130 : code; } }
class ConfigError extends Error {}

const TEXT_SKINS = () => {
  const dir = path.join(ROOT, 'themes');
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir).sort()) {
    try { const j = JSON.parse(fs.readFileSync(path.join(dir, d, 'theme.json'), 'utf8')); out.push({ id: j.id || d, name: j.name || d, description: j.description || '' }); } catch (e) { /* kein Skin */ }
  }
  out.sort((a, b) => (a.id === 'halle' ? -1 : b.id === 'halle' ? 1 : 0));
  return out;
};

const slugify = s => {
  let t = String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  t = t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return t || 'museum';
};
const packExists = id => fs.existsSync(path.join(ROOT, 'packs', id));
const freeId = base => { if (!packExists(base)) return base; for (let i = 2; i < 100; i++) if (!packExists(`${base}-${i}`)) return `${base}-${i}`; return `${base}-${Date.now()}`; };

/** Wählt aus einer Optionsliste per Nummer oder Name (Präfix genügt). options: [{ id, aliases:[…] }] */
function pickOptions(raw, options, { multi = false } = {}) {
  const tokens = String(raw).toLowerCase().split(/[,;/+\s]+/).filter(Boolean);
  if (!tokens.length) return { error: 'Bitte etwas auswählen.' };
  const chosen = [];
  for (const t of tokens) {
    let hit = null;
    if (/^\d+$/.test(t)) hit = options[parseInt(t, 10) - 1] || null;
    if (!hit) hit = options.find(o => o.id === t) || options.find(o => (o.aliases || []).some(a => a === t)) || options.find(o => t.length >= 3 && (o.aliases || [o.id]).concat(o.id).some(a => a.startsWith(t)));
    if (!hit) return { error: `„${t}“ kenne ich nicht. Wähle ${multi ? 'eine oder mehrere Nummern (mit Komma getrennt)' : 'eine Nummer'} aus der Liste.` };
    if (!chosen.includes(hit.id)) chosen.push(hit.id);
  }
  if (!multi && chosen.length > 1) return { error: 'Hier geht nur eine Auswahl.' };
  return { value: multi ? chosen : chosen[0] };
}

const rangeInt = (raw, lo, hi, what) => {
  const s = String(raw).trim();
  if (!/^\d+$/.test(s)) return { error: `Bitte eine ganze Zahl von ${lo} bis ${hi} (${what}).` };
  const n = parseInt(s, 10);
  if (n < lo || n > hi) return { error: `${n} liegt außerhalb von ${lo} bis ${hi} (${what}).` };
  return { value: n };
};

const LANGS = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch', nl: 'Niederländisch', pt: 'Portugiesisch', pl: 'Polnisch', sv: 'Schwedisch', da: 'Dänisch', cs: 'Tschechisch', tr: 'Türkisch' };
const langName = c => LANGS[c] || c;

// Schätzungen
export function estimate(n, per) {
  const memberships = n * per;
  const unique = Math.round(memberships * 0.8);
  return { memberships, unique, words: unique * 145 };
}
const effortHint = u => u <= 40 ? 'überschaubar: ein Agent schafft das in wenigen Sitzungen' : u <= 100 ? 'ein gutes Stück Arbeit: mehrere Sitzungen, Faktencheck einplanen' : 'umfangreich: viele Sitzungen und ein sorgfältiger, unabhängiger Faktencheck (jede Station ist ein Text, der stimmen muss)';

// ───────────────────────────── Fragen ─────────────────────────────

const AUDIENCE = [
  { id: 'laien', label: 'Neugierige Laien (kein Vorwissen, Alltagssprache, Fachwörter werden erklärt)', aliases: ['laie', 'neugierig'] },
  { id: 'studierende', label: 'Studierende (Grundlagen bekannt, Fachbegriffe erlaubt, mehr Belege)', aliases: ['studium', 'student'] },
  { id: 'fachleute', label: 'Fachleute (dichte Sprache, Streitstand, Primärquellen)', aliases: ['fach', 'profis', 'experten'] },
  { id: 'gemischt', label: 'Gemischt (leicht einsteigen, in der Tiefe anspruchsvoll)', aliases: ['mix', 'alle'] }
];
const SENSITIVE = [
  { id: 'gesundheit', label: 'Gesundheit (Krankheit, Therapie, Psyche)', aliases: ['gesund', 'medizin', 'krank'] },
  { id: 'politik', label: 'Politik / Weltanschauung', aliases: ['weltanschauung', 'polit', 'ideologie'] },
  { id: 'religion', label: 'Religion', aliases: ['relig', 'glaube'] },
  { id: 'gewalt', label: 'Gewalt / Trauma (Krieg, Missbrauch, Suizid, Verlust)', aliases: ['trauma', 'krieg', 'suizid'] }
];
const SOURCES = [
  { id: 'offen', label: 'Offene, frei zugängliche Quellen (eigene Formulierungen, nichts Fremdes kopieren)', aliases: ['offene'] },
  { id: 'eigene', label: 'Eigene Texte des Auftraggebers (nur sie sind Grundlage; Rechte liegen dort)', aliases: ['auftraggeber', 'texte'] },
  { id: 'domain', label: 'Weiterlesen-Links nur auf eine eigene Domain', aliases: ['host', 'links'] }
];
const LICENSES = [
  { id: 'cc-by-4.0', label: 'CC BY 4.0 (frei nutzbar mit Namensnennung)', text: 'CC BY 4.0', aliases: ['ccby', 'cc-by'] },
  { id: 'cc-by-sa-4.0', label: 'CC BY-SA 4.0 (wie oben, Bearbeitungen unter gleicher Lizenz)', text: 'CC BY-SA 4.0', aliases: ['ccbysa', 'cc-by-sa'] },
  { id: 'alle-rechte', label: 'Alle Rechte vorbehalten', text: 'Alle Rechte vorbehalten', aliases: ['rechte', 'vorbehalten'] },
  { id: 'andere', label: 'Andere (du gibst den Text an)', text: '', aliases: ['anders', 'sonstige'] }
];
const EXHIBITS = [
  { id: 'ja', label: 'Ja, bitte einplanen (interaktive Stücke, Abbildungen)', aliases: ['j'] },
  { id: 'spaeter', label: 'Später (erst die Texte, Exponate bei Bedarf nachrüsten)', aliases: ['später', 'sp'] },
  { id: 'nein', label: 'Nein', aliases: ['n'] }
];
const MAX_UNIQUE = 220;

/** Jede Frage: key, nr, titel, hilfe (ein Satz), art (optionen), standard(a, prev), parse(raw, a), anzeige(v). */
function buildQuestions(skins) {
  const skinOpts = skins.map(s => ({ id: s.id, aliases: [s.name.toLowerCase()] }));
  return [
    { key: 'name', nr: '1', titel: 'Museumsname', required: true,
      hilfe: 'Steht in der Kopfleiste und als große Überschrift; kurz halten (Richtwert höchstens 24 Zeichen).',
      standard: () => 'Mein Museum',
      parse: raw => { const v = raw.trim(); if (!v) return { error: 'Ohne Namen geht es nicht.' }; if (v.length > 80) return { error: 'Das ist zu lang für einen Namen (höchstens 80 Zeichen). Den Rest kannst du in den Untertitel (Frage 3) schreiben.' }; if (/[<>]/.test(v)) return { error: 'Bitte ohne spitze Klammern (kein HTML).' };
        return v.length > 24 ? { value: v, warn: `${v.length} Zeichen sind länger als der Richtwert 24 (Prüfung warnt ab 30): Kopfleiste und Eingang brechen dann um. Tipp: kurzer Name, Untertitel in Frage 3.` } : { value: v }; } },
    { key: 'id', nr: '2', titel: 'Paket-ID',
      hilfe: 'Ordnername unter packs/ und Teil der Adresse: Kleinbuchstaben, Ziffern, Bindestriche, keine Umlaute.',
      standard: a => freeId(slugify(a.name || 'museum')),
      parse: raw => { const v = raw.trim().toLowerCase();
        if (!SLUG.test(v)) return { error: `„${raw.trim()}“ geht nicht: nur Kleinbuchstaben a–z, Ziffern und einzelne Bindestriche, keine Umlaute oder Leerzeichen (zum Beispiel ${slugify(raw)}).` };
        if (v.length > 40) return { error: 'Bitte höchstens 40 Zeichen.' };
        if (packExists(v)) return { error: `packs/${v}/ gibt es schon, ich überschreibe nie ein bestehendes Paket. Nimm eine andere ID (Vorschlag: ${freeId(v)}).` };
        return { value: v }; } },
    { key: 'untertitel', nr: '3', titel: 'Untertitel oder Leitfrage',
      hilfe: 'Ein Satz unter dem Namen im Eingang, am besten eine Frage oder ein Versprechen.',
      standard: () => 'Wege durch ein vernetztes Wissensgebiet',
      parse: raw => { const v = raw.trim(); if (!v) return { error: 'Bitte einen Satz (oder Enter für den Standard).' }; if (v.length > 160) return { error: 'Bitte höchstens 160 Zeichen, es ist ein Untertitel.' }; if (/[<>]/.test(v)) return { error: 'Bitte ohne spitze Klammern (kein HTML).' }; return { value: v }; } },
    { key: 'thema', nr: '4', titel: 'Thema',
      hilfe: 'In ein bis zwei Sätzen: Worum geht es, was gehört dazu, was nicht? Daran richtet sich der Agent aus.',
      standard: () => '',
      parse: raw => raw.length > 800 ? { error: 'Bitte höchstens 800 Zeichen, ein bis zwei Sätze genügen.' } : { value: raw.trim() },
      anzeige: v => v || '(nicht angegeben, der Agent trifft eine Annahme)' },
    { key: 'zielgruppe', nr: '5', titel: 'Zielgruppe und Vorwissen', optionen: AUDIENCE,
      hilfe: 'Bestimmt Sprache, Tiefe und wie viel erklärt wird.',
      standard: () => 'laien', parse: raw => pickOptions(raw, AUDIENCE) },
    { key: 'sprache', nr: '6a', titel: 'Sprache der Inhalte',
      hilfe: 'Zweibuchstabiger Code (de, en, fr …) oder der Name. Deutsch ist vollständig unterstützt; bei anderen Sprachen sind die festen Oberflächentexte (Knöpfe, Meldungen) vorerst noch deutsch.',
      standard: () => 'de',
      parse: raw => { let v = raw.trim().toLowerCase(); const byName = Object.entries(LANGS).find(([, n]) => n.toLowerCase().startsWith(v) && v.length >= 3); if (byName) v = byName[0];
        if (!/^[a-z]{2}(-[a-z]{2,})?$/.test(v)) return { error: 'Bitte einen Sprachcode wie de oder en (oder den Namen, zum Beispiel Englisch).' };
        return v === 'de' ? { value: v } : { value: v, warn: `Ich nehme ${langName(v)} an. Ehrlich gesagt: Die festen Oberflächentexte der Engine (Knöpfe, Hinweise) und der Wortschatz in pack.json bleiben vorerst deutsch; Inhalte und Wortschatz kann der Agent übersetzen, die Engine-Texte nicht ohne Weiteres (siehe docs/ENGINE-WUENSCHE.md).` }; },
      anzeige: v => `${langName(v)} (${v})` },
    { key: 'anrede', nr: '6b', titel: 'Anrede', optionen: [{ id: 'du', label: 'du (persönlich, locker)', aliases: [] }, { id: 'Sie', label: 'Sie (förmlich)', aliases: ['sie'] }],
      hilfe: 'Wie sprechen die Texte die Besucher an? Bei anderen Sprachen sinngemäß: vertraut oder förmlich.',
      standard: () => 'du', parse: raw => pickOptions(raw, [{ id: 'du', aliases: [] }, { id: 'Sie', aliases: ['sie'] }]) },
    { key: 'reisen', nr: '7a', titel: 'Anzahl Reisen',
      hilfe: 'Eine Reise ist ein Weg durch das Gebiet (wie eine U-Bahn-Linie); 3 bis 16, lieber wenige gute als viele dünne.',
      standard: (a, p) => p ? p.reisen : 6,
      parse: raw => rangeInt(raw, 3, 16, 'Reisen') },
    { key: 'stationenJeReise', nr: '7b', titel: 'Stationen je Reise',
      hilfe: 'Eine Station ist eine kleine Lektion (90 bis 200 Wörter); je Reise 11 bis 28, im Schnitt etwa 14. Dieselbe Station darf auf mehreren Reisen liegen.',
      standard: (a, p) => p ? p.stationenJeReise : Math.min(14, Math.floor(MAX_UNIQUE / 0.8 / a.reisen)),
      parse: (raw, a) => { const r = rangeInt(raw, 11, 28, 'Stationen je Reise'); if (r.error) return r;
        const e = estimate(a.reisen, r.value);
        if (e.unique > MAX_UNIQUE) return { error: `${a.reisen} Reisen mal ${r.value} Stationen wären etwa ${e.unique} eindeutige Stationen, das ist mehr als die tragbaren rund 200. Nimm höchstens ${Math.max(11, Math.floor(MAX_UNIQUE / 0.8 / a.reisen))} je Reise oder weniger Reisen.` };
        return { value: r.value, info: umfangInfo(a.reisen, r.value) }; } },
    { key: 'historisch', nr: '8', titel: 'Historische Reisen',
      hilfe: 'Reisen, die Entwicklung über die Zeit erzählen, erscheinen im Zeitstrahl (Stationen mit Jahreszahl, streng chronologisch); 0 bis 3, nur wenn die Geschichte selbst etwas erklärt.',
      standard: (a, p) => p && p.historisch < a.reisen ? p.historisch : 0,
      parse: (raw, a) => { const r = rangeInt(raw, 0, 3, 'historische Reisen'); if (r.error) return r; if (r.value >= a.reisen) return { error: `Mindestens eine Reise muss funktional sein; bei ${a.reisen} Reisen höchstens ${Math.min(3, a.reisen - 1)} historische.` }; return r; } },
    { key: 'reisenamen', nr: '9', titel: 'Reisenamen oder Themenideen (optional)',
      hilfe: 'Mit Komma getrennt (oder mit Semikolon, wenn ein Name selbst Kommas enthält); leer lassen, dann macht der Agent Vorschläge. Gute Reisen sind Fragen oder Wege.',
      standard: () => [],
      parse: raw => { const t = raw.trim(); if (!t || /^(nein|keine|-)$/i.test(t)) return { value: [] }; const parts = (t.includes(';') ? t.split(';') : t.split(',')).map(x => x.trim()).filter(Boolean); if (parts.some(x => x.length > 80)) return { error: 'Ein Reisename sollte kurz sein (höchstens 80 Zeichen).' }; return { value: parts }; },
      anzeige: v => v.length ? v.join('; ') : '(keine, der Agent schlägt vor)' },
    { key: 'skin', nr: '10a', titel: 'Standard-Look (Skin)', optionen: skins.map(s => ({ id: s.id, label: `${s.name}: ${s.description}` })),
      hilfe: 'So sieht das Museum beim ersten Besuch aus; Aussehen und Inhalt sind unabhängig.',
      standard: () => (skins.find(s => s.id === 'halle') || skins[0] || { id: 'halle' }).id,
      parse: raw => skins.length ? pickOptions(raw, skinOpts) : { value: raw.trim() || 'halle' } },
    { key: 'skinWahl', nr: '10b', titel: 'Umschaltung für Besucher', jaNein: true,
      hilfe: 'Ja: alle Looks sind eingebaut und Besucher wählen selbst (--skins=all). Nein: nur der gewählte, schlankere Build.',
      standard: () => true, parse: raw => parseYesNo(raw), anzeige: v => v ? 'ja, alle Looks (--skins=all)' : 'nein, nur der gewählte' },
    { key: 'exponate', nr: '11', titel: 'Exponate und Abbildungen', optionen: EXHIBITS,
      hilfe: 'Interaktive Stücke (zum Beispiel ein Simulator) und Zeichnungen machen Stationen lebendig, kosten aber Arbeit und Prüfung.',
      standard: () => 'spaeter', parse: raw => pickOptions(raw, EXHIBITS) },
    { key: 'heikel', nr: '12', titel: 'Heikle Themen', optionen: SENSITIVE, multi: true,
      hilfe: 'Mehrfachauswahl möglich (zum Beispiel 1,4); „keine“ oder Enter, wenn nichts davon zutrifft. Daraus entstehen der Hinweistext im Fuß und Sorgfaltsregeln für den Agenten.',
      standard: () => [],
      parse: raw => { const t = raw.trim().toLowerCase(); if (!t || /^(0|keine?|nichts|nein|-)$/.test(t)) return { value: [] }; return pickOptions(raw, SENSITIVE, { multi: true }); },
      anzeige: v => v.length ? v.map(x => SENSITIVE.find(o => o.id === x).label).join('; ') : 'keine' },
    { key: 'quellen', nr: '13', titel: 'Quellenregeln', optionen: SOURCES, multi: true,
      hilfe: 'Woher darf der Inhalt stammen? Mehrfachauswahl möglich (zum Beispiel 1,3).',
      standard: () => ['offen'], parse: raw => pickOptions(raw, SOURCES, { multi: true }) },
    { key: 'materialHost', nr: '13b', titel: 'Eigene Domain für Weiterlesen-Links', onlyIf: a => (a.quellen || []).includes('domain'), required: true,
      hilfe: 'Adresse, auf die alle Weiterlesen-Links zeigen dürfen, mit https:// (zum Beispiel https://www.beispiel.de/).',
      standard: () => '',
      parse: raw => { const v = raw.trim(); if (!/^https:\/\/[^\s/]+\.[^\s/]+\S*$/.test(v)) return { error: 'Bitte eine Adresse mit https:// und Domain, zum Beispiel https://www.beispiel.de/.' }; return { value: v }; } },
    { key: 'urheber', nr: '14a', titel: 'Urheber und Credits',
      hilfe: 'Wer steht im Fuß als Autorin, Autor oder Institution? Leer: nur „Erstellt mit Museum Studio“.',
      standard: () => '', parse: raw => raw.length > 200 ? { error: 'Bitte höchstens 200 Zeichen.' } : /[<>]/.test(raw) ? { error: 'Bitte ohne spitze Klammern (kein HTML).' } : { value: raw.trim() },
      anzeige: v => v || '(keine Angabe)' },
    { key: 'lizenz', nr: '14b', titel: 'Lizenz der Inhalte', optionen: LICENSES,
      hilfe: 'Gilt für die Texte dieses Pakets; der Code von Museum Studio bleibt unter MIT.',
      standard: () => 'cc-by-4.0', parse: raw => pickOptions(raw.trim().toLowerCase().replace(/\s+/g, '-'), LICENSES) },
    { key: 'lizenzText', nr: '14b2', titel: 'Eigener Lizenztext', onlyIf: a => a.lizenz === 'andere', required: true,
      hilfe: 'Zum Beispiel „CC BY-NC 4.0“ oder „Nutzung nach Absprache“.',
      standard: () => '', parse: raw => { const v = raw.trim(); return !v ? { error: 'Bitte einen kurzen Lizenztext.' } : v.length > 160 ? { error: 'Bitte höchstens 160 Zeichen.' } : /[<>]/.test(v) ? { error: 'Bitte ohne spitze Klammern.' } : { value: v }; } },
    { key: 'impressumUrl', nr: '14c', titel: 'Impressum und Datenschutz (optional)',
      hilfe: 'Adresse einer Seite mit Impressum/Datenschutz (https://…); sie wird im Fuß verlinkt. Leer: kein Link (bei öffentlicher Veröffentlichung in Deutschland meist nötig).',
      standard: () => '',
      parse: raw => { const v = raw.trim(); if (!v) return { value: '' }; return /^https:\/\/[^\s/]+\.[^\s/]+\S*$/.test(v) && !/[()\[\]]/.test(v) ? { value: v } : { error: 'Bitte eine Adresse mit https:// ohne Leerzeichen und Klammern, oder Enter für „kein Link“.' }; },
      anzeige: v => v || '(kein Link)' }
  ];
}

function parseYesNo(raw) {
  const t = raw.trim().toLowerCase();
  if (/^(j|ja|y|yes|1|true)$/.test(t)) return { value: true };
  if (/^(n|nein|no|0|false)$/.test(t)) return { value: false };
  return { error: 'Bitte ja oder nein.' };
}
function umfangInfo(n, per) {
  const e = estimate(n, per);
  return `Das sind ${e.memberships} Mitgliedschaften (Station auf einer Reise), geschätzt etwa ${e.unique} eindeutige Stationen (Mitgliedschaften mal 0,8, weil Kreuzungsstationen auf mehreren Reisen liegen), rund ${e.words.toLocaleString('de-DE')} Wörter Text, jede Station mit Faktencheck. Aufwand: ${effortHint(e.unique)}.`;
}

// ───────────────────────────── Ein- und Ausgabe ─────────────────────────────

function makeIO() {
  const tty = !!process.stdin.isTTY;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
  const queue = [], waiters = [];
  let closed = false;
  rl.on('line', l => { if (waiters.length) waiters.shift()(l); else queue.push(l); });
  rl.on('close', () => { closed = true; while (waiters.length) waiters.shift()(null); });
  const io = {
    tty,
    close: () => { try { rl.close(); } catch (e) { /* schon zu */ } },
    onInterrupt: fn => { rl.on('SIGINT', fn); process.on('SIGINT', fn); },
    line(prompt) {
      return new Promise(resolve => {
        const done = l => { if (!tty && l !== null) process.stdout.write(l + '\n'); else if (!tty) process.stdout.write('\n'); resolve(l); };
        if (tty) { rl.setPrompt(prompt); rl.prompt(); } else process.stdout.write(prompt);
        if (queue.length) done(queue.shift());
        else if (closed) done(null);
        else waiters.push(done);
      });
    }
  };
  return io;
}
const say = (...a) => console.log(...a);

// ───────────────────────────── Befragung ─────────────────────────────

async function interview(io, questions, prevState) {
  const a = {}, defaulted = new Set();
  for (const q of questions) {
    if (q.onlyIf && !q.onlyIf(a)) { a[q.key] = ''; continue; }
    const prev = prevState ? prevState.a : null;
    const def = prev && q.key in prev && prev[q.key] !== '' && !['historisch', 'stationenJeReise'].includes(q.key) ? prev[q.key] : q.standard(a, prev);
    const defStr = q.anzeige ? q.anzeige(def) : Array.isArray(def) ? def.join(', ') : typeof def === 'boolean' ? (def ? 'ja' : 'nein') : String(def);
    say(`\n${q.onlyIf ? '   ↳ Nachfrage' : `Frage ${q.nr} von 14`} · ${q.titel}`);
    say(`   ${q.hilfe}`);
    if (q.optionen) q.optionen.forEach((o, i) => say(`     ${i + 1}) ${o.label || o.id}`));
    const stdLabel = q.optionen && !q.multi ? (() => { const i = q.optionen.findIndex(o => o.id === def); return i >= 0 ? `${i + 1}` : defStr; })() : q.optionen && q.multi ? (def.length ? def.map(d => q.optionen.findIndex(o => o.id === d) + 1).join(',') : 'keine') : defStr;
    say(q.required && !defStr ? '   (Pflichtangabe)' : q.required && q.key === 'name' ? `   [Enter = ${defStr}]` : `   [Enter = ${stdLabel || 'leer lassen'}]`);
    for (;;) {
      const raw = await io.line('   > ');
      if (raw === null && q.required && q.key !== 'name') throw new Abort('Die Eingabe endete mitten in der Befragung.', 1);
      if (raw === null && q.key === 'name' && !(prev && prev.name)) throw new Abort('Die Eingabe endete, bevor ein Name da war.', 1);
      const text = raw === null ? '' : raw.trim();
      let res;
      if (!text) {
        if (q.required && !def) { say('   Das brauche ich noch, bitte eintippen.'); if (raw === null) throw new Abort('Die Eingabe endete.', 1); continue; }
        // Enter: Standard übernehmen (bei Bedarf über die Prüfung, damit etwa eine vergebene ID auffällt)
        const asRaw = Array.isArray(def) ? def.join('; ') : typeof def === 'boolean' ? (def ? 'ja' : 'nein') : String(def);
        res = q.optionen && !q.multi ? { value: def } : q.optionen && q.multi ? { value: def } : q.parse(asRaw, a);
        if (res.error) { say(`   ${res.error}`); if (raw === null) throw new Abort('Die Eingabe endete.', 1); continue; }
        if (!(prevState && q.key in prevState.a && !prevState.d.has(q.key))) defaulted.add(q.key);   // vorher selbst gewählte Antworten bleiben „gewählt“
      } else {
        res = q.parse(text, a);
        if (res.error) { say(`   ${res.error}`); continue; }
      }
      if (res.warn) say(`   Hinweis: ${res.warn}`);
      if (res.info) say(`   ${res.info}`);
      a[q.key] = res.value;
      break;
    }
  }
  return { a, d: defaulted };
}

// ───────────────────────────── Konfiguration (nicht interaktiv) ─────────────────────────────

const IGNORED_KEYS = new Set(['schema', 'erstellt', 'werkzeug', 'abgeleitet', 'standardUebernommen']);
function fromConfig(questions, cfg, { useDefaults }) {
  const a = {}, d = new Set(), problems = [];
  const known = new Set(questions.map(q => q.key));
  for (const k of Object.keys(cfg)) if (!known.has(k) && !IGNORED_KEYS.has(k) && !k.startsWith('_')) problems.push(`Unbekanntes Feld „${k}“ (bekannt: ${[...known].join(', ')}).`);
  for (const q of questions) {
    if (q.onlyIf && !q.onlyIf(a)) { a[q.key] = ''; continue; }
    const v = cfg[q.key];
    const present = v !== undefined && v !== null && !(typeof v === 'string' && !v.trim() && !q.required);
    if (!present) {
      if (q.required && q.key !== 'name') { problems.push(`Pflichtfeld „${q.key}“ fehlt (${q.titel}).`); continue; }
      if (q.key === 'name' && !useDefaults) { problems.push('Pflichtfeld „name“ fehlt.'); continue; }
      a[q.key] = q.standard(a, null); d.add(q.key);
      continue;
    }
    const raw = Array.isArray(v) ? v.join(q.key === 'reisenamen' ? '; ' : ', ') : typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v);
    const res = q.parse(raw, a);
    if (res.error) { problems.push(`Feld „${q.key}“ (${q.titel}): ${res.error}`); continue; }
    a[q.key] = res.value;
  }
  if (problems.length) throw new ConfigError(problems.join('\n  '));
  return { a, d };
}

// ───────────────────────────── Texte und Dateien erzeugen ─────────────────────────────

const lizenzText = a => a.lizenz === 'andere' ? a.lizenzText : LICENSES.find(l => l.id === a.lizenz).text;
const du = a => a.anrede === 'du';

export function footerFor(a) {
  const D = du(a), de = a.sprache === 'de';
  const hinweis = [];
  const h = new Set(a.heikel);
  if (h.has('gesundheit')) hinweis.push(`Dieses Museum bietet Bildung, keine medizinische, psychologische oder therapeutische Beratung und keine Diagnose. Bei Beschwerden oder Sorgen ${D ? 'wende dich' : 'wenden Sie sich'} an eine Ärztin, einen Arzt oder eine Beratungsstelle.`);
  if (h.has('politik')) hinweis.push('Dieses Museum stellt Positionen dar und ordnet sie ein; es will niemanden zu einer Meinung überreden. Wo Fachleute oder Lager uneins sind, steht das auch so da.');
  if (h.has('religion')) hinweis.push('Religiöse und weltanschauliche Überzeugungen werden sachlich beschrieben, nicht bewertet. Über Wahrheitsfragen entscheidet dieses Museum nicht.');
  if (h.has('gewalt')) hinweis.push(`Einzelne Stationen berühren belastende Themen (Gewalt, Krieg, Verlust). Sie sind sachlich und ohne verletzende Einzelheiten geschrieben; ${D ? 'mach gern eine Pause, wenn dich etwas aufwühlt' : 'machen Sie gern eine Pause, wenn Sie etwas aufwühlt'}.`);
  if (!hinweis.length) hinweis.push(`Dieses Museum ist ein Bildungsangebot. Es ersetzt keine fachliche Beratung.`);
  hinweis.push(`Es setzt keine Cookies, verfolgt niemanden und lädt nichts von Dritten nach. Der Reisepass bleibt nur in ${D ? 'deinem' : 'Ihrem'} Browser.`);
  const cols = [{ title: 'Hinweis', paragraphs: hinweis }];
  if (h.has('gesundheit') || h.has('gewalt')) {
    cols.push(de
      ? { title: 'Wenn es ernst ist', paragraphs: ['Telefonseelsorge (Deutschland, kostenfrei, rund um die Uhr): 0800 111 0 111 oder 0800 111 0 222, Chat unter [online.telefonseelsorge.de](https://online.telefonseelsorge.de). In Lebensgefahr: Notruf 112.'], classes: ['gm-foot-help'] }
      : { title: 'Hilfe', paragraphs: ['In akuter Not wende dich an den örtlichen Notruf oder eine Krisenhotline in deinem Land.'], classes: ['gm-foot-help'] });
  }
  if (a.impressumUrl) cols.push({ title: 'Rechtliches', paragraphs: [`[Impressum und Datenschutz](${a.impressumUrl})`] });
  if (cols.length === 1) return cols[0].paragraphs.join('\n\n');
  return { columns: cols };
}

function eyebrowFor(a) {
  const first = (a.thema || '').split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, '').trim();
  return first && first.length >= 8 && first.length <= 48 ? first : 'Ein vernetztes Museum';
}

function packFields(a) {
  const f = {
    title: a.name, eyebrow: eyebrowFor(a), tagline: a.untertitel, lang: a.sprache, defaultSkin: a.skin,
    limits: { min: 11, max: Math.min(28, a.stationenJeReise + 6) },
    footer: footerFor(a),
    license: a.lizenz === 'alle-rechte' ? `Inhalte: ${lizenzText(a)}${a.urheber ? ' (© ' + a.urheber + ')' : ''}` : `Inhalte: ${lizenzText(a)}. Code: MIT (Museum Studio).`,
    credits: a.urheber ? `${a.urheber}. Erstellt mit Museum Studio.` : 'Erstellt mit Museum Studio.'
  };
  if (a.urheber) f.author = a.urheber;
  return f;
}

const AUDIENCE_TON = {
  laien: 'Neugierige Laien ohne Vorwissen. Alltagssprache, kurze Sätze, jedes Fachwort beim ersten Gebrauch in einem Halbsatz erklären, Bilder und Beispiele aus dem Alltag, Einstieg über eine Szene statt über eine Definition.',
  studierende: 'Studierende mit Grundwissen. Fachbegriffe sind erlaubt, werden aber beim ersten Auftreten kurz gesetzt; mehr Belege (Namen, Jahre, Studien), Streitstände benennen, Hinweise zum Weiterlesen auf Lehrbuch-Niveau.',
  fachleute: 'Fachleute. Dichte, präzise Sprache, Fachbegriffe ohne Erklärung, Streitstand und Primärquellen im Vordergrund; trotzdem lesbar und ohne Jargon-Nebel.',
  gemischt: 'Gemischtes Publikum. Der Einstieg jeder Station ist für Laien verständlich (Szene, Bild), die Tiefe darunter trägt auch Fachleute; Fachwörter werden erklärt, aber nicht weggelassen.'
};
const CARE = {
  gesundheit: ['Keine Diagnosen, keine Therapie- oder Dosierungsempfehlungen, keine Heilversprechen. Es wird erklärt, nicht beraten.', 'Studienaussagen mit Stichprobe, Jahr und Einschränkung nennen; Korrelation nicht als Ursache darstellen; populäre Irrtümer als Mythos-Station mit „Wahrheit“ behandeln.', 'Der Hinweistext im Fuß (`pack.json` `footer`) ist vorbereitet; vor der Veröffentlichung prüfen, ob er zum Inhalt passt und die Hilfsnummer für das Zielland stimmt.'],
  politik: ['Positionen darstellen, nicht empfehlen: jede Position so, dass ihre Vertreter sich wiedererkennen (AGENTEN.md, Regel 3). Tatsachen von Wertungen trennen.', 'Keine Parteien-, Wahl- oder Handlungsempfehlung. Nach dem Schreiben bewusst prüfen: Welche Schulen oder Lager fehlen?', 'Begriffe neutral wählen; wo ein Begriff selbst umstritten ist, das einmal benennen.'],
  religion: ['Überzeugungen beschreiben, nicht bewerten: „Im Christentum gilt …“ statt „Es ist so …“. Innen- und Außenperspektive kenntlich machen.', 'Keine Aussagen über Wahrheit oder Unwahrheit; Verhältnis von Religion und Wissenschaft sachlich und mit mehreren Stimmen darstellen.', 'Heilige Texte und Praktiken respektvoll behandeln, Zitate belegen.'],
  gewalt: ['Sachlich und würdig schreiben, keine Details, die verletzen, verherrlichen oder zum Nachahmen taugen (keine Methodenbeschreibung bei Suizid oder Gewalt).', 'Betroffene nur nennen, wenn öffentlich dokumentiert und notwendig; keine Opfer-Schaulust, kein Reißerisches im Teaser.', 'Einen Hinweis auf Hilfsangebote im Fuß setzen (vorbereitet in `pack.json` `footer`) und die Reihenfolge so wählen, dass belastende Stationen nie ohne Kontext am Anfang einer Reise stehen.']
};
const SKIN_NOTE = (a, skins) => { const s = skins.find(x => x.id === a.skin); return s ? `${s.name}: ${s.description.replace(/[.\s]+$/, "")}` : a.skin; };
const buildCmd = a => `node tools/build.mjs ${a.id} ${a.skinWahl ? '--skins=all' : `--skins=${a.skin}`}`;
const checkCmd = a => `${a.materialHost ? `MATERIAL_HOST=${a.materialHost} ` : ''}node tools/check-pack.mjs ${a.id}`;
const today = () => new Date().toISOString().slice(0, 10);

function briefingJson(a, d, r, e) {
  return JSON.stringify({
    _hinweis: 'Maschinenlesbarer Auftrag, erzeugt von tools/onboarding.mjs. Dieselben Felder verträgt `node tools/onboarding.mjs --config=<datei>`. Lesbare Fassung: BRIEFING.md.',
    schema: 1, erstellt: today(), werkzeug: 'tools/onboarding.mjs',
    name: a.name, id: a.id, untertitel: a.untertitel, thema: a.thema, zielgruppe: a.zielgruppe, sprache: a.sprache, anrede: a.anrede,
    reisen: a.reisen, stationenJeReise: a.stationenJeReise, historisch: a.historisch, reisenamen: a.reisenamen,
    skin: a.skin, skinWahl: a.skinWahl, exponate: a.exponate, heikel: a.heikel, quellen: a.quellen, materialHost: a.materialHost || '',
    urheber: a.urheber, lizenz: a.lizenz, lizenzText: a.lizenz === 'andere' ? a.lizenzText : '', impressumUrl: a.impressumUrl,
    abgeleitet: { mitgliedschaften: e.memberships, eindeutigeStationenGeschaetzt: e.unique, woerterGeschaetzt: e.words, geruestStationen: r.stubs, geruestKreuzungen: r.crossings, baubefehl: buildCmd(a), pruefbefehl: checkCmd(a) },
    standardUebernommen: [...d]
  }, null, 2) + '\n';
}

function briefingMd(a, d, r, e, skins) {
  const L = [];
  const ja = (k) => d.has(k) ? ' *(Standardwert, nicht ausdrücklich gewählt)*' : '';
  const sens = a.heikel.map(x => SENSITIVE.find(o => o.id === x).label);
  L.push(`# Auftrag: ${a.name} (\`packs/${a.id}\`)`, '');
  L.push(`Dieser Auftrag entstand am ${today()} im Onboarding (\`node tools/onboarding.mjs\`). Er ersetzt **Schritt 0** von \`docs/AGENTEN.md\` (Rahmen klären): Die Fragen sind beantwortet, bitte nicht erneut stellen, sondern abarbeiten. Maschinenlesbar: \`BRIEFING.json\`.`);
  L.push(`Was als *Standardwert* gekennzeichnet ist, hat der Auftraggeber nicht ausdrücklich entschieden; halte es in \`ARBEITSSTAND.md\` als Annahme fest (dort schon vorbereitet). Fehlt etwas ganz, entscheide vorsichtig und trage es als Annahme ein.`, '');

  L.push('## Thema', '');
  L.push(`- **Name:** ${a.name}  (ID \`${a.id}\`)${a.name.length > 24 ? `  *Achtung: ${a.name.length} Zeichen, Richtwert 24; nicht verlängern.*` : ''}`);
  L.push(`- **Untertitel / Leitfrage:** ${a.untertitel}${ja('untertitel')}`);
  L.push(`- **Thema:** ${a.thema || '*(nicht angegeben: leite es aus Namen und Untertitel ab und halte es als Annahme fest)*'}`);
  L.push(`- In \`pack.json\` sind \`title\`, \`eyebrow\`, \`tagline\` vorbefüllt; \`eyebrow\` darfst du schärfen.`, '');

  L.push('## Zielgruppe, Sprache, Ton', '');
  L.push(`- **Zielgruppe:** ${AUDIENCE_TON[a.zielgruppe]}${ja('zielgruppe')}`);
  L.push(`- **Sprache der Inhalte:** ${langName(a.sprache)} (\`${a.sprache}\`)${ja('sprache')}.${a.sprache === 'de' ? '' : ' Die festen Oberflächentexte der Engine bleiben deutsch (bekannte Grenze); übersetze den Wortschatz `vocab` in `pack.json` und trage Engine-Wünsche in `docs/ENGINE-WUENSCHE.md` ein.'}`);
  L.push(`- **Anrede:** ${a.anrede}${ja('anrede')}. Durchgehend, auch in Intro, Outro, Teasern, Fuß. Ton: warm, klar, neugierig; kein Belehren.`, '');

  L.push('## Umfang', '');
  L.push(`- **${a.reisen} Reisen**${ja('reisen')}, davon **${a.historisch} historisch** (${a.historisch ? `die letzten ${a.historisch}` : 'keine'}; im Zeitstrahl, Stationen mit \`year\`/\`yearLabel\`, streng chronologisch)${ja('historisch')}.`);
  L.push(`- **${a.stationenJeReise} Stationen je Reise** (Mitgliedschaften)${ja('stationenJeReise')}: zusammen ${e.memberships} Mitgliedschaften, geschätzt **etwa ${e.unique} eindeutige Stationen** (Mitgliedschaften mal 0,8; echte Kreuzungen entscheiden, es darf abweichen). Schranke: je Reise 11 bis 28, insgesamt höchstens rund 200 eindeutige.`);
  L.push(`- Aufwand: ${effortHint(e.unique)}; ungefähr ${e.words.toLocaleString('de-DE')} Wörter.`);
  L.push(`- **Gerüst:** \`new-pack\` hat ${r.stubs} Stationsrümpfe mit ${r.crossings} Kreuzungen angelegt (Muster für Fenster und Kreuzungen, keine Inhalte). Ersetze, ergänze oder streiche sie im Plan (\`plan.json\` UND Stationsdateien), bis Umfang und Kreuzungen zum Auftrag passen. Lieber weniger, dafür gute Reisen.`, '');

  L.push('## Reisen', '');
  if (a.reisenamen.length) {
    L.push(`Vorschläge des Auftraggebers (Reihenfolge = Reise 1, 2, …; sie stehen schon als Arbeitsnamen in \`plan.json\` und \`journeys.js\`):`, '');
    a.reisenamen.forEach((n, i) => L.push(`${i + 1}. ${n}${i >= a.reisen ? ' *(mehr Ideen als Reisen: als Station oder Idee verwenden, nicht verwerfen)*' : ''}`));
    if (a.reisenamen.length < a.reisen) L.push('', `Für die übrigen ${a.reisen - a.reisenamen.length} Reisen mache selbst Vorschläge (Annahme in \`ARBEITSSTAND.md\`).`);
    L.push('', 'Die Namen sind Themenideen, keine fertigen Titel: Eine Reise ist eine Frage oder ein Weg mit Versprechen (AGENTEN.md, Schritt 1). Formuliere sie bei Bedarf um und halte das fest.');
  } else L.push('Keine Vorgaben: **mache Vorschläge** für alle Reisen (jede als Frage oder Weg, mit Tagline) und halte sie als Annahme in `ARBEITSSTAND.md` fest, bevor du viel Text schreibst.');
  L.push('');

  L.push('## Sorgfaltsregeln', '');
  L.push(`- **Heikle Themen:** ${sens.length ? sens.join('; ') : 'keine genannt'}${ja('heikel')}.`);
  L.push('- Immer: Fakten belegbar halten (Zahlen, Jahre, Zitate nicht aus dem Gedächtnis), Zuschreibungen prüfen, Darstellung fair (AGENTEN.md, Regeln und „Typische Fehler“), Faktencheck in `FAKTENCHECK.md`.');
  for (const k of a.heikel) { L.push(`- **${SENSITIVE.find(o => o.id === k).label}:**`); CARE[k].forEach(x => L.push(`  - ${x}`)); }
  L.push(`- **Hinweistext im Fuß** (\`pack.json\` \`footer\`): vorbereitet${a.heikel.length ? ' aus den heiklen Themen' : ' (Standardhinweis)'}; vor der Veröffentlichung gegenlesen.`, '');

  L.push('## Quellen', '');
  if (a.quellen.includes('offen')) L.push('- Nur offene, frei zugängliche Quellen und eigene Formulierungen; nichts Fremdes kopieren, Weiterlesen-Hinweise nur auf real existierende Werke.');
  if (a.quellen.includes('eigene')) L.push('- Grundlage sind die **eigenen Texte des Auftraggebers** (liegen vor oder werden geliefert). Nichts darüber hinaus hinzuerfinden; Lücken als Frage in `ARBEITSSTAND.md` („Offen“) stellen, nicht stillschweigend füllen; Rechte-Angaben respektieren.');
  if (a.quellen.includes('domain')) L.push(`- Weiterlesen-Links (\`blog\`, \`material.js\`) nur auf **${a.materialHost}**. Prüfen mit \`MATERIAL_HOST=${a.materialHost} node tools/check-pack.mjs ${a.id}\`. Erlaubte Links zusätzlich in \`quellen.txt\` (eine URL je Zeile).`);
  L.push('- Link-Regeln: nur geprüfte, öffentliche https-Links, Titel plus Link, nichts hineinkopieren (AGENTEN.md, Schritt 0).', '');

  L.push('## Look und Bau', '');
  L.push(`- **Standard-Look:** ${SKIN_NOTE(a, skins)}${ja('skin')}.`);
  L.push(`- **Umschaltung für Besucher:** ${a.skinWahl ? 'ja, alle Looks einbinden' : 'nein, nur der gewählte'}. Bau: \`${buildCmd(a)}\`.`);
  L.push(`- **Exponate und Abbildungen:** ${a.exponate === 'ja' ? 'gewünscht. Plane 2 bis 4 Exponate/Abbildungen an Stationen, wo ein Mitmachen mehr erklärt als ein Absatz (AGENTEN.md, Exponat-Schnittstelle); IDs in `pack.json` `exhibits`, `plan.json` und Stationsdatei müssen übereinstimmen.' : a.exponate === 'spaeter' ? 'später. Jetzt keine Exponate bauen; als Idee in `ARBEITSSTAND.md` unter „Offen“ vermerken, wo eines sinnvoll wäre.' : 'nicht gewünscht.'}${ja('exponate')}`, '');

  L.push('## Lizenz, Credits, Rechtliches', '');
  L.push(`- **Lizenz der Inhalte:** ${lizenzText(a)}${ja('lizenz')} (in \`pack.json\` \`license\` eingetragen; der Code von Museum Studio bleibt MIT).`);
  L.push(`- **Credits:** ${a.urheber || 'keine Angabe (nur „Erstellt mit Museum Studio“)'}.`);
  L.push(`- **Impressum/Datenschutz:** ${a.impressumUrl ? a.impressumUrl + ' (im Fuß verlinkt)' : 'kein Link angegeben (vor einer öffentlichen Veröffentlichung klären)'}.`, '');

  L.push('## Was der Agent liefern soll', '');
  L.push(`Arbeite \`docs/AGENTEN.md\` ab Schritt 1 ab (Schritt 0 ist durch diesen Auftrag erledigt) und committe nach jedem Schritt.`, '');
  [
    `Reiseplan: ${a.reisen} Reisen (${a.historisch} historisch) mit Namen, Tagline, Intro, Outro, Icon, Farben in \`journeys.js\`; Plan in \`plan.json\` mit etwa ${e.unique} eindeutigen Stationen, echten Kreuzungen und dem Netz zusammenhängend (\`node tools/check-plan.mjs ${a.id}\` grün)`,
    'Plan dem Auftraggeber zeigen oder, wenn niemand antwortet, als Annahme in `ARBEITSSTAND.md` festhalten',
    `Stationstexte in \`stationen/*.js\` (90 bis 200 Wörter, Teaser, Fakten, \`cross\` je andere Reise; \`node tools/check-data.mjs ${a.id} <datei>\` je Datei grün)`,
    ...(a.exponate === 'ja' ? ['Exponate/Abbildungen an passenden Stationen (und in `pack.json` `exhibits` eingetragen)'] : []),
    '`pack.json` geprüft: alle Platzhalter weg, Fußhinweise passen zum Inhalt' + (a.sprache === 'de' ? '' : ', Wortschatz `vocab` übersetzt'),
    ...(a.heikel.length ? ['Sorgfaltsregeln zu den heiklen Themen eingehalten und im Abschlussbericht ausdrücklich bestätigt (welche Positionen/Aspekte fehlen bewusst?)'] : []),
    'Faktencheck durchgeführt und in `FAKTENCHECK.md` festgehalten (Stufe je Reise ehrlich angeben: unabhängig, Selbstprüfung, Gedächtnis)',
    `Layout berechnet: \`node tools/layout-map.mjs ${a.id}\``,
    `Gesamtprüfung grün: \`${checkCmd(a)}\``,
    `Gebaut: \`${buildCmd(a)}\` (Ergebnis in \`dist/${a.id}/index.html\`); wenn Playwright vorhanden ist: \`npm run smoke -- ${a.id} --quick\``,
    '`ARBEITSSTAND.md` aktuell (Rahmen, Annahmen mit „Bestätigt: offen“, Entscheidungen, Fortschritt, Offenes, bekannte Schwächen)',
    'Abschlussbericht: was steht, was ist geprüft, welche Annahmen den Inhalt stark lenken, was bewusst fehlt'
  ].forEach(x => L.push(`- [ ] ${x}`));
  L.push('');
  return L.join('\n');
}

function arbeitsstandMd(a, d, r, e, skins) {
  const rows = [];
  const add = (x, why) => rows.push(`| ${today()} | **Annahme:** ${x} | ${why} | offen |`);
  const DEF_WHY = 'Im Onboarding mit Enter übernommen, nicht ausdrücklich gewählt.';
  const labels = { untertitel: 'Untertitel', zielgruppe: 'Zielgruppe', sprache: 'Sprache', anrede: 'Anrede', reisen: 'Zahl der Reisen', stationenJeReise: 'Stationen je Reise', historisch: 'Zahl historischer Reisen', skin: 'Standard-Look', skinWahl: 'Skin-Umschaltung', exponate: 'Exponate', heikel: 'heikle Themen', quellen: 'Quellenregeln', lizenz: 'Lizenz', name: 'Name', id: 'ID', thema: 'Thema', reisenamen: 'Reisenamen', urheber: 'Urheber', impressumUrl: 'Impressum-Link', materialHost: 'Domain für Links', lizenzText: 'Lizenztext' };
  const val = k => { const v = a[k]; return v === true ? 'ja' : v === false ? 'nein' : Array.isArray(v) ? (v.length ? v.join(', ') : 'keine') : v === '' || v === undefined ? '(leer)' : String(v); };
  for (const k of d) if (!['name', 'id'].includes(k)) add(`${labels[k] || k} = ${val(k)}`, DEF_WHY);
  add(`Eindeutige Stationen ≈ ${e.unique} (Mitgliedschaften ${e.memberships} × 0,8)`, 'Faustwert aus dem Onboarding; echte Kreuzungen entscheiden.');
  add(`Das Gerüst (${r.stubs} Rümpfe, ${r.crossings} Kreuzungen) ist nur ein Muster und wird dem Plan angepasst`, '`new-pack` legt ein gleichmäßiges Fenstermuster an, kein inhaltlich geplantes Netz.');
  add(`\`eyebrow\` („${eyebrowFor(a)}“) und \`tagline\` stammen aus den Antworten`, 'Der Agent darf sie schärfen.');
  add('Der Fußhinweis in `pack.json` ist aus den Antworten zu „heikle Themen“ erzeugt' + (a.heikel.length ? ` (${a.heikel.join(', ')})` : ' (Standardhinweis)'), 'Muss vor der Veröffentlichung gegengelesen werden' + ((a.heikel.includes('gesundheit') || a.heikel.includes('gewalt')) && a.sprache === 'de' ? '; die Telefonseelsorge-Nummern gelten für Deutschland.' : '.'));
  if (!a.thema) add('Thema nicht angegeben, aus Name und Untertitel abgeleitet', 'Keine Antwort im Onboarding.');
  if (!a.reisenamen.length) add('Reisenamen: Vorschläge macht der Agent', 'Keine Vorgaben im Onboarding.');
  if (a.sprache !== 'de') add(`Inhalte in ${langName(a.sprache)}; Oberflächentexte der Engine bleiben deutsch`, 'Bekannte Grenze von Museum Studio 0.1.');
  const L = [];
  L.push(`# Arbeitsstand: ${a.name} (\`packs/${a.id}\`)`, '');
  L.push('Diese Datei ist die Übergabe an den nächsten Agenten oder Menschen. Sie gehört zum Paket und wird nach **jedem Schritt** aktualisiert und mitcommittet.');
  L.push('Was nicht hier oder im Repository steht, ist nach einem Sitzungsabbruch verloren. Vorlage: `packs/_vorlage/ARBEITSSTAND.md`. Der Auftrag steht in `BRIEFING.md` (maschinenlesbar: `BRIEFING.json`).', '');
  L.push(`**Stand:** ${today()}, Schritt 0 von 8 erledigt (Rahmen durch das Onboarding, siehe \`docs/AGENTEN.md\`); als Nächstes Schritt 1 (Reisen finden)`, '');
  L.push('## Rahmen (Schritt 0, aus dem Onboarding)');
  L.push(`- Zielgruppe und Vorwissen: ${AUDIENCE.find(o => o.id === a.zielgruppe).label}`);
  L.push(`- Ton und Ansprache: ${a.anrede}-Anrede, ${langName(a.sprache)}, warm und klar`);
  L.push(`- Umfang (Reisen, Stationen insgesamt, eindeutige Stationen): ${a.reisen} Reisen (${a.historisch} historisch), je ${a.stationenJeReise} Stationen, etwa ${e.unique} eindeutige (Schätzung)`);
  L.push(`- Erlaubte Quellen: ${a.quellen.map(q => SOURCES.find(o => o.id === q).label).join('; ')}${a.materialHost ? ` (${a.materialHost})` : ''}`);
  L.push(`- Heikle Themen (und Umgang damit): ${a.heikel.length ? a.heikel.map(x => SENSITIVE.find(o => o.id === x).label).join('; ') + ', Sorgfaltsregeln in BRIEFING.md' : 'keine genannt'}`, '');
  L.push('## Annahmen');
  L.push('Alles, was nicht ausdrücklich vom Auftraggeber stammt. Jede Annahme mit Datum und Begründung, damit der Auftraggeber sie später bestätigen oder umwerfen kann.', '');
  L.push('| Datum | Annahme | Begründung | Bestätigt? |', '|---|---|---|---|', ...rows, '');
  L.push('## Entscheidungen', 'Kurz, mit Grund (Warum diese Reisen? Warum keine historische Reise? Warum diese Heimat-Reise für Station X?).', '', '-', '');
  L.push('## Fortschritt je Reise', '| Reise | Plan | Texte | Faktencheck (Stufe) | Bemerkung |', '|---|---|---|---|---|', '| | | | | |', '');
  L.push('Faktencheck-Stufen: **unabhängig geprüft** (anderer Agent oder Mensch, mit Quellen), **Selbstprüfung** (derselbe Agent im getrennten Durchgang mit Quellen), **Gedächtnis** (nicht belegt). Details: `docs/AGENTEN.md`, Schritt 5.', '');
  L.push('## Offen', '- [ ] Reisen und Plan (Schritt 1 und 2)', ...(a.exponate === 'spaeter' ? ['- [ ] Später: Exponate und Abbildungen erwägen (im Onboarding auf „später“ gestellt)'] : []), ...(a.impressumUrl ? [] : ['- [ ] Impressum/Datenschutz-Link klären (im Onboarding keiner angegeben)']), '');
  L.push('## Bekannte Schwächen', '-', '');
  L.push('## Wünsche an die Engine', 'Nur Verweise; Wünsche selbst stehen in `docs/ENGINE-WUENSCHE.md`.', '');
  L.push('## Nächste Schritte', `1. \`BRIEFING.md\` lesen, dann \`docs/AGENTEN.md\` ab Schritt 1.`, `2. Plan zeigen oder als Annahme festhalten, dann Stationen schreiben.`, '');
  return L.join('\n');
}

// ───────────────────────────── Ablauf ─────────────────────────────

function summary(a, d, skins, e) {
  const star = k => d.has(k) ? ' (Standard)' : '';
  const q = buildQuestions(skins);
  const disp = k => { const qq = q.find(x => x.key === k); const v = a[k]; return qq && qq.anzeige ? qq.anzeige(v) : v; };
  const opt = (arr, k) => { const v = a[k]; return Array.isArray(v) ? v.map(x => arr.find(o => o.id === x).label.split(' (')[0]).join(', ') || 'keine' : arr.find(o => o.id === v).label.split(' (')[0]; };
  const lines = [
    ['Museum', `${a.name}  (ID: ${a.id})`],
    ['Untertitel', a.untertitel + star('untertitel')],
    ['Thema', disp('thema')],
    ['Zielgruppe', opt(AUDIENCE, 'zielgruppe') + star('zielgruppe')],
    ['Sprache, Anrede', `${langName(a.sprache)}, ${a.anrede}`],
    ['Umfang', `${a.reisen} Reisen × ${a.stationenJeReise} Stationen, davon ${a.historisch} historisch; etwa ${e.unique} eindeutige Stationen`],
    ['Reisenamen', disp('reisenamen')],
    ['Look', `${a.skin}${a.skinWahl ? ', Umschaltung für Besucher' : ', ohne Umschaltung'}`],
    ['Exponate', opt(EXHIBITS, 'exponate')],
    ['Heikle Themen', a.heikel.length ? opt(SENSITIVE, 'heikel') : 'keine'],
    ['Quellen', opt(SOURCES, 'quellen') + (a.materialHost ? ` (${a.materialHost})` : '')],
    ['Lizenz, Credits', `${lizenzText(a)}; ${a.urheber || 'keine Urheberangabe'}`],
    ['Impressum', a.impressumUrl || 'kein Link']
  ];
  return lines.map(([k, v]) => `  ${(k + ':').padEnd(18)}${v}`).join('\n');
}

function nextSteps(a, r) {
  const prompt = `Lies docs/AGENTEN.md und packs/${a.id}/BRIEFING.md und richte das Paket packs/${a.id} nach der Anleitung ein: Das Gerüst steht schon, Schritt 0 (Rahmen) ist durch das Briefing erledigt. Arbeite die Schritte 1 bis 8 ab, halte Annahmen in packs/${a.id}/ARBEITSSTAND.md fest, committe nach jedem Schritt und melde am Ende, was geprüft ist und was offen bleibt.`;
  return `
Nächste Schritte
────────────────
1. Auftrag an eine KI geben (Claude Code, Codex …): diesen Text kopieren und im Repository-Ordner einfügen:

   ┌──────────────────────────────────────────────────────────────
${prompt.replace(/(.{1,92})(\s|$)/g, '   │ $1\n').trimEnd()}
   └──────────────────────────────────────────────────────────────

   Oder von Hand: packs/${a.id}/BRIEFING.md lesen, dann docs/AGENTEN.md ab Schritt 1.

2. Während der Arbeit (und am Ende) prüfen und bauen:
   ${checkCmd(a)}
   node tools/layout-map.mjs ${a.id}
   ${buildCmd(a)}
   Ansehen: dist/${a.id}/index.html (Doppelklick genügt)
   Optional Browser-Rauchtest: npm run smoke -- ${a.id} --quick   (braucht Playwright, siehe: npm run doctor)

Hinweis: Bis die Platzhalter („TODO“) ersetzt sind, meldet die Prüfung sie als Fehler. Das ist gewollt, es sind deine offenen Aufgaben.`;
}

function parseArgs(argv) {
  const flags = {};
  for (const x of argv) { const m = /^--([^=]+)(?:=(.*))?$/.exec(x); if (m) flags[m[1]] = m[2] === undefined ? true : m[2]; else flags._ = (flags._ || []).concat(x); }
  return flags;
}

const HELP = `Museum Studio: Einrichtung

  npm run setup                       interaktiv (oder: node tools/onboarding.mjs)
  --config=datei.json                 nicht interaktiv; dieselben Felder wie packs/<id>/BRIEFING.json
  --yes                               keine Abschlussfrage
  --defaults                          keine Fragen, alle Standardwerte (mit --config: für fehlende Felder)
  --dry-run                           nichts schreiben, nur zeigen
  --skip-doctor                       Umgebungsprüfung am Anfang auslassen

Erzeugt packs/<id>/ mit pack.json, BRIEFING.md, BRIEFING.json und ARBEITSSTAND.md. Mehr: docs/ONBOARDING.md`;

export async function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help || flags.h) { say(HELP); return 0; }
  const unknown = Object.keys(flags).filter(k => !['config', 'yes', 'defaults', 'dry-run', 'skip-doctor', 'help', 'h', '_'].includes(k));
  if (unknown.length || flags._) { console.error(`✗ Unbekannte Angabe: ${[...unknown.map(k => '--' + k), ...(flags._ || [])].join(' ')}\n\n${HELP}`); return 2; }
  const skins = TEXT_SKINS();
  const questions = buildQuestions(skins);
  const nonInteractive = !!(flags.config || flags.defaults);
  const dry = !!flags['dry-run'];

  let cfg = {};
  if (flags.config) {
    if (flags.config === true) { console.error('✗ --config braucht eine Datei: --config=datei.json'); return 2; }
    try { cfg = JSON.parse(fs.readFileSync(path.resolve(String(flags.config)), 'utf8')); }
    catch (e) { console.error(`✗ ${flags.config} nicht lesbar: ${e.code === 'ENOENT' ? 'Datei nicht gefunden.' : e.message}`); return 2; }
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) { console.error('✗ Die Konfiguration muss ein JSON-Objekt sein.'); return 2; }
  }

  say('Museum Studio: Einrichtung\n');
  if (!flags['skip-doctor']) {
    const res = runDoctor();
    if (!printDoctor(res, { next: false })) { console.error('\nBitte zuerst die Punkte mit ✗ beheben, dann nochmal.'); return 1; }
    say('');
  }

  let state;
  if (nonInteractive) {
    try { state = fromConfig(questions, cfg, { useDefaults: !!flags.defaults }); }
    catch (e) { if (e instanceof ConfigError) { console.error(`✗ Konfiguration fehlerhaft:\n  ${e.message}`); return 2; } throw e; }
    // abgeleitete ID, wenn nicht vorgegeben; ausdrücklich vorgegebene, aber vergebene ID ist ein Fehler (ist schon in parse geprüft)
    say('Nichtinteraktiv: Angaben aus ' + (flags.config ? flags.config : 'den Standardwerten') + '.');
  } else {
    say('Willkommen! Ich stelle ein paar kurze Fragen zu deinem neuen Museum und lege daraus ein startbereites Paket samt Auftrag für KI-Agenten an.');
    say('Enter übernimmt jeweils den Standardwert in eckigen Klammern. Abbrechen jederzeit mit Strg+C: Dann wird nichts angelegt.');
    if (!process.stdin.isTTY) say('(Antworten kommen aus einer Pipe: Ich gebe sie zur Kontrolle mit aus. Fehlende Antworten nehme ich als Standard, die Abschlussfrage braucht ein ausdrückliches „ja“ oder --yes.)');
  }

  let io = null;
  try {
    if (!nonInteractive) {
      io = makeIO();
      io.onInterrupt(() => { say('\n'); say('Abgebrochen. Es wurde nichts angelegt.'); process.exit(130); });
    }
    for (;;) {
      if (!nonInteractive) state = await interview(io, questions, state);
      const e = estimate(state.a.reisen, state.a.stationenJeReise);
      say('\nZusammenfassung\n───────────────');
      say(summary(state.a, state.d, skins, e));
      say('\n  ' + umfangInfo(state.a.reisen, state.a.stationenJeReise));
      if (nonInteractive || flags.yes) break;
      let again = false;
      for (let first = true; ; first = false) {
        const ans = await io.line(first ? '\nPasst das? [J]a, anlegen / [N]ein, abbrechen / [W]iederholen (alle Fragen nochmal, deine Antworten als Vorgabe): ' : 'Bitte j, n oder w: ');
        if (ans === null) throw new Abort('Die Eingabe endete vor der Bestätigung. (Mit --yes entfällt die Abschlussfrage.)', 1);
        const t = ans.trim().toLowerCase();
        if (t === '' || /^(j|ja|y|yes)$/.test(t)) break;
        if (/^(n|nein|no|abbrechen)$/.test(t)) throw new Abort('Abgebrochen.', 0);
        if (/^(w|wiederholen|nochmal|noch|r)/.test(t)) { again = true; say('\nAlles klar, nochmal von vorn (Enter übernimmt deine bisherige Antwort).'); break; }
      }
      if (!again) break;
    }
  } catch (e) {
    if (io) io.close();
    if (e instanceof Abort) { say(`\n${e.message} Es wurde nichts angelegt.`); return e.code; }
    throw e;
  }
  if (io) io.close();

  const { a, d } = state;
  if (packExists(a.id)) { console.error(`✗ packs/${a.id}/ gibt es inzwischen schon; ich überschreibe nichts. Neue ID wählen und nochmal starten.`); return 2; }
  const e = estimate(a.reisen, a.stationenJeReise);
  let result;
  try {
    const dryInfo = createPack({ id: a.id, title: a.name, journeys: a.reisen, historical: a.historisch, stations: a.stationenJeReise, journeyNames: a.reisenamen.slice(0, a.reisen), pack: packFields(a), dryRun: true });
    const extraFiles = {
      'BRIEFING.md': briefingMd(a, d, dryInfo, e, skins),
      'BRIEFING.json': briefingJson(a, d, dryInfo, e)
    };
    const arbeitsstand = arbeitsstandMd(a, d, dryInfo, e, skins);
    if (dry) {
      say(`\nTrockenlauf: Es würde packs/${a.id}/ mit diesen Dateien entstehen (geschrieben wird nichts):`);
      for (const f of [...dryInfo.files, ...Object.keys(extraFiles)].filter((f, i, arr) => arr.indexOf(f) === i)) say(`  ${f}`);
      say('\n── pack.json (Auszug der gesetzten Felder) ──');
      say(JSON.stringify(dryInfo.pack, (k, v) => k.startsWith('_') || k === 'vocab' || k === 'journeyTypes' ? undefined : v, 2));
      say('\n── BRIEFING.md ──\n' + extraFiles['BRIEFING.md']);
      return 0;
    }
    result = createPack({ id: a.id, title: a.name, journeys: a.reisen, historical: a.historisch, stations: a.stationenJeReise, journeyNames: a.reisenamen.slice(0, a.reisen), pack: packFields(a), extraFiles, arbeitsstand });
  } catch (err) {
    if (err instanceof PackError) { console.error(`✗ ${err.message}`); return 2; }
    throw err;
  }
  say(`\n✓ packs/${a.id}/ angelegt: ${result.journeys} Reisen (${result.historical} historisch), ${result.stubs} Stationsrümpfe, ${result.crossings} Kreuzungen.`);
  say('  Dateien: pack.json, plan.json, journeys.js, stationen/*.js, ARBEITSSTAND.md, BRIEFING.md, BRIEFING.json');
  say(nextSteps(a, result));
  return 0;
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then(code => process.exit(code), err => { console.error('✗ Unerwarteter Fehler: ' + (err && err.stack || err)); process.exit(1); });
}

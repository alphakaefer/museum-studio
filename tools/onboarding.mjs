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
// Die Fragen stehen in tools/onboarding-fragen.json, die Regeln und der Briefing-Text in tools/onboarding-core.mjs (beides teilt sich
// das Terminal mit onboarding.html, erzeugt von tools/build-onboarding-html.mjs). Das Werkzeug erzeugt packs/<id>/ (über tools/new-pack.mjs,
// ohne Zahlen: leerer Plan) mit ausgefülltem pack.json, BRIEFING.md (Auftrag für KI-Agenten und Redaktion), BRIEFING.json und vorbefülltem
// ARBEITSSTAND.md. Geschrieben wird erst ganz am Ende und in einem Zug (nie ein halbes Paket); ein bestehendes Paket wird nie überschrieben.
// Funktioniert auch mit Antworten aus einer Pipe:  printf 'Mein Museum\n\n…' | node tools/onboarding.mjs
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import { ROOT, isMain } from './check-lib.mjs';
import { createPack, PackError } from './new-pack.mjs';
import { runDoctor, printDoctor } from './doctor.mjs';
import { makeContext, isVisible, optionOf, langName, resolveAnswer, defaultFor, asRaw, parseAnswer, displayValue, summaryRows, briefingMd, briefingJson, lizenzText, shareOf, buildCmd, checkCmd, altHinweisText } from './onboarding-core.mjs';

// ───────────────────────────── Grundbausteine ─────────────────────────────

class Abort extends Error { constructor(msg, code) { super(msg); this.code = code === undefined ? 130 : code; } }
class ConfigError extends Error {}

export const FRAGEN_FILE = path.join(ROOT, 'tools', 'onboarding-fragen.json');
export const loadFragen = () => JSON.parse(fs.readFileSync(FRAGEN_FILE, 'utf8'));

export function loadSkins() {
  const dir = path.join(ROOT, 'themes');
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const d of fs.readdirSync(dir).sort()) {
    try { const j = JSON.parse(fs.readFileSync(path.join(dir, d, 'theme.json'), 'utf8')); out.push({ id: j.id || d, name: j.name || d, description: j.description || '' }); } catch (e) { /* kein Skin */ }
  }
  out.sort((a, b) => (a.id === 'halle' ? -1 : b.id === 'halle' ? 1 : 0));
  return out;
}

const packExists = id => fs.existsSync(path.join(ROOT, 'packs', id));
const today = () => new Date().toISOString().slice(0, 10);
export function makeCtx() { return makeContext({ data: loadFragen(), skins: loadSkins(), today: today(), packExists }); }

// ───────────────────────────── Ein- und Ausgabe ─────────────────────────────

function makeIO() {
  const tty = !!process.stdin.isTTY;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
  const queue = [], waiters = [];
  let closed = false;
  rl.on('line', l => { if (waiters.length) waiters.shift()(l); else queue.push(l); });
  rl.on('close', () => { closed = true; while (waiters.length) waiters.shift()(null); });
  return {
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
}
const say = (...a) => console.log(...a);

// ───────────────────────────── Befragung ─────────────────────────────

async function interview(io, ctx, prevState) {
  const a = {}, defaulted = new Set();
  const top = ctx.questions.filter(q => !q.nurWenn);
  let lastBlock = null;
  for (const q of ctx.questions) {
    if (!isVisible(q, a)) { a[q.key] = ''; continue; }
    if (q.block !== lastBlock && !q.nurWenn) {
      lastBlock = q.block;
      const b = ctx.data.bloecke.find(x => x.id === q.block);
      if (b) say(`\n══ ${b.titel} ══\n   ${b.einleitung}`);
    }
    const prev = prevState ? prevState.a : null;
    const def = defaultFor(q, a, ctx, prev);
    const defStr = displayValue(q, def) || (q.typ === 'text' || q.typ === 'url' ? '' : String(def));
    const nr = top.indexOf(q) + 1;
    say(`\n${q.nurWenn ? '   ↳ Nachfrage' : `Frage ${nr} von ${top.length}`} · ${q.titel}`);
    say(`   ${q.hilfe}`);
    if (q.optionen) q.optionen.forEach((o, i) => say(`     ${i + 1}) ${o.label}${o.beschreibung ? ' – ' + o.beschreibung : ''}`));
    const stdLabel = q.optionen && q.typ === 'auswahl' ? (() => { const i = q.optionen.findIndex(o => o.id === def); return i >= 0 ? `${i + 1}` : defStr; })()
      : q.optionen && q.typ === 'mehrfach' ? (def.length ? def.map(d => q.optionen.findIndex(o => o.id === d) + 1).join(',') : 'keine') : defStr;
    say(q.pflicht && !defStr ? '   (Pflichtangabe)' : q.key === 'name' ? `   [Enter = ${defStr}]` : `   [Enter = ${stdLabel || 'leer lassen'}]`);
    for (;;) {
      const raw = await io.line('   > ');
      if (raw === null && q.pflicht && q.key !== 'name') throw new Abort('Die Eingabe endete mitten in der Befragung.', 1);
      if (raw === null && q.key === 'name' && !(prev && prev.name)) throw new Abort('Die Eingabe endete, bevor ein Name da war.', 1);
      const res = resolveAnswer(q, raw === null ? '' : raw, a, ctx, prev);
      if (res.error) { say(`   ${res.error}`); if (raw === null) throw new Abort('Die Eingabe endete.', 1); continue; }
      if (res.usedDefault && !(prevState && q.key in prevState.a && !prevState.d.has(q.key))) defaulted.add(q.key);   // vorher selbst gewählte Antworten bleiben „gewählt“
      if (res.warn) say(`   Hinweis: ${res.warn}`);
      a[q.key] = res.value;
      break;
    }
  }
  return { a, d: defaulted };
}

// ───────────────────────────── Konfiguration (nicht interaktiv) ─────────────────────────────

const IGNORED_KEYS = new Set(['schema', 'erstellt', 'werkzeug', 'abgeleitet', 'standardUebernommen', 'lizenzText']);
const LEGACY_EXHIBITS = { ja: 'viel', spaeter: 'etwas', nein: 'wenig' };

/** Alte Felder umsetzen (exponate, reisen, stationenJeReise, historisch). Gibt { cfg, notes, problems, alt } zurück. */
export function normalizeLegacy(cfg) {
  cfg = Object.assign({}, cfg);
  const notes = [], problems = [], alt = {};
  if ('exponate' in cfg) {
    const old = String(cfg.exponate); delete cfg.exponate;
    if (!('anschauung' in cfg)) { if (LEGACY_EXHIBITS[old]) { cfg.anschauung = LEGACY_EXHIBITS[old]; notes.push(`Altes Feld "exponate": "${old}" gilt jetzt als "anschauung": "${cfg.anschauung}".`); } else problems.push(`Altes Feld „exponate“: „${old}“ unbekannt (ja, spaeter, nein).`); }
  }
  for (const k of ['reisen', 'stationenJeReise']) {
    if (!(k in cfg)) continue;
    const v = cfg[k]; delete cfg[k];
    if (v === null || v === undefined || v === '') continue;
    const n = typeof v === 'number' ? v : (/^\d+$/.test(String(v).trim()) ? parseInt(v, 10) : NaN);
    if (!Number.isInteger(n) || n < 1 || n > 99) problems.push(`Altes Feld „${k}“: „${v}“ ist keine Zahl von 1 bis 99.`); else alt[k] = n;
  }
  if ('historisch' in cfg) {
    const v = cfg.historisch; delete cfg.historisch;
    const n = typeof v === 'number' ? v : (/^\d+$/.test(String(v).trim()) ? parseInt(v, 10) : NaN);
    if (!Number.isInteger(n) || n < 0 || n > 3) problems.push(`Altes Feld „historisch“: „${v}“ ist keine Zahl von 0 bis 3.`);
    else {
      if (!('geschichte' in cfg)) { cfg.geschichte = n > 0 ? 'ja' : 'nein'; notes.push(`Altes Feld "historisch": ${n} gilt jetzt als "geschichte": "${cfg.geschichte}".`); }
      if (n > 0) alt.historisch = n;
    }
  }
  if (Object.keys(alt).length) notes.push(`Die Felder ${Object.keys(alt).map(k => '„' + k + '“').join(', ')} stammen aus einer älteren Konfiguration. Das Onboarding fragt keine Zahlen mehr: Sie gehen nur als unverbindlicher Hinweis ins Briefing, der Agent entscheidet den Umfang fachlich und zeigt den Plan zur Freigabe.`);
  return { cfg, notes, problems, alt };
}

function fromConfig(ctx, cfg0, { useDefaults }) {
  const { cfg, notes, problems, alt } = normalizeLegacy(cfg0);
  for (const n of notes) say(`Hinweis: ${n}`);
  const a = {}, d = new Set();
  const known = new Set(ctx.questions.map(q => q.key));
  for (const k of Object.keys(cfg)) if (!known.has(k) && !IGNORED_KEYS.has(k) && !k.startsWith('_')) problems.push(`Unbekanntes Feld „${k}“ (bekannt: ${[...known].join(', ')}).`);
  for (const q of ctx.questions) {
    if (!isVisible(q, a)) { a[q.key] = ''; continue; }
    const v = cfg[q.key];
    const present = v !== undefined && v !== null && !(typeof v === 'string' && !v.trim() && !q.pflicht);
    if (!present) {
      if (q.pflicht && q.key !== 'name') { problems.push(`Pflichtfeld „${q.key}“ fehlt (${q.titel}).`); continue; }
      if (q.key === 'name' && !useDefaults) { problems.push('Pflichtfeld „name“ fehlt.'); continue; }
      a[q.key] = defaultFor(q, a, ctx, null); d.add(q.key);
      continue;
    }
    const res = parseAnswer(q, asRaw(q, v), a, ctx);
    if (res.error) { problems.push(`Feld „${q.key}“ (${q.titel}): ${res.error}`); continue; }
    a[q.key] = res.value;
  }
  if (problems.length) throw new ConfigError(problems.join('\n  '));
  if (Object.keys(alt).length) a.altHinweis = alt;
  return { a, d };
}

// ───────────────────────────── Dateien erzeugen ─────────────────────────────

const du = a => a.anrede === 'du';

export function footerFor(a) {
  const D = du(a), de = a.sprache === 'de';
  const hinweis = [];
  const h = new Set(a.heikel);
  if (h.has('gesundheit')) hinweis.push(`Dieses Museum bietet Bildung, keine medizinische, psychologische oder therapeutische Beratung und keine Diagnose. Bei Beschwerden oder Sorgen ${D ? 'wende dich' : 'wenden Sie sich'} an eine Ärztin, einen Arzt oder eine Beratungsstelle.`);
  if (h.has('politik')) hinweis.push('Dieses Museum stellt Positionen dar und ordnet sie ein; es will niemanden zu einer Meinung überreden. Wo Fachleute oder Lager uneins sind, steht das auch so da.');
  if (h.has('religion')) hinweis.push('Religiöse und weltanschauliche Überzeugungen werden sachlich beschrieben, nicht bewertet. Über Wahrheitsfragen entscheidet dieses Museum nicht.');
  if (h.has('gewalt')) hinweis.push(`Einzelne Stationen berühren belastende Themen (Gewalt, Krieg, Verlust). Sie sind sachlich und ohne verletzende Einzelheiten geschrieben; ${D ? 'mach gern eine Pause, wenn dich etwas aufwühlt' : 'machen Sie gern eine Pause, wenn Sie etwas aufwühlt'}.`);
  if (!hinweis.length) hinweis.push('Dieses Museum ist ein Bildungsangebot. Es ersetzt keine fachliche Beratung.');
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

export function packFields(a, ctx) {
  const f = {
    title: a.name, eyebrow: eyebrowFor(a), tagline: a.untertitel, lang: a.sprache, defaultSkin: a.skin,
    limits: { min: 11, max: 28, visualShare: shareOf(ctx, a) },
    requireVisualPlan: true,
    footer: footerFor(a),
    license: `Inhalte: ${lizenzText(ctx, a)}${a.lizenz === 'cc0-1.0' ? ' (gemeinfrei gewidmet)' : ''}. Code: MIT (Museum Studio).`,
    credits: a.urheber ? `${a.urheber}. Erstellt mit Museum Studio.` : 'Erstellt mit Museum Studio.'
  };
  if (a.urheber) f.author = a.urheber;
  return f;
}

function arbeitsstandMd(a, d, ctx) {
  const rows = [];
  const add = (x, why) => rows.push(`| ${ctx.today} | **Annahme:** ${x} | ${why} | offen |`);
  const DEF_WHY = 'Im Onboarding mit Enter übernommen, nicht ausdrücklich gewählt.';
  const val = k => displayValue(ctx.byKey[k], a[k]) || '(leer)';
  for (const k of d) if (!['name', 'id'].includes(k) && ctx.byKey[k]) add(`${ctx.byKey[k].titel} = ${val(k)}`, DEF_WHY);
  add('Umfang (Zahl der Reisen und Stationen) entscheidet der Agent nach Thema und Zielgruppe', 'Das Onboarding fragt bewusst keine Zahlen ab; der Plan wird dem Auftraggeber zur Freigabe gezeigt.');
  add(`\`eyebrow\` („${eyebrowFor(a)}“) und \`tagline\` stammen aus den Antworten`, 'Der Agent darf sie schärfen.');
  add('Der Fußhinweis in `pack.json` ist aus den Antworten zu „heikle Themen“ erzeugt' + (a.heikel.length ? ` (${a.heikel.join(', ')})` : ' (Standardhinweis)'), 'Muss vor der Veröffentlichung gegengelesen werden' + ((a.heikel.includes('gesundheit') || a.heikel.includes('gewalt')) && a.sprache === 'de' ? '; die Telefonseelsorge-Nummern gelten für Deutschland.' : '.'));
  if (!a.thema) add('Thema nicht angegeben, aus Name und Untertitel abgeleitet', 'Keine Antwort im Onboarding.');
  if (!a.reisenamen.length) add('Reisenamen: Vorschläge macht der Agent', 'Keine Vorgaben im Onboarding.');
  if (a.sprache !== 'de') add(`Inhalte in ${langName(ctx, a.sprache)}; Oberflächentexte der Engine bleiben deutsch`, 'Bekannte Grenze von Museum Studio 0.1.');
  const L = [];
  L.push(`# Arbeitsstand: ${a.name} (\`packs/${a.id}\`)`, '');
  L.push('Diese Datei ist die Übergabe an den nächsten Agenten oder Menschen. Sie gehört zum Paket und wird nach **jedem Schritt** aktualisiert und mitcommittet.');
  L.push('Was nicht hier oder im Repository steht, ist nach einem Sitzungsabbruch verloren. Vorlage: `packs/_vorlage/ARBEITSSTAND.md`. Der Auftrag steht in `BRIEFING.md` (maschinenlesbar: `BRIEFING.json`).', '');
  L.push(`**Stand:** ${ctx.today}, Schritt 0 von 8 erledigt (Rahmen durch das Onboarding, siehe \`docs/AGENTEN.md\`); als Nächstes Schritt 1 (Reisen finden). Der Plan ist noch leer.`, '');
  L.push('## Rahmen (Schritt 0, aus dem Onboarding)');
  const o = k => { const x = optionOf(ctx, k, a[k]); return x ? x.label + (x.beschreibung ? ` (${x.beschreibung})` : '') : a[k]; };
  L.push(`- Zielgruppe und Vorwissen: ${o('zielgruppe')}`);
  L.push(`- Ton und Ansprache: ${a.anrede}-Anrede, ${langName(ctx, a.sprache)}, warm und klar`);
  L.push(`- Umfang: nicht vorgegeben (Agent entscheidet). Größenordnung als Wunsch: ${displayValue(ctx.byKey.groesse, a.groesse)}${altHinweisText(a) ? `; älterer Hinweis: ${altHinweisText(a)}` : ''}. Geschichte als eigene Reise: ${displayValue(ctx.byKey.geschichte, a.geschichte)}`);
  L.push(`- Erlaubte Quellen: ${a.quellen.map(q => optionOf(ctx, 'quellen', q).label).join('; ')}${a.materialHost ? ` (${a.materialHost})` : ''}`);
  L.push(`- Heikle Themen (und Umgang damit): ${a.heikel.length ? a.heikel.map(x => optionOf(ctx, 'heikel', x).label).join('; ') + ', Sorgfaltsregeln in BRIEFING.md' : 'keine genannt'}`, '');
  L.push('## Annahmen');
  L.push('Alles, was nicht ausdrücklich vom Auftraggeber stammt. Jede Annahme mit Datum und Begründung, damit der Auftraggeber sie später bestätigen oder umwerfen kann.', '');
  L.push('| Datum | Annahme | Begründung | Bestätigt? |', '|---|---|---|---|', ...rows, '');
  L.push('## Entscheidungen', 'Kurz, mit Grund (Warum diese Reisen? Warum keine historische Reise? Warum diese Heimat-Reise für Station X?).', '', '-', '');
  L.push('## Fortschritt je Reise', '| Reise | Plan | Texte | Faktencheck (Stufe) | Bemerkung |', '|---|---|---|---|---|', '| | | | | |', '');
  L.push('Faktencheck-Stufen: **unabhängig geprüft** (anderer Agent oder Mensch, mit Quellen), **Selbstprüfung** (derselbe Agent im getrennten Durchgang mit Quellen), **Gedächtnis** (nicht belegt). Details: `docs/AGENTEN.md`, Schritt 5.', '');
  L.push('## Offen', '- [ ] Reisen und Plan (Schritt 1 und 2), Plan dem Auftraggeber zur Freigabe zeigen', '- [ ] Anschauung planen (Schritt 2b) und bauen, Mindestzahl siehe BRIEFING.md', ...(a.impressumUrl ? [] : ['- [ ] Impressum/Datenschutz-Link klären (im Onboarding keiner angegeben)']), '');
  L.push('## Bekannte Schwächen', '-', '');
  L.push('## Wünsche an die Engine', 'Nur Verweise; Wünsche selbst stehen in `docs/ENGINE-WUENSCHE.md`.', '');
  L.push('## Nächste Schritte', '1. `BRIEFING.md` lesen, dann `docs/AGENTEN.md` ab Schritt 1.', '2. Plan zeigen (Freigabe) oder als Annahme festhalten, dann Stationen schreiben.', '');
  return L.join('\n');
}

// ───────────────────────────── Ausgabe ─────────────────────────────

export function terminalPrompt(a) {
  return `Lies AGENTS.md, docs/AGENTEN.md und packs/${a.id}/BRIEFING.md und richte das Paket packs/${a.id} nach der Anleitung ein: Schritt 0 (Rahmen) ist durch das Briefing erledigt, der Plan ist noch leer. Entscheide Zahl und Zuschnitt der Reisen und Stationen fachlich nach Thema und Zielgruppe, zeige mir den Plan zur Freigabe, bevor du Texte schreibst, und arbeite dann die Schritte 1 bis 8 ab (dazu gehört Schritt 2b, Anschauung planen und bauen). Halte Annahmen in packs/${a.id}/ARBEITSSTAND.md fest, committe nach jedem Schritt und melde am Ende, was geprüft ist und was offen bleibt.`;
}

function nextSteps(a) {
  const prompt = terminalPrompt(a);
  return `
Nächste Schritte
────────────────
1. Auftrag an eine KI geben (Claude Code, Codex, Gemini CLI, Copilot, Cursor …): diesen Text kopieren und im Repository-Ordner einfügen:

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

Hinweis: Der Plan ist noch leer; die Prüfung meldet das („Plan noch leer“), bis Schritt 1 und 2 erledigt sind. Das ist gewollt, es ist die erste Aufgabe des Agenten.`;
}

function openCommand() { return process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'; }
function openFolder(dir) {
  return new Promise(resolve => {
    try {
      const c = spawn(openCommand(), [dir], { detached: true, stdio: 'ignore' });
      c.on('error', () => resolve(false));
      c.unref();
      setTimeout(() => resolve(true), 400);
    } catch (e) { resolve(false); }
  });
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
  --dry-run                           Probelauf: nichts anlegen, nur zeigen
  --skip-doctor                       Umgebungsprüfung am Anfang auslassen

Erzeugt packs/<id>/ mit pack.json, plan.json (leer), BRIEFING.md, BRIEFING.json und ARBEITSSTAND.md.
Ohne Terminal: onboarding.html (Doppelklick) oder ein Dialog mit einer KI (AGENTS.md). Mehr: docs/ONBOARDING.md`;

export async function main(argv) {
  const flags = parseArgs(argv);
  if (flags.help || flags.h) { say(HELP); return 0; }
  const unknown = Object.keys(flags).filter(k => !['config', 'yes', 'defaults', 'dry-run', 'skip-doctor', 'help', 'h', '_'].includes(k));
  if (unknown.length || flags._) { console.error(`✗ Unbekannte Angabe: ${[...unknown.map(k => '--' + k), ...(flags._ || [])].join(' ')}\n\n${HELP}`); return 2; }
  const ctx = makeCtx();
  const nonInteractive = !!(flags.config || flags.defaults);
  const dry = !!flags['dry-run'];
  const PROBE = 'Probelauf: es wurde nichts angelegt.';

  let cfg = {};
  if (flags.config) {
    if (flags.config === true) { console.error('✗ --config braucht eine Datei: --config=datei.json'); return 2; }
    try { cfg = JSON.parse(fs.readFileSync(path.resolve(String(flags.config)), 'utf8')); }
    catch (e) { console.error(`✗ ${flags.config} nicht lesbar: ${e.code === 'ENOENT' ? 'Datei nicht gefunden.' : e.message}`); return 2; }
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) { console.error('✗ Die Konfiguration muss ein JSON-Objekt sein.'); return 2; }
  }

  if (dry) say(PROBE + '\n');
  say('Museum Studio: Einrichtung\n');
  if (!flags['skip-doctor']) {
    const res = runDoctor();
    if (!printDoctor(res, { next: false })) { console.error('\nBitte zuerst die Punkte mit ✗ beheben, dann nochmal.'); return 1; }
    say('');
  }

  let state;
  if (nonInteractive) {
    say('Nichtinteraktiv: Angaben aus ' + (flags.config ? flags.config : 'den Standardwerten') + '.');
    try { state = fromConfig(ctx, cfg, { useDefaults: !!flags.defaults }); }
    catch (e) { if (e instanceof ConfigError) { console.error(`✗ Konfiguration fehlerhaft:\n  ${e.message}`); return 2; } throw e; }
  } else {
    say('Willkommen! Ich stelle ein paar kurze Fragen zu deinem neuen Museum und lege daraus ein startbereites Paket samt Auftrag für KI-Agenten an.');
    say('Zahlen musst du nicht nennen: Wie viele Reisen und Stationen es gibt, entscheidet der Agent und zeigt dir den Plan, bevor er Texte schreibt.');
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
      if (!nonInteractive) state = await interview(io, ctx, state);
      say('\nZusammenfassung\n───────────────');
      say(summaryRows(state.a, state.d, ctx).map(([k, v]) => `  ${(k + ':').padEnd(18)}${v}`).join('\n'));
      say('\n  Zahl und Zuschnitt der Reisen und Stationen legt der Agent fest und zeigt dir den Plan zur Freigabe, bevor er Texte schreibt.');
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
    if (e instanceof Abort) { say(`\n${e.message} Es wurde nichts angelegt.${dry ? '\n' + PROBE : ''}`); return e.code; }
    throw e;
  }

  const { a, d } = state;
  if (packExists(a.id)) { if (io) io.close(); console.error(`✗ packs/${a.id}/ gibt es inzwischen schon; ich überschreibe nichts. Neue ID wählen und nochmal starten.`); return 2; }
  let result;
  const dirAbs = path.join(ROOT, 'packs', a.id);
  try {
    const base = { id: a.id, title: a.name, empty: true, pack: packFields(a, ctx) };
    const dryInfo = createPack(Object.assign({}, base, { dryRun: true }));
    const md = briefingMd(a, d, ctx);
    const extraFiles = { 'BRIEFING.md': md, 'BRIEFING.json': briefingJson(a, d, ctx) };
    if (dry) {
      if (io) io.close();
      say(`\nEs würde ${dirAbs}${path.sep} mit diesen Dateien entstehen (geschrieben wird nichts):`);
      for (const f of [...dryInfo.files, ...Object.keys(extraFiles)].filter((f, i, arr) => arr.indexOf(f) === i)) say(`  ${f}`);
      say('\n── pack.json (Auszug der gesetzten Felder) ──');
      say(JSON.stringify(dryInfo.pack, (k, v) => k.startsWith('_') || k === 'vocab' || k === 'journeyTypes' ? undefined : v, 2));
      say('\n── BRIEFING.md ──\n' + md);
      say(PROBE);
      return 0;
    }
    result = createPack(Object.assign({}, base, { extraFiles, arbeitsstand: arbeitsstandMd(a, d, ctx) }));
  } catch (err) {
    if (io) io.close();
    if (err instanceof PackError) { console.error(`✗ ${err.message}`); return 2; }
    throw err;
  }
  say(`\n✓ Dein Museum-Paket „${a.name}“ ist angelegt (leerer Plan: Reisen und Stationen plant der Agent).`);
  say('  Dateien: pack.json, plan.json, journeys.js, ARBEITSSTAND.md, BRIEFING.md, BRIEFING.json');
  say(`\nDein Auftrag liegt hier:\n  ${path.join(dirAbs, 'BRIEFING.md')}\nDas Paket liegt hier:\n  ${dirAbs}`);
  say(nextSteps(a));
  const tty = !!(process.stdin.isTTY && process.stdout.isTTY);
  if (io && tty) {
    for (let first = true; ; first = false) {
      const ans = await io.line(first ? `\nSoll ich den Ordner jetzt öffnen (${openCommand()})? [J/n] ` : 'Bitte j oder n: ');
      const t = (ans === null ? 'n' : ans.trim().toLowerCase());
      if (t === '' || /^(j|ja|y|yes)$/.test(t)) { const ok = await openFolder(dirAbs); say(ok ? '  Ordner geöffnet.' : `  Das Öffnen hat nicht geklappt; der Pfad steht oben: ${dirAbs}`); break; }
      if (/^(n|nein|no)$/.test(t)) break;
    }
  } else if (tty) say(`\nOrdner öffnen: ${openCommand()} "${dirAbs}"`);
  if (io) io.close();
  return 0;
}

if (isMain(import.meta.url)) {
  main(process.argv.slice(2)).then(code => process.exit(code), err => { console.error('✗ Unerwarteter Fehler: ' + (err && err.stack || err)); process.exit(1); });
}

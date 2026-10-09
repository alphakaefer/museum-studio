// Museum Studio – kleiner YAML-Teilmengen-Leser für Spielpläne (docs/spielplan-standard.md), ohne Abhängigkeiten.
//
//   import { parseYaml, parseDatei, ladeDatei, YamlFehler } from './yaml-lite.mjs';
//   const plan = ladeDatei('docs/spielplan-beispiel-kaffee.yaml');   // YAML oder JSON, nach Inhalt erkannt
//
// Gelesen wird die Teilmenge, die die Beispiele des Standards brauchen und die Autorinnen und Autoren von Hand schreiben:
//   - Block-Abbildungen (schluessel: wert) und Block-Listen (- eintrag), auch Liste auf der Höhe des Schlüssels,
//     Abbildung im Listeneintrag (- id: x / name: y)
//   - Flow-Abbildungen { a: 1, b: [x, y] } und Flow-Listen, auch über mehrere Zeilen
//   - Zeichenketten ohne Anführungszeichen, in "…" (mit \n \t \" \\ \uXXXX) und in '…' (verdoppelte '' )
//   - Zahlen (ganz, Dezimal, Exponent), true/false, null/~, Datumsangaben bleiben Zeichenketten
//   - Kommentare (# nach einem Leerzeichen oder am Zeilenanfang)
//   - Blockzeichenketten | und > (mit - und + am Kopf), eine führende --- Zeile
// Nicht unterstützt, mit Fehlermeldung samt Zeilennummer: Anker und Aliase (&, *), Tags (!), mehrere Dokumente,
// komplexe Schlüssel (?), Merge-Schlüssel (<<), mehrzeilige Zeichenketten ohne | oder >, Tabulatoren zum Einrücken.
// Bekannte Unterschiede zu YAML 1.2: ganze Zahlen mit führenden Nullen sind Zahlen; "yes/no/on/off" sind Zeichenketten.
// JSON-Dateien (erstes Zeichen { oder [) liest JSON.parse; scheitert das, versucht der Leser es als YAML-Flow.
import fs from 'fs';

export class YamlFehler extends Error {
  constructor(meldung, zeile) {
    super(zeile ? `Zeile ${zeile}: ${meldung}` : meldung);
    this.name = 'YamlFehler';
    this.zeile = zeile || 0;
    this.meldung = meldung;
  }
}

const SONDER = /^[&*!%@`]/;

/** Entfernt einen Kommentar am Zeilenende. Anführungszeichen öffnen nur am Anfang eines Wertes (Karl's # bleibt Text, "a # b" bleibt ganz). */
function ohneKommentar(s) {
  let quote = null, start = true, i = 0;
  const ersteStelle = s.search(/\S/);
  for (; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (quote === '"' && c === '\\') { i++; continue; }
      if (c === quote) { if (quote === "'" && s[i + 1] === "'") { i++; continue; } quote = null; start = false; }
      continue;
    }
    if ((c === '"' || c === "'") && start) { quote = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i);
    if (c === ' ' || c === '\t') continue;
    if (c === ',' || c === '[' || c === '{') start = true;
    else if (c === ':' && (i + 1 >= s.length || /\s/.test(s[i + 1]))) start = true;
    else if (c === '-' && i === ersteStelle && (i + 1 >= s.length || /\s/.test(s[i + 1]))) start = true;
    else start = false;
  }
  return s;
}

function skalar(t) {
  if (t === '' || t === '~' || /^(null|Null|NULL)$/.test(t)) return null;
  if (/^(true|True|TRUE)$/.test(t)) return true;
  if (/^(false|False|FALSE)$/.test(t)) return false;
  if (/^[-+]?\d+$/.test(t)) { const n = Number(t); return Number.isSafeInteger(n) ? n : t; }
  if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(t)) return Number(t);
  return t;
}

/** Zeichenkettenleser für Flow-Texte und einzelne Werte. */
function flowLeser(s, nr) {
  let i = 0;
  const fehler = msg => { throw new YamlFehler(`${msg} (bei „${s.slice(Math.max(0, i - 12), i + 18)}“)`, nr); };
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  function dq() {
    i++; let o = '';
    while (i < s.length) {
      const c = s[i++];
      if (c === '"') return o;
      if (c !== '\\') { o += c; continue; }
      const n = s[i++];
      const einfach = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', 0: '\0', ' ': ' ', _: ' ' };
      if (n in einfach) o += einfach[n];
      else if (n === 'u' || n === 'x') {
        const len = n === 'u' ? 4 : 2, hex = s.slice(i, i + len);
        if (!new RegExp(`^[0-9a-fA-F]{${len}}$`).test(hex)) fehler(`ungültige Escape-Folge \\${n}${hex}`);
        o += String.fromCharCode(parseInt(hex, 16)); i += len;
      } else fehler(`unbekannte Escape-Folge \\${n}`);
    }
    return fehler('Zeichenkette nicht geschlossen (mehrzeilige Zeichenketten gehen nur mit | oder >)');
  }
  function sq() {
    i++; let o = '';
    while (i < s.length) {
      const c = s[i++];
      if (c === "'") { if (s[i] === "'") { o += "'"; i++; } else return o; } else o += c;
    }
    return fehler('Zeichenkette nicht geschlossen (mehrzeilige Zeichenketten gehen nur mit | oder >)');
  }
  function plainFlow() {
    let j = i;
    while (j < s.length) {
      const ch = s[j];
      if (ch === ',' || ch === ']' || ch === '}') break;
      if (ch === '[' || ch === '{') { i = j; fehler('Klammer mitten im Wert; setze den Wert in Anführungszeichen'); }
      if (ch === ':' && (j + 1 >= s.length || /\s/.test(s[j + 1]))) { i = j; fehler('Doppelpunkt mit Leerzeichen im Wert; setze den Wert in Anführungszeichen'); }
      j++;
    }
    const t = s.slice(i, j).trim(); i = j;
    if (SONDER.test(t)) fehler('Anker, Alias oder Tag werden nicht unterstützt');
    return skalar(t);
  }
  function schluessel() {
    if (s[i] === '"') return dq();
    if (s[i] === "'") return sq();
    let j = i;
    while (j < s.length && s[j] !== ',' && s[j] !== '}' && s[j] !== ']' && !(s[j] === ':' && (j + 1 >= s.length || /[\s,\]}]/.test(s[j + 1])))) j++;
    const t = s.slice(i, j).trim();
    if (!t) fehler('leerer Schlüssel');
    i = j; return t;
  }
  function abbildung() {
    i++; const o = {};
    for (;;) {
      ws();
      if (i >= s.length) fehler('„}“ fehlt');
      if (s[i] === '}') { i++; return o; }
      const k = schluessel();
      if (Object.prototype.hasOwnProperty.call(o, k)) fehler(`Schlüssel „${k}“ kommt doppelt vor`);
      ws();
      if (s[i] !== ':') fehler(`„:“ nach dem Schlüssel „${k}“ erwartet`);
      i++; ws();
      o[k] = (s[i] === ',' || s[i] === '}') ? null : wert();
      ws();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === '}') { i++; return o; }
      fehler('„,“ oder „}“ erwartet');
    }
  }
  function listeFlow() {
    i++; const a = [];
    for (;;) {
      ws();
      if (i >= s.length) fehler('„]“ fehlt');
      if (s[i] === ']') { i++; return a; }
      a.push(wert());
      ws();
      if (s[i] === ',') { i++; continue; }
      if (s[i] === ']') { i++; return a; }
      fehler('„,“ oder „]“ erwartet');
    }
  }
  function wert() {
    ws();
    const c = s[i];
    if (c === '{') return abbildung();
    if (c === '[') return listeFlow();
    if (c === '"') return dq();
    if (c === "'") return sq();
    return plainFlow();
  }
  return {
    wert, ws,
    ende() { ws(); if (i < s.length) fehler('unerwarteter Text nach dem Wert'); },
    istEnde() { ws(); return i >= s.length; }
  };
}

/** Wie weit sind Flow-Klammern am Ende des Textes noch offen? */
function flowTiefe(s, nr) {
  let tiefe = 0, quote = null, start = true;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (quote === '"' && c === '\\') { i++; continue; }
      if (c === quote) { if (quote === "'" && s[i + 1] === "'") { i++; continue; } quote = null; start = false; }
      continue;
    }
    if ((c === '"' || c === "'") && start) { quote = c; continue; }
    if (c === '[' || c === '{') { tiefe++; start = true; }
    else if (c === ']' || c === '}') { tiefe--; start = false; }
    else if (c === ',' || c === ':') start = true;
    else if (!/\s/.test(c)) start = false;
  }
  if (quote) throw new YamlFehler('Zeichenkette nicht geschlossen (mehrzeilige Zeichenketten gehen nur mit | oder >)', nr);
  return tiefe;
}

export function parseYaml(quelle) {
  const Z = String(quelle).replace(/^﻿/, '').split(/\r\n|\n|\r/).map((roh, i) => ({ nr: i + 1, roh }));
  let pos = 0;
  const fehler = (msg, nr) => { throw new YamlFehler(msg, nr); };

  function einzug(z) {
    if (/^ *\t/.test(z.roh)) fehler('Tabulator in der Einrückung; nutze Leerzeichen', z.nr);
    return /^ */.exec(z.roh)[0].length;
  }
  function zeile(i) {
    const z = Z[i], ein = einzug(z);
    return { nr: z.nr, indent: ein, text: ohneKommentar(z.roh.slice(ein)).trimEnd() };
  }
  /** Index der nächsten Zeile mit Inhalt (ab pos), -1 am Ende. */
  function naechste() {
    while (pos < Z.length) {
      const t = ohneKommentar(Z[pos].roh).trim();
      if (t !== '') return pos;
      pos++;
    }
    return -1;
  }
  const istListe = t => /^-(\s|$)/.test(t);

  /** { key, rest } wenn der Text mit „schluessel:“ beginnt, sonst null. */
  function schluesselVon(t, nr) {
    if (t[0] === '"' || t[0] === "'") {
      const r = flowLeser(t, nr);
      let k;
      try { k = r.wert(); } catch (e) { return null; }
      // Rest nach dem Anführungszeichen suchen
      const m = t[0] === '"' ? /^"(?:[^"\\]|\\.)*"/.exec(t) : /^'(?:[^']|'')*'/.exec(t);
      if (!m) return null;
      const nach = t.slice(m[0].length);
      const mm = /^\s*:(\s+|$)/.exec(nach);
      return mm ? { key: k, rest: nach.slice(mm[0].length).trim() } : null;
    }
    if (/^[{[|>]/.test(t)) return null;
    const m = /:(\s|$)/.exec(t);
    if (!m || m.index === 0) return null;
    const key = t.slice(0, m.index).trimEnd();
    if (SONDER.test(key)) fehler('Anker, Alias oder Tag als Schlüssel werden nicht unterstützt', nr);
    if (key === '<<') fehler('Merge-Schlüssel (<<) werden nicht unterstützt', nr);
    if (key === '?' || /^\?\s/.test(key)) fehler('komplexe Schlüssel (?) werden nicht unterstützt', nr);
    return { key, rest: t.slice(m.index + 1).trim() };
  }

  function einzelWert(t, nr) {
    if (t[0] === '"' || t[0] === "'") { const r = flowLeser(t, nr); const v = r.wert(); r.ende(); return v; }
    if (SONDER.test(t)) fehler('Anker (&), Alias (*), Tag (!) und andere Sonderzeichen am Wertanfang werden nicht unterstützt; setze den Wert in Anführungszeichen', nr);
    if (/^\?(\s|$)/.test(t)) fehler('komplexe Schlüssel (?) werden nicht unterstützt', nr);
    if (/:(\s|$)/.test(t)) fehler('Doppelpunkt mit Leerzeichen im Wert; setze den Wert in Anführungszeichen', nr);
    return skalar(t.trim());
  }

  /** Flow-Wert, der in Zeile i beginnt (Text t) und über mehrere Zeilen gehen darf. */
  function flowWert(t, i, nr) {
    let acc = t, li = i;
    while (flowTiefe(acc, nr) > 0) {
      li++;
      if (li >= Z.length) fehler('Klammer nicht geschlossen', nr);
      acc += ' ' + ohneKommentar(Z[li].roh).trim();
    }
    pos = li + 1;
    const r = flowLeser(acc, nr);
    const v = r.wert();
    r.ende();
    return v;
  }

  function blockSkalar(kopf, eltern, ab, nr) {
    let chomp = 'clip', einr = null;
    for (const ch of kopf.slice(1)) {
      if (ch === '+') chomp = 'keep'; else if (ch === '-') chomp = 'strip';
      else if (/[1-9]/.test(ch)) einr = +ch; else fehler(`ungültiger Kopf der Blockzeichenkette „${kopf}“`, nr);
    }
    let j = ab, blockEinzug = einr !== null ? Math.max(eltern, 0) + einr : null;
    const zeilen = [];
    while (j < Z.length) {
      const r = Z[j].roh;
      if (r.trim() === '') { zeilen.push(null); j++; continue; }
      const ein = /^ */.exec(r)[0].length;
      if (blockEinzug === null) { if (ein <= eltern) break; blockEinzug = ein; }
      if (ein < blockEinzug) break;
      zeilen.push(r.slice(blockEinzug)); j++;
    }
    let nachlauf = 0;
    while (zeilen.length && zeilen[zeilen.length - 1] === null) { zeilen.pop(); nachlauf++; }
    pos = j;
    let text;
    if (kopf[0] === '|') text = zeilen.map(x => x === null ? '' : x).join('\n');
    else {
      const absaetze = []; let cur = [];
      for (const x of zeilen) { if (x === null) { absaetze.push(cur.join(' ')); cur = []; } else cur.push(x); }
      absaetze.push(cur.join(' '));
      text = absaetze.join('\n');
    }
    if (!zeilen.length) return '';
    if (chomp === 'clip') return text + '\n';
    if (chomp === 'keep') return text + '\n'.repeat(1 + nachlauf);
    return text;
  }

  /** Wert hinter „schluessel:“ oder „- “ (t, nicht leer) bzw. auf den folgenden Zeilen. eltern = Einrückung des Schlüssels oder des Strichs. */
  function wertText(t, i, nr, eltern) {
    if (t[0] === '|' || t[0] === '>') return blockSkalar(t, eltern, i + 1, nr);
    if (t[0] === '{' || t[0] === '[') return flowWert(t, i, nr);
    const v = einzelWert(t, nr);
    pos = i + 1;
    const n = naechste();
    if (n >= 0 && zeile(n).indent > eltern) fehler('Fortsetzungszeile: mehrzeilige Zeichenketten ohne | oder > werden nicht unterstützt (Zeile ' + zeile(n).nr + ')', nr);
    return v;
  }

  function parseBlock(minEinzug) {
    const i = naechste();
    if (i < 0) return null;
    const z = zeile(i);
    if (z.indent < minEinzug) return null;
    if (istListe(z.text)) return parseListe(z.indent);
    if (schluesselVon(z.text, z.nr)) return parseAbbildung(z.indent);
    return wertText(z.text, i, z.nr, z.indent - 1);
  }

  function parseAbbildung(einzugsstufe) {
    const out = {};
    for (;;) {
      const i = naechste();
      if (i < 0) break;
      const z = zeile(i);
      if (z.indent < einzugsstufe) break;
      if (z.indent > einzugsstufe) fehler('unerwartete Einrückung: hier erwartet der Leser einen neuen Schlüssel auf Höhe von Spalte ' + (einzugsstufe + 1), z.nr);
      if (z.indent === 0 && (/^---(\s|$)/.test(z.text) || /^\.\.\.\s*$/.test(z.text))) fehler('mehrere Dokumente werden nicht unterstützt', z.nr);
      if (istListe(z.text)) fehler('Listeneintrag mitten in einer Abbildung (fehlt ein Schlüssel davor?)', z.nr);
      const k = schluesselVon(z.text, z.nr);
      if (!k) fehler('erwartet „schluessel: wert“; gelesen: „' + z.text.slice(0, 40) + '“', z.nr);
      if (Object.prototype.hasOwnProperty.call(out, k.key)) fehler(`Schlüssel „${k.key}“ kommt doppelt vor`, z.nr);
      pos = i + 1;
      if (k.rest === '') {
        const n = naechste();
        if (n < 0) out[k.key] = null;
        else {
          const nz = zeile(n);
          if (nz.indent > einzugsstufe) out[k.key] = parseBlock(einzugsstufe + 1);
          else if (nz.indent === einzugsstufe && istListe(nz.text)) out[k.key] = parseListe(einzugsstufe);
          else out[k.key] = null;
        }
      } else out[k.key] = wertText(k.rest, i, z.nr, einzugsstufe);
    }
    return out;
  }

  function parseListe(einzugsstufe) {
    const out = [];
    for (;;) {
      const i = naechste();
      if (i < 0) break;
      const z = zeile(i);
      if (z.indent < einzugsstufe) break;
      if (z.indent > einzugsstufe) fehler('unerwartete Einrückung in der Liste', z.nr);
      if (!istListe(z.text)) break;
      const nachStrich = z.text.slice(1), abstand = /^ */.exec(nachStrich)[0].length, rest = nachStrich.slice(abstand);
      if (rest === '') {
        pos = i + 1;
        const n = naechste();
        out.push(n >= 0 && zeile(n).indent > einzugsstufe ? parseBlock(einzugsstufe + 1) : null);
        continue;
      }
      if (rest[0] === '{' || rest[0] === '[' || rest[0] === '|' || rest[0] === '>' || (!istListe(rest) && !schluesselVon(rest, z.nr))) {
        out.push(wertText(rest, i, z.nr, einzugsstufe));
        continue;
      }
      // verschachtelt (- a: 1 / b: 2   oder   - - x): die Zeile wird zur eingerückten Fortsetzung umgeschrieben
      const roh = Z[i].roh, ein = einzug(Z[i]);
      Z[i].roh = roh.slice(0, ein) + ' ' + ' '.repeat(abstand) + roh.slice(ein + 1 + abstand);
      out.push(parseBlock(einzugsstufe + 1));
    }
    return out;
  }

  // Dokumentanfang
  let start = naechste();
  while (start >= 0 && /^---(\s|$)/.test(Z[start].roh)) {
    const rest = ohneKommentar(Z[start].roh.slice(3)).trim();
    if (rest !== '') { Z[start].roh = ' '.repeat(4) + rest; break; }     // "--- wert" auf einer Zeile: als eingerückter Wert lesen
    pos = start + 1; start = naechste();
  }
  const wert = parseBlock(0);
  const rest = naechste();
  if (rest >= 0) {
    const z = zeile(rest);
    if (/^---(\s|$)/.test(z.text) || /^\.\.\.\s*$/.test(z.text)) fehler('mehrere Dokumente werden nicht unterstützt', z.nr);
    fehler('unerwartete Zeile (falsche Einrückung?): „' + z.text.slice(0, 40) + '“', z.nr);
  }
  return wert;
}

/** Zeile und Spalte aus einer JSON-Fehlermeldung ("at position 123") ermitteln. */
function jsonOrt(text, e) {
  const m = /position (\d+)/.exec(e.message) || /column (\d+)/.exec(e.message);
  if (!m) return e.message;
  const p = Math.min(+m[1], text.length), vor = text.slice(0, p).split('\n');
  return `Zeile ${vor.length}, Spalte ${vor[vor.length - 1].length + 1}: ${e.message.replace(/ in JSON at position \d+.*$/, '')}`;
}

/** JSON (erstes Zeichen { oder [) oder YAML aus einem Text. Wirft YamlFehler mit Zeilennummer. */
export function parseDatei(text, name = '') {
  const t = String(text).replace(/^﻿/, '');
  if (/\.json$/i.test(name)) {                                      // eine .json-Datei ist JSON, kein Ersatz-YAML
    try { return JSON.parse(t); } catch (e) { throw new YamlFehler(`${name}: kein gültiges JSON (${jsonOrt(t, e)})`, 0); }
  }
  if (/^\s*[{[]/.test(t)) {
    try { return JSON.parse(t); }
    catch (e) {
      try { return parseYaml(t); }
      catch (e2) { throw new YamlFehler(`${name ? name + ': ' : ''}kein gültiges JSON (${jsonOrt(t, e)}) und auch kein YAML-Flow (${e2.message})`, 0); }
    }
  }
  try { return parseYaml(t); }
  catch (e) { if (e instanceof YamlFehler && name) e.message = `${name}: ${e.message}`; throw e; }
}

/** Datei lesen (YAML oder JSON). */
export function ladeDatei(pfad) { return parseDatei(fs.readFileSync(pfad, 'utf8'), pfad); }

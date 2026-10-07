#!/usr/bin/env node
// Prüft einen Skin unter themes/<id>/ (oder einen Pfad zu einem Skin-Ordner).
// Aufruf: node tools/check-skin.mjs <skin> [weitere Skins …]      oder:  node tools/check-skin.mjs --all
//
// Geprüft wird:
//   theme.json   gültiges JSON; id = Ordnername; name, description (Text); mode light|dark|both; map.lines octilinear|smooth; map.nodes icons|shapes;
//                fonts (optional, nur Information für Menschen: Liste von Schriftnamen; die Engine liest sie nicht)
//   theme.css    vorhanden; jeder Selektor beginnt mit html[data-skin="<id>"] (sonst wirkt der Skin auf andere Skins und die Engine);
//                keine @import; keine externen URLs (http:, https:, //) in url(…); keine festen Reise-IDs (var(--j-<id>), außer --j-rundreise) → Warnung
// Rückgabe 1 bei Fehlern. Nur Node, keine Pakete.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { newReport, ROOT, isMain } from './check-lib.mjs';

const THEMES = path.join(ROOT, 'themes');

function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')); }

// Zerlegt CSS in Regeln: { selector, line } für Stilregeln (auch in @media/@supports), Ausgabe der @-Regeln getrennt
function walk(css, offsetLine, out) {
  let i = 0;
  const n = css.length;
  const lineAt = pos => offsetLine + css.slice(0, pos).split('\n').length - 1;
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++;
    if (i >= n) break;
    // Kopf bis { oder ;
    let j = i, depthP = 0, q = null;
    while (j < n) {
      const c = css[j];
      if (q) { if (c === q && css[j - 1] !== '\\') q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '(' || c === '[') depthP++;
      else if (c === ')' || c === ']') depthP--;
      else if ((c === '{' || c === ';') && depthP <= 0) break;
      j++;
    }
    const head = css.slice(i, j).trim();
    if (css[j] === ';' || j >= n) {
      if (head) out.atRules.push({ head, line: lineAt(i) });
      i = j + 1;
      continue;
    }
    // Block { … } mit passender Klammer
    let d = 0, k = j;
    q = null;
    for (; k < n; k++) {
      const c = css[k];
      if (q) { if (c === q && css[k - 1] !== '\\') q = null; continue; }
      if (c === '"' || c === "'") q = c;
      else if (c === '{') d++;
      else if (c === '}') { d--; if (d === 0) break; }
    }
    const body = css.slice(j + 1, k);
    if (head.startsWith('@')) {
      out.atRules.push({ head, line: lineAt(i) });
      if (/^@(media|supports|layer|container)\b/i.test(head)) walk(body, lineAt(j + 1), out);
      else if (/^@(font-face)\b/i.test(head)) out.fontFaces.push({ body, line: lineAt(i) });
      // @keyframes u. a.: Inhalt sind keine Selektoren
    } else {
      out.rules.push({ selector: head, body, line: lineAt(i) });
    }
    i = k + 1;
  }
}

function splitSelectors(sel) {
  const parts = [];
  let d = 0, cur = '', q = null;
  for (const c of sel) {
    if (q) { cur += c; if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '(' || c === '[') d++;
    if (c === ')' || c === ']') d--;
    if (c === ',' && d === 0) { parts.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function checkSkin(arg) {
  const R = newReport();
  const dir = /[\\/]/.test(arg) ? path.resolve(arg) : path.join(THEMES, arg);
  const name = path.basename(dir);
  const rel = f => path.relative(ROOT, path.join(dir, f));
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) { R.err(`Skin-Ordner nicht gefunden: ${path.relative(ROOT, dir)} (vorhanden: ${listSkins().join(', ') || 'keine'}).`); return { R, name }; }
  const id = name;
  // ---- theme.json
  const jf = path.join(dir, 'theme.json');
  if (!fs.existsSync(jf)) R.err(`${rel('theme.json')} fehlt. Mindestens {"id":"${id}","name":"…","description":"…"}.`);
  else {
    let meta = null;
    try { meta = JSON.parse(fs.readFileSync(jf, 'utf8')); } catch (e) { R.err(`${rel('theme.json')}: kein gültiges JSON (${e.message}).`); }
    if (meta) {
      if (typeof meta !== 'object' || Array.isArray(meta)) R.err(`${rel('theme.json')}: muss ein Objekt sein.`);
      else {
        if (meta.id !== id) R.err(`${rel('theme.json')}: "id" ist ${JSON.stringify(meta.id)}, muss dem Ordnernamen „${id}“ entsprechen (der Build nutzt den Ordnernamen).`);
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) R.err(`Ordnername „${id}“ ist keine gültige Skin-ID (Kleinbuchstaben, Ziffern, Bindestriche).`);
        for (const k of ['name', 'description']) if (typeof meta[k] !== 'string' || !meta[k].trim()) R.err(`${rel('theme.json')}: "${k}" fehlt oder ist leer (Text für das Aussehen-Menü).`);
        if (meta.mode !== undefined && !['light', 'dark', 'both'].includes(meta.mode)) R.err(`${rel('theme.json')}: "mode" ist ${JSON.stringify(meta.mode)}, erlaubt: "light", "dark", "both".`);
        if (meta.map !== undefined) {
          if (!meta.map || typeof meta.map !== 'object') R.err(`${rel('theme.json')}: "map" muss ein Objekt sein.`);
          else {
            if (meta.map.lines !== undefined && !['octilinear', 'smooth'].includes(meta.map.lines)) R.err(`${rel('theme.json')}: map.lines ist ${JSON.stringify(meta.map.lines)}, erlaubt: "octilinear", "smooth".`);
            if (meta.map.nodes !== undefined && !['icons', 'shapes'].includes(meta.map.nodes)) R.err(`${rel('theme.json')}: map.nodes ist ${JSON.stringify(meta.map.nodes)}, erlaubt: "icons", "shapes".`);
          }
        } else R.warn(`${rel('theme.json')}: "map" fehlt (Standard: octilinear, icons).`);
        if (meta.fonts !== undefined && (!Array.isArray(meta.fonts) || meta.fonts.some(f => typeof f !== 'string'))) R.err(`${rel('theme.json')}: "fonts" muss eine Liste von Schriftnamen sein (nur Information, die Engine liest sie nicht).`);
      }
    }
  }
  // ---- theme.css
  const cf = path.join(dir, 'theme.css');
  if (!fs.existsSync(cf)) { R.err(`${rel('theme.css')} fehlt.`); return { R, name }; }
  const raw = fs.readFileSync(cf, 'utf8');
  const css = stripComments(raw);
  const out = { rules: [], atRules: [], fontFaces: [] };
  walk(css, 1, out);
  if (!out.rules.length) R.err(`${rel('theme.css')}: keine Stilregeln gefunden.`);
  const prefixes = [`html[data-skin="${id}"]`, `html[data-skin='${id}']`];
  let bad = 0;
  for (const r of out.rules) for (const s of splitSelectors(r.selector)) {
    if (!prefixes.some(p => s.startsWith(p))) {
      if (bad++ < 8) R.err(`${rel('theme.css')}, Zeile ${r.line}: Selektor „${s.length > 70 ? s.slice(0, 70) + '…' : s}“ steht nicht hinter html[data-skin="${id}"]. Jeder Selektor muss damit beginnen, sonst wirkt er auch in anderen Skins.`);
    }
  }
  if (bad > 8) R.err(`${rel('theme.css')}: weitere ${bad - 8} Selektoren ohne html[data-skin="${id}"]-Präfix.`);
  for (const a of out.atRules) if (/^@import\b/i.test(a.head)) R.err(`${rel('theme.css')}, Zeile ${a.line}: @import ist nicht erlaubt (keine externen Abrufe, jeder Skin ist eine Datei).`);
  for (const ff of out.fontFaces) R.warn(`${rel('theme.css')}, Zeile ${ff.line}: @font-face. Eingebettete Schriften müssen als Datei im Skin-Ordner liegen (relative URL) und lizenzfrei sein; Standard sind Systemschriften.`);
  const lines = css.split('\n');
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
      const u = m[2].trim();
      if (/^(https?:)?\/\//i.test(u) || /^[a-z][a-z0-9+.-]*:/i.test(u) && !/^data:/i.test(u)) R.err(`${rel('theme.css')}, Zeile ${i + 1}: externe URL „${u.slice(0, 60)}“. Skins laden nichts von außen (Datenschutz, Offline-Betrieb).`);
    }
    if (/\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(l.replace(/https?:\/\/www\.w3\.org\/[^'")\s]*/g, '')) && /(https?:)?\/\//.test(l) && !/url\(/.test(l)) R.warn(`${rel('theme.css')}, Zeile ${i + 1}: enthält eine Web-Adresse; Skins dürfen nichts von außen laden.`);
    for (const m of l.matchAll(/var\(--j-([a-z0-9-]+)/g)) {
      if (m[1] !== 'rundreise') R.warn(`${rel('theme.css')}, Zeile ${i + 1}: feste Reise-ID var(--j-${m[1]}); in anderen Paketen ist sie undefiniert. Nimm var(--hero-bar)/var(--hero-bar-hard) bzw. var(--jc) oder var(--jp-1)…var(--jp-6) (docs/DESIGNER.md, 6.2).`);
    }
  });
  const seenW = new Set(); R.warn = (w => m => { if (!seenW.has(m)) { seenW.add(m); w(m); } })(R.warn);
  R.info = { regeln: out.rules.length };
  return { R, name };
}

function listSkins() { return fs.existsSync(THEMES) ? fs.readdirSync(THEMES, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort() : []; }

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  let targets = argv.filter(a => !a.startsWith('--'));
  if (argv.includes('--all')) targets = listSkins();
  if (!targets.length) { console.error('Aufruf: node tools/check-skin.mjs <skin> [weitere …]  oder  --all\n  <skin> ist der Ordnername unter themes/, z. B. halle.'); process.exit(2); }
  let fail = 0;
  for (const t of targets) {
    const { R, name } = checkSkin(t);
    R.errors.forEach(e => console.log('✗ ' + e));
    R.warnings.forEach(w => console.log('! Warnung: ' + w));
    console.log(R.errors.length ? `✗ Skin „${name}“: ${R.errors.length} Fehler, ${R.warnings.length} Warnungen.` : `✓ Skin „${name}“ ist in Ordnung (${R.info.regeln} Regeln, ${R.warnings.length} Warnungen).`);
    if (R.errors.length) fail = 1;
  }
  process.exit(fail);
}

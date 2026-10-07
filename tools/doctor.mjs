#!/usr/bin/env node
// Museum Studio – Umgebungsprüfung („doctor“). Nur Node-Standardbibliothek.
//   node tools/doctor.mjs        (oder: npm run doctor)
// Prüft Node (Pflicht, ab 18), Git (optional), Playwright und Chromium (optional, nur für den Browser-Rauchtest tools/smoke.mjs)
// und schreibt eine Zusammenfassung: ✓ in Ordnung, • optional und nicht vorhanden, ✗ muss behoben werden.
// Exit-Code 1 nur, wenn etwas Pflichtiges fehlt (Node zu alt oder Repository unvollständig).
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { ROOT, isMain } from './check-lib.mjs';

function tryRun(cmd, args) {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).trim(); } catch (e) { return null; }
}

function findPlaywright() {
  const dirs = [];
  if (process.env.PLAYWRIGHT_MODULE_DIR) dirs.push(path.resolve(process.env.PLAYWRIGHT_MODULE_DIR));
  dirs.push(ROOT);
  for (const d of String(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)) dirs.push(path.resolve(d));
  for (const d of dirs) for (const base of [path.join(d, 'noop.js'), path.join(d, '..', 'noop.js')]) {
    try { return createRequire(base)('playwright'); } catch (e) { /* nächster Versuch */ }
  }
  const g = tryRun('npm', ['root', '-g']);
  if (g) { try { return createRequire(path.join(ROOT, 'noop.js'))(path.join(g, 'playwright')); } catch (e) { /* kein globales Playwright */ } }
  return null;
}

/** Liefert eine Liste { status: 'ok'|'optional'|'fehler', titel, text }. */
export function runDoctor() {
  const out = [];
  const add = (status, titel, text) => out.push({ status, titel, text: text || '' });

  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major >= 18) add('ok', `Node.js ${process.versions.node}`, 'Das reicht. Mehr braucht Museum Studio zum Einrichten und Bauen nicht.');
  else add('fehler', `Node.js ${process.versions.node} ist zu alt`, 'Gebraucht wird Version 18 oder neuer. Download: https://nodejs.org (empfohlen: die aktuelle LTS-Version).');

  const missing = ['engine', 'themes', 'tools/build.mjs', 'packs/_vorlage'].filter(p => !fs.existsSync(path.join(ROOT, p)));
  if (missing.length) add('fehler', 'Repository unvollständig', `Es fehlt: ${missing.join(', ')}. Bitte frisch klonen: git clone https://github.com/alphakaefer/museum-studio.git`);
  else add('ok', 'Repository vollständig', `Skins: ${fs.readdirSync(path.join(ROOT, 'themes')).filter(d => fs.existsSync(path.join(ROOT, 'themes', d, 'theme.json'))).join(', ')}.`);

  const git = tryRun('git', ['--version']);
  if (git) add('ok', git.replace(/^git version /, 'Git '), 'Praktisch, um Zwischenstände festzuhalten (jeder Arbeitsschritt wird commitet).');
  else add('optional', 'Git nicht gefunden', 'Nicht nötig. Ohne Git kannst du das Repository als ZIP von GitHub laden und genauso arbeiten; Versionsverwaltung ist dann deine Sache.');

  const pw = findPlaywright();
  if (!pw) {
    add('optional', 'Playwright nicht installiert (nur für den Browser-Rauchtest)', 'Gar kein Problem: Einrichten, Prüfen und Bauen gehen ohne. Den Rauchtest (npm run smoke) kannst du später nachrüsten:\n      mkdir -p ~/pw && cd ~/pw && npm init -y && npm i playwright && npx playwright install chromium\n      danach: PLAYWRIGHT_MODULE_DIR=~/pw npm run smoke -- <paket>');
  } else {
    let exe = process.env.CHROMIUM_PATH || '';
    if (!exe) { try { exe = pw.chromium.executablePath(); } catch (e) { exe = ''; } }
    if (exe && fs.existsSync(exe)) add('ok', 'Playwright und Chromium gefunden', `Browser: ${exe}. Der Rauchtest ist einsatzbereit.`);
    else add('optional', 'Playwright da, aber Chromium fehlt (nur für den Rauchtest)', 'Browser nachladen:  npx playwright install chromium   (oder CHROMIUM_PATH=/pfad/zu/chrome setzen). Ohne läuft alles andere trotzdem.');
  }
  return out;
}

export function printDoctor(results, { next = true } = {}) {
  const sym = { ok: '✓', optional: '•', fehler: '✗' };
  console.log('Museum Studio: Umgebung prüfen\n');
  for (const r of results) console.log(`  ${sym[r.status]} ${r.titel}${r.text ? '\n      ' + r.text.replace(/\n/g, '\n  ') : ''}`);
  const bad = results.filter(r => r.status === 'fehler').length, opt = results.filter(r => r.status === 'optional').length;
  console.log('');
  if (bad) console.log(`✗ ${bad} Punkt(e) müssen behoben werden, bevor es weitergeht (siehe oben).`);
  else console.log(`✓ Alles Nötige ist da${opt ? ` (${opt} optionale Punkt${opt > 1 ? 'e' : ''} mit •: kein Problem, nur Zusatz)` : ''}.${next ? ' Weiter mit:  npm run setup' : ''}`);
  return bad === 0;
}

if (isMain(import.meta.url)) process.exit(printDoctor(runDoctor()) ? 0 : 1);

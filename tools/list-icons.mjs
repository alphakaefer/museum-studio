#!/usr/bin/env node
// Listet alle Icon-Schlüssel aus engine/js/icons.js (gültige Werte für `icon` bei Reisen und Stationen), nach Gruppen.
// Aufruf: node tools/list-icons.mjs [suchwort]      z. B.  node tools/list-icons.mjs auge
//         node tools/list-icons.mjs --plain          nur Schlüssel, einer je Zeile (für Skripte)
// Das Suchwort filtert nach Teilstring im Schlüssel oder im Namen der Gruppe. Für die Prüfung gilt dieselbe Quelle (check-data, check-pack).
import fs from 'fs';
import path from 'path';
import { ROOT, iconKeys } from './check-lib.mjs';

const keys = iconKeys();
if (!keys) { console.error('✗ engine/js/icons.js nicht lesbar.'); process.exit(2); }
const args = process.argv.slice(2);
const plain = args.includes('--plain');
const q = (args.find(a => !a.startsWith('--')) || '').toLowerCase();

// Gruppen aus den Kommentaren „/* ---------- Name ---------- */“ der Quelldatei
const src = fs.readFileSync(path.join(ROOT, 'engine/js/icons.js'), 'utf8').split(/var D = \{/)[1] || '';
const groups = [];
let cur = { name: 'ohne Gruppe', keys: [] };
for (const line of src.split('\n')) {
  const g = /^\s*\/\*\s*-{3,}\s*(.+?)\s*-{3,}\s*\*\//.exec(line);
  if (g) { if (cur.keys.length) groups.push(cur); cur = { name: g[1], keys: [] }; continue; }
  const k = /^ {4}['"]?([a-z0-9-]+)['"]?\s*:/.exec(line);
  if (k && keys.has(k[1])) cur.keys.push(k[1]);
}
if (cur.keys.length) groups.push(cur);
const listed = new Set(groups.flatMap(g => g.keys));
const rest = [...keys].filter(k => !listed.has(k));
if (rest.length) groups.push({ name: 'weitere', keys: rest });

if (plain) { for (const g of groups) for (const k of g.keys) if (!q || k.includes(q)) console.log(k); process.exit(0); }
let n = 0;
for (const g of groups) {
  const ks = g.keys.filter(k => !q || k.includes(q) || g.name.toLowerCase().includes(q));
  if (!ks.length) continue;
  n += ks.length;
  console.log(`${g.name}:\n  ${ks.join(', ')}`);
}
if (!n) { console.log(`Kein Icon zu „${q}“. Ohne Suchwort werden alle ${keys.size} angezeigt.`); process.exit(1); }
console.log(`\n${n} von ${keys.size} Icons. Verwendung: icon:'<schlüssel>' in journeys.js und in Stationen.`);

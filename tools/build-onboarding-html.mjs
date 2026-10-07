#!/usr/bin/env node
// Erzeugt onboarding.html (Repo-Stamm) aus den Fragen und dem Kern des Terminal-Onboardings.
//
//   node tools/build-onboarding-html.mjs            schreibt onboarding.html
//   node tools/build-onboarding-html.mjs --check    prüft nur, ob onboarding.html aktuell ist (Exit-Code 1, wenn nicht)
//
// Quellen (nur diese ändern, nie onboarding.html von Hand):
//   tools/onboarding-fragen.json   alle Fragen, Texte, Standardwerte, Regeln
//   tools/onboarding-core.mjs      Prüfung und Auftragstext (derselbe Code wie im Terminal, wird in die Seite eingebettet)
//   tools/onboarding-seite.tpl.html  Aussehen und Ablauf der Seite
//   themes/*/theme.json            Liste der Looks
// Ergebnis: eine einzige Datei ohne externe Abrufe; Doppelklick im Browser genügt. Nur Node-Standardbibliothek.
import fs from 'fs';
import path from 'path';
import { ROOT, isMain } from './check-lib.mjs';
import { loadFragen, loadSkins } from './onboarding.mjs';

export function buildHtml() {
  const tpl = fs.readFileSync(path.join(ROOT, 'tools', 'onboarding-seite.tpl.html'), 'utf8');
  let core = fs.readFileSync(path.join(ROOT, 'tools', 'onboarding-core.mjs'), 'utf8');
  if (/^\s*import\s/m.test(core)) throw new Error('onboarding-core.mjs darf keine import-Zeilen enthalten (wird in die Seite eingebettet).');
  core = core.replace(/^export\s+/gm, '');
  if (/<\/script/i.test(core)) throw new Error('onboarding-core.mjs enthält "</script".');
  const json = v => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const out = tpl
    .replace('/*__CORE__*/', () => core)
    .replace('/*__FRAGEN__*/', () => json(loadFragen()))
    .replace('/*__SKINS__*/', () => json(loadSkins()))
    .replace('__GENERIERT__', 'Generator tools/build-onboarding-html.mjs');
  if (/(src|href)\s*=\s*["']https?:/i.test(out)) throw new Error('Die Seite darf keine externen Ressourcen laden.');
  return out;
}

if (isMain(import.meta.url)) {
  const target = path.join(ROOT, 'onboarding.html');
  const html = buildHtml();
  if (process.argv.includes('--check')) {
    const cur = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (cur !== html) { console.error('✗ onboarding.html ist nicht aktuell. Neu erzeugen: node tools/build-onboarding-html.mjs'); process.exit(1); }
    console.log('✓ onboarding.html ist aktuell.');
  } else {
    fs.writeFileSync(target, html);
    console.log(`✓ onboarding.html erzeugt (${(html.length / 1024).toFixed(0)} KB, eine Datei, keine externen Abrufe).`);
  }
}

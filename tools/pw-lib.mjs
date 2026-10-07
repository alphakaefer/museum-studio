// Gemeinsamer Helfer der Browser-Tests (smoke.mjs, viz-test.mjs): Playwright und Chromium ohne feste Pfade finden.
// Suchorte: $PLAYWRIGHT_MODULE_DIR (Ordner, in dem „playwright“ auflösbar ist, z. B. einer mit node_modules/), das Repository, $NODE_PATH, der globale npm-Ordner.
// Chromium: $CHROMIUM_PATH (Programmdatei), sonst der von Playwright installierte Browser.
import path from 'path';
import { createRequire } from 'module';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export const INSTALL_HINT = `Playwright installieren:  mkdir -p ~/pw && cd ~/pw && npm init -y && npm i playwright && npx playwright install chromium
Eigenes Chromium:  CHROMIUM_PATH=/pfad/zu/chrome`;

/** Liefert das Playwright-Modul oder beendet das Programm (Exit-Code 2) mit einem Installationshinweis. extraHint: eine Zeile mit dem Aufruf des jeweiligen Tests. */
export function loadPlaywright(extraHint) {
  const dirs = [];
  if (process.env.PLAYWRIGHT_MODULE_DIR) dirs.push(path.resolve(process.env.PLAYWRIGHT_MODULE_DIR));
  dirs.push(ROOT);
  for (const d of String(process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)) dirs.push(path.resolve(d));
  for (const d of dirs) {
    for (const base of [path.join(d, 'noop.js'), path.join(d, '..', 'noop.js')]) {
      try { return createRequire(base)('playwright'); } catch (e) { /* nächster Versuch */ }
    }
  }
  try { return createRequire(path.join(ROOT, 'noop.js'))(path.join(String(process.env.npm_config_prefix || ''), 'lib', 'node_modules', 'playwright')); } catch (e) { /* kein globales Playwright */ }
  console.error('✗ Playwright nicht gefunden (gesucht in PLAYWRIGHT_MODULE_DIR, Repository, NODE_PATH).\n' + INSTALL_HINT + (extraHint ? '\n' + extraHint : ''));
  process.exit(2);
}

/** Startet Chromium (CHROMIUM_PATH beachtet); bei Fehler Hinweis und Exit-Code 2. */
export async function launch(chromium) {
  try {
    return await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--allow-file-access-from-files'] });
  } catch (e) {
    console.error('✗ Chromium lässt sich nicht starten: ' + String(e.message).split('\n')[0] + '\n' + INSTALL_HINT);
    process.exit(2);
  }
}

#!/usr/bin/env node
// Museum Studio – Rauchtest mit Playwright.
//
//   node tools/smoke.mjs <paket> [--skins=a,b|all] [--quick] [--shots=<ordner>] [--viewports=desktop,tablet,phone] [--themes=light,dark] [--dist=<ordner>]
//
// Voraussetzungen (keine festen Pfade):
//   Playwright wird gesucht in: $PLAYWRIGHT_MODULE_DIR (Ordner, in dem „playwright“ installierbar/auflösbar ist, z. B. ein Ordner mit node_modules/),
//   dem Repository (node_modules/), $NODE_PATH, dem globalen npm-Ordner.
//   Chromium: $CHROMIUM_PATH (Programmdatei), sonst der von Playwright installierte Browser.
//   Installation, falls nichts vorhanden ist:   mkdir -p ~/pw && cd ~/pw && npm init -y && npm i playwright && npx playwright install chromium
//   danach:   PLAYWRIGHT_MODULE_DIR=~/pw node tools/smoke.mjs <paket>

// Öffnet dist/<paket>/index.html per file:// und besucht: Eingang, Netzplan (alle drei Modi), Zeitstrahl (falls vorhanden),
// eine Reise, eine Station, Reisepass, Suche. Desktop 1280, Tablet 820, Handy 390; hell und dunkel; jeder eingebundene Skin
// (und, wenn mehrere eingebunden sind, die Umschaltung selbst).
// Gemeldet werden Konsolenfehler, Seitenfehler (Ausnahmen), fehlgeschlagene Anfragen und horizontales Scrollen.
// Jede Station mit Abbildung wird einmal geöffnet (Abbildung eingehängt, Alt-Text, Überbreite, ein Regler bedient, Bild je Abbildung).
// Jede Station mit Exponat wird einmal geöffnet, das Exponat gestartet (mount), kurz laufen gelassen und beendet (destroy); Konsolenfehler,
// Ausnahmen und eine Fehlermeldung im Exponat-Bereich werden gemeldet.
// Screenshots: Standard dist/<paket>/_shots/ (dist/ ist nicht im Git; ein Neubau löscht den Ordner).
// --quick: nur Desktop, hell.  Rückgabewert 1, sobald etwas gemeldet wurde.
import fs from 'fs';
import path from 'path';
import { loadPlaywright, INSTALL_HINT } from './pw-lib.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argv = process.argv.slice(2);
const POS = argv.filter(a => !a.startsWith('--'));
const args = Object.fromEntries(argv.filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));
if (!POS[0]) { console.error('Aufruf: node tools/smoke.mjs <paket> [--skins=a,b|all] [--quick] [--shots=ordner]'); process.exit(2); }

const PACK = POS[0];
const DIST = path.resolve(ROOT, typeof args.dist === 'string' ? args.dist : path.join('dist', PACK));
const INDEX = path.join(DIST, 'index.html');
if (!fs.existsSync(INDEX)) { console.error(`✗ ${INDEX} fehlt. Erst bauen: node tools/build.mjs ${PACK}`); process.exit(2); }
const SHOTS = path.resolve(typeof args.shots === 'string' ? args.shots : path.join(DIST, '_shots'));
fs.mkdirSync(SHOTS, { recursive: true });

const { chromium } = loadPlaywright(`Dann:  PLAYWRIGHT_MODULE_DIR=~/pw node tools/smoke.mjs ${PACK}`);

const VIEWPORTS = { desktop: { width: 1280, height: 800 }, tablet: { width: 820, height: 1100 }, phone: { width: 390, height: 844 } };
const vpNames = args.quick ? ['desktop'] : (typeof args.viewports === 'string' ? args.viewports.split(',') : Object.keys(VIEWPORTS));
const themes = args.quick ? ['light'] : (typeof args.themes === 'string' ? args.themes.split(',') : ['light', 'dark']);

// eingebundene Skins aus data/skins.js lesen
function readSkins() {
  try {
    const src = fs.readFileSync(path.join(DIST, 'data', 'skins.js'), 'utf8');
    const m = /MUSEUM\.skins=(\[[\s\S]*\]);/.exec(src);
    return m ? JSON.parse(m[1]) : [];
  } catch (e) { return []; }
}
const allSkins = readSkins();
let skinIds = allSkins.map(s => s.id);
if (typeof args.skins === 'string' && args.skins !== 'all') skinIds = args.skins.split(',').filter(s => skinIds.includes(s));
if (!skinIds.length) skinIds = [null];   // Seite ohne Skin

const problems = [];
const log = [];
let shotN = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  let browser;
  try {
    browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--allow-file-access-from-files'] });
  } catch (e) {
    console.error('✗ Chromium lässt sich nicht starten: ' + String(e.message).split('\n')[0] + '\n' + INSTALL_HINT);
    process.exit(2);
  }
  for (const skin of skinIds) for (const vpName of vpNames) for (const theme of themes) {
    const tag = `${skin || 'ohne-skin'}-${vpName}-${theme}`;
    const ctx = await browser.newContext({ viewport: VIEWPORTS[vpName], colorScheme: theme, deviceScaleFactor: 1, hasTouch: vpName !== 'desktop', isMobile: vpName === 'phone' });
    if (skin) await ctx.addInitScript(id => { try { localStorage.setItem('gm:skin', JSON.stringify(id)); } catch (e) { /* egal */ } }, skin);
    const page = await ctx.newPage();
    let where = 'Start';
    const report = (kind, text) => problems.push({ tag, where, kind, text: String(text).slice(0, 400) });
    page.on('console', m => {
      const t = m.type();
      if (t === 'error') report('Konsolenfehler', m.text());
      else if (t === 'warning' && /\[Museum Studio\]/.test(m.text())) report('Warnung', m.text());
    });
    page.on('pageerror', e => report('Seitenfehler', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
    page.on('requestfailed', r => report('Anfrage fehlgeschlagen', r.url()));
    const shot = async (name, full) => {
      try { await page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`), fullPage: !!full }); shotN++; } catch (e) { report('Screenshot', e.message); }
    };
    const hscroll = async () => {
      const o = await page.evaluate(() => {
        const d = document.documentElement;
        return { sw: d.scrollWidth, cw: d.clientWidth, bw: document.body.scrollWidth };
      });
      if (o.sw > o.cw + 1 || o.bw > o.cw + 1) report('Horizontales Scrollen', `scrollWidth ${o.sw} / body ${o.bw} > Fensterbreite ${o.cw}`);
    };
    const go = async (hash, name, opts = {}) => {
      where = name;
      await page.evaluate(h => { location.hash = h; }, hash);
      await sleep(opts.wait || 700);
      await hscroll();
      if (!opts.noShot) await shot(name, opts.full);
    };

    try {
      where = 'Eingang';
      await page.goto('file://' + INDEX, { waitUntil: 'load' });
      await page.waitForFunction(() => document.documentElement.classList.contains('gm-ready'), null, { timeout: 15000 });
      await sleep(900);
      await hscroll();
      const info = await page.evaluate(() => ({
        skin: document.documentElement.getAttribute('data-skin'),
        journeys: MUSEUM.data.journeys.length, stations: Object.keys(MUSEUM.data.stations).length,
        crossings: (MUSEUM.crossings || []).length, hasTime: MUSEUM.hasTimeline(),
        firstJ: MUSEUM.data.journeys[0].id, firstS: MUSEUM.data.orders[MUSEUM.data.journeys[0].id][0],
        skinBtn: !!document.querySelector('#skin-knopf') && !document.querySelector('#skin-wrap').hidden,
        tourOn: !!(MUSEUM.data.journeyById && MUSEUM.data.journeyById.rundreise)
      }));
      if (skin && info.skin !== skin) report('Skin', `data-skin ist "${info.skin}", erwartet "${skin}"`);
      if (!info.journeys || !info.stations) report('Daten', `Reisen ${info.journeys}, Stationen ${info.stations}`);
      if (allSkins.length > 1 && !info.skinBtn) report('Skin-Umschaltung', 'nicht sichtbar, obwohl mehrere Skins eingebunden sind');
      if (allSkins.length < 2 && info.skinBtn) report('Skin-Umschaltung', 'sichtbar, obwohl nur ein Skin eingebunden ist');
      if (!log.length) log.push(`Seite: ${info.stations} Stationen, ${info.journeys} Reisen, ${info.crossings} Kreuzungen, Zeitstrahl ${info.hasTime ? 'ja' : 'nein'}, Rundreise ${info.tourOn ? 'ja' : 'nein'}`);
      await shot('1-eingang', vpName === 'desktop' && theme === 'light');

      // Netzplan: drei Modi
      await go('#/karte', '2a-netzplan-reisen', { wait: 1200 });
      const seg = await page.$$('.gm-karte-seg button');
      if (seg.length < 3) report('Netzplan', `nur ${seg.length} Umschalter für die Modi`);
      const names = ['2b-netzplan-gesamtnetz', '2c-netzplan-liste'];
      for (let i = 1; i < Math.min(3, seg.length); i++) {
        where = names[i - 1];
        await seg[i].click();
        await sleep(i === 1 ? 2800 : 800);
        await hscroll();
        await shot(names[i - 1]);
      }
      if (seg.length) { await seg[0].click(); await sleep(300); }   // zurück in die Reisenansicht (Standard)

      if (info.hasTime) {
        await go('#/zeitstrahl', '3-zeitstrahl', { wait: 1500 });
      } else {
        const visible = await page.evaluate(() => { const a = document.querySelector('[data-view="zeitstrahl"]'); return !!a && a.offsetParent !== null; });
        if (visible) report('Zeitstrahl', 'Tab sichtbar, obwohl es keine historischen Reisen gibt');
      }
      await go(`#/reise/${info.firstJ}`, '4a-reise-einfuehrung', { wait: 1000 });
      await go(`#/reise/${info.firstJ}/${info.firstS}`, '4b-reise-station', { wait: 1000 });
      await go(`#/station/${info.firstS}`, '5-station', { wait: 900 });
      if (info.tourOn) await go('#/reise/rundreise', '5b-rundreise', { wait: 900 });
      await go('#/reisepass', '6-reisepass', { wait: 1000 });
      await go('#/', '7-eingang-zurueck', { noShot: true, wait: 500 });

      // Suche
      where = 'Suche';
      await page.keyboard.press('/');
      await sleep(500);
      await page.keyboard.type('a', { delay: 40 });
      await sleep(700);
      await hscroll();
      await shot('8-suche');
      const found = await page.evaluate(() => { const o = document.querySelector('#suche-overlay'); return !!o && !o.hidden && o.querySelectorAll('a,button').length > 3; });
      if (!found) report('Suche', 'Overlay zeigt keine Treffer');
      await page.keyboard.press('Escape');
      await sleep(400);

      // Exponate: jede Station mit Exponat einmal öffnen, starten (mount), laufen lassen, beenden (destroy)
      if (vpName === 'desktop' && theme === 'light') {
        const exSt = await page.evaluate(() => Object.values(MUSEUM.data.stations).filter(s => s.exhibit).map(s => ({ id: s.id, ex: s.exhibit })));
        for (const e of exSt) {
          where = `Exponat „${e.ex}“ (Station ${e.id})`;
          await page.evaluate(h => { location.hash = h; }, `#/station/${e.id}`);
          await sleep(800);
          const btn = await page.$('.gm-st-exhibit .gm-plaque-actions button');
          if (!btn) { report('Exponat', 'keine Start-Schaltfläche (Exponat nicht registriert? MUSEUM.exhibits["' + e.ex + '"] mit mount fehlt)'); continue; }
          await btn.click();
          await sleep(900);
          const st = await page.evaluate(() => {
            const m = document.querySelector('.gm-st-exhibit .gm-stage-mount');
            return { shown: !!m && !m.hidden, kids: m ? m.childElementCount : 0, alert: !!(m && m.querySelector(':scope > .gm-stage-note[role="alert"]')), w: m ? m.getBoundingClientRect().width : 0 };
          });
          if (!st.shown || !st.kids) report('Exponat', 'mount hat nichts in den Container gezeichnet');
          if (st.alert) report('Exponat', 'mount warf eine Ausnahme (Meldung im Exponat-Bereich)');
          await hscroll();
          await shot(`7b-exponat-${e.ex}`);
          const endBtn = await page.$('.gm-st-exhibit .gm-stage-end button');
          if (endBtn) { await endBtn.click(); await sleep(300); }
          else report('Exponat', 'keine Schaltfläche „beenden“ gefunden');
        }
        await page.evaluate(() => { location.hash = '#/'; });
        await sleep(300);
      }

      // Abbildungen: jede Station mit Abbildung einmal öffnen (Abbildung wird dabei eingehängt), Fehler und Überbreite melden, Bild der Abbildung ablegen.
      // Desktop hell und Handy dunkel genügen (Breite und Farbschema sind die Risiken).
      if ((vpName === 'desktop' && theme === 'light') || (vpName === 'phone' && theme === 'dark') || args.quick) {
        const viSt = await page.evaluate(() => Object.values(MUSEUM.data.stations).filter(s => MUSEUM.visuals && MUSEUM.visuals[s.id]).map(s => s.id));
        for (const id of viSt) {
          where = `Abbildung „${id}“`;
          await page.evaluate(h => { location.hash = h; }, `#/station/${id}`);
          await sleep(700);
          const fig = await page.$(`.gm-st-figure[data-visual="${id}"]`);
          if (!fig) { report('Abbildung', 'wurde nicht eingehängt (mount warf eine Ausnahme oder gab nichts zurück; siehe Warnung davor)'); continue; }
          const st = await page.evaluate(i => {
            const f = document.querySelector(`.gm-st-figure[data-visual="${i}"]`), stage = f && f.querySelector('.gm-fig-stage');
            const r = stage ? stage.getBoundingClientRect() : { width: 0, height: 0 };
            const over = stage ? Array.from(stage.querySelectorAll('*')).filter(n => { const b = n.getBoundingClientRect(); return b.width > 0 && (b.right > r.right + 2 || b.left < r.left - 2); }).length : 0;
            return { kids: stage ? stage.childElementCount : 0, w: r.width, h: r.height, over, alt: !!(stage && stage.getAttribute('aria-label')), alert: !!(stage && stage.querySelector('[role="alert"]')) };
          }, id);
          if (!st.kids) report('Abbildung', 'Bühne ist leer');
          if (st.h < 40) report('Abbildung', `Bühne ist nur ${Math.round(st.h)} px hoch (nichts gezeichnet?)`);
          if (!st.alt) report('Abbildung', 'kein Alt-Text (alt fehlt in MUSEUM.visuals)');
          if (st.over > 0) report('Abbildung', `${st.over} Element(e) ragen über den Rand der Abbildung hinaus`);
          await hscroll();
          try { await fig.scrollIntoViewIfNeeded(); await sleep(300); await fig.screenshot({ path: path.join(SHOTS, `${tag}-abbildung-${id}.png`) }); shotN++; } catch (e) { report('Screenshot', e.message); }
          // einmal bedienen: ersten Regler bewegen, damit Neuzeichnen und Konsolenfehler sichtbar werden
          const rng = await page.$(`.gm-st-figure[data-visual="${id}"] input[type=range]`);
          if (rng) { try { await rng.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await sleep(250); } catch (e) { report('Abbildung', 'Regler nicht bedienbar: ' + e.message); } }
        }
        await page.evaluate(() => { location.hash = '#/'; });
        await sleep(300);
      }

      // Skin-Umschaltung selbst (einmal je Skin-Lauf, nur Desktop hell)
      if (allSkins.length > 1 && vpName === 'desktop' && theme === 'light') {
        where = 'Skin-Umschaltung';
        await page.evaluate(() => { location.hash = '#/karte'; });
        await sleep(800);
        for (const s of allSkins) {
          if (s.id === skin) continue;
          await page.click('#skin-knopf');
          await sleep(200);
          await page.click(`.gm-skin-item[data-skin="${s.id}"]`);
          await sleep(900);
          const now = await page.evaluate(() => document.documentElement.getAttribute('data-skin'));
          if (now !== s.id) report('Skin-Umschaltung', `Wechsel zu ${s.id} fehlgeschlagen (data-skin=${now})`);
          await hscroll();
          await shot(`9-umschaltung-zu-${s.id}`);
          break;   // ein Wechsel je Lauf genügt, alle Skins werden ohnehin einzeln besucht
        }
      }
    } catch (e) {
      report('Testfehler', e.message);
    }
    await ctx.close();
    process.stdout.write(`  ${tag}: ${problems.filter(p => p.tag === tag).length ? 'Probleme' : 'ok'}\n`);
  }
  await browser.close();
}

await run();
console.log(log.join('\n'));
console.log(`Screenshots: ${shotN} in ${SHOTS}`);
if (problems.length) {
  const seen = new Set();
  console.log(`\n✗ ${problems.length} Meldung(en):`);
  for (const p of problems) {
    const key = `${p.kind}|${p.where}|${p.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  [${p.tag}] ${p.where}: ${p.kind}: ${p.text}`);
  }
  process.exit(1);
}
console.log('✓ Rauchtest bestanden (keine Konsolen- oder Seitenfehler, kein horizontales Scrollen).');

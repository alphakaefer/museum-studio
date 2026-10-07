// Prüft packs/<paket>/material.js (Verweise auf weiterführende Quellen je Station; nur Titel + Link).
// Aufruf: node tools/check-material.mjs <paket> [--register=pfad/register.json]
// Ohne material.js: ok (optional). Links: wohlgeformte https-URLs; mit quellen.txt zusätzlich nur dort gelistete.
// Mit --register (oder Umgebungsvariable WISSENSREGISTER) zusätzlich die strengen Regeln des Gehirnmuseums gegen das Wissensregister
// (Titel, Thema, rechte=oeffentlich, stand=gesammelt, typ=beitrag, nur der eigenen Domain, MATERIAL_HOST).
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { newReport, loadPlan, loadStations, loadSources, wellFormedHttps, packFromArgv, finish, isMain, ROOT } from './check-lib.mjs';

const strip = t => String(t).replace(/^(\s*\[[^\]]*\]\s*)+/, '');

export function checkMaterial(P, opts = {}) {
  const R = newReport();
  const file = path.join(P.dir, 'material.js'), rel = P.rel('material.js');
  if (!fs.existsSync(file)) { R.info = { material: 0, links: 0 }; return R; }
  const plan = loadPlan(P, R);
  if (!plan) return R;
  const planIds = new Set((plan.stations || []).map(s => s.id));
  const sources = loadSources(P);
  const sRep = newReport();
  const st = loadStations(P, sRep);
  const blogOf = {};
  for (const [id, s] of Object.entries(st.all)) blogOf[id] = (s.blog || []).map(b => b && b.u);
  const ctx = { console }; ctx.window = ctx; ctx.MUSEUM = {};
  try { vm.runInNewContext(fs.readFileSync(file, 'utf8'), ctx, { filename: rel, timeout: 5000 }); }
  catch (e) { R.err(`${rel}: Ladefehler (${e.message}).`); return R; }
  const mat = ctx.MUSEUM.material;
  if (!mat || typeof mat !== 'object') { R.err(`${rel}: MUSEUM.material fehlt. Erwartet: MUSEUM.material = { 'station-id': [ {t:'Titel', u:'https://…'} ] };`); return R; }

  let reg = null, regBy = null;
  const regPath = opts.register || process.env.WISSENSREGISTER;
  if (regPath) {
    try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')).eintraege; regBy = new Map(reg.map(e => [e.link, e])); }
    catch (e) { R.err(`Wissensregister ${regPath} nicht lesbar (${e.message}).`); return R; }
  }
  let nStations = 0, nLinks = 0;
  for (const [id, list] of Object.entries(mat)) {
    nStations++;
    const E = m => R.err(`${rel}, Station „${id}“: ${m}`);
    if (!planIds.has(id)) E('steht nicht in plan.json. Verweis löschen oder Station anlegen.');
    if (!Array.isArray(list)) { E('Wert ist kein Array von {t,u}-Einträgen.'); continue; }
    if (list.length > 3) E(`höchstens 3 Links, hier ${list.length}.`);
    const seen = new Set();
    for (const l of list) {
      nLinks++;
      if (!l || typeof l !== 'object' || !l.t || !l.u) { E(`Link unvollständig (t und u nötig): ${JSON.stringify(l)}`); continue; }
      const allowed = reg ? ['t', 'thema', 'u'] : ['t', 'thema', 'u'];
      const extra = Object.keys(l).filter(k => !allowed.includes(k));
      if (extra.length) E(`unerwartete Felder (${extra.join(', ')}); erlaubt sind t, u und optional thema.`);
      if (seen.has(l.u)) E(`Dublette: ${l.u}`); seen.add(l.u);
      if (!wellFormedHttps(l.u)) { E(`keine wohlgeformte https-URL: ${l.u}`); continue; }
      if (sources && !sources.has(l.u)) E(`Link nicht in ${P.rel('quellen.txt')} erlaubt: ${l.u}`);
      if ((blogOf[id] || []).includes(l.u)) E(`steht schon im blog-Feld der Station: ${l.u}`);
      if (reg) {
        if (!l.thema) E(`thema fehlt (Register-Prüfung): ${l.u}`);
        const e = regBy.get(l.u);
        if (!e) { E(`Link nicht im Wissensregister: ${l.u}`); continue; }
        if (process.env.MATERIAL_HOST && !l.u.startsWith(process.env.MATERIAL_HOST)) E(`Link nicht auf ${process.env.MATERIAL_HOST}: ${l.u}`);
        if (e.rechte !== 'oeffentlich') E(`rechte=${e.rechte}: ${l.u}`);
        if (e.stand !== 'gesammelt') E(`stand=${e.stand}: ${l.u}`);
        if (e.typ !== 'beitrag') E(`typ=${e.typ}: ${l.u}`);
        if (l.t !== strip(e.titel)) E(`Titel „${l.t}“ weicht vom Register ab („${strip(e.titel)}“).`);
        if (!(e.themen || []).includes(l.thema) && e.thema !== l.thema) E(`Thema „${l.thema}“ nicht im Registereintrag (${(e.themen || []).join(', ')}): ${l.u}`);
      }
    }
  }
  R.info = { material: nStations, links: nLinks };
  return R;
}

if (isMain(import.meta.url)) {
  const { P, flags } = packFromArgv('check-material.mjs', ' [--register=register.json]');
  const R = checkMaterial(P, { register: flags.register === true ? undefined : flags.register });
  finish(R, `${R.info.material} Stationen mit ${R.info.links} Links ok${R.info.material ? '' : ' (kein material.js)'}`);
}

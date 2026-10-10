// Museum Studio – Onboarding-Kern: Fragen prüfen und Auftrag (Briefing) erzeugen.
// REINE Funktionen ohne Importe und ohne Node-Zugriffe, damit derselbe Code im Terminal (tools/onboarding.mjs) und im Browser
// (onboarding.html, eingebettet von tools/build-onboarding-html.mjs) läuft und beide denselben Text erzeugen.
// Wichtig: keine `import`-Zeilen und keine Node-APIs in dieser Datei; `export` vor Funktionen genügt (der Generator entfernt es).
// Die Fragen selbst stehen in tools/onboarding-fragen.json.

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HTTPS_RE = /^https:\/\/[^\s/]+\.[^\s/]+\S*$/;

export function slugify(s) {
  let t = String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  t = t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return t || 'museum';
}

/**
 * Baut die Fragenliste aus der JSON-Quelle. skins: [{ id, name, description }] (aus themes/*\/theme.json).
 * Die Frage „skin“ bekommt ihre Optionen aus der Skinliste.
 */
export function buildQuestions(data, skins) {
  return data.fragen.map(f => {
    const q = Object.assign({}, f);
    if (f.optionenQuelle === 'skins') {
      q.optionen = skins.map(s => ({ id: s.id, label: s.name, beschreibung: s.description || '', aliases: [String(s.name).toLowerCase()] }));
      if (!q.optionen.length) q.optionen = [{ id: 'halle', label: 'halle', beschreibung: '', aliases: [] }];
    }
    return q;
  });
}

export function makeContext({ data, skins, today, packExists }) {
  const questions = buildQuestions(data, skins);
  const byKey = {};
  for (const q of questions) byKey[q.key] = q;
  const exists = typeof packExists === 'function' ? packExists : () => false;
  const freeId = base => { if (!exists(base)) return base; for (let i = 2; i < 100; i++) if (!exists(`${base}-${i}`)) return `${base}-${i}`; return `${base}-${Date.now()}`; };
  return { data, skins, questions, byKey, today: today || '', packExists: exists, freeId, langs: data.sprachen || {} };
}

export function isVisible(q, a) {
  if (!q.nurWenn) return true;
  const v = a[q.nurWenn.key];
  return q.nurWenn.enthaelt !== undefined ? Array.isArray(v) && v.includes(q.nurWenn.enthaelt) : v === q.nurWenn.gleich;
}

export const optionOf = (ctx, key, id) => (ctx.byKey[key].optionen || []).find(o => o.id === id) || null;
export const langName = (ctx, c) => ctx.langs[c] || c;

// ───────────────────────────── Prüfen ─────────────────────────────

/** Wählt aus einer Optionsliste per Nummer oder Name (Präfix genügt). */
export function pickOptions(raw, options, { multi = false, unknown } = {}) {
  if (!multi) {   // ganze Eingabe als Name, zum Beispiel „CC BY 4.0“ = cc-by-4.0
    const whole = String(raw).trim().toLowerCase().replace(/\s+/g, '-');
    const w = options.find(o => o.id.toLowerCase() === whole || (o.aliases || []).includes(whole));
    if (w) return { value: w.id };
  }
  const tokens = String(raw).toLowerCase().split(/[,;/+\s]+/).filter(Boolean);
  if (!tokens.length) return { error: 'Bitte etwas auswählen.' };
  const chosen = [];
  for (const t of tokens) {
    let hit = null;
    if (/^\d+$/.test(t)) hit = options[parseInt(t, 10) - 1] || null;
    if (!hit) hit = options.find(o => o.id.toLowerCase() === t) || options.find(o => (o.aliases || []).some(x => x === t)) || options.find(o => t.length >= 3 && (o.aliases || []).concat(o.id.toLowerCase()).some(x => x.startsWith(t)));
    if (!hit) return { error: unknown ? unknown.replace('{eingabe}', String(raw).trim()) : `„${t}“ kenne ich nicht. Wähle ${multi ? 'eine oder mehrere Nummern (mit Komma getrennt)' : 'eine Nummer'} aus der Liste.` };
    if (!chosen.includes(hit.id)) chosen.push(hit.id);
  }
  if (!multi && chosen.length > 1) return { error: 'Hier geht nur eine Auswahl.' };
  return { value: multi ? chosen : chosen[0] };
}

export function parseYesNo(raw) {
  const t = String(raw).trim().toLowerCase();
  if (/^(j|ja|y|yes|1|true)$/.test(t)) return { value: true };
  if (/^(n|nein|no|0|false)$/.test(t)) return { value: false };
  return { error: 'Bitte ja oder nein.' };
}

/** Prüft eine Eingabe (Text) gegen die Regeln der Frage. Gibt { value, warn?, error? } zurück. */
export function parseAnswer(q, raw, a, ctx) {
  raw = String(raw === undefined || raw === null ? '' : raw);
  const v = q.validierung || {};
  const F = v.fehler || {};
  switch (q.typ) {
    case 'text': {
      const t = raw.trim();
      if (!t) return v.leerErlaubt ? { value: '' } : { error: F.leer || 'Bitte etwas eingeben.' };
      if (v.max && t.length > v.max) return { error: F.zuLang || `Bitte höchstens ${v.max} Zeichen.` };
      if (v.keinHtml && /[<>]/.test(t)) return { error: F.html || 'Bitte ohne spitze Klammern (kein HTML).' };
      if (v.warnAb && t.length > v.warnAb && v.warnung) return { value: t, warn: v.warnung.replace('{n}', String(t.length)) };
      return { value: t };
    }
    case 'id': {
      const t = raw.trim().toLowerCase();
      if (!SLUG_RE.test(t)) return { error: `„${raw.trim()}“ geht nicht: nur Kleinbuchstaben a–z, Ziffern und einzelne Bindestriche, keine Umlaute oder Leerzeichen (zum Beispiel ${slugify(raw)}).` };
      if (v.max && t.length > v.max) return { error: `Bitte höchstens ${v.max} Zeichen.` };
      if (ctx.packExists(t)) return { error: `packs/${t}/ gibt es schon, ich überschreibe nie ein bestehendes Paket. Nimm eine andere ID (Vorschlag: ${ctx.freeId(t)}).` };
      return { value: t };
    }
    case 'sprache': {
      let t = raw.trim().toLowerCase();
      const byName = Object.entries(ctx.langs).find(([, n]) => n.toLowerCase().startsWith(t) && t.length >= 3);
      if (byName) t = byName[0];
      if (!/^[a-z]{2}(-[a-z]{2,})?$/.test(t)) return { error: F.ungueltig || 'Bitte einen Sprachcode wie de oder en.' };
      return t === 'de' ? { value: t } : { value: t, warn: (v.warnung || '').replace('{name}', langName(ctx, t)) };
    }
    case 'auswahl': return pickOptions(raw, q.optionen, { unknown: q.fehlerUnbekannt });
    case 'mehrfach': {
      const t = raw.trim().toLowerCase();
      if (q.keineAlias && (!t || q.keineAlias.includes(t))) return { value: [] };
      return pickOptions(raw, q.optionen, { multi: true, unknown: q.fehlerUnbekannt });
    }
    case 'jaNein': return parseYesNo(raw);
    case 'liste': {
      const t = raw.trim();
      if (!t || /^(nein|keine|-)$/i.test(t)) return { value: [] };
      const parts = (t.includes(';') ? t.split(';') : t.split(',')).map(x => x.trim()).filter(Boolean);
      if (v.maxEintrag && parts.some(x => x.length > v.maxEintrag)) return { error: F.zuLang || 'Ein Eintrag ist zu lang.' };
      return { value: parts };
    }
    case 'url': {
      const t = raw.trim();
      if (!t) return v.leerErlaubt ? { value: '' } : { error: F.ungueltig || 'Bitte eine Adresse mit https://.' };
      return HTTPS_RE.test(t) && !(v.keineKlammern && /[()\[\]]/.test(t)) ? { value: t } : { error: F.ungueltig || 'Bitte eine Adresse mit https://.' };
    }
    default: return { value: raw.trim() };
  }
}

/** Hat die Frage einen Standard, der von einer früheren Antwort abhängt ({ abhaengig: { key, enthaelt | gleich, dann, sonst } })? */
export function hatAbhaengigenStandard(q) {
  const s = q.standard;
  return !!(s && typeof s === 'object' && !Array.isArray(s) && s.abhaengig && typeof s.abhaengig === 'object');
}

/** Standardwert einer Frage (prev: frühere Antworten bei „Wiederholen“). */
export function defaultFor(q, a, ctx, prev) {
  if (prev && q.key in prev && prev[q.key] !== '' && prev[q.key] !== undefined) return prev[q.key];
  const s = q.standard;
  if (s && typeof s === 'object' && !Array.isArray(s) && s.ableitung === 'id-aus-name') return ctx.freeId(slugify(a.name || 'museum'));
  if (hatAbhaengigenStandard(q)) {   // Standard hängt von einer früheren Antwort ab (zum Beispiel Zugang je nach heiklem Thema)
    const d = s.abhaengig, v = a[d.key];
    return (d.enthaelt !== undefined ? Array.isArray(v) && v.includes(d.enthaelt) : v === d.gleich) ? d.dann : d.sonst;
  }
  if (q.typ === 'auswahl' && q.optionen && !q.optionen.some(o => o.id === s)) return q.optionen[0].id;
  return s === undefined ? '' : s;
}

/** Wert als Eingabetext (wie man ihn tippen würde). */
export function asRaw(q, v) {
  return Array.isArray(v) ? v.join(q.key === 'reisenamen' ? '; ' : ', ') : typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v === undefined || v === null ? '' : v);
}

/**
 * Wertet eine Eingabe aus: leer = Standard (wie Enter im Terminal).
 * Gibt { value, usedDefault, warn?, info?, error? } zurück. opts.leerIstStandard=false: leere Eingabe wird geprüft statt ersetzt.
 */
export function resolveAnswer(q, raw, a, ctx, prev, opts = {}) {
  const text = String(raw === undefined || raw === null ? '' : raw).trim();
  const def = defaultFor(q, a, ctx, prev);
  if (!text && opts.leerIstStandard !== false) {
    if (q.pflicht && (def === '' || def === undefined)) return { error: 'Das brauche ich noch, bitte eintippen.' };
    const res = q.typ === 'auswahl' || q.typ === 'mehrfach' || q.typ === 'jaNein' ? { value: def } : parseAnswer(q, asRaw(q, def), a, ctx);
    return Object.assign({ usedDefault: true }, res);
  }
  return Object.assign({ usedDefault: false }, parseAnswer(q, text, a, ctx));
}

/** Anzeigetext einer Antwort (für Zusammenfassung und Vorgaben). */
export function displayValue(q, v) {
  if (q.typ === 'jaNein') return v ? (q.anzeigeJa || 'ja') : (q.anzeigeNein || 'nein');
  if (q.typ === 'auswahl') { const o = (q.optionen || []).find(x => x.id === v); return o ? o.label : String(v); }
  if (q.typ === 'mehrfach') return Array.isArray(v) && v.length ? v.map(x => { const o = (q.optionen || []).find(y => y.id === x); return o ? o.label : x; }).join(', ') : (q.anzeigeLeer || 'keine');
  if (q.typ === 'liste') return Array.isArray(v) && v.length ? v.join('; ') : (q.anzeigeLeer || '');
  if (q.typ === 'sprache') return v;
  return v === '' || v === undefined || v === null ? (q.anzeigeLeer || '') : String(v);
}

// ───────────────────────────── Abgeleitete Werte ─────────────────────────────

export const lizenzText = (ctx, a) => optionOf(ctx, 'lizenz', a.lizenz).text;
export const shareOf = (ctx, a) => (optionOf(ctx, 'anschauung', a.anschauung) || optionOf(ctx, 'anschauung', 'viel')).anteil;
export const buildCmd = a => `node tools/build.mjs ${a.id} ${a.skinWahl ? '--skins=all' : `--skins=${a.skin}`}`;
export const checkCmd = a => `${a.materialHost ? `MATERIAL_HOST=${a.materialHost} ` : ''}node tools/check-pack.mjs ${a.id}`;
/** Antwort auf „Spielplan“; alte Konfigurationen ohne das Feld gelten als „später“. */
export const spielplanOf = a => a.spielplan || 'spaeter';
/** Schaltet pack.json den Freien Zugang als Vorbelegung ein (nur bei Spielplan „ja“ und Zugang „frei“)? */
export const spielFreiVorbelegt = a => spielplanOf(a) === 'ja' && a.zugang === 'frei';
export const groesseRichtwert = (ctx, a) => (optionOf(ctx, 'groesse', a.groesse) || { richtwert: '' }).richtwert;

/** Unverbindlicher Hinweis aus alten Konfigurationen (a.altHinweis = { reisen, stationenJeReise, historisch }), sonst ''. */
export function altHinweisText(a) {
  const h = a.altHinweis;
  if (!h) return '';
  const parts = [];
  if (h.reisen) parts.push(`etwa ${h.reisen} Reisen`);
  if (h.stationenJeReise) parts.push(`etwa ${h.stationenJeReise} Stationen je Reise`);
  if (h.historisch) parts.push(`${h.historisch} historische Reise${h.historisch === 1 ? '' : 'n'}`);
  return parts.join(', ');
}

// ───────────────────────────── Zusammenfassung ─────────────────────────────

export function summaryRows(a, d, ctx) {
  const Q = ctx.byKey, star = k => d.has(k) ? ' (Standard)' : '';
  const disp = k => displayValue(Q[k], a[k]);
  const rows = [
    ['Museum', `${a.name}  (ID: ${a.id})`],
    ['Untertitel', a.untertitel + star('untertitel')],
    ['Thema', disp('thema')],
    ['Zielgruppe', disp('zielgruppe') + star('zielgruppe')],
    ['Sprache, Anrede', `${langName(ctx, a.sprache)}, ${a.anrede}`],
    ['Geschichte', disp('geschichte') + star('geschichte')],
    ['Größenordnung', disp('groesse') + (a.groesse === 'agent' ? '' : ` (${groesseRichtwert(ctx, a)})`) + star('groesse')],
    ['Reisenamen', disp('reisenamen')],
    ['Look', `${disp('skin')}${a.skinWahl ? ', Umschaltung für Besucher' : ', ohne Umschaltung'}`],
    ['Anschauung', `${disp('anschauung')} (etwa ${Math.round(shareOf(ctx, a) * 100)} % der Stationen mit Abbildung oder Exponat)`],
    ['Heikle Themen', disp('heikel')],
    ['Quellen', disp('quellen') + (a.materialHost ? ` (${a.materialHost})` : '')],
    ['Spielplan', disp('spielplan') + star('spielplan') + (a.spielplan === 'ja' ? `; Zugang: ${disp('zugang')}${star('zugang')}` : '')],
    ['Lizenz, Credits', `${lizenzText(ctx, a)}; ${a.urheber || 'keine Urheberangabe'}`],
    ['Impressum', a.impressumUrl || 'kein Link']
  ];
  const alt = altHinweisText(a);
  if (alt) rows.splice(7, 0, ['Hinweis (alt)', `${alt}; nur ein unverbindlicher Hinweis, der Agent entscheidet`]);
  return rows;
}

// ───────────────────────────── Briefing ─────────────────────────────

export function briefingJson(a, d, ctx) {
  const o = {
    _hinweis: 'Maschinenlesbarer Auftrag, erzeugt vom Museum-Studio-Onboarding (Terminal: tools/onboarding.mjs, Browser: onboarding.html). Dieselben Felder verträgt `node tools/onboarding.mjs --config=<datei>`. Lesbare Fassung: BRIEFING.md.',
    schema: 2, erstellt: ctx.today, werkzeug: 'tools/onboarding.mjs',
    name: a.name, id: a.id, untertitel: a.untertitel, thema: a.thema, zielgruppe: a.zielgruppe, sprache: a.sprache, anrede: a.anrede,
    geschichte: a.geschichte, groesse: a.groesse, reisenamen: a.reisenamen,
    skin: a.skin, skinWahl: a.skinWahl, anschauung: a.anschauung, heikel: a.heikel, quellen: a.quellen, materialHost: a.materialHost || '',
    spielplan: a.spielplan || 'spaeter', zugang: a.spielplan === 'ja' ? a.zugang || '' : '',
    urheber: a.urheber, lizenz: a.lizenz, impressumUrl: a.impressumUrl
  };
  if (a.altHinweis) { if (a.altHinweis.reisen) o.reisen = a.altHinweis.reisen; if (a.altHinweis.stationenJeReise) o.stationenJeReise = a.altHinweis.stationenJeReise; }
  o.abgeleitet = { anschauungMindestanteil: shareOf(ctx, a), baubefehl: buildCmd(a), pruefbefehl: checkCmd(a) };
  o.standardUebernommen = [...d];
  return JSON.stringify(o, null, 2) + '\n';
}

export function briefingMd(a, d, ctx) {
  const L = [];
  const ja = k => d.has(k) ? ' *(Standardwert, nicht ausdrücklich gewählt)*' : '';
  const Q = ctx.byKey;
  const sens = a.heikel.map(x => optionOf(ctx, 'heikel', x));
  const aud = optionOf(ctx, 'zielgruppe', a.zielgruppe);
  const skin = ctx.skins.find(x => x.id === a.skin);
  const gesch = optionOf(ctx, 'geschichte', a.geschichte);
  const rw = groesseRichtwert(ctx, a);
  const alt = altHinweisText(a);

  L.push(`# Auftrag: ${a.name} (\`packs/${a.id}\`)`, '');
  L.push(`Dieser Auftrag entstand am ${ctx.today} im Onboarding (Terminal: \`node tools/onboarding.mjs\`, Browser: \`onboarding.html\`). Er ersetzt **Schritt 0** von \`docs/AGENTEN.md\` (Rahmen klären): Die Fragen sind beantwortet, bitte nicht erneut stellen, sondern abarbeiten. Maschinenlesbar: \`BRIEFING.json\`.`);
  L.push(`Was als *Standardwert* gekennzeichnet ist, hat der Auftraggeber nicht ausdrücklich entschieden; halte es in \`ARBEITSSTAND.md\` als Annahme fest. Fehlt etwas ganz, entscheide vorsichtig und trage es als Annahme ein.`);
  L.push(`Gibt es \`packs/${a.id}/\` noch nicht, lege es an: \`BRIEFING.json\` im Repository-Stamm speichern und \`node tools/onboarding.mjs --config=BRIEFING.json --yes\` ausführen (legt das Paket mit **leerem Plan** an). Ohne Werkzeuge: \`docs/ONBOARDING.md\`, Abschnitt „Ohne Werkzeuge“.`, '');

  L.push('## Thema', '');
  L.push(`- **Name:** ${a.name}  (ID \`${a.id}\`)${a.name.length > 24 ? `  *Achtung: ${a.name.length} Zeichen, Richtwert 24; nicht verlängern.*` : ''}`);
  L.push(`- **Untertitel / Leitfrage:** ${a.untertitel}${ja('untertitel')}`);
  L.push(`- **Thema:** ${a.thema || '*(nicht angegeben: leite es aus Namen und Untertitel ab und halte es als Annahme fest)*'}`);
  L.push('- In `pack.json` sind `title`, `eyebrow`, `tagline` vorbefüllt; `eyebrow` darfst du schärfen.', '');

  L.push('## Zielgruppe, Sprache, Ton', '');
  L.push(`- **Zielgruppe:** ${aud.ton}${ja('zielgruppe')}`);
  L.push(`- **Sprache der Inhalte:** ${langName(ctx, a.sprache)} (\`${a.sprache}\`)${ja('sprache')}.${a.sprache === 'de' ? '' : ' Die festen Oberflächentexte der Engine bleiben deutsch (bekannte Grenze); übersetze den Wortschatz `vocab` in `pack.json` und trage Engine-Wünsche in `docs/ENGINE-WUENSCHE.md` ein.'}`);
  L.push(`- **Anrede:** ${a.anrede}${ja('anrede')}. Durchgehend, auch in Intro, Outro, Teasern, Fuß. Ton: warm, klar, neugierig; kein Belehren.`, '');

  L.push('## Umfang und Aufbau', '');
  L.push('- **Die Zahlen entscheidest du**, fachlich nach Thema und Zielgruppe (`docs/AGENTEN.md`, Schritt 1 und 2). Der Auftraggeber hat bewusst keine Anzahl von Reisen oder Stationen vorgegeben. Leitplanken des Frameworks: bis zu 16 Reisen (lieber wenige gute als viele dünne), je Reise 11 bis 28 Stationen, insgesamt höchstens rund 200 eindeutige Stationen; Kreuzungen müssen echt sein.');
  L.push(`- **Größenordnung (Wunsch, unverbindlich):** ${a.groesse === 'agent' ? 'keiner, der Agent entscheidet' : `${optionOf(ctx, 'groesse', a.groesse).label}, als Richtwert ${rw}`}${ja('groesse')}.`);
  L.push(`- **Geschichte als eigene Reise:** ${gesch.label}${ja('geschichte')}. ${gesch.regel}`);
  if (alt) L.push(`- **Hinweis aus einer älteren Konfiguration** (unverbindlich, nur als Anhaltspunkt): ${alt}.`);
  L.push('- **Freigabe vor dem Schreiben:** Zeige dem Auftraggeber zuerst den **Plan** (Reisen mit Leitfrage und Tagline, Stationen je Reise, Kreuzungen, geplante Anschauung, jeweils mit kurzer fachlicher Begründung) und schreibe erst Texte, wenn er ihn freigegeben hat. Antwortet niemand (autonomer Lauf), halte den Plan als Annahme in `ARBEITSSTAND.md` fest und arbeite weiter.');
  L.push('- **Gerüst:** Das Onboarding legt keine Stub-Reisen an. `plan.json` ist leer (`journeys:[]`, `stations:[]`, `orders:{}`), `check-pack` meldet „Plan noch leer“, bis du Schritt 1 und 2 erledigt hast. `limits` in `pack.json` stehen auf den Standardwerten (je Reise 11 bis 28 Stationen).', '');

  L.push('## Reisen', '');
  if (a.reisenamen.length) {
    L.push('Themenideen des Auftraggebers (Reihenfolge = Wunsch, nicht Pflicht):', '');
    a.reisenamen.forEach((n, i) => L.push(`${i + 1}. ${n}`));
    L.push('', 'Die Namen sind Ideen, keine fertigen Titel: Eine Reise ist eine Frage oder ein Weg mit Versprechen (AGENTEN.md, Schritt 1). Übernimm, formuliere um oder ergänze sie nach fachlichem Urteil und halte fest, was du geändert hast.');
  } else L.push('Keine Vorgaben: **mache Vorschläge** für die Reisen (jede als Frage oder Weg, mit Tagline) und lege sie im Plan zur Freigabe vor.');
  L.push('');

  L.push('## Sorgfaltsregeln', '');
  L.push(`- **Heikle Themen:** ${sens.length ? sens.map(o => o.label + (o.beschreibung ? ` (${o.beschreibung})` : '')).join('; ') : 'keine genannt'}${ja('heikel')}.`);
  L.push('- Immer: Fakten belegbar halten (Zahlen, Jahre, Zitate nicht aus dem Gedächtnis), Zuschreibungen prüfen, Darstellung fair (AGENTEN.md, Regeln und „Typische Fehler“), Faktencheck in `FAKTENCHECK.md`. Nichts erfinden.');
  for (const o of sens) { L.push(`- **${o.label}:**`); o.sorgfalt.forEach(x => L.push(`  - ${x}`)); }
  L.push(`- **Hinweistext im Fuß** (\`pack.json\` \`footer\`): ${a.heikel.length ? 'aus den heiklen Themen ableiten' : 'Standardhinweis (Bildung statt Beratung)'}; vor der Veröffentlichung gegenlesen. Das Onboarding-Werkzeug bereitet ihn vor.`, '');

  L.push('## Quellen', '');
  if (a.quellen.includes('offen')) L.push('- Nur offene, frei zugängliche Quellen und eigene Formulierungen; nichts Fremdes kopieren, Weiterlesen-Hinweise nur auf real existierende Werke.');
  if (a.quellen.includes('eigene')) L.push('- Grundlage sind die **eigenen Texte des Auftraggebers** (liegen vor oder werden geliefert). Nichts darüber hinaus hinzuerfinden; Lücken als Frage in `ARBEITSSTAND.md` („Offen“) stellen, nicht stillschweigend füllen; Rechte-Angaben respektieren.');
  if (a.quellen.includes('domain')) L.push(`- Weiterlesen-Links (\`blog\`, \`material.js\`) nur auf **${a.materialHost}**. Prüfen mit \`MATERIAL_HOST=${a.materialHost} node tools/check-pack.mjs ${a.id}\`. Erlaubte Links zusätzlich in \`quellen.txt\` (eine URL je Zeile).`);
  L.push('- Link-Regeln: nur geprüfte, öffentliche https-Links, Titel plus Link, nichts hineinkopieren (AGENTEN.md, Schritt 0).', '');

  L.push('## Look und Bau', '');
  L.push(`- **Standard-Look:** ${skin ? `${skin.name}: ${String(skin.description || '').replace(/[.\s]+$/, '')}` : a.skin}${ja('skin')}.`);
  L.push(`- **Umschaltung für Besucher:** ${a.skinWahl ? 'ja, alle Looks einbinden' : 'nein, nur der gewählte'}. Bau: \`${buildCmd(a)}\`.`);
  L.push(`- **Anschauung: ${optionOf(ctx, 'anschauung', a.anschauung).label}** (etwa ${Math.round(shareOf(ctx, a) * 100)} % der Stationen)${ja('anschauung')}. Rechne nach dem Plan die **Mindestzahl** aus (Anteil mal Zahl eindeutiger Stationen, aufgerundet): so viele Stationen brauchen eine Abbildung oder ein Exponat (\`pack.json\` \`limits.visualShare\` = ${shareOf(ctx, a)}, \`requireVisualPlan\`: true). Jede Station bekommt in \`plan.json\` ein Feld \`visual\` (abbildung | exponat | keine mit Begründung); \`docs/AGENTEN.md\`, Schritt 2b „Anschauung planen“, und der Baukasten \`MUSEUM.viz\` (Muster: \`packs/_vorlage/visuals/\`). Je abstrakter eine Station, desto eher gehört eine Abbildung dazu.`, '');

  L.push('## Spielplan', '');
  const spOpt = optionOf(ctx, 'spielplan', spielplanOf(a));
  L.push(`- **Entscheidung:** ${spOpt.label}${ja('spielplan')}. ${spOpt.regel}`);
  if (spielplanOf(a) === 'ja') {
    const zg = optionOf(ctx, 'zugang', a.zugang);
    L.push(`- ${zg.regel}${ja('zugang')}`);
    L.push('- **Maßstab: ein Spiel, kein Dashboard.** Es braucht eine **Geschichte** (Auftakt und Abschluss je Reise), den **Moment** des Freischaltens (etwas geht dort auf, wo man gerade handelt), **Rhythmus** (Wiedersehen nach Abständen, keine Serien, die reißen) und **Rückmeldung am Ort**. Kein Reiter mit Statistik, keine Punkte. Immer: Freier Zugang als Schalter, Pausen kosten nichts, genau **eine** nächste Aufgabe als Vorschlag, nie eine Pflicht.');
    L.push('- **So gehst du vor** (nach der Freigabe des Plans und nach den Stationstexten, vor dem Rauchtest; Befehle und Fehlersuche in `docs/SPIELPLAN.md`):');
    L.push(`  1. \`node tools/spielplan-aus-plan.mjs ${a.id} --auto\` erzeugt einen spielbaren Standard in \`packs/${a.id}/spielplan.json\` (Gebiete, Etappen, ein Drittel der Reisen offen, mindestens zwei Wege je gesperrter Reise).`);
    L.push(`  2. Danach die **kuratierte Schicht** in \`packs/${a.id}/spielplan-kern.yaml\` (Vorlage: \`docs/spielplan-vorlage-kern.yaml\`): Auftakt und Abschluss im Ton des Museums, **„Ich kann …“-Sätze** (Fähigkeiten), Gewichte, Enthüllungstexte, \`offen: [...]\`. Die Sätze nicht erfinden: aus anerkannten Kompetenzbeschreibungen oder den Texten des Auftraggebers ableiten, sonst weglassen und in \`ARBEITSSTAND.md\` als Annahme vermerken.`);
    L.push(`  3. \`node tools/check-spielplan.mjs ${a.id} --streng --bericht --wege\` und \`node tools/check-pack.mjs ${a.id}\`; bauen und im Browser ausprobieren (Zeitreise-Hook, Zurücksetzen: \`docs/SPIELPLAN.md\`).`);
    L.push('- Ohne Befehle (reiner Chat): Beschreibe den Spielplan (Gebiete, Etappen, „Ich kann …“-Sätze, Zugang) nur als Vorschlag im Plan und lass die Umsetzung für später vormerken.');
  }
  L.push('');

  L.push('## Lizenz, Credits, Rechtliches', '');
  L.push(`- **Lizenz der Inhalte:** ${lizenzText(ctx, a)}${ja('lizenz')} (in \`pack.json\` \`license\` eingetragen; der Code von Museum Studio bleibt MIT). Es gelten nur freie Lizenzen; füge keine Inhalte mit unfreier Lizenz ein.`);
  L.push(`- **Credits:** ${a.urheber || 'keine Angabe (nur „Erstellt mit Museum Studio“)'}.`);
  L.push(`- **Impressum/Datenschutz:** ${a.impressumUrl ? a.impressumUrl + ' (im Fuß verlinkt)' : 'kein Link angegeben (vor einer öffentlichen Veröffentlichung klären; in Deutschland ist ein Impressum Pflicht). Erfinde kein Impressum und keine Anschrift.'}`, '');

  L.push('## Was der Agent liefern soll', '');
  L.push('Arbeite `docs/AGENTEN.md` ab Schritt 1 ab (Schritt 0 ist durch diesen Auftrag erledigt) und committe nach jedem Schritt.', '');
  [
    'Plan (Schritt 1 und 2): Reisen mit Namen, Tagline, Intro, Outro, Icon, Farben in `journeys.js`; Stationen, Kreuzungen und Reihenfolgen in `plan.json` (Netz zusammenhängend, Umfang nach Thema und Zielgruppe entschieden und begründet); `node tools/check-plan.mjs ' + a.id + '` grün',
    '**Plan dem Auftraggeber zur Freigabe zeigen, bevor Stationstexte entstehen** (oder, wenn niemand antwortet, als Annahme in `ARBEITSSTAND.md` festhalten)',
    'Stationstexte in `stationen/*.js` (90 bis 200 Wörter, Teaser, Fakten, `cross` je andere Reise; `node tools/check-data.mjs ' + a.id + ' <datei>` je Datei grün)',
    'Anschauung geplant (`visual` bei JEDER Station in `plan.json`) und gebaut: Mindestzahl siehe oben, sonst bewusst verschoben und in `ARBEITSSTAND.md` dokumentiert; `check-pack` zeigt „Anschauung: X geplant, Y gebaut“',
    '`pack.json` geprüft: alle Platzhalter weg, Fußhinweise passen zum Inhalt' + (a.sprache === 'de' ? '' : ', Wortschatz `vocab` übersetzt'),
    ...(a.heikel.length ? ['Sorgfaltsregeln zu den heiklen Themen eingehalten und im Abschlussbericht ausdrücklich bestätigt (welche Positionen/Aspekte fehlen bewusst?)'] : []),
    'Faktencheck durchgeführt und in `FAKTENCHECK.md` festgehalten (Stufe je Reise ehrlich angeben: unabhängig, Selbstprüfung, Gedächtnis)',
    ...(spielplanOf(a) === 'ja' ? [`Spielplan eingerichtet (Schritt 6b; Zugang: ${optionOf(ctx, 'zugang', a.zugang).label}): \`packs/${a.id}/spielplan.json\` erzeugt, „Ich kann …“-Sätze nur aus belegbaren Quellen, \`node tools/check-spielplan.mjs ${a.id} --streng\` grün, im Browser ausprobiert (Freier Zugang an und aus), Geschichte, Moment, Rhythmus und Rückmeldung am Ort im Abschlussbericht benannt`] : []),
    `Layout berechnet: \`node tools/layout-map.mjs ${a.id}\``,
    `Gesamtprüfung grün: \`${checkCmd(a)}\``,
    `Gebaut: \`${buildCmd(a)}\` (Ergebnis in \`dist/${a.id}/index.html\`); wenn Playwright vorhanden ist: \`npm run smoke -- ${a.id} --quick\``,
    '`ARBEITSSTAND.md` aktuell (Rahmen, Annahmen mit „Bestätigt: offen“, Entscheidungen, Fortschritt, Offenes, bekannte Schwächen)',
    'Abschlussbericht: was steht, was ist geprüft, welche Annahmen den Inhalt stark lenken, was bewusst fehlt'
  ].forEach(x => L.push(`- [ ] ${x}`));
  L.push('');
  return L.join('\n');
}

/** Fertiger Prompt für jede KI: enthält das Briefing direkt und sagt, wie es weitergeht. */
export function promptText(a, md, json) {
  return [
    `Ich möchte mit dem freien Framework „Museum Studio“ (https://github.com/alphakaefer/museum-studio, Code MIT, Beispielinhalte CC BY 4.0) ein neues Museum bauen: ein vernetztes Wissensgebiet als begehbares Museum aus Reisen und Stationen. Unten steht mein fertiger Auftrag (Briefing) mit allen Rahmenentscheidungen. Bitte stelle diese Fragen nicht noch einmal, sondern arbeite den Auftrag ab.`,
    '',
    'So machst du weiter:',
    '',
    `1. Wenn du Zugriff auf das Repository hast (Dateien und Terminal, zum Beispiel Claude Code, Codex, Gemini CLI, Copilot, Cursor): Lies AGENTS.md und docs/AGENTEN.md im Repository. Speichere die JSON-Antworten unten als BRIEFING.json im Repository-Stamm und lege das Paket an: node tools/onboarding.mjs --config=BRIEFING.json --yes. Arbeite danach docs/AGENTEN.md ab Schritt 1 ab. Zeige mir den Plan (Reisen, Stationen, Kreuzungen, Anschauung) zur Freigabe, bevor du Stationstexte schreibst.`,
    '',
    `2. Wenn du nur chatten kannst (kein Zugriff auf Dateien oder Terminal): Plane ein Museumspaket nach den Museum-Studio-Regeln. Reisen sind Fragen oder Wege, Stationen sind kleine Lektionen (90 bis 200 Wörter), dieselbe Station darf auf mehreren Reisen liegen (Kreuzungen, jede mit einem begründenden Satz). Beginne mit einem Plan (Reisen mit Leitfrage, Stationen je Reise, Kreuzungen, geplante Anschauung) und warte auf meine Freigabe. Danach liefere die Dateien packs/${a.id}/pack.json, plan.json, journeys.js und stationen/*.js jeweils als eigenen Codeblock mit dem Zielpfad darüber. Wenn du Internet hast, lies vorher https://github.com/alphakaefer/museum-studio (README.md, AGENTS.md, docs/AGENTEN.md, docs/INHALT-SCHREIBEN.md).`,
    '',
    'Regeln für beide Fälle: Nichts erfinden (keine Personen, Jahre, Zahlen, Zitate, Links; Unsicheres weglassen oder kennzeichnen). Engine und Skins nicht verändern. Nur freie Lizenzen. Kein Impressum und keine Anschrift erfinden. Mehrere Positionen fair darstellen. Kleine Schritte, Annahmen offen benennen.',
    '',
    '=== BEGINN DES AUFTRAGS (BRIEFING.md) ===',
    '',
    md.trimEnd(),
    '',
    '=== ENDE DES AUFTRAGS ===',
    '',
    '=== ANTWORTEN ALS JSON (BRIEFING.json) ===',
    '',
    '```json',
    json.trimEnd(),
    '```'
  ].join('\n') + '\n';
}

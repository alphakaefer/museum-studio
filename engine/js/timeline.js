/* ==========================================================================
   Museum Studio – js/timeline.js
   Ansicht "Zeitstrahl": die historischen Reisen (datengetrieben, derzeit vier) als farbige Bahnen übereinander.

   MUSEUM.views.zeitstrahl = { mount(el), show(), hide(), focusStation(id), highlightJourney(id|null) }

   Aufbau
   - Bahnen: alle Reisen mit typ "historisch"; ihre Reihenfolge wird so gewählt, dass Stationen auf mehreren
     Bahnen möglichst benachbarte Bahnen verbinden (kleinste Gesamtspanne aller Verbindungen).
   - Nichtlineare, stückweise Zeitachse (ca. 1700 v. Chr. bis heute). Epochen mit vielen Ereignissen sind
     gedehnt (vor allem das 20. Jahrhundert), die lange Stille von Antike und Mittelalter ist gestaucht. Epochen-Bänder mit Namen, Maßstabsbrüche
     und Jahreslineal sind sichtbar markiert.
   - Stationen sitzen an ihrem Jahr (station.year). Liegen mehrere nahe beieinander, werden die Knoten
     minimal auseinandergeschoben; ein kleiner Strich auf der Bahn zeigt dann das echte Jahr.
   - Liegt eine Station auf mehreren historischen Reisen, verbindet eine senkrechte Linie die Bahnen.
   - Kreuzungen zu funktionalen Reisen: kleine farbige Punkte am Knoten (Klick = Umstieg).
   - Mythen sind als Irrtum markiert: gestrichelter Rand, schraffierte Füllung, Stempel „überholt“.
   - Beschriftungen werden zoomabhängig kollisionsfrei oben/unten an den Bahnen verteilt.
   - Bedienung: Ziehen, Strg + Mausrad / Trackpad-Pinch / Zwei-Finger-Pinch, Knöpfe, Tastatur
     (Pfeile zwischen Stationen, + und − zoomen, Eingabe öffnet), Bahn-Filter, Sprungleiste mit Epochen.
   - Hover-Vorschau am Mauszeiger, Bottom-Sheet-Vorschau bei Touch.
   - „Als Liste“: chronologische, barrierefreie Alternative mit denselben Stationen.
   Alle Klassen tragen das Präfix gm-zeit-. Farben nur über die Design-Tokens aus css/museum.css.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  M.views = M.views || {};
  var doc = document;

  /* ------------------------------------------------------------------ *
   * Konstanten: Bahnen, Zeitachse, Epochen
   * ------------------------------------------------------------------ */

  var HIST = [];   // Bahnen: Reisen vom Typ 'historisch', aus den Reisedaten (refreshHist)
  var YMIN = -1700;
  var YMAX = 2027;
  var NOW = 2025;
  var GAP_PX = 340;        // ab dieser Lücke zwischen zwei Stationen wird die Bahn gepunktet
  var ZMIN = 0.05;
  var ZMAX = 3.6;

  // Stückweise Skala: d = Pixel pro Jahr bei Zoom 1. Antike und Mittelalter sind gestaucht,
  // das 20. Jahrhundert (Psychoanalyse, Kognitive Wende, Systemtheorie, Neurowissenschaft) bekommt den meisten Platz.
  var FULL_SEGS = [
    { from: -1700, to: -600, d: 0.1 },
    { from: -600, to: -300, d: 1.5 },
    { from: -300, to: 500, d: 0.3 },
    { from: 500, to: 1500, d: 0.1 },
    { from: 1500, to: 1600, d: 1.3 },
    { from: 1600, to: 1700, d: 3.6 },
    { from: 1700, to: 1800, d: 2.0 },
    { from: 1800, to: 1900, d: 4.6 },
    { from: 1900, to: 1950, d: 12 },
    { from: 1950, to: 2000, d: 17 },
    { from: 2000, to: YMAX, d: 9 }
  ];
  var SEGS = [];
  function accumulate(segs) {
    var acc = 0;
    segs.forEach(function (s) { s.base = acc; acc += (s.to - s.from) * s.d; });
    segs.total = acc;
    return segs;
  }
  SEGS = accumulate(FULL_SEGS.map(function (s) { return { from: s.from, to: s.to, d: s.d }; }));

  var FULL_EPOCHS = [
    { id: 'antike', name: 'Antike', short: 'Antike', from: -1700, to: 500, range: 'bis 500 n. Chr.' },
    { id: 'mittelalter', name: 'Mittelalter', short: 'Mittelalter', from: 500, to: 1500, range: '500 bis 1500' },
    { id: 'neuzeit', name: 'Frühe Neuzeit & Aufklärung', short: 'Frühe Neuzeit', from: 1500, to: 1800, range: '1500 bis 1800' },
    { id: 'j19', name: '19. Jahrhundert', short: '19. Jh.', from: 1800, to: 1900, range: '1800 bis 1900' },
    { id: 'j20a', name: '20. Jahrhundert, 1. Hälfte', short: '1900–1950', from: 1900, to: 1950, range: '1900 bis 1950' },
    { id: 'j20b', name: '20. Jahrhundert, 2. Hälfte', short: '1950–2000', from: 1950, to: 2000, range: '1950 bis 2000' },
    { id: 'heute', name: 'Gegenwart', short: 'ab 2000', from: 2000, to: YMAX, range: 'seit 2000' }
  ];
  var EPOCHS = FULL_EPOCHS.map(function (e) { return Object.assign({}, e); });
  var ABS_MIN = YMIN, ABS_MAX = YMAX;
  var MIN_TOTAL = 1800;    // Mindestbreite der Achse (Basiseinheiten bei Zoom 1); schmale Zeiträume werden gedehnt

  // Zeitachse aus den Jahren der historischen Reisen des Pakets: sichtbarer Bereich mit Puffer, Skala und Epochen
  // daraus abgeleitet. Umfasst das Paket (fast) die ganze Geschichte, bleibt die Standardachse unverändert.
  function setupAxis(items) {
    var lo = Infinity, hi = -Infinity;
    items.forEach(function (it) {
      lo = Math.min(lo, it.year); hi = Math.max(hi, it.year);
      if (it.span) { lo = Math.min(lo, it.span.from); hi = Math.max(hi, it.span.to); }
    });
    if (!isFinite(lo) || !isFinite(hi)) { lo = ABS_MIN; hi = ABS_MAX; }
    var pad = Math.max(12, Math.round((hi - lo) * 0.06));
    var a = clamp(Math.floor((lo - pad) / 10) * 10, ABS_MIN, ABS_MAX - 20);
    var b = clamp(Math.ceil((hi + pad) / 10) * 10, a + 20, ABS_MAX);
    if (ABS_MAX - b <= 10) b = ABS_MAX;
    var segs = [];
    FULL_SEGS.forEach(function (s) {
      var f = Math.max(s.from, a), t = Math.min(s.to, b);
      if (t > f) segs.push({ from: f, to: t, d: s.d });
    });
    accumulate(segs);
    if (segs.total < MIN_TOTAL) {
      var k = MIN_TOTAL / segs.total;
      segs.forEach(function (s) { s.d *= k; });
      accumulate(segs);
    }
    var has = function (e) { return items.some(function (it) { return it.year >= e.from && it.year < e.to || (e.to >= ABS_MAX && it.year >= e.from); }); };
    var eps = FULL_EPOCHS.filter(function (e) { return e.to > a && e.from < b; }).map(function (e) { return Object.assign({}, e); });
    // leere Epochen am Rand weglassen (Namen nur dort, wo Stationen liegen); Lücken in der Mitte bleiben sichtbar
    while (eps.length > 1 && !has(eps[0])) eps.shift();
    while (eps.length > 1 && !has(eps[eps.length - 1])) eps.pop();
    eps[0].from = a; eps[eps.length - 1].to = b;
    YMIN = a; YMAX = b;
    SEGS = segs;
    EPOCHS = eps;
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function r1(n) { return Math.round(n * 10) / 10; }

  // Jahr -> Basiseinheiten (Zoom 1) und zurück
  function uOf(y) {
    y = clamp(y, YMIN, YMAX);
    for (var i = 0; i < SEGS.length; i++) {
      var s = SEGS[i];
      if (y <= s.to || i === SEGS.length - 1) return s.base + (y - s.from) * s.d;
    }
    return 0;
  }
  function yOfU(v) {
    v = clamp(v, 0, SEGS.total);
    for (var i = 0; i < SEGS.length; i++) {
      var s = SEGS[i];
      if (v <= s.base + (s.to - s.from) * s.d || i === SEGS.length - 1) return s.from + (v - s.base) / s.d;
    }
    return YMIN;
  }
  function epochOfYear(y) {
    for (var i = 0; i < EPOCHS.length; i++) if (y < EPOCHS[i].to) return EPOCHS[i];
    return EPOCHS[EPOCHS.length - 1];
  }

  /* ------------------------------------------------------------------ *
   * Kleine Helfer
   * ------------------------------------------------------------------ */

  var el = M.el || function (tag, attrs) {
    var n = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'on') Object.keys(v).forEach(function (e) { n.addEventListener(e, v[e]); });
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { if (p.indexOf('--') === 0) n.style.setProperty(p, v[p]); else n.style[p] = v[p]; });
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      (Array.isArray(c) ? c : [c]).forEach(function (x) { n.appendChild(x && x.nodeType ? x : doc.createTextNode(String(x))); });
    }
    return n;
  };
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ico(key, size) { return (M.icons && M.icons.svg) ? M.icons.svg(key, { size: size || 18 }) : ''; }
  function reduced() { return M.reducedMotion ? M.reducedMotion() : false; }
  function announce(t) { if (M.announce) M.announce(t); }
  function isHist(id) { return HIST.indexOf(id) >= 0; }
  // Farbe einer Reise; fehlt das Token, fällt sie auf den Akzent zurück
  function jv(id) { return 'var(--j-' + id + ',var(--accent))'; }
  function journey(id) {
    var j = M.data && M.data.journeyById && M.data.journeyById[id];
    if (j) return j;
    return { id: id, name: id, kurz: id, icon: 'train' };
  }
  function isCoarse() {
    try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; }
  }

  var mctx = null;
  var mcache = {};
  function textW(str, font) {
    var key = font + '|' + str;
    if (mcache[key] !== undefined) return mcache[key];
    if (mctx === null) {
      try { mctx = doc.createElement('canvas').getContext('2d') || false; } catch (e) { mctx = false; }
    }
    var w;
    if (!mctx) w = String(str).length * 7.2;
    else { mctx.font = font; w = mctx.measureText(str).width; }
    mcache[key] = w;
    return w;
  }

  // Echte Textbreiten aus dem DOM (Jahreszeile samt Stempel, Titel), einmal je Schrift-/Größenstand
  function measureLabels() {
    var key = '';
    try {
      var cs = getComputedStyle(doc.documentElement);
      key = cs.fontSize + '|' + (S.fontDisplay || '') + '|' + (S.fontUI || '');
    } catch (e) { key = 'x'; }
    if (S.mkey === key && S.measured) return;
    var box = el('div', { class: 'gm-zeit', 'aria-hidden': 'true', style: { position: 'absolute', left: '0', top: '0', visibility: 'hidden', pointerEvents: 'none', width: 'auto', margin: '0', height: '0', overflow: 'hidden' } });
    var rows = S.items.map(function (it) {
      var ly = el('span', { class: 'gm-zeit-ly', style: { width: 'max-content' } }, el('span', null, it.yearShort), it.myth ? el('span', { class: 'gm-zeit-stamp' }, 'überholt') : null);
      var lt = el('span', { class: 'gm-zeit-lt', style: { display: 'inline-block', maxWidth: 'none', width: 'max-content' } }, it.title);
      var w = el('div', { style: { position: 'absolute', left: '0', top: '0' } }, ly, el('br'), lt);
      box.appendChild(w);
      return { it: it, ly: ly, lt: lt };
    });
    S.root.appendChild(box);
    var ok = false;
    rows.forEach(function (r) {
      var yw = r.ly.getBoundingClientRect().width, tw = r.lt.getBoundingClientRect().width;
      if (yw > 0 && tw > 0) { ok = true; r.it.mYW = yw; r.it.mTW = tw; }
    });
    if (box.parentNode) box.parentNode.removeChild(box);
    S.measured = ok;
    S.mkey = ok ? key : '';
  }

  function yearShort(st) {
    var y = st.year, lbl = String(st.yearLabel || '');
    var pre = '';
    if (/^um\b/i.test(lbl)) pre = 'um ';
    else if (/ca\./.test(lbl.slice(0, 8))) pre = 'ca. ';
    else if (/^ab\b/i.test(lbl)) pre = 'ab ';
    var core = y < 0 ? Math.abs(y) + ' v. Chr.' : (y < 1000 ? y + ' n. Chr.' : String(y));
    return pre + core;
  }
  function yearFull(st) {
    if (st.yearLabel) return String(st.yearLabel);
    return st.year < 0 ? Math.abs(st.year) + ' v. Chr.' : String(st.year);
  }
  function sentence(t) {
    t = String(t || '').replace(/\s+$/, '');
    return /[.!?…]$/.test(t) ? t : t + '.';
  }
  function mainTitle(t) {
    t = String(t || '');
    var i = t.indexOf(': ');
    return i > 2 ? t.slice(0, i) : t;
  }
  function parseSpan(st) {
    if (typeof st.yearEnd === 'number' && st.yearEnd - st.year >= 10) return { from: st.year, to: st.yearEnd };
    var lbl = String(st.yearLabel || '');
    var m = lbl.match(/(\d{3,4})\s*(?:bis|–|—|-)\s*(\d{3,4}|heute)/i);
    if (!m) return null;
    var bce = /v\.\s*Chr\./.test(lbl);
    var a = parseInt(m[1], 10);
    var b = /heute/i.test(m[2]) ? NOW : parseInt(m[2], 10);
    if (bce) { a = -a; if (!/heute/i.test(m[2])) b = -b; }
    if (b < a) { var t = a; a = b; b = t; }
    if (b - a < 10) return null;
    if (typeof st.year !== 'number' || st.year < a - 1 || st.year > b + 1) return null;
    return { from: a, to: b };
  }

  /* ------------------------------------------------------------------ *
   * Zustand
   * ------------------------------------------------------------------ */

  var S = {
    host: null, root: null, stage: null, canvas: null, svg: null, gutter: null, bands: null, lanesHost: null,
    frame: null, tip: null, sheet: null, listEl: null, countEl: null, hlBar: null, readout: null,
    jumpBtns: [], laneChips: {},
    lanes: [],
    items: [], byId: {}, insts: [], undated: [],
    zoom: 1, zoomSet: false, mode: 'strahl',
    built: false, visible: false, dirty: true, sig: '', introDone: false,
    active: null, hl: null, pendingFocus: null, lastPtr: 'mouse',
    m: null, geo: null, lastW: 0
  };

  /* ------------------------------------------------------------------ *
   * Daten einsammeln
   * ------------------------------------------------------------------ */

  function signature() {
    refreshHist();
    var D = M.data || {};
    var st = D.stations || {};
    var n = 0, h = 0;
    Object.keys(st).forEach(function (id) {
      var s = st[id];
      if (!s || typeof s.year !== 'number') return;
      var inHist = (s.journeys || []).some(isHist);
      if (inHist) { n++; h += s.year + id.length; }
    });
    return HIST.slice().sort().join('+') + ':' + n + ':' + h;
  }

  // Bahnen = alle Reisen vom Typ "historisch" (Reihenfolge der Reisedaten); ohne Daten die Vorgabe
  function refreshHist() {
    var D = M.data || {};
    var ids = (D.journeys || []).filter(function (j) { return j && j.typ === 'historisch' && !j.virtual; }).map(function (j) { return j.id; });
    HIST = ids;
  }

  // Bahnreihenfolge: so wählen, dass Stationen auf mehreren Bahnen möglichst benachbarte Bahnen verbinden.
  // Kosten = Summe der Spannen (äußerste minus innerste Bahn) aller Mehrbahn-Stationen; Gleichstand: die Bahn
  // mit der frühesten Station nach oben, dann die Reihenfolge der Reisedaten.
  function orderLanes(items) {
    var ids = HIST.slice();
    var n = ids.length;
    if (n < 3 || n > 7) return ids;
    var first = {};
    ids.forEach(function (id) { first[id] = 1e9; });
    var multis = [];
    items.forEach(function (it) {
      it.lanes.forEach(function (l) { if (it.year < first[l]) first[l] = it.year; });
      if (it.lanes.length > 1) multis.push(it.lanes);
    });
    var best = null, bestCost = 1e18;
    function cost(perm) {
      var pos = {};
      perm.forEach(function (id, i) { pos[id] = i; });
      var c = 0;
      multis.forEach(function (ls) {
        var lo = 1e9, hi = -1;
        ls.forEach(function (l) { var q = pos[l]; if (q < lo) lo = q; if (q > hi) hi = q; });
        c += (hi - lo) * (hi - lo);
      });
      return c;
    }
    function tie(perm) {   // kleiner ist besser
      return first[perm[0]] * 1000 + perm.reduce(function (a, id, i) { return a + Math.abs(ids.indexOf(id) - i); }, 0);
    }
    (function walk(rest, perm) {
      if (!rest.length) {
        var c = cost(perm);
        if (c < bestCost || (c === bestCost && tie(perm) < tie(best))) { bestCost = c; best = perm.slice(); }
        return;
      }
      for (var i = 0; i < rest.length; i++) {
        var nxt = rest.slice(); var x = nxt.splice(i, 1)[0];
        perm.push(x); walk(nxt, perm); perm.pop();
      }
    })(ids, []);
    return best || ids;
  }

  function syncLanes() {
    var old = {};
    S.lanes.forEach(function (l) { old[l.id] = l; });
    S.lanes = HIST.map(function (id) { return old[id] || { id: id, on: true }; });
  }

  function collect() {
    refreshHist();
    var D = M.data || {};
    var all = D.stations || {};
    var items = [];
    var undated = [];
    var seen = {};
    function consider(id) {
      if (seen[id]) return;
      var st = all[id];
      if (!st) return;
      var lanes = HIST.filter(function (j) { return (st.journeys || []).indexOf(j) >= 0; });
      if (!lanes.length) return;
      seen[id] = true;
      if (typeof st.year !== 'number' || isNaN(st.year)) { undated.push({ st: st, lanes: lanes }); return; }
      var func = (st.journeys || []).filter(function (j) { return !isHist(j) && D.journeyById && D.journeyById[j] && !D.journeyById[j].virtual; });
      items.push({
        id: id, st: st, year: st.year, lanes: lanes, func: func,
        myth: st.kind === 'mythos',
        title: mainTitle(st.title), yearShort: yearShort(st), yearFull: yearFull(st),
        span: parseSpan(st), ord: 0, x: 0, tx: 0
      });
    }
    HIST.forEach(function (jid) {
      ((D.orders && D.orders[jid]) || []).forEach(consider);
    });
    Object.keys(all).forEach(consider);
    items.sort(function (a, b) { return a.year - b.year || (a.id < b.id ? -1 : 1); });
    items.forEach(function (it, i) { it.ord = i; });
    setupAxis(items);
    HIST = orderLanes(items);
    items.forEach(function (it) { it.lanes.sort(function (a, b) { return HIST.indexOf(a) - HIST.indexOf(b); }); });
    syncLanes();
    S.items = items;
    S.undated = undated;
    S.byId = {};
    items.forEach(function (it) { S.byId[it.id] = it; });
  }

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  var CSS = [
    '.gm-zeit{--zeit-bg:var(--bg-2);position:relative;width:min(100% - 2*var(--gutter),96rem);margin:0 auto 1.5rem;color:var(--ink);font-family:var(--font-ui)}',
    '@supports (background:color-mix(in srgb,red 10%,blue)){.gm-zeit{--zeit-bg:color-mix(in srgb,var(--bg-2) 60%,var(--bg))}}',
    '.gm-zeit{min-width:0;max-width:100%}',
    '.gm-zeit *{box-sizing:border-box}',

    /* Werkzeugleiste */
    '.gm-zeit-bar{display:grid;grid-template-columns:minmax(0,1fr);gap:.8rem;margin:0 0 1rem}',
    '.gm-zeit-row{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem .9rem}',
    '.gm-zeit-row.is-split{justify-content:space-between}',
    '.gm-zeit-filters{display:flex;flex-wrap:wrap;gap:.5rem;margin:0;padding:0}',
    '.gm-zeit-chip{min-height:40px!important;padding-right:.9rem!important;gap:.5rem!important;font-size:.86rem!important;cursor:pointer}',
    '.gm-zeit-chip[aria-pressed="false"]{border-style:dashed;opacity:.62;background:transparent!important;box-shadow:none!important}',
    '.gm-zeit-chip[aria-pressed="false"] .gm-chip-label{text-decoration:line-through;text-decoration-thickness:1px}',
    '.gm-zeit-chip-n{font:700 .72rem/1 var(--font-ui);color:var(--ink-2);padding:.2rem .42rem;border-radius:999px;background:var(--bg-3);font-variant-numeric:tabular-nums}',
    '.gm-zeit-seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:3px;background:var(--bg-2);gap:2px}',
    '.gm-zeit-seg button{display:inline-flex;align-items:center;gap:.45rem;min-height:38px;padding:.3rem .95rem;border:0;border-radius:999px;background:transparent;color:var(--ink-2);font:600 .88rem/1 var(--font-ui);cursor:pointer}',
    '.gm-zeit-seg button:hover{color:var(--ink);background:var(--accent-soft)}',
    '.gm-zeit-seg button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}',
    '.gm-zeit-jump{display:flex;align-items:center;gap:.5rem;min-width:0;flex:1 1 20rem}',
    '.gm-zeit-jump-l{flex:none;font:700 .72rem/1.2 var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2)}',
    '.gm-zeit-jump ul{display:flex;gap:.35rem;list-style:none;margin:0;padding:3px 3px 5px;overflow-x:auto;scrollbar-width:none;min-width:0}',
    '.gm-zeit-jump ul::-webkit-scrollbar{display:none}',
    '.gm-zeit-ep{flex:none;min-height:40px;padding:.3rem .85rem;border:1px solid var(--line);border-radius:999px;background:var(--bg-2);color:var(--ink);font:600 .86rem/1 var(--font-ui);cursor:pointer;position:relative;white-space:nowrap}',
    '.gm-zeit-ep:hover{border-color:var(--accent);background:var(--accent-soft)}',
    '.gm-zeit-ep.is-current{border-color:var(--ink);box-shadow:inset 0 -3px 0 var(--warm)}',
    '.gm-zeit-tools{display:flex;align-items:center;gap:.35rem}',
    '.gm-zeit-btn{display:inline-grid;place-items:center;min-width:40px;min-height:40px;padding:0 .7rem;border:1px solid var(--line);border-radius:999px;background:var(--bg-2);color:var(--ink);font:700 1.1rem/1 var(--font-ui);cursor:pointer;gap:.4rem}',
    '.gm-zeit-btn.is-wide{display:inline-flex;align-items:center;font-size:.86rem;font-weight:600}',
    '.gm-zeit-btn:hover{border-color:var(--accent);background:var(--accent-soft)}',
    '.gm-zeit-btn[disabled]{opacity:.4;cursor:not-allowed;background:var(--bg-2)}',
    '.gm-zeit-readout{min-width:3.6em;text-align:center;font:600 .82rem/1 var(--font-ui);color:var(--ink-2);font-variant-numeric:tabular-nums}',
    '.gm-zeit-sep{width:1px;height:22px;background:var(--line);margin:0 .25rem}',
    '.gm-zeit-count{margin:0;font-size:.86rem;color:var(--ink-2)}',
    '.gm-zeit-count strong{color:var(--ink);font-variant-numeric:tabular-nums}',
    '.gm-zeit-hl{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;padding:.55rem .8rem;border:1px dashed var(--line);border-radius:var(--radius);background:var(--bg-2);font-size:.9rem;color:var(--ink-2)}',

    /* Bühne */
    '.gm-zeit-frame{position:relative;border:1px solid var(--line);border-radius:var(--radius-lg);background:var(--zeit-bg);box-shadow:var(--shadow);overflow:hidden}',
    '.gm-zeit-stage{position:relative;overflow-x:auto;overflow-y:hidden;touch-action:pan-x pan-y;cursor:grab;overscroll-behavior-x:contain;scrollbar-width:thin;scrollbar-color:var(--ink-3) transparent;-webkit-user-select:none;user-select:none}',
    '.gm-zeit-frame::after{content:"";position:absolute;right:0;top:0;bottom:14px;width:64px;z-index:20;pointer-events:none;background:linear-gradient(90deg,transparent,var(--zeit-bg));opacity:0;transition:opacity .25s}',
    '.gm-zeit-frame.has-more::after{opacity:1}',
    '.gm-zeit-stage.is-drag{cursor:grabbing}',
    '.gm-zeit-stage.is-drag *{cursor:grabbing!important}',
    '.gm-zeit-canvas{position:relative}',
    '.gm-zeit-gutter{position:sticky;left:0;top:0;z-index:12;background:var(--zeit-bg);border-right:1px solid var(--line);transition:box-shadow .2s}',
    '.gm-zeit-gutter.has-shadow{box-shadow:8px 0 16px -10px rgba(10,14,24,.35)}',
    '.gm-zeit-tag{position:absolute;left:12px;right:10px;display:flex;align-items:center;gap:.65rem;margin:0}',
    '.gm-zeit-tag-medal{--jc:var(--accent);flex:none;display:grid;place-items:center;width:42px;height:42px;border-radius:50%;border:2.5px solid var(--jc);background:var(--bg-2);color:var(--ink);box-shadow:0 0 0 5px color-mix(in srgb,var(--jc) 14%,transparent)}',
    '.gm-zeit-tag-text{min-width:0}',
    '.gm-zeit-tag-name{display:block;font:600 .88rem/1.2 var(--font-display);color:var(--ink);overflow-wrap:anywhere}',
    '.gm-zeit-tag-n{display:block;margin-top:.15rem;font:600 .7rem/1.2 var(--font-ui);letter-spacing:.06em;color:var(--ink-2)}',
    '.gm-zeit.is-small .gm-zeit-tag{left:0;right:0;flex-direction:column;justify-content:flex-start;gap:.35rem}',
    '.gm-zeit.is-slim .gm-zeit-tag{left:0;right:0;flex-direction:column;justify-content:flex-start;gap:.35rem}',
    '.gm-zeit.is-small .gm-zeit-tag-medal{width:36px;height:36px}',
    '.gm-zeit.is-slim .gm-zeit-tag-medal{width:36px;height:36px}',
    '.gm-zeit.is-small .gm-zeit-tag-text{display:none}',
    '.gm-zeit.is-slim .gm-zeit-tag-text{display:none}',
    '.gm-zeit-tag-short{display:none}',
    '.gm-zeit.is-small .gm-zeit-tag-short{display:block;writing-mode:vertical-rl;transform:rotate(180deg);flex:none;max-height:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 .7rem/1.2 var(--font-ui);letter-spacing:.04em;color:var(--ink-2)}',
    '.gm-zeit.is-slim .gm-zeit-tag-short{display:block;writing-mode:vertical-rl;transform:rotate(180deg);flex:none;max-height:128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 .7rem/1.2 var(--font-ui);letter-spacing:.04em;color:var(--ink-2)}',

    /* Epochen-Bänder */
    '.gm-zeit-bands{position:absolute;left:0;top:0;pointer-events:none}',
    '.gm-zeit-band{position:absolute;top:0;bottom:0;border-left:1px dashed color-mix(in srgb,var(--ink) 22%,transparent)}',
    '.gm-zeit-band:first-child{border-left:0}',
    '.gm-zeit-band.is-odd{background:color-mix(in srgb,var(--ink) 3.4%,transparent)}',
    '.gm-zeit-band-name{position:sticky;left:calc(var(--gut) + 16px);display:inline-block;vertical-align:top;padding:14px 8px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.gm-zeit-band-t,.gm-zeit-band-r{overflow:hidden;text-overflow:ellipsis}',
    '.gm-zeit-band-t{display:block;font:600 1.02rem/1.15 var(--font-display);letter-spacing:.01em;color:var(--ink)}',
    '.gm-zeit-band-r{display:block;margin-top:.2rem;font:700 .66rem/1.2 var(--font-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-2)}',
    '.gm-zeit-band.is-narrow .gm-zeit-band-name{position:static;display:block;padding:14px 0 0 7px;max-width:none!important;writing-mode:vertical-rl;overflow:visible}',
    '.gm-zeit-band.is-narrow .gm-zeit-band-t{font-size:.9rem;overflow:visible}',
    '.gm-zeit-band.is-narrow .gm-zeit-band-r{display:none}',

    /* SVG-Ebene */
    '.gm-zeit-svg{position:absolute;left:0;top:0;z-index:1;pointer-events:none;overflow:visible}',
    '.gm-zeit-ll{fill:none;stroke:var(--jc);stroke-width:6;stroke-linecap:round}',
    '.gm-zeit-ll-sh{fill:none;stroke:var(--ink);stroke-opacity:.14;stroke-width:6;stroke-linecap:round}',
    '.gm-zeit-ll.is-dots{stroke-width:4;stroke-dasharray:.1 11;opacity:.85}',
    '.gm-zeit-ll.is-lead{stroke-width:4;stroke-dasharray:.1 11;opacity:.4}',
    '.gm-zeit-span{fill:color-mix(in srgb,var(--jc) 12%,transparent);stroke:var(--jc);stroke-width:1.5}',
    '.gm-zeit-span.is-myth{stroke-dasharray:5 4}',
    '.gm-zeit-conn-bg{fill:none;stroke:var(--zeit-bg);stroke-width:10;stroke-linecap:round}',
    '.gm-zeit-conn{fill:none;stroke-width:4;stroke-linecap:round}',
    '.gm-zeit-stalk{fill:none;stroke-width:1.6;stroke-linecap:round;opacity:.75}',
    '.gm-zeit-tick{stroke:var(--jc);stroke-width:2.2;stroke-linecap:round}',
    '.gm-zeit-tickdot{fill:var(--jc)}',
    '.gm-zeit-rl{stroke:var(--ink-2);stroke-width:1.5}',
    '.gm-zeit-rtk{stroke:var(--ink-2);stroke-width:1.2}',
    '.gm-zeit-rtk.is-minor{stroke-opacity:.55}',
    '.gm-zeit-rt{fill:var(--ink-2);font:600 11px var(--font-ui);text-anchor:middle;font-variant-numeric:tabular-nums}',
    '.gm-zeit-brk-bg{stroke:var(--zeit-bg);stroke-width:7}',
    '.gm-zeit-brk{stroke:var(--ink);stroke-width:1.6;stroke-linecap:round}',
    '.gm-zeit-g.is-dim{opacity:.22}',
    '.gm-zeit.is-tiny .gm-zeit-disc{border-width:2.5px}',
    '.gm-zeit.is-tiny .gm-zeit-disc .gm-icon,.gm-zeit.is-tiny .gm-zeit-dots,.gm-zeit.is-tiny .gm-zeit-stalks{display:none}',
    '.gm-zeit.is-tiny .gm-zeit-item.is-visited .gm-zeit-disc::after{display:none}',

    /* Stationsknoten */
    '.gm-zeit-lanes{position:absolute;left:0;top:0;width:0;height:0;z-index:4}',
    '.gm-zeit-lane{list-style:none;margin:0;padding:0}',
    '.gm-zeit-item{position:absolute;width:0;height:0;margin:0;padding:0}',
    '.gm-zeit-item:hover,.gm-zeit-item:focus-within{z-index:30}',
    '.gm-zeit-item.is-dim{opacity:.26}',
    '.gm-zeit-item.is-dim:hover,.gm-zeit-item.is-dim:focus-within{opacity:1}',
    '.gm-zeit-node{position:absolute;left:calc(var(--n)/-2);top:calc(var(--n)/-2);width:var(--n);height:var(--n);margin:0;padding:0;border:0;border-radius:50%;background:transparent;color:var(--ink);cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:left}',
    '.gm-zeit-node::before{content:"";position:absolute;inset:-8px;border-radius:50%}',
    '.gm-zeit-node:focus-visible{outline:3px solid var(--accent);outline-offset:4px;border-radius:50%}',
    '.gm-zeit-disc{position:absolute;inset:0;display:grid;place-items:center;border-radius:50%;border:3px solid var(--jc);background:var(--bg-2);color:var(--ink);box-shadow:0 2px 6px rgba(15,20,35,.18);pointer-events:none}',
    '.gm-zeit-disc .gm-icon{width:calc(var(--n) - 12px);height:calc(var(--n) - 12px)}',
    '.gm-zeit-item.is-myth .gm-zeit-disc{border-style:dashed;background:repeating-linear-gradient(135deg,var(--bg-2) 0 3px,color-mix(in srgb,var(--bad) 26%,var(--bg-2)) 3px 5px)}',
    '.gm-zeit-item.is-visited .gm-zeit-disc{background-color:color-mix(in srgb,var(--warm) 40%,var(--bg-2));background-image:none;box-shadow:0 0 0 4px color-mix(in srgb,var(--warm) 32%,transparent),0 0 20px 3px color-mix(in srgb,var(--warm) 58%,transparent)}',
    '.gm-zeit-item.is-visited .gm-zeit-disc::after{content:"";position:absolute;right:-5px;top:-5px;width:11px;height:11px;border-radius:50%;background:var(--warm);border:2px solid var(--ink)}',
    '.gm-zeit-item.is-pulse .gm-zeit-disc{animation:gm-zeit-pulse 1.1s ease-out 3}',
    '.gm-zeit-label{position:absolute;display:flex;flex-direction:column;justify-content:center;gap:1px;min-width:0;pointer-events:auto;overflow:visible}',
    '.gm-zeit-label.is-up{justify-content:flex-end}',
    '.gm-zeit-label.is-down{justify-content:flex-start}',
    '.gm-zeit-label.is-l{align-items:flex-end;text-align:right}',
    '.gm-zeit-ly{display:flex;align-items:center;gap:.4rem;white-space:nowrap;font:700 .7rem/1.3 var(--font-ui);letter-spacing:.07em;color:var(--ink-2);font-variant-numeric:tabular-nums}',
    '.gm-zeit-label.is-l .gm-zeit-ly{flex-direction:row-reverse}',
    '.gm-zeit-lt{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 .86rem/1.25 var(--font-display);color:var(--ink);text-shadow:0 0 6px var(--zeit-bg),0 0 2px var(--zeit-bg)}',
    '.gm-zeit-leader{position:absolute;left:50%;width:1.5px;margin-left:-.75px;background:var(--jc);opacity:.65;pointer-events:none}',
    '.gm-zeit-stamp{display:inline-block;padding:0 .3rem;border:1.5px solid var(--bad);border-radius:3px;color:var(--bad);background:color-mix(in srgb,var(--bad) 8%,transparent);font:800 .6rem/1.5 var(--font-ui);letter-spacing:.14em;text-transform:uppercase;transform:rotate(-4deg);white-space:nowrap}',

    /* Umstiegspunkte */
    '.gm-zeit-dots{position:absolute;left:0;top:0;width:0;height:0}',
    '.gm-zeit-dot{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;padding:0;border-radius:50%;background:var(--jc);border:2px solid var(--bg-2);box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ink) 62%,transparent),0 1px 3px rgba(0,0,0,.28);cursor:pointer;z-index:3}',
    '.gm-zeit-dot::before{content:"";position:absolute;inset:-6px;border-radius:50%}',
    '.gm-zeit-dot:hover,.gm-zeit-dot:focus-visible{transform:scale(1.45)}',
    '.gm-zeit-dot:focus-visible{outline:3px solid var(--accent);outline-offset:2px}',
    '.gm-zeit-dot.is-hl{transform:scale(1.4);box-shadow:0 0 0 2px var(--warm),0 0 10px 2px var(--warm)}',

    /* Vorschau (Maus) */
    '.gm-zeit-tip{position:absolute;z-index:40;left:0;top:0;width:min(21.5rem,calc(100% - 16px));padding:.9rem 1.05rem 1rem;background:var(--bg-2);border:1px solid var(--line);border-top:4px solid var(--jc,var(--accent));border-radius:var(--radius);box-shadow:var(--shadow-lg);pointer-events:none;opacity:0;visibility:hidden}',
    '.gm-zeit-tip.is-on{opacity:1;visibility:visible}',
    '.gm-zeit-pv-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .8rem;margin:0 0 .35rem;font:700 .68rem/1.3 var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2)}',
    '.gm-zeit-pv-kind{display:inline-flex;align-items:center;gap:.35rem}',
    '.gm-zeit-pv-year{padding:.12rem .55rem .1rem;border:1px solid var(--warm);border-radius:3px;background:color-mix(in srgb,var(--warm) 16%,var(--bg-2));color:var(--ink);font:600 .85rem/1.3 var(--font-display);letter-spacing:.04em;text-transform:none}',
    '.gm-zeit-pv-title{margin:0 0 .4rem;font:600 1.12rem/1.25 var(--font-display);color:var(--ink);text-wrap:balance}',
    '.gm-zeit-pv-teaser{margin:0 0 .5rem;font-size:.9rem;line-height:1.5;color:var(--ink)}',
    '.gm-zeit-pv-myth{margin:0 0 .5rem;padding:.4rem .6rem;border-left:3px solid var(--bad);background:color-mix(in srgb,var(--bad) 8%,transparent);border-radius:0 6px 6px 0;font-size:.84rem;line-height:1.45;color:var(--ink)}',
    '.gm-zeit-pv-lanes{display:flex;flex-wrap:wrap;gap:.3rem .7rem;margin:0;padding:0;list-style:none;font-size:.78rem;color:var(--ink-2)}',
    '.gm-zeit-pv-lanes li{display:inline-flex;align-items:center;gap:.35rem}',
    '.gm-zeit-pv-lanes i{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--jc);box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ink) 55%,transparent)}',
    '.gm-zeit-pv-hint{margin:.55rem 0 0;font-size:.76rem;color:var(--ink-2)}',
    '.gm-zeit-pv-dotx{margin:0 0 .3rem;font:700 .68rem/1.3 var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2)}',

    /* Bottom-Sheet (Touch) */
    '.gm-zeit-sheet{position:fixed;left:0;right:0;bottom:0;z-index:70;margin:0 auto;width:min(100%,36rem);max-height:78vh;overflow:auto;padding:.4rem 1.15rem calc(1.2rem + env(safe-area-inset-bottom,0px));background:var(--bg-2);border:1px solid var(--line);border-bottom:0;border-radius:22px 22px 0 0;box-shadow:var(--shadow-lg);transform:translateY(106%);visibility:hidden;outline:none}',
    '.gm-zeit-sheet.is-on{transform:none;visibility:visible}',
    '.gm-zeit-sheet::before{content:"";position:absolute;left:0;right:0;top:0;height:5px;border-radius:22px 22px 0 0;background:var(--jc,var(--accent))}',
    '.gm-zeit-grab{display:block;width:44px;height:5px;margin:.55rem auto .7rem;border-radius:3px;background:var(--line)}',
    '.gm-zeit-sheet-x{position:absolute;right:.5rem;top:.7rem}',
    '.gm-zeit-sheet .gm-zeit-pv-title{font-size:1.35rem;padding-right:2.6rem}',
    '.gm-zeit-sheet .gm-zeit-pv-teaser{font-size:1rem}',
    '.gm-zeit-sheet-act{display:grid;gap:.55rem;margin:1rem 0 0}',
    '.gm-zeit-sheet-act .gm-btn{width:100%}',
    '.gm-zeit-xbtn{--jc:var(--accent);justify-content:flex-start;text-align:left;gap:.6rem;border-color:var(--jc);background:color-mix(in srgb,var(--jc) 10%,var(--bg-2));color:var(--ink);min-height:48px}',
    '.gm-zeit-xbtn .gm-zeit-xdot{flex:none;width:14px;height:14px;border-radius:50%;background:var(--jc);box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ink) 60%,transparent)}',
    '.gm-zeit-xbtn small{display:block;font-weight:500;font-size:.8rem;color:var(--ink-2);line-height:1.35}',

    /* Hinweise, Legende */
    '.gm-zeit-hint{margin:.8rem 0 0;font-size:.84rem;line-height:1.5;color:var(--ink-2)}',
    '.gm-zeit-hint .gm-zeit-h-touch{display:none}',
    '.gm-zeit-legend{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;margin:.9rem 0 0;padding:0;list-style:none;font-size:.82rem;color:var(--ink-2)}',
    '.gm-zeit-legend li{display:inline-flex;align-items:center;gap:.55rem}',
    '.gm-zeit-sw{flex:none;display:inline-block;width:20px;height:20px;border-radius:50%;border:2.5px solid var(--sw,var(--accent));background:var(--bg-2)}',
    '.gm-zeit-sw.is-myth{border-style:dashed;background:repeating-linear-gradient(135deg,var(--bg-2) 0 2.5px,color-mix(in srgb,var(--bad) 28%,var(--bg-2)) 2.5px 4px)}',
    '.gm-zeit-sw.is-seen{background:color-mix(in srgb,var(--warm) 42%,var(--bg-2));box-shadow:0 0 0 3px color-mix(in srgb,var(--warm) 34%,transparent),0 0 10px 1px color-mix(in srgb,var(--warm) 60%,transparent)}',
    '.gm-zeit-sw.is-dot{width:12px;height:12px;border:2px solid var(--bg-2);background:var(--jp-3,var(--accent));box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ink) 60%,transparent)}',
    '.gm-zeit-sw.is-dots{display:inline-flex;width:auto;height:auto;border:0;background:none;gap:2px}',
    '.gm-zeit-sw.is-dots i{width:11px;height:11px;border-radius:50%;border:2px solid var(--bg-2);box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ink) 60%,transparent)}',
    '.gm-zeit-sw.is-dots i:nth-child(1){background:var(--jp-3,var(--accent))}.gm-zeit-sw.is-dots i:nth-child(2){background:var(--jp-4,var(--warm))}.gm-zeit-sw.is-dots i:nth-child(3){background:var(--jp-2,var(--bad))}',
    '.gm-zeit-sw.is-span{width:30px;height:12px;border-radius:6px;border-width:1.5px;background:color-mix(in srgb,var(--jp-5,var(--accent)) 18%,transparent);border-color:var(--jp-5,var(--accent))}',
    '.gm-zeit-sw.is-conn{width:4px;height:22px;border:0;border-radius:2px;background:linear-gradient(var(--jp-1,var(--accent)),var(--jp-2,var(--warm)))}',
    '.gm-zeit-sw.is-gap{width:30px;height:0;border:0;border-top:4px dotted var(--jp-1,var(--accent));border-radius:0;background:none}',
    '.gm-zeit-note{margin:.7rem 0 0;font-size:.82rem;line-height:1.5;color:var(--ink-2);max-width:60rem}',

    /* Handy: vertikaler Zeitstrahl */
    '.gm-zeit-v{margin:0}',
    '.gm-zeit-v-ep{position:relative}',
    '.gm-zeit-v-eph{position:sticky;top:var(--header-h,56px);z-index:6;display:flex;align-items:baseline;flex-wrap:wrap;gap:.1rem .7rem;margin:0 calc(-1 * var(--gutter,16px)) .7rem;padding:.6rem var(--gutter,16px) .5rem;background:var(--bg);border-bottom:2px solid var(--ink);font:600 1.15rem/1.2 var(--font-display);color:var(--ink);scroll-margin-top:calc(var(--header-h,56px) + 4px)}',
    '.gm-zeit-v-eph small{font:700 .66rem/1.3 var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2)}',
    '.gm-zeit-v-ol{list-style:none;margin:0 0 1.2rem;padding:0}',
    '.gm-zeit-v-li{--jc:var(--accent);position:relative;display:grid;grid-template-columns:30px minmax(0,1fr);gap:0 .7rem;padding:0 0 .85rem}',
    '.gm-zeit-v-li::before{content:"";position:absolute;left:13px;top:0;bottom:0;width:4px;border-radius:2px;background:color-mix(in srgb,var(--ink) 22%,transparent)}',
    '.gm-zeit-v-node{position:relative;z-index:1;justify-self:center;margin-top:1.05rem;width:26px;height:26px;border-radius:50%;background:var(--ring,var(--jc));box-shadow:0 0 0 4px var(--bg)}',
    '.gm-zeit-v-node::after{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--bg-2)}',
    '.gm-zeit-v-li.is-myth .gm-zeit-v-node::after{background:repeating-linear-gradient(135deg,var(--bg-2) 0 3px,color-mix(in srgb,var(--bad) 30%,var(--bg-2)) 3px 5px)}',
    '.gm-zeit-v-li.is-visited .gm-zeit-v-node::after{background:color-mix(in srgb,var(--warm) 55%,var(--bg-2))}',
    '.gm-zeit-v-li.is-visited .gm-zeit-v-node{box-shadow:0 0 0 4px var(--bg),0 0 14px 3px color-mix(in srgb,var(--warm) 60%,transparent)}',
    '.gm-zeit-v-card{position:relative;min-width:0;padding:.85rem 1rem .9rem 1.25rem;background:var(--bg-2);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}',
    '.gm-zeit-v-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:7px;background:var(--stripe,var(--jc))}',
    '.gm-zeit-v-li.is-myth .gm-zeit-v-card{border-style:dashed}',
    '.gm-zeit-v-li.is-dim{opacity:.35}',
    '.gm-zeit-v-li.is-pulse .gm-zeit-v-card{outline:3px solid var(--warm);outline-offset:2px}',
    '.gm-zeit-v-year{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .6rem;margin:0 0 .3rem;font:700 .8rem/1.3 var(--font-ui);letter-spacing:.06em;color:var(--ink-2)}',
    '.gm-zeit-v-seen{display:none;font:700 .72rem/1 var(--font-ui);color:color-mix(in srgb,var(--ok) 62%,var(--ink))}',
    '.gm-zeit-v-li.is-visited .gm-zeit-v-seen{display:inline}',
    '.gm-zeit-v-t{margin:0 0 .35rem;font:600 1.12rem/1.28 var(--font-display);text-wrap:balance}',
    '.gm-zeit-v-t a{color:var(--ink);text-decoration:none}',
    '.gm-zeit-v-t a::after{content:"";position:absolute;inset:0;z-index:1}',
    '.gm-zeit-v-teaser{margin:0 0 .6rem;font-size:.92rem;line-height:1.5;color:var(--ink)}',
    '.gm-zeit-v-lanes{display:flex;flex-wrap:wrap;gap:.3rem .8rem;margin:0;padding:0;list-style:none;font-size:.78rem;color:var(--ink-2)}',
    '.gm-zeit-v-lanes li{display:inline-flex;align-items:center;gap:.35rem}',
    '.gm-zeit-v-lanes i{display:inline-block;width:11px;height:11px;border-radius:50%;background:var(--jc);box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ink) 55%,transparent)}',
    '.gm-zeit-v-x{position:relative;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .5rem;margin:.65rem 0 0}',
    '.gm-zeit-v-x .gm-zeit-li-x{min-height:40px;padding:.2rem .8rem .2rem .6rem;font-size:.8rem}',
    '.gm-zeit.is-phone .gm-zeit-seg{display:none}',
    '.gm-zeit.is-phone .gm-zeit-tools,.gm-zeit.is-phone .gm-zeit-jump-l{display:none}',
    '.gm-zeit.is-phone .gm-zeit-row.is-split{flex-direction:column;align-items:stretch}',
    '.gm-zeit.is-phone .gm-zeit-bar{position:relative}',

    /* Liste */
    '.gm-zeit-list{margin:0}',
    '.gm-zeit-ep-h{display:flex;align-items:baseline;flex-wrap:wrap;gap:.2rem .9rem;margin:2.2rem 0 .6rem;padding-bottom:.45rem;border-bottom:2px solid var(--ink);font:600 clamp(1.3rem,1.1rem + .9vw,1.8rem)/1.15 var(--font-display)}',
    '.gm-zeit-ep-h:first-child{margin-top:.4rem}',
    '.gm-zeit-ep-h small{font:700 .68rem/1.3 var(--font-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-2)}',
    '.gm-zeit-ol{list-style:none;margin:0;padding:0}',
    '.gm-zeit-li{--jc:var(--accent);position:relative;display:grid;grid-template-columns:9rem minmax(0,1fr);gap:.2rem 1.4rem;padding:1rem .4rem 1rem 0;border-bottom:1px solid var(--line)}',
    '.gm-zeit-li-year{padding-top:.1rem;font:600 1.05rem/1.3 var(--font-display);color:var(--ink);font-variant-numeric:lining-nums}',
    '.gm-zeit-li-year span{display:block;margin-top:.25rem;width:2.4rem;height:4px;border-radius:2px;background:var(--jc)}',
    '.gm-zeit-li-t{margin:0 0 .25rem;display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .8rem;font:600 1.2rem/1.25 var(--font-display)}',
    '.gm-zeit-li-t a{color:var(--ink);text-decoration:none;background-image:linear-gradient(var(--jc),var(--jc));background-size:100% 2px;background-position:0 100%;background-repeat:no-repeat;padding-bottom:1px}',
    '.gm-zeit-li-t a:hover{color:var(--link);background-size:100% 4px}',
    '.gm-zeit-li.is-myth .gm-zeit-li-t a{background-image:linear-gradient(90deg,var(--bad) 55%,transparent 0);background-size:8px 2px;background-repeat:repeat-x}',
    '.gm-zeit-li-seen{display:none;align-items:center;gap:.3rem;font:700 .72rem/1 var(--font-ui);letter-spacing:.04em;color:color-mix(in srgb,var(--ok) 62%,var(--ink))}',
    '.gm-zeit-li.is-visited .gm-zeit-li-seen{display:inline-flex}',
    '.gm-zeit-li.is-visited .gm-zeit-li-year span{background:var(--warm);box-shadow:0 0 10px var(--warm)}',
    '.gm-zeit-li-teaser{margin:0 0 .5rem;color:var(--ink);font-size:.97rem;line-height:1.55;max-width:46rem}',
    '.gm-zeit-li-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .5rem;margin:0;padding:0;list-style:none}',
    '.gm-zeit-li-kind{display:inline-flex;align-items:center;gap:.35rem;margin-right:.4rem;font:700 .68rem/1.2 var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2)}',
    '.gm-zeit-li-x{display:inline-flex;align-items:center;gap:.4rem;min-height:34px;padding:.15rem .7rem .15rem .5rem;border:1.5px solid var(--jc);border-radius:999px;background:color-mix(in srgb,var(--jc) 8%,var(--bg-2));color:var(--ink);font:600 .78rem/1 var(--font-ui);cursor:pointer}',
    '.gm-zeit-li-x:hover{background:color-mix(in srgb,var(--jc) 22%,var(--bg-2))}',
    '.gm-zeit-li-x i{display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--jc);box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ink) 55%,transparent)}',
    '.gm-zeit-li-xl{font:700 .66rem/1 var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);margin-right:.1rem}',
    '.gm-zeit-undated{margin-top:1.6rem;color:var(--ink-2);font-size:.9rem}',
    '.gm-zeit-empty{padding:3rem 1rem;text-align:center;color:var(--ink-2)}',

    /* Kompakt (Smartphone) */
    '.gm-zeit.is-small .gm-zeit-jump{flex-basis:100%}',
    '.gm-zeit.is-small .gm-zeit-row.is-split{flex-direction:column;flex-wrap:nowrap;align-items:stretch}',
    '.gm-zeit.is-small .gm-zeit-filters{min-width:0;max-width:100%}',
    '.gm-zeit.is-small .gm-zeit-seg{order:-1;width:100%}',
    '.gm-zeit.is-small .gm-zeit-seg button{flex:1;justify-content:center}',
    '.gm-zeit.is-small .gm-zeit-filters{flex-wrap:wrap;gap:.4rem;padding:3px}',
    '.gm-zeit.is-small .gm-zeit-chip{flex:none;padding-left:.45rem!important;padding-right:.7rem!important;gap:.35rem!important}',
    '.gm-zeit.is-small .gm-zeit-chip-n{display:none}',
    '.gm-zeit.is-small .gm-zeit-jump-l{display:none}',
    '.gm-zeit.is-small .gm-zeit-tools{justify-content:space-between;width:100%}',
    '.gm-zeit.is-small .gm-zeit-sep{display:none}',
    '.gm-zeit.is-small .gm-zeit-band-t{font-size:.92rem}',
    '.gm-zeit.is-small .gm-zeit-li{grid-template-columns:minmax(0,1fr)}',
    '.gm-zeit.is-small .gm-zeit-li-year{display:flex;align-items:center;gap:.7rem}',
    '.gm-zeit.is-small .gm-zeit-li-year span{margin:0}',
    '.gm-zeit.is-small .gm-zeit-tools .gm-zeit-btn.is-wide .gm-zeit-btn-t{display:none}',
    '.gm-zeit.is-small .gm-zeit-tip{display:none}',
    '@media (hover:none),(pointer:coarse){',
    '.gm-zeit-dot{pointer-events:none}',
    '.gm-zeit-hint .gm-zeit-h-mouse{display:none}.gm-zeit-hint .gm-zeit-h-touch{display:inline}',
    '.gm-zeit-tip{display:none}',
    '}',

    /* Bewegung (nur, wenn erwünscht) */
    '@media (prefers-reduced-motion:no-preference){',
    '.gm-zeit-disc,.gm-zeit-dot,.gm-zeit-item{transition:transform .22s var(--ease),box-shadow .3s,opacity .3s}',
    '.gm-zeit-node:hover .gm-zeit-disc,.gm-zeit-node:focus-visible .gm-zeit-disc{transform:scale(1.14)}',
    '.gm-zeit-tip{transform:translateY(5px);transition:opacity .16s,transform .2s var(--ease),visibility .16s}',
    '.gm-zeit-tip.is-on{transform:none}',
    '.gm-zeit-sheet{transition:transform .34s var(--ease),visibility .34s}',
    '.gm-zeit-g{transition:opacity .3s}',
    '.gm-zeit-btn,.gm-zeit-ep,.gm-zeit-seg button{transition:background-color .2s,border-color .2s,color .2s}',
    '.gm-zeit.is-intro .gm-zeit-svg{animation:gm-zeit-wipe 1.5s var(--ease) both}',
    '.gm-zeit.is-intro .gm-zeit-item{animation:gm-zeit-pop .55s var(--ease) both;animation-delay:calc(var(--i,0) * 26ms + .25s)}',
    '.gm-zeit.is-intro .gm-zeit-tag{animation:gm-zeit-slide .6s var(--ease) both}',
    '}',
    '@media (prefers-reduced-motion:reduce){.gm-zeit-item.is-pulse .gm-zeit-disc{animation:none;box-shadow:0 0 0 5px var(--warm)}}',
    '@keyframes gm-zeit-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--warm) 85%,transparent)}100%{box-shadow:0 0 0 20px color-mix(in srgb,var(--warm) 0%,transparent)}}',
    '@keyframes gm-zeit-wipe{from{clip-path:inset(-40px 100% -40px 0)}to{clip-path:inset(-40px -40px -40px 0)}}',
    '@keyframes gm-zeit-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}',
    '@keyframes gm-zeit-slide{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}'
  ].join('\n');

  function injectStyles() {
    if (doc.getElementById('gm-zeit-style')) return;
    var s = doc.createElement('style');
    s.id = 'gm-zeit-style';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Maße je nach Breite
   * ------------------------------------------------------------------ */

  var TINY_Z = 0.5;   // darunter: Übersicht mit kleinen Punkten statt Symbolknoten
  function metrics(W, z) {
    var small = W < 720;
    var big = small || isCoarse();
    var tiny = z < TINY_Z;
    return {
      small: small, big: big, tiny: tiny,
      gutter: (small || (tiny && W < 1100)) ? 54 : 188,
      slim: small || (tiny && W < 1100),
      padL: small ? 24 : 36,
      node: tiny ? 16 : (big ? 30 : 26),
      gap: tiny ? (big ? 21 : 19) : (big ? 48 : 42),
      LH: small ? 34 : 37,
      labelMax: small ? 134 : 186,
      fsT: small ? 13 : 13.8,
      head: 62,
      top: 124,
      laneGap: small ? 184 : 204,
      bot: 120,
      ruler: 66
    };
  }

  /* ------------------------------------------------------------------ *
   * Aufbau der Oberfläche
   * ------------------------------------------------------------------ */

  function mount(host) {
    injectStyles();
    S.host = host;
    collect();
    S.sig = signature();
    try {
      var saved = M.store && M.store.get ? M.store.get('zeitMode', 'strahl') : 'strahl';
      S.mode = saved === 'liste' ? 'liste' : 'strahl';
    } catch (e) { S.mode = 'strahl'; }

    var root = el('div', { class: 'gm-zeit is-intro' });
    S.root = root;
    host.appendChild(root);
    var wrap = root;
    S.wrap = wrap;

    buildToolbar(wrap);
    buildStage(wrap);
    buildSheet();
    buildList(wrap);
    buildNotes(wrap);

    bindStage();
    bindToolbar();
    bindGlobal();
    S.built = true;
    S.phone = phoneNow();
    applyMode(true);
    syncVisited();
  }

  function fillFilters() {
    var filters = S.filtersEl;
    filters.innerHTML = '';
    S.laneChips = {};
    S.lanes.forEach(function (l) {
      var cnt = S.items.filter(function (it) { return it.lanes.indexOf(l.id) >= 0; }).length;
      var chip;
      if (M.ui && M.ui.journeyChip) {
        chip = M.ui.journeyChip(l.id, { active: true, onClick: function () { toggleLane(l.id); } });
      } else {
        chip = el('button', { type: 'button', class: 'gm-chip', 'aria-pressed': 'true', style: { '--jc': jv(l.id) }, on: { click: function () { toggleLane(l.id); } } }, journey(l.id).kurz);
      }
      chip.classList.add('gm-zeit-chip');
      chip.setAttribute('aria-pressed', l.on ? 'true' : 'false');
      chip.classList.toggle('is-active', l.on);
      chip.appendChild(el('span', { class: 'gm-zeit-chip-n', 'aria-hidden': 'true' }, String(cnt)));
      var full = journey(l.id).kurz || journey(l.id).name;
      chip.setAttribute('aria-label', full + ', ' + cnt + (' ' + M.t('stations')));
      chip.title = journey(l.id).name;
      l.full = full;
      l.short = String(full).replace(/-Geschichte$/, '');
      l.chip = chip;
      S.laneChips[l.id] = chip;
      filters.appendChild(chip);
    });
  }


  function buildToolbar(wrap) {
    var bar = el('div', { class: 'gm-zeit-bar' });

    // Zeile 1: Bahnen + Darstellung
    var filters = el('div', { class: 'gm-zeit-filters', role: 'group', 'aria-label': 'Bahnen ein- oder ausblenden' });
    S.filtersEl = filters;
    fillFilters();

    S.btnStrahl = el('button', { type: 'button', 'aria-pressed': 'true' }, el('span', { html: ico('hourglass', 18), 'aria-hidden': 'true' }), M.t('timeline'));
    S.btnListe = el('button', { type: 'button', 'aria-pressed': 'false' }, el('span', { html: ico('checklist', 18), 'aria-hidden': 'true' }), 'Als Liste');
    var seg = el('div', { class: 'gm-zeit-seg', role: 'group', 'aria-label': 'Darstellung wählen' }, S.btnStrahl, S.btnListe);

    bar.appendChild(el('div', { class: 'gm-zeit-row is-split' }, filters, seg));

    // Zeile 2: Epochen-Sprünge + Werkzeuge
    var jumpUl = el('ul');
    S.jumpBtns = [];
    EPOCHS.forEach(function (ep) {
      var b = el('button', { type: 'button', class: 'gm-zeit-ep', dataset: { epoch: ep.id }, 'aria-label': 'Zu „' + ep.name + '“ springen (' + ep.range + ')' }, ep.short);
      b.addEventListener('click', function () { jumpTo(ep); });
      S.jumpBtns.push({ ep: ep, btn: b });
      jumpUl.appendChild(el('li', null, b));
    });
    var jump = el('nav', { class: 'gm-zeit-jump', 'aria-label': 'Zu einer Epoche springen' }, el('span', { class: 'gm-zeit-jump-l', 'aria-hidden': 'true' }, 'Springe zu'), jumpUl);
    S.jumpNav = jump;

    S.btnLeft = el('button', { type: 'button', class: 'gm-zeit-btn', 'aria-label': (M.t('timeline') + ' nach links verschieben (früher)'), title: 'Früher', html: ico('arrow-left', 18) });
    S.btnRight = el('button', { type: 'button', class: 'gm-zeit-btn', 'aria-label': (M.t('timeline') + ' nach rechts verschieben (später)'), title: 'Später', html: ico('arrow-right', 18) });
    S.btnOut = el('button', { type: 'button', class: 'gm-zeit-btn', 'aria-label': 'Herauszoomen', title: 'Herauszoomen ( − )' }, '−');
    S.btnIn = el('button', { type: 'button', class: 'gm-zeit-btn', 'aria-label': 'Hineinzoomen', title: 'Hineinzoomen ( + )' }, '+');
    S.readout = el('output', { class: 'gm-zeit-readout', 'aria-label': 'Zoomstufe', 'aria-live': 'off' }, '100 %');
    S.btnFit = el('button', { type: 'button', class: 'gm-zeit-btn is-wide', title: 'Alles auf einen Blick' }, el('span', { html: ico('map', 16), 'aria-hidden': 'true' }), el('span', { class: 'gm-zeit-btn-t' }, 'Alles zeigen'));
    S.btnFit.setAttribute('aria-label', ('Alles zeigen: ganzen ' + M.t('timeline') + ' einpassen'));
    S.tools = el('div', { class: 'gm-zeit-tools', role: 'group', 'aria-label': 'Verschieben und Zoomen' },
      S.btnLeft, S.btnRight, el('span', { class: 'gm-zeit-sep', 'aria-hidden': 'true' }), S.btnOut, S.readout, S.btnIn, S.btnFit);
    S.rowTools = el('div', { class: 'gm-zeit-row is-split' }, jump, S.tools);
    bar.appendChild(S.rowTools);

    // Hervorhebung
    S.hlBar = el('div', { class: 'gm-zeit-hl', hidden: true });
    bar.appendChild(S.hlBar);

    S.countEl = el('p', { class: 'gm-zeit-count', 'aria-live': 'off' });
    bar.appendChild(S.countEl);
    wrap.appendChild(bar);
  }

  function buildStage(wrap) {
    var frame = el('div', { class: 'gm-zeit-frame' });
    var stage = el('div', {
      class: 'gm-zeit-stage', role: 'group', 'aria-roledescription': M.t('timeline'),
      'aria-label': (M.t('timeline') + ' mit den historischen ' + M.t('journeys') + ' als Bahnen. Mit den Pfeiltasten wechselst du zwischen ' + M.t('stations') + ', mit Plus und Minus zoomst du, die Eingabetaste öffnet eine ' + M.t('station') + '.'),
      'aria-describedby': 'gm-zeit-hint'
    });
    var canvas = el('div', { class: 'gm-zeit-canvas' });
    S.gutter = el('div', { class: 'gm-zeit-gutter', 'aria-hidden': 'true' });
    S.bands = el('div', { class: 'gm-zeit-bands', 'aria-hidden': 'true' });
    var svgNS = 'http://www.w3.org/2000/svg';
    S.svg = doc.createElementNS(svgNS, 'svg');
    S.svg.setAttribute('class', 'gm-zeit-svg');
    S.svg.setAttribute('aria-hidden', 'true');
    S.svg.setAttribute('focusable', 'false');
    S.lanesHost = el('div', { class: 'gm-zeit-lanes' });
    canvas.appendChild(S.gutter);
    canvas.appendChild(S.bands);
    canvas.appendChild(S.svg);
    canvas.appendChild(S.lanesHost);
    stage.appendChild(canvas);
    frame.appendChild(stage);
    S.tip = el('div', { class: 'gm-zeit-tip', 'aria-hidden': 'true' });
    frame.appendChild(S.tip);
    wrap.appendChild(frame);
    S.frame = frame; S.stage = stage; S.canvas = canvas;
    S.empty = el('p', { class: 'gm-zeit-empty', hidden: true }, ('Für den ' + M.t('timeline') + ' sind noch keine ' + M.t('stations') + ' eingerichtet.'));
    wrap.appendChild(S.empty);
    buildNodes();
    buildGutter();
  }

  function buildNodes() {
    S.lanesHost.innerHTML = '';
    S.insts = [];
    S.laneUl = {};
    HIST.forEach(function (jid) {
      var j = journey(jid);
      var ul = el('ul', { class: 'gm-zeit-lane', role: 'list', 'aria-label': 'Bahn „' + j.name + '“' });
      S.laneUl[jid] = ul;
      S.lanesHost.appendChild(ul);
    });
    S.items.forEach(function (it, i) {
      it.insts = [];
      it.dotsEl = null;
      it.lw = 60;
      it.lanes.forEach(function (jid) {
        var j = journey(jid);
        var st = it.st;
        var kind = (M.kinds && M.kinds[st.kind]) || { label: '', icon: 'lightbulb' };
        var iconKey = st.icon || kind.icon || 'lightbulb';
        var srTxt = sentence(st.title) + ' ' + sentence(it.yearFull) + ' ' + (kind.label ? kind.label + '. ' : '') +
          (it.myth ? ('Ein überholter Irrtum, auf dem ' + M.t('timeline') + ' als Mythos markiert. ') : '') +
          'Bahn: ' + j.name + '.' + (it.lanes.length > 1 ? ' Liegt auch auf ' + it.lanes.filter(function (x) { return x !== jid; }).map(function (x) { return journey(x).name; }).join(' und ') + '.' : '') +
          (it.func.length ? ' Umstieg möglich zu: ' + it.func.map(function (x) { return journey(x).name; }).join(', ') + '.' : '');
        var vis = el('span', { class: 'gm-sr gm-zeit-vis' });
        var leader = el('span', { class: 'gm-zeit-leader', 'aria-hidden': 'true' });
        var label = el('span', { class: 'gm-zeit-label', 'aria-hidden': 'true', hidden: true },
          el('span', { class: 'gm-zeit-ly' }, el('span', null, it.yearShort), it.myth ? el('span', { class: 'gm-zeit-stamp' }, 'überholt') : null),
          el('span', { class: 'gm-zeit-lt' }, it.title));
        var btn = el('button', { type: 'button', class: 'gm-zeit-node', tabindex: -1, dataset: { id: it.id, lane: jid } },
          el('span', { class: 'gm-zeit-disc', 'aria-hidden': 'true', html: ico(iconKey, 16) }),
          el('span', { class: 'gm-sr' }, srTxt), vis, leader, label);
        var li = el('li', { class: 'gm-zeit-item' + (it.myth ? ' is-myth' : ''), style: { '--jc': jv(jid), '--i': String(i) }, dataset: { id: it.id } }, btn);
        var inst = { item: it, lane: jid, li: li, btn: btn, label: label, leader: leader, vis: vis, x: 0, y: 0 };
        btn._inst = inst;
        it.insts.push(inst);
        S.insts.push(inst);
        S.laneUl[jid].appendChild(li);
      });
      // Umstiegspunkte (einmal je Station, sitzen am obersten sichtbaren Knoten)
      if (it.func.length) {
        it.dotsEl = el('span', { class: 'gm-zeit-dots' });
        it.dots = it.func.map(function (jid) {
          var j = journey(jid);
          var sentence = (it.st.cross && it.st.cross[jid]) || '';
          var d = el('button', {
            type: 'button', class: 'gm-zeit-dot', tabindex: -1,
            style: { '--jc': jv(jid) },
            'aria-label': (M.t('transfer') + ' zur ' + M.t('journey') + ' „') + j.name + ('“ an der ' + M.t('station') + ' ') + it.title
          });
          d._item = it; d._jid = jid; d._sentence = sentence;
          it.dotsEl.appendChild(d);
          return d;
        });
      }
    });
  }

  function buildGutter() {
    S.gutter.innerHTML = '';
    S.tags = {};
    HIST.forEach(function (jid) {
      var j = journey(jid);
      var cnt = S.items.filter(function (it) { return it.lanes.indexOf(jid) >= 0; }).length;
      var tag = el('div', { class: 'gm-zeit-tag', style: { '--jc': jv(jid) } },
        el('span', { class: 'gm-zeit-tag-medal', style: { '--jc': jv(jid) }, html: ico(j.icon || 'train', 22) }),
        el('span', { class: 'gm-zeit-tag-text' }, el('span', { class: 'gm-zeit-tag-name' }, j.name), el('span', { class: 'gm-zeit-tag-n' }, cnt + (' ' + M.t('stations')))),
        el('span', { class: 'gm-zeit-tag-short' }, String(j.kurz || j.name).replace(/-Geschichte$/, '')));
      S.tags[jid] = tag;
      S.gutter.appendChild(tag);
    });
  }

  function buildSheet() {
    var sheet = el('div', { class: 'gm-zeit-sheet', role: 'region', 'aria-label': ('Vorschau der ' + M.t('station')), tabindex: -1 });
    S.sheet = sheet;
    S.root.appendChild(sheet);
  }

  function buildNotes(wrap) {
    S.hintEl = el('p', { class: 'gm-zeit-hint', id: 'gm-zeit-hint' },
      el('span', { class: 'gm-zeit-h-mouse' }, ('Ziehen verschiebt, Strg + Mausrad oder Trackpad-Pinch zoomt. Mit den Pfeiltasten springst du von ' + M.t('station') + ' zu ' + M.t('station') + ', die Eingabetaste öffnet sie. Der Mauszeiger zeigt eine Vorschau.')),
      el('span', { class: 'gm-zeit-h-touch' }, ('Wische zum Verschieben, zwei Finger zoomen. Tippe auf eine ' + M.t('station') + ' für die Vorschau.')));
    wrap.appendChild(S.hintEl);
    var leg = el('ul', { class: 'gm-zeit-legend', 'aria-label': 'Legende' },
      el('li', null, el('span', { class: 'gm-zeit-sw', 'aria-hidden': 'true' }), M.t('station')),
      el('li', null, el('span', { class: 'gm-zeit-sw is-myth', 'aria-hidden': 'true' }), el('span', null, 'Mythos: ein überholter Irrtum')),
      el('li', null, el('span', { class: 'gm-zeit-sw is-seen', 'aria-hidden': 'true' }), 'Von dir besucht'),
      el('li', null, el('span', { class: 'gm-zeit-sw is-dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), ('Umstieg in eine andere ' + M.t('journey') + ' (ein Punkt je ' + M.t('journey') + ')')),
      el('li', null, el('span', { class: 'gm-zeit-sw is-conn', 'aria-hidden': 'true', style: { background: 'linear-gradient(' + jv(HIST[0]) + ',' + jv(HIST[Math.min(1, HIST.length - 1)]) + ')' } }), (M.t('station') + ' auf mehreren Bahnen')),
      el('li', null, el('span', { class: 'gm-zeit-sw is-span', 'aria-hidden': 'true' }), 'Zeitraum'),
      el('li', null, el('span', { class: 'gm-zeit-sw is-gap', 'aria-hidden': 'true' }), ('Lange Strecke ohne ' + M.t('station'))));
    S.legend = leg;
    wrap.appendChild(leg);
    S.note = el('p', { class: 'gm-zeit-note' },
      'Hinweis zur Zeitachse: Sie ist nicht gleichmäßig. ' + (YMIN < 500 ? 'Antike und Mittelalter sind gestaucht, das 19. und vor allem das 20. Jahrhundert sind gedehnt, damit nichts zusammenklebt. ' : 'Zeiten mit vielen Stationen sind gedehnt, ruhigere gestaucht, damit nichts zusammenklebt. ') + 'Ein kleiner Strich unter der Bahn zeigt das echte Jahr, wenn ein Knoten beiseite rücken musste.');
    wrap.appendChild(S.note);
  }

  /* ------------------------------------------------------------------ *
   * Liste (barrierefreie Alternative)
   * ------------------------------------------------------------------ */

  function buildList(wrap) {
    S.listEl = el('div', { class: 'gm-zeit-list', hidden: true });
    wrap.appendChild(S.listEl);
    S.vertEl = el('div', { class: 'gm-zeit-v', hidden: true });
    wrap.appendChild(S.vertEl);
  }

  /* ------------------------------------------------------------------ *
   * Handy-Ansicht: vertikaler Zeitstrahl (Zeit läuft von oben nach unten)
   * ------------------------------------------------------------------ */

  function phoneNow() {
    var w = 0;
    try { w = doc.documentElement.clientWidth || window.innerWidth || 0; } catch (e) { w = 0; }
    return w > 0 && w < 700;
  }

  // Ein Zustand für alle Bereiche: Handy (vertikal), Liste oder horizontaler Zeitstrahl
  function syncViewVisibility() {
    var none = S.items.length === 0;
    var phone = !!S.phone;
    var liste = S.mode === 'liste' && !phone;
    S.root.classList.toggle('is-phone', phone);
    S.btnStrahl.setAttribute('aria-pressed', liste ? 'false' : 'true');
    S.btnListe.setAttribute('aria-pressed', liste ? 'true' : 'false');
    S.frame.hidden = phone || liste || none;
    S.listEl.hidden = phone || !liste;
    S.vertEl.hidden = !phone || none;
    S.rowTools.hidden = liste || none;
    S.legend.hidden = phone || liste || none;
    S.note.hidden = phone || liste || none;
    if (S.hintEl) S.hintEl.hidden = phone || liste || none;
    if (S.empty) S.empty.hidden = !none;
  }

  function epochOfItem(it) { return epochOfYear(it.year); }

  function renderVertical() {
    var box = S.vertEl;
    box.innerHTML = '';
    var on = S.lanes.filter(function (l) { return l.on; }).map(function (l) { return l.id; });
    var items = S.items.filter(function (it) { return it.lanes.some(function (l) { return on.indexOf(l) >= 0; }); });
    var curEp = null, ol = null;
    S.vHeads = {};
    items.forEach(function (it) {
      var ep = epochOfItem(it);
      if (!curEp || curEp.id !== ep.id) {
        curEp = ep;
        var sec = el('section', { class: 'gm-zeit-v-ep', 'aria-label': ep.name });
        var h = el('h3', { class: 'gm-zeit-v-eph', dataset: { epoch: ep.id } }, ep.name, el('small', null, ep.range));
        S.vHeads[ep.id] = h;
        ol = el('ol', { class: 'gm-zeit-v-ol' });
        sec.appendChild(h); sec.appendChild(ol);
        box.appendChild(sec);
      }
      var lanes = it.lanes.filter(function (l) { return on.indexOf(l) >= 0; });
      var lane = lanes[0] || it.lanes[0];
      var cols = lanes.map(jv);
      var ring = cols.length > 1
        ? 'conic-gradient(' + cols.map(function (c, i) { return c + ' ' + (i * 100 / cols.length) + '% ' + ((i + 1) * 100 / cols.length) + '%'; }).join(',') + ')'
        : cols[0];
      var stripe = cols.length > 1
        ? 'linear-gradient(to bottom,' + cols.map(function (c, i) { return c + ' ' + (i * 100 / cols.length) + '% ' + ((i + 1) * 100 / cols.length) + '%'; }).join(',') + ')'
        : cols[0];
      var K = (M.kinds && M.kinds[it.st.kind]) || { label: '', icon: 'lightbulb' };
      var a = el('a', { href: '#/station/' + encodeURIComponent(it.id) }, it.st.title);
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        M.nav.openStation(it.id, lane);
      });
      var lanesUl = el('ul', { class: 'gm-zeit-v-lanes', 'aria-label': ('Bahnen dieser ' + M.t('station')) });
      it.lanes.forEach(function (jid) {
        lanesUl.appendChild(el('li', { style: { '--jc': jv(jid) } }, el('i', { 'aria-hidden': 'true' }), journey(jid).kurz || journey(jid).name));
      });
      var card = el('div', { class: 'gm-zeit-v-card' },
        el('p', { class: 'gm-zeit-v-year' }, el('span', null, it.yearFull), K.label ? el('span', null, '· ' + K.label) : null,
          it.myth ? el('span', { class: 'gm-zeit-stamp' }, 'überholt') : null,
          el('span', { class: 'gm-zeit-v-seen' }, '✓ besucht')),
        el('h4', { class: 'gm-zeit-v-t' }, a),
        it.st.teaser ? el('p', { class: 'gm-zeit-v-teaser' }, it.st.teaser) : null,
        lanesUl);
      if (it.func.length) {
        var xs = el('div', { class: 'gm-zeit-v-x', role: 'group', 'aria-label': (M.t('transfer') + ' zu anderen ' + M.t('journeys')) }, el('span', { class: 'gm-zeit-li-xl' }, (M.t('transfer') + ':')));
        it.func.forEach(function (jid) {
          xs.appendChild(el('button', {
            type: 'button', class: 'gm-zeit-li-x', style: { '--jc': jv(jid) },
            'aria-label': (M.t('transfer') + ' zur ' + M.t('journey') + ' „') + journey(jid).name + ('“ an der ' + M.t('station') + ' ') + it.st.title,
            on: { click: function () { M.nav.openStation(it.id, jid); } }
          }, el('i', { 'aria-hidden': 'true' }), journey(jid).kurz || journey(jid).name));
        });
        card.appendChild(xs);
      }
      var li = el('li', { class: 'gm-zeit-v-li' + (it.myth ? ' is-myth' : ''), dataset: { id: it.id }, style: { '--jc': jv(lane), '--ring': ring, '--stripe': stripe } },
        el('span', { class: 'gm-zeit-v-node', 'aria-hidden': 'true' }), card);
      ol.appendChild(li);
    });
    if (S.undated.length) box.appendChild(el('p', { class: 'gm-zeit-undated' }, 'Ohne Zeitangabe: ' + S.undated.map(function (u) { return u.st.title; }).join(' · ')));
    syncVisited();
    applyHighlight();
    onPhoneScroll();
  }

  function onPhoneScroll() {
    if (!S.phone || !S.vHeads || !S.visible) return;
    var cur = null, top = (parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 56) + 12;
    EPOCHS.forEach(function (ep) {
      var h = S.vHeads[ep.id];
      if (h && h.getBoundingClientRect().top <= top + 4) cur = ep;
    });
    if (!cur) { var f = EPOCHS.filter(function (ep) { return S.vHeads[ep.id]; })[0]; cur = f || EPOCHS[0]; }
    markEpoch(cur);
  }

  function renderList() {
    var box = S.listEl;
    box.innerHTML = '';
    var on = S.lanes.filter(function (l) { return l.on; }).map(function (l) { return l.id; });
    var items = S.items.filter(function (it) { return it.lanes.some(function (l) { return on.indexOf(l) >= 0; }); });
    if (!items.length) {
      box.appendChild(el('p', { class: 'gm-zeit-empty' }, ('Keine ' + M.t('stations') + ' für die gewählten Bahnen.')));
      return;
    }
    var curEp = null, ol = null;
    items.forEach(function (it) {
      var ep = epochOfYear(it.year);
      if (!curEp || curEp.id !== ep.id) {
        curEp = ep;
        box.appendChild(el('h3', { class: 'gm-zeit-ep-h' }, ep.name, el('small', null, ep.range)));
        ol = el('ol', { class: 'gm-zeit-ol' });
        box.appendChild(ol);
      }
      var lane = it.lanes.filter(function (l) { return on.indexOf(l) >= 0; })[0] || it.lanes[0];
      var K = (M.kinds && M.kinds[it.st.kind]) || { label: '', icon: 'lightbulb' };
      var a = el('a', { href: '#/station/' + encodeURIComponent(it.id) }, it.st.title);
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        M.nav.openStation(it.id, lane);
      });
      var meta = el('ul', { class: 'gm-zeit-li-meta', 'aria-label': (M.t('journeys') + ' und Umstiege') },
        el('li', { class: 'gm-zeit-li-kind', html: ico(K.icon, 14) + '<span>' + esc(K.label) + '</span>' }));
      it.lanes.forEach(function (jid) {
        meta.appendChild(el('li', null, M.ui && M.ui.journeyChip ? M.ui.journeyChip(jid, {}) : el('span', null, journey(jid).kurz)));
      });
      if (it.func.length) {
        meta.appendChild(el('li', { class: 'gm-zeit-li-xl' }, (M.t('transfer') + ':')));
        it.func.forEach(function (jid) {
          var b = el('button', {
            type: 'button', class: 'gm-zeit-li-x', style: { '--jc': jv(jid) },
            'aria-label': (M.t('transfer') + ' zur ' + M.t('journey') + ' „') + journey(jid).name + ('“ an der ' + M.t('station') + ' ') + it.st.title,
            on: { click: function () { M.nav.openStation(it.id, jid); } }
          }, el('i', { 'aria-hidden': 'true' }), journey(jid).kurz || journey(jid).name);
          meta.appendChild(el('li', null, b));
        });
      }
      ol.appendChild(el('li', {
        class: 'gm-zeit-li' + (it.myth ? ' is-myth' : ''), style: { '--jc': jv(lane) }, dataset: { id: it.id }
      },
        el('div', { class: 'gm-zeit-li-year' }, it.yearFull, el('span', { 'aria-hidden': 'true' })),
        el('div', { class: 'gm-zeit-li-main' },
          el('h4', { class: 'gm-zeit-li-t' }, a,
            it.myth ? el('span', { class: 'gm-zeit-stamp' }, 'Mythos · überholt') : null,
            el('span', { class: 'gm-zeit-li-seen', html: (M.ui && M.ui.icon ? M.ui.icon('check', 13) : '') + '<span>Besucht</span>' })),
          it.st.teaser ? el('p', { class: 'gm-zeit-li-teaser' }, it.st.teaser) : null,
          meta)));
    });
    if (S.undated.length) {
      box.appendChild(el('p', { class: 'gm-zeit-undated' }, 'Ohne Zeitangabe: ' + S.undated.map(function (u) { return u.st.title; }).join(' · ')));
    }
    syncVisited();
  }

  /* ------------------------------------------------------------------ *
   * Layout
   * ------------------------------------------------------------------ */

  function relax(perLane, gap, minX) {
    for (var iter = 0; iter < 600; iter++) {
      var moved = false;
      for (var li = 0; li < perLane.length; li++) {
        var arr = perLane[li];
        for (var k = 1; k < arr.length; k++) {
          var a = arr[k - 1], b = arr[k];
          var d = b.x - a.x;
          if (d < gap - 0.05) {
            var p = (gap - d) / 2;
            a.x -= p; b.x += p;
            moved = true;
          }
        }
      }
      if (!moved) break;
    }
    for (var s = 0; s < 6; s++) {
      var changed = false;
      perLane.forEach(function (arr) {
        arr.forEach(function (it, k) {
          if (it.x < minX) { it.x = minX; changed = true; }
          if (k > 0 && it.x - arr[k - 1].x < gap - 0.01) { it.x = arr[k - 1].x + gap; changed = true; }
        });
      });
      if (!changed) break;
    }
  }

  function layout() {
    if (!S.built || !S.stage) return;
    var W = S.stage.clientWidth;
    if (!W) { S.dirty = true; return; }
    S.dirty = false;
    S.lastW = W;
    var m = S.m = metrics(S.root.clientWidth || W, S.zoom);
    S.root.classList.toggle('is-small', m.small);
    S.root.classList.toggle('is-tiny', m.tiny);
    S.root.classList.toggle('is-slim', m.slim);
    syncChipLabels(m.small);
    measureLabels();
    var z = S.zoom;
    var vl = S.lanes.filter(function (l) { return l.on; });
    var laneIdx = {};
    vl.forEach(function (l, i) { laneIdx[l.id] = i; });
    var R = m.node / 2;
    var X0 = m.gutter + m.padL;
    var n = vl.length;
    function Xf(y) { return X0 + uOf(y) * z; }
    function LY(i) { return m.head + m.top + i * m.laneGap; }
    var xEnd = Xf(YMAX);
    var H = m.head + m.top + Math.max(0, n - 1) * m.laneGap + m.bot + m.ruler;
    var g = S.geo = { X0: X0, Xf: Xf, LY: LY, xEnd: xEnd, H: H, vl: vl, laneIdx: laneIdx, R: R, z: z };

    var vis = S.items.filter(function (it) { return it.lanes.some(function (l) { return laneIdx[l] !== undefined; }); });
    vis.forEach(function (it) {
      it.vl = it.lanes.filter(function (l) { return laneIdx[l] !== undefined; }).sort(function (a, b) { return laneIdx[a] - laneIdx[b]; });
      it.tx = Xf(it.year);
      it.x = it.tx;
    });
    var cmp = function (a, b) { return a.tx - b.tx || a.year - b.year || a.ord - b.ord; };
    var perLane = vl.map(function (l) { return vis.filter(function (it) { return it.vl.indexOf(l.id) >= 0; }).sort(cmp); });
    relax(perLane, m.gap, X0 - 6);

    /* Hindernisse für die Beschriftung */
    var obst = [];
    function addO(x, y, w, h, own) { obst.push({ x: x, y: y, w: w, h: h, own: own || null }); }
    function hits(r, pad, own) {
      pad = pad || 0;
      for (var i = 0; i < obst.length; i++) {
        var o = obst[i];
        if (own && o.own === own) continue;
        if (r.x - pad < o.x + o.w && r.x + r.w + pad > o.x && r.y - pad < o.y + o.h && r.y + r.h + pad > o.y) return true;
      }
      return false;
    }

    vis.forEach(function (it) {
      var topY = LY(laneIdx[it.vl[0]]);
      var botY = LY(laneIdx[it.vl[it.vl.length - 1]]);
      it.topY = topY; it.botY = botY;
      it.dotPos = [];
      it.label = null;
      it.vl.forEach(function (l) { addO(it.x - R - 4, LY(laneIdx[l]) - R - 4, 2 * R + 8, 2 * R + 8, it.id); });
      if (it.vl.length > 1) addO(it.x - 4, topY, 8, botY - topY);
      var tw, yw;
      if (S.measured && it.mTW) { tw = it.mTW; yw = it.mYW; }
      else {
        tw = textW(it.title, '600 13.8px ' + (S.fontDisplay || 'serif'));
        yw = textW(it.yearShort, '700 11.2px ' + (S.fontUI || 'sans-serif')) + (it.myth ? 72 : 0) + it.yearShort.length * 0.8;
      }
      var nat = Math.max(tw, yw) + 8;
      var yMin = Math.ceil(yw) + 6;                       // Jahr + Stempel dürfen nie überstehen
      it.lw = Math.round(Math.max(clamp(nat, 56, m.labelMax), yMin));
      it.lwNat = Math.round(Math.max(clamp(nat, 56, m.labelMax * 1.65), yMin));
    });

    /* Beschriftungen platzieren: erst Stationen auf mehreren Bahnen, dann der Rest */
    var minLeft = m.gutter + 8;
    var order = vis.slice().sort(function (a, b) {
      var ma = a.vl.length > 1 ? 0 : 1, mb = b.vl.length > 1 ? 0 : 1;
      return ma - mb || a.tx - b.tx || a.ord - b.ord;
    });
    var laneOrdinal = {};
    perLane.forEach(function (arr, li) { arr.forEach(function (it, k) { laneOrdinal[it.id + '@' + li] = k; }); });
    var LH = m.LH;
    var off1 = R + 16, off2 = off1 + LH + 6;

    function cand(it, kind, tier, align, wOverride) {
      // align: 'r' / 'l' = Beschriftung beginnt/endet am Stiel; 'R' / 'L' = Fahne: Stiel läuft neben dem Text
      var w = wOverride || it.lw, x = it.x, r, leader = null, inst, side;
      var flag = align === 'R' || align === 'L';
      var left = align === 'r' ? x - 8 : (align === 'l' ? x + 8 - w : (align === 'R' ? x + 8 : x - 8 - w));
      if (kind === 'mid') {
        var nextY = LY(laneIdx[it.vl[0]] + 1);
        var yMid = (it.topY + nextY) / 2;
        left = (align === 'r' || align === 'R') ? x + 11 : x - 11 - w;
        r = { x: left, y: yMid - LH / 2, w: w, h: LH };
        inst = instOf(it, it.vl[0]); side = 'mid';
      } else if (kind === 'up') {
        var yTop = it.topY - (tier === 1 ? off1 : off2) - LH;
        r = { x: left, y: yTop, w: w, h: LH };
        var yEnd = flag ? yTop : yTop + LH;
        leader = { x: x - 1.5, y: yEnd, w: 3, h: Math.max(0, (it.topY - R - 5) - yEnd) };
        inst = instOf(it, it.vl[0]); side = 'up';
      } else {
        var yT = it.botY + (tier === 1 ? off1 : off2);
        r = { x: left, y: yT, w: w, h: LH };
        var yE2 = flag ? yT + LH : yT;
        leader = { x: x - 1.5, y: it.botY + R + 5, w: 3, h: Math.max(0, yE2 - (it.botY + R + 5)) };
        inst = instOf(it, it.vl[it.vl.length - 1]); side = 'down';
      }
      return { rect: r, leader: leader, inst: inst, side: side, align: (align === 'r' || align === 'R') ? 'r' : 'l', flag: flag, kind: kind };
    }
    function instOf(it, lane) {
      for (var i = 0; i < it.insts.length; i++) if (it.insts[i].lane === lane) return it.insts[i];
      return it.insts[0];
    }

    order.forEach(function (it) {
      var list = [];
      if (it.vl.length > 1) {
        list.push(['mid', 0, 'r'], ['mid', 0, 'l'], ['up', 1, 'r'], ['down', 1, 'r'], ['up', 1, 'l'], ['down', 1, 'l'],
          ['up', 2, 'r'], ['down', 2, 'r'], ['up', 2, 'l'], ['down', 2, 'l'],
          ['up', 1, 'R'], ['down', 1, 'R'], ['up', 1, 'L'], ['down', 1, 'L']);
      } else {
        var li = laneIdx[it.vl[0]];
        var k = laneOrdinal[it.id + '@' + li] || 0;
        var primary = li === 0 ? 'up' : (li === n - 1 ? 'down' : 'down');
        var other = primary === 'up' ? 'down' : 'up';
        var pref = (k % 2 === 0) ? primary : other;
        var alt = pref === 'up' ? 'down' : 'up';
        list.push([pref, 1, 'r'], [alt, 1, 'r'], [pref, 2, 'r'], [alt, 2, 'r'], [pref, 1, 'l'], [alt, 1, 'l'], [pref, 2, 'l'], [alt, 2, 'l'],
          [pref, 1, 'R'], [alt, 1, 'R'], [pref, 1, 'L'], [alt, 1, 'L'], [pref, 2, 'R'], [alt, 2, 'R'], [pref, 2, 'L'], [alt, 2, 'L']);
      }
      // Erst mit dem vollen Titel versuchen (nur die nächsten Plätze), dann gekürzt
      var tries = [];
      if (it.lwNat > it.lw + 4 && z >= 0.6) {
        for (var wi = 0; wi < Math.min(list.length, 6); wi++) tries.push([list[wi], it.lwNat]);
      }
      list.forEach(function (q) { tries.push([q, it.lw]); });
      for (var c = 0; c < tries.length; c++) {
        var cd = cand(it, tries[c][0][0], tries[c][0][1], tries[c][0][2], tries[c][1]);
        if (cd.rect.x < minLeft) continue;
        if (m.tiny && cd.rect.x + cd.rect.w > W - 40) continue;   // Übersicht: Beschriftungen erzwingen kein Scrollen
        if (tries[c][1] > it.lw && cd.rect.x + cd.rect.w > xEnd + 24) continue;   // lange Beschriftung soll den Strahl nicht verlängern
        if (hits(cd.rect, 3)) continue;
        if (cd.leader && cd.leader.h > 0 && hits(cd.leader, 0)) continue;
        addO(cd.rect.x, cd.rect.y, cd.rect.w, cd.rect.h);
        if (cd.leader && cd.leader.h > 0) addO(cd.leader.x, cd.leader.y, cd.leader.w, cd.leader.h);
        it.label = cd;
        break;
      }
      placeDots(it);
    });

    // Umstiegspunkte: auf der Seite, die die Beschriftung frei lässt
    function placeDots(it) {
      var k = it.func.length;
      if (!k) return;
      var rr = R + 11;
      var rings = [R + 11, R + 28];
      var ls = it.label ? it.label.side : null;
      var multi = it.vl.length > 1;
      // Auf der Bahnlinie selbst (links/rechts) nur als letzter Ausweg
      var arcs = ls === 'up' ? ['down', 'dr', 'dl', 'right', 'left', 'up', 'ur', 'ul']
        : (ls === 'down' ? ['up', 'ur', 'ul', 'right', 'left', 'down', 'dr', 'dl']
          : (multi ? ['up', 'ur', 'ul', 'right', 'left', 'down', 'dr', 'dl'] : ['down', 'up', 'dr', 'dl', 'ur', 'ul', 'right', 'left']));
      var A0 = { down: 90, up: -90, right: 0, left: 180, dr: 45, dl: 135, ur: -45, ul: -135 };
      function pos(arc, rr) {
        var out = [];
        for (var j = 0; j < k; j++) {
          var t = j - (k - 1) / 2;
          var ang = (arc === 'left' ? 180 - t * 46 : A0[arc] + (arc === 'down' ? -t * 46 : t * 46)) * Math.PI / 180;
          out.push({ dx: rr * Math.cos(ang), dy: rr * Math.sin(ang) });
        }
        return out;
      }
      var chosen = null, bestBad = 1e9, bestPs = null;
      for (var ri = 0; ri < rings.length && !chosen; ri++) {
        for (var a = 0; a < arcs.length && !chosen; a++) {
          var ps = pos(arcs[a], rings[ri]);
          var bad = 0;
          for (var q = 0; q < ps.length; q++) {
            if (hits({ x: it.x + ps[q].dx - 7.5, y: it.topY + ps[q].dy - 7.5, w: 15, h: 15 }, 0, it.id)) bad++;
            else if (rings[ri] > R + 20) {
              // Der Stiel zum weiter entfernten Punkt soll keine Beschriftung kreuzen
              var cross = false;
              for (var fr = 0.4; fr < 0.9 && !cross; fr += 0.25) {
                if (hits({ x: it.x + ps[q].dx * fr - 3, y: it.topY + ps[q].dy * fr - 3, w: 6, h: 6 }, 0, it.id)) cross = true;
              }
              if (cross) bad++;
            }
          }
          if (!bad) chosen = ps;
          else if (bad < bestBad) { bestBad = bad; bestPs = ps; }
        }
      }
      if (!chosen) chosen = bestPs || pos(arcs[0], rr);
      it.dotPos = chosen;
      chosen.forEach(function (d) { addO(it.x + d.dx - 8.5, it.topY + d.dy - 8.5, 17, 17); });
    }

    /* Breite des Inhalts */
    var maxRight = xEnd;
    vis.forEach(function (it) {
      if (it.label) maxRight = Math.max(maxRight, it.label.rect.x + it.label.rect.w);
      maxRight = Math.max(maxRight, it.x + 40);
    });
    var Wc = Math.ceil(maxRight + 36);
    var cv = S.canvas;
    cv.style.width = Wc + 'px';
    cv.style.height = H + 'px';
    cv.style.setProperty('--n', m.node + 'px');
    cv.style.setProperty('--gut', m.gutter + 'px');
    S.gutter.style.width = m.gutter + 'px';
    S.gutter.style.height = H + 'px';
    S.bands.style.width = Wc + 'px';
    S.bands.style.height = H + 'px';
    S.lanesHost.style.height = H + 'px';
    S.svg.setAttribute('width', Wc);
    S.svg.setAttribute('height', H);
    S.svg.setAttribute('viewBox', '0 0 ' + Wc + ' ' + H);
    S.stage.style.height = (H + 14) + 'px';
    S.W = Wc;

    /* DOM der Knoten */
    HIST.forEach(function (jid) {
      var on = laneIdx[jid] !== undefined;
      S.laneUl[jid].hidden = !on;
    });
    S.insts.forEach(function (inst) {
      var it = inst.item;
      var on = laneIdx[inst.lane] !== undefined;
      inst.li.hidden = !on;
      if (!on) return;
      inst.x = it.x;
      inst.y = LY(laneIdx[inst.lane]);
      inst.li.style.left = r1(inst.x) + 'px';
      inst.li.style.top = inst.y + 'px';
      var lab = it.label && it.label.inst === inst ? it.label : null;
      if (lab) {
        var rc = lab.rect;
        inst.label.hidden = false;
        inst.label.className = 'gm-zeit-label is-' + (lab.side === 'mid' ? 'mid' : lab.side) + (lab.align === 'l' ? ' is-l' : '') + (lab.flag ? ' is-flag' : '');
        inst.label.style.left = r1(rc.x - inst.x + R) + 'px';
        inst.label.style.top = r1(rc.y - inst.y + R) + 'px';
        inst.label.style.width = rc.w + 'px';
        inst.label.style.height = rc.h + 'px';
        if (lab.leader && lab.leader.h > 0) {
          inst.leader.hidden = false;
          inst.leader.style.top = r1(lab.leader.y - inst.y + R) + 'px';
          inst.leader.style.height = r1(lab.leader.h) + 'px';
        } else inst.leader.hidden = true;
      } else {
        inst.label.hidden = true;
        inst.leader.hidden = true;
      }
    });
    // Umstiegspunkte an den obersten sichtbaren Knoten hängen
    vis.forEach(function (it) {
      if (!it.dotsEl) return;
      var anchor = instOf(it, it.vl[0]);
      if (it.dotsEl.parentNode !== anchor.li) anchor.li.appendChild(it.dotsEl);
      it.dots.forEach(function (d, j) {
        var p = it.dotPos[j];
        d.style.left = r1(p.dx) + 'px';
        d.style.top = r1(p.dy) + 'px';
      });
    });
    S.items.forEach(function (it) { if (it.dotsEl && vis.indexOf(it) < 0 && it.dotsEl.parentNode) it.dotsEl.parentNode.removeChild(it.dotsEl); });

    drawBands(g);
    drawGutter(g);
    drawSvg(g, vis, perLane);
    ensureActive();
    applyHighlight();
    updateReadout();
    updateUiState();
    onScroll();
  }

  function drawGutter(g) {
    HIST.forEach(function (jid) {
      var tag = S.tags[jid];
      var i = g.laneIdx[jid];
      if (i === undefined) { tag.hidden = true; return; }
      tag.hidden = false;
      var y = g.LY(i);
      tag.style.top = (y - (S.m.slim ? 18 : 21)) + 'px';
    });
  }

  function drawBands(g) {
    var out = S.bands;
    out.innerHTML = '';
    EPOCHS.forEach(function (ep, i) {
      var x1 = i === 0 ? 0 : g.Xf(ep.from);
      var x2 = i === EPOCHS.length - 1 ? S.W : g.Xf(ep.to);
      var w = x2 - x1;
      var vw = i === 0 ? w - S.m.gutter : w;      // sichtbare Breite ohne Gutter
      var narrow = vw < 100;
      var hideName = vw < 28;
      var title = vw >= 230 ? ep.name : ep.short;
      var showRange = vw >= 118 && vw >= ep.range.length * 8.6 + 24;
      var b = el('div', { class: 'gm-zeit-band' + (i % 2 ? ' is-odd' : '') + (narrow ? ' is-narrow' : ''), dataset: { epoch: ep.id } },
        hideName ? null : el('div', { class: 'gm-zeit-band-name', style: { maxWidth: Math.max(40, vw - 14) + 'px' } },
          el('span', { class: 'gm-zeit-band-t' }, title),
          showRange ? el('span', { class: 'gm-zeit-band-r' }, ep.range) : null));
      b.style.left = r1(x1) + 'px';
      b.style.width = r1(w) + 'px';
      out.appendChild(b);
    });
  }

  var STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

  function drawSvg(g, vis, perLane) {
    var z = g.z, R = g.R, p = [];
    var tickYear = function (y) { return y < 0 ? Math.abs(y) + ' v. Chr.' : String(y); };

    /* Verbindungen zwischen Bahnen */
    var defs = [], conns = [];
    var gi = 0;
    vis.forEach(function (it) {
      if (it.vl.length < 2) return;
      var id = 'gmz-g' + (gi++);
      var y1 = it.topY, y2 = it.botY;
      var stops = it.vl.map(function (l, k) {
        return '<stop offset="' + (it.vl.length === 1 ? 0 : k / (it.vl.length - 1)) + '" style="stop-color:' + jv(l) + '"/>';
      }).join('');
      defs.push('<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="0" y1="' + y1 + '" x2="0" y2="' + y2 + '">' + stops + '</linearGradient>');
      conns.push('<path class="gm-zeit-conn-bg" d="M' + r1(it.x) + ' ' + y1 + 'V' + y2 + '"/><path class="gm-zeit-conn" stroke="url(#' + id + ')" d="M' + r1(it.x) + ' ' + y1 + 'V' + y2 + '"/>');
    });
    p.push('<defs>' + defs.join('') + '</defs>');

    /* Bahnen */
    g.vl.forEach(function (l, li) {
      var y = g.LY(li);
      var arr = perLane[li];
      var out = ['<g class="gm-zeit-g" data-lane="' + l.id + '" style="--jc:' + jv(l.id) + '">'];
      // Zeiträume
      arr.forEach(function (it) {
        if (!it.span) return;
        var x1 = g.Xf(it.span.from), x2 = g.Xf(it.span.to);
        if (x2 - x1 < 30) return;
        out.push('<rect class="gm-zeit-span' + (it.myth ? ' is-myth' : '') + '" x="' + r1(x1) + '" y="' + (y - 9) + '" width="' + r1(x2 - x1) + '" height="18" rx="9"/>');
      });
      var solid = '', dotted = '', cur = null;
      if (arr.length) {
        var first = arr[0].x, last = arr[arr.length - 1].x;
        out.push('<path class="gm-zeit-ll is-lead" d="M' + r1(g.X0 - 22) + ' ' + y + 'H' + r1(first) + '"/>');
        out.push('<path class="gm-zeit-ll is-lead" d="M' + r1(last) + ' ' + y + 'H' + r1(g.xEnd) + '"/>');
        for (var k = 0; k < arr.length - 1; k++) {
          var a = arr[k], b = arr[k + 1];
          // Lücke gilt nur, wenn kein Zeitraum sie überbrückt
          var bridged = arr.some(function (q) { return q.span && g.Xf(q.span.from) <= a.x + 1 && g.Xf(q.span.to) >= b.x - 1; });
          if (b.x - a.x > GAP_PX && !bridged) {
            dotted += 'M' + r1(a.x) + ' ' + y + 'H' + r1(b.x);
            cur = null;
          } else {
            if (cur === null) { solid += 'M' + r1(a.x) + ' ' + y; }
            solid += 'H' + r1(b.x);
            cur = b.x;
          }
        }
      } else {
        out.push('<path class="gm-zeit-ll is-lead" d="M' + r1(g.X0 - 22) + ' ' + y + 'H' + r1(g.xEnd) + '"/>');
      }
      if (solid) out.push('<path class="gm-zeit-ll-sh" transform="translate(0 2)" d="' + solid + '"/><path class="gm-zeit-ll" d="' + solid + '"/>');
      if (dotted) out.push('<path class="gm-zeit-ll is-dots" d="' + dotted + '"/>');
      // Striche für das echte Jahr bei verschobenen Knoten
      arr.forEach(function (it) {
        if (Math.abs(it.x - it.tx) > 5) {
          out.push('<path class="gm-zeit-tick" d="M' + r1(it.tx) + ' ' + (y + 5) + 'V' + (y + 13) + '"/><circle class="gm-zeit-tickdot" cx="' + r1(it.tx) + '" cy="' + (y + 14) + '" r="1.6"/>');
        }
      });
      out.push('</g>');
      p.push(out.join(''));
    });
    p.push('<g class="gm-zeit-connects">' + conns.join('') + '</g>');

    /* Stiele für weiter entfernte Umstiegspunkte (damit klar bleibt, zu welchem Knoten sie gehören) */
    var stalks = [];
    vis.forEach(function (it) {
      (it.dotPos || []).forEach(function (d, j) {
        var dist = Math.sqrt(d.dx * d.dx + d.dy * d.dy);
        if (dist < R + 20 || !it.func[j]) return;
        var k = (dist - 7) / dist;
        stalks.push('<path class="gm-zeit-stalk" style="stroke:' + jv(it.func[j]) + '" d="M' + r1(it.x) + ' ' + r1(it.topY) + 'l' + r1(d.dx * k) + ' ' + r1(d.dy * k) + '"/>');
      });
    });
    if (stalks.length) p.push('<g class="gm-zeit-stalks">' + stalks.join('') + '</g>');

    /* Lineal */
    var yb = g.H - S.m.ruler + 16;
    var ruler = ['<g class="gm-zeit-ruler">'];
    ruler.push('<path class="gm-zeit-rl" d="M' + r1(g.X0 - 22) + ' ' + yb + 'H' + r1(g.xEnd) + '"/>');
    var lastLabel = -1e9;
    SEGS.forEach(function (sg, si) {
      var ppy = sg.d * z;
      var step = STEPS[STEPS.length - 1];
      for (var i = 0; i < STEPS.length; i++) if (STEPS[i] * ppy >= 78) { step = STEPS[i]; break; }
      var minor = 0;
      for (var q = 0; q < STEPS.length; q++) {
        if (STEPS[q] < step && step % STEPS[q] === 0 && STEPS[q] * ppy >= 15) { minor = STEPS[q]; break; }
      }
      var unit = minor || step;
      var y0 = Math.ceil(sg.from / unit) * unit;
      for (var yr = y0; yr < sg.to || (si === SEGS.length - 1 && yr <= YMAX - 2); yr += unit) {
        var x = g.Xf(yr);
        var isMajor = yr % step === 0;
        ruler.push('<path class="gm-zeit-rtk' + (isMajor ? '' : ' is-minor') + '" d="M' + r1(x) + ' ' + yb + 'v' + (isMajor ? 9 : 5) + '"/>');
        if (isMajor && x - lastLabel >= 66 && yr <= NOW + 1) {
          ruler.push('<text class="gm-zeit-rt" x="' + r1(x) + '" y="' + (yb + 25) + '">' + tickYear(yr) + '</text>');
          lastLabel = x;
        }
      }
      // Maßstabsbruch an der Grenze zu einem deutlich anderen Maßstab
      if (si > 0) {
        var prev = SEGS[si - 1];
        var ratio = Math.max(sg.d / prev.d, prev.d / sg.d);
        if (ratio >= 2.2) {
          var bx = g.Xf(sg.from);
          ruler.push('<path class="gm-zeit-brk-bg" d="M' + r1(bx - 3) + ' ' + (yb - 7) + 'l6 14"/><path class="gm-zeit-brk" d="M' + r1(bx - 3) + ' ' + (yb - 7) + 'l6 14"/>');
        }
      }
    });
    ruler.push('</g>');
    p.push(ruler.join(''));
    S.svg.innerHTML = p.join('');
  }

  /* ------------------------------------------------------------------ *
   * Zoom, Scrollen, Sprünge
   * ------------------------------------------------------------------ */

  function viewW() { return S.stage.clientWidth; }

  function yearAtScreen(px) {
    var g = S.geo;
    var xs = S.stage.scrollLeft + px;
    return yOfU((xs - g.X0) / S.zoom);
  }

  // Rechte Kante der Knoten bei Zoom z (nach dem Auseinanderschieben dichter Stationen)
  function extentAt(z, m) {
    var X0 = m.gutter + m.padL;
    var vl = S.lanes.filter(function (l) { return l.on; });
    var vis = S.items.filter(function (it) { return it.lanes.some(function (l) { return vl.some(function (q) { return q.id === l; }); }); });
    var per = vl.map(function (l) {
      return vis.filter(function (it) { return it.lanes.indexOf(l.id) >= 0; }).sort(function (a, b) { return a.year - b.year || a.ord - b.ord; });
    });
    vis.forEach(function (it) { it.x = X0 + uOf(it.year) * z; });
    relax(per, m.gap, X0 - 6);
    var mx = X0 + SEGS.total * z * 0.0;
    vis.forEach(function (it) { if (it.x > mx) mx = it.x; });
    return mx;
  }
  // Größter Zoom, bei dem alles (auch die nach rechts geschobenen Knoten samt letzter Beschriftung) ins Bild passt
  function fitZoom() {
    var rw = S.root.clientWidth || viewW() || 1000;
    var base = metrics(rw, 1);
    function fits(z) { return extentAt(z, metrics(rw, z)) <= viewW() - (z < TINY_Z ? 80 : Math.min(150, base.labelMax) + 24); }
    var lo, hi;
    if (fits(TINY_Z)) { lo = TINY_Z; hi = 1.2; }
    else { lo = ZMIN; hi = TINY_Z - 0.001; if (!fits(lo)) return lo; }
    for (var i = 0; i < 14; i++) {
      var mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid; else hi = mid;
    }
    return clamp(lo, ZMIN, ZMAX);
  }

  var zoomPending = null;
  function setZoom(nz, anchorPx, instant) {
    nz = clamp(nz, ZMIN, ZMAX);
    if (!S.geo) { S.zoom = nz; return; }
    if (Math.abs(nz - S.zoom) < 0.0005) return;
    var m = S.m;
    if (anchorPx === undefined) anchorPx = m.gutter + (viewW() - m.gutter) / 2;
    var yr = yearAtScreen(anchorPx);
    S.jumpEp = null;
    S.zoom = nz;
    S.zoomSet = true;
    layout();
    S.stage.scrollLeft = S.geo.Xf(yr) - anchorPx;
    onScroll();
  }
  function queueZoom(nz, anchorPx) {
    zoomPending = { z: nz, a: anchorPx };
    if (queueZoom.raf) return;
    queueZoom.raf = requestAnimationFrame(function () {
      queueZoom.raf = 0;
      var q = zoomPending; zoomPending = null;
      if (q) setZoom(q.z, q.a);
    });
  }
  function zoomBy(f, anchorPx) {
    setZoom(S.zoom * f, anchorPx);
    announce('Zoom ' + Math.round(S.zoom * 100) + ' Prozent');
  }

  function scrollToX(x, smooth) {
    var left = Math.max(0, x);
    try { S.stage.scrollTo({ left: left, behavior: smooth && !reduced() ? 'smooth' : 'auto' }); }
    catch (e) { S.stage.scrollLeft = left; }
  }
  function jumpTo(ep) {
    if (S.phone) {
      // erste vorhandene Überschrift ab dieser Epoche
      var h = null;
      for (var i = EPOCHS.indexOf(ep); i < EPOCHS.length && !h; i++) h = S.vHeads && S.vHeads[EPOCHS[i].id];
      if (h) {
        var hh = parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 56;
        var y = h.getBoundingClientRect().top + window.pageYOffset - hh;
        try { window.scrollTo({ top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, y); }
      }
      markEpoch(ep);
      announce('Epoche: ' + ep.name + ', ' + ep.range);
      return;
    }
    if (S.mode !== 'strahl') { S.mode = 'strahl'; applyMode(); }
    var g = S.geo;
    if (!g) return;
    var x = ep.from <= YMIN ? 0 : g.Xf(ep.from) - S.m.gutter - 18;
    S.jumpEp = ep.id;
    scrollToX(x, true);
    markEpoch(ep);
    announce('Epoche: ' + ep.name + ', ' + ep.range);
  }
  function scrollByPage(dir) {
    S.jumpEp = null;
    var w = viewW() - S.m.gutter;
    scrollToX(S.stage.scrollLeft + dir * w * 0.8, true);
  }
  function ensureVisible(x, smooth) {
    var left = S.stage.scrollLeft + S.m.gutter + 30;
    var right = S.stage.scrollLeft + viewW() - 40;
    if (x - 90 < left || x + 190 > right) {
      scrollToX(x - (viewW() + S.m.gutter) / 2, smooth !== false);
    }
  }

  function onScroll() {
    if (!S.geo || !S.stage) return;
    var sl = S.stage.scrollLeft;
    S.gutter.classList.toggle('has-shadow', sl > 4);
    if (S.btnLeft) {
      S.btnLeft.disabled = sl <= 2;
      S.btnRight.disabled = sl >= S.stage.scrollWidth - S.stage.clientWidth - 2;
    }
    var cur = epochOfYear(yearAtScreen(S.m.gutter + 40));
    if (S.jumpEp) {
      // Nach einem Sprung bleibt die gewählte Epoche markiert, solange sie im Bild ist
      var je = EPOCHS.filter(function (e) { return e.id === S.jumpEp; })[0];
      var g = S.geo;
      var x1 = je.from <= YMIN ? 0 : g.Xf(je.from), x2 = je.to >= YMAX ? S.W : g.Xf(je.to);
      var v1 = sl + S.m.gutter + 24, v2 = sl + viewW() - 24;
      var overlap = Math.min(x2, v2) - Math.max(x1, v1);
      if (overlap >= Math.min(60, (x2 - x1) * 0.6)) cur = je; else S.jumpEp = null;
    }
    markEpoch(cur);
    if (S.tipFor) positionTip();
    if (S.frame) S.frame.classList.toggle('has-more', sl < S.stage.scrollWidth - S.stage.clientWidth - 6);
  }
  function markEpoch(cur) {
    S.jumpBtns.forEach(function (j) {
      var on = j.ep.id === cur.id;
      j.btn.classList.toggle('is-current', on);
      if (on) j.btn.setAttribute('aria-current', 'true'); else j.btn.removeAttribute('aria-current');
    });
  }

  function updateReadout() {
    if (S.readout) S.readout.textContent = Math.round(S.zoom * 100) + ' %';
    if (S.btnIn) { S.btnIn.disabled = S.zoom >= ZMAX - 0.001; S.btnOut.disabled = S.zoom <= ZMIN + 0.001; }
  }

  /* ------------------------------------------------------------------ *
   * Bahnen, Modus, Hervorhebung, Besucht
   * ------------------------------------------------------------------ */

  function syncChipLabels(small) {
    S.lanes.forEach(function (l) {
      var lab = l.chip && l.chip.querySelector('.gm-chip-label');
      if (!lab || !l.full) return;
      var want = small ? l.short : l.full;
      if (lab.textContent !== want) lab.textContent = want;
    });
  }

  function toggleLane(id) {
    var l = S.lanes.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    var onCount = S.lanes.filter(function (x) { return x.on; }).length;
    if (l.on && onCount <= 1) {
      announce('Mindestens eine Bahn bleibt sichtbar.');
      if (M.toast) M.toast('Mindestens eine Bahn bleibt sichtbar.');
      return;
    }
    l.on = !l.on;
    hideTip(); hideSheet();
    var chip = S.laneChips[id];
    chip.setAttribute('aria-pressed', l.on ? 'true' : 'false');
    chip.classList.toggle('is-active', l.on);
    S.introOff();
    if (S.phone) renderVertical(); else if (S.mode === 'strahl') layout(); else renderList();
    updateUiState();
    var visN = S.items.filter(function (it) { return it.lanes.some(function (x) { return S.lanes.some(function (q) { return q.id === x && q.on; }); }); }).length;
    announce('Bahn „' + journey(id).name + '“ ' + (l.on ? 'eingeblendet' : 'ausgeblendet') + '. ' + visN + (' ' + M.t('stations') + ' sichtbar.'));
  }

  function applyMode(initial) {
    var liste = S.mode === 'liste';
    syncViewVisibility();
    if (S.sheet && (liste || S.phone)) hideSheet();
    hideTip();
    if (S.phone) { if (S.visible || !initial) renderVertical(); }
    else if (liste) renderList();
    else if (S.visible || !initial) layout();
    if (!initial) {
      try { if (M.store && M.store.set) M.store.set('zeitMode', S.mode); } catch (e) { /* egal */ }
      announce(liste ? 'Ansicht: Liste, chronologisch' : ('Ansicht: ' + M.t('timeline')));
    }
    updateUiState();
  }

  function updateUiState() {
    if (!S.countEl) return;
    var on = S.lanes.filter(function (l) { return l.on; }).map(function (l) { return l.id; });
    var vis = S.items.filter(function (it) { return it.lanes.some(function (l) { return on.indexOf(l) >= 0; }); });
    var seen = vis.filter(function (it) { return M.store && M.store.isVisited(it.id); }).length;
    S.countEl.innerHTML = '<strong>' + vis.length + ('</strong> ' + M.t('stations') + ' auf ') + on.length + ' Bahn' + (on.length === 1 ? '' : 'en') +
      ' · davon <strong>' + seen + '</strong> von dir besucht';
    if (S.vertEl) syncViewVisibility();
  }

  function syncVisited() {
    if (!M.store) return;
    S.items.forEach(function (it) {
      var v = M.store.isVisited(it.id);
      (it.insts || []).forEach(function (inst) {
        inst.li.classList.toggle('is-visited', v);
        inst.vis.textContent = v ? ' Von dir besucht.' : '';
      });
    });
    if (S.vertEl) {
      [].forEach.call(S.vertEl.querySelectorAll('.gm-zeit-v-li'), function (li) {
        li.classList.toggle('is-visited', M.store.isVisited(li.getAttribute('data-id')));
      });
    }
    if (S.listEl) {
      [].forEach.call(S.listEl.querySelectorAll('.gm-zeit-li'), function (li) {
        li.classList.toggle('is-visited', M.store.isVisited(li.getAttribute('data-id')));
      });
    }
    updateUiState();
  }

  function applyHighlight() {
    var id = S.hl;
    S.insts.forEach(function (inst) {
      var dim = false, hl = false;
      if (id) {
        if (isHist(id)) { dim = inst.lane !== id; hl = !dim; }
        else { hl = (inst.item.st.journeys || []).indexOf(id) >= 0; dim = !hl; }
      }
      inst.li.classList.toggle('is-dim', dim);
      inst.li.classList.toggle('is-hl', hl);
    });
    S.items.forEach(function (it) {
      (it.dots || []).forEach(function (d) { d.classList.toggle('is-hl', !!id && d._jid === id); });
    });
    if (S.vertEl) {
      [].forEach.call(S.vertEl.querySelectorAll('.gm-zeit-v-li'), function (li) {
        var it = S.byId[li.getAttribute('data-id')];
        var dim = false;
        if (id && it) dim = (it.st.journeys || []).indexOf(id) < 0;
        li.classList.toggle('is-dim', dim);
      });
    }
    [].forEach.call(S.svg.querySelectorAll('.gm-zeit-g'), function (gEl) {
      gEl.classList.toggle('is-dim', !!id && isHist(id) && gEl.getAttribute('data-lane') !== id);
    });
    // Hinweisleiste
    S.hlBar.innerHTML = '';
    if (id) {
      S.hlBar.hidden = false;
      S.hlBar.appendChild(el('span', null, isHist(id) ? 'Hervorgehoben ist die Bahn' : ('Hervorgehoben sind ' + M.t('stations') + ' der ' + M.t('journey'))));
      S.hlBar.appendChild(M.ui && M.ui.journeyChip ? M.ui.journeyChip(id, { active: true }) : el('strong', null, journey(id).name));
      S.hlBar.appendChild(el('button', { type: 'button', class: 'gm-btn gm-btn-ghost', style: { minHeight: '38px', padding: '.3rem 1rem' }, on: { click: function () { highlightJourney(null); } } }, 'Hervorhebung aufheben'));
    } else S.hlBar.hidden = true;
  }

  function highlightJourney(id) {
    S.hl = id || null;
    if (S.built) applyHighlight();
    if (S.hl) announce('Hervorgehoben: ' + journey(S.hl).name);
  }

  /* ------------------------------------------------------------------ *
   * Aktiver Knoten (Roving Tabindex)
   * ------------------------------------------------------------------ */

  function laneInsts(jid) {
    return S.insts.filter(function (i) { return i.lane === jid && !i.li.hidden; }).sort(function (a, b) { return a.x - b.x || a.item.ord - b.item.ord; });
  }
  function setActive(inst) {
    if (!inst) return;
    if (S.active && S.active !== inst) S.active.btn.tabIndex = -1;
    S.active = inst;
    inst.btn.tabIndex = 0;
    S.items.forEach(function (it) {
      (it.dots || []).forEach(function (d) { d.tabIndex = it === inst.item ? 0 : -1; });
    });
  }
  function ensureActive() {
    if (S.active && !S.active.li.hidden) { setActive(S.active); return; }
    var first = null;
    for (var i = 0; i < S.lanes.length && !first; i++) {
      if (S.lanes[i].on) { var a = laneInsts(S.lanes[i].id); if (a.length) first = a[0]; }
    }
    if (first) setActive(first);
  }
  function focusInst(inst, byKey) {
    if (!inst) return;
    setActive(inst);
    ensureVisible(inst.x, true);
    try { inst.btn.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    if (byKey) showTip(inst.btn);
  }

  /* ------------------------------------------------------------------ *
   * Vorschau (Maus: Tooltip, Touch: Bottom-Sheet)
   * ------------------------------------------------------------------ */

  function lanesList(it) {
    var ul = el('ul', { class: 'gm-zeit-pv-lanes', 'aria-label': (M.t('journeys') + ' dieser ' + M.t('station')) });
    it.st.journeys.forEach(function (jid) {
      if (!M.data.journeyById || !M.data.journeyById[jid] || M.data.journeyById[jid].virtual) return;
      ul.appendChild(el('li', { style: { '--jc': jv(jid) } }, el('i', { 'aria-hidden': 'true' }), journey(jid).kurz || journey(jid).name));
    });
    return ul;
  }

  function previewEl(it, withLanes) {
    var st = it.st;
    var K = (M.kinds && M.kinds[st.kind]) || { label: '', icon: 'lightbulb' };
    var box = el('div', { class: 'gm-zeit-pv' });
    box.appendChild(el('p', { class: 'gm-zeit-pv-meta' },
      el('span', { class: 'gm-zeit-pv-kind', html: ico(K.icon, 14) + '<span>' + esc(K.label) + '</span>' }),
      el('span', { class: 'gm-zeit-pv-year' }, it.yearFull),
      it.myth ? el('span', { class: 'gm-zeit-stamp' }, 'Mythos · überholt') : null));
    box.appendChild(el('p', { class: 'gm-zeit-pv-title' }, st.title));
    if (st.teaser) box.appendChild(el('p', { class: 'gm-zeit-pv-teaser' }, st.teaser));
    if (it.myth && st.myth && st.myth.glaube) {
      box.appendChild(el('p', { class: 'gm-zeit-pv-myth' }, el('strong', null, 'Man glaubte: '), st.myth.glaube));
    }
    if (withLanes !== false) box.appendChild(lanesList(it));
    return box;
  }

  var tipTimer = 0;
  function showTip(target, delay) {
    clearTimeout(tipTimer);
    var go = function () {
      var tip = S.tip;
      tip.innerHTML = '';
      var jc, hint;
      if (target.classList.contains('gm-zeit-dot')) {
        var it = target._item, j = journey(target._jid);
        jc = jv(target._jid);
        tip.appendChild(el('p', { class: 'gm-zeit-pv-dotx' }, M.t('transfer')));
        tip.appendChild(el('p', { class: 'gm-zeit-pv-title' }, j.name));
        tip.appendChild(el('p', { class: 'gm-zeit-pv-teaser' }, target._sentence || ('Diese ' + M.t('station') + ' gehört auch zu dieser ' + M.t('journey') + '.')));
        hint = 'Klicken: „' + it.title + ('“ in dieser ' + M.t('journey') + ' öffnen');
      } else {
        var inst = target._inst;
        if (!inst) return;
        jc = jv(inst.lane);
        tip.appendChild(previewEl(inst.item, true));
        hint = ('Klicken oder Eingabetaste: ' + M.t('station') + ' öffnen');
      }
      tip.appendChild(el('p', { class: 'gm-zeit-pv-hint' }, hint));
      tip.style.setProperty('--jc', jc);
      S.tipFor = target;
      positionTip();
      tip.classList.add('is-on');
    };
    if (delay) tipTimer = setTimeout(go, delay); else go();
  }
  function positionTip() {
    var tip = S.tip, target = S.tipFor;
    if (!target || !target.isConnected) { hideTip(); return; }
    var fr = S.frame.getBoundingClientRect();
    var tr = target.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var cx = tr.left + tr.width / 2 - fr.left;
    var x = clamp(cx - tw / 2, 8, Math.max(8, fr.width - tw - 8));
    var above = tr.top - fr.top;
    var below = fr.bottom - tr.bottom;
    var y;
    if (above >= th + 18) y = tr.top - fr.top - th - 14;
    else if (below >= th + 18) y = tr.bottom - fr.top + 14;
    else y = clamp(tr.top - fr.top - th / 2, 8, Math.max(8, fr.height - th - 8));
    // Sichtbarer Bereich der Bühne einhalten (Gutter verdeckt links)
    tip.style.left = Math.round(x) + 'px';
    tip.style.top = Math.round(y) + 'px';
  }
  function hideTip() {
    clearTimeout(tipTimer);
    S.tipFor = null;
    if (S.tip) S.tip.classList.remove('is-on');
  }

  var sheetFor = null;
  function showSheet(inst) {
    hideTip();
    var it = inst.item;
    sheetFor = inst;
    var sh = S.sheet;
    sh.innerHTML = '';
    sh.style.setProperty('--jc', jv(inst.lane));
    sh.setAttribute('aria-label', 'Vorschau: ' + it.st.title);
    sh.appendChild(el('span', { class: 'gm-zeit-grab', 'aria-hidden': 'true' }));
    sh.appendChild(el('button', {
      type: 'button', class: 'gm-iconbtn gm-zeit-sheet-x', 'aria-label': 'Vorschau schließen', html: ico('close', 22),
      on: { click: function () { hideSheet(true); } }
    }));
    sh.appendChild(previewEl(it, true));
    var act = el('div', { class: 'gm-zeit-sheet-act' });
    act.appendChild(el('button', {
      type: 'button', class: 'gm-btn gm-btn-primary',
      on: { click: function () { var l = inst.lane; hideSheet(); M.nav.openStation(it.id, l); } }
    }, el('span', null, (M.t('station') + ' öffnen')), el('span', { html: ico('arrow-right', 18), 'aria-hidden': 'true' })));
    it.func.forEach(function (jid) {
      var sentence = (it.st.cross && it.st.cross[jid]) || '';
      act.appendChild(el('button', {
        type: 'button', class: 'gm-btn gm-btn-ghost gm-zeit-xbtn', style: { '--jc': jv(jid) },
        on: { click: function () { hideSheet(); M.nav.openStation(it.id, jid); } }
      }, el('span', { class: 'gm-zeit-xdot', 'aria-hidden': 'true' }),
        el('span', null, (M.t('transfer') + ': ') + journey(jid).name, sentence ? el('small', null, sentence) : null)));
    });
    sh.appendChild(act);
    sh.classList.add('is-on');
    sh.scrollTop = 0;
    // Fokus erst setzen, wenn die Fläche sichtbar ist (visibility wird animiert)
    setTimeout(function () {
      if (sheetFor !== inst) return;
      try { sh.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    }, 40);
    // Die gewählte Station soll nicht hinter dem Sheet verschwinden
    try {
      var nr = inst.btn.getBoundingClientRect();
      var limit = window.innerHeight - sh.offsetHeight - 16;
      if (nr.bottom > limit) window.scrollBy({ top: Math.ceil(nr.bottom - limit), left: 0, behavior: reduced() ? 'auto' : 'smooth' });
    } catch (e) { /* egal */ }
    announce('Vorschau: ' + it.st.title + ', ' + it.yearFull);
  }
  function hideSheet(restore) {
    if (!S.sheet || !S.sheet.classList.contains('is-on')) { sheetFor = null; return; }
    S.sheet.classList.remove('is-on');
    var f = sheetFor;
    sheetFor = null;
    if (restore && f && f.btn.isConnected) { try { f.btn.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
  }

  /* ------------------------------------------------------------------ *
   * Ereignisse
   * ------------------------------------------------------------------ */

  function bindToolbar() {
    S.btnStrahl.addEventListener('click', function () { if (S.mode !== 'strahl') { S.mode = 'strahl'; applyMode(); } });
    S.btnListe.addEventListener('click', function () { if (S.mode !== 'liste') { S.mode = 'liste'; applyMode(); } });
    S.btnIn.addEventListener('click', function () { zoomBy(1.3); });
    S.btnOut.addEventListener('click', function () { zoomBy(1 / 1.3); });
    S.btnFit.addEventListener('click', function () {
      setZoom(fitZoom(), S.m.gutter + 10);
      // Beschriftungen am rechten Rand dürfen kein Scrollen erzwingen: bei Überstand etwas weiter herauszoomen
      for (var q = 0; q < 4 && S.stage.scrollWidth > S.stage.clientWidth + 1 && S.zoom > ZMIN + 0.002; q++) {
        setZoom(S.zoom * Math.max(0.85, (S.stage.clientWidth - 2) / S.stage.scrollWidth), S.m.gutter + 10);
      }
      S.stage.scrollLeft = 0;
      announce('Alles auf einen Blick, Zoom ' + Math.round(S.zoom * 100) + ' Prozent');
    });
    S.btnLeft.addEventListener('click', function () { scrollByPage(-1); });
    S.btnRight.addEventListener('click', function () { scrollByPage(1); });
  }

  function bindStage() {
    var stage = S.stage;
    var ptrs = {};
    var drag = null;
    var pinch = null;
    var suppress = false;
    var inertia = 0;

    stage.addEventListener('scroll', function () {
      if (!bindStage.ticking) {
        bindStage.ticking = true;
        requestAnimationFrame(function () { bindStage.ticking = false; onScroll(); });
      }
    }, { passive: true });

    function stopInertia() { if (inertia) { cancelAnimationFrame(inertia); inertia = 0; } }
    function count() { return Object.keys(ptrs).length; }
    function dist() {
      var k = Object.keys(ptrs);
      var a = ptrs[k[0]], b = ptrs[k[1]];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2 };
    }

    doc.addEventListener('pointerdown', function (e) { S.lastPtr = e.pointerType || 'mouse'; }, true);
    doc.addEventListener('keydown', function (e) { if (e.key === 'Tab' || e.key.indexOf('Arrow') === 0 || e.key === 'Enter') S.lastPtr = 'key'; }, true);

    stage.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;   // Touch/Stift: native Scroll-Mechanik des Browsers, Pinch über Touch-Ereignisse
      if (e.button !== 0) return;
      S.jumpEp = null;
      stopInertia();
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (count() === 2) {
        var dd = dist();
        pinch = { d0: dd.d || 1, z0: S.zoom };
        drag = null;
        hideTip();
      } else if (count() === 1) {
        drag = { id: e.pointerId, x0: e.clientX, s0: stage.scrollLeft, moved: false, lx: e.clientX, lt: performance.now(), v: 0, type: e.pointerType };
      }
    });
    stage.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId].x = e.clientX; ptrs[e.pointerId].y = e.clientY;
      if (pinch && count() === 2) {
        var dd = dist();
        var rect = stage.getBoundingClientRect();
        queueZoom(pinch.z0 * (dd.d / pinch.d0), dd.mx - rect.left);
        e.preventDefault();
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.x0;
      if (!drag.moved && Math.abs(dx) > 6) {
        drag.moved = true;
        try { stage.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
        stage.classList.add('is-drag');
        hideTip();
        hideSheet();
      }
      if (drag.moved) {
        stage.scrollLeft = drag.s0 - dx;
        var now = performance.now();
        var dt = now - drag.lt;
        if (dt > 0) drag.v = 0.8 * drag.v + 0.2 * ((drag.lx - e.clientX) / dt);
        drag.lx = e.clientX; drag.lt = now;
      }
    });
    function end(e) {
      var had = ptrs[e.pointerId];
      delete ptrs[e.pointerId];
      if (pinch && count() < 2) { pinch = null; announce('Zoom ' + Math.round(S.zoom * 100) + ' Prozent'); }
      if (drag && drag.id === e.pointerId) {
        var d = drag;
        drag = null;
        stage.classList.remove('is-drag');
        if (d.moved) {
          suppress = true;
          setTimeout(function () { suppress = false; }, 60);
          if (e.type === 'pointerup' && !reduced() && Math.abs(d.v) > 0.15 && performance.now() - d.lt < 90) {
            var v = d.v * 16;
            (function glide() {
              if (Math.abs(v) < 0.4) { inertia = 0; return; }
              stage.scrollLeft += v;
              v *= 0.94;
              inertia = requestAnimationFrame(glide);
            })();
          }
        }
      }
      return had;
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('lostpointercapture', function (e) { if (ptrs[e.pointerId] && !drag) delete ptrs[e.pointerId]; });

    stage.addEventListener('click', function (e) {
      if (suppress) { e.stopPropagation(); e.preventDefault(); suppress = false; return; }
      var dot = e.target.closest ? e.target.closest('.gm-zeit-dot') : null;
      if (dot) { hideTip(); hideSheet(); M.nav.openStation(dot._item.id, dot._jid); return; }
      var node = e.target.closest ? e.target.closest('.gm-zeit-node') : null;
      if (!node) { hideSheet(); return; }
      var inst = node._inst;
      if (!inst) return;
      setActive(inst);
      if (S.lastPtr === 'touch') { showSheet(inst); return; }
      hideTip();
      M.nav.openStation(inst.item.id, inst.lane);
    }, true);

    // Zwei-Finger-Pinch (Touch): Zoom um den Fingermittelpunkt; ein Finger scrollt nativ
    var tp = null;
    function tdist(t) { return { d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY), mx: (t[0].clientX + t[1].clientX) / 2 }; }
    stage.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) { var d = tdist(e.touches); tp = { d0: d.d || 1, z0: S.zoom }; hideTip(); hideSheet(); }
    }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      if (!tp || e.touches.length !== 2) return;
      var d = tdist(e.touches);
      if (e.cancelable) e.preventDefault();
      queueZoom(tp.z0 * (d.d / tp.d0), d.mx - stage.getBoundingClientRect().left);
    }, { passive: false });
    function tend(e) { if (tp && e.touches.length < 2) { tp = null; announce('Zoom ' + Math.round(S.zoom * 100) + ' Prozent'); } }
    stage.addEventListener('touchend', tend, { passive: true });
    stage.addEventListener('touchcancel', tend, { passive: true });

    stage.addEventListener('wheel', function (e) {
      S.jumpEp = null;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      stopInertia();
      var rect = stage.getBoundingClientRect();
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var f = Math.exp(-clamp(dy, -40, 40) * 0.0062);
      queueZoom((zoomPending ? zoomPending.z : S.zoom) * f, e.clientX - rect.left);
    }, { passive: false });

    // Vorschau bei Mausbewegung
    stage.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse' || (drag && drag.moved)) return;
      var t = e.target.closest ? e.target.closest('.gm-zeit-node, .gm-zeit-dot') : null;
      if (t) showTip(t, S.tipFor ? 0 : 90);
    });
    stage.addEventListener('pointerout', function (e) {
      if (e.pointerType !== 'mouse') return;
      var t = e.target.closest ? e.target.closest('.gm-zeit-node, .gm-zeit-dot') : null;
      if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hideTip();
    });

    // Fokus
    stage.addEventListener('focusin', function (e) {
      var node = e.target.closest ? e.target.closest('.gm-zeit-node') : null;
      if (node && node._inst) {
        setActive(node._inst);
        if (S.lastPtr === 'key') { ensureVisible(node._inst.x, true); showTip(node); }
      }
      var dot = e.target.closest ? e.target.closest('.gm-zeit-dot') : null;
      if (dot) { ensureVisible(dot._item.x, true); showTip(dot); }
    });
    stage.addEventListener('focusout', function (e) {
      if (!e.relatedTarget || !stage.contains(e.relatedTarget)) hideTip();
    });

    stage.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    S.lastPtr = 'key';
    S.jumpEp = null;
    var t = e.target;
    var node = t.closest ? t.closest('.gm-zeit-node') : null;
    var dot = t.closest ? t.closest('.gm-zeit-dot') : null;
    var key = e.key;
    if (key === 'Escape') { hideTip(); if (sheetFor) hideSheet(true); return; }
    var inst = node ? node._inst : (dot ? instOfDot(dot) : null);
    if (!inst) return;
    var arr, idx;
    switch (key) {
      case 'ArrowRight': case 'ArrowLeft':
        arr = laneInsts(inst.lane); idx = arr.indexOf(inst);
        if (idx >= 0) {
          var nx = arr[idx + (key === 'ArrowRight' ? 1 : -1)];
          if (nx) focusInst(nx, true);
        }
        e.preventDefault(); break;
      case 'ArrowDown': case 'ArrowUp': {
        var vi = S.lanes.filter(function (l) { return l.on; }).map(function (l) { return l.id; });
        var li = vi.indexOf(inst.lane) + (key === 'ArrowDown' ? 1 : -1);
        if (li >= 0 && li < vi.length) {
          var cands = laneInsts(vi[li]);
          var best = null, bd = 1e9;
          cands.forEach(function (c) { var d = Math.abs(c.x - inst.x); if (d < bd) { bd = d; best = c; } });
          if (best) focusInst(best, true);
        }
        e.preventDefault(); break;
      }
      case 'Home': case 'End':
        arr = laneInsts(inst.lane);
        if (arr.length) focusInst(key === 'Home' ? arr[0] : arr[arr.length - 1], true);
        e.preventDefault(); break;
      case '+': case '=':
        zoomBy(1.3, inst.x - S.stage.scrollLeft);
        if (node) ensureVisible(inst.x, false);
        e.preventDefault(); break;
      case '-': case '_':
        zoomBy(1 / 1.3, inst.x - S.stage.scrollLeft);
        e.preventDefault(); break;
      default: break;
    }
  }
  function instOfDot(d) {
    var it = d._item;
    for (var i = 0; i < it.insts.length; i++) if (it.insts[i].li === d.closest('.gm-zeit-item')) return it.insts[i];
    return it.insts[0];
  }

  function bindGlobal() {
    // Größenänderungen
    var lastW = 0;
    var onResize = function () {
      if (!S.visible) return;
      var ph = phoneNow();
      if (ph !== !!S.phone) {
        S.phone = ph;
        hideTip(); hideSheet();
        syncViewVisibility();
        if (ph) renderVertical(); else { if (S.mode === 'liste') renderList(); else { lastW = 0; layout(); } }
        updateUiState();
        return;
      }
      if (S.phone) return;
      S.root.classList.toggle('is-small', S.root.clientWidth < 720);
      syncChipLabels(S.root.clientWidth < 720);
      var w = S.stage.clientWidth;
      if (!w || Math.abs(w - lastW) < 2) return;
      var first = lastW === 0;
      lastW = w;
      if (S.mode !== 'strahl') return;
      var m = S.m;
      var yr = m ? yearAtScreen((m.gutter || 0) + 10) : null;
      layout();
      if (yr !== null && !first && S.geo) S.stage.scrollLeft = S.geo.Xf(yr) - S.m.gutter - 10;
    };
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(S.root);
    else window.addEventListener('resize', onResize);

    if (M.store && M.store.onChange) M.store.onChange(syncVisited);
    doc.addEventListener('gm:visited', syncVisited);
    window.addEventListener('scroll', function () { if (S.phone && S.visible && !onPhoneScroll.t) onPhoneScroll.t = requestAnimationFrame(function () { onPhoneScroll.t = 0; onPhoneScroll(); }); }, { passive: true });
    doc.addEventListener('gm:theme', function () { if (S.visible && S.mode === 'strahl') { /* Farben laufen über CSS-Variablen */ } });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && (sheetFor || S.tipFor)) { if (sheetFor) hideSheet(true); else hideTip(); return; }
      // Pfeiltasten und Plus/Minus auch ohne Fokus auf einer Station (Fokus liegt auf der Seite)
      if (!S.visible || S.mode !== 'strahl' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (M.ui && M.ui.overlay && M.ui.overlay.isOpen()) return;
      var t = e.target;
      if (t && t !== doc.body && t !== doc.documentElement && !(S.stage && S.stage.contains(t))) return;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        e.preventDefault();
        scrollToX(S.stage.scrollLeft + (k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 480 : 160), false);
      } else if (k === '+' || k === '=') { e.preventDefault(); zoomBy(1.3); }
      else if (k === '-' || k === '_') { e.preventDefault(); zoomBy(1 / 1.3); }
    });
    // Sheet schließen, wenn außerhalb getippt wird
    doc.addEventListener('pointerdown', function (e) {
      if (!sheetFor) return;
      if (S.sheet.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.gm-zeit-node')) return;
      hideSheet();
    }, true);
    S.introOff = function () {
      if (S.introTimer) clearTimeout(S.introTimer);
      S.root.classList.remove('is-intro');
    };
  }

  /* ------------------------------------------------------------------ *
   * Öffentliche API
   * ------------------------------------------------------------------ */

  function readFonts() {
    try {
      var cs = getComputedStyle(S.root);
      S.fontDisplay = (cs.getPropertyValue('--font-display') || '').trim() || 'Georgia, serif';
      S.fontUI = (cs.getPropertyValue('--font-ui') || '').trim() || 'system-ui, sans-serif';
    } catch (e) { S.fontDisplay = 'Georgia, serif'; S.fontUI = 'system-ui, sans-serif'; }
  }

  function rebuildIfNeeded() {
    var sig = signature();
    if (sig === S.sig) return false;
    S.sig = sig;
    collect();
    buildNodes();
    buildGutter();
    S.active = null;
    // Filterchips (Bahnen und Zähler können sich geändert haben)
    fillFilters();
    syncChipLabels(S.root.clientWidth < 720);
    return true;
  }

  function show() {
    if (!S.built) return;
    S.visible = true;
    S.root.classList.toggle('is-small', S.root.clientWidth < 720);
    syncChipLabels(S.root.clientWidth < 720);
    readFonts();
    var rebuilt = rebuildIfNeeded();
    S.phone = phoneNow();
    syncViewVisibility();
    updateUiState();
    if (S.phone) {
      renderVertical();
    } else if (S.mode === 'liste') {
      renderList();
    } else {
      if (!S.zoomSet) {
        var W = S.root.clientWidth || 1000;
        var small = W < 720;
        S.zoom = clamp(small ? 0.7 : (W < 1100 ? 0.78 : 0.92), ZMIN, ZMAX);
      }
      layout();
      if (S.savedScroll !== undefined && S.savedScroll !== null) { S.stage.scrollLeft = S.savedScroll; S.savedScroll = null; onScroll(); }
      if (S.root.classList.contains('is-intro')) {
        clearTimeout(S.introTimer);
        S.introTimer = setTimeout(function () { S.root.classList.remove('is-intro'); }, reduced() ? 50 : 3200);
      }
    }
    syncVisited();
    if (rebuilt) applyHighlight();
    if (S.pendingFocus) { var id = S.pendingFocus; S.pendingFocus = null; setTimeout(function () { focusStation(id); }, 30); }
  }

  function hide() {
    if (S.stage && S.mode === 'strahl') S.savedScroll = S.stage.scrollLeft;
    S.visible = false;
    hideTip();
    hideSheet();
  }

  function focusStation(id) {
    var it = S.byId[id];
    if (!it) return false;
    if (!S.visible || (!S.geo && !S.phone)) { S.pendingFocus = id; return true; }
    // Mindestens eine Bahn der Station sichtbar machen
    var anyOn = it.lanes.some(function (l) { return S.lanes.some(function (q) { return q.id === l && q.on; }); });
    if (!anyOn) toggleLane(it.lanes[0]);
    if (S.phone) {
      var vli = S.vertEl.querySelector('.gm-zeit-v-li[data-id="' + id.replace(/"/g, '') + '"]');
      if (!vli) return false;
      var hh = parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--header-h')) || 56;
      var top = vli.getBoundingClientRect().top + window.pageYOffset - hh - 70;
      try { window.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, top); }
      vli.classList.remove('is-pulse'); void vli.offsetWidth; vli.classList.add('is-pulse');
      setTimeout(function () { vli.classList.remove('is-pulse'); }, 3600);
      announce((M.t('station') + ' im ' + M.t('timeline') + ': ') + it.st.title + ', ' + it.yearFull);
      return true;
    }
    if (S.mode !== 'strahl') { S.mode = 'strahl'; applyMode(); }
    layout();
    var inst = null;
    for (var i = 0; i < it.insts.length; i++) if (!it.insts[i].li.hidden) { inst = it.insts[i]; break; }
    if (!inst) return false;
    scrollToX(inst.x - (viewW() + S.m.gutter) / 2, true);
    setActive(inst);
    var li = inst.li;
    li.classList.remove('is-pulse');
    void li.offsetWidth;
    li.classList.add('is-pulse');
    setTimeout(function () { li.classList.remove('is-pulse'); }, 3600);
    try { inst.btn.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    announce((M.t('station') + ' im ' + M.t('timeline') + ': ') + it.st.title + ', ' + it.yearFull);
    return true;
  }

  M.views.zeitstrahl = {
    mount: mount,
    show: show,
    hide: hide,
    focusStation: focusStation,
    highlightJourney: highlightJourney,
    refresh: function () { S.sig = ''; if (S.visible) show(); }
  };
})();

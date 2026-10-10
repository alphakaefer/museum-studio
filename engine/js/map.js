/* ==========================================================================
   Museum Studio – js/map.js
   Ansicht "Karte": der Netzplan aller Reisen.

   MUSEUM.views.karte = { mount(el), show(), hide(), focusStation(id), highlightJourney(id|null) }

   Aufbau
   - Netzplan (SVG): alle Reisen (derzeit neun, künftig mehr) als farbige Fäden, Stationen als Knoten. Kreuzungen sind geteilte Ringe
     (ein Segment je Reise), Einzelstationen Punkte in Reisefarbe, Mythen haben einen gestrichelten Rand,
     Exponate ein kleines Leuchtsymbol, besuchte Stationen leuchten (MUSEUM.store).
   - Layout: Für den ausgelieferten Stationsplan liegt ein oktilineares Netzplan-Layout vor (SEED/BEND unten):
     das Ergebnis eines langen, deterministischen Annealing-Laufs (seeded, reproduzierbar) auf einem Raster mit
     acht Richtungen. Ausgangspunkt war ein Kräfte-Layout mit neun Ankern auf einem Kreis, Anziehung der
     Kreuzungen zwischen ihren Reisen und Abstoßung der Knoten; bewertet wurden Kreuzungen, Abstände, Knicke
     und Knoten, die auf fremden Fäden liegen. Fehlen Stationen oder ändert sich der Plan, rechnet
     forceLayout() zur Laufzeit ein eigenes, ebenfalls deterministisches Kräfte-Layout (Fäden dann als
     weiche Kurven). Auf hochformatigen Fenstern wird der Plan um 90 Grad gedreht.
   - Zoom/Pan: Mausrad, Pinch, Ziehen, Knöpfe +/−/Einpassen, Tastatur (Pfeile, + − 0).
   - Beschriftung mit Detailstufen: wenig Zoom nur Kreuzungen, mehr Zoom alle; Kollisionen werden vermieden.
   - Legende: Gruppen „Funktionale“ und „Historische Reisen“ mit Fortschritt; Klick = Fokus auf eine Reise.
   - „Als Liste“: barrierefreie Alternative mit allen Reisen und ihren Stationen.
   Alle Klassen tragen das Präfix gm-karte-. Farben nur über die Design-Tokens aus css/museum.css.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  M.views = M.views || {};
  var doc = document;
  var SVGNS = 'http://www.w3.org/2000/svg';

  // Netzplan-Layout des Pakets: MUSEUM.mapLayout = { SEED, BEND, cell, W, H } (erzeugt von tools/layout-map.mjs, Datei layout.js).
  // SEED = Position je Station (Rastereinheiten), BEND = Knickpunkt je Abschnitt, der nicht geradlinig verläuft.
  // Ohne Layout rechnet die Engine zur Laufzeit ein Kräfte-Layout (forceLayout).
  var SEED = null, BEND = {}, SEED_CELL = 48, SEED_W = 36, SEED_H = 26;
  function loadLayout() {
    var L = M.mapLayout;
    if (L && L.SEED) { SEED = L.SEED; BEND = L.BEND || {}; SEED_CELL = L.cell || 48; SEED_W = L.W || 36; SEED_H = L.H || 26; }
    else { SEED = null; BEND = {}; }
  }

  // Skin-Einstellungen für die Karte: lines 'octilinear' | 'smooth', nodes 'icons' | 'shapes'
  function skinMap() { return (M.skin && M.skin.map) ? M.skin.map() : { lines: 'octilinear', nodes: 'icons' }; }

  /* ------------------------------------------------------------------ *
   * Kleine Helfer
   * ------------------------------------------------------------------ */

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function svgEl(tag, attrs, parent) {
    var n = doc.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.setAttribute('class', v);
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, attrs) {
    var args = [tag, attrs || null];
    for (var i = 2; i < arguments.length; i++) args.push(arguments[i]);
    return M.el.apply(null, args);
  }
  function icon(key, size) {
    return (M.icons && M.icons.svg) ? M.icons.svg(key, { size: size || 20 }) : '';
  }
  function reduced() { return M.reducedMotion ? M.reducedMotion() : false; }
  function rngFor(seed) {
    var s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shortTitle(t) {
    var s = String(t || '');
    var i = s.indexOf(': ');
    if (i > 2) s = s.slice(0, i);
    i = s.indexOf(' – ');
    if (i > 2) s = s.slice(0, i);
    if (s.length > 30) s = s.slice(0, 29).replace(/[\s,.;:–-]+$/, '') + '…';
    return s;
  }
  // Paket-Wunsch: gemeinsame Endung der Kurznamen historischer Reisen weglassen (vocab.histKurzSuffix, z. B. "-Geschichte")
  function stripKurz(t) {
    var sfx = M.t('histKurzSuffix');
    t = String(t);
    return sfx && sfx !== 'histKurzSuffix' && t.slice(-sfx.length) === sfx ? t.slice(0, -sfx.length) : t;
  }
  function joinDe(list) {
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' und ' + list[list.length - 1];
  }
  // Schriftfarbe auf einer Reisefarbe: dunkel oder hell, je nachdem was mehr Kontrast bringt.
  // Liefert zusätzlich eine ggf. leicht abgedunkelte/aufgehellte Fläche, damit Schaltflächentext AA erreicht (4,5:1).
  function rgbOf(c) {
    var m, o = null;
    if ((m = /^#([0-9a-f]{6})$/i.exec(c))) o = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    else if ((m = /^rgb\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(c))) o = [+m[1], +m[2], +m[3]];
    return o;
  }
  function lumOf(rgb) {
    function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  }
  function onColors(jid) {
    var rgb = rgbOf(M.colorOf ? M.colorOf(jid) : '');
    if (!rgb) return null;
    var DARK = [10, 16, 24], WHITE = [255, 255, 255];
    function cr(a, b) { var l1 = lumOf(a), l2 = lumOf(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
    var useDark = cr(rgb, DARK) >= cr(rgb, WHITE), fg = useDark ? DARK : WHITE, bg = rgb, t = 0;
    while (cr(bg, fg) < 4.6 && t < 0.5) {
      t += 0.04;
      var to = useDark ? WHITE : [0, 0, 0];
      bg = rgb.map(function (v, i) { return Math.round(v + (to[i] - v) * t); });
    }
    function hex(a) { return '#' + a.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join(''); }
    return { on: hex(fg), bg: t ? hex(bg) : '' };
  }
  function onColor(jid) { var o = onColors(jid); return o ? o.on : ''; }

  var measureCtx = null;
  function textWidth(s, font) {
    try {
      if (!measureCtx) measureCtx = doc.createElement('canvas').getContext('2d');
      measureCtx.font = font;
      return measureCtx.measureText(s).width;
    } catch (e) { return s.length * 7; }
  }

  /* ------------------------------------------------------------------ *
   * Styles (einmal injiziert)
   * ------------------------------------------------------------------ */

  var CSS = [
    '.gm-karte{--gk-paper:var(--bg,#F6F2EA);--gk-core:var(--bg-2,#fff);--gk-spark-edge:#8A5A00;display:grid;gap:1.1rem;padding-bottom:1rem;color:var(--ink,#1B2230)}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gm-karte{--gk-spark-edge:transparent}}',
    ':root[data-theme="dark"] .gm-karte{--gk-spark-edge:transparent}',
    '.gm-karte [hidden]{display:none!important}',

    /* Kopfzeile: Umschalter und Summe */
    '.gm-karte-bar{display:flex;align-items:center;justify-content:space-between;gap:.6rem 1.2rem;flex-wrap:wrap}',
    '.gm-karte-seg{display:inline-flex;padding:3px;gap:2px;border-radius:999px;background:var(--bg-3,#ECE6DA);border:1px solid var(--line,#D9D2C3)}',
    '.gm-karte-seg button{display:inline-flex;align-items:center;gap:.45rem;min-height:40px;padding:0 1.05rem 0 .85rem;border:0;border-radius:999px;background:transparent;color:var(--ink-2,#5C6577);font:600 .9rem/1 var(--font-ui,system-ui,sans-serif);cursor:pointer;transition:background-color .2s,color .2s,box-shadow .2s}',
    '.gm-karte-seg button:hover{color:var(--ink,#1B2230)}',
    '.gm-karte-seg button[aria-pressed="true"]{background:var(--bg-2,#fff);color:var(--ink,#1B2230);box-shadow:var(--shadow)}',
    '.gm-karte-seg .gm-icon{width:18px;height:18px}',
    '.gm-karte-sum{margin:0;color:var(--ink-2,#5C6577);font:.92rem/1.35 var(--font-ui,system-ui,sans-serif)}',
    '.gm-karte-sum b{color:var(--ink,#1B2230);font-variant-numeric:tabular-nums}',

    /* Bühne: Legende + Karte */
    '.gm-karte-stage{--gk-h:clamp(27rem,calc(100vh - var(--header-h,64px) - 8.5rem),52rem);display:grid;grid-template-columns:minmax(14.5rem,17.5rem) minmax(0,1fr);gap:1.4rem;align-items:start}',
    '.gm-karte-legend{display:flex;flex-direction:column;gap:.9rem;min-width:0;max-height:var(--gk-h);overflow-y:auto;overscroll-behavior:contain;padding:0 .35rem .2rem 0;scrollbar-width:thin;scrollbar-color:var(--line,#D9D2C3) transparent}',
    '.gm-karte-lg-cap{margin:0;padding:.65rem .8rem;border-radius:12px;border-left:4px solid var(--accent,#05749E);background:var(--accent-soft,rgba(5,116,158,.1));color:var(--ink,#1B2230);font:600 .86rem/1.4 var(--font-ui,system-ui,sans-serif)}',
    '.gm-karte-lg-h{margin:0 0 .3rem;font:700 .72rem/1.2 var(--font-ui,system-ui,sans-serif);letter-spacing:.13em;text-transform:uppercase;color:var(--ink-2,#5C6577)}',
    '.gm-karte-lg-h button{display:flex;align-items:center;gap:.5rem;width:100%;min-height:36px;margin:0;padding:0 .2rem 0 .1rem;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;letter-spacing:inherit;text-transform:inherit;text-align:left;cursor:pointer}',
    '.gm-karte-lg-h button:hover{color:var(--ink,#1B2230)}',
    '.gm-karte-lg-h button::after{content:"";order:3;flex:1;height:1px;background:var(--line,#D9D2C3);margin-left:.3rem}',
    '.gm-karte-lg-c{order:2;font-variant-numeric:tabular-nums;font-weight:600;letter-spacing:.04em;color:var(--ink-2,#5C6577)}',
    '.gm-karte-lg-h svg{order:4;width:14px;height:14px;flex:none;transition:transform .25s var(--ease,ease)}',
    '.gm-karte-lg-g.is-collapsed .gm-karte-lg-h svg{transform:rotate(-90deg)}',
    '.gm-karte-lg-g.is-collapsed .gm-karte-lg-list{display:none}',
    '.gm-karte-lg-list{list-style:none;margin:0;padding:0;display:grid;gap:.12rem}',
    '.gm-karte-jb{--jc:var(--accent,#05749E);position:relative;display:grid;grid-template-columns:1.7rem minmax(0,1fr) auto;column-gap:.65rem;align-items:center;width:100%;min-height:2.7rem;margin:0;padding:.28rem .7rem .5rem .45rem;border:1.5px solid transparent;border-radius:12px;background:transparent;color:var(--ink,#1B2230);text-align:left;cursor:pointer;transition:background-color .2s,border-color .2s,box-shadow .25s}',
    '.gm-karte-jb:hover{background:var(--bg-2,#fff);border-color:var(--line,#D9D2C3)}',
    '.gm-karte-jb:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:1px}',
    '.gm-karte-jb[aria-pressed="true"]{background:var(--bg-2,#fff);border-color:var(--jc);box-shadow:0 10px 26px -16px var(--jc)}',
    '.gm-karte-jb-num{display:grid;place-items:center;width:1.7rem;height:1.7rem;border-radius:50%;background:var(--gk-go,var(--jc));color:var(--gk-on,#fff);font:700 .78rem/1 var(--font-ui,system-ui,sans-serif);font-variant-numeric:tabular-nums;transition:transform .25s var(--ease,ease)}',
    '.gm-karte-jb:hover .gm-karte-jb-num,.gm-karte-jb[aria-pressed="true"] .gm-karte-jb-num{transform:scale(1.1)}',
    '.gm-karte-jb-badge{display:grid;place-items:center;width:2.1rem;height:2.1rem;border-radius:50%;border:2px solid var(--jc);background:var(--bg-2,#fff);color:var(--ink,#1B2230)}',
    '.gm-karte-jb-badge .gm-icon{width:17px;height:17px}',
    '.gm-karte-jb-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 .9rem/1.2 var(--font-ui,system-ui,sans-serif)}',
    '.gm-karte-jb-n{font:600 .76rem/1 var(--font-ui,system-ui,sans-serif);color:var(--ink-2,#5C6577);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.gm-karte-jb-bar{position:absolute;left:2.7rem;right:.7rem;bottom:.3rem;height:3px;border-radius:2px;background:var(--bg-3,#ECE6DA);overflow:hidden}',
    '.gm-karte-jb-bar span{position:absolute;inset:0 auto 0 0;width:0;background:var(--jc);border-radius:2px;transition:width .6s var(--ease,ease)}',
    '.gm-karte-jb-short{display:none}',

    '.gm-karte-keybox{border:1px solid var(--line,#D9D2C3);border-radius:14px;background:var(--bg-2,#fff);padding:.1rem .85rem}',
    '.gm-karte-keybox summary{cursor:pointer;padding:.7rem 0;font:700 .72rem/1.2 var(--font-ui,system-ui,sans-serif);letter-spacing:.13em;text-transform:uppercase;color:var(--ink-2,#5C6577);list-style-position:inside}',
    '.gm-karte-key{list-style:none;margin:0;padding:0 0 .8rem;display:grid;gap:.55rem}',
    '.gm-karte-key li{display:grid;grid-template-columns:2rem minmax(0,1fr);gap:.6rem;align-items:center;font:.86rem/1.3 var(--font-ui,system-ui,sans-serif);color:var(--ink-2,#5C6577)}',
    '.gm-karte-key svg{width:2rem;height:2rem;display:block;overflow:visible}',

    /* Karte */
    '.gm-karte-vp{position:relative;height:var(--gk-h);border-radius:var(--radius-lg,22px);border:1px solid var(--line,#D9D2C3);background-color:var(--gk-paper);',
    'background-image:radial-gradient(circle at center,var(--line,#D9D2C3) 1.1px,transparent 1.7px);background-size:var(--gs,44px) var(--gs,44px);background-position:var(--gx,0) var(--gy,0);',
    'overflow:hidden;touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none;box-shadow:inset 0 0 90px -20px var(--bg-3,#ECE6DA),var(--shadow);outline:none;isolation:isolate}',
    '.gm-karte-vp::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0;background:radial-gradient(60% 55% at 50% 46%,rgba(70,179,219,.10),transparent 72%)}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gm-karte-vp::before{opacity:1}}',
    ':root[data-theme="dark"] .gm-karte-vp::before{opacity:1}',
    '.gm-karte-vp.is-drag{cursor:grabbing}',
    '.gm-karte-vp:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:3px}',
    '.gm-karte-svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:hidden;--lw:4px;--ns:1;--inv:1}',

    '.gm-karte-jl{transition:opacity .4s ease}',
    '.gm-karte-glowline{fill:none;stroke:var(--jc);stroke-width:calc(var(--lw) * 3.2);stroke-linecap:round;stroke-linejoin:round;opacity:0}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gm-karte-glowline{opacity:.14}}',
    ':root[data-theme="dark"] .gm-karte-glowline{opacity:.14}',
    '.gm-karte-casing{fill:none;stroke:var(--gk-paper);stroke-width:calc(var(--lw) + 3.4px);stroke-linecap:round;stroke-linejoin:round}',
    '.gm-karte-line{fill:none;stroke:var(--jc);stroke-width:var(--lw);stroke-linecap:round;stroke-linejoin:round;transition:stroke-width .2s}',
    '.gm-karte-jl.is-peek .gm-karte-line{stroke-width:calc(var(--lw) * 1.55)}',
    '.gm-karte-line-in{fill:none;stroke:var(--gk-paper);stroke-width:calc(var(--lw) * .32);stroke-linecap:butt;stroke-linejoin:round;stroke-dasharray:calc(var(--lw) * .75) calc(var(--lw) * 1.05);opacity:.9;pointer-events:none;transition:stroke-width .2s}',
    '.gm-karte-jl.is-peek .gm-karte-line-in{stroke-width:calc(var(--lw) * .5)}',
    '.gm-karte-tag{pointer-events:none}',
    '.gm-karte-tag .gm-karte-nd{transform:scale(var(--ts,var(--ns)))}',
    '.gm-karte-tag-c{fill:var(--jc);stroke:var(--gk-paper);stroke-width:1.8}',
    '.gm-karte-tag-t{fill:var(--gk-on,#fff);font:700 10.5px/1 var(--font-ui,system-ui,sans-serif);text-anchor:middle;dominant-baseline:central;font-variant-numeric:tabular-nums}',
    '.gm-karte.is-focus .gm-karte-jl:not(.is-on){opacity:.1}',
    '.gm-karte.is-peeking:not(.is-focus) .gm-karte-jl:not(.is-peek){opacity:.16}',
    '.gm-karte.is-peeking:not(.is-focus) .gm-karte-node:not(.is-pk){opacity:.25}',

    '.gm-karte-hl{pointer-events:none}',
    '.gm-karte-hl path{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1}',
    '.gm-karte-hl .gm-karte-hl-c{stroke:var(--gk-paper);stroke-width:calc(var(--lw) * 1.5 + 4px)}',
    '.gm-karte-hl .gm-karte-hl-l{stroke:var(--jc);stroke-width:calc(var(--lw) * 1.5)}',
    '.gm-karte-hl.is-draw path{stroke-dashoffset:0;transition:stroke-dashoffset 1.5s var(--ease,ease)}',
    '.gm-karte-hl.is-still path{stroke-dashoffset:0;transition:none}',

    '.gm-karte-node{cursor:pointer;outline:none;transition:opacity .35s ease;-webkit-tap-highlight-color:transparent}',
    '.gm-karte-nd{transform:scale(var(--ns))}',
    '.gm-karte-hv{transition:transform .2s var(--ease,ease)}',
    '.gm-karte-node:hover .gm-karte-hv,.gm-karte-node:focus-visible .gm-karte-hv{transform:scale(1.2)}',
    '.gm-karte.is-focus .gm-karte-node:not(.is-in){opacity:.22}',
    '.gm-karte-hit{fill:transparent;stroke:none}',
    '.gm-karte-halo{fill:var(--gk-paper);stroke:var(--ink,#1B2230);stroke-opacity:.2;stroke-width:1}',
    '.gm-karte-dot{fill:var(--jc)}',
    '.gm-karte-arc{fill:none;stroke:var(--jc);stroke-width:3.9;stroke-linecap:butt}',
    '.gm-karte-core{fill:var(--gk-core);transition:fill .4s ease}',
    '.gm-karte-lit{fill:var(--warm,#FCB300);opacity:0;transition:opacity .5s ease}',
    '.gm-karte-node.is-visited .gm-karte-lit,.gm-karte-kn.is-visited .gm-karte-lit{opacity:1}',
    '.gm-karte-node.is-visited .gm-karte-core.is-x,.gm-karte-kn.is-visited .gm-karte-core.is-x{fill:var(--warm,#FCB300)}',
    '.gm-karte-glow{fill:url(#gm-karte-glow);opacity:0;transition:opacity .6s ease;pointer-events:none}',
    '.gm-karte-node.is-visited .gm-karte-glow,.gm-karte-kn.is-visited .gm-karte-glow{opacity:1}',
    '.gm-karte-myth{fill:none;stroke:var(--jc);stroke-width:1.6;stroke-dasharray:2.3 2.5;stroke-linecap:round}',
    '.gm-karte-myth.is-x{stroke:var(--ink-2,#5C6577)}',
    '.gm-karte-spark{fill:var(--warm,#FCB300);stroke:var(--gk-spark-edge);stroke-width:.7;stroke-linejoin:round}',
    '.gm-karte-fr{fill:none;stroke:var(--accent,#05749E);stroke-width:2.6;opacity:0;pointer-events:none}',
    '.gm-karte-node:focus-visible .gm-karte-fr{opacity:1}',
    '.gm-karte-pulse{fill:none;stroke:var(--warm,#FCB300);stroke-width:2.4;opacity:0;pointer-events:none}',
    '.gm-karte-node.is-pulse .gm-karte-pulse{animation:gm-karte-pulse 1.5s ease-out 2}',
    '@keyframes gm-karte-pulse{0%{opacity:.95;transform:scale(.7)}100%{opacity:0;transform:scale(2.6)}}',
    '@media (prefers-reduced-motion:no-preference){.gm-karte-spark{transform-box:fill-box;transform-origin:center;animation:gm-karte-tw 3.8s ease-in-out infinite;animation-delay:var(--d,0s)}}',
    '@keyframes gm-karte-tw{0%,100%{transform:scale(1) rotate(0);opacity:1}50%{transform:scale(.72) rotate(45deg);opacity:.72}}',

    '.gm-karte-runner{fill:var(--warm,#FCB300);stroke:var(--warm,#FCB300);stroke-opacity:.32;stroke-width:calc(var(--lw) * 1.7);r:calc(var(--lw) * .95);opacity:0;pointer-events:none}',
    '.gm-karte-runner.is-on{opacity:.95;transition:opacity .6s ease 1.5s}',
    '@media (prefers-reduced-motion:no-preference){',
    '.gm-karte-intro .gm-karte-line,.gm-karte-intro .gm-karte-casing,.gm-karte-intro .gm-karte-glowline{stroke-dasharray:1;stroke-dashoffset:1;animation:gm-karte-draw 1.8s var(--ease,ease) forwards;animation-delay:calc(var(--i,0) * 130ms + .15s)}',
    '.gm-karte-intro .gm-karte-tag,.gm-karte-intro .gm-karte-line-in{opacity:0;animation:gm-karte-pop .6s ease 1.5s forwards}',
    '.gm-karte-intro .gm-karte-node{opacity:0;animation:gm-karte-pop .6s ease forwards;animation-delay:calc(1s + var(--ni,0) * 9ms)}',
    '.gm-karte-intro .gm-karte-lab{opacity:0!important;transition:none}',
    '.gm-karte-intro .gm-karte-ctl,.gm-karte-intro .gm-karte-hint{opacity:0;animation:gm-karte-pop .8s ease 1.4s forwards}',
    '}',
    '@keyframes gm-karte-draw{to{stroke-dashoffset:0}}',
    '@keyframes gm-karte-pop{from{opacity:0}to{opacity:1}}',
    '.gm-karte-lab{opacity:0;transition:opacity .22s ease;pointer-events:none}',
    '.gm-karte-lab.is-on{opacity:1}',
    '.gm-karte.is-focus .gm-karte-lab.is-on:not(.is-in){opacity:.4}',
    '.gm-karte-inv{transform:scale(var(--inv))}',
    '.gm-karte-lab-bg{fill:var(--gk-paper);fill-opacity:.9;stroke:var(--line,#D9D2C3);stroke-width:.8}',
    '.gm-karte-lab text{font:600 12.5px/1 var(--font-ui,system-ui,sans-serif);fill:var(--ink,#1B2230);paint-order:stroke fill;stroke:var(--gk-paper);stroke-width:4.6px;stroke-linejoin:round}',
    '.gm-karte-lab.is-single text{font-weight:500;fill:var(--ink-2,#5C6577)}',
    '.gm-karte.is-focus .gm-karte-lab.is-in text{font-weight:600;fill:var(--ink,#1B2230)}',

    /* Steuerung, Karte, Hinweis */
    '.gm-karte-ctl{position:absolute;right:.75rem;top:.75rem;z-index:3;display:flex;flex-direction:column;gap:.4rem}',
    '.gm-karte-ctl button{display:grid;place-items:center;width:44px;height:44px;margin:0;padding:0;border-radius:50%;border:1px solid var(--line,#D9D2C3);background:var(--glass,rgba(246,242,234,.82));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--ink,#1B2230);cursor:pointer;box-shadow:var(--shadow);transition:background-color .2s,border-color .2s,transform .2s var(--ease,ease)}',
    '.gm-karte-ctl button:hover{border-color:var(--accent,#05749E);background:var(--bg-2,#fff)}',
    '.gm-karte-ctl button:active{transform:scale(.94)}',
    '.gm-karte-ctl svg{width:20px;height:20px}',
    '.gm-karte-hint{position:absolute;left:.9rem;top:.8rem;z-index:2;max-width:calc(100% - 5.5rem);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin:0;padding:.3rem .65rem;border-radius:999px;background:var(--glass,rgba(246,242,234,.82));border:1px solid var(--line,#D9D2C3);color:var(--ink-2,#5C6577);font:.78rem/1.3 var(--font-ui,system-ui,sans-serif);pointer-events:none;transition:opacity .6s ease}',
    '.gm-karte-hint.is-off{opacity:0}',

    '.gm-karte-card{--jc:var(--accent,#05749E);position:absolute;left:.75rem;bottom:.75rem;z-index:3;display:grid;gap:.35rem;max-width:min(25rem,calc(100% - 1.5rem));padding:.85rem 1rem .9rem 1.05rem;border-radius:16px;border:1px solid var(--line,#D9D2C3);border-left:5px solid var(--jc);background:var(--glass,rgba(246,242,234,.9));-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:var(--shadow-lg);visibility:hidden;opacity:0;transform:translateY(10px);transition:opacity .3s ease,transform .35s var(--ease,ease),visibility 0s .35s}',
    '.gm-karte-card.is-on{visibility:visible;opacity:1;transform:none;transition:opacity .3s ease,transform .35s var(--ease,ease)}',
    '.gm-karte-card-h{display:flex;align-items:center;gap:.6rem;margin:0;font:600 1.1rem/1.2 var(--font-display,Georgia,serif);padding-right:2.4rem}',
    '.gm-karte-card-h .gm-icon{width:22px;height:22px;flex:none;color:var(--jc)}',
    '.gm-karte-card p{margin:0;color:var(--ink-2,#5C6577);font:.9rem/1.4 var(--font-ui,system-ui,sans-serif)}',
    '.gm-karte-card-prog{display:flex;align-items:center;gap:.6rem;color:var(--ink,#1B2230)!important;font-weight:600!important;font-variant-numeric:tabular-nums}',
    '.gm-karte-card-prog i{display:block;position:relative;flex:1;height:5px;border-radius:3px;background:var(--bg-3,#ECE6DA);overflow:hidden}',
    '.gm-karte-card-prog i b{position:absolute;inset:0 auto 0 0;background:var(--jc);border-radius:3px;transition:width .6s var(--ease,ease)}',
    '.gm-karte-card-go{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.25rem}',
    '.gm-karte-card-x{position:absolute;right:.35rem;top:.35rem;width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--ink-2,#5C6577);cursor:pointer}',
    '.gm-karte-card-x:hover{background:var(--accent-soft,rgba(5,116,158,.1));color:var(--ink,#1B2230)}',
    '.gm-karte-card-x svg{width:18px;height:18px}',
    '.gm-karte-go{display:inline-flex;align-items:center;gap:.5rem;min-height:44px;padding:0 1.15rem;border:0;border-radius:999px;background:var(--gk-go,var(--jc));color:var(--gk-on,#fff);font:700 .93rem/1 var(--font-ui,system-ui,sans-serif);cursor:pointer;box-shadow:0 10px 24px -12px var(--jc);transition:transform .2s var(--ease,ease),box-shadow .25s}',
    '.gm-karte-go:hover{transform:translateY(-1px);box-shadow:0 14px 28px -12px var(--jc)}',
    '.gm-karte-go .gm-icon{width:18px;height:18px}',

    '.gm-karte-tip{position:absolute;left:0;top:0;z-index:4;max-width:17.5rem;padding:.65rem .8rem .7rem;border-radius:13px;background:var(--bg-2,#fff);border:1px solid var(--line,#D9D2C3);box-shadow:var(--shadow-lg);pointer-events:none;opacity:0;visibility:hidden;transform:translateY(4px);transition:opacity .15s ease,transform .18s var(--ease,ease),visibility 0s .18s}',
    '.gm-karte-tip.is-on{opacity:1;visibility:visible;transform:none;transition:opacity .15s ease,transform .18s var(--ease,ease)}',
    '.gm-karte-tip-t{margin:0 0 .15rem;font:600 1rem/1.25 var(--font-display,Georgia,serif);color:var(--ink,#1B2230)}',
    '.gm-karte-tip-m{margin:0 0 .45rem;font:.78rem/1.3 var(--font-ui,system-ui,sans-serif);color:var(--ink-2,#5C6577)}',
    '.gm-karte-tip-j{display:flex;flex-wrap:wrap;gap:.25rem .75rem;margin:0;padding:0;list-style:none}',
    '.gm-karte-tip-j li{display:inline-flex;align-items:center;gap:.35rem;font:600 .8rem/1.2 var(--font-ui,system-ui,sans-serif);color:var(--ink,#1B2230)}',
    '.gm-karte-tip-j li::before{content:"";width:.7rem;height:.7rem;border-radius:50%;background:var(--jc);flex:none}',
    '.gm-karte-tip-f{display:flex;flex-wrap:wrap;gap:.3rem .5rem;margin:.5rem 0 0;padding:0;list-style:none;font:600 .72rem/1 var(--font-ui,system-ui,sans-serif);color:var(--ink-2,#5C6577)}',
    '.gm-karte-tip-f li{padding:.22rem .5rem;border-radius:999px;border:1px solid var(--line,#D9D2C3)}',
    '.gm-karte-tip-f li.is-lit{border-color:var(--warm,#FCB300);color:var(--ink,#1B2230)}',

    /* Liste */
    '.gm-karte-list{display:grid;gap:1.8rem}',
    '.gm-karte-list-intro{margin:0;max-width:44rem;color:var(--ink-2,#5C6577)}',
    '.gm-karte-list-g{margin:0 0 .8rem;font:700 .74rem/1.2 var(--font-ui,system-ui,sans-serif);letter-spacing:.13em;text-transform:uppercase;color:var(--ink-2,#5C6577)}',
    '.gm-karte-list-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,21rem),1fr));gap:1rem;align-items:start}',
    '.gm-karte-lj{--jc:var(--accent,#05749E);padding:1.1rem 1.1rem 1.2rem;border-radius:var(--radius,14px);border:1px solid var(--line,#D9D2C3);border-top:5px solid var(--jc);background:var(--bg-2,#fff);box-shadow:var(--shadow)}',
    '.gm-karte-lj-h{display:flex;align-items:center;gap:.7rem;margin:0}',
    '.gm-karte-lj-h .gm-karte-jb-badge{grid-row:auto;flex:none}',
    '.gm-karte-lj-t{margin:0;font:600 1.15rem/1.2 var(--font-display,Georgia,serif);color:var(--ink,#1B2230)}',
    '.gm-karte-lj-tag{margin:.45rem 0 .2rem;color:var(--ink-2,#5C6577);font-size:.92rem}',
    '.gm-karte-lj-meta{display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;margin:.3rem 0 .9rem}',
    '.gm-karte-lj-n{color:var(--ink-2,#5C6577);font:600 .82rem/1 var(--font-ui,system-ui,sans-serif);font-variant-numeric:tabular-nums}',
    '.gm-karte-lj-go{display:inline-flex;align-items:center;gap:.4rem;min-height:40px;padding:0 .95rem;border-radius:999px;border:1.5px solid var(--jc);background:transparent;color:var(--ink,#1B2230);font:700 .85rem/1 var(--font-ui,system-ui,sans-serif);cursor:pointer;transition:background-color .2s}',
    '.gm-karte-lj-go:hover{background:var(--accent-soft,rgba(5,116,158,.1))}',
    '.gm-karte-lj-go .gm-icon{width:16px;height:16px}',
    '.gm-karte-ls{list-style:none;margin:0;padding:0;position:relative}',
    '.gm-karte-ls::before{content:"";position:absolute;left:10px;top:14px;bottom:14px;width:4px;border-radius:2px;background:var(--jc)}',
    '.gm-karte-ls li{position:relative;padding:.18rem 0 .18rem 2.2rem;min-height:2rem}',
    '.gm-karte-ls li::before{content:"";position:absolute;left:5px;top:.72rem;width:14px;height:14px;box-sizing:border-box;border-radius:50%;background:var(--jc);border:3px solid var(--bg-2,#fff)}',
    '.gm-karte-ls li.is-x::before{left:3px;top:.55rem;width:18px;height:18px;background:var(--bg-2,#fff);border:4px solid var(--jc)}',
    '.gm-karte-ls li.is-v::before{box-shadow:0 0 0 3px color-mix(in srgb,var(--warm,#FCB300) 70%,transparent)}',
    '.gm-karte-ls a{color:var(--ink,#1B2230);font:600 .95rem/1.3 var(--font-ui,system-ui,sans-serif);text-decoration:none;display:inline}',
    '.gm-karte-ls a:hover{text-decoration:underline;text-underline-offset:.2em}',
    '.gm-karte-ls-k{display:block;margin-top:.1rem;color:var(--ink-2,#5C6577);font:.78rem/1.35 var(--font-ui,system-ui,sans-serif)}',
    '.gm-karte-ls-k b{font-weight:700;color:var(--ink,#1B2230)}',
    '.gm-karte-ls-v{color:var(--ink,#1B2230)!important;font-weight:700}',
    '.gm-karte-ls-v::before{content:"\\2713  ";content:"\\2713  " / "";color:var(--ok,#2F8F5B)}',
    '.gm-karte-empty{padding:3rem 1rem;text-align:center;color:var(--ink-2,#5C6577)}',


    /* Modus Reisen: Konstellation und Linienplan */
    '.gm-karte-note{margin:0;padding:.6rem .85rem;border-radius:12px;background:var(--bg-3,#ECE6DA);color:var(--ink-2,#5C6577);font:.88rem/1.4 var(--font-ui,system-ui,sans-serif)}',
    '.gm-rv{display:grid;gap:1rem;min-width:0}',
    '.gm-rv-chips{display:none;list-style:none;margin:0;padding:.15rem .1rem .55rem;gap:.45rem;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:thin}',
    '.gm-rv-chips li{flex:none;scroll-snap-align:start}',
    '.gm-rv-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:1.6rem;align-items:start}',
    '.gm-rv-left{position:sticky;top:calc(var(--header-h,64px) + 1rem);display:grid;gap:.8rem;min-width:0}',
    '.gm-rv-lead{margin:0;padding:.65rem .85rem;border-radius:12px;border-left:4px solid var(--accent,#05749E);background:var(--accent-soft,rgba(5,116,158,.1));color:var(--ink,#1B2230);font:600 .88rem/1.45 var(--font-ui,system-ui,sans-serif)}',
    '.gm-rv-con{border-radius:var(--radius-lg,22px);border:1px solid var(--line,#D9D2C3);background:var(--gk-paper);box-shadow:var(--shadow);padding:.4rem}',
    '.gm-rv-svg{display:block;width:100%;height:auto;overflow:visible}',
    '.gm-rv-edge{fill:none;stroke:var(--ink-2,#5C6577);stroke-linecap:round;transition:opacity .25s ease,stroke .25s ease}',
    '.gm-rv-edge.is-strong{opacity:.36}.gm-rv-edge.is-weak{opacity:.16}.gm-rv-edge.is-faint{opacity:0}',
    '.gm-rv-svg.has-act .gm-rv-edge{opacity:.05}',
    '.gm-rv-svg.has-act .gm-rv-edge.is-on{stroke:var(--ec,var(--accent,#05749E));opacity:.92}',
    '.gm-rv-block{fill:var(--bg-3,#ECE6DA);fill-opacity:.6;stroke:var(--line,#D9D2C3);stroke-width:1.5;stroke-dasharray:5 6}',
    '.gm-rv-badge{opacity:0;pointer-events:none;transition:opacity .2s}.gm-rv-badge.is-on{opacity:1}',
    '.gm-rv-badge circle{fill:var(--gk-paper);stroke:var(--ink,#1B2230);stroke-width:1.4}',
    '.gm-rv-badge text{fill:var(--ink,#1B2230);font:700 12px var(--font-ui,system-ui,sans-serif);text-anchor:middle;dominant-baseline:central}',
    '.gm-rv-node{cursor:pointer;outline:none;transition:opacity .25s ease;-webkit-tap-highlight-color:transparent}',
    '.gm-rv-svg.has-act .gm-rv-node:not(.is-act):not(.is-nb){opacity:.28}',
    '.gm-rv-disc{fill:var(--jc);stroke:var(--gk-paper);stroke-width:3;transition:stroke-width .2s}',
    '.gm-rv-node:hover .gm-rv-disc,.gm-rv-node.is-act .gm-rv-disc{stroke-width:5}',
    '.gm-rv-track{fill:none;stroke:var(--line,#D9D2C3);stroke-width:3.5}',
    '.gm-rv-prog{fill:none;stroke:var(--jc);stroke-width:3.5;stroke-linecap:round;stroke-dasharray:0 1}',
    '.gm-rv-sel{fill:none;stroke:var(--jc);stroke-width:2.5;opacity:0;transition:opacity .2s}',
    '.gm-rv-node.is-sel .gm-rv-sel,.gm-rv-node.is-act .gm-rv-sel{opacity:.6}.gm-rv-node.is-sel .gm-rv-sel{opacity:1}',
    '.gm-rv-node:focus-visible .gm-rv-sel{opacity:1;stroke:var(--accent,#05749E);stroke-width:3.5}',
    '.gm-rv-numc{fill:var(--gk-paper);stroke:var(--jc);stroke-width:2.4}',
    '.gm-rv-num{fill:var(--ink,#1B2230);font:700 12.5px var(--font-ui,system-ui,sans-serif);text-anchor:middle;dominant-baseline:central}',
    '.gm-rv-big{font:700 19px var(--font-ui,system-ui,sans-serif);text-anchor:middle;dominant-baseline:central}',
    '.gm-rv-name{font:600 19px var(--font-ui,system-ui,sans-serif);fill:var(--ink,#1B2230);paint-order:stroke fill;stroke:var(--gk-paper);stroke-width:5px;stroke-linejoin:round}',
    '.gm-rv-info{margin:0;min-height:3.9em;color:var(--ink-2,#5C6577);font:.9rem/1.45 var(--font-ui,system-ui,sans-serif)}',
    '.gm-rv-note{margin:0;color:var(--ink-2,#5C6577);font:.8rem/1.4 var(--font-ui,system-ui,sans-serif)}',
    '.gm-rv-plan{--gk-paper:var(--bg-2,#fff);--gk-core:var(--bg-2,#fff);--jc:var(--accent,#05749E);min-width:0;padding:1.1rem 1.1rem 1.2rem;border-radius:var(--radius-lg,22px);border:1px solid var(--line,#D9D2C3);background:var(--bg-2,#fff);box-shadow:var(--shadow);outline:none}',
    '.gm-rv-plan.is-on{border-top:5px solid var(--jc)}',
    '.gm-rv-empty h3{margin:0 0 .5rem;font:600 1.2rem/1.2 var(--font-display,Georgia,serif);color:var(--ink,#1B2230)}',
    '.gm-rv-empty p{margin:.4rem 0 0;color:var(--ink-2,#5C6577);font:.92rem/1.5 var(--font-ui,system-ui,sans-serif)}',
    '.gm-rv-head{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:.5rem .85rem;align-items:center}',
    '.gm-rv-hnum{display:grid;place-items:center;width:2.7rem;height:2.7rem;border-radius:50%;background:var(--gk-go,var(--jc));color:var(--gk-on,#fff);font:700 1.2rem/1 var(--font-ui,system-ui,sans-serif)}',
    '.gm-rv-htxt h3{margin:0;font:600 1.3rem/1.2 var(--font-display,Georgia,serif);color:var(--ink,#1B2230)}',
    '.gm-rv-htxt p{margin:.2rem 0 0;color:var(--ink-2,#5C6577);font:.9rem/1.4 var(--font-ui,system-ui,sans-serif)}',
    '.gm-rv-sub{display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;margin:.7rem 0 .1rem}',
    '.gm-rv-prog{margin:0;color:var(--ink-2,#5C6577);font:600 .85rem/1 var(--font-ui,system-ui,sans-serif);font-variant-numeric:tabular-nums}',
    '.gm-rv-back{display:none;align-items:center;gap:.4rem;min-height:40px;padding:0 .8rem;border:1px solid var(--line,#D9D2C3);border-radius:999px;background:transparent;color:var(--ink,#1B2230);font:600 .85rem/1 var(--font-ui,system-ui,sans-serif);cursor:pointer}',
    '.gm-rv-back .gm-icon{width:16px;height:16px}',
    '.gm-rv-planSvg{display:block;max-width:100%;height:auto;overflow:visible}',
    '.gm-rv-casing{fill:none;stroke:var(--bg-2,#fff);stroke-width:13;stroke-linecap:round;stroke-linejoin:round}',
    '.gm-rv-line{fill:none;stroke:var(--jc);stroke-width:7;stroke-linecap:round;stroke-linejoin:round}',
    '.gm-rv-line-in{fill:none;stroke:var(--bg-2,#fff);stroke-width:2.2;stroke-dasharray:5 6;opacity:.9}',
    '.gm-rv-stub{fill:none;stroke:var(--jc);stroke-width:3.5;stroke-linecap:round;opacity:.9}',
    '.gm-rv-chip{cursor:pointer;outline:none}',
    '.gm-rv-chip circle{fill:var(--jc);stroke:var(--bg-2,#fff);stroke-width:2;transition:stroke .15s}',
    '.gm-rv-chip:hover circle{stroke:var(--ink,#1B2230)}.gm-rv-chip:focus-visible circle{stroke:var(--accent,#05749E);stroke-width:3.5}',
    '.gm-rv-chip text{fill:var(--gk-on,#fff);font:700 11.5px var(--font-ui,system-ui,sans-serif);text-anchor:middle;dominant-baseline:central;pointer-events:none}',
    '.gm-rv-st{cursor:pointer;outline:none}',
    '.gm-rv-t{font:600 14.5px var(--font-ui,system-ui,sans-serif);fill:var(--ink,#1B2230)}',
    '.gm-rv-m{font:500 12px var(--font-ui,system-ui,sans-serif);fill:var(--ink-2,#5C6577)}',
    '.gm-rv-hit{fill:transparent}',
    '.gm-rv-hl{fill:none;stroke:var(--warm,#FCB300);stroke-width:3;opacity:0;transform-box:fill-box;transform-origin:center}',
    '.gm-rv-st:hover .gm-rv-t{text-decoration:underline;text-underline-offset:3px}',
    '.gm-rv-st:focus-visible .gm-rv-hl{opacity:1;stroke:var(--accent,#05749E)}',
    '.gm-rv-st.is-pulse .gm-rv-hl{animation:gm-rv-pulse 1.3s ease-out 3}',
    '@keyframes gm-rv-pulse{0%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.9)}}',

    /* Schmale Bildschirme: Legende wird zur Chip-Leiste über der Karte */
    '@media (max-width:860px){',
    '.gm-karte-stage{--gk-h:clamp(24rem,calc(100svh - var(--header-h,64px) - 13.5rem),44rem);grid-template-columns:minmax(0,1fr);gap:.8rem}',
    '.gm-karte-lg-cap{display:none}',
    '.gm-rv-chips{display:flex}',
    '.gm-rv-grid{grid-template-columns:minmax(0,1fr);gap:1rem}',
    '.gm-rv-left{position:static}',
    '.gm-rv-lead{display:none}',
    '.gm-rv-back{display:inline-flex}',
    '.gm-rv-head{grid-template-columns:auto minmax(0,1fr)}',
    '.gm-rv-hgo{grid-column:1/3}',
    '.gm-rv-plan{padding:.9rem .8rem 1rem}',

    '.gm-karte-legend{flex-direction:row;align-items:center;gap:.5rem;max-height:none;overflow-x:auto;overflow-y:hidden;padding:.15rem .1rem .55rem;margin:0 -.1rem;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:thin}',
    '.gm-karte-lg-g{display:flex;align-items:center;gap:.5rem;flex:none}',
    '.gm-karte-lg-h{margin:0;flex:none;writing-mode:horizontal-tb}',
    '.gm-karte-lg-h button{width:auto;min-height:0;padding:0;pointer-events:none;cursor:default}',
    '.gm-karte-lg-h button::after,.gm-karte-lg-h svg,.gm-karte-lg-c{display:none}',
    '.gm-karte-lg-g.is-collapsed .gm-karte-lg-list,.gm-karte-lg-list{display:flex;gap:.45rem}',
    '.gm-karte-lg-list li{flex:none;scroll-snap-align:start}',
    '.gm-karte-jb{display:inline-flex;align-items:center;gap:.5rem;width:auto;min-height:44px;padding:.3rem .8rem .3rem .35rem;border:1.5px solid var(--jc);border-radius:999px;background:var(--bg-2,#fff)}',
    '.gm-karte-jb-num{width:1.9rem;height:1.9rem}',
    '.gm-karte-jb-name{display:none}',
    '.gm-karte-jb-short{display:inline;font:600 .88rem/1 var(--font-ui,system-ui,sans-serif);white-space:nowrap}',
    '.gm-karte-jb-bar{display:none}',
    '.gm-karte-jb[aria-pressed="true"]{background:var(--gk-go,var(--jc));color:var(--gk-on,#fff);border-color:var(--jc);min-height:50px;padding-right:1rem;box-shadow:0 6px 16px -6px var(--jc)}',
    '.gm-karte-jb[aria-pressed="true"] .gm-karte-jb-short{font-size:1rem;font-weight:700}',
    '.gm-karte-jb[aria-pressed="true"] .gm-karte-jb-n{color:inherit}',
    '.gm-karte-jb[aria-pressed="true"] .gm-karte-jb-num{background:var(--gk-paper);color:var(--ink,#1B2230)}',
    '.gm-karte-keybox{display:none}',
    '.gm-karte-card{left:.5rem;right:.5rem;bottom:.5rem;max-width:none;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:.2rem .7rem;padding:.55rem .6rem .6rem .9rem}',
    '.gm-karte-card-h{grid-column:1/3;font-size:1rem}',
    '.gm-karte-card-tag{display:none}',
    '.gm-karte-card-prog{grid-column:1;grid-row:2;font-size:.85rem!important;line-height:1.25}',
    '.gm-karte-card-prog i{display:none}',
    '.gm-karte.is-focus .gm-karte-hint{opacity:0}',
    '.gm-karte-card-go{grid-column:2;grid-row:2;margin:0}',
    '.gm-karte-go{min-height:44px;padding:0 1rem}',
    '}',
    '@media (max-width:860px) and (pointer:fine){.gm-karte-hint{display:none}}',
    '@media (max-width:520px){.gm-karte-seg button{padding:0 .75rem;gap:.3rem;font-size:.84rem;white-space:nowrap}.gm-karte-seg .gm-icon{display:none}.gm-karte-ctl{top:auto;bottom:.75rem;right:.6rem}.gm-karte.is-focus .gm-karte-ctl{bottom:auto;top:.6rem}.gm-karte-bar{gap:.4rem}.gm-karte-sum{font-size:.85rem}}',
    '@media (prefers-reduced-motion:reduce){.gm-karte *{animation:none!important}.gm-karte-hl path,.gm-karte-jb-bar span,.gm-karte-card,.gm-karte-tip{transition:none!important}}'
  ].join('\n');

  function injectStyles() {
    if (doc.getElementById('gm-karte-style')) return;
    var s = doc.createElement('style');
    s.id = 'gm-karte-style';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Modell: Reisen, Knoten, Kanten
   * ------------------------------------------------------------------ */

  function buildModel() {
    var D = M.data || {};
    var S = D.stations || {};
    var orders = D.orders || {};
    var journeys = [], byId = {}, nodes = {}, list = [];

    (D.journeys || []).forEach(function (j) {
      if (!j || j.id === 'rundreise' || j.virtual) return;
      var ord = (orders[j.id] || []).filter(function (id, i, a) { return S[id] && a.indexOf(id) === i; });
      if (!ord.length) return;
      var jj = { id: j.id, def: j, typ: j.typ === 'historisch' ? 'historisch' : 'funktional', order: ord, idx: journeys.length, num: journeys.length + 1 };
      journeys.push(jj);
      byId[j.id] = jj;
    });

    // Liniennummern in Legendenreihenfolge: erst die funktionalen, dann die historischen Reisen
    var numN = 0;
    ['funktional', 'historisch'].forEach(function (g) { journeys.forEach(function (jj) { if (jj.typ === g) jj.num = ++numN; }); });

    journeys.forEach(function (jj) {
      jj.order.forEach(function (id) {
        var n = nodes[id];
        if (!n) {
          var st = S[id];
          n = nodes[id] = {
            id: id, st: st, js: [], x: 0, y: 0, idx: list.length,
            title: st.title || id, label: shortTitle(st.title || id),
            kind: st.kind, myth: st.kind === 'mythos', exhibit: !!st.exhibit
          };
          list.push(n);
        }
        if (n.js.indexOf(jj.id) < 0) n.js.push(jj.id);
      });
    });

    // Kanten und geteilte Kanten (zwei Reisen auf demselben Abschnitt)
    var shared = {};
    journeys.forEach(function (jj) {
      jj.edges = [];
      for (var i = 0; i + 1 < jj.order.length; i++) {
        var a = jj.order[i], b = jj.order[i + 1];
        var key = a < b ? a + '|' + b : b + '|' + a;
        jj.edges.push(key);
        (shared[key] = shared[key] || []).push(jj.id);
      }
    });
    return { journeys: journeys, byId: byId, nodes: nodes, list: list, shared: shared };
  }

  function modelSignature(model) {
    var sm = skinMap();
    return model.list.length + ':' + model.journeys.map(function (j) { return j.id + j.order.length; }).join(',') + '|' + sm.lines + '|' + sm.nodes;
  }

  /* ------------------------------------------------------------------ *
   * Layout: SEED (vorberechnet) oder Kräfte-Layout
   * ------------------------------------------------------------------ */

  // Reihenfolge der Reisen auf dem Ankerkreis: Reisen mit vielen gemeinsamen Stationen liegen nebeneinander
  function ringOrder(model) {
    var js = model.journeys, m = js.length, i, j;
    if (m < 3) return js.map(function (x) { return x.idx; });
    var w = [];
    for (i = 0; i < m; i++) { w.push(new Array(m).fill(0)); }
    model.list.forEach(function (n) {
      for (i = 0; i < n.js.length; i++) for (j = i + 1; j < n.js.length; j++) {
        var a = model.byId[n.js[i]].idx, b = model.byId[n.js[j]].idx;
        w[a][b]++; w[b][a]++;
      }
    });
    function cost(p) {
      var c = 0;
      for (var a = 0; a < m; a++) for (var b = a + 1; b < m; b++) {
        var d = Math.min(b - a, m - (b - a));
        c += w[p[a]][p[b]] * d * d;
        if (js[p[a]].typ === js[p[b]].typ) c += 0.35 * d;
      }
      return c;
    }
    var best = null, bestC = Infinity;
    if (m <= 9) {
      var perm = [0], used = new Array(m).fill(false);
      used[0] = true;
      (function rec() {
        if (perm.length === m) { var c = cost(perm); if (c < bestC - 1e-9) { bestC = c; best = perm.slice(); } return; }
        for (var q = 1; q < m; q++) {
          if (used[q]) continue;
          used[q] = true; perm.push(q); rec(); perm.pop(); used[q] = false;
        }
      })();
    } else {
      // Viele Reisen: deterministisches Simulated Annealing (Vertauschen und Verschieben) auf der Ringreihenfolge
      var rnd = rngFor(9091), cur = js.map(function (x) { return x.idx; }), cc = cost(cur);
      best = cur.slice(); bestC = cc;
      var steps = 9000 + 900 * m;
      for (var st = 0; st < steps; st++) {
        var T = 2.2 * Math.pow(0.004, st / steps) * (bestC / m + 1) * 0.25 + 1e-6;
        var nxt = cur.slice(), p = (rnd() * m) | 0, q2 = (rnd() * m) | 0;
        if (p === q2) continue;
        if (rnd() < 0.5) { var tmp = nxt[p]; nxt[p] = nxt[q2]; nxt[q2] = tmp; }
        else { var mv = nxt.splice(p, 1)[0]; nxt.splice(q2, 0, mv); }
        var nc = cost(nxt);
        if (nc <= cc || rnd() < Math.exp((cc - nc) / T)) {
          cur = nxt; cc = nc;
          if (cc < bestC - 1e-9) { bestC = cc; best = cur.slice(); }
        }
      }
    }
    return best;
  }

  function forceLayout(model) {
    var list = model.list, n = list.length, rnd = rngFor(20240607);
    var sc = Math.max(1, Math.sqrt(n / 100));
    var W = 1300 * sc, H = 900 * sc, cx = W / 2, cy = H / 2;
    var ring = ringOrder(model), slot = {};
    ring.forEach(function (ji, s) { slot[model.journeys[ji].id] = s; });
    var nj = model.journeys.length;
    var X = new Float64Array(n), Y = new Float64Array(n), TX = new Float64Array(n), TY = new Float64Array(n);
    var idxOf = {};
    list.forEach(function (nd, i) { idxOf[nd.id] = i; });

    list.forEach(function (nd, i) {
      var sx = 0, sy = 0;
      nd.js.forEach(function (jid) {
        var jj = model.byId[jid];
        var t = jj.order.length > 1 ? jj.order.indexOf(nd.id) / (jj.order.length - 1) : 0.5;
        var th = -Math.PI / 2 + 2 * Math.PI * slot[jid] / nj + (t - 0.5) * 0.95 * (2 * Math.PI / nj);
        sx += Math.cos(th) * W * 0.36; sy += Math.sin(th) * H * 0.36;
      });
      TX[i] = cx + sx / nd.js.length; TY[i] = cy + sy / nd.js.length;
      X[i] = TX[i] + (rnd() - 0.5) * 40; Y[i] = TY[i] + (rnd() - 0.5) * 40;
    });

    var edges = [], seen = {}, triples = [];
    model.journeys.forEach(function (jj) {
      for (var k = 0; k + 1 < jj.order.length; k++) {
        var a = idxOf[jj.order[k]], b = idxOf[jj.order[k + 1]];
        var key = a < b ? a + '_' + b : b + '_' + a;
        if (!seen[key]) { seen[key] = 1; edges.push([a, b]); }
        if (k + 2 < jj.order.length) triples.push([a, b, idxOf[jj.order[k + 2]]]);
      }
    });

    var L = 62, DMIN = 50, iters = 520;
    var VX = new Float64Array(n), VY = new Float64Array(n);
    var FX = new Float64Array(n), FY = new Float64Array(n);
    for (var it = 0; it < iters; it++) {
      var cool = 1 - it / iters;
      FX.fill(0); FY.fill(0);
      var a, b, dx, dy, d2, d, f;
      for (a = 0; a < n; a++) for (b = a + 1; b < n; b++) {
        dx = X[a] - X[b]; dy = Y[a] - Y[b]; d2 = dx * dx + dy * dy;
        if (d2 > 220 * 220) continue;
        if (d2 < 1) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = 1; }
        d = Math.sqrt(d2); f = 2800 / d2;
        if (d < DMIN) f += (DMIN - d) * 0.35;
        FX[a] += dx / d * f; FY[a] += dy / d * f; FX[b] -= dx / d * f; FY[b] -= dy / d * f;
      }
      for (var e = 0; e < edges.length; e++) {
        a = edges[e][0]; b = edges[e][1];
        dx = X[b] - X[a]; dy = Y[b] - Y[a]; d = Math.sqrt(dx * dx + dy * dy) || 1;
        f = 0.12 * (d - L) / d;
        FX[a] += dx * f; FY[a] += dy * f; FX[b] -= dx * f; FY[b] -= dy * f;
      }
      for (var t = 0; t < triples.length; t++) {
        var p = triples[t], mx = (X[p[0]] + X[p[2]]) / 2, my = (Y[p[0]] + Y[p[2]]) / 2;
        var kx = (mx - X[p[1]]) * 0.07, ky = (my - Y[p[1]]) * 0.07;
        FX[p[1]] += kx; FY[p[1]] += ky; FX[p[0]] -= kx / 2; FY[p[0]] -= ky / 2; FX[p[2]] -= kx / 2; FY[p[2]] -= ky / 2;
      }
      for (var i = 0; i < n; i++) {
        FX[i] += (TX[i] - X[i]) * (0.01 + 0.02 * cool); FY[i] += (TY[i] - Y[i]) * (0.01 + 0.02 * cool);
        VX[i] = (VX[i] + FX[i] * 0.5) * 0.6; VY[i] = (VY[i] + FY[i] * 0.5) * 0.6;
        var sp = Math.sqrt(VX[i] * VX[i] + VY[i] * VY[i]), cap = 22 * (0.3 + 0.7 * cool);
        if (sp > cap) { VX[i] *= cap / sp; VY[i] *= cap / sp; }
        X[i] += VX[i]; Y[i] += VY[i];
      }
    }
    // harte Entzerrung: keine überlappenden Knoten
    for (var r = 0; r < 120; r++) {
      var moved = false;
      for (var a2 = 0; a2 < n; a2++) for (var b2 = a2 + 1; b2 < n; b2++) {
        var ddx = X[b2] - X[a2], ddy = Y[b2] - Y[a2], dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd < DMIN) {
          moved = true;
          var push = (DMIN - dd) / 2 + 0.01, ux = dd > 0.01 ? ddx / dd : 1, uy = dd > 0.01 ? ddy / dd : 0;
          X[a2] -= ux * push; Y[a2] -= uy * push; X[b2] += ux * push; Y[b2] += uy * push;
        }
      }
      if (!moved) break;
    }
    var out = {};
    list.forEach(function (nd, i) { out[nd.id] = [X[i], Y[i]]; });
    return out;
  }

  // Positionen aus SEED übernehmen, Unbekannte aus den Nachbarn ableiten
  function seedLayout(model) {
    if (!SEED) return null;
    var list = model.list, have = 0;
    list.forEach(function (n) { if (SEED[n.id]) have++; });
    if (have < list.length * 0.7) return null;
    var pos = {};
    list.forEach(function (n) { if (SEED[n.id]) pos[n.id] = [SEED[n.id][0] * SEED_CELL, SEED[n.id][1] * SEED_CELL]; });
    var missing = list.filter(function (n) { return !pos[n.id]; });
    if (missing.length) {
      var rnd = rngFor(77);
      for (var pass = 0; pass < 6; pass++) {
        missing.forEach(function (n) {
          var sx = 0, sy = 0, c = 0;
          n.js.forEach(function (jid) {
            var o = model.byId[jid].order, i = o.indexOf(n.id);
            [i - 1, i + 1].forEach(function (q) { if (q >= 0 && q < o.length && pos[o[q]]) { sx += pos[o[q]][0]; sy += pos[o[q]][1]; c++; } });
          });
          if (c) pos[n.id] = [sx / c + (rnd() - 0.5) * 30, sy / c + (rnd() - 0.5) * 30];
        });
      }
      missing.forEach(function (n) { if (!pos[n.id]) pos[n.id] = [SEED_W * SEED_CELL / 2 + (rnd() - 0.5) * 200, SEED_H * SEED_CELL / 2 + (rnd() - 0.5) * 200]; });
      // nur die neuen Knoten abstoßen
      var isNew = {};
      missing.forEach(function (n) { isNew[n.id] = true; });
      for (var r = 0; r < 80; r++) {
        var moved = false;
        for (var i2 = 0; i2 < list.length; i2++) for (var j2 = i2 + 1; j2 < list.length; j2++) {
          var A = list[i2], B = list[j2];
          if (!isNew[A.id] && !isNew[B.id]) continue;
          var pa = pos[A.id], pb = pos[B.id], dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.sqrt(dx * dx + dy * dy);
          if (d < 46) {
            moved = true;
            var push = (46 - d) + 0.01, ux = d > 0.01 ? dx / d : 1, uy = d > 0.01 ? dy / d : 0;
            if (isNew[A.id] && isNew[B.id]) { pa[0] -= ux * push / 2; pa[1] -= uy * push / 2; pb[0] += ux * push / 2; pb[1] += uy * push / 2; }
            else if (isNew[A.id]) { pa[0] -= ux * push; pa[1] -= uy * push; }
            else { pb[0] += ux * push; pb[1] += uy * push; }
          }
        }
        if (!moved) break;
      }
    }
    return pos;
  }

  // Vollständiger Plan im Raster: oktilineares Netzplan-Layout (Positionen und Knicke aus SEED/BEND)
  function octiLayout(model) {
    if (!SEED) return null;
    var pos = {}, ok = true;
    model.list.forEach(function (n) {
      if (!SEED[n.id]) { ok = false; return; }
      pos[n.id] = [SEED[n.id][0] * SEED_CELL, SEED[n.id][1] * SEED_CELL];
    });
    return ok ? pos : null;
  }

  var LAYOUT_PAD = 46;
  function computeLayout(model) {
    loadLayout();
    var pos = octiLayout(model);
    model.octi = !!pos;
    if (!pos) pos = seedLayout(model) || forceLayout(model);
    var minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    model.list.forEach(function (n) {
      var p = pos[n.id];
      minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]);
    });
    model.list.forEach(function (n) {
      n.bx = pos[n.id][0] - minx + LAYOUT_PAD;
      n.by = pos[n.id][1] - miny + LAYOUT_PAD;
    });
    model.bendBase = {};
    if (model.octi) {
      Object.keys(model.shared).forEach(function (key) {
        if (BEND[key]) model.bendBase[key] = [BEND[key][0] * SEED_CELL - minx + LAYOUT_PAD, BEND[key][1] * SEED_CELL - miny + LAYOUT_PAD];
      });
    }
    // wichtigste Kreuzungen (für die Gesamtansicht): viele Reisen, Exponat, räumlich gestreut
    var cr = model.list.filter(function (n) { return n.js.length > 1; }).sort(function (a, b) { return b.js.length - a.js.length || (b.exhibit ? 1 : 0) - (a.exhibit ? 1 : 0) || a.idx - b.idx; });
    var top = [], dmin = Math.sqrt((maxx - minx) * (maxy - miny) / 12) * 0.5;
    cr.forEach(function (n) {
      if (top.length >= 11) return;
      if (top.every(function (t) { return Math.hypot(t.bx - n.bx, t.by - n.by) > dmin; })) top.push(n);
    });
    model.top = {};
    top.forEach(function (n) { model.top[n.id] = true; });
    model.baseW = maxx - minx + 2 * LAYOUT_PAD;
    model.baseH = maxy - miny + 2 * LAYOUT_PAD;
  }

  // Drehung um 90 Grad für hochformatige Fenster (Beschriftungen bleiben waagerecht)
  function orient(model, rotated) {
    model.rotated = !!rotated;
    model.W = rotated ? model.baseH : model.baseW;
    model.H = rotated ? model.baseW : model.baseH;
    model.list.forEach(function (n) {
      if (rotated) { n.x = model.baseH - n.by; n.y = n.bx; } else { n.x = n.bx; n.y = n.by; }
    });
    model.bend = {};
    Object.keys(model.bendBase).forEach(function (key) {
      var b = model.bendBase[key];
      model.bend[key] = rotated ? [model.baseH - b[1], b[0]] : [b[0], b[1]];
    });
    model.segs = Object.keys(model.shared).map(function (key) {
      var q = key.split('|'), A = model.nodes[q[0]], B = model.nodes[q[1]];
      return [A.x, A.y, B.x, B.y, q[0], q[1]];
    });
  }

  /* ------------------------------------------------------------------ *
   * Geometrie: weiche Fäden (zentripetale Catmull-Rom-Kurven)
   * ------------------------------------------------------------------ */

  function f1(v) { return (Math.round(v * 10) / 10).toString(); }

  function curveSegments(pts) {
    var n = pts.length, segs = [];
    if (n < 2) return segs;
    var P = pts.slice();
    P.unshift([2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]]);
    P.push([2 * pts[n - 1][0] - pts[n - 2][0], 2 * pts[n - 1][1] - pts[n - 2][1]]);
    for (var i = 1; i < P.length - 2; i++) {
      var p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      var d1 = Math.pow(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), 0.5) || 1;
      var d2 = Math.pow(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), 0.5) || 1;
      var d3 = Math.pow(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]), 0.5) || 1;
      var b1 = [0, 1].map(function (k) { return (d1 * d1 * p2[k] - d2 * d2 * p0[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) / (3 * d1 * (d1 + d2)); });
      var b2 = [0, 1].map(function (k) { return (d3 * d3 * p1[k] - d2 * d2 * p3[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) / (3 * d3 * (d3 + d2)); });
      segs.push({ p1: p1, p2: p2, c1: b1, c2: b2 });
    }
    return segs;
  }

  // Linienzug mit weich gerundeten Ecken (Netzplan-Optik). r: Radius; rBend (optional): größerer Radius an Knickpunkten,
  // die keine Station sind (isStop(x, y) sagt, ob an der Stelle eine Station liegt) -> weiche Kurven statt Knicke
  function roundedPath(pts, r, rBend, isStop) {
    var d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var p = pts[i - 1], v = pts[i], q = pts[i + 1];
      var l1 = Math.hypot(v[0] - p[0], v[1] - p[1]), l2 = Math.hypot(q[0] - v[0], q[1] - v[1]);
      if (!l1 || !l2) continue;
      var rad = (rBend && isStop && !isStop(v[0], v[1])) ? rBend : r;
      var rr = Math.min(rad, l1 / 2, l2 / 2);
      d += ' L' + f1(v[0] + (p[0] - v[0]) / l1 * rr) + ' ' + f1(v[1] + (p[1] - v[1]) / l1 * rr) +
        ' Q' + f1(v[0]) + ' ' + f1(v[1]) + ' ' + f1(v[0] + (q[0] - v[0]) / l2 * rr) + ' ' + f1(v[1] + (q[1] - v[1]) / l2 * rr);
    }
    var L = pts[pts.length - 1];
    return d + ' L' + f1(L[0]) + ' ' + f1(L[1]);
  }

  // Kante a->b als Punktliste (ohne a, mit Knick bei nicht-oktilinearen Abschnitten). prev: Richtung der vorigen Kante (Winkel) für die Wahl der Knickrichtung
  function edgePts(model, A, B, prev) {
    var dx = B.x - A.x, dy = B.y - A.y, adx = Math.abs(dx), ady = Math.abs(dy);
    var key = A.id < B.id ? A.id + '|' + B.id : B.id + '|' + A.id, bend = model.bend[key];
    if (bend) return [bend, [B.x, B.y]];
    if (adx < 0.5 || ady < 0.5 || Math.abs(adx - ady) < 0.5) return [[B.x, B.y]];
    var sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, m = Math.min(adx, ady);
    var c0 = [A.x + sx * m, A.y + sy * m], c1 = [B.x - sx * m, B.y - sy * m];
    if (prev !== undefined) {
      var t0 = angDiff(Math.atan2(c0[1] - A.y, c0[0] - A.x), prev), t1 = angDiff(Math.atan2(c1[1] - A.y, c1[0] - A.x), prev);
      return [t1 < t0 - 1e-6 ? c1 : c0, [B.x, B.y]];
    }
    return [c0, [B.x, B.y]];
  }
  function angDiff(a, b) { var d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; }

  // Punktliste um off verschieben (Doppelfäden); Ecken werden gemittelt, an den Enden bleibt ein Stück ohne Versatz
  function offsetPts(pts, off) {
    var n = pts.length, i, u = [], nr = [], L = [];
    for (i = 0; i + 1 < n; i++) {
      var dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy) || 1;
      u.push([dx / l, dy / l]); nr.push([-dy / l, dx / l]); L.push(l);
    }
    var out = [pts[0]], s0 = Math.min(L[0] * 0.28, 20);
    out.push([pts[0][0] + u[0][0] * s0 + nr[0][0] * off, pts[0][1] + u[0][1] * s0 + nr[0][1] * off]);
    for (i = 1; i + 1 < n; i++) {
      var c = 1 + nr[i - 1][0] * nr[i][0] + nr[i - 1][1] * nr[i][1] || 1;
      out.push([pts[i][0] + off * (nr[i - 1][0] + nr[i][0]) / c, pts[i][1] + off * (nr[i - 1][1] + nr[i][1]) / c]);
    }
    var k = n - 2, s1 = Math.min(L[k] * 0.28, 20);
    out.push([pts[n - 1][0] - u[k][0] * s1 + nr[k][0] * off, pts[n - 1][1] - u[k][1] * s1 + nr[k][1] * off]);
    out.push(pts[n - 1]);
    return out;
  }

  // Reise als Punktliste (ohne Endmarken)
  function journeyPts(model, jj) {
    var first = model.nodes[jj.order[0]], pts = [[first.x, first.y]], prev;
    for (var i = 0; i + 1 < jj.order.length; i++) {
      var A = model.nodes[jj.order[i]], B = model.nodes[jj.order[i + 1]], who = model.shared[jj.edges[i]];
      var ep = edgePts(model, A, B, prev), j2;
      if (who && who.length > 1) {
        // Zwei oder mehr Reisen auf demselben Abschnitt: als Bündel nebeneinander legen (in fester Richtung, damit alle gleich liegen)
        var lo = A.id < B.id ? A : B, hi = lo === A ? B : A;
        var cp = [[lo.x, lo.y]].concat(edgePts(model, lo, hi));
        var off = (who.indexOf(jj.id) - (who.length - 1) / 2) * 6.4;
        var op = offsetPts(cp, off);
        if (lo !== A) op.reverse();
        ep = op.slice(1);
      }
      for (j2 = 0; j2 < ep.length; j2++) pts.push(ep[j2]);
      var q = pts[pts.length - 2], r = pts[pts.length - 1];
      prev = Math.atan2(r[1] - q[1], r[0] - q[0]);
    }
    return pts;
  }

  // Endmarken: an beiden Enden jeder Reise ein kurzes Stück Strecke mit der Liniennummer. Richtung mit dem meisten Platz
  var STUB = 31;
  function chooseStub(model, n, toward) {
    var best = null, bs = -Infinity, base = Math.atan2(n.y - toward[1], n.x - toward[0]), d, i;
    for (d = 0; d < 8; d++) {
      var a = d * Math.PI / 4, tx = n.x + Math.cos(a) * STUB, ty = n.y + Math.sin(a) * STUB;
      var clear = 70, ad = angDiff(a, base);
      for (i = 0; i < model.list.length; i++) {
        var o = model.list[i];
        if (o === n) continue;
        var dd = Math.hypot(o.x - tx, o.y - ty);
        if (dd < clear) clear = dd;
      }
      if (model.segs) for (i = 0; i < model.segs.length; i++) {
        var sg = model.segs[i];
        if (sg[4] === n.id || sg[5] === n.id) continue;
        var vx = sg[2] - sg[0], vy = sg[3] - sg[1], l2 = vx * vx + vy * vy || 1;
        var t = clamp(((tx - sg[0]) * vx + (ty - sg[1]) * vy) / l2, 0, 1);
        var e = Math.hypot(sg[0] + vx * t - tx, sg[1] + vy * t - ty);
        if (e < clear) clear = e;
      }
      var sc = Math.min(clear, 34) - ad * 5.5;
      if (sc > bs + 1e-6) { bs = sc; best = [tx, ty, a]; }
    }
    return best;
  }

  function journeyPath(model, jj) {
    var pts, d;
    if (model.octi) pts = journeyPts(model, jj);
    else {
      pts = jj.order.map(function (id) { var n = model.nodes[id]; return [n.x, n.y]; });
      var segs = curveSegments(pts);
      d = 'M' + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
      segs.forEach(function (sg, i) {
        var key = jj.edges[i], who = model.shared[key], c1 = sg.c1, c2 = sg.c2;
        if (who && who.length > 1) {
          // Zwei Reisen auf demselben Abschnitt: als Doppelfaden nebeneinander legen
          var parts = key.split('|'), na = model.nodes[parts[0]], nb = model.nodes[parts[1]];
          var dx = nb.x - na.x, dy = nb.y - na.y, len = Math.hypot(dx, dy) || 1;
          var off = (who.indexOf(jj.id) - (who.length - 1) / 2) * 6.2;
          var ox = -dy / len * off, oy = dx / len * off;
          c1 = [c1[0] + ox, c1[1] + oy]; c2 = [c2[0] + ox, c2[1] + oy];
        }
        d += ' C' + f1(c1[0]) + ' ' + f1(c1[1]) + ' ' + f1(c2[0]) + ' ' + f1(c2[1]) + ' ' + f1(sg.p2[0]) + ' ' + f1(sg.p2[1]);
      });
    }
    var n0 = model.nodes[jj.order[0]], n1 = model.nodes[jj.order[jj.order.length - 1]];
    var p0 = pts.length > 1 ? pts[1] : [n0.x - 1, n0.y], p1 = pts.length > 1 ? pts[pts.length - 2] : [n1.x - 1, n1.y];
    var s0 = chooseStub(model, n0, p0), s1 = chooseStub(model, n1, p1);
    jj.tags = [s0, s1];
    if (!model.octi) {
      return 'M' + f1(s0[0]) + ' ' + f1(s0[1]) + ' L' + f1(n0.x) + ' ' + f1(n0.y) + d.slice(d.indexOf(' C')) + ' L' + f1(s1[0]) + ' ' + f1(s1[1]);
    }
    pts.unshift([s0[0], s0[1]]);
    pts.push([s1[0], s1[1]]);
    if (skinMap().lines === 'smooth') {
      var stop = {};
      jj.order.forEach(function (id) { var nd = model.nodes[id]; stop[Math.round(nd.x * 2) + ',' + Math.round(nd.y * 2)] = true; });
      return roundedPath(pts, 17, 56, function (x, y) { return stop[Math.round(x * 2) + ',' + Math.round(y * 2)]; });
    }
    return roundedPath(pts, 17);
  }

  /* ------------------------------------------------------------------ *
   * Knoten-Symbole
   * ------------------------------------------------------------------ */

  var SPARK = 'M0 -4.6L1.25 -1.25L4.6 0L1.25 1.25L0 4.6L-1.25 1.25L-4.6 0L-1.25 -1.25Z';

  function arcPath(r, a0, a1) {
    var x0 = r * Math.cos(a0), y0 = r * Math.sin(a0), x1 = r * Math.cos(a1), y1 = r * Math.sin(a1);
    return 'M' + f1(x0) + ' ' + f1(y0) + ' A' + r + ' ' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + f1(x1) + ' ' + f1(y1);
  }

  // Haltepunkt-Formen je Reise (Skin map.nodes === 'shapes'): Kreis, Quadrat, Dreieck, Raute, Fünfeck, Sechseck, dann wieder von vorn.
  // Kreis = null (normaler Punkt). Die Form hängt an der Nummer der Reise, nicht an der Station.
  var SHAPES = [null,
    'M-5.3 -5.3H5.3V5.3H-5.3Z',
    'M0 -7.3L6.9 4.7H-6.9Z',
    'M0 -7.6L7.6 0L0 7.6L-7.6 0Z',
    'M0 -7L6.7 -2.2L4.1 5.7H-4.1L-6.7 -2.2Z',
    'M-3.4 -6L3.4 -6L6.8 0L3.4 6L-3.4 6L-6.8 0Z'];
  function shapePath(jid) {
    if (skinMap().nodes !== 'shapes') return null;
    var jj = V.model && V.model.byId && V.model.byId[jid];
    return SHAPES[(jj ? jj.idx : 0) % SHAPES.length];
  }

  // Symbol in Einheiten um (0,0); liefert {outer, parts}
  function drawGlyph(g, o) {
    var js = o.js, cross = js.length > 1, outer = cross ? 12 : 8.9, i;
    if (o.glow !== false) svgEl('circle', { class: 'gm-karte-glow', r: outer + 15 }, g);
    if (o.focusRing !== false) svgEl('circle', { class: 'gm-karte-fr', r: outer + 4.2 }, g);
    if (o.pulse) svgEl('circle', { class: 'gm-karte-pulse', r: outer + 2, style: 'transform-box:fill-box;transform-origin:center' }, g);
    if (o.myth) {
      var m = svgEl('circle', { class: 'gm-karte-myth' + (cross ? ' is-x' : ''), r: outer + 3.3 }, g);
      if (!cross) m.setAttribute('style', '--jc:var(--j-' + js[0] + ')');
    }
    svgEl('circle', { class: 'gm-karte-halo', r: outer }, g);
    if (cross) {
      var n = js.length, gap = 0.2, start = -Math.PI / 2;
      for (i = 0; i < n; i++) {
        var a0 = start + 2 * Math.PI * i / n + gap / 2, a1 = start + 2 * Math.PI * (i + 1) / n - gap / 2;
        svgEl('path', { class: 'gm-karte-arc', d: arcPath(8.2, a0, a1), style: '--jc:var(--j-' + js[i] + ')' }, g);
      }
      svgEl('circle', { class: 'gm-karte-core is-x', r: 6.2 }, g);
    } else {
      var shp = shapePath(js[0]);
      if (shp) svgEl('path', { class: 'gm-karte-dot', d: shp, style: '--jc:var(--j-' + js[0] + ')' }, g);
      else svgEl('circle', { class: 'gm-karte-dot', r: 6.3, style: '--jc:var(--j-' + js[0] + ')' }, g);
      svgEl('circle', { class: 'gm-karte-lit', r: 2.5 }, g);
    }
    if (o.exhibit) {
      var sp = svgEl('path', { class: 'gm-karte-spark', d: SPARK, transform: 'translate(' + f1(outer * 0.74 + 1.6) + ' ' + f1(-(outer * 0.74 + 1.6)) + ')' }, g);
      if (o.delay !== undefined) sp.setAttribute('style', '--d:' + o.delay + 's');
    }
    return outer;
  }

  function keyGlyph(o) {
    var s = svgEl('svg', { viewBox: '-17 -17 34 34', 'aria-hidden': 'true', focusable: 'false' });
    var g = svgEl('g', { class: 'gm-karte-kn' + (o.visited ? ' is-visited' : '') }, s);
    var inner = svgEl('g', { class: 'gm-karte-nd', style: 'transform:none' }, g);
    drawGlyph(inner, { js: o.js, myth: o.myth, exhibit: o.exhibit, focusRing: false, glow: !!o.visited });
    return s;
  }

  /* ------------------------------------------------------------------ *
   * Die Ansicht
   * ------------------------------------------------------------------ */

  var V = {
    built: false, shown: false, root: null,
    model: null, sig: '',
    vp: null, svg: null, world: null, nodesG: null, labelsG: null, hl: null,
    tip: null, card: null, hint: null, live: null,
    legendBtns: {}, listItems: null,
    vw: 0, vh: 0, k: 1, tx: 0, ty: 0, kfit: 1, interacted: false,
    focusJ: null, selJ: null, mode: 'reisen', hoverId: null, listMode: false, pending: null,
    ptrs: {}, drag: null, pinch: null, lastDragEnd: 0, tween: null,
    raf: 0, lastK: 0, labelRaf: 0, unsub: null, ro: null,
    nodeEls: {}, lineEls: {}, labelEls: {}, summary: null, stage: null, listEl: null, segBtns: {}, reserve: 0
  };

  /* ---------- Aufbau ---------- */

  function mount(host) {
    injectStyles();
    V.host = host;
    host.innerHTML = '';
    V.root = h('div', { class: 'gm-karte gm-container' });
    host.appendChild(V.root);
    build();
    if (!V.unsub && M.store && M.store.onChange) V.unsub = M.store.onChange(onStore);
    if (spAn() && !V.spOff) V.spOff = M.spiel.bei('aenderung', function () { try { spAlle(); } catch (e) { /* egal */ } });
    if (!V.themeBound) {
      V.themeBound = true;
      doc.addEventListener('gm:theme', function () { paintOn(); });
      // Skinwechsel: Karte neu zeichnen (Linienform, Haltepunkt-Formen, Farben)
      doc.addEventListener('gm:skin', function () {
        if (!V.root || !V.built) return;
        V.sig = '';
        if (V.shown) { ensureCurrent(); if (V.mode === 'netz') onResize(true); }
        paintOn();
      });
    }
    if (window.ResizeObserver) {
      V.ro = new ResizeObserver(function () { if (V.shown) { onResize(); onRvResize(); } });
    }
  }

  function build() {
    var root = V.root;
    cancelTween();
    if (V.ro) { V.ro.disconnect(); V.roBound = false; V.rvBound = false; }
    root.innerHTML = '';
    V.nodeEls = {}; V.lineEls = {}; V.labelEls = {}; V.legendBtns = {}; V.segBtns = {}; V.onEls = [];
    V.model = buildModel();
    V.sig = modelSignature(V.model);
    V.focusJ = null; V.hoverId = null; V.reserve = 0;
    var model = V.model;

    if (!model.list.length) {
      root.appendChild(h('p', { class: 'gm-karte-empty', role: 'status' }, ('Der ' + M.t('networkMap') + ' wird gerade eingerichtet. Schau gleich noch einmal vorbei.')));
      V.built = true;
      return;
    }
    computeLayout(model);
    orient(model, false);

    /* Kopfzeile */
    V.summary = h('p', { class: 'gm-karte-sum', 'aria-live': 'off' });
    var segRv = h('button', { type: 'button', 'aria-pressed': 'true', on: { click: function () { setMode('reisen', true); } }, html: icon('compass', 18) + ('<span>' + M.t('journeys') + '</span>') });
    var segNet = h('button', { type: 'button', 'aria-pressed': 'false', on: { click: function () { setMode('netz', true); } }, html: icon('map', 18) + '<span>Gesamtnetz</span>' });
    var segList = h('button', { type: 'button', 'aria-pressed': 'false', on: { click: function () { setMode('liste', true); } }, html: icon('checklist', 18) + '<span>Als Liste</span>' });
    V.segBtns = { reisen: segRv, netz: segNet, list: segList };
    root.appendChild(h('div', { class: 'gm-karte-bar' },
      h('div', { class: 'gm-karte-seg', role: 'group', 'aria-label': 'Darstellung der Karte' }, segRv, segNet, segList),
      V.summary));

    /* Bühne */
    V.note = h('p', { class: 'gm-karte-note' }, ('Dichte Gesamtansicht: Wähle links eine ' + M.t('journey') + ' für mehr Klarheit, oder zoome hinein, um die Stationsnamen zu lesen.'));
    root.appendChild(V.note);
    V.stage = h('div', { class: 'gm-karte-stage' }, buildLegend(), buildViewport());
    root.appendChild(V.stage);
    root.appendChild(buildRv());
    if (V.selJ && !V.model.byId[V.selJ]) V.selJ = null;

    /* Liste */
    V.listEl = buildList();
    V.listEl.hidden = true;
    root.appendChild(V.listEl);

    applyGeometry();
    onStore();
    paintOn();
    var saved = M.store && M.store.get ? M.store.get('kartenmodus2', 'reisen') : 'reisen';
    setMode(saved === 'liste' || saved === 'netz' ? saved : 'reisen', false);
    V.built = true;
    V.lastW = 0;
  }

  function buildLegend() {
    var model = V.model;
    var legend = h('nav', { class: 'gm-karte-legend', 'aria-label': (M.t('journeys') + ' auswählen und hervorheben') });
    V.legend = legend;
    legend.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && V.focusJ && !e.altKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); e.stopPropagation(); setFocus(null, { announce: true }); }
    });
    legend.appendChild(h('p', { class: 'gm-karte-lg-cap' }, ('Wähle hier eine ' + M.t('journey') + ': Ihr Faden leuchtet im Plan auf, alle anderen treten zurück. Die Nummer steht an den Linienenden.')));
    [['funktional', M.typeLabel('funktional')], ['historisch', M.typeLabel('historisch')]].forEach(function (g) {
      var items = model.journeys.filter(function (j) { return j.typ === g[0]; });
      if (!items.length) return;
      var hid = 'gm-karte-lg-' + g[0], lid = hid + '-liste';
      var ul = h('ul', { class: 'gm-karte-lg-list', id: lid });
      items.forEach(function (jj) {
        var def = jj.def;
        var btn = h('button', {
          type: 'button', class: 'gm-karte-jb', 'aria-pressed': 'false', title: def.name, style: { '--jc': 'var(--j-' + jj.id + ')' }, dataset: { journey: jj.id },
          on: {
            click: function () { setFocus(V.focusJ === jj.id ? null : jj.id, { announce: true }); },
            mouseenter: function () { setPeek(jj.id); }, mouseleave: function () { setPeek(null); },
            focus: function () { setPeek(jj.id); }, blur: function () { setPeek(null); }
          }
        },
          h('span', { class: 'gm-karte-jb-num', 'aria-hidden': 'true' }, String(jj.num)),
          h('span', { class: 'gm-karte-jb-name' }, def.kurz || def.name),
          h('span', { class: 'gm-karte-jb-short' }, def.kurz || def.name),
          h('span', { class: 'gm-karte-jb-n' }),
          h('span', { class: 'gm-karte-jb-bar', 'aria-hidden': 'true' }, h('span')));
        V.legendBtns[jj.id] = { btn: btn, n: btn.querySelector('.gm-karte-jb-n'), bar: btn.querySelector('.gm-karte-jb-bar span'), jj: jj };
        V.onEls.push([btn, jj.id]);
        ul.appendChild(h('li', null, btn));
      });
      var grp = h('div', { class: 'gm-karte-lg-g', role: 'group', 'aria-labelledby': hid });
      var tog = h('button', {
        type: 'button', 'aria-expanded': 'true', 'aria-controls': lid,
        on: { click: function () {
          var col = !grp.classList.contains('is-collapsed');
          grp.classList.toggle('is-collapsed', col);
          tog.setAttribute('aria-expanded', col ? 'false' : 'true');
          if (M.store && M.store.set) M.store.set('karte-gruppe-' + g[0], col ? 'zu' : 'auf');
        } },
        html: '<span>' + M.esc(g[1]) + '</span><span class="gm-karte-lg-c">' + items.length + '</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"/></svg>'
      });
      if (M.store && M.store.get && M.store.get('karte-gruppe-' + g[0], 'auf') === 'zu') { grp.classList.add('is-collapsed'); tog.setAttribute('aria-expanded', 'false'); }
      grp.appendChild(h('h3', { class: 'gm-karte-lg-h', id: hid }, tog));
      grp.appendChild(ul);
      legend.appendChild(grp);
    });

    /* Zeichenerklärung */
    var j0 = model.journeys[0].id, j1 = (model.journeys[1] || model.journeys[0]).id, j2 = (model.journeys[2] || model.journeys[0]).id;
    var key = h('ul', { class: 'gm-karte-key' },
      h('li', null, keyGlyph({ js: [j0] }), h('span', null, (M.t('station') + ' auf einer ' + M.t('journey')))),
      h('li', null, keyGlyph({ js: [j0, j1, j2] }), h('span', null, (M.t('interchange') + ': Hier kannst du ' + M.tl('transfer') + '. Jedes Segment ist eine ' + M.t('journey') + '.'))),
      h('li', null, keyGlyph({ js: [j1], myth: true }), h('span', null, 'Mythos, gestrichelter Rand')),
      h('li', null, keyGlyph({ js: [j2], exhibit: true }), h('span', null, (M.t('exhibit') + ' zum Ausprobieren'))),
      h('li', null, keyGlyph({ js: [j0], visited: true }), h('span', null, ('Besucht, die ' + M.t('station') + ' leuchtet'))));
    var det = h('details', { class: 'gm-karte-keybox' }, h('summary', null, 'Zeichenerklärung'), key);
        legend.appendChild(det);
    return legend;
  }

  function buildViewport() {
    var model = V.model;
    var vp = h('div', {
      class: 'gm-karte-vp', tabindex: '0', role: 'group',
      'aria-label': (M.t('networkMap') + ' aller ' + M.t('journeys')), 'aria-describedby': 'gm-karte-hint'
    });
    V.vp = vp;

    var svg = svgEl('svg', { class: 'gm-karte-svg', focusable: 'false' });
    V.svg = svg;
    var defs = svgEl('defs', null, svg);
    var grad = svgEl('radialGradient', { id: 'gm-karte-glow' }, defs);
    svgEl('stop', { offset: '0', 'stop-color': '#FCB300', 'stop-opacity': '.62' }, grad);
    svgEl('stop', { offset: '.45', 'stop-color': '#FCB300', 'stop-opacity': '.2' }, grad);
    svgEl('stop', { offset: '1', 'stop-color': '#FCB300', 'stop-opacity': '0' }, grad);

    var world = svgEl('g', { class: 'gm-karte-world' }, svg);
    V.world = world;
    var glows = svgEl('g', { 'aria-hidden': 'true' }, world);
    var lines = svgEl('g', { 'aria-hidden': 'true' }, world);
    V.hl = svgEl('g', { class: 'gm-karte-hl', 'aria-hidden': 'true' }, world);
    svgEl('path', { class: 'gm-karte-hl-c', pathLength: '1' }, V.hl);
    svgEl('path', { class: 'gm-karte-hl-l', pathLength: '1' }, V.hl);
    V.runner = svgEl('circle', { class: 'gm-karte-runner', r: '4', cx: '0', cy: '0', 'aria-hidden': 'true' }, world);
    var nodesG = svgEl('g', { class: 'gm-karte-nodes' }, world);
    V.nodesG = nodesG;
    var labelsG = svgEl('g', { class: 'gm-karte-labels', 'aria-hidden': 'true' }, world);
    V.labelsG = labelsG;

    model.journeys.forEach(function (jj) {
      var st = '--jc:var(--j-' + jj.id + ');--i:' + jj.idx;
      var gl = svgEl('path', { class: 'gm-karte-glowline gm-karte-jl', style: st, 'data-j': jj.id, pathLength: '1' }, glows);
      var g = svgEl('g', { class: 'gm-karte-jl', style: st, 'data-j': jj.id }, lines);
      var ca = svgEl('path', { class: 'gm-karte-casing', pathLength: '1' }, g);
      var li = svgEl('path', { class: 'gm-karte-line', pathLength: '1' }, g);
      // Historische Reisen tragen zusätzlich eine gepunktete Mittellinie (zweites Unterscheidungsmerkmal neben der Farbe)
      var lin = jj.typ === 'historisch' ? svgEl('path', { class: 'gm-karte-line-in' }, g) : null;
      var tags = [0, 1].map(function () {
        var tg = svgEl('g', { class: 'gm-karte-tag' }, g);
        var inner = svgEl('g', { class: 'gm-karte-nd' }, tg);
        svgEl('circle', { class: 'gm-karte-tag-c', r: 9.6 }, inner);
        svgEl('text', { class: 'gm-karte-tag-t', text: String(jj.num), y: 0.5 }, inner);
        V.onEls.push([tg, jj.id]);
        return tg;
      });
      V.lineEls[jj.id] = { g: g, glow: gl, casing: ca, line: li, inner: lin, tags: tags };
    });

    // Knoten in Lesereihenfolge (Heimat-Reise, dann Stationsfolge), damit Tab der Geschichte folgt
    var seq = [], seen = {};
    model.journeys.forEach(function (jj) { jj.order.forEach(function (id) { if (!seen[id]) { seen[id] = 1; seq.push(model.nodes[id]); } }); });
    var exN = 0;
    seq.forEach(function (n) {
      var g = svgEl('g', {
        class: 'gm-karte-node', tabindex: n === seq[0] ? '0' : '-1', role: 'button', 'data-id': n.id,
        'aria-label': nodeLabel(n), style: '--ni:' + n.idx
      }, nodesG);
      var nd = svgEl('g', { class: 'gm-karte-nd' }, g);
      var hv = svgEl('g', { class: 'gm-karte-hv' }, nd);
      drawGlyph(hv, { js: n.js, myth: n.myth, exhibit: n.exhibit, pulse: true, delay: n.exhibit ? ((exN++ * 0.7) % 3.8).toFixed(1) : undefined });
      svgEl('circle', { class: 'gm-karte-hit', r: n.js.length > 1 ? 17 : 15 }, nd);
      V.nodeEls[n.id] = g;
      n.el = g;

      var lg = svgEl('g', { class: 'gm-karte-lab' + (n.js.length > 1 ? '' : ' is-single') }, labelsG);
      var inv = svgEl('g', { class: 'gm-karte-inv' }, lg);
      var bg = svgEl('rect', { class: 'gm-karte-lab-bg', rx: 4, height: 17 }, inv);
      var tx = svgEl('text', { text: n.label }, inv);
      n.lab = { g: lg, bg: bg, text: tx, w: 0, key: '', on: false };
      V.labelEls[n.id] = lg;
      spMark(g, 'inhalt/' + n.id, 12);
    });

    vp.appendChild(svg);

    /* Bedienelemente */
    var ctl = h('div', { class: 'gm-karte-ctl', role: 'group', 'aria-label': 'Zoom' },
      ctlBtn('Vergrößern', 'M12 5v14M5 12h14', function () { zoomBy(1.5); }),
      ctlBtn('Verkleinern', 'M5 12h14', function () { zoomBy(1 / 1.5); }),
      ctlBtn('Ganzen Plan einpassen', 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', function () { fit(true); V.interacted = false; }));
    vp.appendChild(ctl);
    V.ctl = ctl;

    var coarse = false;
    try { coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); } catch (e) { /* egal */ }
    V.hint = h('p', { class: 'gm-karte-hint', id: 'gm-karte-hint' }, coarse
      ? ('Tippe oben eine ' + M.t('journey') + ' an · Zoomen zeigt Namen')
      : 'Ziehen verschiebt · Mausrad zoomt · Pfeiltasten, + und − gehen auch');
    vp.appendChild(V.hint);

    V.tip = h('div', { class: 'gm-karte-tip', 'aria-hidden': 'true' });
    vp.appendChild(V.tip);

    V.card = buildCard();
    vp.appendChild(V.card.el);

    bindViewport(vp);
    return h('div', { class: 'gm-karte-vpwrap' }, vp);
  }

  function paintOn() {
    if (!V.onEls) return;
    V.onEls.forEach(function (p) { var c = onColor(p[1]); if (c) p[0].style.setProperty('--gk-on', c); });
    if (V.focusJ) paintCard(V.focusJ);
    if (RV.built) paintRvOn();
  }

  function paintCard(jid) {
    var o = onColors(jid), st = V.card.el.style;
    if (!o) return;
    st.setProperty('--gk-on', o.on);
    if (o.bg) st.setProperty('--gk-go', o.bg); else st.removeProperty('--gk-go');
  }

  function ctlBtn(label, d, fn) {
    return h('button', {
      type: 'button', 'aria-label': label, title: label, on: { click: fn },
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>'
    });
  }

  function buildCard() {
    var el = h('section', { class: 'gm-karte-card', 'aria-label': ('Ausgewählte ' + M.t('journey')) });
    var head = h('h3', { class: 'gm-karte-card-h' });
    var tag = h('p', { class: 'gm-karte-card-tag' });
    var prog = h('p', { class: 'gm-karte-card-prog' });
    var go = h('button', { type: 'button', class: 'gm-karte-go' });
    var x = h('button', { type: 'button', class: 'gm-karte-card-x', 'aria-label': 'Hervorhebung aufheben', title: 'Hervorhebung aufheben', html: icon('close', 18), on: { click: function () { setFocus(null, { announce: true, refocus: true }); } } });
    el.appendChild(x);
    el.appendChild(head); el.appendChild(tag); el.appendChild(prog);
    el.appendChild(h('div', { class: 'gm-karte-card-go' }, go));
    go.addEventListener('click', function () { if (V.focusJ && M.nav) M.nav.openJourney(V.focusJ); });
    return { el: el, head: head, tag: tag, prog: prog, go: go };
  }

  function nodeLabel(n) {
    var names = n.js.map(function (jid) { var j = V.model.byId[jid]; return j ? j.def.name : jid; });
    var s = n.title + '. ' + (n.js.length > 1 ? (M.t('interchange') + ' der ' + M.t('journeys') + ' ') + joinDe(names) : (M.t('journey') + ' ') + names[0]) + '.';
    if (n.myth) s += ' Mythos.';
    if (n.exhibit) s += (' Mit ' + M.t('exhibit') + ' zum Ausprobieren.');
    if (M.store && M.store.isVisited(n.id)) s += ' Besucht.';
    return s + spSuffix('inhalt/' + n.id);
  }

  /* ---------- Spielplan (nur mit packs/<paket>/spielplan.json; sonst tut nichts davon etwas) ---------- */

  var SP_STUFE = ['', '', 'Grundverständnis', 'Anwendung', 'Transfer'];
  function spAn() { return !!(M.spiel && M.spiel.aktiv); }
  function spSuffix(uid) {
    if (!spAn()) return '';
    var z = M.spiel.zugang(uid);
    if (!z.sichtbar) return '';
    if (!z.offen) return '. Noch verschlossen' + (z.bedingung ? '. ' + z.bedingung : '');
    var e = M.spiel.einheit(uid);
    return e && e.stufe >= 2 ? '. Stufe ' + (e.stufe - 1) + ' von 3: ' + SP_STUFE[Math.min(4, e.stufe)] : '';
  }
  /** Markiert einen SVG-Knoten: verborgen = weg, gesperrt = grau und angedeutet (mit Titel), sonst Stufenzeichen (Striche, nicht nur Farbe). */
  function spMark(g, uid, dy) {
    if (!spAn() || !g) return;
    var z = M.spiel.zugang(uid), old = g.querySelector(':scope > .gm-sp-stufe, :scope > title.gm-sp-titel');
    while ((old = g.querySelector(':scope > .gm-sp-stufe, :scope > .gm-sp-titel'))) g.removeChild(old);
    g.style.display = z.sichtbar ? '' : 'none';
    g.classList.toggle('gm-sp-gesperrt', z.sichtbar && !z.offen);
    if (!z.sichtbar) return;
    if (!z.offen) {
      var t = svgEl('title', { class: 'gm-sp-titel' }, g); t.textContent = 'Noch verschlossen' + (z.bedingung ? ': ' + z.bedingung : '');
      return;
    }
    if (dy === null) return;
    var e = M.spiel.einheit(uid), n = e ? Math.min(3, Math.max(0, e.stufe - 1)) : 0;
    if (!n) return;
    var m = svgEl('g', { class: 'gm-sp-stufe', 'aria-hidden': 'true' }, g);
    for (var i = 0; i < n; i++) svgEl('rect', { x: (i - (n - 1) / 2) * 5 - 1.5, y: dy || 11, width: 3, height: 3, rx: .8 }, m);
  }
  function spAlle() {
    if (!spAn() || !V.model) return;
    V.model.list.forEach(function (n) { if (n.el) { spMark(n.el, 'inhalt/' + n.id, 12); n.el.setAttribute('aria-label', nodeLabel(n)); } });
    if (RV && RV.stEls) Object.keys(RV.stEls).forEach(function (id) { var o = RV.stEls[id]; if (!o.base) o.base = o.g.getAttribute('aria-label') || ''; spMark(o.g, 'inhalt/' + id, 17); o.g.setAttribute('aria-label', o.base + spSuffix('inhalt/' + id)); });
    if (RV && RV.nodes) Object.keys(RV.nodes).forEach(function (jid) { var o = RV.nodes[jid]; if (o && o.g) spMark(o.g, 'episode/' + jid, null); });
  }

  /* ---------- Liste ---------- */

  function buildList() {
    var model = V.model;
    var wrap = h('div', { class: 'gm-karte-list', id: 'gm-karte-liste' });
    wrap.appendChild(h('p', { class: 'gm-karte-list-intro' },
      ('Alle ' + M.t('journeys') + ' mit ihren ' + M.t('stations') + ', in der Reihenfolge der Fahrt. Wo ein Ring statt eines Punkts steht, kannst du auf eine andere ' + M.t('journey') + ' ' + M.tl('transfer') + '.')));
    V.listItems = [];
    [['funktional', M.typeLabel('funktional')], ['historisch', M.typeLabel('historisch')]].forEach(function (g) {
      var items = model.journeys.filter(function (j) { return j.typ === g[0]; });
      if (!items.length) return;
      var grid = h('div', { class: 'gm-karte-list-grid' });
      items.forEach(function (jj) {
        var tid = 'gm-karte-lj-' + jj.id;
        var prog = h('span', { class: 'gm-karte-lj-n' });
        var ol = h('ol', { class: 'gm-karte-ls' });
        jj.order.forEach(function (sid, i) {
          var n = model.nodes[sid], st = n.st;
          var others = n.js.filter(function (x) { return x !== jj.id; }).map(function (x) { return model.byId[x].def.name; });
          var a = h('a', {
            href: '#/station/' + encodeURIComponent(sid),
            on: { click: function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); if (M.nav) M.nav.openStation(sid, jj.id); } }
          }, n.title);
          var kindName = (M.kinds && M.kinds[n.kind]) ? M.kinds[n.kind].label : '';
          var meta = [];
          if (kindName) meta.push(kindName);
          if (st.yearLabel || st.year) meta.push(String(st.yearLabel || st.year));
          if (n.exhibit) meta.push(M.t('exhibit'));
          var sub = h('span', { class: 'gm-karte-ls-k' });
          if (meta.length) sub.appendChild(doc.createTextNode(meta.join(' · ')));
          if (others.length) {
            if (meta.length) sub.appendChild(doc.createElement('br'));
            sub.appendChild(h('span', null, 'Umstieg: '));
            sub.appendChild(h('b', null, joinDe(others)));
          }
          var vis = h('span', { class: 'gm-karte-ls-k gm-karte-ls-v', hidden: true }, 'besucht');
          var li = h('li', { class: n.js.length > 1 ? 'is-x' : '' }, a, sub, vis);
          V.listItems.push({ id: sid, li: li, vis: vis });
          ol.appendChild(li);
        });
        var go = h('button', {
          type: 'button', class: 'gm-karte-lj-go', on: { click: function () { if (M.nav) M.nav.openJourney(jj.id); } },
          html: ('<span>' + M.t('journey') + ' antreten</span><span class="gm-sr"> ') + M.esc(jj.def.name) + '</span>' + icon('arrow-right', 16)
        });
        grid.appendChild(h('section', { class: 'gm-karte-lj', style: { '--jc': 'var(--j-' + jj.id + ')' }, 'aria-labelledby': tid },
          h('div', { class: 'gm-karte-lj-h' },
            h('span', { class: 'gm-karte-jb-badge', 'aria-hidden': 'true', html: icon(jj.def.icon || 'train', 17) }),
            h('h4', { class: 'gm-karte-lj-t', id: tid }, jj.def.name)),
          h('p', { class: 'gm-karte-lj-tag' }, jj.def.tagline || ''),
          h('div', { class: 'gm-karte-lj-meta' }, prog, go),
          ol));
        V.legendBtns[jj.id] = V.legendBtns[jj.id] || {};
        V.legendBtns[jj.id].listProg = prog;
      });
      wrap.appendChild(h('div', null, h('h3', { class: 'gm-karte-list-g' }, g[1]), grid));
    });
    return wrap;
  }

  /* ---------- Modus ---------- */

  function setMode(mode, save) {
    if (mode === true) mode = 'liste'; else if (mode === false) mode = 'netz';
    V.mode = mode;
    V.listMode = mode === 'liste';
    if (mode !== 'liste') V.lastMode = mode;
    if (V.stage) V.stage.hidden = mode !== 'netz';
    if (V.note) V.note.hidden = mode !== 'netz';
    if (RV.root) RV.root.hidden = mode !== 'reisen';
    if (V.listEl) V.listEl.hidden = mode !== 'liste';
    if (V.segBtns.reisen) {
      V.segBtns.reisen.setAttribute('aria-pressed', mode === 'reisen' ? 'true' : 'false');
      V.segBtns.netz.setAttribute('aria-pressed', mode === 'netz' ? 'true' : 'false');
      V.segBtns.list.setAttribute('aria-pressed', mode === 'liste' ? 'true' : 'false');
    }
    if (save && M.store && M.store.set) M.store.set('kartenmodus2', mode);
    if (save && M.announce) M.announce(mode === 'liste' ? ('Ansicht: Liste aller ' + M.t('journeys') + ' und ' + M.t('stations')) : mode === 'netz' ? 'Ansicht: Gesamtnetz' : ('Ansicht: ' + M.t('journeys')));
    if (mode !== 'netz' && V.tip) hideTip();
    if (mode === 'netz') {
      if (V.selJ && V.focusJ !== V.selJ) setFocus(V.selJ);
      if (V.shown) setTimeout(function () { onResize(!V.fitted); }, 0);
    } else if (mode === 'reisen' && V.shown) setTimeout(renderRv, 0);
  }

  /* ---------- Store ---------- */

  function onStore() {
    if (!V.model || !V.model.list.length) return;
    var total = V.model.list.length, done = 0;
    V.model.list.forEach(function (n) {
      var vis = M.store && M.store.isVisited(n.id);
      if (vis) done++;
      if (n.el) {
        n.el.classList.toggle('is-visited', !!vis);
        n.el.setAttribute('aria-label', nodeLabel(n));
      }
    });
    spAlle();
    if (V.summary) V.summary.innerHTML = '<b>' + done + '</b> von <b>' + total + ('</b> ' + M.t('stations') + ' besucht');
    V.model.journeys.forEach(function (jj) {
      var p = M.store ? M.store.progress(jj.id) : { done: 0, total: jj.order.length };
      var lb = V.legendBtns[jj.id];
      if (!lb) return;
      if (lb.n) {
        lb.n.textContent = p.done + '/' + p.total;
        lb.btn.setAttribute('aria-label', jj.def.name + ', ' + p.done + ' von ' + p.total + (' ' + M.t('stations') + ' besucht') + (V.focusJ === jj.id ? ', hervorgehoben' : ''));
        lb.bar.style.width = (p.total ? Math.round(100 * p.done / p.total) : 0) + '%';
      }
      if (lb.listProg) lb.listProg.textContent = p.done + ' von ' + p.total + (' ' + M.t('stations') + ' besucht');
    });
    if (V.listItems) V.listItems.forEach(function (it) {
      var v = M.store && M.store.isVisited(it.id);
      it.li.classList.toggle('is-v', !!v);
      it.vis.hidden = !v;
    });
    if (V.focusJ) updateCard();
    if (RV.built) { updateRvProgress(); updatePlanState(); }
  }

  /* ---------- Fokus auf eine Reise ---------- */

  function setPeek(jid) {
    Object.keys(V.lineEls).forEach(function (id) { V.lineEls[id].g.classList.toggle('is-peek', id === jid); });
    // Vorschau beim Überfahren der Legende: andere Reisen treten zurück (nur ohne festen Fokus)
    var on = !!jid && !V.focusJ;
    V.root.classList.toggle('is-peeking', on);
    if (V.model) V.model.list.forEach(function (n) { n.el.classList.toggle('is-pk', on && n.js.indexOf(jid) >= 0); });
  }

  function updateCard() {
    var jj = V.model.byId[V.focusJ];
    if (!jj) return;
    var p = M.store ? M.store.progress(jj.id) : { done: 0, total: jj.order.length };
    var c = V.card;
    c.el.style.setProperty('--jc', 'var(--j-' + jj.id + ')');
    paintCard(jj.id);
    c.head.innerHTML = icon(jj.def.icon || 'train', 22) + '<span>' + M.esc(jj.def.name) + '</span>';
    c.tag.textContent = jj.def.tagline || '';
    c.prog.innerHTML = '<span>' + p.done + ' von ' + p.total + ' besucht</span><i><b style="width:' + (p.total ? Math.round(100 * p.done / p.total) : 0) + '%"></b></i>';
    c.go.innerHTML = ('<span>' + M.t('journey') + ' antreten</span>') + icon('arrow-right', 18);
    c.go.setAttribute('aria-label', (M.t('journey') + ' antreten: ') + jj.def.name);
  }

  // ein kleines Licht läuft ein paarmal den hervorgehobenen Faden entlang
  function stopRunner() {
    if (!V.runner) return;
    V.runner.classList.remove('is-on');
    while (V.runner.firstChild) V.runner.removeChild(V.runner.firstChild);
  }
  function startRunner(d) {
    stopRunner();
    if (reduced() || !V.runner) return;
    var am = svgEl('animateMotion', { dur: '8s', repeatCount: '3', path: d, begin: 'indefinite', fill: 'remove' }, V.runner);
    V.runner.classList.add('is-on');
    try { am.beginElement(); } catch (e) { stopRunner(); return; }
    clearTimeout(V.runnerT);
    V.runnerT = setTimeout(function () { if (V.runner) V.runner.classList.remove('is-on'); }, 25500);
  }

  // Gewählte Reise in der (scrollbaren) Legende sichtbar machen, ohne die Seite mitzuscrollen
  function revealLegend(jid) {
    var lb = V.legendBtns[jid], lg = V.legend;
    if (!lb || !lb.btn || !lg) return;
    var grp = lb.btn.closest('.gm-karte-lg-g');
    if (grp && grp.classList.contains('is-collapsed')) { var t = grp.querySelector('.gm-karte-lg-h button'); if (t) t.click(); }
    var b = lb.btn.getBoundingClientRect(), r = lg.getBoundingClientRect();
    if (lg.scrollHeight > lg.clientHeight + 2) {
      if (b.top < r.top + 4) lg.scrollTop -= r.top + 4 - b.top;
      else if (b.bottom > r.bottom - 4) lg.scrollTop += b.bottom - r.bottom + 4;
    }
    if (lg.scrollWidth > lg.clientWidth + 2) {
      if (b.left < r.left + 4) lg.scrollLeft -= r.left + 4 - b.left;
      else if (b.right > r.right - 4) lg.scrollLeft += b.right - r.right + 4;
    }
  }

  function setFocus(jid, o) {
    o = o || {};
    if (jid && !V.model.byId[jid]) jid = null;
    var prev = V.focusJ;
    V.focusJ = jid;
    V.selJ = jid;
    V.root.classList.toggle('is-focus', !!jid);
    V.model.journeys.forEach(function (jj) {
      var on = jj.id === jid;
      V.lineEls[jj.id].g.classList.toggle('is-on', on);
      var lb = V.legendBtns[jj.id];
      if (lb && lb.btn) lb.btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    V.model.list.forEach(function (n) {
      var inn = !!jid && n.js.indexOf(jid) >= 0;
      n.el.classList.toggle('is-in', inn);
      n.lab.g.classList.toggle('is-in', inn);
    });
    if (jid) {
      var jj = V.model.byId[jid];
      V.hl.style.setProperty('--jc', 'var(--j-' + jid + ')');
      var d = V.lineEls[jid].line.getAttribute('d');
      [].forEach.call(V.hl.querySelectorAll('path'), function (p) { p.setAttribute('d', d); });
      V.hl.classList.remove('is-draw', 'is-still');
      void V.hl.getBoundingClientRect();
      if (reduced()) V.hl.classList.add('is-still'); else V.hl.classList.add('is-draw');
      updateCard();
      V.card.el.classList.add('is-on');
      revealLegend(jid);
      startRunner(d);
      if (o.announce && M.announce) {
        var p = M.store ? M.store.progress(jid) : { done: 0, total: jj.order.length };
        M.announce((M.t('journey') + ' hervorgehoben: ') + jj.def.name + '. ' + p.done + ' von ' + p.total + (' ' + M.t('stations') + ' besucht.'));
      }
    } else {
      V.hl.classList.remove('is-draw', 'is-still');
      stopRunner();
      V.card.el.classList.remove('is-on');
      if (o.announce && prev && M.announce) M.announce('Hervorhebung aufgehoben');
      var inCard = V.card && V.card.el.contains(doc.activeElement);
      if ((o.refocus || inCard) && prev && V.legendBtns[prev] && V.legendBtns[prev].btn) V.legendBtns[prev].btn.focus({ preventScroll: true });
    }
    onStore();
    syncReserve();
    scheduleLabels();
  }

  // Auf schmalen Bildschirmen liegt die Karte der Reise unten über dem Plan: Gesamtbild so einpassen, dass der Plan darüber bleibt
  function calcReserve() {
    var narrow = false;
    try { narrow = !!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches); } catch (e) { /* egal */ }
    return V.focusJ && narrow && V.card ? Math.round(V.card.el.offsetHeight + 16) : 0;
  }
  function syncReserve() {
    var r = calcReserve();
    if (r === V.reserve) return;
    V.reserve = r;
    if (V.vw && V.shown && V.mode === 'netz' && !V.interacted) fit(true);
  }

  /* ---------- Ansicht: Zoom, Pan ---------- */

  function nodeScale() {
    // Knoten wachsen mit dem Zoom, aber langsamer als die Karte
    var z = V.k / V.kfit;
    var base = clamp(V.kfit * 1.55, 0.4, 1);
    return Math.min(base * Math.pow(z, 0.55), 2.4);
  }

  function applyView(force) {
    if (!V.world) return;
    clampView();
    V.world.setAttribute('transform', 'translate(' + f1(V.tx) + ' ' + f1(V.ty) + ') scale(' + V.k.toFixed(4) + ')');
    var vp = V.vp;
    var gs = 44 * Math.max(0.55, Math.min(V.k / V.kfit, 3));
    vp.style.setProperty('--gs', gs.toFixed(1) + 'px');
    vp.style.setProperty('--gx', (V.tx % gs).toFixed(1) + 'px');
    vp.style.setProperty('--gy', (V.ty % gs).toFixed(1) + 'px');
    if (force || V.k !== V.lastK) {
      // Linien- und Knotengrößen hängen am Zoom. Sie neu zu setzen ist teuer (alle Striche werden neu
      // gezeichnet), darum nur bei spürbarer Änderung (> 4 %) sofort, sonst gesammelt nach kurzer Ruhe.
      var rel = V.lastK ? Math.abs(V.k / V.lastK - 1) : 1;
      clearTimeout(V.sizeT);
      if (force || rel > 0.04) applySizes();
      else V.sizeT = setTimeout(applySizes, 110);
    }
    scheduleLabels();
    if (V.hoverId) positionTip(V.model.nodes[V.hoverId]);
  }

  function applySizes() {
    if (!V.svg) return;
    V.lastK = V.k;
    var ns = nodeScale();
    V.svg.style.setProperty('--ns', (ns / V.k).toFixed(4));
    V.svg.style.setProperty('--lw', (4.3 * Math.pow(ns / 0.8, 0.72) / V.k).toFixed(4) + 'px');
    V.svg.style.setProperty('--inv', (1 / V.k).toFixed(4));
    V.svg.style.setProperty('--ts', (Math.min(ns * 1.3, 1.7) / V.k).toFixed(4));
    // Im Gesamtbild gibt es nichts zu verschieben: senkrechtes Wischen scrollt dann die Seite weiter (kein Touch-Fangen)
    V.vp.style.touchAction = V.k <= V.kfit * 1.04 ? 'pan-y' : 'none';
  }

  function scheduleApply() {
    if (V.raf) return;
    V.raf = requestAnimationFrame(function () { V.raf = 0; applyView(); });
  }

  // Erlaubter Bereich für die Verschiebung ("contain"): Ist der Plan (mit etwa 4 % Rand) größer als der Rahmen, bleibt der
  // sichtbare Ausschnitt immer innerhalb des Plans; ist er kleiner, bleibt er zentriert im Rahmen.
  function panRange(k) {
    k = k || V.k;
    var W = V.model.W * k, H = V.model.H * k, m = Math.min(0.04 * Math.min(W, H), 0.06 * Math.min(V.vw, V.vh)), vh = V.vh - (V.reserve || 0);
    var r = {};
    if (W + 2 * m <= V.vw) { r.x0 = r.x1 = (V.vw - W) / 2; } else { r.x0 = V.vw - W - m; r.x1 = m; }
    if (H + 2 * m <= vh) { r.y0 = r.y1 = (vh - H) / 2; } else { r.y0 = V.vh - H - m; r.y1 = m; }
    return r;
  }
  function clampView() {
    if (!V.model || !V.vw || !V.vh) return;
    var r = panRange();
    V.tx = clamp(V.tx, r.x0, r.x1);
    V.ty = clamp(V.ty, r.y0, r.y1);
  }
  // Weicher Widerstand: Über den Rand hinaus folgt der Plan dem Finger nur noch zäh und höchstens ~70 px weit
  function softAxis(v, a, b) {
    var e = v < a ? a - v : v > b ? v - b : 0;
    if (!e) return v;
    var s = 70 * (1 - Math.exp(-e / 140));
    return v < a ? a - s : b + s;
  }
  function softClamp() {
    var r = panRange();
    V.tx = softAxis(V.tx, r.x0, r.x1);
    V.ty = softAxis(V.ty, r.y0, r.y1);
  }
  // Nach dem Loslassen: sanft zurück in den erlaubten Bereich
  function settleView() {
    if (!V.model || !V.vw || V.tween) return;
    var r = panRange(), tx = clamp(V.tx, r.x0, r.x1), ty = clamp(V.ty, r.y0, r.y1);
    if (Math.abs(tx - V.tx) < 0.5 && Math.abs(ty - V.ty) < 0.5) return;
    if (reduced()) { V.tx = tx; V.ty = ty; applyView(); }
    else tweenTo(V.k, tx, ty, 260);
  }
  // Ist (etwa nach einem Resize) weniger als die Hälfte des Netzes sichtbar, obwohl es in den Rahmen passt: zentrieren
  function recenterIfLost(animate) {
    if (!V.model || !V.vw || !V.vh) return;
    var W = V.model.W * V.k, H = V.model.H * V.k;
    if (W > V.vw * 1.25 || H > V.vh * 1.25) return;
    var vx = Math.max(0, Math.min(V.tx + W, V.vw) - Math.max(V.tx, 0)) / Math.min(W, V.vw);
    var vy = Math.max(0, Math.min(V.ty + H, V.vh) - Math.max(V.ty, 0)) / Math.min(H, V.vh);
    if (vx >= 0.5 && vy >= 0.5) return;
    var tx = (V.vw - W) / 2, ty = ((V.vh - (V.reserve || 0)) - H) / 2;
    if (animate && !reduced()) tweenTo(V.k, tx, ty, 420);
    else { cancelTween(); V.tx = tx; V.ty = ty; applyView(true); }
  }

  function fit(animate) {
    if (!V.vw || !V.vh) return;
    var pad = V.vw < 600 ? 6 : 14, vh = V.vh - (V.reserve || 0);
    var k = Math.min((V.vw - 2 * pad) / V.model.W, (vh - 2 * pad) / V.model.H);
    V.kfit = k;
    var tx = (V.vw - V.model.W * k) / 2, ty = (vh - V.model.H * k) / 2;
    if (animate && !reduced()) tweenTo(k, tx, ty, 520);
    else { cancelTween(); V.k = k; V.tx = tx; V.ty = ty; applyView(true); }
  }

  function limits() { return { min: V.kfit, max: V.kfit * 9 }; }

  function zoomAt(px, py, nk, animate) {
    var l = limits();
    nk = clamp(nk, l.min, l.max);
    var tx = px - (px - V.tx) * nk / V.k, ty = py - (py - V.ty) * nk / V.k;
    var pr = panRange(nk);
    tx = clamp(tx, pr.x0, pr.x1); ty = clamp(ty, pr.y0, pr.y1);
    if (animate && !reduced()) tweenTo(nk, tx, ty, 260);
    else { cancelTween(); V.k = nk; V.tx = tx; V.ty = ty; clampView(); scheduleApply(); }
    touched();
  }

  function zoomBy(f) { zoomAt(V.vw / 2, V.vh / 2, V.k * f, true); }

  function cancelTween() { if (V.tween) { cancelAnimationFrame(V.tween.raf); V.tween = null; } }

  function tweenTo(k, tx, ty, ms) {
    cancelTween();
    var k0 = V.k, x0 = V.tx, y0 = V.ty, t0 = performance.now();
    var tw = V.tween = { raf: 0 };
    (function step(now) {
      var p = clamp((now - t0) / ms, 0, 1), e = 1 - Math.pow(1 - p, 3);
      // Zoom logarithmisch interpolieren, damit er gleichmäßig wirkt
      V.k = k0 * Math.pow(k / k0, e);
      V.tx = x0 + (tx - x0) * e; V.ty = y0 + (ty - y0) * e;
      applyView();
      if (p < 1 && V.tween === tw) tw.raf = requestAnimationFrame(step);
      else if (V.tween === tw) V.tween = null;
    })(t0);
  }

  function touched() { V.interacted = true; if (V.hint) V.hint.classList.add('is-off'); }
  function panBy(dx, dy, soft) { V.tx += dx; V.ty += dy; if (soft) softClamp(); else clampView(); scheduleApply(); touched(); }

  function centerOn(n, zoomTo, animate) {
    var k = zoomTo ? clamp(zoomTo, limits().min, limits().max) : V.k;
    var tx = V.vw / 2 - n.x * k, ty = V.vh / 2 - n.y * k, pr = panRange(k);
    tx = clamp(tx, pr.x0, pr.x1); ty = clamp(ty, pr.y0, pr.y1);
    if (animate && !reduced()) tweenTo(k, tx, ty, 650);
    else { cancelTween(); V.k = k; V.tx = tx; V.ty = ty; applyView(true); }
    V.interacted = true;
  }

  function ensureVisible(n) {
    var sx = n.x * V.k + V.tx, sy = n.y * V.k + V.ty, m = 70;
    var dx = 0, dy = 0;
    if (sx < m) dx = m - sx; else if (sx > V.vw - m) dx = V.vw - m - sx;
    if (sy < m) dy = m - sy; else if (sy > V.vh - m) dy = V.vh - m - sy;
    if (dx || dy) {
      if (reduced()) { V.tx += dx; V.ty += dy; applyView(); }
      else tweenTo(V.k, V.tx + dx, V.ty + dy, 320);
    }
  }

  function onResize(forceFit) {
    if (!V.vp || V.mode !== 'netz') return;
    var w = V.vp.clientWidth, hh = V.vp.clientHeight;
    if (!w || !hh) return;
    var changed = w !== V.vw || hh !== V.vh;
    V.vw = w; V.vh = hh;
    V.reserve = calcReserve();
    var wantRot = w / hh < 0.82 && V.model.baseW / V.model.baseH > 1.12;
    var rotChanged = wantRot !== !!V.model.rotated;
    if (rotChanged) { orient(V.model, wantRot); applyGeometry(); }
    if (forceFit || rotChanged || !V.interacted || !V.fitted) { V.fitted = true; fit(false); }
    else if (changed) {
      var oldFit = V.kfit;
      var pad = w < 600 ? 6 : 14;
      V.kfit = Math.min((w - 2 * pad) / V.model.W, (hh - (V.reserve || 0) - 2 * pad) / V.model.H);
      if (oldFit) { V.k = clamp(V.k * V.kfit / oldFit, V.kfit, V.kfit * 9); }
      clampView(); applyView(true);
      recenterIfLost(true);
    }
  }

  /* ---------- Geometrie anwenden ---------- */

  function applyGeometry() {
    var model = V.model;
    model.journeys.forEach(function (jj) {
      var d = journeyPath(model, jj), el = V.lineEls[jj.id];
      el.glow.setAttribute('d', d); el.casing.setAttribute('d', d); el.line.setAttribute('d', d);
      if (el.inner) el.inner.setAttribute('d', d);
      el.tags.forEach(function (tg, i) { tg.setAttribute('transform', 'translate(' + f1(jj.tags[i][0]) + ' ' + f1(jj.tags[i][1]) + ')'); });
    });
    model.list.forEach(function (n) {
      n.el.setAttribute('transform', 'translate(' + f1(n.x) + ' ' + f1(n.y) + ')');
      n.lab.g.setAttribute('transform', 'translate(' + f1(n.x) + ' ' + f1(n.y) + ')');
    });
    if (V.focusJ) {
      var d2 = V.lineEls[V.focusJ].line.getAttribute('d');
      [].forEach.call(V.hl.querySelectorAll('path'), function (p) { p.setAttribute('d', d2); });
    }
    V.labelKey = '';
  }

  /* ---------- Beschriftungen mit Detailstufen ---------- */

  function scheduleLabels() {
    if (V.labelRaf) return;
    V.labelRaf = requestAnimationFrame(function () { V.labelRaf = 0; layoutLabels(); });
  }

  function layoutLabels() {
    if (!V.model || !V.vw || V.mode !== 'netz') return;
    var model = V.model, k = V.k, z = k / V.kfit;
    var ns = nodeScale();
    if (!V.labelFont) V.labelFont = '600 12.5px ' + (getComputedStyle(V.vp).fontFamily || 'system-ui, sans-serif');
    var font = V.labelFont;
    var focus = V.focusJ;
    var cands = [], i;
    for (i = 0; i < model.list.length; i++) {
      var n = model.list[i];
      var sx = n.x * k + V.tx, sy = n.y * k + V.ty;
      n._sx = sx; n._sy = sy;
      n._r = (n.js.length > 1 ? 12 : 8.9) * ns + 1.5;
      var inFocus = !!focus && n.js.indexOf(focus) >= 0;
      n._f = inFocus;
      var cross = n.js.length > 1;
      var allow, prio;
      if (focus) {
        if (inFocus) { allow = true; prio = 100 + (cross ? 10 : 0) + n.js.length; }
        else { allow = z > 3.4; prio = 10 + (cross ? 5 : 0); }
      } else {
        // Gesamtansicht: nur die wichtigsten Kreuzungen, mittlerer Zoom: alle Kreuzungen, starker Zoom: alle Stationen
        allow = z < 1.7 ? !!model.top[n.id] : z < 2.9 ? cross : true;
        prio = (cross ? 60 + n.js.length * 6 : 20) + (n.exhibit ? 2 : 0) + (model.top[n.id] ? 30 : 0);
      }
      if (sx < -80 || sx > V.vw + 80 || sy < -30 || sy > V.vh + 30) allow = false;
      if (allow) cands.push({ n: n, prio: prio });
    }
    cands.sort(function (a, b) { return b.prio - a.prio || a.n.idx - b.n.idx; });

    var placed = [], on = {};
    var H = 16;
    // Bedienknöpfe und Reisekarte verdecken den Plan: dort keine Beschriftungen
    [V.ctl, V.card && V.card.el.classList.contains('is-on') ? V.card.el : null].forEach(function (el) {
      if (el && el.offsetWidth) placed.push({ x: el.offsetLeft - 4, y: el.offsetTop - 4, w: el.offsetWidth + 8, h: el.offsetHeight + 8 });
    });
    cands.forEach(function (c) {
      var n = c.n, lab = n.lab;
      if (!lab.w) lab.w = textWidth(n.label, font) * 1.04 + 2;
      var w = lab.w, r = n._r, gap = 5, sx = n._sx, sy = n._sy;
      var opts = [
        { a: 'start', dx: r + gap, dy: 4.5, x: sx + r + gap - 2, y: sy - H / 2, w: w + 4 },
        { a: 'end', dx: -(r + gap), dy: 4.5, x: sx - r - gap - w - 2, y: sy - H / 2, w: w + 4 },
        { a: 'middle', dx: 0, dy: -(r + gap + 1), x: sx - w / 2 - 2, y: sy - r - gap - H, w: w + 4 },
        { a: 'middle', dx: 0, dy: r + gap + 11, x: sx - w / 2 - 2, y: sy + r + gap, w: w + 4 },
        { a: 'start', dx: r * 0.72 + gap, dy: -(r * 0.72 + 2), x: sx + r * 0.72 + gap - 2, y: sy - r * 0.72 - H + 1, w: w + 4 },
        { a: 'start', dx: r * 0.72 + gap, dy: r * 0.72 + 12, x: sx + r * 0.72 + gap - 2, y: sy + r * 0.72 + 1, w: w + 4 },
        { a: 'end', dx: -(r * 0.72 + gap), dy: -(r * 0.72 + 2), x: sx - r * 0.72 - gap - w - 2, y: sy - r * 0.72 - H + 1, w: w + 4 },
        { a: 'end', dx: -(r * 0.72 + gap), dy: r * 0.72 + 12, x: sx - r * 0.72 - gap - w - 2, y: sy + r * 0.72 + 1, w: w + 4 }
      ];
      for (var o = 0; o < opts.length; o++) {
        var q = opts[o];
        if (q.x < 4 || q.x + q.w > V.vw - 4 || q.y < 4 || q.y + H > V.vh - 4) continue;
        if (labelCollides(q, H, placed, model.list, n, !!focus)) continue;
        placed.push({ x: q.x, y: q.y, w: q.w, h: H });
        on[n.id] = q;
        break;
      }
    });

    model.list.forEach(function (n) {
      var q = on[n.id], lab = n.lab;
      if (q) {
        var key = q.a + '|' + f1(q.dx) + '|' + f1(q.dy);
        if (lab.key !== key) {
          lab.key = key;
          lab.text.setAttribute('x', f1(q.dx)); lab.text.setAttribute('y', f1(q.dy));
          lab.text.setAttribute('text-anchor', q.a);
          var bw = lab.w + 8, bxx = q.a === 'end' ? q.dx - lab.w - 4 : q.a === 'middle' ? q.dx - lab.w / 2 - 4 : q.dx - 4;
          lab.bg.setAttribute('x', f1(bxx)); lab.bg.setAttribute('y', f1(q.dy - 13)); lab.bg.setAttribute('width', f1(bw));
        }
        if (!lab.on) { lab.on = true; lab.g.classList.add('is-on'); }
      } else if (lab.on) { lab.on = false; lab.g.classList.remove('is-on'); }
    });
  }

  function labelCollides(q, H, placed, list, self, focusOnly) {
    var i;
    for (i = 0; i < placed.length; i++) {
      var p = placed[i];
      if (q.x < p.x + p.w + 2 && q.x + q.w > p.x - 2 && q.y < p.y + p.h + 1 && q.y + H > p.y - 1) return true;
    }
    for (i = 0; i < list.length; i++) {
      var n = list[i];
      if (n === self || (focusOnly && !n._f)) continue;
      var cx = clamp(n._sx, q.x, q.x + q.w), cy = clamp(n._sy, q.y, q.y + H);
      var dx = n._sx - cx, dy = n._sy - cy;
      if (dx * dx + dy * dy < n._r * n._r) return true;
    }
    return false;
  }

  /* ---------- Vorschau (Tooltip) ---------- */

  function showTip(n) {
    V.hoverId = n.id;
    var tip = V.tip, st = n.st;
    var kindName = (M.kinds && M.kinds[n.kind]) ? M.kinds[n.kind].label : '';
    var meta = [kindName, st.yearLabel || (typeof st.year === 'number' ? (st.year < 0 ? Math.abs(st.year) + ' v. Chr.' : st.year) : '')].filter(Boolean).join(' · ');
    tip.innerHTML = '';
    tip.appendChild(h('p', { class: 'gm-karte-tip-t' }, n.title));
    if (meta) tip.appendChild(h('p', { class: 'gm-karte-tip-m' }, meta));
    var ul = h('ul', { class: 'gm-karte-tip-j' });
    n.js.forEach(function (jid) {
      ul.appendChild(h('li', { style: { '--jc': 'var(--j-' + jid + ')' } }, V.model.byId[jid].def.name));
    });
    tip.appendChild(ul);
    var tags = h('ul', { class: 'gm-karte-tip-f' });
    if (n.js.length > 1) tags.appendChild(h('li', null, M.t('interchange')));
    if (n.myth) tags.appendChild(h('li', null, 'Mythos'));
    if (n.exhibit) tags.appendChild(h('li', null, M.t('exhibit')));
    if (M.store && M.store.isVisited(n.id)) tags.appendChild(h('li', { class: 'is-lit' }, 'Besucht'));
    if (tags.children.length) tip.appendChild(tags);
    tip.classList.add('is-on');
    positionTip(n);
    setPeekNode(n);
  }

  function positionTip(n) {
    if (!n) return;
    var tip = V.tip;
    var w = tip.offsetWidth, hh = tip.offsetHeight;
    var sx = n.x * V.k + V.tx, sy = n.y * V.k + V.ty, r = n._r || 14;
    var x = clamp(sx - w / 2, 8, Math.max(8, V.vw - w - 8));
    var y = sy - r - 12 - hh;
    if (y < 8) y = sy + r + 12;
    y = clamp(y, 8, Math.max(8, V.vh - hh - 8));
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    // translate setzt den is-on-Übergang außer Kraft, darum Einblenden über opacity/visibility
  }

  function hideTip() {
    V.hoverId = null;
    V.tip.classList.remove('is-on');
    setPeekNode(null);
  }

  function setPeekNode(n) {
    Object.keys(V.lineEls).forEach(function (id) {
      V.lineEls[id].g.classList.toggle('is-peek', !!n && n.js.indexOf(id) >= 0);
    });
  }

  /* ---------- Eingaben ---------- */

  function bindViewport(vp) {
    var nodesG = V.nodesG;

    // Hover und Fokus
    nodesG.addEventListener('pointerover', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (V.drag) return;
      var g = e.target.closest ? e.target.closest('.gm-karte-node') : null;
      if (g) showTip(V.model.nodes[g.getAttribute('data-id')]);
    });
    nodesG.addEventListener('pointerout', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var g = e.target.closest ? e.target.closest('.gm-karte-node') : null;
      if (!g) return;
      var to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.gm-karte-node') : null;
      if (to !== g) hideTip();
    });
    // focusin/focusout hängen am HTML-Element, nicht an einem SVG-<g>: Blink macht SVG-Elemente mit
    // Fokus-Listenern selbst zum Tab-Stopp (sonst gäbe es einen leeren Fokuspunkt vor den Knoten)
    vp.addEventListener('focusin', function (e) {
      var g = e.target.closest ? e.target.closest('.gm-karte-node') : null;
      if (!g) return;
      var n = V.model.nodes[g.getAttribute('data-id')];
      // Roving Tabindex: Tab springt über den Plan, Pfeiltasten wandern von Knoten zu Knoten
      if (V.rover && V.rover !== g) V.rover.setAttribute('tabindex', '-1');
      g.setAttribute('tabindex', '0');
      V.rover = g;
      showTip(n);
      if (V.vp.contains(doc.activeElement) && !V.drag) ensureVisible(n);
    });
    vp.addEventListener('focusout', function (e) {
      var to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('.gm-karte-node') : null;
      if (!to) hideTip();
    });

    // Klick auf Knoten
    nodesG.addEventListener('click', function (e) {
      if (performance.now() - V.lastDragEnd < 280) return;
      var g = e.target.closest ? e.target.closest('.gm-karte-node') : null;
      if (g) openNode(g.getAttribute('data-id'));
    });

    // Mausrad
    vp.addEventListener('wheel', function (e) {
      if (!V.vw) return;
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
      var f = Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0018)), l = limits();
      // am Rand des Zoombereichs darf die Seite weiterscrollen
      if (!e.ctrlKey && ((f < 1 && V.k <= l.min * 1.0001) || (f > 1 && V.k >= l.max * 0.9999))) return;
      e.preventDefault();
      var r = vp.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, V.k * f, false);
      hideTip();
    }, { passive: false });

    // Zeiger: Ziehen und Pinch
    vp.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('.gm-karte-ctl, .gm-karte-card')) return;
      cancelTween();
      V.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
      var ids = Object.keys(V.ptrs);
      if (ids.length === 2) {
        var a = V.ptrs[ids[0]], b = V.ptrs[ids[1]];
        V.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: V.k };
        if (!V.drag) V.drag = { moved: true };
        try { vp.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
        hideTip();
      }
    });
    vp.addEventListener('pointermove', function (e) {
      var p = V.ptrs[e.pointerId];
      if (!p) return;
      var ids = Object.keys(V.ptrs), r = vp.getBoundingClientRect();
      if (ids.length >= 2 && V.pinch) {
        var o = V.ptrs[ids[0] === String(e.pointerId) ? ids[1] : ids[0]];
        var before = { x: (p.x + o.x) / 2, y: (p.y + o.y) / 2 };
        p.x = e.clientX; p.y = e.clientY;
        var mid = { x: (p.x + o.x) / 2, y: (p.y + o.y) / 2 };
        var d = Math.hypot(p.x - o.x, p.y - o.y) || 1;
        var l = limits(), nk = clamp(V.pinch.k * d / V.pinch.d, l.min, l.max);
        V.tx += mid.x - before.x; V.ty += mid.y - before.y;
        var px = mid.x - r.left, py = mid.y - r.top;
        V.tx = px - (px - V.tx) * nk / V.k; V.ty = py - (py - V.ty) * nk / V.k; V.k = nk;
        clampView(); scheduleApply(); V.interacted = true;
        return;
      }
      var dx = e.clientX - p.x, dy = e.clientY - p.y;
      if (!V.drag) {
        if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 5) return;
        V.drag = { moved: true };
        vp.classList.add('is-drag');
        try { vp.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
        hideTip();
        V.hint.classList.add('is-off');
      }
      p.x = e.clientX; p.y = e.clientY;
      panBy(dx, dy, false);
    });
    function endPtr(e) {
      if (!V.ptrs[e.pointerId]) return;
      delete V.ptrs[e.pointerId];
      var left = Object.keys(V.ptrs).length;
      if (left < 2) V.pinch = null;
      if (!left) {
        if (V.drag) V.lastDragEnd = performance.now();
        V.drag = null;
        vp.classList.remove('is-drag');
        settleView();
      } else {
        // verbleibender Finger setzt das Ziehen neu an
        var rest = V.ptrs[Object.keys(V.ptrs)[0]];
        rest.sx = rest.x; rest.sy = rest.y;
      }
    }
    vp.addEventListener('pointerup', endPtr);
    vp.addEventListener('pointercancel', endPtr);
    // Kein lostpointercapture-Handler: Chrome meldet beim Wechsel von der impliziten Touch-Erfassung zu
    // vp.setPointerCapture ein lostpointercapture, das wie ein Ende des Ziehens wirken würde

    // Doppelklick: hineinzoomen
    vp.addEventListener('dblclick', function (e) {
      if (e.target.closest && (e.target.closest('.gm-karte-node') || e.target.closest('.gm-karte-ctl') || e.target.closest('.gm-karte-card'))) return;
      var r = vp.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, V.k * 2, true);
    });

    // Tastatur
    vp.addEventListener('keydown', onKey);
  }

  function openNode(id) {
    if (!M.nav) return;
    var n = V.model.nodes[id];
    var ctx = V.focusJ && n && n.js.indexOf(V.focusJ) >= 0 ? V.focusJ : undefined;
    M.nav.openStation(id, ctx);
  }

  function onKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target, isNode = t && t.classList && t.classList.contains('gm-karte-node');
    var key = e.key, step = 70;
    if (isNode && (key === 'Enter' || key === ' ')) {
      e.preventDefault();
      openNode(t.getAttribute('data-id'));
      return;
    }
    if (key === '+' || key === '=' || key === 'Add') { e.preventDefault(); zoomBy(1.4); return; }
    if (key === '-' || key === '_' || key === 'Subtract') { e.preventDefault(); zoomBy(1 / 1.4); return; }
    if (key === '0' || key === 'Home') { e.preventDefault(); fit(true); V.interacted = false; return; }
    if (key === 'Escape' && V.focusJ) { e.preventDefault(); e.stopPropagation(); setFocus(null, { announce: true }); return; }
    var dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    var dir = dirs[key];
    if (!dir) return;
    e.preventDefault();
    if (isNode && !e.shiftKey) {
      var next = neighborInDirection(V.model.nodes[t.getAttribute('data-id')], dir);
      if (next) next.el.focus({ preventScroll: true });
      return;
    }
    panBy(-dir[0] * step, -dir[1] * step);
  }

  // nächster Knoten in einer Richtung (für Pfeiltasten auf einem Knoten)
  function neighborInDirection(from, dir) {
    var best = null, bs = Infinity;
    V.model.list.forEach(function (n) {
      if (n === from) return;
      var dx = n.x - from.x, dy = n.y - from.y, along = dx * dir[0] + dy * dir[1];
      if (along <= 1) return;
      var perp = Math.abs(dx * dir[1] - dy * dir[0]);
      if (perp > along * 1.4) return;
      var s = along + perp * 1.6;
      if (s < bs) { bs = s; best = n; }
    });
    return best;
  }

  /* ------------------------------------------------------------------ *
   * Modus „Reisen“: Konstellation der Reisen (Stufe 1) und Linienplan einer Reise (Stufe 2)
   * ------------------------------------------------------------------ */

  var RV = { built: false, hover: null, narrow: null, planKey: '', on: [] };

  function pairData(model) {
    if (model._pairs) return model._pairs;
    var P = {};
    model.journeys.forEach(function (a) { P[a.id] = {}; });
    model.list.forEach(function (n) {
      for (var i = 0; i < n.js.length; i++) for (var j = 0; j < n.js.length; j++) {
        if (i === j) continue;
        var a = n.js[i], b = n.js[j];
        (P[a][b] = P[a][b] || []).push(n.id);
      }
    });
    model._pairs = P;
    return P;
  }
  function pairN(model, a, b) { var l = pairData(model)[a][b]; return l ? l.length : 0; }

  // Reihenfolge der funktionalen Reisen auf dem Ring: verwandte Reisen liegen nebeneinander (deterministisches Annealing)
  function constOrder(model, items) {
    var m = items.length, i, j;
    if (m < 4) return items.slice();
    var w = items.map(function (a) { return items.map(function (b) { return a === b ? 0 : pairN(model, a.id, b.id); }); });
    function cost(p) {
      var c = 0;
      for (var a = 0; a < m; a++) for (var b = a + 1; b < m; b++) {
        var d = Math.min(b - a, m - (b - a));
        c += w[p[a]][p[b]] * d * d;
      }
      return c;
    }
    var rnd = rngFor(4242), cur = items.map(function (x, k) { return k; }), cc = cost(cur), best = cur.slice(), bc = cc, steps = 14000;
    for (var st = 0; st < steps; st++) {
      var T = 6 * Math.pow(0.002, st / steps) + 1e-6, nx = cur.slice();
      i = (rnd() * m) | 0; j = (rnd() * m) | 0;
      if (i === j) continue;
      if (rnd() < 0.5) { var t = nx[i]; nx[i] = nx[j]; nx[j] = t; } else { var mv = nx.splice(i, 1)[0]; nx.splice(j, 0, mv); }
      var nc = cost(nx);
      if (nc <= cc || rnd() < Math.exp((cc - nc) / T)) { cur = nx; cc = nc; if (cc < bc) { bc = cc; best = cur.slice(); } }
    }
    return best.map(function (k) { return items[k]; });
  }

  function constLayout(model, narrow) {
    var fun = model.journeys.filter(function (j) { return j.typ === 'funktional'; });
    var his = model.journeys.filter(function (j) { return j.typ === 'historisch'; });
    var L = narrow
      ? { w: 380, h: 392, cx: 190, cy: 196, rx: 142, ry: 142, r: 24, hx: 44, hy: 42 }
      : { w: 860, h: 640, cx: 430, cy: 320, rx: 250, ry: 240, r: 33, hx: 112, hy: 68 };
    L.pos = {}; L.lab = {}; L.narrow = narrow;
    var ord = constOrder(model, fun), n = ord.length;
    ord.forEach(function (j, k) {
      var a = -Math.PI / 2 + 2 * Math.PI * k / n, x = L.cx + Math.cos(a) * L.rx, y = L.cy + Math.sin(a) * L.ry;
      L.pos[j.id] = [x, y];
      var c = Math.cos(a), s = Math.sin(a);
      L.lab[j.id] = c > 0.3 ? { x: x + L.r + 9, y: y + 6, a: 'start' } : c < -0.3 ? { x: x - L.r - 9, y: y + 6, a: 'end' } : { x: x, y: s < 0 ? y - L.r - 12 : y + L.r + 24, a: 'middle' };
    });
    var off = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    his.forEach(function (j, k) {
      var o = off[k % 4], x = L.cx + o[0] * L.hx, y = L.cy + o[1] * L.hy;
      L.pos[j.id] = [x, y];
      L.lab[j.id] = { x: x, y: o[1] < 0 ? y - L.r - 11 : y + L.r + 23, a: 'middle' };
    });
    return L;
  }

  function parseIcon(key, size, color) {
    var t = doc.createElement('div');
    t.innerHTML = icon(key, size);
    var ic = t.firstChild;
    if (!ic) return null;
    ic.setAttribute('width', size); ic.setAttribute('height', size);
    ic.style.color = color || '';
    return ic;
  }

  function kindLabel(n) { return (M.kinds && M.kinds[n.kind]) ? M.kinds[n.kind].label : ''; }
  function stationMeta(n) {
    var st = n.st, parts = [kindLabel(n)];
    var y = st.yearLabel || (typeof st.year === 'number' && st.year ? (st.year < 0 ? Math.abs(st.year) + ' v. Chr.' : st.year) : '');
    if (y) parts.push(String(y));
    return parts.filter(Boolean).join(' · ');
  }

  function progressOf(jid) {
    var jj = V.model.byId[jid];
    return M.store ? M.store.progress(jid) : { done: 0, total: jj.order.length };
  }

  function buildRv() {
    var root = h('div', { class: 'gm-rv' });
    var chips = h('ul', { class: 'gm-rv-chips', 'aria-label': (M.t('journey') + ' wählen') });
    var model = V.model;
    RV.chips = {};
    model.journeys.slice().sort(function (a, b) { return a.num - b.num; }).forEach(function (jj) {
      var btn = h('button', {
        type: 'button', class: 'gm-karte-jb', 'aria-pressed': 'false', title: jj.def.name, style: { '--jc': 'var(--j-' + jj.id + ')' },
        on: { click: function () { selectJourney(V.selJ === jj.id ? null : jj.id, { scroll: true }); } }
      },
        h('span', { class: 'gm-karte-jb-num', 'aria-hidden': 'true' }, String(jj.num)),
        h('span', { class: 'gm-karte-jb-short' }, jj.def.kurz || jj.def.name));
      V.onEls.push([btn, jj.id]);
      RV.chips[jj.id] = btn;
      chips.appendChild(h('li', null, btn));
    });
    RV.conBox = h('div', { class: 'gm-rv-con' });
    RV.info = h('p', { class: 'gm-rv-info', 'aria-live': 'polite' });
    RV.plan = h('section', { class: 'gm-rv-plan', 'aria-label': ('Linienplan der gewählten ' + M.t('journey')), tabindex: '-1' });
    root.appendChild(chips);
    root.appendChild(h('div', { class: 'gm-rv-grid' },
      h('div', { class: 'gm-rv-left' },
        h('p', { class: 'gm-rv-lead' }, ('Wähle eine ' + M.t('journey') + ': Der Linienplan zeigt ihre ' + M.t('stations') + ' der Reihe nach. Die Linien dazwischen zeigen, welche ' + M.t('journeys') + ' sich ' + M.t('stations') + ' teilen.')),
        RV.conBox, RV.info,
        h('p', { class: 'gm-rv-note' }, ('Ring: funktionale ' + M.t('journeys') + '. Innen: die historischen ' + M.t('journeys') + '. Je dicker die Verbindung, desto mehr gemeinsame ' + M.t('stations') + '.'))),
      RV.plan));
    RV.root = root;
    RV.built = true;
    return root;
  }

  function rvNarrow() {
    var w = RV.root ? RV.root.clientWidth : 0;
    return w ? w < 700 : !!(window.matchMedia && window.matchMedia('(max-width: 860px)').matches);
  }

  function renderConst() {
    var model = V.model, narrow = rvNarrow(), L = constLayout(model, narrow), P = pairData(model);
    RV.narrow = narrow; RV.L = L;
    RV.on = [];
    var svg = svgEl('svg', { class: 'gm-rv-svg', viewBox: '0 0 ' + L.w + ' ' + L.h, role: 'group', 'aria-label': ('Konstellation der ' + M.t('journeys') + '. Verbindungen zeigen gemeinsame ' + M.t('stations') + '.') });
    var edges = svgEl('g', { 'aria-hidden': 'true' }, svg), badges = svgEl('g', { 'aria-hidden': 'true' }, svg), nodesG = svgEl('g', null, svg);
    // Block der historischen Reisen
    var hb = model.journeys.some(function (j) { return j.typ === 'historisch'; });
    if (hb) {
      var bw = L.hx + L.r + (narrow ? 12 : 62), bh = L.hy + L.r + (narrow ? 12 : 40);
      svgEl('rect', { class: 'gm-rv-block', x: L.cx - bw, y: L.cy - bh, width: 2 * bw, height: 2 * bh, rx: narrow ? 22 : 30 }, edges);
    }
    RV.edges = [];
    var js = model.journeys;
    for (var i = 0; i < js.length; i++) for (var j = i + 1; j < js.length; j++) {
      var a = js[i], b = js[j], n = pairN(model, a.id, b.id);
      if (!n) continue;
      var pa = L.pos[a.id], pb = L.pos[b.id], mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
      var ring = a.typ === 'funktional' && b.typ === 'funktional', pull = ring ? 0.62 : 0;
      var cx = mx + (L.cx - mx) * pull, cy = my + (L.cy - my) * pull;
      var d = 'M' + f1(pa[0]) + ' ' + f1(pa[1]) + ' Q' + f1(cx) + ' ' + f1(cy) + ' ' + f1(pb[0]) + ' ' + f1(pb[1]);
      var wdt = (narrow ? 0.9 : 1.2) + n * (narrow ? 0.7 : 0.95);
      var cls = 'gm-rv-edge ' + (n >= 3 ? 'is-strong' : n === 2 ? 'is-weak' : 'is-faint');
      var path = svgEl('path', { class: cls, d: d, style: 'stroke-width:' + Math.min(wdt, 12).toFixed(1) + 'px' }, edges);
      // Zahl auf der Verbindung (nur bei Hervorhebung)
      var t = 0.5, qx = (1 - t) * (1 - t) * pa[0] + 2 * t * (1 - t) * cx + t * t * pb[0], qy = (1 - t) * (1 - t) * pa[1] + 2 * t * (1 - t) * cy + t * t * pb[1];
      var bg = svgEl('g', { class: 'gm-rv-badge', transform: 'translate(' + f1(qx) + ' ' + f1(qy) + ')' }, badges);
      svgEl('circle', { r: narrow ? 9 : 11 }, bg);
      svgEl('text', { text: String(n), y: 0.5 }, bg);
      RV.edges.push({ a: a.id, b: b.id, n: n, path: path, badge: bg });
    }
    RV.nodes = {};
    js.forEach(function (jj) {
      var pos = L.pos[jj.id], p = progressOf(jj.id);
      var g = svgEl('g', { class: 'gm-rv-node', transform: 'translate(' + f1(pos[0]) + ' ' + f1(pos[1]) + ')', tabindex: '0', role: 'button', 'data-j': jj.id, style: '--jc:var(--j-' + jj.id + ')' }, nodesG);
      svgEl('circle', { class: 'gm-rv-sel', r: L.r + 9 }, g);
      svgEl('circle', { class: 'gm-rv-track', r: L.r + 4.5 }, g);
      var arc = svgEl('circle', { class: 'gm-rv-prog', r: L.r + 4.5, pathLength: '1', transform: 'rotate(-90)' }, g);
      svgEl('circle', { class: 'gm-rv-disc', r: L.r }, g);
      var on = onColor(jj.id) || '#fff';
      if (narrow) svgEl('text', { class: 'gm-rv-big', text: String(jj.num), y: 1, style: 'fill:' + on }, g);
      else {
        var ic = parseIcon(jj.def.icon || 'train', 30, on);
        if (ic) { ic.setAttribute('x', -15); ic.setAttribute('y', -15); g.appendChild(ic); }
        var bd = svgEl('g', { transform: 'translate(' + f1(-L.r * 0.74) + ' ' + f1(-L.r * 0.74) + ')' }, g);
        svgEl('circle', { class: 'gm-rv-numc', r: 12 }, bd);
        svgEl('text', { class: 'gm-rv-num', text: String(jj.num), y: 0.5 }, bd);
        var lb = L.lab[jj.id];
        svgEl('text', { class: 'gm-rv-name', x: lb.x - pos[0], y: lb.y - pos[1], 'text-anchor': lb.a, text: jj.typ === 'historisch' ? stripKurz(jj.def.kurz || jj.def.name) : (jj.def.kurz || jj.def.name) }, g);
      }
      var tt = svgEl('title', { text: jj.def.name }, g);
      g.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' || !e.pointerType) { RV.hover = jj.id; paintRv(); } });
      g.addEventListener('pointerleave', function (e) { if (RV.hover === jj.id) { RV.hover = null; paintRv(); } });
      g.addEventListener('focus', function () { RV.hover = jj.id; paintRv(); });
      g.addEventListener('blur', function () { if (RV.hover === jj.id) { RV.hover = null; paintRv(); } });
      g.addEventListener('click', function () { selectJourney(V.selJ === jj.id ? null : jj.id, { scroll: true }); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectJourney(V.selJ === jj.id ? null : jj.id, { scroll: true }); }
        else if (e.key === 'Escape' && V.selJ) { e.preventDefault(); e.stopPropagation(); selectJourney(null); }
      });
      RV.nodes[jj.id] = { g: g, arc: arc, jj: jj, title: tt };
      spMark(g, 'episode/' + jj.id, null);
      RV.on.push([g, jj.id]);
    });
    RV.conBox.innerHTML = '';
    RV.conBox.appendChild(svg);
    RV.svg = svg;
    updateRvProgress();
    paintRv();
  }

  function paintRvOn() {
    (RV.on || []).forEach(function (p) { var c = onColor(p[1]); if (c) p[0].style.setProperty('--gk-on', c); });
    if (RV.nodes) Object.keys(RV.nodes).forEach(function (id) {
      var c = onColor(id), n = RV.nodes[id].g;
      if (c) { var tx = n.querySelector('.gm-rv-big'); if (tx) tx.style.fill = c; var ic = n.querySelector('svg'); if (ic) ic.style.color = c; }
    });
  }

  function sharedSummary(jid) {
    var model = V.model, parts = [];
    model.journeys.forEach(function (o) {
      if (o.id === jid) return;
      var n = pairN(model, jid, o.id);
      if (n) parts.push([n, o]);
    });
    parts.sort(function (a, b) { return b[0] - a[0] || a[1].num - b[1].num; });
    return parts;
  }

  function paintRv() {
    if (!RV.nodes) return;
    var act = RV.hover || V.selJ, model = V.model;
    var conn = {};
    if (act) sharedSummary(act).forEach(function (p) { conn[p[1].id] = p[0]; });
    RV.svg.classList.toggle('has-act', !!act);
    Object.keys(RV.nodes).forEach(function (id) {
      var g = RV.nodes[id].g;
      g.classList.toggle('is-act', id === act);
      g.classList.toggle('is-nb', !!act && id !== act && !!conn[id]);
      g.classList.toggle('is-sel', id === V.selJ);
      g.setAttribute('aria-pressed', id === V.selJ ? 'true' : 'false');
    });
    RV.edges.forEach(function (e) {
      var on = !!act && (e.a === act || e.b === act);
      e.path.classList.toggle('is-on', on);
      e.badge.classList.toggle('is-on', on);
      if (on) e.path.style.setProperty('--ec', 'var(--j-' + act + ')'); else e.path.style.removeProperty('--ec');
    });
    // Beschreibung
    if (!act) { RV.info.textContent = ('Fahre über eine ' + M.t('journey') + ' oder tippe sie an, um zu sehen, welche ' + M.t('stations') + ' sie mit anderen teilt.'); }
    else {
      var jj = model.byId[act], sum = sharedSummary(act);
      var txt = jj.def.name + ' teilt ';
      if (!sum.length) txt += ('keine ' + M.t('stations') + ' mit anderen ' + M.t('journeys') + '.');
      else txt += sum.slice(0, 6).map(function (p) { return p[0] + (p[0] === 1 ? (' ' + M.t('station')) : (' ' + M.t('stations'))) + ' mit ' + (p[1].def.kurz || p[1].def.name); }).join(', ') + (sum.length > 6 ? ' und weiteren.' : '.');
      RV.info.textContent = txt;
    }
    Object.keys(RV.chips || {}).forEach(function (id) { RV.chips[id].setAttribute('aria-pressed', id === V.selJ ? 'true' : 'false'); });
  }

  function updateRvProgress() {
    if (!RV.nodes) return;
    Object.keys(RV.nodes).forEach(function (id) {
      var o = RV.nodes[id], p = progressOf(id), f = p.total ? p.done / p.total : 0;
      o.arc.style.strokeDasharray = (f).toFixed(3) + ' 1';
      var lbl = (M.t('journey') + ' ') + o.jj.num + ': ' + o.jj.def.name + ', ' + o.jj.order.length + (' ' + M.t('stations') + ', ') + p.done + ' besucht';
      var sum = sharedSummary(id);
      if (sum.length) lbl += ('. Teilt ' + M.t('stations') + ' mit ') + sum.slice(0, 4).map(function (q) { return (q[1].def.kurz || q[1].def.name) + ' (' + q[0] + ')'; }).join(', ');
      o.g.setAttribute('aria-label', lbl);
    });
  }

  /* ---------- Linienplan einer Reise ---------- */

  function wrapText(s, maxW, font, maxLines) {
    var words = String(s).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (cur && textWidth(t, font) > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last.length > 3 && textWidth(last + '…', font) > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/[\s,.;:–-]+$/, '') + '…';
    }
    return lines;
  }

  function renderPlan() {
    var box = RV.plan, jid = V.selJ, model = V.model;
    box.innerHTML = '';
    RV.stEls = {};
    if (!jid) {
      box.classList.remove('is-on');
      box.appendChild(h('div', { class: 'gm-rv-empty' },
        h('h3', null, ('Der Linienplan einer ' + M.t('journey'))),
        h('p', null, ('Hier erscheint, sobald du links eine ' + M.t('journey') + ' wählst, ihre Strecke mit allen ' + M.t('stations') + ' in der Reihenfolge der Fahrt.')),
        h('p', null, ('Ein Ring bedeutet: Hier kreuzt sich die ' + M.t('journey') + ' mit anderen. Die kleinen Zahlen führen dich dorthin um.'))));
      return;
    }
    box.classList.add('is-on');
    var jj = model.byId[jid], p = progressOf(jid);
    box.style.setProperty('--jc', 'var(--j-' + jid + ')');
    var onc = onColors(jid);
    if (onc) { box.style.setProperty('--gk-on', onc.on); if (onc.bg) box.style.setProperty('--gk-go', onc.bg); else box.style.removeProperty('--gk-go'); }
    var go = h('button', { type: 'button', class: 'gm-karte-go', on: { click: function () { if (M.nav) M.nav.openJourney(jid); } }, html: ('<span>' + M.t('journey') + ' antreten</span>') + icon('arrow-right', 18) });
    go.setAttribute('aria-label', (M.t('journey') + ' antreten: ') + jj.def.name);
    RV.prog = h('p', { class: 'gm-rv-prog' });
    var back = h('button', { type: 'button', class: 'gm-rv-back', on: { click: function () { selectJourney(null); var c = RV.nodes[jid]; if (RV.conBox) RV.conBox.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); if (c) try { c.g.focus({ preventScroll: true }); } catch (e) { /* egal */ } } }, html: icon('arrow-left', 16) + '<span>Zurück zur Übersicht</span>' });
    box.appendChild(h('header', { class: 'gm-rv-head' },
      h('span', { class: 'gm-rv-hnum', 'aria-hidden': 'true' }, String(jj.num)),
      h('div', { class: 'gm-rv-htxt' }, h('h3', null, jj.def.name), h('p', null, jj.def.tagline || '')),
      h('div', { class: 'gm-rv-hgo' }, go)));
    box.appendChild(h('div', { class: 'gm-rv-sub' }, RV.prog, back));

    var W = Math.max(300, Math.floor(box.clientWidth - 2 * 18));
    var C = W >= 640 ? 2 : 1, font = '600 14.5px ' + (getComputedStyle(box).fontFamily || 'system-ui, sans-serif');
    var metaFont = '500 12px ' + (getComputedStyle(box).fontFamily || 'system-ui, sans-serif');
    var padX = 14, colW = (W - 2 * padX) / C, chipSp = 52, labelGap = 24, textW = colW - chipSp - labelGap - 14;
    var items = jj.order.map(function (sid) {
      var n = model.nodes[sid], others = n.js.filter(function (x) { return x !== jid; });
      var lines = wrapText(n.title, textW, font, 3), meta = stationMeta(n);
      var fan = others.length, t0 = Math.max(0, (fan - 1) / 2 * 25 + 12 - 15);
      var titleH = lines.length * 18 + (meta ? 16 : 0);
      var hgt = Math.max(t0 + 15 - 9 + titleH + 14, t0 + 15 + (fan - 1) / 2 * 25 + 14, 52);
      return { n: n, others: others, lines: lines, meta: meta, t0: t0, h: hgt };
    });
    // Spalten (Serpentine: Spalte 1 abwärts, Spalte 2 aufwärts); bei zwei Spalten möglichst nah an der Hälfte schneiden
    var cols = [items], k;
    if (C === 2) {
      var tot = items.reduce(function (a, it) { return a + it.h; }, 0), run = 0, cut = 1;
      for (k = 0; k < items.length; k++) { run += items[k].h; if (run >= tot / 2) { cut = (run - tot / 2) < (items[k].h / 2) ? k + 1 : k; break; } }
      cut = Math.max(1, Math.min(items.length - 1, cut));
      cols = [items.slice(0, cut), items.slice(cut)];
    }
    var top = 40, colH = cols.map(function (c) { return c.reduce(function (a, it) { return a + it.h; }, 0); }), H = Math.max.apply(null, colH);
    var svg = svgEl('svg', { class: 'gm-rv-planSvg', viewBox: '0 0 ' + W + ' ' + (top + H + 44), width: W, height: top + H + 44, role: 'list', 'aria-label': (M.t('stations') + ' von ') + jj.def.name });
    var lineG = svgEl('g', { 'aria-hidden': 'true' }, svg), stubG = svgEl('g', { 'aria-hidden': 'true' }, svg), stG = svgEl('g', null, svg);
    var pts = [], pos = [];
    cols.forEach(function (col, c) {
      var lx = padX + c * colW + chipSp, down = c % 2 === 0, yy = down ? top : top + H, seq = [];
      col.forEach(function (it) {
        if (down) { seq.push({ it: it, y0: yy }); yy += it.h; } else { yy -= it.h; seq.push({ it: it, y0: yy }); }
      });
      if (c > 0) pts.push([lx, down ? top - 24 : top + H + 24]);
      seq.forEach(function (o) { o.cy = o.y0 + o.it.t0 + 15; o.lx = lx; pos.push(o); pts.push([lx, o.cy]); });
      if (c < cols.length - 1) pts.push([lx, down ? top + H + 24 : top - 24]);
    });
    var d = roundedPath(pts, 20);
    svgEl('path', { class: 'gm-rv-casing', d: d }, lineG);
    svgEl('path', { class: 'gm-rv-line', d: d }, lineG);
    if (jj.typ === 'historisch') svgEl('path', { class: 'gm-rv-line-in', d: d }, lineG);
    pos.forEach(function (o, idx) {
      var n = o.it.n, cy = o.cy, lx = o.lx;
      // Abzweige zu den anderen Reisen
      o.it.others.forEach(function (oid, i) {
        var oj = model.byId[oid], fy = cy + (i - (o.it.others.length - 1) / 2) * 25, cxp = lx - 38;
        svgEl('path', { class: 'gm-rv-stub', d: 'M' + f1(lx) + ' ' + f1(cy) + ' C' + f1(lx - 18) + ' ' + f1(cy) + ' ' + f1(lx - 18) + ' ' + f1(fy) + ' ' + f1(cxp + 10) + ' ' + f1(fy), style: '--jc:var(--j-' + oid + ')' }, stubG);
        var ch = svgEl('g', { class: 'gm-rv-chip', transform: 'translate(' + f1(cxp) + ' ' + f1(fy) + ')', tabindex: '0', role: 'button', 'aria-label': ('Zur ' + M.t('journey') + ' ') + oj.num + ': ' + oj.def.name + ' wechseln', style: '--jc:var(--j-' + oid + ');--gk-on:' + (onColor(oid) || '#fff') }, stG);
        svgEl('circle', { r: 10.5 }, ch);
        svgEl('text', { text: String(oj.num), y: 0.5 }, ch);
        svgEl('title', { text: oj.def.name }, ch);
        RV.on.push([ch, oid]);
        var go2 = function () { selectJourney(oid, { station: n.id, scroll: false }); };
        ch.addEventListener('click', function (e) { e.stopPropagation(); go2(); });
        ch.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go2(); } });
      });
      var lab = (M.t('station') + ' ') + (idx + 1) + ' von ' + jj.order.length + ': ' + n.title + (o.it.others.length ? ('. ' + M.t('interchange') + ' mit ') + joinDe(o.it.others.map(function (x) { return model.byId[x].def.name; })) : '') + (n.myth ? '. Mythos' : '') + (n.exhibit ? ('. Mit ' + M.t('exhibit')) : '');
      var g = svgEl('g', { class: 'gm-rv-st' + (n.js.length > 1 ? ' is-x' : ''), tabindex: '0', role: 'link', 'aria-label': lab, 'data-id': n.id }, stG);
      var ring = svgEl('circle', { class: 'gm-rv-hl', cx: lx, cy: cy, r: 19 }, g);
      var kn = svgEl('g', { class: 'gm-karte-kn', transform: 'translate(' + f1(lx) + ' ' + f1(cy) + ') scale(1.1)', style: '--jc:var(--j-' + jid + ')' }, g);
      drawGlyph(kn, { js: n.js.length > 1 ? orderJs(n.js, jid) : [jid], myth: n.myth, exhibit: n.exhibit, focusRing: false, glow: false });
      var tx = svgEl('text', { class: 'gm-rv-t', x: lx + labelGap, y: o.y0 + o.it.t0 + 15 + 5 }, g);
      o.it.lines.forEach(function (ln, i) { svgEl('tspan', { x: lx + labelGap, dy: i ? 18 : 0, text: ln }, tx); });
      if (o.it.meta) svgEl('text', { class: 'gm-rv-m', x: lx + labelGap, y: o.y0 + o.it.t0 + 15 + 5 + o.it.lines.length * 18 - 2 }, g).textContent = o.it.meta;
      svgEl('rect', { class: 'gm-rv-hit', x: lx - 16, y: o.y0 + o.it.t0, width: colW - chipSp + 4, height: Math.max(30, o.it.lines.length * 18 + (o.it.meta ? 16 : 0) + 6) }, g);
      var open = function () { if (M.nav) M.nav.openStation(n.id, jid); };
      g.addEventListener('click', open);
      g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      g.setAttribute('aria-label', lab + spSuffix('inhalt/' + n.id));
      RV.stEls[n.id] = { g: g, kn: kn, cy: cy, x: lx, base: lab };
      spMark(g, 'inhalt/' + n.id, 17);
    });
    box.appendChild(svg);
    RV.svgPlan = svg;
    RV.planKey = jid + '|' + W;
    updatePlanState();
  }

  function orderJs(js, first) { return [first].concat(js.filter(function (x) { return x !== first; })); }

  function updatePlanState() {
    if (!V.selJ || !RV.stEls) return;
    var jid = V.selJ, p = progressOf(jid);
    if (RV.prog) RV.prog.textContent = p.done + ' von ' + p.total + (' ' + M.t('stations') + ' besucht');
    Object.keys(RV.stEls).forEach(function (id) {
      var vis = M.store && M.store.isVisited(id);
      RV.stEls[id].kn.classList.toggle('is-visited', !!vis);
      var lab = RV.stEls[id].g.getAttribute('aria-label') || '';
      lab = lab.replace(/\. Besucht$/, '');
      if (!spAn()) RV.stEls[id].g.setAttribute('aria-label', vis ? lab + '. Besucht' : lab);
    });
  }

  function highlightStation(id) {
    var o = RV.stEls && RV.stEls[id];
    if (!o) return;
    Object.keys(RV.stEls).forEach(function (k) { RV.stEls[k].g.classList.remove('is-pulse'); });
    void o.g.getBoundingClientRect();
    o.g.classList.add('is-pulse');
    setTimeout(function () { o.g.classList.remove('is-pulse'); }, 3600);
    try { o.g.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { /* egal */ }
    try { o.g.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }

  function selectJourney(jid, o) {
    o = o || {};
    if (jid && !V.model.byId[jid]) jid = null;
    var same = jid === V.selJ;
    V.selJ = jid;
    if (!RV.built) return;
    if (V.mode === 'reisen' && RV.root && RV.root.clientWidth) {
      paintRv();
      if (!same || !RV.svgPlan) renderPlan();
      if (jid) {
        if (o.station) highlightStation(o.station);
        else if (o.scroll) {
          var narrow = rvNarrow();
          if (narrow) { try { RV.plan.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { /* egal */ } }
        }
        if (M.announce && o.announce !== false) M.announce('Linienplan: ' + V.model.byId[jid].def.name);
      }
    } else RV.dirty = true;
  }

  function renderRv() {
    if (!RV.built || !RV.root || !RV.root.clientWidth) return;
    renderConst();
    renderPlan();
    RV.dirty = false;
    paintRvOn();
    if (V.pendingStation && V.selJ) { var s = V.pendingStation; V.pendingStation = null; highlightStation(s); }
  }

  function onRvResize() {
    if (V.mode !== 'reisen' || !RV.root || !RV.root.clientWidth) return;
    var narrow = rvNarrow();
    if (narrow !== RV.narrow) { renderConst(); paintRvOn(); }
    if (V.selJ) {
      var W = Math.max(300, Math.floor(RV.plan.clientWidth - 36));
      var key = V.selJ + '|' + W;
      if (RV.planKey !== key && Math.abs((parseInt(RV.planKey.split('|')[1], 10) || 0) - W) > 20) { renderPlan(); paintRvOn(); }
    }
  }

  /* ---------- Öffentliche Schnittstelle ---------- */

  function ensureCurrent() {
    // Daten könnten sich seit dem Aufbau geändert haben (z. B. Dev-Fixture)
    var sig = modelSignature(buildModel());
    if (sig !== V.sig) {
      var mode = V.mode;
      build();
      setMode(mode, false);
      V.fitted = false;
    }
  }

  function playIntro() {
    V.introDone = true;
    if (reduced()) return;
    V.root.classList.add('gm-karte-intro');
    var stop = function () {
      clearTimeout(V.introT);
      V.root.classList.remove('gm-karte-intro');
      V.vp.removeEventListener('pointerdown', stop);
      V.vp.removeEventListener('wheel', stop);
      V.vp.removeEventListener('keydown', stop);
    };
    V.vp.addEventListener('pointerdown', stop);
    V.vp.addEventListener('wheel', stop, { passive: true });
    V.vp.addEventListener('keydown', stop);
    V.introT = setTimeout(stop, 3300);
  }

  function show() {
    if (!V.root) return;
    ensureCurrent();
    V.shown = true;
    if (!V.model || !V.model.list.length) return;
    if (V.ro && V.vp && !V.roBound) { V.ro.observe(V.vp); V.roBound = true; }
    if (V.ro && RV.root && !V.rvBound) { V.ro.observe(RV.root); V.rvBound = true; }
    onStore();
    if (V.mode === 'reisen') renderRv();
    if (V.mode === 'netz') onResize(!V.fitted);
    if (!V.introDone && V.mode === 'netz' && V.vw) playIntro();
    if (V.pending) {
      var p = V.pending;
      V.pending = null;
      if (p.journey !== undefined) highlightJourney(p.journey);
      if (p.station) focusStation(p.station);
    }
  }

  function hide() {
    V.shown = false;
    if (V.tip) hideTip();
  }

  function focusStation(id) {
    if (!V.model || !V.model.nodes[id]) return;
    if (!V.shown) { V.pending = { station: id, journey: V.pending ? V.pending.journey : undefined }; return; }
    if (V.mode === 'liste') setMode(V.lastMode || 'reisen', true);
    var n = V.model.nodes[id];
    if (V.mode === 'reisen') {
      if (!RV.root || !RV.root.clientWidth) { V.pending = { station: id, journey: V.pending ? V.pending.journey : undefined }; return; }
      if (!RV.nodes) renderRv();
      selectJourney(V.selJ && n.js.indexOf(V.selJ) >= 0 ? V.selJ : n.js[0], { station: id });
      return;
    }
    if (!V.vw) onResize(true);
    if (!V.vw) { V.pending = { station: id, journey: V.pending ? V.pending.journey : undefined }; return; }
    centerOn(n, Math.max(V.k, V.kfit * 2.4), true);
    n.el.classList.remove('is-pulse');
    void n.el.getBoundingClientRect();
    n.el.classList.add('is-pulse');
    setTimeout(function () { n.el.classList.remove('is-pulse'); }, 3200);
    try { n.el.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    if (M.announce) M.announce('Auf der Karte: ' + n.title);
  }

  function highlightJourney(id) {
    if (!V.model || !V.model.list.length) {
      V.pending = { journey: id || null, station: V.pending ? V.pending.station : undefined };
      return;
    }
    if (id && !V.model.byId[id]) id = null;
    selectJourney(id || null, { announce: V.shown && V.mode === 'reisen' });
    setFocus(id || null, { announce: V.shown && V.mode === 'netz' });
  }

  M.views.karte = {
    mount: mount,
    show: show,
    hide: hide,
    focusStation: focusStation,
    highlightJourney: highlightJourney
  };
})();

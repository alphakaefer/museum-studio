/* Gehirnmuseum – Exponat „Neuronen-Spielwiese“ (Hebbsche Regel)
 * MUSEUM.exhibits.hebb = { title, blurb, mount(container, ctx) -> destroy() }
 * Klassisches Script, keine Abhängigkeiten, keine externen Requests, nichts wird gespeichert oder gesendet.
 *
 * Modell (bewusst einfach):
 *  - 14 Neuronen, Synapsen als ungerichtete Verbindungen mit einem Gewicht w zwischen 0 und 1.
 *  - Ein Klick/Tipp/Enter regt ein Neuron an. Es feuert, und ein Signal läuft über jede seiner Verbindungen.
 *  - Beim Eintreffen addiert das Signal sein Gewicht zur „Ladung“ des Zielneurons (zerfällt rasch).
 *    Erreicht die Ladung die Schwelle (0,6), feuert auch das Zielneuron.
 *  - Hebb-Regel: Feuern zwei verbundene Neuronen innerhalb von 1,5 Sekunden nacheinander, wächst das Gewicht
 *    ihrer Synapse (w += 0,2 · (1 − w)).
 *  - Ungenutzte Synapsen kehren nach einer Schonfrist langsam zu einem Ruhewert zurück (Verblassen).
 */
(function () {
  'use strict';

  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.exhibits = M.exhibits || {};

  /* ------------------------------------------------------------------ *
   * Konstanten
   * ------------------------------------------------------------------ */

  var N = 14;                  // Anzahl Neuronen
  var W_START = 0.15;          // Startgewicht aller Synapsen
  var W_FLOOR = 0.05;          // Ruhewert, auf den ungenutzte Synapsen zurückfallen
  var ETA = 0.2;               // Lernrate je Koinzidenz
  var THETA = 0.6;             // Schwelle: ab hier löst ein einzelnes Signal das Zielneuron aus
  var HEBB_WINDOW = 1500;      // ms – Zeitfenster für „kurz nacheinander“ (im echten Gehirn: wenige bis einige Dutzend Millisekunden)
  var CD_SIGNAL = 1500;        // ms – Neuron lässt sich nach dem Feuern so lange nicht per Signal erneut auslösen
  var CD_CLICK = 350;          // ms – Mindestabstand zwischen zwei Anregungen desselben Neurons
  var MAX_HOPS = 5;            // Reichweite einer Signalkaskade
  var GRACE = 6000;            // ms – so lange bleibt eine Synapse nach Benutzung unverändert
  var TAU_FADE = 30000;        // ms – Zeitkonstante des Verblassens
  var TAU_V = 500;             // ms – Zerfall der Ladung
  var GLOW_MS = 1100;          // ms – Nachleuchten nach dem Feuern
  var LABEL_MS = 3500;         // ms – Gewichtsanzeige nach einer Verstärkung
  var R = 13;                  // Radius des Zellkörpers (px)
  var PAD = 32;                // Innenabstand des Spielfelds (px)
  var PAD_BOTTOM = 30;         // zusätzlicher Platz unten für den Hinweis „Tippe ein Neuron an“
  var STRONG_MIN = 0.2;        // darunter gilt die „stärkste Verbindung“ als nicht ausgeprägt

  var FONT_UI = 'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  var SOURCES = [
    'Hebb, D. O. (1949). The Organization of Behavior: A Neuropsychological Theory. New York: Wiley.',
    'Bliss, T. V. P., & Lømo, T. (1973). Long-lasting potentiation of synaptic transmission in the dentate area of the anaesthetized rabbit following stimulation of the perforant path. Journal of Physiology, 232(2), 331–356.',
    'Markram, H., Lübke, J., Frotscher, M., & Sakmann, B. (1997). Regulation of synaptic efficacy by coincidence of postsynaptic APs and EPSPs. Science, 275(5297), 213–215.',
    'Bi, G.-q., & Poo, M.-m. (1998). Synaptic modifications in cultured hippocampal neurons: Dependence on spike timing, synaptic strength, and postsynaptic cell type. Journal of Neuroscience, 18(24), 10464–10472.',
    'Turrigiano, G. G., Leslie, K. R., Desai, N. S., Rutherford, L. C., & Nelson, S. B. (1998). Activity-dependent scaling of quantal amplitude in neocortical neurons. Nature, 391, 892–896.',
    'Shatz, C. J. (1992). The developing brain. Scientific American, 267(3), 60–67.',
    'Azevedo, F. A. C., et al. (2009). Equal numbers of neuronal and nonneuronal cells make the human brain an isometrically scaled-up primate brain. Journal of Comparative Neurology, 513(5), 532–541.'
  ];

  /* ------------------------------------------------------------------ *
   * Kleine lokale Helfer
   * ------------------------------------------------------------------ */

  var uidCounter = 0;

  function el(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'on') Object.keys(v).forEach(function (ev) { n.addEventListener(ev, v[ev]); });
        else n.setAttribute(k, v === true ? '' : v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(n, arguments[i]);
    return n;
  }

  function append(parent, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(parent, c); }); return; }
    parent.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function fmt(w) { return w.toFixed(2).replace('.', ','); }

  function nowMs() {
    return (window.performance && typeof performance.now === 'function') ? performance.now() : Date.now();
  }

  function prefersReduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Farben: "#rgb", "#rrggbb", "rgb()/rgba()" -> [r,g,b]
  function parseColor(str, fallback) {
    var s = String(str || '').trim();
    var m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(s))) {
      return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    }
    if ((m = /^#([0-9a-f]{6})/i.exec(s))) {
      return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    }
    if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s))) {
      return [+m[1], +m[2], +m[3]];
    }
    return fallback;
  }

  function mix(c1, c2, t) {
    return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
  }

  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a === undefined ? 1 : a) + ')';
  }

  /* ------------------------------------------------------------------ *
   * Netzwerk-Layout (deterministisch, ohne Zufall zur Laufzeit)
   * ------------------------------------------------------------------ */

  function genPoints(aspect, seed) {
    var rnd = mulberry32(seed);
    var pts = [{ x: rnd(), y: rnd() }];
    function d2(a, b) { var dx = (a.x - b.x) * aspect, dy = a.y - b.y; return dx * dx + dy * dy; }
    while (pts.length < N) {
      var best = null, bestD = -1;
      for (var c = 0; c < 28; c++) {
        var cand = { x: rnd(), y: rnd() };
        var md = Infinity;
        for (var k = 0; k < pts.length; k++) md = Math.min(md, d2(cand, pts[k]));
        if (md > bestD) { bestD = md; best = cand; }
      }
      pts.push(best);
    }
    return pts;
  }

  // Gabriel-Graph mit leicht verschärftem Kriterium: planar, zusammenhängend, nicht zu dicht.
  function genEdges(pts, aspect) {
    var P = pts.map(function (p) { return [p.x * aspect, p.y]; });
    var out = [];
    for (var i = 0; i < P.length; i++) {
      for (var j = i + 1; j < P.length; j++) {
        var mx = (P[i][0] + P[j][0]) / 2, my = (P[i][1] + P[j][1]) / 2;
        var r = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]) / 2;
        var ok = true;
        for (var k = 0; k < P.length && ok; k++) {
          if (k === i || k === j) continue;
          if (Math.hypot(P[k][0] - mx, P[k][1] - my) < r * 1.1) ok = false;
        }
        if (ok) out.push([i, j]);
      }
    }
    return out;
  }

  function connected(n, edges) {
    var seen = [0], mark = {}; mark[0] = true;
    while (seen.length) {
      var u = seen.pop();
      for (var i = 0; i < edges.length; i++) {
        var v = edges[i][0] === u ? edges[i][1] : (edges[i][1] === u ? edges[i][0] : -1);
        if (v >= 0 && !mark[v]) { mark[v] = true; seen.push(v); }
      }
    }
    return Object.keys(mark).length === n;
  }

  function buildNetwork(aspect) {
    var best = null;
    for (var s = 0; s < 60; s++) {
      var pts = genPoints(aspect, 4711 + s * 97);
      var minD = Infinity;
      for (var i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
          minD = Math.min(minD, Math.hypot((pts[i].x - pts[j].x) * aspect, pts[i].y - pts[j].y));
        }
      }
      var ed = genEdges(pts, aspect);
      if (!connected(pts.length, ed)) continue;
      var score = minD + (ed.length >= 20 && ed.length <= 27 ? 0.08 : 0) - Math.abs(ed.length - 23) * 0.004;
      if (!best || score > best.score) best = { score: score, pts: pts, minD: minD };
    }
    var pts2 = best ? best.pts : genPoints(aspect, 4711);
    // Beschriftung in Leserichtung: breite Felder links -> rechts, hohe Felder oben -> unten
    pts2 = pts2.slice().sort(function (a, b) { return aspect > 1 ? a.x - b.x : a.y - b.y; });
    var edges = genEdges(pts2, aspect);
    if (!connected(pts2.length, edges)) {
      // Notnagel: Kette in Sortierreihenfolge (kommt mit festen Seeds praktisch nie vor)
      edges = [];
      for (var q = 0; q + 1 < pts2.length; q++) edges.push([q, q + 1]);
    }
    return { pts: pts2, edges: edges };
  }

  /* ------------------------------------------------------------------ *
   * Styles (einmalig)
   * ------------------------------------------------------------------ */

  function injectStyles() {
    if (document.head.querySelector('style[data-gx="hebb"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gx', 'hebb');
    var darkVars =
      '--gx-hebb-bg:var(--bg,#0E1420);--gx-hebb-bg2:var(--bg-2,#161E2E);--gx-hebb-bg3:var(--bg-3,#1E2838);' +
      '--gx-hebb-ink:var(--ink,#ECE8DF);--gx-hebb-ink2:var(--ink-2,#A3ABBB);--gx-hebb-line:var(--line,#2C3850);' +
      '--gx-hebb-accent:var(--accent,#46B3DB);--gx-hebb-warm:var(--warm,#FCB300);--gx-hebb-ok:var(--ok,#57C58A);' +
      '--gx-hebb-onacc:#0E1420;' +
      '--gx-hebb-shadow:var(--shadow,0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35));';
    s.textContent = [
      '.gx-hebb{',
      '--gx-hebb-bg:var(--bg,#F6F2EA);--gx-hebb-bg2:var(--bg-2,#FFFFFF);--gx-hebb-bg3:var(--bg-3,#ECE6DA);',
      '--gx-hebb-ink:var(--ink,#1B2230);--gx-hebb-ink2:var(--ink-2,#5C6577);--gx-hebb-line:var(--line,#D9D2C3);',
      '--gx-hebb-accent:var(--accent,#05749E);--gx-hebb-warm:var(--warm,#FCB300);--gx-hebb-ok:var(--ok,#2F8F5B);',
      '--gx-hebb-onacc:#FFFFFF;--gx-hebb-radius:var(--radius,14px);',
      '--gx-hebb-shadow:var(--shadow,0 1px 2px rgba(20,25,40,.08),0 8px 24px rgba(20,25,40,.08));',
      '--gx-hebb-display:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif);',
      '--gx-hebb-ui:var(--font-ui,' + FONT_UI + ');',
      '}',
      '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gx-hebb{' + darkVars + '}}',
      ':root[data-theme="dark"] .gx-hebb{' + darkVars + '}',

      '.gx-hebb{box-sizing:border-box;max-width:880px;margin:0 auto;color:var(--gx-hebb-ink);font-family:var(--gx-hebb-ui);font-size:1rem;line-height:1.55;text-align:left}',
      '.gx-hebb *,.gx-hebb *::before,.gx-hebb *::after{box-sizing:border-box}',
      '.gx-hebb p{margin:0}',

      /* Kopf */
      '.gx-hebb-eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gx-hebb-accent)}',
      '.gx-hebb-title{margin:.15rem 0 .5rem;font-family:var(--gx-hebb-display);font-weight:600;font-size:clamp(1.45rem,1.2rem + 1.2vw,1.9rem);line-height:1.2;color:var(--gx-hebb-ink)}',
      '.gx-hebb-intro{max-width:62ch;color:var(--gx-hebb-ink);margin-bottom:1.1rem !important}',

      /* Vitrine mit Sockel */
      '.gx-hebb-case{position:relative;margin:0 0 1.9rem;padding:10px;background:var(--gx-hebb-bg2);border:1px solid var(--gx-hebb-line);border-radius:calc(var(--gx-hebb-radius) + 4px);box-shadow:var(--gx-hebb-shadow)}',
      '.gx-hebb-case::after{content:"";position:absolute;left:4%;right:4%;bottom:-13px;height:12px;background:linear-gradient(var(--gx-hebb-bg3),var(--gx-hebb-line));border:1px solid var(--gx-hebb-line);border-top:0;border-radius:0 0 10px 10px;z-index:-1}',
      '.gx-hebb-field{position:relative;width:100%;height:420px;border-radius:var(--gx-hebb-radius);overflow:hidden;touch-action:manipulation;',
      'background:radial-gradient(circle at center,var(--gx-hebb-line) 0.9px,transparent 1.3px) 0 0/22px 22px,radial-gradient(120% 95% at 50% 35%,var(--gx-hebb-bg2) 0%,var(--gx-hebb-bg3) 100%);',
      'box-shadow:inset 0 0 0 1px var(--gx-hebb-line),inset 0 8px 28px rgba(20,25,40,.07)}',
      '.gx-hebb-canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;pointer-events:none}',

      '.gx-hebb-neuron{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
      '.gx-hebb-neuron:hover{box-shadow:inset 0 0 0 2px var(--gx-hebb-accent)}',
      '.gx-hebb-neuron:active{background:rgba(252,179,0,.22)}',
      '.gx-hebb-neuron:focus{outline:none}',
      '.gx-hebb-neuron:focus-visible{outline:3px solid var(--gx-hebb-accent);outline-offset:3px;box-shadow:0 0 0 3px var(--gx-hebb-bg2)}',

      '.gx-hebb-prompt{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);max-width:calc(100% - 24px);padding:6px 14px;border-radius:999px;background:var(--gx-hebb-bg2);border:1px solid var(--gx-hebb-line);color:var(--gx-hebb-ink2);font-size:.85rem;white-space:nowrap;pointer-events:none;box-shadow:var(--gx-hebb-shadow);transition:opacity .4s}',
      '.gx-hebb-prompt.is-hidden{opacity:0}',
      '.gx-hebb-prompt b{color:var(--gx-hebb-ink);font-weight:600}',
      '@keyframes gx-hebb-nudge{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-3px)}}',
      '.gx-hebb-prompt{animation:gx-hebb-nudge 2.4s ease-in-out infinite}',

      /* Objektschild */
      '.gx-hebb-label{display:flex;gap:.7rem;align-items:baseline;margin:10px 4px 2px;padding-top:9px;border-top:1px solid var(--gx-hebb-line);font-family:var(--gx-hebb-display);font-size:.92rem;line-height:1.45;color:var(--gx-hebb-ink2)}',
      '.gx-hebb-label strong{flex:none;font-family:var(--gx-hebb-ui);font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gx-hebb-ink);font-weight:700}',

      /* Bedienung */
      '.gx-hebb-hint{color:var(--gx-hebb-ink2);font-size:.9rem;max-width:66ch;margin-bottom:.9rem !important}',
      '.gx-hebb-controls{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:.9rem}',
      '.gx-hebb-btn{min-height:44px;min-width:44px;padding:0 20px;border-radius:999px;border:1.5px solid var(--gx-hebb-ink2);background:transparent;color:var(--gx-hebb-ink);font:600 .95rem/1 var(--gx-hebb-ui);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:background .15s,color .15s,border-color .15s}',
      '.gx-hebb-btn:hover{border-color:var(--gx-hebb-accent);color:var(--gx-hebb-accent)}',
      '.gx-hebb-btn.is-primary{background:var(--gx-hebb-accent);border-color:var(--gx-hebb-accent);color:var(--gx-hebb-onacc)}',
      '.gx-hebb-btn.is-primary:hover{filter:brightness(1.08);color:var(--gx-hebb-onacc)}',
      '.gx-hebb-btn:focus-visible{outline:3px solid var(--gx-hebb-accent);outline-offset:3px}',
      '.gx-hebb-status{min-height:3em;margin-bottom:1rem !important;padding:.55rem .9rem;border-left:3px solid var(--gx-hebb-warm);background:var(--gx-hebb-bg3);border-radius:0 10px 10px 0;font-size:.95rem;color:var(--gx-hebb-ink)}',

      /* Zähler */
      '.gx-hebb-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:1rem}',
      '.gx-hebb-tile{padding:12px 16px 14px;border:1px solid var(--gx-hebb-line);border-radius:var(--gx-hebb-radius);background:var(--gx-hebb-bg2)}',
      '.gx-hebb-tile-k{font-size:.72rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gx-hebb-ink2)}',
      '.gx-hebb-tile-v{font-family:var(--gx-hebb-display);font-size:1.9rem;line-height:1.2;font-weight:600;font-variant-numeric:tabular-nums;color:var(--gx-hebb-ink)}',
      '.gx-hebb-tile-v small{display:block;font-family:var(--gx-hebb-ui);font-size:.95rem;font-weight:600;color:var(--gx-hebb-ink2);line-height:1.3}',
      '.gx-hebb-tile-s{font-size:.82rem;color:var(--gx-hebb-ink2);line-height:1.4}',
      '.gx-hebb-tile.is-wide{grid-column:1/-1}',
      '.gx-hebb-meter{position:relative;height:10px;margin:.45rem 0 .4rem;border-radius:999px;background:var(--gx-hebb-bg3);box-shadow:inset 0 0 0 1px var(--gx-hebb-line);overflow:visible}',
      '.gx-hebb-meter-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--gx-hebb-accent);transition:width .25s}',
      '.gx-hebb-meter-fill.is-strong{background:linear-gradient(90deg,var(--gx-hebb-accent),var(--gx-hebb-warm))}',
      '.gx-hebb-meter-thr{position:absolute;left:60%;top:-4px;bottom:-4px;width:2px;background:var(--gx-hebb-ink);opacity:.7}',

      /* Legende */
      '.gx-hebb-legend{list-style:none;margin:0 0 2rem;padding:0;display:flex;flex-wrap:wrap;gap:8px 22px;font-size:.85rem;color:var(--gx-hebb-ink2)}',
      '.gx-hebb-legend li{display:flex;align-items:center;gap:8px;min-height:24px}',
      '.gx-hebb-sw{flex:none;display:inline-block}',
      '.gx-hebb-sw.is-thin{width:30px;height:2px;border-radius:2px;background:var(--gx-hebb-ink2);opacity:.6}',
      '.gx-hebb-sw.is-thick{width:30px;height:6px;border-radius:3px;background:var(--gx-hebb-accent)}',
      '.gx-hebb-sw.is-signal{width:11px;height:11px;border-radius:50%;background:var(--gx-hebb-warm);box-shadow:0 0 0 1px var(--gx-hebb-ink)}',
      '.gx-hebb-sw.is-fire{width:16px;height:16px;border-radius:50%;background:var(--gx-hebb-warm);box-shadow:0 0 0 1.5px var(--gx-hebb-ink),0 0 0 5px rgba(252,179,0,.3)}',
      '.gx-hebb-sw.is-charge{width:16px;height:16px;border-radius:50%;background:var(--gx-hebb-bg2);box-shadow:0 0 0 1.5px var(--gx-hebb-ink2),0 0 0 4px var(--gx-hebb-accent)}',

      /* Einordnung */
      '.gx-hebb-note{padding:1.4rem 1.4rem 1.2rem;border:1px solid var(--gx-hebb-line);border-radius:var(--gx-hebb-radius);background:var(--gx-hebb-bg2);box-shadow:var(--gx-hebb-shadow)}',
      '.gx-hebb-note-title{margin:0 0 .8rem;font-family:var(--gx-hebb-display);font-weight:600;font-size:1.35rem;line-height:1.25;color:var(--gx-hebb-ink)}',
      '.gx-hebb-note h5{margin:1.3rem 0 .35rem;font-size:.74rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--gx-hebb-accent)}',
      '.gx-hebb-note p,.gx-hebb-note li{max-width:66ch}',
      '.gx-hebb-note p+p{margin-top:.7rem}',
      '.gx-hebb-note ul{margin:.4rem 0 0;padding-left:1.2rem}',
      '.gx-hebb-note li{margin:.35rem 0}',
      '.gx-hebb-note blockquote{margin:.8rem 0 .2rem;padding:.2rem 0 .2rem 1rem;border-left:3px solid var(--gx-hebb-warm);font-family:var(--gx-hebb-display);font-style:italic;color:var(--gx-hebb-ink);max-width:62ch}',
      '.gx-hebb-note cite{display:block;margin-top:.35rem;font-family:var(--gx-hebb-ui);font-style:normal;font-size:.82rem;color:var(--gx-hebb-ink2)}',
      '.gx-hebb-care{margin-top:1.3rem !important;font-size:.88rem;color:var(--gx-hebb-ink2)}',
      '.gx-hebb-result{padding:.7rem .9rem;border-radius:10px;background:var(--gx-hebb-bg3);color:var(--gx-hebb-ink)}',
      '.gx-hebb-note details{margin-top:1.3rem;border-top:1px solid var(--gx-hebb-line);padding-top:.6rem}',
      '.gx-hebb-note summary{display:flex;align-items:center;min-height:44px;cursor:pointer;font-weight:600;color:var(--gx-hebb-accent)}',
      '.gx-hebb-note summary:focus-visible{outline:3px solid var(--gx-hebb-accent);outline-offset:2px;border-radius:6px}',
      '.gx-hebb-note ol{margin:.3rem 0 0;padding-left:1.3rem;font-size:.85rem;color:var(--gx-hebb-ink2)}',
      '.gx-hebb-note ol li{margin:.4rem 0}',

      '.gx-hebb-sr{position:absolute !important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',

      '@media (max-width:520px){',
      '.gx-hebb-case{padding:7px}',
            '.gx-hebb-note{padding:1.1rem 1rem}',
      '.gx-hebb-label{flex-direction:column;gap:.15rem}',
      '.gx-hebb-prompt{font-size:.8rem}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '.gx-hebb-prompt{animation:none}',
      '.gx-hebb-prompt,.gx-hebb-btn,.gx-hebb-meter-fill{transition:none}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Exponat
   * ------------------------------------------------------------------ */

  function mount(container, ctx) { // eslint-disable-line no-unused-vars
    injectStyles();
    uidCounter++;
    var uid = 'gx-hebb-' + uidCounter;

    var rm = prefersReduced();
    var rmMQ = null, darkMQ = null;
    try { rmMQ = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { rmMQ = null; }
    try { darkMQ = window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { darkMQ = null; }

    /* ---------- DOM ---------- */

    var canvas = el('canvas', { class: 'gx-hebb-canvas', 'aria-hidden': 'true' });
    var prompt = el('div', { class: 'gx-hebb-prompt', 'aria-hidden': 'true' }, el('b', { text: 'Klicke oder tippe' }), ' ein Neuron an');
    var field = el('div', { class: 'gx-hebb-field', role: 'group', 'aria-label': 'Netzwerk aus ' + N + ' Neuronen. Mit Tab ein Neuron wählen, mit Enter oder Leertaste anregen.' }, canvas, prompt);

    var statusEl = el('p', { class: 'gx-hebb-status', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true', text: 'Bereit. Alle Synapsen sind noch schwach (Gewicht 0,15).' });

    var demoBtn = el('button', { type: 'button', class: 'gx-hebb-btn is-primary', text: 'Beispiel zeigen' });
    var resetBtn = el('button', { type: 'button', class: 'gx-hebb-btn', text: 'Zurücksetzen' });

    var vClicks = el('div', { class: 'gx-hebb-tile-v', text: '0' });
    var vLtp = el('div', { class: 'gx-hebb-tile-v', text: '0' });
    var sLtp = el('div', { class: 'gx-hebb-tile-s', text: 'Wie oft eine Synapse gestärkt wurde' });
    var vStrong = el('div', { class: 'gx-hebb-tile-v' }, el('span', { text: '–' }));
    var meterFill = el('span', { class: 'gx-hebb-meter-fill' });
    var meter = el('div', { class: 'gx-hebb-meter', role: 'meter', 'aria-label': 'Gewicht der stärksten Verbindung', 'aria-valuemin': '0', 'aria-valuemax': '1', 'aria-valuenow': '0' }, meterFill, el('span', { class: 'gx-hebb-meter-thr', 'aria-hidden': 'true' }));
    var sStrong = el('div', { class: 'gx-hebb-tile-s', text: 'Noch keine Synapse nennenswert gestärkt. Der Strich markiert die Schwelle 0,60.' });

    var resultEl = el('p', { class: 'gx-hebb-result' });

    var root = el('div', { class: 'gx-hebb', id: uid },
      el('header', { class: 'gx-hebb-head' },
        el('p', { class: 'gx-hebb-eyebrow', text: 'Exponat · Hebbsche Regel' }),
        el('h3', { class: 'gx-hebb-title', text: 'Neuronen-Spielwiese' }),
        el('p', { class: 'gx-hebb-intro', text: 'Probier es aus: Klicke oder tippe ein Neuron an – es feuert, und ein Signal läuft über die Verbindungen zu seinen Nachbarn. Regst du zwei benachbarte Neuronen mehrmals kurz nacheinander an, wird ihre Synapse kräftiger. Lässt du sie in Ruhe, verblasst sie langsam wieder.' })
      ),
      el('figure', { class: 'gx-hebb-case' },
        field,
        el('figcaption', { class: 'gx-hebb-label' },
          el('strong', { text: 'Abb. 1' }),
          el('span', { text: 'Ein kleiner Zellverband aus ' + N + ' Neuronen (A–' + LETTERS.charAt(N - 1) + '). Die Linien sind Synapsen; Dicke und Helligkeit zeigen ihr Gewicht zwischen 0 und 1. Stark vereinfachtes Modell.' })
        )
      ),
      el('p', { class: 'gx-hebb-hint', text: 'Bedienung: Maus oder Fingertipp auf ein Neuron. Mit der Tastatur wählst du ein Neuron mit Tab (oder den Pfeiltasten) und regst es mit Enter oder Leertaste an. Tipp: Zwei durch eine Linie verbundene Neuronen im Wechsel – etwa A, B, A, B – stärken ihre Synapse am schnellsten.' }),
      el('div', { class: 'gx-hebb-controls' }, demoBtn, resetBtn),
      statusEl,
      el('div', { class: 'gx-hebb-stats' },
        el('div', { class: 'gx-hebb-tile' }, el('div', { class: 'gx-hebb-tile-k', text: 'Anregungen' }), vClicks, el('div', { class: 'gx-hebb-tile-s', text: 'Von dir (oder dem Beispiel) ausgelöst' })),
        el('div', { class: 'gx-hebb-tile' }, el('div', { class: 'gx-hebb-tile-k', text: 'Verstärkungen' }), vLtp, sLtp),
        el('div', { class: 'gx-hebb-tile is-wide' }, el('div', { class: 'gx-hebb-tile-k', text: 'Stärkste Verbindung' }), vStrong, meter, sStrong)
      ),
      el('ul', { class: 'gx-hebb-legend', 'aria-label': 'Legende' },
        el('li', null, el('span', { class: 'gx-hebb-sw is-thin', 'aria-hidden': 'true' }), 'schwache Synapse'),
        el('li', null, el('span', { class: 'gx-hebb-sw is-thick', 'aria-hidden': 'true' }), 'starke Synapse'),
        el('li', null, el('span', { class: 'gx-hebb-sw is-signal', 'aria-hidden': 'true' }), 'Signal unterwegs'),
        el('li', null, el('span', { class: 'gx-hebb-sw is-fire', 'aria-hidden': 'true' }), 'Neuron feuert'),
        el('li', null, el('span', { class: 'gx-hebb-sw is-charge', 'aria-hidden': 'true' }), 'Ladung (noch unter der Schwelle)')
      ),
      buildNote(resultEl)
    );

    container.appendChild(root);

    /* ---------- Zustand ---------- */

    var g = canvas.getContext ? canvas.getContext('2d') : null;
    var dpr = 1;
    var fieldW = 0, fieldH = 0;
    var nodes = [], edges = [], pulses = [];
    var clicks = 0, ltpCount = 0, peak = W_START;
    var hover = -1, focusIdx = -1;
    var raf = 0, tickTimer = 0, sayTimer = 0, sayQ = [];
    var lastTick = nowMs();
    var demo = null;
    var destroyed = false;
    var cols = null;
    var lastStatsSig = '';
    var resizeObs = null, mutObs = null;
    var cleanups = [];

    /* ---------- Größe / Layout ---------- */

    function planHeight(w) {
      return w < 520 ? Math.round(Math.max(340, w * 1.12)) : Math.round(Math.min(w * 0.58, 520));
    }

    function measureWidth() {
      var w = field.clientWidth;
      if (!w) w = Math.round(container.getBoundingClientRect().width) - 20;
      return w > 0 ? w : 720;
    }

    var initialW = measureWidth();
    field.style.height = planHeight(initialW) + 'px';
    var net = buildNetwork(initialW / planHeight(initialW));

    var rngDend = mulberry32(99);
    net.pts.forEach(function (p, i) {
      var dend = [];
      var count = 6 + Math.floor(rngDend() * 3);
      for (var k = 0; k < count; k++) {
        dend.push({ a: (k / count) * Math.PI * 2 + rngDend() * 0.7, l: 6 + rngDend() * 6, b: (rngDend() - 0.5) * 0.9 });
      }
      var btn = el('button', {
        type: 'button', class: 'gx-hebb-neuron', 'data-i': String(i),
        'aria-label': 'Neuron ' + LETTERS.charAt(i) + ' anregen'
      });
      nodes.push({ i: i, letter: LETTERS.charAt(i), x: p.x, y: p.y, px: 0, py: 0, btn: btn, dend: dend, last: -1e9, V: 0, Vt: 0 });
    });

    var rngCurve = mulberry32(31);
    net.edges.forEach(function (pair, k) {
      edges.push({
        k: k, a: pair[0], b: pair[1],
        curv: (rngCurve() < 0.5 ? -1 : 1) * (0.05 + rngCurve() * 0.08),
        len: 0, cx: 0, cy: 0,
        w: W_START, used: -1e9, flash: -1e9, cA: NaN, cB: NaN, strong: false
      });
    });
    nodes.forEach(function (n) { n.edges = []; });
    edges.forEach(function (e) { nodes[e.a].edges.push(e); nodes[e.b].edges.push(e); });
    nodes.forEach(function (n) { field.appendChild(n.btn); });

    function other(e, i) { return e.a === i ? e.b : e.a; }
    function edgeName(e) { return nodes[e.a].letter + '–' + nodes[e.b].letter; }

    function layoutPx() {
      var w = field.clientWidth || fieldW || initialW;
      var h = field.clientHeight || planHeight(w);
      fieldW = w; fieldH = h;
      nodes.forEach(function (n) {
        n.px = PAD + n.x * (w - 2 * PAD);
        n.py = PAD + n.y * (h - 2 * PAD - PAD_BOTTOM);
        n.btn.style.left = n.px + 'px';
        n.btn.style.top = n.py + 'px';
      });
      edges.forEach(function (e) {
        var a = nodes[e.a], b = nodes[e.b];
        var dx = b.px - a.px, dy = b.py - a.py, len = Math.hypot(dx, dy) || 1;
        e.len = len;
        e.cx = (a.px + b.px) / 2 - (dy / len) * e.curv * len;
        e.cy = (a.py + b.py) / 2 + (dx / len) * e.curv * len;
      });
    }

    function resize() {
      if (destroyed) return;
      var w = field.clientWidth || initialW;
      field.style.height = planHeight(w) + 'px';
      dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
      layoutPx();
      canvas.width = Math.max(1, Math.round(fieldW * dpr));
      canvas.height = Math.max(1, Math.round(fieldH * dpr));
      requestFrame();
    }

    /* ---------- Farben aus Tokens ---------- */

    function readColors() {
      var cs = window.getComputedStyle(root);
      function c(name, fb) { return parseColor(cs.getPropertyValue(name), fb); }
      cols = {
        ink: c('--gx-hebb-ink', [27, 34, 48]),
        ink2: c('--gx-hebb-ink2', [92, 101, 119]),
        line: c('--gx-hebb-line', [217, 210, 195]),
        accent: c('--gx-hebb-accent', [5, 116, 158]),
        warm: c('--gx-hebb-warm', [252, 179, 0]),
        bg2: c('--gx-hebb-bg2', [255, 255, 255]),
        bg3: c('--gx-hebb-bg3', [236, 230, 218])
      };
      // heller Hintergrund -> Gewichtsbeschriftungen etc. brauchen kräftigere Konturen
      cols.light = (cols.bg3[0] + cols.bg3[1] + cols.bg3[2]) / 3 > 128;
    }

    /* ---------- Ansagen ---------- */

    function say(msg, important) {
      sayQ.push({ m: msg, hi: !!important });
      if (!sayTimer) sayTimer = setTimeout(flushSay, 450);
    }

    function flushSay() {
      sayTimer = 0;
      if (!sayQ.length) return;
      // Wichtige Meldungen (Verstärkung) haben Vorrang, die Reihenfolge bleibt erhalten.
      var picked = [], slots = 3;
      sayQ.forEach(function (q, i) { if (q.hi && slots > 0) { picked.push(i); slots--; } });
      sayQ.forEach(function (q, i) { if (!q.hi && slots > 0) { picked.push(i); slots--; } });
      picked.sort(function (a, b) { return a - b; });
      var out = picked.map(function (i) { return sayQ[i].m; }).join(' ');
      if (sayQ.length > picked.length) out += ' …';
      sayQ = [];
      statusEl.textContent = out;
    }

    /* ---------- Simulation ---------- */

    function vNow(n, t) { return n.V * Math.exp(-(t - n.Vt) / TAU_V); }

    function fire(i, t, hops, fromEdge, fromIdx) {
      var n = nodes[i];
      n.last = t; n.V = 0; n.Vt = t;
      if (fromIdx !== undefined && fromIdx !== null) {
        say('Neuron ' + n.letter + ' feuert durch das Signal von ' + nodes[fromIdx].letter + '.');
      }

      // Hebb: Partner, die kurz zuvor gefeuert haben -> Synapse stärken
      n.edges.forEach(function (e) {
        var j = other(e, i), pj = nodes[j];
        if (pj.last < -1e8) return;
        if (t - pj.last > HEBB_WINDOW) return;
        var consumedKey = e.a === j ? 'cA' : 'cB';
        if (e[consumedKey] === pj.last) return;
        e[consumedKey] = pj.last;
        var before = e.w;
        e.w = Math.min(1, e.w + ETA * (1 - e.w));
        e.used = t; e.flash = t;
        ltpCount++;
        if (e.w > peak) peak = e.w;
        var msg = 'Verbindung ' + edgeName(e) + ' gestärkt: ' + fmt(before) + ' → ' + fmt(e.w) + '.';
        if (before < THETA && e.w >= THETA && !e.strong) {
          e.strong = true;
          msg += ' Jetzt reicht ein einzelnes Signal, damit das Nachbarneuron selbst feuert.';
        }
        say(msg, true);
      });

      // Signale auf allen Verbindungen (außer zurück auf die Eingangs-Synapse)
      if (hops < MAX_HOPS) {
        n.edges.forEach(function (e) {
          if (e === fromEdge) return;
          e.used = t;
          var dur = rm ? 140 : 260 + e.len * 1.5;
          pulses.push({ e: e, from: i, to: other(e, i), t0: t, dur: dur, hops: hops + 1, w: e.w });
        });
      }
    }

    function arrive(p, t) {
      var n = nodes[p.to];
      p.e.used = Math.max(p.e.used, t);
      if (t - n.last < CD_SIGNAL) return;
      n.V = vNow(n, t) + p.e.w;
      n.Vt = t;
      if (n.V >= THETA) fire(p.to, t, p.hops, p.e, p.from);
    }

    function process(t) {
      var guard = 0;
      while (guard++ < 500) {
        var bi = -1, bt = Infinity;
        for (var k = 0; k < pulses.length; k++) {
          var at = pulses[k].t0 + pulses[k].dur;
          if (at <= t && at < bt) { bt = at; bi = k; }
        }
        if (bi < 0) break;
        var p = pulses.splice(bi, 1)[0];
        arrive(p, bt);
      }
    }

    function userFire(i) {
      var t = nowMs();
      var n = nodes[i];
      if (t - n.last < CD_CLICK) return false;
      process(t);
      clicks++;
      hidePrompt();
      say('Neuron ' + n.letter + ' angeregt.');
      fire(i, t, 0, null, null);
      afterChange();
      return true;
    }

    function hidePrompt() { prompt.classList.add('is-hidden'); }

    function decayStep(t, dt) {
      var changed = false;
      edges.forEach(function (e) {
        if (t - e.used > GRACE && e.w > W_FLOOR + 0.0005) {
          e.w = W_FLOOR + (e.w - W_FLOOR) * Math.exp(-dt / TAU_FADE);
          if (e.w < THETA - 0.08) e.strong = false;
          changed = true;
        }
      });
      return changed;
    }

    function tick() {
      if (destroyed) return;
      var t = nowMs();
      var dt = t - lastTick; lastTick = t;
      process(t);
      var changed = decayStep(t, dt);
      var recent = edges.some(function (e) { return t - e.flash < LABEL_MS + 600; });
      if (changed || recent || pulses.length) { updateStats(); requestFrame(); }
    }

    function busy(t) {
      if (pulses.length) return true;
      for (var i = 0; i < nodes.length; i++) {
        if (t - nodes[i].last < GLOW_MS || vNow(nodes[i], t) > 0.02) return true;
      }
      for (var k = 0; k < edges.length; k++) if (t - edges[k].flash < LABEL_MS + 100) return true;
      return false;
    }

    function requestFrame() {
      if (destroyed || raf) return;
      raf = window.requestAnimationFrame(frame);
    }

    function frame() {
      raf = 0;
      if (destroyed) return;
      var t = nowMs();
      process(t);
      draw(t);
      if (busy(t)) requestFrame();
    }

    function afterChange() {
      updateStats();
      requestFrame();
    }

    /* ---------- Zeichnen ---------- */

    function quadAt(a, c, b, t) {
      var u = 1 - t;
      return { x: u * u * a.px + 2 * u * t * c.x + t * t * b.px, y: u * u * a.py + 2 * u * t * c.y + t * t * b.py };
    }

    function roundRect(x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y);
      g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
      g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
      g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
      g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r);
      g.closePath();
    }

    function draw(t) {
      if (!g || !cols) return;
      var W = fieldW, H = fieldH;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      var active = hover >= 0 ? hover : focusIdx;

      /* Synapsen */
      edges.forEach(function (e) {
        var a = nodes[e.a], b = nodes[e.b];
        var s = clamp((e.w - W_FLOOR) / (1 - W_FLOOR), 0, 1);
        var width = 1.1 + 5.2 * e.w;
        if (e.w > 0.4) {
          var gl = clamp((e.w - 0.4) / 0.6, 0, 1);
          g.beginPath(); g.moveTo(a.px, a.py); g.quadraticCurveTo(e.cx, e.cy, b.px, b.py);
          g.strokeStyle = rgba(cols.warm, 0.12 + 0.3 * gl);
          g.lineWidth = width + 5 + 4 * gl;
          g.stroke();
        }
        var base = mix(cols.ink2, cols.accent, clamp(s * 1.6, 0, 1));
        g.beginPath(); g.moveTo(a.px, a.py); g.quadraticCurveTo(e.cx, e.cy, b.px, b.py);
        g.strokeStyle = rgba(base, 0.55 + 0.45 * s);
        g.lineWidth = width;
        g.stroke();
      });

      /* Signale */
      pulses.forEach(function (p) {
        var a = nodes[p.from], b = nodes[p.to];
        var u = clamp((t - p.t0) / p.dur, 0, 1);
        var c = { x: p.e.cx, y: p.e.cy };
        var from = p.e.a === p.from ? a : b, to = p.e.a === p.from ? b : a;
        var rad = 3.2 + 3.4 * p.w;
        var al = 0.5 + 0.5 * p.w;
        if (!rm) {
          for (var k = 3; k >= 1; k--) {
            var tu = u - k * 0.035;
            if (tu <= 0) continue;
            var q = quadAt(from, c, to, tu);
            g.beginPath(); g.arc(q.x, q.y, rad * (1 - k * 0.2), 0, Math.PI * 2);
            g.fillStyle = rgba(cols.warm, al * (0.35 - k * 0.08));
            g.fill();
          }
        }
        var pos = quadAt(from, c, to, u);
        g.beginPath(); g.arc(pos.x, pos.y, rad, 0, Math.PI * 2);
        g.fillStyle = rgba(cols.warm, al);
        g.fill();
        g.lineWidth = 1;
        g.strokeStyle = rgba(cols.ink, cols.light ? 0.65 : 0.35);
        g.stroke();
      });

      /* Neuronen */
      nodes.forEach(function (n) {
        var age = t - n.last;
        var glow = age < GLOW_MS ? Math.pow(1 - age / GLOW_MS, 1.4) : 0;
        var v = clamp(vNow(n, t) / THETA, 0, 1);

        if (glow > 0.01 && !rm) {
          var gr = R + 8 + 26 * glow;
          var grad = g.createRadialGradient(n.px, n.py, R * 0.6, n.px, n.py, gr);
          grad.addColorStop(0, rgba(cols.warm, 0.55 * glow));
          grad.addColorStop(1, rgba(cols.warm, 0));
          g.fillStyle = grad;
          g.beginPath(); g.arc(n.px, n.py, gr, 0, Math.PI * 2); g.fill();
        }

        /* Dendriten */
        g.strokeStyle = rgba(cols.ink2, 0.55);
        g.lineWidth = 1.2;
        n.dend.forEach(function (d) {
          var x0 = n.px + Math.cos(d.a) * R, y0 = n.py + Math.sin(d.a) * R;
          var x1 = n.px + Math.cos(d.a + d.b * 0.3) * (R + d.l), y1 = n.py + Math.sin(d.a + d.b * 0.3) * (R + d.l);
          var xc = n.px + Math.cos(d.a + d.b * 0.5) * (R + d.l * 0.5), yc = n.py + Math.sin(d.a + d.b * 0.5) * (R + d.l * 0.5);
          g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(xc, yc, x1, y1); g.stroke();
        });

        /* Zellkörper */
        var fill = mix(cols.bg2, cols.warm, rm ? (age < 400 ? 1 : 0) : clamp(glow * 1.15, 0, 1));
        g.beginPath(); g.arc(n.px, n.py, R, 0, Math.PI * 2);
        g.fillStyle = rgba(fill, 1);
        g.fill();
        g.lineWidth = (active === n.i) ? 2.6 : 1.8;
        g.strokeStyle = rgba(active === n.i ? cols.ink : cols.ink2, 1);
        g.stroke();

        /* Ladung (unter der Schwelle) */
        if (v > 0.03) {
          g.beginPath();
          g.arc(n.px, n.py, R + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v);
          g.strokeStyle = rgba(cols.accent, 0.95);
          g.lineWidth = 3;
          g.stroke();
        }

        /* Buchstabe */
        g.fillStyle = rgba(cols.ink, 1);
        g.font = '700 12px ' + FONT_UI;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(n.letter, n.px, n.py + 0.5);
      });

      /* Gewichtsanzeigen */
      g.font = '600 11px ' + FONT_UI;
      edges.forEach(function (e) {
        var incident = active >= 0 && (e.a === active || e.b === active);
        var recent = t - e.flash < LABEL_MS;
        if (!(e.w >= 0.3 || incident || recent)) return;
        var a = nodes[e.a], b = nodes[e.b];
        var m = quadAt(a, { x: e.cx, y: e.cy }, b, 0.5);
        var txt = fmt(e.w);
        var tw = g.measureText(txt).width;
        var bw = tw + 12, bh = 17;
        roundRect(m.x - bw / 2, m.y - bh / 2, bw, bh, 8.5);
        g.fillStyle = rgba(cols.bg2, 0.96);
        g.fill();
        g.lineWidth = 1;
        g.strokeStyle = rgba(e.w >= THETA ? cols.accent : cols.ink2, 0.9);
        g.stroke();
        g.fillStyle = rgba(cols.ink, 1);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(txt, m.x, m.y + 0.5);
      });
    }

    /* ---------- Anzeigen / Auswertung ---------- */

    function strongest() {
      var best = null;
      edges.forEach(function (e) { if (!best || e.w > best.w) best = e; });
      return best;
    }

    function resultText() {
      var s = strongest();
      var times = clicks === 1 ? 'einmal' : clicks + '-mal';
      if (clicks === 0) {
        return 'Noch nichts passiert – tippe oben ein Neuron an. Hier steht dann, was du ausgelöst hast.';
      }
      if (ltpCount === 0) {
        return 'Du hast ' + times + ' ein Neuron angeregt, aber noch keine Synapse gestärkt. Das Signal hat sich zwar über die Verbindungen ausgebreitet, doch mit dem Startgewicht von 0,15 löst es bei den Nachbarn nichts aus – sie sammeln nur kurz Ladung (der blaue Ring) und verlieren sie wieder. Probier es mit zwei Nachbarn, die du kurz nacheinander anregst.';
      }
      var head = 'Du hast ' + times + ' ein Neuron angeregt und dabei ' + (ltpCount === 1 ? 'einmal' : ltpCount + '-mal') + ' eine Synapse gestärkt. ';
      if (s.w >= THETA) {
        return head + 'Die Verbindung ' + edgeName(s) + ' hat jetzt das Gewicht ' + fmt(s.w) + ' – über der Schwelle von 0,60. Ein einzelnes Signal genügt, und das Nachbarneuron feuert von allein. Aus „zwei Neuronen, die oft zusammen aktiv waren“ ist eine kleine Bahn geworden: Das ist die Hebbsche Idee im Kleinen.';
      }
      if (s.w >= STRONG_MIN) {
        return head + 'Die stärkste Verbindung (' + edgeName(s) + ') steht bei ' + fmt(s.w) + ' – noch unter der Schwelle von 0,60, ein einzelnes Signal reicht also noch nicht. Mit weiteren gemeinsamen Anregungen kommst du dorthin.';
      }
      return head + 'Inzwischen ist alles wieder verblasst: Ohne erneute Nutzung kehren die Synapsen zu ihrem schwachen Ruhewert zurück. Im Modell vergeht das Gelernte also, wenn es nicht wiederholt wird.';
    }

    function labelFor(n) {
      var parts = n.edges.map(function (e) { return nodes[other(e, n.i)].letter + ' (' + fmt(e.w) + ')'; });
      return 'Neuron ' + n.letter + ' anregen. Verbindungen zu ' + parts.join(', ') + '.';
    }

    function updateStats() {
      var s = strongest();
      var show = s && s.w >= STRONG_MIN;
      var sig = [clicks, ltpCount, show ? s.k + ':' + s.w.toFixed(2) : 'x', edges.map(function (e) { return e.w.toFixed(2); }).join('|')].join('#');
      if (sig === lastStatsSig) return;
      lastStatsSig = sig;

      vClicks.textContent = String(clicks);
      vLtp.textContent = String(ltpCount);
      if (show) {
        vStrong.textContent = '';
        vStrong.appendChild(document.createTextNode(edgeName(s).replace('–', ' ↔ ')));
        vStrong.appendChild(el('small', { text: 'Gewicht ' + fmt(s.w) }));
        sStrong.textContent = s.w >= THETA
          ? 'Über der Schwelle (Strich bei 0,60): Ein Signal von ' + nodes[s.a].letter + ' oder ' + nodes[s.b].letter + ' löst das andere Neuron nun allein aus.'
          : 'Unter der Schwelle (Strich bei 0,60): Ein einzelnes Signal reicht noch nicht.';
      } else {
        vStrong.textContent = '–';
        sStrong.textContent = 'Noch keine Synapse nennenswert gestärkt. Der Strich markiert die Schwelle 0,60.';
      }
      var wv = show ? s.w : 0;
      meterFill.style.width = (wv * 100).toFixed(1) + '%';
      meterFill.className = 'gx-hebb-meter-fill' + (wv >= THETA ? ' is-strong' : '');
      meter.setAttribute('aria-valuenow', wv.toFixed(2));
      meter.setAttribute('aria-valuetext', show ? edgeName(s) + ': ' + fmt(s.w) : 'keine');
      resultEl.textContent = resultText();

      nodes.forEach(function (n) {
        var lbl = labelFor(n);
        if (n.btn.getAttribute('aria-label') !== lbl) n.btn.setAttribute('aria-label', lbl);
      });
    }

    /* ---------- Beispiel (automatische Paarung) ---------- */

    function stopDemo(silent) {
      if (!demo) return;
      demo.timers.forEach(function (id) { clearTimeout(id); });
      demo = null;
      demoBtn.textContent = 'Beispiel zeigen';
      demoBtn.setAttribute('aria-pressed', 'false');
      if (!silent) say('Beispiel beendet.');
    }

    function startDemo() {
      stopDemo(true);
      var cands = edges.filter(function (e) { return e.w < THETA; });
      if (!cands.length) cands = edges.slice();
      var minW = Math.min.apply(null, cands.map(function (e) { return e.w; }));
      cands = cands.filter(function (e) { return e.w <= minW + 0.001; });
      var e = cands[Math.floor(Math.random() * cands.length)];
      var A = e.a, B = e.b;
      var round = 0;
      demo = { timers: [] };
      demoBtn.textContent = 'Beispiel stoppen';
      demoBtn.setAttribute('aria-pressed', 'true');
      hidePrompt();
      say('Beispiel: ' + nodes[A].letter + ' und ' + nodes[B].letter + ' werden abwechselnd kurz nacheinander angeregt.');

      function later(fn, ms) {
        var d = demo;
        var id = setTimeout(function () { if (demo === d) fn(); }, ms);
        d.timers.push(id);
      }

      function finish() {
        stopDemo(true);
        say('Beispiel zu Ende. Probier es jetzt selbst mit zwei anderen Nachbarn.');
      }

      function step() {
        if (e.w >= THETA || round >= 9) {
          later(function () {
            say('Jetzt wird nur ' + nodes[A].letter + ' angeregt – und ' + nodes[B].letter + ' folgt von allein.');
            userFire(A);
            later(finish, 2600);
          }, 1700);
          return;
        }
        userFire(A);
        later(function () {
          userFire(B);
          round++;
          later(step, 1500);
        }, 650);
      }
      step();
    }

    /* ---------- Zurücksetzen ---------- */

    function reset() {
      stopDemo(true);
      edges.forEach(function (e) {
        e.w = W_START; e.used = -1e9; e.flash = -1e9; e.cA = NaN; e.cB = NaN; e.strong = false;
      });
      nodes.forEach(function (n) { n.last = -1e9; n.V = 0; n.Vt = 0; });
      pulses = [];
      clicks = 0; ltpCount = 0; peak = W_START;
      sayQ = [];
      if (sayTimer) { clearTimeout(sayTimer); sayTimer = 0; }
      statusEl.textContent = 'Zurückgesetzt. Alle Synapsen haben wieder das schwache Startgewicht 0,15.';
      prompt.classList.remove('is-hidden');
      lastStatsSig = '';
      updateStats();
      requestFrame();
    }

    /* ---------- Ereignisse ---------- */

    nodes.forEach(function (n) {
      n.btn.addEventListener('click', function () {
        if (demo) stopDemo(true);
        userFire(n.i);
      });
      n.btn.addEventListener('mouseenter', function () { hover = n.i; requestFrame(); });
      n.btn.addEventListener('mouseleave', function () { hover = -1; requestFrame(); });
      n.btn.addEventListener('focus', function () { focusIdx = n.i; requestFrame(); });
      n.btn.addEventListener('blur', function () { if (focusIdx === n.i) focusIdx = -1; requestFrame(); });
      n.btn.addEventListener('keydown', function (ev) {
        var dirs = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        var d = dirs[ev.key];
        if (!d) return;
        var best = -1, bestScore = Infinity;
        nodes.forEach(function (m) {
          if (m === n) return;
          var dx = m.px - n.px, dy = m.py - n.py, dist = Math.hypot(dx, dy) || 1;
          var dot = (dx * d[0] + dy * d[1]) / dist;
          if (dot < 0.35) return;
          var score = dist * (2 - dot);
          if (score < bestScore) { bestScore = score; best = m.i; }
        });
        if (best >= 0) { ev.preventDefault(); nodes[best].btn.focus(); }
      });
    });

    demoBtn.setAttribute('aria-pressed', 'false');
    demoBtn.addEventListener('click', function () { if (demo) stopDemo(); else startDemo(); });
    resetBtn.addEventListener('click', reset);

    function onReducedChange() { rm = prefersReduced(); requestFrame(); }
    function onThemeChange() { readColors(); requestFrame(); }

    if (rmMQ) {
      if (rmMQ.addEventListener) rmMQ.addEventListener('change', onReducedChange);
      else if (rmMQ.addListener) rmMQ.addListener(onReducedChange);
    }
    if (darkMQ) {
      if (darkMQ.addEventListener) darkMQ.addEventListener('change', onThemeChange);
      else if (darkMQ.addListener) darkMQ.addListener(onThemeChange);
    }
    document.addEventListener('gm:theme', onThemeChange);
    if (window.MutationObserver) {
      mutObs = new MutationObserver(onThemeChange);
      mutObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    }
    if (window.ResizeObserver) {
      resizeObs = new ResizeObserver(function () {
        if (destroyed) return;
        var w = field.clientWidth;
        if (w && (Math.abs(w - fieldW) > 0.5 || field.clientHeight !== fieldH)) resize();
      });
      resizeObs.observe(field);
    } else {
      var onWin = function () { resize(); };
      window.addEventListener('resize', onWin);
      cleanups.push(function () { window.removeEventListener('resize', onWin); });
    }

    /* ---------- Start ---------- */

    readColors();
    resize();
    updateStats();
    tickTimer = setInterval(tick, 500);

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      stopDemo(true);
      if (raf) window.cancelAnimationFrame(raf);
      if (tickTimer) clearInterval(tickTimer);
      if (sayTimer) clearTimeout(sayTimer);
      if (resizeObs) resizeObs.disconnect();
      if (mutObs) mutObs.disconnect();
      if (rmMQ) {
        if (rmMQ.removeEventListener) rmMQ.removeEventListener('change', onReducedChange);
        else if (rmMQ.removeListener) rmMQ.removeListener(onReducedChange);
      }
      if (darkMQ) {
        if (darkMQ.removeEventListener) darkMQ.removeEventListener('change', onThemeChange);
        else if (darkMQ.removeListener) darkMQ.removeListener(onThemeChange);
      }
      document.removeEventListener('gm:theme', onThemeChange);
      cleanups.forEach(function (fn) { fn(); });
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    return destroy;
  }

  /* ------------------------------------------------------------------ *
   * Einordnung („Was du gerade erlebt hast“)
   * ------------------------------------------------------------------ */

  function buildNote(resultEl) {
    var srcList = el('ol', null, SOURCES.map(function (s) { return el('li', { text: s }); }));
    return el('section', { class: 'gx-hebb-note', 'aria-labelledby': 'gx-hebb-note-title-' + (uidCounter) },
      el('h4', { class: 'gx-hebb-note-title', id: 'gx-hebb-note-title-' + uidCounter, text: 'Was du gerade erlebt hast' }),
      resultEl,

      el('h5', { text: 'Die Idee: Hebb 1949' }),
      el('p', { text: 'Der kanadische Psychologe Donald O. Hebb beschrieb 1949 in „The Organization of Behavior“, wie Lernen auf der Ebene von Nervenzellen aussehen könnte. Seine Vermutung, hier sinngemäß ins Deutsche übertragen:' }),
      el('blockquote', null,
        '„Liegt das Axon einer Zelle A nahe genug an einer Zelle B, um sie zu erregen, und ist es wiederholt oder dauerhaft an ihrer Erregung beteiligt, dann setzt in einer oder beiden Zellen ein Wachstumsprozess oder eine Stoffwechselveränderung ein, sodass A als eine der Zellen, die B erregen, wirksamer wird.“',
        el('cite', { text: 'Donald O. Hebb (1949), S. 62 – sinngemäße Übersetzung' })
      ),
      el('p', { text: 'Daraus wurde die griffige Kurzformel „Cells that fire together, wire together“ – Zellen, die zusammen feuern, verdrahten sich. Sie stammt nicht von Hebb selbst, sondern wird meist der Neurobiologin Carla Shatz (1992) zugeschrieben, und sie ist vereinfachend: Hebb ging es nicht um bloße Gleichzeitigkeit. A muss an der Erregung von B beteiligt sein, also zur Ursache beitragen. Aus solchen verstärkten Verbindungen sollten sich „Zellverbände“ (cell assemblies) bilden – Gruppen von Neuronen, die gemeinsam ein Muster, einen Begriff oder eine Erinnerung tragen.' }),

      el('h5', { text: 'Was in echten Synapsen passiert' }),
      el('p', { text: 'Heute heißt das Oberthema synaptische Plastizität: Synapsen verändern ihre Stärke in Abhängigkeit von ihrer Nutzung. Der bekannteste Mechanismus ist die Langzeitpotenzierung (LTP, englisch long-term potentiation). Tim Bliss und Terje Lømo zeigten 1973 am Hippocampus von Kaninchen, dass kurze, starke Reizserien die Antwort einer Synapse über Stunden verstärken können.' }),
      el('p', { text: 'Eine zentrale Rolle spielt der NMDA-Rezeptor: Er öffnet sich nur, wenn der Botenstoff Glutamat andockt und die empfangende Zelle gleichzeitig schon erregt ist (dann entfällt eine Blockade durch Magnesium-Ionen). Er arbeitet damit als „Koinzidenzdetektor“. Strömt Calcium ein, wird die Synapse nach und nach empfindlicher, unter anderem durch zusätzliche AMPA-Rezeptoren. Das Gegenstück, die Langzeitdepression (LTD), schwächt Synapsen wieder.' }),

      el('h5', { text: 'Was dieses Modell vereinfacht' }),
      el('ul', null,
        el('li', { text: 'Zeit: Im Exponat zählen 1,5 Sekunden als „kurz nacheinander“, damit du mit Maus oder Tastatur mitkommst. Echte Synapsen reagieren auf Abstände von wenigen bis einigen Dutzend Millisekunden.' }),
        el('li', { text: 'Reihenfolge: Hier ist sie egal. In Experimenten (Markram et al. 1997; Bi & Poo 1998) stärkt es eine Synapse, wenn die sendende Zelle kurz vor der empfangenden feuert; kommt die Reihenfolge andersherum, schwächt es sie („Spike-Timing-abhängige Plastizität“).' }),
        el('li', { text: 'Gewicht: Eine Zahl zwischen 0 und 1 für eine ganze Verbindung. Ein echtes Neuron hat Tausende Synapsen, erregende und hemmende. Hemmung fehlt im Modell vollständig, ebenso Botenstoffe wie Dopamin oder Acetylcholin, die Plastizität mitsteuern.' }),
        el('li', { text: 'Stabilität: Eine reine Hebb-Regel schaukelt sich auf – was stärker ist, feuert öfter und wird noch stärker. Das Gehirn braucht Gegengewichte, etwa LTD oder die homöostatische Skalierung (Turrigiano et al. 1998). Im Exponat bremst nur die Obergrenze 1.' }),
        el('li', { text: 'Verblassen: Der Zerfall hier ist ein simpler Zeitverlauf. Echtes Vergessen und Festigen (Konsolidierung, auch im Schlaf) sind deutlich vielschichtiger, und nicht jede Form von LTP folgt der Hebb-Regel.' }),
        el('li', { text: 'Größe: Vierzehn Neuronen gegenüber schätzungsweise rund 86 Milliarden im menschlichen Gehirn (Azevedo et al. 2009). Ein Gedächtnis liegt nie in einer einzelnen Synapse, sondern verteilt in großen Netzwerken.' }),
        el('li', { text: 'Reichweite: Das Exponat zeigt ein Denkmodell, keine Messdaten, und es sagt nichts darüber, wie schnell oder wie gut ein Mensch durch Üben lernt. In der KI war die Hebb-Regel eine frühe Inspiration (etwa für Hopfield-Netze, 1982); heutige Deep-Learning-Systeme lernen überwiegend anders.' })
      ),

      el('p', { class: 'gx-hebb-care', text: 'Hinweis: Dieses Exponat ist Bildung, keine Diagnose und keine Therapie. Aus einem Modell mit 14 Zellen lässt sich nichts darüber ableiten, ob oder wie schnell sich bei einem Menschen etwas verändert. Wenn dich etwas belastet, hilft die Telefonseelsorge kostenfrei unter 0800 111 0 111, 0800 111 0 222 oder 116 123.' }),

      el('details', null,
        el('summary', { text: 'Quellen und Lesetipps' }),
        srcList
      )
    );
  }

  /* ------------------------------------------------------------------ *
   * Registrierung
   * ------------------------------------------------------------------ */

  M.exhibits.hebb = {
    title: 'Neuronen-Spielwiese',
    blurb: 'Regt Neuronen an, schick Signale über ihre Verbindungen und sieh zu, wie gemeinsam genutzte Synapsen kräftiger werden – und ungenutzte verblassen.',
    mount: mount
  };
})();

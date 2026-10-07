/* ==========================================================================
   Museum Studio – js/viz.js: Baukasten für Abbildungen und Exponate (MUSEUM.viz)

   Freiwillig. Eine Abbildung bleibt, was sie war: MUSEUM.visuals['<station-id>'] = { alt, caption, mount(holder, ctx) }.
   Der Baukasten spart nur das Programmieren von Null: Regler, Kurven, Tabellen, Balken, Netze und Schrittfolgen
   sind fertig, barrierearm und in allen Skins lesbar (nur Tokens aus dem CSS, Styles in css/exhibits.css, Präfix gx-).
   Kein externer Abruf, keine Abhängigkeiten, klassisches Skript (läuft per file://). Lädt vor den Paket-Abbildungen.

   Kurzbeispiel (eine ganze Abbildung):
     MUSEUM.viz.visual('mahlgrad', { alt: '…', caption: '…', build: function (box) {
       var p = MUSEUM.viz.plot({ xDomain: [0, 10], yDomain: [0, 30], series: [{ name: 'Auszug', f: function (x, p) { return p.k * x; } }],
         controls: [{ key: 'k', label: 'Steilheit', min: 1, max: 5, step: .5, value: 2 }] });
       box.appendChild(p.el);
     } });

   ÜBERSICHT (alle Bausteine liefern ein Objekt mit .el (das Element, das man einhängt) und, wo sinnvoll, set/get/update/destroy)

   Allgemeines
     viz.el(tag, attrs, ...kinder)        HTML-Element. attrs: class, text, style (Objekt), onClick (Funktion), sonst setAttribute. Kinder: Text, Elemente, Listen.
     viz.s(tag, attrs, ...kinder)         dasselbe für SVG-Elemente (line, path, circle, text …).
     viz.svg(w, h, {label, desc})         <svg> mit viewBox 0 0 w h, role="img", <title>, <desc>; svg.setLabel(titel, beschreibung) aktualisiert beides.
     viz.fmt(zahl, stellen)               Zahl im Zahlenformat der Seitensprache (Dezimalkomma). viz.reduced() fragt prefers-reduced-motion ab.
     viz.animate(ms, fn(t 0..1), fertig)  sanfte Animation; bei reduzierter Bewegung springt sie sofort ans Ende. Gibt eine Abbruchfunktion zurück.
     viz.rng(seed)                        deterministischer Zufall (0..1), z. B. für Simulationen, die bei jedem Besuch gleich aussehen sollen.
     viz.visual(id, {alt, caption, build(box, ctx)})   meldet eine Abbildung an und räumt beim Schließen alles auf. viz.exhibit(id, {title, blurb, build}) für Exponate.
     viz.figure(inhalt, caption, alt)     <figure class="gx-figure"> mit Bildunterschrift und Alt-Text (für Exponate oder mehrere Teile in einer Abbildung).
   Bedienelemente
     viz.slider({label, min, max, step, value, unit, ends:['links','rechts'], format, onInput(wert)})   Regler mit sichtbarem Wert. api.get(), api.set(v).
     viz.toggle({label, checked, onChange(an)})                       Schalter (Kontrollkästchen als Schalter).
     viz.choice({label, options:[{value,label}], value, onChange(v)}) Auswahl aus wenigen Möglichkeiten (Radiogruppe, Pfeiltasten).
     viz.button({label, onClick, kind:'primary'|'ghost'})             Schaltfläche.
     viz.readout({label, value, unit, tone})                          Anzeige einer Messgröße; api.set(wert, ton). tone: good | warn | bad | accent.
     viz.legend([{label, cls:1..5, dash:true}])                       Legende; cls entspricht der Serienfarbe gx-c1 … gx-c5 (Farbe plus Linienart, nie Farbe allein).
   Skalen und Achsen (für eigene SVG-Zeichnungen)
     viz.scale(d0, d1, r0, r1)  Funktion Wert → Pixel; .invert(px), .ticks(n). viz.ticks(min, max, n) liefert „schöne“ Teilstriche.
     viz.axis(g, {scale, side:'bottom'|'left', at, ticks, format, label, grid})   zeichnet Achse mit Teilstrichen, Beschriftung und optional Gitter in die SVG-Gruppe g.
   Abbildungs-Bausteine
     viz.matrix({rows, cols, cells, rowTitle, colTitle, pairLabels, selectable, highlight, onSelect(r,c)})   n×m-Tabelle (Auszahlungs-, Wahrheits-, Vergleichstabelle); Zelle = Text oder [a,b]-Paar;
                                api.highlight([{r,c,row,col,tone}]), api.select(r,c), api.setCell(r,c,wert), api.get().
     viz.plot({xDomain, yDomain, xLabel, yLabel, series:[{name,f(x,p),cls,dash,area}], controls:[{key,label,min,max,step,value,unit}],
               marks, readout(p), describe(p), onChange(p)})   Kurve(n) y = f(x) mit reglergesteuerten Parametern, Achsen, markierten Punkten (marks: {points, vlines, hlines, bands}, auch als Funktion von p).
                                api.params, api.set(key, v), api.redraw().
     viz.bars({series:[{name}], groups:[{label, values:[…]}] | items:[{label,value}], max, unit, orientation:'h'|'v', target:{from,to,label}})
                                Balken, vergleichend, animiert (CSS-Übergang); api.set(werte), api.get().
     viz.graph({nodes:[{id,label,x,y}], edges:[{from,to,label,directed}], layout:'circle'|'fixed', onSelect(id)})   Knoten und Kanten, tastaturbedienbar; api.highlight({nodes,edges}), api.select(id).
     viz.stepper({steps:[{title,text}], onStep(i, schritt), labels})   Schritt-für-Schritt-Ablauf mit Vor und Zurück, Punkten und Pfeiltasten; api.go(i), api.index.

   Regeln: Farben nur als Tokens (var(--ink), var(--accent) …); Text in SVG wird in Pixeln gerechnet (die Zeichnung passt sich der Breite an, auch am Handy lesbar);
   Bewegung nur auf Wunsch der Besucher (Regler, Knopf), nie Dauerblinken; alles bedienbar mit der Tastatur.
   ========================================================================== */
(function () {
  'use strict';
  var M = window.MUSEUM = window.MUSEUM || {};
  var NS = 'http://www.w3.org/2000/svg';
  var viz = M.viz = {};
  var uid = 0;
  var scope = null;                      // während viz.visual/exhibit build läuft: Liste der Bausteine zum Aufräumen
  function nextId(p) { return 'gx-' + p + (++uid); }
  function isNode(x) { return x && typeof x === 'object' && x.nodeType; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function track(api) { if (scope && api) scope.push(api); return api; }

  /* ---------------------------------------------------------------- Grundlagen */

  function applyAttrs(n, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.keys(v).forEach(function (p) { n.style.setProperty(p, v[p]); });
      else if (typeof v === 'function' && /^on[A-Z]/.test(k)) n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    });
  }
  function addKids(n, kids) {
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === null || k === undefined || k === false) continue;
      if (Array.isArray(k)) addKids(n, k);
      else if (isNode(k)) n.appendChild(k);
      else n.appendChild(document.createTextNode(String(k)));
    }
  }
  function make(create, tag, attrs) {
    var kids = Array.prototype.slice.call(arguments, 3);
    if (attrs !== null && attrs !== undefined && (typeof attrs === 'string' || typeof attrs === 'number' || isNode(attrs) || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    var n = create(tag);
    applyAttrs(n, attrs);
    addKids(n, kids);
    return n;
  }
  /** HTML-Element: viz.el('div', {class:'x'}, 'Text', kind) */
  viz.el = function (tag, attrs) { return make.apply(null, [function (t) { return document.createElement(t); }].concat(Array.prototype.slice.call(arguments))); };
  /** SVG-Element: viz.s('circle', {cx:5, cy:5, r:3}) */
  viz.s = function (tag, attrs) { return make.apply(null, [function (t) { return document.createElementNS(NS, t); }].concat(Array.prototype.slice.call(arguments))); };
  var el = viz.el, s = viz.s;

  /** SVG-Wurzel mit viewBox, role="img", Titel und Beschreibung. */
  viz.svg = function (w, h, o) {
    o = o || {};
    var id = nextId('svg');
    var svg = s('svg', { 'class': 'gx-svg' + (o['class'] ? ' ' + o['class'] : ''), viewBox: '0 0 ' + w + ' ' + h, role: 'img', 'aria-labelledby': id + 't ' + id + 'd', focusable: 'false' });
    var t = s('title', { id: id + 't' }, o.label || ''), d = s('desc', { id: id + 'd' }, o.desc || '');
    svg.appendChild(t); svg.appendChild(d);
    svg.setLabel = function (title, desc) { if (title !== undefined && title !== null) t.textContent = title; if (desc !== undefined && desc !== null) d.textContent = desc; };
    return svg;
  };

  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  viz.reduced = function () { return !!reduceMQ.matches; };

  var nf = {};
  viz.fmt = function (v, digits) {
    if (typeof v !== 'number' || !isFinite(v)) return String(v);
    var d = digits === undefined ? (Math.abs(v) >= 100 || v % 1 === 0 ? 0 : (Math.abs(v) >= 10 ? 1 : 2)) : digits;
    var lang = document.documentElement.lang || 'de';
    var k = lang + d;
    try { nf[k] = nf[k] || new Intl.NumberFormat(lang, { maximumFractionDigits: d, minimumFractionDigits: 0 }); return nf[k].format(v).replace('-', '−'); }
    catch (e) { return String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d)); }
  };

  /** Sanfte Animation; fn(t) mit t von 0 bis 1. Bei reduzierter Bewegung (oder ms ≤ 0) wird sofort fn(1) aufgerufen. node (optional): Abbruch, wenn es aus der Seite genommen wurde. */
  viz.animate = function (ms, fn, done, node) {
    if (viz.reduced() || !(ms > 0) || !window.requestAnimationFrame) { fn(1); if (done) done(); return function () {}; }
    var t0 = null, stop = false, raf = 0;
    function frame(ts) {
      if (stop) return;
      if (node && !node.isConnected) return;
      if (t0 === null) t0 = ts;
      var t = clamp((ts - t0) / ms, 0, 1), e = 1 - Math.pow(1 - t, 3);
      fn(e);
      if (t < 1) raf = requestAnimationFrame(frame); else if (done) done();
    }
    raf = requestAnimationFrame(frame);
    return function () { stop = true; if (raf) cancelAnimationFrame(raf); };
  };

  /** Deterministischer Zufallsgenerator (mulberry32): var r = viz.rng(42); r() → 0..1 */
  viz.rng = function (seed) {
    var a = (seed === undefined ? 1 : seed) >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  /** Beschriftete Abbildung: viz.figure(inhalt, 'Bildunterschrift', 'Alt-Text') */
  viz.figure = function (content, caption, alt) {
    var f = el('figure', { 'class': 'gx-figure' }, el('div', { 'class': 'gx-figure-stage', role: alt ? 'group' : null, 'aria-label': alt || null }, content), caption ? el('figcaption', null, caption) : null);
    return f;
  };

  /** Registriert eine Abbildung. def.build(box, ctx) baut in box; alle Bausteine, die dabei entstehen, werden beim Schließen aufgeräumt. */
  viz.visual = function (id, def) {
    M.visuals = M.visuals || {};
    M.visuals[id] = {
      alt: def.alt, caption: def.caption,
      mount: function (holder, ctx) { return mountBuilt(holder, ctx, def.build); }
    };
  };
  /** Registriert ein Exponat (Tafel mit Titel und Beschreibung stellt der Kern). */
  viz.exhibit = function (id, def) {
    M.exhibits = M.exhibits || {};
    M.exhibits[id] = { title: def.title, blurb: def.blurb, mount: function (holder, ctx) { return mountBuilt(holder, ctx, def.build); } };
  };
  function mountBuilt(holder, ctx, build) {
    var box = el('div', { 'class': 'gx-root' });
    holder.appendChild(box);
    var mine = [], outer = scope;
    scope = mine;
    try { build(box, ctx || {}); } finally { scope = outer; }
    return function destroy() {
      mine.forEach(function (c) { try { if (c.destroy) c.destroy(); } catch (e) { /* egal */ } });
      if (box.parentNode) box.parentNode.removeChild(box);
    };
  }

  /* ---------------------------------------------------------------- Bedienelemente */

  viz.slider = function (o) {
    var id = nextId('sl');
    var input = el('input', { type: 'range', id: id, min: o.min, max: o.max, step: o.step || 1, value: o.value });
    var out = el('output', { 'class': 'gx-slider-val', 'for': id });
    var api = { el: null, input: input };
    function txt(v) { return (o.format ? o.format(v) : viz.fmt(v, o.digits)) + (o.unit ? ' ' + o.unit : ''); }
    function sync() { var v = +input.value; out.textContent = txt(v); input.setAttribute('aria-valuetext', txt(v)); input.style.setProperty('--gx-fill', ((v - input.min) / ((input.max - input.min) || 1) * 100) + '%'); }
    input.addEventListener('input', function () { sync(); if (o.onInput) o.onInput(+input.value, api); });
    api.get = function () { return +input.value; };
    api.set = function (v, silent) { input.value = v; sync(); if (!silent && o.onInput) o.onInput(+input.value, api); };
    api.el = el('div', { 'class': 'gx-slider' },
      el('label', { 'class': 'gx-slider-label', 'for': id }, o.label || ''), out, input,
      o.ends ? el('div', { 'class': 'gx-slider-ends', 'aria-hidden': 'true' }, el('span', null, o.ends[0]), el('span', null, o.ends[1])) : null);
    sync();
    return track(api);
  };

  viz.toggle = function (o) {
    var id = nextId('tg');
    var input = el('input', { type: 'checkbox', role: 'switch', id: id, checked: o.checked ? true : null });
    var api = { input: input, get: function () { return input.checked; }, set: function (v, silent) { input.checked = !!v; if (!silent && o.onChange) o.onChange(input.checked); } };
    input.addEventListener('change', function () { if (o.onChange) o.onChange(input.checked); });
    api.el = el('label', { 'class': 'gx-toggle', 'for': id }, input, el('span', { 'class': 'gx-toggle-track', 'aria-hidden': 'true' }, el('span', { 'class': 'gx-toggle-knob' })), el('span', { 'class': 'gx-toggle-label' }, o.label || ''));
    return track(api);
  };

  viz.choice = function (o) {
    var name = nextId('ch'), value = o.value !== undefined ? o.value : (o.options[0] && o.options[0].value);
    var api = { get: function () { return value; } };
    var inputs = [];
    var group = el('div', { 'class': 'gx-choice-opts', role: 'radiogroup', 'aria-label': o.label || null });
    o.options.forEach(function (op, i) {
      var id = name + '-' + i;
      var input = el('input', { type: 'radio', name: name, id: id, value: i, checked: op.value === value ? true : null });
      input.addEventListener('change', function () { value = op.value; if (o.onChange) o.onChange(value, op); });
      inputs.push(input);
      group.appendChild(el('span', { 'class': 'gx-choice-opt' }, input, el('label', { 'for': id }, op.label)));
    });
    api.set = function (v, silent) { value = v; o.options.forEach(function (op, i) { inputs[i].checked = op.value === v; }); if (!silent && o.onChange) o.onChange(v); };
    api.el = el('div', { 'class': 'gx-choice' }, o.label ? el('span', { 'class': 'gx-choice-label', 'aria-hidden': 'true' }, o.label) : null, group);
    return track(api);
  };

  viz.button = function (o) {
    var b = el('button', { type: 'button', 'class': 'gx-btn' + (o.kind === 'ghost' ? ' gx-btn-ghost' : ''), disabled: o.disabled ? true : null }, o.label);
    if (o.onClick) b.addEventListener('click', function (e) { o.onClick(e, api); });
    var api = { el: b, setLabel: function (t) { b.textContent = t; }, disable: function (on) { b.disabled = !!on; } };
    return track(api);
  };

  viz.readout = function (o) {
    var v = el('span', { 'class': 'gx-readout-v' }), u = el('span', { 'class': 'gx-readout-u' });
    var root = el('div', { 'class': 'gx-readout', 'aria-live': o.live ? 'polite' : null }, el('span', { 'class': 'gx-readout-l' }, o.label || ''), el('span', { 'class': 'gx-readout-vu' }, v, u));
    var api = { el: root };
    api.set = function (value, tone) {
      v.textContent = typeof value === 'number' ? viz.fmt(value, o.digits) : String(value);
      u.textContent = o.unit ? ' ' + o.unit : '';
      root.className = 'gx-readout' + (tone || o.tone ? ' gx-tone-' + (tone || o.tone) : '');
    };
    api.set(o.value === undefined ? '' : o.value, o.tone);
    return api;
  };

  viz.legend = function (items) {
    return el('ul', { 'class': 'gx-legend' }, items.map(function (it) {
      return el('li', { 'class': 'gx-c' + (it.cls || 1) }, el('span', { 'class': 'gx-sw' + (it.dash ? ' is-dash' : ''), 'aria-hidden': 'true' }), it.label);
    }));
  };

  /* ---------------------------------------------------------------- Skalen und Achsen */

  /** „Schöne“ Teilstriche zwischen min und max (etwa n Stück). */
  viz.ticks = function (min, max, n) {
    n = n || 5;
    var span = max - min; if (!(span > 0)) return [min];
    var raw = span / n, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), norm = raw / mag;
    var step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    var out = [], start = Math.ceil(min / step - 1e-9) * step;
    for (var v = start; v <= max + step * 1e-9; v += step) { var tv = Math.round(v / step) * step; out.push(tv === 0 ? 0 : tv); }
    return out;
  };
  viz.scale = function (d0, d1, r0, r1) {
    var f = function (v) { return r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0); };
    f.invert = function (px) { return d0 + (px - r0) / ((r1 - r0) || 1) * (d1 - d0); };
    f.ticks = function (n) { return viz.ticks(Math.min(d0, d1), Math.max(d0, d1), n); };
    f.domain = [d0, d1]; f.range = [r0, r1];
    return f;
  };
  /** Zeichnet eine Achse in die SVG-Gruppe g. o: scale, side ('bottom'|'left'), at (Pixelposition der Achsenlinie), ticks (Zahl oder Liste), format, label, grid (Länge der Gitterlinien in Pixeln). */
  viz.axis = function (g, o) {
    var sc = o.scale, bottom = o.side !== 'left', at = o.at || 0;
    var ticks = Array.isArray(o.ticks) ? o.ticks : sc.ticks(o.ticks || 5);
    var fmt = o.format || function (v) { return viz.fmt(v); };
    var r0 = sc.range[0], r1 = sc.range[1];
    var ax = s('g', { 'class': 'gx-axis' });
    ax.appendChild(bottom ? s('line', { 'class': 'gx-axis-line', x1: r0, x2: r1, y1: at, y2: at }) : s('line', { 'class': 'gx-axis-line', x1: at, x2: at, y1: r0, y2: r1 }));
    // Beschriftungen ausdünnen, wenn sie sich auf einer waagerechten Achse berühren würden
    var every = 1;
    if (bottom && ticks.length > 1) {
      var widest = 0; ticks.forEach(function (t) { widest = Math.max(widest, String(fmt(t)).length); });
      var gap = Math.abs(sc(ticks[1]) - sc(ticks[0]));
      every = Math.max(1, Math.ceil((widest * 6.8 + 10) / (gap || 1)));
    }
    ticks.forEach(function (t, i) {
      var p = sc(t);
      if (o.grid) ax.appendChild(bottom ? s('line', { 'class': 'gx-grid', x1: p, x2: p, y1: at, y2: at - o.grid }) : s('line', { 'class': 'gx-grid', x1: at, x2: at + o.grid, y1: p, y2: p }));
      ax.appendChild(bottom ? s('line', { 'class': 'gx-tick', x1: p, x2: p, y1: at, y2: at + 4 }) : s('line', { 'class': 'gx-tick', x1: at - 4, x2: at, y1: p, y2: p }));
      if (i % every) return;
      ax.appendChild(bottom ? s('text', { 'class': 'gx-tick-label', x: p, y: at + 17, 'text-anchor': 'middle' }, fmt(t)) : s('text', { 'class': 'gx-tick-label', x: at - 8, y: p + 4, 'text-anchor': 'end' }, fmt(t)));
    });
    if (o.label) {
      var mid = (r0 + r1) / 2, span = Math.abs(r1 - r0), maxChars = Math.floor((span - 8) / 6.9), lab = o.label;
      if (lab.length > maxChars && maxChars > 3) lab = lab.slice(0, maxChars - 1).replace(/\s+\S*$/, '').replace(/[\s,;:(]+$/, '') + ' …';
      ax.appendChild(bottom
        ? s('text', { 'class': 'gx-axis-title', x: mid, y: at + 38, 'text-anchor': 'middle' }, lab)
        : s('text', { 'class': 'gx-axis-title', transform: 'translate(' + (at - (o.labelOffset || 40)) + ' ' + mid + ') rotate(-90)', 'text-anchor': 'middle' }, lab));
    }
    g.appendChild(ax);
    return ax;
  };

  /** Zeichnung, die ihre Pixelbreite aus dem Container nimmt (1 Einheit = 1 Pixel, Text bleibt auch am Handy lesbar). draw(breite, höhe) baut neu. */
  function autosize(stage, o, draw) {
    var last = -1, raf = 0, ro = null, onWin = null;
    function run(force) {
      var w = Math.round(stage.clientWidth) || o.width || 520;
      if (!force && Math.abs(w - last) < 2) return;
      last = w;
      var h = o.height || Math.round(clamp(w * (o.ratio || (w < 480 ? 0.8 : 0.62)), o.minHeight || 200, o.maxHeight || 380));
      draw(w, h);
    }
    function later() { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { raf = 0; run(false); }); }
    if (window.ResizeObserver) { ro = new ResizeObserver(later); ro.observe(stage); }
    else { onWin = later; window.addEventListener('resize', onWin); }
    run(true);
    return {
      redraw: function () { run(true); },
      destroy: function () { if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (onWin) window.removeEventListener('resize', onWin); }
    };
  }

  /* ---------------------------------------------------------------- Matrix */

  viz.matrix = function (o) {
    var R = o.rows.length, C = o.cols.length;
    var cells = o.cells.map(function (r) { return r.slice(); });
    var sel = null, hl = [], btns = [], tds = [], focus = [0, 0];
    var api = { el: null };
    var table = el('table', { 'class': 'gx-mx' });
    if (o.label) table.appendChild(el('caption', { 'class': 'gx-sr' }, o.label));
    var lead = o.rowTitle ? 2 : 1, thead = el('thead');
    if (o.colTitle) thead.appendChild(el('tr', null, el('td', { 'class': 'gx-mx-corner', colspan: lead }), el('th', { 'class': 'gx-mx-title', colspan: C, scope: 'colgroup' }, o.colTitle)));
    var head2 = el('tr', null, el('td', { 'class': 'gx-mx-corner', colspan: lead }));
    o.cols.forEach(function (c) { head2.appendChild(el('th', { 'class': 'gx-mx-colh', scope: 'col' }, c)); });
    thead.appendChild(head2);
    table.appendChild(thead);
    var tbody = el('tbody');
    for (var r = 0; r < R; r++) {
      var tr = el('tr');
      if (o.rowTitle && r === 0) tr.appendChild(el('th', { 'class': 'gx-mx-rowtitle', rowspan: R, scope: 'rowgroup' }, el('span', null, o.rowTitle)));
      tr.appendChild(el('th', { 'class': 'gx-mx-rowh', scope: 'row' }, o.rows[r]));
      btns[r] = []; tds[r] = [];
      for (var c = 0; c < C; c++) {
        var td = el('td', { 'class': 'gx-mx-cell' });
        tds[r][c] = td;
        if (o.selectable) {
          var b = el('button', { type: 'button', 'class': 'gx-mx-btn', tabindex: (r === 0 && c === 0) ? 0 : -1, 'aria-pressed': 'false' });
          (function (r, c, b) {
            b.addEventListener('click', function () { api.select(r, c); });
            b.addEventListener('focus', function () { focus = [r, c]; });
            b.addEventListener('keydown', function (e) {
              var dr = 0, dc = 0;
              if (e.key === 'ArrowRight') dc = 1; else if (e.key === 'ArrowLeft') dc = -1; else if (e.key === 'ArrowDown') dr = 1; else if (e.key === 'ArrowUp') dr = -1; else return;
              var nr = clamp(r + dr, 0, R - 1), nc = clamp(c + dc, 0, C - 1);
              e.preventDefault();
              btns[r][c].tabIndex = -1; btns[nr][nc].tabIndex = 0; btns[nr][nc].focus();
            });
          })(r, c, b);
          btns[r][c] = b; td.appendChild(b);
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    function paint(r, c) {
      var v = cells[r][c], host = o.selectable ? btns[r][c] : tds[r][c];
      host.textContent = '';
      if (Array.isArray(v)) {
        host.appendChild(el('span', { 'class': 'gx-pay gx-pay-1', title: o.pairLabels ? o.pairLabels[0] : null }, String(v[0])));
        host.appendChild(el('span', { 'class': 'gx-pay-sep', 'aria-hidden': 'true' }, '|'));
        host.appendChild(el('span', { 'class': 'gx-pay gx-pay-2', title: o.pairLabels ? o.pairLabels[1] : null }, String(v[1])));
        if (o.pairLabels) host.setAttribute('aria-label', o.rows[r] + ' / ' + o.cols[c] + ': ' + o.pairLabels[0] + ' ' + v[0] + ', ' + o.pairLabels[1] + ' ' + v[1]);
      } else {
        host.appendChild(document.createTextNode(String(v)));
        if (o.selectable) host.setAttribute('aria-label', o.rows[r] + ' / ' + o.cols[c] + ': ' + v);
      }
    }
    function paintAll() { for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) paint(r, c); }
    function applyHl() {
      for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) { tds[r][c].className = 'gx-mx-cell'; var old = tds[r][c].querySelector('.gx-sr-hl'); if (old) old.parentNode.removeChild(old); }
      hl.forEach(function (h) {
        for (var r = 0; r < R; r++) for (var c = 0; c < C; c++) {
          if ((h.r === undefined || h.r === r) && (h.c === undefined || h.c === c) && (h.r !== undefined || h.c !== undefined)) {
            tds[r][c].classList.add('is-hl', 'gx-tone-' + (h.tone || 'accent'));
            if (!tds[r][c].querySelector('.gx-sr-hl')) tds[r][c].appendChild(el('span', { 'class': 'gx-sr gx-sr-hl' }, ' (hervorgehoben)'));
          }
        }
      });
      if (sel) tds[sel[0]][sel[1]].classList.add('is-selected');
    }
    /** highlight([{r, c, row, col, tone}]): r/row = Zeile, c/col = Spalte (nur eines angegeben: ganze Zeile oder Spalte). tone: accent | good | bad | warm. */
    api.highlight = function (list) {
      hl = (list || []).map(function (h) { return { r: h.r !== undefined ? h.r : h.row, c: h.c !== undefined ? h.c : h.col, tone: h.tone }; });
      applyHl();
    };
    api.select = function (r, c, silent) {
      if (sel) { if (btns[sel[0]][sel[1]]) btns[sel[0]][sel[1]].setAttribute('aria-pressed', 'false'); }
      sel = (r === null || r === undefined) ? null : [r, c];
      if (sel && btns[r] && btns[r][c]) { btns[r][c].setAttribute('aria-pressed', 'true'); }
      applyHl();
      if (sel && !silent && o.onSelect) o.onSelect(r, c, cells[r][c]);
    };
    api.setCell = function (r, c, v) { cells[r][c] = v; paint(r, c); };
    api.get = function () { return sel ? { r: sel[0], c: sel[1], value: cells[sel[0]][sel[1]] } : null; };
    paintAll();
    var wrap = el('div', { 'class': 'gx-matrix' }, el('div', { 'class': 'gx-mx-scroll' }, table));
    if (o.pairLabels) wrap.appendChild(el('p', { 'class': 'gx-mx-key' }, el('span', { 'class': 'gx-pay gx-pay-1' }, 'links: ' + o.pairLabels[0]), ' · ', el('span', { 'class': 'gx-pay gx-pay-2' }, 'rechts: ' + o.pairLabels[1])));
    api.el = wrap;
    if (o.highlight) api.highlight(o.highlight);
    return track(api);
  };

  /* ---------------------------------------------------------------- Kurve mit Reglern */

  viz.plot = function (o) {
    var xd = o.xDomain || [0, 10], yd = o.yDomain || [0, 10];
    var params = {}, sliders = [];
    var stage = el('div', { 'class': 'gx-plot-stage' });
    var readouts = o.readout ? el('div', { 'class': 'gx-readouts' }) : null;
    var controls = (o.controls && o.controls.length) ? el('div', { 'class': 'gx-controls' }) : null;
    var api = { params: params, el: null };
    (o.controls || []).forEach(function (c) {
      params[c.key] = c.value;
      var sl = viz.slider({ label: c.label, min: c.min, max: c.max, step: c.step, value: c.value, unit: c.unit, ends: c.ends, format: c.format, digits: c.digits,
        onInput: function (v) { params[c.key] = v; draw(); if (o.onChange) o.onChange(params, api); } });
      sliders.push(sl); controls.appendChild(sl.el);
    });
    var W = 0, H = 0, svgNow = null;
    function marksNow() { var m = typeof o.marks === 'function' ? o.marks(params) : (o.marks || {}); return m || {}; }
    function draw(w, h) {
      if (w) { W = w; H = h; }
      if (!W) return;
      var ml = o.yLabel ? 54 : 42, mr = 16, mt = 14, mb = o.xLabel ? 46 : 28;
      var x = viz.scale(xd[0], xd[1], ml, W - mr), y = viz.scale(yd[0], yd[1], H - mb, mt);
      var svg = viz.svg(W, H, { label: o.label || o.alt || 'Diagramm', desc: o.describe ? o.describe(params) : '', 'class': 'gx-plot-svg' });
      var clipId = nextId('clip');
      var defs = s('defs', null, s('clipPath', { id: clipId }, s('rect', { x: ml, y: mt, width: W - mr - ml, height: H - mb - mt })));
      svg.appendChild(defs);
      var m = marksNow();
      (m.bands || []).forEach(function (b) {
        var x0 = b.x0 === undefined ? xd[0] : b.x0, x1 = b.x1 === undefined ? xd[1] : b.x1, y0 = b.y0 === undefined ? yd[0] : b.y0, y1 = b.y1 === undefined ? yd[1] : b.y1;
        svg.appendChild(s('rect', { 'class': 'gx-band gx-tone-' + (b.tone || 'ok'), x: x(x0), y: y(y1), width: Math.max(0, x(x1) - x(x0)), height: Math.max(0, y(y0) - y(y1)) }));
        if (b.label) svg.appendChild(s('text', { 'class': 'gx-mark-label gx-band-label', x: x(x0) + 6, y: y(y1) + 15 }, b.label));
      });
      viz.axis(svg, { scale: y, side: 'left', at: ml, ticks: o.yTicks || 5, format: o.yFormat, label: o.yLabel, grid: W - mr - ml });
      viz.axis(svg, { scale: x, side: 'bottom', at: H - mb, ticks: o.xTicks || 6, format: o.xFormat, label: o.xLabel });
      var plot = s('g', { 'clip-path': 'url(#' + clipId + ')' });
      (m.vlines || []).forEach(function (v) { plot.appendChild(s('line', { 'class': 'gx-ref', x1: x(v.x), x2: x(v.x), y1: mt, y2: H - mb })); });
      (m.hlines || []).forEach(function (v) { plot.appendChild(s('line', { 'class': 'gx-ref', x1: ml, x2: W - mr, y1: y(v.y), y2: y(v.y) })); });
      (o.series || []).forEach(function (se, i) {
        var from = se.from === undefined ? xd[0] : se.from, to = se.to === undefined ? xd[1] : se.to, N = 240, d = '', pen = false, first = null, last = null;
        for (var k = 0; k <= N; k++) {
          var xv = from + (to - from) * k / N, yv;
          try { yv = se.f(xv, params); } catch (e) { yv = NaN; }
          if (typeof yv !== 'number' || !isFinite(yv)) { pen = false; continue; }
          var px = x(xv), py = y(yv);
          d += (pen ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1); pen = true;
          if (!first) first = [px, py]; last = [px, py];
        }
        var g = s('g', { 'class': 'gx-c' + (se.cls || (i + 1)) });
        if (se.area && first) g.appendChild(s('path', { 'class': 'gx-area', d: d + 'L' + last[0].toFixed(1) + ' ' + y(Math.max(yd[0], 0)).toFixed(1) + 'L' + first[0].toFixed(1) + ' ' + y(Math.max(yd[0], 0)).toFixed(1) + 'Z' }));
        g.appendChild(s('path', { 'class': 'gx-line' + (se.dash ? ' is-dash' : ''), d: d }));
        plot.appendChild(g);
      });
      svg.appendChild(plot);
      (m.vlines || []).forEach(function (v) { if (v.label) svg.appendChild(markText(x(v.x) + 5, mt + 13, v.label, x(v.x) > W - 110)); });
      (m.hlines || []).forEach(function (v) { if (v.label) svg.appendChild(markText(ml + 6, y(v.y) - 6, v.label, false)); });
      (m.points || []).forEach(function (p) {
        var px = x(p.x), py = y(p.y);
        if (px < ml - 1 || px > W - mr + 1 || py < mt - 1 || py > H - mb + 1) return;
        var g = s('g', { 'class': 'gx-c' + (p.cls || 1) + (p.tone ? ' gx-tone-' + p.tone : '') });
        g.appendChild(s('circle', { 'class': 'gx-dot', cx: px, cy: py, r: 5.5 }));
        if (p.label) g.appendChild(markText(px > W - 120 ? px - 9 : px + 9, py > mt + 24 ? py - 9 : py + 17, p.label, px > W - 120));
        svg.appendChild(g);
      });
      function markText(tx, ty, text, end) { return s('text', { 'class': 'gx-mark-label', x: tx, y: ty, 'text-anchor': end ? 'end' : 'start' }, text); }
      stage.textContent = '';
      stage.appendChild(svg); svgNow = svg;
      if (readouts) {
        readouts.textContent = '';
        (o.readout(params) || []).forEach(function (r) { readouts.appendChild(viz.readout({ label: r.label, value: r.value, unit: r.unit, tone: r.tone, digits: r.digits }).el); });
      }
    }
    var fit = autosize(stage, o, function (w, h) { draw(w, h); });
    var showLegend = o.legend === true || (o.legend !== false && (o.series || []).length > 1);
    api.el = el('div', { 'class': 'gx-plot' },
      showLegend ? viz.legend((o.series || []).map(function (se, i) { return { label: se.name, cls: se.cls || (i + 1), dash: se.dash }; })) : null,
      stage, readouts, controls);
    api.set = function (key, v) { sliders.forEach(function (sl, i) { if (o.controls[i].key === key) sl.set(v, true); }); params[key] = v; draw(); if (o.onChange) o.onChange(params, api); };
    api.redraw = function () { draw(); };
    api.destroy = function () { fit.destroy(); };
    return track(api);
  };

  /* ---------------------------------------------------------------- Balken */

  viz.bars = function (o) {
    var series = o.series || [{ name: '' }];
    var groups = o.groups || (o.items || []).map(function (it) { return { label: it.label, values: [it.value], note: it.note }; });
    var vert = o.orientation === 'v', unit = o.unit ? ' ' + o.unit : '';
    var max = o.max;
    if (max === undefined) { max = 0; groups.forEach(function (g) { g.values.forEach(function (v) { max = Math.max(max, v); }); }); max = max || 1; }
    var fills = [], vals = [], labelEls = [], current = groups.map(function (g) { return g.values.slice(); });
    var multi = series.length > 1;
    var root = el('div', { 'class': 'gx-bars' + (vert ? ' is-vert' : ' is-horiz') + (multi ? ' is-multi' : '') });
    if (multi && o.legend !== false) root.appendChild(viz.legend(series.map(function (se, i) { return { label: se.name, cls: se.cls || (i + 1) }; })));
    var list = el('div', { 'class': 'gx-bars-list', role: 'list', 'aria-label': o.label || null });
    groups.forEach(function (g, gi) {
      fills[gi] = []; vals[gi] = [];
      var track_ = el('div', { 'class': 'gx-bars-track' });
      g.values.forEach(function (v, si) {
        var fill = el('div', { 'class': 'gx-bar-fill gx-c' + ((series[si] && series[si].cls) || (si + 1)) });
        var val = el('span', { 'class': 'gx-bar-val' });
        fills[gi][si] = fill; vals[gi][si] = val;
        var rail = el('div', { 'class': 'gx-bar-rail' }, o.target ? el('div', { 'class': 'gx-bars-target', title: o.target.label || null, style: vert
          ? { bottom: (o.target.from / max * 100) + '%', height: ((o.target.to - o.target.from) / max * 100) + '%' }
          : { left: (o.target.from / max * 100) + '%', width: ((o.target.to - o.target.from) / max * 100) + '%' } }) : null, fill);
        track_.appendChild(el('div', { 'class': 'gx-bar' }, rail, val));
      });
      labelEls[gi] = el('div', { 'class': 'gx-bars-label' }, el('span', null, g.label), g.note ? el('small', null, g.note) : null);
      list.appendChild(el('div', { 'class': 'gx-bars-group', role: 'listitem' }, labelEls[gi], track_));
    });
    root.appendChild(list);
    if (o.target && o.target.label) root.appendChild(el('p', { 'class': 'gx-bars-note' }, el('span', { 'class': 'gx-sw gx-sw-band', 'aria-hidden': 'true' }), o.target.label));
    function show(gi, si, v) {
      var pct = clamp(v / max * 100, 0, 100);
      fills[gi][si].style[vert ? 'height' : 'width'] = pct + '%';
      vals[gi][si].textContent = (o.format ? o.format(v) : viz.fmt(v, o.digits)) + unit;
    }
    function paint(vs) { groups.forEach(function (g, gi) { g.values.forEach(function (_, si) { show(gi, si, vs[gi][si]); }); }); }
    // Eintrittsanimation: erst leer zeigen, dann auf den Wert wachsen lassen (CSS-Übergang; bei reduzierter Bewegung greift sofort)
    paint(groups.map(function (g) { return g.values.map(function () { return 0; }); }));
    groups.forEach(function (g, gi) { g.values.forEach(function (v, si) { vals[gi][si].textContent = (o.format ? o.format(v) : viz.fmt(v, o.digits)) + unit; }); });
    var api = { el: root };
    function grow() { groups.forEach(function (g, gi) { g.values.forEach(function (_, si) { fills[gi][si].style[vert ? 'height' : 'width'] = clamp(current[gi][si] / max * 100, 0, 100) + '%'; }); }); }
    /** set([[…],[…]], {max, unit, labels}) (je Gruppe die Werte aller Serien) oder bei einer Serie set([a, b, c]). Optional neue Obergrenze, Einheit und Gruppenbeschriftungen. */
    api.set = function (values, opt) {
      if (opt) {
        if (opt.max) max = opt.max;
        if (opt.unit !== undefined) unit = opt.unit ? '\u202f' + opt.unit : '';
        if (opt.labels) opt.labels.forEach(function (t, gi) { if (labelEls[gi]) labelEls[gi].firstChild.textContent = t; });
      }
      current = groups.map(function (g, gi) { var v = values[gi]; return Array.isArray(v) ? v.slice() : [v]; });
      paint(current);
    };
    api.get = function () { return current.map(function (v) { return v.slice(); }); };
    if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(grow); }); else grow();
    return track(api);
  };

  /* ---------------------------------------------------------------- Netz (Knoten und Kanten) */

  viz.graph = function (o) {
    var nodes = o.nodes || [], edges = o.edges || [], hot = { nodes: {}, edges: {}, any: false }, selected = null;
    var stage = el('div', { 'class': 'gx-graph-stage' });
    var api = { el: stage };
    var uidg = nextId('g');
    var nodeEls = {}, edgeEls = {};
    function ek(a, b) { return a + '>' + b; }
    function draw(W, H) {
      var pad = o.pad || 40, R = o.nodeRadius || 17, pos = {};
      var n = nodes.length;
      nodes.forEach(function (nd, i) {
        if (o.layout === 'fixed' || (o.layout !== 'circle' && nd.x !== undefined)) {
          pos[nd.id] = [nd.x <= 1 ? pad + nd.x * (W - 2 * pad) : nd.x, nd.y <= 1 ? pad + nd.y * (H - 2 * pad) : nd.y];
        } else {
          var a = -Math.PI / 2 + i * 2 * Math.PI / n;
          pos[nd.id] = [W / 2 + Math.cos(a) * (W / 2 - pad), H / 2 + Math.sin(a) * (H / 2 - pad)];
        }
      });
      var svg = viz.svg(W, H, { label: o.label || 'Netz', desc: o.describe ? o.describe() : nodes.map(function (nd) { return nd.label || nd.id; }).join(', '), 'class': 'gx-graph-svg' });
      var defs = s('defs');
      ['', '-hot'].forEach(function (sfx) {
        defs.appendChild(s('marker', { id: uidg + 'a' + sfx, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { 'class': 'gx-arrow' + (sfx ? ' is-hot' : ''), d: 'M0 0L10 5L0 10z' })));
      });
      svg.appendChild(defs);
      var recip = {}; edges.forEach(function (e) { recip[ek(e.from, e.to)] = true; });
      var eg = s('g'), ng = s('g'); edgeEls = {}; nodeEls = {};
      edges.forEach(function (e) {
        var a = pos[e.from], b = pos[e.to]; if (!a || !b) return;
        var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / len, uy = dy / len;
        var directed = e.directed !== undefined ? !!e.directed : o.directed === true;
        var curved = directed && recip[ek(e.to, e.from)] && e.from !== e.to;
        var off = curved ? 14 : 0, nx = -uy * off, ny = ux * off;
        var x1 = a[0] + ux * R, y1 = a[1] + uy * R, x2 = b[0] - ux * (R + (directed ? 3 : 0)), y2 = b[1] - uy * (R + (directed ? 3 : 0));
        var cx = (x1 + x2) / 2 + nx * 2, cy = (y1 + y2) / 2 + ny * 2;
        var d = curved ? 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1) : 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + 'L' + x2.toFixed(1) + ' ' + y2.toFixed(1);
        var key = ek(e.from, e.to), isHot = hot.edges[key] || (!directed && hot.edges[ek(e.to, e.from)]);
        var g = s('g', { 'class': 'gx-edge' + (isHot ? ' is-hot' : '') + (hot.any && !isHot ? ' is-dim' : '') });
        g.appendChild(s('path', { 'class': 'gx-edge-line', d: d, 'marker-end': directed ? 'url(#' + uidg + 'a' + (isHot ? '-hot' : '') + ')' : null }));
        if (e.label !== undefined) g.appendChild(s('text', { 'class': 'gx-mark-label gx-edge-label', x: ((x1 + x2) / 4 + cx / 2).toFixed(1), y: ((y1 + y2) / 4 + cy / 2 - 5).toFixed(1), 'text-anchor': 'middle' }, String(e.label)));
        eg.appendChild(g); edgeEls[key] = g;
      });
      nodes.forEach(function (nd) {
        var p = pos[nd.id], isHot = hot.nodes[nd.id], label = nd.label || nd.id;
        var g = s('g', { 'class': 'gx-node gx-c' + (nd.cls || 1) + (isHot ? ' is-hot' : '') + (hot.any && !isHot ? ' is-dim' : '') + (selected === nd.id ? ' is-selected' : ''),
          transform: 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')', tabindex: o.onSelect || o.selectable ? 0 : null, role: o.onSelect || o.selectable ? 'button' : null,
          'aria-label': label + (isHot ? ' (hervorgehoben)' : ''), 'aria-pressed': (o.onSelect || o.selectable) ? String(selected === nd.id) : null });
        g.appendChild(s('circle', { 'class': 'gx-node-dot', r: R }));
        var short = String(nd.short || (label.length <= 2 ? label : label.charAt(0)));
        g.appendChild(s('text', { 'class': 'gx-node-short', y: 4, 'text-anchor': 'middle' }, short));
        if (label.length > 2 || nd.short) {
          var below = p[1] < H - pad * .9;
          g.appendChild(s('text', { 'class': 'gx-mark-label gx-node-label', y: below ? R + 15 : -R - 7, 'text-anchor': 'middle' }, label));
        }
        if (o.onSelect || o.selectable) {
          var act = function () { api.select(selected === nd.id ? null : nd.id); };
          g.addEventListener('click', act);
          g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
        }
        ng.appendChild(g); nodeEls[nd.id] = g;
      });
      svg.appendChild(eg); svg.appendChild(ng);
      stage.textContent = ''; stage.appendChild(svg);
    }
    var fit = autosize(stage, { ratio: o.ratio || .72, minHeight: o.minHeight || 240, maxHeight: o.maxHeight || 420, height: o.height, width: o.width }, draw);
    /** highlight({nodes:['a'], edges:[['a','b']]}); ohne Argument oder leer: Hervorhebung aufheben. */
    api.highlight = function (spec) {
      hot = { nodes: {}, edges: {}, any: false };
      if (spec) {
        (spec.nodes || []).forEach(function (id) { hot.nodes[id] = true; hot.any = true; });
        (spec.edges || []).forEach(function (p) { hot.edges[ek(p[0], p[1])] = true; hot.any = true; });
      }
      fit.redraw();
    };
    api.select = function (id, silent) {
      var keep = document.activeElement && document.activeElement.closest && document.activeElement.closest('.gx-node');
      selected = id; fit.redraw();
      if (keep && id && nodeEls[id] && stage.contains(nodeEls[id])) nodeEls[id].focus();
      if (!silent && o.onSelect) o.onSelect(id);
    };
    api.destroy = function () { fit.destroy(); };
    return track(api);
  };

  /* ---------------------------------------------------------------- Schrittfolge */

  viz.stepper = function (o) {
    var steps = o.steps || [], i = Math.max(0, Math.min(o.start || 0, steps.length - 1));
    var L = { prev: 'Zurück', next: 'Weiter', again: 'Von vorn', of: 'Schritt {i} von {n}' };
    if (o.labels) Object.keys(o.labels).forEach(function (k) { L[k] = o.labels[k]; });
    var api = { el: null };
    var dots = el('ol', { 'class': 'gx-step-dots' });
    var dotEls = steps.map(function (st, k) {
      var b = el('button', { type: 'button', 'class': 'gx-step-dot', 'aria-label': 'Schritt ' + (k + 1) + (st.title ? ': ' + st.title : '') }, el('span', { 'aria-hidden': 'true' }));
      b.addEventListener('click', function () { api.go(k); });
      dots.appendChild(el('li', null, b));
      return b;
    });
    var title = el('h4', { 'class': 'gx-step-title' }), text = el('p', { 'class': 'gx-step-text' });
    var body = el('div', { 'class': 'gx-step-body', 'aria-live': 'polite', 'aria-atomic': 'true' }, title, text);
    var counter = el('span', { 'class': 'gx-step-count' });
    var prev = el('button', { type: 'button', 'class': 'gx-btn gx-btn-ghost' }, L.prev), next = el('button', { type: 'button', 'class': 'gx-btn' }, L.next);
    prev.addEventListener('click', function () { api.go(i - 1); });
    next.addEventListener('click', function () { api.go(i >= steps.length - 1 ? 0 : i + 1); });
    var root = el('div', { 'class': 'gx-stepper', role: 'group', 'aria-label': o.label || 'Ablauf in Schritten' }, dots, body, el('div', { 'class': 'gx-step-nav' }, prev, counter, next));
    root.addEventListener('keydown', function (e) {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); api.go(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); api.go(i - 1); }
    });
    function render(silent) {
      var st = steps[i] || {};
      title.textContent = st.title || ''; title.hidden = !st.title;
      text.textContent = st.text || '';
      counter.textContent = L.of.replace('{i}', i + 1).replace('{n}', steps.length);
      prev.disabled = i === 0;
      next.textContent = i >= steps.length - 1 ? L.again : L.next;
      dotEls.forEach(function (b, k) { b.classList.toggle('is-done', k < i); b.classList.toggle('is-now', k === i); if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      if (!silent && o.onStep) o.onStep(i, st, api);
    }
    api.go = function (k, silent) { i = clamp(k, 0, steps.length - 1); render(silent); };
    Object.defineProperty(api, 'index', { get: function () { return i; } });
    api.el = root;
    render(false);
    return track(api);
  };
})();

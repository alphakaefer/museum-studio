/* ==========================================================================
   Gehirnmuseum – js/visuals/phrenologie.js
   Abbildung zur Station "Phrenologie": Kopfprofil im Stil der Karten des 19. Jahrhunderts
   (eigene Zeichnung) <-> schematische moderne Funktionsgliederung der Großhirnrinde.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  M.visuals = M.visuals || {};

  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  var CSS = [
    '.gv-ph{--gv-c:var(--jc,var(--j-h-gehirn,var(--accent,#05749E)));font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);color:var(--ink,#1B2230);max-width:560px;margin:0 auto}',
    '.gv-ph *{box-sizing:border-box}',
    '.gv-ph-tabs{display:flex;gap:0;margin:0 auto 10px;border:1px solid var(--line,#D9D2C3);border-radius:999px;background:var(--bg-3,#ECE6DA);padding:3px;width:100%}',
    '.gv-ph-tab{flex:1 1 50%;min-height:44px;border:0;border-radius:999px;background:transparent;color:var(--ink-2,#5C6577);font:inherit;font-size:clamp(.78rem,3.4vw,.9rem);font-weight:600;line-height:1.2;padding:6px 6px;cursor:pointer}',
    '.gv-ph-tab small{display:block;font-weight:500;font-size:.72rem;opacity:.9}',
    '.gv-ph-tab[aria-pressed="true"]{background:var(--bg-2,#fff);color:var(--ink,#1B2230);box-shadow:0 0 0 1.5px var(--gv-c),0 1px 3px rgba(20,25,40,.15)}',
    '.gv-ph-tab:focus-visible,.gv-ph-nav button:focus-visible,.gv-ph-ghost input:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px}',
    '.gv-ph-stage{position:relative}',
    '.gv-ph-svg{display:block;width:100%;height:auto;max-width:460px;margin:0 auto;overflow:visible}',
    '.gv-ph-skull{fill:var(--bg-2,#fff);stroke:var(--ink,#1B2230);stroke-width:1.7;stroke-linejoin:round;stroke-linecap:round}',
    '.gv-ph-fine{fill:none;stroke:var(--ink-2,#5C6577);stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}',
    '.gv-ph-eye{fill:var(--ink,#1B2230)}',
    '.gv-ph-hatch{stroke:var(--line,#D9D2C3);stroke-width:1}',
    '.gv-ph-lay[hidden]{display:none}',
    '.gv-ph-f{cursor:pointer;outline:none}',
    '.gv-ph-f .gv-ph-fc{fill:var(--bg-2,#fff);fill-opacity:.55;stroke:var(--ink,#1B2230);stroke-width:1.2}',
    '.gv-ph-f .gv-ph-fn{font-size:10.5px;font-weight:700;fill:var(--ink,#1B2230);text-anchor:middle;dominant-baseline:central;pointer-events:none}',
    '.gv-ph-f:hover .gv-ph-fc{fill:var(--gv-c);fill-opacity:.28}',
    '.gv-ph-f.gv-on .gv-ph-fc{fill:var(--gv-c);fill-opacity:.9;stroke:var(--ink,#1B2230);stroke-width:1.8}',
    '.gv-ph-f.gv-on .gv-ph-fn{fill:var(--gv-on-ink,#fff)}',
    '.gv-ph-f:focus-visible .gv-ph-ring{opacity:1}',
    '.gv-ph-ring{fill:none;stroke:var(--accent,#05749E);stroke-width:2.6;opacity:0;pointer-events:none}',
    '.gv-ph-brain{fill:var(--bg-3,#ECE6DA);stroke:var(--ink,#1B2230);stroke-width:1.5}',
    '.gv-ph-lobe{fill:var(--gv-c);fill-opacity:.12;stroke:none}',
    '.gv-ph-lobe.gv-l3{fill-opacity:.4}',
    '.gv-ph-lobe.gv-l4{fill-opacity:.19}',
    '.gv-ph-lobe.gv-l2{fill-opacity:.27}',
    '.gv-ph-r{cursor:pointer;outline:none}',
    '.gv-ph-r:hover .gv-ph-lobe{fill-opacity:.4}',
    '.gv-ph-r.gv-on .gv-ph-lobe{fill-opacity:.55}',
    '.gv-ph-strip{fill:var(--warm,#FCB300);fill-opacity:.55;stroke:var(--ink,#1B2230);stroke-width:.9}',
    '.gv-ph-r:hover .gv-ph-strip{fill-opacity:.8}',
    '.gv-ph-r.gv-on .gv-ph-strip{fill-opacity:.95;stroke-width:1.8}',
    '.gv-ph-lang{fill:var(--bg-2,#fff);fill-opacity:.7;stroke:var(--ink,#1B2230);stroke-width:1.3;stroke-dasharray:3 2.2}',
    '.gv-ph-r:hover .gv-ph-lang{fill-opacity:1}',
    '.gv-ph-r.gv-on .gv-ph-lang{fill:var(--gv-c);fill-opacity:.85;stroke-width:2;stroke-dasharray:none}',
    '.gv-ph-r.gv-on .gv-ph-lang+.gv-ph-lt{fill:var(--gv-on-ink,#fff);stroke:none}',
    '.gv-ph-r:focus-visible .gv-ph-ring{opacity:1}',
    '.gv-ph-sulc{fill:none;stroke:var(--ink,#1B2230);stroke-width:1.1;stroke-dasharray:1 3;stroke-linecap:round;opacity:.7;pointer-events:none}',
    '.gv-ph-lt{font-size:10.5px;font-weight:700;fill:var(--ink,#1B2230);text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:var(--bg-3,#ECE6DA);stroke-width:2.4px;stroke-linejoin:round}',
    '.gv-ph-lt.sm{font-size:8.6px}',
    '.gv-ph-ghost-dot{fill:none;stroke:var(--ink-2,#5C6577);stroke-width:1;stroke-dasharray:2 2;opacity:.9;pointer-events:none}',
    '.gv-ph-ghost-n{font-size:7.5px;fill:var(--ink-2,#5C6577);text-anchor:middle;dominant-baseline:central;pointer-events:none}',
    '.gv-ph-ghostg[hidden]{display:none}',
    '.gv-ph-ghost{display:flex;align-items:center;gap:10px;min-height:44px;margin:4px 0 0;font-size:.88rem;color:var(--ink-2,#5C6577);cursor:pointer}',
    '.gv-ph-ghost input{width:22px;height:22px;accent-color:var(--accent,#05749E);flex:none;margin:0}',
    '.gv-ph-ghost[hidden]{display:none}',
    '.gv-ph-ttl{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;fill:var(--ink-2,#5C6577);text-anchor:middle;font-weight:600}',
    '.gv-ph-panel{margin:10px 0 0;border:1px solid var(--line,#D9D2C3);border-left:4px solid var(--gv-c);border-radius:10px;background:var(--bg-2,#fff);padding:10px 14px 12px;min-height:7.6em}',
    '.gv-ph-panel h4{margin:0 0 3px;font-family:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif);font-size:1.08rem;line-height:1.25;font-weight:600;color:var(--ink,#1B2230)}',
    '.gv-ph .gv-ph-panel p{font-family:var(--font-ui,ui-sans-serif,system-ui,sans-serif);margin:0;font-size:.9rem;line-height:1.5;color:var(--ink,#1B2230)}',
    '.gv-ph .gv-ph-panel p+p{margin-top:5px;color:var(--ink-2,#5C6577);font-size:.84rem}',
    '.gv-ph-nav{display:flex;gap:8px;margin-top:8px}',
    '.gv-ph-nav button{flex:1;min-height:44px;border:1px solid var(--line,#D9D2C3);border-radius:8px;background:var(--bg-3,#ECE6DA);color:var(--ink,#1B2230);font:inherit;font-size:.86rem;cursor:pointer}',
    '.gv-ph-nav button:hover{border-color:var(--gv-c)}',
    '.gv-ph .gv-ph-note{font-family:var(--font-ui,ui-sans-serif,system-ui,sans-serif);margin:10px 0 0;font-size:.8rem;line-height:1.45;color:var(--ink-2,#5C6577)}',
    '.gv-ph .gv-ph-say{margin:10px 0 0;padding:11px 14px;border-radius:10px;background:var(--bg-3,#ECE6DA);font-family:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif);font-size:1rem;line-height:1.5;color:var(--ink,#1B2230)}',
    '.gv-ph-say b{font-weight:700;border-bottom:2px solid var(--gv-c)}',
    '.gv-ph-say .gv-bad{border-bottom-style:dashed}',
    '@media (prefers-reduced-motion:no-preference){',
    '.gv-ph-lay.gv-fade{animation:gv-ph-in .45s ease both}',
    '.gv-ph-f .gv-ph-fc,.gv-ph-lobe,.gv-ph-strip,.gv-ph-lang{transition:fill-opacity .15s,fill .15s}',
    '@keyframes gv-ph-in{from{opacity:0}to{opacity:1}}',
    '}',
    ':root{--gv-on-ink:#fff}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gv-ph{--gv-on-ink:#0E1420}}',
    ':root[data-theme="dark"] .gv-ph{--gv-on-ink:#0E1420}'
  ].join('\n');

  function injectStyle() {
    if (document.querySelector('style[data-gv="phrenologie"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gv', 'phrenologie');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------- Daten ---------------- */

  var HEAD = 'M118 152 C116 92 168 44 236 42 C304 42 342 100 336 168 C333 212 312 240 292 258 C290 280 292 300 296 340 L190 340 L188 312 C170 312 140 308 128 298 C118 292 114 284 114 276 L108 268 L112 262 L106 254 L104 244 L90 232 C96 222 104 205 111 190 L112 172 C114 164 116 158 118 152 Z';
  var BRAIN = 'M134 150 C134 98 176 58 234 58 C292 58 322 108 316 162 C314 192 300 208 280 214 C262 220 240 224 222 222 C200 226 176 224 158 212 C142 200 134 178 134 150 Z';

  /* Eigene Nummerierung der Karte (nicht Galls Originalzählung). */
  var FIELDS = [
    { n: 1, x: 138, y: 153, name: 'Individualität', d: 'Wahrnehmung einzelner Dinge und Gegenstände; im Stil der Karten an der Nasenwurzel eingezeichnet.' },
    { n: 2, x: 165, y: 150, name: 'Farbensinn', d: 'Gespür für Farben und ihre Abstufungen; die Karten legten das Feld über die Augenbraue.' },
    { n: 3, x: 192, y: 153, name: 'Zahlensinn', d: 'Begabung fürs Rechnen und für Zahlenverhältnisse; am äußeren Rand der Augenbraue eingezeichnet.' },
    { n: 4, x: 151, y: 126, name: 'Ortssinn', d: 'Orientierung im Raum und Gedächtnis für Orte, etwa für Reisen und Landkarten.' },
    { n: 5, x: 160, y: 197, name: 'Sprachsinn', d: 'Wortgedächtnis und Redegabe. Gall wollte es bei Mitschülern mit gutem Gedächtnis an vorstehenden Augen erkannt haben, deshalb sitzt das Feld hinter dem Auge.' },
    { n: 6, x: 150, y: 98, name: 'Heiterkeit', d: 'Sinn für Witz und Scherz, fröhliches Gemüt.' },
    { n: 7, x: 182, y: 78, name: 'Wohlwollen', d: 'Güte, Mitgefühl und Hilfsbereitschaft. Eine hohe Stirnwölbung galt als Zeichen eines gütigen Charakters.' },
    { n: 8, x: 219, y: 132, name: 'Konstruktivität', d: 'Geschick beim Bauen, Basteln und Herstellen von Dingen, an der Schläfe verortet.' },
    { n: 9, x: 210, y: 100, name: 'Hoffnung', d: 'Zuversicht und Erwartung, dass es gut ausgeht.' },
    { n: 10, x: 245, y: 72, name: 'Ehrfurcht', d: 'Achtung vor Höherem, Religiosität und Verehrung; am Scheitel eingezeichnet.' },
    { n: 11, x: 278, y: 82, name: 'Festigkeit', d: 'Beharrlichkeit und Standhaftigkeit, am hinteren Scheitel.' },
    { n: 12, x: 306, y: 108, name: 'Selbstachtung', d: 'Selbstwertgefühl und Stolz, am oberen Hinterkopf.' },
    { n: 13, x: 318, y: 146, name: 'Vorsicht', d: 'Umsicht und Sorge vor möglichen Gefahren, seitlich am hinteren Schädeldach.' },
    { n: 14, x: 314, y: 183, name: 'Kinderliebe', d: 'Zuneigung zu Kindern und Nachwuchs; die Karten verlegten sie an den unteren Hinterkopf.' },
    { n: 15, x: 298, y: 213, name: 'Anhänglichkeit', d: 'Freundschaft und Bindung an vertraute Menschen.' },
    { n: 16, x: 270, y: 233, name: 'Kampfeslust', d: 'Mut, Streitlust und Durchsetzungskraft; hinter dem Ohr eingezeichnet.' }
  ];

  var REGIONS = [
    { id: 'front', name: 'Frontallappen', d: 'Planen, Entscheiden, Arbeitsgedächtnis und die Steuerung von Handlungen. Besonders der vordere Teil (Präfrontalkortex) ist an Selbstkontrolle beteiligt.' },
    { id: 'par', name: 'Parietallappen (Scheitellappen)', d: 'Verbindet Körper- und Sinnesinformation mit Raum und Aufmerksamkeit: Wo ist etwas, und wo bin ich in Bezug dazu?' },
    { id: 'temp', name: 'Temporallappen (Schläfenlappen)', d: 'Hören, Sprachverstehen und Gedächtnis; tief darin liegt der Hippocampus, der für neue Erinnerungen wichtig ist.' },
    { id: 'occ', name: 'Okzipitallappen (Hinterhauptslappen)', d: 'Hier liegt die primäre Sehrinde, die erste Verarbeitungsstation für Seheindrücke.' },
    { id: 'motor', name: 'Motorischer Kortex', d: 'Streifen vor der Zentralfurche (Gyrus praecentralis): steuert willkürliche Bewegungen. Die Körperteile sind hier wie auf einer Karte angeordnet, nicht nach Schädelhöckern.' },
    { id: 'soma', name: 'Somatosensorischer Kortex', d: 'Streifen hinter der Zentralfurche (Gyrus postcentralis): verarbeitet Berührung, Druck und Körperempfindung, ebenfalls als Körperkarte.' },
    { id: 'broca', name: 'Broca-Region', d: 'Im unteren Frontallappen, meist links: wichtig für das Sprechen und die Satzbildung. Sie arbeitet nicht allein, sondern im Netzwerk mit anderen Arealen.' },
    { id: 'wern', name: 'Wernicke-Region', d: 'Im hinteren Schläfenlappen, meist links: wichtig für das Verstehen gesprochener Sprache. Auch sie ist Teil eines größeren Sprachnetzwerks.' }
  ];

  var INTRO_PH = 'Tippe auf ein Feld oder wähle es mit der Tastatur. Die Karte zeigt, wo die Phrenologie Anlagen im Schädel vermutete.';
  var INTRO_MOD = 'Tippe auf eine Region. Die Gliederung ist grob: Fast jede Leistung beruht auf Netzwerken, die mehrere Areale verbinden.';

  /* ---------------- DOM-Helfer ---------------- */

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function s(tag, attrs, kids) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function txt(x, y, cls, str) {
    var t = s('text', { x: x, y: y, 'class': cls });
    t.textContent = str;
    return t;
  }

  function mount(container) {
    injectStyle();
    var id = 'gvph' + (++uid);
    var mode = 'ph';
    var sel = null;
    var cleanups = [];

    function on(el, ev, fn) { el.addEventListener(ev, fn); cleanups.push(function () { el.removeEventListener(ev, fn); }); }

    var root = h('div', { 'class': 'gv-ph' });

    /* Umschalter */
    var tabPh = h('button', { type: 'button', 'class': 'gv-ph-tab', 'aria-pressed': 'true' }, ['Damals: Phrenologie-Karte']);
    var tabMod = h('button', { type: 'button', 'class': 'gv-ph-tab', 'aria-pressed': 'false' }, ['Heute: Was die Forschung weiß']);
    var tabs = h('div', { 'class': 'gv-ph-tabs', role: 'group', 'aria-label': 'Ansicht wählen' }, [tabPh, tabMod]);

    /* SVG */
    var svg = s('svg', { 'class': 'gv-ph-svg', viewBox: '66 20 300 322', role: 'group', 'aria-labelledby': id + '-t ' + id + '-d' });
    svg.appendChild(s('title', { id: id + '-t' }, ['Kopf im Profil mit Feldern der Phrenologie und moderner Hirngliederung']));
    svg.appendChild(s('desc', { id: id + '-d' }, ['Seitenansicht eines Kopfes, Gesicht nach links. Ansicht „Damals“: sechzehn nummerierte Felder der Phrenologie auf dem Schädel. Ansicht „Heute“: Großhirnrinde mit Frontal-, Parietal-, Temporal- und Okzipitallappen, motorischem und somatosensorischem Streifen sowie Broca- und Wernicke-Region.']));

    var defs = s('defs');
    var clip = s('clipPath', { id: id + '-clip' }, [s('path', { d: BRAIN })]);
    defs.appendChild(clip);
    svg.appendChild(defs);

    /* Kopf (gemeinsam) */
    var head = s('g', { 'aria-hidden': 'true' });
    head.appendChild(s('path', { 'class': 'gv-ph-skull', d: HEAD }));
    // Hals-Schraffur, Ohr, Auge, Braue
    for (var i = 0; i < 6; i++) {
      head.appendChild(s('line', { 'class': 'gv-ph-hatch', x1: 202 + i * 15, y1: 328, x2: 208 + i * 15, y2: 340 }));
    }
    head.appendChild(s('path', { 'class': 'gv-ph-fine', d: 'M236 190 C228 190 228 210 236 222 C242 230 254 228 256 216 C258 204 254 190 244 190 C240 190 238 194 240 200' }));
    head.appendChild(s('path', { 'class': 'gv-ph-fine', d: 'M125 170 C134 165 148 165 156 170' }));
    head.appendChild(s('path', { 'class': 'gv-ph-fine', d: 'M127 180 C134 176 142 176 148 181 C142 185 134 185 127 180 Z' }));
    head.appendChild(s('circle', { 'class': 'gv-ph-eye', cx: 137, cy: 180.5, r: 2.2 }));
    head.appendChild(s('path', { 'class': 'gv-ph-fine', d: 'M110 253 C118 256 124 256 130 254' }));
    svg.appendChild(head);

    /* Ebene Phrenologie */
    var layPh = s('g', { 'class': 'gv-ph-lay' });
    var fieldEls = [];
    FIELDS.forEach(function (f, idx) {
      var g = s('g', { 'class': 'gv-ph-f', tabindex: '0', role: 'button', 'aria-label': 'Feld ' + f.n + ': ' + f.name, 'data-i': String(idx) });
      g.appendChild(s('circle', { 'class': 'gv-ph-ring', cx: f.x, cy: f.y, r: 17 }));
      g.appendChild(s('circle', { 'class': 'gv-ph-fc', cx: f.x, cy: f.y, r: 12.5 }));
      g.appendChild(txt(f.x, f.y + 0.5, 'gv-ph-fn', String(f.n)));
      layPh.appendChild(g);
      fieldEls.push(g);
    });
    svg.appendChild(layPh);

    /* Ebene Heute */
    var layMod = s('g', { 'class': 'gv-ph-lay', hidden: '' });
    layMod.appendChild(s('path', { 'class': 'gv-ph-brain', d: BRAIN, 'aria-hidden': 'true' }));
    // Kleinhirn und Hirnstamm (nur Andeutung, keine Funktion beschriftet)
    layMod.appendChild(s('path', { 'class': 'gv-ph-brain', d: 'M262 216 C282 214 296 222 292 238 C286 252 264 252 252 244 C246 236 250 222 262 216 Z', 'aria-hidden': 'true' }));
    layMod.appendChild(s('path', { 'class': 'gv-ph-brain', d: 'M222 222 C226 238 230 252 232 266 L250 262 C246 246 244 234 244 224 Z', 'aria-hidden': 'true' }));

    var regEls = {};
    function region(def, build) {
      var g = s('g', { 'class': 'gv-ph-r', tabindex: '0', role: 'button', 'aria-label': def.name, 'data-id': def.id });
      build(g);
      regEls[def.id] = g;
      return g;
    }
    function clipped(kids) { return s('g', { 'clip-path': 'url(#' + id + '-clip)' }, kids); }
    var def = {}; REGIONS.forEach(function (r) { def[r.id] = r; });

    layMod.appendChild(region(def.front, function (g) {
      g.appendChild(clipped([s('path', { 'class': 'gv-ph-lobe', d: 'M100 40 L229 40 L203 176 L150 188 L100 188 Z' })]));
      g.appendChild(txt(165, 108, 'gv-ph-lt', 'Frontal-'));
      g.appendChild(txt(165, 120, 'gv-ph-lt', 'lappen'));
    }));
    layMod.appendChild(region(def.par, function (g) {
      g.appendChild(clipped([s('path', { 'class': 'gv-ph-lobe gv-l2', d: 'M229 40 L275 40 L262 168 L203 176 Z' })]));
      g.appendChild(txt(241, 118, 'gv-ph-lt sm', 'Parietal-'));
      g.appendChild(txt(241, 129, 'gv-ph-lt sm', 'lappen'));
    }));
    layMod.appendChild(region(def.occ, function (g) {
      g.appendChild(clipped([s('path', { 'class': 'gv-ph-lobe gv-l3', d: 'M275 40 L340 40 L340 240 L255 240 L262 168 Z' })]));
      g.appendChild(txt(298, 118, 'gv-ph-lt sm', 'Okzipital-'));
      g.appendChild(txt(298, 129, 'gv-ph-lt sm', 'lappen'));
    }));
    layMod.appendChild(region(def.temp, function (g) {
      g.appendChild(clipped([s('path', { 'class': 'gv-ph-lobe gv-l4', d: 'M100 188 L150 188 L203 176 L262 168 L255 240 L100 240 Z' })]));
      g.appendChild(txt(190, 207, 'gv-ph-lt', 'Temporallappen'));
    }));
    layMod.appendChild(region(def.motor, function (g) {
      g.appendChild(clipped([s('path', { 'class': 'gv-ph-strip', d: 'M212 40 L186 190 L198 190 L224 40 Z' })]));
    }));
    layMod.appendChild(region(def.soma, function (g) {
      g.appendChild(clipped([s('path', { 'class': 'gv-ph-strip', d: 'M224 40 L198 190 L210 190 L236 40 Z', style: 'fill-opacity:.32' })]));
    }));
    layMod.appendChild(region(def.broca, function (g) {
      g.appendChild(s('ellipse', { 'class': 'gv-ph-lang', cx: 160, cy: 165, rx: 17, ry: 11 }));
      g.appendChild(txt(160, 168, 'gv-ph-lt sm', 'Broca'));
    }));
    layMod.appendChild(region(def.wern, function (g) {
      g.appendChild(s('ellipse', { 'class': 'gv-ph-lang', cx: 243, cy: 184, rx: 21, ry: 10 }));
      g.appendChild(txt(243, 187, 'gv-ph-lt sm', 'Wernicke'));
    }));
    // Furchen-Andeutung über den Regionen
    layMod.appendChild(clipped([
      s('path', { 'class': 'gv-ph-sulc', d: 'M150 188 L203 176 L268 168' }),
      s('path', { 'class': 'gv-ph-sulc', d: 'M275 40 L262 168 L255 240' })
    ]));
    // Beschriftung der Streifen außerhalb (Linien mit Text)
    var lblM = s('g', { 'aria-hidden': 'true' });
    lblM.appendChild(s('path', { 'class': 'gv-ph-fine', d: 'M199 42 L186 28 L172 28' }));
    lblM.appendChild(txt(166, 31, 'gv-ph-lt sm', 'motorisch'));
    lblM.lastChild.setAttribute('style', 'text-anchor:end;stroke:none;fill:var(--ink,#1B2230)');
    lblM.appendChild(s('path', { 'class': 'gv-ph-fine', d: 'M232 42 L244 28 L258 28' }));
    lblM.appendChild(txt(263, 31, 'gv-ph-lt sm', 'sensorisch'));
    lblM.lastChild.setAttribute('style', 'text-anchor:start;stroke:none;fill:var(--ink,#1B2230)');
    layMod.appendChild(lblM);

    // Ring für Fokus je Region (nutzt Bounding-Box nach dem Einfügen)
    var ghost = s('g', { 'class': 'gv-ph-ghostg', hidden: '', 'aria-hidden': 'true' });
    FIELDS.forEach(function (f) {
      ghost.appendChild(s('circle', { 'class': 'gv-ph-ghost-dot', cx: f.x, cy: f.y, r: 9 }));
      ghost.appendChild(txt(f.x, f.y + 0.5, 'gv-ph-ghost-n', String(f.n)));
    });
    layMod.appendChild(ghost);
    svg.appendChild(layMod);

    var stage = h('div', { 'class': 'gv-ph-stage' }, [svg]);

    /* Fokusringe für Regionen: Umriss per outline über BBox */
    function addRing(g) {
      try {
        var bb = g.getBBox();
        var r = s('rect', { 'class': 'gv-ph-ring', x: bb.x - 2, y: bb.y - 2, width: bb.width + 4, height: bb.height + 4, rx: 4 });
        g.appendChild(r);
      } catch (e) { /* Layout noch nicht verfügbar */ }
    }

    /* Ghost-Schalter */
    var ghostChk = h('input', { type: 'checkbox', id: id + '-g' });
    var ghostLbl = h('label', { 'class': 'gv-ph-ghost', 'for': id + '-g', hidden: '' }, [ghostChk, 'Alte Phrenologie-Felder zum Vergleich einblenden']);

    /* Detailfeld */
    var pT = h('h4', null, ['']);
    var pD = h('p', null, ['']);
    var pX = h('p', null, ['']);
    var panel = h('div', { 'class': 'gv-ph-panel', 'aria-live': 'polite', 'aria-atomic': 'true' }, [pT, pD, pX]);
    var prev = h('button', { type: 'button' }, ['Vorheriges']);
    var next = h('button', { type: 'button' }, ['Nächstes']);
    var nav = h('div', { 'class': 'gv-ph-nav' }, [prev, next]);

    var note = h('p', { 'class': 'gv-ph-note' }, ['']);
    var say = h('p', { 'class': 'gv-ph-say' }, [
      'Gall hatte eine ', h('b', null, ['richtige Intuition']), ' (Lokalisation von Funktionen), aber eine ',
      h('b', { 'class': 'gv-bad' }, ['falsche Methode']), ' (Schädelform).'
    ]);

    root.appendChild(tabs);
    root.appendChild(stage);
    root.appendChild(ghostLbl);
    root.appendChild(panel);
    root.appendChild(nav);
    root.appendChild(note);
    root.appendChild(say);
    container.appendChild(root);

    /* ---------------- Logik ---------------- */

    function clearSel() {
      fieldEls.forEach(function (e) { e.classList.remove('gv-on'); });
      Object.keys(regEls).forEach(function (k) { regEls[k].classList.remove('gv-on'); });
    }

    function showIntro() {
      pT.textContent = mode === 'ph' ? 'Auswahl der bekanntesten Felder' : 'Moderne Gliederung, schematisch';
      pD.textContent = mode === 'ph' ? INTRO_PH : INTRO_MOD;
      pX.textContent = mode === 'ph'
        ? 'Die Nummern gehören zu dieser Karte, nicht zu einer historischen Originalzählung.'
        : 'Die Lage der Areale ist nur grob angedeutet; die Grenzen sind von Mensch zu Mensch verschieden.';
    }

    function select(key, fromUser) {
      clearSel();
      sel = key;
      if (key === null) { showIntro(); return; }
      if (mode === 'ph') {
        var f = FIELDS[key];
        fieldEls[key].classList.add('gv-on');
        pT.textContent = f.n + ' · ' + f.name;
        pD.textContent = 'Ort, an dem die Phrenologie das Organ für „' + f.name + '“ vermutete. ' + f.d;
        pX.textContent = 'Heute: Ein solches Organ lässt sich weder im Gehirn noch an der Schädelform nachweisen.';
      } else {
        regEls[key].classList.add('gv-on');
        var r = def[key];
        pT.textContent = r.name;
        pD.textContent = r.d;
        pX.textContent = (key === 'broca' || key === 'wern')
          ? 'Sprache ist verteilt: Sie entsteht aus dem Zusammenspiel vieler Areale, nicht aus einem einzelnen „Organ“.'
          : 'Eine Region hat Schwerpunkte, keine alleinige Zuständigkeit: Funktionen sind verteilt und vernetzt.';
      }
    }

    var ORDER_MOD = ['front', 'motor', 'soma', 'par', 'occ', 'temp', 'broca', 'wern'];
    function step(dir) {
      if (mode === 'ph') {
        var i = sel === null ? (dir > 0 ? 0 : FIELDS.length - 1) : (sel + dir + FIELDS.length) % FIELDS.length;
        select(i);
      } else {
        var j = sel === null ? (dir > 0 ? 0 : ORDER_MOD.length - 1) : (ORDER_MOD.indexOf(sel) + dir + ORDER_MOD.length) % ORDER_MOD.length;
        select(ORDER_MOD[j]);
      }
    }
    on(prev, 'click', function () { step(-1); });
    on(next, 'click', function () { step(1); });

    fieldEls.forEach(function (g, i) {
      on(g, 'mouseenter', function () { select(i); });
      on(g, 'focus', function () { select(i); });
      on(g, 'click', function () { select(i); });
      on(g, 'keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); fieldEls[(i + 1) % fieldEls.length].focus(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); fieldEls[(i + fieldEls.length - 1) % fieldEls.length].focus(); }
      });
    });
    Object.keys(regEls).forEach(function (k) {
      var g = regEls[k];
      on(g, 'mouseenter', function () { select(k); });
      on(g, 'focus', function () { select(k); });
      on(g, 'click', function () { select(k); });
      on(g, 'keydown', function (e) {
        var i = ORDER_MOD.indexOf(k);
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(k); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); regEls[ORDER_MOD[(i + 1) % ORDER_MOD.length]].focus(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); regEls[ORDER_MOD[(i + ORDER_MOD.length - 1) % ORDER_MOD.length]].focus(); }
      });
    });

    on(ghostChk, 'change', function () {
      if (ghostChk.checked) ghost.removeAttribute('hidden'); else ghost.setAttribute('hidden', '');
    });

    var ringsDone = false;
    function setMode(m, announce) {
      mode = m;
      var isPh = m === 'ph';
      tabPh.setAttribute('aria-pressed', isPh ? 'true' : 'false');
      tabMod.setAttribute('aria-pressed', isPh ? 'false' : 'true');
      if (isPh) { layPh.removeAttribute('hidden'); layMod.setAttribute('hidden', ''); ghostLbl.setAttribute('hidden', ''); }
      else {
        layMod.removeAttribute('hidden'); layPh.setAttribute('hidden', ''); ghostLbl.removeAttribute('hidden');
        if (!ringsDone) { Object.keys(regEls).forEach(function (k) { addRing(regEls[k]); }); ringsDone = true; }
      }
      var shown = isPh ? layPh : layMod;
      shown.classList.remove('gv-fade'); void shown.getBoundingClientRect(); shown.classList.add('gv-fade');
      prev.textContent = isPh ? 'Vorheriges Feld' : 'Vorherige Region';
      next.textContent = isPh ? 'Nächstes Feld' : 'Nächste Region';
      note.textContent = isPh
        ? 'Schematisch: eigene Zeichnung im Stil der Phrenologie-Karten des 19. Jahrhunderts, Auswahl der bekanntesten Felder (16 von deutlich mehr).'
        : 'Schematisch und eine grobe Näherung: Form und Lage der Areale sind vereinfacht. Gestrichelte Umrisse zeigen Netzwerk-Areale der Sprache.';
      select(null);
      if (announce) { pT.textContent = isPh ? 'Damals: Phrenologie-Karte' : 'Heute: Was die Forschung weiß'; }
    }
    on(tabPh, 'click', function () { if (mode !== 'ph') setMode('ph', true); });
    on(tabMod, 'click', function () { if (mode !== 'mod') setMode('mod', true); });

    setMode('ph', false);

    return function destroy() {
      cleanups.forEach(function (f) { try { f(); } catch (e) { /* egal */ } });
      cleanups = [];
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  M.visuals['phrenologie'] = {
    alt: 'Seitenansicht eines Kopfes mit sechzehn nummerierten Feldern, wie sie Phrenologie-Karten des 19. Jahrhunderts zeigten, umschaltbar auf eine schematische moderne Gliederung der Großhirnrinde in Lappen, Bewegungs- und Berührungsrinde sowie Sprachareale.',
    caption: 'Schematisch. Phrenologie nach Franz Joseph Gall (um 1800) und Johann Spurzheim; eigene Zeichnung, Auswahl der bekanntesten Felder.',
    mount: mount
  };
})();

(function () {
  'use strict';
  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.visuals = M.visuals || {};

  var SID = 'amygdala-furcht';
  var NS = 'http://www.w3.org/2000/svg';

  var CSS = [
    '.gv-ld{--gv-j:var(--jc,var(--j-trauma,var(--accent,#05749E)));font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);color:var(--ink,#1B2230);max-width:100%;min-width:0}',
    '.gv-ld *{box-sizing:border-box}',
    '.gv-ld-ctl{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin:0 0 12px}',
    '.gv-ld-fs{border:0;margin:0;padding:0;min-width:0}',
    '.gv-ld-fs legend{font-size:.86rem;color:var(--ink-2,#5C6577);padding:0;margin:0 0 4px}',
    '.gv-ld-seg{display:inline-flex;border:1.5px solid var(--line,#D9D2C3);border-radius:12px;overflow:hidden;background:var(--bg-2,#fff)}',
    '.gv-ld-seg label{position:relative;display:block;min-height:44px;min-width:92px;margin:0;cursor:pointer}',
    '.gv-ld-seg input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer;width:100%;height:100%}',
    '.gv-ld-seg span{display:flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;font-size:.95rem;color:var(--ink,#1B2230)}',
    '.gv-ld-seg label+label{border-left:1.5px solid var(--line,#D9D2C3)}',
    '.gv-ld-seg input:checked+span{background:var(--gv-j);color:var(--bg-2,#fff);font-weight:600}',
    '.gv-ld-seg input:focus-visible+span{outline:3px solid var(--accent,#05749E);outline-offset:-3px}',
    '.gv-ld-seg input:checked:focus-visible+span{outline-color:var(--warm,#FCB300)}',
    '.gv-ld-btns{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}',
    '.gv-ld-btn{min-height:44px;min-width:44px;padding:0 18px;border-radius:12px;border:1.5px solid var(--gv-j);background:var(--bg-2,#fff);color:var(--ink,#1B2230);font:inherit;font-size:.95rem;font-weight:600;cursor:pointer}',
    '.gv-ld-btn.is-main{background:var(--gv-j);color:var(--bg-2,#fff)}',
    '.gv-ld-btn:hover:not(:disabled){filter:brightness(1.07)}',
    '.gv-ld-btn:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px}',
    '.gv-ld-btn:disabled{opacity:.45;cursor:not-allowed}',
    '.gv-ld-svg{display:block;width:100%;height:auto;max-width:640px;margin:0 auto;overflow:visible}',
    '.gv-ld-svg text{font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);fill:var(--ink,#1B2230)}',
    '.gv-ld-svg .gv-ld-t2{fill:var(--ink-2,#5C6577)}',
    '.gv-ld-brain{fill:var(--bg-3,#ECE6DA);stroke:var(--ink-2,#5C6577);stroke-width:1.6;stroke-linejoin:round}',
    '.gv-ld-sulc{fill:none;stroke:var(--line,#D9D2C3);stroke-width:1.6;stroke-linecap:round}',
    '.gv-ld-box{fill:var(--bg-2,#fff);stroke:var(--ink-2,#5C6577);stroke-width:1.4;transition:stroke .3s}',
    '.gv-ld-box.is-on{stroke:var(--gv-j);stroke-width:2.6}',
    '.gv-ld-glow{fill:var(--gv-j);opacity:0;pointer-events:none}',
    '.gv-ld-ln{fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.gv-ld-low{stroke:var(--gv-j);stroke-width:4.5}',
    '.gv-ld-high{stroke:var(--accent,#05749E);stroke-width:2.6;stroke-dasharray:7 6}',
    '.gv-ld-in{stroke:var(--ink-2,#5C6577);stroke-width:2.6}',
    '.gv-ld-fb{stroke:var(--ok,#2F8F5B);stroke-width:2.6;stroke-dasharray:1 6}',
    '.gv-ld-fb.is-conf{stroke:var(--ink-2,#5C6577)}',
    '.gv-ld-ah-low{fill:var(--gv-j)}',
    '.gv-ld-ah-high{fill:var(--accent,#05749E)}',
    '.gv-ld-ah-in{fill:var(--ink-2,#5C6577)}',
    '.gv-ld-dot-low{fill:var(--warm,#FCB300);stroke:var(--gv-j);stroke-width:2.5}',
    '.gv-ld-dot-high{fill:var(--warm,#FCB300);stroke:var(--accent,#05749E);stroke-width:2.5}',
    '.gv-ld-dot-fb{fill:var(--warm,#FCB300);stroke:var(--ok,#2F8F5B);stroke-width:2.5}',
    '.gv-ld-shadow{fill:none;stroke:var(--ink,#1B2230);stroke-width:5;stroke-linecap:round;opacity:.75}',
    '.gv-ld-log{margin:12px 0 0;padding:12px 14px;border-left:4px solid var(--gv-j);background:var(--bg-3,#ECE6DA);border-radius:0 10px 10px 0;min-height:7.4em;font-size:.95rem;line-height:1.5}',
    '.gv-ld-lp{margin:0 0 .6em;font-family:inherit;font-size:inherit;line-height:inherit;color:inherit}',
    '.gv-ld-lp:last-child{margin-bottom:0}',
    '.gv-ld-log .gv-ld-hint{color:var(--ink-2,#5C6577)}','.gv-ld-log .gv-ld-lp::first-letter{font-size:inherit;float:none;line-height:inherit;font-family:inherit;margin:0;padding:0;color:inherit;font-weight:inherit}',
    '.gv-ld-log b{font-weight:650}',
    '.gv-ld-tl{padding-right:3px;margin:14px 0 0;display:grid;gap:7px;position:relative}',
    '.gv-ld-tlh{display:flex;justify-content:space-between;gap:8px;font-size:.8rem;color:var(--ink-2,#5C6577)}',
    '.gv-ld-row{display:grid;gap:3px}',
    '.gv-ld-rl{display:flex;justify-content:space-between;gap:8px;font-size:.84rem;line-height:1.25}',
    '.gv-ld-rl em{font-style:normal;color:var(--ink-2,#5C6577);opacity:0;transition:opacity .3s;text-align:right}',
    '.gv-ld-rl em.is-on{opacity:1}',
    '.gv-ld-track{position:relative;height:12px;border-radius:6px;background:var(--bg-3,#ECE6DA);overflow:hidden}',
    '.gv-ld-fill{position:absolute;top:0;bottom:0;left:0;width:0;border-radius:6px}',
    '.gv-ld-fill.k-low{background:var(--gv-j)}',
    '.gv-ld-fill.k-high{background:var(--accent,#05749E)}',
    '.gv-ld-fill.k-fb{background:var(--ok,#2F8F5B)}',
    '.gv-ld-fill.k-fb.is-conf{background:var(--ink-2,#5C6577)}',
    '.gv-ld-play{position:absolute;top:22px;bottom:0;width:2px;background:var(--warm,#FCB300);left:0;pointer-events:none;opacity:.9}',
    '.gv-ld-leg{display:flex;flex-wrap:wrap;gap:6px 18px;margin:14px 0 0;padding:0;list-style:none;font-size:.84rem;color:var(--ink-2,#5C6577)}',
    '.gv-ld-leg li{display:flex;align-items:center;gap:8px}',
    '.gv-ld-leg svg{width:38px;height:10px;flex:none;overflow:visible}',
    '.gv-ld-note{font-family:inherit;margin:10px 0 0;font-size:.84rem;line-height:1.5;color:var(--ink-2,#5C6577)}',
    '.gv-ld-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media (max-width:480px){.gv-ld-btns{margin-left:0;width:100%}.gv-ld-btn{flex:1 1 auto}.gv-ld-seg label{min-width:80px}}'
  ].join('\n');

  function injectStyle() {
    if (document.head.querySelector('style[data-gv="' + SID + '"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gv', SID);
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function htmlEl(tag, cls, text, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  /* Zeitachse (qualitativ, nicht maßstäblich) */
  var T_IN = 0.08, T_LOW = 0.30, T_HIGH = 0.80, T_END = 1.0;

  function mount(container) {
    injectStyle();
    var uid = 'gvld' + Math.floor(Math.random() * 1e6);
    var root = htmlEl('div', 'gv-ld');
    container.appendChild(root);

    var choice = 'stock';
    var stage = 0;          /* 0 bereit, 1 läuft, 2 Auswertung fertig, 3 Weiter erklärt */
    var t = 0;
    var raf = 0;
    var running = false;
    var said = {};

    /* ---------- Steuerung ---------- */
    var ctl = htmlEl('div', 'gv-ld-ctl', null, root);
    var fs = htmlEl('fieldset', 'gv-ld-fs', null, ctl);
    htmlEl('legend', null, 'Was der Schatten in Wahrheit ist:', fs);
    var seg = htmlEl('div', 'gv-ld-seg', null, fs);
    var radios = {};
    [['stock', 'Stock'], ['schlange', 'Schlange']].forEach(function (o) {
      var lab = htmlEl('label', null, null, seg);
      var inp = htmlEl('input', null, null, lab);
      inp.type = 'radio'; inp.name = uid + '-wahl'; inp.value = o[0];
      if (o[0] === choice) inp.checked = true;
      htmlEl('span', null, o[1], lab);
      radios[o[0]] = inp;
      inp.addEventListener('change', onChoice);
    });
    var btns = htmlEl('div', 'gv-ld-btns', null, ctl);
    var bSend = htmlEl('button', 'gv-ld-btn is-main', 'Reiz senden', btns);
    bSend.type = 'button';
    var bNext = htmlEl('button', 'gv-ld-btn', 'Weiter', btns);
    bNext.type = 'button';
    bNext.disabled = true;

    /* ---------- SVG ---------- */
    var svg = svgEl('svg', {
      'class': 'gv-ld-svg', viewBox: '0 0 480 360', role: 'img',
      'aria-labelledby': uid + '-t ' + uid + '-d', focusable: 'false'
    }, root);
    var ti = svgEl('title', { id: uid + '-t' }, svg);
    ti.textContent = 'Zwei Wege der Furcht: schneller und langsamer Weg';
    var de = svgEl('desc', { id: uid + '-d' }, svg);
    de.textContent = 'Schema eines Hirn-Seitenumrisses. Vom Sinnesreiz läuft das Signal zum Thalamus. Von dort führt ein schneller, grober Weg direkt zur Amygdala und löst die Körperreaktion aus. Ein langsamerer, genauer Weg führt über den sensorischen Kortex zu präfrontalem Kortex und Hippocampus, die die Amygdala dämpfen können.';

    svgEl('text', { x: 4, y: 14, 'class': 'gv-ld-t2', 'font-size': 12 }, svg).textContent = 'Seitenansicht, schematisch';

    svgEl('path', {
      'class': 'gv-ld-brain',
      d: 'M108,175 C102,115 140,45 220,35 C300,25 390,28 438,75 C475,112 478,180 452,218 C438,240 412,252 384,254 C366,256 352,266 338,276 C318,291 292,296 262,290 C232,284 205,290 175,278 C140,264 112,230 108,175 Z'
    }, svg);
    svgEl('path', { 'class': 'gv-ld-sulc', d: 'M300,38 C318,80 322,110 306,140' }, svg);
    svgEl('path', { 'class': 'gv-ld-sulc', d: 'M118,225 C170,214 230,222 292,262' }, svg);
    svgEl('path', { 'class': 'gv-ld-sulc', d: 'M360,252 C390,215 420,205 462,196' }, svg);

    /* Linien (liegen unter den Kästchen) */
    var pIn = svgEl('path', { 'class': 'gv-ld-ln gv-ld-in', d: 'M92,170 L220,170' }, svg);
    var pLow = svgEl('path', { 'class': 'gv-ld-ln gv-ld-low', d: 'M220,170 L220,312' }, svg);
    var pHigh = svgEl('path', { 'class': 'gv-ld-ln gv-ld-high', d: 'M270,170 L402,170 L402,76 L262,76' }, svg);
    var pFb = svgEl('path', { 'class': 'gv-ld-ln gv-ld-fb', d: 'M200,76 L140,76 L140,243 L166,243' }, svg);

    /* Pfeilspitzen */
    function arrow(cls, pts) { svgEl('polygon', { 'class': cls, points: pts }, svg); }
    arrow('gv-ld-ah-in', '170,170 158,164 158,176');
    arrow('gv-ld-ah-low', '220,225 213,213 227,213');
    arrow('gv-ld-ah-low', '220,310 213,298 227,298');
    arrow('gv-ld-ah-high', '350,170 338,164 338,176');
    arrow('gv-ld-ah-high', '350,76 338,70 338,82');
    var tbar = svgEl('line', { x1: 164, y1: 231, x2: 164, y2: 255, stroke: 'var(--ok,#2F8F5B)', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
    var confArrow = svgEl('polygon', { points: '170,243 158,237 158,249', fill: 'var(--ink-2,#5C6577)', display: 'none' }, svg);

    /* Streckenlabels */
    var lbLow = svgEl('text', { x: 230, y: 214, 'font-size': 13, 'font-weight': 600 }, svg);
    lbLow.textContent = 'schnell, grob';
    var lbHigh = svgEl('text', { x: 392, y: 126, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 600 }, svg);
    lbHigh.textContent = 'langsam, genau';
    var lbFb = svgEl('text', { x: 148, y: 128, 'font-size': 12, 'class': 'gv-ld-t2', 'text-anchor': 'start' }, svg);
    lbFb.textContent = '';
    var lbFb2 = svgEl('text', { x: 148, y: 142, 'font-size': 12, 'class': 'gv-ld-t2' }, svg);

    /* Reiz */
    var stim = svgEl('g', null, svg);
    svgEl('rect', { x: 6, y: 146, width: 86, height: 56, rx: 8, 'class': 'gv-ld-box' }, stim);
    svgEl('path', { 'class': 'gv-ld-shadow', d: 'M16,186 C28,172 38,194 52,178 C64,165 74,178 84,162' }, stim);
    svgEl('text', { x: 49, y: 134, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 600 }, stim).textContent = 'Sinnesreiz';
    var stimLab = svgEl('text', { x: 49, y: 219, 'text-anchor': 'middle', 'font-size': 13, 'class': 'gv-ld-t2' }, stim);
    stimLab.textContent = 'dünner Schatten';

    /* Kästchen */
    function box(id, x, y, w, h, l1, l2, bold) {
      var g = svgEl('g', null, svg);
      var r = svgEl('rect', { x: x, y: y, width: w, height: h, rx: 9, 'class': 'gv-ld-box' }, g);
      var glow = svgEl('rect', { x: x, y: y, width: w, height: h, rx: 9, 'class': 'gv-ld-glow' }, g);
      var cx = x + w / 2;
      if (l2) {
        svgEl('text', { x: cx, y: y + h / 2 - 3, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, g).textContent = l1;
        svgEl('text', { x: cx, y: y + h / 2 + 14, 'text-anchor': 'middle', 'font-size': bold || 13 }, g).textContent = l2;
      } else {
        svgEl('text', { x: cx, y: y + h / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, g).textContent = l1;
      }
      return { rect: r, glow: glow };
    }
    var nThal = box('thal', 170, 150, 100, 40, 'Thalamus');
    var nAmy = box('amy', 170, 225, 100, 38, 'Amygdala');
    var nCor = box('cor', 350, 150, 100, 40, 'Sensorischer', 'Kortex', 13);
    var nEval = box('eval', 180, 52, 170, 48, 'Präfrontaler Kortex', '+ Hippocampus', 13);
    var nBody = box('body', 90, 312, 260, 44, 'Körperreaktion', 'Erstarren · Herzschlag · Stresshormone', 12);

    /* Signalpunkte */
    var dIn = svgEl('circle', { r: 6, 'class': 'gv-ld-dot-low', display: 'none', stroke: 'var(--ink-2,#5C6577)' }, svg);
    var dLow = svgEl('circle', { r: 7, 'class': 'gv-ld-dot-low', display: 'none' }, svg);
    var dHigh = svgEl('circle', { r: 6, 'class': 'gv-ld-dot-high', display: 'none' }, svg);
    var dFb = svgEl('circle', { r: 6, 'class': 'gv-ld-dot-fb', display: 'none' }, svg);

    /* Längen der Pfade */
    function len(p) { try { return p.getTotalLength(); } catch (e) { return 100; } }
    var LEN = { inn: len(pIn), low: len(pLow), high: len(pHigh), fb: len(pFb) };
    function place(dot, path, L, p) {
      if (p <= 0 || p >= 1) { dot.setAttribute('display', 'none'); return; }
      var pt;
      try { pt = path.getPointAtLength(p * L); } catch (e) { dot.setAttribute('display', 'none'); return; }
      dot.setAttribute('cx', pt.x.toFixed(1));
      dot.setAttribute('cy', pt.y.toFixed(1));
      dot.setAttribute('display', 'inline');
    }

    /* ---------- Protokoll ---------- */
    var log = htmlEl('div', 'gv-ld-log', null, root);
    log.setAttribute('role', 'status');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-atomic', 'false');
    function hint() {
      log.textContent = '';
      var p = htmlEl('div', 'gv-ld-lp gv-ld-hint', null);
      p.textContent = 'Am Wegrand liegt ein langer, dünner Schatten. Stock oder Schlange? Wähle oben, was es wirklich ist, und sende den Reiz los. Im Schema siehst du, wo das Signal wann ankommt.';
      log.appendChild(p);
    }
    function say(html) {
      var hp = log.querySelector('.gv-ld-hint');
      if (hp) log.removeChild(hp);
      var p = document.createElement('div');
      p.className = 'gv-ld-lp';
      p.innerHTML = html;
      log.appendChild(p);
    }
    var TXT = {
      s1: '<b>1. Reiz und Thalamus.</b> Das Bild des Schattens erreicht den Thalamus, die Schaltstation der Sinne. Hier teilt sich das Signal.',
      s2: '<b>2. Schneller Weg.</b> Eine grobe Kopie ist schon bei der Amygdala: lang, dünn, womöglich gefährlich. Vorsichtshalber schlägt sie Alarm. Der Körper erstarrt, das Herz schlägt schneller, Stresshormone werden freigesetzt. Du weißt noch nicht, was da liegt.',
      s3stock: '<b>3. Langsamer Weg.</b> Jetzt liegt die genaue Auswertung der Sehrinde vor, abgeglichen mit Erinnerung und Kontext: Es ist ein <b>Stock</b>. Drück „Weiter“.',
      s3schlange: '<b>3. Langsamer Weg.</b> Jetzt liegt die genaue Auswertung der Sehrinde vor, abgeglichen mit Erinnerung und Kontext: Es ist eine <b>Schlange</b>. Drück „Weiter“.',
      s4stock: '<b>4. Entwarnung.</b> Präfrontaler Kortex und Hippocampus melden an die Amygdala zurück: „Nur ein Stock.“ Sie dämpfen den Alarm. Der Körper beruhigt sich, aber nicht schlagartig, denn Stresshormone klingen nur allmählich ab.',
      s4schlange: '<b>4. Keine Entwarnung.</b> Die Rinde bestätigt, was die Amygdala vermutete. Der Alarm war berechtigt, und der schnelle Weg hat Vorsprung zum Ausweichen verschafft. Die Faustregel: Ein falscher Alarm kostet wenig, ein verpasster viel.'
    };

    /* ---------- Zeitleiste ---------- */
    var tl = htmlEl('div', 'gv-ld-tl', null, root);
    tl.setAttribute('aria-hidden', 'true');
    var tlh = htmlEl('div', 'gv-ld-tlh', null, tl);
    htmlEl('span', null, 'Zeitleiste (qualitativ, nicht maßstäblich)', tlh);
    htmlEl('span', null, 'Zeit →', tlh);
    function row(label, cls) {
      var r = htmlEl('div', 'gv-ld-row', null, tl);
      var rl = htmlEl('div', 'gv-ld-rl', null, r);
      htmlEl('span', null, label, rl);
      var em = htmlEl('em', null, '', rl);
      var tr = htmlEl('div', 'gv-ld-track', null, r);
      var f = htmlEl('div', 'gv-ld-fill ' + cls, null, tr);
      return { fill: f, em: em };
    }
    var rLow = row('Schneller Weg bis Amygdala', 'k-low');
    var rHigh = row('Langsamer Weg bis Bewertung', 'k-high');
    var rFb = row('Rückmeldung an Amygdala', 'k-fb');
    var play = htmlEl('div', 'gv-ld-play', null, tl);

    function setFill(r, a, b, now) {
      var w = clamp((now - a) / (b - a), 0, 1) * (b - a);
      r.fill.style.left = (a * 100) + '%';
      r.fill.style.width = (w * 100) + '%';
    }

    /* ---------- Legende ---------- */
    var leg = htmlEl('ul', 'gv-ld-leg', null, root);
    function legItem(inner, text) {
      var li = htmlEl('li', null, null, leg);
      var s = svgEl('svg', { viewBox: '0 0 38 10', 'aria-hidden': 'true', focusable: 'false' });
      s.innerHTML = inner;
      li.appendChild(s);
      htmlEl('span', null, text, li);
    }
    legItem('<line x1="2" y1="5" x2="36" y2="5" stroke="var(--jc,var(--j-trauma,var(--accent,#05749E)))" stroke-width="4.5" stroke-linecap="round"/>', 'schneller, grober Weg');
    legItem('<line x1="2" y1="5" x2="36" y2="5" stroke="var(--accent,#05749E)" stroke-width="2.6" stroke-dasharray="7 6" stroke-linecap="round"/>', 'langsamerer, genauer Weg');
    legItem('<line x1="2" y1="5" x2="36" y2="5" stroke="var(--ok,#2F8F5B)" stroke-width="2.6" stroke-dasharray="1 6" stroke-linecap="round"/>', 'Rückmeldung der Rinde');

    var note = htmlEl('div', 'gv-ld-note', 'Stark vereinfacht: Umriss und Lage der Kästchen sind Schema, keine Anatomie. LeDoux selbst hat sein Modell später differenziert. Die Amygdala ist kein „Angstzentrum“, und ob der schnelle Weg beim Menschen so verläuft, ist umstritten.', root);

    /* ---------- Darstellung ---------- */
    function render() {
      var stock = choice === 'stock';
      /* Punkte */
      place(dIn, pIn, LEN.inn, t / T_IN);
      place(dLow, pLow, LEN.low, (t - T_IN) / (T_LOW - T_IN));
      place(dHigh, pHigh, LEN.high, (t - T_IN) / (T_HIGH - T_IN));
      place(dFb, pFb, LEN.fb, (t - T_HIGH) / (T_END - T_HIGH));
      /* besuchte Knoten */
      nThal.rect.classList.toggle('is-on', t >= T_IN * 0.9);
      nAmy.rect.classList.toggle('is-on', t >= T_IN + (T_LOW - T_IN) * 0.45);
      nBody.rect.classList.toggle('is-on', t >= T_LOW * 0.97);
      nCor.rect.classList.toggle('is-on', t >= T_IN + (T_HIGH - T_IN) * 0.55);
      nEval.rect.classList.toggle('is-on', t >= T_HIGH * 0.99);
      /* Alarm-Intensität */
      var a = smooth(T_LOW - 0.04, T_LOW + 0.02, t);
      if (stock && stage >= 3) a = a * (1 - 0.88 * smooth(T_HIGH + 0.1, T_END, t));
      nAmy.glow.style.opacity = (a * 0.42).toFixed(3);
      nBody.glow.style.opacity = (a * 0.42).toFixed(3);
      /* Zeitleiste */
      setFill(rLow, T_IN, T_LOW, t);
      setFill(rHigh, T_IN, T_HIGH, t);
      setFill(rFb, T_HIGH, T_END, t);
      play.style.left = (t * 100) + '%';
      rLow.em.textContent = 'Alarm schon da';
      rLow.em.classList.toggle('is-on', t >= T_LOW);
      rHigh.em.textContent = 'Bewertung da';
      rHigh.em.classList.toggle('is-on', t >= T_HIGH);
      rFb.em.textContent = stock ? 'dämpft Alarm' : 'bestätigt Alarm';
      rFb.em.classList.toggle('is-on', t >= T_END - 0.001 && stage >= 3);
      /* Reiz-Beschriftung */
      if (t >= T_HIGH) {
        stimLab.textContent = stock ? '= Stock' : '= Schlange';
        stimLab.style.fontWeight = '700';
      } else {
        stimLab.textContent = 'dünner Schatten';
        stimLab.style.fontWeight = '';
      }
      applyChoiceStyle();
    }
    function applyChoiceStyle() {
      var stock = choice === 'stock';
      pFb.classList.toggle('is-conf', !stock);
      rFb.fill.classList.toggle('is-conf', !stock);
      tbar.setAttribute('display', stock ? 'inline' : 'none');
      confArrow.setAttribute('display', stock ? 'none' : 'inline');
      var show = stage >= 3;
      lbFb.textContent = show ? (stock ? 'Rückmeldung:' : 'Rückmeldung:') : '';
      lbFb2.textContent = show ? (stock ? 'dämpft die Amygdala' : 'bestätigt die Amygdala') : '';
      pFb.style.opacity = show ? '1' : '0.28';
      tbar.style.opacity = show ? '1' : '0.28';
      confArrow.style.opacity = show ? '1' : '0.28';
    }

    function reduced() {
      try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    function tween(from, to, dur, onEach, done) {
      cancelAnimationFrame(raf);
      running = true;
      if (dur <= 0) {
        t = to; onEach(); render(); running = false; if (done) done(); return;
      }
      var t0 = performance.now();
      function step(now) {
        var k = clamp((now - t0) / dur, 0, 1);
        t = from + (to - from) * (to - from > 0 ? k : k);
        onEach();
        render();
        if (k < 1) raf = requestAnimationFrame(step);
        else { running = false; raf = 0; if (done) done(); }
      }
      raf = requestAnimationFrame(step);
    }

    function updateButtons() {
      bSend.disabled = running;
      bSend.textContent = stage === 0 ? 'Reiz senden' : (running ? 'Signal läuft …' : 'Noch einmal');
      bNext.disabled = !(stage === 2 && !running);
    }

    function resetAll() {
      cancelAnimationFrame(raf); raf = 0; running = false;
      t = 0; stage = 0; said = {};
      hint();
      render();
      updateButtons();
    }

    function onChoice() {
      choice = radios.schlange.checked ? 'schlange' : 'stock';
      resetAll();
    }

    function send() {
      if (running) return;
      if (stage !== 0) resetAll();
      stage = 1;
      said = {};
      updateButtons();
      var fast = reduced();
      tween(0, T_HIGH, fast ? 0 : 5200, function () {
        if (!said.s1 && t > 0) { said.s1 = 1; say(TXT.s1); }
        if (!said.s2 && t >= T_LOW) { said.s2 = 1; say(TXT.s2); }
        if (!said.s3 && t >= T_HIGH - 0.0005) { said.s3 = 1; say(choice === 'stock' ? TXT.s3stock : TXT.s3schlange); }
      }, function () {
        stage = 2;
        updateButtons();
        try { bNext.focus({ preventScroll: true }); } catch (e) { /* ignorieren */ }
      });
      if (fast && !said.s1) { /* Texte wurden im Callback ergänzt */ }
      updateButtons();
    }

    function next() {
      if (stage !== 2 || running) return;
      stage = 3;
      say(choice === 'stock' ? TXT.s4stock : TXT.s4schlange);
      updateButtons();
      tween(T_HIGH, T_END, reduced() ? 0 : 2200, function () { }, function () {
        updateButtons();
        try { bSend.focus({ preventScroll: true }); } catch (e) { /* ignorieren */ }
      });
    }

    bSend.addEventListener('click', function () {
      if (stage === 0) send(); else { resetAll(); send(); }
    });
    bNext.addEventListener('click', next);

    hint();
    render();
    updateButtons();

    return function destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      running = false;
      try { container.removeChild(root); } catch (e) { /* ignorieren */ }
    };
  }

  M.visuals[SID] = {
    alt: 'Schema der zwei Wege der Furcht nach LeDoux auf einem Hirn-Seitenumriss. Vom Thalamus führt ein schneller, grober Weg direkt zur Amygdala und löst Körperreaktionen aus; ein langsamerer, genauer Weg führt über den sensorischen Kortex zu präfrontalem Kortex und Hippocampus, die Entwarnung geben können. Interaktiv: Du wählst, ob der Schatten ein Stock oder eine Schlange ist, und siehst die Signale laufen.',
    caption: 'Schematisch nach Joseph LeDoux (1990er); vereinfachtes Zweiwege-Modell.',
    mount: mount
  };
})();

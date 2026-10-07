/* Abbildung zur Station "muller-lyer": Müller-Lyer-Figur, schätzen – nachmessen – Winkel verändern */
(function () {
  'use strict';
  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.visuals = M.visuals || {};

  var NS = 'http://www.w3.org/2000/svg';
  var X1 = 80, X2 = 320, LEN = X2 - X1;       /* beide Schäfte: 240 Einheiten */
  var YT = 62, YB = 152;                        /* oben: Pfeilspitzen, unten: Federn */
  var FIN = 44;                                 /* Länge der Flügel */
  var G0 = 22, G1 = 192;                        /* Hilfslinien von/bis (y) */

  var CSS = [
    '.gv-ml-wrap{font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);color:var(--ink,#1B2230);max-width:560px;margin:0 auto;--gv-ml-c:var(--jc,var(--j-verzerrung,#E0573B))}',
    '.gv-ml-svg{display:block;width:100%;height:auto;max-width:100%}',
    '.gv-ml-shaft{stroke:var(--ink,#1B2230);stroke-width:5;stroke-linecap:butt;fill:none}',
    '.gv-ml-fin{stroke:var(--gv-ml-c);stroke-width:5;stroke-linecap:round;fill:none}',
    '.gv-ml-guide{stroke:var(--accent,#05749E);stroke-width:1.6;fill:none;stroke-dasharray:170;stroke-dashoffset:170;opacity:0}',
    '.gv-ml-on .gv-ml-guide{opacity:1;stroke-dashoffset:0;transition:stroke-dashoffset .9s ease-in-out,opacity .2s}',
    '.gv-ml-dim{opacity:0}',
    '.gv-ml-on .gv-ml-dim{opacity:1;transition:opacity .4s ease .9s}',
    '.gv-ml-dimline{stroke:var(--accent,#05749E);stroke-width:1.6;fill:none}',
    '.gv-ml-dimtxt{fill:var(--ink,#1B2230);font:600 16px var(--font-ui,ui-sans-serif,system-ui,sans-serif)}',
    '@media (prefers-reduced-motion:reduce){.gv-ml-on .gv-ml-guide,.gv-ml-on .gv-ml-dim{transition:none}}',
    '.gv-ml-step{margin:14px 0 0;padding:12px 0 0;border-top:1px solid var(--line,#D9D2C3)}',
    '.gv-ml-wrap .gv-ml-q{margin:0 0 8px;font-family:var(--font-ui,ui-sans-serif,system-ui,sans-serif);font-size:.95rem;font-weight:600}',
    '.gv-ml-n{display:inline-block;min-width:1.5em;color:var(--gv-ml-c);font-family:var(--font-display,Georgia,serif);font-weight:700}',
    '.gv-ml-row{display:flex;flex-wrap:wrap;gap:8px}',
    '.gv-ml-btn{min-height:44px;padding:0 16px;font:inherit;font-size:.92rem;color:var(--ink,#1B2230);background:var(--bg-2,#fff);border:1.5px solid var(--line,#D9D2C3);border-radius:10px;cursor:pointer;flex:1 1 auto}',
    '.gv-ml-btn:hover:not([disabled]){border-color:var(--gv-ml-c)}',
    '.gv-ml-btn[aria-checked="true"]{border-color:var(--gv-ml-c);background:var(--bg-3,#ECE6DA);box-shadow:inset 0 0 0 1px var(--gv-ml-c);font-weight:600}',
    '.gv-ml-btn[disabled]{opacity:.55;cursor:not-allowed}',
    '.gv-ml-btn:focus-visible,.gv-ml-range:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px}',
    '.gv-ml-primary{background:var(--ink,#1B2230);color:var(--bg-2,#fff);border-color:var(--ink,#1B2230);flex:0 0 auto}',
    '.gv-ml-primary:hover:not([disabled]){border-color:var(--ink,#1B2230);opacity:.9}',
    '.gv-ml-wrap .gv-ml-note{margin:12px 0 0;font-family:var(--font-ui,ui-sans-serif,system-ui,sans-serif);font-size:.9rem;line-height:1.5;color:var(--ink-2,#5C6577)}',
    '.gv-ml-note strong{color:var(--ink,#1B2230)}',
    '.gv-ml-wrap .gv-ml-punch{font-family:var(--font-display,Georgia,serif);font-size:1.05rem;font-style:italic;color:var(--ink,#1B2230)}',
    '.gv-ml-slider{display:flex;align-items:center;gap:12px;min-height:44px}',
    '.gv-ml-slider label{font-size:.92rem;white-space:nowrap}',
    '.gv-ml-range{flex:1 1 auto;min-width:0;height:44px;accent-color:var(--gv-ml-c);cursor:pointer}',
    '.gv-ml-val{min-width:3.2em;text-align:right;font-variant-numeric:tabular-nums;font-weight:600}',
    '.gv-ml-foot{display:flex;justify-content:flex-end;margin-top:12px}',
    '.gv-ml-foot .gv-ml-btn{flex:0 0 auto;background:transparent}',
    '.gv-ml-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
  ].join('\n');

  function injectStyle() {
    if (document.head.querySelector('style[data-gv="muller-lyer"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gv', 'muller-lyer');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function svgEl(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var CHOICES = [
    { id: 'oben', label: 'Der obere' },
    { id: 'unten', label: 'Der untere' },
    { id: 'gleich', label: 'Gleich lang' }
  ];
  var CHOICE_TXT = { oben: 'den oberen Strich', unten: 'den unteren Strich', gleich: 'beide gleich lang' };

  function mount(container) {
    injectStyle();
    var angle = 30, picked = null, measured = false;
    var timers = [];

    var wrap = h('div', 'gv-ml-wrap');
    container.appendChild(wrap);

    /* ---- Figur ---- */
    var svg = svgEl('svg', { 'class': 'gv-ml-svg', viewBox: '0 0 400 248', role: 'img', 'aria-labelledby': 'gv-ml-t gv-ml-d', focusable: 'false' });
    var t = svgEl('title', { id: 'gv-ml-t' }, svg); t.textContent = 'Müller-Lyer-Figur';
    var d = svgEl('desc', { id: 'gv-ml-d' }, svg);
    d.textContent = 'Zwei waagerechte Striche übereinander, beide exakt gleich lang. Der obere hat nach innen gerichtete Pfeilspitzen, der untere nach außen gespreizte Pfeilfedern.';
    var gFins = svgEl('g', { 'class': 'gv-ml-fins' }, svg);
    svgEl('line', { 'class': 'gv-ml-shaft', x1: X1, y1: YT, x2: X2, y2: YT }, svg);
    svgEl('line', { 'class': 'gv-ml-shaft', x1: X1, y1: YB, x2: X2, y2: YB }, svg);
    var gGuide = svgEl('g', { 'aria-hidden': 'true' }, svg);
    svgEl('line', { 'class': 'gv-ml-guide', x1: X1, y1: G0, x2: X1, y2: G1, pathLength: 170 }, gGuide);
    svgEl('line', { 'class': 'gv-ml-guide', x1: X2, y1: G0, x2: X2, y2: G1, pathLength: 170 }, gGuide);
    var gDim = svgEl('g', { 'class': 'gv-ml-dim', 'aria-hidden': 'true' }, svg);
    svgEl('line', { 'class': 'gv-ml-dimline', x1: X1, y1: 208, x2: X2, y2: 208 }, gDim);
    svgEl('path', { 'class': 'gv-ml-dimline', d: 'M' + (X1 + 8) + ' 203 L' + X1 + ' 208 L' + (X1 + 8) + ' 213 M' + (X2 - 8) + ' 203 L' + X2 + ' 208 L' + (X2 - 8) + ' 213' }, gDim);
    var dt = svgEl('text', { 'class': 'gv-ml-dimtxt', x: 200, y: 234, 'text-anchor': 'middle' }, gDim);
    dt.setAttribute('dy', '-0.05em');
        dt.textContent = 'beide ' + LEN + ' Einheiten';
    wrap.appendChild(svg);

    function drawFins() {
      while (gFins.firstChild) gFins.removeChild(gFins.firstChild);
      if (angle <= 0) return;
      var r = angle * Math.PI / 180, dx = FIN * Math.cos(r), dy = FIN * Math.sin(r);
      function fin(x, y, sx, sy) {
        svgEl('line', { 'class': 'gv-ml-fin', x1: x, y1: y, x2: x + sx * dx, y2: y + sy * dy }, gFins);
      }
      [[X1, 1], [X2, -1]].forEach(function (e) {
        var x = e[0], inw = e[1];            /* inw: Richtung nach innen */
        [-1, 1].forEach(function (sy) {
          fin(x, YT, inw, sy);               /* oben: Pfeilspitzen (nach innen) */
          fin(x, YB, -inw, sy);              /* unten: Federn (nach außen) */
        });
      });
    }

    /* ---- Schritt 1 ---- */
    var s1 = h('div', 'gv-ml-step');
    var q1 = h('p', 'gv-ml-q'); q1.id = 'gv-ml-q1';
    q1.appendChild(h('span', 'gv-ml-n', '1')); q1.appendChild(document.createTextNode('Welcher Strich wirkt auf dich länger?'));
    var row1 = h('div', 'gv-ml-row'); row1.setAttribute('role', 'radiogroup'); row1.setAttribute('aria-labelledby', 'gv-ml-q1');
    var btns = CHOICES.map(function (c, i) {
      var b = h('button', 'gv-ml-btn', c.label);
      b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener('click', function () { pick(c.id); });
      b.addEventListener('keydown', function (e) {
        var k = e.key, ni = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') ni = (i + 1) % btns.length;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') ni = (i + btns.length - 1) % btns.length;
        if (ni >= 0) { e.preventDefault(); btns[ni].focus(); pick(CHOICES[ni].id); }
      });
      row1.appendChild(b); return b;
    });
    s1.appendChild(q1); s1.appendChild(row1);
    var eval1 = h('p', 'gv-ml-note'); eval1.hidden = true;
    s1.appendChild(eval1);
    wrap.appendChild(s1);

    /* ---- Schritt 2 ---- */
    var s2 = h('div', 'gv-ml-step'); s2.hidden = true;
    var q2 = h('p', 'gv-ml-q');
    q2.appendChild(h('span', 'gv-ml-n', '2')); q2.appendChild(document.createTextNode('Jetzt prüfen, wie du es im Text getan hast.'));
    var row2 = h('div', 'gv-ml-row');
    var measureBtn = h('button', 'gv-ml-btn gv-ml-primary', 'Nachmessen');
    measureBtn.type = 'button';
    measureBtn.addEventListener('click', measure);
    row2.appendChild(measureBtn);
    s2.appendChild(q2); s2.appendChild(row2);
    var res = h('p', 'gv-ml-note'); res.hidden = true;
    s2.appendChild(res);
    wrap.appendChild(s2);

    /* ---- Schritt 3 ---- */
    var s3 = h('div', 'gv-ml-step'); s3.hidden = true;
    var q3 = h('p', 'gv-ml-q');
    q3.appendChild(h('span', 'gv-ml-n', '3')); q3.appendChild(document.createTextNode('Verändere die Flügel.'));
    var sl = h('div', 'gv-ml-slider');
    var lab = h('label', null, 'Federwinkel'); lab.htmlFor = 'gv-ml-range';
    var range = h('input', 'gv-ml-range'); range.type = 'range'; range.id = 'gv-ml-range';
    range.min = 0; range.max = 60; range.step = 5; range.value = angle;
    var val = h('span', 'gv-ml-val'); val.setAttribute('aria-hidden', 'true');
    sl.appendChild(lab); sl.appendChild(range); sl.appendChild(val);
    s3.appendChild(q3); s3.appendChild(sl);
    var note3 = h('p', 'gv-ml-note');
    s3.appendChild(note3);
    wrap.appendChild(s3);

    var foot = h('div', 'gv-ml-foot');
    var resetBtn = h('button', 'gv-ml-btn', 'Zurücksetzen'); resetBtn.type = 'button';
    resetBtn.addEventListener('click', reset);
    foot.appendChild(resetBtn);
    wrap.appendChild(foot);

    var live = h('div', 'gv-ml-sr'); live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status');
    wrap.appendChild(live);

    function say(txt) { live.textContent = ''; timers.push(setTimeout(function () { live.textContent = txt; }, 30)); }
    function reduced() { return M.reducedMotion ? M.reducedMotion() : (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    function pick(id) {
      picked = id;
      btns.forEach(function (b, i) {
        var on = CHOICES[i].id === id;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      eval1.hidden = false;
      eval1.innerHTML = '';
      eval1.appendChild(document.createTextNode('Du hast ' + CHOICE_TXT[id] + ' gewählt. '));
      eval1.appendChild(document.createTextNode('Die meisten Menschen sehen den Strich mit den Federn (unten) als länger. Das gilt als klassisch und robust.'));
      s2.hidden = false;
      say('Auswahl: ' + CHOICE_TXT[id] + '. Die meisten sehen den unteren Strich, den mit den Federn, als länger. Schritt 2: Nachmessen ist jetzt möglich.');
    }

    function measure() {
      if (measured) return;
      measured = true;
      measureBtn.disabled = true;
      var done = function () {
        res.hidden = false;
        res.innerHTML = '';
        res.appendChild(document.createTextNode('Beide Schäfte messen ' + LEN + ' Einheiten, die Hilfslinien treffen beide Enden. '));
        res.appendChild(h('span', 'gv-ml-punch', 'Siehst du es immer noch ungleich? Genau das ist der Punkt.'));
        s3.hidden = false;
        say('Nachgemessen: beide Striche sind ' + LEN + ' Einheiten lang. Siehst du es immer noch ungleich? Genau das ist der Punkt. Schritt 3: Mit dem Regler Federwinkel kannst du die Flügel verändern.');
      };
      wrap.classList.add('gv-ml-on');
      if (reduced()) done(); else timers.push(setTimeout(done, 1300));
    }

    function explain() {
      if (angle === 0) note3.textContent = 'Bei 0° gibt es keine Flügel, und die beiden Striche sehen gleich aus. Ohne Winkel entsteht keine Täuschung.';
      else if (angle < 20) note3.textContent = 'Kleine Winkel: Die Flügel liegen fast auf dem Strich, der Unterschied im Eindruck ist in der Regel gering.';
      else note3.textContent = 'Je weiter die Flügel gespreizt sind, desto deutlicher wirkt der untere Strich meist länger. Die Schäfte bleiben dabei unverändert ' + LEN + ' Einheiten lang.';
    }
    function setAngle(a, announce) {
      angle = a;
      range.value = a;
      range.setAttribute('aria-valuetext', a + ' Grad');
      val.textContent = a + '°';
      drawFins(); explain();
      if (announce) say(a === 0 ? 'Federwinkel 0 Grad: keine Flügel, keine Täuschung.' : 'Federwinkel ' + a + ' Grad.');
    }
    range.addEventListener('input', function () { setAngle(parseInt(range.value, 10), false); });
    range.addEventListener('change', function () { setAngle(parseInt(range.value, 10), true); });

    function reset() {
      timers.forEach(clearTimeout); timers = [];
      picked = null; measured = false;
      wrap.classList.remove('gv-ml-on');
      btns.forEach(function (b, i) { b.setAttribute('aria-checked', 'false'); b.tabIndex = i === 0 ? 0 : -1; });
      eval1.hidden = true; s2.hidden = true; res.hidden = true; s3.hidden = true;
      measureBtn.disabled = false;
      setAngle(30, false);
      say('Zurückgesetzt.');
      btns[0].focus();
    }

    setAngle(30, false);

    return function destroy() {
      timers.forEach(clearTimeout); timers = [];
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    };
  }

  M.visuals['muller-lyer'] = {
    alt: 'Interaktive Müller-Lyer-Figur: zwei gleich lange waagerechte Striche, der obere mit Pfeilspitzen, der untere mit Pfeilfedern. Du schätzt, welcher länger wirkt, misst per Hilfslinien nach und verstellst den Federwinkel.',
    caption: 'Schematische Darstellung nach Müller-Lyer (1889). Beide Schäfte sind exakt gleich lang.',
    mount: mount
  };
})();

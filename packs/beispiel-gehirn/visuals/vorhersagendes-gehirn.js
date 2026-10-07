/* ==========================================================================
   Gehirnmuseum – js/visuals/vorhersagendes-gehirn.js
   Abbildung: drei kleine Täuschungen (Kanizsa-Dreieck, Necker-Würfel,
   Schattentäuschung) als Galerie mit Karten-Umschalter.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  M.visuals = M.visuals || {};

  var ID = 'vorhersagendes-gehirn';
  var NS = 'http://www.w3.org/2000/svg';
  var uidCounter = 0;

  /* ---------------- Styles (einmalig) ---------------- */

  function injectStyle() {
    if (document.head.querySelector('style[data-gv="' + ID + '"]')) return;
    var css = [
      '.gv-vg{--gv-c:var(--jc,var(--j-verzerrung,var(--accent,#05749E)));font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);color:var(--ink,#1B2230);width:100%;min-width:0}',
      '.gv-vg *{box-sizing:border-box}',
      '.gv-vg-tabs{display:flex;gap:0;border-bottom:1px solid var(--line,#D9D2C3);margin:0 0 14px}',
      '.gv-vg-tab{flex:1 1 0;min-width:0;min-height:48px;padding:6px 6px 4px;margin:0 0 -1px;background:none;border:0;border-bottom:3px solid transparent;color:var(--ink-2,#5C6577);font:inherit;font-size:.9rem;line-height:1.25;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}',
      '.gv-vg-tab small{font-size:.72rem;letter-spacing:.04em;text-transform:uppercase;opacity:.85}',
      '.gv-vg-tab:hover{color:var(--ink,#1B2230)}',
      '.gv-vg-tab[aria-selected="true"]{color:var(--ink,#1B2230);font-weight:650;border-bottom-color:var(--gv-c)}',
      '.gv-vg-tab:focus-visible,.gv-vg-btn:focus-visible,.gv-vg-svg[tabindex]:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px;border-radius:6px}',
      '.gv-vg-panel[hidden]{display:none}',
      '.gv-vg-stage{background:var(--bg-3,#ECE6DA);border:1px solid var(--line,#D9D2C3);border-radius:var(--radius,14px);padding:12px;display:flex;justify-content:center}',
      '.gv-vg-svg{display:block;width:100%;max-width:340px;height:auto;overflow:visible}',
      '.gv-vg-ctrl{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px;margin:12px 0 0}',
      '.gv-vg-btn{min-height:44px;padding:0 16px 0 12px;display:inline-flex;align-items:center;gap:10px;background:var(--bg-2,#fff);color:var(--ink,#1B2230);border:1px solid var(--line,#D9D2C3);border-radius:999px;font:inherit;font-size:.92rem;cursor:pointer}',
      '.gv-vg-btn:hover{border-color:var(--gv-c)}',
      '.gv-vg-btn[aria-pressed="true"]{border-color:var(--gv-c);box-shadow:inset 0 0 0 1px var(--gv-c)}',
      '.gv-vg-knob{flex:none;width:30px;height:18px;border-radius:9px;background:var(--bg-3,#ECE6DA);border:1px solid var(--ink-2,#5C6577);position:relative;transition:background .2s}',
      '.gv-vg-knob::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--ink-2,#5C6577);transition:transform .2s,background .2s}',
      '.gv-vg-btn[aria-pressed="true"] .gv-vg-knob{background:var(--gv-c);border-color:var(--gv-c)}',
      '.gv-vg-btn[aria-pressed="true"] .gv-vg-knob::after{transform:translateX(12px);background:#fff}',
      '.gv-vg-btn-plain{padding:0 18px}',
      '.gv-vg-count{font-size:.9rem;color:var(--ink-2,#5C6577);font-variant-numeric:tabular-nums}',
      '.gv-vg-count b{color:var(--ink,#1B2230);font-size:1.05rem}',
      '.gv-vg-status{margin:10px 0 0;min-height:2.6em;font-size:.9rem;line-height:1.45;color:var(--ink-2,#5C6577)}',
      '.gv-vg-why{margin:8px 0 0;font-size:.95rem;line-height:1.55;color:var(--ink,#1B2230);padding-left:12px;border-left:3px solid var(--gv-c)}',
      '.gv-vg-why strong{font-weight:650}',
      /* SVG-Teile */
      '.gv-vg-disc{fill:var(--ink,#1B2230)}',
      '.gv-vg-v{fill:none;stroke:var(--ink,#1B2230);stroke-width:4;stroke-linecap:butt;stroke-linejoin:miter}',
      '.gv-vg-rot{transition:transform .8s cubic-bezier(.4,0,.2,1)}',
      '.gv-vg-rot.is-off{transform:rotate(180deg)}',
      '.gv-vg-outline{fill:none;stroke:var(--gv-c);stroke-width:2;stroke-dasharray:5 5;opacity:0;transition:opacity .3s}',
      '.gv-vg-outline.is-on{opacity:1}',
      '.gv-vg-edge{fill:none;stroke:var(--ink,#1B2230);stroke-linecap:round;stroke-linejoin:round;transition:stroke-width .25s,opacity .25s}',
      '.gv-vg-face{fill:var(--gv-c);opacity:0;transition:opacity .25s}',
      '.gv-vg-face.is-on{opacity:.22}',
      '.gv-vg-lbl{font-size:12px;fill:var(--ink-2,#5C6577);font-family:inherit;text-anchor:middle}',
      '.gv-vg-bar{opacity:0;transition:opacity .35s}',
      '.gv-vg-bar.is-on{opacity:1}',
      '.gv-vg-tile-lbl{font-size:15px;font-weight:700;fill:#F4F4F4;font-family:inherit;text-anchor:middle;dominant-baseline:central}',
      '.gv-vg-board-frame{fill:none;stroke:var(--line,#D9D2C3);stroke-width:1}',
      '@media (prefers-reduced-motion:reduce){.gv-vg-rot,.gv-vg-outline,.gv-vg-edge,.gv-vg-face,.gv-vg-bar,.gv-vg-knob,.gv-vg-knob::after{transition:none}}'
    ].join('\n');
    var st = document.createElement('style');
    st.setAttribute('data-gv', ID);
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------------- Helfer ---------------- */

  function n1(v) { return Math.round(v * 100) / 100; }

  function h(tag, cls, text, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  /* ---------------- Karte 1: Kanizsa ---------------- */

  function kanizsaSVG() {
    var A = { x: 120, y: 38 }, B = { x: 50, y: 159 }, C = { x: 190, y: 159 };
    var cen = { x: 120, y: (38 + 159 + 159) / 3 };
    var P1 = { x: 50, y: 2 * cen.y - 159 }, P2 = { x: 190, y: 2 * cen.y - 159 }, P3 = { x: 120, y: 2 * cen.y - 38 };
    var R = 22, L = 34;

    function pt(v, ang, r) { return { x: v.x + Math.cos(ang) * r, y: v.y + Math.sin(ang) * r }; }
    function disc(v) {
      var th = Math.atan2(cen.y - v.y, cen.x - v.x), w = Math.PI / 6;
      var a = pt(v, th + w, R), b = pt(v, th - w, R);
      return '<g class="gv-vg-rot" data-rot style="transform-origin:' + v.x + 'px ' + v.y + 'px">' +
        '<path class="gv-vg-disc" d="M' + n1(v.x) + ',' + n1(v.y) + ' L' + n1(a.x) + ',' + n1(a.y) +
        ' A' + R + ',' + R + ' 0 1 1 ' + n1(b.x) + ',' + n1(b.y) + ' Z"/></g>';
    }
    function vee(v, t1, t2) {
      var a1 = Math.atan2(t1.y - v.y, t1.x - v.x), a2 = Math.atan2(t2.y - v.y, t2.x - v.x);
      var p = pt(v, a1, L), q = pt(v, a2, L);
      return '<g class="gv-vg-rot" data-rot style="transform-origin:' + n1(v.x) + 'px ' + n1(v.y) + 'px">' +
        '<path class="gv-vg-v" d="M' + n1(p.x) + ',' + n1(p.y) + ' L' + n1(v.x) + ',' + n1(v.y) + ' L' + n1(q.x) + ',' + n1(q.y) + '"/></g>';
    }
    function tri(a, b, c) { return n1(a.x) + ',' + n1(a.y) + ' ' + n1(b.x) + ',' + n1(b.y) + ' ' + n1(c.x) + ',' + n1(c.y); }

    return '<svg class="gv-vg-svg" viewBox="0 0 240 232" role="img" aria-labelledby="TID DID">' +
      '<title id="TID">Kanizsa-Dreieck</title>' +
      '<desc id="DID">Drei schwarze Scheiben mit ausgeschnittener Ecke und drei offene Winkel. Dazwischen erscheint ein helles Dreieck mit Kanten, die nicht gezeichnet sind.</desc>' +
      '<polygon class="gv-vg-outline" data-outline points="' + tri(A, B, C) + '"/>' +
      '<polygon class="gv-vg-outline" data-outline points="' + tri(P1, P2, P3) + '"/>' +
      disc(A) + disc(B) + disc(C) +
      vee(P1, P2, P3) + vee(P2, P1, P3) + vee(P3, P1, P2) +
      '</svg>';
  }

  function mountKanizsa(panel, announce) {
    var stage = h('div', 'gv-vg-stage');
    stage.innerHTML = kanizsaSVG().replace('TID', 'gvt' + (++uidCounter)).replace('DID', 'gvd' + uidCounter);
    // IDs nach Ersetzung korrigieren (labelledby enthält beide)
    var svg = stage.firstChild;
    var tid = 'gvt' + uidCounter, did = 'gvd' + uidCounter;
    svg.setAttribute('aria-labelledby', tid + ' ' + did);
    svg.querySelector('title').id = tid;
    svg.querySelector('desc').id = did;
    panel.appendChild(stage);

    var rots = [].slice.call(svg.querySelectorAll('[data-rot]'));
    var outs = [].slice.call(svg.querySelectorAll('[data-outline]'));
    var off = false, showOut = false;

    var bTurn = h('button', 'gv-vg-btn', null, { type: 'button', 'aria-pressed': 'false' });
    bTurn.innerHTML = '<span class="gv-vg-knob" aria-hidden="true"></span><span></span>';
    var bOut = h('button', 'gv-vg-btn', null, { type: 'button', 'aria-pressed': 'false' });
    bOut.innerHTML = '<span class="gv-vg-knob" aria-hidden="true"></span><span>Fehlende Kanten markieren</span>';
    var ctrl = h('div', 'gv-vg-ctrl');
    ctrl.appendChild(bTurn); ctrl.appendChild(bOut);
    panel.appendChild(ctrl);

    var status = h('p', 'gv-vg-status');
    panel.appendChild(status);
    var why = h('p', 'gv-vg-why');
    why.innerHTML = '<strong>Dein Gehirn ergänzt</strong> die Kanten eines Dreiecks, das dort liegen könnte: Drei Scheiben mit passender Lücke deutet es als Dreieck, das die Scheiben verdeckt. Es rät das wahrscheinlichste Objekt, nicht das gezeichnete.';
    panel.appendChild(why);

    function paint(say) {
      rots.forEach(function (r) { r.classList.toggle('is-off', off); });
      outs.forEach(function (o) { o.classList.toggle('is-on', showOut); });
      bTurn.setAttribute('aria-pressed', off ? 'true' : 'false');
      bTurn.lastChild.textContent = off ? 'Scheiben wieder zudrehen' : 'Scheiben wegdrehen';
      bOut.setAttribute('aria-pressed', showOut ? 'true' : 'false');
      var s = off
        ? 'Die Scheiben und Winkel sind weggedreht: Das Dreieck ist verschwunden, obwohl nur die Ausrichtung der Teile anders ist.'
        : 'Du siehst zwei helle Dreiecke, eines mit der Spitze nach oben, eines nach unten. Gezeichnet sind nur Scheiben und Winkel.';
      if (showOut) s += ' Die gestrichelten Linien zeigen, wo die Kanten wären. Dort steht keine Linie.';
      status.textContent = s;
      if (say) announce(s);
    }
    function onTurn() { off = !off; paint(true); }
    function onOut() { showOut = !showOut; paint(true); }
    bTurn.addEventListener('click', onTurn);
    bOut.addEventListener('click', onOut);
    paint(false);
  }

  /* ---------------- Karte 2: Necker ---------------- */

  function mountNecker(panel, announce) {
    var stage = h('div', 'gv-vg-stage');
    var d = 38;
    var x1 = 52, y1 = 96, s = 84;               // vorderes/unteres Quadrat (Deutung A)
    var x2 = x1 + d, y2 = y1 - d;               // versetztes Quadrat
    var q1 = [[x1, y1], [x1 + s, y1], [x1 + s, y1 + s], [x1, y1 + s]];
    var q2 = [[x2, y2], [x2 + s, y2], [x2 + s, y2 + s], [x2, y2 + s]];
    function poly(q) { return q.map(function (p) { return p[0] + ',' + p[1]; }).join(' '); }
    function sq(q, k) {
      return '<polygon class="gv-vg-edge" data-sq="' + k + '" points="' + poly(q) + '" fill="none"/>';
    }
    var conn = '';
    for (var i = 0; i < 4; i++) {
      conn += '<line class="gv-vg-edge" data-conn x1="' + q1[i][0] + '" y1="' + q1[i][1] + '" x2="' + q2[i][0] + '" y2="' + q2[i][1] + '"/>';
    }
    var uid = ++uidCounter;
    stage.innerHTML =
      '<svg class="gv-vg-svg" viewBox="0 0 240 232" role="img" aria-labelledby="gvt' + uid + ' gvd' + uid + '" style="cursor:pointer">' +
      '<title id="gvt' + uid + '">Necker-Würfel</title>' +
      '<desc id="gvd' + uid + '">Ein Drahtwürfel aus zwei versetzten Quadraten und vier Verbindungslinien. Welches Quadrat vorn liegt, lässt sich nicht aus den Linien ablesen.</desc>' +
      '<polygon class="gv-vg-face" data-face="0" points="' + poly(q1) + '"/>' +
      '<polygon class="gv-vg-face" data-face="1" points="' + poly(q2) + '"/>' +
      sq(q1, 0) + sq(q2, 1) + conn +
      '<text class="gv-vg-lbl" data-lbl="0" x="' + (x1 + s / 2) + '" y="' + (y1 + s + 20) + '"></text>' +
      '<text class="gv-vg-lbl" data-lbl="1" x="' + (x2 + s / 2) + '" y="' + (y2 - 10) + '"></text>' +
      '</svg>';
    panel.appendChild(stage);
    var svg = stage.firstChild;
    var faces = [].slice.call(svg.querySelectorAll('[data-face]'));
    var sqs = [].slice.call(svg.querySelectorAll('[data-sq]'));
    var conns = [].slice.call(svg.querySelectorAll('[data-conn]'));
    var lbls = [].slice.call(svg.querySelectorAll('[data-lbl]'));

    var count = 0, front = -1;
    var btn = h('button', 'gv-vg-btn gv-vg-btn-plain', 'Würfel umspringen lassen', { type: 'button' });
    var cnt = h('span', 'gv-vg-count');
    cnt.innerHTML = 'Umspringen: <b>0</b>';
    var ctrl = h('div', 'gv-vg-ctrl');
    ctrl.appendChild(btn); ctrl.appendChild(cnt);
    panel.appendChild(ctrl);
    var status = h('p', 'gv-vg-status');
    panel.appendChild(status);
    var why = h('p', 'gv-vg-why');
    why.innerHTML = '<strong>Die Linien bleiben gleich.</strong> Weil beide Tiefendeutungen gleich gut passen, entscheidet sich dein Gehirn für eine und wechselt irgendwann zur anderen. Beides zugleich sieht man nie.';
    panel.appendChild(why);

    function paint(say) {
      var names = ['das untere linke Quadrat', 'das obere rechte Quadrat'];
      faces.forEach(function (f, k) { f.classList.toggle('is-on', front === k); });
      sqs.forEach(function (e, k) {
        e.style.strokeWidth = front === -1 ? 3 : (front === k ? 4.4 : 2);
        e.style.opacity = front === -1 || front === k ? 1 : .6;
      });
      conns.forEach(function (e) { e.style.strokeWidth = front === -1 ? 3 : 2.4; });
      lbls.forEach(function (l, k) {
        l.textContent = front === -1 ? '' : (front === k ? 'vorn' : 'hinten');
      });
      cnt.innerHTML = 'Umspringen: <b>' + count + '</b>';
      var s = front === -1
        ? 'Schau eine Weile auf den Würfel: Kippt er von selbst? Mit dem Knopf (oder einem Klick auf den Würfel) kannst du dir die jeweils andere Deutung anzeigen lassen.'
        : 'Aktuelle Deutung: ' + names[front] + ' liegt vorn, das andere hinten. Umgesprungen: ' + count + (count === 1 ? ' Mal.' : ' Mal.');
      status.textContent = s;
      if (say) announce(s);
    }
    function flip() {
      count++;
      front = front === -1 ? 0 : 1 - front;
      paint(true);
    }
    btn.addEventListener('click', flip);
    svg.addEventListener('click', flip);
    paint(false);
  }

  /* ---------------- Karte 3: Schatten ---------------- */

  function mountShadow(panel, announce) {
    var uid = ++uidCounter;
    var T = 44, X0 = 24, Y0 = 14, COLS = 6, ROWS = 4;
    var tiles = '';
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        tiles += '<rect x="' + (X0 + c * T) + '" y="' + (Y0 + r * T) + '" width="' + T + '" height="' + T +
          '" fill="' + ((r + c) % 2 === 1 ? '#646464' : '#C8C8C8') + '"/>';
      }
    }
    var ax = X0 + 1 * T + T / 2, ay = Y0 + 2 * T + T / 2;      // Feld A: dunkel, im Licht
    var bx = X0 + 4 * T + T / 2, by = ay;                        // Feld B: hell, im Schatten
    var W = X0 * 2 + COLS * T, H = Y0 * 2 + ROWS * T;
    var stage = h('div', 'gv-vg-stage');
    stage.innerHTML =
      '<svg class="gv-vg-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="gvt' + uid + ' gvd' + uid + '">' +
      '<title id="gvt' + uid + '">Schachbrett mit Schatten</title>' +
      '<desc id="gvd' + uid + '">Ein Schachbrett aus hellen und dunklen Feldern, rechts oben steht ein Zylinder und wirft einen weichen Schatten auf die rechte Brettmitte. Feld A ist dunkel im Licht, Feld B hell im Schatten. Beide sind in Wirklichkeit gleich grau.</desc>' +
      '<defs>' +
      '<clipPath id="gvc' + uid + '"><rect x="' + X0 + '" y="' + Y0 + '" width="' + (COLS * T) + '" height="' + (ROWS * T) + '"/></clipPath>' +
      '<filter id="gvf' + uid + '" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>' +
      '<linearGradient id="gvg' + uid + '" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#B9B9B9"/><stop offset=".35" stop-color="#F2F2F2"/><stop offset="1" stop-color="#9C9C9C"/></linearGradient>' +
      '</defs>' +
      '<g clip-path="url(#gvc' + uid + ')">' + tiles +
      '<ellipse cx="222" cy="126" rx="80" ry="54" fill="#000" fill-opacity=".5" filter="url(#gvf' + uid + ')"/>' +
      '</g>' +
      /* Zylinder */
      '<path d="M244,26 L244,70 A18,6 0 0 0 280,70 L280,26 Z" fill="url(#gvg' + uid + ')"/>' +
      '<ellipse cx="262" cy="26" rx="18" ry="6" fill="#F7F7F7"/>' +
      '<path d="M244,26 L244,70 A18,6 0 0 0 280,70 L280,26" fill="none" stroke="#7a7a7a" stroke-width=".8"/>' +
      '<rect class="gv-vg-board-frame" x="' + X0 + '" y="' + Y0 + '" width="' + (COLS * T) + '" height="' + (ROWS * T) + '"/>' +
      '<rect class="gv-vg-bar" data-bar x="' + ax + '" y="' + (ay - 8) + '" width="' + (bx - ax) + '" height="16" fill="#646464"/>' +
      '<text class="gv-vg-tile-lbl" x="' + ax + '" y="' + ay + '">A</text>' +
      '<text class="gv-vg-tile-lbl" x="' + bx + '" y="' + by + '">B</text>' +
      '</svg>';
    panel.appendChild(stage);
    var bar = stage.querySelector('[data-bar]');

    var on = false;
    var btn = h('button', 'gv-vg-btn', null, { type: 'button', 'aria-pressed': 'false' });
    btn.innerHTML = '<span class="gv-vg-knob" aria-hidden="true"></span><span>Verbindungsbalken einblenden</span>';
    var ctrl = h('div', 'gv-vg-ctrl'); ctrl.appendChild(btn);
    panel.appendChild(ctrl);
    var status = h('p', 'gv-vg-status');
    panel.appendChild(status);
    var why = h('p', 'gv-vg-why');
    why.innerHTML = '<strong>Dein Gehirn rechnet den Schatten heraus.</strong> Ein Feld, das im Schatten liegt, muss in Wirklichkeit heller sein, also zeigt es dir ein helleres Grau. Das Feld B wirkt deshalb heller als A, obwohl beide gleich grau gemalt sind.';
    panel.appendChild(why);

    function paint(say) {
      bar.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.lastChild.textContent = on ? 'Verbindungsbalken ausblenden' : 'Verbindungsbalken einblenden';
      var s = on
        ? 'Der Balken hat überall dasselbe Grau. Er geht an beiden Enden nahtlos in A und in B über: Beide Felder sind exakt gleich grau.'
        : 'Feld A (dunkel, im Licht) und Feld B (hell, im Schatten): Welches ist heller? Die meisten sehen B heller.';
      status.textContent = s;
      if (say) announce(s);
    }
    btn.addEventListener('click', function () { on = !on; paint(true); });
    paint(false);
  }

  /* ---------------- Galerie ---------------- */

  var CARDS = [
    { key: 'kanizsa', label: 'Ergänzte Kontur', sub: 'Kanizsa', mount: mountKanizsa },
    { key: 'necker', label: 'Kippwürfel', sub: 'Necker', mount: mountNecker },
    { key: 'schatten', label: 'Schatten', sub: 'Grauwert', mount: mountShadow }
  ];

  function mount(container) {
    injectStyle();
    var uid = ++uidCounter;
    var root = h('div', 'gv-vg');
    var tabs = h('div', 'gv-vg-tabs', null, { role: 'tablist', 'aria-label': 'Drei Wahrnehmungstäuschungen' });
    var live = h('div', null, null, { role: 'status', 'aria-live': 'polite' });
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
    var tabEls = [], panels = [], mounted = [], sel = 0;

    function announce(t) {
      live.textContent = '';
      window.setTimeout(function () { live.textContent = t; }, 30);
    }

    CARDS.forEach(function (card, i) {
      var tb = h('button', 'gv-vg-tab', null, {
        type: 'button', role: 'tab', id: 'gv-vg-tab-' + uid + '-' + i,
        'aria-controls': 'gv-vg-panel-' + uid + '-' + i, 'aria-selected': 'false', tabindex: '-1'
      });
      tb.appendChild(h('span', null, card.label));
      tb.appendChild(h('small', null, card.sub));
      var pn = h('div', 'gv-vg-panel', null, {
        role: 'tabpanel', id: 'gv-vg-panel-' + uid + '-' + i,
        'aria-labelledby': 'gv-vg-tab-' + uid + '-' + i, hidden: ''
      });
      tabs.appendChild(tb);
      tabEls.push(tb); panels.push(pn);
      mounted.push(false);
      tb.addEventListener('click', function () { select(i, false); });
      tb.addEventListener('keydown', function (ev) {
        var k = ev.key, n = CARDS.length, t = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') t = (i + 1) % n;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') t = (i + n - 1) % n;
        else if (k === 'Home') t = 0;
        else if (k === 'End') t = n - 1;
        if (t >= 0) { ev.preventDefault(); select(t, true); }
      });
    });

    function select(i, focus) {
      sel = i;
      tabEls.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (on) panels[k].removeAttribute('hidden'); else panels[k].setAttribute('hidden', '');
      });
      if (!mounted[i]) { mounted[i] = true; CARDS[i].mount(panels[i], announce); }
      if (focus) tabEls[i].focus();
    }

    root.appendChild(tabs);
    panels.forEach(function (p) { root.appendChild(p); });
    root.appendChild(live);
    container.appendChild(root);
    select(0, false);

    return function destroy() {
      // Alle Listener hängen an Elementen innerhalb von root; Entfernen genügt.
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  M.visuals[ID] = {
    alt: 'Galerie mit drei Wahrnehmungstäuschungen, zwischen denen du per Karten-Umschalter wählst: ein Dreieck, das nur durch Scheiben und Winkel angedeutet wird, ein Drahtwürfel, der umspringt, und zwei gleich graue Schachbrettfelder, die verschieden hell wirken. Jede Karte hat einen Schalter, der die Täuschung aufdeckt oder verändert.',
    caption: 'Schematisch, eigene Zeichnungen. Kanizsa-Dreieck nach Gaetano Kanizsa (1955), Kippwürfel nach Louis Albert Necker (1832); die Schattentäuschung ist eine eigene Variante nach dem Prinzip von Edward Adelson.',
    mount: mount
  };
})();

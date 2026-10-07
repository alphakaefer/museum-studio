/* Gehirnmuseum – Abbildung: Wertfunktion der Prospect Theory (schematisch) */
(function () {
  'use strict';
  var M = window.MUSEUM = window.MUSEUM || {};
  M.visuals = M.visuals || {};

  var NS = 'http://www.w3.org/2000/svg';
  var ALPHA = 0.88;           // Krümmung (Tversky & Kahneman 1992, häufig zitiert)
  var XMAX = 150, YMAX = 260; // Achsenbereiche (Schematisch)
  var OX = 250, OY = 168, SX = 1.4, SY = 0.56;

  function injectStyle() {
    if (document.querySelector('style[data-gv="verlustaversion"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gv', 'verlustaversion');
    s.textContent = [
      '.gv-va{font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);color:var(--ink,#1B2230);--gv-c:var(--jc,var(--j-verzerrung,var(--accent,#05749E)));--gv-g:var(--accent,#05749E)}',
      '.gv-va-svg{display:block;width:100%;height:auto;max-width:100%}',
      '.gv-va-svg text{font-family:inherit;fill:var(--ink-2,#5C6577);font-size:13px}',
      '.gv-va-svg .gv-va-strong{fill:var(--ink,#1B2230);font-weight:600}',
      '.gv-va-axis{stroke:var(--ink-2,#5C6577);stroke-width:1.4;fill:none}',
      '.gv-va-grid{stroke:var(--line,#D9D2C3);stroke-width:1;stroke-dasharray:2 4}',
      '.gv-va-qg{fill:var(--gv-g);opacity:.07}',
      '.gv-va-ql{fill:var(--gv-c);opacity:.09}',
      '.gv-va-sym{stroke:var(--ink-2,#5C6577);stroke-width:1.6;stroke-dasharray:5 4;fill:none;opacity:.8}',
      '.gv-va-cg{stroke:var(--gv-g);stroke-width:3.2;fill:none;stroke-linecap:round}',
      '.gv-va-cl{stroke:var(--gv-c);stroke-width:3.2;fill:none;stroke-linecap:round}',
      '.gv-va-guide{stroke-width:1.4;stroke-dasharray:3 3;fill:none}',
      '.gv-va-dotg{fill:var(--gv-g);stroke:var(--bg-2,#fff);stroke-width:2}',
      '.gv-va-dotl{fill:var(--gv-c);stroke:var(--bg-2,#fff);stroke-width:2}',
      '.gv-va-ctrl{display:grid;gap:14px;margin-top:10px}',
      '.gv-va-row label{display:flex;justify-content:space-between;gap:12px;align-items:baseline;font-size:.92rem;font-weight:600}',
      '.gv-va-row output{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ink,#1B2230);white-space:nowrap}',
      '.gv-va-row input[type=range]{display:block;width:100%;height:44px;margin:0;background:transparent;accent-color:var(--gv-c);cursor:pointer}',
      '.gv-va-row input[type=range]:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px;border-radius:8px}',
      '.gv-va p,.gv-va output,.gv-va h4{font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);color:var(--ink,#1B2230)}',
      '.gm-st-body.has-dc .gv-va p:first-child::first-letter,.gv-va p::first-letter{float:none;font-size:inherit;font-weight:inherit;line-height:inherit;padding:0;color:inherit}',
      '.gv-va .gv-va-hint{font-size:.82rem;color:var(--ink-2,#5C6577);line-height:1.45;margin:0}',
      '.gv-va-bars{display:grid;gap:8px;margin:2px 0 0;padding:12px;background:var(--bg-3,#ECE6DA);border-radius:10px}',
      '.gv-va-bar{display:grid;grid-template-columns:minmax(0,8.2em) 1fr;gap:10px;align-items:center;font-size:.85rem}',
      '.gv-va-track{height:20px;background:var(--bg-2,#fff);border-radius:5px;overflow:hidden}',
      '.gv-va-fill{height:100%;border-radius:5px;transition:width .35s ease;min-width:2px}',
      '.gv-va-fill.g{background:var(--gv-g)}.gv-va-fill.l{background:var(--gv-c)}',
      '.gv-va .gv-va-ratio{margin:0;font-size:.9rem;line-height:1.45}',
      '.gv-va-coin{margin-top:16px;padding:14px;border:1px solid var(--line,#D9D2C3);border-radius:12px;background:var(--bg-2,#fff)}',
      '.gv-va .gv-va-coin h4{margin:0 0 4px;font-family:var(--font-display,Georgia,serif);font-size:1.02rem}',
      '.gv-va .gv-va-coin p{margin:0 0 10px;font-size:.93rem;line-height:1.5}',
      '.gv-va-btns{display:flex;flex-wrap:wrap;gap:10px}',
      '.gv-va-btn{min-height:44px;padding:8px 18px;border-radius:999px;border:1.5px solid var(--gv-c);background:transparent;color:var(--ink,#1B2230);font:inherit;font-size:.92rem;font-weight:600;cursor:pointer}',
      '.gv-va-btn:hover{background:var(--bg-3,#ECE6DA)}',
      '.gv-va-btn[aria-pressed=true]{background:var(--gv-c);color:var(--bg-2,#fff);}',
      '.gv-va-btn:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px}',
      '.gv-va-res{margin-top:12px;font-size:.9rem;line-height:1.55}',
      '.gv-va-res[hidden]{display:none}',
      '.gv-va-res p{margin:0 0 6px}',
      '@media (prefers-reduced-motion:reduce){.gv-va-fill{transition:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function f1(n) { return n.toFixed(2).replace('.', ','); }
  function f0(n) { return String(Math.round(n)); }
  function pw(a) { return Math.pow(a, ALPHA); }
  function sv(x, lam) { return x >= 0 ? pw(x) : -lam * pw(-x); }
  function X(x) { return OX + x * SX; }
  function Y(v) { return OY - v * SY; }

  function svg(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function h(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  function path(lam, from, to) {
    var d = '', step = 3;
    for (var x = from; x <= to + 0.01; x += step) d += (d ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(sv(x, lam)).toFixed(1);
    return d;
  }

  var uid = 0;

  M.visuals['verlustaversion'] = {
    alt: 'Diagramm der Wertfunktion der Prospect Theory: Auf der waagerechten Achse das Ergebnis in Euro, auf der senkrechten der subjektive Wert. Der Ursprung ist der Referenzpunkt; die Kurve ist S-förmig und im Verlustbereich steiler als im Gewinnbereich. Mit Reglern lassen sich der Verlustaversions-Faktor und ein Betrag einstellen.',
    caption: 'Schematisch nach Kahneman & Tversky (1979). Kurvenform und Faktor sind Modellannahmen zur Veranschaulichung, keine Messwerte.',
    mount: function (container) {
      injectStyle();
      var id = 'gv-va-' + (++uid);
      var lam = 2.25, amt = 100;

      var root = h('div', { 'class': 'gv-va' });
      var s = svg('svg', { 'class': 'gv-va-svg', viewBox: '0 0 500 372', role: 'img', 'aria-labelledby': id + '-t ' + id + '-d' });
      s.appendChild(svg('title', { id: id + '-t' }, 'Wertfunktion der Prospect Theory (schematisch)'));
      var desc = svg('desc', { id: id + '-d' }, '');
      s.appendChild(desc);

      // Quadranten
      s.appendChild(svg('rect', { 'class': 'gv-va-qg', x: OX, y: 14, width: 500 - OX - 10, height: OY - 14 }));
      s.appendChild(svg('rect', { 'class': 'gv-va-ql', x: 20, y: OY, width: OX - 20, height: 322 - OY }));
      s.appendChild(svg('text', { x: 490, y: 34, 'text-anchor': 'end', 'class': 'gv-va-strong' }, 'Gewinne'));
      s.appendChild(svg('text', { x: 30, y: 316, 'class': 'gv-va-strong' }, 'Verluste'));
      // Gitter + Ticks
      [-100, -50, 50, 100].forEach(function (t) {
        s.appendChild(svg('line', { 'class': 'gv-va-grid', x1: X(t), x2: X(t), y1: 14, y2: 322 }));
        s.appendChild(svg('text', { x: X(t), y: OY + 16, 'text-anchor': 'middle' }, (t > 0 ? '+' : '−') + Math.abs(t)));
      });
      // Achsen
      s.appendChild(svg('line', { 'class': 'gv-va-axis', x1: 20, x2: 490, y1: OY, y2: OY }));
      s.appendChild(svg('line', { 'class': 'gv-va-axis', x1: OX, x2: OX, y1: 14, y2: 322 }));
      s.appendChild(svg('text', { x: 490, y: 352, 'text-anchor': 'end' }, 'Ergebnis in € (Verlust ← → Gewinn)'));
      var yl = svg('text', { transform: 'translate(14 ' + 190 + ') rotate(-90)', 'text-anchor': 'middle', x: 0, y: 0 }, 'subjektiver Wert');
      yl.setAttribute('transform', 'translate(10 ' + OY + ') rotate(-90)');
      s.appendChild(yl);
      s.appendChild(svg('text', { x: OX + 8, y: OY + 32, 'class': 'gv-va-strong' }, 'Referenzpunkt'));

      // Kurven
      var sym = svg('path', { 'class': 'gv-va-sym', d: path(1, -XMAX, 0) });
      var cg = svg('path', { 'class': 'gv-va-cg', d: path(1, 0, XMAX) });
      var cl = svg('path', { 'class': 'gv-va-cl' });
      var gG = svg('line', { 'class': 'gv-va-guide', stroke: 'var(--gv-g)' });
      var gL = svg('line', { 'class': 'gv-va-guide', stroke: 'var(--gv-c)' });
      var dG = svg('circle', { 'class': 'gv-va-dotg', r: 6 });
      var dL = svg('circle', { 'class': 'gv-va-dotl', r: 6 });
      var tG = svg('text', { 'class': 'gv-va-strong' });
      var tL = svg('text', { 'class': 'gv-va-strong', 'text-anchor': 'end' });
      var tS = svg('text', { x: 24, y: Y(sv(-XMAX, 1)) + 18 }, 'symmetrisch (λ = 1)');
      [sym, cg, cl, gG, gL, dG, dL, tG, tL, tS].forEach(function (n) { s.appendChild(n); });
      root.appendChild(s);

      // Regler
      var ctrl = h('div', { 'class': 'gv-va-ctrl' });
      var r1 = h('div', { 'class': 'gv-va-row' });
      var l1 = h('label', { 'for': id + '-lam' });
      l1.appendChild(h('span', null, 'Verlustaversions-Faktor λ'));
      var o1 = h('output', { 'for': id + '-lam' });
      l1.appendChild(o1);
      var i1 = h('input', { type: 'range', id: id + '-lam', min: '1', max: '3', step: '0.05', value: '2.25', 'aria-describedby': id + '-lh' });
      r1.appendChild(l1); r1.appendChild(i1);
      r1.appendChild(h('p', { 'class': 'gv-va-hint', id: id + '-lh' }, '2,25 ist ein häufig zitierter Schätzwert aus Tversky & Kahneman (1992). Je nach Studie schwankt er stark; bei λ = 1 wären Gewinn und Verlust gleich schwer.'));

      var r2 = h('div', { 'class': 'gv-va-row' });
      var l2 = h('label', { 'for': id + '-amt' });
      l2.appendChild(h('span', null, 'Betrag'));
      var o2 = h('output', { 'for': id + '-amt' });
      l2.appendChild(o2);
      var i2 = h('input', { type: 'range', id: id + '-amt', min: '10', max: '150', step: '10', value: '100' });
      r2.appendChild(l2); r2.appendChild(i2);

      var bars = h('div', { 'class': 'gv-va-bars' });
      function bar(cls, label) {
        var row = h('div', { 'class': 'gv-va-bar' });
        row.appendChild(h('span', null, label));
        var tr = h('div', { 'class': 'gv-va-track', 'aria-hidden': 'true' });
        var fl = h('div', { 'class': 'gv-va-fill ' + cls });
        tr.appendChild(fl); row.appendChild(tr); bars.appendChild(row);
        return fl;
      }
      var fG = bar('g', 'empfundener Gewinn');
      var fL = bar('l', 'empfundener Verlust');
      var ratio = h('p', { 'class': 'gv-va-ratio', 'aria-live': 'polite' });
      ctrl.appendChild(r1); ctrl.appendChild(r2); ctrl.appendChild(bars); ctrl.appendChild(ratio);
      root.appendChild(ctrl);

      // Münzwurf
      var coin = h('div', { 'class': 'gv-va-coin' });
      coin.appendChild(h('h4', null, 'Münzwurf'));
      coin.appendChild(h('p', null, 'Kopf gewinnst du 110 €, Zahl verlierst du 100 €. Würdest du spielen?'));
      var btns = h('div', { 'class': 'gv-va-btns', role: 'group', 'aria-label': 'Deine Antwort' });
      var bY = h('button', { type: 'button', 'class': 'gv-va-btn', 'aria-pressed': 'false' }, 'Ja, ich würde spielen');
      var bN = h('button', { type: 'button', 'class': 'gv-va-btn', 'aria-pressed': 'false' }, 'Nein, ich würde ablehnen');
      btns.appendChild(bY); btns.appendChild(bN);
      var res = h('div', { 'class': 'gv-va-res', 'aria-live': 'polite', hidden: '' });
      coin.appendChild(btns); coin.appendChild(res);
      root.appendChild(coin);
      container.appendChild(root);

      var answered = null;
      function paintCoin() {
        if (!answered) return;
        var pos = 0.5 * pw(110) - 0.5 * lam * pw(100);
        var be = pw(110) / pw(100);
        res.textContent = '';
        res.appendChild(h('p', null, 'Der Erwartungswert ist positiv: im Schnitt +5 € pro Wurf (0,5 · 110 − 0,5 · 100). Viele lehnen trotzdem ab, weil der mögliche Verlust schwerer wiegt als der mögliche Gewinn. Beides ist keine Dummheit: Wer nur einmal spielt, trägt das Risiko auch wirklich.'));
        res.appendChild(h('p', null, 'Im Modell (schematisch, mit deinem λ = ' + f1(lam) + '): Das Gefühl des Ganzen liegt ' + (pos < 0 ? 'unter null, die Wette wirkt also unattraktiv' : 'über null, die Wette wirkt also attraktiv') + '. Die Wette kippt bei etwa λ = ' + f1(be) + '.'));
      }
      function pick(v) {
        answered = v;
        bY.setAttribute('aria-pressed', v === 'y' ? 'true' : 'false');
        bN.setAttribute('aria-pressed', v === 'n' ? 'true' : 'false');
        res.hidden = false; paintCoin();
      }
      bY.addEventListener('click', function () { pick('y'); });
      bN.addEventListener('click', function () { pick('n'); });

      function update() {
        lam = parseFloat(i1.value); amt = parseFloat(i2.value);
        o1.textContent = 'λ = ' + f1(lam);
        o2.textContent = '±' + f0(amt) + ' €';
        cl.setAttribute('d', path(lam, -XMAX, 0));
        var vg = sv(amt, lam), vl = sv(-amt, lam);
        dG.setAttribute('cx', X(amt)); dG.setAttribute('cy', Y(vg));
        dL.setAttribute('cx', X(-amt)); dL.setAttribute('cy', Y(vl));
        gG.setAttribute('x1', X(amt)); gG.setAttribute('x2', X(amt)); gG.setAttribute('y1', OY); gG.setAttribute('y2', Y(vg));
        gL.setAttribute('x1', X(-amt)); gL.setAttribute('x2', X(-amt)); gL.setAttribute('y1', OY); gL.setAttribute('y2', Y(vl));
        tG.setAttribute('x', X(amt) - 10); tG.setAttribute('y', Y(vg) - 10); tG.setAttribute('text-anchor', 'end');
        tG.textContent = '+' + f0(amt) + ' €';
        tL.setAttribute('x', X(-amt) + 10); tL.setAttribute('y', Y(vl) + 20); tL.setAttribute('text-anchor', 'start');
        tL.textContent = '−' + f0(amt) + ' €';
        var mx = pw(150) * 3;
        fG.style.width = (pw(amt) / mx * 100) + '%';
        fL.style.width = (lam * pw(amt) / mx * 100) + '%';
        var rt = f1(lam);
        ratio.textContent = (lam <= 1.001)
          ? 'Bei λ = 1 wiegen +' + f0(amt) + ' € und −' + f0(amt) + ' € gleich schwer.'
          : '−' + f0(amt) + ' € wiegen im Modell ' + rt + '-mal so schwer wie +' + f0(amt) + ' €. Dieses Verhältnis ist hier für jeden Betrag gleich; der Betrag ändert nur, wie groß beide Balken sind.';
        desc.textContent = 'Bei plus ' + f0(amt) + ' Euro liegt der subjektive Wert bei ' + f0(vg) + ', bei minus ' + f0(amt) + ' Euro bei ' + f0(vl) + ' (Modelleinheiten, Faktor ' + rt + ').';
        paintCoin();
      }
      i1.addEventListener('input', update);
      i2.addEventListener('input', update);
      update();

      return function destroy() {
        i1.removeEventListener('input', update);
        i2.removeEventListener('input', update);
        if (root.parentNode) root.parentNode.removeChild(root);
      };
    }
  };
})();

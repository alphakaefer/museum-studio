/* ==========================================================================
   Gehirnmuseum – js/visuals/beck.js
   Abbildung zur Station "beck": das kognitive Modell als Diagramm mit Rückkopplung.
   Situation -> automatischer Gedanke -> Gefühl / Körper / Verhalten -> (zurück zum Gedanken)
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  M.visuals = M.visuals || {};

  var SID = 'beck';
  var NS = 'http://www.w3.org/2000/svg';

  var SITUATIONS = [
    {
      id: 'gruss', short: 'Kollegin grüßt nicht zurück',
      text: 'Du grüßt im Flur eine Kollegin. Sie geht grußlos vorbei.',
      bad: {
        thought: '„Sie kann mich nicht leiden. Ich habe bestimmt etwas falsch gemacht.“',
        errors: [{ name: 'Gedankenlesen', hint: 'Man glaubt zu wissen, was ein anderer denkt, ohne nachzufragen.' }],
        feel: 'Verunsichert, gekränkt',
        body: 'Enge in der Brust, Anspannung im Magen',
        act: 'Weicht ihr aus und grüßt beim nächsten Mal selbst nicht',
        loop: 'Wer ausweicht, bekommt keine neuen Hinweise. Der Gedanke bleibt ungeprüft und fühlt sich mit jeder Begegnung „bestätigter“ an.'
      },
      alt: {
        thought: '„Sie war wohl in Gedanken oder hat mich nicht gehört.“',
        errors: [{ name: 'Gedanke als Hypothese', hint: 'Eine mögliche Erklärung unter mehreren, die sich prüfen lässt.' }],
        feel: 'Kurz irritiert, dann gelassen',
        body: 'Schultern bleiben locker, Atmung ruhig',
        act: 'Grüßt beim nächsten Mal wieder oder spricht sie beiläufig an',
        loop: 'Der nächste Kontakt liefert neue Hinweise. Der Gedanke darf sich daran korrigieren, in beide Richtungen.'
      }
    },
    {
      id: 'nachricht', short: 'Nachricht bleibt unbeantwortet',
      text: 'Du hast heute Morgen eine Nachricht geschickt. Es ist Abend und noch keine Antwort da.',
      bad: {
        thought: '„Er ist sauer auf mich. Das war’s jetzt mit uns.“',
        errors: [
          { name: 'Katastrophisieren', hint: 'Das schlimmste mögliche Ende wird als das wahrscheinliche behandelt.' },
          { name: 'Gedankenlesen', hint: 'Man glaubt zu wissen, was ein anderer denkt, ohne nachzufragen.' }
        ],
        feel: 'Angst, Unruhe',
        body: 'Herzklopfen, Unruhe in den Händen',
        act: 'Schaut ständig aufs Handy und schickt noch eine Nachricht hinterher',
        loop: 'Das ständige Nachsehen hält die Sorge wach. Jede leere Anzeige wirkt wie ein weiterer Beleg.'
      },
      alt: {
        thought: '„Vielleicht ist er einfach beschäftigt oder hat das Handy nicht dabei.“',
        errors: [{ name: 'Gedanke als Hypothese', hint: 'Eine mögliche Erklärung unter mehreren, die sich prüfen lässt.' }],
        feel: 'Etwas ungeduldig, aber ruhig',
        body: 'Puls bleibt ruhig, Aufmerksamkeit ist frei',
        act: 'Legt das Handy weg und macht mit dem Abend weiter',
        loop: 'Die freie Aufmerksamkeit lässt die Sache offen. Kommt die Antwort, kann der Gedanke an ihr geprüft werden.'
      }
    },
    {
      id: 'praesi', short: 'Präsentation steht an',
      text: 'Morgen früh sollst du vor dem Team eine Präsentation halten.',
      bad: {
        thought: '„Ich blamiere mich. Alle merken, dass ich es nicht kann.“',
        errors: [
          { name: 'Katastrophisieren', hint: 'Das schlimmste mögliche Ende wird als das wahrscheinliche behandelt.' },
          { name: 'Gedankenlesen', hint: 'Man glaubt zu wissen, was andere denken, ohne nachzufragen.' }
        ],
        feel: 'Angst, Anspannung',
        body: 'Herzklopfen, feuchte Hände, flache Atmung',
        act: 'Grübelt bis spät, schiebt das Üben auf oder übt endlos',
        loop: 'Grübeln und Aufschieben liefern keine Erfahrung, dass es auch gut gehen kann. Die Befürchtung bleibt unwidersprochen.'
      },
      alt: {
        thought: '„Ich bin gut genug vorbereitet. Ein paar Wackler sind normal.“',
        errors: [{ name: 'Gedanke als Hypothese', hint: 'Eine mögliche Erklärung unter mehreren, die sich prüfen lässt.' }],
        feel: 'Aufgeregt, aber konzentriert',
        body: 'Kribbeln, Aufregung, die sich als Energie nutzen lässt',
        act: 'Übt einmal laut durch und geht dann schlafen',
        loop: 'Wenn es gut genug lief, wird diese Erfahrung zum Gegenbeleg für die nächste Befürchtung.'
      }
    }
  ];

  var PATHS = {
    bad: { label: 'Ungünstige Deutung', cls: 'bad', tag: 'Ungünstiger Pfad' },
    alt: { label: 'Alternative Deutung', cls: 'alt', tag: 'Alternativer Pfad' }
  };

  var CSS = [
    '.gv-bk{--gv-bk-bad:var(--j-verzerrung,#E0573B);--gv-bk-alt:var(--j-kvt,var(--accent,#2A7AB0));',
    '  --gv-bk-path:var(--gv-bk-bad);color:var(--ink,#1B2230);font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);',
    '  font-size:.94rem;line-height:1.45;max-width:100%;min-width:0}',
    '.gv-bk[data-path="alt"]{--gv-bk-path:var(--gv-bk-alt)}',
    '.gv-bk *{box-sizing:border-box}',
    '.gv-bk-ctl{border:0;margin:0 0 .7rem;padding:0;min-width:0}',
    '.gv-bk-ctl legend{padding:0;margin:0 0 .35rem;font-size:.74rem;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-2,#5C6577);font-weight:600}',
    '.gv-bk-opts{display:flex;flex-wrap:wrap;gap:.45rem}',
    '.gv-bk-opt{position:relative;flex:1 1 9.5rem;min-width:0}',
    '.gv-bk-opt input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.gv-bk-opt span{display:flex;align-items:center;justify-content:center;gap:.5rem;text-align:center;min-height:44px;padding:.4rem .8rem;',
    '  border:1.5px solid var(--line,#D9D2C3);border-radius:12px;background:var(--bg-2,#fff);color:var(--ink,#1B2230);font-weight:500;line-height:1.25;transition:background .2s,border-color .2s,box-shadow .2s}',
    '.gv-bk-opt input:hover+span{border-color:var(--jc,var(--accent,#05749E))}',
    '.gv-bk-opt input:checked+span{border-color:var(--jc,var(--accent,#05749E));background:color-mix(in srgb,var(--jc,var(--accent,#05749E)) 14%,var(--bg-2,#fff));font-weight:650}',
    '.gv-bk-opt.is-bad input:checked+span{border-color:var(--gv-bk-bad);background:color-mix(in srgb,var(--gv-bk-bad) 14%,var(--bg-2,#fff))}',
    '.gv-bk-opt.is-alt input:checked+span{border-color:var(--gv-bk-alt);background:color-mix(in srgb,var(--gv-bk-alt) 14%,var(--bg-2,#fff))}',
    '.gv-bk-opt input:focus-visible+span{outline:3px solid var(--accent,#05749E);outline-offset:2px}',
    '.gv-bk-dot{width:.7rem;height:.7rem;border-radius:50%;flex:none;border:2px solid currentColor}',
    '.gv-bk-opt.is-bad .gv-bk-dot{color:var(--gv-bk-bad)}.gv-bk-opt.is-alt .gv-bk-dot{color:var(--gv-bk-alt)}',
    '.gv-bk-opt input:checked+span .gv-bk-dot{background:currentColor}',

    '.gv-bk-wrap{position:relative;margin-top:.9rem}',
    '.gv-bk-stage{display:grid;grid-template-columns:minmax(0,1fr) 34px;margin:0;padding:0;list-style:none}',
    '.gv-bk-stage>li{grid-column:1;min-width:0}',
    '.gv-bk-svg{position:absolute;top:0;right:0;width:34px;height:100%;overflow:visible;pointer-events:none}',
    '.gv-bk-card{border:1.5px solid var(--line,#D9D2C3);border-radius:12px;background:var(--bg-2,#fff);padding:.65rem .85rem;min-width:0;overflow-wrap:anywhere}',
    '.gv-bk-k{display:block;font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;font-weight:650;color:var(--ink-2,#5C6577);margin-bottom:.15rem}',
    '.gv-bk-sit{background:var(--bg-3,#ECE6DA);border-style:dashed}',
    '.gv-bk-sit .gv-bk-v{font-weight:600}',
    '.gv-bk-thought{border-color:var(--gv-bk-path);border-width:2px;background:color-mix(in srgb,var(--gv-bk-path) 8%,var(--bg-2,#fff));transition:border-color .3s,background .3s}',
    '.gv-bk-thought .gv-bk-k{color:color-mix(in srgb,var(--gv-bk-path) 62%,var(--ink,#1B2230))}',
    '.gv-bk-thought .gv-bk-v{font-family:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif);font-size:1.1rem;line-height:1.35;font-style:italic}',
    '.gv-bk-errs{display:flex;flex-direction:column;gap:.3rem;margin-top:.5rem;padding:0;list-style:none}',
    '.gv-bk-err{font-size:.84rem;color:var(--ink-2,#5C6577)}',
    '.gv-bk-err b{display:inline-block;margin-right:.4rem;padding:.05rem .55rem;border-radius:999px;border:1.5px solid var(--gv-bk-path);',
    '  color:color-mix(in srgb,var(--gv-bk-path) 60%,var(--ink,#1B2230));font-weight:650;font-size:.8rem;background:var(--bg-2,#fff)}',
    '.gv-bk-arr{display:flex;justify-content:center;height:30px;color:var(--gv-bk-path);transition:color .3s}',
    '.gv-bk-arr svg{height:100%;width:18px;overflow:visible}',
    '.gv-bk-trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.55rem;margin:0;padding:0;list-style:none}',
    '.gv-bk-trio .gv-bk-card{border-top:3px solid var(--gv-bk-path);transition:border-color .3s}',
    '.gv-bk-loopnote{margin-top:.8rem;padding:.6rem .85rem;border-left:4px solid var(--gv-bk-path);background:var(--bg-3,#ECE6DA);border-radius:0 10px 10px 0;transition:border-color .3s}',
    '.gv-bk-loopnote .gv-bk-k{color:color-mix(in srgb,var(--gv-bk-path) 62%,var(--ink,#1B2230))}',
    '.gv-bk-legend{margin:.8rem 0 0;font-size:.82rem;color:var(--ink-2,#5C6577);line-height:1.5}',
    '.gv-bk-lg{margin:0 0 .2rem;font-family:inherit;font-size:inherit}.gv-bk-lg:first-letter{font-size:inherit;float:none;line-height:inherit;font-weight:inherit;color:inherit;padding:0;margin:0}',
    '.gv-bk-trio>li{display:flex}.gv-bk-trio>li>.gv-bk-card{flex:1}',
    '.gv-bk-legend strong{color:var(--ink,#1B2230);font-weight:600}',
    '.gv-bk-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',

    /* Animation: Elemente blenden der Reihe nach ein */
    '.gv-bk-step{opacity:0;transform:translateY(6px);transition:opacity .45s ease var(--d,0s),transform .45s ease var(--d,0s),border-color .3s,background .3s}',
    '.gv-bk.is-in .gv-bk-step{opacity:1;transform:none}',
    '.gv-bk-loopline{fill:none;stroke:var(--gv-bk-path);stroke-width:2.5;stroke-dasharray:1;stroke-dashoffset:1;stroke-linecap:round;stroke-linejoin:round;transition:stroke-dashoffset .9s ease 1.55s,stroke .3s}',
    '.gv-bk-loophead{fill:var(--gv-bk-path);opacity:0;transition:opacity .3s ease 2.3s,fill .3s}',
    '.gv-bk.is-in .gv-bk-loopline{stroke-dashoffset:0}',
    '.gv-bk.is-in .gv-bk-loophead{opacity:1}',

    '@media (max-width:540px){',
    '  .gv-bk-trio{grid-template-columns:minmax(0,1fr)}',
    '  .gv-bk-opt{flex-basis:100%}',
    '  .gv-bk-stage{grid-template-columns:minmax(0,1fr) 26px}',
    '  .gv-bk-svg{width:26px}',
    '}',
    '@media (prefers-reduced-motion:reduce){',
    '  .gv-bk-step,.gv-bk-loopline,.gv-bk-loophead,.gv-bk-opt span{transition:none!important}',
    '  .gv-bk-step{opacity:1;transform:none}',
    '  .gv-bk-loopline{stroke-dashoffset:0}.gv-bk-loophead{opacity:1}',
    '}'
  ].join('\n');

  function injectStyle() {
    if (document.head.querySelector('style[data-gv="' + SID + '"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gv', SID);
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function sv(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function arrow() {
    var s = sv('svg', { viewBox: '0 0 18 30', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(sv('path', { d: 'M9 1V22', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round' }));
    s.appendChild(sv('path', { d: 'M2.5 19L9 28L15.5 19Z', fill: 'currentColor' }));
    return s;
  }

  var uidCounter = 0;

  function mount(container) {
    injectStyle();
    uidCounter++;
    var uid = 'gv-bk-' + uidCounter;
    var state = { s: 0, p: 'bad' };
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var root = h('div', { class: 'gv-bk', 'data-path': 'bad' });

    /* ---- Auswahl ---- */
    var fsS = h('fieldset', { class: 'gv-bk-ctl' }, [h('legend', { text: '1 · Wähle eine Situation' })]);
    var optsS = h('div', { class: 'gv-bk-opts' });
    SITUATIONS.forEach(function (sit, i) {
      var inp = h('input', { type: 'radio', name: uid + '-sit', value: String(i) });
      if (i === 0) inp.checked = true;
      inp.addEventListener('change', function () { state.s = i; update(true); });
      optsS.appendChild(h('label', { class: 'gv-bk-opt' }, [inp, h('span', { text: sit.short })]));
    });
    fsS.appendChild(optsS);

    var fsP = h('fieldset', { class: 'gv-bk-ctl' }, [h('legend', { text: '2 · Wähle eine Deutung des Auslösers' })]);
    var optsP = h('div', { class: 'gv-bk-opts' });
    ['bad', 'alt'].forEach(function (key) {
      var inp = h('input', { type: 'radio', name: uid + '-path', value: key });
      if (key === 'bad') inp.checked = true;
      inp.addEventListener('change', function () { state.p = key; update(true); });
      optsP.appendChild(h('label', { class: 'gv-bk-opt is-' + key }, [inp, h('span', null, [h('i', { class: 'gv-bk-dot', 'aria-hidden': 'true' }), document.createTextNode(PATHS[key].label)])]));
    });
    fsP.appendChild(optsP);

    /* ---- Diagramm (semantisch eine Liste, Pfeile ausgeblendet) ---- */
    var vSit = h('span', { class: 'gv-bk-v' });
    var vThought = h('span', { class: 'gv-bk-v' });
    var errs = h('ul', { class: 'gv-bk-errs' });
    var vFeel = h('span', { class: 'gv-bk-v' });
    var vBody = h('span', { class: 'gv-bk-v' });
    var vAct = h('span', { class: 'gv-bk-v' });
    var vLoop = h('span', { class: 'gv-bk-v' });

    function step(el, d) { el.classList.add('gv-bk-step'); el.style.setProperty('--d', d + 's'); return el; }
    function card(k, v, extra, d) {
      return step(h('li', { class: 'gv-bk-card' + (extra ? ' ' + extra : '') }, [h('span', { class: 'gv-bk-k', text: k }), v]), d);
    }
    function arr(d) { var li = h('li', { class: 'gv-bk-arr', 'aria-hidden': 'true' }, [arrow()]); return step(li, d); }

    var liSit = card('Situation (Auslöser)', vSit, 'gv-bk-sit', 0);
    var thoughtCard = card('Automatischer Gedanke', vThought, 'gv-bk-thought', 0.35);
    thoughtCard.appendChild(errs);
    var feelCard = h('div', { class: 'gv-bk-card' }, [h('span', { class: 'gv-bk-k', text: 'Gefühl' }), vFeel]);
    var bodyCard = h('div', { class: 'gv-bk-card' }, [h('span', { class: 'gv-bk-k', text: 'Körper' }), vBody]);
    var actCard = h('div', { class: 'gv-bk-card' }, [h('span', { class: 'gv-bk-k', text: 'Verhalten' }), vAct]);
    step(feelCard, 0.95); step(bodyCard, 1.1); step(actCard, 1.25);
    var trio = h('ul', { class: 'gv-bk-trio' }, [
      h('li', null, [feelCard]), h('li', null, [bodyCard]), h('li', null, [actCard])
    ]);
    trio.style.cssText = '';
    var liTrio = h('li', null, [trio]);

    var stage = h('ol', { class: 'gv-bk-stage', 'aria-label': 'Kognitives Modell: Situation, automatischer Gedanke, Gefühl, Körperreaktion und Verhalten, mit Rückkopplung zum Gedanken' }, [
      liSit, arr(0.2), thoughtCard, arr(0.75), liTrio
    ]);

    var svg = sv('svg', { class: 'gv-bk-svg', 'aria-hidden': 'true', focusable: 'false' });
    var loopLine = sv('path', { class: 'gv-bk-loopline', pathLength: '1', d: 'M0 0' });
    var loopHead = sv('path', { class: 'gv-bk-loophead', d: 'M0 0' });
    svg.appendChild(loopLine); svg.appendChild(loopHead);
    var wrap = h('div', { class: 'gv-bk-wrap' }, [stage, svg]);

    var loopNote = step(h('div', { class: 'gv-bk-loopnote' }, [h('span', { class: 'gv-bk-k', text: 'Rückkopplung' }), vLoop]), 1.9);

    var legend = h('div', { class: 'gv-bk-legend' }, [
      h('div', { class: 'gv-bk-lg' }, [h('strong', { text: 'Das Modell ist eine Vereinfachung; ' }), document.createTextNode('Gefühle und Gedanken beeinflussen sich wechselseitig.')]),
      h('div', { class: 'gv-bk-lg', text: 'Die Situationen sind erfundene Alltagsbeispiele, keine Messdaten. Bildungs-Illustration, kein Ersatz für Therapie.' })
    ]);

    var live = h('div', { class: 'gv-bk-sr', role: 'status', 'aria-live': 'polite' });

    root.appendChild(fsS); root.appendChild(fsP);
    root.appendChild(wrap); root.appendChild(loopNote); root.appendChild(legend); root.appendChild(live);
    container.appendChild(root);

    /* ---- Rückkopplungsschleife: Pfad aus echter Layout-Geometrie ---- */
    function drawLoop() {
      var sr = stage.getBoundingClientRect();
      var tr = thoughtCard.getBoundingClientRect();
      var ar = actCard.getBoundingClientRect();
      if (!sr.width || !tr.height) return;
      var w = svg.getBoundingClientRect().width || 34;
      var left = sr.right - w;
      var x0 = ar.right - left;
      var yT = tr.top + tr.height / 2 - sr.top;
      var yA = ar.top + ar.height / 2 - sr.top;
      var xm = Math.max(x0 + 12, w - 6);
      var xt = tr.right - left;
      var hd = 9;
      loopLine.setAttribute('d', 'M' + x0 + ' ' + yA + 'H' + xm + 'V' + yT + 'H' + (xt + hd - 1));
      loopHead.setAttribute('d', 'M' + xt + ' ' + yT + 'L' + (xt + hd + 1) + ' ' + (yT - 6) + 'L' + (xt + hd + 1) + ' ' + (yT + 6) + 'Z');
    }

    var raf = 0, timers = [];
    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); }

    function fill() {
      var sit = SITUATIONS[state.s];
      var d = sit[state.p];
      root.setAttribute('data-path', state.p);
      vSit.textContent = sit.text;
      vThought.textContent = d.thought;
      errs.textContent = '';
      d.errors.forEach(function (e) {
        errs.appendChild(h('li', { class: 'gv-bk-err' }, [h('b', { text: e.name }), document.createTextNode(e.hint)]));
      });
      vFeel.textContent = d.feel;
      vBody.textContent = d.body;
      vAct.textContent = d.act;
      vLoop.textContent = d.loop;
      stage.setAttribute('data-path', state.p);
      live.textContent = PATHS[state.p].tag + ' bei „' + sit.short + '“. Gedanke: ' + d.thought.replace(/[„“]/g, '') +
        ' Gefühl: ' + d.feel + '. Körper: ' + d.body + '. Verhalten: ' + d.act + '. Rückkopplung: ' + d.loop;
    }

    function update(animate) {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout); timers = [];
      if (animate && !reduce) {
        root.classList.remove('is-in');
        void root.offsetWidth;
        fill();
        raf = requestAnimationFrame(function () { drawLoop(); void root.offsetWidth; root.classList.add('is-in'); });
      } else {
        fill();
        root.classList.add('is-in');
        raf = requestAnimationFrame(drawLoop);
      }
      later(drawLoop, 60);
    }

    update(false);
    if (!reduce) {
      root.classList.remove('is-in');
      raf = requestAnimationFrame(function () { raf = requestAnimationFrame(function () { drawLoop(); root.classList.add('is-in'); }); });
    }

    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { drawLoop(); });
      ro.observe(stage);
    }
    window.addEventListener('resize', drawLoop);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLoop);

    return function destroy() {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', drawLoop);
      if (ro) ro.disconnect();
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  M.visuals[SID] = {
    alt: 'Diagramm des kognitiven Modells: Eine Situation löst einen automatischen Gedanken aus, daraus entstehen Gefühl, Körperreaktion und Verhalten, und das Verhalten wirkt über eine Rückkopplungsschleife auf den Gedanken zurück. Du wählst eine von drei Alltagssituationen und eine ungünstige oder alternative Deutung und siehst, wie derselbe Auslöser zu anderen Folgen führt.',
    caption: 'Schematisch nach dem kognitiven Modell von A. T. Beck (1960er/1976). Dieselbe Situation, andere Deutung, andere Folgen; die Beispiele sind erfundene Alltagsszenen.',
    mount: mount
  };
})();

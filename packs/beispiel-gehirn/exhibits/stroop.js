/* Gehirnmuseum – Exponat „Stroop-Test“
 * MUSEUM.exhibits.stroop = { title, blurb, mount(container, ctx) -> destroy() }
 * Klassisches Script, keine Abhängigkeiten, keine externen Requests, nichts wird gespeichert oder gesendet.
 */
(function () {
  'use strict';

  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.exhibits = M.exhibits || {};

  /* ------------------------------------------------------------------ *
   * Konstanten
   * ------------------------------------------------------------------ */

  // Reizfarben: bewusst feste Werte (sie sind der Versuchsreiz, keine Gestaltung).
  // Die Bühne ist immer dunkel („Vitrine“), damit alle vier Farben in Hell- und Dunkelmodus gleich gut lesbar sind.
  var COLORS = [
    { id: 'rot',   label: 'Rot',  word: 'ROT',  hex: '#FF5C4D' },
    { id: 'blau',  label: 'Blau', word: 'BLAU', hex: '#4BA8FF' },
    { id: 'gruen', label: 'Grün', word: 'GRÜN', hex: '#3FD68A' },
    { id: 'gelb',  label: 'Gelb', word: 'GELB', hex: '#FFD43B' }
  ];

  var PRACTICE_N = 4;    // Probedurchgänge (zählen nicht)
  var MAIN_N = 24;       // gewertete Durchgänge: 12 kongruent, 12 inkongruent
  var MIN_RT = 150;      // schneller = Vorschuss (vor der Verarbeitung geraten), wird nicht gewertet
  var MAX_RT = 3000;     // langsamer = Unterbrechung/Ablenkung, wird nicht gewertet
  var uid = 0;           // eindeutige IDs je Instanz
  var activeKeys = null; // nur die zuletzt gestartete Instanz reagiert auf die Tasten 1–4
  var MIN_VALID = 5;     // gültige Durchgänge je Bedingung, damit ein Effekt berechnet wird

  /* ------------------------------------------------------------------ *
   * Kleine lokale Helfer
   * ------------------------------------------------------------------ */

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

  function rand(n) { return Math.floor(Math.random() * n); }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function mean(a) {
    if (!a.length) return NaN;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }

  function num(n) {
    n = Math.round(n);
    try { return n.toLocaleString('de-DE'); } catch (e) { return String(n); }
  }

  function ms(n) { return num(n) + ' ms'; }

  function signed(n) {
    n = Math.round(n);
    return (n > 0 ? '+' : n < 0 ? '−' : '±') + num(Math.abs(n)) + ' ms';
  }

  /* ------------------------------------------------------------------ *
   * Durchgänge erzeugen
   * ------------------------------------------------------------------ */

  // Ordnet Durchgänge so, dass aufeinanderfolgende Durchgänge weder dasselbe Wort noch dieselbe
  // Schriftfarbe haben und nie mehr als drei gleiche Bedingungen hintereinander kommen.
  function orderTrials(pool) {
    for (var attempt = 0; attempt < 400; attempt++) {
      var rest = pool.slice(), out = [], ok = true;
      while (rest.length) {
        var p1 = out[out.length - 1], p2 = out[out.length - 2], p3 = out[out.length - 3];
        var cand = [];
        for (var i = 0; i < rest.length; i++) {
          var t = rest[i];
          if (p1 && (t.w === p1.w || t.c === p1.c)) continue;
          if (p1 && p2 && p3 && t.cong === p1.cong && t.cong === p2.cong && t.cong === p3.cong) continue;
          cand.push(i);
        }
        if (!cand.length) { ok = false; break; }
        out.push(rest.splice(cand[rand(cand.length)], 1)[0]);
      }
      if (ok) return out;
    }
    return shuffle(pool);
  }

  function buildTrials(mode) {
    var pool = [], w, c;
    if (mode === 'main') {
      // 4 Farben x 3 = 12 kongruent; 4 Wörter x 3 andere Farben = 12 inkongruent (jede Kombination genau einmal)
      for (w = 0; w < COLORS.length; w++) {
        for (c = 0; c < COLORS.length; c++) {
          if (w === c) { for (var k = 0; k < 3; k++) pool.push({ w: w, c: c, cong: true }); }
          else pool.push({ w: w, c: c, cong: false });
        }
      }
    } else {
      var idx = shuffle([0, 1, 2, 3]);
      pool.push({ w: idx[0], c: idx[0], cong: true });
      pool.push({ w: idx[1], c: idx[1], cong: true });
      [idx[2], idx[3]].forEach(function (word) {
        var other = (word + 1 + rand(COLORS.length - 1)) % COLORS.length;
        pool.push({ w: word, c: other, cong: false });
      });
    }
    return orderTrials(pool);
  }

  /* ------------------------------------------------------------------ *
   * Styles (einmalig)
   * ------------------------------------------------------------------ */

  function css() {
    return [
      '.gx-stroop,.gx-stroop *{box-sizing:border-box}',
      '.gx-stroop{position:relative;isolation:isolate;max-width:46rem;margin:0 auto 18px;padding:clamp(1rem,3.4vw,1.6rem);',
      'background:var(--bg-2,#FFFFFF);color:var(--ink,#1B2230);border:1px solid var(--line,#D9D2C3);border-radius:var(--radius,14px);',
      'box-shadow:var(--shadow,0 1px 2px rgba(20,25,40,.08),0 8px 24px rgba(20,25,40,.08));',
      'font-family:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);font-size:1rem;line-height:1.55}',
      /* Sockel unter dem Exponat */
      '.gx-stroop::after{content:"";position:absolute;z-index:-1;left:5%;right:5%;bottom:-10px;height:12px;background:var(--bg-3,#ECE6DA);',
      'border:1px solid var(--line,#D9D2C3);border-top:0;border-radius:0 0 12px 12px}',

      '.gx-stroop-plaque{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .75rem;margin:0 0 .9rem;font-size:.72rem;font-weight:600;',
      'letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2,#5C6577)}',
      '.gx-stroop-plaque::before{content:"";width:28px;height:3px;border-radius:2px;background:var(--warm,#FCB300);flex:none}',
      '.gx-stroop-plaque strong{color:var(--ink,#1B2230);font-weight:700}',
      '.gx-stroop-plaque span{letter-spacing:.08em;font-weight:500}',

      '.gx-stroop-lead{margin:0 0 1.1rem;font-family:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif);',
      'font-size:clamp(1.12rem,2.6vw,1.3rem);line-height:1.45;color:var(--ink,#1B2230)}',
      '.gx-stroop-lead em{font-style:normal;font-weight:700;border-bottom:2px solid var(--warm,#FCB300)}',

      '.gx-stroop h3{margin:0 0 .5rem;font-family:var(--font-display,Georgia,serif);font-weight:700;font-size:1.25rem;line-height:1.25;color:var(--ink,#1B2230)}',
      '.gx-stroop h3:focus{outline:none}',
      '.gx-stroop h3:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:3px;border-radius:4px}',
      '.gx-stroop p{margin:0 0 .8rem}',
      '.gx-stroop-muted{color:var(--ink-2,#5C6577)}',
      '.gx-stroop-small{font-size:.875rem}',

      '.gx-stroop-sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',

      /* Panels */
      '.gx-stroop-panel{padding:.25rem 0 .25rem}',
      '.gx-stroop-steps{margin:.25rem 0 1rem;padding:0;list-style:none;counter-reset:gxs;display:grid;gap:.55rem}',
      '.gx-stroop-steps li{counter-increment:gxs;position:relative;padding-left:2.2rem}',
      '.gx-stroop-steps li::before{content:counter(gxs);position:absolute;left:0;top:.05em;width:1.55rem;height:1.55rem;border-radius:50%;',
      'display:grid;place-items:center;font-size:.8rem;font-weight:700;color:var(--ink,#1B2230);background:var(--bg-3,#ECE6DA);border:1px solid var(--line,#D9D2C3)}',

      /* Bühne (Vitrine) */
      '.gx-stroop-stage{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;',
      'min-height:clamp(10.5rem,34vw,13rem);padding:1.25rem 1rem;border-radius:10px;border:1px solid #2C3850;text-align:center;color:#ECE8DF;',
      'background:radial-gradient(ellipse at 50% 30%,#223049 0%,#141C2E 55%,#0B101B 100%);',
      'box-shadow:inset 0 0 0 4px #0B101B,inset 0 0 0 5px rgba(252,179,0,.38),inset 0 12px 30px rgba(0,0,0,.45)}',
      '.gx-stroop-stage--demo{min-height:0;padding:.9rem 1rem .8rem;gap:.15rem}',
      '.gx-stroop-stage:focus{outline:none}',
      '.gx-stroop-stage:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:3px}',
      '.gx-stroop-word{font-family:var(--font-ui,ui-sans-serif,system-ui,sans-serif);font-weight:800;letter-spacing:.06em;line-height:1.1;',
      'font-size:clamp(2.5rem,11.5vw,4.5rem);min-height:1.1em;user-select:none;-webkit-user-select:none}',
      '.gx-stroop-word--fix{color:#6F7C96;font-weight:300;font-size:clamp(2.5rem,10vw,3.5rem)}',
      '.gx-stroop-stage--demo .gx-stroop-word{font-size:2rem;min-height:0}',
      '.gx-stroop-fb{min-height:1.5em;font-size:.95rem;font-weight:600;color:#A3ABBB}',
      '.gx-stroop-fb--ok{color:#57C58A}',
      '.gx-stroop-fb--bad{color:#F5837A}',
      '.gx-stroop-stage--demo .gx-stroop-fb{min-height:0;font-weight:500;font-size:.875rem}',

      /* Kopfzeile Durchlauf */
      '.gx-stroop-runhead{display:flex;flex-wrap:wrap;align-items:center;gap:.4rem .75rem;margin:0 0 .65rem;font-size:.875rem}',
      '.gx-stroop-badge{display:inline-block;padding:.12rem .6rem;border-radius:999px;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;',
      'border:1px solid var(--line,#D9D2C3);background:var(--bg-3,#ECE6DA);color:var(--ink,#1B2230)}',
      '.gx-stroop-badge--main{background:var(--warm,#FCB300);border-color:var(--warm,#FCB300);color:#1B2230}',
      '.gx-stroop-count{color:var(--ink-2,#5C6577);font-variant-numeric:tabular-nums}',
      '.gx-stroop-track{flex:1 1 7rem;height:6px;border-radius:3px;background:var(--bg-3,#ECE6DA);overflow:hidden;border:1px solid var(--line,#D9D2C3)}',
      '.gx-stroop-quit{all:unset;box-sizing:border-box;cursor:pointer;min-height:44px;padding:0 .5rem;display:inline-flex;align-items:center;font:inherit;font-size:.875rem;font-weight:600;',
      'color:var(--ink-2,#5C6577);text-decoration:underline;text-underline-offset:3px}',
      '.gx-stroop-quit:hover{color:var(--ink,#1B2230)}',
      '.gx-stroop-quit:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px;border-radius:4px}',
      '.gx-stroop-fill{display:block;height:100%;width:0;background:var(--accent,#05749E);transition:width .25s ease}',

      /* Antwort-Buttons (Sockel) */
      '.gx-stroop-keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,8.25rem),1fr));gap:.6rem;margin:.75rem 0 0;padding:.7rem;',
      'background:var(--bg-3,#ECE6DA);border:1px solid var(--line,#D9D2C3);border-radius:12px}',
      '.gx-stroop-key{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:.6rem;min-height:56px;padding:.5rem .8rem;cursor:pointer;',
      'background:var(--bg-2,#FFFFFF);color:var(--ink,#1B2230);border:1.5px solid var(--line,#D9D2C3);border-radius:12px;',
      'font-family:inherit;font-size:1.05rem;font-weight:600;touch-action:manipulation;-webkit-tap-highlight-color:transparent;',
      'box-shadow:0 2px 0 var(--line,#D9D2C3);user-select:none;-webkit-user-select:none}',
      '.gx-stroop-key:hover{border-color:var(--accent,#05749E)}',
      '.gx-stroop-key:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px}',
      '.gx-stroop-key:active,.gx-stroop-key--hit{transform:translateY(2px);box-shadow:0 0 0 var(--line,#D9D2C3);border-color:var(--accent,#05749E)}',
      '.gx-stroop-dot{flex:none;width:1.65rem;height:1.65rem;border-radius:50%;border:2px solid var(--ink,#1B2230)}',
      '.gx-stroop-keylabel{flex:1 1 auto}',
      '.gx-stroop-kbd{flex:none;min-width:1.6rem;padding:.05rem .35rem;border-radius:6px;text-align:center;font-size:.8rem;font-weight:700;',
      'color:var(--ink-2,#5C6577);border:1px solid var(--line,#D9D2C3);background:var(--bg-3,#ECE6DA)}',
      '.gx-stroop-keys-hint{margin:.55rem 0 0;font-size:.8125rem;color:var(--ink-2,#5C6577)}',

      /* Vorschau der Farben im Intro */
      '.gx-stroop-legend{display:flex;flex-wrap:wrap;gap:.45rem;margin:.35rem 0 1rem;padding:0;list-style:none}',
      '.gx-stroop-legend li{display:inline-flex;align-items:center;gap:.45rem;padding:.25rem .7rem .25rem .35rem;border-radius:999px;border:1px solid var(--line,#D9D2C3);',
      'background:var(--bg-3,#ECE6DA);font-size:.9rem;font-weight:600}',
      '.gx-stroop-legend .gx-stroop-dot{width:1.2rem;height:1.2rem;border-width:1.5px}',

      /* Buttons */
      '.gx-stroop-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:48px;padding:.6rem 1.4rem;cursor:pointer;',
      'background:var(--ink,#1B2230);color:var(--bg-2,#FFFFFF);border-radius:999px;border-bottom:3px solid var(--warm,#FCB300);',
      'font-family:inherit;font-size:1rem;font-weight:700;letter-spacing:.01em;touch-action:manipulation;-webkit-tap-highlight-color:transparent;text-align:center}',
      '.gx-stroop-btn:hover{filter:brightness(1.12)}',
      '.gx-stroop-btn:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:3px}',
      '.gx-stroop-btn:active{transform:translateY(1px)}',
      '.gx-stroop-cta{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem 1rem;margin-top:.4rem}',

      /* Ergebnis */
      '.gx-stroop-hero{display:grid;gap:.15rem;margin:.4rem 0 1.1rem;padding:.9rem 1rem;border-radius:12px;background:var(--bg-3,#ECE6DA);',
      'border:1px solid var(--line,#D9D2C3);border-left:5px solid var(--warm,#FCB300)}',
      '.gx-stroop-hero-label{font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2,#5C6577)}',
      '.gx-stroop-hero-num{font-family:var(--font-display,Georgia,serif);font-weight:700;font-size:clamp(2.4rem,9vw,3.4rem);line-height:1.05;color:var(--ink,#1B2230);font-variant-numeric:tabular-nums}',
      '.gx-stroop-hero-cap{color:var(--ink-2,#5C6577);font-size:.95rem}',

      '.gx-stroop-cmp{display:grid;gap:.85rem;margin:0 0 1.1rem;padding:0;list-style:none}',
      '.gx-stroop-cmp-row{display:grid;gap:.3rem}',
      '.gx-stroop-cmp-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:.1rem .75rem}',
      '.gx-stroop-cmp-name{font-weight:700}',
      '.gx-stroop-cmp-val{font-weight:700;font-variant-numeric:tabular-nums}',
      '.gx-stroop-cmp-bar{height:16px;border-radius:8px;background:var(--bg-3,#ECE6DA);border:1px solid var(--line,#D9D2C3);overflow:hidden}',
      '.gx-stroop-cmp-fill{display:block;height:100%;border-radius:7px;transition:width .6s ease}',
      '.gx-stroop-cmp-fill--c{background:var(--accent,#05749E)}',
      '.gx-stroop-cmp-fill--i{background:var(--warm,#FCB300)}',
      '.gx-stroop-cmp-sub{font-size:.85rem;color:var(--ink-2,#5C6577)}',

      '.gx-stroop-verdict{margin:0 0 1rem}',

      '.gx-stroop-strip-title{margin:1rem 0 .4rem;font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2,#5C6577)}',
      '.gx-stroop-strip{display:flex;align-items:flex-end;gap:3px;height:104px;padding:.4rem .5rem 0;border-bottom:2px solid var(--line,#D9D2C3)}',
      '.gx-stroop-sbar{flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}',
      '.gx-stroop-sbar-fill{display:block;width:100%;min-height:4px;border-radius:3px 3px 0 0}',
      '.gx-stroop-sbar--c .gx-stroop-sbar-fill{background:var(--accent,#05749E)}',
      '.gx-stroop-sbar--i .gx-stroop-sbar-fill{background:var(--warm,#FCB300)}',
      '.gx-stroop-sbar--err .gx-stroop-sbar-fill{background:transparent;border:2px solid var(--bad,#C0392B);border-bottom:0}',
      '.gx-stroop-sbar--skip .gx-stroop-sbar-fill{background:transparent;border:2px dashed var(--ink-2,#5C6577);border-bottom:0}',
      '.gx-stroop-marks{display:flex;gap:3px;padding:0 .5rem;height:1.2rem;font-size:.75rem;line-height:1.2rem;font-weight:700;color:var(--bad,#C0392B)}',
      '.gx-stroop-marks span{flex:1 1 0;min-width:0;text-align:center}',
      '.gx-stroop-slegend{display:flex;flex-wrap:wrap;gap:.3rem 1rem;margin:.4rem 0 0;padding:0;list-style:none;font-size:.8125rem;color:var(--ink-2,#5C6577)}',
      '.gx-stroop-slegend li{display:inline-flex;align-items:center;gap:.35rem}',
      '.gx-stroop-sw{display:inline-block;width:.9rem;height:.9rem;border-radius:3px;flex:none}',
      '.gx-stroop-sw--c{background:var(--accent,#05749E)}',
      '.gx-stroop-sw--i{background:var(--warm,#FCB300)}',
      '.gx-stroop-sw--err{border:2px solid var(--bad,#C0392B)}',
      '.gx-stroop-sw--skip{border:2px dashed var(--ink-2,#5C6577)}',

      '.gx-stroop-details{margin:1rem 0 0}',
      '.gx-stroop-details summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600;color:var(--ink,#1B2230)}',
      '.gx-stroop-details summary::before{content:"\\25B8";display:inline-block;width:1.2rem;color:var(--ink-2,#5C6577);transition:transform .15s ease}',
      '.gx-stroop-details[open] summary::before{transform:rotate(90deg)}',
      '.gx-stroop-details summary::-webkit-details-marker{display:none}',
      '.gx-stroop-details summary:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px;border-radius:4px}',
      '.gx-stroop-tablewrap{overflow-x:auto;max-width:100%;border:1px solid var(--line,#D9D2C3);border-radius:10px}',
      '.gx-stroop-tablewrap:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px}',
      '.gx-stroop-table{border-collapse:collapse;width:100%;min-width:30rem;font-size:.85rem;font-variant-numeric:tabular-nums}',
      '.gx-stroop-table th,.gx-stroop-table td{padding:.4rem .6rem;text-align:left;border-bottom:1px solid var(--line,#D9D2C3);white-space:nowrap}',
      '.gx-stroop-table th{background:var(--bg-3,#ECE6DA);font-weight:700}',
      '.gx-stroop-table tr:last-child td{border-bottom:0}',

      '.gx-stroop-rounds{margin:.8rem 0 0;font-size:.9rem;color:var(--ink-2,#5C6577)}',

      /* Einordnung */
      '.gx-stroop-note{margin:1.6rem 0 0;padding-top:1.2rem;border-top:1px solid var(--line,#D9D2C3)}',
      '.gx-stroop-limits{margin:.4rem 0 1rem;padding:.85rem 1rem .4rem;border-radius:12px;background:var(--bg-3,#ECE6DA);border:1px solid var(--line,#D9D2C3)}',
      '.gx-stroop-limits h4{margin:0 0 .5rem;font-family:var(--font-ui,sans-serif);font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-2,#5C6577)}',
      '.gx-stroop-limits ul{margin:0;padding:0;list-style:none;display:grid;gap:.6rem}',
      '.gx-stroop-limits li{padding-left:1.1rem;position:relative;font-size:.95rem}',
      '.gx-stroop-limits li::before{content:"";position:absolute;left:0;top:.6em;width:.5rem;height:.5rem;border-radius:50%;background:var(--warm,#FCB300)}',
      '.gx-stroop-limits li strong{font-weight:700}',
      '.gx-stroop-src{margin:0;font-size:.8125rem;color:var(--ink-2,#5C6577)}',

      '@media (max-width:420px){.gx-stroop{padding:.95rem}.gx-stroop-key{font-size:1rem;padding:.45rem .65rem}}',
      '@media (prefers-reduced-motion:reduce){.gx-stroop *,.gx-stroop *::before,.gx-stroop *::after{transition:none!important;animation:none!important}',
      '.gx-stroop-key:active,.gx-stroop-key--hit{transform:none}}'
    ].join('');
  }

  function injectStyles() {
    if (document.head.querySelector('style[data-gx="stroop"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gx', 'stroop');
    s.textContent = css();
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Exponat
   * ------------------------------------------------------------------ */

  function mount(container /*, ctx */) {
    injectStyles();
    container.textContent = '';

    var root = el('div', { class: 'gx-stroop' });
    container.appendChild(root);

    // --- Zustand (lokal zu diesem mount) ---
    var timers = [];
    var raf = 0;
    var keysBound = false;
    var destroyed = false;
    var awaiting = false;
    var t0 = 0;
    var mode = 'practice';
    var trials = [];
    var idx = -1;
    var log = [];
    var rounds = [];
    var ui = {};
    var myId = ++uid;

    // --- Grundgerüst ---
    var live = el('div', { class: 'gx-stroop-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var main = el('div', { class: 'gx-stroop-main' });

    root.appendChild(el('div', { class: 'gx-stroop-plaque' },
      el('strong', { text: 'Exponat · Stroop-Test' }),
      el('span', { text: 'Aufmerksamkeit · Reaktionszeit' })));
    root.appendChild(el('p', { class: 'gx-stroop-lead' },
      'Probier es aus: Benenne die ', el('em', { text: 'Farbe der Schrift' }),
      ' – und ignoriere, was dort steht. Klingt leicht. Gleich siehst du, wie viel Zeit es kostet, wenn das Wort etwas anderes behauptet.'));
    root.appendChild(main);
    root.appendChild(buildNote(myId));
    root.appendChild(live);

    /* ---------------- Hilfen ---------------- */

    function alive() {
      if (destroyed) return false;
      if (!root.isConnected) { destroy(); return false; }
      return true;
    }

    function later(fn, delay) {
      var id = setTimeout(function () {
        var i = timers.indexOf(id);
        if (i >= 0) timers.splice(i, 1);
        if (alive()) fn();
      }, delay);
      timers.push(id);
      return id;
    }

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      awaiting = false;
    }

    function announce(text) {
      live.textContent = '';
      later(function () { live.textContent = text; }, 60);
    }

    function setPanel(node, focusEl, opts) {
      main.textContent = '';
      main.appendChild(node);
      if (focusEl) {
        try { focusEl.focus({ preventScroll: !!(opts && opts.noScroll) }); } catch (e) { /* ältere Browser */ }
      }
    }

    function dot(c) {
      var d = el('span', { class: 'gx-stroop-dot', 'aria-hidden': 'true' });
      d.style.background = c.hex;
      return d;
    }

    /* ---------------- Intro ---------------- */

    function showIntro(focusTitle) {
      clearTimers();
      unbindKeys();
      var demo = el('div', { class: 'gx-stroop-stage gx-stroop-stage--demo', role: 'img',
        'aria-label': 'Beispiel: das Wort BLAU ist in roter Schrift gedruckt. Richtig wäre Rot, Taste 1.' });
      var dw = el('div', { class: 'gx-stroop-word', 'aria-hidden': 'true', text: 'BLAU' });
      dw.style.color = COLORS[0].hex;
      demo.appendChild(dw);
      demo.appendChild(el('div', { class: 'gx-stroop-fb', 'aria-hidden': 'true', text: 'Beispiel: Hier ist „Rot“ richtig (Taste 1).' }));

      var legend = el('ul', { class: 'gx-stroop-legend', 'aria-label': 'Farben und Tasten' },
        COLORS.map(function (c, i) {
          return el('li', null, dot(c), (i + 1) + ' · ' + c.label);
        }));

      var title = el('h3', { tabindex: '-1', text: 'So läuft es ab' });
      var start = el('button', { class: 'gx-stroop-btn', type: 'button', on: { click: function () { startBlock('practice'); } } },
        'Probelauf starten');

      var panel = el('div', { class: 'gx-stroop-panel' },
        title,
        el('ol', { class: 'gx-stroop-steps' },
          el('li', null, 'Ein Farbwort erscheint, zum Beispiel ROT.'),
          el('li', null, 'Du wählst die Farbe, in der das Wort gedruckt ist – nicht das, was es bedeutet.'),
          el('li', null, 'Antworte per Klick, Tipp oder mit den Tasten 1–4. So schnell du kannst, aber möglichst ohne Fehler.')),
        demo,
        el('p', { class: 'gx-stroop-muted gx-stroop-small', style: 'margin-top:.9rem;margin-bottom:.3rem' },
          'Jede Farbe steht auch als Text auf ihrem Button:'),
        legend,
        el('div', { class: 'gx-stroop-cta' },
          start,
          el('span', { class: 'gx-stroop-muted gx-stroop-small',
            text: PRACTICE_N + ' Probe-Durchgänge, danach ' + MAIN_N + ' gewertete · etwa eine Minute' })));
      setPanel(panel, focusTitle === true ? title : null);
    }

    /* ---------------- Durchlauf ---------------- */

    function buildRun() {
      ui.badge = el('span', {
        class: 'gx-stroop-badge' + (mode === 'main' ? ' gx-stroop-badge--main' : ''),
        text: mode === 'main' ? 'Gewertet' : 'Probelauf'
      });
      ui.count = el('span', { class: 'gx-stroop-count', text: 'Durchgang 1 von ' + trials.length });
      ui.fill = el('span', { class: 'gx-stroop-fill' });
      ui.word = el('div', { class: 'gx-stroop-word gx-stroop-word--fix', text: '+' });
      ui.fb = el('div', { class: 'gx-stroop-fb', text: 'Gleich geht’s los …' });
      ui.stage = el('div', { class: 'gx-stroop-stage', tabindex: '-1', role: 'group',
        'aria-label': 'Bühne: hier erscheint das Farbwort' }, ui.word, ui.fb);

      ui.keys = COLORS.map(function (c, i) {
        var b = el('button', {
          class: 'gx-stroop-key', type: 'button',
          'aria-label': c.label + ', Taste ' + (i + 1), 'aria-keyshortcuts': String(i + 1),
          'data-color': c.id
        }, dot(c), el('span', { class: 'gx-stroop-keylabel', text: c.label }), el('span', { class: 'gx-stroop-kbd', 'aria-hidden': 'true', text: String(i + 1) }));
        b.addEventListener('pointerdown', function (ev) {
          if (ev.pointerType === 'mouse' && ev.button !== 0) return;
          respond(i, ev);
        });
        // Tastatur-/Assistenz-Aktivierung (detail === 0); Maus/Touch laufen über pointerdown
        b.addEventListener('click', function (ev) { if (ev.detail === 0) respond(i, ev); });
        return b;
      });

      var keysWrap = el('div', { class: 'gx-stroop-keys', role: 'group', 'aria-label': 'Antwort: Farbe der Schrift' }, ui.keys);

      var panel = el('div', { class: 'gx-stroop-run' },
        el('div', { class: 'gx-stroop-runhead' }, ui.badge, ui.count,
          el('span', { class: 'gx-stroop-track', 'aria-hidden': 'true' }, ui.fill),
          el('button', { class: 'gx-stroop-quit', type: 'button', text: 'Abbrechen', on: { click: function () { showIntro(true); } } })),
        ui.stage,
        keysWrap,
        el('p', { class: 'gx-stroop-keys-hint', text: 'Wähle die Farbe der Schrift – nicht das Wort. Tasten 1–4 oder klicken/tippen.' }));
      setPanel(panel, ui.stage, { noScroll: false });
    }

    function startBlock(m) {
      clearTimers();
      mode = m;
      trials = buildTrials(m);
      idx = -1;
      log = [];
      buildRun();
      bindKeys();
      announce(m === 'practice'
        ? 'Probelauf mit ' + trials.length + ' Durchgängen. Wähle die Farbe der Schrift, nicht das Wort. Tasten 1 Rot, 2 Blau, 3 Grün, 4 Gelb.'
        : 'Gewertete Runde mit ' + trials.length + ' Durchgängen.');
      later(nextTrial, 1100);
    }

    function nextTrial() {
      idx++;
      if (idx >= trials.length) { endBlock(); return; }
      ui.count.textContent = 'Durchgang ' + (idx + 1) + ' von ' + trials.length;
      ui.fill.style.width = Math.round(idx / trials.length * 100) + '%';
      ui.word.textContent = '+';
      ui.word.className = 'gx-stroop-word gx-stroop-word--fix';
      ui.word.style.color = '';
      later(showStimulus, 500 + rand(400));
    }

    function showStimulus() {
      raf = requestAnimationFrame(function () {
        raf = 0;
        if (!alive() || idx < 0 || idx >= trials.length) return;
        var tr = trials[idx];
        ui.word.textContent = COLORS[tr.w].word;
        ui.word.className = 'gx-stroop-word';
        ui.word.style.color = COLORS[tr.c].hex;
        ui.fb.textContent = '';
        ui.fb.className = 'gx-stroop-fb';
        t0 = performance.now();
        awaiting = true;
      });
    }

    function eventTime(ev) {
      var now = performance.now();
      if (ev && typeof ev.timeStamp === 'number' && ev.timeStamp > 0 && Math.abs(ev.timeStamp - now) < 10000) return ev.timeStamp;
      return now; // Fallback (ältere Browser: timeStamp in Epoch-Millisekunden)
    }

    function respond(ci, ev) {
      if (!awaiting) return;
      awaiting = false;
      var tr = trials[idx];
      var rt = eventTime(ev) - t0;
      var correct = ci === tr.c;
      var status = !correct ? 'Fehler' : rt < MIN_RT ? 'zu früh' : rt > MAX_RT ? 'zu langsam' : 'gewertet';
      log.push({ n: idx + 1, cong: tr.cong, word: tr.w, ink: tr.c, answer: ci, correct: correct, rt: rt, status: status });

      ui.word.textContent = '+';
      ui.word.className = 'gx-stroop-word gx-stroop-word--fix';
      ui.word.style.color = '';
      if (correct) {
        ui.fb.textContent = mode === 'practice' ? 'Richtig · ' + ms(rt) : 'Richtig';
        ui.fb.className = 'gx-stroop-fb gx-stroop-fb--ok';
      } else {
        ui.fb.textContent = 'Falsch – die Schrift war ' + COLORS[tr.c].label;
        ui.fb.className = 'gx-stroop-fb gx-stroop-fb--bad';
      }
      later(nextTrial, correct ? 350 : 1000);
    }

    /* ---------------- Tastatur ---------------- */

    function onKey(ev) {
      if (!alive()) return;
      if (activeKeys !== onKey) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
      // Code-Fallback für Tastaturen, bei denen 1–4 nur mit Umschalt erreichbar sind
      var m = /^[1-4]$/.test(ev.key) ? ev.key : (/^(?:Digit|Numpad)([1-4])$/.exec(ev.code || '') || [])[1];
      if (!m) return;
      var t = ev.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      ev.preventDefault();
      var i = +m - 1;
      if (ui.keys && ui.keys[i]) {
        ui.keys[i].classList.add('gx-stroop-key--hit');
        later(function () { if (ui.keys && ui.keys[i]) ui.keys[i].classList.remove('gx-stroop-key--hit'); }, 140);
      }
      respond(i, ev);
    }

    function bindKeys() {
      activeKeys = onKey;
      if (keysBound) return;
      document.addEventListener('keydown', onKey);
      keysBound = true;
    }

    function unbindKeys() {
      if (!keysBound) return;
      document.removeEventListener('keydown', onKey);
      keysBound = false;
      if (activeKeys === onKey) activeKeys = null;
    }

    /* ---------------- Zwischenschritt und Ergebnis ---------------- */

    function endBlock() {
      awaiting = false;
      unbindKeys();
      ui.fill.style.width = '100%';
      if (mode === 'practice') showBetween();
      else showResult();
    }

    function showBetween() {
      var right = log.filter(function (t) { return t.correct; }).length;
      var title = el('h3', { tabindex: '-1', text: 'Probelauf geschafft' });
      var go = el('button', { class: 'gx-stroop-btn', type: 'button', on: { click: function () { startBlock('main'); } } },
        'Gewertete Runde starten');
      var panel = el('div', { class: 'gx-stroop-panel', role: 'group', 'aria-labelledby': 'gx-stroop-between-title-' + myId },
        title,
        el('p', null, 'Richtig: ' + right + ' von ' + log.length + '. Diese Durchgänge zählen nicht – sie waren nur zum Warmwerden.'),
        el('p', null, 'Jetzt folgen ' + MAIN_N + ' gewertete Durchgänge, etwa eine Minute. Lege die Finger am besten schon auf die Tasten 1–4. Das Ziel: schnell und richtig.'),
        el('div', { class: 'gx-stroop-cta' }, go));
      title.id = 'gx-stroop-between-title-' + myId;
      setPanel(panel, title);
      announce('Probelauf geschafft. Richtig: ' + right + ' von ' + log.length + '. Die gewertete Runde wartet.');
    }

    function summarize() {
      var out = {
        c: { n: 0, err: 0, skip: 0, rts: [] },
        i: { n: 0, err: 0, skip: 0, rts: [] }
      };
      log.forEach(function (t) {
        var b = t.cong ? out.c : out.i;
        b.n++;
        if (t.status === 'Fehler') b.err++;
        else if (t.status === 'gewertet') b.rts.push(t.rt);
        else b.skip++;
      });
      out.c.mean = mean(out.c.rts);
      out.i.mean = mean(out.i.rts);
      out.enough = out.c.rts.length >= MIN_VALID && out.i.rts.length >= MIN_VALID;
      out.effect = out.enough ? out.i.mean - out.c.mean : NaN;
      out.pct = out.enough ? out.effect / out.c.mean * 100 : NaN;
      return out;
    }

    function verdictText(s) {
      if (!s.enough) {
        return 'Für einen Vergleich gab es zu wenige gültige Durchgänge (mindestens ' + MIN_VALID +
          ' pro Bedingung nötig). Bei Fehlern oder sehr langen Pausen werden Durchgänge nicht gewertet – versuch es gern noch einmal in Ruhe.';
      }
      var e = s.effect, t;
      if (e >= 30) {
        t = 'Das Wort hat sich eingemischt: Bei inkongruenten Durchgängen warst du im Schnitt ' + ms(e) + ' langsamer. ' +
          'Dein Gehirn hat das Wort mitgelesen, obwohl es dafür keinen Auftrag gab – und diesen Konflikt musstest du erst auflösen.';
      } else if (e > -30) {
        t = 'Bei dir ist der Unterschied diesmal klein. Das kommt vor: ' + MAIN_N + ' Durchgänge sind wenig, und einzelne Durchgänge schwanken stark ' +
          '(Konzentration, Tastenwahl, Ablenkung). Eine zweite Runde zeigt oft ein anderes Bild.';
      } else {
        t = 'Bei dir waren die inkongruenten Durchgänge diesmal sogar schneller. Wahrscheinlich Zufall oder Tagesform – manche Menschen finden auch Kniffe, ' +
          'mit denen das Wort weniger stört. Probier eine zweite Runde.';
      }
      if (s.i.err > s.c.err) t += ' Auch die Fehler häuften sich bei inkongruenten Durchgängen (' + s.i.err + ' gegenüber ' + s.c.err + ').';
      else if (s.i.err + s.c.err === 0) t += ' Fehler hast du dabei keine gemacht.';
      return t;
    }

    function showResult() {
      var s = summarize();
      rounds.push({ effect: s.effect, enough: s.enough });

      var title = el('h3', { tabindex: '-1', text: 'Dein Ergebnis' });

      var hero = null;
      if (s.enough) {
        hero = el('div', { class: 'gx-stroop-hero' },
          el('span', { class: 'gx-stroop-hero-label', text: 'Stroop-Effekt' }),
          el('span', { class: 'gx-stroop-hero-num', text: signed(s.effect) }),
          el('span', { class: 'gx-stroop-hero-cap',
            text: 'Differenz der Mittelwerte: inkongruent minus kongruent (' + (s.pct >= 0 ? '+' : '−') + num(Math.abs(s.pct)) + ' % gegenüber kongruent)' }));
      }

      var maxMean = Math.max(s.c.mean || 0, s.i.mean || 0, 1);
      function row(key, name, desc) {
        var b = s[key];
        var has = b.rts.length > 0;
        var fill = el('span', { class: 'gx-stroop-cmp-fill gx-stroop-cmp-fill--' + key });
        fill.style.width = '0%';
        var width = has ? Math.max(3, b.mean / maxMean * 100) : 0;
        later(function () { fill.style.width = width.toFixed(1) + '%'; }, 60);
        return el('li', { class: 'gx-stroop-cmp-row' },
          el('div', { class: 'gx-stroop-cmp-top' },
            el('span', { class: 'gx-stroop-cmp-name', text: name }),
            el('span', { class: 'gx-stroop-cmp-val', text: has ? ms(b.mean) : 'keine gültigen Durchgänge' })),
          el('div', { class: 'gx-stroop-cmp-bar', 'aria-hidden': 'true' }, fill),
          el('div', { class: 'gx-stroop-cmp-sub',
            text: desc + ' · gewertet: ' + b.rts.length + ' von ' + b.n + ' · Fehler: ' + b.err +
              (b.skip ? ' · nicht gewertet (zu schnell/langsam): ' + b.skip : '') }));
      }
      var cmp = el('ul', { class: 'gx-stroop-cmp', 'aria-label': 'Durchschnittliche Reaktionszeit je Bedingung' },
        row('c', 'Kongruent', 'Wort und Schriftfarbe stimmen überein'),
        row('i', 'Inkongruent', 'Wort und Schriftfarbe widersprechen sich'));

      var verdict = el('p', { class: 'gx-stroop-verdict', text: verdictText(s) });

      // Verlauf
      var maxRt = 1;
      log.forEach(function (t) { maxRt = Math.max(maxRt, Math.min(t.rt, MAX_RT)); });
      var strip = el('div', { class: 'gx-stroop-strip', 'aria-hidden': 'true' });
      var marks = el('div', { class: 'gx-stroop-marks', 'aria-hidden': 'true' });
      log.forEach(function (t) {
        var cls = 'gx-stroop-sbar gx-stroop-sbar--' + (t.cong ? 'c' : 'i') +
          (t.status === 'Fehler' ? ' gx-stroop-sbar--err' : t.status !== 'gewertet' ? ' gx-stroop-sbar--skip' : '');
        var fill = el('span', { class: 'gx-stroop-sbar-fill' });
        fill.style.height = Math.max(4, Math.min(Math.max(t.rt, 0), MAX_RT) / maxRt * 100).toFixed(1) + '%';
        strip.appendChild(el('div', { class: cls,
          title: 'Durchgang ' + t.n + ' · ' + (t.cong ? 'kongruent' : 'inkongruent') + ' · ' + ms(Math.max(t.rt, 0)) + ' · ' + t.status }, fill));
        marks.appendChild(el('span', { text: t.status === 'Fehler' ? '✕' : '' }));
      });
      var slegend = el('ul', { class: 'gx-stroop-slegend', 'aria-hidden': 'true' },
        el('li', null, el('span', { class: 'gx-stroop-sw gx-stroop-sw--c' }), 'kongruent'),
        el('li', null, el('span', { class: 'gx-stroop-sw gx-stroop-sw--i' }), 'inkongruent'),
        el('li', null, el('span', { class: 'gx-stroop-sw gx-stroop-sw--err' }), '✕ Fehler'),
        el('li', null, el('span', { class: 'gx-stroop-sw gx-stroop-sw--skip' }), 'nicht gewertet'));

      // Tabelle
      var tbody = el('tbody');
      log.forEach(function (t) {
        tbody.appendChild(el('tr', null,
          el('td', { text: String(t.n) }),
          el('td', { text: t.cong ? 'kongruent' : 'inkongruent' }),
          el('td', { text: COLORS[t.word].label }),
          el('td', { text: COLORS[t.ink].label }),
          el('td', { text: COLORS[t.answer].label }),
          el('td', { text: ms(Math.max(t.rt, 0)) }),
          el('td', { text: t.status })));
      });
      var table = el('table', { class: 'gx-stroop-table' },
        el('caption', { class: 'gx-stroop-sr', text: 'Alle gewerteten Durchgänge dieser Runde' }),
        el('thead', null, el('tr', null,
          ['Nr.', 'Bedingung', 'Wort', 'Schriftfarbe', 'Antwort', 'Zeit', 'Wertung'].map(function (h) {
            return el('th', { scope: 'col', text: h });
          }))),
        tbody);
      var details = el('details', { class: 'gx-stroop-details' },
        el('summary', { text: 'Alle Durchgänge als Tabelle' }),
        el('div', { class: 'gx-stroop-tablewrap', tabindex: '0', role: 'region', 'aria-label': 'Tabelle aller Durchgänge (horizontal scrollbar)' }, table));

      // Runden im Vergleich
      var roundsInfo = null;
      if (rounds.length > 1) {
        roundsInfo = el('p', { class: 'gx-stroop-rounds', text: 'Deine Runden: ' + rounds.map(function (r, i) {
          return (i + 1) + ' → ' + (r.enough ? signed(r.effect) : 'nicht auswertbar');
        }).join(' · ') + '. Einzelne Runden schwanken stark – das ist normal.' });
      }

      var again = el('button', { class: 'gx-stroop-btn', type: 'button', on: { click: function () { startBlock('main'); } } },
        'Noch eine Runde');

      var panel = el('div', { class: 'gx-stroop-panel' },
        title, hero, cmp, verdict,
        el('p', { class: 'gx-stroop-strip-title', text: 'Verlauf deiner ' + log.length + ' Durchgänge (Balkenhöhe = Reaktionszeit)' }),
        strip, marks, slegend,
        details, roundsInfo,
        el('p', { class: 'gx-stroop-muted gx-stroop-small', style: 'margin:.9rem 0 .8rem',
          text: 'Gewertet werden nur richtige Antworten zwischen ' + MIN_RT + ' und ' + num(MAX_RT) + ' Millisekunden. Nichts davon wird gespeichert oder gesendet.' }),
        el('div', { class: 'gx-stroop-cta' }, again));

      setPanel(panel, title, { noScroll: false });
      try { title.scrollIntoView({ block: 'nearest', behavior: 'auto' }); } catch (e) { /* egal */ }

      if (s.enough) {
        announce('Ergebnis: Kongruent im Schnitt ' + num(s.c.mean) + ' Millisekunden, inkongruent ' + num(s.i.mean) +
          ' Millisekunden. Stroop-Effekt: ' + signed(s.effect).replace('−', 'minus ').replace('+', 'plus ').replace(' ', ' ') +
          '. Fehler: ' + s.c.err + ' kongruent, ' + s.i.err + ' inkongruent.');
      } else {
        announce('Ergebnis: zu wenige gültige Durchgänge für einen Vergleich.');
      }
    }

    /* ---------------- Aufräumen ---------------- */

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimers();
      unbindKeys();
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    showIntro();
    return destroy;
  }

  /* ------------------------------------------------------------------ *
   * Einordnung („Was du gerade erlebt hast“) – statisch, gehört ans Ende
   * ------------------------------------------------------------------ */

  function buildNote(id) {
    function li(head, body) { return el('li', null, el('strong', { text: head + ' ' }), body); }
    return el('section', { class: 'gx-stroop-note', 'aria-labelledby': 'gx-stroop-note-title-' + id },
      el('h3', { id: 'gx-stroop-note-title-' + id, text: 'Was du gerade erlebt hast' }),
      el('p', null,
        'Ein Wort zu lesen kostet dich keine Mühe – es passiert einfach. Jahrelange Übung hat aus dem Lesen eine Gewohnheit gemacht, die sich kaum abschalten lässt. ' +
        'Die Schriftfarbe zu benennen ist dagegen ungewohnt und will bewusst gesteuert sein. Bei kongruenten Durchgängen sagen beide Wege dasselbe. ' +
        'Bei inkongruenten widersprechen sie sich: Steht ROT in blauer Schrift, drängt das Wort „Rot“ auf – richtig wäre aber „Blau“. ' +
        'Diese Interferenz kostet Zeit und führt manchmal zu Fehlern. Den Unterschied zwischen beiden Bedingungen nennt man Stroop-Effekt.'),
      el('p', null,
        'Benannt ist er nach John Ridley Stroop, der ihn 1935 beschrieb. Dass Farben langsamer benannt als Wörter gelesen werden, hatte schon James McKeen Cattell 1886 bemerkt. ' +
        'Der Effekt gilt als sehr robust und ist seit Jahrzehnten vielfach untersucht (Überblick: MacLeod 1991). Wie groß er ausfällt, hängt stark von Aufgabe, ' +
        'Antwortart und Person ab; bei Tastenantworten sind Unterschiede von einigen Dutzend Millisekunden üblich, die Spannweite ist aber groß.'),
      el('p', null,
        'Wie er genau entsteht, ist weniger klar. Die einfache Gegenüberstellung „automatisch“ und „kontrolliert“ gilt als zu grob; Modelle wie das von Cohen, Dunbar ' +
        'und McClelland (1990) beschreiben stattdessen Verarbeitungswege unterschiedlicher Stärke, die um die Antwort konkurrieren. In der Bildgebung wird bei solchen Konflikten ' +
        'häufig der anteriore cinguläre Cortex als eine Art Konfliktmelder diskutiert, zusammen mit präfrontalen Regionen (Botvinick u. a. 2001) – eine Hypothese, kein abgeschlossenes Bild.'),
      el('div', { class: 'gx-stroop-limits' },
        el('h4', { text: 'Grenzen dieses Exponats' }),
        el('ul', null,
          li('Kein Test.', MAIN_N + ' Durchgänge und keine Normwerte: Dein Ergebnis sagt nichts über deine Aufmerksamkeit, dein Gedächtnis oder deine Gesundheit aus und ersetzt keine Diagnostik. ' +
            'Stroop-Aufgaben werden zwar in der Neuropsychologie eingesetzt, aber standardisiert und von Fachleuten ausgewertet.'),
          li('Browser-Timing.', 'Gemessen wird mit performance.now(). Dazu kommen Verzögerungen, die der Browser nicht sieht: Ein Bildschirm zeigt nur alle 16 bis 17 Millisekunden ' +
            'ein neues Bild (bei 60 Hz), Tastatur und Touchscreen brauchen ihre Zeit, und Browser runden Zeitstempel teils bewusst ab. Innerhalb einer Runde auf demselben Gerät ist ' +
            'das brauchbar, Zahlen verschiedener Geräte sind nicht vergleichbar.'),
          li('Klicken statt Sprechen.', 'Klassisch wird die Farbe laut benannt. Hier musst du zusätzlich die passende Taste oder den passenden Button finden – das ist eine leicht ' +
            'andere Aufgabe, die die Zeiten verlängern und den Effekt anders ausfallen lassen kann.'),
          li('Keine neutrale Bedingung.', 'Ohne Vergleichsreize (etwa Farbbalken) lässt sich nicht sagen, ob kongruente Durchgänge beschleunigen oder inkongruente bremsen.'),
          li('Schwankende Einzelwerte.', 'Der Effekt ist im Mittel über viele Menschen robust, dein persönlicher Wert schwankt aber von Runde zu Runde. Bei solchen Aufgaben ' +
            'lassen sich stabile Unterschiede zwischen einzelnen Personen schwer messen (Hedge, Powell & Sumner 2018). Lies ihn deshalb nicht als Persönlichkeitsmerkmal.'),
          li('Farbsehen.', 'Die Buttons tragen Textlabels, damit die Zuordnung nicht an der Farbe hängt. Die Schriftfarben musst du trotzdem erkennen; bei einer Rot-Grün-Schwäche ' +
            'können manche Durchgänge schwerer sein und die Ergebnisse verändern. Blinde und stark sehbehinderte Menschen können das Exponat nicht sinnvoll nutzen – es ist eine rein visuelle Aufgabe.'),
          li('Bei Sorgen.', 'Wenn dir Konzentrationsprobleme im Alltag zu schaffen machen, sprich mit einer Ärztin, einem Arzt oder einer Psychotherapeutin darüber – nicht mit diesem Exponat.'))),
      el('p', { class: 'gx-stroop-src' },
        'Quellen: Stroop, J. R. (1935). Studies of interference in serial verbal reactions. Journal of Experimental Psychology, 18, 643–662. · ' +
        'MacLeod, C. M. (1991). Half a century of research on the Stroop effect: An integrative review. Psychological Bulletin, 109, 163–203. · ' +
        'Cohen, J. D., Dunbar, K. & McClelland, J. L. (1990). On the control of automatic processes. Psychological Review, 97, 332–361. · ' +
        'Botvinick, M. M. u. a. (2001). Conflict monitoring and cognitive control. Psychological Review, 108, 624–652. · ' +
        'Hedge, C., Powell, G. & Sumner, P. (2018). The reliability paradox. Behavior Research Methods, 50, 1166–1186.'));
  }

  /* ------------------------------------------------------------------ *
   * Registrierung
   * ------------------------------------------------------------------ */

  M.exhibits.stroop = {
    title: 'Der Stroop-Test',
    blurb: 'Benenne die Farbe der Schrift und ignoriere das Wort. Wie viel langsamer wirst du, wenn beides nicht zusammenpasst?',
    mount: mount
  };
})();

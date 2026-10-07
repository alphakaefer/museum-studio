/* Gehirnmuseum – Exponat „Ankereffekt“
 * MUSEUM.exhibits.anker = { title, blurb, mount(container, ctx) -> destroy() }
 * Klassisches Script, keine Abhängigkeiten, keine externen Requests, nichts wird gespeichert oder gesendet.
 *
 * Ablauf: drei Schätzfragen. Je Frage: Zufallsrad (niedriger oder hoher Anker) -> Vergleichsfrage
 * („größer oder kleiner als der Anker?“) -> eigene Schätzung. Am Ende Auswertung und Einordnung.
 */
(function () {
  'use strict';

  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.exhibits = M.exhibits || {};

  var P = 'gx-anker-';
  var uidCounter = 0;

  /* ------------------------------------------------------------------ *
   * Fragen (nur etablierte Fakten)
   * ------------------------------------------------------------------ */

  var QUESTIONS = [
    {
      id: 'uno',
      short: 'Mitgliedsstaaten der UNO',
      ask: 'Wie viele Staaten sind Mitglied der Vereinten Nationen?',
      cmp: { pre: 'Sind mehr oder weniger als ', post: ' Staaten Mitglied der Vereinten Nationen?' },
      choices: ['Mehr', 'Weniger'],
      inputLabel: 'Dein Tipp (Anzahl der Staaten)',
      unit: 'Staaten',
      truth: 193,
      low: [40, 80], high: [300, 420], step: 1,
      note: 'Bezugswert: 193 Mitgliedsstaaten (seit 2011; der Südsudan ist das jüngste Mitglied).'
    },
    {
      id: 'everest',
      short: 'Höhe des Mount Everest',
      ask: 'Wie hoch ist der Mount Everest über dem Meeresspiegel?',
      cmp: { pre: 'Ist der Mount Everest höher oder niedriger als ', post: ' Meter?' },
      choices: ['Höher', 'Niedriger'],
      inputLabel: 'Dein Tipp (Höhe in Metern)',
      unit: 'm',
      truth: 8849,
      low: [2500, 4500], high: [14000, 22000], step: 10,
      note: 'Bezugswert: 8.849 m, gerundet aus 8.848,86 m – dem 2020 von China und Nepal gemeinsam bekannt gegebenen Messwert.'
    },
    {
      id: 'nil',
      short: 'Länge des Nils',
      ask: 'Wie lang ist der Nil?',
      cmp: { pre: 'Ist der Nil länger oder kürzer als ', post: ' Kilometer?' },
      choices: ['Länger', 'Kürzer'],
      inputLabel: 'Dein Tipp (Länge in Kilometern)',
      unit: 'km',
      truth: 6650,
      low: [1500, 3000], high: [11000, 17000], step: 10,
      note: 'Bezugswert: rund 6.650 km (gängige Angabe; je nach Quelle und Messweise werden bis etwa 6.850 km genannt).'
    }
  ];

  var TOTAL = QUESTIONS.length;
  var MAX_INPUT = 1000000000;
  var NEAR_PCT = 5; // Tipps mit höchstens 5 % Abweichung gelten als „nah dran“ und zählen nicht als „Seite des Ankers“

  var SOURCES = [
    'Tversky, A., & Kahneman, D. (1974). Judgment under uncertainty: Heuristics and biases. Science, 185(4157), 1124–1131.',
    'Strack, F., & Mussweiler, T. (1997). Explaining the enigmatic anchoring effect: Mechanisms of selective accessibility. Journal of Personality and Social Psychology, 73(3), 437–446.',
    'Epley, N., & Gilovich, T. (2001). Putting adjustment back in the anchoring and adjustment heuristic: Differential processing of self-generated and experimenter-provided anchors. Psychological Science, 12(5), 391–396.',
    'Englich, B., Mussweiler, T., & Strack, F. (2006). Playing dice with criminal sentences: The influence of irrelevant anchors on experts’ judicial decision making. Personality and Social Psychology Bulletin, 32(2), 188–200.',
    'Klein, R. A., et al. (2014). Investigating variation in replicability: A „Many Labs“ replication project. Social Psychology, 45(3), 142–152.'
  ];

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

  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function rand(n) { return Math.floor(Math.random() * n); }

  function drawFrom(range, step) {
    var slots = Math.floor((range[1] - range[0]) / step) + 1;
    return range[0] + step * rand(slots);
  }

  function fmt(n, digits) {
    try { return n.toLocaleString('de-DE', { maximumFractionDigits: digits || 0 }); }
    catch (e) { return String(Math.round(n)); }
  }

  function signed(n, digits) {
    if (n > 0) return '+' + fmt(n, digits);
    if (n < 0) return '−' + fmt(-n, digits);
    return '0';
  }

  function pctText(p) {
    var a = Math.abs(p);
    var d = a < 10 ? 1 : 0;
    return signed(p, d) + ' %';
  }

  // Erlaubt „8849“, „8.849“, „8 849“, „8849,5“
  function parseNum(s) {
    s = String(s).trim().replace(/[\s  '’]/g, '');
    if (!s) return NaN;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
    return parseFloat(s);
  }

  function prefersReduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  // Zufällige Verteilung niedrig/hoch auf die drei Fragen: mindestens einmal niedrig UND einmal hoch,
  // damit die Auswertung etwas zeigen kann.
  function pickPattern() {
    var all = [];
    for (var m = 1; m < Math.pow(2, TOTAL) - 1; m++) {
      var p = [];
      for (var i = 0; i < TOTAL; i++) p.push(!!(m & (1 << i)));
      all.push(p);
    }
    return all[rand(all.length)];
  }

  /* ------------------------------------------------------------------ *
   * Styles (einmal pro Seite)
   * ------------------------------------------------------------------ */

  var CSS = [
    /* Lokale Aliase auf die Design-Tokens, mit Fallbacks (hell + dunkel), damit das Exponat isoliert testbar ist */
    '.gx-anker{',
    '  --ga-bg2:var(--bg-2,#FFFFFF);--ga-bg3:var(--bg-3,#ECE6DA);--ga-ink:var(--ink,#1B2230);--ga-ink2:var(--ink-2,#5C6577);',
    '  --ga-line:var(--line,#D9D2C3);--ga-accent:var(--accent,#05749E);--ga-warm:var(--warm,#FCB300);',
    '  --ga-ok:var(--ok,#2F8F5B);--ga-radius:var(--radius,14px);',
    '  --ga-shadow:var(--shadow,0 1px 2px rgba(20,25,40,.08),0 8px 24px rgba(20,25,40,.08));',
    '  --ga-display:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif);',
    '  --ga-ui:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);',
    '  --ga-on-warm:#1B2230;--ga-inset:rgba(20,25,40,.07);',
    '}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gx-anker{',
    '  --ga-bg2:var(--bg-2,#161E2E);--ga-bg3:var(--bg-3,#1E2838);--ga-ink:var(--ink,#ECE8DF);--ga-ink2:var(--ink-2,#A3ABBB);',
    '  --ga-line:var(--line,#2C3850);--ga-accent:var(--accent,#46B3DB);--ga-ok:var(--ok,#57C58A);',
    '  --ga-shadow:var(--shadow,0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35));--ga-inset:rgba(0,0,0,.35);',
    '}}',
    ':root[data-theme="dark"] .gx-anker{',
    '  --ga-bg2:var(--bg-2,#161E2E);--ga-bg3:var(--bg-3,#1E2838);--ga-ink:var(--ink,#ECE8DF);--ga-ink2:var(--ink-2,#A3ABBB);',
    '  --ga-line:var(--line,#2C3850);--ga-accent:var(--accent,#46B3DB);--ga-ok:var(--ok,#57C58A);',
    '  --ga-shadow:var(--shadow,0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35));--ga-inset:rgba(0,0,0,.35);',
    '}',

    '.gx-anker,.gx-anker *{box-sizing:border-box}',
    '.gx-anker{width:100%;max-width:760px;margin:0 auto;color:var(--ga-ink);font-family:var(--ga-ui);font-size:16px;line-height:1.55;}',
    '.gx-anker-sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '.gx-anker-lead{margin:0 0 18px;font-family:var(--ga-display);font-size:clamp(18px,4.6vw,21px);line-height:1.45;color:var(--ga-ink)}',
    '.gx-anker-lead strong{font-weight:700}',

    /* Rahmen, Passepartout, Bühne, Sockel */
    '.gx-anker-frame{position:relative;background:var(--ga-bg2);border:1px solid var(--ga-line);border-radius:var(--ga-radius);padding:8px;box-shadow:var(--ga-shadow)}',
    '.gx-anker-mat{background:var(--ga-bg3);border:1px solid var(--ga-line);border-radius:calc(var(--ga-radius) - 4px);padding:clamp(10px,3vw,18px)}',
    '.gx-anker-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;margin:0 2px 14px}',
    '.gx-anker-plaque{display:flex;flex-direction:column;gap:1px;padding-left:12px;border-left:3px solid var(--ga-warm)}',
    '.gx-anker-plaque-k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ga-ink2)}',
    '.gx-anker-plaque-t{font-family:var(--ga-display);font-size:19px;line-height:1.2;font-weight:700}',
    '.gx-anker-steps{display:flex;gap:6px;margin:0;padding:0;list-style:none}',
    '.gx-anker-steps li{width:30px;height:7px;border-radius:4px;background:var(--ga-line);border:1px solid var(--ga-ink2);opacity:.9}',
    '.gx-anker-steps li.is-done{background:var(--ga-accent);border-color:var(--ga-accent);opacity:1}',
    '.gx-anker-steps li.is-current{background:var(--ga-warm);border-color:var(--ga-ink);opacity:1;box-shadow:0 0 0 3px rgba(252,179,0,.28)}',
    '.gx-anker-stage{background:var(--ga-bg2);border:1px solid var(--ga-line);border-radius:8px;padding:clamp(16px,4.5vw,30px);min-height:360px;box-shadow:inset 0 2px 5px var(--ga-inset)}',
    '.gx-anker-plinth{height:16px;width:calc(100% - 40px);margin:0 auto;background:linear-gradient(var(--ga-line),var(--ga-bg3));border:1px solid var(--ga-line);border-top:0;border-radius:0 0 10px 10px;box-shadow:0 12px 18px -10px rgba(20,25,40,.45)}',

    /* Typografie in der Bühne */
    '.gx-anker-h{margin:0 0 14px;font-family:var(--ga-display);font-size:clamp(21px,5.4vw,27px);line-height:1.25;font-weight:700;color:var(--ga-ink);outline:none}',
    '.gx-anker-kicker{display:block;margin:0 0 6px;font-family:var(--ga-ui);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ga-ink2)}',
    '.gx-anker-p{margin:0 0 14px;max-width:60ch;color:var(--ga-ink)}',
    '.gx-anker-hint{margin:12px 0 0;font-size:14px;color:var(--ga-ink2)}',
    '.gx-anker-hl{display:inline-block;padding:0 .3em;margin:0 .05em;border-radius:6px;background:var(--ga-warm);color:var(--ga-on-warm);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.gx-anker-center{text-align:center}',
    '.gx-anker-center .gx-anker-p{margin-left:auto;margin-right:auto}',

    /* Buttons */
    '.gx-anker-btn{appearance:none;-webkit-appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:12px 26px;border-radius:999px;border:2px solid transparent;',
    '  font:600 16px/1.2 var(--ga-ui);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;text-align:center;transition:transform .12s ease,filter .12s ease,background-color .12s ease}',
    '.gx-anker-btn:focus-visible,.gx-anker-input:focus-visible,.gx-anker-debrief summary:focus-visible{outline:3px solid var(--ga-accent);outline-offset:3px}',
    '.gx-anker-btn--primary{background:var(--ga-warm);color:var(--ga-on-warm);box-shadow:inset 0 0 0 1px rgba(27,34,48,.4),0 2px 0 rgba(27,34,48,.35)}',
    '.gx-anker-btn--primary:hover{filter:brightness(1.06);transform:translateY(-1px)}',
    '.gx-anker-btn--primary:active{transform:translateY(1px);box-shadow:inset 0 0 0 1px rgba(27,34,48,.4)}',
    '.gx-anker-btn--primary[aria-disabled="true"]{cursor:progress;filter:saturate(.6) brightness(.95);transform:none}',
    '.gx-anker-btn--ghost{background:transparent;border-color:var(--ga-ink2);color:var(--ga-ink)}',
    '.gx-anker-btn--ghost:hover{background:var(--ga-bg3)}',
    '.gx-anker-choices{display:flex;flex-wrap:wrap;gap:12px;margin:4px 0 0}',
    '.gx-anker-btn--choice{flex:1 1 150px;min-height:68px;border-radius:12px;background:var(--ga-bg2);border-color:var(--ga-ink2);color:var(--ga-ink);font-family:var(--ga-display);font-size:22px;font-weight:700}',
    '.gx-anker-btn--choice:hover{background:var(--ga-bg3);border-color:var(--ga-accent)}',
    '.gx-anker-btn--choice:active{transform:translateY(1px)}',
    '.gx-anker-arrow{font-size:15px;opacity:.75}',

    /* Zufallsrad */
    '.gx-anker-wheel{position:relative;width:min(220px,62vw);aspect-ratio:1/1;margin:28px auto 22px}',
    '.gx-anker-ring{position:absolute;left:0;top:0;width:100%;height:100%;display:block;transform-origin:50% 50%;will-change:transform;overflow:visible}',
    '.gx-anker-ring-base{fill:var(--ga-bg3);stroke:var(--ga-ink);stroke-width:2}',
    '.gx-anker-w-a{fill:var(--ga-bg3);stroke:var(--ga-line);stroke-width:1}',
    '.gx-anker-w-b{fill:var(--ga-bg2);stroke:var(--ga-line);stroke-width:1}',
    '.gx-anker-bulb{fill:var(--ga-warm);stroke:var(--ga-ink);stroke-width:1}',
    '.gx-anker-disc{position:absolute;left:24%;top:24%;width:52%;height:52%;border-radius:50%;background:var(--ga-bg2);border:2px solid var(--ga-ink);box-shadow:var(--ga-shadow),inset 0 0 0 5px var(--ga-bg3);display:grid;place-items:center}',
    '.gx-anker-num{font-family:var(--ga-display);font-weight:700;line-height:1;color:var(--ga-ink);font-variant-numeric:tabular-nums;font-size:40px}',
    '.gx-anker-num[data-len="4"]{font-size:32px}',
    '.gx-anker-num[data-len="5"],.gx-anker-num[data-len="6"],.gx-anker-num[data-len="7"]{font-size:25px}',
    '.gx-anker-pointer{position:absolute;left:50%;top:-10px;width:0;height:0;margin-left:-12px;border-left:12px solid transparent;border-right:12px solid transparent;border-top:22px solid var(--ga-warm);',
    '  filter:drop-shadow(0 0 0 var(--ga-ink)) drop-shadow(0 1px 0 var(--ga-ink)) drop-shadow(0 2px 3px rgba(0,0,0,.3));z-index:2}',
    '.gx-anker-wheel.is-landed .gx-anker-disc{animation:gx-anker-pulse .5s ease-out}',
    '@keyframes gx-anker-pulse{0%{transform:scale(1)}40%{transform:scale(1.09)}100%{transform:scale(1)}}',

    /* Eingabe */
    '.gx-anker-form{margin:0}',
    '.gx-anker-label{display:block;margin:0 0 8px;font-weight:600}',
    '.gx-anker-field{display:flex;align-items:center;gap:12px;margin:0 0 6px}',
    '.gx-anker-input{width:100%;max-width:240px;min-height:58px;padding:10px 16px;border:2px solid var(--ga-ink2);border-radius:10px;background:var(--ga-bg2);color:var(--ga-ink);',
    '  font:700 26px/1.2 var(--ga-display);font-variant-numeric:tabular-nums}',
    '.gx-anker-unit{font-size:18px;font-weight:600;color:var(--ga-ink2)}',
    '.gx-anker-error{min-height:1.5em;margin:6px 0 10px;font-size:14px;font-weight:600;color:var(--ga-ink)}',
    '.gx-anker-error:not(:empty){padding-left:10px;border-left:3px solid var(--ga-warm)}',

    /* Auswertung */
    '.gx-anker-summary{margin:0 0 16px;padding:12px 16px;border-left:4px solid var(--ga-warm);background:var(--ga-bg3);border-radius:0 10px 10px 0;max-width:62ch}',
    '.gx-anker-summary strong{font-weight:700}',
    '.gx-anker-legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 14px;padding:0;list-style:none;font-size:13px;color:var(--ga-ink2)}',
    '.gx-anker-legend li{display:flex;align-items:center;gap:7px}',
    '.gx-anker-cards{margin:0 0 18px;padding:0;list-style:none}',
    '.gx-anker-card{margin:0 0 14px;padding:16px;background:var(--ga-bg2);border:1px solid var(--ga-line);border-radius:10px;box-shadow:0 1px 2px rgba(20,25,40,.06)}',
    '.gx-anker-card h4{margin:0 0 10px;font-family:var(--ga-display);font-size:19px;line-height:1.3}',
    '.gx-anker-card-no{display:inline-block;min-width:1.6em;margin-right:6px;color:var(--ga-ink2)}',
    '.gx-anker-dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;margin:0 0 14px}',
    '.gx-anker-dl>div{min-width:0}',
    '.gx-anker-dl dt{margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ga-ink2)}',
    '.gx-anker-dl dd{margin:0;font-family:var(--ga-display);font-size:22px;line-height:1.2;font-weight:700;font-variant-numeric:tabular-nums;overflow-wrap:break-word}',
    '.gx-anker-dl dd small{display:block;margin-top:2px;font-family:var(--ga-ui);font-size:13px;font-weight:500;color:var(--ga-ink2)}',
    '.gx-anker-scale{margin:0 0 12px}',
    '.gx-anker-track{position:relative;height:34px;margin:0 9px}',
    '.gx-anker-track::before{content:"";position:absolute;left:-9px;right:-9px;top:50%;height:6px;margin-top:-3px;border-radius:3px;background:var(--ga-bg3);border:1px solid var(--ga-line)}',
    '.gx-anker-mk{position:absolute;top:50%;display:block}',
    '.gx-anker-mk--anchor,.gx-anker-key--anchor{width:14px;height:14px;margin:-7px 0 0 -7px;background:var(--ga-warm);border:2px solid var(--ga-ink);transform:rotate(45deg)}',
    '.gx-anker-mk--truth,.gx-anker-key--truth{width:5px;height:28px;margin:-14px 0 0 -2.5px;background:var(--ga-ok);border-radius:2px;border:1px solid var(--ga-bg2)}',
    '.gx-anker-mk--guess,.gx-anker-key--guess{width:16px;height:16px;margin:-8px 0 0 -8px;background:var(--ga-accent);border:3px solid var(--ga-bg2);border-radius:50%;box-shadow:0 0 0 1.5px var(--ga-ink)}',
    '.gx-anker-mk--guess.is-clip::after{content:"\\00BB";position:absolute;left:14px;top:-7px;font:700 16px/1 var(--ga-ui);color:var(--ga-ink)}',
    '.gx-anker-key{display:inline-block;position:static!important;margin:0!important;flex:none}',
    '.gx-anker-key--anchor{width:11px;height:11px}',
    '.gx-anker-key--truth{height:16px;width:4px}',
    '.gx-anker-key--guess{width:13px;height:13px;border-width:2px}',
    '.gx-anker-ends{display:flex;justify-content:space-between;margin:0 0;font-size:12px;color:var(--ga-ink2);font-variant-numeric:tabular-nums}',
    '.gx-anker-verdict{display:inline-block;margin:0 0 6px;padding:4px 12px;border:1.5px solid var(--ga-ink2);border-radius:14px;font-size:14px;font-weight:600}',
    '.gx-anker-verdict.is-side{border-color:var(--ga-ink);background:var(--ga-warm);color:var(--ga-on-warm)}',
    '.gx-anker-note{margin:6px 0 0;font-size:13px;line-height:1.5;color:var(--ga-ink2)}',
    '.gx-anker-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}',

    /* Einordnung */
    '.gx-anker-debrief{margin:34px 0 0}',
    '.gx-anker-debrief>h3{margin:0 0 16px;font-family:var(--ga-display);font-size:clamp(23px,6vw,30px);line-height:1.2;outline:none}',
    '.gx-anker-debrief h4{margin:26px 0 8px;font-family:var(--ga-display);font-size:19px;line-height:1.3}',
    '.gx-anker-debrief p{margin:0 0 12px;max-width:66ch;color:var(--ga-ink)}',
    '.gx-anker-tiles{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0 14px;padding:0;list-style:none}',
    '.gx-anker-tile{flex:1 1 200px;padding:14px 16px;background:var(--ga-bg2);border:1px solid var(--ga-line);border-radius:10px;box-shadow:var(--ga-shadow)}',
    '.gx-anker-tile-k{display:block;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ga-ink2)}',
    '.gx-anker-tile-v{display:block;margin-top:2px;font-family:var(--ga-display);font-size:26px;line-height:1.2;font-weight:700}',
    '.gx-anker-tile-v small{font-family:var(--ga-ui);font-size:14px;font-weight:500;color:var(--ga-ink2)}',
    '.gx-anker-callout{margin:14px 0 4px;padding:12px 16px;border-left:4px solid var(--ga-accent);background:var(--ga-bg3);border-radius:0 10px 10px 0;max-width:66ch}',
    '.gx-anker-callout p:last-child{margin-bottom:0}',
    '.gx-anker-debrief details{margin:22px 0 0;padding:10px 14px;border:1px solid var(--ga-line);border-radius:10px;background:var(--ga-bg2)}',
    '.gx-anker-debrief summary{cursor:pointer;min-height:32px;font-weight:600;padding:4px 0}',
    '.gx-anker-debrief details ul{margin:10px 0 0;padding-left:1.1em;font-size:14px;color:var(--ga-ink2)}',
    '.gx-anker-debrief details li{margin:0 0 8px}',

    '@media (max-width:559px){.gx-anker-dl dd{font-size:19px}}',
    '@media (min-width:560px){.gx-anker-dl{grid-template-columns:repeat(4,minmax(0,1fr))}}',
    '@media (max-width:420px){.gx-anker-stage{min-height:0}.gx-anker-btn--primary{width:100%}.gx-anker-actions .gx-anker-btn{width:100%}}',
    '@media (prefers-reduced-motion:reduce){.gx-anker *,.gx-anker *::before,.gx-anker *::after{animation:none!important;transition:none!important}}'
  ].join('\n');

  function injectStyles() {
    if (document.head.querySelector('style[data-gx="anker"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gx', 'anker');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Zufallsrad (SVG + Zahl)
   * ------------------------------------------------------------------ */

  function polar(r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return [100 + r * Math.cos(a), 100 + r * Math.sin(a)];
  }

  function buildWheel(angle, numberText, landed) {
    var svg = svgEl('svg', { viewBox: '0 0 200 200', 'class': P + 'ring', 'aria-hidden': 'true', focusable: 'false' });
    svg.appendChild(svgEl('circle', { cx: 100, cy: 100, r: 99, 'class': P + 'ring-base' }));
    var R1 = 98, R0 = 64, n = 12, i;
    for (i = 0; i < n; i++) {
      var a0 = i * 360 / n, a1 = (i + 1) * 360 / n;
      var p1 = polar(R1, a0), p2 = polar(R1, a1), p3 = polar(R0, a1), p4 = polar(R0, a0);
      var d = 'M' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) +
        ' A' + R1 + ' ' + R1 + ' 0 0 1 ' + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2) +
        ' L' + p3[0].toFixed(2) + ' ' + p3[1].toFixed(2) +
        ' A' + R0 + ' ' + R0 + ' 0 0 0 ' + p4[0].toFixed(2) + ' ' + p4[1].toFixed(2) + ' Z';
      svg.appendChild(svgEl('path', { d: d, 'class': P + (i % 2 ? 'w-b' : 'w-a') }));
    }
    for (i = 0; i < n; i++) {
      var pb = polar(91, i * 360 / n);
      svg.appendChild(svgEl('circle', { cx: pb[0].toFixed(2), cy: pb[1].toFixed(2), r: 3.4, 'class': P + 'bulb' }));
    }
    if (angle) svg.style.transform = 'rotate(' + angle + 'deg)';

    var num = el('div', { class: P + 'num', text: numberText });
    num.setAttribute('data-len', String(numberText.length));
    var disc = el('div', { class: P + 'disc' }, num);
    var wheel = el('div', { class: P + 'wheel' + (landed ? ' is-landed' : ''), 'aria-hidden': 'true' },
      el('div', { class: P + 'pointer' }), svg, disc);
    return { node: wheel, ring: svg, num: num };
  }

  /* ------------------------------------------------------------------ *
   * mount
   * ------------------------------------------------------------------ */

  function mount(container /*, ctx */) {
    injectStyles();
    container.textContent = '';

    var uid = P + 'u' + (++uidCounter);
    var destroyed = false;
    var timers = [];
    var gen = 0;
    var game = null;

    function later(fn, ms) {
      var id = setTimeout(function () {
        var k = timers.indexOf(id);
        if (k >= 0) timers.splice(k, 1);
        if (!destroyed) fn();
      }, ms);
      timers.push(id);
      return id;
    }
    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function newGame(startPhase) {
      var pattern = pickPattern();
      game = {
        q: 0,
        phase: startPhase,
        rounds: QUESTIONS.map(function (q, i) {
          return { q: q, high: pattern[i], anchor: null, angle: 0, cmp: null, guess: null };
        })
      };
    }

    /* ---- Gerüst ---- */
    var live = el('div', { class: P + 'sr', 'aria-live': 'polite', 'aria-atomic': 'true', role: 'status' });
    var stepsList = el('ol', { class: P + 'steps', 'aria-label': 'Fortschritt' });
    var stage = el('div', { class: P + 'stage' });
    var debrief = el('section', { class: P + 'debrief', 'aria-label': 'Einordnung' });
    debrief.hidden = true;

    var root = el('div', { class: 'gx-anker' },
      el('p', { class: P + 'lead' },
        el('strong', { text: 'Probier es aus: ' }),
        'Drei Schätzfragen – vor jeder dreht ein Zufallsrad. Was seine Zahl mit deinem Tipp macht, schauen wir am Ende gemeinsam an.'),
      el('div', { class: P + 'frame' },
        el('div', { class: P + 'mat' },
          el('div', { class: P + 'head' },
            el('div', { class: P + 'plaque' },
              el('span', { class: P + 'plaque-k', text: 'Exponat' }),
              el('span', { class: P + 'plaque-t', text: 'Der Ankereffekt' })),
            stepsList),
          stage)),
      el('div', { class: P + 'plinth', 'aria-hidden': 'true' }),
      debrief,
      live);
    container.appendChild(root);

    function say(t) { live.textContent = t; }

    function renderSteps() {
      stepsList.textContent = '';
      for (var i = 0; i < TOTAL; i++) {
        var state;
        if (game.phase === 'result' || i < game.q) state = 'done';
        else if (i === game.q && game.phase !== 'intro') state = 'current';
        else state = 'open';
        var li = el('li', { class: state === 'done' ? 'is-done' : state === 'current' ? 'is-current' : '' },
          el('span', { class: P + 'sr', text: 'Frage ' + (i + 1) + ': ' + (state === 'done' ? 'erledigt' : state === 'current' ? 'aktuell' : 'offen') }));
        if (state === 'current') li.setAttribute('aria-current', 'step');
        stepsList.appendChild(li);
      }
    }

    function heading(kicker, text, id) {
      var h = el('h3', { class: P + 'h', tabindex: '-1', id: id },
        el('span', { class: P + 'kicker', text: kicker }),
        el('span', { class: P + 'sr', text: '. ' }));
      append(h, text);
      return h;
    }

    function btn(label, cls, onClick, extra) {
      var attrs = { type: 'button', 'class': P + 'btn ' + cls, on: { click: onClick } };
      if (extra) Object.keys(extra).forEach(function (k) { attrs[k] = extra[k]; });
      return el('button', attrs, label);
    }

    function qLabel() { return 'Frage ' + (game.q + 1) + ' von ' + TOTAL; }

    /* ---- Render-Weiche ---- */
    function render(focus) {
      gen++;
      clearTimers();
      stage.textContent = '';
      stage.setAttribute('data-phase', game.phase);
      debrief.hidden = game.phase !== 'result';
      if (game.phase !== 'result') debrief.textContent = '';
      renderSteps();

      var target = null;
      if (game.phase === 'intro') target = viewIntro();
      else if (game.phase === 'spin') target = viewSpin();
      else if (game.phase === 'compare') target = viewCompare();
      else if (game.phase === 'estimate') target = viewEstimate();
      else target = viewResult();

      if (focus && target) {
        try { target.focus(); } catch (e) { /* ignorieren */ }
      }
    }

    /* ---- Ansicht: Einstieg ---- */
    function viewIntro() {
      var h = heading('Zum Start', 'Drei Fragen, drei Zufallszahlen', uid + '-h');
      stage.appendChild(el('div', { class: P + 'view' },
        h,
        el('p', { class: P + 'p', text: 'Du drehst das Zufallsrad, vergleichst die Zahl mit der gesuchten Größe – und schätzt dann selbst. Schätze aus dem Bauch heraus: Nachschlagen gilt nicht, und es gibt keine Punkte.' }),
        el('p', { class: P + 'p', text: 'Dauer: etwa zwei Minuten. Nichts wird gespeichert oder gesendet. Wie zufällig das Rad wirklich ist, erfährst du am Ende.' }),
        el('div', { class: P + 'actions' },
          btn('Los geht’s', P + 'btn--primary', function () { game.phase = 'spin'; render(true); }))));
      return null;
    }

    /* ---- Ansicht: Rad drehen ---- */
    function viewSpin() {
      var r = game.rounds[game.q];
      var h = heading(qLabel(), 'Dreh am Zufallsrad', uid + '-h');
      var w = buildWheel(r.angle, '?', false);
      var spinning = false;
      var button = btn('Rad drehen', P + 'btn--primary', function () {
        if (spinning) return;
        spinning = true;
        button.setAttribute('aria-disabled', 'true');
        button.textContent = 'Das Rad dreht sich …';
        say('Das Rad dreht sich.');
        startSpin(r, w);
      });
      stage.appendChild(el('div', { class: P + 'view ' + P + 'center' },
        h,
        el('p', { class: P + 'p', text: 'Die Zahl, bei der das Rad stehen bleibt, brauchst du gleich für einen kurzen Vergleich.' }),
        w.node,
        el('div', { class: P + 'actions', style: 'justify-content:center' }, button)));
      return h;
    }

    function startSpin(r, w) {
      var myGen = gen;
      var range = r.high ? r.q.high : r.q.low;
      r.anchor = drawFrom(range, r.q.step);

      function done() {
        if (myGen !== gen) return;
        w.num.textContent = fmt(r.anchor);
        w.num.setAttribute('data-len', String(w.num.textContent.length));
        w.node.classList.add('is-landed');
        later(function () {
          game.phase = 'compare';
          say('Das Rad ist bei ' + fmt(r.anchor) + ' stehen geblieben.');
          render(true);
        }, prefersReduced() ? 500 : 650);
      }

      if (prefersReduced()) { done(); return; }

      // Drehung des Rings (auslaufend) + hochzählende Zahlen, die langsamer werden
      var turn = 720 + rand(360);
      r.angle = turn;
      w.ring.style.transition = 'transform 2.3s cubic-bezier(.12,.72,.16,1)';
      void w.ring.getBoundingClientRect();
      w.ring.style.transform = 'rotate(' + turn + 'deg)';

      var lo = Math.min(r.q.low[0], r.q.high[0]);
      var hi = Math.max(r.q.low[1], r.q.high[1]);
      var delays = [], d = 40, sum = 0;
      while (sum < 1700) { delays.push(d); sum += d; d = Math.round(d * 1.16); }
      var i = 0;
      (function tick() {
        if (myGen !== gen) return;
        if (i < delays.length) {
          var v = drawFrom([lo, hi], r.q.step);
          var t = fmt(v);
          w.num.textContent = t;
          w.num.setAttribute('data-len', String(t.length));
          later(tick, delays[i++]);
        } else {
          done();
        }
      })();
    }

    /* ---- Ansicht: Vergleichsfrage ---- */
    function viewCompare() {
      var r = game.rounds[game.q];
      var q = r.q;
      var w = buildWheel(r.angle, fmt(r.anchor), true);
      var h = heading(qLabel() + ' · Vergleich', [
        q.cmp.pre,
        el('span', { class: P + 'hl', text: fmt(r.anchor) }),
        q.cmp.post
      ], uid + '-h');
      var group = el('div', { class: P + 'choices', role: 'group', 'aria-labelledby': uid + '-h' });
      var arrows = ['▲', '▼'];
      q.choices.forEach(function (label, idx) {
        group.appendChild(btn([el('span', { class: P + 'arrow', 'aria-hidden': 'true', text: arrows[idx] }), label],
          P + 'btn--choice', function () {
            r.cmp = label;
            game.phase = 'estimate';
            render(true);
          }));
      });
      stage.appendChild(el('div', { class: P + 'view ' + P + 'center' },
        w.node, h, group,
        el('p', { class: P + 'hint', text: 'Eine Bauchentscheidung genügt.' })));
      return h;
    }

    /* ---- Ansicht: eigene Schätzung ---- */
    function viewEstimate() {
      var r = game.rounds[game.q];
      var q = r.q;
      var h = heading(qLabel() + ' · Schätzung', q.ask, uid + '-h');
      var inputId = uid + '-in';
      var errId = uid + '-err';
      var hintId = uid + '-hint';
      var input = el('input', {
        'class': P + 'input', id: inputId, type: 'text', inputmode: 'numeric', autocomplete: 'off',
        autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done',
        'aria-describedby': uid + '-h ' + hintId + ' ' + errId
      });
      var err = el('p', { class: P + 'error', id: errId });
      var form = el('form', { class: P + 'form', novalidate: '', on: {
        submit: function (ev) {
          ev.preventDefault();
          var v = parseNum(input.value);
          if (isNaN(v)) {
            err.textContent = 'Bitte gib eine Zahl ein – eine grobe Schätzung genügt.';
            input.setAttribute('aria-invalid', 'true');
            input.focus();
            return;
          }
          if (v > MAX_INPUT) {
            err.textContent = 'Bitte gib eine Zahl bis höchstens ' + fmt(MAX_INPUT) + ' ein.';
            input.setAttribute('aria-invalid', 'true');
            input.focus();
            return;
          }
          r.guess = v;
          if (game.q < TOTAL - 1) {
            game.q++;
            game.phase = 'spin';
          } else {
            game.phase = 'result';
          }
          render(true);
        }
      } },
        el('label', { class: P + 'label', 'for': inputId, text: q.inputLabel }),
        el('div', { class: P + 'field' }, input, el('span', { class: P + 'unit', 'aria-hidden': 'true', text: q.unit })),
        el('p', { class: P + 'hint', id: hintId, text: 'Eine grobe Schätzung genügt. Bitte nicht nachschlagen.' }),
        err,
        el('button', { type: 'submit', 'class': P + 'btn ' + P + 'btn--primary', text: game.q < TOTAL - 1 ? 'Tipp abgeben' : 'Tipp abgeben und auswerten' }));
      input.addEventListener('input', function () {
        if (err.textContent) { err.textContent = ''; input.removeAttribute('aria-invalid'); }
      });
      stage.appendChild(el('div', { class: P + 'view' }, h, form));
      return input;
    }

    /* ---- Ansicht: Auswertung ---- */
    function analyse(r) {
      var truth = r.q.truth;
      var diff = r.guess - truth;
      var pct = diff / truth * 100;
      var anchorDir = r.anchor > truth ? 1 : -1;
      var guessDir = diff > 0 ? 1 : diff < 0 ? -1 : 0;
      var near = Math.abs(pct) <= NEAR_PCT;
      return { diff: diff, pct: pct, exact: diff === 0, near: near, onSide: !near && guessDir === anchorDir };
    }

    function scaleFor(r) {
      var truth = r.q.truth;
      var domain = Math.max(r.anchor, truth) * 1.1;
      function pos(v) { return Math.max(0, Math.min(100, v / domain * 100)); }
      var track = el('div', { class: P + 'track' },
        el('span', { class: P + 'mk ' + P + 'mk--truth', style: 'left:' + pos(truth).toFixed(2) + '%' }),
        el('span', { class: P + 'mk ' + P + 'mk--anchor', style: 'left:' + pos(r.anchor).toFixed(2) + '%' }),
        el('span', { class: P + 'mk ' + P + 'mk--guess' + (r.guess > domain ? ' is-clip' : ''), style: 'left:' + pos(r.guess).toFixed(2) + '%' }));
      return el('div', { class: P + 'scale', 'aria-hidden': 'true' }, track,
        el('div', { class: P + 'ends' }, el('span', { text: '0' }), el('span', { text: fmt(domain) + ' ' + r.q.unit })));
    }

    function viewResult() {
      var rounds = game.rounds;
      var results = rounds.map(analyse);
      var sideCount = results.filter(function (a) { return a.onSide; }).length;
      var words = ['keiner', 'einer', 'zwei', 'drei'];

      var head = el('h3', { class: P + 'h', tabindex: '-1', id: uid + '-h' },
        el('span', { class: P + 'kicker', text: 'Geschafft' }),
        el('span', { class: P + 'sr', text: '. ' }),
        'Deine Auswertung');

      var lead1 = sideCount === 0
        ? 'Bei keiner der drei Fragen lag dein Tipp auf der Seite des Ankers.'
        : sideCount === 1
          ? 'Bei einer von drei Fragen lag dein Tipp auf der Seite des Ankers.'
          : 'Bei ' + words[sideCount] + ' von drei Fragen lag dein Tipp auf der Seite des Ankers.';
      var nearCount = results.filter(function (a) { return a.near; }).length;
      var lead2 = sideCount >= 2
        ? ' Das passt zum Ankereffekt – bewiesen ist damit aber nichts; warum, steht weiter unten.'
        : ' Das spricht nicht gegen den Effekt: Er zeigt sich im Durchschnitt vieler Menschen, nicht in jedem einzelnen Tipp.';
      if (nearCount) lead2 += ' (Tipps mit höchstens 5 % Abweichung zählen wir nicht mit.)';
      var summary = el('p', { class: P + 'summary' }, el('strong', { text: lead1 }), lead2);

      var legend = el('ul', { class: P + 'legend', 'aria-hidden': 'true' },
        el('li', null, el('span', { class: P + 'key ' + P + 'key--anchor' }), 'Anker'),
        el('li', null, el('span', { class: P + 'key ' + P + 'key--guess' }), 'Dein Tipp'),
        el('li', null, el('span', { class: P + 'key ' + P + 'key--truth' }), 'Richtiger Wert'));

      var cards = el('ol', { class: P + 'cards' });
      rounds.forEach(function (r, i) {
        var a = results[i];
        var q = r.q;
        var dirWord = a.exact ? 'genau richtig' : a.diff > 0 ? 'zu hoch' : 'zu niedrig';
        var verdict = a.exact
          ? 'Volltreffer – da konnte der Anker nichts anrichten.'
          : a.near
            ? 'Sehr nah dran (höchstens 5 % daneben) – hier sagt die Seite des Ankers kaum etwas aus.'
            : a.onSide
            ? 'Dein Tipp lag auf der Seite des Ankers.'
            : 'Dein Tipp lag auf der anderen Seite des richtigen Werts als der Anker.';
        cards.appendChild(el('li', { class: P + 'card' },
          el('h4', null, el('span', { class: P + 'card-no', text: (i + 1) + ' ·' }), q.short),
          el('dl', { class: P + 'dl' },
            el('div', null, el('dt', { text: 'Anker' }),
              el('dd', null, fmt(r.anchor) + ' ' + q.unit, el('small', { text: r.high ? 'hoher Anker' : 'niedriger Anker' }))),
            el('div', null, el('dt', { text: 'Dein Tipp' }),
              el('dd', null, fmt(r.guess, 2) + ' ' + q.unit)),
            el('div', null, el('dt', { text: 'Richtiger Wert' }),
              el('dd', null, fmt(q.truth) + ' ' + q.unit)),
            el('div', null, el('dt', { text: 'Abweichung' }),
              el('dd', null, signed(a.diff, 1) + ' ' + q.unit,
                el('small', { text: pctText(a.pct) + ' · ' + dirWord })))),
          scaleFor(r),
          el('p', { class: P + 'verdict' + (a.onSide && !a.exact ? ' is-side' : ''), text: verdict }),
          el('p', { class: P + 'note' },
            q.note + ' Ankerbereich: ' + fmt(q.low[0]) + '–' + fmt(q.low[1]) + ' (niedrig) bzw. ' +
            fmt(q.high[0]) + '–' + fmt(q.high[1]) + ' (hoch).')));
      });

      var again = btn('Noch einmal spielen', P + 'btn--primary', function () {
        newGame('spin');
        render(true);
      });

      stage.appendChild(el('div', { class: P + 'view' }, head, summary, legend, cards,
        el('div', { class: P + 'actions' }, again)));

      buildDebrief();
      say('Auswertung fertig. ' + lead1);
      return head;
    }

    /* ---- Einordnung: „Was du gerade erlebt hast“ ---- */
    function buildDebrief() {
      debrief.textContent = '';
      debrief.appendChild(el('h3', { text: 'Was du gerade erlebt hast' }));

      debrief.appendChild(el('h4', { text: 'Der Befund von 1974' }));
      debrief.appendChild(el('p', { text: 'Das war ein Klassiker der Urteilsforschung: der Ankereffekt. Amos Tversky und Daniel Kahneman beschrieben 1974 in der Zeitschrift Science, dass Schätzungen zu einer vorher genannten Zahl hingezogen werden – auch dann, wenn diese Zahl offensichtlich nichts mit der Frage zu tun hat.' }));
      debrief.appendChild(el('p', { text: 'In ihrem Experiment drehten Versuchspersonen ein Glücksrad mit den Zahlen 0 bis 100, das heimlich so eingestellt war, dass es bei 10 oder bei 65 stehen blieb. Dann sollten sie sagen, ob der Anteil afrikanischer Staaten in den Vereinten Nationen größer oder kleiner sei als diese Zahl, und ihn anschließend schätzen.' }));
      debrief.appendChild(el('ul', { class: P + 'tiles' },
        el('li', { class: P + 'tile' },
          el('span', { class: P + 'tile-k', text: 'Anker 10' }),
          el('span', { class: P + 'tile-v' }, '25 %', el('small', { text: ' mittlere Schätzung (Median)' }))),
        el('li', { class: P + 'tile' },
          el('span', { class: P + 'tile-k', text: 'Anker 65' }),
          el('span', { class: P + 'tile-v' }, '45 %', el('small', { text: ' mittlere Schätzung (Median)' })))));

      debrief.appendChild(el('h4', { text: 'Warum die Zahl wirkt' }));
      debrief.appendChild(el('p', { text: 'Dafür gibt es zwei Erklärungen, die sich nicht ausschließen. Tversky und Kahneman dachten an Verankerung und Anpassung: Man startet bei der genannten Zahl und korrigiert in Richtung der eigenen Vermutung – hört aber zu früh auf. Die zweite Erklärung: Die Frage „größer oder kleiner als …?“ lässt dich Gründe suchen, die zur Zahl passen, und diese Gedanken färben die anschließende Schätzung (Strack & Mussweiler, 1997).' }));
      debrief.appendChild(el('p', { text: 'Bei vorgegebenen Zahlen wie hier spricht nach Epley und Gilovich (2001) vieles für die zweite Erklärung, bei Ankern, die man sich selbst ausdenkt, eher für die erste.' }));

      debrief.appendChild(el('h4', { text: 'Warum dein Durchlauf nichts beweist' }));
      debrief.appendChild(el('p', { text: 'Ein einzelner Durchlauf sagt über den Ankereffekt fast nichts. Erstens fehlt der Vergleich: Wir wissen nicht, wie du ohne Anker geschätzt hättest. Zweitens liegt jeder bei unbekannten Größen mal zu hoch, mal zu niedrig. Selbst wenn deine Tipps rein zufällig mal über, mal unter dem richtigen Wert lägen, würdest du in bis zu jedem zweiten Durchlauf bei mindestens zwei von drei Fragen auf der Seite des Ankers landen.' }));
      debrief.appendChild(el('p', { text: 'Sichtbar wird der Effekt erst im Durchschnitt vieler Menschen: Wer einen hohen Anker bekommt, schätzt im Mittel höher als jemand mit niedrigem Anker – wie im Experiment von 1974 (45 % gegenüber 25 %).' }));
      debrief.appendChild(el('p', { text: 'Auch dieses Exponat hat Grenzen: Die Zahlen sind nur scheinbar vom Rad ausgelost. Das Programm bestimmt, welche Fragen einen niedrigen und welche einen hohen Anker bekommen (mindestens je einmal), und zieht die Zahl dann aus einem festen Bereich – ähnlich wie das präparierte Rad von 1974. Dazu kommen nur drei Fragen, dein Vorwissen und Bezugswerte, die teils gerundet sind oder je nach Quelle leicht abweichen, etwa die Länge des Nils.' }));
      debrief.appendChild(el('p', { text: 'Und noch etwas: Ein Tipp, der weit danebenliegt, sagt nichts über deine Intelligenz oder dein Urteilsvermögen. Kaum jemand kennt solche Zahlen genau – genau deshalb wirkt ein Anker. Dieses Exponat ist Bildung, kein Test und keine Diagnose.' }));

      debrief.appendChild(el('h4', { text: 'Wie gut ist der Effekt belegt?' }));
      debrief.appendChild(el('div', { class: P + 'callout' },
        el('p', null, el('strong', { text: 'Sehr gut – für den Kern des Effekts. ' }),
          'Der Ankereffekt gilt als einer der robustesten Befunde der Urteils- und Entscheidungsforschung. Im Many-Labs-Projekt (Klein et al., 2014) wurden 13 klassische Effekte in 36 Stichproben erneut geprüft; der Ankereffekt gehörte zu denen, die deutlich und durchgängig bestätigt wurden, mit vergleichsweise großen Effekten.')));
      debrief.appendChild(el('p', { text: 'Er zeigt sich auch bei Fachleuten: In einem Experiment ließen sich erfahrene Richterinnen und Richter bei ihrer Strafempfehlung von einem (präparierten) Würfelwurf beeinflussen (Englich, Mussweiler & Strack, 2006).' }));
      debrief.appendChild(el('p', { text: 'Offener ist, wie groß der Effekt im Einzelfall ausfällt und wie weit er im Alltag trägt. Das hängt von Vorwissen, Aufgabe und Art des Ankers ab; für Varianten mit völlig beiläufigen Zahlen sind die Befunde uneinheitlicher.' }));

      debrief.appendChild(el('h4', { text: 'Und im Alltag?' }));
      debrief.appendChild(el('p', { text: 'Zahlen am Anfang prägen vieles: das erste Gebot in einer Verhandlung, der durchgestrichene Preis im Schaufenster, die erste Zahl in einem Gutachten. Vollständig abschalten lässt sich der Effekt kaum; auch das Wissen um ihn schützt nur begrenzt. Helfen kann, die eigene Schätzung festzuhalten, bevor man fremde Zahlen hört, und bewusst Gründe zu sammeln, warum der Wert auch ganz anders sein könnte.' }));

      var list = el('ul');
      SOURCES.forEach(function (s) { list.appendChild(el('li', { text: s })); });
      debrief.appendChild(el('details', null,
        el('summary', { text: 'Quellen' }),
        list,
        el('p', { class: P + 'note', text: 'Bezugswerte der Fragen: Mitgliederliste der Vereinten Nationen (193 Staaten), gemeinsame Vermessung des Mount Everest durch China und Nepal (2020), gängige Nachschlagewerke für die Länge des Nils.' })));
    }

    /* ---- Start ---- */
    newGame('intro');
    render(false);

    return function destroy() {
      destroyed = true;
      gen++;
      clearTimers();
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  M.exhibits.anker = {
    title: 'Der Ankereffekt',
    blurb: 'Drei Schätzfragen, vor jeder ein Zufallsrad: Zieht eine Zahl, die mit der Frage nichts zu tun hat, deinen Tipp zu sich hin?',
    mount: mount
  };
})();

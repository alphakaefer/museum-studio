/* Gehirnmuseum – Exponat „Wason-Wahlaufgabe“
 * MUSEUM.exhibits.wason = { title, blurb, mount(container, ctx) -> destroy() }
 * Klassisches Script, keine Abhängigkeiten, keine externen Requests, nichts wird gespeichert oder gesendet.
 *
 * Ablauf: (1) abstrakte Aufgabe mit Karten E, K, 4, 7 -> Auflösung,
 *         (2) Alltagsvariante (Bier, Cola, 25 Jahre, 17 Jahre) -> Auflösung mit Vergleich,
 *         (3) Einordnung „Was du gerade erlebt hast“: Bestätigungsfehler, Kontexteffekt (mit Debatte), Grenzen, Quellen.
 */
(function () {
  'use strict';

  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.exhibits = M.exhibits || {};

  var P = 'gx-wason-';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var uidCounter = 0;

  /* ------------------------------------------------------------------ *
   * Inhalte
   *
   * Logik: Regel „Wenn P, dann Q“. Widerlegt wird sie nur durch einen Fall „P und nicht-Q“.
   * Prüfen muss man deshalb die Karten, die P zeigen (E / Bier) oder nicht-Q (7 / 17 Jahre).
   * ------------------------------------------------------------------ */

  var TASKS = {
    abstract: {
      key: 'abstract',
      heading: 'Aufgabe 1 · Vier Karten, eine Regel',
      scenario: 'Vor dir liegen vier Karten. Jede hat auf einer Seite einen Buchstaben und auf der anderen eine Zahl. Du siehst von jeder Karte nur eine Seite.',
      ruleLabel: 'Die Regel',
      rule: 'Wenn auf einer Seite ein Vokal steht, steht auf der anderen eine gerade Zahl.',
      question: 'Welche Karten musst du umdrehen, um zu prüfen, ob die Regel stimmt? Wähle so wenige wie möglich – aber alle, die nötig sind.',
      needText: 'E und 7',
      cards: [
        { kind: 'Buchstabe', glyph: 'E', label: 'E', need: true,
          verb: 'Umdrehen.',
          why: 'E ist ein Vokal – also muss hinten eine gerade Zahl stehen. Findest du dort eine ungerade, ist die Regel widerlegt.' },
        { kind: 'Buchstabe', glyph: 'K', label: 'K', need: false,
          verb: 'Nicht nötig.',
          why: 'K ist ein Konsonant, und dazu sagt die Regel nichts. Hinten darf eine gerade oder eine ungerade Zahl stehen – nichts davon verletzt sie.' },
        { kind: 'Zahl', glyph: '4', label: '4', need: false,
          verb: 'Nicht nötig.',
          why: 'Die Regel sagt „Vokal, dann gerade Zahl“ – nicht umgekehrt. Hinter der 4 darf ein Vokal oder ein Konsonant stehen, beides verträgt sich mit der Regel. Ein Vokal würde sie nur „bestätigen“, widerlegen kann die 4 sie nicht.' },
        { kind: 'Zahl', glyph: '7', label: '7', need: true,
          verb: 'Umdrehen.',
          why: '7 ist ungerade. Stünde hinten ein Vokal, wäre die Regel gebrochen. Diese unscheinbare Karte wird am häufigsten übersehen.' }
      ],
      afterTip: 'Der Kern: Eine Wenn-dann-Regel scheitert nur an einem einzigen Fall – einem Vokal mit ungerader Zahl. Prüfen musst du also genau die Karten, hinter denen sich so ein Fall verstecken kann.'
    },
    alltag: {
      key: 'alltag',
      heading: 'Aufgabe 2 · Dieselbe Aufgabe, anderer Rahmen',
      scenario: 'Du sorgst in einem Lokal dafür, dass die Hausregel eingehalten wird: Bier gibt es dort erst ab 18 (das Lokal ist strenger als das Jugendschutzgesetz, das Bier ab 16 erlaubt). Vier Personen sitzen am Tisch. Jede Karte steht für eine Person: auf der einen Seite, was sie trinkt, auf der anderen, wie alt sie ist. Du siehst wieder nur eine Seite.',
      ruleLabel: 'Die Hausregel',
      rule: 'Wenn jemand Bier trinkt, muss die Person mindestens 18 Jahre alt sein.',
      question: 'Welche Karten musst du umdrehen, um sicher zu sein, dass sich alle an die Regel halten?',
      needText: 'Bier und 17 Jahre',
      cards: [
        { kind: 'Getränk', glyph: 'Bier', word: true, label: 'Bier', need: true,
          verb: 'Umdrehen.',
          why: 'Wer Bier trinkt, muss 18 sein. Steht hinten 17 oder weniger, ist die Regel gebrochen.' },
        { kind: 'Getränk', glyph: 'Cola', word: true, label: 'Cola', need: false,
          verb: 'Nicht nötig.',
          why: 'Cola dürfen alle trinken – egal, wie alt die Person ist.' },
        { kind: 'Alter', glyph: '25', unit: 'Jahre', label: '25 Jahre', need: false,
          verb: 'Nicht nötig.',
          why: 'Mit 25 ist beides erlaubt, Bier und Cola. Egal, was hinten steht – die Regel kann nicht verletzt sein.' },
        { kind: 'Alter', glyph: '17', unit: 'Jahre', label: '17 Jahre', need: true,
          verb: 'Umdrehen.',
          why: 'Mit 17 darf es hier kein Bier geben. Steht hinten „Bier“, ist die Regel gebrochen.' }
      ],
      afterTip: ''
    }
  };

  // Zuordnung der Rollen in der Regel „Wenn P, dann Q“ (Zeilen der Vergleichstabelle)
  var MAP_ROWS = [
    { role: 'Wenn-Teil trifft zu', a: 'E', b: 'Bier', turn: true },
    { role: 'Wenn-Teil trifft nicht zu', a: 'K', b: 'Cola', turn: false },
    { role: 'Dann-Teil trifft zu', a: '4', b: '25 Jahre', turn: false },
    { role: 'Dann-Teil trifft nicht zu', a: '7', b: '17 Jahre', turn: true }
  ];

  var STEPS = [
    { id: 'abstract', short: 'Abstrakt' },
    { id: 'alltag', short: 'Alltag' },
    { id: 'einordnung', short: 'Einordnung' }
  ];

  var SOURCES = [
    'Wason, P. C. (1960). On the failure to eliminate hypotheses in a conceptual task. Quarterly Journal of Experimental Psychology, 12(3), 129–140.',
    'Wason, P. C. (1966). Reasoning. In B. M. Foss (Hrsg.), New Horizons in Psychology (S. 135–151). Harmondsworth: Penguin.',
    'Griggs, R. A., & Cox, J. R. (1982). The elusive thematic-materials effect in Wason’s selection task. British Journal of Psychology, 73(3), 407–420.',
    'Cheng, P. W., & Holyoak, K. J. (1985). Pragmatic reasoning schemas. Cognitive Psychology, 17(4), 391–416.',
    'Cosmides, L. (1989). The logic of social exchange: Has natural selection shaped how humans reason? Studies with the Wason selection task. Cognition, 31(3), 187–276.',
    'Oaksford, M., & Chater, N. (1994). A rational analysis of the selection task as optimal data selection. Psychological Review, 101(4), 608–631.',
    'Sperber, D., Cara, F., & Girotto, V. (1995). Relevance theory explains the selection task. Cognition, 57(1), 31–95.',
    'Nickerson, R. S. (1998). Confirmation bias: A ubiquitous phenomenon in many guises. Review of General Psychology, 2(2), 175–220.'
  ];

  /* ------------------------------------------------------------------ *
   * Kleine DOM-Helfer (lokal, unabhängig von core.js)
   * ------------------------------------------------------------------ */

  function h(tag, attrs) {
    var node = document.createElement(tag);
    var i, k;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'on') { for (var ev in v) node.addEventListener(ev, v[ev]); }
        else node.setAttribute(k, v === true ? '' : v);
      }
    }
    for (i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(node, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(node, x); }); return; }
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }

  // Sehr kleines Markup: **fett**
  function rich(str) {
    var frag = document.createDocumentFragment();
    String(str).split(/(\*\*[^*]+\*\*)/).forEach(function (part) {
      if (!part) return;
      if (part.slice(0, 2) === '**') frag.appendChild(h('strong', { text: part.slice(2, -2) }));
      else frag.appendChild(document.createTextNode(part));
    });
    return frag;
  }

  function p(cls, str) { var n = h('p', { 'class': cls || null }); n.appendChild(rich(str)); return n; }

  function svgEl(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  // Kleine Symbole (24er-Raster, Linie)
  var ICON_PATHS = {
    check: 'M5 12.5l4.5 4.5L19 7.5',
    cross: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
    bang: 'M12 6v7.5M12 17.6v.4',
    dash: 'M7 12h10'
  };
  function icon(name) {
    var s = svgEl('svg', { viewBox: '0 0 24 24', 'class': P + 'ico', 'aria-hidden': 'true', focusable: 'false' });
    s.appendChild(svgEl('path', { d: ICON_PATHS[name], fill: 'none', stroke: 'currentColor', 'stroke-width': '3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return s;
  }

  function prefersReduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (e) { return false; }
  }

  function joinDe(list) {
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' und ' + list[list.length - 1];
  }

  /* ------------------------------------------------------------------ *
   * Styles (einmal pro Seite)
   * ------------------------------------------------------------------ */

  var CSS = [
    /* Lokale Aliase auf die Design-Tokens, mit Fallbacks (hell + dunkel), damit das Exponat isoliert testbar ist */
    '.gx-wason{',
    '  --gw-bg2:var(--bg-2,#FFFFFF);--gw-bg3:var(--bg-3,#ECE6DA);--gw-ink:var(--ink,#1B2230);--gw-ink2:var(--ink-2,#5C6577);',
    '  --gw-line:var(--line,#D9D2C3);--gw-accent:var(--accent,#05749E);--gw-warm:var(--warm,#FCB300);',
    '  --gw-ok:var(--ok,#2F8F5B);--gw-warn:var(--warn,#C77700);--gw-bad:var(--bad,#C0392B);--gw-radius:var(--radius,14px);',
    '  --gw-shadow:var(--shadow,0 1px 2px rgba(20,25,40,.08),0 8px 24px rgba(20,25,40,.08));',
    '  --gw-display:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif);',
    '  --gw-ui:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);',
    '  --gw-on-accent:#FFFFFF;--gw-on-sig:#FFFFFF;--gw-inset:rgba(20,25,40,.09);--gw-glow:rgba(252,179,0,.16);',
    '}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gx-wason{',
    '  --gw-bg2:var(--bg-2,#161E2E);--gw-bg3:var(--bg-3,#1E2838);--gw-ink:var(--ink,#ECE8DF);--gw-ink2:var(--ink-2,#A3ABBB);',
    '  --gw-line:var(--line,#2C3850);--gw-accent:var(--accent,#46B3DB);--gw-ok:var(--ok,#57C58A);--gw-warn:var(--warn,#F0A93B);--gw-bad:var(--bad,#F06A5B);',
    '  --gw-shadow:var(--shadow,0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35));',
    '  --gw-on-accent:#0E1420;--gw-on-sig:#0E1420;--gw-inset:rgba(0,0,0,.35);--gw-glow:rgba(252,179,0,.10);',
    '}}',
    ':root[data-theme="dark"] .gx-wason{',
    '  --gw-bg2:var(--bg-2,#161E2E);--gw-bg3:var(--bg-3,#1E2838);--gw-ink:var(--ink,#ECE8DF);--gw-ink2:var(--ink-2,#A3ABBB);',
    '  --gw-line:var(--line,#2C3850);--gw-accent:var(--accent,#46B3DB);--gw-ok:var(--ok,#57C58A);--gw-warn:var(--warn,#F0A93B);--gw-bad:var(--bad,#F06A5B);',
    '  --gw-shadow:var(--shadow,0 1px 2px rgba(0,0,0,.4),0 10px 30px rgba(0,0,0,.35));',
    '  --gw-on-accent:#0E1420;--gw-on-sig:#0E1420;--gw-inset:rgba(0,0,0,.35);--gw-glow:rgba(252,179,0,.10);',
    '}',

    '.gx-wason,.gx-wason *{box-sizing:border-box}',
    '.gx-wason{width:100%;max-width:760px;margin:0 auto;color:var(--gw-ink);font-family:var(--gw-ui);font-size:16px;line-height:1.55}',
    '.gx-wason-sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '.gx-wason-lead{margin:0 0 18px;font-family:var(--gw-display);font-size:clamp(18px,4.6vw,21px);line-height:1.45}',
    '.gx-wason-lead strong{font-weight:700}',
    '.gx-wason p{margin:0 0 12px}',

    /* Rahmen, Bühne, Sockel */
    '.gx-wason-frame{position:relative;background:var(--gw-bg2);border:1px solid var(--gw-line);border-radius:var(--gw-radius);padding:8px;box-shadow:var(--gw-shadow)}',
    '.gx-wason-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px;margin:6px 6px 14px}',
    '.gx-wason-plaque{display:flex;flex-direction:column;gap:1px;padding-left:12px;border-left:3px solid var(--gw-warm)}',
    '.gx-wason-plaque-k{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gw-ink2)}',
    '.gx-wason-plaque-t{font-family:var(--gw-display);font-size:19px;line-height:1.2;font-weight:700}',
    '.gx-wason-steps{display:flex;gap:6px;margin:0;padding:0;list-style:none}',
    '.gx-wason-steps li{display:flex;align-items:center;gap:6px;min-height:28px;padding:2px 10px 2px 3px;border:1px solid var(--gw-line);border-radius:99px;background:var(--gw-bg3);font-size:12px;font-weight:600;color:var(--gw-ink2)}',
    '.gx-wason-steps li span.n{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;border:1.5px solid var(--gw-ink2);font-size:11px;font-weight:700;line-height:1}',
    '.gx-wason-steps li.is-done span.n{background:var(--gw-accent);border-color:var(--gw-accent);color:var(--gw-on-accent)}',
    '.gx-wason-steps li.is-current{color:var(--gw-ink);border-color:var(--gw-ink2);background:var(--gw-bg2)}',
    '.gx-wason-steps li.is-current span.n{background:var(--gw-warm);border-color:var(--gw-ink);color:#1B2230}',
    '.gx-wason-steps .ico{width:12px;height:12px}',
    '@media (max-width:480px){.gx-wason-steps li:not(.is-current) .t{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.gx-wason-steps li:not(.is-current){padding-right:3px}}',

    '.gx-wason-stage{position:relative;background:var(--gw-bg3);background-image:radial-gradient(ellipse 80% 60% at 50% 0,var(--gw-glow),transparent 70%);border:1px solid var(--gw-line);border-radius:8px;padding:clamp(14px,4.5vw,28px);box-shadow:inset 0 2px 6px var(--gw-inset);min-height:360px}',
    '.gx-wason-plinth{height:16px;width:calc(100% - 40px);margin:0 auto;background:linear-gradient(var(--gw-line),var(--gw-bg3));border:1px solid var(--gw-line);border-top:0;border-radius:0 0 10px 10px;box-shadow:0 12px 18px -10px rgba(20,25,40,.45)}',
    '.gx-wason-task{animation:gx-wason-fade .3s ease both}',

    '.gx-wason-h{margin:0 0 8px;font-family:var(--gw-display);font-size:clamp(20px,5vw,24px);line-height:1.2;font-weight:700;scroll-margin-top:16px}',
    '.gx-wason-h:focus{outline:none}',
    '.gx-wason-h:focus-visible{outline:3px solid var(--gw-accent);outline-offset:4px;border-radius:4px}',

    /* Regel als Wandtafel */
    '.gx-wason-rule{margin:14px 0 16px;padding:12px 16px 12px 16px;background:var(--gw-bg2);border:1px solid var(--gw-line);border-left:5px solid var(--gw-warm);border-radius:6px;box-shadow:var(--gw-shadow)}',
    '.gx-wason-rule-k{display:block;margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gw-ink2)}',
    '.gx-wason-rule-q{margin:0;font-family:var(--gw-display);font-size:clamp(19px,4.8vw,23px);line-height:1.35;font-style:italic}',
    '.gx-wason-ask{margin:0 0 4px;font-weight:600}',

    /* Karten */
    '.gx-wason-cards{list-style:none;margin:16px 0 10px;padding:6px 0 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px}',
    '@media (min-width:540px){.gx-wason-cards{grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}}',
    '.gx-wason-cards>li{margin:0;padding:0;display:flex}',
    '.gx-wason-card{appearance:none;-webkit-appearance:none;font:inherit;color:var(--gw-ink);position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;width:100%;min-height:176px;margin:0;padding:14px 8px 10px;text-align:center;background:var(--gw-bg2);border:1px solid var(--gw-line);border-radius:10px;box-shadow:var(--gw-shadow);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}',
    'button.gx-wason-card{cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.gx-wason-card::before{content:"";position:absolute;inset:5px;border:1px solid var(--gw-line);border-radius:6px;pointer-events:none;transition:border-color .16s ease}',
    '.gx-wason-cap{position:relative;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gw-ink2)}',
    '.gx-wason-face{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 0;min-height:70px}',
    '.gx-wason-glyph{font-family:var(--gw-display);font-weight:700;font-size:clamp(50px,13vw,64px);line-height:1}',
    '.gx-wason-glyph.is-word{font-size:clamp(30px,8vw,36px);letter-spacing:.01em}',
    '.gx-wason-glyph.is-num{font-size:clamp(46px,12vw,58px)}',
    '.gx-wason-unit{margin-top:2px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gw-ink2)}',
    '.gx-wason-back{position:relative;min-height:26px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--gw-ink2)}',
    '.gx-wason-tick{position:absolute;top:-9px;right:-9px;width:26px;height:26px;border-radius:50%;background:var(--gw-accent);color:var(--gw-on-accent);display:flex;align-items:center;justify-content:center;border:2px solid var(--gw-bg2);transform:scale(0);transition:transform .16s ease}',
    '.gx-wason-tick .gx-wason-ico{width:14px;height:14px}',
    '.gx-wason-ico{width:12px;height:12px;display:block}',
    'button.gx-wason-card[aria-pressed="true"]{transform:translateY(-5px);border-color:var(--gw-accent);box-shadow:0 0 0 2px var(--gw-accent),0 14px 22px -10px rgba(20,25,40,.5)}',
    'button.gx-wason-card[aria-pressed="true"]::before{border-color:var(--gw-accent)}',
    'button.gx-wason-card[aria-pressed="true"] .gx-wason-tick{transform:scale(1)}',
    '@media (hover:hover){button.gx-wason-card:hover{transform:translateY(-3px);border-color:var(--gw-ink2)}button.gx-wason-card[aria-pressed="true"]:hover{transform:translateY(-5px);border-color:var(--gw-accent)}}',
    'button.gx-wason-card:focus-visible,.gx-wason-btn:focus-visible,.gx-wason-src summary:focus-visible{outline:3px solid var(--gw-accent);outline-offset:3px}',

    /* Karten nach der Auflösung */
    'div.gx-wason-card.is-hit{border-color:var(--gw-ok);box-shadow:0 0 0 2px var(--gw-ok),var(--gw-shadow);animation:gx-wason-pop .4s ease both}',
    'div.gx-wason-card.is-hit::before{border-color:var(--gw-ok)}',
    'div.gx-wason-card.is-miss{border:2px dashed var(--gw-warn);animation:gx-wason-pop .4s ease both}',
    'div.gx-wason-card.is-miss::before{border-color:var(--gw-warn)}',
    'div.gx-wason-card.is-extra{border-color:var(--gw-bad);box-shadow:0 0 0 2px var(--gw-bad),var(--gw-shadow);animation:gx-wason-pop .4s ease both}',
    'div.gx-wason-card.is-extra::before{border-color:var(--gw-bad)}',
    'div.gx-wason-card.is-rest{box-shadow:none;background:var(--gw-bg3)}',
    '.gx-wason-badge{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:5px;max-width:100%;padding:3px 9px 3px 4px;border-radius:99px;background:var(--gw-bg3);border:1px solid var(--gw-line);color:var(--gw-ink);font-size:12px;font-weight:700;line-height:1.2;text-align:left}',
    'div.gx-wason-card.is-rest .gx-wason-badge{background:var(--gw-bg2)}',
    '.gx-wason-badge i{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;color:var(--gw-on-sig);background:var(--gw-ink2)}',
    '.gx-wason-badge i .gx-wason-ico{width:10px;height:10px}',
    '.gx-wason-badge.b-ok i{background:var(--gw-ok)}.gx-wason-badge.b-miss i{background:var(--gw-warn)}.gx-wason-badge.b-extra i{background:var(--gw-bad)}',

    '.gx-wason-meta{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 14px;min-height:24px;margin:2px 0 14px;font-size:14px;color:var(--gw-ink2)}',
    '.gx-wason-count{font-weight:600;color:var(--gw-ink)}',
    '.gx-wason-msg{margin:0;font-size:14px;font-weight:600;color:var(--gw-ink)}',
    '.gx-wason-msg:empty{display:none}',

    /* Buttons */
    '.gx-wason-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}',
    '.gx-wason-btn{appearance:none;-webkit-appearance:none;font:inherit;font-weight:700;font-size:16px;min-height:48px;padding:10px 22px;border-radius:99px;border:2px solid var(--gw-accent);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;line-height:1.2;text-align:center;transition:transform .12s ease,background-color .12s ease}',
    '.gx-wason-btn--primary{background:var(--gw-accent);color:var(--gw-on-accent);box-shadow:0 6px 14px -8px rgba(20,25,40,.6)}',
    '.gx-wason-btn--ghost{background:transparent;color:var(--gw-ink);border-color:var(--gw-line)}',
    '.gx-wason-btn[aria-disabled="true"]{background:var(--gw-bg2);color:var(--gw-ink2);border:2px dashed var(--gw-line);box-shadow:none;cursor:not-allowed}',
    '@media (hover:hover){.gx-wason-btn:not([aria-disabled="true"]):hover{transform:translateY(-1px)}.gx-wason-btn--ghost:hover{border-color:var(--gw-ink2)}}',

    /* Auflösung */
    '.gx-wason-result{margin-top:22px;padding:16px 16px 12px;background:var(--gw-bg2);border:1px solid var(--gw-line);border-left:5px solid var(--gw-ok);border-radius:10px;box-shadow:var(--gw-shadow);animation:gx-wason-rise .35s ease both}',
    '.gx-wason-result.is-part{border-left-color:var(--gw-warn)}',
    '.gx-wason-verdict{display:flex;align-items:center;gap:10px;margin:0 0 6px;font-family:var(--gw-display);font-size:clamp(19px,5vw,23px);line-height:1.25;font-weight:700}',
    '.gx-wason-verdict .vi{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--gw-ok);color:var(--gw-on-sig)}',
    '.gx-wason-result.is-part .vi{background:var(--gw-warn)}',
    '.gx-wason-verdict .vi .gx-wason-ico{width:14px;height:14px}',
    '.gx-wason-why{list-style:none;margin:14px 0 4px;padding:0;display:grid;gap:10px}',
    '.gx-wason-why li{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;margin:0;padding:10px 0 0;border-top:1px solid var(--gw-line)}',
    '.gx-wason-why li:first-child{border-top:0;padding-top:0}',
    '.gx-wason-chip{display:inline-flex;align-items:center;justify-content:center;min-width:48px;height:36px;padding:0 8px;border-radius:6px;background:var(--gw-bg3);border:1px solid var(--gw-line);font-family:var(--gw-display);font-weight:700;font-size:17px;white-space:nowrap}',
    '.gx-wason-why .tx{font-size:15px;line-height:1.5}',
    '.gx-wason-why .tx strong{display:block}',
    '.gx-wason-why+p{margin-top:16px}',
    '.gx-wason-tip{margin:16px 0 4px;padding:10px 12px;background:var(--gw-bg3);border-radius:6px;font-size:15px;border:1px solid var(--gw-line)}',
    '.gx-wason-note{font-size:14px;color:var(--gw-ink2);margin:14px 0 4px}',

    /* Vergleichstabelle */
    '.gx-wason-mapwrap{margin:14px 0 6px;overflow-x:auto}',
    '.gx-wason-map{width:100%;table-layout:fixed;border-collapse:collapse;font-size:14px;line-height:1.35}',
    '.gx-wason-map caption{caption-side:top;text-align:left;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gw-ink2);padding:0 0 6px}',
    '.gx-wason-map th,.gx-wason-map td{padding:7px 8px 7px 0;text-align:left;vertical-align:top;border-top:1px solid var(--gw-line)}',
    '.gx-wason-map thead th{border-top:0;font-size:12px;color:var(--gw-ink2);font-weight:700}',
    '.gx-wason-map tbody th{font-weight:600}',
    '.gx-wason-map td.t{font-weight:700}','.gx-wason-map th:nth-child(1){width:32%}.gx-wason-map th:nth-child(4){width:19%}','.gx-wason-map th:nth-child(4){white-space:nowrap}',
    '.gx-wason-map tr.is-turn td,.gx-wason-map tr.is-turn th{background:var(--gw-glow)}',
    '@media (max-width:420px){.gx-wason-map{font-size:13px}.gx-wason-map th,.gx-wason-map td{padding-right:5px}}',

    /* Einordnung */
    '.gx-wason-sum{margin:12px 0 18px;padding:14px 16px;background:var(--gw-bg2);border:1px solid var(--gw-line);border-left:5px solid var(--gw-warm);border-radius:8px;box-shadow:var(--gw-shadow)}',
    '.gx-wason-sum p:last-child{margin-bottom:0}',
    '.gx-wason-sect{margin:0 0 20px}',
    '.gx-wason-sect h4{margin:0 0 6px;font-family:var(--gw-display);font-size:19px;line-height:1.25;font-weight:700}',
    '.gx-wason-sect p{max-width:64ch}',
    '.gx-wason-sect ul{margin:0 0 12px;padding-left:20px;max-width:64ch}',
    '.gx-wason-sect li{margin:0 0 6px}',
    '.gx-wason-src{margin:6px 0 18px;border-top:1px solid var(--gw-line);padding-top:10px;font-size:14px}',
    '.gx-wason-src summary{cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center;border-radius:4px}',
    '.gx-wason-src ul{margin:8px 0 0;padding-left:18px;color:var(--gw-ink2)}',
    '.gx-wason-src li{margin:0 0 6px}',

    '@keyframes gx-wason-fade{from{opacity:0}to{opacity:1}}',
    '@keyframes gx-wason-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '@keyframes gx-wason-pop{0%{transform:scale(.94)}60%{transform:scale(1.03)}100%{transform:scale(1)}}',

    '@media (max-width:420px){.gx-wason-actions .gx-wason-btn{width:100%}.gx-wason-stage{min-height:0}.gx-wason-why li{grid-template-columns:1fr;gap:6px}.gx-wason-chip{justify-self:start}}',
    '@media (forced-colors:active){button.gx-wason-card[aria-pressed="true"]{outline:3px solid Highlight;outline-offset:-3px}.gx-wason-card,.gx-wason-btn,.gx-wason-badge{border:2px solid CanvasText}}',
    '@media (prefers-reduced-motion:reduce){.gx-wason *,.gx-wason *::before,.gx-wason *::after{animation:none!important;transition:none!important}}'
  ].join('\n');

  function injectStyles() {
    if (document.head.querySelector('style[data-gx="wason"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gx', 'wason');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Logik
   * ------------------------------------------------------------------ */

  function evaluate(task, picks) {
    var need = [], got = [], missed = [], extra = [];
    task.cards.forEach(function (c, i) {
      if (c.need) need.push(i);
      if (picks[i]) got.push(i);
      if (c.need && !picks[i]) missed.push(i);
      if (!c.need && picks[i]) extra.push(i);
    });
    return { ok: missed.length === 0 && extra.length === 0 && got.length > 0, missed: missed, extra: extra, got: got };
  }

  function labels(task, idxs) {
    return idxs.map(function (i) { return task.cards[i].label; });
  }

  function verdictFor(task, picks) {
    var ev = evaluate(task, picks);
    var title, text;
    if (ev.ok) {
      title = 'Genau richtig: ' + task.needText;
      text = 'Du hast genau die Karten gewählt, hinter denen sich ein Regelbruch verstecken kann – nicht mehr und nicht weniger.';
    } else {
      title = 'Nicht ganz – nötig sind ' + task.needText;
      var parts = [];
      parts.push('Du hast gewählt: ' + joinDe(labels(task, ev.got)) + '.');
      if (ev.missed.length) parts.push('Es fehlt: ' + joinDe(labels(task, ev.missed)) + '.');
      if (ev.extra.length) parts.push('Überflüssig war: ' + joinDe(labels(task, ev.extra)) + '.');
      text = parts.join(' ');
      if (task.key === 'abstract') {
        var sig = ev.got.join(',');
        if (sig === '0,2') text += ' E und 4 gehört übrigens zu den häufigsten Antworten bei dieser Aufgabe – du bist in zahlreicher Gesellschaft.';
        else if (sig === '0') text += ' Nur E zu wählen ist ebenfalls eine verbreitete Antwort.';
      }
    }
    return { ok: ev.ok, title: title, text: text, ev: ev };
  }

  /* ------------------------------------------------------------------ *
   * Mount
   * ------------------------------------------------------------------ */

  function mount(container, ctx) {
    injectStyles();
    var uid = ++uidCounter;
    var idp = 'gx-wason-' + uid + '-';
    var destroyed = false;

    var state;
    function fresh() {
      return {
        step: 0,
        picks: { abstract: [false, false, false, false], alltag: [false, false, false, false] },
        resolved: { abstract: false, alltag: false }
      };
    }
    state = fresh();

    var live = h('div', { 'class': P + 'sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var stage = h('div', { 'class': P + 'stage' });
    var stepsEl = h('ol', { 'class': P + 'steps', 'aria-label': 'Fortschritt' });
    var root = h('div', { 'class': 'gx-wason' },
      h('p', { 'class': P + 'lead' }, rich('**Probier es aus:** Vier Karten, eine Regel – und eine Aufgabe, an der erstaunlich viele kluge Köpfe stolpern. Entscheide, bevor du nachliest.')),
      h('div', { 'class': P + 'frame' },
        h('div', { 'class': P + 'head' },
          h('div', { 'class': P + 'plaque' },
            h('span', { 'class': P + 'plaque-k', text: 'Exponat' }),
            h('span', { 'class': P + 'plaque-t', text: 'Wason-Wahlaufgabe' })),
          stepsEl),
        stage),
      h('div', { 'class': P + 'plinth', 'aria-hidden': 'true' }),
      live);

    function say(text) {
      live.textContent = '';
      // kurze Verzögerung, damit Screenreader die Änderung zuverlässig ansagen
      window.setTimeout(function () { if (!destroyed) live.textContent = text; }, 30);
    }

    function focusLater(node) {
      window.setTimeout(function () {
        if (destroyed || !node) return;
        try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
        try {
          var r = node.getBoundingClientRect();
          var vh = window.innerHeight || document.documentElement.clientHeight;
          if (r.top < 8 || r.top > vh * 0.7) {
            node.scrollIntoView({ block: 'start', behavior: prefersReduced() ? 'auto' : 'smooth' });
          }
        } catch (e) { /* egal */ }
      }, 0);
    }

    function renderSteps() {
      stepsEl.textContent = '';
      STEPS.forEach(function (s, i) {
        var cls = i < state.step ? 'is-done' : (i === state.step ? 'is-current' : '');
        var n = h('span', { 'class': 'n', 'aria-hidden': 'true' });
        if (i < state.step) n.appendChild(icon('check')); else n.textContent = String(i + 1);
        var li = h('li', { 'class': cls, 'aria-current': i === state.step ? 'step' : null },
          n, h('span', { 'class': 't', text: s.short }));
        stepsEl.appendChild(li);
      });
    }

    /* ---- Aufgaben-Ansicht ---- */

    function buildCard(task, i, resolved, onToggle) {
      var c = task.cards[i];
      var picked = state.picks[task.key][i];
      var inner = [
        h('span', { 'class': P + 'cap', text: c.kind }),
        h('span', { 'class': P + 'face' },
          h('span', { 'class': P + 'glyph' + (c.word ? ' is-word' : (c.unit ? ' is-num' : '')), text: c.glyph }),
          c.unit ? h('span', { 'class': P + 'unit', text: c.unit }) : null)
      ];
      if (!resolved) {
        inner.push(h('span', { 'class': P + 'back', text: 'Rückseite: ?' }));
        inner.push(h('span', { 'class': P + 'tick', 'aria-hidden': 'true' }, icon('check')));
        var btn = h('button', {
          type: 'button', 'class': P + 'card', 'aria-pressed': picked ? 'true' : 'false',
          'data-i': String(i), on: { click: function () { onToggle(i, btn); } }
        }, inner);
        return btn;
      }
      var cls, badgeCls, ic, txt, sr;
      if (c.need && picked) { cls = 'is-hit'; badgeCls = 'b-ok'; ic = 'check'; txt = 'Richtig'; sr = ' gewählt'; }
      else if (c.need && !picked) { cls = 'is-miss'; badgeCls = 'b-miss'; ic = 'bang'; txt = 'Fehlte'; sr = ' – nicht gewählt'; }
      else if (!c.need && picked) { cls = 'is-extra'; badgeCls = 'b-extra'; ic = 'cross'; txt = 'Unnötig'; sr = ' gewählt'; }
      else { cls = 'is-rest'; badgeCls = 'b-rest'; ic = 'dash'; txt = 'Nicht nötig'; sr = ', nicht gewählt'; }
      inner.push(h('span', { 'class': P + 'back' },
        h('span', { 'class': P + 'badge ' + badgeCls }, h('i', { 'aria-hidden': 'true' }, icon(ic)), txt, h('span', { 'class': P + 'sr', text: sr }))));
      return h('div', { 'class': P + 'card ' + cls }, inner);
    }

    function buildResult(task, headId) {
      var v = verdictFor(task, state.picks[task.key]);
      var box = h('div', { 'class': P + 'result' + (v.ok ? '' : ' is-part') });
      box.appendChild(h('h4', { 'class': P + 'h', id: headId, tabindex: '-1', text: 'Auflösung' }));
      box.appendChild(h('p', { 'class': P + 'verdict' },
        h('span', { 'class': 'vi', 'aria-hidden': 'true' }, icon(v.ok ? 'check' : 'bang')),
        h('span', { text: v.title })));
      box.appendChild(p('', v.text));

      var list = h('ul', { 'class': P + 'why' });
      task.cards.forEach(function (c) {
        list.appendChild(h('li', null,
          h('span', { 'class': P + 'chip', text: c.label }),
          h('span', { 'class': 'tx' }, h('strong', { text: c.verb }), c.why)));
      });
      box.appendChild(list);
      if (task.afterTip) box.appendChild(p(P + 'tip', task.afterTip));

      if (task.key === 'abstract') {
        box.appendChild(p(P + 'note', 'Zum Vergleich: In Wasons Studien ab den 1960er-Jahren fand meist nur ein kleiner Teil der Teilnehmenden die richtige Kombination E und 7 – grob geschätzt etwa jede zehnte Person, je nach Studie und Formulierung unterschiedlich. Zu den häufigsten Antworten zählten E allein sowie E und 4.'));
      } else {
        box.appendChild(p('', '**Logisch ist das exakt dieselbe Aufgabe.** Die Tabelle zeigt, welche Karte welche Rolle spielt. Hat sich die Alltagsversion für dich leichter angefühlt?'));
        var tbl = h('table', { 'class': P + 'map' },
          h('caption', { text: 'Gleiche Logik, anderer Inhalt' }),
          h('thead', null, h('tr', null,
            h('th', { scope: 'col', text: 'Teil der Regel' }),
            h('th', { scope: 'col', text: 'Aufgabe 1' }),
            h('th', { scope: 'col', text: 'Aufgabe 2' }),
            h('th', { scope: 'col', text: 'Drehen?' }))),
          h('tbody', null, MAP_ROWS.map(function (r) {
            return h('tr', { 'class': r.turn ? 'is-turn' : null },
              h('th', { scope: 'row', text: r.role }),
              h('td', { text: r.a }),
              h('td', { text: r.b }),
              h('td', { 'class': 't', text: r.turn ? 'Ja' : 'Nein' }));
          })));
        box.appendChild(h('div', { 'class': P + 'mapwrap' }, tbl));
      }
      return { node: box, verdict: v };
    }

    function buildTask(key) {
      var task = TASKS[key];
      var done = state.resolved[key];
      var headId = idp + key + '-h';
      var askId = idp + key + '-ask';
      var wrap = h('div', { 'class': P + 'task' });
      wrap.appendChild(h('h3', { 'class': P + 'h', id: headId + '-top', tabindex: '-1', text: task.heading }));
      wrap.appendChild(p('', task.scenario));
      wrap.appendChild(h('div', { 'class': P + 'rule' },
        h('span', { 'class': P + 'rule-k', text: task.ruleLabel }),
        h('p', { 'class': P + 'rule-q', text: '„' + task.rule + '“' })));
      wrap.appendChild(h('p', { 'class': P + 'ask', id: askId, text: task.question }));

      var count = h('span', { 'class': P + 'count' });
      var msg = h('p', { 'class': P + 'msg' });
      var go;

      function refresh() {
        var n = state.picks[key].filter(Boolean).length;
        count.textContent = n === 0 ? 'Noch keine Karte gewählt' : (n === 1 ? '1 Karte gewählt' : n + ' Karten gewählt');
        if (go) go.setAttribute('aria-disabled', n === 0 ? 'true' : 'false');
      }
      function onToggle(i, btn) {
        state.picks[key][i] = !state.picks[key][i];
        btn.setAttribute('aria-pressed', state.picks[key][i] ? 'true' : 'false');
        msg.textContent = '';
        refresh();
      }

      var ul = h('ul', { 'class': P + 'cards', 'aria-labelledby': askId });
      task.cards.forEach(function (c, i) {
        ul.appendChild(h('li', null, buildCard(task, i, done, onToggle)));
      });
      wrap.appendChild(ul);

      if (!done) {
        wrap.appendChild(h('div', { 'class': P + 'meta' }, count, msg));
        go = h('button', { type: 'button', 'class': P + 'btn ' + P + 'btn--primary', 'aria-disabled': 'true', on: { click: function () {
          if (go.getAttribute('aria-disabled') === 'true') {
            msg.textContent = 'Wähle zuerst mindestens eine Karte aus.';
            say('Wähle zuerst mindestens eine Karte aus.');
            return;
          }
          state.resolved[key] = true;
          var v = verdictFor(task, state.picks[key]);
          render();
          say('Auflösung. ' + v.title + '. ' + v.text);
          focusLater(root.querySelector('#' + headId));
        } } }, 'Auflösen');
        wrap.appendChild(h('div', { 'class': P + 'actions' }, go));
        wrap.appendChild(p(P + 'note', 'Tippen oder klicken wählt eine Karte aus oder ab. Mit der Tastatur: Tab zum Wechseln, Leertaste oder Eingabe zum Wählen.'));
        refresh();
      } else {
        var res = buildResult(task, headId);
        wrap.appendChild(res.node);
        var nextLabel = key === 'abstract' ? 'Weiter: Dieselbe Aufgabe im Alltag' : 'Weiter: Was du gerade erlebt hast';
        wrap.appendChild(h('div', { 'class': P + 'actions', style: 'margin-top:16px' },
          h('button', { type: 'button', 'class': P + 'btn ' + P + 'btn--primary', on: { click: function () {
            state.step += 1;
            render();
            var hh = root.querySelector('.' + P + 'task .' + P + 'h');
            say(STEPS[state.step].short + ': ' + hh.textContent + '.');
            focusLater(hh);
          } } }, nextLabel)));
      }
      return wrap;
    }

    /* ---- Einordnung ---- */

    function buildSummary() {
      var wrap = h('div', { 'class': P + 'task' });
      wrap.appendChild(h('h3', { 'class': P + 'h', tabindex: '-1', text: 'Einordnung · Was du gerade erlebt hast' }));

      var a = evaluate(TASKS.abstract, state.picks.abstract);
      var b = evaluate(TASKS.alltag, state.picks.alltag);
      var line;
      if (a.ok && b.ok) {
        line = 'Du hast **beide Aufgaben gelöst** – abstrakt mit E und 7, im Alltag mit Bier und 17 Jahre. Das ist ein starkes Ergebnis: Die abstrakte Version löst in Studien meist nur ein kleiner Teil der Teilnehmenden. Wie viel davon an der Logik und wie viel an der Reihenfolge liegt, steht unter „Grenzen“.';
      } else if (!a.ok && b.ok) {
        line = 'Die abstrakte Aufgabe ist dir **schwerer gefallen** als die Alltagsversion – genau das Muster, das in Studien immer wieder beschrieben wird. Wie weit man es aus deinem Durchlauf ablesen kann, steht unter „Grenzen“.';
      } else if (a.ok && !b.ok) {
        line = 'Die abstrakte Aufgabe hast du gelöst, die Alltagsversion nicht – das ist ein **ungewöhnliches Muster**. Vielleicht hat dich der Alltagsrahmen auf eine andere Lesart gelockt, etwa die Frage, wer überhaupt kontrolliert wird. Ein einzelner Durchlauf sagt hier wenig.';
      } else {
        line = '**Beide Aufgaben sind danebengegangen** – das passiert sehr vielen Menschen. Das ist kein Maßstab für deine Intelligenz: Die Aufgabe ist berühmt dafür, kluge Köpfe zu verwirren.';
      }
      wrap.appendChild(h('div', { 'class': P + 'sum' }, p('', line)));

      // 1) Bestätigungsfehler
      var pa = state.picks.abstract;
      var mine = [];
      if (pa[2]) mine.push('Du hast in Aufgabe 1 die **4** gedreht. Ein Vokal dahinter hätte die Regel „bestätigt“ – widerlegen konnte die 4 sie aber nicht. Genau dieser Zug ist das Lehrbuchbeispiel für den Bestätigungsfehler.');
      if (pa[3]) mine.push('Du hast die **7** gedreht und damit nach einem Gegenbeispiel gesucht statt nach einer Bestätigung. Das ist der Schritt, den die meisten übersehen.');
      else mine.push('Die **7** hast du liegen lassen. Sie sieht harmlos aus, kann aber genau das Gegenbeispiel verbergen – und wird deshalb am häufigsten übersehen.');

      var s1 = h('section', { 'class': P + 'sect' },
        h('h4', { text: 'Bestätigen oder widerlegen?' }),
        p('', 'Der **Bestätigungsfehler** (englisch: confirmation bias) beschreibt die Neigung, Informationen so zu suchen, zu deuten und zu erinnern, dass sie zu dem passen, was wir ohnehin glauben. Das ist keine Charakterschwäche, sondern ein Alltagsmuster: Passendes ist leichter zu finden, fühlt sich stimmig an und kostet weniger Mühe als die Frage „Was würde mich widerlegen?“.'),
        p('', 'Die Wason-Aufgabe macht das sichtbar. Der britische Psychologe Peter Wason entwickelte sie in den 1960er-Jahren; schon sein 2-4-6-Experiment (1960) zeigte, dass Menschen Annahmen lieber zu bestätigen versuchen, als sie auf die Probe zu stellen. Philosophisch steckt dahinter die Idee des Falsifikationismus von Karl Popper: Eine Regel bewährt sich vor allem dadurch, dass Widerlegungsversuche scheitern.'),
        p('', mine.join(' ')),
        p('', 'Im Alltag sieht das unspektakulärer aus: Wer überzeugt ist, dass bei Vollmond mehr Kinder geboren werden, merkt sich die Vollmondnächte mit vollem Kreißsaal – und vergisst die ruhigen. Die Gegenprobe wäre, auch die Nächte ohne Vollmond zu zählen.'));

      // 2) Kontext
      var s2 = h('section', { 'class': P + 'sect' },
        h('h4', { text: 'Warum der Alltag es leichter macht' }),
        p('', 'In der Alltagsversion lösen deutlich mehr Menschen die Aufgabe, obwohl sie logisch identisch ist. Schon Griggs und Cox (1982) ließen Studierende eine Trinkalter-Regel prüfen: Eine große Mehrheit wählte die richtigen Karten, bei der abstrakten Fassung dagegen kaum jemand.'),
        p('', 'Leda Cosmides und John Tooby deuteten solche Befunde als Hinweis auf einen Denkmechanismus für **Betrugserkennung**: Menschen seien besonders gut darin, bei Tauschregeln wie „Wer den Nutzen nimmt, muss die Kosten tragen“ jene zu entdecken, die nehmen, ohne zu zahlen (Cosmides, 1989). Der Jugendliche mit dem Bier wäre so ein Fall. Der Effekt zeigte sich in ihren Studien auch bei ausgedachten, fremden Regeln.'),
        p('', '**Ob dafür ein eigener, in der Evolution entstandener Mechanismus nötig ist, ist umstritten.** Andere Erklärungen verweisen auf Vertrautheit mit der Regel, auf allgemeine Denkschemata für Erlaubnis und Pflicht (Cheng & Holyoak, 1985) oder auf Überlegungen zur Relevanz (Sperber, Cara & Girotto, 1995). Dass Inhalt und Zusammenhang das Denken stark verändern, gilt als gut belegt – womit genau, ist offen.'));

      // 3) Grenzen
      var s3 = h('section', { 'class': P + 'sect' },
        h('h4', { text: 'Grenzen dieses Exponats' }),
        h('ul', null,
          h('li', null, rich('**Reihenfolge:** Die Auflösung von Aufgabe 1 kanntest du, bevor du Aufgabe 2 gelöst hast. Dein Ergebnis zeigt deshalb nicht, ob Kontext hilft – in Studien sieht meist jede Gruppe nur eine Version.')),
          h('li', null, rich('**Zwei Unterschiede auf einmal:** Die Buchstabenregel behauptet etwas über die Welt („so ist es“), die Hausregel schreibt etwas vor („so soll es sein“). Außerdem sucht man im Alltag nach Regelbrechern. Es ändert sich also mehr als nur der Inhalt.')),
          h('li', null, rich('**Deutung offen:** Auch die Lesart „Bestätigungsfehler“ ist nicht unumstritten. Unter bestimmten Annahmen – etwa, dass Vokale und gerade Zahlen selten sind – kann es informationstheoretisch vernünftig sein, die 4 zu prüfen (Oaksford & Chater, 1994). Manche Forschende sehen in der Wahl der 4 auch eher eine Passungs-Heuristik („matching“): Man wählt, was in der Regel vorkommt.')),
          h('li', null, rich('**Kein Test:** Ein Durchlauf misst weder deine Intelligenz noch dein Denkvermögen und ist keine Diagnose. Er zeigt ein Muster, das bei vielen Menschen auftritt – mehr nicht, und er ersetzt weder Beratung noch Therapie. Nichts davon wird gespeichert oder gesendet.'))),
        p('', 'Eine kleine Gegenprobe für den Alltag: Wenn du das nächste Mal eine Annahme prüfst, frag dich auch, welcher Fall sie widerlegen würde – und ob du dort schon nachgeschaut hast.'));

      var src = h('details', { 'class': P + 'src' },
        h('summary', { text: 'Quellen' }),
        h('ul', null, SOURCES.map(function (s) { return h('li', { text: s }); })));

      wrap.appendChild(s1); wrap.appendChild(s2); wrap.appendChild(s3); wrap.appendChild(src);
      wrap.appendChild(h('div', { 'class': P + 'actions' },
        h('button', { type: 'button', 'class': P + 'btn ' + P + 'btn--ghost', on: { click: function () {
          state = fresh();
          render();
          var hh = root.querySelector('.' + P + 'task .' + P + 'h');
          say('Von vorn: ' + hh.textContent + '.');
          focusLater(hh);
        } } }, 'Nochmal von vorn')));
      return wrap;
    }

    function render() {
      renderSteps();
      stage.textContent = '';
      stage.appendChild(state.step === 0 ? buildTask('abstract') : state.step === 1 ? buildTask('alltag') : buildSummary());
    }

    container.textContent = '';
    container.appendChild(root);
    render();

    return function destroy() {
      destroyed = true;
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  M.exhibits.wason = {
    title: 'Wason-Wahlaufgabe',
    blurb: 'Vier Karten, eine Wenn-dann-Regel: Welche Karten musst du umdrehen? Eine berühmte Denkfalle – und warum sie im Alltag plötzlich leichter wird.',
    mount: mount
  };
})();

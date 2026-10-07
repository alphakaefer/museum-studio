/* Gehirnmuseum – Exponat „Gedankenprotokoll“ (kognitive Umstrukturierung nach Beck)
 * MUSEUM.exhibits.gedankenprotokoll = { title, blurb, mount(container, ctx) -> destroy() }
 * Klassisches Script, keine Abhängigkeiten, keine externen Requests. Nichts wird gesendet oder gespeichert:
 * Alle Eingaben leben nur im Arbeitsspeicher der geöffneten Seite.
 *
 * Ablauf: Situation → automatischer Gedanke (+ Überzeugung) → Gefühl (+ Intensität) → Denkfehler →
 *         Belege dafür/dagegen → Alternativgedanke (+ Neubewertung) → Zusammenfassungs-Karte
 *         (Als Text kopieren, Zurücksetzen) → Einordnung „Was du gerade erlebt hast“.
 */
(function () {
  'use strict';

  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.exhibits = M.exhibits || {};

  var P = 'gx-gedankenprotokoll-';
  var uidCounter = 0;
  var NBSP = ' ';
  var MINUS = '−';

  /* ------------------------------------------------------------------ *
   * Inhalte
   * ------------------------------------------------------------------ */

  var STEPS = [
    { key: 'situation', label: 'Situation', title: 'Was ist passiert?' },
    { key: 'gedanke', label: 'Gedanke', title: 'Was ging dir durch den Kopf?' },
    { key: 'gefuehl', label: 'Gefühl', title: 'Wie hat sich das angefühlt?' },
    { key: 'denkfehler', label: 'Denkfehler', title: 'Welche Denkmuster stecken darin?' },
    { key: 'belege', label: 'Belege', title: 'Was spricht dafür – was dagegen?' },
    { key: 'alternative', label: 'Alternative', title: 'Wie könnte man es noch sehen?' }
  ];
  var RESULT_LABEL = 'Karte';

  var FEELINGS = ['Angst', 'Sorge', 'Traurigkeit', 'Wut', 'Scham', 'Schuld', 'Enttäuschung', 'Hilflosigkeit', 'Einsamkeit', 'Anspannung'];
  var OTHER = '__other';

  // Denkfehler (kognitive Verzerrungen): auf Beck zurückgehend, in dieser Alltagsform u. a. von Burns (1980) aufbereitet.
  var FEHLER = [
    { id: 'katastrophisieren', name: 'Katastrophisieren', desc: 'Du malst dir das schlimmstmögliche Ende aus und hältst es für das wahrscheinlichste.' },
    { id: 'schwarzweiss', name: 'Schwarz-Weiß-Denken', desc: 'Es gibt nur ganz oder gar nicht, perfekt oder gescheitert – die Zwischentöne fehlen.' },
    { id: 'gedankenlesen', name: 'Gedankenlesen', desc: 'Du glaubst zu wissen, was andere über dich denken, ohne sie gefragt zu haben.' },
    { id: 'wahrsagen', name: 'Wahrsagen', desc: 'Du nimmst eine düstere Zukunft als sicher an, obwohl sie nur eine von vielen Möglichkeiten ist.' },
    { id: 'uebergeneralisieren', name: 'Übergeneralisieren', desc: 'Aus einem einzelnen Ereignis machst du ein festes Muster: „immer“, „nie“, „jedes Mal“.' },
    { id: 'emotional', name: 'Emotionales Schlussfolgern', desc: 'Du hältst ein Gefühl für einen Beweis: „Ich fühle mich schuldig, also habe ich etwas falsch gemacht.“' },
    { id: 'personalisieren', name: 'Personalisieren', desc: 'Du beziehst Ereignisse auf dich oder hältst dich allein für verantwortlich, obwohl viel mehr mitspielt.' },
    { id: 'sollte', name: 'Sollte-Aussagen', desc: 'Du setzt dir oder anderen starre Regeln („müsste“, „sollte“) und bestrafst dich, wenn sie nicht erfüllt werden.' },
    { id: 'selektiv', name: 'Selektive Wahrnehmung', desc: 'Du siehst nur das eine Negative und blendest alles andere aus – wie ein Filter, der nur Dunkles durchlässt.' },
    { id: 'abwertung', name: 'Abwertung des Positiven', desc: 'Gutes zählt nicht: „Das war nur Glück“, „Das kann doch jeder“.' },
    { id: 'etikettieren', name: 'Etikettieren', desc: 'Du klebst dir oder anderen ein pauschales Etikett auf – „Versager“ statt „da ist ein Fehler passiert“.' }
  ];
  var FEHLER_BY_ID = {};
  FEHLER.forEach(function (f) { FEHLER_BY_ID[f.id] = f; });

  var EXAMPLE = {
    situation: 'Ich habe meiner Chefin gestern Abend mein Konzept geschickt. Bis heute Mittag kam keine Antwort.',
    thought: 'Sie findet mein Konzept schlecht und ist enttäuscht von mir.',
    belief: 75,
    feeling: 'Angst',
    intensity: 70,
    fehler: ['gedankenlesen', 'selektiv'],
    pro: 'Sie hat bisher nicht geantwortet.',
    contra: 'Diese Woche ist sie auf Dienstreise und antwortet dann oft erst abends. Mein letztes Konzept hat sie ausdrücklich gelobt. Wenn sie unzufrieden ist, sagt sie das normalerweise direkt.',
    alt: 'Vermutlich ist sie unterwegs und kommt nicht zum Lesen. Ich weiß es nicht – ich warte bis morgen und frage dann kurz nach.',
    intensity2: 35,
    belief2: 30
  };

  var EVIDENCE_QUESTIONS = [
    'Welche Tatsachen sprechen für den Gedanken – und welche widersprechen ihm?',
    'Was würde eine neutrale Beobachterin sagen, die nur sieht, was passiert ist?',
    'Was würdest du einer guten Freundin raten, die genau das denkt?',
    'Gab es schon Situationen, in denen das Gegenteil zutraf?',
    'Wie wahrscheinlich ist das Schlimmste wirklich – und wie würdest du damit umgehen?'
  ];

  /* ------------------------------------------------------------------ *
   * Kleine Helfer (lokal, kein Bezug auf core.js)
   * ------------------------------------------------------------------ */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'on') Object.keys(v).forEach(function (ev) { el.addEventListener(ev, v[ev]); });
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }

  // **fett** in Fließtext
  function rich(str) {
    var frag = document.createDocumentFragment();
    String(str).split('**').forEach(function (part, i) {
      if (!part) return;
      frag.appendChild(i % 2 ? h('strong', { text: part }) : document.createTextNode(part));
    });
    return frag;
  }

  function prefersReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function pct(n) { return n + NBSP + '%'; }

  function clampNum(v, lo, hi, def) {
    v = Number(v);
    if (!isFinite(v)) return def;
    return Math.max(lo, Math.min(hi, Math.round(v)));
  }

  /* ------------------------------------------------------------------ *
   * Styles (einmal pro Dokument)
   * ------------------------------------------------------------------ */

  var CSS = [
    '.gp-root{--gp-ink:var(--ink,#1B2230);--gp-ink2:var(--ink-2,#5C6577);--gp-bg:var(--bg,#F6F2EA);--gp-card:var(--bg-2,#FFFFFF);--gp-sunk:var(--bg-3,#ECE6DA);',
    '--gp-line:var(--line,#D9D2C3);--gp-accent:var(--accent,#05749E);--gp-warm:var(--warm,#FCB300);--gp-ok:var(--ok,#2F8F5B);--gp-warn:var(--warn,#C77700);--gp-bad:var(--bad,#C0392B);',
    '--gp-r:var(--radius,14px);--gp-shadow:var(--shadow,0 1px 2px rgba(20,25,40,.08),0 8px 24px rgba(20,25,40,.08));',
    '--gp-serif:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif);',
    '--gp-sans:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);--gp-on-accent:#FFFFFF;',
    'container-type:inline-size;container-name:gp;position:relative;max-width:100%;margin:0 auto;color:var(--gp-ink);font-family:var(--gp-sans);font-size:1rem;line-height:1.55;text-align:left}',
    '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .gp-root{--gp-on-accent:var(--bg,#0E1420)}}',
    ':root[data-theme="dark"] .gp-root{--gp-on-accent:var(--bg,#0E1420)}',
    '.gp-root *,.gp-root *::before,.gp-root *::after{box-sizing:border-box}',
    ':where(.gp-root) p{margin:0}',
    '.gp-root [hidden]{display:none !important}',

    /* Einleitung */
    '.gp-lead{margin:0 0 18px;font-size:1.05rem;color:var(--gp-ink)}',
    '.gp-lead strong{font-family:var(--gp-serif);font-size:1.12em}',

    /* Rahmen, Passepartout, Sockel */
    '.gp-frame{padding:8px;border:1px solid var(--gp-line);border-radius:calc(var(--gp-r) + 6px);background:var(--gp-sunk);box-shadow:var(--gp-shadow)}',
    '.gp-panel{position:relative;padding:20px 16px 18px;border:1px solid var(--gp-line);border-radius:var(--gp-r);background:var(--gp-card)}',
    '.gp-plinth{height:12px;width:calc(100% - 28px);margin:0 auto;border:1px solid var(--gp-line);border-top:0;border-radius:0 0 10px 10px;',
    'background:linear-gradient(180deg,var(--gp-line),var(--gp-sunk));box-shadow:0 12px 18px -10px rgba(20,25,40,.35)}',
    '@container gp (min-width:560px){.gp-panel{padding:26px 28px 22px}}',

    /* Schild */
    '.gp-plaque{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:.74rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gp-ink2);font-weight:600}',
    '.gp-plaque::before{content:"";flex:none;width:9px;height:9px;border-radius:50%;background:var(--gp-warm);box-shadow:0 0 0 3px rgba(252,179,0,.25)}',
    '.gp-title{margin:0 0 10px;font-family:var(--gp-serif);font-weight:600;font-size:1.65rem;line-height:1.2;color:var(--gp-ink)}',
    '.gp-note{display:flex;gap:10px;margin:0 0 18px;padding:10px 12px;border:1px solid var(--gp-line);border-left:3px solid var(--gp-warm);border-radius:10px;background:var(--gp-sunk);font-size:.88rem;color:var(--gp-ink2)}',
    '.gp-note strong{color:var(--gp-ink)}',
    '.gp-root a{color:var(--gp-accent);text-underline-offset:2px;font-weight:600;white-space:nowrap}',

    /* Fortschritt */
    '.gp-steps{display:flex;list-style:none;margin:0 0 18px;padding:0}',
    '.gp-step{position:relative;flex:1 1 0;min-width:0;text-align:center}',
    '.gp-step::before{content:"";position:absolute;top:22px;right:50%;width:100%;height:2px;background:var(--gp-line)}',
    '.gp-step:first-child::before{display:none}',
    '.gp-step.is-done::before,.gp-step.is-current::before{background:var(--gp-accent)}',
    '.gp-stepbtn{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;width:100%;min-height:44px;padding:7px 0 2px;border:0;background:transparent;color:var(--gp-ink2);font:inherit;cursor:pointer;border-radius:10px}',
    '.gp-stepbtn[disabled]{cursor:default}',
    '.gp-stepnum{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:2px solid var(--gp-line);background:var(--gp-card);font-size:.82rem;font-weight:700;line-height:1;color:var(--gp-ink2)}',
    '.gp-step.is-done .gp-stepnum{border-color:var(--gp-accent);background:var(--gp-accent);color:var(--gp-on-accent)}',
    '.gp-step.is-current .gp-stepnum{border-color:var(--gp-accent);color:var(--gp-accent);box-shadow:0 0 0 3px var(--gp-card),0 0 0 5px var(--gp-warm)}',
    '.gp-steplbl{display:none;margin-top:3px;font-size:.72rem;line-height:1.2;color:var(--gp-ink2)}',
    '.gp-step.is-current .gp-steplbl{display:block;color:var(--gp-ink);font-weight:700}',
    '.gp-stepbtn:not([disabled]):hover .gp-stepnum{border-color:var(--gp-accent)}',
    '@container gp (min-width:560px){.gp-steplbl{display:block}}',

    /* Fokus */
    '.gp-root :focus{outline:none}',
    '.gp-root :focus-visible{outline:3px solid var(--gp-accent);outline-offset:2px}',
    '.gp-h:focus{outline:none}',

    /* Schritt-Inhalt */
    '.gp-body{min-height:200px}',
    '.gp-h{margin:0 0 6px;font-family:var(--gp-serif);font-weight:600;font-size:1.3rem;line-height:1.25;color:var(--gp-ink)}',
    '.gp-sub{margin:0 0 16px;color:var(--gp-ink2);font-size:.97rem}',
    '.gp-field{margin:0 0 18px;padding:0;border:0;min-width:0}',
    '.gp-label{display:block;margin:0 0 4px;font-weight:700;font-size:.95rem;color:var(--gp-ink);padding:0}',
    '.gp-hint{display:block;margin:0 0 8px;font-size:.87rem;color:var(--gp-ink2)}',
    '.gp-input,.gp-textarea{display:block;width:100%;padding:12px 14px;border:1px solid var(--gp-line);border-radius:10px;background:var(--gp-sunk);color:var(--gp-ink);font:inherit;font-size:1rem;line-height:1.5}',
    '.gp-input{min-height:44px}',
    '.gp-textarea{min-height:104px;resize:vertical}',
    '.gp-input::placeholder,.gp-textarea::placeholder{color:var(--gp-ink2);opacity:.85}',
    '.gp-input:focus,.gp-textarea:focus{border-color:var(--gp-accent)}',
    '.gp-input[aria-invalid="true"],.gp-textarea[aria-invalid="true"]{border-color:var(--gp-bad)}',
    '.gp-quote{margin:0 0 18px;overflow-wrap:anywhere;padding:10px 14px;border-left:3px solid var(--gp-accent);background:var(--gp-sunk);border-radius:0 10px 10px 0;font-family:var(--gp-serif);font-size:1.02rem;color:var(--gp-ink)}',
    '.gp-quote small{display:block;margin-bottom:2px;font-family:var(--gp-sans);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gp-ink2);font-weight:600}',

    /* Regler */
    '.gp-rangewrap{display:flex;align-items:center;gap:14px}',
    '.gp-range{flex:1 1 auto;min-width:0;height:44px;margin:0;padding:0;background:transparent;cursor:pointer;-webkit-appearance:none;appearance:none;--gp-fill:50%}',
    '.gp-range::-webkit-slider-runnable-track{height:10px;box-sizing:border-box;border:1px solid var(--gp-line);border-radius:99px;background:linear-gradient(to right,var(--gp-accent) var(--gp-fill),transparent var(--gp-fill)),var(--gp-sunk)}',
    '.gp-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;margin-top:-10px;border-radius:50%;border:3px solid var(--gp-accent);background:var(--gp-card);box-shadow:0 1px 4px rgba(20,25,40,.35)}',
    '.gp-range::-moz-range-track{height:10px;box-sizing:border-box;border:1px solid var(--gp-line);border-radius:99px;background:var(--gp-sunk)}',
    '.gp-range::-moz-range-progress{height:8px;border-radius:99px;background:var(--gp-accent)}',
    '.gp-range::-moz-range-thumb{width:22px;height:22px;border-radius:50%;border:3px solid var(--gp-accent);background:var(--gp-card);box-shadow:0 1px 4px rgba(20,25,40,.35)}',
    '.gp-range:focus-visible{outline-offset:0;border-radius:10px}',
    '.gp-rangeval{flex:none;min-width:3.6rem;text-align:right;font-family:var(--gp-serif);font-size:1.7rem;font-weight:600;line-height:1;color:var(--gp-ink);font-variant-numeric:tabular-nums}',
    '.gp-rangeval small{font-family:var(--gp-sans);font-size:.78rem;font-weight:600;color:var(--gp-ink2);margin-left:1px}',
    '.gp-ends{display:flex;justify-content:space-between;gap:12px;margin:-4px 0 0;font-size:.78rem;color:var(--gp-ink2)}',

    /* Gefühls-Auswahl */
    '.gp-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}',
    '.gp-chip{position:relative;display:inline-block}',
    '.gp-chip input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.gp-chip span{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid var(--gp-line);border-radius:999px;background:var(--gp-card);color:var(--gp-ink);font-size:.95rem}',
    '.gp-chip input:checked + span{border-color:var(--gp-accent);background:var(--gp-accent);color:var(--gp-on-accent);font-weight:700}',
    '.gp-chip input:focus-visible + span{outline:3px solid var(--gp-accent);outline-offset:2px}',
    '.gp-chip:hover input:not(:checked) + span{border-color:var(--gp-accent)}',

    /* Denkfehler */
    '.gp-fgrid{display:grid;grid-template-columns:1fr;gap:8px;margin:0 0 10px}',
    '@container gp (min-width:560px){.gp-fgrid{grid-template-columns:1fr 1fr}}',
    '.gp-fcard{position:relative;display:flex;gap:12px;align-items:flex-start;padding:12px 14px;min-height:44px;border:1px solid var(--gp-line);border-radius:12px;background:var(--gp-card);cursor:pointer}',
    '.gp-fcard input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.gp-fbox{flex:none;position:relative;width:22px;height:22px;margin-top:1px;border:2px solid var(--gp-ink2);border-radius:6px;background:var(--gp-card)}',
    '.gp-fbox::after{content:"";position:absolute;left:6px;top:1px;width:6px;height:12px;border:solid var(--gp-on-accent);border-width:0 2.5px 2.5px 0;transform:rotate(45deg);opacity:0}',
    '.gp-ftext{display:block;min-width:0}',
    '.gp-fname{display:block;font-weight:700;font-size:.95rem;color:var(--gp-ink)}',
    '.gp-fdesc{display:block;margin-top:2px;font-size:.86rem;line-height:1.45;color:var(--gp-ink2)}',
    '.gp-fcard.is-on{border-color:var(--gp-accent);background:var(--gp-sunk);box-shadow:inset 0 0 0 1px var(--gp-accent)}',
    '.gp-fcard.is-on .gp-fbox{border-color:var(--gp-accent);background:var(--gp-accent)}',
    '.gp-fcard.is-on .gp-fbox::after{opacity:1}',
    '.gp-fcard:hover{border-color:var(--gp-accent)}',
    '.gp-fcard:focus-within{outline:3px solid var(--gp-accent);outline-offset:2px}',
    '.gp-count{min-height:1.4em;margin:0;font-size:.87rem;color:var(--gp-ink2)}',

    /* Belege */
    '.gp-cols{display:grid;grid-template-columns:1fr;gap:0 20px}',
    '@container gp (min-width:640px){.gp-cols{grid-template-columns:1fr 1fr}}',
    '.gp-details{margin:0 0 18px;border:1px solid var(--gp-line);border-radius:10px;background:var(--gp-sunk)}',
    '.gp-details summary{min-height:44px;display:flex;align-items:center;padding:0 14px;cursor:pointer;font-weight:600;font-size:.92rem;color:var(--gp-ink);border-radius:10px;list-style-position:inside}',
    '.gp-details[open] summary{border-bottom:1px solid var(--gp-line);border-radius:10px 10px 0 0}',
    '.gp-details > :not(summary){margin:0;padding:12px 14px}',
    '.gp-details ul{list-style:disc;padding:12px 14px 12px 34px;margin:0;font-size:.92rem;color:var(--gp-ink)}',
    '.gp-details li{margin:0 0 6px}',
    '.gp-details li:last-child{margin:0}',

    /* Navigation */
    '.gp-msg{min-height:1.5em;margin:0 0 8px;font-size:.92rem;font-weight:600;color:var(--gp-bad)}',
    '.gp-msg:empty{min-height:0;margin:0}',
    '.gp-nav{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:6px}',
    '.gp-nav-end{margin-left:auto}',
    '.gp-actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
    '.gp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 22px;border:1px solid var(--gp-line);border-radius:999px;background:transparent;color:var(--gp-ink);font:inherit;font-size:.95rem;font-weight:700;line-height:1.2;cursor:pointer;text-align:center}',
    '.gp-btn:hover{border-color:var(--gp-accent);color:var(--gp-accent)}',
    '.gp-btn--primary{border-color:var(--gp-accent);background:var(--gp-accent);color:var(--gp-on-accent)}',
    '.gp-btn--primary:hover{color:var(--gp-on-accent);filter:brightness(1.08)}',
    '.gp-btn--ghost{border-color:transparent;padding:0 12px;color:var(--gp-accent)}',
    '.gp-btn--ghost:hover{border-color:var(--gp-line)}',
    '.gp-btn--danger{border-color:var(--gp-bad);color:var(--gp-bad)}',
    '.gp-btn--danger:hover{border-color:var(--gp-bad);color:var(--gp-bad)}',
    '.gp-btn[disabled]{opacity:.5;cursor:default}',

    /* Karteikarte (Ergebnis) */
    '.gp-card{position:relative;overflow-wrap:anywhere;margin:0 0 18px;padding:18px 16px 16px 20px;border:1px solid var(--gp-line);border-radius:12px;background:var(--gp-card);box-shadow:var(--gp-shadow);overflow:hidden}',
    '.gp-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--gp-warm)}',
    '.gp-card-k{margin:0 0 2px;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--gp-ink2)}',
    '.gp-card-t{margin:0 0 12px;font-family:var(--gp-serif);font-size:1.3rem;font-weight:600;line-height:1.25}',
    '.gp-dl{margin:0}',
    '.gp-row{margin:0 0 12px}',
    '.gp-row dt{margin:0 0 2px;font-size:.74rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;color:var(--gp-ink2)}',
    '.gp-row dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap;color:var(--gp-ink)}',
    '.gp-row--alt dd{padding:10px 12px;border-radius:10px;background:var(--gp-sunk);border-left:3px solid var(--gp-ok);font-family:var(--gp-serif);font-size:1.05rem}',
    '.gp-tags{display:flex;flex-wrap:wrap;gap:6px}',
    '.gp-tag{display:inline-block;padding:3px 10px;border:1px solid var(--gp-accent);border-radius:999px;font-size:.82rem;font-weight:600;color:var(--gp-accent);white-space:normal}',
    '.gp-shift{margin:14px 0 4px;padding:12px 0 0;border-top:1px dashed var(--gp-line)}',
    '.gp-shift-row{margin:0 0 12px}',
    '.gp-shift-t{margin:0 0 4px;font-size:.88rem;font-weight:700}',
    '.gp-bar{display:grid;grid-template-columns:4.6rem 1fr 3.6rem;align-items:center;gap:10px;margin:3px 0;font-size:.85rem;color:var(--gp-ink2)}',
    '.gp-bar-track{height:10px;border-radius:99px;background:var(--gp-sunk);border:1px solid var(--gp-line);overflow:hidden}',
    '.gp-bar-fill{display:block;height:100%;border-radius:99px;background:var(--gp-ink2)}',
    '.gp-bar--after .gp-bar-fill{background:var(--gp-accent)}',
    '.gp-bar-num{text-align:right;font-weight:700;color:var(--gp-ink);font-variant-numeric:tabular-nums}',
    '.gp-verdict{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:var(--gp-sunk);font-size:.95rem;color:var(--gp-ink)}',
    '.gp-copyout{margin:10px 0 0}',
    '.gp-copyout textarea{min-height:150px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88rem}',
    '.gp-copymsg{min-height:1.4em;margin:8px 0 0;padding-left:10px;border-left:3px solid var(--gp-ok);font-size:.9rem;font-weight:600;color:var(--gp-ink)}',
    '.gp-copymsg:empty{min-height:0;margin:0;padding:0;border:0}',

    /* Einordnung */
    '.gp-einordnung{margin:26px 0 0;padding-top:20px;border-top:1px solid var(--gp-line)}',
    '.gp-einordnung h4{margin:0 0 10px;font-family:var(--gp-serif);font-size:1.3rem;font-weight:600;line-height:1.25}',
    '.gp-einordnung h5{margin:20px 0 8px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;color:var(--gp-ink2)}',
    '.gp-einordnung p{margin:0 0 12px}',
    '.gp-einordnung ul{margin:0 0 12px;padding:0 0 0 20px}',
    '.gp-einordnung li{margin:0 0 8px}',
    '.gp-help{margin:16px 0 4px;padding:12px 14px;border:1px solid var(--gp-line);border-left:3px solid var(--gp-warm);border-radius:10px;background:var(--gp-sunk);font-size:.93rem}',
    '.gp-help p{margin:0}',
    '.gp-src{margin:14px 0 0;font-size:.84rem;color:var(--gp-ink2)}',
    '.gp-src ul{padding-left:18px;list-style:disc}',
    '.gp-src li{margin:0 0 6px}',

    /* Fuß */
    '.gp-foot{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;margin-top:18px;padding-top:12px;border-top:1px solid var(--gp-line);font-size:.84rem;color:var(--gp-ink2)}',
    '.gp-foot p{flex:1 1 220px}',

    /* Screenreader-only */
    '.gp-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',

    /* Bewegung nur, wenn erwünscht */
    '@media (prefers-reduced-motion:no-preference){',
    '.gp-enter{animation:gp-in .28s ease both}',
    '@keyframes gp-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.gp-bar-fill{animation:gp-grow .7s cubic-bezier(.2,.7,.2,1) both}',
    '@keyframes gp-grow{from{width:0}}',
    '.gp-btn,.gp-chip span,.gp-fcard,.gp-stepnum{transition:background-color .15s,border-color .15s,color .15s}',
    '.gp-btn:active{transform:translateY(1px)}',
    '}',
    '@media (forced-colors:active){.gp-fbox::after{border-color:CanvasText}.gp-chip input:checked + span{outline:2px solid Highlight}}'
  ].join('\n');

  function injectStyles() {
    if (!document.head) return;
    if (document.head.querySelector('style[data-gx="gedankenprotokoll"]')) return;
    var st = document.createElement('style');
    st.setAttribute('data-gx', 'gedankenprotokoll');
    st.textContent = CSS.replace(/\.gp-/g, '.' + P);
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ *
   * Mount
   * ------------------------------------------------------------------ */

  function mount(container, ctx) {
    injectStyles();
    var uid = ++uidCounter;
    var idp = P + uid + '-';
    var fieldCounter = 0;
    var destroyed = false;
    var timers = [];

    var state;
    function fresh() {
      return {
        step: 0,
        maxStep: 0,
        finished: false,
        situation: '', thought: '', belief: 50,
        feeling: '', feelingOther: '', intensity: 50,
        fehler: {},
        pro: '', contra: '', alt: '',
        intensity2: null, belief2: null
      };
    }
    state = fresh();

    var refs = {};          // Felder des aktuellen Schritts (Fokus bei Fehlern)
    var copyText = '';
    var resetArmed = false;
    var resetTimer = null;

    /* Gerüst */
    var live = h('div', { 'class': P + 'sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    var stepsEl = h('ol', { 'class': P + 'steps' });
    var navEl = h('nav', { 'aria-label': 'Fortschritt im Gedankenprotokoll' }, stepsEl);
    var bodyEl = h('div', { 'class': P + 'body' });
    var msgEl = h('p', { 'class': P + 'msg', role: 'alert' });
    var actionsEl = h('div', { 'class': P + 'nav' });
    var resetBtn = h('button', { 'class': P + 'btn ' + P + 'btn--ghost', type: 'button', on: { click: onResetClick } }, 'Zurücksetzen');

    var titleId = idp + 'title';
    var panel = h('div', { 'class': P + 'panel' },
      h('p', { 'class': P + 'plaque' }, 'Exponat · Kognitive Umstrukturierung'),
      h('h3', { 'class': P + 'title', id: titleId }, 'Gedankenprotokoll'),
      h('p', { 'class': P + 'note' },
        h('span', null, rich('**Bildungsübung, keine Therapie.** Bei starker Belastung hol dir bitte professionelle Hilfe – '),
          'Telefonseelsorge: ',
          h('a', { href: 'tel:08001110111' }, '0800' + NBSP + '111' + NBSP + '0' + NBSP + '111'),
          ' oder ',
          h('a', { href: 'tel:116123' }, '116' + NBSP + '123'),
          ' (kostenfrei, rund um die Uhr).')),
      navEl,
      bodyEl,
      msgEl,
      actionsEl,
      h('div', { 'class': P + 'foot' },
        h('p', null, 'Alles bleibt auf deinem Gerät: Nichts wird gesendet oder gespeichert – beim Verlassen oder Neuladen der Seite ist alles weg.'),
        resetBtn));

    var root = h('section', { 'class': P + 'root', 'aria-labelledby': titleId },
      h('p', { 'class': P + 'lead' },
        rich('**Probier es aus:** Denk an einen Moment, der dich zuletzt kurz aus der Bahn geworfen hat, und prüfe in sechs kleinen Schritten, was dein Kopf daraus gemacht hat. Das dauert etwa fünf Minuten.')),
      h('div', { 'class': P + 'frame' }, panel),
      h('div', { 'class': P + 'plinth', 'aria-hidden': 'true' }),
      live);

    /* ---------- Hilfsfunktionen im Mount ---------- */

    function say(text) {
      live.textContent = '';
      later(function () { live.textContent = text; }, 30);
    }

    function later(fn, ms) {
      var t = window.setTimeout(function () { if (!destroyed) fn(); }, ms);
      timers.push(t);
      return t;
    }

    function setMsg(text) { msgEl.textContent = text || ''; }

    function feelingName() {
      if (state.feeling === OTHER) return state.feelingOther.trim() || 'Anderes Gefühl';
      return state.feeling;
    }
    function i1() { return state.intensity; }
    function i2() { return state.intensity2 === null ? state.intensity : state.intensity2; }
    function b1() { return state.belief; }
    function b2() { return state.belief2 === null ? state.belief : state.belief2; }
    function chosenFehler() {
      return FEHLER.filter(function (f) { return state.fehler[f.id]; });
    }

    function isPristine() {
      return !state.situation.trim() && !state.thought.trim() && !state.feeling && !state.pro.trim() &&
        !state.contra.trim() && !state.alt.trim() && !chosenFehler().length;
    }

    function focusLater(node) {
      later(function () {
        if (!node) return;
        try { node.focus({ preventScroll: true }); } catch (e) { node.focus(); }
        try {
          var r = panel.getBoundingClientRect();
          if (r.top < 0 || r.top > window.innerHeight * 0.45) {
            node.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
          }
        } catch (e) { /* kein Scrollen nötig */ }
      }, 40);
    }

    function field(labelText, hintText) {
      var id = idp + 'f' + (++fieldCounter);
      return { id: id, label: labelText, hint: hintText, hintId: id + '-h' };
    }

    function textareaField(key, labelText, hintText, placeholder, rows) {
      var f = field(labelText, hintText);
      var ta = h('textarea', {
        'class': P + 'textarea', id: f.id, rows: rows || 4, maxlength: 700,
        placeholder: placeholder || null, 'aria-describedby': hintText ? f.hintId : null
      });
      ta.value = state[key];
      ta.addEventListener('input', function () {
        state[key] = ta.value;
        ta.removeAttribute('aria-invalid');
        setMsg('');
      });
      var wrap = h('div', { 'class': P + 'field' },
        h('label', { 'class': P + 'label', 'for': f.id }, labelText),
        hintText ? h('span', { 'class': P + 'hint', id: f.hintId }, hintText) : null,
        ta);
      return { wrap: wrap, input: ta };
    }

    // getVal/setVal kapseln, ob ein Wert „mitläuft“ (Neubewertung)
    function sliderField(labelText, hintText, endsLo, endsHi, getVal, setVal, unitText) {
      var f = field(labelText, hintText);
      var out = h('span', { 'class': P + 'rangeval', 'aria-hidden': 'true' });
      var range = h('input', {
        'class': P + 'range', type: 'range', id: f.id, min: 0, max: 100, step: 1,
        'aria-describedby': f.hintId
      });
      function paint() {
        var v = getVal();
        range.value = v;
        range.style.setProperty('--gp-fill', v + '%');
        range.setAttribute('aria-valuetext', v + ' von 100');
        out.textContent = '';
        out.appendChild(document.createTextNode(String(v)));
        if (unitText) out.appendChild(h('small', { text: unitText }));
      }
      range.addEventListener('input', function () {
        setVal(clampNum(range.value, 0, 100, 0));
        paint();
      });
      paint();
      var wrap = h('div', { 'class': P + 'field' },
        h('label', { 'class': P + 'label', 'for': f.id }, labelText),
        h('span', { 'class': P + 'hint', id: f.hintId }, hintText),
        h('div', { 'class': P + 'rangewrap' }, range, out),
        h('div', { 'class': P + 'ends', 'aria-hidden': 'true' }, h('span', null, endsLo), h('span', null, endsHi)));
      return { wrap: wrap, input: range };
    }

    /* ---------- Fortschrittsleiste ---------- */

    function renderSteps() {
      stepsEl.textContent = '';
      var total = STEPS.length + 1;
      for (var i = 0; i < total; i++) {
        (function (i) {
          var isResult = i === STEPS.length;
          var label = isResult ? RESULT_LABEL : STEPS[i].label;
          var current = i === state.step;
          var reachable = isResult ? state.finished : i <= state.maxStep;
          var done = !current && !isResult && (i < state.maxStep || (state.finished && i < STEPS.length));
          var cls = P + 'step' + (current ? ' is-current' : '') + (done ? ' is-done' : '');
          var stateText = current ? 'aktueller Schritt' : (done ? 'erledigt' : (reachable ? '' : 'noch nicht erreichbar'));
          var btn = h('button', {
            'class': P + 'stepbtn', type: 'button',
            disabled: !reachable ? true : null,
            'aria-current': current ? 'step' : null,
            'aria-label': (isResult ? 'Ergebnis-Karte' : 'Schritt ' + (i + 1) + ': ' + label) + (stateText ? ' (' + stateText + ')' : ''),
            on: { click: function () { if (i !== state.step) goTo(i, true); } }
          },
          h('span', { 'class': P + 'stepnum', 'aria-hidden': 'true' }, done ? '\u2713' : (isResult ? '\u2605' : String(i + 1))),
          h('span', { 'class': P + 'steplbl', 'aria-hidden': 'true' }, label));
          stepsEl.appendChild(h('li', { 'class': cls }, btn));
        })(i);
      }
    }

    /* ---------- Schritte ---------- */

    function stepHeading(i) {
      var s = STEPS[i];
      refs.heading = h('h4', { 'class': P + 'h', tabindex: '-1' }, s.title);
      return refs.heading;
    }

    function buildStep(i) {
      refs = {};
      var wrap = h('div', { 'class': P + 'enter' });
      wrap.appendChild(stepHeading(i));
      var b = [buildSituation, buildGedanke, buildGefuehl, buildDenkfehler, buildBelege, buildAlternative][i]();
      wrap.appendChild(b);
      return wrap;
    }

    function buildSituation() {
      var frag = document.createDocumentFragment();
      frag.appendChild(h('p', { 'class': P + 'sub' }, 'Beschreibe kurz, was passiert ist – so, wie eine Kamera es aufgenommen hätte: wann, wo, mit wem. Noch ohne Deutung. Such dir für den Anfang etwas Mittelschweres aus, nichts, was dich überwältigt.'));
      var f = textareaField('situation', 'Die Situation', 'Ein, zwei Sätze genügen.', 'z. B. „Ich habe gestern Abend eine Nachricht geschickt. Bis heute Mittag kam keine Antwort.“', 4);
      refs.main = f.input;
      frag.appendChild(f.wrap);
      if (isPristine()) {
        frag.appendChild(h('div', { 'class': P + 'actions' },
          h('button', { 'class': P + 'btn', type: 'button', on: { click: fillExample } }, 'Mit einem Beispiel ausprobieren')));
      }
      return frag;
    }

    function buildGedanke() {
      var frag = document.createDocumentFragment();
      frag.appendChild(h('p', { 'class': P + 'sub' }, 'Welcher Gedanke schoss dir in dieser Situation durch den Kopf? Meist ist es ein kurzer Satz, den man kaum bemerkt. Formuliere ihn als Aussage statt als Frage: nicht „Warum antwortet sie nicht?“, sondern „Sie ist sauer auf mich.“'));
      var f = textareaField('thought', 'Der automatische Gedanke', 'Der erste, spontane Gedanke – so ehrlich wie möglich.', 'z. B. „Das schaffe ich nie.“', 3);
      refs.main = f.input;
      frag.appendChild(f.wrap);
      frag.appendChild(sliderField('Wie sehr glaubst du diesen Gedanken in diesem Moment?', 'Schieb den Regler: 0 = gar nicht, 100 = vollkommen.', '0 · gar nicht', '100 · vollkommen',
        function () { return state.belief; }, function (v) { state.belief = v; }, ' %').wrap);
      return frag;
    }

    function buildGefuehl() {
      var frag = document.createDocumentFragment();
      frag.appendChild(h('p', { 'class': P + 'sub' }, 'Gefühle sind keine Gedanken: Sie lassen sich meist mit einem Wort benennen („Angst“, „Scham“) – während ein Gedanke ein ganzer Satz ist, der stimmen kann oder nicht.'));
      var legendId = idp + 'feel-legend';
      var chips = h('div', { 'class': P + 'chips', role: 'radiogroup', 'aria-labelledby': legendId });
      var name = idp + 'feeling';
      var otherInput;
      function chip(value, text) {
        var input = h('input', { type: 'radio', name: name, value: value });
        input.checked = state.feeling === value;
        input.addEventListener('change', function () {
          state.feeling = value;
          setMsg('');
          otherWrap.hidden = value !== OTHER;
          if (value === OTHER) { later(function () { otherInput.focus(); }, 20); }
        });
        if (!refs.main) refs.main = input;
        return h('label', { 'class': P + 'chip' }, input, h('span', null, text));
      }
      FEELINGS.forEach(function (fl) { chips.appendChild(chip(fl, fl)); });
      chips.appendChild(chip(OTHER, 'Anderes …'));

      var fo = field('Wie nennst du dieses Gefühl?', '');
      otherInput = h('input', { 'class': P + 'input', type: 'text', id: fo.id, maxlength: 40, placeholder: 'z. B. Überforderung' });
      otherInput.value = state.feelingOther;
      otherInput.addEventListener('input', function () { state.feelingOther = otherInput.value; otherInput.removeAttribute('aria-invalid'); setMsg(''); });
      var otherWrap = h('div', { 'class': P + 'field' },
        h('label', { 'class': P + 'label', 'for': fo.id }, 'Wie nennst du dieses Gefühl?'), otherInput);
      otherWrap.hidden = state.feeling !== OTHER;
      refs.other = otherInput;

      frag.appendChild(h('div', { 'class': P + 'field' },
        h('span', { 'class': P + 'label', id: legendId }, 'Das stärkste Gefühl'),
        chips, otherWrap));
      frag.appendChild(sliderField('Wie intensiv war es?', 'Schieb den Regler: 0 = gar nicht, 100 = so stark wie nur möglich.', '0 · gar nicht', '100 · maximal',
        function () { return state.intensity; }, function (v) { state.intensity = v; }, '').wrap);
      return frag;
    }

    function buildDenkfehler() {
      var frag = document.createDocumentFragment();
      frag.appendChild(h('p', { 'class': P + 'sub' }, 'Unser Denken nimmt unter Druck gern Abkürzungen. Kreuze an, was in deinem Gedanken stecken könnte – mehrere sind normal, und „keins davon“ ist auch eine ehrliche Antwort.'));
      var quote = h('blockquote', { 'class': P + 'quote' }, h('small', null, 'Dein Gedanke'), '„' + state.thought.trim() + '“');
      frag.appendChild(quote);
      var count = h('p', { 'class': P + 'count', 'aria-live': 'polite' });
      function updateCount() {
        var n = chosenFehler().length;
        count.textContent = n === 0 ? 'Noch nichts ausgewählt – das ist in Ordnung.' : (n === 1 ? '1 Denkmuster ausgewählt.' : n + ' Denkmuster ausgewählt.');
      }
      var grid = h('div', { 'class': P + 'fgrid', role: 'group', 'aria-label': 'Typische Denkfehler' });
      FEHLER.forEach(function (fe, idx) {
        var input = h('input', { type: 'checkbox', value: fe.id, 'aria-labelledby': idp + 'fn-' + fe.id, 'aria-describedby': idp + 'fd-' + fe.id });
        input.checked = !!state.fehler[fe.id];
        var card = h('label', { 'class': P + 'fcard' + (input.checked ? ' is-on' : '') },
          input,
          h('span', { 'class': P + 'fbox', 'aria-hidden': 'true' }),
          h('span', { 'class': P + 'ftext' },
            h('span', { 'class': P + 'fname', id: idp + 'fn-' + fe.id }, fe.name),
            h('span', { 'class': P + 'fdesc', id: idp + 'fd-' + fe.id }, fe.desc)));
        input.addEventListener('change', function () {
          if (input.checked) state.fehler[fe.id] = true; else delete state.fehler[fe.id];
          card.classList.toggle('is-on', input.checked);
          updateCount();
        });
        if (idx === 0) refs.main = input;
        grid.appendChild(card);
      });
      updateCount();
      frag.appendChild(grid);
      frag.appendChild(count);
      return frag;
    }

    function buildBelege() {
      var frag = document.createDocumentFragment();
      frag.appendChild(h('p', { 'class': P + 'sub' }, 'Prüfe deinen Gedanken wie ein faires Gericht: erst die Fakten, die ihn stützen, dann die, die ihm widersprechen. Fakten sind das, was andere auch beobachten könnten – keine Befürchtungen und keine Gefühle.'));
      var quote = h('blockquote', { 'class': P + 'quote' }, h('small', null, 'Dein Gedanke'), '„' + state.thought.trim() + '“');
      frag.appendChild(quote);
      var pro = textareaField('pro', 'Was spricht dafür?', 'Tatsachen, die den Gedanken stützen.', 'z. B. „Sie hat bisher nicht geantwortet.“', 5);
      var contra = textareaField('contra', 'Was spricht dagegen?', 'Tatsachen, Erfahrungen, andere Erklärungen.', 'z. B. „Sie ist diese Woche auf Dienstreise.“', 5);
      refs.main = pro.input;
      frag.appendChild(h('div', { 'class': P + 'cols' }, pro.wrap, contra.wrap));
      var list = h('ul');
      EVIDENCE_QUESTIONS.forEach(function (q) { list.appendChild(h('li', { text: q })); });
      frag.appendChild(h('details', { 'class': P + 'details' }, h('summary', null, 'Fragen, die beim Prüfen helfen'), list));
      return frag;
    }

    function buildAlternative() {
      var frag = document.createDocumentFragment();
      frag.appendChild(h('p', { 'class': P + 'sub' }, 'Formuliere jetzt eine ausgewogenere Sicht, die deine Belege berücksichtigt. Sie muss nicht rosig sein, nur realistischer – etwa mit „Es kann auch sein, dass …“ oder „Einerseits …, andererseits …“.'));
      frag.appendChild(h('blockquote', { 'class': P + 'quote' }, h('small', null, 'Dein erster Gedanke'), '„' + state.thought.trim() + '“'));
      var alt = textareaField('alt', 'Der Alternativgedanke', 'Was ist eine hilfreiche, glaubwürdige Sicht auf die Situation?', 'z. B. „Vermutlich ist sie unterwegs. Ich weiß es nicht – ich frage morgen nach.“', 4);
      refs.main = alt.input;
      frag.appendChild(alt.wrap);
      frag.appendChild(sliderField('Wie intensiv ist „' + feelingName() + '“ jetzt?', 'Vorher: ' + i1() + ' von 100. Schieb den Regler dorthin, wo du dich jetzt einordnest – es darf auch gleich bleiben.', '0 · gar nicht', '100 · maximal',
        i2, function (v) { state.intensity2 = v; }, '').wrap);
      frag.appendChild(sliderField('Wie sehr glaubst du den ersten Gedanken jetzt noch?', 'Vorher: ' + b1() + ' %. Schieb den Regler: 0 = gar nicht, 100 = vollkommen.', '0 · gar nicht', '100 · vollkommen',
        b2, function (v) { state.belief2 = v; }, ' %').wrap);
      return frag;
    }

    /* ---------- Validierung & Navigation ---------- */

    function validate(i) {
      if (i === 0 && !state.situation.trim()) return { msg: 'Beschreib kurz die Situation – ein, zwei Sätze genügen.', el: refs.main };
      if (i === 1 && !state.thought.trim()) return { msg: 'Schreib den Gedanken auf, der dir durch den Kopf ging.', el: refs.main };
      if (i === 2) {
        if (!state.feeling) return { msg: 'Wähl ein Gefühl aus – oder trag unter „Anderes …“ dein eigenes Wort ein.', el: refs.main };
        if (state.feeling === OTHER && !state.feelingOther.trim()) return { msg: 'Wie nennst du dieses Gefühl? Trag bitte ein Wort ein.', el: refs.other };
      }
      if (i === 5 && !state.alt.trim()) return { msg: 'Formuliere einen Alternativgedanken – er muss nicht perfekt sein.', el: refs.main };
      return null;
    }

    function next() {
      var err = validate(state.step);
      if (err) {
        setMsg(err.msg);
        if (err.el) {
          if (err.el.tagName === 'TEXTAREA' || err.el.tagName === 'INPUT' && err.el.type === 'text') err.el.setAttribute('aria-invalid', 'true');
          focusLater(err.el);
        }
        return;
      }
      setMsg('');
      if (state.step === STEPS.length - 1) {
        state.finished = true;
        state.maxStep = STEPS.length;
        goTo(STEPS.length, false);
      } else {
        goTo(state.step + 1, false);
      }
    }

    function goTo(i, fromStepper) {
      if (fromStepper && i > state.step) {
        // Vorwärtssprung über die Leiste: erst die Schritte dazwischen prüfen
        for (var k = state.step; k < i; k++) {
          var e = validate(k);
          if (e) {
            if (k !== state.step) { goTo(k, false); e = validate(k) || e; }
            setMsg(e.msg);
            if (e.el) { if (e.el.tagName === 'TEXTAREA' || (e.el.tagName === 'INPUT' && e.el.type === 'text')) e.el.setAttribute('aria-invalid', 'true'); focusLater(e.el); }
            return;
          }
        }
      }
      setMsg('');
      state.step = i;
      if (i > state.maxStep) state.maxStep = i;
      render();
      if (i === STEPS.length) {
        say(verdictText());
      } else {
        say('Schritt ' + (i + 1) + ' von ' + STEPS.length + ': ' + STEPS[i].label + '.');
      }
      focusLater(refs.heading);
    }

    function back() { if (state.step > 0) goTo(state.step - 1, false); }

    /* ---------- Ergebnis ---------- */

    function verdictText() {
      var name = feelingName();
      var a = i1(), b = i2(), d = b - a, parts = [];
      if (d < 0) parts.push('„' + name + '“ ist von ' + a + ' auf ' + b + ' gesunken (' + MINUS + Math.abs(d) + ' Punkte). Das ist nur eine Momentaufnahme – aber sie zeigt, dass Deutungen Gefühle bewegen können.');
      else if (d > 0) parts.push('„' + name + '“ ist von ' + a + ' auf ' + b + ' gestiegen (+' + d + ' Punkte). Das kann passieren, wenn man sich genauer mit etwas Belastendem befasst. Gönn dir eine Pause, und sprich mit jemandem, wenn es nicht nachlässt.');
      else parts.push('„' + name + '“ ist bei ' + a + ' geblieben. Das ist häufig, gerade beim ersten Durchgang: Gefühle hinken den Gedanken oft hinterher, und manchmal stimmt ein Gedanke ja auch zum Teil.');
      if (b >= 85) parts.push('Der Wert ist hoch. Wenn dich das belastet: Such dir bitte Gesellschaft oder ein Gespräch – Anlaufstellen findest du weiter unten.');
      if (b1() !== b2()) parts.push('Den ersten Gedanken glaubst du jetzt zu ' + pct(b2()) + ' statt zu ' + pct(b1()) + '.');
      return parts.join(' ');
    }

    function buildCopyText() {
      var lines = [];
      var f = chosenFehler().map(function (x) { return x.name; });
      lines.push('GEDANKENPROTOKOLL');
      lines.push('');
      lines.push('Situation:');
      lines.push(state.situation.trim());
      lines.push('');
      lines.push('Automatischer Gedanke (geglaubt zu ' + pct(b1()) + '):');
      lines.push(state.thought.trim());
      lines.push('');
      lines.push('Gefühl: ' + feelingName() + ', Intensität ' + i1() + ' von 100');
      lines.push('Denkfehler: ' + (f.length ? f.join(', ') : 'keine ausgewählt'));
      lines.push('');
      lines.push('Was spricht dafür:');
      lines.push(state.pro.trim() || '–');
      lines.push('');
      lines.push('Was spricht dagegen:');
      lines.push(state.contra.trim() || '–');
      lines.push('');
      lines.push('Alternativgedanke:');
      lines.push(state.alt.trim());
      lines.push('');
      var d = i2() - i1();
      lines.push('Neu bewertet: ' + feelingName() + ' ' + i1() + ' → ' + i2() + ' von 100 (' + (d > 0 ? '+' + d : d < 0 ? MINUS + Math.abs(d) : '±0') + ')');
      lines.push('Glaube an den ersten Gedanken: ' + pct(b1()) + ' → ' + pct(b2()));
      lines.push('');
      lines.push('Erstellt im Gehirnmuseum – Bildungsübung, keine Therapie.');
      return lines.join('\n');
    }

    function shiftRow(title, v1, v2, unit) {
      function bar(label, v, isAfter) {
        var fill = h('span', { 'class': P + 'bar-fill' });
        fill.style.width = v + '%';
        return h('div', { 'class': P + 'bar' + (isAfter ? ' ' + P + 'bar--after' : '') },
          h('span', { text: label }),
          h('span', { 'class': P + 'bar-track', 'aria-hidden': 'true' }, fill),
          h('span', { 'class': P + 'bar-num', text: v + unit }));
      }
      return h('div', { 'class': P + 'shift-row', role: 'group', 'aria-label': title + ': vorher ' + v1 + unit + ', nachher ' + v2 + unit },
        h('p', { 'class': P + 'shift-t', 'aria-hidden': 'true' }, title),
        bar('Vorher', v1, false), bar('Nachher', v2, true));
    }

    function row(term, content, extraClass) {
      return h('div', { 'class': P + 'row' + (extraClass ? ' ' + extraClass : '') },
        h('dt', null, term), h('dd', null, content));
    }

    function buildResult() {
      refs = {};
      var wrap = h('div', { 'class': P + 'enter' });
      refs.heading = h('h4', { 'class': P + 'h', tabindex: '-1' }, 'Dein Gedankenprotokoll');
      wrap.appendChild(refs.heading);
      wrap.appendChild(h('p', { 'class': P + 'sub' }, 'Fertig. Hier siehst du alles auf einen Blick – zum Mitnehmen, wenn du magst.'));

      var f = chosenFehler();
      var dl = h('dl', { 'class': P + 'dl' },
        row('Situation', state.situation.trim()),
        row('Automatischer Gedanke', '„' + state.thought.trim() + '“'),
        row('Gefühl', feelingName() + ' · ' + i1() + ' von 100'),
        row('Denkfehler', f.length
          ? h('span', { 'class': P + 'tags' }, f.map(function (x) { return h('span', { 'class': P + 'tag', text: x.name }); }))
          : 'keine ausgewählt'),
        state.pro.trim() ? row('Dafür spricht', state.pro.trim()) : null,
        state.contra.trim() ? row('Dagegen spricht', state.contra.trim()) : null,
        row('Alternativgedanke', state.alt.trim(), P + 'row--alt'));

      var shift = h('div', { 'class': P + 'shift' },
        shiftRow('Gefühl · ' + feelingName(), i1(), i2(), ''),
        shiftRow('Glaube an den ersten Gedanken', b1(), b2(), NBSP + '%'));

      var verdict = h('p', { 'class': P + 'verdict', text: verdictText() });
      var copyMsg = h('p', { 'class': P + 'copymsg', role: 'status' });
      var copyOut = h('div', { 'class': P + 'copyout', hidden: true });

      var copyBtn = h('button', { 'class': P + 'btn ' + P + 'btn--primary', type: 'button', on: { click: function () {
        copyText = buildCopyText();
        copyToClipboard(copyText, function (ok) {
          if (destroyed) return;
          if (ok) {
            copyMsg.textContent = 'Kopiert. Du kannst den Text jetzt irgendwo einfügen.';
            copyOut.hidden = true;
            say('Der Text wurde in die Zwischenablage kopiert.');
          } else {
            copyMsg.textContent = 'Automatisches Kopieren hat nicht geklappt. Der Text ist unten markiert – kopiere ihn mit Strg + C (am Smartphone: lange tippen, „Kopieren“).';
            copyOut.textContent = '';
            var ta = h('textarea', { 'class': P + 'textarea', readonly: true, rows: 10, 'aria-label': 'Protokoll als Text' });
            ta.value = copyText;
            copyOut.appendChild(ta);
            copyOut.hidden = false;
            ta.focus();
            ta.select();
            say('Das automatische Kopieren hat nicht geklappt. Der Text ist markiert und kann mit Strg plus C kopiert werden.');
          }
        });
      } } }, 'Als Text kopieren');
      var editBtn = h('button', { 'class': P + 'btn', type: 'button', on: { click: function () { goTo(0, false); } } }, 'Angaben bearbeiten');

      var card = h('article', { 'class': P + 'card', 'aria-label': 'Zusammenfassung deines Gedankenprotokolls' },
        h('p', { 'class': P + 'card-k' }, 'Karteikarte · Gedankenprotokoll'),
        h('p', { 'class': P + 'card-t' }, 'Vom ersten Gedanken zur ausgewogeneren Sicht'),
        dl, shift, verdict);
      wrap.appendChild(card);
      wrap.appendChild(h('div', { 'class': P + 'actions' }, copyBtn, editBtn));
      wrap.appendChild(copyMsg);
      wrap.appendChild(copyOut);
      wrap.appendChild(buildEinordnung());
      return wrap;
    }

    function srcItem(text) { return h('li', { text: text }); }

    function buildEinordnung() {
      var sec = h('section', { 'class': P + 'einordnung', 'aria-labelledby': idp + 'ein' });
      sec.appendChild(h('h4', { id: idp + 'ein' }, 'Was du gerade erlebt hast'));
      sec.appendChild(h('p', null, rich('Du hast eine Runde **kognitive Umstrukturierung** gedreht, einen Kernbaustein der Kognitiven Verhaltenstherapie. Die Idee geht auf Aaron T. Beck zurück: Schon in den frühen 1960er-Jahren beschrieb er, dass depressive Menschen Ereignisse in wiederkehrenden, verzerrten Mustern deuten (Beck, 1963). Ein Gefühl entsteht demnach nicht allein durch die Situation, sondern auch durch die Bedeutung, die wir ihr in Sekundenbruchteilen geben – oft unbemerkt, als „automatischer Gedanke“.')));
      sec.appendChild(h('p', null, 'Das Protokoll bremst diesen Automatismus: Es schreibt den Gedanken auf, macht Denkmuster benennbar und prüft ihn an Belegen, bevor eine ausgewogenere Sicht daneben gestellt wird. Dabei geht es nicht ums Schönreden, sondern um einen Gedanken, der der Wirklichkeit besser gerecht wird – er darf Unbequemes enthalten. Die Liste der Denkfehler ist in dieser Alltagsform vor allem durch David D. Burns (1980) bekannt geworden; das Gedankenprotokoll mit Gefühlsbewertung davor und danach kennen viele aus dem Arbeitsbuch „Mind Over Mood“ (Greenberger & Padesky, 1995).'));
      sec.appendChild(h('p', null, 'Die KVT gehört bei Depressionen und Angststörungen zu den am besten untersuchten Psychotherapien (Überblick: Hofmann et al., 2012). Wie viel genau die Gedankenarbeit selbst beiträgt, wird allerdings diskutiert: In einer viel zitierten Studie war reine Verhaltensaktivierung bei Depression ungefähr so wirksam wie Varianten, die zusätzlich Gedanken bearbeiteten (Jacobson et al., 1996).'));

      sec.appendChild(h('h5', null, 'Wo die Grenzen liegen'));
      sec.appendChild(h('ul', null,
        h('li', null, rich('**Eine Runde ist ein Eindruck, kein Effekt.** Dass dein Wert gerade gesunken ist, sagt wenig darüber, ob dir die Methode langfristig hilft. Wirksam wird sie durch Übung – in der Therapie meist über Wochen und mit Rückmeldung einer Fachperson.')),
        h('li', null, rich('**Die Zahlen sind Selbsteinschätzungen.** Sie hängen von Tagesform und Erwartung ab und sind kein Messinstrument.')),
        h('li', null, rich('**Nicht jeder belastende Gedanke ist verzerrt.** Manchmal stimmt er – dann helfen eher Problemlösen, Unterstützung oder Akzeptanz als Umdeuten. Andere Ansätze, etwa die Akzeptanz- und Commitment-Therapie, setzen deshalb weniger darauf, Gedanken zu prüfen, und mehr darauf, Abstand zu ihnen zu gewinnen.')),
        h('li', null, rich('**Die Denkfehler-Liste ist eine Denkhilfe, keine Diagnose.** Die Kategorien überlappen sich, und es gibt keine feste, allgemeingültige Liste.')),
        h('li', null, rich('**Kein Ersatz für Hilfe.** Bei starker Belastung, anhaltendem Grübeln, Panik, belastenden Erinnerungen oder Gedanken, dir etwas anzutun, gehört das nicht aufs Papier, sondern in ein Gespräch mit einer Fachperson.'))));

      sec.appendChild(h('div', { 'class': P + 'help' }, h('p', null, rich('**Wenn es dir gerade nicht gut geht:** Die Telefonseelsorge ist anonym, kostenfrei und rund um die Uhr erreichbar – '),
        h('a', { href: 'tel:08001110111' }, '0800' + NBSP + '111' + NBSP + '0' + NBSP + '111'), ', ',
        h('a', { href: 'tel:08001110222' }, '0800' + NBSP + '111' + NBSP + '0' + NBSP + '222'), ' oder ',
        h('a', { href: 'tel:116123' }, '116' + NBSP + '123'), ' (Deutschland). In akuter Gefahr: ',
        h('a', { href: 'tel:112' }, '112'), '.')));

      var src = h('details', { 'class': P + 'details ' + P + 'src' }, h('summary', null, 'Quellen'),
        h('ul', null,
          srcItem('Beck, A. T. (1963). Thinking and depression: I. Idiosyncratic content and cognitive distortions. Archives of General Psychiatry, 9(4), 324–333.'),
          srcItem('Burns, D. D. (1980). Feeling Good: The New Mood Therapy. New York: William Morrow.'),
          srcItem('Greenberger, D. & Padesky, C. A. (1995). Mind Over Mood: Change How You Feel by Changing the Way You Think. New York: Guilford Press.'),
          srcItem('Hofmann, S. G., Asnaani, A., Vonk, I. J. J., Sawyer, A. T. & Fang, A. (2012). The efficacy of cognitive behavioral therapy: A review of meta-analyses. Cognitive Therapy and Research, 36(5), 427–440.'),
          srcItem('Jacobson, N. S. et al. (1996). A component analysis of cognitive-behavioral treatment for depression. Journal of Consulting and Clinical Psychology, 64(2), 295–304.')));
      src.style.marginTop = '14px';
      sec.appendChild(src);
      return sec;
    }

    /* ---------- Kopieren (Clipboard mit Fallback) ---------- */

    function copyToClipboard(text, done) {
      function legacy() {
        var ok = false;
        var prev = document.activeElement;
        var ta = h('textarea', { readonly: true, 'aria-hidden': 'true', tabindex: '-1' });
        ta.value = text;
        ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
        root.appendChild(ta);
        try {
          ta.focus();
          ta.select();
          ta.setSelectionRange(0, text.length);
          ok = document.execCommand('copy');
        } catch (e) { ok = false; }
        if (ta.parentNode) ta.parentNode.removeChild(ta);
        if (prev && prev.focus && document.body.contains(prev)) { try { prev.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
        done(!!ok);
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext !== false) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, legacy);
          return;
        }
      } catch (e) { /* weiter mit Fallback */ }
      legacy();
    }

    /* ---------- Beispiel & Zurücksetzen ---------- */

    function fillExample() {
      state.situation = EXAMPLE.situation;
      state.thought = EXAMPLE.thought;
      state.belief = EXAMPLE.belief;
      state.feeling = EXAMPLE.feeling;
      state.intensity = EXAMPLE.intensity;
      state.fehler = {};
      EXAMPLE.fehler.forEach(function (id) { state.fehler[id] = true; });
      state.pro = EXAMPLE.pro;
      state.contra = EXAMPLE.contra;
      state.alt = EXAMPLE.alt;
      state.intensity2 = EXAMPLE.intensity2;
      state.belief2 = EXAMPLE.belief2;
      render();
      say('Beispiel eingesetzt. Klick dich mit „Weiter“ durch die Schritte, du kannst alles ändern.');
      focusLater(refs.heading);
    }

    function disarmReset() {
      resetArmed = false;
      if (resetTimer) { window.clearTimeout(resetTimer); resetTimer = null; }
      resetBtn.textContent = 'Zurücksetzen';
      resetBtn.classList.remove(P + 'btn--danger');
    }

    function onResetClick() {
      if (!resetArmed && !isPristine()) {
        resetArmed = true;
        resetBtn.textContent = 'Wirklich alles löschen?';
        resetBtn.classList.add(P + 'btn--danger');
        say('Zum Löschen aller Eingaben noch einmal auf „Wirklich alles löschen?“ drücken.');
        resetTimer = window.setTimeout(function () { if (!destroyed) disarmReset(); }, 5000);
        timers.push(resetTimer);
        return;
      }
      disarmReset();
      state = fresh();
      copyText = '';
      render();
      say('Zurückgesetzt. Alle Eingaben sind gelöscht.');
      focusLater(refs.heading);
    }

    /* ---------- Render ---------- */

    function renderActions() {
      actionsEl.textContent = '';
      if (state.step === STEPS.length) { actionsEl.hidden = true; return; }
      actionsEl.hidden = false;
      if (state.step > 0) {
        actionsEl.appendChild(h('button', { 'class': P + 'btn', type: 'button', on: { click: back } }, '← Zurück'));
      }
      var last = state.step === STEPS.length - 1;
      actionsEl.appendChild(h('button', { 'class': P + 'btn ' + P + 'btn--primary ' + P + 'nav-end', type: 'button', on: { click: next } },
        last ? 'Protokoll abschließen' : 'Weiter →'));
    }

    function render() {
      renderSteps();
      bodyEl.textContent = '';
      bodyEl.appendChild(state.step === STEPS.length ? buildResult() : buildStep(state.step));
      msgEl.hidden = state.step === STEPS.length;
      renderActions();
    }

    // Globale Kürzel („/“, Pfeiltasten der Reise) sollen beim Tippen und Reglerbedienen nicht dazwischenfunken.
    root.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var t = e.target, tag = t && t.tagName;
      var typing = tag === 'TEXTAREA' || (tag === 'INPUT' && t.type === 'text');
      var nav = e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End';
      if ((typing && (e.key === '/' || nav)) || (tag === 'INPUT' && !typing && nav)) e.stopPropagation();
    });

    container.textContent = '';
    container.appendChild(root);
    render();

    return function destroy() {
      destroyed = true;
      timers.forEach(function (t) { window.clearTimeout(t); });
      timers = [];
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  M.exhibits.gedankenprotokoll = {
    title: 'Gedankenprotokoll',
    blurb: 'Prüfe einen belastenden Gedanken wie ein faires Gericht: Situation, Gefühl, Denkfehler, Belege – und am Ende eine ausgewogenere Alternative.',
    mount: mount
  };
})();

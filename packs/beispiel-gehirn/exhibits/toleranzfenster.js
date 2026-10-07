/* Gehirnmuseum – Exponat „Das Toleranzfenster“
 * MUSEUM.exhibits.toleranzfenster = { title, blurb, mount(container, ctx) -> destroy() }
 * Klassisches Script, keine Abhängigkeiten, keine externen Requests, nichts wird gespeichert.
 *
 * Inhalt: Window of Tolerance (Daniel J. Siegel, 1999). Ein Erregungsregler mit Zuständen
 * (Körper, Denken, Verhalten), Regulations-Ideen je Zone und ein Verlaufsdiagramm zum Selbstzeichnen.
 * Heuristik-Modell – keine Diagnose, kein Trauma-Training.
 */
(function () {
  'use strict';

  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.exhibits = M.exhibits || {};

  var P = 'gx-toleranzfenster-';
  var N = 12;                       // Zeitpunkte im Verlaufsdiagramm
  var SVGNS = 'http://www.w3.org/2000/svg';
  var uidCounter = 0;

  var WIDTHS = {
    eng:    { lo: 38, hi: 62, label: 'Eng',    text: 'Schon kleine Reize bringen dich schneller heraus – zum Beispiel bei Erschöpfung, viel Stress oder nach sehr belastenden Erfahrungen.' },
    mittel: { lo: 30, hi: 70, label: 'Mittel', text: 'Ein Alltagsmaß: Du hältst einiges aus, an manchen Tagen reicht ein Anlass, um herauszurutschen.' },
    weit:   { lo: 20, hi: 80, label: 'Weit',   text: 'Du hältst viel Erregung aus, ohne herauszufallen – zum Beispiel wenn du ausgeruht bist, dich sicher fühlst und gut eingebettet bist.' }
  };
  var WIDTH_ORDER = ['eng', 'mittel', 'weit'];

  var ZONES = {
    hyper:   { name: 'Übererregung',    en: 'Hyperarousal',        short: 'darüber' },
    fenster: { name: 'Toleranzfenster', en: 'Window of Tolerance', short: 'im Fenster' },
    hypo:    { name: 'Untererregung',   en: 'Hypoarousal',         short: 'darunter' }
  };

  /* ------------------------------------------------------------------ *
   * Texte: Zustände
   * ------------------------------------------------------------------ */

  var STATES = {
    hyper2: {
      zone: 'hyper', name: 'Alarmbereitschaft',
      essence: 'Das System steht auf Alarm. Kampf oder Flucht liegen näher als Nachdenken, und kleine Anlässe können riesig wirken.',
      body: ['Herz rast, Atmung schnell und flach', 'Hitze, Zittern oder Schwitzen', 'Muskeln hart angespannt, Enge in Brust oder Hals'],
      mind: ['Gedanken jagen, der Blick wird eng (Tunnelblick)', 'Katastrophenbilder, schwer zu beruhigen', 'Abwägen und Zuhören fallen schwer'],
      acts: ['Wut, Panik, Streit oder der Impuls wegzulaufen', 'Hektik, Schreien oder Weinen', 'Kaum still sitzen, kaum schlafen können']
    },
    hyper1: {
      zone: 'hyper', name: 'Angespannt, aufgedreht',
      essence: 'Du bist über dem Rand des Fensters: aufgewühlt, aber oft noch ansprechbar. Hier fällt Gegensteuern meist leichter als weiter oben.',
      body: ['Unruhe, schnellerer Puls', 'Nacken, Kiefer und Schultern fest', 'Flachere, höhere Atmung'],
      mind: ['Viele Gedanken auf einmal', 'Sorgen kreisen, Abschalten klappt schlecht', 'Die Konzentration springt'],
      acts: ['Ungeduld, schnelles Sprechen', 'Gereiztheit, Hin-und-her-Laufen', 'Viel Kaffee, viel Handy – Hauptsache beschäftigt']
    },
    fenster: {
      zone: 'fenster', name: 'Im Toleranzfenster',
      essence: 'Wach und ansprechbar. Gefühle sind da, auch starke, aber du kannst sie halten, benennen und mit anderen besprechen.',
      body: ['Atmung und Herzschlag fühlen sich stimmig an', 'Muskeln locker bis leicht gespannt', 'Hunger, Müdigkeit und Schmerz sind spürbar'],
      mind: ['Klarer Kopf: abwägen, planen, lernen', 'Du kannst dich in andere hineinversetzen', 'Auch Unangenehmes lässt sich anschauen'],
      acts: ['Im Kontakt: Blick, Stimme, Humor', 'Pausen setzen, um Hilfe bitten', 'Flexibel auf Veränderungen reagieren'],
      note: 'Im Fenster heißt nicht „ruhig“: Auch Ärger, Trauer oder Freude passen hinein, solange du dabei erreichbar bleibst.'
    },
    hypo1: {
      zone: 'hypo', name: 'Gedämpft, müde',
      essence: 'Der Antrieb sinkt. Alles fühlt sich schwer, grau oder ein wenig weit weg an.',
      body: ['Schwere in Armen und Beinen', 'Langsame, kraftlose Bewegungen', 'Kühle Hände, flache Atmung'],
      mind: ['Zähes Denken, Gedanken verschwimmen', 'Konzentration fällt schwer', '„Ist ja eh egal“-Gedanken'],
      acts: ['Rückzug, wenig Antrieb', 'Aufschieben, ins Leere scrollen', 'Wortkarg, kaum Initiative']
    },
    hypo2: {
      zone: 'hypo', name: 'Abgeschaltet, erstarrt',
      essence: 'Das System fährt herunter. Statt Alarm gibt es Leere, Taubheit oder das Gefühl, nicht ganz da zu sein.',
      body: ['Taubheit, der Körper fühlt sich fern an', 'Kraftlosigkeit, wie festgefroren', 'Starrer Blick, Hunger oder Schmerz kaum spürbar'],
      mind: ['Leere im Kopf, Gedankenlücken', 'Nebel oder ein Gefühl von Unwirklichkeit', 'Die Zeit vergeht seltsam'],
      acts: ['Erstarren, Verstummen', 'Kaum Reaktion auf Ansprache', 'Stundenlang regungslos sitzen oder liegen']
    }
  };

  /* ------------------------------------------------------------------ *
   * Texte: Regulations-Ideen (allgemein, nicht therapeutisch)
   * ------------------------------------------------------------------ */

  var IDEAS = {
    hyper: {
      head: 'Tempo rausnehmen',
      lead: 'Wenn zu viel los ist, hilft oft alles, was dem System Zeit, Weite und festen Boden gibt.',
      items: [
        { ic: 'breath', t: 'Atem verlängern', x: 'Atme durch die Nase ein und danach länger aus, zum Beispiel vier Sekunden ein, sechs bis acht Sekunden aus. Ein paar Minuten reichen. Wird dir schwindelig, atme einfach normal weiter.' },
        { ic: 'eye', t: 'Orientieren', x: 'Schau dich langsam im Raum um und benenne fünf Dinge, die du siehst. Der Blick darf wandern – er sagt dem System: Hier ist es gerade sicher genug.' },
        { ic: 'snow', t: 'Kälte', x: 'Kaltes Wasser über Handgelenke oder Gesicht, ein kühler Gegenstand in der Hand oder ein Schluck eiskaltes Wasser.' },
        { ic: 'motion', t: 'Bewegung', x: 'Spannung abführen: Arme und Beine ausschütteln, zügig gehen, Treppen steigen oder die Handflächen fest gegeneinander drücken.' },
        { ic: 'contact', t: 'Kontakt', x: 'Sprich oder schreibe mit einer vertrauten Person. Es muss nicht um das Thema gehen – eine ruhige Stimme zu hören kann schon reichen.' },
        { ic: 'ground', t: 'Boden spüren', x: 'Stell beide Füße fest auf, lehne dich an und gib dein Gewicht ab. Spüre, wo Stuhl, Boden oder Wand dich tragen.' }
      ]
    },
    hypo: {
      head: 'Sanft aktivieren',
      lead: 'Wenn alles gedämpft ist, hilft oft das Gegenteil von Druck: kleine, freundliche Reize und winzige Schritte.',
      items: [
        { ic: 'eye', t: 'Orientieren', x: 'Suche dir aktiv etwas zum Anschauen aus: Farben, Formen, Geräusche im Raum. Benenne, was du wahrnimmst, und lass die Reize bewusst herein.' },
        { ic: 'motion', t: 'Bewegung', x: 'Aufstehen, strecken, die Schultern kreisen lassen, auf der Stelle gehen oder ein paar Schritte vor die Tür machen.' },
        { ic: 'sun', t: 'Wärme oder Kälte', x: 'Etwas Warmes trinken, die Hände unter warmes Wasser halten – oder frische Luft und ein kühles Gesicht als wacher Reiz.' },
        { ic: 'contact', t: 'Kontakt', x: 'Eine kurze Nachricht an jemanden, den du magst. Ein Haustier streicheln. In Gesellschaft sitzen, ohne etwas leisten zu müssen.' },
        { ic: 'sound', t: 'Kräftige Sinnesreize', x: 'Musik mit Rhythmus, ein intensiver Duft oder Geschmack, zum Beispiel Zitrusfrucht, Ingwer oder Minze.' },
        { ic: 'seed', t: 'Winziger Schritt', x: 'Statt viel zu wollen: eine einzige kleine Handlung, etwa ein Glas Wasser trinken oder ein Fenster öffnen. Danach darfst du neu entscheiden.' }
      ]
    },
    fenster: {
      head: 'Das Fenster pflegen',
      lead: 'Im Fenster geht es weniger ums Regulieren als darum, es zu schützen – und es mit der Zeit etwas zu weiten.',
      items: [
        { ic: 'eye', t: 'Frühzeichen kennen', x: 'Welche Signale kündigen bei dir Anspannung oder Abschalten an? Wer sie früh bemerkt, hat mehr Spielraum.' },
        { ic: 'moon', t: 'Grundrhythmen', x: 'Schlaf, regelmäßiges Essen, Bewegung und Pausen. Müdigkeit und Hunger machen das Fenster oft schmaler.' },
        { ic: 'contact', t: 'Verlässliche Beziehungen', x: 'Kontakt zu Menschen, bei denen du dich sicher fühlst, gehört zu den wichtigsten Ressourcen.' },
        { ic: 'dose', t: 'Dosieren', x: 'Schwieriges in kleinen Portionen anschauen, mit Pausen dazwischen – nicht alles auf einmal.' },
        { ic: 'seed', t: 'Neugierig beobachten', x: 'Bemerken ohne zu bewerten: „Aha, gerade bin ich ein Stück angespannt.“ Schon das Benennen schafft oft etwas Abstand.' }
      ]
    }
  };

  var SOURCES = [
    'Siegel, D. J. (1999). The Developing Mind: How Relationships and the Brain Interact to Shape Who We Are. New York: Guilford Press.',
    'Ogden, P., Minton, K., & Pain, C. (2006). Trauma and the Body: A Sensorimotor Approach to Psychotherapy. New York: W. W. Norton.',
    'Corrigan, F. M., Fisher, J. J., & Nutt, D. J. (2011). Autonomic dysregulation and the Window of Tolerance model of the effects of complex emotional trauma. Journal of Psychopharmacology, 25(1), 17–25.',
    'Yerkes, R. M., & Dodson, J. D. (1908). The relation of strength of stimulus to rapidity of habit-formation. Journal of Comparative Neurology and Psychology, 18(5), 459–482.'
  ];

  var EXAMPLES = {
    stress: { label: 'Beispiel: stressiger Tag', data: [48, 55, 66, 78, 86, 72, 58, 52, 64, 74, 60, 46] },
    muede:  { label: 'Beispiel: erschöpfter Tag', data: [42, 36, 28, 20, 14, 18, 30, 38, 26, 16, 22, 34] }
  };

  /* ------------------------------------------------------------------ *
   * Icons (klein, selbst gezeichnet, 24er Raster)
   * ------------------------------------------------------------------ */

  var ICONS = {
    breath: '<path d="M3 9h9a2.5 2.5 0 1 0-2.5-2.5M3 14h14a3 3 0 1 1-3 3M3 19h6"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
    motion: '<path d="M3 18l5.5-6 3.5 3.5L19 7M14.5 6.5H19.5V11.5"/>',
    contact: '<circle cx="8.5" cy="8.5" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M2.5 19c.5-3 2.8-5 6-5s5.5 2 6 5M15 14.6c.7-.3 1.3-.4 2-.4 2.1 0 3.6 1.4 4.2 4"/>',
    ground: '<path d="M3 20h18M12 4v11M8.5 11.5 12 15l3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    sound: '<path d="M4 14v-4h3l5-4v12l-5-4H4zM16 9.2a4 4 0 0 1 0 5.6M18.6 6.6a7.7 7.7 0 0 1 0 10.8"/>',
    seed: '<path d="M12 21v-8M12 13c0-4 3-6.5 7.5-6.5 0 4.2-3 6.5-7.5 6.5zM12 15.5c0-3-2.2-5-6.5-5 0 3.2 2.2 5 6.5 5z"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
    dose: '<path d="M4 7h16M4 12h10M4 17h5"/>',
    body: '<circle cx="12" cy="5" r="2.2"/><path d="M12 8.5v6M12 14.5l-3 6M12 14.5l3 6M6.5 11 12 8.5 17.5 11"/>',
    mind: '<path d="M7 17.5h9.5a4 4 0 0 0 .6-7.95A5.2 5.2 0 0 0 7.2 8.6 4.5 4.5 0 0 0 7 17.5z"/><path d="M6 20.7v.01M3.8 22v.01"/>',
    acts: '<path d="M4 12h15M14 7l5 5-5 5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };

  function icon(name, size) {
    var s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size || 20);
    s.setAttribute('height', size || 20);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.7');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.innerHTML = ICONS[name] || '';
    return s;
  }

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

  function svg(tag, attrs, cls) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (cls) n.setAttribute('class', cls);
    return n;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function c(name) { return P + name; }

  function zoneOf(v, w) { return v < w.lo ? 'hypo' : (v > w.hi ? 'hyper' : 'fenster'); }

  function stateKey(v, w) {
    if (v < w.lo) return v < w.lo / 2 ? 'hypo2' : 'hypo1';
    if (v > w.hi) return v > (w.hi + 100) / 2 ? 'hyper2' : 'hyper1';
    return 'fenster';
  }

  function times(n) { return ['keinmal', 'einmal', 'zweimal', 'dreimal'][n] || (n + ' Mal'); }

  function fmt(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }

  /* ------------------------------------------------------------------ *
   * Styles (einmalig)
   * ------------------------------------------------------------------ */

  var CSS = [
    '.%root{--tz-bg:var(--bg-2,#FFFFFF);--tz-bg3:var(--bg-3,#ECE6DA);--tz-ink:var(--ink,#1B2230);--tz-ink2:var(--ink-2,#5C6577);--tz-line:var(--line,#D9D2C3);',
    '--tz-accent:var(--accent,#05749E);--tz-warm:var(--warm,#FCB300);--tz-hyper:var(--bad,#C0392B);--tz-win:var(--ok,#2F8F5B);--tz-hypo:var(--j-diagnostik,#4B5FBF);',
    '--tz-r:var(--radius,14px);--tz-shadow:var(--shadow,0 1px 2px rgba(20,25,40,.08),0 8px 24px rgba(20,25,40,.08));',
    '--tz-display:var(--font-display,"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif);',
    '--tz-ui:var(--font-ui,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif);',
    'position:relative;max-width:900px;margin:0 auto;color:var(--tz-ink);font-family:var(--tz-ui);font-size:16px;line-height:1.55;text-align:left}',
    '.%root *,.%root *::before,.%root *::after{box-sizing:border-box}',
    '.%root :focus-visible{outline:3px solid var(--tz-accent);outline-offset:3px}',
    '.%root p{margin:0}',
    '.%sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',

    /* Rahmen & Sockel */
    '.%frame{position:relative;background:var(--tz-bg);border:1px solid var(--tz-line);border-radius:calc(var(--tz-r) + 4px);box-shadow:var(--tz-shadow);padding:30px 32px 32px}',
    '.%frame::before{content:"";position:absolute;inset:7px;border:1px solid var(--tz-line);border-radius:calc(var(--tz-r) - 2px);pointer-events:none;opacity:.75}',
    '.%plinth{position:relative;height:16px;margin:-1px 4% 0;background:linear-gradient(var(--tz-bg3),var(--tz-line));border:1px solid var(--tz-line);border-top:0;border-radius:0 0 10px 10px;box-shadow:0 12px 18px -10px rgba(20,25,40,.35)}',
    '.%kicker{display:flex;align-items:center;gap:10px;font:700 11px/1.2 var(--tz-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--tz-ink2)}',
    '.%kicker::before{content:"";width:26px;height:3px;border-radius:2px;background:var(--tz-warm)}',
    '.%title{margin:10px 0 12px;font:600 31px/1.15 var(--tz-display);letter-spacing:-.01em;color:var(--tz-ink)}',
    '.%intro{max-width:64ch;font-size:17px;line-height:1.6}',
    '.%intro strong{font-weight:700}',
    '.%hint{margin-top:12px;max-width:64ch;font-size:14px;color:var(--tz-ink2)}',

    /* Abschnitte */
    '.%sec{margin-top:36px;padding-top:28px;border-top:1px solid var(--tz-line)}',
    '.%h{margin:0 0 6px;font:600 22px/1.25 var(--tz-display);color:var(--tz-ink)}',
    '.%sub{max-width:66ch;font-size:15px;color:var(--tz-ink2)}',

    /* Labor: Skala + Zustand */
    '.%lab{--tz-zone:var(--tz-win);display:grid;grid-template-columns:176px minmax(0,1fr);grid-template-areas:"gauge head" "gauge details";column-gap:32px;row-gap:6px;margin-top:20px;align-items:start}',
    '.%lab[data-zone="hyper"]{--tz-zone:var(--tz-hyper)}',
    '.%lab[data-zone="hypo"]{--tz-zone:var(--tz-hypo)}',
    '.%gaugecol{grid-area:gauge;width:176px}',
    '.%gauge{position:relative;width:176px;height:340px;border-radius:12px;touch-action:none;cursor:ns-resize;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}',
    '.%gauge svg{display:block;width:176px;height:340px;overflow:visible}',
    '.%gbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}',
    '.%head{grid-area:head;min-width:0;overflow-wrap:anywhere}',
    '.%eyebrow{display:flex;align-items:center;gap:8px;min-width:0;font:700 12px/1.3 var(--tz-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--tz-ink2)}',
    '.%dot{flex:none;width:11px;height:11px;border-radius:50%;background:var(--tz-zone);box-shadow:0 0 0 3px var(--tz-bg),0 0 0 4px var(--tz-zone)}',
    '.%name{margin:8px 0 4px;font:600 28px/1.15 var(--tz-display);letter-spacing:-.005em}',
    '.%readout{font-size:14.5px;color:var(--tz-ink2);font-variant-numeric:tabular-nums}',
    '.%readout strong{color:var(--tz-ink)}',
    '.%details{grid-area:details;min-width:0;margin-top:10px}',
    '.%essence{margin:0 0 18px;padding-left:14px;border-left:3px solid var(--tz-zone);font-size:16.5px;line-height:1.55}',
    '.%cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}',
    '.%col{border-top:2px solid var(--tz-zone);padding-top:10px;min-width:0}',
    '.%colh{display:flex;align-items:center;gap:7px;margin:0 0 6px;font:700 12px/1.2 var(--tz-ui);letter-spacing:.1em;text-transform:uppercase}',
    '.%col ul{list-style:none;margin:0;padding:0}',
    '.%col li{position:relative;margin:0 0 6px;padding-left:15px;font-size:14.5px;line-height:1.45}',
    '.%col li::before{content:"";position:absolute;left:0;top:.62em;width:7px;height:2px;border-radius:1px;background:var(--tz-ink2)}',
    '.%note{margin-top:14px;font-size:14px;color:var(--tz-ink2)}',
    '.%notehelp{padding:10px 14px;border:1px dashed var(--tz-line);border-radius:10px}',
    '.%notehelp strong{color:var(--tz-ink)}',

    /* Fensterbreite */
    '.%fieldset{margin:24px 0 0;padding:0;border:0;min-width:0}',
    '.%fieldset legend{padding:0;margin:0 0 8px;font:700 14px/1.3 var(--tz-ui)}',
    '.%seg{display:inline-flex;max-width:100%;border:1px solid var(--tz-line);border-radius:999px;overflow:hidden;background:var(--tz-bg3)}',
    '.%segopt{position:relative;display:block;cursor:pointer}',
    '.%segopt input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}',
    '.%segopt span{display:flex;align-items:center;justify-content:center;min-height:44px;min-width:84px;padding:0 20px;font:600 14.5px/1 var(--tz-ui)}',
    '.%segopt input:checked+span{background:var(--tz-ink);color:var(--tz-bg)}',
    '.%segopt input:focus-visible+span{outline:3px solid var(--tz-accent);outline-offset:-3px}',
    '.%widthcap{margin-top:10px;max-width:66ch;font-size:14.5px;color:var(--tz-ink2)}',

    /* Buttons */
    '.%btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;border:1px solid var(--tz-line);border-radius:999px;background:var(--tz-bg3);color:var(--tz-ink);font:600 14.5px/1.2 var(--tz-ui);cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent}',
    '.%btn:hover{border-color:var(--tz-ink2)}',
    '.%btn:active{transform:translateY(1px)}',
    '.%btn[disabled]{opacity:.5;cursor:default}',
    '.%btn--pri{background:var(--tz-ink);border-color:var(--tz-ink);color:var(--tz-bg)}',
    '.%btn--pri:hover{border-color:var(--tz-ink);opacity:.9}',

    /* Ideen */
    '.%ideagrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin:16px 0 0;padding:0;list-style:none}',
    '.%idea{display:flex;gap:12px;padding:14px 16px;background:var(--tz-bg3);border:1px solid var(--tz-line);border-left:3px solid var(--tz-zone);border-radius:10px}',
    '.%ideaic{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--tz-bg);border:1px solid var(--tz-line);color:var(--tz-ink)}',
    '.%idea h5{margin:1px 0 3px;font:700 15px/1.3 var(--tz-ui)}',
    '.%idea p{font-size:14.5px;line-height:1.5}',
    '.%care{margin-top:16px;padding:12px 16px;border:1px dashed var(--tz-line);border-radius:10px;font-size:14px;color:var(--tz-ink2)}',
    '.%care strong{color:var(--tz-ink)}',

    /* Verlauf */
    '.%chart{position:relative;margin-top:16px;background:var(--tz-bg);border:1px solid var(--tz-line);border-radius:12px;touch-action:none;cursor:crosshair;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}',
    '.%chart svg{display:block;max-width:100%;overflow:hidden;border-radius:11px}',
    '.%ctrl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}',
    '.%step{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 6px;font-size:14px;color:var(--tz-ink2);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.%summary{margin-top:14px;padding:14px 16px;background:var(--tz-bg3);border:1px solid var(--tz-line);border-radius:10px;font-size:15px}',
    '.%summary p+p{margin-top:8px}',
    '.%chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px;padding:0;list-style:none}',
    '.%chip{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;background:var(--tz-bg);border:1px solid var(--tz-line);border-radius:999px;font-size:13.5px;font-variant-numeric:tabular-nums}',
    '.%chip i{flex:none;width:10px;height:10px;border-radius:50%;background:var(--tz-ink2)}',
    '.%chip--hyper i{background:var(--tz-hyper)}.%chip--fenster i{background:var(--tz-win)}.%chip--hypo i{background:var(--tz-hypo)}',
    '.%chip--seen{border-color:var(--tz-ink2)}',
    '.%chip svg{flex:none}',
    '.%bar{display:flex;height:10px;margin:0 0 10px;border-radius:999px;overflow:hidden;background:var(--tz-line)}',
    '.%bar b{display:block;height:100%}',
    '.%bar b.is-hyper{background:var(--tz-hyper)}.%bar b.is-fenster{background:var(--tz-win)}.%bar b.is-hypo{background:var(--tz-hypo)}',

    /* SVG-Klassen */
    '.%zf-hyper{fill:var(--tz-hyper)}.%zf-fenster{fill:var(--tz-win)}.%zf-hypo{fill:var(--tz-hypo)}',
    '.%zs-hyper{stroke:var(--tz-hyper)}.%zs-fenster{stroke:var(--tz-win)}.%zs-hypo{stroke:var(--tz-hypo)}',
    '.%pat-hyper{stroke:var(--tz-hyper);stroke-width:1.4;stroke-opacity:.38}',
    '.%pat-hypo{fill:var(--tz-hypo);fill-opacity:.42}',
    '.%svgtxt{fill:var(--tz-ink);font-family:var(--tz-ui)}',
    '.%halo{paint-order:stroke;stroke:var(--tz-bg);stroke-width:3.5px;stroke-linejoin:round}',
    '.%svgtxt2{fill:var(--tz-ink2);font-family:var(--tz-ui)}',
    '.%svgline{stroke:var(--tz-ink2);fill:none}',
    '.%bg{fill:var(--tz-bg)}',

    /* Einordnung */
    '.%wrap{margin-top:38px;padding:24px 26px 26px;background:var(--tz-bg3);border:1px solid var(--tz-line);border-left:4px solid var(--tz-warm);border-radius:12px}',
    '.%wrap h5{margin:20px 0 6px;font:700 12px/1.3 var(--tz-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--tz-ink2)}',
    '.%wrap p,.%wrap li{font-size:15.5px;line-height:1.6}',
    '.%wrap p+p{margin-top:10px}',
    '.%wrap ul{margin:0;padding:0 0 0 20px}',
    '.%wrap ul.%chips,.%wrap ul.%tels{padding:0}',
    '.%wrap li{margin:0 0 7px}',
    '.%wrap .%summary{background:var(--tz-bg);margin:14px 0 18px}',
    '.%help{margin:20px 0 0;padding:16px 18px;background:var(--tz-bg);border:1px solid var(--tz-line);border-radius:10px}',
    '.%help strong{display:block;margin-bottom:4px}',
    '.%tels{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 0;padding:0;list-style:none}',
    '.%tel{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid var(--tz-accent);border-radius:999px;color:var(--tz-accent);font:700 15px/1 var(--tz-ui);text-decoration:none;font-variant-numeric:tabular-nums}',
    '.%tel:hover{background:var(--tz-bg3)}',
    '.%src{margin-top:18px}',
    '.%src summary{display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer;font:700 14px/1.3 var(--tz-ui);list-style:none}',
    '.%src summary::-webkit-details-marker{display:none}',
    '.%src summary::before{content:"";flex:none;width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(-45deg);margin:0 4px 0 2px}',
    '.%src[open] summary::before{transform:rotate(45deg)}',
    '.%src ul{margin:6px 0 0;padding:0 0 0 20px}',
    '.%src li{margin:0 0 6px;font-size:13.5px;line-height:1.5;color:var(--tz-ink2)}',
    '.%again{margin-top:22px}',

    '@media (prefers-reduced-motion:no-preference){',
    '.%btn,.%segopt span,.%tel{transition:background-color .15s ease,color .15s ease,border-color .15s ease}',
    '}',
    '@media (prefers-reduced-motion:reduce){.%btn:active{transform:none}}',

    '@media (max-width:620px){',
    '.%frame{padding:22px 16px 22px}',
    '.%frame::before{inset:5px}',
    '.%title{font-size:25px}',
    '.%intro{font-size:16px}',
    '.%lab{grid-template-columns:176px minmax(0,1fr);grid-template-areas:"head head" "gauge btns" "details details";column-gap:16px;row-gap:10px}',
    '.%gaugecol{display:contents}',
    '.%gauge{grid-area:gauge}',
    '.%gbtns{grid-area:btns;grid-template-columns:1fr;margin-top:0;align-self:center}',
    '.%name{font-size:23px}',
    '.%details{margin-top:18px}',
    '.%cols{grid-template-columns:1fr;gap:16px}',
    '.%wrap{padding:20px 16px 22px}',
    '.%h{font-size:20px}',
    '}',
    '@media (max-width:400px){.%gauge,.%gauge svg{width:164px}.%lab{grid-template-columns:164px minmax(0,1fr);column-gap:12px}}'
  ].join('\n').replace(/\.%/g, '.' + P);

  function injectStyles() {
    if (document.head.querySelector('style[data-gx="toleranzfenster"]')) return;
    var st = document.createElement('style');
    st.setAttribute('data-gx', 'toleranzfenster');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ *
   * mount
   * ------------------------------------------------------------------ */

  function mount(container, ctx) { // eslint-disable-line no-unused-vars
    injectStyles();
    if (!container) return function () {};

    var uid = ++uidCounter;
    var timers = [];
    var destroyed = false;

    var S = {
      level: 50,
      wkey: 'mittel',
      series: [],
      sel: 0,
      visited: { fenster: true },
      stateKey: null,
      zone: null
    };
    var i0;
    for (i0 = 0; i0 < N; i0++) S.series.push(null);

    function W() { return WIDTHS[S.wkey]; }

    function later(fn, ms) {
      var t = setTimeout(function () {
        var ix = timers.indexOf(t);
        if (ix >= 0) timers.splice(ix, 1);
        if (!destroyed) fn();
      }, ms);
      timers.push(t);
      return t;
    }

    function debounced(fn, ms) {
      var t = null;
      return function () {
        if (t) { clearTimeout(t); var ix = timers.indexOf(t); if (ix >= 0) timers.splice(ix, 1); }
        t = later(function () { t = null; fn(); }, ms);
      };
    }

    /* ---------------- DOM-Gerüst ---------------- */

    var root = el('div', { class: c('root') });
    var frame = el('div', { class: c('frame') });
    root.appendChild(frame);
    root.appendChild(el('div', { class: c('plinth'), 'aria-hidden': 'true' }));

    frame.appendChild(el('div', { class: c('kicker') }, 'Exponat · Denkmodell'));
    frame.appendChild(el('h3', { class: c('title') }, 'Das Toleranzfenster'));
    frame.appendChild(el('p', { class: c('intro') },
      el('strong', null, 'Probier es aus: '),
      'Bewege den Regler nach oben und unten und lies, wie sich Körper, Denken und Verhalten verändern. Danach kannst du den Verlauf eines Tages als Kurve zeichnen.'));
    frame.appendChild(el('p', { class: c('hint') },
      'Das ist ein Bild zum Nachdenken, keine Messung und keine Diagnose. Die Zahlen von 0 bis 100 gibt es im Körper nicht, sie machen nur das Modell greifbar. Wenn es dir gerade nicht gut geht, findest du am Ende Anlaufstellen.'));

    /* ----- Abschnitt 1: Skala und Zustand ----- */

    var sec1 = el('section', { class: c('sec'), 'aria-labelledby': c('h1-' + uid) });
    sec1.style.borderTop = '0';
    sec1.style.paddingTop = '0';
    sec1.style.marginTop = '28px';
    frame.appendChild(sec1);
    sec1.appendChild(el('h4', { class: c('h'), id: c('h1-' + uid) }, 'Dein Erregungsniveau'));
    sec1.appendChild(el('p', { class: c('sub') },
      'Ziehe den Punkt auf der Skala oder nutze die Pfeiltasten. Die Zone, in der du landest, bestimmt, was rechts erscheint.'));

    var lab = el('div', { class: c('lab'), 'data-zone': 'fenster' });
    sec1.appendChild(lab);

    // Skala
    var G = { W: 176, H: 340, tx: 14, tw: 46, top: 14, bottom: 326 };
    function gy(v) { return G.bottom - (v / 100) * (G.bottom - G.top); }

    var gaugeWrap = el('div', {
      class: c('gauge'), tabindex: '0', role: 'slider',
      'aria-label': 'Erregungsniveau', 'aria-orientation': 'vertical',
      'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '50',
      'aria-describedby': c('gkeys-' + uid)
    });
    var gSvg = svg('svg', { viewBox: '0 0 ' + G.W + ' ' + G.H, width: G.W, height: G.H, 'aria-hidden': 'true', focusable: 'false' });
    gaugeWrap.appendChild(gSvg);

    var gId = {
      clip: c('gclip-' + uid), ph: c('gph-' + uid), pl: c('gpl-' + uid)
    };
    var defs = svg('defs');
    var clip = svg('clipPath', { id: gId.clip });
    clip.appendChild(svg('rect', { x: G.tx, y: G.top, width: G.tw, height: G.bottom - G.top, rx: 10 }));
    defs.appendChild(clip);
    defs.appendChild(patternHyper(gId.ph));
    defs.appendChild(patternHypo(gId.pl));
    gSvg.appendChild(defs);

    var gZones = {};
    var gOver = {};
    var gTrack = svg('g', { 'clip-path': 'url(#' + gId.clip + ')' });
    ['hyper', 'fenster', 'hypo'].forEach(function (z) {
      gZones[z] = svg('rect', { x: G.tx, width: G.tw, 'fill-opacity': z === 'fenster' ? '0.3' : '0.2' }, c('zf-' + z));
      gTrack.appendChild(gZones[z]);
    });
    gOver.hyper = svg('rect', { x: G.tx, width: G.tw, fill: 'url(#' + gId.ph + ')' });
    gOver.hypo = svg('rect', { x: G.tx, width: G.tw, fill: 'url(#' + gId.pl + ')' });
    gTrack.appendChild(gOver.hyper);
    gTrack.appendChild(gOver.hypo);
    gSvg.appendChild(gTrack);
    gSvg.appendChild(svg('rect', { x: G.tx, y: G.top, width: G.tw, height: G.bottom - G.top, rx: 10, fill: 'none', 'stroke-width': 1.5 }, c('svgline')));
    var gLineHi = svg('line', { x1: G.tx - 6, x2: G.tx + G.tw + 6, 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }, c('svgline'));
    var gLineLo = svg('line', { x1: G.tx - 6, x2: G.tx + G.tw + 6, 'stroke-width': 1.4, 'stroke-dasharray': '4 3' }, c('svgline'));
    gSvg.appendChild(gLineHi);
    gSvg.appendChild(gLineLo);

    var gLabels = {};
    ['hyper', 'fenster', 'hypo'].forEach(function (z) {
      var g = svg('g');
      var t1 = svg('text', { x: 68, 'font-size': 12.5, 'font-weight': 700 }, c('svgtxt'));
      t1.textContent = ZONES[z].name;
      var t2 = svg('text', { x: 68, 'font-size': 10.5 }, c('svgtxt2'));
      t2.textContent = ZONES[z].en;
      g.appendChild(t1); g.appendChild(t2);
      gLabels[z] = { t1: t1, t2: t2 };
      gSvg.appendChild(g);
    });

    var knob = svg('g');
    var knobBar = svg('line', { x1: G.tx - 8, x2: G.tx + G.tw + 8, y1: 0, y2: 0, 'stroke-width': 2.5 }, c('svgtxt'));
    knobBar.style.stroke = 'var(--tz-ink)';
    var knobOuter = svg('circle', { cx: G.tx + G.tw / 2, cy: 0, r: 15, 'stroke-width': 3 }, c('bg'));
    knobOuter.style.stroke = 'var(--tz-ink)';
    var knobInner = svg('circle', { cx: G.tx + G.tw / 2, cy: 0, r: 6 });
    knobInner.style.fill = 'var(--tz-zone)';
    knob.appendChild(knobBar); knob.appendChild(knobOuter); knob.appendChild(knobInner);
    gSvg.appendChild(knob);

    var gkeys = el('span', { class: c('sr'), id: c('gkeys-' + uid) },
      'Pfeiltasten verändern den Wert um fünf, mit Umschalttaste um eins, Bild-auf und Bild-ab um zwanzig, Pos1 und Ende springen an die Enden.');

    var btnUp = el('button', { type: 'button', class: c('btn'), 'aria-label': 'Erregung höher' }, '▲ Höher');
    var btnDown = el('button', { type: 'button', class: c('btn'), 'aria-label': 'Erregung tiefer' }, '▼ Tiefer');
    var gaugeCol = el('div', { class: c('gaugecol') }, gaugeWrap, gkeys, el('div', { class: c('gbtns') }, btnUp, btnDown));
    lab.appendChild(gaugeCol);

    // Kopf + Details
    var eyebrowTxt = el('span');
    var dot = el('span', { class: c('dot'), 'aria-hidden': 'true' });
    var nameEl = el('h5', { class: c('name') });
    var readout = el('p', { class: c('readout') });
    var head = el('div', { class: c('head') }, el('p', { class: c('eyebrow') }, dot, eyebrowTxt), nameEl, readout);
    var details = el('div', { class: c('details') });
    lab.appendChild(head);
    lab.appendChild(details);

    // Fensterbreite
    var fs = el('fieldset', { class: c('fieldset') });
    fs.appendChild(el('legend', null, 'Wie weit ist dein Fenster gerade?'));
    var seg = el('div', { class: c('seg') });
    var radios = {};
    WIDTH_ORDER.forEach(function (k) {
      var inp = el('input', { type: 'radio', name: c('width-' + uid), value: k });
      if (k === S.wkey) inp.checked = true;
      radios[k] = inp;
      inp.addEventListener('change', function () { if (inp.checked) setWidth(k); });
      seg.appendChild(el('label', { class: c('segopt') }, inp, el('span', null, WIDTHS[k].label)));
    });
    var widthCap = el('p', { class: c('widthcap') });
    fs.appendChild(seg);
    fs.appendChild(widthCap);
    sec1.appendChild(fs);

    // Ansage für Screenreader
    var liveGauge = el('div', { class: c('sr'), role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    sec1.appendChild(liveGauge);

    /* ----- Abschnitt 2: Ideen ----- */

    var sec2 = el('section', { class: c('sec'), 'aria-labelledby': c('h2-' + uid) });
    frame.appendChild(sec2);
    var ideasTitle = el('h4', { class: c('h'), id: c('h2-' + uid) }, 'Regulations-Ideen');
    var ideasLead = el('p', { class: c('sub') });
    var ideasGrid = el('ul', { class: c('ideagrid') });
    ideasGrid.style.setProperty('--tz-zone', 'var(--tz-win)');
    sec2.appendChild(ideasTitle);
    sec2.appendChild(ideasLead);
    sec2.appendChild(ideasGrid);
    sec2.appendChild(el('p', { class: c('care') },
      el('strong', null, 'Allgemeine Anregungen, keine Behandlung. '),
      'Nicht jede Idee passt zu jedem Menschen. Wenn Atem- oder Körperübungen mehr Unruhe auslösen (das kommt besonders nach belastenden Erfahrungen vor), lass sie weg, richte den Blick nach außen und such dir bei Bedarf Unterstützung durch eine Fachperson.'));

    /* ----- Abschnitt 3: Verlauf ----- */

    var sec3 = el('section', { class: c('sec'), 'aria-labelledby': c('h3-' + uid) });
    frame.appendChild(sec3);
    sec3.appendChild(el('h4', { class: c('h'), id: c('h3-' + uid) }, 'Dein Verlauf: Erregung über die Zeit'));
    sec3.appendChild(el('p', { class: c('sub') },
      'Denk an einen Tag oder eine Situation. Zeichne mit Maus oder Finger über die Fläche – oder setze Punkte mit dem Regler oben und der Taste „Reglerwert setzen“. Mit der Tastatur wählst du Zeitpunkte mit links und rechts und änderst den Wert mit hoch und runter.'));

    var chartHost = el('div', {
      class: c('chart'), tabindex: '0', role: 'application',
      'aria-roledescription': 'Verlaufsdiagramm zum Zeichnen',
      'aria-label': 'Verlauf der Erregung über zwölf Zeitpunkte',
      'aria-describedby': c('ckeys-' + uid)
    });
    var cSvg = svg('svg', { 'aria-hidden': 'true', focusable: 'false' });
    chartHost.appendChild(cSvg);
    var ckeys = el('span', { class: c('sr'), id: c('ckeys-' + uid) },
      'Links und rechts wählen den Zeitpunkt. Hoch und runter ändern den Wert um fünf, Umschalttaste um eins. Eingabetaste übernimmt den Reglerwert und geht weiter. Entfernen löscht den Punkt.');
    sec3.appendChild(chartHost);
    sec3.appendChild(ckeys);

    var liveSel = el('div', { class: c('sr'), role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
    sec3.appendChild(liveSel);

    var stepLabel = el('span', { class: c('step') });
    var btnSet = el('button', { type: 'button', class: c('btn') + ' ' + c('btn--pri') }, 'Reglerwert setzen');
    var btnPrev = el('button', { type: 'button', class: c('btn'), 'aria-label': 'Vorheriger Zeitpunkt' }, '◀ Zurück');
    var btnNext = el('button', { type: 'button', class: c('btn'), 'aria-label': 'Nächster Zeitpunkt' }, 'Weiter ▶');
    var btnDel = el('button', { type: 'button', class: c('btn') }, 'Punkt löschen');
    var btnClr = el('button', { type: 'button', class: c('btn') }, 'Verlauf löschen');
    var ctrl1 = el('div', { class: c('ctrl') }, btnSet, btnPrev, stepLabel, btnNext);
    var ctrl2 = el('div', { class: c('ctrl') }, btnDel, btnClr);
    var exBtns = {};
    Object.keys(EXAMPLES).forEach(function (k) {
      exBtns[k] = el('button', { type: 'button', class: c('btn') }, EXAMPLES[k].label);
      ctrl2.appendChild(exBtns[k]);
    });
    sec3.appendChild(ctrl1);
    sec3.appendChild(ctrl2);

    var summaryEl = el('div', { class: c('summary') });
    sec3.appendChild(summaryEl);

    /* ----- Einordnung ----- */

    var wrap = el('section', { class: c('wrap'), 'aria-labelledby': c('h4-' + uid) });
    frame.appendChild(wrap);
    wrap.appendChild(el('div', { class: c('kicker') }, 'Einordnung'));
    wrap.appendChild(el('h4', { class: c('h'), id: c('h4-' + uid), style: 'margin-top:8px' }, 'Was du gerade erlebt hast'));
    var wrapZones = el('ul', { class: c('chips'), style: 'margin-top:12px' });
    var wrapSeries = el('div', { class: c('summary') });
    wrap.appendChild(wrapZones);
    wrap.appendChild(wrapSeries);

    wrap.appendChild(el('p', null,
      'Du hast ein Bild ausprobiert, das der Psychiater Daniel Siegel 1999 in seinem Buch „The Developing Mind“ beschrieben hat: Es gibt einen mittleren Erregungsbereich, das „Window of Tolerance“, in dem wir Gefühle spüren und trotzdem nachdenken, zuhören und lernen können. Darüber (Hyperarousal) und darunter (Hypoarousal) wird das schwieriger. Bekannt wurde das Bild vor allem in der körperorientierten Traumatherapie, etwa durch Pat Ogden und ihre Kolleginnen und Kollegen (2006).'));
    wrap.appendChild(el('p', null,
      'Wichtig ist, was das Modell nicht sagt: Es geht nicht darum, immer im Fenster zu bleiben. Erregung schwankt im Alltag ständig, und kurze Ausflüge nach oben oder unten gehören dazu. Interessant ist eher, wie weit das Fenster gerade ist und wie gut der Weg zurück gelingt.'));

    wrap.appendChild(el('h5', null, 'Grenzen des Exponats'));
    wrap.appendChild(el('ul', null,
      el('li', null, el('strong', null, 'Ein Heuristik-Modell, kein Messgerät. '), 'Die Skala, die Zonengrenzen und die drei Fensterbreiten sind zur Veranschaulichung festgelegt. Es gibt keinen Messwert, der dich „im Fenster“ oder „draußen“ verortet.'),
      el('li', null, el('strong', null, 'Neurobiologisch vereinfacht. '), 'Erregung ist kein einzelner Regler: Körper, Gefühl und Gedanken können unterschiedlich reagieren, und man kann gleichzeitig aufgewühlt und erstarrt sein. Die Verbindung zu bestimmten Hirnregionen und Anteilen des Nervensystems (etwa bei Corrigan, Fisher & Nutt, 2011) ist bislang nur begrenzt direkt untersucht. Dasselbe gilt für die verbreitete Polyvagal-Theorie, die als umstritten gilt – mehr dazu in der Station zur Polyvagal-Theorie.'),
      el('li', null, el('strong', null, 'Die Glockenkurve ist eine Faustregel. '), 'Das Bild erinnert an das Yerkes-Dodson-Gesetz von 1908. Die ursprünglichen Versuche liefen mit Mäusen, und die „umgekehrte U-Kurve“ gilt heute als grobe Orientierung, nicht als Naturgesetz.'),
      el('li', null, el('strong', null, 'Kein Test, keine Diagnose, kein Trauma-Training. '), 'Das Exponat sagt nichts darüber, ob bei dir eine Belastungsstörung vorliegt, und ersetzt keine Beratung oder Therapie. Die Ideen sind Alltagsanregungen und kein Behandlungsplan.')));

    var help = el('div', { class: c('help') });
    help.appendChild(el('strong', null, 'Wenn es dir gerade nicht gut geht'));
    help.appendChild(el('p', null,
      'Du musst das nicht allein tragen. Die Telefonseelsorge ist kostenfrei und rund um die Uhr erreichbar. Bei akuter Gefahr für dich oder andere wähle den Notruf 112. Auch deine Hausarztpraxis oder eine psychotherapeutische Praxis kann ein erster Schritt sein.'));
    var tels = el('ul', { class: c('tels') });
    [['0800 111 0 111', '08001110111'], ['0800 111 0 222', '08001110222'], ['116 123', '116123']].forEach(function (p) {
      tels.appendChild(el('li', null, el('a', { class: c('tel'), href: 'tel:' + p[1] }, p[0])));
    });
    help.appendChild(tels);
    wrap.appendChild(help);

    var src = el('details', { class: c('src') }, el('summary', null, 'Quellen und Weiterlesen'));
    var srcList = el('ul');
    SOURCES.forEach(function (s) { srcList.appendChild(el('li', null, s)); });
    src.appendChild(srcList);
    wrap.appendChild(src);

    var btnAgain = el('button', { type: 'button', class: c('btn') + ' ' + c('again') }, 'Noch einmal von vorn');
    wrap.appendChild(btnAgain);

    container.appendChild(root);

    /* ---------------- SVG-Muster ---------------- */

    function patternHyper(id) {
      var p = svg('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: 8, height: 8, patternTransform: 'rotate(45)' });
      p.appendChild(svg('line', { x1: 0, y1: 0, x2: 0, y2: 8 }, c('pat-hyper')));
      return p;
    }
    function patternHypo(id) {
      var p = svg('pattern', { id: id, patternUnits: 'userSpaceOnUse', width: 8, height: 8 });
      p.appendChild(svg('circle', { cx: 4, cy: 4, r: 1.2 }, c('pat-hypo')));
      return p;
    }

    /* ---------------- Skala zeichnen ---------------- */

    function updateGauge() {
      var w = W();
      var yHi = gy(w.hi), yLo = gy(w.lo);
      setRect(gZones.hyper, G.top, yHi - G.top);
      setRect(gZones.fenster, yHi, yLo - yHi);
      setRect(gZones.hypo, yLo, G.bottom - yLo);
      setRect(gOver.hyper, G.top, yHi - G.top);
      setRect(gOver.hypo, yLo, G.bottom - yLo);
      gLineHi.setAttribute('y1', yHi); gLineHi.setAttribute('y2', yHi);
      gLineLo.setAttribute('y1', yLo); gLineLo.setAttribute('y2', yLo);
      placeLabel('hyper', G.top, yHi);
      placeLabel('fenster', yHi, yLo);
      placeLabel('hypo', yLo, G.bottom);
      knob.setAttribute('transform', 'translate(0 ' + gy(S.level) + ')');
      gaugeWrap.setAttribute('aria-valuenow', String(S.level));
      gaugeWrap.setAttribute('aria-valuetext', S.level + ' von 100, ' + ZONES[zoneOf(S.level, w)].name);
    }
    function setRect(r, y, h) { r.setAttribute('y', y); r.setAttribute('height', Math.max(0, h)); }
    function placeLabel(z, y0, y1) {
      var cy = (y0 + y1) / 2;
      gLabels[z].t1.setAttribute('y', cy - 1);
      gLabels[z].t2.setAttribute('y', cy + 14);
    }

    /* ---------------- Zustand & Ideen ---------------- */

    var announceGauge = debounced(function () {
      var st = STATES[S.stateKey];
      liveGauge.textContent = ZONES[st.zone].name + ': ' + st.name + '. ' + st.essence;
    }, 600);

    function updateState(silent) {
      var w = W();
      var key = stateKey(S.level, w);
      var zone = STATES[key].zone;
      lab.setAttribute('data-zone', zone);
      readout.innerHTML = '';
      readout.appendChild(document.createTextNode('Erregung '));
      readout.appendChild(el('strong', null, S.level + ' von 100'));
      readout.appendChild(document.createTextNode(' · Fenster von ' + w.lo + ' bis ' + w.hi));
      var keyChanged = key !== S.stateKey;
      if (keyChanged) {
        S.stateKey = key;
        renderState(key);
        if (!silent) announceGauge();
      }
      if (zone !== S.zone) {
        S.zone = zone;
        renderIdeas(zone);
      }
      if (!S.visited[zone]) { S.visited[zone] = true; renderWrapZones(); }
    }

    function renderState(key) {
      var st = STATES[key];
      eyebrowTxt.textContent = ZONES[st.zone].name + ' · ' + ZONES[st.zone].en;
      nameEl.textContent = st.name;
      clear(details);
      details.appendChild(el('p', { class: c('essence') }, st.essence));
      var cols = el('div', { class: c('cols') });
      [['body', 'Körper', st.body], ['mind', 'Denken', st.mind], ['acts', 'Verhalten', st.acts]].forEach(function (d) {
        var ul = el('ul');
        d[2].forEach(function (t) { ul.appendChild(el('li', null, t)); });
        cols.appendChild(el('div', { class: c('col') }, el('h5', { class: c('colh') }, icon(d[0], 18), d[1]), ul));
      });
      details.appendChild(cols);
      if (st.note) details.appendChild(el('p', { class: c('note') }, st.note));
      else details.appendChild(el('p', { class: c('note') }, 'Typische Beispiele – Menschen erleben diese Zustände sehr unterschiedlich, und Mischformen sind häufig.'));
      if (key === 'hyper2' || key === 'hypo2') {
        details.appendChild(el('p', { class: c('note') + ' ' + c('notehelp') },
          el('strong', null, 'Wenn dich so ein Zustand länger begleitet oder stark belastet: '),
          'Hol dir Unterstützung. Die Telefonseelsorge ist kostenfrei und rund um die Uhr erreichbar (0800 111 0 111, 0800 111 0 222 oder 116 123). Weitere Hinweise findest du am Ende des Exponats.'));
      }
    }

    function renderIdeas(zone) {
      var I = IDEAS[zone];
      ideasTitle.textContent = 'Regulations-Ideen · ' + ZONES[zone].name + ': ' + I.head;
      ideasLead.textContent = I.lead;
      ideasGrid.style.setProperty('--tz-zone', zone === 'hyper' ? 'var(--tz-hyper)' : (zone === 'hypo' ? 'var(--tz-hypo)' : 'var(--tz-win)'));
      clear(ideasGrid);
      I.items.forEach(function (it) {
        ideasGrid.appendChild(el('li', { class: c('idea') },
          el('span', { class: c('ideaic') }, icon(it.ic, 20)),
          el('div', null, el('h5', null, it.t), el('p', null, it.x))));
      });
    }

    function renderWrapZones() {
      clear(wrapZones);
      ['hyper', 'fenster', 'hypo'].forEach(function (z) {
        var seen = !!S.visited[z];
        wrapZones.appendChild(el('li', { class: c('chip') + ' ' + c('chip--' + z) + (seen ? ' ' + c('chip--seen') : '') },
          seen ? icon('check', 14) : el('i', { 'aria-hidden': 'true' }),
          ZONES[z].name + (seen ? ' – angesehen' : ' – noch nicht angesehen')));
      });
    }

    function setLevel(v) {
      v = clamp(Math.round(v), 0, 100);
      if (v === S.level) return;
      S.level = v;
      updateGauge();
      updateState();
    }

    function setWidth(k) {
      S.wkey = k;
      if (radios[k]) radios[k].checked = true;
      widthCap.textContent = WIDTHS[k].text;
      updateGauge();
      updateState();
      drawChart();
      refreshSummaries();
    }

    /* ---------------- Skala: Eingaben ---------------- */

    var dragging = false;
    function levelFromPointer(e) {
      var r = gSvg.getBoundingClientRect();
      var sc = r.height / G.H || 1;
      var y = (e.clientY - r.top) / sc;
      return clamp(Math.round(((G.bottom - y) / (G.bottom - G.top)) * 100), 0, 100);
    }
    gaugeWrap.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      dragging = true;
      try { gaugeWrap.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      setLevel(levelFromPointer(e));
      try { gaugeWrap.focus({ preventScroll: true }); } catch (err) { /* egal */ }
      e.preventDefault();
    });
    gaugeWrap.addEventListener('pointermove', function (e) { if (dragging) setLevel(levelFromPointer(e)); });
    function endDrag(e) {
      dragging = false;
      try { gaugeWrap.releasePointerCapture(e.pointerId); } catch (err) { /* egal */ }
    }
    gaugeWrap.addEventListener('pointerup', endDrag);
    gaugeWrap.addEventListener('pointercancel', endDrag);
    gaugeWrap.addEventListener('keydown', function (e) {
      var d = null;
      var step = e.shiftKey ? 1 : 5;
      switch (e.key) {
        case 'ArrowUp': case 'ArrowRight': d = step; break;
        case 'ArrowDown': case 'ArrowLeft': d = -step; break;
        case 'PageUp': d = 20; break;
        case 'PageDown': d = -20; break;
        case 'Home': setLevel(0); e.preventDefault(); return;
        case 'End': setLevel(100); e.preventDefault(); return;
        default: return;
      }
      e.preventDefault();
      setLevel(S.level + d);
    });
    btnUp.addEventListener('click', function () { setLevel(S.level + 5); });
    btnDown.addEventListener('click', function () { setLevel(S.level - 5); });

    /* ---------------- Verlaufsdiagramm ---------------- */

    var cg = { w: 600, h: 260, padL: 20, padR: 20, padT: 16, padB: 32 };
    var cId = { ph: c('cph-' + uid), pl: c('cpl-' + uid) };

    function cy(v) { return cg.padT + (1 - v / 100) * (cg.h - cg.padT - cg.padB); }
    function cx(i) { return cg.padL + i * ((cg.w - cg.padL - cg.padR) / (N - 1)); }

    function drawChart() {
      var w = Math.max(240, Math.round(chartHost.clientWidth || 0) || 600);
      cg.w = w;
      cg.h = w < 460 ? 236 : 264;
      cSvg.setAttribute('width', cg.w);
      cSvg.setAttribute('height', cg.h);
      cSvg.setAttribute('viewBox', '0 0 ' + cg.w + ' ' + cg.h);
      clear(cSvg);

      var wd = W();
      var defsC = svg('defs');
      defsC.appendChild(patternHyper(cId.ph));
      defsC.appendChild(patternHypo(cId.pl));
      cSvg.appendChild(defsC);

      var top = cg.padT, bot = cg.h - cg.padB;
      var yHi = cy(wd.hi), yLo = cy(wd.lo);
      var bands = [['hyper', top, yHi], ['fenster', yHi, yLo], ['hypo', yLo, bot]];
      bands.forEach(function (b) {
        cSvg.appendChild(svg('rect', { x: 0, y: b[1], width: cg.w, height: Math.max(0, b[2] - b[1]), 'fill-opacity': b[0] === 'fenster' ? '0.26' : '0.17' }, c('zf-' + b[0])));
        if (b[0] === 'hyper') cSvg.appendChild(svg('rect', { x: 0, y: b[1], width: cg.w, height: Math.max(0, b[2] - b[1]), fill: 'url(#' + cId.ph + ')' }));
        if (b[0] === 'hypo') cSvg.appendChild(svg('rect', { x: 0, y: b[1], width: cg.w, height: Math.max(0, b[2] - b[1]), fill: 'url(#' + cId.pl + ')' }));
      });
      [yHi, yLo].forEach(function (y) {
        cSvg.appendChild(svg('line', { x1: 0, x2: cg.w, y1: y, y2: y, 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: 0.8 }, c('svgline')));
      });
      bands.forEach(function (b) {
        var t = svg('text', { x: 10, y: b[1] + 16, 'font-size': 11.5, 'font-weight': 700 }, c('svgtxt') + ' ' + c('halo'));
        t.textContent = ZONES[b[0]].name;
        cSvg.appendChild(t);
      });

      // Zeitachse
      var axY = bot + 10;
      cSvg.appendChild(svg('line', { x1: cg.padL, x2: cg.w - cg.padR, y1: axY, y2: axY, 'stroke-width': 1.4 }, c('svgline')));
      var tl = svg('text', { x: cg.padL, y: axY + 16, 'font-size': 11.5 }, c('svgtxt2')); tl.textContent = 'früher';
      var tr = svg('text', { x: cg.w - cg.padR, y: axY + 16, 'font-size': 11.5, 'text-anchor': 'end' }, c('svgtxt2')); tr.textContent = 'später  →';
      cSvg.appendChild(tl); cSvg.appendChild(tr);
      for (var i = 0; i < N; i++) {
        cSvg.appendChild(svg('line', { x1: cx(i), x2: cx(i), y1: axY - 3, y2: axY + 3, 'stroke-width': 1.4 }, c('svgline')));
      }

      // Auswahl
      var sx = cx(S.sel);
      cSvg.appendChild(svg('line', { x1: sx, x2: sx, y1: top - 4, y2: axY, 'stroke-width': 1.4, 'stroke-dasharray': '2 4', 'stroke-linecap': 'round' }, c('svgline')));

      // Linie (unterbrochen bei fehlenden Punkten)
      var d = '', prev = false;
      for (i = 0; i < N; i++) {
        var v = S.series[i];
        if (v === null) { prev = false; continue; }
        d += (prev ? 'L' : 'M') + cx(i).toFixed(1) + ' ' + cy(v).toFixed(1) + ' ';
        prev = true;
      }
      if (d) {
        var path = svg('path', { d: d, fill: 'none', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, c('svgline'));
        path.style.stroke = 'var(--tz-ink)';
        cSvg.appendChild(path);
      }
      // Punkte
      for (i = 0; i < N; i++) {
        var val = S.series[i];
        if (val === null) {
          if (i === S.sel) {
            cSvg.appendChild(svg('circle', { cx: cx(i), cy: cy(S.level), r: 7, fill: 'none', 'stroke-width': 1.8, 'stroke-dasharray': '3 3' }, c('svgline')));
          }
          continue;
        }
        var z = zoneOf(val, wd);
        var circ = svg('circle', { cx: cx(i), cy: cy(val), r: i === S.sel ? 8 : 6.5, 'stroke-width': 2.5 }, c('zf-' + z));
        circ.style.stroke = 'var(--tz-bg)';
        cSvg.appendChild(circ);
        var ring = svg('circle', { cx: cx(i), cy: cy(val), r: (i === S.sel ? 8 : 6.5) + 1.5, fill: 'none', 'stroke-width': 1.2 }, c('svgline'));
        ring.style.stroke = 'var(--tz-ink)';
        cSvg.appendChild(ring);
        if (i === S.sel) {
          var lbl = svg('text', { x: cx(i), y: cy(val) < top + 24 ? cy(val) + 24 : cy(val) - 14, 'font-size': 12.5, 'font-weight': 700, 'text-anchor': 'middle' }, c('svgtxt') + ' ' + c('halo'));
          lbl.textContent = String(val);
          cSvg.appendChild(lbl);
        }
      }
      updateStep();
    }

    function updateStep() {
      stepLabel.textContent = 'Zeitpunkt ' + (S.sel + 1) + ' von ' + N;
      btnPrev.disabled = S.sel <= 0;
      btnNext.disabled = S.sel >= N - 1;
      btnDel.disabled = S.series[S.sel] === null;
      var any = S.series.some(function (v) { return v !== null; });
      btnClr.disabled = !any;
      var set = S.series.filter(function (v) { return v !== null; }).length;
      chartHost.setAttribute('aria-label', 'Verlauf der Erregung über zwölf Zeitpunkte, ' + set + ' von ' + N + ' Punkten gesetzt');
    }

    function announceSel() {
      var v = S.series[S.sel];
      liveSel.textContent = 'Zeitpunkt ' + (S.sel + 1) + ' von ' + N + ': ' +
        (v === null ? 'noch kein Punkt. Pfeil hoch oder Eingabetaste setzt einen Punkt.' : 'Erregung ' + v + ', ' + ZONES[zoneOf(v, W())].name + '.');
    }

    var refreshSoon = debounced(function () { refreshSummaries(); }, 500);

    function afterSeriesChange(immediate) {
      drawChart();
      if (immediate) refreshSummaries(); else refreshSoon();
      renderSeriesInto(wrapSeries);
    }

    // Zeichnen mit Zeiger
    var drawing = false, lastI = null;
    function chartPos(e) { var r = cSvg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function idxFromX(x) { return clamp(Math.round((x - cg.padL) / ((cg.w - cg.padL - cg.padR) / (N - 1))), 0, N - 1); }
    function valFromY(y) { return clamp(Math.round((1 - (y - cg.padT) / (cg.h - cg.padT - cg.padB)) * 100), 0, 100); }
    function paint(e) {
      var p = chartPos(e);
      var i = idxFromX(p.x), v = valFromY(p.y);
      if (lastI === null || lastI === i) {
        S.series[i] = v;
      } else {
        var a = lastI, n = Math.abs(i - a), dir = i > a ? 1 : -1;
        var va = S.series[a] !== null ? S.series[a] : v;
        for (var k = 1; k <= n; k++) S.series[a + dir * k] = Math.round(va + (v - va) * k / n);
      }
      lastI = i;
      S.sel = i;
      afterSeriesChange(false);
    }
    chartHost.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      drawing = true; lastI = null;
      try { chartHost.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      try { chartHost.focus({ preventScroll: true }); } catch (err) { /* egal */ }
      paint(e);
      e.preventDefault();
    });
    chartHost.addEventListener('pointermove', function (e) { if (drawing) paint(e); });
    function endDraw(e) {
      if (!drawing) return;
      drawing = false; lastI = null;
      try { chartHost.releasePointerCapture(e.pointerId); } catch (err) { /* egal */ }
      announceSel();
      refreshSummaries();
    }
    chartHost.addEventListener('pointerup', endDraw);
    chartHost.addEventListener('pointercancel', endDraw);

    chartHost.addEventListener('keydown', function (e) {
      var handled = true;
      var big = e.shiftKey ? 1 : 5;
      switch (e.key) {
        case 'ArrowLeft': S.sel = Math.max(0, S.sel - 1); break;
        case 'ArrowRight': S.sel = Math.min(N - 1, S.sel + 1); break;
        case 'Home': S.sel = 0; break;
        case 'End': S.sel = N - 1; break;
        case 'ArrowUp': case 'ArrowDown':
          var dd = e.key === 'ArrowUp' ? big : -big;
          S.series[S.sel] = clamp((S.series[S.sel] === null ? S.level : S.series[S.sel] + dd), 0, 100);
          break;
        case 'PageUp': case 'PageDown':
          S.series[S.sel] = clamp((S.series[S.sel] === null ? S.level : S.series[S.sel]) + (e.key === 'PageUp' ? 20 : -20), 0, 100);
          break;
        case 'Enter': case ' ':
          S.series[S.sel] = S.level;
          if (S.sel < N - 1) S.sel++;
          break;
        case 'Delete': case 'Backspace':
          S.series[S.sel] = null;
          break;
        default: handled = false;
      }
      if (!handled) return;
      e.preventDefault();
      afterSeriesChange(false);
      announceSel();
    });

    btnSet.addEventListener('click', function () {
      S.series[S.sel] = S.level;
      var shown = S.sel + 1;
      if (S.sel < N - 1) S.sel++;
      afterSeriesChange(true);
      liveSel.textContent = 'Punkt ' + shown + ' gesetzt: Erregung ' + S.level + ', ' + ZONES[zoneOf(S.level, W())].name + '. Jetzt Zeitpunkt ' + (S.sel + 1) + ' von ' + N + '.';
    });
    btnPrev.addEventListener('click', function () { S.sel = Math.max(0, S.sel - 1); drawChart(); announceSel(); });
    btnNext.addEventListener('click', function () { S.sel = Math.min(N - 1, S.sel + 1); drawChart(); announceSel(); });
    btnDel.addEventListener('click', function () {
      S.series[S.sel] = null; afterSeriesChange(true);
      liveSel.textContent = 'Punkt ' + (S.sel + 1) + ' gelöscht.';
    });
    btnClr.addEventListener('click', function () {
      for (var k = 0; k < N; k++) S.series[k] = null;
      S.sel = 0; afterSeriesChange(true);
      liveSel.textContent = 'Verlauf gelöscht.';
      try { btnSet.focus(); } catch (err) { /* egal */ }
    });
    Object.keys(exBtns).forEach(function (k) {
      exBtns[k].addEventListener('click', function () {
        S.series = EXAMPLES[k].data.slice();
        S.sel = 0;
        afterSeriesChange(true);
      });
    });

    /* ---------------- Auswertung ---------------- */

    function analyse() {
      var w = W();
      var cnt = { hyper: 0, fenster: 0, hypo: 0 };
      var n = 0, mn = 101, mx = -1;
      var exits = 0, returns = 0, sumBack = 0, outsideNow = false;
      var exitIdx = null, wasIn = false, started = false;
      for (var i = 0; i < N; i++) {
        var v = S.series[i];
        if (v === null) continue;
        n++;
        mn = Math.min(mn, v); mx = Math.max(mx, v);
        var z = zoneOf(v, w);
        cnt[z]++;
        if (z === 'fenster') {
          if (exitIdx !== null) { returns++; sumBack += (i - exitIdx); exitIdx = null; }
          wasIn = true;
        } else if (wasIn && exitIdx === null) {
          exits++; exitIdx = i; wasIn = false;
        }
        started = true;
      }
      outsideNow = exitIdx !== null;
      return { n: n, cnt: cnt, min: mn, max: mx, exits: exits, returns: returns, avgBack: returns ? sumBack / returns : 0, outsideNow: outsideNow, started: started };
    }

    function renderSeriesInto(target) {
      clear(target);
      var a = analyse();
      if (!a.n) {
        target.appendChild(el('p', null, 'Noch kein Verlauf gezeichnet. Fahre mit Maus oder Finger über das Diagramm, setze Punkte mit dem Regler oder lade eines der Beispiele – dann steht hier eine kurze Auswertung.'));
        return;
      }
      var chips = el('ul', { class: c('chips') });
      [['fenster', a.cnt.fenster], ['hyper', a.cnt.hyper], ['hypo', a.cnt.hypo]].forEach(function (p) {
        chips.appendChild(el('li', { class: c('chip') + ' ' + c('chip--' + p[0]) }, el('i', { 'aria-hidden': 'true' }), ZONES[p[0]].name + ': ' + p[1]));
      });
      target.appendChild(chips);
      var bar = el('div', { class: c('bar'), 'aria-hidden': 'true' });
      ['fenster', 'hyper', 'hypo'].forEach(function (z) {
        if (!a.cnt[z]) return;
        var b = el('b', { class: 'is-' + z });
        b.style.width = (100 * a.cnt[z] / a.n) + '%';
        bar.appendChild(b);
      });
      target.appendChild(bar);

      target.appendChild(el('p', null,
        a.n + ' von ' + N + ' Zeitpunkten gesetzt: ' + a.cnt.fenster + ' im Toleranzfenster, ' + a.cnt.hyper + ' darüber, ' + a.cnt.hypo + ' darunter. ' +
        (a.n > 1 ? 'Deine Kurve reicht von ' + a.min + ' bis ' + a.max + '.' : '')));

      var s2 = '';
      if (a.exits === 0) {
        if (a.n >= 3 && a.cnt.fenster === a.n) s2 = 'Deine Kurve bleibt durchgehend im Fenster.';
        else if (a.n >= 3 && a.cnt.fenster === 0) s2 = 'Deine Kurve liegt durchgehend außerhalb des Fensters.';
      } else {
        s2 = 'Du verlässt das Fenster ' + times(a.exits) + '';
        if (a.returns > 0) {
          var back = a.avgBack === 1 ? 'nach einem Zeitpunkt' : 'nach durchschnittlich ' + fmt(a.avgBack) + ' Zeitpunkten';
          s2 += ' und kehrst ' + times(a.returns) + ' zurück (' + back + ')';
        }
        s2 += '.';
        if (a.outsideNow) s2 += ' Am Ende der gezeichneten Kurve bist du noch außerhalb des Fensters.';
      }
      if (s2) target.appendChild(el('p', null, s2));
    }

    function refreshSummaries() {
      renderSeriesInto(summaryEl);
      renderSeriesInto(wrapSeries);
    }

    /* ---------------- Zurücksetzen ---------------- */

    btnAgain.addEventListener('click', function () {
      for (var k = 0; k < N; k++) S.series[k] = null;
      S.sel = 0; S.level = 50; S.visited = { fenster: true };
      S.stateKey = null; S.zone = null;
      setWidth('mittel');
      renderWrapZones();
      refreshSummaries();
      liveGauge.textContent = 'Alles zurückgesetzt.';
      try { gaugeWrap.focus(); gaugeWrap.scrollIntoView({ block: 'center', behavior: 'auto' }); } catch (err) { /* egal */ }
    });

    /* ---------------- Größenänderung ---------------- */

    var lastW = 0;
    function onResize() {
      var w = Math.round(chartHost.clientWidth || 0);
      if (w && w !== lastW) { lastW = w; drawChart(); }
    }
    var ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(function () { onResize(); });
      ro.observe(chartHost);
    } else {
      window.addEventListener('resize', onResize);
    }

    /* ---------------- Start ---------------- */

    widthCap.textContent = WIDTHS[S.wkey].text;
    updateGauge();
    updateState(true);
    renderWrapZones();
    drawChart();
    lastW = Math.round(chartHost.clientWidth || 0);
    refreshSummaries();

    return function destroy() {
      destroyed = true;
      timers.forEach(function (t) { clearTimeout(t); });
      timers.length = 0;
      if (ro) { try { ro.disconnect(); } catch (e) { /* egal */ } }
      else window.removeEventListener('resize', onResize);
      if (root.parentNode) root.parentNode.removeChild(root);
    };
  }

  M.exhibits.toleranzfenster = {
    title: 'Das Toleranzfenster',
    blurb: 'Bewege den Regler zwischen Über- und Untererregung, lies die Zustände und zeichne den Verlauf eines Tages.',
    mount: mount
  };
})();

/* ==========================================================================
   Museum Studio – js/core.js
   Namespace, Hilfsfunktionen, Store, Theme, Router, Ansichten-Verwaltung,
   Graph-Aufbau (finalize), Suchindex und der Station-Renderer.

   Dieses Skript wird als ERSTES geladen. Alle anderen Module hängen sich an
   window.MUSEUM. Vollständige API: docs/ARCHITEKTUR.md. Zusätze dieses Kerns:

   MUSEUM.finalize()                  baut Graph, Kreuzungen, Große Rundreise, Suchindex (mehrfach aufrufbar)
   MUSEUM.neighbors(id)               -> [{journey, index, total, prev, next}] je Reise der Station
   MUSEUM.crossings                   -> Array der Stationen mit >= 2 echten Reisen
   MUSEUM.searchIndex, MUSEUM.norm(s) -> normalisierte Suchtexte (Umlaute, ß, Groß/Klein)
   MUSEUM.kinds                       -> { kind: {label, icon} }
   MUSEUM.toast(text)                 sichtbarer Hinweis + aria-live
   MUSEUM.mountViews()                mountet alle registrierten Ansichten (einmal)
   MUSEUM.reducedMotion()             -> boolean (prefers-reduced-motion)
   MUSEUM.nav.start()                 startet den Hash-Router (ruft app.js)
   MUSEUM.nav.closeOverlay()          schließt Stationspanel / Reise-Modus (Browser-Zurück)
   MUSEUM.theme                       { get(), effective(), set(mode), cycle(), init() }  mode: auto|light|dark
   MUSEUM.store.addStamp(jid)         -> true wenn neu; store.reset() löscht Besuche und Stempel
   MUSEUM.ui.overlay.open(el, {onClose, focus, returnFocus}) / .close(el)
                                      gemeinsame Verwaltung modaler Ebenen: inert-Hintergrund, Scroll-Sperre,
                                      Fokus-Rückgabe, Escape. Auch für die Suche gedacht (#suche-overlay).
   MUSEUM.ui.destroyStation(artikel)  beendet laufende Exponate einer gerenderten Station

   Verträge für die Ansichten
   - Jede Ansicht bekommt in mount(el) einen leeren Block in voller Breite. Die Seitenüberschrift der Ansicht
     (h2) liefert der Kern; die Ansicht selbst setzt keine eigene h1/h2-Hauptüberschrift.
   - Reise-Modus: MUSEUM.journey.open(id, startIndex) rendert in #reise. Der Kern entsperrt #reise, ruft open()
     und beim Verlassen close(). Der Schließen-Knopf des Reise-Modus ruft MUSEUM.nav.closeOverlay().
     Stationswechsel innerhalb einer Reise: MUSEUM.nav.openJourney(id, index) (ersetzt den Verlauf, kein neuer Eintrag).
     Fehlt journey.js, springt eine schlichte Ersatz-Wanderung des Kerns ein.
     #reise ist ein festes Vollbild-Overlay (z-index 90, Hintergrund var(--bg)); .is-open blendet es ein.
     Die Große Rundreise: MUSEUM.data.journeyById.rundreise (virtual:true) mit legs[], onward[], steps[{station, via, next, hint}];
     MUSEUM.rundreiseStep(stationId) liefert den passenden Schritt.
   - Events auf document: gm:station-open {id, journeyId}, gm:journey-open {id, index}, gm:visited {id},
     gm:stamp {journey}, gm:theme {mode, effective}. Für den Spielplan (js/spiel.js) zusätzlich: gm:myth {id, card} (Mythos-Karte
     umgedreht), gm:exhibit-start {id, station, mount} und gm:exhibit-end {id, station}; journey.js sendet gm:journey-step
     {journeyId, index, from, total, first} bei jedem Seitenwechsel im Reise-Modus.
   - Spielplan (nur mit spielplan.json): MUSEUM.addVocab(obj) trägt Standardtexte weiterer Module ein (pack.vocab überschreibt).
     Gibt es MUSEUM.spiel (aktiv), fragt der Kern es an vier Stellen: renderStation (spiel.station), showPanelStation und
     routeJourney (spiel.sperrseite: ruhiges Hinweisbild für noch Verschlossenes), buildTransfer (spiel.zugang). Ohne Spielplan
     sind alle vier Aufrufe wirkungslos.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  M.data = M.data || {};
  M.data.stations = M.data.stations || {};
  M.exhibits = M.exhibits || {};
  M.visuals = M.visuals || {};
  M.views = M.views || {};
  M.ui = M.ui || {};

  /* ------------------------------------------------------------------ *
   * Paketdaten und Wortschatz
   * M.pack kommt aus pack.json (vom Zusammenbau als pack.js eingebunden).
   * M.t('schlüssel') liefert ein Wort oder einen Satz; pack.vocab überschreibt die deutschen Standardwerte.
   * In Texten sind {platzhalter} erlaubt: {n} aus dem zweiten Argument, sonst andere Wortschatz-Schlüssel.
   * ------------------------------------------------------------------ */

  M.pack = M.pack || {};
  var VOCAB = {
    journey: 'Reise', journeys: 'Reisen',
    station: 'Station', stations: 'Stationen',
    interchange: 'Kreuzung', interchanges: 'Kreuzungen',
    transfer: 'Umsteigen',
    passport: 'Reisepass',
    grandTour: 'Große Rundreise', grandTourShort: 'Rundreise',
    networkMap: 'Netzplan', timeline: 'Zeitstrahl',
    exhibit: 'Exponat', exhibits: 'Exponate',
    museum: 'Museum',
    toolBadge: 'Werkzeug für alle {journeys}',
    moreOnline: 'Weiterlesen',
    hall: 'Halle',
    viewMapTitle: 'Der {networkMap}',
    viewMapLead: 'Alle {journeys} auf einen Blick. Wo sich Linien berühren, kannst du umsteigen.',
    viewTimelineTitle: 'Der {timeline}',
    viewTimelineLead: 'Die historischen {journeys} nebeneinander. Such dir ein Jahr, eine Idee oder einen Irrtum aus.',
    viewPassportTitle: 'Dein {passport}',
    viewPassportLead: 'Stempel, Fortschritt und Vorschläge für die nächste Fahrt. Alles bleibt in deinem Browser.',
    tourTagline: 'Eine Fahrt durch alle {journeys}, von Kreuzung zu Kreuzung',
    tourIntro: 'Statt einer Linie von Anfang bis Ende nimmst du die Abkürzungen: Du steigst an einer Einsteiger-Station ein und wechselst an jeder Kreuzung die Reise, bis du alle einmal berührt hast.',
    tourOutro: 'Du hast alle {journeys} berührt. Am Ende bleiben Fragen offen, und jede Reise lässt sich jetzt Station für Station vertiefen.',
    tourHintStart: 'Einstieg: Du beginnst auf der Reise „{name}“.',
    tourHintTransfer: 'Kreuzung: Hier steigst du von „{from}“ in „{to}“ um.',
    tourHintEnd: 'Endstation: Hier lässt dich die Rundreise mit einer offenen Frage zurück.',
    histKurzSuffix: '',
    skipLink: 'Zum Inhalt springen',
    brandAria: '{title}, zurück zum Eingang',
    tabMap: 'Karte',
    heroEyebrow: '',
    heroClaim: '{n} {journeys} – und die Orte, an denen sie sich kreuzen.',
    ctaTour: '{grandTour} starten',
    ctaMap: '{networkMap} öffnen',
    ctaTimeline: '{timeline}',
    enter: 'Eintreten',
    howEyebrow: 'Orientierung',
    howTitle: 'So funktioniert das {museum}',
    howLead: 'Stell dir {title} wie ein U-Bahn-Netz vor. Jede Linie ist ein Thema, jede Haltestelle ein Gedanke, den du in Ruhe anschauen kannst.',
    step1Title: '1 · {journey} wählen',
    step1Text: '{n} Linien führen durch die Themen. Such dir die aus, die dich neugierig macht.',
    step2Title: '2 · {stations} besuchen',
    step2Text: 'Jede {station} ist ein kleiner Raum: ein Text zum Lesen, ein paar verlässliche Fakten, manchmal ein {exhibit} zum Ausprobieren.',
    step3Title: '3 · An {interchanges} umsteigen',
    step3Text: 'Liegt eine {station} auf mehreren Linien, kannst du dort wechseln. Dort zeigt sich, wie Themen zusammenhängen, die man sonst getrennt lernt.',
    statsLabel: 'Das {museum} in Zahlen',
    tripsEyebrow: 'Reiseführer',
    tripsTitle: '{n} {journeys} zur Auswahl',
    hallLabel: 'Halle: {networkMap}, {timeline} und {passport}',
    footNoteTitle: 'Hinweis',
    footPrivacyTitle: 'Privat, wie ein Museumsbesuch',
    footPrivacyText: 'Kein Tracking, keine Cookies, keine externen Dienste. Besuchte {stations}, Stempel und alles, was du in {exhibits} eingibst, bleiben in deinem Browser und verlassen ihn nie.',
    footIcons: 'Alle Icons sind selbst gezeichnet.',
    newTab: ' (öffnet in neuem Tab)',
    skinLabel: 'Aussehen',
    skinHint: 'Aussehen der Seite wählen'
  };
  // Texte, die als eigene Felder in pack.json stehen (eyebrow, tagline)
  var PACKFIELD = { heroEyebrow: 'eyebrow', heroClaim: 'tagline' };
  M.t = function (key, vars) {
    var v = M.pack && M.pack.vocab && Object.prototype.hasOwnProperty.call(M.pack.vocab, key) ? M.pack.vocab[key] : undefined;
    if (v === undefined && PACKFIELD[key] && M.pack && typeof M.pack[PACKFIELD[key]] === 'string') v = M.pack[PACKFIELD[key]];
    if (v === undefined) v = VOCAB[key];
    if (v === undefined || v === null) return key;
    v = String(v);
    if (v.indexOf('{') < 0) return v;
    return v.replace(/\{(\w+)\}/g, function (m, k) {
      if (vars && Object.prototype.hasOwnProperty.call(vars, k)) return String(vars[k]);
      if (k === 'title') return M.pack.title || '';
      if (k === 'n' || k === 'nl' || k === 'count') {
        var cnt = ((M.data && M.data.journeys) || []).length;
        var w = M.numWord(cnt);
        return k === 'n' ? w : (k === 'nl' ? w.charAt(0).toLowerCase() + w.slice(1) : String(cnt));
      }
      if (k !== key && (VOCAB[k] !== undefined || (M.pack.vocab && M.pack.vocab[k] !== undefined))) return M.t(k, vars);
      return m;
    });
  };
  // Bezeichnung eines Reisetyps: form 'pl' (Mehrzahl), 'sg' (Einzahl), 'sub' (Untertitel); pack.journeyTypes überschreibt
  M.typeLabel = function (typ, form) {
    var jt = M.pack.journeyTypes && M.pack.journeyTypes[typ];
    if (jt && typeof jt === 'string') jt = { pl: jt };
    jt = jt || {};
    form = form || 'pl';
    if (jt[form]) return jt[form];
    var adj = { funktional: 'Funktionale', historisch: 'Historische' }[typ] || '';
    var sub = { funktional: 'Wege durch Themen', historisch: 'Wege durch die Zeit' }[typ] || '';
    if (form === 'sub') return sub;
    return (adj ? adj + ' ' : '') + M.t(form === 'sg' ? 'journey' : 'journeys');
  };
  // erster Buchstabe klein (für Verben und Satzmitte)
  M.tl = function (key, vars) { var s = M.t(key, vars); return s.charAt(0).toLowerCase() + s.slice(1); };
  // Zahl plus Wort: M.tn(3,'station','stations') -> "3 Stationen"
  M.tn = function (n, one, many) { return n + ' ' + M.t(n === 1 ? one : many); };
  // Standardtexte weiterer Module (z. B. js/spiel.js): pack.vocab überschreibt sie, Schlüssel des Kerns bleiben unberührt
  M.addVocab = function (o) { Object.keys(o || {}).forEach(function (k) { if (VOCAB[k] === undefined) VOCAB[k] = o[k]; }); };

  var doc = document;
  var root = doc.documentElement;
  var reduceMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var darkMQ = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false };

  function reduced() { return !!reduceMQ.matches; }
  M.reducedMotion = reduced;

  function byId(id) { return doc.getElementById(id); }
  function warn() {
    if (window.console && console.warn) console.warn.apply(console, ['[Museum Studio]'].concat([].slice.call(arguments)));
  }

  /* ------------------------------------------------------------------ *
   * DOM-Helfer
   * ------------------------------------------------------------------ */

  function appendTo(node, c) {
    if (c === null || c === undefined || c === false || c === true) return;
    if (Array.isArray(c)) { c.forEach(function (x) { appendTo(node, x); }); return; }
    if (c.nodeType) node.appendChild(c);
    else node.appendChild(doc.createTextNode(String(c)));
  }

  function el(tag, attrs) {
    var n = doc.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class' || k === 'className') n.className = v;
        else if (k === 'dataset') Object.keys(v).forEach(function (d) { n.dataset[d] = v[d]; });
        else if (k === 'on') Object.keys(v).forEach(function (e) { n.addEventListener(e, v[e]); });
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'style') {
          if (typeof v === 'string') n.style.cssText = v;
          else Object.keys(v).forEach(function (p) {
            if (p.indexOf('--') === 0) n.style.setProperty(p, v[p]); else n.style[p] = v[p];
          });
        } else if (v === true) n.setAttribute(k, '');
        else n.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) appendTo(n, arguments[i]);
    return n;
  }
  M.el = el;

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  M.esc = esc;

  function ico(key, size, cls) {
    return (M.icons && M.icons.svg) ? M.icons.svg(key, { size: size || 24, cls: cls || '' }) : '';
  }

  // kleine Zusatz-Icons, die im Iconset fehlen (Haken, extern, Pfeil hoch)
  var EXTRA = {
    check: '<path d="M4.6 12.6l4.8 4.8 10-10.4"/>',
    palette: '<path d="M12 3.6a8.4 8.4 0 1 0 0 16.8c1.5 0 2.1-.9 2.1-1.8 0-1-.7-1.4-.7-2.3 0-1 .8-1.7 1.8-1.7h1.7a3.6 3.6 0 0 0 3.6-3.6C20.5 7 16.7 3.6 12 3.6z"/><circle cx="7.6" cy="11.6" r="1"/><circle cx="10.2" cy="7.6" r="1"/><circle cx="14.4" cy="7.2" r="1"/>',
    external: '<path d="M14 4.6h5.4V10M19.4 4.6L10.2 13.8M17.4 14.2v4.2a1.4 1.4 0 0 1-1.4 1.4H5.6a1.4 1.4 0 0 1-1.4-1.4V8a1.4 1.4 0 0 1 1.4-1.4h4.2"/>'
  };
  function xico(key, size, cls) {
    size = size || 16;
    return '<svg class="gm-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      EXTRA[key] + '</svg>';
  }
  M.ui.icon = function (key, size, cls) { return EXTRA[key] ? xico(key, size, cls) : ico(key, size, cls); };

  /* Suchnormalisierung: klein, ohne Akzente, ß -> ss, ae/oe/ue -> a/o/u (damit "ueber" und "über" beide treffen) */
  function norm(s) {
    s = String(s === null || s === undefined ? '' : s).toLowerCase().replace(/ß/g, 'ss');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* ältere Engines */ }
    return s.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/\s+/g, ' ').trim();
  }
  M.norm = norm;

  /* ------------------------------------------------------------------ *
   * aria-live und Toast
   * ------------------------------------------------------------------ */

  var annTimer = null;
  function announce(text) {
    var n = byId('gm-live');
    if (!n) {
      n = el('div', { id: 'gm-live', class: 'gm-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
      doc.body.appendChild(n);
    }
    n.textContent = '';
    clearTimeout(annTimer);
    annTimer = setTimeout(function () { n.textContent = text; }, 60);
  }
  M.announce = announce;

  var toastTimer = null;
  M.toast = function (text) {
    var t = byId('gm-toast');
    if (!t) {
      t = el('div', { id: 'gm-toast', class: 'gm-toast', role: 'status', hidden: true });
      doc.body.appendChild(t);
    }
    t.textContent = text;
    t.hidden = false;
    // Reflow, damit die Einblendung greift
    void t.offsetWidth;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('is-on');
      setTimeout(function () { if (!t.classList.contains('is-on')) t.hidden = true; }, 300);
    }, 3600);
  };

  /* ------------------------------------------------------------------ *
   * Store (localStorage, immer try/catch, Speicher-Fallback im RAM)
   * ------------------------------------------------------------------ */

  var PREFIX = 'gm:';
  var mem = {};
  function sget(k, def) {
    try {
      var raw = window.localStorage.getItem(PREFIX + k);
      if (raw === null) return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : def;
      return JSON.parse(raw);
    } catch (e) {
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : def;
    }
  }
  function sset(k, v) {
    mem[k] = v;
    try { window.localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { /* privater Modus o. ä. */ }
  }

  var visitedSet = null;
  var storeListeners = [];
  function loadVisited() {
    var arr = sget('visited', []);
    visitedSet = {};
    if (Array.isArray(arr)) arr.forEach(function (id) { if (typeof id === 'string') visitedSet[id] = true; });
  }
  function ensureVisited() { if (!visitedSet) loadVisited(); }
  function emit(type, detail) {
    try { doc.dispatchEvent(new CustomEvent(type, { detail: detail })); } catch (e) { /* ältere Engines */ }
  }
  function notifyStore(info) {
    storeListeners.slice().forEach(function (fn) { try { fn(info); } catch (e) { warn('store.onChange', e); } });
  }
  function orderOf(jid) { return (M.data.orders && M.data.orders[jid]) || []; }

  var store = {
    isVisited: function (id) { ensureVisited(); return !!visitedSet[id]; },
    markVisited: function (id) {
      ensureVisited();
      if (!id || visitedSet[id]) return false;
      visitedSet[id] = true;
      sset('visited', Object.keys(visitedSet));
      emit('gm:visited', { id: id });
      notifyStore({ type: 'visited', id: id });
      // Reise abgeschlossen? Dann Stempel vergeben.
      var st = M.data.stations[id];
      var js = st && st.journeys ? st.journeys.slice() : [];
      if (orderOf('rundreise').indexOf(id) >= 0) js.push('rundreise');
      js.forEach(function (j) {
        var p = store.progress(j);
        if (p.total && p.done >= p.total) store.addStamp(j);
      });
      return true;
    },
    visitedCount: function () {
      ensureVisited();
      var ids = Object.keys(visitedSet);
      var known = M.data.stations;
      if (!Object.keys(known).length) return ids.length;
      return ids.filter(function (i) { return known[i]; }).length;
    },
    progress: function (jid) {
      ensureVisited();
      var o = orderOf(jid);
      var done = 0;
      o.forEach(function (id) { if (visitedSet[id]) done++; });
      return { done: done, total: o.length };
    },
    stamps: function () {
      var s = sget('stamps', []);
      return Array.isArray(s) ? s.slice() : [];
    },
    addStamp: function (jid) {
      var s = store.stamps();
      if (s.indexOf(jid) >= 0) return false;
      s.push(jid);
      sset('stamps', s);
      emit('gm:stamp', { journey: jid });
      notifyStore({ type: 'stamp', id: jid });
      return true;
    },
    get: sget,
    set: function (k, v) { sset(k, v); },
    reset: function () {
      visitedSet = {};
      sset('visited', []);
      sset('stamps', []);
      notifyStore({ type: 'reset' });
      emit('gm:visited', { id: null, reset: true });
    },
    onChange: function (fn) {
      storeListeners.push(fn);
      return function () {
        var i = storeListeners.indexOf(fn);
        if (i >= 0) storeListeners.splice(i, 1);
      };
    }
  };
  M.store = store;

  // Änderungen aus einem zweiten Tab übernehmen
  window.addEventListener('storage', function (e) {
    if (e.key === PREFIX + 'visited' || e.key === PREFIX + 'stamps') {
      loadVisited();
      notifyStore({ type: 'external' });
    }
  });

  /* ------------------------------------------------------------------ *
   * Farben und Theme
   * ------------------------------------------------------------------ */

  var colorCache = {};
  function colorOf(id) {
    if (colorCache[id]) return colorCache[id];
    var v = '';
    try { v = getComputedStyle(root).getPropertyValue('--j-' + id).trim(); } catch (e) { v = ''; }
    if (v) { colorCache[id] = v; return v; }
    return 'var(--j-' + id + ')';
  }
  M.colorOf = colorOf;

  var themeMode = 'auto';
  var THEME_BG = { light: '#F6F2EA', dark: '#0E1420' };
  var themeMetas = null;
  // Skins mit mode 'light' oder 'dark' erzwingen die Darstellung, solange sie aktiv sind
  function forcedMode() {
    var sk = M.skin && M.skin.current ? M.skin.current() : null;
    return sk && (sk.mode === 'light' || sk.mode === 'dark') ? sk.mode : null;
  }
  function applyTheme() {
    var tm = forcedMode() || themeMode;
    if (tm === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', tm);
    colorCache = {};
    if (!themeMetas) {
      themeMetas = [].slice.call(doc.querySelectorAll('meta[name="theme-color"]')).map(function (m) {
        return { node: m, orig: m.getAttribute('content') };
      });
    }
    themeMetas.forEach(function (m) {
      var tm2 = forcedMode() || themeMode;
      m.node.setAttribute('content', tm2 === 'auto' ? m.orig : THEME_BG[tm2]);
    });
    emit('gm:theme', { mode: themeMode, effective: theme.effective() });
  }
  var theme = {
    get: function () { return themeMode; },
    effective: function () { var tm = forcedMode() || themeMode; return tm === 'auto' ? (darkMQ.matches ? 'dark' : 'light') : tm; },
    set: function (m) {
      themeMode = (m === 'light' || m === 'dark') ? m : 'auto';
      sset('theme', themeMode);
      applyTheme();
    },
    cycle: function () {
      var next = { auto: 'light', light: 'dark', dark: 'auto' }[themeMode] || 'auto';
      theme.set(next);
      return next;
    },
    init: function () {
      var m = sget('theme', 'auto');
      themeMode = (m === 'light' || m === 'dark') ? m : 'auto';
      applyTheme();
    }
  };
  M.theme = theme;
  var onDarkChange = function () { colorCache = {}; if (themeMode === 'auto') emit('gm:theme', { mode: 'auto', effective: theme.effective() }); };
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', onDarkChange);
  else if (darkMQ.addListener) darkMQ.addListener(onDarkChange);

  /* ------------------------------------------------------------------ *
   * Skins: M.skins = [{id,name,description,map:{lines,nodes},mode}] (vom Zusammenbau erzeugt)
   * Gewählter Skin: data-skin auf <html>, Wahl in localStorage gm:skin, Standard pack.defaultSkin.
   * ------------------------------------------------------------------ */

  M.skins = Array.isArray(M.skins) ? M.skins : [];
  var skinId = null;
  function skinById(id) {
    for (var i = 0; i < M.skins.length; i++) if (M.skins[i].id === id) return M.skins[i];
    return null;
  }
  function applySkin(id, silent) {
    var sk = skinById(id);
    if (!sk) { skinId = null; root.removeAttribute('data-skin'); }
    else { skinId = id; root.setAttribute('data-skin', id); }
    colorCache = {};
    applyTheme();
    if (!silent) emit('gm:skin', { id: skinId, skin: sk });
  }
  M.skin = {
    list: function () { return M.skins.slice(); },
    get: function () { return skinId; },
    current: function () { return skinById(skinId); },
    // Karteneinstellungen des Skins mit Rückfall auf das Standardverhalten
    map: function () {
      var sk = skinById(skinId);
      var m = (sk && sk.map) || {};
      return { lines: m.lines || 'octilinear', nodes: m.nodes || 'icons' };
    },
    set: function (id) {
      if (!skinById(id)) return;
      sset('skin', id);
      applySkin(id);
    },
    init: function () {
      if (!M.skins.length) { applySkin(null, true); return; }
      var id = sget('skin', null);
      if (!skinById(id)) id = M.pack.defaultSkin;
      if (!skinById(id)) id = M.skins[0].id;
      applySkin(id, true);
    }
  };

  /* ------------------------------------------------------------------ *
   * Stationen hinzufügen
   * ------------------------------------------------------------------ */

  M.addStations = function (obj) {
    if (!obj) return;
    Object.keys(obj).forEach(function (k) {
      var s = obj[k];
      if (!s) return;
      if (s.id && s.id !== k) warn((M.t('station') + ' "') + k + '" hat abweichende id "' + s.id + '".');
      s.id = k;
      M.data.stations[k] = s;
    });
  };

  /* ------------------------------------------------------------------ *
   * Arten (Stationstypen)
   * ------------------------------------------------------------------ */

  var KIND = {
    konzept: { label: 'Konzept', icon: 'lightbulb' },
    person: { label: 'Person', icon: 'person' },
    ereignis: { label: 'Ereignis', icon: 'star' },
    methode: { label: 'Methode', icon: 'gear' },
    mythos: { label: 'Mythos', icon: 'question' },
    instrument: { label: 'Instrument', icon: 'flask' },
    ort: { label: 'Ort', icon: 'map' }
  };
  if (M.pack && M.pack.kinds) {
    Object.keys(M.pack.kinds).forEach(function (k) {
      var o = M.pack.kinds[k];
      if (typeof o === 'string') o = { label: o };
      KIND[k] = { label: o.label || (KIND[k] && KIND[k].label) || k, icon: o.icon || (KIND[k] && KIND[k].icon) || 'lightbulb' };
    });
  }
  M.kinds = KIND;

  /* ------------------------------------------------------------------ *
   * finalize(): Graph, Kreuzungen, Rundreise, Suchindex
   * ------------------------------------------------------------------ */

  function jName(id) {
    var j = M.data.journeyById && M.data.journeyById[id];
    return j ? j.name : id;
  }

  function arr(x) { return Array.isArray(x) ? x : (x ? [x] : []); }

  // Zahl als deutsches Wort (großgeschrieben, für Satzanfänge); ab 21 bleibt es bei Ziffern
  var NUMWORDS = ['Null', 'Eine', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Elf', 'Zwölf',
    'Dreizehn', 'Vierzehn', 'Fünfzehn', 'Sechzehn', 'Siebzehn', 'Achtzehn', 'Neunzehn', 'Zwanzig'];
  M.numWord = function (n) { return n >= 0 && n < NUMWORDS.length ? NUMWORDS[n] : String(n); };

  function finalize() {
    var D = M.data;
    D.journeys = Array.isArray(D.journeys) ? D.journeys : [];
    D.orders = D.orders || {};

    // Rohdaten der Reihenfolgen einmalig sichern, damit finalize wiederholbar bleibt
    if (!D.ordersRaw) {
      D.ordersRaw = {};
      Object.keys(D.orders).forEach(function (k) {
        if (k !== 'rundreise') D.ordersRaw[k] = D.orders[k].slice();
      });
    }

    D.journeyById = {};
    D.journeys.forEach(function (j) { D.journeyById[j.id] = j; });

    var S = D.stations;
    var ids = Object.keys(S);
    var problems = { missingStation: [], unknownJourney: [], addedToOrder: [], addedToJourneys: [], noMyth: [], noCross: [] };

    ids.forEach(function (id) {
      var s = S[id];
      s.id = id;
      s.title = s.title || id;
      s.journeys = arr(s.journeys).slice();
      s.text = arr(s.text);
      s.facts = arr(s.facts);
      s.further = arr(s.further);
      s.blog = arr(s.blog);
      s.cross = s.cross || {};
      s.order = {};
    });

    // Reihenfolgen: nur vorhandene Stationen, nur bekannte Reisen
    var orders = {};
    Object.keys(D.ordersRaw).forEach(function (jid) {
      if (!D.journeyById[jid]) { problems.unknownJourney.push('orders.' + jid); return; }
      orders[jid] = D.ordersRaw[jid].filter(function (sid, i, a) {
        if (!S[sid]) { problems.missingStation.push(sid); return false; }
        return a.indexOf(sid) === i;
      });
    });
    D.journeys.forEach(function (j) { if (!orders[j.id]) orders[j.id] = []; });

    // Zugehörigkeit abgleichen (Stationsplan ist die Wahrheit, Warnungen statt Abbruch)
    ids.forEach(function (id) {
      var s = S[id];
      s.journeys.forEach(function (jid) {
        if (!D.journeyById[jid]) { problems.unknownJourney.push(id + '→' + jid); return; }
        if (orders[jid].indexOf(id) < 0) { orders[jid].push(id); problems.addedToOrder.push(id + '@' + jid); }
      });
    });
    Object.keys(orders).forEach(function (jid) {
      orders[jid].forEach(function (sid, i) {
        var s = S[sid];
        if (s.journeys.indexOf(jid) < 0) { s.journeys.push(jid); problems.addedToJourneys.push(sid + '@' + jid); }
        s.order[jid] = i;
      });
    });

    // Reisen, die in der Reihenfolge sind, aber nicht in Stationsdaten zählen, bleiben bestehen
    D.orders = orders;

    // Kreuzungen
    M.crossings = ids.map(function (id) { return S[id]; }).filter(function (s) {
      return s.journeys.filter(function (j) { return D.journeyById[j]; }).length >= 2;
    });

    // Validierung (nur Hinweise)
    ids.forEach(function (id) {
      var s = S[id];
      if (s.kind === 'mythos' && !(s.myth && s.myth.glaube && s.myth.wahrheit)) problems.noMyth.push(id);
      s.journeys.forEach(function (j) {
        if (s.journeys.length > 1 && j !== s.journeys[0] && !s.cross[j] && D.journeyById[j]) problems.noCross.push(id + '@' + j);
      });
    });
    Object.keys(problems).forEach(function (k) {
      var list = problems[k].filter(function (x, i, a) { return a.indexOf(x) === i; });
      if (!list.length) return;
      var text = {
        missingStation: (M.t('stations') + ' in orders, aber ohne Datensatz'),
        unknownJourney: ('Unbekannte ' + M.t('journeys')),
        addedToOrder: (M.t('station') + ' fehlt in der Reihenfolge ihrer ' + M.t('journey') + ' (hinten angehängt)'),
        addedToJourneys: (M.t('station') + ' steht in der Reihenfolge, aber nicht in journeys (ergänzt)'),
        noMyth: 'Mythos ohne myth-Objekt',
        noCross: 'Umstieg ohne cross-Satz'
      }[k];
      warn(text + ' (' + list.length + '): ' + list.slice(0, 12).join(', ') + (list.length > 12 ? ' …' : ''));
    });

    buildRundreise();
    buildSearchIndex();
    return M;
  }
  M.finalize = finalize;

  M.neighbors = function (id) {
    var s = M.data.stations[id];
    if (!s) return [];
    var out = [];
    (s.journeys || []).forEach(function (jid) {
      var o = orderOf(jid);
      var i = o.indexOf(id);
      if (i < 0) return;
      out.push({ journey: jid, index: i, total: o.length, prev: i > 0 ? o[i - 1] : null, next: i < o.length - 1 ? o[i + 1] : null });
    });
    return out;
  };

  /* ------------------------------------------------------------------ *
   * Die Große Rundreise: von Kreuzung zu Kreuzung durch alle Reisen
   * ------------------------------------------------------------------ */

  // pack.grandTour: { start: Reise-ID, end: [Stations-IDs, bevorzugtes Ende], openEnd: Stations-ID mit offener Frage, tagline, intro, outro, outroOpen }
  function gt() { return (M.pack && M.pack.grandTour) || {}; }

  function buildRundreise() {
    var D = M.data;
    var S = D.stations;
    var orders = D.orders;
    var real = D.journeys.filter(function (j) { return orders[j.id] && orders[j.id].length; }).map(function (j) { return j.id; });

    delete D.journeyById.rundreise;
    delete orders.rundreise;
    if (real.length < 2) { return; }

    function common(a, b) {
      return orders[a].filter(function (id) { return S[id].journeys.indexOf(b) >= 0; });
    }
    var adj = {};
    real.forEach(function (a) {
      adj[a] = real.filter(function (b) { return b !== a && common(a, b).length > 0; });
    });

    var G = gt();
    var RUNDREISE_END = G.end || [];
    var startJ = real.indexOf(G.start) >= 0 ? G.start : real[0];
    var endStation = null;
    for (var e = 0; e < RUNDREISE_END.length; e++) {
      if (S[RUNDREISE_END[e]]) { endStation = S[RUNDREISE_END[e]]; break; }
    }

    // Weg durch die Reisen: erst vollständig mit gewünschtem Ende, dann vollständig, dann der längste.
    // Die Tiefensuche ordnet Nachbarn nach Warnsdorff (wenigste freie Anschlüsse zuerst) und hat ein Budget,
    // damit sie auch bei vielen Reisen nie hängt.
    function findPath(wantEnd) {
      var best = null;
      var full = false;
      var budget = 60000;
      function freeDeg(x, path) {
        var c = 0;
        adj[x].forEach(function (y) { if (path.indexOf(y) < 0) c++; });
        return c;
      }
      (function dfs(path) {
        if (full || budget-- <= 0) return;
        if (!best || path.length > best.length) best = path.slice();
        if (path.length === real.length) {
          var last = path[path.length - 1];
          if (!wantEnd || S[wantEnd.id].journeys.indexOf(last) >= 0) { best = path.slice(); full = true; }
          return;
        }
        var cur = path[path.length - 1];
        var cands = adj[cur].filter(function (n) { return path.indexOf(n) < 0; });
        cands.sort(function (a, b) { return freeDeg(a, path) - freeDeg(b, path); });
        cands.forEach(function (n) {
          if (full || budget <= 0) return;
          path.push(n);
          dfs(path);
          path.pop();
        });
      })([startJ]);
      return { path: best, full: full };
    }
    var res = endStation ? findPath(endStation) : { full: false };
    if (!res.full) res = findPath(null);
    var seq = res.path;
    if (!seq || seq.length < 2) return;

    // Stationen wählen: Strahlsuche über die Umsteigekandidaten. Kurze Fahrten in Fahrtrichtung werden bevorzugt,
    // keine Station darf zweimal vorkommen (sonst verrutschen die Etappen).
    var n = seq.length - 1;
    var layers = [];
    var s0 = orders[startJ][0];
    layers.push([s0]);
    for (var k = 1; k <= n; k++) layers.push(common(seq[k - 1], seq[k]));
    var lastJ = seq[n];
    var endCands;
    if (endStation && S[endStation.id].journeys.indexOf(lastJ) >= 0) endCands = [endStation.id];
    else endCands = orders[lastJ].slice().reverse().slice(0, 4);
    layers.push(endCands);

    function cost(j, a, b) {
      var d = orders[j].indexOf(b) - orders[j].indexOf(a);
      return d > 0 ? d : 3 * Math.abs(d) + 2;
    }
    var beam = [{ c: 0, path: [s0] }];
    for (var L = 1; L < layers.length; L++) {
      var rideJ = seq[L - 1];
      var next = [];
      beam.forEach(function (b) {
        var prev = b.path[b.path.length - 1];
        layers[L].forEach(function (cand) {
          if (b.path.indexOf(cand) >= 0) return;
          next.push({ c: b.c + cost(rideJ, prev, cand), path: b.path.concat(cand) });
        });
      });
      if (!next.length) break;
      next.sort(function (a, b) { return a.c - b.c; });
      beam = next.slice(0, 60);
    }
    var path = beam[0].path;
    if (path.length < 2) return;

    // Etappen: legs[i] = Reise, mit der man an Station i ankommt; onward[i] = Reise, auf der man weiterfährt
    var legs = [], onward = [], steps = [];
    path.forEach(function (id, i) {
      var via = i === 0 ? seq[0] : seq[Math.min(i - 1, seq.length - 1)];
      var next = i < path.length - 1 ? seq[Math.min(i, seq.length - 1)] : null;
      legs.push(via);
      onward.push(next);
      var hint;
      if (i === 0) hint = M.t('tourHintStart', { name: jName(seq[0]) });
      else if (next) hint = M.t('tourHintTransfer', { from: jName(via), to: jName(next) });
      else hint = M.t('tourHintEnd');
      steps.push({ station: id, via: via, next: next, hint: hint });
    });

    var endsOpen = !!G.openEnd && endStation && path[path.length - 1] === endStation.id && endStation.id === G.openEnd;
    D.orders.rundreise = path;
    D.journeyById.rundreise = {
      id: 'rundreise',
      typ: 'rundreise',
      virtual: true,
      name: M.t('grandTour'),
      kurz: M.t('grandTourShort'),
      tagline: G.tagline || M.t('tourTagline'),
      intro: G.intro || M.t('tourIntro'),
      outro: endsOpen && G.outroOpen ? G.outroOpen : (G.outro || M.t('tourOutro')),
      icon: 'compass',
      legs: legs,
      onward: onward,
      steps: steps
    };
  }

  M.rundreiseStep = function (stationId) {
    var j = M.data.journeyById && M.data.journeyById.rundreise;
    if (!j) return null;
    for (var i = 0; i < j.steps.length; i++) if (j.steps[i].station === stationId) return j.steps[i];
    return null;
  };

  /* ------------------------------------------------------------------ *
   * Suchindex
   * ------------------------------------------------------------------ */

  function buildSearchIndex() {
    var D = M.data;
    M.searchIndex = Object.keys(D.stations).map(function (id) {
      var s = D.stations[id];
      var body = [].concat(s.text, s.facts, s.further,
        s.quote ? [s.quote.text, s.quote.who, s.quote.src] : [],
        s.myth ? [s.myth.glaube, s.myth.wahrheit] : [],
        s.blog.map(function (b) { return b.t; })).join(' ');
      var meta = [KIND[s.kind] ? KIND[s.kind].label : s.kind, s.yearLabel || s.year || ''].concat(
        s.journeys.map(function (j) { var jj = D.journeyById[j]; return jj ? jj.name + ' ' + (jj.kurz || '') : j; })).join(' ');
      return {
        id: id, type: 'station', title: s.title, teaser: s.teaser || '', kind: s.kind, journeys: s.journeys, year: s.year,
        nTitle: norm(s.title), nTeaser: norm(s.teaser || ''), nBody: norm(body), nMeta: norm(meta)
      };
    });
  }

  /* ------------------------------------------------------------------ *
   * UI: Chips
   * ------------------------------------------------------------------ */

  M.ui.journeyChip = function (jid, o) {
    o = o || {};
    var j = M.data.journeyById && M.data.journeyById[jid];
    var label = j ? (j.kurz || j.name) : jid;
    var tag = o.onClick ? 'button' : 'span';
    var attrs = {
      class: 'gm-chip' + (o.active ? ' is-active' : ''),
      style: { '--jc': 'var(--j-' + jid + ')' },
      dataset: { journey: jid }
    };
    if (o.onClick) {
      attrs.type = 'button';
      attrs.on = { click: function (e) { o.onClick(jid, e); } };
      if (o.active !== undefined) attrs['aria-pressed'] = o.active ? 'true' : 'false';
    }
    var chip = el(tag, attrs,
      el('span', { class: 'gm-chip-dot', 'aria-hidden': 'true', html: j && j.icon ? ico(j.icon, 13) : '' }),
      el('span', { class: 'gm-chip-label' }, label));
    if (j && j.name && j.name !== label) chip.title = j.name;
    return chip;
  };

  /* ------------------------------------------------------------------ *
   * UI: Station-Renderer (das Herzstück)
   * ------------------------------------------------------------------ */

  var uidN = 0;

  function yearText(st) {
    if (st.yearLabel) return String(st.yearLabel);
    if (typeof st.year === 'number') return st.year < 0 ? Math.abs(st.year) + ' v. Chr.' : String(st.year);
    return '';
  }

  function splitTitle(t) {
    var i = t.indexOf(': ');
    if (i > 2 && i < t.length - 3) return [t.slice(0, i), t.slice(i + 2)];
    return [t, ''];
  }

  function quoteWrap(t) {
    t = String(t || '').trim();
    return /^[„"“«»‚‘']/.test(t) ? t : '„' + t + '“';
  }

  function buildMyth(st, uid) {
    var m = st.myth;
    var old = st.year && st.year < 1980;
    var frontLabel = old ? 'Damals geglaubt' : 'Weit verbreitet geglaubt';
    var front = el('div', { class: 'gm-flip-face gm-flip-front' },
      el('span', { class: 'gm-flip-label' }, frontLabel),
      el('p', { class: 'gm-flip-text' }, m.glaube),
      el('span', { class: 'gm-flip-stamp', 'aria-hidden': 'true' }, 'Irrtum?'));
    var back = el('div', { class: 'gm-flip-face gm-flip-back', 'aria-hidden': 'true' },
      el('span', { class: 'gm-flip-label' }, 'Heute wissen wir'),
      el('p', { class: 'gm-flip-text' }, m.wahrheit),
      el('span', { class: 'gm-flip-tick', 'aria-hidden': 'true', html: xico('check', 22) }));
    var inner = el('div', { class: 'gm-flip-inner' }, front, back);
    var card = el('div', { class: 'gm-flip', 'data-flipped': 'false' }, inner);
    var btn = el('button', {
      type: 'button', class: 'gm-btn gm-btn-ghost gm-flip-btn', 'aria-pressed': 'false', 'aria-describedby': uid + '-mh'
    }, el('span', { html: ico('circle-arrows', 18) }), el('span', null, 'Karte umdrehen'));
    var hint = el('span', { id: uid + '-mh', class: 'gm-sr' }, 'Wechselt zwischen dem, was man glaubte, und dem, was wir heute wissen.');

    function flip() {
      var on = card.getAttribute('data-flipped') !== 'true';
      card.setAttribute('data-flipped', on ? 'true' : 'false');
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      front.setAttribute('aria-hidden', on ? 'true' : 'false');
      back.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) { announce('Heute wissen wir: ' + m.wahrheit); emit('gm:myth', { id: st.id, card: card }); }
      else announce(frontLabel + ': ' + m.glaube);
    }
    btn.addEventListener('click', flip);
    card.addEventListener('click', function (e) { if (!e.target.closest('button')) flip(); });

    return el('section', { class: 'gm-st-myth', 'aria-label': 'Mythos-Check' },
      el('h3', { class: 'gm-st-h' }, 'Mythos-Check'),
      card,
      el('div', { class: 'gm-flip-bar' }, btn, hint));
  }

  /* Abbildung zur Station: M.visuals[stationId] = { alt, caption, mount(container, ctx) -> destroy? } */
  function buildVisual(st) {
    var v = M.visuals && M.visuals[st.id];
    if (!v || typeof v.mount !== 'function') return null;
    var holder = el('div', { class: 'gm-fig-stage' });
    var fig = el('figure', { class: 'gm-st-figure', dataset: { visual: st.id } },
      holder,
      v.caption ? el('figcaption', null, v.caption) : null);
    if (v.alt) { holder.setAttribute('role', 'group'); holder.setAttribute('aria-label', v.alt); }
    var destroy = null;
    try {
      var r = v.mount(holder, { station: st });
      if (typeof r === 'function') destroy = r;
      else if (r && typeof r.destroy === 'function') destroy = function () { r.destroy(); };
    } catch (err) {
      warn('Abbildung "' + st.id + '" konnte nicht aufgebaut werden', err);
      return null;
    }
    fig.gmDestroy = destroy;
    return fig;
  }

  function buildExhibit(st, art) {
    var id = st.exhibit;
    var ex = M.exhibits && M.exhibits[id];
    var sec = el('section', { class: 'gm-st-exhibit', 'aria-label': M.t('exhibit') });
    var title = (ex && ex.title) || M.t('exhibit');
    var mount = el('div', { class: 'gm-stage-mount', tabindex: '-1', hidden: true });
    var info = el('div', { class: 'gm-plaque-info' },
      el('span', { class: 'gm-plaque-eyebrow' }, M.t('exhibit')),
      el('h3', { class: 'gm-plaque-title' }, title),
      ex && ex.blurb ? el('p', { class: 'gm-plaque-blurb' }, ex.blurb) : null);
    var plaque = el('div', { class: 'gm-plaque' }, info);
    var endRow = el('div', { class: 'gm-stage-end', hidden: true });
    var destroyFn = null, running = false;
    var startBtn, endBtn;
    var note = el('p', { class: 'gm-stage-note', role: 'status' }, ('Dieses ' + M.t('exhibit') + ' ist noch in Vorbereitung.'));

    function stop() {
      if (destroyFn) { try { destroyFn(); } catch (e) { warn((M.t('exhibit') + '-destroy'), e); } destroyFn = null; }
      if (running) { running = false; emit('gm:exhibit-end', { id: id, station: st.id }); }
      mount.innerHTML = '';
      mount.hidden = true;
      endRow.hidden = true;
      info.hidden = false;
      if (mount.parentNode) mount.parentNode.classList.remove('is-running');
      if (startBtn) startBtn.parentNode.hidden = false;
    }
    function start() {
      var exx = M.exhibits && M.exhibits[id];
      if (!exx || typeof exx.mount !== 'function') { startBtn.parentNode.hidden = true; if (!note.parentNode) plaque.appendChild(note); return; }
      stop();
      startBtn.parentNode.hidden = true;
      info.hidden = true;
      mount.hidden = false;
      endRow.hidden = false;
      mount.parentNode.classList.add('is-running');
      try {
        var r = exx.mount(mount, { station: st, journeyId: art.getAttribute('data-journey') });
        if (typeof r === 'function') destroyFn = r;
        else if (r && typeof r.destroy === 'function') destroyFn = function () { r.destroy(); };
      } catch (err) {
        warn((M.t('exhibit') + ' "') + id + '" konnte nicht gestartet werden', err);
        mount.innerHTML = '';
        mount.appendChild(el('p', { class: 'gm-stage-note', role: 'alert' }, ('Dieses ' + M.t('exhibit') + ' lässt sich gerade nicht starten. Lade die Seite bitte neu.')));
      }
      announce((M.t('exhibit') + ' gestartet: ') + title);
      running = true;
      emit('gm:exhibit-start', { id: id, station: st.id, mount: mount });
      mount.focus({ preventScroll: true });
      try { mount.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' }); } catch (e) { /* egal */ }
    }

    if (ex && typeof ex.mount === 'function') {
      startBtn = el('button', { type: 'button', class: 'gm-btn gm-btn-primary', on: { click: start } },
        el('span', { html: ico('flask', 18) }), el('span', null, (M.t('exhibit') + ' starten')));
      endBtn = el('button', { type: 'button', class: 'gm-btn gm-btn-quiet', on: { click: function () { stop(); startBtn.focus({ preventScroll: true }); } } },
        (M.t('exhibit') + ' beenden'));
      endRow.appendChild(endBtn);
      plaque.appendChild(el('div', { class: 'gm-plaque-actions' }, startBtn));
    } else {
      plaque.appendChild(note);
    }
    sec.appendChild(el('div', { class: 'gm-stage' }, plaque, mount, endRow));
    sec.appendChild(el('div', { class: 'gm-plinth', 'aria-hidden': 'true' }));
    var prevD = art.gmDestroy;
    art.gmDestroy = function () { if (prevD) prevD(); stop(); };
    return sec;
  }

  // Spielplan: Zugang einer Einheit; ohne Spielplan null (alles offen, alles sichtbar)
  function zugangVon(unitId) { return M.spiel && M.spiel.aktiv ? M.spiel.zugang(unitId) : null; }
  // Spielplan: ruhiges Hinweisbild für eine noch verschlossene Einheit (Element) oder null, wenn sie offen ist
  function lockPage(unitId, o) { return M.spiel && M.spiel.aktiv && typeof M.spiel.sperrseite === 'function' ? M.spiel.sperrseite(unitId, o) : null; }

  function buildTransfer(st, art, accent, opts) {
    var others = st.journeys.filter(function (j) {
      if (j === accent || !M.data.journeyById[j]) return false;
      var z = zugangVon('episode/' + j);
      return !z || z.sichtbar;   // verborgene Reisen werden nicht verraten
    });
    if (!others.length) return null;
    var step = M.rundreiseStep(st.id);
    var nextRoute = opts.journeyId === 'rundreise' && step ? step.next : null;
    var h = 'gm-tr-' + (++uidN);

    var list = el('ul', { class: 'gm-tr-list' + (others.length >= 3 ? ' is-many' : '') });
    others.forEach(function (jid) {
      var j = M.data.journeyById[jid];
      var sentence = st.cross && st.cross[jid];
      var zj = zugangVon('episode/' + jid);
      if (zj && !zj.offen) sentence = zj.bedingung || M.t('spielGesperrt');   // gesperrte Reise: nur die Bedingung, kein Inhalt
      var b = el('button', {
        type: 'button', class: 'gm-tr-btn' + (jid === nextRoute ? ' is-next' : ''),
        style: { '--jc': 'var(--j-' + jid + ')' },
        dataset: { journey: jid },
        on: {
          click: function () {
            var go = function () {
              if (typeof opts.onTransfer === 'function') { opts.onTransfer(jid, st); return; }
              var cur = M.nav.current();
              var order = orderOf(jid);
              var idx = order.indexOf(st.id);
              if (cur.journey) M.nav.openJourney(jid, idx >= 0 ? idx : undefined);
              else M.nav.openStation(st.id, jid);
            };
            if (reduced()) go();
            else { b.classList.add('is-go'); setTimeout(go, 260); }
          }
        }
      },
        el('span', { class: 'gm-tr-ico', 'aria-hidden': 'true', html: ico(j.icon || 'train', 26) }),
        el('span', { class: 'gm-tr-text' },
          el('span', { class: 'gm-tr-name' }, (M.t('transfer') + ': ') + j.name),
          el('span', { class: 'gm-tr-why' }, sentence || ('Diese ' + M.t('station') + ' gehört auch zu dieser ' + M.t('journey') + '.')),
          jid === nextRoute ? el('span', { class: 'gm-tr-next' }, ('Nächste Etappe der ' + M.t('grandTour'))) : null),
        el('span', { class: 'gm-tr-go', 'aria-hidden': 'true', html: ico('arrow-right', 22) }));
      list.appendChild(el('li', null, b));
    });

    var curName = jName(accent);
    return el('section', { class: 'gm-st-transfer', 'aria-labelledby': h },
      el('h3', { class: 'gm-st-h', id: h }, el('span', { html: ico('network', 18) }), ('Hier ' + M.tl('transfer'))),
      el('p', { class: 'gm-tr-lead' },
        ('Diese ' + M.t('station') + ' ist eine ' + M.t('interchange') + '. Du bist gerade auf der ' + M.t('journey') + ' „') + curName + '“. ' +
        (others.length === 1 ? 'Eine weitere Linie hält hier:' : others.length + ' weitere Linien halten hier:')),
      list);
  }

  function renderStation(st, opts) {
    opts = opts || {};
    var D = M.data;
    var compact = !!opts.compact;
    var home = st.journeys && st.journeys[0];
    var cj = opts.journeyId;
    var accent = home;
    if (cj && st.journeys.indexOf(cj) >= 0) accent = cj;
    else if (cj === 'rundreise') {
      var rs = M.rundreiseStep(st.id);
      accent = rs && rs.via && st.journeys.indexOf(rs.via) >= 0 ? rs.via : (rs && rs.next && st.journeys.indexOf(rs.next) >= 0 ? rs.next : home);
    }
    var K = KIND[st.kind] || KIND.konzept;
    var uid = 'gm-st-' + String(st.id).replace(/[^a-z0-9_-]/gi, '-') + '-' + (++uidN);
    var yt = yearText(st);
    var parts = splitTitle(st.title);

    var art = el('article', {
      class: 'gm-station' + (compact ? ' is-compact' : ''),
      'aria-labelledby': uid + '-t',
      style: { '--jc': 'var(--j-' + accent + ')' },
      dataset: { kind: st.kind || 'konzept', id: st.id, journey: accent || '' }
    });

    // Kopf
    var chips = el('ul', { class: 'gm-st-chips', 'aria-label': (M.t('journeys') + ' dieser ' + M.t('station')) });
    st.journeys.forEach(function (jid) {
      var zj = zugangVon('episode/' + jid);
      if (zj && !zj.sichtbar) return;   // Spielplan: eine verborgene Reise wird nicht genannt
      chips.appendChild(el('li', null, M.ui.journeyChip(jid, {
        active: jid === accent,
        onClick: typeof opts.onChip === 'function' ? function () { opts.onChip(jid, st); } : null
      })));
    });
    var seen = el('span', { class: 'gm-st-seen', hidden: true, html: xico('check', 14) + '<span>Besucht</span>' });
    var head = el('header', { class: 'gm-st-head' },
      el('div', { class: 'gm-st-medal', 'aria-hidden': 'true', html: ico(st.icon || K.icon, 36) }),
      el('div', { class: 'gm-st-headtext' },
        el('p', { class: 'gm-st-eyebrow' },
          el('span', { class: 'gm-st-kind', html: ico(K.icon, 14) + '<span>' + esc(K.label) + '</span>' }),
          yt ? el('span', { class: 'gm-st-year', 'aria-label': 'Jahr ' + yt }, yt) : null,
          seen),
        el('h' + (opts.headingLevel || 2), { id: uid + '-t', class: 'gm-st-title' },
          el('span', { class: 'gm-st-main' }, parts[0]),
          parts[1] ? [el('span', { class: 'gm-sr' }, ': '), el('span', { class: 'gm-st-sub' }, parts[1])] : null),
        chips));
    art.appendChild(head);

    function syncSeen() { seen.hidden = !store.isVisited(st.id); }
    syncSeen();
    var off = store.onChange(function () {
      if (!art.isConnected && art.gmSeenOnce) { off(); return; }
      syncSeen();
    });
    setTimeout(function () { art.gmSeenOnce = true; }, 0);

    if (st.teaser) art.appendChild(el('p', { class: 'gm-st-lead' }, st.teaser));

    if (st.myth && st.myth.glaube && st.myth.wahrheit) art.appendChild(buildMyth(st, uid));

    if (!compact) {
      if (st.text.length) {
        var body = el('div', { class: 'gm-st-body' + (/^[A-Za-zÄÖÜäöüß]/.test(st.text[0]) ? ' has-dc' : '') });
        var fig = buildVisual(st);
        st.text.forEach(function (p, i) {
          body.appendChild(el('p', null, p));
          if (i === 0 && fig) body.appendChild(fig);
        });
        if (fig && st.text.length === 0) body.appendChild(fig);
        if (fig && fig.gmDestroy) {
          var prevDestroy = art.gmDestroy;
          art.gmDestroy = function () { if (prevDestroy) prevDestroy(); try { fig.gmDestroy(); } catch (e) { warn('Abbildung-destroy', e); } };
        }
        art.appendChild(body);
      }
      if (st.facts.length) {
        var fl = el('ul', { class: 'gm-st-factlist' });
        st.facts.forEach(function (f, i) {
          fl.appendChild(el('li', { class: 'gm-fact' }, el('span', { class: 'gm-fact-n', 'aria-hidden': 'true' }, String(i + 1)), el('span', { class: 'gm-fact-t' }, f)));
        });
        art.appendChild(el('section', { class: 'gm-st-facts', 'aria-label': 'Auf einen Blick' },
          el('h3', { class: 'gm-st-h' }, el('span', { html: ico('checklist', 18) }), 'Auf einen Blick'), fl));
      }
      if (st.quote && st.quote.text) {
        art.appendChild(el('figure', { class: 'gm-st-quote' },
          el('blockquote', null, el('p', null, quoteWrap(st.quote.text))),
          st.quote.who || st.quote.src ? el('figcaption', null,
            st.quote.who ? el('span', { class: 'gm-q-who' }, st.quote.who) : null,
            st.quote.src ? el('cite', null, st.quote.src) : null) : null));
      }
      if (st.exhibit) art.appendChild(buildExhibit(st, art));
    }

    if (opts.hideTransfer !== true) {
      var tr = buildTransfer(st, art, accent, opts);
      if (tr) art.appendChild(tr);
    }

    if (!compact) {
      var blog = st.blog.filter(function (b) { return b && b.u; });
      // Zusatzmaterial aus dem Wissensregister (nur Verweise: Titel + Link)
      ((M.material && M.material[st.id]) || []).forEach(function (b) {
        if (b && b.u && !blog.some(function (x) { return x.u === b.u; })) blog.push(b);
      });
      if (blog.length || st.further.length) {
        var more = el('footer', { class: 'gm-st-more' });
        if (blog.length) {
          var bl = el('ul', { class: 'gm-st-links' });
          blog.forEach(function (b) {
            bl.appendChild(el('li', null, el('a', { href: b.u, target: '_blank', rel: 'noopener' },
              el('span', null, b.t || b.u),
              el('span', { class: 'gm-sr' }, ' (öffnet in neuem Tab)'),
              el('span', { 'aria-hidden': 'true', html: xico('external', 15) }))));
          });
          more.appendChild(el('div', { class: 'gm-st-morecol' },
            el('h3', { class: 'gm-st-h' }, M.t('moreOnline')), bl));
        }
        if (st.further.length) {
          var fr = el('ul', { class: 'gm-st-refs' });
          st.further.forEach(function (r) { fr.appendChild(el('li', null, r)); });
          more.appendChild(el('div', { class: 'gm-st-morecol' },
            el('h3', { class: 'gm-st-h' }, el('span', { html: ico('book', 18) }), 'Lesetipps'), fr));
        }
        art.appendChild(more);
      }
    }

    // Besuch erfassen, sobald die Station tatsächlich sichtbar ist (gelesen, nicht nur gerendert)
    if (!compact && opts.markVisited !== false) {
      var tries = 0;
      (function tick() {
        if (store.isVisited(st.id)) return;
        if (art.isConnected && !doc.hidden && art.getClientRects().length > 0) { store.markVisited(st.id); return; }
        if (++tries < 40) setTimeout(tick, 700);
      })();
    }
    // Spielplan (nur mit spielplan.json): Lesefortschritt, Rückmeldung am Ort, Teilen
    if (!compact && M.spiel && M.spiel.aktiv && typeof M.spiel.station === 'function') {
      try { M.spiel.station(art, st, { journeyId: cj }); } catch (e) { warn('spiel.station', e); }
    }
    return art;
  }
  M.ui.renderStation = renderStation;
  M.ui.destroyStation = function (a) { if (a && typeof a.gmDestroy === 'function') a.gmDestroy(); };

  /* ------------------------------------------------------------------ *
   * Modale Ebenen: Fokus, inert, Scroll-Sperre, Escape
   * ------------------------------------------------------------------ */

  var overlays = [];
  var REGIONS = ['kopf', 'main', 'fuss', 'stationspanel', 'reise', 'suche-overlay'];

  function findOv(node) {
    for (var i = 0; i < overlays.length; i++) if (overlays[i].el === node) return i;
    return -1;
  }
  function syncOverlays() {
    var top = overlays[overlays.length - 1];
    REGIONS.forEach(function (id) {
      var n = byId(id);
      if (!n) return;
      if (top && n !== top.el) n.setAttribute('inert', ''); else n.removeAttribute('inert');
    });
    if (overlays.length && !root.classList.contains('gm-lock')) {
      var sbw = window.innerWidth - root.clientWidth;
      root.style.setProperty('--sbw', (sbw > 0 ? sbw : 0) + 'px');
    }
    root.classList.toggle('gm-lock', overlays.length > 0);
    if (!overlays.length) root.style.removeProperty('--sbw');
  }
  function ovOpen(node, o) {
    o = o || {};
    var i = findOv(node);
    if (i >= 0) {
      var rec0 = overlays.splice(i, 1)[0];
      if (o.onClose) rec0.onClose = o.onClose;
      overlays.push(rec0);
      syncOverlays();
      return;
    }
    var ret = o.returnFocus || doc.activeElement;
    overlays.push({ el: node, onClose: o.onClose, ret: ret });
    node.hidden = false;
    node.classList.remove('is-closing');
    syncOverlays();
    requestAnimationFrame(function () { if (findOv(node) >= 0) node.classList.add('is-open'); });
    var target = o.focus;
    if (typeof target === 'string') target = node.querySelector(target);
    if (!target) target = node.querySelector('[autofocus]');
    if (!target) { if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1'); target = node; }
    try { target.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }
  function ovClose(node, o) {
    o = o || {};
    var i = findOv(node);
    if (i < 0) return;
    var rec = overlays.splice(i, 1)[0];
    node.classList.remove('is-open');
    if (reduced()) { node.hidden = true; node.classList.remove('is-closing'); }
    else {
      node.classList.add('is-closing');
      setTimeout(function () {
        if (findOv(node) < 0) { node.hidden = true; node.classList.remove('is-closing'); }
      }, 300);
    }
    syncOverlays();
    if (o.restoreFocus !== false) {
      var ret = o.returnFocus || rec.ret;
      if (ret && ret !== doc.body && ret.isConnected && !node.contains(ret) && ret.focus) {
        try { ret.focus({ preventScroll: true }); } catch (e) { /* egal */ }
      } else if (!overlays.length && (doc.activeElement === doc.body || node.contains(doc.activeElement))) {
        var m = byId('main');
        if (m) { try { m.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
      }
    }
  }
  M.ui.overlay = { open: ovOpen, close: ovClose, isOpen: function () { return overlays.length > 0; } };

  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || e.defaultPrevented || !overlays.length) return;
    var top = overlays[overlays.length - 1];
    e.preventDefault();
    if (typeof top.onClose === 'function') top.onClose();
    else ovClose(top.el);
  });

  /* ------------------------------------------------------------------ *
   * Ansichten (Karte, Zeitstrahl, Reisepass): Panes, Übergang, Registry
   * ------------------------------------------------------------------ */

  var VIEWS = [
    { id: 'karte', t: 'viewMap' },
    { id: 'zeitstrahl', t: 'viewTimeline' },
    { id: 'reisepass', t: 'viewPassport' }
  ];
  // Zeitstrahl nur, wenn das Paket historische Reisen hat
  M.hasTimeline = function () {
    return (M.data.journeys || []).some(function (j) { return j.typ === 'historisch'; });
  };
  function views() {
    return VIEWS.filter(function (v) { return v.id !== 'zeitstrahl' || M.hasTimeline(); }).map(function (v) {
      return { id: v.id, title: M.t(v.t + 'Title'), lead: M.t(v.t + 'Lead') };
    });
  }
  var VIEW_TITLE = {};
  var panes = {};
  var mounted = {};
  var shownPane = null;

  function ensurePanes() {
    var halle = byId('halle');
    if (!halle) return false;
    views().forEach(function (v) {
      if (panes[v.id]) return;
      VIEW_TITLE[v.id] = v.title;
      var pane = el('section', {
        class: 'gm-view', id: 'ansicht-' + v.id, 'aria-labelledby': 'ansicht-' + v.id + '-t', hidden: true, dataset: { view: v.id }
      },
        el('header', { class: 'gm-view-head gm-container' },
          el('p', { class: 'gm-eyebrow' }, M.t('hall')),
          el('h2', { id: 'ansicht-' + v.id + '-t', class: 'gm-view-title' }, v.title),
          el('p', { class: 'gm-view-lead' }, v.lead)),
        el('div', { class: 'gm-view-body' }));
      halle.appendChild(pane);
      panes[v.id] = pane;
    });
    return true;
  }
  function viewBody(name) { return panes[name] && panes[name].querySelector('.gm-view-body'); }
  function callView(name, fn) {
    var v = M.views[name];
    if (v && typeof v[fn] === 'function') {
      try { v[fn](); } catch (err) { warn('Ansicht "' + name + '".' + fn + ' schlug fehl', err); }
    }
  }
  function mountView(name) {
    if (mounted[name] || !ensurePanes()) return;
    var v = M.views[name];
    var body = viewBody(name);
    if (!body) return;
    if (!v || typeof v.mount !== 'function') return;
    mounted[name] = true;
    try { v.mount(body); } catch (err) {
      warn('Ansicht "' + name + '" konnte nicht gemountet werden', err);
      body.appendChild(el('p', { class: 'gm-view-missing gm-container', role: 'alert' }, 'Diese Ansicht lässt sich gerade nicht laden. Lade die Seite bitte neu.'));
    }
  }
  M.mountViews = function () {
    ensurePanes();
    views().forEach(function (v) { mountView(v.id); });
  };

  function showPane(name) {
    ensurePanes();
    var next = panes[name];
    if (!next) return;
    mountView(name);
    if (!mounted[name]) {
      var body = viewBody(name);
      if (body && !body.firstChild) {
        body.appendChild(el('div', { class: 'gm-view-missing gm-container' },
          el('span', { html: ico('compass', 40) }),
          el('p', null, 'Diese Ansicht wird gerade eingerichtet. Schau gleich noch einmal vorbei.')));
      }
    }
    if (shownPane === name) { callView(name, 'show'); return; }
    var prevName = shownPane;
    shownPane = name;
    if (prevName && panes[prevName]) {
      var prev = panes[prevName];
      callView(prevName, 'hide');
      if (reduced()) prev.hidden = true;
      else {
        prev.classList.add('is-leaving');
        setTimeout(function () { if (shownPane !== prevName) { prev.hidden = true; } prev.classList.remove('is-leaving'); }, 200);
      }
    }
    next.hidden = false;
    next.classList.remove('is-leaving');
    if (!reduced()) {
      next.classList.add('is-entering');
      requestAnimationFrame(function () { requestAnimationFrame(function () { next.classList.remove('is-entering'); }); });
    }
    callView(name, 'show');
  }
  function hidePane() {
    if (shownPane) {
      callView(shownPane, 'hide');
      if (panes[shownPane]) panes[shownPane].hidden = true;
    }
    shownPane = null;
  }

  /* ------------------------------------------------------------------ *
   * Router
   * ------------------------------------------------------------------ */

  var S = {
    view: null, journey: null, station: null, ctx: null,
    panelOpen: false, journeyOpen: false, pushed: false, routes: 0, started: false,
    trigger: null, internalClose: false, prevKind: 'entry'
  };
  var navListeners = [];
  var routing = false;
  function baseTitle() { return M.pack.title || 'Museum Studio'; }

  function parseHash(h) {
    h = (h === undefined ? location.hash : h) || '';
    if (!h || h === '#' || h === '#/') return { kind: 'entry' };
    if (h.indexOf('#/') !== 0) return { kind: 'ignore' };
    var p;
    try { p = h.slice(2).split('/').map(decodeURIComponent); } catch (e) { return { kind: 'entry' }; }
    switch (p[0]) {
      case 'karte': case 'reisepass': return { kind: 'view', view: p[0] };
      case 'zeitstrahl': return M.hasTimeline() ? { kind: 'view', view: p[0] } : { kind: 'entry' };
      case 'reise': return p[1] ? { kind: 'journey', id: p[1], sid: p[2] || null } : { kind: 'entry' };
      case 'station': return p[1] ? { kind: 'station', id: p[1] } : { kind: 'entry' };
      default: return { kind: 'entry' };
    }
  }

  function isOverlayRoute() { return S.panelOpen || S.journeyOpen; }

  function baseHash() { return S.view ? '#/' + S.view : ''; }

  function go(h, o) {
    o = o || {};
    if (!S.started) { location.hash = h; return; }
    if (location.hash === h || (h === '' && (location.hash === '' || location.hash === '#'))) { route(); return; }
    if (o.replace) {
      try { history.replaceState(history.state, '', h || (location.pathname + location.search)); } catch (e) { location.hash = h; return; }
      route();
    } else {
      location.hash = h;
    }
  }

  function current() { return { view: S.view, journey: S.journey, station: S.station }; }

  function fireNav() {
    var c = current();
    navListeners.slice().forEach(function (fn) { try { fn(c); } catch (e) { warn('nav.onChange', e); } });
  }

  function setTitle(t) { doc.title = t ? t + ' – ' + baseTitle() : (M.pack.pageTitle || baseTitle()); }

  function headerHeight() {
    var h = byId('kopf');
    return h ? h.offsetHeight : 64;
  }
  function scrollToHalle(smooth) {
    var halle = byId('halle');
    if (!halle) return;
    var top = halle.getBoundingClientRect().top + window.pageYOffset - headerHeight() + 1;
    try { window.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduced() ? 'smooth' : 'auto' }); }
    catch (e) { window.scrollTo(0, Math.max(0, top)); }
  }

  function updateTabs() {
    [].forEach.call(doc.querySelectorAll('.gm-tab[data-view]'), function (a) {
      if (a.getAttribute('data-view') === S.view) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function setView(name) {
    var prev = S.view;
    var halle = byId('halle');
    S.view = name;
    updateTabs();
    if (!name) {
      hidePane();
      if (halle) halle.hidden = true;
      return;
    }
    var wasHidden = !halle || halle.hidden;
    if (halle) halle.hidden = false;
    showPane(name);
    setTitle(VIEW_TITLE[name]);
    if (prev !== name || wasHidden) {
      requestAnimationFrame(function () { scrollToHalle(true); });
      announce(VIEW_TITLE[name] + ' geöffnet');
    }
  }

  /* --- Stationspanel (Drawer / Bottom-Sheet) --- */

  var panel = { el: null, sheet: null, scroll: null, ctxEl: null, prevBtn: null, nextBtn: null, foot: null, art: null, swapTimer: null };

  function buildPanel() {
    var p = byId('stationspanel');
    if (!p) { p = el('aside', { id: 'stationspanel', class: 'gm-panel', role: 'dialog', 'aria-modal': 'true', hidden: true }); doc.body.appendChild(p); }
    p.innerHTML = '';
    var backdrop = el('div', { class: 'gm-panel-backdrop', on: { click: function () { closeOverlay(); } } });
    var grab = el('div', { class: 'gm-panel-grab', 'aria-hidden': 'true' }, el('span'));
    var close = el('button', { type: 'button', class: 'gm-iconbtn gm-panel-close', 'aria-label': (M.t('station') + ' schließen'), html: ico('close', 22), on: { click: function () { closeOverlay(); } } });
    panel.ctxEl = el('p', { class: 'gm-panel-ctx' });
    panel.prevBtn = el('button', { type: 'button', class: 'gm-iconbtn gm-panel-step', html: ico('arrow-left', 20) });
    panel.nextBtn = el('button', { type: 'button', class: 'gm-iconbtn gm-panel-step', html: ico('arrow-right', 20) });
    var bar = el('div', { class: 'gm-panel-bar' }, panel.ctxEl, el('div', { class: 'gm-panel-steps' }, panel.prevBtn, panel.nextBtn), close);
    panel.scroll = el('div', { class: 'gm-panel-scroll' });
    panel.sheet = el('div', { class: 'gm-panel-sheet', tabindex: '-1' }, grab, bar, panel.scroll);
    p.appendChild(backdrop);
    p.appendChild(panel.sheet);
    panel.el = p;

    // Bottom-Sheet: am Griff nach unten ziehen schließt
    var startY = null, dy = 0;
    grab.addEventListener('pointerdown', function (e) {
      startY = e.clientY; dy = 0;
      try { grab.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
      panel.sheet.style.transition = 'none';
    });
    grab.addEventListener('pointermove', function (e) {
      if (startY === null) return;
      dy = Math.max(0, e.clientY - startY);
      panel.sheet.style.transform = 'translateY(' + dy + 'px)';
    });
    function endDrag() {
      if (startY === null) return;
      startY = null;
      panel.sheet.style.transition = '';
      panel.sheet.style.transform = '';
      if (dy > 110) closeOverlay();
    }
    grab.addEventListener('pointerup', endDrag);
    grab.addEventListener('pointercancel', endDrag);
  }

  function showPanelStation(id) {
    var st = M.data.stations[id];
    if (!st) {
      M.toast(('Diese ' + M.t('station') + ' ist noch nicht eingerichtet.'));
      bounce();
      return false;
    }
    if (!panel.el) buildPanel();
    var jid = S.ctx && st.journeys.indexOf(S.ctx) >= 0 ? S.ctx : st.journeys[0];
    S.ctx = jid;
    S.station = id;
    var order = orderOf(jid);
    var idx = order.indexOf(id);
    var j = M.data.journeyById[jid];
    var lock = lockPage('inhalt/' + id);   // Spielplan: noch verschlossen -> ruhiges Hinweisbild statt Inhalt

    panel.ctxEl.innerHTML = '';
    if (!lock) {
      panel.ctxEl.appendChild(M.ui.journeyChip(jid, { active: true }));
      if (idx >= 0) panel.ctxEl.appendChild(el('span', { class: 'gm-panel-pos' }, (M.t('station') + ' ') + (idx + 1) + ' von ' + order.length));
    }

    function wire(btn, targetId, dirLabel) {
      var t = targetId && M.data.stations[targetId];
      btn.disabled = !t;
      if (t) {
        btn.setAttribute('aria-label', dirLabel + (' auf dieser ' + M.t('journey') + ': ') + t.title);
        btn.title = dirLabel + ': ' + t.title;
        btn.onclick = function () { M.nav.openStation(targetId, jid); };
      } else {
        btn.setAttribute('aria-label', dirLabel + (' (keine weitere ' + M.t('station') + ')'));
        btn.removeAttribute('title');
        btn.onclick = null;
      }
    }
    wire(panel.prevBtn, !lock && idx > 0 ? order[idx - 1] : null, ('Vorherige ' + M.t('station')));
    wire(panel.nextBtn, !lock && idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null, ('Nächste ' + M.t('station')));

    M.ui.destroyStation(panel.art);
    var art = lock || renderStation(st, { journeyId: jid, headingLevel: 2, onChip: function (c) { M.nav.openStation(id, c); } });
    panel.art = art;
    panel.scroll.innerHTML = '';
    panel.scroll.appendChild(art);
    if (!lock && j && idx >= 0) {
      panel.scroll.appendChild(el('div', { class: 'gm-panel-cont' },
        el('button', {
          type: 'button', class: 'gm-btn gm-btn-primary', style: { '--jc': 'var(--j-' + jid + ')' },
          on: { click: function () { M.nav.openJourney(jid, idx); } }
        }, el('span', null, (M.t('journey') + ' „') + j.name + '“ ab hier fortsetzen'), el('span', { html: ico('arrow-right', 18) }))));
    }
    panel.scroll.scrollTop = 0;
    panel.el.setAttribute('aria-labelledby', art.getAttribute('aria-labelledby'));
    if (!reduced()) {
      art.classList.add('gm-swap-in');
      clearTimeout(panel.swapTimer);
      panel.swapTimer = setTimeout(function () { art.classList.remove('gm-swap-in'); }, 400);
    }
    setTitle(lock ? lock.getAttribute('data-titel') : st.title);
    if (!lock) emit('gm:station-open', { id: id, journeyId: jid });
    announce(lock ? lock.getAttribute('data-ansage') : (M.t('station') + ' geöffnet: ') + st.title);
    return true;
  }

  function routeStation(r) {
    if (S.journeyOpen) leaveJourney(true);
    if (!panel.el) buildPanel();
    var wasOpen = S.panelOpen;
    S.panelOpen = true;
    S.journey = null;
    if (!wasOpen && !S.trigger) S.trigger = doc.activeElement;
    var ok = showPanelStation(r.id);
    if (!ok) { S.panelOpen = false; return; }
    if (!wasOpen) {
      ovOpen(panel.el, { onClose: function () { closeOverlay(); }, focus: panel.sheet, returnFocus: S.trigger });
    } else if (!panel.el.contains(doc.activeElement) || doc.activeElement === doc.body) {
      panel.sheet.focus({ preventScroll: true });
    }
  }

  function leavePanel(keepFocusState) {
    if (!S.panelOpen) return;
    S.panelOpen = false;
    M.ui.destroyStation(panel.art);
    ovClose(panel.el, { returnFocus: S.trigger, restoreFocus: !keepFocusState });
  }

  /* --- Reise-Modus --- */

  var fb = { jid: null, idx: -1, host: null, keyHandler: null };
  var fallbackJourney = {
    open: function (jid, idx) {
      fb.jid = jid;
      fb.host = byId('reise');
      fb.idx = typeof idx === 'number' && idx >= 0 ? idx : -1;
      fb.host.innerHTML = '';
      fb.host.classList.add('gm-rf');
      fb.keyHandler = function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        var t = e.target;
        if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); fallbackJourney.step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); fallbackJourney.step(-1); }
      };
      doc.addEventListener('keydown', fb.keyHandler);
      render();
    },
    close: function () {
      if (fb.keyHandler) doc.removeEventListener('keydown', fb.keyHandler);
      fb.keyHandler = null;
      if (fb.host) { M.ui.destroyStation(fb.host.querySelector('.gm-station')); fb.host.innerHTML = ''; fb.host.classList.remove('gm-rf'); }
      fb.jid = null;
    },
    goTo: function (i) { fb.idx = i; render(); },
    currentIndex: function () { return fb.idx; },
    step: function (d) {
      var o = orderOf(fb.jid);
      var n = fb.idx + d;
      if (n < -1 || n >= o.length) return;
      M.nav.openJourney(fb.jid, n < 0 ? undefined : n);
    }
  };
  function render() {
    var j = M.data.journeyById[fb.jid];
    var o = orderOf(fb.jid);
    var host = fb.host;
    M.ui.destroyStation(host.querySelector('.gm-station'));
    host.innerHTML = '';
    var pct = o.length ? Math.round(((fb.idx + 1) / o.length) * 100) : 0;
    var bar = el('div', { class: 'gm-rf-bar' },
      el('div', { class: 'gm-rf-title', style: { '--jc': 'var(--j-' + fb.jid + ')' } },
        el('span', { class: 'gm-rf-ico', 'aria-hidden': 'true', html: ico(j.icon || 'train', 22) }),
        el('span', null, j.name)),
      el('span', { class: 'gm-rf-pos' }, fb.idx < 0 ? 'Einführung' : (M.t('station') + ' ') + (fb.idx + 1) + ' von ' + o.length),
      el('button', { type: 'button', class: 'gm-iconbtn', 'aria-label': (M.t('journey') + ' beenden'), html: ico('close', 22), on: { click: function () { closeOverlay(); } } }),
      el('div', { class: 'gm-rf-progress', 'aria-hidden': 'true', style: { '--jc': 'var(--j-' + fb.jid + ')' } }, el('span', { style: { width: pct + '%' } })));
    var main = el('div', { class: 'gm-rf-main' });
    if (fb.idx < 0) {
      main.appendChild(el('div', { class: 'gm-rf-intro', style: { '--jc': 'var(--j-' + fb.jid + ')' } },
        el('h2', { id: 'gm-rf-h', tabindex: '-1' }, j.name),
        el('p', { class: 'gm-st-lead' }, j.tagline || ''),
        el('p', { class: 'gm-rf-introtext' }, j.intro || ''),
        o.length ? el('button', { type: 'button', class: 'gm-btn gm-btn-primary', on: { click: function () { fallbackJourney.step(1); } } }, (M.t('journey') + ' beginnen'), el('span', { html: ico('arrow-right', 18) })) : el('p', null, ('Für diese ' + M.t('journey') + ' sind noch keine ' + M.t('stations') + ' eingerichtet.'))));
    } else {
      var sid = o[fb.idx];
      var st = M.data.stations[sid];
      var step = fb.jid === 'rundreise' ? M.rundreiseStep(sid) : null;
      if (step) main.appendChild(el('p', { class: 'gm-rf-hint' }, step.hint));
      if (st) main.appendChild(renderStation(st, { journeyId: fb.jid }));
      if (fb.idx === o.length - 1 && j.outro) main.appendChild(el('p', { class: 'gm-rf-outro' }, j.outro));
      S.station = sid;
      emit('gm:station-open', { id: sid, journeyId: fb.jid });
    }
    var nav = fb.idx < 0 ? null : el('div', { class: 'gm-rf-nav' },
      el('button', { type: 'button', class: 'gm-btn gm-btn-ghost', disabled: fb.idx < 0, on: { click: function () { fallbackJourney.step(-1); } } }, el('span', { html: ico('arrow-left', 18) }), 'Zurück'),
      el('button', { type: 'button', class: 'gm-btn gm-btn-primary', disabled: fb.idx >= o.length - 1, on: { click: function () { fallbackJourney.step(1); } } }, 'Weiter', el('span', { html: ico('arrow-right', 18) })));
    host.appendChild(bar);
    var scroller = el('div', { class: 'gm-rf-scroll' }, main, nav);
    host.appendChild(scroller);
    scroller.scrollTop = 0;
    var h = host.querySelector('.gm-st-title, #gm-rf-h');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  function journeyApi() {
    return (M.journey && typeof M.journey.open === 'function') ? M.journey : fallbackJourney;
  }

  // Spielplan: eine noch verschlossene Reise zeigt statt des Reise-Modus das Hinweisbild im Stationspanel
  function routeLockedJourney(r, lock) {
    if (S.journeyOpen) leaveJourney(true);
    if (!panel.el) buildPanel();
    var wasOpen = S.panelOpen;
    S.panelOpen = true;
    S.journey = null;
    S.station = null;
    if (!wasOpen && !S.trigger) S.trigger = doc.activeElement;
    M.ui.destroyStation(panel.art);
    panel.ctxEl.innerHTML = '';
    [panel.prevBtn, panel.nextBtn].forEach(function (b) { b.disabled = true; b.onclick = null; b.removeAttribute('title'); b.setAttribute('aria-label', 'Keine weitere ' + M.t('station')); });
    panel.art = lock;
    panel.scroll.innerHTML = '';
    panel.scroll.appendChild(lock);
    panel.scroll.scrollTop = 0;
    panel.el.setAttribute('aria-labelledby', lock.getAttribute('aria-labelledby'));
    setTitle(lock.getAttribute('data-titel'));
    announce(lock.getAttribute('data-ansage'));
    if (!wasOpen) ovOpen(panel.el, { onClose: function () { closeOverlay(); }, focus: panel.sheet, returnFocus: S.trigger });
    else if (!panel.el.contains(doc.activeElement) || doc.activeElement === doc.body) panel.sheet.focus({ preventScroll: true });
  }

  function routeJourney(r) {
    var j = M.data.journeyById[r.id];
    if (!j) {
      M.toast(('Diese ' + M.t('journey') + ' gibt es nicht.'));
      bounce();
      return;
    }
    var lockJ = j.virtual ? null : lockPage('episode/' + r.id);
    if (lockJ) { routeLockedJourney(r, lockJ); return; }
    var order = orderOf(r.id);
    var idx = r.sid ? order.indexOf(r.sid) : -1;
    if (r.sid && idx < 0) warn((M.t('station') + ' "') + r.sid + ('" liegt nicht auf der ' + M.t('journey') + ' "') + r.id + '".');
    var reise = byId('reise');
    if (!reise) return;
    var same = S.journeyOpen && S.journey === r.id;
    if (S.panelOpen) leavePanel(true);
    S.journey = r.id;
    S.station = idx >= 0 ? order[idx] : null;
    var api = journeyApi();
    if (same) {
      var curIdx = typeof api.currentIndex === 'function' ? api.currentIndex() : idx;
      if ((idx >= 0 || api === fallbackJourney) && curIdx !== idx && typeof api.goTo === 'function') api.goTo(idx);
      setTitle((M.t('journey') + ': ') + j.name);
      return;
    }
    if (S.journeyOpen) { // Umstieg auf eine andere Reise bei geöffnetem Reise-Modus
      S.internalClose = true;
      try { if (typeof api.close === 'function') api.close(); } catch (e) { warn('journey.close', e); }
      S.internalClose = false;
    }
    var wasOpen = S.journeyOpen;
    S.journeyOpen = true;
    reise.setAttribute('aria-label', (M.t('journey') + ': ') + j.name);
    if (!wasOpen) {
      if (!S.trigger) S.trigger = doc.activeElement;
      reise.hidden = false;
      ovOpen(reise, { onClose: function () { closeOverlay(); }, focus: reise, returnFocus: S.trigger });
    }
    try { api.open(r.id, idx >= 0 ? idx : undefined); } catch (err) {
      warn('journey.open schlug fehl', err);
      M.toast(('Die ' + M.t('journey') + ' lässt sich gerade nicht öffnen.'));
    }
    setTitle((M.t('journey') + ': ') + j.name);
    emit('gm:journey-open', { id: r.id, index: idx });
    announce((M.t('journey') + ' gestartet: ') + j.name);
    // Fokus in den Reise-Modus bringen, falls das Modul das nicht tat
    if (!reise.contains(doc.activeElement) || doc.activeElement === reise) {
      var f = reise.querySelector('[autofocus], h1, h2, .gm-st-title');
      if (f) { if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
    }
  }

  function leaveJourney(keepFocusState) {
    if (!S.journeyOpen) return;
    var reise = byId('reise');
    var api = journeyApi();
    S.journeyOpen = false;
    S.internalClose = true;
    try { if (typeof api.close === 'function') api.close(); } catch (e) { warn('journey.close', e); }
    S.internalClose = false;
    if (api !== fallbackJourney && fb.jid) fallbackJourney.close();
    if (reise) ovClose(reise, { returnFocus: S.trigger, restoreFocus: !keepFocusState });
    S.journey = null;
  }

  /* --- Hauptroute --- */

  function route() {
    if (routing) return;
    routing = true;
    try {
      var r = parseHash();
      if (r.kind === 'ignore') return;
      S.routes++;
      var wasOverlay = isOverlayRoute();
      switch (r.kind) {
        case 'entry':
          leavePanel(); leaveJourney();
          setView(null);
          S.station = null; S.journey = null; S.ctx = null; S.trigger = null;
          setTitle('');
          break;
        case 'view':
          leavePanel(); leaveJourney();
          S.station = null; S.journey = null; S.ctx = null;
          S.trigger = null;
          setView(r.view);
          break;
        case 'station':
          if (!wasOverlay) S.pushed = S.routes > 1 && S.prevKind !== 'ignore';
          routeStation(r);
          break;
        case 'journey':
          if (!wasOverlay) S.pushed = S.routes > 1;
          routeJourney(r);
          break;
      }
      S.prevKind = r.kind;
      if (!isOverlayRoute()) {
        S.trigger = null; S.pushed = false;
        setTitle(S.view ? VIEW_TITLE[S.view] : '');
      }
    } finally {
      routing = false;
    }
    fireNav();
  }

  // ungültiges Ziel: Adresse auf die Basis zurücksetzen und neu routen (nach dem laufenden Durchgang)
  function bounce() {
    var base = baseHash();
    try { history.replaceState(history.state, '', base || (location.pathname + location.search)); } catch (e) { /* egal */ }
    setTimeout(route, 0);
  }

  function closeOverlay() {
    if (S.internalClose) return;
    if (!isOverlayRoute()) return;
    if (S.pushed) { history.back(); return; }
    var base = baseHash();
    try { history.replaceState(history.state, '', base || (location.pathname + location.search)); } catch (e) { location.hash = base; return; }
    route();
  }

  var nav = {
    start: function () {
      if (S.started) return;
      S.started = true;
      try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* egal */ }
      window.addEventListener('hashchange', route);
      route();
    },
    openStation: function (id, journeyId) {
      S.ctx = journeyId || null;
      go('#/station/' + encodeURIComponent(id), { replace: isOverlayRoute() });
    },
    openJourney: function (id, startIndex) {
      var order = orderOf(id);
      var h = '#/reise/' + encodeURIComponent(id);
      if (typeof startIndex === 'number' && order[startIndex]) h += '/' + encodeURIComponent(order[startIndex]);
      go(h, { replace: isOverlayRoute() });
    },
    openView: function (name) {
      if (!VIEW_TITLE[name]) return;
      go('#/' + name, { replace: isOverlayRoute() });
    },
    closeOverlay: function () { closeOverlay(); },
    current: current,
    onChange: function (fn) {
      navListeners.push(fn);
      return function () { var i = navListeners.indexOf(fn); if (i >= 0) navListeners.splice(i, 1); };
    }
  };
  M.nav = nav;

  // Station im Stationspanel neu anordnen, wenn sich Daten ändern (z. B. Dev-Fixture), nichts weiter nötig.

})();

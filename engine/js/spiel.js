/* ==========================================================================
   Museum Studio – js/spiel.js
   Die Anbindung des Spielplans (js/spielplan.js, Format spielplan/0) an das Museum. Wird nur mit packs/<paket>/spielplan.json
   eingebunden (Build); ohne MUSEUM.data.spielplan ist MUSEUM.spiel.aktiv false und das Museum bleibt, wie es war.
   Fachlich neutral: kennt nur Einheiten-IDs der Form <art>/<id>, keine Reisen, Stationen oder Texte eines Pakets.

   API  window.MUSEUM.spiel
     aktiv               true, sobald ein Spielplan geladen ist
     stand()             der Spielstand (Spielplan.spielstand, mit Freiem Zugang und Obergrenze Stufe 2), je Sekunde und Änderung gemerkt
     einheit(id)         sein Eintrag darin ({ stufe, zugang, bedingung, verwittert, faellig, … }) oder null
     zugang(id)          { offen, sichtbar, gesperrt, verborgen, bedingung }; beim Freien Zugang ist alles offen und sichtbar
     melde(verb, id, o)  ein Ereignis (nur Kennungen, nie Eingaben); gibt das Ereignis oder null zurück
     bei(name, fn)       'freigeschaltet' ({ einheit, art, name, regel, am, enthuellung }), 'stufe', 'melde', 'aenderung', 'frei';
                         gibt eine Funktion zum Abmelden zurück
     naechsteAufgabe()   genau eine Aufgabe oder null
     frei, setFrei(b)    Freier Zugang (gm:sp:frei): nur das Sperren und die Wartezeiten entfallen, gezählt wird weiter
     aktualisiere()      rechnet mit der Uhr neu (Pausen, Takt); läuft auch von selbst
     anzeige(id)         { gesperrt, verborgen, offen, titel, bedingung } für Listen (Titel maskiert, wenn verborgen)
     id                  { gebiet, episode, inhalt, quest, erlebnis, werkzeug, skill }(x) -> Einheiten-ID
   Für die Ansichten des Museums (core.js, journey.js, app.js, search.js): station(art, st, o), sperrseite(id, o), eingang(anker),
     geschichte(id, 'auftakt'|'abschluss', bekannte), etappe(id).
   Testhooks: window.__SP_HEUTE (Zeitpunkt statt der Uhr, Text, Zahl oder Funktion), window.__SP_VERWEIL (Faktor für die Lesezeiten, Standard 1).
   Gespeichert wird nur lokal, immer in try/catch: gm:sp:<plan>:ereignisse|wer (Brücke), gm:sp:frei, gm:sp:<plan>:enthuellt|migration.
   Die Seite sendet nichts. Entscheidungen: docs/spielplan-auslegung.md (Abschnitt „Museum-Anbindung A“).
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  var doc = document;
  var PLAN = M.data && M.data.spielplan;
  var SP = window.Spielplan;

  var STUB = {
    aktiv: false, frei: false,
    stand: function () { return null; }, einheit: function () { return null; }, melde: function () { return null; },
    bei: function () { return function () {}; }, naechsteAufgabe: function () { return null; }, setFrei: function () {}, aktualisiere: function () { return null; },
    zugang: function () { return { offen: true, sichtbar: true, gesperrt: false, verborgen: false, bedingung: '' }; },
    anzeige: function () { return { gesperrt: false, verborgen: false, offen: true, titel: '', bedingung: '' }; },
    id: {}
  };
  if (!PLAN || !SP || typeof SP.verbinde !== 'function' || typeof SP.spielstand !== 'function') { M.spiel = STUB; return; }

  /* ------------------------------------------------------------------ *
   * Wortschatz (M.t; pack.vocab überschreibt jeden Schlüssel)
   * ------------------------------------------------------------------ */

  if (M.addVocab) M.addVocab({
    spielKickerStart: 'Dein Einstieg',
    spielKickerWeiter: 'Als Nächstes',
    spielKickerWieder: 'Ein Wiedersehen',
    spielLos: 'Los geht’s',
    spielNichtsDran: 'Gerade ist nichts Bestimmtes dran. Stöbere, wohin du magst, oder komm später wieder.',
    spielWartet: 'Etwas wartet auf den richtigen Moment: {was} geht in {dauer} auf.',
    spielFrei: 'Freier Zugang',
    spielFreiText: 'Alles ist offen, und es gibt keine Wartezeiten. Dein Fortschritt zählt trotzdem weiter.',
    spielFreiKurz: 'Alles offen, keine Wartezeiten.',
    spielFreiAn: 'Freier Zugang eingeschaltet',
    spielFreiAus: 'Freier Zugang ausgeschaltet',
    spielGesperrt: 'Noch verschlossen',
    spielVerborgen: 'Noch verborgen',
    spielVerborgenText: 'Hier wartet etwas, das du noch nicht kennst. Es öffnet sich, wenn du weitergehst.',
    spielWasFehlt: 'Was fehlt noch?',
    spielNaechster: 'Dein nächster Schritt',
    spielWegDorthin: 'Der Weg dorthin',
    spielNichtsWeiter: 'Gerade gibt es keinen Vorschlag. Wirf einen Blick auf den {networkMap}.',
    spielZurKarte: '{networkMap} öffnen',
    spielNeuArt: 'Neu geöffnet: {was}',
    spielAnsehen: 'Ansehen',
    spielWeiter: 'Weiter',
    spielNochEins: 'Dazu geht noch etwas auf.',
    spielNochMehr: 'Dazu gehen noch {n} Dinge auf.',
    spielKannKicker: 'Du kannst jetzt mehr',
    spielAuftaktArt: 'Auftakt: {was}',
    spielAbschlussArt: '{was} geschafft',
    spielGeschafft: 'Geschafft',
    spielWillkommen: 'Schön, dass du wieder da bist. Das hier hast du eine Weile nicht angeschaut.',
    spielWiedersehenKarte: 'Wartet auf ein Wiedersehen',
    spielAufgefrischt: 'Aufgefrischt. Schön, dass du zurückgekommen bist.',
    spielUebt: 'Das übt: {kann}',
    spielTeilen: 'Link kopieren',
    spielTeilenOk: 'Link kopiert.',
    spielTeilenManuell: 'Der Link steht im Feld. Markiere ihn und kopiere ihn von Hand.',
    spielEinsetzen: 'Dein Werkzeug „{name}“ passt hier.',
    spielEingesetzt: 'Eingesetzt',
    spielDanachGeht: 'Danach geht {ding} „{name}“ auf.',
    spielNochSchritt: 'Noch ein Schritt, dann ist {ding} „{name}“ geschafft.',
    spielNochSchritte: 'Noch {n} Schritte, dann ist {ding} „{name}“ geschafft.',
    spielSchonGeschafft: '{Ding} „{name}“ ist geschafft.',
    spielQuestGeschafft: '{was} geschafft.',
    spielErlebnisGeschafft: '{was} ausprobiert.',
    spielAuftakt: 'Auftakt',
    spielAbschluss: 'Abschluss',
    spielEtappeEntdecken: 'Entdecken',
    spielEtappeOnboarding: 'Dein Einstieg',
    spielEtappeScaffolding: 'Vertiefen',
    spielEtappeEndgame: 'Finale'
  });

  /* ------------------------------------------------------------------ *
   * Kleine Helfer
   * ------------------------------------------------------------------ */

  function el() { return M.el.apply(M, arguments); }
  function T(key, vars) { return M.t(key, vars); }
  function ico(key, size) { return (M.icons && M.icons.svg) ? M.icons.svg(key, { size: size || 20 }) : ''; }
  function xico(key, size) { return (M.ui && M.ui.icon) ? M.ui.icon(key, size) : ico(key, size); }
  function reduced() { return M.reducedMotion ? M.reducedMotion() : false; }
  function byId(id) { return doc.getElementById(id); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function istText(x) { return typeof x === 'string' && x.trim() !== ''; }
  function liste(x) { return x === undefined || x === null ? [] : (Array.isArray(x) ? x : [x]); }
  function gross(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function warn() { if (window.console && console.warn) console.warn.apply(console, ['[Museum Studio, Spielplan]'].concat([].slice.call(arguments))); }
  function sicher(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { warn(e); } }; }
  var uidN = 0;

  /* ------------------------------------------------------------------ *
   * Speicher (nur lokal, Präfix gm:sp:, jeder Zugriff in try/catch, Rückfall Arbeitsspeicher)
   * ------------------------------------------------------------------ */

  var PRE = 'gm:sp:';
  var mem = {};
  function lies(k) {
    try { var v = window.localStorage.getItem(PRE + k); if (v !== null && v !== undefined) return v; } catch (e) { /* kein Speicher */ }
    return has(mem, k) ? mem[k] : null;
  }
  function schreibe(k, v) {
    if (v === null) delete mem[k]; else mem[k] = v;
    try { if (v === null) window.localStorage.removeItem(PRE + k); else window.localStorage.setItem(PRE + k, v); } catch (e) { /* kein Speicher */ }
  }

  /* ------------------------------------------------------------------ *
   * Kern und Brücke
   * ------------------------------------------------------------------ */

  var K = SP.kompiliere(PLAN);
  var APP = 'museum/' + ((M.pack && M.pack.id) || K.id || 'paket');
  var BIS = 2;                       // das Museum vergibt höchstens Stufe 2 (Auslegung M2): Beleg und Transfer kann es nicht prüfen
  var KEY = K.id || 'plan';

  /** Der Zeitpunkt: window.__SP_HEUTE (Testhook; Text, Zahl oder Funktion) überschreibt die Uhr. */
  function jetzt() {
    var h = window.__SP_HEUTE;
    try { if (typeof h === 'function') h = h(); } catch (e) { h = undefined; }
    if (h !== undefined && h !== null && h !== '') { var ms = SP.zeitMs(h); if (!isNaN(ms)) return ms; }
    return Date.now();
  }
  function faktor() { var f = window.__SP_VERWEIL; return typeof f === 'number' && f >= 0 ? f : 1; }

  var sp = SP.verbinde({ plan: K, app: APP, speicher: 'lokal', jetzt: jetzt });

  // Vorbelegung: pack.json "spielFrei": true schaltet den Freien Zugang für alle ein, die den Schalter noch nie bedient haben (ihre Wahl bleibt)
  var frei = lies('frei') === null ? !!(M.pack && M.pack.spielFrei === true) : lies('frei') === '1';
  var version = 0, cache = null, evCache = { v: -1, l: [] };
  var enthuellt = {};
  try { var gel = JSON.parse(lies(KEY + ':enthuellt') || '[]'); if (Array.isArray(gel)) gel.forEach(function (x) { if (typeof x === 'string') enthuellt[x] = true; }); } catch (e) { enthuellt = {}; }
  function speichereEnthuellt() { schreibe(KEY + ':enthuellt', JSON.stringify(Object.keys(enthuellt))); }

  function ereignisse() {
    if (evCache.v !== version) evCache = { v: version, l: sp.ereignisse() };
    return evCache.l;
  }

  /** Der Spielstand: Brücke und Kern, aber mit Freiem Zugang (Pausen entfallen) und der Obergrenze des Museums. */
  function stand() {
    var ms = jetzt(), sek = Math.floor(ms / 1000);
    if (cache && cache.v === version && cache.sek === sek && cache.frei === frei) return cache.s;
    var s = SP.spielstand(K, ereignisse(), ms, { ohneWartezeit: frei, bis: BIS });
    cache = { v: version, sek: sek, frei: frei, s: s };
    return s;
  }
  function einheit(id) { var e = stand().einheiten[id]; return e || null; }

  /* --- Hörer */
  var hoerer = {};
  function bei(name, fn) {
    if (typeof fn !== 'function') return function () {};
    (hoerer[name] = hoerer[name] || []).push(fn);
    return function () { var a = hoerer[name] || [], i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  }
  function senden(name, daten) {
    (hoerer[name] || []).slice().forEach(function (fn) { try { fn(daten); } catch (e) { warn('Hörer ' + name, e); } });
  }

  /* --- Zugang */
  function zugang(id) {
    var e = einheit(id);
    if (!e) return { offen: true, sichtbar: true, gesperrt: false, verborgen: false, bedingung: '' };
    var zu = e.zugang === 'gesperrt';
    var verborgen = zu && e.sichtbar === 'verborgen';
    return { offen: !zu || frei, sichtbar: !verborgen || frei, gesperrt: zu && !frei, verborgen: verborgen && !frei, bedingung: zu && !frei ? (e.bedingung || '') : '' };
  }
  function anzeige(id) {
    var z = zugang(id), u = K.by[id];
    return {
      gesperrt: !z.offen, verborgen: z.verborgen, offen: z.offen, bedingung: z.bedingung,
      titel: z.verborgen ? T('spielVerborgen') : (u ? u.name : '')
    };
  }
  function naechsteAufgabe() { return stand().aufgabe || null; }

  /* --- Änderungen erkennen: Stufen und neue Freischaltungen */
  var vorher = null;
  function nachAenderung(o) {
    o = o || {};
    version++; cache = null;
    var s = stand();
    if (vorher) {
      Object.keys(s.einheiten).forEach(function (id) {
        var a = vorher.einheiten[id], b = s.einheiten[id];
        if (a && b.stufe > a.stufe) senden('stufe', { einheit: id, art: b.art, name: K.by[id] ? K.by[id].name : id, von: a.stufe, nach: b.stufe });
      });
    }
    vorher = s;
    var neu = s.freigeschaltet.filter(function (f) { return !enthuellt[f.einheit]; });
    if (neu.length) {
      neu.forEach(function (f) { enthuellt[f.einheit] = true; });
      speichereEnthuellt();
      if (!o.still) neu.forEach(function (f) { senden('freigeschaltet', f); });
    }
    senden('aenderung', s);
  }
  function aktualisiere() { nachAenderung(); return stand(); }

  /* --- Ereignisse melden (nur Kennungen) */
  var letztes = {};
  function melde(verb, objekt, o) {
    if (typeof objekt !== 'string' || !K.by[objekt]) return null;
    var e = sp.melde(verb, objekt, o);
    if (!e) return null;
    var key = verb + '|' + objekt;
    if (letztes[key] === e) return e;                       // dieselbe Meldung binnen einer Minute: die Brücke hat nichts Neues gespeichert
    letztes[key] = e;
    senden('melde', e);
    nachAenderung();
    if (verb === 'begonnen') gebietBetreten(objekt);
    return e;
  }

  function setFrei(b) {
    b = !!b;
    if (b === frei) return;
    frei = b;
    schreibe('frei', b ? '1' : '0');
    nachAenderung();
    senden('frei', frei);
  }

  /* ------------------------------------------------------------------ *
   * Einmalige Übernahme der bisherigen Besuche und Stempel (herkunft: migration)
   * ------------------------------------------------------------------ */

  function migriere() {
    if (lies(KEY + ':migration') === '1') return 0;
    var besucht = [], stempel = [], daten = {};
    try { besucht = M.store.get('visited', []); stempel = M.store.stamps(); daten = M.store.get('stampdates', {}) || {}; } catch (e) { /* nichts zu übernehmen */ }
    var iso = SP.isoZeit(jetzt()), l = [], vollendet = {};
    // Ein Stempel hieß bisher: alle Stationen der Reise waren besucht. Diese Stationen gelten daher als geschafft, die übrigen besuchten als erkundet.
    liste(stempel).forEach(function (jid) {
      if (typeof jid !== 'string' || !K.by['episode/' + jid]) return;
      liste(M.data.orders && M.data.orders[jid]).forEach(function (sid) { vollendet[sid] = true; });
    });
    liste(besucht).forEach(function (sid) {
      if (typeof sid === 'string' && K.by['inhalt/' + sid]) l.push({ wer: sp.wer, verb: vollendet[sid] ? 'geschafft' : 'erkundet', objekt: 'inhalt/' + sid, zeit: iso, app: APP, herkunft: 'migration' });
    });
    liste(stempel).forEach(function (jid) {
      if (typeof jid !== 'string' || !K.by['episode/' + jid]) return;
      var z = daten && typeof daten[jid] === 'string' && !isNaN(SP.zeitMs(daten[jid])) ? daten[jid] : iso;
      l.push({ wer: sp.wer, verb: 'geschafft', objekt: 'episode/' + jid, zeit: z, app: APP, herkunft: 'migration' });
    });
    var n = l.length ? sp.importiere(l) : 0;
    schreibe(KEY + ':migration', '1');
    return n;
  }

  /* ------------------------------------------------------------------ *
   * Hinwege: Adressen öffnen
   * ------------------------------------------------------------------ */

  function geheZu(adresse) {
    if (!istText(adresse) || !/^#\//.test(adresse)) return false;      // nur Adressen innerhalb des Museums (#/…), nie etwas anderes aus den Daten
    var m = /^#\/(station|reise)\/([^/]+)(?:\/([^/]+))?$/.exec(adresse);
    try {
      if (m && M.nav) {
        var id = decodeURIComponent(m[2]);
        if (m[1] === 'station') { M.nav.openStation(id); return true; }
        var order = (M.data.orders && M.data.orders[id]) || [], idx = m[3] ? order.indexOf(decodeURIComponent(m[3])) : -1;
        M.nav.openJourney(id, idx >= 0 ? idx : undefined);
        return true;
      }
      var v = /^#\/(karte|zeitstrahl|reisepass)$/.exec(adresse);
      if (v && M.nav && M.nav.openView) { M.nav.openView(v[1]); return true; }
    } catch (e) { /* Rückfall unten */ }
    location.hash = adresse;
    return true;
  }
  function adresseVon(id, a) {
    var u = K.by[id];
    if (u && u.adresse) return u.adresse;
    var t = String(id).split('/'), art = t[0], rest = t.slice(1).join('/');
    if (art === 'episode') return '#/reise/' + rest;
    if (art === 'inhalt') return '#/station/' + rest;
    if (art === 'quest') return '#/station/' + rest.replace(/-mythos$/, '');
    if (art === 'erlebnis') {
      var sts = (M.data && M.data.stations) || {}, ids = Object.keys(sts);
      for (var i = 0; i < ids.length; i++) if (sts[ids[i]].exhibit === rest) return '#/station/' + ids[i];
    }
    return a || '';
  }
  /** Die Seite neu auswerten (nach Freier Zugang an der Sperrseite): dieselbe Adresse noch einmal. */
  function neuLaden() {
    try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { var h = location.hash; location.hash = '#/'; location.hash = h; }
  }

  /* ------------------------------------------------------------------ *
   * Freier Zugang: der Schalter (an mehreren Orten, immer im Gleichklang)
   * ------------------------------------------------------------------ */

  function freiSchalter(o) {
    o = o || {};
    var id = 'gm-spiel-frei-' + (++uidN);
    var inp = el('input', { type: 'checkbox', role: 'switch', id: id, class: 'gm-spiel-frei-in', 'aria-describedby': id + '-t' });
    inp.checked = frei;
    var wrap = el('div', { class: 'gm-spiel-frei' },
      el('label', { class: 'gm-spiel-frei-l', for: id }, inp,
        el('span', { class: 'gm-spiel-frei-sw', 'aria-hidden': 'true' }, el('i')),
        el('span', { class: 'gm-spiel-frei-n' }, T('spielFrei'))),
      el('p', { class: 'gm-spiel-frei-t', id: id + '-t' }, o.kurz ? T('spielFreiKurz') : T('spielFreiText')));
    inp.addEventListener('change', function () {
      setFrei(inp.checked);
      M.announce(inp.checked ? T('spielFreiAn') : T('spielFreiAus'));
      if (typeof o.nach === 'function') o.nach(inp.checked);
    });
    var ab = bei('frei', function (v) { if (!wrap.isConnected) { ab(); return; } inp.checked = v; });
    return wrap;
  }
  /** Der Schalter ist nur sinnvoll, wenn der Spielplan überhaupt etwas sperrt. */
  function hatSperren() { return K.list.some(function (u) { return u.gated; }); }

  /* ------------------------------------------------------------------ *
   * Der Moment: eine Enthüllung dort, wo man gerade handelt (nicht blockierend)
   * ------------------------------------------------------------------ */

  var momente = [], karte = null, karteNode = null;

  function momentHost() {
    try {
      if (M.search && M.search.isOpen && M.search.isOpen() && byId('suche-overlay')) return byId('suche-overlay');
      var r = byId('reise');
      if (r && !r.hidden && !r.classList.contains('is-closing')) return r;
      var p = byId('stationspanel');
      if (p && !p.hidden && !p.classList.contains('is-closing')) return p;
    } catch (e) { /* Rückfall */ }
    return doc.body;
  }
  function artWort(art) { var b = K.begriffe && K.begriffe[art]; return b ? b.sg : gross(art); }
  function symbolVon(m) {
    var u = K.by[m.einheit] || {};
    if (m.art === 'episode') { var jid = m.einheit.split('/')[1], j = M.data.journeyById && M.data.journeyById[jid]; return (j && j.icon) || 'train'; }
    if (m.art === 'inhalt') { var st = M.data.stations[m.einheit.split('/')[1]]; return (st && st.icon) || 'lightbulb'; }
    return { werkzeug: 'toolbox', skill: 'star', gebiet: 'map', quest: 'question', erlebnis: 'flask' }[m.art] || u.icon || 'star';
  }

  function momentEinreihen(m) {
    // dasselbe nicht doppelt (z. B. Freischaltung und gleich darauf dieselbe Stufe)
    if (karte && karte.einheit === m.einheit && karte.typ === m.typ) return;
    for (var i = 0; i < momente.length; i++) if (momente[i].einheit === m.einheit && momente[i].typ === m.typ) return;
    momente.push(m);
    if (karte) { malenKarte(); return; }
    setTimeout(zeigeNaechsten, m.typ === 'auftakt' ? 1400 : 450);   // ein Auftakt erst, wenn die Einführung der Reise schon gelesen werden kann
  }

  function zeigeNaechsten() {
    if (karte || !momente.length) return;
    karte = momente.shift();
    baueKarte();
  }

  function baueKarte() {
    var m = karte, id = 'gm-spiel-m-' + (++uidN);
    var jid = m.art === 'episode' ? m.einheit.split('/')[1] : null;
    var kicker = m.typ === 'skill' ? T('spielKannKicker')
      : (m.typ === 'auftakt' ? T('spielAuftaktArt', { was: artWort(m.art) }) : (m.typ === 'abschluss' ? T('spielAbschlussArt', { was: artWort(m.art) }) : T('spielNeuArt', { was: artWort(m.art) })));
    var node = el('section', {
      class: 'gm-spiel-moment' + (reduced() ? '' : ' is-neu'), role: 'region', 'aria-labelledby': id + '-t', 'data-art': m.art, 'data-einheit': m.einheit,
      style: jid ? { '--jc': 'var(--j-' + jid + ')' } : null
    });
    node.appendChild(el('div', { class: 'gm-spiel-moment-ico', 'aria-hidden': 'true', html: ico(symbolVon(m), 30) }));
    var txt = el('div', { class: 'gm-spiel-moment-text' },
      el('p', { class: 'gm-spiel-k', id: id + '-k' }, kicker),
      el('p', { class: 'gm-spiel-moment-t', id: id + '-t' }, m.name),
      m.text ? el('p', { class: 'gm-spiel-moment-b' }, m.text) : null,
      el('p', { class: 'gm-spiel-moment-mehr', hidden: true }));
    node.appendChild(txt);
    var acts = el('div', { class: 'gm-spiel-moment-act' });
    var ansehen = m.adresse ? el('button', { type: 'button', class: 'gm-btn gm-btn-warm', on: { click: function () { schliesseKarte(); geheZu(m.adresse); } } }, T('spielAnsehen')) : null;
    if (ansehen) acts.appendChild(ansehen);
    acts.appendChild(el('button', { type: 'button', class: 'gm-btn ' + (ansehen ? 'gm-btn-quiet' : 'gm-btn-warm'), on: { click: schliesseKarte } }, T('spielWeiter')));
    node.appendChild(acts);
    node.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); schliesseKarte(); } });
    karteNode = node;
    momentHost().appendChild(node);
    malenKarte();
    M.announce(kicker + ': ' + m.name + (m.text ? '. ' + m.text : ''));
    // Fokus nur dann, wenn gerade nichts Bestimmtes den Fokus hat: eine Enthüllung nimmt dir nie die Stelle weg
    try { if (!doc.activeElement || doc.activeElement === doc.body) { node.setAttribute('tabindex', '-1'); node.focus({ preventScroll: true }); } } catch (e) { /* egal */ }
  }
  function malenKarte() {
    if (!karteNode) return;
    var mehr = karteNode.querySelector('.gm-spiel-moment-mehr'), n = momente.length;
    mehr.hidden = !n;
    mehr.textContent = n === 1 ? T('spielNochEins') : (n > 1 ? T('spielNochMehr', { n: n }) : '');
  }
  function schliesseKarte() {
    var node = karteNode, hatteFokus = node && node.contains(doc.activeElement);
    karte = null; karteNode = null;
    if (node) {
      var weg = function () { if (node.parentNode) node.parentNode.removeChild(node); };
      if (reduced()) weg(); else { node.classList.add('is-weg'); setTimeout(weg, 260); }
    }
    if (hatteFokus) { try { var h = byId('main'); if (h && !M.ui.overlay.isOpen()) h.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
    setTimeout(zeigeNaechsten, reduced() ? 60 : 380);
  }
  function karteUmziehen() {
    if (!karteNode) return;
    var h = momentHost();
    if (karteNode.parentNode !== h) h.appendChild(karteNode);
  }

  bei('freigeschaltet', function (f) {
    var u = K.by[f.einheit] || {};
    momentEinreihen({ typ: 'frei', einheit: f.einheit, art: f.art, name: f.name, text: f.enthuellung, adresse: adresseVon(f.einheit, u.adresse) });
  });
  // Fähigkeiten: das Wachsen der Stufe ist der Moment („Ich kann …“); Reisen und Gebiete erzählen ihren Abschluss, wenn sie geschafft sind
  bei('stufe', function (d) {
    var u = K.by[d.einheit] || {}, abschluss = u.roh && istText(u.roh.abschluss) ? u.roh.abschluss.trim() : '';
    if (d.art === 'skill' && d.nach >= BIS) {                     // der Satz „Ich kann …“ gilt, wenn das Museum die Fähigkeit als erreicht führt (Stufe 2)
      var key = d.einheit + '@' + d.nach;
      if (enthuellt[key]) return;
      enthuellt[key] = true; speichereEnthuellt();
      momentEinreihen({ typ: 'skill', einheit: d.einheit, art: 'skill', name: d.name, text: u.kann || '', adresse: u.adresse || '' });
    } else if ((d.art === 'episode' || d.art === 'gebiet') && d.nach >= 2 && abschluss) {
      var k2 = d.einheit + '@abschluss';
      if (enthuellt[k2]) return;
      enthuellt[k2] = true; speichereEnthuellt();
      if (imAbschlussDerReise(d.einheit)) return;                 // der Reise-Modus zeigt ihn gerade selbst (Stempel)
      momentEinreihen({ typ: 'abschluss', einheit: d.einheit, art: d.art, name: d.name, text: abschluss, adresse: '' });
    }
  });
  function imAbschlussDerReise(id) {
    var t = String(id).split('/'), jid = t[1];
    try { return t[0] === 'episode' && M.nav.current().journey === jid && M.journey.currentIndex() >= ((M.data.orders && M.data.orders[jid]) || []).length; } catch (e) { return false; }
  }
  // Auftakt eines Gebiets: wenn du zum ersten Mal eine seiner Reisen betrittst
  function gebietBetreten(uid) {
    (K.eltern[uid] || []).forEach(function (g) {
      var u = K.by[g], t = u && u.art === 'gebiet' && u.roh && u.roh.auftakt;
      if (!istText(t) || enthuellt[g + '@auftakt']) return;
      enthuellt[g + '@auftakt'] = true; speichereEnthuellt();
      momentEinreihen({ typ: 'auftakt', einheit: g, art: 'gebiet', name: u.name, text: t.trim(), adresse: '' });
    });
  }

  /* ------------------------------------------------------------------ *
   * Hinweisbild für noch Verschlossenes (Adresse, Reise-Modus)
   * ------------------------------------------------------------------ */

  function sperrseite(id, o) {
    o = o || {};
    var z = zugang(id);
    if (z.offen) return null;
    var u = K.by[id] || {}, a = anzeige(id), uid = 'gm-spiel-s-' + (++uidN);
    var art = u.art || 'inhalt';
    var sec = el('section', {
      class: 'gm-spiel-sperre', 'aria-labelledby': uid + '-t', 'data-art': art, 'data-einheit': id,
      'data-titel': z.verborgen ? T('spielVerborgen') : a.titel, 'data-ansage': (z.verborgen ? T('spielVerborgen') : T('spielGesperrt') + ': ' + a.titel) + (z.bedingung ? '. ' + z.bedingung : '')
    });
    sec.appendChild(el('div', { class: 'gm-spiel-sperre-ico', 'aria-hidden': 'true', html: ico('lock', 40) }));
    sec.appendChild(el('p', { class: 'gm-spiel-k' }, z.verborgen ? T('spielVerborgen') : T('spielGesperrt')));
    sec.appendChild(el('h2', { class: 'gm-spiel-sperre-t', id: uid + '-t', tabindex: '-1' }, z.verborgen ? artWort(art) : a.titel));
    sec.appendChild(el('p', { class: 'gm-spiel-sperre-b' }, z.verborgen ? T('spielVerborgenText') : (z.bedingung || '')));

    var weg = el('div', { class: 'gm-spiel-sperre-weg' });
    var auf = naechsteAufgabe();
    if (auf) {
      weg.appendChild(el('p', { class: 'gm-spiel-k' }, auf.oeffnet === id ? T('spielWegDorthin') : T('spielNaechster')));
      weg.appendChild(el('p', { class: 'gm-spiel-sperre-aufgabe' }, textDerAufgabe(auf)));
      if (auf.bringt && !z.verborgen) weg.appendChild(el('p', { class: 'gm-spiel-b' }, bringtText(auf)));
      var ziel = auf.adresse || adresseVon(auf.einheit);
      if (ziel) weg.appendChild(el('button', { type: 'button', class: 'gm-btn gm-btn-warm', on: { click: function () { geheZu(ziel); } } }, T('spielLos'), el('span', { 'aria-hidden': 'true', html: ico('arrow-right', 18) })));
    } else {
      weg.appendChild(el('p', { class: 'gm-spiel-sperre-aufgabe' }, T('spielNichtsWeiter')));
      weg.appendChild(el('button', { type: 'button', class: 'gm-btn gm-btn-ghost', on: { click: function () { if (M.nav) M.nav.openView('karte'); } } }, T('spielZurKarte')));
    }
    sec.appendChild(weg);
    if (hatSperren()) sec.appendChild(freiSchalter({ nach: function () { neuLaden(); } }));
    return sec;
  }
  function textDerAufgabe(a) {
    var t = String(a.text || '');
    return a.art === 'wiederkehr' ? t.replace(/^Wiedersehen:\s*/, '') : t;
  }
  /** Was die Aufgabe bringt. Der Kern zählt Stufen („Noch 2 Schritte“ für eine Station, die gar nicht angefasst ist); im Museum hebt ein Besuch
   *  eine Einheit von 0 auf 2, also ist eine Einheit ein Schritt (Auslegung M11). */
  function bringtText(a) {
    var z = a.oeffnet && K.by[a.oeffnet];
    if (a.art === 'regel' && z && a.noch_einheiten === 1 && a.noch > 1) return T('spielDanachGeht', { ding: dingWort(z.art), name: z.name });
    return String(a.bringt || '');
  }

  /* ------------------------------------------------------------------ *
   * Geschichte: Auftakt und Abschluss einer Episode
   * ------------------------------------------------------------------ */

  function flach(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim(); }
  function geschichte(id, was, bekannte) {
    var u = K.by[id], txt = u && u.roh && istText(u.roh[was]) ? u.roh[was].trim() : '';
    if (!txt) return null;
    var alles = flach(liste(bekannte).filter(istText).join(' '));
    if (alles && alles.indexOf(flach(txt)) >= 0) return null;     // steht schon da (ganz oder als Auszug): nicht doppelt erzählen
    var lab = was === 'auftakt' ? T('spielAuftakt') : T('spielAbschluss');
    return el('section', { class: 'gm-spiel-story', 'aria-label': lab, 'data-was': was },
      el('p', { class: 'gm-spiel-k' }, lab),
      el('p', { class: 'gm-spiel-story-t' }, txt));
  }
  var ETAPPEN = { entdecken: 'spielEtappeEntdecken', onboarding: 'spielEtappeOnboarding', scaffolding: 'spielEtappeScaffolding', endgame: 'spielEtappeEndgame' };
  function etappe(id) {
    var u = K.by[id], k = u && u.etappe;
    return typeof k === 'string' && has(ETAPPEN, k) ? T(ETAPPEN[k]) : '';
  }

  /* ------------------------------------------------------------------ *
   * Eingang: genau eine nächste Aufgabe, dezent und einladend
   * ------------------------------------------------------------------ */

  function dauerText(ms) {
    var min = Math.max(1, Math.ceil(ms / 60000));
    if (min >= 2 * 24 * 60) return Math.ceil(min / (24 * 60)) + ' Tagen';
    var h = Math.floor(min / 60), m = min % 60;
    if (h === 0) return m + ' Min.';
    return h + ' Std.' + (m ? ' ' + m + ' Min.' : '');
  }

  function eingang(anker) {
    if (!anker || !anker.parentNode) return null;
    var box = el('section', { class: 'gm-spiel-weiter', 'aria-labelledby': 'gm-spiel-w-k' });
    anker.parentNode.insertBefore(box, anker.nextSibling);
    var dyn = el('div', { class: 'gm-spiel-weiter-dyn' });          // display: contents; nur dieser Teil wird erneuert, und nur, wenn sich sein Inhalt ändert
    box.appendChild(dyn);
    var wartetEl = el('p', { class: 'gm-spiel-wartet', hidden: true });   // Text ändert sich jede Minute: wird an Ort und Stelle ersetzt, nie das Element
    box.appendChild(wartetEl);
    if (hatSperren()) box.appendChild(freiSchalter({ kurz: true }));   // bleibt stehen, damit der Fokus am Schalter nie verloren geht
    var zuletzt = null;

    function malen() {
      var s = stand(), a = s.aufgabe;
      var start = ereignisse().length === 0;
      var kick = a && a.art === 'wiederkehr' ? T('spielKickerWieder') : (start ? T('spielKickerStart') : T('spielKickerWeiter'));
      var ziel = a ? (a.adresse || adresseVon(a.einheit)) : '';
      if (!/^#\//.test(ziel)) ziel = '';
      var wartet = '';
      if (s.wartet && s.wartet.length && !frei) {
        var w = s.wartet[0], ms = SP.zeitMs(w.bis) - jetzt();
        if (ms > 0 && K.by[w.einheit]) wartet = T('spielWartet', { was: '„' + K.by[w.einheit].name + '“', dauer: dauerText(ms) });
      }
      var satz = a ? textDerAufgabe(a) : T('spielNichtsDran'), bringt = a && a.bringt ? bringtText(a) : '';
      wartetEl.hidden = !wartet;
      if (wartetEl.textContent !== wartet) wartetEl.textContent = wartet;
      var sig = [kick, satz, bringt, ziel].join('\u0001');
      if (sig === zuletzt) return;
      zuletzt = sig;
      dyn.textContent = '';
      var text = el('div', { class: 'gm-spiel-weiter-text' }, el('p', { class: 'gm-spiel-k', id: 'gm-spiel-w-k' }, kick), el('p', { class: 'gm-spiel-t' }, satz), bringt ? el('p', { class: 'gm-spiel-b' }, bringt) : null);
      dyn.appendChild(text);
      if (ziel) dyn.appendChild(el('a', { class: 'gm-btn gm-btn-glass gm-spiel-los', href: ziel }, T('spielLos'), el('span', { 'aria-hidden': 'true', html: ico('arrow-right', 18) })));
    }
    bei('aenderung', function () { if (box.isConnected) malen(); });
    malen();
    return box;
  }

  /* ------------------------------------------------------------------ *
   * Stationen: Lesefortschritt, Rückmeldung am Ort, Einsatz, Teilen
   * ------------------------------------------------------------------ */

  var verweil = {};          // Station -> Millisekunden sichtbar geöffnet (diese Sitzung)
  var gemeldet = {};         // Einheit -> Zeitpunkt der letzten Meldung "geschafft" (gegen Dauerfeuer)
  var tracker = [];
  var tick = 0;
  var WEITER_MS = 4000, MIN_MS = 5000, MAX_MS = 45000, EXPONAT_MS = 6000;

  function woerter(s) { s = String(s || '').trim(); return s ? s.split(/\s+/).length : 0; }
  function lesezeit(st) {
    var w = woerter(st.teaser);
    (st.text || []).forEach(function (p) { w += woerter(p); });
    (st.facts || []).forEach(function (p) { w += woerter(p); });
    if (st.quote && st.quote.text) w += woerter(st.quote.text);
    if (st.myth) w += woerter(st.myth.glaube) + woerter(st.myth.wahrheit);
    return Math.max(MIN_MS, Math.min(MAX_MS, w / 230 * 60000 * 0.3)) * faktor();   // ein knappes Drittel der Lesezeit, zwischen 5 und 45 Sekunden
  }

  function geschafftMelden(uid, o) {
    if (!K.by[uid]) return null;
    var t = jetzt();
    if (has(gemeldet, uid) && t - gemeldet[uid] < 10 * 60000) return null;
    gemeldet[uid] = t;
    return melde('geschafft', uid, o);
  }

  function brauchtVon(n) {
    if (n <= 0) return 0;
    if (K.anteil.exakt) return Math.floor((2 * n + 2) / 3);
    return Math.min(n, Math.max(1, Math.ceil(n * K.anteil.zahl - 1e-9)));
  }
  /** Wie viele Schritte (Einheiten auf Stufe 2) einer Sammel-Einheit noch fehlen: alle kritischen, von den wesentlichen zwei Drittel. */
  function restBisStufe2(parent, s) {
    var kr = 0, krDa = 0, ws = 0, wsDa = 0;
    (K.members[parent] || []).forEach(function (m) {
      var g = K.by[m].gewicht, e = s.einheiten[m], da = !!(e && e.stufe >= 2);
      if (g === 'kritisch') { kr++; if (da) krDa++; } else if (g === 'wesentlich') { ws++; if (da) wsDa++; }
    });
    var br = brauchtVon(ws);
    return { rest: (kr - krDa) + Math.max(0, br - Math.min(wsDa, br)), gewogen: kr + ws };
  }
  function dingWort(art) { var b = K.begriffe && K.begriffe[art]; return b ? b.art + ' ' + b.sg : art; }
  /** Der Satz, was die Station der Reise bringt (Rückmeldung am Ort); '' ohne Sammel-Einheit. */
  function fortschrittsSatz(uid, journeyId) {
    var s = stand(), eltern = (K.eltern[uid] || []).filter(function (p) { return K.by[p].art === 'episode' && (K.members[p] || []).length; });
    if (!eltern.length) return '';
    var wahl = journeyId && eltern.indexOf('episode/' + journeyId) >= 0 ? 'episode/' + journeyId : null;
    if (!wahl) wahl = eltern.filter(function (p) { return s.einheiten[p] && s.einheiten[p].zugang === 'offen'; })[0] || eltern[0];
    var r = restBisStufe2(wahl, s);
    if (!r.gewogen) return '';
    var vars = { n: r.rest, ding: dingWort('episode'), Ding: gross(dingWort('episode')), name: K.by[wahl].name };
    if (r.rest <= 0) return T('spielSchonGeschafft', vars);
    return r.rest === 1 ? T('spielNochSchritt', vars) : T('spielNochSchritte', vars);
  }

  function ortIds(st) {
    var l = ['inhalt/' + st.id];
    if (K.by['quest/' + st.id + '-mythos']) l.push('quest/' + st.id + '-mythos');
    if (st.exhibit && K.by['erlebnis/' + st.exhibit]) l.push('erlebnis/' + st.exhibit);
    return l;
  }
  /** Werkzeuge, deren einsatz einen Ort dieser Station nennt: [{ id, ort }] */
  function werkzeugeFuer(orte) {
    var out = [];
    K.list.forEach(function (u) {
      if (u.art !== 'werkzeug') return;
      var ein = liste(u.roh && u.roh.einsatz).filter(istText).map(function (x) { return x.indexOf('/') >= 0 ? x : 'inhalt/' + x; });
      for (var i = 0; i < orte.length; i++) if (ein.indexOf(orte[i]) >= 0) { out.push({ id: u.id, ort: orte[i] }); return; }
    });
    return out;
  }

  function kopiere(text, ok, nein) {
    function ausweg() {
      try {
        var ta = el('textarea', { readonly: true, 'aria-hidden': 'true', tabindex: '-1', style: 'position:fixed;left:-9999px;top:0;opacity:0' });
        ta.value = text; doc.body.appendChild(ta); ta.select();
        var r = doc.execCommand && doc.execCommand('copy');
        doc.body.removeChild(ta);
        if (r) ok(); else nein();
      } catch (e) { nein(); }
    }
    try { if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) { navigator.clipboard.writeText(text).then(ok, ausweg); return; } } catch (e) { /* Ausweg */ }
    ausweg();
  }

  function station(art, st, o) {
    o = o || {};
    var uid = 'inhalt/' + st.id;
    if (!K.by[uid]) return;
    var orte = ortIds(st), tr = { art: art, sid: st.id, uid: uid, ms: 0, ende: false, need: lesezeit(st), fertig: false, t: Date.now(), zuletzt: Date.now(), verbunden: false, ab: null };
    var e0 = einheit(uid);
    tr.wieder = !!(e0 && (e0.faellig || e0.verwittert));

    // Marke am Ende des Lesestoffs (vor dem Exponat), Fuß mit Rückmeldung, Einsatz und Teilen (nach dem Exponat)
    var ex = art.querySelector('.gm-st-exhibit'), tn = art.querySelector('.gm-st-transfer'), mehr = art.querySelector('.gm-st-more');
    var marke = el('div', { class: 'gm-spiel-ende', 'aria-hidden': 'true' });
    var vor = ex || tn || mehr;
    if (vor) art.insertBefore(marke, vor); else art.appendChild(marke);
    tr.marke = marke;
    var rueck = el('p', { class: 'gm-spiel-rueck', role: 'status', hidden: true });
    var uebtEl = el('p', { class: 'gm-spiel-uebt', hidden: true });
    var einsatz = el('div', { class: 'gm-spiel-einsatz-liste' });
    var teilen = el('div', { class: 'gm-spiel-teilen' });
    var linkFeld = null;
    var fuss = el('div', { class: 'gm-spiel-fuss' }, rueck, uebtEl, einsatz, teilen);
    var nach = tn || mehr;
    if (nach) art.insertBefore(fuss, nach); else art.appendChild(fuss);

    // Wiedersehen: ein freundlicher Satz statt Strafe
    if (tr.wieder) {
      var kopf = art.querySelector('.gm-st-head');
      var w = el('p', { class: 'gm-spiel-wieder', role: 'note' }, T('spielWillkommen'));
      if (kopf && kopf.nextSibling) art.insertBefore(w, kopf.nextSibling); else art.appendChild(w);
    }

    var url = function () { return String(location.href).split('#')[0] + '#/station/' + encodeURIComponent(st.id); };
    var teilKnopf = el('button', { type: 'button', class: 'gm-btn gm-btn-quiet gm-spiel-teilen-knopf' }, el('span', { 'aria-hidden': 'true', html: ico('link', 18) }), el('span', null, T('spielTeilen')));
    teilKnopf.addEventListener('click', function () {
      var link = url();
      kopiere(link, function () { melde('geteilt', uid); M.toast(T('spielTeilenOk')); M.announce(T('spielTeilenOk')); },
        function () {
          if (!linkFeld) { linkFeld = el('input', { type: 'text', readonly: true, class: 'gm-spiel-link', 'aria-label': T('spielTeilen') }); teilen.appendChild(linkFeld); }
          linkFeld.value = link; linkFeld.focus(); linkFeld.select();
          M.toast(T('spielTeilenManuell'));
        });
    });
    teilen.appendChild(teilKnopf);

    function malen() {
      if (!art.isConnected && tr.verbunden) return;
      var e = einheit(uid), fertig = !!(e && e.stufe >= 2);
      var badge = art.querySelector('.gm-st-seen > span');
      if (badge) badge.textContent = fertig ? T('spielGeschafft') : 'Besucht';
      var satz = fertig ? fortschrittsSatz(uid, o.journeyId) : '';
      if (fertig && tr.wieder && tr.fertig) satz = T('spielAufgefrischt') + (satz ? ' ' + satz : '');
      rueck.hidden = !satz;
      if (rueck.textContent !== satz) rueck.textContent = satz;
      // welche Fähigkeit die Station übt (der Satz „Ich kann …“ des Plans), sobald sie geschafft ist
      var kann = fertig ? K.by[uid].uebt.map(function (sk) { return K.by[sk] && K.by[sk].kann; }).filter(Boolean)[0] : '';
      var uebt = kann ? T('spielUebt', { kann: kann }) : '';
      uebtEl.hidden = !uebt;
      if (uebtEl.textContent !== uebt) uebtEl.textContent = uebt;
      // Einsatz: ein Werkzeug, das hier passt, sobald der Ort geschafft ist (die Zeilen werden nur neu gebaut, wenn sich etwas ändert: der Fokus bleibt am Knopf)
      var passend = werkzeugeFuer(orte).filter(function (wz) { var z = zugang(wz.id), eo = einheit(wz.ort); return z.offen && eo && eo.stufe >= 2; });
      var sig = passend.map(function (wz) { return wz.id + '@' + wz.ort; }).join('|');
      if (sig === einsatz._sig) return;
      einsatz._sig = sig;
      einsatz.textContent = '';
      passend.forEach(function (wz) {
        var knopf = el('button', { type: 'button', class: 'gm-btn gm-btn-ghost' }, el('span', { 'aria-hidden': 'true', html: xico('check', 16) }), el('span', null, T('spielEingesetzt')));
        knopf.addEventListener('click', function () {
          melde('geschafft', wz.ort, { mit: [wz.id] });          // der Einsatz zählt am Ort und, über mit, am Werkzeug
          M.announce(T('spielEingesetzt') + ': ' + K.by[wz.id].name);
        });
        einsatz.appendChild(el('div', { class: 'gm-spiel-einsatz' }, el('span', { class: 'gm-spiel-einsatz-ico', 'aria-hidden': 'true', html: ico('toolbox', 22) }),
          el('p', null, T('spielEinsetzen', { name: K.by[wz.id].name })), knopf));
      });
    }
    tr.malen = malen;
    tr.ab = bei('aenderung', function () { malen(); });
    malen();
    tracker.push(tr);
    start();
    return art;
  }

  function sichtbar(n) {
    if (doc.hidden || !n.isConnected) return false;
    var r = n.getClientRects();
    if (!r.length) return false;
    try { if (n.closest('[inert]') || n.closest('[hidden]')) return false; } catch (e) { /* ältere Engines */ }
    return true;
  }
  function takt() {
    var jetztMs = Date.now();
    tracker = tracker.filter(function (tr) {
      if (!tr.art.isConnected) {
        if (tr.verbunden || jetztMs - tr.t > 4000) { if (tr.ab) tr.ab(); return false; }
        return true;
      }
      tr.verbunden = true;
      var dt = Math.min(1500, jetztMs - (tr.zuletzt || jetztMs));
      tr.zuletzt = jetztMs;
      if (!sichtbar(tr.art)) return true;
      tr.ms += dt;
      verweil[tr.sid] = tr.ms;
      if (!tr.ende && tr.marke.isConnected && tr.marke.getClientRects().length) {
        // Das Ende des Lesestoffs ist erreicht, sobald die Marke ins Bild kam oder schon darüber hinausgescrollt wurde (ein hohes Exponat danach schiebt sie nach oben)
        if (tr.marke.getBoundingClientRect().top < (window.innerHeight || 800)) tr.ende = true;
      }
      if (!tr.fertig && tr.ende && tr.ms >= tr.need) {
        tr.fertig = true;
        var neu = geschafftMelden(tr.uid);
        if (neu) M.announce(T('spielGeschafft') + ': ' + (M.data.stations[tr.sid] ? M.data.stations[tr.sid].title : tr.sid));
        tr.malen();
      }
      return true;
    });
    exponate = exponate.filter(function (x) {
      if (x.weg) return false;
      if (!x.fertig && x.benutzt && jetztMs - x.t >= EXPONAT_MS * faktor()) { x.fertig = true; exponatFertig(x); }
      return true;
    });
    if (!tracker.length && !exponate.length) { clearInterval(tick); tick = 0; }
  }
  function start() { if (!tick) tick = setInterval(sicher(takt), 500); }

  /* ------------------------------------------------------------------ *
   * Ereignisse aus der Oberfläche
   * ------------------------------------------------------------------ */

  var exponate = [];

  function rueckNach(node, text) {
    if (!node || !node.parentNode) return;
    var p = node.nextElementSibling;
    if (!p || !p.classList.contains('gm-spiel-rueck')) { p = el('p', { class: 'gm-spiel-rueck', role: 'status' }); node.parentNode.insertBefore(p, node.nextSibling); }
    p.textContent = text;
  }
  function exponatFertig(x) {
    var uid = 'erlebnis/' + x.id;
    if (!geschafftMelden(uid)) return;
    rueckNach(x.mount.closest('.gm-st-exhibit'), T('spielErlebnisGeschafft', { was: gross(artWort('erlebnis')) }));
  }

  doc.addEventListener('gm:visited', sicher(function (e) {
    var d = e.detail || {};
    if (d.reset) { zuruecksetzen(); return; }
    if (d.id) melde('erkundet', 'inhalt/' + d.id);
  }));
  doc.addEventListener('gm:stamp', sicher(function (e) {
    var d = e.detail || {};
    if (d.journey) melde('geschafft', 'episode/' + d.journey);                 // Reisepass-Stempel = Episode geschafft
  }));
  doc.addEventListener('gm:journey-open', sicher(function (e) {
    var d = e.detail || {};
    if (d.id) melde('begonnen', 'episode/' + d.id);
  }));
  doc.addEventListener('gm:journey-step', sicher(function (e) {
    var d = e.detail || {};
    if (d.first || typeof d.from !== 'number' || d.from < 0 || d.index !== d.from + 1 || d.from >= d.total) return;
    var order = (M.data.orders && M.data.orders[d.journeyId]) || [], sid = order[d.from];
    // „Weiter“ nach vorn ist ein bewusster Schritt; war die Station wenigstens kurz offen, zählt sie als geschafft
    if (sid && (verweil[sid] || 0) >= WEITER_MS * faktor()) geschafftMelden('inhalt/' + sid);
  }));
  doc.addEventListener('gm:myth', sicher(function (e) {
    var d = e.detail || {};
    var uid = 'quest/' + (d.id || '') + '-mythos';
    if (!d.id || !K.by[uid]) return;
    geschafftMelden(uid);
    var sec = d.card && d.card.closest ? d.card.closest('.gm-st-myth') : null;
    if (sec) rueckNach(sec, T('spielQuestGeschafft', { was: gross(artWort('quest')) }));
  }));
  doc.addEventListener('gm:exhibit-start', sicher(function (e) {
    var d = e.detail || {};
    if (!d.id || !d.mount) return;
    var uid = 'erlebnis/' + d.id;
    if (!K.by[uid]) return;
    melde('begonnen', uid);
    var x = { id: d.id, mount: d.mount, t: Date.now(), benutzt: false, fertig: false, weg: false };
    var an = function () { x.benutzt = true; };
    ['pointerdown', 'keydown', 'input', 'change', 'touchstart'].forEach(function (n) { d.mount.addEventListener(n, an, true); });
    exponate.push(x);
    start();
  }));
  doc.addEventListener('gm:exhibit-end', sicher(function (e) {
    var d = e.detail || {};
    exponate.forEach(function (x) {
      if (x.id !== d.id || x.weg) return;
      x.weg = true;
      if (!x.fertig && x.benutzt && Date.now() - x.t >= EXPONAT_MS * faktor()) { x.fertig = true; exponatFertig(x); }
    });
  }));

  function zuruecksetzen() {
    sp.zuruecksetzen();
    enthuellt = {}; speichereEnthuellt(); schreibe(KEY + ':enthuellt', null);
    gemeldet = {}; verweil = {}; letztes = {}; vorher = null;
    schreibe(KEY + ':migration', '1');
    nachAenderung({ still: true });
  }

  /* ------------------------------------------------------------------ *
   * Zeit vergeht: Pausen, Takt, anderer Tab
   * ------------------------------------------------------------------ */

  setInterval(sicher(function () { if (!doc.hidden) aktualisiere(); }), 30000);
  doc.addEventListener('visibilitychange', sicher(function () { if (!doc.hidden) aktualisiere(); }));
  window.addEventListener('storage', sicher(function (e) {
    if (!e || !e.key) return;
    if (e.key === PRE + KEY + ':ereignisse') { nachAenderung({ still: false }); }
    else if (e.key === PRE + 'frei') { var f = e.newValue === '1'; if (f !== frei) { frei = f; nachAenderung(); senden('frei', frei); } }
  }));
  if (M.nav && M.nav.onChange) M.nav.onChange(sicher(karteUmziehen));
  else doc.addEventListener('gm:station-open', sicher(karteUmziehen));
  ['gm:journey-open', 'gm:station-open'].forEach(function (n) { doc.addEventListener(n, sicher(function () { setTimeout(karteUmziehen, 0); })); });

  /* ------------------------------------------------------------------ *
   * Öffentliche Schnittstelle
   * ------------------------------------------------------------------ */

  var API = {
    aktiv: true,
    stand: stand, einheit: einheit, zugang: zugang, anzeige: anzeige, melde: melde, bei: bei, naechsteAufgabe: naechsteAufgabe,
    setFrei: setFrei, aktualisiere: aktualisiere, zuruecksetzen: zuruecksetzen,
    station: station, sperrseite: sperrseite, eingang: eingang, geschichte: geschichte, etappe: etappe, freiSchalter: freiSchalter,
    id: {
      gebiet: function (x) { return 'gebiet/' + x; }, episode: function (x) { return 'episode/' + x; }, inhalt: function (x) { return 'inhalt/' + x; },
      quest: function (x) { return 'quest/' + x + '-mythos'; }, erlebnis: function (x) { return 'erlebnis/' + x; },
      werkzeug: function (x) { return 'werkzeug/' + x; }, skill: function (x) { return 'skill/' + x; }
    },
    plan: PLAN, wer: function () { return sp.wer; }
  };
  Object.defineProperty(API, 'frei', { get: function () { return frei; }, enumerable: true });
  M.spiel = API;

  // Start: bisherige Besuche und Stempel übernehmen (einmal), Enthüllungen, die schon gelten, beim ersten Start still als gesehen merken
  var ersterStart = lies(KEY + ':migration') !== '1';
  try { migriere(); } catch (e) { warn('Übernahme der Besuche', e); }
  nachAenderung({ still: ersterStart });
})();

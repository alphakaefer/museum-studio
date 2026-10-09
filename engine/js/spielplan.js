/* ==========================================================================
   Spielplan – js/spielplan.js   (Format spielplan/0, Referenz-Umsetzung des Kerns)

   Ein klassisches Skript ohne Abhängigkeiten. Läuft im Browser (window.Spielplan) und in Node
   (module.exports; in ES-Modul-Paketen per vm laden, siehe tools/check-spielplan.mjs).
   Keine Fachbezüge: weiß nichts vom Museum. Das Museum hängt sich über engine/js/spiel.js an.

   API (alles auf window.Spielplan):
     spielstand(plan, ereignisse, jetzt[, opts])  reine Funktion -> Spielstand (Abschnitt 8 des Standards)
         plan        das Spielplan-Objekt (aus JSON oder YAML)
         ereignisse  Liste von Ereignissen in der Kurzform (6.2); Ungültiges wird übersprungen und in "ignoriert" genannt
         jetzt       Zeitpunkt: ISO-8601-Text (mit oder ohne Offset; ohne Offset gilt UTC), Date oder Millisekunden.
                     Ein reines Datum "2026-10-09" gilt als 00:00 UTC. Ohne jetzt gilt die Uhr (einzige Unreinheit).
                     Wer Stunden braucht (wartezeit), übergibt einen vollen Zeitpunkt.
         opts        { wer: nur Ereignisse dieser Kennung, ohneWartezeit: true = Pausen überspringen (Freier Zugang),
                       bis: höchste Stufe, die das Angebot vergibt (überschreibt plan.stufen.bis) }
     verbinde({ plan, app, speicher, praefix, jetzt, lager })  die Brücke (Abschnitt 7), siehe unten
     pruefe(plan)                                 -> { fehler: [], warnungen: [], info: {} }
     nachXapi(ereignis, plan, opts)               reine Übersetzung nach xAPI (6.3), kein Netzwerk
     abgeleiteteEreignisse(stand, opts)           die Freischaltungen als Ereignisse "freigeschaltet" (6.1)
     kompiliere(plan)                             vorbereiteter Plan (schneller bei vielen Aufrufen)
     wurzelStufe(plan, stand)                     Stufe der Wurzel-Einheit (für SCORM completed)
     zeitMs(x), isoZeit(ms), STUFEN, ARTEN, VERBEN, FORMAT

   Brücke:  var sp = Spielplan.verbinde({ plan: plan, app: 'museum/mein-paket' });
     sp.melde(verb, objekt, { mit, ergebnis, beleg, fall, zeit })  -> gespeichertes Ereignis oder null (sp.letzterFehler sagt warum)
     sp.stand([jetzt])        der Spielstand      sp.einheit(id)  sein Eintrag darin      sp.ereignisse()  Kopie der gespeicherten Ereignisse
     sp.bei(name, fn)         name: 'freigeschaltet' ({einheit, art, name, regel, am, enthuellung}), 'stufe' ({einheit, von, nach}),
                              'melde' (jedes angenommene Ereignis); gibt eine Funktion zum Abmelden zurück
     sp.aktualisiere()        rechnet mit der Uhr neu und meldet, was seit dem letzten Mal aufging (Zeit-Freischaltungen, andere Tabs)
     sp.zuruecksetzen()       löscht Ereignisse und Merkzettel dieses Spielplans, neue Kennung
     sp.importiere(liste)     fügt fremde Ereignisse ein (z. B. aus einem Adapter), ohne Doppelte
     sp.horche(fenster)       nimmt postMessage({type:'sp:melde', verb, objekt, …}) aus Übungen im iframe an
   Gespeichert wird nur: localStorage <praefix><plan.id>:ereignisse | wer | gesehen (Präfix Standard "gm:sp:"). Jeder Zugriff in
   try/catch; ohne Speicher läuft alles im Arbeitsspeicher weiter. Die Seite sendet nichts: xAPI und SCORM stecken in
   spielplan-adapter.js, das die Seite nicht lädt.

   Rechenweg (Kern, Entscheidungen in docs/spielplan-auslegung.md):
     Jede Stufe jeder Einheit bekommt einen ZEITPUNKT, an dem sie erreicht wurde (aus den Ereignissen; Sammel-Einheiten aus
     ihren Mitgliedern), jede Freischaltung ebenfalls (aus den Regeln). Der Spielstand zu einem jetzt vergleicht nur
     Zeitpunkte mit jetzt. Daraus folgen 5.2 (nur wahr werdende Bedingungen, Reihenfolge egal), die Zeit-Bausteine mit
     Stunden-Genauigkeit und das "seit" jeder Freischaltung ohne Zusatzspeicher.
   ========================================================================== */
(function () {
  'use strict';

  var FORMAT = 'spielplan/0';
  var INF = Infinity;
  var MINUTE = 60000, STUNDE = 3600000, TAG = 86400000;

  var ARTEN = ['gebiet', 'inhalt', 'werkzeug', 'quest', 'erlebnis', 'skill', 'episode'];
  var SORTEN = ['modell', 'methode', 'heuristik', 'technik', 'app'];
  var ETAPPEN = ['entdecken', 'onboarding', 'scaffolding', 'endgame'];
  var GEWICHTE = ['kritisch', 'wesentlich', 'optional'];
  var SICHTBARKEIT = ['angedeutet', 'verborgen'];
  var BELEG_ARTEN = ['messung', 'bestaetigung', 'eigen'];
  var STUFEN = ['Nebel', 'Erkundet', 'Geübt', 'Angewendet', 'Gemeistert'];
  var BEREICHE = [null, null, 'Grundverständnis', 'Anwendung', 'Transfer'];
  /** Wurzel der Adressen für die eigenen Verben, Erweiterungen und Arten in xAPI. Neutral (eine URN, nicht erreichbar, nicht nötig);
   *  wer sein Vokabular unter einer eigenen Adresse veröffentlicht, setzt plan.vokabular oder opts.vokabular (siehe nachXapi). */
  var SP_IRI = 'urn:spielplan:';
  var VERBEN = {
    begonnen: 'http://adlnet.gov/expapi/verbs/attempted',
    erkundet: 'http://adlnet.gov/expapi/verbs/experienced',
    geschafft: 'http://adlnet.gov/expapi/verbs/completed',
    bestanden: 'http://adlnet.gov/expapi/verbs/passed',
    angewendet: SP_IRI + 'verben/angewendet',
    geteilt: 'http://adlnet.gov/expapi/verbs/shared',
    freigeschaltet: SP_IRI + 'verben/freigeschaltet'
  };
  /** Verben, die an Werkzeuge weitergereicht werden, wenn eine Einheit sie "mit" dem Werkzeug meldet (4.2, erweitert, siehe Auslegung). */
  var DURCHGEREICHT = { geschafft: 1, bestanden: 1, angewendet: 1 };
  var BEGRIFFE = {
    gebiet: { art: 'das', sg: 'Gebiet', pl: 'Gebiete' },
    inhalt: { art: 'der', sg: 'Inhalt', pl: 'Inhalte' },
    werkzeug: { art: 'das', sg: 'Werkzeug', pl: 'Werkzeuge' },
    quest: { art: 'die', sg: 'Quest', pl: 'Quests' },
    erlebnis: { art: 'das', sg: 'Erlebnis', pl: 'Erlebnisse' },
    skill: { art: 'die', sg: 'Fähigkeit', pl: 'Fähigkeiten' },
    episode: { art: 'die', sg: 'Episode', pl: 'Episoden' }
  };
  var ID_MUSTER = /^[a-z0-9][a-z0-9\-\/]*$/;

  /* ------------------------------------------------------------------ *
   * Kleine Helfer
   * ------------------------------------------------------------------ */

  function istObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function istText(x) { return typeof x === 'string' && x.trim() !== ''; }
  function istZahl(x) { return typeof x === 'number' && isFinite(x); }
  function liste(x) { return x === undefined || x === null ? [] : (Array.isArray(x) ? x.slice() : [x]); }
  function textListe(x) { return liste(x).filter(istText); }
  function einzigartig(a) { var s = Object.create(null), o = []; for (var i = 0; i < a.length; i++) if (!s[a[i]]) { s[a[i]] = true; o.push(a[i]); } return o; }
  function vergleiche(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function nachZahl(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function neu() { return Object.create(null); }
  function hat(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function kleinste(arr, k) { var c = arr.slice().sort(nachZahl); return c[k - 1]; }
  function maximum(arr) { var m = -INF; for (var i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i]; return m; }
  function minimum(arr) { var m = INF; for (var i = 0; i < arr.length; i++) if (arr[i] < m) m = arr[i]; return m; }
  function zitat(name) { return '„' + name + '“'; }
  function glob(muster) {
    var re = '^' + String(muster).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
    return new RegExp(re);
  }
  function hatStern(s) { return String(s).indexOf('*') >= 0; }

  /* ------------------------------------------------------------------ *
   * Zeit: alles UTC, intern Millisekunden
   * ------------------------------------------------------------------ */

  var RE_ZEIT = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

  /** ISO-8601-Text, Date oder Millisekunden -> Millisekunden (NaN, wenn nicht lesbar). Ohne Offset gilt UTC. */
  function zeitMs(x) {
    if (x === null || x === undefined || x === '') return NaN;
    if (typeof x === 'number') return isFinite(x) ? x : NaN;
    if (Object.prototype.toString.call(x) === '[object Date]') return x.getTime();
    if (typeof x !== 'string') return NaN;
    var m = RE_ZEIT.exec(x.trim());
    if (!m) return NaN;
    var y = +m[1], mo = +m[2], d = +m[3], h = +(m[4] || 0), mi = +(m[5] || 0), s = +(m[6] || 0);
    var ms = m[7] ? Math.round(+('0.' + m[7]) * 1000) : 0;
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return NaN;
    var t = Date.UTC(y, mo - 1, d, h, mi, s, ms);
    if (new Date(t).getUTCDate() !== d) return NaN;           // 31. Februar o. ä.
    var off = m[8];
    if (off && off !== 'Z') {
      var sign = off.charAt(0) === '-' ? -1 : 1, digits = off.slice(1).replace(':', '');
      var oh = +digits.slice(0, 2), om = +(digits.slice(2) || 0);
      if (oh > 23 || om > 59) return NaN;
      t -= sign * (oh * 60 + om) * MINUTE;
    }
    return t;
  }
  function isoZeit(ms) {
    if (!isFinite(ms)) return null;
    return new Date(ms).toISOString().replace('.000Z', 'Z');
  }
  function isoTag(ms) { return isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null; }
  function tagesbeginn(ms) { return Math.floor(ms / TAG) * TAG; }
  function addMonate(ms, k) {
    var d = new Date(ms), y = d.getUTCFullYear(), m = d.getUTCMonth() + k, tag = d.getUTCDate();
    var letzter = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(tag, letzter));
  }
  function deDatum(ms) { var d = new Date(ms); return d.getUTCDate() + '.' + (d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); }
  function dauerText(ms) {
    var min = Math.max(1, Math.ceil(ms / MINUTE));
    if (min >= 2 * 24 * 60) return Math.ceil(min / (24 * 60)) + ' Tage';
    var h = Math.floor(min / 60), m = min % 60;
    if (h === 0) return m + ' Min.';
    return h + ' Std.' + (m ? ' ' + m + ' Min.' : '');
  }

  /* ------------------------------------------------------------------ *
   * Kompilieren: den Plan einmal lesen, Verweise lösen, Regeln und Kurzformen vereinheitlichen.
   * Formale Probleme sammelt K.meld; pruefe() gibt sie aus. Nichts davon wirft.
   * ------------------------------------------------------------------ */

  var BAUSTEIN_FELDER = ['einheit', 'art', 'in', 'stufe', 'mindestens', 'offen'];
  var KNOTEN_FELDER = BAUSTEIN_FELDER.concat(['von', 'alle', 'eine', 'takt', 'ab', 'wartezeit']);

  function kompiliere(plan) {
    if (plan && plan.__sp === true) return plan;
    if (!istObj(plan)) throw new TypeError('Spielplan: plan fehlt oder ist kein Objekt');
    var K = { __sp: true, plan: plan, id: istText(plan.id) ? plan.id : '', by: neu(), list: [], members: neu(), eltern: neu(), regeln: [], regelVon: neu(), meld: [], ahnenCache: neu() };
    function m(ebene, text) { K.meld.push({ ebene: ebene, text: text }); }
    K.m = m;

    // --- Einheiten
    if (!Array.isArray(plan.einheiten)) m('fehler', 'einheiten fehlt oder ist keine Liste.');
    var roh = Array.isArray(plan.einheiten) ? plan.einheiten : [];
    roh.forEach(function (r, i) {
      if (!istObj(r)) { m('fehler', 'einheiten[' + i + '] ist kein Objekt.'); return; }
      if (!istText(r.id)) { m('fehler', 'einheiten[' + i + '] hat keine id.'); return; }
      if (K.by[r.id]) { m('fehler', 'Einheit ' + r.id + ': id doppelt vergeben (die zweite wird ignoriert).'); return; }
      var gewicht = 'wesentlich';
      if (r.gewicht !== undefined) {
        if (GEWICHTE.indexOf(r.gewicht) >= 0) gewicht = r.gewicht;
        else m('fehler', 'Einheit ' + r.id + ': gewicht „' + r.gewicht + '“ unbekannt (erlaubt: ' + GEWICHTE.join(', ') + '); es gilt wesentlich.');
      }
      var sicht = 'angedeutet';
      if (r.sichtbar !== undefined) {
        if (SICHTBARKEIT.indexOf(r.sichtbar) >= 0) sicht = r.sichtbar;
        else m('fehler', 'Einheit ' + r.id + ': sichtbar „' + r.sichtbar + '“ unbekannt (erlaubt: ' + SICHTBARKEIT.join(', ') + '); es gilt angedeutet.');
      }
      var u = {
        id: r.id, art: typeof r.art === 'string' ? r.art : '', name: istText(r.name) ? r.name : r.id,
        gewicht: gewicht, sichtbar: sicht, reihenfolge: istZahl(r.reihenfolge) ? r.reihenfolge : null,
        kann: istText(r.kann) ? r.kann : '', staerke: r.staerke, etappe: r.etappe, sorte: r.sorte,
        uebt: textListe(r.uebt), braucht: textListe(r.braucht), nach: istText(r.nach) ? r.nach : null,
        adresse: istText(r.adresse) ? r.adresse : null, aufgabe: r.aufgabe, roh: r, eltern: [], gated: false
      };
      K.by[u.id] = u; K.list.push(u);
    });
    K.list.sort(function (a, b) { return vergleiche(a.id, b.id); });

    // --- Eltern (in), Mitglieder
    K.list.forEach(function (u) {
      var rawIn = liste(u.roh.in);
      var ps = [];
      rawIn.forEach(function (p) {
        if (!istText(p)) { m('fehler', 'Einheit ' + u.id + ': in enthält einen Eintrag, der keine id ist.'); return; }
        if (p === u.id) { m('fehler', 'Einheit ' + u.id + ': in verweist auf sich selbst.'); return; }
        if (!K.by[p]) { m('fehler', 'Einheit ' + u.id + ': in verweist auf unbekannte Einheit „' + p + '“.'); return; }
        ps.push(p);
      });
      u.eltern = einzigartig(ps);
      K.eltern[u.id] = u.eltern;
      K.members[u.id] = K.members[u.id] || [];
    });
    function mitglied(von, zu) { if (K.members[zu].indexOf(von) < 0) K.members[zu].push(von); }
    K.list.forEach(function (u) {
      u.eltern.forEach(function (p) { mitglied(u.id, p); });
      u.uebt.forEach(function (s) {
        if (!K.by[s]) { m('fehler', 'Einheit ' + u.id + ': uebt verweist auf unbekannte Einheit „' + s + '“.'); return; }
        if (K.by[s].art !== 'skill') { m('warnung', 'Einheit ' + u.id + ': uebt verweist auf ' + s + ', das kein skill ist (3.1); es zählt nicht für dessen Stufe.'); return; }
        mitglied(u.id, s);
      });
    });
    K.list.forEach(function (u) { K.members[u.id].sort(vergleiche); });

    // --- Stufen, Begriffe
    K.anteil = { zahl: 2 / 3, exakt: true };
    var st = istObj(plan.stufen) ? plan.stufen : {};
    if (plan.stufen !== undefined && !istObj(plan.stufen)) m('fehler', 'stufen muss ein Objekt sein ({ anteil, bis }).');
    if (st.anteil !== undefined) {
      var a = st.anteil;
      if (typeof a === 'string' && /^\s*\d+\s*\/\s*\d+\s*$/.test(a)) { var q = a.split('/'); a = +q[0] / +q[1]; }
      if (istZahl(a) && a > 0 && a <= 1) { K.anteil = { zahl: a, exakt: Math.abs(a - 2 / 3) < 1e-12 }; }
      else m('fehler', 'stufen.anteil muss eine Zahl größer 0 und höchstens 1 sein (oder "2/3"); es gilt zwei Drittel.');
    }
    K.bis = 4;
    var bis = st.bis;
    if (bis !== undefined) { if (typeof bis === 'number' && bis >= 1 && bis <= 4 && Math.floor(bis) === bis) K.bis = bis; else m('fehler', 'stufen.bis muss 1, 2, 3 oder 4 sein; es gilt 4.'); }
    K.begriffe = {};
    ARTEN.forEach(function (art) {
      var b = istObj(plan.begriffe) && istObj(plan.begriffe[art]) ? plan.begriffe[art] : {};
      K.begriffe[art] = { art: istText(b.art) ? b.art : BEGRIFFE[art].art, sg: istText(b.sg) ? b.sg : BEGRIFFE[art].sg, pl: istText(b.pl) ? b.pl : BEGRIFFE[art].pl };
    });

    // --- Rhythmus
    var rh = istObj(plan.rhythmus) ? plan.rhythmus : {};
    if (plan.rhythmus !== undefined && !istObj(plan.rhythmus)) m('fehler', 'rhythmus muss ein Objekt sein.');
    K.takt = null; K.wiederkehr = null; K.verfall = null;
    if (rh.takt !== undefined) {
      if (!istObj(rh.takt)) m('fehler', 'rhythmus.takt muss ein Objekt sein ({ laenge, beginn }).');
      else {
        var laenge = 'woche';
        if (['tag', 'woche', 'monat'].indexOf(rh.takt.laenge) >= 0) laenge = rh.takt.laenge;
        else m('fehler', 'rhythmus.takt.laenge „' + rh.takt.laenge + '“ unbekannt (erlaubt: tag, woche, monat); es gilt woche.');
        var beginn = 'erstes-ereignis';
        if (rh.takt.beginn !== undefined && rh.takt.beginn !== 'erstes-ereignis') {
          var bm = zeitMs(rh.takt.beginn);
          if (isNaN(bm)) m('fehler', 'rhythmus.takt.beginn „' + rh.takt.beginn + '“ ist weder erstes-ereignis noch ein Datum; es gilt erstes-ereignis.');
          else beginn = bm;
        }
        K.takt = { laenge: laenge, beginn: beginn };
      }
    }
    if (rh.verfall_tage !== undefined) { if (istZahl(rh.verfall_tage) && rh.verfall_tage > 0) K.verfall = rh.verfall_tage; else m('fehler', 'rhythmus.verfall_tage muss eine positive Zahl sein.'); }
    if (rh.wiederkehr !== undefined) {
      var w = rh.wiederkehr, abst = [];
      if (!istObj(w)) m('fehler', 'rhythmus.wiederkehr muss ein Objekt sein ({ abstand_tage, fuer }).');
      else {
        if (Array.isArray(w.abstand_tage) && w.abstand_tage.length && w.abstand_tage.every(function (x) { return istZahl(x) && x > 0; })) abst = w.abstand_tage.slice();
        else m('fehler', 'rhythmus.wiederkehr.abstand_tage muss eine Liste positiver Zahlen sein (z. B. [1, 3, 7, 21]).');
        var fuer = null;
        if (w.fuer !== undefined) {
          if (!istObj(w.fuer)) m('fehler', 'rhythmus.wiederkehr.fuer muss ein Objekt sein ({ art, einheit, in }).');
          else { fuer = baustein(K, { einheit: w.fuer.einheit, art: w.fuer.art, in: w.fuer.in, stufe: 0 }, 'rhythmus.wiederkehr.fuer'); Object.keys(w.fuer).forEach(function (k) { if (['einheit', 'art', 'in'].indexOf(k) < 0) m('warnung', 'rhythmus.wiederkehr.fuer: unbekanntes Feld „' + k + '“ (erlaubt: einheit, art, in).'); }); }
        }
        if (abst.length) K.wiederkehr = { abstaende: abst, fuer: fuer ? fuer.match : K.list.map(function (u) { return u.id; }) };
      }
    }

    // --- Regeln (Abschnitt 5) und Kurzformen (5.4)
    var regeln = Array.isArray(plan.regeln) ? plan.regeln : [];
    if (plan.regeln !== undefined && !Array.isArray(plan.regeln)) m('fehler', 'regeln muss eine Liste sein.');
    var regelIds = neu();
    regeln.forEach(function (r, i) {
      if (!istObj(r)) { m('fehler', 'regeln[' + i + '] ist kein Objekt.'); return; }
      var rid = istText(r.id) ? r.id : '';
      if (!rid) { m('fehler', 'regeln[' + i + '] hat keine id.'); rid = 'regel-' + (i + 1); }
      if (regelIds[rid]) { m('fehler', 'Regel ' + rid + ': id doppelt vergeben (die zweite wird ignoriert).'); return; }
      regelIds[rid] = true;
      var ziele = [];
      if (!Array.isArray(r.schaltet) || !r.schaltet.length) m('fehler', 'Regel ' + rid + ': schaltet fehlt oder ist leer (Liste von Einheiten).');
      textListe(r.schaltet).forEach(function (z) { if (K.by[z]) ziele.push(z); else m('fehler', 'Regel ' + rid + ': schaltet verweist auf unbekannte Einheit „' + z + '“.'); });
      if (!istText(r.enthuellung)) m('warnung', 'Regel ' + rid + ': enthuellung fehlt (Grundsatz 6: der Moment des Freischaltens braucht einen Satz).');
      K.regeln.push({ id: rid, ziele: einzigartig(ziele).sort(vergleiche), wenn: normiere(K, r.wenn, 'Regel ' + rid), enthuellung: istText(r.enthuellung) ? r.enthuellung.trim() : null, kurz: false, nr: i });
    });
    K.list.forEach(function (u) {
      var teile = [];
      if (u.nach) {
        if (K.by[u.nach]) teile.push({ t: 'b', einheit: u.nach, art: null, in: null, stufe: 2, mindestens: 1, offen: false, match: [u.nach] });
        else m('fehler', 'Einheit ' + u.id + ': nach verweist auf unbekannte Einheit „' + u.nach + '“.');
      }
      if (u.braucht.length) {
        u.braucht.forEach(function (w) {
          if (!K.by[w]) { m('fehler', 'Einheit ' + u.id + ': braucht verweist auf unbekannte Einheit „' + w + '“.'); return; }
          if (K.by[w].art !== 'werkzeug') m('warnung', 'Einheit ' + u.id + ': braucht verweist auf ' + w + ', das kein werkzeug ist (3.1).');
          teile.push({ t: 'b', einheit: w, art: null, in: null, stufe: 1, mindestens: 1, offen: true, match: [w] });
        });
      }
      if (u.roh.nach !== undefined && !istText(u.roh.nach)) m('fehler', 'Einheit ' + u.id + ': nach muss eine id sein.');
      if (teile.length) {
        // nach und braucht an derselben Einheit gelten zusammen (Auslegung A5); mehrere Regeln dagegen sind Alternativen
        K.regeln.push({ id: 'kurz/' + u.id, ziele: [u.id], wenn: teile.length === 1 ? teile[0] : { t: 'alle', von: teile }, enthuellung: null, kurz: true, nr: 100000 });
      }
    });
    K.regeln.sort(function (a, b) { return vergleiche(a.id, b.id); });
    K.regeln.forEach(function (r) {
      r.ziele.forEach(function (z) { (K.regelVon[z] = K.regelVon[z] || []).push(r); K.by[z].gated = true; });
    });
    return K;
  }

  /** Alle Vorfahren einer Einheit über in (mit Zyklenschutz). */
  function ahnen(K, id) {
    if (K.ahnenCache[id]) return K.ahnenCache[id];
    var s = neu(), todo = (K.eltern[id] || []).slice();
    while (todo.length) { var p = todo.pop(); if (s[p]) continue; s[p] = true; (K.eltern[p] || []).forEach(function (q) { todo.push(q); }); }
    delete s[id];
    K.ahnenCache[id] = s;
    return s;
  }

  /** Baustein (Auswahl von Einheiten + Mindeststufe) prüfen und die passenden Einheiten bestimmen. */
  function baustein(K, raw, wo) {
    var b = { t: 'b', einheit: istText(raw.einheit) ? raw.einheit : null, art: istText(raw.art) ? raw.art : null, in: istText(raw.in) ? raw.in : null, stufe: 2, mindestens: 1, offen: raw.offen === true, match: [] };
    ['einheit', 'art', 'in'].forEach(function (k) { if (raw[k] !== undefined && !istText(raw[k])) K.m('fehler', wo + ': ' + k + ' muss ein Text sein.'); });
    if (raw.stufe !== undefined) {
      if (typeof raw.stufe === 'number' && raw.stufe >= 0 && raw.stufe <= 4 && Math.floor(raw.stufe) === raw.stufe) b.stufe = raw.stufe;
      else K.m('fehler', wo + ': stufe „' + raw.stufe + '“ ungültig (0 bis 4); es gilt 2.');
    }
    if (raw.mindestens !== undefined) {
      if (raw.mindestens === 'alle') b.mindestens = 'alle';
      else if (typeof raw.mindestens === 'number' && raw.mindestens >= 1 && Math.floor(raw.mindestens) === raw.mindestens) b.mindestens = raw.mindestens;
      else K.m('fehler', wo + ': mindestens „' + raw.mindestens + '“ ungültig (Zahl ab 1 oder alle); es gilt 1.');
    }
    if (raw.offen !== undefined && typeof raw.offen !== 'boolean') K.m('fehler', wo + ': offen muss true oder false sein.');
    if (b.art && ARTEN.indexOf(b.art) < 0) K.m('fehler', wo + ': art „' + b.art + '“ unbekannt (erlaubt: ' + ARTEN.join(', ') + ').');
    if (!b.einheit && !b.art && !b.in) K.m('fehler', wo + ': Baustein ohne einheit, art oder in wählt nichts aus.');
    var re = b.einheit ? glob(b.einheit) : null, reIn = b.in ? glob(b.in) : null;
    K.list.forEach(function (u) {
      if (re && !re.test(u.id)) return;
      if (b.art && u.art !== b.art) return;
      if (reIn) {
        var vorf = ahnen(K, u.id), ok = false;
        for (var k in vorf) { if (reIn.test(k)) { ok = true; break; } }
        if (!ok) return;
      }
      b.match.push(u.id);
    });
    if (!b.match.length && (b.einheit || b.art || b.in)) {
      var was = [];
      if (b.einheit) was.push('einheit ' + b.einheit);
      if (b.art) was.push('art ' + b.art);
      if (b.in) was.push('in ' + b.in);
      K.m('fehler', wo + ': Baustein (' + was.join(', ') + ') trifft keine Einheit' + (b.einheit && !hatStern(b.einheit) && !K.by[b.einheit] ? ': „' + b.einheit + '“ ist unbekannt' : '') + '.');
    }
    if (b.mindestens !== 'alle' && b.mindestens > b.match.length && b.match.length) K.m('fehler', wo + ': Baustein verlangt mindestens ' + b.mindestens + ', es gibt aber nur ' + b.match.length + ' passende Einheit(en).');
    return b;
  }

  function nie(grund) { return { t: 'nie', grund: grund }; }

  /** Bedingung (5.1) in einen Baum aus b, alle, eine, min, takt, ab, warte, nie verwandeln. */
  function normiere(K, raw, wo) {
    if (!istObj(raw)) { K.m('fehler', wo + ': wenn fehlt oder ist kein Objekt.'); return nie('keine Bedingung'); }
    Object.keys(raw).forEach(function (k) { if (KNOTEN_FELDER.indexOf(k) < 0) K.m('warnung', wo + ': unbekanntes Feld „' + k + '“ in der Bedingung (Tippfehler?). Bekannt: ' + KNOTEN_FELDER.join(', ') + '.'); });
    function kinder(name, v) {
      if (!Array.isArray(v) || !v.length) { K.m('fehler', wo + ': ' + name + ' braucht eine nicht leere Liste.'); return null; }
      return v.map(function (c) { return normiere(K, c, wo); });
    }
    var teile = [];
    if (raw.alle !== undefined) { var ka = kinder('alle', raw.alle); teile.push(ka ? { t: 'alle', von: ka } : nie('alle ohne Liste')); }
    if (raw.eine !== undefined) { var ke = kinder('eine', raw.eine); teile.push(ke ? { t: 'eine', von: ke } : nie('eine ohne Liste')); }
    var auswahl = raw.einheit !== undefined || raw.art !== undefined || raw.in !== undefined;
    if (raw.von !== undefined || (raw.mindestens !== undefined && !auswahl)) {
      var kv = kinder('von', raw.von), n = raw.mindestens;
      if (!(typeof n === 'number' && n >= 1 && Math.floor(n) === n)) { K.m('fehler', wo + ': mindestens braucht zusammen mit von eine Zahl ab 1.'); teile.push(nie('mindestens ungültig')); }
      else if (!kv) teile.push(nie('von ohne Liste'));
      else { if (n > kv.length) K.m('fehler', wo + ': mindestens ' + n + ' von nur ' + kv.length + ' Bedingungen kann nie gelten.'); teile.push({ t: 'min', n: n, von: kv }); }
    }
    if (raw.takt !== undefined) {
      if (typeof raw.takt === 'number' && raw.takt >= 0 && Math.floor(raw.takt) === raw.takt) {
        if (!K.takt) K.m('fehler', wo + ': takt-Bedingung, aber rhythmus.takt fehlt: der Takt zählt nie.');
        teile.push({ t: 'takt', n: raw.takt });
      } else { K.m('fehler', wo + ': takt braucht eine ganze Zahl ab 0.'); teile.push(nie('takt ungültig')); }
    }
    if (raw.ab !== undefined) {
      var ms = zeitMs(raw.ab);
      if (isNaN(ms)) { K.m('fehler', wo + ': ab „' + raw.ab + '“ ist kein Datum (JJJJ-MM-TT).'); teile.push(nie('ab ungültig')); }
      else teile.push({ t: 'ab', ms: ms });
    }
    if (raw.wartezeit !== undefined) {
      var wz = raw.wartezeit;
      if (!istObj(wz) || !istText(wz.einheit)) { K.m('fehler', wo + ': wartezeit braucht { einheit, stufe, stunden }.'); teile.push(nie('wartezeit ungültig')); }
      else {
        var ok = true;
        if (!K.by[wz.einheit]) { K.m('fehler', wo + ': wartezeit verweist auf unbekannte Einheit „' + wz.einheit + '“.'); ok = false; }
        var stufe = wz.stufe === undefined ? 2 : wz.stufe;
        if (!(typeof stufe === 'number' && stufe >= 1 && stufe <= 4 && Math.floor(stufe) === stufe)) { K.m('fehler', wo + ': wartezeit.stufe muss 1 bis 4 sein.'); ok = false; }
        if (!(istZahl(wz.stunden) && wz.stunden >= 0)) { K.m('fehler', wo + ': wartezeit.stunden muss eine Zahl ab 0 sein.'); ok = false; }
        Object.keys(wz).forEach(function (k) { if (['einheit', 'stufe', 'stunden'].indexOf(k) < 0) K.m('warnung', wo + ': wartezeit: unbekanntes Feld „' + k + '“.'); });
        teile.push(ok ? { t: 'warte', einheit: wz.einheit, stufe: stufe, stunden: wz.stunden } : nie('wartezeit ungültig'));
      }
    }
    if (auswahl) teile.push(baustein(K, raw, wo));
    if (!teile.length) { K.m('fehler', wo + ': die Bedingung enthält nichts, was sich prüfen ließe.'); return nie('leere Bedingung'); }
    if (teile.length > 1) { K.m('warnung', wo + ': mehrere Bedingungen in einem Knoten (' + Object.keys(raw).join(', ') + ') gelten als alle: […]. Schreibe das lieber ausdrücklich.'); return { t: 'alle', von: teile }; }
    return teile[0];
  }

  /* ------------------------------------------------------------------ *
   * Ereignisse aufbereiten (6.2) und Stufen-Zeitpunkte (Abschnitt 4)
   * ------------------------------------------------------------------ */

  function falltext(f) {
    if (typeof f === 'number' && isFinite(f)) f = String(f);
    return istText(f) ? f.trim().toLowerCase() : null;
  }

  /** Ein Ereignis lesen: { ok: {...} } oder { grund }. Wirft nie. */
  function leseEreignis(K, e) {
    if (!istObj(e)) return { grund: 'kein Objekt' };
    if (typeof e.verb !== 'string' || !hat(VERBEN, e.verb)) return { grund: 'Verb „' + e.verb + '“ unbekannt' };
    if (e.verb === 'freigeschaltet') return { grund: 'freigeschaltet ist abgeleitet; der Spielstand liest es nicht (6.1)' };
    if (!istText(e.objekt) || !K.by[e.objekt]) return { grund: 'objekt „' + e.objekt + '“ steht nicht im Spielplan' };
    var z = zeitMs(e.zeit);
    if (isNaN(z)) return { grund: 'zeit fehlt oder ist nicht lesbar' };
    var mit = [];
    textListe(e.mit).forEach(function (w) { if (K.by[w] && K.by[w].art === 'werkzeug' && w !== e.objekt) mit.push(w); });
    var beleg = istObj(e.beleg) && BELEG_ARTEN.indexOf(e.beleg.art) >= 0;
    return { ok: { z: z, verb: e.verb, objekt: e.objekt, mit: einzigartig(mit), beleg: beleg, fall: beleg ? falltext(e.beleg.fall) : null } };
  }

  /** Gültige Ereignisse sortieren (Zeit, dann Text: unabhängig von der Eingabereihenfolge), Zeiten nach jetzt auf jetzt kappen. */
  function aufbereiten(K, rohe, jetztMs, opts) {
    var ev = [], ign = [];
    if (!Array.isArray(rohe)) rohe = [];
    rohe.forEach(function (e, nr) {
      if (opts.wer !== undefined && istObj(e) && e.wer !== opts.wer) return;
      var r = leseEreignis(K, e);
      if (!r.ok) { ign.push({ nr: nr, grund: r.grund }); return; }
      var x = r.ok;
      if (x.z > jetztMs) x.z = jetztMs;                  // Ereignisse aus der Zukunft (falsche Uhr) zählen, aber erst ab jetzt
      x.schluessel = x.verb + '|' + x.objekt + '|' + x.mit.join(',') + '|' + (x.beleg ? 1 : 0) + '|' + (x.fall || '');
      ev.push(x);
    });
    ev.sort(function (a, b) { return a.z - b.z || vergleiche(a.schluessel, b.schluessel); });
    return { ev: ev, ign: ign };
  }

  /** Zeitpunkte, an denen die Stufen 1 bis 4 allein durch Ereignisse an dieser Einheit erreicht sind. */
  function direktZeiten(evs) {
    var T = [INF, INF, INF, INF], erstesGeteilt = INF, erstesBelegt = INF, faelle = neu();
    for (var i = 0; i < evs.length; i++) {
      var e = evs[i];
      if (e.z < T[0]) T[0] = e.z;
      if (e.verb === 'geschafft' || e.verb === 'bestanden' || e.verb === 'angewendet') { if (e.z < T[1]) T[1] = e.z; }
      if (e.verb === 'angewendet' && e.beleg) {
        if (e.z < T[2]) T[2] = e.z;
        if (e.z < erstesBelegt) erstesBelegt = e.z;
        if (e.fall !== null && (!(e.fall in faelle) || e.z < faelle[e.fall])) faelle[e.fall] = e.z;
      }
      if (e.verb === 'geteilt' && e.z < erstesGeteilt) erstesGeteilt = e.z;
    }
    var fz = Object.keys(faelle).map(function (k) { return faelle[k]; }).sort(nachZahl);
    if (fz.length >= 2) T[3] = fz[1];
    if (erstesBelegt < INF && erstesGeteilt < INF) T[3] = Math.min(T[3], Math.max(erstesBelegt, erstesGeteilt));
    for (var s = 2; s >= 0; s--) if (T[s + 1] < T[s]) T[s] = T[s + 1];
    return T;
  }

  /** Anzahl der wesentlichen Mitglieder, die für eine Stufe reichen: aufgerundeter Anteil (Standard zwei Drittel). */
  function brauchtVon(K, n) {
    if (n <= 0) return 0;
    if (K.anteil.exakt) return Math.floor((2 * n + 2) / 3);
    return Math.min(n, Math.max(1, Math.ceil(n * K.anteil.zahl - 1e-9)));
  }

  /** Zeitpunkt, ab dem eine Sammel-Einheit die Stufe s (0-basiert) aus ihren Mitgliedern erreicht (4.1). */
  function sammelZeit(K, id, s, T) {
    var kr = [], ws = [], mem = K.members[id];
    for (var i = 0; i < mem.length; i++) {
      var g = K.by[mem[i]].gewicht;
      if (g === 'kritisch') kr.push(T[mem[i]][s]);
      else if (g === 'wesentlich') ws.push(T[mem[i]][s]);
    }
    if (!kr.length && !ws.length) return INF;       // ohne kritische und wesentliche Mitglieder gibt es nichts zu messen (Auslegung A4)
    var t = kr.length ? maximum(kr) : -INF, k = brauchtVon(K, ws.length);
    if (k > 0) t = Math.max(t, kleinste(ws, k));
    return t;
  }

  /** Stufen-Zeitpunkte aller Einheiten: direkt aus Ereignissen, Sammel-Einheiten zusätzlich aus Mitgliedern (Fixpunkt von unten). */
  function stufenZeiten(K, dir) {
    var T = neu(), sammler = [];
    K.list.forEach(function (u) {
      T[u.id] = dir[u.id] ? direktZeiten(dir[u.id]) : [INF, INF, INF, INF];
      if (K.members[u.id].length) sammler.push(u.id);
    });
    var grenze = 4 * K.list.length + 8;
    for (var runde = 0; runde < grenze; runde++) {
      var geaendert = false;
      for (var i = 0; i < sammler.length; i++) {
        var id = sammler[i];
        for (var s = 0; s < 4; s++) {
          var v = sammelZeit(K, id, s, T);
          if (v < T[id][s]) { T[id][s] = v; geaendert = true; }
        }
      }
      if (!geaendert) break;
    }
    return T;
  }

  function stufeBei(arr, t) { var n = 0; for (var s = 0; s < 4; s++) if (arr[s] <= t) n = s + 1; return n; }
  function stufeZeit(T, id, s) { if (s <= 0) return -INF; var a = T[id]; return a ? a[s - 1] : INF; }

  /* ------------------------------------------------------------------ *
   * Takt (5.5)
   * ------------------------------------------------------------------ */

  function taktRechner(K, erstesEreignis) {
    var tk = K.takt, anker = null;
    if (tk) anker = tk.beginn === 'erstes-ereignis' ? (isFinite(erstesEreignis) ? tagesbeginn(erstesEreignis) : null) : tagesbeginn(tk.beginn);
    function start(n) {
      if (!tk) return INF;
      if (n < 1) return -INF;
      if (anker === null) return INF;
      if (tk.laenge === 'tag') return anker + (n - 1) * TAG;
      if (tk.laenge === 'woche') return anker + (n - 1) * 7 * TAG;
      return addMonate(anker, n - 1);
    }
    function index(t) {
      if (!tk || anker === null || t < anker) return 0;
      if (tk.laenge === 'tag') return Math.floor((t - anker) / TAG) + 1;
      if (tk.laenge === 'woche') return Math.floor((t - anker) / (7 * TAG)) + 1;
      var n = Math.max(1, Math.floor((t - anker) / (28 * TAG)) + 1);
      while (start(n + 1) <= t) n++;
      while (n > 1 && start(n) > t) n--;
      return n;
    }
    return { start: start, index: index, anker: anker };
  }

  /* ------------------------------------------------------------------ *
   * Zugang: Zeitpunkt, ab dem jede Regel und jede Einheit offen ist (Abschnitt 5)
   * ------------------------------------------------------------------ */

  function bedingungZeit(K, kn, T, takt, O, ohneWartezeit) {
    var i, ts;
    switch (kn.t) {
      case 'b':
        ts = [];
        for (i = 0; i < kn.match.length; i++) {
          var t = stufeZeit(T, kn.match[i], kn.stufe);
          if (kn.offen && O[kn.match[i]] > t) t = O[kn.match[i]];
          ts.push(t);
        }
        var k = kn.mindestens === 'alle' ? ts.length : kn.mindestens;
        if (!ts.length || k > ts.length) return INF;
        return kleinste(ts, k);
      case 'alle': ts = []; for (i = 0; i < kn.von.length; i++) ts.push(bedingungZeit(K, kn.von[i], T, takt, O, ohneWartezeit)); return maximum(ts);
      case 'eine': ts = []; for (i = 0; i < kn.von.length; i++) ts.push(bedingungZeit(K, kn.von[i], T, takt, O, ohneWartezeit)); return minimum(ts);
      case 'min':
        ts = []; for (i = 0; i < kn.von.length; i++) ts.push(bedingungZeit(K, kn.von[i], T, takt, O, ohneWartezeit));
        return kn.n > ts.length ? INF : kleinste(ts, kn.n);
      case 'takt': return takt.start(kn.n);
      case 'ab': return kn.ms;
      case 'warte':
        var z = stufeZeit(T, kn.einheit, kn.stufe);
        return z === INF ? INF : z + (ohneWartezeit ? 0 : kn.stunden * STUNDE);
      default: return INF;
    }
  }

  /** O[einheit] = Zeitpunkt, ab dem sie offen ist (-INF: von Anfang an). RZ[regel] = Zeitpunkt, ab dem die Regel erfüllt ist. */
  function zugangsZeiten(K, T, takt, ohneWartezeit) {
    var O = neu(), RZ = neu();
    K.list.forEach(function (u) { O[u.id] = INF; });
    K.regeln.forEach(function (r) { RZ[r.id] = INF; });
    var grenze = 2 * (K.list.length + K.regeln.length) + 8;
    for (var runde = 0; runde < grenze; runde++) {
      var geaendert = false;
      K.regeln.forEach(function (r) {
        var v = bedingungZeit(K, r.wenn, T, takt, O, ohneWartezeit);
        if (v !== RZ[r.id]) { RZ[r.id] = v; geaendert = true; }
      });
      K.list.forEach(function (u) {
        var eigen = -INF;
        if (u.gated) { eigen = INF; (K.regelVon[u.id] || []).forEach(function (r) { if (RZ[r.id] < eigen) eigen = RZ[r.id]; }); }
        var vom = -INF;
        if (u.eltern.length) { vom = INF; u.eltern.forEach(function (p) { if (O[p] < vom) vom = O[p]; }); }   // offen, sobald irgendein Elter offen ist
        var v = Math.max(eigen, vom);
        if (v !== O[u.id]) { O[u.id] = v; geaendert = true; }
      });
      if (!geaendert) break;
    }
    return { O: O, RZ: RZ };
  }

  /* ------------------------------------------------------------------ *
   * Die Rechnung: alles Zeitpunkte, unabhängig von jetzt
   * ------------------------------------------------------------------ */

  function rechne(K, rohe, jetztMs, opts) {
    opts = opts || {};
    var A = aufbereiten(K, rohe, jetztMs, opts);
    var dir = neu(), alleZ = neu(), erstes = INF;
    function stecke(id, e) { (dir[id] = dir[id] || []).push(e); (alleZ[id] = alleZ[id] || []).push(e.z); }
    A.ev.forEach(function (e) {
      if (e.z < erstes) erstes = e.z;
      stecke(e.objekt, e);
      if (DURCHGEREICHT[e.verb]) e.mit.forEach(function (w) { stecke(w, { z: e.z, verb: e.verb, objekt: w, beleg: e.beleg, fall: e.fall }); });   // Werkzeuge über mit (4.2)
    });
    var T = stufenZeiten(K, dir);
    var takt = taktRechner(K, erstes);
    var Z = zugangsZeiten(K, T, takt, !!opts.ohneWartezeit);
    return { K: K, jetzt: jetztMs, ev: A.ev, ign: A.ign, dir: dir, alleZ: alleZ, T: T, takt: takt, O: Z.O, RZ: Z.RZ, erstes: erstes, ohneWartezeit: !!opts.ohneWartezeit, bis: (typeof opts.bis === 'number' && opts.bis >= 1 && opts.bis <= 4) ? Math.floor(opts.bis) : K.bis };
  }

  /** Transitive Mitglieder (mit Zyklenschutz). */
  function nachfahren(K, id) {
    var s = neu(), todo = K.members[id].slice();
    while (todo.length) { var m = todo.pop(); if (s[m] || m === id) continue; s[m] = true; K.members[m].forEach(function (x) { todo.push(x); }); }
    return Object.keys(s).sort();
  }

  /** Zeitpunkte aller Ereignisse, die eine Einheit betreffen (direkt, über mit, über ihre Mitglieder), aufsteigend. */
  function ereignisZeiten(R, id) {
    var z = (R.alleZ[id] || []).slice();
    if (R.K.members[id].length) nachfahren(R.K, id).forEach(function (m) { if (R.alleZ[m]) z = z.concat(R.alleZ[m]); });
    return z.sort(nachZahl);
  }

  /* ------------------------------------------------------------------ *
   * Sätze: Bedingung als deutscher Satz, mit dem, was fehlt (Abschnitt 8)
   * ------------------------------------------------------------------ */

  var PARTIZIP = ['erreicht', 'begonnen', 'geschafft', 'angewendet', 'gemeistert'];
  var PARTIZIP_WERKZEUG = ['erreicht', 'ausprobiert', 'eingesetzt', 'angewendet', 'gemeistert'];
  var TAKT_WORT = { tag: 'Tag', woche: 'Woche', monat: 'Monat' };

  function nenne(K, id) { return zitat(K.by[id].name); }
  /** Wie nenne, aber eine gesperrte, wirksam verborgene Einheit bleibt ungenannt (Grundsatz 5: Überraschungen bleiben Überraschungen). */
  function nenneR(R, id) { return R.S && !R.S.offen[id] && verborgenWirksam(R, R.S, id, 0) ? 'etwas Verborgenes' : nenne(R.K, id); }
  function mitArtikel(K, art) { var b = K.begriffe[art] || K.begriffe.inhalt; return b.art + ' ' + b.sg; }
  function gross(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function partizip(K, art, s) { return (art === 'werkzeug' ? PARTIZIP_WERKZEUG : PARTIZIP)[s] || PARTIZIP[s]; }
  function klammer(s, wort) { return s.indexOf(' ' + wort + ' ') >= 0 ? '(' + s + ')' : s; }
  function stundenText(h) { return h === Math.floor(h) ? h + ' Std.' : dauerText(h * STUNDE); }

  function einheitlicheArt(K, ids) {
    var a = null;
    for (var i = 0; i < ids.length; i++) { var x = K.by[ids[i]].art; if (a === null) a = x; else if (a !== x) return null; }
    return a;
  }

  /** Der noch fehlende Teil einer Bedingung als Satzteil; '' wenn sie erfüllt ist. */
  function satz(R, kn) {
    var K = R.K, jetzt = R.jetzt, i, teile, v;
    switch (kn.t) {
      case 'b':
        var da = 0;
        kn.match.forEach(function (id) { var t = stufeZeit(R.T, id, kn.stufe); if (kn.offen && R.O[id] > t) t = R.O[id]; if (t <= jetzt) da++; });
        var k = kn.mindestens === 'alle' ? kn.match.length : kn.mindestens;
        if (da >= k) return '';
        var art = kn.art || einheitlicheArt(K, kn.match), teil = partizip(K, art, kn.stufe);
        if (kn.match.length === 1) return nenneR(R, kn.match[0]) + ' ' + teil;
        var nomen = art ? (k === 1 ? K.begriffe[art].sg : K.begriffe[art].pl) : (k === 1 ? 'Einheit' : 'Einheiten');
        var inText = kn.in ? ' in ' + (K.by[kn.in] ? nenneR(R, kn.in) : kn.in) : '';
        return (kn.mindestens === 'alle' ? 'alle ' : '') + k + ' ' + nomen + inText + ' ' + teil + (da > 0 ? ' – ' + (k - da) + (k - da === 1 ? ' fehlt' : ' fehlen') : '');
      case 'alle':
        teile = [];
        for (i = 0; i < kn.von.length; i++) { v = satz(R, kn.von[i]); if (v) teile.push(klammer(v, 'oder')); }
        return teile.join(' und ');
      case 'eine':
        teile = [];
        for (i = 0; i < kn.von.length; i++) { v = satz(R, kn.von[i]); if (!v) return ''; teile.push(klammer(v, 'und')); }
        return teile.join(' oder ');
      case 'min':
        teile = []; var ok = 0;
        for (i = 0; i < kn.von.length; i++) { v = satz(R, kn.von[i]); if (!v) ok++; else teile.push(v); }
        return ok >= kn.n ? '' : 'noch ' + (kn.n - ok) + ' von: ' + teile.join('; ');
      case 'takt': return R.takt.index(jetzt) >= kn.n ? '' : 'ab ' + (K.takt ? TAKT_WORT[K.takt.laenge] : 'Takt') + ' ' + kn.n;
      case 'ab': return kn.ms <= jetzt ? '' : 'ab dem ' + deDatum(kn.ms);
      case 'warte':
        var z = stufeZeit(R.T, kn.einheit, kn.stufe), ende = z + (R.ohneWartezeit ? 0 : kn.stunden * STUNDE);
        if (ende <= jetzt) return '';
        if (z <= jetzt) return 'noch ' + dauerText(ende - jetzt) + ' Pause nach ' + nenneR(R, kn.einheit);
        return stundenText(kn.stunden) + ' Pause, nachdem ' + nenneR(R, kn.einheit) + ' ' + partizip(K, K.by[kn.einheit].art, kn.stufe) + ' ist';
      default: return 'derzeit nicht erreichbar';
    }
  }

  /** Was einer gesperrten Einheit fehlt: eigene Regeln und gesperrte Eltern. */
  function bedingungsKern(R, u, tiefe) {
    var K = R.K, jetzt = R.jetzt, teile = [];
    if (u.gated) {
      var offen = false, saetze = [];
      (K.regelVon[u.id] || []).forEach(function (r) { if (R.RZ[r.id] <= jetzt) offen = true; });
      if (!offen) {
        (K.regelVon[u.id] || []).forEach(function (r) { var s = satz(R, r.wenn); if (s && saetze.indexOf(s) < 0) saetze.push(s); });
        if (saetze.length) teile.push(saetze.length > 1 ? saetze.map(function (s) { return klammer(s, 'und'); }).join(' oder ') : saetze[0]);
      }
    }
    if (u.eltern.length && tiefe < 6 && !u.eltern.some(function (p) { return R.O[p] <= jetzt; })) {
      var eigen = teile.slice(), ps = [];
      u.eltern.forEach(function (p) {
        var k = bedingungsKern(R, K.by[p], tiefe + 1);
        if (!k || eigen.indexOf(k) < 0) ps.push(nenneR(R, p) + ' muss offen sein' + (k ? ' (' + k + ')' : ''));   // dieselbe Bedingung wie die eigene: nicht doppelt nennen
      });
      if (ps.length) teile.push(ps.join(' oder '));
    }
    return teile.join(' und zugleich ');
  }

  /* ------------------------------------------------------------------ *
   * Hilfen für Spielstand und Aufgabe
   * ------------------------------------------------------------------ */

  function aktionsfaehig(K, u) { return K.members[u.id].length === 0 && (u.art === 'inhalt' || u.art === 'quest' || u.art === 'erlebnis' || u.art === 'werkzeug' || u.art === 'episode'); }
  var GEWICHT_RANG = { kritisch: 0, wesentlich: 1, optional: 2 };

  function pfad(K, id) {
    var p = [], u = K.by[id], schutz = 0;
    while (u && schutz++ < 12) { if (u.reihenfolge !== null) p.unshift(u.reihenfolge); u = u.eltern.length ? K.by[u.eltern[0]] : null; }   // nur Eltern mit Nummer zählen
    return p;
  }
  function vergleichePfad(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = i < a.length ? a[i] : INF, y = i < b.length ? b[i] : INF;                  // ohne Nummer kommt nach den Nummerierten
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }
  /** Reihenfolge für "die nächste": Gewicht, Reihenfolge entlang der Eltern, höhere Stufe zuerst, id. */
  function vergleicheAufgabe(R, S) {
    var K = R.K, cache = neu();
    function p(id) { return cache[id] || (cache[id] = pfad(K, id)); }
    return function (a, b) {
      var g = GEWICHT_RANG[K.by[a].gewicht] - GEWICHT_RANG[K.by[b].gewicht];
      if (g) return g;
      var q = vergleichePfad(p(a), p(b));
      if (q) return q;
      if (S.stufe[a] !== S.stufe[b]) return S.stufe[b] - S.stufe[a];
      return vergleiche(a, b);
    };
  }

  function aufgabenText(K, u, ziel) {
    var o = u.aufgabe;
    if (istText(o)) return o.trim();
    if (istObj(o) && istText(o[ziel])) return o[ziel].trim();
    var n = zitat(u.name), fall = ' an einem echten Fall an und halte einen Beleg fest.';
    switch (u.art) {
      case 'inhalt': return ['', 'Schau dir ' + n + ' an.', 'Geh ' + n + ' ganz durch.', 'Wende ' + n + fall, 'Wende ' + n + ' an einem zweiten, anderen Fall an – oder gib es weiter.'][ziel];
      case 'quest': return ['', 'Nimm dir ' + n + ' vor.', 'Löse ' + n + '.', 'Löse ' + n + ' an einem echten Fall und halte einen Beleg fest.', 'Löse ' + n + ' an einem zweiten, anderen Fall – oder gib es weiter.'][ziel];
      case 'erlebnis': return ['', 'Probier ' + n + ' aus.', 'Bring ' + n + ' zu Ende.', 'Übertrage ' + n + ' auf einen echten Fall und halte einen Beleg fest.', 'Übertrage ' + n + ' auf einen zweiten, anderen Fall – oder gib es weiter.'][ziel];
      case 'werkzeug': return ['', 'Probier ' + n + ' aus.', 'Setze ' + n + ' ein, bis es klappt.', 'Wende ' + n + fall, 'Wende ' + n + ' an einem zweiten, anderen Fall an – oder gib es weiter.'][ziel];
      case 'episode': return ['', 'Betritt ' + n + '.', 'Schließe ' + n + ' ab.', 'Zeig an ' + n + ', was du kannst: mit einem Beleg.', 'Gib ' + n + ' weiter oder übertrage es auf einen neuen Fall.'][ziel];
      default: return 'Geh ' + n + ' an.';
    }
  }

  function angefangen(R, S, id) { return S.stufe[id] > 0 || isFinite(letzteZeit(R, id, R.letzte)); }

  /** Kosten, eine Einheit auf Stufe s zu bringen: { n: Schritte, schritte: [{einheit, ziel}] } oder null, wenn gerade nicht machbar. */
  function weg(R, S, id, s, besucht) {
    var K = R.K, bis = R.bis;
    if (s > bis) return null;
    var st = S.stufe[id];
    if (st >= s) return { n: 0, schritte: [] };
    var u = K.by[id], mem = K.members[id];
    if (!S.offen[id]) return null;
    if (!mem.length) {
      if (!aktionsfaehig(K, u)) return null;
      return { n: s - st, schritte: [{ einheit: id, ziel: st + 1 }] };
    }
    if (besucht[id]) return null;
    besucht[id] = true;
    var kr = [], ws = [], res = null;
    mem.forEach(function (m) {
      var g = K.by[m].gewicht; if (g === 'optional') return;
      (g === 'kritisch' ? kr : ws).push({ id: m, w: weg(R, S, m, s, besucht), da: S.stufe[m] >= s });
    });
    var n = 0, sch = [], ok = true;
    kr.forEach(function (x) { if (!x.w) ok = false; else { n += x.w.n; sch = sch.concat(x.w.schritte); } });
    var brauch = brauchtVon(K, ws.length), da = ws.filter(function (x) { return x.da; }).length;
    if (ok && da < brauch) {
      var offen = ws.filter(function (x) { return !x.da && x.w; }).sort(function (a, b) {
        var fa = angefangen(R, S, a.id), fb = angefangen(R, S, b.id);
        if (fa !== fb) return fa ? -1 : 1;                                                          // Angefangenes zuerst (nächstliegend zuerst), dann Unberührtes in der Reihenfolge der Autorin
        return fa ? a.w.n - b.w.n || vergleiche(a.id, b.id) : R.vgl(a.id, b.id);
      });
      if (offen.length < brauch - da) ok = false;
      else offen.slice(0, brauch - da).forEach(function (x) { n += x.w.n; sch = sch.concat(x.w.schritte); });
    }
    besucht[id] = false;
    if (ok && (kr.length || ws.length)) res = { n: n, schritte: sch };
    return res;
  }

  /** Kosten einer Bedingung: { n, schritte, wartet } oder null. n = Schritte, die noch zu tun sind; wartet = Zeitpunkt, auf den noch gewartet werden muss. */
  function kosten(R, S, kn) {
    var jetzt = R.jetzt, i, c, cs, n, sch, wartet, ende, z, w;
    function warte(a, b) { return a === null ? b : (b === null ? a : Math.max(a, b)); }
    switch (kn.t) {
      case 'b':
        var opt = [];
        kn.match.forEach(function (id) {
          var t = stufeZeit(R.T, id, kn.stufe);
          if (t <= jetzt && (!kn.offen || R.O[id] <= jetzt)) { opt.push({ n: 0, s: [], id: id, begonnen: true }); return; }
          var x = kn.offen && !S.offen[id] ? null : weg(R, S, id, kn.stufe, neu());
          if (x) opt.push({ n: x.n, s: x.schritte, id: id, begonnen: angefangen(R, S, id) });
        });
        var k = kn.mindestens === 'alle' ? kn.match.length : kn.mindestens;
        if (opt.length < k) return null;
        // Erledigtes zuerst, dann Angefangenes (das Nächstliegende zuerst), dann Unberührtes in der Reihenfolge der Autorin
        opt.sort(function (a, b) {
          if ((a.n === 0) !== (b.n === 0)) return a.n === 0 ? -1 : 1;
          if (a.n !== 0 && a.begonnen !== b.begonnen) return a.begonnen ? -1 : 1;
          if (a.n !== 0 && !a.begonnen) return R.vgl(a.id, b.id);
          return a.n - b.n || vergleiche(a.id, b.id);
        });
        n = 0; sch = [];
        opt.slice(0, k).forEach(function (o) { n += o.n; sch = sch.concat(o.s); });
        return { n: n, schritte: sch, wartet: null };
      case 'alle':
        n = 0; sch = []; wartet = null;
        for (i = 0; i < kn.von.length; i++) { c = kosten(R, S, kn.von[i]); if (!c) return null; n += c.n; sch = sch.concat(c.schritte); wartet = warte(wartet, c.wartet); }
        return { n: n, schritte: sch, wartet: wartet };
      case 'eine':
        cs = [];
        for (i = 0; i < kn.von.length; i++) { c = kosten(R, S, kn.von[i]); if (c) cs.push(c); }
        if (!cs.length) return null;
        cs.sort(function (a, b) { return a.n - b.n || (a.wartet === null ? 0 : 1) - (b.wartet === null ? 0 : 1); });
        return cs[0];
      case 'min':
        cs = [];
        for (i = 0; i < kn.von.length; i++) { c = kosten(R, S, kn.von[i]); if (c) cs.push(c); }
        if (cs.length < kn.n) return null;
        cs.sort(function (a, b) { return a.n - b.n; });
        n = 0; sch = []; wartet = null;
        cs.slice(0, kn.n).forEach(function (x) { n += x.n; sch = sch.concat(x.schritte); wartet = warte(wartet, x.wartet); });
        return { n: n, schritte: sch, wartet: wartet };
      case 'takt': ende = R.takt.start(kn.n); return ende <= jetzt ? { n: 0, schritte: [], wartet: null } : { n: 0, schritte: [], wartet: ende };
      case 'ab': return kn.ms <= jetzt ? { n: 0, schritte: [], wartet: null } : { n: 0, schritte: [], wartet: kn.ms };
      case 'warte':
        z = stufeZeit(R.T, kn.einheit, kn.stufe); ende = z + (R.ohneWartezeit ? 0 : kn.stunden * STUNDE);
        if (ende <= jetzt) return { n: 0, schritte: [], wartet: null };
        if (z <= jetzt) return { n: 0, schritte: [], wartet: ende };
        w = weg(R, S, kn.einheit, kn.stufe, neu());
        return w ? { n: w.n, schritte: w.schritte, wartet: null } : null;
      default: return null;
    }
  }

  function fortschritt(R, S, id) {
    var K = R.K, jetzt = R.jetzt, mem = K.members[id];
    if (!mem.length) return null;
    var stufe = S.stufe[id], ziel = stufe >= R.bis ? R.bis : stufe + 1;
    var f = { ziel: ziel, kritisch: { da: 0, von: 0 }, wesentlich: { da: 0, braucht: 0, von: 0 }, optional: { da: 0, von: 0 } };
    mem.forEach(function (m) {
      var g = K.by[m].gewicht, da = stufeZeit(R.T, m, ziel) <= jetzt ? 1 : 0, z = g === 'kritisch' ? f.kritisch : (g === 'wesentlich' ? f.wesentlich : f.optional);
      z.von++; z.da += da;
    });
    f.wesentlich.braucht = brauchtVon(K, f.wesentlich.von);
    return f;
  }

  function wiederkehrVon(R, id) {
    var W = R.K.wiederkehr;
    if (!W) return null;
    var t0 = stufeZeit(R.T, id, 2);
    if (!isFinite(t0)) return null;                                  // wiedersehen kann man erst, was man geübt hat (Auslegung A9)
    var zs = ereignisZeiten(R, id), prev = t0, idx = 0, n = W.abstaende.length;
    for (var i = 0; i < zs.length && idx < n; i++) {
      var z = zs[i];
      if (z <= t0) continue;
      if (z >= prev + W.abstaende[idx] * TAG) idx++;
      prev = z;
    }
    if (idx >= n) return { schritt: n, von: n, faellig: false, faellig_am: null, eingeloest: true, _am: INF };
    var due = prev + W.abstaende[idx] * TAG;
    return { schritt: idx, von: n, faellig: due <= R.jetzt, faellig_am: isoZeit(due), eingeloest: false, _am: due };
  }

  function letzteZeit(R, id, cache) {
    if (id in cache) return cache[id];
    var m = -INF, ids = [id].concat(R.K.members[id].length ? nachfahren(R.K, id) : []);
    ids.forEach(function (x) { var q = R.alleZ[x] || []; for (var j = 0; j < q.length; j++) if (q[j] > m) m = q[j]; });
    cache[id] = m;
    return m;
  }

  /** "Was bringt es" bei einer Aufgabe, die keine Regel erfüllt: der Fortschritt in der übergeordneten Einheit. */
  function bringtWeiter(R, S, u, ziel) {
    var K = R.K;
    var eltern = u.eltern.filter(function (p) { return K.members[p].length; });
    var p = eltern.filter(function (e) { return S.offen[e]; })[0] || eltern[0];
    if (p) {
      var P = K.by[p], f = fortschritt(R, S, p), lvl = f.ziel;
      if (u.gewicht === 'optional') return 'Eine Nebenquest: Sie zählt nicht für ' + nenne(K, p) + ', bringt dir aber Übung.';
      if (ziel < lvl) return 'Damit kommt ' + mitArtikel(K, P.art) + ' ' + nenne(K, p) + ' in Gang.';
      var braucht = f.kritisch.von + f.wesentlich.braucht, da = f.kritisch.da + Math.min(f.wesentlich.da, f.wesentlich.braucht);
      var nach = S.stufe[u.id] >= lvl ? da : da + 1;
      if (nach >= braucht) return 'Danach ist ' + mitArtikel(K, P.art) + ' ' + nenne(K, p) + ' ' + partizip(K, P.art, lvl) + '.';
      return 'Damit kommt ' + mitArtikel(K, P.art) + ' ' + nenne(K, p) + ' einen Schritt weiter (' + nach + ' von ' + braucht + ').';
    }
    var sk = u.uebt.filter(function (s) { return K.by[s] && K.by[s].kann; })[0];
    if (sk) return 'Das übt: ' + K.by[sk].kann;
    return 'Ein Schritt weiter in ' + nenne(K, u.id) + '.';
  }

  /** Genau eine nächste Aufgabe (5.6): fällige Wiederkehr, sonst nächste Freischaltung, sonst nächste nach Gewicht. Dazu die laufenden Pausen. */
  function waehleAufgabe(R, S, wk, letzte) {
    var K = R.K, jetzt = R.jetzt, bis = R.bis, vgl = vergleicheAufgabe(R, S);
    R.vgl = vgl; R.letzte = letzte;
    function neueAufgabe(art, id, ziel, bringt, extra) {
      var u = K.by[id], a = { einheit: id, art: art, stufe: ziel, text: aufgabenText(K, u, ziel), bringt: bringt };
      if (u.adresse) a.adresse = u.adresse;
      for (var k in extra) a[k] = extra[k];
      return a;
    }
    // Regel-Kandidaten und Pausen zuerst rechnen: die Pausen braucht der Spielstand in jedem Fall
    var kand = [], wartet = [];
    K.regeln.forEach(function (r) {
      if (R.RZ[r.id] <= jetzt) return;
      var rel = r.ziele.filter(function (z) { var eig = INF; (K.regelVon[z] || []).forEach(function (q) { if (R.RZ[q.id] < eig) eig = R.RZ[q.id]; }); return eig > jetzt; });
      if (!rel.length) return;
      var c = kosten(R, S, r.wenn);
      if (!c) return;
      if (c.n === 0) { if (c.wartet !== null && isFinite(c.wartet) && !verborgenWirksam(R, S, rel[0], 0)) wartet.push({ einheit: rel[0], regel: r.id, bis: isoZeit(c.wartet), _t: c.wartet }); return; }
      var seen = neu(), sch = [];
      c.schritte.forEach(function (x) { if (!seen[x.einheit]) { seen[x.einheit] = true; sch.push(x); } });
      sch.sort(function (a, b) { return vgl(a.einheit, b.einheit); });
      kand.push({ r: r, c: c, ziel: rel[0], schritt: sch[0] });
    });
    wartet.sort(function (a, b) { return a._t - b._t || vergleiche(a.einheit, b.einheit); });
    wartet.forEach(function (w) { delete w._t; });
    kand.sort(function (a, b) { return a.c.n - b.c.n || vgl(a.schritt.einheit, b.schritt.einheit) || vergleiche(a.r.id, b.r.id); });

    // 1. fällige Wiederkehr, die am längsten fällige zuerst
    // (fällig nach der Wiederkehr oder verwittert nach 4.3: „die Einheit kann als Wiederkehr-Aufgabe erscheinen“; seit wann, entscheidet die Reihenfolge)
    var faellig = [], inFuer = null;
    if (K.wiederkehr) { inFuer = neu(); K.wiederkehr.fuer.forEach(function (x) { inFuer[x] = true; }); }
    K.list.forEach(function (u) {
      if (!S.offen[u.id]) return;
      var w = wk[u.id], seit = w && w.faellig ? w._am : null;
      if (K.verfall && S.stufe[u.id] >= 1 && (!inFuer || inFuer[u.id])) {
        var l = letzteZeit(R, u.id, letzte);
        if (isFinite(l) && jetzt - l > K.verfall * TAG) seit = seit === null ? l + K.verfall * TAG : Math.min(seit, l + K.verfall * TAG);
      }
      if (seit !== null) faellig.push({ id: u.id, am: seit });
    });
    faellig.sort(function (a, b) { return a.am - b.am || vergleiche(a.id, b.id); });
    for (var i = 0; i < faellig.length; i++) {
      var fu = K.by[faellig[i].id], ziel = null;
      if (aktionsfaehig(K, fu)) ziel = fu.id;
      else {
        var kandidaten = nachfahren(K, fu.id).filter(function (x) { return aktionsfaehig(K, K.by[x]) && S.offen[x]; });
        var beruehrt = kandidaten.filter(function (x) { return S.stufe[x] >= 1; });
        var pool = beruehrt.length ? beruehrt : kandidaten;
        pool.sort(function (a, b) { return letzteZeit(R, a, letzte) - letzteZeit(R, b, letzte) || vergleiche(a, b); });
        ziel = pool[0] || null;
      }
      if (!ziel) continue;
      var zu = K.by[ziel];
      var verb = (zu.art === 'erlebnis' || zu.art === 'werkzeug') ? 'Probier ' + nenne(K, ziel) + ' noch einmal aus.' : 'Geh ' + nenne(K, ziel) + ' noch einmal durch.';
      var br = fu.id === ziel ? 'So bleibt ' + nenne(K, ziel) + ' frisch.' : (fu.kann ? 'So bleibt frisch, was du kannst: ' + fu.kann : 'So bleibt ' + nenne(K, fu.id) + ' frisch.');
      var a1 = neueAufgabe('wiederkehr', ziel, S.stufe[ziel], br, { faellig: fu.id });
      a1.text = 'Wiedersehen: ' + verb;
      return { aufgabe: a1, wartet: wartet };
    }
    // 2. die Regel, der die nächste Stufe am nächsten bringt
    if (kand.length) {
      var k = kand[0], Z = K.by[k.ziel];
      var versteckt = verborgenWirksam(R, S, Z.id, 0);
      var einheitenIds = einzigartig(k.c.schritte.map(function (x) { return x.einheit; })), art = einheitlicheArt(K, einheitenIds);
      var rest = einheitenIds.length === 1 ? (k.c.n === 1 ? 'Danach geht ' : 'Noch ' + k.c.n + ' Schritte, dann geht ') : 'Noch ' + einheitenIds.length + ' ' + (art ? K.begriffe[art].pl : 'Einheiten') + ', dann geht ';
      var bringt = versteckt ? 'Danach geht etwas Neues auf.' : rest + mitArtikel(K, Z.art) + ' ' + nenne(K, Z.id) + ' auf.';
      return { aufgabe: neueAufgabe('regel', k.schritt.einheit, k.schritt.ziel, bringt, { regel: k.r.id, oeffnet: versteckt ? null : Z.id, noch: k.c.n, noch_einheiten: einheitenIds.length }), wartet: wartet };
    }
    // 3. die nächste nach Gewicht, Reihenfolge, Stufe: erst alles bis Stufe 2 (Hauptpfad), danach die höheren Stufen
    var offene = K.list.filter(function (u) { return aktionsfaehig(K, u) && S.offen[u.id]; }).map(function (u) { return u.id; });
    var ziel1 = Math.min(bis, 2);
    var rest = offene.filter(function (id) { return S.stufe[id] < ziel1; });
    if (!rest.length) rest = offene.filter(function (id) { return S.stufe[id] < bis; });
    rest.sort(vgl);
    if (rest.length) {
      var u0 = K.by[rest[0]], z0 = S.stufe[u0.id] + 1;
      return { aufgabe: neueAufgabe('weiter', u0.id, z0, bringtWeiter(R, S, u0, z0), {}), wartet: wartet };
    }
    return { aufgabe: null, wartet: wartet };
  }

  /* ------------------------------------------------------------------ *
   * Der Spielstand (Abschnitt 8)
   * ------------------------------------------------------------------ */

  function leseJetzt(jetzt) {
    if (jetzt === undefined || jetzt === null) return Date.now();
    var ms = zeitMs(jetzt);
    if (isNaN(ms)) throw new TypeError('Spielplan: jetzt ist kein Zeitpunkt: ' + jetzt);
    return ms;
  }

  /** Verborgen ist eine gesperrte Einheit, wenn sie es selbst sagt oder alle ihre Eltern gesperrt und verborgen sind. */
  function verborgenWirksam(R, S, id, tiefe) {
    var u = R.K.by[id];
    if (u.sichtbar === 'verborgen') return true;
    if (tiefe > 8 || !u.eltern.length) return false;
    return u.eltern.every(function (p) { return !S.offen[p] && verborgenWirksam(R, S, p, tiefe + 1); });
  }

  function fensterBilanz(R, freig, von, bis) {
    var K = R.K, ende = Math.min(bis - 1, R.jetzt);
    var aufgegangen = freig.filter(function (f) { return f._t >= von && f._t < bis; }).map(function (f) { return f.einheit; });
    var gestiegen = [];
    K.list.forEach(function (u) {
      var vor = isFinite(von) ? stufeBei(R.T[u.id], von - 1) : 0, nach = stufeBei(R.T[u.id], ende);
      if (nach > vor) gestiegen.push(u.id);
    });
    return { aufgegangen: aufgegangen, gestiegen: gestiegen };
  }

  function baueStand(R) {
    var K = R.K, jetzt = R.jetzt;
    var S = { stufe: neu(), offen: neu() };
    K.list.forEach(function (u) { S.stufe[u.id] = stufeBei(R.T[u.id], jetzt); S.offen[u.id] = R.O[u.id] <= jetzt; });
    R.S = S;
    var wk = neu(), letzte = neu();
    if (K.wiederkehr) K.wiederkehr.fuer.forEach(function (id) { var w = wiederkehrVon(R, id); if (w) wk[id] = w; });
    var A = waehleAufgabe(R, S, wk, letzte);

    // Freischaltungen (abgeleitet): jede Einheit, die eine Regel als Ziel nennt und jetzt offen ist
    var freig = [];
    K.list.forEach(function (u) {
      if (!u.gated || !isFinite(R.O[u.id]) || R.O[u.id] > jetzt) return;
      var rs = (K.regelVon[u.id] || []).slice().sort(function (a, b) { return nachZahl(R.RZ[a.id], R.RZ[b.id]) || vergleiche(a.id, b.id); });
      var r = rs[0];
      var text = r.enthuellung || (gross(mitArtikel(K, u.art)) + ' ' + nenne(K, u.id) + ' ist jetzt offen.');
      freig.push({ einheit: u.id, art: u.art, name: u.name, regel: r.id, am: isoZeit(R.O[u.id]), enthuellung: text, _t: R.O[u.id] });
    });
    freig.sort(function (a, b) { return a._t - b._t || vergleiche(a.einheit, b.einheit); });

    var einheiten = {}, neben = { erledigt: [], gesamt: 0 };
    K.list.forEach(function (u) {
      var id = u.id, e = { art: u.art, stufe: S.stufe[id], zugang: S.offen[id] ? 'offen' : 'gesperrt' };
      var l = letzteZeit(R, id, letzte);
      e.verwittert = !!(K.verfall && S.stufe[id] >= 1 && isFinite(l) && jetzt - l > K.verfall * TAG);
      e.faellig = !!(wk[id] && wk[id].faellig);
      if (isFinite(l)) e.letzte = isoZeit(l);
      if (S.offen[id]) {
        if (u.gated && isFinite(R.O[id])) e.seit = isoZeit(R.O[id]);
      } else {
        e.sichtbar = verborgenWirksam(R, S, id, 0) ? 'verborgen' : 'angedeutet';
        if (e.sichtbar === 'angedeutet') e.bedingung = 'Zum Öffnen: ' + (bedingungsKern(R, u, 0) || 'noch nicht freigeschaltet') + '.';
      }
      var f = fortschritt(R, S, id);
      if (f) e.fortschritt = f;
      if (wk[id]) e.wiederkehr = { schritt: wk[id].schritt, von: wk[id].von, faellig_am: wk[id].faellig_am, eingeloest: wk[id].eingeloest };
      if (u.gewicht === 'optional' && u.art !== 'gebiet') { neben.gesamt++; if (S.stufe[id] >= 2) neben.erledigt.push(id); }
      einheiten[id] = e;
    });

    var tn = R.takt.index(jetzt), rueck = null;
    if (tn >= 1) {
      var von = R.takt.start(tn), bis = R.takt.start(tn + 1);
      rueck = { takt: tn, von: isoZeit(von), bis: isFinite(bis) ? isoZeit(bis) : null };
      var b = fensterBilanz(R, freig, von, bis);
      rueck.aufgegangen = b.aufgegangen; rueck.gestiegen = b.gestiegen;
      if (tn > 1) {
        var v0 = R.takt.start(tn - 1), b0 = fensterBilanz(R, freig, v0, von);
        rueck.vorher = { takt: tn - 1, von: isoZeit(v0), bis: isoZeit(von), aufgegangen: b0.aufgegangen, gestiegen: b0.gestiegen };
      }
    }
    freig.forEach(function (f) { delete f._t; });

    return {
      format: FORMAT, plan: K.id, stand: isoTag(jetzt), jetzt: isoZeit(jetzt), takt: tn, bis: R.bis,
      einheiten: einheiten, freigeschaltet: freig, aufgabe: A.aufgabe, wartet: A.wartet, rueckblick: rueck, nebenquests: neben, ignoriert: R.ign
    };
  }

  /** Der Spielstand: reine Funktion von Plan, Ereignissen und jetzt (Abschnitt 1 und 8). */
  function spielstand(plan, ereignisse, jetzt, opts) {
    var K = kompiliere(plan);
    return baueStand(rechne(K, ereignisse, leseJetzt(jetzt), opts));
  }

  /** Die Freischaltungen eines Spielstands als Ereignisse der Kurzform (Verb freigeschaltet, 6.1). */
  function abgeleiteteEreignisse(stand, opts) {
    opts = opts || {};
    return ((stand && stand.freigeschaltet) || []).map(function (f) {
      var e = { wer: opts.wer, verb: 'freigeschaltet', objekt: f.einheit, zeit: f.am, app: opts.app, regel: f.regel };
      if (e.wer === undefined) delete e.wer;
      if (e.app === undefined) delete e.app;
      return e;
    });
  }

  /** Stufe der Wurzel (ohne in, Art gebiet oder episode); mehrere Wurzeln zählen wie ein Gebiet über sie (Sammel-Regel 4.1). */
  function wurzelStufe(plan, stand) {
    var K = kompiliere(plan);
    var wurzeln = K.list.filter(function (u) { return !u.eltern.length && (u.art === 'gebiet' || u.art === 'episode'); });
    if (!wurzeln.length || !stand || !stand.einheiten) return 0;
    var st = function (u) { return stand.einheiten[u.id] ? stand.einheiten[u.id].stufe : 0; };
    if (wurzeln.length === 1) return st(wurzeln[0]);
    var kr = wurzeln.filter(function (u) { return u.gewicht === 'kritisch'; }).map(st);
    var ws = wurzeln.filter(function (u) { return u.gewicht === 'wesentlich'; }).map(st).sort(function (a, b) { return b - a; });
    var k = brauchtVon(K, ws.length);
    var s = 4;
    kr.forEach(function (x) { if (x < s) s = x; });
    if (k > 0) s = Math.min(s, ws[k - 1]);
    return kr.length || ws.length ? s : 0;
  }

  /* ------------------------------------------------------------------ *
   * Prüfung (Abschnitt 10): formale Fehler, Verweise, Erreichbarkeit
   * ------------------------------------------------------------------ */

  /** Ereignisse, mit denen eine Einheit bis zur Stufe bis gespielt wäre (für die Erreichbarkeitsrechnung). */
  function volleEreignisse(id, bis, z) {
    var e = function (verb, extra) { var x = { verb: verb, objekt: id, zeit: z }; for (var k in extra) x[k] = extra[k]; return x; };
    if (bis <= 1) return [e('begonnen')];
    if (bis === 2) return [e('geschafft')];
    var a = e('angewendet', { beleg: { art: 'eigen', fall: 'a' } });
    return bis === 3 ? [a] : [a, e('angewendet', { beleg: { art: 'eigen', fall: 'b' } })];
  }

  /**
   * Wer kann überhaupt aufgehen? Spielt eine Person alles, was offen ist, bis zur höchsten vergebenen Stufe, und wartet sehr lange.
   * nurBlaetter: Sammel-Einheiten bekommen dabei keine direkten Ereignisse (nur aus ihrem Inhalt), siehe Auslegung A12.
   */
  function simuliere(K, nurBlaetter) {
    var t0 = Date.UTC(2030, 0, 1), jetzt = Date.UTC(2200, 0, 1), fertig = neu(), n = 0, ev = [], R = null;
    for (var runde = 0; runde < K.list.length + 4; runde++) {
      R = rechne(K, ev, jetzt, {});
      var neuer = false;
      for (var i = 0; i < K.list.length; i++) {
        var u = K.list[i];
        if (fertig[u.id] || !(R.O[u.id] <= jetzt)) continue;
        if (nurBlaetter && K.members[u.id].length) continue;
        fertig[u.id] = true; neuer = true;
        volleEreignisse(u.id, R.bis, isoZeit(t0 + (n++) * MINUTE)).forEach(function (e) { ev.push(e); });
      }
      if (!neuer) break;
    }
    return R;
  }

  function sammleBlaetter(kn, out) {
    if (kn.t === 'alle' || kn.t === 'eine' || kn.t === 'min') kn.von.forEach(function (c) { sammleBlaetter(c, out); });
    else out.push(kn);
    return out;
  }

  function findeZyklen(ids, kanten) {
    var zyklen = [], gesehen = neu(), schluessel = neu();
    function dfs(v, pfadListe, imPfad) {
      if (imPfad[v]) {
        var z = pfadListe.slice(pfadListe.indexOf(v)), key = z.slice().sort().join('|');
        if (!schluessel[key]) { schluessel[key] = true; zyklen.push(z.concat([v])); }
        return;
      }
      if (gesehen[v]) return;
      gesehen[v] = true; imPfad[v] = true; pfadListe.push(v);
      (kanten[v] || []).forEach(function (w) { dfs(w, pfadListe, imPfad); });
      pfadListe.pop(); imPfad[v] = false;
    }
    ids.forEach(function (id) { dfs(id, [], neu()); });
    return zyklen;
  }

  function imInZyklus(K, id) {
    var todo = (K.eltern[id] || []).slice(), s = neu();
    while (todo.length) { var p = todo.pop(); if (p === id) return true; if (s[p]) continue; s[p] = true; (K.eltern[p] || []).forEach(function (q) { todo.push(q); }); }
    return false;
  }

  function pruefe(plan) {
    var F = [], W = [], info = {};
    var K;
    try { K = kompiliere(plan); } catch (e) { return { fehler: ['Der Spielplan ist kein Objekt (erwartet: format, id, einheiten, regeln).'], warnungen: [], info: {} }; }
    var p = K.plan;
    function f(t) { F.push(t); }
    function w(t) { W.push(t); }

    // --- Kopf
    if (p.format === undefined) w('format fehlt (erwartet: ' + FORMAT + ').');
    else if (typeof p.format !== 'string' || p.format.indexOf('spielplan/') !== 0) f('format „' + p.format + '“ ist kein Spielplan-Format (erwartet: ' + FORMAT + ').');
    else if (p.format !== FORMAT) w('format ' + p.format + ' ist unbekannt; geprüft wird nach ' + FORMAT + '.');
    if (!istText(p.id)) f('id fehlt (der Spielplan braucht eine Kennung, nach der die Brücke ihren Speicher benennt).');
    else if (!/^[a-z0-9][a-z0-9\-]*$/.test(p.id)) w('id „' + p.id + '“: besser nur Kleinbuchstaben, Ziffern und Bindestriche.');
    if (!istText(p.name)) w('name fehlt.');
    if (!istText(p.basis)) w('basis fehlt: ohne sie lassen sich Einheiten nicht als Adressen nach xAPI übersetzen (6.3).');
    else if (!/^[a-z][a-z0-9+.\-]*:/i.test(p.basis)) f('basis „' + p.basis + '“ ist keine Adresse (IRI).');
    if (p.vokabular !== undefined && !(istText(p.vokabular) && /^[a-z][a-z0-9+.\-]*:\S*[\/:]$/i.test(p.vokabular))) f('vokabular muss eine Adresse (IRI) sein, die mit „/“ oder „:“ endet.');
    if (p.nur_lokal !== undefined && typeof p.nur_lokal !== 'boolean') f('nur_lokal muss true oder false sein.');

    // --- formale Meldungen des Kompilierens (unbekannte ids, Bedingungen, Rhythmus …)
    K.meld.forEach(function (m) { (m.ebene === 'fehler' ? f : w)(m.text); });

    // --- Einheiten
    var zahl = {}; ARTEN.forEach(function (a) { zahl[a] = 0; });
    var verborgen = 0, ungewoehnlich = neu();
    K.list.forEach(function (u) {
      var r = u.roh, wo = 'Einheit ' + u.id + ': ';
      if (ARTEN.indexOf(u.art) < 0) f(wo + 'art „' + u.art + '“ unbekannt (erlaubt: ' + ARTEN.join(', ') + ').'); else zahl[u.art]++;
      if (!ID_MUSTER.test(u.id)) f(wo + 'id darf nur Kleinbuchstaben, Ziffern, - und / enthalten (3).');
      else if (ARTEN.indexOf(u.art) >= 0 && u.id.split('/')[0] !== u.art) w(wo + 'die id beginnt üblicherweise mit der Art („' + u.art + '/…“).');
      if (!istText(r.name)) f(wo + 'name fehlt.');
      if (u.art === 'skill') {
        if (!u.kann) f(wo + 'skill ohne kann: das Pflichtfeld „Ich kann …“ fehlt (3.1).');
        else if (!/^Ich kann\b/.test(u.kann)) w(wo + 'kann beginnt nicht mit „Ich kann“ (3.1).');
      } else if (r.kann !== undefined) w(wo + 'kann gehört nur an skill (3.1).');
      if (u.art === 'episode') {
        if (r.etappe === undefined) w(wo + 'episode ohne etappe (3.3: ' + ETAPPEN.join(', ') + ').');
        else if (ETAPPEN.indexOf(r.etappe) < 0) f(wo + 'etappe „' + r.etappe + '“ unbekannt (erlaubt: ' + ETAPPEN.join(', ') + ').');
      } else if (r.etappe !== undefined) w(wo + 'etappe gehört nur an episode (3.1).');
      if (u.art === 'quest') {
        if (r.staerke === undefined) w(wo + 'quest ohne staerke (1 bis 3, 3.1).');
        else if ([1, 2, 3].indexOf(r.staerke) < 0) f(wo + 'staerke „' + r.staerke + '“ muss 1, 2 oder 3 sein.');
      } else if (r.staerke !== undefined) w(wo + 'staerke gehört nur an quest (3.1).');
      if (u.art === 'werkzeug') {
        if (r.sorte !== undefined && SORTEN.indexOf(r.sorte) < 0) w(wo + 'sorte „' + r.sorte + '“ gehört nicht zu den vorgesehenen Sorten (' + SORTEN.join(', ') + ')' + (r.sorte === 'baustein' ? '; „baustein“ nennt nur der Standard-Entwurf (Absatz unter der Artentabelle in 3)' : '') + '. Die Sorte ändert nichts an der Rechnung.');
      } else if (r.sorte !== undefined) w(wo + 'sorte gehört nur an werkzeug (3).');
      if (u.art === 'gebiet' && r.gewicht !== undefined) w(wo + 'gewicht gilt nicht für gebiet (3.1).');
      if (u.uebt.length && ['quest', 'erlebnis', 'inhalt', 'episode'].indexOf(u.art) < 0) w(wo + 'uebt ist für quest, erlebnis, inhalt und episode vorgesehen (3.1).');
      if (r.braucht !== undefined && u.art !== 'quest') w(wo + 'braucht ist nach 3.1 nur für quest vorgesehen; es wird trotzdem gerechnet.');
      if (r.nach !== undefined && ['episode', 'quest', 'erlebnis'].indexOf(u.art) < 0) w(wo + 'nach ist für episode, quest und erlebnis vorgesehen (3.1).');
      if ((r.auftakt !== undefined || r.abschluss !== undefined) && u.art !== 'episode' && u.art !== 'gebiet') w(wo + 'auftakt und abschluss sind für episode und gebiet vorgesehen (3.1).');
      ['auftakt', 'abschluss', 'adresse', 'aufgabe'].forEach(function (k) { if (r[k] !== undefined && !istText(r[k]) && !(k === 'aufgabe' && istObj(r[k]))) f(wo + k + ' muss ein Text sein.'); });
      if (r.material !== undefined && !(Array.isArray(r.material) && r.material.every(istText))) f(wo + 'material muss eine Liste von Verweisen (Texten) sein.');
      if (r.reihenfolge !== undefined && !istZahl(r.reihenfolge)) f(wo + 'reihenfolge muss eine Zahl sein.');
      if (imInZyklus(K, u.id)) f(wo + 'in führt im Kreis zurück zu sich selbst.');
      u.eltern.forEach(function (pid) { var pa = K.by[pid].art; if (pa !== 'episode' && pa !== 'gebiet') (ungewoehnlich[pid] = ungewoehnlich[pid] || []).push(u.id); });
      if (r.sichtbar !== undefined) {
        if (!u.gated && !u.eltern.length) w(wo + 'sichtbar hat keine Wirkung: keine Regel nennt die Einheit, sie ist nie gesperrt.');
        if (u.sichtbar === 'verborgen') verborgen++;
      }
      if (r.gewicht === 'optional' && u.art === 'skill') w(wo + 'gewicht optional an einem skill: der Skill zählt nicht, wenn er selbst Mitglied einer Sammlung ist.');
    });

    Object.keys(ungewoehnlich).sort().forEach(function (pid) {
      var l = ungewoehnlich[pid];
      w('Einheit ' + pid + ' (Art ' + K.by[pid].art + ') enthält ' + l.length + ' Einheit(en) (' + l.slice(0, 3).join(', ') + (l.length > 3 ? ', …' : '') + '); üblich sind episode und gebiet als übergeordnete Einheit (3.1). Gerechnet wird trotzdem.');
    });
    // --- Sammel-Einheiten
    K.list.forEach(function (u) {
      var wo = 'Einheit ' + u.id + ': ';
      if (u.art !== 'episode' && u.art !== 'gebiet' && u.art !== 'skill') return;
      var mem = K.members[u.id];
      if (!mem.length) { w(wo + 'Sammel-Einheit ohne Inhalt (nichts liegt in ihr' + (u.art === 'skill' ? ' und nichts übt sie' : '') + '): ihre Stufe kommt nur aus direkten Ereignissen.'); return; }
      var kr = 0, ws = 0;
      mem.forEach(function (m) { var g = K.by[m].gewicht; if (g === 'kritisch') kr++; else if (g === 'wesentlich') ws++; });
      if (!kr && !ws) w(wo + 'enthält nur optionale Einheiten (Nebenquests): ihre Stufe steigt nie aus dem Inhalt (3.2, 4.1).');
      if (u.art === 'episode' && u.roh.etappe === 'endgame' && !mem.some(function (m) { return K.by[m].art === 'quest' && K.by[m].staerke === 3; })) w(wo + 'etappe endgame ohne Quest der Stärke 3 darin (3.3).');
      if (u.art === 'episode' && u.roh.etappe === 'onboarding' && !mem.some(function (m) { return K.by[m].art === 'quest' && K.by[m].staerke === 1; })) w(wo + 'etappe onboarding ohne Quest der Stärke 1 darin (3.3: kurzer Einstieg mit schneller Belohnung).');
    });
    if (K.list.length && verborgen * 3 > K.list.length) w('mehr als ein Drittel der Einheiten ist verborgen (' + verborgen + ' von ' + K.list.length + '): Grundsatz 5 sagt, Gesperrtes ist angedeutet; nur Überraschungen bleiben ganz verborgen.');
    if (K.anteil.zahl > 0.66 && K.anteil.zahl < 0.68 && !K.anteil.exakt) w('stufen.anteil ' + K.anteil.zahl + ' ist nicht zwei Drittel: bei 3 wesentlichen Einheiten verlangt er 3 statt 2. Schreibe "2/3" oder lass das Feld weg.');

    // --- Erreichbarkeit
    var sim = simuliere(K, false), simB = simuliere(K, true), jetzt = Date.UTC(2200, 0, 1), bis = sim ? sim.bis : K.bis;
    var nie = [], nurDirekt = [];
    if (sim) {
      K.list.forEach(function (u) { if (!(sim.O[u.id] <= jetzt)) nie.push(u.id); else if (simB && !(simB.O[u.id] <= jetzt)) nurDirekt.push(u.id); });
      var niemals = neu(); nie.forEach(function (id) { niemals[id] = true; });
      // Ursachen: gesperrt durch eigene Regeln, die selbst nach der Simulation nicht aufgehen
      var wurzel = nie.filter(function (id) { var u = K.by[id]; return u.gated && (K.regelVon[id] || []).every(function (r) { return !(sim.RZ[r.id] <= jetzt); }); });
      var kanten = neu();
      wurzel.forEach(function (id) {
        var ziele = [];
        (K.regelVon[id] || []).forEach(function (r) { sammleBlaetter(r.wenn, []).forEach(function (b) { (b.t === 'b' ? b.match : (b.t === 'warte' ? [b.einheit] : [])).forEach(function (x) { if (niemals[x]) ziele.push(x); }); }); });
        K.by[id].eltern.forEach(function (x) { if (niemals[x]) ziele.push(x); });
        kanten[id] = einzigartig(ziele);
      });
      var zyklen = findeZyklen(wurzel, kanten), imKreis = neu();
      zyklen.forEach(function (z) { z.forEach(function (x) { if (!imKreis[x]) imKreis[x] = 'Zyklus ohne Einstieg: ' + z.join(' → ') + ' (jede dieser Einheiten wird erst nach einer anderen offen, 5.3)'; }); });
      wurzel.forEach(function (id) {
        var u = K.by[id], gruende = imKreis[id] ? [imKreis[id]] : [];
        (K.regelVon[id] || []).forEach(function (r) {
          sammleBlaetter(r.wenn, []).forEach(function (b) {
            if (b.t === 'b') {
              if (b.stufe > bis) gruende.push('Regel ' + r.id + ' verlangt Stufe ' + b.stufe + ', dieses Angebot vergibt höchstens Stufe ' + bis + ' (stufen.bis)');
              var tot = b.match.filter(function (x) { return niemals[x]; });
              if (tot.length && (b.mindestens === 'alle' ? tot.length > 0 : b.match.length - tot.length < b.mindestens)) gruende.push('Regel ' + r.id + ' hängt von ' + tot.slice(0, 3).join(', ') + (tot.length > 3 ? ' und ' + (tot.length - 3) + ' weiteren' : '') + ' ab, die nie aufgehen');
              else if (!tot.length && b.stufe <= bis && b.match.length && !(stufeZeit(sim.T, b.match[0], b.stufe) < INF)) gruende.push('Regel ' + r.id + ': Stufe ' + b.stufe + ' an ' + b.match[0] + ' ist auch bei vollem Einsatz nicht erreichbar (Sammel-Einheit ohne erreichbare Mitglieder?)');
            } else if (b.t === 'takt' && !K.takt) gruende.push('Regel ' + r.id + ' wartet auf einen Takt, den es nicht gibt');
            else if (b.t === 'nie') gruende.push('Regel ' + r.id + ': ' + b.grund);
          });
        });
        f('Einheit ' + id + ': geht nie auf' + (gruende.length ? ' (' + einzigartig(gruende).join('; ') + ')' : ' (die Bedingung lässt sich im Spiel nie erfüllen)') + '.');
      });
      // kritische Einheiten, die nie aufgehen, blockieren ihre Sammlungen für immer (4.1)
      nie.forEach(function (id) {
        var u = K.by[id];
        if (u.gewicht !== 'kritisch') return;
        var sammlungen = u.eltern.concat(u.uebt.filter(function (x) { return K.by[x] && K.by[x].art === 'skill'; }));
        if (sammlungen.length) f('Einheit ' + id + ': kritisch, geht aber nie auf – kein Spieler kann ' + sammlungen.join(', ') + ' je über Stufe 0 bringen (4.1).');
      });
      // Folgen: ohne eigene Sperre, nur weil ein Elter nie aufgeht
      var folge = nie.filter(function (id) { return wurzel.indexOf(id) < 0; });
      if (folge.length) {
        var einzel = folge.filter(function (id) { return !K.by[id].eltern.some(function (x) { return niemals[x]; }); });
        einzel.forEach(function (id) { f('Einheit ' + id + ': geht nie auf (sie ist nicht gesperrt, aber ihre Bedingung oder ihr Elter ist unerreichbar).'); });
        var viele = folge.filter(function (id) { return einzel.indexOf(id) < 0; });
        if (viele.length) w(viele.length + ' weitere Einheiten gehen nur deshalb nie auf, weil ihre übergeordnete Einheit nie aufgeht (zuerst die obigen Fehler beheben): ' + viele.slice(0, 6).join(', ') + (viele.length > 6 ? ' …' : '') + '.');
      }
      if (nurDirekt.length) w(nurDirekt.length + ' Einheit(en) gehen nur auf, wenn direkt an einer Sammel-Einheit (episode, gebiet, skill) gemeldet wird, nicht aus deren Inhalt: ' + nurDirekt.slice(0, 5).join(', ') + (nurDirekt.length > 5 ? ' …' : '') + '. Prüfe, ob der Inhalt der Sammel-Einheit fehlt oder zu streng gewichtet ist.');
    }
    info.einheiten = K.list.length; info.regeln = K.regeln.length; info.arten = zahl; info.verborgen = verborgen;
    info.nieAufgehend = nie.length; info.stufenBis = bis; info.kurzformen = K.regeln.filter(function (r) { return r.kurz; }).length;
    var doppelt = neu();
    function ohneDoppelte(a) { return a.filter(function (x) { if (doppelt[x]) return false; doppelt[x] = true; return true; }); }
    F = ohneDoppelte(F); doppelt = neu(); W = ohneDoppelte(W);
    return { fehler: F, warnungen: W, info: info };
  }

  /* ------------------------------------------------------------------ *
   * Übersetzung nach xAPI (6.3): rein, ohne Netzwerk. Die Seite sendet damit nichts.
   * ------------------------------------------------------------------ */

  /** 128 Bit aus einem Text: fest, ohne Zufall (für gleiche Statement-ids bei gleichem Ereignis, damit Nachreichen nichts doppelt macht). */
  function hash128(str) {
    var h = [0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344], m = [0x01000193, 0x9e3779b1, 0x85ebca6b, 0xc2b2ae35], i, j;
    for (i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      for (j = 0; j < 4; j++) { h[j] = Math.imul(h[j] ^ (c + j * 131), m[j]); h[j] ^= h[j] >>> 15; }
    }
    for (j = 0; j < 4; j++) h[j] ^= h[(j + 1) & 3] >>> 7;
    var hex = '';
    for (j = 0; j < 4; j++) {
      var x = h[j]; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); x ^= x >>> 16;
      hex += ('00000000' + (x >>> 0).toString(16)).slice(-8);
    }
    return hex;
  }
  function uuidAus(text) {
    var h = hash128(text);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-5' + h.slice(13, 16) + '-' + '89ab'.charAt(parseInt(h.charAt(16), 16) & 3) + h.slice(17, 20) + '-' + h.slice(20, 32);
  }
  function dauerIso(sek) {
    sek = Math.round(sek);
    var h = Math.floor(sek / 3600), m = Math.floor((sek % 3600) / 60), s = sek % 60;
    return 'PT' + (h ? h + 'H' : '') + (m ? m + 'M' : '') + (s || (!h && !m) ? s + 'S' : '');
  }

  /**
   * Ein Ereignis der Kurzform als xAPI-Statement (6.3).
   * opts: { homePage, activityId, registration (UUID), actor (fertiger Actor, z. B. aus cmi5), kontext (z. B. cmi5-contextTemplate), id,
   *         vokabular (Wurzel der Adressen für eigene Verben, Erweiterungen und Arten; sonst plan.vokabular, sonst urn:spielplan:) }
   * Wirft TypeError bei unbrauchbaren Ereignissen (kein Verb, kein objekt, keine Zeit, kein wer).
   */
  function nachXapi(e, plan, opts) {
    opts = opts || {};
    var K = kompiliere(plan);
    if (!istObj(e) || typeof e.verb !== 'string' || !hat(VERBEN, e.verb)) throw new TypeError('nachXapi: unbekanntes Verb');
    if (!istText(e.objekt)) throw new TypeError('nachXapi: objekt fehlt');
    var z = zeitMs(e.zeit);
    if (isNaN(z)) throw new TypeError('nachXapi: zeit fehlt oder ist nicht lesbar');
    if (!istText(e.wer) && !opts.actor) throw new TypeError('nachXapi: wer fehlt');
    var basis = istText(K.plan.basis) ? K.plan.basis : 'urn:spielplan:' + (K.id || 'plan') + ':';
    if (/^https?:/i.test(basis) && basis.slice(-1) !== '/') basis += '/';
    function iri(id) { return basis + id; }
    var wurzel = istText(opts.vokabular) ? opts.vokabular : (istText(K.plan.vokabular) ? K.plan.vokabular : SP_IRI), EXT = wurzel + 'ext/';
    var verbId = VERBEN[e.verb].indexOf(SP_IRI) === 0 ? wurzel + VERBEN[e.verb].slice(SP_IRI.length) : VERBEN[e.verb];   // nur die eigenen Verben liegen im Vokabular
    var u = K.by[e.objekt];
    var s = {
      actor: opts.actor || { objectType: 'Agent', account: { homePage: opts.homePage || (istText(K.plan.basis) ? K.plan.basis : basis), name: String(e.wer) } },
      verb: { id: verbId, display: { de: e.verb } },
      object: { objectType: 'Activity', id: iri(e.objekt) }
    };
    if (u) {
      s.object.definition = { name: { de: u.name } };
      if (u.art) s.object.definition.type = wurzel + 'arten/' + u.art;
    }
    var res = {}, er = istObj(e.ergebnis) ? e.ergebnis : {};
    if (e.verb === 'geschafft' || e.verb === 'bestanden') res.completion = true;
    if (e.verb === 'bestanden') res.success = true;
    if (typeof er.erfolg === 'boolean') res.success = er.erfolg;
    if (istZahl(er.punkte)) {
      res.score = { raw: er.punkte };
      if (istZahl(er.max) && er.max > 0 && er.punkte >= 0 && er.punkte <= er.max) { res.score.min = 0; res.score.max = er.max; res.score.scaled = er.punkte / er.max; }
    }
    if (istZahl(er.dauer_s) && er.dauer_s >= 0) res.duration = dauerIso(er.dauer_s);
    if (istObj(e.beleg)) {
      var b = {};
      ['art', 'quelle', 'fall'].forEach(function (k) { if (istText(e.beleg[k])) b[k] = e.beleg[k]; });
      if (Object.keys(b).length) { res.extensions = {}; res.extensions[EXT + 'beleg'] = b; }
    }
    if (Object.keys(res).length) s.result = res;
    var ctx = { contextActivities: { grouping: [{ objectType: 'Activity', id: opts.activityId || basis }] } };
    if (u && u.eltern.length) ctx.contextActivities.parent = [{ objectType: 'Activity', id: iri(u.eltern[0]) }];
    if (opts.registration) ctx.registration = opts.registration;
    var ext = {};
    if (textListe(e.mit).length) ext[EXT + 'mit'] = textListe(e.mit).map(iri);
    if (istText(e.app)) ext[EXT + 'app'] = e.app;
    if (istText(e.regel)) ext[EXT + 'regel'] = e.regel;
    if (Object.keys(ext).length) ctx.extensions = ext;
    if (istObj(opts.kontext)) {                                       // z. B. cmi5-contextTemplate: Erweiterungen und Aktivitäten ergänzen
      var kt = opts.kontext;
      if (istObj(kt.extensions)) { ctx.extensions = ctx.extensions || {}; Object.keys(kt.extensions).forEach(function (k) { ctx.extensions[k] = kt.extensions[k]; }); }
      if (istObj(kt.contextActivities)) Object.keys(kt.contextActivities).forEach(function (k) { ctx.contextActivities[k] = liste(ctx.contextActivities[k]).concat(liste(kt.contextActivities[k])); });
    }
    s.context = ctx;
    s.timestamp = new Date(z).toISOString();
    s.id = opts.id || uuidAus(JSON.stringify([e.wer || '', e.verb, e.objekt, s.timestamp, e.app || '', textListe(e.mit), e.ergebnis || null, e.beleg || null, e.regel || null]));
    return s;
  }

  /* ------------------------------------------------------------------ *
   * Die Brücke (Abschnitt 7): nur der Speicher "lokal" gehört dazu. Adapter (xAPI, SCORM) hängen sich über
   * speicher: [ 'lokal', adapter ] an; sie liegen in spielplan-adapter.js, das die Seite nicht lädt.
   * ------------------------------------------------------------------ */

  var global = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});

  function kennung(x, max) {
    if (typeof x === 'number' && isFinite(x)) x = String(x);
    if (typeof x !== 'string') return null;
    x = x.trim().toLowerCase();
    return x.length >= 1 && x.length <= max && /^[a-z0-9][a-z0-9_\-:.\/]*$/.test(x) ? x : null;
  }
  function bereinigeBeleg(b, fall) {
    if (!istObj(b) || BELEG_ARTEN.indexOf(b.art) < 0) return { beleg: null };
    var o = { art: b.art }, hinweis = '';
    if (b.quelle !== undefined) { var q = kennung(b.quelle, 120); if (q) o.quelle = q; else hinweis = 'beleg.quelle ist keine Kennung (erlaubt: a-z, 0-9, - _ : . /, höchstens 120 Zeichen) und wurde weggelassen'; }
    var f = fall !== undefined ? fall : b.fall;
    if (f !== undefined) { var k = kennung(f, 64); if (k) o.fall = k; else hinweis = 'fall ist keine Kennung (erlaubt: a-z, 0-9, - _ : . /, höchstens 64 Zeichen, keine Namen) und wurde weggelassen; ohne fall gibt es keinen Transfer (Stufe 4)'; }
    return { beleg: o, hinweis: hinweis };
  }
  function bereinigeErgebnis(er) {
    if (!istObj(er)) return null;
    var o = {};
    ['dauer_s', 'punkte', 'max'].forEach(function (k) { if (istZahl(er[k]) && er[k] >= 0) o[k] = er[k]; });
    if (typeof er.erfolg === 'boolean') o.erfolg = er.erfolg;
    return Object.keys(o).length ? o : null;
  }
  function neueKennung() {
    var hex = '';
    try { var a = new Uint32Array(1); (global.crypto || global.msCrypto).getRandomValues(a); hex = a[0].toString(16); } catch (e) { hex = ''; }
    if (!hex) hex = Math.floor(Math.random() * 4294967296).toString(16);
    return 'lokal:' + ('00000000' + hex).slice(-8);
  }

  function verbinde(opt) {
    if (!istObj(opt)) throw new TypeError('verbinde: Optionen fehlen ({ plan, app, speicher })');
    var K = kompiliere(opt.plan);
    var app = istText(opt.app) ? opt.app : (K.id ? 'app/' + K.id : 'app');
    var praefix = typeof opt.praefix === 'string' ? opt.praefix : 'gm:sp:';
    var ns = praefix + (K.id || 'plan') + ':';
    var jetztFn = typeof opt.jetzt === 'function' ? opt.jetzt : (opt.jetzt !== undefined ? function () { return opt.jetzt; } : function () { return new Date().toISOString(); });

    var sp = { plan: K.plan, app: app, wer: '', speicher: 'arbeitsspeicher', letzterFehler: '', verweigert: [], adapter: [], fehlerSpeicher: '' };
    var ev = [], gesehen = neu(), handler = neu(), version = 0, cache = { v: -1, s: null, sek: -1 }, aufraeumen = [];

    // --- Speicher: Arbeitsspeicher immer, localStorage wenn gewünscht und erreichbar; jeder Zugriff in try/catch
    var arten = liste(opt.speicher === undefined ? 'lokal' : opt.speicher);
    var wollLokal = arten.indexOf('lokal') >= 0;
    function lager() { try { return opt.lager || (global.localStorage || null); } catch (e) { return null; } }
    function leseLager(k) { try { var l = wollLokal ? lager() : null; if (!l) return undefined; var v = l.getItem(ns + k); return v === null || v === undefined ? undefined : v; } catch (e) { sp.fehlerSpeicher = 'lesen: ' + (e && e.message); return undefined; } }
    function schreibeLager(k, v) {
      if (!wollLokal) return;
      try { var l = lager(); if (!l) { sp.speicher = 'arbeitsspeicher'; return; } if (v === null) l.removeItem(ns + k); else l.setItem(ns + k, v); sp.speicher = 'lokal'; }
      catch (e) { sp.speicher = 'arbeitsspeicher'; sp.fehlerSpeicher = 'schreiben: ' + (e && e.message); }
    }
    function parseListe(txt) {
      try { var a = JSON.parse(txt); return Array.isArray(a) ? a.filter(function (x) { return istObj(x) && typeof x.verb === 'string' && typeof x.objekt === 'string' && typeof x.zeit === 'string'; }) : []; }
      catch (e) { return []; }
    }
    function laden() {
      var t = leseLager('ereignisse'); ev = t === undefined ? [] : parseListe(t);
      var g = leseLager('gesehen'); gesehen = neu();
      if (g !== undefined) { try { var arr = JSON.parse(g); if (Array.isArray(arr)) arr.forEach(function (x) { if (typeof x === 'string') gesehen[x] = true; }); } catch (e) { /* leer */ } }
      version++;
    }
    function sichern() { schreibeLager('ereignisse', JSON.stringify(ev)); }
    function sichereGesehen() { schreibeLager('gesehen', JSON.stringify(Object.keys(gesehen))); }
    laden();
    var w0 = leseLager('wer');
    sp.wer = typeof w0 === 'string' && /^[\w:.\-]{3,64}$/.test(w0) ? w0 : neueKennung();
    if (w0 !== sp.wer) schreibeLager('wer', sp.wer);
    else if (wollLokal && lager()) sp.speicher = 'lokal';

    // --- Adapter
    arten.forEach(function (a) {
      if (a === 'lokal') return;
      if (K.plan.nur_lokal === true) { sp.verweigert.push((typeof a === 'string' ? a : (istObj(a) ? (a.adapter || a.name || 'adapter') : 'adapter')) + ': der Spielplan setzt nur_lokal (7.2)'); return; }
      var ad = a;
      if (typeof a === 'string' || (istObj(a) && typeof a.adapter === 'string' && typeof a.melde !== 'function')) {
        var spec = typeof a === 'string' ? { adapter: a } : a, fabrik = global.Spielplan && global.Spielplan.adapter && global.Spielplan.adapter[spec.adapter];
        if (typeof fabrik !== 'function') { sp.verweigert.push(spec.adapter + ': Adapter nicht geladen (spielplan-adapter.js)'); return; }
        ad = fabrik(spec);
      }
      if (!istObj(ad)) return;
      sp.adapter.push(ad);
    });

    function hole(k) { return handler[k] || (handler[k] = []); }
    function senden(name, daten) {
      hole(name).slice().forEach(function (fn) { try { fn(daten); } catch (e) { /* ein Hörer darf die Brücke nicht stören */ } });
    }
    function anAdapter(fn) { sp.adapter.forEach(function (a) { try { fn(a); } catch (e) { /* Adapter fangen ihre Fehler selbst */ } }); }

    function berechne(t) {
      var ms = t === undefined ? zeitMs(jetztFn()) : zeitMs(t);
      if (isNaN(ms)) ms = Date.now();
      return spielstand(K, ev, ms, {});
    }
    sp.stand = function (t) {
      if (t !== undefined) return berechne(t);
      var sek = Math.floor(zeitMs(jetztFn()) / 1000);
      if (cache.s && cache.v === version && cache.sek === sek) return cache.s;
      cache = { v: version, s: berechne(), sek: sek };
      return cache.s;
    };
    /** Der Eintrag einer Einheit im Spielstand (oder null für unbekannte ids): { stufe, zugang, bedingung, … }. */
    sp.einheit = function (id) { var e = sp.stand().einheiten[id]; return e || null; };
    sp.ereignisse = function () { return ev.map(function (e) { return JSON.parse(JSON.stringify(e)); }); };

    /** Neues im Spielstand an die Hörer und Adapter geben. */
    function meldeUnterschiede(vorher, nachher) {
      if (vorher) {
        Object.keys(nachher.einheiten).forEach(function (id) {
          var a = vorher.einheiten[id], b = nachher.einheiten[id];
          if (a && b.stufe > a.stufe) senden('stufe', { einheit: id, art: b.art, name: K.by[id] ? K.by[id].name : id, von: a.stufe, nach: b.stufe });
        });
      }
      var neuAuf = nachher.freigeschaltet.filter(function (f) { return !gesehen[f.einheit]; });         // je Einheit einmal, auch wenn spätere Ereignisse ihr „am“ nach vorn schieben
      if (neuAuf.length && hole('freigeschaltet').length) {
        neuAuf.forEach(function (f) { gesehen[f.einheit] = true; });
        sichereGesehen();
        neuAuf.forEach(function (f) { senden('freigeschaltet', f); });
      }
      anAdapter(function (a) { if (typeof a.stand === 'function') a.stand(nachher, sp); });
    }

    function fehler(text) { sp.letzterFehler = text; return null; }

    sp.melde = function (verb, objekt, o) {
      o = istObj(o) ? o : {};
      sp.letzterFehler = '';
      if (typeof verb !== 'string' || !hat(VERBEN, verb)) return fehler('Verb „' + verb + '“ unbekannt (erlaubt: ' + Object.keys(VERBEN).filter(function (v) { return v !== 'freigeschaltet'; }).join(', ') + ')');
      if (verb === 'freigeschaltet') return fehler('freigeschaltet schreibt nur der Spielstand, nie eine App (6.1)');
      if (!istText(objekt) || !K.by[objekt]) return fehler('objekt „' + objekt + '“ steht nicht im Spielplan');
      var z = o.zeit !== undefined ? zeitMs(o.zeit) : zeitMs(jetztFn());
      if (isNaN(z)) return fehler('zeit ist nicht lesbar');
      var e = { wer: sp.wer, verb: verb, objekt: objekt, zeit: isoZeit(z), app: app };
      var mit = textListe(o.mit).filter(function (x) { return K.by[x] && K.by[x].art === 'werkzeug' && x !== objekt; });
      if (mit.length) e.mit = einzigartig(mit);
      var er = bereinigeErgebnis(o.ergebnis); if (er) e.ergebnis = er;
      var bb = bereinigeBeleg(o.beleg, o.fall);
      if (bb.beleg) { e.beleg = bb.beleg; if (bb.hinweis) sp.letzterFehler = bb.hinweis; }
      // Doppelte (gleiches Ereignis binnen einer Minute) nicht noch einmal speichern
      var key = JSON.stringify([e.verb, e.objekt, e.mit || null, e.beleg || null]);
      for (var i = ev.length - 1; i >= 0 && i >= ev.length - 40; i--) {
        var x = ev[i];
        if (JSON.stringify([x.verb, x.objekt, x.mit || null, x.beleg || null]) === key && Math.abs(zeitMs(x.zeit) - z) < MINUTE) return x;
      }
      var vorher = sp.stand();
      ev.push(e);
      if (ev.length > 4000) verdichte();
      version++; cache = { v: -1, s: null, sek: -1 };
      sichern();
      senden('melde', e);
      anAdapter(function (a) { if (typeof a.melde === 'function') a.melde(e, sp); });
      meldeUnterschiede(vorher, sp.stand());
      return e;
    };

    /** Sehr lange Listen kürzen: von begonnen/erkundet je (Verb, Einheit) nur das erste und das letzte behalten. */
    function verdichte() {
      var erst = neu(), letzt = neu();
      ev.forEach(function (e, i) { var k = e.verb + '|' + e.objekt; if (!(k in erst)) erst[k] = i; letzt[k] = i; });
      ev = ev.filter(function (e, i) { if (e.verb !== 'begonnen' && e.verb !== 'erkundet') return true; var k = e.verb + '|' + e.objekt; return i === erst[k] || i === letzt[k]; });
    }

    sp.bei = function (name, fn) {
      if (typeof fn !== 'function') return function () {};
      hole(name).push(fn);
      return function () { var a = hole(name), i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
    };

    sp.aktualisiere = function () {
      var vorher = cache.s;
      cache = { v: -1, s: null, sek: -1 };
      var nachher = sp.stand();
      meldeUnterschiede(vorher, nachher);
      return nachher;
    };

    sp.importiere = function (liste2) {
      var vorher = sp.stand(), bekannt = neu(), neue = 0;
      ev.forEach(function (e) { bekannt[e.wer + '|' + e.verb + '|' + e.objekt + '|' + e.zeit] = true; });
      textlose(liste2).forEach(function (e) {
        var r = leseEreignis(K, e);
        if (!r.ok) return;
        var k = e.wer + '|' + e.verb + '|' + e.objekt + '|' + e.zeit;
        if (bekannt[k]) return;
        bekannt[k] = true; ev.push(e); neue++;
      });
      if (neue) { version++; cache = { v: -1, s: null, sek: -1 }; sichern(); meldeUnterschiede(vorher, sp.stand()); }
      return neue;
    };
    function textlose(l) { return Array.isArray(l) ? l.filter(istObj) : []; }

    sp.zuruecksetzen = function () {
      ev = []; gesehen = neu(); version++; cache = { v: -1, s: null, sek: -1 };
      schreibeLager('ereignisse', null); schreibeLager('gesehen', null); schreibeLager('wer', null);
      sp.wer = neueKennung(); schreibeLager('wer', sp.wer);
      anAdapter(function (a) { if (typeof a.zuruecksetzen === 'function') a.zuruecksetzen(sp); });
    };

    sp.horche = function (fenster, o) {
      o = o || {};
      var win = fenster || global;
      if (!win || typeof win.addEventListener !== 'function') return function () {};
      function h(ev2) {
        var d = ev2 && ev2.data;
        if (!istObj(d) || d.type !== 'sp:melde') return;
        if (typeof o.erlaubt === 'function') { if (!o.erlaubt(ev2)) return; }
        else {
          var eigen = ''; try { eigen = win.location && win.location.origin; } catch (e) { eigen = ''; }
          if (eigen && ev2.origin !== undefined && ev2.origin !== eigen) return;            // Standard: nur die eigene Herkunft (unter file:// "null" gegen "null")
        }
        sp.melde(d.verb, d.objekt, { mit: d.mit, ergebnis: d.ergebnis, beleg: d.beleg, fall: d.fall });
      }
      win.addEventListener('message', h);
      var ab = function () { try { win.removeEventListener('message', h); } catch (e) { /* egal */ } };
      aufraeumen.push(ab);
      return ab;
    };

    sp.trenne = function () { aufraeumen.forEach(function (f) { f(); }); aufraeumen = []; anAdapter(function (a) { if (typeof a.trenne === 'function') a.trenne(sp); }); };

    // andere Tabs: gleicher Speicher, neues Ereignis
    try {
      if (wollLokal && global.addEventListener && !opt.lager) {
        var sl = function (e2) { if (e2 && e2.key === ns + 'ereignisse') { laden(); cache = { v: -1, s: null, sek: -1 }; sp.aktualisiere(); } };
        global.addEventListener('storage', sl);
        aufraeumen.push(function () { global.removeEventListener('storage', sl); });
      }
    } catch (e) { /* ohne Fenster */ }

    anAdapter(function (a) { if (typeof a.verbinde === 'function') a.verbinde(sp); });
    return sp;
  }

  /* ------------------------------------------------------------------ *
   * Ausgabe
   * ------------------------------------------------------------------ */

  var API = {
    format: FORMAT, version: 0,
    spielstand: spielstand, verbinde: verbinde, pruefe: pruefe, nachXapi: nachXapi, abgeleiteteEreignisse: abgeleiteteEreignisse,
    kompiliere: kompiliere, wurzelStufe: wurzelStufe, zeitMs: zeitMs, isoZeit: isoZeit,
    STUFEN: STUFEN, BEREICHE: BEREICHE, ARTEN: ARTEN, SORTEN: SORTEN, ETAPPEN: ETAPPEN, GEWICHTE: GEWICHTE, VERBEN: VERBEN, BELEG_ARTEN: BELEG_ARTEN,
    adapter: (global.Spielplan && global.Spielplan.adapter) || {}
  };
  if (typeof window !== 'undefined') window.Spielplan = API;
  if (typeof module === 'object' && module && module.exports) module.exports = API;
})();

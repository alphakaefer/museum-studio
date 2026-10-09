/* ==========================================================================
   Spielplan – js/spielplan-adapter.js   (Stufe C des Standards: „spricht xAPI“; Abschnitt 7.1)

   NICHT Teil des Museums: tools/build.mjs bindet diese Datei nicht ein, die Seite sendet nichts.
   Sie beschreibt und testet die Schnittstelle (tools/spielplan-test.mjs, Mock-LRS und Attrappen-SCORM-API in Node) für den Tag,
   an dem eine Anwendung sie bewusst lädt, z. B. beim Start aus einem Lernsystem. Voraussetzung: spielplan.js ist geladen.

   Einbau (nur in einer Anwendung, die Daten senden darf):
     <script src="spielplan.js"></script><script src="spielplan-adapter.js"></script>
     var sp = Spielplan.verbinde({ plan: plan, app: 'kurs/x',
                                   speicher: ['lokal', { adapter: 'xapi', start: location.search }] });     // cmi5-Start aus einem Lernsystem
     var sp = Spielplan.verbinde({ plan: plan, app: 'kurs/x', speicher: ['lokal', { adapter: 'scorm' }] });   // SCORM 1.2 oder 2004
   Mit nur_lokal: true im Spielplan verweigert die Brücke beide (7.2).

   Spielplan.adapter.xapi(opt)    Learning Record Store. opt: start (Suchtext oder Objekt mit den cmi5-Startparametern endpoint, fetch, actor,
                                  registration, activityId) oder direkt endpoint, auth (Text oder Funktion), actor, registration, activityId;
                                  cmi5 (true: initialized/completed/terminated senden, contextTemplate aus LMS.LaunchData übernehmen),
                                  fetch (Ersatz für window.fetch), lager (localStorage-ähnlich, für die Warteschlange), version ('1.0.3'), stapel (50).
                                  Methoden: nachreichen() -> Promise<{gesendet, offen, verworfen}>, warteschlange(), beenden() -> Promise, bereit (Promise).
                                  Jedes Ereignis wird zuerst in die Warteschlange gelegt (lokal gespeichert) und dann gesendet. Fällt der LRS aus (Netzfehler,
                                  5xx, 408, 429, 401, 403), bleibt alles in der Warteschlange und wird beim nächsten Versuch nachgereicht (auch beim Ereignis „online“).
                                  Eine Statement-id ist ein Hash des Inhalts: Nachreichen legt nichts doppelt an (409 gilt als angekommen).
   Spielplan.adapter.scorm(opt)   SCORM 1.2 (API) und 2004 (API_1484_11). opt: fenster, version ('auto'|'1.2'|'2004'), grenze, wurzel.
                                  Sucht die API in parent und opener, Initialize, liest suspend_data und stellt den Spielstand daraus wieder her,
                                  setzt „completed“, wenn die Wurzel-Einheit Stufe 2 erreicht, schreibt kompakte suspend_data (SCORM 1.2: höchstens 4096
                                  Zeichen), committet. beenden() ruft LMSFinish bzw. Terminate.
   Spielplan.adapter.cmi5Start(suche)         die cmi5-Startparameter aus einem Suchtext lesen
   Spielplan.adapter.kompakt(plan, ereignisse, grenze) / entpacke(plan, text) / ereignisseAusStufen(plan, stufen, opts)   suspend_data (Formen E, X, S)
   ========================================================================== */
(function () {
  'use strict';

  var global = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var SP = global.Spielplan;
  if (!SP && typeof module === 'object' && module && module.exports && typeof require === 'function') { try { SP = require('./spielplan.js'); } catch (e) { SP = null; } }
  if (!SP) throw new Error('spielplan-adapter.js: spielplan.js muss zuerst geladen sein');
  SP.adapter = SP.adapter || {};

  var CMI5_KATEGORIE = 'https://w3id.org/xapi/cmi5/context/categories/cmi5';
  var V_INIT = 'http://adlnet.gov/expapi/verbs/initialized', V_TERM = 'http://adlnet.gov/expapi/verbs/terminated', V_DONE = 'http://adlnet.gov/expapi/verbs/completed';
  var MINUTE = 60000;

  function istObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function kopie(x) { return JSON.parse(JSON.stringify(x)); }
  function eigener(f) { return typeof f === 'function' ? f : null; }

  /* ------------------------------------------------------------------ *
   * cmi5-Startparameter
   * ------------------------------------------------------------------ */

  function cmi5Start(suche) {
    if (istObj(suche)) return kopie(suche);
    var out = {}, s = String(suche || '').replace(/^\?/, '');
    s.split('&').forEach(function (p) {
      if (!p) return;
      var i = p.indexOf('='), k = decodeURIComponent(i < 0 ? p : p.slice(0, i)), v = i < 0 ? '' : decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
      out[k] = v;
    });
    if (typeof out.actor === 'string') { try { out.actor = JSON.parse(out.actor); } catch (e) { delete out.actor; } }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * xAPI: Warteschlange, Nachreichen, Fetch
   * ------------------------------------------------------------------ */

  function xapi(opt) {
    opt = opt || {};
    var start = opt.start ? cmi5Start(opt.start) : {};
    var endpoint = opt.endpoint || start.endpoint || '';
    if (endpoint && endpoint.slice(-1) !== '/') endpoint += '/';
    var cmi5 = opt.cmi5 === true || (opt.cmi5 === undefined && !!start.registration);
    var cfg = {
      endpoint: endpoint, fetchUrl: opt.fetchUrl || start.fetch || '', auth: opt.auth || null, actor: opt.actor || start.actor || null,
      registration: opt.registration || start.registration || '', activityId: opt.activityId || start.activityId || '',
      version: opt.version || '1.0.3', stapel: opt.stapel > 0 ? opt.stapel : 50
    };
    var ad = { name: 'xapi', config: cfg, fehler: [], verworfen: [], bereit: Promise.resolve() };
    var sp = null, queue = [], gemeldet = {}, kontext = null, laeuft = null, nochmal = false, token = null, mem = {};
    var doFetch = eigener(opt.fetch) || (typeof global.fetch === 'function' ? global.fetch.bind(global) : (typeof fetch === 'function' ? fetch : null));

    function lager() { try { return opt.lager || global.localStorage || null; } catch (e) { return null; } }
    function key(k) { return (opt.praefix || 'gm:sp:') + (sp && sp.plan && sp.plan.id ? sp.plan.id : 'plan') + ':xapi:' + k; }
    function lies(k) { try { var l = lager(); var v = l ? l.getItem(key(k)) : null; if (v !== null && v !== undefined) return JSON.parse(v); } catch (e) { /* weiter */ } return mem[k]; }
    function schreibe(k, v) { mem[k] = v; try { var l = lager(); if (l) l.setItem(key(k), JSON.stringify(v)); } catch (e) { /* Speicher voll oder gesperrt: bleibt im Arbeitsspeicher */ } }
    function merke(text) { ad.fehler.push(text); if (ad.fehler.length > 20) ad.fehler.shift(); }

    function kopf(extra) {
      var h = { 'Content-Type': 'application/json', 'X-Experience-API-Version': cfg.version };
      if (token) h.Authorization = token;
      if (extra) for (var k in extra) h[k] = extra[k];
      return h;
    }

    /** Das cmi5-fetch: einmaliger Abruf eines Zugangstokens (POST ohne Inhalt, Antwort {"auth-token": …}). */
    function holeToken() {
      if (token) return Promise.resolve(token);
      var a = typeof cfg.auth === 'function' ? cfg.auth() : cfg.auth;
      return Promise.resolve(a).then(function (v) {
        if (v) { token = /^(Basic|Bearer) /i.test(v) ? v : 'Basic ' + v; return token; }
        if (!cfg.fetchUrl || !doFetch) return null;
        return doFetch(cfg.fetchUrl, { method: 'POST' }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); }).then(function (r) {
          var t = r.body && r.body['auth-token'];
          if (!r.ok || !t) { merke('fetch: kein Zugangstoken (Status ' + r.status + (r.body && r.body['error-text'] ? ', ' + r.body['error-text'] : '') + ')'); return null; }
          token = 'Basic ' + t; return token;
        });
      }).catch(function (e) { merke('fetch: ' + (e && e.message)); return null; });
    }

    /** cmi5: LMS.LaunchData lesen und contextTemplate übernehmen. */
    function holeStart() {
      if (!cmi5 || !doFetch || !endpoint || !cfg.actor || !cfg.activityId) return Promise.resolve();
      var url = endpoint + 'activities/state?stateId=' + encodeURIComponent('LMS.LaunchData') + '&activityId=' + encodeURIComponent(cfg.activityId) + '&agent=' + encodeURIComponent(JSON.stringify(cfg.actor)) + '&registration=' + encodeURIComponent(cfg.registration);
      return doFetch(url, { method: 'GET', headers: kopf() }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && istObj(j.contextTemplate)) kontext = j.contextTemplate; }).catch(function (e) { merke('LaunchData: ' + (e && e.message)); });
    }

    function opts() {
      var o = { homePage: undefined, activityId: cfg.activityId || undefined, registration: cfg.registration || undefined };
      if (cfg.actor) o.actor = cfg.actor;
      if (kontext) o.kontext = kontext;
      return o;
    }

    function einreihen(stmt) {
      for (var i = 0; i < queue.length; i++) if (queue[i].id === stmt.id) return false;
      queue.push(stmt); schreibe('warteschlange', queue); return true;
    }

    /** Ein Statement für ein Ereignis der Kurzform in die Warteschlange legen. */
    ad.melde = function (e) {
      var st;
      try { st = SP.nachXapi(e, sp.plan, opts()); } catch (err) { merke('nachXapi: ' + err.message); return null; }
      einreihen(st);
      ad.letzte = ad.nachreichen();
      return st;
    };

    function uuid4() {
      var h = '';
      try { var a = new Uint8Array(16); (global.crypto || global.msCrypto).getRandomValues(a); for (var i = 0; i < 16; i++) h += ('0' + a[i].toString(16)).slice(-2); }
      catch (e) { for (var k = 0; k < 32; k++) h += Math.floor(Math.random() * 16).toString(16); }
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-4' + h.slice(13, 16) + '-' + '89ab'.charAt(parseInt(h.charAt(16), 16) & 3) + h.slice(17, 20) + '-' + h.slice(20, 32);
    }
    /** Die drei cmi5-Statements des Lernmoduls (initialized, completed, terminated): id einmal vergeben, dann in der Warteschlange gespeichert. */
    function cmi5Statement(verbId, anzeige) {
      var basis = sp.plan.basis || 'urn:spielplan:' + (sp.plan.id || 'plan') + ':';
      var st = {
        id: uuid4(),
        actor: cfg.actor || { objectType: 'Agent', account: { homePage: basis, name: String(sp.wer) } },
        verb: { id: verbId, display: { 'en-US': anzeige } },
        object: { objectType: 'Activity', id: cfg.activityId || basis },
        context: { contextActivities: { category: [{ objectType: 'Activity', id: CMI5_KATEGORIE }] } },
        timestamp: new Date().toISOString()
      };
      if (cfg.registration) st.context.registration = cfg.registration;
      if (kontext) {
        if (istObj(kontext.extensions)) st.context.extensions = kopie(kontext.extensions);
        if (istObj(kontext.contextActivities)) Object.keys(kontext.contextActivities).forEach(function (k) { st.context.contextActivities[k] = (st.context.contextActivities[k] || []).concat(kontext.contextActivities[k]); });
      }
      if (verbId === V_DONE) st.result = { completion: true };
      return st;
    }

    /** Spielstand-Hook der Brücke: Freischaltungen als abgeleitete Ereignisse, completed bei Stufe 2 der Wurzel (cmi5). */
    ad.stand = function (stand) {
      if (!sp || !stand) return;
      SP.abgeleiteteEreignisse(stand, { wer: sp.wer, app: sp.app }).forEach(function (e) {
        var k = e.objekt + '@' + e.zeit;
        if (gemeldet[k]) return;
        gemeldet[k] = true; schreibe('gemeldet', gemeldet);
        ad.melde(e);
      });
      if (cmi5 && !gemeldet['cmi5:completed'] && SP.wurzelStufe(sp.plan, stand) >= 2) {
        gemeldet['cmi5:completed'] = true; schreibe('gemeldet', gemeldet);
        einreihen(cmi5Statement(V_DONE, 'completed'));
        ad.letzte = ad.nachreichen();
      }
    };

    ad.warteschlange = function () { return kopie(queue); };

    /** Alles Wartende senden. Gibt { gesendet, offen, verworfen } zurück; wirft nie. */
    ad.nachreichen = function () {
      if (laeuft) { nochmal = true; return laeuft; }
      var zaehler = { gesendet: 0, offen: 0, verworfen: 0 };
      laeuft = holeToken().then(function () {
        if (!endpoint || !doFetch) { zaehler.offen = queue.length; return zaehler; }
        function stapelSenden() {
          if (!queue.length) return Promise.resolve(zaehler);
          var teil = queue.slice(0, cfg.stapel);
          return doFetch(endpoint + 'statements', { method: 'POST', headers: kopf(), body: JSON.stringify(teil) }).then(function (r) {
            if (r.ok || r.status === 409) { queue.splice(0, teil.length); schreibe('warteschlange', queue); zaehler.gesendet += teil.length; return stapelSenden(); }
            if (r.status === 408 || r.status === 429 || r.status >= 500 || r.status === 401 || r.status === 403) { merke('LRS antwortet ' + r.status + ': ' + teil.length + ' Statement(s) bleiben in der Warteschlange'); zaehler.offen = queue.length; return zaehler; }
            // 4xx: ein Statement im Stapel ist ungültig. Einzeln senden, um nur das ungültige auszusondern
            if (teil.length > 1) { return einzeln(teil).then(stapelSenden); }
            return r.text().catch(function () { return ''; }).then(function (t) { aussondern(teil[0], r.status, t); return stapelSenden(); });
          });
        }
        function einzeln(teil) {
          return teil.reduce(function (p, st) {
            return p.then(function (weiter) {
              if (!weiter) return false;
              return doFetch(endpoint + 'statements', { method: 'POST', headers: kopf(), body: JSON.stringify(st) }).then(function (r) {
                var i = queue.indexOf(st); if (i < 0) for (var j = 0; j < queue.length; j++) if (queue[j].id === st.id) i = j;
                if (r.ok || r.status === 409) { if (i >= 0) queue.splice(i, 1); zaehler.gesendet++; schreibe('warteschlange', queue); return true; }
                if (r.status === 408 || r.status === 429 || r.status >= 500 || r.status === 401 || r.status === 403) { merke('LRS antwortet ' + r.status); return false; }
                return r.text().catch(function () { return ''; }).then(function (t) { aussondern(st, r.status, t); return true; });
              });
            });
          }, Promise.resolve(true)).then(function (ok) { if (!ok) throw new Error('abgebrochen'); });
        }
        function aussondern(st, status, text) {
          for (var i = 0; i < queue.length; i++) if (queue[i].id === st.id) { queue.splice(i, 1); break; }
          ad.verworfen.push({ id: st.id, status: status, grund: String(text).slice(0, 200) }); zaehler.verworfen++;
          merke('LRS lehnt ein Statement ab (' + status + '): ' + String(text).slice(0, 120));
          schreibe('warteschlange', queue);
        }
        return stapelSenden().catch(function (e) { if (!/abgebrochen/.test(e && e.message)) merke('Senden: ' + (e && e.message)); zaehler.offen = queue.length; return zaehler; });
      }).then(function (z) { z.offen = queue.length; z.verworfen = ad.verworfen.length; return z; }, function (e) { merke('Nachreichen: ' + (e && e.message)); return { gesendet: zaehler.gesendet, offen: queue.length, verworfen: ad.verworfen.length }; })
        .then(function (z) {
          laeuft = null;
          if (!nochmal) return z;
          nochmal = false;                                                // währenddessen kam etwas dazu: noch ein Durchgang
          return ad.nachreichen().then(function (z2) { return { gesendet: z.gesendet + z2.gesendet, offen: z2.offen, verworfen: z2.verworfen }; });
        });
      return laeuft;
    };

    ad.verbinde = function (bruecke) {
      sp = bruecke;
      var q = lies('warteschlange'); queue = Array.isArray(q) ? q.filter(istObj) : [];
      var g = lies('gemeldet'); gemeldet = istObj(g) ? g : {};
      ad.bereit = holeToken().then(holeStart).then(function () {
        if (cmi5 && !gemeldet['cmi5:initialized']) { gemeldet['cmi5:initialized'] = true; schreibe('gemeldet', gemeldet); einreihen(cmi5Statement(V_INIT, 'initialized')); }
        return ad.nachreichen();
      });
      try { if (global.addEventListener) { ad._online = function () { ad.nachreichen(); }; global.addEventListener('online', ad._online); } } catch (e) { /* ohne Fenster */ }
    };
    ad.beenden = function () {
      if (!sp || !cmi5) return ad.nachreichen();
      einreihen(cmi5Statement(V_TERM, 'terminated'));
      return ad.nachreichen();
    };
    ad.trenne = function () { try { if (ad._online && global.removeEventListener) global.removeEventListener('online', ad._online); } catch (e) { /* egal */ } };
    ad.zuruecksetzen = function () { queue = []; gemeldet = {}; schreibe('warteschlange', queue); schreibe('gemeldet', gemeldet); };
    return ad;
  }

  /* ------------------------------------------------------------------ *
   * SCORM: kompakte suspend_data (Einheiten als Tabelle, Zeiten in Minuten)
   * ------------------------------------------------------------------ */

  var VERB_NR = ['begonnen', 'erkundet', 'geschafft', 'bestanden', 'angewendet', 'geteilt'];
  var BELEG_NR = ['messung', 'bestaetigung', 'eigen'];

  function planHash(plan) {
    var K = SP.kompiliere(plan), t = K.list.map(function (u) { return u.id; }).join('|'), h = 5381;
    for (var i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function ms36(ms) { return Math.floor(ms / MINUTE).toString(36); }

  /**
   * Ereignisse oder (wenn zu lang) Stufen und Freischaltungen in einen Text höchstens `grenze` Zeichen. Drei Formen, die kürzeste, die passt, in dieser Reihenfolge:
   *   E  SP0|E|<Minuten des ersten>|<Einheiten>|<Fälle>|<Ereignisse>   Einheiten als Tabelle der benutzten ids (unabhängig vom Plan lesbar); Ereignis v.u.d[.m1+2][.bAF]
   *   X  SP0|X|<Hash der Einheiten>|<Minuten>|<Fälle>|<Ereignisse>     Einheiten als Nummer in id-Reihenfolge (viel kürzer bei großen Plänen; nur lesbar, solange die Einheiten dieselben sind)
   *   S  SP0|S|<Hash der Einheiten>|<eine Ziffer 0-4 je Einheit>|<Freischaltungen als Nummern>   nur Stufen und Freischaltungen (7.1), ohne Zeit
   * Verb v: 0 begonnen … 5 geteilt; u, m: Einheit; d: Minuten seit dem vorigen Ereignis; b: Belegart (0 messung, 1 bestaetigung, 2 eigen) und Fall (Nummer oder -). Alles base36.
   */
  function kompakt(plan, ereignisse, grenze, stand) {
    var K = SP.kompiliere(plan);
    grenze = grenze > 0 ? grenze : 4096;
    var ev = (Array.isArray(ereignisse) ? ereignisse : []).filter(function (e) { return istObj(e) && VERB_NR.indexOf(e.verb) >= 0 && K.by[e.objekt] && !isNaN(SP.zeitMs(e.zeit)); })
      .map(function (e) { return { e: e, t: Math.floor(SP.zeitMs(e.zeit) / MINUTE) }; }).sort(function (a, b) { return a.t - b.t || (a.e.objekt < b.e.objekt ? -1 : a.e.objekt > b.e.objekt ? 1 : 0); });
    var reihe = {};
    K.list.forEach(function (u, i) { reihe[u.id] = i; });
    function bauen(mitNummern) {
      var ids = [], idx = {}, faelle = [], fidx = {}, teile = [], prev = ev.length ? ev[0].t : 0;
      function nr(id) { if (mitNummern) return reihe[id].toString(36); if (!(id in idx)) { idx[id] = ids.length; ids.push(id); } return idx[id].toString(36); }
      function fnr(f) { if (!(f in fidx)) { fidx[f] = faelle.length; faelle.push(f); } return fidx[f].toString(36); }
      ev.forEach(function (x) {
        var e = x.e, s = VERB_NR.indexOf(e.verb) + '.' + nr(e.objekt) + '.' + (x.t - prev).toString(36);
        if (Array.isArray(e.mit) && e.mit.length) s += '.m' + e.mit.filter(function (w) { return K.by[w]; }).map(nr).join('+');
        if (istObj(e.beleg) && BELEG_NR.indexOf(e.beleg.art) >= 0) {
          var f = typeof e.beleg.fall === 'string' && /^[a-z0-9][a-z0-9_\-:.\/]*$/.test(e.beleg.fall.trim().toLowerCase()) ? e.beleg.fall.trim().toLowerCase() : null;
          s += '.b' + BELEG_NR.indexOf(e.beleg.art) + (f ? fnr(f) : '-');
        }
        teile.push(s); prev = x.t;
      });
      var basis = ev.length ? ev[0].t.toString(36) : '0';
      return mitNummern ? 'SP0|X|' + planHash(plan) + '|' + basis + '|' + faelle.join(',') + '|' + teile.join(';') : 'SP0|E|' + basis + '|' + ids.join(',') + '|' + faelle.join(',') + '|' + teile.join(';');
    }
    var textE = bauen(false);
    if (textE.length <= grenze) return textE;
    var textX = bauen(true);
    if (textX.length <= grenze) return textX;
    // zu lang: Stufen und Freischaltungen genügen für die Anzeige (7.1)
    var st = stand || SP.spielstand(K, ereignisse, new Date().toISOString());
    var ziffern = K.list.map(function (u) { var e = st.einheiten[u.id]; return e ? String(e.stufe) : '0'; }).join('');
    var frei = (st.freigeschaltet || []).map(function (f) { return f.einheit in reihe ? reihe[f.einheit].toString(36) : null; }).filter(function (x) { return x !== null; });
    var textS = 'SP0|S|' + planHash(plan) + '|' + ziffern + '|' + frei.join(',');
    if (textS.length <= grenze) return textS;
    textS = 'SP0|S|' + planHash(plan) + '|' + ziffern + '|';        // ohne Freischaltungen (folgen aus den Regeln)
    return textS.length <= grenze ? textS : '';
  }

  /** Gegenstück zu kompakt. Gibt { modus: 'E' | 'X', ereignisse } oder { modus: 'S', stufen, freigeschaltet } zurück, null bei Unlesbarem oder geändertem Plan (Formen X und S). */
  function entpacke(plan, text, opts) {
    opts = opts || {};
    var K = SP.kompiliere(plan);
    if (typeof text !== 'string' || text.indexOf('SP0|') !== 0) return null;
    var p = text.split('|');
    if ((p[1] === 'E' || p[1] === 'X') && p.length === 6) {
      var ids;
      if (p[1] === 'E') ids = p[3] === '' ? [] : p[3].split(',');
      else { if (p[2] !== planHash(plan)) return null; ids = K.list.map(function (u) { return u.id; }); }
      var tp = p[1] === 'E' ? 2 : 3, fp = p[1] === 'E' ? 4 : 4;
      var faelle = p[fp] === '' ? [] : p[fp].split(','), t = parseInt(p[tp], 36) * MINUTE, out = [];
      if (isNaN(t)) return null;
      var lst = p[5] === '' ? [] : p[5].split(';');
      for (var i = 0; i < lst.length; i++) {
        var f = lst[i].split('.');
        var verb = VERB_NR[+f[0]], obj = ids[parseInt(f[1], 36)], d = parseInt(f[2], 36);
        if (!verb || !obj || isNaN(d)) return null;
        t += (i === 0 ? 0 : d * MINUTE);
        var e = { wer: opts.wer, verb: verb, objekt: obj, zeit: SP.isoZeit(t), app: opts.app };
        for (var j = 3; j < f.length; j++) {
          if (f[j].charAt(0) === 'm') e.mit = f[j].slice(1).split('+').map(function (x) { return ids[parseInt(x, 36)]; }).filter(Boolean);
          else if (f[j].charAt(0) === 'b') {
            var art = BELEG_NR[+f[j].charAt(1)], fall = f[j].slice(2);
            if (art) { e.beleg = { art: art }; if (fall !== '-' && faelle[parseInt(fall, 36)]) e.beleg.fall = faelle[parseInt(fall, 36)]; }
          }
        }
        if (e.wer === undefined) delete e.wer;
        if (e.app === undefined) delete e.app;
        out.push(e);
      }
      return { modus: p[1], ereignisse: out };
    }
    if (p[1] === 'S' && p.length === 5) {
      if (p[2] !== planHash(plan)) return null;
      var stufen = {}, z = p[3];
      if (z.length !== K.list.length) return null;
      K.list.forEach(function (u, i) { stufen[u.id] = +z.charAt(i) || 0; });
      return { modus: 'S', stufen: stufen, freigeschaltet: p[4] === '' ? [] : p[4].split(',').map(function (x) { var u = K.list[parseInt(x, 36)]; return u ? u.id : null; }).filter(Boolean) };
    }
    return null;
  }

  /** Aus Stufen (Form S) Ersatz-Ereignisse bauen, damit der Spielstand wieder herauskommt. Nur Einheiten ohne Mitglieder; Fälle heißen scorm-1, scorm-2. */
  function ereignisseAusStufen(plan, stufen, opts) {
    opts = opts || {};
    var K = SP.kompiliere(plan), zeit = opts.zeit || new Date().toISOString(), out = [];
    function e(verb, id, extra) { var x = { verb: verb, objekt: id, zeit: zeit }; if (opts.wer) x.wer = opts.wer; if (opts.app) x.app = opts.app; for (var k in extra) x[k] = extra[k]; return x; }
    K.list.forEach(function (u) {
      var s = stufen[u.id] || 0;
      if (!s || K.members[u.id].length) return;
      if (s === 1) out.push(e('begonnen', u.id));
      else if (s === 2) out.push(e('geschafft', u.id));
      else if (s === 3) out.push(e('angewendet', u.id, { beleg: { art: 'eigen', fall: 'scorm-1' } }));
      else { out.push(e('angewendet', u.id, { beleg: { art: 'eigen', fall: 'scorm-1' } })); out.push(e('angewendet', u.id, { beleg: { art: 'eigen', fall: 'scorm-2' } })); }
    });
    return out;
  }

  /* ------------------------------------------------------------------ *
   * SCORM 1.2 und 2004
   * ------------------------------------------------------------------ */

  function findeApi(start, name) {
    var w = start, n = 0;
    while (w && n++ < 500) {
      try { if (w[name]) return w[name]; } catch (e) { /* fremder Ursprung */ }
      var p = null; try { p = w.parent; } catch (e2) { p = null; }
      if (!p || p === w) break;
      w = p;
    }
    var o = null; try { o = start && start.opener; } catch (e3) { o = null; }
    if (o && n < 500 && o !== start) return findeApi(o, name);
    return null;
  }

  function scorm(opt) {
    opt = opt || {};
    var ad = { name: 'scorm', fehler: [], version: null };
    var win = opt.fenster || global, api = null, v2004 = false, sp = null, fertig = false, istAbgeschlossen = false;
    function merke(t) { ad.fehler.push(t); if (ad.fehler.length > 20) ad.fehler.shift(); }
    function wahrText(x) { return x === true || x === 'true'; }
    var M = {};
    function bind(is2004) {
      if (is2004) M = { init: function () { return api.Initialize(''); }, get: function (k) { return api.GetValue(k); }, set: function (k, v) { return api.SetValue(k, v); }, commit: function () { return api.Commit(''); }, ende: function () { return api.Terminate(''); }, fehler: function () { return api.GetLastError(); },
        status: 'cmi.completion_status', daten: 'cmi.suspend_data', fertigWert: 'completed', offenWert: 'incomplete', leer: ['unknown', ''] };
      else M = { init: function () { return api.LMSInitialize(''); }, get: function (k) { return api.LMSGetValue(k); }, set: function (k, v) { return api.LMSSetValue(k, v); }, commit: function () { return api.LMSCommit(''); }, ende: function () { return api.LMSFinish(''); }, fehler: function () { return api.LMSGetLastError(); },
        status: 'cmi.core.lesson_status', daten: 'cmi.suspend_data', fertigWert: 'completed', offenWert: 'incomplete', leer: ['not attempted', 'unknown', ''] };
    }
    function setze(k, v) {
      try { var r = M.set(k, v); if (!wahrText(r)) { merke('SetValue ' + k + ' abgelehnt (Fehler ' + M.fehler() + ')'); return false; } return true; }
      catch (e) { merke('SetValue ' + k + ': ' + (e && e.message)); return false; }
    }
    function lesen(k) { try { return String(M.get(k)); } catch (e) { merke('GetValue ' + k + ': ' + (e && e.message)); return ''; } }

    ad.verbinde = function (bruecke) {
      sp = bruecke;
      var wunsch = opt.version || 'auto';
      if (wunsch !== '1.2') { api = findeApi(win, 'API_1484_11'); v2004 = !!api; }
      if (!api && wunsch !== '2004') api = findeApi(win, 'API');
      if (!api) { merke('keine SCORM-API gefunden (weder API_1484_11 noch API)'); return; }
      bind(v2004); ad.version = v2004 ? '2004' : '1.2';
      try { if (!wahrText(M.init())) { merke('Initialize fehlgeschlagen (Fehler ' + M.fehler() + ')'); api = null; return; } } catch (e) { merke('Initialize: ' + (e && e.message)); api = null; return; }
      fertig = true;
      var text = lesen(M.daten), r = text ? entpacke(sp.plan, text, { wer: sp.wer, app: sp.app }) : null;
      if (r && r.modus === 'E') sp.importiere(r.ereignisse);
      else if (r && r.modus === 'S') sp.importiere(ereignisseAusStufen(sp.plan, r.stufen, { wer: sp.wer, app: sp.app + '#scorm', zeit: new Date().toISOString() }));
      else if (text) merke('suspend_data nicht lesbar (anderer Plan oder fremder Inhalt); sie werden beim nächsten Speichern ersetzt');
      var status = lesen(M.status);
      istAbgeschlossen = status === 'completed' || status === 'passed';
      if (M.leer.indexOf(status) >= 0) setze(M.status, M.offenWert);
      try { M.commit(); } catch (e2) { /* egal */ }
    };

    ad.stand = function (stand) {
      if (!api || !fertig || !stand) return;
      var grenze = opt.grenze > 0 ? opt.grenze : (v2004 ? 64000 : 4096);
      var text = kompakt(sp.plan, sp.ereignisse(), grenze, stand);
      if (text) setze(M.daten, text); else merke('suspend_data passt nicht in ' + grenze + ' Zeichen');
      var wurzel = opt.wurzel ? (stand.einheiten[opt.wurzel] ? stand.einheiten[opt.wurzel].stufe : 0) : SP.wurzelStufe(sp.plan, stand);
      if (wurzel >= 2 && !istAbgeschlossen) { if (setze(M.status, M.fertigWert)) istAbgeschlossen = true; }
      if (v2004) {
        var alle = Object.keys(stand.einheiten), nenner = alle.length, zaehler = alle.filter(function (id) { return stand.einheiten[id].stufe >= 2; }).length;
        if (nenner) setze('cmi.progress_measure', String(Math.round(zaehler / nenner * 1000) / 1000));
      }
      try { M.commit(); } catch (e) { merke('Commit: ' + (e && e.message)); }
    };

    ad.beenden = function () {
      if (!api || !fertig) return false;
      if (!istAbgeschlossen) setze(v2004 ? 'cmi.exit' : 'cmi.core.exit', 'suspend');     // sonst verwirft manches Lernsystem die suspend_data
      try { M.commit(); M.ende(); fertig = false; return true; } catch (e) { merke('Beenden: ' + (e && e.message)); return false; }
    };
    return ad;
  }

  SP.adapter.xapi = xapi;
  SP.adapter.scorm = scorm;
  SP.adapter.cmi5Start = cmi5Start;
  SP.adapter.kompakt = kompakt;
  SP.adapter.entpacke = entpacke;
  SP.adapter.ereignisseAusStufen = ereignisseAusStufen;
  SP.adapter.findeApi = findeApi;
  if (typeof module === 'object' && module && module.exports) module.exports = SP.adapter;
})();

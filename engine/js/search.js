/* ==========================================================================
   Museum Studio – js/search.js
   Suche als Overlay (Taste "/" oder Strg+K, Knopf im Kopf).

   API:  MUSEUM.search = { open(q?), close(), isOpen(), setQuery(q) }

   - Nutzt MUSEUM.searchIndex (core.js) und MUSEUM.norm; fehlt der Index, baut dieses Modul einen eigenen.
   - Gewichtung: Titel > Teaser > Text. Mehrere Wörter müssen alle vorkommen (UND); gibt es dann nichts,
     werden Teiltreffer gezeigt. Tippfehler werden einmal sanft korrigiert („Ankereffeckt“ -> „Ankereffekt“).
   - Ergebnisse gruppiert nach Reise (Heimat-Reise der Station) oder nach Art. Zusätzlich ganze Reisen als Treffer.
   - Filter nach Art; ohne Suchwort listet ein Filter alle Stationen dieser Art.
   - Combobox/Listbox mit aria-activedescendant, Pfeiltasten, Enter, Esc, Fokusfalle, aria-live für die Trefferzahl.
   - Modalität (inert, Scroll-Sperre, Fokus-Rückgabe, Esc) liefert MUSEUM.ui.overlay aus core.js.
   - Eigene Persistenz: Schlüssel gm:searchgroup ("reise" | "art"), immer in try/catch.
   Präfix aller Klassen: gm-suche-
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  var doc = document;
  var ID = 'gm-suche-';

  var S = {
    built: false, node: null, panel: null, input: null, list: null, body: null, empty: null, none: null, note: null,
    status: null, count: null, clearBtn: null, segBtns: [], kindBtns: {}, foot: null,
    q: '', group: 'reise', kind: null, items: [], opts: [], active: -1,
    vocab: null, vocabN: -1, sugg: null, suggN: -1, annT: 0, opened: false, chunkRaf: 0, mx: -1, my: -1
  };

  var PLURAL = {
    person: 'Personen', konzept: 'Konzepte', ereignis: 'Ereignisse', methode: 'Methoden',
    mythos: 'Mythen', instrument: 'Instrumente', ort: 'Orte'
  };
  var KIND_ORDER = ['konzept', 'person', 'ereignis', 'methode', 'mythos', 'instrument', 'ort'];
  var WANTED = ['Phineas Gage', 'Ankereffekt', 'ICD-11', 'Hypnose'];

  /* ------------------------------------------------------------------ *
   * Helfer
   * ------------------------------------------------------------------ */

  function el() { return M.el.apply(M, arguments); }
  function ico(key, size) {
    if (M.ui && M.ui.icon) return M.ui.icon(key, size || 18);
    return M.icons && M.icons.svg ? M.icons.svg(key, { size: size || 18 }) : '';
  }
  function reduced() { return M.reducedMotion ? M.reducedMotion() : false; }
  function sget(k, d) { try { var v = M.store.get(k, d); return v === undefined || v === null ? d : v; } catch (e) { return d; } }
  function sset(k, v) { try { M.store.set(k, v); } catch (e) { /* egal */ } }
  function plural(n, one, many) { return n === 1 ? one : many; }
  function stations() { return (M.data && M.data.stations) || {}; }
  function spielAn() { return !!(M.spiel && M.spiel.aktiv); }
  function journeyOf(id) { return M.data && M.data.journeyById && M.data.journeyById[id]; }
  /* Farbband über alle Reisen: so viele gleich breite Abschnitte, wie es Reisen gibt */
  function stripGradient() {
    var js = ((M.data && M.data.journeys) || []).filter(function (j) { return j && !j.virtual; });
    if (!js.length) return '';
    var stops = js.map(function (j, i) { return 'var(--j-' + j.id + ') ' + (i / js.length * 100).toFixed(2) + '% ' + ((i + 1) / js.length * 100).toFixed(2) + '%'; });
    return 'linear-gradient(90deg,' + stops.join(',') + ')';
  }
  function isRealJourney(id) { var j = journeyOf(id); return !!j && !j.virtual && (!spielAn() || M.spiel.zugang('episode/' + id).sichtbar); }   // Spielplan: Verborgenes wird nicht genannt
  function homeOf(st) {
    var js = (st.journeys || []).filter(isRealJourney);
    return js.length ? js[0] : null;
  }
  function jColor(id) { return 'var(--j-' + id + ')'; }
  function kindOf(st) { return (M.kinds && M.kinds[st.kind]) || { label: M.t('station'), icon: 'lightbulb' }; }
  function yearText(st) {
    if (st.yearLabel) return String(st.yearLabel);
    if (typeof st.year === 'number') return st.year < 0 ? Math.abs(st.year) + ' v. Chr.' : String(st.year);
    return '';
  }
  function shortTitle(t) {
    t = String(t || '');
    var i = t.indexOf(': ');
    return i > 2 && i < t.length - 3 ? t.slice(0, i) : t;
  }

  /* Normalisierung wie core.js (damit Index und Anfrage zusammenpassen) */
  function nrm(s) {
    if (M.norm) return M.norm(s);
    s = String(s === null || s === undefined ? '' : s).toLowerCase().replace(/ß/g, 'ss');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* ältere Engines */ }
    return s.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u').replace(/\s+/g, ' ').trim();
  }

  /* Wie nrm, merkt sich aber für jedes Zeichen die Spanne im Original (fürs Hervorheben). */
  var foldCache = Object.create(null), foldCacheN = 0;
  function foldSpans(str) {
    str = String(str === null || str === undefined ? '' : str);
    var hit = foldCache[str];
    if (hit) return hit;
    var res = foldSpansRaw(str);
    if (foldCacheN > 600) { foldCache = Object.create(null); foldCacheN = 0; }
    foldCache[str] = res; foldCacheN++;
    return res;
  }
  function foldSpansRaw(str) {
    var ch = [], st = [], en = [], i, k, c;
    for (i = 0; i < str.length; i++) {
      c = str.charAt(i).toLowerCase();
      if (c === 'ß') c = 'ss';
      else if (c.charCodeAt(0) > 127) { try { c = c.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* egal */ } }
      for (k = 0; k < c.length; k++) { ch.push(c.charAt(k)); st.push(i); en.push(i + 1); }
    }
    ['a', 'o', 'u'].forEach(function (v) {
      var oc = [], os = [], oe = [], j = 0;
      while (j < ch.length) {
        if (ch[j] === v && ch[j + 1] === 'e') { oc.push(v); os.push(st[j]); oe.push(en[j + 1]); j += 2; }
        else { oc.push(ch[j]); os.push(st[j]); oe.push(en[j]); j++; }
      }
      ch = oc; st = os; en = oe;
    });
    return { s: ch.join(''), st: st, en: en };
  }

  var LETTER = /[\p{L}\p{N}]/u;
  function wordStartAt(h, i) { return i === 0 || !LETTER.test(h.charAt(i - 1)); }
  /* 2 = am Wortanfang, 1 = irgendwo, 0 = gar nicht */
  function wstart(h, t) {
    var i = h.indexOf(t);
    if (i < 0) return 0;
    while (i >= 0) {
      if (wordStartAt(h, i)) return 2;
      i = h.indexOf(t, i + 1);
    }
    return 1;
  }

  /* ------------------------------------------------------------------ *
   * Index und Bewertung
   * ------------------------------------------------------------------ */

  var ownIndex = null, ownIndexN = -1;
  function getIndex() {
    if (M.searchIndex && M.searchIndex.length) return M.searchIndex;
    var D = stations(), ids = Object.keys(D);
    if (ownIndex && ownIndexN === ids.length) return ownIndex;
    ownIndex = ids.map(function (id) {
      var s = D[id];
      var body = [].concat(s.text || [], s.facts || [], s.further || [],
        s.quote ? [s.quote.text, s.quote.who, s.quote.src] : [],
        s.myth ? [s.myth.glaube, s.myth.wahrheit] : []).join(' ');
      var meta = [kindOf(s).label, s.yearLabel || s.year || ''].concat((s.journeys || []).map(function (j) {
        var jj = journeyOf(j);
        return jj ? jj.name + ' ' + (jj.kurz || '') : j;
      })).join(' ');
      return {
        id: id, type: 'station', title: s.title, teaser: s.teaser || '', kind: s.kind, journeys: s.journeys || [], year: s.year,
        nTitle: nrm(s.title), nTeaser: nrm(s.teaser || ''), nBody: nrm(body), nMeta: nrm(meta)
      };
    });
    ownIndexN = ids.length;
    return ownIndex;
  }

  function hyphenParts(t) {
    return t.split('-').filter(function (x) { return x.length >= 3 && !/^\d+$/.test(x); });
  }
  function tokensOf(q) { var n = nrm(q); return n ? n.split(' ') : []; }

  function tokScore(e, t) {
    var short = t.length < 2;
    function lv(h, hi, lo) {
      var w = wstart(h, t);
      if (short && w === 1) w = 0;
      return w === 2 ? hi : w === 1 ? lo : 0;
    }
    var sc = [lv(e.nTitle, 100, 60), lv(e.nMeta, 35, 20), lv(e.nTeaser, 40, 28), lv(e.nBody, 15, 10)];
    /* „ICD-11“ soll auch die Station „Die ICD …“ finden: Teile vor/nach dem Bindestrich zählen etwas weniger */
    if (t.indexOf('-') > 0) {
      hyphenParts(t).forEach(function (part) {
        var w = wstart(e.nTitle, part);
        if (w === 2) sc.push(72);
        w = wstart(e.nTeaser, part);
        if (w === 2) sc.push(30);
      });
    }
    if (/^\d+$/.test(t) && typeof e.year === 'number' && String(Math.abs(e.year)) === t) sc.push(70);
    var max = 0, sum = 0;
    sc.forEach(function (x) { sum += x; if (x > max) max = x; });
    return max + 0.12 * (sum - max);
  }

  function scoreAll(pool, toks, requireAll) {
    var qn = toks.join(' '), out = [];
    pool.forEach(function (e) {
      var total = 0, hit = 0, miss = false;
      toks.forEach(function (t) {
        var s = tokScore(e, t);
        if (s > 0) { hit++; total += s; } else miss = true;
      });
      if (requireAll ? miss : !hit) return;
      if (e.nTitle === qn) total += 120;
      else if (e.nTitle.indexOf(qn) === 0) total += 60;
      else if (e.nTitle.indexOf(qn) >= 0) total += 40;
      if (e.nTeaser.indexOf(qn) >= 0) total += 15;
      out.push({ e: e, score: total });
    });
    out.sort(function (a, b) {
      return (b.score - a.score) || (a.e.nTitle.length - b.e.nTitle.length) || String(a.e.title).localeCompare(String(b.e.title), 'de');
    });
    return out;
  }

  /* ---------- Tippfehler ---------- */

  function lev(a, b, max) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      var t = prev; prev = cur; cur = t;
    }
    return prev[lb];
  }

  function vocab() {
    var idx = getIndex();
    if (S.vocab && S.vocabN === idx.length) return S.vocab;
    var map = {}, D = stations();
    function eat(text) {
      var m = String(text || '').match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) || [];
      m.forEach(function (w) {
        var f = nrm(w);
        if (f.length >= 4 && !map[f]) map[f] = w;
      });
    }
    idx.forEach(function (e) { var s = D[e.id]; if (s) eat(s.title); });
    idx.forEach(function (e) { var s = D[e.id]; if (s) eat(s.teaser); });
    S.vocab = map;
    S.vocabN = idx.length;
    return map;
  }

  function hasAnyHit(t) {
    var idx = getIndex();
    for (var i = 0; i < idx.length; i++) if (tokScore(idx[i], t) > 0) return true;
    return false;
  }

  function correct(toks) {
    var voc = vocab(), keys = Object.keys(voc), changed = false, shown = [];
    var out = toks.map(function (t) {
      if (t.length < 4 || hasAnyHit(t)) { shown.push(t); return t; }
      var max = t.length >= 8 ? 2 : 1, best = null, bestD = 99;
      for (var i = 0; i < keys.length; i++) {
        var d = lev(t, keys[i], max);
        if (d <= max && (d < bestD || (d === bestD && keys[i].length < best.length))) { best = keys[i]; bestD = d; }
      }
      if (best) { changed = true; shown.push(voc[best]); return best; }
      shown.push(t);
      return t;
    });
    return changed ? { tokens: out, shown: shown.join(' ') } : null;
  }

  /* ---------- Gesamtberechnung ---------- */

  function compute() {
    var toks = tokensOf(S.q), idx = getIndex(), D = stations();
    var pool = S.kind ? idx.filter(function (e) { return e.kind === S.kind; }) : idx;
    var res = [], mode = 'all', note = null, hl = toks;

    if (!toks.length) {
      if (S.kind) res = pool.map(function (e) { return { e: e, score: 0 }; });
    } else {
      res = scoreAll(pool, toks, true);
      if (!res.length) {
        var fixed = correct(toks);
        if (fixed) {
          var r2 = scoreAll(pool, fixed.tokens, true);
          if (r2.length) {
            res = r2; hl = fixed.tokens; mode = 'fuzzy';
            note = { kind: 'fuzzy', said: S.q.trim(), shown: fixed.shown };
          }
        }
      }
      if (!res.length && toks.length > 1) {
        res = scoreAll(pool, toks, false);
        if (res.length) { mode = 'partial'; note = { kind: 'partial' }; }
      }
    }

    var items = res.filter(function (r) { return D[r.e.id]; }).map(function (r) {
      var st = D[r.e.id], home = homeOf(st);
      return { type: 'station', id: r.e.id, e: r.e, st: st, score: r.score, home: home, jid: null };
    });
    /* Spielplan: noch Verschlossenes erscheint nur angedeutet (Titel und Hinweis), und nur, wenn der Titel selbst trifft;
       Verborgenes gar nicht. Der Text einer verschlossenen Station wird nie durchsucht gezeigt. */
    if (spielAn()) {
      if (toks.length) items = items.filter(function (it) {   // ein Treffer allein über den Namen einer verborgenen Reise (er steckt im Meta-Text) gilt nicht
        var alle = (it.st.journeys || []).filter(function (j) { var jj = journeyOf(j); return jj && !jj.virtual; });
        var sichtbar = alle.filter(isRealJourney);
        if (sichtbar.length === alle.length) return true;
        var meta = nrm([kindOf(it.st).label, yearText(it.st)].concat(sichtbar.map(function (j) { var jj = journeyOf(j); return jj.name + ' ' + (jj.kurz || ''); })).join(' '));
        return toks.some(function (t) { return it.e.nTitle.indexOf(t) >= 0 || it.e.nTeaser.indexOf(t) >= 0 || it.e.nBody.indexOf(t) >= 0 || meta.indexOf(t) >= 0; });
      });
      items = items.filter(function (it) {
        var a = M.spiel.anzeige('inhalt/' + it.id);
        if (!a.gesperrt) return true;
        if (a.verborgen) return false;
        if (toks.length && !toks.every(function (t) { return it.e.nTitle.indexOf(t) >= 0; })) return false;
        it.gesperrt = a;
        return true;
      });
    }

    /* ganze Reisen als Treffer */
    var jitems = [];
    if (toks.length && !S.kind && mode !== 'partial') {
      ((M.data && M.data.journeys) || []).forEach(function (j) {
        if (!j || j.virtual) return;
        var hay = nrm(j.name + ' ' + (j.kurz || ''));
        var okAll = hl.every(function (t) { return wstart(hay, t) === 2 && t.length > 1; });
        var jz = spielAn() ? M.spiel.zugang('episode/' + j.id) : null;
        if (jz && !jz.sichtbar) return;   // Verborgenes bleibt ungenannt
        if (okAll) jitems.push({ type: 'journey', id: j.id, j: j, score: 1000, gesperrt: jz && !jz.offen ? jz : null });
      });
      jitems = jitems.slice(0, 3);
    }

    var groups = [], map = {};
    function grp(key, label, icon, color, order) {
      if (!map[key]) { map[key] = { key: key, label: label, icon: icon, color: color, items: [], top: -1, order: order }; groups.push(map[key]); }
      return map[key];
    }
    if (jitems.length) {
      var g0 = grp('reisen', ('Ganze ' + M.t('journeys')), 'train', 'var(--accent)', -1);
      jitems.forEach(function (it) { g0.items.push(it); g0.top = 1000; });
    }
    items.forEach(function (it) {
      var g;
      if (S.group === 'art') {
        var k = it.st.kind || 'konzept', ko = KIND_ORDER.indexOf(k);
        g = grp('k:' + k, PLURAL[k] || kindOf(it.st).label, kindOf(it.st).icon, 'var(--accent)', ko < 0 ? 99 : ko);
      } else {
        var h = it.home, j = h ? journeyOf(h) : null;
        it.jid = h;
        g = h
          ? grp('j:' + h, j.name, j.icon || 'train', jColor(h), ((M.data.journeys || []).indexOf(j)))
          : grp('j:-', ('Weitere ' + M.t('stations')), 'museum', 'var(--accent)', 99);
      }
      g.items.push(it);
      if (it.score > g.top) g.top = it.score;
    });
    if (toks.length) {
      groups.sort(function (a, b) { return a.order === -1 ? -1 : b.order === -1 ? 1 : (b.top - a.top) || (a.order - b.order); });
    } else {
      groups.sort(function (a, b) { return a.order - b.order; });
      groups.forEach(function (g) {
        g.items.sort(function (a, b) {
          if (S.group === 'art') return String(a.st.title).localeCompare(String(b.st.title), 'de');
          var ja = g.key.slice(2), ia = a.st.order && a.st.order[ja], ib = b.st.order && b.st.order[ja];
          return (ia === undefined ? 999 : ia) - (ib === undefined ? 999 : ib);
        });
      });
    }
    var flat = [];
    groups.forEach(function (g) { g.items.forEach(function (it) { it.n = flat.length; it.group = g; flat.push(it); }); });
    var hlx = hl.slice();
    hl.forEach(function (t) { if (t.indexOf('-') > 0) hyphenParts(t).forEach(function (x) { hlx.push(x); }); });
    return { toks: toks, hl: hlx, groups: groups, flat: flat, nStations: items.length, mode: mode, note: note, browse: !toks.length && !!S.kind };
  }

  /* ------------------------------------------------------------------ *
   * Hervorheben und Ausschnitte
   * ------------------------------------------------------------------ */

  function findRanges(text, toks) {
    if (!toks || !toks.length || !text) return [];
    var f = foldSpans(text), rs = [];
    toks.forEach(function (t) {
      if (!t) return;
      var i = f.s.indexOf(t);
      while (i >= 0) {
        if (t.length > 1 || wordStartAt(f.s, i)) rs.push([f.st[i], f.en[i + t.length - 1]]);
        i = f.s.indexOf(t, i + t.length);
      }
    });
    rs.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var out = [];
    rs.forEach(function (r) {
      var last = out[out.length - 1];
      if (last && r[0] <= last[1]) { if (r[1] > last[1]) last[1] = r[1]; }
      else out.push([r[0], r[1]]);
    });
    return out;
  }

  function marked(text, toks) {
    text = String(text || '');
    var frag = doc.createDocumentFragment(), rs = findRanges(text, toks), pos = 0;
    rs.forEach(function (r) {
      if (r[0] > pos) frag.appendChild(doc.createTextNode(text.slice(pos, r[0])));
      frag.appendChild(el('mark', { class: 'gm-suche-mark' }, text.slice(r[0], r[1])));
      pos = r[1];
    });
    if (pos < text.length) frag.appendChild(doc.createTextNode(text.slice(pos)));
    return frag;
  }

  function bodySources(st) {
    var out = [].concat(st.text || [], st.facts || []);
    if (st.myth) out.push(st.myth.glaube, st.myth.wahrheit);
    if (st.quote) out.push(st.quote.text);
    return out.filter(Boolean);
  }

  function snippet(st, toks) {
    var src = bodySources(st), best = null;
    for (var i = 0; i < src.length && !best; i++) {
      var f = foldSpans(src[i]);
      for (var k = 0; k < toks.length; k++) {
        var t = toks[k], p = f.s.indexOf(t);
        while (p >= 0 && t.length < 2 && !wordStartAt(f.s, p)) p = f.s.indexOf(t, p + 1);
        if (p >= 0 && (!best || f.st[p] < best.at)) best = { src: src[i], at: f.st[p], end: f.en[p + t.length - 1] };
      }
    }
    if (!best) return null;
    var text = best.src, s = Math.max(0, best.at - 58), e = Math.min(text.length, best.end + 92);
    if (s > 0) { var sp = text.indexOf(' ', s); if (sp >= 0 && sp < best.at) s = sp + 1; }
    if (e < text.length) { var sq = text.lastIndexOf(' ', e); if (sq > best.end) e = sq; }
    return { text: text.slice(s, e), pre: s > 0, post: e < text.length };
  }

  function excerpt(st, toks) {
    var p = el('p', { class: 'gm-suche-ex' });
    var teaser = String(st.teaser || '');
    if (toks.length) {
      if (findRanges(teaser, toks).length) { p.appendChild(marked(teaser, toks)); return p; }
      var sn = snippet(st, toks);
      if (sn) {
        p.classList.add('is-snip');
        if (sn.pre) p.appendChild(doc.createTextNode('… '));
        p.appendChild(marked(sn.text, toks));
        if (sn.post) p.appendChild(doc.createTextNode(' …'));
        return p;
      }
    }
    if (!teaser) return null;
    p.textContent = teaser;
    return p;
  }

  /* ------------------------------------------------------------------ *
   * Stile
   * ------------------------------------------------------------------ */

  var CSS = [
    '.gm-suche{--sp:clamp(.75rem,7vh,4.5rem);display:flex;align-items:flex-start;justify-content:center;padding:var(--sp) var(--gutter,1rem)}',
    '.gm-suche[hidden]{display:none}',
    '.gm-suche-panel{position:relative;display:flex;flex-direction:column;width:min(100%,46rem);height:min(42rem,calc(100vh - 2*var(--sp)));height:min(42rem,calc(100dvh - 2*var(--sp)));',
    'background:var(--bg-2,#fff);color:var(--ink,#1B2230);border:1px solid var(--line,#D9D2C3);border-radius:22px;box-shadow:var(--shadow-lg);overflow:hidden;',
    'opacity:0;transform:translateY(-16px) scale(.985);transition:opacity .28s var(--ease,ease),transform .36s var(--ease,ease)}',
    '.gm-suche.is-open .gm-suche-panel{opacity:1;transform:none}',
    '.gm-suche.is-closing .gm-suche-panel{opacity:0;transform:translateY(-10px) scale(.99)}',
    '.gm-suche-strip{flex:none;height:4px;background:linear-gradient(90deg,var(--jp-1),var(--jp-3),var(--jp-5))}',

    /* Kopf: Eingabe */
    '.gm-suche-head{flex:none;display:flex;align-items:center;gap:.5rem;padding:.55rem .7rem .55rem 1.15rem;border-bottom:1px solid var(--line,#D9D2C3)}',
    '.gm-suche-lupe{flex:none;display:grid;place-items:center;color:var(--accent,#05749E)}',
    '.gm-suche-input{flex:1;min-width:0;height:3rem;margin:0;padding:0 .4rem;border:0;border-radius:8px;background:transparent;color:var(--ink,#1B2230);',
    'font:500 clamp(1.15rem,1rem + .8vw,1.4rem)/1.2 var(--font-display);letter-spacing:.005em;-webkit-appearance:none;appearance:none}',
    '.gm-suche-input::placeholder{color:var(--ink-2,#5C6577);font-style:italic;opacity:1}',
    '.gm-suche-input:focus{outline:none}',
    '.gm-suche-input:focus-visible{outline:none}',
    '.gm-suche-head{transition:box-shadow .2s}',
    '.gm-suche-head:focus-within{box-shadow:inset 0 -3px 0 var(--accent,#05749E)}',
    '.gm-suche-clear{flex:none;min-height:2.25rem;padding:0 .8rem;border:1px solid var(--line,#D9D2C3);border-radius:999px;background:transparent;color:var(--ink-2,#5C6577);font:600 .82rem/1 var(--font-ui);cursor:pointer}',
    '.gm-suche-clear:hover{color:var(--ink);border-color:var(--accent);background:var(--accent-soft)}',
    '.gm-suche-clear[hidden]{display:none}',
    '.gm-suche-x{flex:none;display:inline-flex;align-items:center;gap:.5rem;min-height:2.5rem;padding:0 .55rem 0 .7rem;border:1px solid transparent;border-radius:999px;background:transparent;color:var(--ink-2,#5C6577);font:600 .8rem/1 var(--font-ui);cursor:pointer}',
    '.gm-suche-x:hover{color:var(--ink);background:var(--accent-soft)}',
    '.gm-suche-x kbd{font:600 .7rem/1 var(--font-ui);padding:.2rem .4rem;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;background:var(--bg-3);color:var(--ink-2)}',
    '.gm-suche-x svg{display:none}',

    /* Werkzeugleiste */
    '.gm-suche-tools{flex:none;display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.6rem 1.1rem .15rem}',
    '.gm-suche-seg{display:inline-flex;padding:2px;border-radius:999px;background:var(--bg-3,#ECE6DA);border:1px solid var(--line,#D9D2C3)}',
    '.gm-suche-seg button{min-height:1.9rem;padding:0 .8rem;border:0;border-radius:999px;background:transparent;color:var(--ink-2,#5C6577);font:600 .78rem/1 var(--font-ui);cursor:pointer;transition:background .2s,color .2s}',
    '.gm-suche-seg button:hover{color:var(--ink)}',
    '.gm-suche-seg button[aria-pressed="true"]{background:var(--bg-2,#fff);color:var(--ink,#1B2230);box-shadow:0 1px 3px rgba(20,25,40,.18)}',
    '.gm-suche-count{margin:0;color:var(--ink-2,#5C6577);font:600 .8rem/1.2 var(--font-ui);font-variant-numeric:tabular-nums;text-align:right}',
    '.gm-suche-kinds{flex:none;display:flex;gap:.35rem;padding:.45rem 1.1rem .65rem;overflow-x:auto;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 1.6rem),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 1.6rem),transparent);scrollbar-width:none;overscroll-behavior-x:contain;border-bottom:1px solid var(--line,#D9D2C3)}',
    '.gm-suche-kinds::-webkit-scrollbar{display:none}',
    '.gm-suche-kind{flex:none;display:inline-flex;align-items:center;gap:.35rem;min-height:2rem;padding:0 .65rem 0 .55rem;border:1px solid var(--line,#D9D2C3);border-radius:999px;background:transparent;color:var(--ink-2,#5C6577);font:600 .78rem/1 var(--font-ui);cursor:pointer;transition:border-color .2s,background .2s,color .2s}',
    '.gm-suche-kind svg{width:15px;height:15px}',
    '.gm-suche-kind:hover{color:var(--ink);border-color:var(--accent)}',
    '.gm-suche-kind[aria-pressed="true"]{color:var(--on-accent,#fff);background:var(--accent,#05749E);border-color:var(--accent,#05749E)}',

    /* Körper */
    '.gm-suche-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding-bottom:.6rem;scroll-padding-top:2.6rem}',
    '.gm-suche-gh{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:.55rem;padding:.7rem 1.15rem .4rem;background:var(--bg-2,#fff);',
    'color:var(--gc,var(--ink-2));font:700 .7rem/1.2 var(--font-ui);letter-spacing:.13em;text-transform:uppercase}',
    '.gm-suche-gh svg{flex:none;width:17px;height:17px}',
    '.gm-suche-gh span.t{flex:none;color:var(--ink-2,#5C6577)}',
    '.gm-suche-gh::after{content:"";flex:1;height:1px;margin-left:.3rem;background:linear-gradient(90deg,var(--gc,var(--line)),transparent);opacity:.5}',
    '.gm-suche-gh .n{order:3;color:var(--ink-2,#5C6577);font-variant-numeric:tabular-nums;letter-spacing:.04em}',
    '.gm-suche-opt{position:relative;display:grid;grid-template-columns:2.6rem minmax(0,1fr);gap:.85rem;margin:.1rem .5rem;padding:.7rem .85rem .7rem .7rem;border-radius:13px;border-left:3px solid transparent;cursor:pointer;scroll-margin-top:2.6rem;transition:background .15s}',
    '.gm-suche-opt[aria-selected="true"]{background:var(--accent-soft,rgba(5,116,158,.1));border-left-color:var(--jc,var(--accent))}',
    '.gm-suche-ico{display:grid;place-items:center;width:2.6rem;height:2.6rem;border-radius:50%;border:1.5px solid var(--jc,var(--accent));color:var(--jc,var(--accent));background:var(--bg-2,#fff)}',
    '.gm-suche-ico svg{width:20px;height:20px}',
    '.gm-suche-main{min-width:0}',
    '.gm-suche-title{margin:0;font:600 1.08rem/1.28 var(--font-display);color:var(--ink,#1B2230);overflow-wrap:anywhere}',
    '.gm-suche-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .55rem;margin:.28rem 0 0;color:var(--ink-2,#5C6577);font:600 .72rem/1.3 var(--font-ui)}',
    '.gm-suche-badge{padding:.12rem .45rem;border:1px solid var(--line,#D9D2C3);border-radius:5px;font-size:.64rem;letter-spacing:.11em;text-transform:uppercase;color:var(--ink-2,#5C6577)}',
    '.gm-suche-badge.is-kreuz{border-color:color-mix(in srgb,var(--warm) 70%,transparent);background:color-mix(in srgb,var(--warm) 18%,transparent);color:var(--ink)}',
    '.gm-suche-year{font-variant-numeric:tabular-nums}',
    '.gm-suche-jp{display:inline-flex;align-items:center;gap:.3rem;font-weight:600}',
    '.gm-suche-jp i{flex:none;width:.6rem;height:.6rem;border-radius:50%;background:var(--jc)}',
    '.gm-suche-seen{display:inline-flex;align-items:center;gap:.25rem;color:var(--ink-2,#5C6577)}',
    '.gm-suche-seen svg{color:var(--ok,#2F8F5B)}',
    '.gm-suche-seen svg{width:13px;height:13px}',
    '.gm-suche-ex{margin:.4rem 0 0;color:var(--ink-2,#5C6577);font:400 .9rem/1.5 var(--font-ui);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden}',
    '.gm-suche-ex.is-snip{font-style:italic}',
    '.gm-suche-mark{background:color-mix(in srgb,var(--warm,#FCB300) 36%,transparent);color:var(--ink,#1B2230);border-radius:3px;box-shadow:inset 0 -2px 0 color-mix(in srgb,var(--warm,#FCB300) 85%,transparent);padding:0 .06em;margin:0 -.06em;font-style:inherit}',
    '.gm-suche-note{margin:.7rem 1.1rem .1rem;padding:.55rem .8rem;border-left:3px solid var(--warm,#FCB300);border-radius:0 10px 10px 0;background:var(--bg-3,#ECE6DA);color:var(--ink);font:400 .88rem/1.5 var(--font-ui)}',
    '.gm-suche-note b{font-weight:700}',

    /* Leere Ansicht */
    '.gm-suche-empty,.gm-suche-none{padding:1.5rem 1.3rem 1.2rem}',
    '.gm-suche-empty[hidden],.gm-suche-none[hidden],.gm-suche-list[hidden],.gm-suche-note[hidden]{display:none}',
    '.gm-suche-eh{margin:0 0 .4rem;font:600 clamp(1.45rem,1.15rem + 1.2vw,1.95rem)/1.15 var(--font-display);letter-spacing:-.005em;text-wrap:balance}',
    '.gm-suche-ep{margin:0 0 1.3rem;max-width:34rem;color:var(--ink-2,#5C6577);font:400 .98rem/1.6 var(--font-ui)}',
    '.gm-suche-lab{margin:0 0 .6rem;color:var(--ink-2,#5C6577);font:700 .68rem/1.2 var(--font-ui);letter-spacing:.15em;text-transform:uppercase}',
    '.gm-suche-chips{display:flex;flex-wrap:wrap;gap:.5rem;margin:0 0 1.6rem;padding:0;list-style:none}',
    '.gm-suche-chip{display:inline-flex;align-items:center;gap:.45rem;min-height:2.4rem;padding:0 .95rem 0 .8rem;border:1px solid var(--line,#D9D2C3);border-radius:999px;background:var(--bg-2,#fff);color:var(--ink,#1B2230);font:600 .9rem/1 var(--font-ui);cursor:pointer;transition:border-color .2s,transform .2s var(--ease,ease),background .2s}',
    '.gm-suche-chip svg{width:15px;height:15px;color:var(--accent)}',
    '.gm-suche-chip:hover{border-color:var(--accent);background:var(--accent-soft);transform:translateY(-1px)}',
    '.gm-suche-jchips{gap:.4rem;margin-bottom:1.1rem}',
    '.gm-suche-jchip{min-height:2.05rem;padding:0 .8rem 0 .65rem;font-size:.82rem}',
    '.gm-suche-empty{padding-top:1.2rem}',
    '.gm-suche-empty .gm-suche-ep{margin-bottom:1rem}',
    '.gm-suche-empty .gm-suche-chips{margin-bottom:1.15rem}',
    '.gm-suche-empty .gm-suche-jchips{margin-bottom:1.1rem}',
    '.gm-suche-jchip i{flex:none;width:.7rem;height:.7rem;border-radius:50%;background:var(--jc)}',
    '.gm-suche-jchip:hover{border-color:var(--jc)}',
    '.gm-suche-surprise{display:flex;align-items:center;gap:1rem;width:100%;padding:.8rem 1rem;border:1px solid color-mix(in srgb,var(--warm) 65%,var(--line));border-radius:16px;',
    'background:linear-gradient(135deg,color-mix(in srgb,var(--warm) 20%,var(--bg-2)),var(--bg-2));color:var(--ink);text-align:left;cursor:pointer;font:inherit;transition:transform .25s var(--ease,ease),box-shadow .25s}',
    '.gm-suche-surprise:hover{transform:translateY(-2px);box-shadow:var(--shadow)}',
    '.gm-suche-surprise .ic{flex:none;display:grid;place-items:center;width:2.8rem;height:2.8rem;border-radius:50%;background:var(--warm,#FCB300);color:var(--on-warm,#1B2230)}',
    '.gm-suche-surprise .ic svg{width:22px;height:22px}',
    '.gm-suche-surprise b{display:block;font:600 1.1rem/1.2 var(--font-display)}',
    '.gm-suche-surprise span.s{display:block;margin-top:.2rem;color:var(--ink-2);font:400 .88rem/1.4 var(--font-ui)}',

    /* Fuß */
    '.gm-suche-foot{flex:none;display:flex;align-items:center;justify-content:space-between;gap:.8rem;padding:.6rem 1.1rem;border-top:1px solid var(--line,#D9D2C3);background:var(--bg-3,#ECE6DA)}',
    '.gm-suche-hints{display:flex;flex-wrap:wrap;gap:.3rem .9rem;margin:0;color:var(--ink-2,#5C6577);font:500 .76rem/1.3 var(--font-ui)}',
    '.gm-suche-hints kbd{margin-right:.3rem;font:600 .7rem/1 var(--font-ui);padding:.18rem .38rem;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;background:var(--bg-2);color:var(--ink-2)}',
    '.gm-suche-rand{display:inline-flex;align-items:center;gap:.5rem;min-height:2.3rem;padding:0 1rem 0 .8rem;border:1px solid var(--accent,#05749E);border-radius:999px;background:transparent;color:var(--link,#045E80);font:700 .84rem/1 var(--font-ui);cursor:pointer;margin-left:auto;transition:background .2s}',
    '.gm-suche-rand svg{width:18px;height:18px}',
    '.gm-suche-rand:hover{background:var(--accent-soft)}',
    '.gm-suche.is-empty .gm-suche-foot .gm-suche-rand{display:none}',
    '.gm-suche.is-empty .gm-suche-foot{display:none}',

    '.gm-suche-clear:focus-visible,.gm-suche-x:focus-visible,.gm-suche-seg button:focus-visible,.gm-suche-kind:focus-visible,.gm-suche-chip:focus-visible,.gm-suche-surprise:focus-visible,.gm-suche-rand:focus-visible,.gm-suche-jchip:focus-visible{outline:3px solid var(--accent);outline-offset:2px}',

    '@media (max-width:640px){',
    '.gm-suche{padding:0}',
    '.gm-suche-panel{width:100%;height:100vh;height:100dvh;border:0;border-radius:0;transform:translateY(14px)}',
    '.gm-suche-head{padding:max(.45rem,env(safe-area-inset-top)) .5rem .45rem .9rem}',
    '.gm-suche-x kbd,.gm-suche-hints{display:none}',
    '.gm-suche-x{padding:0;width:2.5rem;justify-content:center;border-color:var(--line)}',
    '.gm-suche-x svg{display:block}',
    '.gm-suche-x .l{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '.gm-suche-foot{padding-bottom:max(.6rem,env(safe-area-inset-bottom))}',
    '.gm-suche-rand{width:100%;justify-content:center}',
    '.gm-suche-opt{grid-template-columns:2.3rem minmax(0,1fr);gap:.7rem;margin-inline:.3rem}',
    '.gm-suche-ico{width:2.3rem;height:2.3rem}',
    '}',
    '@media (prefers-reduced-motion:reduce){.gm-suche-panel{transform:none!important}.gm-suche-chip:hover{transform:none}}'
  ].join('\n');

  function injectCss() {
    if (doc.getElementById('gm-suche-style')) return;
    var s = doc.createElement('style');
    s.id = 'gm-suche-style';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Aufbau
   * ------------------------------------------------------------------ */

  function build() {
    if (S.built) return;
    injectCss();
    var node = doc.getElementById('suche-overlay');
    if (!node) {
      node = el('div', { id: 'suche-overlay', class: 'gm-overlay gm-suche', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Suche', hidden: true });
      doc.body.appendChild(node);
    }
    node.classList.add('gm-overlay', 'gm-suche');
    if (!node.getAttribute('role')) node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.setAttribute('aria-label', 'Suche');
    node.textContent = '';
    S.node = node;
    S.group = sget('searchgroup', 'reise') === 'art' ? 'art' : 'reise';

    var input = el('input', {
      class: 'gm-suche-input', id: ID + 'input', type: 'text', role: 'combobox', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      enterkeyhint: 'go', placeholder: ('Person, Begriff, Jahr oder ' + M.t('journey') + ' …'), 'aria-label': (M.t('stations') + ' durchsuchen'),
      'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': ID + 'list', maxlength: '120'
    });
    S.input = input;
    S.clearBtn = el('button', { type: 'button', class: 'gm-suche-clear', hidden: true, 'aria-label': 'Eingabe leeren' }, 'Leeren');
    S.clearBtn.addEventListener('click', function () { setQuery(''); input.focus(); });
    var closeBtn = el('button', { type: 'button', class: 'gm-suche-x', 'aria-label': 'Suche schließen' },
      el('span', { class: 'l' }, 'Schließen'), el('kbd', { 'aria-hidden': 'true' }, 'Esc'), el('span', { 'aria-hidden': 'true', html: ico('close', 18) }));
    closeBtn.addEventListener('click', function () { close(); });

    /* Gruppierung */
    var seg = el('div', { class: 'gm-suche-seg', role: 'group', 'aria-label': 'Treffer gruppieren' });
    [['reise', ('Nach ' + M.t('journey'))], ['art', 'Nach Art']].forEach(function (g) {
      var b = el('button', { type: 'button', 'aria-pressed': S.group === g[0] ? 'true' : 'false', dataset: { g: g[0] } }, g[1]);
      b.addEventListener('click', function () {
        S.group = g[0];
        sset('searchgroup', S.group);
        S.segBtns.forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.g === S.group ? 'true' : 'false'); });
        render();
        if (M.announce) M.announce('Gruppiert ' + g[1].toLowerCase());
      });
      S.segBtns.push(b);
      seg.appendChild(b);
    });
    S.count = el('p', { class: 'gm-suche-count', 'aria-hidden': 'true' });
    S.status = el('div', { class: 'gm-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });

    /* Filter nach Art */
    var kinds = el('div', { class: 'gm-suche-kinds', role: 'group', 'aria-label': 'Nach Art filtern' });
    KIND_ORDER.forEach(function (k) {
      var kd = (M.kinds && M.kinds[k]) || { label: k, icon: 'lightbulb' };
      var b = el('button', { type: 'button', class: 'gm-suche-kind', 'aria-pressed': 'false', dataset: { k: k }, html: ico(kd.icon, 15) + '<span>' + (PLURAL[k] || kd.label) + '</span>' });
      b.addEventListener('click', function () {
        S.kind = S.kind === k ? null : k;
        syncKinds();
        render();
      });
      S.kindBtns[k] = b;
      kinds.appendChild(b);
    });

    /* Körper */
    S.list = el('div', { class: 'gm-suche-list', id: ID + 'list', role: 'listbox', 'aria-label': 'Suchergebnisse', hidden: true });
    S.note = el('div', { class: 'gm-suche-note', hidden: true });
    S.empty = buildEmpty();
    S.none = el('div', { class: 'gm-suche-none', hidden: true });
    S.body = el('div', { class: 'gm-suche-body' }, S.note, S.empty, S.none, S.list);

    var rand = el('button', { type: 'button', class: 'gm-suche-rand' },
      el('span', { 'aria-hidden': 'true', html: ico('dice', 18) }), 'Überrasch mich');
    rand.addEventListener('click', surprise);
    S.foot = el('div', { class: 'gm-suche-foot' },
      el('p', { class: 'gm-suche-hints', 'aria-hidden': 'true' },
        el('span', null, el('kbd', null, '↑'), el('kbd', null, '↓'), 'wählen'),
        el('span', null, el('kbd', null, '↵'), 'öffnen'),
        el('span', null, el('kbd', null, 'Esc'), 'schließen')),
      rand);

    S.panel = el('div', { class: 'gm-suche-panel' },
      el('div', { class: 'gm-suche-strip', 'aria-hidden': 'true', style: { background: stripGradient() } }),
      el('div', { class: 'gm-suche-head' },
        el('span', { class: 'gm-suche-lupe', 'aria-hidden': 'true', html: ico('search', 22) }), input, S.clearBtn, closeBtn),
      el('div', { class: 'gm-suche-tools' }, seg, S.count),
      kinds, S.body, S.foot, S.status);
    node.appendChild(S.panel);

    /* Ereignisse */
    input.addEventListener('input', function () { S.q = input.value; render(); });
    input.addEventListener('keydown', onInputKey);
    node.addEventListener('keydown', trapTab);
    node.addEventListener('mousedown', function (e) { if (e.target === node) { e.preventDefault(); } });
    node.addEventListener('click', function (e) { if (e.target === node) close(); });
    S.list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    S.list.addEventListener('click', function (e) {
      var o = e.target.closest ? e.target.closest('.gm-suche-opt') : null;
      if (o) pick(+o.dataset.n);
    });
    S.list.addEventListener('mousemove', function (e) {
      /* Chrome meldet nach dem Scrollen ein künstliches mousemove: nur echte Mausbewegung zählt */
      if (e.clientX === S.mx && e.clientY === S.my) return;
      S.mx = e.clientX; S.my = e.clientY;
      var o = e.target.closest ? e.target.closest('.gm-suche-opt') : null;
      if (o && +o.dataset.n !== S.active) setActive(+o.dataset.n, false);
    });
    S.built = true;
  }

  function chipEl(text, onClick, iconKey) {
    var b = el('button', { type: 'button', class: 'gm-suche-chip' }, el('span', { 'aria-hidden': 'true', html: ico(iconKey || 'search', 15) }), text);
    b.addEventListener('click', onClick);
    return b;
  }

  function suggestions() {
    var idx = getIndex();
    if (S.sugg && S.suggN === idx.length) return S.sugg;
    var out = [], D = stations(), used = {};
    WANTED.forEach(function (w) {
      var nw = nrm(w), r = scoreAll(idx, tokensOf(w), true);
      if (r.some(function (x) { return x.e.nTitle.indexOf(nw) >= 0; })) out.push(w);
    });
    out.forEach(function (w) { used[nrm(w)] = true; });
    if (out.length < 4) {
      var ids = Object.keys(D).filter(function (id) { return D[id] && D[id].title; });
      for (var i = ids.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
      var kindsSeen = {};
      ids.forEach(function (id) {
        if (out.length >= 4) return;
        var st = D[id], tt = shortTitle(st.title);
        if (tt.length > 28 || kindsSeen[st.kind] > 1 || used[nrm(tt)]) return;
        kindsSeen[st.kind] = (kindsSeen[st.kind] || 0) + 1;
        used[nrm(tt)] = true;
        out.push(tt);
      });
    }
    S.sugg = out;
    S.suggN = idx.length;
    return out;
  }

  function buildEmpty() {
    var wrap = el('div', { class: 'gm-suche-empty' });
    wrap.appendChild(el('h2', { class: 'gm-suche-eh' }, 'Wonach suchst du?'));
    wrap.appendChild(el('p', { class: 'gm-suche-ep' }, ('Ein Name, ein Begriff, ein Jahr oder eine ' + M.t('journey') + '. Umlaute, Groß- und Kleinschreibung sind egal.')));
    var sg = el('div', { class: 'gm-suche-sug' });
    wrap.appendChild(sg);
    var jw = el('div', { class: 'gm-suche-jw' });
    wrap.appendChild(jw);
    wrap._jw = jw;
    var sb = el('button', { type: 'button', class: 'gm-suche-surprise' },
      el('span', { class: 'ic', 'aria-hidden': 'true', html: ico('dice', 22) }),
      el('span', null, el('b', null, 'Überrasch mich'), el('span', { class: 's' }, ('Öffnet eine zufällige ' + M.t('station') + ', am liebsten eine, die du noch nicht kennst.'))));
    sb.addEventListener('click', surprise);
    wrap.appendChild(sb);
    wrap._sug = sg;
    return wrap;
  }

  function fillSuggestions(box) {
    box.textContent = '';
    var list = suggestions();
    if (!list.length) return;
    box.appendChild(el('p', { class: 'gm-suche-lab', id: ID + 'sug' }, 'Vielleicht neugierig auf'));
    var ul = el('ul', { class: 'gm-suche-chips', 'aria-labelledby': ID + 'sug' });
    list.forEach(function (w) {
      ul.appendChild(el('li', null, chipEl(w, function () { setQuery(w); S.input.focus(); })));
    });
    box.appendChild(ul);
  }

  function fillJourneys(box) {
    if (box.firstChild) return;
    var js = ((M.data && M.data.journeys) || []).filter(function (j) { return j && !j.virtual && journeyOf(j.id) && (!spielAn() || M.spiel.zugang('episode/' + j.id).sichtbar); });
    if (!js.length) return;
    box.appendChild(el('p', { class: 'gm-suche-lab', id: ID + 'jl' }, ('Oder gleich auf ' + M.t('journey') + ' gehen')));
    var ul = el('ul', { class: 'gm-suche-chips gm-suche-jchips', 'aria-labelledby': ID + 'jl' });
    js.forEach(function (j) {
      var b = el('button', { type: 'button', class: 'gm-suche-chip gm-suche-jchip', style: { '--jc': jColor(j.id) }, title: j.name },
        el('i', { 'aria-hidden': 'true' }), j.kurz || j.name);
      b.addEventListener('click', function () { go({ type: 'journey', id: j.id }); });
      ul.appendChild(el('li', null, b));
    });
    box.appendChild(ul);
  }

  function syncKinds() {
    Object.keys(S.kindBtns).forEach(function (k) { S.kindBtns[k].setAttribute('aria-pressed', S.kind === k ? 'true' : 'false'); });
  }

  /* ------------------------------------------------------------------ *
   * Darstellung
   * ------------------------------------------------------------------ */

  function optionEl(it, hl) {
    var n = it.n, row, main;
    if (it.type === 'journey') {
      var j = it.j, cnt = ((M.data.orders && M.data.orders[j.id]) || []).length;
      if (it.gesperrt) {   // Spielplan: nur Titel und Hinweis, kein Inhalt
        main = el('div', { class: 'gm-suche-main' },
          el('p', { class: 'gm-suche-title' }, marked(j.name, hl)),
          el('p', { class: 'gm-suche-meta' }, el('span', { class: 'gm-suche-badge' }, M.t('journey')), el('span', { class: 'gm-suche-badge is-zu' }, M.t('spielGesperrt'))),
          el('p', { class: 'gm-suche-ex' }, it.gesperrt.bedingung || ''));
        return el('div', { class: 'gm-suche-opt is-locked', role: 'option', id: ID + 'o' + n, 'aria-selected': 'false', dataset: { n: n }, style: { '--jc': jColor(j.id) } },
          el('span', { class: 'gm-suche-ico', 'aria-hidden': 'true', html: ico('lock', 20) }), main);
      }
      main = el('div', { class: 'gm-suche-main' },
        el('p', { class: 'gm-suche-title' }, marked(j.name, hl)),
        el('p', { class: 'gm-suche-meta' }, el('span', { class: 'gm-suche-badge' }, M.t('journey')),
          cnt ? el('span', null, cnt + ' ' + plural(cnt, M.t('station'), M.t('stations'))) : null),
        j.tagline ? el('p', { class: 'gm-suche-ex' }, j.tagline) : null);
      row = el('div', { class: 'gm-suche-opt', role: 'option', id: ID + 'o' + n, 'aria-selected': 'false', dataset: { n: n }, style: { '--jc': jColor(j.id) } },
        el('span', { class: 'gm-suche-ico', 'aria-hidden': 'true', html: ico(j.icon || 'train', 20) }), main);
      return row;
    }
    var st = it.st, kd = kindOf(st), jids = (st.journeys || []).filter(isRealJourney), home = it.home || jids[0] || null;
    if (it.gesperrt) {   // Spielplan: nur Titel und Hinweis, kein Inhalt, keine Reisen, kein Jahr
      main = el('div', { class: 'gm-suche-main' },
        el('p', { class: 'gm-suche-title' }, marked(st.title, hl)),
        el('p', { class: 'gm-suche-meta' }, el('span', { class: 'gm-suche-badge' }, kd.label), el('span', { class: 'gm-suche-badge is-zu' }, M.t('spielGesperrt'))),
        el('p', { class: 'gm-suche-ex' }, it.gesperrt.bedingung || ''));
      return el('div', { class: 'gm-suche-opt is-locked', role: 'option', id: ID + 'o' + n, 'aria-selected': 'false', dataset: { n: n }, style: { '--jc': home ? jColor(home) : 'var(--accent)' } },
        el('span', { class: 'gm-suche-ico', 'aria-hidden': 'true', html: ico('lock', 20) }), main);
    }
    var meta = el('p', { class: 'gm-suche-meta' }, el('span', { class: 'gm-suche-badge' }, kd.label));
    if (jids.length > 1) meta.appendChild(el('span', { class: 'gm-suche-badge is-kreuz' }, M.t('interchange')));
    var yt = yearText(st);
    if (yt) meta.appendChild(el('span', { class: 'gm-suche-year' }, yt));
    jids.forEach(function (id) {
      var jj = journeyOf(id);
      meta.appendChild(el('span', { class: 'gm-suche-jp', style: { '--jc': jColor(id) }, title: jj.name }, el('i', { 'aria-hidden': 'true' }), jj.kurz || jj.name));
    });
    if (M.store && M.store.isVisited(st.id)) {
      meta.appendChild(el('span', { class: 'gm-suche-seen' }, el('span', { 'aria-hidden': 'true', html: ico('check', 13) }), 'besucht'));
    }
    main = el('div', { class: 'gm-suche-main' }, el('p', { class: 'gm-suche-title' }, marked(st.title, hl)), meta, excerpt(st, hl));
    row = el('div', { class: 'gm-suche-opt', role: 'option', id: ID + 'o' + n, 'aria-selected': 'false', dataset: { n: n }, style: { '--jc': home ? jColor(home) : 'var(--accent)' } },
      el('span', { class: 'gm-suche-ico', 'aria-hidden': 'true', html: ico(st.icon || kd.icon, 20) }), main);
    return row;
  }

  function render() {
    if (!S.built) return;
    var inp = S.input;
    if (inp.value !== S.q) inp.value = S.q;
    S.clearBtn.hidden = !S.q;
    var R = compute();
    S.items = R.flat;
    S.list.textContent = '';
    S.opts = [];
    var isEmpty = !R.toks.length && !S.kind;
    S.node.classList.toggle('is-empty', isEmpty);
    S.empty.hidden = !isEmpty;
    if (isEmpty) { fillSuggestions(S.empty._sug); fillJourneys(S.empty._jw); }

    var hasItems = R.flat.length > 0;
    S.list.hidden = !hasItems;
    inp.setAttribute('aria-expanded', hasItems ? 'true' : 'false');

    /* Hinweis (Tippfehler, Teiltreffer) */
    S.note.hidden = true;
    S.note.textContent = '';
    if (R.note && hasItems) {
      if (R.note.kind === 'fuzzy') {
        S.note.appendChild(doc.createTextNode('Keine Treffer für „' + R.note.said + '“. Gezeigt wird „'));
        S.note.appendChild(el('b', null, R.note.shown));
        S.note.appendChild(doc.createTextNode('“.'));
      } else {
        S.note.textContent = ('Keine ' + M.t('station') + ' enthält alle Wörter. Das sind die nächsten Treffer.');
      }
      S.note.hidden = false;
    }

    /* Keine Treffer */
    S.none.hidden = true;
    S.none.textContent = '';
    if (!hasItems && !isEmpty) {
      S.none.hidden = false;
      var said = S.q.trim();
      S.none.appendChild(el('h2', { class: 'gm-suche-eh' }, said ? 'Dazu finde ich nichts.' : ('Keine ' + M.t('stations') + ' dieser Art.')));
      S.none.appendChild(el('p', { class: 'gm-suche-ep' }, said
        ? 'Für „' + said + ('“ gibt es keinen Treffer. Versuch ein kürzeres Wort, einen Namen, ein Jahr oder die Kurzform einer ' + M.t('journey') + '.')
        : 'Wähle eine andere Art oder gib ein Suchwort ein.'));
      var sg = el('div', { class: 'gm-suche-sug' });
      S.none.appendChild(sg);
      fillSuggestions(sg);
    }

    /* Gruppen */
    /* Viele Treffer (z. B. bei „a“) kommen in Etappen: die ersten sofort, der Rest im nächsten Frame */
    cancelAnimationFrame(S.chunkRaf);
    var frag = doc.createDocumentFragment(), queue = [];
    R.groups.forEach(function (g, gi) {
      var hid = ID + 'g' + gi;
      var grp = el('div', { role: 'group', 'aria-labelledby': hid, class: 'gm-suche-grp' },
        el('div', { class: 'gm-suche-gh', id: hid, style: { '--gc': g.color } },
          el('span', { 'aria-hidden': 'true', html: ico(g.icon, 17) }),
          el('span', { class: 't' }, g.label),
          el('span', { class: 'n' }, String(g.items.length))));
      g.items.forEach(function (it) { queue.push({ it: it, grp: grp }); });
      frag.appendChild(grp);
    });
    S.list.appendChild(frag);
    var qi = 0;
    function pump(max) {
      var end = Math.min(queue.length, qi + max);
      for (; qi < end; qi++) {
        var o = optionEl(queue[qi].it, R.hl);
        queue[qi].grp.appendChild(o);
        S.opts.push(o);
      }
      if (qi < queue.length) S.chunkRaf = requestAnimationFrame(function () { pump(30); });
    }
    pump(24);

    var nTxt = '';
    if (R.toks.length || S.kind) {
      nTxt = R.browse ? R.nStations + ' ' + plural(R.nStations, M.t('station'), M.t('stations'))
        : (hasItems ? R.flat.length + ' ' + plural(R.flat.length, 'Treffer', 'Treffer') : 'Keine Treffer');
    }
    S.count.textContent = nTxt;
    S.active = -1;
    S.input.removeAttribute('aria-activedescendant');
    if (hasItems) setActive(0, false);
    S.body.scrollTop = 0;
    announceLater(nTxt, hasItems);
  }

  function announceLater(txt, hasItems) {
    clearTimeout(S.annT);
    if (!txt) { S.status.textContent = ''; return; }
    S.annT = setTimeout(function () {
      S.status.textContent = hasItems ? txt + '. Mit den Pfeiltasten auswählen, mit Enter öffnen.' : txt + '.';
    }, 450);
  }

  function setActive(i, scroll) {
    if (S.active >= 0 && S.opts[S.active]) S.opts[S.active].setAttribute('aria-selected', 'false');
    S.active = i;
    var o = S.opts[i];
    if (!o) { S.input.removeAttribute('aria-activedescendant'); return; }
    o.setAttribute('aria-selected', 'true');
    S.input.setAttribute('aria-activedescendant', o.id);
    if (scroll) {
      if (i === 0) S.body.scrollTop = 0;
      else {
        try { o.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { o.scrollIntoView(false); }
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Eingabe, Auswahl, Fokus
   * ------------------------------------------------------------------ */

  function onInputKey(e) {
    var n = S.opts.length, k = e.key;
    if (e.isComposing) return;
    if (k === 'ArrowDown') {
      e.preventDefault();
      if (n) setActive(S.active < 0 ? 0 : (S.active + 1) % n, true);
    } else if (k === 'ArrowUp') {
      e.preventDefault();
      if (n) setActive(S.active <= 0 ? n - 1 : S.active - 1, true);
    } else if (k === 'PageDown' && n) {
      e.preventDefault();
      setActive(Math.min(n - 1, Math.max(0, S.active) + 5), true);
    } else if (k === 'PageUp' && n) {
      e.preventDefault();
      setActive(Math.max(0, S.active - 5), true);
    } else if (k === 'Enter') {
      e.preventDefault();
      if (S.active >= 0) pick(S.active);
      else if (n) pick(0);
    }
  }

  function trapTab(e) {
    if (e.key !== 'Tab') return;
    var f = [].filter.call(S.node.querySelectorAll('button,input,[href],[tabindex]:not([tabindex="-1"])'), function (x) {
      return !x.disabled && !x.hidden && x.getClientRects().length > 0;
    });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = doc.activeElement;
    if (e.shiftKey && (a === first || !S.node.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !S.node.contains(a))) { e.preventDefault(); first.focus(); }
  }

  function go(it) {
    close({ restoreFocus: false });
    if (it.type === 'journey') {
      if (M.nav && M.nav.openJourney) M.nav.openJourney(it.id);
      else location.hash = '#/reise/' + encodeURIComponent(it.id);
    } else if (M.nav && M.nav.openStation) {
      M.nav.openStation(it.id, it.jid || undefined);
    } else {
      location.hash = '#/station/' + encodeURIComponent(it.id);
    }
  }

  function pick(i) {
    var it = S.items[i];
    if (it) go(it);
  }

  function surprise() {
    var D = stations(), ids = Object.keys(D);
    if (!ids.length) return;
    if (spielAn()) ids = ids.filter(function (id) { return M.spiel.zugang('inhalt/' + id).offen; });   // Spielplan: keine verschlossene Überraschung
    if (!ids.length) return;
    var fresh = ids.filter(function (id) { try { return !M.store.isVisited(id); } catch (e) { return true; } });
    var pool = fresh.length ? fresh : ids;
    var id = pool[Math.floor(Math.random() * pool.length)];
    go({ type: 'station', id: id, jid: null });
  }

  function setQuery(q) {
    build();
    S.q = String(q || '');
    S.input.value = S.q;
    render();
  }

  function isOpen() { return !!S.built && !S.node.hidden && !S.node.classList.contains('is-closing'); }

  function open(q) {
    build();
    if (typeof q === 'string') { S.q = q; S.kind = null; syncKinds(); }
    else if (!isOpen()) { S.q = ''; S.kind = null; syncKinds(); }
    render();
    if (M.ui && M.ui.overlay) {
      M.ui.overlay.open(S.node, { onClose: function () { close(); }, focus: S.input });
    } else {
      S.node.hidden = false;
      S.node.classList.add('is-open');
      S.input.focus();
    }
    try { S.input.focus({ preventScroll: true }); S.input.select(); } catch (e) { /* egal */ }
  }

  function close(o) {
    if (!S.built) return;
    if (M.ui && M.ui.overlay) M.ui.overlay.close(S.node, o);
    else { S.node.hidden = true; S.node.classList.remove('is-open'); }
    clearTimeout(S.annT);
    cancelAnimationFrame(S.chunkRaf);
  }

  M.search = { open: open, close: close, isOpen: isOpen, setQuery: setQuery };
})();

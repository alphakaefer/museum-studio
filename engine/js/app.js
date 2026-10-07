/* ==========================================================================
   Museum Studio – js/app.js
   Start in der richtigen Reihenfolge: finalize, Theme, Eingang (Zahlen, Reise-Karten, Hero),
   Kopfleiste, Ansichten mounten, Router, Tastenkürzel.

   Setzt eine Seite window.MUSEUM_MANUAL_START = true, startet sie selbst mit MUSEUM.app.start()
   (so macht es tools/dev.html, nachdem die Dev-Fixture die Platzhalter angelegt hat).
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  var doc = document;
  var started = false;

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return [].slice.call((root || doc).querySelectorAll(sel)); }
  function ico(key, size) { return M.icons && M.icons.svg ? M.icons.svg(key, { size: size || 20 }) : ''; }

  function hydrateIcons(rootEl) {
    $$('[data-icon]', rootEl).forEach(function (n) {
      if (n.firstChild) return;
      n.innerHTML = ico(n.getAttribute('data-icon'), parseInt(n.getAttribute('data-size'), 10) || 20);
    });
  }


  /* ---------------- Seitentexte aus dem Paket (pack.json, vocab) ---------------- */

  var SVGNS = 'http://www.w3.org/2000/svg';

  // [Text](Adresse) in einem Absatz zu Links machen; alles andere wird als Text eingesetzt (kein HTML aus Daten)
  function richText(parent, text) {
    var re = /\[([^\]]+)\]\(([^)\s]+)\)/g, last = 0, m;
    text = String(text || '');
    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(doc.createTextNode(text.slice(last, m.index)));
      var href = m[2];
      if (/^(https?:|tel:|mailto:|#)/i.test(href)) {
        var ext = /^https?:/i.test(href);
        var a = M.el('a', { href: href, target: ext ? '_blank' : null, rel: ext ? 'noopener' : null }, m[1],
          ext ? M.el('span', { class: 'gm-sr' }, M.t('newTab')) : null);
        parent.appendChild(a);
      } else parent.appendChild(doc.createTextNode(m[1]));
      last = re.lastIndex;
    }
    if (last < text.length) parent.appendChild(doc.createTextNode(text.slice(last)));
  }

  // Fuß: pack.footer.columns = [{ title, paragraphs: ['Text mit [Link](https://…)', …] }]; ohne Angabe der Datenschutz-Hinweis
  function renderFooter() {
    var host = $('#fuss-spalten');
    if (!host) return;
    host.innerHTML = '';
    var F = M.pack.footer;
    var cols = F && Array.isArray(F.columns) ? F.columns : null;
    if (!cols && typeof F === 'string' && F.trim()) {
      // reiner Text: eine Spalte „Hinweis“; Leerzeilen trennen Absätze
      var paras = F.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      cols = [{ title: M.t('footNoteTitle'), paragraphs: paras }];
    }
    if (!cols) {
      cols = [{ title: M.t('footPrivacyTitle'), paragraphs: [M.t('footPrivacyText'), M.t('footIcons')] }];
    }
    cols.forEach(function (c, i) {
      var hid = 'fuss-h' + i;
      var sec = M.el('section', { class: 'gm-foot-col', 'aria-labelledby': hid }, M.el('h2', { class: 'gm-foot-h', id: hid }, c.title || ''));
      (c.paragraphs || []).forEach(function (p, k) {
        var para = M.el('p', { class: c.classes && c.classes[k] ? c.classes[k] : null });
        richText(para, p);
        sec.appendChild(para);
      });
      host.appendChild(sec);
    });
    var extra = [M.pack.license, M.pack.credits].filter(function (x) { return typeof x === 'string' && x; });
    if (extra.length) {
      var last = host.lastElementChild;
      extra.forEach(function (x) { var p = M.el('p', { class: 'gm-foot-legal' }); richText(p, x); if (last) last.appendChild(p); });
    }
  }

  // Signet im Eingang: je Reise ein Faden in Reisefarbe, alle laufen durch die Mitte
  function renderEmblem() {
    var g = $('#emblem-linien');
    if (!g) return;
    var js = (M.data.journeys || []).filter(function (j) { return !j.virtual; });
    var n = js.length;
    if (!n) return;
    var y0 = 4, y1 = 60, step = n > 1 ? (y1 - y0) / (n - 1) : 0;
    // Endposition: gegenläufig verwürfelt (Schrittweite teilerfremd zu n)
    var k = Math.max(1, Math.round(n * 0.618));
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    while (gcd(k, n) !== 1) k++;
    js.forEach(function (j, i) {
      var ys = n > 1 ? y0 + i * step : 32;
      var ye = n > 1 ? y0 + ((i * k + 3) % n) * step : 32;
      var p = doc.createElementNS(SVGNS, 'path');
      p.setAttribute('pathLength', '1');
      p.setAttribute('style', '--d:' + i);
      p.setAttribute('stroke', 'var(--j-' + j.id + ')');
      p.setAttribute('d', 'M0 ' + ys.toFixed(1) + 'C62 ' + ys.toFixed(1) + ' 66 32 120 32S178 ' + ye.toFixed(1) + ' 240 ' + ye.toFixed(1));
      g.appendChild(p);
    });
    // Streifen unten im Eingang
    var stops = [], h = 0;
    js.forEach(function (j) {
      stops.push('var(--j-' + j.id + ') ' + h + 'px ' + (h + 2) + 'px', 'transparent ' + (h + 2) + 'px ' + (h + 3) + 'px');
      h += 3;
    });
    doc.documentElement.style.setProperty('--hero-stripes', 'linear-gradient(to bottom, ' + stops.join(', ') + ')');
    doc.documentElement.style.setProperty('--hero-stripes-h', h + 'px');
    // waagerechter Reisebalken für Skins: weich (--hero-bar) und in harten Blöcken (--hero-bar-hard)
    var soft = js.map(function (j) { return 'var(--j-' + j.id + ')'; });
    var hard = js.map(function (j, i) { return 'var(--j-' + j.id + ') ' + (i * 100 / n).toFixed(3) + '% ' + ((i + 1) * 100 / n).toFixed(3) + '%'; });
    doc.documentElement.style.setProperty('--hero-bar', soft.length > 1 ? 'linear-gradient(90deg, ' + soft.join(', ') + ')' : soft[0] ? 'linear-gradient(90deg, ' + soft[0] + ', ' + soft[0] + ')' : 'none');
    doc.documentElement.style.setProperty('--hero-bar-hard', 'linear-gradient(90deg, ' + hard.join(', ') + ')');
  }

  function hydrateText() {
    var n = (M.data.journeys || []).length;
    $$('[data-t]').forEach(function (node) { node.textContent = M.t(node.getAttribute('data-t')); });
    $$('[data-t-aria]').forEach(function (node) { node.setAttribute('aria-label', M.t(node.getAttribute('data-t-aria'))); });
    $$('[data-pack]').forEach(function (node) { node.textContent = M.pack[node.getAttribute('data-pack')] || ''; });
    // Längenstufe des Museumsnamens für Skins mit großer Schrift: data-len="long" ab 24, "xlong" ab 34 Zeichen
    var ttl = $('#titel');
    if (ttl) { var len = String(M.pack.title || '').length; if (len > 24) ttl.setAttribute('data-len', len > 34 ? 'xlong' : 'long'); }
    $$('[data-typ-label]').forEach(function (node) {
      var typ = node.getAttribute('data-typ-label');
      node.textContent = M.typeLabel(typ) + ' – ' + M.typeLabel(typ, 'sub');
    });
    var brand = $('#marke');
    if (brand) brand.setAttribute('aria-label', M.t('brandAria', { title: M.pack.title || '' }));
    var halle = $('#halle');
    if (halle) halle.setAttribute('aria-label', M.t('hallLabel'));
    if (M.pack.lang) doc.documentElement.setAttribute('lang', M.pack.lang);
    // Ansichten, die es nicht gibt, ausblenden: Zeitstrahl ohne historische Reisen, Exponate ohne Exponate
    var hasTime = M.hasTimeline();
    $$('[data-view="zeitstrahl"], #cta-zeit').forEach(function (a) { a.hidden = !hasTime; a.style.display = hasTime ? '' : 'none'; });
    var tabs = $('.gm-tabs');
    if (tabs) tabs.style.gridTemplateColumns = hasTime ? '' : 'repeat(2, 1fr)';
    var ex = counts().exponate;
    var exStat = $('#stat-exponate');
    if (exStat) { exStat.hidden = !ex; exStat.style.display = ex ? '' : 'none'; }
    var stats = $('#zahlen');
    if (stats && !ex) stats.style.gridTemplateColumns = 'repeat(3, 1fr)';
    var tour = $('#cta-tour');
    var hasTour = !!(M.data.journeyById && M.data.journeyById.rundreise);
    if (tour) { tour.hidden = !hasTour; tour.style.display = hasTour ? '' : 'none'; }
    // Reisegruppen ohne Reisen ausblenden
    ['funktional', 'historisch'].forEach(function (typ) {
      var box = $('#reisen-' + typ);
      var any = M.data.journeys.some(function (j) { return (j.typ === 'historisch') === (typ === 'historisch'); });
      if (box) box.hidden = !any;
    });
    if (n === 0) { var tr = $('#reisen'); if (tr) tr.hidden = true; }
    renderFooter();
    renderEmblem();
  }

  /* ---------------- Skin-Umschaltung ---------------- */

  function bindSkin() {
    var wrap = $('#skin-wrap');
    if (!wrap) return;
    var skins = M.skins || [];
    if (skins.length < 2) { wrap.hidden = true; return; }
    wrap.hidden = false;
    wrap.innerHTML = '';
    var menuId = 'skin-menu';
    var btn = M.el('button', {
      type: 'button', class: 'gm-iconbtn gm-skin-btn', id: 'skin-knopf', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': menuId,
      title: M.t('skinHint')
    },
      M.el('span', { class: 'gm-ico', html: M.ui.icon('palette', 20) }),
      M.el('span', { class: 'gm-skin-label' }, M.t('skinLabel')));
    var menu = M.el('div', { class: 'gm-skin-menu', id: menuId, role: 'group', 'aria-label': M.t('skinHint'), hidden: true });
    var items = {};
    menu.appendChild(M.el('p', { class: 'gm-skin-h' }, M.t('skinLabel')));
    skins.forEach(function (sk) {
      var b = M.el('button', { type: 'button', class: 'gm-skin-item', 'aria-pressed': 'false', dataset: { skin: sk.id } },
        M.el('span', { class: 'gm-skin-name' }, sk.name || sk.id),
        sk.description ? M.el('span', { class: 'gm-skin-desc' }, sk.description) : null);
      b.addEventListener('click', function () {
        M.skin.set(sk.id);
        M.announce(M.t('skinLabel') + ': ' + (sk.name || sk.id));
        close(true);
      });
      items[sk.id] = b;
      menu.appendChild(b);
    });
    wrap.appendChild(btn);
    wrap.appendChild(menu);

    function paint() {
      var cur = M.skin.get();
      skins.forEach(function (sk) { items[sk.id].setAttribute('aria-pressed', sk.id === cur ? 'true' : 'false'); });
      var c = M.skin.current();
      btn.setAttribute('aria-label', M.t('skinLabel') + ': ' + (c ? c.name || c.id : ''));
      // Skins nur für hell oder nur für dunkel steuern die Darstellung selbst: Umschalter dann ohne Wirkung
      var tb = $('#theme-knopf');
      if (tb) tb.hidden = !!(c && (c.mode === 'light' || c.mode === 'dark'));
    }
    function open() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      var cur = items[M.skin.get()] || menu.firstChild;
      if (cur) cur.focus();
      setTimeout(function () { doc.addEventListener('click', away, true); }, 0);
    }
    function close(refocus) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      doc.removeEventListener('click', away, true);
      if (refocus) btn.focus();
    }
    function away(e) { if (!wrap.contains(e.target)) close(false); }
    btn.addEventListener('click', function () { if (menu.hidden) open(); else close(true); });
    menu.addEventListener('keydown', function (e) {
      var list = [].slice.call(menu.querySelectorAll('button'));
      var i = list.indexOf(doc.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      else if (e.key === 'Tab') close(false);
    });
    doc.addEventListener('gm:skin', paint);
    paint();
  }

  /* ---------------- Theme-Knopf ---------------- */

  var THEME_LABEL = { auto: 'automatisch (nach System)', light: 'hell', dark: 'dunkel' };
  var THEME_ICON = { auto: 'sunmoon', light: 'sun', dark: 'moon' };

  function paintThemeBtn() {
    var b = $('#theme-knopf');
    if (!b) return;
    var mode = M.theme.get();
    b.innerHTML = '<span class="gm-ico">' + ico(THEME_ICON[mode], 20) + '</span>';
    b.setAttribute('aria-label', 'Darstellung wechseln. Aktuell: ' + THEME_LABEL[mode]);
    b.title = 'Darstellung: ' + THEME_LABEL[mode] + ' (klicken zum Wechseln)';
  }
  function bindTheme() {
    var b = $('#theme-knopf');
    if (!b) return;
    paintThemeBtn();
    b.addEventListener('click', function () {
      var m = M.theme.cycle();
      paintThemeBtn();
      M.announce('Darstellung: ' + THEME_LABEL[m]);
    });
  }

  /* ---------------- Zahlen ---------------- */

  function counts() {
    var D = M.data;
    var ex = {};
    Object.keys(D.stations).forEach(function (id) { if (D.stations[id].exhibit) ex[D.stations[id].exhibit] = true; });
    return {
      reisen: D.journeys.length,
      stationen: Object.keys(D.stations).length,
      kreuzungen: (M.crossings || []).length,
      exponate: Object.keys(ex).length
    };
  }

  function countUp(node, to) {
    if (M.reducedMotion() || to <= 0 || !window.requestAnimationFrame) { node.textContent = String(to); return; }
    var t0 = null, dur = 1100;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = String(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Zahlen in Worten (Hero-Claim, Überschriften) und Anzahl je Reisetyp
  function renderWords() {
    var D = M.data;
    $$('[data-count-typ]').forEach(function (node) {
      var typ = node.getAttribute('data-count-typ');
      var k = D.journeys.filter(function (j) { return (j.typ === 'historisch') === (typ === 'historisch'); }).length;
      node.textContent = String(k);
      node.setAttribute('aria-label', k + (k === 1 ? (' ' + M.t('journey')) : (' ' + M.t('journeys'))));
    });
  }

  function renderStats() {
    var c = counts();
    var nodes = $$('[data-count]');
    nodes.forEach(function (n) { n.setAttribute('data-to', String(c[n.getAttribute('data-count')] || 0)); });
    var ran = false;
    function run() {
      if (ran) return;
      ran = true;
      nodes.forEach(function (n) { countUp(n, parseInt(n.getAttribute('data-to'), 10) || 0); });
    }
    var box = $('.gm-stats');
    if (!box || !('IntersectionObserver' in window) || M.reducedMotion()) { run(); return; }
    nodes.forEach(function (n) { n.textContent = '0'; });
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); run(); }
    }, { threshold: 0.5 });
    io.observe(box);
    setTimeout(run, 12000); // Sicherheitsnetz: Zahlen nie dauerhaft bei 0 lassen
  }

  /* ---------------- Reise-Karten ---------------- */

  var cardRefs = {};

  function buildCard(j) {
    var D = M.data;
    var order = D.orders[j.id] || [];
    var xCount = order.filter(function (id) { return D.stations[id] && D.stations[id].journeys.length > 1; }).length;
    var strip = M.el('div', { class: 'gm-strip', 'aria-hidden': 'true', style: { '--n': String(Math.max(order.length, 8)) } });
    var dots = order.map(function (id) {
      var d = M.el('span', { class: 'gm-dot' + (D.stations[id] && D.stations[id].journeys.length > 1 ? ' is-x' : '') });
      strip.appendChild(d);
      return { id: id, node: d };
    });
    var prog = M.el('span', { class: 'gm-card-prog' });
    var tool = !!j.tool;   // Werkzeug-Reise (journeys.js: tool:true), gilt für alle anderen Reisen
    var card = M.el('article', { class: 'gm-card' + (tool ? ' is-tool' : ''), role: 'listitem', style: { '--jc': 'var(--j-' + j.id + ')' }, dataset: { journey: j.id } },
      M.el('div', { class: 'gm-card-top' },
        M.el('span', { class: 'gm-card-ico', 'aria-hidden': 'true', html: ico(j.icon || 'train', 28) }),
        M.el('span', { class: 'gm-card-count' },
          M.el('strong', null, order.length + (order.length === 1 ? (' ' + M.t('station')) : (' ' + M.t('stations')))),
          M.el('span', null, xCount + (xCount === 1 ? (' ' + M.t('interchange')) : (' ' + M.t('interchanges')))))),
      tool ? M.el('p', { class: 'gm-card-badge' }, M.t('toolBadge')) : null,
      M.el('h4', { class: 'gm-card-title' }, j.name),
      M.el('p', { class: 'gm-card-tag' }, j.tagline || ''),
      strip,
      M.el('div', { class: 'gm-card-foot' },
        prog,
        M.el('a', { class: 'gm-btn gm-btn-ghost', href: '#/reise/' + encodeURIComponent(j.id) },
          M.el('span', null, (M.t('journey') + ' antreten')),
          M.el('span', { class: 'gm-sr' }, ': ' + j.name),
          M.el('span', { 'aria-hidden': 'true', html: ico('arrow-right', 18) }))));
    cardRefs[j.id] = { dots: dots, prog: prog, total: order.length };
    return card;
  }

  function updateCards() {
    Object.keys(cardRefs).forEach(function (jid) {
      var ref = cardRefs[jid];
      ref.dots.forEach(function (d) { d.node.classList.toggle('is-seen', M.store.isVisited(d.id)); });
      var p = M.store.progress(jid);
      ref.prog.textContent = p.total === 0 ? ('Noch keine ' + M.t('stations'))
        : (p.done >= p.total ? 'Alle ' + p.total + ' besucht' : (p.done > 0 ? p.done + ' von ' + p.total + ' besucht' : 'Noch nicht besucht'));
    });
  }

  function renderCards() {
    cardRefs = {};
    var fun = $('#reise-karten-funktional');
    var his = $('#reise-karten-historisch');
    if (fun) fun.innerHTML = '';
    if (his) his.innerHTML = '';
    M.data.journeys.forEach(function (j) {
      var host = j.typ === 'historisch' ? his : fun;
      if (host) host.appendChild(buildCard(j));
    });
    updateCards();
    M.store.onChange(updateCards);
  }

  /* ---------------- Kopfleiste ---------------- */

  function bindHeader() {
    var head = $('#kopf');
    var hero = $('#eingang');
    if (!head) return;
    function measure() { doc.documentElement.style.setProperty('--header-h', head.offsetHeight + 'px'); }
    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(head);
    else window.addEventListener('resize', measure);

    var ticking = false;
    function tone() {
      ticking = false;
      if (!hero) { head.setAttribute('data-tone', 'auto'); return; }
      var over = hero.getBoundingClientRect().bottom > head.offsetHeight * 0.7;
      head.setAttribute('data-tone', over ? 'dark' : 'auto');
    }
    tone();
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(tone); }
    }, { passive: true });
    window.addEventListener('resize', tone);

    // Marke und Tabs: Klick auf die Marke führt zum Eingang und nach oben
    var brand = $('.gm-brand');
    if (brand) brand.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: M.reducedMotion() ? 'auto' : 'smooth' });
    });
  }

  function openSearch() {
    if (M.search && typeof M.search.open === 'function') M.search.open();
    else M.toast('Die Suche wird gerade eingerichtet.');
  }
  function bindSearch() {
    var b = $('#such-knopf');
    if (b) b.addEventListener('click', openSearch);
  }

  /* ---------------- Eingang: Hero ---------------- */

  function startHero() {
    var c = $('#hero-canvas');
    if (!c || !M.hero || typeof M.hero.start !== 'function') return;
    if (!c.getClientRects().length) return;
    try { M.hero.start(c); } catch (e) { if (window.console) console.warn('[Museum Studio] Hero konnte nicht starten', e); }
  }

  /* ---------------- Tastenkürzel ---------------- */

  function isTyping(t) {
    return !!t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
  }
  function shortcuts() {
    var chordAt = 0;
    var VIEW = { k: 'karte', z: 'zeitstrahl', p: 'reisepass' };
    doc.addEventListener('keydown', function (e) {
      if (e.defaultPrevented) return;
      var k = e.key;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && k && k.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (k === '/') { e.preventDefault(); openSearch(); return; }
      if (M.ui.overlay.isOpen()) { chordAt = 0; return; }
      if (chordAt && Date.now() - chordAt < 1200 && VIEW[k]) {
        chordAt = 0;
        e.preventDefault();
        M.nav.openView(VIEW[k]);
        return;
      }
      chordAt = (k === 'g') ? Date.now() : 0;
    });
  }

  /* ---------------- Start ---------------- */

  function start() {
    if (started) return;
    started = true;
    M.finalize();
    M.skin.init();
    M.theme.init();
    hydrateText();
    bindTheme();
    bindSkin();
    hydrateIcons(doc);
    renderWords();
    renderStats();
    renderCards();
    bindHeader();
    bindSearch();
    startHero();
    M.mountViews();
    M.nav.start();
    shortcuts();
    doc.documentElement.classList.add('gm-ready');
  }

  M.app = { start: start };

  if (!window.MUSEUM_MANUAL_START) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start);
    else start();
  }
})();

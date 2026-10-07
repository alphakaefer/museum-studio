/* Museum Studio Spieltheorie – Exponat „Dilemma-Turnier“
 * MUSEUM.exhibits['dilemma-turnier'] = { title, blurb, mount(container, ctx) -> destroy() }
 * Klassisches Script, keine Abhängigkeiten, keine externen Abrufe, nichts wird gespeichert.
 * Du spielst 10 Runden Gefangenendilemma gegen eine verdeckt gewählte Strategie und rätst sie danach.
 * Punkte wie bei Axelrod: beide kooperieren 3/3, beide verraten 1/1, Verrat gegen Kooperation 5/0.
 */
(function () {
  'use strict';
  window.MUSEUM = window.MUSEUM || {};
  var M = window.MUSEUM;
  M.exhibits = M.exhibits || {};

  var ROUNDS = 10;
  var PAY = { CC: [3, 3], CD: [0, 5], DC: [5, 0], DD: [1, 1] };
  var P = 'gx-pd-';

  var STRATS = [
    { id: 'tft', name: 'Tit for Tat', desc: 'Beginnt mit Kooperation und wiederholt danach deinen letzten Zug.',
      move: function (h) { return h.length ? h[h.length - 1].me : 'C'; } },
    { id: 'alld', name: 'Immer Verrat', desc: 'Verrät in jeder Runde, egal was du tust.',
      move: function () { return 'D'; } },
    { id: 'allc', name: 'Immer Kooperation', desc: 'Kooperiert in jeder Runde, egal was du tust.',
      move: function () { return 'C'; } },
    { id: 'grudge', name: 'Nachtragend', desc: 'Kooperiert, bis du einmal verrätst, und verrät danach für immer.',
      move: function (h) { for (var i = 0; i < h.length; i++) if (h[i].me === 'D') return 'D'; return 'C'; } },
    { id: 'random', name: 'Zufall', desc: 'Wirft in jeder Runde eine Münze.',
      move: function () { return Math.random() < 0.5 ? 'C' : 'D'; } }
  ];

  var CSS = [
    '.gx-pd{width:100%;max-width:720px;margin:0 auto;color:var(--ink,#1B2230);font-family:var(--font-ui,system-ui,sans-serif);font-size:16px;line-height:1.5}',
    '.gx-pd-card{background:var(--bg-2,#fff);border:1px solid var(--line,#D9D2C3);border-radius:var(--radius,12px);padding:clamp(14px,4vw,24px)}',
    '.gx-pd-lead{margin:0 0 12px}',
    '.gx-pd-actions{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}',
    '.gx-pd-btn{flex:1 1 150px;min-height:48px;padding:10px 16px;border-radius:10px;border:2px solid var(--ink-2,#5C6577);background:var(--bg-3,#ECE6DA);color:var(--ink,#1B2230);font:600 16px/1.2 inherit;cursor:pointer;touch-action:manipulation}',
    '.gx-pd-btn:hover{border-color:var(--accent,#05749E)}',
    '.gx-pd-btn:focus-visible{outline:3px solid var(--accent,#05749E);outline-offset:2px}',
    '.gx-pd-btn--primary{background:var(--accent,#05749E);border-color:var(--accent,#05749E);color:var(--bg,#fff)}',
    '.gx-pd-score{display:flex;gap:16px;flex-wrap:wrap;margin:0 0 10px;font-variant-numeric:tabular-nums}',
    '.gx-pd-hist{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:4px;font-size:14px;font-variant-numeric:tabular-nums}',
    '.gx-pd-hist li{display:flex;justify-content:space-between;gap:8px;padding:4px 8px;border-radius:6px;background:var(--bg-3,#ECE6DA)}',
    '.gx-pd-note{margin:10px 0 0;font-size:14px;color:var(--ink-2,#5C6577)}',
    '.gx-pd-h{margin:0 0 8px;font-size:20px}'
  ].join('\n');

  function injectStyles() {
    if (document.head.querySelector('style[data-gx="dilemma-turnier"]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-gx', 'dilemma-turnier');
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, attrs) {
    var n = document.createElement(tag), i;
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (e) { n.addEventListener(e, v[e]); });
      else n.setAttribute(k, v === true ? '' : v);
    });
    for (i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }

  function word(m) { return m === 'C' ? 'Kooperiert' : 'Verrät'; }

  function mount(container) {
    injectStyles();
    var root = el('div', { class: 'gx-pd' });
    container.appendChild(root);
    var state = null;

    function newGame() {
      state = { opp: STRATS[Math.floor(Math.random() * STRATS.length)], hist: [], mine: 0, theirs: 0, guess: null };
    }

    function render(focusSel) {
      root.textContent = '';
      var card = el('div', { class: P + 'card' });
      root.appendChild(card);
      if (!state) {
        card.appendChild(el('h3', { class: P + 'h', text: 'Spiele gegen eine unbekannte Strategie' }));
        card.appendChild(el('p', { class: P + 'lead', text: 'Zehn Runden Gefangenendilemma. In jeder Runde wählst du „Kooperieren“ oder „Verraten“, dein Gegenüber wählt gleichzeitig. Beide kooperieren: je 3 Punkte. Beide verraten: je 1 Punkt. Du verrätst, der andere kooperiert: 5 Punkte für dich, 0 für ihn (und umgekehrt).' }));
        card.appendChild(el('p', { class: P + 'lead', text: 'Dein Gegenüber folgt einer festen Regel, die du nicht kennst. Finde sie heraus.' }));
        card.appendChild(el('div', { class: P + 'actions' },
          el('button', { type: 'button', class: P + 'btn ' + P + 'btn--primary', id: P + 'start', text: 'Spiel starten', on: { click: function () { newGame(); render('.' + P + 'btn'); } } })));
        return;
      }
      var r = state.hist.length;
      card.appendChild(el('div', { class: P + 'score', 'aria-live': 'polite' },
        el('span', { text: 'Runde ' + Math.min(r + 1, ROUNDS) + ' von ' + ROUNDS }),
        el('span', { text: 'Du: ' + state.mine + ' Punkte' }),
        el('span', { text: 'Gegenüber: ' + state.theirs + ' Punkte' })));
      if (r < ROUNDS) {
        card.appendChild(el('p', { class: P + 'lead', text: 'Was spielst du?' }));
        card.appendChild(el('div', { class: P + 'actions' },
          el('button', { type: 'button', class: P + 'btn', text: 'Kooperieren', on: { click: function () { play('C'); } } }),
          el('button', { type: 'button', class: P + 'btn', text: 'Verraten', on: { click: function () { play('D'); } } })));
      } else {
        renderEnd(card);
      }
      if (r) {
        var list = el('ul', { class: P + 'hist', 'aria-label': 'Bisheriger Verlauf' });
        state.hist.forEach(function (h, i) {
          list.appendChild(el('li', null, el('span', { text: 'Runde ' + (i + 1) }), el('span', { text: 'Du: ' + word(h.me) + ' · Gegenüber: ' + word(h.opp) })));
        });
        card.appendChild(list);
      }
      if (focusSel) { var f = root.querySelector(focusSel); if (f && f.focus) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } } }
    }

    function play(mine) {
      var opp = state.opp.move(state.hist);
      var pay = PAY[mine + opp];
      state.mine += pay[0];
      state.theirs += pay[1];
      state.hist.push({ me: mine, opp: opp });
      render('.' + P + 'btn');
    }

    function renderEnd(card) {
      var won = state.mine > state.theirs ? 'Du liegst vorn' : (state.mine < state.theirs ? 'Dein Gegenüber liegt vorn' : 'Gleichstand');
      if (state.guess === null) {
        card.appendChild(el('h3', { class: P + 'h', text: 'Geschafft: ' + state.mine + ' zu ' + state.theirs + '. ' + won + '.' }));
        card.appendChild(el('p', { class: P + 'lead', text: 'Welche Regel hat dein Gegenüber befolgt?' }));
        var box = el('div', { class: P + 'actions', role: 'group', 'aria-label': 'Strategie raten' });
        STRATS.forEach(function (s) {
          box.appendChild(el('button', { type: 'button', class: P + 'btn', text: s.name, on: { click: function () { state.guess = s.id; render('#' + P + 'again'); } } }));
        });
        card.appendChild(box);
        return;
      }
      var ok = state.guess === state.opp.id;
      card.appendChild(el('h3', { class: P + 'h', text: ok ? 'Richtig geraten: ' + state.opp.name : 'Es war: ' + state.opp.name }));
      card.appendChild(el('p', { class: P + 'lead', text: state.opp.desc + ' Dein Ergebnis: ' + state.mine + ' zu ' + state.theirs + '.' }));
      card.appendChild(el('p', { class: P + 'note', text: 'Ein Durchlauf beweist wenig, weil zehn Runden kurz sind und die Zufallsstrategie schwankt. In Axelrods Turnieren (200 Runden, viele Gegner) kam es auf die Gesamtpunktzahl an, und dort gewann Tit for Tat, obwohl sie keine einzelne Partie gewinnt.' }));
      card.appendChild(el('div', { class: P + 'actions' },
        el('button', { type: 'button', class: P + 'btn ' + P + 'btn--primary', id: P + 'again', text: 'Noch einmal', on: { click: function () { newGame(); render('.' + P + 'btn'); } } })));
    }

    render();
    return function destroy() { if (root.parentNode) root.parentNode.removeChild(root); };
  }

  M.exhibits['dilemma-turnier'] = {
    title: 'Dilemma-Turnier',
    blurb: 'Zehn Runden Gefangenendilemma gegen eine verborgene Strategie: Kooperierst du, verrätst du, und was folgt daraus?',
    mount: mount
  };
})();

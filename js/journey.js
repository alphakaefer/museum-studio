/* ==========================================================================
   Museum Studio – js/journey.js
   Reise-Modus („Wanderung“): Vollbild-Overlay #reise mit Liniendiagramm der Reise,
   Station für Station, Umsteigen an Kreuzungen, Intro- und Abschlusskarte mit Stempel.

   API (Vertrag, docs/ARCHITEKTUR.md):
     MUSEUM.journey = { open(id, startIndex), close(), goTo(index), currentIndex() }
   Der Router in core.js ruft open()/goTo()/close() auf. Index -1 ist die Intro-Karte,
   Index = Anzahl der Stationen ist die Abschlusskarte (Stempel). Die Adresse bleibt
   auf der letzten Station, solange die Abschlusskarte offen ist.

   Alle Klassen tragen das Präfix gm-reise-. Styles werden einmal in <head> injiziert.
   Farben nur über die Design-Tokens aus css/museum.css.
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  var doc = document;

  /* ------------------------------------------------------------------ *
   * Styles
   * ------------------------------------------------------------------ */

  var CSS = `
/* ===== Rahmen ===== */
.gm-reise-root {
  --jc: var(--accent);
  --rail-bg: var(--bg-3);
  --gutL: 2.7rem;
  --railw: 19.5rem;
  --gutT: 1.7rem;
  position: absolute; inset: 0; display: grid; overflow: hidden; color: var(--ink);
  grid-template-columns: var(--railw) minmax(0, 1fr);
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  grid-template-areas: "head head" "origin origin" "rail main" "foot foot";
}
@supports (background: color-mix(in srgb, red 10%, blue)) {
  .gm-reise-root { --rail-bg: color-mix(in srgb, var(--bg-3) 62%, var(--bg)); }
}

/* ===== Kopf ===== */
.gm-reise-head {
  grid-area: head; position: relative; z-index: 3; display: flex; align-items: center; gap: 1rem;
  padding: .7rem var(--gutter) .8rem; background: var(--glass); border-bottom: 1px solid var(--line);
  -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4);
}
.gm-reise-head::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: -2px; height: 4px; background: var(--hl, var(--jc));
  transform-origin: left center; animation: gm-reise-draw .9s var(--ease) both;
}
.gm-reise-medal {
  flex: none; width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; color: var(--ink);
  background: var(--bg-2); border: 2.5px solid var(--jc);
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--jc) 16%, transparent), var(--shadow);
}
.gm-reise-headtext { flex: 1; min-width: 0; }
.gm-reise-eyebrow { margin: 0 0 .2rem; font: 700 .68rem/1.2 var(--font-ui); letter-spacing: .17em; text-transform: uppercase; color: var(--ink-2); }
.gm-reise-name {
  margin: 0; font: 600 clamp(1.1rem, .95rem + .7vw, 1.5rem)/1.2 var(--font-display); letter-spacing: -.005em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gm-reise-close { flex: none; border-color: var(--line); background: var(--bg-2); }
.gm-reise-close:hover { border-color: var(--accent); }

@media (min-width: 960px) {
  .gm-reise-rail {
    padding-bottom: 2rem;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 22px), transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0, #000 12px, #000 calc(100% - 22px), transparent 100%);
  }
}

/* Umsteige-Band: Herkunft */
.gm-reise-origin {
  grid-area: origin; position: relative; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: .4rem 1rem;
  padding: .5rem var(--gutter) .5rem calc(var(--gutter) + .4rem); border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--oc, var(--accent)) 10%, var(--bg-2));
  animation: gm-reise-drop .5s var(--ease) both;
}
.gm-reise-origin::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 6px; background: var(--oc, var(--accent)); }
.gm-reise-origin-t { margin: 0; flex: 1 1 14rem; font-size: .92rem; line-height: 1.4; color: var(--ink-2); }
.gm-reise-origin-t strong { color: var(--ink); font-weight: 600; }
.gm-reise-back {
  display: inline-flex; align-items: center; gap: .5rem; min-height: 40px; padding: .2rem .95rem .2rem .3rem; cursor: pointer;
  border-radius: 999px; border: 1.5px solid var(--oc, var(--accent)); background: var(--bg-2); color: var(--ink);
  font: 600 .88rem/1.2 var(--font-ui); transition: background-color .2s, box-shadow .2s, transform .2s var(--ease);
}
.gm-reise-back:hover { background: color-mix(in srgb, var(--oc, var(--accent)) 16%, var(--bg-2)); transform: translateX(-2px); }
.gm-reise-back-dot {
  width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%;
  background: var(--bg-2); border: 1.5px solid var(--oc, var(--accent)); color: var(--ink);
}
.gm-reise-back-short { display: none; }

/* ===== Liniendiagramm ===== */
.gm-reise-rail {
  grid-area: rail; position: relative; z-index: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
  background: var(--rail-bg); border-right: 1px solid var(--line); padding: 1.1rem .6rem 1.2rem .8rem;
  overscroll-behavior: contain; scroll-behavior: auto; scrollbar-width: thin; scrollbar-color: var(--line) transparent;
}
.gm-reise-rail-h {
  margin: 0 0 .7rem .35rem; font: 700 .68rem/1.2 var(--font-ui); letter-spacing: .17em; text-transform: uppercase; color: var(--ink-2);
}
.gm-reise-line { list-style: none; margin: 0; padding: 0; }
.gm-reise-stop { position: relative; --nc: var(--jc); --sin: var(--jc); --sout: var(--jc); }
.gm-reise-stop::before, .gm-reise-stop::after {
  content: ""; position: absolute; left: calc(var(--gutL) + var(--gutT) / 2 - 3px); width: 6px; opacity: .34;
  transition: opacity .5s var(--ease) .05s;
}
.gm-reise-stop::before { top: 0; height: 50%; background: var(--sin); }
.gm-reise-stop::after { top: 50%; height: 50%; background: var(--sout); }
.gm-reise-stop.is-in::before, .gm-reise-stop.is-out::after { opacity: 1; }
.gm-reise-stop.is-start::before, .gm-reise-stop.is-end::after { display: none; }
.gm-reise-stop.is-drawn::before, .gm-reise-stop.is-drawn::after { animation: gm-reise-grow .5s var(--ease) both; animation-delay: var(--dl, 0s); }
.gm-reise-stop.is-drawn::before { transform-origin: top; }
.gm-reise-stop.is-drawn::after { transform-origin: top; }

.gm-reise-stopbtn {
  position: relative; display: grid; grid-template-columns: var(--gutL) var(--gutT) minmax(0, 1fr); align-items: center;
  width: 100%; min-height: 46px; margin: 0; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--ink-2);
  font: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transition: background-color .2s, color .2s;
}
.gm-reise-stopbtn:hover { color: var(--ink); background: color-mix(in srgb, var(--ink) 5%, transparent); }
.gm-reise-stopbtn:focus-visible { outline-offset: -2px; }
.gm-reise-lab { grid-column: 3; display: flex; align-items: baseline; gap: .5rem; padding: .3rem .4rem .3rem .55rem; min-width: 0; }
.gm-reise-num { flex: none; min-width: 1.2rem; font: 700 .72rem/1 var(--font-ui); font-variant-numeric: tabular-nums; color: var(--ink-2); }
.gm-reise-t {
  font: 500 .9rem/1.28 var(--font-ui); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.gm-reise-y { flex: none; font: 600 .72rem/1 var(--font-display); letter-spacing: .04em; color: var(--ink-2); white-space: nowrap; }
.gm-reise-stop.is-current .gm-reise-stopbtn { color: var(--ink); }
.gm-reise-stop.is-current .gm-reise-t { font-weight: 700; }

.gm-reise-node {
  grid-column: 2; justify-self: center; position: relative; z-index: 1; width: 14px; height: 14px; border-radius: 50%;
  background: var(--rail-bg); border: 3px solid var(--nc); transition: background-color .35s, scale .25s var(--ease), box-shadow .3s;
  display: grid; place-items: center;
}
.gm-reise-stopbtn:hover .gm-reise-node { scale: 1.18; }
.gm-reise-stop.is-seen .gm-reise-node { background: var(--nc); }
.gm-reise-stop.is-seen .gm-reise-node::after {
  content: ""; width: 5px; height: 5px; border-radius: 50%; background: color-mix(in srgb, #000 82%, var(--nc));
}
.gm-reise-stop.is-x .gm-reise-node { width: 20px; height: 20px; border: 3.5px solid var(--ink); background: var(--bg-2); }
.gm-reise-stop.is-x.is-seen .gm-reise-node { background: var(--warm); }
.gm-reise-stop.is-x.is-seen .gm-reise-node::after { width: 6px; height: 6px; background: #1B2230; }
.gm-reise-stop.is-current .gm-reise-node { box-shadow: 0 0 0 4px var(--rail-bg), 0 0 0 7px var(--nc); animation: gm-reise-beat 2.8s ease-in-out infinite; }
.gm-reise-stop.is-x.is-current .gm-reise-node { box-shadow: 0 0 0 4px var(--rail-bg), 0 0 0 7px var(--warm); }

/* Endkappen: Start als Balken, Ziel als Stempel-Knopf */
.gm-reise-stop.is-cap .gm-reise-node { border-radius: 4px; width: 26px; height: 10px; border: 0; background: var(--ink); }
.gm-reise-stop.is-cap.is-end .gm-reise-node {
  width: 26px; height: 26px; border-radius: 50%; border: 3px solid var(--ink); background: var(--bg-2); color: var(--ink);
}
.gm-reise-stop.is-cap.is-end.is-seen .gm-reise-node { background: var(--warm); color: #1B2230; }
.gm-reise-stop.is-cap.is-end .gm-reise-node::after { display: none; }
.gm-reise-stop.is-cap .gm-reise-node svg { width: 13px; height: 13px; }
.gm-reise-stop.is-cap.is-current .gm-reise-node { box-shadow: 0 0 0 4px var(--rail-bg), 0 0 0 7px var(--warm); animation: none; }
.gm-reise-stop.is-cap.is-start.is-current .gm-reise-node { box-shadow: 0 0 0 4px var(--rail-bg), 0 0 0 6px var(--warm); }
.gm-reise-stop.is-cap .gm-reise-t { font-style: italic; font-family: var(--font-display); font-weight: 500; font-size: .92rem; }
.gm-reise-stop.is-cap .gm-reise-num { display: none; }

/* Abzweige an Kreuzungen */
.gm-reise-br {
  position: absolute; left: .4rem; width: calc(var(--gutL) + var(--gutT) / 2 - .4rem); height: 3px; border-radius: 2px; background: var(--bc);
  top: calc(50% + (var(--k) - (var(--n) - 1) / 2) * 10px - 1.5px); pointer-events: none;
}
.gm-reise-br::before {
  content: ""; position: absolute; left: -3px; top: 50%; width: 11px; height: 11px; margin-top: -5.5px; border-radius: 50%;
  background: var(--rail-bg); border: 3px solid var(--bc);
}

.gm-reise-legend {
  display: grid; gap: .45rem; margin: 1.4rem .35rem 0; padding-top: 1rem; border-top: 1px solid var(--line);
  font-size: .78rem; color: var(--ink-2); list-style: none; padding-left: 0; padding-right: 0;
}
.gm-reise-legend li { display: flex; align-items: center; gap: .6rem; }
.gm-reise-lg { flex: none; width: 14px; height: 14px; border-radius: 50%; border: 3px solid var(--jc); background: var(--rail-bg); display: grid; place-items: center; }
.gm-reise-lg.is-seen { background: var(--jc); }
.gm-reise-lg.is-seen::after { content: ""; width: 5px; height: 5px; border-radius: 50%; background: color-mix(in srgb, #000 82%, var(--jc)); }
.gm-reise-lg.is-x { width: 18px; height: 18px; border: 3.5px solid var(--ink); background: var(--bg-2); margin-inline: -2px; }

/* Tooltip an Kreuzungen */
.gm-reise-tip {
  position: absolute; z-index: 8; width: min(21rem, calc(100vw - 2rem)); padding: .8rem .95rem .85rem; border-radius: 14px;
  background: var(--bg-2); border: 1px solid var(--line); box-shadow: var(--shadow-lg); pointer-events: none;
  opacity: 0; transform: translateX(-6px); transition: opacity .18s, transform .22s var(--ease);
}
.gm-reise-tip.is-on { opacity: 1; transform: none; }
.gm-reise-tip-h { margin: 0 0 .5rem; font: 700 .66rem/1.2 var(--font-ui); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-2); }
.gm-reise-tip ul { list-style: none; margin: 0; padding: 0; display: grid; gap: .55rem; }
.gm-reise-tip li { display: grid; grid-template-columns: auto 1fr; gap: .15rem .55rem; align-items: baseline; }
.gm-reise-tip-dot { width: 11px; height: 11px; border-radius: 50%; border: 3px solid var(--bc); background: var(--bg-2); align-self: center; }
.gm-reise-tip-n { font: 600 .92rem/1.25 var(--font-display); }
.gm-reise-tip-w { grid-column: 2; font-size: .8rem; line-height: 1.4; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

/* ===== Hauptbereich ===== */
.gm-reise-main { grid-area: main; position: relative; min-width: 0; min-height: 0; }
.gm-reise-main::before {
  content: ""; position: absolute; inset: 0 0 auto 0; height: 22rem; pointer-events: none; z-index: 0;
  background: radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--jc) 11%, transparent), transparent 75%);
}
.gm-reise-scroll {
  position: absolute; inset: 0; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; scroll-behavior: auto;
  touch-action: pan-y pinch-zoom; /* waagerechtes Wischen blättert die Stationen, löst aber nie die Browser-Rückwärts-Geste aus */
  padding: clamp(1.4rem, 3.6vw, 3rem) var(--gutter) clamp(2rem, 5vw, 4rem); -webkit-overflow-scrolling: touch;
}
.gm-reise-scroll:focus { outline: none; }
.gm-reise-stage { position: relative; z-index: 1; width: 100%; max-width: 46rem; margin-inline: auto; }
.gm-reise-page { will-change: opacity, transform; }
.gm-reise-page.is-leaving-next { opacity: 0; transform: translateX(-22px); transition: opacity .15s ease-in, transform .15s ease-in; }
.gm-reise-page.is-leaving-prev { opacity: 0; transform: translateX(22px); transition: opacity .15s ease-in, transform .15s ease-in; }
.gm-reise-page.is-leaving-none { opacity: 0; transition: opacity .12s ease-in; }
.gm-reise-page.is-in-next { animation: gm-reise-in-next .42s var(--ease) both; }
.gm-reise-page.is-in-prev { animation: gm-reise-in-prev .42s var(--ease) both; }
.gm-reise-page.is-in-up { animation: gm-reise-in-up .6s var(--ease) both; }
.gm-reise-page.is-in-fade { animation: gm-reise-fade .45s ease-out both; }

/* Etappen-Hinweis der Großen Rundreise */
.gm-reise-etappe {
  margin: 0 0 1.5rem; padding: .85rem 1.1rem .9rem; border-radius: var(--radius); background: color-mix(in srgb, var(--warm) 14%, var(--bg-2));
  border: 1px solid color-mix(in srgb, var(--warm) 58%, transparent);
}
.gm-reise-etappe-k { margin: 0 0 .4rem; font: 700 .68rem/1.3 var(--font-ui); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-2); }
.gm-reise-etappe p { margin: 0; font-size: .95rem; line-height: 1.5; }
.gm-reise-etappe-row { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem .6rem; margin-top: .55rem; font-size: .9rem; color: var(--ink-2); }

/* Nächster Halt (Ende jeder Station) */
.gm-reise-nextcard {
  position: relative; display: grid; grid-template-columns: 1fr auto; gap: .2rem 1rem; align-items: center; width: 100%; margin: 2.6rem 0 0;
  padding: 1.05rem 1.3rem 1.05rem 1.7rem; text-align: left; cursor: pointer; overflow: hidden; border-radius: 18px;
  background: var(--bg-2); border: 1.5px solid var(--line); color: var(--ink); box-shadow: var(--shadow);
  transition: transform .3s var(--ease), border-color .25s, box-shadow .3s;
}
.gm-reise-nextcard::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 8px; background: var(--jc); transition: width .35s var(--ease); }
.gm-reise-nextcard:hover { transform: translateY(-3px); border-color: var(--jc); box-shadow: var(--shadow-lg); }
.gm-reise-nextcard:hover::before { width: 14px; }
.gm-reise-nextcard:hover .gm-reise-nc-go { transform: translateX(5px); }
.gm-reise-nc-k { grid-column: 1; font: 700 .68rem/1.3 var(--font-ui); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-2); }
.gm-reise-nc-t { grid-column: 1; font: 600 clamp(1.15rem, 1.02rem + .6vw, 1.5rem)/1.22 var(--font-display); text-wrap: balance; }
.gm-reise-nc-s { grid-column: 1; margin-top: .15rem; font-size: .92rem; line-height: 1.45; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.gm-reise-nc-go { grid-column: 2; grid-row: 1 / span 3; color: var(--ink); transition: transform .3s var(--ease); display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--jc); background: var(--bg); }

/* ===== Intro ===== */
.gm-reise-intro { padding-top: .4rem; }
.gm-reise-kicker { display: flex; align-items: center; gap: .6rem; margin: 0 0 1rem; font: 700 .72rem/1.2 var(--font-ui); letter-spacing: .18em; text-transform: uppercase; color: var(--ink-2); }
.gm-reise-kicker::before { content: ""; width: 34px; height: 4px; border-radius: 2px; background: var(--jc); }
.gm-reise-ph {
  margin: 0 0 .5rem; font: 600 clamp(1.7rem, 1.1rem + 2.6vw, 2.6rem)/1.1 var(--font-display); letter-spacing: -.012em; text-wrap: balance;
}
.gm-reise-ph--big { font-size: clamp(2.1rem, 1.2rem + 3.8vw, 3.7rem); line-height: 1.04; }
.gm-reise-tagline {
  margin: .9rem 0 0; padding-left: 1.05rem; border-left: 3px solid var(--warm); max-width: 34rem;
  font: italic 400 clamp(1.15rem, 1rem + .8vw, 1.45rem)/1.45 var(--font-display); color: var(--ink); text-wrap: pretty;
}
.gm-reise-route { list-style: none; display: flex; align-items: center; height: 36px; margin: 2rem 0 1.8rem; padding: 0; }
.gm-reise-route li { --nc: var(--jc); --sin: var(--jc); --sout: var(--jc); position: relative; flex: 1 1 0; min-width: 0; height: 100%; display: grid; place-items: center; }
.gm-reise-route li::before, .gm-reise-route li::after {
  content: ""; position: absolute; top: 50%; height: 6px; margin-top: -3px; width: 50.5%; transform-origin: left center;
  animation: gm-reise-growx .5s var(--ease) both; animation-delay: calc(var(--i) * 45ms + .15s);
}
.gm-reise-route li::before { left: 0; background: var(--sin); }
.gm-reise-route li::after { left: 50%; background: var(--sout); }
.gm-reise-route li:first-child::before, .gm-reise-route li:last-child::after { display: none; }
.gm-reise-route i {
  position: relative; z-index: 1; width: 13px; height: 13px; border-radius: 50%; border: 3px solid var(--nc); background: var(--bg);
  display: grid; place-items: center; animation: gm-reise-pop .45s var(--ease) both; animation-delay: calc(var(--i) * 45ms + .25s);
}
.gm-reise-route li.is-x i { width: 19px; height: 19px; border: 3.5px solid var(--ink); background: var(--bg-2); }
.gm-reise-route li.is-seen i { background: var(--nc); }
.gm-reise-route li.is-seen i::after { content: ""; width: 5px; height: 5px; border-radius: 50%; background: color-mix(in srgb, #000 82%, var(--nc)); }
.gm-reise-route li.is-x.is-seen i { background: var(--warm); }
.gm-reise-route li.is-x.is-seen i::after { background: #1B2230; }
.gm-reise-introtext { max-width: 37rem; margin: 0 0 2rem; font: 400 clamp(1.08rem, 1rem + .35vw, 1.24rem)/1.72 var(--font-display); text-wrap: pretty; -webkit-hyphens: auto; hyphens: auto; }
.gm-reise-facts { margin: 0 0 2rem; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; padding: 1.2rem 0; border-block: 1px solid var(--line); text-align: center; }
.gm-reise-fact { display: flex; flex-direction: column-reverse; gap: .25rem; margin: 0; }
.gm-reise-fact dd { margin: 0; font: 600 clamp(1.9rem, 1.4rem + 2vw, 3rem)/1 var(--font-display); font-variant-numeric: lining-nums tabular-nums; }
.gm-reise-fact dd small { font: 600 .42em/1 var(--font-ui); letter-spacing: .04em; margin-right: .25em; color: var(--ink-2); }
.gm-reise-fact dt { font: 700 .7rem/1.3 var(--font-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--ink-2); }
.gm-reise-fact:nth-child(1) dd { text-shadow: 0 3px 0 color-mix(in srgb, var(--jc) 45%, transparent); }
.gm-reise-fact:nth-child(2) dd { text-shadow: 0 3px 0 color-mix(in srgb, var(--warm) 70%, transparent); }
.gm-reise-fact:nth-child(3) dd { text-shadow: 0 3px 0 color-mix(in srgb, var(--accent) 40%, transparent); }
.gm-reise-sec { margin: 0 0 2rem; }
.gm-reise-sec-h { display: flex; align-items: center; gap: .55rem; margin: 0 0 .85rem; font: 700 .74rem/1.2 var(--font-ui); letter-spacing: .16em; text-transform: uppercase; color: var(--ink-2); }
.gm-reise-links { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
.gm-reise-links li { display: flex; flex-wrap: wrap; align-items: center; gap: .3rem .75rem; font-size: .93rem; color: var(--ink-2); }
.gm-reise-path { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: .5rem .35rem; }
.gm-reise-path li { display: inline-flex; align-items: center; gap: .35rem; }
.gm-reise-path li + li::before { content: ""; width: 16px; height: 3px; border-radius: 2px; background: var(--ink-3); }
.gm-reise-progline { margin: 0 0 1.2rem; font-size: .95rem; color: var(--ink-2); }
.gm-reise-actions { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
.gm-reise-actions .gm-btn { white-space: normal; }
.gm-reise-actions .gm-btn span[aria-hidden] { flex: none; display: inline-grid; }
.gm-reise-note { margin: 0; padding: .7rem 1rem; border: 1px dashed var(--line); border-radius: 10px; color: var(--ink-2); }

/* ===== Abschluss ===== */
.gm-reise-outro { text-align: center; padding-top: .4rem; }
.gm-reise-stampwrap { position: relative; width: min(15rem, 62vw); margin: .4rem auto 1.4rem; aspect-ratio: 1; }
.gm-reise-stamp {
  position: relative; width: 100%; height: 100%; display: block; color: color-mix(in srgb, var(--jc) 70%, var(--ink)); transform: rotate(-8deg);
  opacity: 0;
}
.gm-reise-stamp.is-ready { opacity: 1; }
.gm-reise-stamp.is-hit { animation: gm-reise-hit .8s cubic-bezier(.2, .9, .25, 1) both; }
.gm-reise-stamp-svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.gm-reise-stamp-mid {
  position: absolute; inset: 27.5%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .25rem; text-align: center;
}
.gm-reise-stamp-mid svg { width: 36%; height: auto; max-width: 54px; }
.gm-reise-stamp-n { font: 700 clamp(.5rem, .4rem + .6vw, .72rem)/1.15 var(--font-ui); letter-spacing: .14em; text-transform: uppercase; max-width: 90%; }
.gm-reise-stamp-d { font: 600 clamp(.5rem, .4rem + .5vw, .68rem)/1.1 var(--font-ui); letter-spacing: .08em; opacity: .85; }
.gm-reise-stamp.is-open { color: var(--ink-3); transform: rotate(-4deg); opacity: 1; }
.gm-reise-stamp.is-open .gm-reise-stamp-svg { opacity: .9; }
.gm-reise-ring {
  position: absolute; inset: 0; border-radius: 50%; border: 3px solid var(--warm); opacity: 0; pointer-events: none;
}
.gm-reise-stampwrap.is-hit .gm-reise-ring { animation: gm-reise-shock .9s .38s ease-out both; }
.gm-reise-spark { position: absolute; left: 50%; top: 50%; width: 7px; height: 7px; margin: -3.5px; border-radius: 50%; background: var(--warm); opacity: 0; pointer-events: none; }
.gm-reise-stampwrap.is-hit .gm-reise-spark { animation: gm-reise-spark .9s .4s cubic-bezier(.1, .7, .3, 1) both; }
.gm-reise-outro.is-thud .gm-reise-stampwrap { animation: gm-reise-thud .4s .36s ease-out both; }
.gm-reise-outro-h { margin: 0 0 .4rem; }
.gm-reise-new { display: inline-flex; align-items: center; gap: .5rem; margin: .2rem 0 1.2rem; padding: .3rem .95rem .3rem .45rem; border-radius: 999px; background: var(--warm); color: var(--on-warm); font: 700 .8rem/1.3 var(--font-ui); letter-spacing: .04em; }
.gm-reise-new span:first-child { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: rgba(27, 34, 48, .12); }
.gm-reise-outro-sub { max-width: 32rem; margin: 0 auto 1.4rem; color: var(--ink-2); }
.gm-reise-outrotext {
  max-width: 34rem; margin: 0 auto 1.8rem; padding: 1.1rem 1.4rem; text-align: left; border-radius: var(--radius);
  background: var(--bg-2); border: 1px solid var(--line); border-left: 5px solid var(--jc); box-shadow: var(--shadow);
  font: italic 400 clamp(1.06rem, 1rem + .3vw, 1.2rem)/1.65 var(--font-display); text-wrap: pretty;
}
.gm-reise-outro .gm-reise-actions { justify-content: center; margin-bottom: 2.6rem; }
.gm-reise-recs { text-align: left; }
.gm-reise-recs .gm-reise-sec-h { justify-content: center; }
.gm-reise-reclist { list-style: none; margin: 0; padding: 0; display: grid; gap: .85rem; }
.gm-reise-rec {
  --jc: var(--accent); position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: .2rem 1rem; align-items: center; width: 100%;
  padding: 1rem 1.1rem 1rem 1.5rem; text-align: left; cursor: pointer; overflow: hidden; border-radius: 16px;
  background: var(--bg-2); border: 1.5px solid var(--line); color: var(--ink);
  transition: transform .3s var(--ease), border-color .2s, box-shadow .3s;
}
.gm-reise-rec::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 8px; background: var(--jc); }
.gm-reise-rec:hover { transform: translateY(-3px); border-color: var(--jc); box-shadow: var(--shadow); }
.gm-reise-rec:hover .gm-reise-rec-go { transform: translateX(4px); }
.gm-reise-rec-ico {
  grid-row: 1 / span 3; width: 50px; height: 50px; display: grid; place-items: center; border-radius: 50%; border: 2px solid var(--jc); background: var(--bg-2);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--jc) 16%, transparent);
}
.gm-reise-rec-n { grid-column: 2; font: 600 1.15rem/1.25 var(--font-display); }
.gm-reise-rec-t { grid-column: 2; font-size: .9rem; line-height: 1.45; color: var(--ink-2); }
.gm-reise-rec-m { grid-column: 2; font-size: .82rem; line-height: 1.4; color: var(--ink-2); }
.gm-reise-rec-m strong { color: var(--ink); font-weight: 600; }
.gm-reise-rec-go { grid-column: 3; grid-row: 1 / span 3; transition: transform .25s var(--ease); color: var(--ink-2); }

/* ===== Fuß: Zurück / Weiter / Fortschritt ===== */
.gm-reise-foot {
  grid-area: foot; position: relative; z-index: 3; background: var(--glass); border-top: 1px solid var(--line);
  -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4);
  padding-bottom: env(safe-area-inset-bottom);
}
.gm-reise-prog { position: absolute; left: 0; right: 0; top: -3px; height: 5px; background: transparent; pointer-events: none; }
.gm-reise-prog-fill {
  position: absolute; left: 0; top: 0; bottom: 0; width: calc(var(--p, 0) * 100%); background: var(--hl, var(--jc)); border-radius: 0 3px 3px 0;
  transition: width .6s var(--ease);
}
.gm-reise-prog-fill::after {
  content: ""; position: absolute; right: -5px; top: 50%; width: 14px; height: 14px; margin-top: -7px; border-radius: 50%;
  background: var(--warm); border: 3px solid var(--bg); box-shadow: 0 0 12px 2px rgba(252, 179, 0, .7);
}
.gm-reise-prog[data-zero="1"] .gm-reise-prog-fill::after { left: 4px; right: auto; }
.gm-reise-foot-in {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: .75rem 1rem;
  width: min(100%, 76rem); margin-inline: auto; padding: .7rem var(--gutter);
}
.gm-reise-mid { min-width: 0; text-align: center; line-height: 1.3; }
.gm-reise-pos { display: block; font: 700 .95rem/1.2 var(--font-ui); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gm-reise-hint { display: block; margin-top: .15rem; font-size: .8rem; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gm-reise-foot .gm-btn { min-height: 46px; }
@media (min-width: 960px) {
  .gm-reise-foot { padding-left: var(--railw); }
  .gm-reise-foot-in { width: 100%; max-width: calc(46rem + 2 * var(--gutter)); }
}

/* ===== Umstieg: Leuchtimpuls ===== */
.gm-reise-pulse {
  position: absolute; z-index: 9; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%; pointer-events: none;
  border: 3px solid var(--pc); box-shadow: 0 0 16px 3px var(--pc); animation: gm-reise-pulse .75s ease-out both;
}
.gm-reise-wash {
  position: absolute; z-index: 7; width: 44px; height: 44px; margin: -22px 0 0 -22px; left: var(--wx); top: var(--wy); border-radius: 50%;
  pointer-events: none; background: radial-gradient(circle, var(--jc) 0, var(--jc) 52%, transparent 70%); opacity: 0;
  animation: gm-reise-wash 1.15s cubic-bezier(.2, .6, .25, 1) both;
}
.gm-reise-root.is-arriving .gm-reise-head::after { animation-duration: 1.2s; }

/* ===== Keyframes ===== */
@keyframes gm-reise-draw { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes gm-reise-grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
@keyframes gm-reise-growx { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes gm-reise-pop { from { transform: scale(0); } 60% { transform: scale(1.25); } to { transform: scale(1); } }
@keyframes gm-reise-beat { 0%, 100% { scale: 1; } 50% { scale: 1.12; } }
@keyframes gm-reise-drop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
@keyframes gm-reise-in-next { from { opacity: 0; transform: translateX(34px); } to { opacity: 1; transform: none; } }
@keyframes gm-reise-in-prev { from { opacity: 0; transform: translateX(-34px); } to { opacity: 1; transform: none; } }
@keyframes gm-reise-in-up { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes gm-reise-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes gm-reise-pulse { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(7); } }
@keyframes gm-reise-wash { 0% { opacity: .5; transform: scale(1); } 100% { opacity: 0; transform: scale(70); } }
@keyframes gm-reise-hit {
  0% { opacity: 0; transform: rotate(-22deg) scale(2.6); }
  52% { opacity: 1; transform: rotate(-8deg) scale(.93); }
  72% { transform: rotate(-8deg) scale(1.035); }
  100% { opacity: 1; transform: rotate(-8deg) scale(1); }
}
@keyframes gm-reise-shock { 0% { opacity: .8; transform: scale(.82); } 100% { opacity: 0; transform: scale(1.55); } }
@keyframes gm-reise-thud { 0%, 100% { transform: none; } 30% { transform: translateY(4px) scale(.992); } 60% { transform: translateY(-1px); } }
@keyframes gm-reise-spark {
  0% { opacity: 1; transform: rotate(var(--a)) translateX(46%) scale(1); }
  100% { opacity: 0; transform: rotate(var(--a)) translateX(var(--r, 78%)) scale(.2); }
}

/* ===== Bewegung reduziert: nur Überblenden ===== */
@media (prefers-reduced-motion: reduce) {
  .gm-reise-page.is-in-next, .gm-reise-page.is-in-prev, .gm-reise-page.is-in-up, .gm-reise-page.is-in-fade {
    animation: gm-reise-fade .25s ease-out both !important; animation-duration: .25s !important;
  }
  .gm-reise-stamp.is-hit { animation: gm-reise-fade .4s ease-out both !important; animation-duration: .4s !important; transform: rotate(-8deg); }
  .gm-reise-stop.is-current .gm-reise-node { animation: none !important; }
  .gm-reise-head::after, .gm-reise-stop.is-drawn::before, .gm-reise-stop.is-drawn::after, .gm-reise-route li::before, .gm-reise-route li::after, .gm-reise-route i { animation: none !important; }
  .gm-reise-wash, .gm-reise-pulse, .gm-reise-ring, .gm-reise-spark { display: none !important; }
  .gm-reise-back:hover, .gm-reise-nextcard:hover, .gm-reise-rec:hover { transform: none; }
  .gm-reise-tip { transition: none; transform: none; }
}

/* ===== Schmal: Linie wird zum waagerechten Band ===== */
@media (max-width: 959px) {
  .gm-reise-root {
    --cy: 36px;
    grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto auto minmax(0, 1fr) auto;
    grid-template-areas: "head" "origin" "rail" "main" "foot";
  }
  .gm-reise-head { padding-block: .5rem .6rem; gap: .75rem; }
  .gm-reise-medal { width: 38px; height: 38px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--jc) 16%, transparent), var(--shadow); }
  .gm-reise-medal svg { width: 20px; height: 20px; }
  .gm-reise-eyebrow { display: none; }
  .gm-reise-name { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; font-size: 1.02rem; line-height: 1.15; }
  .gm-reise-rail {
    overflow-x: auto; overflow-y: hidden; border-right: 0; border-bottom: 1px solid var(--line); padding: 0;
    scrollbar-width: none; -webkit-overflow-scrolling: touch;
  }
  .gm-reise-rail::-webkit-scrollbar { display: none; }
  .gm-reise-rail-h, .gm-reise-legend { display: none; }
  .gm-reise-line { display: flex; width: max-content; min-width: 100%; padding: 0 .6rem; }
  .gm-reise-stop { flex: none; width: 2.5rem; }
  .gm-reise-stop::before, .gm-reise-stop::after { top: calc(var(--cy) - 3px); height: 6px; width: 50.5%; }
  .gm-reise-stop::before { left: 0; }
  .gm-reise-stop::after { left: 50%; }
  .gm-reise-stop.is-drawn::before { transform-origin: left center; animation-name: gm-reise-growx; }
  .gm-reise-stop.is-drawn::after { transform-origin: left center; animation-name: gm-reise-growx; }
  .gm-reise-stopbtn { display: block; height: 4.1rem; min-height: 0; border-radius: 8px; }
  .gm-reise-node { position: absolute; left: 50%; top: var(--cy); margin: -7px 0 0 -7px; }
  .gm-reise-stop.is-x .gm-reise-node { margin: -10px 0 0 -10px; }
  .gm-reise-stop.is-cap .gm-reise-node { margin: -5px 0 0 -13px; }
  .gm-reise-stop.is-cap.is-end .gm-reise-node { margin: -13px 0 0 -13px; }
  .gm-reise-stop.is-current .gm-reise-node { box-shadow: 0 0 0 3px var(--rail-bg), 0 0 0 6px var(--nc); }
  .gm-reise-stop.is-x.is-current .gm-reise-node { box-shadow: 0 0 0 3px var(--rail-bg), 0 0 0 6px var(--warm); }
  .gm-reise-lab { display: contents; }
  .gm-reise-t, .gm-reise-y {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; display: block;
  }
  .gm-reise-stop.is-cap .gm-reise-num { display: none; }
  .gm-reise-num { position: absolute; left: 0; right: 0; top: calc(var(--cy) + 15px); text-align: center; min-width: 0; font-size: .7rem; }
  .gm-reise-stop.is-current .gm-reise-num { color: var(--ink); font-size: .78rem; }
  .gm-reise-br {
    left: calc(50% + (var(--k) - (var(--n) - 1) / 2) * 9px - 1.5px); width: 3px; height: calc(var(--cy) - 10px); top: 6px;
  }
  .gm-reise-br::before { left: 50%; top: -3px; margin: 0 0 0 -5.5px; }
  .gm-reise-tip { display: none; }
  .gm-reise-scroll { padding-top: 1.2rem; }
  .gm-reise-back-long { display: none; }
  .gm-reise-back-short { display: inline; }
  .gm-reise-hint { display: none; }
  .gm-reise-foot-in { padding-block: .55rem; gap: .5rem; }
  .gm-reise-prev .gm-reise-btnlab { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .gm-reise-prev { min-width: 46px; padding-inline: .7rem; }
}
@media (min-width: 1400px) {
  .gm-reise-root { --railw: 21rem; }
}
@media (max-width: 420px) {
  .gm-reise-pos { font-size: .84rem; }
  .gm-reise-foot-in { gap: .5rem; }
  .gm-reise-foot .gm-reise-next { padding-inline: 1rem; }
}
@media (max-width: 560px) {
  .gm-reise-facts { gap: .5rem; }
  .gm-reise-fact dt { letter-spacing: .08em; font-size: .64rem; }
  .gm-reise-nextcard { padding: .95rem 1rem .95rem 1.4rem; }
  .gm-reise-nc-go { width: 40px; height: 40px; }
  .gm-reise-rec { grid-template-columns: auto minmax(0, 1fr); padding-left: 1.3rem; }
  .gm-reise-rec-go { display: none; }
  .gm-reise-route li.is-x i { width: 16px; height: 16px; border-width: 3px; }
  .gm-reise-route i { width: 11px; height: 11px; border-width: 2.5px; }
}
@media (max-height: 520px) and (max-width: 959px) {
  .gm-reise-head { padding-block: .25rem .35rem; gap: .6rem; }
  .gm-reise-medal { width: 30px; height: 30px; box-shadow: none; }
  .gm-reise-medal svg { width: 17px; height: 17px; }
  .gm-reise-close { min-width: 40px; min-height: 40px; }
  .gm-reise-stopbtn { height: 3.2rem; }
  .gm-reise-root { --cy: 27px; }
  .gm-reise-num { top: calc(var(--cy) + 13px); }
  .gm-reise-foot-in { padding-block: .25rem; }
  .gm-reise-foot .gm-btn { min-height: 40px; }
  .gm-reise-origin { padding-block: .25rem; }
  .gm-reise-scroll { padding-top: .8rem; }
}
@media print { .gm-reise-root { display: none; } }
`;

  function injectCss() {
    if (doc.getElementById('gm-reise-css')) return;
    var s = doc.createElement('style');
    s.id = 'gm-reise-css';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Kleine Helfer
   * ------------------------------------------------------------------ */

  function el() { return M.el.apply(M, arguments); }
  function ico(key, size, cls) { return (M.icons && M.icons.svg) ? M.icons.svg(key, { size: size || 20, cls: cls || '' }) : ''; }
  function xico(key, size) { return (M.ui && M.ui.icon) ? M.ui.icon(key, size) : ico(key, size); }
  function reduced() { return M.reducedMotion ? M.reducedMotion() : false; }
  function jOf(id) { return (M.data && M.data.journeyById && M.data.journeyById[id]) || null; }
  function orderOf(id) { return (M.data && M.data.orders && M.data.orders[id]) || []; }
  function stOf(id) { return (M.data && M.data.stations && M.data.stations[id]) || null; }
  function jColor(id) { return 'var(--j-' + id + ')'; }
  function nameOf(id) { var j = jOf(id); return j ? j.name : id; }
  function realJ(st) { return (st.journeys || []).filter(function (j) { var x = jOf(j); return x && !x.virtual; }); }
  function shortTitle(t) {
    t = String(t || '');
    var i = t.indexOf(': ');
    return (i > 2 && i < t.length - 3) ? t.slice(0, i) : t;
  }
  function yearOf(st) {
    if (st.yearLabel) return String(st.yearLabel);
    if (typeof st.year === 'number') return st.year < 0 ? Math.abs(st.year) + ' v. Chr.' : String(st.year);
    return '';
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function fire(type, detail) {
    try { doc.dispatchEvent(new CustomEvent(type, { detail: detail })); } catch (e) { /* ältere Engines */ }
  }
  var uidN = 0;
  function uid(p) { return 'gm-reise-' + p + '-' + (++uidN); }

  function words(s) { s = String(s || '').trim(); return s ? s.split(/\s+/).length : 0; }
  function stationWords(st) {
    var n = words(st.teaser);
    (st.text || []).forEach(function (p) { n += words(p); });
    (st.facts || []).forEach(function (p) { n += words(p); });
    if (st.quote && st.quote.text) n += words(st.quote.text);
    if (st.myth) n += words(st.myth.glaube) + words(st.myth.wahrheit);
    return n;
  }
  function readInfo(ids) {
    var w = 0, ex = 0;
    ids.forEach(function (id) {
      var s = stOf(id);
      if (!s) return;
      w += stationWords(s);
      if (s.exhibit) ex++;
    });
    var m = w / 180;
    var min = m < 10 ? Math.max(1, Math.round(m)) : Math.round(m / 5) * 5;
    return { min: min, exhibits: ex };
  }

  /* ------------------------------------------------------------------ *
   * Zustand
   * ------------------------------------------------------------------ */

  var S = {
    open: false, jid: null, j: null, order: [], idx: -1,
    host: null, root: null, rail: null, line: null, scroll: null, stage: null, band: null, tip: null, prog: null,
    ui: {}, stops: [], page: null, swapToken: 0, swapTimer: null,
    origin: null, pending: null, busy: false, newStamp: false, unsub: [], cleanup: null, tipTimer: null, rd: false
  };

  /* ------------------------------------------------------------------ *
   * Hülle (Kopf, Linie, Hauptbereich, Fuß)
   * ------------------------------------------------------------------ */

  function legGradient() {
    var j = S.j;
    if (!j.legs) return null;
    var seq = [];
    j.legs.forEach(function (l) { if (l && seq[seq.length - 1] !== l) seq.push(l); });
    if (seq.length < 2) return null;
    var n = seq.length;
    return 'linear-gradient(90deg,' + seq.map(function (l, k) {
      return jColor(l) + ' ' + (k / n * 100).toFixed(2) + '% ' + ((k + 1) / n * 100).toFixed(2) + '%';
    }).join(',') + ')';
  }

  function typeLabel(j) {
    if (j.virtual) return M.t('grandTour');
    return M.typeLabel(j.typ === 'historisch' ? 'historisch' : 'funktional', 'sg');
  }

  function buildShell() {
    var j = S.j;
    var root = el('div', { class: 'gm-reise-root' + (S.arrival ? ' is-arriving' : ''), style: { '--jc': jColor(S.jid) } });
    var grad = legGradient();
    if (grad) root.style.setProperty('--hl', grad);

    var head = el('header', { class: 'gm-reise-head' },
      el('span', { class: 'gm-reise-medal', 'aria-hidden': 'true', html: ico(j.icon || 'train', 26) }),
      el('div', { class: 'gm-reise-headtext' },
        el('p', { class: 'gm-reise-eyebrow' }, typeLabel(j)),
        el('h1', { class: 'gm-reise-name' }, j.name)),
      el('button', {
        type: 'button', class: 'gm-iconbtn gm-reise-close', 'aria-label': (M.t('journey') + ' beenden'), title: (M.t('journey') + ' beenden (Esc)'),
        html: ico('close', 22), on: { click: function () { if (M.nav) M.nav.closeOverlay(); } }
      }));

    S.band = el('div', { class: 'gm-reise-origin', hidden: true });

    // Liniendiagramm
    var railH = uid('rh');
    S.line = el('ol', { class: 'gm-reise-line' });
    S.rail = el('nav', { class: 'gm-reise-rail', 'aria-labelledby': railH },
      el('p', { class: 'gm-reise-rail-h', id: railH }, 'Linienplan'),
      S.line,
      el('ul', { class: 'gm-reise-legend', 'aria-hidden': 'true' },
        el('li', null, el('span', { class: 'gm-reise-lg' }), 'Noch offen'),
        el('li', null, el('span', { class: 'gm-reise-lg is-seen' }), 'Besucht'),
        el('li', null, el('span', { class: 'gm-reise-lg is-x' }), (M.t('interchange') + ': hier kannst du ' + M.tl('transfer')))));
    buildStops();
    S.line.addEventListener('keydown', onRailKey);

    // Hauptbereich
    S.stage = el('div', { class: 'gm-reise-stage' });
    S.scroll = el('div', { class: 'gm-reise-scroll', tabindex: '-1' }, S.stage);
    var main = el('section', { class: 'gm-reise-main', 'aria-label': M.t('station') }, S.scroll);

    // Fuß
    var ui = S.ui = {};
    ui.prev = el('button', { type: 'button', class: 'gm-btn gm-btn-ghost gm-reise-prev', title: 'Zurück (Pfeil links)', 'aria-keyshortcuts': 'ArrowLeft', on: { click: function () { prevStep(); } } },
      el('span', { 'aria-hidden': 'true', html: ico('arrow-left', 18) }), el('span', { class: 'gm-reise-btnlab' }, 'Zurück'));
    ui.pos = el('span', { class: 'gm-reise-pos' });
    ui.hint = el('span', { class: 'gm-reise-hint' });
    ui.nextLab = el('span', { class: 'gm-reise-btnlab' }, 'Weiter');
    ui.nextIco = el('span', { 'aria-hidden': 'true', html: ico('arrow-right', 18) });
    ui.next = el('button', { type: 'button', class: 'gm-btn gm-btn-primary gm-reise-next', title: 'Weiter (Pfeil rechts)', 'aria-keyshortcuts': 'ArrowRight', on: { click: function () { nextStep(); } } },
      ui.nextLab, ui.nextIco);
    ui.fill = el('div', { class: 'gm-reise-prog-fill' });
    S.prog = el('div', { class: 'gm-reise-prog', 'aria-hidden': 'true' }, ui.fill);
    var foot = el('footer', { class: 'gm-reise-foot' }, S.prog,
      el('div', { class: 'gm-reise-foot-in' }, ui.prev,
        el('div', { class: 'gm-reise-mid' }, ui.pos, el('span', null, ui.hint)), ui.next));

    S.tip = el('div', { class: 'gm-reise-tip', 'aria-hidden': 'true' });
    root.appendChild(head);
    root.appendChild(S.band);
    root.appendChild(S.rail);
    root.appendChild(main);
    root.appendChild(foot);
    root.appendChild(S.tip);
    S.root = root;
    S.host.innerHTML = '';
    S.host.appendChild(root);
    renderOrigin();
  }

  /* ---------- Haltestellen ---------- */

  function buildStops() {
    var j = S.j, N = S.order.length, rd = !!j.legs;
    S.rd = rd;
    S.stops = [];
    S.line.innerHTML = '';

    function colIn(i) { return jColor(rd ? (j.legs[i] || S.jid) : S.jid); }
    function colOut(i) { return jColor(rd ? (j.onward[i] || j.legs[i] || S.jid) : S.jid); }

    function add(i, kind) {
      var cap = kind === 'start' || kind === 'end';
      var sid = cap ? null : S.order[i];
      var st = sid ? stOf(sid) : null;
      var others = [];
      if (st) {
        others = realJ(st).filter(function (x) {
          if (rd) return x !== j.legs[i] && x !== j.onward[i];
          return x !== S.jid;
        });
      }
      var isX = !!st && (rd ? ((j.onward[i] && j.legs[i] !== j.onward[i]) || realJ(st).length > 1) : realJ(st).length > 1);
      var inC = cap ? (kind === 'start' ? colOut(0) : colIn(N - 1)) : colIn(i);
      var outC = cap ? (kind === 'start' ? colOut(0) : colIn(N - 1)) : colOut(i);
      var dist = Math.min(i < 0 ? 0 : i + 1, 22);
      var li = el('li', {
        class: 'gm-reise-stop is-drawn' + (cap ? ' is-cap is-' + kind : '') + (isX ? ' is-x' : ''),
        dataset: { i: i },
        style: { '--sin': inC, '--sout': outC, '--nc': st && rd ? inC : 'var(--jc)', '--dl': (S.arrival ? 0.05 : 0) + dist * 0.03 + 's' }
      });
      var label, title, year = '';
      if (kind === 'start') { label = ('Einführung zur ' + M.t('journey')); title = 'Einführung'; }
      else if (kind === 'end') { label = ('Ziel der ' + M.t('journey') + ' und Stempel'); title = 'Ziel & Stempel'; }
      else {
        title = shortTitle(st ? st.title : sid);
        year = st ? yearOf(st) : '';
        // Jahr nur zeigen, wenn es kurz ist und nicht schon im Titel steht
        if (year && (year.length > 10 || title.indexOf(year) >= 0 || (st && st.title.indexOf(year) >= 0))) year = '';
        label = (M.t('station') + ' ') + (i + 1) + ': ' + (st ? st.title : sid);
        if (isX && st) {
          var names = realJ(st).filter(function (x) { return x !== S.jid; }).map(nameOf);
          if (names.length) label += ('. ' + M.t('interchange') + ' mit ') + names.join(' und ');
        }
      }
      var brs = others.slice(0, 4).map(function (x, k) {
        return el('span', { class: 'gm-reise-br', 'aria-hidden': 'true', style: { '--bc': jColor(x), '--k': k, '--n': Math.min(others.length, 4) } });
      });
      var node = el('span', { class: 'gm-reise-node', 'aria-hidden': 'true', html: kind === 'end' ? ico('stamp', 14) : '' });
      var btn = el('button', {
        type: 'button', class: 'gm-reise-stopbtn', tabindex: '-1', 'aria-label': label,
        on: { click: function () { hideTip(true); show(i, {}); } }
      }, brs, node,
        el('span', { class: 'gm-reise-lab' },
          el('span', { class: 'gm-reise-num', 'aria-hidden': 'true' }, cap ? '' : String(i + 1)),
          el('span', { class: 'gm-reise-t' }, title),
          year ? el('span', { class: 'gm-reise-y', 'aria-hidden': 'true' }, year) : null));
      li.appendChild(btn);
      if (isX && st) {
        li.addEventListener('mouseenter', function () { showTip(li, st, i); });
        li.addEventListener('mouseleave', function () { hideTip(); });
        btn.addEventListener('focus', function () { showTip(li, st, i); });
        btn.addEventListener('blur', function () { hideTip(); });
      }
      S.line.appendChild(li);
      S.stops.push({ i: i, li: li, btn: btn, sid: sid, label: label, cap: kind });
    }

    add(-1, 'start');
    for (var i = 0; i < N; i++) add(i, null);
    add(N, 'end');
  }

  function hasStamp() { return M.store.stamps().indexOf(S.jid) >= 0; }

  function updateRail(center) {
    var cur = S.idx, N = S.order.length;
    var stamp = hasStamp();
    S.stops.forEach(function (s) {
      var i = s.i;
      var seen;
      if (i < 0) seen = cur >= 0;
      else if (i >= N) seen = stamp;
      else seen = M.store.isVisited(s.sid);
      s.li.classList.toggle('is-current', i === cur);
      s.li.classList.toggle('is-in', i <= cur);
      s.li.classList.toggle('is-out', i < cur);
      s.li.classList.toggle('is-seen', !!seen);
      if (i === cur) s.btn.setAttribute('aria-current', 'step'); else s.btn.removeAttribute('aria-current');
      s.btn.setAttribute('aria-label', s.label + (seen && i >= 0 && i < N ? '. Besucht' : '') + (seen && i >= N ? '. Stempel gesammelt' : ''));
      s.btn.tabIndex = i === cur ? 0 : -1;
    });
    if (center) centerRail(center === 'smooth');
  }

  function centerRail(smooth) {
    var rail = S.rail;
    var s = S.stops.filter(function (x) { return x.i === S.idx; })[0];
    if (!rail || !s) return;
    var horizontal = rail.scrollWidth > rail.clientWidth + 2 && rail.scrollHeight <= rail.clientHeight + 2 && getComputedStyle(S.line).display === 'flex';
    var behavior = smooth && !reduced() ? 'smooth' : 'auto';
    try {
      if (horizontal) {
        var left = s.li.offsetLeft + s.li.offsetWidth / 2 - rail.clientWidth / 2;
        rail.scrollTo({ left: Math.max(0, left), behavior: behavior });
      } else {
        var rr = rail.getBoundingClientRect(), lr = s.li.getBoundingClientRect();
        var top = rail.scrollTop + (lr.top - rr.top) - rail.clientHeight / 2 + lr.height / 2;
        rail.scrollTo({ top: Math.max(0, top), behavior: behavior });
      }
    } catch (e) { /* ältere Engines */ }
  }

  /* Tastatur im Liniendiagramm: Pfeile bewegen den Fokus (roving tabindex) */
  function onRailKey(e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (keys.indexOf(e.key) < 0) return;
    var btns = S.stops.map(function (s) { return s.btn; });
    var at = btns.indexOf(doc.activeElement);
    if (at < 0) return;
    e.preventDefault();
    var to = at;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = Math.max(0, at - 1);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = Math.min(btns.length - 1, at + 1);
    else if (e.key === 'Home') to = 0;
    else to = btns.length - 1;
    btns.forEach(function (b, k) { b.tabIndex = k === to ? 0 : -1; });
    btns[to].focus({ preventScroll: true });
    btns[to].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ---------- Tooltip an Kreuzungen ---------- */

  function showTip(li, st, i) {
    if (!S.tip || !window.matchMedia || !window.matchMedia('(min-width: 960px)').matches) return;
    clearTimeout(S.tipTimer);
    var others = realJ(st).filter(function (x) { return x !== S.jid; });
    if (S.rd) others = realJ(st).filter(function (x) { return x !== S.j.legs[i]; });
    if (!others.length) return;
    var list = el('ul');
    others.forEach(function (jid) {
      var why = st.cross && st.cross[jid];
      list.appendChild(el('li', { style: { '--bc': jColor(jid) } },
        el('span', { class: 'gm-reise-tip-dot' }),
        el('span', { class: 'gm-reise-tip-n' }, nameOf(jid)),
        why ? el('span', { class: 'gm-reise-tip-w' }, why) : null));
    });
    S.tip.innerHTML = '';
    S.tip.appendChild(el('p', { class: 'gm-reise-tip-h' }, (M.t('interchange') + ' · hier halten auch')));
    S.tip.appendChild(list);
    var rr = S.root.getBoundingClientRect(), lr = li.getBoundingClientRect(), rl = S.rail.getBoundingClientRect();
    S.tip.style.left = Math.round(rl.right - rr.left + 10) + 'px';
    var h = S.tip.offsetHeight;
    var top = lr.top - rr.top + lr.height / 2 - h / 2;
    top = Math.max(8, Math.min(rr.height - h - 8, top));
    S.tip.style.top = Math.round(top) + 'px';
    S.tip.classList.add('is-on');
  }
  function hideTip(now) {
    if (!S.tip) return;
    clearTimeout(S.tipTimer);
    if (now) S.tip.classList.remove('is-on');
    else S.tipTimer = setTimeout(function () { if (S.tip) S.tip.classList.remove('is-on'); }, 60);
  }

  /* ---------- Herkunft („Zurück zu …“) ---------- */

  function renderOrigin() {
    var band = S.band, o = S.origin;
    if (!band) return;
    band.innerHTML = '';
    band.hidden = !o;
    if (!o) return;
    var oj = jOf(o.jid);
    var st = stOf(o.sid);
    band.style.setProperty('--oc', jColor(o.jid));
    band.appendChild(el('p', { class: 'gm-reise-origin-t' },
      'Umgestiegen' + (st ? ' bei ' : ''), st ? el('strong', null, '„' + shortTitle(st.title) + '“') : null,
      '. Du fährst jetzt auf „' + S.j.name + '“.'));
    band.appendChild(el('button', {
      type: 'button', class: 'gm-reise-back', 'aria-label': ('Zurück zur ' + M.t('journey') + ' ') + (oj ? oj.name : o.jid),
      on: { click: function () { goBackToOrigin(); } }
    },
      el('span', { class: 'gm-reise-back-dot', 'aria-hidden': 'true', html: ico((oj && oj.icon) || 'train', 16) }),
      el('span', { class: 'gm-reise-back-long', 'aria-hidden': 'true' }, 'Zurück zu ' + (oj ? oj.name : o.jid)),
      el('span', { class: 'gm-reise-back-short', 'aria-hidden': 'true' }, 'Zurück zu ' + (oj ? (oj.kurz || oj.name) : o.jid))));
  }

  /* ------------------------------------------------------------------ *
   * Seiten: Intro, Station, Abschluss
   * ------------------------------------------------------------------ */

  function partners(jid) {
    var map = {};
    orderOf(jid).forEach(function (sid) {
      var s = stOf(sid);
      if (!s) return;
      realJ(s).forEach(function (x) { if (x !== jid) (map[x] = map[x] || []).push(sid); });
    });
    var rank = {};
    ((M.data && M.data.journeys) || []).forEach(function (j, k) { rank[j.id] = k; });
    return Object.keys(map).map(function (k) { return { jid: k, ids: map[k] }; })
      .sort(function (a, b) { return (b.ids.length - a.ids.length) || (rank[a.jid] - rank[b.jid]); });
  }

  function firstOpen() {
    for (var i = 0; i < S.order.length; i++) if (!M.store.isVisited(S.order[i])) return i;
    return -1;
  }

  function routeStrip() {
    var j = S.j, rd = !!j.legs;
    var ol = el('ol', { class: 'gm-reise-route', 'aria-hidden': 'true' });
    S.order.forEach(function (sid, i) {
      var st = stOf(sid);
      var inC = rd ? jColor(j.legs[i] || S.jid) : jColor(S.jid);
      var outC = rd ? jColor(j.onward[i] || j.legs[i] || S.jid) : jColor(S.jid);
      var isX = !!st && (rd ? ((j.onward[i] && j.legs[i] !== j.onward[i]) || realJ(st).length > 1) : realJ(st).length > 1);
      ol.appendChild(el('li', {
        class: (isX ? 'is-x' : '') + (M.store.isVisited(sid) ? ' is-seen' : ''),
        style: { '--i': i, '--sin': inC, '--sout': outC, '--nc': rd ? inC : jColor(S.jid) }
      }, el('i')));
    });
    return ol;
  }

  function introPage() {
    var j = S.j, N = S.order.length, rd = !!j.legs;
    var id = uid('ph');
    var page = el('div', { class: 'gm-reise-page gm-reise-page--intro' });
    var info = readInfo(S.order);
    var crossN = S.order.filter(function (sid, k) { var s = stOf(sid); return s && (rd ? ((j.onward[k] && j.legs[k] !== j.onward[k]) || realJ(s).length > 1) : realJ(s).length > 1); }).length;
    var prog = M.store.progress(S.jid);
    var legUnique = [];
    if (rd) j.legs.forEach(function (l) { if (l && legUnique.indexOf(l) < 0) legUnique.push(l); });

    var sec = el('section', { class: 'gm-reise-intro', 'aria-labelledby': id },
      el('p', { class: 'gm-reise-kicker' }, 'Einführung'),
      el('h2', { class: 'gm-reise-ph gm-reise-ph--big', id: id, tabindex: '-1' }, j.name),
      j.tagline ? el('p', { class: 'gm-reise-tagline' }, j.tagline) : null,
      N ? routeStrip() : null,
      j.intro ? el('p', { class: 'gm-reise-introtext' }, j.intro) : null);

    if (N) {
      var facts = el('dl', { class: 'gm-reise-facts', 'aria-label': ('Die ' + M.t('journey') + ' in Zahlen') },
        el('div', { class: 'gm-reise-fact' }, el('dd', null, String(rd ? legUnique.length : N)), el('dt', null, rd ? (M.t('journeys') + ' berührt') : M.t('stations'))),
        el('div', { class: 'gm-reise-fact' }, el('dd', null, String(rd ? N : crossN)), el('dt', null, rd ? M.t('stations') : (crossN === 1 ? M.t('interchange') : M.t('interchanges')))),
        el('div', { class: 'gm-reise-fact' }, el('dd', { html: '<small>ca.</small>' + info.min }), el('dt', null, 'Minuten Lesezeit')));
      sec.appendChild(facts);
      if (info.exhibits) {
        sec.appendChild(el('p', { class: 'gm-reise-progline' },
          'Dazu ' + (info.exhibits === 1 ? ('ein ' + M.t('exhibit')) : info.exhibits + (' ' + M.t('exhibits'))) + ' zum Ausprobieren, so viel Zeit du magst.'));
      }
    }

    if (rd && legUnique.length) {
      var path = el('ol', { class: 'gm-reise-path', 'aria-label': ('Reihenfolge der ' + M.t('journeys')) });
      legUnique.forEach(function (l) { path.appendChild(el('li', null, M.ui.journeyChip(l))); });
      sec.appendChild(el('section', { class: 'gm-reise-sec', 'aria-label': 'Dein Weg' },
        el('h3', { class: 'gm-reise-sec-h' }, el('span', { 'aria-hidden': 'true', html: ico('path', 18) }), 'Dein Weg'), path));
    } else if (!rd) {
      var ps = partners(S.jid);
      if (ps.length) {
        var ul = el('ul', { class: 'gm-reise-links' });
        ps.forEach(function (p) {
          ul.appendChild(el('li', null, M.ui.journeyChip(p.jid),
            el('span', null, plural(p.ids.length, ('gemeinsame ' + M.t('station')), ('gemeinsame ' + M.t('stations'))))));
        });
        sec.appendChild(el('section', { class: 'gm-reise-sec', 'aria-label': ('Hier kannst du ' + M.tl('transfer')) },
          el('h3', { class: 'gm-reise-sec-h' }, el('span', { 'aria-hidden': 'true', html: ico('network', 18) }), ('Hier kannst du ' + M.tl('transfer'))), ul));
      }
    }

    if (!N) {
      sec.appendChild(el('p', { class: 'gm-reise-note' }, ('Für diese ' + M.t('journey') + ' sind noch keine ' + M.t('stations') + ' eingerichtet. Schau gleich noch einmal vorbei.')));
    } else {
      if (prog.done > 0) {
        sec.appendChild(el('p', { class: 'gm-reise-progline' },
          prog.done >= prog.total ? 'Du hast alle ' + prog.total + (' ' + M.t('stations') + ' besucht.') : 'Du hast schon ' + prog.done + ' von ' + prog.total + (' ' + M.t('stations') + ' besucht.')));
      }
      var acts = el('div', { class: 'gm-reise-actions' });
      var fo = firstOpen();
      acts.appendChild(el('button', { type: 'button', class: 'gm-btn gm-btn-primary', on: { click: function () { show(0, {}); } } },
        el('span', null, prog.done >= prog.total ? 'Noch einmal von vorn' : (M.t('journey') + ' beginnen')), el('span', { 'aria-hidden': 'true', html: ico('arrow-right', 18) })));
      if (prog.done > 0 && fo > 0) {
        var fs = stOf(S.order[fo]);
        acts.appendChild(el('button', { type: 'button', class: 'gm-btn gm-btn-ghost', on: { click: function () { show(fo, {}); } } },
          el('span', null, ('Weiter bei ' + M.t('station') + ' ') + (fo + 1) + (fs ? ': ' + shortTitle(fs.title) : ''))));
      }
      sec.appendChild(acts);
    }
    page.appendChild(sec);
    page._focus = sec.querySelector('.gm-reise-ph');
    return page;
  }

  function etappeNote(i) {
    var j = S.j;
    var step = M.rundreiseStep ? M.rundreiseStep(S.order[i]) : null;
    if (!step) return null;
    var nextSt = i < S.order.length - 1 ? stOf(S.order[i + 1]) : null;
    var wrap = el('aside', { class: 'gm-reise-etappe', 'aria-label': ('Etappe der ' + M.t('grandTour')) },
      el('p', { class: 'gm-reise-etappe-k' }, 'Etappe ' + (i + 1) + ' von ' + S.order.length),
      el('p', null, step.hint));
    if (step.next && nextSt) {
      wrap.appendChild(el('div', { class: 'gm-reise-etappe-row' },
        el('span', null, 'Weiter geht es mit'), M.ui.journeyChip(step.next),
        el('span', null, 'bis „' + shortTitle(nextSt.title) + '“.')));
    }
    return wrap;
  }

  function nextCard(i) {
    var N = S.order.length;
    var last = i >= N - 1;
    var nx = last ? null : stOf(S.order[i + 1]);
    var btn = el('button', { type: 'button', class: 'gm-reise-nextcard', on: { click: function () { nextStep(); } } },
      el('span', { class: 'gm-reise-nc-k' }, last ? 'Endstation' : ('Nächster Halt · ' + M.t('station') + ' ') + (i + 2) + ' von ' + N),
      el('span', { class: 'gm-reise-nc-t' }, last ? 'Ziel erreichen und Stempel abholen' : (nx ? nx.title : 'Weiter')),
      !last && nx && nx.teaser ? el('span', { class: 'gm-reise-nc-s' }, nx.teaser) : null,
      el('span', { class: 'gm-reise-nc-go', 'aria-hidden': 'true', html: ico(last ? 'stamp' : 'arrow-right', 22) }));
    return btn;
  }

  function stationPage(i) {
    var sid = S.order[i];
    var st = stOf(sid);
    var page = el('div', { class: 'gm-reise-page gm-reise-page--station' });
    if (!st) {
      var miss = el('p', { class: 'gm-reise-note', tabindex: '-1' }, ('Diese ' + M.t('station') + ' ist noch nicht eingerichtet.'));
      page.appendChild(miss);
      page._focus = miss;
      return page;
    }
    if (S.rd) { var et = etappeNote(i); if (et) page.appendChild(et); }
    var art = M.ui.renderStation(st, {
      journeyId: S.jid, headingLevel: 2,
      onTransfer: function (jid, s) { transferTo(jid, s); },
      onChip: function (jid, s) { if (jid !== S.jid && jOf(jid) && !jOf(jid).virtual) transferTo(jid, s); }
    });
    page.appendChild(art);
    page.appendChild(nextCard(i));
    page._art = art;
    page._title = st.title;
    page._focus = art.querySelector('.gm-st-title');
    return page;
  }

  /* ---------- Abschluss ---------- */

  function stampSvg() {
    return '<svg class="gm-reise-stamp-svg" viewBox="0 0 240 240" focusable="false" aria-hidden="true">' +
      '<defs>' +
      '<filter id="gm-reise-worn" x="-4%" y="-4%" width="108%" height="108%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="7" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.1 2.05" result="m"/>' +
      '<feComposite in="SourceGraphic" in2="m" operator="in"/></filter>' +
      '<path id="gm-reise-arc-top" d="M32 120 a88 88 0 1 1 176 0"/>' +
      '<path id="gm-reise-arc-bot" d="M20 120 a100 100 0 0 0 200 0"/>' +
      '</defs>' +
      '<g filter="url(#gm-reise-worn)" fill="currentColor" stroke="currentColor">' +
      '<circle cx="120" cy="120" r="113" fill="none" stroke-width="6"/>' +
      '<circle cx="120" cy="120" r="104" fill="none" stroke-width="1.6"/>' +
      '<circle cx="120" cy="120" r="68" fill="none" stroke-width="1.6"/>' +
      '<text stroke="none" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-weight="700" font-size="15" letter-spacing="3.4" text-anchor="middle">' +
      '<textPath href="#gm-reise-arc-top" startOffset="50%">REISE ABGESCHLOSSEN</textPath></text>' +
      '<text stroke="none" font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif" font-weight="700" font-size="13" letter-spacing="4" text-anchor="middle">' +
      '<textPath href="#gm-reise-arc-bot" startOffset="50%">' + String(M.pack.title || '').toUpperCase() + '</textPath></text>' +
      '<circle cx="26" cy="124" r="3.2" stroke="none"/><circle cx="214" cy="124" r="3.2" stroke="none"/>' +
      '</g></svg>';
  }

  function openStampSvg() {
    return '<svg class="gm-reise-stamp-svg" viewBox="0 0 240 240" focusable="false" aria-hidden="true">' +
      '<circle cx="120" cy="120" r="112" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="3 9" stroke-linecap="round"/>' +
      '<circle cx="120" cy="120" r="68" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 7" stroke-linecap="round"/>' +
      '</svg>';
  }

  function recommendations() {
    var D = M.data, jid = S.jid, list = [];
    var stamps = M.store.stamps();
    if (S.rd) {
      D.journeys.forEach(function (j) {
        if (j.virtual || !orderOf(j.id).length) return;
        var p = M.store.progress(j.id);
        list.push({ jid: j.id, shared: [], score: p.total - p.done, p: p });
      });
      list.sort(function (a, b) { return b.score - a.score; });
    } else {
      partners(jid).forEach(function (pr) {
        list.push({ jid: pr.jid, shared: pr.ids, score: pr.ids.length, p: M.store.progress(pr.jid) });
      });
      list.sort(function (a, b) {
        return (b.score - a.score) || ((a.p.done / (a.p.total || 1)) - (b.p.done / (b.p.total || 1)));
      });
    }
    var fresh = list.filter(function (x) { return stamps.indexOf(x.jid) < 0; });
    var done = list.filter(function (x) { return stamps.indexOf(x.jid) >= 0; });
    var out = fresh.slice(0, 3);
    if (out.length < 2) out = out.concat(done.slice(0, 2 - out.length));
    return out;
  }

  function outroPage() {
    var j = S.j, N = S.order.length;
    var prog = M.store.progress(S.jid);
    var complete = N > 0 && prog.done >= prog.total;
    var id = uid('ph');
    var page = el('div', { class: 'gm-reise-page gm-reise-page--outro' });
    var wrap = el('div', { class: 'gm-reise-stampwrap', 'aria-hidden': 'true' });
    var stamp = el('div', { class: 'gm-reise-stamp' + (complete ? '' : ' is-open'), style: { '--jc': jColor(S.jid) }, html: complete ? stampSvg() : openStampSvg() });
    var mid = el('div', { class: 'gm-reise-stamp-mid' });
    mid.innerHTML = ico(j.icon || 'train', 40);
    mid.appendChild(el('span', { class: 'gm-reise-stamp-n' }, j.kurz || j.name));
    var dateEl = el('span', { class: 'gm-reise-stamp-d', hidden: true });
    mid.appendChild(dateEl);
    stamp.appendChild(mid);
    wrap.appendChild(stamp);
    if (complete) {
      wrap.appendChild(el('span', { class: 'gm-reise-ring' }));
      for (var k = 0; k < 12; k++) {
        wrap.appendChild(el('span', { class: 'gm-reise-spark', style: { '--a': (k * 30 + (k % 2 ? 9 : -5)) + 'deg', '--r': (88 + (k % 3) * 14) + '%' } }));
      }
    }

    var head = el('h2', { class: 'gm-reise-ph gm-reise-outro-h', id: id, tabindex: '-1' },
      complete ? (M.t('journey') + ' abgeschlossen') : (N ? 'Endstation erreicht' : (M.t('journey') + ' beendet')));
    var newBadge = el('p', { class: 'gm-reise-new', hidden: true },
      el('span', { 'aria-hidden': 'true', html: xico('check', 14) }), el('span', null, ('Neuer Stempel in deinem ' + M.t('passport'))));
    var sub = el('p', { class: 'gm-reise-outro-sub' });
    var out = el('div', { class: 'gm-reise-outro', 'aria-labelledby': id, role: 'region' }, wrap, head, newBadge, sub);

    var fo = firstOpen();
    if (complete) {
      sub.textContent = 'Du hast alle ' + N + (' ' + M.t('stations') + ' von „') + j.name + '“ besucht.';
    } else {
      var missing = prog.total - prog.done;
      sub.textContent = N
        ? 'Der Stempel für „' + j.name + '“ wartet noch: Dir ' + (missing === 1 ? 'fehlt' : 'fehlen') + ' noch ' + plural(missing, M.t('station'), M.t('stations')) + '.'
        : '';
    }
    if (j.outro) out.appendChild(el('p', { class: 'gm-reise-outrotext' }, j.outro));

    var acts = el('div', { class: 'gm-reise-actions' });
    if (!complete && fo >= 0) {
      var fs = stOf(S.order[fo]);
      acts.appendChild(el('button', { type: 'button', class: 'gm-btn gm-btn-primary', on: { click: function () { show(fo, {}); } } },
        el('span', null, ('Zur nächsten offenen ' + M.t('station')) + (fs ? ': ' + shortTitle(fs.title) : '')), el('span', { 'aria-hidden': 'true', html: ico('arrow-right', 18) })));
    }
    acts.appendChild(el('button', {
      type: 'button', class: 'gm-btn ' + (complete ? 'gm-btn-primary' : 'gm-btn-ghost'),
      on: { click: function () { if (M.nav) M.nav.openView('reisepass'); } }
    }, el('span', { 'aria-hidden': 'true', html: ico('stamp', 18) }), el('span', null, ('Zum ' + M.t('passport')))));
    acts.appendChild(el('button', { type: 'button', class: 'gm-btn gm-btn-ghost', on: { click: function () { if (M.nav) M.nav.openView('karte'); } } },
      el('span', { 'aria-hidden': 'true', html: ico('map', 18) }), el('span', null, 'Zurück zur Karte')));
    acts.appendChild(el('button', { type: 'button', class: 'gm-btn gm-btn-quiet', on: { click: function () { show(-1, {}); } } }, (M.t('journey') + ' noch einmal ansehen')));
    out.appendChild(acts);

    var recs = recommendations();
    if (recs.length) {
      var rid = uid('rc');
      var ul = el('ul', { class: 'gm-reise-reclist' });
      recs.forEach(function (r) {
        var rj = jOf(r.jid);
        if (!rj) return;
        var names = r.shared.slice(0, 2).map(function (sid) { var s = stOf(sid); return s ? shortTitle(s.title) : ''; }).filter(Boolean);
        var meta;
        if (S.rd) meta = [el('strong', null, r.p.done + ' von ' + r.p.total), (' ' + M.t('stations') + ' besucht')];
        else meta = [el('strong', null, plural(r.shared.length, ('gemeinsame ' + M.t('station')), ('gemeinsame ' + M.t('stations')))),
          names.length ? ' (u. a. ' + names.join(' und ') + ')' : '',
          ' · ' + r.p.done + ' von ' + r.p.total + ' besucht'];
        ul.appendChild(el('li', null, el('button', {
          type: 'button', class: 'gm-reise-rec', style: { '--jc': jColor(r.jid) },
          'aria-label': (M.t('journey') + ' antreten: ') + rj.name,
          on: { click: function () { if (M.nav) M.nav.openJourney(r.jid); } }
        },
          el('span', { class: 'gm-reise-rec-ico', 'aria-hidden': 'true', html: ico(rj.icon || 'train', 26) }),
          el('span', { class: 'gm-reise-rec-n' }, rj.name),
          el('span', { class: 'gm-reise-rec-t' }, rj.tagline || ''),
          el('span', { class: 'gm-reise-rec-m' }, meta),
          el('span', { class: 'gm-reise-rec-go', 'aria-hidden': 'true', html: ico('arrow-right', 22) }))));
      });
      out.appendChild(el('section', { class: 'gm-reise-recs gm-reise-sec', 'aria-labelledby': rid },
        el('h3', { class: 'gm-reise-sec-h', id: rid }, el('span', { 'aria-hidden': 'true', html: ico('compass', 18) }), S.rd ? 'Wo du weiter eintauchen kannst' : 'Wohin es von hier weitergeht'),
        ul));
    }
    page.appendChild(out);
    page._focus = head;

    // Stempel vergeben und einschlagen lassen, sobald die Seite sichtbar ist
    page._onShown = function () {
      if (!complete) return;
      var isNew = false;
      try { isNew = !!M.store.addStamp(S.jid); } catch (e) { isNew = false; }
      if (S.newStamp) isNew = true;
      S.newStamp = false; // nur beim ersten Einschlagen als „neu“ zeigen, nicht bei jedem erneuten Besuch der Abschlusskarte
      if (isNew) {
        try {
          dateEl.textContent = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
          dateEl.hidden = false;
        } catch (e) { /* ohne Datum */ }
        newBadge.hidden = false;
      }
      if (reduced()) { stamp.classList.add('is-ready'); stamp.classList.add('is-hit'); }
      else {
        stamp.classList.add('is-hit');
        wrap.classList.add('is-hit');
        out.classList.add('is-thud');
      }
      stamp.classList.add('is-ready');
      M.announce((M.t('journey') + ' abgeschlossen: ') + j.name + '.' + (isNew ? (' Neuer Stempel in deinem ' + M.t('passport') + '.') : (' Dein Stempel ist bereits im ' + M.t('passport') + '.')));
      updateRail();
    };
    return page;
  }

  /* ------------------------------------------------------------------ *
   * Seitenwechsel
   * ------------------------------------------------------------------ */

  function buildPage(i) {
    var N = S.order.length;
    if (i < 0) return introPage();
    if (i >= N) return outroPage();
    return stationPage(i);
  }

  function destroyPage(p) {
    if (!p) return;
    try { if (p._art) M.ui.destroyStation(p._art); } catch (e) { /* egal */ }
  }

  function focusPage(page) {
    var h = page && page._focus;
    if (!h || !h.isConnected) return;
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    try { h.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }

  function swapPage(page, dir, o) {
    var token = ++S.swapToken;
    var old = S.page;
    clearTimeout(S.swapTimer);
    var kind = o.transfer ? 'fade' : (o.first ? 'up' : (dir === 'next' ? 'next' : (dir === 'prev' ? 'prev' : 'up')));
    var keep = o.keep || 0;
    function put() {
      if (token !== S.swapToken || !S.open) { destroyPage(page); return; }
      // Wurde per Fußleiste oder Linienplan geblättert, bleibt der Fokus dort (sonst müsste man sich
      // bei jedem Schritt erneut bis zum Weiter-Knopf durchtabben); die Ansage nennt dann den Titel.
      var a = doc.activeElement;
      var stay = !o.first && !o.transfer && !!a && a !== doc.body && !!S.host && S.host.contains(a) &&
        !!(a.closest && a.closest('.gm-reise-foot, .gm-reise-rail')) && !a.disabled;
      if (old) { destroyPage(old); if (old.parentNode) old.parentNode.removeChild(old); }
      S.stage.innerHTML = '';
      S.page = page;
      S.stage.appendChild(page);
      page.classList.add('is-in-' + kind);
      S.scroll.scrollTop = o.transfer ? keep : 0;
      if (!o.noFocus && !stay) focusPage(page);
      if (page._say && !o.first) M.announce(stay && page._title ? page._say + ': ' + page._title : page._say);
      if (typeof page._onShown === 'function') page._onShown();
    }
    if (old && !reduced() && !o.instant && old.parentNode) {
      old.classList.add('is-leaving-' + (dir === 'next' || dir === 'prev' ? dir : 'none'));
      S.swapTimer = setTimeout(put, 150);
    } else {
      put();
    }
  }

  function updateFoot() {
    var ui = S.ui, N = S.order.length, i = S.idx;
    var prevT, nextT;
    var pct = N >= 0 ? (i + 1) / (N + 1) : 0;
    ui.fill.style.setProperty('--p', String(Math.max(0, Math.min(1, pct))));
    S.prog.setAttribute('data-zero', i < 0 ? '1' : '0');

    ui.prev.disabled = i < 0;
    ui.next.disabled = false;
    var atEnd = i >= N;
    ui.nextIco.innerHTML = ico(atEnd ? 'stamp' : 'arrow-right', 18);
    if (i < 0) {
      ui.pos.textContent = 'Einführung';
      var first = stOf(S.order[0]);
      ui.hint.textContent = first ? 'Als Nächstes: ' + shortTitle(first.title) : '';
      ui.nextLab.textContent = 'Beginnen';
      ui.next.setAttribute('aria-label', (M.t('journey') + ' beginnen') + (first ? ': ' + first.title : ''));
      ui.next.disabled = !N;
      ui.prev.setAttribute('aria-label', ('Zurück (am Anfang der ' + M.t('journey') + ')'));
    } else if (!atEnd) {
      ui.pos.textContent = (M.t('station') + ' ') + (i + 1) + ' von ' + N;
      nextT = i < N - 1 ? stOf(S.order[i + 1]) : null;
      prevT = i > 0 ? stOf(S.order[i - 1]) : null;
      ui.hint.textContent = nextT ? 'Weiter: ' + shortTitle(nextT.title) : 'Als Nächstes: Ziel und Stempel';
      ui.nextLab.textContent = i === N - 1 ? 'Zum Ziel' : 'Weiter';
      ui.next.setAttribute('aria-label', nextT ? ('Weiter zur nächsten ' + M.t('station') + ': ') + nextT.title : ('Weiter zum Ziel der ' + M.t('journey')));
      ui.prev.setAttribute('aria-label', prevT ? ('Zurück zur vorherigen ' + M.t('station') + ': ') + prevT.title : 'Zurück zur Einführung');
    } else {
      ui.pos.textContent = 'Ziel erreicht';
      ui.hint.textContent = '';
      ui.nextLab.textContent = M.t('passport');
      ui.next.setAttribute('aria-label', ('Zum ' + M.t('passport')));
      var lastT = stOf(S.order[N - 1]);
      ui.prev.setAttribute('aria-label', ('Zurück zur letzten ' + M.t('station')) + (lastT ? ': ' + lastT.title : ''));
    }
  }

  function syncUrl(i) {
    if (!M.nav || typeof M.nav.openJourney !== 'function') return;
    var N = S.order.length;
    if (i >= N) return; // Abschlusskarte: Adresse bleibt auf der letzten Station
    if (i < 0) M.nav.openJourney(S.jid); else M.nav.openJourney(S.jid, i);
  }

  function show(i, o) {
    o = o || {};
    if (!S.open) return;
    if (S.busy && !o.first) return; // Umstieg läuft gerade
    var N = S.order.length;
    i = Math.max(-1, Math.min(N, i));
    var prev = S.idx;
    if (i === prev && S.page && !o.first && !o.force) return;
    hideTip(true);
    var dir = o.dir || (i > prev ? 'next' : (i < prev ? 'prev' : 'none'));
    S.idx = i;
    var page = buildPage(i);
    if (i < 0) page._say = 'Einführung';
    else if (i < N) page._say = (M.t('station') + ' ') + (i + 1) + ' von ' + N;
    swapPage(page, dir, o);
    updateRail(o.first ? 'jump' : 'smooth');
    updateFoot();
    if (!o.noUrl) syncUrl(i);
    if (i >= 0 && i < N) {
      fire('gm:station-open', { id: S.order[i], journeyId: S.jid });
    }
  }

  function nextStep(gesture) {
    var N = S.order.length;
    if (!S.open || S.busy) return;
    if (S.idx >= N) { if (!gesture && M.nav) M.nav.openView('reisepass'); return; }
    if (S.idx === -1 && !N) return;
    show(S.idx + 1, {});
  }
  function prevStep() {
    if (!S.open || S.busy || S.idx < 0) return;
    show(S.idx - 1, {});
  }

  /* ------------------------------------------------------------------ *
   * Umsteigen
   * ------------------------------------------------------------------ */

  function nodePos() {
    var n = S.root && S.root.querySelector('.gm-reise-stop.is-current .gm-reise-node');
    if (!n) return null;
    var rr = S.root.getBoundingClientRect(), nr = n.getBoundingClientRect();
    return { x: nr.left - rr.left + nr.width / 2, y: nr.top - rr.top + nr.height / 2 };
  }

  function launchTransfer(toJid, index, sid, back) {
    if (S.busy || !S.open) return;
    var from = S.jid, fromIdx = S.idx;
    S.busy = true;
    var pos = nodePos();
    var p = S.pending = {
      from: from, fromIdx: fromIdx, to: toJid, station: sid, back: !!back, pos: pos, t: Date.now(), launched: false,
      keep: S.scroll ? S.scroll.scrollTop : 0
    };
    function go() {
      S.busy = false;
      // Wurde die Reise inzwischen geschlossen oder gewechselt, nicht mehr springen
      if (!S.open || S.pending !== p || S.jid !== from || S.idx !== fromIdx) return;
      p.launched = true;
      p.t = Date.now();
      if (M.nav && M.nav.openJourney) M.nav.openJourney(toJid, index);
    }
    if (reduced() || !pos) { go(); return; }
    var pulse = el('span', { class: 'gm-reise-pulse', 'aria-hidden': 'true', style: { left: pos.x + 'px', top: pos.y + 'px', '--pc': jColor(toJid) } });
    S.root.appendChild(pulse);
    setTimeout(function () { if (pulse.parentNode) pulse.parentNode.removeChild(pulse); }, 900);
    setTimeout(go, 430);
  }

  function transferTo(newJid, st) {
    var order = orderOf(newJid);
    var idx = order.indexOf(st.id);
    if (idx < 0) { if (M.toast) M.toast(('Diese ' + M.t('station') + ' liegt nicht auf der ' + M.t('journey') + ' „') + nameOf(newJid) + '“.'); return; }
    launchTransfer(newJid, idx, st.id, false);
  }

  function goBackToOrigin() {
    var o = S.origin;
    if (!o) return;
    var idx = typeof o.idx === 'number' ? o.idx : orderOf(o.jid).indexOf(o.sid);
    launchTransfer(o.jid, idx >= 0 ? idx : undefined, o.sid, true);
  }

  function takeArrival(id) {
    var p = S.pending;
    S.pending = null;
    if (p && p.launched && p.to === id && Date.now() - p.t < 4000) return p;
    return null;
  }

  function celebrateArrival(a) {
    if (!a || reduced() || !S.root) return;
    var pos = a.pos || { x: 40, y: 120 };
    var w = el('span', { class: 'gm-reise-wash', 'aria-hidden': 'true', style: { '--wx': pos.x + 'px', '--wy': pos.y + 'px' } });
    S.root.appendChild(w);
    setTimeout(function () { if (w.parentNode) w.parentNode.removeChild(w); }, 1300);
  }

  /* ------------------------------------------------------------------ *
   * Eingabe: Tastatur, Wischen, Fokusfalle
   * ------------------------------------------------------------------ */

  var BLOCK_KEYS = 'input, textarea, select, [contenteditable], [role="slider"], [role="tablist"], [role="radiogroup"], [role="listbox"], .gm-stage-mount, .gm-reise-line, [data-gm-keys]';

  function focusables() {
    if (!S.host) return [];
    var list = [].slice.call(S.host.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]'));
    return list.filter(function (n) {
      if (n.disabled) return false;
      var t = n.getAttribute('tabindex');
      if (t !== null && parseInt(t, 10) < 0) return false;
      if (n.closest('[hidden], [inert]')) return false;
      return n.getClientRects().length > 0;
    });
  }

  function onKey(e) {
    if (!S.open || e.defaultPrevented) return;
    if (S.host.hasAttribute('inert')) return;
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      var f = focusables();
      if (!f.length) { e.preventDefault(); S.host.focus(); return; }
      var a = doc.activeElement;
      var inside = S.host.contains(a) && a !== S.host;
      if (e.shiftKey && (!inside || a === f[0])) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (!inside || a === f[f.length - 1])) { e.preventDefault(); f[0].focus(); }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    // Liegt der Fokus in der Fußleiste, scrollen Pfeil hoch/runter und Bild hoch/runter den Lesebereich
    if (S.scroll && t && t.closest && t.closest('.gm-reise-foot') && /^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End)$/.test(e.key)) {
      var sc = S.scroll, step = e.key.indexOf('Page') === 0 ? sc.clientHeight * 0.85 : 60;
      e.preventDefault();
      if (e.key === 'Home') sc.scrollTop = 0;
      else if (e.key === 'End') sc.scrollTop = sc.scrollHeight;
      else sc.scrollTop += (/Down$/.test(e.key) ? step : -step);
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (t && t !== doc.body && !S.host.contains(t)) return;
    if (t && t.closest && t.closest(BLOCK_KEYS)) return;
    e.preventDefault();
    if (e.key === 'ArrowRight') nextStep(true); else prevStep();
  }

  function bindSwipe(node) {
    var sx = 0, sy = 0, t0 = 0, ok = false;
    node.addEventListener('touchstart', function (e) {
      ok = false;
      if (!e.touches || e.touches.length !== 1) return;
      var t = e.target;
      if (t.closest && t.closest('input, textarea, select, canvas, svg[data-gm-keys], [role="slider"], [data-gm-keys], .gm-stage-mount, .gm-flip')) return;
      for (var n = t; n && n !== node; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return;
      }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now(); ok = true;
    }, { passive: true });
    node.addEventListener('touchend', function (e) {
      if (!ok) return;
      ok = false;
      var c = e.changedTouches && e.changedTouches[0];
      if (!c || Date.now() - t0 > 700) return;
      var dx = c.clientX - sx, dy = c.clientY - sy;
      if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        if (dx < 0) nextStep(true); else prevStep();
      }
    }, { passive: true });
  }

  function onResize() { hideTip(true); centerRail(false); }

  /* ------------------------------------------------------------------ *
   * Öffentliche API
   * ------------------------------------------------------------------ */

  function teardown(removeDom) {
    S.unsub.forEach(function (fn) { try { fn(); } catch (e) { /* egal */ } });
    S.unsub = [];
    clearTimeout(S.swapTimer);
    clearTimeout(S.tipTimer);
    S.swapToken++;
    if (S.page) { destroyPage(S.page); S.page = null; }
    if (S.stage) [].forEach.call(S.stage.querySelectorAll('.gm-station'), function (a) { try { M.ui.destroyStation(a); } catch (e) { /* egal */ } });
    S.open = false;
    S.busy = false;
    if (removeDom && S.host) { S.host.innerHTML = ''; }
  }

  function open(id, startIndex) {
    var j = jOf(id);
    var host = doc.getElementById('reise');
    if (!j || !host) return;
    injectCss();
    clearTimeout(S.cleanup);
    teardown(false);
    var arrival = takeArrival(id);
    S.arrival = arrival;
    S.newStamp = false;
    S.host = host;
    S.jid = id;
    S.j = j;
    S.order = orderOf(id).slice();
    var N = S.order.length;
    S.idx = (typeof startIndex === 'number' && startIndex >= 0 && startIndex < N) ? startIndex : -1;
    S.origin = arrival && !arrival.back ? { jid: arrival.from, idx: arrival.fromIdx, sid: arrival.station } : null;
    buildShell();

    S.open = true;
    doc.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    bindSwipe(S.scroll);
    S.unsub.push(function () { doc.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); });
    function onStamp(e) { if (e.detail && e.detail.journey === S.jid) S.newStamp = true; }
    doc.addEventListener('gm:stamp', onStamp);
    S.unsub.push(function () { doc.removeEventListener('gm:stamp', onStamp); });
    if (M.store && M.store.onChange) S.unsub.push(M.store.onChange(function () { if (S.open) updateRail(); }));

    show(S.idx, { first: true, noUrl: true, instant: true, transfer: !!arrival, keep: arrival ? arrival.keep : 0 });
    if (arrival) {
      celebrateArrival(arrival);
      // Die Kernansage „Reise gestartet“ kommt direkt nach open(); unsere folgt knapp danach.
      var st = stOf(arrival.station);
      setTimeout(function () {
        if (S.open) M.announce('Umgestiegen auf ' + S.j.name + (st ? '. Du bist weiterhin bei „' + st.title + '“.' : '.'));
      }, 220);
    }
    // Zeitpunkt, an dem das Layout steht: aktuelle Haltestelle zentrieren
    requestAnimationFrame(function () { if (S.open) centerRail(false); });
  }

  function close() {
    hideTip(true);
    teardown(false);
    clearTimeout(S.cleanup);
    var host = S.host;
    // Inhalt erst nach dem Ausblenden entfernen (und nur, wenn kein neuer open() folgte)
    S.cleanup = setTimeout(function () { if (!S.open && host) host.innerHTML = ''; }, 500);
  }

  function goTo(i) {
    if (!S.open) return;
    if (typeof i !== 'number' || isNaN(i)) return;
    show(i, { noUrl: true });
  }

  function currentIndex() { return S.open ? S.idx : -1; }

  M.journey = { open: open, close: close, goTo: goTo, currentIndex: currentIndex };
})();

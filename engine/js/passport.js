/* ==========================================================================
   Museum Studio – js/passport.js
   Ansicht „Reisepass“: Gesamtfortschritt, ein Stempel je Reise plus Stempel der Großen Rundreise,
   Fortschritt je Reise, Empfehlungen („Nächste Haltestellen“), besuchte Stationen, Zurücksetzen.

   API:  MUSEUM.views.reisepass = { mount(el), show(), hide(), focusStation(id), highlightJourney(id|null) }

   Lesezugriff auf MUSEUM.store (isVisited, progress, stamps, get, onChange) und MUSEUM.data.
   Einzige eigene Schreibzugriffe (eigene Schlüssel, nie die von core/journey):
     gm:stampdates  { journeyId: 'JJJJ-MM-TT' }  Datum, an dem der Stempel zum ersten Mal beobachtet wurde
     gm:passseen    [journeyId, …]               Stempel, die im Pass schon „eingeschlagen“ gezeigt wurden
   Zurücksetzen ruft MUSEUM.store.reset() und leert diese beiden Schlüssel.
   Präfix aller Klassen: gm-pass-
   ========================================================================== */
(function () {
  'use strict';

  var M = window.MUSEUM = window.MUSEUM || {};
  M.views = M.views || {};
  var doc = document;
  var uid = 0;

  var ST = { host: null, root: null, sec: {}, shown: false, dirty: true, off: null, hl: null, closed: {}, raf: 0, poll: 0, dlg: null, resetBtn: null };

  /* ------------------------------------------------------------------ *
   * Helfer
   * ------------------------------------------------------------------ */

  function el() { return M.el.apply(M, arguments); }
  function esc(s) { return M.esc ? M.esc(s) : String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function ico(key, size) { return M.icons && M.icons.svg ? M.icons.svg(key, { size: size || 20 }) : ''; }
  function iconInner(key) { return ico(key, 24).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''); }
  function reduced() { return M.reducedMotion ? M.reducedMotion() : false; }
  function sget(k, d) { try { var v = M.store.get(k, d); return v === undefined || v === null ? d : v; } catch (e) { return d; } }
  function sset(k, v) { try { M.store.set(k, v); } catch (e) { /* egal */ } }
  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }
  function plural(n, one, many) { return n === 1 ? one : many; }

  // Spielplan (nur mit packs/<paket>/spielplan.json; sonst ist MUSEUM.spiel nicht aktiv und nichts davon wirkt): verborgene Reisen werden nirgends gezählt oder genannt
  function spielAn() { return !!(M.spiel && M.spiel.aktiv); }
  function spZ(uid) { return spielAn() ? M.spiel.zugang(uid) : null; }
  function jSichtbar(jid) { var z = spZ('episode/' + jid); return !z || z.sichtbar; }
  function jGesperrt(jid) { var z = spZ('episode/' + jid); return !!z && !z.offen; }
  function sGesperrt(sid) { var z = spZ('inhalt/' + sid); return !!z && !z.offen; }
  function sEinheit(uid) { return spielAn() ? M.spiel.einheit(uid) : null; }
  function wartetAufWiedersehen(e) { return !!e && (e.verwittert || e.faellig); }

  function journeys() { return ((M.data && M.data.journeys) || []).filter(function (j) { return j && !j.virtual && jSichtbar(j.id); }); }
  function journeyOf(id) { return M.data && M.data.journeyById && M.data.journeyById[id]; }
  function orderOf(id) { return (M.data && M.data.orders && M.data.orders[id]) || []; }
  function jShort(id) { var j = journeyOf(id); return j ? (j.kurz || j.name) : id; }
  function isKnown(jid) { return !!journeyOf(jid) && !journeyOf(jid).virtual && jSichtbar(jid); }
  function realJourneysOf(st) { return (st.journeys || []).filter(isKnown); }

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
  function kindOf(st) { return (M.kinds && M.kinds[st.kind]) || { label: M.t('station'), icon: 'lightbulb' }; }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
  }
  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
  }

  /* ------------------------------------------------------------------ *
   * Stile
   * ------------------------------------------------------------------ */

  var CSS = [
    '.gm-pass{position:relative;padding-bottom:2.5rem;color:var(--ink)}',
    '.gm-pass-defs{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}',

    /* Umschlag */
    '.gm-pass-cover{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:clamp(1.2rem,4vw,3.4rem);row-gap:1.4rem;align-items:center;',
    'padding:clamp(1.5rem,4.2vw,3rem);border-radius:24px;color:var(--ink);border:1px solid rgba(252,179,0,.38);',
    'background:radial-gradient(120% 150% at 88% -10%,#1d3050 0%,#111b30 46%,#0A0F1D 100%);box-shadow:var(--shadow-lg)}',
    '.gm-pass-cover::before{content:"";position:absolute;inset:9px;z-index:-1;border:1px solid rgba(252,179,0,.26);border-radius:17px;pointer-events:none}',
    '.gm-pass-cover::after{content:"";position:absolute;inset:0;z-index:-2;background:var(--grain);opacity:.55;pointer-events:none}',
    '.gm-pass-guil-wrap{display:contents}',
    '.gm-pass-guil{position:absolute;right:-4%;bottom:-6%;width:78%;height:auto;z-index:-1;opacity:.5;pointer-events:none;',
    '-webkit-mask-image:linear-gradient(90deg,transparent,#000 55%);mask-image:linear-gradient(90deg,transparent,#000 55%)}',
    '.gm-pass-eyebrow{display:flex;align-items:center;gap:.55rem;margin:0 0 .9rem;font:700 .74rem/1.2 var(--font-ui);letter-spacing:.2em;text-transform:uppercase;color:var(--warm)}',
    '.gm-pass-eyebrow svg{width:18px;height:18px}',
    '.gm-pass-headline{margin:0 0 .6rem;font:600 clamp(1.8rem,1.15rem + 2.8vw,3rem)/1.08 var(--font-display);letter-spacing:-.01em;color:#F3EFE6;text-wrap:balance}',
    '.gm-pass-sub{margin:0 0 1.5rem;max-width:34rem;color:#C9CFDB;font-size:1.04rem;line-height:1.6}',
    '.gm-pass-stats{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(6.4rem,1fr));gap:.9rem 1.4rem;max-width:36rem}',
    '.gm-pass-stat{display:flex;flex-direction:column-reverse;gap:.15rem;padding-top:.7rem;border-top:2px solid var(--sc,var(--warm))}',
    '.gm-pass-stat dd{margin:0;font:600 clamp(1.7rem,1.3rem + 1.5vw,2.3rem)/1 var(--font-display);font-variant-numeric:lining-nums tabular-nums;color:#F3EFE6}',
    '.gm-pass-stat dd small{font:500 .5em/1 var(--font-ui);color:#A3ABBB;margin-left:.15em}',
    '.gm-pass-stat dt{font:700 .68rem/1.25 var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:#A3ABBB}',
    '.gm-pass-ring{position:relative;width:clamp(11.5rem,21vw,14.5rem);aspect-ratio:1;justify-self:center}',
    '.gm-pass-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}',
    '.gm-pass-arc-t{fill:none;stroke:rgba(236,232,223,.13);stroke-width:13}',
    '.gm-pass-arc-f{fill:none;stroke-width:13;stroke-dasharray:0 360;transition:stroke-dasharray 1.1s var(--ease);transition-delay:calc(var(--i)*70ms + .15s)}',
    '.gm-pass.is-in .gm-pass-arc-f{stroke-dasharray:var(--len) 360}',
    '.gm-pass-ring-c{position:absolute;inset:0;display:grid;place-content:center;text-align:center;padding:18%}',
    '.gm-pass-ring-n{font:600 clamp(2.6rem,2rem + 2.2vw,3.7rem)/1 var(--font-display);font-variant-numeric:lining-nums tabular-nums;color:#F3EFE6}',
    '.gm-pass-ring-l{margin-top:.35rem;font:700 .66rem/1.35 var(--font-ui);letter-spacing:.14em;text-transform:uppercase;color:#A3ABBB}',
    '.gm-pass-mrz{grid-column:1/-1;margin:.4rem 0 0;padding-top:1rem;border-top:1px dashed rgba(236,232,223,.18);overflow:hidden;',
    'font:600 clamp(.6rem,.45rem + .55vw,.78rem)/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.14em;color:rgba(236,232,223,.5);white-space:pre;user-select:none}',

    /* Abschnitte */
    '.gm-pass-sec{margin-top:clamp(2.6rem,5.5vw,4rem)}',
    '.gm-pass-h{margin:0 0 .45rem;font:600 clamp(1.5rem,1.1rem + 1.6vw,2.15rem)/1.15 var(--font-display);letter-spacing:-.008em;text-wrap:balance}',
    '.gm-pass-h:focus{outline:none}',
    '.gm-pass-lead{margin:0 0 1.6rem;max-width:40rem;color:var(--ink-2);font-size:1.02rem;line-height:1.6}',
    '.gm-pass-subh{display:flex;align-items:center;gap:.6rem;margin:1.8rem 0 .9rem;font:700 .74rem/1.2 var(--font-ui);letter-spacing:.16em;text-transform:uppercase;color:var(--ink-2)}',
    '.gm-pass-subh::after{content:"";flex:1;height:1px;background:var(--line)}',
    '.gm-pass-subh:first-of-type{margin-top:.4rem}',

    /* Stempelkarten */
    '.gm-pass-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.15rem}',
    '@media (min-width:1200px){.gm-pass-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}',
    '.gm-pass-card{--jc:var(--accent);--rot:-4deg;position:relative;display:flex;flex-direction:column;align-items:center;gap:.8rem;height:100%;padding:1.7rem 1.25rem 1.35rem;text-align:center;',
    'background:var(--bg-2) var(--grain);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);',
    'transition:transform .3s var(--ease),border-color .3s,box-shadow .3s,opacity .3s}',
    '.gm-pass-card::before{content:"";position:absolute;inset:6px;border:1px dashed color-mix(in srgb,var(--line) 85%,transparent);border-radius:13px;pointer-events:none}',
    '.gm-pass-card:hover,.gm-pass-card:focus-within{transform:translateY(-3px);box-shadow:var(--shadow-lg)}',
    '.gm-pass-card.is-done{border-color:color-mix(in srgb,var(--jc) 65%,var(--line));background:linear-gradient(180deg,color-mix(in srgb,var(--jc) 8%,var(--bg-2)),var(--bg-2) 62%) var(--grain)}',
    '.gm-pass-card.is-hl{border-color:var(--jc);box-shadow:0 0 0 3px color-mix(in srgb,var(--jc) 32%,transparent),var(--shadow-lg)}',
    '.gm-pass-grid.has-hl .gm-pass-card:not(.is-hl){opacity:.55}',
    '.gm-pass-no{position:absolute;left:1.05rem;top:.9rem;font:700 .68rem/1 var(--font-ui);letter-spacing:.14em;color:var(--ink-2)}',
    '.gm-pass-done-tag{position:absolute;right:.95rem;top:.8rem;display:inline-flex;align-items:center;gap:.3rem;padding:.2rem .6rem .2rem .4rem;border-radius:999px;background:var(--warm);color:var(--on-warm);font:700 .66rem/1.3 var(--font-ui);letter-spacing:.06em;text-transform:uppercase}',
    '.gm-pass-done-tag svg{width:13px;height:13px}',
    '.gm-pass-stamp{position:relative;width:min(10.5rem,64%);aspect-ratio:1;margin-top:.5rem;color:color-mix(in srgb,var(--jc) 78%,var(--ink));transform:rotate(var(--rot));transition:transform .45s var(--ease)}',
    '.gm-pass-card:hover .gm-pass-stamp{transform:rotate(calc(var(--rot) + 3deg)) scale(1.04)}',
    '.gm-pass-stamp.is-open{color:var(--ink-2)}',
    '.gm-pass-stamp-svg{display:block;width:100%;height:100%;overflow:visible}',
    '.gm-pass-ripple{position:absolute;inset:4%;border-radius:50%;border:3px solid var(--warm);opacity:0;pointer-events:none}',
    '.gm-pass-info{display:flex;flex-direction:column;align-items:center;gap:.5rem;width:100%;min-width:0}',
    '.gm-pass-name{margin:0;font:600 1.18rem/1.22 var(--font-display);text-wrap:balance}',
    '.gm-pass-state{margin:0;font-size:.88rem;line-height:1.45;color:var(--ink-2)}',
    '.gm-pass-state strong{color:var(--ink);font-weight:700}',
    '.gm-pass-bar{display:flex;align-items:flex-end;gap:2px;height:15px;width:100%;margin:.15rem 0 .1rem}',
    '.gm-pass-seg{flex:1 1 0;min-width:0;height:8px;border-radius:2px;background:color-mix(in srgb,var(--ink) 12%,transparent);transition:background-color .45s var(--ease),box-shadow .45s;transition-delay:calc(var(--i)*30ms + .1s)}',
    '.gm-pass-seg.is-x{height:15px;border-radius:3px;background:transparent;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--jc) 55%,transparent)}',
    '.gm-pass.is-in .gm-pass-seg.is-on{background:var(--jc)}',
    '.gm-pass.is-in .gm-pass-seg.is-x.is-on{box-shadow:inset 0 0 0 1.5px var(--jc)}',
    '.gm-pass-go{display:inline-flex;align-items:center;gap:.45rem;min-height:40px;padding:.35rem 1rem;border-radius:999px;border:1.5px solid var(--jc);background:transparent;color:var(--ink);',
    'font:600 .88rem/1.2 var(--font-ui);text-decoration:none;transition:background-color .2s,transform .2s var(--ease)}',
    '.gm-pass-go:hover{background:color-mix(in srgb,var(--jc) 16%,transparent);text-decoration:none}',
    '.gm-pass-go svg{width:16px;height:16px}',
    '.gm-pass-card.is-open-state .gm-pass-name{color:var(--ink)}',

    /* Große Rundreise */
    '.gm-pass-grand{--jc:var(--warm);--rot:-5deg;position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);gap:clamp(1.2rem,3.5vw,2.6rem);align-items:center;margin-top:1.15rem;',
    'padding:clamp(1.3rem,3vw,2rem) clamp(1.2rem,3.4vw,2.4rem);border-radius:22px;border:1px solid color-mix(in srgb,var(--warm) 60%,var(--line));',
    'background:linear-gradient(115deg,color-mix(in srgb,var(--warm) 14%,var(--bg-2)),var(--bg-2) 62%) var(--grain);box-shadow:var(--shadow)}',
    '.gm-pass-grand::before{content:"";position:absolute;inset:6px;border:1px dashed color-mix(in srgb,var(--warm) 38%,transparent);border-radius:17px;pointer-events:none}',
    '.gm-pass-grand .gm-pass-stamp{width:clamp(8.5rem,16vw,11.5rem);margin:0;color:color-mix(in srgb,var(--warm) 58%,var(--ink))}',
    '.gm-pass-grand .gm-pass-stamp.is-open{color:var(--ink-2)}',
    '.gm-pass-grand .gm-pass-info{align-items:flex-start;text-align:left}',
    '.gm-pass-grand .gm-pass-name{font-size:clamp(1.3rem,1.1rem + .9vw,1.7rem)}',
    '.gm-pass-grand .gm-pass-bar{max-width:30rem}',
    '.gm-pass-grand .gm-pass-state{max-width:34rem}',

    /* Empfehlungen */
    '.gm-pass-recs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr));gap:1rem}',
    '.gm-pass-rec{--jc:var(--accent);position:relative;display:flex;gap:.95rem;align-items:flex-start;height:100%;padding:1.1rem 1.15rem 1.1rem 1.4rem;overflow:hidden;color:var(--ink);text-decoration:none;',
    'background:var(--bg-2);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);transition:transform .28s var(--ease),border-color .25s,box-shadow .28s}',
    '.gm-pass-rec::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--jc)}',
    '.gm-pass-rec:hover{transform:translateY(-3px);border-color:var(--jc);box-shadow:var(--shadow-lg);text-decoration:none}',
    '.gm-pass-rec.is-flash,.gm-pass-chip.is-flash{animation:gm-pass-flash 1.6s var(--ease)}',
    '.gm-pass-rec-ico{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:50%;border:2px solid var(--jc);background:var(--bg-2);box-shadow:0 0 0 4px color-mix(in srgb,var(--jc) 16%,transparent)}',
    '.gm-pass-rec-body{display:flex;flex-direction:column;gap:.3rem;min-width:0}',
    '.gm-pass-rec-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.2rem .6rem;font:700 .68rem/1.3 var(--font-ui);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2)}',
    '.gm-pass-rec-x{display:inline-flex;align-items:center;gap:.25rem;padding:.1rem .5rem .1rem .35rem;border-radius:999px;background:color-mix(in srgb,var(--warm) 24%,var(--bg-2));border:1px solid color-mix(in srgb,var(--warm) 70%,transparent);color:var(--ink);letter-spacing:.06em}',
    '.gm-pass-rec-x svg{width:12px;height:12px}',
    '.gm-pass-rec-title{font:600 1.12rem/1.25 var(--font-display);text-wrap:balance}',
    '.gm-pass-rec-why{font-size:.88rem;line-height:1.45;color:var(--ink-2)}',
    '.gm-pass-rec-chips{display:flex;flex-wrap:wrap;gap:.35rem;margin-top:.3rem}',
    '.gm-pass-rec-chips .gm-chip{min-height:26px;font-size:.72rem;padding-right:.6rem}',
    '.gm-pass-rec-chips .gm-chip-dot{width:18px;height:18px}',
    '.gm-pass-rec-chips .gm-chip-dot svg{width:11px;height:11px}',
    '.gm-pass-note{display:flex;align-items:center;gap:1rem;padding:1.1rem 1.3rem;border:1px dashed var(--line);border-radius:16px;background:var(--bg-2);color:var(--ink-2)}',
    '.gm-pass-note svg{flex:none;color:var(--warm)}',
    '.gm-pass-note p{margin:0}',

    /* Besuchte Stationen */
    '.gm-pass-groups{display:grid;gap:.9rem}',
    '.gm-pass-group{--jc:var(--accent);border:1px solid var(--line);border-radius:16px;background:var(--bg-2);overflow:hidden}',
    '.gm-pass-group summary{display:flex;align-items:center;gap:.8rem;min-height:56px;padding:.55rem 1rem .55rem .75rem;cursor:pointer;list-style:none;-webkit-tap-highlight-color:transparent}',
    '.gm-pass-group summary::-webkit-details-marker{display:none}',
    '.gm-pass-group summary:hover{background:color-mix(in srgb,var(--jc) 8%,transparent)}',
    '.gm-pass-gico{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;border:2px solid var(--jc);background:var(--bg-2)}',
    '.gm-pass-gname{flex:1;min-width:0;font:600 1.02rem/1.25 var(--font-display)}',
    '.gm-pass-gcount{flex:none;font:700 .74rem/1 var(--font-ui);letter-spacing:.06em;color:var(--ink-2);white-space:nowrap}',
    '.gm-pass-gchev{flex:none;color:var(--ink-2);transition:transform .25s var(--ease)}',
    '.gm-pass-group[open] .gm-pass-gchev{transform:rotate(90deg)}',
    '.gm-pass-chips{list-style:none;margin:0;padding:.2rem 1rem 1.1rem;display:flex;flex-wrap:wrap;gap:.5rem}',
    '.gm-pass-chip{--jc:var(--accent);display:inline-flex;align-items:center;gap:.4rem;max-width:100%;min-height:38px;padding:.3rem .8rem;border-radius:999px;border:1.5px solid var(--jc);cursor:pointer;',
    'background:color-mix(in srgb,var(--jc) 9%,var(--bg-2));color:var(--ink);font:600 .85rem/1.2 var(--font-ui);text-align:left;transition:background-color .2s,transform .2s var(--ease)}',
    '.gm-pass-chip:hover{background:color-mix(in srgb,var(--jc) 22%,var(--bg-2));transform:translateY(-1px)}',
    '.gm-pass-chip-t{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.gm-pass-chip svg{flex:none;width:14px;height:14px;color:var(--ink-2)}',
    '.gm-pass-chip small{flex:none;font:500 .74rem/1 var(--font-ui);color:var(--ink-2)}',
    '.gm-pass-rest{margin:1rem 0 0;color:var(--ink-2);font-size:.92rem}',
    '.gm-pass-empty{display:grid;justify-items:center;gap:.7rem;padding:2.2rem 1.2rem;text-align:center;border:1.5px dashed var(--line);border-radius:18px;background:var(--bg-2);color:var(--ink-2)}',
    '.gm-pass-empty svg{color:var(--warm)}',
    '.gm-pass-empty p{margin:0;max-width:30rem}',
    '.gm-pass-empty-h{font:600 1.25rem/1.25 var(--font-display);color:var(--ink)}',
    '.gm-pass-empty-btns{display:flex;flex-wrap:wrap;justify-content:center;gap:.7rem;margin-top:.4rem}',

    /* Fuß */
    '.gm-pass-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem 2rem;margin-top:clamp(2.6rem,5vw,3.6rem);padding:1.2rem 1.4rem;border:1px solid var(--line);border-radius:16px;background:var(--bg-3)}',
    '.gm-pass-priv{display:flex;align-items:flex-start;gap:.8rem;flex:1 1 20rem;min-width:0;color:var(--ink-2);font-size:.92rem;line-height:1.55}',
    '.gm-pass-priv svg{flex:none;margin-top:.15rem;color:var(--ink)}',
    '.gm-pass-priv strong{display:block;color:var(--ink);font-size:.98rem}',
    '.gm-pass-priv p{margin:.1rem 0 0}',
    '.gm-pass-reset{display:inline-flex;align-items:center;gap:.5rem;min-height:44px;padding:.5rem 1.15rem;border-radius:999px;border:1.5px solid color-mix(in srgb,var(--bad) 70%,var(--line));background:transparent;color:var(--ink);cursor:pointer;font:600 .92rem/1.2 var(--font-ui);transition:background-color .2s,border-color .2s}',
    '.gm-pass-reset:hover{background:color-mix(in srgb,var(--bad) 14%,transparent);border-color:var(--bad)}',

    /* Bestätigungsdialog */
    '.gm-pass-dlg{display:grid;place-items:center;padding:1rem}',
    '.gm-pass-dlg-box{width:min(26rem,100%);padding:1.6rem 1.5rem 1.4rem;border-radius:20px;background:var(--bg-2);color:var(--ink);border:1px solid var(--line);box-shadow:var(--shadow-lg);transform:translateY(14px) scale(.98);transition:transform .3s var(--ease)}',
    '.gm-pass-dlg.is-open .gm-pass-dlg-box{transform:none}',
    '.gm-pass-dlg-ico{display:grid;place-items:center;width:46px;height:46px;margin-bottom:.8rem;border-radius:50%;background:color-mix(in srgb,var(--bad) 16%,var(--bg-2));border:2px solid var(--bad);color:var(--ink)}',
    '.gm-pass-dlg-t{margin:0 0 .5rem;font:600 1.4rem/1.2 var(--font-display)}',
    '.gm-pass-dlg-p{margin:0 0 1.3rem;color:var(--ink-2);line-height:1.55;font-size:.97rem}',
    '.gm-pass-dlg-btns{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.6rem}',
    '.gm-pass-danger{background:var(--bad);border-color:var(--bad);color:var(--on-accent)}',
    '.gm-pass-danger:hover{background:var(--bad);filter:brightness(1.08)}',

    /* Einblendungen */
    '@keyframes gm-pass-thud{0%{opacity:0;transform:rotate(calc(var(--rot) - 14deg)) scale(1.9)}55%{opacity:1;transform:rotate(var(--rot)) scale(.92)}75%{transform:rotate(var(--rot)) scale(1.04)}100%{opacity:1;transform:rotate(var(--rot)) scale(1)}}',
    '@keyframes gm-pass-ripple{0%{opacity:.9;transform:scale(.8)}100%{opacity:0;transform:scale(1.45)}}',
    '@keyframes gm-pass-flash{0%,60%{box-shadow:0 0 0 4px color-mix(in srgb,var(--warm) 80%,transparent)}100%{box-shadow:0 0 0 4px transparent}}',
    '@keyframes gm-pass-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}',
    '.gm-pass-stamp.is-new{animation:gm-pass-thud .9s .55s cubic-bezier(.2,.9,.25,1) backwards}',
    '.gm-pass-stamp.is-new .gm-pass-ripple{animation:gm-pass-ripple .9s 1.05s ease-out backwards}',
    '.gm-pass:not(.is-in) .gm-pass-card,.gm-pass:not(.is-in) .gm-pass-rec,.gm-pass:not(.is-in) .gm-pass-grand{opacity:0}',
    '.gm-pass.is-in .gm-pass-card,.gm-pass.is-in .gm-pass-rec,.gm-pass.is-in .gm-pass-grand{animation:gm-pass-rise .6s var(--ease) backwards;animation-delay:calc(var(--i,0)*55ms)}',
    '.gm-pass.is-still .gm-pass-card,.gm-pass.is-still .gm-pass-rec,.gm-pass.is-still .gm-pass-grand{animation:none}',

    /* Responsiv */
    '@media (max-width:980px){.gm-pass-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '@media (max-width:720px){',
    '.gm-pass-cover{grid-template-columns:minmax(0,1fr);text-align:left}',
    '.gm-pass-ring{order:-1;justify-self:start;width:10.5rem}',
    '.gm-pass-guil{width:130%;right:-30%}',
    '.gm-pass-stats{grid-template-columns:repeat(2,minmax(0,1fr))}',
    '.gm-pass-grand{grid-template-columns:minmax(0,1fr);justify-items:center;text-align:center}',
    '.gm-pass-grand .gm-pass-info{align-items:center;text-align:center}',
    '}',
    '@media (max-width:560px){',
    '.gm-pass-grid{grid-template-columns:minmax(0,1fr);gap:.9rem}',
    '.gm-pass-card{display:grid;grid-template-columns:6.4rem minmax(0,1fr);align-items:center;gap:.4rem 1rem;padding:2.1rem 1rem 1.15rem;text-align:left}',
    '.gm-pass-card .gm-pass-stamp{width:6.4rem;margin:0}',
    '.gm-pass-card .gm-pass-info{align-items:flex-start}',
    '.gm-pass-card .gm-pass-no{left:1rem;top:.75rem}',
    '.gm-pass-card .gm-pass-done-tag{top:.65rem}',
    '.gm-pass-rec{padding-left:1.2rem}',
    '.gm-pass-foot{padding:1.1rem}',
    '.gm-pass-reset{width:100%;justify-content:center}',
    '.gm-pass-dlg-btns .gm-btn{flex:1 1 9rem}',
    '}',
    '@media (prefers-reduced-motion:reduce){',
    '.gm-pass *{animation:none!important}',
    '.gm-pass-arc-f{transition:none}',
    '.gm-pass-card:hover .gm-pass-stamp,.gm-pass-card:hover,.gm-pass-rec:hover,.gm-pass-chip:hover{transform:none}',
    '.gm-pass-stamp.is-new{opacity:1}',
    '}'
  ].join('\n');

  function injectStyles() {
    if (doc.getElementById('gm-pass-style')) return;
    var s = doc.createElement('style');
    s.id = 'gm-pass-style';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * Modell
   * ------------------------------------------------------------------ */

  function exhibitsDone() {
    var v = sget('exhibits', null);
    if (v === null) return null;
    if (Array.isArray(v)) return v.length;
    if (typeof v === 'number') return v;
    if (typeof v === 'object') return Object.keys(v).filter(function (k) { return !!v[k]; }).length;
    return null;
  }

  function model() {
    var D = M.data, S = D.stations;
    var ids = Object.keys(S);
    var js = journeys();
    var vis = ids.filter(function (i) { return M.store.isVisited(i); });
    var crossIds = (M.crossings && M.crossings.length ? M.crossings.map(function (s) { return s.id; })
      : ids.filter(function (i) { return realJourneysOf(S[i]).length >= 2; }));
    var ex = {};
    ids.forEach(function (i) { if (S[i].exhibit) ex[S[i].exhibit] = true; });
    var hasGrand = !!(D.journeyById && D.journeyById.rundreise && orderOf('rundreise').length);
    var stamps = M.store.stamps().filter(function (j) { return !!journeyOf(j); });
    return {
      total: ids.length,
      visited: vis.length,
      crossTotal: crossIds.length,
      crossVisited: crossIds.filter(function (i) { return M.store.isVisited(i); }).length,
      exDone: exhibitsDone(),
      exTotal: Object.keys(ex).length,
      stamps: stamps,
      stampCount: stamps.length,
      stampTotal: js.length + (hasGrand ? 1 : 0),
      hasGrand: hasGrand,
      journeys: js,
      dates: sget('stampdates', {}) || {}
    };
  }

  function firstOpenIndex(order) {
    for (var i = 0; i < order.length; i++) if (!M.store.isVisited(order[i])) return i;
    return -1;
  }

  /* ------------------------------------------------------------------ *
   * Stempel (SVG)
   * ------------------------------------------------------------------ */

  var SANS = 'ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif';

  function arcFont(txt) {
    var n = txt.length;
    return n <= 8 ? 12 : n <= 11 ? 11 : n <= 14 ? 10 : n <= 17 ? 9 : n <= 20 ? 8.2 : 7.4;
  }

  /* o: { top, bottom, icon, band, open, grand } */
  function stampSvg(o) {
    var id = 'gm-pass-s' + (++uid);
    var top = String(o.top || '').toUpperCase();
    var fs = arcFont(top);
    var out = '<svg class="gm-pass-stamp-svg" viewBox="0 0 160 160" aria-hidden="true" focusable="false">' +
      '<defs><path id="' + id + 't" d="M28 80a52 52 0 1 1 104 0"/><path id="' + id + 'b" d="M20 80a60 60 0 0 0 120 0"/></defs>';
    var text = function (path, size, ls, str, op) {
      return '<text fill="currentColor" stroke="none" font-family="' + SANS + '" font-weight="700" font-size="' + size + '" letter-spacing="' + ls +
        '" text-anchor="middle"' + (op ? ' opacity="' + op + '"' : '') + '><textPath href="#' + id + path + '" startOffset="50%">' + esc(str) + '</textPath></text>';
    };
    var icon = '<g transform="translate(62 45) scale(1.5)" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"' +
      (o.open ? ' opacity=".5"' : '') + '>' + iconInner(o.icon || 'stamp') + '</g>';
    var band;
    if (o.open) {
      band = '<rect x="44" y="90" width="72" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/>' +
        '<text x="80" y="102.1" fill="currentColor" stroke="none" font-family="' + SANS + '" font-weight="700" font-size="9" letter-spacing="1" text-anchor="middle">' + esc(o.band || '') + '</text>';
      out += '<g fill="none" stroke="currentColor" stroke-linecap="round" opacity=".6">' +
        '<circle cx="80" cy="80" r="74" stroke-width="3" stroke-dasharray="3 8"/>' +
        '<circle cx="80" cy="80" r="44" stroke-width="1.4" stroke-dasharray="2 6"/></g>' +
        text('t', fs, 1.2, top) + text('b', 8.6, 2.6, o.bottom || 'NOCH OFFEN') + icon + band;
    } else {
      band = '<rect x="44" y="90" width="72" height="17" rx="3" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
        '<text x="80" y="102.3" fill="currentColor" stroke="none" font-family="' + SANS + '" font-weight="700" font-size="9.2" letter-spacing="1.1" text-anchor="middle">' + esc(o.band || '') + '</text>';
      out += '<g filter="url(#gm-pass-worn)" fill="currentColor" stroke="currentColor">' +
        '<circle cx="80" cy="80" r="74" fill="none" stroke-width="5"/>' +
        '<circle cx="80" cy="80" r="67" fill="none" stroke-width="1.4"/>' +
        '<circle cx="80" cy="80" r="44" fill="none" stroke-width="1.4"/>' +
        (o.grand ? '<circle cx="80" cy="80" r="41" fill="none" stroke-width="1" stroke-dasharray="1 4" stroke-linecap="round"/>' : '') +
        text('t', fs, 1.2, top) + text('b', 8.6, 2.6, o.bottom || String(M.pack.title || '').toUpperCase()) +
        '<circle cx="24.5" cy="80" r="2.4" stroke="none"/><circle cx="135.5" cy="80" r="2.4" stroke="none"/>' +
        icon + band + '</g>';
    }
    return out + '</svg>';
  }

  function defsSvg() {
    return '<svg class="gm-pass-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>' +
      '<filter id="gm-pass-worn" x="-4%" y="-4%" width="108%" height="108%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="11" result="n"/>' +
      '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.1" result="m"/>' +
      '<feComposite in="SourceGraphic" in2="m" operator="in" result="w"/>' +
      '<feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="2" seed="3" result="t"/>' +
      '<feDisplacementMap in="w" in2="t" scale="1.8" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter></defs></svg>';
  }

  function rotFor(i) { return [-5, 3.5, -2.5, 5, -4, 2.5, -3, 4.5, -1.5][i % 9] + 'deg'; }

  /* ------------------------------------------------------------------ *
   * Umschlag (Kopf mit Gesamtfortschritt)
   * ------------------------------------------------------------------ */

  function guilloche() {
    var W = 640, H = 240, out = '';
    var NL = Math.max(9, Math.min(16, journeys().length));
    for (var k = 0; k < NL; k++) {
      var d = '';
      for (var x = 0; x <= W; x += 8) {
        var y = H / 2 + 64 * Math.sin(x * 0.0165 + k * 0.52) + 20 * Math.sin(x * 0.047 + k * 0.95);
        d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
      }
      out += '<path d="' + d + '" stroke="var(--j-' + (journeys()[k] ? journeys()[k].id : 'rundreise') + ')" />';
    }
    return '<svg class="gm-pass-guil" viewBox="0 0 ' + W + ' ' + H + '" fill="none" stroke-width="1.1" aria-hidden="true" focusable="false">' + out + '</svg>';
  }

  function ringSvg(m) {
    var out = '<svg viewBox="0 0 220 220" aria-hidden="true" focusable="false">';
    var js = m.journeys;
    var n = js.length || 1;
    var span = 360 / n, gap = n > 12 ? 2.4 : 3.2;
    js.forEach(function (j, i) {
      var p = M.store.progress(j.id);
      var frac = p.total ? p.done / p.total : 0;
      var len = span - gap;
      var rot = -90 + i * span + gap / 2;
      out += '<circle class="gm-pass-arc-t" cx="110" cy="110" r="94" pathLength="360" stroke-dasharray="' + len.toFixed(2) + ' ' + (360 - len).toFixed(2) +
        '" transform="rotate(' + rot.toFixed(2) + ' 110 110)"/>';
      out += '<circle class="gm-pass-arc-f" cx="110" cy="110" r="94" pathLength="360" style="--i:' + i + ';--len:' + (len * frac).toFixed(2) +
        ';stroke:var(--j-' + j.id + ')" transform="rotate(' + rot.toFixed(2) + ' 110 110)"/>';
    });
    out += '<circle cx="110" cy="110" r="76" fill="none" stroke="rgba(252,179,0,.28)" stroke-width="1" stroke-dasharray="1 5" stroke-linecap="round"/></svg>';
    return out;
  }

  function mrzLines(m) {
    function fit(s) { s = s.replace(/ /g, '<'); while (s.length < 44) s += '<'; return s.slice(0, 44); }
    var l1 = fit('P<<' + String(M.pack.title || '').toUpperCase().replace(/[^A-Z0-9]+/g, '') + '<<' + String(M.t('passport')).toUpperCase().replace(/[^A-Z0-9]+/g, ''));
    var l2 = fit('ST' + pad(m.visited, 3) + pad(m.total, 3) + '<KR' + pad(m.crossVisited, 2) + pad(m.crossTotal, 2) +
      '<SP' + pad(m.stampCount, 2) + pad(m.stampTotal, 2) + (m.exDone !== null ? '<EX' + pad(m.exDone, 2) + pad(m.exTotal, 2) : ''));
    return l1 + '\n' + l2;
  }

  function headlineFor(m) {
    var pct = m.total ? m.visited / m.total : 0;
    if (m.visited === 0) return 'Dein Pass ist noch leer.';
    if (m.visited >= m.total) return ('Alle ' + M.t('stations') + ' besucht.');
    if (pct < 0.25) return 'Die ersten Einträge sind drin.';
    if (pct < 0.5) return 'Du bist unterwegs.';
    if (pct < 0.75) return 'Mehr als die Hälfte geschafft.';
    return ('Fast alle ' + M.t('stations') + ' gesehen.');
  }
  function subFor(m) {
    if (m.visited === 0) return ('Jede ' + M.t('station') + ', die du aufschlägst, wird hier festgehalten. Für jede vollendete ' + M.t('journey') + ' bekommst du einen Stempel, für die ' + M.t('grandTour') + ' ein ganz besonderes Siegel.');
    var s = 'Du hast ' + m.visited + ' von ' + m.total + (' ' + M.t('stations') + ' besucht');
    var done = m.stamps.filter(function (j) { return j !== 'rundreise'; }).length;
    if (done) s += ' und ' + done + ' ' + plural(done, M.t('journey'), M.t('journeys')) + ' vollendet';
    s += '.';
    if (m.visited >= m.total) s += (' Der Pass ist voll. Du kannst jederzeit eine ' + M.t('journey') + ' noch einmal fahren.');
    else if (m.crossTotal && m.crossVisited < m.crossTotal) s += (' An den ' + M.t('interchanges') + ' wechselst du die Linie, dort liegen oft die überraschendsten Verbindungen.');
    return s;
  }

  function buildCover(m) {
    var stats = [
      { k: M.t('stations'), v: m.visited, of: m.total, c: 'var(--warm)' },
      { k: M.t('interchanges'), v: m.crossVisited, of: m.crossTotal, c: 'var(--jp-3)' }
    ];
    if (m.exDone !== null) stats.push({ k: (M.t('exhibits') + ' gelöst'), v: m.exDone, of: m.exTotal, c: 'var(--jp-5)' });
    stats.push({ k: 'Stempel', v: m.stampCount, of: m.stampTotal, c: 'var(--jp-2)' });

    var dl = el('dl', { class: 'gm-pass-stats', 'aria-label': 'Dein Fortschritt in Zahlen' });
    stats.forEach(function (s) {
      var dd = el('dd', null, el('span', { class: 'gm-pass-num', dataset: { to: s.v } }, String(s.v)), el('small', null, '/ ' + s.of));
      dl.appendChild(el('div', { class: 'gm-pass-stat', style: { '--sc': s.c } }, el('dt', null, s.k), dd));
    });

    var ring = el('div', { class: 'gm-pass-ring', role: 'img', 'aria-label': m.visited + ' von ' + m.total + (' ' + M.t('stations') + ' besucht') },
      el('span', { html: ringSvg(m) }),
      el('div', { class: 'gm-pass-ring-c', 'aria-hidden': 'true' },
        el('span', { class: 'gm-pass-ring-n gm-pass-num', dataset: { to: m.visited } }, String(m.visited)),
        el('span', { class: 'gm-pass-ring-l' }, 'von ' + m.total + (' ' + M.t('stations')))));

    return el('section', { class: 'gm-pass-cover gm-dark', 'aria-labelledby': 'gm-pass-hl' },
      el('span', { class: 'gm-pass-guil-wrap', html: guilloche() }),
      el('div', { class: 'gm-pass-cover-main' },
        el('p', { class: 'gm-pass-eyebrow' }, el('span', { html: ico('stamp', 18) }), ((M.pack.title || '') + ' · ' + M.t('passport'))),
        el('h3', { class: 'gm-pass-headline', id: 'gm-pass-hl' }, headlineFor(m)),
        el('p', { class: 'gm-pass-sub' }, subFor(m)),
        dl),
      ring,
      el('div', { class: 'gm-pass-mrz', 'aria-hidden': 'true' }, mrzLines(m)));
  }

  /* ------------------------------------------------------------------ *
   * Stempelkarten
   * ------------------------------------------------------------------ */

  function segBar(jid) {
    var order = orderOf(jid);
    var S = M.data.stations;
    var bar = el('div', { class: 'gm-pass-bar', 'aria-hidden': 'true' });
    order.forEach(function (sid, i) {
      var st = S[sid];
      var cls = 'gm-pass-seg' + (st && realJourneysOf(st).length > 1 ? ' is-x' : '') + (M.store.isVisited(sid) ? ' is-on' : '');
      bar.appendChild(el('span', { class: cls, style: { '--i': i }, title: st ? st.title : '' }));
    });
    return bar;
  }

  function startLink(jid, label, iconKey) {
    var order = orderOf(jid);
    var idx = firstOpenIndex(order);
    var href = '#/reise/' + encodeURIComponent(jid) + (idx > 0 ? '/' + encodeURIComponent(order[idx]) : '');
    return el('a', {
      class: 'gm-pass-go', href: href,
      on: {
        click: function (e) {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button) return;
          e.preventDefault();
          M.nav.openJourney(jid, idx > 0 ? idx : undefined);
        }
      }
    }, el('span', null, label), el('span', { 'aria-hidden': 'true', html: ico(iconKey || 'arrow-right', 16) }));
  }

  function stateText(j, p, done, date) {
    if (done) return el('p', { class: 'gm-pass-state' }, el('strong', null, 'Eingeschlagen'), date ? ' am ' + date : '', ' · alle ' + p.total + (' ' + M.t('stations') + ' besucht'));
    if (!p.done) return el('p', { class: 'gm-pass-state' }, 'Noch nicht begonnen · ' + p.total + ' ' + plural(p.total, M.t('station'), M.t('stations')));
    var left = p.total - p.done;
    return el('p', { class: 'gm-pass-state' }, el('strong', null, p.done + ' von ' + p.total), ' besucht · noch ' + left + ' bis zum Stempel');
  }

  function stampCard(j, idx, m, fresh) {
    var p = M.store.progress(j.id);
    var done = m.stamps.indexOf(j.id) >= 0 || (p.total > 0 && p.done >= p.total);
    var dateIso = m.dates[j.id];
    var date = fmtDate(dateIso);
    var isNew = done && fresh.indexOf(j.id) >= 0;
    var svg = stampSvg({
      top: j.kurz || j.name, icon: j.icon || 'stamp', open: !done,
      bottom: done ? String(M.pack.title || '').toUpperCase() : 'NOCH OFFEN',
      band: done ? (date || 'VOLLENDET') : (p.done + ' / ' + p.total)
    });
    var stamp = el('div', { class: 'gm-pass-stamp' + (done ? '' : ' is-open') + (isNew ? ' is-new' : ''), html: svg });
    if (isNew) stamp.appendChild(el('span', { class: 'gm-pass-ripple', 'aria-hidden': 'true' }));
    var label = done ? 'Abgeschlossen' : (p.done ? 'Unterwegs' : 'Offen');

    var card = el('li', {
      class: 'gm-pass-card' + (done ? ' is-done' : '') + (ST.hl === j.id ? ' is-hl' : ''),
      style: { '--jc': 'var(--j-' + j.id + ')', '--rot': rotFor(idx), '--i': idx },
      dataset: { journey: j.id }
    },
      el('span', { class: 'gm-pass-no', 'aria-hidden': 'true' }, 'Nr. ' + pad(idx + 1, 2)),
      done ? el('span', { class: 'gm-pass-done-tag', html: (M.ui.icon ? M.ui.icon('check', 13) : '') + '<span>Vollendet</span>' }) : null,
      stamp,
      el('div', { class: 'gm-pass-info' },
        el('h4', { class: 'gm-pass-name' }, j.name, el('span', { class: 'gm-sr' }, ' – ' + label)),
        stateText(j, p, done, date),
        el('div', { role: 'img', 'aria-label': p.done + ' von ' + p.total + (' ' + M.t('stations') + ' besucht'), style: { width: '100%' } }, segBar(j.id)),
        p.total ? startLink(j.id, done ? 'Noch einmal fahren' : (p.done ? (M.t('journey') + ' fortsetzen') : (M.t('journey') + ' antreten')), done ? 'circle-arrows' : 'arrow-right') : null));
    return card;
  }

  function grandCard(m, fresh) {
    var j = journeyOf('rundreise');
    var p = M.store.progress('rundreise');
    var done = m.stamps.indexOf('rundreise') >= 0 || (p.total > 0 && p.done >= p.total);
    var date = fmtDate(m.dates.rundreise);
    var isNew = done && fresh.indexOf('rundreise') >= 0;
    var svg = stampSvg({
      top: j.name || M.t('grandTour'), icon: 'compass', open: !done, grand: true,
      bottom: done ? 'ALLE ' + String(m.journeys.length).toUpperCase() + ' REISEN' : 'NOCH OFFEN',
      band: done ? (date || 'VOLLENDET') : (p.done + ' / ' + p.total)
    });
    var stamp = el('div', { class: 'gm-pass-stamp' + (done ? '' : ' is-open') + (isNew ? ' is-new' : ''), html: svg });
    if (isNew) stamp.appendChild(el('span', { class: 'gm-pass-ripple', 'aria-hidden': 'true' }));
    var info = el('div', { class: 'gm-pass-info' },
      el('h4', { class: 'gm-pass-name' }, ('Das Siegel der ' + M.t('grandTour')), el('span', { class: 'gm-sr' }, done ? ' – abgeschlossen' : ' – offen')),
      el('p', { class: 'gm-pass-state' }, (j.tagline ? String(j.tagline).replace(/\.$/, '') + '. ' : '') + ('Wer an allen ' + M.t('interchanges') + ' umsteigt, berührt jede der ') + (M.numWord ? M.numWord(m.journeys.length).toLowerCase() : m.journeys.length) + (' ' + M.t('journeys') + ' und bekommt dieses Siegel.')),
      stateText(j, p, done, date),
      el('div', { role: 'img', 'aria-label': p.done + ' von ' + p.total + (' ' + M.t('stations') + ' der ' + M.t('grandTour') + ' besucht'), style: { width: '100%', maxWidth: '30rem' } }, segBar('rundreise')),
      startLink('rundreise', done ? 'Noch einmal fahren' : (p.done ? (M.t('grandTourShort') + ' fortsetzen') : (M.t('grandTour') + ' starten')), 'compass'));
    return el('div', {
      class: 'gm-pass-grand' + (done ? ' is-done' : '') + (ST.hl === 'rundreise' ? ' is-hl' : ''),
      style: { '--rot': '-5deg', '--i': m.journeys.length }, dataset: { journey: 'rundreise' }
    }, stamp, info);
  }

  function buildStamps(m, fresh) {
    var sec = el('div', { class: 'gm-pass-stampsec' });
    var fun = m.journeys.filter(function (j) { return j.typ !== 'historisch'; });
    var his = m.journeys.filter(function (j) { return j.typ === 'historisch'; });
    var idx = 0;
    sec.appendChild(el('h3', { class: 'gm-pass-h', id: 'gm-pass-stamps-h' }, 'Deine Stempel'));
    sec.appendChild(el('p', { class: 'gm-pass-lead' },
      ('Sobald du alle ' + M.t('stations') + ' einer ' + M.t('journey') + ' besucht hast, schlägt das ' + M.t('museum') + ' den Stempel in deinen Pass. ') +
      m.stampCount + ' von ' + m.stampTotal + ' ' + plural(m.stampTotal, 'Stempel', 'Stempeln') + ' sind schon drin.'));
    function group(title, list, iconKey) {
      if (!list.length) return;
      sec.appendChild(el('h4', { class: 'gm-pass-subh' }, el('span', { html: ico(iconKey, 18) }), title));
      var ul = el('ul', { class: 'gm-pass-grid' + (ST.hl && ST.hl !== 'rundreise' ? ' has-hl' : '') });
      list.forEach(function (j) { ul.appendChild(stampCard(j, idx++, m, fresh)); });
      sec.appendChild(ul);
    }
    group(M.typeLabel('funktional') + ' · ' + M.typeLabel('funktional', 'sub'), fun, 'map');
    group(M.typeLabel('historisch') + ' · ' + M.typeLabel('historisch', 'sub'), his, 'hourglass');
    if (m.hasGrand) {
      sec.appendChild(el('h4', { class: 'gm-pass-subh' }, el('span', { html: ico('compass', 18) }), 'Das große Siegel'));
      sec.appendChild(grandCard(m, fresh));
    }
    return sec;
  }

  /* ------------------------------------------------------------------ *
   * Nächste Haltestellen
   * ------------------------------------------------------------------ */

  function recommend(m) {
    var S = M.data.stations;
    var js = m.journeys;
    var active = {}, untouched = {};
    js.forEach(function (j) {
      var p = M.store.progress(j.id);
      if (p.total && p.done > 0 && p.done < p.total) active[j.id] = p;
      else if (p.total && p.done === 0) untouched[j.id] = true;
    });
    var anyActive = Object.keys(active).length > 0;
    var mode = m.visited === 0 ? 'start' : (m.visited >= m.total ? 'done' : (anyActive ? 'next' : 'fresh'));
    if (mode === 'done') return { mode: mode, list: [] };

    var cands = [];
    Object.keys(S).forEach(function (id) {
      if (M.store.isVisited(id)) return;
      var st = S[id];
      var jids = realJourneysOf(st);
      if (spielAn()) { if (sGesperrt(id)) return; jids = jids.filter(function (jid) { return !jGesperrt(jid); }); }   // Spielplan: nur Offenes wird vorgeschlagen
      if (!jids.length) return;
      var score = 0, onA = [], nextOn = null, lead = null;
      var newJ = jids.filter(function (jid) { return untouched[jid]; });
      var crossing = jids.length > 1;

      if (mode === 'next') {
        jids.forEach(function (jid) {
          var a = active[jid];
          if (!a) return;
          onA.push(jid);
          score += 2 + 2 * (a.done / a.total);
          var o = orderOf(jid), ix = o.indexOf(id), f = firstOpenIndex(o);
          if (ix === f) { score += 3; if (!nextOn) nextOn = jid; }
          else if (ix > f && ix <= f + 2) score += 1;
        });
        if (!onA.length) return;
        if (crossing) score += 1.6 * (jids.length - 1);
        if (newJ.length) score += 1.2;
        lead = nextOn || onA[0];
      } else {
        // Einstieg bzw. neue Reise: die ersten Stationen einer Reise, Kreuzungen bevorzugt
        var pool = mode === 'start' ? jids : newJ;
        if (!pool.length) return;
        var best = null, bestIx = 99;
        pool.forEach(function (jid) { var ix = orderOf(jid).indexOf(id); if (ix >= 0 && ix < bestIx) { bestIx = ix; best = jid; } });
        if (best === null || bestIx > 3) return;
        lead = best;
        score += (4 - bestIx) + (crossing ? 2.2 : 0);
      }
      cands.push({ id: id, st: st, score: score, lead: lead, nextOn: nextOn, onA: onA, newJ: newJ, crossing: crossing, jids: jids });
    });
    cands.sort(function (a, b) {
      return b.score - a.score || a.id.localeCompare(b.id);
    });
    var perLead = {}, list = [];
    cands.forEach(function (c) {
      if (list.length >= 6) return;
      var n = perLead[c.lead] || 0;
      if (n >= (mode === 'next' ? 2 : 1)) return;
      perLead[c.lead] = n + 1;
      list.push(c);
    });
    return { mode: mode, list: list };
  }

  function reasonFor(c, mode) {
    var parts = [];
    var other = c.jids.filter(function (j) { return j !== c.lead; });
    if (mode === 'next') {
      if (c.nextOn) parts.push('Nächster Halt auf „' + jShort(c.nextOn) + '“.');
      else parts.push(('Liegt auf deiner ' + M.t('journey') + ' „') + jShort(c.lead) + '“.');
      var fresh = c.newJ.filter(function (j) { return j !== c.lead; });
      if (fresh.length) parts.push('Von hier kommst du auf „' + jShort(fresh[0]) + '“, die du noch nicht begonnen hast.');
      else if (other.length) parts.push((M.t('interchange') + ' mit „') + jShort(other[0]) + '“.');
    } else if (mode === 'start') {
      parts.push('Guter Einstieg auf „' + jShort(c.lead) + '“.');
      if (other.length) parts.push((M.t('interchange') + ' mit „') + jShort(other[0]) + '“.');
    } else {
      parts.push(('Neue ' + M.t('journey') + ': „') + jShort(c.lead) + '“.');
      if (other.length) parts.push((M.t('interchange') + ' mit „') + jShort(other[0]) + '“.');
    }
    return parts.join(' ');
  }

  function recCard(c, mode, i) {
    var st = c.st;
    var K = kindOf(st);
    var yt = yearText(st);
    if (yt.length > 14 && typeof st.year === 'number') yt = st.year < 0 ? Math.abs(st.year) + ' v. Chr.' : String(st.year);
    var chips = el('span', { class: 'gm-pass-rec-chips' });
    c.jids.forEach(function (jid) { chips.appendChild(M.ui.journeyChip(jid, {})); });
    var a = el('a', {
      class: 'gm-pass-rec', href: '#/station/' + encodeURIComponent(st.id), dataset: { station: st.id },
      style: { '--jc': 'var(--j-' + c.lead + ')', '--i': i },
      on: {
        click: function (e) {
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button) return;
          e.preventDefault();
          M.nav.openStation(st.id, c.lead);
        }
      }
    },
      el('span', { class: 'gm-pass-rec-ico', 'aria-hidden': 'true', html: ico(st.icon || K.icon, 24) }),
      el('span', { class: 'gm-pass-rec-body' },
        el('span', { class: 'gm-pass-rec-meta' },
          el('span', null, K.label),
          yt ? el('span', null, yt) : null,
          c.crossing ? el('span', { class: 'gm-pass-rec-x', html: ico('network', 12) + ('<span>' + M.t('interchange') + '</span>') }) : null),
        el('span', { class: 'gm-pass-rec-title' }, st.title),
        el('span', { class: 'gm-pass-rec-why' }, reasonFor(c, mode)),
        chips));
    return el('li', null, a);
  }

  function buildNext(m) {
    var r = recommend(m);
    var sec = el('div', { class: 'gm-pass-nextsec' });
    var lead = {
      start: ('Noch ist nichts abgestempelt. Diese ' + M.t('stations') + ' eignen sich als Einstieg, jede auf einer anderen ' + M.t('journey') + '.'),
      next: ('Noch nicht besucht, aber nah an deinen ' + M.t('journeys') + '. ' + M.t('interchanges') + ' stehen vorn, weil du dort die Linie wechseln kannst.'),
      fresh: ('Deine bisherigen ' + M.t('journeys') + ' sind vollendet. Diese ' + M.t('stations') + ' führen dich auf ' + M.t('journeys') + ', die du noch nicht begonnen hast.'),
      done: ('Du hast alle ' + M.t('stations') + ' besucht.')
    }[r.mode];
    sec.appendChild(el('h3', { class: 'gm-pass-h' }, r.mode === 'start' ? 'Zum Einstieg' : 'Nächste Haltestellen'));
    sec.appendChild(el('p', { class: 'gm-pass-lead' }, lead));
    if (r.mode === 'done' || !r.list.length) {
      sec.appendChild(el('div', { class: 'gm-pass-note' },
        el('span', { html: ico('star', 28) }),
        el('p', null, r.mode === 'done'
          ? ('Nichts mehr offen. Fahr eine ' + M.t('journey') + ' noch einmal, oder stöbere im ' + M.t('networkMap') + ' nach Verbindungen, die dir beim ersten Mal entgangen sind.')
          : ('Im Moment gibt es keine passenden Vorschläge. Im ' + M.t('networkMap') + ' findest du alle ' + M.t('journeys') + ' auf einen Blick.'))));
      return sec;
    }
    var ul = el('ul', { class: 'gm-pass-recs' });
    r.list.forEach(function (c, i) { ul.appendChild(recCard(c, r.mode, i)); });
    sec.appendChild(ul);
    return sec;
  }

  /* ------------------------------------------------------------------ *
   * Besuchte Stationen
   * ------------------------------------------------------------------ */

  function buildVisited(m) {
    var S = M.data.stations;
    var sec = el('div', { class: 'gm-pass-visitedsec' });
    sec.appendChild(el('h3', { class: 'gm-pass-h' }, ('Meine besuchten ' + M.t('stations'))));
    if (!m.visited) {
      sec.appendChild(el('div', { class: 'gm-pass-empty' },
        el('span', { html: ico('ticket', 40) }),
        el('p', { class: 'gm-pass-empty-h' }, 'Noch kein Eintrag'),
        el('p', null, ('Sobald du eine ' + M.t('station') + ' aufgeschlagen hast, erscheint sie hier, geordnet nach ' + M.t('journey') + '. ' + M.t('interchanges') + ' tauchen unter jeder ihrer ' + M.t('journeys') + ' auf.')),
        el('div', { class: 'gm-pass-empty-btns' },
          el('a', { class: 'gm-btn gm-btn-primary', href: '#/reise/rundreise' }, el('span', { html: ico('compass', 18) }), el('span', null, (M.t('grandTour') + ' starten'))),
          el('a', { class: 'gm-btn gm-btn-ghost', href: '#/karte' }, el('span', { html: ico('map', 18) }), el('span', null, (M.t('networkMap') + ' öffnen'))))));
      return sec;
    }
    sec.appendChild(el('p', { class: 'gm-pass-lead' },
      ('Alles, was du aufgeschlagen hast, nach ' + M.t('journey') + ' geordnet. Ein Klick öffnet die ' + M.t('station') + ' noch einmal.')));
    var groups = el('div', { class: 'gm-pass-groups' });
    var empties = [];
    m.journeys.forEach(function (j) {
      var order = orderOf(j.id);
      var seen = order.filter(function (sid) { return S[sid] && M.store.isVisited(sid); });
      if (!seen.length) { empties.push(j.kurz || j.name); return; }
      var closed = !!ST.closed[j.id];
      var d = el('details', { class: 'gm-pass-group', style: { '--jc': 'var(--j-' + j.id + ')' }, dataset: { journey: j.id } });
      if (!closed) d.setAttribute('open', '');
      d.addEventListener('toggle', function () { ST.closed[j.id] = !d.open; });
      d.appendChild(el('summary', null,
        el('span', { class: 'gm-pass-gico', 'aria-hidden': 'true', html: ico(j.icon || 'train', 20) }),
        el('span', { class: 'gm-pass-gname' }, j.name),
        el('span', { class: 'gm-pass-gcount' }, seen.length + ' von ' + order.length),
        el('span', { class: 'gm-pass-gchev', 'aria-hidden': 'true', html: ico('arrow-right', 18) })));
      var ul = el('ul', { class: 'gm-pass-chips', 'aria-label': ('Besuchte ' + M.t('stations') + ': ') + j.name });
      seen.forEach(function (sid) {
        var st = S[sid];
        var isX = realJourneysOf(st).length > 1;
        var yt = yearText(st);
        var b = el('button', {
          type: 'button', class: 'gm-pass-chip', title: st.title, dataset: { station: sid },
          'aria-label': st.title + (isX ? (' (' + M.t('interchange') + ')') : ''),
          on: { click: function () { M.nav.openStation(sid, j.id); } }
        },
          el('span', { class: 'gm-pass-chip-t' }, shortTitle(st.title)),
          st.year !== undefined && yt && j.typ === 'historisch' ? el('small', null, yt) : null,
          isX ? el('span', { 'aria-hidden': 'true', html: ico('network', 14) }) : null);
        ul.appendChild(el('li', null, b));
      });
      d.appendChild(ul);
      groups.appendChild(d);
    });
    sec.appendChild(groups);
    if (empties.length) {
      sec.appendChild(el('p', { class: 'gm-pass-rest' }, ('Noch keine ' + M.t('station') + ' besucht auf: ') + empties.join(', ') + '.'));
    }
    return sec;
  }

  /* ------------------------------------------------------------------ *
   * Fuß: Datenschutz und Zurücksetzen (wird nur einmal gebaut)
   * ------------------------------------------------------------------ */

  function buildFoot() {
    var btn = el('button', { type: 'button', class: 'gm-pass-reset', on: { click: function () { confirmReset(btn); } } },
      el('span', { html: ico('circle-arrows', 18) }), el('span', null, 'Pass zurücksetzen'));
    ST.resetBtn = btn;
    return el('footer', { class: 'gm-pass-foot' },
      el('div', { class: 'gm-pass-priv' },
        el('span', { 'aria-hidden': 'true', html: ico('lock', 22) }),
        el('div', null,
          el('strong', null, 'Nur in deinem Browser gespeichert'),
          el('p', null, 'Besuche und Stempel liegen im lokalen Speicher dieses Browsers. Es wird nichts gesendet. Wenn du Website-Daten löschst oder ein anderes Gerät benutzt, beginnt dein Pass von vorn.'))),
      btn);
  }

  function closeDlg() {
    if (ST.dlg && M.ui && M.ui.overlay) M.ui.overlay.close(ST.dlg);
  }

  function doReset() {
    try { M.store.reset(); } catch (e) { /* egal */ }
    sset('stampdates', {});
    sset('passseen', []);
    ST.hl = null;
    closeDlg();
    ST.dirty = true;
    if (ST.shown) { ST.root.classList.add('is-still'); render(true); }
    M.toast && M.toast(('Dein ' + M.t('passport') + ' ist wieder leer.'));
    M.announce && M.announce((M.t('passport') + ' zurückgesetzt. Alle Besuche und Stempel sind gelöscht.'));
  }

  function confirmReset(trigger) {
    if (!M.ui || !M.ui.overlay) {
      if (window.confirm(('Alle besuchten ' + M.t('stations') + ' und Stempel löschen?'))) doReset();
      return;
    }
    if (!ST.dlg) {
      var cancel = el('button', { type: 'button', class: 'gm-btn gm-btn-ghost', on: { click: closeDlg } }, 'Abbrechen');
      var ok = el('button', { type: 'button', class: 'gm-btn gm-pass-danger', on: { click: doReset } }, 'Alles zurücksetzen');
      var box = el('div', { class: 'gm-pass-dlg-box' },
        el('div', { class: 'gm-pass-dlg-ico', 'aria-hidden': 'true', html: ico('exclamation', 24) }),
        el('h2', { class: 'gm-pass-dlg-t', id: 'gm-pass-dlg-t' }, (M.t('passport') + ' zurücksetzen?')),
        el('p', { class: 'gm-pass-dlg-p', id: 'gm-pass-dlg-p' },
          ('Alle besuchten ' + M.t('stations') + ' und alle Stempel werden gelöscht. Das lässt sich nicht rückgängig machen. Eingaben in ' + M.t('exhibits') + ' bleiben davon unberührt.')),
        el('div', { class: 'gm-pass-dlg-btns' }, cancel, ok));
      var dlg = el('div', {
        class: 'gm-overlay gm-pass-dlg', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'gm-pass-dlg-t', 'aria-describedby': 'gm-pass-dlg-p', hidden: true
      }, box);
      dlg.addEventListener('mousedown', function (e) { if (e.target === dlg) closeDlg(); });
      dlg.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var first = cancel, last = ok;
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      });
      doc.body.appendChild(dlg);
      ST.dlg = dlg;
      ST.dlgCancel = cancel;
    }
    M.ui.overlay.open(ST.dlg, { onClose: closeDlg, focus: ST.dlgCancel, returnFocus: trigger });
  }

  /* ------------------------------------------------------------------ *
   * Aufbau und Aktualisierung
   * ------------------------------------------------------------------ */

  function countUp(node) {
    var to = parseInt(node.getAttribute('data-to'), 10) || 0;
    node.textContent = String(to);
    if (reduced() || to <= 0 || !window.requestAnimationFrame) return;
    var t0 = null, dur = 900;
    node.textContent = '0';
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      node.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    setTimeout(function () { node.textContent = String(to); }, dur + 400);
  }

  /* Fokus über einen Neuaufbau retten: gleiches Element anhand von Klasse, Station und Reise wiederfinden */
  function focusKey() {
    var a = doc.activeElement;
    if (!a || a === doc.body || !ST.root || !ST.root.contains(a) || ST.resetBtn === a) return null;
    var first = typeof a.className === 'string' ? a.className.split(' ')[0] : '';
    var host = a.closest('[data-journey]');
    var sec = null;
    Object.keys(ST.sec).forEach(function (k) { if (ST.sec[k].contains(a)) sec = k; });
    return { sec: sec, sel: first ? '.' + first : a.tagName.toLowerCase(), st: a.getAttribute('data-station'), j: host ? host.getAttribute('data-journey') : null };
  }
  function restoreFocus(k) {
    if (!k) return;
    var list = ST.root.querySelectorAll(k.sel);
    for (var i = 0; i < list.length; i++) {
      var n = list[i], h = n.closest('[data-journey]');
      if (n.getAttribute('data-station') === k.st && (h ? h.getAttribute('data-journey') : null) === k.j) {
        try { n.focus({ preventScroll: true }); } catch (e) { /* egal */ }
        return;
      }
    }
    // Element gibt es nicht mehr (z. B. Empfehlung inzwischen besucht): Fokus auf die Überschrift des Abschnitts
    var h = k.sec && ST.sec[k.sec] ? ST.sec[k.sec].querySelector('.gm-pass-h') : null;
    if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
  }

  function render(keep) {
    if (!ST.root) return;
    ST.dirty = false;
    var key = keep ? focusKey() : null;
    var m = model();
    var seen = sget('passseen', []);
    if (!Array.isArray(seen)) seen = [];
    // Stempel, die der Pass noch nie „eingeschlagen“ gezeigt hat
    var fresh = ST.shown ? m.stamps.filter(function (j) { return seen.indexOf(j) < 0; }) : [];

    function put(key2, node) {
      var host = ST.sec[key2];
      host.innerHTML = '';
      host.appendChild(node);
    }
    put('cover', buildCover(m));
    put('stamps', buildStamps(m, fresh));
    put('next', buildNext(m));
    put('visited', buildVisited(m));
    if (key) restoreFocus(key);

    if (fresh.length) {
      sset('passseen', seen.concat(fresh.filter(function (j) { return seen.indexOf(j) < 0; })));
      var names = fresh.map(function (j) { return (journeyOf(j) || {}).name || j; });
      M.announce && M.announce((fresh.length === 1 ? 'Neuer Stempel: ' : 'Neue Stempel: ') + names.join(', '));
    }
    if (ST.shown && !keep) {
      [].forEach.call(ST.root.querySelectorAll('.gm-pass-num'), countUp);
    }
  }

  /* Aktualisierung bei sichtbarer Ansicht: ohne Einblend-Animation, Fokus bleibt; wartet, solange eine Ebene (Station, Dialog) offen ist */
  function refresh() {
    if (!ST.shown || !ST.dirty || !ST.root) return;
    ST.root.classList.add('is-still');
    try { render(true); } catch (err) { if (window.console) console.warn(('[Museum Studio] ' + M.t('passport')), err); }
  }

  function scheduleRender() {
    if (ST.raf || ST.poll) return;
    ST.raf = requestAnimationFrame(function () {
      ST.raf = 0;
      if (!ST.shown || !ST.dirty) return;
      if (M.ui && M.ui.overlay && M.ui.overlay.isOpen()) {
        ST.poll = setTimeout(function () { ST.poll = 0; scheduleRender(); }, 350);
        return;
      }
      refresh();
    });
  }

  function onStore(info) {
    info = info || {};
    if (info.type === 'stamp' && info.id) {
      var d = sget('stampdates', {}) || {};
      if (typeof d !== 'object' || Array.isArray(d)) d = {};
      if (!d[info.id]) { d[info.id] = today(); sset('stampdates', d); }
    } else if (info.type === 'reset') {
      sset('stampdates', {});
      sset('passseen', []);
    }
    ST.dirty = true;
    if (ST.shown) scheduleRender();
  }

  function activate() {
    if (!ST.root) return;
    ST.root.classList.remove('is-in', 'is-still');
    try { render(false); } catch (err) { if (window.console) console.warn(('[Museum Studio] ' + M.t('passport')), err); }
    if (reduced()) { ST.root.classList.add('is-in'); return; }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { if (ST.shown && ST.root) ST.root.classList.add('is-in'); });
    });
  }

  function mount(host) {
    injectStyles();
    ST.host = host;
    ST.root = el('div', { class: 'gm-pass gm-container' });
    ST.root.insertAdjacentHTML('afterbegin', defsSvg());
    ['cover', 'stamps', 'next', 'visited'].forEach(function (k) {
      var cls = k === 'cover' ? 'gm-pass-cover-host' : 'gm-pass-sec gm-pass-' + k + '-host';
      ST.sec[k] = el('div', { class: cls });
      ST.root.appendChild(ST.sec[k]);
    });
    ST.root.appendChild(buildFoot());
    host.appendChild(ST.root);
    if (M.store && M.store.onChange) ST.off = M.store.onChange(onStore);
    ST.dirty = true;
    try { render(); } catch (err) { if (window.console) console.warn(('[Museum Studio] ' + M.t('passport')), err); }
    ST.root.classList.add('is-in');
  }

  function show() {
    var was = ST.shown;
    ST.shown = true;
    // Der Router ruft show() auch, wenn man von einer Station zurückkehrt: dann nichts neu aufbauen
    if (was && ST.root) { if (ST.dirty) scheduleRender(); return; }
    activate();
    if (ST.hl) highlightJourney(ST.hl);
  }

  function hide() {
    ST.shown = false;
    clearTimeout(ST.poll); ST.poll = 0;
    if (ST.root) ST.root.classList.remove('is-in');
  }

  function flash(node) {
    if (!node) return;
    node.classList.remove('is-flash');
    void node.offsetWidth;
    node.classList.add('is-flash');
    setTimeout(function () { node.classList.remove('is-flash'); }, 1800);
  }

  function focusStation(id) {
    if (!ST.root || !id) return false;
    id = String(id);
    var node = null;
    [].some.call(ST.root.querySelectorAll('.gm-pass-chip[data-station], .gm-pass-rec[data-station]'), function (n) {
      if (n.getAttribute('data-station') === id) { node = n; return true; }
      return false;
    });
    if (!node) return false;
    var det = node.closest('details');
    if (det && !det.open) det.open = true;
    try { node.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); } catch (e) { /* egal */ }
    try { node.focus({ preventScroll: true }); } catch (e) { /* egal */ }
    flash(node);
    return true;
  }

  function highlightJourney(id) {
    ST.hl = id || null;
    if (!ST.root) return;
    var grids = ST.root.querySelectorAll('.gm-pass-grid');
    var target = null;
    [].forEach.call(ST.root.querySelectorAll('[data-journey].gm-pass-card, .gm-pass-grand[data-journey]'), function (c) {
      var on = !!id && c.getAttribute('data-journey') === id;
      c.classList.toggle('is-hl', on);
      if (on) target = c;
    });
    [].forEach.call(grids, function (g) { g.classList.toggle('has-hl', !!id && id !== 'rundreise'); });
    if (target && ST.shown) {
      try { target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); } catch (e) { /* egal */ }
    }
  }

  M.views.reisepass = { mount: mount, show: show, hide: hide, focusStation: focusStation, highlightJourney: highlightJourney };
})();

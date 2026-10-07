/* ==========================================================================
   Museum Studio – js/hero.js
   Der Neuronen-Canvas im Eingangsbereich („Museum bei Nacht“).

   API:   MUSEUM.hero.start(canvas)   startet (oder startet neu) auf dem Canvas
          MUSEUM.hero.stop()          beendet alles, entfernt alle Listener
          MUSEUM.hero.stats()         Diagnose: { n, dpr, fps, frameMs, impulses, level, … }

   Hinweise für das Layout:
   - Der Canvas wird über CSS dimensioniert (z. B. position:absolute; inset:0;
     width:100%; height:100%). hero.js setzt nur die Pixelgröße (width/height-Attribute).
   - Hintergrundfarbe: CSS-Variable --hero-bg (Fallback #0B1020). Der Hero ist immer dunkel.
   - data-hero-fixed am Canvas schaltet die adaptive Güte ab (nur für Tests).
   - Der Canvas ist rein dekorativ (aria-hidden), Zeigerereignisse werden am window
     abgehört, damit Text/Buttons über dem Canvas den Reiz nicht blockieren.

   Technik: keine Abhängigkeiten, klassisches Script, nur Canvas 2D.
   - Partikelzahl nach Fläche; Canvas-Auflösung (devicePixelRatio) begrenzt + Pixelbudget.
   - Adaptive Güte: misst die Frame-Zeit und reduziert bei Bedarf Partikel/Auflösung.
   - Pausiert bei versteckter Seite und wenn der Canvas außerhalb des Viewports ist.
   - prefers-reduced-motion: einmal gezeichnetes Standbild, keine Schleife.
   ========================================================================== */
(function () {
  'use strict';

  var MUSEUM = window.MUSEUM = window.MUSEUM || {};

  /* ---- Konstanten ------------------------------------------------------- */

  // Die neun Heldenfarben: die ersten neun Reisefarben (dunkle Fassung, für den immer dunklen Hero),
  // bei weniger Reisen reihum wiederholt. Ohne Reisefarben ein neutraler Satz.
  var DEFAULT_PALETTE = ['#FF7A5C', '#C86BAA', '#4DB0EA', '#FFC93C', '#2FD0BC', '#7E92FF', '#E8944A', '#A58BFF', '#62CF66'];
  function palette() {
    var js = (MUSEUM.data && MUSEUM.data.journeys) || [];
    var cols = js.filter(function (j) { return j && !j.virtual && j.color && (j.color.dark || j.color.light); })
      .map(function (j) { return j.color.dark || j.color.light; })
      .filter(function (c) { return /^#[0-9a-f]{6}$/i.test(c); });
    if (!cols.length) return DEFAULT_PALETTE;
    var out = [];
    for (var i = 0; i < 9; i++) out.push(cols[i % cols.length]);
    return out;
  }
  var NEUTRAL = [205, 225, 255];   // Sprite-Index 9
  var WARM    = [252, 179, 0];     // Sprite-Index 10 (Museumslicht, Zeiger)
  var FALLBACK_BG = '#0B1020';
  var TAU = Math.PI * 2;

  var MAXN = 460;                  // maximale Partikelzahl (Arrays sind darauf ausgelegt)
  var K = 8;                       // max. Nachbarn je Knoten
  var MAXE = MAXN * K / 2;         // max. Kanten
  var MAXI = 96;                   // max. gleichzeitige Impulse
  var NB = 6;                      // Helligkeits-Stufen der Synapsen (Batch-Zeichnen)
  var BGS = 1.16;                  // Überhang des Hintergrundbilds (für sanftes Driften)
  var MARG = 24;                   // Partikel dürfen so weit über den Rand driften
  var LAYER_Z   = [0.45, 0.7, 1.0];    // Tiefe je Ebene
  var LAYER_PAR = [0.3, 0.6, 1.0];     // Parallax je Ebene
  var LAYER_A   = [0.42, 0.68, 0.96];  // Punkt-Helligkeit je Ebene
  var LAYER_R   = [0.85, 1.2, 1.65];   // Punkt-Radius je Ebene

  // Güte-Stufen (werden nur nach unten gewechselt, damit nichts oszilliert)
  var Q_NODES = [1, 0.8, 0.62, 0.46];
  var Q_DPR   = [2, 2, 1.5, 1];
  var Q_IMP   = [MAXI, 80, 56, 40];

  var current = null;              // laufende Instanz (oder null)

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function hexToRgb(h) {
    var v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Farben und Sprites sind von der Instanz unabhängig und werden einmal gebaut.
  var COLORS = null, SOLID = null;
  var sprites = null;

  function getSprites() {
    if (sprites) return sprites;
    COLORS = palette().map(hexToRgb).concat([NEUTRAL, WARM]);
    SOLID = COLORS.map(function (c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; });
    sprites = COLORS.map(function (c) {
      var s = document.createElement('canvas');
      s.width = s.height = 128;
      var g = s.getContext('2d');
      var r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      var rgb = c[0] + ',' + c[1] + ',' + c[2];
      r.addColorStop(0, 'rgba(' + rgb + ',1)');
      r.addColorStop(0.16, 'rgba(' + rgb + ',0.6)');
      r.addColorStop(0.42, 'rgba(' + rgb + ',0.16)');
      r.addColorStop(0.72, 'rgba(' + rgb + ',0.04)');
      r.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 128, 128);
      return s;
    });
    return sprites;
  }

  /* ======================================================================
     Instanz
     ====================================================================== */
  function start(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    stop();

    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    var SPR = getSprites();

    // Der Canvas ist Deko.
    canvas.setAttribute('aria-hidden', 'true');
    // Hat der Canvas keine CSS-Größe (Standardgröße = Attribute), würde das Setzen der
    // Pixelgröße ihn aufblähen. Dann auf die Elternfläche ausdehnen.
    try {
      var cs0 = window.getComputedStyle(canvas);
      if (cs0.width === canvas.width + 'px' && cs0.height === canvas.height + 'px' &&
          !canvas.style.width && !canvas.style.height) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }
      if (cs0.display === 'inline') canvas.style.display = 'block';
    } catch (e) { /* egal */ }

    var mq = null;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) { mq = null; }
    var reduced = !!(mq && mq.matches);
    var rnd = reduced ? mulberry32(20240) : Math.random;

    /* ---- Zustand ---- */
    var W = 0, H = 0, dpr = 1, n = 0, L = 100, level = 0;
    var alive = true, visible = true, raf = 0, lastT = 0, time = 0;
    var bgCss = '', bgRgb = [11, 16, 32];
    var bgC = null, vigC = null;

    // Knoten
    var X = new Float32Array(MAXN), Y = new Float32Array(MAXN);
    var VX = new Float32Array(MAXN), VY = new Float32Array(MAXN);
    var TH = new Float32Array(MAXN), OM = new Float32Array(MAXN), SP = new Float32Array(MAXN);
    var PH = new Float32Array(MAXN), GLOW = new Float32Array(MAXN);
    var RX = new Float32Array(MAXN), RY = new Float32Array(MAXN);
    var LAY = new Uint8Array(MAXN), HUB = new Int8Array(MAXN), NCOL = new Uint8Array(MAXN);

    // Kanten (pro Frame neu berechnet)
    var nbr = new Int16Array(MAXN * K), nc = new Uint8Array(MAXN);
    var EA = new Int16Array(MAXE), EB = new Int16Array(MAXE);
    var EK = new Uint8Array(MAXE), ne = 0;
    var ES = new Int16Array(MAXE), ecnt = new Int16Array(NB + 1);   // nach Stufe sortierte Kantenindizes

    // Raster zur Nachbarsuche
    var cell = 100, gw = 1, gh = 1, head = new Int32Array(1), nxt = new Int32Array(MAXN);

    // Impulse (Aktionspotenziale)
    var IA = new Int16Array(MAXI), IB = new Int16Array(MAXI);
    var IT = new Float32Array(MAXI), IS = new Float32Array(MAXI), IV = new Float32Array(MAXI);
    var IC = new Uint8Array(MAXI), IH = new Uint8Array(MAXI);
    var icount = 0, impMax = MAXI, spawnAcc = 0;

    // Bokeh-Schleier (nahe Ebene, unscharf)
    var BOK = [];

    // Zeiger / Touch
    var ptr = { has: false, cx: 0, cy: 0, x: 0, y: 0, a: 0, acc: 0, lastSpawn: 0,
                burst: false, type: 'mouse', R: 160, was: false, cursor: 0 };
    var rings = [];
    var cam = { x: 0, y: 0 };
    var near = { i: [0, 0, 0, 0, 0], d: [0, 0, 0, 0, 0], c: 0 };

    // Leistungsmessung
    var frames = 0, ema = 0, accT = 0, accN = 0, accW = 0, cool = 30;

    // Listener-Buch (für sauberes stop())
    var listeners = [];
    function on(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      listeners.push([target, type, fn, opts]);
    }
    var io = null, ro = null;

    /* ---- Farben ---- */
    var probe = null;
    function cssToRgb(str) {
      try {
        if (!probe) { probe = document.createElement('canvas'); probe.width = probe.height = 1; }
        var g = probe.getContext('2d', { willReadFrequently: true });
        g.fillStyle = FALLBACK_BG;
        g.fillStyle = str;
        g.fillRect(0, 0, 1, 1);
        var d = g.getImageData(0, 0, 1, 1).data;
        return [d[0], d[1], d[2]];
      } catch (e) { return [11, 16, 32]; }
    }
    function readColors() {
      var v = '';
      try { v = window.getComputedStyle(canvas).getPropertyValue('--hero-bg').trim(); } catch (e) { v = ''; }
      if (!v) v = FALLBACK_BG;
      if (v === bgCss) return false;
      bgCss = v;
      bgRgb = cssToRgb(v);
      return true;
    }

    function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')'; }
    function mix(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }

    /* ---- Hintergrund und Vignette (einmal gebacken, halbe Auflösung) ---- */
    function buildBackdrop() {
      // Hintergrund ist 1,16-fach groß und wird beim Zeichnen sanft verschoben (Kamera-Atem);
      // Farbnebel sind eingebacken – so kostet der Hintergrund nur einen Blit pro Frame.
      var vw = Math.max(2, Math.ceil(W * dpr * 0.5)), vh = Math.max(2, Math.ceil(H * dpr * 0.5));
      var bw = Math.ceil(vw * BGS), bh = Math.ceil(vh * BGS);
      if (!bgC) bgC = document.createElement('canvas');
      if (!vigC) vigC = document.createElement('canvas');
      bgC.width = bw; bgC.height = bh;
      vigC.width = vw; vigC.height = vh;

      var g = bgC.getContext('2d');
      g.fillStyle = rgba(bgRgb, 1);
      g.fillRect(0, 0, bw, bh);
      // sanfter Lichtkegel in der Mitte (Museumsnacht)
      var m = mix(bgRgb, [40, 84, 160], 0.3);
      var r0 = Math.max(bw, bh) * 0.72;
      var rg = g.createRadialGradient(bw * 0.5, bh * 0.44, 0, bw * 0.5, bh * 0.44, r0);
      rg.addColorStop(0, rgba(m, 1));
      rg.addColorStop(0.55, rgba(mix(bgRgb, m, 0.35), 1));
      rg.addColorStop(1, rgba(bgRgb, 1));
      g.fillStyle = rg;
      g.fillRect(0, 0, bw, bh);
      // ferne Farbnebel in den Reisefarben
      g.globalCompositeOperation = 'lighter';
      var nebs = [[4, 0.22, 0.78, 0.1], [7, 0.84, 0.2, 0.1], [0, 0.5, 0.9, 0.05],
                  [2, 0.12, 0.18, 0.06], [3, 0.72, 0.72, 0.045]];
      var ns = Math.max(bw, bh) * 0.6;
      for (var ni = 0; ni < nebs.length; ni++) {
        var nb = nebs[ni];
        g.globalAlpha = nb[3] * 1.35;
        g.drawImage(SPR[nb[0]], bw * nb[1] - ns / 2, bh * nb[2] - ns / 2, ns, ns);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // Vignette: elliptisch, in Hintergrundfarbe auslaufend
      var v = vigC.getContext('2d');
      v.clearRect(0, 0, vw, vh);
      v.save();
      v.translate(vw / 2, vh / 2);
      v.scale(vw / 2, vh / 2);
      var vg = v.createRadialGradient(0, 0, 0, 0, 0, 1.4143);
      vg.addColorStop(0, rgba(bgRgb, 0));
      vg.addColorStop(0.42, rgba(bgRgb, 0));
      vg.addColorStop(0.62, rgba(bgRgb, 0.22));
      vg.addColorStop(0.8, rgba(bgRgb, 0.6));
      vg.addColorStop(1, rgba(bgRgb, 0.94));
      v.fillStyle = vg;
      v.fillRect(-1.05, -1.05, 2.1, 2.1);
      v.restore();
    }

    /* ---- Knoten ---- */
    function initNode(i) {
      var r = rnd();
      var layer = r < 0.42 ? 0 : (r < 0.78 ? 1 : 2);
      LAY[i] = layer;
      X[i] = -MARG + rnd() * (W + 2 * MARG);
      Y[i] = -MARG + rnd() * (H + 2 * MARG);
      TH[i] = rnd() * TAU;
      OM[i] = (rnd() - 0.5) * 0.8;
      SP[i] = (8 + rnd() * 13) * (0.55 + 0.45 * LAYER_Z[layer]);
      VX[i] = Math.cos(TH[i]) * SP[i];
      VY[i] = Math.sin(TH[i]) * SP[i];
      PH[i] = rnd() * TAU;
      GLOW[i] = 0;
      HUB[i] = rnd() < 0.075 ? Math.floor(rnd() * 9) : -1;
      NCOL[i] = HUB[i] >= 0 ? HUB[i] : Math.floor(rnd() * 9);
      RX[i] = X[i];
      RY[i] = Y[i];
    }

    function initBokeh() {
      BOK.length = 0;
      var cnt = W < 600 ? 4 : 7;
      for (var i = 0; i < cnt; i++) {
        BOK.push({ x: rnd() * W, y: rnd() * H, vx: (rnd() - 0.5) * 5, vy: (rnd() - 0.5) * 4,
                   s: 26 + rnd() * 54, c: Math.floor(rnd() * 9), a: 0.05 + rnd() * 0.06,
                   ph: rnd() * TAU });
      }
    }

    /* ---- Layout / Größe ---- */
    function layout() {
      var want = clamp(Math.round(W * H / 3500 * Q_NODES[level]), 56, MAXN);
      if (want > n) { for (var i = n; i < want; i++) initNode(i); }
      n = want;
      L = clamp(1.65 * Math.sqrt(W * H / n), 62, 150);
      cell = L;
      gw = Math.ceil((W + 2 * MARG + 90) / cell) + 2;
      gh = Math.ceil((H + 2 * MARG + 90) / cell) + 2;
      if (gw * gh > head.length) head = new Int32Array(gw * gh);
      impMax = Q_IMP[level];
      ptr.R = W < 600 ? 120 : 170;
    }

    function pickDpr() {
      var d = Math.min(window.devicePixelRatio || 1, Q_DPR[level]);
      // Pixelbudget: Backing-Store höchstens ~3,2 Mpx
      var budget = Math.sqrt(3.2e6 / Math.max(1, W * H));
      return Math.max(1, Math.min(d, budget));
    }

    function resize(force) {
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      var oldW = W, oldH = H, oldD = dpr;
      W = cw; H = ch;
      var d = pickDpr();
      if (!force && cw === oldW && ch === oldH && Math.abs(d - oldD) < 0.01) return;
      dpr = d;
      if (oldW > 0 && (oldW !== W || oldH !== H)) {
        var sx = W / oldW, sy = H / oldH;
        for (var i = 0; i < n; i++) { X[i] *= sx; Y[i] *= sy; }
        for (var b = 0; b < BOK.length; b++) { BOK[b].x *= sx; BOK[b].y *= sy; }
      }
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      readColors();
      layout();
      if (!BOK.length) initBokeh();
      buildBackdrop();
      // Das Setzen der Pixelgröße löscht den Canvas: sofort neu zeichnen (kein Flackern).
      if (reduced) renderStatic(); else { computeRender(); draw(); schedule(); }
    }

    /* ---- Physik ---- */
    function physics(dt) {
      var relax = 1 - Math.exp(-1.4 * dt);
      var pa = ptr.a, pR = ptr.R, pR2 = pR * pR, px = ptr.x, py = ptr.y;
      var cx = cam.x, cy = cam.y;
      var ox = -cx * 34 + Math.sin(time * 0.13) * 6;
      var oy = -cy * 22 + Math.cos(time * 0.1) * 4;
      var wmax = W + MARG, hmax = H + MARG;

      for (var i = 0; i < n; i++) {
        // Wandernde Richtung: langsam drehend, Drehgeschwindigkeit driftet als Zufallsgang
        var om = OM[i] + (Math.random() - 0.5) * dt * 1.1;
        om = om > 0.9 ? 0.9 : (om < -0.9 ? -0.9 : om);
        OM[i] = om;
        var th = TH[i] + om * dt;
        TH[i] = th;
        var vx = VX[i], vy = VY[i];
        vx += (Math.cos(th) * SP[i] - vx) * relax;
        vy += (Math.sin(th) * SP[i] - vy) * relax;

        // Reiz: Partikel werden vom Zeiger angezogen (weich, kein Kollaps)
        if (pa > 0.02) {
          var dx = px - RX[i], dy = py - RY[i];
          var d2 = dx * dx + dy * dy;
          if (d2 < pR2 && d2 > 1) {
            var d = Math.sqrt(d2);
            var q = 1 - d / pR;
            // Anziehung außen, weiche Abstoßung innen: Knoten sammeln sich auf einem
            // lockeren Ring um den Zeiger (statt zu einem Knäuel zu kollabieren) und
            // kreisen langsam – wie Zellen um einen Reiz.
            var sm = (d - pR * 0.2) / (pR * 0.28);
            sm = sm < -1 ? -1 : (sm > 1 ? 1 : sm);
            var f = q * q * 260 * pa * sm;
            var sw = q * 70 * pa * (LAYER_Z[LAY[i]] + 0.3);
            vx += (dx * f - dy * sw) / d * dt;
            vy += (dy * f + dx * sw) / d * dt;
            var ex = q * 0.55 * pa;
            if (ex > GLOW[i]) GLOW[i] = ex;
          }
          var sp2 = vx * vx + vy * vy;
          if (sp2 > 25600) { var k = 160 / Math.sqrt(sp2); vx *= k; vy *= k; }
        }

        var x = X[i] + vx * dt, y = Y[i] + vy * dt;
        if (x < -MARG) { x = -MARG; vx = Math.abs(vx); TH[i] = Math.PI - th; }
        else if (x > wmax) { x = wmax; vx = -Math.abs(vx); TH[i] = Math.PI - th; }
        if (y < -MARG) { y = -MARG; vy = Math.abs(vy); TH[i] = -TH[i]; }
        else if (y > hmax) { y = hmax; vy = -Math.abs(vy); TH[i] = -TH[i]; }
        X[i] = x; Y[i] = y; VX[i] = vx; VY[i] = vy;

        var gl = GLOW[i];
        if (gl > 0.002) GLOW[i] = gl * Math.exp(-2.6 * dt); else GLOW[i] = 0;

        var par = LAYER_PAR[LAY[i]];
        RX[i] = x + ox * par;
        RY[i] = y + oy * par;
      }

      // Bokeh
      for (var b = 0; b < BOK.length; b++) {
        var o = BOK[b];
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.x < -60) o.x = W + 60; else if (o.x > W + 60) o.x = -60;
        if (o.y < -60) o.y = H + 60; else if (o.y > H + 60) o.y = -60;
      }
    }

    /* Rendering-Positionen (ohne Physik-Schritt), z. B. nach Resize */
    function placeRender() {
      var ox = -cam.x * 34 + Math.sin(time * 0.13) * 6;
      var oy = -cam.y * 22 + Math.cos(time * 0.1) * 4;
      for (var i = 0; i < n; i++) {
        var par = LAYER_PAR[LAY[i]];
        RX[i] = X[i] + ox * par;
        RY[i] = Y[i] + oy * par;
      }
    }

    /* ---- Nachbarschaft / Synapsen ---- */
    function computeEdges() {
      var cells = gw * gh, i, j, c;
      for (c = 0; c < cells; c++) head[c] = -1;
      var off = MARG + 40, inv = 1 / cell;
      for (i = 0; i < n; i++) {
        var gx = ((RX[i] + off) * inv) | 0, gy = ((RY[i] + off) * inv) | 0;
        gx = gx < 0 ? 0 : (gx >= gw ? gw - 1 : gx);
        gy = gy < 0 ? 0 : (gy >= gh ? gh - 1 : gy);
        c = gy * gw + gx;
        nxt[i] = head[c];
        head[c] = i;
        nc[i] = 0;
      }
      ne = 0;
      for (i = 0; i < n; i++) {
        var xi = RX[i], yi = RY[i], zi = LAYER_Z[LAY[i]];
        var cx = ((xi + off) * inv) | 0, cy = ((yi + off) * inv) | 0;
        cx = cx < 0 ? 0 : (cx >= gw ? gw - 1 : cx);
        cy = cy < 0 ? 0 : (cy >= gh ? gh - 1 : cy);
        var y0 = cy > 0 ? cy - 1 : 0, y1 = cy < gh - 1 ? cy + 1 : gh - 1;
        var x0 = cx > 0 ? cx - 1 : 0, x1 = cx < gw - 1 ? cx + 1 : gw - 1;
        for (var yy = y0; yy <= y1; yy++) {
          for (var xx = x0; xx <= x1; xx++) {
            for (j = head[yy * gw + xx]; j >= 0; j = nxt[j]) {
              if (j <= i) continue;
              var dx = xi - RX[j], dy = yi - RY[j];
              var d2 = dx * dx + dy * dy;
              var zj = LAYER_Z[LAY[j]];
              var lim = L * (0.72 + 0.28 * (zi < zj ? zi : zj));
              if (d2 >= lim * lim) continue;
              if (nc[i] >= K || nc[j] >= K || ne >= MAXE) continue;
              var w = 1 - Math.sqrt(d2) / lim;
              var a = Math.pow(w, 1.3) * (0.35 + 0.65 * (zi < zj ? zi : zj));
              nbr[i * K + nc[i]++] = j;
              nbr[j * K + nc[j]++] = i;
              EA[ne] = i; EB[ne] = j;
              var bk = (a * 1.9 * NB) | 0;   // a ≤ ~0.52
              EK[ne] = bk >= NB ? NB - 1 : bk;
              ne++;
            }
          }
        }
      }
    }

    function computeRender() { placeRender(); computeEdges(); }

    /* ---- Impulse ---- */
    function spawn(a, b, col, hops, speedMul) {
      if (icount >= impMax) return false;
      var k = icount++;
      IA[k] = a; IB[k] = b; IT[k] = 0;
      IS[k] = (210 + Math.random() * 110) * (speedMul || 1);
      IC[k] = col; IH[k] = hops; IV[k] = 0;
      return true;
    }
    function spawnFrom(a, col, hops, speedMul) {
      var c = nc[a];
      if (!c) return false;
      var b = nbr[a * K + ((Math.random() * c) | 0)];
      return spawn(a, b, col, hops, speedMul);
    }

    function arrive(k) {
      var a = IA[k], b = IB[k], col = IC[k], hops = IH[k];
      GLOW[b] = 1;
      NCOL[b] = col;
      if (hops > 0 && icount < impMax * 0.85) {
        // Umsteigen: an Knotenpunkten wechselt der Impuls in die Farbe des Knotens
        var nextCol = HUB[b] >= 0 ? HUB[b] : col;
        var c = nc[b], first = -1, tries = 0, t;
        while (tries++ < 6 && c > 0) {
          t = nbr[b * K + ((Math.random() * c) | 0)];
          if (t === a || t === first) continue;
          if (first < 0) {
            first = t;
            if (!spawn(b, t, nextCol, hops - 1, 1)) break;
            if (Math.random() >= 0.32) break;      // manchmal verzweigt die Kaskade
          } else {
            spawn(b, t, nextCol, hops - 1, 1);
            break;
          }
        }
      }
    }

    function updateImpulses(dt) {
      for (var k = icount - 1; k >= 0; k--) {
        var a = IA[k], b = IB[k], remove = false;
        if (a >= n || b >= n) { remove = true; }
        else {
          var dx = RX[b] - RX[a], dy = RY[b] - RY[a];
          var len = Math.sqrt(dx * dx + dy * dy);
          var valid = len < L * 1.04;
          if (valid) { IV[k] = Math.min(1, IV[k] + dt * 8); }
          else { IV[k] -= dt * 5; if (IV[k] <= 0) remove = true; }
          IT[k] += IS[k] * dt / (len < 24 ? 24 : len);
          if (!remove && IT[k] >= 1) { arrive(k); remove = true; }
        }
        if (remove) {
          icount--;
          if (k !== icount) {
            IA[k] = IA[icount]; IB[k] = IB[icount]; IT[k] = IT[icount]; IS[k] = IS[icount];
            IV[k] = IV[icount]; IC[k] = IC[icount]; IH[k] = IH[icount];
          }
        }
      }

      // Spontane Aktivität: immer ein paar Impulse unterwegs
      spawnAcc += dt;
      var target = clamp(Math.round(n / 28), 4, 14);
      if (icount < target && spawnAcc > 0.18 + Math.random() * 0.25) {
        spawnAcc = 0;
        var s = (Math.random() * n) | 0;
        spawnFrom(s, Math.random() * 9 | 0, 2 + (Math.random() * 4 | 0), 1);
      }
    }

    /* ---- Zeiger ---- */
    function updatePointer(dt) {
      var inside = false, lx = 0, ly = 0;
      if (ptr.has) {
        var r = canvas.getBoundingClientRect();
        lx = ptr.cx - r.left; ly = ptr.cy - r.top;
        inside = lx >= -30 && lx <= W + 30 && ly >= -30 && ly <= H + 30;
      }
      ptr.a += ((inside ? 1 : 0) - ptr.a) * (1 - Math.exp(-8 * dt));
      if (ptr.a < 0.004) ptr.a = 0;

      // Kamera-Parallax (nur für Maus/Stift sinnvoll)
      var tx = 0, ty = 0;
      if (inside && ptr.type !== 'touch') { tx = lx / W - 0.5; ty = ly / H - 0.5; }
      var ck = 1 - Math.exp(-2.6 * dt);
      cam.x += (tx - cam.x) * ck;
      cam.y += (ty - cam.y) * ck;

      near.c = 0;
      if (!inside) { ptr.acc = 0; ptr.was = false; return; }

      var mvx = lx - ptr.x, mvy = ly - ptr.y;
      if (!ptr.was) { mvx = mvy = 0; ptr.was = true; }
      ptr.x = lx; ptr.y = ly;
      ptr.acc += Math.sqrt(mvx * mvx + mvy * mvy);

      // nächste Knoten (für Reizlinien und Impulse)
      var R2 = ptr.R * ptr.R, i, c = 0;
      for (i = 0; i < n; i++) {
        var dx = RX[i] - lx, dy = RY[i] - ly, d2 = dx * dx + dy * dy;
        if (d2 >= R2) continue;
        if (c < 5) {
          var p = c++;
          while (p > 0 && near.d[p - 1] > d2) { near.d[p] = near.d[p - 1]; near.i[p] = near.i[p - 1]; p--; }
          near.d[p] = d2; near.i[p] = i;
        } else if (d2 < near.d[4]) {
          var q = 4;
          while (q > 0 && near.d[q - 1] > d2) { near.d[q] = near.d[q - 1]; near.i[q] = near.i[q - 1]; q--; }
          near.d[q] = d2; near.i[q] = i;
        }
      }
      near.c = c;

      var colBase = Math.floor(time * 1.3) % 9;
      if (ptr.burst) {
        ptr.burst = false;
        if (rings.length < 4) rings.push({ x: lx, y: ly, age: 0 });
        for (i = 0; i < c; i++) {
          var nn = near.i[i];
          GLOW[nn] = 1;
          spawnFrom(nn, (colBase + i * 2) % 9, 4, 1.25);
        }
        ptr.lastSpawn = time;
      } else if (c > 0) {
        var moving = ptr.acc > 48 && time - ptr.lastSpawn > 0.09;
        var idle = time - ptr.lastSpawn > 1.1;
        if (moving || idle) {
          ptr.acc = 0; ptr.lastSpawn = time;
          spawnFrom(near.i[0], colBase, 4, 1.15);
        }
      }
    }

    /* ---- Zeichnen ---- */
    function draw() {
      if (!W || !bgC) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(bgC, -(BGS - 1) / 2 * W + Math.sin(time * 0.06) * 0.05 * W,
                    -(BGS - 1) / 2 * H + Math.cos(time * 0.05) * 0.045 * H, W * BGS, H * BGS);

      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      var i, k, b, e;

      // Synapsen (nach Helligkeit gebündelt)
      ctx.strokeStyle = 'rgb(150,190,240)';
      ctx.lineWidth = 0.85;
      for (b = 0; b <= NB; b++) ecnt[b] = 0;
      for (e = 0; e < ne; e++) ecnt[EK[e] + 1]++;
      for (b = 0; b < NB; b++) ecnt[b + 1] += ecnt[b];
      for (e = 0; e < ne; e++) ES[ecnt[EK[e]]++] = e;    // ecnt[b] zeigt danach auf das Ende von Stufe b
      var e0 = 0;
      for (b = 0; b < NB; b++) {
        var e1 = ecnt[b];
        if (e1 > e0) {
          ctx.beginPath();
          for (e = e0; e < e1; e++) {
            var se = ES[e];
            ctx.moveTo(RX[EA[se]], RY[EA[se]]);
            ctx.lineTo(RX[EB[se]], RY[EB[se]]);
          }
          ctx.globalAlpha = ((b + 0.5) / NB) * 0.52;
          ctx.stroke();
        }
        e0 = e1;
      }

      // Impulse: beleuchtete Linie, Schweif, Kopf
      for (k = 0; k < icount; k++) {
        var a = IA[k], bb = IB[k];
        if (a >= n || bb >= n) continue;
        var ax = RX[a], ay = RY[a], bx = RX[bb], by = RY[bb];
        var ddx = bx - ax, ddy = by - ay;
        var len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        var t = IT[k] > 1 ? 1 : IT[k];
        var v = IV[k];
        var hx = ax + ddx * t, hy = ay + ddy * t;
        var tail = Math.max(0, t - (52 + IS[k] * 0.1) / len);
        var tx0 = ax + ddx * tail, ty0 = ay + ddy * tail;
        var mx = (tx0 + hx) * 0.5, my = (ty0 + hy) * 0.5;
        var col = IC[k];
        ctx.strokeStyle = SOLID[col];
        // die ganze Synapse glimmt leicht
        ctx.globalAlpha = 0.17 * v;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        // Schweif in drei Stufen (hinten dunkel, vorn hell)
        var q1x = tx0 + (hx - tx0) * 0.34, q1y = ty0 + (hy - ty0) * 0.34;
        var q2x = tx0 + (hx - tx0) * 0.67, q2y = ty0 + (hy - ty0) * 0.67;
        ctx.lineWidth = 3.2;
        ctx.globalAlpha = 0.22 * v;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(hx, hy); ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = 0.3 * v;
        ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(q1x, q1y); ctx.stroke();
        ctx.globalAlpha = 0.6 * v;
        ctx.beginPath(); ctx.moveTo(q1x, q1y); ctx.lineTo(q2x, q2y); ctx.stroke();
        ctx.globalAlpha = 0.95 * v;
        ctx.beginPath(); ctx.moveTo(q2x, q2y); ctx.lineTo(hx, hy); ctx.stroke();
        // leuchtender Kopf
        ctx.globalAlpha = 0.95 * v;
        ctx.drawImage(SPR[col], hx - 13, hy - 13, 26, 26);
        ctx.globalAlpha = 0.9 * v;
        ctx.drawImage(SPR[9], hx - 4, hy - 4, 8, 8);
      }

      // Punkte je Ebene (ein Füllvorgang pro Ebene)
      ctx.fillStyle = 'rgb(205,225,255)';
      for (var ly = 0; ly < 3; ly++) {
        ctx.globalAlpha = LAYER_A[ly];
        ctx.beginPath();
        var rr = LAYER_R[ly];
        for (i = 0; i < n; i++) {
          if (LAY[i] !== ly) continue;
          ctx.moveTo(RX[i] + rr, RY[i]);
          ctx.arc(RX[i], RY[i], rr, 0, TAU);
        }
        ctx.fill();
      }

      // Knotenpunkte (Farbschimmer) und aufleuchtende Knoten
      for (i = 0; i < n; i++) {
        var hubc = HUB[i];
        if (hubc >= 0) {
          var tw = 0.5 + 0.5 * Math.sin(time * 1.25 + PH[i]);
          ctx.globalAlpha = 0.3 + 0.22 * tw;
          var hs = 15 + tw * 4;
          ctx.drawImage(SPR[hubc], RX[i] - hs, RY[i] - hs, hs * 2, hs * 2);
          ctx.globalAlpha = 0.9;
          ctx.drawImage(SPR[9], RX[i] - 2.6, RY[i] - 2.6, 5.2, 5.2);
        }
        var gl = GLOW[i];
        if (gl > 0.04) {
          var gs = 10 + gl * 24;
          ctx.globalAlpha = Math.min(1, gl * 0.9);
          ctx.drawImage(SPR[NCOL[i]], RX[i] - gs, RY[i] - gs, gs * 2, gs * 2);
          ctx.globalAlpha = Math.min(1, gl);
          ctx.drawImage(SPR[9], RX[i] - 3.4, RY[i] - 3.4, 6.8, 6.8);
        }
      }

      // Zeiger: Reizlinien + Lichthof + Schockwellen
      if (ptr.a > 0.01 && !reduced) {
        var pa = ptr.a;
        ctx.globalAlpha = 0.3 * pa;
        var ps = ptr.R * 1.15;
        ctx.drawImage(SPR[10], ptr.x - ps, ptr.y - ps, ps * 2, ps * 2);
        ctx.strokeStyle = 'rgb(255,214,120)';
        ctx.lineWidth = 1.1;
        for (i = 0; i < near.c; i++) {
          var ni = near.i[i], dd = Math.sqrt(near.d[i]);
          ctx.globalAlpha = (1 - dd / ptr.R) * 0.8 * pa;
          ctx.beginPath(); ctx.moveTo(ptr.x, ptr.y); ctx.lineTo(RX[ni], RY[ni]); ctx.stroke();
        }
        ctx.globalAlpha = 0.85 * pa;
        ctx.drawImage(SPR[10], ptr.x - 9, ptr.y - 9, 18, 18);
        ctx.drawImage(SPR[9], ptr.x - 3, ptr.y - 3, 6, 6);
      }
      if (rings.length) {
        ctx.strokeStyle = 'rgb(255,214,120)';
        for (i = 0; i < rings.length; i++) {
          var rg = rings[i], life = 1 - rg.age / 0.9;
          if (life <= 0) continue;
          ctx.globalAlpha = life * life * 0.55;
          ctx.lineWidth = 0.8 + 1.6 * life;
          ctx.beginPath(); ctx.arc(rg.x, rg.y, 6 + rg.age * 330, 0, TAU); ctx.stroke();
        }
      }

      // Bokeh (nahe, unscharf → Tiefenwirkung)
      var bpx = -cam.x * 34 * 1.7, bpy = -cam.y * 22 * 1.7;
      for (b = 0; b < BOK.length; b++) {
        var o = BOK[b];
        ctx.globalAlpha = o.a * (0.75 + 0.25 * Math.sin(time * 0.5 + o.ph));
        ctx.drawImage(SPR[o.c], o.x + bpx - o.s, o.y + bpy - o.s, o.s * 2, o.s * 2);
      }

      // Vignette
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(vigC, 0, 0, W, H);
    }

    /* ---- Standbild (prefers-reduced-motion) ---- */
    function renderStatic() {
      if (!W) return;
      rnd = mulberry32(20240);
      time = 3.2;
      cam.x = cam.y = 0;
      ptr.a = 0; near.c = 0; rings.length = 0;
      placeRender();
      computeEdges();
      icount = 0;
      var want = Math.round(n / 16);
      var r = mulberry32(99);
      for (var i = 0, tries = 0; i < want && tries < want * 6; tries++) {
        var a = (r() * n) | 0;
        if (!nc[a]) continue;
        var b = nbr[a * K + ((r() * nc[a]) | 0)];
        var col = (r() * 9) | 0;
        spawn(a, b, col, 0, 1);
        var k = icount - 1;
        IT[k] = 0.25 + r() * 0.6;
        IV[k] = 1;
        if (r() < 0.6) { GLOW[a] = 0.45 + r() * 0.5; NCOL[a] = col; }
        i++;
      }
      draw();
    }

    /* ---- Schleife ---- */
    function shouldRun() {
      return alive && !reduced && visible && !document.hidden && W > 0;
    }
    function schedule() {
      if (!raf && shouldRun()) { lastT = 0; raf = requestAnimationFrame(frame); }
    }
    function pause() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }

    function govern(dtR, work) {
      ema = ema ? ema * 0.92 + dtR * 0.08 : dtR;
      frames++;
      if (canvas.hasAttribute('data-hero-fixed')) return;   // Testhilfe: feste Güte
      if (cool > 0) { cool--; accT = 0; accN = 0; accW = 0; return; }
      accT += dtR; accW += work; accN++;
      if (accN >= 50) {
        var avg = accT / accN, avgW = accW / accN;
        accT = 0; accN = 0; accW = 0;
        // Ein Display, das nur 30 Hz liefert (Energiesparmodus), ist keine Überlast:
        // dann ist die eigene Arbeit klein und die Frames sind gleichmäßig ~33 ms.
        var slow = avg > 0.0215 && (avgW > 0.007 || avg > 0.038);
        if (slow && level < 3) {
          level++;
          cool = 30;
          var d = pickDpr();
          if (Math.abs(d - dpr) > 0.01) resize(true); else layout();
        }
      }
    }

    function frame(ts) {
      raf = 0;
      if (!shouldRun()) return;
      raf = requestAnimationFrame(frame);
      var dtR = lastT ? (ts - lastT) / 1000 : 1 / 60;
      lastT = ts;
      if (dtR > 0.25) dtR = 1 / 60;       // nach Pause/Tab-Wechsel
      var dt = dtR > 0.05 ? 0.05 : dtR;
      var w0 = performance.now();
      try {
        time += dt;
        updatePointer(dt);
        physics(dt);
        computeEdges();
        updateImpulses(dt);
        for (var i = rings.length - 1; i >= 0; i--) {
          rings[i].age += dt;
          if (rings[i].age > 0.9) rings.splice(i, 1);
        }
        draw();
        govern(dtR, (performance.now() - w0) / 1000);
      } catch (err) {
        if (window.console) console.warn('[hero] angehalten:', err);
        alive = false;
        pause();
      }
    }

    /* ---- Ereignisse ---- */
    function onMove(e) {
      ptr.cx = e.clientX; ptr.cy = e.clientY;
      ptr.has = true;
      ptr.type = e.pointerType || 'mouse';
    }
    function onDown(e) { onMove(e); ptr.burst = true; }
    function onUp(e) { if (e.pointerType === 'touch') ptr.has = false; }
    function onOut(e) { if (!e.relatedTarget) ptr.has = false; }
    function onBlur() { ptr.has = false; }
    function onVis() {
      if (document.hidden) { pause(); } else { schedule(); }
    }
    function onTheme() {
      if (readColors() && W) {
        buildBackdrop();
        if (reduced) renderStatic(); else if (!raf) { draw(); }
      }
    }
    function onMq() {
      // prefers-reduced-motion hat sich geändert → Modus wechseln
      var c = canvas;
      stop();
      start(c);
    }

    if (!reduced) {
      on(window, 'pointermove', onMove, { passive: true });
      on(window, 'pointerdown', onDown, { passive: true });
      on(window, 'pointerup', onUp, { passive: true });
      on(window, 'pointercancel', onUp, { passive: true });
      on(window, 'pointerout', onOut, { passive: true });
      on(window, 'blur', onBlur);
      on(document, 'visibilitychange', onVis);
    }
    on(window, 'resize', function () { resize(false); });
    on(document, 'gm:theme', onTheme);
    if (mq) {
      if (mq.addEventListener) { mq.addEventListener('change', onMq); listeners.push([mq, 'change', onMq]); }
      else if (mq.addListener) { mq.addListener(onMq); listeners.push([mq, '__old', onMq]); }
    }

    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(function () { resize(false); });
      ro.observe(canvas);
    }
    if (!reduced && typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(function (entries) {
        var last = entries[entries.length - 1];
        visible = !!last.isIntersecting;
        if (visible) schedule(); else pause();
      }, { threshold: 0 });
      io.observe(canvas);
    }

    /* ---- Start ---- */
    resize(true);
    if (!W) {
      // Canvas hat (noch) keine Größe – ResizeObserver/resize holt das nach.
      W = 0;
    }
    schedule();

    /* ---- Aufräumen ---- */
    function destroy() {
      alive = false;
      pause();
      if (io) { io.disconnect(); io = null; }
      if (ro) { ro.disconnect(); ro = null; }
      for (var i = 0; i < listeners.length; i++) {
        var l = listeners[i];
        if (l[1] === '__old') l[0].removeListener(l[2]);
        else l[0].removeEventListener(l[1], l[2], l[3]);
      }
      listeners.length = 0;
      if (bgC) { bgC.width = bgC.height = 0; bgC = null; }
      if (vigC) { vigC.width = vigC.height = 0; vigC = null; }
      if (probe) { probe.width = probe.height = 0; probe = null; }
      BOK.length = 0; rings.length = 0;
    }

    current = {
      canvas: canvas,
      destroy: destroy,
      stats: function () {
        return {
          running: !!raf, reduced: reduced, visible: visible,
          n: n, edges: ne, impulses: icount, dpr: Math.round(dpr * 100) / 100,
          width: W, height: H, level: level,
          frameMs: Math.round(ema * 10000) / 10, fps: ema ? Math.round(1 / ema) : 0,
          frames: frames, linkDist: Math.round(L)
        };
      }
    };
  }

  function stop() {
    if (!current) return;
    var c = current;
    current = null;
    c.destroy();
  }

  MUSEUM.hero = {
    start: start,
    stop: stop,
    stats: function () { return current ? current.stats() : null; }
  };
})();

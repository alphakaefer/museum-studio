// Berechnet das oktilineare Netzplan-Layout eines Pakets aus packs/<paket>/plan.json und schreibt packs/<paket>/layout.js
// (window.MUSEUM.mapLayout = {SEED,BEND,cell,W,H}; Rastereinheiten, 8 Richtungen).
//
//   node tools/layout-map.mjs <paket>                          # ein Lauf, schreibt packs/<paket>/layout.js
//   node tools/layout-map.mjs <paket> --multi=6 --iters=N      # mehrere Seeds parallel, der beste wird geschrieben
//   node tools/layout-map.mjs <paket> --seed=3 --no-write --svg=/tmp/plan.svg   # nur Vorschau als SVG, nichts schreiben
//   node tools/layout-map.mjs <paket> --out=/tmp/l.json        # Ergebnis zusätzlich als JSON sichern; mit --apply=/tmp/l.json wieder einlesen
//
// Verfahren: (1) Stress-Layout (SMACOF) auf den Graph-Abständen als Startlösung, auf ein Raster gesetzt;
// (2) Simulated Annealing auf dem Raster (Zielfunktion: Kreuzungen, Kanten nicht in 8 Richtungen, Knicke der Linien,
// Kantenlängen, Abstände, Knoten auf fremden Kanten); (3) Wahl der Knickrichtung je nicht-oktilinearer Kante.
// Rastergröße und Iterationszahl wachsen mit der Stationszahl (kleine Pakete brauchen wenige Sekunden).
// Alles deterministisch (seeded Mulberry32). Der schnelle Kern in C (tools/layout-sa.c) wird bei Bedarf mit gcc gebaut, sonst läuft JS.
import fs from 'fs';
import path from 'path';
import { fork, spawnSync } from 'child_process';
import os from 'os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const POS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const PACK_DIR = POS[0] ? (fs.existsSync(path.join(ROOT, 'packs', POS[0])) ? path.join(ROOT, 'packs', POS[0]) : path.resolve(POS[0])) : null;
if (!process.send && !PACK_DIR) { console.error('Aufruf: node tools/layout-map.mjs <paket> [--iters=N --multi=N --seed=N --svg=datei --no-write]\n  <paket> ist der Ordnername unter packs/ (benötigt plan.json).'); process.exit(2); }
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] === undefined ? true : m[2]]; }));

const WRITE = !args['no-write'];

/* ---------------------------------------------------------------- Daten */

function loadPlan(file) {
  const f = file || path.join(PACK_DIR, 'plan.json');
  let plan;
  try { plan = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`✗ ${path.relative(ROOT, f)}: nicht lesbar (${e.message}).`); process.exit(2); }
  if (!plan.orders || !Array.isArray(plan.stations)) { console.error(`✗ ${path.relative(ROOT, f)}: "stations" oder "orders" fehlt.`); process.exit(2); }
  const ids = [], idx = {};
  const jids = (plan.journeys || []).map(j => j.id).filter(j => plan.orders[j]);
  const used = new Set();
  for (const j of jids) for (const s of plan.orders[j]) used.add(s);
  for (const s of plan.stations) if (used.has(s.id)) { idx[s.id] = ids.length; ids.push(s.id); }
  const lines = jids.map(j => plan.orders[j].filter((s, i, a) => idx[s] !== undefined && a.indexOf(s) === i).map(s => idx[s]));
  return { ids, idx, jids, lines, typ: Object.fromEntries((plan.journeys || []).map(j => [j.id, j.typ])) };
}

function buildGraph(P) {
  const N = P.ids.length, emap = new Map(), EA = [], EB = [], EJ = [];
  P.lines.forEach((ln, li) => {
    for (let i = 0; i + 1 < ln.length; i++) {
      const a = Math.min(ln[i], ln[i + 1]), b = Math.max(ln[i], ln[i + 1]), key = a * N + b;
      if (!emap.has(key)) { emap.set(key, EA.length); EA.push(a); EB.push(b); EJ.push([]); }
      EJ[emap.get(key)].push(li);
    }
  });
  const E = EA.length, inc = Array.from({ length: N }, () => []), nb = Array.from({ length: N }, () => []);
  for (let e = 0; e < E; e++) { inc[EA[e]].push(e); inc[EB[e]].push(e); nb[EA[e]].push(EB[e]); nb[EB[e]].push(EA[e]); }
  const TA = [], TB = [], TC = [], tripOf = Array.from({ length: N }, () => []);
  P.lines.forEach(ln => {
    for (let i = 0; i + 2 < ln.length; i++) {
      const t = TA.length; TA.push(ln[i]); TB.push(ln[i + 1]); TC.push(ln[i + 2]);
      tripOf[ln[i]].push(t); tripOf[ln[i + 1]].push(t); tripOf[ln[i + 2]].push(t);
    }
  });
  const edgeId = (a, b) => emap.get(Math.min(a, b) * N + Math.max(a, b));
  return { N, E, EA: Int32Array.from(EA), EB: Int32Array.from(EB), EJ, inc, nb, T: TA.length, TA: Int32Array.from(TA), TB: Int32Array.from(TB), TC: Int32Array.from(TC), tripOf, edgeId };
}

function rngFor(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- Startlösung: Stress-Layout */

function bfsAll(G) {
  const { N, nb } = G, D = new Float64Array(N * N).fill(1e9);
  for (let s = 0; s < N; s++) {
    const q = [s]; D[s * N + s] = 0;
    for (let h = 0; h < q.length; h++) {
      const u = q[h];
      for (const v of nb[u]) if (D[s * N + v] > 1e8) { D[s * N + v] = D[s * N + u] + 1; q.push(v); }
    }
  }
  let mx = 0;
  for (let i = 0; i < N * N; i++) if (D[i] < 1e8 && D[i] > mx) mx = D[i];
  for (let i = 0; i < N * N; i++) if (D[i] > 1e8) D[i] = mx + 2;
  return D;
}

function stress(G, rnd) {
  const N = G.N, D = bfsAll(G), X = new Float64Array(N), Y = new Float64Array(N);
  for (let i = 0; i < N; i++) { const a = rnd() * 6.2832, r = 3 + rnd() * 8; X[i] = Math.cos(a) * r; Y[i] = Math.sin(a) * r; }
  let s0 = 0;
  for (let it = 0; it < 250; it++) {
    for (let i = 0; i < N; i++) {
      let sx = 0, sy = 0, sw = 0;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const d = D[i * N + j], w = 1 / (d * d);
        let dx = X[i] - X[j], dy = Y[i] - Y[j], l = Math.hypot(dx, dy) || 0.01;
        sx += w * (X[j] + d * dx / l); sy += w * (Y[j] + d * dy / l); sw += w;
      }
      X[i] = sx / sw; Y[i] = sy / sw;
    }
  }
  let st = 0;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const d = D[i * N + j], l = Math.hypot(X[i] - X[j], Y[i] - Y[j]); st += (l - d) * (l - d) / (d * d); }
  return { X, Y, st };
}

/* ---------------------------------------------------------------- Zielfunktion */

const CFG = {
  W: 46, H: 30,
  wLen: 0.55, lenT: 2.0, wLenLong: 0.9,
  wBend: 5.5, wBendArm: 0.9, wDev: 3.0,
  wCross: 14,
  wNodeEdge: 30,
  wAngle: 1.0,
  wSmooth: 1.0,
  wSpace: 1.6,
  wCenter: 0.35
};
const SM_T = [0, 22, 45, 67, 90, 112, 135, 157, 180], SM_V = [0, 0.15, 0.55, 1.6, 3.2, 6.5, 11, 17, 26];
function smoothCost(deg) {
  for (let i = 1; i < SM_T.length; i++) if (deg <= SM_T[i]) return SM_V[i - 1] + (SM_V[i] - SM_V[i - 1]) * (deg - SM_T[i - 1]) / (SM_T[i] - SM_T[i - 1]);
  return SM_V[SM_V.length - 1];
}

function makeState(G, C) {
  const { N, E, EA, EB, inc, nb, T, TA, TB, TC, tripOf } = G;
  const W = C.W, H = C.H;
  const px = new Int32Array(N), py = new Int32Array(N), occ = new Int32Array(W * H).fill(-1);
  const emnx = new Int32Array(E), emxx = new Int32Array(E), emny = new Int32Array(E), emxy = new Int32Array(E);
  const stampE = new Int32Array(E), stampN = new Int32Array(N), stampT = new Int32Array(Math.max(T, 1));
  let stamp = 0;
  const cx = (W - 1) / 2, cy = (H - 1) / 2;
  // Buckets: Kanten je Rasterblock (BS x BS), damit Abfragen nur nahe Kanten prüfen
  const BS = 4, BW = Math.ceil(W / BS), BH = Math.ceil(H / BS);
  const buckets = Array.from({ length: BW * BH }, () => []);
  const bx0 = new Int32Array(E), bx1 = new Int32Array(E), by0 = new Int32Array(E), by1 = new Int32Array(E).fill(-1);
  function unreg(e) {
    if (by1[e] < 0) return;
    for (let y = by0[e]; y <= by1[e]; y++) for (let x = bx0[e]; x <= bx1[e]; x++) { const b = buckets[y * BW + x], i = b.indexOf(e); if (i >= 0) { b[i] = b[b.length - 1]; b.pop(); } }
    by1[e] = -1;
  }
  function reg(e) {
    bx0[e] = Math.max(0, (emnx[e] - 1) / BS | 0); bx1[e] = Math.min(BW - 1, (emxx[e] + 1) / BS | 0);
    by0[e] = Math.max(0, (emny[e] - 1) / BS | 0); by1[e] = Math.min(BH - 1, (emxy[e] + 1) / BS | 0);
    for (let y = by0[e]; y <= by1[e]; y++) for (let x = bx0[e]; x <= bx1[e]; x++) buckets[y * BW + x].push(e);
  }
  const stampQ = new Int32Array(E);
  let qstamp = 0;

  function edgeBox(e) {
    const a = EA[e], b = EB[e];
    emnx[e] = Math.min(px[a], px[b]); emxx[e] = Math.max(px[a], px[b]);
    emny[e] = Math.min(py[a], py[b]); emxy[e] = Math.max(py[a], py[b]);
    if (px[a] >= 0 && px[b] >= 0) { unreg(e); reg(e); }
  }
  function orient(ax, ay, bx, by, cx_, cy_) { const v = (bx - ax) * (cy_ - ay) - (by - ay) * (cx_ - ax); return v > 0 ? 1 : v < 0 ? -1 : 0; }
  function crosses(e, f) {
    const a = EA[e], b = EB[e], c = EA[f], d = EB[f];
    if (a === c || a === d || b === c || b === d) return false;
    if (emxx[e] < emnx[f] || emxx[f] < emnx[e] || emxy[e] < emny[f] || emxy[f] < emny[e]) return false;
    const o1 = orient(px[a], py[a], px[b], py[b], px[c], py[c]), o2 = orient(px[a], py[a], px[b], py[b], px[d], py[d]);
    if (o1 * o2 >= 0) return false;
    const o3 = orient(px[c], py[c], px[d], py[d], px[a], py[a]), o4 = orient(px[c], py[c], px[d], py[d], px[b], py[b]);
    return o3 * o4 < 0;
  }
  function segDist(x, y, e) {
    const a = EA[e], b = EB[e], ax = px[a], ay = py[a], dx = px[b] - ax, dy = py[b] - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + dx * t - x, qy = ay + dy * t - y;
    return Math.sqrt(qx * qx + qy * qy);
  }
  function nodeEdgePen(v, e) {
    const a = EA[e], b = EB[e];
    if (a === v || b === v) return 0;
    const x = px[v], y = py[v];
    if (x < emnx[e] - 1 || x > emxx[e] + 1 || y < emny[e] - 1 || y > emxy[e] + 1) return 0;
    const d = segDist(x, y, e);
    if (d < 0.55) return C.wNodeEdge;
    if (d < 0.9) return C.wNodeEdge * 0.25 * (0.9 - d) / 0.35;
    return 0;
  }
  function edgeOwn(e) {
    const a = EA[e], b = EB[e], dx = px[b] - px[a], dy = py[b] - py[a], adx = Math.abs(dx), ady = Math.abs(dy);
    const len = Math.sqrt(dx * dx + dy * dy);
    let c = len < C.lenT ? C.wLen * (C.lenT - len) * (C.lenT - len) : C.wLenLong * (len - C.lenT) * (len - C.lenT) * (len > 4 ? 1.8 : 1);
    if (adx !== 0 && ady !== 0 && adx !== ady) {
      const mn = Math.min(adx, ady), mx = Math.max(adx, ady);
      const ang = Math.atan2(mn, mx) * 180 / Math.PI;                 // Abweichung zur Achse
      const dev = Math.min(ang, 45 - ang);
      c += C.wBend + C.wBendArm * Math.min(mn, mx - mn || mn) + C.wDev * dev / 22.5;
    }
    return c;
  }
  function angleAt(u, e, f) {   // zwei Kanten am Knoten u
    const a = EA[e] === u ? EB[e] : EA[e], b = EA[f] === u ? EB[f] : EA[f];
    const x1 = px[a] - px[u], y1 = py[a] - py[u], x2 = px[b] - px[u], y2 = py[b] - py[u];
    const cs = (x1 * x2 + y1 * y2) / (Math.hypot(x1, y1) * Math.hypot(x2, y2));
    const deg = Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI;
    if (deg < 12) return 16 * C.wAngle;
    if (deg < 30) return 8 * C.wAngle;
    if (deg < 42) return 2.5 * C.wAngle;
    return 0;
  }
  function tripCost(t) {
    const a = TA[t], b = TB[t], c = TC[t];
    const x1 = px[b] - px[a], y1 = py[b] - py[a], x2 = px[c] - px[b], y2 = py[c] - py[b];
    const cs = (x1 * x2 + y1 * y2) / (Math.hypot(x1, y1) * Math.hypot(x2, y2));
    return C.wSmooth * smoothCost(Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI);
  }
  function spacing(v) {
    let c = 0;
    const x = px[v], y = py[v];
    for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx++) {
      const o = occ[yy * W + xx];
      if (o < 0 || o === v) continue;
      const d = Math.hypot(xx - x, yy - y);
      if (d >= 2.2) continue;
      if (nb[v].includes(o)) continue;
      c += C.wSpace * (2.2 - d) * (2.2 - d) * 0.5;
    }
    return c;
  }
  // Teilkosten aller Terme, die einen der Knoten in `ms` berühren
  function local(ms) {
    stamp++;
    let c = 0, i, k;
    const ek = [];
    for (const v of ms) for (const e of inc[v]) if (stampE[e] !== stamp) { stampE[e] = stamp; ek.push(e); }
    for (const e of ek) {
      c += edgeOwn(e);
      qstamp++;
      for (let by = by0[e]; by <= by1[e]; by++) for (let bxx = bx0[e]; bxx <= bx1[e]; bxx++) {
        const bl = buckets[by * BW + bxx];
        for (let q = 0; q < bl.length; q++) {
          const f = bl[q];
          if (f === e || stampQ[f] === qstamp) continue;
          stampQ[f] = qstamp;
          if (stampE[f] === stamp && f < e) continue;
          if (crosses(e, f)) c += C.wCross;
        }
      }
      // Knoten auf dieser Kante (Knoten in der Nähe über das Raster)
      const x0 = Math.max(0, emnx[e] - 1), x1 = Math.min(W - 1, emxx[e] + 1), y0 = Math.max(0, emny[e] - 1), y1 = Math.min(H - 1, emxy[e] + 1);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const o = occ[yy * W + xx]; if (o >= 0) c += nodeEdgePen(o, e); }
    }
    for (const v of ms) {
      qstamp++;
      const vbx0 = Math.max(0, (px[v] - 1) / BS | 0), vbx1 = Math.min(BW - 1, (px[v] + 1) / BS | 0), vby0 = Math.max(0, (py[v] - 1) / BS | 0), vby1 = Math.min(BH - 1, (py[v] + 1) / BS | 0);
      for (let by = vby0; by <= vby1; by++) for (let bxx = vbx0; bxx <= vbx1; bxx++) {
        const bl = buckets[by * BW + bxx];
        for (let q = 0; q < bl.length; q++) { const f = bl[q]; if (stampQ[f] === qstamp) continue; stampQ[f] = qstamp; if (stampE[f] !== stamp) c += nodeEdgePen(v, f); }
      }
      c += spacing(v);
      const dx = (px[v] - cx) / (W / 2), dy = (py[v] - cy) / (H / 2);
      c += C.wCenter * (dx * dx + dy * dy) * 4;
    }
    // Winkel an den Knoten und deren Nachbarn
    const un = [];
    for (const v of ms) { if (stampN[v] !== stamp) { stampN[v] = stamp; un.push(v); } for (const u of nb[v]) if (stampN[u] !== stamp) { stampN[u] = stamp; un.push(u); } }
    for (const u of un) {
      const ie = inc[u];
      for (i = 0; i < ie.length; i++) for (k = i + 1; k < ie.length; k++) c += angleAt(u, ie[i], ie[k]);
    }
    for (const v of ms) for (const t of tripOf[v]) if (stampT[t] !== stamp) { stampT[t] = stamp; c += tripCost(t); }
    return c;
  }
  function place(v, x, y) {
    if (px[v] >= 0 && occ[py[v] * W + px[v]] === v) occ[py[v] * W + px[v]] = -1;
    px[v] = x; py[v] = y; occ[y * W + x] = v;
    for (const e of inc[v]) edgeBox(e);
  }
  function total() {
    let c = 0;
    for (let e = 0; e < E; e++) {
      c += edgeOwn(e);
      for (let f = e + 1; f < E; f++) if (crosses(e, f)) c += C.wCross;
      for (let v = 0; v < N; v++) c += nodeEdgePen(v, e);
    }
    for (let v = 0; v < N; v++) {
      c += spacing(v) * 0.5;
      const dx = (px[v] - cx) / (W / 2), dy = (py[v] - cy) / (H / 2);
      c += C.wCenter * (dx * dx + dy * dy) * 4;
      const ie = inc[v];
      for (let i = 0; i < ie.length; i++) for (let k = i + 1; k < ie.length; k++) c += angleAt(v, ie[i], ie[k]);
    }
    for (let t = 0; t < T; t++) c += tripCost(t);
    return c;
  }
  function metrics() {
    let cross = 0, nonOcti = 0, nodeEdge = 0, tsum = 0, t135 = 0, longE = 0;
    for (let e = 0; e < E; e++) {
      for (let f = e + 1; f < E; f++) if (crosses(e, f)) cross++;
      const a = EA[e], b = EB[e], dx = Math.abs(px[b] - px[a]), dy = Math.abs(py[b] - py[a]);
      if (dx && dy && dx !== dy) nonOcti++;
      if (Math.max(dx, dy) > 4) longE++;
      for (let v = 0; v < N; v++) if (nodeEdgePen(v, e) >= C.wNodeEdge) nodeEdge++;
    }
    for (let t = 0; t < T; t++) {
      const a = TA[t], b = TB[t], c = TC[t];
      const x1 = px[b] - px[a], y1 = py[b] - py[a], x2 = px[c] - px[b], y2 = py[c] - py[b];
      const deg = Math.acos(Math.max(-1, Math.min(1, (x1 * x2 + y1 * y2) / (Math.hypot(x1, y1) * Math.hypot(x2, y2))))) * 180 / Math.PI;
      if (deg > 100) t135++;
      tsum += deg > 20 ? 1 : 0;
    }
    return { crossings: cross, nonOctilinear: nonOcti, nodeOnEdge: nodeEdge, turnsOver20: tsum, turnsOver100: t135, longEdges: longE };
  }
  return { px, py, occ, place, local, total, metrics, edgeBox, W, H };
}

/* ---------------------------------------------------------------- Annealing */

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

function initialPlace(G, S, C, rnd) {
  const { N } = G;
  let best = null;
  for (let r = 0; r < 3; r++) { const s = stress(G, rnd); if (!best || s.st < best.st) best = s; }
  const { X, Y } = best;
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (let i = 0; i < N; i++) { mnx = Math.min(mnx, X[i]); mxx = Math.max(mxx, X[i]); mny = Math.min(mny, Y[i]); mxy = Math.max(mxy, Y[i]); }
  // Seitenverhältnis: das Raster ist breiter als hoch, das Layout wird passend gestreckt (ggf. um 90 Grad gedreht)
  const rot = (mxx - mnx) < (mxy - mny);
  const U = rot ? Y : X, V = rot ? X : Y;
  const uw = rot ? mxy - mny : mxx - mnx, vh = rot ? mxx - mnx : mxy - mny;
  const sc = Math.min((C.W - 5) / uw, (C.H - 5) / vh);
  const sx = sc, sy = sc;
  const umin = rot ? mny : mnx, vmin = rot ? mnx : mny;
  const order = Array.from({ length: N }, (_, i) => i);
  for (const v of order) {
    let x = Math.round(2 + (U[v] - umin) * sx + (C.W - 5 - uw * sx) / 2), y = Math.round(2 + (V[v] - vmin) * sy + (C.H - 5 - vh * sy) / 2);
    x = Math.max(0, Math.min(C.W - 1, x)); y = Math.max(0, Math.min(C.H - 1, y));
    let done = false;
    for (let rad = 0; rad < 12 && !done; rad++) {
      for (let dy = -rad; dy <= rad && !done; dy++) for (let dx = -rad; dx <= rad && !done; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= C.W || yy >= C.H || S.occ[yy * C.W + xx] >= 0) continue;
        S.px[v] = -1; S.place(v, xx, yy); done = true;
      }
    }
  }
}

let kernelBin;
function cKernel() {
  if (kernelBin !== undefined) return kernelBin;
  kernelBin = null;
  const src = ROOT + '/tools/layout-sa.c', bin = path.join(os.tmpdir(), 'layout-sa-' + fs.statSync(src).mtimeMs.toString(36));
  if (fs.existsSync(bin)) return (kernelBin = bin);
  const r = spawnSync('gcc', ['-O2', '-o', bin, src, '-lm'], { stdio: 'ignore' });
  if (r.status === 0) kernelBin = bin;
  return kernelBin;
}

function anneal(G, C, seed, iters, log) {
  const rnd = rngFor(seed), { N } = G, W = C.W, H = C.H;
  const S = makeState(G, C);
  S.px.fill(-1);
  for (let e = 0; e < G.E; e++) S.edgeBox(e);
  initialPlace(G, S, C, rnd);
  const T0 = +(process.env.T0 || C.T0 || 22), T1 = +(process.env.T1 || C.T1 || 0.25);
  const bin = args.js ? null : cKernel();
  if (bin) {
    // schneller Kern in C (tools/layout-sa.c), gleiche Zielfunktion
    const tmp = path.join(os.tmpdir(), `layout-g-${process.pid}-${seed}.txt`), out = tmp + '.out';
    const lines = [`${G.N} ${G.E} ${G.T} ${C.W} ${C.H}`,
      [C.wLen, C.lenT, C.wLenLong, C.wBend, C.wBendArm, C.wDev, C.wCross, C.wNodeEdge, C.wAngle, C.wSmooth, C.wSpace, C.wCenter].join(' ')];
    for (let e = 0; e < G.E; e++) lines.push(G.EA[e] + ' ' + G.EB[e]);
    for (let t = 0; t < G.T; t++) lines.push(G.TA[t] + ' ' + G.TB[t] + ' ' + G.TC[t]);
    for (let i = 0; i < G.N; i++) lines.push(S.px[i] + ' ' + S.py[i]);
    fs.writeFileSync(tmp, lines.join('\n') + '\n');
    const r = spawnSync(bin, [tmp, String(seed), String(iters), String(T0), String(T1), out], { stdio: ['ignore', 'ignore', log ? 'inherit' : 'ignore'] });
    if (r.status !== 0) throw new Error('layout-sa fehlgeschlagen');
    const pos = fs.readFileSync(out, 'utf8').trim().split('\n').map(l => l.split(' ').map(Number));
    if (process.env.KEEP) fs.copyFileSync(tmp, process.env.KEEP);
    fs.unlinkSync(tmp); fs.unlinkSync(out);
    S.px.fill(-1); S.occ.fill(-1);
    for (let i = 0; i < G.N; i++) S.place(i, pos[i][0], pos[i][1]);
    return S;
  }
  let cur = S.total();
  let acc = 0;
  const px = S.px, py = S.py, occ = S.occ;
  for (let it = 0; it < iters; it++) {
    const f = it / iters, T = T0 * Math.pow(T1 / T0, f);
    const v = (rnd() * N) | 0, ox = px[v], oy = py[v];
    const r = rnd();
    let nx, ny, swap = -1;
    if (r < 0.40 && G.nb[v].length) {
      const u = G.nb[v][(rnd() * G.nb[v].length) | 0], d = DIRS[(rnd() * 8) | 0], l = 1 + ((rnd() * 3) | 0);
      nx = px[u] + d[0] * l; ny = py[u] + d[1] * l;
    } else if (r < 0.52 && G.nb[v].length >= 2) {
      const a = G.nb[v][(rnd() * G.nb[v].length) | 0], b = G.nb[v][(rnd() * G.nb[v].length) | 0];
      if (a === b) continue;
      nx = Math.round((px[a] + px[b]) / 2 + (rnd() < 0.5 ? 0 : (rnd() < 0.5 ? 1 : -1)) * (rnd() < 0.5 ? 1 : 0)); ny = Math.round((py[a] + py[b]) / 2 + (rnd() < 0.3 ? (rnd() < 0.5 ? 1 : -1) : 0));
    } else if (r < 0.80) {
      const rad = f < 0.5 ? 3 : 2;
      nx = ox + ((rnd() * (2 * rad + 1)) | 0) - rad; ny = oy + ((rnd() * (2 * rad + 1)) | 0) - rad;
    } else {
      const rad = 4;
      nx = ox + ((rnd() * (2 * rad + 1)) | 0) - rad; ny = oy + ((rnd() * (2 * rad + 1)) | 0) - rad;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      swap = occ[ny * W + nx];
    }
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || (nx === ox && ny === oy)) continue;
    const o = occ[ny * W + nx];
    if (swap < 0 && o >= 0) continue;
    const ms = swap >= 0 && swap !== v ? [v, swap] : [v];
    if (ms.length === 2 && G.nb[v].includes(swap) === false && false) continue;
    const before = S.local(ms);
    if (ms.length === 2) {
      occ[oy * W + ox] = -1; occ[ny * W + nx] = -1; px[v] = -1;
      S.place(swap, ox, oy); S.place(v, nx, ny);
    } else S.place(v, nx, ny);
    const after = S.local(ms);
    const d = after - before;
    if (d <= 0 || rnd() < Math.exp(-d / T)) { cur += d; acc++; }
    else if (ms.length === 2) {
      occ[oy * W + ox] = -1; occ[ny * W + nx] = -1; px[v] = -1;
      S.place(v, ox, oy); S.place(swap, nx, ny);
    } else S.place(v, ox, oy);
    if (log && it % Math.max(1, (iters / 10) | 0) === 0) console.error(`  [seed ${seed}] ${(f * 100) | 0}% T=${T.toFixed(2)} cost=${cur.toFixed(1)} acc=${(100 * acc / (it + 1)).toFixed(1)}%`);
  }
  return S;
}

/* ---------------------------------------------------------------- Knickrichtungen */

// Route einer Kante a->b als Punktliste (oktilinear). dir 0: erst Diagonale, dann gerade; 1: erst gerade, dann Diagonale
function routePts(ax, ay, bx, by, variant) {
  const dx = bx - ax, dy = by - ay, adx = Math.abs(dx), ady = Math.abs(dy);
  if (dx === 0 || dy === 0 || adx === ady) return [[ax, ay], [bx, by]];
  const sx = Math.sign(dx), sy = Math.sign(dy), m = Math.min(adx, ady);
  let bend;
  if (adx > ady) bend = variant === 0 ? [ax + sx * m, ay + sy * m] : [bx - sx * m, by - sy * m];
  else bend = variant === 0 ? [ax + sx * m, ay + sy * m] : [bx - sx * m, by - sy * m];
  return [[ax, ay], bend, [bx, by]];
}

function segCross(p1, p2, p3, p4) {
  function o(a, b, c) { const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return v > 0 ? 1 : v < 0 ? -1 : 0; }
  return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0;
}
function ptSegDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
}

function chooseBends(G, S, P) {
  const { E, EA, EB, N } = G, px = S.px, py = S.py;
  const variant = new Int8Array(E);
  const octi = new Uint8Array(E);
  for (let e = 0; e < E; e++) { const dx = Math.abs(px[EB[e]] - px[EA[e]]), dy = Math.abs(py[EB[e]] - py[EA[e]]); octi[e] = (dx === 0 || dy === 0 || dx === dy) ? 1 : 0; }
  const routes = e => routePts(px[EA[e]], py[EA[e]], px[EB[e]], py[EB[e]], variant[e]);
  // Richtung (quantisiert) einer Kante von Knoten u weg
  function dirAway(e, u) {
    const r = routes(e);
    const rr = EA[e] === u ? r : r.slice().reverse();
    return Math.atan2(rr[1][1] - rr[0][1], rr[1][0] - rr[0][0]);
  }
  function turn(a1, a2) { let d = Math.abs(a1 - a2) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d * 180 / Math.PI; }
  function score(e) {
    const r = routes(e);
    let c = 0;
    // Knicke mit anderen Kanten und Knoten
    for (let f = 0; f < E; f++) {
      if (f === e) continue;
      const rf = routes(f);
      if (EA[e] === EA[f] || EA[e] === EB[f] || EB[e] === EA[f] || EB[e] === EB[f]) continue;
      for (let i = 0; i + 1 < r.length; i++) for (let j = 0; j + 1 < rf.length; j++) if (segCross(r[i], r[i + 1], rf[j], rf[j + 1])) c += 14;
    }
    for (let v = 0; v < N; v++) {
      if (v === EA[e] || v === EB[e]) continue;
      for (let i = 0; i + 1 < r.length; i++) if (ptSegDist([px[v], py[v]], r[i], r[i + 1]) < 0.55) c += 30;
    }
    // Glätte an den Enden entlang der Linien
    P.lines.forEach(ln => {
      for (let i = 0; i + 1 < ln.length; i++) {
        const a = ln[i], b = ln[i + 1];
        if (G.edgeId(a, b) !== e) continue;
        if (i > 0) { const e0 = G.edgeId(ln[i - 1], a); c += 1.3 * turn(dirAway(e0, a) + Math.PI, dirAway(e, a)) / 45; }
        if (i + 2 < ln.length) { const e2 = G.edgeId(b, ln[i + 2]); c += 1.3 * turn(dirAway(e, b) + Math.PI, dirAway(e2, b)) / 45; }
      }
    });
    // mehrere Kanten am selben Knoten in gleicher Richtung
    for (const u of [EA[e], EB[e]]) for (const f of G.inc[u]) {
      if (f === e) continue;
      if (turn(dirAway(e, u), dirAway(f, u)) < 20) c += 8;
    }
    return c;
  }
  for (let pass = 0; pass < 6; pass++) {
    let changed = 0;
    for (let e = 0; e < E; e++) {
      if (octi[e]) continue;
      const cur = variant[e], s0 = score(e);
      variant[e] = 1 - cur;
      const s1 = score(e);
      if (s1 < s0 - 1e-9) changed++; else variant[e] = cur;
    }
    if (!changed) break;
  }
  return { variant, octi, routes };
}

function realMetrics(G, S, B) {
  let cross = 0, passN = 0;
  const R = []; for (let e = 0; e < G.E; e++) R.push(B.routes(e));
  for (let e = 0; e < G.E; e++) for (let f = e + 1; f < G.E; f++) {
    if (G.EA[e] === G.EA[f] || G.EA[e] === G.EB[f] || G.EB[e] === G.EA[f] || G.EB[e] === G.EB[f]) continue;
    let hit = false;
    for (let i = 0; i + 1 < R[e].length && !hit; i++) for (let j = 0; j + 1 < R[f].length && !hit; j++) if (segCross(R[e][i], R[e][i + 1], R[f][j], R[f][j + 1])) hit = true;
    if (hit) cross++;
  }
  for (let e = 0; e < G.E; e++) for (let v = 0; v < G.N; v++) {
    if (v === G.EA[e] || v === G.EB[e]) continue;
    for (let i = 0; i + 1 < R[e].length; i++) if (ptSegDist([S.px[v], S.py[v]], R[e][i], R[e][i + 1]) < 0.55) passN++;
  }
  return { crossings: cross, nodeOnEdge: passN };
}

/* ---------------------------------------------------------------- Ausgabe */

function pack(G, S, B, P, seed, score) {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (let i = 0; i < G.N; i++) { mnx = Math.min(mnx, S.px[i]); mny = Math.min(mny, S.py[i]); mxx = Math.max(mxx, S.px[i]); mxy = Math.max(mxy, S.py[i]); }
  const pos = {};
  for (let i = 0; i < G.N; i++) pos[P.ids[i]] = [S.px[i] - mnx, S.py[i] - mny];
  const bend = {};
  for (let e = 0; e < G.E; e++) {
    if (B.octi[e]) continue;
    const r = B.routes(e), a = P.ids[G.EA[e]], b = P.ids[G.EB[e]];
    const key = a < b ? a + '|' + b : b + '|' + a;
    bend[key] = [r[1][0] - mnx, r[1][1] - mny];
  }
  return { seed, score, W: mxx - mnx, H: mxy - mny, pos, bend };
}

function writeLayout(res) {
  const file = path.join(PACK_DIR, 'layout.js');
  const wrap = (obj, per) => {
    const keys = Object.keys(obj), rows = [];
    for (let i = 0; i < keys.length; i += per) rows.push('  ' + keys.slice(i, i + per).map(k => JSON.stringify(k) + ':' + JSON.stringify(obj[k])).join(', '));
    return rows.join(',\n');
  };
  const src = '/* Erzeugt von tools/layout-map.mjs aus plan.json – nicht von Hand ändern. Neu berechnen: node tools/layout-map.mjs ' + path.basename(PACK_DIR) + '\n' +
    ' * SEED = Position je Station (Rastereinheiten), BEND = Knickpunkt für Abschnitte, die nicht geradlinig verlaufen, cell = Rasterweite in px. */\n' +
    'window.MUSEUM=window.MUSEUM||{};MUSEUM.mapLayout={SEED:{\n' + wrap(res.pos, 4) + '\n},BEND:{\n' + wrap(res.bend, 3) + '\n},cell:' + (res.cell || 48) + ',W:' + res.W + ',H:' + res.H + '};\n';
  fs.writeFileSync(file, src);
  console.log('Geschrieben: ' + path.relative(ROOT, file) + ` (${Object.keys(res.pos).length} Stationen, Raster ${res.W}×${res.H})`);
}

function writeSvg(res, P, G, file) {
  const C = 30, pad = 40, W = res.W * C + 2 * pad, H = res.H * C + 2 * pad;
  const cols = ['#E0573B', '#8A3F73', '#2A7AB0', '#E2A10B', '#0E8C7F', '#4B5FBF', '#B5651D', '#7A5CD6', '#3E8E41', '#C23B6B', '#5E7A8A', '#D1478E', '#6AA84F', '#A0522D', '#2D9CDB', '#8E44AD'];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#F6F2EA"/>`;
  const X = id => pad + res.pos[id][0] * C, Y = id => pad + res.pos[id][1] * C;
  P.lines.forEach((ln, li) => {
    let d = '';
    for (let i = 0; i < ln.length; i++) {
      const id = P.ids[ln[i]];
      if (i === 0) d += `M${X(id)} ${Y(id)}`;
      else {
        const pid = P.ids[ln[i - 1]], key = pid < id ? pid + '|' + id : id + '|' + pid, b = res.bend[key];
        if (b) d += ` L${pad + b[0] * C} ${pad + b[1] * C}`;
        d += ` L${X(id)} ${Y(id)}`;
      }
    }
    s += `<path d="${d}" fill="none" stroke="${cols[li % cols.length]}" stroke-width="3" stroke-opacity=".8" stroke-linejoin="round"/>`;
  });
  P.ids.forEach(id => { s += `<circle cx="${X(id)}" cy="${Y(id)}" r="5" fill="#fff" stroke="#222" stroke-width="1.5"/>`; });
  fs.writeFileSync(file, s + '</svg>');
}

/* ---------------------------------------------------------------- Lauf */

function defaultIters() {
  const N = loadPlan().ids.length;
  return Math.round(Math.min(3000000, Math.max(300000, N * 12000)));
}

function runOnce(seed, iters, planFile, log) {
  const P = loadPlan(planFile), G = buildGraph(P), C = Object.assign({}, CFG);
  // Raster und Rechenaufwand wachsen mit der Stationszahl (Referenz: 205 Stationen = 46×30)
  const k = Math.sqrt(Math.min(1, G.N / 205));
  C.W = Math.max(16, Math.round(CFG.W * k)); C.H = Math.max(11, Math.round(CFG.H * k));
  if (args.cfg) for (const kv of String(args.cfg).split(',')) { const [k, v] = kv.split('='); C[k] = +v; }
  const t0 = Date.now();
  const S = anneal(G, C, seed, iters, log);
  const B = chooseBends(G, S, P);
  const m = S.metrics(), rm = realMetrics(G, S, B);
  const nonOcti = m.nonOctilinear;
  const score = rm.crossings * 14 + rm.nodeOnEdge * 30 + nonOcti * 4 + m.turnsOver100 * 3 + m.turnsOver20 * 0.4 + m.longEdges * 2;
  const res = pack(G, S, B, P, seed, score);
  res.metrics = Object.assign({}, m, { realCrossings: rm.crossings, realNodeOnEdge: rm.nodeOnEdge, seconds: Math.round((Date.now() - t0) / 1000) });
  return { res, P, G };
}

if (process.send) {
  process.on('message', msg => {
    const { res } = runOnce(msg.seed, msg.iters, msg.plan, false);
    process.send(res);
    process.exit(0);
  });
} else if (args.apply) {
  const P = loadPlan(args.plan), G = buildGraph(P);
  const res = JSON.parse(fs.readFileSync(args.apply, 'utf8'));
  if (args.svg) writeSvg(res, P, G, args.svg);
  if (WRITE) writeLayout(res);
  console.log(JSON.stringify(res.metrics), 'W', res.W, 'H', res.H);
} else if (args.multi) {
  const n = +args.multi, iters = +(args.iters || defaultIters()), base = +(args.seed || 1);
  const results = [];
  let pending = n;
  for (let i = 0; i < n; i++) {
    const w = fork(new URL(import.meta.url).pathname, process.argv.slice(2));
    w.on('message', r => {
      results.push(r); console.log('Seed', r.seed, 'Score', r.score.toFixed(1), JSON.stringify(r.metrics));
      if (--pending === 0) {
        results.sort((a, b) => a.score - b.score);
        const best = results[0];
        console.log('Bester Seed', best.seed, best.score.toFixed(1));
        if (args.out) fs.writeFileSync(args.out, JSON.stringify(best));
        const P = loadPlan(args.plan), G = buildGraph(P);
        if (args.svg) writeSvg(best, P, G, args.svg);
        if (WRITE) writeLayout(best);
      }
    });
    w.send({ seed: base + i, iters, plan: args.plan });
  }
} else {
  const { res, P, G } = runOnce(+(args.seed || 1), +(args.iters || defaultIters()), args.plan, true);
  console.log(JSON.stringify(res.metrics), 'W', res.W, 'H', res.H);
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(res));
  if (args.svg) writeSvg(res, P, G, args.svg);
  if (WRITE) writeLayout(res);
}

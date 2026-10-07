/* Annealing-Kern für tools/layout-map.mjs (gleiche Zielfunktion wie die JS-Variante, nur schneller).
 * Übersetzen: gcc -O2 -o layout-sa layout-sa.c -lm
 * Aufruf:    layout-sa graph.txt seed iters T0 T1 out.txt
 * graph.txt: "N E T W H", Gewichte (12 Zahlen), E Zeilen "a b", T Zeilen "a b c", N Zeilen "x y" (Startpositionen)
 * Deterministisch (Mulberry32). */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>

#define MAXN 600
#define MAXE 1500
#define MAXT 3000
#define BS 2
#define BCAP 80

static int N, E, T, W, H;
static double wLen, lenT, wLenLong, wBend, wBendArm, wDev, wCross, wNodeEdge, wAngle, wSmooth, wSpace, wCenter;
static int EA[MAXE], EB[MAXE], TA[MAXT], TB[MAXT], TC[MAXT];
static int incN[MAXN], inc[MAXN][16], nbN[MAXN], nb[MAXN][16], tripN[MAXN], tripOf[MAXN][40];
static int px[MAXN], py[MAXN];
static int *occ;
static int emnx[MAXE], emxx[MAXE], emny[MAXE], emxy[MAXE];
static int BW, BH;
static int *bucket, *bcount;
static int bx0[MAXE], bx1[MAXE], by0[MAXE], by1[MAXE];
static int stampE[MAXE], stampN[MAXN], stampT[MAXT], stampQ[MAXE];
static int stamp = 0, qstamp = 0;

static uint32_t rs;
static double rnd(void) {
  uint32_t t;
  rs += 0x6D2B79F5u;
  t = rs;
  t = (t ^ (t >> 15)) * (t | 1);
  t ^= t + (t ^ (t >> 7)) * (t | 61);
  return (double)(t ^ (t >> 14)) / 4294967296.0;
}

static const double SM_T[9] = {0, 22, 45, 67, 90, 112, 135, 157, 180};
static const double SM_V[9] = {0, 0.15, 0.55, 1.6, 3.2, 6.5, 11, 17, 26};
static double smoothCost(double deg) {
  for (int i = 1; i < 9; i++) if (deg <= SM_T[i]) return SM_V[i - 1] + (SM_V[i] - SM_V[i - 1]) * (deg - SM_T[i - 1]) / (SM_T[i] - SM_T[i - 1]);
  return SM_V[8];
}

static void unreg(int e) {
  if (by1[e] < 0) return;
  for (int y = by0[e]; y <= by1[e]; y++) for (int x = bx0[e]; x <= bx1[e]; x++) {
    int b = y * BW + x, *l = bucket + b * BCAP;
    for (int i = 0; i < bcount[b]; i++) if (l[i] == e) { l[i] = l[bcount[b] - 1]; bcount[b]--; break; }
  }
  by1[e] = -1;
}
static void reg(int e) {
  bx0[e] = emnx[e] / BS; bx1[e] = emxx[e] / BS; if (bx1[e] > BW - 1) bx1[e] = BW - 1;
  by0[e] = emny[e] / BS; by1[e] = emxy[e] / BS; if (by1[e] > BH - 1) by1[e] = BH - 1;
  for (int y = by0[e]; y <= by1[e]; y++) for (int x = bx0[e]; x <= bx1[e]; x++) { int b = y * BW + x; if (bcount[b] < BCAP) bucket[b * BCAP + bcount[b]++] = e; }
}
static void edgeBox(int e) {
  int a = EA[e], b = EB[e];
  emnx[e] = px[a] < px[b] ? px[a] : px[b]; emxx[e] = px[a] > px[b] ? px[a] : px[b];
  emny[e] = py[a] < py[b] ? py[a] : py[b]; emxy[e] = py[a] > py[b] ? py[a] : py[b];
  if (px[a] >= 0 && px[b] >= 0) { unreg(e); reg(e); }
}
static inline int orient(int ax, int ay, int bx, int by, int cx, int cy) { long v = (long)(bx - ax) * (cy - ay) - (long)(by - ay) * (cx - ax); return v > 0 ? 1 : v < 0 ? -1 : 0; }
static int crosses(int e, int f) {
  int a = EA[e], b = EB[e], c = EA[f], d = EB[f];
  if (a == c || a == d || b == c || b == d) return 0;
  if (emxx[e] < emnx[f] || emxx[f] < emnx[e] || emxy[e] < emny[f] || emxy[f] < emny[e]) return 0;
  int o1 = orient(px[a], py[a], px[b], py[b], px[c], py[c]), o2 = orient(px[a], py[a], px[b], py[b], px[d], py[d]);
  if (o1 * o2 >= 0) return 0;
  int o3 = orient(px[c], py[c], px[d], py[d], px[a], py[a]), o4 = orient(px[c], py[c], px[d], py[d], px[b], py[b]);
  return o3 * o4 < 0;
}
static double segDist(int x, int y, int e) {
  int a = EA[e], b = EB[e];
  double ax = px[a], ay = py[a], dx = px[b] - ax, dy = py[b] - ay, l2 = dx * dx + dy * dy;
  double t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  double qx = ax + dx * t - x, qy = ay + dy * t - y;
  return sqrt(qx * qx + qy * qy);
}
static double nodeEdgePen(int v, int e) {
  int a = EA[e], b = EB[e];
  if (a == v || b == v) return 0;
  int x = px[v], y = py[v];
  if (x < emnx[e] - 1 || x > emxx[e] + 1 || y < emny[e] - 1 || y > emxy[e] + 1) return 0;
  double d = segDist(x, y, e);
  if (d < 0.55) return wNodeEdge;
  if (d < 0.9) return wNodeEdge * 0.25 * (0.9 - d) / 0.35;
  return 0;
}
static double edgeOwn(int e) {
  int a = EA[e], b = EB[e], dx = px[b] - px[a], dy = py[b] - py[a], adx = abs(dx), ady = abs(dy);
  double len = sqrt((double)(dx * dx + dy * dy));
  double c = len < lenT ? wLen * (lenT - len) * (lenT - len) : wLenLong * (len - lenT) * (len - lenT) * (len > 4 ? 1.8 : 1);
  if (adx != 0 && ady != 0 && adx != ady) {
    int mn = adx < ady ? adx : ady, mx = adx < ady ? ady : adx;
    double ang = atan2(mn, mx) * 180 / M_PI, dev = ang < 45 - ang ? ang : 45 - ang;
    int arm = mx - mn ? (mx - mn < mn ? mx - mn : mn) : mn;
    c += wBend + wBendArm * arm + wDev * dev / 22.5;
  }
  return c;
}
static double angleAt(int u, int e, int f) {
  int a = EA[e] == u ? EB[e] : EA[e], b = EA[f] == u ? EB[f] : EA[f];
  double x1 = px[a] - px[u], y1 = py[a] - py[u], x2 = px[b] - px[u], y2 = py[b] - py[u];
  double cs = (x1 * x2 + y1 * y2) / (sqrt(x1 * x1 + y1 * y1) * sqrt(x2 * x2 + y2 * y2));
  if (cs > 0.9781) return 16 * wAngle;   /* < 12 Grad */
  if (cs > 0.8660) return 8 * wAngle;    /* < 30 */
  if (cs > 0.7431) return 2.5 * wAngle;  /* < 42 */
  return 0;
}
static double tripCost(int t) {
  int a = TA[t], b = TB[t], c = TC[t];
  double x1 = px[b] - px[a], y1 = py[b] - py[a], x2 = px[c] - px[b], y2 = py[c] - py[b];
  double cs = (x1 * x2 + y1 * y2) / (sqrt(x1 * x1 + y1 * y1) * sqrt(x2 * x2 + y2 * y2));
  if (cs > 1) cs = 1; if (cs < -1) cs = -1;
  return wSmooth * smoothCost(acos(cs) * 180 / M_PI);
}
static int isNb(int v, int o) { for (int i = 0; i < nbN[v]; i++) if (nb[v][i] == o) return 1; return 0; }
static double spacing(int v) {
  double c = 0;
  int x = px[v], y = py[v];
  for (int yy = y - 2 < 0 ? 0 : y - 2; yy <= (y + 2 > H - 1 ? H - 1 : y + 2); yy++)
    for (int xx = x - 2 < 0 ? 0 : x - 2; xx <= (x + 2 > W - 1 ? W - 1 : x + 2); xx++) {
      int o = occ[yy * W + xx];
      if (o < 0 || o == v) continue;
      double d = hypot(xx - x, yy - y);
      if (d >= 2.2) continue;
      if (isNb(v, o)) continue;
      c += wSpace * (2.2 - d) * (2.2 - d) * 0.5;
    }
  return c;
}
static double cxm, cym;
static double local(const int *ms, int nm) {
  double c = 0;
  int ek[96], nek = 0, un[96], nun = 0;
  stamp++;
  for (int m = 0; m < nm; m++) for (int i = 0; i < incN[ms[m]]; i++) { int e = inc[ms[m]][i]; if (stampE[e] != stamp && nek < 96) { stampE[e] = stamp; ek[nek++] = e; } }
  for (int q = 0; q < nek; q++) {
    int e = ek[q];
    c += edgeOwn(e);
    qstamp++;
    for (int by = by0[e]; by <= by1[e]; by++) for (int bxx = bx0[e]; bxx <= bx1[e]; bxx++) {
      int b = by * BW + bxx, *l = bucket + b * BCAP;
      for (int i = 0; i < bcount[b]; i++) {
        int f = l[i];
        if (f == e || stampQ[f] == qstamp) continue;
        stampQ[f] = qstamp;
        if (stampE[f] == stamp && f < e) continue;
        if (crosses(e, f)) c += wCross;
      }
    }
    int x0 = emnx[e] - 1 < 0 ? 0 : emnx[e] - 1, x1 = emxx[e] + 1 > W - 1 ? W - 1 : emxx[e] + 1, y0 = emny[e] - 1 < 0 ? 0 : emny[e] - 1, y1 = emxy[e] + 1 > H - 1 ? H - 1 : emxy[e] + 1;
    for (int yy = y0; yy <= y1; yy++) for (int xx = x0; xx <= x1; xx++) { int o = occ[yy * W + xx]; if (o >= 0) c += nodeEdgePen(o, e); }
  }
  for (int m = 0; m < nm; m++) {
    int v = ms[m];
    qstamp++;
    int vb0 = px[v] - 1 < 0 ? 0 : (px[v] - 1) / BS, vb1 = (px[v] + 1) / BS; if (vb1 > BW - 1) vb1 = BW - 1;
    int vc0 = py[v] - 1 < 0 ? 0 : (py[v] - 1) / BS, vc1 = (py[v] + 1) / BS; if (vc1 > BH - 1) vc1 = BH - 1;
    for (int by = vc0; by <= vc1; by++) for (int bxx = vb0; bxx <= vb1; bxx++) {
      int b = by * BW + bxx, *l = bucket + b * BCAP;
      for (int i = 0; i < bcount[b]; i++) { int f = l[i]; if (stampQ[f] == qstamp) continue; stampQ[f] = qstamp; if (stampE[f] != stamp) c += nodeEdgePen(v, f); }
    }
    c += spacing(v);
    double dx = (px[v] - cxm) / (W / 2.0), dy = (py[v] - cym) / (H / 2.0);
    c += wCenter * (dx * dx + dy * dy) * 4;
  }
  for (int m = 0; m < nm; m++) {
    int v = ms[m];
    if (stampN[v] != stamp && nun < 96) { stampN[v] = stamp; un[nun++] = v; }
    for (int i = 0; i < nbN[v]; i++) { int u = nb[v][i]; if (stampN[u] != stamp && nun < 96) { stampN[u] = stamp; un[nun++] = u; } }
  }
  for (int q = 0; q < nun; q++) {
    int u = un[q];
    for (int i = 0; i < incN[u]; i++) for (int k = i + 1; k < incN[u]; k++) c += angleAt(u, inc[u][i], inc[u][k]);
  }
  for (int m = 0; m < nm; m++) for (int i = 0; i < tripN[ms[m]]; i++) { int t = tripOf[ms[m]][i]; if (stampT[t] != stamp) { stampT[t] = stamp; c += tripCost(t); } }
  return c;
}
static void place(int v, int x, int y) {
  if (px[v] >= 0 && occ[py[v] * W + px[v]] == v) occ[py[v] * W + px[v]] = -1;
  px[v] = x; py[v] = y; occ[y * W + x] = v;
  for (int i = 0; i < incN[v]; i++) edgeBox(inc[v][i]);
}

int main(int argc, char **argv) {
  if (argc < 7) { fprintf(stderr, "usage\n"); return 1; }
  FILE *f = fopen(argv[1], "r");
  if (!f) return 1;
  uint32_t seed = (uint32_t)atol(argv[2]);
  long iters = atol(argv[3]);
  double T0 = atof(argv[4]), T1 = atof(argv[5]);
  rs = seed;
  if (fscanf(f, "%d %d %d %d %d", &N, &E, &T, &W, &H) != 5) return 1;
  if (fscanf(f, "%lf %lf %lf %lf %lf %lf %lf %lf %lf %lf %lf %lf", &wLen, &lenT, &wLenLong, &wBend, &wBendArm, &wDev, &wCross, &wNodeEdge, &wAngle, &wSmooth, &wSpace, &wCenter) != 12) return 1;
  for (int e = 0; e < E; e++) { if (fscanf(f, "%d %d", &EA[e], &EB[e]) != 2) return 1; inc[EA[e]][incN[EA[e]]++] = e; inc[EB[e]][incN[EB[e]]++] = e; nb[EA[e]][nbN[EA[e]]++] = EB[e]; nb[EB[e]][nbN[EB[e]]++] = EA[e]; }
  for (int t = 0; t < T; t++) { if (fscanf(f, "%d %d %d", &TA[t], &TB[t], &TC[t]) != 3) return 1; tripOf[TA[t]][tripN[TA[t]]++] = t; tripOf[TB[t]][tripN[TB[t]]++] = t; tripOf[TC[t]][tripN[TC[t]]++] = t; }
  occ = malloc(sizeof(int) * W * H);
  for (int i = 0; i < W * H; i++) occ[i] = -1;
  BW = (W + BS - 1) / BS; BH = (H + BS - 1) / BS;
  bucket = malloc(sizeof(int) * BW * BH * BCAP); bcount = calloc(BW * BH, sizeof(int));
  for (int e = 0; e < E; e++) by1[e] = -1;
  for (int i = 0; i < N; i++) px[i] = py[i] = -1;
  int ix[MAXN], iy[MAXN];
  for (int i = 0; i < N; i++) if (fscanf(f, "%d %d", &ix[i], &iy[i]) != 2) return 1;
  fclose(f);
  for (int i = 0; i < N; i++) place(i, ix[i], iy[i]);
  cxm = (W - 1) / 2.0; cym = (H - 1) / 2.0;
  double cur = 0;
  const int DX[8] = {1, 1, 0, -1, -1, -1, 0, 1}, DY[8] = {0, 1, 1, 1, 0, -1, -1, -1};
  long acc = 0;
  for (long it = 0; it < iters; it++) {
    double fr = (double)it / iters, Tm = T0 * pow(T1 / T0, fr);
    int v = (int)(rnd() * N), ox = px[v], oy = py[v], nx, ny, swap = -1;
    double r = rnd();
    if (r < 0.38 && nbN[v]) {
      int u = nb[v][(int)(rnd() * nbN[v])], d = (int)(rnd() * 8), l = 1 + (int)(rnd() * 3);
      nx = px[u] + DX[d] * l; ny = py[u] + DY[d] * l;
    } else if (r < 0.50 && nbN[v] >= 2) {
      int a = nb[v][(int)(rnd() * nbN[v])], b = nb[v][(int)(rnd() * nbN[v])];
      if (a == b) continue;
      nx = (int)floor((px[a] + px[b]) / 2.0 + 0.5 + (rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0)); ny = (int)floor((py[a] + py[b]) / 2.0 + 0.5 + (rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0));
    } else if (r < 0.78) {
      int rad = fr < 0.5 ? 3 : 2;
      nx = ox + (int)(rnd() * (2 * rad + 1)) - rad; ny = oy + (int)(rnd() * (2 * rad + 1)) - rad;
    } else if (r < 0.95) {
      int rad = 5;
      nx = ox + (int)(rnd() * (2 * rad + 1)) - rad; ny = oy + (int)(rnd() * (2 * rad + 1)) - rad;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      swap = occ[ny * W + nx];
    } else {
      int u = (int)(rnd() * N);
      if (u == v) continue;
      nx = px[u]; ny = py[u]; swap = u;
    }
    if (nx < 0 || ny < 0 || nx >= W || ny >= H || (nx == ox && ny == oy)) continue;
    if (swap < 0 && occ[ny * W + nx] >= 0) continue;
    int ms[2], nm = 1; ms[0] = v;
    if (swap >= 0 && swap != v) { ms[1] = swap; nm = 2; }
    double before = local(ms, nm);
    if (nm == 2) { occ[oy * W + ox] = -1; occ[ny * W + nx] = -1; px[v] = -1; place(swap, ox, oy); place(v, nx, ny); }
    else place(v, nx, ny);
    double after = local(ms, nm), d = after - before;
    if (d <= 0 || rnd() < exp(-d / Tm)) { cur += d; acc++; }
    else if (nm == 2) { occ[oy * W + ox] = -1; occ[ny * W + nx] = -1; px[v] = -1; place(v, ox, oy); place(swap, nx, ny); }
    else place(v, ox, oy);
    if (it % (iters / 10 > 0 ? iters / 10 : 1) == 0) { fprintf(stderr, "  [seed %u] %d%% T=%.2f acc=%.1f%%\n", seed, (int)(fr * 100), Tm, 100.0 * acc / (it + 1)); }
  }
  FILE *o = fopen(argv[6], "w");
  for (int i = 0; i < N; i++) fprintf(o, "%d %d\n", px[i], py[i]);
  fclose(o);
  return 0;
}

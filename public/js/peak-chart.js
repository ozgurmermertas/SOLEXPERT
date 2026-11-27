// Peak Chart — 21st.dev'deki "Peak Chart by Louis Studios" React bileşeninin bağımlılıksız (vanilla JS) uyarlaması.
// Orijinal: https://studios.lou15.com/?ref=21st-code
// Site React kullanmadığı için aynı çizim mantığı (parlayan alan, ızgara, çizgi, nokta, sayaç) buraya taşındı.
//
// Kullanım:
//   const card = PeakChart.mount(element, { data, labels, value, prefix, suffix, decimals,
//                                           title, caption, status, badge, trend, accent, width, locale, formatValue })
//   card.update({ ...yeni ayarlar });   card.destroy();
window.PeakChart = (() => {
  const CW = 540, CH = 696, CR = 56;
  const HN = CH / CW, RN = CR / CW;
  const BX = 0.32 * CW, BY = 0.16 * CW;

  const FIELD_FILL = "#1678ff";
  const FIELD_SHADES = [
    { shape: [0.4748, 0.8152, 0.7509, 0.8801, 0.7026], color: "#000000", opacity: 1 },
    { shape: [0.3741, 0.2723, 0.7371, 0.3009, 0.1168], color: "#020000", opacity: 1 },
    { shape: [0.7846, 0.0251, 0.3833, 0.1301, -0.5566], color: "#2e85ff", opacity: 0.4756 },
    { shape: [0.6206, -0.2018, 0.1282, 0.5909, 0.2754], color: "#3584ff", opacity: 0.3146 },
    { shape: [0.6, 1.2391, 0.827, 0.2111, -1.6357], color: "#000d1e", opacity: 1 },
    { shape: [0.0964, 0.5388, 1000, 0.1285, 0.5421], color: "#000005", opacity: 0.2298 },
  ];
  const FIELD_RIMS = [
    { shape: [0.1207, -0.0365, 0.0492], color: "#2667ff", opacity: 1 },
    { shape: [0.0667, -0.0166, 0.0176], color: "#467dff", opacity: 1 },
    { shape: [0.037, -0.0134, 0.0154], color: "#c2ffff", opacity: 0.8091 },
  ];
  const HALO = { cx: 0.4996, cy: 0.6438, sx: 0.2498, sy: 0.2433, opacity: 0.845, color: "#0e50ff" };
  const GRAIN = 1.7;

  const PLOT_X0 = 20.29, PLOT_X1 = 503.69, PLOT_TOP = 158.49, PLOT_BOTTOM = 385.28;
  const LINE_W = 7.1, LINE_COLOR = "#6496e2", LINE_FALLOFF = 108, LINE_POWER = 1.44, LINE_CENTER = 12;
  const DOT_R = 13, DOT_DX = 8, DOT_DY = 2.6;
  const FG_TOP = 90, FG_H = 370; // çizgi ve noktanın dolaşabildiği şerit (kart birimi)
  const GRID_DX = 40.64, GRID_DY = 40.07, GRID_Y0 = 468.7, GRID_COLOR = "#5a87e1", GRID_ALPHA = 0.23;

  const T_GRID = 0.9, T_DRAW0 = 0.25, T_DRAW = 2.1, T_NUM0 = 1.0, T_NUM = 1.7, T_ARROW = 2.65, T_REST = 3.3, T_MORPH = 0.75;
  const BASE_ACCENT = "#4f8ef7";
  const DOT_TOP = "#2680ff", DOT_MID = "#75aafa", DOT_BOTTOM = "#d0e4fd", DOT_GLOW = "#287dff", PULSE_COLOR = "#78afff";

  // ---------- matematik ----------
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
  const easeInOut = (x) => { const t = clamp01(x); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  const backOut = (x) => { const t = clamp01(x), c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  function erf(x) {
    const s = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return s * y;
  }
  const phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  function sdf(u, v) {
    const qx = Math.abs(u - 0.5) - (0.5 - RN), qy = Math.abs(v - HN / 2) - (HN / 2 - RN);
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - RN;
  }
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0; let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rgbOf(color) {
    const c = String(color).trim();
    const hex = /^#([0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/i.exec(c);
    if (hex) {
      const h = hex[1].length === 3 ? hex[1].split("").map((d) => d + d).join("") : hex[1];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c);
    return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
  }
  const rgba = (color, a) => `rgba(${rgbOf(color).join(",")},${a.toFixed(4)})`;
  function hslOf(color) {
    if (!/^\s*(#|rgb)/i.test(color)) return null;
    const [r, g, b] = rgbOf(color).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (d === 0) return [0, 0];
    const sat = d / (1 - Math.abs(2 * l - 1));
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, sat];
  }
  // Vurgu rengi: CSS hue-rotate + saturate ile aynı renk matrisi. Her karede CSS filtresi çalıştırmak
  // yerine katmanlar bir kez bu matrisle boyanır (kasmanın ana sebeplerinden biri buydu).
  function tintMatrix(accent) {
    const a = hslOf(accent), b = hslOf(BASE_ACCENT);
    if (!a || !b) return null;
    let d = a[0] - b[0];
    if (d > 180) d -= 360; if (d < -180) d += 360;
    const k = b[1] > 0 ? a[1] / b[1] : 1;
    if (Math.abs(d) < 0.5 && Math.abs(k - 1) < 0.02) return null;
    const r = (d * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r);
    const H = [
      0.213 + c * 0.787 - sn * 0.213, 0.715 - c * 0.715 - sn * 0.715, 0.072 - c * 0.072 + sn * 0.928,
      0.213 - c * 0.213 + sn * 0.143, 0.715 + c * 0.285 + sn * 0.14, 0.072 - c * 0.072 - sn * 0.283,
      0.213 - c * 0.213 - sn * 0.787, 0.715 - c * 0.715 + sn * 0.715, 0.072 + c * 0.928 + sn * 0.072,
    ];
    const S = [
      0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k,
      0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k,
      0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k,
    ];
    const M = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M.push(S[i * 3] * H[j] + S[i * 3 + 1] * H[3 + j] + S[i * 3 + 2] * H[6 + j]);
    return M;
  }
  const cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
  function tintRgb(rgb, M) {
    if (!M) return rgb;
    const [r, g, b] = rgb;
    return [cl(M[0] * r + M[1] * g + M[2] * b), cl(M[3] * r + M[4] * g + M[5] * b), cl(M[6] * r + M[7] * g + M[8] * b)];
  }
  const tintHex = (hex, M) => { const [r, g, b] = tintRgb(rgbOf(hex), M).map(Math.round); return `rgb(${r},${g},${b})`; };

  // ---------- sabit katmanlar (genişliğe göre bir kez çizilir, önbelleğe alınır) ----------
  const makeCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const fieldCache = new Map();
  function buildField(px, seed, M, accent) {
    const key = px + ":" + seed + ":" + accent;
    if (fieldCache.has(key)) return fieldCache.get(key);
    const w = Math.round(px), h = Math.round(px * HN);
    const rest = makeCanvas(w, h);
    const c1 = rest.getContext("2d");
    const i1 = c1.createImageData(w, h);
    const d1 = i1.data, rand = rng(seed), fill = rgbOf(FIELD_FILL);
    const shades = FIELD_SHADES.map(({ shape: [cx, cy, sx, sy, th], color, opacity }) => ({
      cx, cy, isx: 1 / Math.abs(sx), isy: 1 / Math.abs(sy), c: Math.cos(th), s: Math.sin(th), rgb: rgbOf(color), a: opacity,
    }));
    const rims = FIELD_RIMS.map(({ shape: [off, sp, sg], color, opacity }) => ({ off, sp, sg, rgb: rgbOf(color), a: opacity }));
    for (let j = 0; j < h; j++) {
      const v = (j + 0.5) / w;
      for (let i = 0; i < w; i++) {
        const u = (i + 0.5) / w;
        let r = fill[0], g = fill[1], b = fill[2];
        for (const o of shades) {
          const du = u - o.cx, dv = v - o.cy;
          const x = (o.c * du + o.s * dv) * o.isx, y = (-o.s * du + o.c * dv) * o.isy;
          const m = o.a * Math.exp(-0.5 * (x * x + y * y));
          r += m * (o.rgb[0] - r); g += m * (o.rgb[1] - g); b += m * (o.rgb[2] - b);
        }
        for (const o of rims) {
          const vs = v + o.off;
          const dx = Math.min(u, 1 - u), dy = Math.min(vs, HN - vs);
          const ratio = Math.min(1, phi((-sdf(u, vs) - o.sp) / o.sg) / Math.max(1e-9, phi((Math.min(dx, dy) - o.sp) / o.sg)));
          const k = 1 - phi((dx - o.sp) / o.sg) * phi((dy - o.sp) / o.sg) * ratio;
          const m = o.a * k;
          r += m * (o.rgb[0] - r); g += m * (o.rgb[1] - g); b += m * (o.rgb[2] - b);
        }
        const n = (rand() + rand() + rand() - 1.5) * 2 * GRAIN;
        const p = (j * w + i) * 4;
        if (M) { const t = tintRgb([r, g, b], M); r = t[0]; g = t[1]; b = t[2]; }
        d1[p] = r + n; d1[p + 1] = g + n; d1[p + 2] = b + n; d1[p + 3] = 255;
      }
    }
    c1.putImageData(i1, 0, 0);
    const out = { rest };
    fieldCache.set(key, out);
    return out;
  }
  function buildHalo(px, M) {
    const s = 0.25;
    const w = Math.max(8, Math.round(((CW + 2 * BX) * px * s) / CW)), h = Math.max(8, Math.round(((CH + 2 * BY) * px * s) / CW));
    const c = makeCanvas(w, h), ctx = c.getContext("2d"), img = ctx.createImageData(w, h);
    const [hr, hg, hb] = tintRgb(rgbOf(HALO.color), M);
    for (let j = 0; j < h; j++) {
      const v = (((j + 0.5) / h) * (CH + 2 * BY) - BY) / CW;
      for (let i = 0; i < w; i++) {
        const u = (((i + 0.5) / w) * (CW + 2 * BX) - BX) / CW;
        const a = (u - HALO.cx) / HALO.sx, e = (v - HALO.cy) / HALO.sy;
        const k = Math.exp(-0.5 * (a * a + e * e)) * HALO.opacity;
        const p = (j * w + i) * 4;
        img.data[p] = hr; img.data[p + 1] = hg; img.data[p + 2] = hb; img.data[p + 3] = Math.min(255, k * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function buildGrid(px, M) {
    const w = Math.round(px), h = Math.round(px * HN), c = makeCanvas(w, h), ctx = c.getContext("2d"), s = px / CW;
    ctx.scale(s, s); ctx.strokeStyle = tintHex(GRID_COLOR, M); ctx.lineWidth = 1; ctx.beginPath();
    for (let k = -6; k <= 6; k++) { const x = CW / 2 + GRID_DX * k; ctx.moveTo(x, 250); ctx.lineTo(x, CH); }
    for (let k = -6; k <= 6; k++) { const y = GRID_Y0 + GRID_DY * k; if (y < 250 || y > CH) continue; ctx.moveTo(0, y); ctx.lineTo(CW, y); }
    ctx.stroke();
    const mw = 64, mh = Math.round(64 * HN), m = makeCanvas(mw, mh), mc = m.getContext("2d"), img = mc.createImageData(mw, mh);
    for (let j = 0; j < mh; j++) {
      const y = ((j + 0.5) / mh) * CH, my = smooth((y - 350) / 230);
      for (let i = 0; i < mw; i++) {
        const x = ((i + 0.5) / mw) * CW, mx = Math.exp(-0.5 * Math.pow((x - CW / 2) / 92, 2));
        img.data[(j * mw + i) * 4 + 3] = Math.round(255 * GRID_ALPHA * mx * my);
      }
    }
    mc.putImageData(img, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "destination-in"; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(m, 0, 0, w, h);
    return c;
  }

  // ---------- eğri ----------
  function buildCurve(data) {
    const vals = data.length >= 2 ? data : data.length === 1 ? [data[0], data[0]] : [0, 0];
    const n = vals.length;
    let lo = Infinity, hi = -Infinity, pk = 0;
    for (let i = 0; i < n; i++) { if (vals[i] < lo) lo = vals[i]; if (vals[i] > hi) { hi = vals[i]; pk = i; } }
    const span = hi - lo || 1;
    const yv = vals.map((v) => (hi === lo ? (PLOT_TOP + PLOT_BOTTOM) / 2 : PLOT_TOP + (1 - (v - lo) / span) * (PLOT_BOTTOM - PLOT_TOP)));
    const h = (PLOT_X1 - PLOT_X0) / (n - 1), sl = [];
    for (let i = 0; i < n - 1; i++) sl.push((yv[i + 1] - yv[i]) / h);
    const m = [sl[0]];
    for (let i = 1; i < n - 1; i++) { const a = sl[i - 1], b = sl[i]; m.push((Math.sign(a) + Math.sign(b)) * Math.min(Math.abs(a), Math.abs(b), 0.25 * Math.abs(a + b))); }
    m.push(sl[n - 2]);
    const ys = new Float32Array(CW + 1);
    for (let x = 0; x <= CW; x++) {
      let y;
      if (x <= PLOT_X0) y = yv[0] + (x - PLOT_X0) * m[0];
      else if (x >= PLOT_X1) y = yv[n - 1] + (x - PLOT_X1) * m[n - 1];
      else {
        const t = (x - PLOT_X0) / h, i = Math.min(n - 2, Math.floor(t)), f = t - i, f2 = f * f, f3 = f2 * f;
        y = (2 * f3 - 3 * f2 + 1) * yv[i] + (f3 - 2 * f2 + f) * h * m[i] + (-2 * f3 + 3 * f2) * yv[i + 1] + (f3 - f2) * h * m[i + 1];
      }
      ys[x] = y;
    }
    return { ys, peakX: PLOT_X0 + pk * h, lo, hi, n };
  }
  function curveY(ys, x) { const xc = Math.max(0, Math.min(CW, x)), i = Math.min(CW - 1, Math.floor(xc)), f = xc - i; return ys[i] * (1 - f) + ys[i + 1] * f; }
  const lineAlpha = (d) => Math.exp(-Math.pow(Math.abs(d) / LINE_FALLOFF, LINE_POWER));
  function inverseEase(target) { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (easeInOut(m) < target) lo = m; else hi = m; } return (lo + hi) / 2; }
  function frameAt(t) {
    const f = {
      grid: smooth(t / T_GRID), draw: easeInOut((t - T_DRAW0) / T_DRAW), dotS: backOut((t - T_DRAW0) / 0.4), dotA: smooth((t - T_DRAW0) / 0.2),
      num: easeOut((t - T_NUM0) / T_NUM), numA: smooth((t - T_NUM0) / 0.45), numY: 1 - easeOut((t - T_NUM0) / 0.7),
      arrow: backOut((t - T_ARROW) / 0.45), arrowA: smooth((t - T_ARROW) / 0.18), breath: 0,
    };
    return f;
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- kart ----------
  function mount(host, options) {
    let o = Object.assign({
      data: [1, 2], labels: null, value: 0, prefix: "", suffix: "", decimals: 0,
      title: "", caption: "", status: "", badge: "", trend: "none", accent: BASE_ACCENT,
      width: 340, locale: "tr-TR", formatValue: null,
      font: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }, options);
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

    const root = document.createElement("div");
    root.className = "peak-card";
    host.appendChild(root);

    const L = { curve: buildCurve(o.data), from: null, morph: 1, value: o.value, shown: 0, valueFrom: 0, valueT: 1, hover: null, hoverX: 0, hoverMix: 0 };
    let canvas, ctx, card, digits, numEl, arrowEl, readEl, readVal, readLab, statusEl, badgeEl, titleEl, captionEl, prefixEl, suffixEl, placeholder;
    let gridCv, fg, lastGridA = -1, grid, u, dpr, bx, by, raf = 0, last = 0, clock = 0, started = false, visible = false, layersFor = "";
    let COL = {};

    function build() {
      const width = o.width; u = width / CW;
      const px = (n) => `${(n * u).toFixed(3)}px`;
      root.style.width = width + "px";
      root.innerHTML = `
        <div class="pc-card" style="position:relative;width:${width}px;height:${width * HN}px;border-radius:${px(CR)};font-family:${esc(o.font)};color:#fff;user-select:none">
          <canvas class="pc-bg" aria-hidden="true" style="position:absolute;left:0;top:0;pointer-events:none"></canvas>
          <canvas class="pc-grid" aria-hidden="true" style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;opacity:0"></canvas>
          <canvas class="pc-fg" aria-hidden="true" style="position:absolute;left:0;top:${px(FG_TOP)};width:100%;height:${px(FG_H)};pointer-events:none"></canvas>
          <div class="pc-hit" style="position:absolute;left:0;top:${px(96)};width:100%;height:${px(330)};touch-action:pan-y;cursor:crosshair"></div>
          <p class="pc-status" style="position:absolute;left:${px(45.6)};top:${px(43.6)};font-size:${px(18.6)};margin:0;line-height:1;color:#99a3b6;white-space:nowrap;display:flex;align-items:center;gap:${px(8)}"><i class="pc-live" style="width:${px(9)};height:${px(9)};border-radius:50%"></i><span></span></p>
          <span class="pc-badge" style="position:absolute;right:${px(46)};top:${px(35)};height:${px(37)};line-height:${px(37)};padding:0 ${px(19)};border-radius:${px(18.5)};background:rgba(255,255,255,.13);color:#c6d4ef;font-size:${px(17)};white-space:nowrap"></span>
          <div class="pc-read" aria-hidden="true" style="position:absolute;left:0;top:0;opacity:0;pointer-events:none;z-index:2;display:flex;align-items:baseline;gap:${px(7)};padding:${px(7)} ${px(11)};border-radius:${px(11)};background:rgba(14,26,52,.92);border:1px solid rgba(160,195,255,.18);white-space:nowrap">
            <span class="pc-rv" style="font-size:${px(16)};font-weight:600;color:#fff"></span><span class="pc-rl" style="font-size:${px(12.5)};color:#9fb0cc"></span>
          </div>
          <p class="pc-title" style="position:absolute;left:0;right:0;text-align:center;top:${px(441.4)};font-size:${px(21)};margin:0;line-height:1.1;color:#a3a9b6;padding:0 ${px(30)}"></p>
          <div class="pc-num" style="position:absolute;left:0;right:0;top:${px(476)};display:flex;justify-content:center;opacity:0">
            <div style="position:relative;font-weight:600;font-size:${px(86)};line-height:1;letter-spacing:${px(-1.5)};white-space:nowrap">
              <span class="pc-pre"></span><span style="position:relative;display:inline-block;font-variant-numeric:tabular-nums"><span class="pc-ph" style="visibility:hidden"></span><span class="pc-digits" style="position:absolute;right:0;top:0"></span></span><span class="pc-suf" style="font-size:.62em;margin-left:${px(4)};opacity:.92"></span>
              <svg class="pc-arrow" viewBox="0 0 8 8" aria-hidden="true" style="position:absolute;left:100%;margin-left:${px(8)};top:${px(12)};width:${px(10)};height:${px(10)};overflow:visible;transform-origin:0% 100%;opacity:0">
                <path d="M0.6 7.4 L7.2 0.8 M2 0.6 L7.4 0.6 L7.4 6" fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
              </svg>
            </div>
          </div>
          <p class="pc-caption" style="position:absolute;left:0;right:0;text-align:center;top:${px(578)};font-size:${px(17)};margin:0;line-height:1.35;color:#98a0b0;padding:0 ${px(44)};white-space:normal"></p>
        </div>`;
      card = root.firstElementChild;
      canvas = card.querySelector(".pc-bg"); gridCv = card.querySelector(".pc-grid"); fg = card.querySelector(".pc-fg");
      ctx = fg.getContext("2d");
      digits = card.querySelector(".pc-digits"); placeholder = card.querySelector(".pc-ph"); numEl = card.querySelector(".pc-num");
      arrowEl = card.querySelector(".pc-arrow"); readEl = card.querySelector(".pc-read"); readVal = card.querySelector(".pc-rv"); readLab = card.querySelector(".pc-rl");
      statusEl = card.querySelector(".pc-status span"); badgeEl = card.querySelector(".pc-badge"); titleEl = card.querySelector(".pc-title");
      captionEl = card.querySelector(".pc-caption"); prefixEl = card.querySelector(".pc-pre"); suffixEl = card.querySelector(".pc-suf");

      dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const bxc = Math.ceil(BX * u), byc = Math.ceil(BY * u);
      // Arka plan yumuşak bir parlama: 1x çözünürlük yeterli (Retina'da 4 kat daha az piksel)
      bx = bxc; by = byc;
      canvas.width = Math.ceil(CW * u + 2 * bx); canvas.height = Math.ceil(CH * u + 2 * by);
      Object.assign(canvas.style, { left: -bxc + "px", top: -byc + "px", width: canvas.width + "px", height: canvas.height + "px" });
      gridCv.width = Math.round(CW * u * dpr); gridCv.height = Math.round(CH * u * dpr);
      fg.width = Math.round(CW * u * dpr); fg.height = Math.round(FG_H * u * dpr);
      layersFor = "";
      const hit = card.querySelector(".pc-hit");
      const onMove = (e) => {
        const r = card.getBoundingClientRect();
        const nx = Math.max(PLOT_X0, Math.min(PLOT_X1, ((e.clientX - r.left) / r.width) * CW));
        if (L.hover === null && L.hoverMix < 0.02) L.hoverX = nx;
        L.hover = nx; kick();
      };
      const onLeave = () => { L.hover = null; kick(); };
      hit.addEventListener("pointermove", onMove); hit.addEventListener("pointerdown", onMove);
      hit.addEventListener("pointerleave", onLeave); hit.addEventListener("pointercancel", onLeave);
      applyText();
    }

    // Ağır katmanlar (parlama alanı, hale, ızgara) sadece genişlik ya da renk değişince bir kez çizilir.
    // Arka plan (hale + alan) tek bir tuvalde birleştirilir; her karede tek drawImage yeterli.
    function buildLayers() {
      layersFor = o.accent + ":" + o.width;
      const M = tintMatrix(o.accent);
      const width = o.width;
      // Parlama yumuşak bir geçiş olduğu için düşük çözünürlük gözle fark edilmez ama 4-5 kat hızlı.
      const fieldPx = Math.round(Math.min(width, 460));
      const { rest: field } = buildField(fieldPx, 11, M, o.accent);
      const halo = buildHalo(width, M);
      grid = buildGrid(width * dpr, M);
      // 1) sabit arka plan: hale + parlama alanı, bir kez çizilir
      const g = canvas.getContext("2d"), s = u;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(s, 0, 0, s, bx, by);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      g.drawImage(halo, -BX, -BY, CW + 2 * BX, CH + 2 * BY);
      g.save();
      g.beginPath(); g.moveTo(CR, 0);
      g.arcTo(CW, 0, CW, CH, CR); g.arcTo(CW, CH, 0, CH, CR); g.arcTo(0, CH, 0, 0, CR); g.arcTo(0, 0, CW, 0, CR);
      g.closePath(); g.clip();
      g.drawImage(field, 0, 0, CW, CH);
      g.restore();
      // 2) ızgara: kendi katmanında bir kez çizilir; belirmesi sadece CSS opacity ile (tarayıcı bunu ucuza yapar)
      const gc = gridCv.getContext("2d");
      gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, gridCv.width, gridCv.height);
      gc.drawImage(grid, 0, 0, gridCv.width, gridCv.height);
      COL = {
        line: tintRgb(rgbOf(LINE_COLOR), M), top: tintHex(DOT_TOP, M), mid: tintHex(DOT_MID, M), bottom: tintHex(DOT_BOTTOM, M),
        glow: tintRgb(rgbOf(DOT_GLOW), M), pulse: tintRgb(rgbOf(PULSE_COLOR), M),
      };
    }
    const rgbaA = (rgb, a) => `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a.toFixed(4)})`;

    function fmtNum(v) { return v.toLocaleString(o.locale, { minimumFractionDigits: o.decimals, maximumFractionDigits: o.decimals }); }
    function applyText() {
      if (layersFor !== o.accent + ":" + o.width) buildLayers();
      statusEl.textContent = o.status;
      card.querySelector(".pc-live").style.background = o.accent;
      card.querySelector(".pc-live").style.boxShadow = `0 0 8px ${o.accent}`;
      badgeEl.textContent = o.badge; badgeEl.style.display = o.badge ? "" : "none";
      titleEl.textContent = o.title; captionEl.textContent = o.caption;
      prefixEl.textContent = o.prefix; suffixEl.textContent = o.suffix;
      placeholder.textContent = fmtNum(o.value);
      const path = arrowEl.querySelector("path");
      path.setAttribute("stroke", o.trend === "down" ? "#f08a8a" : "#93cfa2");
      arrowEl.style.display = o.trend === "none" ? "none" : "";
      arrowEl.style.rotate = o.trend === "down" ? "90deg" : "";
      card.setAttribute("aria-label", `${o.title}: ${o.prefix}${fmtNum(o.value)}${o.suffix}. ${o.caption}`);
      card.setAttribute("role", "img");
    }

    const tLand = (frac) => T_DRAW0 + T_DRAW * inverseEase(frac);
    function roundRect() {
      ctx.beginPath(); ctx.moveTo(CR, 0);
      ctx.arcTo(CW, 0, CW, CH, CR); ctx.arcTo(CW, CH, 0, CH, CR); ctx.arcTo(0, CH, 0, 0, CR); ctx.arcTo(0, 0, CW, 0, CR);
      ctx.closePath();
    }

    function draw(dt) {
      const hovering = L.hover !== null;
      if (started && !reduce) { const frozen = hovering && clock >= T_REST; if (!frozen) clock += dt; }
      const t = clock;
      const F = started ? frameAt(t) : frameAt(0);

      if (L.morph < 1) L.morph = reduce ? 1 : Math.min(1, L.morph + dt / T_MORPH);
      const mk = easeInOut(L.morph), C = L.curve, mixing = L.from && L.morph < 1;
      const ys = mixing ? new Float32Array(CW + 1) : C.ys;
      if (mixing) for (let x = 0; x <= CW; x++) ys[x] = L.from.ys[x] + (C.ys[x] - L.from.ys[x]) * mk;
      const peakX = mixing ? L.from.peakX + (C.peakX - L.from.peakX) * mk : C.peakX;
      const lo = mixing ? L.from.lo + (C.lo - L.from.lo) * mk : C.lo;
      const hi = mixing ? L.from.hi + (C.hi - L.from.hi) * mk : C.hi;

      const landed = t >= tLand((peakX + DOT_DX) / CW) && F.dotA > 0.99;
      const wantHover = hovering && (landed || reduce);
      if (L.hover !== null) L.hoverX = reduce ? L.hover : L.hoverX + (L.hover - L.hoverX) * (1 - Math.exp(-dt * 14));
      L.hoverMix = reduce ? (wantHover ? 1 : 0) : L.hoverMix + ((wantHover ? 1 : 0) - L.hoverMix) * (1 - Math.exp(-dt * 10));

      if (L.valueT < 1) L.valueT = reduce ? 1 : Math.min(1, L.valueT + dt / 0.9);
      const target = L.valueFrom + (L.value - L.valueFrom) * easeOut(L.valueT);
      const shown = target * F.num;
      L.shown = shown;
      const txt = fmtNum(shown);
      if (digits.textContent !== txt) digits.textContent = txt;
      numEl.style.opacity = String(F.numA);
      numEl.style.transform = `translateY(${(F.numY * 5 * u).toFixed(2)}px)`;
      arrowEl.style.opacity = String(F.arrowA);
      arrowEl.style.transform = `scale(${Math.max(0, F.arrow).toFixed(3)})`;

      const ga = Math.round(F.grid * 100) / 100;
      if (ga !== lastGridA) { gridCv.style.opacity = String(ga); lastGridA = ga; }

      // 3) her karede sadece çizgi + nokta şeridi (kartın ~yarısı) temizlenip çizilir
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, fg.width, fg.height);
      const s = dpr * u;
      ctx.setTransform(s, 0, 0, s, 0, -FG_TOP * s);
      ctx.save();

      const x1 = F.draw * CW;
      if (x1 > 0.5) {
        const g = ctx.createLinearGradient(0, 0, CW, 0);
        const head = 0.95 * (1 - smooth((F.draw - 0.8) / 0.2));
        for (let i = 0; i <= 54; i++) {
          const x = (i / 54) * CW;
          let a = lineAlpha(x - peakX - LINE_CENTER);
          if (head > 0.001 && x <= x1 + 10) a = Math.max(a, head * Math.exp(-Math.max(0, x1 - x) / 70));
          g.addColorStop(i / 54, rgbaA(COL.line, a));
        }
        ctx.strokeStyle = g; ctx.lineWidth = LINE_W; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(0, curveY(ys, 0));
        for (let x = 2; x < x1; x += 2) ctx.lineTo(x, ys[x]); // 2 birimlik adım: gözle aynı, yarı maliyet
        ctx.lineTo(x1, curveY(ys, x1)); ctx.stroke();
      }

      if (F.dotA > 0.001) {
        const restX = peakX + DOT_DX, baseX = Math.min(x1, restX);
        const dx = baseX + (L.hoverX - baseX) * L.hoverMix;
        const dy = curveY(ys, dx) + DOT_DY * (1 - L.hoverMix) * clamp01(baseX / restX);
        const sinceLand = t - tLand(restX / CW);
        const pulse = sinceLand > 0 && sinceLand < 1.1 && !reduce ? sinceLand / 1.1 : -1;
        ctx.globalAlpha = F.dotA; ctx.translate(dx, dy); ctx.scale(F.dotS, F.dotS);
        const boost = pulse >= 0 ? Math.sin(Math.PI * Math.min(1, pulse * 1.6)) : 0;
        const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
        const ha = (a) => rgbaA(COL.glow, Math.min(1, a * (1 + 0.9 * boost)));
        hg.addColorStop(0, ha(0.47)); hg.addColorStop(15 / 30, ha(0.47)); hg.addColorStop(17 / 30, ha(0.41));
        hg.addColorStop(19 / 30, ha(0.31)); hg.addColorStop(21 / 30, ha(0.17)); hg.addColorStop(23 / 30, ha(0.1));
        hg.addColorStop(25 / 30, ha(0.06)); hg.addColorStop(27 / 30, ha(0.03)); hg.addColorStop(1, ha(0));
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
        if (pulse >= 0) {
          ctx.strokeStyle = rgbaA(COL.pulse, 0.55 * (1 - pulse) * (1 - pulse));
          ctx.lineWidth = 2.2 * (1 - pulse) + 0.6;
          ctx.beginPath(); ctx.arc(0, 0, DOT_R + 26 * easeOut(pulse), 0, Math.PI * 2); ctx.stroke();
        }
        const dg = ctx.createLinearGradient(0, -DOT_R, 0, DOT_R);
        dg.addColorStop(0, COL.top); dg.addColorStop(0.45, COL.mid); dg.addColorStop(1, COL.bottom);
        ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(0, 0, DOT_R, 0, Math.PI * 2); ctx.fill();
        ctx.setTransform(s, 0, 0, s, 0, -FG_TOP * s); ctx.globalAlpha = 1;

        readEl.style.opacity = L.hoverMix.toFixed(3);
        readEl.style.transform = `translate(${(dx * u).toFixed(1)}px, ${((dy - 26) * u).toFixed(1)}px) translate(-50%, -100%) scale(${(0.92 + 0.08 * L.hoverMix).toFixed(3)})`;
        if (L.hoverMix > 0.01) {
          const v = lo + ((PLOT_BOTTOM - curveY(ys, dx)) / (PLOT_BOTTOM - PLOT_TOP)) * (hi - lo);
          const rv = o.formatValue ? o.formatValue(v) : Math.round(v).toLocaleString(o.locale);
          if (readVal.textContent !== rv) readVal.textContent = rv;
          const idx = Math.round(((Math.max(PLOT_X0, Math.min(PLOT_X1, dx)) - PLOT_X0) / (PLOT_X1 - PLOT_X0)) * (C.n - 1));
          const lab = (o.labels && o.labels[idx]) || "";
          if (readLab.textContent !== lab) readLab.textContent = lab;
          readLab.style.display = lab ? "" : "none";
        }
      }
      ctx.restore();
    }

    // Animasyon bitince çizim döngüsü tamamen durur; sadece fare, veri ya da sayı değişince yeniden başlar.
    const busy = () => started && (
      (!reduce && clock < T_REST + 0.4) || L.morph < 1 || L.valueT < 1 ||
      L.hover !== null || L.hoverMix > 0.001);
    function tick() {
      raf = 0;
      const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now; draw(dt);
      if (visible && !document.hidden && busy()) raf = requestAnimationFrame(tick);
    }
    function kick() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } }

    build();
    clock = reduce ? T_REST + 0.01 : 0;
    started = reduce;
    draw(0);

    // Ekrana her girişte animasyon baştan oynar (sitedeki diğer kartlarla aynı davranış)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) { started = true; kick(); }
      else {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        if (!reduce) { clock = 0; started = false; L.valueT = 1; L.valueFrom = 0; draw(0); }
      }
    }, { threshold: 0.25 });
    io.observe(card);
    const onVis = () => { if (!document.hidden) kick(); };
    document.addEventListener("visibilitychange", onVis);

    let resizeT;
    function update(next) {
      const prevW = o.width, prevKey = o.data.join(",");
      o = Object.assign({}, o, next);
      if (o.width !== prevW) {
        L.curve = buildCurve(o.data); L.from = null; L.morph = 1; L.value = o.value;
        io.unobserve(card); build(); io.observe(card); draw(0); kick();
        return;
      }
      applyText();
      if (o.data.join(",") !== prevKey) {
        const t = easeInOut(L.morph), next2 = buildCurve(o.data);
        if (L.from && L.morph < 1) {
          const ys = new Float32Array(CW + 1);
          for (let x = 0; x <= CW; x++) ys[x] = L.from.ys[x] + (L.curve.ys[x] - L.from.ys[x]) * t;
          L.from = Object.assign({}, L.curve, { ys, peakX: L.from.peakX + (L.curve.peakX - L.from.peakX) * t });
        } else L.from = L.curve;
        L.curve = next2; L.morph = 0;
      }
      if (o.value !== L.value) { L.valueFrom = L.shown; L.value = o.value; L.valueT = 0; }
      kick();
    }

    return {
      update,
      resize(width) { clearTimeout(resizeT); resizeT = setTimeout(() => update({ width }), 120); },
      destroy() { io.disconnect(); document.removeEventListener("visibilitychange", onVis); if (raf) cancelAnimationFrame(raf); root.remove(); },
    };
  }

  return { mount };
})();

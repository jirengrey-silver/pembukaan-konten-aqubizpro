// QBizPro Brand Roulette Intro — the signature opening animation.
// Eight stages: opening glow, orbit lines, brands appear, roulette spin, slow-down selection,
// highlight, camera zoom, and the product-review opening card.
import { clamp, lerp, seg, hash, EASE, hexA, mix, QB, uid } from './util.js';

export const DEFAULT_BRANDS = ['Lenovo', 'Dell', 'HP', 'ASUS', 'Acer', 'Microsoft', 'Intel', 'AMD', 'Cisco', 'NetApp', 'HPE', 'Jabra', 'Logitech', 'Samsung', 'Epson', 'APC', 'Fortinet', 'Synology', 'Maxhub'];
export const ACCEL = { slow: { a: 0.4, b: 0.48, label: 'Lambat' }, medium: { a: 0.22, b: 0.36, label: 'Sedang' }, fast: { a: 0.1, b: 0.28, label: 'Cepat' } };
export const STAGES = [
  ['openingDur', 'Pembukaan'], ['orbitDur', 'Garis orbit'], ['appearDur', 'Brand muncul'], ['hideDur', 'Jadi kotak ?'], ['spinDur', 'Roulette'],
  ['highlightDur', 'Sorotan'], ['zoomDur', 'Zoom'], ['openDur', 'Kotak terbuka'], ['reviewDur', 'Halaman review']
];

export function defaultRoulette() {
  return {
    brands: DEFAULT_BRANDS.map(name => ({ id: uid(), name, assetId: null })),
    count: 12, selection: 'random', selectedId: null, seed: 7,
    openingDur: 1.6, orbitDur: 1.2, appearDur: 1.8, hideDur: 1.4, spinDur: 5, highlightDur: 1.0, zoomDur: 1.1, openDur: 1.8, reviewDur: 3.2, mystery: true,
    rotations: 4, accel: 'medium', direction: 'cw', logoSize: 11, orbitRadius: 38, tilt: 64,
    zoomEffect: true, zoomFill: 70, centerSize: 10, centerAssetId: null, centerText: 'QBizPro',
    tile: 'white', colors: { bg: QB.navy, gold: QB.gold, blue: QB.blue },
    review: { title: '', subtitle: '', productAssetId: null }
  };
}
export function rouletteDuration(p) { return STAGES.reduce((s, [k]) => s + Math.max(0, +p[k] || 0), 0); }
export function stageTimes(p) { const out = {}; let t = 0; for (const [k, label] of STAGES) { const d = Math.max(0, +p[k] || 0); out[k] = { a: t, b: t + d, d, label }; t += d; } out.total = t; return out; }
// the brands that orbit, in order, and which of them gets selected
export function orbitSet(p) {
  const all = (p.brands || []).filter(b => b && (b.name || b.assetId));
  const n = Math.max(3, Math.min(all.length, Math.round(p.count) || 12));
  let list = all.slice(0, n);
  let sel = -1;
  if (p.selection === 'manual' && p.selectedId) {
    sel = list.findIndex(b => b.id === p.selectedId);
    if (sel < 0) { const b = all.find(x => x.id === p.selectedId); if (b) { list[list.length - 1] = b; sel = list.length - 1; } }
  }
  if (sel < 0) sel = Math.floor(hash((p.seed || 1) * 9.13) * list.length) % Math.max(1, list.length);
  return { list, sel, n: list.length };
}
// normalized spin position with a ramp up, cruise and a long roulette-style slow-down
function spinProfile(accel) {
  const { a, b } = ACCEL[accel] || ACCEL.medium; const k = 2.6; const I = a / 2 + (b - a) + (1 - b) / (k + 1);
  return x => {
    x = clamp(x); let s;
    if (x < a) s = (x * x) / (2 * a);
    else if (x < b) s = a / 2 + (x - a);
    else { const y = (x - b) / (1 - b); s = a / 2 + (b - a) + (1 - b) * (1 - Math.pow(1 - y, k + 1)) / (k + 1); }
    return s / I;
  };
}
export function peakSpeed(p) {
  const { a, b } = ACCEL[p.accel] || ACCEL.medium; const k = 2.6; const I = a / 2 + (b - a) + (1 - b) / (k + 1);
  return (Math.max(1, p.rotations) + 0.5) / (I * Math.max(0.5, p.spinDur)); // rotations per second at full speed
}
const TAU = Math.PI * 2; const FOCUS = Math.PI / 2; // the front of the orbit, closest to the camera

export function orbitAngle(p, t, S, set) {
  const n = set.n; const dir = p.direction === 'ccw' ? -1 : 1; const idle = 0.35 * dir;
  const spinA = S.spinDur.a; const baseAtSpin = -Math.PI / 2 + idle * spinA;
  if (t < spinA) return -Math.PI / 2 + idle * t;
  const target = FOCUS - set.sel * TAU / n;
  let delta = ((target - baseAtSpin) * dir) % TAU; if (delta < 0) delta += TAU;
  const total = Math.max(1, Math.round(p.rotations)) * TAU + delta;
  const prof = spinProfile(p.accel);
  return baseAtSpin + dir * total * prof(seg(t, spinA, S.spinDur.b));
}

/* ---------------- drawing ---------------- */
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function drawImageContain(g, img, x, y, w, h) { const k = Math.min(w / img.width, h / img.height); const dw = img.width * k, dh = img.height * k; g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }
function fitFont(g, text, weight, size, fam, maxW, min = 8) { let s = size; g.font = `${weight} ${s}px ${fam}`; while (g.measureText(text).width > maxW && s > min) { s -= 1; g.font = `${weight} ${s}px ${fam}`; } return s; }
const HEAD = '"Sora", "Segoe UI", Arial, sans-serif'; const TECH = '"Orbitron", "Arial Black", sans-serif';

function background(g, W, H, p, t, zoom) {
  const C = p.colors || {}; const bg = C.bg || QB.navy;
  const gr = g.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H / 2, Math.max(W, H) * 0.8); gr.addColorStop(0, mix(bg, '#2A4C9A', 0.45)); gr.addColorStop(0.55, bg); gr.addColorStop(1, mix(bg, '#000000', 0.55));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // perspective floor grid
  g.save(); const hz = H * 0.62; g.strokeStyle = hexA(C.blue || QB.blue, 0.1); g.lineWidth = Math.max(1, W / 900);
  for (let i = -16; i <= 16; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.03, hz); g.lineTo(W / 2 + i * W * 0.24, H * 1.05); g.stroke(); }
  const off = (t * 0.25) % 1; for (let j = 0; j < 12; j++) { const u = (j + off) / 12; const y = hz + Math.pow(u, 2.1) * (H - hz) * 1.05; g.globalAlpha = clamp(u * 2.5); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.restore();
  // drifting particles
  g.save(); const m = Math.min(W, H);
  for (let i = 0; i < 70; i++) { const x = (hash(i) * W + t * (6 + hash(i + 3) * 18) * (i % 2 ? 1 : -1) + W) % W; const y = (hash(i + 9) * H - t * (8 + hash(i + 5) * 22) + H * 4) % H; g.fillStyle = hexA(i % 3 ? (C.blue || QB.blue) : (C.gold || QB.gold), 0.15 + hash(i + 2) * 0.35); g.beginPath(); g.arc(x, y, m * (0.0015 + hash(i + 7) * 0.0025), 0, TAU); g.fill(); }
  g.restore();
}
function vignette(g, W, H) { const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H); }

function centerLogo(g, cx, cy, size, p, img, glow, alpha) {
  const C = p.colors || {}; if (alpha <= 0) return;
  g.save(); g.globalAlpha = alpha;
  const gl = g.createRadialGradient(cx, cy, 0, cx, cy, size * 2.2); gl.addColorStop(0, hexA(C.gold || QB.gold, 0.45 * glow)); gl.addColorStop(0.5, hexA(C.blue || QB.blue, 0.18 * glow)); gl.addColorStop(1, hexA(C.blue || QB.blue, 0)); g.fillStyle = gl; g.fillRect(cx - size * 2.4, cy - size * 2.4, size * 4.8, size * 4.8);
  if (img) drawImageContain(g, img, cx - size / 2, cy - size / 2, size, size);
  else {
    // stand-in mark until the real QBizPro logo is uploaded
    g.save(); g.translate(cx, cy - size * 0.12); const r = size * 0.36;
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
    const gg = g.createLinearGradient(-r, -r, r, r); gg.addColorStop(0, C.gold || QB.gold); gg.addColorStop(1, QB.orange); g.fillStyle = gg; g.fill();
    g.lineWidth = size * 0.03; g.strokeStyle = hexA('#FFFFFF', 0.7); g.stroke();
    g.fillStyle = C.bg || QB.navy; g.font = `800 ${Math.round(r * 1.05)}px ${HEAD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Q', 0, r * 0.06);
    g.restore();
    const label = p.centerText || 'QBizPro'; const fs = fitFont(g, label, 800, size * 0.24, HEAD, size * 1.25);
    g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.shadowColor = hexA(C.gold || QB.gold, 0.8); g.shadowBlur = size * 0.12; g.fillText(label, cx, cy + size * 0.5); g.shadowBlur = 0;
  }
  g.restore();
}
function tile(g, x, y, s, brand, img, p, o) {
  const C = p.colors || {}; g.save(); g.globalAlpha = o.alpha;
  if (o.glow > 0) { const gl = g.createRadialGradient(x, y, s * 0.2, x, y, s * 1.4); gl.addColorStop(0, hexA(C.gold || QB.gold, 0.55 * o.glow)); gl.addColorStop(1, hexA(C.blue || QB.blue, 0)); g.fillStyle = gl; g.fillRect(x - s * 1.5, y - s * 1.5, s * 3, s * 3); }
  const r = s * 0.22; const st = p.tile || 'white';
  if (st !== 'none') {
    g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = s * 0.25; g.shadowOffsetY = s * 0.06;
    if (st === 'white') { g.fillStyle = '#FFFFFF'; roundRect(g, x - s / 2, y - s / 2, s, s, r); g.fill(); }
    else { g.fillStyle = hexA('#FFFFFF', 0.1); roundRect(g, x - s / 2, y - s / 2, s, s, r); g.fill(); }
    g.shadowColor = 'transparent';
    g.lineWidth = Math.max(1, s * (o.glow > 0 ? 0.045 : 0.02)); g.strokeStyle = o.glow > 0 ? hexA(C.gold || QB.gold, 0.6 + 0.4 * o.glow) : hexA(st === 'white' ? '#C9D6EA' : '#FFFFFF', st === 'white' ? 0.8 : 0.35);
    roundRect(g, x - s / 2, y - s / 2, s, s, r); g.stroke();
  }
  const pad = s * 0.16;
  if (img) drawImageContain(g, img, x - s / 2 + pad, y - s / 2 + pad, s - pad * 2, s - pad * 2);
  else {
    const label = brand.name || '?'; const dark = st === 'white';
    const fs = fitFont(g, label, 800, s * 0.26, HEAD, s - pad * 1.6, 6);
    g.fillStyle = dark ? (C.bg || QB.navy) : '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x, y + fs * 0.04);
  }
  g.restore();
}
// the yellow mystery box that hides which brand is which while the roulette spins
function mysteryBox(g, x, y, s, p, o) {
  const C = p.colors || {}; const gold = C.gold || QB.gold; g.save(); g.globalAlpha = o.alpha;
  if (o.glow > 0) { const gl = g.createRadialGradient(x, y, s * 0.2, x, y, s * 1.5); gl.addColorStop(0, hexA(gold, 0.6 * o.glow)); gl.addColorStop(1, hexA(C.blue || QB.blue, 0)); g.fillStyle = gl; g.fillRect(x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2); }
  const r = s * 0.2; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = s * 0.25; g.shadowOffsetY = s * 0.07;
  const gr = g.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2); gr.addColorStop(0, mix(gold, '#FFFFFF', 0.35)); gr.addColorStop(0.55, gold); gr.addColorStop(1, mix(gold, QB.orange, 0.7));
  g.fillStyle = gr; roundRect(g, x - s / 2, y - s / 2, s, s, r); g.fill(); g.shadowColor = 'transparent';
  // bevel: inner frame and a soft shine across the top
  g.lineWidth = Math.max(1, s * 0.035); g.strokeStyle = hexA('#FFFFFF', 0.55); roundRect(g, x - s / 2 + s * 0.07, y - s / 2 + s * 0.07, s * 0.86, s * 0.86, r * 0.7); g.stroke();
  g.lineWidth = Math.max(1, s * (o.glow > 0 ? 0.05 : 0.025)); g.strokeStyle = o.glow > 0 ? hexA('#FFFFFF', 0.6 + 0.4 * o.glow) : hexA(mix(gold, '#000000', 0.35), 0.8); roundRect(g, x - s / 2, y - s / 2, s, s, r); g.stroke();
  const sh = g.createLinearGradient(x, y - s / 2, x, y); sh.addColorStop(0, hexA('#FFFFFF', 0.35)); sh.addColorStop(1, hexA('#FFFFFF', 0)); g.fillStyle = sh; roundRect(g, x - s / 2 + s * 0.07, y - s / 2 + s * 0.07, s * 0.86, s * 0.36, r * 0.7); g.fill();
  const q = s * (0.62 + 0.05 * (o.pulse || 0)); g.font = `800 ${q}px ${HEAD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = hexA(mix(gold, '#000000', 0.45), 0.5); g.fillText('?', x + s * 0.025, y + s * 0.06);
  g.fillStyle = C.bg || QB.navy; g.fillText('?', x, y + s * 0.035);
  g.restore();
}
// one face of an orbit item at time t: the brand tile, a flip between brand and box, or the box
function itemFace(g, x, y, s, it, imgs, p, S, set, t, o) {
  if (!p.mystery) { tile(g, x, y, s, it.b, it.b.assetId ? imgs(it.b.assetId) : null, p, o); return; }
  const a0 = S.hideDur.a + (it.i / set.n) * S.hideDur.d * 0.6; const fk = S.hideDur.d > 0 ? seg(t, a0, a0 + S.hideDur.d * 0.4) : (t >= S.hideDur.a ? 1 : 0);
  if (fk <= 0) { tile(g, x, y, s, it.b, it.b.assetId ? imgs(it.b.assetId) : null, p, o); return; }
  if (fk >= 1) { mysteryBox(g, x, y, s, p, o); return; }
  const sx = Math.max(0.02, Math.abs(Math.cos(fk * Math.PI))); g.save(); g.translate(x, y); g.scale(sx, 1 + 0.08 * Math.sin(fk * Math.PI)); g.translate(-x, -y);
  if (fk < 0.5) tile(g, x, y, s, it.b, it.b.assetId ? imgs(it.b.assetId) : null, p, o); else mysteryBox(g, x, y, s, p, o);
  g.restore();
}
// the chosen box shakes, its two halves swing apart and the brand rises out of a burst of light
function openBox(g, x, y, s, k, t, brand, img, p, m) {
  const C = p.colors || {}; const gold = C.gold || QB.gold;
  const shake = seg(k, 0, 0.08) * (1 - seg(k, 0.2, 0.28)); const pk = EASE.inOutCubic(seg(k, 0.24, 0.62)); const rk = seg(k, 0.3, 0.78); const burst = seg(k, 0.22, 0.5);
  if (burst > 0) {
    const bg = g.createRadialGradient(x, y, 0, x, y, s * (0.6 + 1.6 * burst)); bg.addColorStop(0, hexA('#FFFFFF', 0.75 * burst * (1 - 0.5 * rk))); bg.addColorStop(0.35, hexA(gold, 0.45 * burst)); bg.addColorStop(1, hexA(gold, 0));
    g.fillStyle = bg; g.fillRect(x - s * 2.4, y - s * 2.4, s * 4.8, s * 4.8);
    g.save(); g.translate(x, y); g.rotate(t * 0.5); for (let i = 0; i < 16; i++) { g.rotate(TAU / 16); const L = s * (1.1 + 1.2 * burst) * (i % 2 ? 0.75 : 1); const lg = g.createLinearGradient(0, 0, 0, -L); lg.addColorStop(0, hexA(gold, 0.45 * burst)); lg.addColorStop(1, hexA(gold, 0)); g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.lineTo(-s * 0.07, -L); g.lineTo(s * 0.07, -L); g.fill(); } g.restore();
    for (let i = 0; i < 26; i++) { const a = hash(i + 40) * TAU; const d = s * (0.4 + burst * (0.9 + hash(i + 7) * 1.1)); g.fillStyle = hexA(i % 3 ? gold : '#FFFFFF', 0.9 * (1 - seg(k, 0.6, 1))); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, m * (0.003 + hash(i + 3) * 0.004), 0, TAU); g.fill(); }
  }
  if (rk > 0) { const sc = lerp(0.45, 1, EASE.outBack(rk)); tile(g, x, y - s * 0.04 * (1 - rk), s * sc, brand, img, Object.assign({}, p, { tile: 'white' }), { alpha: clamp(rk * 2.2), glow: 1 - 0.5 * seg(k, 0.8, 1) }); }
  const pre = seg(k, 0, 0.2) * (1 - seg(k, 0.3, 0.5)); if (pre > 0) { const gl = g.createRadialGradient(x, y, s * 0.2, x, y, s * 1.5); gl.addColorStop(0, hexA(gold, 0.6 * pre)); gl.addColorStop(1, hexA(gold, 0)); g.fillStyle = gl; g.beginPath(); g.arc(x, y, s * 1.5, 0, TAU); g.fill(); }
  if (pk < 1) {
    const a = 1 - seg(k, 0.5, 0.66); const rot = shake * 0.07 * Math.sin(k * 140);
    g.save(); g.translate(x, y); g.rotate(rot); g.translate(-x, -y);
    for (const side of [-1, 1]) {
      g.save(); const ex = x + side * (s / 2 + pk * s * 0.45); g.translate(ex, y + pk * s * 0.15); g.rotate(side * pk * 0.5); g.scale(Math.max(0.03, 1 - pk * 0.8), 1);
      g.beginPath(); if (side < 0) g.rect(0, -s, s / 2 + 1, s * 2); else g.rect(-s / 2 - 1, -s, s / 2 + 1, s * 2); g.clip();
      mysteryBox(g, -side * s / 2, 0, s, p, { alpha: a, glow: 0, pulse: 0 }); g.restore();
    }
    g.restore();
  }
}
function orbitPath(g, cx, cy, rx, ry, from, to, steps = 140) { g.beginPath(); for (let i = 0; i <= steps; i++) { const a = from + (to - from) * i / steps; const X = cx + Math.cos(a) * rx, Y = cy + Math.sin(a) * ry; i ? g.lineTo(X, Y) : g.moveTo(X, Y); } }

function reviewCard(g, W, H, p, brand, imgs, t, d) {
  const C = p.colors || {}; const m = Math.min(W, H); const land = W > H;
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, mix(C.bg || QB.navy, '#1A3D86', 0.5)); gr.addColorStop(1, mix(C.bg || QB.navy, '#000000', 0.4)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.save(); g.strokeStyle = hexA(C.blue || QB.blue, 0.08); g.lineWidth = 1; const step = m / 18; for (let x = 0; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.restore();
  const k1 = EASE.outCubic(seg(t, 0.15, 0.85)), k2 = EASE.outCubic(seg(t, 0.45, 1.15)), k3 = EASE.outCubic(seg(t, 0.75, 1.45)), k4 = EASE.outCubic(seg(t, 1.0, 1.8));
  const logoImg = brand.assetId ? imgs(brand.assetId) : null; const prod = p.review && p.review.productAssetId ? imgs(p.review.productAssetId) : null;
  const title = (p.review && p.review.title) || 'Product Review';
  const sub = (p.review && p.review.subtitle) || '';
  // layout: portrait stacks logo, product, title; landscape puts text left and product right
  const tx = land ? W * 0.08 : W / 2, align = land ? 'left' : 'center';
  const logoBox = m * 0.2; const ly = land ? H * 0.2 : H * 0.16;
  g.save(); g.globalAlpha = k1; g.translate(0, (1 - k1) * m * 0.04);
  if (logoImg) { g.fillStyle = '#FFFFFF'; const bw = logoBox * 1.6, bh = logoBox * 0.75; const bx = land ? tx : tx - bw / 2; roundRect(g, bx, ly, bw, bh, bh * 0.2); g.fill(); drawImageContain(g, logoImg, bx + bh * 0.15, ly + bh * 0.15, bw - bh * 0.3, bh * 0.7); }
  else { const fs = fitFont(g, brand.name || '', 900, m * 0.1, TECH, land ? W * 0.45 : W * 0.85); g.fillStyle = '#FFFFFF'; g.textAlign = align; g.textBaseline = 'top'; g.shadowColor = hexA(C.blue || QB.blue, 0.8); g.shadowBlur = m * 0.03; g.fillText(brand.name || '', tx, ly); }
  g.restore();
  // product image or a glowing placeholder stage
  const pw = land ? W * 0.42 : W * 0.78, ph = land ? H * 0.6 : H * 0.34; const px = land ? W * 0.53 : (W - pw) / 2, py = land ? H * 0.2 : H * 0.31;
  g.save(); g.globalAlpha = k2; const sc = lerp(0.92, 1, k2); g.translate(px + pw / 2, py + ph / 2); g.scale(sc, sc); g.translate(-(px + pw / 2), -(py + ph / 2));
  const st = g.createRadialGradient(px + pw / 2, py + ph * 0.7, 10, px + pw / 2, py + ph * 0.6, pw * 0.6); st.addColorStop(0, hexA(C.gold || QB.gold, 0.25)); st.addColorStop(1, hexA(C.gold || QB.gold, 0)); g.fillStyle = st; g.fillRect(0, 0, W, H);
  g.strokeStyle = hexA(C.gold || QB.gold, 0.7); g.lineWidth = Math.max(1.5, m * 0.003); g.beginPath(); g.ellipse(px + pw / 2, py + ph * 0.92, pw * 0.38, ph * 0.07, 0, 0, TAU); g.stroke();
  if (prod) { g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = m * 0.04; g.shadowOffsetY = m * 0.015; drawImageContain(g, prod, px + pw * 0.08, py, pw * 0.84, ph * 0.86); }
  g.restore();
  // title + subtitle + gold rule
  const ty = land ? H * 0.5 : H * 0.72; const maxW = land ? W * 0.42 : W * 0.86;
  g.save(); g.globalAlpha = k3; g.translate(0, (1 - k3) * m * 0.03); const fs = fitFont(g, title, 800, m * (land ? 0.085 : 0.075), HEAD, maxW, 12);
  g.fillStyle = '#FFFFFF'; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(title, tx, ty); g.restore();
  const rw = maxW * 0.35 * k4; g.fillStyle = C.gold || QB.gold; g.fillRect(land ? tx : tx - rw / 2, ty + m * 0.03, rw, Math.max(3, m * 0.006));
  if (sub) { g.save(); g.globalAlpha = k4; const ss = fitFont(g, sub.toUpperCase(), 600, m * 0.032, HEAD, maxW, 10); g.fillStyle = C.gold || QB.gold; g.textAlign = align; g.textBaseline = 'top'; g.fillText(sub.toUpperCase(), tx, ty + m * 0.06); g.restore(); }
}

// main entry: draws the roulette at local time t (seconds since the layer starts)
export function drawRoulette(g, W, H, t, p, imgs) {
  const S = stageTimes(p); const set = orbitSet(p); const m = Math.min(W, H); const C = p.colors || {};
  const gold = C.gold || QB.gold, blue = C.blue || QB.blue;
  const cx = W / 2, cy = H / 2; const rx = m * (p.orbitRadius || 34) / 100 * (W > H ? 1.35 : 1); const ry = rx * Math.cos((p.tilt || 60) * Math.PI / 180);
  const tileS = m * (p.logoSize || 9) / 100; const cSize = m * (p.centerSize || 10) / 100 * 1.4;
  const sel = set.list[set.sel] || { name: '' };
  const opening = !!p.mystery && S.openDur.d > 0 && t >= S.openDur.a;

  if (t >= S.reviewDur.a && S.reviewDur.d > 0) {
    const lt = t - S.reviewDur.a; reviewCard(g, W, H, p, sel, imgs, lt, S.reviewDur.d);
    const fl = 1 - seg(lt, 0, 0.45); if (fl > 0) { g.fillStyle = hexA('#FFFFFF', 0.85 * fl); g.fillRect(0, 0, W, H); }
    vignette(g, W, H); return;
  }
  background(g, W, H, p, t);
  // camera (stage 7)
  const zk = p.zoomEffect !== false && S.zoomDur.d > 0 ? EASE.inOutCubic(seg(t, S.zoomDur.a, S.zoomDur.b)) : 0;
  const base = orbitAngle(p, t, S, set);
  const items = set.list.map((b, i) => { const a = base + i * TAU / set.n; const d = Math.sin(a); return { b, i, a, d, x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }; });
  const selItem = items[set.sel];
  g.save();
  if (zk > 0 && selItem) {
    const fill = (p.zoomFill || 70) / 100; const target = Math.min(W, H) * fill; const z = lerp(1, target / (tileS * 1.5 * 1.12), zk);
    g.translate(cx, cy); g.scale(z, z); g.translate(-lerp(cx, selItem.x, zk), -lerp(cy, selItem.y, zk));
  }
  // stage 2: orbit lines
  const ok = EASE.outCubic(seg(t, S.orbitDur.a, S.orbitDur.b)); const fadeOthers = 1 - zk;
  if (ok > 0) {
    g.save(); g.lineCap = 'round';
    [[gold, 1, 0], [blue, 1.08, Math.PI]].forEach(([col, sc, ph], j) => {
      const from = -Math.PI / 2 + ph, to = from + TAU * ok;
      g.globalAlpha = fadeOthers; g.strokeStyle = hexA(col, 0.25); g.lineWidth = m * 0.012; orbitPath(g, cx, cy, rx * sc, ry * sc, from, to); g.stroke();
      g.strokeStyle = hexA(col, 0.95); g.lineWidth = m * 0.0035; g.shadowColor = col; g.shadowBlur = m * 0.02; orbitPath(g, cx, cy, rx * sc, ry * sc, from, to); g.stroke(); g.shadowBlur = 0;
      if (ok < 1) { const a = to; g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(cx + Math.cos(a) * rx * sc, cy + Math.sin(a) * ry * sc, m * 0.006, 0, TAU); g.fill(); }
      // travelling light dots
      for (let q = 0; q < 3; q++) { const a = from + ((t * (0.25 + j * 0.1) + q / 3) % 1) * TAU; if (a > to) continue; g.fillStyle = hexA(col, 0.9); g.beginPath(); g.arc(cx + Math.cos(a) * rx * sc, cy + Math.sin(a) * ry * sc, m * 0.004, 0, TAU); g.fill(); }
    });
    g.restore();
  }
  // focus pointer at the front of the orbit
  const pk = seg(t, S.spinDur.a - 0.4, S.spinDur.a) * (1 - seg(t, S.highlightDur.b - 0.2, S.highlightDur.b)) * fadeOthers;
  if (pk > 0) { const fx = cx, fy = cy + ry + tileS * 0.95; g.save(); g.globalAlpha = pk; g.fillStyle = gold; g.shadowColor = gold; g.shadowBlur = m * 0.02; g.beginPath(); g.moveTo(fx, fy - tileS * 0.22); g.lineTo(fx - tileS * 0.16, fy + tileS * 0.06); g.lineTo(fx + tileS * 0.16, fy + tileS * 0.06); g.closePath(); g.fill(); g.restore(); }
  // stage 3–6: tiles, back half first, then the center logo, then the front half
  const appear = i => EASE.outBack(seg(t, S.appearDur.a + (i / set.n) * S.appearDur.d * 0.75, S.appearDur.a + (i / set.n) * S.appearDur.d * 0.75 + S.appearDur.d * 0.3));
  const hk = seg(t, S.highlightDur.a, S.highlightDur.a + Math.min(0.6, S.highlightDur.d * 0.6));
  // angular speed for motion trails
  const dt = 1 / 60; const speed = Math.abs(orbitAngle(p, t + dt, S, set) - base) / dt;
  const drawItem = it => {
    const ap = appear(it.i); if (ap <= 0) return;
    const depth = (it.d + 1) / 2; let s = tileS * lerp(0.62, 1.12, depth) * ap; let alpha = lerp(0.45, 1, depth) * clamp(ap * 1.5);
    const isSel = it.i === set.sel; let glow = 0;
    if (hk > 0) { if (isSel) { s *= lerp(1, 1.5, EASE.outBack(hk)); glow = hk * (0.8 + 0.2 * Math.sin(t * 8)); } else alpha *= lerp(1, 0.28, hk); }
    if (!isSel) alpha *= fadeOthers;
    if (speed > 2.5 && alpha > 0.05) { const dir = p.direction === 'ccw' ? -1 : 1; for (let k = 3; k >= 1; k--) { const a = it.a - dir * k * 0.045 * Math.min(speed, 12) / 6; itemFace(g, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, s, it, imgs, p, S, set, t, { alpha: alpha * 0.12 * (4 - k) / 3, glow: 0 }); } }
    if (isSel && opening) return;
    itemFace(g, it.x, it.y, s, it, imgs, p, S, set, t, { alpha, glow, pulse: isSel ? hk * Math.sin(t * 9) : 0 });
  };
  const sorted = items.slice().sort((a, b) => a.d - b.d);
  sorted.filter(it => it.d < 0).forEach(drawItem);
  // stage 1: center logo with cinematic glow
  const ck = EASE.outCubic(seg(t, 0, S.openingDur.d * 0.8)); const cScale = lerp(0.55, 1, EASE.outBack(seg(t, 0, S.openingDur.d * 0.9)));
  const flare = seg(t, S.openingDur.d * 0.25, S.openingDur.d); if (flare > 0 && flare < 1) { const fxp = lerp(cx - m * 0.45, cx + m * 0.45, EASE.inOutCubic(flare)); const fa = Math.sin(flare * Math.PI) * fadeOthers; g.save(); g.translate(fxp, cy); g.scale(1, 0.12); const fg = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.32); fg.addColorStop(0, hexA('#FFFFFF', 0.55 * fa)); fg.addColorStop(0.4, hexA(gold, 0.18 * fa)); fg.addColorStop(1, hexA(gold, 0)); g.fillStyle = fg; g.beginPath(); g.arc(0, 0, m * 0.32, 0, TAU); g.fill(); g.restore(); }
  g.save(); g.translate(cx, cy); g.scale(cScale, cScale); g.translate(-cx, -cy);
  centerLogo(g, cx, cy, cSize, p, p.centerAssetId ? imgs(p.centerAssetId) : null, 0.6 + 0.4 * Math.sin(t * 2.2) * 0.5 + (1 - seg(t, 0, S.openingDur.d)) * 0.6, ck * fadeOthers * fadeOthers);
  g.restore();
  sorted.filter(it => it.d >= 0).forEach(drawItem);
  // highlight light rays from the selected brand
  if (hk > 0 && selItem) { g.save(); g.translate(selItem.x, selItem.y); g.rotate(t * 0.6); for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); const lg = g.createLinearGradient(0, 0, 0, -tileS * 2.4); lg.addColorStop(0, hexA(gold, 0.3 * hk)); lg.addColorStop(1, hexA(gold, 0)); g.fillStyle = lg; g.beginPath(); g.moveTo(0, 0); g.lineTo(-tileS * 0.12, -tileS * 2.4); g.lineTo(tileS * 0.12, -tileS * 2.4); g.fill(); } g.restore();
    const it = selItem; const s = tileS * lerp(0.62, 1.12, (it.d + 1) / 2) * lerp(1, 1.5, EASE.outBack(hk)); if (!opening) itemFace(g, it.x, it.y, s, it, imgs, p, S, set, t, { alpha: 1, glow: hk, pulse: Math.sin(t * 9) }); }
  g.restore();
  // stage 8 (mystery mode): the chosen box opens in front of the camera and shows the brand
  if (opening && selItem) {
    const ok2 = seg(t, S.openDur.a, S.openDur.b); const sBase = tileS * lerp(0.62, 1.12, (selItem.d + 1) / 2) * 1.5;
    const zoomed = p.zoomEffect !== false && S.zoomDur.d > 0; const size = zoomed ? Math.min(W, H) * (p.zoomFill || 70) / 100 / 1.12 * lerp(0.62, 1.12, (selItem.d + 1) / 2) : sBase;
    const ox = zoomed ? cx : selItem.x, oy = zoomed ? cy : selItem.y;
    openBox(g, ox, oy, size, ok2, t, sel, sel.assetId ? imgs(sel.assetId) : null, p, m);
    const nk2 = seg(ok2, 0.6, 0.9); if (nk2 > 0 && sel.name) { g.save(); g.globalAlpha = nk2; g.translate(0, (1 - EASE.outCubic(nk2)) * m * 0.03); const fs = fitFont(g, sel.name.toUpperCase(), 900, m * 0.06, TECH, W * 0.84); g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'top'; g.shadowColor = gold; g.shadowBlur = m * 0.03; g.fillText(sel.name.toUpperCase(), cx, Math.min(oy + size * 0.6, H - fs * 1.6)); g.restore(); }
  }
  // selected brand name under the highlight
  const nk = p.mystery ? 0 : seg(t, S.highlightDur.a + 0.2, S.highlightDur.a + 0.7) * (1 - zk);
  if (nk > 0 && sel.name) { g.save(); g.globalAlpha = nk; const fs = fitFont(g, sel.name.toUpperCase(), 900, m * 0.055, TECH, W * 0.8); g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'top'; g.shadowColor = gold; g.shadowBlur = m * 0.03; g.fillText(sel.name.toUpperCase(), cx, cy + ry + tileS * 1.5); g.restore(); }
  vignette(g, W, H);
  // fade to white right before the review card
  const wf = seg(t, S.reviewDur.a - 0.25, S.reviewDur.a); if (wf > 0 && S.reviewDur.d > 0) { g.fillStyle = hexA('#FFFFFF', 0.85 * wf); g.fillRect(0, 0, W, H); }
}

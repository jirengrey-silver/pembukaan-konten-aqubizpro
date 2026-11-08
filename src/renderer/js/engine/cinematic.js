// QBizPro Cinematic Brand Roulette Animation
// Six-scene motion piece driven by editable keyframe tracks:
//   1 Logo Reveal · 2 Orbit Activation · 3 Brand Roulette · 4 Brand Selection · 5 Brand Zoom In · 6 Product Review Transition
// Keyframes are stored relative to their scene ({ s: sceneId, u: 0..1 }), so changing a scene's length retimes its keys.
// The roulette angle is derived from the "spin.progress" track and is solved so the chosen brand always lands at the focus point.
import { clamp, lerp, hash, hexA, mix, QB, uid } from './util.js';
import { DEFAULT_BRANDS } from './roulette.js';

const TAU = Math.PI * 2; const FOCUS = Math.PI / 2; // front of the orbit, closest to the camera

export const CINE_SCENES = [
  ['logo', 'Logo Reveal', 2], ['orbit', 'Orbit Activation', 2], ['roulette', 'Brand Roulette', 3],
  ['select', 'Brand Selection', 2], ['zoom', 'Brand Zoom In', 2], ['review', 'Product Review Transition', 1]
];

/* ---------- easing ---------- */
const smooth = x => x * x * (3 - 2 * x);
const tables = new Map();
// roulette easing: smooth acceleration, cruise, long smooth deceleration (velocity is continuous and ends at 0)
function rouletteTable(acc, dec) {
  const key = acc.toFixed(3) + '|' + dec.toFixed(3); if (tables.has(key)) return tables.get(key);
  const N = 2048; const v = x => (x < acc ? smooth(x / acc) : x > 1 - dec ? Math.pow(1 - smooth((x - (1 - dec)) / dec), 1.35) : 1);
  const tab = new Float64Array(N + 1); let s = 0; for (let i = 1; i <= N; i++) { s += (v((i - 0.5) / N)) / N; tab[i] = s; } for (let i = 0; i <= N; i++) tab[i] /= s;
  tables.set(key, tab); return tab;
}
function fromTable(tab, x) { x = clamp(x); const f = x * (tab.length - 1); const i = Math.floor(f); return i >= tab.length - 1 ? 1 : lerp(tab[i], tab[i + 1], f - i); }
export const EASINGS = {
  linear: ['Linear', x => x],
  inSine: ['Ease in (lembut)', x => 1 - Math.cos(x * Math.PI / 2)], outSine: ['Ease out (lembut)', x => Math.sin(x * Math.PI / 2)], inOutSine: ['Ease in-out (lembut)', x => -(Math.cos(Math.PI * x) - 1) / 2],
  inCubic: ['Ease in', x => x * x * x], outCubic: ['Ease out', x => 1 - Math.pow(1 - x, 3)], inOutCubic: ['Ease in-out', x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)],
  inQuint: ['Ease in (kuat)', x => x ** 5], outQuint: ['Ease out (kuat)', x => 1 - Math.pow(1 - x, 5)], inOutQuint: ['Ease in-out (kuat)', x => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2)],
  outBounce: ['Jatuh memantul', x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; }],
  outBack: ['Pantul keluar', x => { const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }],
  roulette: ['Roulette (akselerasi → deselerasi)', null], hold: ['Tahan (lompat)', x => (x >= 1 ? 1 : 0)]
};
function ease(name, x, p) { if (name === 'roulette') return fromTable(rouletteTable(clamp((p.spin.accel || 25) / 100, 0.05, 0.6), clamp((p.spin.decel || 55) / 100, 0.1, 0.9)), x); const e = EASINGS[name] || EASINGS.linear; return e[1](clamp(x)); }

/* ---------- animatable properties ---------- */
export const CINE_PROPS = [
  ['camera.zoom', 'Kamera · zoom', 'Kamera', 1, 0.2, 8, 0.01], ['camera.focus', 'Kamera · fokus ke brand terpilih', 'Kamera', 0, 0, 1, 0.01],
  ['camera.panX', 'Kamera · geser X (%)', 'Kamera', 0, -50, 50, 0.1], ['camera.panY', 'Kamera · geser Y (%)', 'Kamera', 0, -50, 50, 0.1], ['camera.roll', 'Kamera · rotasi (°)', 'Kamera', 0, -45, 45, 0.1],
  ['logo.opacity', 'Logo QBizPro · opasitas', 'Logo', 1, 0, 1, 0.01], ['logo.scale', 'Logo QBizPro · skala', 'Logo', 1, 0, 4, 0.01], ['logo.rotY', 'Logo QBizPro · putar 3D (°)', 'Logo', 0, -180, 180, 1], ['logo.glow', 'Logo QBizPro · cahaya', 'Logo', 0.5, 0, 2, 0.01], ['logo.dropY', 'Logo QBizPro · jatuh dari atas (% tinggi)', 'Logo', 0, -120, 20, 0.5], ['fx.impact', 'Efek · hentakan logo mendarat', 'Efek', 0, 0, 1.5, 0.01],
  ['orbit.ring', 'Orbit · garis tergambar', 'Orbit', 1, 0, 1, 0.01], ['orbit.radius', 'Orbit · skala radius', 'Orbit', 1, 0.2, 2, 0.01], ['orbit.tilt', 'Orbit · kemiringan 3D (°)', 'Orbit', 64, 0, 89, 0.5],
  ['orbit.brands', 'Orbit · brand muncul', 'Orbit', 1, 0, 1, 0.01], ['orbit.opacity', 'Orbit · opasitas', 'Orbit', 1, 0, 1, 0.01],
  ['spin.progress', 'Roulette · progres putaran', 'Roulette', 0, 0, 1, 0.001],
  ['fx.flare', 'Efek · lens flare', 'Efek', 0, 0, 1.5, 0.01], ['fx.highlight', 'Efek · sorot brand terpilih', 'Efek', 0, 0, 1.5, 0.01], ['fx.rays', 'Efek · sinar cahaya', 'Efek', 0, 0, 1.5, 0.01],
  ['fx.magic', 'Efek · sihir brand → kotak emas', 'Efek', 0, 0, 1, 0.01], ['fx.crack', 'Efek · kotak bergetar, retak, pecah', 'Efek', 0, 0, 1, 0.01], ['fx.flash', 'Efek · kilatan putih', 'Efek', 0, 0, 1, 0.01], ['showcase.progress', 'Transisi ke product showcase', 'Showcase', 0, 0, 1, 0.01]
].map(([key, label, group, def, min, max, step]) => ({ key, label, group, def, min, max, step }));
export const propOf = k => CINE_PROPS.find(p => p.key === k);

const K = (s, u, v, e = 'inOutSine') => ({ id: uid(), s, u, v, e });
export function defaultTracks() {
  return {
    'camera.zoom': [K('logo', 0, 1.06, 'inOutSine'), K('orbit', 1, 1, 'linear'), K('select', 0.2, 1, 'inOutSine'), K('select', 1, 1.08, 'linear')],
    'camera.focus': [K('select', 0.35, 0, 'inOutSine'), K('select', 1, 0.1, 'inOutCubic'), K('zoom', 0.42, 1, 'linear')],
    'camera.panX': [K('logo', 0, 0, 'linear')], 'camera.panY': [K('logo', 0, 0, 'linear')],
    'camera.roll': [K('zoom', 0, 0, 'inOutSine'), K('zoom', 0.35, 2, 'inOutSine'), K('zoom', 0.6, 0, 'linear')],
    'logo.dropY': [K('logo', 0, -72, 'outBounce'), K('logo', 0.55, 0, 'linear')],
    'logo.opacity': [K('logo', 0, 1, 'linear')],
    'logo.scale': [K('logo', 0, 1, 'linear')],
    'logo.rotY': [K('logo', 0, 0, 'linear')],
    'logo.glow': [K('logo', 0, 0.2, 'linear'), K('logo', 0.2, 0.2, 'outCubic'), K('logo', 0.4, 1.3, 'inOutSine'), K('orbit', 0.4, 0.55, 'linear'), K('select', 0.3, 0.55, 'inOutSine'), K('select', 0.7, 0.25, 'linear')],
    'fx.impact': [K('logo', 0.19, 0, 'linear'), K('logo', 0.2, 1, 'outCubic'), K('logo', 0.75, 0, 'linear')],
    'orbit.ring': [K('orbit', 0, 0, 'inOutCubic'), K('orbit', 0.6, 1, 'linear')],
    'orbit.radius': [K('orbit', 0, 0.72, 'outCubic'), K('orbit', 0.6, 1, 'linear')],
    'orbit.tilt': [K('orbit', 0, 84, 'outCubic'), K('orbit', 0.6, 58, 'linear')],
    'orbit.brands': [K('logo', 0.85, 0, 'linear'), K('orbit', 0.4, 1, 'linear')],
    'orbit.opacity': [K('zoom', 0, 1, 'inOutSine'), K('zoom', 0.38, 0, 'linear')],
    'fx.magic': [K('orbit', 0.45, 0, 'linear'), K('roulette', 0.12, 1, 'linear')],
    'spin.progress': [K('roulette', 0.12, 0, 'roulette'), K('select', 0.3, 1, 'linear')],
    'fx.flare': [K('logo', 0.19, 0, 'outCubic'), K('logo', 0.3, 1, 'inOutSine'), K('logo', 0.8, 0, 'linear')],
    'fx.highlight': [K('select', 0.25, 0, 'outBack'), K('select', 0.6, 1, 'linear')],
    'fx.rays': [K('select', 0.3, 0, 'outCubic'), K('select', 0.75, 1, 'inOutSine'), K('zoom', 0.4, 0.45, 'inOutSine'), K('zoom', 0.7, 0, 'linear')],
    'fx.crack': [K('zoom', 0.4, 0, 'inSine'), K('zoom', 1, 1, 'linear')],
    'fx.flash': [K('zoom', 0.84, 0, 'outCubic'), K('zoom', 0.88, 0.45, 'outCubic'), K('review', 0.3, 0, 'linear')],
    'showcase.progress': [K('review', 0, 0, 'inOutCubic'), K('review', 1, 1, 'linear')]
  };
}
export function defaultCinematic() {
  return {
    kind: 'cinematic', version: 1,
    scenes: CINE_SCENES.map(([id, label, dur]) => ({ id, label, dur })),
    brands: DEFAULT_BRANDS.slice(0, 12).map(name => ({ id: uid(), name, assetId: null })),
    count: 12, selection: 'random', selectedId: null, seed: 11,
    centerAssetId: null, logoSize: 10, centerX: 50, centerY: 46,
    orbit: { radius: 42, brandSize: 9, depthNear: 1.15, depthFar: 0.58, depthFade: 0.45, direction: 'cw', idleSpeed: 22, ringWidth: 1 },
    spin: { rotations: 5, accel: 25, decel: 55, motionBlur: 0.8 },
    camera: { fill: 62 },
    fx: { particles: true, floor: true, vignette: true, bloom: 1, showName: true, rings: false, smoke: true },
    colors: { bg: QB.navy, gold: QB.gold, blue: QB.blue },
    showcase: { title: 'Product Review', subtitle: '', productAssetId: null },
    tracks: defaultTracks()
  };
}

/* ---------- time ---------- */
export function cineSceneTimes(p) { const out = {}; let t = 0; for (const sc of p.scenes) { const d = Math.max(0, +sc.dur || 0); out[sc.id] = { a: t, b: t + d, d, label: sc.label }; t += d; } out.total = t; return out; }
export const cineDuration = p => cineSceneTimes(p).total;
export function keyTime(S, k) { const sc = S[k.s]; return sc ? sc.a + clamp(k.u) * sc.d : 0; }
// converts an absolute time back to scene-relative coordinates
export function toSceneRel(p, t) { const S = cineSceneTimes(p); let last = p.scenes[0].id; for (const sc of p.scenes) { const s = S[sc.id]; if (t < s.b || sc === p.scenes[p.scenes.length - 1]) { return { s: sc.id, u: s.d > 0 ? clamp((t - s.a) / s.d) : 0 }; } last = sc.id; } return { s: last, u: 1 }; }
export function sortedKeys(p, prop) { const S = cineSceneTimes(p); return (p.tracks[prop] || []).map(k => ({ k, t: keyTime(S, k) })).sort((a, b) => a.t - b.t); }
export function evalProp(p, prop, t, S) {
  S = S || cineSceneTimes(p); const list = p.tracks[prop]; const def = propOf(prop).def;
  if (!list || !list.length) return def;
  const ks = list.map(k => ({ k, t: keyTime(S, k) })).sort((a, b) => a.t - b.t);
  if (t <= ks[0].t) return ks[0].k.v; const last = ks[ks.length - 1]; if (t >= last.t) return last.k.v;
  for (let i = 0; i < ks.length - 1; i++) { const A = ks[i], B = ks[i + 1]; if (t < B.t) { const x = B.t > A.t ? (t - A.t) / (B.t - A.t) : 1; return lerp(A.k.v, B.k.v, ease(A.k.e, x, p)); } }
  return last.k.v;
}
export function cineValues(p, t) { const S = cineSceneTimes(p); const v = {}; for (const pr of CINE_PROPS) v[pr.key] = evalProp(p, pr.key, t, S); return v; }

/* ---------- brands & spin ---------- */
export function cineSet(p) {
  const all = (p.brands || []).filter(b => b && (b.assetId || b.name)); const n = Math.max(3, Math.min(all.length, Math.round(p.count) || 12));
  const list = all.slice(0, n); let sel = -1;
  if (p.selection === 'manual' && p.selectedId) { sel = list.findIndex(b => b.id === p.selectedId); if (sel < 0) { const b = all.find(x => x.id === p.selectedId); if (b) { list[list.length - 1] = b; sel = list.length - 1; } } }
  if (sel < 0) sel = Math.floor(hash((p.seed || 1) * 7.31) * list.length) % Math.max(1, list.length);
  return { list, sel, n: list.length };
}
// angle of brand 0. idle drift fades out as spin progress rises; the total spin is solved so the chosen brand ends at FOCUS.
function spinEnd(p, S) { const ks = sortedKeys(p, 'spin.progress'); return ks.length ? ks[ks.length - 1].t : 0; }
function idleIntegral(p, S, t) { const N = Math.max(8, Math.ceil(t * 240)); let s = 0; const h = t / N; for (let i = 0; i < N; i++) s += 1 - clamp(evalProp(p, 'spin.progress', (i + 0.5) * h, S)); return s * h; }
export function cineAngle(p, t, S, set) {
  S = S || cineSceneTimes(p); set = set || cineSet(p);
  const dir = p.orbit.direction === 'ccw' ? -1 : 1; const idle = (p.orbit.idleSpeed || 0) * Math.PI / 180 * dir; const A0 = -Math.PI / 2;
  const tE = spinEnd(p, S); const J = idleIntegral(p, S, tE); const target = FOCUS - set.sel * TAU / set.n;
  let delta = ((target - (A0 + idle * J)) * dir) % TAU; if (delta < 0) delta += TAU;
  const total = dir * (Math.max(0, Math.round(p.spin.rotations)) * TAU + delta);
  const tt = Math.min(t, Math.max(tE, 0)); const Pend = clamp(evalProp(p, 'spin.progress', tE, S));
  if (t >= tE) return A0 + idle * J + total * Pend + (t - tE) * idle * (1 - Pend);
  return A0 + idle * idleIntegral(p, S, tt) + total * clamp(evalProp(p, 'spin.progress', tt, S));
}

/* ---------- sprites (pre-rendered so 1080×1920 @ 60 fps stays light) ---------- */
const mk = (w, h) => (globalThis.__qbzCanvas ? globalThis.__qbzCanvas(w, h) : typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h }));
const sprites = new Map(); const imgIds = new WeakMap(); let imgSeq = 0;
const imgKey = im => { if (!im) return 'none'; let k = imgIds.get(im); if (!k) { k = 'i' + (++imgSeq); imgIds.set(im, k); } return k; };
function bucket(px) { return Math.min(1024, Math.max(64, Math.pow(2, Math.ceil(Math.log2(Math.max(1, px)))))); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function contain(g, im, x, y, w, h) { const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height; if (!iw || !ih) return; const k = Math.min(w / iw, h / ih); g.drawImage(im, x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k); }
function cardSprite(img, px, gold) {
  const B = bucket(px); const key = 'c|' + imgKey(img) + '|' + B + '|' + gold; let c = sprites.get(key); if (c) return c;
  c = mk(B, B); const g = c.getContext('2d'); const r = B * 0.2; const m = B * 0.04;
  g.fillStyle = '#FFFFFF'; rr(g, m, m, B - m * 2, B - m * 2, r); g.fill();
  const sh = g.createLinearGradient(0, 0, 0, B); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(10,22,49,0.08)'); g.fillStyle = sh; rr(g, m, m, B - m * 2, B - m * 2, r); g.fill();
  g.lineWidth = B * 0.012; g.strokeStyle = 'rgba(160,178,206,0.9)'; rr(g, m, m, B - m * 2, B - m * 2, r); g.stroke();
  if (img) contain(g, img, B * 0.17, B * 0.17, B * 0.66, B * 0.66);
  else { // empty slot: dashed frame with an upload arrow, so a missing logo is obvious and never replaced by text
    g.setLineDash([B * 0.05, B * 0.035]); g.lineWidth = B * 0.022; g.strokeStyle = 'rgba(120,138,170,0.9)'; rr(g, B * 0.18, B * 0.18, B * 0.64, B * 0.64, B * 0.1); g.stroke(); g.setLineDash([]);
    g.lineWidth = B * 0.04; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = 'rgba(120,138,170,0.95)'; g.beginPath(); g.moveTo(B / 2, B * 0.62); g.lineTo(B / 2, B * 0.36); g.moveTo(B * 0.4, B * 0.46); g.lineTo(B / 2, B * 0.36); g.lineTo(B * 0.6, B * 0.46); g.moveTo(B * 0.36, B * 0.66); g.lineTo(B * 0.64, B * 0.66); g.stroke();
  }
  sprites.set(key, c); if (sprites.size > 400) sprites.delete(sprites.keys().next().value); return c;
}
function glowSprite(color) {
  const key = 'g|' + color; let c = sprites.get(key); if (c) return c; const B = 256; c = mk(B, B); const g = c.getContext('2d');
  const gr = g.createRadialGradient(B / 2, B / 2, 0, B / 2, B / 2, B / 2); gr.addColorStop(0, hexA(color, 1)); gr.addColorStop(0.35, hexA(color, 0.45)); gr.addColorStop(1, hexA(color, 0)); g.fillStyle = gr; g.fillRect(0, 0, B, B); sprites.set(key, c); return c;
}
function goldSprite(px) {
  const B = bucket(px); const key = 'gold|' + B; let c = sprites.get(key); if (c) return c;
  c = mk(B, B); const g = c.getContext('2d'); const m = B * 0.04, r = B * 0.2, w = B - m * 2;
  const gr = g.createLinearGradient(m, m, B - m, B - m); gr.addColorStop(0, '#FFF1B8'); gr.addColorStop(0.28, '#F7C451'); gr.addColorStop(0.62, '#E39B22'); gr.addColorStop(1, '#B9720F');
  g.fillStyle = gr; rr(g, m, m, w, w, r); g.fill();
  const sh = g.createLinearGradient(0, m, 0, B * 0.55); sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; rr(g, m + B * 0.05, m + B * 0.05, w - B * 0.1, B * 0.4, r * 0.7); g.fill();
  g.lineWidth = B * 0.03; g.strokeStyle = 'rgba(255,248,214,0.9)'; rr(g, m + B * 0.06, m + B * 0.06, w - B * 0.12, w - B * 0.12, r * 0.7); g.stroke();
  g.lineWidth = B * 0.022; g.strokeStyle = '#8A5409'; rr(g, m, m, w, w, r); g.stroke();
  g.font = `800 ${B * 0.6}px ${HEAD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(122,72,6,0.55)'; g.fillText('?', B / 2 + B * 0.02, B / 2 + B * 0.055);
  g.fillStyle = '#0A1631'; g.fillText('?', B / 2, B / 2 + B * 0.03);
  g.lineWidth = B * 0.012; g.strokeStyle = 'rgba(255,236,170,0.8)'; g.strokeText('?', B / 2, B / 2 + B * 0.03);
  sprites.set(key, c); return c;
}
// magic puff that turns a brand tile into a gold mystery box: flash, sparkles and drifting smoke
function magicPuff(g, p, x, y, s, k, seed) {
  if (k <= 0 || k >= 1) return; const C = p.colors; g.save();
  const fl = Math.sin(clamp((k - 0.25) / 0.35) * Math.PI); if (fl > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = fl * 0.95; const G = glowSprite(C.gold || QB.gold); g.drawImage(G, x - s * 1.6, y - s * 1.6, s * 3.2, s * 3.2); g.globalAlpha = fl * 0.7; const Wt = glowSprite('#FFFFFF'); g.drawImage(Wt, x - s * 0.8, y - s * 0.8, s * 1.6, s * 1.6); }
  // sparkles flying outward
  g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { const a = hash(seed * 13 + i) * TAU; const sp = clamp((k - 0.28) / 0.6); if (sp <= 0) continue; const d = s * (0.3 + sp * (0.9 + hash(seed + i * 3) * 0.9)); const al = (1 - sp); const r = s * (0.025 + hash(i + seed) * 0.03) * (1 - sp * 0.5);
    const X = x + Math.cos(a) * d, Y = y + Math.sin(a) * d - sp * s * 0.2; g.globalAlpha = al; g.fillStyle = i % 3 ? (C.gold || QB.gold) : '#FFFFFF'; g.beginPath(); g.moveTo(X, Y - r * 2.4); g.lineTo(X + r * 0.6, Y - r * 0.6); g.lineTo(X + r * 2.4, Y); g.lineTo(X + r * 0.6, Y + r * 0.6); g.lineTo(X, Y + r * 2.4); g.lineTo(X - r * 0.6, Y + r * 0.6); g.lineTo(X - r * 2.4, Y); g.lineTo(X - r * 0.6, Y - r * 0.6); g.closePath(); g.fill(); }
  // smoke: soft puffs that billow out, hide the swap, then drift up and thin away
  if (p.fx.smoke !== false) { g.globalCompositeOperation = 'source-over'; const SM = glowSprite('#C9CEDC'); for (let i = 0; i < 9; i++) { const a = hash(seed * 7 + i * 1.7) * TAU; const sk = clamp((k - 0.18 - hash(i + seed) * 0.08) / 0.82); if (sk <= 0) continue; const d = s * (0.12 + sk * (0.45 + hash(seed + i) * 0.4)); const r = s * (0.45 + sk * (0.55 + hash(i * 3 + seed) * 0.4));
    g.globalAlpha = Math.sin(Math.min(1, sk * 1.35) * Math.PI) * 0.62; g.drawImage(SM, x + Math.cos(a) * d - r, y + Math.sin(a) * d * 0.7 - sk * s * 0.45 - r, r * 2, r * 2); } }
  g.restore();
}
// the chosen box shakes, cracks open with light leaking out, then bursts into shards that reveal the brand
function crackShape(seed) { const N = 7; const out = []; const cx = (hash(seed) - 0.5) * 0.12, cy = (hash(seed + 1) - 0.5) * 0.12; for (let i = 0; i < N; i++) { const a = (i + 0.2 + hash(seed + i * 5) * 0.6) / N * TAU; const pts = [[cx, cy]]; for (let k = 1; k <= 5; k++) { const aa = a + (hash(seed + i * 11 + k) - 0.5) * 0.35; const R = 0.5 / Math.max(Math.abs(Math.cos(aa)), Math.abs(Math.sin(aa))); const rr2 = k === 5 ? 1.05 : k / 5; pts.push([cx + Math.cos(aa) * R * rr2, cy + Math.sin(aa) * R * rr2]); } out.push({ a, pts }); } return { cx, cy, cracks: out }; }
function crackBox(g, p, it, img, k, t, hlGlow) {
  g.globalAlpha = 1;
  const C = p.colors; const s = it.s; const x0 = it.x, y0 = it.y; const shakeAmp = clamp(k / 0.75) ** 1.6 * (k < 0.8 ? 1 : 0); const shx = Math.sin(t * 61) * s * 0.03 * shakeAmp + Math.sin(t * 23) * s * 0.012 * shakeAmp, shy = Math.cos(t * 53) * s * 0.025 * shakeAmp, rot = Math.sin(t * 47) * 0.035 * shakeAmp;
  const x = x0 + shx, y = y0 + shy; const shape = crackShape(it.i + 3); const crk = clamp((k - 0.18) / 0.58); const burst = clamp((k - 0.78) / 0.22);
  const spr = goldSprite(s * 1.0 * (it.Z || 1)); const card = cardSprite(img, s * (it.Z || 1), 0);
  if (burst > 0) { // brand card revealed behind the shards
    const e = 1 + 2.2 * Math.pow(burst - 1, 3) + 1.2 * Math.pow(burst - 1, 2); const cs = s * lerp(0.82, 1, e);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - burst * 0.6); const G = glowSprite(C.gold || QB.gold); g.drawImage(G, x0 - s * 2, y0 - s * 2, s * 4, s * 4); g.restore();
    g.save(); g.globalAlpha = clamp(burst * 3); g.drawImage(card, x0 - cs / 2, y0 - cs / 2, cs, cs); g.lineWidth = s * 0.035; g.strokeStyle = C.gold || QB.gold; rr(g, x0 - cs * 0.48, y0 - cs * 0.48, cs * 0.96, cs * 0.96, cs * 0.19); g.stroke(); g.restore();
    const cr = shape.cracks; for (let i = 0; i < cr.length; i++) { // shard i lies between crack i and crack i+1
      const A = cr[i], B = cr[(i + 1) % cr.length]; let a1 = A.a, a2 = B.a; if (a2 <= a1) a2 += TAU; const poly = [...A.pts];
      for (let q = 1; q < 6; q++) { const aa = a1 + (a2 - a1) * q / 6; const R = 0.5 / Math.max(Math.abs(Math.cos(aa)), Math.abs(Math.sin(aa))) * 1.05; poly.push([shape.cx + Math.cos(aa) * R, shape.cy + Math.sin(aa) * R]); }
      poly.push(...B.pts.slice().reverse()); const mid = (a1 + a2) / 2; const sp = s * (0.25 + burst * (1.1 + hash(i + 40) * 0.9)); const fall = burst * burst * s * 0.6;
      g.save(); g.globalAlpha = 1 - burst; g.translate(x0 + Math.cos(mid) * sp * burst, y0 + Math.sin(mid) * sp * burst + fall); g.rotate((hash(i + 7) - 0.5) * 2.4 * burst); const sc = 1 + burst * 0.25; g.scale(sc, sc);
      g.beginPath(); poly.forEach(([px2, py2], j) => (j ? g.lineTo(px2 * s, py2 * s) : g.moveTo(px2 * s, py2 * s))); g.closePath(); g.clip(); g.drawImage(spr, -s / 2, -s / 2, s, s); g.restore();
    }
    g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 26; i++) { const a = hash(i * 3.3) * TAU; const d = s * (0.4 + burst * (1.2 + hash(i) * 1.6)); g.globalAlpha = 1 - burst; g.fillStyle = i % 3 ? (C.gold || QB.gold) : '#FFFFFF'; g.beginPath(); g.arc(x0 + Math.cos(a) * d, y0 + Math.sin(a) * d, s * (0.012 + hash(i + 2) * 0.02), 0, TAU); g.fill(); } g.restore();
    return;
  }
  if (hlGlow > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(hlGlow) * 0.9; g.drawImage(glowSprite(C.gold || QB.gold), x - s * 1.25, y - s * 1.25, s * 2.5, s * 2.5); g.restore(); }
  g.save(); g.translate(x, y); g.rotate(rot); g.drawImage(spr, -s / 2, -s / 2, s, s);
  if (crk > 0) { // glowing cracks: a wide warm glow, then a dark fracture line
    g.beginPath(); g.roundRect(-s * 0.48, -s * 0.48, s * 0.96, s * 0.96, s * 0.19); g.clip(); g.lineCap = 'round'; g.lineJoin = 'round';
    const paths = shape.cracks.map((c, i) => { const L = clamp(crk * 1.25 - i * 0.04); const n = c.pts.length - 1; const f = L * n; const pts = [c.pts[0]]; for (let q = 1; q <= n; q++) { if (q <= f) pts.push(c.pts[q]); else { const fr = f - (q - 1); if (fr > 0) { const A = c.pts[q - 1], B = c.pts[q]; pts.push([lerp(A[0], B[0], fr), lerp(A[1], B[1], fr)]); } break; } } return pts; });
    for (const [w, col, al, comp] of [[0.07, C.gold || QB.gold, 0.55, 'lighter'], [0.03, '#FFF6D8', 0.9, 'lighter'], [0.012, '#3A2206', 0.9, 'source-over']]) { g.globalCompositeOperation = comp; g.globalAlpha = al * clamp(crk * 3); g.strokeStyle = col; g.lineWidth = s * w; for (const pts of paths) { g.beginPath(); pts.forEach(([a, b], j) => (j ? g.lineTo(a * s, b * s) : g.moveTo(a * s, b * s))); g.stroke(); } }
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp((crk - 0.5) * 2) * 0.6; g.drawImage(glowSprite('#FFF3CC'), -s * 0.5, -s * 0.5, s, s);
  }
  g.restore();
}
export function clearCineCache() { sprites.clear(); }

/* ---------- geometry for one frame ---------- */
export function cineFrame(p, W, H, t) {
  const S = cineSceneTimes(p); const V = cineValues(p, t); const set = cineSet(p);
  const M = Math.max(W, H), m = Math.min(W, H); const ox = W * (p.centerX ?? 50) / 100, oy = H * (p.centerY ?? 46) / 100;
  const rx = W * (p.orbit.radius || 40) / 100 * (W > H ? 0.62 : 1) * V['orbit.radius']; const ry = rx * Math.cos(clamp(V['orbit.tilt'], 0, 89.5) * Math.PI / 180);
  const tileS = M * (p.orbit.brandSize || 7) / 100; const base = cineAngle(p, t, S, set);
  const near = p.orbit.depthNear ?? 1.15, far = p.orbit.depthFar ?? 0.58;
  const items = set.list.map((b, i) => { const a = base + i * TAU / set.n; const d = (Math.sin(a) + 1) / 2; return { b, i, a, d, x: ox + Math.cos(a) * rx, y: oy + Math.sin(a) * ry, s: tileS * lerp(far, near, d) }; });
  const sel = items[set.sel]; const hl = V['fx.highlight']; if (sel) sel.s *= 1 + 0.38 * hl;
  // camera: zoom about the orbit center, sliding toward the chosen brand as focus rises (log-space zoom feels even)
  const f = clamp(V['camera.focus']); const fit = sel ? (m * (p.camera.fill || 62) / 100) / sel.s : 1; const Z = Math.exp(lerp(0, Math.log(Math.max(0.01, fit)), f)) * V['camera.zoom'];
  const px = lerp(ox, sel ? sel.x : ox, f), py = lerp(oy, sel ? sel.y : oy, f); const sx = lerp(ox, W / 2, f) + V['camera.panX'] * W / 100, sy = lerp(oy, H / 2, f) + V['camera.panY'] * H / 100;
  const roll = V['camera.roll'] * Math.PI / 180; const shake = clamp(V['fx.impact']) * m * 0.012; const shx = Math.sin(t * 83) * shake, shy = Math.cos(t * 71) * shake;
  const cam = { Z, px, py, sx, sy, roll, apply(g) { g.translate(W / 2, H / 2); g.rotate(roll); g.translate(-W / 2, -H / 2); g.translate(sx + shx, sy + shy); g.scale(Z, Z); g.translate(-px, -py); },
    toScreen(x, y) { let X = (x - px) * Z + sx + shx - W / 2, Y = (y - py) * Z + sy + shy - H / 2; const c = Math.cos(roll), s = Math.sin(roll); return [X * c - Y * s + W / 2, X * s + Y * c + H / 2]; } };
  // angular speed (rad/s) for motion blur
  const dt = 1 / 120; const speed = Math.abs(cineAngle(p, t + dt, S, set) - base) / dt;
  const dropV = (evalProp(p, 'logo.dropY', t + 1 / 120, S) - V['logo.dropY']) * 120;
  return { S, V, set, items, sel, ox, oy, rx, ry, tileS, M, m, cam, speed, H, W, dropV, logoSize: M * (p.logoSize || 10) / 100 };
}

/* ---------- drawing ---------- */
const HEAD = '"Sora", "Segoe UI", Arial, sans-serif'; const TECH = '"Orbitron", "Arial Black", sans-serif';
function fitFont(g, text, weight, size, fam, maxW, min = 8) { let s = size; g.font = `${weight} ${s}px ${fam}`; while (g.measureText(text).width > maxW && s > min) { s = Math.floor(s * 0.94); g.font = `${weight} ${s}px ${fam}`; } return s; }
function background(g, W, H, p, t, F) {
  const C = p.colors; const bg = C.bg || QB.navy; const par = 1 + (F.cam.Z - 1) * 0.04;
  const gr = g.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.5, Math.max(W, H) * 0.75 * par); gr.addColorStop(0, mix(bg, '#2B57B8', 0.42)); gr.addColorStop(0.5, bg); gr.addColorStop(1, mix(bg, '#000000', 0.6)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const intro = clamp(t / 0.3); if (intro < 1) { g.fillStyle = `rgba(0,0,0,${1 - intro})`; g.fillRect(0, 0, W, H); }
}
function floor(g, W, H, p, t, F, alpha) {
  if (!p.fx.floor || alpha <= 0) return; const hz = F.oy + F.ry * 1.9; const C = p.colors; g.save(); g.globalAlpha = alpha; g.strokeStyle = hexA(C.blue || QB.blue, 0.14); g.lineWidth = Math.max(1, W / 1000);
  const span = W * 3; for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(F.ox + i * W * 0.035, hz); g.lineTo(F.ox + i * span * 0.08, hz + H * 1.2); g.stroke(); }
  const off = (t * 0.3) % 1; for (let j = 0; j < 10; j++) { const u = (j + off) / 10; const y = hz + Math.pow(u, 2.2) * H * 1.1; g.globalAlpha = alpha * clamp(u * 3); g.beginPath(); g.moveTo(F.ox - span, y); g.lineTo(F.ox + span, y); g.stroke(); }
  g.restore();
}
function particles(g, W, H, p, t, alpha) {
  if (!p.fx.particles || alpha <= 0) return; const C = p.colors; const m = Math.min(W, H); g.save();
  for (let i = 0; i < 90; i++) { const x = (hash(i) * W * 1.4 - W * 0.2 + t * (10 + hash(i + 3) * 26) * (i % 2 ? 1 : -1) + W * 3) % (W * 1.4) - W * 0.2; const y = (hash(i + 9) * H - t * (14 + hash(i + 5) * 30) + H * 6) % H;
    const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + hash(i + 11) * 3) + i); g.globalAlpha = alpha * (0.2 + hash(i + 2) * 0.5) * tw; g.fillStyle = i % 3 ? (C.blue || QB.blue) : (C.gold || QB.gold); g.beginPath(); g.arc(x, y, m * (0.0014 + hash(i + 7) * 0.0026), 0, TAU); g.fill(); }
  g.restore();
}
function ellipsePath(g, cx, cy, rx, ry, from, to) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, from, to); }
function rings(g, p, F, t, alpha, half) {
  const k = F.V['orbit.ring']; if (k <= 0 || alpha <= 0) return; const C = p.colors; const lw = F.m * 0.0032 * (p.orbit.ringWidth || 1);
  g.save(); g.lineCap = 'round';
  [[C.gold || QB.gold, 1, 0], [C.blue || QB.blue, 1.07, Math.PI]].forEach(([col, sc, ph], j) => {
    const from = -Math.PI / 2 + ph, to = from + TAU * k; const rx = F.rx * sc, ry = F.ry * sc;
    // back half (behind the logo) or front half
    const segA = half === 'back' ? Math.PI : 0; const parts = [];
    for (let o = -2; o <= 2; o++) { const A = Math.max(from, segA + o * TAU), B = Math.min(to, segA + Math.PI + o * TAU); if (B > A) parts.push([A, B]); }
    for (const [w, a] of [[lw * 5, 0.12], [lw * 2.2, 0.35], [lw, 1]]) { g.globalAlpha = alpha * a; g.strokeStyle = col; g.lineWidth = w; for (const [A, B] of parts) { ellipsePath(g, F.ox, F.oy, rx, ry, A, B); g.stroke(); } }
    for (let q = 0; q < 4; q++) { const a = from + ((t * (0.18 + j * 0.07) + q / 4) % 1) * TAU; if (a > to) continue; const inBack = Math.sin(a) < 0; if ((half === 'back') !== inBack) continue; g.globalAlpha = alpha * 0.95; g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(F.ox + Math.cos(a) * rx, F.oy + Math.sin(a) * ry, lw * 1.6, 0, TAU); g.fill(); }
  });
  g.restore();
}
function centerLogo(g, p, F, img, t) {
  const V = F.V; const a = clamp(V['logo.opacity']) * clamp(V['orbit.opacity']); if (a <= 0) return; const C = p.colors;
  const s = F.logoSize * V['logo.scale']; const rot = V['logo.rotY'] * Math.PI / 180; const sx = Math.cos(rot);
  const gl = V['logo.glow'] * (p.fx.bloom ?? 1); if (gl > 0) { g.save(); g.globalAlpha = a * clamp(gl * 0.75); g.globalCompositeOperation = 'lighter'; const G = glowSprite(C.gold || QB.gold); g.drawImage(G, F.ox - s * 1.6, F.oy - s * 1.6, s * 3.2, s * 3.2); g.globalAlpha = a * clamp(gl * 0.4); g.drawImage(glowSprite(C.blue || QB.blue), F.ox - s * 2.4, F.oy - s * 2.4, s * 4.8, s * 4.8); g.restore(); }
  const ly = F.oy + V['logo.dropY'] * F.H / 100; const vy = F.dropV; const imp = clamp(V['fx.impact']);
  // falling trail and landing shockwave
  if (Math.abs(vy) > 0.4) { for (let k = 1; k <= 4; k++) { g.save(); g.globalAlpha = a * 0.13 * (5 - k) / 4; g.translate(F.ox, ly - vy * k * 0.012 * F.H / 100); if (img) contain(g, img, -s / 2, -s / 2, s, s); g.restore(); } }
  if (imp > 0) { const r = s * (0.6 + (1 - imp) * 2.6); g.save(); g.globalAlpha = imp * 0.8; g.strokeStyle = C.gold || QB.gold; g.lineWidth = s * 0.05 * imp; g.beginPath(); g.ellipse(F.ox, ly + s * 0.42, r, r * 0.22, 0, 0, TAU); g.stroke(); g.globalAlpha = imp * 0.45; g.strokeStyle = '#FFFFFF'; g.lineWidth = s * 0.02; g.beginPath(); g.ellipse(F.ox, ly + s * 0.42, r * 0.8, r * 0.18, 0, 0, TAU); g.stroke();
    const G = glowSprite('#D9DEEA'); for (let i = 0; i < 14; i++) { const side = i % 2 ? 1 : -1; const d = s * (0.35 + (1 - imp) * (1.1 + hash(i + 5) * 1.4)); const pr = s * (0.18 + (1 - imp) * 0.35 * (0.6 + hash(i))); g.globalAlpha = imp * 0.35; g.drawImage(G, F.ox + side * d * (0.5 + hash(i + 2) * 0.5) - pr, ly + s * 0.38 - (1 - imp) * s * 0.25 * hash(i + 9) - pr * 0.5, pr * 2, pr); } g.restore(); }
  const squash = imp > 0.6 ? (imp - 0.6) * 0.25 : 0;
  g.save(); g.globalAlpha = a; g.translate(F.ox, ly + s * squash * 0.5); g.scale(Math.max(0.02, Math.abs(sx)) * (1 + squash), (1 + 0.06 * Math.abs(Math.sin(rot))) * (1 - squash));
  if (img) contain(g, img, -s / 2, -s / 2, s, s);
  else { g.setLineDash([s * 0.08, s * 0.06]); g.lineWidth = s * 0.03; g.strokeStyle = hexA('#FFFFFF', 0.6); g.beginPath(); g.arc(0, 0, s * 0.45, 0, TAU); g.stroke(); g.setLineDash([]); g.lineWidth = s * 0.05; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, s * 0.18); g.lineTo(0, -s * 0.16); g.moveTo(-s * 0.12, -s * 0.04); g.lineTo(0, -s * 0.16); g.lineTo(s * 0.12, -s * 0.04); g.stroke(); }
  // specular sweep while the logo turns
  const sw = Math.abs(Math.sin(rot)); if (sw > 0.02) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * sw * 0.5; const lg = g.createLinearGradient(-s / 2, 0, s / 2, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(-s / 2, -s / 2, s, s); }
  g.restore();
}
function flare(g, W, H, p, F, k) {
  if (k <= 0) return; const C = p.colors; const [x, y] = F.cam.toScreen(F.ox, F.oy); const m = F.m; g.save(); g.globalCompositeOperation = 'lighter';
  g.globalAlpha = clamp(k) * 0.9; g.translate(x, y); g.scale(1, 0.035); g.drawImage(glowSprite('#FFFFFF'), -W * 0.75 * k, -m * 0.5, W * 1.5 * k, m);
  g.restore(); g.save(); g.globalCompositeOperation = 'lighter';
  const G = glowSprite(C.gold || QB.gold); [[-0.32, 0.05, 0.35], [0.22, 0.08, 0.25], [0.48, 0.035, 0.4]].forEach(([d, r, al]) => { g.globalAlpha = clamp(k) * al; const gx = x + (W / 2 - x) * d * 2 + d * W * 0.3, gy = y + (H / 2 - y) * d * 2 - d * m * 0.08; g.drawImage(G, gx - m * r, gy - m * r, m * r * 2, m * r * 2); });
  g.restore();
}
function drawTile(g, p, F, it, img, alpha, glow, ox = 0, oy = 0, scaleExtra = 1) {
  const s = it.s * scaleExtra; const px = s * F.cam.Z * (g.__dpr || 1); const spr = cardSprite(img, px, 0);
  if (glow > 0) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha * clamp(glow) * 0.9; const G = glowSprite(p.colors.gold || QB.gold); g.drawImage(G, it.x + ox - s * 1.25, it.y + oy - s * 1.25, s * 2.5, s * 2.5); g.restore(); }
  g.globalAlpha = alpha; g.drawImage(spr, it.x + ox - s / 2, it.y + oy - s / 2, s, s);
  if (glow > 0) { g.save(); g.globalAlpha = alpha * clamp(glow); g.lineWidth = s * 0.035; g.strokeStyle = p.colors.gold || QB.gold; rr(g, it.x + ox - s * 0.48, it.y + oy - s * 0.48, s * 0.96, s * 0.96, s * 0.19); g.stroke(); g.restore(); }
}
function rays(g, p, x, y, s, k, t) {
  if (k <= 0) return; const C = p.colors; g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.rotate(t * 0.35);
  for (let i = 0; i < 18; i++) { g.rotate(TAU / 18); const L = s * (2.2 + (i % 3) * 0.5) * k; const lg = g.createLinearGradient(0, 0, 0, -L); lg.addColorStop(0, hexA(C.gold || QB.gold, 0.32 * clamp(k))); lg.addColorStop(1, hexA(C.gold || QB.gold, 0)); g.fillStyle = lg; g.beginPath(); g.moveTo(-s * 0.03, 0); g.lineTo(-s * 0.13, -L); g.lineTo(s * 0.13, -L); g.lineTo(s * 0.03, 0); g.fill(); }
  g.restore();
}
function showcase(g, W, H, p, F, k, imgs, selImg, t) {
  // background of the product showcase scene fades in beneath the moving card
  const C = p.colors; const m = F.m, land = W > H; const bgA = clamp(k * 1.6);
  if (bgA > 0) { g.save(); g.globalAlpha = bgA; const gr = g.createLinearGradient(0, 0, W * 0.4, H); gr.addColorStop(0, mix(C.bg || QB.navy, '#1F4BA8', 0.55)); gr.addColorStop(1, mix(C.bg || QB.navy, '#000000', 0.45)); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = hexA(C.blue || QB.blue, 0.09); g.lineWidth = 1; const st = m / 16; g.beginPath(); for (let x = (t * 12) % st; x < W; x += st) { g.moveTo(x, 0); g.lineTo(x, H); } for (let y = 0; y < H; y += st) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke(); g.restore(); }
  // the selected brand card travels from its zoomed position into the showcase header
  const sel = F.sel; if (!sel) return; const [x0, y0] = F.cam.toScreen(sel.x, sel.y); const s0 = sel.s * F.cam.Z * 0.92; const hl = clamp(F.V['fx.highlight']);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const hw = land ? W * 0.3 : W * 0.56, hh = hw * 0.42; const hx = land ? W * 0.08 + hw / 2 : W / 2, hy = land ? H * 0.2 + hh / 2 : H * 0.12 + hh / 2;
  const cw = lerp(s0, hw, e), ch = lerp(s0, hh, e), cx = lerp(x0, hx, e), cy = lerp(y0, hy, e); const r = lerp(s0 * 0.19, hh * 0.22, e);
  g.save(); if (hl > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = hl * 0.9 * (1 - e); const gs = Math.max(cw, ch) * 1.25 / 0.92; g.drawImage(glowSprite(C.gold || QB.gold), cx - gs, cy - gs, gs * 2, gs * 2); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
  g.fillStyle = '#FFFFFF'; rr(g, cx - cw / 2, cy - ch / 2, cw, ch, r); g.fill(); g.lineWidth = lerp(s0 * 0.035 * Math.max(hl, 0.3), Math.max(2, m * 0.004), e); g.strokeStyle = C.gold || QB.gold; g.globalAlpha = 1 - e * 0.4; rr(g, cx - cw / 2 + g.lineWidth * 0.3, cy - ch / 2 + g.lineWidth * 0.3, cw - g.lineWidth * 0.6, ch - g.lineWidth * 0.6, r); g.stroke(); g.globalAlpha = 1;
  const pad = Math.min(cw, ch) * 0.16; if (selImg) contain(g, selImg, cx - cw / 2 + pad, cy - ch / 2 + pad, cw - pad * 2, ch - pad * 2); else { g.drawImage(cardSprite(null, Math.min(cw, ch), 0), cx - Math.min(cw, ch) / 2, cy - Math.min(cw, ch) / 2, Math.min(cw, ch), Math.min(cw, ch)); }
  g.restore();
  // product stage, title and subtitle rise in during the second half
  const k2 = clamp((k - 0.45) / 0.55); if (k2 <= 0) return; const e2 = 1 - Math.pow(1 - k2, 3);
  const pw = land ? W * 0.42 : W * 0.8, ph = land ? H * 0.62 : H * 0.36; const ppx = land ? W * 0.52 : (W - pw) / 2, ppy = land ? H * 0.19 : H * 0.3;
  g.save(); g.globalAlpha = e2; g.translate(0, (1 - e2) * m * 0.06);
  g.globalCompositeOperation = 'lighter'; g.drawImage(glowSprite(C.gold || QB.gold), ppx + pw * 0.1, ppy + ph * 0.45, pw * 0.8, ph * 0.6); g.globalCompositeOperation = 'source-over';
  g.strokeStyle = hexA(C.gold || QB.gold, 0.8); g.lineWidth = Math.max(2, m * 0.003); g.beginPath(); g.ellipse(ppx + pw / 2, ppy + ph * 0.93, pw * 0.36, ph * 0.06, 0, 0, TAU); g.stroke();
  const prod = p.showcase.productAssetId ? imgs(p.showcase.productAssetId) : null; if (prod) contain(g, prod, ppx + pw * 0.06, ppy, pw * 0.88, ph * 0.88);
  const tx = land ? W * 0.08 : W / 2, ty = land ? H * 0.58 : H * 0.76; const maxW = land ? W * 0.4 : W * 0.86; g.textAlign = land ? 'left' : 'center';
  const title = p.showcase.title || 'Product Review'; fitFont(g, title, 800, m * (land ? 0.08 : 0.075), HEAD, maxW, 12); g.fillStyle = '#FFFFFF'; g.textBaseline = 'alphabetic'; g.fillText(title, tx, ty);
  const rw = maxW * 0.32 * e2; g.fillStyle = C.gold || QB.gold; g.fillRect(land ? tx : tx - rw / 2, ty + m * 0.028, rw, Math.max(3, m * 0.006));
  if (p.showcase.subtitle) { fitFont(g, p.showcase.subtitle.toUpperCase(), 600, m * 0.032, HEAD, maxW, 10); g.fillStyle = C.gold || QB.gold; g.textBaseline = 'top'; g.fillText(p.showcase.subtitle.toUpperCase(), tx, ty + m * 0.058); }
  g.restore();
}

// main entry: draws the module at local time t (seconds since the layer starts)
export function drawCinematic(g, W, H, t, p, imgs) {
  const F = cineFrame(p, W, H, t); const V = F.V; const C = p.colors;
  const tr = g.getTransform ? g.getTransform() : null; g.__dpr = tr ? Math.hypot(tr.a, tr.b) : 1;
  const sk = clamp(V['showcase.progress']);
  if (sk < 1) {
    background(g, W, H, p, t, F);
    particles(g, W, H, p, t, 1 - sk);
    const oA = clamp(V['orbit.opacity']);
    g.save(); F.cam.apply(g);
    floor(g, W, H, p, t, F, oA * 0.9);
    const showRings = p.fx.rings ?? true; if (showRings) rings(g, p, F, t, oA, 'back');
    const appear = it => { const b = V['orbit.brands']; const a0 = (it.i / F.set.n) * 0.6; const x = clamp((b - a0) / 0.4); return x <= 0 ? 0 : 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2); };
    const magic = V['fx.magic']; const magicK = it => { const a0 = (it.i / F.set.n) * 0.45; return clamp((magic - a0) / 0.55); }; const crack = clamp(V['fx.crack']);
    const hl = V['fx.highlight']; const dir = p.orbit.direction === 'ccw' ? -1 : 1; const blur = (p.spin.motionBlur ?? 0.8) * clamp((F.speed - 1.5) / 6);
    const drawItem = it => {
      const ap = appear(it); if (ap <= 0) return; const isSel = it === F.sel; if (isSel && sk > 0) return;
      let alpha = lerp(1 - (p.orbit.depthFade ?? 0.45), 1, it.d) * clamp(ap * 1.4); if (!isSel) alpha *= oA * (1 - 0.72 * clamp(hl)); const img = it.b.assetId ? imgs(it.b.assetId) : null;
      const sc = Math.max(0.01, ap);
      const mk = magicK(it); const boxed = mk >= 0.45; const pop = mk >= 0.45 && mk < 0.75 ? 1 + 0.18 * Math.sin((mk - 0.45) / 0.3 * Math.PI) : mk > 0 && mk < 0.45 ? 1 + 0.08 * Math.sin(mk / 0.45 * Math.PI) : 1;
      if (isSel && crack > 0) { crackBox(g, p, Object.assign({}, it, { Z: F.cam.Z * (g.__dpr || 1) }), img, crack, t, hl); return; }
      const face = (gg, o) => { if (boxed) { const ss = o.s; gg.globalAlpha = o.alpha; if (o.glow > 0) { gg.save(); gg.globalCompositeOperation = 'lighter'; gg.globalAlpha = o.alpha * clamp(o.glow) * 0.9; gg.drawImage(glowSprite(C.gold || QB.gold), o.x - ss * 1.25, o.y - ss * 1.25, ss * 2.5, ss * 2.5); gg.restore(); gg.globalAlpha = o.alpha; } gg.drawImage(goldSprite(ss * F.cam.Z * (gg.__dpr || 1)), o.x - ss / 2, o.y - ss / 2, ss, ss); }
        else drawTile(gg, p, F, Object.assign({}, it, { x: o.x, y: o.y }), img, o.alpha, o.glow, 0, 0, o.s / it.s); };
      if (blur > 0.02 && alpha > 0.05) for (let k = 4; k >= 1; k--) { const a = it.a - dir * k * 0.035 * blur * Math.min(F.speed, 14) / 4; face(g, { x: F.ox + Math.cos(a) * F.rx, y: F.oy + Math.sin(a) * F.ry, s: it.s * sc, alpha: alpha * 0.16 * (5 - k) / 4 * blur, glow: 0 }); }
      face(g, { x: it.x, y: it.y, s: it.s * sc * pop, alpha, glow: isSel ? hl : 0 });
      if (mk > 0 && mk < 1) magicPuff(g, p, it.x, it.y, it.s * sc, mk, it.i + 1);
    };
    const sorted = F.items.slice().sort((a, b) => a.d - b.d);
    sorted.filter(it => it.d < 0.5).forEach(drawItem);
    centerLogo(g, p, F, p.centerAssetId ? imgs(p.centerAssetId) : null, t);
    if (showRings) rings(g, p, F, t, oA, 'front');
    if (F.sel) rays(g, p, F.sel.x, F.sel.y, F.sel.s, V['fx.rays'] * (1 - sk), t);
    sorted.filter(it => it.d >= 0.5).forEach(drawItem);
    // focus marker under the front slot
    const mk2 = clamp(V['orbit.brands']) * oA * (showRings ? clamp(V['orbit.ring']) : clamp(magic * 2)) * (1 - clamp(crack * 4)); if (mk2 > 0) { const fx = F.ox, fy = F.oy + F.ry + F.tileS * (p.orbit.depthNear ?? 1.15) * 0.78; const s = F.tileS * 0.16; g.globalAlpha = mk2 * 0.95; g.fillStyle = C.gold || QB.gold; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx - s, fy + s * 1.2); g.lineTo(fx + s, fy + s * 1.2); g.closePath(); g.fill(); g.globalAlpha = 1; }
    g.restore();
    flare(g, W, H, p, F, V['fx.flare']);
    // brand name under the chosen logo (a caption only; the logo itself is always the uploaded image)
    if (p.fx.showName && F.sel && F.sel.b.name) { const nk = Math.max(clamp((hl - 0.3) / 0.7) * (1 - clamp(V['camera.focus'] * 2.5)) * (1 - clamp(V['fx.magic'] * 2)), 0); if (nk > 0) { const [x, y] = F.cam.toScreen(F.sel.x, F.sel.y + F.sel.s * 0.78); g.save(); g.globalAlpha = nk; const fs = fitFont(g, F.sel.b.name.toUpperCase(), 800, F.m * 0.042, TECH, W * 0.8); g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(F.sel.b.name.toUpperCase(), x, y + fs * 0.2); g.restore(); } }
  }
  if (sk > 0) showcase(g, W, H, p, F, sk, imgs, F.sel && F.sel.b.assetId ? imgs(F.sel.b.assetId) : null, t);
  if (p.fx.vignette) { const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.max(W, H) * 0.78); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  const fl = clamp(V['fx.flash']); if (fl > 0) { g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(0, 0, W, H); }
  g.globalAlpha = 1;
}
// asset ids the module needs (for preloading and the "missing logo" check)
export function cineAssetIds(p) { return [p.centerAssetId, p.showcase && p.showcase.productAssetId, ...cineSet(p).list.map(b => b.assetId)].filter(Boolean); }
export function cineMissingLogos(p) { const set = cineSet(p); return { center: !p.centerAssetId, brands: set.list.filter(b => !b.assetId).map(b => b.name || '(tanpa nama)') }; }

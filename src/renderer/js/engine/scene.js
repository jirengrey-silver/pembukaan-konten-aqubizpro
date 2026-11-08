// Scene renderer: draws a project frame (background + layers) at time t.
// Pure drawing code: images come from an injected lookup so it runs in the app, in export and in tests.
import { clamp, lerp, seg, EASE, hexA, fontCss, uid } from './util.js';
import { drawRoulette, defaultRoulette, rouletteDuration } from './roulette.js';

export const PRESETS = [
  { id: 'wa', group: 'Vertikal', label: 'WhatsApp Status / Story', w: 1080, h: 1920, safe: { t: 190, b: 230, l: 40, r: 40 } },
  { id: 'igstory', group: 'Vertikal', label: 'Instagram Story', w: 1080, h: 1920, safe: { t: 250, b: 340, l: 40, r: 40 } },
  { id: 'reels', group: 'Vertikal', label: 'Instagram Reels', w: 1080, h: 1920, safe: { t: 220, b: 430, l: 40, r: 170 } },
  { id: 'tiktok', group: 'Vertikal', label: 'TikTok Video', w: 1080, h: 1920, safe: { t: 240, b: 480, l: 40, r: 180 } },
  { id: 'shorts', group: 'Vertikal', label: 'YouTube Shorts', w: 1080, h: 1920, safe: { t: 230, b: 420, l: 40, r: 160 } },
  { id: 'youtube', group: 'Horizontal', label: 'YouTube Video', w: 1920, h: 1080, safe: { t: 60, b: 60, l: 100, r: 100 } },
  { id: 'facebook', group: 'Horizontal', label: 'Facebook Video', w: 1920, h: 1080, safe: { t: 60, b: 60, l: 100, r: 100 } },
  { id: 'landscape', group: 'Horizontal', label: 'Video Promosi Landscape', w: 1920, h: 1080, safe: { t: 60, b: 60, l: 100, r: 100 } },
  { id: 'igfeed', group: 'Persegi', label: 'Instagram Feed', w: 1080, h: 1080, safe: { t: 50, b: 50, l: 50, r: 50 } },
  { id: 'fbpost', group: 'Persegi', label: 'Facebook Post', w: 1080, h: 1080, safe: { t: 50, b: 50, l: 50, r: 50 } }
];
export const presetOf = id => PRESETS.find(p => p.id === id) || PRESETS[0];

export const LAYER_TYPES = { roulette: 'Brand Roulette', text: 'Teks', image: 'Gambar', logo: 'Logo', shape: 'Bentuk' };
const base = (o) => Object.assign({ id: uid(), name: '', start: 0, end: 5, x: 540, y: 960, w: 400, h: 200, scale: 1, rotation: 0, opacity: 1, fadeIn: 0, fadeOut: 0, blur: 0, locked: false, hidden: false,
  border: { width: 0, color: '#F2A93B', radius: 0 }, shadow: { on: false, color: '#000000', blur: 30, x: 0, y: 12, alpha: 0.5 } }, o);
export function newLayer(type, project, extra = {}) {
  const W = project.width, H = project.height, m = Math.min(W, H); const t0 = extra.start ?? 0;
  if (type === 'roulette') { const params = defaultRoulette(); return base(Object.assign({ type, name: 'Brand Roulette Intro', start: t0, end: t0 + rouletteDuration(params), x: W / 2, y: H / 2, w: W, h: H, params }, extra)); }
  if (type === 'text') return base(Object.assign({ type, name: 'Teks', start: t0, end: t0 + 5, x: W / 2, y: H / 2, w: W * 0.8, h: m * 0.12, text: 'Teks baru', font: 'sora', size: Math.round(m * 0.07), weight: 800, color: '#FFFFFF', align: 'center', letterSpacing: 0, lineHeight: 1.15,
    gradient: { on: false, c1: '#F2A93B', c2: '#F57C1F' }, outline: { width: 0, color: '#000000' }, glow: { on: false, color: '#1E9BFF', size: 24 }, bg: { on: false, color: '#0A1631', pad: 24, radius: 16, alpha: 0.8 } }, extra));
  if (type === 'image' || type === 'logo') return base(Object.assign({ type, name: type === 'logo' ? 'Logo' : 'Gambar', start: t0, end: t0 + 5, x: W / 2, y: H / 2, w: m * 0.6, h: m * 0.6, assetId: null, fit: 'contain' }, extra));
  if (type === 'shape') return base(Object.assign({ type, name: 'Bentuk', start: t0, end: t0 + 5, x: W / 2, y: H / 2, w: m * 0.5, h: m * 0.2, shape: 'rect', fill: '#12285A', fillAlpha: 1 }, extra));
  throw new Error('Jenis layer tidak dikenal: ' + type);
}
export function newProject(presetId, name) {
  const P = presetOf(presetId); const now = Date.now();
  return { id: uid() + uid().slice(0, 4), name: name || 'Proyek baru', preset: P.id, width: P.w, height: P.h, fps: 30, duration: 10,
    background: { type: 'gradient', color: '#0A1631', color2: '#12285A', angle: 160, assetId: null }, layers: [], audio: [], createdAt: now, updatedAt: now, archived: false, thumbnail: null };
}
export function projectDuration(p) { return Math.max(1, p.duration || 1, ...p.layers.map(l => l.end || 0)); }
// re-fits a project to another preset, scaling layer positions and sizes
export function changePreset(project, presetId) {
  const P = presetOf(presetId); const sx = P.w / project.width, sy = P.h / project.height, sm = Math.min(P.w, P.h) / Math.min(project.width, project.height);
  for (const l of project.layers) {
    if (l.type === 'roulette') { l.x = P.w / 2; l.y = P.h / 2; l.w = P.w; l.h = P.h; continue; }
    l.x *= sx; l.y *= sy; l.w *= sm; l.h *= sm; if (l.size) l.size = Math.round(l.size * sm);
  }
  project.preset = P.id; project.width = P.w; project.height = P.h; return project;
}

/* ---------------- drawing ---------------- */
function bg(g, p, imgs) {
  const W = p.width, H = p.height; const b = p.background || {};
  if (b.type === 'image' && b.assetId && imgs(b.assetId)) { const im = imgs(b.assetId); const k = Math.max(W / im.width, H / im.height); g.drawImage(im, (W - im.width * k) / 2, (H - im.height * k) / 2, im.width * k, im.height * k); return; }
  if (b.type === 'gradient') { const a = ((b.angle ?? 160) - 90) * Math.PI / 180; const r = Math.hypot(W, H) / 2; const gr = g.createLinearGradient(W / 2 - Math.cos(a) * r, H / 2 - Math.sin(a) * r, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); gr.addColorStop(0, b.color || '#0A1631'); gr.addColorStop(1, b.color2 || '#12285A'); g.fillStyle = gr; }
  else g.fillStyle = b.color || '#0A1631';
  g.fillRect(0, 0, W, H);
}
export function layerAlpha(l, t) {
  let a = l.opacity ?? 1; const d = l.end - l.start; const lt = t - l.start;
  if (l.fadeIn > 0) a *= EASE.outCubic(clamp(lt / Math.min(l.fadeIn, d))); if (l.fadeOut > 0) a *= EASE.outCubic(clamp((l.end - t) / Math.min(l.fadeOut, d)));
  return a;
}
function wrapLines(g, text, maxW) {
  const out = []; for (const para of String(text ?? '').split('\n')) { const words = para.split(/\s+/).filter(Boolean); if (!words.length) { out.push(''); continue; } let line = ''; for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); }
  return out;
}
function drawText(g, l, custom) {
  const fam = fontCss(l.font, custom); g.font = `${l.weight || 700} ${l.size}px ${fam}`; if ('letterSpacing' in g) g.letterSpacing = (l.letterSpacing || 0) + 'px';
  const lines = wrapLines(g, l.text, l.w); const lh = l.size * (l.lineHeight || 1.15); const totalH = lines.length * lh;
  const ax = l.align === 'left' ? -l.w / 2 : l.align === 'right' ? l.w / 2 : 0; g.textAlign = l.align || 'center'; g.textBaseline = 'middle';
  if (l.bg && l.bg.on) { const widths = lines.map(s => g.measureText(s).width); const bw = Math.min(l.w, Math.max(...widths, 1)) + l.bg.pad * 2; const bx = l.align === 'left' ? -l.w / 2 - l.bg.pad : l.align === 'right' ? l.w / 2 - bw + l.bg.pad : -bw / 2;
    g.save(); g.globalAlpha *= l.bg.alpha ?? 1; g.fillStyle = l.bg.color; g.beginPath(); g.roundRect(bx, -totalH / 2 - l.bg.pad, bw, totalH + l.bg.pad * 2, l.bg.radius || 0); g.fill(); g.restore(); }
  let fill = l.color || '#FFFFFF';
  if (l.gradient && l.gradient.on) { const gr = g.createLinearGradient(0, -totalH / 2, 0, totalH / 2); gr.addColorStop(0, l.gradient.c1); gr.addColorStop(1, l.gradient.c2); fill = gr; }
  lines.forEach((s, i) => {
    const y = -totalH / 2 + lh * (i + 0.5);
    if (l.glow && l.glow.on) { g.save(); g.shadowColor = l.glow.color; g.shadowBlur = l.glow.size; g.fillStyle = fill; g.fillText(s, ax, y); g.restore(); }
    if (l.outline && l.outline.width > 0) { g.save(); g.lineJoin = 'round'; g.lineWidth = l.outline.width * 2; g.strokeStyle = l.outline.color; g.strokeText(s, ax, y); g.restore(); }
    g.fillStyle = fill; g.fillText(s, ax, y);
  });
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}
function drawPlaceholder(g, w, h, label) { g.save(); g.strokeStyle = 'rgba(148,167,196,.7)'; g.setLineDash([12, 8]); g.lineWidth = 3; g.strokeRect(-w / 2, -h / 2, w, h); g.setLineDash([]); g.fillStyle = 'rgba(148,167,196,.9)'; g.font = `600 ${Math.max(14, Math.min(w, h) * 0.08)}px "IBM Plex Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 0, 0); g.restore(); }
export function drawLayer(g, l, t, p, imgs, custom) {
  if (l.hidden || t < l.start || t >= l.end) return;
  const a = layerAlpha(l, t); if (a <= 0.001) return;
  if (l.type === 'roulette') { g.save(); g.globalAlpha = a; drawRoulette(g, p.width, p.height, t - l.start, l.params, imgs); g.restore(); return; }
  g.save(); g.globalAlpha = a; g.translate(l.x, l.y); if (l.rotation) g.rotate(l.rotation * Math.PI / 180); if (l.scale !== 1) g.scale(l.scale, l.scale);
  if (l.blur > 0 && 'filter' in g) g.filter = `blur(${l.blur}px)`;
  if (l.shadow && l.shadow.on) { g.shadowColor = hexA(l.shadow.color, l.shadow.alpha ?? 0.5); g.shadowBlur = l.shadow.blur; g.shadowOffsetX = l.shadow.x; g.shadowOffsetY = l.shadow.y; }
  const r = (l.border && l.border.radius) || 0;
  if (l.type === 'text') drawText(g, l, custom);
  else if (l.type === 'shape') { g.globalAlpha *= l.fillAlpha ?? 1; g.fillStyle = l.fill; g.beginPath(); if (l.shape === 'ellipse') g.ellipse(0, 0, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); else g.roundRect(-l.w / 2, -l.h / 2, l.w, l.h, r); g.fill(); g.globalAlpha /= l.fillAlpha || 1; }
  else if (l.type === 'image' || l.type === 'logo') {
    const im = l.assetId ? imgs(l.assetId) : null;
    if (!im) drawPlaceholder(g, l.w, l.h, l.assetId ? 'Memuat…' : 'Pilih gambar');
    else {
      let dw = l.w, dh = l.h; if (l.fit !== 'fill') { const k = l.fit === 'cover' ? Math.max(l.w / im.width, l.h / im.height) : Math.min(l.w / im.width, l.h / im.height); dw = im.width * k; dh = im.height * k; }
      g.save(); if (r > 0 || l.fit === 'cover') { g.beginPath(); g.roundRect(-l.w / 2, -l.h / 2, l.w, l.h, r); g.clip(); } g.drawImage(im, -dw / 2, -dh / 2, dw, dh); g.restore();
    }
  }
  g.shadowColor = 'transparent'; if ('filter' in g) g.filter = 'none';
  if (l.border && l.border.width > 0 && l.type !== 'text') { g.lineWidth = l.border.width; g.strokeStyle = l.border.color; g.beginPath(); if (l.type === 'shape' && l.shape === 'ellipse') g.ellipse(0, 0, l.w / 2, l.h / 2, 0, 0, Math.PI * 2); else g.roundRect(-l.w / 2, -l.h / 2, l.w, l.h, r); g.stroke(); }
  g.restore();
}
// draws a full frame; ctx is already scaled so 1 unit = 1 project pixel
export function renderFrame(g, p, t, imgs, custom) {
  g.save(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; bg(g, p, imgs);
  for (const l of p.layers) drawLayer(g, l, t, p, imgs, custom);
  g.restore();
}
// rough on-screen bounds of a layer at its own transform, used for selection and dragging
export function layerBox(l, p) { if (l.type === 'roulette') return { x: 0, y: 0, w: p.width, h: p.height, cx: p.width / 2, cy: p.height / 2 }; const w = l.w * l.scale, h = (l.type === 'text' ? Math.max(l.h, l.size * 1.3) : l.h) * l.scale; return { x: l.x - w / 2, y: l.y - h / 2, w, h, cx: l.x, cy: l.y }; }
export function hitTest(p, t, px, py) {
  for (let i = p.layers.length - 1; i >= 0; i--) { const l = p.layers[i]; if (l.hidden || t < l.start || t >= l.end || l.type === 'roulette') continue; const b = layerBox(l, p); const a = -(l.rotation || 0) * Math.PI / 180; const dx = px - l.x, dy = py - l.y; const rx = dx * Math.cos(a) - dy * Math.sin(a) + l.x, ry = dx * Math.sin(a) + dy * Math.cos(a) + l.y; if (rx >= b.x && rx <= b.x + b.w && ry >= b.y && ry <= b.y + b.h) return l; }
  const r = p.layers.slice().reverse().find(l => l.type === 'roulette' && !l.hidden && t >= l.start && t < l.end); return r || null;
}

/* ---------------- built-in templates ---------------- */
export function builtinTemplates() {
  return [
    { id: 'builtin:roulette', name: 'QBizPro Brand Roulette Intro', category: 'Pembuka', description: 'Logo QBizPro di tengah, brand IT mengorbit seperti roulette, satu brand terpilih lalu kamera zoom ke halaman review.', make: (preset) => { const p = newProject(preset, 'Brand Roulette Intro'); const l = newLayer('roulette', p); p.layers.push(l); p.duration = l.end; return p; } },
    { id: 'builtin:blank', name: 'Proyek kosong', category: 'Dasar', description: 'Latar navy dengan satu judul. Tambahkan gambar, logo, teks, dan bentuk sendiri.', make: (preset) => { const p = newProject(preset, 'Proyek baru'); const tl = newLayer('text', p, { text: 'Judul konten', end: 10 }); p.layers.push(tl); p.duration = 10; return p; } }
  ];
}

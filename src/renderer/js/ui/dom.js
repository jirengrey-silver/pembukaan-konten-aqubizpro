// Small DOM helpers shared by every screen: element builder, icons, toasts, dialogs, context menu.
import { api } from '../api.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; else if (k in el && typeof v !== 'string') el[k] = v; else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
  return el;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const P = {
  plus: 'M12 5v14M5 12h14', play: 'M7 4.5v15l12-7.5z', pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z', stop: 'M6 6h12v12H6z',
  back: 'M15 18l-6-6 6-6', prev: 'M19 5v14l-9-7zM6 5v14', next: 'M5 5v14l9-7zM18 5v14', home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  save: 'M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v5h8V3M7 21v-7h10v7', undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3', redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  export: 'M12 3v12M7 8l5-5 5 5M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4', more: 'M5 12h.01M12 12h.01M19 12h.01', x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', copy: 'M8 8h12v12H8zM4 16V4h12', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeoff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.5-2', grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  folder: 'M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', image: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9a1 1 0 1 0 0-.01', text: 'M5 6V4h14v2M12 4v16M9 20h6',
  shape: 'M4 4h9v9H4zM16 11a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z', music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  roulette: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v6M12 15v6M3 12h6M15 12h6', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5', template: 'M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z', box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4', settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  zoomin: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M11 8v6M8 11h6', zoomout: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6', fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  full: 'M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6', safe: 'M3 3h18v18H3zM7 7h10v10H7z', panel: 'M3 4h18v16H3zM9 4v16', upload: 'M12 15V3M7 8l5-5 5 5M4 17v3h16v-3',
  shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5', check: 'M5 12l5 5 9-10', alert: 'M12 3l10 18H2zM12 10v5M12 18h.01', archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
  restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5', key: 'M15 7a4 4 0 1 0-3.9 5L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 0 15 7z', split: 'M12 3v18M7 8l-4 4 4 4M17 8l4 4-4 4', reveal: 'M14 3h7v7M10 14L21 3M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5'
};
export function icon(name, cls) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i' + (cls ? ' ' + cls : '')); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', P[name] || P.box); s.append(p); return s; }

export function toast(msg, kind = 'info', ms = 3800) {
  let box = $('.toasts'); if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = h('div', { class: 'toast ' + kind }, msg); box.append(t); setTimeout(() => t.remove(), ms); return t;
}
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const prev = document.activeElement;
  const bg = h('div', { class: 'modal-bg' }); const m = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = (v) => { bg.remove(); document.removeEventListener('keydown', key, true); if (prev && prev.focus) prev.focus(); onClose && onClose(v); };
  const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
  const foot = h('footer'); for (const a of actions) foot.append(h('button', { class: 'btn ' + (a.kind || ''), onclick: () => { const r = a.run ? a.run() : a.value; if (r === false) return; close(r ?? a.value); } }, a.label));
  m.append(h('header', null, h('h2', null, title), h('button', { class: 'btn ghost icon', 'aria-label': 'Tutup', onclick: () => close(null) }, icon('x'))), h('div', { class: 'mb' }, body)); if (actions.length) m.append(foot);
  bg.append(m); bg.addEventListener('mousedown', e => { if (e.target === bg) close(null); }); document.addEventListener('keydown', key, true); document.body.append(bg);
  setTimeout(() => { const f = m.querySelector('input, select, textarea') || foot.querySelector('.btn.gold, .btn.blue') || m.querySelector('button'); f && f.focus(); }, 0);
  return { el: m, close };
}
export function confirmBox(title, text, okLabel = 'Lanjutkan', danger = false) {
  return new Promise(res => modal({ title, body: h('p', { style: { margin: 0, color: 'var(--sub)' } }, text), actions: [{ label: 'Batal', value: false }, { label: okLabel, kind: danger ? 'gold danger' : 'gold', value: true }], onClose: v => res(!!v) }));
}
export function promptBox(title, label, value = '') {
  return new Promise(res => {
    const inp = h('input', { type: 'text', value, 'aria-label': label });
    const m = modal({ title, body: h('div', { class: 'row' }, h('label', { class: 'lab' }, label), inp), actions: [{ label: 'Batal', value: null }, { label: 'Simpan', kind: 'gold', run: () => inp.value.trim() || false }], onClose: v => res(v ? String(v) : null) });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && inp.value.trim()) { m.close(inp.value.trim()); } });
    setTimeout(() => inp.select(), 0);
  });
}
export function ctxMenu(x, y, items) {
  $$('.ctx-menu').forEach(m => m.remove());
  const m = h('div', { class: 'ctx-menu', role: 'menu' });
  for (const it of items) { if (it === '-') { m.append(h('hr')); continue; } m.append(h('button', { role: 'menuitem', disabled: !!it.disabled, onclick: () => { m.remove(); it.run(); } }, h('span', null, it.label), it.kbd ? h('kbd', null, it.kbd) : null)); }
  document.body.append(m); const r = m.getBoundingClientRect(); m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  const off = e => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off, true); } }; setTimeout(() => document.addEventListener('mousedown', off, true), 0);
  m.querySelector('button:not(:disabled)')?.focus();
  m.addEventListener('keydown', e => { if (e.key === 'Escape') m.remove(); });
  return m;
}
export const fmtTime = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(2).padStart(5, '0')}`; };
export const fmtSize = b => (b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
export const fmtDate = ms => (ms ? new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const ago = ms => { const d = (Date.now() - ms) / 1000; if (d < 60) return 'baru saja'; if (d < 3600) return Math.floor(d / 60) + ' menit lalu'; if (d < 86400) return Math.floor(d / 3600) + ' jam lalu'; return fmtDate(ms); };

/* image cache: assets are loaded once and shared by preview, thumbnails and export */
const cache = new Map(); const waiters = new Set();
export function img(id) {
  if (!id) return null; const c = cache.get(id); if (c) return c.ok ? c.im : null;
  const im = new Image(); im.crossOrigin = 'anonymous'; const rec = { im, ok: false }; cache.set(id, rec);
  im.onload = () => { rec.ok = true; for (const w of waiters) w(id); }; im.onerror = () => { rec.failed = true; };
  im.src = api.assetUrl(id); return null;
}
export function onImageLoad(fn) { waiters.add(fn); return () => waiters.delete(fn); }
export async function preload(ids) { await Promise.all([...new Set(ids.filter(Boolean))].map(id => new Promise(res => { img(id); const r = cache.get(id); if (r.ok || r.failed) return res(); const t = setInterval(() => { if (r.ok || r.failed) { clearInterval(t); res(); } }, 30); setTimeout(() => { clearInterval(t); res(); }, 8000); }))); }
export function dropAsset(id) { cache.delete(id); }

/* custom fonts uploaded as assets */
const loadedFonts = {};
export async function loadCustomFonts() {
  const list = await api.assets.list('font');
  for (const a of list) { if (loadedFonts['f_' + a.id]) continue; try { const ff = new FontFace('QBZ ' + a.name, `url(${api.assetUrl(a.id)})`); await ff.load(); document.fonts.add(ff); loadedFonts['f_' + a.id] = 'QBZ ' + a.name; } catch (e) { /* bad font file */ } }
  return loadedFonts;
}
export const customFonts = () => loadedFonts;

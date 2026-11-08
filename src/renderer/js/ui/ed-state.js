// Editor session state, undo history and bound form controls shared by the editor panels.
import { h } from './dom.js';
import { api } from '../api.js';

export const E = { s: null };
export const hooks = { canvas() {}, tl() {}, props() {}, left() {}, title() {} };

export function session(p) {
  E.s = { p, sel: null, t: 0, playing: false, zoom: 'fit', safe: true, grid: false, left: 'layers', leftOpen: true, dirty: false, undo: [], redo: [], lastKey: null, lastAt: 0, pxPerSec: 60, autosaveT: null, savedAt: p.updatedAt || 0, autosavedAt: 0 };
  return E.s;
}
export const sel = () => (E.s && E.s.sel ? E.s.p.layers.find(l => l.id === E.s.sel) || null : null);

// call before every change; repeated edits of the same control within a moment become one undo step
export function snap(key) {
  const s = E.s; const now = Date.now();
  if (key && key === s.lastKey && now - s.lastAt < 900) { s.lastAt = now; return; }
  s.undo.push(JSON.stringify(s.p)); if (s.undo.length > 120) s.undo.shift(); s.redo.length = 0; s.lastKey = key || null; s.lastAt = now;
}
export function changed(parts = 'canvas tl props') {
  const s = E.s; s.dirty = true; s.p.updatedAt = Date.now(); hooks.title();
  clearTimeout(s.autosaveT); s.autosaveT = setTimeout(() => { if (E.s === s && s.dirty) api.projects.autosave(s.p).then(() => { s.autosavedAt = Date.now(); hooks.title(); }).catch(() => {}); }, 2000);
  for (const k of parts.split(' ')) hooks[k] && hooks[k]();
}
export function undo() { const s = E.s; if (!s.undo.length) return false; s.redo.push(JSON.stringify(s.p)); s.p = JSON.parse(s.undo.pop()); s.lastKey = null; if (!sel()) s.sel = null; changed('canvas tl props left'); return true; }
export function redo() { const s = E.s; if (!s.redo.length) return false; s.undo.push(JSON.stringify(s.p)); s.p = JSON.parse(s.redo.pop()); s.lastKey = null; if (!sel()) s.sel = null; changed('canvas tl props left'); return true; }

/* ---------- bound controls ---------- */
let ctlSeq = 0;
const keyOf = (o, k) => { if (!o.__ck) Object.defineProperty(o, '__ck', { value: 'o' + (++ctlSeq), enumerable: false }); return o.__ck + '.' + k; };
function apply(obj, k, v, opt) { snap(keyOf(obj, k)); obj[k] = v; opt.set && opt.set(v); changed(opt.parts || 'canvas tl'); }
export function num(label, obj, k, opt = {}) {
  const id = 'c' + (++ctlSeq); const i = h('input', { type: 'number', id, value: String(round(obj[k], opt.step)), min: opt.min, max: opt.max, step: opt.step ?? 1 });
  i.addEventListener('change', () => { let v = parseFloat(i.value); if (!isFinite(v)) { i.value = obj[k]; return; } if (opt.min != null) v = Math.max(opt.min, v); if (opt.max != null) v = Math.min(opt.max, v); i.value = String(round(v, opt.step)); apply(obj, k, v, opt); });
  return h('div', { class: 'row' }, h('label', { class: 'lab', for: id }, h('span', null, label), opt.unit ? h('span', null, opt.unit) : null), i);
}
export function range(label, obj, k, opt = {}) {
  const id = 'c' + (++ctlSeq); const fmt = opt.fmt || (v => String(round(v, opt.step))); const out = h('output', { for: id }, fmt(obj[k]));
  const i = h('input', { type: 'range', id, min: opt.min ?? 0, max: opt.max ?? 100, step: opt.step ?? 1, value: String(obj[k]) });
  i.addEventListener('input', () => { const v = parseFloat(i.value); out.textContent = fmt(v); apply(obj, k, v, opt); });
  return h('div', { class: 'row' }, h('label', { class: 'lab', for: id }, h('span', null, label), out), i);
}
export function color(label, obj, k, opt = {}) {
  const id = 'c' + (++ctlSeq); const t = h('input', { type: 'text', value: obj[k], 'aria-label': label + ' (hex)', style: { fontFamily: 'var(--mono)', fontSize: '12px' } });
  const c = h('input', { type: 'color', id, value: /^#[0-9a-f]{6}$/i.test(obj[k]) ? obj[k] : '#000000' });
  c.addEventListener('input', () => { t.value = c.value; apply(obj, k, c.value, opt); });
  t.addEventListener('change', () => { const v = t.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) { c.value = v; apply(obj, k, v, opt); } else t.value = obj[k]; });
  return h('div', { class: 'row' }, h('label', { class: 'lab', for: id }, label), h('div', { class: 'colorrow' }, c, t));
}
export function text(label, obj, k, opt = {}) {
  const id = 'c' + (++ctlSeq); const i = h(opt.multi ? 'textarea' : 'input', { id, type: opt.multi ? null : 'text', placeholder: opt.placeholder || '', rows: opt.rows || null });
  i.value = obj[k] ?? ''; i.addEventListener('input', () => apply(obj, k, i.value, opt));
  return h('div', { class: 'row' }, h('label', { class: 'lab', for: id }, label), i);
}
export function select(label, obj, k, options, opt = {}) {
  const id = 'c' + (++ctlSeq); const s = h('select', { id }, options.map(([v, l]) => h('option', { value: v, selected: String(obj[k]) === String(v) }, l)));
  s.addEventListener('change', () => { const v = typeof obj[k] === 'number' ? +s.value : s.value; apply(obj, k, v, opt); });
  return h('div', { class: 'row' }, h('label', { class: 'lab', for: id }, label), s);
}
export function check(label, obj, k, opt = {}) {
  const i = h('input', { type: 'checkbox', checked: !!obj[k] }); i.addEventListener('change', () => apply(obj, k, i.checked, opt));
  return h('label', { class: 'check' }, i, label);
}
export function seg(label, obj, k, options, opt = {}) {
  const wrap = h('div', { class: 'flex', role: 'group', 'aria-label': label, style: { gap: '4px' } });
  for (const [v, l] of options) wrap.append(h('button', { class: 'btn sm', 'aria-pressed': String(obj[k] === v), onclick: () => { wrap.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', 'false')); wrap.querySelector(`[data-v="${v}"]`).setAttribute('aria-pressed', 'true'); apply(obj, k, v, opt); }, 'data-v': v }, l));
  return h('div', { class: 'row' }, h('span', { class: 'lab' }, label), wrap);
}
const round = (v, step) => { const d = step && step < 1 ? Math.min(3, String(step).split('.')[1]?.length || 2) : 0; return d ? +(+v).toFixed(d) : Math.round(+v); };

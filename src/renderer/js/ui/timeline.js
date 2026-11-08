// Multi-layer timeline: ruler with scrubbing, one row per layer and audio track, move and trim clips.
import { h, icon, fmtTime, ctxMenu } from './dom.js';
import { E, snap, changed, hooks } from './ed-state.js';
import { projectDuration, LAYER_TYPES } from '../engine/scene.js';
import { STAGES, stageTimes } from '../engine/roulette.js';
import { clamp } from '../engine/util.js';
import { removeLayer, duplicateLayer } from './panels.js';

const COLORS = { roulette: '#F2A93B', text: '#1E9BFF', image: '#3DDC97', logo: '#B78BFF', shape: '#93A4C3', audio: '#FF9FB0' };
const SEGC = ['#F2A93B', '#FFC56B', '#F57C1F', '#FFB04D', '#FFD88F', '#F29A3B', '#FFE3AE'];
let R = null; // current DOM refs

export function buildTimeline(el, api) {
  const s = E.s; const p = s.p; const dur = projectDuration(p); const pps = s.pxPerSec;
  const prevScroll = R && R.scroll ? { l: R.scroll.scrollLeft, t: R.scroll.scrollTop } : null;
  const width = Math.ceil((dur + 3) * pps);
  const tools = h('div', { class: 'tl-tools' },
    h('span', { class: 'lab', style: { marginRight: '6px' } }, 'Timeline'),
    h('button', { class: 'btn ghost icon sm', 'aria-label': 'Perkecil timeline', title: 'Perkecil', onclick: () => zoom(s.pxPerSec / 1.3, api) }, icon('zoomout')),
    h('button', { class: 'btn ghost icon sm', 'aria-label': 'Perbesar timeline', title: 'Perbesar', onclick: () => zoom(s.pxPerSec * 1.3, api) }, icon('zoomin')),
    h('button', { class: 'btn ghost sm', onclick: () => { const w = R.scroll.clientWidth - 20; zoom(w / (dur + 0.5), api); } }, 'Pas'),
    h('span', { class: 'hint', style: { marginLeft: '8px' } }, 'Seret blok untuk memindah, tepi blok untuk memotong. Klik kanan untuk menu. Keyframe menyusul di Fase 2.'));
  const names = h('div', { class: 'tl-names' }, h('div', { class: 'tl-head' }, 'Layer'));
  const ruler = h('div', { class: 'tl-ruler', style: { width: width + 'px' } });
  const stepS = pps > 120 ? 0.5 : pps > 50 ? 1 : pps > 20 ? 2 : 5;
  for (let t = 0; t <= dur + 3; t += stepS) { ruler.append(h('i', { style: { left: t * pps + 'px', height: Math.abs(t - Math.round(t)) < 1e-6 ? '9px' : '5px' } })); if (Math.abs(t / (stepS * 2) - Math.round(t / (stepS * 2))) < 1e-6) ruler.append(h('span', { style: { left: t * pps + 'px' } }, fmtTime(t).slice(0, 5) + (t % 1 ? '' : 's'))); }
  ruler.append(h('div', { style: { position: 'absolute', left: dur * pps + 'px', top: 0, bottom: 0, width: '2px', background: 'rgba(255,107,125,.6)' }, title: 'Akhir video' }));
  const rows = h('div', { style: { width: width + 'px', position: 'relative' } });
  const playhead = h('div', { class: 'playhead' });
  const scroll = h('div', { class: 'tl-scroll' }, ruler, rows, playhead);
  const L = p.layers.slice().reverse();
  for (const l of L) {
    names.append(h('div', { class: 'tl-name', 'aria-selected': String(s.sel === l.id), onclick: () => api.select(l.id), title: l.name }, h('span', { class: 'kind', style: { background: COLORS[l.type] } }), h('span', { class: 'nm', style: { opacity: l.hidden ? 0.45 : 1 } }, l.name || LAYER_TYPES[l.type]),
      h('button', { 'aria-label': l.hidden ? 'Tampilkan' : 'Sembunyikan', onclick: e => { e.stopPropagation(); snap(); l.hidden = !l.hidden; changed('canvas tl left'); } }, icon(l.hidden ? 'eyeoff' : 'eye'))));
    const row = h('div', { class: 'tl-row' });
    const clip = h('div', { class: 'clip', 'aria-selected': String(s.sel === l.id), role: 'button', tabindex: '0', 'aria-label': `${l.name} ${fmtTime(l.start)} sampai ${fmtTime(l.end)}`, style: { left: l.start * pps + 'px', width: Math.max(6, (l.end - l.start) * pps) + 'px', background: COLORS[l.type], opacity: l.hidden ? 0.4 : 1 } });
    if (l.type === 'roulette') { const S = stageTimes(l.params); STAGES.forEach(([k, lab], i) => clip.append(h('div', { class: 'seg', title: `${lab} · ${S[k].d.toFixed(1)} dtk`, style: { left: S[k].a * pps + 'px', width: S[k].d * pps + 'px', background: SEGC[i] + '55' } }))); clip.append(h('span', { style: { position: 'relative' } }, l.name)); }
    else { clip.append(h('span', { style: { position: 'relative', overflow: 'hidden', textOverflow: 'ellipsis' } }, l.type === 'text' ? (l.text || '').split('\n')[0] : l.name)); clip.append(h('div', { class: 'h l', 'data-h': 'l' }), h('div', { class: 'h r', 'data-h': 'r' })); }
    clip.addEventListener('pointerdown', e => startDrag(e, clip, { get a() { return l.start; }, get b() { return l.end; }, set(a, b) { l.start = a; l.end = b; }, trim: l.type !== 'roulette', id: l.id }, api));
    clip.addEventListener('contextmenu', e => { e.preventDefault(); api.select(l.id); ctxMenu(e.clientX, e.clientY, [
      { label: 'Pindah ke playhead', run: () => { snap(); const d = l.end - l.start; l.start = s.t; l.end = s.t + d; changed(); } },
      { label: 'Potong awal di playhead', disabled: l.type === 'roulette' || s.t <= l.start || s.t >= l.end, run: () => { snap(); l.start = s.t; changed(); } },
      { label: 'Potong akhir di playhead', disabled: l.type === 'roulette' || s.t <= l.start || s.t >= l.end, run: () => { snap(); l.end = s.t; changed(); } },
      { label: 'Duplikat', kbd: 'Ctrl+D', run: () => duplicateLayer(l) }, '-', { label: 'Hapus', kbd: 'Del', run: () => removeLayer(l) }]); });
    row.append(clip); rows.append(row);
  }
  for (const tr of p.audio || []) {
    const len = () => tr.duration || (tr.assetDuration ? Math.max(0.1, tr.assetDuration - (tr.trimStart || 0)) : Math.max(0.5, dur - tr.start));
    names.append(h('div', { class: 'tl-name', title: tr.name }, h('span', { class: 'kind', style: { background: COLORS.audio } }), h('span', { class: 'nm', style: { opacity: tr.muted ? 0.45 : 1 } }, '♪ ' + tr.name)));
    const clip = h('div', { class: 'clip', role: 'button', tabindex: '0', 'aria-label': 'Audio ' + tr.name, style: { left: tr.start * pps + 'px', width: Math.max(6, len() * pps) + 'px', background: COLORS.audio, opacity: tr.muted ? 0.4 : 1 } }, h('span', null, tr.name), h('div', { class: 'h r', 'data-h': 'r' }));
    clip.addEventListener('pointerdown', e => startDrag(e, clip, { get a() { return tr.start; }, get b() { return tr.start + len(); }, set(a, b) { tr.start = a; if (b - a !== len()) tr.duration = +(b - a).toFixed(3); }, trim: true, noLeft: true, max: tr.assetDuration ? tr.assetDuration - (tr.trimStart || 0) : null }, api));
    rows.append(h('div', { class: 'tl-row' }, clip));
  }
  if (!L.length && !(p.audio || []).length) rows.append(h('div', { class: 'hint', style: { padding: '12px' } }, 'Belum ada layer. Tambahkan dari panel kiri.'));
  scroll.addEventListener('scroll', () => { names.scrollTop = scroll.scrollTop; });
  const scrub = e => { const r = ruler.getBoundingClientRect(); api.seek(clamp((e.clientX - r.left) / s.pxPerSec, 0, dur)); };
  ruler.addEventListener('pointerdown', e => { scrub(e); ruler.setPointerCapture(e.pointerId); const mv = ev => scrub(ev); ruler.addEventListener('pointermove', mv); ruler.addEventListener('pointerup', () => ruler.removeEventListener('pointermove', mv), { once: true }); });
  rows.addEventListener('pointerdown', e => { if (e.target === rows || e.target.classList.contains('tl-row')) { scrub(e); api.select(null); } });
  const resize = h('div', { class: 'tl-resize', title: 'Seret untuk mengubah tinggi timeline' });
  resize.addEventListener('pointerdown', e => { const ed = el.closest('.ed'); const y0 = e.clientY; const h0 = el.getBoundingClientRect().height; resize.setPointerCapture(e.pointerId); const mv = ev => { ed.style.setProperty('--tlh', clamp(h0 - (ev.clientY - y0), 120, innerHeight * 0.6) + 'px'); }; resize.addEventListener('pointermove', mv); resize.addEventListener('pointerup', () => { resize.removeEventListener('pointermove', mv); window.dispatchEvent(new Event('resize')); }, { once: true }); });
  el.replaceChildren(resize, tools, h('div', { class: 'tl-main' }, names, scroll));
  R = { scroll, playhead, names };
  if (prevScroll) { scroll.scrollLeft = prevScroll.l; scroll.scrollTop = prevScroll.t; names.scrollTop = prevScroll.t; }
  drawPlayhead();
}
function zoom(v, api) { E.s.pxPerSec = clamp(v, 8, 400); buildTimeline(document.querySelector('.timeline'), api); }
export function drawPlayhead() {
  if (!R || !E.s) return; const x = E.s.t * E.s.pxPerSec; R.playhead.style.left = x + 'px'; R.playhead.style.height = R.scroll.scrollHeight + 'px';
  if (E.s.playing) { const sc = R.scroll; if (x > sc.scrollLeft + sc.clientWidth - 40 || x < sc.scrollLeft) sc.scrollLeft = Math.max(0, x - 60); }
}
function startDrag(e, clip, m, api) {
  if (e.button !== 0) return; e.preventDefault();
  let reselect = false; if (m.id && E.s.sel !== m.id) { E.s.sel = m.id; reselect = true; document.querySelectorAll('.clip[aria-selected="true"], .tl-name[aria-selected="true"]').forEach(x => x.setAttribute('aria-selected', 'false')); clip.setAttribute('aria-selected', 'true'); hooks.props(); hooks.left(); hooks.canvas(); }
  const s = E.s; const mode = e.target.dataset.h || 'move'; if (mode !== 'move' && !m.trim) return; if (mode === 'l' && m.noLeft) return;
  const x0 = e.clientX; const a0 = m.a, b0 = m.b; let moved = false;
  // snap targets: playhead, start, other clip edges
  const edges = [0, s.t, ...s.p.layers.filter(l => l.id !== m.id).flatMap(l => [l.start, l.end])];
  const snapT = (t) => { const tol = 6 / s.pxPerSec; for (const v of edges) if (Math.abs(t - v) < tol) return v; return t; };
  const target = clip; target.setPointerCapture(e.pointerId);
  const mv = ev => {
    const dt = (ev.clientX - x0) / s.pxPerSec; if (!moved && Math.abs(ev.clientX - x0) < 3) return; if (!moved) { snap(); moved = true; }
    let a = a0, b = b0; const fps = s.p.fps; const q = v => Math.round(v * fps) / fps;
    if (mode === 'move') { a = Math.max(0, q(a0 + dt)); const sa = snapT(a), sb = snapT(a + (b0 - a0)); if (sa !== a) a = sa; else if (sb !== a + (b0 - a0)) a = sb - (b0 - a0); a = Math.max(0, a); b = a + (b0 - a0); }
    else if (mode === 'l') { a = clamp(snapT(q(a0 + dt)), 0, b0 - 1 / fps); }
    else { b = Math.max(a0 + 1 / fps, snapT(q(b0 + dt))); if (m.max) b = Math.min(b, a0 + m.max); }
    m.set(a, b); clip.style.left = a * s.pxPerSec + 'px'; clip.style.width = Math.max(6, (b - a) * s.pxPerSec) + 'px'; s.dirty = true;
    hooks.canvas();
  };
  target.addEventListener('pointermove', mv);
  target.addEventListener('pointerup', () => { target.removeEventListener('pointermove', mv); if (moved) changed('canvas tl props left'); else if (reselect) hooks.tl(); }, { once: true });
}

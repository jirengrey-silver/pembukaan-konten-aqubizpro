// Editor workspace: top bar, preview canvas with guides and direct manipulation, playback, shortcuts, saving.
import { api } from '../api.js';
import { h, $, icon, toast, modal, promptBox, img, onImageLoad, fmtTime } from './dom.js';
import { E, hooks, session, sel, snap, changed, undo, redo } from './ed-state.js';
import { PRESETS, presetOf, changePreset, projectDuration, hitTest, layerBox } from '../engine/scene.js';
import { clamp } from '../engine/util.js';
import { draw, thumbnail } from './render.js';
import { buildLeft, buildProps, RAIL, removeLayer, duplicateLayer } from './panels.js';
import { buildTimeline, drawPlayhead } from './timeline.js';
import { openExport } from './exportdlg.js';
import { nav } from './nav.js';

let els = null; let raf = 0; let offImg = null; let audioEls = new Map(); let keyBound = false; let ro = null;

export const editorState = () => E.s;
export async function openEditor(p) {
  if (!p) return;
  if (!p.audio) p.audio = [];
  session(p); stopPlay();
  buildLayout();
  if (!keyBound) { document.addEventListener('keydown', onKey); keyBound = true; }
  offImg && offImg(); offImg = onImageLoad(() => hooks.canvas());
}
export async function leaveEditor() {
  const s = E.s; if (!s) return true;
  if (s.dirty) {
    const r = await new Promise(res => modal({ title: 'Simpan perubahan?', body: h('p', { style: { margin: 0, color: 'var(--sub)' } }, `Ada perubahan pada "${s.p.name}" yang belum disimpan.`),
      actions: [{ label: 'Batal', value: 'cancel' }, { label: 'Jangan simpan', value: 'discard' }, { label: 'Simpan', kind: 'gold', value: 'save' }], onClose: v => res(v || 'cancel') }));
    if (r === 'cancel') return false;
    if (r === 'save') { if (!(await save())) return false; } else await api.projects.discardRecovery(s.p.id).catch(() => {});
  }
  stopPlay(); for (const a of audioEls.values()) { a.pause(); a.src = ''; } audioEls.clear();
  ro && ro.disconnect(); E.s = null; els = null; return true;
}
export async function save() {
  const s = E.s; if (!s) return false;
  try { s.p.thumbnail = await thumbnail(s.p); await api.projects.save(s.p); s.dirty = false; s.savedAt = Date.now(); hooks.title(); toast('Proyek disimpan', 'ok', 1800); return true; }
  catch (e) { toast('Gagal menyimpan: ' + e.message, 'err', 7000); return false; }
}

/* ---------- layout ---------- */
function buildLayout() {
  const s = E.s;
  const title = h('button', { class: 'btn ghost', title: 'Ganti nama proyek', onclick: async () => { const n = await promptBox('Ganti nama proyek', 'Nama proyek', s.p.name); if (n) { snap(); s.p.name = n; changed(''); } } });
  const status = h('span', { class: 'hint', style: { minWidth: '170px' } });
  const undoB = h('button', { class: 'btn ghost icon', 'aria-label': 'Urungkan (Ctrl+Z)', title: 'Urungkan (Ctrl+Z)', onclick: () => undo() }, icon('undo'));
  const redoB = h('button', { class: 'btn ghost icon', 'aria-label': 'Ulangi (Ctrl+Y)', title: 'Ulangi (Ctrl+Y)', onclick: () => redo() }, icon('redo'));
  $('#topbar').replaceChildren(
    h('button', { class: 'btn ghost', onclick: () => nav.dashboard('home') }, icon('back'), 'Dashboard'),
    h('div', { class: 'brandmark' }, h('i', null, 'Q')), title, status, h('div', { style: { flex: 1 } }), undoB, redoB,
    h('button', { class: 'btn', onclick: save, title: 'Simpan (Ctrl+S)' }, icon('save'), 'Simpan'),
    h('button', { class: 'btn gold', onclick: () => { stopPlay(); openExport(); }, title: 'Ekspor (Ctrl+E)' }, icon('export'), 'Ekspor'));
  hooks.title = () => {
    if (!E.s) return; title.replaceChildren(h('b', null, s.p.name), h('span', { class: 'tag', style: { marginLeft: '8px' } }, `${s.p.width}×${s.p.height}`));
    status.textContent = s.dirty ? (s.autosavedAt ? 'Belum disimpan · cadangan otomatis ' + new Date(s.autosavedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Belum disimpan') : (s.savedAt ? 'Tersimpan' : '');
    undoB.disabled = !s.undo.length; redoB.disabled = !s.redo.length;
  };

  const rail = h('nav', { class: 'lrail', 'aria-label': 'Panel editor' });
  const lpanel = h('aside', { class: 'lpanel', 'aria-label': 'Panel kiri' });
  for (const [k, label, ic] of RAIL) rail.append(h('button', { 'data-k': k, 'aria-current': String(s.left === k), title: label, onclick: () => { if (s.left === k) s.leftOpen = !s.leftOpen; else { s.left = k; s.leftOpen = true; } rail.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(b.dataset.k === s.left && s.leftOpen))); edEl.classList.toggle('left-closed', !s.leftOpen); hooks.left(); requestAnimationFrame(() => hooks.canvas()); } }, icon(ic), label));

  const canvas = h('canvas', { 'aria-label': 'Pratinjau video' }); const guides = h('canvas', { class: 'overlay' }); const selbox = h('div', { class: 'selbox', hidden: true });
  const wrap = h('div', { class: 'canvaswrap' }, canvas, guides, selbox);
  const stage = h('div', { class: 'stage fit', tabindex: '-1' }, wrap);
  const timeLbl = h('span', { class: 'time', 'aria-live': 'off' });
  const playB = h('button', { class: 'btn icon', 'aria-label': 'Putar (Spasi)', title: 'Putar / jeda (Spasi)', onclick: togglePlay }, icon('play'));
  const presetSel = h('select', { 'aria-label': 'Ukuran dan platform', title: 'Ganti ukuran / platform', onchange: e => { const P = presetOf(e.target.value); snap(); changePreset(s.p, P.id); changed('canvas tl props'); hooks.title(); toast(`Ukuran diganti ke ${P.label} (${P.w}×${P.h}). Posisi layer disesuaikan.`, 'info'); } },
    ['Vertikal', 'Horizontal', 'Persegi'].map(g => h('optgroup', { label: g }, PRESETS.filter(P => P.group === g).map(P => h('option', { value: P.id, selected: P.id === s.p.preset }, `${P.label} · ${P.w}×${P.h}`)))));
  const zoomSel = h('select', { 'aria-label': 'Zoom pratinjau', onchange: e => { s.zoom = e.target.value === 'fit' ? 'fit' : +e.target.value; stage.classList.toggle('fit', s.zoom === 'fit'); hooks.canvas(); } }, [['fit', 'Pas layar'], [0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, '100%']].map(([v, l]) => h('option', { value: v }, l)));
  const tog = (ic, label, key) => { const b = h('button', { class: 'btn icon ghost', 'aria-label': label, title: label, 'aria-pressed': String(!!s[key]), onclick: () => { s[key] = !s[key]; b.setAttribute('aria-pressed', String(s[key])); hooks.canvas(); } }, icon(ic)); return b; };
  const ctools = h('div', { class: 'ctools' },
    h('button', { class: 'btn icon ghost', 'aria-label': 'Ke awal (Home)', title: 'Ke awal (Home)', onclick: () => seek(0) }, icon('prev')),
    h('button', { class: 'btn icon ghost', 'aria-label': 'Mundur 1 frame', title: 'Mundur 1 frame (,)', onclick: () => step(-1) }, icon('back')), playB,
    h('button', { class: 'btn icon ghost', 'aria-label': 'Maju 1 frame', title: 'Maju 1 frame (.)', onclick: () => step(1) }, h('span', { style: { display: 'inline-flex', transform: 'scaleX(-1)' } }, icon('back'))), timeLbl,
    h('div', { class: 'sep' }), presetSel, h('div', { class: 'sep' }), zoomSel,
    tog('safe', 'Tampilkan area aman platform', 'safe'), tog('grid', 'Tampilkan grid', 'grid'),
    h('button', { class: 'btn icon ghost', 'aria-label': 'Layar penuh', title: 'Pratinjau layar penuh (F)', onclick: fullscreen }, icon('full')));
  const center = h('section', { class: 'center', 'aria-label': 'Pratinjau' }, ctools, stage);
  const rpanel = h('aside', { class: 'rpanel', 'aria-label': 'Properti' });
  const tl = h('section', { class: 'timeline', 'aria-label': 'Timeline' });
  const edEl = h('div', { class: 'ed' + (s.leftOpen ? '' : ' left-closed') }, rail, lpanel, center, rpanel, tl);
  $('#view').replaceChildren(edEl);
  els = { edEl, canvas, guides, selbox, wrap, stage, timeLbl, playB, presetSel, lpanel, rpanel, tl };

  hooks.canvas = renderCanvas;
  hooks.props = () => { if (E.s) buildProps(rpanel); };
  hooks.left = () => { if (E.s) buildLeft(lpanel); };
  hooks.tl = () => { if (E.s) buildTimeline(tl, { seek, select }); };
  hooks.title(); hooks.left(); hooks.props(); hooks.tl();
  ro = new ResizeObserver(() => renderCanvas()); ro.observe(stage);
  setupPointer();
  stage.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); const cur = s.zoom === 'fit' ? fitScale() : s.zoom; s.zoom = clamp(cur * (e.deltaY < 0 ? 1.1 : 0.9), 0.1, 2); stage.classList.remove('fit'); zoomSel.value = ''; renderCanvas(); }, { passive: false });
  renderCanvas();
}
export function select(id) { E.s.sel = id; hooks.props(); hooks.tl(); renderCanvas(); }

/* ---------- canvas ---------- */
function fitScale() { const r = els.stage.getBoundingClientRect(); const p = E.s.p; return Math.max(0.05, Math.min((r.width - 32) / p.width, (r.height - 32) / p.height)); }
let lastScale = 1;
function renderCanvas() {
  const s = E.s; if (!s || !els) return; const p = s.p;
  const sc = s.zoom === 'fit' ? fitScale() : s.zoom; lastScale = sc; const dpr = window.devicePixelRatio || 1;
  const cw = Math.round(p.width * sc), ch = Math.round(p.height * sc);
  for (const c of [els.canvas, els.guides]) { if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); } c.style.width = cw + 'px'; c.style.height = ch + 'px'; }
  const g = els.canvas.getContext('2d'); g.clearRect(0, 0, els.canvas.width, els.canvas.height); draw(g, p, s.t, sc * dpr);
  drawGuides(sc * dpr); placeSel(sc);
  const dur = projectDuration(p); els.timeLbl.textContent = `${fmtTime(s.t)} / ${fmtTime(dur)}`;
  if (els.presetSel.value !== p.preset) els.presetSel.value = p.preset;
  drawPlayhead();
}
function drawGuides(k) {
  const s = E.s, p = s.p, g = els.guides.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, els.guides.width, els.guides.height); g.setTransform(k, 0, 0, k, 0, 0);
  if (s.grid) { g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1 / k; const step = Math.min(p.width, p.height) / 12; g.beginPath(); for (let x = step; x < p.width; x += step) { g.moveTo(x, 0); g.lineTo(x, p.height); } for (let y = step; y < p.height; y += step) { g.moveTo(0, y); g.lineTo(p.width, y); } g.stroke();
    g.strokeStyle = 'rgba(30,155,255,.5)'; g.beginPath(); g.moveTo(p.width / 2, 0); g.lineTo(p.width / 2, p.height); g.moveTo(0, p.height / 2); g.lineTo(p.width, p.height / 2); g.stroke(); }
  if (s.safe) {
    const sa = presetOf(p.preset).safe; g.fillStyle = 'rgba(255,107,125,.13)';
    g.fillRect(0, 0, p.width, sa.t); g.fillRect(0, p.height - sa.b, p.width, sa.b); g.fillRect(0, sa.t, sa.l, p.height - sa.t - sa.b); g.fillRect(p.width - sa.r, sa.t, sa.r, p.height - sa.t - sa.b);
    g.setLineDash([8 / k * (window.devicePixelRatio || 1), 6 / k * (window.devicePixelRatio || 1)]); g.strokeStyle = 'rgba(255,107,125,.75)'; g.lineWidth = 1.5 / k; g.strokeRect(sa.l, sa.t, p.width - sa.l - sa.r, p.height - sa.t - sa.b); g.setLineDash([]);
    g.fillStyle = 'rgba(255,170,180,.9)'; g.font = `600 ${11 * (window.devicePixelRatio || 1) / k}px "IBM Plex Sans", sans-serif`; g.textBaseline = 'top'; g.fillText('Area aman', sa.l + 6 / k, sa.t + 6 / k);
  }
  if (drag && drag.snapX) { g.strokeStyle = '#1E9BFF'; g.lineWidth = 2 / k; g.beginPath(); g.moveTo(p.width / 2, 0); g.lineTo(p.width / 2, p.height); g.stroke(); }
  if (drag && drag.snapY) { g.strokeStyle = '#1E9BFF'; g.lineWidth = 2 / k; g.beginPath(); g.moveTo(0, p.height / 2); g.lineTo(p.width, p.height / 2); g.stroke(); }
}
function placeSel(sc) {
  const l = sel(); const b = els.selbox;
  if (!l || l.hidden || E.s.t < l.start || E.s.t >= l.end) { b.hidden = true; return; }
  const box = layerBox(l, E.s.p); b.hidden = false;
  Object.assign(b.style, { left: box.x * sc + 'px', top: box.y * sc + 'px', width: box.w * sc + 'px', height: box.h * sc + 'px', transform: l.rotation && l.type !== 'roulette' ? `rotate(${l.rotation}deg)` : '', borderStyle: l.type === 'roulette' ? 'dashed' : 'solid' });
  if (l.type !== 'roulette' && !l.locked) { if (b.children.length !== 4) { b.replaceChildren(...['nw', 'ne', 'sw', 'se'].map(c => h('i', { 'data-c': c, style: { pointerEvents: 'auto', cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize', left: c[1] === 'w' ? '-5px' : '', right: c[1] === 'e' ? '-5px' : '', top: c[0] === 'n' ? '-5px' : '', bottom: c[0] === 's' ? '-5px' : '' } }))); } }
  else b.replaceChildren();
}
let drag = null;
function setupPointer() {
  const c = els.canvas;
  const pt = e => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) / lastScale, y: (e.clientY - r.top) / lastScale }; };
  c.addEventListener('pointerdown', e => {
    if (e.button !== 0) return; const s = E.s; const q = pt(e); const l = hitTest(s.p, s.t, q.x, q.y);
    if ((l ? l.id : null) !== s.sel) select(l ? l.id : null);
    if (l && l.type !== 'roulette' && !l.locked) { drag = { kind: 'move', l, ox: q.x - l.x, oy: q.y - l.y, moved: false }; c.setPointerCapture(e.pointerId); }
  });
  els.selbox.addEventListener('pointerdown', e => {
    const corner = e.target.dataset && e.target.dataset.c; if (!corner) return; e.stopPropagation(); const l = sel(); if (!l) return;
    const q = pt(e); drag = { kind: 'scale', l, d0: Math.hypot(q.x - l.x, q.y - l.y) || 1, s0: l.scale, moved: false }; e.target.setPointerCapture(e.pointerId);
    e.target.addEventListener('pointermove', onMove); e.target.addEventListener('pointerup', onUp, { once: true });
  });
  const onMove = e => {
    if (!drag) return; const q = pt(e); const l = drag.l; const p = E.s.p;
    if (!drag.moved) { snap(); drag.moved = true; }
    if (drag.kind === 'move') {
      let x = q.x - drag.ox, y = q.y - drag.oy; const tol = 10 / lastScale;
      drag.snapX = !e.altKey && Math.abs(x - p.width / 2) < tol; drag.snapY = !e.altKey && Math.abs(y - p.height / 2) < tol;
      if (drag.snapX) x = p.width / 2; if (drag.snapY) y = p.height / 2; l.x = Math.round(x); l.y = Math.round(y);
    } else { l.scale = clamp(+(drag.s0 * Math.hypot(q.x - l.x, q.y - l.y) / drag.d0).toFixed(3), 0.05, 20); }
    E.s.dirty = true; renderCanvas();
  };
  const onUp = e => { if (drag && drag.moved) { drag = null; changed('canvas props'); } drag = null; renderCanvas(); if (e.target.removeEventListener) e.target.removeEventListener('pointermove', onMove); };
  c.addEventListener('pointermove', onMove); c.addEventListener('pointerup', onUp); c.addEventListener('pointercancel', onUp);
  c.addEventListener('dblclick', () => { const l = sel(); if (l && l.type === 'text') { const f = $('#prop-text'); f && (f.focus(), f.select()); } });
}

/* ---------- playback ---------- */
export function seek(t) { const s = E.s; s.t = clamp(t, 0, projectDuration(s.p)); if (s.playing) syncAudio(true); renderCanvas(); }
function step(n) { const s = E.s; stopPlay(); seek(Math.round(s.t * s.p.fps + n) / s.p.fps); }
function togglePlay() { E.s.playing ? stopPlay() : startPlay(); }
function startPlay() {
  const s = E.s; const dur = projectDuration(s.p); if (s.t >= dur - 1 / s.p.fps) s.t = 0;
  s.playing = true; els.playB.replaceChildren(icon('pause')); els.playB.setAttribute('aria-label', 'Jeda (Spasi)');
  let last = performance.now();
  const tick = now => { if (!E.s || !s.playing) return; s.t += (now - last) / 1000; last = now; if (s.t >= dur) { s.t = dur; renderCanvas(); stopPlay(); return; } syncAudio(false); renderCanvas(); raf = requestAnimationFrame(tick); };
  syncAudio(true); raf = requestAnimationFrame(tick);
}
export function stopPlay() {
  cancelAnimationFrame(raf); if (E.s) E.s.playing = false; for (const a of audioEls.values()) a.pause();
  if (els) { els.playB.replaceChildren(icon('play')); els.playB.setAttribute('aria-label', 'Putar (Spasi)'); }
}
function syncAudio(force) {
  const s = E.s; const live = new Set();
  for (const tr of s.p.audio || []) {
    if (!tr.assetId) continue; live.add(tr.id);
    let a = audioEls.get(tr.id); if (!a || a.dataset.asset !== tr.assetId) { if (a) a.pause(); a = new Audio(api.assetUrl(tr.assetId)); a.dataset.asset = tr.assetId; a.preload = 'auto'; audioEls.set(tr.id, a); }
    const d = tr.duration || (isFinite(a.duration) ? a.duration - (tr.trimStart || 0) : 1e9); const lt = s.t - (tr.start || 0);
    if (tr.muted || lt < 0 || lt >= d) { if (!a.paused) a.pause(); continue; }
    let v = tr.volume ?? 1; if (tr.fadeIn) v *= clamp(lt / tr.fadeIn); if (tr.fadeOut) v *= clamp((d - lt) / tr.fadeOut); a.volume = clamp(v);
    const want = (tr.trimStart || 0) + lt; if (force || a.paused || Math.abs(a.currentTime - want) > 0.3) { try { a.currentTime = want; } catch (e) { /* not loaded yet */ } }
    if (a.paused) a.play().catch(() => {});
  }
  for (const [id, a] of audioEls) if (!live.has(id)) { a.pause(); audioEls.delete(id); }
}
function fullscreen() {
  const wrap = els.wrap; if (document.fullscreenElement) { document.exitFullscreen(); return; }
  const host = els.stage; host.requestFullscreen().then(() => { E.s.zoom = 'fit'; renderCanvas(); }).catch(e => toast('Layar penuh tidak tersedia: ' + e.message, 'warn'));
  document.addEventListener('fullscreenchange', () => setTimeout(renderCanvas, 50), { once: true }); return wrap;
}

/* ---------- keyboard ---------- */
function onKey(e) {
  const s = E.s; if (!s || !els || document.querySelector('.modal-bg')) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !(e.target.type === 'range' || e.target.type === 'checkbox');
  const mod = e.ctrlKey || e.metaKey; const k = e.key.toLowerCase();
  if (mod && k === 's') { e.preventDefault(); save(); return; }
  if (mod && k === 'e') { e.preventDefault(); stopPlay(); openExport(); return; }
  if (typing) return;
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && k === 'y') { e.preventDefault(); redo(); return; }
  if (mod && k === 'd') { e.preventDefault(); const l = sel(); if (l) duplicateLayer(l); return; }
  if (e.key === ' ') { e.preventDefault(); togglePlay(); return; }
  if (e.key === 'Home') { e.preventDefault(); stopPlay(); seek(0); return; }
  if (e.key === 'End') { e.preventDefault(); stopPlay(); seek(projectDuration(s.p)); return; }
  if (e.key === ',' || e.key === '.') { e.preventDefault(); step(e.key === ',' ? -1 : 1); return; }
  if (k === 'f' && !mod) { e.preventDefault(); fullscreen(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel()) { e.preventDefault(); removeLayer(sel()); return; }
  if (e.key === 'Escape' && s.sel) { select(null); return; }
  if (e.key.startsWith('Arrow')) {
    const l = sel(); const d = e.shiftKey ? 10 : 1;
    if (l && l.type !== 'roulette' && !l.locked) { e.preventDefault(); snap('nudge' + l.id); if (e.key === 'ArrowLeft') l.x -= d; if (e.key === 'ArrowRight') l.x += d; if (e.key === 'ArrowUp') l.y -= d; if (e.key === 'ArrowDown') l.y += d; changed('canvas props'); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); step((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? s.p.fps : 1)); }
  }
}
export { img };

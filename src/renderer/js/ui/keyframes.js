// Keyframe editing for the Cinematic Brand Roulette layer: timeline tracks with draggable keys,
// "keyframe at playhead" value fields, and the selected-key inspector (scene, position, value, easing).
import { h, icon, toast, fmtTime } from './dom.js';
import { E, snap, changed, hooks } from './ed-state.js';
import { CINE_PROPS, propOf, EASINGS, cineSceneTimes, keyTime, toSceneRel, evalProp, sortedKeys, defaultTracks, cineDuration } from '../engine/cinematic.js';
import { clamp, uid } from '../engine/util.js';

const lay = id => E.s.p.layers.find(l => l.id === id);
const local = l => E.s.t - l.start;
const frameTol = l => 0.5 / (E.s.p.fps || 30);
export function keyAt(l, prop, tl) { const S = cineSceneTimes(l.params); return (l.params.tracks[prop] || []).find(k => Math.abs(keyTime(S, k) - tl) <= frameTol(l)) || null; }
export function setKeyAt(l, prop, tl, v, snapKey) {
  snap(snapKey || 'kf' + l.id + prop + tl.toFixed(3)); const q = l.params; const list = q.tracks[prop] || (q.tracks[prop] = []);
  const ex = keyAt(l, prop, tl); if (ex) { ex.v = v; return ex; }
  const ks = sortedKeys(q, prop); const prev = ks.filter(x => x.t <= tl).pop(); const rel = toSceneRel(q, tl);
  const k = { id: uid(), s: rel.s, u: +rel.u.toFixed(5), v, e: prev ? prev.k.e : 'inOutSine' }; list.push(k); return k;
}
export function deleteKey(sk) { const l = lay(sk.lid); if (!l) return; snap(); const list = l.params.tracks[sk.prop] || []; const i = list.findIndex(k => k.id === sk.id); if (i >= 0) list.splice(i, 1); E.s.selKey = null; changed('canvas tl props'); }
function findSel() { const sk = E.s.selKey; if (!sk) return null; const l = lay(sk.lid); const k = l && (l.params.tracks[sk.prop] || []).find(x => x.id === sk.id); return k ? { l, k, prop: sk.prop } : null; }
const fmtV = (v, step) => (step < 1 ? (+v).toFixed(step < 0.01 ? 3 : 2) : String(Math.round(v)));

/* ---------- properties panel sections ---------- */
export function selectedKeySection(group) {
  const f = findSel(); if (!f) return null; const { l, k, prop } = f; const P = propOf(prop); const q = l.params; const S = cineSceneTimes(q);
  const sceneSel = h('select', { 'aria-label': 'Scene keyframe' }, q.scenes.map(sc => h('option', { value: sc.id, selected: sc.id === k.s }, sc.label)));
  sceneSel.addEventListener('change', () => { snap(); k.s = sceneSel.value; changed('canvas tl props'); });
  const pos = h('input', { type: 'number', min: 0, max: 100, step: 1, value: String(Math.round(k.u * 100)), 'aria-label': 'Posisi dalam scene (%)' }); pos.addEventListener('change', () => { snap(); k.u = clamp((+pos.value || 0) / 100); changed('canvas tl props'); });
  const val = h('input', { type: 'number', min: P.min, max: P.max, step: P.step, value: fmtV(k.v, P.step), 'aria-label': 'Nilai' }); val.addEventListener('change', () => { const v = clamp(+val.value, P.min, P.max); if (!isFinite(v)) return; snap('kv' + k.id); k.v = v; changed('canvas tl'); });
  const es = h('select', { 'aria-label': 'Easing ke keyframe berikutnya' }, Object.entries(EASINGS).map(([id, [lab]]) => h('option', { value: id, selected: id === k.e }, lab))); es.addEventListener('change', () => { snap(); k.e = es.value; changed('canvas tl'); });
  const at = keyTime(S, k);
  return group('Keyframe terpilih', h('div', { class: 'flex', style: { justifyContent: 'space-between' } }, h('b', null, P.label), h('span', { class: 'tag gold' }, fmtTime(l.start + at))),
    h('div', { class: 'g2' }, h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Scene'), sceneSel), h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Posisi dalam scene (%)'), pos)),
    h('div', { class: 'g2' }, h('div', { class: 'row' }, h('span', { class: 'lab' }, `Nilai (${P.min}–${P.max})`), val), h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Easing ke key berikutnya'), es)),
    h('div', { class: 'g2' }, h('button', { class: 'btn sm', onclick: () => { import('./editor.js').then(m => m.seek(l.start + at)); } }, 'Lompat ke key'), h('button', { class: 'btn sm danger', onclick: () => deleteKey(E.s.selKey) }, icon('trash'), 'Hapus key')),
    h('p', { class: 'hint' }, 'Easing berlaku untuk perpindahan dari key ini ke key berikutnya. Seret berlian di timeline untuk menggeser waktunya.'));
}
export function playheadSection(l, group) {
  const q = l.params; const tl = local(l); const S = cineSceneTimes(q); const groups = [...new Set(CINE_PROPS.map(p => p.group))];
  const inside = tl >= 0 && tl <= cineDuration(q);
  const rows = groups.map(gname => h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'lab', style: { color: 'var(--gold)' } }, gname), CINE_PROPS.filter(p => p.group === gname).map(P => {
    const ex = keyAt(l, P.key, tl); const v = evalProp(q, P.key, tl, S);
    const inp = h('input', { type: 'number', min: P.min, max: P.max, step: P.step, value: fmtV(v, P.step), 'aria-label': P.label, disabled: !inside });
    inp.addEventListener('change', () => { const nv = clamp(+inp.value, P.min, P.max); if (!isFinite(nv)) return; setKeyAt(l, P.key, tl, nv); changed('canvas tl props'); });
    const dia = h('button', { class: 'btn ghost icon sm', title: ex ? 'Hapus keyframe di playhead' : 'Tambah keyframe di playhead', 'aria-label': (ex ? 'Hapus' : 'Tambah') + ' keyframe ' + P.label, 'aria-pressed': String(!!ex), disabled: !inside,
      onclick: () => { if (ex) deleteKey({ lid: l.id, prop: P.key, id: ex.id }); else { setKeyAt(l, P.key, tl, v); changed('canvas tl props'); } } }, diamond(!!ex));
    return h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 84px 28px', gap: '6px', alignItems: 'center' } }, h('span', { style: { fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: P.label }, P.label.replace(/^[^·]+· /, '')), inp, dia);
  })));
  return group('Keyframe di playhead', h('p', { class: 'hint' }, inside ? `Waktu ${fmtTime(E.s.t)}. Ubah angka untuk membuat atau memperbarui keyframe di posisi ini; ◆ terisi berarti sudah ada keyframe.` : 'Pindahkan playhead ke dalam layer ini untuk mengedit keyframe.'), ...rows,
    h('button', { class: 'btn sm', onclick: () => { snap(); q.tracks = defaultTracks(); E.s.selKey = null; changed('canvas tl props'); toast('Semua keyframe dikembalikan ke storyboard bawaan', 'ok'); } }, 'Kembalikan semua keyframe ke bawaan'));
}
function diamond(filled, size = 12) { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 12 12'); s.setAttribute('width', size); s.setAttribute('height', size); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M6 1 L11 6 L6 11 L1 6 Z'); p.setAttribute('fill', filled ? '#F2A93B' : 'none'); p.setAttribute('stroke', '#F2A93B'); p.setAttribute('stroke-width', '1.4'); s.append(p); return s; }

/* ---------- timeline tracks ---------- */
const SCENE_COLORS = ['#F2A93B', '#1E9BFF', '#F57C1F', '#3DDC97', '#B78BFF', '#FFD36B'];
export function sceneSegments(l, pps) { const q = l.params; const S = cineSceneTimes(q); return q.scenes.map((sc, i) => h('div', { class: 'seg', title: `${i + 1}. ${sc.label} · ${S[sc.id].d.toFixed(2)} dtk`, style: { left: S[sc.id].a * pps + 'px', width: S[sc.id].d * pps + 'px', background: SCENE_COLORS[i % 6] + '66' } }, h('span', { style: { position: 'absolute', left: '4px', top: '1px', fontSize: '10px', color: '#071022', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '100%' } }, `${i + 1} ${sc.label}`))); }
export function keyframeRows(l, pps, width) {
  const s = E.s; const q = l.params; const S = cineSceneTimes(q);
  const props = CINE_PROPS.filter(P => s.kfAll || (q.tracks[P.key] || []).length);
  const names = [], rows = [];
  names.push(h('div', { class: 'tl-name kf-head', style: { height: '22px', fontSize: '11px', color: 'var(--sub)', paddingLeft: '18px' } }, h('button', { style: { fontSize: '11px', color: 'var(--blue)' }, onclick: () => { s.kfAll = !s.kfAll; hooks.tl(); } }, s.kfAll ? 'Hanya properti berkey' : `Semua properti (${CINE_PROPS.length})`)));
  rows.push(h('div', { class: 'tl-row', style: { height: '22px' } }, ...q.scenes.map(sc => h('div', { style: { position: 'absolute', top: 0, bottom: 0, left: (l.start + S[sc.id].a) * pps + 'px', borderLeft: '1px dashed rgba(147,168,205,.25)' } }))));
  for (const P of props) {
    names.push(h('div', { class: 'tl-name', style: { height: '22px', fontSize: '11.5px', paddingLeft: '18px' }, title: P.label },
      h('span', { class: 'nm' }, P.label), h('button', { 'aria-label': 'Tambah keyframe ' + P.label + ' di playhead', title: 'Tambah keyframe di playhead', onclick: () => { const tl = local(l); if (tl < 0 || tl > cineDuration(q)) return toast('Playhead di luar layer ini', 'warn'); const k = setKeyAt(l, P.key, tl, evalProp(q, P.key, tl)); s.selKey = { lid: l.id, prop: P.key, id: k.id }; changed('canvas tl props'); } }, diamond(false, 10))));
    const row = h('div', { class: 'tl-row', style: { height: '22px' } });
    for (const sc of q.scenes) row.append(h('div', { style: { position: 'absolute', top: 0, bottom: 0, left: (l.start + S[sc.id].a) * pps + 'px', borderLeft: '1px dashed rgba(147,168,205,.18)' } }));
    // value curve preview between keys
    const ks = sortedKeys(q, P.key); if (ks.length > 1) { const a = ks[0].t, b = ks[ks.length - 1].t; const cv = h('canvas', { width: Math.max(2, Math.ceil((b - a) * pps)), height: 22, style: { position: 'absolute', left: (l.start + a) * pps + 'px', top: 0, pointerEvents: 'none', opacity: 0.55 } }); const g = cv.getContext('2d'); g.strokeStyle = '#1E9BFF'; g.lineWidth = 1.2; g.beginPath(); for (let x = 0; x <= cv.width; x += 2) { const v = evalProp(q, P.key, a + x / pps, S); const y = 19 - (v - P.min) / (P.max - P.min || 1) * 16; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); row.append(cv); }
    for (const { k, t } of ks) {
      const isSel = s.selKey && s.selKey.id === k.id;
      const d = h('button', { class: 'kf', 'aria-label': `Keyframe ${P.label} di ${fmtTime(l.start + t)}, nilai ${fmtV(k.v, P.step)}`, title: `${P.label}\n${fmtTime(l.start + t)} · nilai ${fmtV(k.v, P.step)} · ${EASINGS[k.e] ? EASINGS[k.e][0] : k.e}`, 'aria-pressed': String(!!isSel), style: { left: ((l.start + t) * pps - 7) + 'px' } }, diamond(true, 14));
      d.addEventListener('pointerdown', e => dragKey(e, d, l, P.key, k, pps));
      row.append(d);
    }
    row.addEventListener('dblclick', e => { if (e.target !== row) return; const r = row.getBoundingClientRect(); const tl = clamp((e.clientX - r.left) / pps - l.start, 0, cineDuration(q)); const k = setKeyAt(l, P.key, tl, evalProp(q, P.key, tl)); s.selKey = { lid: l.id, prop: P.key, id: k.id }; changed('canvas tl props'); });
    row.dataset.prop = P.key; rows.push(row);
  }
  return { names, rows };
}
function dragKey(e, el, l, prop, k, pps) {
  if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); el.focus({ preventScroll: true }); const s = E.s; const q = l.params;
  const was = s.selKey && s.selKey.id === k.id; s.selKey = { lid: l.id, prop, id: k.id }; document.querySelectorAll('.kf[aria-pressed="true"]').forEach(x => x.setAttribute('aria-pressed', 'false')); el.setAttribute('aria-pressed', 'true');
  if (!was) hooks.props();
  const row = el.parentElement; const r0 = row.getBoundingClientRect(); const x0 = e.clientX; let moved = false; const dur = cineDuration(q); const fps = s.p.fps || 30;
  const others = sortedKeys(q, prop).filter(x => x.k !== k).map(x => x.t);
  el.setPointerCapture(e.pointerId);
  const mv = ev => {
    if (!moved && Math.abs(ev.clientX - x0) < 3) return; if (!moved) { snap(); moved = true; }
    let tl = clamp((ev.clientX - r0.left) / pps - l.start, 0, dur); tl = Math.round(tl * fps) / fps;
    const tol = 6 / pps; const ph = local(l); if (Math.abs(tl - ph) < tol) tl = ph;
    if (others.some(t => Math.abs(t - tl) < 0.5 / fps)) return; // never stack two keys on one frame
    const rel = toSceneRel(q, tl); k.s = rel.s; k.u = +rel.u.toFixed(5); el.style.left = ((l.start + tl) * pps - 7) + 'px'; s.dirty = true; hooks.canvas();
  };
  el.addEventListener('pointermove', mv);
  el.addEventListener('pointerup', () => { el.removeEventListener('pointermove', mv); if (moved) changed('canvas tl props'); else if (!was) hooks.tl(); }, { once: true });
}

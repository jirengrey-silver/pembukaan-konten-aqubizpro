// Left panels (layers, brands, text styles, media, background, audio) and the right properties panel.
import { api, ASSET_CATS } from '../api.js';
import { h, icon, toast, modal, confirmBox, customFonts, dropAsset, fmtTime } from './dom.js';
import { E, sel, snap, changed, num, range, color, text, select, check, seg } from './ed-state.js';
import { newLayer, LAYER_TYPES, projectDuration, presetOf } from '../engine/scene.js';
import { FONTS, uid, QB } from '../engine/util.js';
import { STAGES, ACCEL, rouletteDuration, stageTimes, orbitSet } from '../engine/roulette.js';
import { cineSet, cineDuration, cineSceneTimes, cineMissingLogos } from '../engine/cinematic.js';
import { FULLFRAME } from '../engine/scene.js';
import { selectedKeySection, playheadSection } from './keyframes.js';
import { assetThumb, afterImport } from './dashboard.js';

export const RAIL = [['layers', 'Layer', 'layers'], ['brand', 'Brand', 'star'], ['text', 'Teks', 'text'], ['media', 'Media', 'image'], ['bg', 'Latar', 'grid'], ['audio', 'Audio', 'music'], ['tpl', 'Template', 'template'], ['anim', 'Animasi', 'roulette']];
const KIND_COLOR = { roulette: '#F2A93B', text: '#1E9BFF', image: '#3DDC97', logo: '#B78BFF', shape: '#93A4C3' };
const p = () => E.s.p;
const roulette = () => p().layers.find(l => l.type === 'cinematic') || p().layers.find(l => l.type === 'roulette');
const setOf = l => (l.type === 'cinematic' ? cineSet(l.params) : orbitSet(l.params));
const group = (title, ...kids) => h('div', { class: 'group' }, h('h3', null, title), ...kids);

/* ---------- layer operations ---------- */
export function addLayer(type, extra = {}) {
  const s = E.s; snap(); const l = newLayer(type, s.p, Object.assign({ start: FULLFRAME(type) ? 0 : Math.min(s.t, projectDuration(s.p) - 0.5) }, extra));
  if (!FULLFRAME(type) && !('end' in extra)) l.end = Math.max(l.start + 1, Math.min(projectDuration(s.p), l.start + 5));
  if (FULLFRAME(type)) { s.p.layers.unshift(l); s.p.duration = Math.max(s.p.duration, l.end); } else s.p.layers.push(l);
  s.sel = l.id; changed('canvas tl props left'); return l;
}
export function removeLayer(l) { snap(); const s = E.s; s.p.layers = s.p.layers.filter(x => x.id !== l.id); if (s.sel === l.id) s.sel = null; changed('canvas tl props left'); toast(`Layer "${l.name}" dihapus · Ctrl+Z untuk membatalkan`, 'info', 2600); }
export function duplicateLayer(l) { snap(); const c = JSON.parse(JSON.stringify(l)); c.id = uid(); c.name = l.name + ' (salinan)'; if (!FULLFRAME(c.type)) { c.x += 30; c.y += 30; } if (c.params) c.params.brands.forEach(b => { b.id = b.id; }); const i = p().layers.indexOf(l); p().layers.splice(i + 1, 0, c); E.s.sel = c.id; changed('canvas tl props left'); }
export function moveLayer(l, d) { const L = p().layers; const i = L.indexOf(l); const j = i + d; if (j < 0 || j >= L.length) return; snap(); L.splice(i, 1); L.splice(j, 0, l); changed('canvas tl left'); }

/* ---------- asset picker ---------- */
export function pickAsset(cats, title = 'Pilih aset') {
  return new Promise(async res => {
    let done = false; const finish = v => { if (!done) { done = true; res(v); } };
    const grid = h('div', { class: 'agrid', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' } });
    const fill = async () => { const list = (await api.assets.list()).filter(a => cats.includes(a.category)); grid.replaceChildren(...(list.length ? list.map(a => h('button', { class: 'acard', style: { padding: 0, textAlign: 'left', cursor: 'pointer' }, onclick: () => { finish(a); m.close(); } }, h('div', { class: 'th' }, assetThumb(a)), h('div', { class: 'meta' }, h('b', null, a.name), h('span', null, ASSET_CATS[a.category].label)))) : [h('div', { class: 'empty', style: { gridColumn: '1 / -1' } }, h('b', null, 'Belum ada aset'), 'Klik "Impor file" untuk menambahkan.')])); };
    const catSel = cats.length > 1 ? h('select', { 'aria-label': 'Jenis aset' }, cats.map(c => h('option', { value: c }, ASSET_CATS[c].label))) : null;
    const m = modal({ title, wide: true, body: h('div', { class: 'stack' }, h('div', { class: 'flex' }, catSel, h('button', { class: 'btn gold', onclick: async () => { const r = await api.assets.importDialog(catSel ? catSel.value : cats[0]); afterImport(r); if (r.added.length === 1) { finish(r.added[0]); m.close(); } else fill(); } }, icon('upload'), 'Impor file'), h('span', { class: 'hint' }, 'Format: ' + [...new Set(cats.flatMap(c => ASSET_CATS[c].exts))].join(', '))), grid),
      actions: [{ label: 'Batal' }], onClose: () => finish(null) });
    fill();
  });
}

/* ---------- left panel ---------- */
export function buildLeft(el) {
  const s = E.s; const k = s.left; const [, label] = RAIL.find(r => r[0] === k);
  const body = h('div', { class: 'pb scroll' }); el.replaceChildren(h('div', { class: 'ph' }, h('h2', null, label)), body);
  body.append(...[({ layers: leftLayers, brand: leftBrands, text: leftText, media: leftMedia, bg: leftBg, audio: leftAudio, tpl: leftTpl, anim: leftAnim }[k])()].flat());
}
function leftLayers() {
  const add = h('div', { class: 'g2' }, [['text', 'Teks', 'text'], ['image', 'Gambar', 'image'], ['logo', 'Logo', 'star'], ['shape', 'Bentuk', 'shape']].map(([t, l, ic]) => h('button', { class: 'btn sm', onclick: () => addLayer(t) }, icon(ic), l)));
  const rb = roulette() ? null : h('div', { class: 'stack', style: { gap: '6px' } }, h('button', { class: 'btn gold', onclick: () => addLayer('cinematic') }, icon('roulette'), 'Tambah Cinematic Brand Roulette'), h('button', { class: 'btn sm', onclick: () => addLayer('roulette') }, 'Tambah Brand Roulette (kotak misteri)'));
  const list = h('div', { class: 'stack', style: { gap: '4px' } });
  const L = p().layers.slice().reverse();
  for (const l of L) list.append(h('div', { class: 'brow' + (E.s.sel === l.id ? ' sel' : '') + (l.hidden ? ' off' : ''), style: { gridTemplateColumns: '6px minmax(0,1fr) auto', cursor: 'pointer' }, onclick: () => selectFromPanel(l.id) },
    h('span', { style: { width: '6px', height: '26px', borderRadius: '3px', background: KIND_COLOR[l.type] } }),
    h('div', { style: { minWidth: 0 } }, h('div', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, l.name || LAYER_TYPES[l.type]), h('div', { class: 'hint', style: { fontSize: '11px' } }, `${LAYER_TYPES[l.type]} · ${fmtTime(l.start)}–${fmtTime(l.end)}`)),
    h('div', { class: 'flex', style: { gap: '0', flexWrap: 'nowrap' }, onclick: e => e.stopPropagation() },
      h('button', { class: 'btn ghost icon sm', 'aria-label': 'Naikkan', title: 'Naikkan (ke depan)', disabled: l === L[0], onclick: () => moveLayer(l, 1) }, icon('back', 'up')),
      h('button', { class: 'btn ghost icon sm', 'aria-label': l.hidden ? 'Tampilkan' : 'Sembunyikan', title: l.hidden ? 'Tampilkan' : 'Sembunyikan', onclick: () => { snap(); l.hidden = !l.hidden; changed('canvas tl left'); } }, icon(l.hidden ? 'eyeoff' : 'eye')),
      h('button', { class: 'btn ghost icon sm', 'aria-label': l.locked ? 'Buka kunci' : 'Kunci', title: l.locked ? 'Buka kunci' : 'Kunci posisi', onclick: () => { snap(); l.locked = !l.locked; changed('canvas left props'); } }, icon(l.locked ? 'lock' : 'unlock')),
      h('button', { class: 'btn ghost icon sm danger', 'aria-label': 'Hapus layer', title: 'Hapus layer', onclick: () => removeLayer(l) }, icon('trash')))));
  list.querySelectorAll('.up').forEach(i => { i.style.transform = 'rotate(90deg)'; });
  return [h('div', { class: 'stack' }, rb, h('span', { class: 'lab' }, 'Tambah layer di posisi playhead'), add, h('span', { class: 'lab', style: { marginTop: '6px' } }, `Urutan layer (${L.length}) · paling atas tampil paling depan`), L.length ? list : h('p', { class: 'hint' }, 'Belum ada layer.'))];
}
function selectFromPanel(id) { E.s.sel = id; changed('canvas tl props left'); E.s.dirty = E.s.dirty; }

/* brands */
function leftBrands() {
  const r = roulette();
  if (!r) return [h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Proyek ini belum memiliki layer Brand Roulette.'), h('button', { class: 'btn gold', onclick: () => { addLayer('cinematic'); } }, icon('roulette'), 'Tambah Cinematic Brand Roulette'))];
  const q = r.params; const set = setOf(r); const chosen = set.list[set.sel]; const cine = r.type === 'cinematic'; const missing = cine ? set.list.filter(b => !b.assetId).length : 0;
  const modeSeg = h('div', { class: 'flex', style: { gap: '4px' } }, [['random', 'Acak'], ['manual', 'Pilih sendiri']].map(([v, l]) => h('button', { class: 'btn sm', 'aria-pressed': String(q.selection === v), onclick: () => { snap(); q.selection = v; if (v === 'manual' && !q.selectedId && chosen) q.selectedId = chosen.id; changed('canvas left props'); } }, l)));
  const info = h('div', { class: 'card', style: { padding: '10px', background: 'var(--bg2)' } }, h('span', { class: 'lab' }, 'Brand yang akan terpilih'), h('div', { style: { fontFamily: 'var(--display)', fontWeight: 700, fontSize: '16px', color: 'var(--gold)' } }, chosen ? chosen.name || '(logo tanpa nama)' : '—'),
    q.selection === 'random' ? h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => { snap(); q.seed = Math.floor(Math.random() * 100000); changed('canvas left props'); } }, icon('shuffle'), 'Acak ulang') : h('p', { class: 'hint', style: { marginTop: '4px' } }, 'Klik bintang pada brand untuk memilihnya.'));
  const list = h('div', { class: 'brandlist' });
  q.brands.forEach((b, i) => {
    const inOrbit = i < set.n || set.list.includes(b); const isSel = chosen && chosen.id === b.id;
    const lg = h('button', { class: 'lg', title: 'Unggah / ganti logo (PNG atau SVG)', 'aria-label': 'Logo ' + (b.name || 'brand'), style: b.assetId ? { backgroundImage: `url("${api.assetUrl(b.assetId)}")` } : null, onclick: async () => { const a = await pickAsset(['brand-logo'], 'Logo untuk ' + (b.name || 'brand')); if (a) { snap(); b.assetId = a.id; if (!b.name) b.name = a.name; changed('canvas left'); } } }, b.assetId ? '' : 'LOGO');
    const nm = h('input', { type: 'text', value: b.name, 'aria-label': 'Nama brand ' + (i + 1), placeholder: 'Nama brand' }); nm.addEventListener('input', () => { snap('bn' + b.id); b.name = nm.value; changed('canvas'); }); nm.addEventListener('change', () => changed('left'));
    list.append(h('div', { class: 'brow' + (isSel ? ' sel' : '') + (inOrbit ? '' : ' off'), title: inOrbit ? (cine && !b.assetId ? 'Logo belum diunggah' : '') : 'Di luar jumlah logo yang mengorbit', style: cine && inOrbit && !b.assetId ? { borderColor: 'rgba(245,181,71,.55)' } : null }, lg, nm,
      h('button', { class: 'btn ghost icon sm', 'aria-label': 'Jadikan brand terpilih', title: 'Jadikan brand terpilih', 'aria-pressed': String(isSel && q.selection === 'manual'), onclick: () => { snap(); q.selection = 'manual'; q.selectedId = b.id; changed('canvas left props'); } }, icon('star')),
      h('button', { class: 'btn ghost icon sm', 'aria-label': 'Menu brand', title: 'Lainnya', onclick: e => { const rr = e.currentTarget.getBoundingClientRect(); import('./dom.js').then(d => d.ctxMenu(rr.left, rr.bottom + 4, [
        { label: 'Naikkan', disabled: i === 0, run: () => { snap(); q.brands.splice(i - 1, 0, q.brands.splice(i, 1)[0]); changed('canvas left'); } },
        { label: 'Turunkan', disabled: i === q.brands.length - 1, run: () => { snap(); q.brands.splice(i + 1, 0, q.brands.splice(i, 1)[0]); changed('canvas left'); } },
        { label: cine ? 'Lepas logo' : 'Hapus logo (pakai teks)', disabled: !b.assetId, run: () => { snap(); b.assetId = null; changed('canvas left'); } },
        { label: 'Hapus brand', disabled: q.brands.length <= 3, run: () => { snap(); q.brands.splice(i, 1); if (q.selectedId === b.id) q.selectedId = null; changed('canvas left props'); } }])); } }, icon('more'))));
  });
  const addBrand = h('div', { class: 'g2' }, h('button', { class: 'btn sm', onclick: () => { snap(); q.brands.push({ id: uid(), name: 'Brand baru', assetId: null }); changed('canvas left props'); } }, icon('plus'), 'Brand'),
    h('button', { class: 'btn sm', onclick: () => bulkLogos(q) }, icon('upload'), 'Banyak logo'));
  return [h('div', { class: 'stack' }, h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Cara memilih brand'), modeSeg), info,
    h('div', { class: 'row' }, h('span', { class: 'lab' }, h('span', null, 'Daftar brand'), h('span', null, `${set.n} mengorbit dari ${q.brands.length}`)), h('p', { class: 'hint' }, cine ? 'Klik kotak LOGO untuk mengunggah logo asli (PNG transparan atau SVG). Modul cinematic selalu memakai gambar logo; brand tanpa logo tampil sebagai kotak kosong bergaris.' : 'Klik kotak LOGO untuk mengunggah logo PNG/SVG. Tanpa logo, nama brand ditulis di tile. Jumlah yang mengorbit diatur di panel Properti.'), missing ? h('div', { class: 'warnbox' }, `${missing} brand yang mengorbit belum punya logo.`) : null, list), addBrand)];
}
async function bulkLogos(q) {
  const r = await api.assets.importDialog('brand-logo'); afterImport(r); if (!r.added.length) return;
  snap(); for (const a of r.added) { const ex = q.brands.find(b => !b.assetId && b.name && b.name.toLowerCase() === a.name.toLowerCase()); if (ex) ex.assetId = a.id; else q.brands.push({ id: uid(), name: a.name, assetId: a.id }); }
  changed('canvas left props'); toast('Logo dipasangkan ke brand dengan nama yang sama; sisanya ditambahkan sebagai brand baru.', 'ok', 5000);
}

/* text styles */
const TEXT_STYLES = [
  ['Judul besar', m => ({ size: Math.round(m * 0.095), weight: 800, font: 'sora', gradient: { on: true, c1: '#FFFFFF', c2: '#C9D6EA' } })],
  ['Judul emas', m => ({ size: Math.round(m * 0.085), weight: 800, font: 'montserrat', gradient: { on: true, c1: QB.gold, c2: QB.orange } })],
  ['Subjudul', m => ({ size: Math.round(m * 0.045), weight: 600, font: 'plex', color: '#C9D6EA' })],
  ['Label harga', m => ({ size: Math.round(m * 0.07), weight: 800, font: 'montserrat', color: '#0A1631', bg: { on: true, color: QB.gold, pad: Math.round(m * 0.025), radius: Math.round(m * 0.02), alpha: 1 } })],
  ['Badge biru', m => ({ size: Math.round(m * 0.035), weight: 700, font: 'plex', color: '#FFFFFF', letterSpacing: 2, bg: { on: true, color: QB.blue, pad: Math.round(m * 0.018), radius: 999, alpha: 1 } })],
  ['Teknologi neon', m => ({ size: Math.round(m * 0.07), weight: 900, font: 'orbitron', color: '#E8F4FF', glow: { on: true, color: QB.blue, size: Math.round(m * 0.03) } })],
  ['Teks isi', m => ({ size: Math.round(m * 0.035), weight: 400, font: 'plex', color: '#E0E7F3', align: 'left', lineHeight: 1.4 })]
];
function leftText() {
  const m = Math.min(p().width, p().height);
  return [h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Klik gaya untuk menambahkan teks di posisi playhead. Semua bisa diubah di panel Properti.'),
    ...TEXT_STYLES.map(([n, f]) => { const st = f(m); const css = (FONTS[st.font] || FONTS.sora).css; return h('button', { class: 'btn', style: { justifyContent: 'flex-start', fontFamily: css, fontWeight: st.weight, fontSize: '15px', padding: '10px 12px', color: st.gradient?.on ? st.gradient.c1 : st.bg?.on ? st.bg.color : st.color || '#fff' }, onclick: () => addLayer('text', Object.assign({ name: n, text: n }, st)) }, n); }))];
}
/* media */
let mediaCat = 'product-image';
function leftMedia() {
  const cats = ['product-image', 'brand-logo', 'illustration', 'icon', 'bg-image'];
  const grid = h('div', { class: 'agrid', style: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } });
  api.assets.list(mediaCat).then(list => grid.replaceChildren(...(list.length ? list.map(a => h('button', { class: 'acard', style: { padding: 0, cursor: 'pointer', textAlign: 'left' }, title: 'Tambahkan ' + a.name, onclick: () => addMedia(a) }, h('div', { class: 'th' }, assetThumb(a)), h('div', { class: 'meta' }, h('b', null, a.name)))) : [h('p', { class: 'hint', style: { gridColumn: '1 / -1' } }, 'Belum ada aset di kategori ini.')])));
  const cs = h('select', { 'aria-label': 'Kategori', onchange: e => { mediaCat = e.target.value; buildLeft(document.querySelector('.lpanel')); } }, cats.map(c => h('option', { value: c, selected: c === mediaCat }, ASSET_CATS[c].label)));
  return [h('div', { class: 'stack' }, h('div', { class: 'flex', style: { flexWrap: 'nowrap' } }, cs, h('button', { class: 'btn gold sm', onclick: async () => { const r = await api.assets.importDialog(mediaCat); afterImport(r); buildLeft(document.querySelector('.lpanel')); } }, icon('upload'), 'Impor')),
    h('p', { class: 'hint' }, 'Klik gambar untuk menambahkannya sebagai layer. Video produk menyusul di Fase 2.'), grid)];
}
function addMedia(a) {
  const im = new Image(); im.src = api.assetUrl(a.id);
  const go = () => { const m = Math.min(p().width, p().height) * (a.category === 'brand-logo' || a.category === 'icon' ? 0.35 : 0.7); const r = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1; const w = r >= 1 ? m : m * r, hh = r >= 1 ? m / r : m;
    addLayer(a.category === 'brand-logo' ? 'logo' : 'image', { assetId: a.id, name: a.name, w: Math.round(w), h: Math.round(hh) }); };
  if (im.complete && im.naturalWidth) go(); else { im.onload = go; im.onerror = go; }
}
/* background */
function leftBg() {
  const b = p().background; const out = [seg('Jenis latar', b, 'type', [['solid', 'Warna'], ['gradient', 'Gradasi'], ['image', 'Gambar']], { parts: 'canvas left' })];
  if (b.type !== 'image') out.push(color(b.type === 'gradient' ? 'Warna awal' : 'Warna', b, 'color'));
  if (b.type === 'gradient') out.push(color('Warna akhir', b, 'color2'), range('Arah gradasi', b, 'angle', { min: 0, max: 360, fmt: v => v + '°' }));
  if (b.type === 'image') out.push(h('div', { class: 'stack' }, b.assetId ? h('div', { class: 'acard' }, h('div', { class: 'th', style: { aspectRatio: '16/10' } }, h('img', { src: api.assetUrl(b.assetId), alt: '' }))) : h('p', { class: 'hint' }, 'Belum ada gambar. Warna di bawah dipakai sampai gambar dipilih.'),
    h('button', { class: 'btn', onclick: async () => { const a = await pickAsset(['bg-image', 'product-image', 'illustration'], 'Gambar latar'); if (a) { snap(); b.assetId = a.id; changed('canvas left'); } } }, icon('image'), b.assetId ? 'Ganti gambar' : 'Pilih gambar'), color('Warna cadangan', b, 'color')));
  const r = roulette(); if (r) out.push(h('p', { class: 'hint' }, 'Brand Roulette menggambar latarnya sendiri selama layer itu tampil. Ubah warnanya di Properti → Warna saat layer roulette dipilih.'));
  return [h('div', { class: 'stack' }, ...out)];
}
/* audio */
function leftAudio() {
  const tracks = p().audio;
  const add = async () => { const a = await pickAsset(['music', 'sfx'], 'Pilih musik atau efek suara'); if (!a) return; const au = new Audio(api.assetUrl(a.id)); const put = d => { snap(); tracks.push({ id: uid(), assetId: a.id, name: a.name, start: a.category === 'sfx' ? E.s.t : 0, trimStart: 0, duration: null, assetDuration: d || null, volume: a.category === 'sfx' ? 1 : 0.8, fadeIn: a.category === 'sfx' ? 0 : 0.5, fadeOut: a.category === 'sfx' ? 0 : 1.5, muted: false }); changed('tl left'); }; au.onloadedmetadata = () => put(au.duration); au.onerror = () => put(null); };
  const rows = tracks.map(tr => h('div', { class: 'card stack', style: { padding: '10px', background: 'var(--bg2)', gap: '8px' } },
    h('div', { class: 'flex', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tr.name), h('div', { class: 'flex', style: { gap: 0, flexWrap: 'nowrap' } },
      h('button', { class: 'btn ghost icon sm', 'aria-label': tr.muted ? 'Bunyikan' : 'Bisukan', title: tr.muted ? 'Bunyikan' : 'Bisukan', onclick: () => { snap(); tr.muted = !tr.muted; changed('tl left'); } }, icon(tr.muted ? 'eyeoff' : 'music')),
      h('button', { class: 'btn ghost icon sm danger', 'aria-label': 'Hapus audio', onclick: () => { snap(); p().audio = p().audio.filter(x => x !== tr); changed('tl left'); } }, icon('trash')))),
    h('div', { class: 'g2' }, num('Mulai di (dtk)', tr, 'start', { min: 0, step: 0.1, parts: 'tl' }), num('Potong awal (dtk)', tr, 'trimStart', { min: 0, step: 0.1, parts: 'tl' })),
    range('Volume', tr, 'volume', { min: 0, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + '%' }),
    h('div', { class: 'g2' }, num('Fade in (dtk)', tr, 'fadeIn', { min: 0, step: 0.1 }), num('Fade out (dtk)', tr, 'fadeOut', { min: 0, step: 0.1 }))));
  return [h('div', { class: 'stack' }, h('button', { class: 'btn gold', onclick: add }, icon('plus'), 'Tambah musik / efek suara'), h('p', { class: 'hint' }, 'Audio ikut diputar saat pratinjau dan digabungkan ke file MP4 saat ekspor. Unggah file MP3, WAV, M4A, atau OGG milik Anda.'), ...rows)];
}
function leftTpl() {
  return [h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Template review produk, promo laptop, promo enterprise, dan countdown dijadwalkan di Fase 2.'),
    h('button', { class: 'btn', onclick: async () => { const { save } = await import('./editor.js'); if (await save()) { const n = await import('./dom.js').then(d => d.promptBox('Simpan sebagai template', 'Nama template', p().name)); if (n) { await api.templates.saveFromProject(p().id, n, 'Kustom'); toast('Template disimpan. Pakai lewat Dashboard → Template.', 'ok'); } } } }, icon('template'), 'Simpan proyek ini sebagai template'))];
}
function leftAnim() {
  const l = sel();
  return [h('div', { class: 'stack' }, h('p', { class: 'hint' }, 'Fase 1: fade in/out, blur, glow, bayangan, dan seluruh animasi Brand Roulette. Animasi teks (typewriter, slide, glitch, dll.), motion, dan keyframe menyusul di Fase 2.'),
    l ? h('div', { class: 'stack' }, h('h3', null, 'Layer: ' + l.name), h('div', { class: 'g2' }, num('Fade in (dtk)', l, 'fadeIn', { min: 0, step: 0.1 }), num('Fade out (dtk)', l, 'fadeOut', { min: 0, step: 0.1 }))) : h('p', { class: 'hint' }, 'Pilih layer untuk mengatur fade.'))];
}

/* ---------- right properties ---------- */
export function buildProps(el) {
  const l = sel(); const body = h('div', { class: 'pb scroll stack' }); const oldPb = el.querySelector('.pb'); const keep = oldPb && el.dataset.for === (l ? l.id : '') ? oldPb.scrollTop : 0; el.dataset.for = l ? l.id : ''; requestAnimationFrame(() => { body.scrollTop = keep; });
  el.replaceChildren(h('div', { class: 'ph' }, h('h2', null, l ? (l.name || LAYER_TYPES[l.type]) : 'Proyek'), h('span', { class: 'hint' }, l ? LAYER_TYPES[l.type] + (l.locked ? ' · terkunci' : '') : 'Tidak ada layer dipilih')), body);
  if (!l) { body.append(...projectProps()); return; }
  if (l.type === 'cinematic') body.append(...cinematicProps(l));
  else if (l.type === 'roulette') body.append(...rouletteProps(l));
  else body.append(...layerProps(l));
  body.append(group('Layer', h('div', { class: 'g2' }, h('button', { class: 'btn sm', onclick: () => duplicateLayer(l) }, icon('copy'), 'Duplikat'), h('button', { class: 'btn sm danger', onclick: () => removeLayer(l) }, icon('trash'), 'Hapus'))));
}
function projectProps() {
  const P = p(); const minDur = Math.max(1, ...P.layers.map(l => l.end));
  return [group('Proyek', text('Nama', P, 'name', { parts: 'title' }), h('p', { class: 'hint' }, `${presetOf(P.preset).label} · ${P.width}×${P.height}. Ganti ukuran lewat pilihan di atas pratinjau.`),
    select('Frame rate pratinjau & ekspor', P, 'fps', [[24, '24 fps'], [30, '30 fps'], [60, '60 fps']]),
    num('Durasi video (detik)', P, 'duration', { min: 1, max: 600, step: 0.1, parts: 'canvas tl', set: v => { if (v < minDur) toast(`Layer terakhir selesai di ${minDur.toFixed(1)} dtk, jadi durasi minimal mengikuti itu.`, 'info'); } }),
    h('p', { class: 'hint' }, `Durasi saat ini: ${projectDuration(P).toFixed(1)} detik · ${P.layers.length} layer · ${P.audio.length} audio`)),
    group('Petunjuk', h('p', { class: 'hint' }, 'Klik objek di pratinjau untuk memilih, seret untuk memindah, tarik sudut untuk memperbesar. Tombol panah menggeser 1 px (Shift = 10 px). Alt saat menyeret mematikan magnet tengah.'),
      h('p', { class: 'hint' }, 'Spasi putar/jeda · , dan . maju/mundur 1 frame · Ctrl+Z urungkan · Ctrl+S simpan · Ctrl+E ekspor · F layar penuh'))];
}
function timing(l) {
  const dur = { get v() { return +(l.end - l.start).toFixed(2); } }; const o = { d: dur.v };
  return group('Waktu & tampil', h('div', { class: 'g2' }, num('Mulai (dtk)', l, 'start', { min: 0, step: 0.1, set: v => { l.end = v + o.d; } }), FULLFRAME(l.type) ? h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Durasi (dtk)'), h('div', { class: 'tag', style: { padding: '6px 8px', fontSize: '12.5px' } }, o.d.toFixed(2) + (l.type === 'cinematic' ? ' · dari scene' : ' · dari tahap'))) : num('Durasi (dtk)', o, 'd', { min: 0.1, step: 0.1, set: v => { l.end = l.start + v; } })),
    range('Opasitas', l, 'opacity', { min: 0, max: 1, step: 0.01, fmt: v => Math.round(v * 100) + '%' }),
    h('div', { class: 'g2' }, num('Fade in (dtk)', l, 'fadeIn', { min: 0, step: 0.1 }), num('Fade out (dtk)', l, 'fadeOut', { min: 0, step: 0.1 })));
}
function layerProps(l) {
  const out = [];
  if (l.type === 'text') {
    const fonts = [...Object.entries(FONTS).map(([k, f]) => [k, f.label]), ...Object.entries(customFonts()).map(([k, f]) => [k, f.replace(/^QBZ /, '') + ' (unggahan)'])];
    const t = text('Isi teks', l, 'text', { multi: true, rows: 3, parts: 'canvas tl' }); t.querySelector('textarea').id = 'prop-text';
    out.push(group('Teks', t, h('div', { class: 'g2' }, select('Font', l, 'font', fonts), select('Ketebalan', l, 'weight', [[400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']])),
      h('div', { class: 'g2' }, num('Ukuran (px)', l, 'size', { min: 6, max: 600 }), num('Lebar kotak (px)', l, 'w', { min: 20, max: 4000 })),
      seg('Rata', l, 'align', [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']]),
      h('div', { class: 'g2' }, num('Jarak huruf', l, 'letterSpacing', { min: -20, max: 60, step: 0.5 }), num('Jarak baris', l, 'lineHeight', { min: 0.6, max: 3, step: 0.05 })),
      color('Warna', l, 'color')));
    out.push(group('Gaya teks', check('Gradasi', l.gradient, 'on', { parts: 'canvas props' }), l.gradient.on ? h('div', { class: 'g2' }, color('Atas', l.gradient, 'c1'), color('Bawah', l.gradient, 'c2')) : null,
      h('div', { class: 'g2' }, num('Outline (px)', l.outline, 'width', { min: 0, max: 40 }), color('Warna outline', l.outline, 'color')),
      check('Glow', l.glow, 'on', { parts: 'canvas props' }), l.glow.on ? h('div', { class: 'g2' }, color('Warna glow', l.glow, 'color'), num('Besar glow', l.glow, 'size', { min: 0, max: 200 })) : null,
      check('Kotak latar teks', l.bg, 'on', { parts: 'canvas props' }), l.bg.on ? h('div', { class: 'stack' }, color('Warna kotak', l.bg, 'color'), h('div', { class: 'g3' }, num('Padding', l.bg, 'pad', { min: 0, max: 200 }), num('Sudut', l.bg, 'radius', { min: 0, max: 999 }), num('Opasitas', l.bg, 'alpha', { min: 0, max: 1, step: 0.05 }))) : null));
  }
  if (l.type === 'image' || l.type === 'logo') {
    out.push(group(l.type === 'logo' ? 'Logo' : 'Gambar', l.assetId ? h('div', { class: 'acard' }, h('div', { class: 'th', style: { aspectRatio: '16/10' } }, h('img', { src: api.assetUrl(l.assetId), alt: '' }))) : h('p', { class: 'hint' }, 'Belum ada file.'),
      h('button', { class: 'btn sm', onclick: async () => { const a = await pickAsset(l.type === 'logo' ? ['brand-logo', 'icon'] : ['product-image', 'illustration', 'icon', 'bg-image', 'brand-logo'], 'Pilih gambar'); if (a) { snap(); l.assetId = a.id; changed('canvas props'); } } }, icon('image'), l.assetId ? 'Ganti file' : 'Pilih file'),
      seg('Penyesuaian', l, 'fit', [['contain', 'Utuh'], ['cover', 'Penuh'], ['fill', 'Regang']]),
      h('div', { class: 'g2' }, num('Lebar kotak', l, 'w', { min: 4, max: 8000 }), num('Tinggi kotak', l, 'h', { min: 4, max: 8000 })), num('Sudut membulat', l.border, 'radius', { min: 0, max: 2000 })));
  }
  if (l.type === 'shape') out.push(group('Bentuk', seg('Jenis', l, 'shape', [['rect', 'Kotak'], ['ellipse', 'Elips']], { parts: 'canvas props' }), color('Isi', l, 'fill'), range('Opasitas isi', l, 'fillAlpha', { min: 0, max: 1, step: 0.01, fmt: v => Math.round(v * 100) + '%' }),
    h('div', { class: 'g2' }, num('Lebar', l, 'w', { min: 2, max: 8000 }), num('Tinggi', l, 'h', { min: 2, max: 8000 })), l.shape === 'rect' ? num('Sudut membulat', l.border, 'radius', { min: 0, max: 2000 }) : null));
  out.push(group('Posisi', text('Nama layer', l, 'name', { parts: 'tl left' }), h('div', { class: 'g2' }, num('X (tengah)', l, 'x', { step: 1 }), num('Y (tengah)', l, 'y', { step: 1 })), h('div', { class: 'g2' }, num('Skala', l, 'scale', { min: 0.05, max: 20, step: 0.01 }), num('Rotasi (°)', l, 'rotation', { min: -360, max: 360 })),
    h('div', { class: 'g2' }, h('button', { class: 'btn sm', onclick: () => { snap(); l.x = p().width / 2; changed('canvas props'); } }, 'Tengah horizontal'), h('button', { class: 'btn sm', onclick: () => { snap(); l.y = p().height / 2; changed('canvas props'); } }, 'Tengah vertikal'))));
  out.push(timing(l));
  out.push(group('Efek', range('Blur', l, 'blur', { min: 0, max: 40, step: 0.5, fmt: v => v + ' px' }),
    check('Bayangan', l.shadow, 'on', { parts: 'canvas props' }), l.shadow.on ? h('div', { class: 'stack' }, color('Warna bayangan', l.shadow, 'color'), h('div', { class: 'g3' }, num('Blur', l.shadow, 'blur', { min: 0, max: 300 }), num('X', l.shadow, 'x'), num('Y', l.shadow, 'y')), range('Kepekatan', l.shadow, 'alpha', { min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + '%' })) : null,
    l.type !== 'text' ? h('div', { class: 'g2' }, num('Garis tepi (px)', l.border, 'width', { min: 0, max: 100 }), color('Warna tepi', l.border, 'color')) : null));
  return out;
}

/* roulette */
function rouletteProps(l) {
  const q = l.params; const set = orbitSet(q);
  const refit = () => { const was = Math.abs(p().duration - l.end) < 0.01; l.end = l.start + rouletteDuration(q); if (was || p().duration < l.end) p().duration = l.end; };
  const S = stageTimes(q); const cols = ['#F2A93B', '#1E9BFF', '#3DDC97', '#FFD24D', '#F57C1F', '#FFD36B', '#7FC8FF', '#FFB04D', '#C9D6EA'];
  const bar = h('div', { class: 'stagebar', 'aria-hidden': 'true' }, STAGES.map(([k, lab], i) => h('span', { title: `${lab}: ${S[k].d.toFixed(1)} dtk`, style: { width: (S[k].d / S.total * 100) + '%', background: cols[i] } }, S[k].d / S.total > 0.1 ? lab.split(' ')[0] : '')));
  const brandOpts = q.brands.map(b => [b.id, b.name || '(logo)']);
  const chosen = set.list[set.sel];
  const selObj = { v: q.selection === 'manual' && q.selectedId ? q.selectedId : '__random' };
  return [
    group('Brand terpilih', select('Brand yang menang', selObj, 'v', [['__random', `Acak (sekarang: ${chosen ? chosen.name : '—'})`], ...brandOpts], { parts: '', set: v => { if (v === '__random') { q.selection = 'random'; } else { q.selection = 'manual'; q.selectedId = v; } changed('canvas left props'); } }),
      q.selection === 'random' ? h('button', { class: 'btn sm', onclick: () => { snap(); q.seed = Math.floor(Math.random() * 100000); changed('canvas left props'); } }, icon('shuffle'), 'Acak ulang brand') : null,
      h('p', { class: 'hint' }, 'Unggah logo dan atur daftar brand di panel kiri → Brand.')),
    group('Kotak misteri', check('Brand berubah jadi kotak kuning bertanda ? sebelum berputar, lalu kotak terpilih terbuka', q, 'mystery', { parts: 'canvas tl props', set: v => { if (v && !(q.hideDur > 0)) q.hideDur = 1.4; if (v && !(q.openDur > 0)) q.openDur = 1.8; if (!v) { q.hideDur = 0; q.openDur = 0; } refit(); } }),
      h('p', { class: 'hint' }, q.mystery ? 'Urutan: brand tampil → berbalik jadi kotak ? → berputar pelan, cepat, lalu berhenti → kotak terpilih zoom ke kamera dan terbuka menampilkan brand.' : 'Mati: brand tetap terlihat selama berputar, lalu brand terpilih disorot dan di-zoom.')),
    group('Putaran', range('Jumlah putaran', q, 'rotations', { min: 1, max: 12, step: 1, fmt: v => v + '×' }),
      seg('Kecepatan awal', q, 'accel', Object.entries(ACCEL).map(([k, a]) => [k, a.label])), seg('Arah', q, 'direction', [['cw', 'Searah jarum jam'], ['ccw', 'Berlawanan']])),
    group('Durasi tahap (detik)', bar, h('div', { class: 'g2' }, STAGES.map(([k, lab]) => num(lab, q, k, { min: k === 'spinDur' ? 1 : 0, max: 30, step: 0.1, parts: 'canvas tl props', set: () => refit() }))), h('p', { class: 'hint' }, `Total intro ${S.total.toFixed(1)} detik.`)),
    group('Tampilan orbit', range('Jumlah logo mengorbit', q, 'count', { min: 3, max: Math.max(3, Math.min(24, q.brands.length)), step: 1, parts: 'canvas left' }),
      range('Ukuran logo', q, 'logoSize', { min: 5, max: 20, step: 0.5, fmt: v => v + '%' }), range('Radius orbit', q, 'orbitRadius', { min: 20, max: 48, step: 0.5, fmt: v => v + '%' }), range('Kemiringan 3D', q, 'tilt', { min: 0, max: 80, step: 1, fmt: v => v + '°' }),
      seg('Tile logo', q, 'tile', [['white', 'Putih'], ['glass', 'Kaca'], ['none', 'Tanpa']]),
      check('Efek zoom kamera ke brand terpilih', q, 'zoomEffect', { parts: 'canvas props' }), q.zoomEffect ? range('Besar zoom', q, 'zoomFill', { min: 30, max: 95, step: 1, fmt: v => v + '% layar' }) : null),
    group('Logo tengah', q.centerAssetId ? h('div', { class: 'acard' }, h('div', { class: 'th', style: { aspectRatio: '16/9' } }, h('img', { src: api.assetUrl(q.centerAssetId), alt: '' }))) : h('p', { class: 'hint' }, 'Belum ada logo QBizPro. Sementara tampil simbol Q dan tulisan di bawah.'),
      h('div', { class: 'g2' }, h('button', { class: 'btn sm', onclick: async () => { const a = await pickAsset(['brand-logo', 'icon', 'illustration'], 'Logo tengah (QBizPro)'); if (a) { snap(); q.centerAssetId = a.id; changed('canvas props'); } } }, icon('upload'), q.centerAssetId ? 'Ganti logo' : 'Pilih logo'), q.centerAssetId ? h('button', { class: 'btn sm', onclick: () => { snap(); q.centerAssetId = null; changed('canvas props'); } }, 'Lepas logo') : null),
      text('Tulisan pengganti logo', q, 'centerText', { parts: 'canvas' }), range('Ukuran logo tengah', q, 'centerSize', { min: 5, max: 22, step: 0.5, fmt: v => v + '%' })),
    group('Warna', h('div', { class: 'g3' }, color('Latar', q.colors, 'bg'), color('Emas', q.colors, 'gold'), color('Biru', q.colors, 'blue')),
      h('button', { class: 'btn sm', onclick: () => { snap(); Object.assign(q.colors, { bg: QB.navy, gold: QB.gold, blue: QB.blue }); changed('canvas props'); } }, 'Kembalikan warna QBizPro')),
    group('Halaman review', text('Judul', q.review, 'title', { placeholder: 'Product Review', parts: 'canvas' }), text('Subjudul', q.review, 'subtitle', { placeholder: 'Contoh: ThinkPad X1 Carbon Gen 12', parts: 'canvas' }),
      q.review.productAssetId ? h('div', { class: 'acard' }, h('div', { class: 'th', style: { aspectRatio: '16/10' } }, h('img', { src: api.assetUrl(q.review.productAssetId), alt: '' }))) : null,
      h('div', { class: 'g2' }, h('button', { class: 'btn sm', onclick: async () => { const a = await pickAsset(['product-image'], 'Foto produk untuk halaman review'); if (a) { snap(); q.review.productAssetId = a.id; changed('canvas props'); } } }, icon('image'), q.review.productAssetId ? 'Ganti foto' : 'Foto produk'), q.review.productAssetId ? h('button', { class: 'btn sm', onclick: () => { snap(); q.review.productAssetId = null; changed('canvas props'); } }, 'Lepas foto') : null)),
    timing(l)
  ];
}

/* cinematic brand roulette */
function cinematicProps(l) {
  const q = l.params; const set = cineSet(q); const chosen = set.list[set.sel]; const miss = cineMissingLogos(q); const S = cineSceneTimes(q);
  const refit = () => { const was = Math.abs(p().duration - l.end) < 0.01; l.end = l.start + cineDuration(q); if (was || p().duration < l.end) p().duration = l.end; };
  const cols = ['#F2A93B', '#1E9BFF', '#F57C1F', '#3DDC97', '#B78BFF', '#FFD36B'];
  const bar = h('div', { class: 'stagebar', 'aria-hidden': 'true' }, q.scenes.map((sc, i) => h('span', { title: `${sc.label}: ${S[sc.id].d.toFixed(2)} dtk`, style: { width: (S[sc.id].d / S.total * 100) + '%', background: cols[i % 6] } }, String(i + 1))));
  const selObj = { v: q.selection === 'manual' && q.selectedId ? q.selectedId : '__random' };
  const pickBtn = (label, cats, title, get, set2) => h('button', { class: 'btn sm', onclick: async () => { const a = await pickAsset(cats, title); if (a) { snap(); set2(a.id); changed('canvas props left'); } } }, icon('upload'), get() ? 'Ganti ' + label : 'Pilih ' + label);
  const pct = v => v + '%';
  return [
    miss.center || miss.brands.length ? h('div', { class: 'warnbox' }, [miss.center ? 'Logo QBizPro belum dipilih. ' : '', miss.brands.length ? `${miss.brands.length} brand belum punya logo: ${miss.brands.slice(0, 4).join(', ')}${miss.brands.length > 4 ? '…' : ''}. ` : '', 'Unggah logo asli lewat panel kiri → Brand.'].join('')) : null,
    selectedKeySection(group),
    group('Brand terpilih', select('Brand yang berhenti di titik fokus', selObj, 'v', [['__random', `Acak (sekarang: ${chosen ? chosen.name || 'logo' : '—'})`], ...q.brands.map(b => [b.id, b.name || '(logo)'])], { parts: '', set: v => { if (v === '__random') q.selection = 'random'; else { q.selection = 'manual'; q.selectedId = v; } changed('canvas left props'); } }),
      q.selection === 'random' ? h('button', { class: 'btn sm', onclick: () => { snap(); q.seed = Math.floor(Math.random() * 100000); changed('canvas left props'); } }, icon('shuffle'), 'Acak ulang brand') : null),
    group('Scene (detik)', bar, h('div', { class: 'g2' }, q.scenes.map((sc, i) => num(`${i + 1}. ${sc.label}`, sc, 'dur', { min: 0, max: 30, step: 0.05, parts: 'canvas tl props', set: () => refit() }))),
      h('p', { class: 'hint' }, `Total ${S.total.toFixed(2)} detik. Keyframe ikut bergeser bersama scene-nya.`)),
    playheadSection(l, group),
    group('Logo QBizPro (pusat orbit)', q.centerAssetId ? h('div', { class: 'acard' }, h('div', { class: 'th', style: { aspectRatio: '16/9' } }, h('img', { src: api.assetUrl(q.centerAssetId), alt: '' }))) : null,
      pickBtn('logo', ['brand-logo', 'icon', 'illustration'], 'Logo QBizPro', () => q.centerAssetId, id => { q.centerAssetId = id; }),
      range('Ukuran logo (% sisi panjang layar)', q, 'logoSize', { min: 3, max: 30, step: 0.5, fmt: pct }),
      h('div', { class: 'g2' }, range('Posisi X', q, 'centerX', { min: 10, max: 90, step: 0.5, fmt: pct }), range('Posisi Y', q, 'centerY', { min: 10, max: 90, step: 0.5, fmt: pct }))),
    group('Orbit 3D', range('Jumlah logo mengorbit', q, 'count', { min: 3, max: Math.max(3, Math.min(24, q.brands.length)), step: 1, parts: 'canvas left' }),
      range('Radius orbit (% lebar)', q.orbit, 'radius', { min: 15, max: 49, step: 0.5, fmt: pct }), range('Ukuran logo brand (% layar)', q.orbit, 'brandSize', { min: 3, max: 18, step: 0.25, fmt: pct }),
      h('div', { class: 'g2' }, num('Skala depan', q.orbit, 'depthNear', { min: 0.3, max: 2, step: 0.01 }), num('Skala belakang', q.orbit, 'depthFar', { min: 0.2, max: 2, step: 0.01 })),
      range('Redup di belakang', q.orbit, 'depthFade', { min: 0, max: 0.9, step: 0.01, fmt: v => Math.round(v * 100) + '%' }),
      seg('Arah putaran', q.orbit, 'direction', [['cw', 'Searah jarum jam'], ['ccw', 'Berlawanan']]),
      range('Gerak orbit sebelum roulette (°/dtk)', q.orbit, 'idleSpeed', { min: 0, max: 90, step: 1 }), range('Tebal garis orbit', q.orbit, 'ringWidth', { min: 0, max: 3, step: 0.1 }),
      h('p', { class: 'hint' }, 'Kemiringan 3D, skala radius, dan munculnya brand diatur lewat keyframe Orbit. Logo jatuh, sihir kotak emas, dan retak-pecah diatur lewat keyframe Logo dan Efek.')),
    group('Roulette', range('Jumlah putaran penuh', q.spin, 'rotations', { min: 0, max: 15, step: 1, fmt: v => v + '×' }),
      h('div', { class: 'g2' }, range('Bagian akselerasi', q.spin, 'accel', { min: 5, max: 60, step: 1, fmt: pct }), range('Bagian deselerasi', q.spin, 'decel', { min: 10, max: 90, step: 1, fmt: pct })),
      range('Motion blur', q.spin, 'motionBlur', { min: 0, max: 1.5, step: 0.05 }), h('p', { class: 'hint' }, 'Akselerasi/deselerasi berlaku untuk easing "Roulette" pada track Roulette · progres putaran. Waktu mulai dan berhenti diatur dengan menggeser keyframe-nya.')),
    group('Kamera', range('Ukuran brand saat fokus penuh', q.camera, 'fill', { min: 20, max: 95, step: 1, fmt: v => v + '% layar' }), h('p', { class: 'hint' }, 'Zoom, fokus, geser, dan rotasi kamera diatur lewat keyframe Kamera.')),
    group('Efek', check('Garis orbit', q.fx, 'rings'), check('Asap saat brand berubah jadi kotak emas', q.fx, 'smoke'), check('Partikel cahaya', q.fx, 'particles'), check('Lantai grid perspektif', q.fx, 'floor'), check('Vignette', q.fx, 'vignette'), check('Nama brand di bawah logo terpilih', q.fx, 'showName'), range('Kekuatan bloom', q.fx, 'bloom', { min: 0, max: 2, step: 0.05 })),
    group('Warna', h('div', { class: 'g3' }, color('Latar', q.colors, 'bg'), color('Emas', q.colors, 'gold'), color('Biru', q.colors, 'blue'))),
    group('Product showcase', text('Judul', q.showcase, 'title', { placeholder: 'Product Review', parts: 'canvas' }), text('Subjudul', q.showcase, 'subtitle', { placeholder: 'Contoh: seri laptop bisnis terbaru', parts: 'canvas' }),
      q.showcase.productAssetId ? h('div', { class: 'acard' }, h('div', { class: 'th', style: { aspectRatio: '16/10' } }, h('img', { src: api.assetUrl(q.showcase.productAssetId), alt: '' }))) : null,
      pickBtn('foto produk', ['product-image'], 'Foto produk', () => q.showcase.productAssetId, id => { q.showcase.productAssetId = id; })),
    timing(l)
  ];
}
export { roulette as rouletteLayer, dropAsset, confirmBox };

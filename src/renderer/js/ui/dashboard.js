// Dashboard: create projects, recent work, templates, assets, animation library, exports, presets, settings.
import { api, ASSET_CATS } from '../api.js';
import { h, $, icon, toast, modal, confirmBox, promptBox, ctxMenu, fmtSize, fmtDate, ago, dropAsset, loadCustomFonts } from './dom.js';
import { PRESETS, presetOf, builtinTemplates, changePreset, newProject } from '../engine/scene.js';
import { uid } from '../engine/util.js';
import { thumbnail } from './render.js';
import { nav } from './nav.js';

const SECTIONS = [
  ['home', 'Beranda', 'home'], ['projects', 'Proyek', 'folder'], ['templates', 'Template', 'template'], '-',
  ['brand', 'Aset brand', 'star'], ['products', 'Aset produk', 'box'], ['assets', 'Semua aset', 'image'], ['animations', 'Pustaka animasi', 'roulette'], '-',
  ['exports', 'Video hasil ekspor', 'film'], ['presets', 'Preset ukuran', 'grid'], ['settings', 'Pengaturan', 'settings']
];
let current = 'home'; let projFilter = { q: '', archived: false }; let assetFilter = '';
const st = { preset: 'wa', start: 'builtin:roulette' };

export function topbarDash() {
  const tb = $('#topbar'); tb.replaceChildren(
    h('div', { class: 'brandmark' }, h('i', null, 'Q'), h('div', null, 'QBizPro Studio', h('small', null, 'Social Media Content Studio'))),
    h('div', { style: { flex: 1 } }),
    h('button', { class: 'btn', onclick: importProjectFile }, icon('folder'), 'Buka file proyek'),
    h('button', { class: 'btn gold', onclick: () => go('home', true) }, icon('plus'), 'Proyek baru'));
}
export function showDashboard(section = current) {
  current = section; topbarDash();
  const navEl = h('nav', { class: 'dnav', 'aria-label': 'Menu dashboard' });
  for (const s of SECTIONS) { if (s === '-') { navEl.append(h('div', { class: 'sep' })); continue; } navEl.append(h('button', { 'aria-current': s[0] === current ? 'true' : 'false', onclick: () => go(s[0]) }, icon(s[2]), s[1])); }
  navEl.append(h('div', { class: 'foot' }, api.desktop ? 'Mode offline · data tersimpan di komputer ini' : 'Pratinjau browser · data hanya di memori'));
  const main = h('section', { class: 'dmain scroll', id: 'dmain' });
  $('#view').replaceChildren(h('div', { class: 'dash' }, navEl, main));
  setupDrop(main);
  renderSection(main).catch(e => toast(e.message, 'err'));
}
function go(s, focusName) { showDashboard(s); if (focusName) setTimeout(() => $('#newName')?.focus(), 30); }
const head = (title, text, ...right) => h('div', { class: 'dhead' }, h('div', null, h('h1', null, title), text ? h('p', null, text) : null), right.length ? h('div', { class: 'flex' }, right) : null);

async function renderSection(main) {
  const fn = { home, projects, templates, brand: () => assetsView(['brand-logo'], 'Aset brand', 'Logo brand untuk Brand Roulette dan halaman review. Gunakan PNG transparan atau SVG agar tepinya bersih di atas tile putih.'),
    products: () => assetsView(['product-image', 'product-video'], 'Aset produk', 'Foto dan video unit produk untuk halaman review dan promosi.'),
    assets: () => assetsView(null, 'Semua aset', 'Semua file yang sudah diimpor. Seret file dari Explorer ke halaman ini untuk mengimpor.'), animations, exports, presets, settings }[current] || home;
  main.replaceChildren(...[await fn()].flat());
}

/* ---------- home ---------- */
function presetPicker(onPick) {
  const grid = h('div', { class: 'presetgrid', role: 'group', 'aria-label': 'Ukuran video' });
  for (const P of PRESETS) {
    const k = 20 / Math.max(P.w, P.h);
    grid.append(h('button', { class: 'pchip', 'aria-pressed': String(st.preset === P.id), onclick: e => { st.preset = P.id; grid.querySelectorAll('.pchip').forEach(b => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); onPick && onPick(P); } },
      h('span', { class: 'shape', style: { width: P.w * k + 'px', height: P.h * k + 'px' } }), h('div', null, h('b', null, P.label), h('span', null, `${P.w}×${P.h}`))));
  }
  return grid;
}
async function home() {
  const [recent, recov, userTpl] = await Promise.all([api.projects.list(), api.projects.recoveries(), api.templates.list()]);
  const out = [head('Selamat datang', 'Buat video intro, review produk, dan promosi untuk WhatsApp, Instagram, TikTok, dan YouTube. Semua bekerja offline.')];
  if (recov.length) out.push(h('div', { class: 'card', style: { borderColor: 'var(--warn)', marginBottom: '20px' } }, h('div', { class: 'flex', style: { justifyContent: 'space-between' } },
    h('div', null, h('h2', null, 'Ada pekerjaan yang belum tersimpan'), h('p', { class: 'hint' }, 'Aplikasi sempat tertutup sebelum proyek berikut disimpan. Pulihkan untuk melanjutkan dari simpanan otomatis terakhir.')), null),
    h('div', { class: 'stack', style: { marginTop: '10px', gap: '6px' } }, recov.map(r => h('div', { class: 'flex', style: { justifyContent: 'space-between' } }, h('span', null, h('b', null, r.name), ' · ', h('span', { class: 'hint', style: { display: 'inline' } }, 'tersimpan otomatis ' + ago(r.autosavedAt))),
      h('div', { class: 'flex' }, h('button', { class: 'btn sm', onclick: async () => { await api.projects.discardRecovery(r.id); showDashboard('home'); } }, 'Buang'), h('button', { class: 'btn sm gold', onclick: async () => { const p = await api.projects.recover(r.id); toast('Proyek dipulihkan', 'ok'); nav.editor(p); } }, icon('restore'), 'Pulihkan')))))));
  const nameIn = h('input', { type: 'text', id: 'newName', placeholder: 'Contoh: Intro brand minggu ini', 'aria-label': 'Nama proyek' });
  const starts = [...builtinTemplates().map(t => ({ id: t.id, name: t.name, d: t.description })), ...userTpl.map(t => ({ id: t.id, name: t.name, d: 'Template milik Anda · ' + t.width + '×' + t.height }))];
  if (!starts.find(s => s.id === st.start)) st.start = 'builtin:roulette';
  const startSel = h('select', { 'aria-label': 'Mulai dari', onchange: e => { st.start = e.target.value; desc.textContent = starts.find(s => s.id === st.start).d; } }, starts.map(s => h('option', { value: s.id, selected: s.id === st.start }, s.name)));
  const desc = h('p', { class: 'hint' }, starts.find(s => s.id === st.start).d);
  const create = h('div', { class: 'card create' }, h('h2', null, 'Buat proyek baru'),
    h('div', { class: 'g2' }, h('div', { class: 'row' }, h('label', { class: 'lab', for: 'newName' }, 'Nama proyek'), nameIn), h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Mulai dari'), startSel)), desc,
    h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Ukuran dan platform'), presetPicker()),
    h('div', { class: 'flex', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn gold', id: 'createBtn', onclick: () => createProject(st.start, st.preset, nameIn.value.trim()) }, icon('plus'), 'Buat dan buka editor')));
  nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') createProject(st.start, st.preset, nameIn.value.trim()); });
  const active = recent.filter(p => !p.archived);
  const side = h('div', { class: 'card stack' }, h('h2', null, 'Pintasan'),
    h('button', { class: 'btn', onclick: () => go('brand') }, icon('star'), 'Unggah logo brand'), h('button', { class: 'btn', onclick: () => go('products') }, icon('box'), 'Unggah foto produk'),
    h('button', { class: 'btn', onclick: () => go('exports') }, icon('film'), 'Lihat video hasil ekspor'), h('button', { class: 'btn', onclick: importProjectFile }, icon('folder'), 'Buka file .qbzproj'),
    h('p', { class: 'hint' }, `${active.length} proyek aktif · ${userTpl.length} template milik Anda`));
  out.push(h('div', { class: 'hero' }, create, side));
  out.push(h('div', { class: 'section' }, h('div', { class: 'flex' }, h('h2', null, 'Proyek terbaru'), active.length > 8 ? h('button', { class: 'btn ghost sm', onclick: () => go('projects') }, 'Lihat semua') : null),
    active.length ? h('div', { class: 'gallery' }, active.slice(0, 8).map(projectCard)) : h('div', { class: 'empty' }, h('b', null, 'Belum ada proyek'), 'Buat proyek pertama di atas. Template Brand Roulette Intro sudah siap dipakai.')));
  return out;
}
export async function createProject(startId, presetId, name) {
  let p;
  const bt = builtinTemplates().find(t => t.id === startId);
  if (bt) p = bt.make(presetId);
  else { const t = await api.templates.get(startId); if (!t) throw new Error('Template tidak ditemukan'); p = JSON.parse(JSON.stringify(t)); delete p.templateCategory; p.id = uid() + uid().slice(0, 4); p.createdAt = 0; p.archived = false; p.layers.forEach(l => { l.id = uid(); }); if (p.preset !== presetId) changePreset(p, presetId); }
  if (name) p.name = name;
  p.thumbnail = await thumbnail(p);
  await api.projects.save(p); p = await api.projects.get(p.id);
  nav.editor(p);
}

/* ---------- projects ---------- */
function projectCard(s) {
  const open = async () => { const p = await api.projects.get(s.id); if (!p) return toast('Proyek tidak ditemukan', 'err'); nav.editor(p); };
  const card = h('article', { class: 'pcard' + (s.archived ? ' archived' : ''), 'data-id': s.id },
    h('button', { class: 'th', onclick: open, 'aria-label': 'Buka ' + s.name }, s.thumbnail ? h('img', { src: s.thumbnail, alt: '' }) : h('span', { class: 'none' }, 'Tanpa pratinjau')),
    h('div', { class: 'meta' }, h('b', { title: s.name }, s.name), h('span', null, `${presetOf(s.preset).label} · ${s.width}×${s.height}`), h('span', null, (s.archived ? 'Diarsipkan · ' : '') + 'Diubah ' + ago(s.updatedAt))),
    h('button', { class: 'btn icon sm menu-btn', 'aria-label': 'Menu proyek ' + s.name, onclick: e => { const r = e.currentTarget.getBoundingClientRect(); projectMenu(s, r.left, r.bottom + 4); } }, icon('more')));
  card.addEventListener('contextmenu', e => { e.preventDefault(); projectMenu(s, e.clientX, e.clientY); });
  return card;
}
function projectMenu(s, x, y) {
  const refresh = () => showDashboard(current);
  ctxMenu(x, y, [
    { label: 'Buka', run: async () => nav.editor(await api.projects.get(s.id)) },
    { label: 'Ganti nama…', run: async () => { const n = await promptBox('Ganti nama proyek', 'Nama baru', s.name); if (n) { await api.projects.rename(s.id, n); toast('Nama diganti', 'ok'); refresh(); } } },
    { label: 'Duplikat', run: async () => { await api.projects.duplicate(s.id); toast('Proyek diduplikat', 'ok'); refresh(); } },
    { label: 'Simpan sebagai template…', run: async () => { const n = await promptBox('Simpan sebagai template', 'Nama template', s.name); if (n) { await api.templates.saveFromProject(s.id, n, 'Kustom'); toast('Template disimpan. Pilih di "Mulai dari" saat membuat proyek.', 'ok'); } } },
    { label: 'Ekspor file proyek (.qbzproj)…', run: async () => { const f = await api.projects.exportFile(s.id); if (f) toast('File proyek disimpan', 'ok'); } },
    '-',
    { label: s.archived ? 'Keluarkan dari arsip' : 'Arsipkan', run: async () => { await api.projects.archive(s.id, !s.archived); toast(s.archived ? 'Proyek aktif lagi' : 'Proyek diarsipkan', 'ok'); refresh(); } },
    { label: 'Hapus…', run: async () => { if (await confirmBox('Hapus proyek?', `"${s.name}" dipindahkan ke folder Trash di lokasi penyimpanan QBizPro Studio. File aset dan video hasil ekspor tidak ikut terhapus.`, 'Hapus', true)) { await api.projects.delete(s.id); toast('Proyek dihapus', 'ok'); refresh(); } } }
  ]);
}
async function projects() {
  const list = await api.projects.list();
  const shown = list.filter(p => !!p.archived === projFilter.archived && (!projFilter.q || p.name.toLowerCase().includes(projFilter.q.toLowerCase())));
  const q = h('input', { type: 'search', placeholder: 'Cari nama proyek', value: projFilter.q, 'aria-label': 'Cari proyek', oninput: e => { projFilter.q = e.target.value; clearTimeout(q._t); q._t = setTimeout(() => { showDashboard('projects'); setTimeout(() => { const n = $('#dmain input[type=search]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 0); }, 250); } });
  return [head('Proyek', 'Klik kanan atau tombol ⋯ pada kartu untuk ganti nama, duplikat, simpan sebagai template, arsipkan, atau hapus.', h('button', { class: 'btn', onclick: importProjectFile }, icon('folder'), 'Buka file proyek'), h('button', { class: 'btn gold', onclick: () => go('home', true) }, icon('plus'), 'Proyek baru')),
    h('div', { class: 'toolbar' }, q, h('button', { class: 'chip', 'aria-pressed': String(!projFilter.archived), onclick: () => { projFilter.archived = false; showDashboard('projects'); } }, `Aktif (${list.filter(p => !p.archived).length})`), h('button', { class: 'chip', 'aria-pressed': String(projFilter.archived), onclick: () => { projFilter.archived = true; showDashboard('projects'); } }, `Arsip (${list.filter(p => p.archived).length})`)),
    shown.length ? h('div', { class: 'gallery' }, shown.map(projectCard)) : h('div', { class: 'empty' }, h('b', null, projFilter.q ? 'Tidak ada yang cocok' : projFilter.archived ? 'Arsip kosong' : 'Belum ada proyek'), projFilter.archived ? 'Proyek yang diarsipkan tampil di sini.' : 'Mulai dari Beranda.')];
}
async function importProjectFile() { try { const p = await api.projects.importFile(); if (p) { toast('Proyek dibuka dari file', 'ok'); nav.editor(p); } } catch (e) { toast(e.message, 'err'); } }

/* ---------- templates ---------- */
async function templates() {
  const user = await api.templates.list();
  const use = (id, preset) => {
    const picker = presetPicker(); if (preset) st.preset = preset;
    const nm = h('input', { type: 'text', placeholder: 'Nama proyek (boleh kosong)', 'aria-label': 'Nama proyek' });
    modal({ title: 'Gunakan template', wide: true, body: h('div', { class: 'stack' }, h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Nama proyek'), nm), h('div', { class: 'row' }, h('span', { class: 'lab' }, 'Ukuran'), picker)),
      actions: [{ label: 'Batal' }, { label: 'Buat proyek', kind: 'gold', run: () => { createProject(id, st.preset, nm.value.trim()).catch(e => toast(e.message, 'err')); } }] });
  };
  const bcards = builtinTemplates().map(t => h('article', { class: 'card stack' }, h('div', { class: 'flex', style: { justifyContent: 'space-between' } }, h('h2', null, t.name), h('span', { class: 'tag gold' }, t.category)), h('p', { class: 'hint' }, t.description), h('div', { class: 'flex' }, h('button', { class: 'btn gold sm', onclick: () => use(t.id) }, 'Gunakan'))));
  const ucards = user.map(t => { const c = h('article', { class: 'pcard' }, h('button', { class: 'th', onclick: () => use(t.id, t.preset), 'aria-label': 'Gunakan ' + t.name }, t.thumbnail ? h('img', { src: t.thumbnail, alt: '' }) : h('span', { class: 'none' }, 'Tanpa pratinjau')),
    h('div', { class: 'meta' }, h('b', null, t.name), h('span', null, `${t.category} · ${t.width}×${t.height}`)),
    h('button', { class: 'btn icon sm menu-btn', 'aria-label': 'Menu template ' + t.name, onclick: e => { const r = e.currentTarget.getBoundingClientRect(); ctxMenu(r.left, r.bottom + 4, [
      { label: 'Gunakan', run: () => use(t.id, t.preset) },
      { label: 'Ganti nama…', run: async () => { const n = await promptBox('Ganti nama template', 'Nama baru', t.name); if (n) { await api.templates.rename(t.id, n); showDashboard('templates'); } } },
      { label: 'Hapus…', run: async () => { if (await confirmBox('Hapus template?', `Template "${t.name}" dihapus permanen. Proyek yang dibuat darinya tidak terpengaruh.`, 'Hapus', true)) { await api.templates.delete(t.id); showDashboard('templates'); } } }]); } }, icon('more'))); return c; });
  return [head('Template', 'Template bawaan dan template yang Anda simpan dari proyek. Template review produk dan promo lainnya menyusul di Fase 2.'),
    h('div', { class: 'section' }, h('div', { class: 'flex' }, h('h2', null, 'Bawaan')), h('div', { class: 'gallery', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' } }, bcards)),
    h('div', { class: 'section' }, h('div', { class: 'flex' }, h('h2', null, 'Template milik Anda')), ucards.length ? h('div', { class: 'gallery' }, ucards) : h('div', { class: 'empty' }, h('b', null, 'Belum ada'), 'Buka menu ⋯ pada kartu proyek lalu pilih "Simpan sebagai template".'))];
}

/* ---------- assets ---------- */
export function assetThumb(a) {
  if (/^image\//.test(a.mime)) return h('img', { src: api.assetUrl(a.id), alt: '', loading: 'lazy' });
  if (/^video\//.test(a.mime)) return h('video', { src: api.assetUrl(a.id), muted: true, preload: 'metadata' });
  return h('div', { class: 'kind' }, a.ext.toUpperCase(), h('br'), ASSET_CATS[a.category]?.label || '');
}
async function assetsView(cats, title, text) {
  const all = await api.assets.list(); const pool = cats ? all.filter(a => cats.includes(a.category)) : all;
  const filt = cats && cats.length === 1 ? cats[0] : (assetFilter && (!cats || cats.includes(assetFilter)) ? assetFilter : '');
  const list = filt ? pool.filter(a => a.category === filt) : pool;
  const importCat = filt || (cats ? cats[0] : 'product-image');
  const chips = (cats || Object.keys(ASSET_CATS)); const showChips = chips.length > 1;
  const btns = (cats || Object.keys(ASSET_CATS)).length > 1 && !filt ? h('select', { 'aria-label': 'Jenis aset untuk diimpor', id: 'importCat' }, chips.map(c => h('option', { value: c }, ASSET_CATS[c].label))) : null;
  const doImport = async () => { const c = btns ? btns.value : importCat; const r = await api.assets.importDialog(c); afterImport(r); };
  return [head(title, text, btns, h('button', { class: 'btn gold', onclick: doImport }, icon('upload'), 'Impor file')),
    showChips ? h('div', { class: 'toolbar' }, h('button', { class: 'chip', 'aria-pressed': String(!filt), onclick: () => { assetFilter = ''; showDashboard(current); } }, `Semua (${pool.length})`),
      chips.map(c => { const n = pool.filter(a => a.category === c).length; return h('button', { class: 'chip', 'aria-pressed': String(filt === c), onclick: () => { assetFilter = c; showDashboard(current); } }, `${ASSET_CATS[c].label} (${n})`); })) : null,
    list.length ? h('div', { class: 'agrid' }, list.map(assetCard)) : h('div', { class: 'empty' }, h('b', null, 'Belum ada aset'), `Klik "Impor file" atau seret file ke sini. Format: ${(cats || [importCat]).map(c => ASSET_CATS[c].exts.join(', ')).join(' · ')}.`)];
}
function assetCard(a) {
  const c = h('article', { class: 'acard', title: a.name }, h('div', { class: 'th' }, assetThumb(a)), h('div', { class: 'meta' }, h('b', null, a.name), h('span', null, `${ASSET_CATS[a.category]?.label || a.category} · ${a.ext.toUpperCase()} · ${fmtSize(a.size)}`)),
    h('button', { class: 'btn icon sm menu-btn', style: { position: 'absolute', top: '6px', right: '6px' }, 'aria-label': 'Menu aset ' + a.name, onclick: e => { const r = e.currentTarget.getBoundingClientRect(); assetMenu(a, r.left, r.bottom + 4); } }, icon('more')));
  c.addEventListener('contextmenu', e => { e.preventDefault(); assetMenu(a, e.clientX, e.clientY); });
  return c;
}
function assetMenu(a, x, y) {
  const okCats = Object.keys(ASSET_CATS).filter(k => k !== a.category && ASSET_CATS[k].exts.includes(a.ext));
  ctxMenu(x, y, [
    { label: 'Ganti nama…', run: async () => { const n = await promptBox('Ganti nama aset', 'Nama baru', a.name); if (n) { await api.assets.update(a.id, { name: n }); showDashboard(current); } } },
    ...okCats.slice(0, 4).map(k => ({ label: 'Pindah ke ' + ASSET_CATS[k].label, run: async () => { await api.assets.update(a.id, { category: k }); toast('Kategori diubah', 'ok'); showDashboard(current); } })),
    '-',
    { label: 'Hapus…', run: async () => { if (await confirmBox('Hapus aset?', `"${a.name}" dipindahkan ke Trash. Proyek yang memakai aset ini akan menampilkan kotak kosong di tempatnya.`, 'Hapus', true)) { await api.assets.delete(a.id); dropAsset(a.id); showDashboard(current); } } }
  ]);
}
export function afterImport(r) {
  if (r.added.length) toast(`${r.added.length} file diimpor`, 'ok'); for (const e of r.errors) toast(e, 'err', 7000);
  if (r.added.some(a => a.category === 'font')) loadCustomFonts();
  if (document.querySelector('.dash')) showDashboard(current);
}
function setupDrop(main) {
  main.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); main.classList.add('dragging'); } });
  main.addEventListener('drop', async e => {
    if (!e.dataTransfer.files.length) return; e.preventDefault();
    const def = { brand: 'brand-logo', products: 'product-image' }[current]; const added = [], errors = [];
    for (const f of e.dataTransfer.files) { const ext = f.name.split('.').pop().toLowerCase(); let cat = def || ($('#importCat')?.value) || guessCat(ext); if (current === 'products' && ASSET_CATS['product-video'].exts.includes(ext)) cat = 'product-video'; if (!ASSET_CATS[cat].exts.includes(ext)) cat = guessCat(ext);
      try { added.push(await api.assets.importBuffer(f.name, new Uint8Array(await f.arrayBuffer()), cat)); } catch (x) { errors.push(f.name + ': ' + x.message); } }
    afterImport({ added, errors });
  });
}
export const guessCat = ext => (['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext) ? 'music' : ['mp4', 'mov', 'webm', 'mkv'].includes(ext) ? 'product-video' : ['ttf', 'otf', 'woff', 'woff2'].includes(ext) ? 'font' : 'product-image');

/* ---------- animation library ---------- */
function animations() {
  const ready = [['Brand Roulette Intro', 'Pembuka 8 tahap: cahaya, garis orbit, logo brand muncul, roulette berputar, melambat, sorotan, zoom kamera, halaman review.'],
    ['Fade in / fade out', 'Setiap layer bisa muncul dan menghilang perlahan. Atur di panel Properti → Tampil.'], ['Blur, bayangan, glow, outline', 'Efek dasar untuk teks, gambar, logo, dan bentuk.']];
  const later = [['Animasi teks', 'Fade up, typewriter, slide, zoom, glitch, neon, gradient, mask reveal, letter by letter, word by word.', 'Fase 2'], ['Motion', 'Slide, zoom, rotate, bounce, elastic, glow pulse, light sweep, floating, parallax, camera push/pan.', 'Fase 2'],
    ['Keyframe', 'Posisi, skala, rotasi, opasitas, dan blur yang berubah sepanjang waktu, dengan pilihan easing.', 'Fase 2'], ['Transisi', 'Wipe, slide, zoom-through, flash, dan cahaya di antara adegan.', 'Fase 3']];
  return [head('Pustaka animasi', 'Animasi yang sudah bisa dipakai di Fase 1, dan yang dijadwalkan untuk fase berikutnya.'),
    h('div', { class: 'section' }, h('div', { class: 'flex' }, h('h2', null, 'Siap dipakai')), h('div', { class: 'gallery', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' } }, ready.map(([n, d]) => h('article', { class: 'card stack' }, h('div', { class: 'flex', style: { justifyContent: 'space-between' } }, h('h2', null, n), h('span', { class: 'tag gold' }, 'Siap')), h('p', { class: 'hint' }, d))))),
    h('div', { class: 'section' }, h('div', { class: 'flex' }, h('h2', null, 'Berikutnya')), h('div', { class: 'gallery', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' } }, later.map(([n, d, f]) => h('article', { class: 'card stack', style: { opacity: 0.75 } }, h('div', { class: 'flex', style: { justifyContent: 'space-between' } }, h('h2', null, n), h('span', { class: 'tag' }, f)), h('p', { class: 'hint' }, d)))))];
}

/* ---------- exports ---------- */
async function exports() {
  const list = await api.export.list();
  const rows = list.map(e => h('tr', null, h('td', null, h('b', null, e.name || (e.path || '').split(/[\\/]/).pop()), h('div', { class: 'hint' }, e.kind === 'image' ? 'Gambar' : `${e.width ? e.width + '×' + e.height + ' · ' : ''}${e.fps ? e.fps + ' fps · ' : ''}${e.codec || 'MP4'}`)),
    h('td', { class: 'mono' }, e.size ? fmtSize(e.size) : '—'), h('td', { class: 'mono' }, e.duration ? e.duration.toFixed(1) + ' dtk' : '—'), h('td', null, fmtDate(e.at)),
    h('td', null, e.exists ? h('div', { class: 'flex' }, h('button', { class: 'btn sm', onclick: () => api.shell.open(e.path).catch(x => toast(x.message, 'err')) }, icon('play'), 'Putar'), h('button', { class: 'btn sm', onclick: () => api.shell.reveal(e.path) }, icon('folder'), 'Tampilkan di folder'))
      : h('span', { class: 'hint' }, 'File sudah dipindah atau dihapus')),
    h('td', null, h('button', { class: 'btn ghost icon sm', 'aria-label': 'Hapus dari daftar', title: 'Hapus dari daftar (file tidak dihapus)', onclick: async () => { await api.export.remove(e.id); showDashboard('exports'); } }, icon('x')))));
  return [head('Video hasil ekspor', 'Riwayat ekspor. Menghapus dari daftar tidak menghapus file videonya.', h('button', { class: 'btn', onclick: async () => api.shell.open(await api.export.defaultFolder()).catch(x => toast(x.message, 'err')) }, icon('folder'), 'Buka folder Exports')),
    list.length ? h('div', { class: 'card', style: { padding: 0 } }, h('table', { class: 'list' }, h('thead', null, h('tr', null, ['Nama', 'Ukuran', 'Durasi', 'Waktu', '', ''].map(t => h('th', null, t)))), h('tbody', null, rows))) : h('div', { class: 'empty' }, h('b', null, 'Belum ada ekspor'), 'Video yang Anda ekspor dari editor tampil di sini.')];
}
function presets() {
  return [head('Preset ukuran', 'Ukuran kanvas per platform. Area aman menandai bagian yang tertutup tombol dan teks aplikasi saat video diputar.'),
    h('div', { class: 'card', style: { padding: 0 } }, h('table', { class: 'list' }, h('thead', null, h('tr', null, ['Platform', 'Kelompok', 'Resolusi', 'Area aman (atas / bawah / kiri / kanan)', ''].map(t => h('th', null, t)))),
      h('tbody', null, PRESETS.map(P => h('tr', null, h('td', null, h('b', null, P.label)), h('td', null, P.group), h('td', { class: 'mono' }, `${P.w}×${P.h}`), h('td', { class: 'mono' }, `${P.safe.t} / ${P.safe.b} / ${P.safe.l} / ${P.safe.r} px`),
        h('td', null, h('button', { class: 'btn sm', onclick: () => { st.preset = P.id; go('home', true); } }, 'Buat proyek')))))))];
}
async function settings() {
  const [info, caps] = await Promise.all([api.app.info(), api.export.capabilities()]);
  const gpu = info.gpu || {}; const gpuOn = Object.entries(gpu).filter(([, v]) => /enabled/.test(v)).map(([k]) => k);
  return [head('Pengaturan', 'Lokasi penyimpanan dan kemampuan komputer ini untuk ekspor video.'),
    h('div', { class: 'gallery', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' } },
      h('div', { class: 'card stack' }, h('h2', null, 'Lokasi penyimpanan'), h('p', { class: 'hint' }, 'Proyek, template, aset, simpanan otomatis, dan hasil ekspor disimpan di folder ini.'), h('code', { style: { fontFamily: 'var(--mono)', fontSize: '12px', wordBreak: 'break-all' } }, info.base),
        h('div', { class: 'flex' }, h('button', { class: 'btn sm', onclick: () => api.shell.open(info.base).catch(x => toast(x.message, 'err')) }, icon('folder'), 'Buka folder'), h('button', { class: 'btn sm', onclick: async () => { const b = await api.app.chooseBase(); if (b) { toast('Lokasi penyimpanan diganti. Data lama tetap di folder sebelumnya.', 'ok', 6000); showDashboard('settings'); } } }, 'Ganti lokasi…'))),
      h('div', { class: 'card stack' }, h('h2', null, 'Ekspor video'), caps.ffmpeg ? h('p', { class: 'hint' }, 'FFmpeg ' + caps.version + ' siap.') : h('p', { class: 'hint', style: { color: 'var(--warn)' } }, caps.error || 'FFmpeg tidak ditemukan.'),
        h('div', null, h('span', { class: 'lab' }, 'Encoder yang bekerja di komputer ini'), h('ul', { style: { margin: '6px 0 0', paddingLeft: '18px' } }, [...caps.encoders.h264, ...caps.encoders.h265].map(e => h('li', null, e.label, e.gpu ? h('span', { class: 'tag gold', style: { marginLeft: '6px' } }, 'GPU') : null))))),
      h('div', { class: 'card stack' }, h('h2', null, 'Tentang'), h('p', { class: 'hint' }, `Versi ${info.version} · ${info.platform}`), h('p', { class: 'hint' }, gpuOn.length ? 'Akselerasi GPU aktif untuk: ' + gpuOn.slice(0, 6).join(', ') : 'Akselerasi GPU tidak dilaporkan.'), h('p', { class: 'hint' }, 'Font bawaan: Sora, IBM Plex Sans, Montserrat, Orbitron, IBM Plex Mono (SIL Open Font License).')))];
}

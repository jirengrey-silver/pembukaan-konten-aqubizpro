// Access to the desktop side (window.qbz from preload). When the UI is opened in a plain browser
// (development preview and automated UI tests) an in-memory stand-in with the same shape is used.
const CATS = {
  'brand-logo': { label: 'Logo brand', exts: ['png', 'svg', 'webp', 'jpg', 'jpeg'] },
  'product-image': { label: 'Gambar produk', exts: ['png', 'jpg', 'jpeg', 'webp', 'svg'] },
  'product-video': { label: 'Video produk', exts: ['mp4', 'mov', 'webm', 'mkv'] },
  'bg-image': { label: 'Gambar latar', exts: ['png', 'jpg', 'jpeg', 'webp'] },
  'bg-video': { label: 'Video latar', exts: ['mp4', 'mov', 'webm'] },
  icon: { label: 'Ikon', exts: ['png', 'svg', 'webp'] },
  illustration: { label: 'Ilustrasi', exts: ['png', 'svg', 'webp', 'jpg', 'jpeg'] },
  music: { label: 'Musik', exts: ['mp3', 'wav', 'm4a', 'ogg', 'aac'] },
  sfx: { label: 'Efek suara', exts: ['mp3', 'wav', 'm4a', 'ogg'] },
  font: { label: 'Font', exts: ['ttf', 'otf', 'woff', 'woff2'] }
};
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', aac: 'audio/aac', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };

function mock() {
  const id = () => Math.random().toString(16).slice(2, 14);
  const clone = o => JSON.parse(JSON.stringify(o));
  const db = { projects: new Map(), autosave: new Map(), templates: new Map(), assets: [], blobs: new Map(), exports: [], settings: {}, jobs: new Map() };
  const summary = p => ({ id: p.id, name: p.name, preset: p.preset, width: p.width, height: p.height, duration: p.duration, archived: !!p.archived, thumbnail: p.thumbnail || null, updatedAt: p.updatedAt || 0, createdAt: p.createdAt || 0 });
  const pick = (accept, multiple) => new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple; i.onchange = () => res([...i.files]); i.click(); });
  const addBlob = async (name, blob, cat) => {
    const ext = (name.split('.').pop() || '').toLowerCase(); const c = CATS[cat] ? cat : 'product-image';
    if (!CATS[c].exts.includes(ext)) throw new Error(`Format .${ext} tidak didukung untuk ${CATS[c].label}. Gunakan: ${CATS[c].exts.join(', ')}`);
    const a = { id: id(), name: name.replace(/\.[^.]+$/, ''), category: c, file: name, ext, mime: MIME[ext] || blob.type, size: blob.size, createdAt: Date.now() };
    db.blobs.set(a.id, URL.createObjectURL(new Blob([blob], { type: a.mime }))); db.assets.push(a); return a;
  };
  return {
    desktop: false,
    projects: {
      list: async () => [...db.projects.values()].map(summary).sort((a, b) => b.updatedAt - a.updatedAt),
      get: async i => (db.projects.has(i) ? clone(db.projects.get(i)) : null),
      save: async p => { p = clone(p); if (!p.createdAt) p.createdAt = Date.now(); p.updatedAt = Date.now(); p.format = 'qbizpro-project'; p.formatVersion = 1; db.projects.set(p.id, p); db.autosave.delete(p.id); return { id: p.id, updatedAt: p.updatedAt }; },
      duplicate: async i => { const p = clone(db.projects.get(i)); p.id = id(); p.name += ' (salinan)'; p.createdAt = p.updatedAt = Date.now(); db.projects.set(p.id, p); return clone(p); },
      rename: async (i, n) => { const p = db.projects.get(i); p.name = n; p.updatedAt = Date.now(); return clone(p); },
      archive: async (i, v) => { const p = db.projects.get(i); p.archived = !!v; p.updatedAt = Date.now(); return clone(p); },
      delete: async i => { db.projects.delete(i); db.autosave.delete(i); return true; },
      autosave: async p => { db.autosave.set(p.id, Object.assign(clone(p), { autosavedAt: Date.now() })); return true; },
      recoveries: async () => [...db.autosave.values()].filter(a => !db.projects.has(a.id) || a.autosavedAt > db.projects.get(a.id).updatedAt).map(a => ({ id: a.id, name: a.name, autosavedAt: a.autosavedAt, hasSaved: db.projects.has(a.id) })),
      recover: async i => { const a = clone(db.autosave.get(i)); delete a.autosavedAt; a.updatedAt = Date.now(); db.projects.set(a.id, a); db.autosave.delete(i); return a; },
      discardRecovery: async i => { db.autosave.delete(i); return true; },
      exportFile: async i => { const b = new Blob([JSON.stringify(db.projects.get(i))], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (db.projects.get(i).name || 'proyek') + '.qbzproj'; a.click(); return a.download; },
      importFile: async () => { const [f] = await pick('.qbzproj'); if (!f) return null; const p = JSON.parse(await f.text()); if (!p || !Array.isArray(p.layers)) throw new Error('File ini bukan proyek QBizPro'); p.id = id(); p.updatedAt = Date.now(); db.projects.set(p.id, p); return clone(p); }
    },
    templates: {
      list: async () => [...db.templates.values()].map(t => ({ id: t.id, name: t.name, preset: t.preset, width: t.width, height: t.height, thumbnail: t.thumbnail, createdAt: t.createdAt, category: t.templateCategory })),
      get: async i => clone(db.templates.get(i)),
      saveFromProject: async (pid, name, cat) => { const t = Object.assign(clone(db.projects.get(pid)), { id: id(), name, templateCategory: cat || 'Kustom', createdAt: Date.now() }); db.templates.set(t.id, t); return t; },
      rename: async (i, n) => { db.templates.get(i).name = n; return clone(db.templates.get(i)); },
      delete: async i => { db.templates.delete(i); return true; }
    },
    assets: {
      categories: async () => CATS,
      list: async c => db.assets.filter(a => !c || a.category === c).slice().sort((a, b) => b.createdAt - a.createdAt),
      importDialog: async c => { const files = await pick((CATS[c] || CATS['product-image']).exts.map(e => '.' + e).join(','), true); const added = [], errors = []; for (const f of files) { try { added.push(await addBlob(f.name, f, c)); } catch (e) { errors.push(f.name + ': ' + e.message); } } return { added, errors }; },
      importBuffer: async (name, data, c) => addBlob(name, new Blob([data]), c),
      update: async (i, patch) => { const a = db.assets.find(x => x.id === i); if (patch.name) a.name = patch.name; if (patch.category && CATS[patch.category]) a.category = patch.category; return a; },
      delete: async i => { db.assets = db.assets.filter(a => a.id !== i); return true; },
      path: async i => db.blobs.get(i) || null
    },
    export: {
      capabilities: async () => ({ ffmpeg: null, error: 'Pratinjau browser: ekspor MP4 hanya tersedia di aplikasi desktop.', encoders: { h264: [{ id: 'libx264', label: 'H.264 (CPU)', gpu: false }], h265: [{ id: 'libx265', label: 'H.265 (CPU)', gpu: false }] } }),
      chooseFolder: async () => 'Downloads', defaultFolder: async () => 'Downloads',
      start: async o => { const j = { id: db.jobs.size + 1, frames: 0, o }; db.jobs.set(j.id, j); return { id: j.id, outPath: 'Downloads/' + o.fileName }; },
      frame: async (i, data) => { const j = db.jobs.get(i); j.frames++; return j.frames; },
      finish: async (i, meta) => { const j = db.jobs.get(i); const rec = Object.assign({ id: String(Date.now()), at: Date.now(), path: 'Downloads/' + j.o.fileName, size: j.frames * 9000, seconds: 1, kind: 'video', frames: j.frames }, meta); db.exports.push(rec); return rec; },
      cancel: async i => { db.jobs.delete(i); return true; },
      saveImage: async (name, data) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = name; a.click(); const rec = { id: String(Date.now()), at: Date.now(), path: 'Downloads/' + name, size: data.byteLength, kind: 'image', name }; db.exports.push(rec); return rec; },
      list: async () => db.exports.map(e => Object.assign({ exists: true }, e)).sort((a, b) => b.at - a.at),
      remove: async i => { db.exports = db.exports.filter(e => e.id !== i); return true; }
    },
    media: { probe: async () => ({ duration: 0, video: false, audio: true, info: '' }) },
    shell: { reveal: async () => true, open: async () => true },
    app: { info: async () => ({ version: 'preview', base: '(memori browser)', dirs: {}, platform: 'browser', gpu: {} }), chooseBase: async () => null },
    settings: { get: async () => clone(db.settings), set: async p => Object.assign(db.settings, p) },
    assetUrl: i => db.blobs.get(i) || '',
    onBeforeClose: () => {}, readyToClose: () => {}, setFullscreen: on => { if (on) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }, smoke: () => {},
    __db: db
  };
}

export const api = window.qbz || mock();
export const ASSET_CATS = CATS;

// Local storage for projects, templates, assets, autosave and export history.
// Everything lives in one folder (default: Documents/QBizPro Studio) so the user can back it up.
'use strict';
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ASSET_CATEGORIES = {
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
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', aac: 'audio/aac', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
const MAX_ASSET_BYTES = 1024 * 1024 * 1024;

const newId = () => crypto.randomBytes(6).toString('hex');
const safeName = s => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Tanpa nama';

async function writeAtomic(file, data) {
  const tmp = file + '.' + process.pid + '.' + Date.now() + '.tmp';
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}
async function readJSON(file, fallback) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch (e) { return fallback; }
}

class Storage {
  constructor(base) { this.setBase(base); }
  setBase(base) {
    this.base = base;
    this.dirs = {
      projects: path.join(base, 'Projects'), templates: path.join(base, 'Templates'), assets: path.join(base, 'Assets'),
      assetFiles: path.join(base, 'Assets', 'files'), autosave: path.join(base, 'Autosave'), exports: path.join(base, 'Exports'), trash: path.join(base, 'Trash')
    };
    for (const d of Object.values(this.dirs)) fs.mkdirSync(d, { recursive: true });
    this.assetIndexFile = path.join(this.dirs.assets, 'index.json');
    this.exportsFile = path.join(base, 'exports.json');
    this.settingsFile = path.join(base, 'settings.json');
  }

  /* ---------- projects ---------- */
  projectFile(id) { return path.join(this.dirs.projects, id + '.qbzproj'); }
  async listProjects() {
    const out = [];
    for (const f of await fsp.readdir(this.dirs.projects)) {
      if (!f.endsWith('.qbzproj')) continue;
      const p = await readJSON(path.join(this.dirs.projects, f), null); if (!p || !p.id) continue;
      out.push({ id: p.id, name: p.name, preset: p.preset, width: p.width, height: p.height, duration: p.duration, archived: !!p.archived, thumbnail: p.thumbnail || null, updatedAt: p.updatedAt || 0, createdAt: p.createdAt || 0 });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async getProject(id) { return readJSON(this.projectFile(id), null); }
  async saveProject(p) {
    if (!p || !p.id) throw new Error('Proyek tidak valid');
    p.name = safeName(p.name); p.updatedAt = Date.now(); if (!p.createdAt) p.createdAt = p.updatedAt; p.format = 'qbizpro-project'; p.formatVersion = 1;
    await writeAtomic(this.projectFile(p.id), JSON.stringify(p));
    try { await fsp.unlink(path.join(this.dirs.autosave, p.id + '.json')); } catch (e) { /* no autosave to clear */ }
    return { id: p.id, updatedAt: p.updatedAt };
  }
  async duplicateProject(id) {
    const p = await this.getProject(id); if (!p) throw new Error('Proyek tidak ditemukan');
    p.id = newId(); p.name = safeName(p.name + ' (salinan)'); p.createdAt = 0; p.archived = false;
    await this.saveProject(p); return p;
  }
  async renameProject(id, name) { const p = await this.getProject(id); if (!p) throw new Error('Proyek tidak ditemukan'); p.name = name; await this.saveProject(p); return p; }
  async archiveProject(id, archived) { const p = await this.getProject(id); if (!p) throw new Error('Proyek tidak ditemukan'); p.archived = !!archived; await this.saveProject(p); return p; }
  async deleteProject(id) {
    // moved to Trash instead of erased, so an accidental delete can be recovered from disk
    const src = this.projectFile(id); const dst = path.join(this.dirs.trash, id + '-' + Date.now() + '.qbzproj');
    try { await fsp.rename(src, dst); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    try { await fsp.unlink(path.join(this.dirs.autosave, id + '.json')); } catch (e) { /* none */ }
    return true;
  }
  async importProjectFile(file) {
    const p = await readJSON(file, null); if (!p || p.format !== 'qbizpro-project') throw new Error('File ini bukan proyek QBizPro Studio');
    p.id = newId(); p.createdAt = 0; await this.saveProject(p); return p;
  }
  async exportProjectFile(id, file) { const p = await this.getProject(id); if (!p) throw new Error('Proyek tidak ditemukan'); await fsp.writeFile(file, JSON.stringify(p, null, 1)); return file; }

  /* ---------- autosave & recovery ---------- */
  async autosave(p) {
    if (!p || !p.id) return false;
    await writeAtomic(path.join(this.dirs.autosave, p.id + '.json'), JSON.stringify(Object.assign({}, p, { autosavedAt: Date.now() })));
    return true;
  }
  async recoveries() {
    const out = [];
    for (const f of await fsp.readdir(this.dirs.autosave)) {
      if (!f.endsWith('.json')) continue;
      const a = await readJSON(path.join(this.dirs.autosave, f), null); if (!a || !a.id) continue;
      const saved = await this.getProject(a.id);
      if (!saved || (a.autosavedAt || 0) > (saved.updatedAt || 0)) out.push({ id: a.id, name: a.name, autosavedAt: a.autosavedAt, hasSaved: !!saved });
    }
    return out;
  }
  async recover(id) { const a = await readJSON(path.join(this.dirs.autosave, id + '.json'), null); if (!a) throw new Error('Data pemulihan tidak ditemukan'); delete a.autosavedAt; await this.saveProject(a); return a; }
  async discardRecovery(id) { try { await fsp.unlink(path.join(this.dirs.autosave, id + '.json')); } catch (e) { /* gone */ } return true; }

  /* ---------- templates ---------- */
  async listTemplates() {
    const out = [];
    for (const f of await fsp.readdir(this.dirs.templates)) {
      if (!f.endsWith('.qbztpl')) continue; const t = await readJSON(path.join(this.dirs.templates, f), null); if (!t || !t.id) continue;
      out.push({ id: t.id, name: t.name, preset: t.preset, width: t.width, height: t.height, thumbnail: t.thumbnail || null, createdAt: t.createdAt || 0, category: t.templateCategory || 'Kustom' });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }
  async getTemplate(id) { return readJSON(path.join(this.dirs.templates, id + '.qbztpl'), null); }
  async saveAsTemplate(projectId, name, category) {
    const p = await this.getProject(projectId); if (!p) throw new Error('Proyek tidak ditemukan');
    const t = Object.assign({}, p, { id: newId(), name: safeName(name || p.name), createdAt: Date.now(), templateCategory: category || 'Kustom', archived: false });
    await writeAtomic(path.join(this.dirs.templates, t.id + '.qbztpl'), JSON.stringify(t)); return t;
  }
  async deleteTemplate(id) { try { await fsp.unlink(path.join(this.dirs.templates, id + '.qbztpl')); } catch (e) { if (e.code !== 'ENOENT') throw e; } return true; }
  async renameTemplate(id, name) { const t = await this.getTemplate(id); if (!t) throw new Error('Template tidak ditemukan'); t.name = safeName(name); await writeAtomic(path.join(this.dirs.templates, id + '.qbztpl'), JSON.stringify(t)); return t; }

  /* ---------- assets ---------- */
  async assetIndex() { return readJSON(this.assetIndexFile, []); }
  async writeAssetIndex(list) { await writeAtomic(this.assetIndexFile, JSON.stringify(list, null, 1)); }
  async listAssets(category) { const list = await this.assetIndex(); return (category ? list.filter(a => a.category === category) : list).sort((a, b) => b.createdAt - a.createdAt); }
  assetPath(a) { return path.join(this.dirs.assetFiles, a.file); }
  async addAssetFromBuffer(name, buf, category) {
    const ext = (path.extname(name).slice(1) || '').toLowerCase();
    const cat = ASSET_CATEGORIES[category] ? category : guessCategory(ext);
    if (!ASSET_CATEGORIES[cat].exts.includes(ext)) throw new Error(`Format .${ext || '?'} tidak didukung untuk ${ASSET_CATEGORIES[cat].label}. Gunakan: ${ASSET_CATEGORIES[cat].exts.join(', ')}`);
    if (buf.length > MAX_ASSET_BYTES) throw new Error('File lebih dari 1 GB');
    const id = newId(); const file = id + '.' + ext;
    await fsp.writeFile(path.join(this.dirs.assetFiles, file), buf);
    const a = { id, name: safeName(path.basename(name, path.extname(name))), category: cat, file, ext, mime: MIME[ext] || 'application/octet-stream', size: buf.length, createdAt: Date.now() };
    const list = await this.assetIndex(); list.push(a); await this.writeAssetIndex(list); return a;
  }
  async addAssetFromFile(file, category) { const buf = await fsp.readFile(file); return this.addAssetFromBuffer(path.basename(file), buf, category); }
  async updateAsset(id, patch) {
    const list = await this.assetIndex(); const a = list.find(x => x.id === id); if (!a) throw new Error('Aset tidak ditemukan');
    if (patch.name != null) a.name = safeName(patch.name);
    if (patch.category && ASSET_CATEGORIES[patch.category] && ASSET_CATEGORIES[patch.category].exts.includes(a.ext)) a.category = patch.category;
    await this.writeAssetIndex(list); return a;
  }
  async deleteAsset(id) {
    const list = await this.assetIndex(); const i = list.findIndex(x => x.id === id); if (i < 0) return true;
    const [a] = list.splice(i, 1); try { await fsp.rename(this.assetPath(a), path.join(this.dirs.trash, a.file)); } catch (e) { /* already gone */ }
    await this.writeAssetIndex(list); return true;
  }
  async findAsset(id) { return (await this.assetIndex()).find(a => a.id === id) || null; }

  /* ---------- export history & settings ---------- */
  async exportsList() { const list = await readJSON(this.exportsFile, []); const out = []; for (const e of list) { let exists = false; try { await fsp.access(e.path); exists = true; } catch (x) { /* moved or deleted */ } out.push(Object.assign({}, e, { exists })); } return out.sort((a, b) => b.at - a.at); }
  async addExport(rec) { const list = await readJSON(this.exportsFile, []); list.push(rec); while (list.length > 300) list.shift(); await writeAtomic(this.exportsFile, JSON.stringify(list, null, 1)); return rec; }
  async removeExport(id) { const list = (await readJSON(this.exportsFile, [])).filter(e => e.id !== id); await writeAtomic(this.exportsFile, JSON.stringify(list, null, 1)); return true; }
  async getSettings() { return readJSON(this.settingsFile, {}); }
  async setSettings(patch) { const s = Object.assign(await this.getSettings(), patch || {}); await writeAtomic(this.settingsFile, JSON.stringify(s, null, 1)); return s; }
}
function guessCategory(ext) {
  if (['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)) return 'music';
  if (['mp4', 'mov', 'webm', 'mkv'].includes(ext)) return 'product-video';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font';
  return 'product-image';
}
module.exports = { Storage, ASSET_CATEGORIES, MIME, newId, safeName };

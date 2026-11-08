'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { Storage, ASSET_CATEGORIES, MIME } = require('./storage.cjs');
const exporter = require('./exporter.cjs');

// one custom scheme serves both the app UI (qbz://app/...) and local assets (qbz://asset/<id>),
// so images drawn on the canvas share the page's origin and can be exported
protocol.registerSchemesAsPrivileged([{ scheme: 'qbz', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

let win = null; let storage = null;
const RENDERER = path.join(__dirname, '..', 'renderer');
const isSmoke = process.argv.includes('--smoke-test');

function defaultBase() { return path.join(app.getPath('documents'), 'QBizPro Studio'); }
function initStorage() {
  const cfgFile = path.join(app.getPath('userData'), 'location.json'); let base = defaultBase();
  try { const c = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); if (c.base && fs.existsSync(c.base)) base = c.base; } catch (e) { /* first run */ }
  storage = new Storage(base);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1480, height: 900, minWidth: 1100, minHeight: 680, backgroundColor: '#070D1C', show: false, title: 'QBizPro Social Media Content Studio',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, backgroundThrottling: false }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL('qbz://app/index.html');
  win.webContents.on('render-process-gone', (e, d) => { dialog.showErrorBox('QBizPro Studio', 'Tampilan aplikasi berhenti (' + d.reason + '). Pekerjaan terakhir tersimpan otomatis dan bisa dipulihkan saat dibuka lagi.'); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('qbz://app/')) e.preventDefault(); });
  win.on('close', e => { if (win.__allowClose) return; e.preventDefault(); win.webContents.send('app:before-close'); setTimeout(() => { if (win && !win.isDestroyed()) { win.__allowClose = true; win.close(); } }, 2500); });
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (e, ...args) => {
    try { return { ok: true, data: await fn(...args) }; }
    catch (err) { return { ok: false, error: err && err.message ? err.message : String(err) }; }
  });
}

app.whenReady().then(async () => {
  initStorage();
  protocol.handle('qbz', async req => {
    const u = new URL(req.url);
    if (u.host === 'app') {
      const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html'; const file = path.normalize(path.join(RENDERER, rel));
      if (!file.startsWith(RENDERER)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(file).toString());
    }
    if (u.host === 'asset') {
      const id = u.pathname.replace(/^\/+/, '').split('.')[0]; const a = await storage.findAsset(id); if (!a) return new Response('Not found', { status: 404 });
      const res = await net.fetch(pathToFileURL(storage.assetPath(a)).toString(), { headers: req.headers });
      const h = new Headers(res.headers); h.set('Content-Type', a.mime); h.set('Access-Control-Allow-Origin', '*');
      return new Response(res.body, { status: res.status, headers: h });
    }
    return new Response('Not found', { status: 404 });
  });

  /* projects */
  handle('projects:list', () => storage.listProjects());
  handle('projects:get', id => storage.getProject(id));
  handle('projects:save', p => storage.saveProject(p));
  handle('projects:duplicate', id => storage.duplicateProject(id));
  handle('projects:rename', (id, name) => storage.renameProject(id, name));
  handle('projects:archive', (id, v) => storage.archiveProject(id, v));
  handle('projects:delete', id => storage.deleteProject(id));
  handle('projects:autosave', p => storage.autosave(p));
  handle('projects:recoveries', () => storage.recoveries());
  handle('projects:recover', id => storage.recover(id));
  handle('projects:discardRecovery', id => storage.discardRecovery(id));
  handle('projects:exportFile', async id => { const p = await storage.getProject(id); const r = await dialog.showSaveDialog(win, { title: 'Simpan file proyek', defaultPath: (p ? p.name : 'proyek') + '.qbzproj', filters: [{ name: 'Proyek QBizPro', extensions: ['qbzproj'] }] }); if (r.canceled) return null; return storage.exportProjectFile(id, r.filePath); });
  handle('projects:importFile', async () => { const r = await dialog.showOpenDialog(win, { title: 'Buka file proyek', filters: [{ name: 'Proyek QBizPro', extensions: ['qbzproj'] }], properties: ['openFile'] }); if (r.canceled || !r.filePaths[0]) return null; return storage.importProjectFile(r.filePaths[0]); });
  /* templates */
  handle('templates:list', () => storage.listTemplates());
  handle('templates:get', id => storage.getTemplate(id));
  handle('templates:saveFromProject', (id, name, cat) => storage.saveAsTemplate(id, name, cat));
  handle('templates:rename', (id, name) => storage.renameTemplate(id, name));
  handle('templates:delete', id => storage.deleteTemplate(id));
  /* assets */
  handle('assets:categories', () => ASSET_CATEGORIES);
  handle('assets:list', cat => storage.listAssets(cat));
  handle('assets:importDialog', async cat => {
    const c = ASSET_CATEGORIES[cat]; const r = await dialog.showOpenDialog(win, { title: 'Impor ' + (c ? c.label : 'aset'), properties: ['openFile', 'multiSelections'], filters: c ? [{ name: c.label, extensions: c.exts }] : [] });
    if (r.canceled) return { added: [], errors: [] }; const added = [], errors = [];
    for (const f of r.filePaths) { try { added.push(await storage.addAssetFromFile(f, cat)); } catch (e) { errors.push(path.basename(f) + ': ' + e.message); } }
    return { added, errors };
  });
  handle('assets:importBuffer', (name, data, cat) => storage.addAssetFromBuffer(name, Buffer.from(data), cat));
  handle('assets:update', (id, patch) => storage.updateAsset(id, patch));
  handle('assets:delete', id => storage.deleteAsset(id));
  handle('assets:path', async id => { const a = await storage.findAsset(id); return a ? storage.assetPath(a) : null; });
  /* export */
  handle('export:capabilities', () => exporter.capabilities(process.resourcesPath));
  handle('export:chooseFolder', async def => { const r = await dialog.showOpenDialog(win, { title: 'Pilih folder hasil ekspor', defaultPath: def || storage.dirs.exports, properties: ['openDirectory', 'createDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
  handle('export:defaultFolder', () => storage.dirs.exports);
  handle('export:start', async o => {
    const caps = await exporter.capabilities(process.resourcesPath); if (!caps.ffmpeg) throw new Error(caps.error);
    let outPath = path.join(o.folder || storage.dirs.exports, o.fileName);
    if (fs.existsSync(outPath)) { const ext = path.extname(outPath); const b = outPath.slice(0, -ext.length); let i = 2; while (fs.existsSync(`${b} (${i})${ext}`)) i++; outPath = `${b} (${i})${ext}`; }
    const audio = []; for (const x of o.audio || []) { const a = await storage.findAsset(x.assetId); if (a) audio.push(Object.assign({}, x, { path: storage.assetPath(a) })); }
    return Object.assign(exporter.start(Object.assign({}, o, { outPath, audio })), { outPath });
  });
  handle('export:frame', (id, data) => exporter.writeFrame(id, data));
  handle('export:finish', async (id, meta) => { const r = await exporter.finish(id); const rec = Object.assign({ id: String(Date.now()), at: Date.now() }, meta || {}, r); await storage.addExport(rec); return rec; });
  handle('export:cancel', id => exporter.cancel(id));
  handle('export:saveImage', async (fileName, data, folder) => { let p = path.join(folder || storage.dirs.exports, fileName); if (fs.existsSync(p)) { const ext = path.extname(p); p = p.slice(0, -ext.length) + '-' + Date.now() + ext; } fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(data)); const rec = { id: String(Date.now()), at: Date.now(), path: p, size: fs.statSync(p).size, kind: 'image', name: fileName }; await storage.addExport(rec); return rec; });
  handle('export:list', () => storage.exportsList());
  handle('export:remove', id => storage.removeExport(id));
  handle('media:probe', async id => { const a = await storage.findAsset(id); if (!a) throw new Error('Aset tidak ditemukan'); await exporter.capabilities(process.resourcesPath); return exporter.probe(storage.assetPath(a)); });
  /* shell & app */
  handle('shell:reveal', p => { shell.showItemInFolder(p); return true; });
  handle('shell:open', async p => { const err = await shell.openPath(p); if (err) throw new Error(err); return true; });
  handle('app:info', () => ({ version: app.getVersion(), base: storage.base, dirs: storage.dirs, platform: process.platform, gpu: app.getGPUFeatureStatus() }));
  handle('app:chooseBase', async () => { const r = await dialog.showOpenDialog(win, { title: 'Pilih folder penyimpanan QBizPro Studio', properties: ['openDirectory', 'createDirectory'] }); if (r.canceled) return null; const base = r.filePaths[0]; storage.setBase(base); fs.writeFileSync(path.join(app.getPath('userData'), 'location.json'), JSON.stringify({ base })); return base; });
  handle('settings:get', () => storage.getSettings());
  handle('settings:set', patch => storage.setSettings(patch));
  ipcMain.on('app:ready-to-close', () => { if (win && !win.isDestroyed()) { win.__allowClose = true; win.close(); } });
  ipcMain.on('app:fullscreen', (e, on) => { if (win) win.setFullScreen(!!on); });

  createWindow();
  if (isSmoke) {
    // used by the automated build check: open, wait for the UI to report ready, then quit
    ipcMain.once('app:smoke', (e, info) => { console.log('SMOKE', JSON.stringify(info)); app.exit(info && info.ok ? 0 : 1); });
    setTimeout(() => { console.log('SMOKE timeout'); app.exit(2); }, 30000);
  }
});
app.on('window-all-closed', () => app.quit());
process.on('uncaughtException', e => { try { fs.appendFileSync(path.join(app.getPath('userData'), 'error.log'), new Date().toISOString() + ' ' + (e.stack || e) + '\n'); } catch (x) { /* ignore */ } });

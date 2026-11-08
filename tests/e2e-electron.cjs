// Drives the real Electron app: create a roulette project, upload a brand logo, export an MP4 via FFmpeg, verify the file.
const { _electron } = require('playwright'); const path = require('path'); const fs = require('fs'); const os = require('os'); const { execFileSync } = require('child_process');
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'qbz-home-'));
  const app = await _electron.launch({ args: [path.join(__dirname, '..'), '--no-sandbox'], env: Object.assign({}, process.env, { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config'), XDG_DOCUMENTS_DIR: path.join(home, 'Documents') }), executablePath: require('electron') });
  const pg = await app.firstWindow(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 20000 });
  ok(await pg.evaluate(() => window.qbz && window.qbz.desktop), 'API desktop aktif');
  const caps = await pg.evaluate(() => window.qbz.export.capabilities()); ok(!!caps.ffmpeg, 'FFmpeg ditemukan: ' + caps.version + ' · ' + caps.encoders.h264.map(e => e.id).join(','));
  // upload a logo through the same IPC the drag-and-drop uses
  const logo = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.png'));
  const a = await pg.evaluate(d => window.qbz.assets.importBuffer('QBizPro.png', new Uint8Array(d), 'brand-logo'), [...logo]); ok(a && a.id, 'logo tersimpan sebagai aset');
  // fictional sample logos stand in for the real brand logos the user uploads
  const LOG = path.join(__dirname, 'fixtures', 'logos'); const logoFiles = fs.readdirSync(LOG).filter(f => f.endsWith('.png')).sort();
  const ids = []; for (const f of logoFiles) { const b = fs.readFileSync(path.join(LOG, f)); const r = await pg.evaluate(([n, d]) => window.qbz.assets.importBuffer(n, new Uint8Array(d), 'brand-logo'), [f, [...b]]); ids.push(r); }
  ok(ids.length === 12, '12 logo brand diimpor sebagai aset');
  await pg.fill('#newName', 'E2E cinematic'); await pg.click('#createBtn'); await pg.waitForSelector('.ed canvas');
  // assign logos through the project file, as the brand panel does, then reopen from the dashboard
  const pid = await pg.evaluate(() => window.__ed().p.id);
  await pg.evaluate(([ids, center]) => { const s = window.__ed(); const q = s.p.layers[0].params; q.brands = ids.map((a, i) => ({ id: 'b' + i, name: a.name.replace(/^./, c => c.toUpperCase()), assetId: a.id })); q.centerAssetId = center; q.selection = 'manual'; q.selectedId = 'b4'; q.showcase.subtitle = 'Contoh logo fiktif'; s.dirty = true; }, [ids, a.id]);
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(800);
  await pg.click('#topbar .btn:has-text("Dashboard")'); await pg.waitForSelector('.pcard'); await pg.click('.pcard .th'); await pg.waitForSelector('.ed canvas'); await pg.waitForTimeout(500);
  const list = await pg.evaluate(() => window.qbz.projects.list()); ok(list.length === 1 && list[0].thumbnail, 'proyek tersimpan di disk dengan thumbnail');
  ok(await pg.evaluate(() => window.__ed().p.layers[0].params.brands.every(b => b.assetId)), 'semua brand memakai aset logo');
  await pg.click('.clip'); await pg.waitForTimeout(200); ok(!(await pg.textContent('.rpanel')).includes('belum punya logo'), 'tidak ada peringatan logo hilang');
  await pg.keyboard.press('Control+e'); await pg.waitForSelector('.modal'); await pg.waitForTimeout(150);
  ok(await pg.$eval('.modal select[aria-label="Preset ekspor"]', e => e.value) === 'cine60', 'preset ekspor default: Cinematic 1080×1920 · 60 fps');
  const t0 = Date.now(); await pg.click('.modal .btn.gold');
  await pg.waitForSelector('.modal :text("Ekspor selesai")', { timeout: 900000 });
  const recs = await pg.evaluate(() => window.qbz.export.list()); const rec = recs[0]; ok(rec && fs.existsSync(rec.path), 'file MP4 dibuat: ' + (rec && rec.path) + ` (${((Date.now() - t0) / 1000).toFixed(1)} dtk)`);
  const ff = require('ffmpeg-static'); let info = ''; try { execFileSync(ff, ['-hide_banner', '-i', rec.path]); } catch (e) { info = String(e.stderr); }
  ok(/h264/.test(info) && /1080x1920/.test(info) && /60 fps/.test(info), 'MP4 valid: ' + (info.match(/Stream #0:0.*/) || [''])[0].slice(0, 120));
  ok(/Duration: 00:00:12\.0/.test(info), 'durasi sesuai: ' + (info.match(/Duration: [^,]+/) || [''])[0]);
  const fr = n => path.join(OUT, n); execFileSync(ff, ['-y', '-loglevel', 'error', '-i', rec.path, '-vf', "select='eq(n\\,60)+eq(n\\,170)+eq(n\\,330)+eq(n\\,470)+eq(n\\,610)+eq(n\\,719)',scale=360:-1,tile=6x1", '-frames:v', '1', fr('e2e-cinematic-frames.png')]);
  fs.copyFileSync(rec.path, fr('e2e-cinematic.mp4'));
  await pg.keyboard.press('Escape'); await pg.screenshot({ path: path.join(OUT, 'e2e-editor.png') });
  ok(errs.length === 0, 'tanpa error halaman ' + errs.join(' | '));
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  console.log(`\n${pass} lulus, ${fail} gagal`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

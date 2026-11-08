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
  await pg.fill('#newName', 'E2E roulette'); await pg.click('#createBtn'); await pg.waitForSelector('.ed canvas');
  // set the center logo through the project model, then save
  await pg.click('.clip'); await pg.click('.rpanel button:has-text("Pilih logo")'); await pg.waitForSelector('.modal .acard'); await pg.click('.modal .acard'); await pg.waitForTimeout(300);
  ok((await pg.$$('.rpanel img')).length > 0, 'logo tengah terpasang');
  // shorten the intro so the test export is quick
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(600);
  const list = await pg.evaluate(() => window.qbz.projects.list()); ok(list.length === 1 && list[0].thumbnail, 'proyek tersimpan di disk dengan thumbnail');
  await pg.keyboard.press('Control+e'); await pg.waitForSelector('.modal');
  await pg.selectOption('.modal select[aria-label="preset"]', 'small').catch(() => {});
  await pg.selectOption('.modal select[aria-label="Preset ekspor"]', 'small'); await pg.waitForTimeout(100);
  await pg.selectOption('.modal select[aria-label="fps"]', '24'); await pg.waitForTimeout(100);
  const t0 = Date.now(); await pg.click('.modal .btn.gold');
  await pg.waitForSelector('.modal :text("Ekspor selesai")', { timeout: 240000 });
  const recs = await pg.evaluate(() => window.qbz.export.list()); const rec = recs[0]; ok(rec && fs.existsSync(rec.path), 'file MP4 dibuat: ' + (rec && rec.path) + ` (${((Date.now() - t0) / 1000).toFixed(1)} dtk)`);
  const ff = require('ffmpeg-static'); let info = ''; try { execFileSync(ff, ['-hide_banner', '-i', rec.path]); } catch (e) { info = String(e.stderr); }
  ok(/h264/.test(info) && /720x1280/.test(info) && /24 fps/.test(info), 'MP4 valid: ' + (info.match(/Stream #0:0.*/) || [''])[0].slice(0, 120));
  ok(/Duration: 00:00:18\.1/.test(info), 'durasi sesuai: ' + (info.match(/Duration: [^,]+/) || [''])[0]);
  execFileSync(ff, ['-y', '-loglevel', 'error', '-ss', '14.9', '-i', rec.path, '-frames:v', '1', path.join(OUT, 'e2e-frame-open.png')]);
  execFileSync(ff, ['-y', '-loglevel', 'error', '-ss', '9.5', '-i', rec.path, '-frames:v', '1', path.join(OUT, 'e2e-frame-spin.png')]);
  execFileSync(ff, ['-y', '-loglevel', 'error', '-ss', '13.9', '-i', rec.path, '-frames:v', '1', path.join(OUT, 'e2e-frame-zoom.png')]);
  fs.copyFileSync(rec.path, path.join(OUT, 'e2e-roulette.mp4'));
  await pg.keyboard.press('Escape'); await pg.screenshot({ path: path.join(OUT, 'e2e-editor.png') });
  ok(errs.length === 0, 'tanpa error halaman ' + errs.join(' | '));
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  console.log(`\n${pass} lulus, ${fail} gagal`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

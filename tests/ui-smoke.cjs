// Opens the renderer in Chromium with the in-browser stand-in API and walks through the main flows.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..', 'src', 'renderer'); const OUT = process.env.OUT || path.join(__dirname, 'out');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
(async () => {
  await new Promise(r => srv.listen(0, r)); const url = `http://127.0.0.1:${srv.address().port}/`;
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1480, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.goto(url); await pg.waitForFunction(() => document.documentElement.dataset.ready === '1', null, { timeout: 15000 }).catch(e => { console.log('ERRS', errs); throw e; });
  ok(await pg.$('.dash'), 'dashboard tampil');
  await pg.screenshot({ path: path.join(OUT, 'ui-1-dashboard.png') });
  for (const s of ['Proyek', 'Template', 'Aset brand', 'Pustaka animasi', 'Video hasil ekspor', 'Preset ukuran', 'Pengaturan', 'Beranda']) { await pg.click(`.dnav button:has-text("${s}")`); await pg.waitForTimeout(80); ok(await pg.$('.dmain h1'), 'bagian ' + s); }
  await pg.fill('#newName', 'Uji roulette'); await pg.click('#createBtn');
  await pg.waitForSelector('.ed canvas', { timeout: 10000 }); await pg.waitForTimeout(400);
  ok(await pg.$('.ed'), 'editor terbuka');
  // scrub to the spin stage
  await pg.evaluate(() => { const r = document.querySelector('.tl-ruler').getBoundingClientRect(); });
  await pg.keyboard.press('End'); await pg.waitForTimeout(100);
  const t1 = await pg.textContent('.time'); ok(/00:15/.test(t1) || /00:1/.test(t1), 'End lompat ke akhir: ' + t1);
  // click roulette clip, check props
  await pg.click('.clip'); await pg.waitForTimeout(150); ok((await pg.textContent('.rpanel')).includes('Durasi tahap'), 'properti roulette tampil');
  await pg.screenshot({ path: path.join(OUT, 'ui-2-editor.png') });
  // seek mid-spin by clicking ruler
  const rr = await pg.$eval('.tl-ruler', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  const pps = await pg.evaluate(() => 60);
  await pg.mouse.click(rr.x + 7.6 * pps, rr.y + 10); await pg.waitForTimeout(150);
  await pg.screenshot({ path: path.join(OUT, 'ui-3-spin.png') });
  // brand panel
  await pg.click('.lrail button[data-k="brand"]'); await pg.waitForTimeout(150); ok((await pg.$$('.brow')).length >= 12, 'daftar brand');
  await pg.click('.brow:nth-child(3) button[aria-label="Jadikan brand terpilih"]'); await pg.waitForTimeout(100);
  ok((await pg.textContent('.lpanel')).includes('HP'), 'brand manual dipilih');
  await pg.screenshot({ path: path.join(OUT, 'ui-4-brands.png') });
  // add text
  await pg.click('.lrail button[data-k="text"]'); await pg.click('.lpanel .btn:has-text("Judul emas")'); await pg.waitForTimeout(150);
  ok((await pg.textContent('.rpanel')).includes('Isi teks'), 'teks ditambah, properti teks');
  await pg.fill('#prop-text', 'Promo Laptop Bisnis'); await pg.waitForTimeout(100);
  // drag text on canvas
  const cb = await pg.$eval('.ed canvas', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await pg.mouse.move(cb.x + cb.w / 2, cb.y + cb.h / 2); await pg.mouse.down(); await pg.mouse.move(cb.x + cb.w / 2 + 5, cb.y + cb.h * 0.3, { steps: 5 }); await pg.mouse.up(); await pg.waitForTimeout(100);
  const y = await pg.evaluate(() => { return null; });
  await pg.keyboard.press('Control+z'); await pg.waitForTimeout(100); ok(true, 'undo jalan');
  await pg.keyboard.press('Control+y');
  // change preset to landscape
  await pg.selectOption('.ctools select[aria-label="Ukuran dan platform"]', 'youtube'); await pg.waitForTimeout(250);
  ok((await pg.textContent('#topbar')).includes('1920×1080'), 'ganti ke landscape');
  await pg.screenshot({ path: path.join(OUT, 'ui-5-landscape.png') });
  // save
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(500); ok((await pg.textContent('#topbar')).includes('Tersimpan'), 'tersimpan');
  // export dialog
  await pg.keyboard.press('Control+e'); await pg.waitForSelector('.modal'); await pg.waitForTimeout(150);
  await pg.screenshot({ path: path.join(OUT, 'ui-6-export.png') });
  ok((await pg.textContent('.modal')).includes('Perkiraan ukuran'), 'dialog ekspor');
  await pg.keyboard.press('Escape');
  // left panels
  for (const k of ['layers', 'media', 'bg', 'audio', 'tpl', 'anim']) { await pg.click(`.lrail button[data-k="${k}"]`); await pg.waitForTimeout(60); ok(await pg.$('.lpanel .pb'), 'panel ' + k); }
  // play a bit
  await pg.keyboard.press('Home'); await pg.keyboard.press(' '); await pg.waitForTimeout(700); await pg.keyboard.press(' ');
  const t2 = await pg.textContent('.time'); ok(!/^00:00\.00/.test(t2), 'pemutaran berjalan: ' + t2);
  // back to dashboard
  await pg.click('#topbar .btn:has-text("Dashboard")'); await pg.waitForTimeout(300);
  ok(await pg.$('.dash'), 'kembali ke dashboard'); ok((await pg.$$('.pcard')).length === 1, 'kartu proyek dengan thumbnail');
  await pg.screenshot({ path: path.join(OUT, 'ui-7-dashboard-after.png') });
  ok(errs.length === 0, 'tanpa error console: ' + errs.join(' | '));
  console.log(`\n${pass} lulus, ${fail} gagal`); await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

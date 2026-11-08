// QBizPro Cinematic Brand Roulette: math checks, storyboard sheet, timing at 1080×1920, optional 60 fps MP4 preview.
import { createCanvas, loadImage } from './canvas-env.js';
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process'; import { createRequire } from 'module';
import { defaultCinematic, drawCinematic, cineSceneTimes, cineSet, cineAngle, cineDuration, evalProp } from '../src/renderer/js/engine/cinematic.js';
globalThis.__qbzCanvas = (w, h) => createCanvas(w, h);
const OUT = process.env.OUT || 'tests/out'; fs.mkdirSync(OUT, { recursive: true });
let bad = 0; const check = (c, m) => { console.log((c ? 'ok    ' : 'GAGAL ') + m); if (!c) bad++; };

const p = defaultCinematic(); const imgs = new Map();
const LOGOS = 'tests/fixtures/logos'; const files = fs.readdirSync(LOGOS).filter(f => f.endsWith('.png')).sort();
p.brands = await Promise.all(files.map(async (f, i) => { const id = 'L' + i; imgs.set(id, await loadImage(path.join(LOGOS, f))); return { id: 'b' + i, name: f.replace('.png', '').replace(/^./, c => c.toUpperCase()), assetId: id }; }));
imgs.set('CENTER', await loadImage('build/icon.png')); p.centerAssetId = 'CENTER';
p.showcase.subtitle = process.env.SUB || '';
const img = id => imgs.get(id) || null;
const S = cineSceneTimes(p); console.log('durasi', cineDuration(p).toFixed(2), 'detik ·', p.scenes.map(s => `${s.label} ${S[s.id].a}–${S[s.id].b}`).join(' · '));

// 1) the chosen brand lands exactly on the focus point, for random and every manual choice and both directions
const land = q => { const set = cineSet(q); const SS = cineSceneTimes(q); const ks = q.tracks['spin.progress']; const tE = Math.max(...ks.map(k => SS[k.s].a + k.u * SS[k.s].d)); const a = cineAngle(q, tE + 1.5, SS, set) + set.sel * 2 * Math.PI / set.n; return Math.abs(((a - Math.PI / 2) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); };
let worst = land(p);
for (const dir of ['cw', 'ccw']) for (const b of p.brands) { const q = JSON.parse(JSON.stringify(p)); q.orbit.direction = dir; q.selection = 'manual'; q.selectedId = b.id; worst = Math.max(worst, land(q)); }
for (let seed = 1; seed < 40; seed++) { const q = JSON.parse(JSON.stringify(p)); q.seed = seed; worst = Math.max(worst, land(q)); }
check(worst < 1e-6, `brand terpilih berhenti tepat di titik fokus (galat terbesar ${worst.toExponential(2)} rad, 104 variasi)`);
// 2) smooth motion at 60 fps: no jumps in angle, and speed changes gradually (acceleration and deceleration)
const set = cineSet(p); let prevA = null, prevV = null, maxStep = 0, maxDV = 0, peak = 0;
for (let f = 0; f <= S.total * 60; f++) { const t = f / 60; const a = cineAngle(p, t, S, set); if (prevA !== null) { const v = (a - prevA) * 60; peak = Math.max(peak, Math.abs(v)); maxStep = Math.max(maxStep, Math.abs(a - prevA)); if (prevV !== null) maxDV = Math.max(maxDV, Math.abs(v - prevV)); prevV = v; } prevA = a; }
check(maxStep < 0.45, `langkah sudut per frame maks ${maxStep.toFixed(3)} rad (kecepatan puncak ${(peak / (2 * Math.PI)).toFixed(2)} putaran/dtk)`);
check(maxDV < peak * 0.08, `perubahan kecepatan antar frame maks ${(maxDV / peak * 100).toFixed(1)}% dari kecepatan puncak (akselerasi halus)`);
const after = cineAngle(p, S.select.b, S, set) - cineAngle(p, S.select.a + S.select.d * 0.31, S, set); check(Math.abs(after) < 1e-9, 'setelah berhenti, orbit diam di posisi fokus');
check(Math.abs(evalProp(p, 'camera.focus', S.zoom.b) - 1) < 1e-9 && Math.abs(evalProp(p, 'showcase.progress', S.review.b) - 1) < 1e-9, 'kamera fokus penuh di akhir zoom dan showcase lengkap di akhir');

// 3) storyboard: two frames per scene, labelled
const W = 1080, H = 1920, k = 0.25; const cw = W * k, ch = H * k; const pad = 46;
const picks = []; for (const sc of p.scenes) { const s = S[sc.id]; picks.push([sc, s.a + s.d * 0.35], [sc, s.a + s.d * 0.9]); }
const sheet = createCanvas(cw * 6 + 7 * 14, (ch + pad) * 2 + 3 * 14 + 60); const sg = sheet.getContext('2d'); sg.fillStyle = '#060C1A'; sg.fillRect(0, 0, sheet.width, sheet.height);
sg.fillStyle = '#F4F7FC'; sg.font = '800 30px Sora'; sg.fillText('QBizPro Cinematic Brand Roulette · storyboard 6 scene · 12 detik · 1080×1920', 14, 42);
picks.forEach(([sc, t], i) => { const col = Math.floor(i / 2), row = i % 2; const x = 14 + col * (cw + 14), y = 60 + 14 + row * (ch + pad + 14);
  const c = createCanvas(cw, ch); const g = c.getContext('2d'); g.scale(k, k); drawCinematic(g, W, H, t, p, img); sg.drawImage(c, x, y + pad);
  sg.fillStyle = '#F2A93B'; sg.font = '700 17px Sora'; sg.fillText(`${p.scenes.indexOf(sc) + 1}. ${sc.label}`, x, y + 18); sg.fillStyle = '#93A4C3'; sg.font = '500 15px "IBM Plex Mono"'; sg.fillText(`${t.toFixed(2)} dtk`, x, y + 38); });
fs.writeFileSync(path.join(OUT, 'cinematic-storyboard.png'), sheet.toBuffer('image/png'));
// landscape and square check frames
for (const [w, h, n] of [[1920, 1080, 'landscape'], [1080, 1080, 'square']]) { const ts = [S.orbit.b, S.roulette.a + 1.5, S.select.b, S.zoom.b - 0.15, S.review.b]; const kk = 0.22; const c = createCanvas(Math.round(w * kk) * ts.length + 8 * (ts.length - 1), Math.round(h * kk)); const g = c.getContext('2d'); ts.forEach((t, i) => { const cc = createCanvas(Math.round(w * kk), Math.round(h * kk)); const gg = cc.getContext('2d'); gg.scale(kk, kk); drawCinematic(gg, w, h, t, p, img); g.drawImage(cc, i * (Math.round(w * kk) + 8), 0); }); fs.writeFileSync(path.join(OUT, `cinematic-${n}.png`), c.toBuffer('image/png')); }

// 4) full-resolution render cost (CPU, single thread; the app draws on the GPU)
const full = createCanvas(W, H); const fg = full.getContext('2d'); const T0 = performance.now(); let n = 0;
for (let t = 0; t < S.total; t += 0.2) { fg.setTransform(1, 0, 0, 1, 0, 0); drawCinematic(fg, W, H, t, p, img); n++; } const ms = (performance.now() - T0) / n;
check(ms < 40, `rata-rata ${ms.toFixed(1)} ms per frame 1080×1920 (CPU)`);

// 5) optional MP4 preview at 1080×1920, 60 fps
if (process.env.MP4) {
  const require = createRequire(import.meta.url); const ff = process.env.FFMPEG || require('ffmpeg-static'); const fps = +(process.env.FPS || 60); const N = Math.round(S.total * fps); const file = path.join(OUT, process.env.MP4);
  const pr = spawn(ff, ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0', '-c:v', 'libx264', '-preset', 'medium', '-b:v', '16M', '-maxrate', '24M', '-bufsize', '32M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const T1 = performance.now();
  for (let f = 0; f < N; f++) { fg.setTransform(1, 0, 0, 1, 0, 0); drawCinematic(fg, W, H, f / fps, p, img); const buf = Buffer.from(fg.getImageData(0, 0, W, H).data.buffer); if (!pr.stdin.write(buf)) await new Promise(r => pr.stdin.once('drain', r)); }
  pr.stdin.end(); const code = await new Promise(r => pr.on('close', r)); check(code === 0, `MP4 ${W}×${H} ${fps} fps, ${N} frame dalam ${((performance.now() - T1) / 1000).toFixed(1)} dtk → ${file}`);
}
process.exit(bad ? 1 : 0);

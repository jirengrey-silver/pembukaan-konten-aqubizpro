// Video encoding through FFmpeg. The renderer draws every frame deterministically and streams raw RGBA
// frames here; FFmpeg encodes them to MP4 (H.264 / H.265), using the GPU encoder when one works.
'use strict';
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

let ffmpegPath = null;
function findFFmpeg(resourcesPath) {
  if (ffmpegPath !== null) return ffmpegPath;
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = [];
  if (resourcesPath) candidates.push(path.join(resourcesPath, 'ffmpeg', exe), path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', exe));
  try { const p = require('ffmpeg-static'); if (p) candidates.push(String(p).replace('app.asar', 'app.asar.unpacked')); } catch (e) { /* not installed */ }
  for (const c of candidates) { try { if (c && fs.existsSync(c)) { ffmpegPath = c; return c; } } catch (e) { /* skip */ } }
  ffmpegPath = ''; // fall back to PATH
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
}
const bin = () => ffmpegPath || (process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
function run(args, timeout = 20000) { return new Promise(res => { execFile(bin(), args, { timeout, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => res({ ok: !err, code: err ? err.code : 0, out: String(stdout || '') + String(stderr || '') })); }); }

const ENCODERS = {
  h264: [['h264_nvenc', 'NVIDIA NVENC'], ['h264_qsv', 'Intel Quick Sync'], ['h264_amf', 'AMD AMF'], ['libx264', 'CPU (x264)']],
  h265: [['hevc_nvenc', 'NVIDIA NVENC'], ['hevc_qsv', 'Intel Quick Sync'], ['hevc_amf', 'AMD AMF'], ['libx265', 'CPU (x265)']]
};
let capsCache = null;
async function capabilities(resourcesPath) {
  if (capsCache) return capsCache;
  findFFmpeg(resourcesPath);
  const v = await run(['-hide_banner', '-version'], 8000);
  if (!v.ok) return (capsCache = { ffmpeg: null, version: null, encoders: { h264: [], h265: [] }, error: 'FFmpeg tidak ditemukan. Ekspor video membutuhkan FFmpeg yang ikut terpasang bersama aplikasi.' });
  const list = await run(['-hide_banner', '-encoders'], 8000);
  const has = name => new RegExp('\\s' + name + '\\s').test(list.out);
  const encoders = { h264: [], h265: [] };
  for (const codec of ['h264', 'h265']) {
    for (const [name, label] of ENCODERS[codec]) {
      if (!has(name)) continue;
      // a hardware encoder can be compiled in while the GPU or driver is missing, so try one tiny frame
      let works = true;
      if (!name.startsWith('lib')) { const t = await run(['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=256x256:d=0.1', '-frames:v', '1', '-c:v', name, '-f', 'null', '-'], 15000); works = t.ok; }
      if (works) encoders[codec].push({ id: name, label, gpu: !name.startsWith('lib') });
    }
  }
  const version = (v.out.match(/ffmpeg version (\S+)/) || [])[1] || 'unknown';
  return (capsCache = { ffmpeg: bin(), version, encoders });
}

function videoArgs(o) {
  const enc = o.encoder; const kbps = Math.max(500, Math.round(o.bitrateMbps * 1000));
  const speed = o.quality || 'balanced';
  const a = ['-c:v', enc];
  if (enc === 'libx264') a.push('-preset', speed === 'fast' ? 'veryfast' : speed === 'best' ? 'slow' : 'medium', '-b:v', kbps + 'k', '-maxrate', Math.round(kbps * 1.5) + 'k', '-bufsize', kbps * 2 + 'k', '-profile:v', 'high');
  else if (enc === 'libx265') a.push('-preset', speed === 'fast' ? 'veryfast' : speed === 'best' ? 'slow' : 'medium', '-b:v', kbps + 'k', '-tag:v', 'hvc1');
  else if (enc.endsWith('_nvenc')) a.push('-preset', speed === 'fast' ? 'p2' : speed === 'best' ? 'p7' : 'p5', '-rc', 'vbr', '-b:v', kbps + 'k', '-maxrate', Math.round(kbps * 1.5) + 'k', '-bufsize', kbps * 2 + 'k');
  else if (enc.endsWith('_qsv')) a.push('-preset', speed === 'fast' ? 'veryfast' : speed === 'best' ? 'veryslow' : 'medium', '-b:v', kbps + 'k', '-maxrate', Math.round(kbps * 1.5) + 'k');
  else if (enc.endsWith('_amf')) a.push('-quality', speed === 'fast' ? 'speed' : speed === 'best' ? 'quality' : 'balanced', '-rc', 'vbr_peak', '-b:v', kbps + 'k', '-maxrate', Math.round(kbps * 1.5) + 'k');
  if (enc.startsWith('hevc') || enc === 'libx265') { if (enc !== 'libx265') a.push('-tag:v', 'hvc1'); }
  a.push('-pix_fmt', enc.endsWith('_qsv') ? 'nv12' : 'yuv420p', '-g', String(o.fps * 2));
  return a;
}

const jobs = new Map(); let jobSeq = 0;
// o: { width, height, fps, totalFrames, encoder, bitrateMbps, quality, outPath, audio: [{path, start, volume, fadeIn, fadeOut, trimStart, duration}], audioKbps }
function start(o) {
  if (!o.outPath) throw new Error('Folder tujuan belum dipilih');
  fs.mkdirSync(path.dirname(o.outPath), { recursive: true });
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${o.width}x${o.height}`, '-r', String(o.fps), '-i', 'pipe:0'];
  const audio = (o.audio || []).filter(x => x && x.path && fs.existsSync(x.path));
  audio.forEach(x => { if (x.trimStart) args.push('-ss', String(x.trimStart)); args.push('-i', x.path); });
  if (audio.length) {
    const dur = o.totalFrames / o.fps; const parts = [];
    audio.forEach((x, i) => {
      const d = Math.max(0.05, Math.min(x.duration || dur, dur - (x.start || 0))); const f = [`atrim=0:${d.toFixed(3)}`, 'asetpts=PTS-STARTPTS', `volume=${(x.volume ?? 1).toFixed(3)}`];
      if (x.fadeIn) f.push(`afade=t=in:st=0:d=${x.fadeIn}`); if (x.fadeOut) f.push(`afade=t=out:st=${Math.max(0, d - x.fadeOut).toFixed(3)}:d=${x.fadeOut}`);
      if (x.start) f.push(`adelay=${Math.round(x.start * 1000)}:all=1`); parts.push(`[${i + 1}:a]${f.join(',')}[a${i}]`);
    });
    parts.push(`${audio.map((_, i) => `[a${i}]`).join('')}amix=inputs=${audio.length}:normalize=0,atrim=0:${dur.toFixed(3)}[aout]`);
    args.push('-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', (o.audioKbps || 192) + 'k');
  } else args.push('-an');
  args.push(...videoArgs(o), '-r', String(o.fps), '-movflags', '+faststart', o.outPath);
  const proc = spawn(bin(), args, { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  const id = ++jobSeq; const job = { id, proc, o, frames: 0, err: '', done: null, closed: false, cancelled: false, startedAt: Date.now() };
  proc.stderr.on('data', d => { job.err = (job.err + d.toString()).slice(-4000); });
  job.done = new Promise(res => proc.on('close', code => { job.closed = true; res(code); }));
  proc.on('error', e => { job.err += '\n' + e.message; });
  proc.stdin.on('error', e => { job.err += '\n' + e.message; });
  jobs.set(id, job);
  return { id, args };
}
function writeFrame(id, data) {
  const job = jobs.get(id); if (!job) throw new Error('Proses ekspor tidak ditemukan');
  if (job.closed) throw new Error('FFmpeg berhenti: ' + (job.err.trim() || 'tanpa pesan'));
  const buf = Buffer.from(data.buffer ? data.buffer : data, data.byteOffset || 0, data.byteLength);
  job.frames++;
  return new Promise((res, rej) => { const ok = job.proc.stdin.write(buf, err => { if (err) rej(err); }); if (ok) res(job.frames); else job.proc.stdin.once('drain', () => res(job.frames)); });
}
async function finish(id) {
  const job = jobs.get(id); if (!job) throw new Error('Proses ekspor tidak ditemukan');
  job.proc.stdin.end(); const code = await job.done; jobs.delete(id);
  if (code !== 0) { try { fs.unlinkSync(job.o.outPath); } catch (e) { /* none */ } throw new Error('FFmpeg gagal (kode ' + code + '): ' + (job.err.trim() || 'tanpa pesan')); }
  const st = fs.statSync(job.o.outPath); return { path: job.o.outPath, size: st.size, seconds: (Date.now() - job.startedAt) / 1000 };
}
async function cancel(id) {
  const job = jobs.get(id); if (!job) return true; job.cancelled = true;
  try { job.proc.stdin.destroy(); } catch (e) { /* closed */ } try { job.proc.kill(); } catch (e) { /* gone */ }
  await job.done; jobs.delete(id); try { fs.unlinkSync(job.o.outPath); } catch (e) { /* none */ } return true;
}
async function probe(file) { const r = await run(['-hide_banner', '-i', file], 10000); const m = r.out.match(/Duration: (\d+):(\d+):([\d.]+)/); return { duration: m ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : 0, video: /Video:/.test(r.out), audio: /Audio:/.test(r.out), info: (r.out.match(/Stream #.*/g) || []).join('\n') }; }
module.exports = { capabilities, start, writeFrame, finish, cancel, probe, findFFmpeg };

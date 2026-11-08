// Export dialog: MP4 (H.264 / H.265, CPU or GPU encoder) rendered frame by frame through FFmpeg, or a still PNG/JPG.
import { api } from '../api.js';
import { h, icon, toast, modal, fmtSize, fmtTime, preload } from './dom.js';
import { E } from './ed-state.js';
import { projectDuration, presetOf } from '../engine/scene.js';
import { draw, projectAssetIds } from './render.js';

const PRESETS = [
  ['social', 'Story / Reels / TikTok', { fmt: 'h264', fps: 30, mbps: 12, scale: 1, quality: 'balanced' }],
  ['smooth', 'Gerak halus 60 fps', { fmt: 'h264', fps: 60, mbps: 18, scale: 1, quality: 'balanced' }],
  ['youtube', 'YouTube kualitas tinggi', { fmt: 'h264', fps: 30, mbps: 16, scale: 1, quality: 'best' }],
  ['small', 'Ukuran kecil, kirim cepat (720p)', { fmt: 'h264', fps: 30, mbps: 5, scale: 2 / 3, quality: 'fast' }],
  ['hevc', 'H.265 hemat ukuran', { fmt: 'h265', fps: 30, mbps: 8, scale: 1, quality: 'balanced' }],
  ['custom', 'Atur sendiri', null]
];
const even = v => Math.max(2, Math.round(v / 2) * 2);
const safeName = s => String(s || 'video').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'video';

export async function openExport() {
  const s = E.s; const p = s.p; const caps = await api.export.capabilities(); const def = await api.export.defaultFolder();
  const st = Object.assign({ preset: 'social', fmt: 'h264', fps: p.fps || 30, mbps: 12, scale: 1, quality: 'balanced', encoder: null, folder: def, name: safeName(p.name), audio: true, jpgQ: 0.92 }, s.exportPrefs || {});
  st.folder = st.folder || def;
  const body = h('div', { class: 'stack' }); let running = null;
  const m = modal({ title: 'Ekspor', wide: true, body, actions: [], onClose: () => { if (running) running.cancel(); } });
  const foot = h('footer'); m.el.append(foot);
  const encFor = f => (f === 'h265' ? caps.encoders.h265 : caps.encoders.h264);
  const pickEnc = () => { const list = encFor(st.fmt); if (!list.find(e => e.id === st.encoder)) st.encoder = (list.find(e => e.gpu) || list[0] || {}).id || null; };
  const isVideo = () => st.fmt === 'h264' || st.fmt === 'h265';
  function render() {
    pickEnc(); s.exportPrefs = Object.assign({}, st);
    const dur = projectDuration(p); const W = even(p.width * st.scale), H = even(p.height * st.scale); const frames = Math.ceil(dur * st.fps);
    const audioOn = st.audio && (p.audio || []).some(a => !a.muted && a.assetId);
    const est = (st.mbps * 1e6 * dur + (audioOn ? 192e3 * dur : 0)) / 8;
    const field = (label, el) => h('div', { class: 'row' }, h('span', { class: 'lab' }, label), el);
    const sel = (key, opts, after) => { const e = h('select', { 'aria-label': key, onchange: ev => { const v = ev.target.value; st[key] = isNaN(+v) || key === 'encoder' || key === 'fmt' ? v : +v; if (key !== 'preset') st.preset = 'custom'; after && after(); render(); } }, opts.map(([v, l]) => h('option', { value: v, selected: String(st[key]) === String(v) }, l))); return e; };
    const presetSel = h('select', { 'aria-label': 'Preset ekspor', onchange: e => { st.preset = e.target.value; const pr = PRESETS.find(x => x[0] === st.preset)[2]; if (pr) Object.assign(st, pr); render(); } }, PRESETS.map(([k, l]) => h('option', { value: k, selected: k === st.preset }, l)));
    const name = h('input', { type: 'text', value: st.name, 'aria-label': 'Nama file' }); name.addEventListener('input', () => { st.name = name.value; });
    const mbps = h('input', { type: 'number', min: 1, max: 100, step: 0.5, value: String(st.mbps), 'aria-label': 'Bitrate' }); mbps.addEventListener('change', () => { st.mbps = Math.min(100, Math.max(1, +mbps.value || 12)); st.preset = 'custom'; render(); });
    const enc = encFor(st.fmt);
    const noFF = isVideo() && !caps.ffmpeg;
    body.replaceChildren(
      h('div', { class: 'g2' }, field('Preset', presetSel), field('Format', sel('fmt', [['h264', 'MP4 · H.264 (paling kompatibel)'], ['h265', 'MP4 · H.265 / HEVC'], ['png', 'Gambar PNG (frame di playhead)'], ['jpg', 'Gambar JPG (frame di playhead)']]))),
      isVideo() ? h('div', { class: 'g3' }, field('Frame rate', sel('fps', [[24, '24 fps'], [30, '30 fps'], [60, '60 fps']])), field('Resolusi', sel('scale', [[1, `${p.width}×${p.height} (asli)`], [2 / 3, `${even(p.width * 2 / 3)}×${even(p.height * 2 / 3)}`], [0.5, `${even(p.width / 2)}×${even(p.height / 2)}`]])), field('Bitrate (Mbps)', mbps)) : field('Resolusi', sel('scale', [[1, `${p.width}×${p.height}`], [2 / 3, `${even(p.width * 2 / 3)}×${even(p.height * 2 / 3)}`], [0.5, `${even(p.width / 2)}×${even(p.height / 2)}`]])),
      isVideo() ? h('div', { class: 'g2' }, field('Encoder', enc.length ? sel('encoder', enc.map(e => [e.id, e.label + (e.gpu ? ' · GPU' : '')])) : h('p', { class: 'hint' }, 'Tidak ada encoder untuk format ini.')), field('Kecepatan / kualitas', sel('quality', [['fast', 'Cepat'], ['balanced', 'Seimbang'], ['best', 'Kualitas terbaik (lebih lama)']]))) : null,
      isVideo() ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: st.audio, disabled: !(p.audio || []).length, onchange: e => { st.audio = e.target.checked; render(); } }), (p.audio || []).length ? `Sertakan audio (${p.audio.filter(a => !a.muted).length} trek)` : 'Sertakan audio (proyek belum punya audio)') : null,
      h('div', { class: 'g2' }, field('Nama file', name), field('Folder tujuan', h('div', { class: 'flex', style: { flexWrap: 'nowrap' } }, h('code', { style: { fontFamily: 'var(--mono)', fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }, title: st.folder }, st.folder),
        h('button', { class: 'btn sm', onclick: async () => { const f = await api.export.chooseFolder(st.folder); if (f) { st.folder = f; render(); } } }, 'Ganti')))),
      h('div', { class: 'card', style: { background: 'var(--bg2)', padding: '10px 12px' } }, isVideo()
        ? h('div', { class: 'flex', style: { justifyContent: 'space-between' } }, h('span', null, `${W}×${H} · ${st.fps} fps · ${fmtTime(dur)} · ${frames} frame`), h('b', null, 'Perkiraan ukuran ≈ ' + fmtSize(est)))
        : h('span', null, `Frame di ${fmtTime(s.t)} · ${W}×${H} ${st.fmt.toUpperCase()}`)),
      noFF ? h('p', { class: 'hint', style: { color: 'var(--warn)' } }, caps.error || 'FFmpeg tidak ditemukan, ekspor MP4 tidak tersedia.') : null,
      h('p', { class: 'hint' }, `Area aman ${presetOf(p.preset).label} hanya panduan di editor dan tidak ikut terekspor.`));
    foot.replaceChildren(h('button', { class: 'btn', onclick: () => m.close() }, 'Tutup'), h('button', { class: 'btn gold', disabled: noFF || (isVideo() && !st.encoder), onclick: () => (isVideo() ? runVideo() : runImage()) }, icon('export'), isVideo() ? 'Mulai ekspor video' : 'Simpan gambar'));
  }
  async function runImage() {
    const W = even(p.width * st.scale), H = even(p.height * st.scale); await preload(projectAssetIds(p)); await document.fonts.ready;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    if (st.fmt === 'jpg') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); } draw(g, p, s.t, W / p.width);
    const blob = await new Promise(r => c.toBlob(r, st.fmt === 'jpg' ? 'image/jpeg' : 'image/png', st.jpgQ)); const data = new Uint8Array(await blob.arrayBuffer());
    try { const rec = await api.export.saveImage(`${safeName(st.name)}-${fmtTime(s.t).replace(/[:.]/g, '')}.${st.fmt}`, data, st.folder); done(rec); } catch (e) { toast('Gagal menyimpan gambar: ' + e.message, 'err', 7000); }
  }
  async function runVideo() {
    const dur = projectDuration(p); const fps = st.fps; const N = Math.ceil(dur * fps); const W = even(p.width * st.scale), H = even(p.height * st.scale);
    const bar = h('div', null); const info = h('p', { class: 'hint' }, 'Menyiapkan…'); const pct = h('b', null, '0%');
    body.replaceChildren(h('div', { class: 'stack' }, h('div', { class: 'flex', style: { justifyContent: 'space-between' } }, h('span', null, `Mengekspor ${W}×${H} · ${fps} fps · ${encFor(st.fmt).find(e => e.id === st.encoder)?.label || st.encoder}`), pct), h('div', { class: 'bar' }, bar), info));
    let cancelled = false; let job = null;
    running = { cancel: () => { cancelled = true; } };
    foot.replaceChildren(h('button', { class: 'btn danger', onclick: () => { cancelled = true; } }, icon('stop'), 'Batalkan'));
    try {
      await preload(projectAssetIds(p)); await document.fonts.ready;
      const audio = st.audio ? (p.audio || []).filter(a => !a.muted && a.assetId).map(a => ({ assetId: a.assetId, start: a.start || 0, volume: a.volume ?? 1, fadeIn: a.fadeIn || 0, fadeOut: a.fadeOut || 0, trimStart: a.trimStart || 0, duration: a.duration || (a.assetDuration ? a.assetDuration - (a.trimStart || 0) : null) })) : [];
      job = await api.export.start({ width: W, height: H, fps, totalFrames: N, encoder: st.encoder, bitrateMbps: st.mbps, quality: st.quality, folder: st.folder, fileName: safeName(st.name) + '.mp4', audio, audioKbps: 192 });
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); const k = W / p.width;
      const t0 = performance.now(); let pending = null;
      for (let i = 0; i < N; i++) {
        if (cancelled) throw new Error('__cancel');
        g.clearRect(0, 0, W, H); draw(g, p, i / fps, k); const data = g.getImageData(0, 0, W, H).data;
        if (pending) await pending; pending = api.export.frame(job.id, data);
        if (i % 3 === 0 || i === N - 1) { const done = (i + 1) / N; const el = (performance.now() - t0) / 1000; const eta = el / done - el; bar.style.width = (done * 100).toFixed(1) + '%'; pct.textContent = Math.floor(done * 100) + '%'; info.textContent = `Frame ${i + 1} dari ${N} · ${(i + 1) / el > 0 ? ((i + 1) / el).toFixed(1) : '–'} frame/dtk · sisa ±${fmtTime(eta).slice(0, 5)}`; }
        if (i % 30 === 0) await new Promise(r => setTimeout(r, 0));
      }
      if (pending) await pending; info.textContent = 'Menyelesaikan file MP4…';
      const rec = await api.export.finish(job.id, { name: safeName(st.name) + '.mp4', kind: 'video', width: W, height: H, fps, codec: st.fmt === 'h265' ? 'H.265' : 'H.264', duration: dur, projectId: p.id });
      running = null; done(rec);
    } catch (e) {
      running = null; if (job) await api.export.cancel(job.id).catch(() => {});
      if (e.message === '__cancel') { toast('Ekspor dibatalkan', 'warn'); render(); return; }
      body.replaceChildren(h('p', { style: { color: 'var(--err)' } }, 'Ekspor gagal: ' + e.message)); foot.replaceChildren(h('button', { class: 'btn', onclick: () => render() }, 'Kembali'));
    }
  }
  function done(rec) {
    body.replaceChildren(h('div', { class: 'stack' }, h('div', { class: 'flex' }, h('span', { style: { color: 'var(--ok)' } }, icon('check')), h('h2', null, 'Ekspor selesai')),
      h('p', { class: 'hint' }, `${rec.path} · ${fmtSize(rec.size || 0)}${rec.seconds ? ' · selesai dalam ' + rec.seconds.toFixed(1) + ' dtk' : ''}`)));
    foot.replaceChildren(h('button', { class: 'btn', onclick: () => render() }, 'Ekspor lagi'), h('button', { class: 'btn', onclick: () => api.shell.reveal(rec.path) }, icon('folder'), 'Tampilkan di folder'), h('button', { class: 'btn gold', onclick: () => api.shell.open(rec.path).catch(e => toast(e.message, 'err')) }, icon('play'), 'Buka file'));
    toast('Ekspor selesai', 'ok');
  }
  render();
}

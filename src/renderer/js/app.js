// Entry point: loads fonts, decides between dashboard and editor, and handles closing the window.
import { api } from './api.js';
import { $, toast, loadCustomFonts } from './ui/dom.js';
import { showDashboard } from './ui/dashboard.js';
import { openEditor, editorState, leaveEditor } from './ui/editor.js';

import { nav } from './ui/nav.js';

nav.dashboard = async (section) => { if (editorState() && !(await leaveEditor())) return false; showDashboard(section); return true; };
nav.editor = async (project) => { await openEditor(project); };

async function boot() {
  const faces = ['400 16px Sora', '600 16px Sora', '700 16px Sora', '800 16px Sora', '400 16px "IBM Plex Sans"', '600 16px "IBM Plex Sans"', '700 16px "IBM Plex Sans"', '500 16px Orbitron', '700 16px Orbitron', '900 16px Orbitron', '400 16px "IBM Plex Mono"', '400 16px Montserrat', '800 16px Montserrat', '900 16px Montserrat'];
  await Promise.all(faces.map(f => document.fonts.load(f).catch(() => null)));
  await loadCustomFonts().catch(() => null);
  showDashboard('home');
  api.onBeforeClose(async () => {
    const s = editorState();
    try { if (s && s.dirty) await api.projects.autosave(s.p); } catch (e) { /* closing anyway */ }
    api.readyToClose();
  });
  window.addEventListener('error', e => toast('Terjadi kesalahan: ' + (e.message || e.error), 'err', 6000));
  window.addEventListener('unhandledrejection', e => toast((e.reason && e.reason.message) || String(e.reason), 'err', 6000));
  document.documentElement.dataset.ready = '1';
  api.smoke({ ok: !!$('#view .dash'), desktop: api.desktop });
}
boot().catch(e => { $('#view').textContent = 'Gagal memuat aplikasi: ' + e.message; api.smoke({ ok: false, error: e.message }); });

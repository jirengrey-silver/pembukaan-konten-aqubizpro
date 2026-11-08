'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a).then(r => { if (!r || !r.ok) throw new Error(r ? r.error : 'Tidak ada jawaban dari aplikasi'); return r.data; });
const chans = {
  projects: ['list', 'get', 'save', 'duplicate', 'rename', 'archive', 'delete', 'autosave', 'recoveries', 'recover', 'discardRecovery', 'exportFile', 'importFile'],
  templates: ['list', 'get', 'saveFromProject', 'rename', 'delete'],
  assets: ['categories', 'list', 'importDialog', 'importBuffer', 'update', 'delete', 'path'],
  export: ['capabilities', 'chooseFolder', 'defaultFolder', 'start', 'frame', 'finish', 'cancel', 'saveImage', 'list', 'remove'],
  media: ['probe'], shell: ['reveal', 'open'], app: ['info', 'chooseBase'], settings: ['get', 'set']
};
const api = { desktop: true };
for (const [ns, fns] of Object.entries(chans)) { api[ns] = {}; for (const f of fns) api[ns][f] = (...a) => call(ns + ':' + f, ...a); }
api.assetUrl = id => 'qbz://asset/' + id;
api.onBeforeClose = fn => ipcRenderer.on('app:before-close', () => fn());
api.readyToClose = () => ipcRenderer.send('app:ready-to-close');
api.setFullscreen = on => ipcRenderer.send('app:fullscreen', on);
api.smoke = info => ipcRenderer.send('app:smoke', info);
contextBridge.exposeInMainWorld('qbz', api);

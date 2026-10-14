const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flowNative', {
  toggleHub: () => ipcRenderer.send('flow:toggle-hub'),
  openSettings: () => ipcRenderer.send('flow:open-settings'),
  minimizeHub: () => ipcRenderer.send('flow:minimize-hub'),
  closeHub: () => ipcRenderer.send('flow:close-hub'),
  toggleStatus: () => ipcRenderer.send('flow:toggle-status'),
  triggerWindowMove: () => ipcRenderer.send('flow:trigger-window-move'),
  setStatusSize: (width, height, expandUpwards = true) => {
    ipcRenderer.send('flow:set-status-bounds', { width, height, expandUpwards });
  },
  moveStatus: (dx, dy) => {
    ipcRenderer.send('flow:move-status', { dx, dy });
  },
  copyToClipboard: (payload) => {
    if (typeof payload === 'string') {
      ipcRenderer.send('flow:copy-to-clipboard', { text: payload, autoPaste: true });
    } else {
      ipcRenderer.send('flow:copy-to-clipboard', payload);
    }
  },
  quit: () => ipcRenderer.send('flow:quit'),
  onDictationTrigger: (callback) => {
    ipcRenderer.on('flow:dictation-trigger', () => callback());
  },
  onDictationStart: (callback) => {
    ipcRenderer.on('flow:dictation-start', () => callback());
  },
  onDictationStop: (callback) => {
    ipcRenderer.on('flow:dictation-stop', () => callback());
  },
  transcribeAudio: (base64Data) => ipcRenderer.invoke('flow:transcribe-audio', base64Data)
});

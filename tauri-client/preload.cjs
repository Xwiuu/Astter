const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flowNative', {
  toggleHub: () => ipcRenderer.send('flow:toggle-hub'),
  openSettings: () => ipcRenderer.send('flow:open-settings'),
  triggerDictation: () => ipcRenderer.send('flow:dictation-trigger'),
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
  transcribeAudio: (base64Data) => ipcRenderer.invoke('flow:transcribe-audio', base64Data),
  onHistoryNeedsUpdate: (callback) => {
    ipcRenderer.on('history:needsUpdate', () => callback());
  },
  onOpenNotetaker: (callback) => {
    ipcRenderer.on('flow:open-notetaker', (_, page) => callback(page));
  },
  memory: {
    getNotes: () => ipcRenderer.invoke('flow:memory-get-notes'),
    getNoteById: (id) => ipcRenderer.invoke('flow:memory-get-note-by-id', id),
    saveNote: (note) => ipcRenderer.invoke('flow:memory-save-note', note),
    deleteNote: (id) => ipcRenderer.invoke('flow:memory-delete-note', id),
    pinNote: (id, pinned) => ipcRenderer.invoke('flow:memory-pin-note', id, pinned),
    saveTranscript: (t) => ipcRenderer.invoke('flow:memory-save-transcript', t),
    getTranscripts: (params) => ipcRenderer.invoke('flow:memory-get-transcripts', params),
    getTranscriptById: (id) => ipcRenderer.invoke('flow:memory-get-transcript-by-id', id),
    deleteTranscript: (id) => ipcRenderer.invoke('flow:memory-delete-transcript', id),
    deleteAllTranscripts: () => ipcRenderer.invoke('flow:memory-delete-all-transcripts'),
    getDictionaryWords: () => ipcRenderer.invoke('flow:memory-get-dictionary'),
    addDictionaryWord: (params) => ipcRenderer.invoke('flow:memory-add-dictionary', params),
    removeDictionaryWord: (phrase) => ipcRenderer.invoke('flow:memory-remove-dictionary', phrase),
    editDictionaryWord: (params) => ipcRenderer.invoke('flow:memory-edit-dictionary', params),
    starDictionaryWord: (phrase, isStarred) => ipcRenderer.invoke('flow:memory-star-dictionary', phrase, isStarred),
    getSnippets: () => ipcRenderer.invoke('flow:memory-get-snippets'),
    getScratchpad: () => ipcRenderer.invoke('flow:memory-get-scratchpad'),
    saveScratchpad: (params) => ipcRenderer.invoke('flow:memory-save-scratchpad', params),
    getInsightsStats: () => ipcRenderer.invoke('flow:memory-get-insights-stats'),
    getHeatmapStats: () => ipcRenderer.invoke('flow:memory-get-heatmap-stats'),
    getMeetings: () => ipcRenderer.invoke('flow:memory-get-meetings')
  },
  openGranolaWindow: () => ipcRenderer.send('flow:open-granola-window'),
  meeting: {
    start: (options) => ipcRenderer.invoke('flow:start-meeting-recording', options),
    stop: () => ipcRenderer.invoke('flow:stop-meeting-recording'),
    getStatus: () => ipcRenderer.invoke('flow:get-meeting-status'),
    renameSpeaker: (oldName, newName) => ipcRenderer.send('flow:meeting-rename-speaker', { oldName, newName }),
    addAttendee: (name) => ipcRenderer.send('flow:meeting-add-attendee', { name }),
    onStarted: (cb) => { ipcRenderer.on('flow:meeting-started', (_, p) => cb(p)); },
    onFinished: (cb) => { ipcRenderer.on('flow:meeting-finished', (_, p) => cb(p)); },
    onActiveSpeaker: (cb) => { ipcRenderer.on('flow:meeting-active-speaker', (_, p) => cb(p)); },
    onAudioVolume: (cb) => { ipcRenderer.on('flow:meeting-audio-volume', (_, p) => cb(p)); },
    onTranscriptTurn: (cb) => { ipcRenderer.on('flow:meeting-transcript-turn', (_, p) => cb(p)); },
    onSpeakersUpdated: (cb) => { ipcRenderer.on('flow:meeting-speakers-updated', (_, p) => cb(p)); }
  }
});


const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astterNative', {
  toggleHub: () => ipcRenderer.send('astter:toggle-hub'),
  openSettings: () => ipcRenderer.send('astter:open-settings'),
  triggerDictation: () => ipcRenderer.send('astter:dictation-trigger'),
  minimizeHub: () => ipcRenderer.send('astter:minimize-hub'),
  closeHub: () => ipcRenderer.send('astter:close-hub'),
  toggleStatus: () => ipcRenderer.send('astter:toggle-status'),
  triggerWindowMove: () => ipcRenderer.send('astter:trigger-window-move'),
  setStatusSize: (width, height, expandUpwards = true) => {
    ipcRenderer.send('astter:set-status-bounds', { width, height, expandUpwards });
  },
  moveStatus: (dx, dy) => {
    ipcRenderer.send('astter:move-status', { dx, dy });
  },
  copyToClipboard: (payload) => {
    if (typeof payload === 'string') {
      ipcRenderer.send('astter:copy-to-clipboard', { text: payload, autoPaste: true });
    } else {
      ipcRenderer.send('astter:copy-to-clipboard', payload);
    }
  },
  quit: () => ipcRenderer.send('astter:quit'),
  onDictationTrigger: (callback) => {
    ipcRenderer.on('astter:dictation-trigger', () => callback());
  },
  onDictationStart: (callback) => {
    ipcRenderer.on('astter:dictation-start', () => callback());
  },
  onDictationStop: (callback) => {
    ipcRenderer.on('astter:dictation-stop', () => callback());
  },
  transcribeAudio: (base64Data) => ipcRenderer.invoke('astter:transcribe-audio', base64Data),
  onHistoryNeedsUpdate: (callback) => {
    ipcRenderer.on('history:needsUpdate', () => callback());
  },
  onOpenNotetaker: (callback) => {
    ipcRenderer.on('astter:open-notetaker', (_, page) => callback(page));
  },
  memory: {
    getNotes: () => ipcRenderer.invoke('astter:memory-get-notes'),
    getNoteById: (id) => ipcRenderer.invoke('astter:memory-get-note-by-id', id),
    saveNote: (note) => ipcRenderer.invoke('astter:memory-save-note', note),
    deleteNote: (id) => ipcRenderer.invoke('astter:memory-delete-note', id),
    pinNote: (id, pinned) => ipcRenderer.invoke('astter:memory-pin-note', id, pinned),
    saveTranscript: (t) => ipcRenderer.invoke('astter:memory-save-transcript', t),
    getTranscripts: (params) => ipcRenderer.invoke('astter:memory-get-transcripts', params),
    getTranscriptById: (id) => ipcRenderer.invoke('astter:memory-get-transcript-by-id', id),
    deleteTranscript: (id) => ipcRenderer.invoke('astter:memory-delete-transcript', id),
    deleteAllTranscripts: () => ipcRenderer.invoke('astter:memory-delete-all-transcripts'),
    getDictionaryWords: () => ipcRenderer.invoke('astter:memory-get-dictionary'),
    addDictionaryWord: (params) => ipcRenderer.invoke('astter:memory-add-dictionary', params),
    removeDictionaryWord: (phrase) => ipcRenderer.invoke('astter:memory-remove-dictionary', phrase),
    editDictionaryWord: (params) => ipcRenderer.invoke('astter:memory-edit-dictionary', params),
    starDictionaryWord: (phrase, isStarred) => ipcRenderer.invoke('astter:memory-star-dictionary', phrase, isStarred),
    getSnippets: () => ipcRenderer.invoke('astter:memory-get-snippets'),
    getScratchpad: () => ipcRenderer.invoke('astter:memory-get-scratchpad'),
    saveScratchpad: (params) => ipcRenderer.invoke('astter:memory-save-scratchpad', params),
    getInsightsStats: () => ipcRenderer.invoke('astter:memory-get-insights-stats'),
    getHeatmapStats: () => ipcRenderer.invoke('astter:memory-get-heatmap-stats'),
    getMeetings: () => ipcRenderer.invoke('astter:memory-get-meetings'),
    updateMeetingTags: (id, tags) => ipcRenderer.invoke('astter:memory-update-meeting-tags', id, tags)
  },
  openGranolaWindow: () => ipcRenderer.send('astter:open-granola-window'),
  meeting: {
    start: (options) => ipcRenderer.invoke('astter:start-meeting-recording', options),
    stop: () => ipcRenderer.invoke('astter:stop-meeting-recording'),
    getStatus: () => ipcRenderer.invoke('astter:get-meeting-status'),
    renameSpeaker: (oldName, newName) => ipcRenderer.send('astter:meeting-rename-speaker', { oldName, newName }),
    addAttendee: (name) => ipcRenderer.send('astter:meeting-add-attendee', { name }),
    onStarted: (cb) => { ipcRenderer.on('astter:meeting-started', (_, p) => cb(p)); },
    onFinished: (cb) => { ipcRenderer.on('astter:meeting-finished', (_, p) => cb(p)); },
    onActiveSpeaker: (cb) => { ipcRenderer.on('astter:meeting-active-speaker', (_, p) => cb(p)); },
    onAudioVolume: (cb) => { ipcRenderer.on('astter:meeting-audio-volume', (_, p) => cb(p)); },
    onTranscriptTurn: (cb) => { ipcRenderer.on('astter:meeting-transcript-turn', (_, p) => cb(p)); },
    onSpeakersUpdated: (cb) => { ipcRenderer.on('astter:meeting-speakers-updated', (_, p) => cb(p)); }
  }
});


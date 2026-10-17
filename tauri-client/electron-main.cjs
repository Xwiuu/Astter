const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage, clipboard } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { exec } = require('child_process');
const memory = require('./memory-manager.cjs');

// Configure application name and WM_CLASS for Linux KDE Plasma
app.setName('astter-desktop');
app.setDesktopName('flow-desktop');
app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.disableHardwareAcceleration(); // TESTE: iframe do Notetaker renderiza preto com GPU no Wayland

let hubWindow = null;
let statusWindow = null;
let scratchpadWindow = null;
let granolaWindow = null;
let tray = null;
let isQuitting = false;
const meetingRecorder = require('./meeting-recorder.cjs');

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('⚡ [Astter] Outra instância do Astter já está em execução.');
  app.quit();
  process.exit(0);
}

app.on('second-instance', (event, argv) => {
  if (argv && argv.some(arg => arg.includes('dictate'))) {
    triggerDictation();
    return;
  }
  if (hubWindow) {
    if (hubWindow.isMinimized()) hubWindow.restore();
    hubWindow.show();
    hubWindow.focus();
  }
});

// Servidor HTTP local de gatilho ultra-rápido para atalhos do sistema (KDE Plasma 6 Wayland)
const triggerServer = http.createServer((req, res) => {
  if (req.url === '/trigger' || req.url === '/dictate') {
    triggerDictation();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TRIGGERED\n');
  } else if (req.url === '/start') {
    startDictation();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('STARTED\n');
  } else if (req.url === '/stop') {
    stopDictation();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('STOPPED\n');
  } else if (req.url === '/hub') {
    toggleHub();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('HUB_TOGGLED\n');
  } else if (req.url === '/granola') {
    openGranolaWindow();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GRANOLA_OPENED\n');
  } else if (req.url === '/meeting') {
    if (meetingRecorder.isRecording) {
      meetingRecorder.stop();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('MEETING_STOPPED\n');
    } else {
      meetingRecorder.start();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('MEETING_STARTED\n');
    }
  } else if (req.url === '/reload') {
    if (hubWindow && !hubWindow.isDestroyed()) hubWindow.reload();
    if (statusWindow && !statusWindow.isDestroyed()) statusWindow.reload();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('RELOADED\n');
  } else {
    res.writeHead(404);
    res.end();
  }
});
triggerServer.listen(1422, '127.0.0.1', () => {
  console.log('✓ [Astter] Servidor de gatilho ativo em 127.0.0.1:1422');
});

function getTargetDisplay() {
  try {
    const { execSync } = require('child_process');
    const activeName = execSync('qdbus-qt6 org.kde.KWin /KWin org.kde.KWin.activeOutputName', { encoding: 'utf8', timeout: 500 }).trim();
    if (activeName) {
      const displays = screen.getAllDisplays();
      if (activeName === 'eDP-1') {
        const match = displays.find(d => d.bounds.x === 900 || d.bounds.width === 1920);
        if (match) return match;
      } else if (activeName === 'HDMI-A-1') {
        const match = displays.find(d => d.bounds.x === 0 || d.bounds.width === 900);
        if (match) return match;
      }
    }
  } catch (_) {}

  try {
    const cursorPoint = screen.getCursorScreenPoint();
    if (cursorPoint && (cursorPoint.x > 0 || cursorPoint.y > 0)) {
      return screen.getDisplayNearestPoint(cursorPoint);
    }
  } catch (_) {}

  return screen.getAllDisplays().find(d => d.bounds.width === 1920) || screen.getPrimaryDisplay();
}

function createHubWindow() {
  const iconPath = path.join(__dirname, 'assets/icons/flow-256.png');
  const targetDisplay = getTargetDisplay();
  const { x: scrX, y: scrY, width: scrW, height: scrH } = targetDisplay.workArea;
  const hubW = Math.min(1140, scrW - 40);
  const hubH = Math.min(780, scrH - 40);
  const hubX = Math.round(scrX + (scrW - hubW) / 2);
  const hubY = Math.round(scrY + (scrH - hubH) / 2);

  hubWindow = new BrowserWindow({
    width: hubW,
    height: hubH,
    x: hubX,
    y: hubY,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    icon: iconPath,
    title: 'Astter',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  hubWindow.loadURL('http://localhost:1420/renderer/hub/index.html');

  hubWindow.once('ready-to-show', () => {
    hubWindow.show();
    hubWindow.focus();
    console.log('✓ [Astter] Janela principal Hub aberta com sucesso na tela ativa:', hubWindow.getPosition());
  });

  hubWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hubWindow.hide();
      console.log('⚡ [Astter] Janela Hub ocultada para a bandeja.');
    }
  });

  hubWindow.on('closed', () => {
    hubWindow = null;
  });
}

function openScratchpadWindow(noteData) {
  if (scratchpadWindow && !scratchpadWindow.isDestroyed()) {
    scratchpadWindow.show();
    scratchpadWindow.focus();
    if (noteData) {
      scratchpadWindow.webContents.send('scratchpad:load-note', noteData);
    }
    return;
  }
  const iconPath = path.join(__dirname, 'assets/icons/flow-256.png');
  const targetDisplay = getTargetDisplay();
  const { x: scrX, y: scrY, width: scrW, height: scrH } = targetDisplay.workArea;
  const w = Math.min(840, scrW - 60);
  const h = Math.min(680, scrH - 60);
  const x = Math.round(scrX + (scrW - w) / 2);
  const y = Math.round(scrY + (scrH - h) / 2);

  scratchpadWindow = new BrowserWindow({
    width: w,
    height: h,
    x,
    y,
    minWidth: 480,
    minHeight: 400,
    backgroundColor: '#121212',
    icon: iconPath,
    title: 'Astter Notes & Scratchpad',
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  scratchpadWindow.loadURL('http://localhost:1420/renderer/scratchpad/index.html');
  scratchpadWindow.once('ready-to-show', () => {
    scratchpadWindow.show();
    scratchpadWindow.focus();
    if (noteData) {
      setTimeout(() => {
        if (scratchpadWindow && !scratchpadWindow.isDestroyed()) {
          scratchpadWindow.webContents.send('scratchpad:load-note', noteData);
        }
      }, 300);
    }
  });

  scratchpadWindow.on('closed', () => {
    scratchpadWindow = null;
  });
}

function broadcastMeeting(channel, data) {
  [hubWindow, statusWindow, scratchpadWindow, granolaWindow].forEach(w => {
    if (w && !w.isDestroyed()) {
      try { w.webContents.send(channel, data); } catch (_) {}
    }
  });
}

meetingRecorder.on('meeting-started', (data) => broadcastMeeting('astter:meeting-started', data));
meetingRecorder.on('meeting-finished', (data) => broadcastMeeting('astter:meeting-finished', data));
meetingRecorder.on('active-speaker', (data) => broadcastMeeting('astter:meeting-active-speaker', data));
meetingRecorder.on('audio-volume', (data) => broadcastMeeting('astter:meeting-audio-volume', data));
meetingRecorder.on('transcript-turn', (data) => broadcastMeeting('astter:meeting-transcript-turn', data));
meetingRecorder.on('speakers-updated', (data) => broadcastMeeting('astter:meeting-speakers-updated', data));

function openGranolaWindow() {
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.show();
    hubWindow.focus();
    hubWindow.webContents.send('astter:open-notetaker', 'Notetaker');
  }
}

let currentCapsuleX = 0;
let currentCapsuleY = 0;
let isKWinMoving = false;
let pendingKWinMove = null;

function positionKWinWindowAsync(title, x, y) {
  pendingKWinMove = { title, x: Math.round(x), y: Math.round(y) };
  if (isKWinMoving) return;

  const runNext = () => {
    if (!pendingKWinMove) {
      isKWinMoving = false;
      return;
    }
    isKWinMoving = true;
    const item = pendingKWinMove;
    pendingKWinMove = null;

    const kwinScript = `
      let wins = workspace.windowList();
      for (let i = 0; i < wins.length; i++) {
        if (wins[i].caption === "${item.title}") {
          wins[i].frameGeometry = {
            x: ${item.x},
            y: ${item.y},
            width: wins[i].width,
            height: wins[i].height
          };
          break;
        }
      }
    `;
    const scriptName = `pos_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const tmpPath = path.join('/tmp', `${scriptName}.js`);
    fs.writeFile(tmpPath, kwinScript, (err) => {
      if (err) {
        runNext();
        return;
      }
      const cmd = `qdbus-qt6 org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "${tmpPath}" "${scriptName}" && qdbus-qt6 org.kde.KWin /Scripting org.kde.kwin.Scripting.start && qdbus-qt6 org.kde.KWin /Scripting org.kde.kwin.Scripting.unloadScript "${scriptName}"`;
      exec(cmd, () => {
        try { fs.unlink(tmpPath, () => {}); } catch (_) {}
        runNext();
      });
    });
  };

  runNext();
}

function moveCapsule(dx, dy) {
  if (!statusWindow || statusWindow.isDestroyed()) return;
  currentCapsuleX = Math.round(currentCapsuleX + dx);
  currentCapsuleY = Math.round(currentCapsuleY + dy);

  // 1. Move no Electron (X11 / fallback)
  try {
    statusWindow.setPosition(currentCapsuleX, currentCapsuleY);
    statusWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    statusWindow.moveTop();
  } catch (_) {}

  // 2. Move no KWin Wayland (KDE Plasma 6)
  if (process.platform === 'linux') {
    positionKWinWindowAsync('Astter Capsule', currentCapsuleX, currentCapsuleY);
  }
}

function createStatusWindow() {
  const targetDisplay = getTargetDisplay();
  const { x: scrX, y: scrY, width: scrW, height: scrH } = targetDisplay.workArea;
  const capsuleX = Math.round(scrX + (scrW - 220) / 2);
  const capsuleY = Math.round(scrY + scrH - 65);
  currentCapsuleX = capsuleX;
  currentCapsuleY = capsuleY;

  statusWindow = new BrowserWindow({
    width: 220,
    height: 46,
    x: capsuleX,
    y: capsuleY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    focusable: true,
    hasShadow: false,
    title: 'Astter Capsule',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  statusWindow.once('ready-to-show', () => {
    statusWindow.show();
    statusWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    statusWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    statusWindow.moveTop();
    setTimeout(() => {
      positionKWinWindowAsync('Astter Capsule', capsuleX, capsuleY);
    }, 350);
    console.log('✓ [Astter] Cápsula flutuante visível em:', statusWindow.getPosition());
  });

  statusWindow.on('blur', () => {
    if (statusWindow && !statusWindow.isDestroyed()) {
      statusWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      statusWindow.moveTop();
    }
  });

  statusWindow.webContents.on('did-fail-load', (e, code, desc, url) => {
    console.error('❌ [Astter] Falha ao carregar status:', desc, url);
    setTimeout(() => {
      if (statusWindow && !statusWindow.isDestroyed()) {
        statusWindow.loadURL('http://localhost:1420/renderer/status/index.html');
      }
    }, 1000);
  });

  statusWindow.webContents.on('console-message', (e, level, message) => {
    console.log(`[Status Console] ${message}`);
  });

  statusWindow.loadURL('http://localhost:1420/renderer/status/index.html');

  statusWindow.on('closed', () => {
    statusWindow = null;
  });
}

function createTray() {
  const trayIconPath = path.join(__dirname, 'assets/icons/flow-tray.png');
  const trayImage = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(trayImage);
  tray.setToolTip('Astter - Ditado por Voz & AI Notetaker');

  const updateMenu = () => {
    const isHubOpen = hubWindow && hubWindow.isVisible();
    const isStatusOpen = statusWindow && statusWindow.isVisible();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Astter (built on Wispr Flow v1.6.1147)',
        enabled: false,
        icon: path.join(__dirname, 'assets/icons/flow-32.png')
      },
      { type: 'separator' },
      {
        label: '🎙️  Alternar Ditado por Voz (Ctrl+Alt+Espaço)',
        click: () => {
          triggerDictation();
        }
      },
      {
        label: isHubOpen ? '🗂️  Ocultar Astter Hub' : '🗂️  Abrir Astter Hub',
        click: () => {
          toggleHub();
        }
      },
      {
        label: isStatusOpen ? '💊  Ocultar Barra Flutuante' : '💊  Exibir Barra Flutuante',
        click: () => {
          toggleStatus();
        }
      },
      { type: 'separator' },
      {
        label: '⚙️  Configurações',
        click: () => {
          if (hubWindow) {
            hubWindow.show();
            hubWindow.focus();
            hubWindow.webContents.executeJavaScript(`
              if (window.zubridge && window.zubridge.dispatch) {
                window.zubridge.dispatch("SET_PREFS", { user: { selectedTab: "settings" } });
              }
            `).catch(() => {});
          }
        }
      },
      { type: 'separator' },
      {
        label: '❌  Sair do Astter',
        click: () => {
          quitFlow();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  };

  updateMenu();

  tray.on('click', () => {
    toggleHub();
  });
}

function toggleHub() {
  if (!hubWindow) {
    createHubWindow();
    return;
  }
  if (hubWindow.isVisible()) {
    hubWindow.hide();
  } else {
    hubWindow.show();
    hubWindow.focus();
  }
}

function toggleStatus() {
  if (!statusWindow) {
    createStatusWindow();
    return;
  }
  if (statusWindow.isVisible()) {
    statusWindow.hide();
  } else {
    statusWindow.show();
    statusWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    statusWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    statusWindow.moveTop();
  }
}

function triggerDictation() {
  console.log('🎙️ [Astter] Gatilho de ditado acionado via atalho global / bandeja!');
  if (statusWindow && statusWindow.webContents) {
    if (!statusWindow.isVisible()) {
      statusWindow.show();
    }
    statusWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    statusWindow.moveTop();
    statusWindow.webContents.send('astter:dictation-trigger');
  } else if (hubWindow && hubWindow.webContents) {
    hubWindow.webContents.send('astter:dictation-trigger');
  }
}

function startDictation() {
  console.log('🎙️ [Astter PTT] Iniciar ditado (tecla pressionada)');
  if (statusWindow && statusWindow.webContents) {
    if (!statusWindow.isVisible()) {
      statusWindow.show();
    }
    statusWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    statusWindow.moveTop();
    statusWindow.webContents.send('astter:dictation-start');
  } else if (hubWindow && hubWindow.webContents) {
    hubWindow.webContents.send('astter:dictation-start');
  }
}

function stopDictation() {
  console.log('⏹️ [Astter PTT] Parar ditado (tecla solta)');
  if (statusWindow && statusWindow.webContents) {
    statusWindow.webContents.send('astter:dictation-stop');
  } else if (hubWindow && hubWindow.webContents) {
    hubWindow.webContents.send('astter:dictation-stop');
  }
}

let pttProcess = null;
function startPttDaemon() {
  const pttBin = path.join(__dirname, 'flow-ptt');
  const pttSrc = path.join(__dirname, 'flow-ptt.c');
  const fs = require('fs');
  if (!fs.existsSync(pttBin) && fs.existsSync(pttSrc)) {
    try {
      const { execSync } = require('child_process');
      execSync(`gcc -O2 "${pttSrc}" -o "${pttBin}"`);
      console.log('✓ [Astter] binário nativo (flow-ptt) compilado automaticamente com sucesso!');
    } catch (e) {
      console.warn('⚠️ [Astter] Falha ao compilar o binário nativo (flow-ptt):', e.message);
    }
  }
  if (fs.existsSync(pttBin)) {
    try {
      const { spawn } = require('child_process');
      pttProcess = spawn(pttBin, [], { stdio: 'inherit' });
      pttProcess.on('error', (err) => {
        console.warn('⚠️ [Astter PTT] Daemon info:', err.message);
      });
      console.log('✓ [Astter] Daemon nativo de Push-to-Talk (Hold-to-Talk) ativo!');
    } catch (e) {}
  }
}

function quitFlow() {
  console.log('👋 [Astter] Encerrando aplicativo...');
  isQuitting = true;
  if (pttProcess) {
    try { pttProcess.kill(); } catch (e) {}
  }
  if (tray) {
    try { tray.destroy(); } catch (e) {}
  }
  app.quit();
}

// IPC Handlers
ipcMain.on('astter:toggle-hub', toggleHub);
ipcMain.on('astter:dictation-trigger', triggerDictation);
ipcMain.on('astter:open-settings', () => {
  const navigateToSettings = () => {
    if (hubWindow && !hubWindow.isDestroyed() && hubWindow.webContents) {
      hubWindow.webContents.executeJavaScript(`
        if (window.zubridge && window.zubridge.dispatch) {
          window.zubridge.dispatch("SET_PREFS", { user: { selectedTab: "settings" } });
        }
      `).catch(() => {});
    }
  };

  if (!hubWindow || hubWindow.isDestroyed()) {
    createHubWindow();
    setTimeout(navigateToSettings, 800);
  } else {
    hubWindow.show();
    hubWindow.focus();
    navigateToSettings();
    setTimeout(navigateToSettings, 200);
  }
});
ipcMain.on('astter:toggle-status', toggleStatus);
ipcMain.on('astter:minimize-hub', () => {
  if (hubWindow) hubWindow.minimize();
});
ipcMain.on('astter:close-hub', () => {
  if (hubWindow) hubWindow.hide();
});
ipcMain.on('astter:quit', quitFlow);
ipcMain.on('astter:trigger-window-move', () => {
  if (statusWindow && !statusWindow.isDestroyed()) {
    statusWindow.focus();
    try {
      exec('qdbus-qt6 org.kde.kglobalaccel /component/kwin invokeShortcut "Window Move"');
    } catch (_) {}
  }
});

ipcMain.on('astter:move-status', (event, { dx, dy }) => {
  moveCapsule(dx, dy);
});

ipcMain.on('astter:set-status-bounds', (event, { width, height, expandUpwards = true }) => {
  if (!statusWindow) return;
  const currentX = currentCapsuleX || statusWindow.getPosition()[0];
  const currentY = currentCapsuleY || statusWindow.getPosition()[1];
  const [currentW, currentH] = statusWindow.getSize();

  let newY = currentY;
  if (expandUpwards) {
    newY = currentY - (height - currentH);
  }
  let newX = currentX - Math.round((width - currentW) / 2);

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: scrW, height: scrH } = primaryDisplay.workAreaSize;
  newX = Math.max(10, Math.min(newX, scrW - width - 10));
  newY = Math.max(10, Math.min(newY, scrH - height - 10));

  currentCapsuleX = newX;
  currentCapsuleY = newY;

  statusWindow.setBounds({
    x: newX,
    y: newY,
    width,
    height
  });

  if (process.platform === 'linux') {
    positionKWinWindowAsync('Astter Capsule', newX, newY);
  }
});

ipcMain.on('astter:copy-to-clipboard', (event, payload) => {
  let text = '';
  let autoPaste = true;

  if (typeof payload === 'string') {
    text = payload;
  } else if (payload && typeof payload.text === 'string') {
    text = payload.text;
    if (payload.autoPaste !== undefined) autoPaste = payload.autoPaste;
  }

  if (!text) return;
  clipboard.writeText(text);

  // Coloca o texto de forma limpa e assíncrona no Wayland clipboard e na seleção primária
  try {
    const { spawn } = require('child_process');
    const p1 = spawn('wl-copy', [text], { stdio: 'ignore', detached: true });
    p1.unref();
    const p2 = spawn('wl-copy', ['-p', text], { stdio: 'ignore', detached: true });
    p2.unref();
    console.log('📋 [Astter Clipboard] Texto colocado no Wayland clipboard e primary (wl-copy):', text.slice(0, 40));
  } catch (e) {
    console.warn('⚠️ [Astter Clipboard] Falha ao executar wl-copy:', e);
  }

  // Dá 60ms para o servidor Wayland registrar a nova seleção antes de simular o Ctrl+V
  if (autoPaste) {
    setTimeout(() => {
      try {
        const net = require('net');
        const socketClient = net.createConnection('/tmp/flow-uinput.sock', () => {
          socketClient.write('PASTE');
          socketClient.end();
          console.log('📋 [Astter AutoPaste] Hardware uinput Ctrl+V enviado via socket persistente!');
        });
        socketClient.on('error', (err) => {
          console.warn('⚠️ [Astter AutoPaste] Socket uinput indisponível:', err.message);
        });
      } catch (err) {
        console.error('⚠️ [Astter AutoPaste] Erro ao disparar colagem:', err);
      }
    }, 60);
  }
});

ipcMain.handle('astter:transcribe-audio', async (event, base64Data) => {
  if (!base64Data || typeof base64Data !== 'string') return '';
  try {
    const fs = require('fs');
    const tmpAudioPath = '/tmp/flow-recording.webm';
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(tmpAudioPath, buffer);

    const { execFile } = require('child_process');
    const pyScript = path.join(__dirname, 'transcribe.py');

    return new Promise((resolve) => {
      execFile('python3', [pyScript, tmpAudioPath], { timeout: 12000 }, (error, stdout, stderr) => {
        if (error) {
          const reason = error.killed ? 'timeout' : (stderr || error.message || 'unknown_error').toString().trim().slice(0, 300);
          console.error('❌ [Astter Groq Whisper Error]:', reason);
          try {
            memory.saveTranscript({ text: '', app: 'Konsole', duration: 2.0, status: 'failed', failureReason: reason });
            if (hubWindow && !hubWindow.isDestroyed()) {
              hubWindow.webContents.send('history:needsUpdate');
            }
          } catch (mErr) {
            console.warn('⚠️ [Memory] Erro ao salvar tentativa falha:', mErr);
          }
          resolve('');
        } else {
          const text = stdout.trim();
          console.log('✨ [Astter Groq Whisper]:', text);

          // Salva automaticamente o ditado (ou a tentativa falha) em Markdown e no SQLite db.db!
          try {
            if (text) {
              memory.saveTranscript({ text, app: 'Konsole', duration: 2.0 });
            } else {
              memory.saveTranscript({ text: '', app: 'Konsole', duration: 2.0, status: 'failed', failureReason: 'empty_transcript' });
            }
            if (hubWindow && !hubWindow.isDestroyed()) {
              hubWindow.webContents.send('history:needsUpdate');
            }
          } catch (mErr) {
            console.warn('⚠️ [Memory] Erro ao salvar transcrição:', mErr);
          }

          resolve(text);
        }
      });
    });
  } catch (err) {
    console.error('❌ [Astter Transcription Exception]:', err);
    return '';
  }
});

// ==========================================
// FLOW MEMORY PERSISTENCE HANDLERS (SQLite + .md)
// ==========================================
ipcMain.handle('astter:memory-get-notes', async () => memory.getNotes());
ipcMain.handle('astter:memory-get-note-by-id', async (e, id) => memory.getNoteById(id));
ipcMain.handle('astter:memory-save-note', async (e, note) => {
  const saved = memory.saveNote(note);
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send('notes:updated', saved);
  }
  return saved;
});
ipcMain.handle('astter:memory-delete-note', async (e, id) => {
  const ok = memory.deleteNote(id);
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send('notes:updated', { id, deleted: true });
  }
  return ok;
});
ipcMain.handle('astter:memory-pin-note', async (e, id, pinned) => memory.pinNote(id, pinned));

ipcMain.handle('astter:memory-save-transcript', async (e, t) => {
  const saved = memory.saveTranscript(t);
  if (hubWindow && !hubWindow.isDestroyed()) {
    hubWindow.webContents.send('history:needsUpdate');
  }
  return saved;
});
ipcMain.handle('astter:memory-get-transcripts', async (e, params) => memory.getTranscripts(params));
ipcMain.handle('astter:memory-get-transcript-by-id', async (e, id) => memory.getTranscriptById(id));
ipcMain.handle('astter:memory-delete-transcript', async (e, id) => memory.deleteTranscript(id));
ipcMain.handle('astter:memory-delete-all-transcripts', async () => memory.deleteAllTranscripts());

ipcMain.handle('astter:memory-get-dictionary', async () => memory.getDictionaryWords());
ipcMain.handle('astter:memory-add-dictionary', async (e, params) => memory.addDictionaryWord(params));
ipcMain.handle('astter:memory-remove-dictionary', async (e, phrase) => memory.removeDictionaryWord(phrase));
ipcMain.handle('astter:memory-edit-dictionary', async (e, params) => memory.editDictionaryWord(params));
ipcMain.handle('astter:memory-star-dictionary', async (e, phrase, isStarred) => memory.starDictionaryWord(phrase, isStarred));
ipcMain.handle('astter:memory-get-snippets', async () => memory.getSnippets());

ipcMain.handle('astter:memory-get-scratchpad', async () => memory.getScratchpad());
ipcMain.handle('astter:memory-save-scratchpad', async (e, params) => memory.saveScratchpad(params));

ipcMain.handle('astter:memory-get-insights-stats', async () => memory.getInsightsStats());
ipcMain.handle('astter:memory-get-heatmap-stats', async () => memory.getHeatmapStats());
ipcMain.handle('astter:memory-get-meetings', async () => memory.getMeetings());
ipcMain.handle('astter:memory-update-meeting-tags', async (e, id, tags) => memory.updateMeetingTags(id, tags));

ipcMain.on('astter:open-scratchpad', (event, noteData) => {
  openScratchpadWindow(noteData);
});

ipcMain.on('astter:open-granola-window', () => {
  openGranolaWindow();
});

ipcMain.handle('astter:start-meeting-recording', async (event, options) => {
  return meetingRecorder.start(options);
});

ipcMain.handle('astter:stop-meeting-recording', async () => {
  return await meetingRecorder.stop();
});

ipcMain.handle('astter:get-meeting-status', async () => {
  return {
    isRecording: meetingRecorder.isRecording,
    startTime: meetingRecorder.startTime,
    meetingId: meetingRecorder.meetingId,
    meetingTitle: meetingRecorder.meetingTitle,
    attendees: meetingRecorder.attendees,
    transcripts: meetingRecorder.transcripts
  };
});

ipcMain.on('astter:meeting-rename-speaker', (event, { oldName, newName }) => {
  meetingRecorder.renameSpeaker(oldName, newName);
});

ipcMain.on('astter:meeting-add-attendee', (event, { name }) => {
  meetingRecorder.addAttendee(name);
});


const { spawn } = require('child_process');

function checkViteServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:1420/renderer/hub/index.html', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureViteServer() {
  const isRunning = await checkViteServer();
  if (isRunning) {
    console.log('✓ [Astter] Servidor frontend já ativo na porta 1420.');
    return;
  }

  console.log('🚀 [Astter] Iniciando servidor frontend interno na porta 1420...');
  const viteBin = path.join(__dirname, 'node_modules/vite/bin/vite.js');
  const viteProcess = spawn(process.execPath, [viteBin, '--port', '1420'], {
    cwd: __dirname,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'ignore',
    detached: false
  });

  app.on('will-quit', () => {
    try { viteProcess.kill(); } catch (e) {}
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await checkViteServer()) {
      console.log('✓ [Astter] Servidor frontend interno pronto!');
      break;
    }
  }
}

app.whenReady().then(async () => {
  console.log('🚀 [Astter] Inicializando Astter Desktop nativo...');

  await ensureViteServer();

  createTray();
  createHubWindow();
  createStatusWindow();
  startPttDaemon();

  // Register Global Hotkeys
  try {
    const registeredSpace = globalShortcut.register('CommandOrControl+Alt+Space', () => {
      triggerDictation();
    });
    if (registeredSpace) {
      console.log('✓ [Astter] Atalho global registrado: Ctrl+Alt+Espaço');
    }

    const registeredF8 = globalShortcut.register('F8', () => {
      triggerDictation();
    });
    if (registeredF8) {
      console.log('✓ [Astter] Atalho global secundário registrado: F8');
    }
  } catch (err) {
    console.error('⚠️ [Astter] Erro ao registrar atalhos globais:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createHubWindow();
    } else if (hubWindow) {
      hubWindow.show();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Stay running in the system tray on Linux
});

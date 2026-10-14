const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, nativeImage, clipboard } = require('electron');
const path = require('path');
const http = require('http');

// Configure application name and WM_CLASS for Linux KDE Plasma
app.setName('flow-desktop');
app.setDesktopName('flow-desktop');
app.commandLine.appendSwitch('enable-features', 'GlobalShortcutsPortal');

let hubWindow = null;
let statusWindow = null;
let tray = null;
let isQuitting = false;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('⚡ [Flow] Outra instância do Flow já está em execução.');
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
  } else {
    res.writeHead(404);
    res.end();
  }
});
triggerServer.listen(1422, '127.0.0.1', () => {
  console.log('✓ [Flow] Servidor de gatilho ativo em 127.0.0.1:1422');
});

function createHubWindow() {
  const iconPath = path.join(__dirname, 'assets/icons/flow-256.png');

  hubWindow = new BrowserWindow({
    width: 1140,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#121212',
    icon: iconPath,
    title: 'Flow',
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
    console.log('✓ [Flow] Janela principal Hub exibida com sucesso.');
  });

  hubWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      hubWindow.hide();
      console.log('⚡ [Flow] Janela Hub ocultada para a bandeja.');
    }
  });

  hubWindow.on('closed', () => {
    hubWindow = null;
  });
}

function createStatusWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  statusWindow = new BrowserWindow({
    width: 220,
    height: 46,
    x: Math.round((width - 220) / 2),
    y: height - 65,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  statusWindow.loadURL('http://localhost:1420/renderer/status/index.html');
  statusWindow.showInactive();

  statusWindow.on('closed', () => {
    statusWindow = null;
  });
}

function createTray() {
  const trayIconPath = path.join(__dirname, 'assets/icons/flow-tray.png');
  const trayImage = nativeImage.createFromPath(trayIconPath);
  tray = new Tray(trayImage);
  tray.setToolTip('Flow - Ditado por Voz & AI Notetaker');

  const updateMenu = () => {
    const isHubOpen = hubWindow && hubWindow.isVisible();
    const isStatusOpen = statusWindow && statusWindow.isVisible();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Flow (Wispr Flow v1.6.1147)',
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
        label: isHubOpen ? '🗂️  Ocultar Flow Hub' : '🗂️  Abrir Flow Hub',
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
        label: '❌  Sair do Flow',
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
    statusWindow.showInactive();
  }
}

function triggerDictation() {
  console.log('🎙️ [Flow] Gatilho de ditado acionado via atalho global / bandeja!');
  if (statusWindow && statusWindow.webContents) {
    if (!statusWindow.isVisible()) {
      statusWindow.showInactive();
    }
    statusWindow.webContents.send('flow:dictation-trigger');
  } else if (hubWindow && hubWindow.webContents) {
    hubWindow.webContents.send('flow:dictation-trigger');
  }
}

function startDictation() {
  console.log('🎙️ [Flow PTT] Iniciar ditado (tecla pressionada)');
  if (statusWindow && statusWindow.webContents) {
    if (!statusWindow.isVisible()) {
      statusWindow.showInactive();
    }
    statusWindow.webContents.send('flow:dictation-start');
  } else if (hubWindow && hubWindow.webContents) {
    hubWindow.webContents.send('flow:dictation-start');
  }
}

function stopDictation() {
  console.log('⏹️ [Flow PTT] Parar ditado (tecla solta)');
  if (statusWindow && statusWindow.webContents) {
    statusWindow.webContents.send('flow:dictation-stop');
  } else if (hubWindow && hubWindow.webContents) {
    hubWindow.webContents.send('flow:dictation-stop');
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
      console.log('✓ [Flow] flow-ptt compilado automaticamente com sucesso!');
    } catch (e) {
      console.warn('⚠️ [Flow] Falha ao compilar flow-ptt:', e.message);
    }
  }
  if (fs.existsSync(pttBin)) {
    try {
      const { spawn } = require('child_process');
      pttProcess = spawn(pttBin, [], { stdio: 'inherit' });
      pttProcess.on('error', (err) => {
        console.warn('⚠️ [Flow PTT] Daemon info:', err.message);
      });
      console.log('✓ [Flow] Daemon nativo de Push-to-Talk (Hold-to-Talk) ativo!');
    } catch (e) {}
  }
}

function quitFlow() {
  console.log('👋 [Flow] Encerrando aplicativo...');
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
ipcMain.on('flow:toggle-hub', toggleHub);
ipcMain.on('flow:open-settings', () => {
  if (!hubWindow) {
    createHubWindow();
  } else {
    hubWindow.show();
    hubWindow.focus();
    hubWindow.webContents.executeJavaScript(`
      if (window.zubridge && window.zubridge.dispatch) {
        window.zubridge.dispatch("SET_PREFS", { user: { selectedTab: "settings" } });
      }
    `).catch(() => {});
  }
});
ipcMain.on('flow:toggle-status', toggleStatus);
ipcMain.on('flow:minimize-hub', () => {
  if (hubWindow) hubWindow.minimize();
});
ipcMain.on('flow:close-hub', () => {
  if (hubWindow) hubWindow.hide();
});
ipcMain.on('flow:quit', quitFlow);

ipcMain.on('flow:set-status-bounds', (event, { width, height, expandUpwards = true }) => {
  if (!statusWindow) return;
  const [currentX, currentY] = statusWindow.getPosition();
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

  statusWindow.setBounds({
    x: newX,
    y: newY,
    width,
    height
  });
});

ipcMain.on('flow:copy-to-clipboard', (event, payload) => {
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
    console.log('📋 [Flow Clipboard] Texto colocado no Wayland clipboard e primary (wl-copy):', text.slice(0, 40));
  } catch (e) {
    console.warn('⚠️ [Flow Clipboard] Falha ao executar wl-copy:', e);
  }

  // Dá 60ms para o servidor Wayland registrar a nova seleção antes de simular o Ctrl+V
  if (autoPaste) {
    setTimeout(() => {
      try {
        const net = require('net');
        const socketClient = net.createConnection('/tmp/flow-uinput.sock', () => {
          socketClient.write('PASTE');
          socketClient.end();
          console.log('📋 [Flow AutoPaste] Hardware uinput Ctrl+V enviado via socket persistente!');
        });
        socketClient.on('error', (err) => {
          console.warn('⚠️ [Flow AutoPaste] Socket uinput indisponível:', err.message);
        });
      } catch (err) {
        console.error('⚠️ [Flow AutoPaste] Erro ao disparar colagem:', err);
      }
    }, 60);
  }
});

ipcMain.handle('flow:transcribe-audio', async (event, base64Data) => {
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
          console.error('❌ [Flow Groq Whisper Error]:', stderr || error.message);
          resolve('');
        } else {
          const text = stdout.trim();
          console.log('✨ [Flow Groq Whisper]:', text);
          resolve(text);
        }
      });
    });
  } catch (err) {
    console.error('❌ [Flow Transcription Exception]:', err);
    return '';
  }
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
    console.log('✓ [Flow] Servidor frontend já ativo na porta 1420.');
    return;
  }

  console.log('🚀 [Flow] Iniciando servidor frontend interno na porta 1420...');
  const viteBin = path.join(__dirname, 'node_modules/vite/bin/vite.js');
  const viteProcess = spawn(process.execPath, [viteBin, '--port', '1420'], {
    cwd: __dirname,
    stdio: 'ignore',
    detached: false
  });

  app.on('will-quit', () => {
    try { viteProcess.kill(); } catch (e) {}
  });

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await checkViteServer()) {
      console.log('✓ [Flow] Servidor frontend interno pronto!');
      break;
    }
  }
}

app.whenReady().then(async () => {
  console.log('🚀 [Flow] Inicializando Flow Desktop nativo...');

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
      console.log('✓ [Flow] Atalho global registrado: Ctrl+Alt+Espaço');
    }

    const registeredF8 = globalShortcut.register('F8', () => {
      triggerDictation();
    });
    if (registeredF8) {
      console.log('✓ [Flow] Atalho global secundário registrado: F8');
    }
  } catch (err) {
    console.error('⚠️ [Flow] Erro ao registrar atalhos globais:', err);
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

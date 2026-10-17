#!/bin/bash
# ========================================================
# Astter Desktop Native Launcher (Wispr Flow 1:1 Linux Edition)
# ========================================================

PROJECT_DIR="/run/media/wiu/Novo volume1/flow"
TAURI_CLIENT_DIR="$PROJECT_DIR/tauri-client"

echo "⚡ [Astter] Iniciando Astter Desktop Nativo (baseado na Wispr Flow)..."
echo "✨ [Astter] Abrindo aplicativo nativo Astter e ícone na bandeja do sistema..."

if [ "$1" = "--dictate" ]; then
  curl -s http://127.0.0.1:1422/trigger >/dev/null 2>&1 || true
  exit 0
fi

if [ "$1" = "--hub" ]; then
  curl -s http://127.0.0.1:1422/hub >/dev/null 2>&1 || true
  exit 0
fi

if [ "$1" = "--granola" ]; then
  curl -s http://127.0.0.1:1422/granola >/dev/null 2>&1 || true
  exit 0
fi

if [ "$1" = "--meeting" ]; then
  curl -s http://127.0.0.1:1422/meeting >/dev/null 2>&1 || true
  exit 0
fi

if [ "$1" = "--reload" ]; then
  curl -s http://127.0.0.1:1422/reload >/dev/null 2>&1 || true
  exit 0
fi

cd "$TAURI_CLIENT_DIR" || exit 1
ELECTRON_BIN="$TAURI_CLIENT_DIR/node_modules/.bin/electron"
exec "$ELECTRON_BIN" electron-main.cjs "$@"

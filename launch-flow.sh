#!/bin/bash
# ========================================================
# Flow Desktop Native Launcher (Wispr Flow 1:1 Linux Edition)
# ========================================================

PROJECT_DIR="/run/media/wiu/Novo volume1/flow"
TAURI_CLIENT_DIR="$PROJECT_DIR/tauri-client"

echo "⚡ [Flow] Iniciando Flow Desktop Nativo (Wispr Flow)..."
echo "✨ [Flow] Abrindo aplicativo nativo Flow e ícone na bandeja do sistema..."

if [ "$1" = "--dictate" ]; then
  curl -s http://127.0.0.1:1422/trigger >/dev/null 2>&1 || true
  exit 0
fi

cd "$TAURI_CLIENT_DIR" || exit 1
ELECTRON_BIN="$TAURI_CLIENT_DIR/node_modules/.bin/electron"
exec "$ELECTRON_BIN" electron-main.cjs "$@"

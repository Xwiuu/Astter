<div align="center">

# Astter 🎙️⚡

**A native, zero-latency Linux alternative to Wispr Flow — hold a key, talk, and it types for you.**

[![License: MIT](https://img.shields.io/badge/license-MIT-brightgreen.svg)](#%EF%B8%8F-license)
[![Platform](https://img.shields.io/badge/platform-Linux%20(Wayland%20%26%20X11)-0078d4.svg)](#-quick-start)
[![Desktop](https://img.shields.io/badge/desktop-KDE%20Plasma%206%20%7C%20GNOME%20%7C%20Sway%20%7C%20Hyprland-7f5af0.svg)](#-quick-start)
[![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg?logo=electron&logoColor=white)](#-quick-start)
[![Transcription](https://img.shields.io/badge/transcription-Groq%20Whisper%20Large--v3-f55036.svg)](#-features)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blueviolet.svg)](#-contributing)

</div>

> **Astter** is a native, high-performance, open-source Linux alternative to Wispr Flow. Engineered with **Electron & Tauri**, **C (Linux uinput)**, and **Groq Whisper Large-v3** for ultra-fast push-to-talk voice dictation and auto-typing on Linux Wayland (KDE Plasma 6, GNOME, Sway, Hyprland) & X11.

---

## 📑 Table of Contents

- [What is Astter?](#-what-is-astter)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [Meeting Diarization (optional)](#️-meeting-diarization-optional)
- [Meeting Summary Export (optional)](#-meeting-summary-export-optional)
- [Shortcuts](#️-shortcuts)
- [Contributing](#-contributing)
- [License](#️-license)

---

## 🌟 What is Astter?

**Astter** brings native, system-wide, zero-latency Push-to-Talk voice dictation to Linux. Just like Wispr Flow on macOS and Windows, hold down your shortcut (`Ctrl + Win`), speak anywhere (WhatsApp Web, Brave, Chrome, VS Code, Discord, Slack, Telegram, Terminal), and release — your speech is instantly transcribed with Groq's `whisper-large-v3` and automatically typed directly into your active cursor via kernel-level virtual keyboard emulation (`/dev/uinput`).

---

## ✨ Features

- **🎙️ True Push-to-Talk (Hold-to-Talk):**
  - Hold `Ctrl + Win`, speak, and release to auto-type into any text field.
  - Zero-latency persistent audio stream (`0ms` mic initialization lag).
  - Physical modifier key release debounce and Wayland compositor focus protection.

- **⌨️ Universal Linux Wayland & X11 Auto-Typing:**
  - Emulates physical keystrokes (`Ctrl + V` and `Shift + Insert`) via Linux kernel `/dev/uinput` with real microsecond timestamps.
  - Wayland dual-clipboard synchronization (`CLIPBOARD` and `PRIMARY` via `wl-copy`).
  - No focus loss or start menu interference.

- **🧠 Groq Whisper Large-v3 AI Engine:**
  - Blazing fast transcription (<300ms) with state-of-the-art multilingual accuracy (Portuguese, English, Spanish, etc.).
  - Built-in hallucination filters to suppress silence artifacts.

- **🎨 Dual UI Experience:**
  - **Floating Pill Widget:** Sleek dark-mode glassmorphic pill always-on-top with reactive audio waveforms, and freely **repositionable to any screen edge** (top, bottom, left, right) via a single click — it always stays on top and avoids overlapping panels/docks automatically.
  - **Full Desktop Hub:** runs the real Wispr Flow renderer bridged to a 100% local backend — Dictation History, Insights, Dictionary, Snippets, Scratchpad, and an embedded Notetaker, all backed by your own SQLite + Markdown store (nothing leaves your machine).

- **📝 Meeting Notetaker (Granola-style), fully local:**
  - Dual-channel PipeWire capture (your mic + system/call audio) transcribed live via Groq Whisper.
  - **Real speaker diarization** (`pyannote.audio`, runs on-device) separates the actual voices of remote participants after the meeting ends, instead of lumping everyone into one generic label — see [Diarization setup](#️-meeting-diarization-optional) below.
  - AI-structured notes (summary, decisions, action items) with an Enhanced/raw-transcript panel switcher and tag pills per meeting.
  - **Export summaries straight to your filesystem** (Markdown + PDF), optionally organized into a subfolder per client/project — see [Meeting Summary Export](#-meeting-summary-export-optional) below.
  - Crash-safe by design: closing the app mid-recording or mid-processing waits for the meeting to finish saving first, so a recording is never silently lost.

- **🔕 KDE Plasma 6 & Wayland Optimized:**
  - Specifically handles KDE Plasma 6 Meta-key release behaviors to prevent application launcher popups.

---

## 🚀 Quick Start

### 1. Requirements

Ensure you have Node.js (v18+), Python 3, GCC, `wl-clipboard`, and `pipewire-utils` (for meeting recording) installed:

```bash
# Fedora
sudo dnf install -y nodejs gcc wl-clipboard pipewire-utils

# Ubuntu / Debian
sudo apt install -y nodejs gcc wl-clipboard pipewire-bin
```

### 2. Configure uinput Permissions (One-time)

To allow Astter to type into your active cursor on Wayland without needing root each time:

```bash
# Add uinput permissions rule
echo 'KERNEL=="uinput", MODE="0666"' | sudo tee /etc/udev/rules.d/99-uinput.rules
sudo udevadm control --reload && sudo udevadm trigger
```

### 3. Installation

```bash
git clone https://github.com/Xwiuu/Astter.git
cd Astter
npm install
cd tauri-client
npm install
```

### 4. Run Astter

```bash
./launch-flow.sh
```

---

## 🗣️ Meeting Diarization (optional)

By default, recorded meetings label every remote participant with a single generic
speaker. To identify each real voice separately, set up local diarization once:

```bash
cd tauri-client
python3.13 -m venv diarize-venv   # use 3.11/3.12/3.13 — whichever has PyTorch wheels available
./diarize-venv/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
./diarize-venv/bin/pip install pyannote.audio
```

Then get a free token and accept the gated model terms:

1. Create an account at [huggingface.co](https://huggingface.co)
2. Accept the terms on [`pyannote/speaker-diarization-3.1`](https://huggingface.co/pyannote/speaker-diarization-3.1) and [`pyannote/speaker-diarization-community-1`](https://huggingface.co/pyannote/speaker-diarization-community-1)
3. Generate a read token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
4. Add it to `tauri-client/.env`: `HUGGINGFACE_TOKEN=hf_...`

Without this setup, meeting recording still works fine — it just skips diarization
and falls back to the generic speaker label.

---

## 📁 Meeting Summary Export (optional)

By default, every meeting is saved locally in `memory/meetings/` (Markdown) and in your
local SQLite store. If you'd rather also keep a copy organized in your own folder
structure (e.g. one subfolder per client or project), open the capsule menu and click
the **folder icon** to pick a destination folder.

- Nothing changes until you set a folder — it's entirely opt-in.
- Once set, every finished meeting also drops a `.md` and a `.pdf` copy into that folder.
- When starting a recording, you can optionally type a client/project name — the copy
  is then saved under `<your folder>/<client name>/` instead of the folder root.
- The local `memory/meetings/` + SQLite save always happens regardless — this is purely
  an additional, human-friendly copy for your own filesystem/client deliverables.

---

## ⌨️ Shortcuts

| Shortcut / Control | Action |
|---|---|
| **Hold `Ctrl + Win`** | Push-to-Talk (Hold to speak, release to paste into active cursor) |
| **`Ctrl + Alt + Space`** | Toggle Dictation Mode (Hands-free) |
| **`F8`** | Secondary Global Dictation Toggle |
| **Capsule → position icon** | Cycle the floating pill's screen position (bottom → top → left → right) |
| **Capsule → folder icon** | Choose/change the local folder meeting summaries are exported to |
| **Capsule → camera icon** | Start/stop meeting recording |

---

## 🤝 Contributing

Issues and PRs are welcome! Astter is a solo-built, actively-used daily driver, so the
fastest way to get a fix merged is to open a focused PR with a clear description of the
problem it solves. Please keep PRs scoped to one change at a time.

---

## 🛡️ License

MIT License. Designed and built with ❤️ for the Linux community.

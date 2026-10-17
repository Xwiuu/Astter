# Aion 🎙️⚡

> **Aion** is a native, high-performance, open-source Linux alternative to Wispr Flow. Engineered with **Electron & Tauri**, **C (Linux uinput)**, and **Groq Whisper Large-v3** for ultra-fast push-to-talk voice dictation and auto-typing on Linux Wayland (KDE Plasma 6, GNOME, Sway, Hyprland) & X11.

---

## 🌟 What is Aion?

**Aion** brings native, system-wide, zero-latency Push-to-Talk voice dictation to Linux. Just like Wispr Flow on macOS and Windows, hold down your shortcut (`Ctrl + Win`), speak anywhere (WhatsApp Web, Brave, Chrome, VS Code, Discord, Slack, Telegram, Terminal), and release — your speech is instantly transcribed with Groq's `whisper-large-v3` and automatically typed directly into your active cursor via kernel-level virtual keyboard emulation (`/dev/uinput`).

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
  - **Floating Pill Widget:** Sleek dark-mode glassmorphic pill always-on-top with reactive audio waveforms.
  - **Full Desktop Hub:** runs the real Wispr Flow renderer bridged to a 100% local backend — Dictation History, Insights, Dictionary, Snippets, Scratchpad, and an embedded Notetaker, all backed by your own SQLite + Markdown store (nothing leaves your machine).

- **📝 Meeting Notetaker (Granola-style), fully local:**
  - Dual-channel PipeWire capture (your mic + system/call audio) transcribed live via Groq Whisper.
  - **Real speaker diarization** (`pyannote.audio`, runs on-device) separates the actual voices of remote participants after the meeting ends, instead of lumping everyone into one generic label — see [Diarization setup](#-meeting-diarization-optional) below.
  - AI-structured notes (summary, decisions, action items) with an Enhanced/raw-transcript panel switcher and tag pills per meeting.

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

To allow Aion to type into your active cursor on Wayland without needing root each time:

```bash
# Add uinput permissions rule
echo 'KERNEL=="uinput", MODE="0666"' | sudo tee /etc/udev/rules.d/99-uinput.rules
sudo udevadm control --reload && sudo udevadm trigger
```

### 3. Installation

```bash
git clone https://github.com/Xwiuu/Aion.git
cd Aion
npm install
cd tauri-client
npm install
```

### 4. Run Aion

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

## ⌨️ Shortcuts

| Shortcut | Action |
|---|---|
| **Hold `Ctrl + Win`** | Push-to-Talk (Hold to speak, release to paste into active cursor) |
| **`Ctrl + Alt + Space`** | Toggle Dictation Mode (Hands-free) |
| **`F8`** | Secondary Global Dictation Toggle |

---

## 🛡️ License

MIT License. Designed and built with ❤️ for the Linux community.

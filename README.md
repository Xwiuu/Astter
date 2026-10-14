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
  - **Full Desktop Hub:** 9 rich productivity tabs including Dictation History, AI Scratchpad, Meeting Recorder, Insights, Snippets, and Technical Dictionary.

- **🔕 KDE Plasma 6 & Wayland Optimized:**
  - Specifically handles KDE Plasma 6 Meta-key release behaviors to prevent application launcher popups.

---

## 🚀 Quick Start

### 1. Requirements

Ensure you have Node.js (v18+), Python 3, GCC, and `wl-clipboard` installed:

```bash
# Fedora
sudo dnf install -y nodejs gcc wl-clipboard

# Ubuntu / Debian
sudo apt install -y nodejs gcc wl-clipboard
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

## ⌨️ Shortcuts

| Shortcut | Action |
|---|---|
| **Hold `Ctrl + Win`** | Push-to-Talk (Hold to speak, release to paste into active cursor) |
| **`Ctrl + Alt + Space`** | Toggle Dictation Mode (Hands-free) |
| **`F8`** | Secondary Global Dictation Toggle |

---

## 🛡️ License

MIT License. Designed and built with ❤️ for the Linux community.

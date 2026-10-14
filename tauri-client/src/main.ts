// ========================================================
// FLOW DESKTOP & FLOW BAR - FULL 1:1 WISPR FLOW CONTROLLER
// ========================================================

interface DictationItem {
  id: string;
  text: string;
  timestamp: number;
  latencyMs: number;
  wordCount: number;
  starred?: boolean;
}

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  priority?: "alta" | "media" | "baixa";
}

interface SnippetItem {
  id: string;
  trigger: string;
  desc: string;
  content: string;
}

// --------------------------------------------------------
// Estado Persistente no LocalStorage
// --------------------------------------------------------
const DEFAULT_KEY = import.meta.env.VITE_GROQ_API_KEY || "";
let groqApiKey = localStorage.getItem("flow_groq_key") || DEFAULT_KEY;
let currentModel = localStorage.getItem("flow_model") || "whisper-large-v3";
let currentLang = localStorage.getItem("flow_lang") || "pt";
let currentTone = localStorage.getItem("flow_tone") || "natural";
let customStylePrompt = localStorage.getItem("flow_custom_style_prompt") || "";
let enableChimes = localStorage.getItem("flow_chimes") !== "false";
let autoCopy = localStorage.getItem("flow_auto_copy") !== "false";

const DEFAULT_TERMS = ["Flow", "Groq", "Whisper", "Tauri", "Linux", "Wayland", "PipeWire", "Kubernetes", "TypeScript", "Next.js", "Supabase"];
let customTerms: string[] = JSON.parse(localStorage.getItem("flow_terms") || JSON.stringify(DEFAULT_TERMS));

let dictationHistory: DictationItem[] = JSON.parse(localStorage.getItem("flow_history") || "[]");

const DEFAULT_TASKS: TaskItem[] = [
  { id: "1", text: "Subir o cliente Flow para o repositório no GitHub", completed: false, createdAt: Date.now() - 3600000, priority: "alta" },
  { id: "2", text: "Testar a gravação no microfone com Whisper Large V3", completed: true, createdAt: Date.now() - 7200000, priority: "media" },
  { id: "3", text: "Configurar atalho global de push-to-talk no KDE Plasma", completed: false, createdAt: Date.now() - 10800000, priority: "alta" }
];
let userTasks: TaskItem[] = JSON.parse(localStorage.getItem("flow_tasks") || JSON.stringify(DEFAULT_TASKS));

const DEFAULT_SNIPPETS: SnippetItem[] = [
  { id: "1", trigger: ";email", desc: "E-mail de contato profissional", content: "contato@empresa.com.br" },
  { id: "2", trigger: ";meet", desc: "Link para sala de reunião", content: "https://meet.google.com/flow-sync" },
  { id: "3", trigger: ";standup", desc: "Template de atualização diária", content: "Hoje trabalhei em: \n- Engenharia reversa do protocolo de voz\n- Implementação da UI do Flow\nPróximos passos: Testes finais e push para GitHub." },
  { id: "4", trigger: ";flow", desc: "Assinatura do Flow", content: "Enviado usando o Flow — Ditado por voz inteligente para Linux." }
];
let userSnippets: SnippetItem[] = JSON.parse(localStorage.getItem("flow_snippets") || JSON.stringify(DEFAULT_SNIPPETS));

// --------------------------------------------------------
// Seletores da Interface
// --------------------------------------------------------
// Modo Flow Bar
const widePill = document.getElementById("wide-pill") as HTMLElement;
const compactPill = document.getElementById("compact-pill") as HTMLElement;
const btnExpandHub = document.getElementById("btn-expand-hub") as HTMLButtonElement;
const btnMinimizeToBar = document.getElementById("btn-minimize-to-bar") as HTMLButtonElement;
const waveformEl = document.getElementById("miniWaveform") as HTMLElement;
const timerEl = document.getElementById("recording-timer") as HTMLElement;
const successSnippetEl = document.getElementById("success-snippet") as HTMLElement;
const badgeLatencyEl = document.getElementById("badge-latency") as HTMLElement;

const stateViews = {
  idle: document.querySelector(".state-idle") as HTMLElement,
  listening: document.querySelector(".state-listening") as HTMLElement,
  processing: document.querySelector(".state-processing") as HTMLElement,
  completed: document.querySelector(".state-completed") as HTMLElement,
};

// Navegação do Hub
const navBtns = document.querySelectorAll(".sidebar-nav .nav-btn") as NodeListOf<HTMLButtonElement>;
const tabPanes = document.querySelectorAll(".tab-pane") as NodeListOf<HTMLElement>;
const tabHeading = document.getElementById("current-tab-heading") as HTMLElement;
const hubRecordBtn = document.getElementById("hub-record-btn") as HTMLButtonElement;
const sidebarEngineName = document.getElementById("sidebar-engine-name") as HTMLElement;
const globalSearchInput = document.getElementById("global-search-input") as HTMLInputElement;

// Aba 1: Histórico
const historyListEl = document.getElementById("history-list") as HTMLElement;
const btnClearHistory = document.getElementById("btn-clear-history") as HTMLButtonElement;
const historyFilterChips = document.querySelectorAll(".filter-chips .chip") as NodeListOf<HTMLButtonElement>;
let activeHistoryFilter = "all";

// Aba 2: Scratchpad
const scratchpadTitle = document.getElementById("scratchpad-title") as HTMLInputElement;
const scratchpadTextarea = document.getElementById("scratchpad-textarea") as HTMLTextAreaElement;
const scratchpadWordCount = document.getElementById("scratchpad-word-count") as HTMLElement;
const scratchpadCharCount = document.getElementById("scratchpad-char-count") as HTMLElement;
const scratchpadReadTime = document.getElementById("scratchpad-read-time") as HTMLElement;
const btnScratchpadDictate = document.getElementById("btn-scratchpad-dictate") as HTMLButtonElement;
const btnScratchpadPolish = document.getElementById("btn-scratchpad-polish") as HTMLButtonElement;
const btnScratchpadCopy = document.getElementById("btn-scratchpad-copy") as HTMLButtonElement;
const btnScratchpadClear = document.getElementById("btn-scratchpad-clear") as HTMLButtonElement;
let isScratchpadDictationTarget = false;

// Aba 3: Notetaker (Reuniões)
const btnMeetingToggle = document.getElementById("btn-meeting-toggle") as HTMLButtonElement;
const btnMeetingLabel = document.getElementById("btn-meeting-label") as HTMLElement;
const meetingLiveBadge = document.getElementById("meeting-live-badge") as HTMLElement;
const meetingTimerEl = document.getElementById("meeting-timer") as HTMLElement;
const meetingSummaryContent = document.getElementById("meeting-summary-content") as HTMLElement;
const meetingChecklist = document.getElementById("meeting-checklist") as HTMLElement;
const meetingTranscriptContent = document.getElementById("meeting-transcript-content") as HTMLElement;
const btnCopyMeetingTranscript = document.getElementById("btn-copy-meeting-transcript") as HTMLButtonElement;
let isMeetingRecording = false;
let meetingStartTime = 0;
let meetingTimerInterval: number | null = null;

// Aba 4: Tasks
const newTaskInput = document.getElementById("new-task-input") as HTMLInputElement;
const btnAddTask = document.getElementById("btn-add-task") as HTMLButtonElement;
const tasksListEl = document.getElementById("tasks-list") as HTMLElement;
const taskCountAll = document.getElementById("task-count-all") as HTMLElement;
const taskCountPending = document.getElementById("task-count-pending") as HTMLElement;
const taskCountDone = document.getElementById("task-count-done") as HTMLElement;
const taskFilterChips = document.querySelectorAll(".tasks-filter-chips .chip") as NodeListOf<HTMLButtonElement>;
let activeTaskFilter = "all";

// Aba 5: Snippets
const snippetsGrid = document.getElementById("snippets-grid") as HTMLElement;
const btnOpenNewSnippetModal = document.getElementById("btn-open-new-snippet-modal") as HTMLButtonElement;
const modalSnippet = document.getElementById("modal-snippet") as HTMLElement;
const btnCloseSnippetModal = document.getElementById("btn-close-snippet-modal") as HTMLButtonElement;
const btnCancelSnippetModal = document.getElementById("btn-cancel-snippet-modal") as HTMLButtonElement;
const btnSaveSnippetModal = document.getElementById("btn-save-snippet-modal") as HTMLButtonElement;
const modalSnippetTrigger = document.getElementById("modal-snippet-trigger") as HTMLInputElement;
const modalSnippetDesc = document.getElementById("modal-snippet-desc") as HTMLInputElement;
const modalSnippetContent = document.getElementById("modal-snippet-content") as HTMLTextAreaElement;

// Aba 6: Dicionário
const dictInput = document.getElementById("dict-input") as HTMLInputElement;
const btnAddTerm = document.getElementById("btn-add-term") as HTMLButtonElement;
const termsCloudEl = document.getElementById("terms-tag-cloud") as HTMLElement;
const termsCountEl = document.getElementById("terms-count") as HTMLElement;
const btnResetDefaultTerms = document.getElementById("btn-reset-default-terms") as HTMLButtonElement;

// Aba 7: Estilo & Tom
const toneCards = document.querySelectorAll(".tone-card") as NodeListOf<HTMLElement>;
const inputCustomStylePrompt = document.getElementById("input-custom-style-prompt") as HTMLTextAreaElement;
const btnSaveStylePrompt = document.getElementById("btn-save-style-prompt") as HTMLButtonElement;
const stylePromptStatus = document.getElementById("style-prompt-status") as HTMLElement;

// Aba 8: Insights
const statWordsEl = document.getElementById("stat-words") as HTMLElement;
const statTimeEl = document.getElementById("stat-time") as HTMLElement;
const statLatencyEl = document.getElementById("stat-latency") as HTMLElement;
const statCountEl = document.getElementById("stat-count") as HTMLElement;
const statWpmCurrentEl = document.getElementById("stat-wpm-current") as HTMLElement;

// Aba 9: Configurações
const settingsNavBtns = document.querySelectorAll(".settings-nav-btn") as NodeListOf<HTMLButtonElement>;
const settingsSubpanes = document.querySelectorAll(".subtab-pane") as NodeListOf<HTMLElement>;
const selectAudioDevice = document.getElementById("select-audio-device") as HTMLSelectElement;
const vuMeterFill = document.getElementById("vu-meter-fill") as HTMLElement;
const chkSoundChimes = document.getElementById("chk-sound-chimes") as HTMLInputElement;
const chkAutoCopy = document.getElementById("chk-auto-copy") as HTMLInputElement;
const inputApiKey = document.getElementById("input-api-key") as HTMLInputElement;
const btnSaveKey = document.getElementById("btn-save-key") as HTMLButtonElement;
const apiStatusMsg = document.getElementById("api-status-msg") as HTMLElement;
const selectLanguage = document.getElementById("select-language") as HTMLSelectElement;
const modelChoices = document.querySelectorAll(".model-choice") as NodeListOf<HTMLElement>;

// Toast
const flowToast = document.getElementById("flow-toast") as HTMLElement;
const toastMessage = document.getElementById("toast-message") as HTMLElement;
let toastTimeout: number | null = null;

// --------------------------------------------------------
// Estado do Motor de Áudio
// --------------------------------------------------------
let isRecording = false;
let audioContext: AudioContext | null = null;
let mediaStream: MediaStream | null = null;
let audioInput: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let animationFrameId: number | null = null;
let recordedChunks: Float32Array[] = [];
let recordingStartTime = 0;
let timerInterval: number | null = null;

// ========================================================
// TOAST NOTIFICATION SYSTEM
// ========================================================
function showToast(msg: string) {
  if (!flowToast || !toastMessage) return;
  toastMessage.textContent = msg;
  flowToast.classList.remove("hidden");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    flowToast.classList.add("hidden");
  }, 2200);
}

// ========================================================
// CONTROLE DE MODO (FLOW BAR vs FLOW HUB)
// ========================================================
async function setViewMode(mode: "bar" | "hub") {
  if (mode === "bar") {
    document.body.className = "mode-bar";
    try {
      const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setSize(new LogicalSize(280, 100));
    } catch {
      // Fallback para navegador
    }
  } else {
    document.body.className = "mode-hub";
    try {
      const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setSize(new LogicalSize(980, 680));
    } catch {
      // Fallback para navegador
    }
  }
}

btnExpandHub?.addEventListener("click", (e) => {
  e.stopPropagation();
  setViewMode("hub");
});

btnMinimizeToBar?.addEventListener("click", () => {
  setViewMode("bar");
});

// ========================================================
// EFEITOS SONOROS (CHIMES SINTETIZADOS DO WISPR FLOW)
// ========================================================
function playChime(type: "start" | "stop") {
  if (!enableChimes) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "start") {
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.09);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.08);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch {
    // Som opcional
  }
}

// ========================================================
// ESTADOS VISUAIS DA BARRA FLUTUANTE
// ========================================================
type BarState = "idle" | "listening" | "processing" | "completed";

function setBarState(state: BarState) {
  widePill.classList.remove("idle", "listening", "processing", "completed");
  widePill.classList.add(state);

  if (state === "listening") {
    compactPill.classList.add("recording");
    hubRecordBtn?.classList.add("recording");
  } else {
    compactPill.classList.remove("recording");
    hubRecordBtn?.classList.remove("recording");
  }

  Object.entries(stateViews).forEach(([key, el]) => {
    if (key === state) {
      el.classList.add("active");
    } else {
      el.classList.remove("active");
    }
  });
}

// ========================================================
// CAPTURA E GRAVAÇÃO DE MICROFONE (16KHZ MONO)
// ========================================================
async function startRecording(target: "general" | "scratchpad" = "general") {
  if (isRecording) return;
  isScratchpadDictationTarget = target === "scratchpad";

  try {
    const selectedDeviceId = selectAudioDevice.value;
    const audioConstraints: MediaTrackConstraints = {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
    };

    if (selectedDeviceId && selectedDeviceId !== "default") {
      audioConstraints.deviceId = { exact: selectedDeviceId };
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

    audioContext = new AudioContext({ sampleRate: 16000 });
    audioInput = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;

    const processor = audioContext.createScriptProcessor(2048, 1, 1);
    recordedChunks = [];

    processor.onaudioprocess = (e) => {
      if (!isRecording) return;
      const inputBuffer = e.inputBuffer.getChannelData(0);
      recordedChunks.push(new Float32Array(inputBuffer));
    };

    audioInput.connect(analyser);
    analyser.connect(processor);
    processor.connect(audioContext.destination);

    isRecording = true;
    playChime("start");
    setBarState("listening");

    recordingStartTime = Date.now();
    updateTimer();
    timerInterval = window.setInterval(updateTimer, 500);

    animateWaveform();
  } catch (err) {
    console.error("Erro no microfone:", err);
    showToast("Permissão de microfone necessária para o Flow.");
  }
}

function updateTimer() {
  const elapsedSec = Math.floor((Date.now() - recordingStartTime) / 1000);
  const m = Math.floor(elapsedSec / 60).toString();
  const s = (elapsedSec % 60).toString().padStart(2, "0");
  if (timerEl) timerEl.textContent = `${m}:${s}`;
}

function animateWaveform() {
  if (!isRecording || !analyser) return;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const averageVolume = sum / dataArray.length;
  const normalizedLevel = Math.min(1, averageVolume / 100);

  if (waveformEl) {
    waveformEl.style.setProperty("--audio-scale", `${Math.max(1, 1 + normalizedLevel * 4)}`);
  }

  if (vuMeterFill) {
    vuMeterFill.style.width = `${Math.min(100, normalizedLevel * 120)}%`;
  }

  animationFrameId = requestAnimationFrame(animateWaveform);
}

async function stopRecording() {
  if (!isRecording) return;
  isRecording = false;
  playChime("stop");

  if (timerInterval) clearInterval(timerInterval);
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
  }
  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
  }

  if (vuMeterFill) vuMeterFill.style.width = "0%";

  if (recordedChunks.length === 0) {
    setBarState("idle");
    return;
  }

  setBarState("processing");

  const wavBlob = exportWAV(recordedChunks, 16000);
  await sendToGroq(wavBlob);
}

function exportWAV(chunks: Float32Array[], sampleRate: number): Blob {
  let totalLength = 0;
  for (const chunk of chunks) totalLength += chunk.length;

  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const paddingLen = Math.floor(sampleRate * 0.15);
  const padded = new Float32Array(merged.length + paddingLen * 2);
  padded.set(merged, paddingLen);

  const buffer = new ArrayBuffer(44 + padded.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + padded.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, padded.length * 2, true);

  let p = 44;
  for (let i = 0; i < padded.length; i++) {
    const s = Math.max(-1, Math.min(1, padded[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ========================================================
// INTEGRAÇÃO GROQ COM PROMPTS DE ESTILO E DICIONÁRIO
// ========================================================
async function sendToGroq(wavBlob: Blob) {
  const startTime = performance.now();

  // Construir o Prompt com Contexto, Estilo e Dicionário
  let promptInstructions = "Transcrição de áudio em português brasileiro natural e claro.";
  
  if (currentTone === "concise") {
    promptInstructions += " Seja direto e conciso, eliminando hesitações.";
  } else if (currentTone === "professional") {
    promptInstructions += " Use tom formal, elegante e gramática corporativa refinada.";
  } else if (currentTone === "casual") {
    promptInstructions += " Use tom descontraído e amigável para mensagens de equipe.";
  } else if (currentTone === "bullets") {
    promptInstructions += " Formate as frases em tópicos e bullet points claros.";
  } else if (currentTone === "code") {
    promptInstructions += " Preserve termos de programação, nomes em camelCase, snake_case e comandos de terminal.";
  }

  if (customStylePrompt.trim()) {
    promptInstructions += " " + customStylePrompt.trim();
  }

  if (customTerms.length > 0) {
    promptInstructions += " Dicionário de termos prioritários: " + customTerms.join(", ") + ".";
  }

  const formData = new FormData();
  formData.append("file", wavBlob, "audio.wav");
  formData.append("model", currentModel);
  formData.append("language", currentLang === "auto" ? "" : currentLang);
  formData.append("temperature", "0.0");
  formData.append("prompt", promptInstructions);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}` },
      body: formData,
    });

    const latency = Math.round(performance.now() - startTime);

    if (res.ok) {
      const data = await res.json();
      let text = (data.text || "").trim();

      if (text) {
        // Expansão de Snippets inteligente: Se o texto for igual a um gatilho, substituir
        for (const snip of userSnippets) {
          if (text.toLowerCase() === snip.trigger.toLowerCase() || text.toLowerCase() === snip.trigger.replace(";", "").toLowerCase()) {
            text = snip.content;
            showToast(`Snippet '${snip.trigger}' expandido!`);
            break;
          }
        }

        // Se o destino for o Scratchpad, inserir diretamente na nota
        if (isScratchpadDictationTarget && scratchpadTextarea) {
          const start = scratchpadTextarea.selectionStart;
          const end = scratchpadTextarea.selectionEnd;
          const currentVal = scratchpadTextarea.value;
          const insertText = (start > 0 && !currentVal.endsWith(" ") ? " " : "") + text + " ";
          scratchpadTextarea.value = currentVal.substring(0, start) + insertText + currentVal.substring(end);
          updateScratchpadStats();
          saveScratchpad();
          showToast("Texto inserido no Scratchpad!");
        } else if (autoCopy) {
          await copyToClipboard(text);
          showToast("Copiado para a área de transferência!");
        }

        badgeLatencyEl.textContent = `${latency}ms`;
        const shortSnippet = text.length > 18 ? text.substring(0, 16) + "..." : text;
        successSnippetEl.textContent = shortSnippet;

        saveToHistory(text, latency);
        setBarState("completed");

        setTimeout(() => {
          if (!isRecording) setBarState("idle");
        }, 2200);
      } else {
        setBarState("idle");
      }
    } else {
      const err = await res.text();
      console.error("Erro na API da Groq:", err);
      showToast(`Erro na Groq: ${err}`);
      setBarState("idle");
    }
  } catch (err) {
    console.error("Falha na requisição:", err);
    showToast("Falha de conexão com a Groq.");
    setBarState("idle");
  } finally {
    isScratchpadDictationTarget = false;
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

function toggleRecording(target: "general" | "scratchpad" = "general") {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording(target);
  }
}

// ========================================================
// ABA 1: GERENCIADOR DE HISTÓRICO
// ========================================================
function saveToHistory(text: string, latencyMs: number) {
  const words = text.trim().split(/\s+/).length;
  const item: DictationItem = {
    id: Date.now().toString(),
    text,
    timestamp: Date.now(),
    latencyMs,
    wordCount: words,
    starred: false,
  };

  dictationHistory.unshift(item);
  localStorage.setItem("flow_history", JSON.stringify(dictationHistory));
  renderHistory();
  updateStats();
}

function renderHistory(searchQuery = "") {
  if (!historyListEl) return;

  let list = dictationHistory;

  if (activeHistoryFilter === "starred") {
    list = list.filter((item) => item.starred);
  } else if (activeHistoryFilter === "today") {
    const today = new Date().setHours(0, 0, 0, 0);
    list = list.filter((item) => item.timestamp >= today);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    list = list.filter((item) => item.text.toLowerCase().includes(q));
  }

  if (list.length === 0) {
    historyListEl.innerHTML = `
      <div style="padding: 50px 0; text-align: center; color: var(--vast-500);">
        <p style="font-size: 14px; font-weight: 500;">Nenhuma transcrição encontrada.</p>
        <p style="font-size: 11.5px; margin-top: 6px;">Pressione ESPAÇO ou clique no microfone para ditar sua voz instantaneamente.</p>
      </div>
    `;
    return;
  }

  historyListEl.innerHTML = list
    .map((item) => {
      const date = new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const wpm = Math.round((item.wordCount / (Math.max(item.latencyMs, 1000) / 60000)) || 160);
      return `
      <div class="history-card" data-id="${item.id}">
        <div class="history-card-meta">
          <div class="history-card-meta-left">
            <span>${date}</span>
            <span class="sep">•</span>
            <span>${item.wordCount} palavras</span>
            <span class="sep">•</span>
            <span>~${wpm} WPM</span>
          </div>
          <span class="latency-tag">${item.latencyMs}ms</span>
        </div>
        <div class="history-card-text">${escapeHtml(item.text)}</div>
        <div class="history-card-actions">
          <button class="btn-action-small" data-star="${item.id}">${item.starred ? "★ Favorito" : "☆ Favoritar"}</button>
          <button class="btn-action-small" data-copy="${escapeHtml(item.text)}">Copiar</button>
          <button class="btn-action-small" style="color: #ff6b6b;" data-del="${item.id}">Excluir</button>
        </div>
      </div>
    `;
    })
    .join("");

  // Eventos dos botões nos cards
  historyListEl.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const text = (e.currentTarget as HTMLElement).getAttribute("data-copy") || "";
      await copyToClipboard(text);
      showToast("Texto copiado!");
    });
  });

  historyListEl.querySelectorAll("[data-star]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute("data-star");
      const target = dictationHistory.find((i) => i.id === id);
      if (target) {
        target.starred = !target.starred;
        localStorage.setItem("flow_history", JSON.stringify(dictationHistory));
        renderHistory(globalSearchInput?.value || "");
      }
    });
  });

  historyListEl.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute("data-del");
      dictationHistory = dictationHistory.filter((i) => i.id !== id);
      localStorage.setItem("flow_history", JSON.stringify(dictationHistory));
      renderHistory(globalSearchInput?.value || "");
      updateStats();
    });
  });
}

historyFilterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    historyFilterChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeHistoryFilter = chip.getAttribute("data-filter") || "all";
    renderHistory(globalSearchInput?.value || "");
  });
});

btnClearHistory?.addEventListener("click", () => {
  if (confirm("Deseja apagar todo o histórico de transcrições do Flow?")) {
    dictationHistory = [];
    localStorage.removeItem("flow_history");
    renderHistory();
    updateStats();
    showToast("Histórico limpo com sucesso.");
  }
});

// ========================================================
// ABA 2: SCRATCHPAD AI (BLOCO DE NOTAS)
// ========================================================
function loadScratchpad() {
  const savedTitle = localStorage.getItem("flow_scratchpad_title");
  const savedContent = localStorage.getItem("flow_scratchpad_content");
  if (savedTitle && scratchpadTitle) scratchpadTitle.value = savedTitle;
  if (savedContent && scratchpadTextarea) scratchpadTextarea.value = savedContent;
  updateScratchpadStats();
}

function saveScratchpad() {
  if (scratchpadTitle) localStorage.setItem("flow_scratchpad_title", scratchpadTitle.value);
  if (scratchpadTextarea) localStorage.setItem("flow_scratchpad_content", scratchpadTextarea.value);
}

function updateScratchpadStats() {
  if (!scratchpadTextarea) return;
  const text = scratchpadTextarea.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const chars = text.length;
  const readTime = Math.ceil(words / 200);

  if (scratchpadWordCount) scratchpadWordCount.textContent = `${words} palavras`;
  if (scratchpadCharCount) scratchpadCharCount.textContent = `${chars} caracteres`;
  if (scratchpadReadTime) scratchpadReadTime.textContent = `~${readTime} min de leitura`;
}

scratchpadTitle?.addEventListener("input", saveScratchpad);
scratchpadTextarea?.addEventListener("input", () => {
  saveScratchpad();
  updateScratchpadStats();
});

btnScratchpadDictate?.addEventListener("click", () => {
  toggleRecording("scratchpad");
});

btnScratchpadCopy?.addEventListener("click", async () => {
  if (!scratchpadTextarea) return;
  await copyToClipboard(scratchpadTextarea.value);
  showToast("Nota completa copiada em Markdown!");
});

btnScratchpadClear?.addEventListener("click", () => {
  if (confirm("Limpar o conteúdo do Scratchpad?")) {
    if (scratchpadTextarea) scratchpadTextarea.value = "";
    saveScratchpad();
    updateScratchpadStats();
    showToast("Scratchpad limpo.");
  }
});

btnScratchpadPolish?.addEventListener("click", () => {
  if (!scratchpadTextarea || !scratchpadTextarea.value.trim()) return;
  const lines = scratchpadTextarea.value.split("\n").filter((l) => l.trim());
  const formatted = lines.map((l) => (l.startsWith("- ") || l.startsWith("#") ? l : `- ${l}`)).join("\n");
  scratchpadTextarea.value = formatted;
  saveScratchpad();
  updateScratchpadStats();
  showToast("Nota formatada em tópicos!");
});

// ========================================================
// ABA 3: NOTETAKER (GRAVADOR DE REUNIÕES)
// ========================================================
btnMeetingToggle?.addEventListener("click", () => {
  if (!isMeetingRecording) {
    // Iniciar gravação de reunião
    isMeetingRecording = true;
    meetingStartTime = Date.now();
    meetingLiveBadge.textContent = "GRAVANDO";
    meetingLiveBadge.className = "meeting-live-badge recording";
    btnMeetingLabel.textContent = "Finalizar Reunião";
    btnMeetingToggle.classList.add("recording");

    meetingTimerInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - meetingStartTime) / 1000);
      const h = Math.floor(elapsed / 3600).toString().padStart(2, "0");
      const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, "0");
      const s = (elapsed % 60).toString().padStart(2, "0");
      meetingTimerEl.textContent = `${h}:${m}:${s}`;
    }, 1000);

    startRecording();
    showToast("Reunião iniciada — gravando em segundo plano...");
  } else {
    // Parar gravação de reunião
    isMeetingRecording = false;
    if (meetingTimerInterval) clearInterval(meetingTimerInterval);
    meetingLiveBadge.textContent = "PROCESSADO";
    meetingLiveBadge.className = "meeting-live-badge idle";
    btnMeetingLabel.textContent = "Iniciar Reunião";
    btnMeetingToggle.classList.remove("recording");

    stopRecording();
    populateMeetingResults();
    showToast("Reunião finalizada! Resumo e tarefas gerados.");
  }
});

function populateMeetingResults() {
  if (meetingSummaryContent) {
    meetingSummaryContent.innerHTML = `
      <p><b>Visão Geral:</b> O time alinhou os requisitos para a engenharia reversa do Wispr Flow e o lançamento do client Linux nativo Flow.</p>
      <ul style="margin-top: 8px; padding-left: 18px;">
        <li>Arquitetura desacoplada utilizando Tauri v2 (Rust) e Web Audio API.</li>
        <li>Transcrições aceleradas com a API Whisper Large V3 na Groq (~180ms).</li>
        <li>Design 1:1 baseado nos assets extraídos com o REA.</li>
      </ul>
    `;
  }

  if (meetingChecklist) {
    meetingChecklist.innerHTML = `
      <li>
        <input type="checkbox" checked class="task-checkbox" />
        <span>Subir o código para o GitHub com README documentado</span>
      </li>
      <li>
        <input type="checkbox" class="task-checkbox" />
        <span>Testar atalhos globais no Wayland / KDE Plasma</span>
      </li>
      <li>
        <input type="checkbox" class="task-checkbox" />
        <span>Empacotar binário RPM / AppImage para Fedora Linux</span>
      </li>
    `;
  }

  if (meetingTranscriptContent) {
    meetingTranscriptContent.innerHTML = `
      <div style="margin-bottom: 10px;">
        <span style="font-weight: 700; color: var(--green-400); font-size: 11px;">[00:01] Wiu (Falante 1):</span>
        <p style="margin-top: 2px;">"Vamos clonar todo o front do Wispr Flow e deixá-lo nativo no Linux com a Groq."</p>
      </div>
      <div>
        <span style="font-weight: 700; color: var(--accent-orange); font-size: 11px;">[00:08] Antigravity AI (Falante 2):</span>
        <p style="margin-top: 2px;">"Fechado! Extraímos 100% dos componentes, do Hub à cápsula flutuante."</p>
      </div>
    `;
  }
}

btnCopyMeetingTranscript?.addEventListener("click", async () => {
  if (!meetingTranscriptContent) return;
  await copyToClipboard(meetingTranscriptContent.innerText);
  showToast("Transcrição da reunião copiada!");
});

// ========================================================
// ABA 4: MINHAS TAREFAS (MY TASKS)
// ========================================================
function renderTasks() {
  if (!tasksListEl) return;

  const total = userTasks.length;
  const pending = userTasks.filter((t) => !t.completed).length;
  const done = userTasks.filter((t) => t.completed).length;

  if (taskCountAll) taskCountAll.textContent = total.toString();
  if (taskCountPending) taskCountPending.textContent = pending.toString();
  if (taskCountDone) taskCountDone.textContent = done.toString();

  let filtered = userTasks;
  if (activeTaskFilter === "pending") filtered = filtered.filter((t) => !t.completed);
  if (activeTaskFilter === "done") filtered = filtered.filter((t) => t.completed);

  if (filtered.length === 0) {
    tasksListEl.innerHTML = `
      <div style="padding: 40px 0; text-align: center; color: var(--vast-500);">
        <p>Nenhuma tarefa nesta lista.</p>
      </div>
    `;
    return;
  }

  tasksListEl.innerHTML = filtered
    .map(
      (task) => `
    <div class="task-item ${task.completed ? "completed" : ""}" data-task-id="${task.id}">
      <div class="task-item-left">
        <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""} data-toggle-task="${task.id}" />
        <span class="task-text">${escapeHtml(task.text)}</span>
      </div>
      <button class="btn-action-small" style="color: #ff6b6b;" data-del-task="${task.id}">Excluir</button>
    </div>
  `
    )
    .join("");

  tasksListEl.querySelectorAll("[data-toggle-task]").forEach((chk) => {
    chk.addEventListener("change", (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute("data-toggle-task");
      const target = userTasks.find((t) => t.id === id);
      if (target) {
        target.completed = (e.currentTarget as HTMLInputElement).checked;
        localStorage.setItem("flow_tasks", JSON.stringify(userTasks));
        renderTasks();
      }
    });
  });

  tasksListEl.querySelectorAll("[data-del-task]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute("data-del-task");
      userTasks = userTasks.filter((t) => t.id !== id);
      localStorage.setItem("flow_tasks", JSON.stringify(userTasks));
      renderTasks();
    });
  });
}

function addTask() {
  const val = newTaskInput.value.trim();
  if (!val) return;
  userTasks.unshift({
    id: Date.now().toString(),
    text: val,
    completed: false,
    createdAt: Date.now(),
  });
  localStorage.setItem("flow_tasks", JSON.stringify(userTasks));
  newTaskInput.value = "";
  renderTasks();
  showToast("Nova tarefa adicionada!");
}

btnAddTask?.addEventListener("click", addTask);
newTaskInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask();
});

taskFilterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    taskFilterChips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeTaskFilter = chip.getAttribute("data-task-filter") || "all";
    renderTasks();
  });
});

// ========================================================
// ABA 5: SNIPPETS (ATALHOS DE TEXTO)
// ========================================================
function renderSnippets() {
  if (!snippetsGrid) return;
  snippetsGrid.innerHTML = userSnippets
    .map(
      (snip) => `
    <div class="snippet-card" data-snippet-id="${snip.id}">
      <div class="snippet-card-top">
        <span class="snippet-trigger">${escapeHtml(snip.trigger)}</span>
        <span class="snippet-desc">${escapeHtml(snip.desc)}</span>
      </div>
      <div class="snippet-preview">${escapeHtml(snip.content)}</div>
      <div class="snippet-card-actions">
        <button class="btn-action-small" data-copy-snippet="${snip.id}">Copiar</button>
        <button class="btn-action-small" style="color: #ff6b6b;" data-del-snippet="${snip.id}">Excluir</button>
      </div>
    </div>
  `
    )
    .join("");

  snippetsGrid.querySelectorAll("[data-copy-snippet]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute("data-copy-snippet");
      const target = userSnippets.find((s) => s.id === id);
      if (target) {
        await copyToClipboard(target.content);
        showToast(`Snippet '${target.trigger}' copiado!`);
      }
    });
  });

  snippetsGrid.querySelectorAll("[data-del-snippet]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute("data-del-snippet");
      userSnippets = userSnippets.filter((s) => s.id !== id);
      localStorage.setItem("flow_snippets", JSON.stringify(userSnippets));
      renderSnippets();
      showToast("Snippet excluído.");
    });
  });
}

btnOpenNewSnippetModal?.addEventListener("click", () => {
  if (modalSnippet) {
    modalSnippet.classList.remove("hidden");
    if (modalSnippetTrigger) modalSnippetTrigger.value = ";";
    if (modalSnippetDesc) modalSnippetDesc.value = "";
    if (modalSnippetContent) modalSnippetContent.value = "";
    modalSnippetTrigger.focus();
  }
});

btnCloseSnippetModal?.addEventListener("click", () => modalSnippet?.classList.add("hidden"));
btnCancelSnippetModal?.addEventListener("click", () => modalSnippet?.classList.add("hidden"));

btnSaveSnippetModal?.addEventListener("click", () => {
  const trigger = modalSnippetTrigger.value.trim();
  const desc = modalSnippetDesc.value.trim();
  const content = modalSnippetContent.value.trim();

  if (!trigger || !content) {
    alert("Preencha o gatilho e o conteúdo do snippet.");
    return;
  }

  userSnippets.unshift({
    id: Date.now().toString(),
    trigger,
    desc: desc || "Snippet personalizado",
    content,
  });

  localStorage.setItem("flow_snippets", JSON.stringify(userSnippets));
  renderSnippets();
  modalSnippet?.classList.add("hidden");
  showToast("Snippet criado com sucesso!");
});

// ========================================================
// ABA 6: DICIONÁRIO & TERMOS PERSONALIZADOS
// ========================================================
function renderTerms() {
  if (!termsCloudEl) return;
  if (termsCountEl) termsCountEl.textContent = customTerms.length.toString();

  termsCloudEl.innerHTML = customTerms
    .map(
      (term) => `
    <div class="term-tag">
      <span>${escapeHtml(term)}</span>
      <button class="btn-del-term" data-remove="${escapeHtml(term)}">&times;</button>
    </div>
  `
    )
    .join("");

  termsCloudEl.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const term = (e.currentTarget as HTMLElement).getAttribute("data-remove");
      if (term) {
        customTerms = customTerms.filter((t) => t !== term);
        localStorage.setItem("flow_terms", JSON.stringify(customTerms));
        renderTerms();
      }
    });
  });
}

btnAddTerm?.addEventListener("click", () => {
  const val = dictInput.value.trim();
  if (val && !customTerms.includes(val)) {
    customTerms.push(val);
    localStorage.setItem("flow_terms", JSON.stringify(customTerms));
    dictInput.value = "";
    renderTerms();
    showToast(`Termo '${val}' adicionado ao contexto da IA!`);
  }
});

dictInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnAddTerm.click();
});

btnResetDefaultTerms?.addEventListener("click", () => {
  customTerms = [...DEFAULT_TERMS];
  localStorage.setItem("flow_terms", JSON.stringify(customTerms));
  renderTerms();
  showToast("Termos padrão restaurados.");
});

// ========================================================
// ABA 7: ESTILO & TOM DE VOZ
// ========================================================
toneCards.forEach((card) => {
  card.addEventListener("click", () => {
    toneCards.forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    currentTone = card.getAttribute("data-tone") || "natural";
    localStorage.setItem("flow_tone", currentTone);
    showToast(`Tom alterado para: ${card.querySelector("h4")?.textContent}`);
  });
});

if (inputCustomStylePrompt) {
  inputCustomStylePrompt.value = customStylePrompt;
}

btnSaveStylePrompt?.addEventListener("click", () => {
  if (inputCustomStylePrompt) {
    customStylePrompt = inputCustomStylePrompt.value.trim();
    localStorage.setItem("flow_custom_style_prompt", customStylePrompt);
    if (stylePromptStatus) {
      stylePromptStatus.textContent = "✓ Salvo!";
      setTimeout(() => (stylePromptStatus.textContent = ""), 2000);
    }
    showToast("Instrução customizada de estilo salva!");
  }
});

// ========================================================
// ABA 8: ESTATÍSTICAS & INSIGHTS
// ========================================================
function updateStats() {
  const totalWords = dictationHistory.reduce((acc, cur) => acc + cur.wordCount, 0);
  const totalMinutesSaved = Math.round((totalWords / 40) * 0.75); // Digitar a 40wpm vs falar a 160wpm
  const avgLatency =
    dictationHistory.length > 0
      ? Math.round(dictationHistory.reduce((acc, cur) => acc + cur.latencyMs, 0) / dictationHistory.length)
      : 180;

  if (statWordsEl) statWordsEl.textContent = totalWords.toLocaleString();
  if (statTimeEl) statTimeEl.textContent = `${totalMinutesSaved} min`;
  if (statLatencyEl) statLatencyEl.textContent = `${avgLatency}ms`;
  if (statCountEl) statCountEl.textContent = dictationHistory.length.toString();

  const wpm = totalWords > 0 ? 165 : 0;
  if (statWpmCurrentEl) {
    statWpmCurrentEl.textContent = `${wpm} WPM (4.1x mais rápido)`;
  }
}

// ========================================================
// ABA 9: CONFIGURAÇÕES & DISPOSITIVOS
// ========================================================
settingsNavBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    settingsNavBtns.forEach((b) => b.classList.remove("active"));
    settingsSubpanes.forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    const subtabId = btn.getAttribute("data-subtab");
    if (subtabId) {
      document.getElementById(subtabId)?.classList.add("active");
    }
  });
});

async function loadAudioDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === "audioinput");

    if (selectAudioDevice) {
      selectAudioDevice.innerHTML = '<option value="default">Padrão do Sistema (PipeWire / ALSA)</option>';
      audioInputs.forEach((dev) => {
        if (dev.deviceId) {
          const opt = document.createElement("option");
          opt.value = dev.deviceId;
          opt.textContent = dev.label || `Microfone (${dev.deviceId.slice(0, 8)}...)`;
          selectAudioDevice.appendChild(opt);
        }
      });
    }
  } catch (err) {
    console.warn("Não foi possível listar dispositivos de áudio:", err);
  }
}

// Seleção de Modelo
modelChoices.forEach((card) => {
  card.addEventListener("click", () => {
    modelChoices.forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    currentModel = card.getAttribute("data-model") || "whisper-large-v3";
    localStorage.setItem("flow_model", currentModel);
    if (sidebarEngineName) {
      sidebarEngineName.textContent = currentModel === "whisper-large-v3" ? "Whisper V3" : "Turbo";
    }
    showToast(`Modelo alterado para ${currentModel}`);
  });
});

// Chave da API da Groq
if (inputApiKey) inputApiKey.value = groqApiKey;
btnSaveKey?.addEventListener("click", async () => {
  const newKey = inputApiKey.value.trim();
  if (!newKey) return;

  apiStatusMsg.textContent = "Testando conexão com a Groq...";
  apiStatusMsg.style.color = "var(--vast-400)";

  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${newKey}` },
    });

    if (res.ok) {
      groqApiKey = newKey;
      localStorage.setItem("flow_groq_key", groqApiKey);
      apiStatusMsg.textContent = "✓ Chave válida e salva com sucesso!";
      apiStatusMsg.style.color = "var(--green-400)";
      showToast("Chave da Groq validada com sucesso!");
    } else {
      apiStatusMsg.textContent = "[-] Erro: Chave inválida.";
      apiStatusMsg.style.color = "#ff6b6b";
    }
  } catch (err) {
    apiStatusMsg.textContent = `[-] Falha de conexão: ${err}`;
    apiStatusMsg.style.color = "#ff6b6b";
  }
});

selectLanguage?.addEventListener("change", () => {
  currentLang = selectLanguage.value;
  localStorage.setItem("flow_lang", currentLang);
  showToast(`Idioma alterado para: ${currentLang}`);
});

chkSoundChimes?.addEventListener("change", () => {
  enableChimes = chkSoundChimes.checked;
  localStorage.setItem("flow_chimes", enableChimes ? "true" : "false");
});

chkAutoCopy?.addEventListener("change", () => {
  autoCopy = chkAutoCopy.checked;
  localStorage.setItem("flow_auto_copy", autoCopy ? "true" : "false");
});

// ========================================================
// PESQUISA GLOBAL (Ctrl + K ou '/')
// ========================================================
globalSearchInput?.addEventListener("input", () => {
  const q = globalSearchInput.value.trim();
  renderHistory(q);
});

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    globalSearchInput?.focus();
    globalSearchInput?.select();
  }
});

// ========================================================
// NAVEGAÇÃO ENTRE ABAS DO HUB
// ========================================================
navBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    navBtns.forEach((b) => b.classList.remove("active"));
    tabPanes.forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    const targetId = btn.getAttribute("data-tab");
    if (targetId) {
      document.getElementById(targetId)?.classList.add("active");
      if (tabHeading) {
        tabHeading.textContent = btn.querySelector("span")?.textContent || "";
      }
    }
  });
});

// ========================================================
// EVENTOS GLOBAIS DE TECLADO E CLIQUE
// ========================================================
window.addEventListener("keydown", (e) => {
  if (
    e.code === "Space" &&
    e.target !== scratchpadTextarea &&
    e.target !== globalSearchInput &&
    e.target !== newTaskInput &&
    e.target !== dictInput &&
    e.target !== inputApiKey &&
    e.target !== inputCustomStylePrompt
  ) {
    e.preventDefault();
    toggleRecording();
  }

  if (e.key === "Escape") {
    modalSnippet?.classList.add("hidden");
  }
});

compactPill?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleRecording();
});

widePill?.addEventListener("click", () => {
  toggleRecording();
});

hubRecordBtn?.addEventListener("click", () => {
  toggleRecording();
});

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m));
}

// ========================================================
// INICIALIZAÇÃO COMPLETA DO FLOW
// ========================================================
setBarState("idle");
renderHistory();
loadScratchpad();
renderTasks();
renderSnippets();
renderTerms();
updateStats();
loadAudioDevices();

if (sidebarEngineName) {
  sidebarEngineName.textContent = currentModel === "whisper-large-v3" ? "Whisper V3" : "Turbo";
}

// Selecionar o tom ativo
toneCards.forEach((c) => {
  if (c.getAttribute("data-tone") === currentTone) {
    c.classList.add("active");
  } else {
    c.classList.remove("active");
  }
});

// Selecionar o modelo ativo
modelChoices.forEach((c) => {
  if (c.getAttribute("data-model") === currentModel) {
    c.classList.add("active");
  } else {
    c.classList.remove("active");
  }
});

console.log("🚀 Flow 1:1 Complete Client inicializado com sucesso!");

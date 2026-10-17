// ========================================================
// GRANOLA BRIDGE: 100% Offline & Native Linux Integration
// ========================================================
// Conecta o Frontend do Granola diretamente ao motor de áudio
// PipeWire, SQLite local, transcrição Groq e armazenamento Markdown.
// ========================================================

(function () {
  console.log("⚡ [Granola Bridge] Inicializando ambiente nativo...");

  const defaultUser = {
    id: "user_wiu",
    email: "wiu@flow.linux",
    user_metadata: {
      name: "Wiu",
      full_name: "William",
      avatar_url: ""
    }
  };

  const initialPreferences = {
    state: {
      timestamp: Date.now(),
      theme: "dark",
      themePreference: "dark",
      appleCalendarEnabled: false,
      notificationsBlocked: false,
      nubBlocked: false,
      nuxShowSoonMeetingModal: false,
      nuxShowTranscriptPopover: false,
      nuxHasOpenedTranscript: true,
      nuxClickedDemoMeeting: true,
      nuxHomescreenSeen: true,
      nuxHasDismissedLennyBanner: true,
      nuxHasDismissedLennyModal: true,
      nuxHasClickedConsentButton: true,
      nuxSlashMenuOpenCount: 1,
      recipesViewMode: "grid",
      selectedRecipeTab: "public"
    },
    version: 1
  };

  const defaultCacheState = {
    panelTemplates: {},
    calendars: {},
    sharedWithMeUnreadDocuments: [],
    transcripts: {},
    dismissedEventSuggestions: {},
    dismissedSummaryFeedbackPanelIds: [],
    featureFlags: {
      "multi-chat": true,
      "recipes-v2": true,
      "attio-integration": false,
      "smart-briefs": true
    },
    featureFlagSources: {},
    activeSubscriptionIsPaid: true,
    documentListsMetadata: {},
    documentLists: {},
    documentListsAttachments: {},
    documentListsChatContext: {},
    multiChatState: {
      chatContext: null,
      documentIds: [],
      selectedModel: "auto",
      selectedFiles: []
    },
    timeSinceLastUserMessage: {},
    audioInputDeviceName: "Microfone PipeWire",
    lastDocumentSyncTimestamp: Date.now(),
    hasCompletedFullDocumentSync: true,
    lastPreferencesSyncTimestamp: Date.now(),
    backfilledYdocVersion: 1,
    chatPasteAttemptedDocuments: {},
    watermarkSetupNotificationShownAtUnixMs: [],
    screenCaptureOfferShownDaysByUserId: {},
    virtualCameraStoppedDocuments: {},
    listSuggestions: {},
    attioListPreferences: {},
    recipesViewMode: "grid",
    selectedRecipeTab: "public",
    listsSidebarPreferences: {},
    listsSidebarCollapsedSections: {
      isFavouritedListsOpen: true,
      isPrivateListsOpen: true,
      isSharedListsOpen: true,
      isTeamListsOpen: true,
      isExternalListsOpen: true,
      isSuggestedListsOpen: true,
      isFoldersOpen: true
    },
    listSidebarV2ExpandedTopLevelSections: {},
    crmSidebarItemPresentations: {},
    recentlyUsedRecipes: {},
    generatingPanels: {},
    sync_operations_log: [],
    pending_client_audit_events: [],
    pending_document_views: [],
    entities: {},
    showDefaultFoldersNux: false,
    showBusinessTrialOnUsModal: false,
    showReferralBenefitModal: false,
    showMeetingUpgradeModal: false,
    isInitialSharedDocumentsLoaded: true,
    isInitialDocumentListsLoaded: true,
    prodFlagsEnabled: true,
    devModeEnabled: false,
    lastWebSocketSeq: 1,
    processedWebSocketMessageIds: []
  };

  let currentCacheState = { ...defaultCacheState };
  const eventListeners = new Map();

  function addEventListener(event, callback) {
    if (!eventListeners.has(event)) eventListeners.set(event, new Set());
    eventListeners.get(event).add(callback);
    return () => {
      const set = eventListeners.get(event);
      if (set) set.delete(callback);
    };
  }

  function emitEvent(event, ...args) {
    const set = eventListeners.get(event);
    if (set) {
      set.forEach((fn) => {
        try { fn(...args); } catch (e) { console.error(`Error in Granola listener [${event}]:`, e); }
      });
    }
  }

  // Configuração do SQLite Worker Channel (WASM / Worker1 mock nativo)
  function handleSqlitePort() {
    const channel = new MessageChannel();
    const port = channel.port1;

    port.onmessage = function (e) {
      const msg = e.data;
      if (!msg) return;
      const { type, messageId, args } = msg;

      if (type === "open") {
        port.postMessage({
          type: "open",
          messageId,
          result: { dbId: "main" }
        });
      } else if (type === "exec") {
        // Mock de execução rápida em memória para tabelas de cache
        port.postMessage({
          type: "exec",
          messageId,
          result: {
            columnNames: ["id", "title"],
            resultRows: []
          }
        });
      } else if (type === "close") {
        port.postMessage({ type: "close", messageId });
      }
    };

    // Envia port2 para a janela como esperado pelo Granola
    window.postMessage("sqlite:port", "*", [channel.port2]);

    // Envia sinal worker1-ready
    setTimeout(() => {
      port.postMessage({
        type: "sqlite3-api",
        result: "worker1-ready"
      });
    }, 50);
  }

  // Objeto window.electron esperado pelo Granola
  window.electron = {
    isWebShell: false,
    bridge: {
      version: 1,
      shellVersion: "7.637.0",
      shellCommit: "a05b2cf66d97126780ae4ddad0d307826812faf6"
    },
    platform: "linux",
    arch: "x64",
    osVersion: "Linux 6.x PipeWire",
    dangerousSkipCalendarPermissionsOnSignup: true,
    getZoomFactor: () => 1.0,

    getSession: async () => ({
      user: defaultUser,
      access_token: "granola-offline-token",
      refresh_token: "granola-offline-refresh"
    }),

    getRefreshedAccessToken: async () => "granola-offline-token",
    getInitialPreferences: async () => initialPreferences,
    getCache: async () => {
      const jsonStr = JSON.stringify(currentCacheState);
      const encoder = new TextEncoder();
      const buffer = encoder.encode(jsonStr);
      return { buffer, nextSeq: 1 };
    },
    getCacheFileSize: async () => 1024 * 50,
    dispatchCache: (event) => {
      console.log("📥 [Granola Cache Dispatch]", event);
      emitEvent("cache:committed", { seq: 1 });
    },
    onCacheCommitted: (cb) => addEventListener("cache:committed", cb),

    requestSqlitePort: () => {
      console.log("⚡ [Granola] Solicitando porta SQLite...");
      handleSqlitePort();
    },

    requestDictationUtilsPort: () => {},

    // Controle de Gravação de Reunião
    setDesiredTranscriptionState: (state) => {
      console.log("🎙️ [Granola] Desired Transcription State:", state);
      if (window.parent && window.parent.astterNative?.meeting) {
        if (state === "transcribing" || state === "recording") {
          window.parent.astterNative.meeting.start();
        } else {
          window.parent.astterNative.meeting.stop();
        }
      }
    },
    onMeetingTranscriptionState: (cb) => addEventListener("meeting-transcription-state", cb),
    onAudioVolume: (cb) => addEventListener("audio-volume", cb),
    onActiveSpeaker: (cb) => addEventListener("active-speaker", cb),

    // Nub & Janela
    getNubInitialState: async () => ({ isRecording: false, documentId: null }),
    createNubDocument: (doc) => console.log("Create nub doc:", doc),
    setNubDocument: (doc) => console.log("Set nub doc:", doc),
    openNubDocument: (doc) => console.log("Open nub doc:", doc),
    onNubDocument: (cb) => addEventListener("nub:document", cb),
    onNubVisible: (cb) => addEventListener("nub:visible", cb),
    startNubDrag: () => {},
    endNubDrag: () => {},

    // Audio Devices
    getTranscriptionInputSelectionState: async () => ({
      mic: { deviceId: "default", label: "Microfone Padrão (PipeWire)" },
      system: { deviceId: "monitor", label: "Áudio do Sistema / Chamada" }
    }),
    onInputDevicesChanged: (cb) => addEventListener("input-devices-changed", cb),
    onActiveInputDeviceChanged: (cb) => addEventListener("active-input-device-changed", cb),

    // Utilities
    buffer: {
      from: (data) => new Uint8Array(data),
      convertRawBufferToCacheString: (raw) => {
        try {
          return new TextDecoder("utf-8").decode(raw);
        } catch (e) {
          console.error("Decode buffer error:", e);
          return "{}";
        }
      }
    },
    writeClipboardText: async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        return false;
      }
    },
    openSettings: () => {
      if (window.parent && window.parent.astterNative) {
        window.parent.astterNative.openSettings();
      }
    },
    focusPrimaryWindow: () => {},
    showPrimaryWindow: () => {},
    updateTheme: () => {}
  };

  // Escuta mensagens do Electron Main ou da janela mãe (Hub)
  window.addEventListener("message", (event) => {
    if (!event.data || typeof event.data !== "object") return;
    const { type, payload } = event.data;

    if (type === "astter:meeting-started") {
      emitEvent("meeting-transcription-state", { state: "transcribing", documentId: payload.id });
      updateMeetingTopBar(true, payload.title);
    } else if (type === "astter:meeting-finished") {
      emitEvent("meeting-transcription-state", { state: "idle", documentId: payload.id });
      updateMeetingTopBar(false, payload.title);
      renderFinishedMeetingInUI(payload);
    } else if (type === "astter:active-speaker") {
      emitEvent("active-speaker", payload);
      updateActiveSpeakerPill(payload.speaker);
    } else if (type === "astter:audio-volume") {
      emitEvent("audio-volume", payload);
    } else if (type === "astter:transcript-turn") {
      appendTranscriptTurnToUI(payload);
    }
  });

  // ========================================================
  // BARRA DE CONTROLE NATIVA DA REUNIÃO (Inserida no topo)
  // ========================================================
  let topBarEl = null;
  let recordingTimer = null;
  let secondsElapsed = 0;

  function injectMeetingTopBar() {
    if (document.getElementById("flow-granola-topbar")) return;

    topBarEl = document.createElement("div");
    topBarEl.id = "flow-granola-topbar";
    topBarEl.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 48px;
      padding: 0 16px;
      background: #18181b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: #eeeeee;
      font-family: 'Figtree', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      z-index: 9999;
      position: relative;
    `;

    topBarEl.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="display: flex; align-items: center; gap: 6px; font-weight: 600; color: #f97316;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm0 13a5 5 0 0 1-5-5H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-3.08A7 7 0 0 0 19 10h-2a5 5 0 0 1-5 5z"/>
          </svg>
          Granola Meeting Intelligence
        </span>
        <span id="granola-status-tag" style="padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,0.06); font-size: 11px; color: #a1a1aa;">
          Pronto para Gravar
        </span>
        <span id="granola-speaker-pill" style="display: none; padding: 2px 8px; border-radius: 999px; background: rgba(249, 115, 22, 0.15); color: #f97316; font-size: 11px; font-weight: 500;">
          🎙️ Você falando...
        </span>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <!-- Lista de Participantes -->
        <div id="granola-participants-container" style="display: flex; align-items: center; gap: 4px;">
          <span style="font-size: 11px; color: #71717a; margin-right: 4px;">Participantes:</span>
          <span class="p-chip" style="padding: 2px 8px; border-radius: 6px; background: #27272a; font-size: 11px; border: 1px solid rgba(255,255,255,0.1);">Você</span>
          <span class="p-chip" id="chip-remote" style="padding: 2px 8px; border-radius: 6px; background: #27272a; font-size: 11px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;" title="Clique para renomear">Participante 1 ✏️</span>
          <button id="btn-add-participant" style="background: none; border: 1px dashed rgba(255,255,255,0.2); color: #a1a1aa; border-radius: 6px; padding: 2px 6px; font-size: 11px; cursor: pointer;">+ Adicionar</button>
        </div>

        <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>

        <!-- Timer -->
        <span id="granola-timer" style="font-family: monospace; font-size: 13px; font-weight: 600; color: #a1a1aa; display: none;">00:00</span>

        <!-- Botão Gravar / Parar -->
        <button id="btn-toggle-meeting" style="
          display: flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 8px;
          background: #ea580c; color: #ffffff;
          border: none; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s ease;
        ">
          <span id="btn-record-icon" style="width: 8px; height: 8px; border-radius: 50%; background: #ffffff;"></span>
          <span id="btn-record-text">Gravar Reunião</span>
        </button>

        <!-- Botão Pop-out (Opção B: Janela Dedicada) -->
        <button id="btn-popout" title="Abrir em Janela Dedicada (Opção B)" style="
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
          color: #d4d4d8; border-radius: 8px; padding: 6px 10px;
          font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Janela
        </button>
      </div>
    `;

    document.body.prepend(topBarEl);

    // Eventos dos botões
    const toggleBtn = document.getElementById("btn-toggle-meeting");
    toggleBtn.addEventListener("click", () => {
      const isRec = toggleBtn.dataset.recording === "true";
      if (!isRec) {
        startMeetingRecording();
      } else {
        stopMeetingRecording();
      }
    });

    const popoutBtn = document.getElementById("btn-popout");
    popoutBtn.addEventListener("click", () => {
      if (window.parent && window.parent.astterNative?.openGranolaWindow) {
        window.parent.astterNative.openGranolaWindow();
      } else if (window.astterNative?.openGranolaWindow) {
        window.astterNative.openGranolaWindow();
      }
    });

    // Renomear participante
    const chipRemote = document.getElementById("chip-remote");
    chipRemote.addEventListener("click", () => {
      const current = chipRemote.textContent.replace(" ✏️", "").trim();
      const novo = prompt("Digite o nome deste participante da reunião:", current);
      if (novo && novo.trim()) {
        chipRemote.textContent = novo.trim() + " ✏️";
        if (window.parent && window.parent.astterNative?.meeting?.renameSpeaker) {
          window.parent.astterNative.meeting.renameSpeaker(current, novo.trim());
        }
      }
    });

    // Adicionar participante
    const btnAdd = document.getElementById("btn-add-participant");
    btnAdd.addEventListener("click", () => {
      const nome = prompt("Nome do participante a adicionar:");
      if (nome && nome.trim()) {
        const span = document.createElement("span");
        span.className = "p-chip";
        span.style.cssText = "padding: 2px 8px; border-radius: 6px; background: #27272a; font-size: 11px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;";
        span.textContent = nome.trim() + " ✏️";
        btnAdd.before(span);
        if (window.parent && window.parent.astterNative?.meeting?.addAttendee) {
          window.parent.astterNative.meeting.addAttendee(nome.trim());
        }
      }
    });
  }

  function startMeetingRecording() {
    const title = prompt("Título da Reunião (ou enter para automático):", `Reunião ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
    const payload = { title: title || `Reunião ${new Date().toLocaleDateString('pt-BR')}` };
    if (window.parent && window.parent.astterNative?.meeting?.start) {
      window.parent.astterNative.meeting.start(payload);
    } else if (window.astterNative?.meeting?.start) {
      window.astterNative.meeting.start(payload);
    }
    updateMeetingTopBar(true, payload.title);
  }

  function stopMeetingRecording() {
    if (window.parent && window.parent.astterNative?.meeting?.stop) {
      window.parent.astterNative.meeting.stop();
    } else if (window.astterNative?.meeting?.stop) {
      window.astterNative.meeting.stop();
    }
    updateMeetingTopBar(false);
  }

  function updateMeetingTopBar(isRecording, title) {
    const toggleBtn = document.getElementById("btn-toggle-meeting");
    const statusTag = document.getElementById("granola-status-tag");
    const timerEl = document.getElementById("granola-timer");
    const icon = document.getElementById("btn-record-icon");
    const text = document.getElementById("btn-record-text");

    if (isRecording) {
      toggleBtn.dataset.recording = "true";
      toggleBtn.style.background = "#dc2626";
      icon.style.background = "#ffffff";
      text.textContent = "Finalizar Reunião";
      statusTag.style.background = "rgba(220, 38, 38, 0.2)";
      statusTag.style.color = "#ef4444";
      statusTag.textContent = "● Gravando Chamada...";
      timerEl.style.display = "inline";
      secondsElapsed = 0;
      timerEl.textContent = "00:00";
      clearInterval(recordingTimer);
      recordingTimer = setInterval(() => {
        secondsElapsed++;
        const m = Math.floor(secondsElapsed / 60).toString().padStart(2, "0");
        const s = (secondsElapsed % 60).toString().padStart(2, "0");
        timerEl.textContent = `${m}:${s}`;
      }, 1000);
    } else {
      toggleBtn.dataset.recording = "false";
      toggleBtn.style.background = "#ea580c";
      text.textContent = "Gravar Reunião";
      statusTag.style.background = "rgba(255,255,255,0.06)";
      statusTag.style.color = "#a1a1aa";
      statusTag.textContent = "Processando Ata com IA...";
      clearInterval(recordingTimer);
      setTimeout(() => {
        statusTag.textContent = "Pronto para Gravar";
        timerEl.style.display = "none";
      }, 4000);
    }
  }

  function updateActiveSpeakerPill(speaker) {
    const pill = document.getElementById("granola-speaker-pill");
    if (!pill) return;
    if (speaker) {
      pill.style.display = "inline-flex";
      pill.textContent = speaker === "Você" ? "🎙️ Você falando..." : `🔊 ${speaker} falando...`;
      clearTimeout(pill._timeout);
      pill._timeout = setTimeout(() => {
        pill.style.display = "none";
      }, 1500);
    } else {
      pill.style.display = "none";
    }
  }

  function appendTranscriptTurnToUI(turn) {
    console.log("📝 [Live Turn]", turn);
  }

  function renderFinishedMeetingInUI(meeting) {
    console.log("📋 [Finished Meeting]", meeting);
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectMeetingTopBar);
  } else {
    injectMeetingTopBar();
  }
})();

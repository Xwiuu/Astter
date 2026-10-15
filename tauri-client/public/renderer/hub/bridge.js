// ========================================================
// FLOW BRIDGE: Mock Electron & Zubridge para rodar o
// Frontend Oficial do Wispr Flow nativamente no Linux!
// ========================================================

(function () {
  console.log("⚡ [Flow Bridge] Inicializando ambiente Electron & Zubridge...");

  // Mock fetch para sentry-ipc://
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    if (typeof input === "string" && input.startsWith("sentry-ipc://")) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return origFetch.apply(this, arguments);
  };

  // Força Dark Mode nativo do Wispr Flow (apenas no Hub)
  try {
    document.documentElement.dataset.theme = "dark";
    if (!window.location.pathname.includes("/status/")) {
      if (document.body) document.body.style.backgroundColor = "#121212";
    }
  } catch (e) {}
  window.addEventListener("DOMContentLoaded", () => {
    document.documentElement.dataset.theme = "dark";
    if (!window.location.pathname.includes("/status/")) {
      if (document.body) document.body.style.backgroundColor = "#121212";
    }
  });

  // Minimiza por padrão o widget secundário do Notetaker na Home, liberando espaço total para os Ditados
  try {
    if (window.localStorage && window.localStorage.getItem("homepageNotetakerWidgetMinimized") === null) {
      window.localStorage.setItem("homepageNotetakerWidgetMinimized", "true");
    }
  } catch (_) {}

  // Polimento do Hub: Remove banners de marketing e menus de convite/indicação
  if (!window.location.pathname.includes("/status/")) {
    const cleanSidebarMenus = () => {
      // 1. Ocultar botões indesejados da barra lateral (Team, Referral, Student)
      const testIds = [
        'button[data-testid="sidebar-item-Team"]',
        'button[data-testid="sidebar-item-Referral"]',
        'button[data-testid="sidebar-item-StudentReferralChallenge"]'
      ];
      testIds.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          const li = el.closest("li") || el;
          li.style.setProperty("display", "none", "important");
        });
      });

      // 2. Banner card "Flow on mobile" ou qualquer CTA de marketing
      document.querySelectorAll('.G1p6L9gN5rfb40n5pO8w, [class*="activeTitleContainer"]').forEach((el) => {
        const card = el.closest('[class*="bottomSection"] > div') || el.parentElement || el;
        card.style.setProperty("display", "none", "important");
      });

      // 3. Fallback inteligente por texto
      document.querySelectorAll("p, span, div, button").forEach((el) => {
        if (el.children.length === 0 && el.textContent) {
          const txt = el.textContent.trim().toLowerCase();
          if (
            txt.includes("flow on mobile") ||
            txt.includes("use flow on the go") ||
            txt === "invite your team" ||
            txt === "get a free month"
          ) {
            const container = el.closest("li") || el.closest(".G1p6L9gN5rfb40n5pO8w") || el.closest('[class*="bottomSection"] > div') || el.parentElement;
            if (container && container !== document.body && container !== document.documentElement) {
              container.style.setProperty("display", "none", "important");
            }
          }
        }
      });
    };

    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", () => {
        cleanSidebarMenus();
        const obs = new MutationObserver(cleanSidebarMenus);
        obs.observe(document.body, { childList: true, subtree: true });
      });
    } else {
      cleanSidebarMenus();
      const obs = new MutationObserver(cleanSidebarMenus);
      obs.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Diagnóstico visual de erros na tela
  window.addEventListener("error", (e) => {
    const el = document.createElement("pre");
    el.className = "flow-runtime-error";
    el.style.cssText = "position:fixed;top:0;left:0;right:0;background:rgba(255,0,0,0.9);color:white;padding:12px;z-index:999999;font-size:12px;white-space:pre-wrap;max-height:200px;overflow:auto;";
    el.textContent = "WINDOW ERROR: " + e.message + "\n" + (e.error ? e.error.stack : "");
    document.body.appendChild(el);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const el = document.createElement("pre");
    el.className = "flow-runtime-rejection";
    el.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:rgba(200,50,0,0.9);color:white;padding:12px;z-index:999999;font-size:12px;white-space:pre-wrap;max-height:200px;overflow:auto;";
    el.textContent = "UNHANDLED REJECTION: " + e.reason + "\n" + (e.reason?.stack || "");
    document.body.appendChild(el);
  });

  const origError = console.error;
  console.error = function (...args) {
    origError.apply(console, args);
    const text = args.map((a) => (typeof a === "object" ? (a?.stack || JSON.stringify(a, Object.getOwnPropertyNames(a), 2)) : String(a))).join("\n");
    if (text.includes("Sentry SDK")) return; // Silenciar aviso do Sentry
    const el = document.createElement("pre");
    el.className = "flow-console-error";
    el.style.cssText = "position:fixed;top:40px;left:0;right:0;background:rgba(50,0,0,0.9);color:#ffaaaa;padding:12px;z-index:999998;font-size:11px;white-space:pre-wrap;max-height:300px;overflow:auto;";
    el.textContent = "CONSOLE.ERROR:\n" + text;
    document.body.appendChild(el);
  };

  const defaultCache = {
    firstMeetingWalkthroughAccounts: {},
    firstMeetingWalkthroughPresentedMeetings: {},
    statistics: {
      weekStreak: 3,
      dayStreak: 5,
      totalWords: 18450,
      totalDuration: 3600000,
      totalNonEmptyDuration: 3600000,
      averageWPM: 168,
      wordsThisWeek: 4200,
      wordsToday: 850,
      lastTranscriptTimestamp: new Date(),
      totalApps: ["Konsole", "Chrome", "VSCode"]
    },
    accessFlags: null,
    hipaaBaaSigned: false,
    hipaaBaaSignedBy: null,
    hipaaBaaSignedByEmail: null,
    hipaaBaaSignedAt: null,
    refererName: null,
    referralCode: "FLOWLINUX",
    referrals: [],
    splitKeybinds: [],
    lastTeamDictionarySyncTime: null,
    syncedPrefsModifiedAt: null,
    prefsDirty: false,
    avatarUrls: {},
    defaultDictionaryItemsLoaded: true,
    lastInsightsHeatmapReconcileAt: null,
    voiceProfile: {},
    pricingExperiment: {},
    meetingDrawer: {},
    notetakerHasRecordedRealMeeting: true,
    notetakerLastTab: null,
    pendingSummaryNuxMeetingId: null,
    pendingFirstSummaryCelebrationMeetingId: null,
    pendingFirstMeetingCompleteWithIncomingSummary: null,
    pendingTasksCoachmark: false,
    notetakerUnsupportedLanguagesWarned: [],
    onboardingContext: null
  };

  const defaultUser = {
    uuid: "flow-user-uuid-1",
    firstName: "Wiu",
    lastName: "Flow",
    email: "user@flow.linux",
    avatarUrl: "",
    onboardingCompleted: true,
    onboardingCompletedTime: Date.now() - 86400000,
    onboardingCompletedPlatforms: ["linux"],
    onboardingReentryActive: false,
    speedyOnboardingAccepted: true,
    initialSubscriptionSynced: true,
    lastNotificationReadTime: Date.now() - 86400000,
    lastLogsSentTime: Date.now() - 86400000,
    lastNoteSyncTime: Date.now() - 300000,
    lastMeetingSyncTime: Date.now() - 300000,
    lastTodoSyncTime: Date.now() - 300000,
    pagesCompleted: [
      { page: "Welcome", completed: true },
      { page: "Dictation", completed: true },
      { page: "Shortcuts", completed: true },
      { page: "Permissions", completed: true },
      { page: "Complete", completed: true },
      { page: "TrialExtension", completed: true }
    ],
    productIntent: "productivity",
    trialDecision: "opt_in",
    shouldMuteAudio: false,
    shouldPauseAudio: false,
    streamAudio: false,
    shouldAutoLearnWords: true,
    shouldOCRScreenCapture: false,
    enableSounds: true,
    selectedSoundFolder: null,
    hideAppInDock: false,
    openAtLogin: true,
    hideMeetingRecorderInScreenShare: false,
    autoDetectMeetingsEnabled: true,
    notetakerCalendarNotificationTiming: undefined,
    notetakerCalendarNotificationsEnabled: true,
    notetakerCalendarNotice: "off",
    notetakerConsentChatEnabled: false,
    notetakerConsentChatMessage: null,
    notetakerAutoShareNotes: "off",
    notetakerAutoShareNotesType: "all",
    notetakerAutoEndEnabled: true,
    notetakerOrgInsightsDefault: true,
    notetakerLongMeetingCheckInEnabled: true,
    notetakerLiveTranscriptEnabled: true,
    notetakerAttributeNamesEnabled: true,
    notetakerAutoDetectParticipantNamesEnabled: true,
    notetakerSplitScreenJoinEnabled: false,
    notetakerOpenWindowOnRecord: true,
    notetakerMenuBarMeetingEnabled: true,
    uiLocale: "en",
    cloudSync: true,
    dictationMode: "hands-free",
    activeMicDeviceId: "default",
    overrideAudioDeviceId: "default",
    rankedAudioDevices: [
      { deviceId: "default", name: "Default Microphone" }
    ],
    subscription: {
      isStudent: false,
      tier: "pro",
      status: "active"
    },
    enterprise: null,
    shortcuts: {
      "162+91": "ptt",
      "162+32+91": "popo",
      "162+164+91": "lens",
      "160+164+90": "paste_last_text",
      "160+164+88": "copy_last_text",
      "27": "dismiss"
    },
    mouseFlowBannerDismissed: true,
    mouseFlowNudgeSeen: true,
    stashedScratchpadShortcuts: {},
    stashedPolishShortcuts: {},
    stashedMeetingRecorderShortcuts: {},
    usedLanguages: ["en", "pt"],
    selectedLanguages: ["en", "pt"],
    effectiveLanguages: ["en", "pt"],
    aiFormatting: true,
    renderOptions: { width: 960, height: 680, sidebarOpen: true },
    internal: { scratchpadSidebarOpen: false, scratchpadDefaultNewTab: false },
    polishInstructions: {},
    polishEnabled: true,
    autoPolishAfterDictation: false,
    notificationSettings: {},
    registeredDevices: [],
    userVoices: [],
    personalizationStyles: null,
    notesViewType: "grid",
    showTIY: false,
    postOnboardingCompleted: true,
    polishOnboardingCompleted: true,
    microphoneQuizBannerDismissed: true,
    handsFreeShortcutRemoved: false,
    theme: "dark",
    themePreference: "dark"
  };

  const defaultAudioDevices = [
    {
      deviceId: "default",
      name: "Default Microphone",
      label: "Microfone Padrão (PipeWire / ALSA)",
      isBuiltIn: true,
      isVirtual: false
    }
  ];

  // Estado Root do Wispr Flow
  const rootState = {
    sessionId: "flow-session-1",
    authSignedIn: true,
    featureFlagCache: {
      "notetaker-business-allowed": { enabled: true },
      "extension-system": { enabled: true },
      "homepage-redesign": { enabled: true },
      "dark-mode": { enabled: true }
    },
    featureFlagsResolved: true,
    featureFlagsCommitted: true,
    enterpriseResolvedForUserId: null,
    enterpriseWait: null,
    nudge: null,
    userGrowthState: null,
    prodReleaseVersion: "1.6.1147",
    degradedNetwork: false,
    pendingPromo: null,
    updateState: "up-to-date",
    managedUpdateInfo: null,
    osCountryCode: "BR",
    enterpriseIpBlocked: null,
    appDictationBlocked: null,
    incidentStatus: null,
    clientRegion: "sa-east-1",
    navigationState: {
      current: { hubPage: "Dictation" },
      canGoBack: false,
      canGoForward: false
    },
    voiceProfile: {
      id: "profile_1",
      name: "Wiu",
      isCustom: true
    },
    isVoiceProfileGenerating: false,
    detectedMeetingExternalId: null,
    activeMeetings: [],
    childServicesReady: true,
    prefs: {
      sessionId: "flow-session-1",
      user: defaultUser,
      cache: defaultCache,
      experiments: { isRemoveDesktopTrial: false },
      userTeamsStatus: null
    },
    notes: [
      {
        id: "note-1",
        title: "Primeira Nota com o Flow",
        content: "O Flow é uma alternativa livre ao Wispr Flow, agora rodando nativamente no Linux com aceleração Whisper na Groq.",
        contentPreview: "O Flow é uma alternativa livre ao Wispr Flow, agora rodando nativamente no Linux com aceleração Whisper na Groq.",
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3600000,
        modifiedAt: Date.now() - 3600000
      }
    ],
    dictionaryWords: [
      { id: "w-1", phrase: "Flow", isStarred: true, modifiedAt: Date.now() - 100000 },
      { id: "w-2", phrase: "Groq", isStarred: false, modifiedAt: Date.now() - 200000 },
      { id: "w-3", phrase: "Whisper", isStarred: false, modifiedAt: Date.now() - 300000 },
      { id: "w-4", phrase: "Tauri", isStarred: false, modifiedAt: Date.now() - 400000 },
      { id: "w-5", phrase: "Linux", isStarred: false, modifiedAt: Date.now() - 500000 },
      { id: "w-6", phrase: "Wayland", isStarred: false, modifiedAt: Date.now() - 600000 },
      { id: "w-7", phrase: "PipeWire", isStarred: false, modifiedAt: Date.now() - 700000 }
    ],
    dictionaryTeamWords: [],
    insightsStats: {
      data: {
        words_per_minute: 168,
        total_words: 18450,
        current_streak: 5,
        total_duration_ms: 3600000,
        desktop_total_words: 18450,
        mobile_total_words: 0,
        monthly_word_delta_percent: 15,
        previous_month_total_words: 16000,
        desktop_total_words_corrected: 120,
        mobile_total_words_corrected: 0,
        desktop_total_dictionary_replacements: 45,
        mobile_total_dictionary_replacements: 0,
        desktop_total_apps_used: 3,
        desktop_usage: [
          { key: "coding", category: "Coding", percentage: 50, word_count: 9225, dictation_count: 35 },
          { key: "messaging", category: "Messaging", percentage: 30, word_count: 5535, dictation_count: 22 },
          { key: "browser", category: "Browser", percentage: 20, word_count: 3690, dictation_count: 14 }
        ]
      },
      error: false
    },
    heatmapStats: {
      data: {
        days: [
          { date: "2026-10-14", desktop_words: 850, mobile_words: 0 }
        ],
        account_created_at: Date.now() - 86400000 * 30
      },
      error: false
    },
    userContext: {
      activeApp: "Terminal",
      appName: "Konsole"
    },
    audioDevices: defaultAudioDevices
  };

  window.__rootState = rootState;
  const listeners = new Set();

  window.zubridge = {
    subscribe: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    getState: async () => {
      return rootState;
    },
    dispatch: async (action, payload) => {
      console.log("⚡ [Zubridge Dispatch]", action, payload);
      if (action === "SET_PREFS" && payload) {
        if (payload.user) Object.assign(rootState.prefs.user, payload.user);
        if (payload.cache) Object.assign(rootState.prefs.cache, payload.cache);
      }
      listeners.forEach((fn) => {
        try { fn(rootState); } catch (e) { console.error(e); }
      });
      return {};
    }
  };

  window.__zubridge_subscriptionValidator = {
    isSubscribedToKey: async () => true,
    validateStateAccess: async () => true,
    stateKeyExists: () => true
  };

  window.__SENTRY_IPC__ = {
    sendScope: () => {},
    sendEnvelope: () => {}
  };

  const ipcListeners = new Map();

  window.electron = {
    ipc: {
      invoke: async (channel, ...args) => {
        console.log("📡 [IPC Invoke]", channel, JSON.stringify(args));
        if (channel === "zubridge:get-state") return rootState;
        if (channel === "zubridge:get-window-id") return 1;
        if (channel === "zubridge:get-window-subscriptions") return [];
        if (channel === "auth:getAccessToken") return "flow-access-token-active-12345";
        if (channel === "auth:getUser") return rootState.prefs.user;
        if (channel === "app:getVersion") return "1.6.1147";
        if (channel === "teams:getDomainInfo") return { isPrimaryTeamsDataInitialized: true, same_domain_users: [] };
        if (channel === "teams:getTeamMembers") return [];
        if (channel === "teams:getMyInvitations") return [];
        if (channel === "teams:getMyJoinRequests") return [];
        if (channel === "teams:getTeamInvitations") return [];
        if (channel === "teams:getJoinRequests") return [];
        if (channel === "teams:listTeams") return [];
        if (channel === "teams:getMyDepartmentId") return null;
        if (channel === "teams:refreshEnterprise") return {};
        if (channel === "billing:fetchStatus") return { tier: "pro", isTrial: false };
        if (channel === "billing:fetchDetails") return {};
        if (channel === "connector:getConnectors") {
          return {
            connectors: [
              { key: "calendar", connected: false, blocked_by_enterprise: false },
              { key: "outlook", connected: false, blocked_by_enterprise: false },
              { key: "gmail", connected: false, blocked_by_enterprise: false },
              { key: "slack", connected: false, blocked_by_enterprise: false },
              { key: "notion", connected: false, blocked_by_enterprise: false }
            ]
          };
        }
        if (channel === "calendar:getUpcoming") {
          return { events: [] };
        }
        if (channel === "connector:getConnectionRequestStatus") {
          return null;
        }
        // ==================== NOTAS (Persistência em Markdown & SQLite) ====================
        if (channel === "notes:get") {
          const id = args[0]?.id || args[0];
          if (id && typeof id === "string") {
            if (window.flowNative?.memory) {
              const note = await window.flowNative.memory.getNoteById(id);
              if (note) return note;
            }
            return (rootState.notes || []).find((n) => n.id === id) || null;
          }
          if (window.flowNative?.memory) {
            const list = await window.flowNative.memory.getNotes();
            if (list && list.length > 0) rootState.notes = list;
          }
          return rootState.notes || [];
        }
        if (channel === "notes:create" || channel === "notes:edit") {
          const noteData = args[0] || {};
          let saved = noteData;
          if (window.flowNative?.memory) {
            saved = await window.flowNative.memory.saveNote(noteData);
            rootState.notes = await window.flowNative.memory.getNotes();
          } else {
            const id = noteData.id || "note-" + Date.now();
            saved = { ...noteData, id, modifiedAt: Date.now() };
            rootState.notes = [saved, ...(rootState.notes || []).filter((n) => n.id !== id)];
          }
          listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          return saved;
        }
        if (channel === "notes:delete") {
          const id = args[0]?.id || args[0];
          if (window.flowNative?.memory && id) {
            await window.flowNative.memory.deleteNote(id);
            rootState.notes = await window.flowNative.memory.getNotes();
          } else {
            rootState.notes = (rootState.notes || []).filter((n) => n.id !== id);
          }
          listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          return true;
        }
        if (channel === "notes:pin") {
          const id = args[0]?.id;
          const pinned = args[0]?.pinned;
          if (window.flowNative?.memory && id) {
            await window.flowNative.memory.pinNote(id, pinned);
            rootState.notes = await window.flowNative.memory.getNotes();
          }
          listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          return true;
        }
        if (channel === "notes:refresh" || channel === "notes:hardRefresh") {
          if (window.flowNative?.memory) {
            rootState.notes = await window.flowNative.memory.getNotes();
            listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          }
          return true;
        }

        // ==================== HISTÓRICO HOME (memory/dictations/*.md) ====================
        if (channel === "history:getLastTranscripts") {
          const params = args[0] || {};
          if (window.flowNative?.memory) {
            return await window.flowNative.memory.getTranscripts(params);
          }
          return [];
        }
        if (channel === "history:getTranscript" || channel === "history:getTranscriptAllColumns") {
          const id = args[0]?.transcriptEntityId || args[0];
          if (window.flowNative?.memory && id) {
            return await window.flowNative.memory.getTranscriptById(id);
          }
          return null;
        }
        if (channel === "history:deleteTranscript") {
          const id = args[0]?.transcriptEntityId || args[0];
          if (window.flowNative?.memory && id) {
            await window.flowNative.memory.deleteTranscript(id);
            emitIpc("history:needsUpdate");
          }
          return true;
        }
        if (channel === "history:deleteAllTranscripts" || channel === "history:archiveAll") {
          if (window.flowNative?.memory) {
            await window.flowNative.memory.deleteAllTranscripts();
            emitIpc("history:needsUpdate");
          }
          return true;
        }
        if (channel === "history:initializeStatistics") {
          if (window.flowNative?.memory) {
            const st = await window.flowNative.memory.getInsightsStats();
            return {
              totalWords: st.total_words,
              wordsToday: st.total_words,
              totalDuration: st.total_duration_ms,
              averageWPM: st.words_per_minute,
              weekStreak: st.current_streak,
              dayStreak: st.current_streak,
              lastTranscriptTimestamp: new Date(),
              totalApps: ["Konsole", "Chrome", "VSCode"]
            };
          }
          return rootState.prefs.cache.statistics;
        }
        if (channel === "history:getTopApps") {
          return ["Konsole", "VSCode", "Chrome", "Terminal"];
        }
        if (channel === "history:getBulkAppWordCounts") {
          return {};
        }

        // ==================== INSIGHTS & ESTATÍSTICAS ====================
        if (channel === "insights:getStats") {
          if (window.flowNative?.memory) {
            const st = await window.flowNative.memory.getInsightsStats();
            rootState.insightsStats = { data: st, error: false };
            return rootState.insightsStats;
          }
          return rootState.insightsStats;
        }
        if (channel === "insights:getHeatmap") {
          if (window.flowNative?.memory) {
            const hm = await window.flowNative.memory.getHeatmapStats();
            rootState.heatmapStats = { data: hm, error: false };
            return rootState.heatmapStats.data;
          }
          return rootState.heatmapStats.data;
        }

        // ==================== DICIONÁRIO & SNIPPETS ====================
        if (channel === "memory:initializeDictionary") return true;
        if (channel === "memory:getStrippedSnippets") {
          if (window.flowNative?.memory) {
            return await window.flowNative.memory.getSnippets();
          }
          return [];
        }
        if (channel === "memory:addManualWord" || channel === "memory:addManualTeamWord") {
          if (window.flowNative?.memory) {
            await window.flowNative.memory.addDictionaryWord(args[0] || {});
            rootState.dictionaryWords = await window.flowNative.memory.getDictionaryWords();
            listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          }
          return { success: true };
        }
        if (channel === "memory:editManualWord" || channel === "memory:editManualTeamWord") {
          if (window.flowNative?.memory) {
            await window.flowNative.memory.editDictionaryWord(args[0] || {});
            rootState.dictionaryWords = await window.flowNative.memory.getDictionaryWords();
            listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          }
          return true;
        }
        if (channel === "memory:removeManualWord" || channel === "memory:removeManualWords" || channel === "memory:removeManualTeamWord") {
          const phrase = args[0]?.word || args[0]?.phrase || args[0];
          if (window.flowNative?.memory && phrase) {
            await window.flowNative.memory.removeDictionaryWord(phrase);
            rootState.dictionaryWords = await window.flowNative.memory.getDictionaryWords();
            listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          }
          return true;
        }
        if (channel === "memory:starWord") {
          const phrase = args[0]?.word || args[0]?.phrase || args[0];
          const isStarred = args[0]?.isStarred ?? true;
          if (window.flowNative?.memory && phrase) {
            await window.flowNative.memory.starDictionaryWord(phrase, isStarred);
            rootState.dictionaryWords = await window.flowNative.memory.getDictionaryWords();
            listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          }
          return true;
        }
        if (channel === "memory:syncDictionary") {
          if (window.flowNative?.memory) {
            rootState.dictionaryWords = await window.flowNative.memory.getDictionaryWords();
            listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          }
          return true;
        }

        // ==================== RASCUNHO / SCRATCHPAD ====================
        if (channel === "scratchpad:open" || channel === "scratchpad:openWithNote") {
          if (window.electron?.ipc?.send) {
            window.electron.ipc.send("flow:open-scratchpad", args[0]);
          }
          return true;
        }
        if (channel === "scratchpad:getRecentNotes") {
          if (window.flowNative?.memory) {
            const list = await window.flowNative.memory.getNotes();
            return { notes: list || [], hasMore: false };
          }
          return { notes: rootState.notes || [], hasMore: false };
        }
        if (channel === "scratchpad:saveNote") {
          const noteData = args[0] || {};
          let noteId = noteData.noteId;
          if (window.flowNative?.memory) {
            const saved = await window.flowNative.memory.saveNote({
              id: noteId,
              title: noteData.title,
              content: noteData.content
            });
            await window.flowNative.memory.saveScratchpad(noteData);
            rootState.notes = await window.flowNative.memory.getNotes();
            listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
            noteId = saved?.id || noteId;
          }
          return { noteId };
        }

        if (channel === "calendar:getUpcoming" || channel.startsWith("calendar:")) return { events: [] };
        if (channel === "meetingRecorder:getRecentMeetings") return { meetings: [], hasMore: false, nextCursor: null };
        if (channel === "meetingRecorder:getTodayMeetingStats") return { meetingCount: 0, wordCount: 0, durationSec: 0, peopleCount: 0 };
        if (channel.startsWith("meetingRecorder:")) return { meetings: [], hasMore: false, nextCursor: null };
        if (channel.startsWith("scratchpad:")) return [];
        if (channel.startsWith("todos:")) return [];
        if (channel.startsWith("notetakerChats:")) return [];
        if (channel.startsWith("meetingShare:")) return { rows: [], hasMore: false };
        if (channel.startsWith("userVoicePreferences:")) return [];
        if (channel.startsWith("remoteNotification:")) return [];
        if (channel.startsWith("notification:")) return false;
        if (channel.startsWith("referral:")) return { referrals: [], code: "" };
        if (channel === "extensionSettings:getExtensionList" || channel.startsWith("extensionSettings:getCustom") || channel.startsWith("extensionSettings:getSubprocess")) return [];
        if (channel.startsWith("extensionKeybind:")) return [];
        if (channel.startsWith("extensionSettings:")) return {};
        return {};
      },
      send: (channel, ...args) => {
        console.log("📡 [IPC Send]", channel, JSON.stringify(args));
        if (channel === "status:startClicked") {
          toggleVoiceRecording(true);
        } else if (channel === "status:stopClicked") {
          toggleVoiceRecording(false);
        } else if (channel === "status:cancelClicked") {
          cancelVoiceRecording();
        }
      },
      on: (channel, handler) => {
        if (!ipcListeners.has(channel)) ipcListeners.set(channel, new Set());
        ipcListeners.get(channel).add(handler);
        return handler;
      },
      off: (channel, handler) => {
        if (ipcListeners.has(channel)) {
          ipcListeners.get(channel).delete(handler);
        }
      },
      setMaxListeners: () => {}
    },
    shell: {
      openExternal: (url) => {
        window.open(url, "_blank");
      }
    },
    clipboard: {
      writeText: async (text) => {
        try {
          await navigator.clipboard.writeText(text);
          console.log("📋 [Clipboard]", text);
        } catch (e) {
          console.warn("Clipboard failed:", e);
        }
      },
      write: () => {}
    },
    platform: {
      os: "linux",
      arch: "x64",
      isWindows: false,
      isMacOS: false,
      macSystemAudioCapability: null,
      supportsNativeAccessibilityGuidance: false
    },
    paths: {
      appSupportDir: "/home/wiu/.config/flow",
      logDir: "/home/wiu/.config/flow/logs"
    },
    files: {
      getPathForFile: (file) => file.name || ""
    }
  };

  // ========================================================
  // MOTOR DE ÁUDIO & GROQ WHISPER EM TEMPO REAL
  // ========================================================
  const broadcast = ("BroadcastChannel" in window) ? new BroadcastChannel("flow-desktop-sync") : null;
  if (broadcast) {
    broadcast.onmessage = (event) => {
      const { channel, args } = event.data || {};
      if (channel) {
        emitIpcLocal(channel, ...(args || []));
      }
    };
  }

  function emitIpc(channel, ...args) {
    emitIpcLocal(channel, ...args);
    if (broadcast) {
      try { broadcast.postMessage({ channel, args }); } catch (e) {}
    }
  }

  function emitIpcLocal(channel, ...args) {
    try {
      window.dispatchEvent(new CustomEvent("flow:ipc", { detail: { channel, args } }));
      if (channel === "status:dictationStatus") {
        window.dispatchEvent(new CustomEvent("flow:dictationStatus", { detail: args[0] }));
      } else if (channel === "flow:liveTranscript") {
        window.dispatchEvent(new CustomEvent("flow:liveTranscript", { detail: args[0] }));
      } else if (channel === "flow:audioLevel") {
        window.dispatchEvent(new CustomEvent("flow:audioLevel", { detail: args[0] }));
      }
    } catch (e) {}
    const cbs = ipcListeners.get(channel);
    if (cbs) {
      cbs.forEach((cb) => {
        try { cb(...args); } catch (e) { console.error(e); }
      });
    }
  }

  function playFlowSound(type) {
    try {
      const audio = new Audio();
      if (type === "start") audio.src = "/renderer/static/media/dictation-start14d6ec0093e4bae8be35.wav";
      else if (type === "stop") audio.src = "/renderer/static/media/dictation-stop1871b6ba79da7003bf4a.wav";
      else if (type === "success") audio.src = "/renderer/static/media/success1af25cfa064fc928e2c2.wav";
      else if (type === "error") audio.src = "/renderer/static/media/error1b63fe1d662d60d16cf6.wav";
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  let mediaRecorder = null;
  let audioChunks = [];
  let audioStream = null;
  let isVoiceRecording = false;
  let activeSpeechRecognition = null;
  let audioContext = null;
  let audioAnalyser = null;
  let analyserInterval = null;

  function startLiveSpeechStreaming() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;
    try {
      const rec = new SpeechRec();
      rec.lang = "pt-BR";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event) => {
        let interim = "";
        let final = "";
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + " ";
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = (final + interim).trim();
        if (text) {
          emitIpc("flow:liveTranscript", { text, isFinal: false });
        }
      };

      rec.onerror = (err) => {
        console.warn("SpeechRec warning:", err.error);
      };

      rec.start();
      activeSpeechRecognition = rec;
    } catch (e) {
      console.warn("Could not start live speech recognition:", e);
    }
  }

  function stopLiveSpeechStreaming() {
    if (activeSpeechRecognition) {
      try { activeSpeechRecognition.stop(); } catch (e) {}
      activeSpeechRecognition = null;
    }
  }

  function startAudioAnalyser(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      audioContext = new AudioCtx();
      const source = audioContext.createMediaStreamSource(stream);
      audioAnalyser = audioContext.createAnalyser();
      audioAnalyser.fftSize = 64;
      source.connect(audioAnalyser);

      const bufferLength = audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      analyserInterval = setInterval(() => {
        if (!audioAnalyser) return;
        audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(1.0, Math.max(0.0, average / 128.0));
        emitIpc("flow:audioLevel", normalized);
      }, 70);
    } catch (e) {}
  }

  function stopAudioAnalyser() {
    if (analyserInterval) {
      clearInterval(analyserInterval);
      analyserInterval = null;
    }
    if (audioContext) {
      try { audioContext.close(); } catch (e) {}
      audioContext = null;
    }
    audioAnalyser = null;
  }

  let persistentAudioStream = null;

  async function getOrCreateAudioStream() {
    if (persistentAudioStream && persistentAudioStream.active && persistentAudioStream.getAudioTracks().some(t => t.readyState === 'live')) {
      return persistentAudioStream;
    }
    try {
      persistentAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      return persistentAudioStream;
    } catch (e) {
      console.warn("⚠️ [Flow Audio] Falha ao pré-carregar microfone:", e);
      return null;
    }
  }

  // Pré-aquece o microfone imediatamente no carregamento da aplicação
  setTimeout(() => {
    getOrCreateAudioStream();
  }, 1000);

  async function toggleVoiceRecording(forceStart) {
    if (forceStart === true || (!isVoiceRecording && forceStart === undefined)) {
      await startVoiceRecording();
    } else {
      await stopVoiceRecording();
    }
  }

  async function startVoiceRecording() {
    if (isVoiceRecording) return;
    try {
      playFlowSound("start");
      audioStream = await getOrCreateAudioStream();
      if (!audioStream) {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        persistentAudioStream = audioStream;
      }
      audioChunks = [];
      mediaRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };
      mediaRecorder.start(50);
      isVoiceRecording = true;
      console.log("🎙️ [Flow Audio] Gravação iniciada com sucesso (0ms latência)!");

      emitIpc("status:dictationStatus", "active_ptt");
      emitIpc("flow:liveTranscript", { text: "", isFinal: false });
      startLiveSpeechStreaming();
      startAudioAnalyser(audioStream);
    } catch (err) {
      playFlowSound("error");
      console.error("❌ [Flow Audio] Falha ao acessar microfone:", err);
    }
  }

  async function stopVoiceRecording() {
    if (!isVoiceRecording || !mediaRecorder) return;
    isVoiceRecording = false;
    playFlowSound("stop");
    stopLiveSpeechStreaming();
    stopAudioAnalyser();

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        // Mantemos o persistentAudioStream vivo para o próximo toque ser instantâneo!
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        console.log("🎙️ [Flow Audio] Áudio capturado:", audioBlob.size, "bytes. Transcrevendo na Groq...");

        emitIpc("status:dictationStatus", "polish_processing");

        let text = await transcribeAudioWithGroq(audioBlob);
        const badHallucinations = ["...", ".", "..", "Né?", "Né", "né", "né?", "Obrigado por assistir!", "Obrigado por assistir.", "Subtitles by", "Legendas por", "Sônia Ruberti", "Amém", "Amém."];
        if (text && badHallucinations.includes(text.trim())) {
          text = "";
        }
        if (text && text.trim().length > 0) {
          playFlowSound("success");
          console.log("✨ [Flow Groq Whisper] Transcrição concluída:", text);

          emitIpc("flow:liveTranscript", { text, isFinal: true });

          if (window.flowNative && window.flowNative.copyToClipboard) {
            window.flowNative.copyToClipboard({ text, autoPaste: true });
          }

          const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

          if (window.flowNative && window.flowNative.memory) {
            try {
              // 1. Salva a transcrição no histórico (.md em memory/dictations/ e SQLite db.db)
              await window.flowNative.memory.saveTranscript({
                text,
                formattedText: text,
                app: rootState.userContext?.appName || "Konsole",
                duration: 2.0,
                words: wordCount
              });

              // 2. Salva como nota Markdown (.md em memory/notes/)
              await window.flowNative.memory.saveNote({
                title: text.slice(0, 36) + (text.length > 36 ? "..." : ""),
                content: text
              });

              // 3. Atualiza estado e estatísticas
              rootState.notes = await window.flowNative.memory.getNotes();
              const stats = await window.flowNative.memory.getInsightsStats();
              if (stats) {
                rootState.insightsStats = { data: stats, error: false };
                if (rootState.prefs?.cache?.statistics) {
                  rootState.prefs.cache.statistics.totalWords = stats.total_words;
                  rootState.prefs.cache.statistics.wordsToday = (rootState.prefs.cache.statistics.wordsToday || 0) + wordCount;
                }
              }

              // 4. Emite evento para a Home atualizar a lista ao vivo instantaneamente!
              emitIpc("history:needsUpdate");
            } catch (err) {
              console.warn("⚠️ [Bridge Memory Save Error]:", err);
            }
          } else {
            const newNote = {
              id: "note-" + Date.now(),
              title: text.slice(0, 36) + (text.length > 36 ? "..." : ""),
              content: text,
              contentPreview: text.slice(0, 100),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              modifiedAt: Date.now()
            };
            rootState.notes = [newNote, ...(rootState.notes || [])];
          }

          listeners.forEach((fn) => {
            try { fn(rootState); } catch (e) {}
          });

          emitIpc("status:dictationStatus", "polish_completed_action");
          setTimeout(() => {
            emitIpc("status:dictationStatus", "resting");
          }, 1800);
        } else {
          playFlowSound("error");
          emitIpc("status:dictationStatus", "resting");
        }
        resolve(text);
      };

      mediaRecorder.stop();
    });
  }

  function cancelVoiceRecording() {
    isVoiceRecording = false;
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    emitIpc("status:dictationStatus", "resting");
  }

  async function transcribeAudioWithGroq(audioBlob) {
    if (!audioBlob || audioBlob.size < 500) {
      console.log("[-] Áudio muito curto ou vazio.");
      return "";
    }

    // 1. No Electron nativo, usa o pipeline de alta confiabilidade via IPC
    if (window.flowNative && window.flowNative.transcribeAudio) {
      try {
        const arrayBuf = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const text = await window.flowNative.transcribeAudio(base64);
        return text ? text.trim() : "";
      } catch (err) {
        console.error("[-] Falha na transcrição via flowNative:", err);
      }
    }

    // 2. Fallback direto via fetch (modo web)
    try {
      const apiKey = localStorage.getItem("flow_groq_key") || "";
      if (!apiKey) {
        console.warn("[-] Nenhuma API Key configurada para o fallback Web Groq.");
        return "";
      }
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", "whisper-large-v3");
      formData.append("language", "pt");
      formData.append("temperature", "0.0");
      formData.append("prompt", "Transcrição de áudio em português claro, natural e pontuação precisa.");

      const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: formData
      });
      if (resp.ok) {
        const json = await resp.json();
        return json.text ? json.text.trim() : "";
      } else {
        console.error("[-] Erro na API Groq:", await resp.text());
        return "";
      }
    } catch (e) {
      console.error("[-] Falha na requisição Groq:", e);
      return "";
    }
  }

  // Atalho Global: Pressionar Espaço (quando fora de campos de texto) ou botão na tela
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
      e.preventDefault();
      toggleVoiceRecording();
    }
  });

  window.__flowToggleDictation = toggleVoiceRecording;
  window.__flowStartDictation = () => toggleVoiceRecording(true);
  window.__flowStopDictation = () => toggleVoiceRecording(false);

  if (typeof window.flowNative !== "undefined") {
    if (window.flowNative.onDictationTrigger) {
      window.flowNative.onDictationTrigger(() => {
        console.log("⚡ [Flow Native Trigger] Ditado alternado via atalho nativo do sistema!");
        toggleVoiceRecording();
      });
    }
    if (window.flowNative.onDictationStart) {
      window.flowNative.onDictationStart(() => {
        console.log("⚡ [Flow PTT Start] Tecla pressionada! Iniciando gravação...");
        toggleVoiceRecording(true);
      });
    }
    if (window.flowNative.onDictationStop) {
      window.flowNative.onDictationStop(() => {
        console.log("⚡ [Flow PTT Stop] Tecla solta! Finalizando gravação...");
        toggleVoiceRecording(false);
      });
    }
    if (window.flowNative.onHistoryNeedsUpdate) {
      window.flowNative.onHistoryNeedsUpdate(() => {
        console.log("⚡ [Bridge] Recebido history:needsUpdate do processo nativo!");
        emitIpc("history:needsUpdate");
      });
    }
    if (window.flowNative.memory) {
      (async () => {
        try {
          const [savedNotes, savedWords, savedStats, savedHeatmap] = await Promise.all([
            window.flowNative.memory.getNotes(),
            window.flowNative.memory.getDictionaryWords(),
            window.flowNative.memory.getInsightsStats(),
            window.flowNative.memory.getHeatmapStats()
          ]);
          if (savedNotes && savedNotes.length > 0) rootState.notes = savedNotes;
          if (savedWords && savedWords.length > 0) rootState.dictionaryWords = savedWords;
          if (savedStats) {
            rootState.insightsStats = { data: savedStats, error: false };
            if (rootState.prefs?.cache?.statistics) {
              rootState.prefs.cache.statistics.totalWords = savedStats.total_words;
              rootState.prefs.cache.statistics.wordsToday = savedStats.total_words;
              rootState.prefs.cache.statistics.averageWPM = savedStats.words_per_minute;
              rootState.prefs.cache.statistics.weekStreak = savedStats.current_streak;
              rootState.prefs.cache.statistics.dayStreak = savedStats.current_streak;
            }
          }
          if (savedHeatmap) rootState.heatmapStats = { data: savedHeatmap, error: false };
          listeners.forEach((fn) => { try { fn(rootState); } catch (_) {} });
          console.log("✓ [Flow Bridge] Memória persistente carregada com sucesso (.md e SQLite)!");
        } catch (err) {
          console.warn("⚠️ [Bridge Initial Memory Sync]:", err);
        }
      })();
    }
  }

  console.log("✓ [Flow Bridge] Bridge pronto para executar o Wispr Flow oficial com Groq Whisper!");
})();

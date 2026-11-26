import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Wand2, ArrowLeft, Plus, Volume2, VolumeX } from "lucide-react";
import { Routine, IslandState } from "../types";
import {
  TitleBar,
  DynamicIsland,
  RoutineCard,
  RoutineEditor,
  SettingsTab,
  LandingPage,
  MascotState,
  PushButton,
} from "../components";
import { AudioRecorder } from "../components/stt/AudioRecorder";
import { AppSettingsData } from "../types/electron";
import { useRoutines, useHotkeys, useSoundEffect } from "../hooks";
import { sound } from "../utils/soundEffects";

export type AppScreen = "home" | "routines" | "settings";

export function MainAppView() {
  const {
    routines,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    filteredRoutines,
    saveRoutine,
    deleteRoutine,
    toggleRoutine,
  } = useRoutines();

  const { isMuted, toggleMute, isBgmOn, toggleBgm } = useSoundEffect();

  useEffect(() => {
    const api = window.electronAPI;
    let isActive = api?.isWindowActive ? false : document.visibilityState === "visible";

    const applyActive = (active: boolean) => {
      isActive = active;
      sound.syncBgmVisibility(active);
    };

    const onPointerDown = () => {
      if (isActive) {
        sound.syncBgmVisibility(true);
        sound.flushPendingSanta();
      }
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });

    if (api?.isWindowActive && api?.onWindowActiveChange) {
      api.isWindowActive().then(applyActive).catch(() => {});
      const unsub = api.onWindowActiveChange(applyActive);
      return () => {
        unsub();
        window.removeEventListener("pointerdown", onPointerDown);
      };
    }

    const syncWeb = () => applyActive(document.visibilityState === "visible");
    syncWeb();
    document.addEventListener("visibilitychange", syncWeb);
    return () => {
      document.removeEventListener("visibilitychange", syncWeb);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [activeScreen, setActiveScreen] = useState<AppScreen>("home");

  // Dynamic Island & Voice State
  const [islandState, setIslandState] = useState<IslandState>("idle");
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null);
  const runningRoutineIdRef = useRef<string | null>(null);
  runningRoutineIdRef.current = runningRoutineId;
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [mascotState, setMascotState] = useState<MascotState>("idle");

  // Timers for safe serialization & single-thread lifecycle
  const autoResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activateTimer1 = useRef<NodeJS.Timeout | null>(null);
  const activateTimer2 = useRef<NodeJS.Timeout | null>(null);

  // Voice-to-Island State (STT -> AI Router -> Auto-Run)
  const [voicePhase, setVoicePhase] = useState<"idle" | "listening" | "thinking" | "error" | "ambiguous">("idle");
  const [voiceMessage, setVoiceMessage] = useState<string>("");
  const [voiceCandidates, setVoiceCandidates] = useState<Routine[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettingsData>({
    islandIdleMode: "always-on-top",
    masterHotkey: "CommandOrControl+Space",
  });

  useEffect(() => {
    window.electronAPI?.getSettings?.().then(setAppSettings).catch(() => {});
  }, []);

  const handleUpdateSettings = useCallback(async (patch: Partial<AppSettingsData>) => {
    const api = window.electronAPI;
    if (!api?.updateSettings) return { ok: false, error: "Desktop settings require Electron." };
    const res = await api.updateSettings(patch);
    setAppSettings(res.settings);
    return { ok: res.ok, error: res.error };
  }, []);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const voiceRequestIdRef = useRef<string | null>(null);
  const voicePhaseRef = useRef(voicePhase);
  voicePhaseRef.current = voicePhase;
  const lastMasterTriggerAtRef = useRef<number>(0);

  // Sync mascot state with island state
  useEffect(() => {
    if (islandState === "listening") {
      setMascotState("listening");
    } else if (islandState === "thinking") {
      setMascotState("thinking");
    } else if (islandState === "executing") {
      setMascotState("tinkering");
    } else if (islandState === "completed") {
      setMascotState("celebrating");
    } else if (islandState === "failed") {
      setMascotState("upset");
    } else {
      setMascotState("idle");
    }
  }, [islandState]);

  // Simulate Voice Trigger Flow: "Hey Flowy" -> Listen -> Intent -> Execute
  const handleSimulateVoice = () => {
    const target = routines.find((r) => r.enabled) || routines[0];
    setActiveRoutine(target);
    setRunningRoutineId(target?.id || null);
    runningRoutineIdRef.current = target?.id || null;
    setIslandState("listening");

    const api = window.electronAPI;
    if (api?.simulateWakeWord) {
      api.simulateWakeWord(target);
    }

    if (activateTimer1.current) clearTimeout(activateTimer1.current);
    if (activateTimer2.current) clearTimeout(activateTimer2.current);
    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);

    activateTimer1.current = setTimeout(() => {
      setIslandState("thinking");
    }, 1400);

    activateTimer2.current = setTimeout(() => {
      setIslandState("executing");
    }, 2500);

    if (api) return;
    const stepCount = target?.steps?.length || 3;
    const estimatedTotalMs = 2500 + stepCount * 650 + 2000;
    autoResetTimerRef.current = setTimeout(() => {
      setIslandState("idle");
      setRunningRoutineId(null);
    }, estimatedTotalMs);
  };

  const handleRunRoutine = useCallback((routine: Routine) => {
    setActiveRoutine(routine);
    setRunningRoutineId(routine.id);
    runningRoutineIdRef.current = routine.id;
    setIslandState("executing");

    const api = window.electronAPI;
    if (api?.showIsland) {
      api.showIsland(routine);
    }

    if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
    if (api) return;
    const stepCount = routine.steps.length || 3;
    const estimatedTotalMs = stepCount * 650 + 2500;
    autoResetTimerRef.current = setTimeout(() => {
      setIslandState("idle");
      setRunningRoutineId(null);
    }, estimatedTotalMs);
  }, []);

  const cancelVoiceCommand = useCallback(() => {
    recorderRef.current?.cancel();
    const pendingId = voiceRequestIdRef.current;
    voiceRequestIdRef.current = null;
    if (pendingId) {
      window.electronAPI?.cancelSpeechTranscribe?.(pendingId);
      window.electronAPI?.cancelIntentRoute?.(pendingId);
    }
    setVoicePhase("idle");
    setVoiceMessage("");
    setVoiceCandidates([]);
    setIslandState("idle");
    window.electronAPI?.syncIslandState?.({ state: "idle" });
  }, []);

  const stopAndRouteVoice = useCallback(async () => {
    const api = window.electronAPI;
    if (!recorderRef.current || voicePhaseRef.current !== "listening" || !api?.transcribeSpeech) {
      return;
    }

    const requestId = crypto.randomUUID();
    voiceRequestIdRef.current = requestId;
    setVoicePhase("thinking");
    setVoiceMessage("Transcribing voice...");
    setVoiceCandidates([]);
    setIslandState("thinking");
    api.syncIslandState?.({ state: "thinking", subtitle: "Transcribing voice..." });

    try {
      const recorded = await recorderRef.current.stop();
      if (voiceRequestIdRef.current !== requestId) return;

      const sttRes = await api.transcribeSpeech({
        requestId,
        audioBase64: recorded.audioBase64,
        mimeType: recorded.mimeType,
      });
      if (voiceRequestIdRef.current !== requestId) return;

      if (!sttRes.ok) {
        if (sttRes.code === "CANCELLED") {
          setVoicePhase("idle");
          setIslandState("idle");
          api.syncIslandState?.({ state: "idle" });
          return;
        }
        throw new Error(sttRes.error);
      }

      const transcript = sttRes.text.trim();
      if (!transcript) {
        throw new Error("No speech detected. Please try again.");
      }

      const enabledRoutines = routines.filter((r) => r.enabled);
      if (!enabledRoutines.length) {
        throw new Error("No enabled routines available.");
      }

      setVoiceMessage(`"${transcript}"`);
      api.syncIslandState?.({ state: "thinking", subtitle: `"${transcript}"` });

      const aiRes = await api.routeIntent({
        requestId,
        text: transcript,
        routines: enabledRoutines.map(({ id, name, description, category, steps }) => ({
          id,
          name,
          description,
          category,
          stepTitles: steps.map((s) => s.title).filter(Boolean).slice(0, 20),
        })),
      });
      if (voiceRequestIdRef.current !== requestId) return;
      voiceRequestIdRef.current = null;

      if (!aiRes.ok) {
        if (aiRes.code === "CANCELLED") {
          setVoicePhase("idle");
          setIslandState("idle");
          api.syncIslandState?.({ state: "idle" });
          return;
        }
        throw new Error(aiRes.error);
      }

      const decision = aiRes.decision;
      if (decision.status === "match") {
        const matched = enabledRoutines.find((r) => r.id === decision.routineId);
        if (!matched) {
          throw new Error("Matched routine is no longer available.");
        }
        setVoicePhase("idle");
        setVoiceMessage("");
        handleRunRoutine(matched);
        return;
      }

      if (decision.status === "ambiguous") {
        const candidates = decision.candidateIds
          .map((id) => enabledRoutines.find((r) => r.id === id))
          .filter((r): r is Routine => Boolean(r));
        setVoicePhase("ambiguous");
        setVoiceMessage(`Multiple routines match "${transcript}":`);
        setVoiceCandidates(candidates);
        setIslandState("ambiguous");
        api.syncIslandState?.({
          state: "ambiguous",
          candidates,
          subtitle: `"${transcript}"`,
        });
        return;
      }

      throw new Error(`No matching routine found for "${transcript}".`);
    } catch (err) {
      if (voiceRequestIdRef.current !== requestId) return;
      voiceRequestIdRef.current = null;
      const msg = err instanceof Error ? err.message : "Voice command failed.";
      setVoicePhase("error");
      setVoiceMessage(msg);
      setIslandState("failed");
      api.syncIslandState?.({ state: "failed", error: msg });
    }
  }, [routines, handleRunRoutine]);

  const startVoiceCommand = useCallback(async () => {
    const now = Date.now();
    if (now - lastMasterTriggerAtRef.current < 250) {
      return;
    }
    lastMasterTriggerAtRef.current = now;

    // Ignore master hotkey while thinking, choosing ambiguous candidates, or executing a routine.
    if (
      runningRoutineIdRef.current ||
      voicePhaseRef.current === "thinking" ||
      voicePhaseRef.current === "ambiguous"
    ) {
      return;
    }

    if (voicePhaseRef.current === "listening") {
      await stopAndRouteVoice();
      return;
    }

    const api = window.electronAPI;
    if (!api?.transcribeSpeech) {
      handleSimulateVoice();
      return;
    }

    if (!recorderRef.current) {
      recorderRef.current = new AudioRecorder();
    }

    setVoiceCandidates([]);
    setVoiceMessage("Listening... Speak your command");
    setVoicePhase("listening");
    setIslandState("listening");
    api.syncIslandState?.({ state: "listening", subtitle: "Speak your command" });

    try {
      await recorderRef.current.start({
        maxDurationMs: 30_000,
        onMaxDurationReached: () => {
          void stopAndRouteVoice();
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not access microphone.";
      setVoicePhase("error");
      setVoiceMessage(msg);
      setIslandState("failed");
      api.syncIslandState?.({ state: "failed", error: msg });
    }
  }, [stopAndRouteVoice, cancelVoiceCommand]);

  const startVoiceRef = useRef(startVoiceCommand);
  startVoiceRef.current = startVoiceCommand;
  const stopVoiceRef = useRef(stopAndRouteVoice);
  stopVoiceRef.current = stopAndRouteVoice;
  const cancelVoiceRef = useRef(cancelVoiceCommand);
  cancelVoiceRef.current = cancelVoiceCommand;

  // In Electron, globalShortcut handles Ctrl+Space globally; keep in-app hotkey for browser preview only.
  useHotkeys({
    onTriggerVoice: () => void startVoiceRef.current(),
    enabled: !window.electronAPI,
  });

  const routinesRef = useRef(routines);
  routinesRef.current = routines;

  useEffect(() => {
    const isIslandActive =
      voicePhase === "listening" ||
      voicePhase === "thinking" ||
      voicePhase === "ambiguous" ||
      islandState === "executing";
    window.electronAPI?.setEscapeCancelActive?.(isIslandActive);
  }, [voicePhase, islandState]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onIslandAction) return;
    return api.onIslandAction((action) => {
      if (action === "start-voice") void startVoiceRef.current();
      if (action === "stop-listening") void stopVoiceRef.current();
      if (action === "cancel-voice") cancelVoiceRef.current();
      if (action === "escape-cancel") {
        if (runningRoutineIdRef.current) {
          runningRoutineIdRef.current = null;
          setRunningRoutineId(null);
          setIslandState("idle");
          api.cancelRoutine?.();
          api.syncIslandState?.({ state: "idle" });
        } else if (voicePhaseRef.current !== "idle") {
          cancelVoiceRef.current();
        }
      }
      if (action.startsWith("select-routine:")) {
        const id = action.slice("select-routine:".length);
        const picked = routinesRef.current.find((r) => r.id === id && r.enabled);
        if (picked) {
          setVoicePhase("idle");
          setVoiceMessage("");
          setVoiceCandidates([]);
          handleRunRoutine(picked);
        }
      }
    });
  }, [handleRunRoutine]);

  // Listen to IPC events from Electron Main
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const cleanupWake = api.onWakeDetected?.(() => {
      void startVoiceRef.current();
    });

    const cleanupStatus = api.onIslandStatus?.((status) => {
      if (status.isBusy) {
        setIslandState("executing");
        if (status.routine) {
          setActiveRoutine(status.routine);
          setRunningRoutineId(status.routine.id);
          runningRoutineIdRef.current = status.routine.id;
        }
      } else {
        setIslandState("idle");
        setRunningRoutineId(null);
        runningRoutineIdRef.current = null;
      }
    });

    const cleanupFinished = api.onRoutineFinished((result) => {
      if (result.routineId !== runningRoutineIdRef.current) return;
      runningRoutineIdRef.current = null;
      setRunningRoutineId(null);
      setIslandState(result.success ? "completed" : "failed");
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = setTimeout(() => {
        setIslandState("idle");
      }, 4000);
    });

    return () => {
      cleanupFinished();
      cleanupWake?.();
      cleanupStatus?.();
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
      if (activateTimer1.current) clearTimeout(activateTimer1.current);
      if (activateTimer2.current) clearTimeout(activateTimer2.current);
    };
  }, [routines]);

  const handleToggleEnabled = (id: string) => {
    sound.playPop(480);
    toggleRoutine(id);
  };

  const handleSaveRoutine = (updated: Routine) => {
    saveRoutine(updated);
    setEditingRoutine(null);
  };

  const handleDeleteRoutine = (id: string) => {
    sound.playPop(380);
    deleteRoutine(id);
    if (editingRoutine && editingRoutine.id === id) {
      setEditingRoutine(null);
    }
    if (runningRoutineId === id) {
      setRunningRoutineId(null);
    }
  };

  const handleCreateNewRoutine = () => {
    sound.playPop(560);
    const newRoutine: Routine = {
      id: `routine_${Date.now()}`,
      name: "",
      category: "work",
      icon: "✨",
      color: "strawberry",
      description: "",
      triggers: [],
      enabled: true,
      streakCount: 0,
      steps: [],
    };
    setEditingRoutine(newRoutine);
  };

  // Sort routines: enabled on top, disabled at the bottom
  const sortedRoutines = [...filteredRoutines].sort((a, b) => {
    if (a.enabled === b.enabled) return 0;
    return a.enabled ? -1 : 1;
  });

  return (
    <div className="flex flex-col h-screen w-screen bg-cream overflow-hidden font-sans text-ink">
      {/* Minimal Draggable Titlebar with Window Controls */}
      <TitleBar isListening={islandState === "listening"} />

      {/* Main Workspace Canvas (Full Width) */}
      <main className={`flex-1 overflow-y-auto flex flex-col ${!editingRoutine && activeScreen === "home" ? "flowy-home-viewport" : "p-6"}`}>
        {editingRoutine ? (
          <RoutineEditor
            routine={editingRoutine}
            onSave={handleSaveRoutine}
            onCancel={() => setEditingRoutine(null)}
            onDelete={handleDeleteRoutine}
            isNew={!routines.some((r) => r.id === editingRoutine.id)}
            existingRoutines={routines}
          />
        ) : activeScreen === "home" ? (
          <LandingPage
            onNavigate={(screen) => setActiveScreen(screen)}
            onCreateRoutine={handleCreateNewRoutine}
            onRunRoutine={handleRunRoutine}
            routines={routines}
            mascotState={mascotState}
            isBgmOn={isBgmOn}
            onToggleBgm={toggleBgm}
            voicePhase={voicePhase}
            voiceMessage={voiceMessage}
            voiceCandidates={voiceCandidates}
            masterHotkey={appSettings.masterHotkey}
            onToggleVoice={() => void startVoiceCommand()}
            onCancelVoice={cancelVoiceCommand}
          />
        ) : activeScreen === "settings" ? (
          <div className="space-y-6 max-w-3xl mx-auto w-full">
            <div className="flowy-sky-accent flex items-center justify-between gap-3 px-4 py-3">
              <button
                onClick={() => {
                  sound.playPop(480);
                  setActiveScreen("home");
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-cream-card hover:bg-cream border-2 border-cream-border font-extrabold text-xs text-ink transition-all active:translate-y-0.5 shadow-sm"
              >
                <ArrowLeft size={16} />
                <span>Home</span>
              </button>

              <h2 className="text-xl font-black text-ink">Settings</h2>

              <div className="w-20" />
            </div>

            <SettingsTab settings={appSettings} onUpdate={handleUpdateSettings} />
          </div>
        ) : (
          <div className="space-y-6 max-w-5xl mx-auto w-full">
            {/* Workspace Header: Back to Home + Title + Search + Create */}
            <div className="flowy-sky-accent flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    sound.playPop(480);
                    setActiveScreen("home");
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-cream-card hover:bg-cream border-2 border-cream-border font-extrabold text-xs text-ink transition-all active:translate-y-0.5 shadow-sm"
                  title="Back to Home"
                >
                  <ArrowLeft size={16} />
                  <span>Home</span>
                </button>

                <h1 className="text-2xl font-black text-ink tracking-tight">
                  My Routines
                </h1>
              </div>

              {/* Quick Search & Create & Sound */}
              <div className="flex items-center gap-2.5">
                <div className="relative w-full sm:w-60">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search routines..."
                    className="w-full text-xs font-bold pl-9 pr-4 py-2 rounded-2xl bg-cream-card border-2 border-cream-border focus:border-mint focus:outline-none text-ink shadow-sm"
                  />
                </div>

                <PushButton
                  variant="strawberry"
                  size="sm"
                  icon={<Plus size={15} strokeWidth={3} />}
                  onClick={handleCreateNewRoutine}
                >
                  New Routine
                </PushButton>

                {/* Sound toggle button */}
                <button
                  onClick={toggleMute}
                  className="w-9 h-9 rounded-2xl bg-cream-card hover:bg-cream border-2 border-cream-border flex items-center justify-center text-ink transition-all active:scale-95 shadow-sm"
                  title={isMuted ? "Unmute sound effects" : "Mute sound effects"}
                >
                  {isMuted ? (
                    <VolumeX size={15} className="text-strawberry" />
                  ) : (
                    <Volume2 size={15} className="text-mint-dark" />
                  )}
                </button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { id: "all", label: "🌟 All Routines" },
                { id: "work", label: "💼 Work & Code" },
                { id: "gaming", label: "🎮 Gaming" },
                { id: "chill", label: "☕ Chill & Media" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    sound.playPop(500);
                    setSelectedCategory(cat.id);
                  }}
                  className={`px-4 py-2 rounded-2xl font-extrabold text-xs transition-all border-2 ${
                    selectedCategory === cat.id
                      ? "bg-mint text-white border-mint-dark shadow-tactile-mint"
                      : "bg-cream-card text-ink-muted hover:text-ink border-cream-border hover:bg-cream"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Routine Cards 2-Column Grid */}
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
              <AnimatePresence mode="popLayout">
                {sortedRoutines.map((routine) => (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    onEdit={(r) => {
                      sound.playPop(520);
                      setEditingRoutine(r);
                    }}
                    onTestRun={handleRunRoutine}
                    onToggleEnabled={handleToggleEnabled}
                    onDelete={handleDeleteRoutine}
                    isRunning={runningRoutineId === routine.id && islandState !== "idle"}
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {sortedRoutines.length === 0 && (
              <div className="p-12 text-center flowy-sky-accent border-dashed">
                <Wand2 size={32} className="mx-auto text-ink-muted mb-2" />
                <h3 className="font-extrabold text-ink text-base">
                  No matching routines found
                </h3>
                <p className="text-xs font-bold text-ink-muted mt-1">
                  Try searching for something else, or create a brand new routine.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Dynamic Island ONLY for pure browser dev mode */}
      {!window.electronAPI && (
        <AnimatePresence>
          {islandState !== "idle" && (
            <motion.div
              initial={{ y: -70, opacity: 0, scale: 0.85 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -70, opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed top-0 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
            >
              <DynamicIsland
                activeRoutine={activeRoutine || routines[0]}
                state={islandState}
                onStateChange={setIslandState}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Wand2, ArrowLeft, Plus, Volume2, VolumeX } from "lucide-react";
import { Routine, IslandState } from "../types";
import {
  TitleBar,
  DynamicIsland,
  RoutineCard,
  RoutineEditor,
  DevLabTab,
  LandingPage,
  MascotState,
  PushButton,
} from "../components";
import { useRoutines, useHotkeys, useSoundEffect } from "../hooks";
import { sound } from "../utils/soundEffects";

export type AppScreen = "home" | "routines" | "lab";

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

  const { isMuted, toggleMute } = useSoundEffect();

  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [activeScreen, setActiveScreen] = useState<AppScreen>("home");

  // Dynamic Island & Voice State
  const [islandState, setIslandState] = useState<IslandState>("idle");
  const [runningRoutineId, setRunningRoutineId] = useState<string | null>(null);
  const runningRoutineIdRef = useRef<string | null>(null);
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [mascotState, setMascotState] = useState<MascotState>("idle");

  // Timers for safe serialization & single-thread lifecycle
  const autoResetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activateTimer1 = useRef<NodeJS.Timeout | null>(null);
  const activateTimer2 = useRef<NodeJS.Timeout | null>(null);

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

  // Bind global hotkey (Ctrl + Space / Alt + V)
  useHotkeys({
    onTriggerVoice: handleSimulateVoice,
    enabled: true,
  });

  // Listen to IPC events from Electron Main
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const cleanupWake = api.onWakeDetected?.(() => {
      handleSimulateVoice();
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
      setIslandState(result.success ? "completed" : "failed");
      if (autoResetTimerRef.current) clearTimeout(autoResetTimerRef.current);
      autoResetTimerRef.current = setTimeout(() => {
        setIslandState("idle");
        setRunningRoutineId(null);
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

  // Run a specific routine directly via the floating island
  const handleRunRoutine = (routine: Routine) => {
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
  };

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
            isMuted={isMuted}
            onToggleMute={toggleMute}
            isRoutineRunning={runningRoutineId !== null}
          />
        ) : activeScreen === "lab" ? (
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            {/* Top Bar with Back to Home */}
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

              <h2 className="text-xl font-black text-ink">Test Lab (Dev)</h2>

              <div className="w-20" />
            </div>

            <DevLabTab
              routines={routines}
              onTriggerIsland={() =>
                handleRunRoutine(routines.find((r) => r.enabled) || routines[0])
              }
              onSimulateVoice={handleSimulateVoice}
              isListening={islandState === "listening"}
            />
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

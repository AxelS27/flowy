import { FC, useState, useEffect, useRef } from "react";
import { IslandSurface } from "./IslandSurface";
import { Routine, IslandState } from "../../types";
import { sound } from "../../utils/soundEffects";
import { fireCelebrationConfetti } from "../../utils/confetti";

// UI dwell times only. Backend actions are never delayed for presentation.
const MINIMUM_EXECUTION_VISIBLE_MS = 2000;
const COMPLETION_VISIBLE_MS = 3000;

interface DynamicIslandProps {
  activeRoutine?: Routine | null;
  candidates?: Routine[];
  state?: IslandState;
  subtitle?: string;
  externalError?: string;
  onStateChange?: (state: IslandState) => void;
  onStopListening?: () => void;
  onCancelVoice?: () => void;
  onSelectCandidate?: (routine: Routine) => void;
  isStandaloneWindow?: boolean;
}

const stateDimensions: Record<
  IslandState,
  { width: number; height: number; borderRadius: number }
> = {
  idle: { width: 210, height: 32, borderRadius: 16 },
  listening: { width: 350, height: 56, borderRadius: 22 },
  thinking: { width: 320, height: 56, borderRadius: 22 },
  ambiguous: { width: 400, height: 118, borderRadius: 24 },
  executing: { width: 390, height: 156, borderRadius: 24 },
  completed: { width: 320, height: 56, borderRadius: 22 },
  failed: { width: 390, height: 148, borderRadius: 24 },
};

export const DynamicIsland: FC<DynamicIslandProps> = ({
  activeRoutine,
  candidates,
  state: externalState,
  subtitle,
  externalError,
  onStateChange,
  onStopListening,
  onCancelVoice,
  onSelectCandidate,
  isStandaloneWindow = false,
}) => {
  const [internalState, setInternalState] = useState<IslandState>(externalState || "idle");
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [skippedSteps, setSkippedSteps] = useState<Record<number, string>>({});
  const [runError, setRunError] = useState("");
  const activeRunIdRef = useRef<string | null>(null);
  const executionVisibleSinceRef = useRef(0);

  // Timer references for robust cleanup and serialization
  const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const celebrationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll references for auto-scrolling checklist items
  const stepItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const state = externalState !== undefined ? externalState : internalState;

  const setState = (s: IslandState) => {
    setInternalState(s);
    onStateChange?.(s);
  };

  // Clear all pending timeouts
  const clearAllTimers = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    stepTimerRef.current = null;
    finishTimerRef.current = null;
    exitTimerRef.current = null;
    celebrationTimerRef.current = null;
  };

  // Reset state and timers on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  // Reset exiting state whenever active state changes
  useEffect(() => {
    if (state !== "idle") {
      setIsExiting(false);
    }
  }, [state]);

  // Whenever activeRoutine changes, reset step index and clear timers cleanly
  const prevRoutineIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeRoutine && activeRoutine.id !== prevRoutineIdRef.current) {
      prevRoutineIdRef.current = activeRoutine.id;
      setCurrentStepIndex(0);
      setCompletedSteps([]);
      clearAllTimers();
    }
  }, [activeRoutine]);

  // Sound effects & state lifecycle
  useEffect(() => {
    clearAllTimers();

    if (state === "listening") {
      sound.playWakeChime();
      setCurrentStepIndex(0);
      setCompletedSteps([]);
    } else if (state === "executing") {
      executionVisibleSinceRef.current = performance.now();
      setCurrentStepIndex(0);
      setCompletedSteps([]);
      setSkippedSteps({});
      setRunError("");
    } else if (state === "completed") {
      sound.playFanfare();
      fireCelebrationConfetti();

      celebrationTimerRef.current = setTimeout(() => {
        setIsExiting(true);
        exitTimerRef.current = setTimeout(() => {
          setState("idle");
        }, 360);
      }, COMPLETION_VISIBLE_MS);
    }

    return () => {
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [state]);

  // Execute in Electron; browser mode keeps an explicitly labelled visual preview.
  useEffect(() => {
    if (state !== "executing" || !activeRoutine) return;
    const api = window.electronAPI;
    if (!api) {
      stepTimerRef.current = setTimeout(() => {
        if (currentStepIndex < activeRoutine.steps.length) {
          setCompletedSteps((prev) => [...prev, currentStepIndex]);
          setCurrentStepIndex((prev) => prev + 1);
        } else setState("completed");
      }, currentStepIndex < activeRoutine.steps.length ? 1000 :
        Math.max(0, MINIMUM_EXECUTION_VISIBLE_MS - (performance.now() - executionVisibleSinceRef.current)));
      return () => { if (stepTimerRef.current) clearTimeout(stepTimerRef.current); };
    }
    // Whole-routine execution is handled by a separate effect, not re-started per block.
  }, [state, currentStepIndex, activeRoutine]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api || state !== "executing" || !activeRoutine) return;
    let mounted = true;
    const runId = crypto.randomUUID();
    activeRunIdRef.current = runId;
    const unsubscribe = api.onStepProgress((progress) => {
      if (progress.runId !== runId) return;
      if (progress.status === "running") setCurrentStepIndex(progress.stepIndex);
      if (progress.status === "skipped") {
        setSkippedSteps((prev) => ({ ...prev, [progress.stepIndex]: progress.note || "Temporarily unavailable." }));
        setCompletedSteps((prev) => [...prev, progress.stepIndex]);
      }
      if (progress.status === "completed") {
        setCompletedSteps((prev) => [...prev, progress.stepIndex]);
        sound.playMarimba(progress.stepIndex);
      }
    });
    api.executeRoutine({ ...activeRoutine, runId }).then((result) => {
      if (!mounted) return;
      if (result.success) {
        // Keep the finished checklist readable even when an action takes milliseconds.
        const remaining = Math.max(0, MINIMUM_EXECUTION_VISIBLE_MS -
          (performance.now() - executionVisibleSinceRef.current));
        finishTimerRef.current = setTimeout(() => {
          if (mounted) setState("completed");
        }, remaining);
      } else {
        setRunError(result.error || "Routine failed.");
        setState("failed");
      }
    }).catch((error) => {
      if (mounted) {
        setRunError(error instanceof Error ? error.message : "Could not run routine.");
        setState("failed");
      }
    });
    return () => {
      mounted = false;
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
      unsubscribe();
      api.cancelRoutine(runId);
      if (activeRunIdRef.current === runId) activeRunIdRef.current = null;
    };
  }, [state, activeRoutine]);

  // Auto-scroll list to keep active running step visible
  useEffect(() => {
    if (state === "executing" && stepItemRefs.current[currentStepIndex]) {
      stepItemRefs.current[currentStepIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentStepIndex, state]);

  // Dynamic island height based on routine steps count
  const getExecutingHeight = () => {
    const stepCount = activeRoutine?.steps.length || 0;
    return 78 + Math.min(Math.max(stepCount, 1), 4) * 30;
  };

  const currentDim = {
    ...stateDimensions[state],
    height: state === "executing" ? getExecutingHeight() : stateDimensions[state].height,
  };

  useEffect(() => {
    if (!isStandaloneWindow) return;
    return () => window.electronAPI?.setIslandInteractive(false);
  }, [isStandaloneWindow]);

  return (
    <IslandSurface
      state={state}
      routine={activeRoutine}
      candidates={candidates}
      subtitle={subtitle}
      dimensions={currentDim}
      exiting={isExiting}
      standalone={isStandaloneWindow}
      currentStep={currentStepIndex}
      completedSteps={completedSteps}
      skippedSteps={skippedSteps}
      error={externalError || runError}
      registerStep={(index, element) => { stepItemRefs.current[index] = element; }}
      onStop={() => { if (activeRunIdRef.current) window.electronAPI?.cancelRoutine(activeRunIdRef.current); }}
      onStopListening={onStopListening}
      onCancelVoice={onCancelVoice}
      onSelectCandidate={onSelectCandidate}
      onDismiss={() => setState("idle")}
    />
  );
};

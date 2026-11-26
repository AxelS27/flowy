import React, { FC, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Trash2,
  Sliders,
  Terminal,
  Volume2,
  Globe,
  AppWindow,
  Check,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Plus,
  AlertCircle,
  Puzzle,
  Folder,
  Clipboard,
  Clock,
  Monitor,
  X,
} from "lucide-react";
import { Routine, RoutineStep, ActionType, RoutineColor } from "../../types";
import { PushButton } from "../common/PushButton";
import { sound } from "../../utils/soundEffects";
import { PALETTE_BLOCKS, PaletteBlock } from "../../data/actionCatalog";
import { ActionFields } from "./ActionFields";

interface RoutineEditorProps {
  routine: Routine;
  onSave: (updated: Routine) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onTestRunStart?: (routine: Routine) => void;
  isNew?: boolean;
  existingRoutines: Routine[];
}

const PALETTE_SECTIONS = [
  { id: "audio" as ActionType, title: "Audio and Volume", subtitle: "Speaker volume and microphone mute", icon: Volume2 },
  { id: "app" as ActionType, title: "Apps", subtitle: "Open and close applications", icon: AppWindow },
  { id: "web" as ActionType, title: "Web Workspace", subtitle: "Websites and search", icon: Globe },
  { id: "file" as ActionType, title: "Files and Folders", subtitle: "Open, create, organize and recycle", icon: Folder },
  { id: "clipboard" as ActionType, title: "Clipboard", subtitle: "Reusable text", icon: Clipboard },
  { id: "utility" as ActionType, title: "Timing and Messages", subtitle: "Wait, notify and confirm", icon: Clock },
  { id: "system" as ActionType, title: "Computer", subtitle: "Lock and power controls", icon: Monitor },
  { id: "focus" as ActionType, title: "Focus Assist", subtitle: "Temporarily skipped during execution", icon: Sliders },
  { id: "powershell" as ActionType, title: "Advanced", subtitle: "Custom PowerShell scripts", icon: Terminal },
];

const categoryTheme: Record<ActionType, { bg: string; border: string; text: string; light: string; icon: any }> = {
  file: { bg: "bg-mint", border: "border-mint-dark", text: "text-mint-dark", light: "bg-mint-light", icon: Folder },
  clipboard: { bg: "bg-blueberry", border: "border-blueberry-dark", text: "text-blueberry-dark", light: "bg-blueberry-light", icon: Clipboard },
  utility: { bg: "bg-sunny", border: "border-sunny-dark", text: "text-amber-700", light: "bg-sunny-light", icon: Clock },
  system: { bg: "bg-grape", border: "border-grape-dark", text: "text-grape-dark", light: "bg-grape-light", icon: Monitor },
  audio: { bg: "bg-strawberry", border: "border-strawberry-dark", text: "text-strawberry", light: "bg-strawberry-light", icon: Volume2 },
  app: { bg: "bg-mint", border: "border-mint-dark", text: "text-mint-dark", light: "bg-mint-light", icon: AppWindow },
  web: { bg: "bg-blueberry", border: "border-blueberry-dark", text: "text-blueberry-dark", light: "bg-blueberry-light", icon: Globe },
  powershell: { bg: "bg-grape", border: "border-grape-dark", text: "text-grape-dark", light: "bg-grape-light", icon: Terminal },
  focus: { bg: "bg-sunny", border: "border-sunny-dark", text: "text-amber-600", light: "bg-sunny-light", icon: Sliders },
};

const EMOJI_OPTIONS = ["✨", "💼", "🎮", "☕", "🚀", "🎵", "⚡", "🌙", "🎧", "🎯"];

const routineColorTheme: Record<RoutineColor, { bg: string; border: string; lightBg: string; text: string }> = {
  mint: { bg: "bg-mint", border: "border-mint-dark", lightBg: "bg-mint-light/60 border-mint/40", text: "text-mint-dark" },
  strawberry: { bg: "bg-strawberry", border: "border-strawberry-dark", lightBg: "bg-strawberry-light/60 border-strawberry/40", text: "text-strawberry-dark" },
  blueberry: { bg: "bg-blueberry", border: "border-blueberry-dark", lightBg: "bg-blueberry-light/60 border-blueberry/40", text: "text-blueberry-dark" },
  sunny: { bg: "bg-sunny", border: "border-sunny-dark", lightBg: "bg-sunny-light/60 border-sunny/40", text: "text-amber-700" },
  grape: { bg: "bg-grape", border: "border-grape-dark", lightBg: "bg-grape-light/60 border-grape/40", text: "text-grape-dark" },
};

interface DraggingPayload {
  source: "palette" | "board";
  template?: PaletteBlock;
  step?: RoutineStep;
  originalIndex?: number;
}

export const RoutineEditor: FC<RoutineEditorProps> = ({
  routine,
  onSave,
  onCancel,
  onDelete,
  isNew = false,
  existingRoutines,
}) => {
  // Always start at profile stage first (both for new and edit)
  const [stage, setStage] = useState<"profile" | "playground">("profile");

  // Profile fields
  const [name, setName] = useState(routine.name);
  const [icon, setIcon] = useState(routine.icon);
  const [color, setColor] = useState<RoutineColor>(routine.color);

  // Pipeline Steps
  const [steps, setSteps] = useState<RoutineStep[]>([...routine.steps]);
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [paletteSearch, setPaletteSearch] = useState("");
  const runningRef = useRef(false);
  const activeRunIdRef = useRef<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [skippedSteps, setSkippedSteps] = useState<Record<number, string>>({});
  const [expandedProSteps, setExpandedProSteps] = useState<Record<string, boolean>>({});

  // Palette Layer Navigation: null = Layer 1 (Categories Directory), ActionType = Layer 2 (Section Blocks)
  const [activePaletteSection, setActivePaletteSection] = useState<ActionType | null>(null);

  // CUSTOM POINTER-BASED PUZZLE DRAG SYSTEM
  const [draggingPayload, setDraggingPayload] = useState<DraggingPayload | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropSlotIndex, setDropSlotIndex] = useState<number | null>(null);
  const [isOverPalette, setIsOverPalette] = useState(false);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stepElementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const doneResetTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (doneResetTimerRef.current) {
        clearTimeout(doneResetTimerRef.current);
      }
    };
  }, []);

  // Validation
  const trimmedName = name.trim();
  const isDuplicateName = existingRoutines.some(
    (r) => r.id !== routine.id && r.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  const isNameInvalid = trimmedName.length === 0 || isDuplicateName;
  const isSaveDisabled = isNameInvalid;

  const toggleProTray = (stepId: string) => {
    sound.playPop(520);
    setExpandedProSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Helper to create a new step from template
  const createStepFromTemplate = (template: PaletteBlock): RoutineStep => ({
    id: `step_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type: template.type,
    action: template.action,
    secondaryParam: template.defaultSecondaryParam,
    title: template.title,
    subtitle: template.subtitle,
    param: template.defaultParam,
    proScript: template.defaultScript,
    delayMs: 0,
  });

  const handleRemoveStep = (stepId: string) => {
    sound.playPop(360);
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  };

  const handleClearBlocks = () => {
    if (steps.length === 0 || isTestRunning) return;
    sound.playPop(360);
    setSteps([]);
  };

  // -------------------------------------------------------------
  // REALTIME POINTER DRAG CONTROLLER (STAYS UNDER CURSOR!)
  // -------------------------------------------------------------
  const startDragFromPalette = (e: React.PointerEvent, template: PaletteBlock) => {
    if (isTestRunning) return;
    e.preventDefault();
    sound.playPop(600);
    setCursorPos({ x: e.clientX, y: e.clientY });
    setDraggingPayload({ source: "palette", template });
  };

  const startDragFromBoard = (e: React.PointerEvent, step: RoutineStep, index: number) => {
    if (isTestRunning) return;
    e.preventDefault();
    sound.playPop(580);
    setCursorPos({ x: e.clientX, y: e.clientY });
    setDraggingPayload({ source: "board", step, originalIndex: index });
  };

  useEffect(() => {
    if (!draggingPayload) return;

    const handlePointerMove = (e: PointerEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });

      // Over palette sidebar (x <= 290)
      const overPalette = e.clientX <= 290;
      setIsOverPalette(overPalette);

      // Calculate insertion index over canvas
      if (!overPalette && canvasRef.current) {
        const itemDoms = stepElementsRef.current.filter(Boolean) as HTMLDivElement[];
        let targetIndex = itemDoms.length;

        for (let i = 0; i < itemDoms.length; i++) {
          const rect = itemDoms[i].getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (e.clientY < midY) {
            targetIndex = i;
            break;
          }
        }
        setDropSlotIndex(targetIndex);
      } else {
        setDropSlotIndex(null);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      const overPalette = e.clientX <= 290;

      if (overPalette) {
        if (draggingPayload.source === "board" && draggingPayload.step) {
          handleRemoveStep(draggingPayload.step.id);
        } else {
          sound.playPop(350);
        }
      } else if (dropSlotIndex !== null) {
        // Snap puzzle block into pipeline!
        sound.playPuzzleSnap();
        if (draggingPayload.source === "palette" && draggingPayload.template) {
          const newStep = createStepFromTemplate(draggingPayload.template);
          setSteps((prev) => {
            const next = [...prev];
            next.splice(dropSlotIndex, 0, newStep);
            return next;
          });
        } else if (
          draggingPayload.source === "board" &&
          draggingPayload.step &&
          draggingPayload.originalIndex !== undefined
        ) {
          const origIdx = draggingPayload.originalIndex;
          setSteps((prev) => {
            const next = [...prev];
            const [moved] = next.splice(origIdx, 1);
            // Adjust insertion index if moving downwards
            const insertIdx = origIdx < dropSlotIndex ? dropSlotIndex - 1 : dropSlotIndex;
            next.splice(Math.max(0, insertIdx), 0, moved);
            return next;
          });
        }
      }

      setDraggingPayload(null);
      setDropSlotIndex(null);
      setIsOverPalette(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingPayload, dropSlotIndex]);

  useEffect(() => () => {
    if (activeRunIdRef.current) window.electronAPI?.cancelRoutine(activeRunIdRef.current);
  }, []);

  const handleTestRun = async () => {
    if (runningRef.current || steps.length === 0) return;
    const api = window.electronAPI;
    if (!api) {
      setRunError("Open Flowy in the desktop app to execute Windows actions.");
      return;
    }
    const runId = crypto.randomUUID();
    activeRunIdRef.current = runId;
    runningRef.current = true;
    setIsTestRunning(true);
    setRunError(null);
    setCompletedSteps([]);
    setSkippedSteps({});
    const unsubscribe = api.onStepProgress((progress) => {
      if (progress.runId !== runId) return;
      if (progress.status === "running") setActiveStepIndex(progress.stepIndex);
      if (progress.status === "skipped") {
        setSkippedSteps((prev) => ({ ...prev, [progress.stepIndex]: progress.note || "Temporarily unavailable." }));
      }
      if (progress.status === "completed") {
        setCompletedSteps((prev) => [...prev, progress.stepIndex]);
        sound.playMarimba(progress.stepIndex);
      }
    });
    try {
      const result = await api.executeRoutine({ id: routine.id, steps, runId });
      if (!result.success) {
        setRunError(result.stepIndex !== undefined && result.stepIndex >= 0
          ? `Block #${result.stepIndex + 1}: ${result.error}` : result.error || "Routine failed.");
      } else {
        sound.playFanfare();
      }
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Could not execute routine.");
    } finally {
      unsubscribe();
      runningRef.current = false;
      activeRunIdRef.current = null;
      setActiveStepIndex(-1);
      setIsTestRunning(false);
    }
  };

  const handleSaveAll = () => {
    if (isNameInvalid) {
      sound.playPop(350);
      setStage("profile");
      return;
    }
    sound.playPop(580);
    onSave({
      ...routine,
      name: trimmedName,
      icon,
      color,
      steps,
    });
  };

  const draggedActiveType =
    draggingPayload?.template?.type || draggingPayload?.step?.type || "audio";
  const draggedTheme = categoryTheme[draggedActiveType];
  const DraggedIcon = draggedTheme.icon;

  return (
    <div className="flex flex-col h-full w-full select-none overflow-hidden relative">
      {/* ------------------------------------------------------------- */}
      {/* FLOATING PUZZLE BLOCK FOLLOWER (LITERALLY AT YOUR CURSOR!) */}
      {/* ------------------------------------------------------------- */}
      {draggingPayload && (
        <div
          style={{
            position: "fixed",
            left: cursorPos.x,
            top: cursorPos.y,
            transform: "translate(-50%, -50%) rotate(2.5deg)",
            pointerEvents: "none",
            zIndex: 99999,
          }}
          className="filter drop-shadow-2xl select-none"
        >
          {/* Puzzle Block Visual Container with Interlocking Tabs */}
          <div
            className={`w-72 p-3.5 rounded-3xl border-3 shadow-2xl flex items-center justify-between text-white ${draggedTheme.bg} ${draggedTheme.border} relative`}
          >
            {/* Top Puzzle Notch Socket (凹) */}
            <div className="w-12 h-2.5 rounded-b-xl bg-cream border-b-2 border-x-2 border-cream-border absolute -top-0.5 left-1/2 -translate-x-1/2" />

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center text-white shadow-inner flex-shrink-0">
                <DraggedIcon size={18} />
              </div>
              <div className="text-left">
                <h4 className="font-black text-xs text-white">
                  {draggingPayload.template?.title || draggingPayload.step?.title}
                </h4>
                <p className="text-[10px] font-bold text-white/80">
                  {draggingPayload.template?.subtitle || draggingPayload.step?.subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-90 pr-1">
              <Puzzle size={14} className="animate-spin" />
            </div>

            {/* Bottom Puzzle Protrusion Tab (凸) */}
            <div
              className={`w-12 h-3 rounded-b-xl border-b-2 border-x-2 absolute -bottom-3 left-1/2 -translate-x-1/2 shadow-sm ${draggedTheme.bg} ${draggedTheme.border}`}
            />
          </div>
        </div>
      )}

      {/* STAGE 1: ROUTINE PROFILE SETUP */}
      {stage === "profile" ? (
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center justify-center max-w-2xl mx-auto w-full space-y-6">
          <div className="flowy-sky-accent w-full text-center space-y-1 px-4 py-4">
            <h2 className="text-3xl font-black text-ink tracking-tight">
              {isNew ? "Setup Routine Profile" : "Edit Routine Profile"}
            </h2>
            <p className="text-xs font-bold text-ink-muted">
              {isNew
                ? "Choose a unique name and icon before building action blocks."
                : "Update this routine's name, icon, and accent color."}
            </p>
          </div>

          <div className="bg-cream-card rounded-[36px] p-8 border-2 border-cream-border shadow-tactile-card w-full space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-ink-muted uppercase tracking-wider block">
                Routine Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Deep Focus Mode"
                className={`w-full text-lg font-black px-4 py-2.5 rounded-2xl bg-cream border-2 focus:outline-none transition-colors text-ink ${
                  isDuplicateName
                    ? "border-strawberry bg-strawberry-light/40"
                    : "border-cream-border focus:border-mint"
                }`}
              />

              {isDuplicateName && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-xs font-black text-strawberry pt-1"
                >
                  <AlertCircle size={14} />
                  <span>Oops! A routine named "{trimmedName}" already exists. Please choose a unique name!</span>
                </motion.div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t-2 border-dashed border-cream-border">
              {/* Choose Icon with uniform grid and identical box dimensions */}
              <div className="space-y-2">
                <label className="text-xs font-black text-ink-muted uppercase tracking-wider block">
                  Choose Icon
                </label>
                <div className="flex items-center gap-3">
                  <motion.div
                    key={`${icon}-${color}-box`}
                    initial={{ scale: 0.9, rotate: -3 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl shadow-tactile-sm flex-shrink-0 transition-colors duration-200 ${routineColorTheme[color].bg} ${routineColorTheme[color].border} ${color === "sunny" ? "text-slate-900" : "text-white"}`}
                  >
                    {icon}
                  </motion.div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {EMOJI_OPTIONS.map((emoji) => {
                      const isSelected = icon === emoji;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            sound.playPop(520);
                            setIcon(emoji);
                          }}
                          className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center text-base transition-all select-none leading-none ${
                            isSelected
                              ? `${routineColorTheme[color].border} ${routineColorTheme[color].lightBg} shadow-sm font-black`
                              : "border-cream-border bg-cream hover:bg-cream-dark text-ink"
                          }`}
                        >
                          <span>{emoji}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Accent Color with uniform button size and equal margins */}
              <div className="space-y-2">
                <label className="text-xs font-black text-ink-muted uppercase tracking-wider block">
                  Accent Color
                </label>
                <div className="flex items-center gap-2.5 pt-2">
                  {(['mint', 'strawberry', 'blueberry', 'sunny', 'grape'] as const).map((c) => {
                    const isSelected = color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          sound.playPop(500);
                          setColor(c);
                        }}
                        className={`w-9 h-9 rounded-2xl border-2 flex items-center justify-center transition-all ${
                          c === 'mint'
                            ? 'bg-mint border-mint-dark text-white'
                            : c === 'strawberry'
                            ? 'bg-strawberry border-strawberry-dark text-white'
                            : c === 'blueberry'
                            ? 'bg-blueberry border-blueberry-dark text-white'
                            : c === 'sunny'
                            ? 'bg-sunny border-sunny-dark text-slate-900'
                            : 'bg-grape border-grape-dark text-white'
                        } ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-ink/30 shadow-md'
                            : 'opacity-80 hover:opacity-100 hover:brightness-105'
                        }`}
                        title={c}
                      >
                        {isSelected && <Check size={14} strokeWidth={3.5} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          <div className="flex items-center justify-between w-full pt-2">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cream-card hover:bg-cream border-2 border-cream-border font-extrabold text-xs text-ink transition-all active:translate-y-0.5 shadow-sm"
              title="Cancel and discard changes"
            >
              <ArrowLeft size={16} />
              <span>Cancel</span>
            </button>

            {isNew ? (
              /* If routine is new: unite with Save button to continue directly to configuration */
              <PushButton
                variant="mint"
                size="md"
                icon={<Check size={16} strokeWidth={3} />}
                onClick={() => {
                  if (isSaveDisabled) {
                    sound.playPop(350);
                    return;
                  }
                  sound.playPop(600);
                  setStage("playground");
                }}
                disabled={isSaveDisabled}
                title="Save profile and continue to configuration"
              >
                Save
              </PushButton>
            ) : (
              /* If editing existing routine: Configure, Delete, Save */
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* 1. Configure actions: goes to the Scratch action blocks playground */}
                <PushButton
                  variant="blueberry"
                  size="md"
                  icon={<Sliders size={15} />}
                  onClick={() => {
                    if (isSaveDisabled) {
                      sound.playPop(350);
                      return;
                    }
                    sound.playPop(600);
                    setStage("playground");
                  }}
                  disabled={isSaveDisabled}
                  title="Configure action blocks"
                >
                  Configure
                </PushButton>

                {/* 2. Delete Routine */}
                {onDelete && (
                  <PushButton
                    variant="strawberry"
                    size="md"
                    icon={<Trash2 size={15} />}
                    onClick={() => onDelete(routine.id)}
                    title="Delete this routine"
                  >
                    Delete
                  </PushButton>
                )}

                {/* 3. Save Routine and return */}
                <PushButton
                  variant="mint"
                  size="md"
                  icon={<Check size={16} strokeWidth={3} />}
                  onClick={handleSaveAll}
                  disabled={isSaveDisabled}
                  title="Save routine and return"
                >
                  Save
                </PushButton>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STAGE 2: SCRATCH PUZZLE PLAYGROUND */
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Top Bar */}
          <div className="h-14 bg-[#E8F7FF] border-b-2 border-[#D3EAF5] px-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              {/* Direct Close Button: Red tactile button */}
              <PushButton
                variant="strawberry"
                size="sm"
                icon={<X size={13} strokeWidth={2.5} />}
                onClick={() => {
                  sound.playPop(420);
                  onCancel();
                }}
                title="Close editor and return to routines"
              >
                Close
              </PushButton>

              {/* Back to Profile Setup */}
              <PushButton
                variant="ghost"
                size="sm"
                icon={<ArrowLeft size={13} />}
                onClick={() => {
                  sound.playPop(480);
                  setStage("profile");
                }}
                title="Edit routine profile"
              >
                Profile
              </PushButton>

              <div className="flex items-center gap-2 px-3 py-1 rounded-2xl bg-cream border-2 border-cream-border shadow-sm">
                <span className="text-xl">{icon}</span>
                <span className="font-black text-xs text-ink">{trimmedName || "Untitled"}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Clear Blocks Button */}
              <PushButton
                variant="ghost"
                size="sm"
                icon={<Trash2 size={13} />}
                onClick={handleClearBlocks}
                disabled={isTestRunning || steps.length === 0}
                title="Clear all blocks from pipeline"
              >
                Clear
              </PushButton>

              {isTestRunning && <PushButton variant="ghost" size="sm"
                onClick={() => { if (activeRunIdRef.current) window.electronAPI?.cancelRoutine(activeRunIdRef.current); }}>Stop</PushButton>}
              {/* Execute real Windows actions */}
              <PushButton
                variant="sunny"
                size="sm"
                icon={<Play size={13} className={isTestRunning ? "animate-spin" : ""} />}
                onClick={handleTestRun}
                disabled={isTestRunning || steps.length === 0}
                title="Run real actions on your computer"
              >
                {isTestRunning ? "Running..." : "Run"}
              </PushButton>

              {/* Save Routine */}
              <PushButton
                variant="mint"
                size="sm"
                icon={<Check size={14} strokeWidth={3} />}
                onClick={handleSaveAll}
                disabled={isTestRunning}
                title="Save routine"
              >
                Save
              </PushButton>
            </div>
          </div>

          {runError && <div role="alert" className="px-5 py-3 bg-strawberry-light text-strawberry-dark text-xs font-bold border-b-2 border-strawberry-dark">{runError}</div>}
          <div className="px-5 py-2 text-xs font-semibold text-ink-muted border-b border-cream-border">Run executes real actions. Deletes use Recycle Bin; power and custom script actions ask for confirmation.</div>
          {/* Playground Main Layout: Scratch Palette (Left) + Puzzle Assembly Line (Right) */}
          <div className="flex flex-1 overflow-hidden">
            {/* LEFT: Scratch Action Block Palette (~280px) */}
            <aside
              className={`w-72 border-r-2 flex flex-col flex-shrink-0 select-none transition-colors relative overflow-hidden ${
                isOverPalette
                  ? "bg-strawberry-light border-strawberry-dark ring-4 ring-strawberry/40"
                  : "bg-cream-card border-cream-border"
              }`}
            >
              {/* Drop to Delete Overlay on Sidebar (Appears immediately when user drags a canvas block!) */}
              <AnimatePresence>
                {draggingPayload?.source === "board" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center border-2 transition-all ${
                      isOverPalette
                        ? "bg-strawberry border-strawberry-dark text-white shadow-2xl"
                        : "bg-strawberry-light/95 border-strawberry-dark/50 text-strawberry"
                    }`}
                  >
                    <Trash2
                      size={isOverPalette ? 48 : 40}
                      className={`mb-3 transition-transform ${isOverPalette ? "animate-bounce scale-110 text-white" : "text-strawberry"}`}
                    />
                    <p className={`font-black text-sm uppercase tracking-wider ${isOverPalette ? "text-white" : "text-strawberry"}`}>
                      {isOverPalette ? "Release to Delete Block!" : "Drop here to delete block"}
                    </p>
                    <p className={`text-[11px] font-bold mt-1 ${isOverPalette ? "text-white/90" : "text-strawberry/80"}`}>
                      {isOverPalette ? "Release mouse to remove" : "Drag into this sidebar to remove"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <label className="p-4 pb-0">
                <span className="sr-only">Search blocks</span>
                <input value={paletteSearch} onChange={(e) => setPaletteSearch(e.target.value)}
                  placeholder="Search blocks..." className="w-full px-3 py-2 rounded-xl border-2 border-cream-border bg-cream text-xs font-bold text-ink focus:outline-none focus:border-mint" />
              </label>
              {/* Scrollable Palette Content (Two-Layered Navigation) */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
                {/* LAYER 1: CATEGORIES DIRECTORY */}
                {activePaletteSection === null && !paletteSearch.trim() ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1.5 border-b-2 border-dashed border-cream-border">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🧩</span>
                        <h3 className="font-black text-xs uppercase tracking-wider text-ink">
                          Action Categories
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {PALETTE_SECTIONS.map((sec) => {
                        const theme = categoryTheme[sec.id];
                        const SecIcon = sec.icon;

                        return (
                          <button
                            key={sec.id}
                            onClick={() => {
                              sound.playPop(520);
                              setActivePaletteSection(sec.id);
                            }}
                            className={`w-full p-3.5 rounded-2xl border-2 transition-all text-left bg-cream-card hover:bg-cream shadow-sm hover:shadow-md active:translate-y-0.5 flex items-center justify-between group ${theme.border}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${theme.bg}`}
                              >
                                <SecIcon size={18} />
                              </div>
                              <div>
                                <h4 className="font-black text-xs text-ink group-hover:text-slate-900">
                                  {sec.title}
                                </h4>
                                <p className="text-[10px] font-bold text-ink-muted">
                                  {sec.subtitle}
                                </p>
                              </div>
                            </div>

                            <ArrowRight
                              size={15}
                              className="text-ink-muted group-hover:translate-x-1 group-hover:text-ink transition-transform flex-shrink-0 mr-1"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* LAYER 2: BLOCKS INSIDE SELECTED SECTION */
                  <div className="space-y-3">
                    {/* Header with Back Button */}
                    <div className="flex items-center justify-between pb-1.5 border-b-2 border-dashed border-cream-border">
                      <button
                        onClick={() => {
                          sound.playPop(480);
                          setActivePaletteSection(null);
                          setPaletteSearch("");
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cream hover:bg-cream-dark border-2 border-cream-border text-xs font-black text-ink transition-all active:scale-95 shadow-sm"
                        title="Back to All Categories"
                      >
                        <ArrowLeft size={13} />
                        <span>Categories</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-ink">
                          {paletteSearch.trim() ? "Search results" : PALETTE_SECTIONS.find((s) => s.id === activePaletteSection)?.title}
                        </span>
                      </div>
                    </div>

                    {!PALETTE_BLOCKS.some((b) => paletteSearch.trim()
                      ? `${b.title} ${b.subtitle}`.toLowerCase().includes(paletteSearch.trim().toLowerCase())
                      : b.category === activePaletteSection) && <p role="status" className="text-xs font-bold text-ink-muted py-3">No matching blocks.</p>}
                    {/* Draggable Blocks inside this Category */}
                    <div className="space-y-2">
                      {PALETTE_BLOCKS.filter((b) => paletteSearch.trim()
                        ? `${b.title} ${b.subtitle}`.toLowerCase().includes(paletteSearch.trim().toLowerCase())
                        : b.category === activePaletteSection).map(
                        (block, idx) => {
                          const theme = categoryTheme[block.type];
                          const IconComponent = theme.icon;

                          return (
                            <div
                              key={idx}
                              onPointerDown={(e) => startDragFromPalette(e, block)}
                              className={`group p-3.5 rounded-2xl border-2 transition-all cursor-grab active:cursor-grabbing bg-cream-card hover:bg-cream shadow-sm hover:shadow-md flex items-center justify-between relative select-none ${theme.border}`}
                              title="Drag puzzle piece to pipeline"
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0 ${theme.bg}`}
                                >
                                  <IconComponent size={16} />
                                </div>
                                <div className="truncate text-left">
                                  <p className="font-black text-xs text-ink group-hover:text-slate-900 truncate">
                                    {block.title}
                                  </p>
                                  <p className="text-[10px] font-bold text-ink-muted truncate">
                                    {block.subtitle}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 text-ink-muted group-hover:text-ink flex-shrink-0">
                                <GripVertical size={16} className="opacity-50 group-hover:opacity-100" />
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t-2 border-dashed border-cream-border text-[11px] font-bold text-ink-muted">
                  <p>
                    {activePaletteSection === null && !paletteSearch.trim()
                      ? "💡 Click any category above to open its action blocks!"
                      : "🧩 Drag any block from here and drop it into the pipeline!"}
                  </p>
                </div>
              </div>
            </aside>

            {/* RIGHT: Mainboard Canvas (Puzzle Assembly Line) */}
            <main
              ref={canvasRef}
              className="flex-1 overflow-y-auto p-6 flex flex-col items-center bg-cream transition-colors relative"
            >
              <div className="max-w-2xl w-full flex flex-col items-center space-y-2 pb-24">
                {/* 1. Automatic Permanent Root Hat Block: "When start" */}
                <div className="w-full rounded-t-[36px] rounded-b-2xl p-4 bg-sunny border-2 border-sunny-dark shadow-tactile-sunny flex items-center justify-between relative select-none">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-white/30 border border-slate-900/10 flex items-center justify-center text-xl shadow-inner">
                      🚩
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight leading-tight">
                        When start
                      </h3>
                      <p className="text-xs font-extrabold text-amber-900 mt-0.5">
                        Run "{trimmedName}"
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-black px-2.5 py-1 rounded-xl bg-white/40 border border-slate-900/10 text-slate-900 uppercase tracking-wider">
                    Event
                  </span>

                  {/* Interlocking Bottom Protrusion Tab (凸) locking into block #1 */}
                  <div className="w-14 h-3.5 rounded-b-xl border-b-2 border-x-2 absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-10 shadow-sm bg-sunny border-sunny-dark" />
                </div>

                {/* Drop slot indicator right under "When start" (slot 0) */}
                {dropSlotIndex === 0 && draggingPayload !== null && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 60 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full rounded-3xl border-3 border-dashed border-mint bg-mint-light/40 flex items-center justify-center text-mint-dark font-black text-xs gap-2 shadow-inner my-1.5"
                  >
                    <Plus size={16} className="animate-bounce" />
                    <span>Place here</span>
                  </motion.div>
                )}

                {/* Snapped Puzzle Blocks Pipeline */}
                {steps.map((step, index) => {
                  const theme = categoryTheme[step.type] || categoryTheme.audio;
                  const IconComponent = theme.icon;
                  const isCurrent = activeStepIndex === index;
                  const isCompleted = completedSteps.includes(index);
                  const skipReason = skippedSteps[index];
                  const isProExpanded = expandedProSteps[step.id] || false;
                  const isSlotHere = dropSlotIndex === index && draggingPayload !== null;

                  return (
                    <React.Fragment key={step.id}>
                      {/* Glow Snap Slot Indicator when dragging over this position! */}
                      {isSlotHere && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 60 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="w-full rounded-3xl border-3 border-dashed border-mint bg-mint-light/40 flex items-center justify-center text-mint-dark font-black text-xs gap-2 shadow-inner my-1"
                        >
                          <Plus size={16} className="animate-bounce" />
                          <span>Place here</span>
                        </motion.div>
                      )}

                      <div
                        ref={(el) => (stepElementsRef.current[index] = el)}
                        className="w-full flex flex-col items-center relative"
                      >
                        {/* The Snapped Interlocking Puzzle Block (Can be dragged from anywhere on the card!) */}
                        <div
                          onPointerDown={(e) => {
                            const target = e.target as HTMLElement;
                            if (target.closest("input, select, textarea, button, a")) {
                              return;
                            }
                            startDragFromBoard(e, step, index);
                          }}
                          className={`w-full rounded-3xl p-4 bg-cream-card border-2 transition-all shadow-tactile-card relative cursor-grab active:cursor-grabbing select-none ${
                            isCurrent
                              ? "border-sunny ring-4 ring-sunny/30 scale-[1.01]"
                              : isCompleted
                              ? "border-mint shadow-[0_4px_0_#14B8A6]"
                              : theme.border
                          }`}
                        >
                          {/* Interlocking Top Socket Cutout (凹) */}
                          <div className="w-14 h-3 rounded-b-xl bg-cream border-b-2 border-x-2 border-cream-border absolute -top-0.5 left-1/2 -translate-x-1/2 shadow-inner" />

                          <div className="flex items-center justify-between gap-3">
                            {/* Left: Drag Grip Handle + Step Number + Icon + Title */}
                            <div className="flex items-center gap-3">
                              {/* Grab Handle */}
                              <div
                                className="p-1 rounded-xl text-ink-muted hover:text-ink transition-colors flex items-center justify-center opacity-60 hover:opacity-100"
                                title="Grab anywhere on the card to drag & reorder"
                              >
                                <GripVertical size={16} />
                              </div>

                              <div
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm border-2 ${theme.bg} ${theme.border} shadow-sm flex-shrink-0`}
                              >
                                <IconComponent size={18} />
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-ink-muted">
                                    #{index + 1}
                                  </span>
                                  <h4 className="font-black text-ink text-sm">
                                    {step.title}
                                  </h4>
                                </div>
                                <p className="text-xs font-bold text-ink-muted">
                                  {step.subtitle}
                                </p>
                              </div>
                            </div>

                            {/* Right: Status badge & Pro Settings Toggle */}
                            <div className="flex items-center gap-2">
                              <AnimatePresence>
                                {skipReason && <span title={skipReason} className="text-xs font-black text-amber-700 bg-sunny-light px-2.5 py-1 rounded-xl border border-sunny-dark">Skipped</span>}
                                {isCompleted && !isCurrent && (
                                  <motion.span
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={{ duration: 0.2 }}
                                    className="inline-flex items-center gap-1 text-xs font-black text-mint-dark bg-mint-light px-2.5 py-1 rounded-xl border border-mint-dark"
                                  >
                                    <CheckCircle2 size={13} /> Done
                                  </motion.span>
                                )}
                              </AnimatePresence>

                              {isCurrent && (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-slate-900 bg-sunny px-2.5 py-1 rounded-xl border border-sunny-dark animate-pulse">
                                  Running...
                                </span>
                              )}

                              {!step.action && <button
                                onClick={() => toggleProTray(step.id)}
                                className={`px-2.5 py-1 rounded-xl font-extrabold text-xs border transition-all ${
                                  isProExpanded
                                    ? "bg-slate-800 text-white border-slate-900"
                                    : "bg-cream hover:bg-cream-dark text-ink-muted border-cream-border"
                                }`}
                                title="Legacy script reference and execution timing"
                              >
                                {isProExpanded ? "Hide Pro ⚙️" : "Pro ⚙️"}
                              </button>}
                            </div>
                          </div>

                          {/* Inline Quick Parameter (Dropdowns or Slider) */}
                          <div className="mt-3 pt-2.5 border-t border-dashed border-cream-border flex items-center justify-between gap-4 text-xs font-bold text-ink">
                            {/* Option 1: Mute / Unmute Dropdown */}
                            {step.action ? (
                              <fieldset disabled={isTestRunning} className="w-full"><ActionFields step={step} onChange={(changes) => setSteps((prev) =>
                                prev.map((s) => s.id === step.id ? { ...s, ...changes } : s))} /></fieldset>
                            ) : step.type === "audio" &&
                            (step.param === "mute_mic" ||
                              step.param === "unmute_mic" ||
                              step.param === "mute_audio" ||
                              step.param === "unmute_audio") ? (
                              <div className="flex items-center gap-2.5 w-full">
                                <span className="text-ink-muted text-xs font-bold">Action:</span>
                                <select
                                  value={step.param}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const title =
                                      val === "mute_mic"
                                        ? "Mute Microphone"
                                        : val === "unmute_mic"
                                        ? "Unmute Microphone"
                                        : val === "mute_audio"
                                        ? "Mute Audio Output"
                                        : "Unmute Audio Output";
                                    setSteps((prev) =>
                                      prev.map((s) =>
                                        s.id === step.id
                                          ? {
                                              ...s,
                                              param: val,
                                              title,
                                              subtitle: title,
                                              proScript:
                                                val === "mute_mic"
                                                  ? "Set-AudioEndpointMute -Endpoint Microphone -State $true"
                                                  : val === "unmute_mic"
                                                  ? "Set-AudioEndpointMute -Endpoint Microphone -State $false"
                                                  : val === "mute_audio"
                                                  ? "Set-AudioEndpointMute -Endpoint Speaker -State $true"
                                                  : "Set-AudioEndpointMute -Endpoint Speaker -State $false",
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-cream border border-cream-border text-xs font-black text-ink focus:outline-none focus:border-strawberry cursor-pointer"
                                >
                                  <option value="mute_mic">Mute Microphone</option>
                                  <option value="unmute_mic">Unmute Microphone</option>
                                  <option value="mute_audio">Mute Audio Output</option>
                                  <option value="unmute_audio">Unmute Audio Output</option>
                                </select>
                              </div>
                            ) : step.type === "app" ? (
                              /* Option 2: Unified App Launch vs Close Dropdown */
                              <div className="flex items-center gap-2.5 w-full">
                                <select
                                  value={step.title.toLowerCase().includes("close") ? "close" : "launch"}
                                  onChange={(e) => {
                                    const mode = e.target.value;
                                    const isClose = mode === "close";
                                    const title = isClose ? "Close Process" : "Launch App";
                                    const cleanName = step.param.replace(".exe", "");
                                    setSteps((prev) =>
                                      prev.map((s) =>
                                        s.id === step.id
                                          ? {
                                              ...s,
                                              title,
                                              subtitle: isClose ? `Close ${step.param}` : `Open ${step.param}`,
                                              proScript: isClose
                                                ? `Stop-Process -Name '${cleanName}' -ErrorAction SilentlyContinue`
                                                : `Start-Process '${step.param}'`,
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-cream border border-cream-border text-xs font-black text-ink focus:outline-none focus:border-mint cursor-pointer"
                                >
                                  <option value="launch">Launch App</option>
                                  <option value="close">Close Process</option>
                                </select>
                                <input
                                  type="text"
                                  value={step.param}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const isClose = step.title.toLowerCase().includes("close");
                                    const cleanName = val.replace(".exe", "");
                                    setSteps((prev) =>
                                      prev.map((s) =>
                                        s.id === step.id
                                          ? {
                                              ...s,
                                              param: val,
                                              subtitle: isClose ? `Close ${val}` : `Open ${val}`,
                                              proScript: isClose
                                                ? `Stop-Process -Name '${cleanName}' -ErrorAction SilentlyContinue`
                                                : `Start-Process '${val}'`,
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  placeholder="e.g. code.exe or discord.exe..."
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-cream border border-cream-border text-xs font-mono font-bold focus:outline-none focus:border-mint text-ink"
                                />
                              </div>
                            ) : step.type === "web" ? (
                              /* Option 3: Unified Web URL Dropdown */
                              <div className="flex items-center gap-2.5 w-full">
                                <select
                                  value={step.title.toLowerCase().includes("tab") ? "tab" : "browser"}
                                  onChange={(e) => {
                                    const mode = e.target.value;
                                    const isTab = mode === "tab";
                                    const title = isTab ? "Open Workspace Tab" : "Open Website URL";
                                    setSteps((prev) =>
                                      prev.map((s) =>
                                        s.id === step.id
                                          ? {
                                              ...s,
                                              title,
                                              subtitle: `Open ${step.param}`,
                                              proScript: `Start-Process '${step.param}'`,
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-cream border border-cream-border text-xs font-black text-ink focus:outline-none focus:border-blueberry cursor-pointer"
                                >
                                  <option value="browser">Open Website</option>
                                  <option value="tab">Workspace Tab</option>
                                </select>
                                <input
                                  type="text"
                                  value={step.param}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSteps((prev) =>
                                      prev.map((s) =>
                                        s.id === step.id
                                          ? {
                                              ...s,
                                              param: val,
                                              subtitle: `Open ${val}`,
                                              proScript: `Start-Process '${val}'`,
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  placeholder="https://..."
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-cream border border-cream-border text-xs font-mono font-bold focus:outline-none focus:border-blueberry text-ink"
                                />
                              </div>
                            ) : step.type === "focus" ? (
                              /* Option 4: Focus Assist ON / OFF Dropdown */
                              <div className="flex items-center gap-2.5 w-full">
                                <span className="text-ink-muted text-xs font-bold">Mode:</span>
                                <select
                                  value={step.param}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const title = val === "PriorityOnly" ? "Focus Assist ON" : "Focus Assist OFF";
                                    setSteps((prev) =>
                                      prev.map((s) =>
                                        s.id === step.id
                                          ? {
                                              ...s,
                                              param: val,
                                              title,
                                              subtitle:
                                                val === "PriorityOnly"
                                                  ? "Silence notifications"
                                                  : "Allow notifications",
                                              proScript: `Set-WindowsFocusAssist -Mode ${val}`,
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-cream border border-cream-border text-xs font-black text-ink focus:outline-none focus:border-sunny cursor-pointer"
                                >
                                  <option value="PriorityOnly">Do Not Disturb ON</option>
                                  <option value="Off">Do Not Disturb OFF</option>
                                </select>
                              </div>
                            ) : step.type === "powershell" &&
                              (step.param === "lock" || step.param === "sleep" || step.param === "display_off") ? (
                              /* Option 5: Unified System Action Dropdown */
                              <div className="flex items-center gap-2.5 w-full">
                                <span className="text-ink-muted text-xs font-bold">Action:</span>
                                <select
                                  value={step.param}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const title =
                                      val === "lock"
                                        ? "Lock Workstation"
                                        : val === "sleep"
                                        ? "Sleep Computer"
                                        : "Turn Screen Off";
                                    const proScript =
                                      val === "lock"
                                        ? "rundll32.exe user32.dll,LockWorkStation"
                                        : val === "sleep"
                                        ? "# Sleep uses the native Windows power API"
                                        : '(Add-Type \'[DllImport("user32.dll")]public static extern int SendMessage(int hWnd, int hMsg, int wParam, int lParam);\' -Name a -Pas)::SendMessage(-1, 0x0112, 0xF170, 2)';
                                    setSteps((prev) =>
                                      prev.map((s) =>
                                        s.id === step.id
                                          ? {
                                              ...s,
                                              param: val,
                                              title,
                                              subtitle: title,
                                              proScript,
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-cream border border-cream-border text-xs font-black text-ink focus:outline-none focus:border-grape cursor-pointer"
                                >
                                  <option value="lock">Lock Workstation</option>
                                  <option value="sleep">Sleep Computer</option>
                                  <option value="display_off">Turn Screen Off</option>
                                </select>
                              </div>
                            ) : step.type === "audio" ? (
                              /* Option 6: Volume Level Slider */
                              <div className="flex items-center gap-3 w-full">
                                <span className="text-ink-muted text-xs">Volume:</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={Number.isFinite(Number(step.param)) ? Number(step.param) : 30}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSteps((prev) =>
                                      prev.map((s) =>
                                        s.id === step.id
                                          ? { ...s, param: val, subtitle: `Level: ${val}%` }
                                          : s
                                      )
                                    );
                                  }}
                                  className="flex-1 accent-strawberry cursor-pointer"
                                />
                                <span className="w-10 text-right font-mono font-black">{step.param}%</span>
                              </div>
                            ) : (
                              /* Option 7: Custom PowerShell Script / Generic parameter */
                              <div className="flex items-center gap-2 w-full">
                                <span className="text-ink-muted text-xs">Command:</span>
                                <input
                                  type="text"
                                  value={step.param}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSteps((prev) =>
                                      prev.map((s) => (s.id === step.id ? { ...s, param: val } : s))
                                    );
                                  }}
                                  placeholder="PowerShell command or argument..."
                                  className="flex-1 px-3 py-1.5 rounded-xl bg-cream border border-cream-border text-xs font-mono font-bold focus:outline-none focus:border-grape text-ink"
                                />
                              </div>
                            )}
                          </div>

                          {/* Expandable Pro Settings Tray */}
                          {isProExpanded && !step.action && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="mt-3 pt-3 border-t-2 border-dashed border-cream-border text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between text-ink-muted font-bold">
                                <span>{step.type === "powershell" && step.param === "custom" ? "Custom PowerShell script:" : "Legacy script reference (not executed):"}</span>
                                <span className="font-mono text-[10px] text-grape-dark bg-grape-light px-2 py-0.5 rounded-lg border border-grape-dark">
                                  Pro Mode
                                </span>
                              </div>

                              <textarea
                                value={
                                  step.proScript ||
                                  `# Custom execution block for ${step.title}\nStart-Process "${step.param}"`
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSteps((prev) =>
                                    prev.map((s) => (s.id === step.id ? { ...s, proScript: val } : s))
                                  );
                                }}
                                rows={2}
                                className="w-full font-mono text-xs px-3 py-2 rounded-xl bg-slate-900 text-mint border border-slate-700 focus:outline-none focus:border-mint"
                              />

                              <div className="flex items-center gap-4 text-ink-muted">
                                <label className="flex items-center gap-2 font-bold">
                                  <span>Execution delay:</span>
                                  <input
                                    type="number"
                                    value={step.delayMs || 0}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 0;
                                      setSteps((prev) =>
                                        prev.map((s) => (s.id === step.id ? { ...s, delayMs: val } : s))
                                      );
                                    }}
                                    className="w-20 px-2 py-1 rounded-lg bg-cream border border-cream-border font-bold text-xs"
                                  />
                                  <span>ms</span>
                                </label>
                              </div>
                            </motion.div>
                          )}

                          {/* Interlocking Bottom Protrusion Tab (凸) */}
                          <div
                            className={`w-14 h-3.5 rounded-b-xl border-b-2 border-x-2 absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-10 shadow-sm ${theme.bg} ${theme.border}`}
                          />
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Snap slot at the end of the list */}
                {dropSlotIndex === steps.length && draggingPayload !== null && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 60 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full rounded-3xl border-3 border-dashed border-mint bg-mint-light/40 flex items-center justify-center text-mint-dark font-black text-xs gap-2 shadow-inner my-2"
                  >
                    <Plus size={16} className="animate-bounce" />
                    <span>Place here</span>
                  </motion.div>
                )}

                {/* Empty State Droppable Zone */}
                {steps.length === 0 && (
                  <div
                    className={`w-full p-10 rounded-3xl border-2 border-dashed text-center transition-all ${
                      dropSlotIndex !== null
                        ? "border-mint bg-mint-light/50 scale-[1.02]"
                        : "border-cream-border bg-cream-card/60"
                    }`}
                  >
                    <span className="text-4xl block mb-2">🧩</span>
                    <h4 className="font-black text-ink text-base">Pipeline is Empty</h4>
                    <p className="text-xs font-bold text-ink-muted mt-1 max-w-sm mx-auto">
                      Grab any puzzle block from the left palette and drag it with your cursor onto this board!
                    </p>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      )}
    </div>
  );
};

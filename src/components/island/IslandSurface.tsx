import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, CheckCircle2, Circle, Loader2, Mic, SkipForward, Square } from "lucide-react";
import { IslandState, Routine } from "../../types";
import "./island.css";

interface IslandSurfaceProps {
  state: IslandState;
  routine?: Routine | null;
  candidates?: Routine[];
  subtitle?: string;
  dimensions: { width: number; height: number; borderRadius: number };
  exiting: boolean;
  standalone: boolean;
  currentStep: number;
  completedSteps: number[];
  skippedSteps: Record<number, string>;
  error: string;
  registerStep: (index: number, element: HTMLDivElement | null) => void;
  onStop: () => void;
  onStartVoice?: () => void;
  onStopListening?: () => void;
  onCancelVoice?: () => void;
  onSelectCandidate?: (routine: Routine) => void;
  onDismiss: () => void;
}

/** Presentation only: changing the notch appearance never re-starts execution. */
export function IslandSurface({
  state,
  routine,
  candidates,
  subtitle,
  dimensions,
  exiting,
  standalone,
  currentStep,
  completedSteps,
  skippedSteps,
  error,
  registerStep,
  onStop,
  onStartVoice,
  onSelectCandidate,
  onDismiss,
}: IslandSurfaceProps) {
  const reducedMotion = useReducedMotion();
  const totalSteps = routine?.steps.length || 1;
  const actionsFinished = !!routine?.steps.length && completedSteps.length === routine.steps.length;
  const progressRatio = Math.min(1, completedSteps.length / totalSteps);
  const ringRadius = 13;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progressRatio);

  const transition = { duration: reducedMotion ? 0 : 0.14 };
  const contentAnimation = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition };

  return (
    <div className={`flex items-start justify-center select-none pointer-events-none ${standalone ? "w-full h-full" : "w-full"}`}>
      <motion.div
        role="region"
        aria-label="Flowy Dynamic Island"
        className="flowy-island"
        data-state={state}
        data-reduced-motion={!!reducedMotion}
        initial={{
          y: -dimensions.height,
          opacity: 0,
          width: dimensions.width,
          height: dimensions.height,
          borderBottomLeftRadius: dimensions.borderRadius,
          borderBottomRightRadius: dimensions.borderRadius,
        }}
        animate={{
          y: exiting ? -dimensions.height - 16 : 0,
          opacity: exiting ? 0 : 1,
          width: dimensions.width,
          height: dimensions.height,
          borderBottomLeftRadius: dimensions.borderRadius,
          borderBottomRightRadius: dimensions.borderRadius,
        }}
        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}
        onMouseEnter={() => { if (standalone) window.electronAPI?.setIslandInteractive(true); }}
        onMouseLeave={() => { if (standalone) window.electronAPI?.setIslandInteractive(false); }}
      >
        <div className="island-content">
          <AnimatePresence mode="popLayout" initial={false}>
            {state === "idle" && (
              <motion.div
                key="idle"
                {...contentAnimation}
                className="island-compact"
                onClick={() => onStartVoice?.()}
                style={onStartVoice ? { cursor: "pointer" } : undefined}
                title={onStartVoice ? "Click or press Ctrl+Space to talk to Flowy" : undefined}
              >
                <span className="island-indicator" />
                <span className="island-title island-copy">Flowy</span>
                <span className="island-caption" style={{ margin: 0 }}>Ready</span>
              </motion.div>
            )}

            {state === "listening" && (
              <motion.div key="listening" {...contentAnimation} className="island-compact">
                <div className="island-icon island-blue"><Mic size={15} /></div>
                <div className="island-copy">
                  <p className="island-title">Listening...</p>
                  <p className="island-caption">{subtitle || "Speak your command"}</p>
                </div>
                <div className="island-wave" aria-hidden="true">
                  {[8, 15, 20, 11, 22, 14, 9].map((height, index) => (
                    <motion.span
                      key={index}
                      style={{ height }}
                      animate={reducedMotion ? undefined : { height: [height * 0.25, height, height * 0.45, height * 0.8, height * 0.25] }}
                      transition={{ duration: 0.6 + index * 0.06, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {state === "thinking" && (
              <motion.div key="thinking" {...contentAnimation} className="island-compact">
                <div className="island-icon"><Loader2 size={15} className="animate-spin text-white" /></div>
                <div className="island-copy">
                  <p className="island-title">Thinking...</p>
                  <p className="island-caption">{subtitle || routine?.name || "Matching your command"}</p>
                </div>
              </motion.div>
            )}

            {state === "ambiguous" && (
              <motion.div key="ambiguous" {...contentAnimation} className="island-executing" style={{ gap: 10 }}>
                <div className="island-header">
                  <div className="island-icon island-amber"><Mic size={14} /></div>
                  <div className="island-copy">
                    <p className="island-title">Which routine?</p>
                    <p className="island-caption">{subtitle || "Choose one to run"}</p>
                  </div>
                </div>
                <div className="island-candidates">
                  {(candidates || []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="island-pill-btn"
                      onClick={() => onSelectCandidate?.(item)}
                    >
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {state === "executing" && (
              <motion.div key="executing" {...contentAnimation} className="island-executing">
                <div className="island-header">
                  <div className="island-ring-wrap">
                    <svg className="island-ring-svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
                      <circle cx="16" cy="16" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
                      <motion.circle
                        cx="16"
                        cy="16"
                        r={ringRadius}
                        fill="none"
                        stroke={actionsFinished ? "#30d158" : "#0a84ff"}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        animate={{ strokeDashoffset: ringOffset }}
                        transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
                      />
                    </svg>
                    {actionsFinished ? (
                      <Check size={14} className="island-green" strokeWidth={2.6} />
                    ) : (
                      <span className="text-[13px] leading-none" aria-hidden="true">{routine?.icon || "✨"}</span>
                    )}
                  </div>
                  <div className="island-copy">
                    <h4 className="island-title">{routine?.name || "Running routine"}</h4>
                    <p className="island-caption">
                      {!window.electronAPI ? "Visual preview" : actionsFinished ? "Finishing up" : `${completedSteps.length} of ${routine?.steps.length || 0} done`}
                    </p>
                  </div>
                  {window.electronAPI && !actionsFinished && (
                    <button
                      type="button"
                      className="island-icon-btn is-danger"
                      onClick={onStop}
                      title="Stop routine"
                      aria-label="Stop routine"
                    >
                      <Square size={11} fill="currentColor" />
                    </button>
                  )}
                </div>

                <div className="island-list">
                  {(routine?.steps || []).map((step, index) => {
                    const done = completedSteps.includes(index);
                    const skipReason = skippedSteps[index];
                    const current = currentStep === index && !done;
                    const status = skipReason ? "skipped" : done ? "completed" : current ? "running" : "queued";
                    return (
                      <div key={step.id} ref={(element) => registerStep(index, element)} className="island-step" data-status={status}>
                        {skipReason ? <SkipForward size={13} className="island-amber flex-shrink-0" /> :
                          done ? <CheckCircle2 size={13} className="island-green flex-shrink-0" /> :
                          current ? <Loader2 size={13} className="island-blue animate-spin flex-shrink-0" /> :
                          <Circle size={11} className="flex-shrink-0 opacity-40" />}
                        <span className="island-step-name" title={step.title}>{step.title}</span>
                        <span title={skipReason} className={`island-step-status ${skipReason ? "island-amber" : done ? "island-green" : ""}`}>
                          {skipReason ? "Skipped" : done ? "Done" : current ? "Running" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {state === "failed" && (
              <motion.div key="failed" {...contentAnimation} role="alert" className="island-error">
                <div className="island-header">
                  <div className="island-icon island-red"><AlertCircle size={15} /></div>
                  <div className="island-copy">
                    <p className="island-title">Routine stopped</p>
                  </div>
                  <button type="button" className="island-pill-btn" onClick={onDismiss}>Dismiss</button>
                </div>
                <p className="island-caption">{error}</p>
              </motion.div>
            )}

            {state === "completed" && (
              <motion.div key="completed" {...contentAnimation} className="island-compact" role="status">
                <motion.div
                  className="island-icon island-green island-success-halo"
                  initial={reducedMotion ? undefined : { scale: 0.55 }}
                  animate={reducedMotion ? undefined : { scale: [0.55, 1.18, 1] }}
                  transition={{ duration: 0.38, ease: "easeOut" }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <motion.path
                      d="M5 13l4 4L19 7"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: reducedMotion ? 0 : 0.35, ease: "easeOut" }}
                    />
                  </svg>
                </motion.div>
                <div className="island-copy">
                  <p className="island-title">
                    {window.electronAPI ? "Routine Completed" : "Preview Completed"}
                  </p>
                  <p className="island-caption">
                    {Object.keys(skippedSteps).length ? "Finished (Do Not Disturb skipped)" : routine?.name || "Everything is ready"}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

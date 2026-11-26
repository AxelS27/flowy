import { FC, PointerEvent } from "react";
import { LayoutGrid, Plus, Settings, Music, VolumeX, ArrowUpRight, Mic, Square, Loader2, X } from "lucide-react";
import { FlowyMascot, MascotState } from "../common/FlowyMascot";
import { LandingBackground } from "./LandingBackground";
import { Routine } from "../../types";
import { formatHotkeyLabel } from "../settings/SettingsTab";
import { sound } from "../../utils/soundEffects";
import "./landing.css";

interface LandingPageProps {
  onNavigate: (tab: "routines" | "settings") => void;
  onCreateRoutine: () => void;
  onRunRoutine: (routine: Routine) => void;
  routines: Routine[];
  mascotState: MascotState;
  isBgmOn: boolean;
  onToggleBgm: () => void;
  voicePhase: "idle" | "listening" | "thinking" | "error" | "ambiguous";
  voiceMessage: string;
  voiceCandidates: Routine[];
  masterHotkey: string;
  onToggleVoice: () => void;
  onCancelVoice: () => void;
}

export const LandingPage: FC<LandingPageProps> = ({
  onNavigate,
  onCreateRoutine,
  onRunRoutine,
  routines,
  mascotState,
  isBgmOn,
  onToggleBgm,
  voicePhase,
  voiceMessage,
  voiceCandidates,
  masterHotkey,
  onToggleVoice,
  onCancelVoice,
}) => {
  const sampleRoutines = routines.filter((routine) => routine.enabled).slice(0, 3);

  const moveStage = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--stage-x", `${((event.clientX - rect.left) / rect.width - .5) * 12}deg`);
    event.currentTarget.style.setProperty("--stage-y", `${((event.clientY - rect.top) / rect.height - .5) * -10}deg`);
  };

  const resetStage = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.removeProperty("--stage-x");
    event.currentTarget.style.removeProperty("--stage-y");
  };

  const isListening = voicePhase === "listening";
  const isThinking = voicePhase === "thinking";

  return (
    <>
      <LandingBackground />
      <div className="flowy-home relative isolate mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-6 sm:gap-8 px-6 py-6 sm:px-10 sm:py-8 my-auto z-10">
        <header className="relative z-10 flex justify-end">
          <button onClick={() => { sound.playPop(520); onToggleBgm(); }} className="flex w-9 sm:w-[96px] h-9 items-center justify-center gap-2 rounded-2xl border-2 border-cream-border bg-white text-xs font-extrabold text-ink shadow-sm transition-transform active:translate-y-0.5" title={isBgmOn ? "Turn BGM off" : "Turn BGM on"} aria-label={isBgmOn ? "Turn BGM off" : "Turn BGM on"}>
            {isBgmOn ? <Music size={16} className="shrink-0 text-mint-dark" /> : <VolumeX size={16} className="shrink-0 text-strawberry" />}
            <span className="hidden sm:inline">{isBgmOn ? "BGM on" : "BGM off"}</span>
          </button>
        </header>

        <section className="flowy-hero relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 sm:gap-8 items-center" aria-label="Meet Flowy">
          <div className="flowy-stage flex items-center justify-center order-1 lg:order-1" onPointerMove={moveStage} onPointerLeave={resetStage}>
            <div className="flowy-stage-character">
              <FlowyMascot state={mascotState} size="xl" />
            </div>
          </div>

          <div className="flex flex-col justify-center items-center lg:items-start text-center lg:text-left px-2 sm:px-4 order-2 lg:order-2">
            <h2 className="max-w-xl text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.15] tracking-tight text-ink">
              Cozy up <span className="text-rose-600">your winter.</span>
            </h2>
            <p className="mt-3 sm:mt-4 max-w-md text-xs sm:text-sm md:text-base font-semibold leading-relaxed text-ink-muted">
              One tap or a quiet word for the little things you do every day. Flowy takes it from there.
            </p>

            {/* Voice trigger to interact with Dynamic Island & see Flowy's expressions */}
            <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center lg:justify-start gap-2.5">
              <button
                type="button"
                onClick={onToggleVoice}
                disabled={isThinking}
                className={[
                  "inline-flex items-center gap-2.5 rounded-2xl border-2 px-4 py-2.5 text-xs sm:text-sm font-black transition-all active:translate-y-0.5",
                  isListening
                    ? "border-strawberry-dark bg-strawberry text-white shadow-[0_3px_0_#E03B6B] animate-pulse"
                    : isThinking
                      ? "border-grape-dark/30 bg-grape-light text-purple-900 cursor-wait"
                      : "border-grape-dark/40 bg-grape text-white shadow-[0_3px_0_#9333EA] hover:brightness-105",
                ].join(" ")}
              >
                {isThinking ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isListening ? (
                  <Square size={15} fill="currentColor" />
                ) : (
                  <Mic size={16} />
                )}
                <span>
                  {isListening
                    ? "Listening... Click to run"
                    : isThinking
                      ? "Matching routine..."
                      : `Talk to Flowy (${formatHotkeyLabel(masterHotkey)})`}
                </span>
              </button>

              {(isListening || isThinking || voicePhase === "error" || voicePhase === "ambiguous") && (
                <button
                  type="button"
                  onClick={onCancelVoice}
                  aria-label="Cancel voice command"
                  className="inline-flex items-center gap-1 rounded-2xl border-2 border-cream-border bg-white px-3 py-2.5 text-xs font-extrabold text-ink-muted hover:text-ink"
                >
                  <X size={14} />
                  <span>{voicePhase === "error" || voicePhase === "ambiguous" ? "Clear" : "Cancel"}</span>
                </button>
              )}
            </div>

            {voiceMessage && voicePhase !== "idle" && (
              <div
                className={[
                  "mt-3 max-w-md rounded-2xl border-2 px-3.5 py-2 text-xs font-bold",
                  voicePhase === "error"
                    ? "border-strawberry/40 bg-strawberry-light text-red-900"
                    : "border-grape-dark/20 bg-white/90 text-ink",
                ].join(" ")}
              >
                <p>{voiceMessage}</p>
                {voicePhase === "ambiguous" && voiceCandidates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {voiceCandidates.map((routine) => (
                      <button
                        key={routine.id}
                        type="button"
                        onClick={() => {
                          onCancelVoice();
                          onRunRoutine(routine);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-grape-dark/30 bg-grape-light px-2.5 py-1 text-xs font-extrabold text-purple-950 hover:bg-grape hover:text-white"
                      >
                        <span>{routine.icon}</span>
                        <span>{routine.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="relative z-10 flex flex-col gap-4 w-full pt-2">
          <section aria-label="Quick routines" className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-ink-muted mr-1">Jump into</span>
            {sampleRoutines.length ? sampleRoutines.map((routine) => (
              <button key={routine.id} onClick={() => { sound.playPop(540); onRunRoutine(routine); }} className="group inline-flex items-center gap-2 rounded-2xl border-2 border-cream-border bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 text-[11px] sm:text-xs font-extrabold text-ink shadow-[0_3px_0_#DCE6F0] transition-all hover:border-mint-dark hover:bg-mint-light active:translate-y-0.5 active:shadow-none" title={`Run ${routine.name}`}>
                <span className="text-base sm:text-lg" aria-hidden="true">{routine.icon}</span>{routine.name}<ArrowUpRight size={13} className="text-ink-muted group-hover:text-mint-dark" />
              </button>
            )) : <span className="text-xs font-semibold text-ink-muted">Create a routine to get started.</span>}
          </section>

          <nav aria-label="Home shortcuts" className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <button onClick={() => { sound.playPop(560); onCreateRoutine(); }} className="flowy-nav-card group flex items-center gap-3 rounded-3xl border-2 border-strawberry-dark/40 bg-strawberry-light p-4 text-left shadow-tactile-card hover:border-strawberry-dark">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-strawberry text-white shadow-[0_3px_0_#E03B6B]"><Plus size={24} /></span>
              <span className="font-black text-ink">New routine</span><ArrowUpRight size={17} className="ml-auto text-ink-muted" />
            </button>
            <button onClick={() => { sound.playPop(520); onNavigate("routines"); }} className="flowy-nav-card group flex items-center gap-3 rounded-3xl border-2 border-mint-dark/40 bg-mint-light p-4 text-left shadow-tactile-card hover:border-mint-dark">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint text-white shadow-[0_3px_0_#14B8A6]"><LayoutGrid size={23} /></span>
              <span className="font-black text-ink">My routines</span><ArrowUpRight size={17} className="ml-auto text-ink-muted" />
            </button>
            <button onClick={() => { sound.playPop(580); onNavigate("settings"); }} className="flowy-nav-card group flex items-center gap-3 rounded-3xl border-2 border-blueberry-dark/40 bg-blueberry-light p-4 text-left shadow-tactile-card hover:border-blueberry-dark">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blueberry text-white shadow-[0_3px_0_#3B82F6]"><Settings size={23} /></span>
              <span className="font-black text-ink">Settings</span><ArrowUpRight size={17} className="ml-auto text-ink-muted" />
            </button>
          </nav>
        </div>
      </div>
    </>
  );
};

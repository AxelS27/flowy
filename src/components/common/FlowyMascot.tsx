import { FC, useEffect, useId, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { sound } from "../../utils/soundEffects";
import { fireStarBurst } from "../../utils/confetti";

export type MascotState = "idle" | "listening" | "thinking" | "tinkering" | "celebrating" | "upset";
type Face = "happy" | "sleepy" | "teary" | "curious" | "wink" | "focused" | "excited" | "annoyed" | "angry";

// Shortened for preview; restore to 60_000 when the idle animation is approved.
const IDLE_WANDER_DELAY_MS = 2_000;
const POKES_PER_EXPRESSION = 10;
const POKE_PAUSE_RESET_MS = 15_000;
const POKE_FACES: Face[] = ["happy", "annoyed", "angry", "teary"];

interface FlowyMascotProps {
  state?: MascotState;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const FlowyMascot: FC<FlowyMascotProps> = ({ state = "idle", size = "md", className = "" }) => {
  const [reactionFace, setReactionFace] = useState<Face | null>(null);
  const [idleFace, setIdleFace] = useState<Face>("happy");
  const [isBlinking, setIsBlinking] = useState(false);
  const [isWandering, setIsWandering] = useState(false);
  const pokeStreakRef = useRef(0);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPokeAtRef = useRef(0);
  const animatingPokeRef = useRef(false);
  const queuedPokeRef = useRef<{ mood: Face; direction: number } | null>(null);
  const pokeControls = useAnimationControls();
  const reducedMotion = useReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const mascotRef = useRef<HTMLButtonElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dimension = size === "sm" ? 48 : size === "md" ? 72 : size === "lg" ? 96 : 330;
  const face: Face = reactionFace ?? (state === "idle" ? idleFace : state === "listening" ? "curious" :
    state === "thinking" ? "sleepy" : state === "tinkering" ? "focused" : state === "upset" ? "teary" : "excited");

  // Calm idle faces change occasionally; anger is reserved for repeated pokes.
  useEffect(() => {
    if (state !== "idle") return;
    let timer: ReturnType<typeof setTimeout>;
    let current: Face = "happy";
    setIdleFace(current);
    const changeFace = () => {
      const options: Face[] = ["happy", "sleepy", "curious", "wink", "teary"];
      const choices = options.filter((option) => option !== current);
      current = choices[Math.floor(Math.random() * choices.length)];
      setIdleFace(current);
      timer = setTimeout(changeFace, 6_000 + Math.random() * 4_000);
    };
    timer = setTimeout(changeFace, 6_000);
    return () => clearTimeout(timer);
  }, [state]);

  // A quick natural blink between expressions, never over closed or angry eyes.
  useEffect(() => {
    setIsBlinking(false);
    if (reducedMotion || !["happy", "curious", "focused"].includes(face)) return;
    let blinkTimer: ReturnType<typeof setTimeout>;
    let reopenTimer: ReturnType<typeof setTimeout>;
    const blink = () => {
      setIsBlinking(true);
      reopenTimer = setTimeout(() => {
        setIsBlinking(false);
        blinkTimer = setTimeout(blink, 2_800 + Math.random() * 2_400);
      }, 140);
    };
    blinkTimer = setTimeout(blink, 2_800 + Math.random() * 2_400);
    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(reopenTimer);
    };
  }, [face, reducedMotion]);

  // In-app inactivity unlocks the longer roaming animation.
  useEffect(() => {
    if (state !== "idle" || reducedMotion || size !== "xl") {
      setIsWandering(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onActivity = () => {
      setIsWandering(false);
      if (timer) clearTimeout(timer);
      if (document.visibilityState === "visible") {
        timer = setTimeout(() => setIsWandering(true), IDLE_WANDER_DELAY_MS);
      }
    };
    window.addEventListener("pointermove", onActivity);
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("wheel", onActivity);
    document.addEventListener("visibilitychange", onActivity);
    onActivity();
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("wheel", onActivity);
      document.removeEventListener("visibilitychange", onActivity);
    };
  }, [state, reducedMotion, size]);

  useEffect(() => () => {
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
    queuedPokeRef.current = null;
    pokeControls.stop();
  }, [pokeControls]);

  // Keep the latest pointer position even while the eyelids are shut.
  useEffect(() => {
    if (size !== "xl") return;
    const updateEyes = () => {
      frameRef.current = null;
      const pointer = lastPointerRef.current;
      const rect = mascotRef.current?.getBoundingClientRect();
      if (!pointer || !rect || !pupilsRef.current) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height * .46;
      const dx = Math.max(-3, Math.min(3, (pointer.x - centerX) / 75));
      const dy = Math.max(-2.6, Math.min(2.6, (pointer.y - centerY) / 75));
      pupilsRef.current.setAttribute("transform", `translate(${dx} ${dy})`);
    };
    const moveEyes = (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      if (frameRef.current === null) frameRef.current = requestAnimationFrame(updateEyes);
    };
    const resetEyes = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastPointerRef.current = null;
      pupilsRef.current?.setAttribute("transform", "translate(0 0)");
    };
    window.addEventListener("pointermove", moveEyes);
    document.addEventListener("mouseleave", resetEyes);
    if (lastPointerRef.current) frameRef.current = requestAnimationFrame(updateEyes);
    return () => {
      window.removeEventListener("pointermove", moveEyes);
      document.removeEventListener("mouseleave", resetEyes);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [size, face]);

  // Finish the current reaction before playing at most one latest queued mood.
  const playPokeAnimation = (mood: Face, direction: number) => {
    if (reducedMotion) return;
    if (animatingPokeRef.current) {
      queuedPokeRef.current = { mood, direction };
      return;
    }
    animatingPokeRef.current = true;
    const transition = { ease: "easeInOut" as const };
    const animation = mood === "angry"
      ? { x: [0, -10, 9, -6, 6, 0], y: [0, 8, 0, 5, 0, 0], rotate: [0, -5, 5, -3, 3, 0], scaleX: [1, 1.06, .96, 1.04, 1, 1], transition: { ...transition, duration: 1.5 } }
      : mood === "teary"
      ? { x: [0, 0], y: [0, 10, 13, 9, 0], rotate: [0, -5, 2, -2, 0], scaleX: [1, .9, .94, .95, 1], scaleY: [1, .86, .9, .93, 1], transition: { ...transition, duration: 1.65 } }
      : mood === "annoyed"
      ? { x: [0, 12 * direction, -5 * direction, 3 * direction, 0], y: [0, -4, 0, 0, 0], rotate: [0, 8 * direction, -5 * direction, 2 * direction, 0], scaleX: [1, 1.03, .98, 1, 1], transition: { ...transition, duration: 1.3 } }
      : { x: [0, 7 * direction, 0, 0], y: [0, -20, -14, 0], rotate: [0, 9 * direction, 0, 0], scaleX: [1, .94, 1.04, 1], scaleY: [1, 1.1, .96, 1], transition: { ...transition, duration: 1.3 } };
    void pokeControls.start(animation).then(() => {
      animatingPokeRef.current = false;
      const queued = queuedPokeRef.current;
      queuedPokeRef.current = null;
      const nextDuration = queued?.mood === "teary" ? 1_650 : queued?.mood === "angry" ? 1_500 : 1_300;
      if (queued && performance.now() + nextDuration <= lastPokeAtRef.current + 2_000) {
        playPokeAnimation(queued.mood, queued.direction);
      }
    });
  };

  const handlePoke = () => {
    lastPokeAtRef.current = performance.now();
    const maxPokes = POKES_PER_EXPRESSION * POKE_FACES.length;
    pokeStreakRef.current = Math.min(pokeStreakRef.current + 1, maxPokes);
    const phase = Math.floor((pokeStreakRef.current - 1) / POKES_PER_EXPRESSION);
    const mood = POKE_FACES[phase];
    setReactionFace(mood);
    playPokeAnimation(mood, pokeStreakRef.current % 2 ? 1 : -1);
    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
    const resetPokes = () => {
      pokeStreakRef.current = 0;
      setReactionFace(null);
      setIdleFace("happy");
    };
    streakTimerRef.current = setTimeout(resetPokes, POKE_PAUSE_RESET_MS);
    reactionTimerRef.current = setTimeout(() => {
      setReactionFace(null);
      setIdleFace("happy");
      if (phase === POKE_FACES.length - 1) {
        if (streakTimerRef.current) clearTimeout(streakTimerRef.current);
        pokeStreakRef.current = 0;
      }
    }, 2_000);
    sound.playPop(780);
    const rect = mascotRef.current?.getBoundingClientRect();
    if (rect && pokeStreakRef.current === 1) {
      fireStarBurst((rect.left + rect.width / 2) / window.innerWidth, (rect.top + rect.height / 2) / window.innerHeight);
    }
  };

  return (
    <motion.button
      ref={mascotRef}
      type="button"
      onClick={handlePoke}
      aria-label="Poke Flowy the jelly mascot"
      title="Poke Flowy"
      className={`relative inline-flex items-center justify-center border-0 bg-transparent p-0 cursor-pointer select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-strawberry ${className}`}
      style={{ width: dimension, height: dimension }}
      whileHover={reducedMotion ? undefined : { scale: 1.04 }}
      animate={reducedMotion ? undefined : state === "celebrating"
        ? { x: 0, y: [0, -18, 0, -12, 0], rotate: [0, -6, 5, -3, 0], scaleX: 1, scaleY: 1 }
        : state === "listening"
        ? { x: 0, rotate: 0, scaleX: [1, 1.04, 1], scaleY: [1, .96, 1], y: [0, -5, 0] }
        : state === "idle" && isWandering
        ? { x: [0, 65, -48, 38, 0], y: [0, -32, -56, -18, 0], rotate: [0, 8, -7, 4, 0] }
        : state === "idle"
        ? { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }
        : { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }}
      transition={state === "idle" && !isWandering
        ? { type: "spring", stiffness: 180, damping: 22 }
        : { duration: state === "idle" && isWandering ? 8 : 1.2,
          repeat: state === "idle" || state === "listening" ? Infinity : 0, ease: "easeInOut" }}
    >
      <motion.span className="flex items-center justify-center" animate={pokeControls}>
        <svg viewBox="0 0 160 160" width={dimension} height={dimension} aria-hidden="true" className="overflow-visible drop-shadow-[0_16px_12px_rgba(30,103,126,0.20)]">
          <defs>
            <linearGradient id={`${gradientId}-jelly`} x1="0" y1="0" x2=".8" y2="1">
              <stop offset="0%" stopColor={face === "angry" ? "#ffadb0" : "#c8efac"} />
              <stop offset="65%" stopColor={face === "angry" ? "#ff8b9b" : "#d8eec2"} />
              <stop offset="100%" stopColor={face === "angry" ? "#f76a83" : "#f3cbdc"} />
            </linearGradient>
          </defs>
          {/* Little butterfly wings flap behind the jelly, not over its face. */}
          <motion.g style={{ transformBox: "view-box", transformOrigin: "26% 52%" }} animate={reducedMotion ? undefined : { scaleX: [1, .66, 1] }} transition={{ duration: .85, repeat: Infinity, ease: "easeInOut" }}>
            <path d="M42 85 C20 79 3 66 10 49 C18 30 39 43 49 71 Z" fill="#d1aff6" stroke="#a490dd" strokeWidth="2" />
            <path d="M42 89 C17 86 7 100 18 114 C30 128 46 111 49 95 Z" fill="#dcc6ff" stroke="#a490dd" strokeWidth="2" />
            <path d="M19 52 Q25 46 33 54" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </motion.g>
          <motion.g style={{ transformBox: "view-box", transformOrigin: "74% 52%" }} animate={reducedMotion ? undefined : { scaleX: [1, .66, 1] }} transition={{ duration: .85, repeat: Infinity, ease: "easeInOut", delay: .08 }}>
            <path d="M118 85 C140 79 157 66 150 49 C142 30 121 43 111 71 Z" fill="#d1aff6" stroke="#a490dd" strokeWidth="2" />
            <path d="M118 89 C143 86 153 100 142 114 C130 128 114 111 111 95 Z" fill="#dcc6ff" stroke="#a490dd" strokeWidth="2" />
            <path d="M141 52 Q135 46 127 54" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </motion.g>
          {/* A wide, soft dome with little arms tucked into its sides. */}
          <ellipse cx="22" cy="94" rx="16" ry="18" fill={face === "angry" ? "#ff8698" : "#c4eca9"} />
          <ellipse cx="138" cy="94" rx="16" ry="18" fill={face === "angry" ? "#ff8698" : "#dce7c9"} />
          <path d="M80 29 C114 29 138 55 138 90 C138 122 123 138 80 138 C37 138 22 122 22 90 C22 55 46 29 80 29 Z" fill={face === "angry" ? "#d95b76" : "#d8b8c5"} transform="translate(0 4)" />
          <path d="M80 29 C114 29 138 55 138 90 C138 122 123 138 80 138 C37 138 22 122 22 90 C22 55 46 29 80 29 Z" fill={`url(#${gradientId}-jelly)`} stroke={face === "angry" ? "#e46981" : "#b5dcae"} strokeWidth="1.5" />
          <ellipse cx="44" cy="94" rx={face === "angry" ? 11 : 9} ry={face === "angry" ? 8 : 6} fill={face === "angry" ? "#ffc4ca" : "#ffa9bd"} opacity=".85" />
          <ellipse cx="116" cy="94" rx={face === "angry" ? 11 : 9} ry={face === "angry" ? 8 : 6} fill={face === "angry" ? "#ffc4ca" : "#ffa9bd"} opacity=".85" />
          {/* Cozy Christmas Santa Hat */}
          <g aria-hidden="true">
            <path
              d="M46 36 C50 8 72 -8 98 -4 C112 -2 120 5 122 12 C110 12 102 18 104 34 Z"
              fill="#e11d48"
              stroke="#be123c"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M55 29 C60 11 76 3 96 4"
              fill="none"
              stroke="#fda4af"
              strokeWidth="2.6"
              strokeLinecap="round"
              opacity=".55"
            />
            <circle cx="123" cy="12" r="7.5" fill="#ffffff" stroke="#dbeafe" strokeWidth="1.4" />
            <path
              d="M42 36 C42 29 58 27 80 27 C102 27 116 29 116 36 C116 42 100 41 80 41 C60 41 42 42 42 36 Z"
              fill="#ffffff"
              stroke="#dbeafe"
              strokeWidth="1.5"
            />
          </g>
          {face === "excited" ? (
            <g fill="none" stroke="#473448" strokeWidth="4.5" strokeLinecap="round">
              <path d="M48 80 Q58 63 68 80" /><path d="M92 80 Q102 63 112 80" />
              <path d="M47 76 L44 72 M113 76 L116 72" strokeWidth="2" />
            </g>
          ) : face === "wink" ? (
            <g>
              <path d="M49 79 Q58 84 67 78" fill="none" stroke="#473448" strokeWidth="4" strokeLinecap="round" />
              <ellipse cx="102" cy="78" rx="9" ry="11" fill="#302b3c" />
              <circle cx="105" cy="74" r="2.6" fill="#fff" />
            </g>
          ) : face === "sleepy" ? (
            <g fill="none" stroke="#473448" strokeWidth="4" strokeLinecap="round">
              <path d="M49 76 Q58 80 67 76" /><path d="M93 76 Q102 80 111 76" />
            </g>
          ) : face === "teary" ? (
            <g fill="none" strokeLinecap="round">
              <path d="M49 74 H67 M93 74 H111" stroke="#473448" strokeWidth="4.5" />
              <path d="M52 80 Q50 87 52 96 M108 80 Q110 87 108 96" stroke="#79c7f5" strokeWidth="4" />
            </g>
          ) : face === "annoyed" ? (
            <g fill="none" stroke="#473448" strokeLinecap="round">
              <path d="M49 66 L67 69 M93 69 L111 65" strokeWidth="3" />
              <path d="M50 79 Q58 75 66 79 M94 79 Q102 75 110 79" strokeWidth="4" />
            </g>
          ) : face === "angry" ? (
            <g fill="none" stroke="#473448" strokeLinecap="round">
              <path d="M48 67 Q57 68 67 74 M112 67 Q103 68 93 74" strokeWidth="4" />
              <ellipse cx="58" cy="82" rx="5" ry="6" fill="#473448" stroke="none" />
              <ellipse cx="102" cy="82" rx="5" ry="6" fill="#473448" stroke="none" />
              <circle cx="60" cy="79" r="1.6" fill="#fff" stroke="none" />
              <circle cx="104" cy="79" r="1.6" fill="#fff" stroke="none" />
            </g>
          ) : (
            <>
              {face === "focused" && <g fill="none" stroke="#473448" strokeWidth="2.5" strokeLinecap="round">
                <path d="M48 64 Q56 62 66 68" /><path d="M112 64 Q104 62 94 68" />
              </g>}
              <g ref={pupilsRef} opacity={isBlinking ? 0 : 1}>
                <ellipse cx="58" cy="78" rx={face === "curious" ? 10 : 9} ry={face === "curious" ? 12 : 11} fill="#302b3c" />
                <ellipse cx="102" cy="78" rx={face === "curious" ? 10 : 9} ry={face === "curious" ? 12 : 11} fill="#302b3c" />
                <circle cx="61" cy="74" r="2.6" fill="#fff" />
                <circle cx="105" cy="74" r="2.6" fill="#fff" />
              </g>
              {isBlinking && <g fill="none" stroke="#473448" strokeWidth="3.5" strokeLinecap="round">
                <path d="M49 78 Q58 82 67 78" /><path d="M93 78 Q102 82 111 78" />
              </g>}
            </>
          )}
          {face === "curious" ? <g><ellipse cx="80" cy="103" rx="5" ry="6" fill="#473448" /><ellipse cx="80" cy="106" rx="2" ry="1" fill="#ff97ae" /></g> :
            face === "sleepy" ? <path d="M76 104 Q80 107 84 104" fill="none" stroke="#473448" strokeWidth="3" strokeLinecap="round" /> :
            face === "annoyed" ? <path d="M74 106 Q80 102 87 106" fill="none" stroke="#473448" strokeWidth="3" strokeLinecap="round" /> :
            face === "teary" ? <path d="M71 107 Q75 100 80 104 Q85 100 89 107" fill="none" stroke="#473448" strokeWidth="3" strokeLinecap="round" /> :
            face === "angry" ? <g><path d="M73 106 Q80 100 87 106 Q80 112 73 106 Z" fill="#473448" /><path d="M79 109 Q83 106 85 108" fill="none" stroke="#ffced4" strokeWidth="2" strokeLinecap="round" /></g> :
            face === "focused" ? <path d="M73 104 Q81 110 89 101" fill="none" stroke="#473448" strokeWidth="3" strokeLinecap="round" /> :
            face === "wink" ? <path d="M71 100 Q81 113 90 99" fill="none" stroke="#473448" strokeWidth="3.5" strokeLinecap="round" /> :
            <g>
              <path d={face === "excited" ? "M68 96 Q80 91 92 96 Q92 109 80 112 Q68 109 68 96 Z" : "M71 99 Q68 91 73 90 Q77 89 80 92 Q84 89 88 90 Q93 91 89 99 Q80 111 71 99 Z"} fill="#49313f" />
              <path d="M74 104 Q80 98 86 104 Q80 109 74 104 Z" fill="#ff86a6" />
            </g>}
        </svg>
      </motion.span>
    </motion.button>
  );
};

import { FC, useEffect, useRef, useState } from "react";
import { sound } from "../../utils/soundEffects";

const SNOWFLAKES = [
  { left: "4%", size: 8, dur: "9.5s", delay: "-2s", opacity: 0.9, variant: 0 },
  { left: "10%", size: 26, dur: "12.5s", delay: "-7s", opacity: 0.92, variant: 1 },
  { left: "17%", size: 7, dur: "8.5s", delay: "-4s", opacity: 0.85, variant: 0 },
  { left: "24%", size: 22, dur: "11.5s", delay: "-9s", opacity: 0.88, variant: 2 },
  { left: "31%", size: 8, dur: "10s", delay: "-1s", opacity: 0.9, variant: 0 },
  { left: "39%", size: 28, dur: "13.5s", delay: "-6s", opacity: 0.9, variant: 3 },
  { left: "47%", size: 7, dur: "9s", delay: "-3s", opacity: 0.85, variant: 0 },
  { left: "54%", size: 24, dur: "12s", delay: "-10s", opacity: 0.92, variant: 1 },
  { left: "62%", size: 8, dur: "10.5s", delay: "-5s", opacity: 0.85, variant: 0 },
  { left: "69%", size: 26, dur: "11.5s", delay: "-3s", opacity: 0.9, variant: 2 },
  { left: "76%", size: 7, dur: "9.5s", delay: "-8s", opacity: 0.85, variant: 0 },
  { left: "83%", size: 28, dur: "13s", delay: "-5s", opacity: 0.92, variant: 3 },
  { left: "90%", size: 8, dur: "10s", delay: "-11s", opacity: 0.9, variant: 0 },
  { left: "96%", size: 22, dur: "11.5s", delay: "-1.5s", opacity: 0.88, variant: 1 },
];

const ANGLES = [0, 60, 120, 180, 240, 300];

const CrystalFlake: FC<{ size: number; variant: number }> = ({ size, variant }) => (
  <svg width={size} height={size} viewBox="-24 -24 48 48" fill="none" strokeLinecap="round" strokeLinejoin="round" focusable="false">
    {/* Soft icy outer halo + crisp white crystal inner stroke */}
    {[
      { stroke: "#60a5fa", width: 2.3 },
      { stroke: "#ffffff", width: 1.2 },
    ].map((layer, lIdx) => (
      <g key={lIdx} stroke={layer.stroke} strokeWidth={layer.width}>
        {/* Hexagonal core */}
        <polygon points="0,-5 4.3,-2.5 4.3,2.5 0,5 -4.3,2.5 -4.3,-2.5" fill={lIdx === 1 ? "#ffffff55" : "none"} />
        {ANGLES.map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            {/* Main crystal spine */}
            <line x1="0" y1="-5" x2="0" y2="-20" />
            {variant === 1 && (
              <>
                {/* Classic fern-dendrite branches */}
                <path d="M-4.5,-10 L0,-13.5 L4.5,-10" />
                <path d="M-3.5,-14.5 L0,-17.5 L3.5,-14.5" />
                <circle cx="0" cy="-20.5" r="1.2" fill={layer.stroke} />
              </>
            )}
            {variant === 2 && (
              <>
                {/* Diamond-tipped star crystal */}
                <path d="M-5,-9.5 L0,-13 L5,-9.5" />
                <path d="M0,-21.5 L2.5,-18 L0,-15 L-2.5,-18 Z" fill={lIdx === 1 ? "#ffffff" : "none"} />
              </>
            )}
            {variant === 3 && (
              <>
                {/* Intricate double-chevron + side needles */}
                <path d="M-5.5,-8.5 L0,-12 L5.5,-8.5" />
                <path d="M-4,-13.5 L0,-16.5 L4,-13.5" />
                <path d="M-2.2,-17.5 L0,-19.5 L2.2,-17.5" />
                <line x1="-3.5" y1="-10.5" x2="-5" y2="-13" />
                <line x1="3.5" y1="-10.5" x2="5" y2="-13" />
              </>
            )}
          </g>
        ))}
      </g>
    ))}
  </svg>
);

interface PineTreeProps {
  x: number;
  y: number;
  scale?: number;
  tone?: "dark" | "mid" | "light";
}

const SnowPineTree: FC<PineTreeProps> = ({ x, y, scale = 1, tone = "mid" }) => {
  const fill = tone === "dark" ? "#3b6e61" : tone === "light" ? "#5d9284" : "#4b7f71";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <rect x="-4" y="42" width="8" height="16" rx="2.5" fill="#8b6b5c" />
      <path d="M0 10 L32 45 L-32 45 Z" fill={fill} />
      <path d="M0 10 L16 28 Q8 31 0 28 Q-8 31 -16 28 Z" fill="#ffffff" />
      <path d="M0 -8 L25 23 L-25 23 Z" fill={fill} />
      <path d="M0 -8 L13 9 Q6 12 0 9 Q-6 12 -13 9 Z" fill="#ffffff" />
      <path d="M0 -24 L18 3 L-18 3 Z" fill={fill} />
      <path d="M0 -24 L9 -9 Q5 -6 0 -9 Q-5 -6 -9 -9 Z" fill="#ffffff" />
    </g>
  );
};

export const LandingBackground: FC = () => {
  const passTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedFirstPassRef = useRef<boolean>(false);
  const [isWindowActive, setIsWindowActive] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.electronAPI?.isWindowActive) {
      return false;
    }
    return typeof document !== "undefined" ? document.visibilityState === "visible" : true;
  });

  const scheduleSantaVoice = () => {
    if (passTimerRef.current) clearTimeout(passTimerRef.current);
    passTimerRef.current = setTimeout(() => {
      if (document.visibilityState === "visible") {
        sound.playSantaHoHoHo();
      }
    }, 900);
  };

  useEffect(() => {
    const api = window.electronAPI;
    let unsub: (() => void) | undefined;

    if (api?.isWindowActive && api?.onWindowActiveChange) {
      api.isWindowActive().then(setIsWindowActive).catch(() => {});
      unsub = api.onWindowActiveChange(setIsWindowActive);
    } else {
      const syncWeb = () => setIsWindowActive(document.visibilityState === "visible");
      syncWeb();
      document.addEventListener("visibilitychange", syncWeb);
      unsub = () => document.removeEventListener("visibilitychange", syncWeb);
    }

    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!isWindowActive) {
      if (passTimerRef.current) {
        clearTimeout(passTimerRef.current);
        passTimerRef.current = null;
      }
      return;
    }

    if (!hasStartedFirstPassRef.current) {
      hasStartedFirstPassRef.current = true;
      scheduleSantaVoice();
    }
  }, [isWindowActive]);

  useEffect(() => {
    return () => {
      if (passTimerRef.current) {
        clearTimeout(passTimerRef.current);
        passTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flowy-sky-bg fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Santa's sleigh & reindeer silhouette flying from right to left across the upper sky */}
      <div
        className={isWindowActive ? "flowy-santa-sleigh" : "flowy-santa-sleigh flowy-santa-paused"}
        onAnimationIteration={(e) => {
          if (e.target === e.currentTarget && isWindowActive) {
            scheduleSantaVoice();
          }
        }}
      >
        <svg viewBox="0 0 240 72" width="196" height="58" fill="#0f172a" focusable="false">
          {/* Reins from sleigh to both reindeer (flying left) */}
          <path d="M40 42 Q85 45 142 36" fill="none" stroke="#0f172a" strokeWidth="1.2" opacity="0.7" />
          {/* Lead reindeer facing LEFT (Rudolph) */}
          <g transform="translate(8 24)">
            <g className="flowy-reindeer-body">
              <ellipse cx="18" cy="18" rx="10" ry="4.5" />
              <path d="M11 16 L7 8 L2 8.5 L3 12 L9 18 Z" />
              <path d="M6 8 L8 1.5 M6.5 5.5 L4 2.5 M5 7.5 L2.5 4" stroke="#0f172a" strokeWidth="1.3" strokeLinecap="round" fill="none" />
              <circle cx="1.5" cy="10" r="1.6" fill="#ef4444" />
              <path className="flowy-leg-front" d="M11 21 L5 29 M14 21 L12 30" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
              <path className="flowy-leg-back" d="M24 21 L28 30 M26 21 L32 27" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          </g>
          {/* Second reindeer facing LEFT */}
          <g transform="translate(58 27)">
            <g className="flowy-reindeer-body" style={{ animationDelay: "-0.22s" }}>
              <ellipse cx="18" cy="18" rx="10" ry="4.5" />
              <path d="M11 16 L7 8 L2 8.5 L3 12 L9 18 Z" />
              <path d="M6 8 L8 1.5 M6.5 5.5 L4 2.5 M5 7.5 L2.5 4" stroke="#0f172a" strokeWidth="1.3" strokeLinecap="round" fill="none" />
              <path className="flowy-leg-front" style={{ animationDelay: "-0.22s" }} d="M11 21 L5 29 M14 21 L12 30" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
              <path className="flowy-leg-back" style={{ animationDelay: "-0.22s" }} d="M24 21 L28 30 M26 21 L32 27" stroke="#0f172a" strokeWidth="1.8" strokeLinecap="round" />
            </g>
          </g>
          {/* Sleigh facing LEFT + Santa clearly visible + Gift sack */}
          <g transform="translate(120 20)">
            {/* Sleigh curved runner (curled front on LEFT) */}
            <path d="M4 34 Q0 40 8 40 H58 Q64 40 65 36" fill="none" stroke="#0f172a" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="20" y1="31" x2="18" y2="39" stroke="#0f172a" strokeWidth="2.2" />
            <line x1="46" y1="31" x2="44" y2="39" stroke="#0f172a" strokeWidth="2.2" />
            {/* Santa sitting in sleigh (facing LEFT) */}
            <circle cx="24" cy="14" r="5" />
            {/* Santa hat + pom-pom */}
            <path d="M19 11 L26 3 L32 10 Z" />
            <circle cx="33" cy="10" r="2" />
            {/* Santa torso & waving arm */}
            <path d="M17 24 C17 17 31 17 31 24 Z" />
            <path d="M19 20 L11 13" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
            {/* Big gift sack behind Santa */}
            <path d="M35 23 C33 13 42 7 49 11 C54 14 54 22 50 25 Z" />
            {/* Sleigh body */}
            <path d="M8 22 C11 32 22 33 52 33 C58 33 62 24 58 17 C53 17 50 22 40 22 C24 22 15 19 8 22 Z" />
          </g>
        </svg>
      </div>

      {/* Upper-horizon winter hills, frozen winding river, and snowy pine trees; clean snow below for buttons */}
      <svg
        viewBox="0 0 1200 720"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        focusable="false"
      >
        <defs>
          <linearGradient id="flowy-ice-river" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bae6fd" />
            <stop offset="55%" stopColor="#d8f0ff" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>
          <linearGradient id="flowy-lower-snow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f1f8ff" />
            <stop offset="100%" stopColor="#f8fbff" />
          </linearGradient>
        </defs>

        {/* Distant snowy mountain ridge in upper sky */}
        <path
          d="M0 240 Q240 165 520 220 T1200 200 L1200 720 L0 720 Z"
          fill="#e2f1ff"
        />

        {/* Upper-midground snowy valley */}
        <path
          d="M0 285 Q340 235 660 280 T1200 265 L1200 720 L0 720 Z"
          fill="url(#flowy-lower-snow)"
        />

        {/* Frozen winding river / lake nestled in the upper-mid valley */}
        <path
          d="M470 250 C560 272 440 315 555 342 C670 370 865 340 990 390 L680 395 C520 385 375 352 405 316 C432 284 405 262 445 246 Z"
          fill="url(#flowy-ice-river)"
          stroke="#ffffff"
          strokeWidth="2.5"
          opacity="0.88"
        />
        <path
          d="M450 315 H515 M565 355 H660 M725 372 H815"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.72"
        />

        {/* Calm snow foreground covering bottom half so buttons & cards stay crisp */}
        <path
          d="M0 385 Q380 360 760 388 T1200 375 L1200 720 L0 720 Z"
          fill="#f8fbff"
          opacity="0.92"
        />

        {/* Snow-covered pine trees framing upper-left & upper-right */}
        <SnowPineTree x={68} y={228} scale={1.05} tone="dark" />
        <SnowPineTree x={138} y={248} scale={0.78} tone="mid" />
        <SnowPineTree x={198} y={238} scale={0.62} tone="light" />

        <SnowPineTree x={1010} y={232} scale={0.65} tone="light" />
        <SnowPineTree x={1070} y={240} scale={0.85} tone="mid" />
        <SnowPineTree x={1142} y={222} scale={1.1} tone="dark" />
      </svg>

      <div className="flowy-snow-layer">
        {SNOWFLAKES.map((flake, index) => (
          <span
            key={index}
            className={flake.variant > 0 ? "flowy-snowflake-crystal" : "flowy-snowflake"}
            style={{
              left: flake.left,
              width: flake.size,
              height: flake.size,
              opacity: flake.opacity,
              animationDuration: flake.dur,
              animationDelay: flake.delay,
            }}
          >
            {flake.variant > 0 ? <CrystalFlake size={flake.size} variant={flake.variant} /> : null}
          </span>
        ))}
      </div>
    </div>
  );
};

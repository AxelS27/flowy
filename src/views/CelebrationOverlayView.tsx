import { useEffect, useRef, useState } from "react";

// Dedicated click-through desktop overlay for subtle ambient edge lighting on completion.
export function CelebrationOverlayView() {
  const [visible, setVisible] = useState(false);
  const [cycle, setCycle] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const celebrate = () => {
      clearTimer();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setCycle((c) => c + 1);
      setVisible(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
      }, 2400);
    };

    const unsubscribe = api.onCelebrationStart(celebrate);
    api.celebrationReady();
    return () => {
      unsubscribe();
      clearTimer();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      key={cycle}
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ animation: "flowy-ambient-fade 2.3s ease-in-out forwards" }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes flowy-ambient-fade {
          0% { opacity: 0; }
          22% { opacity: 1; }
          65% { opacity: 0.85; }
          100% { opacity: 0; }
        }
      `}</style>
      <div
        className="fixed inset-y-0 left-0 w-40"
        style={{
          background:
            "radial-gradient(ellipse at 0% 50%, rgba(48, 209, 88, 0.32) 0%, rgba(48, 209, 88, 0.10) 45%, transparent 78%)",
        }}
      />
      <div
        className="fixed inset-y-0 right-0 w-40"
        style={{
          background:
            "radial-gradient(ellipse at 100% 50%, rgba(48, 209, 88, 0.32) 0%, rgba(48, 209, 88, 0.10) 45%, transparent 78%)",
        }}
      />
    </div>
  );
}

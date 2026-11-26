import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Dedicated click-through desktop overlay for subtle ambient edge lighting on completion.
export function CelebrationOverlayView() {
  const [visible, setVisible] = useState(false);
  const [cycle, setCycle] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

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
      if (reducedMotion) return;
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
  }, [reducedMotion]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={cycle}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.85, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.3, times: [0, 0.22, 0.65, 1], ease: "easeInOut" }}
            className="fixed inset-0 pointer-events-none"
          >
            {/* Left edge soft emerald ambient glow */}
            <div
              className="fixed inset-y-0 left-0 w-40"
              style={{
                background:
                  "radial-gradient(ellipse at 0% 50%, rgba(48, 209, 88, 0.32) 0%, rgba(48, 209, 88, 0.10) 45%, transparent 78%)",
              }}
            />
            {/* Right edge soft emerald ambient glow */}
            <div
              className="fixed inset-y-0 right-0 w-40"
              style={{
                background:
                  "radial-gradient(ellipse at 100% 50%, rgba(48, 209, 88, 0.32) 0%, rgba(48, 209, 88, 0.10) 45%, transparent 78%)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

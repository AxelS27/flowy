import { useState, useCallback } from "react";
import { sound } from "../utils/soundEffects";

export function useSoundEffect() {
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());
  const [isBgmOn, setIsBgmOn] = useState<boolean>(() => sound.getBgmEnabled());

  const toggleMute = useCallback(() => {
    const nextState = sound.toggleMute();
    setIsMuted(nextState);
    return nextState;
  }, []);

  const toggleBgm = useCallback(() => {
    const nextState = sound.toggleBgm();
    setIsBgmOn(nextState);
    return nextState;
  }, []);

  const playSound = useCallback((effect: keyof typeof sound, ...args: any[]) => {
    const fn = sound[effect];
    if (typeof fn === "function") {
      try {
        (fn as Function).apply(sound, args);
      } catch (err) {
        console.warn(`[Flowy] Error playing sound ${String(effect)}:`, err);
      }
    }
  }, []);

  return {
    isMuted,
    toggleMute,
    isBgmOn,
    toggleBgm,
    playSound,
  };
}

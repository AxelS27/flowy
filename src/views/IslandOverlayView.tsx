import { useState, useEffect } from "react";
import { DynamicIsland } from "../components";
import { Routine, IslandState } from "../types";

export function IslandOverlayView() {
  const [islandState, setIslandState] = useState<IslandState>("idle");
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null);
  const [candidates, setCandidates] = useState<Routine[]>([]);
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [externalError, setExternalError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const cleanupActivate = api.onIslandActivate?.((incomingRoutine: Routine | null) => {
      setActiveRoutine(incomingRoutine);
      setCandidates([]);
      setSubtitle(undefined);
      setExternalError(undefined);
      setIslandState("executing");
    });

    const cleanupSync = api.onIslandSync?.((payload) => {
      setIslandState((payload.state as IslandState) || "idle");
      if (payload.routine !== undefined) setActiveRoutine(payload.routine);
      setCandidates(payload.candidates || []);
      setSubtitle(payload.subtitle);
      setExternalError(payload.error);
    });

    return () => {
      cleanupActivate?.();
      cleanupSync?.();
    };
  }, []);

  return (
    <div className="w-screen h-screen bg-transparent flex items-start justify-center pt-0 select-none overflow-hidden">
      <DynamicIsland
        activeRoutine={activeRoutine}
        candidates={candidates}
        state={islandState}
        subtitle={subtitle}
        externalError={externalError}
        onStartVoice={() => window.electronAPI?.sendIslandAction?.("start-voice")}
        onStopListening={() => window.electronAPI?.sendIslandAction?.("stop-listening")}
        onCancelVoice={() => window.electronAPI?.sendIslandAction?.("cancel-voice")}
        onSelectCandidate={(routine) =>
          window.electronAPI?.sendIslandAction?.(`select-routine:${routine.id}`)
        }
        onStateChange={(s) => {
          setIslandState(s);
        }}
        isStandaloneWindow={true}
      />
    </div>
  );
}

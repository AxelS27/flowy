import { contextBridge, ipcRenderer } from "electron";
import { Routine, IslandStatusData, RoutineStep } from "./types";
import { AiConfigurationStatus, RouteRequest, RouteResult } from "./backend/ai/types";

export type { Routine, RoutineStep, IslandStatusData };

const electronAPI = {
  // Window management
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),

  // Dynamic Island
  showIsland: (routine?: Routine) => ipcRenderer.send("island:show", routine),
  hideIsland: () => ipcRenderer.send("island:hide"),
  setIslandInteractive: (interactive: boolean) => ipcRenderer.send("island:interactive", interactive),
  resizeIsland: (width: number, height: number) =>
    ipcRenderer.send("island:resize", { width, height }),

  onIslandActivate: (callback: (routine: Routine | null) => void) => {
    const handler = (_: any, routine: any) => callback(routine);
    ipcRenderer.on("island:activate", handler);
    return () => ipcRenderer.removeListener("island:activate", handler);
  },

  onIslandStatus: (callback: (status: IslandStatusData) => void) => {
    const handler = (_: any, status: any) => callback(status);
    ipcRenderer.on("island:status", handler);
    return () => ipcRenderer.removeListener("island:status", handler);
  },

  // Full-desktop, click-through celebration overlay
  celebrate: () => ipcRenderer.send("celebration:show"),
  celebrationReady: () => ipcRenderer.send("celebration:ready"),
  onCelebrationStart: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("celebration:start", handler);
    return () => ipcRenderer.removeListener("celebration:start", handler);
  },

  // Voice Simulation & Execution
  simulateWakeWord: (routine?: Routine) => ipcRenderer.send("voice:simulate-wake", routine),
  executeRoutine: (routine: { id: string; steps: RoutineStep[]; runId?: string }): Promise<{ success: boolean; runId: string; error?: string; code?: string; stepIndex?: number }> =>
    ipcRenderer.invoke("routine:execute", routine),
  cancelRoutine: (runId?: string) => ipcRenderer.send("routine:cancel", runId),

  // AI workspace routing (selection only; never executes a routine)
  getAiConfiguration: (): Promise<AiConfigurationStatus> => ipcRenderer.invoke("ai:configuration"),
  routeIntent: (request: RouteRequest): Promise<RouteResult> => ipcRenderer.invoke("ai:route", request),
  cancelIntentRoute: (requestId: string) => ipcRenderer.send("ai:cancel", requestId),

  // Listeners
  onWakeDetected: (callback: (data: { keyword: string }) => void) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on("voice:wake-detected", handler);
    return () => ipcRenderer.removeListener("voice:wake-detected", handler);
  },
  onStepProgress: (
    callback: (data: {
      routineId: string;
      runId: string;
      error?: string;
      stepIndex: number;
      stepTitle: string;
      status: "running" | "completed" | "failed" | "skipped";
  note?: string;
    }) => void
  ) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on("routine:step-progress", handler);
    return () => ipcRenderer.removeListener("routine:step-progress", handler);
  },
  onRoutineFinished: (
    callback: (data: { routineId: string; runId: string; success: boolean; error?: string; code?: string }) => void
  ) => {
    const handler = (_: any, data: any) => callback(data);
    ipcRenderer.on("routine:finished", handler);
    return () => ipcRenderer.removeListener("routine:finished", handler);
  },
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;

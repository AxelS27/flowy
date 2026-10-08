import { Routine, RoutineStep } from "./routine";
import { AiConfigurationStatus, RouteRequest, RouteResult } from "./ai";

export interface StepProgressData {
  routineId: string;
  runId: string;
  error?: string;
  stepIndex: number;
  stepTitle: string;
  status: "running" | "completed" | "failed" | "skipped";
  note?: string;
}

export interface RoutineFinishedData {
  routineId: string;
  runId: string;
  error?: string;
  code?: string;
  success: boolean;
}

export interface IslandStatusData {
  isBusy: boolean;
  routine?: Routine;
}

export interface ElectronAPI {
  // Window management
  minimize: () => void;
  maximize: () => void;
  close: () => void;

  // Dynamic Island
  showIsland: (routine?: Routine) => void;
  hideIsland: () => void;
  setIslandInteractive: (interactive: boolean) => void;
  resizeIsland: (width: number, height: number) => void;
  onIslandActivate: (callback: (routine: Routine | null) => void) => () => void;
  onIslandStatus: (callback: (status: IslandStatusData) => void) => () => void;

  // Full-desktop celebration overlay
  celebrate: () => void;
  celebrationReady: () => void;
  onCelebrationStart: (callback: () => void) => () => void;

  // Voice Simulation & Execution
  simulateWakeWord: (routine?: Routine) => void;
  executeRoutine: (routine: { id: string; steps: RoutineStep[]; runId?: string }) => Promise<{ success: boolean; runId: string; error?: string; code?: string; stepIndex?: number }>;
  cancelRoutine: (runId?: string) => void;

  // AI workspace routing
  getAiConfiguration: () => Promise<AiConfigurationStatus>;
  routeIntent: (request: RouteRequest) => Promise<RouteResult>;
  cancelIntentRoute: (requestId: string) => void;

  // Listeners
  onWakeDetected: (callback: (data: { keyword: string }) => void) => () => void;
  onStepProgress: (callback: (data: StepProgressData) => void) => () => void;
  onRoutineFinished: (callback: (data: RoutineFinishedData) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

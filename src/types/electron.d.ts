import { Routine, RoutineStep } from "./routine";
import { AiConfigurationStatus, RouteRequest, RouteResult } from "./ai";
import { SttElectronAPI } from "./stt";

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

export type IslandIdleMode = "always-on-top" | "desktop-only";

export interface AppSettingsData {
  islandIdleMode: IslandIdleMode;
  masterHotkey: string;
}

export interface UpdaterStatusData {
  currentVersion: string;
  state: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  latestVersion?: string;
  downloadPercent?: number;
  releaseUrl: string;
  message?: string;
}

export interface IslandStatusData {
  isBusy: boolean;
  routine?: Routine;
}

export interface ElectronAPI extends SttElectronAPI {
  // Window management
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isWindowActive?: () => Promise<boolean>;
  onWindowActiveChange?: (callback: (active: boolean) => void) => () => void;

  // Dynamic Island
  showIsland: (routine?: Routine) => void;
  hideIsland: () => void;
  setIslandInteractive: (interactive: boolean) => void;
  resizeIsland: (width: number, height: number) => void;
  syncIslandState: (payload: {
    state: string;
    routine?: Routine | null;
    candidates?: Routine[];
    subtitle?: string;
    error?: string;
  }) => void;
  sendIslandAction: (action: string) => void;
  setEscapeCancelActive: (active: boolean) => void;
  onIslandActivate: (callback: (routine: Routine | null) => void) => () => void;
  onIslandStatus: (callback: (status: IslandStatusData) => void) => () => void;
  onIslandSync: (
    callback: (payload: {
      state: string;
      routine?: Routine | null;
      candidates?: Routine[];
      subtitle?: string;
      error?: string;
    }) => void
  ) => () => void;
  onIslandAction: (callback: (action: string) => void) => () => void;

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

  // App Updater
  getUpdaterStatus: () => Promise<UpdaterStatusData>;
  checkForUpdates: () => Promise<UpdaterStatusData>;
  downloadUpdate: () => Promise<UpdaterStatusData>;
  installUpdate: () => void;
  openReleasesPage: () => void;
  onUpdaterStatus: (callback: (status: UpdaterStatusData) => void) => () => void;

  // App Settings
  getSettings: () => Promise<AppSettingsData>;
  updateSettings: (patch: Partial<AppSettingsData>) => Promise<{
    ok: boolean;
    settings: AppSettingsData;
    error?: string;
  }>;

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

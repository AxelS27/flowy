import { app, shell } from "electron";
import { autoUpdater } from "electron-updater";
import { getMainWindow, safeSend } from "./windows/windowManager";

export type UpdateUiState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdaterStatus {
  currentVersion: string;
  state: UpdateUiState;
  latestVersion?: string;
  downloadPercent?: number;
  releaseUrl: string;
  message?: string;
}

const GITHUB_RELEASES_URL = "https://github.com/AxelS27/flowy/releases";
const GITHUB_LATEST_API = "https://api.github.com/repos/AxelS27/flowy/releases/latest";

let status: UpdaterStatus = {
  currentVersion: app.getVersion(),
  state: "idle",
  releaseUrl: GITHUB_RELEASES_URL,
};

let initialized = false;

function setStatus(patch: Partial<UpdaterStatus>): UpdaterStatus {
  status = { ...status, ...patch, currentVersion: app.getVersion() };
  safeSend(getMainWindow(), "updater:status", status);
  return status;
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getUpdaterStatus(): UpdaterStatus {
  return status;
}

export function initAutoUpdater(): void {
  if (initialized) return;
  initialized = true;

  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    setStatus({ state: "checking", message: undefined });
  });

  autoUpdater.on("update-available", (info) => {
    setStatus({
      state: "available",
      latestVersion: info.version,
      releaseUrl: `${GITHUB_RELEASES_URL}/tag/v${info.version}`,
      message: `Update v${info.version} is available.`,
    });
  });

  autoUpdater.on("update-not-available", () => {
    setStatus({
      state: "not-available",
      latestVersion: app.getVersion(),
      message: "You are on the latest version.",
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    setStatus({
      state: "downloading",
      downloadPercent: Math.round(progress.percent),
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    setStatus({
      state: "downloaded",
      latestVersion: info.version,
      downloadPercent: 100,
      message: `v${info.version} ready to install.`,
    });
  });

  autoUpdater.on("error", (err) => {
    setStatus({
      state: "error",
      message: err?.message || "Could not check for updates.",
    });
  });

  // Quietly check in background shortly after startup.
  setTimeout(() => {
    void checkForUpdates().catch(() => {});
  }, 4000);
}

export async function checkForUpdates(): Promise<UpdaterStatus> {
  if (app.isPackaged) {
    setStatus({ state: "checking", message: undefined });
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Failed to check updates.",
      });
    }
    return status;
  }

  // Dev mode fallback: query GitHub Releases API directly so UI can be tested.
  setStatus({ state: "checking", message: undefined });
  try {
    const res = await fetch(GITHUB_LATEST_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "Flowy-Desktop" },
    });
    if (res.status === 404) {
      return setStatus({
        state: "not-available",
        latestVersion: app.getVersion(),
        releaseUrl: GITHUB_RELEASES_URL,
        message: "No GitHub releases published yet.",
      });
    }
    if (!res.ok) {
      throw new Error(`GitHub API HTTP ${res.status}`);
    }
    const data = (await res.json()) as { tag_name?: string; html_url?: string };
    const latest = (data.tag_name || "").replace(/^v/i, "");
    const releaseUrl = data.html_url || GITHUB_RELEASES_URL;
    if (latest && compareSemver(latest, app.getVersion()) > 0) {
      return setStatus({
        state: "available",
        latestVersion: latest,
        releaseUrl,
        message: `Update v${latest} is available.`,
      });
    }
    return setStatus({
      state: "not-available",
      latestVersion: app.getVersion(),
      releaseUrl,
      message: "You are on the latest version.",
    });
  } catch (err) {
    return setStatus({
      state: "error",
      message: err instanceof Error ? err.message : "Could not reach GitHub Releases.",
    });
  }
}

export async function downloadUpdate(): Promise<UpdaterStatus> {
  if (!app.isPackaged) {
    await shell.openExternal(status.releaseUrl || GITHUB_RELEASES_URL);
    return status;
  }
  setStatus({ state: "downloading", downloadPercent: 0 });
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    setStatus({
      state: "error",
      message: err instanceof Error ? err.message : "Download failed. Try manual download.",
    });
  }
  return status;
}

export function installUpdate(): void {
  if (app.isPackaged) {
    autoUpdater.quitAndInstall();
  }
}

export async function openReleasesPage(): Promise<void> {
  await shell.openExternal(status.releaseUrl || GITHUB_RELEASES_URL);
}

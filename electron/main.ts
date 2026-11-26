import { app, BrowserWindow } from "electron";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createMainWindow, showMainWindow } from "./windows/mainWindow";
import { createIslandWindow } from "./windows/islandWindow";
import { registerAllIpc } from "./ipc";
import { createAppTray, destroyAppTray, setAppQuitting } from "./tray";
import { initAutoUpdater } from "./updater";
import { loadSettings } from "./settings";
import { registerMasterHotkey, unregisterAllHotkeys } from "./hotkey";

function loadLocalEnv(): void {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(app.getAppPath(), ".env"),
  ];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIndex = line.indexOf("=");
      if (eqIndex <= 0) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
    break;
  }
}

loadLocalEnv();

// Windows toast notifications need a stable application identity.
if (process.platform === "win32") app.setAppUserModelId("com.flowy.desktop");
// Desktop Control Panel needs BGM & Santa SFX to play automatically when window opens without requiring a click first.
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });
}

app.whenReady().then(() => {
  registerAllIpc();

  // Start hidden in system tray as a Control Panel; Dynamic Island stays visible at top.
  createMainWindow({ showOnReady: false });
  createIslandWindow();
  createAppTray();
  initAutoUpdater();

  // Global hotkey works anywhere on Windows even when Control Panel is hidden in tray.
  const initialSettings = loadSettings();
  const res = registerMasterHotkey(initialSettings.masterHotkey);
  if (!res.ok) {
    console.warn("[Flowy]", res.error);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow({ showOnReady: true });
    } else {
      showMainWindow();
    }
  });
});

app.on("before-quit", () => {
  setAppQuitting(true);
});

app.on("will-quit", () => {
  unregisterAllHotkeys();
  destroyAppTray();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

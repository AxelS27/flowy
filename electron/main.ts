import { app, BrowserWindow } from "electron";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createMainWindow } from "./windows/mainWindow";
import { createIslandWindow } from "./windows/islandWindow";
import { registerAllIpc } from "./ipc";

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

// App lifecycle
app.whenReady().then(() => {
  // Register all IPC communication modules
  registerAllIpc();

  // Initialize windows
  createMainWindow();
  createIslandWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

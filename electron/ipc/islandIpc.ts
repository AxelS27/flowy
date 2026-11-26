import { ipcMain } from "electron";
import { setEscapeCancelActive } from "../hotkey";
import { applyIslandIdleMode, createIslandWindow, releaseIslandLock, positionIslandWindow } from "../windows/islandWindow";
import { getIslandWindow, getMainWindow, safeSend } from "../windows/windowManager";
import { Routine } from "../types";
import { isTrustedSender } from "./trust";

export function registerIslandIpc() {
  ipcMain.on("island:show", (event, routineData?: Routine) => {
    if (!isTrustedSender(event)) return;
    const win = createIslandWindow();

    if (win && !win.isDestroyed()) {
      applyIslandIdleMode("active");
      win.showInactive();
      if (win.webContents.isLoading()) {
        win.webContents.once("did-finish-load", () => {
          safeSend(win, "island:activate", routineData);
        });
      } else {
        safeSend(win, "island:activate", routineData);
      }
    }

    safeSend(getMainWindow(), "island:status", { isBusy: true, routine: routineData });
  });

  ipcMain.on("island:sync", (event, payload: unknown) => {
    if (!isTrustedSender(event) || !payload || typeof payload !== "object") return;
    const win = createIslandWindow();
    const state = (payload as { state?: unknown }).state;
    if (win && !win.isDestroyed()) {
      applyIslandIdleMode(state === "idle" ? "idle" : "active");
      if (win.webContents.isLoading()) {
        win.webContents.once("did-finish-load", () => {
          safeSend(win, "island:sync", payload);
        });
      } else {
        safeSend(win, "island:sync", payload);
      }
    }
  });

  ipcMain.on("island:action", (event, action: unknown) => {
    if (!isTrustedSender(event) || typeof action !== "string") return;
    safeSend(getMainWindow(), "island:action", action);
  });

  ipcMain.on("island:escape", (event, active: unknown) => {
    if (!isTrustedSender(event) || typeof active !== "boolean") return;
    setEscapeCancelActive(active);
  });

  ipcMain.on("island:hide", (event) => {
    if (!isTrustedSender(event)) return;
    const win = getIslandWindow();
    if (win && !win.isDestroyed()) {
      win.hide();
    }
    releaseIslandLock();
  });

  ipcMain.on("island:resize", (event, bounds: unknown) => {
    if (!isTrustedSender(event) || !bounds || typeof bounds !== "object") return;
    const { width, height } = bounds as { width?: unknown; height?: unknown };
    if (typeof width !== "number" || typeof height !== "number" || !Number.isFinite(width) || !Number.isFinite(height) || width < 100 || width > 1000 || height < 30 || height > 800) return;
    const win = getIslandWindow();
    if (!win || win.isDestroyed()) return;

    positionIslandWindow(win, width, height);
  });

  ipcMain.on("island:interactive", (event, interactive: unknown) => {
    if (!isTrustedSender(event) || typeof interactive !== "boolean") return;
    const win = getIslandWindow();
    if (!win || win.isDestroyed() || win.webContents.id !== event.sender.id) return;
    win.setIgnoreMouseEvents(!interactive, { forward: true });
  });

  ipcMain.on("voice:simulate-wake", (event, routineData?: Routine) => {
    if (!isTrustedSender(event)) return;
    const win = createIslandWindow();

    if (win && !win.isDestroyed()) {
      applyIslandIdleMode("active");
      win.showInactive();
      if (win.webContents.isLoading()) {
        win.webContents.once("did-finish-load", () => {
          safeSend(win, "island:activate", routineData);
        });
      } else {
        safeSend(win, "island:activate", routineData);
      }
    }
  });
}

import { ipcMain } from "electron";
import { getMainWindow } from "../windows/windowManager";
import { isTrustedSender } from "./trust";

export function registerWindowIpc() {
  ipcMain.on("window:minimize", (event) => {
    if (!isTrustedSender(event)) return;
    getMainWindow()?.minimize();
  });

  ipcMain.on("window:maximize", () => {
    // Fixed-size control panel; maximize/fullscreen disabled.
  });

  ipcMain.on("window:close", (event) => {
    if (!isTrustedSender(event)) return;
    getMainWindow()?.close();
  });

  ipcMain.handle("window:is-active", (event) => {
    if (!isTrustedSender(event)) return false;
    const win = getMainWindow();
    return Boolean(win && !win.isDestroyed() && win.isVisible() && !win.isMinimized());
  });
}

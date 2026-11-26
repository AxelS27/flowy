import { ipcMain } from "electron";
import {
  checkForUpdates,
  downloadUpdate,
  getUpdaterStatus,
  installUpdate,
  openReleasesPage,
} from "../updater";
import { isTrustedSender } from "./trust";

export function registerUpdaterIpc(): void {
  ipcMain.handle("updater:get-status", (event) => {
    if (!isTrustedSender(event)) throw new Error("Untrusted updater request.");
    return getUpdaterStatus();
  });

  ipcMain.handle("updater:check", async (event) => {
    if (!isTrustedSender(event)) throw new Error("Untrusted updater request.");
    return checkForUpdates();
  });

  ipcMain.handle("updater:download", async (event) => {
    if (!isTrustedSender(event)) throw new Error("Untrusted updater request.");
    return downloadUpdate();
  });

  ipcMain.on("updater:install", (event) => {
    if (!isTrustedSender(event)) return;
    installUpdate();
  });

  ipcMain.on("updater:open-releases", (event) => {
    if (!isTrustedSender(event)) return;
    void openReleasesPage();
  });
}

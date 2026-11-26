import { ipcMain } from "electron";
import { registerMasterHotkey } from "../hotkey";
import { AppSettings, loadSettings, saveSettings } from "../settings";
import { applyIslandIdleMode } from "../windows/islandWindow";
import { isTrustedSender } from "./trust";

export function registerSettingsIpc(): void {
  ipcMain.handle("settings:get", (event) => {
    if (!isTrustedSender(event)) throw new Error("Untrusted settings request.");
    return loadSettings();
  });

  ipcMain.handle("settings:update", (event, patch: unknown) => {
    if (!isTrustedSender(event)) throw new Error("Untrusted settings update.");
    const current = loadSettings();
    if (!patch || typeof patch !== "object") {
      return { ok: false, settings: current, error: "Invalid settings payload." };
    }

    const input = patch as Partial<AppSettings>;
    const next: AppSettings = {
      islandIdleMode:
        input.islandIdleMode === "desktop-only" || input.islandIdleMode === "always-on-top"
          ? input.islandIdleMode
          : current.islandIdleMode,
      masterHotkey:
        typeof input.masterHotkey === "string" && input.masterHotkey.trim()
          ? input.masterHotkey.trim()
          : current.masterHotkey,
    };

    if (next.masterHotkey !== current.masterHotkey) {
      const res = registerMasterHotkey(next.masterHotkey);
      if (!res.ok) {
        return { ok: false, settings: current, error: res.error };
      }
    }

    const saved = saveSettings(next);
    applyIslandIdleMode();
    return { ok: true, settings: saved };
  });
}

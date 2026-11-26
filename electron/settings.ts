import { app } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type IslandIdleMode = "always-on-top" | "desktop-only";

export interface AppSettings {
  islandIdleMode: IslandIdleMode;
  masterHotkey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  islandIdleMode: "always-on-top",
  masterHotkey: "CommandOrControl+Space",
};

function settingsPath(): string {
  return path.join(app.getPath("userData"), "flowy-settings.json");
}

let cachedSettings: AppSettings | null = null;

export function loadSettings(): AppSettings {
  if (cachedSettings) return cachedSettings;
  try {
    const file = settingsPath();
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<AppSettings>;
      cachedSettings = {
        islandIdleMode:
          parsed.islandIdleMode === "desktop-only" ? "desktop-only" : "always-on-top",
        masterHotkey:
          typeof parsed.masterHotkey === "string" && parsed.masterHotkey.trim()
            ? parsed.masterHotkey.trim()
            : DEFAULT_SETTINGS.masterHotkey,
      };
      return cachedSettings;
    }
  } catch {
    // Fallback to defaults if file is malformed
  }
  cachedSettings = { ...DEFAULT_SETTINGS };
  return cachedSettings;
}

export function saveSettings(next: AppSettings): AppSettings {
  cachedSettings = {
    islandIdleMode:
      next.islandIdleMode === "desktop-only" ? "desktop-only" : "always-on-top",
    masterHotkey: next.masterHotkey.trim() || DEFAULT_SETTINGS.masterHotkey,
  };
  try {
    writeFileSync(settingsPath(), JSON.stringify(cachedSettings, null, 2), "utf8");
  } catch {
    // Ignore write failure
  }
  return cachedSettings;
}

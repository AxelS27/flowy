import { globalShortcut } from "electron";
import { createMainWindow } from "./windows/mainWindow";
import { getMainWindow, safeSend } from "./windows/windowManager";

let activeAccelerator: string | null = null;
let escapeRegistered = false;

export function setEscapeCancelActive(active: boolean): void {
  if (active === escapeRegistered) return;
  if (active) {
    try {
      escapeRegistered = globalShortcut.register("Escape", () => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          safeSend(win, "island:action", "escape-cancel");
        }
      });
    } catch {
      escapeRegistered = false;
    }
  } else {
    try {
      globalShortcut.unregister("Escape");
    } catch {
      // Ignore unregister errors
    }
    escapeRegistered = false;
  }
}

export function registerMasterHotkey(accelerator: string): { ok: boolean; error?: string } {
  const trimmed = accelerator.trim();
  if (!trimmed) {
    return { ok: false, error: "Shortcut cannot be empty." };
  }

  const prev = activeAccelerator;
  if (prev === trimmed && globalShortcut.isRegistered(trimmed)) {
    return { ok: true };
  }

  if (prev) {
    globalShortcut.unregister(prev);
  }

  let registered = false;
  try {
    registered = globalShortcut.register(trimmed, () => {
      const win = getMainWindow() ?? createMainWindow({ showOnReady: false });
      safeSend(win, "voice:wake-detected", { keyword: "hotkey" });
    });
  } catch {
    registered = false;
  }

  if (!registered) {
    // Restore previous working hotkey if the new one failed
    if (prev) {
      try {
        globalShortcut.register(prev, () => {
          const win = getMainWindow() ?? createMainWindow({ showOnReady: false });
          safeSend(win, "voice:wake-detected", { keyword: "hotkey" });
        });
      } catch {
        // Ignore restore failure
      }
    }
    return {
      ok: false,
      error: `Could not register "${trimmed}". It may be in use by another app.`,
    };
  }

  activeAccelerator = trimmed;
  return { ok: true };
}

export function unregisterAllHotkeys(): void {
  globalShortcut.unregisterAll();
  activeAccelerator = null;
  escapeRegistered = false;
}

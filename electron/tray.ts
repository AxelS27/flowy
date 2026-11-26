import { app, Menu, nativeImage, Tray } from "electron";
import { getMainWindow, safeSend } from "./windows/windowManager";
import { createMainWindow, showMainWindow } from "./windows/mainWindow";

let tray: Tray | null = null;
let quitting = false;

export function isAppQuitting(): boolean {
  return quitting;
}

export function setAppQuitting(value: boolean): void {
  quitting = value;
}

function createFlowyTrayIcon(): Electron.NativeImage {
  // 16x16 crisp RGBA badge (mint-green orb with soft dark border)
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const cx = 7.5;
  const cy = 7.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= 6.2) {
        // Mint/emerald Flowy orb (#34D399)
        buf[idx] = 52;
        buf[idx + 1] = 211;
        buf[idx + 2] = 153;
        buf[idx + 3] = 255;
      } else if (dist <= 7.4) {
        // Soft dark outline (#0F172A)
        buf[idx] = 15;
        buf[idx + 1] = 23;
        buf[idx + 2] = 42;
        buf[idx + 3] = 220;
      } else {
        buf[idx + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

export function createAppTray(): Tray {
  if (tray && !tray.isDestroyed()) return tray;

  tray = new Tray(createFlowyTrayIcon());
  tray.setToolTip("Flowy");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Control Panel",
      click: () => {
        createMainWindow({ showOnReady: true });
        showMainWindow();
      },
    },
    {
      label: "Talk to Flowy (Ctrl+Space)",
      click: () => {
        const win = getMainWindow() ?? createMainWindow({ showOnReady: false });
        safeSend(win, "voice:wake-detected", { keyword: "tray" });
      },
    },
    { type: "separator" },
    {
      label: "Quit Flowy",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    createMainWindow({ showOnReady: true });
    showMainWindow();
  });

  return tray;
}

export function destroyAppTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
}

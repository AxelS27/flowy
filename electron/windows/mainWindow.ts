import { BrowserWindow } from "electron";
import path from "path";
import { closeCelebrationWindow } from "./celebrationWindow";
import { getMainWindow, setMainWindow, getIslandWindow, isDev, restrictRendererNavigation, safeSend } from "./windowManager";
import { isAppQuitting } from "../tray";

export interface CreateMainWindowOptions {
  showOnReady?: boolean;
}

export function showMainWindow(): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

export function createMainWindow(options: CreateMainWindowOptions = {}): BrowserWindow {
  const { showOnReady = false } = options;
  const existing = getMainWindow();
  if (existing && !existing.isDestroyed()) {
    if (showOnReady) showMainWindow();
    return existing;
  }

  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 1100,
    minHeight: 760,
    maxWidth: 1100,
    maxHeight: 760,
    maximizable: false,
    fullscreenable: false,
    resizable: false,
    frame: false,
    backgroundColor: "#FAF8F5",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setResizable(false);
  win.setMaximizable(false);
  win.setFullScreenable(false);
  win.on("will-resize", (event) => {
    event.preventDefault();
  });
  win.on("maximize", () => {
    win.unmaximize();
    win.setSize(1100, 760);
  });
  win.on("enter-full-screen", () => {
    win.setFullScreen(false);
    win.setSize(1100, 760);
  });

  setMainWindow(win);
  restrictRendererNavigation(win);

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    win.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  const sendWindowActive = (active: boolean) => {
    if (win.isDestroyed()) return;
    safeSend(win, "window:active-change", active);
  };

  const syncWindowActive = () => {
    if (win.isDestroyed()) return;
    sendWindowActive(win.isVisible() && !win.isMinimized());
  };

  win.once("ready-to-show", () => {
    if (showOnReady) {
      win.show();
    }
    syncWindowActive();
  });

  win.webContents.on("did-finish-load", syncWindowActive);
  win.on("show", () => sendWindowActive(!win.isMinimized()));
  win.on("hide", () => sendWindowActive(false));
  win.on("minimize", () => sendWindowActive(false));
  win.on("restore", () => sendWindowActive(win.isVisible()));

  win.on("close", (event) => {
    if (!isAppQuitting()) {
      event.preventDefault();
      sendWindowActive(false);
      win.hide();
    }
  });

  win.on("closed", () => {
    closeCelebrationWindow();
    setMainWindow(null);
    const island = getIslandWindow();
    if (island && !island.isDestroyed()) {
      island.close();
    }
  });

  return win;
}

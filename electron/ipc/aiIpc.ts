import { app, ipcMain } from "electron";
import { getAiConfigurationStatus, routeIntent } from "../backend/ai/router";
import { getMainWindow } from "../windows/windowManager";
import { isTrustedSender } from "./trust";

const pending = new Map<number, { requestId: string; controller: AbortController }>();

function isTrustedMainSender(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  const main = getMainWindow();
  return isTrustedSender(event) && Boolean(main && !main.isDestroyed() && main.webContents.id === event.sender.id);
}

export function registerAiIpc() {
  ipcMain.handle("ai:configuration", (event) => {
    if (!isTrustedMainSender(event)) throw new Error("Untrusted AI configuration request.");
    return getAiConfigurationStatus();
  });

  ipcMain.handle("ai:route", async (event, input: unknown) => {
    if (!isTrustedMainSender(event)) throw new Error("Untrusted AI routing request.");
    const senderId = event.sender.id;
    pending.get(senderId)?.controller.abort();
    const requestId = input && typeof input === "object" && typeof (input as { requestId?: unknown }).requestId === "string"
      ? (input as { requestId: string }).requestId
      : "invalid";
    const controller = new AbortController();
    pending.set(senderId, { requestId, controller });
    const destroy = () => controller.abort();
    event.sender.once("destroyed", destroy);
    try {
      return await routeIntent(input, controller.signal);
    } finally {
      event.sender.removeListener("destroyed", destroy);
      if (pending.get(senderId)?.controller === controller) pending.delete(senderId);
    }
  });

  ipcMain.on("ai:cancel", (event, requestId: unknown) => {
    if (!isTrustedMainSender(event) || typeof requestId !== "string") return;
    const item = pending.get(event.sender.id);
    if (item?.requestId === requestId) item.controller.abort();
  });

  app.on("before-quit", () => {
    for (const item of pending.values()) item.controller.abort();
    pending.clear();
  });
}

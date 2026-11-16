import { app, ipcMain, IpcMainInvokeEvent, WebContents } from "electron";
import { SttManager } from "../backend/stt/sttManager";
import { SttTranscribeRequest, SttTranscribeResponse } from "../backend/stt/types";

interface ActiveSttJob {
  requestId: string;
  controller: AbortController;
}

export interface RegisterSttIpcOptions {
  isTrustedSender?: (sender: WebContents) => boolean;
}

const activeJobs = new Map<number, ActiveSttJob>();
const observedRenderers = new Set<number>();

function abortJobForRenderer(rendererId: number): void {
  const existing = activeJobs.get(rendererId);
  if (existing) {
    existing.controller.abort();
    activeJobs.delete(rendererId);
  }
}

function attachRendererLifecycleCleanup(sender: WebContents): void {
  const rendererId = sender.id;
  if (observedRenderers.has(rendererId)) return;
  observedRenderers.add(rendererId);

  sender.once("destroyed", () => {
    abortJobForRenderer(rendererId);
    observedRenderers.delete(rendererId);
  });

  sender.on("did-start-navigation", (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) {
      abortJobForRenderer(rendererId);
    }
  });
}

function isEventAuthorized(
  event: IpcMainInvokeEvent,
  isTrustedSender?: (sender: WebContents) => boolean,
): boolean {
  if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
    return false;
  }
  if (isTrustedSender && !isTrustedSender(event.sender)) {
    return false;
  }
  return true;
}

export function registerSttIpc(options: RegisterSttIpcOptions = {}): void {
  const manager = new SttManager();
  const { isTrustedSender } = options;

  ipcMain.removeHandler("stt:configuration");
  ipcMain.removeHandler("stt:transcribe");
  ipcMain.removeAllListeners("stt:cancel");

  ipcMain.handle("stt:configuration", (event) => {
    if (!isEventAuthorized(event, isTrustedSender)) {
      return {
        configured: false,
        provider: "none",
        maxDurationMs: 0,
        maxAudioBytes: 0,
      };
    }
    return manager.getConfiguration();
  });

  ipcMain.handle(
    "stt:transcribe",
    async (
      event,
      request: SttTranscribeRequest,
    ): Promise<SttTranscribeResponse> => {
      const requestId =
        typeof request?.requestId === "string" && request.requestId.trim()
          ? request.requestId.trim()
          : "unknown";

      if (!isEventAuthorized(event, isTrustedSender)) {
        return {
          ok: false,
          requestId,
          code: "INVALID_REQUEST",
          error: "Jendela ini tidak diizinkan mengakses layanan STT.",
        };
      }

      const sender = event.sender;
      const rendererId = sender.id;
      attachRendererLifecycleCleanup(sender);

      abortJobForRenderer(rendererId);

      const controller = new AbortController();
      activeJobs.set(rendererId, { requestId, controller });

      try {
        return await manager.transcribe(request, controller.signal);
      } finally {
        const current = activeJobs.get(rendererId);
        if (current && current.requestId === requestId) {
          activeJobs.delete(rendererId);
        }
      }
    },
  );

  ipcMain.on("stt:cancel", (event, requestId: unknown) => {
    if (!isEventAuthorized(event, isTrustedSender)) return;

    const rendererId = event.sender.id;
    const current = activeJobs.get(rendererId);
    if (!current) return;

    if (typeof requestId !== "string" || current.requestId === requestId.trim()) {
      abortJobForRenderer(rendererId);
    }
  });

  app.once("before-quit", () => {
    for (const rendererId of activeJobs.keys()) {
      abortJobForRenderer(rendererId);
    }
  });
}
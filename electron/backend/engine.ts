import { BrowserWindow, WebContents } from "electron";
import { randomUUID } from "node:crypto";
import { RoutineStep } from "../types";
import { actionRegistry } from "./actions";
import { PreparedAction } from "./actions/definition";
import { ActionError, errorDetails } from "./errors";
import { ensureNativeHelper } from "./native";
import { checkCancelled, wait } from "./runtime";
import { normalizeStep, resolveAction, text } from "./validation";
import { broadcast, safeSend } from "../windows/windowManager";

const STEP_INTERVAL_MS = 1000;

export interface ExecutionResult {
  success: boolean;
  runId: string;
  error?: string;
  code?: string;
  stepIndex?: number;
}
interface PlanStep { step: RoutineStep; execute: PreparedAction; skipReason?: string; }
interface ActiveRun {
  owner: number;
  runId: string;
  controller: AbortController;
  promise: Promise<ExecutionResult>;
}

export class ExecutionEngine {
  private active?: ActiveRun;
  // Idempotent request retries cannot execute destructive blocks twice.
  private readonly completed = new Map<string, ExecutionResult>();

  get isRunning(): boolean { return !!this.active; }

  cancel(owner: number, runId?: string): void {
    if (this.active?.owner === owner && (!runId || this.active.runId === runId)) this.active.controller.abort();
  }

  shutdown(): void { this.active?.controller.abort(); }

  async execute(input: unknown, sender: WebContents, parent?: BrowserWindow): Promise<ExecutionResult> {
    let id: string, runId: string, steps: unknown[];
    try {
      if (!input || typeof input !== "object") throw new ActionError("INVALID_ROUTINE", "Invalid routine request.");
      const payload = input as Record<string, unknown>;
      id = text(payload.id, "Routine ID", 128);
      runId = payload.runId === undefined ? randomUUID() : text(payload.runId, "Run ID", 128);
      if (!Array.isArray(payload.steps) || !payload.steps.length || payload.steps.length > 100) throw new ActionError("INVALID_ROUTINE", "A routine needs between 1 and 100 blocks.");
      steps = payload.steps;
    } catch (error) { return { success: false, runId: "", ...errorDetails(error), stepIndex: -1 }; }

    const key = `${sender.id}:${runId}`;
    const previous = this.completed.get(key);
    if (previous) return previous;
    if (this.active?.owner === sender.id && this.active.runId === runId) return this.active.promise;
    // A React cleanup may cancel just before a fresh request. Wait for that
    // cancelled execution to settle instead of racing two system operations.
    if (this.active?.controller.signal.aborted) await this.active.promise;
    if (this.active) return { success: false, runId, code: "BUSY", error: "Another routine is already running.", stepIndex: -1 };

    const controller = new AbortController();
    const abort = () => controller.abort();
    sender.once("destroyed", abort);
    sender.on("did-start-navigation", abort);
    const promise = Promise.resolve().then(async () => {
      let index = -1;
      try {
        checkCancelled(controller.signal);
        const plan: PlanStep[] = [];
        let requiresNative = false;
        // Validate every block before executing any side effect.
        for (index = 0; index < steps.length; index++) {
          const step = normalizeStep(steps[index]);
          const action = resolveAction(step);
          if (!Object.hasOwn(actionRegistry, action)) throw new ActionError("UNKNOWN_ACTION", `Unknown action: ${action}.`);
          const definition = actionRegistry[action];
          requiresNative ||= !!definition.native && !definition.skipReason;
          plan.push({ step, execute: definition.prepare(step), skipReason: definition.skipReason });
        }
        index = -1;
        if (requiresNative) await ensureNativeHelper();
        checkCancelled(controller.signal);
        for (index = 0; index < plan.length; index++) {
          const item = plan[index];
          checkCancelled(controller.signal);
          if (item.skipReason) {
            this.progress(sender, id, runId, index, item.step.title, "skipped", undefined, item.skipReason);
            continue;
          }
          this.progress(sender, id, runId, index, item.step.title, "running");
          if (item.step.delayMs) await wait(item.step.delayMs, controller.signal);
          await item.execute({ signal: controller.signal, parent });
          checkCancelled(controller.signal);
          this.progress(sender, id, runId, index, item.step.title, "completed");
          if (index < plan.length - 1) {
            await wait(STEP_INTERVAL_MS, controller.signal);
          }
        }
        broadcast("routine:finished", { routineId: id, runId, success: true });
        return { success: true, runId };
      } catch (error) {
        const details = controller.signal.aborted
          ? { error: "Routine cancelled.", code: "CANCELLED" } : errorDetails(error);
        if (index >= 0 && index < steps.length) {
          const title = (steps[index] as Partial<RoutineStep>)?.title || "";
          this.progress(sender, id, runId, index, title, "failed", details.error);
        }
        broadcast("routine:finished", { routineId: id, runId, success: false, ...details });
        return { success: false, runId, ...details, stepIndex: index };
      } finally {
        sender.removeListener("destroyed", abort);
        sender.removeListener("did-start-navigation", abort);
        if (this.active?.runId === runId) this.active = undefined;
      }
    });
    this.active = { owner: sender.id, runId, controller, promise };
    const result = await promise;
    this.completed.set(key, result);
    if (this.completed.size > 32) this.completed.delete(this.completed.keys().next().value!);
    return result;
  }

  private progress(sender: WebContents, routineId: string, runId: string, stepIndex: number, stepTitle: string,
    status: "running" | "completed" | "failed" | "skipped", error?: string, note?: string): void {
    if (!sender.isDestroyed()) safeSend(BrowserWindow.fromWebContents(sender), "routine:step-progress", {
      routineId, runId, stepIndex, stepTitle, status, error, note,
    });
  }
}

export const executionEngine = new ExecutionEngine();

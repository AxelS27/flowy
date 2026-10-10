import { ProviderError, routeWithGemini } from "./providers/gemini";
import { AiConfigurationStatus, RouteDecision, RouteErrorCode, RouteRequest, RouteResult, RoutineMetadata } from "./types";

const MAX_TEXT_LENGTH = 2_000;
const MAX_ROUTINES = 100;
const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 500;
const TIMEOUT_MS = 15_000;
const DEFAULT_MODEL = "gemini-3.8-flash";

function boundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function validateRequest(input: unknown): RouteRequest | null {
  if (!input || typeof input !== "object") return null;
  const request = input as RouteRequest;
  if (!boundedString(request.requestId, MAX_ID_LENGTH) || typeof request.text !== "string") return null;
  const text = request.text.trim();
  if (!boundedString(text, MAX_TEXT_LENGTH)) return null;
  if (!Array.isArray(request.routines) || request.routines.length < 1 || request.routines.length > MAX_ROUTINES) return null;

  const ids = new Set<string>();
  for (const routine of request.routines) {
    if (!routine || !boundedString(routine.id, MAX_ID_LENGTH) || !boundedString(routine.name, MAX_NAME_LENGTH)) return null;
    if (routine.description !== undefined && (typeof routine.description !== "string" || routine.description.length > MAX_DESCRIPTION_LENGTH)) return null;
    if (routine.category !== undefined && (typeof routine.category !== "string" || routine.category.length > 50)) return null;
    if (ids.has(routine.id)) return null;
    ids.add(routine.id);
  }
  return { ...request, text };
}

function validateDecision(value: unknown, routines: RoutineMetadata[]): RouteDecision | null {
  if (!value || typeof value !== "object") return null;
  const output = value as { status?: unknown; routineId?: unknown; candidateIds?: unknown };
  const allowed = new Set(routines.map((routine) => routine.id));
  if (output.status === "no_match") return { status: "no_match" };
  if (output.status === "match" && typeof output.routineId === "string" && allowed.has(output.routineId)) {
    return { status: "match", routineId: output.routineId };
  }
  if (output.status === "ambiguous" && Array.isArray(output.candidateIds)) {
    const candidates = output.candidateIds;
    if (candidates.length < 2 || candidates.length > Math.min(5, routines.length)) return null;
    if (!candidates.every((id) => typeof id === "string" && allowed.has(id))) return null;
    if (new Set(candidates).size !== candidates.length) return null;
    return { status: "ambiguous", candidateIds: candidates as string[] };
  }
  return null;
}

export function getAiConfigurationStatus(): AiConfigurationStatus {
  return {
    configured: Boolean(process.env.FLOWY_GEMINI_API_KEY?.trim()),
    provider: "gemini",
    model: process.env.FLOWY_GEMINI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export async function routeIntent(input: unknown, externalSignal: AbortSignal): Promise<RouteResult> {
  const requestId = input && typeof input === "object" && typeof (input as { requestId?: unknown }).requestId === "string"
    ? (input as { requestId: string }).requestId.slice(0, MAX_ID_LENGTH)
    : "invalid";
  const request = validateRequest(input);
  if (!request) return { ok: false, requestId, code: "INVALID_REQUEST", error: "The routing request is invalid or too large." };

  const apiKey = process.env.FLOWY_GEMINI_API_KEY?.trim();
  const model = process.env.FLOWY_GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (!apiKey) return { ok: false, requestId, code: "NOT_CONFIGURED", error: "AI routing is not configured. Add FLOWY_GEMINI_API_KEY before starting Flowy." };

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const abort = () => timeout.abort();
  externalSignal.addEventListener("abort", abort, { once: true });

  try {
    const raw = await routeWithGemini(apiKey, model, request.text, request.routines, timeout.signal);
    const decision = validateDecision(raw, request.routines);
    if (!decision) return { ok: false, requestId, code: "INVALID_RESPONSE", error: "The AI selected an invalid workspace." };
    return { ok: true, requestId, decision };
  } catch (error) {
    let code: RouteErrorCode = "PROVIDER_ERROR";
    let message = "The AI provider could not route this request.";
    if (externalSignal.aborted) { code = "CANCELLED"; message = "Routing was cancelled."; }
    else if (timeout.signal.aborted) { code = "TIMEOUT"; message = "The AI provider took too long to respond."; }
    else if (error instanceof ProviderError) { code = error.code; message = error.message; }
    return { ok: false, requestId, code, error: message };
  } finally {
    clearTimeout(timer);
    externalSignal.removeEventListener("abort", abort);
  }
}

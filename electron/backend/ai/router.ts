import { ProviderError, routeWithGemini } from "./providers/gemini";
import { routeWithGroq } from "./providers/groq";
import { AiConfigurationStatus, RouteDecision, RouteErrorCode, RouteRequest, RouteResult, RoutineMetadata } from "./types";

const MAX_TEXT_LENGTH = 2_000;
const MAX_ROUTINES = 100;
const MAX_ID_LENGTH = 128;
const MAX_NAME_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 500;
const TIMEOUT_MS = 5_000;
const DEFAULT_MODEL = "gemini-2.5-flash";

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
    if (routine.stepTitles !== undefined) {
      if (!Array.isArray(routine.stepTitles) || routine.stepTitles.length > 20) return null;
      if (!routine.stepTitles.every((t) => typeof t === "string" && t.length <= 120)) return null;
    }
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
  const hasGemini = Boolean(process.env.FLOWY_GEMINI_API_KEY?.trim());
  const hasGroq = Boolean(process.env.FLOWY_GROQ_API_KEY?.trim());
  return {
    configured: hasGemini || hasGroq,
    provider: hasGemini ? "gemini" : "groq",
    model: process.env.FLOWY_GEMINI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryFastNameMatch(text: string, routines: RoutineMetadata[]): RouteDecision | null {
  const normalized = text.toLowerCase();
  if (/\b(bukan|jangan|gak jadi|enggak jadi|nggak jadi|not|eh salah|ganti)\b/i.test(normalized)) {
    return null;
  }

  const hits = routines.filter((routine) => {
    const name = routine.name.trim().toLowerCase();
    if (name.length < 2) return false;
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(name)}([^a-z0-9]|$)`, "i").test(normalized);
  });
  if (hits.length >= 2) {
    return { status: "ambiguous", candidateIds: hits.slice(0, 5).map((r) => r.id) };
  }
  if (hits.length === 1) {
    const hitName = hits[0].name.trim().toLowerCase();
    const similar = routines.filter((other) => {
      if (other.id === hits[0].id) return false;
      const otherName = other.name.trim().toLowerCase();
      return otherName.includes(hitName) || hitName.includes(otherName);
    });
    if (similar.length > 0) {
      if (/\b(biasa|pertama|1)\b/i.test(normalized)) {
        return { status: "match", routineId: hits[0].id };
      }
      if (!/\b\d+\b/.test(normalized)) {
        return { status: "ambiguous", candidateIds: [hits[0], ...similar].slice(0, 5).map((r) => r.id) };
      }
      return null;
    }
    return { status: "match", routineId: hits[0].id };
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const temp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = temp;
    }
  }
  return dp[m];
}

function tryFuzzyFallback(text: string, routines: RoutineMetadata[]): RouteDecision | null {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  if (!words.length) return null;

  const hits = routines.filter((routine) => {
    const cleanName = routine.name.trim().toLowerCase();
    const baseName = cleanName.replace(/\d+$/, "");
    return words.some((word) => {
      if (cleanName.includes(word) || word.includes(baseName)) return true;
      const dist = levenshtein(word, baseName);
      return baseName.length >= 4 && dist <= Math.max(1, Math.floor(baseName.length / 4));
    });
  });

  if (hits.length === 1) return { status: "match", routineId: hits[0].id };
  if (hits.length >= 2) return { status: "ambiguous", candidateIds: hits.slice(0, 5).map((r) => r.id) };
  return null;
}

export async function routeIntent(input: unknown, externalSignal: AbortSignal): Promise<RouteResult> {
  const requestId = input && typeof input === "object" && typeof (input as { requestId?: unknown }).requestId === "string"
    ? (input as { requestId: string }).requestId.slice(0, MAX_ID_LENGTH)
    : "invalid";
  const request = validateRequest(input);
  if (!request) return { ok: false, requestId, code: "INVALID_REQUEST", error: "The routing request is invalid or too large." };

  const fastMatch = tryFastNameMatch(request.text, request.routines);
  if (fastMatch) {
    console.log(`[AI Route] fast-match routineId=${(fastMatch as { routineId: string }).routineId}`);
    return { ok: true, requestId, decision: fastMatch };
  }

  const apiKey = process.env.FLOWY_GEMINI_API_KEY?.trim();
  const groqKey = process.env.FLOWY_GROQ_API_KEY?.trim();
  const model = process.env.FLOWY_GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  if (!apiKey && !groqKey) {
    return { ok: false, requestId, code: "NOT_CONFIGURED", error: "AI routing is not configured. Add FLOWY_GEMINI_API_KEY before starting Flowy." };
  }

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const abort = () => timeout.abort();
  externalSignal.addEventListener("abort", abort, { once: true });

  const abortPromise = new Promise<never>((_resolve, reject) => {
    if (timeout.signal.aborted) {
      reject(new Error("Aborted"));
      return;
    }
    timeout.signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
  });

  try {
    if (apiKey) {
      console.log(`[AI Route] start model=${model} textLen=${request.text.length} routines=${request.routines.length}`);
      const raw = await Promise.race([
        routeWithGemini(apiKey, model, request.text, request.routines, timeout.signal),
        abortPromise,
      ]);
      const decision = validateDecision(raw, request.routines);
      if (!decision) return { ok: false, requestId, code: "INVALID_RESPONSE", error: "The AI selected an invalid workspace." };
      return { ok: true, requestId, decision };
    }
    throw new ProviderError("OFFLINE", "Gemini key not configured.");
  } catch (error) {
    if (externalSignal.aborted) {
      return { ok: false, requestId, code: "CANCELLED", error: "Routing was cancelled." };
    }

    if (groqKey) {
      try {
        console.log("[AI Route] falling back to Groq LLM");
        const groqController = new AbortController();
        const groqTimer = setTimeout(() => groqController.abort(), TIMEOUT_MS);
        const onExtAbort = () => groqController.abort();
        externalSignal.addEventListener("abort", onExtAbort, { once: true });
        try {
          const groqRaw = await routeWithGroq(groqKey, request.text, request.routines, groqController.signal);
          const groqDecision = validateDecision(groqRaw, request.routines);
          if (groqDecision) {
            return { ok: true, requestId, decision: groqDecision };
          }
        } finally {
          clearTimeout(groqTimer);
          externalSignal.removeEventListener("abort", onExtAbort);
        }
      } catch (groqErr) {
        console.error("[AI Route] Groq fallback failed:", groqErr);
      }
    }

    const fallback = tryFuzzyFallback(request.text, request.routines);
    if (fallback) {
      console.log("[AI Route] using local fuzzy fallback after provider error");
      return { ok: true, requestId, decision: fallback };
    }

    let code: RouteErrorCode = "PROVIDER_ERROR";
    let message = "The AI provider could not route this request.";
    if (timeout.signal.aborted) { code = "TIMEOUT"; message = "The AI provider took too long to respond."; }
    else if (error instanceof ProviderError) { code = error.code; message = error.message; }
    return { ok: false, requestId, code, error: message };
  } finally {
    clearTimeout(timer);
    externalSignal.removeEventListener("abort", abort);
  }
}

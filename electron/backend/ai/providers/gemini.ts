import { RouteDecision, RoutineMetadata } from "../types";
import { buildRoutingInstruction } from "../prompt";
import { GoogleGenAI } from "@google/genai";

export class ProviderError extends Error {
  constructor(
    public readonly code: "AUTHENTICATION" | "RATE_LIMITED" | "OFFLINE" | "INVALID_RESPONSE" | "PROVIDER_ERROR",
    message: string,
  ) {
    super(message);
  }
}

function extractText(value: unknown): string {
  const body = value as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new ProviderError("INVALID_RESPONSE", "The AI provider returned an empty response.");
  }
  return text;
}

export async function routeWithGemini(
  apiKey: string,
  model: string,
  text: string,
  routines: RoutineMetadata[],
  signal: AbortSignal,
): Promise<unknown> {
  const instruction = buildRoutingInstruction();

  const ai = new GoogleGenAI({ apiKey });
  const startedAt = Date.now();

  const content = JSON.stringify({ request: text, availableRoutines: routines });
    const response = await ai.models.generateContent({
      model: model,
      contents: content,
      config: {
        abortSignal: signal,
        systemInstruction: instruction,
        temperature: 0,
        maxOutputTokens: 1024,
        ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            status: { type: "STRING", enum: ["match", "ambiguous", "no_match"] },
            routineId: { type: "STRING" },
            candidateIds: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["status"],
        },
      },
    }).catch((error: { status?: number; message?: string }) => {
      if (signal?.aborted) throw error;
      console.error("[Gemini AI Error]", error?.status ?? "", error?.message ?? error);
      const status = error?.status;
      if (status === 401 || status === 403) {
        throw new ProviderError("AUTHENTICATION", "Gemini API key is invalid or unauthorized.");
      }
      if (status === 429) {
        throw new ProviderError("RATE_LIMITED", "Gemini rate limit reached. Please wait a moment and try again.");
      }
      if (status && status >= 500) {
        throw new ProviderError(
          "PROVIDER_ERROR",
          `Gemini service is temporarily busy (HTTP ${status}). Try again or switch FLOWY_GEMINI_MODEL.`,
        );
      }
      throw new ProviderError("OFFLINE", "Could not connect to the AI provider.");
    })

  try {
    console.log(`[AI Route] ${model} responded in ${Date.now() - startedAt}ms`);
    const raw = response.text;
    if (raw == undefined) {
      console.error("[Gemini Invalid Output] empty response.text", JSON.stringify(response));
      throw new ProviderError("INVALID_RESPONSE", "The AI provider returned invalid structured output.");
    }
    return JSON.parse(raw) as RouteDecision;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    console.error("[Gemini Invalid Output] JSON.parse failed:", response.text);
    throw new ProviderError("INVALID_RESPONSE", "The AI provider returned invalid structured output.");
  }
}

import { RoutineMetadata } from "../types";
import { buildRoutingInstruction } from "../prompt";

const GROQ_CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_ROUTER_MODEL = "openai/gpt-oss-120b";

export async function routeWithGroq(
  apiKey: string,
  text: string,
  routines: RoutineMetadata[],
  signal: AbortSignal,
  model: string = DEFAULT_GROQ_ROUTER_MODEL,
): Promise<unknown> {
  const instruction = [
    buildRoutingInstruction(),
    'Return valid JSON matching one of: {"status":"match","routineId":"..."}, {"status":"ambiguous","candidateIds":["...","..."]}, or {"status":"no_match"}.',
  ].join(" ");

  const startedAt = Date.now();
  const response = await fetch(GROQ_CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_completion_tokens: 1024,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instruction },
        {
          role: "user",
          content: JSON.stringify({ request: text, availableRoutines: routines }),
        },
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Groq AI router HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = body?.choices?.[0]?.message?.content;
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Groq AI router returned empty content.");
  }

  console.log(`[AI Route] Groq ${model} responded in ${Date.now() - startedAt}ms`);
  return JSON.parse(raw);
}

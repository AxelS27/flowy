import { SttErrorCode } from "../types";
// import process from "node:process";

export interface SttProviderInput {
  audioBase64: string;
  mimeType: string;
  language?: string;
  signal: AbortSignal;
}

export interface SttProvider {
  readonly name: string;
  isConfigured(): boolean;
  transcribe(input: SttProviderInput): Promise<string>;
}

export class SttProviderError extends Error {
  constructor(
    public readonly code: SttErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SttProviderError";
  }
}

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Note: Iyes process nya ngasih error di VSCode
 * Tapi pas aku cek npm run typecheck, aman aja
 * Aku coba: import process from "node:process";
 * Errornya pindah ke atas
 */

function getGeminiConfig(): { apiKey: string; model: string } {
  const apiKey = (process.env.FLOWY_GEMINI_API_KEY ?? "").trim();
  const model =
    (process.env.FLOWY_GEMINI_MODEL ?? "").trim() || DEFAULT_GEMINI_MODEL;
  return { apiKey, model };
}

/**
 * Kenapa Normalize?
 * Gemini inlineData hanya menerima MIME type dasar (misal "audio/webm", bukan "audio/webm;codecs=opus")
 */
function normalizeMimeTypeForGemini(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

function mapHttpStatusToError(status: number): SttProviderError {
  if (status === 401 || status === 403) {
    return new SttProviderError(
      "AUTHENTICATION",
      "API key Gemini ditolak atau tidak memiliki akses.",
    );
  }
  if (status === 429) {
    return new SttProviderError(
      "RATE_LIMITED",
      "Kuota permintaan STT sedang penuh. Coba beberapa saat lagi.",
    );
  }
  if (status === 400) {
    return new SttProviderError(
      "INVALID_REQUEST",
      "Format audio tidak didukung oleh layanan transkripsi.",
    );
  }
  return new SttProviderError(
    "PROVIDER_ERROR",
    `Layanan transkripsi mengalami gangguan (HTTP ${status}).`,
  );
}

export class GeminiSttProvider implements SttProvider {
  public readonly name = "gemini";

  public isConfigured(): boolean {
    return getGeminiConfig().apiKey.length > 0;
  }

  public async transcribe(input: SttProviderInput): Promise<string> {
    const { apiKey, model } = getGeminiConfig();
    if (!apiKey) {
      throw new SttProviderError(
        "NOT_CONFIGURED",
        "STT belum dikonfigurasi. Atur FLOWY_GEMINI_API_KEY terlebih dahulu.",
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent`;

    const languageHint = input.language
      ? `Primary spoken language hint: ${input.language}.`
      : "The user typically speaks Indonesian or English.";

    const body = {
      systemInstruction: {
        parts: [
          {
            text: [
              "You are a strict speech-to-text transcriber for a desktop command launcher.",
              "Transcribe the spoken words in the audio accurately into plain text.",
              languageHint,
              "Rules: Output ONLY the exact transcribed text. Do not translate, summarize, answer commands, or add timestamps/markdown. If there is no intelligible speech or only silence/noise, output an empty string.",
            ].join(" "),
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: normalizeMimeTypeForGemini(input.mimeType),
                data: input.audioBase64,
              },
            },
            {
              text: "Transcribe this audio.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 512,
      },
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: input.signal,
      });
    } catch (err) {
      if (input.signal.aborted) {
        throw new SttProviderError("CANCELLED", "Transkripsi dibatalkan.");
      }
      throw new SttProviderError(
        "OFFLINE",
        "Tidak dapat terhubung ke server transkripsi. Periksa koneksi internet.",
      );
    }

    if (!response.ok) {
      throw mapHttpStatusToError(response.status);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new SttProviderError(
        "INVALID_RESPONSE",
        "Respons dari layanan transkripsi tidak valid.",
      );
    }

    const transcript = this.extractTextFromResponse(data);
    return transcript;
  }

  private extractTextFromResponse(data: unknown): string {
    if (!data || typeof data !== "object") {
      throw new SttProviderError(
        "INVALID_RESPONSE",
        "Struktur respons transkripsi tidak dikenali.",
      );
    }

    const candidates = (data as { candidates?: unknown }).candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return "";
    }

    const firstCandidate = candidates[0] as {
      content?: { parts?: Array<{ text?: unknown }> };
    };
    const parts = firstCandidate?.content?.parts;
    if (!Array.isArray(parts)) {
      return "";
    }

    const combined = parts
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();

    return combined;
  }
}
import { SttErrorCode, SttProvider, SttProviderInput } from "../types";

export class SttProviderError extends Error {
  constructor(
    public readonly code: SttErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SttProviderError";
  }
}

const GROQ_TRANSCRIPTION_ENDPOINT =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

function readEnv(key: string): string {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  return (proc?.env?.[key] ?? "").trim();
}

function getGroqWhisperConfig(): { apiKey: string; model: string } {
  const apiKey =
    readEnv("FLOWY_GROQ_API_KEY") || readEnv("FLOWY_WHISPER_API_KEY");
  const model =
    readEnv("FLOWY_GROQ_WHISPER_MODEL") || DEFAULT_GROQ_WHISPER_MODEL;

  return { apiKey, model };
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Groq Whisper menerima kode bahasa ISO-639-1 (2 huruf, misal "id" atau "en").
 * Jika tidak diisi, Whisper otomatis mendeteksi Bahasa Indonesia maupun Inggris.
 */
function normalizeLanguageCode(language?: string): string | undefined {
  if (!language) return undefined;
  const code = language.split(/[-_]/)[0]?.trim().toLowerCase();
  return code && code.length === 2 ? code : undefined;
}

function mapHttpStatusToError(status: number, apiMessage: string): SttProviderError {
  if (status === 401 || status === 403) {
    return new SttProviderError(
      "AUTHENTICATION",
      "API key Groq tidak valid atau ditolak. Periksa FLOWY_GROQ_API_KEY.",
    );
  }
  if (status === 429) {
    return new SttProviderError(
      "RATE_LIMITED",
      "Kuota permintaan Groq Whisper sedang penuh. Coba beberapa saat lagi.",
    );
  }
  if (status === 400) {
    if (/too short/i.test(apiMessage)) {
      return new SttProviderError(
        "INVALID_REQUEST",
        "Rekaman terlalu singkat. Coba bicara minimal 1 detik.",
      );
    }
    return new SttProviderError(
      "INVALID_REQUEST",
      "Format atau isi audio ditolak oleh Groq Whisper.",
    );
  }
  return new SttProviderError(
    "PROVIDER_ERROR",
    `Layanan transkripsi Groq mengalami gangguan (HTTP ${status}).`,
  );
}

export class GroqWhisperProvider implements SttProvider {
  public readonly name = "groq-whisper";

  public isConfigured(): boolean {
    return getGroqWhisperConfig().apiKey.length > 0;
  }

  public async transcribe(input: SttProviderInput): Promise<string> {
    const { apiKey, model } = getGroqWhisperConfig();
    if (!apiKey) {
      throw new SttProviderError(
        "NOT_CONFIGURED",
        "STT belum dikonfigurasi. Atur FLOWY_GROQ_API_KEY sebelum menjalankan aplikasi.",
      );
    }

    const audioBytes = base64ToUint8Array(input.audioBase64);
    const audioBlob = new Blob([audioBytes], { type: "audio/wav" });

    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");
    formData.append("model", model);
    formData.append("response_format", "json");
    formData.append("temperature", "0");

    const lang = normalizeLanguageCode(input.language);
    if (lang) {
      formData.append("language", lang);
    }

    let response: Response;
    try {
      response = await fetch(GROQ_TRANSCRIPTION_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
        signal: input.signal,
      });
    } catch {
      if (input.signal.aborted) {
        throw new SttProviderError("CANCELLED", "Transkripsi dibatalkan.");
      }
      throw new SttProviderError(
        "OFFLINE",
        "Tidak dapat terhubung ke server Groq. Periksa koneksi internet.",
      );
    }

    if (!response.ok) {
      let apiMessage = "";
      try {
        const errJson = (await response.json()) as {
          error?: { message?: string };
        };
        apiMessage = errJson?.error?.message ?? "";
      } catch {
        // Abaikan jika body error bukan JSON
      }

      console.error("[STT Groq Error]", {
        httpStatus: response.status,
        model,
        audioBytes: audioBytes.byteLength,
        message: apiMessage,
      });

      throw mapHttpStatusToError(response.status, apiMessage);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new SttProviderError(
        "INVALID_RESPONSE",
        "Respons dari server Groq tidak valid.",
      );
    }

    if (!data || typeof (data as { text?: unknown }).text !== "string") {
      throw new SttProviderError(
        "INVALID_RESPONSE",
        "Format teks transkripsi Groq tidak dikenali.",
      );
    }

    return (data as { text: string }).text.trim();
  }
}
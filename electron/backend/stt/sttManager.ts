import {
  STT_ALLOWED_MIME_TYPES,
  STT_LIMITS,
  SttAllowedMimeType,
  SttConfiguration,
  SttTranscribeRequest,
  SttTranscribeResponse,
} from "./types";
import {
  GeminiSttProvider,
  SttProvider,
  SttProviderError,
} from "./providers/geminiStt";

function isAllowedMimeType(value: string): value is SttAllowedMimeType {
  const normalized = value.trim().toLowerCase();
  return (STT_ALLOWED_MIME_TYPES as readonly string[]).includes(normalized);
}

function estimateDecodedByteLength(base64: string): number {
  const clean = base64.replace(/\s+/g, "");
  if (!clean) return 0;
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - padding;
}

export class SttManager {
  private readonly provider: SttProvider;

  constructor(provider: SttProvider = new GeminiSttProvider()) {
    this.provider = provider;
  }

  public getConfiguration(): SttConfiguration {
    return {
      configured: this.provider.isConfigured(),
      provider: this.provider.name,
      maxDurationMs: STT_LIMITS.MAX_DURATION_MS,
      maxAudioBytes: STT_LIMITS.MAX_AUDIO_BYTES,
    };
  }

  public async transcribe(
    rawRequest: SttTranscribeRequest,
    externalSignal?: AbortSignal,
  ): Promise<SttTranscribeResponse> {
    const requestId =
      typeof rawRequest?.requestId === "string" && rawRequest.requestId.trim()
        ? rawRequest.requestId.trim()
        : "unknown";

    if (!this.provider.isConfigured()) {
      return {
        ok: false,
        requestId,
        code: "NOT_CONFIGURED",
        error:
          "Fitur suara belum aktif. Atur FLOWY_GEMINI_API_KEY sebelum menjalankan aplikasi.",
      };
    }

    // 1. Validasi bentuk request
    if (
      !rawRequest ||
      typeof rawRequest.audioBase64 !== "string" ||
      typeof rawRequest.mimeType !== "string"
    ) {
      return {
        ok: false,
        requestId,
        code: "INVALID_REQUEST",
        error: "Data audio tidak lengkap atau tidak valid.",
      };
    }

    const mimeType = rawRequest.mimeType.trim().toLowerCase();
    if (!isAllowedMimeType(mimeType)) {
      return {
        ok: false,
        requestId,
        code: "INVALID_REQUEST",
        error: `Format audio '${rawRequest.mimeType}' tidak diizinkan.`,
      };
    }

    // 2. Validasi ukuran audio (maksimal 5 MiB)
    const cleanBase64 = rawRequest.audioBase64.replace(/\s+/g, "");
    const byteLength = estimateDecodedByteLength(cleanBase64);
    if (byteLength <= 0) {
      return {
        ok: false,
        requestId,
        code: "INVALID_REQUEST",
        error: "Rekaman audio kosong.",
      };
    }
    if (byteLength > STT_LIMITS.MAX_AUDIO_BYTES) {
      return {
        ok: false,
        requestId,
        code: "INVALID_REQUEST",
        error: "Ukuran rekaman melebihi batas maksimal 5 MB.",
      };
    }

    // 3. Gabungkan AbortSignal dari IPC (cancel manual) dengan Timeout 15 detik
    const timeoutController = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, STT_LIMITS.PROVIDER_TIMEOUT_MS);

    const onExternalAbort = () => timeoutController.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        return {
          ok: false,
          requestId,
          code: "CANCELLED",
          error: "Permintaan transkripsi dibatalkan.",
        };
      }
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }

    try {
      const rawText = await this.provider.transcribe({
        audioBase64: cleanBase64,
        mimeType,
        language:
          typeof rawRequest.language === "string"
            ? rawRequest.language.trim().slice(0, 16)
            : undefined,
        signal: timeoutController.signal,
      });

      const normalizedText = rawText
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, STT_LIMITS.MAX_TRANSCRIPT_CHARS);

      return {
        ok: true,
        requestId,
        text: normalizedText,
      };
    } catch (err) {
      if (timedOut) {
        return {
          ok: false,
          requestId,
          code: "TIMEOUT",
          error: "Waktu transkripsi habis (lebih dari 15 detik). Coba lagi.",
        };
      }

      if (externalSignal?.aborted) {
        return {
          ok: false,
          requestId,
          code: "CANCELLED",
          error: "Permintaan transkripsi dibatalkan.",
        };
      }

      if (err instanceof SttProviderError) {
        return {
          ok: false,
          requestId,
          code: err.code,
          error: err.message,
        };
      }

      return {
        ok: false,
        requestId,
        code: "PROVIDER_ERROR",
        error: "Terjadi kesalahan saat memproses suara.",
      };
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }
  }
}
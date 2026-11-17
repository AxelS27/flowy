export const STT_LIMITS = {
  MAX_AUDIO_BYTES: 5 * 1024 * 1024,
  MAX_DURATION_MS: 30_000,
  PROVIDER_TIMEOUT_MS: 15_000,
  MAX_TRANSCRIPT_CHARS: 2_000,
} as const;

export const STT_ALLOWED_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/wav",
  "audio/mp4",
] as const;

export type SttAllowedMimeType = (typeof STT_ALLOWED_MIME_TYPES)[number];

export type SttErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_REQUEST"
  | "AUTHENTICATION"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "OFFLINE"
  | "INVALID_RESPONSE"
  | "CANCELLED"
  | "PROVIDER_ERROR";

export interface SttConfiguration {
  configured: boolean;
  provider: string;
  maxDurationMs: number;
  maxAudioBytes: number;
}

export interface SttTranscribeRequest {
  requestId: string;
  audioBase64: string;
  mimeType: string;
  language?: string;
}

export type SttTranscribeResponse =
  | {
      ok: true;
      requestId: string;
      text: string;
    }
  | {
      ok: false;
      requestId: string;
      code: SttErrorCode;
      error: string;
    };

export interface SttElectronAPI {
  getSttConfiguration: () => Promise<SttConfiguration>;
  transcribeSpeech: (request: SttTranscribeRequest) => Promise<SttTranscribeResponse>;
  cancelSpeechTranscribe: (requestId: string) => void;
}

export type SttUiStatus =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "transcribing"
  | "error";
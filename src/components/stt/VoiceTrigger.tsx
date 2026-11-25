import React, { useEffect, useState } from "react";
import { useSpeechToText } from "./useSpeechToText";

export interface VoiceTriggerProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  language?: string;
  className?: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export const VoiceTrigger: React.FC<VoiceTriggerProps> = ({
  onTranscript,
  disabled = false,
  language,
  className = "",
}) => {
  const {
    status,
    error,
    isSupported,
    isConfigured,
    startRecording,
    stopAndTranscribe,
    cancel,
    clearError,
  } = useSpeechToText({
    language,
    onTranscript,
  });

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (status !== "recording") {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const isBusy =
    status === "requesting-permission" || status === "transcribing";
  const isRecording = status === "recording";
  const isUnavailable = !isSupported || !isConfigured;
  const isButtonDisabled =
    disabled || status === "requesting-permission" || status === "transcribing" || isUnavailable;

  const getTooltipText = (): string => {
    if (!isSupported) {
      return "Input suara hanya tersedia di aplikasi desktop Electron";
    }
    if (!isConfigured) {
      return "Fitur suara belum aktif (FLOWY_GROQ_API_KEY belum diatur)";
    }
    if (status === "requesting-permission") {
      return "Meminta izin mikrofon...";
    }
    if (isRecording) {
      return "Klik untuk berhenti merekam dan transkripsikan";
    }
    if (status === "transcribing") {
      return "Mengubah suara menjadi teks...";
    }
    return "Perintah suara (Speech to Text)";
  };

  const handlePrimaryClick = () => {
    if (error) {
      clearError();
    }
    if (isRecording) {
      void stopAndTranscribe();
    } else {
      void startRecording();
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      {/* Tombol Mikrofon / Stop */}
      <button
        type="button"
        onClick={handlePrimaryClick}
        disabled={isButtonDisabled}
        title={getTooltipText()}
        aria-label={getTooltipText()}
        aria-pressed={isRecording}
        className={[
          "inline-flex h-[46px] items-center justify-center gap-1.5 rounded-2xl border-2 px-3.5 text-sm font-extrabold transition-all focus:outline-none focus:ring-2 focus:ring-grape/40",
          isRecording
            ? "border-red-600 bg-red-600 text-white shadow-sm hover:bg-red-700 animate-pulse"
            : isBusy
              ? "border-cream-border bg-cream text-ink-muted cursor-wait"
              : isUnavailable
                ? "border-cream-border bg-cream text-ink-muted cursor-not-allowed opacity-50"
                : "border-cream-border bg-cream text-ink hover:border-grape hover:bg-grape-light active:scale-95",
        ].join(" ")}
      >
        {status === "transcribing" || status === "requesting-permission" ? (
          <>
            {/* Ikon Spinner */}
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="text-xs">
              {status === "requesting-permission" ? "Izin..." : "Memproses..."}
            </span>
          </>
        ) : isRecording ? (
          <>
            {/* Ikon Stop Square */}
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <span className="text-xs font-mono tabular-nums">
              {formatDuration(elapsedSeconds)}
            </span>
          </>
        ) : (
          /* Ikon Mikrofon */
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </button>

      {/* Tombol Batal */}
      {(isRecording || status === "transcribing") && (
        <button
          type="button"
          onClick={cancel}
          title="Batalkan input suara"
          aria-label="Batalkan input suara"
          className="inline-flex h-[46px] items-center justify-center rounded-2xl border-2 border-cream-border bg-white px-3 text-xs font-extrabold text-ink-muted transition hover:bg-cream hover:text-ink"
        >
          Cancel
        </button>
      )}

      {/* Popover Error */}
      {status === "error" && error && (
        <div
          role="alert"
          aria-live="polite"
          className="absolute bottom-full right-0 z-30 mb-2 flex w-64 items-start justify-between gap-2 rounded-2xl border-2 border-red-200 bg-strawberry-light px-3 py-2 text-xs font-semibold text-red-900 shadow-lg"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            aria-label="Tutup pesan error"
            className="shrink-0 font-black text-red-700 hover:text-red-950"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
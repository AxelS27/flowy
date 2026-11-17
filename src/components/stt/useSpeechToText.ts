import { useCallback, useEffect, useRef, useState } from "react";
import { STT_LIMITS, SttElectronAPI, SttUiStatus } from "../../types/stt";
import { AudioRecorder } from "./AudioRecorder";

export interface UseSpeechToTextOptions {
  language?: string;
  onTranscript?: (text: string) => void;
}

export interface UseSpeechToTextResult {
  status: SttUiStatus;
  error: string | null;
  isSupported: boolean;
  isConfigured: boolean;
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<void>;
  cancel: () => void;
  clearError: () => void;
}

function getSttApi(): Partial<SttElectronAPI> | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { electronAPI?: Partial<SttElectronAPI> }).electronAPI;
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `stt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useSpeechToText(
  options: UseSpeechToTextOptions = {},
): UseSpeechToTextResult {
  const { language, onTranscript } = options;

  const [status, setStatus] = useState<SttUiStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [maxDurationMs, setMaxDurationMs] = useState<number>(STT_LIMITS.MAX_DURATION_MS);

  const recorderRef = useRef<AudioRecorder | null>(null);
  const statusRef = useRef<SttUiStatus>("idle");
  const activeRequestIdRef = useRef<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const updateStatus = useCallback((next: SttUiStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const api = getSttApi();
  const isSupported = Boolean(
    typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof api?.transcribeSpeech === "function",
  );

  useEffect(() => {
    let cancelled = false;
    const sttApi = getSttApi();
    if (!sttApi?.getSttConfiguration) {
      setIsConfigured(false);
      return;
    }

    sttApi
      .getSttConfiguration()
      .then((config) => {
        if (cancelled) return;
        setIsConfigured(Boolean(config.configured));
        if (config.maxDurationMs > 0) {
          setMaxDurationMs(config.maxDurationMs);
        }
      })
      .catch(() => {
        if (!cancelled) setIsConfigured(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    if (statusRef.current !== "recording" || !recorderRef.current) {
      return;
    }

    const sttApi = getSttApi();
    if (!sttApi?.transcribeSpeech) {
      recorderRef.current.cancel();
      setError("Input suara hanya tersedia di aplikasi desktop Electron.");
      updateStatus("error");
      return;
    }

    updateStatus("transcribing");
    setError(null);

    const requestId = generateRequestId();
    activeRequestIdRef.current = requestId;

    try {
      const recorded = await recorderRef.current.stop();

      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      const response = await sttApi.transcribeSpeech({
        requestId,
        audioBase64: recorded.audioBase64,
        mimeType: recorded.mimeType,
        language,
      });

      if (activeRequestIdRef.current !== requestId) {
        return;
      }

      activeRequestIdRef.current = null;

      if (!response.ok) {
        if (response.code === "CANCELLED") {
          updateStatus("idle");
          return;
        }
        setError(response.error);
        updateStatus("error");
        return;
      }

      if (!response.text) {
        setError("Tidak ada suara yang terdeteksi. Coba bicara lebih jelas.");
        updateStatus("error");
        return;
      }

      updateStatus("idle");
      onTranscriptRef.current?.(response.text);
    } catch (err) {
      if (activeRequestIdRef.current !== requestId) {
        return;
      }
      activeRequestIdRef.current = null;
      setError(err instanceof Error ? err.message : "Gagal memproses suara.");
      updateStatus("error");
    }
  }, [language, updateStatus]);

  const startRecording = useCallback(async () => {
    if (
      statusRef.current === "requesting-permission" ||
      statusRef.current === "recording" ||
      statusRef.current === "transcribing"
    ) {
      return;
    }

    const sttApi = getSttApi();
    if (!sttApi?.transcribeSpeech) {
      setError("Input suara memerlukan aplikasi desktop Electron.");
      updateStatus("error");
      return;
    }

    setError(null);
    updateStatus("requesting-permission");

    if (!recorderRef.current) {
      recorderRef.current = new AudioRecorder();
    }

    try {
      await recorderRef.current.start({
        maxDurationMs,
        onMaxDurationReached: () => {
          void stopAndTranscribe();
        },
      });
      updateStatus("recording");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memulai mikrofon.");
      updateStatus("error");
    }
  }, [maxDurationMs, stopAndTranscribe, updateStatus]);

  const cancel = useCallback(() => {
    recorderRef.current?.cancel();

    const pendingId = activeRequestIdRef.current;
    activeRequestIdRef.current = null;
    if (pendingId) {
      getSttApi()?.cancelSpeechTranscribe?.(pendingId);
    }

    setError(null);
    updateStatus("idle");
  }, [updateStatus]);

  const clearError = useCallback(() => {
    setError(null);
    if (statusRef.current === "error") {
      updateStatus("idle");
    }
  }, [updateStatus]);

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      const pendingId = activeRequestIdRef.current;
      if (pendingId) {
        getSttApi()?.cancelSpeechTranscribe?.(pendingId);
        activeRequestIdRef.current = null;
      }
    };
  }, []);

  return {
    status,
    error,
    isSupported,
    isConfigured,
    startRecording,
    stopAndTranscribe,
    cancel,
    clearError,
  };
}
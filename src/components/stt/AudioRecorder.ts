import { STT_ALLOWED_MIME_TYPES, STT_LIMITS } from "../../types/stt";

export interface RecordedAudioResult {
  audioBase64: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AudioRecorderStartOptions {
  maxDurationMs?: number;
  onMaxDurationReached?: () => void;
}

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }
  for (const candidate of STT_ALLOWED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "";
}

function blobToPureBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Gagal membaca hasil rekaman audio."));
        return;
      }
      
      const commaIndex = reader.result.indexOf(",");
      if (commaIndex === -1) {
        reject(new Error("Format encoding audio tidak valid."));
        return;
      }
      resolve(reader.result.slice(commaIndex + 1));
    };
    reader.onerror = () => {
      reject(new Error("Gagal mengonversi audio ke Base64."));
    };
    reader.readAsDataURL(blob);
  });
}

function mapMediaErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      return "Izin mikrofon ditolak. Aktifkan akses mikrofon untuk aplikasi ini di pengaturan Windows.";
    }
    if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      return "Perangkat mikrofon tidak ditemukan. Pastikan mikrofon terpasang dan aktif.";
    }
    if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      return "Mikrofon sedang digunakan oleh aplikasi lain.";
    }
  }
  return "Gagal mengakses mikrofon perangkat.";
}

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private activeMimeType = "audio/webm";

  public isRecording(): boolean {
    return this.recorder !== null && this.recorder.state === "recording";
  }

  public async start(options: AudioRecorderStartOptions = {}): Promise<void> {
    if (this.isRecording()) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Perangkat atau lingkungan ini tidak mendukung perekaman audio.");
    }

    const supportedMimeType = pickSupportedMimeType();
    if (!supportedMimeType) {
      throw new Error("Format audio yang kompatibel tidak tersedia di perangkat ini.");
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err) {
      throw new Error(mapMediaErrorMessage(err));
    }

    this.stream = stream;
    this.chunks = [];
    this.activeMimeType = supportedMimeType;

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: supportedMimeType,
        audioBitsPerSecond: 32_000,
      });

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.recorder = recorder;
      recorder.start(250);

      const maxDurationMs = options.maxDurationMs ?? STT_LIMITS.MAX_DURATION_MS;
      this.maxDurationTimer = setTimeout(() => {
        if (this.isRecording()) {
          options.onMaxDurationReached?.();
        }
      }, maxDurationMs);
    } catch {
      this.cleanup();
      throw new Error("Gagal memulai perekaman suara.");
    }
  }

  public async stop(): Promise<RecordedAudioResult> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === "inactive") {
      this.cleanup();
      throw new Error("Tidak ada rekaman yang sedang berjalan.");
    }

    this.clearTimer();

    return new Promise<RecordedAudioResult>((resolve, reject) => {
      recorder.onstop = async () => {
        try {
          const mimeType = recorder.mimeType || this.activeMimeType;
          const blob = new Blob(this.chunks, { type: mimeType });
          const sizeBytes = blob.size;

          if (sizeBytes === 0) {
            throw new Error("Rekaman suara kosong. Coba bicara lebih lama.");
          }
          if (sizeBytes > STT_LIMITS.MAX_AUDIO_BYTES) {
            throw new Error("Ukuran audio melebihi batas maksimal 5 MB.");
          }

          const audioBase64 = await blobToPureBase64(blob);
          resolve({ audioBase64, mimeType, sizeBytes });
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Gagal memproses hasil rekaman."));
        } finally {
          this.cleanup();
        }
      };

      recorder.onerror = () => {
        this.cleanup();
        reject(new Error("Terjadi gangguan saat menghentikan rekaman."));
      };

      recorder.stop();
    });
  }

  public cancel(): void {
    this.clearTimer();
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      this.recorder.onerror = null;
      try {
        this.recorder.stop();
      } catch {
        // Ignore error jika recorder sudah berhenti
      }
    }
    this.cleanup();
  }

  private clearTimer(): void {
    if (this.maxDurationTimer !== null) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
  }

  private cleanup(): void {
    this.clearTimer();
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.recorder = null;
    this.chunks = [];
  }
}
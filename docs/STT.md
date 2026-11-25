# Speech-to-Text (STT) voice input

Flowy’s **Ask Flowy** chat includes an optional microphone button that transcribes spoken commands into text using Groq’s Whisper API (`whisper-large-v3-turbo`).

Speech-to-Text only populates the **Ask Flowy** text box. It never bypasses the AI workspace router, never creates actions, and never executes a routine automatically. The user must still review the transcribed text, submit it to **Ask AI**, and press **Run routine**.

## What you must provide

You need a Groq API key to enable voice transcription.

1. Open [Groq Console API keys](https://console.groq.com/keys).
2. Sign in and create a new API key (starts with `gsk_...`).
3. Before launching Flowy, set this environment variable:

```text
FLOWY_GROQ_API_KEY=your_groq_api_key_here

```

Flowy defaults to `whisper-large-v3-turbo`, which supports both Indonesian and English with automatic language detection. To use another Groq-hosted Whisper model, optionally set:

```text
FLOWY_GROQ_WHISPER_MODEL=whisper-large-v3-turbo

```

Do not add either value to `VITE_*`, React code, Git, screenshots, or renderer `localStorage`. Vite variables are bundled into the renderer and are not secret.

### Launch examples

PowerShell, for the current terminal session:

```powershell
$env:FLOWY_GROQ_API_KEY = "gsk_paste-your-key-here"
$env:FLOWY_GROQ_WHISPER_MODEL = "whisper-large-v3-turbo" # optional
npm run electron:dev

```

Windows Command Prompt:

```bat
set FLOWY_GROQ_API_KEY=gsk_paste-your-key-here
set FLOWY_GROQ_WHISPER_MODEL=whisper-large-v3-turbo
npm run electron:dev

```

Linux/macOS development:

```bash
FLOWY_GROQ_API_KEY='gsk_paste-your-key-here' npm run electron:dev

```

Restart Flowy after changing environment variables.

## User flow

1. The user clicks the microphone button in **Ask Flowy**.
2. The renderer captures microphone input via Web Audio API and encodes it locally as 16 kHz, 16-bit PCM mono WAV (`audio/wav`).
3. Recording stops when the user clicks the button again (or automatically at 30 seconds), releasing the OS microphone stream immediately.
4. The renderer sends the base64-encoded WAV payload over context-isolated IPC (`stt:transcribe`).
5. Electron main validates the sender window, MIME type, byte bounds, and timeout, then sends the audio to Groq Whisper.
6. Electron main normalizes whitespace, caps the result at 2,000 characters, and returns the transcript to the renderer.
7. **Ask Flowy** appends the transcript into the text input so the user can review or edit it.
8. The user presses **Ask AI** and then **Run routine** through the existing confirmation flow.

Cancelled, silent, malformed, or failed recordings never modify routines or trigger OS actions.

## Architecture

```text
VoiceTrigger / WorkspaceChat (renderer)
  -> AudioRecorder (Web Audio API -> 16 kHz mono WAV)
  -> useSpeechToText hook
  -> context-isolated preload: stt:configuration / stt:transcribe / stt:cancel
  -> trusted main-window IPC (sttIpc.ts)
  -> SttManager validation and timeout boundary
  -> GroqWhisperProvider (HTTPS multipart/form-data)
  -> transcript inserted into Ask Flowy text input
  -> existing AI Router -> confirmation -> ExecutionEngine

```

Source responsibilities:

* `src/components/stt/AudioRecorder.ts`: Microphone capture, 16 kHz downsampling, WAV encoding, 30-second max duration timer, and `MediaStreamTrack` cleanup.
* `src/components/stt/useSpeechToText.ts`: React state machine (`idle`, `requesting-permission`, `recording`, `transcribing`, `error`), request ID tracking, and unmount cancellation.
* `src/components/stt/VoiceTrigger.tsx`: Accessible microphone/stop button, live elapsed timer, cancel control, and error popover.
* `src/components/chat/WorkspaceChat.tsx`: Embeds `VoiceTrigger` beside the **Ask Flowy** input box.
* `src/types/stt.ts`: Renderer-side STT contracts.
* `electron/preload.ts`: Exposes `getSttConfiguration`, `transcribeSpeech`, and `cancelSpeechTranscribe` on `window.electronAPI`.
* `electron/ipc/sttIpc.ts`: Main-frame sender verification, single active job per renderer, and lifecycle abort cleanup.
* `electron/backend/stt/sttManager.ts`: Configuration reporting, MIME allowlist, audio byte bounds, 15-second timeout, and transcript sanitization.
* `electron/backend/stt/providers/whisperStt.ts`: Groq Whisper REST adapter and sanitized HTTP error mapping.
* `electron/backend/stt/types.ts`: Electron-side STT contracts.

Types are duplicated across `src/types/stt.ts` and `electron/backend/stt/types.ts` because `tsconfig.electron.json` compiles `electron/` separately from the renderer. Keep both files synchronized when changing IPC payloads.

## IPC contract

Channels exposed via `window.electronAPI`:

* `getSttConfiguration()` -> `ipcRenderer.invoke("stt:configuration")`
* `transcribeSpeech(request)` -> `ipcRenderer.invoke("stt:transcribe", request)`
* `cancelSpeechTranscribe(requestId)` -> `ipcRenderer.send("stt:cancel", requestId)`

Transcribe request:

```ts
{
  requestId: string;
  audioBase64: string; // Pure base64 without data-URL prefix
  mimeType: string;    // e.g. "audio/wav"
  language?: string;   // Optional ISO-639-1 hint (e.g. "id" or "en")
}

```

Transcribe response:

```ts
{ ok: true, requestId: string, text: string }

```

Failure response:

```ts
{
  ok: false,
  requestId: string,
  code: "NOT_CONFIGURED" | "INVALID_REQUEST" | "AUTHENTICATION" |
        "RATE_LIMITED" | "TIMEOUT" | "OFFLINE" | "INVALID_RESPONSE" |
        "CANCELLED" | "PROVIDER_ERROR",
  error: string
}

```

Current limits:

* Recording duration: up to 30 seconds (`30,000 ms`).
* Audio payload size: `3,244` bytes (~0.1s minimum WAV) to `5 MiB` maximum.
* Provider timeout: 15 seconds (`15,000 ms`).
* Transcript output: trimmed and capped at `2,000` characters to match **Ask Flowy** input limits.
* Concurrency: one active transcription job per renderer; starting a new job or navigating/closing the window aborts any pending request.

## Audio capture and privacy

Microphone audio is buffered only in memory during an active recording session and is never written to disk by the renderer or main process. Stopping, cancelling, or unmounting the component immediately stops all `MediaStream` audio tracks so the Windows microphone indicator turns off.

Only the recorded audio clip (and optional two-letter language hint) is sent to Groq’s transcription endpoint when the user stops recording. API keys are read exclusively in Electron main and are never logged or exposed to the renderer. Raw provider error bodies are logged only in the main process console and mapped to sanitized UI messages.

## Troubleshooting

* **Microphone button disabled (`FLOWY_GROQ_API_KEY belum diatur`)**: Set `FLOWY_GROQ_API_KEY` in the same terminal environment that launches Electron, then restart.
* **Authentication error (`API key Groq tidak valid atau ditolak`)**: Verify the `gsk_...` key in Groq Console and ensure no extra quotes or spaces were included.
* **Rate limited**: Wait for Groq quota reset or check usage limits in Groq Console. Flowy does not auto-retry.
* **Recording too short**: Speak for at least 1 second before stopping the recording.
* **Microphone permission denied**: Enable desktop app microphone access in Windows Privacy & Security settings and ensure no other app holds exclusive device control.
* **Offline / timeout**: Check internet access to `api.groq.com` and retry.
* **Browser preview**: Voice input requires the Electron desktop app because microphone IPC and API credentials live in the main process.

## Development and validation

```bash
npm run typecheck
npm run build:renderer
npm run build:electron

```

Manual smoke test checklist:

1. Start Electron with `FLOWY_GROQ_API_KEY` set and confirm the microphone button in **Ask Flowy** is enabled.
2. Record a spoken command (Indonesian or English), stop recording, and confirm the transcript appears in the **Ask Flowy** text box without auto-running any routine.
3. Click **Cancel** during both recording and transcribing states and verify the Windows microphone tray indicator turns off immediately and no late text appears.
4. Record silence for 2 seconds and verify an actionable empty-speech message is displayed cleanly.

## Adding another provider

Implement the `SttProvider` interface (`name`, `isConfigured()`, `transcribe(input)`) in `electron/backend/stt/providers/`, map failures to `SttProviderError` codes, and inject the provider into `SttManager` in `electron/backend/stt/sttManager.ts`. A local offline `whisper.cpp` adapter can follow the same contract without changing IPC or renderer components.

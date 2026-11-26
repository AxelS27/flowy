# Speech Recognition & Audio Pipeline Specification

- **Project:** VoFlow Desktop
- **Module:** Speech Recognition (Wake Word Detection & Automatic Speech Recognition)
- **Target Platform:** Windows 10 / Windows 11 (x64)
- **Audio Format:** 16,000 Hz, 16-bit PCM, Mono Channel
- **Status:** Architecture & Engineering Specification

---

## 1. Overview & Objectives

The Speech Recognition module is responsible for capturing raw acoustic audio from the user's microphone, detecting invocations, and transcribing spoken voice commands into clean text tokens for the Deep Learning Intent Classifier.

To optimize CPU and battery efficiency on desktop systems, the audio pipeline employs a **two-stage decoupled architecture**:
1. **Stage 1 (Passive Standby):** Ultra-low-power Wake Word Engine continuously monitors incoming audio frames for the keyword **"VoFlow"**.
2. **Stage 2 (Active Listening):** Once awakened, the full Speech-to-Text (STT) and Voice Activity Detection (VAD) engines activate to transcribe the user's command, then immediately return to standby.

---

## 2. Two-Stage Audio Architecture

```
+-----------------------------------------------------------------+
| MICROPHONE AUDIO INPUT STREAM (16kHz, 16-bit PCM Mono)         |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
| STAGE 1: WAKE WORD DETECTION (Keyword Spotting - KWS)           |
| - Engine: Picovoice Porcupine or openWakeWord                   |
| - Target Keyphrase: "VoFlow"                                    |
| - Resource Profile: Continuous running, CPU < 0.5%, RAM < 15MB   |
+-----------------------------------------------------------------+
                                |
                 Keyphrase Triggered ("VoFlow")
                                v
+-----------------------------------------------------------------+
| SYSTEM ACTIVATION EVENT                                         |
| - Play subtle audio chime                                       |
| - Trigger Dynamic Island overlay ("Listening...")               |
| - Activate STT Stream & Voice Activity Detection (VAD)          |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
| STAGE 2: SPEECH-TO-TEXT & VAD (Active Command Capture)          |
| - Voice Activity Detection (VAD): Silero VAD or Energy gate     |
| - STT Engine: Vosk Indonesian Model or Whisper-tiny.cpp         |
| - Detects speech onset & 1.2s trailing silence cutoff           |
| - Timeout: 4.0s without speech -> Auto collapse                 |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
| OUTPUT: Clean Text Transcript -> Sent to Intent Classifier      |
| Example: "Tolong nyalain mode belajar dong"                     |
+-----------------------------------------------------------------+
```

---

## 3. Audio Stream & Signal Processing Specifications

### 3.1 Audio Capture Configuration
- **Sample Rate:** 16,000 Hz (16 kHz is the standard sampling rate for acoustic speech models).
- **Bit Depth:** 16-bit Linear PCM (Signed Integer).
- **Channels:** 1 (Mono).
- **Frame/Chunk Size:** 512 samples per buffer (~32 ms per chunk) to ensure minimal latency.
- **Audio Capture Backend:** Direct audio capture via Windows WASAPI or portable C library (`miniaudio` / `portaudio`).

### 3.2 Voice Activity Detection (VAD) & Utterance Segmentation
Without VAD, the speech engine would not know when the user has finished speaking. VoFlow implements a dual-timer VAD state machine:

```
[Wake Word Triggered] -> [State: WAITING_SPEECH]
                              |
       +----------------------+----------------------+
       | User starts speaking within 4s              | Silence >= 4.0s
       v                                             v
[State: RECORDING_COMMAND]                     [State: TIMEOUT_ABORT]
       |                                             |
       | User speaks ...                             v
       | Trailing silence detected (>= 1.2s)    Dismiss Dynamic Island
       v                                        Return to Standby
[State: FINALIZE_TRANSCRIPTION]
       |
       v
Send audio buffer to STT Engine -> Emit Text
```

1. **Silence Timeout (Initial):** If the user invokes "VoFlow" but no speech activity is detected within 4.0 seconds, the session cancels and the overlay smoothly collapses.
2. **Trailing Silence Cutoff (Endpointing):** Once speech begins, audio recording automatically finalizes after 1.2 seconds of continuous trailing silence, providing a natural conversational pause threshold.
3. **Maximum Utterance Guard:** Caps command recording at 8.0 seconds to prevent buffer bloat in noisy environments.

---

## 4. Technology Selection & Trade-Offs

### 4.1 Wake Word Engine Comparison (Stage 1)

| Engine | Accuracy | CPU Footprint | Custom Wake Word Support | Offline |
|---|---|---|---|---|
| **Picovoice Porcupine** | Very High (97%+) | < 0.5% | Yes (train "VoFlow" in console) | 100% Offline |
| **openWakeWord** | High (92%+) | ~1.0% | Yes (PyTorch/ONNX based) | 100% Offline |
| **Vosk Keyword Grammar** | Medium (85%+) | ~2.0% | Yes (Grammar rule matching) | 100% Offline |

*Selection for VoFlow:* **Picovoice Porcupine (Windows x64 SDK)** or **openWakeWord**. Both provide on-device keyphrase spotting without measurable CPU impact.

---

### 4.2 Speech-to-Text (STT) Engine Comparison (Stage 2)

| Engine | Indonesian Support | Latency (RTF) | Memory Footprint | Model Size |
|---|---|---|---|---|
| **Vosk (`vosk-model-small-id-0.4`)** | Excellent (Native ID) | Fast (< 0.25x RTF) | ~70 MB RAM | ~43 MB |
| **Whisper-tiny (`whisper.cpp`)** | Good (Multilingual) | Moderate (~0.4x RTF) | ~150 MB RAM | ~75 MB |
| **Windows SAPI / WinRT** | Dependent on OS Pack | Fast | System managed | OS Built-in |

*Selection for VoFlow:* 
- **Primary Option: Vosk Indonesian Small Model (`vosk-model-small-id-0.4`)**
  - Specifically trained on Indonesian conversational speech (Kaldi TDNN-F acoustic model).
  - 100% offline, zero cloud calls, file size only 43 MB.
  - Native C/C++ shared library (`libvosk.dll`) easily callable from Flutter Desktop via Dart FFI.
- **Alternative Option: Whisper-tiny (`whisper.cpp`)**
  - Transformer sequence-to-sequence model; excellent punctuation and mixed English/Indonesian handling.

---

## 5. Acoustic Pipeline Lifecycle & State Machine

The audio engine transitions between five well-defined states:

```
[STATE 0: STANDBY_MONITORING]
  - Mic buffer streamed to Wake Word Engine (chunk size: 512 samples)
  - STT Engine is asleep (zero CPU)
        |
        | Event: Wake Word "VoFlow" detected (Confidence >= 0.75)
        v
[STATE 1: AWAKE_WAITING_COMMAND]
  - Play feedback chime
  - Show Dynamic Island: "[Mic] VoFlow: Listening..."
  - Start 4.0s countdown timer
  - Feed audio to VAD
        |
        | Event: VAD detects voice energy onset
        v
[STATE 2: STREAMING_TRANSCRIPTION]
  - Show Dynamic Island: "[Waves] Listening to command..."
  - Audio frames pushed to Vosk / STT accumulator
  - Monitor trailing silence timer
        |
        | Event: Trailing silence >= 1.2s OR Max duration 8.0s reached
        v
[STATE 3: FINALIZING_TRANSCRIPT]
  - STT finalizes decoding
  - Text emitted: "Mode belajar"
  - Sent to Deep Learning Intent Classifier
        |
        | Event: DL Intent resolved & Actions dispatched
        v
[STATE 4: COOLDOWN & RETURN_TO_STANDBY]
  - Clear audio buffer
  - Re-arm Wake Word listener
  - Return to STATE 0
```

---

## 6. Native Desktop Integration Architecture

To ensure zero stutter and decouple audio processing from the Flutter UI thread, audio processing runs in a dedicated background worker or native C++ thread:

```
+-------------------------------------------------------------------+
|                        FLUTTER DESKTOP UI                         |
| - Dynamic Island Visual States (Listening / Processing)           |
| - Settings (Microphone selection, Sensitivity slider)             |
+-------------------------------------------------------------------+
                                 |
                          Dart FFI / Isolate
                                 |
                                 v
+-------------------------------------------------------------------+
|                    DART BACKGROUND AUDIO ISOLATE                  |
| - Audio Stream Management                                         |
| - VAD Timer State Machine (4s timeout, 1.2s trailing silence)     |
+-------------------------------------------------------------------+
                                 |
                    C-Bindings / Direct Native Call
                                 |
                                 v
+-------------------------------------------------------------------+
|                NATIVE AUDIO & SPEECH ENGINES (C/C++)              |
| 1. WASAPI / Miniaudio: Raw Mic Input Stream                       |
| 2. libporcupine.dll: Continuous Wake Word Spotting ("VoFlow")     |
| 3. libvosk.dll: Vosk Indonesian Acoustic Decoder                  |
+-------------------------------------------------------------------+
```

---

## 7. Performance & Quality Benchmarks

| Metric | Definition | Target Specification |
|---|---|---|
| **Wake Word Latency** | Time from end of word "VoFlow" to UI chime | < 120 ms |
| **Wake Word True Positive Rate** | Successful detection in quiet to moderate room noise | >= 95% |
| **Wake Word False Positive Rate** | Unintended triggers during 8 hours of background talk | < 1 occurrence |
| **STT Real-Time Factor (RTF)** | Execution time divided by audio duration | <= 0.30 (e.g. 2s audio decoded in < 600ms) |
| **Word Error Rate (WER)** | Command keyword error rate on Indonesian commands | <= 12% |
| **Standby CPU Usage** | CPU utilization while waiting in background | < 0.5% on modern 4-core+ CPU |
| **Active Peak CPU Usage** | CPU utilization during active STT decoding | < 15% for < 1 second |

---

## 8. Academic Relevance: Speech & Acoustic Processing

In academic coursework (Speech Processing, Audio DSP, or Applied Deep Learning), this module provides concrete coverage of fundamental acoustic modeling concepts:

1. **Acoustic Feature Extraction:**
   - Conversion of raw time-domain audio samples $s[n]$ into spectral representations via Short-Time Fourier Transform (STFT).
   - Generation of Mel-Frequency Cepstral Coefficients (MFCC) and Mel-filterbank energy features.
2. **Deep Acoustic Modeling:**
   - Time Delay Neural Networks (TDNN-F) in Vosk/Kaldi or Convolutional Encoder-Decoder Transformers in Whisper.
3. **Language Model Integration:**
   - $N$-gram and WFST (Weighted Finite-State Transducer) decoding graphs that resolve phoneme probabilities into grammatically valid vocabulary sequences.

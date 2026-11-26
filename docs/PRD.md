# Product Requirements Document (PRD) - VoFlow

- **Product Name:** VoFlow (VoiceFlow)
- **Product Type:** Mobile Application
- **Platform:** Android
- **Primary Technology Stack:** Flutter + Kotlin (Native Android)
- **Project Focus:** Speech-to-Text, Voice Command Recognition, Android System Automation
- **Status:** Product Concept / MVP Specification

---

## 1. Product Overview

VoFlow is a customizable voice automation application for Android that enables users to trigger and execute multi-step system and application workflows through a natural, two-stage voice interaction model.

Instead of navigating through multiple settings and applications manually, users configure personalized workflows that are invoked via a dedicated wake word (**"VoFlow"**) or shortcut triggers, followed by their custom voice command.

### Two-Stage Interaction Model
1. **Invocation (Wake Word):** The user says *"VoFlow"*.
2. **Visual Activation:** A system-level **Dynamic Island overlay** expands at the top of the screen with a subtle chime, indicating readiness (*"Listening..."*).
3. **Command Input:** The user speaks their custom command (e.g., *"Mode Belajar"* or *"Study Mode"*).
4. **Execution & Live Feedback:** The workflow steps execute sequentially while the Dynamic Island displays real-time progress for each action.
5. **Completion:** The overlay confirms completion and smoothly collapses.

### Example Scenario: "Study Mode"
A user configures a workflow titled **"Study Mode"** containing four sequential actions:
1. Adjust display brightness to 40%.
2. Enable Do Not Disturb (DND) mode.
3. Set a countdown timer for 50 minutes.
4. Launch Spotify.

**Execution Flow:**
- User: *"VoFlow"*
- Dynamic Island expands at top of screen: `[Mic] VoFlow: Listening...`
- User: *"Mode belajar."*
- Dynamic Island updates: `[Gear] Mode Belajar - Processing...`
- Actions execute sequentially with live checklist ticks in the overlay.
- Dynamic Island shows `[v] Mode Belajar - Completed` and collapses.

---

## 2. Problem Statement

Android users frequently execute repetitive multi-step routines during daily activities.

For instance, preparing to study typically requires:
```
Lower Brightness -> Enable Do Not Disturb -> Open Spotify -> Set Study Timer
```

While each task is straightforward individually, performing them repeatedly throughout the day creates unnecessary friction across disparate UI menus and settings panels.

Existing voice assistants (such as Google Assistant or Gemini) are engineered as conversational, general-purpose agents. They often struggle with deterministic, multi-step device automation tailored specifically to user preferences. VoFlow takes a fundamentally different path:

VoFlow is not a conversational chatbot trying to answer everything; it is a dedicated personal automation utility allowing users to define exactly:
> **"When I say X, execute workflow Y."**

---

## 3. Product Vision & Value Proposition

### Vision Statement
Make repetitive Android actions executable through a single, personalized voice command.

### Core Value: Customizable Voice Automation
VoFlow allows users to author custom trigger phrases and connect them to deterministic multi-action pipelines.

| Voice Command | Executed Actions |
|---|---|
| **"Study Mode"** | Brightness 40% -> DND ON -> Timer 50m -> Open Spotify |
| **"Sleep Mode"** | Brightness 10% -> DND ON -> Set Alarm for 06:00 |
| **"Work Routine"** | Brightness 60% -> Open Notion -> Open Spotify |
| **"Relax"** | Brightness 70% -> DND OFF -> Open YouTube |

### Positioning: General Voice Assistant vs. VoFlow

| Dimension | General Voice Assistant | VoFlow |
|---|---|---|
| **Primary Scope** | Broad, general-purpose assistance | Focused device automation |
| **Interaction Model** | Conversational dialogue | Two-stage: Wake -> Command -> Execution |
| **Workflow Definition** | Decided dynamically by AI | Defined explicitly by the user |
| **Execution Control** | Best-effort, varied responses | Strict, controlled action sequences |
| **Visual Feedback** | Chat bubbles / Assistant panel | Dynamic Island overlay over any screen |
| **User Role** | Asking for answers or suggestions | Building custom automated routines |

VoFlow does not attempt to replace general assistants; it provides a specialized, user-controlled category: **Personal Voice Automation**.

---

## 4. Target Users & Personas

### Target Audience
- Android power users and productivity-oriented individuals.
- Students and professionals managing contextual daily routines (study, meetings, bedtime, focus).
- Users looking for hands-free or one-tap routine orchestration.

### Persona: Farrell - College Student
- **Profile:** Computer science student who transitions between study sessions, lectures, and rest routines daily.
- **Pain Point:** Every evening, he manually turns down brightness, enables DND, launches Spotify, sets a study timer, and opens his note-taking app. Performing five separate manual actions disrupts his focus.
- **Solution with VoFlow:** He utters *"VoFlow"* -> waits for the Dynamic Island -> says *"Mode belajar."* The entire workflow runs automatically in seconds.

---

## 5. Core Interaction Architecture

The system operates across a clear state machine:

```
+-----------------------------------------------------------------+
| STATE 0: STANDBY (Background Listening)                         |
| Low-power Wake Word Engine listens for "VoFlow"                 |
+-----------------------------------------------------------------+
                                |
                   Wake Word Detected ("VoFlow")
                                v
+-----------------------------------------------------------------+
| STATE 1: WAKE & EXPAND                                          |
| Audio chime plays + Dynamic Island expands on top of screen     |
| Status: "Listening for command..."                              |
+-----------------------------------------------------------------+
                                |
                 User speaks: "Mode Belajar"
         (Timeout fallback: 4-5s silence -> Auto collapse)
                                v
+-----------------------------------------------------------------+
| STATE 2: RECOGNITION & INTENT ROUTING                           |
| Speech-to-Text converts audio to text                           |
| Deep Learning / Intent Matcher maps phrase -> Target Workflow   |
| Status: "Mode Belajar - Processing..."                          |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
| STATE 3: SEQUENTIAL WORKFLOW EXECUTION                          |
| Kotlin native layer executes platform actions one by one:       |
|   [v] Brightness -> 40%                                         |
|   [v] Do Not Disturb -> ON                                      |
|   [*] Timer -> 50 minutes                                       |
|   [ ] Open Spotify                                              |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
| STATE 4: COMPLETION & DISMISSAL                                 |
| Status: "Mode Belajar - Completed"                              |
| Dynamic Island smoothly collapses back to hidden / pill state   |
+-----------------------------------------------------------------+
```

---

## 6. Functional Requirements & Features

### 6.1 Wake Word Detection & Invocations
- **Primary Invocation (Hands-Free):** Low-power, on-device keyword spotting for the wake word **"VoFlow"** (e.g., via Picovoice Porcupine or Vosk).
- **Secondary / Auxiliary Triggers (No-Voice Fallback):**
  - **Quick Settings Tile:** Tap from the Android notification shade to immediately trigger the Dynamic Island listening state.
  - **Floating Action Pill:** A lightweight draggable pill on screen that opens the listening overlay on tap.
  - **In-App Mic Button:** Push-to-talk button inside the Flutter dashboard.
- **Silence & Timeout Handling:** If the user triggers "VoFlow" but remains silent for 4-5 seconds, the Dynamic Island automatically cancels and collapses to save resources.

### 6.2 Dynamic Island / System Overlay
An Android system overlay (`SYSTEM_ALERT_WINDOW`) provides contextual visual feedback over any currently running application:

```
1. Standby / Pill State (Optional subtle indicator or fully hidden)

2. Listening State (Triggered by "VoFlow"):
   +-----------------------------------------------+
   | [Mic] VoFlow: Listening...                    |
   +-----------------------------------------------+

3. Processing State:
   +-----------------------------------------------+
   | [Gear] Mode Belajar - Processing...           |
   +-----------------------------------------------+

4. Sequential Execution State:
   +-----------------------------------------------+
   | [Play] Mode Belajar                           |
   |   [v] Brightness set to 40%                   |
   |   [v] Do Not Disturb enabled                  |
   |   [*] Setting timer (50m)...                  |
   |   [ ] Launching Spotify                       |
   +-----------------------------------------------+

5. Completion State:
   +-----------------------------------------------+
   | [v] Mode Belajar - Completed                  |
   +-----------------------------------------------+
```

### 6.3 Custom Command Management
- **Create Command:** Define command title, trigger phrases, and associated actions.
- **Edit Command:** Update phrases, insert/remove actions, and reorder steps.
- **Delete Command:** Remove unused workflows.
- **Enable / Disable Toggle:** Deactivate specific workflows without deletion.

### 6.4 Action System
Each workflow supports one or more actions:

#### Device Actions
- **Set Screen Brightness:** Specify target percentage (0% - 100%).
- **Set Volume:** Specify media, alarm, or ringtone volume levels.
- **Set Timer:** Configure countdown duration in minutes/seconds.
- **Set Alarm:** Configure target wake-up or reminder time.
- **Toggle Do Not Disturb (DND):** Enable or disable notification suppression (requires Notification Policy access).
- **Lock Screen:** Device lock (via Accessibility or Device Administration policies where permitted).

#### Application Actions
- **Open Application:** Launch installed applications via package name or Android intent (e.g., Spotify, YouTube, WhatsApp, Notion, Google Calendar).
- **Open URL:** Launch a target web URL in the default browser.
- **Search / Content Shortcuts (Scoped MVP):** Deep-link queries where supported by platform intents.

### 6.5 Action Ordering & Sequencing
- Workflows support $N$ ordered actions.
- Drag-and-drop reordering interface in the workflow editor.
- Sequential execution pipeline with step status reporting (Pending -> In Progress -> Success / Failed).

### 6.6 Natural Command Matching (Deep Learning / NLP Layer)
To prevent rigid phrasing requirements, the system matches conversational variants to the user-defined workflow:
- Example variants for *"Study Mode"*:
  - *"Mode belajar"*
  - *"Mulai mode belajar"*
  - *"Gue mau belajar"*
  - *"Aktifkan mode belajar"*
  - *"Study mode"*
- **Approach:** Sentence embeddings (e.g., MiniLM, MobileBERT, or quantized IndoBERT via TFLite) compare user utterance vectors to active command trigger vectors via Cosine Similarity.
- If similarity exceeds threshold ($\tau \ge 0.75$), the matching workflow executes immediately.

---

## 7. User Flows

### 7.1 Authoring Flow (Workflow Creation)
```
Launch App
    |
    v
Tap "Create Command"
    |
    v
Enter Name & Trigger Phrases ("Mode Belajar", "Mulai Belajar")
    |
    v
Add Actions (Brightness -> DND -> Timer -> Open App)
    |
    v
Reorder Steps & Configure Parameters
    |
    v
Save Workflow -> Registered in Local Storage & Intent Engine
```

### 7.2 Two-Stage Execution Flow (Hands-Free Voice Invocation)
```
User speaks: "VoFlow"
    |
    v
Kotlin Background Service detects wake word
    |
    v
Audio chime plays + Dynamic Island expands: "Listening..."
    |
    v
User speaks command: "Mode belajar"
    |
    v
Speech-to-Text converts audio to text transcript
    |
    v
Deep Learning / Intent Matching finds target workflow (WORKFLOW_STUDY_MODE)
    |
    v
Workflow Engine dispatches sequential actions
    |
    v
Kotlin Native Layer executes Android APIs (Intents, System Settings)
    |
    v
Dynamic Island renders real-time step progress ticks
    |
    v
Workflow completes -> Dynamic Island shows "Completed" -> Auto collapses
```

---

## 8. Technical Architecture

### 8.1 Responsibility Separation

```
+-------------------------------------------------------------------+
|                        FLUTTER (Client UI)                        |
| - User Interface, Theme & Design System                           |
| - Workflow Editor & Action Selector                               |
| - Command Dashboard & Execution History Log                       |
| - Local Database & Serialization (SQLite / Hive / Isar)           |
| - State Management (Bloc / Riverpod)                              |
+-------------------------------------------------------------------+
                                 |
                     MethodChannel / EventChannel
                                 |
                                 v
+-------------------------------------------------------------------+
|                      KOTLIN (Native Android)                      |
| - Wake Word Engine (Picovoice Porcupine / Vosk keyphrase)         |
| - Android Foreground Service (android:foregroundServiceType=mic)  |
| - WindowManager System Overlay (Dynamic Island live UI feedback)  |
| - System Settings APIs (Brightness, Volume)                       |
| - NotificationManager (Do Not Disturb access)                     |
| - AlarmManager & Timer Intents                                    |
| - Application Launcher Intents & URL Openers                      |
| - Permissions Management (SYSTEM_ALERT_WINDOW, WRITE_SETTINGS,    |
|   ACCESS_NOTIFICATION_POLICY, RECORD_AUDIO)                       |
+-------------------------------------------------------------------+
                                 |
                                 v
+-------------------------------------------------------------------+
|                  SPEECH & INTENT ROUTING LAYER                    |
| - Speech-to-Text Engine (Android SpeechRecognizer / Vosk STT)     |
| - Pretrained Sentence Embeddings / TFLite Intent Classifier       |
| - Cosine Similarity Matching against User Workflow Triggers       |
+-------------------------------------------------------------------+
```

### 8.2 Flutter to Native Android Interaction Model
Workflows configured in Flutter are stored locally and synchronized with the native background engine. When invoked:
1. Native background service detects `"VoFlow"`, displays the overlay, and collects speech.
2. The transcript is routed through the intent matcher.
3. The matched workflow executes actions via native Kotlin controllers:

```json
{
  "workflowId": "wf_study_mode",
  "actions": [
    { "type": "SET_BRIGHTNESS", "value": 40 },
    { "type": "SET_DND", "enabled": true },
    { "type": "SET_TIMER", "durationSeconds": 3000, "label": "Study" },
    { "type": "OPEN_APP", "packageName": "com.spotify.music" }
  ]
}
```

4. Kotlin streams step progress updates back to both the Dynamic Island overlay and Flutter execution history.

---

## 9. Android Platform Permissions & System Considerations

To function seamlessly in the background and across third-party apps, VoFlow leverages standard Android system capabilities:

| Permission / API | Purpose | Justification & UX Flow |
|---|---|---|
| `RECORD_AUDIO` | Microphone access for wake word & command capture | Requested during onboarding with clear privacy explanation. |
| `FOREGROUND_SERVICE_MICROPHONE` | Continuous low-power wake word listening | Android 14+ requirement; persistent status bar notification shown. |
| `SYSTEM_ALERT_WINDOW` | Displaying Dynamic Island overlay over other apps | Prompts user to grant "Display over other apps" in Settings. |
| `WRITE_SETTINGS` | Adjusting screen brightness directly | Prompts user to grant "Modify system settings". |
| `ACCESS_NOTIFICATION_POLICY` | Toggling Do Not Disturb mode | Prompts user to grant DND access in system settings. |

### Privacy Indicator Compliance
On Android 12+, an on-screen green microphone dot appears while the microphone is active. VoFlow embraces transparency: the persistent foreground notification and Dynamic Island inform the user whenever audio capture is active.

---

## 10. Scope Boundaries

### In Scope for MVP
- **Two-Stage Voice Interaction:** Wake word ("VoFlow") -> Dynamic Island activation -> Command capture -> Execution.
- **Dynamic Island Overlay:** System-level floating overlay displaying listening, processing, step progress, and completion states.
- **Timeout Fallback:** Automatic overlay dismissal on 4-5 seconds of silence.
- **Auxiliary Triggers:** Quick Settings tile, floating pill, and in-app mic button.
- **Custom Command Management:** CRUD workflows with custom trigger phrases and enable/disable toggles.
- **Supported Actions:**
  - Screen brightness adjustment.
  - Set alarm.
  - Set timer.
  - Open application.
  - Open URL.
  - Toggle Do Not Disturb (DND).
- **Deep Learning / NLP Intent Router:** Sentence embedding matching for natural command variations in Indonesian and English.
- **Workflow Pipeline:** Multi-action sequencing and execution order customization.
- **UI & Dashboard:** Command list, workflow authoring wizard, execution history log.

### Out of Scope for MVP
- Open-domain conversational dialogues, chit-chat, or general knowledge Q&A.
- Continuous 24/7 full-vocabulary Speech-to-Text (mitigated by low-power wake word spotting).
- Smart home / IoT third-party integrations.
- Complex third-party in-app automation (e.g., auto-typing messages inside WhatsApp).
- Screen scraping or unrestricted UI hierarchy inspection via Accessibility Service.
- Autonomous AI agent decision-making.

---

## 11. Academic & Research Potential

VoFlow provides a concrete experimental framework for applied mobile AI research:

### Research Topic
> *Comparative Analysis of Intent Matching Architectures for On-Device Voice Automation in Low-Resource Utterances.*

### Experimental Comparison
1. **Rule-Based & Exact Matching:** Direct string equality and Levenshtein edit distance.
2. **Traditional Machine Learning / NLP:** TF-IDF vectorization paired with SVM or Naive Bayes classification.
3. **Deep Learning / Semantic Embeddings:** On-device sentence embedding models (e.g., MobileBERT, MiniLM, or quantized IndoBERT via TFLite) calculating Cosine Similarity.

### Evaluation Metrics
- **Classification Accuracy, Precision, Recall, and F1-Score** across diverse phrasing variants.
- **Inference Latency:** Milliseconds required from transcript capture to workflow identification.
- **Resource Footprint:** Memory usage (RAM), CPU cycles, and battery consumption on physical Android hardware.

---

## 12. Key Success Metrics & KPIs

| Metric | Definition | MVP Target |
|---|---|---|
| **Wake Word Detection Rate** | Successful detection of "VoFlow" under normal noise | >= 92% |
| **Command Recognition Accuracy** | Ratio of correctly transcribed utterances to total attempts | >= 90% |
| **Command Match Rate** | Correctly resolved workflow from natural phrasing variations | >= 85% |
| **Workflow Completion Rate** | Ratio of workflows completing all configured actions successfully | >= 95% |
| **Execution Latency** | Time elapsed between command speech end and final action execution | < 3.0 seconds |
| **Task Time Savings** | Reduction in time compared to executing individual tasks manually | >= 60% faster |

---

## 13. Product Summary & Defense

### Elevator Pitch
> VoFlow is an Android automation application that enables users to create personalized multi-action routines and trigger them hands-free through a two-stage voice interaction ("VoFlow" -> Command), complete with a live Dynamic Island visual feedback overlay that tracks execution in real time.

### Addressing the Fundamental Question: "Why not Google Assistant?"
> *"Google Assistant is engineered as a general-purpose conversational agent where Google controls the interaction flow and system capabilities. VoFlow is a dedicated voice automation tool where users explicitly define custom triggers and deterministically chain together device actions. Our focus is personalization, workflow composability, and transparent multi-action execution with live visual feedback."*

# Windows block backend

## Architecture

Flowy is a local desktop utility. There is no HTTP server, cloud dependency or
privileged background service. Electron main owns routine execution; renderers
only submit structured requests and display progress.

```
Editor / Island
  -> context-isolated preload
  -> trusted IPC
  -> ExecutionEngine
      -> validate + prepare the entire routine
      -> run blocks sequentially with AbortSignal
      -> category action handlers
          -> Electron APIs / Node filesystem
          -> Flowy.Windows.exe for native Windows integration
          -> PowerShell only for explicit user scripts
```

### Modules

- `electron/backend/engine.ts`: global single-run ownership, preflight,
  idempotency, progress, cancellation and shutdown.
- `electron/backend/validation.ts`: bounded inputs and legacy block mapping.
- `electron/backend/actions/`: audio/focus, apps, web, files, utilities and
  system handlers. Each handler prepares validated values before it executes.
- `electron/backend/runtime.ts`: abortable waits, parented native dialogs and
  bounded command execution.
- `electron/backend/native.ts`: JSON stdin/stdout protocol, helper timeout,
  cancellation, bounded output and error translation.
- `native/Flowy.Windows/Program.cs`: Core Audio COM, Windows UI Automation,
  normal app close/launch and Windows filesystem moves.
- `electron/ipc/trust.ts`: own top-level renderer and application URL checks.

Adding a block requires a stable catalog ID, a registered handler and editor
fields. A missing handler fails preflight rather than pretending to succeed.

## AI text routing and planned voice input

The home screen implements text-based workspace routing through Gemini:

```
Ask Flowy text -> AI Router -> User confirmation -> Selected Routine -> ExecutionEngine
```

Electron main sends only enabled routine IDs, names, descriptions and categories.
It validates structured output against those IDs, and the renderer rechecks the
current enabled saved routine before the user can run it. The model cannot create
or execute actions. Ambiguous, unmatched, stale, invalid and failed requests have
no side effects. See [AI_ROUTING.md](AI_ROUTING.md) for setup, contracts, privacy,
security, troubleshooting and provider-extension details.

Speech recognition and wake-word detection are still planned and currently
simulated in the Test Lab. A future speech recognizer can feed its transcript to
the same router, but it must preserve explicit confirmation and all current
validation boundaries.

## Execution contract

`executeRoutine({ id, runId?, steps })` returns:

```ts
{ success: boolean; runId: string; error?: string; code?: string; stepIndex?: number }
```

Progress and completion events include the run ID. Renderers generate a fresh
ID for each intentional run and use it when cancelling. Retrying the same run
ID from the same renderer returns the pending/cached result rather than
executing the routine again. The cache retains the last 32 results and lasts
only for this application session, not across process restarts.

Only one routine executes at a time across all windows. A cancelled run must
settle before another starts. Renderer destruction/navigation and application
quit cancel its execution. Native dialogs receive the same AbortSignal and
are parented to the main window rather than the non-focusable Island.

Preflight validates all block parameters and required helper availability
before the first side effect. Files/apps/devices can still disappear later;
handlers check relevant state when they execute. Preflight is not a transaction
and does not guarantee future filesystem/device availability.

Stop interrupts waits, helper processes, commands and confirmation dialogs.
Completed actions are not undone. Already-started OS operations may complete;
scheduled shutdowns must be cancelled with the dedicated block.

## Native build and packaging

`npm run build:electron` compiles TypeScript and builds the Windows helper.
`npm run electron:dev` rebuilds both before launching, so stale backend code
is not silently loaded.

The helper targets built-in Windows .NET Framework 4.x and is compiled using
its installed C# compiler. No .NET SDK, NuGet packages or native Node addon ABI
rebuild is required. Windows 10/11 installations normally include this runtime.
Build output is `dist-electron/native/Flowy.Windows.exe`.

For a packaged Electron application, copy this executable to
`resources/native/Flowy.Windows.exe` outside ASAR. The native adapter resolves
that exact resource path. An installer/packager is not configured in this repo
yet. Code-sign the helper together with the desktop application when shipping.

The helper receives one JSON request per process and returns one bounded JSON
response. This keeps COM/UI Automation failures isolated from Electron.
Parameters are never interpolated into a shell command.

## Windows-specific behavior

### Audio

Volume and mute use `IMMDeviceEnumerator` and `IAudioEndpointVolume`.
Speaker operations target the default multimedia render endpoint; microphone
operations target the default communications capture endpoint. Volume accepts
0 to 100, including zero. Every set operation reads the applied state back.
Missing devices and unsupported audio drivers produce actionable errors.

### Focus Assist / Do not disturb (temporarily disabled)

The registered handler currently skips this block and emits a `skipped`
progress event with a note. This applies to explicit and legacy focus blocks.
It does not open Settings, invoke the helper, wait for the block delay, or
change DND. Later blocks continue normally. Editor and Island show Skipped
rather than Done. The native adapter below is retained but not called.

Microsoft exposes no supported public setter for the OS-wide mode. This
adapter opens `ms-settings:quiethours` on Windows 10 or
`ms-settings:notifications` on Windows 11 and uses public UI Automation.

Windows 10 uses the profile's stable automation ID and SelectionItemPattern.
Windows 11 uses TogglePattern for the specific Do not disturb control.
Exact English/Indonesian labels are fallback selectors where an automation
ID is unavailable. Other builds/languages may expose different controls.

The adapter reads back the control state and reports success only when it
matches. It leaves Settings open, never rewrites registry blobs, restarts
Explorer, toggles a generic notification switch or uses undocumented WNF APIs.
If the control cannot be located/verified, it reports an explicit failure.
Automatic Windows rules may subsequently change the state.

There are currently 26 active palette handlers and one deliberately skipped
Focus Assist handler. The retained native Focus adapter is not considered
universally supported across arbitrary Windows builds/languages.

### Files

Absolute local paths only; reserved Windows names, device/UNC paths, drive-root
mutation, symbolic links and junction paths are rejected. Rename/move use
Windows FileSystem operations, including cross-drive move support. Existing
destinations are refused. Source/destination can still be changed concurrently
by another program; Flowy is not a filesystem locking service.

Copy first writes to a unique staging path beside the destination, checks
cancellation during traversal and publishes only after the copy finishes.
A failed/cancelled copy cleans up its own staging path, never deletes the source
or an unrelated destination. Nested symbolic links are rejected.

Delete uses Recycle Bin with explicit confirmation; it does not fall back to
permanent deletion when recycling fails.

### Apps, power and notifications

App launch uses Windows shell application resolution, including App Paths.
Close requests normal closure of processes with visible app windows, ignoring
Chromium/Electron helper processes, and waits up to 10 seconds for windows to
close. A save dialog or refusing window is an error, not forced termination.
Apps that minimize to tray may retain background processes. An already-closed
window is considered success.

Power commands use absolute System32 executable paths. Shutdown/restart retain
a 60-second Windows countdown and require confirmation. Legacy shutdown-timer
blocks retain their explicitly parsed countdown. Legacy sleep blocks now use
the actual Windows suspend API, not shutdown.

Notifications use a stable AUMID. Delivery remains best-effort: Windows DND,
user settings and group policy can suppress a toast. Success means submission
to the OS, not proof the user saw it.

## Verification for this change

Build and renderer/Electron typecheck, small native read-only smoke checks
(protocol/capabilities and audio state), catalog/handler coverage, and one native
file-move smoke using a disposable temporary fixture. No Playwright suite,
setting toggle, or risky system-action test is run for this change.

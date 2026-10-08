# AI workspace routing

Flowy’s **Ask Flowy** chat lets a user describe what they want to do and asks Gemini to recommend one existing enabled routine. In this feature, “workspace” means a saved Flowy routine, not a Windows virtual desktop.

The AI never creates actions and never executes a routine. The user must review the local routine card and press **Run routine**. Existing execution validation and confirmations remain authoritative.

## What you must provide

You need a Gemini Developer API key. A Google account and an API key from Google AI Studio are the only required values for the default setup.

1. Open [Google AI Studio API keys](https://aistudio.google.com/app/apikey).
2. Create or select a Google Cloud project and create an API key.
3. Before launching Flowy, set this environment variable:

```text
FLOWY_GEMINI_API_KEY=your_real_api_key_here
```

Flowy defaults to `gemini-2.5-flash`. To choose another Gemini model that supports JSON structured output, optionally set:

```text
FLOWY_GEMINI_MODEL=gemini-2.5-flash
```

Do not add either value to `VITE_*`, React code, Git, screenshots, or renderer localStorage. Vite variables are bundled into the renderer and are not secret.

### Launch examples

PowerShell, for the current terminal session:

```powershell
$env:FLOWY_GEMINI_API_KEY = "paste-your-key-here"
$env:FLOWY_GEMINI_MODEL = "gemini-2.5-flash" # optional
npm run dev
```

Windows Command Prompt:

```bat
set FLOWY_GEMINI_API_KEY=paste-your-key-here
set FLOWY_GEMINI_MODEL=gemini-2.5-flash
npm run dev
```

Linux/macOS development:

```bash
FLOWY_GEMINI_API_KEY='paste-your-key-here' npm run dev
```

Restart Flowy after changing the environment. The current MVP intentionally does not load a `.env` file or provide an in-app key store. A packaged build must receive these environment variables from its launcher, or future development must add OS-protected credential storage. Never ship one shared developer key inside the app.

Google documentation:

- [Get a Gemini API key](https://ai.google.dev/gemini-api/docs/api-key)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Pricing and free-tier details](https://ai.google.dev/gemini-api/docs/pricing)
- [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

Google controls eligible models, regions, quotas, pricing, and data-use terms. “Free tier” does not mean unlimited or permanently free. Check the official pages before release and avoid billing-enabled projects unless intended.

## User flow

1. The renderer takes the text entered in **Ask Flowy**.
2. It projects enabled routines to ID, name, description, and category only.
3. Electron main sends those values to Gemini.
4. Gemini returns `match`, `ambiguous`, or `no_match` as structured JSON.
5. Electron validates the schema and every returned ID against the submitted allowlist.
6. Flowy shows a local recommendation. Ambiguity requires the user to select a candidate.
7. The user presses **Run routine**.
8. Flowy verifies that the current local routine still exists, is enabled, and has not changed, then passes it to the existing Island and `ExecutionEngine`.

No match, malformed output, unknown IDs, provider errors, and cancellation execute nothing. The name-matching Test Lab and simulated voice flow are not fallbacks.

## Architecture

```text
WorkspaceChat (renderer)
  -> context-isolated preload: ai:configuration / ai:route / ai:cancel
  -> trusted main-window IPC
  -> router validation and lifecycle
  -> Gemini REST adapter
  -> strict decision + routine-ID allowlist validation
  -> renderer confirmation
  -> existing showIsland -> DynamicIsland -> ExecutionEngine
```

Source responsibilities:

- `src/components/chat/WorkspaceChat.tsx`: accessible text UI, result display, confirmation, stale-routine checks.
- `src/components/landing/LandingPage.tsx`: home-page integration.
- `src/types/ai.ts`: renderer routing contracts.
- `electron/preload.ts`: narrow context-isolated bridge.
- `electron/ipc/aiIpc.ts`: main-window trust, one pending request per renderer, ownership and cancellation.
- `electron/backend/ai/router.ts`: configuration, bounds, timeout and output allowlist validation.
- `electron/backend/ai/providers/gemini.ts`: Gemini HTTPS request and provider error mapping.
- `electron/backend/ai/types.ts`: Electron-side routing contracts.
- `electron/backend/engine.ts`: existing routine execution; the AI router cannot bypass it.

Types are duplicated across the renderer and Electron TypeScript projects because `tsconfig.electron.json` deliberately has `electron/` as its root. Keep both contracts synchronized when modifying IPC.

## IPC contract

Request:

```ts
{
  requestId: string;
  text: string;
  routines: Array<{
    id: string;
    name: string;
    description?: string;
    category?: string;
  }>;
}
```

Successful decision:

```ts
{ ok: true, requestId, decision: { status: "match", routineId } }
{ ok: true, requestId, decision: { status: "ambiguous", candidateIds } }
{ ok: true, requestId, decision: { status: "no_match" } }
```

Failure:

```ts
{
  ok: false,
  requestId,
  code: "NOT_CONFIGURED" | "INVALID_REQUEST" | "AUTHENTICATION" |
        "RATE_LIMITED" | "TIMEOUT" | "OFFLINE" | "INVALID_RESPONSE" |
        "CANCELLED" | "PROVIDER_ERROR",
  error: string
}
```

Current limits:

- Command: 1–2,000 trimmed characters.
- Candidates: 1–100 unique routines.
- ID: 128 characters; name: 160; description: 500; category: 50.
- Ambiguous result: 2–5 unique supplied IDs.
- Provider timeout: 15 seconds.
- Provider response: 32 KiB.
- One pending route request per main renderer. A later request aborts the earlier request.

Only the trusted main window can call AI IPC. Island windows cannot route. Navigation, renderer destruction, app shutdown, explicit cancel, and replacement requests abort pending work. Request IDs prevent late results from replacing current UI.

## Prompt and response safety

The system instruction says that routine metadata and user text are untrusted data, only supplied IDs may be selected, and the model must not invent actions. Gemini structured output is enabled, but output is still validated locally because schema-constrained generation is not authorization.

Only these values leave the device:

- User-entered request text.
- IDs, names, descriptions, and categories of enabled routines.

Steps, PowerShell, executable parameters, file paths, clipboard data, local chat history, and disabled routines are not sent. Users can still place sensitive data in a routine name/description or prompt; the UI discloses transmission. Consult Google’s current service and data-use terms before distribution.

Raw prompts and API keys are not logged by this implementation. Provider response bodies are not exposed to the renderer on errors. HTTP statuses are mapped to sanitized messages.

Renderer `localStorage` remains the current routine source of truth. The recommendation stores a local signature. Deletion, disabling, or editing before confirmation invalidates Run and requires a new request. The execution engine still handles action preflight, destructive-action confirmation, cancellation, and global single-run ownership.

## Troubleshooting

- **“AI is not configured”**: set `FLOWY_GEMINI_API_KEY` in the same environment that launches Electron, then restart.
- **API key rejected**: create/check the AI Studio key, project restrictions, Gemini API availability, and regional support.
- **Quota exhausted**: wait for quota reset, inspect Google’s rate-limit dashboard, or use an appropriately billed project. Flowy does not auto-retry.
- **Model/provider error**: verify `FLOWY_GEMINI_MODEL`. Remove it to use the default. Model names and availability can change.
- **Offline/timeout**: verify network access to `generativelanguage.googleapis.com` and retry manually.
- **Invalid response**: retry once; if persistent, confirm the model supports structured output and review the provider adapter against current Gemini API documentation.
- **Ambiguous**: choose one offered local candidate. The AI does not guess.
- **No match**: rephrase with the desired activity or create/enable a suitable routine.
- **Routine changed**: ask again so the latest saved routine is reviewed.
- **Browser preview**: AI routing requires Electron because credentials and network access belong in the main process.

## Development and validation

```bash
npm ci
npm run typecheck
npm run test:ai-router # mocked; uses no API quota and executes no routine
npm run build:renderer
npm run build:electron # Windows native helper build requires Windows tooling
```

For a live routing smoke test, set the API key, run `npm run dev`, enter a phrase, and inspect the recommendation. Do **not** press Run if the selected routine contains system actions you do not want to execute. Automated tests should mock the provider and cover invented IDs, malformed JSON, injection-like metadata, ambiguity, timeout, cancellation, stale routines and duplicate submission without invoking OS actions.

## Adding another provider

Implement an adapter matching the `routeWithGemini` role: accept bounded text, metadata and an `AbortSignal`; return untrusted structured output; never execute actions. Add provider configuration in Electron main, map errors to the existing safe codes, and keep `router.ts` as the provider-independent validation boundary. Ollama is a likely future local-only option.

## Not implemented

Real speech recognition, wake-word detection, automatic activation, conversational memory, AI-created actions/scripts, embeddings, cloud routine storage, in-app API-key management and a local Ollama adapter remain future work.

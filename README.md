# Flowy

Flowy is a Windows app that turns everyday tasks into simple routines. Switch between work, study, meetings, or gaming without repeating the same clicks.

For example, create a **Start Work** routine to open your apps, launch your favorite websites, and adjust the volume. Run it once, and Flowy takes care of each step.

## How to use

1. Open Flowy and choose **New Routine**.
2. Give it a name, choose an icon, then click **Save**.
3. Add the actions you need and arrange them in order.
4. Try **Test Run**, then save your routine.
5. Run it from your routine list and follow its progress in the small panel at the top of your screen.

## Ask Flowy AI setup

The home-page chat can recommend an existing enabled routine from a typed request. It uses the Gemini Developer API and always asks you to confirm before anything runs.

Create a key at [Google AI Studio](https://aistudio.google.com/app/apikey), set it before launching Flowy, and restart the app:

```powershell
$env:FLOWY_GEMINI_API_KEY = "paste-your-key-here"
npm run dev
```

The optional `FLOWY_GEMINI_MODEL` setting defaults to `gemini-2.5-flash`. Never put the key in a `VITE_*` variable or commit it. Free-tier models and quotas are controlled by Google and may change.

See [AI workspace routing](docs/AI_ROUTING.md) for architecture, privacy, security, troubleshooting, and development guidance. Backend execution details are in [docs/BACKEND.md](docs/BACKEND.md).

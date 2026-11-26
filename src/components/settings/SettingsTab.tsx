import { FC, KeyboardEvent, useEffect, useState } from "react";
import { Check, Download, ExternalLink, Keyboard, Layers, Loader2, Monitor, RefreshCw } from "lucide-react";
import { AppSettingsData, IslandIdleMode, UpdaterStatusData } from "../../types/electron";
import { sound } from "../../utils/soundEffects";

interface SettingsTabProps {
  settings: AppSettingsData;
  onUpdate: (patch: Partial<AppSettingsData>) => Promise<{ ok: boolean; error?: string }>;
}

const HOTKEY_PRESETS = [
  { label: "Ctrl + Space", value: "CommandOrControl+Space" },
  { label: "Alt + Space", value: "Alt+Space" },
  { label: "Ctrl + Shift + Space", value: "CommandOrControl+Shift+Space" },
  { label: "Alt + V", value: "Alt+V" },
];

export function formatHotkeyLabel(accelerator: string): string {
  return accelerator
    .replace(/CommandOrControl/g, "Ctrl")
    .replace(/\+/g, " + ");
}

function keyEventToAccelerator(event: KeyboardEvent<HTMLButtonElement>): string | null {
  const ignored = ["Control", "Shift", "Alt", "Meta", "OS"];
  if (ignored.includes(event.key)) return null;

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("CommandOrControl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (parts.length === 0) return null;

  let key = event.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
}

export const SettingsTab: FC<SettingsTabProps> = ({ settings, onUpdate }) => {
  const [recordingKey, setRecordingKey] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [updater, setUpdater] = useState<UpdaterStatusData | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getUpdaterStatus) return;
    api.getUpdaterStatus().then(setUpdater).catch(() => {});
    return api.onUpdaterStatus(setUpdater);
  }, []);

  const handleModeChange = async (mode: IslandIdleMode) => {
    sound.playPop(520);
    setFeedback(null);
    const res = await onUpdate({ islandIdleMode: mode });
    if (!res.ok && res.error) {
      setFeedback({ type: "error", text: res.error });
    }
  };

  const handleHotkeySelect = async (accelerator: string) => {
    sound.playPop(540);
    setRecordingKey(false);
    setFeedback(null);
    const res = await onUpdate({ masterHotkey: accelerator });
    if (res.ok) {
      setFeedback({ type: "ok", text: `Master hotkey updated to ${formatHotkeyLabel(accelerator)}.` });
    } else {
      setFeedback({ type: "error", text: res.error || "Could not update hotkey." });
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recordingKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecordingKey(false);
      return;
    }
    const accel = keyEventToAccelerator(event);
    if (accel) {
      void handleHotkeySelect(accel);
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Dynamic Island Idle Visibility */}
      <section className="rounded-3xl border-2 border-cream-border bg-white p-5 shadow-tactile-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blueberry-light text-blueberry-dark">
            <Layers size={20} />
          </span>
          <div>
            <h3 className="text-base font-black text-ink">Dynamic Island Idle Visibility</h3>
            <p className="text-xs font-semibold text-ink-muted">
              Choose how the idle &ldquo;Flowy · Ready&rdquo; notch behaves when you aren&apos;t running a voice command.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void handleModeChange("always-on-top")}
            className={[
              "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all",
              settings.islandIdleMode === "always-on-top"
                ? "border-blueberry-dark bg-blueberry-light/70"
                : "border-cream-border bg-cream hover:border-blueberry-dark/40",
            ].join(" ")}
          >
            <Monitor size={18} className="mt-0.5 shrink-0 text-blueberry-dark" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-ink">Always on top</span>
                {settings.islandIdleMode === "always-on-top" && (
                  <Check size={16} className="text-blueberry-dark" />
                )}
              </div>
              <p className="mt-1 text-xs font-semibold text-ink-muted">
                Stays visible at the top edge above all apps.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => void handleModeChange("desktop-only")}
            className={[
              "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all",
              settings.islandIdleMode === "desktop-only"
                ? "border-blueberry-dark bg-blueberry-light/70"
                : "border-cream-border bg-cream hover:border-blueberry-dark/40",
            ].join(" ")}
          >
            <Layers size={18} className="mt-0.5 shrink-0 text-blueberry-dark" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-black text-ink">Desktop only (non-intrusive)</span>
                {settings.islandIdleMode === "desktop-only" && (
                  <Check size={16} className="text-blueberry-dark" />
                )}
              </div>
              <p className="mt-1 text-xs font-semibold text-ink-muted">
                Sits behind other app windows when idle so it won&apos;t block browser tabs. Pops on top when active.
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* 2. Master Global Hotkey */}
      <section className="rounded-3xl border-2 border-cream-border bg-white p-5 shadow-tactile-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-grape-light text-purple-800">
            <Keyboard size={20} />
          </span>
          <div>
            <h3 className="text-base font-black text-ink">Master Voice Hotkey</h3>
            <p className="text-xs font-semibold text-ink-muted">
              Global shortcut to start, stop, or cancel Flowy from anywhere on Windows.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {HOTKEY_PRESETS.map((preset) => {
            const active = settings.masterHotkey === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => void handleHotkeySelect(preset.value)}
                className={[
                  "rounded-2xl border-2 px-3.5 py-2 text-xs font-extrabold transition-all",
                  active
                    ? "border-grape bg-grape text-white shadow-sm"
                    : "border-cream-border bg-cream text-ink hover:border-grape/50",
                ].join(" ")}
              >
                {preset.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setRecordingKey((prev) => !prev)}
            onKeyDown={handleKeyDown}
            onBlur={() => setRecordingKey(false)}
            className={[
              "rounded-2xl border-2 px-3.5 py-2 text-xs font-extrabold transition-all",
              recordingKey
                ? "border-strawberry bg-strawberry text-white animate-pulse"
                : "border-dashed border-ink-muted/50 bg-white text-ink hover:border-grape",
            ].join(" ")}
          >
            {recordingKey
              ? "Press shortcut (e.g. Ctrl+Shift+F)..."
              : `Custom (${formatHotkeyLabel(settings.masterHotkey)})`}
          </button>
        </div>

        {feedback && (
          <p
            className={[
              "mt-3 text-xs font-bold",
              feedback.type === "error" ? "text-strawberry" : "text-mint-dark",
            ].join(" ")}
          >
            {feedback.text}
          </p>
        )}
      </section>

      {/* 3. App Version & Updates */}
      {window.electronAPI && (
        <section className="rounded-3xl border-2 border-cream-border bg-white p-5 shadow-tactile-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint-light text-mint-dark">
                <RefreshCw size={19} />
              </span>
              <div>
                <h3 className="text-base font-black text-ink">
                  Flowy Desktop <span className="text-ink-muted font-bold">v{updater?.currentVersion || "1.0.0"}</span>
                </h3>
                <p className="text-xs font-semibold text-ink-muted">
                  {updater?.message || "Check GitHub Releases for new updates or download manually."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {updater?.state === "available" ? (
                <button
                  type="button"
                  onClick={() => void window.electronAPI?.downloadUpdate()}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-mint px-3.5 py-2 text-xs font-black text-white shadow-sm hover:brightness-105"
                >
                  <Download size={14} />
                  <span>Download v{updater.latestVersion}</span>
                </button>
              ) : updater?.state === "downloading" ? (
                <span className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-cream-border bg-cream px-3.5 py-2 text-xs font-bold text-blueberry-dark">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Downloading {updater.downloadPercent ?? 0}%</span>
                </span>
              ) : updater?.state === "downloaded" ? (
                <button
                  type="button"
                  onClick={() => window.electronAPI?.installUpdate()}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-strawberry px-3.5 py-2 text-xs font-black text-white shadow-sm hover:brightness-105"
                >
                  <span>Restart &amp; Update</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void window.electronAPI?.checkForUpdates()}
                  disabled={updater?.state === "checking"}
                  className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-cream-border bg-cream px-3.5 py-2 text-xs font-extrabold text-ink hover:bg-mint-light disabled:opacity-60"
                >
                  <RefreshCw size={13} className={updater?.state === "checking" ? "animate-spin" : ""} />
                  <span>{updater?.state === "checking" ? "Checking..." : "Check for updates"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => window.electronAPI?.openReleasesPage()}
                className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-cream-border bg-white px-3 py-2 text-xs font-extrabold text-ink-muted hover:text-ink"
              >
                <ExternalLink size={13} />
                <span>Manual download</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

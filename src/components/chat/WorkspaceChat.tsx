import { FC, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { Routine, RouteDecision } from "../../types";
import { PushButton } from "../common/PushButton";

interface WorkspaceChatProps {
  routines: Routine[];
  onActivate: (routine: Routine) => void;
  isAppBusy: boolean;
}

type ResultState =
  | { kind: "idle" }
  | { kind: "loading"; requestId: string }
  | { kind: "decision"; decision: RouteDecision; signatures: Record<string, string> }
  | { kind: "error"; message: string };

const examples = ["I want to focus on coding", "Waktunya mabar"];
const signature = (routine: Routine) => JSON.stringify(routine);

export const WorkspaceChat: FC<WorkspaceChatProps> = ({ routines, onActivate, isAppBusy }) => {
  const [text, setText] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const activeRequest = useRef<string | null>(null);
  const enabledRoutines = useMemo(() => routines.filter((routine) => routine.enabled), [routines]);

  useEffect(() => {
    let mounted = true;
    const api = window.electronAPI;
    if (!api) { setConfigured(false); return; }
    api.getAiConfiguration().then((status) => {
      if (mounted) setConfigured(status.configured);
    }).catch(() => { if (mounted) setConfigured(false); });
    return () => {
      mounted = false;
      if (activeRequest.current) api.cancelIntentRoute(activeRequest.current);
    };
  }, []);

  const submit = async () => {
    const prompt = text.trim();
    const api = window.electronAPI;
    if (!prompt || prompt.length > 2000 || !api || !configured || !enabledRoutines.length || result.kind === "loading") return;
    const requestId = crypto.randomUUID();
    activeRequest.current = requestId;
    setLastPrompt(prompt);
    setResult({ kind: "loading", requestId });
    try {
      const response = await api.routeIntent({
        requestId,
        text: prompt,
        routines: enabledRoutines.map(({ id, name, description, category }) => ({ id, name, description, category })),
      });
      if (activeRequest.current !== requestId || response.requestId !== requestId) return;
      if (!response.ok) {
        setResult({ kind: "error", message: response.error });
      } else {
        const ids = response.decision.status === "match" ? [response.decision.routineId]
          : response.decision.status === "ambiguous" ? response.decision.candidateIds : [];
        const signatures = Object.fromEntries(ids.map((id) => {
          const routine = enabledRoutines.find((item) => item.id === id);
          return [id, routine ? signature(routine) : "missing"];
        }));
        setResult({ kind: "decision", decision: response.decision, signatures });
      }
    } catch {
      if (activeRequest.current === requestId) setResult({ kind: "error", message: "Flowy could not contact the AI router." });
    } finally {
      if (activeRequest.current === requestId) activeRequest.current = null;
    }
  };

  useEffect(() => {
    if (result.kind !== "decision" || result.decision.status === "no_match") return;
    const ids = result.decision.status === "match" ? [result.decision.routineId] : result.decision.candidateIds;
    const changed = ids.some((id) => {
      const current = routines.find((routine) => routine.id === id && routine.enabled);
      return !current || result.signatures[id] !== signature(current);
    });
    if (changed) setResult({ kind: "error", message: "A suggested routine changed or was disabled. Ask Flowy again for a fresh recommendation." });
  }, [routines]);

  const clear = () => {
    if (activeRequest.current) window.electronAPI?.cancelIntentRoute(activeRequest.current);
    activeRequest.current = null;
    setText("");
    setLastPrompt("");
    setResult({ kind: "idle" });
  };

  const selectCandidate = (id: string) => {
    if (result.kind !== "decision") return;
    setResult({ kind: "decision", decision: { status: "match", routineId: id }, signatures: result.signatures });
  };

  const activate = (id: string) => {
    if (result.kind !== "decision" || isAppBusy) return;
    const current = routines.find((routine) => routine.id === id && routine.enabled);
    if (!current || result.signatures[id] !== signature(current)) {
      setResult({ kind: "error", message: "This routine changed or was disabled. Ask Flowy again before running it." });
      return;
    }
    setResult({ kind: "idle" });
    setLastPrompt("");
    onActivate(current);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const matchedId = result.kind === "decision" && result.decision.status === "match" ? result.decision.routineId : undefined;
  const matchedRoutine = matchedId ? routines.find((routine) => routine.id === matchedId) : undefined;
  const staleMatch = Boolean(matchedRoutine && result.kind === "decision" &&
    result.signatures[matchedRoutine.id] !== signature(matchedRoutine));

  return (
    <section className="rounded-3xl border-2 border-grape-dark/30 bg-white p-4 sm:p-5 shadow-tactile-card" aria-labelledby="workspace-chat-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-grape text-white shadow-[0_3px_0_#A855F7]"><Bot size={23} /></span>
          <div><h3 id="workspace-chat-title" className="font-black text-ink">Ask Flowy</h3><p className="text-xs font-semibold text-ink-muted">Tell me what you want to do. I’ll find a saved routine.</p></div>
        </div>
        {(lastPrompt || text) && <button onClick={clear} className="rounded-xl p-2 text-ink-muted hover:bg-cream" aria-label="Clear AI chat"><X size={17} /></button>}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs font-extrabold text-ink">What do you want to do?
          <textarea value={text} maxLength={2000} rows={2} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown}
            placeholder="For example: Set me up for coding"
            className="mt-1.5 w-full resize-none rounded-2xl border-2 border-cream-border bg-cream px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-grape" />
        </label>
        <PushButton variant="grape" icon={result.kind === "loading" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          disabled={!text.trim() || text.length > 2000 || result.kind === "loading" || configured !== true || !enabledRoutines.length}
          onClick={() => void submit()}>{result.kind === "loading" ? "Thinking" : "Ask AI"}</PushButton>
      </div>

      <div className="mt-2 flex flex-wrap gap-2" aria-label="Example requests">
        {examples.map((example) => <button key={example} type="button" onClick={() => setText(example)} className="rounded-xl bg-grape-light px-2.5 py-1 text-[11px] font-bold text-purple-800 hover:brightness-95">{example}</button>)}
      </div>

      <div className="mt-3 text-xs font-semibold" aria-live="polite">
        {!window.electronAPI && <p className="rounded-2xl bg-sunny-light p-3 text-amber-900">AI routing is available in the Electron desktop app.</p>}
        {window.electronAPI && configured === false && <p className="rounded-2xl bg-sunny-light p-3 text-amber-900">AI is not configured. Set <code>FLOWY_GEMINI_API_KEY</code> before starting Flowy.</p>}
        {!enabledRoutines.length && <p className="rounded-2xl bg-sunny-light p-3 text-amber-900">Create or enable a routine before asking Flowy.</p>}
        {lastPrompt && result.kind !== "idle" && <p className="mb-2 rounded-2xl bg-cream p-3 text-ink"><span className="text-ink-muted">You:</span> {lastPrompt}</p>}
        {result.kind === "loading" && <p className="flex items-center gap-2 rounded-2xl bg-grape-light p-3 text-purple-900"><Sparkles size={15} /> Comparing your request with enabled routines…</p>}
        {result.kind === "error" && <div className="flex items-center justify-between gap-3 rounded-2xl bg-strawberry-light p-3 text-red-900"><span>{result.message}</span><button onClick={() => setResult({ kind: "idle" })} aria-label="Dismiss error"><X size={15} /></button></div>}
        {result.kind === "decision" && result.decision.status === "no_match" && <div className="rounded-2xl bg-blueberry-light p-3 text-blue-900">I couldn’t find a suitable enabled routine. Try rephrasing your request.</div>}
        {result.kind === "decision" && result.decision.status === "ambiguous" && <div className="rounded-2xl bg-sunny-light p-3 text-amber-950"><p className="mb-2 font-black">A few routines could fit. Which one?</p><div className="flex flex-wrap gap-2">{result.decision.candidateIds.map((id) => { const routine = routines.find((item) => item.id === id); return routine ? <button key={id} onClick={() => selectCandidate(id)} className="rounded-xl border-2 border-sunny-dark bg-white px-3 py-2 font-extrabold">{routine.icon} {routine.name}</button> : null; })}</div></div>}
        {result.kind === "decision" && result.decision.status === "match" && matchedRoutine && <div className="rounded-2xl border-2 border-mint-dark/40 bg-mint-light p-3 text-ink"><p className="font-black">Suggested workspace: {matchedRoutine.icon} {matchedRoutine.name}</p><p className="mt-1 text-ink-muted">{matchedRoutine.description || `${matchedRoutine.steps.length} saved steps`}</p>{staleMatch && <p className="mt-2 text-red-700">This routine changed. Ask again to review the latest version.</p>}<div className="mt-3 flex flex-wrap gap-2"><PushButton size="sm" variant="mint" disabled={isAppBusy || staleMatch} onClick={() => activate(matchedRoutine.id)}>Run routine</PushButton><PushButton size="sm" variant="ghost" onClick={clear}>Dismiss</PushButton>{isAppBusy && <span className="self-center text-ink-muted">Another routine is active.</span>}</div></div>}
      </div>
      <p className="mt-3 text-[10px] font-semibold text-ink-muted">Your request and enabled routine names/descriptions are sent to Gemini. AI only recommends; you choose whether to run.</p>
    </section>
  );
};

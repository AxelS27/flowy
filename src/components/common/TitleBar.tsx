import { FC } from "react";
import { Minus, X } from "lucide-react";

interface TitleBarProps {
  isListening?: boolean;
}

export const TitleBar: FC<TitleBarProps> = ({ isListening = false }) => {
  const handleMinimize = () => {
    (window as any).electronAPI?.minimize();
  };

  const handleClose = () => {
    (window as any).electronAPI?.close();
  };

  return (
    <header
      className="h-10 bg-cream-card border-b-2 border-cream-border flex items-center justify-between px-4 select-none z-50 sticky top-0"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* Brand & Subtle Status */}
      <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: "no-drag" } as any}>
        <span className="text-base">✨</span>
        <span className="font-black text-sm tracking-tight text-ink">
          Flo<span className="text-strawberry">wy</span>
        </span>

        {isListening && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-strawberry-light rounded-full border border-strawberry-dark text-[10px] font-extrabold text-strawberry-dark animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-strawberry animate-ping" />
            <span>Listening...</span>
          </span>
        )}
      </div>

      {/* Draggable Empty Center Space */}
      <div className="flex-1 h-full" />

      {/* Minimal Window Controls */}
      <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: "no-drag" } as any}>
        <button
          onClick={handleMinimize}
          className="w-6 h-6 rounded-lg bg-cream hover:bg-slate-200 border border-cream-border flex items-center justify-center text-ink-muted hover:text-ink transition-colors"
          title="Minimize"
        >
          <Minus size={11} strokeWidth={2.5} />
        </button>
        <button
          onClick={handleClose}
          className="w-6 h-6 rounded-lg bg-cream hover:bg-strawberry hover:text-white border border-cream-border hover:border-strawberry-dark flex items-center justify-center text-ink-muted transition-colors"
          title="Close"
        >
          <X size={11} strokeWidth={2.5} />
        </button>
      </div>
    </header>
  );
};

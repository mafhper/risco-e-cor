import { useEffect, useState } from "react";
import { Hand, MousePointerClick, Palette, PenLine } from "lucide-react";
import { useStore } from "./store";
import { useReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

/**
 * The demo is a HAND, never a sentence (sem-texto-3-5 F1). It loops over the
 * door the child should try, and any real touch ends it — the first
 * `pointerdown` fades it out in 150 ms instead of waiting for the next screen.
 *
 * With `prefers-reduced-motion` the movement becomes three still frames
 * (door → stroke → color), because the demonstration is information and only
 * its motion is decoration.
 */

type Phase = "on" | "fading" | "gone";

/**
 * Per-screen demo: it appears when the screen opens and stops on the first
 * touch of THAT screen. Nothing is persisted — the next screen has its own
 * demonstration, and the adult switch (`settings.demo`) is the global off.
 */
function useDemoPhase(enabled: boolean): Phase {
  const [phase, setPhase] = useState<Phase>("on");

  useEffect(() => {
    if (!enabled || phase !== "on") return;
    const stop = () => setPhase("fading");
    window.addEventListener("pointerdown", stop, { once: true, capture: true });
    return () => window.removeEventListener("pointerdown", stop, true);
  }, [enabled, phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const timer = setTimeout(() => setPhase("gone"), 150);
    return () => clearTimeout(timer);
  }, [phase]);

  return phase;
}

export function DemoHint({
  kind,
  className,
  testid,
}: {
  kind: "home" | "canvas";
  className?: string;
  testid?: string;
}) {
  const { state } = useStore();
  const enabled = state.settings.demo;
  const reduced = useReducedMotion();
  const phase = useDemoPhase(enabled);
  if (!enabled || phase === "gone") return null;

  return (
    <div
      role="presentation"
      aria-hidden
      data-testid={testid ?? `ghost-${kind}`}
      data-ghost={phase === "on" ? "on" : "gone"}
      className={cn(
        "pointer-events-none absolute z-30 flex items-center justify-center transition-opacity duration-150",
        phase === "fading" && "opacity-0",
        className,
      )}
    >
      {reduced ? (
        <DemoFrames />
      ) : kind === "home" ? (
        <span className="relative flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 animate-ghost-ring rounded-full border-2 border-ambar/70" />
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ambar/90 text-[#1c1b1a] shadow-tile animate-ghost-bob">
            <Hand className="h-7 w-7" strokeWidth={2} />
          </span>
        </span>
      ) : (
        <span className="relative flex h-24 w-24 items-center justify-center">
          <svg viewBox="0 0 96 96" className="absolute inset-0 h-full w-full" aria-hidden>
            <path
              d="M12 70 Q30 22 62 40 T88 26"
              fill="none"
              stroke="var(--pigmento)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="8 7"
              className="animate-ghost-trace"
            />
          </svg>
          <span className="absolute bottom-0 left-0 flex h-12 w-12 items-center justify-center rounded-full bg-ambar/90 text-[#1c1b1a] shadow-tile animate-ghost-bob">
            <Hand className="h-6 w-6" strokeWidth={2} />
          </span>
        </span>
      )}
    </div>
  );
}

/** `prefers-reduced-motion`: the same lesson as three still frames. */
function DemoFrames() {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-card/95 p-1.5 shadow-tile">
      {[MousePointerClick, PenLine, Palette].map((Icon, i) => (
        <span
          key={i}
          data-demo-frame={i + 1}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground"
        >
          <Icon className="h-5 w-5" />
        </span>
      ))}
    </span>
  );
}

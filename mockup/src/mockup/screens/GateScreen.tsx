import { useEffect, useRef, useState } from "react";
import { Delete, Hand, X } from "lucide-react";
import { GATE_HOLD_MS, isCorrect, makeChallenge, type GateChallenge } from "../gate";
import { useStore, type Screen } from "../store";
import { RoundButton } from "../ui";
import { cn } from "@/lib/utils";

/**
 * Parental gate. It is a navigation barrier, not authentication: the target
 * decides which adult section opens, and closing returns to where the gate
 * was opened from (Home for the global tutor, Perfil for that child's
 * settings).
 */
export function GateScreen({ target, back }: { target: "global" | "profile"; back: Screen }) {
  const { go, dispatch } = useStore();
  const [step, setStep] = useState<"hold" | "math">("hold");
  const [progress, setProgress] = useState(0);
  const [challenge, setChallenge] = useState<GateChallenge>({ a: 12, b: 7 });
  const [answer, setAnswer] = useState("");
  const [shake, setShake] = useState(false);
  const raf = useRef<number | null>(null);
  const start = useRef(0);

  useEffect(() => setChallenge(makeChallenge()), []);
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  const close = () => go(back);

  const tick = () => {
    const p = Math.min(1, (performance.now() - start.current) / GATE_HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      raf.current = null;
      setStep("math");
      return;
    }
    raf.current = requestAnimationFrame(tick);
  };
  const holdStart = () => {
    start.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  };
  const holdEnd = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (step === "hold") setProgress(0);
  };

  const press = (k: string) => {
    if (k === "del") return setAnswer((a) => a.slice(0, -1));
    if (k === "ok") {
      if (isCorrect(challenge, answer))
        return dispatch({ type: "go", screen: { name: "adult", focus: target, back } });
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setAnswer("");
      setChallenge(makeChallenge());
      return;
    }
    setAnswer((a) => (a.length < 3 ? a + k : a));
  };

  const C = 2 * Math.PI * 54;

  return (
    <div className="flex h-full flex-col bg-foreground text-background">
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="text-sm font-semibold uppercase tracking-widest opacity-60">
          Área do adulto
        </span>
        <RoundButton
          label="Fechar"
          onClick={close}
          className="bg-background/10 text-background shadow-none"
        >
          <X className="h-6 w-6" />
        </RoundButton>
      </div>

      {step === "hold" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
          <p className="text-lg opacity-80">Segure o botão até o círculo completar.</p>
          <button
            type="button"
            aria-label="Segure por 2 segundos"
            className="relative h-36 w-36 select-none rounded-full [touch-action:none]"
            onPointerDown={holdStart}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onPointerCancel={holdEnd}
            onContextMenu={(e) => e.preventDefault()}
          >
            <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
              />
            </svg>
            <span className="absolute inset-4 flex flex-col items-center justify-center gap-1 rounded-full bg-background/10">
              <Hand className="h-9 w-9" />
              <span className="font-display text-lg">2 s</span>
            </span>
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-end gap-5 px-8 pb-8">
          <p className="text-center text-lg opacity-80">Quanto é</p>
          <p className="font-display text-5xl font-semibold">
            {challenge.a} + {challenge.b}
          </p>
          <div
            className={cn(
              "flex h-16 w-40 items-center justify-center rounded-2xl bg-background/10 font-display text-4xl transition-colors duration-150 ease-out",
              shake && "bg-destructive/40",
            )}
            aria-live="polite"
          >
            {answer || <span className="opacity-30">?</span>}
          </div>
          <div className="grid w-full max-w-72 grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                aria-label={k === "del" ? "Apagar" : k === "ok" ? "Confirmar" : k}
                className={cn(
                  "flex h-14 items-center justify-center rounded-2xl font-display text-2xl transition-transform duration-150 ease-out active:scale-[0.96]",
                  k === "ok" ? "bg-primary text-primary-foreground" : "bg-background/10",
                )}
              >
                {k === "del" ? <Delete className="h-6 w-6" /> : k === "ok" ? "OK" : k}
              </button>
            ))}
          </div>
          {shake && <p className="text-sm opacity-70">Tente esta outra conta.</p>}
        </div>
      )}
    </div>
  );
}

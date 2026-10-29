import { Sparkles, UserRound, Users } from "lucide-react";
import type { CSSProperties } from "react";
import { useStore } from "../store";
import { cn } from "@/lib/utils";

/**
 * First run, one question (briefing §7 — mono-perfil k=1): is this phone for
 * ONE child or for the whole family? The answer is a layout decision, never a
 * data one — "Apenas 1 criança" archives the extras BY THE MODE (they come
 * back the moment the family is shared again) and the Home becomes that one
 * child's hero. Nothing is deleted, no artwork moves.
 *
 * Re-openable from the adult area, so the choice is not a one-way door.
 */
export function SetupScreen() {
  const { dispatch } = useStore();

  const choose = (mode: "single" | "shared") => dispatch({ type: "setFamilyMode", mode });

  return (
    <div
      className="paper-grain flex h-full flex-col bg-background px-5 pb-8 pt-10"
      data-testid="setup"
    >
      <p className="type-label-md font-mono uppercase tracking-[0.18em] text-lapis">Risco e Cor</p>
      <h1 className="type-display-sm mt-2 font-voice font-semibold text-foreground">
        Quem desenha aqui?
      </h1>
      <p className="type-body-lg mt-2 text-lapis">
        Isso decide só o jeito da Home. Dá para mudar depois, sem perder nenhum desenho.
      </p>

      <div className="mt-6 space-y-3">
        <Choice
          icon={UserRound}
          title="Apenas 1 criança"
          hint="Um só herói na Home, sem troca de perfil."
          testid="setup-single"
          index={0}
          onClick={() => choose("single")}
        />
        <Choice
          icon={Users}
          title="Compartilhado"
          hint="Cada criança com o seu cantinho e o mural da família."
          testid="setup-shared"
          index={1}
          onClick={() => choose("shared")}
        />
      </div>

      <div className="mt-auto flex items-center justify-center gap-2 pt-8 text-lapis">
        <Sparkles className="h-4 w-4" aria-hidden />
        <span className="type-body-sm">Nada sai do aparelho.</span>
      </div>
    </div>
  );
}

function Choice({
  icon: Icon,
  title,
  hint,
  testid,
  index,
  onClick,
}: {
  icon: typeof UserRound;
  title: string;
  hint: string;
  testid: string;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      // First-run only: the one entrance allowed to stage, 100ms apart. A
      // choice here happens once per device, never per interaction.
      style={{ "--stagger-index": index } as CSSProperties}
      className={cn(
        "animate-stagger-up flex min-h-[120px] w-full items-center gap-4 rounded-[28px] bg-card px-5 text-left shadow-tile transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]",
      )}
    >
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-md-primary-container text-md-on-primary-container">
        <Icon className="h-8 w-8" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="type-title-lg block font-voice font-semibold text-foreground">
          {title}
        </span>
        <span className="type-body-md mt-0.5 block text-lapis">{hint}</span>
      </span>
    </button>
  );
}

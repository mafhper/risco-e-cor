import { ArrowLeft, Bird, Cat, Dog, Fish, Rabbit, Turtle, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./motion";
import { Dialog } from "./overlay";
import { AVATAR_ART } from "./profileThemes";
import type { AvatarKey, Profile, ToneKey } from "./store";

/**
 * Contextual icon swap, no motion library: both icons stay in the DOM, one
 * absolutely positioned, and they cross-fade with the exact recipe (scale
 * 0.25→1, opacity 0→1, blur 4→0, cubic-bezier(0.2,0,0,1)). CSS transitions do
 * not run on mount, so an icon already in its final state on load does not
 * animate — the `initial={false}` rule without the dependency.
 */
export function IconSwap({
  on,
  off,
  active,
  className,
}: {
  on: ReactNode;
  off: ReactNode;
  active: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const layer = cn(
    "flex items-center justify-center",
    !reduced && "transition-[opacity,filter,scale] ease-[cubic-bezier(0.2,0,0,1)]",
  );
  const duration = reduced ? "duration-0" : "duration-300";
  const shown = "scale-100 opacity-100 blur-none";
  // Literal classes: Tailwind scans source text, so the token values cannot be
  // interpolated here — `motion.ts` + the CSS gate keep them honest.
  const hidden = "scale-[0.25] opacity-0 blur-[4px]";

  return (
    <span
      data-testid="icon-swap"
      data-active={active ? "true" : "false"}
      className={cn("relative inline-flex items-center justify-center", className)}
    >
      <span
        data-testid="icon-layer"
        aria-hidden
        className={cn("absolute inset-0", layer, duration, active ? shown : hidden)}
      >
        {on}
      </span>
      <span
        data-testid="icon-layer"
        aria-hidden
        className={cn(layer, duration, active ? hidden : shown)}
      >
        {off}
      </span>
    </span>
  );
}

export const AVATARS: Record<AvatarKey, { icon: LucideIcon; label: string }> = {
  cat: { icon: Cat, label: "Gato" },
  dog: { icon: Dog, label: "Cachorro" },
  bird: { icon: Bird, label: "Passarinho" },
  fish: { icon: Fish, label: "Peixe" },
  rabbit: { icon: Rabbit, label: "Coelho" },
  turtle: { icon: Turtle, label: "Tartaruga" },
};

export const TONES: Record<ToneKey, { solid: string; soft: string; text: string; ring: string }> = {
  coral: { solid: "bg-coral", soft: "bg-coral-soft", text: "text-coral", ring: "ring-coral" },
  sun: { solid: "bg-sun", soft: "bg-sun-soft", text: "text-sun", ring: "ring-sun" },
  sky: { solid: "bg-sky", soft: "bg-sky-soft", text: "text-sky", ring: "ring-sky" },
  mint: { solid: "bg-mint", soft: "bg-mint-soft", text: "text-mint", ring: "ring-mint" },
  lilac: { solid: "bg-lilac", soft: "bg-lilac-soft", text: "text-lilac", ring: "ring-lilac" },
};

/**
 * Demo stand-in for a local photo: a grey disc with the name's initial.
 * In the real app the adult picks a photo from the device gallery — nothing
 * is ever uploaded, so this placeholder never needs a network round-trip.
 */
export function placeholderPhotoUri(name: string): string {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#b9bdc9"/><text x="48" y="62" text-anchor="middle" font-family="sans-serif" font-size="40" font-weight="700" fill="#ffffff">${initial}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Photo (if any) > chosen emoji > themed illustration > animal icon. */
export function Avatar({
  profile,
  size = 56,
  className,
}: {
  profile: Profile;
  size?: number;
  className?: string;
}) {
  if (profile.photoUri) {
    return (
      <span
        className={cn("inline-flex shrink-0 overflow-hidden rounded-full", className)}
        style={{ width: size, height: size, aspectRatio: "1 / 1" }}
        aria-hidden
      >
        <img src={profile.photoUri} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  if (profile.emojiAvatar) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted",
          className,
        )}
        style={{
          width: size,
          height: size,
          aspectRatio: "1 / 1",
          fontSize: size * 0.58,
          lineHeight: 1,
        }}
        aria-hidden
      >
        {profile.emojiAvatar}
      </span>
    );
  }
  if (profile.avatarCustom) {
    const Art = AVATAR_ART[profile.avatarCustom];
    return (
      <span
        className={cn("inline-flex shrink-0 overflow-hidden rounded-full", className)}
        style={{ width: size, height: size, aspectRatio: "1 / 1" }}
        aria-hidden
      >
        <Art className="h-full w-full" />
      </span>
    );
  }
  const Icon = AVATARS[profile.avatar].icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-paper",
        TONES[profile.tone].solid,
        className,
      )}
      style={{ width: size, height: size, aspectRatio: "1 / 1" }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2} />
    </span>
  );
}

/** Large round icon button — min 48dp target, label for screen readers. */
export function RoundButton({
  label,
  children,
  className,
  size = "md",
  static: isStatic = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
  size?: "md" | "lg";
  /** Opt out where the press scale would distract (inside the live canvas). */
  static?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-tile transition-transform duration-150 ease-out active:translate-y-0.5 active:shadow-press disabled:active:translate-y-0",
        !isStatic && "active:scale-[0.96]",
        "disabled:opacity-35",
        size === "lg" ? "h-16 w-16" : "h-12 w-12",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * The one top bar, with three slots (ux-home-nav-hierarquia §3): back on the
 * left, title in the middle, actions on the right. Back is a real button and
 * the device's Escape key mirrors it in the mockup.
 */
export function TopBar({
  title,
  subtitle,
  backLabel = "Voltar",
  onBack,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <div className="flex h-16 shrink-0 items-center gap-1.5 bg-background/95 px-2 backdrop-blur">
      {onBack ? (
        <RoundButton label={backLabel} onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </RoundButton>
      ) : (
        <span className="h-12 w-12 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        {/* Título de tela = VOZ, 24/600: `type-headline-sm` traz 24/400 e o peso
            vem do `font-semibold`. O subtítulo logo abaixo é dado e fica na
            neutra. */}
        <p className="type-headline-sm truncate font-voice font-semibold text-foreground">
          {title}
        </p>
        {subtitle && <p className="type-label-md truncate text-lapis">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** Compact text/icon button for the top bar (never a floating tile). */
export function BarButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-semibold text-foreground transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * The one confirmation overlay. Used only for irreversible acts (purge a
 * piece, empty the trash, remove a profile): the reversible ones get a toast
 * with "Desfazer" instead. Esc and the backdrop always cancel — never confirm.
 *
 * Mounted by the screen that owns the payload (`open` + `useRetained`), so the
 * 150ms exit has content to show instead of an emptied panel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Manter",
  destructive = true,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Focus the safe action: Enter must never destroy anything by accident.
    if (!open) return;
    const target = ref.current?.querySelector<HTMLButtonElement>("[data-safe]");
    target?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      label={title}
      role="alertdialog"
      labelledBy="confirm-title"
      closeLabel="Fechar"
    >
      <div ref={ref}>
        <p id="confirm-title" className="type-headline-sm font-voice font-semibold text-foreground">
          {title}
        </p>
        {message && <div className="type-body-md mt-1 text-lapis">{message}</div>}
        {children}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            data-safe
            onClick={onCancel}
            className="type-label-lg h-12 flex-1 rounded-md bg-muted text-foreground transition-colors duration-150 ease-out active:scale-[0.96]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "type-label-lg h-12 flex-1 rounded-md transition-transform duration-150 ease-out active:scale-[0.96]",
              destructive
                ? "bg-destructive text-destructive-foreground"
                : "bg-foreground text-background",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

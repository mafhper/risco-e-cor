// P1 — "seleção por barra na borda" (transferência Tayasui §0.4, §6.4).
//
// No checkbox, no radio dot: the chosen row wears a bar on its leading edge,
// and the same mark appears on every list — paper, toolbar position, and the
// panels still to come (layers, blend, themes). The bar is drawn as a layer, so
// it never shifts the row when the selection moves.
//
// A row that cannot be chosen is not rendered at all: the list shows only what
// the profile can actually use, never a padlock or a dimmed row.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EdgeBar({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return (
    <span
      aria-hidden
      data-edge-bar="true"
      className="pointer-events-none absolute bottom-2 left-0 top-2 w-1 rounded-full bg-foreground"
    />
  );
}

export function EdgeRow({
  label,
  detail,
  selected,
  onSelect,
  testid,
  className,
  children,
}: {
  label: string;
  detail?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  testid?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      data-testid={testid}
      data-selected={selected ? "true" : "false"}
      onClick={onSelect}
      className={cn(
        "relative flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left transition-colors duration-150 ease-out",
        selected ? "border-foreground/20 bg-card" : "border-transparent bg-muted/50",
        "active:scale-[0.99]",
        className,
      )}
    >
      <EdgeBar selected={selected} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-label-lg truncate text-foreground">{label}</span>
        {detail && <span className="type-body-sm truncate text-lapis">{detail}</span>}
      </span>
      {children}
    </button>
  );
}

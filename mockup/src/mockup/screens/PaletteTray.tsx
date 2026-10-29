import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Star } from "lucide-react";
import {
  BLACK,
  COMPACT_LIGHTNESS,
  FAMILY_STEPS,
  KID_COLORS,
  PALETTE_FAMILIES,
  PALETTE_NEUTRALS,
  SCALE_STEPS,
  SPECTRUM_FAMILIES,
  WHITE,
  derivedRamp,
  hexFromHsl,
  hslLabel,
  hslOfHex,
  isValidHex,
  type Hsl,
} from "../palette";
import { cn } from "@/lib/utils";

/** Six families per page: 6 x 56dp + gaps fits a 390dp phone with no scroll. */
const KID_FAMILIES_PER_PAGE = 6;

const kidFamilyPages = () => {
  const pages: (typeof PALETTE_FAMILIES)[] = [];
  for (let i = 0; i < PALETTE_FAMILIES.length; i += KID_FAMILIES_PER_PAGE) {
    pages.push(PALETTE_FAMILIES.slice(i, i + KID_FAMILIES_PER_PAGE));
  }
  return pages;
};

/**
 * One swatch. It carries NO color name: the value is the color itself, and the
 * accessible name is positional ("cor 7 de 11") or the HEX in the advanced
 * selector. Naming a hex is guessing; guessing wrong is worse than not naming.
 */
function Swatch({
  hex,
  label,
  on,
  kids,
  onClick,
}: {
  hex: string;
  label: string;
  on: boolean;
  kids: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      data-hex={hex}
      onClick={onClick}
      style={{ background: hex }}
      className={cn(
        "relative flex min-w-0 items-center justify-center border transition-[scale,background-color] duration-150 ease-out active:scale-[0.96]",
        kids
          ? "aspect-square w-full rounded-full border-border/60"
          : "h-7 w-full rounded-md border-border hover:scale-105",
        on && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
      )}
    >
      {on && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-card",
            kids ? "h-5 w-5" : "h-4 w-4",
          )}
        >
          <Check
            className={kids ? "h-3.5 w-3.5 text-foreground" : "h-3 w-3 text-foreground"}
            strokeWidth={2}
          />
        </span>
      )}
    </button>
  );
}

/** The current color as a compact chip: the result, not a name. */
function ColorChip({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      data-testid="color-chip"
      data-hex={color}
      className="h-7 w-7 shrink-0 rounded-full border border-black/10"
      style={{ background: color }}
    />
  );
}

/** Height of one kids target: 56dp, the M3 Expressive floor. */
const KID_TARGET = "h-14 w-14";

/**
 * The family (of `families`) whose base hue is closest to `hex`. The presets
 * follow the spectrum (owner's call, 24/10): after moving the hue track, the row
 * below jumps to that family, so refining to a catalog colour is one tap away
 * instead of a hunt through pages. Defaults to all 18; the family highlight
 * passes the 15 chromatic ones, since a neutral has no hue to be nearest to.
 */
function nearestFamilyIndex(
  hex: string,
  families: typeof PALETTE_FAMILIES = PALETTE_FAMILIES,
): number {
  const { h } = hslOfHex(hex);
  let best = 0;
  let bestDistance = 361;
  families.forEach((family, index) => {
    const { h: familyHue } = hslOfHex(family.base.hex);
    const distance = Math.abs(((familyHue - h + 540) % 360) - 180);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}

/**
 * The colour rows ride the TOOLS block's grid, to the pixel: six 44dp cells with
 * an 8dp gap are 6·44 + 5·8 = 304dp, the same 304 the two tool lines measure
 * (`compacta-distribuicao` §2). The numbers are declared, not inherited from a
 * utility class: two blocks that must line up cannot each trust a different
 * spelling of the same number.
 */
export const COLOR_CELL = 44;
export const COLOR_GAP = 8;
export const COLOR_COLUMNS = 6;

/** Twelve cells in 6 + 6: white, the ten rungs, black (owner's call, 27/10). */
export const COLOR_COUNT = SCALE_STEPS.length + 2;
export const COLOR_ROWS = COLOR_COUNT / COLOR_COLUMNS;

/** The measured account of one colour row, both bands: 6 · 44 + 5 · 8 = 304dp. */
export const COLOR_ROW_WIDTH = COLOR_COLUMNS * COLOR_CELL + (COLOR_COLUMNS - 1) * COLOR_GAP;

/**
 * The cell's own 1dp frame, taken from INSIDE the 44 — not added around it. The
 * three parts have to close on the cell's height, or the label hangs out of the
 * box it belongs to (the defect the owner's print showed, 27/10).
 */
export const COLOR_EDGE = 1;

/**
 * The band that names the step, inside the cell and under the swatch, 9+ only.
 * It used to be a separate row under the grid, which is exactly why "50…500"
 * read as if it belonged to the row below: 6 labels under 11 tones, one band
 * of air, no owner. Now a label cannot leave the cell it names — and white and
 * black, the two cells that name no step, keep the same empty band so the row
 * stays one uniform grid instead of two taller ends.
 */
export const COLOR_STEP_BAND = 12;

/** The colour of a 9+ cell: the cell minus its frame and its own label band. */
export const COLOR_SWATCH = COLOR_CELL - 2 * COLOR_EDGE - COLOR_STEP_BAND;

/*
 * The colour area is NOT two designs. The 3–5 band wears the very same ladder as
 * 9+ — white, the ten rungs of the colour in hand, black, 6 + 6 on the same
 * 44dp cell and the same 8dp gap — because with no word anywhere on it,
 * regularity is the only thing that can make two bands read as one system
 * (owner's decision, 27/10, with a capture).
 *
 * What that takes away from 3–5: the 3 × 3 of nine 52dp targets, the 12dp
 * breath between its groups and the loose pair of neutrals under it. They were
 * three signs the 9+ band does not have, which is exactly what made the two
 * bands look like two different bars.
 *
 * The 44dp cell is the exception already registered for the colour area (the
 * 56dp floor holds everywhere else in 3–5). The one thing the kids band drops
 * is the label band: a step number is text.
 */

/**
 * ONE height for the colour carousel, on every panel and both bands. The box is
 * the strip's own home (24dp of track inside 48dp of touch, centred) with the
 * room the saturation × lightness field needs; swapping panels never resizes it.
 */
export const CAROUSEL_HEIGHT = 88;

/** The 2D field inside the carousel: 56dp of lightness, 16dp of air around it. */
export const CAROUSEL_FIELD = 56;

/**
 * The 15 chromatic hues of the catalogue, in their catalogue order, as hue
 * angles (degrees). `rosa` wraps past 360 — it is the last stop of the wheel —
 * so it is set one turn after its own angle. The closing stop repeats the first
 * hue one turn later, which is what lets the strip end where it began.
 *
 * The strip paints these 15 hues, not a generic rainbow (`cor-compacta` §4, C1:
 * "gradiente dos 15 matizes do catálogo").
 */
const SPECTRUM_STOPS: number[] = (() => {
  const stops: number[] = [];
  for (const family of SPECTRUM_FAMILIES) {
    const hue = hslOfHex(family.base.hex).h;
    const previous = stops[stops.length - 1];
    stops.push(previous !== undefined && hue < previous - 180 ? hue + 360 : hue);
  }
  stops.push(stops[0]! + 360);
  return stops;
})();

const SPECTRUM_SEGMENTS = SPECTRUM_STOPS.length - 1;

/** One axis of the colour area: a percentage, never outside 0..100. */
const clampPct = (n: number) => Math.min(100, Math.max(0, n));

/** The hue under a position of the strip, 0..1 from the left edge. */
function hueAt(ratio: number): number {
  const position = Math.min(SPECTRUM_SEGMENTS, Math.max(0, ratio) * SPECTRUM_SEGMENTS);
  const index = Math.min(SPECTRUM_SEGMENTS - 1, Math.floor(position));
  const local = position - index;
  const from = SPECTRUM_STOPS[index]!;
  const to = SPECTRUM_STOPS[index + 1]!;
  return (((from + local * (to - from)) % 360) + 360) % 360;
}

/** Where a hue sits on the strip, 0..1 — the inverse of `hueAt`. */
function ratioOfHue(hue: number): number {
  const first = SPECTRUM_STOPS[0]!;
  const wanted = first + ((((hue - first) % 360) + 360) % 360);
  for (let index = 0; index < SPECTRUM_SEGMENTS; index++) {
    const from = SPECTRUM_STOPS[index]!;
    const to = SPECTRUM_STOPS[index + 1]!;
    if (wanted <= to || index === SPECTRUM_SEGMENTS - 1) {
      const local = to === from ? 0 : (wanted - from) / (to - from);
      return (index + Math.min(1, Math.max(0, local))) / SPECTRUM_SEGMENTS;
    }
  }
  return 0;
}

const SPECTRUM_CSS = `linear-gradient(90deg, ${SPECTRUM_STOPS.map(
  (hue) => `hsl(${hue} 100% 50%)`,
).join(", ")})`;

/**
 * C1 — the spectrum strip (owner's decision, 27/10, `compacta-unificada` §12.6):
 * ONE horizontal strip, full width, 24dp of visible track inside a 48dp touch
 * band, scrubbed by dragging. The hue follows the finger in real time; there is
 * no text, only an invisible name for the screen reader.
 *
 * The strip replaces the vertical hue bar of the superseded §12.4 — the owner's
 * reason was measured: the vertical track was too short to hit with a finger.
 * Saturation and lightness are the colour's own, so scrubbing rotates the hue
 * instead of throwing the colour away.
 *
 * It is panel 1 of the carousel and it stops the gesture at its own door: a
 * horizontal drag on the track scrubs the hue, it does not page the carousel.
 * The 20dp of air above and below the band are the carousel's to read.
 */
export function CompactSpectrum({
  color,
  kids,
  onPick,
  testid = "compact-spectrum",
}: {
  color: string;
  kids: boolean;
  onPick: (hex: string) => void;
  /** The seam's own name: the mini-pop reuses the strip under its own id. */
  testid?: string;
}) {
  const hsl = hslOfHex(color);
  const dragging = useRef(false);
  const track = useRef<HTMLDivElement>(null);

  const emitAt = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onPick(hexFromHsl({ h: hueAt(ratio), s: hsl.s, l: hsl.l, a: 100 }));
  };

  return (
    <div
      data-testid={testid}
      data-track="24"
      data-touch="48"
      className="flex h-12 w-full items-center"
    >
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Espectro de cores"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsl.h)}
        aria-valuetext={kids ? undefined : hslLabel(hsl)}
        onPointerDown={(event) => {
          event.stopPropagation();
          dragging.current = true;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          emitAt(event.clientX);
        }}
        onPointerMove={(event) => {
          event.stopPropagation();
          if (dragging.current) emitAt(event.clientX);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          dragging.current = false;
        }}
        onPointerCancel={(event) => {
          event.stopPropagation();
          dragging.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const delta = event.key === "ArrowLeft" ? -5 : 5;
          onPick(hexFromHsl({ h: (hsl.h + delta + 360) % 360, s: hsl.s, l: hsl.l, a: 100 }));
        }}
        className="relative h-6 w-full cursor-pointer rounded-full border border-border"
        style={{ backgroundImage: SPECTRUM_CSS }}
      >
        <span
          aria-hidden
          data-testid={`${testid}-marker`}
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{
            left: `${ratioOfHue(hsl.h) * 100}%`,
            background: hexFromHsl({ h: hsl.h, s: 100, l: 50, a: 100 }),
          }}
        />
      </div>
    </div>
  );
}

/**
 * C1b — the saturation × lightness field (owner's decision, 27/10): panel 2 of
 * the carousel on BOTH bands, in the box the strip already had. x is saturation,
 * y is lightness, and the hue is the strip's — the field refines the colour in
 * hand instead of throwing its hue away.
 *
 * 3–5 mounts it too (owner's correction, 27/10, restoring the 26/10 decision:
 * field + hue, muted). It is the band's only route to grey: the strip alone can
 * rotate the hue and nothing else, so without this panel no lane of the carousel
 * reaches `s = 0`. On 3–5 it carries NO text — no value, no visible label, no
 * readout, no HEX. `aria-label` stays because it is the screen reader's name and
 * never enters the page; `aria-valuetext` is dropped with `kids`, since a spoken
 * HSL is still a value this band does not read.
 *
 * The gesture stops at the field, so dragging inside it adjusts the colour and
 * never pages the carousel under the finger.
 */
function CompactHslField({
  color,
  kids,
  onPick,
}: {
  color: string;
  kids: boolean;
  onPick: (hex: string) => void;
}) {
  const hsl = hslOfHex(color);
  const field = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const emitAt = (clientX: number, clientY: number) => {
    const rect = field.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const s = clampPct(((clientX - rect.left) / rect.width) * 100);
    const l = clampPct(100 - ((clientY - rect.top) / rect.height) * 100);
    onPick(hexFromHsl({ h: hsl.h, s, l, a: 100 }));
  };

  return (
    <div
      ref={field}
      role="slider"
      tabIndex={0}
      aria-label="Saturação e luminosidade"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsl.s)}
      aria-valuetext={kids ? undefined : hslLabel(hsl)}
      data-testid="compact-hsl-field"
      data-axis="s-l"
      onPointerDown={(event) => {
        event.stopPropagation();
        dragging.current = true;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        emitAt(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (dragging.current) emitAt(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        dragging.current = false;
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        dragging.current = false;
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") onPick(hexFromHsl({ ...hsl, s: clampPct(hsl.s - 5) }));
        else if (event.key === "ArrowRight") onPick(hexFromHsl({ ...hsl, s: clampPct(hsl.s + 5) }));
        else if (event.key === "ArrowUp") onPick(hexFromHsl({ ...hsl, l: clampPct(hsl.l + 5) }));
        else if (event.key === "ArrowDown") onPick(hexFromHsl({ ...hsl, l: clampPct(hsl.l - 5) }));
        else return;
        event.preventDefault();
      }}
      className="relative w-full cursor-crosshair rounded-lg border border-border"
      style={{
        height: CAROUSEL_FIELD,
        backgroundColor: `hsl(${Math.round(hsl.h)} 100% 50%)`,
        backgroundImage:
          "linear-gradient(to right, #FFFFFF, rgba(255,255,255,0)), linear-gradient(to top, #000000, rgba(0,0,0,0))",
      }}
    >
      <span
        aria-hidden
        data-testid="compact-hsl-marker"
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
        style={{
          left: `${Math.min(98, Math.max(2, hsl.s))}%`,
          top: `${Math.min(98, Math.max(2, 100 - hsl.l))}%`,
          background: color,
        }}
      />
    </div>
  );
}

/**
 * C1c — the HEX field: panel 3 of the carousel, 9+ only (the 3–5 band reads no
 * text at all, `sem-texto-3-5` §1). The draft is local so a half-typed code is
 * not thrown away; only a valid `#rrggbb` reaches the canvas.
 */
function CompactHex({ color, onPick }: { color: string; onPick: (hex: string) => void }) {
  const [draft, setDraft] = useState(color.toUpperCase());
  const emitted = useRef<string | null>(null);

  useEffect(() => {
    if (color.toLowerCase() === emitted.current) return;
    setDraft(color.toUpperCase());
  }, [color]);

  return (
    <label
      className="flex w-full items-center gap-2"
      // The field is a form, not a page: selecting inside it never pages the carousel.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <span className="font-mono text-[10px] font-semibold text-muted-foreground">HEX</span>
      <input
        value={draft}
        onChange={(event) => {
          const value = event.target.value.toUpperCase();
          setDraft(value);
          if (!isValidHex(value)) return;
          emitted.current = value.toLowerCase();
          onPick(value);
        }}
        aria-label="Cor em HEX"
        data-testid="compact-hex"
        className="h-9 w-full min-w-0 rounded-md border border-border bg-card px-2 font-mono text-[12px] tabular-nums text-foreground uppercase"
      />
    </label>
  );
}

/**
 * C2 — the ladder of the colour in hand, ONE row on both bands (owner's
 * decisions, 27/10; `cor-compacta` §9–§10): TWELVE cells in 6 + 6 — WHITE, the
 * ten rungs of the colour in hand, BLACK — on the 44dp cell and the 8dp gap of
 * the tools block, 6 · 44 + 5 · 8 = 304dp.
 *
 * The row opens on WHITE and closes on BLACK — the two neutrals the derived
 * family can never produce (a hue ramp's darkest rung is a dark blue, not black,
 * and white is no rung at all). They are cells of the ladder, not a separate
 * pair beside the strip: the strip is full width and the row is one grid of
 * twelve, `branco + 10 degraus + preto`, with no spacer and no empty cell.
 *
 * On 9+ each rung names its own step inside its own cell, and the two neutral
 * cells carry an empty band — same box, no word. On 3–5 the band is not
 * rendered: the same twelve cells, not a single character.
 *
 * The grid is ANCHORED (P5): a tap inside it selects and never re-derives the
 * ladder under the finger; only a colour arriving from outside resets the rungs.
 */
function LadderCell({
  hex,
  step,
  on,
  kids,
  label,
  onPick,
}: {
  hex: string;
  /** The published step this cell names, or null for white and black. */
  step: number | null;
  on: boolean;
  kids: boolean;
  label: string;
  onPick: (hex: string) => void;
}) {
  /** The whole cell on 3–5 (no label), the cell minus frame and band on 9+. */
  const swatch = kids ? COLOR_CELL - 2 * COLOR_EDGE : COLOR_SWATCH;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={label}
      data-hex={hex}
      onClick={() => onPick(hex)}
      style={{ width: COLOR_CELL, height: COLOR_CELL }}
      className={cn(
        "relative flex flex-col items-center rounded-[12px] border border-border/60 transition-transform duration-150 ease-out active:scale-[0.96]",
        on && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
      )}
    >
      <span
        aria-hidden
        data-swatch=""
        style={{ background: hex, height: swatch }}
        className="w-full shrink-0 rounded-[10px]"
      />
      {!kids && (
        <span
          aria-hidden
          data-band=""
          data-step={step ?? undefined}
          style={{ height: COLOR_STEP_BAND }}
          className="flex w-full shrink-0 items-center justify-center text-[9px] leading-none tabular-nums text-muted-foreground"
        >
          {step ?? ""}
        </span>
      )}
    </button>
  );
}

/** The ladder: white, the ten rungs of the colour in hand, black. 6 + 6, both bands. */
function ColorLadder({
  color,
  rungs,
  kids,
  onPick,
}: {
  color: string;
  rungs: readonly string[];
  kids: boolean;
  onPick: (hex: string) => void;
}) {
  const cells = useMemo(
    () => [
      { hex: WHITE.hex, step: null },
      ...rungs.map((hex, index) => ({ hex, step: SCALE_STEPS[index] ?? null })),
      { hex: BLACK.hex, step: null },
    ],
    [rungs],
  );
  return (
    <div
      data-testid="compact-colors"
      data-columns={COLOR_COLUMNS}
      data-rows={COLOR_ROWS}
      data-cell={COLOR_CELL}
      data-gap={COLOR_GAP}
      data-count={cells.length}
      data-width={COLOR_ROW_WIDTH}
      data-label-band={kids ? 0 : COLOR_STEP_BAND}
      role="radiogroup"
      aria-label="Tons da cor"
      className="grid w-full justify-center justify-items-center"
      style={{
        gridTemplateColumns: `repeat(${COLOR_COLUMNS}, ${COLOR_CELL}px)`,
        gap: `${COLOR_GAP}px`,
      }}
    >
      {cells.map((cell, index) => {
        // Positional, like every other swatch — except the two ends on 9+,
        // whose value needs no guess: white and black are the only names that
        // cannot be wrong, and the pair used to announce exactly that. 3–5
        // never hears a name at all: the screen reader gets the position.
        const label = kids
          ? `cor ${index + 1} de ${cells.length}`
          : index === 0
            ? "Branco"
            : index === cells.length - 1
              ? "Preto"
              : `tom ${index + 1} de ${cells.length}`;
        return (
          <LadderCell
            key={`${cell.hex}-${index}`}
            hex={cell.hex}
            step={cell.step}
            on={cell.hex.toLowerCase() === color.toLowerCase()}
            kids={kids}
            label={label}
            onPick={onPick}
          />
        );
      })}
    </div>
  );
}

/**
 * The colour box as a CAROUSEL (owner's decision, 27/10): three panels in the
 * same height on 9+ (spectrum · HSL field · HEX), TWO on 3–5 (spectrum · HSL
 * field, muted) — paged by a horizontal drag that snaps to the nearest panel on
 * release. One height for every panel and both bands, so a swipe never resizes
 * the bar.
 *
 * The 3–5 pair is not a simplification of the 9+ one: the field is the only
 * route that band has to grey, and the strip alone would leave it able to rotate
 * the hue but never to desaturate (owner's correction, 27/10). The field reads
 * no word there; the position of its marker is the whole value.
 *
 * The panels that own a horizontal gesture (the strip, the field) stop the
 * pointer at their own door; the carousel is dragged on the air around them —
 * the strip band leaves 20dp above and below, the field 16dp. The dots are the
 * discreet cue, not a second door: 4dp, `aria-hidden`, no word on either band.
 */
function CompactCarousel({
  color,
  kids,
  onPick,
}: {
  color: string;
  kids: boolean;
  onPick: (hex: string) => void;
}) {
  const panels = kids ? (["spectrum", "hsl"] as const) : (["spectrum", "hsl", "hex"] as const);
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; width: number } | null>(null);
  const current = Math.min(index, panels.length - 1);

  const release = () => {
    const drag = start.current;
    start.current = null;
    if (!drag) return;
    const width = drag.width > 0 ? drag.width : 1;
    const pages = Math.round(-dx / width);
    setIndex(Math.min(panels.length - 1, Math.max(0, current + pages)));
    setDx(0);
  };

  return (
    <div
      data-testid="compact-carousel"
      data-panels={panels.length}
      data-index={current}
      data-height={CAROUSEL_HEIGHT}
      data-span="full"
      style={{ height: CAROUSEL_HEIGHT }}
      className="relative w-full min-w-0 overflow-hidden rounded-[12px]"
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        start.current = { x: event.clientX, y: event.clientY, width: rect.width };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDx(0);
      }}
      onPointerMove={(event) => {
        const drag = start.current;
        if (!drag) return;
        const delta = event.clientX - drag.x;
        if (Math.abs(delta) <= Math.abs(event.clientY - drag.y)) return;
        setDx(delta);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <div
        className="flex h-full w-full"
        style={{
          transform: `translateX(calc(${-current * 100}% + ${dx}px))`,
          transitionProperty: "transform",
          transitionDuration: dx === 0 ? "200ms" : "0ms",
        }}
      >
        {panels.map((panel) => (
          <div key={panel} data-panel={panel} className="flex h-full w-full shrink-0 items-center">
            {panel === "spectrum" && <CompactSpectrum color={color} kids={kids} onPick={onPick} />}
            {panel === "hsl" && <CompactHslField color={color} kids={kids} onPick={onPick} />}
            {panel === "hex" && <CompactHex color={color} onPick={onPick} />}
          </div>
        ))}
      </div>
      {panels.length > 1 && (
        <div
          aria-hidden
          data-testid="compact-carousel-dots"
          data-size="4"
          className="pointer-events-none absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-1"
        >
          {panels.map((panel, dot) => (
            <span
              key={panel}
              data-on={dot === current ? "true" : "false"}
              className={cn(
                "h-1 rounded-full transition-[width,background-color] duration-150",
                dot === current ? "w-3 bg-foreground/70" : "w-1 bg-foreground/25",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A catalogue section the tabs walk. */
type PaletteTab = "cores" | "recentes" | "favoritas";

const PALETTE_TABS = [
  ["cores", "Cores"],
  ["recentes", "Recentes"],
  ["favoritas", "Favoritas"],
] as const;

/**
 * The catalogue under the variations: Cores (the 18 families and the neutrals),
 * Recentes (what this person used) and Favoritas (what they saved).
 *
 * The EXPANDED sheet is its only home since 27/10 (`compacta-unificada` §12.6):
 * the compact bar no longer mirrors the complete panel, so this component no
 * longer has a dense form, a kids form or a tabless form. Favouriting lives
 * here — the star above and the Favoritas tab below.
 */
function PaletteCatalog({
  color,
  recent,
  favorites,
  onPick,
}: {
  color: string;
  recent: readonly string[];
  favorites: readonly string[];
  onPick: (hex: string) => void;
}) {
  const [tab, setTab] = useState<PaletteTab>("cores");
  const shown: PaletteTab = tab;

  /**
   * The family chips are navigation, not selection: the family that owns the
   * colour gets a thin ring, and so does the nearest hue when the colour is not
   * in the catalog. Only the 15 chromatic families have a hue to be nearest to;
   * a neutral is highlighted solely on an exact match, and a colour with no hue
   * (grayscale) highlights none. The strong ring belongs to the chosen tone on
   * the ramp above — one ramp, one strong marker, no second grid below.
   */
  const exactFamily = PALETTE_FAMILIES.find((f) =>
    f.steps.some((s) => s.hex.toUpperCase() === color.toUpperCase()),
  );
  const nearestFamily =
    hslOfHex(color).s > 0
      ? SPECTRUM_FAMILIES[nearestFamilyIndex(color, SPECTRUM_FAMILIES)]
      : undefined;
  const family = exactFamily ?? nearestFamily;

  const cell = "h-7";
  const grid = "grid-cols-6 gap-1";

  return (
    <div data-testid="palette-catalog" data-tab={shown}>
      <div className="mt-2 flex gap-1" role="tablist" aria-label="Seções da paleta">
        {PALETTE_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md font-semibold uppercase tracking-wide transition-colors duration-150 ease-out active:scale-[0.96]",
              "px-2 py-1 text-[11px]",
              tab === id ? "bg-foreground text-background" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {shown === "cores" && (
        <div className="mt-1.5">
          <div
            className={cn("grid justify-items-stretch", grid)}
            role="group"
            aria-label="Famílias de cor"
            data-testid="palette-families"
          >
            {PALETTE_FAMILIES.map((f, i) => (
              <button
                key={f.id}
                type="button"
                aria-label={`família ${i + 1} de ${PALETTE_FAMILIES.length}`}
                aria-pressed={f.id === family?.id}
                data-testid="palette-family"
                data-hex={f.base.hex}
                // Picking a family IS picking its colour (owner's rule, 25/10):
                // the tone ramp must be the ramp of the colour in the hand, never
                // of a family left behind by an earlier tap.
                onClick={() => onPick(f.base.hex)}
                style={{ background: f.base.hex }}
                className={cn(
                  cell,
                  "rounded-md border border-border/60 transition-transform duration-150 ease-out active:scale-[0.96]",
                  // Navigation, not selection: a thin ring. The selected COLOUR
                  // gets the thick ring on the ramp above — one strong marker on
                  // screen, so two things never look "chosen" at once.
                  f.id === family?.id && "ring-1 ring-foreground/50",
                )}
              />
            ))}
          </div>

          <div className="mt-1.5 flex items-center gap-1.5" role="radiogroup" aria-label="Neutros">
            {PALETTE_NEUTRALS.map((n, i) => (
              <button
                key={n.hex}
                type="button"
                role="radio"
                aria-checked={n.hex.toLowerCase() === color.toLowerCase()}
                aria-label={`cor ${i + 1} de ${PALETTE_NEUTRALS.length}`}
                data-hex={n.hex}
                onClick={() => onPick(n.hex)}
                style={{ background: n.hex }}
                className={cn(
                  // The two neutrals close the catalogue: black and white are
                  // colours a hand picks, never a gap.
                  "h-6 flex-1 rounded-md",
                  "border border-border",
                  n.hex.toLowerCase() === color.toLowerCase() &&
                    "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                )}
              />
            ))}
          </div>
        </div>
      )}

      {shown === "recentes" && (
        <div className="mt-1.5">
          {recent.length === 0 ? (
            <p className="py-3 text-[11px] text-muted-foreground">Nenhuma cor usada ainda.</p>
          ) : (
            <div
              className={cn("grid", "grid-cols-8 gap-1")}
              role="radiogroup"
              aria-label="Cores recentes"
            >
              {recent.slice(0, 16).map((hex, i) => (
                <Swatch
                  key={hex}
                  hex={hex}
                  label={`cor ${i + 1} de ${Math.min(16, recent.length)}`}
                  on={hex.toLowerCase() === color.toLowerCase()}
                  kids={false}
                  onClick={() => onPick(hex)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {shown === "favoritas" && (
        <div className="mt-1.5">
          {favorites.length === 0 ? (
            <p className="py-3 text-[11px] text-muted-foreground">
              Toque na estrela para guardar uma cor (até 24).
            </p>
          ) : (
            <div
              className={cn("grid", "grid-cols-8 gap-1")}
              role="radiogroup"
              aria-label="Cores favoritas"
            >
              {favorites.slice(0, 24).map((hex, i) => (
                <Swatch
                  key={hex}
                  hex={hex}
                  label={`cor ${i + 1} de ${Math.min(24, favorites.length)}`}
                  on={hex.toLowerCase() === color.toLowerCase()}
                  kids={false}
                  onClick={() => onPick(hex)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The compact colour area — TWO pieces, the same two on both bands (owner's
 * decisions of 27/10, `compacta-unificada` §12.6, revised on the owner's print
 * of the same day, on the order decision of the day and on the uniformity
 * decision taken with a capture):
 *
 *   1. the CAROUSEL — one box, one height, FULL width, paged by a horizontal drag
 *      that snaps to the nearest panel:
 *        · panel 1, the spectrum strip: 24dp of track in a 48dp touch band,
 *          scrubbed by dragging (no text, invisible name);
 *        · panel 2, the saturation × lightness field: x is saturation, y is
 *          lightness, the hue comes from the strip — on BOTH bands. On 3–5 it is
 *          the route to grey (`s = 0`) and reads no value: the strip alone can
 *          rotate the hue, never desaturate it;
 *        · panel 3, the HEX field — 9+ only, because the 3–5 band reads no text.
 *      Nothing shares this row any more: white and black left it, so the strip is
 *      the whole width of the block instead of dividing it with two 44dp targets;
 *   2. the LADDER of the colour in hand, under the hairline — the SAME row on both
 *      bands: twelve cells in 6 + 6, WHITE, the ten rungs 50…950, BLACK. The two
 *      neutrals are cells of the row, not a pair beside the strip. On 9+ each
 *      rung keeps its own step inside its own cell; on 3–5 the label band is not
 *      rendered at all, so the same twelve cells read no character.
 *
 * The 3–5 band used to have its own design here — a 3 × 3 of nine 52dp targets
 * with a 12dp breath between groups and a loose pair of neutrals under it. It
 * left with the uniformity decision: three signs the 9+ band does not have are
 * exactly what made one bar look like two.
 *
 * What left this surface with the earlier decisions and stays out: the HSL
 * readout, the VERTICAL hue bar, the CORES/RECENTES/FAVORITAS tabs, the family
 * catalogue, the favourites row and the 600ms hold that saved into it. They live
 * in the expanded sheet only. None of them is rendered here on either band, so a
 * query finds nothing rather than a hidden node.
 */
export function CompactColor({
  color,
  kids,
  onPick,
}: {
  color: string;
  kids: boolean;
  onPick: (hex: string) => void;
}) {
  /**
   * The ladder is anchored while the hand is inside it: a tap on a rung — or on
   * white or black, the two end cells of the same row — is a selection, not a new
   * ladder. Only a colour that arrived from OUTSIDE the row (the strip, the
   * field, the sheet, a favourite) re-anchors it.
   */
  const [anchor, setAnchor] = useState<string>(color);
  const rungs = useMemo(() => derivedRamp(anchor, COMPACT_LIGHTNESS), [anchor]);
  const row = useMemo(() => [WHITE.hex, ...rungs, BLACK.hex], [rungs]);
  useEffect(() => {
    if (anchor === color) return;
    if (row.some((hex) => hex.toLowerCase() === color.toLowerCase())) return;
    setAnchor(color);
  }, [anchor, color, row]);

  return (
    <div data-testid="compact-color">
      <div data-testid="compact-color-top" className="mt-2 flex items-center" data-span="full">
        <CompactCarousel color={color} kids={kids} onPick={onPick} />
      </div>
      <div className="mt-2 border-t border-border/60 pt-2">
        <ColorLadder color={color} rungs={rungs} kids={kids} onPick={onPick} />
      </div>
    </div>
  );
}

/**
 * The 3–5 palette, EXPANDED only: two steps, both touch — the six families of
 * the page (chevrons walk the rest, so every family is reachable without a list
 * of names), then the active family's own ramp, plus black and white, which
 * closes the 200-colour catalog.
 *
 * The compact colour area is NOT here: `CompactColor` is the one component both
 * bands mount, so the bar cannot drift into a kids copy of the same rows.
 *
 * No text, no hex, no colour name: the colour is the label, and the screen
 * reader gets a position ("cor 7 de 11"), never a guess at what it is called.
 */
export function KidsPalette({
  color,
  familyIdx,
  onFamily,
  onPick,
}: {
  color: string;
  /** Index into PALETTE_FAMILIES: the page is derived from it. */
  familyIdx: number;
  onFamily: (index: number) => void;
  onPick: (hex: string) => void;
}) {
  const pages = kidFamilyPages();
  const pageIdx = Math.min(pages.length - 1, Math.floor(familyIdx / KID_FAMILIES_PER_PAGE));
  const page = pages[pageIdx]!;
  const active = PALETTE_FAMILIES[familyIdx] ?? PALETTE_FAMILIES[0]!;
  const prev = pageIdx > 0 ? (pageIdx - 1) * KID_FAMILIES_PER_PAGE : null;
  const next = pageIdx < pages.length - 1 ? (pageIdx + 1) * KID_FAMILIES_PER_PAGE : null;
  const neutral = [BLACK, WHITE];

  return (
    <div data-testid="kids-palette">
      <div className="mt-1 flex items-center justify-between">
        {prev !== null ? (
          <button
            type="button"
            onClick={() => onFamily(prev)}
            aria-label="Famílias anteriores"
            data-testid="kids-family-prev"
            className={`flex ${KID_TARGET} shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-transform duration-150 ease-out active:scale-[0.96]`}
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        ) : (
          <span aria-hidden className={KID_TARGET} />
        )}

        {next !== null ? (
          <button
            type="button"
            onClick={() => onFamily(next)}
            aria-label="Mais famílias"
            data-testid="kids-family-next"
            className={`flex ${KID_TARGET} shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-transform duration-150 ease-out active:scale-[0.96]`}
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        ) : (
          <span aria-hidden className={KID_TARGET} />
        )}
      </div>

      <div
        className="mt-1 grid grid-cols-6 justify-items-center gap-1"
        role="radiogroup"
        aria-label="Cores"
        data-testid="simple-palette"
      >
        {page.map((family) => {
          const familyIndex = PALETTE_FAMILIES.indexOf(family);
          const selected = family.base.hex.toUpperCase() === color.toUpperCase();
          return (
            <button
              key={family.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`cor ${familyIndex + 1} de ${PALETTE_FAMILIES.length}`}
              data-hex={family.base.hex}
              data-family-index={familyIndex}
              onClick={() => {
                onFamily(familyIndex);
                onPick(family.base.hex);
              }}
              style={{ background: family.base.hex }}
              className={`relative flex ${KID_TARGET} items-center justify-center rounded-full border border-border/60 transition-transform duration-150 ease-out active:scale-[0.96] ${
                selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
              }`}
            >
              {selected && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card">
                  <Check className="h-4 w-4 text-foreground" strokeWidth={2} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 border-t border-border/60 pt-2">
        {/* The row above is the matrix colour; everything under this hairline
            is a variation of it, Tailwind-style 50→950. Smaller targets and
            the line say "derived" without a single word (owner's note, 24/10). */}
        <div
          className="grid grid-cols-6 justify-items-center gap-1"
          role="radiogroup"
          aria-label={`Tons da família ${familyIdx + 1} de ${PALETTE_FAMILIES.length}`}
          data-testid="kids-tone-row"
        >
          {active.steps.map((tone, i) => {
            const selected = tone.hex.toUpperCase() === color.toUpperCase();
            return (
              <button
                key={tone.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`cor ${i + 1} de ${active.steps.length}`}
                data-hex={tone.hex}
                onClick={() => onPick(tone.hex)}
                className="flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                <span
                  aria-hidden
                  className={`h-9 w-9 rounded-full border ${
                    selected ? "border-foreground ring-2 ring-foreground" : "border-border"
                  }`}
                  style={{ background: tone.hex }}
                />
              </button>
            );
          })}
        </div>

        {/* Black and white close the 200-color catalog. They are swatches,
            not a "neutros" concept: two targets, no words. */}
        <div
          className="mt-1 grid grid-cols-6 justify-items-center gap-1"
          role="radiogroup"
          aria-label="Preto e branco"
          data-testid="kids-neutral-row"
        >
          {neutral.map((crayon, i) => {
            const selected = crayon.hex.toUpperCase() === color.toUpperCase();
            return (
              <button
                key={crayon.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`cor ${i + 1} de ${neutral.length}`}
                data-hex={crayon.hex}
                onClick={() => onPick(crayon.hex)}
                className="flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                <span
                  aria-hidden
                  className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                    selected ? "border-foreground ring-2 ring-foreground" : "border-border"
                  }`}
                  style={{ background: crayon.hex }}
                >
                  {selected && (
                    <Check
                      className={cn(
                        "h-4 w-4",
                        crayon.hex === "#FFFFFF" ? "text-foreground" : "text-background",
                      )}
                      strokeWidth={2}
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The editable channels of the advanced selector. */
const HSL_NUMBERS = [
  { key: "s", letter: "S", name: "Saturação", max: 100 },
  { key: "l", letter: "L", name: "Luminosidade", max: 100 },
  { key: "a", letter: "A", name: "Alfa", max: 100 },
] as const;

const HUE_CSS =
  "linear-gradient(to bottom, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)";

/**
 * The main color: a real picker (a saturation/lightness field plus a hue bar)
 * instead of a row of mystery swatches. Tapping the field chooses the color;
 * HSL stays the primary reading, HEX is the small secondary line. No color name
 * is ever rendered or announced — a name would be a guess.
 *
 * 3–5 gets the same picker without a single character of text and with taller
 * targets; the color is the value.
 */
function ColorPicker({
  color,
  favorite = false,
  kids = false,
  onPick,
  onToggleFavorite,
}: {
  color: string;
  favorite?: boolean;
  kids?: boolean;
  onPick: (hex: string) => void;
  onToggleFavorite?: (() => void) | undefined;
}) {
  const [hsl, setHsl] = useState<Hsl>(() => hslOfHex(color));
  const [hexDraft, setHexDraft] = useState(color.toUpperCase());
  const emitted = useRef<string | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    // A swatch from the catalog wins over our own last emission: only the
    // outside change resets the channels, so the field never snaps back.
    if (color.toLowerCase() === emitted.current) return;
    setHsl(hslOfHex(color));
    setHexDraft(color.toUpperCase());
  }, [color]);

  const emit = (next: Hsl) => {
    const hex = hexFromHsl(next);
    emitted.current = hex.toLowerCase();
    setHexDraft(hex.toUpperCase());
    onPick(hex);
  };

  const apply = (patch: Partial<Hsl>) => {
    const next = { ...hsl, ...patch };
    setHsl(next);
    emit(next);
  };

  const applyHex = (value: string) => {
    setHexDraft(value.toUpperCase());
    if (!isValidHex(value)) return;
    setHsl(hslOfHex(value));
    emit(hslOfHex(value));
  };

  const pickAt = (clientX: number, clientY: number) => {
    const rect = field.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    apply({
      s: clampPct(((clientX - rect.left) / rect.width) * 100),
      l: clampPct(100 - ((clientY - rect.top) / rect.height) * 100),
    });
  };

  return (
    // Concentric with the dock's sheet: 28 − 16 (the sheet's px-4) = 12.
    <div data-testid="hsl-picker" className="rounded-[12px] border border-border bg-background p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <ColorChip color={color} />
          {!kids && (
            <span
              data-testid="hsl-readout"
              className="type-label-sm truncate font-mono tabular-nums font-semibold text-foreground"
              aria-live="polite"
            >
              {hslLabel(hsl)}
            </span>
          )}
        </span>
        {!kids && onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label="Favoritar cor"
            aria-pressed={favorite}
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              favorite ? "text-sun" : "text-muted-foreground",
            )}
          >
            <Star className={cn("h-4 w-4", favorite && "fill-current")} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="mt-1.5 flex items-stretch gap-2">
        <div
          ref={field}
          role="slider"
          tabIndex={0}
          aria-label="Espectro de cores"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(hsl.s)}
          aria-valuetext={hslLabel(hsl)}
          data-testid="color-field"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            pickAt(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (dragging.current) pickAt(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
          onPointerCancel={() => {
            dragging.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") apply({ s: clampPct(hsl.s - 5) });
            else if (e.key === "ArrowRight") apply({ s: clampPct(hsl.s + 5) });
            else if (e.key === "ArrowUp") apply({ l: clampPct(hsl.l + 5) });
            else if (e.key === "ArrowDown") apply({ l: clampPct(hsl.l - 5) });
            else return;
            e.preventDefault();
          }}
          className={cn(
            "relative min-w-0 flex-1 cursor-crosshair rounded-lg border border-border",
            kids ? "h-40" : "h-28",
          )}
          style={{
            backgroundColor: `hsl(${Math.round(hsl.h)} 100% 50%)`,
            backgroundImage:
              "linear-gradient(to right, #FFFFFF, rgba(255,255,255,0)), linear-gradient(to top, #000000, rgba(0,0,0,0))",
          }}
        >
          {/* The chosen point: a ring, never a number. */}
          <span
            aria-hidden
            data-testid="color-field-marker"
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            style={{
              left: `${Math.min(98, Math.max(2, hsl.s))}%`,
              top: `${Math.min(98, Math.max(2, 100 - hsl.l))}%`,
              background: color,
            }}
          />
        </div>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Matiz"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={Math.round(hsl.h)}
          aria-valuetext={hslLabel(hsl)}
          data-testid="hue-bar"
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (rect.height <= 0) return;
            const ratio = Math.min(0.999, Math.max(0, (e.clientY - rect.top) / rect.height));
            apply({ h: ratio * 360 });
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") apply({ h: (hsl.h + 355) % 360 });
            else if (e.key === "ArrowUp") apply({ h: (hsl.h + 5) % 360 });
            else return;
            e.preventDefault();
          }}
          className={cn(
            "relative shrink-0 cursor-pointer rounded-full border border-border",
            kids ? "h-40 w-14" : "h-28 w-6",
          )}
          style={{ backgroundImage: HUE_CSS }}
        >
          <span
            aria-hidden
            data-testid="hue-marker"
            className="pointer-events-none absolute left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            style={{ top: `${(hsl.h / 360) * 100}%`, background: `hsl(${hsl.h} 100% 50%)` }}
          />
        </div>
      </div>

      {!kids && (
        <div className="mt-1 grid grid-cols-4 gap-1">
          {HSL_NUMBERS.map((channel) => (
            <label key={channel.key} className="flex items-center gap-1">
              <span className="font-mono text-[10px] font-semibold text-lapis">
                {channel.letter}
              </span>
              <input
                type="number"
                min={0}
                max={channel.max}
                value={Math.round(hsl[channel.key])}
                onChange={(e) => apply({ [channel.key]: Number(e.target.value) } as Partial<Hsl>)}
                aria-label={channel.name}
                className="h-6 w-full min-w-0 rounded border border-border bg-card px-1 text-right font-mono text-[10px] tabular-nums"
              />
            </label>
          ))}
        </div>
      )}

      {/* HEX is the secondary reading: small, quiet, still editable. */}
      {!kids && (
        <label className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="font-mono">HEX</span>
          <input
            value={hexDraft}
            onChange={(e) => applyHex(e.target.value)}
            aria-label="HEX (secundário)"
            className="h-6 w-20 rounded border border-border bg-card px-1 font-mono text-[10px] uppercase tabular-nums text-foreground"
          />
        </label>
      )}
    </div>
  );
}

/**
 * The palette derived from the main color: eleven Tailwind-like steps from light
 * to dark, one per published step, each under its 50..950 label. Tapping a
 * variation makes it the main color. A variation is marked ONLY when the color
 * in hand is one of the generated steps: highlighting the first swatch for every
 * other color would be a selection the user never made.
 *
 * This is the ONLY ramp of the pro panel (owner's call, 26/10). A second grid
 * under "Tons da cor" used to repeat the very same hexes: two rows of eleven
 * targets carrying the same `data-hex`, two possible `aria-checked="true"` for
 * one color, and a screen reader announcing the same collection twice. The
 * labels now ride the ramp they describe, in the same eleven-column grid, so a
 * label and its tone can never drift apart in a reflow.
 */
function Variations({
  color,
  kids = false,
  onPick,
}: {
  color: string;
  kids?: boolean;
  onPick: (hex: string) => void;
}) {
  const ramp = derivedRamp(color);
  const selected = ramp.findIndex((hex) => hex.toLowerCase() === color.toLowerCase());

  return (
    <div data-testid={kids ? "kids-variations" : "color-variations"}>
      {!kids && (
        <p className="type-label-sm font-semibold uppercase tracking-wide text-lapis">Variações</p>
      )}
      <div
        role="radiogroup"
        aria-label="Variações da cor"
        className={cn("mt-1", kids ? "flex flex-wrap gap-1" : "grid grid-cols-11 gap-1")}
      >
        {ramp.map((hex, i) => (
          <button
            key={`${hex}-${i}`}
            type="button"
            role="radio"
            aria-checked={i === selected}
            aria-label={`variação ${i + 1} de ${ramp.length}`}
            data-hex={hex}
            onClick={() => onPick(hex)}
            className={cn(
              "flex items-center justify-center transition-transform duration-150 ease-out active:scale-[0.96]",
              kids ? "h-14 w-14 rounded-full" : "h-6 rounded-md border border-border/60",
              i === selected && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
            )}
            style={kids ? undefined : { background: hex }}
          >
            {kids && (
              <span
                aria-hidden
                className={cn(
                  "h-10 w-10 rounded-full border",
                  i === selected ? "border-foreground" : "border-border",
                )}
                style={{ background: hex }}
              />
            )}
          </button>
        ))}
      </div>
      {!kids && (
        // The published step names sit under the ramp they name, same eleven
        // columns and same gap, so each label lands under its own tone at any
        // width. Hidden from the reader: the swatches already announce
        // "variação N de 11", and a number read twice is noise.
        //
        // The sheet's ramp keeps the whole published scale (`FAMILY_STEPS`, 11):
        // the ten-step `SCALE_STEPS` is the BAR's ladder, the one whose row opens
        // on white and closes on black.
        <div
          className="mt-0.5 grid grid-cols-11 gap-1"
          aria-hidden
          data-testid="color-variation-steps"
        >
          {FAMILY_STEPS.map((step) => (
            <span key={step} className="text-center text-[9px] text-muted-foreground">
              {step}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The pro palette: the advanced HSL(A) selector on top, the single derived ramp
 * (eleven tones behind their 50..950 labels) right under it, then the catalog —
 * 18 families, neutrals — plus the recent and favorite views. No swatch name is
 * ever rendered or announced.
 */
export function PaletteTray({
  kids = false,
  simple,
  color,
  kidFamily = 0,
  onKidFamily = () => {},
  recent,
  favorites,
  onPick,
  onToggleFavorite,
}: {
  kids?: boolean;
  /** No full spectrum (a pro profile whose adult turned the palette off). */
  simple: boolean;
  color: string;
  kidFamily?: number;
  onKidFamily?: (index: number) => void;
  recent: string[];
  favorites: string[];
  onPick: (hex: string) => void;
  onToggleFavorite: (hex: string) => void;
}) {
  const [tab, setTab] = useState<"cores" | "recentes" | "favoritas">("cores");

  if (kids) {
    return (
      <KidsPalette color={color} familyIdx={kidFamily} onFamily={onKidFamily} onPick={onPick} />
    );
  }

  if (simple) {
    return (
      <>
        <div className="mb-1.5 flex items-center gap-2">
          <ColorChip color={color} />
          <span className="type-label-sm font-mono tabular-nums font-semibold text-foreground">
            {hslLabel(hslOfHex(color))}
          </span>
        </div>
        <div
          className="grid grid-cols-6 justify-items-center gap-1"
          role="radiogroup"
          aria-label="Cores"
          data-testid="simple-palette"
        >
          {KID_COLORS.map((crayon, i) => (
            <button
              key={crayon.hex}
              type="button"
              role="radio"
              aria-checked={crayon.hex === color}
              aria-label={`cor ${i + 1} de ${KID_COLORS.length}`}
              data-hex={crayon.hex}
              onClick={() => onPick(crayon.hex)}
              style={{ background: crayon.hex }}
              className={cn(
                "relative flex h-14 w-14 items-center justify-center rounded-full border border-border/60",
                crayon.hex === color && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            >
              {crayon.hex === color && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card">
                  <Check className="h-4 w-4 text-foreground" strokeWidth={2} />
                </span>
              )}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div data-testid="pro-palette">
      <p className="type-label-sm font-semibold uppercase tracking-wide text-lapis">
        Cor principal
      </p>
      <ColorPicker
        color={color}
        favorite={favorites.includes(color)}
        onPick={onPick}
        onToggleFavorite={() => onToggleFavorite(color)}
      />
      <div className="mt-2 border-t border-border/60 pt-2">
        <Variations color={color} onPick={onPick} />
      </div>

      {/* The catalogue is the SAME component the compact bar mounts (owner's
          call, 26/10): one list of families, one recents view, one favourites
          view — the sheet and the bar cannot offer different colours. */}
      <PaletteCatalog color={color} recent={recent} favorites={favorites} onPick={onPick} />
    </div>
  );
}

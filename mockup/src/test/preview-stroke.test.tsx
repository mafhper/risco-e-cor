// The stroke preview IS the paper's sample (owner's call, 26/10): one short line
// painted by `paintStrokes` into a `canvasSink`, on a canvas the size of the box,
// so the grain, the taper, the dust and the can's cloud are the material's own.
// The two tools that do not leave a line are the exception and are measured as
// AREAS: the eraser punches a lane out of a field, the bucket fills the field.
//
// Seam: the dabs the preview's canvas receives. The suite reads them from the
// recording context (`fake-canvas`), and holds them against
// `stampsOf(previewCommand(...))` — the engine's own list for the same stroke.
// A vector path would paint zero ellipses; a preview that invented a factor
// would not match the stamps one by one.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installFakeCanvas } from "./fake-canvas";
import { openFold, openTools } from "./open-panel";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { StrokePreview, previewCommand, previewScale } from "@/mockup/screens/BrushShelf";
import { PREVIEW_INK, PREVIEW_PAPER, previewField } from "@/mockup/screens/BrushShelf";
import { contrastRatio } from "@/mockup/kidsMaterials";
import { FAMILY_STEPS, PALETTE_FAMILIES } from "@/mockup/palette";
import { stampsOf } from "@/mockup/brushCanvas";
import { WIDTH_WINDOW, type BrushKind, type CanvasTool } from "@/mockup/brush";
import type { Point, SpraySettings } from "@/mockup/history";

let fake: ReturnType<typeof installFakeCanvas>;

beforeEach(() => {
  localStorage.clear();
  // Installed before the first render: a preview asks for its context on mount.
  fake = installFakeCanvas();
});
afterEach(() => {
  fake.restore();
  cleanup();
  localStorage.clear();
});

/** The dabs one preview's canvas received, in painting order. */
function dabs(host: Element) {
  const canvas = host.querySelector("canvas")!;
  const ops = fake.of(canvas as HTMLCanvasElement).ops;
  // A preview measures its box before painting, so it may repaint once: the
  // drawing is everything after the LAST clear, never the sum of both frames.
  let start = 0;
  ops.forEach((op, index) => {
    if (op.op === "clearRect") start = index + 1;
  });
  // Two kinds of mark reach the paper: the ellipse of every material, and the
  // soft sprite the can stamps with `drawImage`. The recorder gives both the
  // same `[x, y, rx, ry]` in device pixels (the sprite through its transform),
  // so the readings below do not care which one a material uses — a spray that
  // read as zero dabs would be the bug, not the measurement.
  const painted = ops.slice(start).filter((op) => op.op === "ellipse" || op.op === "drawImage");
  return {
    canvas: canvas as HTMLCanvasElement,
    ops: painted.map((op) => ({
      x: op.args[op.op === "ellipse" ? 0 : 1] as number,
      y: op.args[op.op === "ellipse" ? 1 : 2] as number,
      rx: op.args[op.op === "ellipse" ? 2 : 3] as number,
      ry: op.args[op.op === "ellipse" ? 3 : 4] as number,
      alpha: op.alpha,
    })),
  };
}

/** The band the canvas actually shows, in dp: the seat plus the dab's own ry. */
function paintedBand(host: Element) {
  const { canvas, ops } = dabs(host);
  return 2 * p95(ops.map((op) => Math.abs(op.y - canvas.height / 2) + op.ry));
}

/** The 95th percentile: one shedding particle is never the band. */
function p95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

const sampleOf = (host: Element) => ({
  pixelW: Number(host.querySelector("canvas")!.getAttribute("width")),
  pixelH: Number(host.querySelector("canvas")!.getAttribute("height")),
  pixelScale: Number(host.getAttribute("data-preview-scale")),
});

function Stage(props: Parameters<typeof StrokePreview>[0]) {
  const { container } = render(<StrokePreview {...props} />);
  return container.querySelector("[data-stroke-width]")!;
}

function Harness({
  profileId = "maria",
  pageId = null,
}: {
  profileId?: string;
  pageId?: string | null;
}) {
  const { state, dispatch } = useStore();
  const id = `preview-${profileId}-${pageId ?? "blank"}`;
  const loaded = state.loaded;
  const selected = state.profileId;
  useEffect(() => {
    if (!loaded) return;
    if (selected !== profileId) dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId, selected, loaded]);
  useEffect(() => {
    dispatch({
      type: "createArtwork",
      artwork: {
        id,
        profileId,
        pageId,
        w: 300,
        h: 300,
        history: { commands: [], redo: [], undoable: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        visibility: "draft",
        publishedAt: null,
      },
    });
  }, [dispatch, profileId, pageId, id]);
  const art = state.artworks.find((a) => a.id === id);
  // The canvas is entered as a person, never before: the shell always selects
  // the profile first, and the initial material depends on that band.
  if (!art || state.profileId !== profileId) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

const mount = (profileId = "maria", pageId: string | null = null) =>
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} />
    </StoreProvider>,
  );

const widthOf = (host: Element) => Number(host.getAttribute("data-stroke-width"));
const heightOf = (host: Element) => Number(host.getAttribute("data-preview-box"));
const setSize = (next: string) =>
  fireEvent.change(screen.getByLabelText("Tamanho"), { target: { value: next } });

/** The shelf list behind the entry door: one row per material, each with its preview. */
function openList() {
  openTools();
  // The size slider lives in Ajustes, which opens CLOSED (27/10).
  openFold("fold-ajustes");
  // The door's name is the batch's to choose (the shelf's list moved from a
  // "Coleções" cell to a line under the row); the list is what this suite reads.
  const door =
    screen.queryByLabelText("Coleções de ferramentas") ??
    screen.queryByLabelText("Organizar ferramentas");
  if (door) fireEvent.click(door);
  return screen.getByTestId("shelf-sheet");
}

const rowPreview = (sheet: HTMLElement, tool: string) =>
  sheet.querySelector(`[data-tool-row="${tool}"] [data-testid="row-stroke"]`)!;

describe("the preview paints the paper's own dabs", () => {
  it("hands the canvas the engine's stamps, in order and in the box's scale", () => {
    const BOX = 88;
    const host = Stage({ tool: "brush", color: "#FB2C36", size: 40, box: BOX });

    // No vector line anywhere: the drawing is the canvas.
    expect(host.querySelector("path")).toBeNull();
    expect(host.querySelector("svg")).toBeNull();

    const { pixelW, pixelH, pixelScale } = sampleOf(host);
    const command = previewCommand({
      brush: "brush",
      color: "#FB2C36",
      size: 40,
      opacity: 100,
      pixelW,
      pixelH,
      pixelScale,
    });
    const stamps = stampsOf(command);
    const { ops } = dabs(host);

    // A real stroke, not a placeholder band.
    expect(stamps.length).toBeGreaterThan(20);
    expect(ops).toHaveLength(stamps.length);
    ops.forEach((op, index) => {
      const stamp = stamps[index]!;
      expect(op.x).toBeCloseTo(stamp.x * pixelScale, 6);
      expect(op.y).toBeCloseTo(stamp.y * pixelScale, 6);
      expect(op.rx).toBeCloseTo(stamp.rx * pixelScale, 6);
      expect(op.ry).toBeCloseTo(stamp.ry * pixelScale, 6);
      // Per-dab alpha is what a path could never carry: the grain is painted.
      expect(op.alpha).toBeCloseTo(stamp.alpha, 6);
    });
    expect(new Set(ops.map((op) => op.alpha)).size).toBeGreaterThan(1);
  });

  it("answers the size: the dabs grow, and the box holds the top of the range", () => {
    const bands = [10, 50, 100].map((size) => {
      const host = Stage({ tool: "brush", color: "#FB2C36", size, box: 88 });
      return { declared: widthOf(host), painted: paintedBand(host) };
    });

    // Declared band and painted band move together with the number in hand.
    expect(bands[1]!.declared).toBeGreaterThan(bands[0]!.declared);
    expect(bands[2]!.declared).toBeGreaterThan(bands[1]!.declared);
    expect(bands[1]!.painted).toBeGreaterThan(bands[0]!.painted);
    expect(bands[2]!.painted).toBeGreaterThan(bands[1]!.painted);

    // The widest band of the range still fits the box it was given, and the
    // middle of the range sits comfortably inside it: at the very top the
    // grain's tail is cut by the box, which is the truth of a brush at 100 —
    // the box shows the band it can hold, not a shrunken stroke.
    expect(bands[2]!.declared).toBeLessThanOrEqual(88 - 4);
    expect(bands[1]!.painted).toBeLessThanOrEqual(88);
  });

  it("answers the material: three media are three different drawings", () => {
    const counts = new Map<CanvasTool, number>();
    const bands = new Map<CanvasTool, number>();
    for (const tool of ["pencil", "brush", "charcoal"] as CanvasTool[]) {
      const host = Stage({ tool, color: "#1C1410", size: 60, box: 88 });
      counts.set(tool, dabs(host).ops.length);
      bands.set(tool, paintedBand(host));
    }

    // Charcoal sheds dust, the pencil lays a fine grain, the brush a full body:
    // three counts, and three bands — the sample is the material, not a factor.
    expect(new Set(counts.values()).size).toBe(3);
    expect(counts.get("charcoal")!).toBeGreaterThan(counts.get("pencil")!);
    expect(bands.get("brush")!).toBeGreaterThan(bands.get("pencil")!);
  });

  it("answers the opacity, dab by dab", () => {
    const solid = dabs(Stage({ tool: "brush", color: "#FB2C36", size: 60, box: 88 })).ops;
    const thin = dabs(
      Stage({ tool: "brush", color: "#FB2C36", size: 60, box: 88, opacity: 40 }),
    ).ops;

    const peak = (ops: { alpha: number }[]) => Math.max(...ops.map((op) => op.alpha));
    expect(peak(thin)).toBeCloseTo(peak(solid) * 0.4, 5);
  });

  it("answers the nozzle: the cloud opens with Dispersão, never with Intensidade", () => {
    const nozzle = (patch: Partial<SpraySettings>): SpraySettings => ({
      tip: 0.1,
      spread: 0.55,
      intensity: 0.6,
      ...patch,
    });
    const tight = Stage({
      tool: "spray",
      color: "#2B7FFF",
      size: 60,
      box: 88,
      spray: nozzle({ spread: 0.05 }),
    });
    const wide = Stage({
      tool: "spray",
      color: "#2B7FFF",
      size: 60,
      box: 88,
      spray: nozzle({ spread: 1.2 }),
    });
    const dense = Stage({
      tool: "spray",
      color: "#2B7FFF",
      size: 60,
      box: 88,
      spray: nozzle({ intensity: 1 }),
    });
    const sparse = Stage({
      tool: "spray",
      color: "#2B7FFF",
      size: 60,
      box: 88,
      spray: nozzle({ intensity: 0.2 }),
    });

    expect(paintedBand(wide)).toBeGreaterThan(paintedBand(tight));
    expect(widthOf(wide)).toBeGreaterThan(widthOf(tight));
    // Intensidade is density, never width: more droplets, same cloud.
    expect(dabs(dense).ops.length).toBeGreaterThan(dabs(sparse).ops.length);
    expect(widthOf(dense)).toBe(widthOf(sparse));
  });
});

describe("the sheet's preview is the stroke in hand", () => {
  it("follows the tool and the size, and never stops growing at 50", () => {
    mount("maria");
    openTools();
    // The size slider lives in Ajustes, which opens CLOSED (27/10).
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Pincel"));
    const preview = () => screen.getByTestId("param-preview");

    setSize("10");
    const thin = widthOf(preview());
    setSize("51");
    const medium = widthOf(preview());
    setSize("100");
    const thick = widthOf(preview());

    // The old clamp froze everything above 34 units: 51 and 100 were the same.
    expect(medium).toBeGreaterThan(thin);
    expect(thick).toBeGreaterThan(medium);
    expect(preview()).toHaveAttribute("data-size", "100");
    expect(preview()).toHaveAttribute("data-brush", "brush");
    // The sheet's box is the tall one: a real band needs a real box.
    expect(heightOf(preview())).toBe(96);

    // Another material keeps its own grain at the same authored size.
    fireEvent.click(screen.getByLabelText("Lápis"));
    expect(preview()).toHaveAttribute("data-brush", "pencil");
    expect(widthOf(preview())).toBeLessThan(thick);
  });

  it("draws the material's own texture, not a generic line", () => {
    mount("maria");
    openTools();
    // The size slider lives in Ajustes, which opens CLOSED (27/10).
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Aquarela"));
    const wash = dabs(screen.getByTestId("param-preview")).ops;
    // A wash is many faint dabs: no single dab is opaque, and there are many.
    expect(wash.length).toBeGreaterThan(20);
    expect(Math.max(...wash.map((op) => op.alpha))).toBeLessThan(0.35);

    fireEvent.click(screen.getByLabelText("Marcador"));
    // The marker deposits a flat plate — square dabs, so no ellipse at all —
    // and its declared ink is the solid one.
    expect(Number(screen.getByTestId("param-preview").getAttribute("data-stroke-opacity"))).toBe(1);
    expect(
      Number(screen.getByTestId("param-preview").getAttribute("data-stroke-opacity")),
    ).toBeGreaterThan(Number(wash[0]!.alpha));
  });
});

describe("the compact bar previews on top, with no title", () => {
  it("sits above the thickness row, in the tall box, and follows the material", () => {
    mount("maria");
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    const preview = within(compact).getByTestId("compact-preview");
    const thickness = within(compact).getByTestId("compact-thickness");

    expect(
      preview.compareDocumentPosition(thickness) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(preview).toHaveAttribute("data-brush", "brush");
    expect(heightOf(preview)).toBe(88);
    // The preview is the FIRST row of the card's CONTENT: the sheet handle that
    // used to sit above it left the panel (27/10), and the row itself carries no
    // reading text. The only node ahead of it is the drawer's latch, which hangs
    // OUTSIDE the box (`bottom-full`) — a control on the top edge, not a row.
    const row = within(compact).getByTestId("compact-preview-row");
    expect(compact.firstElementChild).toBe(within(compact).getByTestId("chrome-panel"));
    expect(row.previousElementSibling).toBe(compact.firstElementChild);
    expect(row.textContent?.trim() ?? "").toBe("");
  });
});

describe("the list of materials: one band per material, at the size in hand", () => {
  it("keeps the brushes distinguishable above 50", () => {
    mount("maria");
    const sheet = openList();
    setSize("100");

    const pencil = widthOf(rowPreview(sheet, "pencil"));
    const marker = widthOf(rowPreview(sheet, "marker"));
    const wash = widthOf(rowPreview(sheet, "watercolor"));
    const spray = widthOf(rowPreview(sheet, "spray"));
    expect(new Set([pencil, marker, wash, spray]).size).toBe(4);
  });

  it("scales every row with the size, so 20 and 100 are not the same drawing", () => {
    mount("maria");
    const sheet = openList();
    setSize("20");
    const small = widthOf(rowPreview(sheet, "brush"));
    setSize("100");
    const large = widthOf(rowPreview(sheet, "brush"));
    expect(large).toBeGreaterThan(small * 2);
  });
});

/**
 * PARITY: the declared number and the paper, in the same unit (`previa-fiel`
 * §9). The preview now paints with the engine, so this gate has moved to what it
 * was always about: the NUMBER in hand (`data-stroke-width`, converted back into
 * authored units) against the width the engine deposits on the sheet (the
 * painted edge: `2 × P95` of a stamp's half across, `espessura-raster.md` §10.2).
 * It is the one place the pen's promise is measured from the other side, and it
 * is charged by the paper — never by the preview reading itself.
 *
 * Gate: `espessura-raster.md` §10.2 — both readings inside 1 ± 0.10 of the
 * authored size, for every stroke medium. The can is charged by the nozzle
 * instead, because its band IS `2 × (Ponta + Dispersão)`.
 */
describe("the number in hand is the width on the paper", () => {
  const BOX = 88;
  /** The engine suite's own reference stroke: 300 units, sampled every 6. */
  const line = (from: number, to: number, step: number, y = 100): Point[] => {
    const points: Point[] = [];
    for (let x = from; x <= to + 0.001; x += step) points.push([x, y]);
    return points;
  };
  const p95 = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return (
      sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.95))] ?? Number.NaN
    );
  };
  /** The grain is per stroke id, so a band is the median of three ids. */
  const IDS = ["parity-a", "parity-b", "parity-c"];

  /** The middle of the three readings: one stroke's grain is never the gate. */
  const ofMedian = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) / 2)]!;
  };

  /**
   * What the paper deposits, as a fraction of the authored size — the PAINTED
   * edge, `2 × P95(|across| + ry)` (espessura-raster.md §10.2). The old account
   * added the P95 of the seat to the MEDIAN of the particle, which reads the
   * middle of the grain instead of its border: it under-read the brush by ~18%
   * and would have passed a line a fifth wider than the number in hand.
   */
  const paperBand = (brush: BrushKind, size: number) =>
    ofMedian(
      IDS.map((id) => {
        const points = line(0, 300, 6);
        const stamps = stampsOf({ id, brush, size, points });
        return (2 * p95(stamps.map((s) => Math.abs(s.y - 100) + s.ry))) / size;
      }),
    );

  /** The number the preview declares, exactly as the screen paints it. */
  const previewWidth = (tool: CanvasTool, size: number, spray?: SpraySettings) => {
    const host = Stage({ tool, color: "#000000", size, box: BOX, spray });
    return widthOf(host);
  };

  /** What the preview promises, reconverted from dp into authored units. */
  const previewBand = (tool: CanvasTool, size: number, spray?: SpraySettings) =>
    previewWidth(tool, size, spray) / previewScale(BOX) / size;

  it("matches the paper inside the ±10% window for all seven stroke media", () => {
    const strokes: BrushKind[] = [
      "pencil",
      "charcoal",
      "crayon",
      "watercolor",
      "oil",
      "brush",
      "marker",
    ];
    for (const size of [12, 60]) {
      for (const brush of strokes) {
        const paper = paperBand(brush, size);
        const preview = previewBand(brush, size);
        expect(
          Math.abs(paper - 1),
          `${brush}@${size}: paper deposits ${paper.toFixed(3)} of the size`,
        ).toBeLessThanOrEqual(WIDTH_WINDOW);
        expect(
          Math.abs(preview - 1),
          `${brush}@${size}: preview promises ${preview.toFixed(3)} of the size`,
        ).toBeLessThanOrEqual(WIDTH_WINDOW);
      }
    }
  });

  it("keeps the dropper alive with the size, instead of a fixed 8", () => {
    // The defect this closes: the fallback was a fixed band at EVERY size, so
    // the line did not move from 1 to 100 while the size capsule edited a number
    // neither side read. The dropper has no stroke of its own, so it previews
    // the pen's target at the size in hand.
    //
    // The BUCKET used to be here too and left on 27/10 (owner's feedback): a
    // bucket does not leave a line, so its preview is a plate — see the area
    // test below, where the declared band is zero on purpose.
    const tool: CanvasTool = "eyedropper";
    expect(previewBand(tool, 12), tool).toBeCloseTo(1, 2);
    expect(previewBand(tool, 100), tool).toBeCloseTo(1, 2);
    // …and it GROWS with the size: 20 and 100 are not the same drawing.
    const bands = [12, 25, 50, 100].map((size) => previewWidth(tool, size));
    expect(bands[3]!).toBeGreaterThan(bands[0]! * 8);
  });

  it("draws the bucket as a full plate: zero dabs, the same box every material gets", () => {
    // Owner's feedback, 27/10: the bucket's preview used to be a line — the one
    // thing the bucket never leaves. What the strip owes now is the AREA the
    // tool covers: the whole field in the colour in hand.
    const fillHost = Stage({ tool: "fill", color: "#1E3AC8", size: 60, box: BOX });
    const brushHost = Stage({ tool: "brush", color: "#1E3AC8", size: 60, box: BOX });

    // Zero stroke, and the mode says AREA — never "stroke".
    expect(fillHost.getAttribute("data-preview-mode")).toBe("area");
    expect(fillHost.getAttribute("data-preview-plate")).toBe("full");
    expect(Number(fillHost.getAttribute("data-stroke-width"))).toBe(0);
    expect(brushHost.getAttribute("data-preview-mode")).toBe("stroke");
    expect(Number(brushHost.getAttribute("data-stroke-width"))).toBeGreaterThan(0);

    // The box does NOT change between materials: the strip keeps its size and
    // only what it says changes.
    expect(heightOf(fillHost)).toBe(heightOf(brushHost));
    expect(fillHost.getAttribute("data-preview-box")).toBe(
      brushHost.getAttribute("data-preview-box"),
    );
    expect(fillHost.getAttribute("data-preview-scale")).toBe(
      brushHost.getAttribute("data-preview-scale"),
    );

    // The field behind the plate is still the computed one (paper, or ink when
    // paper cannot carry the colour) — the same rule every sample obeys.
    expect(fillHost.getAttribute("data-preview-surface")).toBe(previewField("#1E3AC8").surface);

    // The plate covers the FIELD, in the colour in hand, and paints ZERO dabs:
    // one full-bleed fillRect, no ellipse and no sprite.
    const canvas = fillHost.querySelector("canvas") as HTMLCanvasElement;
    const ops = fake.of(canvas).ops;
    let start = 0;
    ops.forEach((op, index) => {
      if (op.op === "clearRect") start = index + 1;
    });
    const painted = ops.slice(start);
    const plates = painted.filter((op) => op.op === "fillRect");
    expect(plates).toHaveLength(1);
    expect(plates[0]!.args).toEqual([0, 0, canvas.width, canvas.height]);
    expect(plates[0]!.fill).toBe("#1E3AC8");
    expect(painted.some((op) => op.op === "ellipse" || op.op === "drawImage")).toBe(false);

    // The brush in the same box is the opposite reading: dabs, no plate.
    const brushOps = fake.of(brushHost.querySelector("canvas") as HTMLCanvasElement).ops;
    expect(brushOps.some((op) => op.op === "ellipse" || op.op === "drawImage")).toBe(true);
    expect(brushOps.some((op) => op.op === "fillRect")).toBe(false);
  });

  it("reads the can's nozzle on all three axes, never a fixed factor", () => {
    // The can declares the cloud as `2 × (Ponta + Dispersão)`: Dispersão is a ±
    // deviation and Ponta a radius, so the droplet adds Ponta on each side of the
    // seat. The paper is measured the same way — the seat's P95 plus the nozzle's
    // own Ponta — and the two readings must agree inside the window.
    const paperCloud = (nozzle: SpraySettings, size: number) =>
      ofMedian(
        IDS.map((id) => {
          const points = line(0, 900, 4);
          const stamps = stampsOf({ id, brush: "spray", size, points, spray: nozzle });
          const seat = p95(stamps.map((s) => Math.abs(s.y - 100)));
          return (2 * (seat + nozzle.tip * size)) / size;
        }),
      );
    const nozzles: SpraySettings[] = [
      // the shelf's own nozzle
      { tip: 0.1, spread: 0.55, intensity: 0.6 },
      // Ponta and Intensidade at the floor, then at the ceiling
      { tip: 0.04, spread: 0.55, intensity: 0.2 },
      { tip: 0.2, spread: 0.55, intensity: 1 },
      // Dispersão nearly shut, then wide open
      { tip: 0.1, spread: 0.05, intensity: 0.6 },
      { tip: 0.1, spread: 1.2, intensity: 0.6 },
    ];
    for (const nozzle of nozzles) {
      const cloud = 2 * (nozzle.tip + nozzle.spread);
      for (const size of [60, 100]) {
        const paper = paperCloud(nozzle, size);
        expect(
          previewBand("spray", size, nozzle),
          `nozzle ${nozzle.tip}/${nozzle.spread}`,
        ).toBeCloseTo(cloud, 2);
        expect(
          Math.abs(paper / cloud - 1),
          `paper vs nozzle ${nozzle.tip}/${nozzle.spread} at ${size}`,
        ).toBeLessThanOrEqual(WIDTH_WINDOW);
      }
    }

    // Intensidade is density, never width: more paint per step, same cloud.
    const soft = previewWidth("spray", 60, { tip: 0.1, spread: 0.55, intensity: 0.2 });
    const hard = previewWidth("spray", 60, { tip: 0.1, spread: 0.55, intensity: 1 });
    expect(hard).toBe(soft);
  });
});

/** The compact bar's switch: the latch on the drawer's own top edge. */
describe("the mode switch is the drawer's latch, not a desk door", () => {
  it("is the circle with a glyph, glued to the bar's top edge, centred on it", async () => {
    mount("maria");
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");

    const toggle = screen.getByTestId("chrome-panel");
    // Owner's report (27/10): floating on the desk's top-right the door sat far
    // from the panel it opens. It is the drawer's CHILD now, hanging from the
    // bar's top edge and centred on it — outside the box, so it still never
    // enters the colour area or the card's rows.
    expect(compact.contains(toggle)).toBe(true);
    expect(toggle.parentElement).toBe(compact);
    expect(toggle.className).toContain("bottom-full");
    expect(toggle.className).toContain("left-1/2");
    expect(within(compact).queryByTestId("dock-handle")).toBeNull();
    expect(within(compact).queryByTestId("dock-handle-row")).toBeNull();
    expect(within(compact).getByTestId("compact-color")).not.toContainElement(toggle);
    // A switch, not a destination: it claims the state and names the region, and
    // it draws a PANEL glyph — never an arrow, never a sheet handle.
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "canvas-dock-region");
    expect(toggle.querySelector("svg")?.getAttribute("data-glyph")).toBe("panel");

    // …and it still opens the sheet.
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
  });

  it("is a 52dp door on 3-5, the band whose second level is the look folds", () => {
    mount("theo", null);
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    const toggle = screen.getByTestId("chrome-panel");
    // The door's own size, the same as the row's: 44dp on 9+, 52dp on 3-5.
    expect(toggle).toHaveClass("w-13", "h-13");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // The child's band has no pro sheet: the same door opens the SECOND LEVEL of
    // the intermediate panel (the two look folds) and never a shelf.
    expect(within(compact).queryByLabelText("Mais ajustes")).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByTestId("kids-look")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
  });
});

/**
 * The eraser is previewed INVERTED (owner's call, 26/10): a field of paint with
 * the band the rubber takes OUT of it. The old preview drew the path the hand
 * walks, which is the one thing an eraser never leaves behind — what the strip
 * owes is the size of the hole.
 */
describe("the eraser's preview is the hole, not the stroke", () => {
  it("lays a field over the box and punches it with the engine's own stamps", () => {
    const host = Stage({ tool: "eraser", color: "#FB2C36", size: 40, box: 88 });
    expect(host.getAttribute("data-preview-mode")).toBe("erased");

    const canvas = host.querySelector("canvas") as HTMLCanvasElement;
    const ops = fake.of(canvas).ops;
    let start = 0;
    ops.forEach((op, index) => {
      if (op.op === "clearRect") start = index + 1;
    });
    const frame = ops.slice(start);

    // 1. The paint: the whole box, before anything is taken out.
    const field = frame.find((op) => op.op === "fillRect")!;
    expect(field).toBeTruthy();
    expect(field.args).toEqual([0, 0, canvas.width, canvas.height]);
    expect(field.composite).toBe("source-over");

    // 2. The hole: the same stamps the paper would drop, issued as a cut, and
    // the narrow band of the size in hand — not the whole strip.
    const punched = frame.filter((op) => op.op === "ellipse");
    expect(punched.length).toBeGreaterThan(0);
    expect(punched.every((op) => op.composite === "destination-out")).toBe(true);
    const widest = Math.max(...punched.map((op) => Number(op.args[3]) * 2));
    const declared = Number(host.getAttribute("data-stroke-width"));
    expect(widest / declared).toBeGreaterThan(0.8);
    expect(widest / declared).toBeLessThan(1.2);
  });

  it("keeps a brush a stroke: no field, no cut", () => {
    const host = Stage({ tool: "brush", color: "#FB2C36", size: 40, box: 88 });
    expect(host.getAttribute("data-preview-mode")).toBe("stroke");

    const canvas = host.querySelector("canvas") as HTMLCanvasElement;
    const ops = fake.of(canvas).ops;
    expect(ops.some((op) => op.op === "fillRect")).toBe(false);
    expect(ops.some((op) => op.composite === "destination-out")).toBe(false);
  });
});

/**
 * The FIELD behind the sample (owner's defect, 27/10, item 11): the strip was
 * always the panel's paper, so a lilac, a yellow or a white stroke nearly vanished
 * into it. The field is now chosen from the colour in hand.
 *
 * Seam: the strip's DOM contract (`data-preview-color`, `data-preview-surface`,
 * `data-preview-contrast`, `data-preview-ring`) plus the canvas ops the engine
 * already receives. The ratio is measured by `kidsMaterials`' WCAG function — a
 * SEPARATE implementation from the `palette` one the component calls — so a
 * formula mistake on one side cannot agree with itself. The floor is written here
 * as the literal `3` the requirement names: lowering the component's constant
 * cannot lower this gate.
 */
describe("the field behind the sample is computed for contrast", () => {
  const FLOOR = 3;
  const surfaceOf = (host: Element) => host.getAttribute("data-preview-surface")!;
  const pairOf = (host: Element) => {
    const color = host.getAttribute("data-preview-color")!;
    const surface = surfaceOf(host);
    return { color, surface, ratio: contrastRatio(color, surface) };
  };
  const rgbOf = (hex: string) =>
    `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
  /** The palette's own 200 steps: the light paints the owner reported. */
  const lightSwatches = ["amarelo", "roxo", "rosa"].map((id) => {
    const family = PALETTE_FAMILIES.find((f) => f.id === id)!;
    return family.steps[FAMILY_STEPS.indexOf(200)]!.hex;
  });
  const LILAC = lightSwatches[1]!;

  it("gives a light stroke the ink field, clearing 3:1 against it", () => {
    // White, the paper itself and the palette's own light steps (the lilac, the
    // yellow and the pink that used to disappear into the strip).
    for (const color of ["#FFFFFF", "#F2ECE0", ...lightSwatches]) {
      const host = Stage({ tool: "brush", color, size: 40, box: 88 });
      const { surface, ratio } = pairOf(host);
      expect(surface, color).toBe(PREVIEW_INK);
      expect(ratio, `${color} on ${surface}`).toBeGreaterThanOrEqual(FLOOR);
      // The field is really painted behind the canvas, not only declared.
      expect((host as HTMLElement).style.backgroundColor).toBe(rgbOf(surface));
    }
  });

  it("keeps the paper for a dark stroke, likewise above the floor", () => {
    for (const color of ["#1C1410", "#000000", "#7B2D3A", "#2F6E8A"]) {
      const host = Stage({ tool: "brush", color, size: 40, box: 88 });
      const { surface, ratio } = pairOf(host);
      expect(surface, color).toBe(PREVIEW_PAPER);
      expect(ratio, `${color} on ${surface}`).toBeGreaterThanOrEqual(FLOOR);
    }
    // The two anchors are the project's own stock, and the pair is the same
    // 15.4:1 the kid plate is measured at — no new colour was invented.
    expect(contrastRatio(PREVIEW_PAPER, PREVIEW_INK)).toBeCloseTo(15.43, 2);
  });

  it("is local: the same hex always gets the same field", () => {
    // Same colour across four materials, sizes, boxes and letter cases.
    const fields = [
      Stage({ tool: "brush", color: LILAC, size: 40, box: 88 }),
      Stage({ tool: "pencil", color: LILAC, size: 8, box: 22 }),
      Stage({ tool: "spray", color: LILAC.toLowerCase(), size: 90, box: 96 }),
      Stage({ tool: "eraser", color: LILAC, size: 60, box: 88 }),
    ].map(surfaceOf);
    expect(new Set(fields).size).toBe(1);
    expect(fields[0]).toBe(PREVIEW_INK);

    // Two DIFFERENT light colours do not diverge by chance.
    const lights = ["#FFFFFF", "#F2ECE0", ...lightSwatches].map((c) => previewField(c).surface);
    expect(new Set(lights).size).toBe(1);
    // …and the decision is a pure function of the hex.
    expect(previewField(LILAC)).toEqual(previewField(LILAC));
  });

  it("wears the interface's 1px contour ring around the area", () => {
    const host = Stage({ tool: "brush", color: "#FFFFFF", size: 40, box: 88 });
    const ring = host.querySelector("[data-preview-ring]") as HTMLElement | null;
    expect(ring).not.toBeNull();
    expect(ring!.getAttribute("aria-hidden")).toBe("true");
    expect(ring!.style.boxShadow).toContain("inset");
    expect(ring!.style.boxShadow).toContain("1px");
    expect(ring!.style.boxShadow).toContain("var(--border)");
    // ON TOP of the sample, so the eraser's field cannot hide the edge.
    const canvas = host.querySelector("canvas")!;
    expect(canvas.compareDocumentPosition(ring!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the sample painted by the engine, not by a parallel table", () => {
    // The field changed for this colour; the drawing did not. Same seam as the
    // first suite: the dabs are `stampsOf(previewCommand(...))`, one by one.
    const color = "#FDE68A";
    const host = Stage({ tool: "charcoal", color, size: 60, box: 88 });
    expect(surfaceOf(host)).toBe(PREVIEW_INK);
    const { pixelW, pixelH, pixelScale } = sampleOf(host);
    const stamps = stampsOf(
      previewCommand({
        brush: "charcoal",
        color,
        size: 60,
        opacity: 100,
        pixelW,
        pixelH,
        pixelScale,
      }),
    );
    const { ops } = dabs(host);
    expect(ops).toHaveLength(stamps.length);
    ops.forEach((op, index) => {
      const stamp = stamps[index]!;
      expect(op.x).toBeCloseTo(stamp.x * pixelScale, 6);
      expect(op.y).toBeCloseTo(stamp.y * pixelScale, 6);
      expect(op.rx).toBeCloseTo(stamp.rx * pixelScale, 6);
      expect(op.ry).toBeCloseTo(stamp.ry * pixelScale, 6);
    });
    expect(host.querySelector("path")).toBeNull();
    expect(host.querySelector("svg")).toBeNull();
  });
});

/** The computed field is the component's, so both boxes and both bands inherit it. */
describe("the computed field reaches both preview boxes, on both bands", () => {
  const FLOOR = 3;
  const check = (host: Element) => {
    const color = host.getAttribute("data-preview-color")!;
    const surface = host.getAttribute("data-preview-surface")!;
    expect([PREVIEW_PAPER, PREVIEW_INK]).toContain(surface);
    expect(contrastRatio(color, surface)).toBeGreaterThanOrEqual(FLOOR);
    // The declared number is the measured pair, not a guess.
    expect(Number(host.getAttribute("data-preview-contrast"))).toBeCloseTo(
      contrastRatio(color, surface),
      1,
    );
    expect(host.querySelector("[data-preview-ring]")).not.toBeNull();
  };

  it("the sheet's box, on the pro band", () => {
    mount("maria");
    openTools();
    // The size slider lives in Ajustes, which opens CLOSED (27/10).
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Pincel"));
    check(screen.getByTestId("param-preview"));
  });

  it("the compact bar on the pro band", () => {
    mount("maria");
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    check(within(screen.getByTestId("canvas-compact")).getByTestId("compact-preview"));
  });

  it("the compact bar on 3-5", () => {
    mount("theo", null);
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    check(within(screen.getByTestId("canvas-compact")).getByTestId("compact-preview"));
  });
});

// The stroke texture engine: the media's GRAIN, not a cosmetic dash.
//
// Seam 1 (this file): `strokesOf` — a pure function of the command. Same id and
// same points must replay byte-identical geometry, because undo/redo, autosave
// and the artwork preview all re-derive the drawing from the command list.
//
// Seam 2 (bottom): the renderer emits one <path> per layer, never one per stamp.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { derive, strokeHit, type Point, type StrokeCommand } from "@/mockup/history";
import { THICKNESS_TOLERANCE, type BrushKind } from "@/mockup/brush";
import { MAX_STAMPS, strokesOf, type StrokeLayer } from "@/mockup/strokeTexture";
import { ArtworkSvg } from "@/mockup/ArtworkSvg";

const line = (n = 12): Point[] => Array.from({ length: n }, (_, i) => [10 + i * 8, 40 + i * 2]);

/** A stamp is one closed sub-path; counting `Z` counts stamps, independently. */
const stampCount = (layers: StrokeLayer[]) =>
  layers
    .filter((l) => l.mode === "stamp")
    .reduce((sum, l) => sum + (l.d.match(/Z/g)?.length ?? 0), 0);

const stroke = (patch: Partial<StrokeCommand> = {}): StrokeCommand => ({
  t: "stroke",
  id: "s1",
  color: "#FB2C36",
  size: 8,
  points: line(),
  brush: "crayon",
  ...patch,
});

describe("stroke texture: deterministic", () => {
  it("replays the same geometry for the same id, and a different one for another id", () => {
    const a = strokesOf(stroke());
    const b = strokesOf(stroke());
    expect(b.map((l) => l.d)).toEqual(a.map((l) => l.d));
    // The seed is the stroke id: two strokes are never the same grain.
    const c = strokesOf(stroke({ id: "s2" }));
    expect(c.map((l) => l.d)).not.toEqual(a.map((l) => l.d));
  });
});

describe("stroke texture: bounded", () => {
  it("caps a 4000 px stroke at MAX_STAMPS in total, across at most 3 layers", () => {
    // 401 points, 10 px apart: without the cap this would carry ~1300 stamps.
    const long = Array.from({ length: 401 }, (_, i) => [20, 20 + i * 10] as Point);
    for (const brush of [
      "crayon",
      "charcoal",
      "spray",
      "pencil",
      "oil",
      "watercolor",
    ] as BrushKind[]) {
      const layers = strokesOf(stroke({ brush, points: long }));
      // The budget is per stroke: the watercolour's second pass spends from the
      // same 200, it does not get its own.
      expect(stampCount(layers), brush).toBeLessThanOrEqual(MAX_STAMPS);
      expect(layers.length, brush).toBeLessThanOrEqual(3);
      const chars = layers
        .filter((l) => l.mode === "stamp")
        .reduce((sum, l) => sum + l.d.length, 0);
      expect(chars, brush).toBeLessThan(13000);
    }
    // And the grain is really there: the cap did not starve it.
    expect(stampCount(strokesOf(stroke({ points: long })))).toBeGreaterThan(50);
  });
});

describe("stroke texture: each material is its own grain", () => {
  const of = (brush: BrushKind) => strokesOf(stroke({ brush, id: "same" }));

  it("gives grain where the material has it and keeps the marker and brush solid", () => {
    for (const brush of ["crayon", "charcoal", "pencil", "oil"] as BrushKind[]) {
      expect(
        of(brush).some((l) => l.mode === "stamp"),
        brush,
      ).toBe(true);
    }
    for (const brush of ["marker", "brush"] as BrushKind[]) {
      expect(of(brush)).toHaveLength(1);
      expect(of(brush)[0]!.mode).toBe("stroke");
    }
    // Spray is grain only: droplets, never a solid line.
    expect(of("spray")).toHaveLength(1);
    expect(of("spray")[0]!.mode).toBe("stamp");
  });

  it("never paints two materials with the same geometry", () => {
    const seen = new Map<string, string>();
    for (const brush of [
      "crayon",
      "charcoal",
      "spray",
      "pencil",
      "oil",
      "watercolor",
    ] as BrushKind[]) {
      const geometry = of(brush)
        .map((l) => l.d)
        .join("|");
      const previous = seen.get(geometry);
      expect(previous, `${brush} drew the same geometry as ${previous}`).toBeUndefined();
      seen.set(geometry, brush);
    }
  });

  it("washes watercolour twice only on a long stroke", () => {
    const short = strokesOf(stroke({ brush: "watercolor", points: line(4) }));
    expect(short.filter((l) => l.role === "wash")).toHaveLength(1);

    const long = strokesOf(
      stroke({
        brush: "watercolor",
        points: Array.from({ length: 60 }, (_, i) => [20, 20 + i * 8]),
      }),
    );
    expect(long.filter((l) => l.role === "wash")).toHaveLength(2);
    expect(long.length).toBeLessThanOrEqual(3);
  });
});

describe("stroke texture: the band is the pen's thickness (owner's call, 26/10)", () => {
  const horizontal = Array.from({ length: 24 }, (_, i) => [20 + i * 8, 100] as Point);
  const SIZE = 30;
  /**
   * The replay's own band, as the PROFILE declares it: the core's half-width,
   * and each stamp's reach = its radius plus the scatter (mean over a uniform
   * ±s is s/2, so the nominal scatter is twice the mean). Stamps are
   * `M{cx-rx} {cy}a{rx} {ry} …`.
   */
  const bandOf = (brush: BrushKind) => {
    const layers = strokesOf({ id: "band", size: SIZE, points: horizontal, brush });
    const core = layers.find((l) => l.mode === "stroke");
    let half = (core?.width ?? 0) / 2;
    const radii: number[] = [];
    const offsets: number[] = [];
    for (const layer of layers.filter((l) => l.mode === "stamp")) {
      for (const m of layer.d.matchAll(
        /M(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)a(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g,
      )) {
        offsets.push(Math.abs(Number(m[2]) - 100));
        radii.push(Number(m[3]));
      }
    }
    if (radii.length > 0) {
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      half = Math.max(half, mean(radii) + 2 * mean(offsets));
    }
    return half * 2;
  };

  it("paints every grain inside the declared tolerance of the authored size", () => {
    for (const brush of [
      "crayon",
      "charcoal",
      "pencil",
      "oil",
      "watercolor",
      "spray",
    ] as BrushKind[]) {
      const band = bandOf(brush);
      const ratio = band / SIZE;
      expect(Math.abs(ratio - 1), `${brush}: ${ratio.toFixed(2)} of ${SIZE}`).toBeLessThanOrEqual(
        THICKNESS_TOLERANCE,
      );
      // Not narrower either: a material may not hide behind its own core.
      expect(ratio, brush).toBeGreaterThanOrEqual(1 - THICKNESS_TOLERANCE);
    }
  });
});

describe("stroke texture: one path per layer, never per stamp", () => {
  afterEach(cleanup);

  const renderCommands = (commands: StrokeCommand[]) => {
    const { container } = render(<ArtworkSvg w={600} h={600} pageId={null} commands={commands} />);
    return [...container.querySelectorAll("path[data-layer]")];
  };

  it("renders the grain as a second filled path and drops the core dash", () => {
    const paths = renderCommands([stroke()]);
    expect(paths.map((p) => p.getAttribute("data-layer"))).toEqual(["core", "grain"]);

    const [core, grain] = paths;
    // Core: painted with the colour as an outline, and no dash left to double
    // the texture.
    expect(core!.getAttribute("stroke")).toBe("#FB2C36");
    expect(core!.getAttribute("stroke-dasharray")).toBeNull();
    // Grain: the same colour as a FILL of the stamp sub-paths.
    expect(grain!.getAttribute("fill")).toBe("#FB2C36");
    expect(grain!.getAttribute("stroke")).toBe("none");
  });

  it("keeps a legacy stroke with no brush as a single plain path", () => {
    const legacy = stroke();
    delete legacy.brush;
    const paths = renderCommands([legacy]);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.getAttribute("data-layer")).toBe("core");
    expect(paths[0]!.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("draws the spray as grain only, with no solid line at all", () => {
    const paths = renderCommands([stroke({ brush: "spray" })]);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.getAttribute("data-layer")).toBe("grain");
  });

  it("keeps the grain in artwork units, so zoom scales it and never re-randomises", () => {
    const pathsAt = (size: number) => {
      const { container } = render(
        <ArtworkSvg w={size} h={size} pageId={null} commands={[stroke()]} />,
      );
      const d = [...container.querySelectorAll("path[data-layer]")].map((p) => p.getAttribute("d"));
      cleanup();
      return d;
    };
    // Same command, two canvas sizes: identical geometry. The zoom is the SVG's
    // job, so the grain never re-seeds when the paper is scaled.
    expect(pathsAt(1200)).toEqual(pathsAt(400));
  });
});

describe("stroke texture: the old whole-stroke erase is still exact", () => {
  it("hits a grainy stroke by its line, and an id erase takes core and grain", () => {
    const s = stroke({ brush: "crayon", size: 10 });
    // A point on the polyline hits; the grain is not the hit target.
    expect(strokeHit(s, [20, 42], 2)).toBe(true);
    expect(strokeHit(s, [500, 500], 2)).toBe(false);

    // The whole-stroke command still removes core AND grain at once, because the
    // command list is the source of truth, not the rendered paths (the area
    // eraser cuts the same layers at its spans — `eraser-area.test.tsx`).
    const after = derive([s, { t: "erase", strokeIds: [s.id] }]);
    expect(after.strokes).toHaveLength(0);
  });
});

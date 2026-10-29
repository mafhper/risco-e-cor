// The exported file is the SHEET, not the screen (export-png.md §1).
//
// jsdom has no 2d canvas (see setup.ts), so this file measures the two seams
// that do not need pixels:
//   - the plan, which is a pure description of the file;
//   - the stamp flow, at the same sink ArtworkPaint paints through.
// Pixel output is confirmed in a browser, never asserted here.
import { describe, expect, it } from "vitest";
import { paintStrokes, stampsOf, type Stamp, type StampSink } from "@/mockup/brushCanvas";
import { derive, type Command, type StrokeCommand } from "@/mockup/history";
import { exportArtwork, fileOutline, fileRegions } from "@/mockup/exportPng";
import { PAPERS, PAPER_KEYS } from "@/mockup/palette";
import { pageById } from "@/mockup/pages";

const PHONE_SHEET = { w: 300, h: 650 };
const SPEC_SHEET = { w: 300, h: 420 };

const stroke = (id: string, extra: Partial<StrokeCommand> = {}): StrokeCommand => ({
  t: "stroke",
  id,
  color: "#E8423F",
  size: 6,
  points: [
    [20, 20],
    [80, 60],
  ],
  ...extra,
});

/** Records every dab the engine deposits, without a canvas. */
function recorder() {
  const out: { stamp: Stamp; color: string }[] = [];
  const sink: StampSink = {
    ellipse: (stamp, color) => {
      out.push({ stamp, color });
    },
  };
  return { out, sink };
}

describe("export — the plan describes the file, not the screen", () => {
  it("pins the longest side to 1200 and rounds the other", () => {
    const cases: [{ w: number; h: number }, number, number][] = [
      [{ w: 1600, h: 1200 }, 1200, 900],
      [{ w: 1200, h: 1600 }, 900, 1200],
      [{ w: 1000, h: 1000 }, 1200, 1200],
      [SPEC_SHEET, 857, 1200],
      [PHONE_SHEET, 554, 1200],
    ];
    for (const [sheet, width, height] of cases) {
      const plan = exportArtwork([], null, sheet.w, sheet.h, PAPERS.linho);
      expect({ sheet, width: plan.width, height: plan.height }).toEqual({ sheet, width, height });
    }
  });

  it("keeps the sheet's proportion within one rounding pixel", () => {
    for (const sheet of [SPEC_SHEET, PHONE_SHEET, { w: 1600, h: 1200 }, { w: 300, h: 301 }]) {
      const plan = exportArtwork([], null, sheet.w, sheet.h, PAPERS.linho);
      expect(Math.abs(plan.width - plan.height * (sheet.w / sheet.h))).toBeLessThanOrEqual(1);
    }
  });

  it("declares white opaque paper on every material, and nothing that asks for alpha", () => {
    for (const key of PAPER_KEYS) {
      const plan = exportArtwork([], null, 300, 300, PAPERS[key]);
      // The material's own stock, its printed texture and the grain's alpha:
      // the paper IS the artwork's surface, so all three reach the file.
      expect(plan.paper).toEqual({
        hex: "#ffffff",
        pattern: PAPERS[key].pattern,
        texture: 0,
      });
    }
  });

  it("carries the tone and the grain the person chose", () => {
    const plan = exportArtwork([], null, 300, 300, {
      ...PAPERS.linho,
      paperHex: "#FBEFD6",
      texture: "acentuada",
    });
    // The sheet's tone is the file's paper colour, and the grain is described
    // too — the one surface detail the export carries, because it is the paper.
    expect(plan.paper.hex).toBe("#fbefd6");
    expect(plan.paper.texture).toBe(0.09);
    // The WORKING grid has no field here at all: it can only travel as a prop,
    // and the export never passes one.
    expect(JSON.stringify(plan)).not.toContain("grid");
  });

  it("carries the confirmed command list itself, never a derived result", () => {
    const commands: Command[] = [
      stroke("s1"),
      stroke("s2"),
      { t: "erase", strokeIds: ["s1"] },
      { t: "fill", region: "fundo", color: "#87CEEB" },
    ];
    const plan = exportArtwork(commands, null, 300, 650, PAPERS.linho);

    // The list travels whole: flattening it would lose the erase and let a
    // deleted stroke come back in the file.
    expect(plan.commands).toBe(commands);
    expect(derive(plan.commands).strokes.map((s) => s.id)).toEqual(["s2"]);
  });

  it("frames the whole sheet — the card's square crop has no field here", () => {
    const plan = exportArtwork([stroke("s1")], null, PHONE_SHEET.w, PHONE_SHEET.h, PAPERS.linho);
    expect(plan.view).toEqual({ w: PHONE_SHEET.w, h: PHONE_SHEET.h });
    // A 300x650 sheet exports tall; a focus crop would come out square.
    expect(plan.width / plan.height).toBeCloseTo(PHONE_SHEET.w / PHONE_SHEET.h, 2);
    expect(plan.width).not.toBe(plan.height);
  });

  it("carries the paper's graph texture but has no field a guide grid could use", () => {
    const quadriculado = exportArtwork([], null, 300, 650, PAPERS.quadriculado);
    expect(quadriculado.paper.pattern).toBe(true);

    const plain = exportArtwork([], null, 300, 650, PAPERS.linho);
    expect(plain.paper.pattern).toBe(false);
    expect(Object.keys(plain)).not.toContain("grid");
  });

  it("orders the layers regions -> strokes -> outline", () => {
    const plan = exportArtwork([], null, 300, 650, PAPERS.linho);
    expect(plan.layers).toEqual(["regions", "strokes", "outline"]);
  });
});

describe("export — what the file paints under the strokes", () => {
  it("never paints the desk: it is canvas customization, not art", () => {
    // A desk fill AND a sheet fill in the same list: only the sheet lands.
    const plan = exportArtwork(
      [{ t: "fill", region: "desk", color: "#2B2A29" }],
      null,
      300,
      650,
      PAPERS.grafite,
    );
    expect(plan.paper.hex).toBe("#ffffff");
    expect(fileRegions(plan)).toEqual([]);
    expect(fileOutline(plan)).toEqual([]);
  });

  it("paints a blank sheet's 'fundo' as the whole sheet", () => {
    const plan = exportArtwork(
      [{ t: "fill", region: "fundo", color: "#87CEEB" }],
      null,
      300,
      650,
      PAPERS.linho,
    );
    expect(fileRegions(plan)).toEqual([{ d: "M0 0 H300 V650 H0 Z", fill: "#87CEEB" }]);
  });

  it("takes the page's regions back-to-front and outlines all but the sheet", () => {
    const page = pageById("peixe")!;
    const plan = exportArtwork(
      [
        { t: "fill", region: "mar", color: "#1E90FF" },
        { t: "fill", region: "corpo", color: "#FFD23F" },
        { t: "fill", region: "desk", color: "#2B2A29" },
      ],
      "peixe",
      300,
      300,
      PAPERS.linho,
    );

    const regions = fileRegions(plan);
    // Every region of the sheet, in the page's own order.
    expect(regions.map((r) => r.d)).toEqual(page.regions.map((r) => r.d));
    const fillOf = (id: string) =>
      regions.find((r) => r.d === page.regions.find((region) => region.id === id)!.d)!.fill;
    expect(fillOf("mar")).toBe("#1E90FF");
    expect(fillOf("corpo")).toBe("#FFD23F");
    // Unpainted regions are the SHEET, not the region underneath: the bubbles
    // and the eye stay paper-white on top of the sea.
    expect(fillOf("bolha1")).toBe("#ffffff");
    expect(fillOf("pupila")).toBe("#ffffff");

    const outline = fileOutline(plan);
    expect(outline).toHaveLength(page.regions.length - 1 + (page.details?.length ?? 0));
    // Region 0 is the sheet itself: it has a fill, never an outline.
    expect(outline).not.toContain(page.regions[0]!.d);
  });

  it("leaves an unpainted region to the paper, so the graph texture shows through", () => {
    const plan = exportArtwork([], "peixe", 300, 300, PAPERS.quadriculado);
    expect(plan.paper.pattern).toBe(true);
    expect(fileRegions(plan)).toEqual([]);
  });
});

describe("export — the same raster engine as the paper on screen", () => {
  it("deposits the same stamps on two replays of one plan", () => {
    const plan = exportArtwork([stroke("s1"), stroke("s2", { brush: "crayon" })], null, 300, 650);
    const first = recorder();
    const second = recorder();
    const box = { w: plan.view.w, h: plan.view.h };

    const n1 = paintStrokes(first.sink, plan.commands, box);
    const n2 = paintStrokes(second.sink, plan.commands, box);

    expect(n1).toBeGreaterThan(0);
    expect(n2).toBe(n1);
    expect(second.out).toEqual(first.out);
  });

  it("paints exactly the strokes the screen derives — erased ones stay out", () => {
    const commands: Command[] = [stroke("s1"), stroke("s2"), { t: "erase", strokeIds: ["s1"] }];
    const plan = exportArtwork(commands, null, 300, 650);
    const { out, sink } = recorder();

    const painted = paintStrokes(sink, plan.commands, { w: plan.view.w, h: plan.view.h });
    const screen = derive(commands).strokes;

    expect(screen.map((s) => s.id)).toEqual(["s2"]);
    expect(painted).toBe(stampsOf(screen[0]!).length);
    expect(out).toHaveLength(painted);
  });

  it("places a gradient in artwork coordinates, so the ink is not flat", () => {
    const gradient = { kind: "linear" as const, stop1: "#0000FF", stop2: "#FF0000", angle: 0 };
    const plan = exportArtwork(
      [
        stroke("s1", {
          gradient,
          points: [
            [20, 20],
            [280, 620],
          ],
        }),
      ],
      null,
      300,
      650,
    );

    const placed = recorder();
    paintStrokes(placed.sink, plan.commands, { w: plan.view.w, h: plan.view.h });
    const flat = recorder();
    paintStrokes(flat.sink, plan.commands);

    const placedColors = new Set(placed.out.map((d) => d.color));
    expect(placedColors.size).toBeGreaterThan(1);
    expect([...placedColors]).not.toContain("#E8423F");
    // Without the box there is no geometry to place the gradient: flat ink.
    expect(new Set(flat.out.map((d) => d.color))).toEqual(new Set(["#E8423F"]));
  });
});

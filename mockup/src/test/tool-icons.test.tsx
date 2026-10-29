// The thirteen tool icons — the Claude set, adopted as the ONE drawing per tool
// and consumed by both bands with different tints (owner's call, 26/10).
//
// Seam: the rendered DOM. A layer whose source fill is `currentColor` follows the
// svg's own `color`; the outline never does; accent-shade/accent-tint keep black
// and white with the opacity the file declares. The table below is the acceptance
// text of `icones-claude-adocao.md` §4 and §7 — an icon that changes its tinted
// layer without changing this table fails here.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MaterialGlyph, ToolIcon } from "@/mockup/screens/BrushShelf";
import { BRUSH_SHELF, shelfBrushOf, type BrushKind } from "@/mockup/brush";
import { TOOL_ICON_LAYERS, TOOL_ICON_NAMES, type ToolIconName } from "@/mockup/toolIcons";

const TINT_A = "#2785fc";
const TINT_B = "#FFB000";
const INK = "var(--foreground)";

/** The layer each icon gives to `currentColor`; null = the drawing is fixed. */
const TINT_LAYER: Record<ToolIconName, string | null> = {
  pencil: "graphite",
  charcoal: null,
  crayon: "accent",
  marker: "accent",
  brush: "accent",
  watercolor: "accent",
  oil: "accent",
  spray: "accent",
  ink: "accent",
  eraser: null,
  fill: "accent",
  eyedropper: "accent",
  more: "cream",
};

function icon(
  name: ToolIconName,
  color: string,
  options: { ink?: string; active?: boolean; size?: number } = {},
) {
  const { container, unmount } = render(
    <ToolIcon
      name={name}
      color={color}
      size={options.size ?? 44}
      ink={options.ink}
      active={options.active ?? false}
    />,
  );
  const svg = container.querySelector("svg")!;
  const copy = svg.cloneNode(true) as SVGSVGElement;
  unmount();
  return copy;
}

const layer = (svg: Element, id: string) => svg.querySelector(`[data-layer="${id}"]`);
const layerIds = (svg: Element) =>
  [...svg.querySelectorAll("path")].map((path) => path.getAttribute("data-layer"));
/** The svg's own colour — the value `currentColor` resolves to — as jsdom reads it. */
const tintOf = (svg: Element) => (svg as SVGSVGElement).style.color;
/** A hex as the browser normalises `style.color` to. */
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

afterEach(cleanup);

describe("the set: thirteen drawings, one grid", () => {
  it("carries the thirteen tools, each with the file's own 1024 viewBox", () => {
    expect(TOOL_ICON_NAMES).toHaveLength(13);
    expect(new Set(TOOL_ICON_NAMES).size).toBe(13);
    for (const name of TOOL_ICON_NAMES) {
      const svg = icon(name, TINT_A);
      expect(svg.getAttribute("viewBox"), name).toBe("0 0 1024 1024");
      expect(layerIds(svg), name).toEqual(TOOL_ICON_LAYERS[name].map((entry) => entry.id));
      // A drawing with no contour would lose its silhouette on a dark surface.
      expect(layerIds(svg), name).toContain("outline");
    }
  });

  it("paints the ink in the file's own order: body, paper, contour", () => {
    // The quill delivered for the nanquim carries exactly three layers, and the
    // generator must keep the SVG's order instead of sorting them.
    expect(TOOL_ICON_LAYERS.ink.map((entry) => entry.id)).toEqual(["accent", "cream", "outline"]);
    // The accent is the body the colour reaches; `cream` is the paper ribbon.
    expect(TOOL_ICON_LAYERS.ink[0]!.fill).toBe("currentColor");
    expect(TOOL_ICON_LAYERS.ink[1]!.fill).toBe("#F0ECE0");
    expect(TOOL_ICON_LAYERS.ink[2]!.fill).not.toBe("currentColor");
  });

  it("paints the whole family with one contour and one paper", () => {
    // Measured: the thirteen files arrived with thirteen different contours and
    // nine papers — at 44dp that reads as thirteen objects that are not
    // siblings. The family tone is the plate's own pair (the ink the kid plate is
    // measured against), so the contour is one value and paper is at most two
    // (`#F0ECE0` body, `#F2ECE0` when a file carries a second, lighter tone).
    const OUTLINE = "#1C1410";
    const PAPER = new Set(["#F0ECE0", "#F2ECE0"]);
    const contours = TOOL_ICON_NAMES.map(
      (name) => TOOL_ICON_LAYERS[name].find((entry) => entry.id === "outline")!.fill,
    );
    expect(new Set(contours)).toEqual(new Set([OUTLINE]));
    for (const name of TOOL_ICON_NAMES) {
      for (const entry of TOOL_ICON_LAYERS[name]) {
        if (entry.id !== "cream" || entry.fill === "currentColor") continue;
        // `more`'s disc is the object itself (the tint), never paper.
        expect(PAPER.has(entry.fill), `${name}#cream ${entry.fill}`).toBe(true);
      }
    }
  });

  it("draws a glyph no neighbour repeats", () => {
    // `ink` sits between the spray and the eraser on the shelf, so the drawing
    // must be its own object — not a recolour of either neighbour, and not a
    // duplicate anywhere in the set.
    const signature = (name: ToolIconName) =>
      TOOL_ICON_LAYERS[name].map((entry) => `${entry.id}:${entry.d}`).join("|");
    const ink = signature("ink");
    for (const other of TOOL_ICON_NAMES.filter((name) => name !== "ink")) {
      expect(signature(other), `ink duplicates ${other}`).not.toBe(ink);
    }
    // The body alone is enough to tell it apart at a glance.
    const body = (name: ToolIconName) =>
      TOOL_ICON_LAYERS[name].find((entry) => entry.id === "accent")?.d;
    expect(body("ink")).toBeTruthy();
    for (const neighbour of ["spray", "eraser"] as ToolIconName[]) {
      expect(body("ink"), `ink and ${neighbour}`).not.toBe(body(neighbour));
    }
  });

  it("covers the shelf's whole vocabulary plus the door", () => {
    // The shelf's catalog is the ten materials (nanquim included) and the two
    // doors that do not paint; the icon set adds the `more` drawing. Thirteen
    // drawings, one per object the shelf can show.
    const shelfTools = ["fill", ...BRUSH_SHELF.map((brush) => brush.id), "eyedropper"];
    expect(shelfTools).toHaveLength(12);
    expect(TOOL_ICON_NAMES).toHaveLength(shelfTools.length + 1);
    for (const tool of shelfTools) expect(TOOL_ICON_NAMES).toContain(tool);
    expect(TOOL_ICON_NAMES).toContain("more");
  });

  it("scales by the size it is given and keeps the same geometry", () => {
    for (const size of [24, 32, 44]) {
      const svg = icon("crayon", TINT_A, { size });
      expect(svg.getAttribute("width")).toBe(String(size));
      expect(svg.getAttribute("height")).toBe(String(size));
      expect(svg.getAttribute("viewBox")).toBe("0 0 1024 1024");
    }
    // Geometry is the file's, so the size never rewrites a path.
    const small = icon("crayon", TINT_A, { size: 24 });
    const big = icon("crayon", TINT_A, { size: 64 });
    expect([...big.querySelectorAll("path")].map((p) => p.getAttribute("d"))).toEqual(
      [...small.querySelectorAll("path")].map((p) => p.getAttribute("d")),
    );
  });
});

describe("colour: the tint reaches the accent, never the contour", () => {
  it("gives `currentColor` to exactly one layer per tool — the table's own", () => {
    for (const name of TOOL_ICON_NAMES) {
      const svg = icon(name, TINT_A);
      const following = TOOL_ICON_LAYERS[name]
        .filter((entry) => entry.fill === "currentColor")
        .map((entry) => entry.id);
      const expected = TINT_LAYER[name];
      expect(following, name).toEqual(expected === null ? [] : [expected]);
      // The tint rides the svg's own colour; the layer keeps `currentColor`.
      // `more` is the exception the component documents: at rest it keeps the
      // source's cream and only the open state takes the tint.
      if (expected !== null) {
        expect(layer(svg, expected)!.getAttribute("fill"), name).toBe("currentColor");
        if (name !== "more") expect(tintOf(svg), name).toBe(rgb(TINT_A));
      }
    }
  });

  it("keeps the outline bit-for-bit under two tints, and out of the colour", () => {
    for (const name of TOOL_ICON_NAMES) {
      const a = icon(name, TINT_A);
      const b = icon(name, TINT_B);
      const outlineA = layer(a, "outline")!;
      const outlineB = layer(b, "outline")!;
      expect(outlineA.getAttribute("fill"), name).toBe(outlineB.getAttribute("fill"));
      expect(outlineA.getAttribute("fill"), name).not.toBe("currentColor");
      if (name !== "more") expect(tintOf(b), name).toBe(rgb(TINT_B));
    }
  });

  it("lets the band hand in the contour ink, still never the tint", () => {
    for (const name of TOOL_ICON_NAMES) {
      const svg = icon(name, TINT_A, { ink: INK });
      expect(layer(svg, "outline")!.getAttribute("fill"), name).toBe(INK);
      expect(layer(svg, "outline")!.getAttribute("fill"), name).not.toBe(TINT_A);
    }
  });

  it("keeps accent-shade and accent-tint black/white with the file's opacity", () => {
    const shaded: ToolIconName[] = ["watercolor", "oil", "spray", "fill"];
    for (const name of shaded) {
      const source = TOOL_ICON_LAYERS[name].filter((entry) => entry.id.startsWith("accent-"));
      expect(source.length, name).toBeGreaterThan(0);
      const svg = icon(name, TINT_A);
      for (const entry of source) {
        const path = layer(svg, entry.id)!;
        // Black or white — the shadow and the highlight OF the accent, painted
        // over the tint, so they follow any colour without a colour account.
        expect(path.getAttribute("fill"), `${name}#${entry.id}`).toBe(entry.fill);
        expect(["#000", "#fff", "#ffffff", "#000000"]).toContain(
          path.getAttribute("fill")!.toLowerCase(),
        );
        const alpha = path.getAttribute("fill-opacity");
        expect(alpha === null ? null : Number(alpha), `${name}#${entry.id}`).toBe(
          entry.fillOpacity ?? null,
        );
      }
    }
  });

  it("keeps the material layers fixed: wood, cream, metal, cap and nib", () => {
    const pencil = icon("pencil", TINT_A);
    for (const id of ["wood", "wood-light", "cream", "metal"]) {
      expect(layer(pencil, id)!.getAttribute("fill"), id).not.toBe("currentColor");
    }
    // The pencil IS the one icon whose colour is not an accent: graphite is what
    // leaves the mark, so the point is the thing the colour reaches.
    expect(layer(pencil, "graphite")!.getAttribute("fill")).toBe("currentColor");

    // The nanquim's paper ribbon is cream at the file's own hex, and the
    // contour is ink — neither follows the colour in hand.
    const quill = icon("ink", TINT_A);
    expect(layer(quill, "cream")!.getAttribute("fill")).toBe("#F0ECE0");
    expect(layer(quill, "outline")!.getAttribute("fill")).not.toBe("currentColor");
    expect(layer(quill, "accent")!.getAttribute("fill")).toBe("currentColor");

    // Charcoal and the eraser are fixed by design: there is no body to tint.
    for (const name of ["charcoal", "eraser"] as const) {
      for (const path of icon(name, TINT_A).querySelectorAll("path")) {
        expect(path.getAttribute("fill"), `${name}#${path.getAttribute("data-layer")}`).not.toBe(
          "currentColor",
        );
      }
    }
  });

  it("tints the `more` disc only in the open state", () => {
    const resting = icon("more", TINT_A);
    // The source's own cream, so the resting icon is the drawing as it was.
    expect(tintOf(resting)).toBe(rgb("#efebde"));
    expect(tintOf(resting)).not.toBe(rgb(TINT_A));

    const open = icon("more", TINT_A, { active: true });
    expect(tintOf(open)).toBe(rgb(TINT_A));
    // The three dots and the ring are the contour: they never change.
    expect(layer(open, "outline")!.getAttribute("fill")).toBe(
      layer(resting, "outline")!.getAttribute("fill"),
    );
  });
});

describe("both bands mount the same drawing", () => {
  const ALL: BrushKind[] = [
    "pencil",
    "charcoal",
    "crayon",
    "marker",
    "brush",
    "watercolor",
    "oil",
    "spray",
    "ink",
    "eraser",
  ];

  it("tints the object with the colour in hand on 3-5 and on 9+", () => {
    for (const kind of ALL) {
      const brush = shelfBrushOf(kind)!;
      const { container, unmount } = render(
        <MaterialGlyph brush={brush} color={TINT_B} size={44} />,
      );
      const svg = container.querySelector("svg")!;
      const tinted = TOOL_ICON_LAYERS[kind].some((entry) => entry.fill === "currentColor");
      if (tinted) {
        // Watercolour's body is a WASH of the colour, never the colour itself.
        if (kind === "watercolor") expect(tintOf(svg)).not.toBe(rgb(TINT_B));
        else expect(tintOf(svg), kind).toBe(rgb(TINT_B));
      }
      unmount();
    }
  });

  it("keeps the same geometry in both bands and only swaps the contour", () => {
    for (const kind of ALL) {
      const brush = shelfBrushOf(kind)!;
      const kids = render(<MaterialGlyph brush={brush} color="#FB2C36" size={64} />);
      const kidSvg = kids.container.querySelector("svg")!;
      kids.unmount();
      const pro = render(<MaterialGlyph brush={brush} color="#FB2C36" size={64} ink={INK} />);
      const proSvg = pro.container.querySelector("svg")!;

      expect(
        [...proSvg.querySelectorAll("path")].map((p) => p.getAttribute("d")),
        kind,
      ).toEqual([...kidSvg.querySelectorAll("path")].map((p) => p.getAttribute("d")));
      expect(layer(proSvg, "outline")!.getAttribute("fill"), kind).toBe(INK);
      // 3-5 paints the ink measured against PAPER on every material.
      expect(layer(kidSvg, "outline")!.getAttribute("fill"), kind).toBe("#1C1410");
      pro.unmount();
    }
  });
});

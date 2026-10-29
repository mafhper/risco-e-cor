// The canvas surface the child meets, measured on the DOM:
//
//   D1  the third material (eraser) wipes a bucket fill — and undo paints it back;
//   D8  one glyph family for both bands, changing only the ink;
//   D9  the bucket glyph carries the active colour, never a fixed one;
//   D3  the zoom door wears a frame + plus, not a magnifier;
//   D2  the kids chrome has no decorative icon that looks like a dead button;
//   D6  Início and Desfazer are never the same glyph.
//
// The drawings themselves are no longer measured here: the set is the Claude
// icons, transcribed in `toolIcons.ts`, and their own acceptance file
// (`tool-icons.test.tsx`) holds the layer-by-layer colour rule.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { MaterialGlyph } from "@/mockup/screens/BrushShelf";
import { emptyHistory, type Command } from "@/mockup/history";
import { shelfBrushOf, type BrushKind } from "@/mockup/brush";
import { KID_COLORS } from "@/mockup/palette";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Harness({
  profileId = "theo",
  pageId = "foguete",
}: {
  profileId?: string;
  pageId?: string | null;
}) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      <span data-testid="commands">{JSON.stringify(art.history.commands)}</span>
    </>
  );
}

/** A brand-new sheet, blank or with a coloring page, and no seed commands. */
function FreshHarness({
  profileId = "theo",
  pageId = null,
}: {
  profileId?: string;
  pageId?: string | null;
}) {
  const { state, dispatch } = useStore();
  const id = `icons-fresh-${pageId ?? "blank"}`;
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    dispatch({
      type: "createArtwork",
      artwork: {
        id,
        profileId,
        pageId,
        w: 300,
        h: 300,
        history: emptyHistory(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        visibility: "draft",
        publishedAt: null,
      },
    });
  }, [dispatch, profileId, pageId, id]);
  const art = state.artworks.find((a) => a.id === id);
  if (!art) return null;
  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      <span data-testid="commands">{JSON.stringify(art.history.commands)}</span>
    </>
  );
}

const mount = (profileId = "theo", pageId: string | null = "foguete") =>
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} />
    </StoreProvider>,
  );

const paper = () => screen.getByTestId("paper-view").querySelector("svg")!;
const regionPath = (id: string) => paper().querySelector(`[data-region="${id}"]`)!;
const commands = () => JSON.parse(screen.getByTestId("commands").textContent || "[]") as Command[];

/**
 * The 3-5 undo, one level down (`chrome-v2` §12.2): the pair sits in the compact
 * bar's preview row, so a hand reaches it through the pill. Idempotent: a bar
 * that is already open is left alone.
 */
function openCompact() {
  const door = screen.queryByLabelText("Abrir barra de ferramentas");
  if (door) fireEvent.click(door);
}

/** The six materials both bands draw, for the glyph-family contract. */
const SIX = ["pencil", "charcoal", "crayon", "marker", "brush", "watercolor"] as const;

/** One material's glyph, sized like the kid card (64dp). */
function glyphFor(kind: BrushKind, color = "#FB2C36") {
  const { container, unmount } = render(
    <MaterialGlyph brush={shelfBrushOf(kind)!} color={color} size={64} />,
  );
  const svg = container.querySelector("svg")!;
  // A detached copy keeps the markup readable after the render goes away.
  const copy = svg.cloneNode(true) as SVGSVGElement;
  unmount();
  return copy;
}

const tap = (el: Element) => {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 150, clientY: 150 });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 150, clientY: 150 });
};

describe("D1 — the block eraser is not a dead door on a coloring page", () => {
  it("wipes a painted region and undo paints it again", () => {
    render(
      <StoreProvider>
        <FreshHarness pageId="foguete" />
      </StoreProvider>,
    );
    const region = regionPath("corpo");
    const fresh = region.getAttribute("fill");
    const color = KID_COLORS[0]!.hex;

    // The bucket is the opening tool on a page.
    tap(region);
    expect(regionPath("corpo").getAttribute("fill")).toBe(color);
    expect(commands().at(-1)).toMatchObject({ t: "fill", region: "corpo", color });

    // Third material: the block eraser.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    fireEvent.click(within(compact).getByLabelText("Borracha"));
    tap(regionPath("corpo"));

    // The region goes back to bare paper — not to a previous colour.
    expect(regionPath("corpo").getAttribute("fill")).toBe(fresh);
    expect(commands().at(-1)).toMatchObject({ t: "erase", regions: ["corpo"] });

    // Undo is a real door: the fill comes back, not a blank region.
    openCompact();
    fireEvent.click(screen.getByLabelText("Desfazer"));
    expect(regionPath("corpo").getAttribute("fill")).toBe(color);
  });

  it("bites a freehand stroke on blank paper and keeps what is left", () => {
    render(
      <StoreProvider>
        <FreshHarness />
      </StoreProvider>,
    );
    const svg = paper();
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 120, clientY: 150 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 180, clientY: 150 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 180, clientY: 150 });
    const drawn = commands().filter((c) => c.t === "stroke");
    expect(drawn).toHaveLength(1);
    const strokeId = (drawn[0] as { id: string }).id;

    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(within(screen.getByTestId("canvas-compact")).getByLabelText("Borracha"));
    tap(paper());

    // The rubber has a CONTINUOUS size now (owner's call, 26/10, replacing
    // P/M/G): a tap takes the span its own circle covers, it no longer deletes
    // the whole stroke — and an untouched eraser opens on the thickness in use,
    // which is the band default (one number, §11.3).
    const erase = commands().at(-1) as {
      t: string;
      radius: number;
      edits: { strokeId: string; gaps: [number, number][] }[];
      strokeIds?: string[];
    };
    expect(erase.t).toBe("eraseArea");
    expect(erase.radius).toBe(6);
    expect(erase.strokeIds ?? []).toEqual([]);
    expect(erase.edits).toHaveLength(1);
    expect(erase.edits[0]!.strokeId).toBe(strokeId);
    expect(erase.edits[0]!.gaps.length).toBeGreaterThan(0);
    // …and the stroke itself is still there, with its id, colour and points.
    expect(commands().filter((c) => c.t === "stroke")).toHaveLength(1);

    // One gesture, one undo: the spans go with the command, so the stroke is
    // whole again — not "half undone".
    openCompact();
    fireEvent.click(screen.getByLabelText("Desfazer"));
    expect(commands().at(-1)).toMatchObject({ t: "stroke", id: strokeId });
  });
});

describe("D8 — one glyph family for both bands", () => {
  it("draws the SAME geometry on 3-5 and on 9+, changing only the ink", () => {
    const geometry = (svg: Element) =>
      [...svg.querySelectorAll("*")].map((node) =>
        ["d", "x", "y", "width", "height", "rx", "cx", "cy", "r"]
          .map((attr) => node.getAttribute(attr) ?? "")
          .join("|"),
      );
    for (const kind of SIX) {
      const brush = shelfBrushOf(kind)!;
      const kids = render(<MaterialGlyph brush={brush} color="#FB2C36" size={64} />);
      const kidSvg = kids.container.querySelector("svg")!;
      kids.unmount();
      const pro = render(
        <MaterialGlyph brush={brush} color="#FB2C36" size={64} ink="var(--foreground)" />,
      );
      const proSvg = pro.container.querySelector("svg")!;

      expect(kidSvg.getAttribute("data-brush"), kind).toBe(kind);
      expect(proSvg.getAttribute("data-brush"), kind).toBe(kind);
      // Same drawing, same orientation, same order of layers.
      expect(geometry(proSvg), kind).toEqual(geometry(kidSvg));
      // Only the contour ink differs (and the plate's measured ink on 3-5).
      expect(kidSvg.getAttribute("data-ink")).toBe("#1C1410");
      expect(proSvg.getAttribute("data-ink")).toBe("var(--foreground)");
      pro.unmount();
    }
  });
});

describe("D9 — the bucket wears the paint it pours", () => {
  it("fills the bucket glyph with the active colour, and follows a swatch", () => {
    mount("theo", null);
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    const card = within(compact).getByLabelText("Pintar");
    const bucket = card.querySelector("svg[data-bucket]")!;
    expect(bucket).not.toBeNull();
    expect(bucket.getAttribute("data-bucket")).toBe(KID_COLORS[0]!.hex.toUpperCase());

    // Pick another family swatch: the paint inside the bucket must change.
    const swatches = Array.from(compact.querySelectorAll<HTMLElement>("[role='radio'][data-hex]"));
    const next = swatches.find(
      (s) => s.getAttribute("data-hex")!.toUpperCase() !== KID_COLORS[0]!.hex.toUpperCase(),
    )!;
    fireEvent.click(next);
    const expected = next.getAttribute("data-hex")!.toUpperCase();
    expect(card.querySelector("svg[data-bucket]")!.getAttribute("data-bucket")).toBe(expected);
  });
});

describe("D3 — zoom is a row of the drawer, not a magnifier over the paper", () => {
  it("shows the two scale targets only while the readout is up", () => {
    mount("theo", null);
    // The paper's corners are the sheet's: the zoom is a GESTURE, and the
    // readout is not on screen until one happens (`chrome-v2`, 27/10). On 3-5
    // the corner is a 52dp touch target — no glyph, no ink.
    expect(screen.queryByTestId("zoom-lupa")).toBeNull();
    expect(screen.queryByTestId("zoom-glyph")).toBeNull();
    expect(screen.queryByTestId("zoom-controls")).toBeNull();
    expect(screen.queryByLabelText("Aumentar zoom")).toBeNull();
    expect(screen.queryByTestId("zoom-hud")).toBeNull();

    fireEvent.click(screen.getByTestId("zoom-tap"));
    const zoom = screen.getByTestId("zoom-hud");
    expect(within(zoom).getByLabelText("Aumentar zoom")).toBeInTheDocument();
    expect(within(zoom).getByLabelText("Diminuir zoom")).toBeInTheDocument();
    // No magnifier anywhere: a magnifier reads as "find something", and this
    // readout only scales the paper.
    expect(document.querySelector(".lucide-search")).toBeNull();
  });
});

describe("D2 — the kids chrome carries no decorative dead door", () => {
  it("keeps every chrome icon inside a button", () => {
    mount("theo", "foguete");
    // 3-5 without a workspace switch draws no top band at all (`chrome-v2`
    // §12.1): the chrome on screen is the bottom band, and it is the one measured.
    expect(screen.queryByTestId("canvas-top-band")).toBeNull();
    const chrome = screen.getByTestId("canvas-band");
    const svgs = Array.from(chrome.querySelectorAll("svg"));
    expect(svgs.length).toBeGreaterThan(0);
    // The failure this guards: a glyph drawn outside a target, so it reads as a
    // button that does nothing. Every drawing of the band is inside a button.
    expect(svgs.every((svg) => svg.closest("button") !== null)).toBe(true);
  });
});

describe("D6 — Início and Desfazer are never the same glyph", () => {
  it("draws a house for Início and a curved ↩ for Desfazer", () => {
    mount("theo", "foguete"); // the seed has commands, so undo is live
    // `Início` is the bottom band's first target; `Desfazer` is one level down,
    // in the compact preview row since `chrome-v2` §12.3.
    //
    // Since the owner's 27/10 feedback the way out is a HOUSE, not an arrow:
    // the canvas sits directly under the home, so a ← promised a "one step
    // back" the screen never does. The pair still has to be told apart at a
    // glance, and a house cannot be mistaken for the curved return of undo.
    const back = screen.getByTestId("chrome-back").querySelector("svg")!;
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const undo = screen.getByTestId("compact-undo").querySelector("svg")!;
    expect(back).not.toBeNull();
    expect(undo).not.toBeNull();
    expect(back.getAttribute("data-glyph")).toBe("home");
    expect(undo.getAttribute("data-glyph")).toBe("undo");

    const d = (svg: Element) =>
      Array.from(svg.querySelectorAll("path"))
        .map((p) => p.getAttribute("d"))
        .join("|");
    const backD = d(back);
    const undoD = d(undo);

    // The failure this guards: the two doors drawn as the same left arrow.
    expect(backD).not.toBe(undoD);
    expect(back.outerHTML).not.toBe(undo.outerHTML);
    // Início is a house — a roof over a door —, not a pointer in any direction.
    expect(backD).toContain("M15 21v-8");
    // Desfazer is the classic curved return: its tail is an arc.
    expect(/[QqAaCc]/.test(undoD)).toBe(true);
  });

  it("leaves without a dialog when nothing new was drawn, and asks when dirty", () => {
    mount("theo", "foguete");
    fireEvent.click(screen.getByTestId("chrome-back"));
    expect(screen.queryByTestId("save-dialog-kids")).toBeNull();
    expect(screen.getByTestId("save-pill")).toBeInTheDocument();

    cleanup();
    localStorage.clear();

    render(
      <StoreProvider>
        <FreshHarness />
      </StoreProvider>,
    );
    const svg = paper();
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 120, clientY: 150 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 180, clientY: 150 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 180, clientY: 150 });
    fireEvent.click(screen.getByTestId("chrome-back"));
    expect(screen.getByTestId("save-dialog-kids")).toBeInTheDocument();
  });
});

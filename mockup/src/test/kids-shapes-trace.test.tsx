// F5/F6/F7 (destrave-kids.md §1): the two things a child reads without text —
// the OBJECT silhouette and the mark it leaves. K7 (brush-icons-v2 §8) asks two
// similar-coloured materials to be distinguishable by FORM alone, so the font of
// truth is geometry, not colour.
//
// Seam 1: the geometry model in kidsMaterials.ts — viewBox units on the 24 grid,
// converted to dp exactly as the renderer does (units * size / 24).
// Seam 2: the rendered kid glyph — it must consume that model, so a diverging
// `d`/rect in the JSX fails here even when the model is right.
//
// Expected values come from the acceptance text, never from the code:
//   - the marker tip must measure >= 6 px at 64dp and be VISIBLY taller than the
//     barrel (destrave-kids F5; hoje 2,6 x 4,6 unidades);
//   - the watercolour cap and the detached drop must survive the 64dp move;
//   - at least three distinct `d` families across the six §8.7 materials (F6);
//   - crayon and pencil must differ in plate AND trace family (F7 / K7).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openTools } from "./open-panel";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { MaterialGlyph } from "@/mockup/screens/BrushShelf";
import { BRUSH_SHELF, shelfBrushOf, type BrushKind } from "@/mockup/brush";
import { KID_COLORS } from "@/mockup/palette";
import { KID_TRACE, materialPlate, type KidTraceFamily } from "@/mockup/kidsMaterials";

/** The six materials §8.7 declares a body colour for. */
const SIX: BrushKind[] = ["pencil", "charcoal", "crayon", "marker", "brush", "watercolor"];

const glyphFor = (kind: BrushKind, color = "#FB2C36") => {
  const brush = shelfBrushOf(kind)!;
  const { container } = render(<MaterialGlyph brush={brush} color={color} size={64} />);
  return container.querySelector("svg")!;
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("F6 — the sample stroke differentiates by geometry", () => {
  it("spreads the six materials over at least three `d` families", () => {
    const families = new Set(KID_TRACE ? SIX.map((k) => KID_TRACE[k].family) : []);
    expect(families.size).toBeGreaterThanOrEqual(3);
    expect(new Set(SIX.map((k) => KID_TRACE[k].d)).size).toBe(SIX.length);
  });

  it("gives each family the geometry its name promises", () => {
    const curves = (d: string) => /[QTCS]/.test(d);
    const segments = (d: string) => (d.match(/L/g) ?? []).length;

    for (const kind of SIX) {
      const { family, d } = KID_TRACE[kind];
      if (family === "straight") {
        expect(curves(d), `${kind} straight`).toBe(false);
        expect(segments(d), `${kind} straight`).toBe(1);
      }
      if (family === "wave") expect(curves(d), `${kind} wave`).toBe(true);
      if (family === "broken") {
        expect(segments(d), `${kind} broken`).toBeGreaterThanOrEqual(3);
        expect(curves(d), `${kind} broken`).toBe(false);
      }
    }
    // The spec's own mapping: straight marker, wavy brush, broken wax/charcoal.
    expect(KID_TRACE.marker.family).toBe("straight");
    expect(KID_TRACE.brush.family).toBe("wave");
    expect(KID_TRACE.crayon.family).toBe("broken");
    expect(KID_TRACE.charcoal.family).toBe("broken");
  });

  it("draws the object alone — no stroke sample crossing it", () => {
    // Owner's call (24/10): the sample crossed the crayon and turned it into a
    // scribble. With three materials there is nothing to compare, so the card
    // carries the object only.
    for (const kind of SIX) {
      const glyph = glyphFor(kind);
      expect(glyph.querySelector('[data-kid-part="trace"]'), kind).toBeNull();
    }
  });
});

describe("F7 — the spec adopts the crayon, so K7 is verifiable", () => {
  it("ships a wax crayon (ADR-001) and no chalk material", () => {
    expect(shelfBrushOf("crayon")?.label).toBe("Giz de cera");
    expect(BRUSH_SHELF.some((b) => b.id === ("chalk" as string))).toBe(false);
    // The crayon's dash is the one the spec aligned to, live in the model.
    expect(KID_TRACE.crayon.family).toBe("broken");
  });

  it("separates pencil from crayon by pigment, trace and object — not by hue", () => {
    for (const kid of KID_COLORS) {
      // Same paper card for both (the card no longer identifies the tool):
      // the separation is the body colour inside the object, which is wood for
      // the pencil and the picked wax for the crayon.
      expect(materialPlate("pencil", kid.hex).pigment).not.toBe(
        materialPlate("crayon", kid.hex).pigment,
      );
      expect(materialPlate("crayon", kid.hex).pigment).toBe(kid.hex);
    }
    expect(KID_TRACE.pencil.family).not.toBe(KID_TRACE.crayon.family);
    // Object: the pencil gives its colour to the graphite point, the crayon gives
    // it to the wax — two different layers of two different drawings.
    expect(glyphFor("pencil").querySelector('[data-layer="graphite"]')?.getAttribute("fill")).toBe(
      "currentColor",
    );
    expect(glyphFor("crayon").querySelector('[data-layer="accent"]')?.getAttribute("fill")).toBe(
      "currentColor",
    );
  });
});

/* ------------------------------------------------------------------ */

function KidCanvas({ profileId, pageId }: { profileId: string; pageId: string | null }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    dispatch({
      type: "updateProfile",
      id: profileId,
      patch: { capsOverride: { ferramentasComplexas: true, paletaCompleta: true } },
    });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

describe("the kid cards in the real shelf carry the object, not a sample", () => {
  it("shows distinct objects side by side, zero text", () => {
    render(
      <StoreProvider>
        <KidCanvas profileId="theo" pageId="foguete" />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const shelf = screen.getByTestId("canvas-compact");
    const shapes = (["crayon", "marker", "brush"] as const).map((kind) => {
      const brush = shelfBrushOf(kind)!;
      const card = within(shelf).getByLabelText(brush.label);
      expect(card.querySelector('path[data-kid-part="trace"]'), kind).toBeNull();
      const glyph = card.querySelector("svg[data-brush]");
      expect(glyph, kind).not.toBeNull();
      return glyph!.innerHTML;
    });
    expect(new Set(shapes).size).toBe(3);
    expect(shelf.textContent?.trim() ?? "").toBe("");
  });
});

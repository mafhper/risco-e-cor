// Seam 1: the material plate model — the surface and the ink every kid card
// paints, for the six §8.7 materials across the six kid colours (36 pairs).
// Seam 2: the kid row DOM — the card carries the plate, the glyph is 64dp, and
// no kid card falls back to `bg-muted` (K3).
//
// The model test is not tautological: the ratio helper is anchored to the three
// literals the @verify measured in verify-icones-kids-87.md §2 with the same
// WCAG formula, so a drifting helper fails BEFORE the 36 pairs do.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openTools } from "./open-panel";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { KID_COLORS } from "@/mockup/palette";
import { contrastRatio, materialPlate, type PlateMaterial } from "@/mockup/kidsMaterials";

/** The six materials §8.7 declares a body colour for. */
const SIX: PlateMaterial[] = ["pencil", "charcoal", "crayon", "marker", "brush", "watercolor"];

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("kids card: the object carries the colour, the card carries paper", () => {
  /** Every card the row can paint, not just the six §8.7 bodies. */
  const ALL: PlateMaterial[] = [...SIX, "oil", "spray", "eraser", "fill", "eyedropper"];

  it("agrees with the ratios the @verify measured with the same WCAG formula", () => {
    // Independent anchors (verify-icones-kids-87.md §2): not derived from the model.
    expect(contrastRatio("#F0ECE0", "#1C1410")).toBeCloseTo(15.37, 1);
    expect(contrastRatio("#FFFFFF", "#2E6CD4")).toBeCloseTo(4.99, 1);
    expect(contrastRatio("#1C1410", "#EF9097")).toBeCloseTo(7.87, 1);
  });

  it("gives every material and colour the same paper card and the same dark ink", () => {
    const failures: string[] = [];
    for (const kind of ALL) {
      for (const kid of KID_COLORS) {
        const { plate, ink } = materialPlate(kind, kid.hex);
        if (plate !== "#F0ECE0") failures.push(`${kind}/${kid.hex}: plate ${plate}`);
        if (ink !== "#1C1410") failures.push(`${kind}/${kid.hex}: ink ${ink}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps the contour above 3:1 for every pair, and 15.4:1 on the fixed pair", () => {
    const failures: string[] = [];
    for (const kind of ALL) {
      for (const kid of KID_COLORS) {
        const { plate, ink } = materialPlate(kind, kid.hex);
        const ratio = contrastRatio(ink, plate);
        if (ratio < 3) {
          failures.push(`${kind}/${kid.hex}: ${ink} on ${plate} = ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
    // The contract no longer depends on the hue: one measured literal covers it.
    expect(contrastRatio("#1C1410", "#F0ECE0")).toBeCloseTo(15.37, 1);
  });

  it("paints the active colour INSIDE the object and never on the card", () => {
    for (const kind of ["crayon", "marker", "brush"] as PlateMaterial[]) {
      for (const kid of KID_COLORS) {
        const { pigment, plate } = materialPlate(kind, kid.hex);
        expect(pigment).toBe(kid.hex);
        // The defect this replaced: the card WAS the colour, so the glyph had to
        // be a dark or white silhouette to survive it.
        expect(plate).not.toBe(kid.hex);
      }
    }
  });

  it("keeps the bodies that are the material's identity, and dilutes watercolour", () => {
    expect(materialPlate("pencil", "#F0B100").pigment).toBe("#D4A574");
    expect(materialPlate("charcoal", "#F0B100").pigment).toBe("#1C1410");
    expect(materialPlate("oil", "#F0B100").pigment).toBe("#8A5A2B");
    expect(materialPlate("spray", "#F0B100").pigment).toBe("#8A8F98");
    // Watercolour is the same hue diluted over paper (§2), measured literal.
    expect(materialPlate("watercolor", "#FB2C36").pigment).toBe("#FD959B");
  });

  it("never falls back to the muted surface on any kid card", () => {
    for (const kind of ALL) {
      for (const kid of KID_COLORS) {
        expect(materialPlate(kind, kid.hex).plate.toLowerCase()).not.toBe("#ddd5c4");
      }
    }
  });
});

/* ------------------------------------------------------------------ */

function KidCanvas({
  profileId,
  pageId,
  complex,
}: {
  profileId: string;
  pageId: string | null;
  complex?: boolean;
}) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    if (complex) {
      dispatch({
        type: "updateProfile",
        id: profileId,
        patch: { capsOverride: { ferramentasComplexas: true, paletaCompleta: true } },
      });
    }
  }, [dispatch, profileId, complex]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

const openCompact = () => fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));

describe("kids cards: plate surface, 64dp glyph, zero text", () => {
  it("renders the 44dp glyph over the paper card in the compact row", () => {
    render(
      <StoreProvider>
        <KidCanvas profileId="theo" pageId={null} />
      </StoreProvider>,
    );
    openCompact();
    const compact = screen.getByTestId("canvas-compact");
    // A card that is NOT in hand: that is the paper language every material
    // shares (F1'). The one in hand flips the plate — see the state test below.
    const card = within(compact).getByLabelText("Marcador");
    expect(card.className).not.toContain("bg-muted");
    expect(card).toHaveAttribute("data-plate-state", "off");
    expect(card.getAttribute("data-plate")).toBe("#F0ECE0");
    expect(card.getAttribute("data-ink")).toBe("#1C1410");
    // The colour the child picked lives in the object, never on the card: the
    // accent layer follows the svg's own colour and the contour is its own path.
    const glyph = card.querySelector("svg") as SVGSVGElement;
    expect(glyph.style.color).toBe("rgb(251, 44, 54)");
    expect(glyph.querySelector('[data-layer="accent"]')!.getAttribute("fill")).toBe("currentColor");
    expect(glyph.querySelector('[data-layer="outline"]')!.getAttribute("fill")).toBe("#1C1410");
    expect(glyph?.getAttribute("width")).toBe("44");
    expect(glyph?.getAttribute("height")).toBe("44");
    // Five cards share the bar: the card is 52dp (the sheet keeps 64) and the
    // glyph still fills most of it.
    expect(card.className).toContain("h-[52px]");
    expect(card.className).toContain("w-[52px]");
  });

  it("keeps the selection ring alive: the rim is a layer, not an inline box-shadow", () => {
    render(
      <StoreProvider>
        <KidCanvas profileId="theo" pageId={null} />
      </StoreProvider>,
    );
    openCompact();
    const compact = screen.getByTestId("canvas-compact");
    const card = within(compact).getByLabelText("Giz de cera");
    // An inline `box-shadow` on the button silently cancelled the Tailwind ring
    // (measured: the active card had no ring at all). The rim must be a child.
    expect(card.getAttribute("style") ?? "").not.toContain("box-shadow");
    expect(card.className).toContain("ring-2");
    // The card in hand is the inverted plate, and its rim follows the new
    // surface so the edge survives the flip.
    expect(card).toHaveAttribute("data-plate-state", "on");
    expect(card.getAttribute("style") ?? "").toContain("background");
    const rim = card.querySelector('span[aria-hidden="true"]');
    expect(rim?.getAttribute("style") ?? "").toContain("inset");
  });

  it("keeps one card per kid material, all on the same paper, with no muted card", () => {
    render(
      <StoreProvider>
        <KidCanvas profileId="theo" pageId="foguete" complex />
      </StoreProvider>,
    );
    openCompact();
    // The kid toolbar is the compact bar (owner's call, 24/10): five cards, one
    // per available material, with no muted card. The cards share ONE surface by
    // design (adr-kids-papel-neutro): what differs is the object, not the plate.
    const shelf = screen.getByTestId("canvas-compact");
    const LABEL: Record<string, string> = {
      crayon: "Giz de cera",
      marker: "Marcador",
      brush: "Pincel",
      eraser: "Borracha",
      fill: "Pintar",
    };
    const plates = Object.entries(LABEL).map(([kind, label]) => {
      const card = within(shelf).getByLabelText(label);
      expect(card.className).not.toContain("bg-muted");
      expect(card.querySelector("svg")).not.toBeNull();
      return {
        kind,
        state: card.getAttribute("data-plate-state"),
        plate: card.getAttribute("data-plate"),
        ink: card.getAttribute("data-ink"),
      };
    });
    expect(plates.filter((p) => !p.plate || !p.ink)).toEqual([]);
    // ONE shared surface and one shared ink for every material that is not in
    // hand; the card in hand is the same paper read as ink (state, not material).
    const idle = plates.filter((p) => p.state === "off");
    expect(new Set(idle.map((p) => p.plate))).toEqual(new Set(["#F0ECE0"]));
    expect(new Set(idle.map((p) => p.ink))).toEqual(new Set(["#1C1410"]));
    const active = plates.filter((p) => p.state === "on");
    expect(active).toHaveLength(1);
    expect(active[0]!.plate).toBe("#1C1410");
    expect(active[0]!.ink).toBe("#F0ECE0");
    // The three colour-bearing materials paint the picked colour inside the body.
    for (const kind of ["crayon", "marker", "brush"]) {
      const card = within(shelf).getByLabelText(LABEL[kind]!);
      expect(card.querySelector('svg [data-layer="accent"]')).not.toBeNull();
      expect((card.querySelector("svg") as SVGSVGElement).style.color).toBe("rgb(251, 44, 54)");
    }
    expect(shelf.textContent?.trim() ?? "").toBe("");
  });
});

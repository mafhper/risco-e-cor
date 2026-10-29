// Seam: the published card's geometry on the family wall (HomeScreen).
//
// jsdom has no layout engine, so the ≤1dp measurement at 390dp is done in a
// real browser (CDP), not here. What this test locks is the contract that makes
// the two heights equal: ONE square button for every piece, no sheet ratio in
// any card style, and the phone-tall sheet painted whole (contain) instead of
// the square focus window that used to cut it.
import { useEffect } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeScreen } from "@/mockup/screens/HomeScreen";
import { StoreProvider, useStore } from "@/mockup/store";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const TALL = "mural-tall";

/** The seed publishes two 300 × 300 pages; this adds one phone-tall drawing. */
function MuralHarness() {
  const { state, dispatch } = useStore();
  const exists = state.artworks.some((a) => a.id === TALL);
  useEffect(() => {
    if (exists) return;
    dispatch({
      type: "createArtwork",
      artwork: {
        id: TALL,
        profileId: "theo",
        pageId: null,
        w: 300,
        h: 650,
        history: {
          commands: [
            {
              t: "stroke",
              id: "top",
              color: "#E8423F",
              size: 10,
              points: [
                [40, 20],
                [260, 20],
              ],
            },
            {
              t: "stroke",
              id: "bottom",
              color: "#E8423F",
              size: 10,
              points: [
                [40, 630],
                [260, 630],
              ],
            },
          ],
          redo: [],
          undoable: 2,
        },
        createdAt: 10,
        updatedAt: 10,
        visibility: "published",
        publishedAt: Date.now(),
      },
    });
  }, [dispatch, exists]);
  return <HomeScreen />;
}

describe("one height for every published card", () => {
  it("gives the free drawing the square cell of a painted page", async () => {
    render(
      <StoreProvider>
        <MuralHarness />
      </StoreProvider>,
    );
    await waitFor(() => expect(document.querySelectorAll("[data-mural-piece]")).toHaveLength(3));

    const cards = [...document.querySelectorAll("[data-mural-piece]")];
    const buttons = cards.map((card) => card.querySelector("button")!);

    // Same classes, same square: two cards in one column now resolve to the
    // same box. The sheet's own ratio (300 / 650 against 300 / 300) used to
    // live in the inner span and grow the row with the piece (owner's call,
    // 27/10) — the mural mixed two card heights in the same line.
    expect(new Set(buttons.map((button) => button.className)).size).toBe(1);
    for (const button of buttons) {
      expect(button.className).toContain("aspect-square");
      expect(button.getAttribute("style") ?? "").not.toContain("aspect-ratio");
      for (const node of button.querySelectorAll<HTMLElement>("[style]")) {
        const style = node.getAttribute("style") ?? "";
        for (const [, ratio] of style.matchAll(/aspect-ratio:\s*([^;]+)/g)) {
          // 1 is the framed art box every piece shares; the sheet ratio is gone.
          expect(ratio!.trim()).toBe("1");
        }
      }
    }
  });

  it("shows the phone-tall drawing whole inside that cell (contain, no crop)", async () => {
    render(
      <StoreProvider>
        <MuralHarness />
      </StoreProvider>,
    );
    await waitFor(() => expect(document.querySelector(`[data-artwork="${TALL}"]`)).not.toBeNull());
    const drawing = document.querySelector(`[data-artwork="${TALL}"]`)!;

    // The author frame is an SVG of its own (200 × 200); read the paint box,
    // which is the node that carries the paper layers.
    const canvas = drawing.querySelector("canvas")!;
    const paint = canvas.parentElement!;

    // Both SVG layers read the whole 300 × 650 sheet. The old focus window was
    // "0 175 300 300", which cut 350 units off a phone-tall drawing; the square
    // page keeps its own focus crop (focusBox).
    for (const svg of paint.querySelectorAll("svg")) {
      expect(svg.getAttribute("viewBox")).toBe("0 0 300 650");
    }
    expect([canvas.width, canvas.height]).toEqual([300, 650]);
    expect(canvas.style.objectFit).toBe("contain");
  });
});

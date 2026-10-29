// Seam: the canvas surface the hand actually meets — the page's LIMIT and the
// desk around it. Two defects from the owner's prints live here:
//
//   1. a white page dissolved into a white canvas, so the edge was invisible;
//   2. a tap outside the artwork did nothing at all (a dead touch).
//
// The page is white on purpose; the desk is a real material and the frame is
// always drawn. The bucket that paints the page also paints the desk, and a
// tap that cannot paint answers immediately instead of dying silently.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { blankArtwork } from "@/mockup/artworks";
import { PAPERS } from "@/mockup/palette";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { openTools } from "./open-panel";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function CanvasHarness({
  profileId,
  pageId,
  blank = false,
}: {
  profileId: string;
  pageId: string | null;
  /** A fresh blank sheet, instead of the seeded piece of the same profile. */
  blank?: boolean;
}) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    if (blank) dispatch({ type: "createArtwork", artwork: blankArtwork(profileId, "blank-page") });
  }, [dispatch, profileId, blank]);
  const art = state.artworks.find((a) =>
    blank ? a.id === "blank-page" : a.profileId === profileId && a.pageId === pageId,
  );
  if (!art) return null;
  const last = art.history.commands[art.history.commands.length - 1];
  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      <span data-testid="last-command">{last ? JSON.stringify(last) : ""}</span>
      <span data-testid="command-count">{art.history.commands.length}</span>
    </>
  );
}

const mount = (profileId = "maria", pageId: string | null = "peixe", blank = false) =>
  render(
    <StoreProvider>
      <CanvasHarness profileId={profileId} pageId={pageId} blank={blank} />
    </StoreProvider>,
  );

const sheet = () => screen.getByTestId("paper-view");
const page = () => screen.getByTestId("page-area");
const pagePaper = () => page().querySelector("svg rect");

/** A pointer tap that lands outside the artwork (the desk band). */
const tapDesk = (el: Element = screen.getByTestId("desk-surface")) => {
  fireEvent.pointerDown(el, { pointerId: 1, clientX: -20, clientY: 40 });
  fireEvent.pointerUp(el, { pointerId: 1, clientX: -20, clientY: 40 });
};

describe("the page always has a visible limit on the desk", () => {
  it("insets the page and draws a frame, so white paper never merges with the canvas", () => {
    mount();

    // The sheet is the whole canvas (the desk); the page sits inside it.
    expect(sheet().style.width).toBe("300px");
    expect(sheet().style.height).toBe("420px");
    expect(page().style.width).toBe("268px");
    expect(page().style.height).toBe("268px");
    expect(page().style.left).toBe("16px");
    expect(page().style.top).toBe("76px");

    // The frame is not optional: hairline + shadow, on every material.
    expect(page().style.boxShadow).toMatch(/rgba\(28,\s?27,\s?26/);

    // Desk and page are two surfaces, and the desk is never plain white.
    const desk = sheet().getAttribute("data-desk-color");
    expect(desk).toBe(PAPERS.linho.surface);
    expect(desk?.toLowerCase()).not.toBe("#ffffff");
    expect(sheet()).toHaveAttribute("data-desk-margin", "16");
  });

  it("keeps the page paper #FFFFFF on every material, including grafite", () => {
    mount();
    // The material is chosen in the sheet, at the paper's fold: the pill opens
    // the bar, the bar opens the sheet, the fold holds the stock (`chrome-v2` §12).
    openTools();
    fireEvent.click(screen.getByTestId("fold-papel"));
    fireEvent.click(screen.getByRole("radio", { name: "Papel Grafite" }));
    expect(pagePaper()?.getAttribute("fill")?.toLowerCase()).toBe("#ffffff");
    fireEvent.click(screen.getByRole("radio", { name: "Papel Quadriculado" }));
    // Quadriculado paints its graph through a pattern whose base is the page.
    const pattern = page().querySelector("pattern rect");
    expect(pattern?.getAttribute("fill")?.toLowerCase()).toBe("#ffffff");

    expect(sheet().getAttribute("data-desk-color")).toBe(PAPERS.quadriculado.surface);
  });
});

describe("the bucket paints the desk, not only the artwork", () => {
  it("fills the canvas background on a kids coloring page", () => {
    mount("theo", "foguete");
    const color = screen.getByTestId("canvas-dock").getAttribute("data-color");

    tapDesk();

    // The document says what was painted, and the surface shows it.
    expect(JSON.parse(screen.getByTestId("last-command").textContent || "{}")).toEqual({
      t: "fill",
      region: "desk",
      color,
    });
    expect(sheet()).toHaveAttribute("data-desk-color", color ?? "");
  });

  it("brings the desk back with undo", () => {
    mount("theo", "foguete");
    const before = Number(screen.getByTestId("command-count").textContent);
    const color = screen.getByTestId("canvas-dock").getAttribute("data-color");
    tapDesk();
    expect(sheet()).toHaveAttribute("data-desk-color", color ?? "");
    expect(Number(screen.getByTestId("command-count").textContent)).toBe(before + 1);

    // The undo of the 3-5 screen lives in the compact bar (`chrome-v2` §12.3):
    // the pill opens it, and the pair is in the preview row.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Desfazer"));

    expect(sheet()).toHaveAttribute("data-desk-color", PAPERS.linho.surface);
    expect(Number(screen.getByTestId("command-count").textContent)).toBe(before);
  });

  it("still paints a region when the tap lands on the page", () => {
    mount("theo", "foguete");
    const before = Number(screen.getByTestId("command-count").textContent);
    const color = screen.getByTestId("canvas-dock").getAttribute("data-color");
    // The page background region of the rocket is "espaco".
    const space = page().querySelector('[data-region="espaco"]')!;
    fireEvent.pointerDown(space, { pointerId: 1, clientX: 40, clientY: 60 });
    fireEvent.pointerUp(space, { pointerId: 1, clientX: 40, clientY: 60 });

    expect(JSON.parse(screen.getByTestId("last-command").textContent || "{}")).toMatchObject({
      t: "fill",
      region: "espaco",
      color,
    });
    expect(Number(screen.getByTestId("command-count").textContent)).toBe(before + 1);
  });

  it("lets the material take the desk back, so the appearance door never goes dead", () => {
    mount();
    tapDesk();
    expect(sheet().getAttribute("data-desk-color")).not.toBe(PAPERS.linho.surface);

    // Two taps into the sheet's paper fold, one choice: the material is visible
    // again and the bucket's override is dropped by an erase command.
    openTools();
    fireEvent.click(screen.getByTestId("fold-papel"));
    fireEvent.click(screen.getByRole("radio", { name: "Papel Grafite" }));

    expect(sheet()).toHaveAttribute("data-desk-color", PAPERS.grafite.surface);
    expect(JSON.parse(screen.getByTestId("last-command").textContent || "{}")).toMatchObject({
      t: "erase",
      regions: ["desk"],
    });
  });
});

describe("a tap on the desk is never a dead touch", () => {
  it("pulses the page when the active tool cannot paint the desk", () => {
    mount("theo", null, true); // crayon is the kids default on a blank sheet
    const canvas = screen.getByTestId("canvas");
    expect(canvas).toHaveAttribute("data-nudge", "0");

    tapDesk();

    expect(canvas).toHaveAttribute("data-nudge", "1");
    expect(screen.getByTestId("page-nudge")).toBeInTheDocument();
    // A nudge is feedback, never a mark.
    expect(screen.getByTestId("command-count").textContent).toBe("0");
  });

  it("says nothing in the kids canvas: the answer is visual", () => {
    mount("theo", null, true);
    tapDesk();
    // Reading-zero: no sentence was added to the surface by the feedback.
    expect(screen.getByTestId("page-nudge").textContent).toBe("");
  });
});

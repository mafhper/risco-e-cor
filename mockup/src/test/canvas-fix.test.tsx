// Seam: the canvas defects the owner's prints showed, checked on the DOM the
// user actually meets — not on a hand-computed pixel.
//
//   1. title   the whole name; elasticity, never an ellipsis
//   2. rail     there is no rail: the bar is always the bottom pill
//   3. HUD     one line: zoom left, guardar right, one 12dp gap, two ends
//   4. paper   the desk is the whole canvas; the page is inset with a frame
//
// jsdom has no layout, so the pixel proof (page inside the desk, frame drawn)
// is the recorded CDP pass; here the shapes that make it
// possible.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openTools } from "./open-panel";
import { blankArtwork } from "@/mockup/artworks";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Harness({
  profileId = "maria",
  pageId = "peixe",
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
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

/** A pro profile on a blank sheet: the title is "Desenho livre". */
function BlankProHarness() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
    dispatch({ type: "createArtwork", artwork: blankArtwork("maria", "fix-blank") });
    dispatch({
      type: "go",
      screen: { name: "view", artworkId: "fix-blank", back: { name: "home" } },
    });
  }, [dispatch]);
  const art = state.artworks.find((a) => a.id === "fix-blank");
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

describe("title: the whole name, elastic instead of truncated", () => {
  it("prints 'Desenho livre' without an ellipsis and keeps the name for hover", () => {
    render(
      <StoreProvider>
        <BlankProHarness />
      </StoreProvider>,
    );

    const title = screen.getByTestId("canvas-title");
    expect(title.textContent).toBe("Desenho livre");
    expect(title).toHaveAttribute("title", "Desenho livre");
    // No truncation anywhere in the label: the fit is a scale, not a cut.
    expect(title.className).not.toContain("truncate");
    expect(title.querySelector(".truncate")).toBeNull();
    expect(title.querySelector("[style*='scale']")).not.toBeNull();
    expect(title).toHaveAttribute("data-title-scale");
  });

  it("prints the page's own name on a coloring page", () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    expect(screen.getByTestId("canvas-title").textContent).toBe("Peixe");
  });
});

describe("no rail: the same bottom bar on every profile", () => {
  it("renders the pill and none of the rail's parts", () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );

    expect(screen.queryByTestId("tool-rail")).toBeNull();
    expect(screen.queryByTestId("rail-card")).toBeNull();
    expect(screen.queryByTestId("rail-tools")).toBeNull();
    expect(screen.queryByTestId("rail-color")).toBeNull();
    expect(screen.queryByTestId("rail-expand")).toBeNull();
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
  });
});

describe("HUD: the canvas's own controls no longer ride the drawer", () => {
  it("keeps zoom OUT of the drawer, and the look folds in the sheet", () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );

    // There is no HUD row any more (27/10), and since the `chrome-v2` decision
    // there is no utilities row either: the zoom is a gesture and the grid and
    // the paper are FOLDS of the sheet (§12).
    expect(screen.queryByTestId("canvas-hud-row")).toBeNull();
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    for (const testid of ["dock-utilities", "sheet-utilities", "zoom-controls"]) {
      expect(screen.queryByTestId(testid)).toBeNull();
    }

    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(screen.getByTestId("fold-grade")).toBeInTheDocument();
    expect(screen.getByTestId("fold-papel")).toBeInTheDocument();
    // Nothing of that lives on a band: the top band is the selector, the bottom
    // band is `Início` + the pill.
    expect(screen.getByTestId("canvas-top-band").querySelector("#fold-papel")).toBeNull();
    // The thumb-side save button is gone: saving lives in the exit dialog.
    expect(screen.queryByTestId("canvas-hud-save")).toBeNull();
  });

  it("keeps the title and leaves the readout to the gesture", () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    // No magnifier to press first, and no number on the tools: the readout only
    // exists while a pinch is in flight.
    expect(screen.queryByTestId("zoom-hud")).toBeNull();
    expect(screen.queryByText("%")).toBeNull();
    expect(screen.getByTestId("canvas-title").textContent).toBe("Peixe");
  });
});

describe("paper: a sheet with its own limit on the desk", () => {
  // The measuring stub in src/test/setup.ts reports a 300×420 canvas.
  it("insets the page inside the desk and keeps the frame drawn", () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );

    const sheet = screen.getByTestId("paper-view");
    expect(sheet).toHaveAttribute("data-paper", "desk");
    expect(sheet).toHaveAttribute("data-desk-margin", "16");
    expect(sheet.style.width).toBe("300px");
    expect(sheet.style.height).toBe("420px");
    expect(sheet.style.left).toBe("0px");
    expect(sheet.style.top).toBe("0px");

    // The square page is centred inside the desk with 16dp of margin, and its
    // frame is present so the edge never depends on desk color alone.
    const page = screen.getByTestId("page-area");
    expect(page.style.width).toBe("268px");
    expect(page.style.height).toBe("268px");
    expect(page.style.left).toBe("16px");
    expect(page.style.top).toBe("76px");
    expect(page.style.boxShadow).toMatch(/rgba\(28,\s?27,\s?26/);
  });

  it("does not reshell the paper when the dock opens", () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    const before = screen.getByTestId("paper-view").getAttribute("style");

    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.getByTestId("dock-scrim")).toBeInTheDocument();
    expect(screen.getByTestId("paper-view").getAttribute("style")).toBe(before);

    openTools();
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
    expect(screen.getByTestId("paper-view").getAttribute("style")).toBe(before);
  });
});

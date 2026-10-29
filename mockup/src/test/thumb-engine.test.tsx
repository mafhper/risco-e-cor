// The thumbnail used to be a second stroke engine (thumb-divergencia.md).
//
// The studio paints a stroke with `brushCanvas`: one dab per step, one
// `globalAlpha` per dab, so overlapping dabs ACCUMULATE. A surface mounting
// `<ArtworkSvg layer="all">` painted the same command with `strokeTexture`: one
// `<path>` per layer and one opacity per path, so overlaps never accumulate.
// Measured on the same crayon stroke, the SVG thumbnail was 4.0x wider, 5.1x
// more ink and 2.4x darker than the canvas it sat next to.
//
// The seam these tests pin is the surface contract, not a renderer detail:
// **a surface that shows somebody's piece paints it with the raster engine.**
// It is observable exactly the way the defect was measured — a `canvas` that
// holds the sheet, and no `path[data-layer]` (the SVG halves of `ArtworkPaint`
// carry only the flat colour and the printed line).
import type { ReactNode } from "react";
import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emptyHistory, push, type StrokeCommand } from "@/mockup/history";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { GalleryScreen, ViewScreen } from "@/mockup/screens/GalleryScreen";
import { ProfileScreen } from "@/mockup/screens/ProfileScreen";
import { StoreProvider, useStore, type Artwork } from "@/mockup/store";

const SHEET = { w: 300, h: 650 } as const;

const CRAYON: StrokeCommand = {
  t: "stroke",
  id: "s-base",
  brush: "crayon",
  color: "#2B7FFF",
  size: 6,
  points: [
    [40, 120],
    [140, 170],
    [240, 210],
  ],
};

const piece = (id: string, visibility: Artwork["visibility"]): Artwork => ({
  id,
  profileId: "maria",
  pageId: null,
  w: SHEET.w,
  h: SHEET.h,
  history: push(emptyHistory(), { ...CRAYON, id: `s-${id}` }),
  createdAt: 1,
  updatedAt: 2,
  visibility,
  publishedAt: null,
});

/** The author's own collection: one draft in the grid, one piece kept aside. */
function Seeded({ children }: { children: ReactNode }) {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
    dispatch({ type: "createArtwork", artwork: piece("traco", "draft") });
    dispatch({ type: "createArtwork", artwork: piece("guardado", "archived") });
  }, [dispatch]);
  return <>{children}</>;
}

const mount = (node: ReactNode) =>
  render(
    <StoreProvider>
      <Seeded>{node}</Seeded>
    </StoreProvider>,
  );

/** The studio for `traco`, with a second stroke committed on demand. */
function Studio() {
  const { state } = useStore();
  const art = state.artworks.find((a) => a.id === "traco");
  if (!art) return null;
  return (
    <>
      <CommitStroke art={art} />
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
    </>
  );
}

/** One more command after mount: the studio then asks where the piece lives. */
function CommitStroke({ art }: { art: Artwork }) {
  const { dispatch } = useStore();
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "setHistory",
          id: art.id,
          history: push(art.history, {
            ...CRAYON,
            id: `s-${art.history.commands.length}`,
          }),
        })
      }
    >
      mais um traço
    </button>
  );
}

/** The sheet a canvas paints, in artwork units. */
function sheetOfCanvas(canvas: Element, scale = 1) {
  return {
    w: Number(canvas.getAttribute("width")),
    h: Number(canvas.getAttribute("height")),
    scale,
  };
}

/** The sheet a card paints, in artwork units. */
function sheetOf(card: Element, scale = 1) {
  const canvases = [...card.querySelectorAll("canvas")];
  expect(canvases).toHaveLength(1);
  return sheetOfCanvas(canvases[0]!, scale);
}

/** Every piece this surface shows is painted by the raster engine. */
function expectRasterSurface(surface: HTMLElement) {
  expect(surface.querySelectorAll("path[data-layer]")).toHaveLength(0);
  const canvases = [...surface.querySelectorAll("canvas")];
  expect(canvases.length).toBeGreaterThan(0);
  return canvases;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("the thumbnails paint with the raster engine", () => {
  it("the gallery grid draws the piece on a canvas, not as SVG strokes", () => {
    mount(<GalleryScreen back={{ name: "home" }} />);

    const card = screen.getByLabelText("Abrir desenho livre");
    expectRasterSurface(card);
    // The whole sheet at 1x, like the mural card: the migration must not crop
    // (`focus`) nor pay four times the memory (`scale`) for a thumbnail.
    expect(sheetOf(card)).toEqual({ w: SHEET.w, h: SHEET.h, scale: 1 });
  });

  it("a piece kept aside draws the same way as one in the grid", () => {
    mount(<GalleryScreen back={{ name: "home" }} />);
    fireEvent.click(screen.getByRole("button", { name: /^guardados/ }));

    const card = screen.getByLabelText("Abrir guardado desenho livre");
    expectRasterSurface(card);
    expect(sheetOf(card)).toEqual({ w: SHEET.w, h: SHEET.h, scale: 1 });
  });

  it("the view screen draws the piece at the studio's own resolution", () => {
    mount(
      <ViewScreen
        artworkId="traco"
        readonly={false}
        back={{ name: "gallery", back: { name: "home" } }}
      />,
    );

    const canvases = expectRasterSurface(document.body);
    expect(canvases).toHaveLength(1);
    // A preview this size is read like the studio paper, so it carries the
    // studio's 2x: 1x here would be upscaled on a phone screen.
    expect(sheetOfCanvas(canvases[0]!, 2)).toEqual({
      w: SHEET.w * 2,
      h: SHEET.h * 2,
      scale: 2,
    });
  });

  it("the profile feed draws every piece on a canvas", () => {
    mount(<ProfileScreen />);

    const feed = screen.getByTestId("profile-feed");
    const canvases = expectRasterSurface(feed);
    // One card per piece of the author, and the feed also carries the demo
    // page Maria started with: every one of them is raster, page or not.
    const cards = [...feed.querySelectorAll("[data-artwork]")];
    expect(cards).toHaveLength(canvases.length);
    expect(sheetOf(cards.find((c) => c.getAttribute("data-artwork") === "traco")!)).toEqual({
      w: SHEET.w,
      h: SHEET.h,
      scale: 1,
    });
  });

  it("the save dialog previews the piece with the engine that drew it", () => {
    mount(<Studio />);
    fireEvent.click(screen.getByText("mais um traço"));
    fireEvent.click(within(screen.getByTestId("canvas")).getByTestId("chrome-back"));

    const dialog = screen.getByTestId("save-dialog");
    expectRasterSurface(dialog);
    // The dialog sat two centimetres from the paper and showed a different
    // drawing (thumb-divergencia §1): it is the same sheet, at 1x.
    expect(sheetOf(dialog)).toEqual({ w: SHEET.w, h: SHEET.h, scale: 1 });
  });

  it("the 3-5 dialog previews it the same way", () => {
    // Theo already owns a free drawing with strokes in the demo seed.
    function KidsStudio() {
      const { state, dispatch } = useStore();
      useEffect(() => {
        dispatch({ type: "selectProfile", id: "theo" });
      }, [dispatch]);
      const art = state.artworks.find((a) => a.profileId === "theo" && a.pageId === null);
      if (!art) return null;
      return (
        <>
          <CommitStroke art={art} />
          <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
        </>
      );
    }

    render(
      <StoreProvider>
        <KidsStudio />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByText("mais um traço"));
    fireEvent.click(within(screen.getByTestId("canvas")).getByTestId("chrome-back"));

    const dialog = screen.getByTestId("save-dialog-kids");
    expectRasterSurface(dialog);
    expect(sheetOf(dialog)).toEqual({ w: SHEET.w, h: SHEET.h, scale: 1 });
  });
});

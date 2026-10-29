// Slice 2 of export-png.md §7: the two doors — "Guardar foto" (the owner's
// view) and "Compartilhar" (the adult's content tab) — describe the SAME file
// for the same piece, and that description comes from the piece, never from a
// node on the screen.
//
// The file writer is the one collaborator faked here: it is the call that
// touches the device's storage, and its argument is the whole contract.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtworkPaint } from "@/mockup/ArtworkPaint";
import { exportArtwork, type ExportPlan } from "@/mockup/exportPng";
import { PAPERS } from "@/mockup/palette";
import { AdultScreen } from "@/mockup/screens/AdultScreen";
import { ViewScreen } from "@/mockup/screens/GalleryScreen";
import { StoreProvider, useStore } from "@/mockup/store";

vi.mock("@/mockup/exportPng", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/mockup/exportPng")>();
  return { ...actual, exportPng: vi.fn(async () => {}) };
});

import { exportPng } from "@/mockup/exportPng";

const writer = vi.mocked(exportPng);

beforeEach(() => {
  localStorage.clear();
  writer.mockClear();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const HOME = { name: "home" } as const;

/** The owner's view of one seed piece. */
function ViewHarness({ profileId, pageId }: { profileId: string; pageId: string | null }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return <ViewScreen artworkId={art.id} readonly={false} back={HOME} />;
}

/** The adult's content tab, where every piece of the family is listed. */
function AdultHarness() {
  return (
    <StoreProvider>
      <AdultScreen focus="global" back={HOME} />
    </StoreProvider>
  );
}

function lastPlan(): ExportPlan {
  const call = writer.mock.calls.at(-1);
  if (!call) throw new Error("the writer was never called");
  return call[0];
}

function lastFilename(): string {
  const call = writer.mock.calls.at(-1);
  if (!call) throw new Error("the writer was never called");
  return call[1];
}

describe("export — the two doors write one file", () => {
  it("'Guardar foto' describes the piece, not the preview it is drawn in", async () => {
    render(
      <StoreProvider>
        <ViewHarness profileId="theo" pageId={null} />
      </StoreProvider>,
    );

    fireEvent.click(screen.getByLabelText("Guardar foto (PNG)"));
    await waitFor(() => expect(writer).toHaveBeenCalledTimes(1));

    const plan = lastPlan();
    // Theo's seed is a free drawing on the phone-tall sheet: the file is the
    // sheet, not the square preview box the screen happens to show.
    expect(plan.view).toEqual({ w: 300, h: 650 });
    expect(plan.width).toBe(554);
    expect(plan.height).toBe(1200);
    expect(plan.paper.hex).toBe("#ffffff");
    // The strokes travel: the preview's own SVG is not the source any more.
    expect(plan.commands.filter((c) => c.t === "stroke")).toHaveLength(5);
    expect(lastFilename()).toMatch(/^desenho-\d{4}-\d{2}-\d{2}\.png$/);
  });

  it("'Compartilhar' hands over exactly the same plan as 'Guardar foto'", async () => {
    render(
      <StoreProvider>
        <ViewHarness profileId="theo" pageId={null} />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText("Guardar foto (PNG)"));
    await waitFor(() => expect(writer).toHaveBeenCalledTimes(1));
    const fromSave = lastPlan();
    cleanup();

    render(<AdultHarness />);
    fireEvent.click(screen.getByRole("tab", { name: "Conteúdo" }));
    // Theo has two pieces; the free sheet is the draft, so the filter leaves
    // exactly one row to share.
    fireEvent.click(screen.getByRole("button", { name: "Rascunhos" }));
    fireEvent.click(screen.getByLabelText("Compartilhar desenho de Theo"));
    await waitFor(() => expect(writer).toHaveBeenCalledTimes(2));
    const fromShare = lastPlan();

    expect(fromShare).toEqual(fromSave);
  });

  it("the card's square window never becomes the file's view", () => {
    const commands = [
      {
        t: "stroke" as const,
        id: "s1",
        color: "#2F6FD6",
        size: 6,
        points: [
          [20, 20],
          [90, 90],
        ] as [number, number][],
      },
    ];
    // A card crops a square window out of the sheet (ArtworkPaint `focus`).
    const card = render(
      <ArtworkPaint
        pageId={null}
        w={300}
        h={650}
        commands={commands}
        focus={{ x: 0, y: 0, size: 300 }}
      />,
    );
    expect(card.container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 300 300");
    card.unmount();

    const plan = exportArtwork(commands, null, 300, 650, PAPERS.linho);
    expect(plan.view).toEqual({ w: 300, h: 650 });
  });

  it("the plan is a closed description: no screen surface has a field to travel in", () => {
    const plan = exportArtwork([], "peixe", 300, 300, PAPERS.quadriculado);
    expect(Object.keys(plan).sort()).toEqual([
      "commands",
      "height",
      "layers",
      "outlineHex",
      "pageId",
      "paper",
      "view",
      "width",
    ]);
    const consumed = JSON.stringify(plan);
    for (const surface of ["paper-grid", "desk-surface", "page-area", "paint-canvas"]) {
      expect(consumed).not.toContain(surface);
    }
  });

  it("neither door reaches into the DOM for an <svg>", () => {
    // A structural guard for the defect of export-png.md §2: the file used to
    // be the serialization of whatever node the row happened to contain.
    for (const file of [
      "src/mockup/screens/AdultScreen.tsx",
      "src/mockup/screens/GalleryScreen.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain('querySelector("svg")');
      expect(source).not.toContain("svgRef");
    }
  });
});

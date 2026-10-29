// The settings the author tuned, remembered per material and per person
// (owner's call, 26/10). Seam: the sheet the hand touches — a slider moved on
// one material and read back after a round trip through the shelf.
//
// One value is deliberately NOT per material: the 1..100 thickness is ONE number
// per person and the material that arrives inherits it (owner's decision, 26/10,
// `painel-chevrons` §11.3). The non-regression test below measures the
// inheritance, not "not zeroing".
//
// The profile is the store: a reload reads the same points back, and another
// person on the same device finds the band defaults instead of someone else's.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openFold, openTools } from "./open-panel";
import { StoreProvider, normalizeToolSettings, toolMemoryOf, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Harness({ profileId, pageId = null }: { profileId: string; pageId?: string | null }) {
  const { state, dispatch } = useStore();
  const id = `mem-${profileId}-${pageId ?? "blank"}`;
  const selected = state.profileId;
  const loaded = state.loaded;
  useEffect(() => {
    // A reload takes `profileId` back to null (the shell always opens on the
    // Home); the canvas is entered again as the same person as soon as the
    // store is ready, which is what a real re-entry does.
    if (!loaded) return;
    if (selected !== profileId) dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId, selected, loaded]);
  useEffect(() => {
    dispatch({
      type: "createArtwork",
      artwork: {
        id,
        profileId,
        pageId,
        w: 300,
        h: 300,
        history: { commands: [], redo: [], undoable: 0 },
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
      <span data-testid="memory">
        {JSON.stringify(
          Object.fromEntries(state.profiles.map((p) => [p.id, p.toolSettings ?? null])),
        )}
      </span>
      {/* The one thickness is outside the per-material map, so it is printed
          beside it: the profile is where it lives. */}
      <span data-testid="sizes">
        {JSON.stringify(
          Object.fromEntries(state.profiles.map((p) => [p.id, p.strokeSize ?? null])),
        )}
      </span>
    </>
  );
}

const mount = (profileId = "maria", pageId: string | null = null) =>
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} />
    </StoreProvider>,
  );

const memory = () => JSON.parse(screen.getByTestId("memory").textContent || "{}");
const sizes = () => JSON.parse(screen.getByTestId("sizes").textContent || "{}");
const value = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
const set = (label: string, next: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: next } });
const chipColor = () => screen.getByTestId("color-chip").getAttribute("data-hex")!.toUpperCase();

describe("per material, the sheet reopens where it was left", () => {
  it("round-trips opacity and water of the watercolour, and nothing else", () => {
    mount("maria");
    openTools();
    // The controls live inside the folds, which open CLOSED since 27/10.
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Aquarela"));
    set("Opacidade", "60");
    set("Água", "80");

    // The pencil has no entry of its own: the band default reads through.
    fireEvent.click(screen.getByLabelText("Lápis"));
    expect(value("Opacidade")).toBe("100");
    expect(screen.queryByLabelText("Água")).toBeNull();

    fireEvent.click(screen.getByLabelText("Aquarela"));
    expect(value("Opacidade")).toBe("60");
    expect(value("Água")).toBe("80");
  });

  it("hands the thickness in use to the material that arrives (§11.3)", () => {
    mount("maria");
    openTools();
    // The controls live inside the folds, which open CLOSED since 27/10.
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Aquarela"));
    set("Tamanho", "48");
    // The slider wrote nothing into the per-material map: the point is not a
    // property of the material (§11.3).
    expect(memory().maria).toBeNull();

    // The new material INHERITS the number — it does not open at 6, and it does
    // not open at any per-material point of its own.
    fireEvent.click(screen.getByLabelText("Lápis"));
    expect(value("Tamanho")).toBe("48");
    set("Tamanho", "23");

    // The eraser reads the same number: one capsule, one thickness.
    fireEvent.click(screen.getByLabelText("Borracha"));
    expect(value("Tamanho")).toBe("23");

    // Coming back never restores a per-material point: there is only one.
    fireEvent.click(screen.getByLabelText("Aquarela"));
    expect(value("Tamanho")).toBe("23");
    expect(memory().maria).toBeNull();
    expect(sizes().maria).toBe(23);
  });

  it("keeps the pencil's own hardness", () => {
    mount("maria");
    openTools();
    // The controls live inside the folds, which open CLOSED since 27/10.
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Lápis"));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Dureza" })).getByText("Duro"));

    fireEvent.click(screen.getByLabelText("Pincel"));
    expect(screen.queryByRole("radiogroup", { name: "Dureza" })).toBeNull();

    fireEvent.click(screen.getByLabelText("Lápis"));
    expect(
      within(screen.getByRole("radiogroup", { name: "Dureza" })).getByText("Duro"),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("keeps a colour per material, not one colour for the whole pen", () => {
    mount("maria");
    openTools();
    // The controls live inside the folds, which open CLOSED since 27/10.
    openFold("fold-ajustes");
    openFold("fold-cor");
    fireEvent.click(screen.getByLabelText("Aquarela"));
    fireEvent.click(screen.getAllByTestId("palette-family")[2]!);
    const wash = chipColor();

    fireEvent.click(screen.getByLabelText("Lápis"));
    fireEvent.click(screen.getAllByTestId("palette-family")[6]!);
    const graphite = chipColor();
    expect(graphite).not.toBe(wash);

    fireEvent.click(screen.getByLabelText("Aquarela"));
    expect(chipColor()).toBe(wash);
    fireEvent.click(screen.getByLabelText("Lápis"));
    expect(chipColor()).toBe(graphite);
  });

  it("writes the memory into the profile, so a reload reads it back", async () => {
    mount("maria");
    openTools();
    // The controls live inside the folds, which open CLOSED since 27/10.
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Carvão"));
    set("Opacidade", "37");
    set("Tamanho", "37");
    // Opacity is the material's; the point is the person's.
    expect(memory().maria.charcoal).toMatchObject({ opacity: 37 });
    expect(memory().maria.charcoal).not.toHaveProperty("size");
    expect(sizes().maria).toBe(37);

    cleanup();
    mount("maria");
    // A reload opens on the Home and the person is selected again; the canvas
    // is the same sheet, and both numbers reopen where they were.
    await screen.findByTestId("canvas-dock");
    openTools();
    // The controls live inside the folds, which open CLOSED since 27/10.
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Carvão"));
    expect(value("Opacidade")).toBe("37");
    expect(value("Tamanho")).toBe("37");
  });

  it("does not leak one person's tuning into another profile", () => {
    mount("maria");
    openTools();
    // The controls live inside the folds, which open CLOSED since 27/10.
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Pincel"));
    set("Opacidade", "55");

    const both = memory();
    expect(both.maria.brush).toMatchObject({ opacity: 55 });
    expect(both.theo).toBeNull();
  });
});

describe("a backup is never trusted", () => {
  it("drops a malformed colour and clamps every number to what the panel can show", () => {
    expect(
      toolMemoryOf({ size: 0, opacity: 5, water: 140, hardness: "glass", color: "azul" }),
    ).toEqual({ opacity: 20, water: 100 });
    expect(toolMemoryOf({ size: 42, color: "#ab12cd", hardness: "hard" })).toEqual({
      color: "#AB12CD",
      hardness: "hard",
    });
    // A per-material size is exactly what the owner's decision forbids reading
    // back (§11.3): a save that still carries one loses it, nothing else.
    expect(toolMemoryOf({ size: 42 })).toEqual({});
  });

  it("keeps only entries that still carry something, and caps the map", () => {
    expect(normalizeToolSettings(null)).toBeNull();
    expect(normalizeToolSettings({ brush: { opacity: 30 }, marker: { color: "nope" } })).toEqual({
      brush: { opacity: 30 },
    });
  });
});

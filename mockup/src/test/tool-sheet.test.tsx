// The sheet that replaced "favorites": every allowed tool listed, each with a
// switch for the toolbar row, and the "Minhas" list reorders by explicit arrows.
// Rendered on its own so the sheet's wiring is tested without dock choreography.
//
// Since 27/10 the DOOR is not part of the shelf any more (owner's decision): it
// lives in the expanded panel's title band. The harness below plays that part —
// a door with the same name and the same testid, holding the same flag the panel
// holds — so these tests keep walking the path a hand walks.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrushShelf } from "@/mockup/screens/BrushShelf";
import type { CanvasTool } from "@/mockup/brush";

const ROW: CanvasTool[] = ["fill", "pencil", "brush", "eraser"];
const CATALOG: CanvasTool[] = ["fill", "pencil", "charcoal", "brush", "marker", "eraser"];

/** The panel's title band: the door and the flag it holds (`Panel`). */
function Harness({
  onPick = () => {},
  onToggleSlot = () => {},
  onMoveSlot = () => {},
}: {
  onPick?: (tool: CanvasTool) => void;
  onToggleSlot?: (tool: CanvasTool) => void;
  onMoveSlot?: (tool: CanvasTool, dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Organizar ferramentas"
        data-testid="shelf-organize"
        onClick={() => setOpen(true)}
      >
        Organizar
      </button>
      <BrushShelf
        tools={ROW}
        catalog={CATALOG}
        active="brush"
        color="#2B7FFF"
        size={24}
        kids={false}
        grouped
        organizeOpen={open}
        onOrganizeOpenChange={setOpen}
        onPick={onPick}
        onToggleSlot={onToggleSlot}
        onMoveSlot={onMoveSlot}
      />
    </>
  );
}

const mount = () => {
  const onPick = vi.fn();
  const onToggleSlot = vi.fn();
  const onMoveSlot = vi.fn();
  render(<Harness onPick={onPick} onToggleSlot={onToggleSlot} onMoveSlot={onMoveSlot} />);
  fireEvent.click(screen.getByLabelText("Organizar ferramentas"));
  return { onPick, onToggleSlot, onMoveSlot };
};

const listOrder = () =>
  [...document.querySelectorAll("[data-tool-row]")].map((el) => el.getAttribute("data-tool-row"));

afterEach(cleanup);

describe("the shelf is the tools, never a menu", () => {
  it("has no collections cell and no door of its own, and still opens the list", () => {
    render(<Harness />);
    const shelf = screen.getByTestId("tool-shelf");
    // The eleventh cell said "Mais" and opened collections; it is gone (owner's
    // call, 26/10 — order and visibility live in "Minhas" alone).
    expect(within(shelf).queryByLabelText("Coleções de ferramentas")).toBeNull();
    expect(within(shelf).queryByText("Mais")).toBeNull();
    expect(within(shelf).getAllByRole("button")).toHaveLength(ROW.length);
    // The way in is NOT a line under the row either (owner's decision, 27/10):
    // the shelf carries the tools and nothing else.
    expect(within(shelf).queryByTestId("shelf-organize")).toBeNull();

    const door = screen.getByTestId("shelf-organize");
    expect(door).toHaveAccessibleName("Organizar ferramentas");
    expect(shelf.contains(door)).toBe(false);
    fireEvent.click(door);
    expect(screen.getByTestId("shelf-sheet")).toBeInTheDocument();
  });

  it("closes the list when a tool is picked, and never by itself", async () => {
    mount();
    const list = screen.getByTestId("shelf-sheet");
    expect(list).toBeInTheDocument();
    // The row of the SHEET is the pick that closes it (the chip under the sheet
    // only changes the material, which is why the sheet is still on top).
    fireEvent.click(within(list).getByText("Pincel"));
    // Choosing a material is a done gesture: the list has nothing left to say.
    // (The presence layer keeps it mounted for its 150ms exit.)
    await waitFor(() => expect(screen.queryByTestId("shelf-sheet")).toBeNull());
  });
});

describe("tool sheet: switches and order", () => {
  it("opens on Minhas with the toolbar row, in the stored order", () => {
    mount();
    expect(listOrder()).toEqual(ROW);
    expect(screen.queryByText(/Favorit/)).toBeNull();
  });

  it("switches a tool on/off by name and reports the tool, not the row index", () => {
    const { onToggleSlot } = mount();
    fireEvent.click(screen.getByTestId("slot-switch-eraser"));
    expect(onToggleSlot).toHaveBeenCalledWith("eraser");
  });

  it("moves with the arrow and hides the impossible direction", () => {
    const { onMoveSlot } = mount();
    expect(screen.queryByLabelText("Mover Pintar para cima")).toBeNull();
    fireEvent.click(screen.getByLabelText("Mover Pincel para cima"));
    expect(onMoveSlot).toHaveBeenCalledWith("brush", -1);
    expect(screen.queryByLabelText("Mover Borracha para baixo")).toBeNull();
  });

  it("lists disabled tools in the categories, still switchable", () => {
    const { onToggleSlot } = mount();
    fireEvent.click(screen.getByText("Canetas"));
    expect(listOrder()).toContain("marker");
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar Marcador na barra" }));
    expect(onToggleSlot).toHaveBeenCalledWith("marker");
  });
});

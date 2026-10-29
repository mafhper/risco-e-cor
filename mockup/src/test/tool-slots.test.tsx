// The toolbar row is the profile's own list (owner's call, 24/10): the sheet
// that used to hold "favorites" now turns tools on and off and reorders them,
// and the row reads exactly that list. The seam tested here is profile ->
// toolbar: what the profile stores is what the bar shows.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { StoreProvider, useStore } from "@/mockup/store";

function Harness({ slots }: { slots?: string[] }) {
  const { state, dispatch } = useStore();
  const key = slots?.join(",") ?? "default";
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
    if (slots) dispatch({ type: "setToolSlots", id: "maria", slots });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, key]);
  const art = state.artworks.find((a) => a.profileId === "maria" && a.pageId === "peixe");
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

const rowTools = () =>
  [...screen.getByTestId("tool-shelf").querySelectorAll("[data-tool]")].map((el) =>
    el.getAttribute("data-tool"),
  );

const renderWith = (slots?: string[]) =>
  render(
    <StoreProvider>
      <Harness {...(slots ? { slots } : {})} />
    </StoreProvider>,
  );

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("toolbar tools: the profile's own list", () => {
  it("leaves out a tool the profile switched off", () => {
    renderWith(["fill", "pencil", "brush", "eraser"]);
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(rowTools()).toContain("pencil");
    expect(rowTools()).not.toContain("marker");
  });

  it("follows the stored order, not the catalog order", () => {
    renderWith(["eraser", "brush", "fill"]);
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(rowTools()).toEqual(["eraser", "brush", "fill"]);
  });

  it("keeps the door open when the list is empty", () => {
    renderWith([]);
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(rowTools()).toEqual([]);
    expect(screen.getByTestId("shelf-organize")).toBeInTheDocument();
  });
});

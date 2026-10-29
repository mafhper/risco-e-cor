// One Escape, one layer. Measured bug: with the "Criar" sheet open on a
// profile, a single Esc closed the sheet AND ran the shell's profile -> home
// back action, throwing the child out of their space. The shell and the sheets
// each owned a window listener, so both fired for the same keystroke.
//
// The rule under test: Escape goes to the topmost overlay only; the screen's
// back action runs only when no overlay is open.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "@/mockup/AppShell";
import { push } from "@/mockup/history";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { StoreProvider, useStore } from "@/mockup/store";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const pressEscape = () => fireEvent.keyDown(window, { key: "Escape" });

function mountApp() {
  return render(
    <StoreProvider>
      <AppShell />
    </StoreProvider>,
  );
}

function enterProfile(name: string) {
  fireEvent.click(screen.getByLabelText(`Entrar no perfil de ${name}`));
}

describe("Escape closes one layer at a time", () => {
  it("closes the open sheet and stays on the profile instead of also going home", () => {
    mountApp();
    enterProfile("Maria");

    fireEvent.click(screen.getByRole("button", { name: /Começar a desenhar/ }));
    expect(screen.getByRole("dialog", { name: "Criar" })).toBeInTheDocument();

    pressEscape();

    // The sheet is gone and the child is still in their space: one Esc, one layer.
    expect(screen.queryByRole("dialog", { name: "Criar" })).toBeNull();
    expect(screen.getByTestId("profile")).toBeInTheDocument();
    expect(screen.queryByTestId("home")).toBeNull();
  });

  it("leaves the profile only when there is no overlay to close", () => {
    mountApp();
    enterProfile("Maria");

    pressEscape();

    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.queryByTestId("profile")).toBeNull();
  });

  it("closes the sheet first and only then leaves the profile", () => {
    mountApp();
    enterProfile("Maria");

    fireEvent.click(screen.getByRole("button", { name: /Começar a desenhar/ }));
    pressEscape();
    expect(screen.getByTestId("profile")).toBeInTheDocument();

    pressEscape();
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });
});

describe("Escape respects the paint order of stacked overlays", () => {
  it("closes the save dialog before the tools panel it was opened over", () => {
    function CanvasHarness() {
      const { state, dispatch } = useStore();
      useEffect(() => {
        dispatch({ type: "selectProfile", id: "maria" });
      }, [dispatch]);
      // Maria's coloring page: 9+, so the "Mais" panel is on her canvas.
      const art = state.artworks.find((a) => a.profileId === "maria" && a.pageId === "peixe");
      if (!art) return null;
      // A new stroke is what makes leaving the canvas ask where the piece lives.
      const addStroke = () =>
        dispatch({
          type: "setHistory",
          id: art.id,
          history: push(art.history, {
            t: "stroke",
            id: "escape-test-stroke",
            color: "#000000",
            size: 6,
            points: [
              [10, 10],
              [40, 40],
            ],
          }),
        });
      return (
        <>
          <button type="button" onClick={addStroke}>
            desenhar um traço
          </button>
          <CanvasScreen artworkId={art.id} back={{ name: "profile" }} />
        </>
      );
    }

    render(
      <StoreProvider>
        <CanvasHarness />
      </StoreProvider>,
    );

    fireEvent.click(screen.getByText("desenhar um traço"));
    // Two overlays, in paint order: the tools sheet (opened through the pill and
    // the drawer's latch) and the save dialog on top of it.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(screen.getByRole("dialog", { name: "Painel da ferramenta" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("fold-papel"));
    expect(screen.getByTestId("fold-papel")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByTestId("chrome-back"));
    expect(screen.getByText("Guardar desenho?")).toBeInTheDocument();

    pressEscape();

    // The dialog on top consumed the keystroke; the sheet underneath stayed.
    expect(screen.queryByRole("dialog", { name: "Guardar desenho?" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Painel da ferramenta" })).toBeInTheDocument();

    pressEscape();

    expect(screen.queryByRole("dialog", { name: "Painel da ferramenta" })).toBeNull();
  });
});

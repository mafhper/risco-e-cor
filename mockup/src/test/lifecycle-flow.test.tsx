// The child-side lifecycle (ciclo-vida-obra §3.1/§3.2): "Jogar fora" is the
// only destructive verb a child sees, it never asks with a modal, and it leaves
// a 5s undo that survives leaving the screen. A published piece has no such
// button — taking it off the mural is the adult's call.
//
// The card in the child's feed opens the EDITOR (a drawing is not a video), so
// the discard path is the small, separate trash target of the save sheet.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/mockup/AppShell";
import { StoreProvider, useStore } from "@/mockup/store";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

function Harness() {
  const { state } = useStore();
  // The seed's freehand draft is the one this file discards and restores.
  const draft = state.artworks.find((a) => a.profileId === "theo" && a.pageId === null);
  return (
    <>
      <AppShell />
      <span data-testid="count">{state.artworks.length}</span>
      <span data-testid="trash">{state.trash.length}</span>
      <span data-testid="draft-vis">{draft ? draft.visibility : "gone"}</span>
    </>
  );
}

const mount = () =>
  render(
    <StoreProvider>
      <Harness />
    </StoreProvider>,
  );

/** Theo's home → the draft card → the editor. */
function openDraft() {
  fireEvent.click(screen.getByLabelText("Entrar no perfil de Theo"));
  fireEvent.click(screen.getByLabelText("Abrir desenho no editor"));
}

/** One real stroke, then the exit: the save sheet is the only way out. */
function drawAndLeave() {
  openDraft();
  const svg = screen.getByTestId("paper-view").querySelector("svg")!;
  fireEvent.pointerDown(svg, { pointerId: 1, clientX: 60, clientY: 80 });
  fireEvent.pointerUp(svg, { pointerId: 1, clientX: 110, clientY: 140 });
  fireEvent.click(screen.getByTestId("chrome-back"));
  expect(screen.getByTestId("save-dialog-kids")).toBeInTheDocument();
}

describe("discard a draft", () => {
  it("sends the piece to the trash, offers undo, and restores it", () => {
    mount();
    drawAndLeave();
    expect(screen.getByTestId("count").textContent).toBe("3");

    fireEvent.click(screen.getByLabelText("Jogar fora"));
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("trash").textContent).toBe("1");
    // No modal was used; the net is temporal.
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByTestId("undo-bar")).toBeInTheDocument();
    // The way out skips a view of a piece that just left: the profile stands.
    expect(screen.getByTestId("profile")).toBeInTheDocument();

    // Undo works while navigating: the bar lives in the shell, not the screen.
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(screen.getByTestId("trash").textContent).toBe("0");
    expect(screen.queryByTestId("undo-bar")).toBeNull();
    expect(screen.getByTestId("draft-vis").textContent).toBe("draft");
  });

  it("drops the undo after five seconds", () => {
    vi.useFakeTimers();
    mount();
    drawAndLeave();
    fireEvent.click(screen.getByLabelText("Jogar fora"));
    expect(screen.getByTestId("undo-bar")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId("undo-bar")).toBeNull();
    // The piece stays in the trash: expiry never restores by itself.
    expect(screen.getByTestId("trash").textContent).toBe("1");
  });

  it("never offers the destructive verb on a published piece", () => {
    mount();
    // The family wall opens a published piece read-only.
    fireEvent.click(screen.getByLabelText("Ver desenho de Theo"));
    expect(screen.queryByLabelText("Jogar fora")).toBeNull();
    // The only signal is the star: the mural is the adult's call.
    expect(screen.getByLabelText("No mural")).toBeInTheDocument();
  });
});

describe("the save sheet keeps the piece safe by default", () => {
  it("'Voltar ao editor' returns to the canvas without trashing anything", () => {
    mount();
    drawAndLeave();
    expect(screen.getByTestId("count").textContent).toBe("3");

    fireEvent.click(screen.getByTestId("save-card-continue"));
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(screen.getByTestId("trash").textContent).toBe("0");
  });

  it("'Guardar na pasta' keeps the piece as a draft and goes back", () => {
    mount();
    drawAndLeave();
    fireEvent.click(screen.getByTestId("save-card-draft"));
    expect(screen.getByTestId("count").textContent).toBe("3");
    expect(screen.getByTestId("trash").textContent).toBe("0");
    expect(screen.getByTestId("draft-vis").textContent).toBe("draft");
    expect(screen.getByTestId("profile")).toBeInTheDocument();
  });
});

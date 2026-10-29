// Seam: the whole kids DOM, not just the dock. The audit's P0 was exactly this
// gap — the zero-text test scanned `canvas-panel` only, so `guardar` and `%`
// lived happily in the chrome. Here the sweep is the SCREEN.
//
// The forbidden list is the one from sem-texto-3-5 §3-1 plus the words the
// audit caught in the wild (guardar, Continuar, Jogar fora) and bare counters.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { emptyHistory, push } from "@/mockup/history";
import { AppShell } from "@/mockup/AppShell";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { ProfileScreen } from "@/mockup/screens/ProfileScreen";

const FORBIDDEN =
  /Tamanho|Opacidade|Água|Dureza|CORES|Cores|RECENTES|Recentes|Favoritas|HEX|px|%|guardar|Guardar|Continuar|Jogar fora|No mural|Só meus|Todos/i;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function CanvasHarness({ profileId, pageId }: { profileId: string; pageId: string | null }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

function ProfileHarness({ profileId }: { profileId: string }) {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  return <ProfileScreen />;
}

describe("kids canvas: zero functional text in the whole screen", () => {
  it("shows no forbidden word and no bare counter anywhere in the canvas", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="theo" pageId={null} />
      </StoreProvider>,
    );
    const canvas = screen.getByTestId("canvas");
    const text = canvas.textContent ?? "";
    expect(text.trim()).toBe("");
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(/\d/);
  });

  it("replaces 'guardar' with the exit dialog and the corner with the zoom readout", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="theo" pageId={null} />
      </StoreProvider>,
    );
    // No permanent save button and no number: the readout only exists while a
    // zoom is happening, and the corner is an AREA, not a glyph (27/10).
    expect(screen.queryByTestId("canvas-hud-save")).toBeNull();
    expect(screen.queryByText("%")).toBeNull();
    expect(screen.queryByLabelText("Zoom")).toBeNull();

    fireEvent.click(screen.getByTestId("zoom-tap"));
    const zoom = screen.getByTestId("zoom-hud");
    // The number is DATA, and 3-5 reads zero text: the two targets carry the
    // action, the readout stays a value.
    expect(within(zoom).getByLabelText("Diminuir zoom").textContent?.trim()).toBe("");
    expect(within(zoom).getByLabelText("Aumentar zoom").textContent?.trim()).toBe("");
  });

  it("keeps the whole exit dialog icon-only, including the discard path", () => {
    function DraftHarness() {
      const { state, dispatch } = useStore();
      useEffect(() => {
        dispatch({ type: "selectProfile", id: "theo" });
      }, [dispatch]);
      const art = state.artworks.find((a) => a.profileId === "theo" && a.pageId === null);
      if (!art) return null;
      return (
        <>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "setHistory",
                id: art.id,
                history: push(emptyHistory(), {
                  t: "stroke",
                  id: "x",
                  color: "#000000",
                  size: 6,
                  points: [
                    [10, 10],
                    [40, 40],
                  ],
                }),
              })
            }
          >
            tracejar
          </button>
          <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
        </>
      );
    }
    render(
      <StoreProvider>
        <DraftHarness />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByText("tracejar"));
    fireEvent.click(screen.getByTestId("chrome-back"));

    const dialog = screen.getByTestId("save-dialog-kids");
    expect(dialog.textContent?.trim() ?? "").toBe("");
    expect(dialog).not.toHaveTextContent(FORBIDDEN);
    expect(screen.getByTestId("save-card-publish")).toHaveAccessibleName("Publicar");
    expect(screen.getByTestId("save-card-draft")).toHaveAccessibleName("Guardar na pasta");
    expect(screen.getByTestId("save-card-continue")).toHaveAccessibleName("Voltar ao editor");
    expect(screen.getByLabelText("Jogar fora")).toBeInTheDocument();
  });
  it("still offers the third material — the magic bucket — on a coloring page", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="theo" pageId="foguete" />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    // ADR-001 as amended (24/10): wax crayon, marker, brush, magic bucket and
    // block eraser — all five reachable from the compact bar itself.
    expect(within(compact).getByLabelText("Giz de cera")).toBeInTheDocument();
    expect(within(compact).getByLabelText("Pintar")).toBeInTheDocument();
    expect(within(compact).getByLabelText("Borracha")).toBeInTheDocument();
    expect(within(compact).getByLabelText("Pincel")).toBeInTheDocument();
    expect(within(compact).getByLabelText("Marcador")).toBeInTheDocument();
  });
});

describe("kids home: the two portals decide everything", () => {
  it("has no functional text beyond the decorative name", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="theo" />
      </StoreProvider>,
    );
    const home = screen.getByTestId("kids-home");
    const text = (home.textContent ?? "").replace("Theo", "").trim();
    expect(text).toBe("");
    expect(home.textContent).not.toMatch(FORBIDDEN);
    expect(home.textContent).not.toMatch(/\d/);
  });

  it("offers two giant icon portals and a two-column feed, never a side strip", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="theo" />
      </StoreProvider>,
    );
    const colorir = screen.getByTestId("kids-portal-colorir");
    const folha = screen.getByTestId("kids-portal-folha");
    for (const portal of [colorir, folha]) {
      expect(portal).toHaveAccessibleName(
        expect.stringMatching(/Livro de colorir|Folha em branco/),
      );
      expect(portal.className).toContain("min-h-[120px]");
      expect(portal.querySelector("svg")).not.toBeNull();
    }
    // The productions fill the page in a vertical grid; nothing scrolls sideways.
    const feed = screen.getByTestId("kids-feed");
    expect(feed.className).toContain("grid-cols-2");
    expect(feed.className).toContain("grid");
    expect(feed.className).not.toContain("overflow-x-auto");
    // No chip row, no avatar switcher, no creation sheet.
    expect(screen.queryByRole("group", { name: "Perfis" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a piece in the editor, with no play overlay on the card", () => {
    function OpenHarness() {
      const { dispatch } = useStore();
      useEffect(() => {
        dispatch({ type: "selectProfile", id: "theo" });
        dispatch({ type: "go", screen: { name: "profile" } });
      }, [dispatch]);
      return <AppShell />;
    }
    render(
      <StoreProvider>
        <OpenHarness />
      </StoreProvider>,
    );
    const card = screen.getAllByRole("button", { name: /no editor/ })[0]!;
    expect(card.querySelector("svg.lucide-play")).toBeNull();
    fireEvent.click(card);
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });
});

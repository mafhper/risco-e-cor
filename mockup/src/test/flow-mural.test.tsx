// End-to-end click flows through the real store (no mocked internals):
//  - the app opens on the Home: profile row on top, family mural below
//  - tapping a profile enters that profile's space; Home is the only switcher
//  - Perfil -> Home, Canvas/Galeria/Páginas -> the screen that opened it
//  - the persona settings live inside a profile; the globals live on Home
//  - the profile mural keeps its "Só meus"/"Todos" filter across a detour
//  - canvas -> save dialog -> publish (Home) / draft (Perfil)
//  - switching a profile's theme never touches the artwork list
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "@/mockup/AppShell";
import { push } from "@/mockup/history";
import { AdultScreen } from "@/mockup/screens/AdultScreen";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { StoreProvider, useStore, type Screen } from "@/mockup/store";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const HOME: Screen = { name: "home" };

function mountApp() {
  return render(
    <StoreProvider>
      <AppShell />
    </StoreProvider>,
  );
}

/** Enters one profile from the Home — the only place that may switch. */
function enter(name: string) {
  fireEvent.click(screen.getByLabelText(`Entrar no perfil de ${name}`));
}

describe("entry screen", () => {
  it("opens on the Home instead of asking who is drawing", () => {
    mountApp();
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.queryByText("Quem vai desenhar?")).toBeNull();
    expect(screen.queryByTestId("profile")).toBeNull();
  });

  it("lists the profiles in one row and the whole family mural in a grid", () => {
    mountApp();
    const picker = screen.getByRole("group", { name: "Perfis" });
    const names = Array.from(picker.querySelectorAll("button")).map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(names).toEqual(["Entrar no perfil de Maria", "Entrar no perfil de Theo"]);

    const grid = screen.getByTestId("mural-grid");
    expect(grid).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Ver desenho de / })).toHaveLength(2);
  });

  it("offers the global tutor from the Home only", () => {
    mountApp();
    expect(screen.getByLabelText("Configurações gerais")).toBeInTheDocument();

    enter("Maria");
    expect(screen.getByTestId("profile")).toBeInTheDocument();
    expect(screen.queryByLabelText("Configurações gerais")).toBeNull();
  });
});

describe("profile space", () => {
  it("is entered from the Home and returns to it", () => {
    mountApp();
    enter("Maria");
    expect(screen.getByTestId("profile")).toBeInTheDocument();
    // No profile switcher inside: Home is the only place that changes profile.
    expect(screen.queryByRole("group", { name: "Perfis" })).toBeNull();
    expect(screen.queryByLabelText("Entrar no perfil de Theo")).toBeNull();

    fireEvent.click(screen.getByLabelText("Voltar"));
    expect(screen.getByTestId("home")).toBeInTheDocument();
  });

  it("offers the persona settings, never the globals", () => {
    mountApp();
    enter("Maria");
    const persona = screen.getByLabelText("Editar este perfil");
    expect(persona).toBeInTheDocument();
    // The globals have exactly one door, and it is not here.
    expect(screen.queryByLabelText("Configurações gerais")).toBeNull();

    // The persona door is the profile gate, not the global tutor.
    fireEvent.click(persona);
    expect(screen.getByText("Área do adulto")).toBeInTheDocument();
  });

  it("offers exactly one creation action", () => {
    mountApp();
    enter("Maria");
    expect(screen.getByRole("button", { name: /Começar a desenhar/ })).toBeInTheDocument();
    // Draw and color are the same studio; they never appear as parallel tiles.
    expect(screen.queryByRole("button", { name: "Desenhar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Colorir" })).toBeNull();
  });

  it("keeps the profile's own feed when coming back from a detour", () => {
    mountApp();
    enter("Maria");
    const feed = screen.getByTestId("profile-feed");
    const before = within(feed).getAllByRole("button").length;
    expect(before).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText("Meus desenhos"));
    expect(screen.queryByTestId("profile")).toBeNull();
    fireEvent.click(screen.getByLabelText("Voltar"));

    expect(screen.getByTestId("profile")).toBeInTheDocument();
    expect(within(screen.getByTestId("profile-feed")).getAllByRole("button")).toHaveLength(before);
  });

  it("only lists the author's own pieces, never another profile's", () => {
    mountApp();
    enter("Maria");
    const feed = screen.getByTestId("profile-feed");
    expect(within(feed).getAllByRole("button")).toHaveLength(1);
    for (const card of within(feed).getAllByRole("button")) {
      expect(card).toHaveAttribute("data-artwork");
    }
    // Theo's piece belongs to Theo's feed, not Maria's.
    expect(screen.getAllByTestId("profile-feed")).toHaveLength(1);
  });
});

describe("navigation: every internal screen returns to its origin", () => {
  it("returns from the canvas to the profile it was opened from", () => {
    function Harness() {
      const { state, dispatch } = useStore();
      useEffect(() => {
        dispatch({ type: "selectProfile", id: "theo" });
      }, [dispatch]);
      const art = state.artworks.find((a) => a.profileId === "theo" && a.pageId === null);
      if (!art) return null;
      return (
        <>
          <span data-testid="screen">{state.screen.name}</span>
          <CanvasScreen artworkId={art.id} back={{ name: "profile" }} />
        </>
      );
    }
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByTestId("chrome-back"));
    expect(screen.getByTestId("screen").textContent).toBe("profile");
  });

  it("returns from the coloring pages to the profile that opened them", () => {
    mountApp();
    enter("Maria");
    fireEvent.click(screen.getByRole("button", { name: /Começar a desenhar/ }));
    fireEvent.click(screen.getByLabelText("Página para colorir"));
    expect(screen.getByText("Páginas para colorir")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Voltar"));
    expect(screen.getByTestId("profile")).toBeInTheDocument();
  });
});

/** Opens the canvas for one seed artwork and can add a stroke after mount. */
function CanvasHarness({ profileId, pageId }: { profileId: string; pageId: string | null }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  const addStroke = () =>
    dispatch({
      type: "setHistory",
      id: art.id,
      history: push(art.history, {
        t: "stroke",
        id: "test-stroke",
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
      <span data-testid="screen">{state.screen.name}</span>
      <span data-testid="visibility">{art.visibility}</span>
      <span data-testid="published-at">{String(art.publishedAt ?? 0)}</span>
      <button type="button" onClick={addStroke}>
        desenhar um traço
      </button>
      <CanvasScreen artworkId={art.id} back={HOME} />
      <AppShell />
    </>
  );
}

describe("leaving the canvas", () => {
  it("never asks when nothing new was drawn", async () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    fireEvent.click(within(screen.getByTestId("canvas")).getByTestId("chrome-back"));
    // P1: leaving shows the recording proof first — pill and scrim, no dialog.
    expect(screen.getByTestId("save-pill")).toBeInTheDocument();
    expect(screen.getByTestId("save-scrim")).toBeInTheDocument();
    expect(screen.queryByText("Guardar desenho?")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("screen").textContent).toBe("home"));
  });

  it("draft path: asks, saves as draft and returns to the origin", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="theo" pageId={null} />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByText("desenhar um traço"));
    fireEvent.click(within(screen.getByTestId("canvas")).getByTestId("chrome-back"));

    // 3–5: the dialog is icon cards, never the words of the adult dialog.
    expect(screen.getByTestId("save-dialog-kids")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("save-card-draft"));

    expect(screen.queryByRole("dialog", { name: "Guardar" })).toBeNull();
    expect(screen.getByTestId("visibility").textContent).toBe("draft");
    expect(screen.getByTestId("screen").textContent).toBe("home");
  });

  it("publish path: bumps publishedAt and the piece rises to the front of the mural", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    const before = Number(screen.getByTestId("published-at").textContent);
    fireEvent.click(screen.getByText("desenhar um traço"));
    fireEvent.click(within(screen.getByTestId("canvas")).getByTestId("chrome-back"));

    expect(screen.getByText("Guardar desenho?")).toBeInTheDocument();
    // Closing choices never disappear (owner's rule, 24/10): a published piece
    // still offers draft and trash, with "publish" marked as the current state.
    expect(screen.getByText("Guardar rascunho")).toBeInTheDocument();
    expect(screen.getByLabelText("Jogar fora")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Publicar no mural"));

    expect(screen.getByTestId("visibility").textContent).toBe("published");
    expect(Number(screen.getByTestId("published-at").textContent)).toBeGreaterThan(before);
    expect(screen.getByTestId("screen").textContent).toBe("home");

    const thumbs = screen.getAllByRole("button", { name: /^Ver desenho de / });
    expect(thumbs[0]!.getAttribute("aria-label")).toBe("Ver desenho de Maria");
  });
});

describe("profile theme", () => {
  it("editing the profile (theme + photo) never touches the artwork list", () => {
    function AdultHarness() {
      const { state, dispatch } = useStore();
      useEffect(() => {
        dispatch({ type: "selectProfile", id: "maria" });
      }, [dispatch]);
      const maria = state.profiles.find((p) => p.id === "maria")!;
      return (
        <div>
          <span data-testid="theme">{maria.themeId}</span>
          <span data-testid="avatar-art">{String(maria.avatarCustom)}</span>
          <span data-testid="emoji">{String(maria.emojiAvatar)}</span>
          <span data-testid="photo">{String(maria.photoUri)}</span>
          <span data-testid="count">{state.artworks.length}</span>
          <AdultScreen focus="profile" back={HOME} />
        </div>
      );
    }
    render(
      <StoreProvider>
        <AdultHarness />
      </StoreProvider>,
    );
    const before = screen.getByTestId("count").textContent;

    fireEvent.click(screen.getByRole("button", { name: /Herói/ })); // switch theme
    expect(screen.getByTestId("theme").textContent).toBe("heroi");
    expect(screen.getByTestId("avatar-art").textContent).toBe("heroi");
    expect(screen.getByTestId("count").textContent).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Usar foto" })); // photo placeholder
    expect(screen.getByTestId("photo").textContent).toMatch(/^data:image\/svg\+xml/);
    expect(screen.getByTestId("count").textContent).toBe(before);

    // Identity emoji: 48 options, three categories, one tap to wear it.
    fireEvent.click(screen.getByLabelText("Escolher emoji"));
    expect(screen.getAllByRole("tab").length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByLabelText("Emoji 🦕"));
    expect(screen.getByTestId("emoji").textContent).toBe("🦕");
    expect(screen.getByTestId("count").textContent).toBe(before);
  });
});

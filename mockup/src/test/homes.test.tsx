// Two homes, two jobs (redesenho-estudio 2A/2B):
//   app Home  — the family wall: pieces pinned at their own angles, profiles as
//               people, one floating action that asks who is drawing.
//   profile   — a person: portrait, their own vocabulary, recent pieces, CTA.
// The test asserts the DIFFERENCE, not the pixel styling.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppShell } from "@/mockup/AppShell";
import { personaOf } from "@/mockup/persona";
import { ProfileScreen } from "@/mockup/screens/ProfileScreen";
import { StoreProvider, useStore } from "@/mockup/store";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function mountApp() {
  return render(
    <StoreProvider>
      <AppShell />
    </StoreProvider>,
  );
}

/** Enters one profile from the Home — the only place that may switch. */
const enter = (name: string) =>
  fireEvent.click(screen.getByLabelText(`Entrar no perfil de ${name}`));

/** The Home after the family has one active child only. */
function MonoHarness() {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "archiveProfile", id: "maria" });
  }, [dispatch]);
  return <AppShell />;
}

function ProfileHarness({ profileId }: { profileId: string }) {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  return <ProfileScreen />;
}

/** Writes a description through the store, the way the adult's editor does. */
function PersonaHarness({ profileId, line }: { profileId: string; line: string }) {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    dispatch({ type: "updateProfile", id: profileId, patch: { personaLine: line } });
  }, [dispatch, profileId, line]);
  return <ProfileScreen />;
}

describe("app Home: the collective wall", () => {
  it("pins the pieces with a stable angle and keeps the persona out", () => {
    const { container } = mountApp();
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.getByText("Risco e Cor")).toBeInTheDocument();

    const pieces = Array.from(container.querySelectorAll("[data-mural-piece]"));
    expect(pieces).toHaveLength(2);
    for (const piece of pieces) {
      expect(piece.getAttribute("style")).toMatch(/rotate\(-?[\d.]+deg\)/);
    }
    // The collective wall never wears one profile's face.
    expect(screen.queryByTestId("profile-hero")).toBeNull();
    expect(container.querySelector("[data-hero]")).toBeNull();
  });

  it("asks who is drawing before creating a piece", () => {
    mountApp();
    fireEvent.click(screen.getByLabelText("Nova peça"));
    // No silent authorship: the sheet names every active profile.
    expect(screen.getByLabelText("Desenhar com Maria")).toBeInTheDocument();
    expect(screen.getByLabelText("Desenhar com Theo")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Desenhar com Theo"));
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("filters the wall by author without leaving the Home", () => {
    mountApp();
    expect(screen.getAllByRole("button", { name: /^Ver desenho de / })).toHaveLength(2);
    fireEvent.click(screen.getByLabelText("Buscar no mural"));
    fireEvent.change(screen.getByLabelText("Buscar por autor ou desenho"), {
      target: { value: "theo" },
    });
    const shown = screen.getAllByRole("button", { name: /^Ver desenho de / });
    expect(shown).toHaveLength(1);
    expect(shown[0]!.getAttribute("aria-label")).toBe("Ver desenho de Theo");
  });
});

describe("mono (k = 1): the Home is one child's hero", () => {
  it("drops the chip row and greets the only child", () => {
    render(
      <StoreProvider>
        <MonoHarness />
      </StoreProvider>,
    );
    expect(screen.queryByRole("group", { name: "Perfis" })).toBeNull();
    expect(screen.queryByLabelText("Entrar no perfil de Maria")).toBeNull();
    const hero = screen.getByTestId("mono-hero");
    expect(within(hero).getByText("Theo")).toBeInTheDocument();
    expect(within(hero).getByLabelText("Entrar no perfil de Theo")).toBeInTheDocument();
    // Last works are part of the hero, as thumbnails.
    expect(within(hero).getAllByRole("button", { name: /^Abrir / })).toHaveLength(2);
  });

  it("skips the 'with whom?' sheet and draws as the only child", () => {
    render(
      <StoreProvider>
        <MonoHarness />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText("Nova peça"));
    expect(screen.queryByText("Com quem vamos desenhar?")).toBeNull();
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });
});

describe("first run: one child or the whole family", () => {
  function FreshHarness() {
    const { dispatch } = useStore();
    useEffect(() => {
      dispatch({ type: "updateSettings", patch: { setupDone: false } });
    }, [dispatch]);
    return <AppShell />;
  }

  it("asks once and collapses the Home to the chosen shape", () => {
    render(
      <StoreProvider>
        <FreshHarness />
      </StoreProvider>,
    );
    expect(screen.getByTestId("setup")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("setup-single"));
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.getByTestId("mono-hero")).toBeInTheDocument();
  });

  it("shared keeps one chip per child", () => {
    render(
      <StoreProvider>
        <FreshHarness />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByTestId("setup-shared"));
    expect(screen.getByRole("group", { name: "Perfis" })).toBeInTheDocument();
    expect(screen.queryByTestId("mono-hero")).toBeNull();
  });
});

describe("profile Home: the person", () => {
  it("gives the 3-5 band two giant portals and no readable chrome", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="theo" />
      </StoreProvider>,
    );
    expect(screen.getByTestId("kids-home")).toBeInTheDocument();
    expect(screen.getByTestId("kids-portal-colorir")).toBeInTheDocument();
    expect(screen.getByTestId("kids-portal-folha")).toBeInTheDocument();
    // The old persona copy is gone from the child's screen.
    expect(screen.queryByText(personaOf({ age: "3-5" }).line)).toBeNull();
    expect(screen.queryByText("Começar a desenhar")).toBeNull();
    expect(screen.getByTestId("profile")).toHaveAttribute("data-mode", "kids");
  });

  it("opens the coloring book and the blank sheet from the portals", () => {
    mountApp();
    enter("Theo");
    fireEvent.click(screen.getByTestId("kids-portal-colorir"));
    expect(screen.getByText("Páginas para colorir")).toBeInTheDocument();
    // Back lands on the child's home, where the other portal still waits.
    fireEvent.click(screen.getByLabelText("Voltar"));
    expect(screen.getByTestId("kids-home")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("kids-portal-folha"));
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("never shows an age band or a badge on the profile Home", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="maria" />
      </StoreProvider>,
    );
    // The child sees a person, not a label for how old they are (2026-10-22).
    expect(screen.getByTestId("profile")).not.toHaveTextContent(/anos/);
    expect(screen.getByTestId("profile")).not.toHaveTextContent(/9\+|3–5|3-5|6–8/);
    // What the portrait tag says instead is a real preference, not the band.
    expect(
      within(screen.getByTestId("profile-hero")).getByText("Desenho livre"),
    ).toBeInTheDocument();
  });

  it("does not infantilize the older profile", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="maria" />
      </StoreProvider>,
    );
    expect(screen.getByText(personaOf({ age: "9+" }).line)).toBeInTheDocument();
    // Techniques live behind ONE disclosure, never three chips in a row.
    expect(screen.queryByText("Aquarela molhada")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Repertório, 3 técnicas/ }));
    expect(screen.getByText("Aquarela molhada")).toBeInTheDocument();
    expect(screen.queryByText("Carimbo")).toBeNull();
  });

  it("fills the space under the actions with the author's own two-column feed", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="maria" />
      </StoreProvider>,
    );
    const feed = screen.getByTestId("profile-feed");
    expect(feed.className).toContain("grid-cols-2");
    expect(feed.className).toContain("grid");
    const cards = within(feed).getAllByRole("button");
    expect(cards.length).toBeGreaterThan(0);
    // The card opens the editor — a drawing is never a video.
    expect(cards[0]).toHaveAccessibleName(/no editor/);
    // No horizontal strip, no family-mural scope, no theme picker on a profile.
    expect(screen.queryByRole("group", { name: "Escopo do mural" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Trocar tema" })).toBeNull();
    expect(screen.queryByText("Tema")).toBeNull();
  });

  it("keeps one primary action and one quiet secondary, at their natural width", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="maria" />
      </StoreProvider>,
    );
    const cta = screen.getByText("Começar a desenhar").closest("button")!;
    const secondary = screen.getByLabelText("Meus desenhos");
    expect(cta.className).not.toContain("w-full");
    expect(secondary.className).not.toContain("w-full");
  });

  it("opens the creation sheet on the activity the profile prefers", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="maria" />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByText("Começar a desenhar"));
    const options = within(screen.getByRole("dialog", { name: "Criar" })).getAllByRole("button");
    // Maria prefers free drawing; both entries stay one tap away.
    expect(options[0]).toHaveAccessibleName("Folha em branco");
    expect(options[1]).toHaveAccessibleName("Página para colorir");
  });
});

describe("profile persona: written by the adult, never the age", () => {
  it("shows the description the adult wrote instead of the band's suggestion", () => {
    const written = "Desenha dinossauros de chapéu e nuvens listradas.";
    render(
      <StoreProvider>
        <PersonaHarness profileId="maria" line={written} />
      </StoreProvider>,
    );
    const hero = screen.getByTestId("profile-hero");
    expect(within(hero).getByText(written)).toBeInTheDocument();
    // The suggestion is replaced, not stacked below it.
    expect(within(hero).queryByText(personaOf({ age: "9+" }).line)).toBeNull();
    expect(screen.getByTestId("profile")).not.toHaveTextContent(/anos/);
  });

  it("falls back to the band's suggestion while the field is blank", () => {
    render(
      <StoreProvider>
        <PersonaHarness profileId="maria" line="   " />
      </StoreProvider>,
    );
    expect(screen.getByText(personaOf({ age: "9+" }).line)).toBeInTheDocument();
  });
});

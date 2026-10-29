// End-to-end behaviour of the adaptive mockup through the real store:
//  1. the app Home is a neutral hub: profile row + family mural, no cartoon hero
//  2. the profile Home is a persona screen: theme band, its own mural, back home
//     — the two homes are different screens, not one screen with other data
//  3. the global color scheme is one preference for the whole device
//  4. kids get big circles + 3 tools; pro gets the 200-swatch spectrum + "Mais"
//  5. spectrum steps, favorites and recent colors
//  6. the style chosen in the sheet (gradient from "Mais", sombra from its fold)
//     reaches the stroke command
//  7. adult toggles and "Restaurar padrão" never touch artworks
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { openFold, openTools } from "./open-panel";
import { AppShell } from "@/mockup/AppShell";
import { uiModeOf, type Capabilities, type UiMode } from "@/mockup/capabilities";
import { AdultScreen } from "@/mockup/screens/AdultScreen";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { ProfileScreen } from "@/mockup/screens/ProfileScreen";
import { StoreProvider, useStore, type Screen } from "@/mockup/store";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Probe() {
  const { state } = useStore();
  return (
    <div>
      <span data-testid="count">{state.artworks.length}</span>
      <span data-testid="order">{state.profiles.map((p) => p.name).join(",")}</span>
      <span data-testid="scheme">{state.settings.colorScheme}</span>
      <span data-testid="theme">{state.profiles.find((p) => p.id === "maria")?.themeId}</span>
    </div>
  );
}

function mountApp() {
  return render(
    <StoreProvider>
      <AppShell />
      <Probe />
    </StoreProvider>,
  );
}

/** Renders only the profile home with a given adult mode lock. */
function ProfileHarness({ profileId, override }: { profileId: string; override: UiMode | null }) {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "updateProfile", id: profileId, patch: { uiModeOverride: override } });
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId, override]);
  return <ProfileScreen />;
}

const HOME: Screen = { name: "home" };
/**
 * The tutor is the most expensive surface in this file, and the cost is not the
 * render: it is the query. Resolving a role asks `getComputedStyle` for every
 * candidate (visibility) and again for the name, and this jsdom answers a style
 * call in ~12ms — so a role query with a name costs 80–200ms even over a
 * 200-node card, while `getByTestId`, `getByText` and `getByLabelText` read
 * attributes and cost 1–30ms. Every query below is the cheapest one that still
 * proves the same thing, scoped to the subtree it is about (one profile's card,
 * or the list of cards). The assertions are the same; only the way of finding
 * the element changed. Measured effect on the seven tutor cases: 10.9s → 2.7s.
 */
const cardOf = (name: string) => within(screen.getByTestId(`tutor-card-${name}`));
const profilesList = () => within(screen.getByTestId("tutor-profiles"));

/** One profile's editor opens inside its own card, never in a list below. */
function openProfile(name: string) {
  const card = cardOf(name);
  fireEvent.click(card.getByLabelText(`Ajustar ${name}`));
  return card;
}

/**
 * The option buttons of one labelled row ("Idade", "Modo"). The label is a
 * plain span, so the segmented group is reached from it — `within` on a
 * four-node row costs microseconds where a role query over the card pays a
 * style pass per candidate.
 */
function segOption(card: ReturnType<typeof within>, label: string, option: string) {
  const row = card.getByText(label).parentElement;
  if (!row) throw new Error(`no row labelled ${label}`);
  return within(row).getByText(option);
}

describe("app Home: neutral hub", () => {
  it("lists the profiles and the family mural, and reordering never leaks in", () => {
    const { container } = mountApp();
    expect(screen.getByTestId("home")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Perfis" })).toBeInTheDocument();
    expect(screen.getByTestId("mural-grid")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Ver desenho de / })).toHaveLength(2);

    // The hub never wears a profile's cartoon band, and never infantilizes.
    expect(container.querySelector('[data-hero="dinos"]')).toBeNull();
    expect(container.querySelector('[data-hero="heroi"]')).toBeNull();
    expect(screen.queryByLabelText("Ver como criança")).toBeNull();
    expect(screen.queryByRole("group", { name: "Variação" })).toBeNull();

    // No creation tile lives on the hub: drawing belongs to a profile.
    expect(screen.queryByLabelText("Desenhar")).toBeNull();
    expect(screen.queryByLabelText("Colorir")).toBeNull();
    expect(screen.queryByLabelText("Criar")).toBeNull();
  });

  it("keeps profile order stable no matter how often one is entered", () => {
    mountApp();
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByLabelText("Entrar no perfil de Theo"));
      fireEvent.click(screen.getByLabelText("Voltar"));
      fireEvent.click(screen.getByLabelText("Entrar no perfil de Maria"));
      fireEvent.click(screen.getByLabelText("Voltar"));
    }
    expect(screen.getByTestId("order").textContent).toBe("Maria,Theo");
  });

  it("derives the kids skin per profile, and the adult override wins", () => {
    const { rerender } = render(
      <StoreProvider>
        <ProfileHarness profileId="theo" override="pro" />
      </StoreProvider>,
    );
    expect(screen.getByTestId("profile")).toHaveAttribute("data-mode", "pro");

    rerender(
      <StoreProvider>
        <ProfileHarness profileId="theo" override={null} />
      </StoreProvider>,
    );
    expect(screen.getByTestId("profile")).toHaveAttribute("data-mode", "kids");
  });
});

describe("the two homes are different screens", () => {
  it("gives the hub no persona chrome and the profile its own band", () => {
    const { container } = mountApp();
    expect(container.querySelector("[data-testid='profile-hero']")).toBeNull();

    fireEvent.click(screen.getByLabelText("Entrar no perfil de Maria"));
    expect(screen.getByTestId("profile")).toBeInTheDocument();
    // Persona band: the profile wears its theme, the hub never does.
    expect(screen.getByTestId("profile-hero")).toBeInTheDocument();
    expect(container.querySelector('[data-theme="dinos"]')).not.toBeNull();
    // The hub's controls stay behind.
    expect(screen.queryByRole("group", { name: "Perfis" })).toBeNull();
    expect(screen.queryByLabelText("Configurações gerais")).toBeNull();
  });

  it("goes hub -> profile -> hub and profile -> canvas -> profile", () => {
    mountApp();
    fireEvent.click(screen.getByLabelText("Entrar no perfil de Maria"));
    expect(screen.getByTestId("profile")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Voltar"));
    expect(screen.getByTestId("home")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Entrar no perfil de Maria"));
    fireEvent.click(screen.getByRole("button", { name: /Começar a desenhar/ }));
    fireEvent.click(screen.getByLabelText("Folha em branco"));
    expect(screen.getByTestId("canvas")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Início"));
    expect(screen.getByTestId("profile")).toBeInTheDocument();
  });
});

function SchemeHarness() {
  const { dispatch } = useStore();
  return (
    <div>
      <button
        type="button"
        onClick={() => dispatch({ type: "updateSettings", patch: { colorScheme: "dark" } })}
      >
        escurecer
      </button>
      <AppShell />
      <Probe />
    </div>
  );
}

describe("global color scheme", () => {
  it("applies to the whole app, not to one profile", () => {
    render(
      <StoreProvider>
        <SchemeHarness />
      </StoreProvider>,
    );
    const root = document.querySelector("[data-color-scheme]");
    expect(root).toHaveAttribute("data-color-scheme", "light");

    fireEvent.click(screen.getByText("escurecer"));
    expect(document.querySelector("[data-color-scheme]")).toHaveAttribute(
      "data-color-scheme",
      "dark",
    );
    expect(screen.getByTestId("scheme").textContent).toBe("dark");
  });
});

/** A canvas for one profile, exposing the last stroke that reached the store. */
function CanvasHarness({
  profileId,
  pageId,
  capsOverride,
}: {
  profileId: string;
  pageId: string | null;
  capsOverride?: Partial<Capabilities>;
}) {
  const { state, dispatch } = useStore();
  const capsKey = JSON.stringify(capsOverride ?? null);
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    if (capsOverride) dispatch({ type: "updateProfile", id: profileId, patch: { capsOverride } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, profileId, capsKey]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  const strokes = art.history.commands.filter((c) => c.t === "stroke");
  return (
    <>
      <CanvasScreen artworkId={art.id} back={HOME} />
      <span data-testid="stroke-style">{JSON.stringify(strokes.at(-1) ?? null)}</span>
    </>
  );
}

describe("canvas: kids simplicity, pro toolset", () => {
  const openSheet = () => openTools();

  it("gives the 3-5 band five materials and no sheet to open", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="theo" pageId={null} />
      </StoreProvider>,
    );
    // The compact bar is the kid toolbar (owner's call, 24/10): five targets,
    // never the nine-material studio, and no shelf door.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    expect(screen.getByLabelText("Giz de cera")).toBeInTheDocument();
    expect(screen.getByLabelText("Borracha")).toBeInTheDocument();
    expect(screen.getByLabelText("Pincel")).toBeInTheDocument();
    expect(screen.getByLabelText("Marcador")).toBeInTheDocument();
    expect(screen.queryByLabelText("Organizar ferramentas")).toBeNull();

    // Theo's second level exists since `chrome-v2` (27/10) — the two look folds,
    // with no text — but there is no PRO sheet to open, and no shelf door.
    expect(screen.queryByLabelText("Abrir painel de ferramentas")).not.toBeNull();
    expect(screen.getByLabelText("Abrir painel de ferramentas")).toBe(
      screen.getByTestId("chrome-panel"),
    );
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.queryByTestId("simple-palette")).toBeNull();
    expect(screen.queryByTestId("pro-palette")).toBeNull();
    // The same twelve-cell ladder as 9+ (`compacta-unificada` §12.6, revised for
    // uniformity on 27/10): 6 + 6, white first, black last, no label at all.
    const colors = within(screen.getByTestId("canvas-compact")).getByRole("radiogroup", {
      name: "Tons da cor",
    });
    expect(within(colors).getAllByRole("radio")).toHaveLength(12);
    expect(colors.getAttribute("data-columns")).toBe("6");
    expect(colors.getAttribute("data-rows")).toBe("2");
    expect(colors.getAttribute("data-label-band")).toBe("0");
    expect(screen.queryByLabelText("Mais ferramentas")).toBeNull();
  });

  it("gives the 9+ band the full catalog and the grouped shelf", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    // The grouped shelf lives in the expanded sheet: expanding is one tap.
    openSheet();
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();

    for (const tool of [
      "Lápis",
      "Carvão",
      "Giz de cera",
      "Marcador",
      "Pincel",
      "Aquarela",
      "Óleo",
      "Spray",
      "Borracha",
    ]) {
      expect(screen.getByLabelText(tool)).toBeInTheDocument();
    }
    // The chrome no longer carries the "Mais ferramentas" chip (owner, 26/10):
    // the sheet is the one home of the preferences.
    expect(screen.queryByLabelText("Mais ferramentas")).toBeNull();

    // Grouped shelf: the door under the row opens the ordering list, search
    // narrows it, a row selects the tool.
    fireEvent.click(screen.getByLabelText("Organizar ferramentas"));
    expect(screen.getByTestId("shelf-sheet")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar ferramentas"), { target: { value: "giz" } });
    const sheet = screen.getByTestId("shelf-sheet");
    const rows = within(sheet).getAllByRole("button", { name: /Giz de cera/ });
    fireEvent.click(rows[0]!);
    expect(screen.queryByRole("dialog", { name: "Ferramentas" })).toBeNull();
    expect(screen.getByLabelText("Giz de cera")).toHaveAttribute("aria-pressed", "true");
  });

  it("names the selected tool and previews the stroke it will leave", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    openSheet();
    fireEvent.click(screen.getByLabelText("Aquarela"));
    // Iconografia v2 §1: the chip is the OBJECT; the live stroke preview lives
    // in the panel header, where it is large enough to read as the real wash.
    const selected = screen.getByLabelText("Aquarela");
    expect(selected).toHaveAttribute("aria-pressed", "true");
    const object = selected.querySelector("svg[data-brush='watercolor']");
    expect(object).not.toBeNull();
    expect(object?.getAttribute("data-ink")).toBe("var(--foreground)");

    const panel = screen.getByTestId("canvas-panel");
    expect(within(panel).getAllByText("Aquarela").length).toBeGreaterThan(0);
    const preview = screen.getByTestId("param-preview");
    expect(preview).toHaveAttribute("data-brush", "watercolor");
    // The wash's own ink, at the opacity in hand: the medium lays down a fraction
    // of the paint, and the preview declares the number the canvas paints with.
    const ink = Number(preview.getAttribute("data-stroke-opacity"));
    expect(ink).toBeGreaterThan(0);
    expect(ink).toBeLessThan(1);
    // …and the drawing is the raster sample, not the old dashed vector path.
    expect(preview.querySelector("path")).toBeNull();
    expect(preview.querySelector("canvas")).not.toBeNull();
  });

  it("expands a family into eleven steps and remembers favorites", () => {
    const { container } = render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    // The 200-swatch spectrum lives in the expanded sheet, inside the Cor fold
    // (which opens CLOSED since 27/10); the pill has no palette at all.
    openTools();
    openFold("fold-cor");
    expect(screen.getByTestId("pro-palette")).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId("palette-family")[0]!);
    const pro = within(screen.getByTestId("pro-palette"));
    const tones = pro.getByRole("radiogroup", { name: "Variações da cor" });
    expect(within(tones).getAllByRole("radio")).toHaveLength(11);

    const step = within(tones).getAllByRole("radio")[7]!;
    const hex = step.getAttribute("data-hex")!;
    fireEvent.click(step);
    expect(step).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByLabelText("Favoritar cor"));
    expect(screen.getByLabelText("Favoritar cor")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pro.getByRole("tab", { name: "Favoritas" }));
    const favoriteGroup = pro.getByRole("radiogroup", { name: "Cores favoritas" });
    expect(favoriteGroup.querySelector(`[data-hex="${hex}"]`)).not.toBeNull();

    fireEvent.click(pro.getByRole("tab", { name: "Recentes" }));
    expect(container.querySelector(`[data-hex="${hex}"]`)).not.toBeNull();
  });

  it("puts the gradient from its fold and the shadow from the sheet into the stroke", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    openSheet();
    fireEvent.click(screen.getByLabelText("Pincel"));
    // The gradient used to live in the "Mais" overlay; since 26/10 it is a fold
    // of the sheet, next to sombra and brilho — one home, one door each. Since
    // 27/10 it is the THIRD effect: the switch on its header creates the default
    // linear 90° and opens the editor, and the type row only picks the shape.
    const panel = screen.getByTestId("canvas-panel");
    fireEvent.click(within(panel).getByRole("switch", { name: "Ativar gradiente" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Linear" }));
    expect(within(panel).getByTestId("gradient-preview")).toBeInTheDocument();

    // Sombra is its own fold of the same sheet, and it opens from the switch that
    // rides its HEADER — the chevron refuses while the effect is off (owner's
    // rule, 27/10).
    fireEvent.click(within(panel).getByRole("switch", { name: "Ativar sombra" }));

    const paper = screen.getByRole("img", { name: /Peixe/ });
    fireEvent.pointerDown(paper, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(paper, { pointerId: 1, clientX: 150, clientY: 140 });
    fireEvent.pointerUp(paper, { pointerId: 1, clientX: 150, clientY: 140 });

    const stroke = JSON.parse(screen.getByTestId("stroke-style").textContent ?? "null");
    expect(stroke).toMatchObject({
      t: "stroke",
      brush: "brush",
      sombra: { on: true, intensity: 50, dx: 0, dy: 2, radius: 3, spread: 0 },
    });
    expect(stroke.gradient).toMatchObject({ kind: "linear", angle: 90 });
    expect(stroke.points.length).toBeGreaterThan(1);
  });

  it("follows the adult's capability override: no full palette, no gradient, no effects", () => {
    render(
      <StoreProvider>
        <CanvasHarness
          profileId="maria"
          pageId="peixe"
          capsOverride={{ paletaCompleta: false, gradienteEfeitos: false }}
        />
      </StoreProvider>,
    );
    // T2 off collapses the 200 swatches back into the six big colors — in the
    // Cor fold, which opens CLOSED since 27/10.
    openSheet();
    openFold("fold-cor");
    expect(screen.getByTestId("simple-palette")).toBeInTheDocument();
    expect(screen.queryByTestId("pro-palette")).toBeNull();

    // T1 is still on, so the panel exists — but T3 keeps gradient/effects out.
    // A material that paints is in hand, so the absence is the capability, not
    // the tool: the gradient has no fold at all and no kind to choose, and the
    // effects are ABSENT from the sheet, not hidden behind a switch.
    fireEvent.click(screen.getByLabelText("Pincel"));
    expect(within(screen.getByTestId("canvas-panel")).queryByTestId("fold-gradiente")).toBeNull();
    expect(screen.queryByRole("button", { name: "Linear" })).toBeNull();
    expect(screen.queryByTestId("fold-sombra")).toBeNull();
    expect(screen.queryByTestId("fold-brilho")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Ativar sombra" })).toBeNull();
  });
});

function AdultHarness({ focus = "profile" }: { focus?: "global" | "profile" }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
  }, [dispatch]);
  const maria = state.profiles.find((p) => p.id === "maria")!;
  return (
    <div>
      <span data-testid="count">{state.artworks.length}</span>
      <span data-testid="lock">{String(maria.uiModeOverride)}</span>
      <span data-testid="caps">{JSON.stringify(maria.capsOverride)}</span>
      <span data-testid="maria-mode">{uiModeOf(maria)}</span>
      <span data-testid="theo-mode">{uiModeOf(state.profiles.find((p) => p.id === "theo")!)}</span>
      <span data-testid="order">{state.profiles.map((p) => p.name).join(",")}</span>
      <span data-testid="persona">{maria.personaLine ?? ""}</span>
      <span data-testid="scheme">{state.settings.colorScheme}</span>
      <AdultScreen focus={focus} back={HOME} />
    </div>
  );
}

describe("adult area: per-profile rules live in the tutor's global scope", () => {
  it("toggles a capability, keeps the dependent one disabled, and restores the age defaults", () => {
    render(
      <StoreProvider>
        <AdultHarness focus="global" />
      </StoreProvider>,
    );
    const before = screen.getByTestId("count").textContent;

    const card = openProfile("Maria");
    // The label IS the accessible name the tutor reads; `role="switch"` is the
    // contract that name hangs on, asserted once instead of re-resolved per
    // query (a role query costs a style pass per candidate in jsdom).
    const complex = card.getByLabelText("Ferramentas complexas");
    expect(complex).toHaveAttribute("role", "switch");
    expect(complex).toHaveAttribute("aria-checked", "true");
    fireEvent.click(complex);
    expect(complex).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("caps").textContent).toContain('"ferramentasComplexas":false');
    // Gradient lives inside the "Mais" panel: without it the switch is not a
    // choice, so it is absent — never present and disabled.
    expect(card.queryByLabelText("Gradiente e efeitos")).toBeNull();
    fireEvent.click(complex);
    expect(card.getByLabelText("Gradiente e efeitos")).toBeInTheDocument();
    fireEvent.click(complex);

    fireEvent.click(card.getByText("Restaurar padrão da idade"));
    fireEvent.click(card.getByText("Restaurar padrão"));
    expect(screen.getByTestId("caps").textContent).toBe("null");
    expect(complex).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("count").textContent).toBe(before);
  });

  it("locks a mode for one profile and clears it back to automatic", () => {
    render(
      <StoreProvider>
        <AdultHarness focus="global" />
      </StoreProvider>,
    );
    const card = openProfile("Maria");
    fireEvent.click(segOption(card, "Modo", "Pro"));
    expect(screen.getByTestId("lock").textContent).toBe("pro");
    fireEvent.click(segOption(card, "Modo", "Automático"));
    expect(screen.getByTestId("lock").textContent).toBe("null");
  });

  it("changes the age band without losing a single artwork", () => {
    render(
      <StoreProvider>
        <AdultHarness focus="global" />
      </StoreProvider>,
    );
    const before = screen.getByTestId("count").textContent;
    expect(screen.getByTestId("maria-mode").textContent).toBe("pro");

    const card = openProfile("Maria");
    fireEvent.click(segOption(card, "Idade", "3–5"));
    expect(screen.getByTestId("maria-mode").textContent).toBe("kids");
    expect(screen.getByTestId("theo-mode").textContent).toBe("kids");

    fireEvent.click(segOption(card, "Idade", "9+"));
    expect(screen.getByTestId("maria-mode").textContent).toBe("pro");
    expect(screen.getByTestId("count").textContent).toBe(before);
  });

  it("opens one profile card at a time and edits only the profile it belongs to", () => {
    render(
      <StoreProvider>
        <AdultHarness focus="global" />
      </StoreProvider>,
    );
    // Every profile appears once, in one list, and every card starts closed.
    const list = profilesList();
    const headers = list.getAllByLabelText(/^Ajustar /);
    expect(headers).toHaveLength(2);
    expect(headers.every((h) => h instanceof HTMLButtonElement)).toBe(true);
    expect(headers.every((h) => h.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(list.queryByLabelText("Perfil destes ajustes")).toBeNull();
    expect(list.queryByLabelText("Ferramentas complexas")).toBeNull();

    // Maria's card carries her identity and her rules — no second list needed.
    const maria = openProfile("Maria");
    expect(list.getByLabelText("Ajustar Maria")).toHaveAttribute("aria-expanded", "true");
    expect(maria.getByLabelText("Apelido")).toHaveValue("Maria");
    expect(list.getAllByLabelText("Ferramentas complexas")).toHaveLength(1);

    // Opening Theo closes Maria: exactly one profile is open at a time.
    const theo = openProfile("Theo");
    expect(list.getByLabelText("Ajustar Maria")).toHaveAttribute("aria-expanded", "false");
    expect(list.getByLabelText("Ajustar Theo")).toHaveAttribute("aria-expanded", "true");
    expect(list.getAllByLabelText("Ferramentas complexas")).toHaveLength(1);

    // Theo's band changes only Theo's derivation; Maria keeps the 9+ default.
    fireEvent.click(segOption(theo, "Idade", "3–5"));
    expect(screen.getByTestId("theo-mode").textContent).toBe("kids");
    expect(screen.getByTestId("maria-mode").textContent).toBe("pro");

    // A second tap closes the card: nothing survives below the list.
    openProfile("Theo");
    expect(list.queryByLabelText("Ferramentas complexas")).toBeNull();
  });
});

describe("adult area: global scope", () => {
  it("keeps the app theme and profile order in the global scope only", () => {
    render(
      <StoreProvider>
        <AdultHarness focus="global" />
      </StoreProvider>,
    );

    expect(screen.getByTestId("order").textContent).toBe("Maria,Theo");
    const card = openProfile("Maria");
    fireEvent.click(card.getByLabelText("Mover Maria para baixo"));
    expect(screen.getByTestId("order").textContent).toBe("Theo,Maria");
    fireEvent.click(card.getByLabelText("Mover Maria para cima"));
    expect(screen.getByTestId("order").textContent).toBe("Maria,Theo");

    // The scheme is a fine adjustment inside the "Aparência" chevron.
    const adult = within(screen.getByTestId("adult"));
    fireEvent.click(adult.getByText("Aparência"));
    fireEvent.click(adult.getByText("Escuro"));
    expect(screen.getByTestId("scheme").textContent).toBe("dark");
    fireEvent.click(adult.getByText("Seguir aparelho"));
    expect(screen.getByTestId("scheme").textContent).toBe("system");
  });

  it("never lets the profile settings edit age, mode or the tool set", () => {
    render(
      <StoreProvider>
        <AdultHarness focus="profile" />
      </StoreProvider>,
    );
    const adult = within(screen.getByTestId("adult"));
    // Identity is the open subject; files live one chevron away.
    expect(adult.getByLabelText("Apelido")).toBeInTheDocument();
    fireEvent.click(adult.getByText("Arquivos"));
    expect(adult.getByLabelText("Meus desenhos de Maria")).toBeInTheDocument();
    expect(adult.queryByText("Automático")).toBeNull();
    expect(adult.queryByText("Idade")).toBeNull();
    expect(adult.queryByText("Modo")).toBeNull();
    expect(adult.queryByLabelText("Ferramentas complexas")).toBeNull();
    expect(adult.queryByText("Restaurar padrão da idade")).toBeNull();
  });
});

describe("adult area: the persona description is the adult's to write", () => {
  it("edits it in the profile's own settings", () => {
    render(
      <StoreProvider>
        <AdultHarness focus="profile" />
      </StoreProvider>,
    );
    const field = screen.getByLabelText("Descrição");
    expect(field).toHaveValue("");
    fireEvent.change(field, { target: { value: "Traço realista, paleta fria." } });
    expect(screen.getByTestId("persona").textContent).toBe("Traço realista, paleta fria.");
  });

  it("mirrors the same field in the tutor's global card, and a theme change keeps it", () => {
    render(
      <StoreProvider>
        <AdultHarness focus="global" />
      </StoreProvider>,
    );
    const card = openProfile("Maria");
    const field = card.getByLabelText("Descrição");
    fireEvent.change(field, { target: { value: "Desenha monstros gentis." } });
    expect(screen.getByTestId("persona").textContent).toBe("Desenha monstros gentis.");

    // A theme change patches the profile; it never rewrites the description.
    fireEvent.click(card.getByLabelText(/Herói/));
    expect(screen.getByTestId("persona").textContent).toBe("Desenha monstros gentis.");
    expect(card.getByLabelText("Descrição")).toHaveValue("Desenha monstros gentis.");
  });
});

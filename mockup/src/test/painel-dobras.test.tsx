// The pro sheet's folds (painel-chevrons §7.1–§7.4, efeitos-chevrons §7.5).
//
// Seam: the sheet the hand touches — the fold header (`aria-expanded`), the
// region it discloses, the summary it shows while closed — plus the profile that
// remembers the choice. The engine is not observed here: what the folds do to a
// stroke is measured in `effects-chevrons.test.tsx`.
//
// What this file exists to prove, in the owner's own order:
//   a. Ajustes and Cor exist, in that order, and toggle with `aria-expanded`;
//   b. opening turns nothing on, closing turns nothing off, and a closed Cor
//      shows no chip and no text;
//   c. the pair is remembered PER PROFILE with the right defaults, and switching
//      tool never moves it;
//   d. the thickness is one number per person and the material that arrives
//      inherits it (the non-regression the decision asks for);
//   e. a kids profile has no fold and no fold memory at all — absence in the DOM.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openTools } from "./open-panel";
import { StoreProvider, panelSectionsOf, useStore, type PanelSections } from "@/mockup/store";
import type { ProfileDraft } from "@/mockup/profiles";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";

const HOME = { name: "home" } as const;
const ANA: ProfileDraft = { name: "Ana", age: "9+", avatar: "cat", tone: "sun", themeId: "dinos" };
/**
 * The other PRO band (6-8). Its defaults keep `gradienteEfeitos` off, so the
 * effects only exist for her once the adult turns the capability on — which is
 * exactly the pair of states the fold rule has to survive.
 */
const BIA: ProfileDraft = {
  name: "Bia",
  age: "6-8",
  avatar: "rabbit",
  tone: "mint",
  themeId: "dinos",
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

/**
 * The studio as the shell drives it: one canvas for the active person, plus the
 * two doors a test needs (another pro profile, and "Restaurar padrão da idade").
 * Every person gets a blank sheet of their own, so switching profile switches
 * the sheet instead of drawing on someone else's piece.
 */
function Studio() {
  const { state, dispatch } = useStore();
  const loaded = state.loaded;
  const who = state.profileId ?? "maria";
  const id = `sheet-${who}`;
  const ana = state.profiles.find((p) => p.name === "Ana") ?? null;
  const bia = state.profiles.find((p) => p.name === "Bia") ?? null;

  useEffect(() => {
    if (!loaded) return;
    if (!state.artworks.some((a) => a.id === id)) {
      dispatch({
        type: "createArtwork",
        artwork: {
          id,
          profileId: who,
          pageId: null,
          w: 300,
          h: 300,
          history: { commands: [], redo: [], undoable: 0 },
          createdAt: 1,
          updatedAt: 1,
          visibility: "draft",
          publishedAt: null,
        },
      });
      return;
    }
    if (state.profileId === null) dispatch({ type: "selectProfile", id: who });
  }, [loaded, id, who, state.artworks, state.profileId, dispatch]);

  // A second PRO profile: the seed family has only one (Maria) and a kids
  // profile has no sheet, so it could not show a divergent pair.
  useEffect(() => {
    if (!loaded || ana) return;
    dispatch({ type: "createProfile", draft: ANA });
  }, [loaded, ana, dispatch]);

  // The other pro band, and the profile that carries it.
  useEffect(() => {
    if (!loaded || bia) return;
    dispatch({ type: "createProfile", draft: BIA });
  }, [loaded, bia, dispatch]);

  const art = state.artworks.find((a) => a.id === id);
  const maria = state.profiles.find((p) => p.id === "maria");
  const sections = Object.fromEntries(
    state.profiles.map((p) => [p.id, p.secoesPainel ?? null]),
  ) as Record<string, PanelSections | null>;
  const memory = Object.fromEntries(
    state.profiles.map((p) => [p.id, p.toolSettings ?? null]),
  ) as Record<string, Record<string, unknown> | null>;

  return (
    <>
      {art ? <CanvasScreen artworkId={art.id} back={HOME} /> : null}
      <output data-testid="last-command">
        {JSON.stringify(art?.history.commands.at(-1) ?? null)}
      </output>
      <output data-testid="sections">{JSON.stringify(sections)}</output>
      <output data-testid="theo-sections">
        {JSON.stringify(state.profiles.find((p) => p.id === "theo")?.secoesPainel ?? null)}
      </output>
      <output data-testid="bia">
        {JSON.stringify({
          id: bia?.id ?? null,
          age: bia?.age ?? null,
          efeitos: bia ? Boolean((bia.capsOverride ?? undefined)?.gradienteEfeitos) : null,
        })}
      </output>
      <output data-testid="memory">{JSON.stringify(memory)}</output>
      <output data-testid="sizes">
        {JSON.stringify(
          Object.fromEntries(state.profiles.map((p) => [p.id, p.strokeSize ?? null])),
        )}
      </output>
      <output data-testid="maria">
        {JSON.stringify({
          recent: maria?.recentColors ?? null,
          favorites: maria?.favoriteColors ?? null,
          slots: maria?.toolSlots ?? null,
          arts: state.artworks.filter((a) => a.profileId === "maria").length,
        })}
      </output>
      <button
        data-testid="enter-maria"
        onClick={() => dispatch({ type: "selectProfile", id: "maria" })}
      />
      <button
        data-testid="enter-theo"
        onClick={() => dispatch({ type: "selectProfile", id: "theo" })}
      />
      <button
        data-testid="enter-ana"
        onClick={() => ana && dispatch({ type: "selectProfile", id: ana.id })}
      />
      <button
        data-testid="enter-bia"
        onClick={() => bia && dispatch({ type: "selectProfile", id: bia.id })}
      />
      {/* The adult's T3 on her band: the effects only exist for 6-8 by override. */}
      <button
        data-testid="effects-on-bia"
        onClick={() => bia && dispatch({ type: "toggleCap", id: bia.id, key: "gradienteEfeitos" })}
      />
      <button
        data-testid="seed-prefs"
        onClick={() => {
          dispatch({ type: "setToolSlots", id: "maria", slots: ["brush", "marker"] });
          dispatch({ type: "rememberColor", id: "maria", hex: "#2F6EAD" });
          dispatch({ type: "toggleFavoriteColor", id: "maria", hex: "#2F6EAD" });
        }}
      />
      <button
        data-testid="restore"
        onClick={() => dispatch({ type: "restoreAgeDefaults", id: "maria" })}
      />
    </>
  );
}

const mount = () => render(<StoreProvider>{<Studio />}</StoreProvider>);
const sheet = () => screen.getByTestId("canvas-panel");
const sections = () => JSON.parse(screen.getByTestId("sections").textContent || "{}");
const mariaPrefs = () => JSON.parse(screen.getByTestId("maria").textContent || "{}");
const sizes = () => JSON.parse(screen.getByTestId("sizes").textContent || "{}");
const lastCommand = () =>
  JSON.parse(screen.getByTestId("last-command").textContent || "null") as {
    t?: string;
    sombra?: { on: boolean };
  } | null;

/** Open the sheet on a material that paints (the blank sheet opens on the brush). */
function openSheet(material = "Pincel") {
  openTools();
  fireEvent.click(within(sheet()).getByLabelText(material));
}

const expanded = (testid: string) => screen.getByTestId(testid).getAttribute("aria-expanded");

/**
 * The effect's switch, which rides the fold's HEADER (owner's rule, 27/10): on
 * screen whether the fold is open or collapsed, and the only door that opens an
 * effect fold.
 */
const effectSwitch = (which: "Sombra" | "Brilho") =>
  screen.getByRole("switch", { name: `Ativar ${which.toLowerCase()}` });
const memory = () => JSON.parse(screen.getByTestId("memory").textContent || "{}");

/** Every number a serialized save actually stores, at any depth. */
function numbersIn(serialized: string): Set<number> {
  const found = new Set<number>();
  const walk = (node: unknown) => {
    if (typeof node === "number") found.add(node);
    else if (Array.isArray(node)) for (const item of node) walk(item);
    else if (node !== null && typeof node === "object") {
      for (const value of Object.values(node)) walk(value);
    }
  };
  walk(JSON.parse(serialized) as unknown);
  return found;
}

describe("a. Ajustes first, Cor second, both on the same disclosure language", () => {
  it("puts the fixed shelf, then Ajustes, then Cor, then the effects", () => {
    mount();
    openSheet();

    // Every fold is a button with `aria-expanded` — and since 27/10 (owner's
    // call) the sheet OPENS with all four collapsed.
    for (const testid of ["fold-ajustes", "fold-cor", "fold-sombra", "fold-brilho"]) {
      expect(expanded(testid), testid).toBe("false");
    }

    // Fixed shelf first, then the two folds, then the effects: the ORDER is the
    // same whether the folds are open or shut.
    const shelf = within(sheet()).getByTestId("tool-shelf");
    const ajustes = screen.getByTestId("fold-ajustes");
    const cor = screen.getByTestId("fold-cor");
    const sombra = screen.getByTestId("fold-sombra");
    const position = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(position(shelf, ajustes)).toBe(true);
    expect(position(ajustes, cor)).toBe(true);
    expect(position(cor, sombra)).toBe(true);

    // The chevron is the only door that discloses: the regions exist after it.
    fireEvent.click(screen.getByTestId("fold-ajustes"));
    fireEvent.click(screen.getByTestId("fold-cor"));
    expect(expanded("fold-ajustes")).toBe("true");
    expect(expanded("fold-cor")).toBe("true");
    expect(screen.getByRole("region", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cor" })).toBeInTheDocument();
    // The regions are named AND controlled: the header points at a node that is
    // on screen right now. Closed, it points at nothing at all (no dangling id).
    for (const testid of ["fold-ajustes", "fold-cor"]) {
      const controls = screen.getByTestId(testid).getAttribute("aria-controls")!;
      expect(document.getElementById(controls)).not.toBeNull();
    }
    expect(screen.getByTestId("fold-sombra").getAttribute("aria-controls")).toBeNull();

    // Ajustes holds the parameters of the material in hand; Cor holds the full
    // tray the palette already decided (never a second one).
    const adjust = screen.getByRole("region", { name: "Ajustes" });
    expect(within(adjust).getByLabelText("Tamanho")).toBeInTheDocument();
    expect(within(adjust).getByLabelText("Opacidade")).toBeInTheDocument();
    const palette = screen.getByRole("region", { name: "Cor" });
    expect(within(palette).getAllByTestId("pro-palette")).toHaveLength(1);
  });

  it("toggles both folds with the chevron, and only with it", () => {
    mount();
    openSheet();

    // Closed → open → closed, with the readout only while it is shut.
    expect(screen.queryByRole("region", { name: "Ajustes" })).toBeNull();
    fireEvent.click(screen.getByTestId("fold-ajustes"));
    expect(expanded("fold-ajustes")).toBe("true");
    expect(screen.getByLabelText("Tamanho")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("fold-ajustes"));
    expect(expanded("fold-ajustes")).toBe("false");
    expect(screen.queryByRole("region", { name: "Ajustes" })).toBeNull();
    expect(screen.queryByLabelText("Tamanho")).toBeNull();
    // Closed, the row is an honest readout of what is inside — never an empty
    // header and never a second sample.
    const summary = screen.getByTestId("fold-ajustes-resumo").textContent ?? "";
    expect(summary).toContain("espessura");
    expect(summary).toContain("opacidade");

    // Escape descends the dock machine; it never toggles a fold (§7.2).
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
  });

  it("says so honestly when the tool has nothing to adjust", () => {
    mount();
    openTools();
    fireEvent.click(within(sheet()).getByLabelText("Tocar para pintar"));
    // The fold is closed by default now: the person opens the one they want.
    fireEvent.click(screen.getByTestId("fold-ajustes"));

    // The bucket keeps its honest line instead of an empty fold — and no slider
    // that would change nothing.
    const adjust = screen.getByRole("region", { name: "Ajustes" });
    expect(within(adjust).getByTestId("fold-ajustes-vazio").textContent).toBe(
      "Sem ajustes para esta ferramenta",
    );
    expect(screen.queryByLabelText("Tamanho")).toBeNull();

    // Closed, the summary says the same thing in two words.
    fireEvent.click(screen.getByTestId("fold-ajustes"));
    expect(screen.getByTestId("fold-ajustes-resumo").textContent).toBe("Sem ajustes");
  });
});

describe("b. disclosure is not enable, and a closed Cor shows no chip", () => {
  it("cannot be opened while the effect is off, and closing it by hand keeps the effect", () => {
    mount();
    openSheet();

    // The switch rides the header: it is on screen with the fold collapsed, and
    // it — not the chevron — is what opens an effect fold (owner's rule, 27/10).
    expect(expanded("fold-sombra")).toBe("false");
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByTestId("fold-sombra"));
    expect(expanded("fold-sombra")).toBe("false");
    expect(screen.queryByRole("region", { name: "Sombra" })).toBeNull();

    // On = the effect is on AND its fold comes with it.
    fireEvent.click(effectSwitch("Sombra"));
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "true");
    expect(expanded("fold-sombra")).toBe("true");

    // Closed by hand = the fold goes away, the effect does NOT: the summary still
    // names the values, and the next stroke travels with them (the command is the
    // witness, not the switch).
    fireEvent.click(screen.getByTestId("fold-sombra"));
    expect(screen.queryByRole("region", { name: "Sombra" })).toBeNull();
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("fold-sombra").textContent).toContain("50%");

    const paper = screen.getByTestId("paper-view");
    fireEvent.pointerDown(paper, { pointerId: 1, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(paper, { pointerId: 1, clientX: 140, clientY: 140 });
    expect(lastCommand()).toMatchObject({ t: "stroke", sombra: { on: true } });
  });

  it("closes Cor with no chip, no swatch and no summary text", () => {
    mount();
    openSheet();
    // It opens like every other fold — by its own chevron.
    fireEvent.click(screen.getByTestId("fold-cor"));
    const color = screen.getByTestId("canvas-panel").querySelector("[data-hex]")!;
    expect(color).not.toBeNull();

    fireEvent.click(screen.getByTestId("fold-cor"));
    expect(expanded("fold-cor")).toBe("false");

    // Absence, not a hidden chip: no region, no tray, no summary node, and the
    // header reads exactly its label — the sheet's own line is the context.
    expect(screen.queryByRole("region", { name: "Cor" })).toBeNull();
    expect(screen.queryByTestId("pro-palette")).toBeNull();
    expect(screen.queryByTestId("fold-cor-resumo")).toBeNull();
    expect(screen.getByTestId("fold-cor").textContent?.trim()).toBe("Cor");
    expect(screen.getByTestId("fold-cor").querySelector("[data-hex]")).toBeNull();
  });

  it("keeps the colour untouched when the folds are toggled", () => {
    mount();
    openSheet();
    const chip = () => screen.getByTestId("color-chip").getAttribute("data-hex")!;

    fireEvent.click(screen.getByTestId("fold-cor"));
    fireEvent.click(within(sheet()).getAllByTestId("palette-family")[3]!);
    const chosen = chip();

    // Sombra is opened by its switch (the chevron refuses while it is off), so
    // the loop below closes three OPEN folds.
    fireEvent.click(effectSwitch("Sombra"));
    for (const testid of ["fold-ajustes", "fold-cor", "fold-sombra"]) {
      fireEvent.click(screen.getByTestId(testid));
    }
    // Closing a fold discloses less; it never changes what is in hand.
    fireEvent.click(screen.getByTestId("fold-cor"));
    expect(chip()).toBe(chosen);
  });
});

describe("c. the folds are remembered per profile, and open CLOSED", () => {
  it("starts on the defaults: all four folds closed", () => {
    mount();
    openSheet();

    // The seed profile is a save written before the field existed: absence reads
    // the defaults — and since 27/10 (owner's decision) the default of every
    // fold is CLOSED. The sheet opens as a short list.
    for (const testid of ["fold-ajustes", "fold-cor", "fold-sombra", "fold-brilho"]) {
      expect(expanded(testid), testid).toBe("false");
      expect(screen.queryByTestId(`${testid}-regiao`), testid).toBeNull();
    }
    // Opening the sheet is not a choice: nothing is written by looking at it.
    expect(sections().maria).toBeNull();
  });

  it("keeps the LAST POSITION: a fold left open comes back open", () => {
    mount();
    openSheet();

    // One fold opened and one left shut: the sheet is left in that state.
    fireEvent.click(screen.getByTestId("fold-ajustes"));
    expect(expanded("fold-ajustes")).toBe("true");
    fireEvent.click(screen.getByLabelText("Feito"));
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    openTools();
    // "Fechou com Ajustes aberto" is a position, not a default: it comes back.
    expect(expanded("fold-ajustes")).toBe("true");
    expect(expanded("fold-cor")).toBe("false");

    // …and it survives a reload, because it went to the profile, not to a
    // session map: the save carries the fold the person left open.
    const saved = JSON.parse(localStorage.getItem("colorir-mockup-v1") ?? "{}") as {
      profiles?: { id: string; secoesPainel?: PanelSections }[];
    };
    expect(saved.profiles?.find((p) => p.id === "maria")?.secoesPainel).toEqual({
      ajustes: true,
      cor: false,
      sombra: false,
      brilho: false,
    });
  });

  it("survives a tool switch and a closed sheet, and is written to the profile", () => {
    mount();
    openSheet();

    fireEvent.click(screen.getByTestId("fold-ajustes"));
    fireEvent.click(screen.getByTestId("fold-cor"));
    // The switch opens the fold AND writes it: one gesture, no second door.
    fireEvent.click(effectSwitch("Sombra"));
    expect(expanded("fold-sombra")).toBe("true");
    expect(sections().maria).toEqual({
      ajustes: true,
      cor: true,
      sombra: true,
      brilho: false,
    });

    // A material with no effect of its own collapses the fold — the fold follows
    // what that material can show, and the person's stored choice does NOT move.
    fireEvent.click(within(sheet()).getByLabelText("Aquarela"));
    expect(expanded("fold-ajustes")).toBe("true");
    expect(expanded("fold-cor")).toBe("true");
    expect(expanded("fold-sombra")).toBe("false");
    expect(sections().maria.sombra).toBe(true);
    fireEvent.click(within(sheet()).getByLabelText("Carvão"));
    expect(expanded("fold-cor")).toBe("true");
    expect(expanded("fold-sombra")).toBe("false");

    // Back on the material that carries the effect, the open fold returns.
    fireEvent.click(within(sheet()).getByLabelText("Pincel"));
    expect(expanded("fold-sombra")).toBe("true");

    // Sheet → compact → sheet: the pair comes back with the sheet.
    fireEvent.click(screen.getByLabelText("Feito"));
    openTools();
    expect(expanded("fold-ajustes")).toBe("true");
    expect(expanded("fold-cor")).toBe("true");
    expect(expanded("fold-sombra")).toBe("true");

    // …and it is persisted WITH the profile, not in a session map: the save
    // carries it, so a reload reopens the same pair (the profile is the store).
    const saved = JSON.parse(localStorage.getItem("colorir-mockup-v1") ?? "{}") as {
      profiles?: { id: string; secoesPainel?: PanelSections }[];
    };
    expect(saved.profiles?.find((p) => p.id === "maria")?.secoesPainel).toEqual({
      ajustes: true,
      cor: true,
      sombra: true,
      brilho: false,
    });
  });

  it("switches the whole set with the profile, and a new one opens closed", () => {
    mount();
    openSheet();

    fireEvent.click(screen.getByTestId("fold-ajustes"));
    fireEvent.click(effectSwitch("Sombra"));

    // Another pro profile: her own set, which is the default one — all closed —
    // and the effect comes from HER material's memory, so that fold is closed
    // on arrival too.
    fireEvent.click(screen.getByTestId("enter-ana"));
    openTools();
    for (const testid of ["fold-ajustes", "fold-cor", "fold-sombra", "fold-brilho"]) {
      expect(expanded(testid), testid).toBe("false");
    }
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "false");
    expect(sections().maria).toEqual({ ajustes: true, cor: false, sombra: true, brilho: false });

    // …and Maria's set is exactly where she left it, effect included. Her sheet
    // reopens at the level she kept, so there is nothing to open.
    fireEvent.click(screen.getByTestId("enter-maria"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
    expect(expanded("fold-ajustes")).toBe("true");
    expect(expanded("fold-cor")).toBe("false");
    expect(expanded("fold-sombra")).toBe("true");
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "true");
  });

  it("restores the age defaults without touching a piece, a colour or a slot", () => {
    mount();
    openSheet();
    fireEvent.click(screen.getByTestId("seed-prefs"));
    const before = mariaPrefs();
    expect(before.recent).toEqual(["#2F6EAD"]);
    expect(before.slots).toEqual(["brush", "marker"]);

    fireEvent.click(screen.getByTestId("fold-ajustes"));
    fireEvent.click(screen.getByTestId("fold-cor"));
    // Turning the effect on writes the fold AND the effect; restoring the band
    // has to take both back.
    fireEvent.click(effectSwitch("Sombra"));
    expect(expanded("fold-sombra")).toBe("true");
    fireEvent.click(screen.getByTestId("restore"));

    // Back to the defaults, which are four CLOSED folds.
    for (const testid of ["fold-ajustes", "fold-cor", "fold-sombra", "fold-brilho"]) {
      expect(expanded(testid), testid).toBe("false");
    }
    // Restaurar desliga o efeito e fecha a dobra: the switched-off effect is why
    // the chevron is inert again, and the fold memory is gone too.
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-disabled", "true");
    // Deleting the field IS the default: nothing is left behind pretending to be
    // a choice the author made.
    expect(sections().maria).toBeNull();
    expect(mariaPrefs()).toEqual(before);
  });
});

describe("d. the thickness is one number per person, inherited on the switch", () => {
  it("hands the point in use to the material that arrives", () => {
    mount();
    openSheet();
    // The slider lives inside Ajustes, which opens CLOSED by default.
    fireEvent.click(screen.getByTestId("fold-ajustes"));
    const thickness = () => Number((screen.getByLabelText("Tamanho") as HTMLInputElement).value);

    fireEvent.change(screen.getByLabelText("Tamanho"), { target: { value: "64" } });
    expect(thickness()).toBe(64);

    // It is not the material's: the new one inherits it…
    fireEvent.click(within(sheet()).getByLabelText("Aquarela"));
    expect(thickness()).toBe(64);
    fireEvent.click(within(sheet()).getByLabelText("Marcador"));
    expect(thickness()).toBe(64);
    // …and coming back never restores a per-material point.
    fireEvent.click(within(sheet()).getByLabelText("Pincel"));
    expect(thickness()).toBe(64);

    // Written to the profile, outside the per-material map.
    expect(sizes().maria).toBe(64);

    // The compact bar reads the SAME number: one thickness, two surfaces.
    fireEvent.click(screen.getByLabelText("Feito"));
    const slider = screen.getByTestId("compact-thickness-slider") as HTMLInputElement;
    expect(Number(slider.value)).toBe(64);
  });
});

describe("e. a kids profile has no fold and no fold memory", () => {
  it("has no fold in the DOM, and no panel state written", () => {
    mount();
    fireEvent.click(screen.getByTestId("enter-theo"));

    // Theo's bar: the compact state IS his whole toolbar. There is no third
    // state, so there is nothing to disclose — the folds are ABSENT, not
    // hidden, and none of them exists in the tree.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    for (const testid of [
      "fold-ajustes",
      "fold-cor",
      "fold-sombra",
      "fold-brilho",
      "fold-gradiente",
    ]) {
      expect(screen.queryByTestId(testid), testid).toBeNull();
    }
    expect(screen.queryByRole("region", { name: "Ajustes" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Cor" })).toBeNull();
    // No memory of a panel he does not have: the field is never written.
    expect(screen.getByTestId("theo-sections").textContent).toBe("null");

    // Using the bar does not create one either — the capsule writes the one
    // thickness, never a fold.
    fireEvent.change(screen.getByTestId("compact-thickness-slider"), { target: { value: "18" } });
    expect(screen.getByTestId("theo-sections").textContent).toBe("null");
    expect(sizes().theo).toBe(18);
  });
});

describe("the sheet's scroll is remembered for the session, and only there", () => {
  it("returns to the same place after a tool switch and after reopening", () => {
    mount();
    openSheet();
    const body = screen.getByTestId("sheet-scroll");

    body.scrollTop = 240;
    fireEvent.scroll(body);
    expect(body.scrollTop).toBe(240);

    // The browser clamps the offset when the next tool's controls are shorter.
    // Restoring happens in the commit, before the finger can see the jump.
    body.scrollTop = 0;
    fireEvent.click(within(sheet()).getByLabelText("Aquarela"));
    expect(body.scrollTop).toBe(240);

    // Collapsing the sheet is the same promise: reopen, same place.
    fireEvent.click(screen.getByLabelText("Feito"));
    openTools();
    expect(screen.getByTestId("sheet-scroll").scrollTop).toBe(240);

    // …and it is NOT a preference: nothing about the scroll reached storage.
    const saved = localStorage.getItem("colorir-mockup-v1") ?? "";
    expect(saved).not.toMatch(/scroll/i);
    // The serialized TEXT is not a witness: `createdAt`/`updatedAt` are
    // `Date.now()`, and a timestamp carries "240" in about 0.3% of the seconds
    // of a day — which is the flake this assertion used to be. What counts is a
    // stored value, so the save is parsed and its numbers are read.
    expect(numbersIn(saved).has(240)).toBe(false);
  });
});

describe("f. the fold follows the effect, in both pro bands", () => {
  it("opens on enable and collapses on disable, writing both to the profile", () => {
    mount();
    openSheet();

    // Closed and inert, with the switch right there in the header (e).
    expect(expanded("fold-brilho")).toBe("false");
    expect(screen.getByTestId("fold-brilho")).toHaveAttribute("aria-disabled", "true");
    expect(effectSwitch("Brilho")).toHaveAttribute("aria-checked", "false");

    fireEvent.click(effectSwitch("Brilho"));
    expect(expanded("fold-brilho")).toBe("true");
    expect(sections().maria.brilho).toBe(true);

    fireEvent.click(effectSwitch("Brilho"));
    expect(expanded("fold-brilho")).toBe("false");
    expect(sections().maria.brilho).toBe(false);
    // The effect went with it: the material's memory is the witness, and the
    // stored eixo survives (the tuning is not thrown away, only switched off).
    expect(memory().maria?.brush?.brilho).toMatchObject({ on: false, intensity: 60, radius: 6 });
  });

  it("does the same on 6-8 once the adult turns effects on", () => {
    mount();
    fireEvent.click(screen.getByTestId("effects-on-bia"));
    const bia = JSON.parse(screen.getByTestId("bia").textContent || "{}") as {
      id: string | null;
      age: string | null;
      efeitos: boolean | null;
    };
    // The other pro band, with T3 on: same sheet, same rule, no second code path.
    expect(bia).toMatchObject({ age: "6-8", efeitos: true });

    fireEvent.click(screen.getByTestId("enter-bia"));
    openSheet();
    expect(expanded("fold-sombra")).toBe("false");
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByTestId("fold-sombra"));
    expect(expanded("fold-sombra")).toBe("false");
    expect(sections()[bia.id!]).toBeNull();

    fireEvent.click(effectSwitch("Sombra"));
    expect(expanded("fold-sombra")).toBe("true");
    expect(sections()[bia.id!]).toMatchObject({ sombra: true });

    fireEvent.click(effectSwitch("Sombra"));
    expect(expanded("fold-sombra")).toBe("false");
    expect(sections()[bia.id!]).toMatchObject({ sombra: false });
    // …and Maria's folds were never touched by anything her sister did.
    expect(sections().maria).toBeNull();
  });
});

describe("the fold contract is clean at the store's door", () => {
  it("reads a save without the field as the defaults — all four closed", () => {
    expect(panelSectionsOf(undefined)).toEqual({
      ajustes: false,
      cor: false,
      sombra: false,
      brilho: false,
    });
    // A key equal to the default is the default: the reader does not need the
    // write to name every fold, and a save that names only some is still read
    // one key at a time.
    expect(panelSectionsOf({ cor: false })).toEqual({
      ajustes: false,
      cor: false,
      sombra: false,
      brilho: false,
    });
    expect(panelSectionsOf({ ajustes: true })).toEqual({
      ajustes: true,
      cor: false,
      sombra: false,
      brilho: false,
    });
  });

  it("drops what the panel cannot show instead of trusting a backup", () => {
    expect(panelSectionsOf({ ajustes: "aberta", cor: null, sombra: 1, brilho: true })).toEqual({
      ajustes: false,
      cor: false,
      sombra: false,
      brilho: true,
    });
    expect(panelSectionsOf("aberta")).toEqual(panelSectionsOf(undefined));
  });
});

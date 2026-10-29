// Sombra, brilho and gradiente are the tool sheet's own folds
// (efeitos-chevrons §7.1–7.5), and this file measures them at the two seams a
// user can actually see.
//
// Seam 1 — the sheet as a role tree: the folds disclose without enabling, the
// switches and sliders write through to the profile's per-material memory, and
// the material that does not paint a mark of its own never sees them.
//
// Seam 2 — the stroke that reaches the engine. `paintStrokes` is observed, not
// guessed: during the drag the stroke in progress carries NO effect (live is
// plain), and after the release the committed command carries it — which is what
// makes the raster pass run exactly once, on the mark that stays.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeCanvas } from "./fake-canvas";
import { openFold, openTools } from "./open-panel";
import { paintStrokes } from "@/mockup/brushCanvas";
import type { Command, StrokeCommand } from "@/mockup/history";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import {
  StoreProvider,
  normalizeToolSettings,
  toolMemoryOf,
  useStore,
  type Screen,
} from "@/mockup/store";

// The screen's own call into the engine is observed; the engine itself stays real.
vi.mock("@/mockup/brushCanvas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/mockup/brushCanvas")>();
  return { ...actual, paintStrokes: vi.fn(actual.paintStrokes) };
});

const engine = vi.mocked(paintStrokes);
const HOME: Screen = { name: "home" };

/** The paper needs a 2d context for the engine call to happen at all in jsdom. */
let fake: ReturnType<typeof installFakeCanvas>;

beforeEach(() => {
  localStorage.clear();
  fake = installFakeCanvas();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  engine.mockClear();
  fake.restore();
});

function Studio({ profileId = "maria" }: { profileId?: string }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === "peixe");
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!art || !profile) return null;
  return (
    <>
      <CanvasScreen artworkId={art.id} back={HOME} />
      <output data-testid="last-command">
        {JSON.stringify(art.history.commands.at(-1) ?? null)}
      </output>
      <output data-testid="memory">{JSON.stringify(profile.toolSettings ?? {})}</output>
      <output data-testid="sections">{JSON.stringify(profile.secoesPainel ?? null)}</output>
      <output data-testid="theo-memory">
        {JSON.stringify(state.profiles.find((p) => p.id === "theo")?.toolSettings ?? {})}
      </output>
    </>
  );
}

const mount = () =>
  render(
    <StoreProvider>
      <Studio />
    </StoreProvider>,
  );

const sheet = () => screen.getByTestId("canvas-panel");
const regionOf = (name: "Sombra" | "Brilho") => screen.getByRole("region", { name });
const field = (region: HTMLElement, label: string) =>
  within(region).getByLabelText(label) as HTMLInputElement;
const memory = () => JSON.parse(screen.getByTestId("memory").textContent ?? "{}");
const sections = () =>
  JSON.parse(screen.getByTestId("sections").textContent ?? "null") as {
    sombra?: boolean;
    brilho?: boolean;
  } | null;
const lastCommand = () =>
  JSON.parse(screen.getByTestId("last-command").textContent ?? "null") as StrokeCommand | null;

/** The sheet, opened on a material that paints (the default tool is the bucket). */
function openMaterial(name = "Pincel") {
  openTools();
  fireEvent.click(within(sheet()).getByLabelText(name));
}

/**
 * The effect's switch, which rides the fold's HEADER (owner's rule, 27/10): it
 * is on screen whether the fold is open or collapsed, and it is the only way to
 * open an effect fold.
 */
const effectSwitch = (which: "Sombra" | "Brilho") =>
  screen.getByRole("switch", { name: `Ativar ${which.toLowerCase()}` });
const enable = (which: "Sombra" | "Brilho") => fireEvent.click(effectSwitch(which));

const draw = (from = 100, to = 160) => {
  const paper = screen.getByRole("img", { name: /Peixe/ });
  fireEvent.pointerDown(paper, { pointerId: 1, clientX: from, clientY: from });
  fireEvent.pointerMove(paper, { pointerId: 1, clientX: to, clientY: to - 20 });
  fireEvent.pointerUp(paper, { pointerId: 1, clientX: to, clientY: to - 20 });
};

// The owner's rule (27/10), measured on both effects: the switch lives in the
// FOLD'S HEADER — always on screen, never inside the region — the fold opens when
// the effect is turned on and collapses when it is turned off, and the chevron
// refuses while the effect is off. That is what keeps the switch reachable: one
// inside a fold that only opens with the effect on could never turn it back on.
describe("the owner's rule: the fold follows the effect", () => {
  it("keeps the switch in the header, on screen while the fold is collapsed", () => {
    mount();
    openMaterial();

    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("fold-sombra-regiao")).toBeNull();
    // The switch is there with the fold closed — and it is NOT inside the
    // disclosure button, which would nest one button in another.
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("fold-sombra").contains(effectSwitch("Sombra"))).toBe(false);
    expect(effectSwitch("Brilho")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("fold-brilho").contains(effectSwitch("Brilho"))).toBe(false);
  });

  it("opens the fold when the effect is turned on, and stores it open", () => {
    mount();
    openMaterial();
    expect(sections()).toBeNull();

    enable("Sombra");

    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-expanded", "true");
    expect(regionOf("Sombra")).toBeInTheDocument();
    expect(sections()?.sombra).toBe(true);
  });

  it("collapses the fold when the effect is turned off, and stores it closed", () => {
    mount();
    openMaterial();
    enable("Sombra");
    expect(regionOf("Sombra")).toBeInTheDocument();

    enable("Sombra");

    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("fold-sombra-regiao")).toBeNull();
    expect(sections()?.sombra).toBe(false);
    expect(screen.getByTestId("fold-sombra").textContent).toContain("Desligada");
  });

  it("refuses the chevron while the effect is off, and writes nothing", () => {
    mount();
    openMaterial();
    const fold = screen.getByTestId("fold-sombra");
    expect(fold).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(fold);

    // Nothing opens, nothing is written — in the profile or in the material's
    // memory. The way in is the switch on the same row.
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("fold-sombra-regiao")).toBeNull();
    expect(sections()).toBeNull();
    expect(memory().brush?.sombra).toBeUndefined();

    // With the effect on the same chevron is live again, and it closes.
    enable("Sombra");
    expect(fold).not.toHaveAttribute("aria-disabled");
    fireEvent.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "false");
  });

  it("still lets the person close it by hand while the effect stays on", () => {
    mount();
    openMaterial();
    enable("Sombra");
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByTestId("fold-sombra"));

    // Closing is disclosure: it hides the sliders, it does not turn the effect off.
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-expanded", "false");
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "true");
    expect(sections()?.sombra).toBe(false);
    expect(screen.getByTestId("fold-sombra").textContent).toContain("50% · 2px · 3px");

    // The next stroke still travels with it (the command is the witness)…
    draw();
    expect(lastCommand()?.sombra).toMatchObject({ on: true });
    // …and drawing never moves a fold: it is still closed.
    openMaterial();
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-expanded", "false");
  });

  it("does the same for Brilho: enable opens, disable collapses, off is inert", () => {
    mount();
    openMaterial();
    const fold = screen.getByTestId("fold-brilho");
    expect(fold).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(fold);
    expect(screen.queryByTestId("fold-brilho-regiao")).toBeNull();

    enable("Brilho");
    expect(fold).toHaveAttribute("aria-expanded", "true");
    expect(sections()?.brilho).toBe(true);

    enable("Brilho");
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("fold-brilho-regiao")).toBeNull();
    expect(sections()?.brilho).toBe(false);
    expect(fold.textContent).toContain("Desligado");
  });

  it("follows the material: off on the arriving one = collapsed and inert", () => {
    mount();
    openMaterial();
    enable("Sombra");
    expect(regionOf("Sombra")).toBeInTheDocument();

    // The watercolour carries no shadow of its own, so the fold collapses even
    // though the person's choice is still "open": what that material can show
    // wins, and the stored choice is not silently rewritten.
    fireEvent.click(within(sheet()).getByLabelText("Aquarela"));
    expect(screen.queryByTestId("fold-sombra-regiao")).toBeNull();
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-disabled", "true");
    expect(sections()?.sombra).toBe(true);

    // Back on the brush, both the effect and the open fold return.
    fireEvent.click(within(sheet()).getByLabelText("Pincel"));
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-expanded", "true");
  });
});

// The gradient became the THIRD effect on 27/10 (owner's feedback): the same
// switch on the fold's header, the same refusal while it is off. It used to be
// plain disclosure with "Desligado" as a third kind inside the type row — a
// switch drawn as a radio, which is the defect the owner named.
describe("the gradient is the third effect", () => {
  const foldGradiente = () => screen.getByTestId("fold-gradiente");
  const regionGradiente = () => screen.getByTestId("fold-gradiente-regiao");
  const gradientSwitch = () => screen.getByRole("switch", { name: "Ativar gradiente" });

  it("stays off, inert and null until the header switch turns it on", () => {
    mount();
    openMaterial();

    expect(gradientSwitch()).toHaveAttribute("aria-checked", "false");
    expect(foldGradiente()).toHaveAttribute("aria-disabled", "true");
    expect(foldGradiente()).toHaveAttribute("aria-expanded", "false");
    // The switch rides the HEADER, never inside the disclosure button.
    expect(foldGradiente().contains(gradientSwitch())).toBe(false);
    // Closed, the row says the state in one word — and it is the true one.
    expect(foldGradiente().textContent).toContain("Desligado");

    // Off, the chevron is inert: no region, no editor, and no "Desligado" kind
    // pretending to be a switch.
    fireEvent.click(foldGradiente());
    expect(foldGradiente()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("fold-gradiente-regiao")).toBeNull();
    expect(screen.queryByTestId("gradient-editor")).toBeNull();
    expect(screen.queryByRole("button", { name: "Desligado" })).toBeNull();

    // A stroke painted now travels without a gradient at all.
    draw();
    expect(lastCommand()?.gradient).toBeUndefined();
  });

  it("turns on into the default linear 90°, which the type row adjusts", () => {
    mount();
    openMaterial();
    fireEvent.click(gradientSwitch());

    expect(gradientSwitch()).toHaveAttribute("aria-checked", "true");
    expect(foldGradiente()).toHaveAttribute("aria-expanded", "true");
    expect(foldGradiente()).not.toHaveAttribute("aria-disabled");
    const region = regionGradiente();
    expect(within(region).getByTestId("gradient-preview")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Linear" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(region).getByRole("button", { name: "Radial" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // The stroke carries the default the switch built.
    draw();
    expect(lastCommand()?.gradient).toMatchObject({ kind: "linear", angle: 90 });

    // Radial is the adjustable half: the next stroke travels radial, on the same
    // gradient — the switch, not the type row, owns off.
    openMaterial();
    fireEvent.click(foldGradiente());
    fireEvent.click(within(regionGradiente()).getByRole("button", { name: "Radial" }));
    draw(140, 200);
    expect(lastCommand()?.gradient).toMatchObject({ kind: "radial" });
  });

  it("closes by hand without turning off, and the summary follows", () => {
    mount();
    openMaterial();
    fireEvent.click(gradientSwitch());

    // Closing is disclosure, not off.
    fireEvent.click(foldGradiente());
    expect(foldGradiente()).toHaveAttribute("aria-expanded", "false");
    expect(gradientSwitch()).toHaveAttribute("aria-checked", "true");
    expect(foldGradiente().textContent).toContain("Linear · 90°");

    // The switch is what turns it off — and it takes the editor with it.
    fireEvent.click(gradientSwitch());
    expect(gradientSwitch()).toHaveAttribute("aria-checked", "false");
    expect(foldGradiente()).toHaveAttribute("aria-disabled", "true");
    expect(foldGradiente()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("fold-gradiente-regiao")).toBeNull();
    expect(foldGradiente().textContent).toContain("Desligado");
  });
});

describe("the folds: disclosure, never enable", () => {
  it("reads Sombra's factory parameters off the controls the switch reveals", () => {
    mount();
    openMaterial();

    const fold = screen.getByTestId("fold-sombra");
    expect(fold).toHaveAttribute("aria-expanded", "false");
    // Closed, the row is an honest summary — not a sample, not a count.
    expect(fold.textContent).toContain("Desligada");
    expect(screen.queryByTestId("fold-sombra-regiao")).toBeNull();

    // The switch opens the disclosure; the effect and the fold are one gesture,
    // and the table below is what the fold has to show (§7.3).
    enable("Sombra");
    expect(fold).toHaveAttribute("aria-expanded", "true");
    const region = regionOf("Sombra");

    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "true");
    // §7.3's table, read off the controls themselves.
    expect(field(region, "Intensidade").value).toBe("50");
    expect(field(region, "Deslocamento X").value).toBe("0");
    expect(field(region, "Deslocamento Y").value).toBe("2");
    expect(field(region, "Raio").value).toBe("3");
    expect(field(region, "Espalhamento").value).toBe("0");
    expect([field(region, "Deslocamento X").min, field(region, "Deslocamento X").max]).toEqual([
      "-6",
      "6",
    ]);
    expect([field(region, "Raio").min, field(region, "Raio").max]).toEqual(["0", "8"]);
    expect([field(region, "Espalhamento").min, field(region, "Espalhamento").max]).toEqual([
      "0",
      "4",
    ]);
  });

  it("reads Brilho with auto colour, the shared palette behind Custom", () => {
    mount();
    openMaterial();
    enable("Brilho");
    const region = regionOf("Brilho");

    expect(screen.getByTestId("fold-brilho")).toHaveAttribute("aria-expanded", "true");
    expect(effectSwitch("Brilho")).toHaveAttribute("aria-checked", "true");
    expect(field(region, "Intensidade").value).toBe("60");
    expect([field(region, "Raio").min, field(region, "Raio").max]).toEqual(["2", "12"]);
    expect(within(region).getByRole("radio", { name: "Brilho automático" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    // Custom reveals the SHARED palette as swatches (no second picker).
    expect(within(region).queryByRole("radiogroup", { name: "Cores do brilho" })).toBeNull();
    fireEvent.click(within(region).getByRole("radio", { name: "Brilho personalizado" }));
    const swatches = within(region).getAllByRole("radio", { name: /^cor do brilho/ });
    expect(swatches.length).toBeGreaterThanOrEqual(11);
    // Exactly one chip is checked: Custom lands on the colour in hand instead of
    // leaving the row with nothing selected.
    const checked = swatches.filter((chip) => chip.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
  });

  it("keeps the two folds combinable, each with its own switch", () => {
    mount();
    openMaterial();
    enable("Sombra");
    enable("Brilho");

    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "true");
    expect(effectSwitch("Brilho")).toHaveAttribute("aria-checked", "true");
    // Each switch opens its own fold and only its own.
    expect(screen.getByTestId("fold-sombra")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("fold-brilho")).toHaveAttribute("aria-expanded", "true");
    expect(regionOf("Sombra")).toBeInTheDocument();
    expect(regionOf("Brilho")).toBeInTheDocument();
  });

  it("has no folds for a tool that does not paint a mark of its own", () => {
    mount();
    openTools();
    fireEvent.click(within(sheet()).getByLabelText("Tocar para pintar"));
    expect(screen.queryByTestId("fold-sombra")).toBeNull();
    expect(screen.queryByTestId("fold-brilho")).toBeNull();
    // …and no switch left behind either: the absence is structural.
    expect(screen.queryByRole("switch", { name: "Ativar sombra" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Ativar brilho" })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Ativar gradiente" })).toBeNull();
  });
});

describe("the values are remembered per material, absence = off", () => {
  it("writes through and returns when the material comes back", () => {
    mount();
    openMaterial();
    enable("Sombra");
    const region = regionOf("Sombra");
    fireEvent.change(field(region, "Intensidade"), { target: { value: "80" } });
    fireEvent.change(field(region, "Deslocamento Y"), { target: { value: "4" } });

    expect(memory().brush.sombra).toEqual({
      on: true,
      intensity: 80,
      dx: 0,
      dy: 4,
      radius: 3,
      spread: 0,
    });

    // Another material reads its OWN entry: nothing to remember = off, and the
    // fold it cannot open is collapsed and inert (the fold rule is measured in
    // the describe above; here the subject is the MEMORY).
    fireEvent.click(within(sheet()).getByLabelText("Aquarela"));
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "false");
    expect(memory().watercolor?.sombra).toBeUndefined();

    // Back to the brush: the point and the paint come back.
    fireEvent.click(within(sheet()).getByLabelText("Pincel"));
    expect(effectSwitch("Sombra")).toHaveAttribute("aria-checked", "true");
    expect(field(regionOf("Sombra"), "Intensidade").value).toBe("80");
    expect(field(regionOf("Sombra"), "Deslocamento Y").value).toBe("4");

    // …and another person never sees it: the memory is per profile.
    expect(JSON.parse(screen.getByTestId("theo-memory").textContent ?? "{}")).toEqual({});
  });

  it("turning the effect off keeps the tuning for the next time", () => {
    mount();
    openMaterial();
    enable("Sombra");
    fireEvent.change(field(regionOf("Sombra"), "Raio"), { target: { value: "7" } });
    enable("Sombra");

    expect(memory().brush.sombra).toMatchObject({ on: false, radius: 7 });
    // Closed, the summary tells the truth about the switch, not about the tuning
    // — and the fold is already collapsed by the switch itself.
    expect(screen.getByTestId("fold-sombra").textContent).toContain("Desligada");

    // Turning it on again still remembers the point.
    enable("Sombra");
    expect(field(regionOf("Sombra"), "Raio").value).toBe("7");
  });
});

describe("the gesture is plain; the COMMIT carries the effect", () => {
  it("paints the stroke in progress without the effect and commits it WITH the effect", () => {
    mount();
    openMaterial();
    enable("Sombra");

    engine.mockClear();
    // The paper's own canvas is observed too: the composite is a `drawImage`
    // into it, so "the effect ran" is a count, not an opinion.
    const page = fake.of(screen.getByTestId("paint-canvas") as HTMLCanvasElement);
    const composites = () => page.ops.filter((op) => op.op === "drawImage").length;

    const paper = screen.getByRole("img", { name: /Peixe/ });
    fireEvent.pointerDown(paper, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(paper, { pointerId: 1, clientX: 140, clientY: 120 });

    // While the finger is down, the live stroke is LAST in what the paper paints
    // (ArtworkPaint appends it) and it carries no effect: no blur per frame.
    const dragging = engine.mock.calls.at(-1)![1] as readonly Command[];
    const live = dragging[dragging.length - 1] as StrokeCommand;
    expect(live.t).toBe("stroke");
    expect(live.sombra).toBeUndefined();
    expect(live.brilho).toBeUndefined();
    expect(composites()).toBe(0);

    fireEvent.pointerUp(paper, { pointerId: 1, clientX: 140, clientY: 120 });

    // The committed command is the one that carries the effect, so the post-pass
    // runs once — on the mark that stays. Defaults come from §7.3's table.
    const committed = lastCommand();
    expect(committed?.sombra).toEqual({
      on: true,
      intensity: 50,
      dx: 0,
      dy: 2,
      radius: 3,
      spread: 0,
    });
    expect(committed?.brilho).toBeUndefined();
    // …and the composite really reached the page after the release.
    expect(composites()).toBeGreaterThan(0);

    // …and the engine is asked to paint that command, not the live clone.
    const after = engine.mock.calls.at(-1)![1] as readonly Command[];
    expect(after.some((c) => c === live)).toBe(false);
    const paintedStroke = after.find((c) => c.t === "stroke")!;
    expect(paintedStroke).toMatchObject({ sombra: { on: true, intensity: 50 } });
  });

  it("sends no effect at all when the switches are off", () => {
    mount();
    openMaterial();
    draw();
    const committed = lastCommand();
    expect(committed?.sombra).toBeUndefined();
    expect(committed?.brilho).toBeUndefined();
  });

  it("carries the glow's auto colour, and the custom hex when one is chosen", () => {
    mount();
    openMaterial();
    enable("Brilho");
    // The panel collapses on the first touch on the paper; the sheet reopens
    // for the second reading.
    draw();
    expect(lastCommand()?.brilho).toEqual({ on: true, intensity: 60, radius: 6, color: "auto" });

    // The stroke collapsed the dock; the sheet reopens with the fold the author
    // left OPEN — the disclosure is a preference now, not a remount (§7.3).
    openMaterial();
    expect(screen.getByTestId("fold-brilho")).toHaveAttribute("aria-expanded", "true");
    const region = regionOf("Brilho");
    fireEvent.click(within(region).getByRole("radio", { name: "Brilho personalizado" }));
    const swatch = within(region).getAllByRole("radio", { name: /^cor do brilho/ })[4]!;
    const hex = swatch.getAttribute("data-hex")!;
    fireEvent.click(swatch);
    draw(120, 200);

    expect(lastCommand()?.brilho).toMatchObject({ on: true, color: hex });
    // The second stroke collapsed the dock; the sheet reopens with the fold the
    // author left OPEN — the disclosure is a preference now, not a remount
    // (§7.3) — so closing it is what puts the summary on screen, and the
    // summary names the colour the glow is actually using.
    openMaterial();
    expect(screen.getByTestId("fold-brilho")).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByTestId("fold-brilho"));
    expect(screen.getByTestId("fold-brilho").textContent).toContain(hex);
  });
});

describe("the memory's door: absence is off, a hand-edited backup is clamped", () => {
  it("reads a material with no effect as off, with the factory parameters", () => {
    // A save written before the feature carries neither field: nothing to load.
    expect(toolMemoryOf({ size: 8, color: "#ffffff" })).toEqual({ color: "#FFFFFF" });
    expect(toolMemoryOf(undefined)).toEqual({});
  });

  it("fills the parameters a stored switch does not name", () => {
    expect(toolMemoryOf({ sombra: { on: true } }).sombra).toEqual({
      on: true,
      intensity: 50,
      dx: 0,
      dy: 2,
      radius: 3,
      spread: 0,
    });
    expect(toolMemoryOf({ brilho: { on: true } }).brilho).toEqual({
      on: true,
      intensity: 60,
      radius: 6,
      color: "auto",
    });
  });

  it("clamps a value the panel could never show instead of trusting it", () => {
    const wild = toolMemoryOf({
      sombra: { on: true, intensity: 900, dx: -80, dy: 99, radius: 40, spread: 9 },
      brilho: { on: 1, intensity: -20, radius: 0, color: "#abc" },
    });
    expect(wild.sombra).toEqual({
      on: true,
      intensity: 100,
      dx: -6,
      dy: 6,
      radius: 8,
      spread: 4,
    });
    // A malformed colour falls back to "auto", and only a real `true` is on.
    expect(wild.brilho).toEqual({ on: false, intensity: 0, radius: 2, color: "auto" });
  });

  it("survives the whole per-material map", () => {
    const map = normalizeToolSettings({
      brush: { sombra: { on: true, dy: 4 } },
      crayon: { opacity: 40 },
    });
    expect(map?.["brush"]?.sombra).toMatchObject({ on: true, dy: 4 });
    expect(map?.["crayon"]).toEqual({ opacity: 40 });
    expect(map?.["crayon"]?.sombra).toBeUndefined();
  });
});

describe("the preview reads the nozzle in hand, never the shelf's default", () => {
  it("opens the can's cloud as the three sliders move", () => {
    mount();
    openMaterial("Spray");
    // The nozzle lives in Ajustes, which opens CLOSED since 27/10.
    openFold("fold-ajustes");
    const width = () =>
      Number(screen.getByTestId("param-preview").getAttribute("data-stroke-width"));
    const atDefault = width();

    fireEvent.change(screen.getByLabelText("Ponta"), { target: { value: "0.2" } });
    const wideTip = width();
    expect(wideTip).toBeGreaterThan(atDefault);

    fireEvent.change(screen.getByLabelText("Dispersão"), { target: { value: "1.2" } });
    expect(width()).toBeGreaterThan(wideTip);
  });

  it("carries the same nozzle into the compact bar's preview", () => {
    mount();
    // The compact bar shows the can at the profile's own nozzle.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(within(screen.getByTestId("canvas-compact")).getByLabelText("Spray"));
    const compactWidth = () =>
      Number(screen.getByTestId("compact-preview").getAttribute("data-stroke-width"));
    const before = compactWidth();

    // Tune it in the sheet, then collapse back: the bar must follow.
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    openFold("fold-ajustes");
    fireEvent.change(screen.getByLabelText("Ponta"), { target: { value: "0.2" } });
    fireEvent.click(screen.getByLabelText("Feito"));

    expect(compactWidth()).toBeGreaterThan(before);
  });
});

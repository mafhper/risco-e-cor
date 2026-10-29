// The toolbar as the user meets it. Seams:
//
//   position: ONE bar, always at the bottom — no rail, no side, no override
//   gating:   nothing the profile cannot use is rendered (no padlock)
//   drawing:  the bar leaves the screen for the duration of the stroke
//   clamp:    a touch or a drag outside the paper never paints the margin
//   chrome:   the doors the row was budgeted for, never a second row
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Harness({
  profileId,
  pageId,
  live,
}: {
  profileId: string;
  pageId: string | null;
  /** Exposes the committed command list, so a clamp is proven on data. */
  live?: boolean;
}) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!art) return null;
  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      {live && (
        <span data-testid="commands" data-w={art.w} data-h={art.h}>
          {JSON.stringify(art.history.commands)}
        </span>
      )}
      {live && <span data-testid="mode">{profile?.age}</span>}
    </>
  );
}

const mount = (profileId = "maria", pageId: string | null = "peixe", live = false) =>
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} live={live} />
    </StoreProvider>,
  );

const paper = () => screen.getByTestId("paper-view").querySelector("svg")!;

describe("one toolbar, always at the bottom", () => {
  it("never renders a rail or a lateral position on a pro profile", () => {
    mount("maria", "peixe");
    expect(screen.queryByTestId("tool-rail")).toBeNull();
    expect(screen.queryByTestId("rail-tools")).toBeNull();
    expect(screen.queryByTestId("rail-footer")).toBeNull();
    // The canvas no longer carries a position attribute at all.
    expect(screen.getByTestId("canvas")).not.toHaveAttribute("data-toolbar-position");
    // The resting bar is the bottom pill, in the HUD band.
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-hud-band")).toBeInTheDocument();
  });

  it("renders no element with a lateral position class anywhere on the canvas", () => {
    mount("maria", "peixe");
    const canvas = screen.getByTestId("canvas");
    expect(canvas.querySelector("[class~='left-1']")).toBeNull();
    expect(canvas.querySelector("[class~='right-1']")).toBeNull();
    expect(canvas.querySelector("[data-position='left']")).toBeNull();
    expect(canvas.querySelector("[data-position='right']")).toBeNull();
  });

  it("keeps the same bottom bar on a child's canvas", () => {
    mount("theo", "foguete");
    expect(screen.queryByTestId("tool-rail")).toBeNull();
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
  });

  it("keeps the top chrome to what the composition budgeted for", () => {
    // Since 27/10 (`chrome-v2` §12.1) the top band is the SELECTOR and nothing
    // else, plus the page's name on 9+ when the path offers no switch. This
    // harness comes from Home, so there is no pill: the band is a label.
    mount("maria", "peixe");
    const band = screen.getByTestId("canvas-top-band");
    expect(band.querySelectorAll("button")).toHaveLength(0);
    expect(Number(band.getAttribute("data-chip-count"))).toBe(0);
    expect(within(band).getByTestId("canvas-title")).toBeInTheDocument();
    // `Início` is not a block of it: it is the bottom band's first target.
    expect(band.querySelectorAll('[data-testid="chrome-back"]')).toHaveLength(0);
    expect(screen.getAllByTestId("chrome-back")).toHaveLength(1);
    // No look control rides a band either: papel and grade are folds of the sheet.
    expect(screen.queryByTestId("fold-papel")).toBeNull();
    expect(screen.queryByTestId("desk-door")).toBeNull();

    cleanup();
    localStorage.clear();

    // 3-5 without a switch draws NO band at all (0dp): the air goes to the paper.
    mount("theo", "foguete");
    expect(screen.queryByTestId("canvas-top-band")).toBeNull();
  });
});

describe("no blocked doors: the bar only shows what can be used", () => {
  it("gives a child the bucket on a blank sheet, with no padlock anywhere", () => {
    mount("theo", null);
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    expect(compact.querySelectorAll("[data-locked='true']")).toHaveLength(0);
    expect(compact.querySelector("[data-lock-badge]")).toBeNull();
    expect(within(compact).getByLabelText("Pintar")).toBeInTheDocument();
    expect(within(compact).getByLabelText("Giz de cera")).toBeInTheDocument();
    expect(within(compact).getByLabelText("Borracha")).toBeInTheDocument();
    // Still reading-zero: no caption explains the tools.
    expect(compact.textContent?.trim() ?? "").toBe("");
  });

  it("keeps the same materials on a page, still with no padlock", () => {
    mount("theo", "foguete");
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    expect(within(compact).getByLabelText("Pintar")).toBeInTheDocument();
    expect(compact.querySelectorAll("[data-locked='true']")).toHaveLength(0);
  });
});

describe("the compact tool row: one plate per chip, twelve targets in 6 + 6", () => {
  const openCompact = () => fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
  const chipsOf = (compact: HTMLElement) =>
    within(within(compact).getByTestId("compact-tools")).getAllByRole("button");
  const toolsOf = (compact: HTMLElement) =>
    chipsOf(compact)
      .map((chip) => chip.getAttribute("data-tool"))
      .filter((tool): tool is string => tool !== null);

  it("gives every pro tool the same 44dp plate, centred as a group", () => {
    mount("maria", "peixe");
    openCompact();
    const compact = screen.getByTestId("canvas-compact");
    const chips = chipsOf(compact).filter((chip) => chip.hasAttribute("data-tool"));
    expect(chips).toHaveLength(11);
    for (const chip of chips) {
      expect(chip).toHaveClass("h-11", "w-11", "rounded-[12px]");
      expect(chip).toHaveClass("items-center", "justify-center");
    }
    // ONE plate for every tool: the idle ones are the same muted surface, and
    // the one in hand is the same plate inverted (never a different size).
    for (const chip of chips.filter((c) => c.getAttribute("data-plate-state") === "off")) {
      expect(chip).toHaveClass("bg-muted");
    }
    const on = chips.filter((chip) => chip.getAttribute("aria-pressed") === "true");
    expect(on).toHaveLength(1);
    expect(on[0]).toHaveClass("bg-foreground", "ring-2");
    // Both lines are centred as their own group.
    for (const line of within(compact).getAllByTestId("compact-tools-line")) {
      expect(line).toHaveClass("justify-center");
    }
  });

  it("shows every tool at once: the second line is drawn, not opened", () => {
    mount("maria", "peixe");
    openCompact();
    const compact = screen.getByTestId("canvas-compact");
    const shown = toolsOf(compact);

    expect(shown).toHaveLength(11);
    expect(new Set(shown).size).toBe(shown.length);
    // Six on the first line, five plus the adjustments door on the second — the
    // sixth column is the door's, so both lines are full.
    const [first, second] = within(compact).getAllByTestId("compact-tools-line");
    expect(within(first!).getAllByRole("button")).toHaveLength(6);
    expect(within(second!).getAllByRole("button")).toHaveLength(6);
    // No overflow door left to open: the row's height is the row.
    expect(within(compact).queryByLabelText("Ver todas as ferramentas")).toBeNull();
    expect(within(compact).queryByTestId("compact-tools-overflow")).toBeNull();
    // Two doors, two jobs: the drawer's latch opens the complete palette, and
    // the bar itself carries no second expand target inside its rows (it has
    // exactly one, hanging from its top edge — owner's report, 27/10).
    expect(screen.getAllByLabelText("Abrir painel de ferramentas")).toHaveLength(1);
    const latch = screen.getByLabelText("Abrir painel de ferramentas");
    expect(within(compact).getByTestId("compact-tools").contains(latch)).toBe(false);
    for (const chip of chipsOf(compact).filter((c) => c.hasAttribute("data-tool"))) {
      expect(chip).toHaveClass("h-11", "w-11", "rounded-[12px]");
    }
  });

  it("keeps the picked chip where the finger left it, on either line", () => {
    mount("maria", "peixe");
    openCompact();
    const compact = screen.getByTestId("canvas-compact");
    const before = toolsOf(compact);

    // A material of the SECOND line: it is pressed in place, and the row reads
    // exactly the same order.
    fireEvent.click(within(compact).getByLabelText("Aquarela"));
    expect(toolsOf(compact)).toEqual(before);
    expect(within(compact).getByLabelText("Aquarela")).toHaveAttribute("aria-pressed", "true");
    expect(within(compact).getByLabelText("Aquarela")).toHaveAttribute("data-plate-state", "on");

    // And one of the first line, without moving anything either.
    fireEvent.click(within(compact).getByLabelText("Lápis"));
    expect(toolsOf(compact)).toEqual(before);
    expect(within(compact).getByLabelText("Lápis")).toHaveAttribute("aria-pressed", "true");
    expect(within(compact).getByLabelText("Aquarela")).toHaveAttribute("data-plate-state", "off");
  });

  it("hands the thickness to the next material, from the slider to the stroke", () => {
    mount("maria", "peixe", true);
    openCompact();
    const slider = (host: HTMLElement) =>
      within(host).getByTestId("compact-thickness-slider") as HTMLInputElement;
    const compactNow = () => screen.getByTestId("canvas-compact");

    // The row is eraser, bucket, then use (spec §7.4): the brush lives on the
    // second line and is always visible — no door to open first.
    fireEvent.click(within(compactNow()).getByLabelText("Pincel"));
    fireEvent.change(slider(compactNow()), { target: { value: "37" } });
    expect(Number(slider(compactNow()).value)).toBe(37);

    fireEvent.pointerDown(paper(), { pointerId: 1, clientX: 40, clientY: 60 });
    fireEvent.pointerUp(paper(), { pointerId: 1, clientX: 80, clientY: 90 });

    // Reopening the bar on ANOTHER material shows the SAME number: there is one
    // thickness per person and the material that arrives inherits it — no
    // per-material point comes back (owner's decision, 26/10, §11.3).
    openCompact();
    const compact = compactNow();
    fireEvent.click(within(compact).getByLabelText("Lápis"));
    const pencilSize = Number(slider(compact).value);
    expect(pencilSize).toBe(37);

    fireEvent.pointerDown(paper(), { pointerId: 1, clientX: 50, clientY: 70 });
    fireEvent.pointerUp(paper(), { pointerId: 1, clientX: 90, clientY: 100 });

    openCompact();
    const back = compactNow();
    fireEvent.click(within(back).getByLabelText("Pincel"));
    expect(Number(slider(back).value)).toBe(37);

    type StrokeLike = { t: string; brush?: string; size?: number };
    const commands = JSON.parse(screen.getByTestId("commands").textContent!) as StrokeLike[];
    const strokes = commands.filter((command) => command.t === "stroke");
    expect(strokes.map((stroke) => stroke.brush)).toEqual(["brush", "pencil"]);
    expect(strokes.map((stroke) => stroke.size)).toEqual([37, pencilSize]);
  });
});

describe("ink never leaves the paper", () => {
  it("ignores a touch that starts on the margin", () => {
    mount("theo", null, true);
    const before = screen.getByTestId("commands").textContent;
    const svg = paper();

    // The stubbed paper is 300x300 at (0,0); negative and past-the-edge are
    // margins, not canvas.
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: -20, clientY: 40 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: -20, clientY: 40 });
    expect(screen.getByTestId("commands").textContent).toBe(before);
    // The rejected touch does not even leave the pill.
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
  });

  it("drops every point sampled outside the paper during a drag", () => {
    mount("theo", null, true);
    const svg = paper();

    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 40, clientY: 60 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 120, clientY: 120 });
    // Out of bounds: this point must never enter the stroke.
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: -60, clientY: 120 });
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 380, clientY: 120 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 120, clientY: 120 });

    const out = JSON.parse(screen.getByTestId("commands").textContent!);
    const stroke = out.find((c: { t: string }) => c.t === "stroke");
    expect(stroke).toBeTruthy();
    const w = Number(screen.getByTestId("commands").getAttribute("data-w"));
    const h = Number(screen.getByTestId("commands").getAttribute("data-h"));
    for (const [x, y] of stroke.points as [number, number][]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(w);
      expect(y).toBeLessThanOrEqual(h);
    }
  });
});

describe("the bar leaves the paper alone while ink is flowing", () => {
  it("hides the bottom bar on pointerdown and brings it back after the stroke", () => {
    mount("theo", null);
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();

    fireEvent.pointerDown(paper(), { pointerId: 1, clientX: 40, clientY: 60 });
    expect(screen.queryByTestId("canvas-dock")).toBeNull();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();

    fireEvent.pointerUp(paper(), { pointerId: 1, clientX: 80, clientY: 90 });
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
  });
});

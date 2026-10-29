// The resting pill and its three mini-pops (mini-popovers.md, 26/10).
//
// Seam: the door a hand actually touches, not the component. Tap USES the
// thing; a 500 ms hold opens that door's pop; choosing inside applies on the
// spot and comes back to the pill. One pop at a time, Escape and a touch
// outside close it, and the 3-5 band reads it without a single word.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { BLACK, COMPACT_LIGHTNESS, WHITE, derivedRamp } from "@/mockup/palette";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Harness({ profileId, pageId = null }: { profileId: string; pageId?: string | null }) {
  const { state, dispatch } = useStore();
  const id = `pop-${profileId}-${pageId ?? "blank"}`;
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    dispatch({
      type: "createArtwork",
      artwork: {
        id,
        profileId,
        pageId,
        w: 300,
        h: 300,
        history: { commands: [], redo: [], undoable: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        visibility: "draft",
        publishedAt: null,
      },
    });
  }, [dispatch, profileId, pageId, id]);
  const art = state.artworks.find((a) => a.id === id);
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!art) return null;
  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      <span data-testid="memory">
        {JSON.stringify(
          profile
            ? { tools: profile.toolSettings ?? null, size: profile.strokeSize ?? null }
            : null,
        )}
      </span>
    </>
  );
}

const mount = (profileId = "maria", pageId: string | null = null) =>
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} />
    </StoreProvider>,
  );

const door = (name: string | RegExp) =>
  within(screen.getByTestId("canvas-dock")).getByLabelText(name);

/** Hold a pill door for the documented 500 ms and let the pop mount. */
async function hold(target: HTMLElement) {
  fireEvent.pointerDown(target);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 520));
  });
  fireEvent.pointerUp(target);
}

const memory = () => JSON.parse(screen.getByTestId("memory").textContent || "null");

describe("the pill: three material doors and the way into the bar", () => {
  it("carries eraser, material, colour and the chevron on both bands", () => {
    for (const [profileId, expected] of [
      ["maria", ["Borracha", "Pincel", "Cor atual"]],
      ["theo", ["Borracha", "Giz de cera", "Cor atual"]],
    ] as const) {
      mount(profileId);
      const pill = screen.getByTestId("canvas-dock");
      for (const name of expected) {
        expect(within(pill).getByLabelText(name), `${profileId}/${name}`).toBeInTheDocument();
      }
      expect(within(pill).getByLabelText("Abrir barra de ferramentas")).toBeInTheDocument();
      cleanup();
      localStorage.clear();
    }
  });

  it("uses the eraser on a tap and opens the size pop only on a hold", async () => {
    mount();
    fireEvent.click(door("Borracha"));
    expect(screen.queryByTestId("mini-pop")).toBeNull();
    expect(screen.getByTestId("mini-tool")).toHaveAttribute("data-tool", "brush");

    await hold(door("Borracha"));
    const pop = screen.getByTestId("mini-pop-eraser");
    expect(pop).toBeInTheDocument();
    // The eraser has ONE behaviour — the area of its circle — so the pop carries
    // its size and nothing else: no mode, no segment. The size is the same 1..100
    // capsule the brushes read (owner's call, 26/10: P/M/G is gone), which is the
    // slider plus its two ends.
    expect(within(pop).getAllByRole("button")).toHaveLength(2);
    expect(within(pop).getByLabelText("Espessura")).toHaveAttribute("type", "range");
    expect(pop.textContent?.trim() ?? "").toBe("");
  });
});

describe("the eraser pop: the 1..100 capsule, nothing else", () => {
  it("writes the number every material shares, not a size of its own", async () => {
    mount();
    await hold(door("Borracha"));
    fireEvent.change(screen.getByLabelText("Espessura"), { target: { value: "40" } });

    // The value applies as it moves, and the pop stays open while the hand is
    // on the slider: closing on the first step would make the drag impossible.
    // It is ONE number for the whole hand (§11.3): the eraser does not keep a
    // radius beside the brushes' thickness.
    expect(memory().size).toBe(40);
    expect(memory().tools?.eraser).toBeUndefined();
    expect(screen.getByTestId("mini-pop-eraser")).toBeInTheDocument();

    // A touch outside puts the pop away; the eraser is the tool in hand.
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("mini-pop")).toBeNull();
    expect(screen.getByTestId("mini-eraser")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();

    // Reopening shows the size in the hand instead of the band default.
    await hold(door("Borracha"));
    expect(Number((screen.getByLabelText("Espessura") as HTMLInputElement).value)).toBe(40);
  });
});

describe("the material pop: only painting material", () => {
  it("lists the materials of the catalogue — never the bucket, never the eraser", async () => {
    mount("maria");
    await hold(door("Pincel"));
    const pop = screen.getByTestId("mini-pop-material");
    const names = within(pop)
      .getAllByRole("button")
      .map((cell) => cell.getAttribute("aria-label"));
    // Decisão do dono (27/10): o pop lista SÓ material de pintura. O balde e a
    // borracha já são alvos fixos da pílula, então repeti-los aqui era a mesma
    // porta duas vezes — e a borracha o dono já tinha reclamado. Nove portas,
    // na ordem do catálogo, com o material em mãos no meio delas.
    expect(names).toEqual([
      "Lápis",
      "Carvão",
      "Giz de cera",
      "Marcador",
      "Pincel",
      "Aquarela",
      "Óleo",
      "Spray",
      "Nanquim",
    ]);
    expect(names).toHaveLength(9);
    // Nem o balde nem a borracha têm porta aqui — nem por id, nem por nome.
    expect(pop.querySelector('[data-tool="fill"]')).toBeNull();
    expect(pop.querySelector('[data-tool="eraser"]')).toBeNull();
    expect(within(pop).queryByLabelText("Pintar")).toBeNull();
    expect(within(pop).queryByLabelText("Borracha")).toBeNull();

    // The material in hand is MARKED, and by more than colour: `aria-pressed`
    // is the state a screen reader reads.
    expect(within(pop).getByLabelText("Pincel")).toHaveAttribute("aria-pressed", "true");
    expect(within(pop).getByLabelText("Marcador")).toHaveAttribute("aria-pressed", "false");

    // Choosing applies at once, closes the pop and stays in the pill.
    fireEvent.click(screen.getByLabelText("Marcador"));
    expect(screen.queryByTestId("mini-pop")).toBeNull();
    expect(screen.getByTestId("mini-tool")).toHaveAttribute("data-tool", "marker");
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
  });

  it("lists only the painting materials the band has, and never a door it lacks", async () => {
    mount("theo");
    await hold(door("Giz de cera"));
    const pop = screen.getByTestId("mini-pop-material");
    const names = within(pop)
      .getAllByRole("button")
      .map((cell) => cell.getAttribute("aria-label"));
    // Três materiais na faixa de três. O balde e a borracha continuam
    // existindo na BARRA da faixa; não são material e não se repetem aqui.
    expect(names).toEqual(["Giz de cera", "Marcador", "Pincel"]);
    expect(names).toHaveLength(3);
    expect(pop.querySelector('[data-tool="fill"]')).toBeNull();
    expect(pop.querySelector('[data-tool="eraser"]')).toBeNull();
    expect(within(pop).queryByLabelText("Ajustes do pincel")).toBeNull();
    expect(pop.textContent?.trim() ?? "").toBe("");
  });

  it("closes the grid: six columns on 9+, five on 3–5, never a cropped cell", async () => {
    // The account the owner asked for, measured against BOTH phone widths: the
    // grid is 304dp on 9+ and 312dp on 3–5, and the pop is centred on a pill that
    // is itself centred in the band's 12dp gutters.
    const mountAndMeasure = async (profileId: string) => {
      mount(profileId);
      await hold(door(profileId === "theo" ? "Giz de cera" : "Pincel"));
      const grid = screen.getByTestId("mini-material-grid");
      const box = screen.getByTestId("mini-pop");
      return {
        columns: Number(grid.getAttribute("data-columns")),
        cell: Number(grid.getAttribute("data-cell")),
        gap: Number(grid.getAttribute("data-gap")),
        count: Number(grid.getAttribute("data-count")),
        width: Number(grid.getAttribute("data-width")),
        box: Number(box.getAttribute("data-width")),
        buttons: within(grid).getAllByRole("button"),
      };
    };

    const pro = await mountAndMeasure("maria");
    expect(pro.columns).toBe(6);
    expect(pro.cell).toBe(44);
    expect(pro.count).toBe(9);
    expect(pro.width).toBe(6 * 44 + 5 * 8);
    // Nove em seis colunas fecham em duas linhas, 6 + 3 — sem órfã, sem rolagem.
    expect(Math.ceil(pro.count / pro.columns)).toBe(2);
    for (const cell of pro.buttons) {
      expect(cell.style.width).toBe("44px");
      expect(cell.style.height).toBe("44px");
    }
    // 304dp of grid + the two 8dp gutters = a 320dp card: half of it is 160dp,
    // and the narrowest frame still leaves 168dp from the centre to the band's
    // gutter — 8dp of air on each side.
    expect(pro.box).toBe(pro.width + 16);
    expect(pro.box).toBe(320);
    expect(360 / 2 - 12 - pro.box / 2).toBe(8);
    expect(390 / 2 - 12 - pro.box / 2).toBe(23);

    cleanup();
    localStorage.clear();

    const kid = await mountAndMeasure("theo");
    expect(kid.columns).toBe(5);
    expect(kid.cell).toBe(56);
    expect(kid.count).toBe(3);
    expect(kid.width).toBe(5 * 56 + 4 * 8);
    // Três portas nas CINCO colunas da faixa: uma linha só, e a grade mantém a
    // largura da faixa — ela não encolhe para caber o número de portas.
    expect(Math.ceil(kid.count / kid.columns)).toBe(1);
    expect(kid.buttons).toHaveLength(3);
    for (const cell of kid.buttons) {
      expect(cell.style.width).toBe("56px");
      expect(cell.style.height).toBe("56px");
    }
    // 312dp of grid + 16dp of gutter = a 328dp card: at 360 that leaves 4dp of
    // air on each side — inside the frame, never cut.
    expect(kid.box).toBe(kid.width + 16);
    expect(kid.box).toBe(328);
    expect(360 / 2 - 12 - kid.box / 2).toBe(4);
    expect(390 / 2 - 12 - kid.box / 2).toBe(19);
  });

  it("keeps Ajustes as ONE door: the bar's eleventh target, never a cell in the pop", async () => {
    mount("maria");
    await hold(door("Pincel"));
    // The duplicate is gone: the pop is a material list, nothing else.
    expect(screen.queryByLabelText("Ajustes do pincel")).toBeNull();
    expect(screen.queryByTestId("mini-material-adjust")).toBeNull();

    // …and the one door still lands on the expanded sheet. The tap below is the
    // release of the hold (swallowed on purpose), so the next one is a real tap.
    fireEvent.click(door("Pincel"));
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByTestId("compact-more-adjustments"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
  });
});

describe("the colour pop: the spectrum, then the compacta's ladder", () => {
  /**
   * The ten rungs of WHITE as a colour in hand — an independent worked example:
   * hsl(0 0% L) at the ladder's ten lightness steps (96, 89, 82, 75, 68, 61, 54,
   * 47, 40, 26), each one converted by hand and rounded the way an 8-bit channel
   * rounds. With #FFFFFF in hand every rung is a grey, so the values cannot come
   * from the colour the pop happened to open on.
   */
  const GREYS = [
    "#F5F5F5",
    "#E3E3E3",
    "#D1D1D1",
    "#BFBFBF",
    "#ADADAD",
    "#9C9C9C",
    "#8A8A8A",
    "#787878",
    "#666666",
    "#424242",
  ];

  const ladder = () => screen.getByTestId("mini-color-ladder");
  const cells = () => within(ladder()).getAllByRole("radio");

  /** What a hand sees in a cell: 9+ names it, 3–5 only paints it. */
  function colourOf(cell: HTMLElement): string {
    const painted = cell.querySelector<HTMLElement>("[data-swatch]")!.style.background;
    const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(painted);
    if (!rgb) return painted.toUpperCase();
    return `#${rgb
      .slice(1, 4)
      .map((part) => Number(part).toString(16).padStart(2, "0"))
      .join("")}`.toUpperCase();
  }

  /** Put white in the hand through the pop itself, then reopen on it. */
  async function withWhiteInHand(profileId: string) {
    await hold(door("Cor atual"));
    fireEvent.click(cells()[0]!);
    expect(screen.getByTestId("canvas-dock")).toHaveAttribute("data-color", "#FFFFFF");
    await hold(door("Cor atual"));
  }

  it("carries the spectrum strip over the twelve cells, and grows to fit both", async () => {
    mount("maria");
    await hold(door("Cor atual"));
    const pop = screen.getByTestId("mini-pop-color");
    const box = screen.getByTestId("mini-pop");

    // THE STRIP: the compact bar's own control, under its own id here — one
    // implementation, one behaviour, one order. It sits ABOVE the ladder.
    const spectrum = within(pop).getByTestId("mini-spectrum");
    const strip = within(spectrum).getByRole("slider");
    expect(strip).toHaveAccessibleName("Espectro de cores");
    expect(spectrum.getAttribute("data-track")).toBe("24");
    expect(spectrum.getAttribute("data-touch")).toBe("48");
    expect(
      spectrum.compareDocumentPosition(ladder()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // THE STRIP SCRUBS LIVE: a key on it rotates the hue in hand and the pop
    // STAYS open — the strip is the hunting tool, the cell is the one that closes.
    const hue = strip.getAttribute("aria-valuenow");
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    expect(strip.getAttribute("aria-valuenow")).not.toBe(hue);
    expect(screen.getByTestId("mini-pop-color")).toBeInTheDocument();

    // THE LADDER: twelve cells, 6 + 6, on the compacta's own account.
    expect(cells()).toHaveLength(12);
    expect(ladder().getAttribute("data-count")).toBe("12");
    expect(ladder().getAttribute("data-columns")).toBe("6");
    expect(ladder().getAttribute("data-rows")).toBe("2");
    expect(ladder().getAttribute("data-cell")).toBe("44");
    expect(ladder().getAttribute("data-gap")).toBe("8");
    expect(ladder().getAttribute("data-width")).toBe("304");
    // No numeric label band ANYWHERE: the pop is a picker, not a scale.
    expect(ladder().getAttribute("data-label-band")).toBeNull();
    expect(ladder().querySelector("[data-step]")).toBeNull();

    // THE POP GROWS TO FIT (owner's feedback, 27/10): 304dp of content plus an
    // 8dp gutter each side is a 320dp popover, and it is not clipped by the
    // pill's width. The box is the content PLUS the padding — with the app's
    // border-box, a 304dp grid inside a 304dp card would lose 16dp to the
    // gutter, which is the same class of cut the owner reported.
    expect(box.getAttribute("data-content-width")).toBe("304");
    expect(box.getAttribute("data-width")).toBe("320");
    expect(box.style.width).toBe("320px");
    expect(box.style.padding).toBe("8px");
    expect(box.className).not.toContain("max-w-[calc(100%-16px)]");
    expect(pop.textContent?.trim() ?? "").toBe("");
    // Height, on the same account: 8 gutter + 48 of spectrum band + 8 of stack
    // + 96 of ladder (two 44dp rows, one 8dp gap) + 8 gutter = 168dp.
    expect(8 + 48 + 8 + (2 * 44 + 8) + 8).toBe(168);
    // 160dp each side of the pill's centre; the narrowest frame leaves 168dp
    // from that centre to the band's 12dp gutter — 8dp of air on each side.
    expect(360 / 2 - 12 - 320 / 2).toBe(8);
    expect(390 / 2 - 12 - 320 / 2).toBe(23);
  });

  it("shows white, the ten rungs of the colour, black — twelve in 6 + 6", async () => {
    mount("maria");
    await hold(door("Cor atual"));
    const pop = screen.getByTestId("mini-pop-color");
    const color = screen.getByTestId("canvas-dock").getAttribute("data-color")!;

    for (const cell of cells()) {
      expect(cell.style.width).toBe("44px");
      expect(cell.style.height).toBe("44px");
      expect(cell).toHaveClass("rounded-[12px]");
      // The swatch IS the cell minus its 1dp frame — the band is gone, so the
      // swatch grew into it instead of leaving an empty strip.
      expect(cell.children).toHaveLength(1);
      expect((cell.querySelector("[data-swatch]") as HTMLElement).style.height).toBe("42px");
    }

    // White opens the row, black closes it: two cells of the ladder, never a
    // pair beside it.
    const hexes = cells().map(colourOf);
    expect(hexes[0]).toBe("#FFFFFF");
    expect(hexes.at(-1)).toBe("#000000");
    expect(within(ladder()).getByLabelText("Branco")).toBe(cells()[0]);
    expect(within(ladder()).getByLabelText("Preto")).toBe(cells().at(-1));
    // The middle ten are the rungs of the colour in hand — the compacta's
    // ten-rung ladder, not the eleven of the expanded sheet.
    expect(hexes).toEqual([WHITE.hex, ...derivedRamp(color, COMPACT_LIGHTNESS), BLACK.hex]);
    expect(new Set(hexes.slice(1, -1)).size).toBe(10);

    // The mixture is gone: no recents row, no second group.
    expect(within(pop).queryAllByTestId("mini-color-recent")).toHaveLength(0);
    expect(within(pop).queryByRole("radiogroup", { name: "Cores recentes" })).toBeNull();
    expect(within(pop).getAllByRole("radiogroup")).toHaveLength(1);

    // A rung applies on the spot and returns to the pill.
    const rung = cells()[7]!;
    const hex = colourOf(rung);
    fireEvent.click(rung);
    expect(screen.queryByTestId("mini-pop")).toBeNull();
    expect(screen.getByTestId("canvas-dock")).toHaveAttribute("data-color", hex);
  });

  it("gives 3–5 the same twelve cells, with no label and no text", async () => {
    mount("theo");
    await hold(door("Cor atual"));
    const pop = screen.getByTestId("mini-pop-color");

    // The same row, number for number: nothing shrinks and nothing is dropped.
    // 6 · 44 + 5 · 8 = 304dp, the only account that fits six columns at 360 —
    // the old 6 × 52 row needed 352 and overflowed.
    expect(cells()).toHaveLength(12);
    expect(ladder().getAttribute("data-columns")).toBe("6");
    expect(ladder().getAttribute("data-rows")).toBe("2");
    expect(ladder().getAttribute("data-cell")).toBe("44");
    expect(ladder().getAttribute("data-gap")).toBe("8");
    expect(ladder().getAttribute("data-width")).toBe("304");
    expect(ladder().getAttribute("data-label-band")).toBeNull();
    for (const cell of cells()) {
      expect(cell.style.width).toBe("44px");
      expect(cell.style.height).toBe("44px");
      // One child, the swatch: there is no label band on any band.
      expect(cell.children).toHaveLength(1);
    }

    // White first, black last — read from what is painted, since this band
    // carries no hex in the DOM.
    const hexes = cells().map(colourOf);
    expect(hexes[0]).toBe("#FFFFFF");
    expect(hexes.at(-1)).toBe("#000000");
    expect(new Set(hexes.slice(1, -1)).size).toBe(10);

    // Reading-zero: no hex attribute, no step, no text anywhere in the pop.
    expect(pop.querySelector("[data-hex]")).toBeNull();
    expect(pop.querySelector("[data-step]")).toBeNull();
    expect(pop.textContent?.trim() ?? "").toBe("");
    expect(pop.textContent).not.toMatch(/\d/);
    for (const node of pop.querySelectorAll("[aria-label]")) {
      expect(node.getAttribute("aria-label")).not.toMatch(/#[0-9a-f]{3}|HEX/i);
    }

    // A cell still applies on the spot.
    fireEvent.click(cells().at(-1)!);
    expect(screen.getByTestId("canvas-dock")).toHaveAttribute("data-color", "#000000");
  });

  it("runs the ten rungs on the ladder's own lightness, on both bands", async () => {
    // A worked example, not a recalculated one: white in the hand leaves every
    // rung a grey at the published 96…26 steps, on 9+ and on 3–5.
    for (const profileId of ["maria", "theo"] as const) {
      mount(profileId);
      await withWhiteInHand(profileId);
      const middle = cells().map(colourOf).slice(1, -1);
      expect(middle, profileId).toEqual(GREYS);
      // The ends did not move with the ramp.
      expect(colourOf(cells()[0]!)).toBe("#FFFFFF");
      expect(colourOf(cells().at(-1)!)).toBe("#000000");
      cleanup();
      localStorage.clear();
    }
  });
});

describe("one pop at a time", () => {
  it("closes on Escape and on a touch outside, without losing the pill", async () => {
    mount("maria");
    await hold(door("Cor atual"));
    expect(screen.getByTestId("mini-pop-color")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("mini-pop")).toBeNull();
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();

    await hold(door("Borracha"));
    expect(screen.getByTestId("mini-pop-eraser")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId("paper-view"));
    expect(screen.queryByTestId("mini-pop")).toBeNull();
  });

  it("swaps to another door's pop instead of stacking two", async () => {
    mount("maria");
    await hold(door("Borracha"));
    expect(screen.getByTestId("mini-pop-eraser")).toBeInTheDocument();
    fireEvent.pointerDown(door("Cor atual"));
    expect(screen.queryByTestId("mini-pop-eraser")).toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 520));
    });
    expect(screen.getByTestId("mini-pop-color")).toBeInTheDocument();
    expect(screen.queryByTestId("mini-pop-eraser")).toBeNull();
  });
});

describe("the colour door restores the material in hand", () => {
  it("tapping the colour after erasing goes back to the material that paints", () => {
    mount("maria");
    const before = screen.getByTestId("mini-tool").getAttribute("data-tool");
    fireEvent.click(door("Borracha"));
    expect(screen.getByTestId("mini-tool")).toHaveAttribute("data-tool", before);
    fireEvent.click(door("Cor atual"));
    expect(screen.queryByTestId("mini-pop")).toBeNull();
  });
});

// The workspace pill at the top of the canvas (owner's decision, 27/10,
// `workspace-switcher`). Seam: the TOP ROW of the canvas and what a tap on it
// does to the sheet — the pill, the two workspaces, and the piece each one keeps.
//
//   a) position     in the CENTRE slot, between the undo flank and the clear
//                   flank, with the spec's geometry (40dp, full radius, 10dp per
//                   segment, 4dp gap) and a target that grows past the drawing
//                   (48dp on 9+, 52dp on 3-5)
//   b) content      NEITHER band reads a word (owner's decision, 27/10): the two
//                   segments carry the two sheets as glyphs, `textContent` of the
//                   control is empty in both bands and the names live on
//                   `aria-label`
//   c) memory       switching keeps each workspace's own piece and reopens the
//                   one it left, undo included; a workspace with no piece opens
//                   the door the app already has (blank sheet / page chooser)
//   d) absence      a path that offers only one workspace has no pill at all
//   e) contrast     the active x idle pair is MEASURED at >= 3:1 in both bands
//   f) centre       the pill is the only flexible child of the row, between two
//                   flanks of doors. Back + the undo pair on the left and
//                   bin + paper on the right is FIVE doors — an odd count around
//                   a centre — so the pill cannot sit on the row's centre; the
//                   real deviation (24dp on 9+, 56dp on 3-5, the same at 390 and
//                   360) is measured in `chrome-top-row.test.tsx`, which owns
//                   that number, and this file only holds the slot's geometry.
//   g) fit          five 44dp doors and a 92dp pill close at 356dp of 360: the
//                   narrow phone gets the whole row with 4dp to spare.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { blankArtwork } from "@/mockup/artworks";
import { emptyHistory, push } from "@/mockup/history";
import { contrastRatio } from "@/mockup/palette";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { openTools } from "./open-panel";
import { topRowGeometry } from "./top-row";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** The screen the store says is open — the shell's canvas branch, and two stubs. */
function Screen() {
  const { state } = useStore();
  const s = state.screen;
  if (s.name === "canvas")
    return <CanvasScreen key={s.artworkId} artworkId={s.artworkId} back={s.back} />;
  if (s.name === "pages") return <span data-testid="pages-screen" />;
  return <span data-testid="other-screen" data-screen={s.name} />;
}

type Start = "draw" | "paint" | "gallery";

/**
 * Boots one profile on one sheet. "draw" is the blank sheet from the profile
 * home; "paint" is the page chosen in the chooser; "gallery" is the same page
 * opened from a card, which is the path that offers no choice at all.
 */
function Boot({ profileId, start }: { profileId: string; start: Start }) {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    if (start === "draw") {
      dispatch({ type: "createArtwork", artwork: blankArtwork(profileId, "ws-draw") });
      dispatch({
        type: "go",
        screen: { name: "canvas", artworkId: "ws-draw", back: { name: "profile" } },
      });
    }
    if (start === "paint" || start === "gallery") {
      dispatch({
        type: "createArtwork",
        artwork: {
          id: "ws-paint",
          profileId,
          pageId: "peixe",
          w: 300,
          h: 300,
          history: emptyHistory(),
          createdAt: 1,
          updatedAt: 1,
          visibility: "draft",
          publishedAt: null,
        },
      });
      dispatch({
        type: "go",
        screen: {
          name: "canvas",
          artworkId: "ws-paint",
          back:
            start === "gallery"
              ? { name: "gallery", back: { name: "profile" } }
              : { name: "pages", back: { name: "profile" } },
        },
      });
    }
  }, [dispatch, profileId, start]);
  return (
    <>
      <Screen />
      <Lab profileId={profileId} />
    </>
  );
}

/** The test's own hand: what the bucket and the page chooser do, on the CURRENT sheet. */
function Lab({ profileId }: { profileId: string }) {
  const { state, dispatch } = useStore();
  const s = state.screen;
  const art = s.name === "canvas" ? state.artworks.find((a) => a.id === s.artworkId) : undefined;
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!art) return;
          const region = art.pageId ? "mar" : "fundo";
          dispatch({
            type: "setHistory",
            id: art.id,
            history: push(art.history, { t: "fill", region, color: "#C81E1E" }),
          });
        }}
      >
        pintar de vermelho
      </button>
      <button
        type="button"
        onClick={() => {
          if (!art) return;
          const region = art.pageId ? "mar" : "fundo";
          dispatch({
            type: "setHistory",
            id: art.id,
            history: push(art.history, { t: "fill", region, color: "#1E3AC8" }),
          });
        }}
      >
        pintar de azul
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch({
            type: "createArtwork",
            artwork: {
              id: "ws-paint",
              profileId,
              pageId: "peixe",
              w: 300,
              h: 300,
              history: emptyHistory(),
              createdAt: 1,
              updatedAt: 1,
              visibility: "draft",
              publishedAt: null,
            },
          });
          dispatch({
            type: "go",
            screen: {
              name: "canvas",
              artworkId: "ws-paint",
              back: { name: "pages", back: { name: "profile" } },
            },
          });
        }}
      >
        escolher o peixe
      </button>
    </div>
  );
}

const mount = (profileId: string, start: Start) =>
  render(
    <StoreProvider>
      <Boot profileId={profileId} start={start} />
    </StoreProvider>,
  );

const pill = () => screen.getByTestId("workspace-switcher");
/** The fill the sheet is actually wearing: the region's own SVG, not the store. */
const regionFill = (region: string) =>
  screen.getByTestId("canvas").querySelector(`[data-region="${region}"]`)?.getAttribute("fill") ??
  null;

/** The band's geometry is shared with the top-row suite: `top-row.ts`. */
const rowGeometry = (width: number) => topRowGeometry(screen.getByTestId("canvas-top-band"), width);

/**
 * The two tokens the pro pill paints, read from the stylesheet itself: jsdom
 * applies no cascade, so the numbers come from the source of truth instead of a
 * table copied into the test. `--foreground` is the active surface and the idle
 * ink, `--card` is the pill's paper, `--lapis` the idle ink.
 */
function proTokens(scheme: "light" | "dark"): { ink: string; paper: string; idle: string } {
  const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  const scopes: Record<"light" | "dark", Record<string, string>> = { light: {}, dark: {} };
  let current: Record<string, string> = scopes.light;
  for (const line of css.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === ".dark," || trimmed.startsWith('[data-color-scheme="dark"]')) {
      current = scopes.dark;
    }
    const found = line.match(/^\s*(--[a-z-]+):\s*([^;]+);/);
    if (found) current[found[1]!] = found[2]!.trim();
  }
  const resolveToken = (name: string, depth = 0): string => {
    const raw = scopes[scheme][name];
    if (!raw) throw new Error(`${name} missing from the ${scheme} block`);
    const indirect = raw.match(/^var\((--[a-z-]+)\)$/);
    return indirect && depth < 4 ? resolveToken(indirect[1]!, depth + 1) : raw;
  };
  return {
    ink: resolveToken("--foreground"),
    paper: resolveToken("--card"),
    idle: resolveToken("--lapis"),
  };
}

/* ------------------------------------------------------------------ *
 * a) position — the centre slot, the spec's geometry, a target bigger  *
 * ------------------------------------------------------------------ */

describe("the pill sits in the centre of its own band", () => {
  it("9+: alone, with the spec's geometry", () => {
    mount("maria", "draw");
    const band = screen.getByTestId("canvas-top-band");
    const control = pill();

    // ONE block, ONE child: since 27/10 the band is the selector and nothing
    // else (`chrome-v2` §12.1) — no flank, no hamburger, no `Início`.
    expect(band.children).toHaveLength(1);
    expect(band.children[0]).toBe(control);
    expect(band.className).toContain("justify-center");
    expect(within(band).queryByTestId("chrome-flank-left")).toBeNull();
    expect(within(band).queryByTestId("chrome-flank-right")).toBeNull();

    // 40dp tall, full radius, 4dp between the segments.
    expect(control).toHaveClass("h-10", "rounded-full", "gap-1");
    const segments = within(control).getAllByRole("radio");
    expect(segments).toHaveLength(2);
    for (const segment of segments) {
      // 10dp of horizontal padding per segment, and the target grows 4dp above
      // and below the drawing: 40 + 4 + 4 = 48dp >= 44dp.
      expect(segment).toHaveClass("h-10", "rounded-full", "px-2.5");
      expect(segment.className).toContain("before:-inset-y-1");
    }
  });

  it("3-5: the same geometry, and a 52dp target", () => {
    mount("theo", "draw");
    const band = screen.getByTestId("canvas-top-band");
    const control = pill();

    expect(control).toHaveAttribute("data-band", "kids");
    expect(band.children).toHaveLength(1);
    expect(band.children[0]).toBe(control);
    expect(control).toHaveClass("h-10", "rounded-full", "gap-1");

    for (const segment of within(control).getAllByRole("radio")) {
      expect(segment).toHaveClass("h-10", "rounded-full", "px-2.5");
      // 40 + 6 + 6 = 52dp — the spec's floor for the child's hand.
      expect(segment.className).toContain("before:-inset-y-1.5");
    }
  });

  it("never shares a band with the panel latch or the tools", () => {
    mount("theo", "draw");
    const control = pill();
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));

    const dock = screen.getByTestId("canvas-compact");
    const latch = screen.getByTestId("chrome-panel");
    // The canvas's own controls (grade, papel) are FOLDS of the chrome since
    // `chrome-v2` §12 — never on the band, never on the pill.
    expect(screen.queryByTestId("dock-utilities")).toBeNull();
    // The latch belongs to the DRAWER (owner's report, 27/10): it hangs from the
    // bar's top edge, so it is a child of the bar — but never of the band, and
    // never of the pill. One control per band: the pill owns the top band, the
    // latch owns the drawer's top.
    expect(latch.parentElement).toBe(dock);
    expect(dock.contains(control)).toBe(false);
    expect(control.contains(latch)).toBe(false);
    // The pill stays reachable while the bar is open: it is the door back.
    expect(within(control).getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByTestId("canvas-top-band").contains(latch)).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * b) content — two drawings, not one word, in BOTH bands               *
 * ------------------------------------------------------------------ */

describe("the selector reads as two drawings in both bands", () => {
  it("9+ carries NEITHER name as a node, and still reports the sheet in hand", () => {
    mount("maria", "draw");
    const control = pill();

    // The owner's decision (27/10): the names left the control in both bands.
    // The sweep is a `textContent` of zero — not a hidden label, not a zero-width
    // space, not a `sr-only` span.
    expect(control.textContent).toBe("");
    expect(control.textContent?.trim()).toBe("");

    // The names survive as ATTRIBUTES: a screen reader still hears them, and the
    // state is still reported per option.
    expect(within(control).getByRole("radio", { name: "Desenho livre" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(within(control).getByRole("radio", { name: "Pintura" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    const glyphs = [...control.querySelectorAll("svg")];
    expect(glyphs).toHaveLength(2);
    expect(glyphs[0]!.getAttribute("data-glyph")).toBe("sheet-blank");
    expect(glyphs[1]!.getAttribute("data-glyph")).toBe("sheet-painted");
  });

  it("3-5 has NO text node at all, and two different sheets as glyphs", () => {
    mount("theo", "draw");
    const control = pill();

    // The sweep the rule asks for: not one word, not one digit.
    expect(control.textContent).toBe("");
    expect(control.textContent?.trim()).toBe("");

    // The names survive as ATTRIBUTES: a screen reader still hears them.
    expect(within(control).getByLabelText("Desenho livre")).toBeInTheDocument();
    expect(within(control).getByLabelText("Pintura")).toBeInTheDocument();

    const glyphs = [...control.querySelectorAll("svg")];
    expect(glyphs).toHaveLength(2);
    expect(glyphs[0]!.getAttribute("data-glyph")).toBe("sheet-blank");
    expect(glyphs[1]!.getAttribute("data-glyph")).toBe("sheet-painted");
    // Same outline, different paper: the difference is inside the sheet, not the
    // contour (two contours would read as two objects).
    expect(glyphs[0]!.innerHTML).not.toBe(glyphs[1]!.innerHTML);
  });

  it("draws the two sheets at the same 24dp in both bands", () => {
    for (const profileId of ["maria", "theo"] as const) {
      mount(profileId, "draw");
      for (const glyph of [...pill().querySelectorAll("svg")]) {
        expect(glyph.getAttribute("width"), profileId).toBe("24");
        expect(glyph.getAttribute("height"), profileId).toBe("24");
      }
      cleanup();
      localStorage.clear();
    }
  });
});

/* ------------------------------------------------------------------ *
 * c) memory — each workspace keeps its own piece                       *
 * ------------------------------------------------------------------ */

describe("switching keeps each workspace's piece", () => {
  it("reopens the piece it left, in both directions", () => {
    mount("maria", "draw");

    // 1. The blank sheet gets a red ground — this is the DRAW piece.
    fireEvent.click(screen.getByText("pintar de vermelho"));
    expect(regionFill("fundo")).toBe("#C81E1E");

    // 2. Painting has no piece yet, so the pill opens the door the app already
    //    has: the page chooser. No new navigation, no blank page invented.
    fireEvent.click(screen.getByTestId("workspace-option-paint"));
    expect(screen.getByTestId("pages-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas")).toBeNull();

    // 3. A page is chosen and painted blue — this is the PAINT piece.
    fireEvent.click(screen.getByText("escolher o peixe"));
    expect(pill()).toHaveAttribute("data-workspace-active", "paint");
    expect(screen.getByRole("img", { name: "Página para colorir: Peixe" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("pintar de azul"));
    expect(regionFill("mar")).toBe("#1E3AC8");

    // 4. Back to drawing: the red ground is still there, and the sheet is blank
    //    paper again — the blue page did not follow it.
    fireEvent.click(screen.getByTestId("workspace-option-draw"));
    expect(pill()).toHaveAttribute("data-workspace-active", "draw");
    expect(screen.getByRole("img", { name: "Folha em branco" })).toBeInTheDocument();
    expect(regionFill("fundo")).toBe("#C81E1E");
    expect(regionFill("mar")).toBeNull();

    // 5. And back to painting: the page comes back exactly as it was left.
    fireEvent.click(screen.getByTestId("workspace-option-paint"));
    expect(screen.getByRole("img", { name: "Página para colorir: Peixe" })).toBeInTheDocument();
    expect(regionFill("mar")).toBe("#1E3AC8");
    expect(regionFill("fundo")).toBeNull();
  });

  it("opens a BLANK sheet on the first entry into an empty draw workspace", () => {
    // The paint piece exists; drawing was never opened, so it inherits nothing.
    mount("maria", "paint");
    fireEvent.click(screen.getByText("pintar de azul"));
    expect(regionFill("mar")).toBe("#1E3AC8");

    fireEvent.click(screen.getByTestId("workspace-option-draw"));
    expect(pill()).toHaveAttribute("data-workspace-active", "draw");
    expect(screen.getByRole("img", { name: "Folha em branco" })).toBeInTheDocument();
    // Nothing from the page came along: the ground is the paper's own white.
    expect(regionFill("fundo")).toBe("#FFFFFF");
  });

  it("keeps the undo of each workspace apart", () => {
    mount("maria", "draw");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    fireEvent.click(screen.getByTestId("workspace-option-paint"));
    fireEvent.click(screen.getByText("escolher o peixe"));
    fireEvent.click(screen.getByText("pintar de azul"));

    // Come back: the draw sheet's own history is intact, so the sheet still
    // wears the red it was left with (a tarja of the paint command never
    // crosses over).
    fireEvent.click(screen.getByTestId("workspace-option-draw"));
    expect(regionFill("fundo")).toBe("#C81E1E");
  });
});

/* ------------------------------------------------------------------ *
 * d) absence — a path that offers one workspace has no pill            *
 * ------------------------------------------------------------------ */

describe("a page opened from the gallery offers no choice", () => {
  it("renders no pill at all, and gives the centre slot back to the name", () => {
    mount("maria", "gallery");
    expect(screen.queryByTestId("workspace-switcher")).toBeNull();
    // Not a dimmed copy, not a disabled ghost: the CONTROL is absent. (The sheet's
    // own doors stay drawn and inert — that is the 27/10 rule for the history,
    // not for a capability this path does not have.)
    expect(screen.getByTestId("canvas-top-band").querySelector("[aria-disabled]")).toBeNull();
    openTools();
    expect(screen.getByTestId("panel-undo")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Feito"));
    // The label that yielded the slot to the pill is back where it lives.
    expect(screen.getByTestId("canvas-title").textContent).toBe("Peixe");
    // And the sheet is the one that was opened.
    expect(screen.getByRole("img", { name: "Página para colorir: Peixe" })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * e) contrast — measured, not estimated                                *
 * ------------------------------------------------------------------ */

describe("the pair in hand x idle is >= 3:1", () => {
  it("9+: the theme's ink against the pill's paper, in both schemes", () => {
    mount("maria", "draw");
    const control = pill();
    const segments = within(control).getAllByRole("radio");
    const on = segments.find((s) => s.getAttribute("aria-checked") === "true")!;
    const off = segments.find((s) => s.getAttribute("aria-checked") === "false")!;

    // The DOM paints exactly the tokens measured below: the pill is `bg-card`,
    // the segment in hand is `bg-foreground` with `text-card`, the idle one is
    // `text-lapis` over the pill's paper.
    expect(control.className).toContain("bg-card");
    expect(on.className).toContain("bg-foreground");
    expect(on.className).toContain("text-card");
    expect(off.className).toContain("text-lapis");

    for (const scheme of ["light", "dark"] as const) {
      const { ink, paper, idle } = proTokens(scheme);
      // Registered pairs (measured on this lote, WCAG relative luminance):
      //   light #1C1B1A x #F2ECE0 → 14,62:1  · idle #5A5550 x #F2ECE0 → 6,26:1
      //   dark  #EFE7D8 x #24211C → 13,05:1  · idle #B7AE9E x #24211C → 7,30:1
      expect(contrastRatio(ink, paper), `${scheme} pill`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(idle, paper), `${scheme} idle label`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("3-5: the ink card against the paper pill, from the hexes it paints", () => {
    mount("theo", "draw");
    const control = pill();
    const segments = within(control).getAllByRole("radio");
    const on = segments.find((s) => s.getAttribute("aria-checked") === "true")!;
    const off = segments.find((s) => s.getAttribute("aria-checked") === "false")!;

    // The kid band paints fixed inks (the card language is paper on paper in
    // both schemes), and it says which ones on the DOM.
    expect(on.getAttribute("data-plate")).toBe("#1C1410");
    expect(off.getAttribute("data-plate")).toBe("#F0ECE0");
    expect(control).toHaveStyle({ backgroundColor: "#F0ECE0" });

    // Registered pair (spec §5, measured): #1C1410 x #F0ECE0 → 15,37:1.
    expect(contrastRatio(on.getAttribute("data-plate")!, off.getAttribute("data-plate")!)).toBe(
      contrastRatio("#1C1410", "#F0ECE0"),
    );
    expect(contrastRatio("#1C1410", "#F0ECE0")).toBeGreaterThanOrEqual(3);
    // The glyph in hand and the idle glyph must both read on their surface.
    expect(
      contrastRatio(on.getAttribute("data-ink")!, on.getAttribute("data-plate")!),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(off.getAttribute("data-ink")!, off.getAttribute("data-plate")!),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

/* ------------------------------------------------------------------ *
 * the band's centre: the pill ALONE, and where the undo pair went       *
 * ------------------------------------------------------------------ */

describe("the 9+ band keeps the pill in the CENTRE slot", () => {
  it("carries the pill alone: the undo pair moved INTO the sheet", () => {
    mount("maria", "draw");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    fireEvent.click(screen.getByText("pintar de azul"));

    // `chrome-v2` §12.3: the pair is no longer on the band. The band's whole
    // content is the pill's two segments, and the pair is the sheet's action bar.
    const band = screen.getByTestId("canvas-top-band");
    expect(within(band).queryByLabelText("Desfazer")).toBeNull();
    expect(within(band).queryByLabelText("Refazer")).toBeNull();
    expect(within(band).queryByLabelText("Apagar a obra")).toBeNull();
    expect(band.querySelectorAll("button")).toHaveLength(2);
    expect(Number(band.getAttribute("data-chip-count"))).toBe(2);

    // The sheet owns the pair, and it still works: two doors to the same history
    // became one, at the cost §12.3 accepted and recorded.
    openTools();
    fireEvent.click(screen.getByLabelText("Desfazer no painel"));
    expect(regionFill("fundo")).toBe("#C81E1E");
    expect(screen.getByLabelText("Refazer no painel")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Refazer no painel"));
    expect(regionFill("fundo")).toBe("#1E3AC8");
    fireEvent.click(screen.getByLabelText("Feito"));
  });

  it("fits the narrow 360dp phone with the pill and nothing beside it", () => {
    mount("maria", "draw");
    fireEvent.click(screen.getByText("pintar de vermelho"));

    // The band's own width: 12 + 92 + 12 = 116. No flank left to weigh on the
    // centre, so the air is the same on both sides at every width.
    for (const width of [390, 360] as const) {
      const geo = rowGeometry(width);
      expect(geo.children, `${width}dp`).toBe(1);
      expect(geo.contentW, `${width}dp`).toBe(92);
      // The pill is centred on the BAND — 0dp, measured at both widths.
      expect(geo.offset, `${width}dp`).toBe(0);
      expect(geo.air, `${width}dp`).toBe((width - 24 - 92) / 2);
    }
    expect(rowGeometry(360).air).toBe(122);
    expect(rowGeometry(390).air).toBe(137);
  });

  it("declares 92dp of pill: two 44dp segments and the 4dp gap", () => {
    mount("maria", "draw");
    const control = pill();
    // The number the geometry declares: 2 × (24 glyph + 2 × 10 padding) + 4 gap.
    // 178,22 was the two names with Geist; 92 is two 44dp doors — the same unit
    // as every other target of the chrome, and 8dp less than the old 100.
    expect(control).toHaveAttribute("data-width", "92");
    expect(Number(control.getAttribute("data-width"))).toBe(92);
    for (const segment of within(control).getAllByRole("radio")) {
      // 24dp glyph + 2 × 10dp = 44dp wide: the band's floor, per segment.
      expect(segment).toHaveClass("px-2.5");
      expect(segment.querySelector("svg")!.getAttribute("width")).toBe("24");
    }

    // `Início` is NOT a block of this band: it is the bottom band's first
    // target — and it is the clear gesture now — on the same 44dp plate.
    expect(screen.getByTestId("chrome-back").className).toContain("w-11");
    expect(screen.getByTestId("canvas-top-band").className).toContain("p-3");
    // The wrapper pays no padding of its own: the pill keeps its air in full.
    expect(control.parentElement!.className).not.toContain("px-1");
  });

  it("3-5: the same pill on the band, and the pair one level down in the bar", () => {
    mount("theo", "draw");
    const band = screen.getByTestId("canvas-top-band");
    fireEvent.click(screen.getByText("pintar de vermelho"));

    // The child's band is the same shape as 9+: the pill and nothing else.
    expect(within(band).queryByLabelText("Desfazer")).toBeNull();
    expect(within(band).queryByLabelText("Refazer")).toBeNull();
    expect(band.querySelectorAll("button")).toHaveLength(2);
    expect(Number(band.getAttribute("data-chip-count"))).toBe(2);

    // `Início` left the band on the same day, at the child's floor.
    const back = screen.getByTestId("chrome-back");
    expect(back.className).toContain("w-13");
    expect(back.className).toContain("h-13");

    // The pair lives in the compact preview row, right of the stroke preview.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const row = screen.getByTestId("compact-preview-row");
    for (const label of ["Desfazer", "Refazer"]) {
      const target = within(row).getByLabelText(label);
      expect(target.className).toContain("w-13");
      expect(target.className).toContain("h-13");
    }

    // Two commands, one undone — in the row, at 52dp.
    fireEvent.click(screen.getByText("pintar de azul"));
    fireEvent.click(within(row).getByLabelText("Desfazer"));
    expect(regionFill("fundo")).toBe("#C81E1E");
    // The band did not grow because the pair moved: still 116dp at 360.
    expect(rowGeometry(360).contentW).toBe(92);
    expect(rowGeometry(360).offset).toBe(0);
  });

  it("keeps the pill's width stable when the sheet changes", () => {
    // Both drawings are always mounted: only the SURFACE flips, so the control
    // never re-measures under the finger that just tapped it.
    const glyphs = () =>
      [...pill().querySelectorAll('[role="radio"]')].map((s) =>
        s.querySelector("svg")!.getAttribute("data-glyph"),
      );
    mount("maria", "draw");
    const before = glyphs();
    fireEvent.click(screen.getByTestId("workspace-option-paint"));
    fireEvent.click(screen.getByText("escolher o peixe"));
    expect(glyphs()).toEqual(before);
    expect(before).toEqual(["sheet-blank", "sheet-painted"]);
    expect(pill()).toHaveAttribute("data-workspace-active", "paint");
    expect(pill()).toHaveAttribute("data-width", "92");
  });
});

/* ------------------------------------------------------------------ *
 * the sheet in hand is the state, never the last pick                  *
 * ------------------------------------------------------------------ */
describe("the pill reports the sheet that is open", () => {
  it("is 'paint' on a page opened from the chooser, without a pick first", () => {
    mount("maria", "paint");
    expect(pill()).toHaveAttribute("data-workspace-active", "paint");
    // Still zero text, in every band: the state is the surface and the name.
    expect(pill().textContent).toBe("");
    const on = within(pill())
      .getAllByRole("radio")
      .find((s) => s.getAttribute("aria-checked") === "true")!;
    expect(on).toHaveAccessibleName("Pintura");
  });

  it("is 'draw' on a blank sheet, even after the page was the last thing open", () => {
    mount("maria", "draw");
    fireEvent.click(screen.getByTestId("workspace-option-paint"));
    fireEvent.click(screen.getByText("escolher o peixe"));
    expect(pill()).toHaveAttribute("data-workspace-active", "paint");

    fireEvent.click(screen.getByTestId("workspace-option-draw"));
    expect(pill()).toHaveAttribute("data-workspace-active", "draw");
  });
});

/* the sheet's own accessible name is what tells the two apart */
describe("the two sheets are told apart by their own name", () => {
  it("blank sheet and coloring page keep their own labels", () => {
    mount("maria", "draw");
    expect(screen.getByRole("img", { name: "Folha em branco" })).toBeInTheDocument();
    expect(screen.getByTestId("canvas").querySelector(`[data-region="fundo"]`)).not.toBeNull();
  });
});

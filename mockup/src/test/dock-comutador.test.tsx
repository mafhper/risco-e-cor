// The dock's level switch (owner's decision, 27/10, `compacta-unificada` §12.7,
// revised the same day on the owner's report — TWICE, and the second revision is
// this file's contract).
//
// First the bar inside the sheet was rejected: a 32 × 4dp handle is decoration,
// it does not imply an action, so the switch became a CIRCLE WITH A GLYPH. Then
// the circle floating over the desk at the frame's top-right was rejected too:
// it sat ~240dp away from the panel it opens and read as one more desk tool.
//
// Seam: WHERE the switch lives and the level it leaves behind.
//
//   seat     → a CHILD of the drawer's top edge, centred on it, glued to its
//              border (`bottom-full`): compact → sheet on 9+, sheet → compact,
//              bar → pill on 3–5. 44dp on 9+ / 52dp on 3–5
//   bound    → the drawer sits in a band that starts `row's band + 8dp` from the
//              top, and the expanded sheet reserves the HUD row + the band's gap
//              inside it: the latch is at least 8dp below the workspace selector
//              at ANY frame height — the reason the sheet is not capped in `dvh`
//              anymore (dvh follows the WINDOW, not this mockup's frame)
//   mini     → the latch is NOT drawn: the pill already carries its own door
//   handle   → ZERO left: no sheet handle, no bar, no glyph-less target
//   Escape   → one level per keystroke: expanded → compact → mini, never two
//   memory   → the level survives leaving and re-entering the profile, by
//              profile id, for the session (`store.dockLevels`)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { HUD_DOCK_GAP } from "@/mockup/hud";
import { doorSize, latchIsCentred, latchIsGlued } from "./top-row";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** The frame the drawer is pinned to, in dp — the widest phone the suite uses. */
const FRAME_W = 390;
/** The bar that opened the panel, the door that changes its level. */
const OPEN_BAR = "Abrir barra de ferramentas";
const OPEN_PANEL = "Abrir painel de ferramentas";
const CLOSE_PANEL = "Fechar painel";
/** The two declared row sizes, in dp: 9+ and 3-5 (`CHROME_TARGET`). */
const DOOR = { pro: 44, kid: 52 };
/** The air every floating control keeps from the row's band, in dp. */
const FLOAT_GAP = 8;

function Harness({
  profileId,
  pageId,
  mounted = true,
}: {
  profileId: string;
  pageId: string | null;
  mounted?: boolean;
}) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art || !mounted) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

function mount(profileId = "maria", pageId: string | null = "peixe") {
  return render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} />
    </StoreProvider>,
  );
}

function openCompact(profileId = "maria", pageId: string | null = "peixe") {
  mount(profileId, pageId);
  fireEvent.click(screen.getByLabelText(OPEN_BAR));
  return screen.getByTestId("canvas-compact");
}

const door = () => screen.getByTestId("chrome-panel");
const band = () => screen.getByTestId("canvas-hud-band");
/** The number the screen declares, never a copy of it. */
const dockTop = () => Number(band().getAttribute("data-dock-top"));

describe("the latch is a child of the drawer's top edge", () => {
  it("is NOT drawn on the pill — the pill already carries its own door", () => {
    mount();
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
    expect(screen.queryByTestId("chrome-panel")).toBeNull();
    expect(screen.queryByLabelText(OPEN_PANEL)).toBeNull();
  });

  it("9+: 44dp, centred on the bar and glued to its top edge", () => {
    const compact = openCompact();
    const latch = door();

    // A CHILD of the drawer (owner's report: it was 240dp away, floating over
    // the desk), and the drawer is its containing block.
    expect(latch.parentElement).toBe(compact);
    expect(compact.contains(latch)).toBe(true);
    expect(compact.className).toContain("relative");

    // Glued and centred: the bottom of the box on the top edge, the centre of
    // the box on the drawer's centre line — in both levels, at any width.
    expect(latchIsGlued(latch)).toBe(true);
    expect(latchIsCentred(latch)).toBe(true);
    expect(doorSize(latch)).toBe(DOOR.pro);
    expect(latch).toHaveClass("w-11", "h-11");
    expect(latch).toHaveAttribute("data-seat", "dock-top");

    // It costs the bar zero dp: the latch is OUTSIDE the box (`bottom-full`), so
    // the bar's own gutter is exactly what it was — nothing is squeezed to make
    // room for a control that hangs off the edge.
    expect(compact.className).toContain("pt-4");
    expect(compact.className).toContain("pb-4");

    // Still not a control of the top band, and not one of the drawer's own
    // utilities either: the latch changes the LEVEL, and the canvas's own look
    // controls are folds of the sheet (`chrome-v2` §12, 27/10).
    expect(screen.getByTestId("canvas-top-band").contains(latch)).toBe(false);
    expect(screen.getByTestId("canvas-band").contains(latch)).toBe(false);
  });

  it("draws a panel glyph — never an arrow — and carries no word", () => {
    openCompact();
    const glyph = door().querySelector("svg");
    expect(glyph).not.toBeNull();
    expect(glyph!.getAttribute("data-glyph")).toBe("panel");
    // The arrow the old double chevron drew is not on this door, and neither is
    // any other pointer to a direction: it is a panel that opens.
    expect(door().querySelector('[data-glyph="home"]')).toBeNull();
    expect(door().textContent?.trim() ?? "").toBe("");
  });

  it("9+: opens the sheet and TRAVELS with it, aria-expanded following", () => {
    const compact = openCompact();

    // A switch, not a one-way door: compact is closed, and the region it names
    // is the bar that is on screen.
    expect(door()).toHaveAttribute("aria-expanded", "false");
    expect(door()).toHaveAttribute("aria-controls", "canvas-dock-region");
    expect(document.getElementById("canvas-dock-region")).toBe(compact);

    fireEvent.click(door());
    const panel = screen.getByTestId("canvas-panel");

    // The SAME control, seated on the OTHER drawer it opened: the seat follows
    // the level, which is exactly what "colada no painel" means.
    expect(panel.contains(door())).toBe(true);
    expect(door().parentElement).toBe(panel);
    expect(panel.className).toContain("relative");
    expect(latchIsGlued(door())).toBe(true);
    expect(latchIsCentred(door())).toBe(true);
    expect(screen.getByLabelText(CLOSE_PANEL)).toBe(door());
    expect(door()).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("canvas-dock-region")).toBe(panel);

    // And back: sheet → bar, one tap, and the latch comes home with the bar.
    fireEvent.click(door());
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(door()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText(OPEN_PANEL)).toBe(door());
    expect(door().parentElement).toBe(screen.getByTestId("canvas-compact"));
  });

  it("3-5: 52dp, glued to the bar, and it opens the second level (the look folds)", () => {
    const compact = openCompact("theo", "foguete");
    const latch = door();

    expect(latch.parentElement).toBe(compact);
    expect(latchIsGlued(latch)).toBe(true);
    expect(latchIsCentred(latch)).toBe(true);
    expect(doorSize(latch)).toBe(DOOR.kid);
    expect(door()).toHaveClass("w-13", "h-13");

    // The second level of the intermediate panel is where the two look folds
    // live on 3–5 (`chrome-v2` §4), so this door's "up" is that level — and it
    // names it, exactly like the pro latch names the sheet.
    expect(door()).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText(OPEN_PANEL)).toBe(door());
    expect(compact.textContent?.trim() ?? "").toBe("");

    fireEvent.click(door());
    const look = screen.getByTestId("kids-look");
    expect(look).toHaveAttribute("aria-label", "Aparência");
    // One level down: the same door, seated on the level it opened.
    fireEvent.click(door());
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("kids-look")).toBeNull();
    expect(door()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("the drawer is bounded at the top, so it never reaches the row", () => {
  it("packs the drawer against the stage's own top edge, in both bands", () => {
    mount("maria");
    // Since `chrome-v2` §12.3 the band IS the stage: the row that used to bound
    // it left the stage, so the zone declares 0 and packs its children at the
    // bottom. There is no `top: 76px` left to drift.
    expect(dockTop()).toBe(0);
    expect(band().className).toContain("inset-0");
    expect(band().className).toContain("justify-end");
    cleanup();
    localStorage.clear();

    mount("theo", "foguete");
    expect(dockTop()).toBe(0);
    cleanup();
  });

  it("9+: the sheet reserves the latch + 8dp, and stops under it", () => {
    openCompact();
    fireEvent.click(door());
    const panel = screen.getByTestId("canvas-panel");

    // What the sheet reserves above itself: the LATCH it hangs off its own top
    // edge plus the 8dp of air every floating control keeps. It used to reserve
    // a HUD row as well; since 27/10 the zoom and the grid live INSIDE the sheet,
    // so the reservation is exactly what the latch needs (`sheetReserveOf`).
    const reserve = Number(panel.parentElement!.getAttribute("data-sheet-reserve"));
    expect(reserve).toBe(DOOR.pro + FLOAT_GAP);
    // …and that reservation is the sheet's own `max-height`, so the box cannot
    // grow past it however tall the frame is. `100%` is the band, whose top is the
    // stage's top — a number, not an auto height — the whole reason the guarantee
    // holds.
    expect(panel.parentElement!.style.maxHeight).toBe(`calc(100% - ${reserve}px)`);
    // The scroll body is what gives way when the cap binds.
    const body = screen.getByTestId("sheet-scroll");
    expect(body.className).toContain("min-h-0");
    expect(body.className).toContain("flex-auto");
    expect(body.className).toContain("overflow-y-auto");

    // The arithmetic the owner asked for: the HIGHEST the sheet's top edge can
    // ever be is `reserve` below the stage's top (the band packs the sheet at its
    // bottom). The latch hangs its own height above that, landing 8dp under the
    // edge — and the stage itself starts under the top band, so no frame height
    // can put the sheet over the selector.
    const sheetTopAtCap = dockTop() + reserve;
    const latchTopAtCap = sheetTopAtCap - doorSize(door());
    expect([dockTop(), reserve, sheetTopAtCap, latchTopAtCap]).toEqual([0, 52, 52, 8]);
    expect(latchTopAtCap).toBe(FLOAT_GAP);
    expect(latchIsGlued(door())).toBe(true);

    // No `dvh` in the bound: the unit follows the WINDOW, and inside a mockup
    // frame of 844dp on a tall monitor it made the sheet taller than the screen.
    expect(panel.parentElement!.className).not.toMatch(/max-h-\[/);
  });

  it("3-5: the same rule at the kid door — 52 + 8", () => {
    openCompact("theo", "foguete");
    fireEvent.click(screen.getByTestId("compact-look"));
    const look = screen.getByTestId("kids-look");
    const reserve = Number(look.parentElement!.getAttribute("data-sheet-reserve"));
    expect(reserve).toBe(DOOR.kid + FLOAT_GAP);
    expect(look.parentElement!.style.maxHeight).toBe(`calc(100% - ${reserve}px)`);
  });

  it("keeps the latch above the scrim, so the tap lands on the door", () => {
    openCompact();
    fireEvent.click(door());
    // The scrim's job is to close the panel; the latch's is to change its level.
    // A door under the scrim would hand every tap to the scrim.
    expect(screen.getByTestId("dock-scrim").className).toContain("z-[25]");
    expect(band().className).toContain("z-30");
    expect(door().className).toContain("z-[26]");
    // Structurally: the latch is INSIDE the band that rides above the scrim, so
    // no stacking order can put the scrim over it. The pixel proof (a real
    // click on the centre of the button) is the browser pass.
    expect(band().contains(door())).toBe(true);
    // And the click it receives is its own: it opens/closes, never the scrim.
    fireEvent.click(door());
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
  });
});

describe("no handle is left inside the panels", () => {
  it("the bar and the sheet carry no bar, no handle row, no glyph-less target", () => {
    const compact = openCompact();

    // The old contract, element by element: the 32 × 4dp bar, its invisible
    // box and its centred row are gone from the DOM — not renamed.
    expect(within(compact).queryByTestId("dock-handle")).toBeNull();
    expect(within(compact).queryByTestId("dock-handle-bar")).toBeNull();
    expect(within(compact).queryByTestId("dock-handle-row")).toBeNull();
    expect(compact.querySelector("[data-bar-width]")).toBeNull();
    expect(compact.querySelector("[data-bar-height]")).toBeNull();
    // Not one bar-shaped drawing anywhere on the screen, in either level.
    expect(document.querySelector("[data-bar-width]")).toBeNull();

    fireEvent.click(door());
    const panel = screen.getByTestId("canvas-panel");

    expect(within(panel).queryByTestId("dock-handle")).toBeNull();
    expect(within(panel).queryByTestId("dock-handle-bar")).toBeNull();
    expect(within(panel).queryByTestId("dock-handle-row")).toBeNull();
    expect(panel.querySelector("[data-bar-width]")).toBeNull();
    // The sheet starts with its CONTENT: no centred bar above it. The one
    // control on its top edge is the latch, and it is a button with a glyph.
    const first = panel.firstElementChild as HTMLElement;
    expect(first.querySelector('[data-testid="dock-handle"]')).toBeNull();
    expect(first.querySelector("[data-bar-width]")).toBeNull();
    expect(panel.querySelector('[data-testid="chrome-panel"] svg')).not.toBeNull();
    // And the whole document keeps zero handles, on both levels at once.
    expect(document.querySelectorAll("[data-bar-width]")).toHaveLength(0);

    // Zero trace of the old bar's name: the test ids are gone, not just the
    // drawing.
    expect(document.body.innerHTML).not.toContain("dock-handle");
  });
});

describe("Escape goes down one level at a time", () => {
  it("sheet → bar → pill, never two levels in one keystroke", () => {
    openCompact();
    fireEvent.click(door());
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    // The pill carries no latch: the level it opens is its own.
    expect(screen.queryByTestId("chrome-panel")).toBeNull();
  });
});

describe("the level is remembered per profile, for the session", () => {
  it("returns to the bar after the profile is closed and reopened", () => {
    function Door() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen((value) => !value)}>
            alternar
          </button>
          <Harness profileId="maria" pageId="peixe" mounted={open} />
        </>
      );
    }
    render(
      <StoreProvider>
        <Door />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText(OPEN_BAR));
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();

    // Leave the profile (the canvas unmounts) and come back: the store kept the
    // level, so the bar is already there — no pill tap needed.
    fireEvent.click(screen.getByText("alternar"));
    expect(screen.queryByTestId("canvas")).toBeNull();
    fireEvent.click(screen.getByText("alternar"));
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-dock")).toBeNull();
  });

  it("remembers the sheet, and never lends one profile's level to another", () => {
    /** One session: both profiles, one canvas at a time, the same store. */
    function Session() {
      const { state, dispatch } = useStore();
      const [id, setId] = useState<"maria" | "theo">("maria");
      const [open, setOpen] = useState(true);
      useEffect(() => {
        if (state.profileId !== id) dispatch({ type: "selectProfile", id });
      }, [id, state.profileId, dispatch]);
      const pageId = id === "maria" ? "peixe" : "foguete";
      const art = state.artworks.find((a) => a.profileId === id && a.pageId === pageId);
      return (
        <>
          <button type="button" onClick={() => setOpen((value) => !value)}>
            alternar
          </button>
          <button type="button" onClick={() => setId("maria")}>
            maria
          </button>
          <button type="button" onClick={() => setId("theo")}>
            theo
          </button>
          {open && art ? <CanvasScreen artworkId={art.id} back={{ name: "home" }} /> : null}
        </>
      );
    }
    render(
      <StoreProvider>
        <Session />
      </StoreProvider>,
    );

    fireEvent.click(screen.getByLabelText(OPEN_BAR));
    fireEvent.click(door());
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();

    // Leaving and returning keeps the sheet.
    fireEvent.click(screen.getByText("alternar"));
    fireEvent.click(screen.getByText("alternar"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();

    // Theo has his own level: the pill, because he never opened anything.
    fireEvent.click(screen.getByText("theo"));
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();

    // Maria's sheet is still hers.
    fireEvent.click(screen.getByText("maria"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
  });
});

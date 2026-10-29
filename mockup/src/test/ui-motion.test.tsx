// Seams, one per rule of the better-ui batch. Each assertion is a literal from
// the spec (or a computed relation: outer = inner + padding), never a mirror of
// the implementation.
//
// 1. theme switch: transitions suppressed for the swap, restored on the next frame
// 2. overlay presence: subtle exit pair, skip enter on first mount, reduced motion
// 3. icon swap: canonical opacity/scale/blur values, no animation on mount
// 4. geometry: concentric kids radius, one edge per node, token values
// 5. motion discipline: named properties, <=150ms feedback, press scale 0.96
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/mockup/AppShell";
import { StoreProvider, useStore } from "@/mockup/store";
import { KidsHome } from "@/mockup/screens/KidsHome";
import { SetupScreen } from "@/mockup/screens/SetupScreen";
import { IconSwap, RoundButton } from "@/mockup/ui";
import { MOTION, ICON_SWAP, STROKE } from "@/mockup/motion";
import { Sheet } from "@/mockup/overlay";
import {
  SUPPRESS_STYLE_ID,
  suppressTransitionsNow,
  useThemeSwapSuppress,
} from "@/mockup/themeSwitch";

const ROOT = process.cwd();
const MOCKUP = path.join(ROOT, "src", "mockup");
const STYLES = path.join(ROOT, "src", "styles.css");

/** Illustration files draw artwork, not UI glyphs: their strokes are data. */
const STROKE_EXEMPT_DIRS = ["avatars", "frames", "heroes"];
const STROKE_EXEMPT_FILES = ["ArtworkSvg.tsx", "BrushShelf.tsx", "GateScreen.tsx"];

function mockupFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (STROKE_EXEMPT_DIRS.includes(entry.name) || entry.name === "node_modules") continue;
        walk(full);
      } else if (entry.name.endsWith(".tsx") && !STROKE_EXEMPT_FILES.includes(entry.name)) {
        files.push(full);
      }
    }
  };
  walk(MOCKUP);
  return files;
}

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function flushRafFrames(frames: FrameRequestCallback[]) {
  while (frames.length > 0) {
    const cb = frames.shift()!;
    cb(0);
  }
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/* ------------------------------------------------------------------ */
/* 1. Theme switch                                                     */
/* ------------------------------------------------------------------ */

describe("theme switch suppresses transitions", () => {
  it("injects the no-transition sheet, flushes style, drops it on the next frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });

    suppressTransitionsNow();

    const style = document.getElementById(SUPPRESS_STYLE_ID);
    expect(style).not.toBeNull();
    expect(style?.textContent).toBe("*,*::before,*::after{transition:none !important}");

    // Still in the document while the first frame runs: the new colors commit
    // under the override.
    act(() => frames.shift()!(0));
    expect(document.getElementById(SUPPRESS_STYLE_ID)).not.toBeNull();

    act(() => flushRafFrames(frames));
    expect(document.getElementById(SUPPRESS_STYLE_ID)).toBeNull();
  });

  it("does not suppress on mount, and does suppress when the scheme or theme changes", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });

    function Harness({ scheme, theme }: { scheme: string; theme: string }) {
      useThemeSwapSuppress(`${scheme}:${theme}`);
      return <p data-testid="root" data-scheme={scheme} data-theme={theme} />;
    }

    const view = render(<Harness scheme="light" theme="dinos" />);
    expect(document.getElementById(SUPPRESS_STYLE_ID)).toBeNull();

    view.rerender(<Harness scheme="dark" theme="dinos" />);
    expect(document.getElementById(SUPPRESS_STYLE_ID)).not.toBeNull();
    act(() => flushRafFrames(frames));

    view.rerender(<Harness scheme="dark" theme="heroi" />);
    expect(document.getElementById(SUPPRESS_STYLE_ID)).not.toBeNull();
    act(() => flushRafFrames(frames));
    expect(document.getElementById(SUPPRESS_STYLE_ID)).toBeNull();
  });

  it("wires the suppression into the app shell when the color scheme flips", () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });

    function Flip() {
      const { state, dispatch } = useStore();
      return (
        <button
          type="button"
          onClick={() => dispatch({ type: "updateSettings", patch: { colorScheme: "dark" } })}
        >
          flip {state.settings.colorScheme}
        </button>
      );
    }

    render(
      <StoreProvider>
        <AppShell />
        <Flip />
      </StoreProvider>,
    );

    const flip = screen.getByRole("button", { name: /flip/ });
    act(() => fireEvent.click(flip));

    expect(document.getElementById(SUPPRESS_STYLE_ID)).not.toBeNull();
    act(() => flushRafFrames(frames));
    expect(document.getElementById(SUPPRESS_STYLE_ID)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 2. Overlay presence                                                 */
/* ------------------------------------------------------------------ */

describe("sheets enter and leave with a paired motion", () => {
  it("keeps the panel mounted through a 150ms exit, then unmounts", () => {
    vi.useFakeTimers();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet open={open} onClose={() => setOpen(false)} label="Teste" testid="test-sheet" initial>
          <p>conteúdo</p>
        </Sheet>
      );
    }

    render(<Host />);
    const panel = screen.getByTestId("test-sheet");
    expect(panel.className).toContain("animate-sheet-in");

    act(() => fireEvent.click(screen.getByLabelText("Fechar")));
    const leaving = screen.getByTestId("test-sheet");
    expect(leaving.className).toContain("animate-sheet-out");
    expect(leaving.getAttribute("aria-hidden")).toBe("true");

    act(() => vi.advanceTimersByTime(MOTION.sheetExit - 1));
    expect(screen.queryByTestId("test-sheet")).not.toBeNull();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("test-sheet")).toBeNull();
  });

  it("skips the enter animation on first mount (initial=false) but animates a later open", () => {
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)}>
            toggle
          </button>
          <Sheet
            open={open}
            onClose={() => setOpen(false)}
            label="Teste"
            testid="test-sheet"
            initial={false}
          >
            <p>conteúdo</p>
          </Sheet>
        </>
      );
    }

    render(<Host />);
    expect(screen.getByTestId("test-sheet").className).not.toContain("animate-sheet-in");

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("test-sheet").className).toContain("animate-sheet-in");
  });

  it("re-opening during the exit cancels the exit instead of unmounting", () => {
    vi.useFakeTimers();
    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)}>
            toggle
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} label="Teste" testid="test-sheet">
            <p>conteúdo</p>
          </Sheet>
        </>
      );
    }

    render(<Host />);
    fireEvent.click(screen.getByLabelText("Fechar"));
    expect(screen.getByTestId("test-sheet").className).toContain("animate-sheet-out");

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("test-sheet").className).toContain("animate-sheet-in");

    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByTestId("test-sheet")).not.toBeNull();
  });

  it("removes the panel immediately when reduced motion is on", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
    });

    function Host() {
      const [open, setOpen] = useState(true);
      return (
        <Sheet open={open} onClose={() => setOpen(false)} label="Teste" testid="test-sheet" initial>
          <p>conteúdo</p>
        </Sheet>
      );
    }

    render(<Host />);
    act(() => fireEvent.click(screen.getByLabelText("Fechar")));
    expect(screen.queryByTestId("test-sheet")).toBeNull();

    Object.defineProperty(window, "matchMedia", { writable: true, value: original });
  });
});

/* ------------------------------------------------------------------ */
/* 3. Icon swap                                                        */
/* ------------------------------------------------------------------ */

describe("contextual icons cross-fade", () => {
  it("uses the exact scale, blur and easing, and does not animate on mount", () => {
    render(<IconSwap on={<span data-testid="on" />} off={<span data-testid="off" />} active />);

    const wrapper = screen.getByTestId("icon-swap");
    expect(wrapper.className).not.toContain("animate-");

    const layers = screen.getAllByTestId(/icon-layer/);
    expect(layers).toHaveLength(2);
    for (const layer of layers) {
      expect(layer.className).toContain("transition-[opacity,filter,scale]");
      expect(layer.className).toContain("duration-300");
      expect(layer.className).toContain("ease-[cubic-bezier(0.2,0,0,1)]");
    }
    expect(screen.getByTestId("on").parentElement?.className).toContain("scale-100");
    expect(screen.getByTestId("off").parentElement?.className).toContain("scale-[0.25]");
    expect(screen.getByTestId("off").parentElement?.className).toContain("blur-[4px]");
    expect(screen.getByTestId("off").parentElement?.className).toContain("opacity-0");
  });

  it("toggles both layers through opacity without unmounting either", () => {
    function Host() {
      const [on, setOn] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOn((v) => !v)}>
            swap
          </button>
          <IconSwap on={<span data-testid="on" />} off={<span data-testid="off" />} active={on} />
        </>
      );
    }

    render(<Host />);
    expect(screen.getByTestId("on").parentElement?.className).toContain("opacity-0");
    fireEvent.click(screen.getByRole("button", { name: "swap" }));
    expect(screen.getByTestId("on").parentElement?.className).toContain("opacity-100");
    expect(screen.getByTestId("off")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* 4. Geometry and tokens                                              */
/* ------------------------------------------------------------------ */

describe("nested surfaces and the kids radius", () => {
  function KidsHarness() {
    const { dispatch } = useStore();
    useEffect(() => {
      dispatch({ type: "selectProfile", id: "theo" });
    }, [dispatch]);
    return KidsHome();
  }

  it("inner radius = outer radius - padding (28 - 8 = 20)", () => {
    const { container } = render(
      <StoreProvider>
        <KidsHarness />
      </StoreProvider>,
    );
    const feed = screen.getByTestId("kids-feed");
    const cards = Array.from(feed.querySelectorAll("button"));
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      const outer = /rounded-\[(\d+)px\]/.exec(card.className)?.[1];
      if (!outer) continue;
      expect(Number(outer)).toBe(28);
      const art = card.querySelector("svg")?.getAttribute("class") ?? "";
      const inner = /rounded-\[(\d+)px\]/.exec(art)?.[1];
      expect(inner).toBe("20");
    }
    expect(container.querySelector(".rounded-\\[22px\\]")).toBeNull();
  });

  it("never paints a border and the inset tile edge on the same node", () => {
    const offenders: string[] = [];
    for (const file of mockupFiles()) {
      const source = read(file);
      for (const literal of source.match(/"[^"\n]*"|`[^`]*`/g) ?? []) {
        if (!/shadow-(?:tile|press)/.test(literal)) continue;
        if (/(?:^|[\s"'`])border(?:-[^\s"'`]+)?(?:[\s"'`]|$)/.test(literal)) {
          offenders.push(`${path.relative(ROOT, file)}: ${literal.slice(0, 90)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps one edge recipe per sheet: no border-t next to the inset tile", () => {
    // The case that taught this was the retired "Mais" overlay; the rule now
    // guards every sheet that is still on screen.
    for (const file of ["BrushShelf.tsx", "CanvasScreen.tsx", "PaletteTray.tsx"]) {
      const source = read(path.join(MOCKUP, "screens", file));
      expect(source, file).not.toMatch(/border-t[^"]*shadow-tile/);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 5. Motion discipline                                                */
/* ------------------------------------------------------------------ */

describe("motion language", () => {
  it("declares the shared tokens with the spec values", () => {
    expect(MOTION.micro).toBe(150);
    expect(MOTION.icon).toBe(300);
    expect(MOTION.stagger).toBe(100);
    expect(MOTION.pressScale).toBe(0.96);
    expect(MOTION.exitShift).toBe(12);
    expect(MOTION.easeOut).toBe("cubic-bezier(0.2, 0, 0, 1)");
    expect(ICON_SWAP.scale).toBe(0.25);
    expect(ICON_SWAP.blur).toBe(4);
    expect(STROKE.regular).toBe(1.5);
    expect(STROKE.semibold).toBe(2);
  });

  it("publishes the same tokens in CSS", () => {
    const css = read(STYLES);
    expect(css).toContain("--motion-micro: 150ms");
    expect(css).toContain("--motion-icon: 300ms");
    expect(css).toContain("--motion-stagger: 100ms");
    expect(css).toContain("--sheet-exit-shift: 12px");
    expect(css).toContain("--press-scale: 0.96");
    expect(css).toContain("--ease-out-quart: cubic-bezier(0.2, 0, 0, 1)");
    expect(css).toContain("@keyframes sheet-in");
    expect(css).toContain("@keyframes sheet-out");
    expect(css).toContain("@keyframes pop-out");
    expect(css).toContain("@keyframes stagger-up");
    expect(css).toContain("@utility animate-sheet-out");
  });

  it("names the transition properties instead of animating everything", () => {
    const offenders: string[] = [];
    for (const file of mockupFiles()) {
      for (const [index, line] of read(file).split("\n").entries()) {
        if (/^\s*(\*|\/\/|\/\*)/.test(line)) continue;
        if (/(?<![\w:-])transition(?![\w:-])/.test(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${index + 1} ${line.trim().slice(0, 90)}`);
        }
        if (/transition-all/.test(line)) {
          offenders.push(`${path.relative(ROOT, file)}:${index + 1} transition-all`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never scales a press below 0.95", () => {
    const offenders: string[] = [];
    for (const file of mockupFiles()) {
      const source = read(file);
      for (const match of source.matchAll(/active:scale-\[?([0-9.]+)\]?/g)) {
        if (Number(match[1]) < 0.95) {
          offenders.push(`${path.relative(ROOT, file)}: ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("gives the round button a 0.96 press scale, with an opt-out", () => {
    const { rerender } = render(
      <RoundButton label="Ação">
        <span />
      </RoundButton>,
    );
    expect(screen.getByRole("button", { name: "Ação" }).className).toContain("active:scale-[0.96]");

    rerender(
      <RoundButton label="Ação" static>
        <span />
      </RoundButton>,
    );
    expect(screen.getByRole("button", { name: "Ação" }).className).not.toContain(
      "active:scale-[0.96]",
    );
  });

  it("maps every UI glyph stroke to the text weight scale", () => {
    const allowed = new Set(["1.5", "2", "STROKE.regular", "STROKE.semibold"]);
    const offenders: string[] = [];
    for (const file of mockupFiles()) {
      const source = read(file);
      // Data strokes (the zoom ring, the demo trace) carry dash/opacity/path
      // semantics, not glyph weight — same rule as the illustration files. The
      // window, not the tag, is what carries them: a JSX expression can contain
      // `>` and break naive tag parsing.
      for (const match of source.matchAll(/strokeWidth=(?:"([^"]+)"|\{([^}]+)\})/g)) {
        const index = match.index ?? 0;
        const window = source.slice(Math.max(0, index - 260), index + 120);
        if (/strokeDasharray|strokeOpacity|pathLength|strokeDashoffset/.test(window)) continue;
        const value = (match[1] ?? match[2] ?? "").trim();
        if (!allowed.has(value)) {
          offenders.push(`${path.relative(ROOT, file)}: strokeWidth=${value}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("staggers only the first-run choice, 100ms apart", () => {
    render(
      <StoreProvider>
        <SetupScreen />
      </StoreProvider>,
    );
    const single = screen.getByTestId("setup-single");
    const shared = screen.getByTestId("setup-shared");
    expect(single.className).toContain("animate-stagger-up");
    expect(single.style.getPropertyValue("--stagger-index")).toBe("0");
    expect(shared.style.getPropertyValue("--stagger-index")).toBe("1");

    const css = read(STYLES);
    expect(css).toMatch(/@utility animate-stagger-up[\s\S]*?var\(--motion-stagger\)/);
  });
});

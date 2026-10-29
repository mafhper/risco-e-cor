// The weak-device fallback is a DECLARED flag on the profile, never a detector
// (owner's decision, 26/10; efeitos-chevrons §7.7.6). This file measures the
// three seams that decide it, and nothing else:
//
// Seam 1 — the profile: `lowPower` is absence-first. A save written before the
// field, a backup carrying `false`, garbage and "the adult turned it off" all
// read the FULL tier, and "restore the age defaults" deletes the field instead
// of writing a default.
//
// Seam 2 — the tutor's switch: one per profile card, next to the age rules. It
// changes the tier and nothing else — no artwork, colour, tool or slot.
//
// Seam 3 — the wire from the profile to the engine: `ArtworkPaint` asks
// `paintStrokes` for the tier of the ACTIVE profile, so the number of blurred
// copies on the paper changes when (and only when) the flag does.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeCanvas } from "./fake-canvas";
import { ArtworkPaint } from "@/mockup/ArtworkPaint";
import { paintStrokes } from "@/mockup/brushCanvas";
import { exportArtwork, exportPng } from "@/mockup/exportPng";
import type { Command, StrokeCommand } from "@/mockup/history";
import { PAPERS } from "@/mockup/palette";
import { AdultScreen } from "@/mockup/screens/AdultScreen";
import { StoreProvider, normalizeProfiles, useStore, type Screen } from "@/mockup/store";

// The screen's own call is observed; the engine itself stays real, so the paper
// canvas still receives the passes and can be counted.
vi.mock("@/mockup/brushCanvas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/mockup/brushCanvas")>();
  return { ...actual, paintStrokes: vi.fn(actual.paintStrokes) };
});

const engine = vi.mocked(paintStrokes);
const HOME: Screen = { name: "home" };

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

// ---------------------------------------------------------------------------
// Seam 1: the profile field.
// ---------------------------------------------------------------------------

type Stored = Parameters<typeof normalizeProfiles>[0][number];

/** A profile as an old save writes it: no `lowPower` at all. */
const STORED: Stored = {
  id: "maria",
  name: "Maria",
  avatar: "cat",
  tone: "coral",
  age: "9+",
  themeId: "neutro",
  avatarCustom: null,
  emojiAvatar: null,
  photoUri: null,
  uiModeOverride: null,
  capsOverride: null,
  personaLine: null,
  recentColors: [],
  favoriteColors: [],
  order: 0,
  createdAt: 1,
  archived: false,
};

const cleaned = (patch: Record<string, unknown>) =>
  normalizeProfiles([{ ...STORED, ...patch } as Stored])[0]!;

describe("the flag is absence-first: no field, no fallback", () => {
  it("keeps the ABSENCE of a save written before the field existed", () => {
    const profile = cleaned({});
    // Presence, not truthiness: the store must not grow a `false` nobody chose.
    expect("lowPower" in profile).toBe(false);
  });

  it("keeps an explicit true", () => {
    expect(cleaned({ lowPower: true }).lowPower).toBe(true);
  });

  it("drops a false and anything that is not a boolean", () => {
    expect("lowPower" in cleaned({ lowPower: false })).toBe(false);
    expect("lowPower" in cleaned({ lowPower: "on" })).toBe(false);
    expect("lowPower" in cleaned({ lowPower: 1 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Seam 2: the switch in the tutor's profile editor.
// ---------------------------------------------------------------------------

function TutorHarness() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
  }, [dispatch]);
  const maria = state.profiles.find((p) => p.id === "maria");
  const theo = state.profiles.find((p) => p.id === "theo");
  const draft = state.artworks.find((a) => a.profileId === "maria" && a.pageId === null);
  return (
    <div>
      <span data-testid="flags">
        {JSON.stringify({
          maria: "lowPower" in (maria ?? {}) ? maria?.lowPower : null,
          theo: "lowPower" in (theo ?? {}) ? theo?.lowPower : null,
        })}
      </span>
      <span data-testid="memory">{JSON.stringify(maria?.toolSlots ?? null)}</span>
      <span data-testid="colors">
        {JSON.stringify([maria?.recentColors, maria?.favoriteColors])}
      </span>
      <span data-testid="artworks">{JSON.stringify(state.artworks.map((a) => a.id))}</span>
      <span data-testid="commands">{JSON.stringify(draft?.history.commands ?? null)}</span>
      <AdultScreen focus="global" back={HOME} />
    </div>
  );
}

const mountTutor = () =>
  render(
    <StoreProvider>
      <TutorHarness />
    </StoreProvider>,
  );

const SWITCH = "Efeitos mais simples neste aparelho";
const card = (name: string) => screen.getByTestId(`tutor-card-${name}`);
const openCard = (name: string) =>
  fireEvent.click(within(card(name)).getByRole("button", { name: `Ajustar ${name}` }));
const switchIn = (name: string) => within(card(name)).getByRole("switch", { name: SWITCH });

describe("the tutor's switch declares the tier, per profile", () => {
  it("exists in the profile editor, off by default", () => {
    mountTutor();
    openCard("Maria");
    expect(switchIn("Maria")).toHaveAttribute("aria-checked", "false");
    // The copy says what it does and that it is a device choice, not a skill.
    expect(within(card("Maria")).getByText(/Efeitos mais simples neste aparelho/)).toBeVisible();
    expect(within(card("Maria")).getByText(/Desligado é o padrão/)).toBeVisible();
  });

  it("writes true on the way on and restores the ABSENCE on the way off", () => {
    mountTutor();
    openCard("Maria");

    fireEvent.click(switchIn("Maria"));
    expect(switchIn("Maria")).toHaveAttribute("aria-checked", "true");
    expect(JSON.parse(screen.getByTestId("flags").textContent!)).toEqual({
      maria: true,
      theo: null,
    });

    fireEvent.click(switchIn("Maria"));
    expect(switchIn("Maria")).toHaveAttribute("aria-checked", "false");
    // Off is the absence, not a stored `false`.
    expect(JSON.parse(screen.getByTestId("flags").textContent!)).toEqual({
      maria: null,
      theo: null,
    });
  });

  it("is per profile: Maria's flag never moves Theo's card", () => {
    mountTutor();
    openCard("Maria");
    fireEvent.click(switchIn("Maria"));
    openCard("Theo");
    expect(switchIn("Theo")).toHaveAttribute("aria-checked", "false");
    openCard("Maria");
    expect(switchIn("Maria")).toHaveAttribute("aria-checked", "true");
  });

  it("touches no artwork, colour, tool or slot", () => {
    mountTutor();
    const before = {
      works: screen.getByTestId("artworks").textContent,
      commands: screen.getByTestId("commands").textContent,
      colors: screen.getByTestId("colors").textContent,
      tools: screen.getByTestId("memory").textContent,
    };
    openCard("Maria");
    fireEvent.click(switchIn("Maria"));
    fireEvent.click(switchIn("Maria"));
    fireEvent.click(switchIn("Maria"));
    expect(screen.getByTestId("artworks").textContent).toBe(before.works);
    expect(screen.getByTestId("commands").textContent).toBe(before.commands);
    expect(screen.getByTestId("colors").textContent).toBe(before.colors);
    expect(screen.getByTestId("memory").textContent).toBe(before.tools);
  });

  it("returns to the full tier on 'restore the age defaults'", () => {
    mountTutor();
    openCard("Maria");
    fireEvent.click(switchIn("Maria"));
    expect(JSON.parse(screen.getByTestId("flags").textContent!).maria).toBe(true);

    fireEvent.click(
      within(card("Maria")).getByRole("button", { name: "Restaurar padrão da idade" }),
    );
    fireEvent.click(within(card("Maria")).getByRole("button", { name: "Restaurar padrão" }));
    expect(switchIn("Maria")).toHaveAttribute("aria-checked", "false");
    expect(JSON.parse(screen.getByTestId("flags").textContent!).maria).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// Seam 3: the active profile -> the engine.
// ---------------------------------------------------------------------------

/** A stroke that asks for the most expensive passes the panel can author. */
const HEAVY: StrokeCommand = {
  t: "stroke",
  id: "heavy",
  color: "#E8423F",
  size: 10,
  points: [
    [20, 120],
    [280, 120],
  ],
  sombra: { on: true, intensity: 50, dx: 0, dy: 2, radius: 8, spread: 3 },
  brilho: { on: true, intensity: 60, radius: 12, color: "auto" },
};

function Paper({ commands }: { commands: Command[] }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
  }, [dispatch]);
  const maria = state.profiles.find((p) => p.id === "maria")!;
  return (
    <>
      <ArtworkPaint pageId={null} w={300} h={300} commands={commands} scale={2} />
      <button
        type="button"
        onClick={() => dispatch({ type: "setLowPower", id: "maria", on: maria.lowPower !== true })}
      >
        alternar
      </button>
      <output data-testid="flag">{String(maria.lowPower === true)}</output>
    </>
  );
}

const mountPaper = () =>
  render(
    <StoreProvider>
      <Paper commands={[HEAVY]} />
    </StoreProvider>,
  );

/** What the engine was asked for, in the last repaint. */
const lastOpts = () => engine.mock.calls.at(-1)![2];
const lastCommands = () => engine.mock.calls.at(-1)![1] as readonly Command[];

/**
 * How many ops each canvas had already received. The blurred copies land on the
 * adapter's SCRATCH canvases and only the composite reaches the page, so "how
 * many blurs" is a question about every recorder, sliced from a mark.
 */
const mark = () =>
  new Map([...fake.contexts.entries()].map(([canvas, rec]) => [canvas, rec.ops.length]));

const opsSince = (from: Map<HTMLCanvasElement, number>) =>
  [...fake.contexts.entries()].flatMap(([canvas, rec]) => rec.ops.slice(from.get(canvas) ?? 0));

const blurredIn = (ops: ReturnType<typeof opsSince>) =>
  ops.filter((op) => op.op === "drawImage" && op.filter !== "none");

describe("ArtworkPaint hands the active profile's tier to the engine", () => {
  it("paints on the full tier while the flag is off", () => {
    mountPaper();
    // Absent, not false: an unflagged paper hands the engine the options it
    // always did (export-parity pins the same shape).
    expect(lastOpts()?.lowPower).toBeUndefined();
    // Ring of 8 + the centre for the shadow, one copy for the glow.
    expect(blurredIn(opsSince(new Map()))).toHaveLength(10);
  });

  it("repaints the same piece with fewer, contained passes when the flag goes on", () => {
    mountPaper();
    const commandsBefore = JSON.stringify(lastCommands());
    const from = mark();

    fireEvent.click(screen.getByRole("button", { name: "alternar" }));

    expect(screen.getByTestId("flag").textContent).toBe("true");
    expect(lastOpts()).toMatchObject({ lowPower: true });
    // The artwork is untouched: same commands, same order.
    expect(JSON.stringify(lastCommands())).toBe(commandsBefore);
    const blurs = blurredIn(opsSince(from));
    expect(blurs).toHaveLength(2);
    // 4 artwork units at the paper's 2 px per unit.
    expect(blurs.every((op) => op.filter === `blur(${4 * 2}px)`)).toBe(true);
  });

  it("paints bare (full tier) outside a provider", () => {
    // A card rendered without the store keeps today's painting untouched.
    const from = mark();
    render(<ArtworkPaint pageId={null} w={300} h={300} commands={[HEAVY]} scale={2} />);
    expect(lastOpts()?.lowPower).toBeUndefined();
    expect(blurredIn(opsSince(from))).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// The file asks for the same passes as the paper (§7.8).
// ---------------------------------------------------------------------------

describe("the exported file carries the same tier as the paper", () => {
  const realToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const realClick = HTMLAnchorElement.prototype.click;

  beforeEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: () => "data:image/png;base64,AA==",
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: () => {},
    });
  });
  afterEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: realToDataURL,
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: realClick,
    });
  });

  /** The blurred copies the file's own canvases received (the page + scratches). */
  const exportWith = async (lowPower: boolean) => {
    const before = new Set(fake.contexts.keys());
    const plan = exportArtwork([HEAVY], null, 300, 300, PAPERS.linho, lowPower);
    await exportPng(plan, "efeitos.png");
    const fresh = [...fake.contexts.entries()].filter(([canvas]) => !before.has(canvas));
    const blurred = fresh.flatMap(([, rec]) =>
      rec.ops.filter((op) => op.op === "drawImage" && op.filter !== "none"),
    );
    return { plan, blurred };
  };

  it("leaves the plan without the field when the device is not flagged", async () => {
    const full = await exportWith(false);
    expect("lowPower" in full.plan).toBe(false);
    expect(full.blurred).toHaveLength(10);
  });

  it("contains the file's blur exactly like the screen when the flag is on", async () => {
    const low = await exportWith(true);
    expect(low.plan.lowPower).toBe(true);
    expect(low.blurred).toHaveLength(2);
    // 4 units at the file's 4 px per unit (1200 px side over a 300 unit sheet).
    expect(low.blurred.every((op) => op.filter === `blur(${4 * 4}px)`)).toBe(true);
  });
});

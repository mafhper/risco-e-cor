// The can's nozzle is the profile's, not the screen's (owner's call, 26/10):
// the one material whose tip the author tunes must still be tuned the next time
// that person opens the studio. The seam is profile <-> panel:
//
//   write: moving a nozzle slider lands in the profile record
//   read:  opening the canvas starts from what the profile kept
//
// A save written before the field existed has no nozzle and opens on the
// shelf's own (0.10 / 0.55 / 0.60) — the same values a stroke without `spray`
// replays with, so the panel and the engine never disagree.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openFold, openTools } from "./open-panel";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { StoreProvider, useStore } from "@/mockup/store";

const KEY = "colorir-mockup-v1";

/** The studio for one profile, entered the way the app enters it. */
function Desk({
  profileId = "maria",
  pageId = "peixe",
}: {
  profileId?: string;
  pageId?: string | null;
}) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    // The app enters a profile from the Home, i.e. after the save was read: a
    // selection made before `load` would be overwritten by it.
    if (state.loaded) dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId, state.loaded]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

const mount = (profileId?: string, pageId?: string | null) =>
  render(
    <StoreProvider>
      <Desk {...(profileId ? { profileId } : {})} {...(pageId !== undefined ? { pageId } : {})} />
    </StoreProvider>,
  );

/** What the save on the device carries for one profile. */
const storedProfile = (id: string) => {
  const raw = localStorage.getItem(KEY);
  expect(raw).toBeTruthy();
  const save = JSON.parse(raw!) as { profiles: { id: string; spray?: unknown }[] };
  const profile = save.profiles.find((p) => p.id === id);
  expect(profile).toBeTruthy();
  return profile!;
};

/** The nozzle as the panel reads it out (the label doubles as the control). */
const readout = (label: string) => screen.getByLabelText(label).getAttribute("aria-valuetext");

const pickSpray = () => {
  openTools();
  // The nozzle is a control of the Ajustes fold, which opens CLOSED (27/10).
  openFold("fold-ajustes");
  fireEvent.click(screen.getByLabelText("Spray"));
};

const slide = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

/** A save as the device writes it; only the profile list matters here. */
const saveProfiles = (profiles: Record<string, unknown>[]) =>
  localStorage.setItem(KEY, JSON.stringify({ profiles }));

/** A profile written before the nozzle existed: no `spray` field at all. */
const legacyProfile = (over: Record<string, unknown> = {}) => ({
  id: "maria",
  name: "Maria",
  avatar: "cat",
  tone: "coral",
  themeId: "dinos",
  age: "9+",
  ...over,
});

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("spray nozzle: the profile remembers it", () => {
  it("carries the tuned nozzle into the next session", () => {
    const first = mount();
    pickSpray();
    slide("Ponta", "0.18");
    slide("Dispersão", "1.1");
    slide("Intensidade", "0.9");

    // The device save is the seam: a nozzle that only lives in screen state
    // would vanish on reload, which is exactly the defect this pins.
    expect(storedProfile("maria").spray).toEqual({ tip: 0.18, spread: 1.1, intensity: 0.9 });

    first.unmount();
    mount();
    pickSpray();
    expect(readout("Ponta")).toBe("18%");
    expect(readout("Dispersão")).toBe("110%");
    expect(readout("Intensidade")).toBe("90%");
  });

  it("opens a save written before the field on the shelf's own nozzle", () => {
    saveProfiles([legacyProfile()]);
    mount();
    pickSpray();

    // 0.10 / 0.55 / 0.60 — the same nozzle a stroke without `spray` replays
    // with, so an old save cannot open on a different can than it paints with.
    expect(readout("Ponta")).toBe("10%");
    expect(readout("Dispersão")).toBe("55%");
    expect(readout("Intensidade")).toBe("60%");
    // Absent stays absent: the defaults are READ from one place, never copied
    // into the record, so there is a single definition of 0.10/0.55/0.60.
    expect(storedProfile("maria").spray).toBeUndefined();

    // Touching one axis stores all three, and the untouched ones are the
    // legacy default — never zero, never "whatever the panel happened to hold".
    slide("Ponta", "0.14");
    expect(storedProfile("maria").spray).toEqual({ tip: 0.14, spread: 0.55, intensity: 0.6 });
  });

  it("clamps a nozzle from a hand-edited save instead of trusting it", () => {
    // A backup or a hand-edited save can carry anything; the panel has bounds.
    saveProfiles([legacyProfile({ spray: { tip: 0.9, spread: -2, intensity: 7 } })]);
    mount();
    pickSpray();

    expect(readout("Ponta")).toBe("20%");
    expect(readout("Dispersão")).toBe("0%");
    expect(readout("Intensidade")).toBe("100%");
    // No out-of-range number survives in the record either: what loads is what
    // the panel can show, so the next session does not inherit the junk.
    expect(storedProfile("maria").spray).toEqual({ tip: 0.2, spread: 0, intensity: 1 });
  });

  it("never shows a nozzle to the 3-5 skin, not even one stored on it", () => {
    saveProfiles([
      legacyProfile({
        id: "theo",
        name: "Theo",
        age: "3-5",
        spray: { tip: 0.2, spread: 1, intensity: 1 },
      }),
    ]);
    mount("theo", null);

    // The studio is really on screen (not an empty tree passing by accident).
    expect(screen.getByTestId("paper-view")).toBeInTheDocument();

    // The kids studio has no sheet and no can: no control, no tool, no door.
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.queryByLabelText("Ponta")).toBeNull();
    expect(screen.queryByLabelText("Dispersão")).toBeNull();
    expect(screen.queryByLabelText("Intensidade")).toBeNull();
    expect(screen.queryByLabelText("Spray")).toBeNull();
  });
});

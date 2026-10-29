// Seam: the demonstration hand (sem-texto-3-5 F1). It is visible when the
// screen opens, and the FIRST real pointerdown fades it out — no text, no
// confirmation. The adult switch removes it everywhere.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { ProfileScreen } from "@/mockup/screens/ProfileScreen";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function ProfileHarness({ profileId, demo = true }: { profileId: string; demo?: boolean }) {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    dispatch({ type: "updateSettings", patch: { demo } });
  }, [dispatch, profileId, demo]);
  return <ProfileScreen />;
}

function CanvasHarness({ demo = true }: { demo?: boolean }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "theo" });
    dispatch({ type: "updateSettings", patch: { demo } });
  }, [dispatch, demo]);
  const art = state.artworks.find((a) => a.profileId === "theo" && a.pageId === null);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

describe("ghost hand", () => {
  it("demonstrates the kids home and disappears on the first touch", async () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="theo" />
      </StoreProvider>,
    );
    const ghost = screen.getByTestId("ghost-home");
    expect(ghost).toHaveAttribute("data-ghost", "on");

    fireEvent.pointerDown(screen.getByTestId("kids-home"), { pointerId: 1 });
    await waitFor(() => expect(screen.queryByTestId("ghost-home")).toBeNull());
  });

  it("demonstrates the empty paper and stops when the child draws", async () => {
    render(
      <StoreProvider>
        <CanvasHarness />
      </StoreProvider>,
    );
    expect(screen.getByTestId("ghost-canvas")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByTestId("paper-view").querySelector("svg")!, {
      pointerId: 1,
      clientX: 40,
      clientY: 60,
    });
    await waitFor(() => expect(screen.queryByTestId("ghost-canvas")).toBeNull());
  });

  it("obeys the adult switch: off means no demonstration at all", () => {
    render(
      <StoreProvider>
        <ProfileHarness profileId="theo" demo={false} />
      </StoreProvider>,
    );
    expect(screen.getByTestId("kids-home")).toBeInTheDocument();
    expect(screen.queryByTestId("ghost-home")).toBeNull();
  });

  it("turns the movement into three still frames under reduced motion", () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const { container } = render(
        <StoreProvider>
          <ProfileHarness profileId="theo" />
        </StoreProvider>,
      );
      expect(container.querySelectorAll("[data-demo-frame]")).toHaveLength(3);
      expect(screen.getByTestId("ghost-home")).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});

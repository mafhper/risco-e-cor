// Marca no topo do app (pedido do dono, 26/10; rebalance do lockup em 27/10).
// Seam: o header que a HOME renderiza — nome visível, o símbolo da marca e a
// proporção entre símbolo, palavra e os dois ícones de ação.
//
// The numbers here are the BRAND contract, not a reading of the code:
// - "Risco e Cor" is the canonical spelling of the art set, and the symbol is
//   never drawn below 16px (`.dev/img/brand/README.md` §"Arquivos").
// - 27/10: the wordmark went 40 -> 32 and the symbol 28 -> 36 because the pair
//   was disproportionate: the thin-line symbol had exactly the cap height of a
//   heavy 40dp wordmark, and the 20dp action icons looked starved beside it.
//   The symbol has to be LARGER than the cap: its ink is 82% of the box
//   (measured in the browser), so 36dp draws a 29.5dp circle — 1.28x the 23dp
//   cap of a 32dp wordmark. Equal heights lose; the thin stroke needs mass.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppShell } from "@/mockup/AppShell";
import { StoreProvider } from "@/mockup/store";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mountApp = () =>
  render(
    <StoreProvider>
      <AppShell />
    </StoreProvider>,
  );

describe("brand at the top of the app", () => {
  it("names the app 'Risco e Cor' on the Home, and nowhere keeps the old name", () => {
    mountApp();
    expect(screen.getByTestId("home")).toBeInTheDocument();

    const lockup = screen.getByTestId("brand-lockup");
    expect(lockup).toHaveTextContent("Risco e Cor");
    expect(screen.queryByText("Galeria de Arte")).toBeNull();
  });

  it("draws the brand mark beside the name as a decorative image, never under 16px", () => {
    mountApp();

    const mark = screen.getByTestId("brand-mark");
    // One mark, inside the lockup it belongs to.
    expect(screen.getAllByTestId("brand-mark")).toHaveLength(1);
    expect(screen.getByTestId("brand-lockup")).toContainElement(mark);

    // It is the brand asset, not a redrawn glyph; empty alt + aria-hidden keep
    // the name from being announced twice.
    expect(mark.tagName).toBe("IMG");
    expect(mark.getAttribute("src")).toMatch(/^\/brand\/.+\.svg$/);
    expect(mark).toHaveAttribute("alt", "");
    expect(mark).toHaveAttribute("aria-hidden", "true");

    // Brand floor: the solo symbol is legible from 16px up.
    expect(Number(mark.getAttribute("width"))).toBeGreaterThanOrEqual(16);
    expect(Number(mark.getAttribute("height"))).toBeGreaterThanOrEqual(16);
  });

  it("balances the lockup: 36dp symbol, 32dp wordmark, 10dp between them", () => {
    mountApp();
    const lockup = screen.getByTestId("brand-lockup");
    const mark = screen.getByTestId("brand-mark");
    const wordmark = screen.getByText("Risco e Cor");

    // Intrinsic and rendered sizes must agree, or the 512 viewBox distorts.
    expect(Number(mark.getAttribute("width"))).toBe(36);
    expect(Number(mark.getAttribute("height"))).toBe(36);
    expect(mark).toHaveClass("h-9", "w-9");

    // 32/700 in the voice, closed by `leading-none` (see voice-type.test).
    expect(wordmark).toHaveClass("text-[32px]", "font-bold", "leading-none");

    // 10dp is the gap BETWEEN BOXES; the asset carries ~9% of air per side, so
    // part of that space is the symbol's own optical margin.
    expect(lockup).toHaveClass("gap-2.5");

    // The 3dp nudge is what puts the two optical centres on the row's centre
    // (measured: the cap ink is centred 3dp above a 32dp line box): without it
    // the symbol reads 3dp low against the wordmark.
    expect(wordmark).toHaveClass("translate-y-[3px]");
  });

  it("keeps the two Home actions reachable with the brand in place, at 24dp inside 48dp targets", () => {
    mountApp();
    const search = screen.getByLabelText("Buscar no mural");
    const settings = screen.getByLabelText("Configurações gerais");
    expect(search).toBeInTheDocument();
    expect(settings).toBeInTheDocument();

    // The door stays the 48dp touch target; the glyph grows to 24dp so it is
    // not dwarfed by the 32dp wordmark beside it.
    for (const door of [search, settings]) {
      expect(door).toHaveClass("h-12", "w-12");
      const icon = door.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).toHaveClass("h-6", "w-6");
    }
  });
});

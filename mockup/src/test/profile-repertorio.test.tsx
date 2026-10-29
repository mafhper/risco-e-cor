// The profile card: identity first, ONE quiet repertoire disclosure, and a
// caption that reads as text — never hand-italic, never three chips in a row.
// Kids keep their own screen (zero functional text), so nothing here leaks to
// the 3-5 band.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppShell } from "@/mockup/AppShell";
import { personaOf } from "@/mockup/persona";
import { StoreProvider } from "@/mockup/store";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const enter = (name: string) =>
  fireEvent.click(screen.getByLabelText(`Entrar no perfil de ${name}`));

function mountProfile(name: string) {
  render(
    <StoreProvider>
      <AppShell />
    </StoreProvider>,
  );
  enter(name);
}

describe("profile card: person, not settings", () => {
  it("renders the persona as one readable line, not hand-italic", () => {
    mountProfile("Maria");
    const hero = screen.getByTestId("profile-hero");
    const line = within(hero).getByText(personaOf({ age: "9+" }).line);
    expect(line.className).not.toContain("caption-hand");
    expect(line.className).toContain("truncate");
    // The full text survives in the accessible name, so nothing is lost.
    expect(line).toHaveAttribute("title", personaOf({ age: "9+" }).line);
  });

  it("keeps the techniques behind one collapsed disclosure", () => {
    mountProfile("Maria");
    const disclosure = screen.getByRole("button", { name: /Repertório, 3 técnicas/ });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Aquarela molhada")).toBeNull();

    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Aquarela molhada")).toBeInTheDocument();
    expect(screen.getByText("Hachura")).toBeInTheDocument();
    expect(screen.getByText("Camadas")).toBeInTheDocument();
  });

  it("shows no repertoire and no persona line on the 3-5 screen", () => {
    mountProfile("Theo");
    expect(screen.queryByRole("button", { name: /Repertório/ })).toBeNull();
    expect(screen.queryByText(personaOf({ age: "3-5" }).line)).toBeNull();
  });
});

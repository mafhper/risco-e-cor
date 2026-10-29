// The theme catalog is user data: creating one in the adult area and applying
// it to a profile must survive a reload and must never touch a single artwork.
// The seam is the store + the adult identity block, not the styling.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdultScreen } from "@/mockup/screens/AdultScreen";
import { StoreProvider, useStore } from "@/mockup/store";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function AdultHarness() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "theo" });
  }, [dispatch]);
  const theo = state.profiles.find((p) => p.id === "theo");
  const pieces = state.artworks.filter((a) => a.profileId === "theo").length;
  return (
    <>
      <AdultScreen focus="profile" back={{ name: "home" }} />
      <span data-testid="theo-theme">{theo?.themeId}</span>
      <span data-testid="theo-pieces">{pieces}</span>
      <span data-testid="theme-count">{state.themes.length}</span>
      <span data-testid="theme-labels">{state.themes.map((t) => t.label).join("|")}</span>
    </>
  );
}

const mount = () =>
  render(
    <StoreProvider>
      <AdultHarness />
    </StoreProvider>,
  );

describe("theme CRUD from the adult area", () => {
  it("creates a theme from scratch, applies it to Theo and keeps his pieces", async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId("theo-theme")).toHaveTextContent("heroi"));
    const before = screen.getByTestId("theo-pieces").textContent;

    fireEvent.click(screen.getByRole("button", { name: /Novo tema/ }));
    fireEvent.change(screen.getByLabelText("Nome do novo tema"), {
      target: { value: "Jardim" },
    });
    fireEvent.click(screen.getByLabelText("Emoji 🌻"));
    fireEvent.click(screen.getByLabelText("Cor base Verde"));
    fireEvent.click(screen.getByLabelText("Criar tema"));

    // The new theme enters the picker; the catalog grew past the shipped three.
    const chip = await screen.findByLabelText("Usar tema Jardim");
    expect(Number(screen.getByTestId("theme-count").textContent)).toBe(4);

    fireEvent.click(chip);
    await waitFor(() => expect(screen.getByTestId("theo-theme").textContent).not.toBe("heroi"));
    expect(screen.getByLabelText("Usar tema Jardim")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Usar tema Herói")).toHaveAttribute("aria-pressed", "false");
    // Switching the skin never touches the gallery.
    expect(screen.getByTestId("theo-pieces").textContent).toBe(before);
    expect(before).toBe("2");
  });

  it("duplicates, renames and archives without a cap of three", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Novo tema/ }));

    // Duplicate an existing theme (from seed): the copy keeps the roles.
    fireEvent.click(screen.getByLabelText("Duplicar tema Dinossauros"));
    expect(await screen.findByLabelText("Usar tema Dinossauros 2")).toBeInTheDocument();
    expect(Number(screen.getByTestId("theme-count").textContent)).toBe(4);

    // Rename it in place.
    const input = screen.getByLabelText("Nome do tema Dinossauros 2");
    fireEvent.change(input, { target: { value: "Vale" } });
    fireEvent.blur(input);
    expect(await screen.findByLabelText("Usar tema Vale")).toBeInTheDocument();

    // Archive takes it out of the picker but not out of the app.
    fireEvent.click(screen.getByLabelText("Arquivar tema Vale"));
    await waitFor(() => expect(screen.queryByLabelText("Usar tema Vale")).toBeNull());
    expect(Number(screen.getByTestId("theme-count").textContent)).toBe(4);
    fireEvent.click(await screen.findByLabelText("Desarquivar tema Vale"));
    expect(await screen.findByLabelText("Usar tema Vale")).toBeInTheDocument();
  });

  it("persists the catalog and the chosen theme across a reload", async () => {
    const first = mount();
    fireEvent.click(screen.getByRole("button", { name: /Novo tema/ }));
    fireEvent.change(screen.getByLabelText("Nome do novo tema"), {
      target: { value: "Jardim" },
    });
    fireEvent.click(screen.getByLabelText("Criar tema"));
    fireEvent.click(await screen.findByLabelText("Usar tema Jardim"));
    await waitFor(() =>
      expect(screen.getByLabelText("Usar tema Jardim")).toHaveAttribute("aria-pressed", "true"),
    );
    const chosen = screen.getByTestId("theo-theme").textContent;
    first.unmount();

    mount();
    await waitFor(() => expect(Number(screen.getByTestId("theme-count").textContent)).toBe(4));
    expect(screen.getByTestId("theme-labels").textContent).toContain("Jardim");
    expect(screen.getByTestId("theo-theme").textContent).toBe(chosen);
    expect(screen.getByTestId("theo-pieces").textContent).toBe("2");
  });
});

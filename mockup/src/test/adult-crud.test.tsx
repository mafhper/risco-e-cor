// The family screen's CRUD and the trash, through the real UI (AdultScreen +
// store). Every refusal is asserted where the adult meets it, and every
// irreversible act goes through its confirmation.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AdultScreen } from "@/mockup/screens/AdultScreen";
import { allMuralArtworks } from "@/mockup/artworks";
import { StoreProvider, useStore, type Screen } from "@/mockup/store";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const HOME: Screen = { name: "home" };

function Harness() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
  }, [dispatch]);
  return (
    <div>
      <span data-testid="names">{state.profiles.map((p) => `${p.name}:${p.order}`).join(",")}</span>
      <span data-testid="active">
        {state.profiles
          .filter((p) => !p.archived)
          .sort((a, b) => a.order - b.order)
          .map((p) => p.name)
          .join(",")}
      </span>
      <span data-testid="count">{state.artworks.length}</span>
      <span data-testid="trash-count">{state.trash.length}</span>
      <span data-testid="mural">{allMuralArtworks(state.artworks, state.profiles).length}</span>
      <span data-testid="active-id">{String(state.profileId)}</span>
      <AdultScreen focus="global" back={HOME} />
    </div>
  );
}

const mount = () =>
  render(
    <StoreProvider>
      <Harness />
    </StoreProvider>,
  );

const activeNames = () => screen.getByTestId("active").textContent;
/** A profile's whole editor lives inside its own card: open it before reaching in. */
const openProfile = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name: `Ajustar ${name}` }));
/** Content (library, trash, backup) is its own tab, separated from settings. */
const openContent = () => fireEvent.click(screen.getByRole("tab", { name: "Conteúdo" }));
const openSettings = () => fireEvent.click(screen.getByRole("tab", { name: "Ajustes" }));
const filterStatus = (label: string) =>
  fireEvent.click(
    within(screen.getByRole("group", { name: "Filtrar por status" })).getByRole("button", {
      name: label,
    }),
  );

describe("profiles: create", () => {
  it("adds a profile at the end of the order, without entering it", () => {
    mount();
    fireEvent.click(screen.getByLabelText("Adicionar perfil"));
    fireEvent.change(screen.getByLabelText("Nome do novo perfil"), {
      target: { value: "Clara" },
    });
    fireEvent.click(
      within(screen.getByRole("group", { name: "Novo perfil" })).getByRole("button", {
        name: "6–8",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Criar perfil" }));

    expect(screen.getByTestId("names").textContent).toBe("Maria:0,Theo:1,Clara:2");
    expect(screen.getByTestId("active-id").textContent).toBe("maria");
  });

  it("refuses a repeated name without creating anything", () => {
    mount();
    fireEvent.click(screen.getByLabelText("Adicionar perfil"));
    fireEvent.change(screen.getByLabelText("Nome do novo perfil"), { target: { value: "theo" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar perfil" }));
    expect(screen.getByTestId("active").textContent).toBe("Maria,Theo");
  });
});

describe("profiles: order, copy, archive", () => {
  it("reorders with the arrows and rewrites the whole sequence", () => {
    mount();
    openProfile("Maria");
    fireEvent.click(screen.getByLabelText("Mover Maria para baixo"));
    expect(screen.getByTestId("names").textContent).toBe("Theo:0,Maria:1");
    fireEvent.click(screen.getByLabelText("Mover Maria para cima"));
    expect(screen.getByTestId("names").textContent).toBe("Maria:0,Theo:1");
  });

  it("duplicates the identity right after the original, with zero artworks", () => {
    mount();
    const before = screen.getByTestId("count").textContent;
    openProfile("Maria");
    fireEvent.click(screen.getByLabelText("Duplicar Maria"));
    expect(screen.getByTestId("names").textContent).toBe("Maria:0,Maria 2:1,Theo:2");
    expect(screen.getByTestId("count").textContent).toBe(before);
  });

  it("archives out of the Home and unarchives back to the same slot", () => {
    mount();
    openProfile("Maria");
    fireEvent.click(screen.getByLabelText("Guardar perfil Maria"));
    expect(activeNames()).toBe("Theo");
    expect(screen.getByLabelText("Desarquivar Maria")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Desarquivar Maria"));
    expect(activeNames()).toBe("Maria,Theo");
  });
});

describe("profiles: remove", () => {
  it("refuses while the gallery is not empty", () => {
    mount();
    // Theo owns two seed pieces: removal is absent, never a cascade delete.
    openProfile("Theo");
    expect(screen.queryByLabelText("Remover Theo")).toBeNull();
    expect(screen.getByText(/esvazie a galeria/)).toBeInTheDocument();
    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("also refuses while the trash still references the profile", () => {
    mount();
    // Maria's only piece leaves the gallery but stays in the trash, still
    // pointing at her — restoring it later must not find a missing profile.
    openContent();
    fireEvent.click(screen.getAllByLabelText("Mover p/ lixeira desenho de Maria")[0]!);
    expect(screen.getByTestId("trash-count").textContent).toBe("1");
    openSettings();
    openProfile("Maria");
    expect(screen.queryByLabelText("Remover Maria")).toBeNull();
    expect(screen.getByText(/esvazie a galeria/)).toBeInTheDocument();
  });

  it("removes an empty profile through its confirmation", () => {
    mount();
    fireEvent.click(screen.getByLabelText("Adicionar perfil"));
    fireEvent.change(screen.getByLabelText("Nome do novo perfil"), { target: { value: "Clara" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar perfil" }));

    openProfile("Clara");
    fireEvent.click(screen.getByLabelText("Remover Clara"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // Esc and the backdrop cancel: the safe path is the default.
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(activeNames()).toBe("Maria,Theo,Clara");

    fireEvent.click(screen.getByLabelText("Remover Clara"));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remover" }),
    );
    expect(activeNames()).toBe("Maria,Theo");
  });
});

describe("trash: reversible first, irreversible with confirmation", () => {
  it("restores a piece to its original visibility", () => {
    mount();
    openContent();
    fireEvent.click(screen.getAllByLabelText("Mover p/ lixeira desenho de Maria")[0]!);
    expect(screen.getByTestId("trash-count").textContent).toBe("1");

    filterStatus("Lixeira");

    fireEvent.click(screen.getByLabelText("Restaurar desenho de Maria"));
    expect(screen.getByTestId("trash-count").textContent).toBe("0");
  });

  it("restores a published piece back to the mural, not as a draft", () => {
    mount();
    expect(screen.getByTestId("mural").textContent).toBe("2");
    openContent();
    filterStatus("Mural");
    fireEvent.click(screen.getAllByLabelText("Mover p/ lixeira desenho de Theo")[0]!);
    expect(screen.getByTestId("mural").textContent).toBe("1");

    filterStatus("Lixeira");
    fireEvent.click(screen.getAllByLabelText("Restaurar desenho de Theo")[0]!);
    expect(screen.getByTestId("mural").textContent).toBe("2");
  });

  it("purges one piece only after the modal, and keeps the rest", () => {
    mount();
    openContent();
    fireEvent.click(screen.getAllByLabelText("Mover p/ lixeira desenho de Theo")[0]!);
    fireEvent.click(screen.getAllByLabelText("Mover p/ lixeira desenho de Theo")[0]!);
    expect(screen.getByTestId("trash-count").textContent).toBe("2");
    filterStatus("Lixeira");

    const purges = screen.getAllByLabelText("Apagar de vez o desenho de Theo");
    fireEvent.click(purges[0]!);
    expect(screen.getByText("Apagar de vez?")).toBeInTheDocument();

    // Cancel keeps the piece.
    fireEvent.click(screen.getByRole("button", { name: "Manter" }));
    expect(screen.getByTestId("trash-count").textContent).toBe("2");

    fireEvent.click(screen.getAllByLabelText("Apagar de vez o desenho de Theo")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Apagar de vez" }));
    expect(screen.getByTestId("trash-count").textContent).toBe("1");
  });

  it("empties the trash with a count in the label and one confirmation", () => {
    mount();
    openContent();
    fireEvent.click(screen.getAllByLabelText("Mover p/ lixeira desenho de Theo")[0]!);
    fireEvent.click(screen.getAllByLabelText("Mover p/ lixeira desenho de Theo")[0]!);
    filterStatus("Lixeira");

    fireEvent.click(screen.getByRole("button", { name: /Esvaziar lixeira \(2\)/ }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apagar 2" }));
    expect(screen.getByTestId("trash-count").textContent).toBe("0");
  });
});

import { fireEvent, screen } from "@testing-library/react";

/**
 * Opening the tools takes two steps since 24/10 (owner's rule): the pill opens
 * the compact bar, and the compact bar's chevron opens the full sheet. Tests
 * used to click one label and expect the sheet; this helper walks the same path
 * a hand walks, from whichever state is on screen.
 */
export function openTools() {
  const compactDoor = screen.queryByLabelText("Abrir barra de ferramentas");
  if (compactDoor) fireEvent.click(compactDoor);
  fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
}

/**
 * Opening ONE fold of the pro sheet. Since 27/10 (owner's decision) every fold
 * opens CLOSED, so a test that needs a control inside Ajustes, Cor, Sombra or
 * Brilho walks the same door a hand walks instead of assuming it is already
 * disclosed. Idempotent: a fold that is already open is left alone.
 */
export function openFold(testid: "fold-ajustes" | "fold-cor" | "fold-sombra" | "fold-brilho") {
  const header = screen.getByTestId(testid);
  if (header.getAttribute("aria-expanded") !== "true") fireEvent.click(header);
}

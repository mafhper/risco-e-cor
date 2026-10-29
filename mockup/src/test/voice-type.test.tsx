// A camada de VOZ (Baloo 2) no lote do wordmark e dos títulos. Seam: o que a
// TELA veste — wordmark e título carregam `font-voice`; rótulo, contador e
// número continuam na neutra. jsdom não aplica cascata, então o que se afirma é
// a classe (o contrato do token) e, para a fonte, o `@font-face` lido da folha.
//
// The numbers are the brand contract, not a reading of the code: wordmark 32/700
// with a closed box (rebalance of 27/10; was 40/700), screen title 24/600
// (styles.css §"A voz nunca desce de 16px"). The 48dp beside the wordmark is the
// minimum touch target, the same one `RoundButton` already honours.
import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppShell } from "@/mockup/AppShell";
import { StoreProvider } from "@/mockup/store";
import { TopBar } from "@/mockup/ui";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mountHome = () =>
  render(
    <StoreProvider>
      <AppShell />
    </StoreProvider>,
  );

describe("o wordmark é voz", () => {
  it("vai a 32/700 em Baloo 2 com a caixa fechada pelo leading-none", () => {
    mountHome();
    const wordmark = within(screen.getByTestId("brand-lockup")).getByText("Risco e Cor");

    // A família é a da VOZ, o tamanho é o do wordmark e o peso é o 700 da marca.
    expect(wordmark).toHaveClass("font-voice", "text-[32px]", "font-bold");

    // A caixa é a do glifo. Sem `leading-none` os 32px herdam o 1.5 do body e a
    // linha mede 48dp — que não cabe no topo.
    expect(wordmark).toHaveClass("leading-none");

    // E a escala de UI não manda mais no tamanho: `type-title-lg` traz 22px com
    // 1.75rem de entrelinha e brigaria com os 32px.
    expect(wordmark).not.toHaveClass("type-title-lg");
    expect(wordmark).not.toHaveClass("font-display");
  });
});

describe("o título de tela é voz", () => {
  it("vai a 24/600 em Baloo 2, e o subtítulo fica na neutra", () => {
    render(<TopBar title="Mural da família" subtitle="6 peças" />);

    const title = screen.getByText("Mural da família");
    expect(title).toHaveClass("font-voice", "type-headline-sm", "font-semibold");
    expect(title).not.toHaveClass("font-display");

    // O subtítulo é DADO: rótulo e contador não entram na voz.
    expect(screen.getByText("6 peças")).not.toHaveClass("font-voice");
  });

  it("deixa o rótulo e o contador do mural na neutra", () => {
    mountHome();
    const home = within(screen.getByTestId("home"));
    // Dois rótulos de 12dp e o contador de peças: nenhum deles é voz.
    expect(home.getByText("Mural da família")).not.toHaveClass("font-voice");
    expect(home.getByText(/^\d+ peças?$/)).not.toHaveClass("font-voice");
  });
});

describe("o @font-face continua condicional", () => {
  const face = () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    return css.match(/@font-face\s*\{[^}]*Baloo 2[^}]*\}/)?.[0] ?? "";
  };

  it("declara unicode-range e font-display: swap para baixar só quando usada", () => {
    const block = face();
    expect(block).toContain('font-family: "Baloo 2"');
    // `swap` evita texto invisível; a faixa de unicode faz o arquivo de ~176 KB
    // ser buscado só por quem rende latim — símbolo e ícone não pagam.
    expect(block).toContain("font-display: swap");
    expect(block).toContain("unicode-range");
    expect(block).toContain("U+0000-00FF");
  });
});

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  BENCH_BRUSHES,
  BENCH_HEIGHT,
  BENCH_SIZES,
  BENCH_WIDTH,
  benchPixelSize,
  paintBenchPage,
} from "@/mockup/strokeBench";

// BANCADA DE TRAÇOS — superfície de DESENVOLVIMENTO.
//
// Não é tela do produto e não é alcançável pela navegação: nenhum card, dock ou
// nota aponta para cá. Serve para olhar MATERIAL — as nove amostras da prancha
// (`strokeBench.ts`) contra as pranchas de referência — e por isso não tem
// interação, não escreve no store, não cria histórico.
//
// Em build de produção a rota existe (o mockup é publicado), mas não pinta
// nada: o `import.meta.env.DEV` abaixo é substituído por `false` no bundle, e
// quem abrir `/lab` fora do servidor de desenvolvimento vê só o aviso.
export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "Bancada de traços — desenvolvimento" },
      // Fora de índice de propósito: é bancada, não página.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LabPage,
});

function LabPage() {
  if (!import.meta.env.DEV) {
    return <main className="p-6 text-sm">Bancada de desenvolvimento: fora desta build.</main>;
  }
  return <BenchPlate />;
}

/**
 * O canvas da prancha. Pinta UMA vez, quando monta, e para: sem pointer, sem
 * listener, sem estado de React depois do primeiro efeito.
 */
function BenchPlate() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      // Sem substrato 2d não há prancha: a rota não é produto, não há degradação
      // a inventar.
      ctx = null;
    }
    if (!ctx) return;

    // O buffer é a prancha × devicePixelRatio; o CSS continua em 1400 × 760.
    const { width, height } = benchPixelSize(window.devicePixelRatio || 1);
    canvas.width = width;
    canvas.height = height;

    const painted = paintBenchPage(ctx, window.devicePixelRatio || 1);

    // Marcas de leitura para a captura por CDP (e para o teste de fumaça da
    // bancada): provam o que foi pintado sem inspecionar pixels.
    canvas.dataset["benchPainted"] = "1";
    canvas.dataset["benchRows"] = String(BENCH_BRUSHES.length);
    canvas.dataset["benchStrokes"] = String(BENCH_BRUSHES.length * BENCH_SIZES.length);
    canvas.dataset["benchDabs"] = String(painted);
  }, []);

  return (
    <main
      style={{ display: "block", width: BENCH_WIDTH, height: BENCH_HEIGHT, overflow: "hidden" }}
    >
      <canvas
        ref={canvasRef}
        // Tamanho inicial em CSS px: o efeito troca o buffer pelo tamanho de
        // dispositivo. Os atributos começam iguais ao CSS para o SSR e a
        // hidratação concordarem.
        width={BENCH_WIDTH}
        height={BENCH_HEIGHT}
        data-testid="bench-canvas"
        aria-label="Bancada de traços: nove materiais, três tamanhos cada"
        style={{ display: "block", width: BENCH_WIDTH, height: BENCH_HEIGHT }}
      />
    </main>
  );
}

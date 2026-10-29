import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  SPRAY_BENCH_HEIGHT,
  SPRAY_BENCH_INTENSITIES,
  SPRAY_BENCH_SIZES,
  SPRAY_BENCH_WIDTH,
  paintSprayBenchPage,
} from "@/mockup/strokeBench";

// BANCADA DO SPRAY — superfície de DESENVOLVIMENTO, irmã de `/lab`.
//
// A prancha dos nove materiais mostra a lata UMA vez, no bico padrão. Esta isola
// o eixo que o dono ia mexer primeiro — a Intensidade — com a Ponta e a
// Dispersão fixas, em dois tamanhos: é a captura com que se julga se o spray
// parece tinta dispersa ou pontilhismo. Como `/lab`, não é tela do produto, não
// é alcançável pela navegação, não tem interação e não escreve em nada.
//
// Em build de produção a rota existe (o mockup é publicado), mas não pinta: o
// `import.meta.env.DEV` é substituído por `false` no bundle.
export const Route = createFileRoute("/lab-spray")({
  head: () => ({
    meta: [
      { title: "Bancada do spray — desenvolvimento" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LabSprayPage,
});

function LabSprayPage() {
  if (!import.meta.env.DEV) {
    return <main className="p-6 text-sm">Bancada de desenvolvimento: fora desta build.</main>;
  }
  return <SprayPlate />;
}

/**
 * O canvas da prancha. Pinta UMA vez, quando monta, e para: sem pointer, sem
 * listener, sem estado de React depois do primeiro efeito.
 */
function SprayPlate() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(SPRAY_BENCH_WIDTH * dpr));
    canvas.height = Math.max(1, Math.round(SPRAY_BENCH_HEIGHT * dpr));

    const painted = paintSprayBenchPage(ctx, dpr);

    // As mesmas marcas de leitura da bancada: a captura por CDP espera
    // `benchPainted`, e o número de dabs é a prova de que o motor rodou.
    canvas.dataset["benchPainted"] = "1";
    canvas.dataset["benchRows"] = String(SPRAY_BENCH_INTENSITIES.length);
    canvas.dataset["benchStrokes"] = String(
      SPRAY_BENCH_INTENSITIES.length * SPRAY_BENCH_SIZES.length,
    );
    canvas.dataset["benchDabs"] = String(painted);
  }, []);

  return (
    <main
      style={{
        display: "block",
        width: SPRAY_BENCH_WIDTH,
        height: SPRAY_BENCH_HEIGHT,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        width={SPRAY_BENCH_WIDTH}
        height={SPRAY_BENCH_HEIGHT}
        data-testid="spray-canvas"
        aria-label="Bancada do spray: três intensidades em dois tamanhos"
        style={{ display: "block", width: SPRAY_BENCH_WIDTH, height: SPRAY_BENCH_HEIGHT }}
      />
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AppShell, noteKey } from "@/mockup/AppShell";
import { LATER, NOTES } from "@/mockup/notes";
import { StoreProvider, useStore } from "@/mockup/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mockup — App de Desenho e Colorir (Theo & Maria)" },
      {
        name: "description",
        content:
          "Protótipo navegável do app Android de desenho e colorir: offline, sem anúncios, sem compras.",
      },
      { property: "og:title", content: "Mockup — App de Desenho e Colorir" },
      {
        property: "og:description",
        content:
          "Protótipo navegável do app infantil de desenho e colorir, offline e sem anúncios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <StoreProvider>
      <div className="flex min-h-dvh items-center justify-center gap-12 md:desk-texture md:p-6">
        <div
          data-testid="phone"
          className="h-dvh w-full overflow-hidden md:h-[min(844px,calc(100dvh-48px))] md:w-auto md:aspect-[390/844] md:rounded-[3rem] md:border-[10px] md:border-device md:shadow-device"
        >
          <AppShell />
        </div>
        <NotesPanel />
      </div>
    </StoreProvider>
  );
}

function NotesPanel() {
  const { state } = useStore();
  const note = NOTES[noteKey(state)] ?? NOTES["home"]!;
  return (
    <aside className="hidden w-80 shrink-0 text-desk-foreground lg:block">
      <p className="text-xs font-semibold uppercase tracking-widest opacity-70">
        Mockup · revisão T2
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{note.title}</h1>
      <ul className="mt-4 space-y-2.5 text-sm leading-relaxed">
        {note.points.map((p) => (
          <li key={p} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 rounded-2xl bg-card/70 p-4 text-sm">
        <p className="font-display text-base font-medium">Fica para depois do MVP</p>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {LATER.map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-xs opacity-70">
        Tudo funciona de verdade e fica salvo neste navegador. Toque nas telas do celular.
      </p>
    </aside>
  );
}

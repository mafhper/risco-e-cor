import { useEffect, useMemo } from "react";
import { Trash2, Undo2, X } from "lucide-react";
import { uiModeOf } from "./capabilities";
import { useEscapeBack } from "./escape";
import { UNDO_MS } from "./lifecycle";
import { profileTheme, themeStyle } from "./profileThemes";
import { useStore, type Screen } from "./store";
import { useResolvedScheme } from "./theme";
import { useThemeSwapSuppress } from "./themeSwitch";
import { HomeScreen } from "./screens/HomeScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { PagesScreen } from "./screens/PagesScreen";
import { CanvasScreen } from "./screens/CanvasScreen";
import { GalleryScreen, ViewScreen } from "./screens/GalleryScreen";
import { GateScreen } from "./screens/GateScreen";
import { AdultScreen } from "./screens/AdultScreen";
import { cn } from "@/lib/utils";

/**
 * The app itself, as it would run on the phone.
 *
 * Three visual axes meet here and nowhere else (m3-temas-cor.md §1): the global
 * color scheme, the active profile's theme, and the derived ui mode. Screens
 * read the CSS variables this element sets.
 *
 * The shell also owns the one cross-screen timer: "Jogar fora" leaves a 5s
 * undo for ANY screen, because the undo lives in the shell, not in the toast
 * that happened to be on screen when the piece was dropped.
 */
export function AppShell() {
  const { state, dispatch, profile, go } = useStore();
  const scheme = useResolvedScheme(state.settings.colorScheme);
  const theme = profileTheme(profile?.themeId, state.themes);
  const mode = profile ? uiModeOf(profile) : "pro";
  const s = state.screen;
  const undoId = state.undoTrash?.id ?? null;

  // A scheme/theme flip must snap, not smear: every transition is suppressed for
  // the commit that applies the new tokens (themeSwitch.ts). The key includes the
  // resolved token values, so editing a theme's seed is covered too.
  useThemeSwapSuppress(
    `${scheme}|${theme.id}|${Object.values(themeStyle(theme, scheme)).join("|")}`,
  );

  useEffect(() => {
    if (!undoId) return;
    const timer = setTimeout(() => dispatch({ type: "dismissUndo" }), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undoId, dispatch]);

  // Escape mirrors the top-bar back button on every screen that has one — but
  // only when no sheet or dialog is open: those consume the keystroke first.
  const backScreen: Screen | null = useMemo(
    () =>
      s.name === "profile"
        ? { name: "home" }
        : s.name === "pages" || s.name === "gallery" || s.name === "view"
          ? s.back
          : null,
    [s],
  );

  useEscapeBack(backScreen ? () => go(backScreen) : null);

  if (!state.loaded) return <div className="h-full bg-background" />;

  // First run asks one question before any Home exists. The demo seed already
  // answered it, so this only shows on a truly fresh device.
  if (!state.settings.setupDone && s.name !== "setup") return <SetupScreen />;

  const needsProfile =
    (s.name === "view" && !s.readonly) ||
    ["profile", "pages", "canvas", "gallery"].includes(s.name);
  // The Home needs no active profile: it is the hub that lists them all. A
  // screen that does need one falls back to the Home instead of a dead end.
  if (needsProfile && !profile) return <HomeScreen />;

  const screen = (() => {
    // Screen changes are an INSTANT exit by decision, not an omission: the
    // single-activity mockup swaps the whole surface (as the native app does)
    // and screens have no enter animation to pair with. A retained outgoing
    // screen would duplicate store effects for 150ms for no spatial gain.
    switch (s.name) {
      case "home":
        return <HomeScreen />;
      case "setup":
        return <SetupScreen />;
      case "profile":
        return <ProfileScreen />;
      case "pages":
        return <PagesScreen back={s.back} />;
      case "canvas":
        return <CanvasScreen key={s.artworkId} artworkId={s.artworkId} back={s.back} />;
      case "gallery":
        return <GalleryScreen back={s.back} />;
      case "view":
        return <ViewScreen artworkId={s.artworkId} readonly={s.readonly ?? false} back={s.back} />;
      case "gate":
        return <GateScreen target={s.target} back={s.back} />;
      case "adult":
        return <AdultScreen focus={s.focus} back={s.back} />;
    }
  })();

  return (
    <div
      className="relative h-full bg-background text-foreground"
      data-color-scheme={scheme}
      data-theme={theme.id}
      data-ui-mode={mode}
      style={themeStyle(theme, scheme)}
    >
      {screen}
      <UndoBar />
    </div>
  );
}

/** The temporal net under "Jogar fora": visible for 5s, works while navigating. */
function UndoBar() {
  const { state, dispatch, profile } = useStore();
  const kids = profile ? uiModeOf(profile) === "kids" : false;
  if (!state.undoTrash) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="undo-bar"
      data-mode={kids ? "kids" : "pro"}
      className={cn(
        "absolute z-50 flex items-center gap-3 border border-border bg-foreground/95 text-background",
        kids
          ? "inset-x-4 bottom-4 justify-between rounded-full pl-4 pr-1.5 py-1.5"
          : "inset-x-3 bottom-3 rounded-md px-3 py-2",
      )}
    >
      {kids ? (
        <Trash2 className="h-6 w-6 shrink-0" aria-hidden />
      ) : (
        <span className="min-w-0 flex-1 text-xs">Foi para a lixeira</span>
      )}
      <button
        type="button"
        onClick={() => dispatch({ type: "restore", id: state.undoTrash!.id })}
        aria-label="Desfazer"
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-full bg-background/15 font-semibold transition-transform duration-150 ease-out active:scale-[0.96]",
          kids ? "h-14 w-14" : "h-9 px-3 text-xs",
        )}
      >
        <Undo2 className={kids ? "h-7 w-7" : "h-3.5 w-3.5"} />
        {!kids && "Desfazer"}
      </button>
      <button
        type="button"
        onClick={() => dispatch({ type: "dismissUndo" })}
        aria-label="Fechar aviso"
        className={cn(
          "flex items-center justify-center rounded-full text-background/70 transition-transform duration-150 ease-out active:scale-[0.96]",
          kids ? "h-12 w-12" : "h-8 w-8",
        )}
      >
        <X className={kids ? "h-5 w-5" : "h-4 w-4"} />
      </button>
    </div>
  );
}

export function noteKey(state: ReturnType<typeof useStore>["state"]) {
  const s = state.screen;
  if (s.name === "canvas") {
    const art = state.artworks.find((a) => a.id === s.artworkId);
    return art?.pageId ? "canvasFill" : "canvasDraw";
  }
  return s.name;
}

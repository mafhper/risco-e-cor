import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  FolderDown,
  Grid3x3,
  House,
  Minus,
  PanelBottom,
  Pencil,
  Plus,
  Redo,
  SlidersHorizontal,
  Star,
  SwatchBook,
  Trash2,
  Undo,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ArtworkPaint } from "../ArtworkPaint";
import { blankArtwork, needsSaveDecision, workspaceOf, type Workspace } from "../artworks";
import { CAP_DEFAULTS, effectiveCaps, kidTools, uiModeOf } from "../capabilities";
import {
  BRUSH_SHELF,
  brushStroke,
  isMaterial,
  isShelfTool,
  shelfBrushOf,
  type BrushKind,
  type CanvasTool,
} from "../brush";
import {
  canRedo,
  canUndo,
  derive,
  GLOW_RANGE,
  glowOf,
  nozzleOf,
  planAreaErase,
  push,
  redo,
  SHADOW_RANGE,
  shadowOf,
  SPRAY_RANGE,
  strokeHit,
  undo,
  type AreaEraseCommand,
  type AreaErasePlan,
  type Command,
  type GlowEffect,
  type History,
  type Point,
  type ShadowEffect,
  type SpraySettings,
  type StrokeCommand,
} from "../history";
import {
  BLACK,
  BRUSH_SIZES,
  COMPACT_LIGHTNESS,
  GRADIENT_ANGLES,
  GRADIENT_STOPS,
  GRID_CELL_UNITS,
  GRID_DENSITY_LABEL,
  GRID_PATTERN_LABEL,
  GRID_STRENGTH_LABEL,
  KID_COLORS,
  PAPERS,
  PAPER_HEX,
  PAPER_KEYS,
  PAPER_TEXTURE_LABEL,
  PAPER_TONE_HEX,
  PAPER_TONE_LABEL,
  PALETTE_FAMILIES,
  WHITE,
  derivedRamp,
  gradientCss,
  type GridDensity,
  type GridPattern,
  type GridStrength,
  type PaperKey,
  type PaperTexture,
  type PaperTone,
  type StrokeGradient,
} from "../palette";
import { pageById } from "../pages";
import {
  materialPlate,
  paperPlate,
  plateMaterialOf,
  plateStyle,
  type MaterialPlate,
} from "../kidsMaterials";
import { HUD_DOCK_GAP } from "../hud";
import { useEscapeOverlay } from "../escape";
import { playChime, playPop, say, vibrate } from "../feedback";
import { STROKE, useReducedMotion } from "../motion";
import { DemoHint } from "../onboarding";
import { Sheet as SheetSurface } from "../overlay";
import { useResolvedScheme } from "../theme";
import {
  gridGuideOf,
  gridLookOf,
  panelSectionsOf,
  paperLookOf,
  uid,
  useStore,
  type Artwork,
  type DockLevel,
  type GridLook,
  type Hardness,
  type PanelSectionKey,
  type PanelSections,
  type PaperLook,
  type Screen,
  type ToolMemory,
} from "../store";
import { EdgeRow } from "../edgeSelect";
import { stashOpenRect, takeOpenRect, type OpenRect } from "../sharedOpen";
import { baseTools } from "../toolbar";
import {
  applyGesture,
  FIT,
  resolveZoomAnchor,
  spanBetween,
  transformOf,
  zoomAnchored,
  type Pt,
  type Sheet,
  type Span,
  type Viewport,
} from "../viewport";
import {
  BrushShelf,
  BucketGlyph,
  MaterialGlyph,
  PlateRim,
  StrokePreview,
  ToolIcon,
  activePlate,
} from "./BrushShelf";
import {
  COLOR_CELL,
  COLOR_COLUMNS,
  COLOR_EDGE,
  COLOR_GAP,
  COLOR_ROWS,
  COLOR_ROW_WIDTH,
  CompactColor,
  CompactSpectrum,
  PaletteTray,
} from "./PaletteTray";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const SMOOTH = [1, 0.6, 0.4, 0.25];
/**
 * Row 2 is ELEVEN targets in 6 + 5 (spec §11.1): the ten tools of the profile
 * plus the "more adjustments" door that always closes the row. There is no
 * overflow door any more — nothing is hidden, so there is nothing to open, and
 * the space the chevron used to occupy went back inside the row.
 *
 * Six per line on 9+; 3-5 keeps its five materials on ONE line and never grows
 * the eleventh target (it has no tool panel to land on).
 */
const COMPACT_LINE_TOOLS = 6;
const KID_LINE_TOOLS = 5;
/**
 * The tools block's single gap, in dp (`compacta-distribuicao` §1): horizontal
 * and vertical are the same number, in both bands. It is also what makes the
 * 6-column grid true — the columns only line up between the two lines because
 * every gap in the block is identical.
 */
const TOOLS_GAP = 8;
/**
 * The preview box, in dp. A preview that shows the REAL stroke — grain, taper,
 * dust, cloud — needs the room a real band takes: 88dp holds the widest cloud at
 * the top of the range (84dp at the box's own scale) in the compact panel, and
 * 96dp does the same in the sheet's header (owner's call, 26/10).
 */
const COMPACT_PREVIEW_BOX = 88;
const SHEET_PREVIEW_BOX = 96;
/**
 * The two fixed slots of the paint row, in order (spec §7.4): the block eraser
 * comes first (it takes the stroke back, fill included), the bucket second (the
 * same door on a coloring page and on a blank sheet). Everything else keeps the
 * order the profile stored — never a history of picks (owner's call, 26/10).
 */
const PAINT_PINS: CanvasTool[] = ["eraser", "fill"];

/** Row 2's three categories, named once: a run of neighbours reads this map. */
type ToolGroupId = "fixed" | "materials" | "dropper";
const TOOL_GROUP_LABEL: Record<ToolGroupId, string> = {
  fixed: "Ferramentas fixas",
  materials: "Materiais",
  dropper: "Conta-gotas",
};
const toolGroupOf = (tool: CanvasTool): ToolGroupId =>
  PAINT_PINS.includes(tool) ? "fixed" : isShelfTool(tool) ? "materials" : "dropper";

/**
 * Row 2's categories, told by SEMANTICS only — a `role="group"` and a name, no
 * divider, no second plate and no visible label (3-5 reads zero text), and a
 * category with nothing in it leaves no ghost gap.
 *
 * A category is a RUN OF NEIGHBOURS, never a re-sort (owner's report, 27/10: the
 * compacta ignored the saved order). Filtering the pins into a group of their
 * own was what put the eraser and the bucket in front of whatever the person had
 * stored, while the sheet read the same list verbatim — two panels, two rows for
 * one profile. Sorted by run, the row keeps exactly the order it arrived in; the
 * default still lands as three tidy groups because the default IS pins-first
 * (owner's call, 26/10).
 */
function toolGroups(
  tools: CanvasTool[],
): { id: ToolGroupId; label: string; tools: CanvasTool[] }[] {
  const groups: { id: ToolGroupId; label: string; tools: CanvasTool[] }[] = [];
  for (const tool of tools) {
    const id = toolGroupOf(tool);
    const last = groups[groups.length - 1];
    if (last && last.id === id) last.tools.push(tool);
    else groups.push({ id, label: TOOL_GROUP_LABEL[id], tools: [tool] });
  }
  return groups;
}

/**
 * The DEFAULT row: the eraser, the bucket, then the band's catalog order. It is
 * what a profile with no stored list reads — once a list exists it IS the row,
 * in its own order and with no pin forced on top (owner's report, 27/10: "a
 * ordenação está sendo considerada apenas no painel amplo").
 *
 * The row is FIXED in use: it used to follow the order of picks, and a bar that
 * re-sorts itself is a bar whose first chip moves under a finger that has
 * already learned where it is (owner's call, 26/10 — the order is a preference,
 * not a history).
 */
function paintOrder(tools: CanvasTool[]): CanvasTool[] {
  const pinned = PAINT_PINS.filter((tool) => tools.includes(tool));
  return [...pinned, ...tools.filter((tool) => !PAINT_PINS.includes(tool))];
}
/**
 * The area pass as a command. The SAME object is used as the live preview while
 * the finger is down and committed on release, so the two can never disagree
 * about a span (borracha-area §6.1).
 */
function areaCommandOf(plan: AreaErasePlan, radius: number): AreaEraseCommand {
  return {
    t: "eraseArea",
    radius,
    edits: plan.edits,
    ...(plan.strokeIds.length > 0 ? { strokeIds: plan.strokeIds } : {}),
  };
}

/** Pill 150ms + scrim 300ms, then the swap (spec §4, T-save). */
const SAVE_EXIT_MS = 450;

/**
 * The workspaces the top row switches between, in the owner's own order
 * (`workspace-switcher` §4): the blank sheet first, the coloring page second.
 * The names are fixed — renaming and a third workspace are out of scope.
 */
const WORKSPACES: { id: Workspace; label: string }[] = [
  { id: "draw", label: "Desenho livre" },
  { id: "paint", label: "Pintura" },
];

/**
 * The workspace pill's geometry, in dp, and the width it therefore DECLARES.
 *
 * Both bands draw the two sheets at 24dp with 10dp of padding per segment and
 * 4dp between them: `2 × (24 + 20) + 4 = 92`. That is exactly TWO chrome
 * targets (44dp) and the row's gap, which is the point (owner's call, 27/10):
 * the pill is the only control of the row that spans two targets, and each of
 * its segments keeps the same 44dp floor as every other door — the box is 40dp
 * tall and the touch ring grows it to 48 (see `WorkspaceSwitch`).
 *
 * The number is a BUDGET, not a preference. The pill owns the CENTRE slot, and
 * the slot's centre is the row's centre only while the two flanks weigh the
 * same — and five doors cannot (see `CHROME_*` below). What the 92dp buys is
 * the row's FIT: with five 44dp doors the 9+ row closes at 356dp, so the
 * narrow 360dp phone gets the whole row with 4dp to spare. At 100dp the same
 * row needed 364dp and the pill lost its air at 360.
 *
 * The same pill with the two names measured 178,22dp with Geist — that is why
 * the names left the control.
 */
const WORKSPACE_GLYPH = 24;
const WORKSPACE_PAD = 10;
const WORKSPACE_GAP = 4;
export const WORKSPACE_SEGMENT = WORKSPACE_GLYPH + WORKSPACE_PAD * 2;
export const WORKSPACE_PILL_WIDTH = WORKSPACE_SEGMENT * 2 + WORKSPACE_GAP;

/**
 * The touch floor of the chrome, in dp: 44 on 9+ and 52 on 3-5. Both bands
 * carry it, and so does the sheet's latch — which is why this is also the
 * number `SHEET_RESERVE` is built from.
 *
 * THE TOP BAND IS NOT A ROW ANYMORE (owner's composition, 27/10, `chrome-v2`
 * §12.1). It used to be two flanks and a centre, with the pill declaring its own
 * centring against the row because a leftover slot could never be trusted. §12
 * revoked the rail and the hamburger and took the whole row out of the stage:
 * what is left up there is the workspace selector alone, in a band that is a
 * SIBLING of the stage, in the frame's flow. The undo/redo pair that made the
 * old left flank went into the sheet on 9+ and into the compact preview row on
 * 3-5; on 9+ the band also carries the page's name when there is no switch.
 */
export const CHROME_TARGET = 44;
export const KID_CHROME_TARGET = 52;

/**
 * The air between two chrome pieces, in dp — between the sheet's latch and the
 * stage's top edge, and between the targets of a band.
 */
const EDGE_GAP = 8;

/**
 * What the expanded sheet reserves above its own top edge, in dp: the LATCH that
 * hangs off that edge — 44 on 9+, 52 on 3-5 — plus the 8dp of air every chrome
 * piece keeps from the edge.
 *
 * The sheet's own `max-height` is `100% − sheetReserve` against the STAGE, which
 * is a guarantee that holds at ANY frame height — the reason it is not `dvh`
 * (`dvh` follows the WINDOW: on a tall monitor `56dvh` was taller than this
 * mockup's frame and the sheet climbed over the workspace selector).
 *
 * Since 27/10 the top row left the stage (`chrome-v2` §12.3): the ceiling is the
 * drawer latch's own top + 8dp, not the old row's band — which is what gives the
 * sheet back the height the row was holding above it.
 */
const sheetReserveOf = (kids: boolean) => (kids ? KID_CHROME_TARGET : CHROME_TARGET) + EDGE_GAP;

/**
 * CLEARING THE SHEET is a deliberate LONG PRESS on `Início`, in ms (owner's
 * decision, 27/10). The bin door is gone: a row of five doors had one whose job
 * duplicated a gesture on a door that already exists, and the owner's own
 * reading is that wiping a drawing belongs to PRESSING HOME for a moment, not
 * to a second door. The 550ms is the same number the bin carried, and a tap
 * still leaves the screen.
 */
const CLEAR_HOLD_MS = 550;

/**
 * How long the "Desfazer" notice stays after a clear, in ms (owner's decision,
 * 27/10). The clear is a step and not a wall — `doUndo` puts the whole drawing
 * back — but until now nobody was TOLD, so the way back existed only for whoever
 * guessed it. The notice names the action and offers it where the hand already
 * is; it leaves on its own and never takes a pixel of the paper.
 */
const CLEAR_NOTICE_MS = 8000;

/**
 * The kid pill's three inks (`workspace-switcher` §5). The same language as the
 * material cards (adr-kids-papel-neutro): the paper is neutral and the object in
 * hand carries the ink. Two of them are the kid card's own tokens; the third is
 * the idle glyph, the one the cards also use for unselected ink. The ratios are
 * measured by the test, never estimated here: #1C1410 x #F0ECE0 = 15,37:1 and
 * #5A5550 x #F0ECE0 = 6,24:1.
 */
const KID_WORKSPACE = { plate: paperPlate.plate, ink: paperPlate.ink, idle: "#5A5550" } as const;

/**
 * A path that offers BOTH workspaces. A piece opened from the gallery (or from
 * its own screen) came from a place where the choice was already made, so the
 * canvas shows no switcher there — an unavailable control is not rendered at
 * all, never a disabled ghost (owner's decision, 27/10).
 *
 * The two doors that do offer both are the ones that created the sheet: the
 * profile's own home (a blank sheet) and the page chooser (a coloring page).
 */
const workspacePathOf = (back: Screen): boolean => back.name === "profile" || back.name === "pages";

/**
 * PAPEL ≠ GRADE, and since 27/10 each is a FOLD of the sheet with its own
 * parameters (`chrome-v2` §4): the paper is a material + a printed texture + a
 * tone, the grid is a working guide with a pattern, a density (which IS the
 * cell, 16/24/32 units) and a strength. Neither shares a surface: appearance is
 * a material, the grid is a guide that never enters the artwork.
 */

/**
 * How long the zoom indicator stays after the pinch lets go, in ms (owner's
 * decision, 27/10). The number is DATA while it is up, and a number that stays
 * forever is chrome over the paper — the thing this whole design removes.
 */
const ZOOM_HOLD_MS = 1500;

/** The three densities, named once: the segments and the summary share them. */
const GRID_PATTERNS: GridPattern[] = ["quadrado", "pontilhado", "linhas"];
const GRID_DENSITIES: GridDensity[] = ["fina", "media", "grossa"];
const GRID_STRENGTHS: GridStrength[] = ["sutil", "nitida"];
const PAPER_TEXTURES: PaperTexture[] = ["lisa", "media", "acentuada"];
const PAPER_TONES: PaperTone[] = ["claro", "areia", "creme"];

/** How the material behaves with the current settings (a real multiplier). */
const HARDNESS_FACTOR: Record<Hardness, number> = { soft: 0.62, medium: 0.82, hard: 1 };

/** The band defaults a material with no memory reads. */
const DEFAULT_WATER = 40;
const DEFAULT_HARDNESS: Hardness = "medium";
const DEFAULT_OPACITY = 100;
/**
 * The one thickness a person has never tuned. It is the band default every
 * material opens at, because there is only ONE number: the eraser reads the same
 * 1..100 capsule the brushes read (owner's call, 26/10), and switching material
 * inherits the point in use instead of restoring a per-material one (§11.3).
 */
const DEFAULT_SIZE = BRUSH_SIZES[1] ?? 6;
/** The three hardness points, named once: the readout and the segments share it. */
const HARDNESS_LABEL: Record<Hardness, string> = { soft: "Macio", medium: "Médio", hard: "Duro" };

/**
 * The dock has THREE states, and `drawing` collapses them all to the pill.
 * The pill's material/color targets open the compact bar; the LATCH on the
 * drawer's own top edge (`chrome-panel`) is the ONE switch between compact and
 * expanded, and a stroke on the paper always returns to the pill. 3-5 never
 * reaches `expanded` (spec 26/10): the kids machine is pill and compact only.
 *
 * The level is remembered PER PROFILE for the session (`state.dockLevels`, in
 * the store and never in localStorage): switching profile switches the level,
 * and leaving and re-entering the same profile returns to the level it kept.
 */
type DockState = DockLevel;

const clampPercent = (n: number) => Math.min(100, Math.max(20, Math.round(n)));

/**
 * The desk around the page: the page never touches the canvas edge, so the
 * sheet always reads as a sheet — white paper included. 16dp is the floor from
 * the workspace spec (`mesa ≠ papel ≠ grade`), not a decorative margin.
 */
const SHEET_INSET = 16;

/**
 * Where a sheet was left in the frame (zoom + pan), per profile and workspace,
 * for the session. Session-only on purpose: a reload opens every canvas at FIT,
 * and a piece opened from the gallery is never affected — the map is only read
 * and written by the workspace path (`workspace-switcher` §6.1).
 */
const READING_POSITIONS = new Map<string, Viewport>();

/**
 * Where each person left the pro sheet's scroll, in the session (`painel-chevrons`
 * §7.3). Same contract as the reading position above and for the same reason: it
 * is a place to come back to, not a document — closing the sheet, switching tool
 * or switching tab returns to it, and a reload starts at the top. Nothing is
 * written to localStorage, so no offset can rot when a fold changes the height.
 */
const SHEET_SCROLL = new Map<string, number>();

/**
 * The page's frame: a hairline plus two shadows, ALWAYS on. The page is white
 * by contract; this is what keeps it from dissolving into the canvas when the
 * desk is light — and when a child paints the desk white with the bucket.
 */
const PAGE_FRAME =
  "0 0 0 1px rgba(28,27,26,0.16), 0 1px 4px rgba(28,27,26,0.12), 0 4px 24px rgba(28,27,26,0.18)";

/**
 * The studio. One canvas, no modes: a coloring page is this same screen with
 * a line-art layer underneath and an empty sheet is it without one.
 *
 * The paper owns the whole screen inside the stage — full-bleed, no card floating
 * on a band. Since 27/10 the workspace band sits ABOVE the stage, in the frame's
 * flow (`chrome-v2` §12.1), so it is layout instead of an overlay; the drawer is
 * still an overlay, because it opens and closes. The drawer has three states on
 * 9+ — mini (the floating pill), compact (preview, thickness, the tools, the
 * colour and the canvas's own controls) and expanded (the edge-to-edge sheet with
 * the grouped shelf, the active tool's parameters, a live stroke preview and the
 * full palette) — and two on 3-5, where the compact bar IS the toolbar (spec
 * 26/10).
 *
 * A stroke in progress is its own state, and it is EMPTY: the drawer leaves and
 * the pill goes with it, so the paper is the only thing on screen while the ink
 * flows. Nothing fades any more: both bands are outside the paper (`chrome-v2`
 * §12.1 — "fora do papel não há o que liberar"), so there is nothing to hide.
 * A closed panel and a stroke are therefore the same state for the drawer — it
 * shrinks once and never twice — and nothing reopens it by itself.
 */
export function CanvasScreen({ artworkId, back }: { artworkId: string; back: Screen }) {
  const { state, profile, dispatch, go } = useStore();
  const art = state.artworks.find((a) => a.id === artworkId);
  const page = pageById(art?.pageId);
  const kids = profile ? uiModeOf(profile) === "kids" : true;
  const caps = profile ? effectiveCaps(profile) : CAP_DEFAULTS["3-5"];

  /**
   * Which workspace the open sheet belongs to, and whether this canvas is one of
   * the two doors that offer BOTH of them (`workspacePathOf`). Both come from the
   * artwork and from the screen's own return target — never from a preference,
   * never from the last pick (`workspace-switcher` §6, owner's decision 27/10).
   */
  const workspace: Workspace = art ? workspaceOf(art) : "draw";
  const switchable = workspacePathOf(back);
  const workspaceProfileId = profile?.id ?? null;
  const workspaceArtworkId = art?.id ?? null;
  /** The key the reading position is kept under, only on a workspace canvas. */
  const readingKey = switchable && workspaceProfileId ? `${workspaceProfileId}:${workspace}` : null;

  const [tool, setTool] = useState<CanvasTool>(page ? "fill" : kids ? "crayon" : "brush");
  /**
   * The MATERIAL in hand — never the eraser and never the dropper. The pill
   * keeps showing (and the colour keeps belonging to) the last thing that
   * paints, so wiping a stroke and then tapping the colour does not leave the
   * author holding an eraser with a palette.
   */
  const [material, setMaterial] = useState<CanvasTool>(page ? "fill" : kids ? "crayon" : "brush");
  /**
   * Colour, opacity, water, hardness and the two effects are remembered PER
   * MATERIAL and PER PERSON in `profile.toolSettings`, so switching from a red
   * marker to a blue brush and back returns the paint. The THICKNESS is the one
   * number a material does not own: it lives once per person
   * (`profile.strokeSize`) and the material that arrives inherits it — owner's
   * decision, 26/10, `painel-chevrons` §11.3, which superseded the earlier "each
   * material at its own point" reading.
   */
  // Clear-canvas hold state — declared with the other hooks so the early
  // returns further down never change the hook order.
  const clearedRef = useRef<History | null>(null);
  const clearHold = useRef<number | null>(null);
  /**
   * `true` while a HOLD on `Início` is what produced the press: the browser
   * still fires `click` on release, and that click must not also leave the
   * screen — one gesture, one consequence (`tapBack`).
   */
  const backHeld = useRef(false);
  const [hasCleared, setHasCleared] = useState(false);
  const [gradient, setGradient] = useState<StrokeGradient | null>(null);
  /**
   * THE ZOOM INDICATOR (owner's decision, 27/10): a transient readout over the
   * paper, up while a pinch is in flight and for `ZOOM_HOLD_MS` after it lets
   * go. It is not a control of any panel — "eu não abriria o painel para
   * controlar o zoom" — and it takes no pointer outside its two targets.
   */
  const [zoomHud, setZoomHud] = useState(false);
  const zoomTimer = useRef<number | null>(null);
  /**
   * NO RE-ANCHOR ON RE-FRAME (owner's composition, 27/10, `chrome-v2` §12). The
   * effect that used to put the paper point under the eye back where it was on a
   * re-frame existed because the RAIL took width from the sheet: opening it was a
   * layout event the author did not ask for, and the drawing could not jump. The
   * rail is gone and the top band left the stage, so the only re-frame left is the
   * frame itself changing size — at FIT, the layout re-centres the page on its
   * own, and the pure function (`reanchorView`) stays where it is for whoever
   * needs it.
   */
  /** The way back a clear has to advertise: "Desfazer", for a few seconds. */
  const [notice, setNotice] = useState(false);
  const noticeTimer = useRef<number | null>(null);
  /** Leaving the screen must not leave a timer holding the closure alive. */
  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
      if (zoomTimer.current !== null) window.clearTimeout(zoomTimer.current);
    },
    [],
  );
  const [zoomPing, setZoomPing] = useState(0);
  const [drawing, setDrawing] = useState(false);
  /** A desk tap that cannot paint answers here: the page pulses once. */
  const [nudge, setNudge] = useState(0);
  /**
   * One machine, three states: mini (the pill) → compact (two pieces of colour,
   * one strip and eleven rungs) → expanded (the sheet). `drawing` outranks all
   * of them and hides the bar for the duration of the stroke (P1: the toolbar
   * leaves the paper alone while ink is flowing). Nothing reopens by itself.
   *
   * The level lives in the store, keyed by profile (`dockLevels`): it is session
   * state, not a document — closing and re-entering the same profile in the same
   * session returns to the level it kept, and a reload starts at the pill.
   */
  const dock: DockState = (profile && state.dockLevels[profile.id]) ?? "mini";
  /** The 3-5 palette page: an index into PALETTE_FAMILIES, shared by both docks. */
  const [kidFamily, setKidFamily] = useState(0);
  /**
   * On 3–5 the third level is NOT the pro sheet: it is the second level of the
   * intermediate panel, reserved for the sheet's two folds (grade and papel),
   * with no text at all (`chrome-v2` §4). The latch walks down one level at a
   * time on both bands, so nothing else about the machine changes.
   */
  const dockState: DockState = drawing ? "mini" : dock;
  /** The 300ms recording proof before the canvas actually changes screen. */
  const [leaving, setLeaving] = useState(false);
  /** The gallery card this canvas grew from, consumed once on mount. */
  const [sharedFrom] = useState<OpenRect | null>(() => takeOpenRect());
  const [shared, setShared] = useState<{ from: OpenRect; to: OpenRect } | null>(null);
  const sharedRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [view, setView] = useState<Viewport>(() =>
    readingKey ? (READING_POSITIONS.get(readingKey) ?? FIT) : FIT,
  );
  const [live, setLive] = useState<StrokeCommand | null>(null);
  /** The rubber's pass in flight: what the paper paints while the finger is down. */
  const [erasing, setErasing] = useState<AreaErasePlan | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [askSave, setAskSave] = useState(false);
  /** Commands already saved when this canvas opened — the dialog only asks
   *  again when something new was drawn since then. */
  const openedWith = useRef(art?.history.commands.length ?? 0);

  const paperBoxRef = useRef<HTMLDivElement>(null);
  const [paperEl, setPaperEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  const pointers = useRef(new Map<number, Pt>());
  /** Two fingers: the viewport, the span and the paper they started from. */
  const gesture = useRef<{ start: Viewport; from: Span; sheet: Sheet } | null>(null);
  const active = useRef<{
    id: number;
    tool: CanvasTool;
    sx: number;
    sy: number;
    moved: boolean;
    region: string | undefined;
    at: number;
  } | null>(null);
  const liveRef = useRef<StrokeCommand | null>(null);
  /** The rubber's path in the gesture in flight, in artwork units. */
  const erasePath = useRef<Point[]>([]);
  /** Regions whose bucket fill this erase wipes (the block eraser's other job). */
  const eraseRegions = useRef(new Set<string>());
  /** The pass in flight, as planned from the whole path so far. */
  const erased = useRef<AreaErasePlan>({ strokeIds: [], edits: [] });

  useEffect(() => {
    // A callback ref (not a mount-time lookup): the paper only exists once the
    // screen has both an artwork and a profile, which can happen after mount.
    if (!paperEl) return;
    const ro = new ResizeObserver(
      ([e]) => e && setBox({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    ro.observe(paperEl);
    return () => ro.disconnect();
  }, [paperEl]);

  // Gallery → canvas: the card grows into the sheet (P1, shared element). The
  // rect was measured by the gallery on the tap; the paper is only measurable
  // after layout, so the animation starts on the first frame with a real box.
  useEffect(() => {
    if (!sharedFrom || !paperEl || box.w <= 0) return;
    const node = paperEl.querySelector<HTMLElement>('[data-testid="page-area"]');
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    setShared({
      from: sharedFrom,
      to: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    });
  }, [sharedFrom, paperEl, box.w, box.h]);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => go(back), SAVE_EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, go, back]);

  // The hold owns a timer, and the canvas can be left with it counting:
  // unmounting must not leave a `setState` aimed at a screen that is gone.
  useEffect(
    () => () => {
      if (clearHold.current !== null) window.clearTimeout(clearHold.current);
      clearHold.current = null;
    },
    [],
  );

  useEffect(() => {
    const el = sharedRef.current;
    if (!shared || !el) return;
    // jsdom and reduced motion: no growth, no fake marker left behind.
    if (reduced || typeof el.animate !== "function") {
      setShared(null);
      return;
    }
    const { from, to } = shared;
    const anim = el.animate(
      [
        {
          transform: `translate(${from.x}px, ${from.y}px)`,
          width: `${from.w}px`,
          height: `${from.h}px`,
          borderRadius: "12px",
        },
        {
          transform: `translate(${to.x}px, ${to.y}px)`,
          width: `${to.w}px`,
          height: `${to.h}px`,
          borderRadius: "2px",
        },
      ],
      { duration: 550, easing: "cubic-bezier(0.3,0,0.2,1)", fill: "both" },
    );
    anim.onfinish = () => setShared(null);
    return () => anim.cancel();
  }, [shared, reduced]);

  useEffect(() => {
    // Every sheet opened through the workspace path becomes "the piece of that
    // workspace": coming back through the pill reopens exactly this artwork —
    // same commands, same undo/redo — because the piece is the stored artwork,
    // not a copy (spec §6.1). Session state, per profile, in the store.
    if (!switchable || !workspaceProfileId || !workspaceArtworkId) return;
    dispatch({
      type: "rememberWorkspace",
      profileId: workspaceProfileId,
      workspace,
      artworkId: workspaceArtworkId,
    });
  }, [dispatch, switchable, workspaceProfileId, workspaceArtworkId, workspace]);

  /**
   * The reading position, remembered per person and per workspace for the
   * session. The shell mounts the canvas keyed by artwork id, so a switch is a
   * remount: without this the other piece would reopen at FIT and the pill would
   * promise a "same place" it could not keep (§6.1). Keyed by profile+workspace,
   * never by artwork: opening a piece from the gallery keeps opening at FIT.
   */
  useEffect(() => {
    if (readingKey) READING_POSITIONS.set(readingKey, view);
  }, [readingKey, view]);

  /**
   * The desk fill is canvas customization, not artwork. It lives in the same
   * command list (so undo/autosave already work), but the lookup is memoized:
   * a live stroke changes `live`, not the document, and must not re-derive it.
   */
  const documentCommands = art?.history.commands;
  const deskFill = useMemo(
    () => (documentCommands ? derive(documentCommands).fills["desk"] : undefined),
    [documentCommands],
  );

  if (!art || !profile) return null;
  const { settings } = state;
  const history = art.history;

  /**
   * The material's memory, read straight from the profile: the store is the
   * single source, so a reload, another screen or a backup all see the same
   * paint. A material the author never touched reads the band defaults — never a
   * zero and never someone else's number.
   *
   * The THICKNESS is not read from here: it is one number per person
   * (`profile.strokeSize`), so switching material keeps the point in use and the
   * material that arrives inherits it (owner's decision, 26/10, §11.3).
   */
  const memoryOf = (id: CanvasTool): ToolMemory => profile.toolSettings?.[id] ?? {};
  const materialMemory = memoryOf(material);
  const toolMemory = memoryOf(tool);
  const color =
    materialMemory.color ??
    profile.recentColors[0] ??
    (kids ? KID_COLORS[0]!.hex : PALETTE_FAMILIES[10]!.base.hex);
  const size = profile.strokeSize ?? DEFAULT_SIZE;
  const opacity = toolMemory.opacity ?? DEFAULT_OPACITY;
  const water = toolMemory.water ?? DEFAULT_WATER;
  const hardness = toolMemory.hardness ?? DEFAULT_HARDNESS;
  /**
   * The two effects of the material in hand (efeitos-chevrons §7.5): read from
   * the SAME per-profile, per-tool memory as opacity and colour, so tuning the
   * shadow of the brush leaves the watercolour's glow alone and another person
   * never sees it. Absent (or off) = no effect; the readers clamp whatever a
   * backup carries.
   */
  const sombra = shadowOf(toolMemory.sombra);
  const brilho = glowOf(toolMemory.brilho);

  /** 1..100, the one number every material reads (its own factor stays in `brushStroke`). */
  const brushSize = Math.min(100, Math.max(1, Math.round(size)));
  /** Which fold of the sheet this person keeps open (§7.3 + efeitos §7.5). */
  const secoes = panelSectionsOf(profile.secoesPainel);
  /**
   * The spray nozzle (brush-seco-e-spray §3): the one material whose tip the
   * author tunes, and it is persisted per profile "para a criança reencontrar o
   * bico dela". The profile is the ONLY source — the panel writes it and reads
   * it back through the store, so a reload or a re-entry opens the can where
   * that person left it. Absent = the shelf's own (a save from before the field).
   *
   * The nozzle also rides INTO the command: a stroke replays with the nozzle it
   * was painted with, never with whatever the panel happens to show later.
   */
  const spray = nozzleOf(profile.spray);
  const ratio = art.w / art.h;
  /**
   * Desk + page, not one sheet: the desk is the full canvas (and the surface
   * the drawer floats over), the page is the artwork's own sheet inset inside
   * it. 16dp of desk is always visible, so the page has a limit even when both
   * are light — the defect the owner's prints showed. A page is never stretched
   * or cropped, and the sheet never shrinks because a panel opened; only the
   * desk around the page exists.
   *
   * THE DESK IS THE WHOLE STAGE since 27/10 (`chrome-v2` §12): with the rail
   * revoked and the top band outside the stage, nothing takes width from the
   * sheet anymore — `sheetW` is the stage, and the paper is as wide as the frame
   * allows.
   */
  const stageW = Math.max(0, box.w);
  const sheetW = stageW;
  const sheetH = Math.max(0, box.h);
  const availW = Math.max(0, sheetW - SHEET_INSET * 2);
  const availH = Math.max(0, sheetH - SHEET_INSET * 2);
  /** The page inside the desk, centred, at the page's own ratio. */
  const pageW = Math.min(availW, availH * ratio);
  const pageH = pageW / ratio;
  const pageLeft = (sheetW - pageW) / 2;
  const pageTop = (sheetH - pageH) / 2;
  const originX = 0;
  const originY = 0;
  /**
   * THE SHEET'S LOOK, read straight from the profile (`chrome-v2` §4): the
   * material the adult's global preference seeds, the printed texture and the
   * tone. 3–5 never reads a tone — a kid's paper is neutral by ADR — and the
   * picker there does not offer one either.
   */
  const paperLook: PaperLook = paperLookOf(profile.papel, settings.paper);
  const paperTone: PaperTone = kids ? "claro" : paperLook.tone;
  const paperKey: PaperKey = paperLook.key;
  const paperMaterial = PAPERS[paperKey];
  /** The sheet the ink lands on: the tone's hex, and the material's own graph. */
  const pageMaterial = { ...paperMaterial, paperHex: PAPER_TONE_HEX[paperTone] };
  /**
   * THE GUIDE, read from the same profile. Off = no node at all in the sheet's
   * SVG (absence, not a hidden lattice), and never a command: no file carries it.
   */
  const gridLook: GridLook = gridLookOf(profile.grade);
  const gridGuide = gridGuideOf(gridLook);
  const deskHex = deskFill ?? paperMaterial.surface;
  /** A control with nothing to do answers as inert, never as a dead tap. */
  const canUndoNow = canUndo(history);
  const canRedoNow = canRedo(history);
  /**
   * The undo that follows a clear belongs to the CLEAR, not to the sheet's own
   * history: an empty canvas has nothing to undo, and the undo door is the only
   * way back to what the hold took away — so it is live on an empty sheet when
   * (and only when) there is something to bring back.
   *
   * This is also why the pair inside the sheet reads `undoReady` and not
   * `canUndoNow`: the clear's notice leaves after 8s, and the way back must not
   * leave with it (destructive action stays undoable).
   */
  const undoReady = canUndoNow || hasCleared;
  /** Nothing on the sheet, nothing to erase. */
  const clearReady = history.commands.length > 0;
  /**
   * The top band's content, counted on the DOM: the workspace pill's two segments
   * when the path offers both workspaces, zero otherwise. Since 27/10 the band
   * holds NOTHING else (`chrome-v2` §12.1) — the undo/redo pair that used to be
   * its left flank lives inside the sheet now, and the hamburger that used to be
   * its right flank no longer exists.
   *
   * EVERY control is always rendered. The old rule ("a door the profile cannot
   * use is not rendered at all") is about CAPABILITIES — a lock, a padlock, a
   * control that could never work for that person. It is not about a history
   * that is momentarily empty: hiding undo between two strokes moves the finger
   * that learned where undo lives. So an inert control is DRAWN, DISABLED and at
   * 35% — visible, announced, and refusing the tap.
   */
  const chromeChips = switchable ? 2 : 0;

  /**
   * The latch's state, in the same units as the dock machine: it is OPEN when
   * the level above the pill is on screen — the sheet on 9+, the compact bar on
   * 3–5 (which is that band's top level, §7.6: no sheet there). Its next level is
   * therefore "down" from wherever it sits: the sheet folds into the bar on 9+,
   * the bar folds into the pill on 3–5. The latch is not drawn on the pill, so
   * the only levels it ever sees are those two.
   */
  const panelOpen = dockState === "expanded";
  const panelNext: DockState = dockState === "expanded" ? "compact" : "expanded";

  /** The stroke's real opacity: water dilutes paint, hardness changes graphite. */
  const mediaFactor =
    (tool === "watercolor" ? 1 - (water / 100) * 0.5 : 1) *
    (tool === "pencil" ? HARDNESS_FACTOR[hardness] : 1);
  const effectiveOpacity = clampPercent(opacity * mediaFactor);

  /**
   * The paper as a gesture meets it. `origin` is the layout spot the transform
   * starts from — the centred box inside the paper area — never the rendered
   * rect, which already carries the translation. The fingers come in screen
   * coordinates, so without this the sheet slides by the frame's own offset.
   */
  const paperFrame = (): Sheet | null => {
    const area = paperEl?.getBoundingClientRect();
    if (!area) return null;
    return {
      w: sheetW,
      h: sheetH,
      origin: { x: area.left + originX, y: area.top + originY },
    };
  };

  /** The style fields every new stroke carries (kept out of the command when plain). */
  const styleOf = (kind: BrushKind): Partial<StrokeCommand> => ({
    brush: kind,
    ...(effectiveOpacity !== 100 ? { opacity: effectiveOpacity } : {}),
    ...(gradient ? { gradient } : {}),
    // The can is the only mark that carries its own tool: the nozzle is data of
    // the STROKE, not a preference of the app (a gallery piece must not change
    // when the author next opens the panel).
    ...(kind === "spray" ? { spray } : {}),
  });

  /**
   * The effects ride the COMMITTED stroke only (efeitos-chevrons §7.7.5). While
   * the finger is down the gesture paints plain — a blur repainted every frame
   * is what drops a weak device — and releasing the touch commits the stroke
   * WITH the effects, so undo, the thumbnails and the PNG carry them. Absent
   * when the switch is off, which is exactly the "no effect, no cost" command
   * every save written before the feature has.
   */
  const effectStyleOf = (): Partial<StrokeCommand> => ({
    ...(sombra.on ? { sombra } : {}),
    ...(brilho.on ? { brilho } : {}),
  });

  const commit = (cmd: Command) => {
    const next = push(history, cmd);
    dispatch({ type: "setHistory", id: art.id, history: next });
    if (cmd.t === "fill" && page && !art.celebrated) {
      const fills = derive(next.commands).fills;
      if (page.regions.slice(1).every((r) => fills[r.id])) {
        dispatch({ type: "celebrated", id: art.id });
        if (kids) {
          setCelebrate(true);
          if (settings.sound) playChime();
          if (settings.voice) say("Que lindo!");
          setTimeout(() => setCelebrate(false), 2600);
        } else {
          toast.success("Página completa");
        }
      }
    }
  };
  /**
   * Clear canvas, on a deliberate LONG PRESS of `Início` (owner's decision,
   * 27/10; the same 550ms the bin carried). The owner's own reading of the
   * screen is that wiping a drawing belongs to PRESSING HOME for a moment, and
   * that the bin was a second door for a job one gesture already covers — so
   * the row lost a control and the desk kept the shortcut.
   *
   * A TAP still leaves. The hold only wins after `CLEAR_HOLD_MS`, and when it
   * wins it arms `backHeld` so the `click` the browser fires on release is
   * swallowed: one gesture, one consequence — never "cleared and left".
   *
   * The first undo after a clear puts the whole drawing back (see `doUndo`),
   * so this is a step, not a one-way door. The gesture is a hold on purpose: a
   * four-year-old does not trigger it by accident, and the door advertises it
   * in TWO places now — the hairline ring every hold target wears (`ChromeDoor`)
   * and the door's own accessible name, which says "segure para apagar a obra"
   * out loud while the sheet has something to erase (owner's decision, 27/10:
   * the hint lived only in a `title`, and a `title` does not exist on touch).
   *
   * WHAT THE HOLD TAKES AWAY, THE SCREEN HANDS BACK: after clearing, the notice
   * above the dock names the action and offers "Desfazer" (`CLEAR_NOTICE_MS`).
   * The door of the top row stays live for as long as the clear can be undone
   * (`undoReady`), but nobody should have to guess that.
   */
  const stopClearHold = () => {
    if (clearHold.current !== null) {
      window.clearTimeout(clearHold.current);
      clearHold.current = null;
    }
  };
  const showUndoNotice = () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    setNotice(true);
    noticeTimer.current = window.setTimeout(() => {
      noticeTimer.current = null;
      setNotice(false);
    }, CLEAR_NOTICE_MS);
  };
  const hideUndoNotice = () => {
    if (noticeTimer.current !== null) {
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = null;
    }
    setNotice(false);
  };
  const clearSheet = () => {
    if (history.commands.length === 0) return;
    clearedRef.current = history;
    setHasCleared(true);
    dispatch({
      type: "setHistory",
      id: art.id,
      history: { commands: [], redo: [], undoable: 0 },
    });
    showUndoNotice();
  };
  const startClearHold = () => {
    stopClearHold();
    backHeld.current = false;
    clearHold.current = window.setTimeout(() => {
      clearHold.current = null;
      // An empty sheet has nothing to clear: the press stays a press, so the
      // release still leaves the screen like any other tap on Início.
      if (history.commands.length === 0) return;
      backHeld.current = true;
      clearSheet();
    }, CLEAR_HOLD_MS);
  };
  /**
   * The door's click. A hold that already cleared ends here as a no-op; every
   * other press is the tap it looks like.
   */
  const tapBack = () => {
    if (backHeld.current) {
      backHeld.current = false;
      return;
    }
    leave();
  };
  const doUndo = () => {
    if (clearedRef.current) {
      const back = clearedRef.current;
      clearedRef.current = null;
      setHasCleared(false);
      hideUndoNotice();
      dispatch({ type: "setHistory", id: art.id, history: back });
      return;
    }
    // A disabled door must also refuse a synthetic press (automation, assistive
    // tech): `disabled` already blocks the pointer, and this keeps the handler
    // honest for the paths that dispatch the event directly.
    if (!canUndoNow) return;
    dispatch({ type: "setHistory", id: art.id, history: undo(history) });
  };
  const doRedo = () => {
    if (!canRedoNow) return;
    dispatch({ type: "setHistory", id: art.id, history: redo(history) });
  };

  /**
   * A tap the active tool cannot turn into paint still answers: the page
   * pulses once and the device gives its pop. The kids skin gets no sentence —
   * the pulse IS the message — while the pro skin may read why.
   */
  const nudgePage = () => {
    setNudge((n) => n + 1);
    if (settings.sound) playPop();
    if (settings.vibration) vibrate();
    if (!kids) toast("A mesa não recebe traço — use o balde para pintar o fundo");
  };

  /**
   * Screen point -> page point. A position outside the PAGE is not a drawable
   * point: the desk is canvas, not paper, so a stroke never starts or lands
   * there (clamping is what painted lines glued to the sheet's edge). The desk
   * is still a surface — the bucket paints it and every other tool answers on
   * release — but a stroke tool cannot mark it.
   */
  const toLogical = (e: { clientX: number; clientY: number }): Point | null => {
    const r = paperBoxRef.current!.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const x = ((e.clientX - r.left) / r.width) * art.w;
    const y = ((e.clientY - r.top) / r.height) * art.h;
    if (x < 0 || y < 0 || x > art.w || y > art.h) return null;
    return [x, y];
  };
  const scale = () => paperBoxRef.current!.getBoundingClientRect().width / art.w;

  /**
   * The rubber's job, planned from its WHOLE path: the spans each touched
   * stroke loses, and the strokes it covers whole (borracha-area §6.1).
   *
   * Re-planning from the whole path on every move is the same answer as
   * accumulating span by span — `planAreaErase` is pure — so what the finger
   * sees is exactly what the release commits. A stroke the pass only BIT keeps
   * its ink: the preview is the real gap, never a faded whole stroke.
   */
  const planErase = (path: Point[]) => {
    const { strokes, gaps } = derive(history.commands);
    const plan = planAreaErase(strokes, path, brushSize, gaps);
    erased.current = plan;
    setErasing(plan.edits.length > 0 || plan.strokeIds.length > 0 ? plan : null);
  };

  /** The bucket's fill under the finger is a mark too, and it goes whole. */
  const touchRegion = (region?: string) => {
    if (!region || eraseRegions.current.has(region)) return;
    if (derive(history.commands).fills[region] === undefined) return;
    eraseRegions.current.add(region);
  };

  const cancelActive = () => {
    active.current = null;
    liveRef.current = null;
    erasePath.current = [];
    eraseRegions.current = new Set();
    erased.current = { strokeIds: [], edits: [] };
    setLive(null);
    setErasing(null);
    setDrawing(false);
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    // Touch protection: a resting palm (large contact) never paints.
    if (e.pointerType === "touch" && (e.width > 48 || e.height > 48)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Second finger: the gesture owns the canvas and whatever was being drawn
    // is dropped. Two fingers never leave a mark. The dock gives the paper
    // room but keeps context: expanded falls to compact, never straight to mini.
    if (pointers.current.size >= 2) {
      cancelActive();
      // The pinch is the primary zoom, so it is what puts the readout on screen.
      showZoomHud();
      // The dock gives the paper room but keeps context: expanded falls to
      // compact, never straight to mini — and with its order snapshotted.
      if (dock === "expanded") openDock("compact");
      const frame = paperFrame();
      if (!frame) return;
      const [a, b] = [...pointers.current.values()] as [Pt, Pt];
      gesture.current = { start: view, from: spanBetween(a, b), sheet: frame };
      // Synthetic events (automation, some assistive tech) have no active
      // pointer to capture; the gesture still works without the capture.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* no active pointer */
      }
      return;
    }

    // Ink needs the paper, not the parameters: the canvas gives way on the same
    // touch that starts the stroke, so collapsing never costs a dead tap.
    openDock("mini");
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* no active pointer */
    }

    const p = toLogical(e);
    const region =
      (e.target as Element).closest?.("[data-region]")?.getAttribute("data-region") ?? undefined;
    active.current = {
      id: e.pointerId,
      tool,
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
      region,
      at: performance.now(),
    };

    // The desk is not a stroke surface. The pointer is still tracked so the
    // release can answer (bucket paints it; any other tool explains itself).
    if (!p) return;

    if (isShelfTool(tool) && tool !== "eraser") {
      liveRef.current = {
        t: "stroke",
        id: uid(),
        color,
        size: brushSize,
        points: [p],
        ...styleOf(tool),
      };
      setLive(liveRef.current);
      setDrawing(true);
    } else if (tool === "eraser") {
      // The pass starts empty: the path is the gesture, never the previous one.
      eraseRegions.current = new Set();
      touchRegion(region);
      erasePath.current = [p];
      planErase(erasePath.current);
      setDrawing(true);
    }
  };

  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (gesture.current) {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts as [Pt, Pt];
      const g = gesture.current;
      setView(applyGesture(g.start, g.from, spanBetween(a, b), g.sheet));
      // The number follows the fingers: the readout is up while the pinch is.
      showZoomHud();
      return;
    }

    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - a.sx, e.clientY - a.sy) > 6) a.moved = true;
    const p = toLogical(e);
    // Outside the page nothing is added to the stroke: no point, no erase.
    if (!p) return;
    if (a.tool !== "eraser" && a.tool !== "fill" && a.tool !== "eyedropper" && liveRef.current) {
      const pts = liveRef.current.points;
      const last = pts[pts.length - 1]!;
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) * scale() < 1.5) return;
      const k = SMOOTH[settings.stabilization] ?? 1;
      const sp: Point = [last[0] + (p[0] - last[0]) * k, last[1] + (p[1] - last[1]) * k];
      liveRef.current = { ...liveRef.current, points: [...pts, sp] };
      setLive(liveRef.current);
    } else if (a.tool === "eraser") {
      const path = erasePath.current;
      const last = path[path.length - 1];
      // A finger that has not moved a unit has nothing new to rub: the plan
      // (and the repaint it causes) is only rebuilt when the path grows.
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 1) return;
      erasePath.current = [...path, p];
      planErase(erasePath.current);
    }
  };

  const onUp = (e: RPointerEvent<HTMLDivElement>, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current) {
      if (pointers.current.size < 2) {
        gesture.current = null;
        // Letting go is not the end of the reading: the number stays for
        // `ZOOM_HOLD_MS` and then leaves on its own.
        showZoomHud();
      }
      return;
    }
    const a = active.current;
    if (!a || a.id !== e.pointerId) return;
    const p = toLogical(e);
    const deskPainted = derive(history.commands).fills["desk"] !== undefined;

    if (!cancelled) {
      if (a.tool !== "eraser" && a.tool !== "fill" && a.tool !== "eyedropper" && liveRef.current) {
        // The gesture painted plain; the mark is committed with its effects.
        commit({ ...liveRef.current, ...effectStyleOf() });
      } else if (a.tool === "eraser") {
        const plan = erased.current;
        const regions = [...eraseRegions.current];
        if (plan.edits.length > 0) {
          // The strokes that survived in part carry their spans; the ones the
          // pass covered whole ride in the same command, so ONE gesture is
          // still ONE command and ONE undo, whatever it crossed.
          commit({
            ...areaCommandOf(plan, brushSize),
            ...(regions.length > 0 ? { regions } : {}),
          });
        } else if (plan.strokeIds.length > 0 || regions.length > 0) {
          // Nothing survived: the pass IS a whole erase, written exactly as the
          // saves written before the area eraser wrote it.
          commit({
            t: "erase",
            strokeIds: plan.strokeIds,
            // Only present when a fill was actually wiped: a stroke-only erase
            // stays byte-identical to the saves written before regions existed.
            ...(regions.length > 0 ? { regions } : {}),
          });
        } else if (!a.moved && !p) {
          // The eraser's other job on the desk: wipe the color a bucket put
          // there. With nothing painted, the tap still answers.
          if (deskPainted) {
            commit({ t: "erase", strokeIds: [], regions: ["desk"] });
            if (settings.sound) playPop();
          } else {
            nudgePage();
          }
        }
      } else if (a.tool === "fill" && !a.moved) {
        // Blank paper is one region too, and the desk is a region of its own:
        // a bucket that only knew the artwork made the whole margin a dead zone.
        const region = a.region ?? (p ? "fundo" : "desk");
        const current = derive(history.commands).fills[region];
        if (current !== color) commit({ t: "fill", region, color });
        // Every bucket tap answers — including the one that was already that
        // color. Silence is what made the margin look broken.
        if (settings.sound) playPop();
        if (settings.vibration) vibrate();
      } else if (a.tool === "eyedropper" && !a.moved && p) {
        // SVG has no pixels: sample the region fill, else the nearest stroke.
        const { fills, strokes } = derive(history.commands);
        const sampled =
          (a.region ? fills[a.region] : undefined) ??
          strokes.find((s) => strokeHit(s, p, 14))?.color ??
          PAPER_HEX;
        // The sample lands on the MATERIAL, which is what the next stroke uses;
        // the dropper is a door, never a drawer.
        paintWith(material, sampled);
        setTool(material);
      } else if (!a.moved && !p) {
        // A stroke tool tapped the desk: it cannot paint there, and the answer
        // is immediate instead of a touch that does nothing.
        nudgePage();
      }
    }
    cancelActive();
  };

  /**
   * Every setting writes through to the profile, for the MATERIAL it belongs
   * to — no "save" button, no toast (a child never presses salvar for a
   * preference, and the sheet's sliders are the only place these live).
   */
  const rememberTool = (target: CanvasTool, patch: ToolMemory) => {
    dispatch({ type: "setToolMemory", id: profile.id, tool: target, patch });
  };

  /**
   * The thickness is ONE number per person, outside the per-material map: it is
   * written for the profile, never for the material, so switching material
   * cannot restore a per-material point (§11.3). The eraser's capsule, the
   * pill's pop and the sheet's slider all land here.
   */
  const applySize = (value: number) =>
    dispatch({ type: "setStrokeSize", id: profile.id, size: value });
  /**
   * A fold of the sheet writes its open/closed state to the profile on the spot:
   * the state survives closing the sheet, switching tool and switching back, and
   * another person on the device keeps their own (§7.3).
   */
  const setSection = (key: PanelSectionKey, open: boolean) =>
    dispatch({ type: "setPanelSection", id: profile.id, key, open });
  const applyOpacity = (value: number) => rememberTool(tool, { opacity: value });
  const applyWater = (value: number) => rememberTool(tool, { water: value });
  const applyHardness = (value: Hardness) => rememberTool(tool, { hardness: value });
  /**
   * Each effect patch writes through to the material's memory on the spot: the
   * switch, the sliders and the glow's colour are one object, so turning the
   * effect off keeps the tuning for the next time (§7.5).
   *
   * The SWITCH also drives its own fold (owner's rule, 27/10): turning the effect
   * on opens the fold, turning it off collapses it, and the open state is written
   * to the profile like every other fold — so the sheet reopens where the person
   * left it. A slider never moves a fold: a slider only exists inside an open one.
   */
  const applySombra = (patch: Partial<ShadowEffect>) => {
    rememberTool(tool, { sombra: shadowOf({ ...sombra, ...patch }) });
    if (patch.on !== undefined) setSection("sombra", patch.on);
  };
  const applyBrilho = (patch: Partial<GlowEffect>) => {
    rememberTool(tool, { brilho: glowOf({ ...brilho, ...patch }) });
    if (patch.on !== undefined) setSection("brilho", patch.on);
  };

  /**
   * A colour belongs to the material in hand. Picking one while the eraser is
   * up returns to that material (the palette would otherwise be a control that
   * changes a colour nobody is painting with).
   */
  const paintWith = (target: CanvasTool, raw: string) => {
    const hex = raw.toUpperCase();
    rememberTool(target, { color: hex });
    dispatch({ type: "rememberColor", id: profile.id, hex });
    return hex;
  };

  const pickColor = (raw: string) => {
    const target = tool === "eraser" ? material : tool;
    paintWith(target, raw);
    if (tool === "eraser") setTool(target);
  };

  /**
   * A saved colour answers with the pop and a short tap — the same pair the
   * bucket uses — and nothing else: no toast, no dialog, no star. The store
   * keeps it per profile, so Theo's row never shows what Maria saved.
   */
  const toggleFavorite = (hex: string) => {
    if (settings.sound) playPop();
    if (settings.vibration) vibrate();
    dispatch({ type: "toggleFavoriteColor", id: profile.id, hex });
  };

  /**
   * The nozzle is written as it moves: the panel is the only place it is tuned,
   * and leaving the studio must not be the moment that decides whether it was
   * remembered (a child never presses "salvar" for a preference).
   */
  const pickSpray = (next: SpraySettings) =>
    dispatch({ type: "setSpray", id: profile.id, spray: next });

  /**
   * The pill's only action: take the other workspace back. A direct switch —
   * no dialog, no animation over it, no toast (spec §6.1). Nothing is lost by
   * leaving, because the piece is already autosaved and stays exactly as it was.
   *
   * - a piece already open in that workspace is reopened as it was left;
   * - the first entry into "Desenho livre" opens a blank sheet;
   * - the first entry into "Pintura" opens the page chooser the app already has
   *   (`PagesScreen`): a coloring page is the only way into that workspace, so
   *   the pill reuses that door instead of inventing one.
   *
   * Either way the canvas keeps its OWN return target (`back`): Início goes on
   * returning exactly where this screen was opened from, as every screen does.
   */
  const openWorkspace = (next: Workspace) => {
    if (next === workspace) return;
    const remembered = state.workspaceArts[profile.id]?.[next];
    const target = state.artworks.find(
      (candidate) => candidate.id === remembered && workspaceOf(candidate) === next,
    );
    if (target) {
      go({ name: "canvas", artworkId: target.id, back });
      return;
    }
    if (next === "paint") {
      go({ name: "pages", back });
      return;
    }
    const id = uid();
    dispatch({ type: "createArtwork", artwork: blankArtwork(profile.id, id) });
    go({ name: "canvas", artworkId: id, back });
  };

  const leave = () => {
    if (leaving) return;
    if (history.commands.length === 0) {
      dispatch({ type: "discardIfEmpty", id: art.id });
      go(back);
      return;
    }
    if (needsSaveDecision(openedWith.current, history.commands.length)) {
      setAskSave(true);
      return;
    }
    // P1: leaving is a recording proof, not a silent swap. The pill and the
    // scrim run before the screen changes (spec §4, T-save).
    setLeaving(true);
  };

  // "Continuar desenhando" keeps the strokes (already autosaved) and stops
  // asking until something new is drawn.
  const keepDrawing = () => {
    openedWith.current = history.commands.length;
    setAskSave(false);
  };
  const publishAndLeave = () => {
    dispatch({ type: "publish", id: art.id });
    if (kids) toast.success("No mural!");
    else toast.success("Publicado no mural");
    setAskSave(false);
    // Back to where the canvas was opened: the profile home shows the piece.
    go(back);
  };
  const draftAndLeave = () => {
    dispatch({ type: "unpublish", id: art.id });
    setAskSave(false);
    go(back);
  };
  /**
   * The dialog's own "Jogar fora": only the author's draft, never a piece on the
   * mural, and never behind a second confirmation. It sends the piece to the
   * trash and leaves the 5s "Desfazer" to the shell, so undoing works even after
   * the canvas is gone. Restoring returns the piece exactly as it was (a draft
   * comes back a draft).
   *
   * The way out skips a view of the piece: the canvas reached from a piece's
   * own screen must not return to the view of something that just left.
   */
  const discardAndLeave = () => {
    dispatch({ type: "trash", id: art.id });
    setAskSave(false);
    go(back.name === "view" ? back.back : back);
  };

  // The 3–5 studio carries five objects — and the bucket is one of them, on a
  // page or on a blank sheet (it paints the paper itself).
  // Nothing the profile cannot use is rendered: no padlock, no locked door.
  //
  // The compact bar carries the base set on kids (five) and the profile's own
  // row on pro; the full catalog lives only in the pro sheet (spec 26/10).
  const hasPage = Boolean(page);
  const tools: CanvasTool[] = baseTools(kids);
  const panelTools: CanvasTool[] =
    kids && !caps.ferramentasComplexas
      ? kidTools(hasPage)
      : [
          ...(["fill"] as CanvasTool[]),
          ...(caps.ferramentasComplexas
            ? BRUSH_SHELF.map((b) => b.id).filter((id) => id !== "eraser")
            : (["brush"] as CanvasTool[])),
          "eraser",
        ];

  /**
   * O catálogo que o POP-UP da pílula recebe: só MATERIAL de pintura (decisão
   * do dono, 27/10). O balde e a borracha já são alvos fixos da pílula —
   * listá-los aqui de novo é a mesma porta duas vezes, e a borracha o dono já
   * tinha reclamado. Derivado do catálogo do perfil (um segundo catálogo
   * divergiria), com o filtro no ponto em que o pop recebe a lista, nunca
   * dentro do laço de render.
   */
  const popMaterials: CanvasTool[] = (kids ? kidTools() : panelTools).filter(isMaterial);

  /**
   * The toolbar row is the profile's own list (owner's call, 24/10): every
   * allowed tool can be switched off, and the enabled ones can be reordered.
   * `savedSlots` is that list, narrowed to what this band can actually use — an
   * empty list is a real state, not a lock: the row shows only the shelf door
   * and nothing pretends to be there. (What the panels READ is `rowTools`.)
   */
  const savedSlots = (profile.toolSlots ?? []).filter((id): id is CanvasTool =>
    (panelTools as string[]).includes(id),
  );
  /**
   * The row BOTH panels read (owner's report, 27/10: "a ordenação está sendo
   * considerada apenas no painel amplo").
   *
   * A stored list IS the row, as it was stored — eraser and bucket included,
   * wherever the person put them. Pinning the two again here is what made the
   * compact bar and the sheet disagree about the same profile. Only a profile
   * with no list at all gets the band's default, and the default is the two
   * pins in front (owner's call, 26/10: "borracha e balde são default; se
   * alterados nos ajustes, segue os ajustes").
   */
  const rowTools: CanvasTool[] =
    profile.toolSlots === undefined ? paintOrder(panelTools) : savedSlots;

  /**
   * The compact row of the band: the base set on kids, the profile's own row on
   * pro — the very same `rowTools` the sheet lists, so the two can never show
   * two different sequences.
   *
   * It is DERIVED on every render, never kept in state: the sheet reorders the
   * slots with the bar mounted, and a row captured when the dock opened kept
   * showing the order from before the change (the `compactRow` portrait is
   * gone). Nothing else about the row moves: it never re-sorts itself on a
   * pick, so the same profile always opens on the same bar.
   */
  const paintRow = (): CanvasTool[] => (kids ? paintOrder(tools) : rowTools);

  const pickTool = (next: CanvasTool) => {
    // The MATERIAL in hand ignores the two doors that do not paint: an eraser
    // or a dropper must not take the colour (and the pill) away from the last
    // thing that draws.
    if (next !== "eraser" && next !== "eyedropper") setMaterial(next);
    setTool(next);
  };

  /**
   * The dock machine's only door. Every opening reads the SAME derived row: the
   * order is the profile's, never the session's, and it is read at render — the
   * level is the only thing this door stores.
   */
  const openDock = (next: DockState) => {
    if (profile) dispatch({ type: "setDockLevel", id: profile.id, level: next });
  };

  const setSlots = (slots: CanvasTool[]) =>
    dispatch({ type: "setToolSlots", id: profile.id, slots });

  const toggleSlot = (id: CanvasTool) =>
    setSlots(rowTools.includes(id) ? rowTools.filter((t) => t !== id) : [...rowTools, id]);

  const moveSlot = (id: CanvasTool, dir: -1 | 1) => {
    const from = rowTools.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= rowTools.length) return;
    const next = [...rowTools];
    [next[from], next[to]] = [next[to]!, next[from]!];
    setSlots(next);
  };

  /** Small, smooth steps: 15% per tap, never a jump to 140%. */
  const ZOOM_STEP = 1.15;
  /**
   * The indicator's clock. Every event that IS a zoom (the pinch, a step of the
   * two targets, the 3–5 corner) shows it and restarts the countdown; nothing
   * else touches it. `setTimeout` + a ref, because the countdown is a fact about
   * the session and not a state that should re-render on every frame.
   */
  const showZoomHud = () => {
    if (zoomTimer.current !== null) window.clearTimeout(zoomTimer.current);
    setZoomHud(true);
    zoomTimer.current = window.setTimeout(() => {
      zoomTimer.current = null;
      setZoomHud(false);
    }, ZOOM_HOLD_MS);
  };
  const zoomBy = (factor: number) => {
    // The anchor is the last place the author painted, in the paper-view's own
    // px: a drawing that sits off-centre has to stay under the eye on every tap
    // instead of sliding away with the paper's corner (viewport.ts).
    const anchor = resolveZoomAnchor(history.commands, {
      artW: art.w,
      artH: art.h,
      pageLeft,
      pageTop,
      pageW,
      pageH,
      sheetW,
      sheetH,
    });
    setView((v) => zoomAnchored(v, factor, anchor, { w: sheetW, h: sheetH }));
    showZoomHud();
    if (kids) setZoomPing((n) => n + 1);
  };

  /**
   * THE SHEET'S LOOK, written straight to the profile (`chrome-v2` §4). Every
   * control of the two folds lands here: the material, the printed texture, the
   * tone and each fold's disclosure. Nothing is a "save" button — a preference
   * is written as it is made, and the next canvas opens on it.
   */
  const applyPaper = (patch: Partial<PaperLook>) => {
    dispatch({ type: "setPaperLook", id: profile.id, patch });
    // A material change is also a change of the DESK, and a desk the bucket had
    // painted would keep the old colour over the new stock: the fill is erased
    // in the same gesture (one command, one undo), exactly as the old paper door
    // did. Texture and tone never touch the fill — the desk is the material.
    if (patch.key === undefined || patch.key === paperLook.key) return;
    if (deskFill === undefined) return;
    dispatch({
      type: "setHistory",
      id: art.id,
      history: push(history, { t: "erase", strokeIds: [], regions: ["desk"] }),
    });
  };
  const applyGrid = (patch: Partial<GridLook>) =>
    dispatch({ type: "setGridLook", id: profile.id, patch });

  const simplePalette = !caps.paletaCompleta;

  return (
    <div
      className="paper-grain relative flex h-full flex-col overflow-hidden text-foreground"
      data-testid="canvas"
      data-paper={paperKey}
      data-paper-texture={paperLook.texture}
      data-paper-tone={paperTone}
      data-drawing={drawing ? "true" : "false"}
      data-nudge={nudge}
      data-shared-from={
        sharedFrom
          ? `${Math.round(sharedFrom.x)},${Math.round(sharedFrom.y)},${Math.round(sharedFrom.w)},${Math.round(sharedFrom.h)}`
          : undefined
      }
      style={
        {
          backgroundColor: deskHex,
          // The gap between the notice and the drawer: one token, read by the
          // band's column and by whatever else needs to clear the dock (the 3-5
          // zoom confetti).
          "--hud-dock-gap": `${HUD_DOCK_GAP}px`,
        } as CSSProperties
      }
    >
      {/* THE TOP BAND — OUTSIDE THE STAGE (owner's composition, 27/10,
          `chrome-v2` §12.1). It is a sibling of the stage, in the frame's flow
          above it: the workspace selector stops floating over the paper and the
          frame gives it a row of its own. The stage below is exactly what is
          left, so nothing permanent hangs over the ink up here anymore.

          IT RENDERS NOTHING WHEN IT HAS NOTHING TO SAY: 3-5 without a workspace
          switch draws no band at all (0dp) and the air goes back to the paper,
          instead of becoming an empty plate with a gutter. 9+ without a switch
          keeps the page's name — the band's only other content, and a label, not
          a door.

          IT DOES NOT FADE ON A STROKE: the band is outside the paper, so there is
          nothing to release while ink flows. Only the drawer moves on that
          signal.

          The band's height is declared, not inherited from what it holds: the
          gutter is 12dp and the content box is the chrome's target (44 on 9+,
          52 on 3-5), so `min-h-17` = 68 and `min-h-19` = 76 — the same height the
          row had, at both levels, whether the band carries the pill or only the
          page's name. `box-sizing: border-box` is why the number is 17/19 and not
          11/13: min-height counts the padding. The pill is centred on that box,
          so the deviation from the band's centre is 0dp at any width by
          construction — there is no flank left to weigh against it. */}
      {(switchable || !kids) && (
        <div
          data-testid="canvas-top-band"
          data-chip-count={chromeChips}
          data-row-pad={12}
          data-row-gap={4}
          className={cn(
            "relative z-20 flex shrink-0 items-center justify-center gap-1 p-3",
            kids ? "min-h-19" : "min-h-17",
          )}
        >
          {switchable ? (
            <WorkspaceSwitch active={workspace} kids={kids} onChange={openWorkspace} />
          ) : (
            <FitTitle text={page?.name ?? "Desenho livre"} onDark={paperKey === "grafite"} />
          )}
        </div>
      )}

      {/* THE STAGE — the paper and everything that floats over it. It ends where
          the bottom band begins, so the band is never over the sheet (the one
          invariant of `chrome-v2` §9). Since 27/10 nothing takes width from it:
          the rail is gone and the workspace band sits above, in the frame. */}
      <div data-testid="canvas-stage" className="relative min-h-0 flex-1">
        {/* Two surfaces, under every overlay: the DESK is the whole canvas (its
            material is the paper appearance, never the grid) and the PAGE is the
            artwork's own sheet, inset 16dp with a frame that is always on.
            A white page on a white desk was the defect; the margin, the frame
            and the tone are the fix, on every material. */}
        <div
          ref={setPaperEl}
          className="absolute inset-0"
          data-testid="paper-area"
          data-useful-width={sheetW}
        >
          {box.w > 0 && (
            <div
              data-testid="paper-view"
              data-paper="desk"
              data-paper-key={paperKey}
              data-desk-color={deskHex}
              data-desk-margin={SHEET_INSET}
              data-zoom={view.scale.toFixed(2)}
              data-sheet-width={sheetW}
              data-sheet-height={sheetH}
              className="absolute origin-top-left overflow-hidden"
              style={{
                left: originX,
                top: originY,
                width: sheetW,
                height: sheetH,
                backgroundColor: deskHex,
                transform: transformOf(view),
                touchAction: "none",
                cursor: tool === "fill" ? "pointer" : "crosshair",
              }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={(e) => onUp(e)}
              onPointerCancel={(e) => onUp(e, true)}
            >
              {/* The desk is a surface with a job: the bucket paints it. */}
              <div
                data-testid="desk-surface"
                className="paper-grain absolute inset-0"
                style={{ backgroundColor: deskHex }}
              >
                <div
                  data-testid="page-area"
                  data-paper-tone={paperTone}
                  data-paper-texture={paperLook.texture}
                  className="absolute overflow-hidden"
                  style={{
                    left: pageLeft,
                    top: pageTop,
                    width: pageW,
                    height: pageH,
                    borderRadius: 6,
                    backgroundColor: PAPER_TONE_HEX[paperTone],
                    boxShadow: PAGE_FRAME,
                  }}
                >
                  <ArtworkPaint
                    ref={paperBoxRef}
                    pageId={art.pageId}
                    w={art.w}
                    h={art.h}
                    commands={
                      erasing
                        ? // The pass in flight rides on the document as a REAL
                          // command: the painters drop the same stamps they will
                          // drop on release, so the preview is the result.
                          [...history.commands, areaCommandOf(erasing, brushSize)]
                        : history.commands
                    }
                    live={live}
                    interactiveRegions={tool === "fill" || tool === "eraser"}
                    paperHex={pageMaterial.paperHex}
                    paperPattern={pageMaterial.pattern}
                    paperTexture={paperLook.texture}
                    outlineHex={pageMaterial.outline}
                    // The grid is a GUIDE, never the paper's material and never a
                    // command: it rides the sheet's own SVG (same viewBox, same
                    // origin), so it zooms with the paper. The export never passes
                    // it — `exportArtwork` has no parameter for it at all.
                    gridGuide={gridGuide ?? undefined}
                    className="block h-full w-full"
                    style={{ touchAction: "none" }}
                    label={page ? `Página para colorir: ${page.name}` : "Folha em branco"}
                  />
                </div>
                {/* The answer to a tap the tool could not paint: the page pulses
                  once, outside its clipping box so the ring is fully visible. */}
                {nudge > 0 && (
                  <span
                    key={nudge}
                    aria-hidden
                    data-testid="page-nudge"
                    data-nudge={nudge}
                    className="page-nudge pointer-events-none absolute"
                    style={{
                      left: pageLeft,
                      top: pageTop,
                      width: pageW,
                      height: pageH,
                      borderRadius: 6,
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* THE TOP ROW USED TO LIVE HERE (owner's composition, 27/10,
          `chrome-v2` §12). It was an ABSOLUTE overlay inside the stage: the undo
          pair on the left, the workspace pill on the centre, the hamburger on the
          right, and `Voltar` floating over the frame's edge below it. The owner
          revoked the rail and the hamburger, moved the selector OUT of the stage
          into the band above, and put the undo pair inside the sheet (9+) and into
          the compact preview row (3-5). It is recorded here because the absence is
          the design: nothing permanent hangs over the paper at the top. */}

        {/* INÍCIO IS NOT HERE (owner's decision, 2026-10-27, 2nd round). It is
          the most used control of the screen and it cannot cost the tap of opening
          a menu, so it lives in the BOTTOM BAND — the left end of the two targets
          at thumb reach, under the sheet and never over it. Same 44/52dp plate,
          same `tapBack`, same 550ms clear hold, same ring and same accessible name
          (which since the 27/10 feedback names the house it draws, not a step
          back). */}

        {/* THE PANEL DOOR is not a control of the desk either (owner's report,
          27/10): it is the drawer's LATCH, a child of the drawer's top edge,
          centred horizontally and glued to the border it opens (`DockLatch`,
          rendered by the compact bar and by the sheet alike). */}

        {/* THE ZOOM INDICATOR (owner's decision, 27/10): it is not in the panel —
          "eu não abriria o painel para controlar o zoom" — and it is not a
          permanent corner either. It is DATA over the paper, up while a pinch is
          in flight and for a second and a half after it lets go, anchored at the
          base of the sheet. The container takes no pointer: only the two
          targets do, so a hand that lands on the number paints on the paper. */}
        {zoomHud && (
          <div
            data-testid="zoom-hud"
            data-percent={Math.round(view.scale * 100)}
            className={cn(
              "pointer-events-none absolute bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center",
              !reduced && "animate-pop-in",
            )}
          >
            <div className="pointer-events-none flex items-center gap-0.5 rounded-full bg-card/95 px-1 shadow-tile backdrop-blur">
              <ZoomTarget
                label="Diminuir zoom"
                kids={kids}
                testid="zoom-out"
                onClick={() => zoomBy(1 / ZOOM_STEP)}
              >
                <Minus className={kids ? "h-6 w-6" : "h-4 w-4"} />
              </ZoomTarget>
              {/* THE NUMBER IS DATA: a neutral face with `tabular-nums`, so the
                readout never changes width between 100% and 145%. */}
              <span
                data-testid="zoom-value"
                aria-live="off"
                className="min-w-[3.5ch] text-center font-mono text-[13px] tabular-nums text-foreground"
              >
                {Math.round(view.scale * 100)}%
              </span>
              <ZoomTarget
                label="Aumentar zoom"
                kids={kids}
                testid="zoom-in"
                onClick={() => zoomBy(ZOOM_STEP)}
              >
                <Plus className={kids ? "h-6 w-6" : "h-4 w-4"} />
              </ZoomTarget>
            </div>
          </div>
        )}

        {/* 3–5 opens the same readout by TOUCH (owner's decision, §5): a pinch is
          two coordinated hands and does not exist at three years old. It is an
          AREA, not a visible control — no glyph, no ink — in the corner where
          the magnifier used to be. */}
        {kids && (
          <button
            type="button"
            aria-label="Ver o zoom"
            data-testid="zoom-tap"
            onClick={showZoomHud}
            className="absolute bottom-3 right-3 z-30 h-13 w-13 rounded-full"
          />
        )}

        {kids && zoomPing > 0 && <ZoomConfetti key={zoomPing} />}

        {/* First-run demonstration: the hand traces once, the first touch stops it. */}
        {kids && (
          <DemoHint
            kind="canvas"
            className="left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2"
          />
        )}

        {/* The panel is a sheet over the paper, never a layout change: the scrim
          dims the canvas and chrome, and the paper's box is exactly the same
          before and after it opens. Tapping the scrim always returns to the
          canvas in the PILL (owner's rule, 25/10) — from the compact bar and
          from the full sheet alike. A single tap on the paper should never
          leave the toolbar half-open, and it should never paint a stray dot. */}
        {!drawing && dockState !== "mini" && (
          <button
            type="button"
            // The label is the TAP, not the panel: the latch owns the name "Fechar
            // painel", and two controls answering to the same name is how a screen
            // reader user meets the same door twice (checked in
            // `dock-comutador.test.tsx`).
            aria-label="Toque fora para fechar o painel"
            data-testid="dock-scrim"
            onClick={() => openDock("mini")}
            className={cn("absolute inset-0 z-[25] bg-nanquim/25", !reduced && "animate-scrim-in")}
          />
        )}

        {/* THE SIDE RAIL USED TO LIVE HERE (owner's revocation, 27/10,
          `chrome-v2` §12). It slid from the right and took its width from the
          sheet; what it carried went elsewhere: undo/redo into the sheet's own
          action bar (9+) and into the compact preview row (3-5), the workspace
          selector into the band above the stage, papel and grade into the sheet's
          own folds (`LookFolds` / `KidsLookSheet`), and `Voltar` into the bottom
          band. Nothing is left of the menu: the hamburger that opened it is gone
          too, which is why the screen has no `Menu` door at all. */}

        {/* THE BOTTOM IS THE DRAWER, and only the drawer (owner's decision, 27/10,
          from the `better-interface` review's HIGH finding on the HUD row).

          The band used to hold TWO children: the HUD row (magnifier at the left
          corner of the page, grid at the right) and the dock under it. Both were
          canvas chrome floating over the paper in EVERY state — 18.720dp² of
          band plus the ink of its two doors — and the magnifier's own pop added
          three more targets on top of that. The zoom, the grid and the paper's
          door live INSIDE the drawer now (`DockUtilities`): in the pill state
          the base is the pill and nothing else, which is 18.720dp² of band and
          ~3.200dp² of ink handed back to the sheet, permanently.

          What stays is the BOUND: the band starts at the STAGE's top edge
          (`data-dock-top` = 0) and its children pack against the bottom
          (`justify-end`). That bound is what makes the expanded sheet's height a
          contract instead of a guess: its own `max-height` is
          `100% − sheetReserve`, so however tall the stage is, the sheet's latch
          stops 8dp below the top — never over the band above, and never over the
          workspace selector that lives up there. Before 27/10 the bound started
          under the old top row; with that row out of the stage the whole height
          comes back to the sheet. Before that, the only limit was `56dvh`, which
          follows the WINDOW and not this frame.

          The band keeps its `canvas-hud-band` id (the suite's geometry reads it)
          even though the HUD row that named it is gone; `--hud-dock-gap` is the
          air between the notice and the drawer. */}
        <div
          data-testid="canvas-hud-band"
          data-dock-state={drawing ? "hidden" : dock}
          data-hud-gap={HUD_DOCK_GAP}
          data-dock-top={0}
          className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end gap-[var(--hud-dock-gap)]"
        >
          {/* THE WAY BACK FROM A CLEAR, said out loud (owner's decision, 27/10).
            The hold wipes the sheet; one undo puts it whole back (`doUndo`), and
            until now that was a fact nobody was told. The notice names what
            happened and offers the action where the hand already is, then leaves
            on its own (`CLEAR_NOTICE_MS`). It rides ABOVE the dock, in the band,
            so it never covers the paper or the drawer, and the dock stays glued
            to the bottom because the band packs its children downward.

            3–5 reads ZERO text (sem-texto-3-5): the child gets the undo target
            itself — a 52dp plate with the arrow that puts the drawing back —
            and no sentence at all. */}
          {notice && (
            <div
              data-testid="clear-notice"
              className="pointer-events-none mx-3 flex items-center justify-end gap-2"
            >
              {!kids && (
                <span
                  role="status"
                  aria-live="polite"
                  className="rounded-full bg-card/95 px-4 py-2 font-display text-foreground shadow-tile backdrop-blur"
                >
                  Obra apagada
                </span>
              )}
              <button
                type="button"
                onClick={doUndo}
                // NOT just "Desfazer": the sheet's own undo answers to that word
                // (the action bar on 9+, the preview row on 3–5), and two controls
                // answering to the same name is how a screen reader user meets the
                // same door twice. This one undoes the CLEAR, and it says so.
                aria-label="Desfazer a limpeza"
                data-testid="clear-undo"
                className={cn(
                  "pointer-events-auto flex shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-tile transition-transform duration-150 ease-out active:translate-y-0.5",
                  kids ? "h-13 w-13" : "h-11 w-11",
                )}
              >
                <Undo
                  className={kids ? "h-6 w-6" : "h-5 w-5"}
                  strokeWidth={STROKE.semibold}
                  data-glyph="undo"
                />
              </button>
            </div>
          )}

          {/* The compact bar and the sheet share ONE region id, and it rides on
            the box that actually holds the content. It used to sit on a
            `display: contents` wrapper, which generates no box: the switch's
            `aria-controls` named a region 0 px tall — a control that controlled
            nothing for a screen reader. The latch (`chrome-panel`) is the switch
            between the two levels and a child of that same region, so its
            `aria-controls` always resolves to the box it is glued to. */}
          {!drawing && dockState === "compact" ? (
            <CompactDock
              // The row is derived, never a portrait: it is the profile's own
              // `rowTools` (pins only where they were stored, or where the default
              // puts them), so the sheet can reorder it live. Kids carry their
              // five, pro carries the profile's own list.
              tools={paintRow()}
              tool={tool}
              color={color}
              kids={kids}
              size={brushSize}
              opacity={effectiveOpacity}
              spray={spray}
              onTool={pickTool}
              onSize={applySize}
              onColor={pickColor}
              onCollapse={() => openDock("mini")}
              onExpand={() => openDock("expanded")}
              latchOpen={panelOpen}
              onLatch={() => openDock(panelNext)}
              onLook={kids ? () => openDock("expanded") : undefined}
              onUndo={doUndo}
              onRedo={doRedo}
              canUndo={undoReady}
              canRedo={canRedoNow}
            />
          ) : null}
          {!drawing && dockState === "expanded" ? (
            /* On 3–5 the third level is the sheet's two LOOK folds and nothing
             else: no text, no tool, no palette (`chrome-v2` §4). 9+ gets the
             same two folds at the end of the pro sheet, after Cor/Sombra/Brilho. */
            kids ? (
              <KidsLookSheet
                look={paperLook}
                grid={gridLook}
                onPaper={applyPaper}
                onGrid={applyGrid}
                onClose={() => openDock("compact")}
              />
            ) : (
              <Panel
                tools={rowTools}
                catalog={panelTools}
                tool={tool}
                color={color}
                grouped={caps.ferramentasComplexas}
                opacity={opacity}
                water={water}
                hardness={hardness}
                effectiveOpacity={effectiveOpacity}
                brushSize={brushSize}
                spray={spray}
                sombra={sombra}
                brilho={brilho}
                gradient={gradient}
                allowEffects={caps.ferramentasComplexas && caps.gradienteEfeitos}
                secoes={secoes}
                scrollKey={profile.id}
                recent={profile.recentColors}
                favorites={profile.favoriteColors}
                simple={simplePalette}
                kidFamily={kidFamily}
                onKidFamily={setKidFamily}
                onTool={pickTool}
                onToggleSlot={toggleSlot}
                onMoveSlot={moveSlot}
                onSize={applySize}
                onOpacity={applyOpacity}
                onWater={applyWater}
                onHardness={applyHardness}
                onSpray={pickSpray}
                onSombra={applySombra}
                onBrilho={applyBrilho}
                onSection={setSection}
                onGradient={setGradient}
                onColor={pickColor}
                onToggleFavorite={toggleFavorite}
                onUndo={doUndo}
                onRedo={doRedo}
                canUndo={undoReady}
                canRedo={canRedoNow}
                onCollapse={() => openDock("compact")}
                look={{ paper: paperLook, grid: gridLook }}
                onPaper={applyPaper}
                onGrid={applyGrid}
              />
            )
          ) : null}

          {/* THE PILL LIVES IN THE BAND, not here: the band is the one place of
            permanent chrome on this screen (`chrome-v2` §9), and the drawer is a
            surface raised ABOVE it. */}
        </div>
      </div>

      {/* THE BOTTOM BAND (owner's decision, 2026-10-27, `chrome-v2` §9, revised
          by §12.1). It is the only permanent chrome over the desk now that the
          selector went above the stage, it lives OUTSIDE the paper's area in every
          state and at every width, and it carries the TWO targets of thumb reach
          in a fixed order:

              [ Início ]              [ pílula de ferramentas ]

          `Início` on the left because it is the most used control of the screen
          (owner's decision, 27/10: a house, not an arrow — the canvas is one
          level below the home, and leaving it is going back HOME, not one step
          back); the pill in the centre because it is the one that alternates
          most. 44dp on 9+, 52dp on 3–5 — the same floor as every other door. The
          order is NOT a preference: the band changes size between bands, never
          shape.

          THE ☰ IS GONE (owner's revocation, §12): with the rail revoked the third
          target had nothing to open. The pill keeps its centring by GEOMETRY, not
          by a spacer box: the band is a `1fr · auto · 1fr` grid, so the two side
          columns weigh the same even with only `Início` drawn in the first and
          nothing in the third — the tools column is the band's centre at any
          width. Two targets in the DOM, one of them in the middle. */}
      <div
        data-testid="canvas-band"
        data-band="bottom"
        data-order="back,tools"
        data-target={kids ? KID_CHROME_TARGET : CHROME_TARGET}
        style={{ paddingBottom: "calc(var(--dock-safe-bottom) + 12px)" }}
        className="relative z-30 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-1 px-3 pt-3"
      >
        {/* THE WAY OUT, and the clear gesture with it (owner's decision, 27/10):
            a TAP goes home, a HOLD of `CLEAR_HOLD_MS` wipes the sheet — and the
            click the browser fires on release is swallowed, so one gesture has
            one consequence. The glyph is a HOUSE since 27/10 (owner's feedback:
            an arrow promised one step back, and the canvas sits directly under
            the home), and the accessible name follows it. The hold is announced
            out loud while there is something to erase, and the hairline ring is
            only drawn when the hold can actually do something. */}
        <ChromeDoor
          label={clearReady ? "Início — segure para apagar a obra" : "Início"}
          kids={kids}
          testid="chrome-back"
          data-seat="band-left"
          hint={clearReady ? "Toque para ir ao início · segure para apagar a obra" : "Início"}
          onClick={tapBack}
          onPointerDown={startClearHold}
          onPointerUp={stopClearHold}
          onPointerLeave={stopClearHold}
          onPointerCancel={stopClearHold}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "bg-card/90 backdrop-blur",
            clearReady && "ring-2 ring-foreground/20 ring-offset-[3px] ring-offset-transparent",
          )}
        >
          <House className={kids ? "h-6 w-6" : "h-5 w-5"} data-glyph="home" />
        </ChromeDoor>

        {/* The centre slot: the tools. */}
        <div
          data-testid="band-tools"
          className="pointer-events-none flex min-w-0 items-center justify-center"
        >
          {!drawing && dockState === "mini" ? (
            <MiniDock
              tool={tool}
              material={material}
              color={color}
              eraserSize={brushSize}
              kids={kids}
              materials={popMaterials}
              onTool={pickTool}
              onColor={(hex) => {
                // The pill's colour belongs to the MATERIAL: a tone chosen while
                // the eraser (or the dropper) is up returns to the thing that
                // paints, with that colour in its hand.
                paintWith(material, hex);
                if (tool !== material) setTool(material);
              }}
              onEraserSize={applySize}
              onExpand={() => openDock("compact")}
            />
          ) : null}
        </div>
      </div>

      {shared && (
        <div
          ref={sharedRef}
          aria-hidden
          data-testid="shared-sheet"
          data-from={`${Math.round(shared.from.x)},${Math.round(shared.from.y)},${Math.round(shared.from.w)},${Math.round(shared.from.h)}`}
          data-to={`${Math.round(shared.to.x)},${Math.round(shared.to.y)},${Math.round(shared.to.w)},${Math.round(shared.to.h)}`}
          className="pointer-events-none fixed left-0 top-0 z-30 bg-white shadow-paper"
          style={{
            width: shared.from.w,
            height: shared.from.h,
            transform: `translate(${shared.from.x}px, ${shared.from.y}px)`,
          }}
        />
      )}

      {/* The recording proof (P1, T-save): pill first, then the scrim, and only
          then the screen changes. A child sees the check, not a dialog. */}
      {leaving && (
        <>
          <div
            aria-hidden
            data-testid="save-scrim"
            className={cn("absolute inset-0 z-40 bg-nanquim/30", !reduced && "animate-scrim-in")}
          />
          <div
            role="status"
            aria-live="polite"
            aria-label={kids ? "Salvo" : undefined}
            data-testid="save-pill"
            className={cn(
              "absolute left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-card px-5 py-3 font-display text-foreground shadow-tile",
              !reduced && "animate-pop-in",
            )}
          >
            <Check className="h-5 w-5 text-pigmento" strokeWidth={STROKE.semibold} />
            {!kids && <span className="type-label-lg">Salvo</span>}
          </div>
        </>
      )}

      {celebrate && <Celebration onClose={() => setCelebrate(false)} />}
      <SaveDialog
        open={askSave}
        artwork={art}
        kids={kids}
        published={art.visibility === "published"}
        canPublish={caps.publicarMural}
        canDiscard
        onPublish={publishAndLeave}
        onDraft={draftAndLeave}
        onDiscard={discardAndLeave}
        onContinue={keepDrawing}
      />
    </div>
  );
}

/**
 * ONE DOOR OF THE CHROME (owner's call, 27/10). A 44dp plate on 9+ and a 52dp
 * plate on 3-5 — the two sizes every band is built on (`CHROME_TARGET`) — with
 * the same paper plate, hairline shadow and press as every other control of the
 * chrome. It draws the round doors that sit in a band: `Início` in the bottom
 * band and the undo/redo pair in the compact preview row (3-5).
 *
 * Two things this component exists to guarantee, both measured by the suite:
 *
 * 1. AN INERT DOOR IS STILL A DOOR. `disabled` + 35% opacity: undo without
 *    history and redo without a redo are DRAWN and refuse the tap. They never
 *    disappear, because a row whose corner changes shape between two strokes
 *    moves the finger that learned it.
 * 2. A SYNTHETIC PRESS CANNOT BYPASS `disabled`. The handlers themselves check
 *    the state they act on (see `doUndo`/`doRedo`), so automation and assistive
 *    tech that dispatch the event directly get the same "nothing to do" the
 *    pointer gets.
 */
function ChromeDoor({
  label,
  kids,
  testid,
  hint,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  kids: boolean;
  testid?: string | undefined;
  /** The tooltip when it has to say more than the name ("segure para …"). */
  hint?: string | undefined;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={hint ?? label}
      data-testid={testid}
      className={cn(
        "pointer-events-auto inline-flex shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-tile backdrop-blur transition-transform duration-150 ease-out",
        "active:translate-y-0.5 disabled:active:translate-y-0 disabled:opacity-35 disabled:shadow-none",
        kids ? "h-13 w-13" : "h-11 w-11",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * ONE DOOR OF THE CHROME — now that both bands use it: the bottom band's `Início`
 * and the compact preview row's undo/redo pair. It is NOT the sheet's own action
 * bar: that one is a `PanelAction` (a labelled plate, not a circle), because the
 * sheet names its controls with words.
 */

/**
 * THE DRAWER'S LATCH — the one control that changes the dock's level, drawn as a
 * child of the drawer's TOP EDGE (owner's report, 27/10).
 *
 * It used to float over the desk at the frame's top-right, ~200dp of desk above the
 * surface it opens (measured: 203dp to the bar, 185dp to the sheet), and the
 * panel's `aria-controls` pointed at a region it was not part of. Now it hangs
 * from the border (`bottom-full`), is centred on the drawer (`left-1/2` +
 * `-translate-x-1/2`) and therefore sits at the same x as the drawer's own centre
 * in BOTH levels — the compact bar is inset by `mx-3` on both sides, the sheet is
 * full-bleed, so the two share one centre line. It takes zero dp of the drawer's
 * content: it is outside the box, not padding pushed into it.
 *
 * Still a circle with a glyph, never a bar: a 32 × 4dp handle is decoration, and
 * in this app only a circle with a glyph reads as a button (the bar-shaped
 * handle was rejected for exactly that). Same 44dp on 9+ / 52dp on 3-5, same
 * glyph, same `aria-expanded` + `aria-controls`.
 *
 * `z-[26]` is kept on purpose: the panel's scrim is 25 and it closes the panel,
 * while this door changes its LEVEL — a door under the scrim would hand every
 * tap to the scrim. The whole dock band rides above the scrim (z-30), so the
 * latch is above it by construction; the number is the belt to that suspender.
 */
function DockLatch({
  open,
  kids,
  onToggle,
}: {
  /** What the control says about the level above the pill. */
  open: boolean;
  kids: boolean;
  onToggle: () => void;
}) {
  return (
    <ChromeDoor
      label={open ? "Fechar painel" : "Abrir painel de ferramentas"}
      kids={kids}
      testid="chrome-panel"
      data-seat="dock-top"
      aria-expanded={open}
      aria-controls="canvas-dock-region"
      onClick={onToggle}
      className="absolute bottom-full left-1/2 z-[26] -translate-x-1/2 bg-card/90 backdrop-blur"
    >
      <PanelBottom
        className={kids ? "h-6 w-6" : "h-5 w-5"}
        strokeWidth={STROKE.semibold}
        data-glyph="panel"
        aria-hidden
      />
    </ChromeDoor>
  );
}

/**
 * The canvas title, elastic instead of truncated. Five chrome actions leave a
 * pro phone frame ~96dp for the name, and a title that ends in "…" is a page
 * the author cannot identify. The label keeps its natural width and is scaled
 * down to the space that exists (transform only, so it never reflows the row);
 * it never wears an ellipsis. The full name stays in the tooltip and in the
 * text node for assistive tech.
 */
const TITLE_MIN_SCALE = 0.6;

function FitTitle({ text, onDark = false }: { text: string; onDark?: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = host.current;
    const node = label.current;
    if (!box || !node) return;
    let cancelled = false;
    const fit = () => {
      if (cancelled) return;
      const avail = box.clientWidth;
      const natural = node.scrollWidth;
      // jsdom has no layout: keep the label at its base size, never collapse.
      if (avail <= 0 || natural <= 0) return;
      const next = Math.min(1, avail / natural);
      setScale(next >= 0.995 ? 1 : Math.max(TITLE_MIN_SCALE, next));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    // The display face swaps after first paint on some devices: re-measure.
    void document.fonts?.ready.then(fit).catch(() => {});
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [text]);

  return (
    <span
      ref={host}
      data-testid="canvas-title"
      data-title-scale={scale.toFixed(2)}
      title={text}
      className="relative flex h-6 w-full min-w-0 items-center justify-center overflow-hidden"
    >
      <span
        ref={label}
        className={cn(
          "type-label-lg absolute left-1/2 top-1/2 whitespace-nowrap font-display",
          onDark ? "text-background/80" : "text-foreground/75",
        )}
        style={{ transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: "center" }}
      >
        {text}
      </span>
    </span>
  );
}

/**
 * The two sheets of the workspace pill (`workspace-switcher` §4). The OUTLINE is
 * the same for both on purpose: the difference is what is inside the paper — a
 * blank sheet in hand, or a coloring page with one motif in the accent ink. Two
 * different outlines would read as two different objects; one outline with the
 * motif inside reads as the same sheet in two states. Both bands mount this
 * drawing (owner's decision, 27/10), which is what makes the pill 92dp wide
 * instead of the 178,22dp its two names measured.
 */
function SheetGlyph({
  painted,
  size = WORKSPACE_GLYPH,
  className,
}: {
  painted: boolean;
  /** The drawing's own box, in dp — the number the pill's width is built on. */
  size?: number;
  className?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE.regular}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      data-glyph={painted ? "sheet-painted" : "sheet-blank"}
    >
      <path d="M6 3.5h7L17.5 8v12.5H6z" />
      <path d="M13 3.5V8h4.5" />
      {painted && <circle cx="11.5" cy="15.5" r="2.6" fill="currentColor" stroke="none" />}
    </svg>
  );
}

/**
 * The workspace pill at the top of the canvas (owner's decision, 27/10,
 * `workspace-switcher` §1-§4): two positions, never a menu, never a route.
 *
 * The sheet IN HAND is inverted — its surface is the ink and its content is the
 * paper — and the other one is idle ink over the pill's paper. Inverting only
 * the content would leave the two segments looking the same, and a control with
 * no visible state is not a control.
 *
 * Geometry is the spec's own: 40dp of height, full radius, 10dp of horizontal
 * padding per segment, 4dp between them. The TOUCH target grows instead of the
 * drawing — 4dp above and below on 9+ (48dp) and 6dp on 3-5 (52dp) — because a
 * pill taller than its band would push the paper. Each segment is therefore 44dp
 * wide, the same floor as every door of the chrome.
 *
 * Since 27/10 the pill has ONE home: the band above the stage (`chrome-v2` §12).
 * It used to be mounted twice — here and in the rail's column — and the duplicate
 * is gone with the rail.
 *
 * 3-5 reads zero text, and since 27/10 so does 9+ (owner's decision): the same
 * segments carry the two sheets and not one word in EITHER band, so
 * `textContent` of this control is empty. The names survive as `aria-label`,
 * which is an attribute, never a node. That is also what keeps the band within a
 * 360dp phone: two 24dp glyphs and their padding measure 92dp against the
 * 178,22dp the two names measured (see `WORKSPACE_PILL_WIDTH`).
 */
function WorkspaceSwitch({
  active,
  kids,
  onChange,
}: {
  active: Workspace;
  kids: boolean;
  onChange: (next: Workspace) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Workspace"
      data-testid="workspace-switcher"
      data-orientation="horizontal"
      data-workspace-active={active}
      data-band={kids ? "kids" : "pro"}
      // The width the geometry DECLARES, so the band's budget is arithmetic the
      // suite can hold instead of a class it has to guess at.
      data-width={WORKSPACE_PILL_WIDTH}
      style={kids ? { backgroundColor: KID_WORKSPACE.plate } : undefined}
      className={cn(
        "pointer-events-auto flex h-10 shrink-0 items-center gap-1 rounded-full",
        !kids && "bg-card",
      )}
    >
      {WORKSPACES.map((option) => {
        const on = option.id === active;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            // Both bands: the name is an attribute, never a node.
            aria-label={option.label}
            data-testid={`workspace-option-${option.id}`}
            data-state={on ? "on" : "off"}
            // The kid band paints fixed inks (the card language is paper on
            // paper, in both schemes); 9+ paints the theme's own tokens, so the
            // pair is remeasured per scheme by the test.
            data-plate={kids ? (on ? KID_WORKSPACE.ink : KID_WORKSPACE.plate) : undefined}
            data-ink={kids ? (on ? KID_WORKSPACE.plate : KID_WORKSPACE.idle) : undefined}
            style={
              kids
                ? on
                  ? { backgroundColor: KID_WORKSPACE.ink, color: KID_WORKSPACE.plate }
                  : { color: KID_WORKSPACE.idle }
                : undefined
            }
            onClick={() => onChange(option.id)}
            className={cn(
              "relative flex h-10 shrink-0 items-center justify-center rounded-full px-2.5",
              // The target, not the pill: the extra ring of touch lives in a
              // pseudo-element, so the pill stays 40dp tall in both bands.
              kids
                ? "before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']"
                : "before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
              kids ? (on ? "" : "text-lapis") : on ? "bg-foreground text-card" : "text-lapis",
            )}
          >
            <SheetGlyph painted={option.id === "paint"} className="shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

const MINI_TARGET =
  "flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors duration-150 ease-out active:bg-muted";
/** Kids targets are 56dp (M3 Expressive), same three doors. */
const KID_TARGET =
  "flex h-14 w-14 items-center justify-center rounded-full text-foreground transition-colors duration-150 ease-out active:bg-muted";
/** The same two doors as NUMBERS, for the one place that measures a grid. */
const MINI_TARGET_DP = 44;
const KID_TARGET_DP = 56;

/**
 * One target of the inline zoom control: **44dp on 9+** and 56dp on 3–5.
 *
 * It was 40dp on 9+ — under this project's own floor, and on the control a hand
 * with less precision reaches for most (owner's decision, 27/10, straight from
 * the `better-interface` review). The floor is `CHROME_TARGET`: every door of
 * the chrome is 44, and a zoom target that was smaller than the door beside it
 * was a defect, not a density choice.
 */
function ZoomTarget({
  label,
  kids,
  testid,
  onClick,
  children,
}: {
  label: string;
  kids: boolean;
  testid?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testid}
      className={cn(
        "pointer-events-auto flex shrink-0 items-center justify-center rounded-full text-foreground transition-colors duration-150 ease-out active:bg-card",
        kids ? "h-14 w-14" : "h-11 w-11",
      )}
    >
      {children}
    </button>
  );
}

/**
 * ONE PARAMETER OF A LOOK FOLD: a labelled radio group. 9+ reads the three
 * words; 3–5 reads a MARK per state and never a letter (`sem-texto-3-5`). The
 * state is in the accessible name in both bands — never in the plate alone.
 */
function LookSegment<T extends string>({
  label,
  value,
  options,
  labels,
  marks,
  kids,
  testid,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  /** The 3–5 drawing of each state: no word ever reaches the screen there. */
  marks: (option: T, on: boolean) => ReactNode;
  kids: boolean;
  testid: string;
  onChange: (next: T) => void;
}) {
  return (
    <div
      data-testid={testid}
      data-value={value}
      className="flex items-center justify-between gap-2"
    >
      {!kids && <span className="type-label-md text-foreground">{label}</span>}
      <div
        role="radiogroup"
        aria-label={label}
        className={cn(
          "flex rounded-full border border-border bg-background p-0.5",
          kids ? "gap-1" : "gap-0.5",
        )}
      >
        {options.map((option) => {
          const on = option === value;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={labels[option]}
              data-option={option}
              data-state={on ? "on" : "off"}
              onClick={() => onChange(option)}
              className={cn(
                "flex items-center justify-center rounded-full transition-colors duration-150 ease-out",
                kids ? "h-11 w-11" : "type-label-md h-8 px-2.5",
                on ? "bg-foreground text-background" : "text-lapis",
              )}
            >
              {kids ? marks(option, on) : labels[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * THE SHEET'S TWO FOLDS, at the END of the pro sheet, after Cor/Sombra/Brilho
 * (owner's decision, 27/10, `chrome-v2` §4): `Grade` and `Papel`, each with its
 * three parameters and a chevron.
 *
 * The grid's SWITCH rides the fold's HEADER and is the only way in — the same
 * rule the two effects follow: with the guide off there is nothing to tune, so
 * the chevron refuses and the switch is what opens it. Papel has no switch: the
 * sheet always has a paper.
 */
function LookFolds({
  kids,
  look,
  grid,
  onPaper,
  onGrid,
}: {
  kids: boolean;
  look: PaperLook;
  grid: GridLook;
  onPaper: (patch: Partial<PaperLook>) => void;
  onGrid: (patch: Partial<GridLook>) => void;
}) {
  const gridSummary = [
    GRID_PATTERN_LABEL[grid.pattern],
    GRID_DENSITY_LABEL[grid.density],
    GRID_STRENGTH_LABEL[grid.strength],
  ]
    .join(" · ")
    .toLowerCase();
  return (
    <>
      <Fold
        id="grade"
        label="Grade"
        testid="fold-grade"
        summary={grid.on ? gridSummary : "Desligada"}
        open={grid.on && grid.open}
        locked={!grid.on}
        head={
          <EffectSwitch
            label="Ativar grade"
            checked={grid.on}
            onChange={(on) => onGrid({ on, open: on })}
          />
        }
        onToggle={() => {
          // Off, the disclosure is inert: the way in is the switch on the same
          // row, exactly like Sombra and Brilho.
          if (!grid.on) return;
          onGrid({ open: !grid.open });
        }}
      >
        <LookSegment
          label="Padrão"
          value={grid.pattern}
          options={GRID_PATTERNS}
          labels={GRID_PATTERN_LABEL}
          marks={(option) => <LookMark kind="pattern" value={option} />}
          kids={kids}
          testid="fold-grade-pattern"
          onChange={(pattern) => onGrid({ pattern })}
        />
        <LookSegment
          label="Densidade"
          value={grid.density}
          options={GRID_DENSITIES}
          labels={GRID_DENSITY_LABEL}
          marks={(option) => <LookMark kind="density" value={option} />}
          kids={kids}
          testid="fold-grade-density"
          onChange={(density) => onGrid({ density })}
        />
        <LookSegment
          label="Força"
          value={grid.strength}
          options={GRID_STRENGTHS}
          labels={GRID_STRENGTH_LABEL}
          marks={(option) => <LookMark kind="strength" value={option} />}
          kids={kids}
          testid="fold-grade-strength"
          onChange={(strength) => onGrid({ strength })}
        />
        {/* The cell the choice paints, in artwork units: a fact, not a control. */}
        <p
          className="type-label-sm font-mono tabular-nums text-lapis"
          data-testid="fold-grade-cell"
        >
          célula {GRID_CELL_UNITS[grid.density]} unidades
        </p>
      </Fold>

      <Fold
        id="papel"
        label="Papel"
        testid="fold-papel"
        summary={`${PAPERS[look.key].label} · ${PAPER_TEXTURE_LABEL[look.texture].toLowerCase()} · ${PAPER_TONE_LABEL[
          look.tone
        ].toLowerCase()}`}
        open={look.open}
        onToggle={() => onPaper({ open: !look.open })}
      >
        <LookSegment
          label="Material"
          value={look.key}
          options={PAPER_KEYS}
          labels={
            Object.fromEntries(PAPER_KEYS.map((key) => [key, PAPERS[key].label])) as Record<
              PaperKey,
              string
            >
          }
          marks={(option) => <LookMark kind="material" value={option} />}
          kids={kids}
          testid="fold-papel-material"
          onChange={(key) => onPaper({ key })}
        />
        <LookSegment
          label="Textura"
          value={look.texture}
          options={PAPER_TEXTURES}
          labels={PAPER_TEXTURE_LABEL}
          marks={(option) => <LookMark kind="texture" value={option} />}
          kids={kids}
          testid="fold-papel-texture"
          onChange={(texture) => onPaper({ texture })}
        />
        {/* THE TONE IS BLOCKED ON 3–5 (a kid's paper is neutral by ADR): the row
            is ABSENT there, not disabled — no text, and no control the band
            cannot use (`chrome-v2` §4). */}
        {!kids && (
          <LookSegment
            label="Tom"
            value={look.tone}
            options={PAPER_TONES}
            labels={PAPER_TONE_LABEL}
            marks={(option) => <LookMark kind="tone" value={option} />}
            kids={kids}
            testid="fold-papel-tone"
            onChange={(tone) => onPaper({ tone })}
          />
        )}
      </Fold>
    </>
  );
}

/** The state of one look parameter, drawn: 3–5 has no words. */
function LookMark({
  kind,
  value,
}: {
  kind: "pattern" | "density" | "strength" | "texture" | "tone" | "material";
  value: string;
}) {
  if (kind === "material" || kind === "tone") {
    const hex =
      kind === "material"
        ? (PAPERS[value as PaperKey]?.swatch ?? "#FFFFFF")
        : (PAPER_TONE_HEX[value as PaperTone] ?? "#FFFFFF");
    return (
      <span
        aria-hidden
        data-mark={kind}
        data-hex={hex}
        className="h-5 w-5 rounded-full border border-current/30"
        style={{ backgroundColor: hex }}
      />
    );
  }
  if (kind === "texture") {
    const lines = value === "lisa" ? 0 : value === "media" ? 2 : 4;
    return (
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden data-mark="texture">
        <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {Array.from({ length: lines }, (_, i) => (
          <path
            key={i}
            d={`M${4 + i * 3} 14L${10 + i * 3} 6`}
            stroke="currentColor"
            strokeWidth={STROKE.regular}
          />
        ))}
      </svg>
    );
  }
  if (kind === "strength") {
    return (
      <span aria-hidden data-mark="strength" className="flex h-5 w-5 items-center justify-center">
        <span
          className="h-3 w-3 rounded-sm bg-current"
          style={{ opacity: value === "sutil" ? 0.35 : 1 }}
        />
      </span>
    );
  }
  if (kind === "density") {
    const side = value === "fina" ? 7 : value === "media" ? 10 : 13;
    return (
      <span aria-hidden data-mark="density" className="flex h-5 w-5 items-center justify-center">
        <span className="border border-current" style={{ width: side, height: side }} />
      </span>
    );
  }
  // The lattice itself, at the same 16-unit grammar the sheet paints.
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden data-mark="pattern">
      {value === "quadrado" && (
        <path
          d="M3 3h14v14H3zM3 10h14M10 3v14"
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE.regular}
        />
      )}
      {value === "pontilhado" && (
        <g fill="currentColor">
          {[4, 10, 16].map((y) =>
            [4, 10, 16].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />),
          )}
        </g>
      )}
      {value === "linhas" && (
        <path
          d="M3 6h14M3 12h14M3 18h14"
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE.regular}
        />
      )}
    </svg>
  );
}

/**
 * 3–5's SECOND LEVEL: the same two folds of the intermediate panel, with no
 * text at all (owner's decision, 27/10, `chrome-v2` §4). The heads are glyphs
 * that open their own body (`aria-expanded` is what says the state out loud);
 * the bodies are the same `LookSegment`s, drawn as marks.
 *
 * The paper's TONE does not exist here: a kid's paper is neutral by ADR.
 */
function KidsLookSheet({
  look,
  grid,
  onPaper,
  onGrid,
  onClose,
}: {
  look: PaperLook;
  grid: GridLook;
  onPaper: (patch: Partial<PaperLook>) => void;
  onGrid: (patch: Partial<GridLook>) => void;
  onClose: () => void;
}) {
  useEscapeOverlay(onClose);
  return (
    <div
      data-sheet-reserve={sheetReserveOf(true)}
      style={{ maxHeight: `calc(100% - ${sheetReserveOf(true)}px)` }}
      className="pointer-events-auto flex w-full min-h-0 flex-col"
    >
      <div
        id="canvas-dock-region"
        role="dialog"
        aria-modal="false"
        aria-label="Aparência"
        data-testid="kids-look"
        className="animate-slide-up relative flex min-h-0 flex-auto flex-col rounded-t-[var(--dock-sheet-radius)] border-t border-border bg-card/97 backdrop-blur"
      >
        <DockLatch open kids onToggle={onClose} />
        <div className="dock-scroll min-h-0 max-h-[56dvh] flex-auto space-y-3 overflow-y-auto px-4 pb-6 pt-2">
          {kidsFold({
            id: "grade",
            label: "Grade",
            open: grid.on && grid.open,
            expanded: grid.on,
            head: (
              <button
                type="button"
                aria-label={grid.on ? "Grade ligada" : "Grade desligada"}
                aria-pressed={grid.on}
                data-testid="kids-fold-grade-switch"
                onClick={() => onGrid({ on: !grid.on, open: !grid.on })}
                className={cn(
                  "flex h-13 w-13 items-center justify-center rounded-full",
                  grid.on ? "bg-foreground text-background" : "bg-muted text-foreground",
                )}
              >
                <Grid3x3 className="h-6 w-6" />
              </button>
            ),
            onToggle: () => {
              if (!grid.on) {
                onGrid({ on: true, open: true });
                return;
              }
              onGrid({ open: !grid.open });
            },
            children: (
              <>
                <LookSegment
                  label="Padrão"
                  value={grid.pattern}
                  options={GRID_PATTERNS}
                  labels={GRID_PATTERN_LABEL}
                  marks={(option) => <LookMark kind="pattern" value={option} />}
                  kids
                  testid="kids-grade-pattern"
                  onChange={(pattern) => onGrid({ pattern })}
                />
                <LookSegment
                  label="Densidade"
                  value={grid.density}
                  options={GRID_DENSITIES}
                  labels={GRID_DENSITY_LABEL}
                  marks={(option) => <LookMark kind="density" value={option} />}
                  kids
                  testid="kids-grade-density"
                  onChange={(density) => onGrid({ density })}
                />
                <LookSegment
                  label="Força"
                  value={grid.strength}
                  options={GRID_STRENGTHS}
                  labels={GRID_STRENGTH_LABEL}
                  marks={(option) => <LookMark kind="strength" value={option} />}
                  kids
                  testid="kids-grade-strength"
                  onChange={(strength) => onGrid({ strength })}
                />
              </>
            ),
          })}
          {kidsFold({
            id: "papel",
            label: "Papel",
            open: look.open,
            expanded: true,
            head: (
              <button
                type="button"
                aria-label="Papel"
                aria-expanded={look.open}
                data-testid="kids-fold-papel-head"
                onClick={() => onPaper({ open: !look.open })}
                className="flex h-13 w-13 items-center justify-center rounded-full bg-muted text-foreground"
              >
                <SwatchBook className="h-6 w-6" />
              </button>
            ),
            onToggle: () => onPaper({ open: !look.open }),
            children: (
              <>
                <LookSegment
                  label="Material"
                  value={look.key}
                  options={PAPER_KEYS}
                  labels={
                    Object.fromEntries(PAPER_KEYS.map((key) => [key, PAPERS[key].label])) as Record<
                      PaperKey,
                      string
                    >
                  }
                  marks={(option) => <LookMark kind="material" value={option} />}
                  kids
                  testid="kids-papel-material"
                  onChange={(key) => onPaper({ key })}
                />
                <LookSegment
                  label="Textura"
                  value={look.texture}
                  options={PAPER_TEXTURES}
                  labels={PAPER_TEXTURE_LABEL}
                  marks={(option) => <LookMark kind="texture" value={option} />}
                  kids
                  testid="kids-papel-texture"
                  onChange={(texture) => onPaper({ texture })}
                />
              </>
            ),
          })}
        </div>
        {/* The way out is a glyph too: a child never reads "Feito". */}
        <div className="flex items-center justify-end border-t border-border px-4 pb-[var(--dock-sheet-pad-bottom)] pt-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Feito"
            data-testid="kids-look-done"
            className="flex h-13 w-13 items-center justify-center rounded-full bg-foreground text-background"
          >
            <Check className="h-6 w-6" strokeWidth={STROKE.semibold} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** One text-free fold of the 3–5 level: a glyph head, a chevron and a body. */
function kidsFold({
  id,
  label,
  open,
  expanded,
  head,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  /** The head can be pressed at all (the grid cannot while it is off). */
  expanded: boolean;
  head: ReactNode;
  onToggle: () => void;
  children: ReactNode;
}) {
  const region = `kids-${id}-regiao`;
  return (
    <div className="border-t border-border pt-2" data-testid={`kids-fold-${id}`}>
      <div className="flex items-center gap-2">
        {head}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={open ? region : undefined}
          aria-disabled={expanded ? undefined : "true"}
          aria-label={open ? `Fechar ${label}` : `Abrir ${label}`}
          data-testid={`kids-fold-${id}-chevron`}
          className="flex h-13 flex-1 items-center justify-end text-lapis"
        >
          {open ? (
            <ChevronUp className="h-6 w-6" aria-hidden />
          ) : (
            <ChevronDown className="h-6 w-6" aria-hidden />
          )}
        </button>
      </div>
      {open && (
        <div id={region} className="space-y-2 pt-2" data-testid={`kids-${id}-regiao`}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Four sparks, 420 ms: changing zoom is an event, not a silent number. */
function ZoomConfetti() {
  return (
    <span
      aria-hidden
      data-testid="zoom-confetti"
      className="pointer-events-none absolute bottom-20 left-10 z-10"
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="absolute h-2 w-2 animate-confetti rounded-full"
          style={{
            background: ["var(--ambar)", "var(--pigmento)", "var(--sun)", "var(--mint)"][i],
            animationDelay: `${i * 40}ms`,
            left: i * 10,
          }}
        />
      ))}
    </span>
  );
}

/**
 * The resting dock: one floating pill with THREE material doors and the way
 * into the bar — eraser, the material in hand, the colour in hand, and the
 * chevron that opens the compact bar. It is the whole dormant dock, not a
 * shrunk copy.
 *
 * The HIERARCHY is the whole point (owner's report, 27/10): the pill used to
 * draw the colour as a 28dp disc with a white inner ring, wider than the 26dp
 * glyphs beside it, so the loudest object in a tool bar was the one object that
 * is not a tool — it read as "this one is selected", and the tool actually in
 * hand read as nothing at all. Now:
 *
 *   tools   the door in hand carries the compact row's own mark (a flipped
 *           plate plus the ring, `PillPlate`), so the answer to "what am I
 *           holding" is on screen without reading the rest of the panel;
 *   colour  a property of that tool: 28dp, no ring, no plate, set 12dp apart
 *           from the tool group (`MINI_COLOR_BREATH`), so it can never be
 *           mistaken for the selected door.
 *
 * Tap uses directly; holding for 500 ms opens the mini-pop of that door
 * (mini-popovers.md): the eraser's 1..100 size, the other materials of the
 * profile (+ Ajustes on 9+), or the colour ladder of the colour in hand. One pop
 * at a time, Escape or a touch outside closes it, and choosing inside applies on
 * the spot and comes back to the pill — the first touch on the paper already
 * draws. The eraser's size applies as the slider moves and the pop stays open
 * while the hand is on it.
 */
const HOLD_MS = 500;

/**
 * The pill's own drawing sizes, in dp, and the air that separates a TOOL from
 * the COLOUR (owner's report, 27/10): the colour was a 28dp disc with a white
 * inner ring, wider than the 26dp glyphs beside it, so the loudest thing in the
 * pill was the one thing that is not a tool. It read as "selected".
 *
 * The rule now: a tool carries the compact row's own mark (the flipped plate and
 * the ring — `activePlate`), and the colour is a PROPERTY of the tool in hand —
 * a 28dp swatch with no ring, set 12dp apart from the tool group. Same numbers
 * in both bands; on 3-5 the drawing inside the card is 40dp (the kid band's own
 * measured spec: the object fills its card), so there the swatch comes out
 * smaller than the glyph — never larger, which is the reading the rule guards.
 */
const MINI_GLYPH = 28;
/** The plate under a 9+ glyph: the glyph plus the 4dp the ring's offset needs. */
const MINI_PLATE = 36;
/** The 3-5 card and its drawing — unchanged from the kid band's own spec. */
const KID_PILL_GLYPH = 40;
/** The colour's size in both bands: a property weighs a glyph, never more. */
const MINI_COLOR_SWATCH = 28;
const MINI_COLOR_BREATH = 12;
/**
 * The two pops' one rhythm, in dp: the ladder's own gap (`COLOR_GAP`, imported)
 * for the colours, and the same 8 for the materials — two grids of one pill do
 * not get to invent two distances between their cells.
 */
const MINI_MATERIAL_GAP = 8;
/**
 * The popover's own gutter, in dp — the `p-2` the card used to carry as a class.
 * It is a NUMBER now because the pop's width is computed from it: with the
 * border-box the app uses, a 304dp grid inside a 304dp box would be clipped by
 * the padding, which is the very defect the owner reported. The box is the
 * content PLUS this gutter on each side.
 */
const MINI_POP_PAD = 8;

/**
 * The pill's one selection language, borrowed whole from the compact row
 * (`compacta-alvos` §11.2): the door in hand takes a DIFFERENT SURFACE — the
 * 9+ plate flips from the theme's muted paper to its ink, the 3-5 card flips to
 * its own ink — and the ring follows the new surface, so the edge survives the
 * flip. A ring alone was already rejected there; it is not reintroduced here.
 *
 * The plate is a child of the target, not the target: `ring-offset-2` around a
 * 44dp door would be 52dp tall inside a 48dp pill. The 36dp plate (40 on 3-5)
 * keeps the mark inside the capsule and still leaves the touch target whole.
 */
function PillPlate({
  skin,
  kids,
  on,
  children,
}: {
  /** The material's own paper card (3-5 only); absent on 9+, which paints the theme. */
  skin: MaterialPlate | null;
  kids: boolean;
  on: boolean;
  children: ReactNode;
}) {
  // One number for the box, so the plate cannot drift from the ring it has to
  // hold: 36 on 9+ (28 of glyph + the ring's 8), 40 on 3-5 (the card's own size).
  const size = kids ? KID_PILL_GLYPH : MINI_PLATE;
  return (
    <span
      aria-hidden
      data-plate-state={on ? "on" : "off"}
      data-plate={skin?.plate}
      data-ink={skin?.ink}
      data-plate-size={size}
      style={{ ...(skin ? plateStyle(skin) : {}), width: size, height: size }}
      className={cn(
        "relative flex shrink-0 items-center justify-center transition-colors duration-150 ease-out",
        kids ? "rounded-[14px]" : "rounded-[10px]",
        !kids && (on ? "bg-foreground text-card" : "bg-muted text-foreground"),
        on && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
      )}
    >
      {skin && <PlateRim plate={skin} />}
      {children}
    </span>
  );
}

type MiniPopKind = "eraser" | "material" | "color";

/**
 * THE COLOUR POP GREW INTO A PICKER (owner's feedback, 27/10). It used to carry
 * the compacta's ladder cut down to the pill's own width — `max-w-[calc(100%-16px)]`
 * measured against a ~208dp pill, so the 304dp grid was clipped at both ends and
 * the outer cells were unreachable. A popover grows to fit what it holds; it
 * never cuts the control it opened for.
 *
 * What it holds is now TWO pieces, both already known from the compact bar:
 *
 *  1. the SPECTRUM strip — the very implementation the compacta uses
 *     (`CompactSpectrum`, exported for this), scrubbed to rotate the hue of the
 *     colour in hand. One strip, one behaviour, two homes.
 *  2. the compacta's ladder, number for number: white, the ten rungs 50…950 of
 *     the colour in hand, black — twelve cells in 6 + 6, one 44dp cell and an
 *     8dp gap. The same 304dp row the compact bar draws.
 *
 * NO NUMERIC LABEL BAND (owner's feedback, 27/10): 9+ used to read each step
 * inside its own cell, and the pop was a scale before it was a picker. The
 * numbers are gone on every band — the cells are read by eye, and the two ends
 * keep the only names that cannot be wrong ("Branco", "Preto"); the ten middle
 * cells announce their POSITION, never a value. 3–5 keeps reading zero text.
 *
 * The numbers are the compacta's own, IMPORTED — `COLOR_CELL`, `COLOR_GAP`,
 * `COLOR_COLUMNS` and the rest — because two blocks that must match cannot each
 * trust a different spelling of the same number. The account: 6 · 44 + 5 · 8 =
 * 304dp of ladder, and the pop's 8dp of padding each side makes 320, inside the
 * 366dp a 390dp phone leaves after the band's 12dp gutters (336 at the narrow
 * 360 band). Six columns fit at both widths; no rung has to be cut.
 */
function MiniColorLadder({
  color,
  kids,
  onPick,
  onScrub,
}: {
  /** The colour in hand: the ten middle rungs are its own ramp. */
  color: string;
  kids: boolean;
  /** A cell: applies the colour and puts the pop away. */
  onPick: (hex: string) => void;
  /** The strip: rotates the hue live and keeps the pop open. */
  onScrub: (hex: string) => void;
}) {
  const cells = useMemo(
    () => [
      { hex: WHITE.hex },
      ...derivedRamp(color, COMPACT_LIGHTNESS).map((hex) => ({ hex })),
      { hex: BLACK.hex },
    ],
    [color],
  );
  return (
    <div
      data-testid="mini-color-content"
      data-width={COLOR_ROW_WIDTH}
      className="flex flex-col gap-2"
      style={{ width: COLOR_ROW_WIDTH }}
    >
      {/* The strip's 24dp track inside its 48dp band: the same control the
          compact bar carries, so the hue a hand learned there works here. */}
      <CompactSpectrum color={color} kids={kids} onPick={onScrub} testid="mini-spectrum" />
      <div
        data-testid="mini-color-ladder"
        data-columns={COLOR_COLUMNS}
        data-rows={COLOR_ROWS}
        data-cell={COLOR_CELL}
        data-gap={COLOR_GAP}
        data-count={cells.length}
        data-width={COLOR_ROW_WIDTH}
        role="radiogroup"
        aria-label="Tons da cor"
        className="grid w-full justify-center justify-items-center"
        style={{
          gridTemplateColumns: `repeat(${COLOR_COLUMNS}, ${COLOR_CELL}px)`,
          gap: `${COLOR_GAP}px`,
        }}
      >
        {cells.map((cell, index) => {
          const on = cell.hex.toUpperCase() === color.toUpperCase();
          // Positional, like every other swatch — except the two ends, whose
          // value needs no guess. 3–5 never hears a name with a value in it; the
          // hex itself stays out of that band's DOM, as it does in the bar.
          const label = kids
            ? `cor ${index + 1} de ${cells.length}`
            : index === 0
              ? "Branco"
              : index === cells.length - 1
                ? "Preto"
                : `tom ${index + 1} de ${cells.length}`;
          return (
            <button
              key={`${cell.hex}-${index}`}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={label}
              data-testid="mini-color-cell"
              {...(kids ? {} : { "data-hex": cell.hex })}
              onClick={() => onPick(cell.hex)}
              style={{ width: COLOR_CELL, height: COLOR_CELL }}
              className={cn(
                "relative flex flex-col items-center rounded-[12px] border border-border/60 transition-transform duration-150 ease-out active:scale-[0.96]",
                on && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
              )}
            >
              {/* The whole cell minus its own 1dp frame: with no label band the
                  swatch IS the target, on both bands. */}
              <span
                aria-hidden
                data-swatch=""
                style={{
                  background: cell.hex,
                  height: COLOR_CELL - 2 * COLOR_EDGE,
                }}
                className="w-full shrink-0 rounded-[10px]"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniDock({
  tool,
  material,
  color,
  eraserSize,
  kids,
  materials,
  onTool,
  onColor,
  onEraserSize,
  onExpand,
}: {
  tool: CanvasTool;
  /** The material in hand — the pill keeps it even while the eraser is up. */
  material: CanvasTool;
  color: string;
  /** The thickness in hand, 1..100 — the same number the bar's capsule edits. */
  eraserSize: number;
  kids: boolean;
  /**
   * O que o pop lista: SÓ material de pintura, na ordem do catálogo, já
   * filtrado por quem chama (`popMaterials`). O balde e a borracha não entram:
   * os dois já são alvos fixos desta pílula, e repeti-los aqui seria a mesma
   * porta duas vezes.
   */
  materials: CanvasTool[];
  onTool: (tool: CanvasTool) => void;
  onColor: (hex: string) => void;
  onEraserSize: (size: number) => void;
  /** The door to the compact bar. */
  onExpand: () => void;
}) {
  const [pop, setPop] = useState<MiniPopKind | null>(null);
  const holdTimer = useRef<number | null>(null);
  /** The click that follows a completed hold must not also use the door. */
  const holdFired = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useEscapeOverlay(() => setPop(null), pop !== null);

  const stopHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };
  useEffect(() => stopHold, []);
  // A touch anywhere else closes the pop. The touch still does whatever it
  // does on the paper (each touch applies at once, mini-popovers §0).
  useEffect(() => {
    if (!pop) return;
    const onDown = (event: PointerEvent) => {
      if (root.current?.contains(event.target as Node)) return;
      setPop(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pop]);

  const beginHold = (kind: MiniPopKind) => {
    stopHold();
    // One pop at a time: touching another door puts the open one away before
    // its own timer even starts.
    setPop(null);
    holdFired.current = false;
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      holdFired.current = true;
      setPop(kind);
    }, HOLD_MS);
  };
  /** A tap uses the door; the release after a hold is swallowed. */
  const tap = (action: () => void) => () => {
    if (holdFired.current) {
      holdFired.current = false;
      return;
    }
    setPop(null);
    action();
  };
  const choose = (action: () => void) => () => {
    setPop(null);
    action();
  };
  /** A ladder cell picks a colour: applied on the spot, back to the pill. */
  const chooseColor = (hex: string) => {
    setPop(null);
    onColor(hex);
  };

  const brush = shelfBrushOf(material);
  const label = brush?.label ?? (material === "fill" ? "Pintar" : "Conta-gotas");
  const target = kids ? KID_TARGET : MINI_TARGET;
  /**
   * O POP DE MATERIAL LISTA SÓ MATERIAL (decisão do dono, 27/10).
   *
   * Ele listou o catálogo inteiro do perfil — balde e borracha incluídos —, e
   * isso punha a mesma porta duas vezes nesta pílula: os dois já são alvos
   * fixos ali do lado (e a borracha o dono já tinha reclamado). O que sobra é o
   * material de pintura, na ordem do catálogo, com o material em mãos marcado.
   *
   * A grade fecha por COLUNA, não por número de portas: seis no 9+ (nove leem
   * 6 + 3), cinco no 3–5 (os três da faixa, uma linha). A célula é a porta da
   * faixa — 44dp / 56dp, os dois `MINI_TARGET` — e o vão é o 8dp da escada,
   * então os dois pops desta pílula dividem um ritmo só em vez de cada um
   * inventar um tamanho. A conta não mudou: 6 · 44 + 5 · 8 = 304dp no 9+,
   * 5 · 56 + 4 · 8 = 312dp no 3–5, ambos dentro dos 336dp que a moldura de
   * 360dp deixa depois das sarjetas de 12dp. Como a largura é a da GRADE, ela
   * também não encolhe quando a faixa tem menos portas.
   */
  const materialCell = kids ? KID_TARGET_DP : MINI_TARGET_DP;
  const materialColumns = kids ? 5 : 6;
  const materialWidth = materialColumns * materialCell + (materialColumns - 1) * MINI_MATERIAL_GAP;

  /**
   * The pop's own width, in dp — the block it holds, never the trigger's, plus
   * the gutter on each side. The defect this closes (owner's feedback, 27/10):
   * `max-w-[calc(100%-16px)]` measured the PILL (~208dp) and clipped the 304dp
   * ladder at both ends. The eraser pop keeps its natural width; the two grids
   * declare theirs. 304 + 2 · 8 = 320dp of card — the content is never the box,
   * because the border-box would eat the padding out of the grid.
   */
  const popContent = pop === "color" ? COLOR_ROW_WIDTH : pop === "material" ? materialWidth : null;
  const popWidth = popContent === null ? null : popContent + 2 * MINI_POP_PAD;

  /**
   * The two doors that ARE tools, with their own skin. The plate is the kid
   * band's measured card (3-5) or the theme's (9+), and the door in hand flips
   * it (`activePlate`) — the same pair the compact row measures at >= 3:1.
   */
  const eraserOn = tool === "eraser";
  const eraserPlate = kids ? materialPlate("eraser", color) : null;
  const eraserSkin = eraserPlate && eraserOn ? activePlate(eraserPlate) : eraserPlate;

  const materialOn = tool === material;
  const materialPlateSkin = kids && brush ? materialPlate(brush.id, color) : null;
  const materialSkin =
    materialPlateSkin && materialOn ? activePlate(materialPlateSkin) : materialPlateSkin;

  /**
   * The contour that survives the surface it ends on: the kid card always keeps
   * its measured ink; on 9+ the flipped plate is the ink, so the contour takes
   * the card — the same trade the compact row makes.
   */
  const eraserInk = kids
    ? (eraserSkin?.ink ?? "var(--foreground)")
    : eraserOn
      ? "var(--card)"
      : "var(--foreground)";
  const materialInk = kids
    ? (materialSkin?.ink ?? "var(--foreground)")
    : materialOn
      ? "var(--card)"
      : "var(--foreground)";
  const pillGlyph = kids ? KID_PILL_GLYPH : MINI_GLYPH;

  return (
    <div ref={root} className="pointer-events-none relative flex justify-center">
      {pop && (
        <div
          className="pointer-events-auto absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2"
          data-testid="mini-pop"
          data-pop={pop}
          data-width={popWidth ?? 0}
          data-content-width={popContent ?? 0}
          style={popWidth ? { width: popWidth, padding: MINI_POP_PAD } : undefined}
        >
          <div
            role="dialog"
            aria-modal="false"
            aria-label={
              pop === "eraser"
                ? "Tamanho da borracha"
                : pop === "material"
                  ? "Trocar material"
                  : "Trocar cor"
            }
            data-testid={`mini-pop-${pop}`}
            className={cn(
              "rounded-[22px] bg-card/98 p-2 shadow-tile backdrop-blur-md",
              !reduced && "animate-pop-in",
            )}
          >
            {pop === "eraser" && (
              <SizeCapsule
                size={eraserSize}
                kids={kids}
                testid="mini-pop-eraser-sizes"
                onSize={(value) => {
                  // The value applies as it moves and the pop STAYS OPEN: a
                  // slider that closes on the first step cannot be dragged. A
                  // touch outside (or Escape) puts the pop away.
                  onEraserSize(value);
                  onTool("eraser");
                }}
              />
            )}

            {pop === "material" && (
              <div
                className="grid justify-center justify-items-center"
                role="group"
                aria-label="Materiais"
                data-testid="mini-material-grid"
                data-columns={materialColumns}
                data-cell={materialCell}
                data-gap={MINI_MATERIAL_GAP}
                data-count={materials.length}
                data-width={materialWidth}
                style={{
                  gridTemplateColumns: `repeat(${materialColumns}, ${materialCell}px)`,
                  gap: `${MINI_MATERIAL_GAP}px`,
                }}
              >
                {materials.map((candidate) => {
                  const other = shelfBrushOf(candidate);
                  const name = other?.label ?? (candidate === "fill" ? "Pintar" : "Conta-gotas");
                  const plate = materialPlate(plateMaterialOf(candidate, other), color);
                  const on = candidate === material;
                  return (
                    <button
                      key={candidate}
                      type="button"
                      aria-label={name}
                      aria-pressed={on}
                      data-tool={candidate}
                      data-testid={`mini-material-${candidate}`}
                      onClick={choose(() => onTool(candidate))}
                      className={cn(
                        "flex shrink-0 items-center justify-center transition-transform duration-150 ease-out active:scale-[0.96]",
                        kids ? "relative rounded-[18px]" : "rounded-[12px] bg-muted",
                        on && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                      )}
                      style={{
                        width: materialCell,
                        height: materialCell,
                        ...(kids ? plateStyle(plate) : {}),
                      }}
                    >
                      {kids && <PlateRim plate={plate} />}
                      {other ? (
                        <MaterialGlyph
                          brush={other}
                          color={color}
                          size={kids ? 44 : 36}
                          ink={kids ? undefined : "var(--foreground)"}
                        />
                      ) : (
                        <ToolIcon
                          name={candidate === "fill" ? "fill" : "eyedropper"}
                          color={color}
                          size={kids ? 34 : 28}
                          ink={kids ? undefined : "var(--foreground)"}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {pop === "color" && (
              // One piece, one order — the compacta's ladder, not a mixture:
              // white, the ten rungs of the colour in hand, black, under the
              // spectrum strip that rotates the hue without closing the pop.
              <MiniColorLadder color={color} kids={kids} onPick={chooseColor} onScrub={onColor} />
            )}
          </div>
        </div>
      )}

      <div
        data-testid="canvas-dock"
        data-mini="true"
        data-color={color}
        role="group"
        aria-label="Barra de ferramentas"
        className={cn(
          "pointer-events-auto flex items-center rounded-full border border-border bg-card/90 backdrop-blur-md",
          kids ? "h-[3.75rem] px-1.5" : "h-[var(--dock-pill-height)] px-1",
        )}
      >
        {/* The tools are ONE group and the colour is not in it. The boundary is
            space — 12dp of it — plus the fact that only a tool may carry the
            selection mark (`PillPlate`). Two doors, one gap of 2dp between
            them, exactly as before. */}
        <span
          role="group"
          aria-label="Ferramentas"
          data-testid="mini-tools"
          className="flex shrink-0 items-center gap-0.5"
        >
          {/* 1 — the eraser. Tap wipes with the last size; hold opens the 1..100. */}
          <button
            type="button"
            onClick={tap(() => onTool("eraser"))}
            onPointerDown={() => beginHold("eraser")}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Borracha"
            aria-pressed={eraserOn}
            aria-expanded={pop === "eraser"}
            data-testid="mini-eraser"
            data-active={eraserOn ? "true" : "false"}
            className={target}
          >
            <PillPlate skin={eraserSkin} kids={kids} on={eraserOn}>
              <MaterialGlyph
                brush={shelfBrushOf("eraser")!}
                color={color}
                size={pillGlyph}
                ink={eraserInk}
              />
            </PillPlate>
          </button>

          {/* 2 — the material in hand. Tap uses it; hold lists the others. */}
          <button
            type="button"
            onClick={tap(() => onTool(material))}
            onPointerDown={() => beginHold("material")}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={label}
            aria-pressed={materialOn}
            aria-expanded={pop === "material"}
            data-testid="mini-tool"
            data-tool={material}
            title={label}
            className={target}
          >
            <PillPlate skin={materialSkin} kids={kids} on={materialOn}>
              {brush ? (
                // The SAME object the chips and the shelf draw (owner's call,
                // 26/10). The pill used to wear a stroke sample on pro and an
                // object on 3-5, so one material had two faces depending on the
                // band; the sheet's full-width line is where the stroke lives.
                <MaterialGlyph brush={brush} color={color} size={pillGlyph} ink={materialInk} />
              ) : material === "fill" ? (
                <BucketGlyph color={color} size={kids ? 24 : 20} ink={materialInk} />
              ) : (
                <ToolIcon
                  name={material === "eyedropper" ? "eyedropper" : "fill"}
                  color={color}
                  size={kids ? 24 : 20}
                  ink={materialInk}
                />
              )}
            </PillPlate>
          </button>
        </span>

        {/* The breath that says "different kind of thing". 12dp, a real box, so
            the distance is a measurement and not a side effect of the flex gap. */}
        <span
          aria-hidden
          data-testid="mini-color-breath"
          data-breath={MINI_COLOR_BREATH}
          style={{ width: MINI_COLOR_BREATH, height: 1 }}
          className="shrink-0"
        />

        {/* 3 — the colour in hand: a PROPERTY of the tool, never a peer. Glyph
            sized, no ring, no plate; tap puts it back in the hand, hold opens
            the ladder of this very colour. */}
        <button
          type="button"
          onClick={tap(() => onColor(color))}
          onPointerDown={() => beginHold("color")}
          onPointerUp={stopHold}
          onPointerLeave={stopHold}
          onPointerCancel={stopHold}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Cor atual"
          aria-expanded={pop === "color"}
          data-testid="mini-color"
          data-swatch={MINI_COLOR_SWATCH}
          className={target}
        >
          <span
            aria-hidden
            data-testid="mini-color-swatch"
            // A 1px boundary, never a ring: with no edge at all a white swatch
            // would vanish into the pill's paper. The white INNER ring the old
            // disc carried is gone — it was the false "selected" signal.
            className="rounded-full border border-border/60"
            style={{
              background: color,
              width: MINI_COLOR_SWATCH,
              height: MINI_COLOR_SWATCH,
            }}
          />
        </button>

        <button
          type="button"
          onClick={tap(onExpand)}
          aria-label="Abrir barra de ferramentas"
          aria-expanded={false}
          data-testid="mini-expand"
          className={cn(target, "ml-0.5")}
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/**
 * The intermediate state — ONE component, two densities:
 *
 * Above the rows, the stroke preview: the line this material leaves at the size
 * in hand, with no title (3-5 reads zero text).
 *
 * Row 1 is the size: the same 1..100 capsule for every tool that has one, the
 * ERASER included (its radius is a band like any other, owner's call 26/10). A
 * tool whose size changes nothing — the bucket, the dropper — has no row 1 at
 * all. Row 2 is quick swapping: fixed slots (six on pro, five on kids) plus the
 * door to the tools that do not fit — they open on a SECOND line inside this
 * same bar, never a scroll and never a band floating above it. Row 3 is the
 * color: on pro the full pro palette (main colour with its HSL reading, the
 * field and the hue bar, the labelled variations, and the Cores/Recentes/
 * Favoritas tabs); on kids the same hierarchy with no text, no tabs and no HEX.
 *
 * Three rules hold the bar still: nothing in a row appears or disappears at an
 * end value (the ± clamp instead of vanishing), the extra tools add a line of
 * the card itself — the bar grows upward from its pinned base, so the row and
 * its chevron keep their rects instead of hovering over the paper — and the tone
 * ramp is anchored to the colour that arrived from OUTSIDE the row, so tapping a
 * tone selects it without re-deriving the row under the finger. The tool row
 * arrives already ordered (eraser, bucket, then the stored order) and is never
 * re-sorted.
 *
 * It never has collections or an action bar — and on 3-5 it has no text at all.
 */
/**
 * The size capsule: minus, the 1..100 slider, plus. ONE control for every tool
 * whose size matters — the eraser included (owner's call, 26/10: P/M/G is gone,
 * the rubber is continuous like the brushes). The ends clamp instead of
 * disappearing, so the row never changes width.
 */
function SizeCapsule({
  size,
  kids,
  onSize,
  testid = "size-capsule",
  sliderTestid,
}: {
  size: number;
  kids: boolean;
  onSize: (size: number) => void;
  testid?: string;
  /** The slider's own test id, when the caller already publishes one. */
  sliderTestid?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-1", kids ? "w-full gap-2 px-1" : "w-full px-0.5")}
      role="group"
      aria-label="Tamanho"
      data-testid={testid}
      data-size={size}
    >
      <button
        type="button"
        onClick={() => onSize(Math.max(1, size - 1))}
        disabled={size <= 1}
        aria-label="Menos espessura"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-foreground transition-[background-color,scale] duration-150 ease-out active:scale-[0.96] active:bg-card disabled:opacity-35",
          kids ? "h-12 w-12" : "h-10 w-10",
        )}
      >
        <Minus className={kids ? "h-6 w-6" : "h-4 w-4"} />
      </button>
      <input
        type="range"
        aria-label="Espessura"
        aria-valuetext={`${size}px`}
        min={1}
        max={100}
        step={1}
        value={size}
        onChange={(e) => onSize(Number(e.target.value))}
        data-testid={sliderTestid ?? `${testid}-slider`}
        className="param-slider min-w-0 flex-1"
      />
      <button
        type="button"
        onClick={() => onSize(Math.min(100, size + 1))}
        disabled={size >= 100}
        aria-label="Mais espessura"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-foreground transition-[background-color,scale] duration-150 ease-out active:scale-[0.96] active:bg-card disabled:opacity-35",
          kids ? "h-12 w-12" : "h-10 w-10",
        )}
      >
        <Plus className={kids ? "h-6 w-6" : "h-4 w-4"} />
      </button>
    </div>
  );
}

function CompactDock({
  tools,
  tool,
  color,
  kids,
  size,
  opacity,
  spray,
  onTool,
  onSize,
  onColor,
  onCollapse,
  onExpand,
  latchOpen,
  onLatch,
  onLook,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  tools: CanvasTool[];
  tool: CanvasTool;
  color: string;
  kids: boolean;
  /** The thickness in hand, 1..100 — the ONE number every material reads. */
  size: number;
  /** The stroke's real opacity (water and hardness already folded in). */
  opacity: number;
  /** The can's nozzle in hand; absent = the shelf's own (other tools). */
  spray?: SpraySettings | undefined;
  onTool: (tool: CanvasTool) => void;
  onSize: (value: number) => void;
  onColor: (hex: string) => void;
  /** Escape only: the scrim is the visible close door. */
  onCollapse: () => void;
  /** The switch at the top of the bar: the sheet, on 9+; the pill on 3–5. */
  onExpand: () => void;
  /** What the latch on the bar's top edge reports: is the level above the pill on? */
  latchOpen: boolean;
  /** The latch itself: the sheet on 9+, the pill on 3–5 — one level, both ways. */
  onLatch: () => void;
  /**
   * 3–5's door to the second level (grade + papel). Absent on 9+, where the two
   * folds live at the end of the pro sheet and the compact bar has no look row.
   */
  onLook?: (() => void) | undefined;
  /** The pair the rail used to hold; drawn on 3-5, in this bar's preview row. */
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  useEscapeOverlay(onCollapse);
  /**
   * Row 2 is 6 + 5 (spec §11.1): six tools on the first line, the rest of the
   * profile's set on the second, and the "more adjustments" door always closing
   * the row. Nothing is hidden, so nothing opens.
   */
  const lineTools = kids ? KID_LINE_TOOLS : COMPACT_LINE_TOOLS;
  const firstLine = tools.slice(0, lineTools);
  const secondLine = tools.slice(lineTools);
  const hasSecondLine = secondLine.length > 0 || !kids;

  /**
   * Hold a chip to open the tool changer (owner's rule, 24/10). A tap still
   * picks the tool; 450 ms turns the same target into the door to the full
   * sheet, so the compact bar does not need a second, unrelated affordance.
   * The click that follows the release is swallowed, or the hold would pick
   * the tool again on the way out. 3-5 has no sheet, so the hold is not wired
   * there at all (spec §7.6).
   */
  const holdTimer = useRef<number | null>(null);
  const holdFired = useRef(false);
  const endHold = () => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };
  const beginHold = (t: CanvasTool) => {
    if (kids) return;
    endHold();
    holdFired.current = false;
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      holdFired.current = true;
      onTool(t);
      onExpand();
    }, 450);
  };
  useEffect(() => endHold, []);

  /** One chip. The two lines share it — a tool looks the same wherever it sits. */
  const chip = (t: CanvasTool) => {
    const brush = shelfBrushOf(t);
    const on = t === tool;
    const plate = kids ? materialPlate(plateMaterialOf(t, brush), color) : null;
    /**
     * The plate of the chip in hand (§11.2). A ring alone stopped passing: the
     * state now also carries a DIFFERENT SURFACE, and the two are measured
     * against each other in `compacta-alvos.test.tsx` (≥3:1, both bands, both
     * lines, both schemes). On 3-5 the card flips to its own ink and the object
     * keeps its pigment; on 9+ the muted plate flips to the theme's ink, which
     * is the one pair that stays ≥3:1 in every theme.
     */
    const skin = plate ? (on ? activePlate(plate) : plate) : null;
    const contour = kids
      ? (skin?.ink ?? "var(--foreground)")
      : on
        ? "var(--card)"
        : "var(--foreground)";
    return (
      <button
        key={t}
        type="button"
        onClick={() => {
          if (holdFired.current) {
            holdFired.current = false;
            return;
          }
          onTool(t);
        }}
        onPointerDown={() => beginHold(t)}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        aria-label={brush?.label ?? (t === "fill" ? "Pintar" : "Conta-gotas")}
        aria-pressed={on}
        data-tool={t}
        data-plate-state={on ? "on" : "off"}
        data-plate={skin?.plate}
        data-ink={skin?.ink}
        style={skin ? plateStyle(skin) : undefined}
        className={cn(
          "flex shrink-0 items-center justify-center transition-[background-color,color,scale] duration-150 ease-out active:scale-[0.96]",
          // Kids: five chips share the bar, so the card is 52 (above the 44
          // floor) and the object fills 44 — no expand door, no scroll.
          // Pro: ONE plate for every tool, 44dp/radius 12 — the same ink-sample
          // language as the color row — and the active one is a ring (a shadow)
          // over the inverted plate, so selecting never resizes or moves a chip.
          kids ? "relative h-[52px] w-[52px] rounded-[18px]" : "h-11 w-11 rounded-[12px]",
          !kids && (on ? "bg-foreground text-card" : "bg-muted text-foreground"),
          on && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
        )}
      >
        {skin && <PlateRim plate={skin} />}
        {brush ? (
          // One object for both bands: 44 of the 52dp kid card, 40 of the 44dp
          // pro plate (the same optical share; the drawing has its own margin
          // inside the 24 grid). The contour follows the plate it sits on.
          <MaterialGlyph brush={brush} color={color} size={kids ? 44 : 40} ink={contour} />
        ) : t === "fill" ? (
          <BucketGlyph color={color} size={kids ? 36 : 22} ink={contour} />
        ) : (
          <ToolIcon
            name={t === "eyedropper" ? "eyedropper" : "fill"}
            color={color}
            size={kids ? 36 : 22}
            ink={contour}
          />
        )}
      </button>
    );
  };

  /**
   * The chips of a line, wrapped in their categories. The category is told by
   * SEMANTICS only — never a divider, a label or a second surface — because the
   * block's one gap is spent on the 6-column grid (`compacta-distribuicao` §1):
   * a wider breath at a group boundary would push the columns out of line with
   * the other row, which is exactly the defect the grid closes. The group stays
   * as a `contents` box, so the chips are the grid's own items and assistive
   * tech still hears "Ferramentas fixas" / "Materiais".
   */
  const grouped = (list: CanvasTool[]) =>
    toolGroups(list).map((group, at) => (
      // The key carries the position: a stored order can interleave the
      // categories, so the same category may appear more than once in a line.
      <span key={`${group.id}-${at}`} role="group" aria-label={group.label} className="contents">
        {group.tools.map((t) => chip(t))}
      </span>
    ));

  /**
   * The cell of the block: 44dp on 9+, 52dp on 3-5 — the same target the chip
   * already wears, repeated here because the GRID needs the number, not only the
   * button's class.
   */
  const cell = kids ? 52 : 44;
  /**
   * How many columns the block has. Pro always closes a 6-column grid, so the
   * second line is a line of the SAME grid as the first (four tools, the
   * adjustments door, one empty column). 3-5 draws its five (or however many it
   * has) on one centred line, which is the whole width of its grid.
   */
  const columns = kids ? Math.max(1, firstLine.length, secondLine.length) : COMPACT_LINE_TOOLS;

  /**
   * The empty column(s) that close a line (§6.1): "as colunas restantes viram um
   * único espaçador vazio". No ink, no border, no action — it exists so the
   * row's total width never changes with the number of tools, which is what
   * keeps column 1 at the same x on both lines.
   */
  const spacer = (used: number) => {
    const free = columns - used;
    if (free <= 0) return null;
    return (
      <span
        key="spacer"
        aria-hidden
        data-testid="compact-tools-gap"
        data-span={free}
        style={{ gridColumn: `span ${free}`, height: cell }}
      />
    );
  };

  /**
   * The eleventh target (§11.1): the door to the ACTIVE tool's adjustments. It
   * is not a material — no plate state, no ring, no `aria-pressed` — and it
   * closes the row, so it never sorts with the tools and never climbs to the
   * first line.
   */
  const moreAdjustments = !kids && (
    <button
      type="button"
      onClick={onExpand}
      aria-label="Mais ajustes"
      data-testid="compact-more-adjustments"
      data-role="door"
      data-target="more-adjustments"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-muted text-foreground transition-[background-color,scale] duration-150 ease-out active:scale-[0.96]"
    >
      <SlidersHorizontal className="h-5 w-5" />
    </button>
  );

  return (
    <div className="pointer-events-auto mx-3" style={{ marginBottom: "var(--dock-pill-bottom)" }}>
      {/* The bar breathes like the expanded sheet (owner's call, 26/10): the
          same 16dp gutter, the same 16dp between blocks and the same 8dp inside
          a block. The sheet's rhythm was the one that read well; a compact panel
          with 4dp of gutter and 6dp between rows read as a different surface. */}
      <div
        id="canvas-dock-region"
        data-testid="canvas-compact"
        role="group"
        aria-label="Painel compacto"
        className="relative rounded-[28px] bg-card/95 px-4 pb-4 pt-4 shadow-tile backdrop-blur-md"
      >
        {/* THE LATCH — the bar's own door to the sheet (9+) or back to the pill
            (3–5), hanging from the bar's top edge. It is a child of the region
            now (owner's report, 27/10): the circle that was floating over the
            desk is glued to the surface it opens, centred on it. Nothing inside
            the bar moves: the latch sits OUTSIDE the box (`bottom-full`), so it
            costs the bar zero dp of content and the bar keeps its height. */}
        <DockLatch open={latchOpen} kids={kids} onToggle={onLatch} />

        {/* NO HANDLE inside the bar (owner's report, 27/10). A 32 × 4dp bar is
            the bottom sheet's grammar — it reads as decoration, not as a door —
            and the panel is not a sheet sliding from the edge: it is a block of
            the chrome. The switch between the two levels is the latch above: a
            circle with a glyph, the one shape this app reads as a button. So the
            bar starts with its content and keeps the same 16dp gutter on all
            four sides. */}

        {/* The top row: the stroke the material in hand leaves. The palette's
            door left this row on 27/10 — the floating switch is the one
            control that changes level, and a second chevron beside it would be
            a second door.

            ON 3-5 THIS ROW ALSO CARRIES UNDO/REDO (owner's decision, 27/10,
            `chrome-v2` §12.2). With the rail revoked there is no menu to hold
            them, and the third level would put the most repeated action of a
            drawing app three taps away — so the pair sits here, two 52dp
            glyph-only targets to the right of the preview, and the preview gives
            up the width (`flex-1 min-w-0`) instead of the targets losing size.
            9+ keeps the pair in the sheet's action bar: its compact bar is one
            level below, not the toolbar. */}
        <div className="flex items-center gap-2" data-testid="compact-preview-row">
          <StrokePreview
            tool={tool}
            color={color}
            size={size}
            // A real band needs a real box: 88dp holds the widest cloud at the
            // top of the range, so grain and width are both readable.
            box={COMPACT_PREVIEW_BOX}
            opacity={opacity}
            // The nozzle in hand travels to the compact row too: the bar and
            // the paper must promise the same cloud.
            spray={spray}
            testid="compact-preview"
            className="min-w-0 flex-1"
          />
          {kids && (
            <>
              <ChromeDoor
                label="Desfazer"
                kids
                testid="compact-undo"
                disabled={!canUndo}
                onClick={onUndo}
                className="bg-muted shadow-none"
              >
                <Undo className="h-6 w-6" strokeWidth={STROKE.semibold} data-glyph="undo" />
              </ChromeDoor>
              <ChromeDoor
                label="Refazer"
                kids
                testid="compact-redo"
                disabled={!canRedo}
                onClick={onRedo}
                className="bg-muted shadow-none"
              >
                <Redo className="h-6 w-6" strokeWidth={STROKE.semibold} data-glyph="redo" />
              </ChromeDoor>
            </>
          )}
        </div>

        {/* Row 1 — thickness, in the same place and the SAME control in both
            bands: one 1..100 capsule (minus, slider, plus). The eraser takes the
            same row the brushes take (owner's call, 26/10: P/M/G is gone), and a
            tool whose size changes nothing — the bucket, the dropper — has no row
            at all: it used to promise a size the fill never reads. */}
        {paramsOf(tool).size && (
          <div
            data-testid="compact-thickness"
            data-size={size}
            className={cn(
              "mt-4 flex items-center rounded-full bg-muted px-0.5",
              kids ? "h-14" : "h-11",
            )}
          >
            <SizeCapsule
              size={size}
              kids={kids}
              onSize={onSize}
              testid="compact-thickness-capsule"
              sliderTestid="compact-thickness-slider"
            />
          </div>
        )}

        {/* Row 2 — every tool of the profile, in 6 + 5 (spec §11.1): six on the
            first line, the rest on the second, and the "more adjustments" door
            closing the row. No overflow door and no scroll: nothing is hidden,
            so nothing is half-visible and no slot ever moves.

            ONE grid, two lines (owner's defect, 26/10): line 1 began at x=47 and
            line 2 at x=71 because each line was centred on its own natural
            width. Both lines now mount the same 6-column grid — 6 × 44 + 5 × 8
            = 304dp, centred in the 358dp of the bar, 27dp of margin each side —
            so column 1 starts at the same x on both and the four tools of the
            second line sit in the columns of the first four of line 1. The
            columns are declared once (`gridTemplateColumns`) and the gap once
            (`gap`), so the two lines cannot drift apart. */}
        <div className="mt-4 flex flex-col items-center" data-testid="compact-tools">
          <div
            data-testid="compact-tools-line"
            data-line="1"
            data-columns={columns}
            data-cell={cell}
            data-gap={TOOLS_GAP}
            style={{ gridTemplateColumns: `repeat(${columns}, ${cell}px)`, gap: TOOLS_GAP }}
            className="grid w-full justify-center"
          >
            {grouped(firstLine)}
            {spacer(firstLine.length)}
          </div>
          {hasSecondLine && (
            <div
              data-testid="compact-tools-line"
              data-line="2"
              data-columns={columns}
              data-cell={cell}
              data-gap={TOOLS_GAP}
              style={{ gridTemplateColumns: `repeat(${columns}, ${cell}px)`, gap: TOOLS_GAP }}
              className="mt-2 grid w-full justify-center"
            >
              {secondLine.length > 0 && grouped(secondLine)}
              {moreAdjustments}
              {spacer(secondLine.length + (kids ? 0 : 1))}
            </div>
          )}
        </div>

        {/* Row 3 — the colour, and only TWO pieces (owner's decision, 27/10,
            `compacta-unificada` §12.6): the horizontal spectrum strip (24dp of
            track in 48dp of touch) and the eleven variations 50…950 in 6 + 5.
            44dp cells with radius 12 on 9+, 52dp on 3–5; the step label is 9+
            only. HSL, the field, the vertical hue bar, HEX, the tabs, the
            catalogue and the favourites row left this surface — they live in
            the expanded sheet. The ladder is anchored, so a tap never re-derives
            the tiles under the finger. */}
        <div className="mt-4" data-testid={kids ? "compact-kids-palette" : "compact-palette"}>
          <CompactColor color={color} kids={kids} onPick={onColor} />
        </div>

        {/* THE CANVAS'S OWN CONTROLS left this surface with the utilities row
            (owner's decision, 27/10): the zoom is a GESTURE with a transient
            readout, and the grid and the paper are FOLDS of the sheet
            (`LookFolds` on 9+, `KidsLookSheet` on 3–5) — the rail that used to
            hold them was revoked the same day (`chrome-v2` §12). On 3–5 what
            closes the bar is the door to those folds. */}
        {onLook && (
          <div className="mt-4 flex justify-end" data-testid="compact-look-row">
            <button
              type="button"
              onClick={onLook}
              aria-label="Aparência do papel e grade"
              data-testid="compact-look"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground active:scale-[0.96]"
            >
              <Grid3x3 className="h-6 w-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Which parameters actually change this tool's stroke. */
function paramsOf(tool: CanvasTool) {
  if (tool === "fill" || tool === "eyedropper")
    return { size: false, opacity: false, water: false, hardness: false, spray: false };
  if (tool === "eraser")
    return { size: true, opacity: false, water: false, hardness: false, spray: false };
  return {
    size: true,
    opacity: true,
    water: tool === "watercolor",
    hardness: tool === "pencil",
    spray: tool === "spray",
  };
}

/**
 * Expanded state — Maria's third step only: the grouped shelf, the tool's own
 * parameters, the live stroke preview and the full palette. Contextual on
 * purpose — a slider that changes nothing is a lie. Theo has no sheet (spec
 * §7.6): his colour and thickness live in the compact rows, and he has no fold
 * and no fold memory at all — the absence is structural, not a hidden flag.
 */
function Panel({
  tools,
  catalog,
  tool,
  color,
  grouped,
  opacity,
  water,
  hardness,
  effectiveOpacity,
  brushSize,
  spray,
  sombra,
  brilho,
  gradient,
  allowEffects,
  secoes,
  scrollKey,
  recent,
  favorites,
  simple,
  kidFamily,
  onKidFamily,
  onTool,
  onToggleSlot,
  onMoveSlot,
  onSize,
  onOpacity,
  onWater,
  onHardness,
  onSpray,
  onSombra,
  onBrilho,
  onSection,
  onGradient,
  onColor,
  onToggleFavorite,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onCollapse,
  look,
  onPaper,
  onGrid,
}: {
  tools: CanvasTool[];
  /** Every tool the profile may use — the sheet lists this, not the row. */
  catalog: CanvasTool[];
  tool: CanvasTool;
  color: string;
  grouped: boolean;
  opacity: number;
  water: number;
  hardness: Hardness;
  effectiveOpacity: number;
  brushSize: number;
  spray: SpraySettings;
  /** The two effects of the material in hand, already clamped by the reader. */
  sombra: ShadowEffect;
  brilho: GlowEffect;
  /** The stroke's paint, when it is a gradient instead of a solid colour. */
  gradient: StrokeGradient | null;
  /** T1 ∧ T3: without both, the folds are ABSENT, not hidden (§7.4). */
  allowEffects: boolean;
  /** Which fold is open for this person (persisted per profile, §7.3). */
  secoes: PanelSections;
  /** The person the sheet's scroll position belongs to, for this session. */
  scrollKey: string;
  recent: string[];
  favorites: string[];
  simple: boolean;
  kidFamily: number;
  onKidFamily: (index: number) => void;
  onTool: (tool: CanvasTool) => void;
  onToggleSlot: (tool: CanvasTool) => void;
  onMoveSlot: (tool: CanvasTool, dir: -1 | 1) => void;
  /** 1..100: the one thickness every material reads. */
  onSize: (value: number) => void;
  onOpacity: (v: number) => void;
  onWater: (v: number) => void;
  onHardness: (v: Hardness) => void;
  onSpray: (next: SpraySettings) => void;
  onSombra: (patch: Partial<ShadowEffect>) => void;
  onBrilho: (patch: Partial<GlowEffect>) => void;
  onSection: (key: PanelSectionKey, open: boolean) => void;
  onGradient: (value: StrokeGradient | null) => void;
  onColor: (hex: string) => void;
  onToggleFavorite: (hex: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onCollapse: () => void;
  /** The sheet's own look and the working guide, read from the profile. */
  look: { paper: PaperLook; grid: GridLook };
  onPaper: (patch: Partial<PaperLook>) => void;
  onGrid: (patch: Partial<GridLook>) => void;
}) {
  const params = paramsOf(tool);
  const brush = shelfBrushOf(tool);
  useEscapeOverlay(onCollapse);
  /**
   * The ordering list ("Minhas", the per-tool switches and the arrows) is a
   * sheet of its own. It belongs to the TOOL PANEL — the door lives in the
   * panel's title band and the list is rendered by the shelf — so the level
   * that owns both holds the flag: collapsing the panel unmounts it and the
   * list can never come back open on a surface that is not there.
   */
  const [organizeOpen, setOrganizeOpen] = useState(false);
  /**
   * The gradient's fold is not one of the four remembered ones (§7.5 names
   * ajustes/cor/sombra/brilho): it opens and closes with the sheet, which is a
   * session state like the scroll — never a preference written to the profile.
   */
  const [gradienteOpen, setGradienteOpen] = useState(false);
  /** The scroll body, so the reading position can be kept in the session (§7.3). */
  const body = useRef<HTMLDivElement | null>(null);
  const seenScroll = useRef(0);
  /**
   * The scroll offset this person's sheet was left at, in this session only: the
   * map dies with the app, so a reload starts at the top and no offset ever goes
   * to localStorage. The value the browser actually ACCEPTS is recorded after
   * each restore, so the scroll event the assignment echoes back is not mistaken
   * for a gesture and the stored offset is never overwritten by a clamp.
   */
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const kept = SHEET_SCROLL.get(scrollKey) ?? 0;
    if (kept > 0) el.scrollTop = kept;
    seenScroll.current = el.scrollTop;
  }, [scrollKey, tool]);
  const rememberScroll = () => {
    const el = body.current;
    if (!el || el.scrollTop === seenScroll.current) return;
    seenScroll.current = el.scrollTop;
    SHEET_SCROLL.set(scrollKey, el.scrollTop);
  };
  /**
   * Only a material that paints carries a stroke effect: the bucket, the
   * dropper and the eraser do not commit a mark of their own, and a control
   * with nothing to change is not rendered (§7.4).
   */
  const paints = isShelfTool(tool) && tool !== "eraser";
  /**
   * The two effect folds are only OPEN while their effect is active (owner's rule,
   * 27/10). The stored choice is the person's — restored on every path — and the
   * effect of the material in hand decides whether that choice can show: a
   * material whose effect is off lands on a collapsed, inert fold, and coming back
   * to the one that has it reopens the fold the person left open.
   *
   * Deriving the two (instead of keeping two more states) is what makes the rule
   * true on EVERY door — the switch, the material switch, a restored save — with
   * no effect watching another.
   */
  const sombraOpen = sombra.on && secoes.sombra;
  const brilhoOpen = brilho.on && secoes.brilho;
  /**
   * What the closed Ajustes fold says about its contents (§7.2): the compact
   * readout of the values in hand, naming only the controls this material
   * actually shows. A tool with nothing to tune says so, instead of an empty
   * summary that would read as a broken fold.
   */
  const adjustSummary = (() => {
    const bits: string[] = [];
    if (params.size) bits.push(`espessura ${brushSize}`);
    if (params.opacity) bits.push(`opacidade ${opacity}%`);
    if (params.spray) {
      bits.push(`ponta ${Math.round(spray.tip * 100)}%`);
      bits.push(`dispersão ${Math.round(spray.spread * 100)}%`);
      bits.push(`intensidade ${Math.round(spray.intensity * 100)}%`);
    }
    if (params.water) bits.push(`água ${water}%`);
    if (params.hardness) bits.push(HARDNESS_LABEL[hardness].toLowerCase());
    return bits.length > 0 ? bits.join(" · ") : "Sem ajustes";
  })();
  const nothingToAdjust = !(
    params.size ||
    params.opacity ||
    params.spray ||
    params.water ||
    params.hardness
  );
  /**
   * The glow's custom swatches are the shared palette's bases — never a second
   * picker. A custom colour that is not one of them (the stroke's own spectrum
   * point) is prepended, so the chosen chip is always visible and checked.
   */
  const glowBases = PALETTE_FAMILIES.map((family) => family.base.hex);
  const glowSwatches =
    brilho.color !== "auto" && !glowBases.includes(brilho.color)
      ? [brilho.color, ...glowBases]
      : glowBases;

  return (
    <div
      data-sheet-reserve={sheetReserveOf(false)}
      style={{ maxHeight: `calc(100% - ${sheetReserveOf(false)}px)` }}
      className="pointer-events-auto flex w-full min-h-0 flex-col"
    >
      <div
        id="canvas-dock-region"
        role="dialog"
        aria-modal="false"
        aria-label="Painel da ferramenta"
        data-testid="canvas-panel"
        className="animate-slide-up relative flex min-h-0 flex-auto flex-col rounded-t-[var(--dock-sheet-radius)] border-t border-border bg-card/97 backdrop-blur"
      >
        {/* THE LATCH, hanging from the sheet's top edge and centred on it: the
            way back to the bar is the same circle that opened it, now glued to
            the surface it controls instead of floating over the desk, plus
            Escape. The sheet starts with its content, and its own scroll box
            keeps the 8dp of air the old handle used to hold. The latch is
            OUTSIDE the box (`bottom-full`), so the sheet's top row of content
            loses nothing to it. */}
        <DockLatch open kids={false} onToggle={onCollapse} />

        <div
          ref={body}
          onScroll={rememberScroll}
          data-testid="sheet-scroll"
          className="dock-scroll min-h-0 max-h-[56dvh] flex-auto space-y-4 overflow-y-auto px-4 pb-4 pt-2"
        >
          {/* Header: the material's name, its line and — top right, in the SAME
              band as the title — the door to the ordering list (owner's decision,
              27/10). It used to be a full-width line of its own UNDER the shelf:
              a 40dp row plus its 16dp gap, spent to carry two words at the right
              edge before the folds. In the title's band it costs the sheet
              nothing (the header is already 44dp tall, the button is 36) and the
              stack below it — the folds — starts one line higher.

              A tool with no parameters (bucket, dropper) still gets the band when
              the shelf has the door: the door is the shelf's, not the material's. */}
          {brush || grouped ? (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {brush && (
                  <>
                    <p className="type-title-lg truncate font-display text-foreground">
                      {brush.label}
                    </p>
                    <p className="type-label-sm font-mono tabular-nums text-lapis">
                      {brushSize}px · {effectiveOpacity}%
                      {tool === "watercolor" ? ` · água ${water}%` : ""}
                      {tool === "pencil" ? ` · ${hardness}` : ""}
                    </p>
                  </>
                )}
              </div>
              {grouped && (
                <button
                  type="button"
                  onClick={() => setOrganizeOpen(true)}
                  aria-label="Organizar ferramentas"
                  data-testid="shelf-organize"
                  data-seat="panel-top"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-[10px] font-semibold text-muted-foreground transition-colors duration-150 ease-out active:text-foreground"
                >
                  <ToolIcon name="more" size={16} color="var(--foreground)" />
                  <span>Organizar</span>
                </button>
              )}
            </div>
          ) : null}
          <StrokePreview
            tool={tool}
            color={color}
            size={brushSize}
            box={SHEET_PREVIEW_BOX}
            opacity={effectiveOpacity}
            // The LIVE nozzle, not the shelf's default: the preview must open
            // with the cloud the paper will paint, or tuning the three sliders
            // below would move a cloud nobody can see (§3).
            spray={spray}
            testid="param-preview"
          />

          {/* The sheet lists only what the band can use; nothing the profile
              cannot open is rendered at all — no padlock, no ghost door. */}
          <BrushShelf
            tools={tools}
            catalog={catalog}
            active={tool}
            color={color}
            size={brushSize}
            kids={false}
            grouped={grouped}
            organizeOpen={organizeOpen}
            onOrganizeOpenChange={setOrganizeOpen}
            onPick={onTool}
            onToggleSlot={onToggleSlot}
            onMoveSlot={onMoveSlot}
          />

          {/* G1 — Ajustes (painel-chevrons §7.1): exactly the controls this
              material shows, folded so a person who only wants the colour does
              not scroll past sliders they never use. The thickness slider is
              here because the sheet renders it for the tool in hand — NOT
              because each material owns one: it reads/writes the single
              per-person number, so switching material keeps the point (§11.3). */}
          <Fold
            id="ajustes"
            label="Ajustes"
            testid="fold-ajustes"
            summary={adjustSummary}
            open={secoes.ajustes}
            onToggle={() => onSection("ajustes", !secoes.ajustes)}
          >
            {params.size && (
              <Slider
                label="Tamanho"
                value={{ now: brushSize, min: 1, max: 100 }}
                display={`${brushSize}px`}
                onChange={onSize}
              />
            )}

            {params.opacity && (
              <Slider
                label="Opacidade"
                value={{ now: opacity, min: 20, max: 100, step: 5 }}
                display={`${opacity}%`}
                onChange={onOpacity}
              />
            )}

            {/* The can is the only material whose tip the author tunes (§3), so
                the three nozzle controls live here — next to size and opacity,
                never in "Mais" as an app preference: they belong to the stroke. */}
            {params.spray && (
              <>
                <Slider
                  label="Ponta"
                  value={{ now: spray.tip, ...SPRAY_RANGE.tip }}
                  display={`${Math.round(spray.tip * 100)}%`}
                  onChange={(tip) => onSpray({ ...spray, tip })}
                  hint="Raio da gota."
                />
                <Slider
                  label="Dispersão"
                  value={{ now: spray.spread, ...SPRAY_RANGE.spread }}
                  display={`${Math.round(spray.spread * 100)}%`}
                  onChange={(spread) => onSpray({ ...spray, spread })}
                  hint="Abertura da nuvem."
                />
                <Slider
                  label="Intensidade"
                  value={{ now: spray.intensity, ...SPRAY_RANGE.intensity }}
                  display={`${Math.round(spray.intensity * 100)}%`}
                  onChange={(intensity) => onSpray({ ...spray, intensity })}
                  hint="Gotas por passo e opacidade."
                />
              </>
            )}

            {params.water && (
              <Slider
                label="Água"
                value={{ now: water, min: 0, max: 100, step: 10 }}
                display={`${water}%`}
                onChange={onWater}
                hint="Mais água = lavado mais claro."
              />
            )}

            {params.hardness && (
              <div className="flex items-center justify-between gap-2">
                <span className="type-label-md text-foreground">Dureza</span>
                <div
                  className="flex rounded-full border border-border bg-background p-0.5"
                  role="radiogroup"
                  aria-label="Dureza"
                >
                  {(
                    [
                      ["soft", HARDNESS_LABEL.soft],
                      ["medium", HARDNESS_LABEL.medium],
                      ["hard", HARDNESS_LABEL.hard],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={hardness === value}
                      onClick={() => onHardness(value)}
                      className={cn(
                        "type-label-md h-8 rounded-full px-2.5 transition-colors duration-150 ease-out",
                        hardness === value ? "bg-foreground text-background" : "text-lapis",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* A tool with nothing to tune says so instead of showing an empty
                fold: the bucket and the dropper are states, not broken panels
                (§7.1.3). No slider ever pretends to change a fill. */}
            {nothingToAdjust && (
              <p className="type-body-sm text-lapis" data-testid="fold-ajustes-vazio">
                Sem ajustes para esta ferramenta
              </p>
            )}
          </Fold>

          {/* G2 — Cor (§7.1): the tray the palette already decided, wrapped in a
              fold and never reimplemented. Closed it shows no chip and no text —
              the sheet's own line is the colour's context (§7.2). */}
          <Fold
            id="cor"
            label="Cor"
            testid="fold-cor"
            open={secoes.cor}
            onToggle={() => onSection("cor", !secoes.cor)}
          >
            <PaletteTray
              kids={false}
              simple={simple}
              color={color}
              kidFamily={kidFamily}
              onKidFamily={onKidFamily}
              recent={recent}
              favorites={favorites}
              onPick={onColor}
              onToggleFavorite={onToggleFavorite}
            />
          </Fold>

          {/* G3 Sombra · G4 Brilho (efeitos-chevrons §7.1): two siblings after
              Cor, same disclosure language, combinable, and ABSENT — not hidden —
              without T1 ∧ T3. A material that does not paint a mark of its own
              (eraser, bucket, dropper) never sees them either.

              The two effects' switch rides the FOLD'S HEADER, not its body
              (owner's rule, 27/10): the fold opens only while the effect is on,
              so a switch inside the body would be locked inside the very fold it
              has to open — the deadlock the header breaks. And because the fold
              refuses the chevron while the effect is off (`locked`), the header
              switch is the ONLY door that opens it.

              G5 Gradiente joined them on 26/10 and became the THIRD effect on
              27/10 (owner's feedback): it carries the same header switch and the
              same `locked` disclosure as Sombra and Brilho. Being an effect is
              exactly what it is — a stroke that either wears a gradient or does
              not — and "Desligado" as a third kind inside the fold was a switch
              drawn as a radio. The header is now the only owner of off; the type
              row chooses the SHAPE (linear/radial) of a gradient that exists. */}
          {allowEffects && paints && (
            <>
              <Fold
                id="gradiente"
                label="Gradiente"
                testid="fold-gradiente"
                summary={
                  gradient
                    ? `${gradient.kind === "linear" ? "Linear" : "Radial"} · ${gradient.angle}°`
                    : "Desligado"
                }
                open={gradienteOpen && gradient !== null}
                locked={gradient === null}
                head={
                  <EffectSwitch
                    label="Ativar gradiente"
                    checked={gradient !== null}
                    onChange={(on) => {
                      // Same rule as Sombra and Brilho: the switch turns it on AND
                      // opens the editor; turning it off collapses the disclosure.
                      setGradienteOpen(on);
                      onGradient(on ? freshGradient(color) : null);
                    }}
                  />
                }
                onToggle={() => {
                  // Off, the disclosure is inert: the way in is the switch on the
                  // same row, never the chevron.
                  if (!gradient) return;
                  setGradienteOpen((value) => !value);
                }}
              >
                <GradientEditor gradient={gradient} onChange={onGradient} />
              </Fold>

              <Fold
                id="sombra"
                label="Sombra"
                testid="fold-sombra"
                summary={
                  sombra.on
                    ? `${sombra.intensity}% · ${sombra.dy}px · ${sombra.radius}px`
                    : "Desligada"
                }
                open={sombraOpen}
                locked={!sombra.on}
                head={
                  <EffectSwitch
                    label="Ativar sombra"
                    checked={sombra.on}
                    onChange={(on) => onSombra({ on })}
                  />
                }
                onToggle={() => {
                  // Off, the disclosure is inert: the way in is the switch on the
                  // same row, never the chevron.
                  if (!sombra.on) return;
                  onSection("sombra", !secoes.sombra);
                }}
              >
                <Slider
                  label="Intensidade"
                  value={{ now: sombra.intensity, ...SHADOW_RANGE.intensity }}
                  display={`${sombra.intensity}%`}
                  onChange={(intensity) => onSombra({ intensity })}
                  hint="Força da sombra."
                />
                <Slider
                  label="Deslocamento X"
                  value={{ now: sombra.dx, ...SHADOW_RANGE.dx }}
                  display={`${sombra.dx}px`}
                  onChange={(dx) => onSombra({ dx })}
                  hint="Negativo = à esquerda."
                />
                <Slider
                  label="Deslocamento Y"
                  value={{ now: sombra.dy, ...SHADOW_RANGE.dy }}
                  display={`${sombra.dy}px`}
                  onChange={(dy) => onSombra({ dy })}
                  hint="Só para baixo."
                />
                <Slider
                  label="Raio"
                  value={{ now: sombra.radius, ...SHADOW_RANGE.radius }}
                  display={`${sombra.radius}px`}
                  onChange={(radius) => onSombra({ radius })}
                  hint="Borra a silhueta; 0 = sombra dura."
                />
                <Slider
                  label="Espalhamento"
                  value={{ now: sombra.spread, ...SHADOW_RANGE.spread }}
                  display={`${sombra.spread}px`}
                  onChange={(spread) => onSombra({ spread })}
                  hint="Cresce antes de borrar."
                />
                {/* No picker: a shadow is depth, not ink. The line says it so
                    the absence does not read as a missing control. */}
                <p className="type-body-sm text-lapis">Cor: preta.</p>
              </Fold>

              <Fold
                id="brilho"
                label="Brilho"
                testid="fold-brilho"
                summary={
                  brilho.on
                    ? `${brilho.intensity}% · ${brilho.radius}px · ${
                        brilho.color === "auto" ? "auto" : brilho.color
                      }`
                    : "Desligado"
                }
                open={brilhoOpen}
                locked={!brilho.on}
                head={
                  <EffectSwitch
                    label="Ativar brilho"
                    checked={brilho.on}
                    onChange={(on) => onBrilho({ on })}
                  />
                }
                onToggle={() => {
                  if (!brilho.on) return;
                  onSection("brilho", !secoes.brilho);
                }}
              >
                <Slider
                  label="Intensidade"
                  value={{ now: brilho.intensity, ...GLOW_RANGE.intensity }}
                  display={`${brilho.intensity}%`}
                  onChange={(intensity) => onBrilho({ intensity })}
                  hint="Força do brilho."
                />
                <Slider
                  label="Raio"
                  value={{ now: brilho.radius, ...GLOW_RANGE.radius }}
                  display={`${brilho.radius}px`}
                  onChange={(radius) => onBrilho({ radius })}
                  hint="Abaixo de 2 o brilho vira contorno."
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="type-label-md text-foreground">Cor</span>
                  <div
                    role="radiogroup"
                    aria-label="Cor do brilho"
                    className="flex rounded-full border border-border bg-background p-0.5"
                  >
                    {(["auto", "custom"] as const).map((mode) => {
                      const on =
                        mode === "auto" ? brilho.color === "auto" : brilho.color !== "auto";
                      return (
                        <button
                          key={mode}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={
                            mode === "auto" ? "Brilho automático" : "Brilho personalizado"
                          }
                          // Custom starts from the colour in hand, so the tap
                          // never lands on a colour the author cannot see.
                          onClick={() => onBrilho({ color: mode === "auto" ? "auto" : color })}
                          className={cn(
                            "type-label-md h-8 rounded-full px-2.5 transition-colors duration-150 ease-out",
                            on ? "bg-foreground text-background" : "text-lapis",
                          )}
                        >
                          {mode === "auto" ? "Auto" : "Custom"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* The shared palette, not a second picker (§7.3-B4). */}
                {brilho.color !== "auto" && (
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="radiogroup"
                    aria-label="Cores do brilho"
                  >
                    {glowSwatches.map((hex, index) => {
                      const on = brilho.color === hex;
                      return (
                        <button
                          key={`${hex}-${index}`}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          aria-label={`cor do brilho ${index + 1} de ${glowSwatches.length}`}
                          data-hex={hex}
                          onClick={() => onBrilho({ color: hex })}
                          style={{ background: hex }}
                          className={cn(
                            "h-6 w-6 shrink-0 rounded-full border border-border/60 transition-transform duration-150 ease-out active:scale-[0.96]",
                            on && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                          )}
                        />
                      );
                    })}
                  </div>
                )}
              </Fold>
            </>
          )}

          {/* THE SHEET AND THE GUIDE, closing the sheet (owner's decision,
              27/10, `chrome-v2` §4): `Grade` and `Papel` are folds like Cor,
              Sombra and Brilho — after them, with the three parameters of each.
              The zoom is NOT here any more: it lives in the gesture, with a
              transient readout over the paper. */}
          <LookFolds
            kids={false}
            look={look.paper}
            grid={look.grid}
            onPaper={onPaper}
            onGrid={onGrid}
          />
        </div>

        {/* The action bar stays put: "Feito" must never fall below the fold of
            the sheet, whichever palette is inside the scroll.

            UNDO/REDO LIVE HERE (owner's decision, 27/10, `chrome-v2` §12.2): with
            the rail revoked, the pair that used to flank the top row moved into
            the sheet. They are ALWAYS DRAWN and DISABLED when there is nothing to
            do — a control that disappears makes the bar jump under the finger
            that just used it. The cost is recorded in §12.3: undo on 9+ now
            costs opening the sheet. */}
        <div className="flex items-center gap-2 border-t border-border px-4 pb-[var(--dock-sheet-pad-bottom)] pt-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Desfazer no painel"
            data-testid="panel-undo"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground disabled:opacity-35"
          >
            <Undo className="h-4 w-4" data-glyph="undo" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Refazer no painel"
            data-testid="panel-redo"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground disabled:opacity-35"
          >
            <Redo className="h-4 w-4" data-glyph="redo" />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Feito"
            className="ml-auto flex h-10 items-center justify-center gap-1.5 rounded-full bg-foreground px-4 text-xs font-semibold text-background"
          >
            <Check className="h-4 w-4" strokeWidth={STROKE.semibold} />
            feito
          </button>
        </div>
      </div>
    </div>
  );
}

/** Which stop of the gradient the next swatch tap replaces. */
type GradientStop = "stop1" | "stop2";

/** A fresh gradient starts linear and vertical, from the colour in hand. */
const GRADIENT_DEFAULT = { kind: "linear" as const, angle: 90 };
/** The far stop a fresh gradient lands on: the palette's own nanquim ink. */
const GRADIENT_STOP_DEFAULT = "#0F1216";

/**
 * The gradient a switch or a kind tap creates: the default linear 90°, the
 * colour in hand on the near stop and the ink on the far one. ONE constructor for
 * both doors, so the switch and the type row cannot build two different gradients.
 */
const freshGradient = (
  color: string,
  kind: StrokeGradient["kind"] = GRADIENT_DEFAULT.kind,
): StrokeGradient => ({
  ...GRADIENT_DEFAULT,
  kind,
  stop1: color,
  stop2: GRADIENT_STOP_DEFAULT,
});

/**
 * The gradient's controls. They were the body of the "Mais" overlay until
 * 26/10; the overlay is gone and the sheet is the one home of the stroke's
 * preferences, so the editor is a fold of it like Sombra and Brilho.
 *
 * It owns no palette of its own: the stops pick from `GRADIENT_STOPS` (the
 * shared print palette) and the first stop starts on the colour in hand, so the
 * author never lands on a colour they cannot see.
 */
function GradientEditor({
  gradient,
  onChange,
}: {
  gradient: StrokeGradient | null;
  onChange: (value: StrokeGradient | null) => void;
}) {
  const [stopTarget, setStopTarget] = useState<GradientStop>("stop2");

  /** The type row owns the KIND only: on/off is the header switch's (§27/10). */
  const chooseKind = (kind: StrokeGradient["kind"]) => {
    if (!gradient) return;
    onChange({ ...gradient, kind });
  };
  const chooseStop = (hex: string) => {
    if (!gradient) return;
    onChange({ ...gradient, [stopTarget]: hex });
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5" role="group" aria-label="Tipo de gradiente">
        {[
          { id: "linear" as const, label: "Linear" },
          { id: "radial" as const, label: "Radial" },
        ].map((option) => {
          const on = gradient?.kind === option.id;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={on}
              disabled={!gradient}
              onClick={() => chooseKind(option.id)}
              className={cn(
                "h-9 flex-1 rounded-lg border text-xs font-semibold transition-colors duration-150 ease-out",
                on ? "border-foreground bg-foreground text-background" : "border-border",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {gradient && (
        <div className="space-y-2" data-testid="gradient-editor">
          <div
            className="h-8 rounded-lg border border-border"
            style={{ backgroundImage: gradientCss(gradient) }}
            data-testid="gradient-preview"
            aria-hidden
          />
          <div className="flex items-center gap-1.5">
            <span className="type-label-sm uppercase tracking-wide text-lapis">Cor</span>
            {(["stop1", "stop2"] as GradientStop[]).map((stop) => (
              <button
                key={stop}
                type="button"
                aria-pressed={stopTarget === stop}
                onClick={() => setStopTarget(stop)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition-colors duration-150 ease-out",
                  stopTarget === stop ? "border-foreground" : "border-border",
                )}
              >
                <span
                  className="h-4 w-4 rounded-sm border border-border"
                  style={{ background: gradient[stop] }}
                  aria-hidden
                />
                {stop === "stop1" ? "De" : "Até"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1">
            {GRADIENT_STOPS.map((stop, i) => (
              <button
                key={stop.hex}
                type="button"
                aria-label={`cor ${i + 1} de ${GRADIENT_STOPS.length}`}
                data-hex={stop.hex}
                onClick={() => chooseStop(stop.hex)}
                className="h-7 rounded-md border border-border"
                style={{ background: stop.hex }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            {GRADIENT_ANGLES.map((angle) => (
              <button
                key={angle}
                type="button"
                aria-label={`Ângulo ${angle} graus`}
                aria-pressed={gradient.angle === angle}
                onClick={() => onChange({ ...gradient, angle })}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center rounded-md border transition-colors duration-150 ease-out",
                  gradient.angle === angle ? "border-foreground bg-muted" : "border-border",
                )}
              >
                <ArrowUp className="h-3.5 w-3.5" style={{ transform: `rotate(${angle}deg)` }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One fold of the sheet, CONTROLLED: the open state belongs to the caller, so
 * the four remembered folds (Ajustes, Cor, Sombra, Brilho) can live in the
 * profile and the gradient can stay a session state (painel-chevrons §7.1–7.3,
 * efeitos-chevrons §7.2). The header is a full-width button with
 * `aria-expanded`/`aria-controls`; the region is named like the label. While
 * closed the row carries a short HONEST summary when the fold has one — the live
 * preview of the sheet's header is the context, never a second swatch (Cor
 * therefore shows no chip and no text).
 *
 * It is disclosure, never enable: opening does not turn an effect on and closing
 * does not turn it off. That is the switch's job — and the switch rides the
 * HEADER (`head`), always on screen, never inside the region (owner's rule,
 * 27/10): a fold that only opens with its effect on would otherwise keep the
 * switch that turns it on out of reach.
 *
 * `locked` is the other half of that rule: with the effect off the disclosure
 * refuses the tap and SAYS so (`aria-disabled` plus a dimmed chevron), because
 * the only way in is the switch on the same row. It is never `disabled`: a
 * disabled control is not announced, and the row must go on telling the truth
 * about its contents while it refuses.
 */
function Fold({
  id,
  label,
  testid,
  summary,
  open,
  locked = false,
  head,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  testid: string;
  summary?: string;
  open: boolean;
  /** The fold cannot be opened from here — the effect it discloses is off. */
  locked?: boolean;
  /** An always-visible control of the row, beside the disclosure (a switch). */
  head?: ReactNode;
  onToggle: () => void;
  children: ReactNode;
}) {
  const region = `${id}-regiao`;
  const chevron = cn("h-4 w-4 shrink-0 text-lapis", locked && "opacity-40");
  return (
    <div className="border-t border-border pt-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          // The region is ABSENT while the fold is closed (that is the sheet's
          // own rule: a closed fold shows no chip and no text), so the header
          // must not point at an id that does not exist. `aria-expanded` is what
          // says the state; `aria-controls` only names a node that is there.
          aria-controls={open ? region : undefined}
          // Present only while it refuses: an `aria-disabled="false"` would be
          // noise on every other fold of the sheet.
          aria-disabled={locked ? "true" : undefined}
          onClick={onToggle}
          data-testid={testid}
          className={cn(
            "flex min-h-11 flex-1 items-center justify-between gap-2 text-left transition-[transform,background-color] duration-150 ease-out",
            // A press that answers nothing would read as a slow control, not as
            // an inert one.
            locked ? "cursor-default" : "active:scale-[0.96]",
          )}
        >
          <span className="type-label-md text-foreground">{label}</span>
          <span className="flex min-w-0 items-center gap-2">
            {!open && summary && (
              <span
                data-testid={`${testid}-resumo`}
                className="type-label-sm truncate font-mono text-lapis"
              >
                {summary}
              </span>
            )}
            {open ? (
              <ChevronUp className={chevron} aria-hidden />
            ) : (
              <ChevronDown className={chevron} aria-hidden />
            )}
          </span>
        </button>
        {head}
      </div>
      {open && (
        <div
          id={region}
          role="region"
          aria-label={label}
          data-testid={`${testid}-regiao`}
          className="space-y-2 pt-1"
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * The on/off of one effect, in the FOLD'S HEADER (owner's rule, 27/10) — never in
 * the body: with the effect off the fold cannot be opened, so a switch inside it
 * could not be reached to turn it back on. It carries the 44dp ring the rest of
 * the sheet's pro targets carry, and the row's own label names the effect, which
 * is why the visible word "Ativar" left with it; the switch keeps the invisible
 * PT name for AT.
 */
function EffectSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </span>
  );
}

function Slider({
  label,
  value,
  display,
  onChange,
  hint,
}: {
  label: string;
  value: { now: number; min: number; max: number; step?: number };
  display: string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="type-label-md text-foreground">{label}</span>
        <span className="type-label-md font-mono tabular-nums text-lapis">{display}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        aria-valuetext={display}
        min={value.min}
        max={value.max}
        step={value.step ?? 1}
        value={value.now}
        onChange={(e) => onChange(Number(e.target.value))}
        className="param-slider mt-1"
      />
      {hint && <span className="type-body-sm mt-1 block text-lapis">{hint}</span>}
    </label>
  );
}

/**
 * Post-drawing dialog: where does this piece live? Published pieces only
 * offer to go up on the mural again — taking a piece OFF the mural is an
 * adult action (Área do adulto), never a child one.
 *
 * "Jogar fora" appears for the author's draft only. It is the third action,
 * visually last: the piece is already safe, so throwing it away is the one that
 * needs a deliberate reach — and it answers with the shell's 5s undo instead of
 * a modal on top of a modal.
 */
function SaveDialog({
  open,
  artwork,
  kids,
  published,
  canPublish,
  canDiscard,
  onPublish,
  onDraft,
  onDiscard,
  onContinue,
}: {
  open: boolean;
  artwork: Artwork;
  kids: boolean;
  published: boolean;
  canPublish: boolean;
  canDiscard: boolean;
  onPublish: () => void;
  onDraft: () => void;
  onDiscard: () => void;
  onContinue: () => void;
}) {
  // 3–5: the dialog is three big cards with a thumbnail. No title, no sentence
  // — the child decides by shape and position, and the small trash target is
  // the only deliberate reach (sem-texto-3-5 §1 D1). Both variants share the
  // presence layer so the dismiss answers the enter.
  const panel = kids
    ? "rounded-t-[var(--radius-sheet)] bg-card px-5 pb-5 pt-4 shadow-tile"
    : "rounded-t-[var(--radius-sheet)] bg-card px-5 pb-5 pt-4 shadow-tile";
  const title = canPublish ? "Guardar desenho?" : "Guardar rascunho?";
  const buttonBase = "h-12 rounded-md type-label-lg";

  return (
    <SheetSurface
      open={open}
      onClose={onContinue}
      label={kids ? "Guardar" : title}
      labelledBy={kids ? undefined : "save-title"}
      testid={kids ? "save-dialog-kids" : "save-dialog"}
      z="z-40"
      backdrop="bg-nanquim/25 backdrop-blur-[1px]"
      panel={panel}
      closeLabel="Continuar desenhando"
    >
      <span aria-hidden className="mx-auto mb-3 block h-1 w-8 rounded-full bg-border" />
      {kids ? (
        <>
          <div className="flex justify-center">
            <ArtworkPaint
              pageId={artwork.pageId}
              w={artwork.w}
              h={artwork.h}
              commands={artwork.history.commands}
              // A dialog preview is a card, not a sheet on the desk: 1x is
              // already sharp at 128dp, like the gallery thumbnails.
              scale={1}
              style={{
                width: Math.round((128 * artwork.w) / artwork.h),
                height: 128,
              }}
              // Concentric with the sheet it sits in: 28 − 20 (px-5) = 8.
              className="rounded-lg border border-black/[0.08] bg-white shadow-paper"
            />
          </div>
          <div className="mt-4 flex items-stretch justify-center gap-3">
            {canPublish && (
              <SaveCard
                testid="save-card-publish"
                label="Publicar"
                icon={Star}
                primary
                autoFocus
                current={published}
                onClick={onPublish}
              />
            )}
            {/* Closing choices never disappear: a published piece still offers
                "guardar na pasta" (demote) and a draft still offers publish.
                Hiding the option that matches the current state left the sheet
                with a single button (owner's report, 24/10). */}
            <SaveCard
              testid="save-card-draft"
              label="Guardar na pasta"
              icon={FolderDown}
              current={!published}
              onClick={onDraft}
            />
            <SaveCard
              testid="save-card-continue"
              label="Voltar ao editor"
              icon={Pencil}
              onClick={onContinue}
            />
          </div>
          {canDiscard && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onDiscard}
                aria-label="Jogar fora"
                className="flex h-12 w-12 items-center justify-center rounded-full text-vinho/80 transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]"
              >
                <Trash2 className="h-5 w-5" strokeWidth={STROKE.regular} />
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p
            id="save-title"
            className={cn(
              "type-headline-sm text-center font-display text-foreground",
              kids && "text-[1.75rem]",
            )}
          >
            {title}
          </p>
          <p className="type-body-md mt-0.5 text-center text-lapis">
            Já está guardado — escolha onde fica.
          </p>
          <div className="mt-3 flex justify-center">
            <ArtworkPaint
              pageId={artwork.pageId}
              w={artwork.w}
              h={artwork.h}
              commands={artwork.history.commands}
              scale={1}
              style={{
                width: Math.round((96 * artwork.w) / artwork.h),
                height: 96,
              }}
              className="rounded-md border border-border"
            />
          </div>
          <div className="mt-4 space-y-2.5">
            {canPublish && (
              <button
                type="button"
                autoFocus
                onClick={onPublish}
                className={cn(
                  "flex w-full items-center justify-center gap-2 bg-ambar font-display font-medium text-[#1c1b1a] transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]",
                  buttonBase,
                )}
              >
                <Star className="h-5 w-5 fill-current" strokeWidth={STROKE.semibold} /> Publicar no
                mural
              </button>
            )}
            {/* The draft choice stays after publishing (demote), same rule as
                the kids sheet: no closing option disappears with the state. */}
            <button
              type="button"
              onClick={onDraft}
              className={cn(
                "flex w-full items-center justify-center gap-2 bg-muted font-display font-medium text-foreground transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]",
                buttonBase,
              )}
            >
              <FolderDown className="h-5 w-5" strokeWidth={STROKE.semibold} /> Guardar rascunho
            </button>
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={onContinue}
                className={cn(
                  "flex items-center gap-2 font-semibold text-lapis transition-colors duration-150 ease-out",
                  kids ? "h-12 text-sm" : "h-10 text-xs",
                )}
              >
                <ArrowRight className="h-4 w-4" strokeWidth={STROKE.regular} /> Continuar desenhando
              </button>
              {canDiscard && (
                <button
                  type="button"
                  onClick={onDiscard}
                  aria-label="Jogar fora"
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2 font-semibold text-vinho underline decoration-vinho/30 underline-offset-4 transition-colors duration-150 ease-out",
                    kids ? "h-11 text-sm" : "h-10 text-xs",
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={STROKE.regular} /> Jogar fora
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </SheetSurface>
  );
}

/** One icon card of the 3–5 exit dialog: 96×80, no label, aria only. */
function SaveCard({
  label,
  icon: Icon,
  primary = false,
  autoFocus = false,
  current = false,
  testid,
  onClick,
}: {
  label: string;
  icon: typeof Star;
  primary?: boolean;
  autoFocus?: boolean;
  current?: boolean;
  testid: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={onClick}
      aria-label={label}
      aria-pressed={current}
      data-testid={testid}
      className={cn(
        "flex h-20 w-24 items-center justify-center rounded-[28px] transition-[translate,filter] duration-150 ease-out active:translate-y-0.5 active:scale-[0.96] active:brightness-95",
        primary ? "bg-ambar text-[#1c1b1a]" : "bg-muted text-foreground",
        current && "ring-2 ring-foreground/50 ring-offset-2 ring-offset-card",
      )}
    >
      <Icon className="h-9 w-9" strokeWidth={STROKE.semibold} />
    </button>
  );
}

function Celebration({ onClose }: { onClose: () => void }) {
  const stars = Array.from({ length: 10 }, (_, i) => ({
    left: 8 + ((i * 37) % 84),
    top: 45 + ((i * 23) % 40),
    delay: (i % 5) * 120,
    size: 18 + ((i * 7) % 18),
  }));
  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute inset-0 z-20 flex items-center justify-center bg-nanquim/10"
      aria-label="Fechar"
    >
      {stars.map((s, i) => (
        <Star
          key={i}
          className="absolute animate-float-up fill-sun text-sun"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}ms`,
          }}
        />
      ))}
      <span className="animate-pop-in flex flex-col items-center gap-2 rounded-lg bg-card px-10 py-7 shadow-tile">
        <Star className="h-16 w-16 fill-sun text-sun" />
        <span className="font-display text-3xl font-medium">Que lindo!</span>
      </span>
    </button>
  );
}

/**
 * A recording 2d context for the canvas seams.
 *
 * jsdom ships no 2d canvas at all — the suite's own setup stubs `getContext` to
 * null — so the adapter cannot be measured in pixels. What CAN be measured is
 * what it asks the substrate to draw: every op, in order, with the state it was
 * issued under (alpha, fill, composite, filter). That is the honest seam for
 * "the effect reached the raster": a blur was requested, a tint was filled, a
 * copy was blended at an offset.
 *
 * `installFakeCanvas()` also registers the scratch canvases the adapter creates,
 * so a test can tell the destination apart from the isolated layer.
 */
export type DrawOp = {
  op: "ellipse" | "drawImage" | "fillRect" | "clearRect";
  args: unknown[];
  alpha: number;
  fill: string;
  composite: string;
  filter: string;
};

/**
 * The colour stops a recorded fill was painted with, when that fill was a
 * gradient instead of a plain colour.
 *
 * It exists so a test can read the SHAPE of the engine's soft sprite — an
 * opaque core, intermediate stops and a fully transparent rim — without a pixel
 * canvas: jsdom cannot decode an image, but it can remember what the sprite was
 * painted with. A plain colour answers an empty list.
 */
export function gradientStops(op: DrawOp): string[] {
  const fill = op.fill as unknown as { stops?: string[] };
  return Array.isArray(fill?.stops) ? fill.stops : [];
}

export type Recorder = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  ops: DrawOp[];
};

/** A canvas of the DOM, recording every drawing op it receives. */
export function recorder(canvas: HTMLCanvasElement): Recorder {
  const ops: DrawOp[] = [];
  let alpha = 1;
  let fill = "#000000";
  let composite = "source-over";
  let filter = "none";
  type Matrix = [number, number, number, number, number, number];
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const saved: Array<[number, string, string, string, Matrix]> = [];
  /** A gradient stub: it keeps its stops, so a test can read the sprite's shape. */
  const gradient = () => {
    const stops: string[] = [];
    return {
      stops,
      addColorStop: (_offset: number, color: string) => {
        stops.push(color);
      },
    };
  };
  const snap = (op: DrawOp["op"], args: unknown[]): DrawOp => ({
    op,
    args,
    alpha,
    fill,
    composite,
    filter,
  });
  const ctx = {
    canvas,
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(v: number) {
      alpha = v;
    },
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      fill = v;
    },
    get globalCompositeOperation() {
      return composite;
    },
    set globalCompositeOperation(v: string) {
      composite = v;
    },
    get filter() {
      return filter;
    },
    set filter(v: string) {
      filter = v;
    },
    save: () => saved.push([alpha, fill, composite, filter, matrix]),
    restore: () => {
      const last = saved.pop();
      if (last) [alpha, fill, composite, filter, matrix] = last;
    },
    setTransform: (a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) => {
      matrix = [a, b, c, d, e, f];
    },
    /**
     * Gradients exist so the engine's soft sprite can be BUILT here: its body is
     * a radial gradient and a recorder without one would make every spray stroke
     * fall back to the ellipse — the opposite of what the spray tests measure.
     * The stops ARE kept, in order, because the sprite's contract is their
     * shape: an opaque core, intermediate steps and a transparent rim
     * (`gradientStops`). What they paint is never decoded.
     */
    createRadialGradient: gradient,
    createLinearGradient: gradient,
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    ellipse: (x: number, y: number, rx: number, ry: number) =>
      ops.push(snap("ellipse", [x, y, rx, ry])),
    fill: () => {},
    clearRect: (x: number, y: number, w: number, h: number) =>
      ops.push(snap("clearRect", [x, y, w, h])),
    fillRect: (x: number, y: number, w: number, h: number) =>
      ops.push(snap("fillRect", [x, y, w, h])),
    drawImage: (image: CanvasImageSource, dx: number, dy: number, dw?: number, dh?: number) => {
      if (dw === undefined || dh === undefined) {
        ops.push(snap("drawImage", [image, dx, dy]));
        return;
      }
      // The rectangle's centre and half-sides, in the sink's own device space:
      // the same `[x, y, rx, ry]` an ellipse op carries.
      const [a, b, c, d, e, f] = matrix;
      const lx = dx + dw / 2;
      const ly = dy + dh / 2;
      ops.push(
        snap("drawImage", [
          image,
          a * lx + c * ly + e,
          b * lx + d * ly + f,
          Math.hypot(a, b) * (dw / 2),
          Math.hypot(c, d) * (dh / 2),
        ]),
      );
    },
  };
  const entry: Recorder = { canvas, ctx: ctx as unknown as CanvasRenderingContext2D, ops };
  return entry;
}

/**
 * Installs one recorder per canvas for the duration of a test. Every canvas the
 * app creates — the paper's, the exporter's, the adapter's own scratch — gets
 * its own, so a destination never sees the layer's ops.
 */
export function installFakeCanvas() {
  const contexts = new Map<HTMLCanvasElement, Recorder>();
  const real = HTMLCanvasElement.prototype.getContext;

  const of = (canvas: HTMLCanvasElement): Recorder => {
    let entry = contexts.get(canvas);
    if (!entry) {
      entry = recorder(canvas);
      contexts.set(canvas, entry);
    }
    return entry;
  };

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: function (this: HTMLCanvasElement) {
      return of(this).ctx;
    },
  });

  return {
    /** The recorder of a canvas, created on demand (a fresh node works too). */
    of,
    /** Every canvas that asked for a context, keyed by its element. */
    contexts,
    /** The scratch canvases of one destination: everything else it created. */
    createdFor: (destination: HTMLCanvasElement) =>
      [...contexts.entries()].filter(([canvas]) => canvas !== destination).map(([, rec]) => rec),
    restore: () =>
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        writable: true,
        value: real,
      }),
  };
}

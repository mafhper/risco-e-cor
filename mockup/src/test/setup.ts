import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom ships no 2d canvas: `getContext` throws "Not implemented" and floods the
// suite on every paper render. The paper degrades to its SVG layers without a
// context (ArtworkPaint), and the stamp flow is measured at the sink seam, so
// the stub is the honest shape of this environment. A test that needs pixels
// can override it with its own fake context.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  writable: true,
  value: () => null,
});

// jsdom has no layout. The canvas measures its paper with a ResizeObserver and
// maps pointer coordinates through getBoundingClientRect, so both are stubbed
// with a fixed 300dp sheet — enough to exercise the real pointer pipeline.
class ResizeObserverStub {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(target: Element) {
    const rect = {
      width: 300,
      height: 420,
      top: 0,
      left: 0,
      right: 300,
      bottom: 420,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRectReadOnly;
    const box = { inlineSize: 300, blockSize: 420 };
    const entry = {
      target,
      contentRect: rect,
      borderBoxSize: [box],
      contentBoxSize: [box],
      devicePixelContentBoxSize: [box],
    };
    this.cb([entry as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}
// Without real layout a shipped ResizeObserver never fires and the canvas
// would stay unmeasured, so the measuring stub is always installed.
Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverStub,
});

// jsdom has no PointerEvent constructor; MouseEvent carries every field the
// canvas reads (clientX/clientY/pointerId), so pointer gestures stay testable.
if (!("PointerEvent" in window)) {
  Object.defineProperty(window, "PointerEvent", {
    configurable: true,
    writable: true,
    value: MouseEvent,
  });
  Object.defineProperty(globalThis, "PointerEvent", {
    configurable: true,
    writable: true,
    value: MouseEvent,
  });
}

const fixedRect = (): DOMRect => ({
  width: 300,
  height: 300,
  top: 0,
  left: 0,
  right: 300,
  bottom: 300,
  x: 0,
  y: 0,
  toJSON: () => ({}),
});
Object.defineProperty(Element.prototype, "getBoundingClientRect", {
  configurable: true,
  writable: true,
  value: fixedRect,
});

// jsdom lacks pointer capture; the canvas only uses it to keep tracking a finger.
Object.defineProperty(Element.prototype, "setPointerCapture", {
  configurable: true,
  writable: true,
  value: () => {},
});
Object.defineProperty(Element.prototype, "releasePointerCapture", {
  configurable: true,
  writable: true,
  value: () => {},
});
Object.defineProperty(Element.prototype, "hasPointerCapture", {
  configurable: true,
  writable: true,
  value: () => false,
});

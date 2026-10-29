/**
 * Theme frame for gallery/mural thumbnails: bolts and a four-point star on
 * top, a flying-car trail at the bottom. Corner marks only, so the artwork
 * stays visible. Overlay decoration — the caller adds pointer-events-none.
 */
export function FrameHeroi({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      aria-hidden="true"
      fill="none"
      style={{ stroke: "var(--hero-accent)" }}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g data-region="raios-topo">
        <polygon points="22,10 34,10 28,22 36,22 18,44 23,28 14,28" />
        <polygon points="178,10 166,10 172,22 164,22 182,44 177,28 186,28" />
        <path d="M56 10 L59 17 L66 20 L59 23 L56 30 L53 23 L46 20 L53 17 Z" />
        <path d="M144 10 L147 17 L154 20 L147 23 L144 30 L141 23 L134 20 L141 17 Z" />
      </g>
      <g data-region="rastros-base">
        <path d="M14 176 L34 176 M14 184 L34 184" />
        <circle cx="38" cy="180" r="2.2" />
        <path d="M186 176 L166 176 M186 184 L166 184" />
        <circle cx="162" cy="180" r="2.2" />
      </g>
    </svg>
  );
}

/**
 * Theme avatar art: a plain shield with a lightning bolt — the most generic
 * hero symbol there is (no face, no licensed silhouette). Decorative.
 */
export function AvatarHeroi({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      aria-hidden="true"
      style={{ stroke: "var(--hero-stroke)" }}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="48" cy="48" r="48" style={{ fill: "var(--hero-primary)" }} stroke="none" />
      <path
        data-region="escudo"
        d="M48 16 C57 22 65 24 71 25 C71 46 66 65 48 79 C30 65 25 46 25 25 C31 24 39 22 48 16 Z"
        style={{ fill: "var(--hero-surface)" }}
      />
      <polygon
        data-region="raio"
        points="52,28 40,52 47,52 42,68 59,44 51,44 56,28"
        style={{ fill: "var(--hero-warm)" }}
      />
    </svg>
  );
}

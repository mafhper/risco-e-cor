/**
 * Theme frame for gallery/mural thumbnails: small corner marks only (leaves on
 * top, sauro footprints on the bottom), so the artwork stays visible.
 * Overlay decoration — the caller adds pointer-events-none.
 */
export function FrameDino({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      aria-hidden="true"
      fill="none"
      style={{ stroke: "var(--dino-primary)" }}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g data-region="folhas-topo">
        <path d="M10 36 C10 22 22 12 36 12 C36 26 26 36 10 36 Z" />
        <path d="M15 31 C19 25 25 19 31 15" />
        <path d="M190 36 C190 22 178 12 164 12 C164 26 174 36 190 36 Z" />
        <path d="M185 31 C181 25 175 19 169 15" />
      </g>
      <g data-region="pegadas-base">
        <ellipse cx="28" cy="184" rx="7" ry="5" />
        <circle cx="21" cy="175" r="2.4" />
        <circle cx="28" cy="173" r="2.4" />
        <circle cx="35" cy="175" r="2.4" />
        <ellipse cx="172" cy="184" rx="7" ry="5" />
        <circle cx="165" cy="175" r="2.4" />
        <circle cx="172" cy="173" r="2.4" />
        <circle cx="179" cy="175" r="2.4" />
      </g>
    </svg>
  );
}

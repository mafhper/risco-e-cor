/**
 * Theme avatar art: a cute front-facing sauro head, same language as HeroDino.
 * Fills the whole circle (the caller clips it), decorative: aria-hidden.
 */
export function AvatarDino({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      aria-hidden="true"
      style={{ stroke: "var(--dino-stroke)" }}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="48" cy="48" r="48" style={{ fill: "var(--dino-primary)" }} stroke="none" />
      <path
        data-region="cabeca"
        d="M48 20 C63 20 74 32 74 49 C74 65 62 76 48 76 C34 76 22 65 22 49 C22 32 33 20 48 20 Z"
        style={{ fill: "var(--dino-leaf)" }}
      />
      <path
        data-region="focinho"
        d="M48 46 C57 46 63 51 63 58 C63 65 56 70 48 70 C40 70 33 65 33 58 C33 51 39 46 48 46 Z"
        style={{ fill: "var(--dino-warm)" }}
      />
      <circle cx="40" cy="40" r="5" fill="#ffffff" />
      <circle cx="56" cy="40" r="5" fill="#ffffff" />
      <circle cx="41.5" cy="39.5" r="2.2" style={{ fill: "var(--dino-stroke)" }} stroke="none" />
      <circle cx="57.5" cy="39.5" r="2.2" style={{ fill: "var(--dino-stroke)" }} stroke="none" />
      <circle cx="44" cy="55" r="1.6" style={{ fill: "var(--dino-stroke)" }} stroke="none" />
      <circle cx="52" cy="55" r="1.6" style={{ fill: "var(--dino-stroke)" }} stroke="none" />
      <path d="M43 61 C45 64 51 64 53 61" fill="none" />
      <ellipse
        cx="30"
        cy="53"
        rx="5"
        ry="3.5"
        style={{ fill: "var(--dino-primary)" }}
        stroke="none"
        opacity={0.5}
      />
      <ellipse
        cx="66"
        cy="53"
        rx="5"
        ry="3.5"
        style={{ fill: "var(--dino-primary)" }}
        stroke="none"
        opacity={0.5}
      />
    </svg>
  );
}

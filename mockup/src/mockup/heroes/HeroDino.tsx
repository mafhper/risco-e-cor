/**
 * Theme art: "Vale dos Dinossauros" — a pastel sauro valley, 13 named regions.
 * Generic on purpose (rounded sauro, no franchise shapes) and decorative:
 * aria-hidden. Regions carry data-region for a future "color the hero" mode.
 * Colors come from the --dino-* tokens so a retune in styles.css retints the art.
 */
export function HeroDino({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={className}
      data-hero="dinos"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
      style={{ stroke: "var(--dino-stroke)" }}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 1 ceu */}
      <rect
        data-region="ceu"
        width="200"
        height="160"
        style={{ fill: "var(--dino-bg)" }}
        stroke="none"
      />

      {/* 2 sol */}
      <circle data-region="sol" cx="170" cy="30" r="18" style={{ fill: "var(--dino-warm)" }} />

      {/* 3 colina1 */}
      <ellipse
        data-region="colina1"
        cx="40"
        cy="145"
        rx="55"
        ry="28"
        style={{ fill: "var(--dino-leaf)" }}
      />

      {/* 4 colina2 */}
      <ellipse
        data-region="colina2"
        cx="170"
        cy="140"
        rx="48"
        ry="25"
        style={{ fill: "var(--dino-leaf)" }}
        opacity={0.75}
      />

      {/* 5 flor1 */}
      <g data-region="flor1">
        <ellipse cx="19" cy="126" rx="5" ry="7" style={{ fill: "var(--dino-primary)" }} />
        <ellipse cx="29" cy="126" rx="5" ry="7" style={{ fill: "var(--dino-primary)" }} />
        <ellipse cx="24" cy="120" rx="5" ry="7" style={{ fill: "var(--dino-primary)" }} />
        <circle cx="24" cy="127" r="3.5" style={{ fill: "var(--dino-warm)" }} />
      </g>

      {/* 6 flor2 */}
      <g data-region="flor2">
        <ellipse cx="171" cy="121" rx="5" ry="7" style={{ fill: "var(--dino-primary)" }} />
        <ellipse cx="181" cy="121" rx="5" ry="7" style={{ fill: "var(--dino-primary)" }} />
        <ellipse cx="176" cy="115" rx="5" ry="7" style={{ fill: "var(--dino-primary)" }} />
        <circle cx="176" cy="122" r="3.5" style={{ fill: "var(--dino-warm)" }} />
      </g>

      {/* 7 corpo-dino */}
      <ellipse
        data-region="corpo-dino"
        cx="95"
        cy="105"
        rx="42"
        ry="26"
        style={{ fill: "var(--dino-leaf)" }}
      />

      {/* 8 barriga-dino */}
      <ellipse
        data-region="barriga-dino"
        cx="95"
        cy="112"
        rx="25"
        ry="14"
        style={{ fill: "var(--dino-warm)" }}
      />

      {/* 9 cabeca-dino (pescoco + cabeca unificados) */}
      <path
        data-region="cabeca-dino"
        d="M 120 90 C 128 72, 136 60, 148 55 C 160 50, 168 54, 168 65 C 168 76, 158 82, 148 82 C 138 82, 126 90, 120 95 Z"
        style={{ fill: "var(--dino-leaf)" }}
      />

      {/* 10 olho-dino */}
      <g data-region="olho-dino">
        <circle cx="155" cy="62" r="5" fill="#ffffff" />
        <circle cx="157" cy="61" r="2.2" style={{ fill: "var(--dino-stroke)" }} stroke="none" />
      </g>

      {/* 11 pata1 */}
      <rect
        data-region="pata1"
        x="68"
        y="125"
        width="12"
        height="16"
        rx="4"
        style={{ fill: "var(--dino-leaf)" }}
      />

      {/* 12 pata2 */}
      <rect
        data-region="pata2"
        x="105"
        y="125"
        width="12"
        height="16"
        rx="4"
        style={{ fill: "var(--dino-leaf)" }}
      />

      {/* 13 cauda-dino (arredondada, sem ponta) */}
      <path
        data-region="cauda-dino"
        d="M 53 105 C 42 108, 32 106, 28 100 C 26 96, 30 94, 36 96 C 42 98, 48 100, 53 103 Z"
        style={{ fill: "var(--dino-leaf)" }}
      />

      {/* sorriso (detalhe, sem regiao) */}
      <path d="M 158 70 C 160 74, 164 74, 166 72" fill="none" />
    </svg>
  );
}

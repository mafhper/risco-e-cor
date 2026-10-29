/**
 * Theme art: "Herói genérico sobrevoa a cidade" — 16 named regions.
 * A generic humanoid with a golden cape and a simple half-mask over a skyline
 * with flying cars. Deliberately NOT any licensed character: no known name,
 * no iconic palette, forms are original. Decorative: aria-hidden.
 * Colors come from the --hero-* tokens.
 */
export function HeroHeroi({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 160"
      className={className}
      data-hero="heroi"
      aria-hidden="true"
      preserveAspectRatio="xMidYMax meet"
      style={{ stroke: "var(--hero-stroke)" }}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 1 ceu */}
      <rect
        data-region="ceu"
        width="200"
        height="160"
        style={{ fill: "var(--hero-bg)" }}
        stroke="none"
      />

      {/* 2-3 estrelas */}
      <polygon
        data-region="estrela1"
        points="30,22 33,30 41,30 35,35 37,43 30,38 23,43 25,35 19,30 27,30"
        style={{ fill: "var(--hero-warm)" }}
      />
      <polygon
        data-region="estrela2"
        points="175,14 177,19 182,19 178,22 180,27 175,24 170,27 172,22 168,19 173,19"
        style={{ fill: "var(--hero-warm)" }}
      />

      {/* 4 carro2 (ao fundo) */}
      <g data-region="carro2">
        <ellipse cx="55" cy="48" rx="18" ry="6" style={{ fill: "var(--hero-accent)" }} />
        <polygon points="48,42 55,36 62,42" style={{ fill: "var(--hero-accent)" }} />
        <line x1="30" y1="46" x2="37" y2="48" fill="none" />
        <line x1="30" y1="50" x2="37" y2="50" fill="none" />
      </g>

      {/* 5 predio1 */}
      <g data-region="predio1">
        <rect x="4" y="96" width="32" height="64" style={{ fill: "var(--hero-accent)" }} />
        <rect x="10" y="104" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="24" y="104" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="10" y="120" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="24" y="120" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
      </g>

      {/* 6 predio2 (mais alto) */}
      <g data-region="predio2">
        <rect x="40" y="76" width="36" height="84" style={{ fill: "var(--hero-accent)" }} />
        <rect x="48" y="84" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="62" y="84" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="48" y="100" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="62" y="100" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="48" y="116" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="62" y="116" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
      </g>

      {/* 7 predio3 */}
      <g data-region="predio3">
        <rect x="160" y="110" width="36" height="50" style={{ fill: "var(--hero-accent)" }} />
        <rect x="168" y="118" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="182" y="118" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="168" y="134" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
        <rect x="182" y="134" width="6" height="8" style={{ fill: "var(--hero-surface)" }} />
      </g>

      {/* 8 carro1 (primeiro plano) */}
      <g data-region="carro1">
        <ellipse cx="160" cy="64" rx="24" ry="8" style={{ fill: "var(--hero-warm)" }} />
        <polygon points="150,56 160,48 170,56" style={{ fill: "var(--hero-warm)" }} />
        <ellipse cx="160" cy="64" rx="8" ry="5" style={{ fill: "var(--hero-surface)" }} />
        <line x1="130" y1="62" x2="136" y2="64" fill="none" />
        <line x1="130" y1="66" x2="136" y2="66" fill="none" />
      </g>

      {/* 9 heroi-capa (atras do corpo) */}
      <path
        data-region="heroi-capa"
        d="M 96 72 L 120 72 L 132 120 L 108 128 L 84 120 Z"
        style={{ fill: "var(--hero-warm)" }}
      />

      {/* 10 heroi-corpo (torso) */}
      <path
        data-region="heroi-corpo"
        d="M 96 72 C 88 72, 84 78, 84 86 L 84 110 C 84 116, 88 120, 96 120 L 120 120 C 128 120, 132 116, 132 110 L 132 86 C 132 78, 128 72, 120 72 Z"
        style={{ fill: "var(--hero-primary)" }}
      />

      {/* emblema no peito (detalhe) */}
      <polygon
        points="108,82 114,94 108,106 102,94"
        style={{ fill: "var(--hero-warm)" }}
        strokeWidth={1.5}
      />

      {/* 11 heroi-braco */}
      <path
        data-region="heroi-braco"
        d="M 132 84 L 156 70 C 160 68, 162 72, 158 76 L 136 92 Z"
        style={{ fill: "var(--hero-primary)" }}
      />
      <circle cx="158" cy="72" r="5" fill="#fad3b0" />

      {/* 12 heroi-cabeca */}
      <ellipse data-region="heroi-cabeca" cx="108" cy="58" rx="16" ry="18" fill="#fad3b0" />

      {/* 13 heroi-mascara (meia-mascara sobre os olhos) */}
      <g data-region="heroi-mascara">
        <path
          d="M 92 54 L 124 54 C 126 54, 126 62, 124 62 L 92 62 C 90 62, 90 54, 92 54 Z"
          style={{ fill: "var(--hero-stroke)" }}
        />
        <ellipse cx="100" cy="58" rx="3" ry="2.5" fill="#ffffff" stroke="none" />
        <ellipse cx="116" cy="58" rx="3" ry="2.5" fill="#ffffff" stroke="none" />
      </g>

      {/* 14-15 pernas + botas */}
      <g data-region="heroi-pernas">
        <rect
          x="90"
          y="120"
          width="14"
          height="22"
          rx="4"
          style={{ fill: "var(--hero-primary)" }}
        />
        <rect
          x="112"
          y="120"
          width="14"
          height="22"
          rx="4"
          style={{ fill: "var(--hero-primary)" }}
        />
        <rect x="88" y="138" width="18" height="8" rx="3" style={{ fill: "var(--hero-warm)" }} />
        <rect x="110" y="138" width="18" height="8" rx="3" style={{ fill: "var(--hero-warm)" }} />
      </g>

      {/* 16 raio */}
      <polygon
        data-region="raio"
        points="140,78 146,88 142,88 148,100 136,88 140,88 134,78"
        style={{ fill: "var(--hero-warm)" }}
      />
    </svg>
  );
}

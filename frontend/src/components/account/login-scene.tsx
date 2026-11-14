/**
 * The painted backdrop for `/login`.
 *
 * An original watercolour study desk — books, a globe, a jar of pencils, a
 * plant, paper planes — drawn once in SVG and tinted by the variables in
 * `globals.css`, so the theme switch turns daylight into dusk without a second
 * asset. Decorative only: the whole scene is hidden from assistive technology,
 * and the middle of the composition is deliberately empty so the card above it
 * keeps its contrast.
 */
export function LoginScene() {
  return (
    <div
      aria-hidden
      className="cg-login-scene pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          <linearGradient id="login-sky" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" style={{ stopColor: "var(--scene-sky-top)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--scene-sky-mid)" }} />
            <stop offset="1" style={{ stopColor: "var(--scene-sky-bottom)" }} />
          </linearGradient>
          <linearGradient id="login-desk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--scene-desk-top)" }} />
            <stop offset="1" style={{ stopColor: "var(--scene-desk-bottom)" }} />
          </linearGradient>
          <radialGradient id="login-glow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0"
              style={{ stopColor: "#f2563b", stopOpacity: "var(--scene-glow)" }}
            />
            <stop offset="1" style={{ stopColor: "#f2563b", stopOpacity: 0 }} />
          </radialGradient>
          <radialGradient id="login-vignette" cx="50%" cy="46%" r="72%">
            <stop
              offset="0.42"
              style={{ stopColor: "var(--scene-vignette)", stopOpacity: 0 }}
            />
            <stop offset="1" style={{ stopColor: "var(--scene-vignette)" }} />
          </radialGradient>
          <filter id="login-wash" x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.009 0.013"
              numOctaves="2"
              seed="14"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="90"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="login-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.82"
              numOctaves="3"
              stitchTiles="stitch"
              seed="6"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"
            />
          </filter>
        </defs>

        <rect width="1600" height="1000" fill="url(#login-sky)" />

        <g filter="url(#login-wash)">
          <ellipse
            cx="250"
            cy="290"
            rx="360"
            ry="290"
            style={{ fill: "var(--scene-bloom-a)" }}
            opacity="0.55"
          />
          <ellipse
            cx="1300"
            cy="230"
            rx="430"
            ry="330"
            style={{ fill: "var(--scene-bloom-b)" }}
            opacity="0.4"
          />
          <ellipse
            cx="800"
            cy="860"
            rx="620"
            ry="250"
            style={{ fill: "var(--scene-bloom-c)" }}
            opacity="0.45"
          />
          <ellipse
            cx="1520"
            cy="760"
            rx="320"
            ry="260"
            style={{ fill: "var(--scene-bloom-a)" }}
            opacity="0.35"
          />
        </g>

        <rect
          x="1050"
          y="40"
          width="600"
          height="600"
          fill="url(#login-glow)"
        />

        <path
          d="M0 806 C 240 792, 430 814, 640 800 C 850 786, 1060 788, 1270 802 C 1400 810, 1500 798, 1600 808 L1600 1000 L0 1000 Z"
          fill="url(#login-desk)"
        />
        <path
          d="M0 806 C 240 792, 430 814, 640 800 C 850 786, 1060 788, 1270 802 C 1400 810, 1500 798, 1600 808"
          fill="none"
          style={{ stroke: "var(--scene-ink)" }}
          strokeWidth="2.5"
          opacity="0.8"
        />

        <g
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: "var(--scene-ink)" }}
        >
          <g transform="rotate(-1.1 230 780)">
            <rect
              x="98"
              y="752"
              width="262"
              height="38"
              rx="9"
              style={{ fill: "var(--scene-book-a)" }}
            />
            <rect
              x="118"
              y="715"
              width="228"
              height="35"
              rx="8"
              style={{ fill: "var(--scene-book-b)" }}
            />
            <rect
              x="140"
              y="682"
              width="190"
              height="31"
              rx="7"
              style={{ fill: "var(--scene-book-c)" }}
            />
            <path
              d="M330 758h22M330 770h22M345 722h18M345 733h18M322 690h16M322 700h16"
              opacity="0.55"
            />
            <path d="M126 766h206M146 731h172M166 697h140" opacity="0.35" />
          </g>

          <g>
            <ellipse
              cx="322"
              cy="742"
              rx="48"
              ry="10"
              style={{ fill: "var(--scene-object-2)" }}
            />
            <path d="M256 696 C 256 752, 388 752, 388 696" />
            <circle
              cx="322"
              cy="614"
              r="63"
              style={{ fill: "var(--scene-object)" }}
            />
            <path
              d="M259 600 C 289 588, 305 605, 330 596 C 352 588, 371 597, 385 611"
              style={{ stroke: "var(--scene-teal)" }}
              strokeWidth="6"
              opacity="0.55"
            />
            <path
              d="M277 655 C 300 642, 330 650, 350 640"
              style={{ stroke: "var(--scene-teal)" }}
              strokeWidth="5"
              opacity="0.4"
            />
            <ellipse cx="322" cy="614" rx="63" ry="26" opacity="0.7" />
            <ellipse cx="322" cy="614" rx="27" ry="63" opacity="0.55" />
            <path d="M322 551v126" opacity="0.3" />
          </g>

          <g>
            <path
              d="M1128 790 L1148 722 L1222 722 L1240 790 Z"
              style={{ fill: "var(--scene-terracotta)" }}
              opacity="0.75"
            />
            <path d="M1182 722 C 1182 688, 1170 662, 1150 638" />
            <path d="M1184 720 C 1192 682, 1210 660, 1232 646" />
            <path d="M1182 720 C 1180 684, 1188 650, 1182 622" />
            <path
              d="M1150 638 C 1124 638, 1110 622, 1108 602 C 1134 602, 1152 616, 1150 638 Z"
              style={{ fill: "var(--scene-teal)" }}
              opacity="0.55"
            />
            <path
              d="M1232 646 C 1258 642, 1270 624, 1272 606 C 1246 608, 1232 624, 1232 646 Z"
              style={{ fill: "var(--scene-teal)" }}
              opacity="0.45"
            />
            <path
              d="M1182 622 C 1162 606, 1158 586, 1164 568 C 1186 578, 1194 598, 1182 622 Z"
              style={{ fill: "var(--scene-teal)" }}
              opacity="0.5"
            />
            <path
              d="M1182 622 C 1200 602, 1214 594, 1232 594 C 1226 618, 1206 630, 1182 622 Z"
              style={{ fill: "var(--scene-teal)" }}
              opacity="0.4"
            />
          </g>

          <g>
            <path d="M1288 644 C 1284 604, 1270 566, 1246 530" />
            <path d="M1308 644 C 1306 600, 1310 552, 1318 508" />
            <path d="M1330 644 C 1342 606, 1360 574, 1384 548" />
            <path
              d="M1246 530 l-7 -20 l18 10 Z"
              style={{ fill: "var(--scene-terracotta)" }}
            />
            <path
              d="M1318 508 l-4 -22 l16 12 Z"
              style={{ fill: "var(--scene-terracotta)" }}
            />
            <path
              d="M1384 548 l14 -14 l-2 20 Z"
              style={{ fill: "var(--scene-book-b)" }}
            />
            <rect
              x="1272"
              y="644"
              width="88"
              height="146"
              rx="16"
              style={{ fill: "var(--scene-object)" }}
            />
            <path d="M1278 690 C 1300 698, 1332 698, 1354 690" opacity="0.4" />
            <path d="M1282 728 C 1304 736, 1330 736, 1350 728" opacity="0.3" />
          </g>

          <g transform="rotate(0.8 1490 770)">
            <rect
              x="1404"
              y="758"
              width="168"
              height="36"
              rx="8"
              style={{ fill: "var(--scene-book-c)" }}
            />
            <rect
              x="1422"
              y="724"
              width="138"
              height="32"
              rx="7"
              style={{ fill: "var(--scene-book-a)" }}
            />
            <path d="M1540 764h16M1540 776h16M1528 731h14M1528 742h14" opacity="0.5" />
          </g>

          <g transform="rotate(-4 470 864)">
            <rect
              x="392"
              y="836"
              width="176"
              height="54"
              rx="8"
              style={{ fill: "var(--scene-paper)" }}
              opacity="0.65"
            />
            <path d="M408 852h140M408 866h140M408 880h96" opacity="0.35" />
            <path d="M560 836v54" opacity="0.5" />
          </g>
        </g>

        <g strokeWidth="2" strokeLinejoin="round">
          <g transform="translate(396 168) rotate(-12) scale(1.15)">
            <path
              d="M0 30 112 0 70 64 44 42 Z"
              style={{ fill: "var(--scene-paper)", stroke: "var(--scene-ink)" }}
              fillOpacity="0.8"
            />
            <path
              d="M44 42 112 0"
              fill="none"
              style={{ stroke: "var(--scene-ink)" }}
              opacity="0.7"
            />
          </g>
          <g transform="translate(1216 118) rotate(13) scale(0.95)">
            <path
              d="M0 30 112 0 70 64 44 42 Z"
              style={{ fill: "var(--scene-paper)", stroke: "var(--scene-ink)" }}
              fillOpacity="0.72"
            />
            <path
              d="M44 42 112 0"
              fill="none"
              style={{ stroke: "var(--scene-ink)" }}
              opacity="0.7"
            />
          </g>
          <g transform="translate(1440 330) rotate(6) scale(0.62)">
            <path
              d="M0 30 112 0 70 64 44 42 Z"
              style={{ fill: "var(--scene-paper)", stroke: "var(--scene-ink)" }}
              fillOpacity="0.6"
            />
            <path
              d="M44 42 112 0"
              fill="none"
              style={{ stroke: "var(--scene-ink)" }}
              opacity="0.6"
            />
          </g>
        </g>

        <g style={{ stroke: "var(--scene-ink)" }} strokeWidth="2" fill="none" opacity="0.75">
          <circle
            cx="474"
            cy="432"
            r="3"
            style={{ fill: "var(--scene-terracotta)" }}
            stroke="none"
          />
          <circle cx="456" cy="410" r="2" opacity="0.6" />
          <circle
            cx="1160"
            cy="498"
            r="2.5"
            style={{ fill: "var(--scene-terracotta)" }}
            stroke="none"
          />
          <circle cx="1138" cy="520" r="1.8" opacity="0.5" />
          <path
            d="M312 470 l12 -22 l12 22 Z"
            style={{ fill: "var(--scene-paper)" }}
          />
          <path
            d="M1332 392 l18 18 l-18 18 l-18 -18 Z"
            style={{ fill: "var(--scene-object)" }}
          />
          <path d="M180 380 c 10 -14, 24 -14, 34 0" opacity="0.5" />
        </g>

        <rect width="1600" height="1000" fill="url(#login-vignette)" />
        <rect
          width="1600"
          height="1000"
          filter="url(#login-grain)"
          style={{ mixBlendMode: "soft-light", opacity: "var(--scene-grain)" }}
        />
      </svg>
    </div>
  );
}

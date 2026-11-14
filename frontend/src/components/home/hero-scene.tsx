/**
 * The painted backdrop for the homepage hero.
 *
 * An original watercolour study of the end of a school day: three students on a
 * ridge at dawn, a school and its flag on the next hill, a telescope, a stack of
 * books, pencils and a graduation cap in the grass, paper planes and a small
 * rocket in the sky. Drawn once in SVG with the same turbulence-and-grain
 * technique as the sign-in scene, so the two pages feel painted by one hand.
 *
 * The left third is deliberately quiet and dark — the headline sits there, and
 * the gradient laid over this scene in `page.tsx` carries the contrast. The
 * composition is centred so a narrow phone crops to the students and the school
 * rather than to empty sky. Decorative only, hidden from assistive technology.
 */
export function HeroScene() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-navy">
      <svg
        className="h-full w-full"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          <linearGradient id="hero-sky" x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#071121" />
            <stop offset="0.45" stopColor="#0b1d3a" />
            <stop offset="1" stopColor="#123a66" />
          </linearGradient>
          <radialGradient id="hero-dawn" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f2a25c" stopOpacity="0.5" />
            <stop offset="0.55" stopColor="#e88a52" stopOpacity="0.16" />
            <stop offset="1" stopColor="#e88a52" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hero-vignette" cx="0.6" cy="0.42" r="0.8">
            <stop offset="0.42" stopColor="#030a16" stopOpacity="0" />
            <stop offset="1" stopColor="#030a16" stopOpacity="0.55" />
          </radialGradient>
          <linearGradient id="hero-path" x1="0" y1="1" x2="0.4" y2="0">
            <stop offset="0" stopColor="#f2b66d" stopOpacity="0.1" />
            <stop offset="1" stopColor="#f2b66d" stopOpacity="0.45" />
          </linearGradient>

          <filter id="hero-wash" x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.008 0.012"
              numOctaves="2"
              seed="11"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="90"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="hero-edge" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.02"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
            />
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
          <filter id="hero-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="3"
              stitchTiles="stitch"
              seed="9"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"
            />
          </filter>

          <symbol id="hero-star" viewBox="-12 -12 24 24">
            <path d="M0 -12 C1.6 -3.8 3.8 -1.6 12 0 C3.8 1.6 1.6 3.8 0 12 C-1.6 3.8 -3.8 1.6 -12 0 C-3.8 -1.6 -1.6 -3.8 0 -12 Z" />
          </symbol>

          <mask id="hero-moon">
            <rect x="1000" y="30" width="200" height="200" fill="#fff" />
            <circle cx="1110" cy="96" r="34" fill="#000" />
          </mask>

          <clipPath id="hero-cloud">
            <path d="M0 40 C0 18 18 4 38 10 C46 -8 74 -12 86 6 C104 -2 124 10 122 30 C140 32 148 50 136 62 L12 62 C-2 62 -6 50 0 40 Z" />
          </clipPath>
        </defs>

        <rect width="1600" height="900" fill="url(#hero-sky)" />

        <g filter="url(#hero-wash)">
          <ellipse cx="260" cy="250" rx="420" ry="320" fill="#0f2a52" opacity="0.55" />
          <ellipse cx="1280" cy="170" rx="470" ry="350" fill="#1b4a86" opacity="0.36" />
          <ellipse cx="1430" cy="330" rx="380" ry="300" fill="#2b6cb0" opacity="0.3" />
          <ellipse cx="1180" cy="410" rx="300" ry="210" fill="#0d7f86" opacity="0.16" />
          <ellipse cx="900" cy="720" rx="700" ry="260" fill="#0a1d3a" opacity="0.5" />
          <ellipse cx="1470" cy="760" rx="340" ry="280" fill="#123a5f" opacity="0.45" />
        </g>

        <ellipse cx="1190" cy="600" rx="540" ry="400" fill="url(#hero-dawn)" />
        <ellipse cx="1350" cy="330" rx="360" ry="240" fill="url(#hero-dawn)" opacity="0.45" />

        <circle cx="1080" cy="110" r="40" fill="#f3dfb4" opacity="0.95" mask="url(#hero-moon)" />
        <circle cx="1080" cy="110" r="52" fill="#f3dfb4" opacity="0.06" />

        <g fill="#f6d79a">
          <use href="#hero-star" x="1027" y="91" width="26" height="26" />
          <use href="#hero-star" x="1312" y="73" width="19" height="19" />
          <use href="#hero-star" x="1480" y="248" width="15" height="15" />
          <use href="#hero-star" x="1200" y="190" width="12" height="12" />
          <use href="#hero-star" x="892" y="96" width="13" height="13" />
          <use href="#hero-star" x="812" y="196" width="9" height="9" />
        </g>
        <g
          stroke="#cfe0f5"
          strokeOpacity="0.16"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M898 102 L1027 104 L1058 172 M1027 104 L1206 196" />
          <path d="M816 200 L884 182 L892 102" />
        </g>
        <g fill="#cfe0f5" opacity="0.55">
          <circle cx="1152" cy="92" r="2.4" />
          <circle cx="1392" cy="150" r="2" />
          <circle cx="1540" cy="356" r="2.6" />
          <circle cx="1086" cy="300" r="1.8" />
          <circle cx="1440" cy="470" r="2.2" />
          <circle cx="980" cy="236" r="1.6" />
          <circle cx="706" cy="150" r="1.8" opacity="0.6" />
          <circle cx="520" cy="330" r="1.6" opacity="0.45" />
          <circle cx="352" cy="190" r="1.4" opacity="0.35" />
          <circle cx="860" cy="286" r="1.8" opacity="0.5" />
          <circle cx="760" cy="330" r="1.4" opacity="0.4" />
          <circle cx="946" cy="330" r="1.6" opacity="0.45" />
        </g>

        <g transform="translate(748 250) scale(1.12)">
          <path
            d="M0 40 C0 18 18 4 38 10 C46 -8 74 -12 86 6 C104 -2 124 10 122 30 C140 32 148 50 136 62 L12 62 C-2 62 -6 50 0 40 Z"
            fill="#dbe8f8"
            opacity="0.1"
            stroke="#cfe0f5"
            strokeOpacity="0.18"
            strokeWidth="1.5"
          />
          <g clipPath="url(#hero-cloud)" stroke="#cfe0f5" strokeOpacity="0.12" strokeWidth="1">
            <path d="M8 18 H136 M8 32 H136 M8 46 H136" />
            <path d="M26 2 V64 M56 2 V64 M86 2 V64 M116 2 V64" />
          </g>
        </g>

        <g transform="translate(1198 422) scale(0.92)" opacity="0.7">
          <path
            d="M0 40 C0 18 18 4 38 10 C46 -8 74 -12 86 6 C104 -2 124 10 122 30 C140 32 148 50 136 62 L12 62 C-2 62 -6 50 0 40 Z"
            fill="#dbe8f8"
            opacity="0.07"
            stroke="#cfe0f5"
            strokeOpacity="0.15"
            strokeWidth="1.5"
          />
          <g clipPath="url(#hero-cloud)" stroke="#cfe0f5" strokeOpacity="0.09" strokeWidth="1">
            <path d="M8 18 H136 M8 32 H136 M8 46 H136" />
            <path d="M26 2 V64 M56 2 V64 M86 2 V64 M116 2 V64" />
          </g>
        </g>

        <g fill="none" stroke="#cfe0f5" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round">
          <path d="M536 296 c8 -9 16 -9 24 0 M572 282 c8 -9 16 -9 24 0" />
          <path d="M476 252 c6 -7 12 -7 18 0" strokeOpacity="0.22" />
        </g>

        <g transform="translate(1206 182) rotate(9)" fill="#e8f0fb" fillOpacity="0.8">
          <path d="M0 0 L58 -16 L36 20 L22 7 Z" />
          <path d="M22 7 L58 -16" fill="none" stroke="#cfe0f5" strokeOpacity="0.5" strokeWidth="1.2" />
        </g>
        <g transform="translate(1426 342) rotate(14) scale(0.72)" fill="#e8f0fb" fillOpacity="0.62">
          <path d="M0 0 L58 -16 L36 20 L22 7 Z" />
          <path d="M22 7 L58 -16" fill="none" stroke="#cfe0f5" strokeOpacity="0.4" strokeWidth="1.2" />
        </g>
        <g transform="translate(660 208) rotate(-10) scale(0.8)" fill="#e8f0fb" fillOpacity="0.35">
          <path d="M0 0 L58 -16 L36 20 L22 7 Z" />
        </g>

        <g transform="translate(1336 306) rotate(-26) scale(2.05)">
          <path
            d="M0 -46 C13 -28 13 -8 0 8 C-13 -8 -13 -28 0 -46 Z"
            fill="#eef4fc"
            stroke="#a9c4e6"
            strokeOpacity="0.7"
            strokeWidth="1.5"
          />
          <circle cx="0" cy="-22" r="5.5" fill="#2dd4bf" />
          <circle cx="0" cy="-22" r="8" fill="none" stroke="#a9c4e6" strokeOpacity="0.6" />
          <path
            d="M-9 4 L-16 20 L-2 12 M9 4 L16 20 L2 12"
            fill="#f2563b"
            fillOpacity="0.9"
          />
        </g>
        <path
          d="M1186 474 C 1232 420 1294 382 1342 350"
          fill="none"
          stroke="#f2563b"
          strokeOpacity="0.45"
          strokeWidth="2.4"
          strokeDasharray="2 10"
          strokeLinecap="round"
        />

        <g filter="url(#hero-edge)">
          <path
            d="M0 628 C 180 606 360 618 540 612 C 760 604 900 616 1080 604 C 1250 592 1420 610 1600 600 L1600 900 L0 900 Z"
            fill="#0d2341"
          />
        </g>

        <g transform="translate(1157 600) scale(1.24) translate(-1157 -600)">
          <path
            d="M1086 600 L1156 500 L1228 600 Z"
            fill="#071528"
            stroke="#cfe0f5"
            strokeOpacity="0.45"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <rect
            x="1094"
            y="596"
            width="126"
            height="6"
            rx="2"
            fill="#cfe0f5"
            fillOpacity="0.28"
          />
          <rect x="1098" y="548" width="118" height="50" fill="#071528" />
          <path
            d="M1098 598 V548 H1216 V598"
            fill="none"
            stroke="#cfe0f5"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
          <rect x="1150" y="508" width="20" height="42" fill="#071528" />
          <path d="M1146 508 L1160 492 L1174 508 Z" fill="#071528" />
          <circle cx="1160" cy="520" r="5.5" fill="#f2b66d" fillOpacity="0.85" />
          <path d="M1160 492 V472" stroke="#cfe0f5" strokeOpacity="0.5" strokeWidth="2" />
          <path d="M1160 472 L1180 478 L1160 486 Z" fill="#f2563b" fillOpacity="0.85" />
          <g fill="#f2b66d" fillOpacity="0.55">
            <rect x="1110" y="558" width="12" height="12" rx="2" />
            <rect x="1132" y="558" width="12" height="12" rx="2" />
            <rect x="1172" y="558" width="12" height="12" rx="2" />
            <rect x="1190" y="558" width="12" height="12" rx="2" />
            <rect x="1154" y="576" width="14" height="22" rx="2" />
          </g>
        </g>

        <g filter="url(#hero-edge)">
          <path
            d="M0 726 C 240 700 480 722 720 714 C 960 706 1200 724 1600 700 L1600 900 L0 900 Z"
            fill="#0a1b34"
          />
        </g>

        <path
          d="M646 900 C 760 842 900 796 1006 736 C 1064 704 1112 660 1132 628"
          fill="none"
          stroke="url(#hero-path)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M646 900 C 760 842 900 796 1006 736 C 1064 704 1112 660 1132 628"
          fill="none"
          stroke="#f2b66d"
          strokeOpacity="0.22"
          strokeWidth="2"
          strokeDasharray="14 16"
          strokeLinecap="round"
        />

        <g transform="translate(955 716) scale(1.16) translate(-955 -716)">
          <g transform="translate(890 714) scale(0.94)">
            <ellipse cx="0" cy="4" rx="32" ry="7" fill="#030b18" opacity="0.45" />
            <rect x="-19" y="-112" width="38" height="54" rx="12" fill="#0e2a4e" />
            <path d="M-16 -98 C -21 -74 -21 -38 -18 -4 L-4 -4 C -6 -38 -6 -74 0 -98 Z" fill="#050f1f" />
            <path d="M16 -98 C 21 -74 21 -38 18 -4 L4 -4 C 6 -38 6 -74 0 -98 Z" fill="#050f1f" />
            <path
              d="M-17 -118 C -23 -104 -22 -88 -18 -72 L18 -72 C 22 -88 23 -104 17 -118 C 9 -124 -9 -124 -17 -118 Z"
              fill="#050f1f"
            />
            <circle cx="0" cy="-136" r="16" fill="#050f1f" />
            <path d="M-16 -136 a16 16 0 0 1 32 0 l0 5 a16 16 0 0 0 -32 0 Z" fill="#081c37" />
            <path
              d="M-16 -116 C -22 -106 -23 -96 -22 -88"
              fill="none"
              stroke="#0b2342"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path d="M-30 -104 L-8 -100 L-8 -84 L-30 -88 Z" fill="#f6ecdc" fillOpacity="0.85" />
            <path
              d="M16 -116 C 22 -106 23 -98 22 -90"
              fill="none"
              stroke="#0b2342"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M14 -142 a16 16 0 0 1 4 11"
              fill="none"
              stroke="#f2b66d"
              strokeOpacity="0.45"
              strokeWidth="2"
            />
          </g>

          <g transform="translate(950 714) scale(1.06)">
            <ellipse cx="0" cy="4" rx="34" ry="7" fill="#030b18" opacity="0.45" />
            <rect x="-21" y="-116" width="42" height="58" rx="13" fill="#0e2a4e" />
            <path d="M-17 -100 C -23 -74 -23 -38 -19 -4 L-4 -4 C -6 -38 -6 -74 0 -100 Z" fill="#050f1f" />
            <path d="M17 -100 C 23 -74 23 -38 19 -4 L4 -4 C 6 -38 6 -74 0 -100 Z" fill="#050f1f" />
            <path
              d="M-18 -122 C -25 -106 -23 -88 -19 -72 L19 -72 C 23 -88 25 -106 18 -122 C 9 -128 -9 -128 -18 -122 Z"
              fill="#050f1f"
            />
            <circle cx="0" cy="-140" r="17" fill="#050f1f" />
            <path d="M-17 -140 a17 17 0 0 1 34 0 l0 5 a17 17 0 0 0 -34 0 Z" fill="#081c37" />
            <path
              d="M-17 -120 C -24 -110 -25 -99 -24 -90"
              fill="none"
              stroke="#0b2342"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M17 -120 C 30 -128 40 -140 45 -153"
              fill="none"
              stroke="#0b2342"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <circle cx="47" cy="-156" r="5" fill="#050f1f" />
            <path
              d="M15 -147 a17 17 0 0 1 4 12"
              fill="none"
              stroke="#f2b66d"
              strokeOpacity="0.5"
              strokeWidth="2"
            />
          </g>

          <g transform="translate(1014 714) scale(1)">
            <ellipse cx="0" cy="4" rx="32" ry="6" fill="#030b18" opacity="0.45" />
            <rect x="-19" y="-110" width="38" height="54" rx="12" fill="#0e2a4e" />
            <path d="M-16 -96 C -21 -72 -21 -38 -18 -4 L-4 -4 C -6 -38 -6 -72 0 -96 Z" fill="#050f1f" />
            <path d="M16 -96 C 21 -72 21 -38 18 -4 L4 -4 C 6 -38 6 -72 0 -96 Z" fill="#050f1f" />
            <path
              d="M-17 -116 C -23 -102 -22 -86 -18 -70 L18 -70 C 22 -86 23 -102 17 -116 C 9 -122 -9 -122 -17 -116 Z"
              fill="#050f1f"
            />
            <circle cx="0" cy="-134" r="16" fill="#050f1f" />
            <path d="M-16 -134 a16 16 0 0 1 32 0 l0 5 a16 16 0 0 0 -32 0 Z" fill="#081c37" />
            <path
              d="M-16 -114 C -22 -104 -23 -94 -22 -86"
              fill="none"
              stroke="#0b2342"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M16 -114 C 22 -104 23 -96 22 -88"
              fill="none"
              stroke="#0b2342"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path d="M22 -102 L36 -96 L32 -82 L18 -88 Z" fill="#2dd4bf" fillOpacity="0.75" />
            <path
              d="M14 -140 a16 16 0 0 1 4 11"
              fill="none"
              stroke="#f2b66d"
              strokeOpacity="0.45"
              strokeWidth="2"
            />
          </g>

          <g transform="translate(1098 710)">
            <ellipse cx="0" cy="4" rx="24" ry="6" fill="#030b18" opacity="0.4" />
            <path
              d="M-14 0 L0 -50 L14 0 M0 -50 L-20 -76"
              fill="none"
              stroke="#8fb6e2"
              strokeOpacity="0.7"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <g transform="rotate(-34 -8 -74)">
              <rect x="-36" y="-82" width="54" height="13" rx="6" fill="#d9e6f7" fillOpacity="0.9" />
              <rect x="12" y="-85" width="13" height="19" rx="3" fill="#f2b66d" fillOpacity="0.9" />
              <rect x="-30" y="-86" width="9" height="21" rx="3" fill="#071528" />
            </g>
          </g>
        </g>

        <g filter="url(#hero-edge)">
          <path
            d="M360 900 C 560 818 820 792 1090 808 C 1290 820 1460 796 1600 806 L1600 900 Z"
            fill="#061226"
          />
        </g>

        <g transform="translate(1004 872) rotate(-3)">
          <rect x="-46" y="-10" width="92" height="14" rx="4" fill="#2f547c" />
          <rect x="-38" y="-25" width="76" height="14" rx="4" fill="#c9785a" />
          <rect x="-30" y="-40" width="60" height="14" rx="4" fill="#d8c3a2" />
          <path d="M-20 -36 h44 M-26 -21 h60 M-34 -6 h76" stroke="#071528" strokeOpacity="0.35" strokeWidth="1.5" />
        </g>

        <g transform="translate(1124 846)">
          <path
            d="M-42 0 L0 -19 L42 0 L0 19 Z"
            fill="#0b2140"
            stroke="#9dbfe8"
            strokeOpacity="0.5"
            strokeWidth="1.5"
          />
          <path d="M0 -19 L0 -36" stroke="#f2b66d" strokeWidth="2" />
          <circle cx="1" cy="-38" r="4" fill="#f2b66d" />
          <path
            d="M-26 9 L-26 22 C -13 31 13 31 26 22 L26 9"
            fill="#081a33"
            stroke="#9dbfe8"
            strokeOpacity="0.4"
            strokeWidth="1.5"
          />
        </g>

        <g
          transform="translate(1300 890) rotate(-66)"
          stroke="#04101f"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        >
          <rect x="-9" y="-148" width="18" height="148" rx="3" fill="#f2b66d" />
          <path d="M-9 -148 L0 -174 L9 -148 Z" fill="#f6ecdc" />
          <path d="M-4 -166 L0 -178 L4 -166 Z" fill="#071528" />
          <rect x="-9" y="-14" width="18" height="12" rx="3" fill="#c9785a" />
        </g>
        <g
          transform="translate(1372 896) rotate(-74)"
          stroke="#04101f"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        >
          <rect x="-9" y="-152" width="18" height="152" rx="3" fill="#f2563b" />
          <path d="M-9 -152 L0 -178 L9 -152 Z" fill="#f6ecdc" />
          <path d="M-4 -170 L0 -182 L4 -170 Z" fill="#071528" />
          <rect x="-9" y="-14" width="18" height="12" rx="3" fill="#c9785a" />
        </g>
        <g
          transform="translate(1444 898) rotate(-58)"
          stroke="#04101f"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        >
          <rect x="-9" y="-150" width="18" height="150" rx="3" fill="#2dd4bf" />
          <path d="M-9 -150 L0 -176 L9 -150 Z" fill="#f6ecdc" />
          <path d="M-4 -168 L0 -180 L4 -168 Z" fill="#071528" />
          <rect x="-9" y="-14" width="18" height="12" rx="3" fill="#c9785a" />
        </g>

        <g stroke="#7fb2e8" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M700 868 c8 -12 8 -18 2 -28" />
          <path d="M716 876 c10 -10 12 -18 10 -28" />
          <path d="M932 874 c8 -10 6 -18 0 -26" />
          <path d="M1202 878 c10 -12 10 -20 4 -30" />
        </g>

        <g fill="#f7c982">
          <circle cx="742" cy="838" r="2.6" opacity="0.7" />
          <circle cx="770" cy="812" r="1.8" opacity="0.45" />
          <circle cx="1206" cy="854" r="2.2" opacity="0.5" />
          <circle cx="1052" cy="820" r="1.6" opacity="0.4" />
          <circle cx="872" cy="860" r="2" opacity="0.35" />
        </g>

        <rect width="1600" height="900" fill="url(#hero-vignette)" />
        <rect
          width="1600"
          height="900"
          filter="url(#hero-grain)"
          style={{ mixBlendMode: "soft-light", opacity: 0.4 }}
        />
      </svg>
    </div>
  );
}

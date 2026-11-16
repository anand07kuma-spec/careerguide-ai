/**
 * Section illustrations for the homepage.
 *
 * The hero is a painted night study; these are companion vignettes drawn in the
 * same hand — layered washes, deep silhouettes, one warm light — so the page
 * reads as one illustrated story rather than a sequence of stock photos.
 *
 * `DeskScene`, `RoutesScene` and `TableScene` are quiet still-life studies lit
 * through a window, coloured by the `.cg-vignette` variables so they repaint
 * with the theme. `ConversationScene` and `DawnScene` are painted in fixed dusk
 * tones because they sit as dark panels on the page in both themes.
 */

type SceneProps = { className?: string };

const frameClass =
  "cg-vignette relative overflow-hidden rounded-card border border-line bg-surface shadow-lift";

/** A student's desk in the morning: sketchbook, pencils, headphones, a mug. */
export function DeskScene({ className = "" }: SceneProps) {
  const label = "An illustration of a sketchbook, pencils and headphones on a sunlit desk";
  return (
    <div className={`${frameClass} aspect-[4/3] lg:aspect-[5/4] ${className}`}>
      <svg
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="vA-sky" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor="var(--vg-sky-top)" />
            <stop offset="0.65" stopColor="var(--vg-sky-mid)" />
            <stop offset="1" stopColor="var(--vg-sky-bottom)" />
          </linearGradient>
          <linearGradient id="vA-desk" x1="0" y1="0" x2="0.15" y2="1">
            <stop offset="0" stopColor="var(--vg-desk-top)" />
            <stop offset="1" stopColor="var(--vg-desk-bottom)" />
          </linearGradient>
          <linearGradient id="vA-beam" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--vg-sun)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--vg-sun)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="vA-sun" cx="0.2" cy="0.2" r="0.6">
            <stop offset="0" stopColor="var(--vg-sun)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--vg-sun)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vA-vignette" cx="0.55" cy="0.5" r="0.75">
            <stop offset="0.5" stopColor="var(--vg-ink)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--vg-ink)" stopOpacity="0.22" />
          </radialGradient>
          <filter id="vA-wash" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.013" numOctaves="2" seed="21" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="70" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="vA-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="vA-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" seed="3" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0" />
          </filter>
        </defs>

        <rect width="800" height="600" fill="url(#vA-sky)" />
        <g filter="url(#vA-wash)">
          <ellipse cx="140" cy="160" rx="320" ry="240" fill="var(--vg-bloom-a)" opacity="0.45" />
          <ellipse cx="700" cy="110" rx="280" ry="200" fill="var(--vg-bloom-b)" opacity="0.4" />
          <ellipse cx="520" cy="520" rx="380" ry="160" fill="var(--vg-bloom-c)" opacity="0.25" />
        </g>
        <rect width="800" height="600" fill="url(#vA-sun)" />

        {/* window and curtain */}
        <g>
          <rect x="32" y="32" width="300" height="304" rx="6" fill="var(--vg-paper)" />
          <rect x="46" y="46" width="272" height="276" rx="3" fill="var(--vg-sky-bottom)" />
          <circle cx="274" cy="112" r="30" fill="var(--vg-sun)" opacity="0.6" />
          <path d="M96 322 C102 260 130 230 168 218 C208 230 236 262 242 322 Z" fill="var(--vg-teal)" opacity="0.4" />
          <path d="M168 322 V258" stroke="var(--vg-teal)" strokeWidth="4" opacity="0.55" />
          <path d="M96 322 C104 288 116 268 132 254" stroke="var(--vg-teal)" strokeWidth="3" opacity="0.4" fill="none" />
          <rect x="180" y="46" width="5" height="276" fill="var(--vg-paper)" />
          <rect x="46" y="178" width="272" height="5" fill="var(--vg-paper)" />
          <rect x="20" y="330" width="324" height="14" rx="4" fill="var(--vg-paper)" />
          <rect x="18" y="344" width="326" height="8" fill="var(--vg-ink)" opacity="0.12" />
          <path d="M332 34 C360 130 344 250 366 342 L322 342 C314 246 324 128 310 40 Z" fill="var(--vg-object)" opacity="0.75" />
        </g>

        {/* pinned notes */}
        <g transform="translate(588 58) rotate(-3 58 66)">
          <rect width="116" height="132" rx="4" fill="var(--vg-paper)" />
          <rect x="38" y="-5" width="42" height="11" rx="3" fill="var(--vg-line)" opacity="0.45" />
          <circle cx="34" cy="38" r="16" fill="none" stroke="var(--vg-terracotta)" strokeWidth="4" opacity="0.75" />
          <path d="M20 78 H92 M20 92 H74" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          <path d="M20 110 C32 100 44 104 54 110" stroke="var(--vg-line)" strokeWidth="3" fill="none" opacity="0.5" />
        </g>
        <g transform="translate(716 92) rotate(3 43 56)">
          <rect width="86" height="112" rx="4" fill="var(--vg-object)" />
          <rect x="27" y="-5" width="34" height="10" rx="3" fill="var(--vg-line)" opacity="0.4" />
          <path d="M20 84 V48 M38 92 V38 M56 80 V56" stroke="var(--vg-teal)" strokeWidth="7" strokeLinecap="round" opacity="0.75" />
        </g>

        {/* desk */}
        <path d="M0 336 L800 300 L800 600 L0 600 Z" fill="url(#vA-desk)" />
        <path d="M0 336 L800 300" stroke="var(--vg-rim)" strokeWidth="3" opacity="0.3" />
        <path d="M0 344 L800 308" stroke="var(--vg-ink)" strokeWidth="4" opacity="0.08" />
        <path d="M28 356 L312 344 L690 470 L250 566 Z" fill="url(#vA-beam)" filter="url(#vA-soft)" opacity="0.75" />

        {/* sketchbook */}
        <g transform="rotate(-5 380 470)">
          <ellipse cx="380" cy="508" rx="148" ry="18" fill="var(--vg-ink)" opacity="0.16" filter="url(#vA-soft)" />
          <rect x="242" y="424" width="276" height="118" rx="5" fill="var(--vg-terracotta)" opacity="0.5" />
          <rect x="248" y="428" width="264" height="108" rx="4" fill="var(--vg-paper)" />
          <path d="M380 428 V536" stroke="var(--vg-line)" strokeWidth="3" />
          <path d="M300 506 C316 462 344 444 378 442 M380 442 C410 446 434 466 442 500" fill="none" stroke="var(--vg-ink)" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
          <path d="M310 520 H350 M396 512 H436 M400 524 H424" stroke="var(--vg-line)" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          <path d="M452 442 L500 470" stroke="var(--vg-terracotta)" strokeWidth="5" strokeLinecap="round" />
          <path d="M452 442 L446 448" stroke="var(--vg-ink)" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* pencil cup */}
        <g>
          <ellipse cx="702" cy="428" rx="46" ry="10" fill="var(--vg-ink)" opacity="0.14" filter="url(#vA-soft)" />
          <path d="M652 364 L696 360 L690 424 L658 426 Z" fill="var(--vg-terracotta)" opacity="0.85" />
          <ellipse cx="674" cy="362" rx="22" ry="6" fill="var(--vg-ink)" opacity="0.18" />
          <path d="M660 362 L654 314 M672 362 L676 304 M684 362 L700 322" stroke="var(--vg-ink)" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
          <path d="M654 314 L658 298 M676 304 L684 292 M700 322 L708 310" stroke="var(--vg-teal)" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* headphones */}
        <g>
          <ellipse cx="560" cy="512" rx="62" ry="10" fill="var(--vg-ink)" opacity="0.14" filter="url(#vA-soft)" />
          <path d="M506 500 C512 452 566 438 604 470" fill="none" stroke="var(--vg-teal)" strokeWidth="9" strokeLinecap="round" />
          <rect x="492" y="486" width="22" height="38" rx="10" fill="var(--vg-ink)" opacity="0.8" transform="rotate(-8 503 505)" />
          <rect x="596" y="478" width="22" height="38" rx="10" fill="var(--vg-ink)" opacity="0.8" transform="rotate(10 607 497)" />
          <path d="M592 486 C600 492 602 500 600 508" stroke="var(--vg-paper)" strokeWidth="2" opacity="0.5" fill="none" />
        </g>

        {/* mug and pencils */}
        <g>
          <ellipse cx="146" cy="512" rx="52" ry="11" fill="var(--vg-ink)" opacity="0.14" filter="url(#vA-soft)" />
          <rect x="104" y="436" width="84" height="72" rx="12" fill="var(--vg-paper)" />
          <rect x="104" y="464" width="84" height="16" fill="var(--vg-teal)" opacity="0.45" />
          <path d="M188 452 C208 452 210 488 188 490" fill="none" stroke="var(--vg-paper)" strokeWidth="9" />
          <path d="M124 428 C120 414 126 406 134 400 M148 428 C146 414 152 408 158 402" fill="none" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
        </g>
        <g transform="rotate(18 430 568)">
          <rect x="386" y="562" width="92" height="9" rx="4" fill="var(--vg-terracotta)" />
          <path d="M478 562 L492 566 L478 572 Z" fill="var(--vg-ink)" />
          <rect x="394" y="578" width="80" height="8" rx="4" fill="var(--vg-teal)" opacity="0.85" />
          <path d="M474 578 L486 582 L474 586 Z" fill="var(--vg-ink)" />
        </g>

        {/* small book stack and plant */}
        <g>
          <rect x="34" y="530" width="96" height="16" rx="3" fill="var(--vg-paper)" />
          <rect x="42" y="546" width="82" height="14" rx="3" fill="var(--vg-teal)" opacity="0.6" />
          <rect x="48" y="560" width="70" height="12" rx="3" fill="var(--vg-terracotta)" opacity="0.55" />
        </g>
        <g>
          <path d="M736 338 L782 338 L776 392 L742 392 Z" fill="var(--vg-terracotta)" opacity="0.8" />
          <path d="M760 338 C754 306 734 292 716 296 C724 318 740 332 760 338 Z" fill="var(--vg-teal)" opacity="0.65" />
          <path d="M762 338 C770 300 792 288 806 296 C796 318 780 332 762 338 Z" fill="var(--vg-teal)" opacity="0.5" />
          <path d="M760 338 C760 318 764 306 770 292" fill="none" stroke="var(--vg-teal)" strokeWidth="4" opacity="0.8" />
        </g>

        <rect width="800" height="600" fill="url(#vA-vignette)" />
        <rect width="800" height="600" filter="url(#vA-grain)" style={{ opacity: "var(--vg-grain)" }} />
      </svg>
    </div>
  );
}

/** A studio wall of pinned career routes, lit from the window. */
export function RoutesScene({ className = "" }: SceneProps) {
  const label = "An illustration of career routes pinned across a studio wall";
  return (
    <div className={`${frameClass} aspect-[16/9] sm:aspect-[2.6/1] ${className}`}>
      <svg
        viewBox="0 0 1600 640"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="vB-sky" x1="0" y1="0" x2="0.25" y2="1">
            <stop offset="0" stopColor="var(--vg-sky-top)" />
            <stop offset="0.65" stopColor="var(--vg-sky-mid)" />
            <stop offset="1" stopColor="var(--vg-sky-bottom)" />
          </linearGradient>
          <linearGradient id="vB-board" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--vg-object)" />
            <stop offset="1" stopColor="var(--vg-object-2)" />
          </linearGradient>
          <linearGradient id="vB-shelf" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--vg-desk-top)" />
            <stop offset="1" stopColor="var(--vg-desk-bottom)" />
          </linearGradient>
          <radialGradient id="vB-sun" cx="0.12" cy="0.28" r="0.7">
            <stop offset="0" stopColor="var(--vg-sun)" stopOpacity="0.5" />
            <stop offset="1" stopColor="var(--vg-sun)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vB-vignette" cx="0.55" cy="0.5" r="0.8">
            <stop offset="0.55" stopColor="var(--vg-ink)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--vg-ink)" stopOpacity="0.2" />
          </radialGradient>
          <filter id="vB-wash" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="31" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="80" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="vB-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id="vB-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" stitchTiles="stitch" seed="5" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
          </filter>
        </defs>

        <rect width="1600" height="640" fill="url(#vB-sky)" />
        <g filter="url(#vB-wash)">
          <ellipse cx="180" cy="160" rx="360" ry="230" fill="var(--vg-bloom-a)" opacity="0.5" />
          <ellipse cx="900" cy="90" rx="480" ry="200" fill="var(--vg-bloom-b)" opacity="0.35" />
          <ellipse cx="1460" cy="260" rx="300" ry="260" fill="var(--vg-bloom-c)" opacity="0.38" />
        </g>
        <rect width="1600" height="640" fill="url(#vB-sun)" />

        {/* pinboard */}
        <g>
          <rect x="60" y="22" width="1480" height="526" rx="18" fill="var(--vg-paper)" />
          <rect x="74" y="36" width="1452" height="498" rx="12" fill="url(#vB-board)" />
          <rect x="74" y="36" width="1452" height="498" rx="12" fill="none" stroke="var(--vg-line)" strokeWidth="3" />
          <path
            d="M348 221 C420 189 500 253 573 221 C645 189 726 253 798 221 C870 189 951 253 1023 221 C1095 189 1176 253 1248 221"
            fill="none"
            stroke="var(--vg-terracotta)"
            strokeWidth="5"
            strokeDasharray="4 14"
            strokeLinecap="round"
            opacity="0.55"
          />

          <g transform="translate(263 116) rotate(-2 85 105)">
            <rect width="170" height="210" rx="8" fill="var(--vg-paper)" stroke="var(--vg-line)" strokeWidth="2" />
            <rect x="62" y="-5" width="46" height="12" rx="4" fill="var(--vg-line)" opacity="0.45" />
            <path d="M34 156 C42 106 86 92 122 100 C146 106 158 126 162 156" fill="none" stroke="var(--vg-ink)" strokeWidth="6" strokeLinecap="round" opacity="0.75" />
            <path d="M26 156 H166" stroke="var(--vg-ink)" strokeWidth="6" strokeLinecap="round" opacity="0.75" />
            <path d="M46 156 V128 M82 156 V118 M120 156 V128 M148 156 V138" stroke="var(--vg-terracotta)" strokeWidth="4" opacity="0.7" />
            <path d="M34 172 H120 M34 184 H98" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          </g>

          <g transform="translate(488 116) rotate(1.5 85 105)">
            <rect width="170" height="210" rx="8" fill="var(--vg-object-2)" />
            <rect x="62" y="-5" width="46" height="12" rx="4" fill="var(--vg-line)" opacity="0.4" />
            <circle cx="85" cy="104" r="42" fill="none" stroke="var(--vg-line)" strokeWidth="8" />
            <circle cx="85" cy="104" r="13" fill="var(--vg-paper)" stroke="var(--vg-line)" strokeWidth="4" />
            <path d="M85 48 V62 M85 146 V160 M29 104 H43 M127 104 H141" stroke="var(--vg-line)" strokeWidth="10" strokeLinecap="round" />
            <path d="M42 180 H128 M42 192 H104" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          </g>

          <g transform="translate(713 116) rotate(-1 85 105)">
            <rect width="170" height="210" rx="8" fill="var(--vg-paper)" stroke="var(--vg-line)" strokeWidth="2" />
            <rect x="62" y="-5" width="46" height="12" rx="4" fill="var(--vg-line)" opacity="0.45" />
            <path d="M40 172 C46 112 78 80 122 72" fill="none" stroke="var(--vg-teal)" strokeWidth="5" strokeLinecap="round" />
            <path d="M84 122 C68 108 58 90 64 72 C84 74 98 88 100 108 Z" fill="var(--vg-teal)" opacity="0.6" />
            <path d="M106 96 C100 74 110 54 128 46 C136 64 130 86 114 100 Z" fill="var(--vg-teal)" opacity="0.45" />
            <path d="M124 78 C134 60 152 52 166 58 C162 78 146 90 128 90 Z" fill="var(--vg-teal)" opacity="0.35" />
            <path d="M40 188 H134" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          </g>

          <g transform="translate(938 116) rotate(2 85 105)">
            <rect width="170" height="210" rx="8" fill="var(--vg-object-2)" />
            <rect x="62" y="-5" width="46" height="12" rx="4" fill="var(--vg-line)" opacity="0.4" />
            <path d="M42 164 V88 H82 V164 Z" fill="none" stroke="var(--vg-ink)" strokeWidth="6" opacity="0.8" />
            <path d="M94 164 V64 H140 V164 Z" fill="none" stroke="var(--vg-ink)" strokeWidth="6" opacity="0.8" />
            <path d="M50 104 H74 M50 124 H74 M50 144 H74 M102 82 H132 M102 102 H132 M102 122 H132 M102 142 H132" stroke="var(--vg-line)" strokeWidth="4" opacity="0.6" />
            <path d="M42 184 H140" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          </g>

          <g transform="translate(1163 116) rotate(-1.5 85 105)">
            <rect width="170" height="210" rx="8" fill="var(--vg-paper)" stroke="var(--vg-line)" strokeWidth="2" />
            <rect x="62" y="-5" width="46" height="12" rx="4" fill="var(--vg-line)" opacity="0.45" />
            <ellipse cx="86" cy="118" rx="42" ry="34" fill="none" stroke="var(--vg-ink)" strokeWidth="6" opacity="0.8" />
            <circle cx="70" cy="106" r="6" fill="var(--vg-terracotta)" opacity="0.8" />
            <circle cx="90" cy="98" r="6" fill="var(--vg-teal)" opacity="0.8" />
            <circle cx="106" cy="118" r="6" fill="var(--vg-line)" />
            <path d="M118 142 L148 186" stroke="var(--vg-terracotta)" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
            <path d="M40 186 H132" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          </g>
        </g>

        {/* loose notes under the route */}
        <g transform="translate(300 366) rotate(-2 85 48)">
          <rect width="170" height="96" rx="6" fill="var(--vg-paper)" stroke="var(--vg-line)" strokeWidth="2" />
          <rect x="60" y="-5" width="50" height="12" rx="4" fill="var(--vg-line)" opacity="0.4" />
          <path d="M20 30 H92 M20 42 H74" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          <path d="M20 60 H56 M20 72 H44" stroke="var(--vg-terracotta)" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          <circle cx="132" cy="40" r="10" fill="var(--vg-teal)" opacity="0.5" />
          <path d="M128 40 L131 43 L137 36" stroke="var(--vg-ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
        </g>

        <g transform="translate(756 382) rotate(1.2 95 42)">
          <rect width="190" height="84" rx="6" fill="var(--vg-object-2)" />
          <path d="M24 26 L44 38 L24 50" fill="none" stroke="var(--vg-teal)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
          <path d="M64 26 L84 38 L64 50" fill="none" stroke="var(--vg-teal)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
          <path d="M104 26 L124 38 L104 50" fill="none" stroke="var(--vg-teal)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
          <path d="M22 64 H150" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
        </g>

        <g transform="translate(1080 368) rotate(-1.4 80 50)">
          <rect width="160" height="100" rx="6" fill="var(--vg-paper)" stroke="var(--vg-line)" strokeWidth="2" />
          <rect x="54" y="-5" width="50" height="12" rx="4" fill="var(--vg-line)" opacity="0.4" />
          <path d="M22 32 H138 M22 52 H138 M22 72 H138" stroke="var(--vg-line)" strokeWidth="3" opacity="0.4" />
          <path d="M70 20 V84" stroke="var(--vg-line)" strokeWidth="3" opacity="0.4" />
          <circle cx="112" cy="42" r="5" fill="var(--vg-terracotta)" opacity="0.75" />
          <circle cx="112" cy="62" r="5" fill="var(--vg-teal)" opacity="0.7" />
          <path d="M120 32 L132 40" stroke="var(--vg-terracotta)" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
        </g>

        {/* desk */}
        <g>
          <path d="M0 560 L1600 546 L1600 640 L0 640 Z" fill="url(#vB-shelf)" />
          <path d="M0 560 L1600 546" stroke="var(--vg-paper)" strokeWidth="3" opacity="0.4" />
          <path d="M0 570 L1600 556" stroke="var(--vg-ink)" strokeWidth="4" opacity="0.08" />

          <g>
            <path d="M104 562 L148 560 L142 614 L110 614 Z" fill="var(--vg-terracotta)" opacity="0.75" />
            <path d="M126 562 C120 530 100 516 84 520 C92 542 108 554 126 562 Z" fill="var(--vg-teal)" opacity="0.6" />
            <path d="M128 562 C134 528 156 514 170 520 C162 544 146 556 128 562 Z" fill="var(--vg-teal)" opacity="0.45" />
            <ellipse cx="126" cy="618" rx="48" ry="6" fill="var(--vg-ink)" opacity="0.12" filter="url(#vB-soft)" />
          </g>

          <g>
            <path d="M764 570 H810 L804 614 H770 Z" fill="var(--vg-paper)" />
            <path d="M764 570 H810" stroke="var(--vg-terracotta)" strokeWidth="6" />
            <path d="M810 580 C826 576 828 602 810 604" fill="none" stroke="var(--vg-paper)" strokeWidth="7" />
            <path d="M780 560 C776 550 782 544 788 538 M796 560 C794 550 800 544 804 539" fill="none" stroke="var(--vg-line)" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
          </g>

          <path d="M966 606 L1082 592" stroke="var(--vg-terracotta)" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
          <path d="M1082 592 L1096 590" stroke="var(--vg-ink)" strokeWidth="7" strokeLinecap="round" opacity="0.8" />

          <g transform="rotate(-3 1440 588)">
            <rect x="1380" y="562" width="124" height="16" rx="3" fill="var(--vg-paper)" />
            <rect x="1390" y="578" width="106" height="14" rx="3" fill="var(--vg-teal)" opacity="0.6" />
            <rect x="1400" y="592" width="88" height="12" rx="3" fill="var(--vg-terracotta)" opacity="0.55" />
          </g>
        </g>

        <rect width="1600" height="640" fill="url(#vB-vignette)" />
        <rect width="1600" height="640" filter="url(#vB-grain)" style={{ opacity: "var(--vg-grain)" }} />
      </svg>
    </div>
  );
}

/** A student at the desk after dark, with the guide's replies on screen. */
export function ConversationScene({ className = "" }: SceneProps) {
  const label = "An illustration of a student at a desk after dark, talking with the guide on a tablet";
  return (
    <div
      className={`relative aspect-[4/5] overflow-hidden rounded-card border border-line bg-[#081326] shadow-lift ${className}`}
    >
      <svg
        viewBox="0 0 800 1000"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="vC-sky" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0" stopColor="#0a1627" />
            <stop offset="0.55" stopColor="#0e2038" />
            <stop offset="1" stopColor="#14304f" />
          </linearGradient>
          <linearGradient id="vC-view" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#17365c" />
            <stop offset="0.62" stopColor="#2a4a6c" />
            <stop offset="1" stopColor="#b9774f" />
          </linearGradient>
          <linearGradient id="vC-desk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#17304f" />
            <stop offset="1" stopColor="#081426" />
          </linearGradient>
          <linearGradient id="vC-screen" x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor="#e9f3ff" />
            <stop offset="1" stopColor="#b9d4ef" />
          </linearGradient>
          <radialGradient id="vC-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#9fc4ff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#9fc4ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vC-vignette" cx="0.5" cy="0.46" r="0.75">
            <stop offset="0.5" stopColor="#02060d" stopOpacity="0" />
            <stop offset="1" stopColor="#02060d" stopOpacity="0.55" />
          </radialGradient>
          <filter id="vC-wash" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.012" numOctaves="2" seed="41" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="80" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="vC-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="18" />
          </filter>
          <filter id="vC-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.84" numOctaves="3" stitchTiles="stitch" seed="7" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0" />
          </filter>
        </defs>

        <rect width="800" height="1000" fill="url(#vC-sky)" />
        <g filter="url(#vC-wash)" opacity="0.7">
          <ellipse cx="160" cy="200" rx="280" ry="240" fill="#15345c" opacity="0.6" />
          <ellipse cx="680" cy="560" rx="300" ry="340" fill="#1d2d55" opacity="0.55" />
          <ellipse cx="300" cy="900" rx="340" ry="200" fill="#0b1d34" opacity="0.6" />
        </g>

        {/* window */}
        <g>
          <rect x="418" y="64" width="350" height="392" rx="8" fill="#0a1a30" />
          <rect x="432" y="78" width="322" height="364" rx="3" fill="url(#vC-view)" />
          <circle cx="690" cy="156" r="24" fill="#f3dfb4" opacity="0.75" />
          <g fill="#0a1729" opacity="0.85">
            <rect x="440" y="330" width="46" height="112" />
            <rect x="494" y="356" width="34" height="86" />
            <rect x="536" y="316" width="40" height="126" />
            <rect x="640" y="340" width="44" height="102" />
            <rect x="692" y="312" width="52" height="130" />
            <rect x="596" y="368" width="36" height="74" />
          </g>
          <g fill="#f2b66d" opacity="0.4">
            <rect x="454" y="348" width="7" height="7" />
            <rect x="550" y="334" width="7" height="7" />
            <rect x="706" y="330" width="7" height="7" />
          </g>
          <rect x="588" y="78" width="6" height="364" fill="#0a1a30" />
          <rect x="432" y="256" width="322" height="6" fill="#0a1a30" />
          <rect x="400" y="456" width="386" height="14" rx="4" fill="#0e2138" />
          <path d="M414 76 C438 170 428 320 448 462 L404 462 C390 330 398 180 386 84 Z" fill="#142b47" opacity="0.85" />
        </g>

        {/* shelf */}
        <g>
          <rect x="66" y="300" width="228" height="9" rx="4" fill="#10243d" />
          <rect x="84" y="238" width="17" height="62" fill="#8e4b34" opacity="0.8" />
          <rect x="106" y="250" width="13" height="50" fill="#2f6875" opacity="0.8" />
          <rect x="124" y="230" width="19" height="70" fill="#24446c" />
          <path d="M204 300 C208 268 188 252 172 254 C176 276 188 292 204 300 Z" fill="#2f6875" opacity="0.6" />
          <path d="M208 300 C214 264 236 254 252 262 C244 284 228 296 208 300 Z" fill="#2f6875" opacity="0.45" />
          <path d="M182 300 L216 300 L210 330 L188 330 Z" fill="#8e4b34" opacity="0.6" />
        </g>

        {/* desk */}
        <path d="M0 792 C180 776 420 768 640 774 C710 776 770 780 800 784 L800 1000 L0 1000 Z" fill="url(#vC-desk)" />
        <path d="M0 792 C180 776 420 768 640 774 C710 776 770 780 800 784" fill="none" stroke="#d9e6f5" strokeWidth="2.5" opacity="0.18" />
        <path d="M0 806 C180 790 420 782 640 788 C710 790 770 794 800 798" fill="none" stroke="#02060d" strokeWidth="10" opacity="0.3" />

        {/* student, seen from behind */}
        <g>
          <path d="M104 1000 C114 872 182 780 300 766 C418 780 486 872 496 1000 Z" fill="#040b16" />
          <path d="M272 720 H330 L342 776 H260 Z" fill="#040b16" />
          <circle cx="300" cy="682" r="62" fill="#040b16" />
          <path d="M246 638 C264 606 322 606 344 640 C352 654 350 668 342 674 C336 646 316 632 292 634 C274 636 260 648 256 664 C248 656 244 646 246 638 Z" fill="#040b16" />
          <circle cx="352" cy="640" r="21" fill="#040b16" />
          <path d="M240 682 C232 690 233 700 244 704" stroke="#040b16" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M240 646 C232 596 262 560 300 558 C332 558 356 578 364 606" fill="none" stroke="#2f6875" strokeWidth="10" strokeLinecap="round" />
          <rect x="350" y="664" width="26" height="46" rx="12" fill="#2f6875" transform="rotate(6 363 687)" />
          <path d="M352 640 C392 654 420 688 436 730" fill="none" stroke="#9fc4ff" strokeWidth="3" strokeLinecap="round" opacity="0.22" />
          <path d="M300 800 C356 786 414 800 448 834" fill="none" stroke="#d9e6f5" strokeWidth="2.5" opacity="0.1" strokeLinecap="round" />
        </g>

        {/* tablet */}
        <ellipse cx="640" cy="836" rx="220" ry="160" fill="url(#vC-glow)" filter="url(#vC-soft)" />
        <g>
          <rect x="552" y="726" width="176" height="236" rx="14" fill="#0c1e36" />
          <rect x="564" y="738" width="152" height="212" rx="7" fill="url(#vC-screen)" />
          <rect x="580" y="758" width="92" height="10" rx="5" fill="#2563eb" opacity="0.4" />
          <rect x="580" y="782" width="118" height="10" rx="5" fill="#0e2038" opacity="0.28" />
          <rect x="580" y="806" width="106" height="10" rx="5" fill="#0e2038" opacity="0.2" />
          <rect x="604" y="838" width="94" height="10" rx="5" fill="#2563eb" opacity="0.35" />
          <rect x="580" y="872" width="120" height="30" rx="15" fill="#2563eb" opacity="0.28" />
          <rect x="580" y="916" width="76" height="10" rx="5" fill="#0e2038" opacity="0.22" />
        </g>

        {/* replies */}
        <g>
          <path d="M486 420 C486 398 504 382 530 382 H690 C716 382 734 398 734 420 V466 C734 488 716 504 690 504 H596 L562 536 L572 504 H530 C504 504 486 488 486 466 Z" fill="#f6ecdc" />
          <circle cx="556" cy="444" r="7" fill="#2b3d5b" opacity="0.5" />
          <circle cx="588" cy="444" r="7" fill="#2b3d5b" opacity="0.35" />
          <circle cx="620" cy="444" r="7" fill="#2b3d5b" opacity="0.22" />
          <rect x="552" y="466" width="96" height="9" rx="4" fill="#2b3d5b" opacity="0.18" />
          <path d="M540 306 C540 290 554 278 574 278 H682 C702 278 716 290 716 306 V330 C716 346 702 358 682 358 H588 L566 376 L572 358 H574 C554 358 540 346 540 330 Z" fill="#2f6875" opacity="0.5" />
          <rect x="576" y="306" width="92" height="8" rx="4" fill="#e9f3ff" opacity="0.55" />
          <rect x="576" y="322" width="64" height="8" rx="4" fill="#e9f3ff" opacity="0.35" />
          <path d="M512 520 C520 574 540 620 566 662" fill="none" stroke="#9fc4ff" strokeWidth="2.5" strokeDasharray="3 11" strokeLinecap="round" opacity="0.35" />
        </g>

        {/* desk objects */}
        <g>
          <ellipse cx="486" cy="838" rx="48" ry="9" fill="#02060d" opacity="0.4" filter="url(#vC-soft)" />
          <rect x="450" y="782" width="66" height="58" rx="9" fill="#8e4b34" />
          <path d="M516 796 C536 792 536 826 516 822" fill="none" stroke="#8e4b34" strokeWidth="8" />
          <path d="M468 772 C464 756 470 746 478 740 M488 772 C486 756 490 748 496 742" fill="none" stroke="#c9dcf5" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
        </g>
        <g>
          <rect x="756" y="796" width="44" height="12" rx="3" fill="#24446c" />
          <rect x="748" y="780" width="52" height="12" rx="3" fill="#8e4b34" opacity="0.8" />
          <rect x="758" y="764" width="36" height="12" rx="3" fill="#2f6875" />
        </g>

        <rect width="800" height="1000" fill="url(#vC-vignette)" />
        <rect width="800" height="1000" filter="url(#vC-grain)" opacity="0.22" />
      </svg>
    </div>
  );
}

/** A parent and a teenager at the table, seen from behind, tea between them. */
export function TableScene({ className = "" }: SceneProps) {
  const label = "An illustration of a parent and a teenager sharing tea at the kitchen table";
  return (
    <div className={`${frameClass} aspect-[16/9] sm:aspect-[16/6] ${className}`}>
      <svg
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="vD-sky" x1="0" y1="0" x2="0.15" y2="1">
            <stop offset="0" stopColor="var(--vg-sky-top)" />
            <stop offset="0.55" stopColor="var(--vg-sky-mid)" />
            <stop offset="1" stopColor="var(--vg-sky-bottom)" />
          </linearGradient>
          <linearGradient id="vD-view" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--vg-sky-top)" />
            <stop offset="1" stopColor="var(--vg-bloom-b)" />
          </linearGradient>
          <linearGradient id="vD-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--vg-desk-top)" />
            <stop offset="1" stopColor="var(--vg-desk-bottom)" />
          </linearGradient>
          <radialGradient id="vD-glow" cx="0.5" cy="0.1" r="0.75">
            <stop offset="0" stopColor="var(--vg-sun)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--vg-sun)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="vD-vignette" cx="0.5" cy="0.5" r="0.78">
            <stop offset="0.52" stopColor="var(--vg-ink)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--vg-ink)" stopOpacity="0.24" />
          </radialGradient>
          <filter id="vD-wash" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="51" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="80" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id="vD-soft" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="vD-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.83" numOctaves="3" stitchTiles="stitch" seed="9" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
          </filter>
        </defs>

        <rect width="1600" height="600" fill="url(#vD-sky)" />
        <g filter="url(#vD-wash)">
          <ellipse cx="200" cy="150" rx="340" ry="210" fill="var(--vg-bloom-a)" opacity="0.5" />
          <ellipse cx="820" cy="90" rx="420" ry="180" fill="var(--vg-bloom-b)" opacity="0.4" />
          <ellipse cx="1430" cy="200" rx="300" ry="230" fill="var(--vg-bloom-c)" opacity="0.4" />
        </g>

        {/* window */}
        <g>
          <rect x="588" y="14" width="424" height="352" rx="8" fill="var(--vg-paper)" />
          <rect x="602" y="28" width="396" height="324" rx="3" fill="url(#vD-view)" />
          <circle cx="760" cy="96" r="34" fill="var(--vg-sun)" opacity="0.55" />
          <path d="M602 352 C640 286 690 306 730 270 C780 222 838 282 886 246 C926 216 960 236 998 206 L998 352 Z" fill="var(--vg-teal)" opacity="0.3" />
          <rect x="796" y="28" width="6" height="324" fill="var(--vg-paper)" />
          <rect x="602" y="190" width="396" height="6" fill="var(--vg-paper)" />
          <rect x="566" y="366" width="468" height="14" rx="4" fill="var(--vg-paper)" />
          <rect x="566" y="380" width="468" height="8" fill="var(--vg-ink)" opacity="0.1" />
          <path d="M572 26 C596 110 586 240 600 362 L558 362 C546 250 550 130 540 34 Z" fill="var(--vg-object)" opacity="0.55" />
          <path d="M1028 26 C1050 110 1040 240 1054 362 L1012 362 C1002 250 1006 130 996 34 Z" fill="var(--vg-object)" opacity="0.45" />
          <path d="M940 372 C936 340 916 326 900 330 C906 352 920 366 940 372 Z" fill="var(--vg-teal)" opacity="0.6" />
          <path d="M942 372 C950 336 972 326 986 332 C976 354 960 366 942 372 Z" fill="var(--vg-teal)" opacity="0.45" />
          <path d="M926 372 L964 372 L958 408 L932 408 Z" fill="var(--vg-terracotta)" opacity="0.7" />
        </g>

        <rect width="1600" height="600" fill="url(#vD-glow)" />

        {/* parent */}
        <g>
          <path d="M274 560 C278 462 320 408 408 398 C486 408 528 462 532 560 Z" fill="var(--vg-figure)" />
          <path d="M380 360 H436 L444 402 H372 Z" fill="var(--vg-figure)" />
          <circle cx="408" cy="332" r="56" fill="var(--vg-figure)" />
          <path d="M358 296 C380 264 434 268 448 302 C454 318 450 330 440 336 C436 308 418 292 396 292 C380 292 368 302 364 316 C354 308 352 302 358 296 Z" fill="var(--vg-figure)" />
          <circle cx="360" cy="286" r="20" fill="var(--vg-figure)" />
          <path d="M350 332 C342 340 343 350 354 354" stroke="var(--vg-figure)" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M462 410 C490 424 508 448 516 476" fill="none" stroke="var(--vg-sun)" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
          <path d="M368 320 C390 306 424 308 442 322" fill="none" stroke="var(--vg-rim)" strokeWidth="3.5" opacity="0.4" strokeLinecap="round" />
        </g>

        {/* teenager */}
        <g>
          <path d="M1068 560 C1072 474 1112 424 1192 414 C1262 424 1304 474 1308 560 Z" fill="var(--vg-figure)" />
          <path d="M1168 376 H1218 L1226 414 H1160 Z" fill="var(--vg-figure)" />
          <circle cx="1192" cy="348" r="50" fill="var(--vg-figure)" />
          <path d="M1146 316 C1168 286 1218 290 1232 322 C1236 336 1232 346 1224 350 C1220 324 1204 310 1182 310 C1166 310 1156 320 1152 332 C1144 326 1142 320 1146 316 Z" fill="var(--vg-figure)" />
          <path d="M1144 306 C1132 316 1134 332 1148 338 C1150 328 1156 322 1166 318 C1158 310 1150 304 1144 306 Z" fill="var(--vg-figure)" />
          <path d="M1140 418 C1112 432 1094 454 1086 480" fill="none" stroke="var(--vg-sun)" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
          <path d="M1160 338 C1182 324 1214 326 1230 338" fill="none" stroke="var(--vg-rim)" strokeWidth="3.5" opacity="0.36" strokeLinecap="round" />
        </g>

        {/* table */}
        <path d="M0 508 L1600 496 L1600 600 L0 600 Z" fill="url(#vD-table)" />
        <path d="M0 508 L1600 496" stroke="var(--vg-paper)" strokeWidth="3" opacity="0.45" />
        <path d="M0 518 L1600 506" stroke="var(--vg-ink)" strokeWidth="4" opacity="0.08" />

        {/* table things */}
        <g>
          <ellipse cx="700" cy="536" rx="190" ry="26" fill="var(--vg-ink)" opacity="0.1" filter="url(#vD-soft)" />
          <path d="M640 512 H694 L688 552 H646 Z" fill="var(--vg-paper)" />
          <path d="M640 512 H694" stroke="var(--vg-terracotta)" strokeWidth="6" />
          <path d="M654 502 C650 488 656 480 664 474 M676 502 C674 488 680 482 686 476" fill="none" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
          <path d="M730 520 H790 L782 556 H738 Z" fill="var(--vg-paper)" />
          <path d="M730 520 H790" stroke="var(--vg-teal)" strokeWidth="6" />
          <path d="M748 510 C744 496 750 488 758 482 M770 510 C768 496 774 490 780 484" fill="none" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
          <path d="M814 522 C814 500 838 494 852 508 C866 494 890 500 890 522 L882 562 H822 Z" fill="var(--vg-teal)" opacity="0.5" />
          <path d="M890 518 C908 514 910 544 892 546" fill="none" stroke="var(--vg-teal)" strokeWidth="7" opacity="0.5" />
        </g>

        <g transform="rotate(-2 962 552)">
          <path d="M904 536 L1060 522 L1060 574 L904 588 Z" fill="var(--vg-paper)" />
          <path d="M904 536 L1060 522 L1060 574 L904 588 Z" fill="none" stroke="var(--vg-line)" strokeWidth="2" />
          <path d="M982 529 L982 581" stroke="var(--vg-line)" strokeWidth="3" />
          <path d="M920 558 H968 M920 572 H964 M998 554 H1040 M998 568 H1034" stroke="var(--vg-line)" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          <path d="M1048 556 L1078 594" stroke="var(--vg-terracotta)" strokeWidth="5" strokeLinecap="round" />
        </g>

        <g>
          <path d="M1110 536 C1106 514 1122 502 1136 506 C1140 520 1130 532 1110 536 Z" fill="var(--vg-teal)" opacity="0.55" />
          <path d="M1114 540 C1130 522 1152 522 1164 532 C1152 546 1132 548 1114 540 Z" fill="var(--vg-teal)" opacity="0.35" />
        </g>

        <rect width="1600" height="600" fill="url(#vD-vignette)" />
        <rect width="1600" height="600" filter="url(#vD-grain)" style={{ opacity: "var(--vg-grain)" }} />
      </svg>
    </div>
  );
}

/**
 * The closing panel: a student at a window before dawn. Painted in fixed navy
 * tones rather than theme variables, because it sits inside the navy CTA card
 * in both themes.
 */
export function DawnScene({ className = "" }: SceneProps) {
  const label = "An illustration of a student looking out of a window at dawn";
  return (
    <div className={`relative aspect-[5/4] overflow-hidden rounded-xl border border-white/10 bg-[#071121] ${className}`}>
      <svg
        viewBox="0 0 800 640"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={label}
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="vE-sky" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0" stopColor="#060f1f" />
            <stop offset="0.6" stopColor="#0b1d3a" />
            <stop offset="1" stopColor="#153a63" />
          </linearGradient>
          <linearGradient id="vE-view" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1a30" />
            <stop offset="0.72" stopColor="#123152" />
            <stop offset="1" stopColor="#2a4d70" />
          </linearGradient>
          <radialGradient id="vE-dawn" cx="0.5" cy="0.62" r="0.55">
            <stop offset="0" stopColor="#f2a25c" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#e88a52" stopOpacity="0.16" />
            <stop offset="1" stopColor="#e88a52" stopOpacity="0" />
          </radialGradient>
          <filter id="vE-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="vE-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" seed="13" />
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.4 0" />
          </filter>
        </defs>

        <rect width="800" height="640" fill="url(#vE-sky)" />
        <g fill="#f6d79a" opacity="0.7">
          <circle cx="120" cy="84" r="2" />
          <circle cx="248" cy="52" r="1.6" />
          <circle cx="690" cy="96" r="2" />
          <circle cx="566" cy="44" r="1.4" />
          <circle cx="740" cy="38" r="1.2" />
        </g>

        {/* window */}
        <rect x="76" y="58" width="648" height="504" rx="10" fill="none" stroke="#d9e6f5" strokeOpacity="0.16" strokeWidth="10" />
        <rect x="92" y="74" width="616" height="472" fill="url(#vE-view)" />
        <ellipse cx="400" cy="486" rx="330" ry="190" fill="url(#vE-dawn)" filter="url(#vE-soft)" />

        {/* skyline */}
        <g fill="#081627">
          <rect x="120" y="404" width="66" height="142" />
          <rect x="196" y="428" width="46" height="118" />
          <rect x="252" y="382" width="58" height="164" />
          <rect x="320" y="422" width="38" height="124" />
          <rect x="470" y="398" width="54" height="148" />
          <rect x="536" y="430" width="40" height="116" />
          <rect x="586" y="386" width="62" height="160" />
          <rect x="658" y="416" width="44" height="130" />
        </g>
        <g fill="#f2b66d" opacity="0.35">
          <rect x="140" y="426" width="8" height="8" />
          <rect x="160" y="446" width="8" height="8" />
          <rect x="268" y="404" width="8" height="8" />
          <rect x="284" y="428" width="8" height="8" />
          <rect x="486" y="420" width="8" height="8" />
          <rect x="602" y="408" width="8" height="8" />
          <rect x="620" y="432" width="8" height="8" />
        </g>
        <g fill="#071222">
          <rect x="352" y="366" width="30" height="16" rx="3" />
          <rect x="366" y="350" width="4" height="18" />
          <rect x="560" y="370" width="26" height="14" rx="3" />
        </g>
        <g stroke="#0a1a2e" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M430 180 C440 174 450 174 460 180" />
          <path d="M470 160 C478 155 486 155 494 160" />
          <path d="M300 150 C308 145 316 145 324 150" />
        </g>

        <rect x="392" y="74" width="8" height="472" fill="#0a1729" opacity="0.85" />
        <rect x="92" y="302" width="616" height="8" fill="#0a1729" opacity="0.85" />
        <rect x="56" y="556" width="688" height="20" rx="5" fill="#10243f" />
        <rect x="56" y="576" width="688" height="8" fill="#071121" opacity="0.7" />

        {/* plant on the sill */}
        <g>
          <path d="M160 556 L202 556 L196 592 L166 592 Z" fill="#0a1729" />
          <path d="M180 556 C176 528 158 516 142 518 C148 538 162 550 180 556 Z" fill="#0d2036" />
          <path d="M182 556 C188 522 208 510 222 516 C214 538 198 550 182 556 Z" fill="#0d2036" />
          <path d="M181 556 C181 536 184 524 188 512" stroke="#f2b66d" strokeWidth="2" opacity="0.35" fill="none" />
        </g>

        {/* notebook on the sill */}
        <g transform="rotate(3 640 546)">
          <rect x="606" y="532" width="78" height="12" rx="3" fill="#123052" />
          <rect x="606" y="520" width="78" height="12" rx="3" fill="#0c1e36" />
          <rect x="606" y="508" width="78" height="12" rx="3" fill="#8e4b34" opacity="0.9" />
        </g>

        {/* student from behind */}
        <g>
          <path d="M292 640 C298 546 340 496 400 492 C460 496 502 546 508 640 Z" fill="#040c19" />
          <circle cx="400" cy="452" r="40" fill="#040c19" />
          <path d="M432 424 C458 430 470 456 462 482 C456 500 442 508 426 510 C436 486 434 456 420 438 C414 430 408 426 400 424 Z" fill="#040c19" />
          <circle cx="452" cy="418" r="15" fill="#040c19" />
          <path
            d="M456 512 C484 522 500 552 508 596"
            fill="none"
            stroke="#f2b66d"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path d="M342 512 C320 522 306 552 300 596" fill="none" stroke="#d9e6f5" strokeWidth="2" strokeLinecap="round" opacity="0.12" />
        </g>

        <rect width="800" height="640" filter="url(#vE-grain)" opacity="0.18" />
      </svg>
    </div>
  );
}

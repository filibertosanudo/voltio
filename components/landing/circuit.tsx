import type { CSSProperties } from "react";

// Orthogonal traces with rounded corners, like a board's copper lines, on a
// 1200x640 canvas that slices to whatever the hero's size is.
const TRACES = [
  { d: "M0 120 H180 Q200 120 200 140 V260 Q200 280 220 280 H420", end: [420, 280], delay: 0, pulse: 7 },
  { d: "M0 470 H120 Q140 470 140 450 V380 Q140 360 160 360 H300", end: [300, 360], delay: 200, pulse: 9 },
  { d: "M1200 90 H1010 Q990 90 990 110 V190 Q990 210 970 210 H860", end: [860, 210], delay: 350, pulse: 8 },
  { d: "M1200 520 H980 Q960 520 960 500 V420 Q960 400 940 400 H840", end: [840, 400], delay: 500, pulse: 10 },
  { d: "M520 640 V600 Q520 580 540 580 H700 Q720 580 720 560 V530", end: [720, 530], delay: 650, pulse: 11 },
] as const;

const vars = (value: Record<string, string>) => value as CSSProperties;

/** The hero's background: traces that draw in once, then carry a pulse now and then. */
export function Circuit() {
  return (
    <svg
      className="v-loop pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 640"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      {TRACES.map((trace, i) => (
        <g key={i}>
          <path
            d={trace.d}
            pathLength={100}
            className="v-trace text-white/[0.09]"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            style={vars({ "--d": `${trace.delay}ms` })}
          />
          <path
            d={trace.d}
            pathLength={100}
            className="v-trace-pulse text-volt"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={vars({ "--d": `${1.8 + i * 1.3}s`, "--dur": `${trace.pulse}s` })}
          />
          <circle cx={trace.end[0]} cy={trace.end[1]} r={4} className="text-white/20" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

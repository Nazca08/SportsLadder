import { STATE_PATHS, AREA_STATE } from "@/lib/leagues/state-paths";

/**
 * Visual identifier for a league.
 *
 * Three signals, each readable without reading the label:
 *   - the state outline behind everything says where
 *   - one paddle or ball for singles, two for doubles
 *   - colour says division: pink for women's, ball-yellow for everyone else
 *
 * Text alone was not enough. "Dallas Pickleball League - Singles" and
 * "... - Doubles" differ by one word at the end of a long line and read as the
 * same league at a glance.
 */

const WOMENS = "#F26BA6";
const DEFAULT = "#D7E639";

function colorFor(division: string) {
  return division === "womens" ? WOMENS : DEFAULT;
}

/** Pickleball paddle, drawn in a 24x24 box with the handle at the bottom. */
function Paddle({ color }: { color: string }) {
  return (
    <g>
      <rect x="5" y="1.5" width="14" height="15.5" rx="6.5" fill={color} />
      <rect x="10.2" y="16" width="3.6" height="6.5" rx="1.6" fill={color} />
      <circle cx="9.4" cy="6.6" r="1.05" fill="#14302A" />
      <circle cx="14.6" cy="6.6" r="1.05" fill="#14302A" />
      <circle cx="9.4" cy="11.4" r="1.05" fill="#14302A" />
      <circle cx="14.6" cy="11.4" r="1.05" fill="#14302A" />
    </g>
  );
}

/** Tennis ball with its seam, in the same 24x24 box. */
function Ball({ color }: { color: string }) {
  return (
    <g>
      <circle cx="12" cy="12" r="9.5" fill={color} />
      <path
        d="M4.2 6.9c3.9 2.2 5.3 8 2.9 12.8"
        stroke="#14302A"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M19.8 6.9c-3.9 2.2-5.3 8-2.9 12.8"
        stroke="#14302A"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

export function LeagueBadge({
  sport,
  division,
  format,
  area,
  size = 42,
}: {
  sport: string;
  division: string;
  format: string;
  area?: string | null;
  size?: number;
}) {
  const color = colorFor(division);
  const doubles = format === "doubles";
  const statePath = area ? STATE_PATHS[AREA_STATE[area] ?? ""] : undefined;
  const Icon = sport === "tennis" ? Ball : Paddle;

  const divisionWord =
    division === "womens" ? "women's" : division === "mens" ? "men's" : "mixed";

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg overflow-hidden"
      style={{
        width: size,
        height: size,
        background: "rgba(255,255,255,0.04)",
        boxShadow: `inset 0 0 0 1px ${color}44`,
      }}
      role="img"
      aria-label={`${sport === "tennis" ? "Tennis" : "Pickleball"}, ${
        doubles ? "doubles" : "singles"
      }, ${divisionWord}`}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
        {/* The state sits behind at low opacity: recognisable as a shape without
            competing with the icons for attention. */}
        {statePath && <path d={statePath} fill={color} fillOpacity={0.2} />}

        {doubles ? (
          <>
            <g transform="translate(14,30) scale(1.5)">
              <Icon color={color} />
            </g>
            <g transform="translate(50,30) scale(1.5)">
              <Icon color={color} />
            </g>
          </>
        ) : (
          <g transform="translate(32,26) scale(1.9)">
            <Icon color={color} />
          </g>
        )}
      </svg>
    </span>
  );
}

/** Singles or doubles in words, for places where the badge alone is too subtle. */
export function FormatChip({ format }: { format: string }) {
  const doubles = format === "doubles";
  return (
    <span
      className="inline-flex items-center rounded font-score text-[10px] tracking-wider px-1.5 py-0.5 border border-white/15 text-chalk-dim"
      title={doubles ? "Doubles" : "Singles"}
    >
      {doubles ? "2v2" : "1v1"}
    </span>
  );
}

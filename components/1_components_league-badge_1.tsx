/**
 * Visual identifier for a league.
 *
 * Text alone was not doing the job: "Dallas Pickleball League - Mixed Singles"
 * and "Dallas Pickleball League - Mixed Doubles" differ by one word at the end
 * of a long line, and read as the same league at a glance. Sport is carried by
 * the icon, division by its colour, and singles versus doubles by an explicit
 * 1v1 / 2v2 chip -- three signals that can be told apart without reading.
 */

/**
 * Division colours, drawn from the brand palette rather than the usual
 * blue-for-men pink-for-women shorthand. Men's and women's are deliberately
 * different hues rather than a warm/cool pair, so neither reads as the default.
 */
const DIVISION_COLOR: Record<string, { fg: string; bg: string; ring: string }> = {
  mens: { fg: "#5FB0DE", bg: "rgba(95,176,222,0.12)", ring: "rgba(95,176,222,0.40)" },
  womens: { fg: "#B98CD6", bg: "rgba(185,140,214,0.12)", ring: "rgba(185,140,214,0.40)" },
  mixed: { fg: "#D7E639", bg: "rgba(215,230,57,0.12)", ring: "rgba(215,230,57,0.40)" },
  open: { fg: "#EA5A3D", bg: "rgba(234,90,61,0.12)", ring: "rgba(234,90,61,0.40)" },
};

function colorsFor(division: string) {
  return DIVISION_COLOR[division] ?? DIVISION_COLOR.mixed;
}

/** Tennis ball: circle with the seam. */
function TennisIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M4.5 6.5c3.5 2 4.8 7.2 2.6 11.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M19.5 6.5c-3.5 2-4.8 7.2-2.6 11.6" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Pickleball paddle: a solid face and a handle. Reads differently from a ball at small sizes. */
function PickleballIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="2.5" width="13" height="14" rx="4" stroke={color} strokeWidth="1.8" />
      <circle cx="9" cy="7" r="1" fill={color} />
      <circle cx="13" cy="7" r="1" fill={color} />
      <circle cx="9" cy="11" r="1" fill={color} />
      <circle cx="13" cy="11" r="1" fill={color} />
      <path d="M11 16.5V21" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function LeagueBadge({
  sport,
  division,
  size = 34,
}: {
  sport: string;
  division: string;
  size?: number;
}) {
  const c = colorsFor(division);
  const iconSize = Math.round(size * 0.6);

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg"
      style={{ width: size, height: size, background: c.bg, boxShadow: `inset 0 0 0 1px ${c.ring}` }}
      // The label spells out what the colour and icon encode, for anyone using
      // a screen reader or who cannot tell the hues apart.
      role="img"
      aria-label={`${sport === "tennis" ? "Tennis" : "Pickleball"}, ${division} division`}
    >
      {sport === "tennis" ? (
        <TennisIcon color={c.fg} size={iconSize} />
      ) : (
        <PickleballIcon color={c.fg} size={iconSize} />
      )}
    </span>
  );
}

/** Singles or doubles, as an explicit chip. The clearest of the three signals. */
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

/**
 * The green background of a cohort cell: stronger the larger the share of the cohort is. `color` is
 * the theme's success colour as `#rrggbb`; a colour written another way, a share that is missing or
 * not above 0 gives no background. The share is capped at 1.
 */
export function cellTint(
  color: string,
  ratio: number | null,
): { backgroundColor: string } | undefined {
  if (ratio === null || ratio <= 0) return undefined;
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return undefined;
  const [r, g, b] = match.slice(1).map((part) => Number.parseInt(part, 16));
  const opacity = 0.1 + 0.5 * Math.min(ratio, 1);
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})` };
}

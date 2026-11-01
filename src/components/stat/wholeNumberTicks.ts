/**
 * Ticks for the vertical axis of a chart of counts (people, requests): whole numbers only, so a
 * day with at most two people never gets a tick at 0.5 or 1.5, and none above the largest value
 * (the chart does not draw outside its range). The step is 1, 2 or 5 times a power of ten, the
 * smallest that keeps the number of ticks near the wanted count.
 *
 * Passed as `scale.y.tickMethod`, so the library calls it with the domain and a wanted count.
 */
export function wholeNumberTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  if (high < low) return [];
  if (high === low) return [low];
  const wanted = Math.max(2, Math.floor(count));
  // A little more than the wanted count is better than a step that leaves the axis nearly bare.
  const raw = (high - low) / (wanted - 1) / 1.5;
  const power = 10 ** Math.floor(Math.log10(raw));
  const factor = raw / power;
  const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
  const step = Math.max(1, nice * power);
  const ticks: number[] = [];
  for (let tick = Math.ceil(low / step) * step; tick <= high; tick += step) ticks.push(tick);
  return ticks;
}

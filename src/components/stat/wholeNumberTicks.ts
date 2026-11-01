/**
 * Ticks for the vertical axis of a chart of counts (people, requests): whole numbers only, so a
 * day with at most two people never gets a tick at 0.5 or 1.5. The ends are rounded outward and
 * the step is 1, 2 or 5 times a power of ten, which keeps the number of ticks small.
 *
 * Passed as `scale.y.tickMethod`, so the library calls it with the domain and a wanted count.
 */
export function wholeNumberTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const low = Math.floor(Math.min(min, max));
  let high = Math.ceil(Math.max(min, max));
  if (high === low) high = low + 1;
  const wanted = Math.max(2, Math.floor(count));
  const raw = (high - low) / (wanted - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const factor = raw / power;
  const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10;
  const step = Math.max(1, nice * power);
  const ticks: number[] = [];
  for (let tick = Math.floor(low / step) * step; tick < high + step; tick += step) {
    ticks.push(tick);
    if (tick >= high) break;
  }
  return ticks;
}

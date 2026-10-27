// WCAG relative luminance and contrast ratio, as used in the spec's section 7.

const DARK_ON_PRIMARY = '#06201F';
const LIGHT_ON_PRIMARY = '#FFFFFF';

function parseHex(hex: string): [number, number, number] {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short)
    return [short[1], short[2], short[3]].map((c) => Number.parseInt(c + c, 16)) as [
      number,
      number,
      number,
    ];
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (long)
    return [long[1], long[2], long[3]].map((c) => Number.parseInt(c, 16)) as [
      number,
      number,
      number,
    ];
  throw new TypeError(`not a hex colour: ${hex}`);
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The text colour for a solid primary-coloured element: the dark colour or white, whichever contrasts more. */
export function pickOnPrimary(primaryHex: string): string {
  return contrastRatio(DARK_ON_PRIMARY, primaryHex) >= contrastRatio(LIGHT_ON_PRIMARY, primaryHex)
    ? DARK_ON_PRIMARY
    : LIGHT_ON_PRIMARY;
}

const toHex = (channels: number[]) =>
  `#${channels.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();

/** `a` moved `amount` (0 to 1) of the way to `b`, as upper case six-digit hex. */
export function mixHex(a: string, b: string, amount: number): string {
  const [x, y] = [parseHex(a), parseHex(b)];
  return toHex(x.map((channel, i) => channel + (y[i] - channel) * amount));
}

const MIX_STEP = 0.01;

/** The first step of `colour` toward `target` that reads at `min` on every background, or null. */
function stepToward(colour: string, target: string, backgrounds: string[], min: number) {
  for (let amount = MIX_STEP; amount <= 1 + 1e-9; amount += MIX_STEP) {
    const candidate = mixHex(colour, target, Math.min(amount, 1));
    if (backgrounds.every((bg) => contrastRatio(candidate, bg) >= min)) return candidate;
  }
  return null;
}

/**
 * The colour to use for text or a link that is meant to look like `colour`: `colour` itself when it
 * reads at `min` (4.5, WCAG AA for body text) on every background, otherwise the nearest shade of it
 * that does. On light backgrounds the shade is darker, on dark backgrounds lighter.
 */
export function readableText(colour: string, backgrounds: string[], min = 4.5): string {
  if (backgrounds.every((bg) => contrastRatio(colour, bg) >= min)) return colour;
  const meanLuminance =
    backgrounds.reduce((sum, bg) => sum + luminance(bg), 0) / backgrounds.length;
  const [first, second] = meanLuminance > 0.179 ? ['#000000', '#FFFFFF'] : ['#FFFFFF', '#000000'];
  return (
    stepToward(colour, first, backgrounds, min) ??
    stepToward(colour, second, backgrounds, min) ??
    first
  );
}

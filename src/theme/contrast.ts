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

function luminance(hex: string): number {
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

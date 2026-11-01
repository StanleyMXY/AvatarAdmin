/** What a UTM value may be (contract 10.4): anything else is left out of a link. */
export const UTM_VALUE = /^[A-Za-z0-9._-]{1,64}$/;

/** The address of the interface a landing page calls (contract 10.4, 1b): with the link root when it is known, else only the path. */
export function landingAddress(base: string | null): string {
  return `POST ${base ?? ''}/api/attribution/click`;
}

/** The text that goes into the clipboard: a failure to write it is the caller's to show. */
export async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error('no clipboard');
}

/** Values for the three platforms: the pixel column of the campaign and the name that is the default source. */
export const PLATFORM_FIELDS = {
  FACEBOOK: { pixel: 'facebookPixelId', source: 'facebook' },
  GOOGLE: { pixel: 'googlePixelId', source: 'google' },
  TIKTOK: { pixel: 'tiktokPixelId', source: 'tiktok' },
} as const;

import { DASH } from '../../utils/ratio';

/** A change of credits with its sign: `+500`, `-200`; zero has no sign; a value that is not known is a dash. */
export function formatSigned(n: number | null | undefined, locale: string): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' }).format(n);
}

/** The first 8 characters of an id, for an administrator that is gone (the user name is null then). */
export const shortId = (id: string): string => Array.from(id).slice(0, 8).join('');

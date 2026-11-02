import { validDay } from './statRange';

// An ISO-8601 date and time with a time zone ("Z" or an offset like +08:00), the form the backend
// reads for the instants of its filters.
const INSTANT =
  /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,9})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

/** The milliseconds of an ISO-8601 instant with a time zone; NaN when the text is anything else. */
export function instantMs(text: string): number {
  const match = INSTANT.exec(text);
  return match && validDay(match[1]) ? Date.parse(text) : Number.NaN;
}

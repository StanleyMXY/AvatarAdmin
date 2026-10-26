import { trimSpec } from '../../utils/trimSpec';

// A line ends at \n, \r, \r\n and at the Unicode line and paragraph separators.
const LINE_END = new RegExp(
  `\\r\\n|[\\n\\r${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`,
);

export type Recipients = {
  /** The account ids in the order written, each once. */
  ids: string[];
  /** How many non-empty lines were a repeat of an earlier line. */
  repeated: number;
};

/**
 * The recipients as the box holds them: one account id per line. Each line is trimmed with the
 * contract's definition of whitespace (not `String.trim`), empty lines are dropped, and an id
 * written twice stays once, at its first place: the backend refuses a list with a repeat. Nothing
 * else is done to a line (the form of an account id is the backend's to judge).
 */
export function parseRecipients(text: string): Recipients {
  const ids: string[] = [];
  const seen = new Set<string>();
  let lines = 0;
  for (const line of text.split(LINE_END)) {
    const id = trimSpec(line);
    if (id === '') continue;
    lines += 1;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return { ids, repeated: lines - ids.length };
}

/**
 * What stops a list from being sent: nothing in it, or more than `GET /meta` `maxRecipients`. A
 * limit that is missing or is not a positive number is not checked here (the backend decides).
 */
export function recipientsProblem(count: number, max: unknown): 'empty' | 'tooMany' | null {
  if (count === 0) return 'empty';
  if (typeof max === 'number' && Number.isFinite(max) && max > 0 && count > max) return 'tooMany';
  return null;
}

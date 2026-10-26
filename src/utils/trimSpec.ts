// Contract section 1.9: "whitespace" is the 29 code points that Python's str.strip() removes.
// The built-in String.prototype.trim differs (it keeps U+0085 and U+001C..U+001F, and removes
// U+FEFF), so it must not be used for any text that is sent to or compared with the backend.

const SPEC_WHITESPACE_RANGES: readonly (readonly [number, number])[] = [
  [0x09, 0x0d],
  [0x1c, 0x20],
  [0x85, 0x85],
  [0xa0, 0xa0],
  [0x1680, 0x1680],
  [0x2000, 0x200a],
  [0x2028, 0x2029],
  [0x202f, 0x202f],
  [0x205f, 0x205f],
  [0x3000, 0x3000],
];

function isSpecWhitespace(codeUnit: number): boolean {
  for (const [from, to] of SPEC_WHITESPACE_RANGES) {
    if (codeUnit >= from && codeUnit <= to) return true;
  }
  return false;
}

/** Removes the contract's whitespace from both ends of `s`; the middle is left alone. */
export function trimSpec(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && isSpecWhitespace(s.charCodeAt(start))) start++;
  while (end > start && isSpecWhitespace(s.charCodeAt(end - 1))) end--;
  return s.slice(start, end);
}

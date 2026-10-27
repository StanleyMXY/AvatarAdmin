// Finds the permission codes in the spec and the contract. Used by check-permission-codes.ts and
// by the tests; src/access/permissionCodes.ts was produced the same way.

const SPEC_SECTIONS = [/^## 3 /, /^## 4 /, /^## 5 /];
const CONTRACT_SECTIONS = [
  /^### 17\.3 /,
  /^### 17\.4 /,
  /^### 22\.9 /,
  /^### 23\.6 /,
  /^### 24\.2 /,
  /^### 25\.7 /,
  /^### 26\.3 /,
  /^## 二十八、/,
];
const CODE_IN_BACKTICKS = /`([A-Z_]+(?::[A-Z_]+)+)`/g;
const HEADING = /^(#{1,6}) /;

/**
 * A heading and everything below it up to the next heading of the same or a higher level.
 * Lines inside code fences are never headings. Empty when no line matches.
 */
export function sectionText(text: string, heading: RegExp): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inFence = false;
  let level = 0;
  for (const line of lines) {
    if (line.startsWith('```')) inFence = !inFence;
    const match = inFence ? null : HEADING.exec(line);
    if (level === 0) {
      if (match && heading.test(line)) {
        level = match[1].length;
        out.push(line);
      }
      continue;
    }
    if (match && match[1].length <= level) break;
    out.push(line);
  }
  return out.join('\n');
}

export function parseExclusions(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/** `raw`: every distinct code-shaped word; `codes`: the same without the excluded words. Both sorted. */
export function extractPermissionCodes(
  spec: string,
  contract: string,
  exclusions: readonly string[],
): { raw: string[]; codes: string[] } {
  const text = [
    ...SPEC_SECTIONS.map((h) => sectionText(spec, h)),
    ...CONTRACT_SECTIONS.map((h) => sectionText(contract, h)),
  ].join('\n');
  const raw = [...new Set([...text.matchAll(CODE_IN_BACKTICKS)].map((m) => m[1]))].sort();
  return { raw, codes: raw.filter((word) => !exclusions.includes(word)) };
}

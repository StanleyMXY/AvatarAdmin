// Reads the error table of contract 1.4: the codes of its rows and the reason codes that its
// INVALID_REQUEST row defines for `data.details`. Used by the language file tests.

const HEADING = '### 1.4 通用错误码';
const NEXT_HEADING = '### 1.5';

/** The lines of table 1.4 below its header and separator rows (empty when the section is missing). */
function tableRows(contract: string): string[] {
  const start = contract.indexOf(HEADING);
  if (start === -1) return [];
  const end = contract.indexOf(NEXT_HEADING, start);
  const lines = contract
    .slice(start, end === -1 ? undefined : end)
    .split('\n')
    .filter((line) => line.startsWith('|'));
  return lines.slice(2);
}

/** Every row of the table must read as `| CODE | status | ... |`; a row that does not is returned in `unread`. */
export function errorTable(contract: string): { codes: string[]; unread: string[] } {
  const codes: string[] = [];
  const unread: string[] = [];
  for (const row of tableRows(contract)) {
    const code = /^\| ([A-Z][A-Z0-9_]+) \| \d{3} \|/.exec(row)?.[1];
    if (code) codes.push(code);
    else unread.push(row);
  }
  return { codes, unread };
}

/**
 * The reason codes named between "`reason` 是代码" and "人看的说明" in the INVALID_REQUEST row,
 * each once, in the order they are first named; words inside full-width brackets are explanations.
 */
export function reasonCodes(contract: string): string[] {
  const row = tableRows(contract).find((line) => line.startsWith('| INVALID_REQUEST |'));
  if (!row) return [];
  const from = row.indexOf('`reason` 是代码');
  const to = row.indexOf('人看的说明', from);
  if (from === -1 || to === -1) return [];
  // A word inside full-width brackets explains a code (「状态不是 `ACTIVE`」), it is not one.
  const listed = row.slice(from, to).replace(/（[^（）]*）/g, '');
  const found = [...listed.matchAll(/`([A-Z][A-Z_]+)`/g)].map((m) => m[1]);
  return [...new Set(found)];
}

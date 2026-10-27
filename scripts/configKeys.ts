// Reads the configuration key table of contract 17.5. Used by gen-config-keys.ts, check-config-keys.ts
// and the tests.

export type RawConfigRow = {
  key: string;
  defaultText: string;
  editPermission: string;
  note: string;
};

const ROW = /^\| `([a-z_.0-9]+)` \|(.*)$/;

/** The text of section 17.5, from its heading to the next `###` heading. */
export function section175(contract: string): string {
  const start = contract.indexOf('\n### 17.5 ');
  if (start === -1) return '';
  const next = contract.indexOf('\n### ', start + 5);
  return contract.slice(start, next === -1 ? undefined : next);
}

/**
 * The table rows of 17.5. A row is `| key | default | source | edit permission | note |`; the note is
 * everything after the fourth separator (it can hold more ` | `).
 */
export function parseConfigRows(contract: string): RawConfigRow[] {
  const rows: RawConfigRow[] = [];
  for (const line of section175(contract).split('\n')) {
    const match = ROW.exec(line);
    if (!match) continue;
    const [defaultText = '', , permission = '', ...note] = match[2]
      .split(' | ')
      .map((cell) => cell.trim());
    rows.push({
      key: match[1],
      defaultText: defaultText.replace(/^`|`$/g, ''),
      editPermission: permission.replace(/`/g, ''),
      note: note
        .join(' | ')
        .replace(/\|\s*$/, '')
        .trim(),
    });
  }
  return rows;
}

const PLAIN_STRINGS = new Set([
  'attribution.cost_currency',
  'app.display_name',
  'push.default_locale',
  'invite.reward_trigger',
  'usage_price.default_currency',
]);

/**
 * The default of a row as a JSON value: a number, a boolean, a list or object, or one of the plain
 * strings; `null` when the table says there is no default ("no default", empty, unset). The
 * mock backend serves these as `defaultValue`; the front end never stores defaults.
 */
export function defaultValueOf(row: RawConfigRow): unknown {
  const text = row.defaultText;
  // The default of this row is described in words (an address of a third-party service), so it stays unset here.
  if (PLAIN_STRINGS.has(row.key)) return text;
  if (text === '空列表') return [];
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^[[{]/.test(text)) return JSON.parse(text);
  return null;
}

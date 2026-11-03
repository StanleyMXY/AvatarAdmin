import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONTRACT,
  errorCodesJson,
  errorTable,
  readContract,
  reasonCodes,
} from './contractErrors';

const TABLE = `intro
### 1.4 通用错误码

| code | HTTP状态 | 说明 |
|------|---------|------|
| INVALID_TOKEN | 401 | x |
| INVALID_REQUEST | 400 | 参数不合法。\`reason\` 是代码：账号类 \`ACCOUNT_NOT_FOUND\`（不存在）、\`ACCOUNT_NOT_ACTIVE\`（状态不是 \`ACTIVE\`）；值校验类 \`TOO_LONG\`、\`INVALID_EMAIL\`（总长度超限用 \`TOO_LONG\`）。人看的说明在 \`message\` 里 \`NOT_A_REASON\` |
| ROLE_IN_USE | 409 | y |

### 1.5 next
| NOT_THIS | 400 | z |
`;

describe('errorTable', () => {
  it('reads the codes of table 1.4 only, in order', () => {
    expect(errorTable(TABLE)).toEqual({
      codes: ['INVALID_TOKEN', 'INVALID_REQUEST', 'ROLE_IN_USE'],
      unread: [],
    });
  });

  it('returns a row it cannot read as unread, so a changed row format is not skipped silently', () => {
    const odd = TABLE.replace('| ROLE_IN_USE | 409 | y |', '| `ROLE_IN_USE` | 409 | y |');
    const result = errorTable(odd);
    expect(result.codes).toEqual(['INVALID_TOKEN', 'INVALID_REQUEST']);
    expect(result.unread).toHaveLength(1);
  });

  it('finds nothing when the section is missing', () => {
    expect(errorTable('nothing')).toEqual({ codes: [], unread: [] });
  });

  it('reads all 81 rows of the real contract', () => {
    const real = errorTable(
      readFileSync('docs/shared-snapshots/backend-task-java-backend.md', 'utf8'),
    );
    expect(real.unread).toEqual([]);
    expect(real.codes).toHaveLength(81);
  });
});

describe('reasonCodes', () => {
  it('reads the codes between the marker and the closing sentence, once each', () => {
    expect(reasonCodes(TABLE)).toEqual([
      'ACCOUNT_NOT_FOUND',
      'ACCOUNT_NOT_ACTIVE',
      'TOO_LONG',
      'INVALID_EMAIL',
    ]);
  });

  it('returns nothing when the row or the markers are missing', () => {
    expect(reasonCodes('nothing')).toEqual([]);
    expect(reasonCodes(TABLE.replace('`reason` 是代码', 'reason'))).toEqual([]);
    expect(reasonCodes(TABLE.replace('人看的说明', 'x'))).toEqual([]);
  });

  it('finds the 36 reason codes of the real contract, in the order the row names them', () => {
    const real = reasonCodes(
      readFileSync('docs/shared-snapshots/backend-task-java-backend.md', 'utf8'),
    );
    expect(real).toEqual([
      'ACCOUNT_NOT_FOUND',
      'ACCOUNT_NOT_ACTIVE',
      'NOT_HTTPS',
      'INVALID_HOST',
      'INVALID_PORT',
      'INVALID_PATH',
      'TOO_LONG',
      'INVALID_EMAIL',
      'NOT_AN_INTEGER',
      'OUT_OF_RANGE',
      'NOT_BOOLEAN',
      'INVALID_LANGUAGE_TAG',
      'EMPTY_NOT_ALLOWED',
      'INVALID_PATTERN',
      'RESOURCE_NOT_FOUND',
      'DUPLICATE',
      'INVALID_CHARACTER',
      'MISSING',
      'INVALID_FORMAT',
      'PACKAGE_NAME_NOT_CONFIGURED',
      'SOURCE_EXPIRED',
      'TOO_SLOW',
      'TOO_MANY_EVENTS',
      'LAST_OTP_CHANNEL',
      'COUNTRY_LOSES_OTP_CHANNEL',
      'LAST_OTP_TEMPLATE',
      'LAST_ENGLISH_FALLBACK_TEMPLATE',
      'REQUIRED',
      'INVALID_TYPE',
      'CONTROL_CHARACTER',
      'IMMUTABLE',
      'NOT_FOUND',
      'DISABLED',
      'CURRENCY_MISMATCH',
      'NEGATIVE',
      'TOO_MANY_DECIMALS',
    ]);
  });
});

describe('reading a contract by its path', () => {
  it('reads the snapshot when no path is given', () => {
    expect(readContract()).toBe(readFileSync(DEFAULT_CONTRACT, 'utf8'));
    expect(DEFAULT_CONTRACT).toBe('docs/shared-snapshots/backend-task-java-backend.md');
  });

  it('reads the file at the path it is given, not the snapshot', () => {
    const other = readContract('docs/shared-snapshots/admin-frontend-design.md');
    expect(other).toBe(readFileSync('docs/shared-snapshots/admin-frontend-design.md', 'utf8'));
    expect(other).not.toBe(readContract());
  });
});

describe('errorCodesJson', () => {
  it('writes the codes of table 1.4 as the generated file has them, one per line', () => {
    expect(errorCodesJson(TABLE)).toBe(
      '[\n  "INVALID_TOKEN",\n  "INVALID_REQUEST",\n  "ROLE_IN_USE"\n]\n',
    );
  });

  it('writes the file that is checked in when it reads the snapshot', () => {
    expect(errorCodesJson(readContract())).toBe(
      readFileSync('src/locales/errorCodes.generated.json', 'utf8'),
    );
  });

  it('refuses a table with a row it cannot read, so a changed row format is not written down wrong', () => {
    expect(() =>
      errorCodesJson(TABLE.replace('| ROLE_IN_USE | 409 | y |', '| `ROLE_IN_USE` | 409 | y |')),
    ).toThrow(/cannot be read/);
  });
});

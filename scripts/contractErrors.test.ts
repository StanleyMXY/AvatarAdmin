import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { errorTable, reasonCodes } from './contractErrors';

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

  it('reads all 79 rows of the real contract', () => {
    const real = errorTable(
      readFileSync('docs/shared-snapshots/backend-task-java-backend.md', 'utf8'),
    );
    expect(real.unread).toEqual([]);
    expect(real.codes).toHaveLength(79);
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

  it('finds the 14 reason codes of the real contract', () => {
    const real = reasonCodes(
      readFileSync('docs/shared-snapshots/backend-task-java-backend.md', 'utf8'),
    );
    expect(real).toHaveLength(14);
    expect(real[0]).toBe('ACCOUNT_NOT_FOUND');
    expect(real[real.length - 1]).toBe('INVALID_PATTERN');
  });
});

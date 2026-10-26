import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import generated from '../src/pages/config/configKeys.generated.json';
import { defaultValueOf, parseConfigRows, section175 } from './configKeys';
import { compareConfigKeys } from './configKeysCheck';

const TABLE = `intro
### 17.4 something
| \`not.this\` | 1 | x | \`A:B\` | no |
### 17.5 运营可调参数

text
| key | 默认值 | 出处 | 编辑权限 | 说明 |
|-----|--------|------|---------|------|
| \`auth.access_ttl_minutes\` | 1440 | 2.6 | \`CONFIG:MANAGE\` | 说明 a | with a bar |
| \`guest.call_minutes_total\` | 空（未配置按 0） | 2.1 | \`CONFIG:MANAGE\` | |
| \`app.display_name\` | \`AvatarApp\` | 19 | \`CONFIG:MANAGE\` | n |
| \`milestone.days\` | [7,30,100] | 28 | \`COMPANIONSHIP:CONFIG\` | |
| \`integrity.check_enabled\` | \`true\` | 2 | \`CONFIG:MANAGE\` | |
| \`moderation.face_min_det_score\` | 0.5 | 3 | \`MODERATION:CONFIG\` | |
### 17.6 next
| \`not.this.either\` | 1 | x | \`A:B\` | no |
`;

describe('parseConfigRows', () => {
  it('reads only the rows of section 17.5, with default, permission and note', () => {
    const rows = parseConfigRows(TABLE);
    expect(rows.map((r) => r.key)).toEqual([
      'auth.access_ttl_minutes',
      'guest.call_minutes_total',
      'app.display_name',
      'milestone.days',
      'integrity.check_enabled',
      'moderation.face_min_det_score',
    ]);
    expect(rows[0]).toEqual({
      key: 'auth.access_ttl_minutes',
      defaultText: '1440',
      editPermission: 'CONFIG:MANAGE',
      note: '说明 a | with a bar',
    });
    expect(rows[2].defaultText).toBe('AvatarApp');
  });

  it('finds nothing when the section is missing', () => {
    expect(section175('no sections here')).toBe('');
    expect(parseConfigRows('no sections here')).toEqual([]);
  });
});

describe('defaultValueOf', () => {
  const value = (text: string, key = 'x.y') =>
    defaultValueOf({ key, defaultText: text, editPermission: 'CONFIG:MANAGE', note: '' });
  it('turns the default text into a JSON value', () => {
    expect(value('1440')).toBe(1440);
    expect(value('0.5')).toBe(0.5);
    expect(value('true')).toBe(true);
    expect(value('false')).toBe(false);
    expect(value('[7,30,100]')).toEqual([7, 30, 100]);
    expect(value('{"BONDING":50,"CLOSE":150}')).toEqual({ BONDING: 50, CLOSE: 150 });
    expect(value('AvatarApp', 'app.display_name')).toBe('AvatarApp');
  });
  it('is null when the table says there is no default', () => {
    for (const text of ['无默认值', '空', '空列表', '空（未配置按 0）'])
      expect(value(text)).toBeNull();
  });
});

describe('the real contract table', () => {
  const contract = readFileSync('docs/shared-snapshots/backend-task-java-backend.md', 'utf8');
  const rows = parseConfigRows(contract);

  it('has 225 keys, each once, and the generated file lists the same keys with the same permission', () => {
    expect(rows).toHaveLength(225);
    expect(new Set(rows.map((r) => r.key)).size).toBe(225);
    expect(generated).toEqual(rows.map((r) => ({ key: r.key, editPermission: r.editPermission })));
  });

  it('gives a default value that parses for every row', () => {
    for (const row of rows) expect(() => defaultValueOf(row), row.key).not.toThrow();
  });
});

describe('compareConfigKeys', () => {
  const a = { key: 'a.one', editPermission: 'CONFIG:MANAGE' };
  const b = { key: 'b.two', editPermission: 'PUSH:CONFIG' };

  it('is empty when all three agree', () => {
    expect(compareConfigKeys([a, b], [b, a], [a, b])).toEqual([]);
  });

  it('names a missing key, an extra key, a different permission and a repeated key', () => {
    const problems = compareConfigKeys(
      [a, b],
      [a],
      [
        a,
        { key: 'c.three', editPermission: 'CONFIG:MANAGE' },
        { ...b, editPermission: 'CONFIG:MANAGE' },
        a,
      ],
    );
    expect(problems).toContain('generated file is missing b.two');
    expect(problems).toContain('schema has c.three, which the contract does not');
    expect(problems).toContain(
      'schema: b.two needs CONFIG:MANAGE but the contract says PUSH:CONFIG',
    );
    expect(problems).toContain('schema has a key twice');
  });
});

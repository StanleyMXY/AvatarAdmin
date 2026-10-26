import { describe, expect, it } from 'vitest';
import { permissionTreeFromSpec } from './permissionTree';

const table = (rows: string[]) =>
  [
    '### 5.0 路由总表',
    '',
    '| 菜单 | 页面（路由） | access | 接口 |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');

describe('permissionTreeFromSpec', () => {
  const codes = ['A:VIEW', 'A:EDIT', 'B:VIEW', 'B:EXPORT', 'C:VIEW', 'A:ROLE'];

  it('makes a MENU node of every page access and a FUNCTION child of the other codes of that row', () => {
    const spec = table([
      '| m | 列表 `/a` | `A:VIEW`（编辑需 `A:EDIT`） | `GET /a` |',
      '| | 页 `/b` | `B:VIEW` | `GET /b`、`GET /b/export`（`B:EXPORT`） |',
      '| | 页 `/c` | `C:VIEW` | `GET /c` |',
    ]);
    const nodes = permissionTreeFromSpec(spec, [
      'A:VIEW',
      'A:EDIT',
      'B:VIEW',
      'B:EXPORT',
      'C:VIEW',
    ]);
    expect(nodes).toEqual([
      { code: 'A:VIEW', parent: null, type: 'MENU', sortOrder: 1 },
      { code: 'A:EDIT', parent: 'A:VIEW', type: 'FUNCTION', sortOrder: 2 },
      { code: 'B:VIEW', parent: null, type: 'MENU', sortOrder: 3 },
      { code: 'B:EXPORT', parent: 'B:VIEW', type: 'FUNCTION', sortOrder: 4 },
      { code: 'C:VIEW', parent: null, type: 'MENU', sortOrder: 5 },
    ]);
  });

  it('prefers the page of the same area when a code is mentioned on several pages', () => {
    const spec = table([
      '| m | 页 `/a` | `A:VIEW` | `GET /a` |',
      '| | 页 `/b` | `B:VIEW`（导出需 `A:EDIT`） | `GET /b` |',
      '| | 页 `/a2` | `A:VIEW` | `PUT /a`（`A:EDIT`） |',
    ]);
    const nodes = permissionTreeFromSpec(spec, ['A:VIEW', 'B:VIEW', 'A:EDIT']);
    expect(nodes.find((n) => n.code === 'A:EDIT')?.parent).toBe('A:VIEW');
  });

  it('does not take a row without a page route as a page', () => {
    const spec = table([
      '| m | 页 `/a` | `A:VIEW`（导出需 `A:EXPORT`） | x |',
      '| | 导出 | `A:EXPORT` | `/export` |',
    ]);
    const nodes = permissionTreeFromSpec(spec, ['A:VIEW', 'A:EXPORT']);
    expect(nodes.find((n) => n.code === 'A:EXPORT')).toMatchObject({
      type: 'FUNCTION',
      parent: 'A:VIEW',
    });
  });

  it('falls back to a page of the same area, and fails when there is none', () => {
    const spec = table(['| m | 页 `/a` | `A:VIEW` | x |']);
    expect(
      permissionTreeFromSpec(spec, ['A:VIEW', 'A:ROLE']).find((n) => n.code === 'A:ROLE')?.parent,
    ).toBe('A:VIEW');
    expect(() => permissionTreeFromSpec(spec, ['A:VIEW', 'Z:ONLY'])).toThrow(/Z:ONLY/);
  });

  it('ignores words that are not in the code list', () => {
    const spec = table(['| m | 页 `/a` | `A:VIEW`（另需 `X:OTHER`） | x |']);
    expect(permissionTreeFromSpec(spec, ['A:VIEW']).map((n) => n.code)).toEqual(['A:VIEW']);
    expect(codes.length).toBe(6);
  });
});

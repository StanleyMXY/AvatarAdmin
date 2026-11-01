import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { render } from '@testing-library/react';
import { Table } from 'antd';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { ACTIONS_COLUMN } from './actionsColumn';

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name.startsWith('.') ? [] : files(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });

const propName = (property: ts.ObjectLiteralElementLike) =>
  ts.isPropertyAssignment(property) ? property.name.getText() : undefined;

/** Whether an object literal is the definition of a table column that holds the actions of a row. */
function isActionsColumn(object: ts.ObjectLiteralExpression): boolean {
  return object.properties.some((property) => {
    if (!ts.isPropertyAssignment(property)) return false;
    const value = property.initializer.getText();
    switch (propName(property)) {
      case 'key':
        return /^['"]actions?['"]$/.test(value);
      case 'valueType':
        return /^['"]option['"]$/.test(value);
      case 'title':
        return /^t\(\s*['"][\w.]+\.actions['"]/.test(value);
      case 'render':
        return /<RowActions[\s>]/.test(value);
      default:
        return false;
    }
  });
}

type Found = { where: string; shared: boolean };

function actionsColumnsOf(file: string): Found[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: Found[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node) && isActionsColumn(node)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      found.push({
        where: `${relative('.', file)}:${line}`,
        shared: node.properties.some(
          (property) =>
            ts.isSpreadAssignment(property) && property.expression.getText() === 'ACTIONS_COLUMN',
        ),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

// The pages of the system management are changed by other work at the moment; they follow once
// that is finished (roles and admins already pin the column, permissions does not yet).
const LATER = new Set([
  'src/pages/system/admins.tsx',
  'src/pages/system/permissions.tsx',
  'src/pages/system/roles.tsx',
]);

describe('the actions column of a table', () => {
  it('stays at the right edge when the table scrolls sideways (Ant Design needs scroll.x for it)', () => {
    const { container } = render(
      <Table
        rowKey="id"
        scroll={{ x: 'max-content' }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { ...ACTIONS_COLUMN, title: 'Actions', render: () => 'edit' },
        ]}
        dataSource={[{ id: 1, name: 'a' }]}
      />,
    );
    const header = [...container.querySelectorAll('th')].find((th) => th.textContent === 'Actions');
    expect(header?.className).toContain('ant-table-cell-fix-end');
    const cell = [...container.querySelectorAll('td')].find((td) => td.textContent === 'edit');
    expect(cell?.className).toContain('ant-table-cell-fix-end');
  });

  it('is defined once: every column of actions in the pages is built from it', () => {
    const all = files('src').flatMap(actionsColumnsOf);
    // The scan must still see the columns (a guard against a scan that finds nothing).
    expect(all.length).toBeGreaterThanOrEqual(30);
    const missing = all
      .filter((found) => !found.shared && !LATER.has(found.where.replace(/:\d+$/, '')))
      .map((found) => found.where);
    expect(missing).toEqual([]);
  });
});

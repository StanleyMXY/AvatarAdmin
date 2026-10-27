import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { permissionNodes } from '../../../mock/_core/permissions';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub } from '../../../tests/stubs/umi-max';
import { PERMISSION_CODES } from '../../access/permissionCodes';
import type { PermissionNode } from '../../services/system';
import { PermissionTreeSelect } from './PermissionTreeSelect';

beforeEach(() => resetUmiStub());

const node = (
  code: string,
  parent: string | null,
  over: Partial<PermissionNode> = {},
): PermissionNode => ({
  code,
  parent,
  type: parent === null ? 'MENU' : 'FUNCTION',
  sortOrder: 0,
  nameZh: `${code} 中文`,
  nameEn: `${code} english`,
  builtin: true,
  ...over,
});

const nodes: PermissionNode[] = [
  node('USER:VIEW', null, { sortOrder: 1, nameZh: '查看用户', nameEn: 'View users' }),
  node('USER:BAN', 'USER:VIEW', { sortOrder: 2, nameZh: '封禁', nameEn: 'Ban' }),
  node('USER:EXPORT', 'USER:VIEW', { sortOrder: 3, nameZh: null as never, nameEn: 'Export users' }),
  node('STATS:VIEW', null, { sortOrder: 4, nameZh: '查看统计', nameEn: null as never }),
  node('CUSTOM:G', null, { sortOrder: 5, builtin: false, nameZh: ' ', nameEn: '' }),
];

/** A controlled wrapper, as a form uses the component. */
function Harness({
  initial = [],
  onValue,
  list = nodes,
}: {
  initial?: string[];
  onValue?: (value: string[]) => void;
  list?: PermissionNode[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <PermissionTreeSelect
      nodes={list}
      value={value}
      onChange={(next) => {
        onValue?.(next);
        setValue(next);
      }}
    />
  );
}

const box = (name: string | RegExp) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
const wrapperOf = (name: string | RegExp) =>
  box(name).closest('.ant-checkbox-wrapper') as HTMLElement;
const half = (name: string | RegExp) =>
  wrapperOf(name).querySelector('.ant-checkbox-indeterminate') !== null;

describe('PermissionTreeSelect', () => {
  it('draws every node with a check box, the children under their parent, with the code', () => {
    renderPage(<Harness />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);
    expect(box(/View users/)).not.toBeChecked();
    expect(screen.getByText('USER:BAN')).toBeInTheDocument();
  });

  it('checks the parent together with all its descendants, and gives the complete list', () => {
    const seen = vi.fn();
    renderPage(<Harness onValue={seen} />);
    fireEvent.click(box(/View users/));
    expect(seen).toHaveBeenLastCalledWith(['USER:BAN', 'USER:EXPORT', 'USER:VIEW']);
    expect(box(/View users/)).toBeChecked();
    expect(box(/Ban/)).toBeChecked();
    expect(box(/Export users/)).toBeChecked();
  });

  it('keeps the code of the parent when one descendant is unchecked: the role keeps the page and the rest of its functions', () => {
    const seen = vi.fn();
    renderPage(<Harness initial={['USER:BAN', 'USER:EXPORT', 'USER:VIEW']} onValue={seen} />);
    expect(box(/View users/)).toBeChecked();
    fireEvent.click(box(/Ban/));
    expect(seen).toHaveBeenLastCalledWith(['USER:EXPORT', 'USER:VIEW']);
    expect(box(/View users/)).toBeChecked();
    expect(half(/View users/)).toBe(false);
    expect(box(/Ban/)).not.toBeChecked();
    expect(box(/Export users/)).toBeChecked();
  });

  it('does not take the page code of a role that holds the page and one function when that function is unchecked', () => {
    const seen = vi.fn();
    renderPage(<Harness initial={['USER:BAN', 'USER:VIEW']} onValue={seen} />);
    fireEvent.click(box(/Ban/));
    expect(seen).toHaveBeenLastCalledWith(['USER:VIEW']);
    expect(box(/View users/)).toBeChecked();
  });

  it('takes the page code and everything below it away when the page itself is unchecked', () => {
    const seen = vi.fn();
    renderPage(<Harness initial={['USER:BAN', 'USER:VIEW']} onValue={seen} />);
    fireEvent.click(box(/View users/));
    expect(seen).toHaveBeenLastCalledWith([]);
  });

  it('shows a parent with only some descendants chosen as half checked', () => {
    renderPage(<Harness initial={['USER:BAN']} />);
    expect(half(/View users/)).toBe(true);
    expect(half(/Ban/)).toBe(false);
    expect(half(/STATS:VIEW/)).toBe(false);
  });

  it('checks a parent again when its last missing descendant is checked', () => {
    const seen = vi.fn();
    renderPage(<Harness initial={['USER:BAN']} onValue={seen} />);
    fireEvent.click(box(/Export users/));
    expect(seen).toHaveBeenLastCalledWith(['USER:BAN', 'USER:EXPORT', 'USER:VIEW']);
  });

  it('shows what the value holds and nothing more: a parent alone does not check its children', () => {
    renderPage(<Harness initial={['USER:VIEW']} />);
    expect(box(/View users/)).toBeChecked();
    expect(box(/Ban/)).not.toBeChecked();
  });

  it('names the nodes by the interface language, then the other language, then the code', () => {
    renderPage(<Harness />, 'zh-CN');
    expect(screen.getByRole('checkbox', { name: /查看用户/ })).toBeInTheDocument();
    // no Chinese name: the English one; no English name: the Chinese one (in the English interface below)
    expect(screen.getByRole('checkbox', { name: /Export users/ })).toBeInTheDocument();
    // neither name: the code
    expect(screen.getByRole('checkbox', { name: /^CUSTOM:G\s+CUSTOM:G$/ })).toBeInTheDocument();
  });

  it('falls back to the Chinese name in the English interface when the English one is missing', () => {
    renderPage(<Harness />);
    expect(screen.getByRole('checkbox', { name: /查看统计/ })).toBeInTheDocument();
  });

  it('cannot choose a built-in node whose code the application does not know, and drops it from the value', () => {
    const seen = vi.fn();
    const list = [
      ...nodes,
      node('FUTURE:PAGE', null, { nameEn: 'A page from the future', nameZh: '未来页面' }),
    ];
    renderPage(<Harness list={list} initial={['FUTURE:PAGE', 'STATS:VIEW']} onValue={seen} />);
    expect(box(/A page from the future/)).toBeDisabled();
    expect(box(/A page from the future/)).not.toBeChecked();
    fireEvent.click(box(/Export users/));
    expect(seen).toHaveBeenLastCalledWith(['STATS:VIEW', 'USER:EXPORT']);
  });

  it('cannot choose a custom node: its box is disabled and a click changes nothing', () => {
    const seen = vi.fn();
    renderPage(<Harness onValue={seen} />);
    expect(screen.getByRole('checkbox', { name: /CUSTOM:G/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /CUSTOM:G/ }));
    expect(seen).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: /CUSTOM:G/ })).not.toBeChecked();
  });

  it('does not check a custom node below a parent that is checked', () => {
    const seen = vi.fn();
    const list = [...nodes, node('CUSTOM:UNDER', 'USER:VIEW', { builtin: false })];
    renderPage(<Harness list={list} onValue={seen} />);
    fireEvent.click(box(/View users/));
    expect(seen).toHaveBeenLastCalledWith(['USER:BAN', 'USER:EXPORT', 'USER:VIEW']);
    expect(screen.getByRole('checkbox', { name: /CUSTOM:UNDER/ })).not.toBeChecked();
  });

  it('draws the whole built-in tree: every code of the real list once, and only codes of it can end up in the value', () => {
    const seen = vi.fn();
    renderPage(<Harness list={permissionNodes()} onValue={seen} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(PERMISSION_CODES.length);
    const first = screen.getAllByRole('checkbox')[0];
    fireEvent.click(first);
    const value = seen.mock.calls.at(-1)?.[0] as string[];
    expect(value.length).toBeGreaterThan(0);
    for (const code of value) expect(PERMISSION_CODES as readonly string[]).toContain(code);
  });

  it('can be disabled as a whole', () => {
    renderPage(<PermissionTreeSelect nodes={nodes} value={[]} onChange={() => {}} disabled />);
    for (const checkbox of screen.getAllByRole('checkbox')) expect(checkbox).toBeDisabled();
  });

  it('wraps a name without spaces and a name in Thai, Arabic or with emoji, and does not widen its box', () => {
    const long = 'ก'.repeat(300);
    const list = [
      node('A:ONE', null, { nameEn: long, nameZh: long }),
      node('A:TWO', null, {
        nameEn: `مدير النظام ${String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467)}`,
        nameZh: 'x',
      }),
      node('A:THREE', null, { nameEn: 'Z'.repeat(5000), nameZh: 'y' }),
    ];
    renderPage(<Harness list={list} />);
    const label = within(wrapperOf(/ก{300}/)).getByText(long);
    expect(label.style.overflowWrap).toBe('anywhere');
    expect(label.getAttribute('dir')).toBe('auto');
    expect(screen.getByText('Z'.repeat(5000))).toBeInTheDocument();
  });
});

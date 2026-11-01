import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { ApiError } from '../request/errors';
import { DangerConfirmButton } from './DangerConfirmButton';
import { EllipsisPopoverText } from './EllipsisPopoverText';
import { JsonField } from './JsonField';
import { LinkInput } from './LinkInput';
import { PagedListTable } from './PagedListTable';
import { RowActions } from './RowActions';
import { StatusTag } from './StatusTag';

function Box({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  return <JsonField value={text} onChange={setText} />;
}

// The shared components are checked with the texts of the Chinese language file, and with data in
// the scripts the product is used in (the page texts are English or Chinese; the data is anything).
const DATA = [
  'สมชาย ใจดี',
  'محمد علي',
  'Nguyễn Văn A',
  'Siti Aminah',
  'José Núñez',
  '张伟',
  'Alice',
];

describe('shared components in Chinese', () => {
  it('RowActions: "更多" for the rest of four actions, and a question in Chinese before a dangerous one', async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    renderPage(
      <RowActions
        actions={[
          { key: 'a', label: '查看', onClick: vi.fn() },
          { key: 'b', label: '编辑', onClick: vi.fn() },
          { key: 'c', label: '停用', onClick: vi.fn() },
          { key: 'd', label: '删除', onClick: remove, confirmText: '确定删除这条记录吗？' },
        ]}
      />,
      'zh-CN',
    );
    await user.click(screen.getByRole('button', { name: '更多' }));
    fireEvent.click(await screen.findByText('删除'));
    expect((await screen.findAllByText('确定删除这条记录吗？')).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: /^(确\s?定)$/ }));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  });

  it('DangerConfirmButton: the buttons of the question are 确定 and 取消', async () => {
    const user = userEvent.setup();
    renderPage(
      <DangerConfirmButton confirmText="确定撤销吗？" onConfirm={async () => {}}>
        撤销
      </DangerConfirmButton>,
      'zh-CN',
    );
    await user.click(screen.getByRole('button', { name: '撤销' }));
    expect(await screen.findByText('确定撤销吗？')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^取\s?消$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^确\s?定$/ })).toBeInTheDocument();
  });

  it('PagedListTable: the failure reads "加载失败：…" with "重试", and the rows are names in seven scripts', async () => {
    let fail = true;
    const request = vi.fn(async () => {
      if (fail) {
        throw new ApiError({
          code: 'DEPENDENCY_UNAVAILABLE',
          httpStatus: 503,
          message: 'x',
          data: null,
        });
      }
      return { items: DATA.map((name, i) => ({ id: String(i), name })), total: DATA.length };
    });
    const user = userEvent.setup();
    renderPage(
      <PagedListTable<{ id: string; name: string }>
        rowKey="id"
        columns={[{ title: '姓名', dataIndex: 'name' }]}
        request={request}
      />,
      'zh-CN',
    );
    expect(await screen.findByText(/^加载失败：/)).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: /^重\s?试$/ }));
    for (const name of DATA) expect(await screen.findByText(name)).toBeInTheDocument();
    expect(screen.queryByText(/^加载失败：/)).toBeNull();
  });

  it.each(DATA)(
    'EllipsisPopoverText: "查看全文" opens the whole text of %s, with a "复制" button',
    async (text) => {
      const user = userEvent.setup();
      renderPage(<EllipsisPopoverText text={text} />, 'zh-CN');
      await user.click(screen.getByTitle('查看全文'));
      expect((await screen.findByTestId('full-text')).textContent).toBe(text);
      expect(screen.getByRole('button', { name: /^复\s?制$/ })).toBeInTheDocument();
    },
  );

  it('JsonField: says "JSON 格式不对" for text that is not JSON, and accepts JSON in every script', () => {
    const { unmount } = renderPage(<Box initial="{" />, 'zh-CN');
    expect(screen.getByRole('alert')).toHaveTextContent('JSON 格式不对');
    unmount();
    renderPage(<Box initial={JSON.stringify({ names: DATA })} />, 'zh-CN');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('LinkInput: names the fault of the link in Chinese', async () => {
    const user = userEvent.setup();
    renderPage(<LinkInput required value="" onChange={() => {}} />, 'zh-CN');
    const box = screen.getByRole('textbox');
    await user.type(box, 'x');
    fireEvent.blur(box);
    expect(await screen.findByText('链接必须以小写的 https:// 开头')).toBeInTheDocument();
  });

  it('StatusTag: a status in Thai, Arabic or Vietnamese is shown as it is', () => {
    const { unmount } = renderPage(<StatusTag status="ใช้งานอยู่" options={{}} />, 'zh-CN');
    expect(screen.getByText('ใช้งานอยู่')).toBeInTheDocument();
    unmount();
    renderPage(<StatusTag status="نشط" options={{ نشط: { label: 'Hoạt động' } }} />, 'zh-CN');
    expect(screen.getByText('Hoạt động')).toBeInTheDocument();
  });
});

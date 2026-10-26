import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { type RowAction, RowActions } from './RowActions';

const make = (n: number, extra: Partial<RowAction> = {}): RowAction[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `a${i + 1}`,
    label: `Action ${i + 1}`,
    onClick: vi.fn(),
    ...(i === n - 1 ? extra : {}),
  }));

describe('RowActions', () => {
  it('shows all of three actions and no "More"', () => {
    renderPage(<RowActions actions={make(3)} />);
    for (const label of ['Action 1', 'Action 2', 'Action 3']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('shows the first two of four and puts the rest under "More"', async () => {
    const user = userEvent.setup();
    renderPage(<RowActions actions={make(4)} />);
    expect(screen.getByRole('button', { name: 'Action 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Action 3' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'More' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Action 3')).toBeInTheDocument();
    expect(within(menu).getByText('Action 4')).toBeInTheDocument();
  });

  it('shows nothing for no actions', () => {
    const { container } = renderPage(<RowActions actions={[]} />);
    expect(container.textContent).toBe('');
  });

  it('calls an action when its button is pressed, once however often it is pressed meanwhile', async () => {
    let release: () => void = () => {};
    const onClick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderPage(<RowActions actions={[{ key: 'a', label: 'Go', onClick }]} />);
    const button = screen.getByRole('button', { name: 'Go' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('asks inline before a dangerous action in the row', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderPage(
      <RowActions
        actions={[{ key: 'd', label: 'Delete', onClick, confirmText: 'Delete this?' }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete this?')).toBeInTheDocument();
    expect(onClick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onClick).toHaveBeenCalledTimes(1));
  });

  it('asks in a dialog before a dangerous action chosen from the menu', async () => {
    const user = userEvent.setup();
    const actions = make(4, { confirmText: 'Remove it?' });
    renderPage(<RowActions actions={actions} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(within(await screen.findByRole('menu')).getByText('Action 4'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Remove it?');
    expect(actions[3].onClick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(actions[3].onClick).toHaveBeenCalledTimes(1));
  });

  it('calls a plain action from the menu at once', async () => {
    const user = userEvent.setup();
    const actions = make(5);
    renderPage(<RowActions actions={actions} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(within(await screen.findByRole('menu')).getByText('Action 3'));
    expect(actions[2].onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call a disabled action', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderPage(<RowActions actions={[{ key: 'a', label: 'Go', onClick, disabled: true }]} />);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('survives a failing action', async () => {
    const onClick = vi.fn(async () => {
      throw new Error('boom');
    });
    renderPage(<RowActions actions={[{ key: 'a', label: 'Go', onClick }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(onClick).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Go' })).not.toBeDisabled());
  });

  it('runs an action from the menu once when it is chosen twice while it runs', async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const slow = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const actions: RowAction[] = [...make(3), { key: 'slow', label: 'Slow one', onClick: slow }];
    renderPage(<RowActions actions={actions} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    const item = within(await screen.findByRole('menu')).getByText('Slow one');
    fireEvent.click(item);
    fireEvent.click(item);
    expect(slow).toHaveBeenCalledTimes(1);
    release();
  });

  it('shows a dangerous action in the menu in red, and a disabled one as disabled and not callable', async () => {
    const user = userEvent.setup();
    const off = vi.fn();
    const actions: RowAction[] = [
      ...make(2),
      { key: 'danger', label: 'Remove', onClick: vi.fn(), confirmText: 'Sure?' },
      { key: 'off', label: 'Off one', onClick: off, disabled: true },
    ];
    renderPage(<RowActions actions={actions} />);
    await user.click(screen.getByRole('button', { name: 'More' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Remove').closest('li')?.className).toContain(
      'ant-dropdown-menu-item-danger',
    );
    const disabled = within(menu).getByText('Off one').closest('li') as HTMLElement;
    expect(disabled.className).toContain('ant-dropdown-menu-item-disabled');
    fireEvent.click(disabled);
    expect(off).not.toHaveBeenCalled();
  });

  it('does not call a disabled action that asks first', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    renderPage(
      <RowActions
        actions={[{ key: 'd', label: 'Del', onClick, confirmText: 'Sure?', disabled: true }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Del' }));
    expect(screen.queryByText('Sure?')).toBeNull();
    expect(onClick).not.toHaveBeenCalled();
  });
});

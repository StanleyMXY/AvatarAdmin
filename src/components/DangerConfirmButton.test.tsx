import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { DangerConfirmButton } from './DangerConfirmButton';

describe('DangerConfirmButton', () => {
  it('asks first and does nothing until it is confirmed', async () => {
    const onConfirm = vi.fn(async () => {});
    const user = userEvent.setup();
    renderPage(
      <DangerConfirmButton confirmText="Delete this rule?" onConfirm={onConfirm}>
        Delete
      </DangerConfirmButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete this rule?')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('calls the action once when the confirm button is pressed twice', async () => {
    let release: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    renderPage(
      <DangerConfirmButton confirmText="Cancel the task?" onConfirm={onConfirm}>
        Cancel task
      </DangerConfirmButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel task' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    fireEvent.click(ok);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(screen.queryByText('Cancel the task?')).not.toBeVisible());
  });

  it('is usable again, without an unhandled error, after a failed action', async () => {
    const onConfirm = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderPage(
      <DangerConfirmButton confirmText="Retry the job?" onConfirm={onConfirm}>
        Retry
      </DangerConfirmButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).not.toBeDisabled());
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    renderPage(
      <DangerConfirmButton confirmText="Sure?" onConfirm={async () => {}} disabled>
        Delete
      </DangerConfirmButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByText('Sure?')).toBeNull();
  });

  it('shows the confirm button in the danger colour and disables it while the action runs', async () => {
    let release: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const user = userEvent.setup();
    renderPage(
      <DangerConfirmButton confirmText="Sure?" onConfirm={onConfirm}>
        Delete
      </DangerConfirmButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    expect(ok.className).toContain('ant-btn-dangerous');
    fireEvent.click(ok);
    await waitFor(() => expect(screen.getByRole('button', { name: /OK/ })).toBeDisabled());
    release();
  });
});

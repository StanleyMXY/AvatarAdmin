import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { ApiError } from '../request/errors';
import { EnabledSwitch } from './EnabledSwitch';

const failure = new ApiError({
  code: 'INTERNAL_ERROR',
  httpStatus: 500,
  message: 'raw backend words',
  data: null,
});

describe('EnabledSwitch', () => {
  it('sends the new state once, then tells the page to read the row again', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    const onDone = vi.fn();
    renderPage(<EnabledSwitch checked={false} label="Row 1" onToggle={onToggle} onDone={onDone} />);
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Row 1' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('sends one request however often it is pressed while the first is on its way', async () => {
    let release: () => void = () => {};
    const onToggle = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const onDone = vi.fn();
    renderPage(<EnabledSwitch checked label="Row 1" onToggle={onToggle} onDone={onDone} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('switch', { name: 'Row 1' }));
    await user.click(screen.getByRole('switch', { name: 'Row 1' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    release();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  });

  it('shows the words of the error code and not the backend words, and still reads the row again', async () => {
    const onDone = vi.fn();
    renderPage(
      <EnabledSwitch
        checked
        label="Row 1"
        onToggle={() => Promise.reject(failure)}
        onDone={onDone}
      />,
    );
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Row 1' }));
    expect(await screen.findByText('Server error. Please try again later.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('raw backend words');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('uses the words the page gives for a failure, with the state that was asked for', async () => {
    renderPage(
      <EnabledSwitch
        checked
        label="Row 1"
        onToggle={() => Promise.reject(failure)}
        failureText={(_, enabled) => `could not turn it ${enabled ? 'on' : 'off'}`}
        onDone={() => {}}
      />,
    );
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Row 1' }));
    expect(await screen.findByText('could not turn it off')).toBeInTheDocument();
  });

  it('cannot be pressed when it is disabled', async () => {
    const onToggle = vi.fn();
    renderPage(
      <EnabledSwitch checked label="Row 1" disabled onToggle={onToggle} onDone={() => {}} />,
    );
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Row 1' }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('shows the loading state of the switch while the request is on its way, and takes it away after', async () => {
    let release: () => void = () => {};
    const onToggle = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const onDone = vi.fn();
    renderPage(<EnabledSwitch checked label="Row 1" onToggle={onToggle} onDone={onDone} />);
    const loading = () => document.querySelector('.ant-switch-loading');
    expect(loading()).toBeNull();
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Row 1' }));
    expect(loading()).not.toBeNull();
    release();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loading()).toBeNull());
  });
});

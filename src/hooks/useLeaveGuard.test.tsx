import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { hasUnsavedChanges, releaseLeaveGuards, useLeaveGuard } from './useLeaveGuard';

type Blocker = (tx: { action: string; retry: () => void }) => void;
const blocking = vi.hoisted(() => ({
  blocker: null as null | ((tx: { action: string; retry: () => void }) => void),
  unblock: vi.fn(),
  block: vi.fn(),
}));

vi.mock('@umijs/max', async () => {
  const stub = await import('../../tests/stubs/umi-max');
  return {
    ...stub,
    history: {
      ...stub.history,
      block: (blocker: Blocker) => {
        blocking.block();
        blocking.blocker = blocker;
        return blocking.unblock;
      },
    },
  };
});

function Probe({ active }: { active: boolean }) {
  useLeaveGuard(active);
  return <span>page</span>;
}

// A page whose unsaved changes are saved with a button.
function Saves() {
  const [dirty, setDirty] = useState(true);
  useLeaveGuard(dirty);
  return (
    <button type="button" onClick={() => setDirty(false)}>
      save
    </button>
  );
}

beforeEach(() => {
  blocking.blocker = null;
  blocking.unblock.mockClear();
  blocking.block.mockClear();
});
afterEach(() => vi.restoreAllMocks());

const unload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
};

describe('useLeaveGuard', () => {
  it('is on while active and off again when the changes are saved or the page goes away', () => {
    const view = renderPage(<Probe active />);
    expect(unload()).toBe(true);
    expect(blocking.block).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(unload()).toBe(false);
    expect(blocking.unblock).toHaveBeenCalledTimes(1);
  });

  it('lets go of the page as soon as the changes are saved', () => {
    renderPage(<Saves />);
    expect(unload()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(unload()).toBe(false);
    expect(blocking.unblock).toHaveBeenCalledTimes(1);
  });

  it('does not hold the page when nothing is unsaved', () => {
    renderPage(<Probe active={false} />);
    expect(unload()).toBe(false);
    expect(blocking.block).not.toHaveBeenCalled();
  });

  it('asks before a move inside the app, lets it go on after "Leave", and stays after "Stay"', async () => {
    renderPage(<Probe active />);
    const retry = vi.fn();
    act(() => blocking.blocker?.({ action: 'PUSH', retry }));
    expect(await screen.findByRole('dialog', { name: 'Leave this page?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(retry).not.toHaveBeenCalled();
    expect(blocking.unblock).not.toHaveBeenCalled();

    act(() => blocking.blocker?.({ action: 'PUSH', retry }));
    // happy-dom never removes the dialog that was answered "Stay"; the new one is the last
    const leave = await screen.findAllByRole('button', { name: 'Leave' });
    fireEvent.click(leave[leave.length - 1]);
    await waitFor(() => expect(retry).toHaveBeenCalledTimes(1));
    expect(blocking.unblock).toHaveBeenCalledTimes(1);
  });

  it('asks once when the move is tried again while the question is open', async () => {
    renderPage(<Probe active />);
    const retry = vi.fn();
    act(() => blocking.blocker?.({ action: 'PUSH', retry }));
    act(() => blocking.blocker?.({ action: 'PUSH', retry }));
    await screen.findByRole('dialog', { name: 'Leave this page?' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('asks in Chinese when the language is Chinese', async () => {
    renderPage(<Probe active />, 'zh-CN');
    act(() => blocking.blocker?.({ action: 'PUSH', retry: vi.fn() }));
    expect(await screen.findByRole('dialog', { name: '离开这个页面？' })).toBeInTheDocument();
  });
});

describe('the record of pages with unsaved changes', () => {
  it('knows that a page holds changes while the guard is on, and no longer once it is off or the page is gone', () => {
    expect(hasUnsavedChanges()).toBe(false);
    const view = renderPage(<Saves />);
    expect(hasUnsavedChanges()).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'save' }));
    expect(hasUnsavedChanges()).toBe(false);
    view.unmount();
    const other = renderPage(<Probe active />);
    expect(hasUnsavedChanges()).toBe(true);
    other.unmount();
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('lets go of the page for a move the person has agreed to already, without asking again', () => {
    renderPage(<Probe active />);
    releaseLeaveGuards();
    expect(blocking.unblock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no page holds changes', () => {
    renderPage(<Probe active={false} />);
    releaseLeaveGuards();
    expect(blocking.unblock).not.toHaveBeenCalled();
  });
});

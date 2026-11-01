import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { useRead } from './useRead';

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
const deferred = <T,>(): Deferred<T> => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** A page that reads the numbers of one range; the button asks for the other range. */
function Probe({ fetchers }: { fetchers: Record<string, () => Promise<string>> }) {
  const [range, setRange] = useState('a');
  const fetcher = useCallback(() => fetchers[range](), [range, fetchers]);
  const { data, failure, loading } = useRead(fetcher);
  return (
    <div>
      <button type="button" onClick={() => setRange('b')}>
        other range
      </button>
      <span data-testid="data">{data ?? ''}</span>
      <span data-testid="failure">{failure ?? ''}</span>
      <span data-testid="loading">{String(loading)}</span>
    </div>
  );
}

const shown = (id: string) => screen.getByTestId(id).textContent;

describe('useRead: only the answer of the newest read counts', () => {
  it('drops an answer that arrives after a newer read was started', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    renderPage(<Probe fetchers={{ a: () => slow.promise, b: () => fast.promise }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'other range' }));
    await act(async () => fast.resolve('new range'));
    await waitFor(() => expect(shown('data')).toBe('new range'));
    await act(async () => slow.resolve('old range'));
    expect(shown('data')).toBe('new range');
    expect(shown('loading')).toBe('false');
  });

  it('drops the failure of a read that was overtaken, so it does not hide the newer answer', async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    renderPage(<Probe fetchers={{ a: () => slow.promise, b: () => fast.promise }} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'other range' }));
    await act(async () => fast.resolve('new range'));
    await waitFor(() => expect(shown('data')).toBe('new range'));
    await act(async () => slow.reject(new Error('late')));
    expect(shown('failure')).toBe('');
    expect(shown('data')).toBe('new range');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { loadAllPages } from './loadAll';

const rowsOf = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ id: from + i }));

describe('loadAllPages: reads page after page until the total is reached', () => {
  it('reads one page when the total fits in it', async () => {
    const fetchPage = vi.fn(async () => ({ items: rowsOf(3), total: 3 }));
    const all = await loadAllPages(fetchPage);
    expect(all.items).toHaveLength(3);
    expect(all.complete).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ page: 1, pageSize: 200 });
  });

  it('reads the pages in order and joins them', async () => {
    const fetchPage = vi.fn(async ({ page }: { page: number }) => ({
      items: rowsOf(page < 3 ? 200 : 50, (page - 1) * 200),
      total: 450,
    }));
    const all = await loadAllPages(fetchPage);
    expect(all.items).toHaveLength(450);
    expect(all.items[449]).toEqual({ id: 449 });
    expect(all.complete).toBe(true);
    expect(fetchPage.mock.calls.map((c) => c[0].page)).toEqual([1, 2, 3]);
  });

  it('stops on an empty page even when the total says there is more, and says it is not complete', async () => {
    const fetchPage = vi.fn(async ({ page }: { page: number }) => ({
      items: page === 1 ? rowsOf(2) : [],
      total: 10,
    }));
    const all = await loadAllPages(fetchPage);
    expect(all.items).toHaveLength(2);
    expect(all.complete).toBe(false);
  });

  it('does not read for ever: it stops after 50 pages', async () => {
    const fetchPage = vi.fn(async ({ page }: { page: number }) => ({
      items: rowsOf(1, page),
      total: 1_000_000,
    }));
    const all = await loadAllPages(fetchPage, 1);
    expect(fetchPage).toHaveBeenCalledTimes(50);
    expect(all.complete).toBe(false);
  });

  it('passes a failure on', async () => {
    await expect(
      loadAllPages(async () => {
        throw new Error('x');
      }),
    ).rejects.toThrow('x');
  });
});

import type { Page } from '../../request/errors';

const MAX_PAGES = 50;

/**
 * Reads a list page after page until all of it is here (the price tables group by model, so a
 * model's batches must not be split over pages). It stops after an empty page or after 50 pages;
 * `complete` says whether everything the backend counted was read.
 */
export async function loadAllPages<T>(
  fetchPage: (paging: { page: number; pageSize: number }) => Promise<Page<T>>,
  pageSize = 200,
): Promise<{ items: T[]; total: number; complete: boolean }> {
  const items: T[] = [];
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const answer = await fetchPage({ page, pageSize });
    total = answer.total;
    if (answer.items.length === 0) break;
    items.push(...answer.items);
    if (items.length >= total) break;
  }
  return { items, total, complete: items.length >= total };
}

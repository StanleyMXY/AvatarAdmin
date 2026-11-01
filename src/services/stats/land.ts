import { apiRequest } from '../../request/apiClient';
import type { LandName } from './types';

/** What a re-landing says besides "done". */
export type LandResult = {
  /**
   * `ad-daily` of a day older than the last 7 UTC days (contract 22.8): only the daily summary was
   * computed again, the table of the reasons for no ad was left as it was.
   */
  nofillSkipped: boolean;
};

/** `POST /stats/land/{name}?date=`: recompute one UTC day of a summary table (needs `STATS:LAND`). */
export async function landStat(name: LandName, date: string): Promise<LandResult> {
  const data = await apiRequest<unknown>({
    method: 'POST',
    url: `/stats/land/${encodeURIComponent(name)}`,
    params: { date },
  });
  const flag = (data as { nofillSkipped?: unknown } | null | undefined)?.nofillSkipped;
  return { nofillSkipped: flag === true };
}

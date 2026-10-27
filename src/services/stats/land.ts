import { apiRequest } from '../../request/apiClient';
import type { LandName } from './types';

/** `POST /stats/land/{name}?date=`: recompute one UTC day of a summary table (needs `STATS:LAND`). */
export async function landStat(name: LandName, date: string): Promise<void> {
  await apiRequest<unknown>({
    method: 'POST',
    url: `/stats/land/${encodeURIComponent(name)}`,
    params: { date },
  });
}

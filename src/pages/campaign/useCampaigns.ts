import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLatestCall } from '../../hooks/useLatestCall';
import { ApiError } from '../../request/errors';
import { type AttributionCampaign, listAllCampaigns } from '../../services/campaign';

export type CampaignList = {
  /** `forbidden`: the administrator may not read the list; `failed`: any other failure. */
  status: 'loading' | 'ready' | 'forbidden' | 'failed';
  rows: AttributionCampaign[];
  /** The campaign with this id, if the list is there and has it. */
  byId: (id: unknown) => AttributionCampaign | undefined;
  reload: () => void;
};

/**
 * Every campaign, for the dropdown of a filter and for the name beside an id. The list is open to
 * `ATTRIBUTION:VIEW` as well; an administrator who is refused (403) gets `forbidden`, so that the
 * filter can say which permission is missing. The newest read wins.
 */
export function useCampaigns(): CampaignList {
  const [state, setState] = useState<{
    status: CampaignList['status'];
    rows: AttributionCampaign[];
  }>({
    status: 'loading',
    rows: [],
  });
  const begin = useLatestCall();

  const load = useCallback(() => {
    const isCurrent = begin();
    setState((before) => ({ status: 'loading', rows: before.rows }));
    listAllCampaigns()
      .then((rows) => {
        if (isCurrent()) setState({ status: 'ready', rows });
      })
      .catch((error) => {
        if (!isCurrent()) return;
        const forbidden = error instanceof ApiError && error.httpStatus === 403;
        setState({ status: forbidden ? 'forbidden' : 'failed', rows: [] });
      });
  }, [begin]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useCallback(
    (id: unknown) =>
      typeof id === 'string' || typeof id === 'number'
        ? state.rows.find((row) => row.id === String(id))
        : undefined,
    [state.rows],
  );
  return useMemo(() => ({ ...state, byId, reload: load }), [state, byId, load]);
}

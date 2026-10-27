import { Link, useIntl } from '@umijs/max';
import { Alert } from 'antd';
import { useEffect, useState } from 'react';
import { listAlerts } from '../../services/monitor';
import { DASH } from '../../utils/ratio';

const count = async (type: string): Promise<string> => {
  try {
    const { total } = await listAlerts({ status: 'OPEN', type, page: 1, pageSize: 1 });
    return Number.isFinite(total) && total >= 0 ? String(total) : DASH;
  } catch {
    return DASH;
  }
};

/**
 * The number of open alerts of the two kinds this page can fix (a model without a price, a failed LLM
 * price sync), linking to the alert page. Only for an administrator who holds `MONITOR:VIEW` and
 * `COST:PRICE` (the caller checks); a count that cannot be read is a dash.
 */
export function AlertsLine() {
  const intl = useIntl();
  const [counts, setCounts] = useState<{ missing: string; sync: string } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([count('USAGE_PRICE_MISSING'), count('LLM_PRICE_SYNC_FAILED')]).then(
      ([missing, sync]) => {
        if (alive) setCounts({ missing, sync });
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  if (!counts) return null;
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="cost-alerts"
      title={
        <>
          {intl.formatMessage({ id: 'cost.prices.alerts' }, counts)}{' '}
          <Link to="/monitor/alerts">{intl.formatMessage({ id: 'cost.prices.alerts.link' })}</Link>
        </>
      }
    />
  );
}

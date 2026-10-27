import { useIntl } from '@umijs/max';
import { Tag, Tooltip } from 'antd';
import type { CSSProperties } from 'react';

type Props = { testId?: string; style?: CSSProperties };

/**
 * The mark "Provisional" beside a value of a day that is not over (UTC): the overview cards, the
 * daily report and the call quality page all use this one. The day rule is `utils/settledDay.ts`.
 */
export function ProvisionalTag({ testId, style }: Props) {
  const intl = useIntl();
  return (
    <span data-testid={testId}>
      <Tooltip title={intl.formatMessage({ id: 'stat.common.provisional.tip' })}>
        <Tag color="warning" style={{ marginInlineEnd: 0, ...style }}>
          {intl.formatMessage({ id: 'stat.common.provisional' })}
        </Tag>
      </Tooltip>
    </span>
  );
}

import { useIntl } from '@umijs/max';
import { Alert } from 'antd';
import { useState } from 'react';

const key = (pageKey: string) => `reportHelper:${pageKey}`;

function wasClosed(pageKey: string): boolean {
  try {
    return localStorage.getItem(key(pageKey)) === '1';
  } catch {
    return false;
  }
}

/**
 * The explanation at the top of a report (what the columns mean). It can be closed and then stays
 * closed after a reload; if storage cannot be used it is simply shown every time. The texts are
 * `stat.<pageKey>.helper.title` and `.content`; a page without them shows nothing.
 */
export function ReportHelper({ pageKey }: { pageKey: string }) {
  const intl = useIntl();
  // The closed state belongs to the page key: when the key changes on the same panel, it is read again.
  const [state, setState] = useState(() => ({ pageKey, closed: wasClosed(pageKey) }));
  let closed = state.closed;
  if (state.pageKey !== pageKey) {
    closed = wasClosed(pageKey);
    setState({ pageKey, closed });
  }
  const titleId = `stat.${pageKey}.helper.title`;
  const contentId = `stat.${pageKey}.helper.content`;
  if (closed || !intl.messages[titleId]) return null;
  return (
    <Alert
      type="info"
      showIcon
      closable={{
        onClose: () => {
          setState({ pageKey, closed: true });
          try {
            localStorage.setItem(key(pageKey), '1');
          } catch {
            // not remembered; shown again next time
          }
        },
      }}
      title={intl.formatMessage({ id: titleId })}
      description={intl.messages[contentId] ? intl.formatMessage({ id: contentId }) : undefined}
      style={{ marginBottom: 12 }}
    />
  );
}

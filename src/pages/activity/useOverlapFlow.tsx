import { useIntl } from '@umijs/max';
import { App } from 'antd';
import { useCallback } from 'react';
import {
  type ActivityBody,
  confirmActivityOverlap,
  type DisabledActivity,
  type ProbeAction,
  probeActivityOverlap,
} from '../../services/activity';
import { plainText } from '../../utils/plainText';

/** How the two steps ended: done (the backend did it), cancelled (the person said no, nothing more was sent) or failed. */
export type OverlapOutcome =
  | { kind: 'done' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: unknown };

/**
 * The list inside the question. A dialog made by `modal.confirm` is drawn outside the page's
 * providers, so this component takes its words as properties and calls no hook (the language
 * context is not there).
 */
export function OverlapNames({
  list,
  intro,
  noNames,
}: {
  list: DisabledActivity[];
  intro: string;
  noNames: string;
}) {
  if (list.length === 0) return <p>{noNames}</p>;
  return (
    <div>
      <p>{intro}</p>
      <ul style={{ paddingInlineStart: 20, margin: 0 }}>
        {list.map((item, index) => (
          // The names are any text from the backend: broken anywhere, so one long name does not widen the dialog.
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: the same activity is never listed twice, the index only separates equal ids from a faulty answer
            key={`${plainText(item.id)}-${index}`}
            dir="auto"
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {plainText(item.name)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Publishing, enabling, or changing the days of a live sign-in activity: the request first goes with
 * `confirm=false`. If nothing overlaps the backend does it and that is all. If another live activity
 * overlaps, a dialog lists the activities that would be stopped; Confirm sends the same request with
 * `confirm=true`, Cancel sends nothing more. The returned function never rejects: a failure of either
 * step comes back as `{ kind: 'failed' }` for the caller to show.
 */
export function useOverlapFlow() {
  const intl = useIntl();
  const { modal } = App.useApp();
  return useCallback(
    (action: ProbeAction, id: string, body?: ActivityBody): Promise<OverlapOutcome> =>
      new Promise<OverlapOutcome>((resolve) => {
        probeActivityOverlap(action, id, body).then(
          (overlaps) => {
            if (overlaps === null) {
              resolve({ kind: 'done' });
              return;
            }
            let sent = false;
            modal.confirm({
              title: intl.formatMessage({
                id:
                  action === 'update'
                    ? 'activity.overlap.titleSave'
                    : 'activity.overlap.titleEnable',
              }),
              content: (
                <OverlapNames
                  list={overlaps}
                  intro={intl.formatMessage({ id: 'activity.overlap.body' })}
                  noNames={intl.formatMessage({ id: 'activity.overlap.bodyNoNames' })}
                />
              ),
              okText: intl.formatMessage({ id: 'activity.overlap.confirm' }),
              cancelText: intl.formatMessage({ id: 'pages.common.cancel' }),
              onOk: async () => {
                if (sent) return;
                sent = true;
                try {
                  await confirmActivityOverlap(action, id, body);
                  resolve({ kind: 'done' });
                } catch (error) {
                  resolve({ kind: 'failed', error });
                }
              },
              onCancel: () => resolve({ kind: 'cancelled' }),
            });
          },
          (error) => resolve({ kind: 'failed', error }),
        );
      }),
    [intl, modal],
  );
}

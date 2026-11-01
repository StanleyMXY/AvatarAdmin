import { history, useIntl } from '@umijs/max';
import { Button, Card, Skeleton, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';
import { ProvisionalTag } from '../../components/stat/ProvisionalTag';
import { describeFailure } from '../../session/describe';
import { FALL_COLOR, RISE_COLOR } from '../../theme/tokens';
import type { ChangeView } from './changeText';
import { NavButton } from './NavButton';

type Props = {
  /** Names the test ids and the card: `dau`, `alerts`, ... */
  id: string;
  title: string;
  status: 'idle' | 'loading' | 'ready' | 'failed';
  error?: unknown;
  onRetry: () => void;
  /** The value already written (a dash when there is none). */
  value: string;
  /** The value is the one of today, which is still being counted. */
  temporary?: boolean;
  caption?: ReactNode;
  /** The two comparisons; a card without them (queue wait, alert count) leaves this out. */
  changes?: { yesterday: ChangeView; weekAgo: ChangeView };
  link?: { to: string; label: string };
};

// Only a change of complete days is green or red; a provisional change keeps the grey of the text.
const colourOf = (tone: ChangeView['tone']) =>
  tone === 'rise' ? RISE_COLOR : tone === 'fall' ? FALL_COLOR : undefined;

function Change({ id, label, view }: { id: string; label: string; view: ChangeView }) {
  const intl = useIntl();
  const colour = colourOf(view.tone);
  const figure = (
    <span
      data-testid={id}
      data-tone={view.tone}
      style={colour ? { color: colour } : undefined}
      // A grey change is explained in a tooltip, which a hover and the keyboard focus both open (a
      // title attribute opens for neither a finger nor a keyboard); the others need no stop.
      tabIndex={view.tone === 'provisional' ? 0 : undefined}
    >
      {view.text}
    </span>
  );
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}{' '}
        {view.tone === 'provisional' ? (
          <Tooltip
            trigger={['hover', 'focus']}
            title={intl.formatMessage({ id: 'stat.common.provisional.changeTip' })}
          >
            {figure}
          </Tooltip>
        ) : (
          figure
        )}
      </Typography.Text>
    </div>
  );
}

/** One card of the overview: a value, what is said about it, and its own loading and failure. */
export function OverviewCard({
  id,
  title,
  status,
  error,
  onRetry,
  value,
  temporary,
  caption,
  changes,
  link,
}: Props) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);

  return (
    <Card
      size="small"
      data-testid={`dashboard-card-${id}`}
      style={{ height: '100%', cursor: link ? 'pointer' : undefined }}
      onClick={
        link
          ? (event) => {
              // The link and the retry button handle their own clicks.
              if ((event.target as HTMLElement).closest('a, button')) return;
              history.push(link.to);
            }
          : undefined
      }
    >
      <Typography.Text type="secondary">{title}</Typography.Text>
      {status === 'failed' ? (
        <div data-testid={`dashboard-error-${id}`} style={{ marginTop: 8 }}>
          <Typography.Text type="danger">
            {t('dashboard.card.loadFailed', { message: describeFailure(intl, error).text })}
          </Typography.Text>{' '}
          <Button size="small" onClick={onRetry}>
            {t('pages.common.retry')}
          </Button>
        </div>
      ) : status === 'ready' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span
              data-testid={`dashboard-value-${id}`}
              style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.4 }}
            >
              {value}
            </span>
            {temporary ? <ProvisionalTag testId={`dashboard-temp-${id}`} /> : null}
          </div>
          {caption ? (
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {caption}
              </Typography.Text>
            </div>
          ) : null}
          {changes ? (
            <>
              <Change
                id={`dashboard-vs-yesterday-${id}`}
                label={t('dashboard.change.vsYesterday')}
                view={changes.yesterday}
              />
              <Change
                id={`dashboard-vs-7d-${id}`}
                label={t('dashboard.change.vs7Days')}
                view={changes.weekAgo}
              />
            </>
          ) : null}
          {link ? (
            <div style={{ marginTop: 8 }}>
              <NavButton to={link.to} type="link">
                {link.label}
              </NavButton>
            </div>
          ) : null}
        </>
      ) : (
        <Skeleton active title={false} paragraph={{ rows: 2 }} style={{ marginTop: 8 }} />
      )}
    </Card>
  );
}

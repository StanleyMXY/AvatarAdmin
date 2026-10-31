import { useIntl } from '@umijs/max';
import { Alert, Button, Descriptions, Drawer, Flex, Skeleton, Typography } from 'antd';
import { useCallback } from 'react';
import { getSession, type SessionDetail } from '../../services/sessions';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { AccountCell } from './AccountCell';
import { devicePrefix, formatDuration, formatMinutes, isGuest, when } from './format';
import { PlainValue } from './PlainValue';
import { useStatRead } from './useStatRead';

/** The text of a code the backend sends: its translation, or the code itself when there is none. */
function labelOf(
  intl: { messages: Record<string, unknown>; formatMessage: (d: { id: string }) => string },
  prefix: string,
  code: unknown,
): string {
  const text = plainText(code);
  if (text === '') return DASH;
  const key = `${prefix}.${text}`;
  return Object.hasOwn(intl.messages, key) ? intl.formatMessage({ id: key }) : text;
}

function Details({ id }: { id: string }) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const fetcher = useCallback(() => getSession(id), [id]);
  const { data, failure, reload } = useStatRead<SessionDetail>(fetcher);

  if (failure) {
    return (
      <Alert
        type="error"
        showIcon
        title={failure}
        action={
          <Button size="small" onClick={reload}>
            {t('pages.common.retry')}
          </Button>
        }
      />
    );
  }
  if (!data) return <Skeleton active paragraph={{ rows: 8 }} />;

  const guest = isGuest(data.accountId);
  const ended = plainText(data.endedAt) !== '';
  const duration =
    typeof data.durationSeconds === 'number'
      ? formatDuration(data.durationSeconds, t)
      : ended
        ? DASH
        : t('sessions.ongoing');
  const yesNo = (value: unknown) =>
    typeof value === 'boolean' ? t(value ? 'sessions.common.yes' : 'sessions.common.no') : DASH;
  const item = (key: string, label: string, children: React.ReactNode) => ({
    key,
    label,
    children,
  });

  return (
    <Descriptions
      bordered
      size="small"
      column={1}
      styles={{ label: { width: 170 } }}
      items={[
        item('id', t('sessions.detail.id'), <PlainValue value={data.id} />),
        item(
          'accountId',
          t('sessions.detail.accountId'),
          guest ? t('sessions.common.guest') : <AccountCell accountId={data.accountId} />,
        ),
        ...(plainText(data.deviceId) === ''
          ? []
          : [item('device', t('sessions.detail.device'), devicePrefix(data.deviceId))]),
        item('freeTier', t('sessions.detail.freeTier'), yesNo(data.freeTier)),
        item('roomName', t('sessions.detail.roomName'), <PlainValue value={data.roomName} />),
        item('requestedAt', t('sessions.detail.requestedAt'), when(data.requestedAt, intl.locale)),
        item('timezone', t('sessions.detail.timezone'), <PlainValue value={data.timezone} />),
        item('modelTier', t('sessions.detail.modelTier'), <PlainValue value={data.modelTier} />),
        item('language', t('sessions.detail.language'), <PlainValue value={data.language} />),
        item(
          'renderMode',
          t('sessions.detail.renderMode'),
          <PlainValue value={labelOf(intl, 'sessions.renderMode', data.renderMode)} />,
        ),
        item('deadlineAt', t('sessions.detail.deadlineAt'), when(data.deadlineAt, intl.locale)),
        item(
          'maxDurationMinutes',
          t('sessions.detail.maxDurationMinutes'),
          <Flex vertical gap={2}>
            <span>{formatMinutes(data.maxDurationMinutes, intl.locale, t)}</span>
            <Typography.Text type="secondary">
              {t('sessions.detail.maxDurationMinutesNote')}
            </Typography.Text>
          </Flex>,
        ),
        item('startedAt', t('sessions.detail.startedAt'), when(data.startedAt, intl.locale)),
        item(
          'agentJoinedAt',
          t('sessions.detail.agentJoinedAt'),
          when(data.agentJoinedAt, intl.locale),
        ),
        item(
          'userJoinedAt',
          t('sessions.detail.userJoinedAt'),
          when(data.userJoinedAt, intl.locale),
        ),
        item('userLeftAt', t('sessions.detail.userLeftAt'), when(data.userLeftAt, intl.locale)),
        item('endedAt', t('sessions.detail.endedAt'), when(data.endedAt, intl.locale)),
        item('duration', t('sessions.detail.duration'), duration),
        item(
          'endReason',
          t('sessions.detail.endReason'),
          <PlainValue value={labelOf(intl, 'sessions.endReason', data.endReason)} />,
        ),
      ]}
    />
  );
}

/** The details of one session, in a drawer beside the list (no route). The content is read each time it opens. */
export function SessionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const intl = useIntl();
  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      size={560}
      title={intl.formatMessage({ id: 'sessions.detail.title' })}
    >
      {id !== null ? <Details key={id} id={id} /> : null}
    </Drawer>
  );
}

import { history, Link, useAccess, useIntl, useLocation } from '@umijs/max';
import { Alert, Button, Flex, Spin, Tabs, Typography } from 'antd';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { StatusTag } from '../../components/StatusTag';
import { useLatestRead } from '../../hooks/useLatestRead';
import { ApiError } from '../../request/errors';
import { getUser } from '../../services/users';
import { plainText } from '../../utils/plainText';
import AccountMemoryTab from '../memory/AccountMemoryTab';
import { AccountActions } from './AccountActions';
import { AttributionTab } from './AttributionTab';
import { AuthEventsTab } from './AuthEventsTab';
import { AvatarsTab } from './AvatarsTab';
import { CreditsTab } from './CreditsTab';
import { DevicesTab } from './DevicesTab';
import { EntitlementsTab } from './EntitlementsTab';
import { OverviewTab, useStatusOptions } from './OverviewTab';
import { SessionsTab } from './SessionsTab';

type Access = { canAccess: (code?: string) => boolean };

/** The id in `/users/<id>`, or null when the path is not that. */
export function userIdFromPath(pathname: string): string | null {
  const match = /^\/users\/([^/]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

const TAB_KEYS = [
  'overview',
  'avatars',
  'attribution',
  'sessions',
  'devices',
  'authEvents',
  'entitlements',
  'credits',
  'memory',
] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** The permission each tab needs besides `USER:VIEW` (which the page itself needs). */
const TAB_CODE: Record<TabKey, string> = {
  overview: 'USER:VIEW',
  avatars: 'USER:VIEW',
  attribution: 'USER:VIEW',
  sessions: 'USER:VIEW',
  devices: 'USER:VIEW',
  authEvents: 'USER:VIEW',
  entitlements: 'SUBSCRIPTION:VIEW',
  credits: 'SUBSCRIPTION:VIEW',
  memory: 'MEMORY:VIEW',
};

const tabFromSearch = (search: string): string | null => new URLSearchParams(search).get('tab');

/**
 * 用户详情 (`USER:VIEW`): the account with its tabs. The tab is named by `?tab=` (the credit pages
 * link to `?tab=credits`); a tab the administrator may not see, or a name that is none, opens the
 * overview. Each tab needs its own view permission; the write buttons follow the operation matrix of
 * the account states.
 */
export default function UserDetailPage() {
  const intl = useIntl();
  const { pathname, search } = useLocation();
  const id = userIdFromPath(pathname);
  if (id === null) {
    return (
      <Flex vertical gap={12}>
        <Alert
          type="error"
          showIcon
          title={intl.formatMessage({ id: 'users.detail.invalidAddress' })}
        />
        <Link to="/users/list">{intl.formatMessage({ id: 'users.detail.back' })}</Link>
      </Flex>
    );
  }
  // One view per account: nothing of the account before (state, answers on their way) reaches the next.
  return <UserDetailView key={id} id={id} search={search} />;
}

function UserDetailView({ id, search }: { id: string; search: string }) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const access = useAccess() as unknown as Access;
  const statusOptions = useStatusOptions();
  const fetcher = useCallback(() => getUser(id), [id]);
  const { data: user, error, failure, reload } = useLatestRead(fetcher, { keepWhileReading: true });

  const visible = TAB_KEYS.filter((key) => access.canAccess(TAB_CODE[key]));
  const wanted = (raw: string | null): TabKey =>
    raw !== null && (visible as readonly string[]).includes(raw) ? (raw as TabKey) : 'overview';
  const [active, setActive] = useState<TabKey>(() => wanted(tabFromSearch(search)));
  // The address changed (a link, the back button): follow it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the address moves the tab
  useEffect(() => {
    setActive(wanted(tabFromSearch(search)));
  }, [search]);

  const back = <Link to="/users/list">{t('users.detail.back')}</Link>;

  if (failure && !user) {
    const notFound = error instanceof ApiError && error.code === 'RESOURCE_NOT_FOUND';
    return (
      <Flex vertical gap={12}>
        <Alert
          type="error"
          showIcon
          title={
            notFound
              ? t('users.detail.notFound')
              : t('pages.common.loadFailed', { message: failure })
          }
          action={
            notFound ? undefined : (
              <Button size="small" onClick={reload}>
                {t('pages.common.retry')}
              </Button>
            )
          }
        />
        {back}
      </Flex>
    );
  }
  if (!user) return <Spin />;

  const status = plainText(user.status);
  const labels: Record<TabKey, string> = {
    overview: t('users.tab.overview'),
    avatars: t('users.tab.avatars'),
    attribution: t('users.tab.attribution'),
    sessions: t('users.tab.sessions'),
    devices: t('users.tab.devices'),
    authEvents: t('users.tab.authEvents'),
    entitlements: t('users.tab.entitlements'),
    credits: t('users.tab.credits'),
    memory: t('users.tab.memory'),
  };
  const content: Record<TabKey, ReactNode> = {
    overview: <OverviewTab user={user} />,
    // The previews are the face of the user and every read is logged: read only while the tab is open.
    avatars: active === 'avatars' ? <AvatarsTab accountId={id} /> : null,
    attribution: <AttributionTab attribution={user.attribution} />,
    sessions: <SessionsTab accountId={id} />,
    devices: <DevicesTab accountId={id} />,
    authEvents: <AuthEventsTab accountId={id} />,
    entitlements: <EntitlementsTab accountId={id} status={status} />,
    credits: <CreditsTab accountId={id} status={status} />,
    memory: <AccountMemoryTab accountId={id} accountStatus={status} />,
  };

  const choose = (key: string) => {
    const next = wanted(key);
    setActive(next);
    history.replace(`/users/${encodeURIComponent(id)}?tab=${next}`);
  };

  return (
    <Flex vertical gap={16}>
      {back}
      <Flex justify="space-between" align="center" wrap gap={12}>
        <Flex align="center" gap={12} wrap style={{ minWidth: 0 }}>
          <Typography.Title level={4} style={{ margin: 0, overflowWrap: 'anywhere' }}>
            {t('users.detail.title', { id })}
          </Typography.Title>
          <StatusTag status={status} options={statusOptions} />
        </Flex>
        <AccountActions accountId={id} status={status} onChanged={reload} />
      </Flex>
      {status === 'PENDING_DELETION' || status === 'DELETING' ? (
        <Alert type="warning" showIcon title={t(`users.banner.${status}`)} />
      ) : null}
      <Tabs
        activeKey={active}
        onChange={choose}
        items={visible.map((key) => ({ key, label: labels[key], children: content[key] }))}
      />
    </Flex>
  );
}

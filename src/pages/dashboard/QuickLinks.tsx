import { useIntl } from '@umijs/max';
import { Card, Flex } from 'antd';
import type { PermissionCode } from '../../access/permissionCodes';
import { NavButton } from './NavButton';

/** The quick entries of spec 5.1 with the permission that the target page asks for (spec 5.0). */
export const QUICK_LINKS: ReadonlyArray<{
  key: string;
  to: string;
  code: PermissionCode;
}> = [
  { key: 'daily', to: '/stat/daily', code: 'STATS:VIEW' },
  { key: 'retention', to: '/stat/retention', code: 'STATS:VIEW' },
  { key: 'guest', to: '/stat/guest', code: 'STATS:VIEW' },
  { key: 'quality', to: '/sessions/quality', code: 'STATS:VIEW' },
  { key: 'subscriptions', to: '/subscriptions/stats', code: 'FINANCE:VIEW' },
];

/** Shows the entries the administrator may open; nothing at all (not even the box) when there is none. */
export function QuickLinks({ canAccess }: { canAccess: (code?: string) => boolean }) {
  const intl = useIntl();
  const links = QUICK_LINKS.filter((link) => canAccess(link.code));
  if (links.length === 0) return null;
  return (
    <Card
      size="small"
      data-testid="dashboard-quick"
      title={intl.formatMessage({ id: 'dashboard.quick.title' })}
    >
      <Flex gap={12} wrap>
        {links.map((link) => (
          <NavButton key={link.key} to={link.to}>
            {intl.formatMessage({ id: `dashboard.quick.${link.key}` })}
          </NavButton>
        ))}
      </Flex>
    </Card>
  );
}

import { useAccess, useIntl } from '@umijs/max';
import { Space, Typography } from 'antd';
import type { PermissionCode } from '../access/permissionCodes';
import { DASH } from '../utils/ratio';

type Access = { canAccess: (code?: string) => boolean };

/**
 * Shows a value the backend has already masked (an e-mail, a phone number, a key). The mask is
 * shown exactly as received; nothing here tries to undo it. When `needsCode` is given and the
 * administrator does not hold it, a note says which permission shows the full value.
 */
export function MaskedText({
  value,
  needsCode,
}: {
  value: string | null | undefined;
  needsCode?: PermissionCode;
}) {
  const intl = useIntl();
  const access = useAccess() as unknown as Access;
  const hint =
    needsCode && !access.canAccess(needsCode)
      ? intl.formatMessage(
          { id: 'pages.masked.needsPermission' },
          {
            name: intl.messages[`permission.${needsCode}`]
              ? intl.formatMessage({ id: `permission.${needsCode}` })
              : needsCode,
          },
        )
      : null;
  return (
    <Space size={8} wrap>
      <Typography.Text style={{ overflowWrap: 'anywhere' }}>
        {value === null || value === undefined || value === '' ? DASH : value}
      </Typography.Text>
      {hint ? <Typography.Text type="secondary">{hint}</Typography.Text> : null}
    </Space>
  );
}

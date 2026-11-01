import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Spin,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from 'antd';
import { useCallback } from 'react';
import { useLatestRead } from '../../hooks/useLatestRead';
import {
  type AccountAvatar,
  type AccountLook,
  getAccountAvatars,
  type OwnedCosmetic,
} from '../../services/avatar';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { GrantCosmeticButton } from '../avatar/GrantCosmetic';
import { Thumb } from '../avatar/Thumb';
import { Cell } from './Cell';
import { labelOf } from './text';

/**
 * 形象与服装 (`USER:VIEW`): the avatars of the account, newest first, each with its looks (state,
 * outfit, background, preview, time), and the outfits and backgrounds it owns with where each came
 * from. The previews are the face of the user: the backend writes every read to the audit log, so
 * the page says so, reads again each time the tab is opened, and keeps no address. The give button
 * needs `COSMETIC:GRANT`.
 */
export function AvatarsTab({ accountId }: { accountId: string }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const fetcher = useCallback(() => getAccountAvatars(accountId), [accountId]);
  const { data, failure, reload } = useLatestRead(fetcher, { keepWhileReading: true });
  const when = (value: unknown) => {
    const text = plainText(value);
    return text === '' ? DASH : formatInstant(text, intl.locale);
  };

  if (failure) {
    return (
      <Alert
        type="error"
        showIcon
        title={intl.formatMessage({ id: 'pages.common.loadFailed' }, { message: failure })}
        action={
          <Button size="small" onClick={reload}>
            {t('pages.common.retry')}
          </Button>
        }
      />
    );
  }
  if (!data) return <Spin />;

  const lookColumns: TableColumnsType<AccountLook> = [
    {
      title: t('users.avatars.look.status'),
      render: (_, look) => <Cell value={look.status} />,
    },
    {
      title: t('users.avatars.look.outfit'),
      render: (_, look) => <Cell value={look.outfitItemId} />,
    },
    {
      title: t('users.avatars.look.background'),
      render: (_, look) => <Cell value={look.backgroundItemId} />,
    },
    {
      title: t('users.avatars.look.preview'),
      render: (_, look) => (
        <Thumb url={look.previewUrl} alt={t('users.avatars.look.alt')} size={56} />
      ),
    },
    { title: t('users.avatars.createdAt'), render: (_, look) => when(look.createdAt) },
  ];

  const cosmeticColumns: TableColumnsType<OwnedCosmetic> = [
    { title: t('users.avatars.cosmetic.key'), render: (_, row) => <Cell value={row.itemKey} /> },
    {
      title: t('users.avatars.cosmetic.source'),
      render: (_, row) => labelOf(intl, 'users.avatars.source', row.source),
    },
    {
      title: t('users.avatars.cosmetic.ledger'),
      render: (_, row) => <Cell value={row.creditLedgerId} />,
    },
    { title: t('users.avatars.cosmetic.grantedAt'), render: (_, row) => when(row.grantedAt) },
  ];

  return (
    <Flex vertical gap={16}>
      <Alert type="info" showIcon title={t('users.avatars.faceNotice')} />
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('users.avatars.avatars')}
      </Typography.Title>
      {data.avatars.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('users.avatars.none')} />
      ) : (
        data.avatars.map((avatar: AccountAvatar) => (
          <Card
            key={avatar.assetId}
            size="small"
            data-testid="avatar-card"
            title={
              <Flex gap={8} wrap align="center">
                <Cell value={avatar.name} lines={2} />
                {avatar.isCurrent ? <Tag color="green">{t('users.avatars.current')}</Tag> : null}
                <Tag>{labelOf(intl, 'users.avatars.style', avatar.style)}</Tag>
                <Typography.Text type="secondary">{when(avatar.createdAt)}</Typography.Text>
              </Flex>
            }
          >
            {avatar.looks.length === 0 ? (
              <Typography.Text type="secondary">{t('users.avatars.noLooks')}</Typography.Text>
            ) : (
              <Table<AccountLook>
                size="small"
                rowKey="lookId"
                columns={lookColumns}
                dataSource={avatar.looks}
                pagination={false}
                scroll={{ x: 'max-content' }}
              />
            )}
          </Card>
        ))
      )}
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('users.avatars.cosmetics')}
        </Typography.Title>
        <GrantCosmeticButton
          accountId={accountId}
          ownedItemIds={data.cosmetics.map((c) => c.itemId)}
          onGranted={reload}
        />
      </Flex>
      {data.cosmetics.length === 0 ? (
        <Typography.Text type="secondary">{t('users.avatars.noCosmetics')}</Typography.Text>
      ) : (
        <div data-testid="cosmetics-table">
          <Table<OwnedCosmetic>
            size="small"
            rowKey="itemId"
            columns={cosmeticColumns}
            dataSource={data.cosmetics}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}
    </Flex>
  );
}

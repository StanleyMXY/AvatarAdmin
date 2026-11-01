import type { ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Flex, Typography } from 'antd';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type CheckinRecord, listCheckinRecords } from '../../services/activity';
import { countText, instantText, orDash } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { CopyableId } from './CopyableId';

type Filters = { accountId?: string; activityId?: string };
// The search-only column has no field in the row.
type Row = CheckinRecord & { activityFilter?: never };

/** 签到记录 (`CHECKIN:VIEW`): who checked in, on which local day, which step of the activity, and the credits given. Read only. */
export default function SigninRecordPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const credits = (row: CheckinRecord) => {
    const { rewardCredits: reward, bonusCredits: bonus } = row;
    if (typeof reward !== 'number' || typeof bonus !== 'number') return DASH;
    return (
      <Flex vertical gap={0}>
        <span>{countText(intl.locale, Math.max(0, reward + bonus))}</span>
        <Typography.Text type="secondary">
          {t('activity.record.breakdown', {
            reward: countText(intl.locale, reward),
            bonus: countText(intl.locale, bonus),
          })}
        </Typography.Text>
      </Flex>
    );
  };

  const columns: ProColumns<Row>[] = [
    {
      title: t('activity.common.accountId'),
      dataIndex: 'accountId',
      render: (_, row) => <CopyableId value={row.accountId} />,
    },
    {
      title: t('activity.record.activityId'),
      dataIndex: 'activityFilter',
      hideInTable: true,
    },
    {
      title: t('activity.record.col.activity'),
      dataIndex: 'activityName',
      search: false,
      render: (_, row) => {
        const name = plainText(row.activityName);
        return (
          <Flex vertical gap={0}>
            {name === '' ? (
              <span>{DASH}</span>
            ) : (
              <EllipsisPopoverText text={name} lines={2} width={240} />
            )}
            {name === '' ? (
              <Typography.Text type="secondary">
                {t('activity.record.idOf', { id: orDash(row.activityId) })}
              </Typography.Text>
            ) : null}
          </Flex>
        );
      },
    },
    {
      title: t('activity.record.col.date'),
      dataIndex: 'checkinDate',
      search: false,
      render: (_, row) => orDash(row.checkinDate),
    },
    {
      title: t('activity.record.col.dayNum'),
      dataIndex: 'dayNum',
      search: false,
      render: (_, row) =>
        typeof row.dayNum === 'number' ? t('activity.day', { n: row.dayNum }) : DASH,
    },
    {
      title: t('activity.record.col.streak'),
      dataIndex: 'consecutiveDays',
      search: false,
      align: 'end',
      render: (_, row) => countText(intl.locale, row.consecutiveDays),
    },
    {
      title: t('activity.record.col.credits'),
      dataIndex: 'rewardCredits',
      search: false,
      align: 'end',
      render: (_, row) => credits(row),
    },
    {
      title: t('activity.record.col.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.createdAt),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('activity.record.note')}
      </Typography.Paragraph>
      <PagedListTable<Row, Filters & { activityFilter?: string }>
        rowKey="id"
        columns={columns}
        request={({ page, pageSize, accountId, activityFilter }) => {
          const account = trimSpec(accountId ?? '');
          const activity = trimSpec(activityFilter ?? '');
          return listCheckinRecords({
            page,
            pageSize,
            ...(account ? { accountId: account } : {}),
            ...(activity ? { activityId: activity } : {}),
          });
        }}
      />
    </Flex>
  );
}

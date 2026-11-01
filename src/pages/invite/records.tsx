import type { ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { Typography } from 'antd';
import { useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { ExportButton } from '../../components/ExportButton';
import { PagedListTable } from '../../components/PagedListTable';
import { StatusTag } from '../../components/StatusTag';
import {
  type InviteRecord,
  listInviteRecords,
  REWARD_REASONS,
  REWARD_STATUSES,
} from '../../services/invite';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';
import { formatCount } from '../../utils/ratio';
import { count } from './numbers';

type Filters = { rewardStatus?: string };

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'default',
  REWARDED: 'success',
  NOT_ELIGIBLE: 'warning',
};

/** 邀请记录 (`INVITE:VIEW`): who invited whom, newest redemption first, with the reward state; identifiers are masked. */
export default function InviteRecordsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  // What the list was last asked with: the export is for the list on the screen, not for the form being edited.
  const [applied, setApplied] = useState<string | undefined>(undefined);

  const statusOptions = Object.fromEntries(
    REWARD_STATUSES.map((status) => [
      status,
      { label: t(`invite.status.${status}`), color: STATUS_COLOR[status] },
    ]),
  );
  const reasonText = (value: unknown): string => {
    const reason = plainText(value);
    return (REWARD_REASONS as readonly string[]).includes(reason)
      ? t(`invite.reason.${reason}`)
      : reason;
  };
  const credits = (value: unknown) => formatCount(count(value), intl.locale);

  const columns: ProColumns<InviteRecord>[] = [
    {
      title: t('invite.records.inviter'),
      dataIndex: 'inviterLabel',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.inviterLabel)} width={220} dir="ltr" />
      ),
    },
    {
      title: t('invite.records.invitee'),
      dataIndex: 'inviteeLabel',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.inviteeLabel)} width={220} dir="ltr" />
      ),
    },
    {
      title: t('invite.records.redeemedAt'),
      dataIndex: 'redeemedAt',
      search: false,
      render: (_, row) => {
        const text = plainText(row.redeemedAt);
        return text === '' ? '—' : formatInstant(text, intl.locale);
      },
    },
    {
      title: t('invite.records.rewardStatus'),
      dataIndex: 'rewardStatus',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        REWARD_STATUSES.map((status) => [status, { text: t(`invite.status.${status}`) }]),
      ),
      render: (_, row) => (
        <StatusTag status={plainText(row.rewardStatus)} options={statusOptions} />
      ),
    },
    {
      title: t('invite.records.rewardReason'),
      dataIndex: 'rewardReason',
      search: false,
      render: (_, row) => {
        const text = reasonText(row.rewardReason);
        return text === '' ? '—' : <EllipsisPopoverText text={text} width={260} />;
      },
    },
    {
      title: t('invite.records.inviterCredits'),
      dataIndex: 'inviterCreditsGranted',
      search: false,
      align: 'right',
      render: (_, row) => credits(row.inviterCreditsGranted),
    },
    {
      title: t('invite.records.inviteeCredits'),
      dataIndex: 'inviteeCreditsGranted',
      search: false,
      align: 'right',
      render: (_, row) => credits(row.inviteeCreditsGranted),
    },
  ];

  const request = ({
    page,
    pageSize,
    rewardStatus,
  }: { page: number; pageSize: number } & Filters) => {
    const status = rewardStatus || undefined;
    setApplied(status);
    return listInviteRecords({ page, pageSize, rewardStatus: status });
  };

  return (
    <>
      <Typography.Paragraph type="secondary">{t('invite.records.maskNote')}</Typography.Paragraph>
      <PagedListTable<InviteRecord, Filters>
        rowKey={(row) => plainText(row.id)}
        columns={columns}
        request={request}
        toolbar={[
          <ExportButton
            key="export"
            name="invite-records"
            viewCode="INVITE:VIEW"
            params={{ rewardStatus: applied }}
          />,
        ]}
      />
    </>
  );
}

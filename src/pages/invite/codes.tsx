import type { ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type InviteCode, listInviteCodes } from '../../services/invite';
import { formatInstant } from '../../utils/format';
import { plainText } from '../../utils/plainText';

/** 邀请码 (`INVITE:VIEW`): every invite code with its owner account and the creation time of that account. */
export default function InviteCodesPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const columns: ProColumns<InviteCode>[] = [
    {
      title: t('invite.codes.code'),
      dataIndex: 'code',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={plainText(row.code)} width={200} dir="ltr" />,
    },
    {
      title: t('invite.codes.ownerAccountId'),
      dataIndex: 'ownerAccountId',
      search: false,
      render: (_, row) => (
        <EllipsisPopoverText text={plainText(row.ownerAccountId)} width={320} dir="ltr" />
      ),
    },
    {
      title: t('invite.codes.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => {
        const text = plainText(row.createdAt);
        return text === '' ? '—' : formatInstant(text, intl.locale);
      },
    },
  ];

  return (
    <PagedListTable<InviteCode>
      rowKey={(row) => plainText(row.id) || plainText(row.code)}
      columns={columns}
      request={listInviteCodes}
    />
  );
}

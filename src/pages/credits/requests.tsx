import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Space, Typography } from 'antd';
import { useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { Can } from '../../components/Can';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { ReasonModalForm } from '../../components/ReasonModalForm';
import { RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import { ApiError } from '../../request/errors';
import {
  type AdjustRequest,
  approveAdjustRequest,
  listAdjustRequests,
  rejectAdjustRequest,
} from '../../services/credits';
import { useSession } from '../../session/useSession';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { AccountLink } from './AccountLink';
import { AdjustRequestModal } from './AdjustRequestModal';
import { ApproveModal } from './ApproveModal';
import { formatSigned, shortId } from './format';

type Access = { canAccess: (code?: string) => boolean };
type Filters = { accountId?: string; status?: string };

const STATUS_COLORS: Record<string, string | undefined> = {
  PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
};

/** 调账申请与审核: new requests (`SUBSCRIPTION:GRANT`), approve and reject (`CREDIT:REVIEW`, never your own request). */
export default function CreditRequestsPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as Access;
  const { me } = useSession();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState<AdjustRequest | null>(null);
  const [rejecting, setRejecting] = useState<AdjustRequest | null>(null);
  const reload = () => actionRef.current?.reload();

  const statusOptions = Object.fromEntries(
    (['PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => [
      status,
      { label: t(`credits.status.${status}`), color: STATUS_COLORS[status] },
    ]),
  );

  // A failure that says the request is no longer what the list showed: show the list again.
  const refreshOnConflict = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'INVALID_STATE') reload();
  };

  const canReview = access.canAccess('CREDIT:REVIEW');
  // `me.id` is the backend's field of `GET /me`; where it is not there yet nothing is disabled and
  // the backend refuses with SELF_REVIEW_FORBIDDEN, which the dialog shows.
  const ownRequest = (row: AdjustRequest) => me?.id !== undefined && row.applicantAdminId === me.id;

  const columns: ProColumns<AdjustRequest>[] = [
    {
      title: t('credits.common.accountId'),
      dataIndex: 'accountId',
      render: (_, row) => <AccountLink accountId={row.accountId} />,
    },
    {
      title: t('credits.requests.kind'),
      dataIndex: 'kind',
      search: false,
      render: (_, row) =>
        intl.messages[`credits.kind.${row.kind}`] ? t(`credits.kind.${row.kind}`) : row.kind,
    },
    {
      title: t('credits.requests.delta'),
      dataIndex: 'delta',
      search: false,
      align: 'right',
      render: (_, row) => formatSigned(row.delta, intl.locale),
    },
    {
      title: t('credits.requests.reason'),
      dataIndex: 'reason',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.reason} width={260} />,
    },
    {
      title: t('credits.requests.status'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(statusOptions).map(([status, option]) => [status, { text: option.label }]),
      ),
      render: (_, row) => <StatusTag status={row.status} options={statusOptions} />,
    },
    {
      title: t('credits.requests.applicant'),
      dataIndex: 'applicantUsername',
      search: false,
      render: (_, row) => row.applicantUsername ?? shortId(row.applicantAdminId),
    },
    {
      title: t('credits.requests.reviewer'),
      dataIndex: 'reviewerUsername',
      search: false,
      render: (_, row) =>
        row.reviewerAdminId === null
          ? DASH
          : (row.reviewerUsername ?? shortId(row.reviewerAdminId)),
    },
    {
      title: t('credits.requests.reviewNote'),
      dataIndex: 'reviewNote',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.reviewNote} width={260} />,
    },
    {
      title: t('credits.requests.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => formatInstant(row.createdAt, intl.locale),
    },
    {
      title: t('credits.requests.reviewedAt'),
      dataIndex: 'reviewedAt',
      search: false,
      render: (_, row) => (row.reviewedAt ? formatInstant(row.reviewedAt, intl.locale) : DASH),
    },
    {
      title: t('credits.common.actions'),
      search: false,
      valueType: 'option',
      ...ACTIONS_COLUMN,
      render: (_, row) => {
        if (row.status !== 'PENDING' || !canReview) return null;
        const own = ownRequest(row);
        return (
          <Space orientation="vertical" size={0}>
            <RowActions
              actions={[
                {
                  key: 'approve',
                  label: t('credits.requests.approve'),
                  disabled: own,
                  onClick: () => setApproving(row),
                },
                {
                  key: 'reject',
                  label: t('credits.requests.reject'),
                  disabled: own,
                  onClick: () => setRejecting(row),
                },
              ]}
            />
            {own ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('credits.requests.ownRequest')}
              </Typography.Text>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PagedListTable<AdjustRequest, Filters>
        rowKey="id"
        columns={columns}
        actionRef={actionRef}
        request={({ page, pageSize, accountId, status }) => {
          // The account id is matched exactly by the backend: it goes as typed, whole, only the ends cleaned.
          const id = trimSpec(accountId ?? '');
          return listAdjustRequests({
            page,
            pageSize,
            ...(id ? { accountId: id } : {}),
            ...(status ? { status: status as AdjustRequest['status'] } : {}),
          });
        }}
        toolbar={[
          <Can key="new" code="SUBSCRIPTION:GRANT">
            <Button type="primary" onClick={() => setCreating(true)}>
              {t('credits.requests.new')}
            </Button>
          </Can>,
        ]}
      />
      <AdjustRequestModal open={creating} onClose={() => setCreating(false)} onCreated={reload} />
      <ApproveModal
        open={approving !== null}
        onClose={() => setApproving(null)}
        onSubmit={async (note) => {
          if (!approving) return;
          try {
            await approveAdjustRequest(approving.id, note);
          } catch (error) {
            refreshOnConflict(error);
            throw error;
          }
          message.success(t('credits.requests.approved'));
          setApproving(null);
          reload();
        }}
      />
      <ReasonModalForm
        open={rejecting !== null}
        title={t('credits.requests.rejectTitle')}
        reasonLabel={t('credits.requests.rejectNote')}
        onClose={() => setRejecting(null)}
        onSubmit={async (note) => {
          if (!rejecting) return;
          try {
            await rejectAdjustRequest(rejecting.id, note);
          } catch (error) {
            refreshOnConflict(error);
            throw error;
          }
          message.success(t('credits.requests.rejected'));
          setRejecting(null);
          reload();
        }}
      />
    </>
  );
}

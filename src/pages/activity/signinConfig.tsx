import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Flex, Typography } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { type RowAction, RowActions } from '../../components/RowActions';
import { StatusTag } from '../../components/StatusTag';
import {
  type CheckinActivity,
  deleteCheckinActivity,
  LIFECYCLE_STATUSES,
  type LifecycleStatus,
  listCheckinActivities,
  setCheckinActivityStatus,
} from '../../services/activity';
import { describeFailure } from '../../session/describe';
import { plainText } from '../../utils/plainText';
import { trimSpec } from '../../utils/trimSpec';
import { ActivityFormModal } from './ActivityFormModal';
import { ActivityViewModal } from './ActivityViewModal';
import { instantText, lifecycleOptions } from './texts';
import { useOverlapFlow } from './useOverlapFlow';

type Filters = { name?: string; lifecycleStatus?: LifecycleStatus };

/**
 * 签到配置 (`CHECKIN:VIEW`, writing needs `CHECKIN:MANAGE`): the sign-in activities. The actions
 * follow the stored state: a draft can be published or deleted, a live one stopped, a stopped one
 * enabled. Publishing and enabling ask the backend first (`confirm=false`) and, when another live
 * activity overlaps, ask the person before the second request.
 */
export default function SigninConfigPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canManage = access.canAccess('CHECKIN:MANAGE');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const ref = useRef<ActionType | undefined>(undefined);
  const probe = useOverlapFlow();
  const [viewing, setViewing] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editing, setEditing] = useState<'new' | CheckinActivity | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Each opening of the form is a new form: the values of the one before are not carried over.
  const [formSession, setFormSession] = useState(0);
  const openForm = (target: 'new' | CheckinActivity) => {
    setFormSession((n) => n + 1);
    setEditing(target);
    setFormOpen(true);
  };
  const reload = () => ref.current?.reload();

  const showFailure = (error: unknown) => message.error(describeFailure(intl, error).text);

  /** Publishing and enabling: the probe, the question when something overlaps, then the result. */
  const goLive = (row: CheckinActivity, action: 'publish' | 'enable') => async () => {
    const outcome = await probe(action, row.id);
    if (outcome.kind === 'done') {
      message.success(
        t(action === 'publish' ? 'activity.signin.published' : 'activity.signin.enabled'),
      );
    } else if (outcome.kind === 'failed') {
      showFailure(outcome.error);
    }
    reload();
  };

  const actionsOf = (row: CheckinActivity): RowAction[] => {
    const actions: RowAction[] = [
      {
        key: 'view',
        label: t('activity.signin.view'),
        onClick: () => {
          setViewing(row.id);
          setViewOpen(true);
        },
      },
    ];
    if (!canManage) return actions;
    actions.push({ key: 'edit', label: t('activity.signin.edit'), onClick: () => openForm(row) });
    if (row.status === 'DRAFT') {
      actions.push({
        key: 'publish',
        label: t('activity.signin.publish'),
        onClick: goLive(row, 'publish'),
      });
      actions.push({
        key: 'delete',
        label: t('activity.signin.delete'),
        confirmText: t('activity.signin.deleteConfirm'),
        onClick: async () => {
          try {
            await deleteCheckinActivity(row.id);
            message.success(t('activity.signin.deleted'));
          } catch (error) {
            showFailure(error);
          }
          reload();
        },
      });
    } else if (row.status === 'ACTIVE') {
      actions.push({
        key: 'disable',
        label: t('activity.signin.disable'),
        confirmText: t('activity.signin.disableConfirm'),
        onClick: async () => {
          try {
            await setCheckinActivityStatus(row.id, 'DISABLED');
            message.success(t('activity.signin.disabled'));
          } catch (error) {
            showFailure(error);
          }
          reload();
        },
      });
    } else if (row.status === 'DISABLED') {
      actions.push({
        key: 'enable',
        label: t('activity.signin.enable'),
        onClick: goLive(row, 'enable'),
      });
    }
    return actions;
  };

  const dayText = (value: unknown) => {
    const text = plainText(value);
    return text === '' ? t('activity.common.noLimit') : text;
  };

  const columns: ProColumns<CheckinActivity>[] = [
    {
      title: t('activity.signin.col.name'),
      dataIndex: 'name',
      render: (_, row) => <EllipsisPopoverText text={plainText(row.name)} lines={2} width={240} />,
    },
    {
      title: t('activity.signin.col.status'),
      dataIndex: 'lifecycleStatus',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        LIFECYCLE_STATUSES.map((status) => [status, { text: t(`activity.lifecycle.${status}`) }]),
      ),
      render: (_, row) => (
        <StatusTag status={plainText(row.lifecycleStatus)} options={lifecycleOptions(intl)} />
      ),
    },
    {
      title: t('activity.signin.col.time'),
      dataIndex: 'startDate',
      search: false,
      render: (_, row) => (
        <Flex vertical gap={0}>
          <span>{t('activity.signin.time.start', { date: dayText(row.startDate) })}</span>
          <span>{t('activity.signin.time.end', { date: dayText(row.endDate) })}</span>
          <Typography.Text type="secondary">
            {t('activity.signin.time.created', { time: instantText(intl.locale, row.createdAt) })}
          </Typography.Text>
          <Typography.Text type="secondary">
            {t('activity.signin.time.updated', { time: instantText(intl.locale, row.updatedAt) })}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: t('activity.signin.col.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_, row) => <RowActions actions={actionsOf(row)} />,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('activity.signin.note')}
      </Typography.Paragraph>
      <PagedListTable<CheckinActivity, Filters>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize, name, lifecycleStatus }) =>
          listCheckinActivities({
            page,
            pageSize,
            ...(name && trimSpec(name) ? { name: trimSpec(name) } : {}),
            ...(lifecycleStatus ? { lifecycleStatus } : {}),
          })
        }
        toolbar={
          canManage
            ? [
                <Button key="new" type="primary" onClick={() => openForm('new')}>
                  {t('activity.signin.new')}
                </Button>,
              ]
            : undefined
        }
      />
      <ActivityViewModal id={viewing} open={viewOpen} onClose={() => setViewOpen(false)} />
      {canManage ? (
        <ActivityFormModal
          key={formSession}
          target={editing}
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={reload}
        />
      ) : null}
    </Flex>
  );
}

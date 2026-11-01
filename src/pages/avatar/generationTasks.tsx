import type { ProColumns } from '@ant-design/pro-components';
import { Link, useAccess, useIntl } from '@umijs/max';
import { Typography } from 'antd';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import {
  GENERATION_TASK_TYPES,
  type GenerationTask,
  type GenerationTaskType,
  listGenerationTasks,
} from '../../services/avatar';
import { codeText } from '../../utils/displayText';
import { formatInstant } from '../../utils/format';
import { DASH } from '../../utils/ratio';

type Filter = { type?: GenerationTaskType };

/** 生成任务 (`GENERATION:VIEW`): the generation tasks that failed, and why. The only filter is the type. */
export default function GenerationTasksPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const when = (iso: string | null | undefined) => (iso ? formatInstant(iso, intl.locale) : DASH);

  const columns: ProColumns<GenerationTask>[] = [
    {
      title: t('avatar.tasks.id'),
      dataIndex: 'id',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.id} lines={1} width={200} />,
    },
    {
      title: t('avatar.tasks.account'),
      dataIndex: 'accountId',
      search: false,
      render: (_, row) =>
        row.accountId === null || row.accountId === undefined ? (
          t('avatar.tasks.system')
        ) : access.canAccess('USER:VIEW') ? (
          <Link to={`/users/${row.accountId}`}>{row.accountId}</Link>
        ) : (
          row.accountId
        ),
    },
    {
      title: t('avatar.tasks.type'),
      dataIndex: 'type',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        GENERATION_TASK_TYPES.map((type) => [
          type,
          { text: codeText(intl, 'avatar.tasks.type', type) },
        ]),
      ),
      render: (_, row) => codeText(intl, 'avatar.tasks.type', row.type),
    },
    {
      title: t('avatar.tasks.failureReason'),
      dataIndex: 'failureReason',
      search: false,
      render: (_, row) =>
        row.failureReason ? codeText(intl, 'avatar.failure', row.failureReason) : DASH,
    },
    {
      title: t('avatar.tasks.createdAt'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => when(row.createdAt),
    },
    {
      title: t('avatar.tasks.updatedAt'),
      dataIndex: 'updatedAt',
      search: false,
      render: (_, row) => when(row.updatedAt),
    },
  ];

  return (
    <>
      <Typography.Paragraph type="secondary">{t('avatar.tasks.note')}</Typography.Paragraph>
      <PagedListTable<GenerationTask, Filter>
        rowKey="id"
        columns={columns}
        request={({ page, pageSize, type }) => listGenerationTasks({ page, pageSize, type })}
      />
    </>
  );
}

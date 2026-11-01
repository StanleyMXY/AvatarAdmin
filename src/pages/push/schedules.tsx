import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useAccess, useIntl } from '@umijs/max';
import { App, Button, Flex, Typography } from 'antd';
import { useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { EnabledSwitch } from '../../components/EnabledSwitch';
import { PagedListTable } from '../../components/PagedListTable';
import { RowActions } from '../../components/RowActions';
import {
  deleteSchedule,
  listSchedules,
  type PushSchedule,
  updateSchedule,
} from '../../services/push';
import { describeFailure } from '../../session/describe';
import { useAdminMeta } from '../../session/useSession';
import { codeText, instantText, type Translator } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { scheduleFields, scheduleToValues } from './bodies';
import { supportedLocalesOf } from './coverage';
import { ScheduleModal } from './ScheduleModal';

/** "Every day", "Weekly on Mon, Wed", "Monthly on day 31". */
function describeRepeat(intl: Translator, row: PushSchedule): string {
  if (row.repeat === 'WEEKLY') {
    const days = (Array.isArray(row.daysOfWeek) ? row.daysOfWeek : [])
      .filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7)
      .map((d) => intl.formatMessage({ id: `push.weekday.${d}` }));
    return intl.formatMessage(
      { id: 'push.repeat.weekly' },
      { days: days.join(intl.formatMessage({ id: 'push.weekday.separator' })) },
    );
  }
  if (row.repeat === 'MONTHLY') {
    return intl.formatMessage({ id: 'push.repeat.monthly' }, { day: plainText(row.dayOfMonth) });
  }
  return codeText(intl, 'push.repeat', row.repeat) || DASH;
}

/** 周期推送 (`PUSH:SEND`): pushes that repeat; each time one is due, one task is made from it. */
export default function SchedulesPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const canSend = access.canAccess('PUSH:SEND');
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const locales = supportedLocalesOf(useAdminMeta() as { supportedLocales?: unknown });
  const ref = useRef<ActionType | undefined>(undefined);
  const [editing, setEditing] = useState<PushSchedule | null | 'new'>(null);
  const reload = () => ref.current?.reload();

  const columns: ProColumns<PushSchedule>[] = [
    {
      title: t('push.schedules.col.title'),
      dataIndex: 'title',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={plainText(row.title)} lines={2} width={170} />,
    },
    {
      title: t('push.schedules.col.repeat'),
      dataIndex: 'repeat',
      search: false,
      render: (_, row) => describeRepeat(intl, row),
    },
    {
      title: t('push.schedules.col.time'),
      dataIndex: 'timeOfDay',
      search: false,
      render: (_, row) => `${plainText(row.timeOfDay)} · ${plainText(row.timezone)}`,
    },
    {
      title: t('push.schedules.col.dates'),
      dataIndex: 'startDate',
      search: false,
      render: (_, row) =>
        t('push.schedules.dates', {
          start: plainText(row.startDate),
          end: typeof row.endDate === 'string' ? row.endDate : t('push.schedules.noEnd'),
        }),
    },
    {
      title: t('push.schedules.col.enabled'),
      dataIndex: 'enabled',
      search: false,
      render: (_, row) => (
        <EnabledSwitch
          checked={row.enabled === true}
          disabled={!canSend}
          label={t('push.schedules.enabledOf', { title: plainText(row.title) })}
          onToggle={(next) =>
            updateSchedule(row.id, scheduleFields({ ...scheduleToValues(row), enabled: next }))
          }
          onDone={reload}
        />
      ),
    },
    {
      title: t('push.schedules.col.audience'),
      dataIndex: 'audience',
      search: false,
      render: (_, row) => codeText(intl, 'push.audience', row.audience) || DASH,
    },
    {
      title: t('push.schedules.col.nextRunAt'),
      dataIndex: 'nextRunAt',
      search: false,
      render: (_, row) => instantText(intl.locale, row.nextRunAt),
    },
    {
      title: t('push.schedules.col.actions'),
      valueType: 'option',
      ...ACTIONS_COLUMN,
      render: (_, row) =>
        canSend ? (
          <RowActions
            actions={[
              { key: 'edit', label: t('push.schedules.edit'), onClick: () => setEditing(row) },
              ...(row.enabled === true
                ? [
                    {
                      key: 'deactivate',
                      label: t('push.schedules.deactivate'),
                      confirmText: t('push.schedules.deactivateConfirm'),
                      onClick: async () => {
                        try {
                          await deleteSchedule(row.id);
                          message.success(t('push.schedules.deactivated'));
                        } catch (error) {
                          message.error(describeFailure(intl, error).text);
                        }
                        reload();
                      },
                    },
                  ]
                : []),
            ]}
          />
        ) : null,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
        {t('push.schedules.note')}
      </Typography.Paragraph>
      <PagedListTable<PushSchedule>
        rowKey="id"
        columns={columns}
        actionRef={ref}
        request={({ page, pageSize }) => listSchedules({ page, pageSize })}
        toolbar={
          canSend
            ? [
                <Button key="new" type="primary" onClick={() => setEditing('new')}>
                  {t('push.schedules.new')}
                </Button>,
              ]
            : undefined
        }
      />
      <ScheduleModal
        open={editing !== null}
        schedule={editing === 'new' || editing === null ? null : editing}
        locales={locales}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </Flex>
  );
}

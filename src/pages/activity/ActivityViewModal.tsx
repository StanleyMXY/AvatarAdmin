import { useIntl } from '@umijs/max';
import { Alert, Button, Descriptions, Flex, Modal, Spin, Table, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { StatusTag } from '../../components/StatusTag';
import { useLatestCall } from '../../hooks/useLatestCall';
import { type CheckinActivityDetail, getCheckinActivity } from '../../services/activity';
import { describeFailure } from '../../session/describe';
import { countText, orDash } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { lifecycleOptions } from './texts';

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; text: string }
  | { kind: 'loaded'; detail: CheckinActivityDetail };

type Props = {
  /** The activity to show; it stays set while the dialog closes, so that the content does not change under the animation. */
  id: string | null;
  open: boolean;
  onClose: () => void;
};

/** 查看: name, state, the days and the steps of one activity, read when the dialog opens. */
export function ActivityViewModal({ id, open, onClose }: Props) {
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id: key }, values);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const begin = useLatestCall();

  const load = useCallback(
    async (target: string) => {
      const isCurrent = begin();
      setState({ kind: 'loading' });
      try {
        const detail = await getCheckinActivity(target);
        if (isCurrent()) setState({ kind: 'loaded', detail });
      } catch (error) {
        if (isCurrent()) {
          setState({ kind: 'failed', text: describeFailure(intl, error).text });
        }
      }
    },
    [intl, begin],
  );

  useEffect(() => {
    if (id === null || !open) {
      // Closed: an answer that is still on its way belongs to nobody.
      begin();
      return;
    }
    void load(id);
  }, [id, open, load, begin]);

  const rewards =
    state.kind === 'loaded' && Array.isArray(state.detail.rewards) ? state.detail.rewards : [];

  return (
    <Modal
      open={open && id !== null}
      title={t('activity.signin.view.title')}
      destroyOnHidden
      closable={false}
      width={560}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('activity.common.closed')}</Button>}
    >
      {state.kind === 'loading' ? <Spin /> : null}
      {state.kind === 'failed' ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: state.text })}
          action={
            <Button size="small" onClick={() => id !== null && void load(id)}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      {state.kind === 'loaded' ? (
        <Flex vertical gap={12}>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'name',
                label: t('activity.signin.view.name'),
                children: (
                  <span dir="auto" style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    {orDash(state.detail.name)}
                  </span>
                ),
              },
              {
                key: 'status',
                label: t('activity.signin.view.status'),
                children: (
                  <StatusTag
                    status={plainText(state.detail.lifecycleStatus)}
                    options={lifecycleOptions(intl)}
                  />
                ),
              },
              {
                key: 'start',
                label: t('activity.signin.view.start'),
                children: plainText(state.detail.startDate) || t('activity.common.noLimit'),
              },
              {
                key: 'end',
                label: t('activity.signin.view.end'),
                children: plainText(state.detail.endDate) || t('activity.common.noLimit'),
              },
            ]}
          />
          <Typography.Text strong>{t('activity.signin.view.steps')}</Typography.Text>
          <Table
            size="small"
            rowKey="__key"
            pagination={false}
            dataSource={rewards.map((r, i) => ({ ...r, __key: String(i) }))}
            locale={{ emptyText: t('activity.signin.view.noSteps') }}
            columns={[
              {
                title: t('activity.signin.view.dayCol'),
                dataIndex: 'dayNum',
                render: (value: unknown) =>
                  typeof value === 'number' ? t('activity.day', { n: value }) : DASH,
              },
              {
                title: t('activity.signin.form.rewardCredits'),
                dataIndex: 'rewardCredits',
                align: 'end',
                render: (value: unknown) => countText(intl.locale, value),
              },
              {
                title: t('activity.signin.form.bonusCredits'),
                dataIndex: 'bonusCredits',
                align: 'end',
                render: (value: unknown) => countText(intl.locale, value),
              },
            ]}
          />
        </Flex>
      ) : null}
    </Modal>
  );
}

import { useIntl } from '@umijs/max';
import { Alert, App, Form, InputNumber, Modal, Typography } from 'antd';
import { useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type AdPlacement, type PlacementPatch, updatePlacement } from '../../services/ads';
import { DASH } from '../../utils/ratio';
import { failureToForm } from './formFailure';
import { dailyMax } from './placementRows';

type Values = {
  frequencyCap: number | null;
  cooldownMinutes: number | null;
  rewardCredits: number | null;
};

type Props = {
  open: boolean;
  placement: AdPlacement | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = ['frequencyCap', 'cooldownMinutes', 'rewardCredits'] as const;
const isWhole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);
const numberOrNull = (value: unknown): number | null => (isWhole(value) ? value : null);

/**
 * Edit the numbers of a placement. The rewarded placement has no cooldown (a dash that cannot be
 * changed) and a reward; its cap cannot be 0 because it is also the number of rewards of a day.
 * Only what was changed is sent.
 */
export function PlacementModal({ open, placement, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<{ text: string; more: string[] } | null>(null);
  const rewarded = placement?.adFormat === 'REWARDED';
  const cap = Form.useWatch('frequencyCap', form);
  const reward = Form.useWatch('rewardCredits', form);

  const { run, pending } = useSingleFlight(async (values: Values) => {
    if (!placement) return;
    setFailure(null);
    const patch: PlacementPatch = {};
    if (isWhole(values.frequencyCap) && values.frequencyCap !== placement.frequencyCap) {
      patch.frequencyCap = values.frequencyCap;
    }
    if (
      !rewarded &&
      isWhole(values.cooldownMinutes) &&
      values.cooldownMinutes !== placement.cooldownMinutes
    ) {
      patch.cooldownMinutes = values.cooldownMinutes;
    }
    if (
      rewarded &&
      isWhole(values.rewardCredits) &&
      values.rewardCredits !== placement.rewardCredits
    ) {
      patch.rewardCredits = values.rewardCredits;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    try {
      await updatePlacement(String(placement.id), patch);
    } catch (error) {
      const result = failureToForm(intl, form, error, FIELDS);
      setFailure({ text: result.text, more: result.unplaced });
      return;
    }
    message.success(t('ads.common.saved'));
    onSaved();
    onClose();
  });

  const total = rewarded ? dailyMax(cap, reward) : null;
  const shown = (value: number | null | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? String(value) : DASH;

  return (
    <Modal
      open={open}
      title={t('ads.placements.editTitle', { slot: String(placement?.slotKey ?? '') })}
      destroyOnHidden
      width={520}
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        setFailure(null);
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="adPlacement"
        layout="vertical"
        requiredMark={false}
        initialValues={{
          frequencyCap: numberOrNull(placement?.frequencyCap),
          cooldownMinutes: numberOrNull(placement?.cooldownMinutes),
          rewardCredits: numberOrNull(placement?.rewardCredits),
        }}
        onFinish={(values) => run(values)}
      >
        <Form.Item
          name="frequencyCap"
          label={t('ads.placements.field.frequencyCap')}
          extra={t(rewarded ? 'ads.placements.capHelpRewarded' : 'ads.placements.capHelp')}
          rules={[
            {
              validator: async (_, value: number | null | undefined) => {
                if (!isWhole(value) || value < 0) {
                  throw new Error(t(rewarded ? 'ads.common.wholeFrom1' : 'ads.common.wholeFrom0'));
                }
                if (rewarded && value === 0) throw new Error(t('ads.placements.rewardedCapZero'));
              },
            },
          ]}
        >
          <InputNumber precision={0} style={{ width: 160 }} />
        </Form.Item>
        {rewarded ? (
          <Form.Item
            label={t('ads.placements.field.cooldown')}
            extra={t('ads.placements.cooldownNone')}
          >
            <Typography.Text data-testid="ads-placement-cooldown-none">{DASH}</Typography.Text>
          </Form.Item>
        ) : (
          <Form.Item
            name="cooldownMinutes"
            label={t('ads.placements.field.cooldown')}
            extra={t('ads.placements.cooldownHelp')}
            rules={[
              {
                validator: async (_, value: number | null | undefined) => {
                  // A cooldown that is not set and stays empty is left as it is.
                  if (value === null || value === undefined) {
                    if (placement && typeof placement.cooldownMinutes === 'number') {
                      throw new Error(t('ads.common.wholeFrom0'));
                    }
                    return;
                  }
                  if (!isWhole(value) || value < 0) throw new Error(t('ads.common.wholeFrom0'));
                },
              },
            ]}
          >
            <InputNumber precision={0} style={{ width: 160 }} />
          </Form.Item>
        )}
        {rewarded ? (
          <Form.Item
            name="rewardCredits"
            label={t('ads.placements.field.rewardCredits')}
            extra={
              <Typography.Text type="secondary" data-testid="ads-placement-daily-max">
                {t('ads.placements.dailyMax', {
                  cap: shown(isWhole(cap) && cap > 0 ? cap : null),
                  reward: shown(isWhole(reward) && reward > 0 ? reward : null),
                  total: shown(total),
                })}
              </Typography.Text>
            }
            rules={[
              {
                validator: async (_, value: number | null | undefined) => {
                  if (!isWhole(value)) throw new Error(t('ads.common.wholeFrom1'));
                  if (value <= 0) throw new Error(t('ads.placements.rewardPositive'));
                },
              },
            ]}
          >
            <InputNumber precision={0} style={{ width: 160 }} />
          </Form.Item>
        ) : null}
        {failure ? (
          <Alert
            type="error"
            showIcon
            title={failure.text}
            description={
              failure.more.length > 0 ? (
                <ul style={{ margin: 0, paddingInlineStart: 20 }}>
                  {failure.more.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        ) : null}
      </Form>
    </Modal>
  );
}

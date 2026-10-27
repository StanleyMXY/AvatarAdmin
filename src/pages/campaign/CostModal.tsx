import { useIntl } from '@umijs/max';
import { Alert, App, DatePicker, Form, Input, Modal, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type AttributionCampaign,
  type AttributionCost,
  type CostBody,
  createCost,
  updateCost,
} from '../../services/campaign';
import { plainText } from '../../utils/plainText';
import { DASH } from '../../utils/ratio';
import { trimSpec } from '../../utils/trimSpec';
import { pickedDay, todayUtc } from '../../utils/utcDay';
import { numberOf } from './figures';
import { failureToForm } from './formFailure';

type Values = {
  campaignId: string | undefined;
  statDate: dayjs.Dayjs | null;
  amount: string;
  remark: string;
};

type Props = {
  /** The cost being edited; none means a new cost. */
  cost: AttributionCost | null;
  campaigns: AttributionCampaign[];
  /** `attribution.cost_currency`, or null when the page could not read it. */
  currency: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const FIELDS = ['campaignId', 'statDate', 'amount', 'currency', 'remark'] as const;
// An amount: not below 0, at most two decimals, a whole part that a JSON number keeps exactly.
const AMOUNT = /^\d{1,13}(?:\.\d{1,2})?$/;

/** An amount as it is edited: the number with two decimals. */
const amountText = (value: unknown): string => {
  const n = numberOf(value);
  return n === null ? '' : n.toFixed(2);
};

/**
 * Enter or change a cost (width 480). The campaign and the day are the key of a cost: they are
 * chosen when it is made and only shown afterwards. A cost for a campaign and day that has one is
 * refused by the backend (409 COST_EXISTS) and the words say to change that cost. The currency is
 * only shown: it is the one currency of the system.
 */
export function CostModal({ cost, campaigns, currency, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<Values>();
  const [failure, setFailure] = useState<string | null>(null);
  const editing = cost !== null;
  const campaignOf = (id: unknown) => campaigns.find((c) => c.id === String(id));

  const { run, pending } = useSingleFlight(async (values: Values) => {
    setFailure(null);
    const campaignId = editing ? cost.campaignId : (values.campaignId as string);
    const statDate = editing ? cost.statDate : pickedDay(values.statDate as dayjs.Dayjs);
    const body: CostBody = {
      campaignId,
      statDate,
      amount: Number(trimSpec(values.amount)),
      ...(currency === null ? {} : { currency }),
      remark: trimSpec(values.remark ?? '') === '' ? null : trimSpec(values.remark),
    };
    try {
      if (editing) await updateCost(cost.id, body);
      else await createCost(body);
    } catch (error) {
      setFailure(failureToForm(intl, form, error, FIELDS));
      return;
    }
    message.success(t('campaign.costs.saved'));
    onSaved();
    onClose();
  });

  return (
    <Modal
      open
      title={t(editing ? 'campaign.costs.editTitle' : 'campaign.costs.newTitle')}
      width={480}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="cost"
        layout="vertical"
        requiredMark={false}
        autoComplete="off"
        initialValues={{
          campaignId: undefined,
          // today is the UTC day, which can be yesterday's date where the person is
          statDate: dayjs(`${todayUtc()}T00:00:00`),
          amount: editing ? amountText(cost.amount) : '',
          remark: plainText(cost?.remark),
        }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        {editing ? (
          <>
            <Form.Item label={t('campaign.costs.f.campaign')}>
              <Typography.Text data-testid="cost-campaign" style={{ overflowWrap: 'anywhere' }}>
                {plainText(campaignOf(cost.campaignId)?.name) || plainText(cost.campaignId)}
              </Typography.Text>
            </Form.Item>
            <Form.Item label={t('campaign.costs.f.date')}>
              <Typography.Text data-testid="cost-day">{plainText(cost.statDate)}</Typography.Text>
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              name="campaignId"
              label={t('campaign.costs.f.campaign')}
              rules={[{ required: true, message: t('campaign.costs.f.campaign.required') }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={campaigns.map((c) => ({
                  value: c.id,
                  label: `${plainText(c.code)} · ${plainText(c.name)}`,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="statDate"
              label={t('campaign.costs.f.date')}
              rules={[{ required: true, message: t('campaign.costs.f.date.required') }]}
            >
              <DatePicker allowClear={false} style={{ width: '100%' }} />
            </Form.Item>
          </>
        )}
        <Form.Item
          name="amount"
          label={t('campaign.costs.f.amount')}
          validateTrigger={['onChange', 'onBlur']}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const text = trimSpec(value ?? '');
                if (text === '') throw new Error(t('campaign.costs.f.amount.required'));
                if (!AMOUNT.test(text)) throw new Error(t('campaign.costs.f.amount.rule'));
              },
            },
          ]}
        >
          <Input inputMode="decimal" dir="ltr" />
        </Form.Item>
        <Form.Item
          label={t('campaign.costs.f.currency')}
          extra={t('campaign.costs.f.currency.help')}
        >
          <Typography.Text data-testid="cost-currency">{currency ?? DASH}</Typography.Text>
        </Form.Item>
        <Form.Item name="remark" label={t('campaign.costs.f.remark')}>
          <Input.TextArea dir="auto" autoSize={{ minRows: 2, maxRows: 6 }} />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          {t('campaign.costs.f.keyHelp')}
        </Typography.Paragraph>
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
      </Form>
    </Modal>
  );
}

import { useIntl } from '@umijs/max';
import { Alert, App, Button, Card, Flex, Form, InputNumber, Select, Spin, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type ConfigItem, listConfig, saveConfig } from '../../services/config';
import { describeFailure } from '../../session/describe';
import { specOf, validateValue } from '../config/configSchema';

/** The prefix text takes about 70px; antd's default of 90px for a number box would leave no room for the number. */
const STAGE_BOX_WIDTH = 200;

const KEYS = [
  'companionship.stage_thresholds',
  'milestone.days',
  'companionship.text_burst_minutes',
] as const;

/** `daysText` is what is typed in the days box; it is read as numbers when the form is saved. */
type Draft = {
  bonding: number | null;
  close: number | null;
  days: number[];
  daysText: string[];
  burst: number | null;
};

const draftOf = (items: ConfigItem[]): Draft => {
  const value = (key: string) => items.find((i) => i.key === key)?.value;
  const stages = value('companionship.stage_thresholds') as {
    BONDING?: unknown;
    CLOSE?: unknown;
  } | null;
  const days = value('milestone.days');
  const burst = value('companionship.text_burst_minutes');
  return {
    bonding: typeof stages?.BONDING === 'number' ? stages.BONDING : null,
    close: typeof stages?.CLOSE === 'number' ? stages.CLOSE : null,
    days: Array.isArray(days) ? days.filter((d): d is number => typeof d === 'number') : [],
    daysText: Array.isArray(days) ? days.filter((d) => typeof d === 'number').map(String) : [],
    burst: typeof burst === 'number' ? burst : null,
  };
};

type Field = 'stages' | 'days' | 'burst';
type Problem = { reason: string } | { failure: unknown; key: (typeof KEYS)[number] };

/** 养成管理: the stage thresholds, the milestone days and the text interaction gap, in one form. */
export default function CompanionshipPage() {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [items, setItems] = useState<ConfigItem[] | null>(null);
  // What failed is kept (a reason code, or the failed request), not its text, so that the texts are
  // written again when the language is switched. The same goes for the failure to load.
  const [failure, setFailure] = useState<{ failure: unknown } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, Problem>>>({});

  const load = useCallback(async () => {
    try {
      const { items: rows } = await listConfig();
      const mine = rows.filter((row) => (KEYS as readonly string[]).includes(row.key));
      setItems(mine);
      setDraft(draftOf(mine));
      setFailure(null);
    } catch (error) {
      setFailure({ failure: error });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reason = (code: string) => (intl.messages[`reason.${code}`] ? t(`reason.${code}`) : code);
  const problemText = (problem: Problem | undefined) => {
    if (!problem) return undefined;
    if ('reason' in problem) return reason(problem.reason);
    const { text, fields } = describeFailure(intl, problem.failure);
    return fields.find((f) => f.ref === problem.key)?.text ?? text;
  };

  const { run, pending } = useSingleFlight(async () => {
    if (!items || !draft) return;
    const before = draftOf(items);
    // A token that is not a whole number stays NaN, so that the check below refuses it.
    const typedDays = draft.daysText.map((v) => (/^\d+$/.test(v) ? Number(v) : Number.NaN));
    const next: Record<(typeof KEYS)[number], unknown> = {
      'companionship.stage_thresholds': { BONDING: draft.bonding, CLOSE: draft.close },
      'milestone.days': typedDays,
      'companionship.text_burst_minutes': draft.burst,
    };
    const changed = {
      'companionship.stage_thresholds':
        before.bonding !== draft.bonding || before.close !== draft.close,
      'milestone.days': JSON.stringify(before.days) !== JSON.stringify(typedDays),
      'companionship.text_burst_minutes': before.burst !== draft.burst,
    };
    const found: typeof errors = {};
    const field: Record<(typeof KEYS)[number], Field> = {
      'companionship.stage_thresholds': 'stages',
      'milestone.days': 'days',
      'companionship.text_burst_minutes': 'burst',
    };
    for (const key of KEYS) {
      const spec = specOf(key);
      const problem = spec ? validateValue(spec, next[key]) : null;
      if (problem) found[field[key]] = { reason: problem };
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    if (!KEYS.some((key) => changed[key])) {
      message.info(t('companionship.nothingToSave'));
      return;
    }
    // One key per request (the backend takes one at a time); stop at the first refusal.
    for (const key of KEYS) {
      if (!changed[key]) continue;
      try {
        await saveConfig(key, next[key]);
      } catch (error) {
        // What was typed stays in the form; the values already saved are read again only on success.
        setErrors({ [field[key]]: { failure: error, key } });
        return;
      }
    }
    message.success(t('companionship.saved'));
    await load();
  });

  if (failure)
    return (
      <Alert
        type="error"
        showIcon
        title={t('pages.common.loadFailed', {
          message: describeFailure(intl, failure.failure).text,
        })}
      />
    );
  if (!items || !draft) return <Spin />;

  return (
    <Card style={{ maxWidth: 640 }}>
      <Form layout="vertical" onFinish={() => void run()}>
        <Form.Item
          label={t('config.companionship.stage_thresholds.label')}
          help={problemText(errors.stages)}
          validateStatus={errors.stages ? 'error' : undefined}
          extra={t('config.companionship.stage_thresholds.desc')}
        >
          <Flex gap={12} wrap>
            <InputNumber
              aria-label={t('companionship.bonding')}
              prefix="BONDING"
              style={{ width: STAGE_BOX_WIDTH }}
              precision={0}
              value={draft.bonding}
              onChange={(v) => setDraft({ ...draft, bonding: v })}
            />
            <InputNumber
              aria-label={t('companionship.close')}
              prefix="CLOSE"
              style={{ width: STAGE_BOX_WIDTH }}
              precision={0}
              value={draft.close}
              onChange={(v) => setDraft({ ...draft, close: v })}
            />
          </Flex>
        </Form.Item>
        <Form.Item
          label={t('companionship.days')}
          help={problemText(errors.days) ?? t('companionship.daysHelp')}
          validateStatus={errors.days ? 'error' : undefined}
        >
          <Select
            mode="tags"
            aria-label={t('companionship.days')}
            tokenSeparators={[',', ' ']}
            value={draft.daysText}
            open={false}
            onChange={(values: string[]) => setDraft({ ...draft, daysText: values })}
          />
        </Form.Item>
        <Form.Item
          label={t('companionship.burst')}
          help={problemText(errors.burst)}
          validateStatus={errors.burst ? 'error' : undefined}
          extra={t('config.companionship.text_burst_minutes.desc')}
        >
          <InputNumber
            aria-label={t('companionship.burst')}
            precision={0}
            min={1}
            value={draft.burst}
            onChange={(v) => setDraft({ ...draft, burst: v })}
          />
        </Form.Item>
        <Typography.Paragraph type="secondary">{t('companionship.hint')}</Typography.Paragraph>
        <Button type="primary" htmlType="submit" loading={pending} disabled={pending}>
          {t('companionship.save')}
        </Button>
      </Form>
    </Card>
  );
}

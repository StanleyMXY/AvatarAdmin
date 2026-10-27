import { FormattedMessage, Link, useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Input, InputNumber, Switch, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { DangerConfirmButton } from '../../components/DangerConfirmButton';
import { JsonField, parseJson } from '../../components/JsonField';
import { LinkInput } from '../../components/LinkInput';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type ConfigItem,
  type ConfigWarning,
  resetConfig,
  saveConfig,
} from '../../services/config';
import { describeFailure } from '../../session/describe';
import { formatInstant } from '../../utils/format';
import { type ConfigKeySpec, validateValue } from './configSchema';

type Props = {
  spec: ConfigKeySpec;
  item: ConfigItem;
  /** Called after a save or a reset, so the list can be read again (the server stamps who and when). */
  onChanged: () => void;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const toText = (value: unknown) =>
  value === null || value === undefined ? '' : JSON.stringify(value, null, 2);

/** One configuration key: its name, what it does, the value editor, the default, who changed it, save and reset. */
export function ConfigRow({ spec, item, onChanged }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const has = (id: string) => Boolean(intl.messages[id]);

  const [draft, setDraft] = useState<unknown>(
    spec.kind === 'json' ? toText(item.value) : item.value,
  );
  const [jsonValid, setJsonValid] = useState(true);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ConfigWarning[]>([]);

  const parsed = useMemo(() => {
    if (spec.kind !== 'json') return { ok: true as const, value: draft };
    const result = parseJson(typeof draft === 'string' ? draft : '');
    return result;
  }, [draft, spec.kind]);

  const readOnly = Boolean(spec.editedElsewhere);
  const value = parsed.ok ? parsed.value : undefined;
  const problem = parsed.ok ? validateValue(spec, value) : null;
  const dirty = parsed.ok ? !same(value, item.value) : true;
  const modified = item.updatedAt !== null;

  const save = useSingleFlight(async () => {
    setFieldError(null);
    setAlert(null);
    setWarnings([]);
    try {
      const result = await saveConfig(spec.key, value);
      setWarnings(result.warnings);
      message.success(t('config.saved'));
      onChanged();
    } catch (error) {
      const { error: apiError, text, fields } = describeFailure(intl, error);
      const mine = fields.find((f) => f.ref === spec.key);
      if (mine) setFieldError(mine.text);
      else
        setAlert(
          apiError.code === 'INVALID_REQUEST' && apiError.message
            ? `${text}: ${apiError.message}`
            : text,
        );
    }
  });

  const reset = useSingleFlight(async () => {
    setFieldError(null);
    setAlert(null);
    setWarnings([]);
    try {
      const result = await resetConfig(spec.key);
      setDraft(spec.kind === 'json' ? toText(result.value) : result.value);
      message.success(t('config.saved'));
      onChanged();
    } catch (error) {
      setAlert(describeFailure(intl, error).text);
    }
  });

  const editor = () => {
    if (readOnly) {
      return (
        <Typography.Text code style={{ overflowWrap: 'anywhere' }}>
          {toText(item.value) || t('config.unset')}
        </Typography.Text>
      );
    }
    switch (spec.kind) {
      case 'int':
      case 'number':
        return (
          <InputNumber
            style={{ width: 240 }}
            value={typeof draft === 'number' ? draft : null}
            min={spec.min}
            max={spec.max}
            precision={spec.kind === 'int' ? 0 : undefined}
            step={spec.kind === 'int' ? 1 : 0.01}
            onChange={(v) => setDraft(v)}
          />
        );
      case 'bool':
        return <Switch checked={draft === true} onChange={setDraft} />;
      case 'url':
        return (
          <LinkInput
            value={typeof draft === 'string' ? draft : ''}
            onChange={setDraft}
            showError={false}
          />
        );
      case 'string':
        return (
          <Input
            value={typeof draft === 'string' ? draft : ''}
            onChange={(e) => setDraft(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        );
      case 'json':
        return (
          <JsonField
            value={typeof draft === 'string' ? draft : ''}
            onChange={setDraft}
            onValidityChange={setJsonValid}
            // a key with no value yet may stay empty; one that has a value may not be emptied
            allowEmpty={item.value === null}
            rows={4}
          />
        );
    }
  };

  const label = has(`config.${spec.key}.label`) ? t(`config.${spec.key}.label`) : spec.key;
  const unsetNote =
    spec.key === 'upload.public_base_url' && item.value === null
      ? t('config.requiresUploadBase')
      : null;
  const reasonText = problem && has(`reason.${problem}`) ? t(`reason.${problem}`) : problem;

  return (
    <Flex vertical gap={6} style={{ padding: '12px 0' }} data-testid={`config-row-${spec.key}`}>
      <Flex gap={8} wrap align="center">
        <Typography.Text strong>{label}</Typography.Text>
        <Typography.Text type="secondary" code>
          {spec.key}
        </Typography.Text>
        {item.value === null ? <Tag>{t('config.unset')}</Tag> : null}
        {modified ? <Tag color="blue">{t('config.modified')}</Tag> : null}
      </Flex>
      {has(`config.${spec.key}.desc`) ? (
        <Typography.Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
          {t(`config.${spec.key}.desc`)}
        </Typography.Text>
      ) : null}
      {spec.risk && has(`config.${spec.key}.risk`) ? (
        <Alert type="warning" showIcon title={t(`config.${spec.key}.risk`)} />
      ) : null}
      {unsetNote ? <Alert type="info" showIcon title={unsetNote} /> : null}
      {editor()}
      {spec.editedElsewhere ? (
        <Typography.Text type="secondary">
          <FormattedMessage
            id="config.editedElsewhere"
            values={{ page: <Link to={spec.editedElsewhere}>{spec.editedElsewhere}</Link> }}
          />
        </Typography.Text>
      ) : null}
      {dirty && problem && !readOnly ? (
        <Typography.Text type="danger" role="alert">
          {reasonText}
        </Typography.Text>
      ) : null}
      {fieldError ? (
        <Typography.Text type="danger" role="alert">
          {fieldError}
        </Typography.Text>
      ) : null}
      {alert ? <Alert type="error" showIcon title={alert} /> : null}
      {warnings.map((w) => (
        <Alert
          key={w.code}
          type="warning"
          showIcon
          title={
            has(`config.warning.${w.code}`)
              ? t(`config.warning.${w.code}`, { count: w.count ?? 0 })
              : `${t('config.warning.UNKNOWN')}: ${w.message}`
          }
        />
      ))}
      <Flex gap={12} align="center" wrap>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('config.default')}:{' '}
          <Typography.Text code style={{ fontSize: 12, overflowWrap: 'anywhere' }}>
            {item.defaultValue === null ? t('config.unset') : JSON.stringify(item.defaultValue)}
          </Typography.Text>
        </Typography.Text>
        {modified ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('config.updatedAt')}: {formatInstant(item.updatedAt as string, intl.locale)}
            {(item.updatedByUsername ?? item.updatedBy)
              ? ` · ${t('config.updatedBy')}: ${item.updatedByUsername ?? (item.updatedBy as string).slice(0, 8)}`
              : ''}
          </Typography.Text>
        ) : null}
        {readOnly ? null : (
          <Flex gap={4}>
            <Button
              size="small"
              type="primary"
              onClick={() => void save.run()}
              loading={save.pending}
              disabled={
                !dirty ||
                Boolean(problem) ||
                !parsed.ok ||
                (spec.kind === 'json' && !jsonValid) ||
                save.pending
              }
            >
              {t('config.save')}
            </Button>
            <DangerConfirmButton
              confirmText={t('config.resetConfirm')}
              disabled={!modified || reset.pending}
              onConfirm={async () => {
                await reset.run();
              }}
            >
              {t('config.reset')}
            </DangerConfirmButton>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}

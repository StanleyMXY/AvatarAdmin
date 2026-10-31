import { useIntl } from '@umijs/max';
import { Alert, App, Button, Flex, Input, Modal, Tabs, Typography } from 'antd';
import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { saveBlob } from '../../request/download';
import { ApiError } from '../../request/errors';
import {
  type BatchError,
  batchCosts,
  type CostBatchResult,
  type CostSettings,
  parseCostBatch,
} from '../../services/campaign';
import { describeFailure } from '../../session/describe';
import { formatBytes } from '../../utils/format';
import { buildCostTemplate, CSV_HEADER, MAX_FILE_BYTES, TEMPLATE_FILE_NAME } from './costTemplate';

type Props = {
  /** What `GET /config` said (the row limit and the currency), or null when it is not known. */
  settings: CostSettings | null;
  onClose: () => void;
  onSaved: () => void;
};

type Kind = 'json' | 'csv';
/** A problem is listed with its line; this many are shown and the rest is counted. */
const MAX_SHOWN = 50;

/**
 * Batch import of costs (width 720, a JSON tab and a CSV tab). The text, or the file, is read in this
 * browser and checked at once: a batch is imported whole or not at all, and each bad row is named by
 * its line. Only when Import is pressed are the rows sent. The dialog says, from the start, that a
 * campaign and day that has a cost is overwritten.
 */
export function BatchModal({ settings, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [kind, setKind] = useState<Kind>('json');
  const [jsonText, setJsonText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [fileProblem, setFileProblem] = useState<'tooLarge' | 'unreadable' | 'notUtf8' | null>(
    null,
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ ref: string; text: string }[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const limits = useMemo(
    () => ({ maxRows: settings?.batchMax ?? null, currency: settings?.currency ?? null }),
    [settings],
  );
  const text = kind === 'json' ? jsonText : csvText;
  const result = useMemo<CostBatchResult | null>(
    () => (text.trim() === '' ? null : parseCostBatch({ kind, text }, limits)),
    [kind, text, limits],
  );
  const ready = result !== null && result.errors.length === 0 && result.rows.length > 0;

  const reasonText = (error: BatchError): string => {
    const id = `campaign.batch.reason.${error.reason}`;
    const words = intl.messages[id] ? t(id, error.values) : error.reason;
    return error.line === 0
      ? words
      : t('campaign.batch.errors.line', { line: error.line, reason: words });
  };

  const readFile = async (chosen: File) => {
    setFailure(null);
    setRefused([]);
    setFile({ name: chosen.name, size: chosen.size });
    setFileProblem(null);
    setCsvText('');
    if (chosen.size > MAX_FILE_BYTES) {
      setFileProblem('tooLarge');
      return;
    }
    let bytes: ArrayBuffer;
    try {
      // The file is read here and goes nowhere: only the rows go to the backend, on Import.
      bytes = await chosen.arrayBuffer();
    } catch {
      setFileProblem('unreadable');
      return;
    }
    try {
      // A file saved in another encoding (Excel's ANSI, GBK) must not become replacement characters.
      setCsvText(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch {
      setFileProblem('notUtf8');
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    // The same file can be chosen again after it was changed on disk.
    const target = event.target;
    if (chosen) void readFile(chosen).finally(() => (target.value = ''));
  };

  const downloadTemplate = () => {
    const body = buildCostTemplate({
      currency: settings?.currency ?? 'USD',
      remarks: [t('campaign.batch.template.remark1'), t('campaign.batch.template.remark2')],
    });
    saveBlob(new Blob([body], { type: 'text/csv;charset=utf-8' }), TEMPLATE_FILE_NAME);
  };

  const { run, pending } = useSingleFlight(async () => {
    if (!ready || result === null) return;
    setFailure(null);
    setRefused([]);
    let done: Awaited<ReturnType<typeof batchCosts>>;
    try {
      done = await batchCosts(result.rows);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
      // What the backend says about each row: its reason in words (or the code), never its own message.
      if (error instanceof ApiError) {
        setRefused(
          error.details.map((d) => ({
            ref: d.ref,
            text: intl.messages[`reason.${d.reason}`] ? t(`reason.${d.reason}`) : d.reason,
          })),
        );
      }
      return;
    }
    message.success(
      done
        ? t('campaign.batch.importedSplit', {
            count: done.imported,
            added: done.imported - done.overwritten,
            overwritten: done.overwritten,
          })
        : t('campaign.batch.imported', { count: result.rows.length }),
    );
    onSaved();
    onClose();
  });

  const summary = () => {
    if (!ready || result === null) return null;
    const days = result.rows.map((r) => r.statDate).sort();
    return t('campaign.batch.ready', {
      count: result.rows.length,
      campaigns: new Set(result.rows.map((r) => r.campaignCode)).size,
      from: days[0],
      to: days[days.length - 1],
    });
  };

  const problems = result !== null && result.errors.length > 0 ? result.errors : [];

  const outcome = (
    <Flex vertical gap={8}>
      {fileProblem === 'tooLarge' ? (
        <Alert
          type="error"
          showIcon
          title={t('campaign.batch.csv.tooLarge', {
            size: formatBytes(MAX_FILE_BYTES, intl.locale),
          })}
        />
      ) : null}
      {fileProblem === 'notUtf8' ? (
        <Alert type="error" showIcon title={t('campaign.batch.csv.notUtf8')} />
      ) : null}
      {fileProblem === 'unreadable' ? (
        <Alert type="error" showIcon title={t('campaign.batch.csv.unreadable')} />
      ) : null}
      {problems.length > 0 ? (
        <Alert
          type="error"
          showIcon
          title={t('campaign.batch.errors.title', { count: problems.length })}
          description={
            <ul style={{ margin: 0, paddingInlineStart: 20, maxHeight: 220, overflow: 'auto' }}>
              {problems.slice(0, MAX_SHOWN).map((error) => (
                <li
                  key={`${error.line}|${error.reason}|${JSON.stringify(error.values ?? {})}`}
                  style={{ overflowWrap: 'anywhere' }}
                >
                  {reasonText(error)}
                </li>
              ))}
              {problems.length > MAX_SHOWN ? (
                <li>{t('campaign.batch.errors.more', { count: problems.length - MAX_SHOWN })}</li>
              ) : null}
            </ul>
          }
        />
      ) : null}
      {summary() !== null ? <Alert type="info" showIcon title={summary()} /> : null}
    </Flex>
  );

  return (
    <Modal
      open
      title={t('campaign.batch.title')}
      width={720}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      okText={t('campaign.batch.import')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending || !ready }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => void run()}
    >
      <Flex vertical gap={12}>
        <Tabs
          activeKey={kind}
          onChange={(key) => setKind(key as Kind)}
          items={[
            {
              key: 'json',
              label: t('campaign.batch.tab.json'),
              children: (
                <Flex vertical gap={8}>
                  <Typography.Text type="secondary">
                    {t('campaign.batch.json.help')}
                  </Typography.Text>
                  <Input.TextArea
                    aria-label={t('campaign.batch.json.label')}
                    dir="ltr"
                    rows={10}
                    spellCheck={false}
                    placeholder={t('campaign.batch.json.placeholder')}
                    value={jsonText}
                    onChange={(event) => {
                      setJsonText(event.target.value);
                      setFailure(null);
                      setRefused([]);
                    }}
                    style={{ fontFamily: 'monospace' }}
                  />
                </Flex>
              ),
            },
            {
              key: 'csv',
              label: t('campaign.batch.tab.csv'),
              children: (
                <Flex vertical gap={8}>
                  <Typography.Text type="secondary">{t('campaign.batch.csv.help')}</Typography.Text>
                  <Typography.Text code data-testid="csv-header">
                    {CSV_HEADER}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t('campaign.batch.csv.dates')}
                  </Typography.Text>
                  <Flex gap={8} wrap align="center">
                    <input
                      ref={input}
                      type="file"
                      accept=".csv,text/csv"
                      style={{ display: 'none' }}
                      onChange={onFile}
                    />
                    <Button onClick={() => input.current?.click()}>
                      {t('campaign.batch.csv.choose')}
                    </Button>
                    <Button onClick={downloadTemplate}>{t('campaign.batch.csv.template')}</Button>
                    {file ? (
                      <Typography.Text style={{ overflowWrap: 'anywhere' }}>
                        {t('campaign.batch.csv.file', {
                          name: file.name,
                          size: formatBytes(file.size, intl.locale),
                        })}
                      </Typography.Text>
                    ) : null}
                  </Flex>
                </Flex>
              ),
            },
          ]}
        />
        <Flex vertical gap={4}>
          {settings?.batchMax ? (
            <Typography.Text type="secondary">
              {t('campaign.batch.limits.max', { max: settings.batchMax })}
            </Typography.Text>
          ) : null}
          {settings?.currency ? (
            <Typography.Text type="secondary">
              {t('campaign.batch.limits.currency', { currency: settings.currency })}
            </Typography.Text>
          ) : null}
          <Typography.Text type="secondary">{t('campaign.batch.local')}</Typography.Text>
        </Flex>
        {outcome}
        <Alert type="warning" showIcon title={t('campaign.batch.overwrite')} />
        {failure ? (
          <Alert
            type="error"
            showIcon
            title={refused.length > 0 ? t('campaign.batch.refused') : failure}
            description={
              refused.length > 0 ? (
                <ul style={{ margin: 0, paddingInlineStart: 20, maxHeight: 160, overflow: 'auto' }}>
                  {refused.slice(0, MAX_SHOWN).map((entry) => (
                    <li key={`${entry.ref}|${entry.text}`} style={{ overflowWrap: 'anywhere' }}>
                      {t('campaign.batch.refused.ref', { ref: entry.ref, reason: entry.text })}
                    </li>
                  ))}
                </ul>
              ) : undefined
            }
          />
        ) : null}
      </Flex>
    </Modal>
  );
}

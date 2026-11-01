import { useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Input,
  Select,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIONS_COLUMN } from '../../components/actionsColumn';
import { DangerConfirmButton } from '../../components/DangerConfirmButton';
import { useLeaveGuard } from '../../hooks/useLeaveGuard';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  getTextRules,
  saveTextRules,
  TEXT_RULE_LEVELS,
  TEXT_RULE_MATCH_MODES,
  TEXT_RULE_NOTE_MAX,
  TEXT_RULE_PATTERN_MAX,
  type TextRuleLevel,
  type TextRuleMatchMode,
} from '../../services/moderation';
import { describeFailure } from '../../session/describe';
import { ConfigForm } from '../config/ConfigForm';
import {
  blankRow,
  hasProblem,
  isDirty,
  type RowProblem,
  type RuleRow,
  regexCompiles,
  rowProblem,
  sameRules,
  sortDetails,
  toInputs,
  toRows,
} from './ruleRows';

type Load = { phase: 'loading' } | { phase: 'ready' } | { phase: 'failed'; text: string };

/**
 * 文本规则 (`MODERATION:CONFIG`): the rule list that text moderation runs before it calls the
 * moderation service, edited as a whole. Saving replaces the whole list, all or nothing; a refusal
 * names the rows by their index and the page keeps everything that was typed.
 */
export default function ModerationRulesPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const intlRef = useRef(intl);
  intlRef.current = intl;

  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [saved, setSaved] = useState<RuleRow[]>([]);
  const [rows, setRows] = useState<RuleRow[]>([]);
  // Problems the backend named, by row index; cleared for a row when that row is edited.
  const [rowErrors, setRowErrors] = useState<Map<number, string[]>>(new Map());
  const [tableErrors, setTableErrors] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [conflict, setConflict] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoad({ phase: 'loading' });
    try {
      const { items } = await getTextRules();
      const fresh = toRows(items);
      setSaved(fresh);
      setRows(fresh.map((row) => ({ ...row })));
      setLoad({ phase: 'ready' });
    } catch (error) {
      setLoad({ phase: 'failed', text: describeFailure(intlRef.current, error).text });
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const clearErrors = () => {
    setRowErrors(new Map());
    setTableErrors([]);
    setFailure(null);
  };

  const edit = (key: string, change: Partial<RuleRow>) => {
    const index = rows.findIndex((row) => row.key === key);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
    setRowErrors((current) => {
      if (!current.has(index)) return current;
      const next = new Map(current);
      next.delete(index);
      return next;
    });
  };

  const { run: save, pending } = useSingleFlight(async () => {
    setConflict(false);
    setChecked(true);
    const bad = rows.filter((row) => hasProblem(rowProblem(row))).length;
    if (bad > 0) {
      setFailure(t('moderation.rules.fixRows', { count: bad }));
      return;
    }
    setFailure(null);
    setTableErrors([]);
    setRowErrors(new Map());
    // The list is saved as a whole, so a save over a newer list would delete the rules another
    // administrator added. Read the list again; if it is no longer the one that was loaded, stop.
    try {
      if (!sameRules(saved, toRows((await getTextRules()).items))) {
        setConflict(true);
        return;
      }
    } catch (error) {
      setFailure(describeFailure(intlRef.current, error).text);
      return;
    }
    try {
      const { items } = await saveTextRules(toInputs(rows));
      const fresh = toRows(items);
      setSaved(fresh);
      setRows(fresh.map((row) => ({ ...row })));
      setChecked(false);
      message.success(t('moderation.rules.saved'));
    } catch (error) {
      const described = describeFailure(intlRef.current, error);
      // A text that is not blank but empty once normalised and folded is refused as empty: say why.
      const fields = described.fields.map((field, at) => {
        const detail = described.error.details[at];
        const row = detail && /^\d+$/.test(detail.ref) ? rows[Number(detail.ref)] : undefined;
        return detail?.reason === 'EMPTY_NOT_ALLOWED' && row && !rowProblem(row).pattern
          ? { ...field, text: t('moderation.rules.patternFoldsEmpty') }
          : field;
      });
      const { byRow, table, other } = sortDetails(fields, rows.length);
      setRowErrors(byRow);
      setTableErrors(table);
      setFailure(
        byRow.size > 0
          ? t('moderation.rules.fixRows', { count: byRow.size })
          : t('moderation.rules.saveFailed', { message: [described.text, ...other].join(' ') }),
      );
    }
  });

  // Takes the list as the backend has it now and drops the edit; the page stays as it is when the read fails.
  const { run: reload, pending: reloading } = useSingleFlight(async () => {
    try {
      const { items } = await getTextRules();
      const fresh = toRows(items);
      setSaved(fresh);
      setRows(fresh.map((row) => ({ ...row })));
      clearErrors();
      setChecked(false);
      setConflict(false);
    } catch (error) {
      setFailure(describeFailure(intlRef.current, error).text);
    }
  });

  const dirty = isDirty(rows, saved);
  useLeaveGuard(dirty);

  if (load.phase === 'loading') {
    return <Spin />;
  }
  if (load.phase === 'failed') {
    return (
      <Alert
        type="error"
        showIcon
        title={t('moderation.rules.loadFailed', { message: load.text })}
        action={
          <Button size="small" onClick={() => void fetchRules()}>
            {t('pages.common.retry')}
          </Button>
        }
      />
    );
  }

  const problemText = (problem: RowProblem): string[] => {
    const texts: string[] = [];
    if (problem.pattern) {
      texts.push(t('moderation.rules.patternLength', { max: TEXT_RULE_PATTERN_MAX }));
    }
    if (problem.note) texts.push(t('moderation.rules.noteLength', { max: TEXT_RULE_NOTE_MAX }));
    return texts;
  };

  const matchModeOptions = TEXT_RULE_MATCH_MODES.map((mode) => ({
    value: mode,
    label: t(`moderation.rules.matchMode.${mode}`),
  }));
  const levelOptions = TEXT_RULE_LEVELS.map((level) => ({
    value: level,
    label: t(`moderation.rules.level.${level}`),
  }));

  return (
    <Flex vertical gap={16}>
      <Card size="small" title={t('moderation.rules.title')}>
        <Flex vertical gap={8}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {t('moderation.rules.intro')}
          </Typography.Paragraph>
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            {TEXT_RULE_MATCH_MODES.map((mode) => (
              <li key={mode}>
                <Typography.Text type="secondary">
                  {t(`moderation.rules.help.${mode}`)}
                </Typography.Text>
              </li>
            ))}
          </ul>
          <Alert
            type="info"
            showIcon
            data-testid="rules-folding-note"
            title={t('moderation.rules.foldingNote')}
          />
        </Flex>
      </Card>

      <Flex vertical gap={12}>
        <Flex gap={12} wrap align="center" justify="space-between">
          <Space wrap>
            <Typography.Text>{t('moderation.rules.count', { count: rows.length })}</Typography.Text>
            {dirty ? (
              <Typography.Text type="warning">{t('moderation.rules.unsaved')}</Typography.Text>
            ) : null}
          </Space>
          <Space wrap>
            <Button
              onClick={() => {
                setRows((current) => [...current, blankRow()]);
              }}
            >
              {t('moderation.rules.add')}
            </Button>
            <Button
              disabled={!dirty || pending}
              onClick={() => {
                setRows(saved.map((row) => ({ ...row })));
                clearErrors();
                setChecked(false);
              }}
            >
              {t('moderation.rules.discard')}
            </Button>
            <Button type="primary" loading={pending} disabled={pending} onClick={() => void save()}>
              {t('moderation.rules.save')}
            </Button>
          </Space>
        </Flex>

        {conflict ? (
          <Alert
            type="warning"
            showIcon
            title={t('moderation.rules.conflict')}
            description={t('moderation.rules.conflictDetail')}
            action={
              <Button size="small" loading={reloading} onClick={() => void reload()}>
                {t('moderation.rules.conflictReload')}
              </Button>
            }
          />
        ) : null}
        {failure ? <Alert type="error" showIcon title={failure} /> : null}
        {tableErrors.map((text) => (
          <Alert
            key={text}
            type="error"
            showIcon
            data-testid="moderation-rules-table-error"
            title={t('moderation.rules.tableError', { message: text })}
          />
        ))}

        <Table<RuleRow>
          size="small"
          rowKey="key"
          pagination={false}
          dataSource={rows}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: t('moderation.rules.empty') }}
          columns={[
            {
              title: t('moderation.rules.index'),
              width: 64,
              render: (_, __, index) => index + 1,
            },
            {
              title: t('moderation.rules.pattern'),
              render: (_, row, index) => {
                const problem = checked ? rowProblem(row) : {};
                const texts = [...problemText(problem), ...(rowErrors.get(index) ?? [])];
                const pattern = row.pattern;
                const regexTrouble =
                  row.matchMode === 'REGEX' && pattern.trim() !== '' && !regexCompiles(pattern);
                return (
                  <Flex vertical gap={2} style={{ width: 320 }}>
                    <Input
                      dir="auto"
                      value={row.pattern}
                      status={texts.length > 0 ? 'error' : undefined}
                      aria-label={`${t('moderation.rules.pattern')} ${index + 1}`}
                      onChange={(event) => edit(row.key, { pattern: event.target.value })}
                    />
                    {texts.map((text) => (
                      <Typography.Text key={text} type="danger" style={{ fontSize: 12 }}>
                        {text}
                      </Typography.Text>
                    ))}
                    {regexTrouble ? (
                      <Typography.Text type="warning" style={{ fontSize: 12 }}>
                        {t('moderation.rules.regexHint')}
                      </Typography.Text>
                    ) : null}
                  </Flex>
                );
              },
            },
            {
              title: t('moderation.rules.matchMode'),
              render: (_, row, index) => (
                <Select<TextRuleMatchMode>
                  style={{ minWidth: 150 }}
                  value={row.matchMode}
                  options={matchModeOptions}
                  aria-label={`${t('moderation.rules.matchMode')} ${index + 1}`}
                  onChange={(value) => edit(row.key, { matchMode: value })}
                />
              ),
            },
            {
              title: t('moderation.rules.level'),
              render: (_, row, index) => (
                <Select<TextRuleLevel>
                  style={{ minWidth: 150 }}
                  value={row.level}
                  options={levelOptions}
                  aria-label={`${t('moderation.rules.level')} ${index + 1}`}
                  onChange={(value) => edit(row.key, { level: value })}
                />
              ),
            },
            {
              title: t('moderation.rules.note'),
              render: (_, row, index) => {
                const problem = checked ? rowProblem(row) : {};
                return (
                  <Flex vertical gap={2} style={{ width: 220 }}>
                    <Input
                      dir="auto"
                      value={row.note}
                      status={problem.note ? 'error' : undefined}
                      aria-label={`${t('moderation.rules.note')} ${index + 1}`}
                      onChange={(event) => edit(row.key, { note: event.target.value })}
                    />
                  </Flex>
                );
              },
            },
            {
              title: t('moderation.rules.actions'),
              ...ACTIONS_COLUMN,
              render: (_, row) => (
                <DangerConfirmButton
                  confirmText={t('moderation.rules.removeConfirm')}
                  onConfirm={async () => {
                    setRows((current) => current.filter((r) => r.key !== row.key));
                    setRowErrors(new Map());
                    setTableErrors([]);
                  }}
                >
                  {t('moderation.rules.remove')}
                </DangerConfirmButton>
              ),
            },
          ]}
        />
      </Flex>

      <Card size="small" title={t('moderation.rules.params')}>
        <Flex vertical gap={12}>
          <Typography.Text type="secondary">{t('moderation.rules.paramsNote')}</Typography.Text>
          <ConfigForm editPermission="MODERATION:CONFIG" exclude={['moderation.text_rules']} />
        </Flex>
      </Card>
    </Flex>
  );
}

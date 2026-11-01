import { useIntl } from '@umijs/max';
import { Card, Table, Tag, Typography } from 'antd';
import { codeText } from '../../utils/displayText';
import { plainText } from '../../utils/plainText';
import type { CoverageRow } from './coverage';

/**
 * The matrix of spec 5.11: a row for each recall reason, a column for each supported language. A
 * cell with a template says whether it is on. A language that has no enabled template falls back
 * to the default language, which the backend lists: it is shown as information, never as an error.
 */
export function TemplateMatrix({ rows, locales }: { rows: CoverageRow[]; locales: string[] }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  return (
    <Card size="small" title={t('push.templates.matrix.title')} data-testid="coverage-matrix">
      <Typography.Paragraph type="secondary">
        {t('push.templates.matrix.note')}
      </Typography.Paragraph>
      <Table<CoverageRow>
        size="small"
        rowKey="reason"
        pagination={false}
        dataSource={rows}
        scroll={{ x: 'max-content' }}
        columns={[
          {
            title: t('push.templates.matrix.reason'),
            dataIndex: 'reason',
            render: (reason: string, row: CoverageRow) => (
              <>
                {codeText(intl, 'push.reason', reason)}
                {row.noneEnabled ? (
                  <Tag data-testid={`row-none-${reason}`} style={{ marginInlineStart: 8 }}>
                    {t('push.templates.matrix.noneEnabled')}
                  </Tag>
                ) : null}
              </>
            ),
          },
          ...locales.map((locale) => ({
            title: plainText(locale),
            key: locale,
            render: (_: unknown, row: CoverageRow) => {
              const cell = row.cells.find((c) => c.locale === locale);
              const found = cell?.template ?? null;
              const fallback = cell?.fallback ?? null;
              // What the backend says decides: a language without a template is shown as falling
              // back only when the backend lists it; otherwise the cell is neutral.
              const state =
                found !== null
                  ? found.enabled
                    ? 'on'
                    : 'off'
                  : fallback === true
                    ? 'fallback'
                    : 'none';
              return (
                <span
                  data-testid={`cell-${row.reason}-${locale}`}
                  data-state={state}
                  data-fallback={fallback === null ? undefined : String(fallback)}
                >
                  {state === 'on' ? (
                    <Tag color="success">{t('push.templates.matrix.on')}</Tag>
                  ) : state === 'none' ? (
                    <Tag>{t('push.templates.matrix.none')}</Tag>
                  ) : (
                    <>
                      {state === 'off' ? <Tag>{t('push.templates.matrix.off')}</Tag> : null}
                      {fallback === true ? (
                        <Tag color="processing">{t('push.templates.matrix.fallback')}</Tag>
                      ) : null}
                    </>
                  )}
                </span>
              );
            },
          })),
        ]}
      />
    </Card>
  );
}

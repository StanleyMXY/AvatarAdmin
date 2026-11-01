import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Flex,
  Statistic,
  Table,
  type TableColumnsType,
  Typography,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../../components/PagedListTable';
import { useLatestCall } from '../../hooks/useLatestCall';
import { type AccountCredits, getAccountCredits, type LedgerRow } from '../../services/credits';
import { describeFailure } from '../../session/describe';
import { DASH, formatCount } from '../../utils/ratio';
import { ledgerColumns } from './ledgerColumns';
import { NegativeBalance } from './NegativeBalance';

/**
 * The credit tab of the user detail: the balance (in the warning colour with its sentence when it is
 * below zero), the two totals, and the ledger newest first. An account that has no credit account
 * yet shows three zeros and an empty ledger. Mount it with `key={accountId}` when the account changes.
 * The caller shows the tab only to an administrator with `SUBSCRIPTION:VIEW`.
 *
 * It does not use `PagedListTable`: that one always draws a search form, and this table has no filter.
 */
export function AccountCreditsPanel({ accountId }: { accountId: string }) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState<AccountCredits | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const begin = useLatestCall();
  // Switching the language changes `intl`; the ledger does not depend on it, so it must not make a new request.
  const intlRef = useRef(intl);
  intlRef.current = intl;

  const load = useCallback(async () => {
    // When two requests overlap, the answer of the newest one is the one that is shown.
    const isCurrent = begin();
    setLoading(true);
    try {
      const answer = await getAccountCredits(accountId, { page, pageSize });
      if (isCurrent()) {
        setData(answer);
        setFailure(null);
      }
    } catch (error) {
      if (isCurrent()) setFailure(describeFailure(intlRef.current, error).text);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [accountId, page, pageSize, begin]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = (n: number | undefined) => (n === undefined ? DASH : formatCount(n, intl.locale));
  const columns = ledgerColumns<LedgerRow>((id) => t(id), intl.messages, intl.locale, {
    withPurchase: true,
  }) as unknown as TableColumnsType<LedgerRow>;

  return (
    <Flex vertical gap={16}>
      <Flex gap={16} wrap>
        <Card size="small" style={{ minWidth: 220 }} data-testid="panel-balance">
          <Statistic
            title={t('credits.account.balance')}
            value=" "
            formatter={() => <NegativeBalance value={data?.balance} withNote />}
          />
        </Card>
        <Card size="small" style={{ minWidth: 180 }} data-testid="panel-earned">
          <Statistic title={t('credits.account.totalEarned')} value={shown(data?.totalEarned)} />
        </Card>
        <Card size="small" style={{ minWidth: 180 }} data-testid="panel-spent">
          <Statistic title={t('credits.account.totalSpent')} value={shown(data?.totalSpent)} />
        </Card>
      </Flex>
      <Typography.Title level={5} style={{ margin: 0 }}>
        {t('credits.account.ledger')}
      </Typography.Title>
      {failure ? (
        <Alert
          type="error"
          showIcon
          title={t('pages.common.loadFailed', { message: failure })}
          action={
            <Button size="small" onClick={() => void load()}>
              {t('pages.common.retry')}
            </Button>
          }
        />
      ) : null}
      <Table<LedgerRow>
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page,
          pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
          },
        }}
      />
    </Flex>
  );
}

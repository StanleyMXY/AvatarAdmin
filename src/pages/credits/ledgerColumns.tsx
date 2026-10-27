import type { ProColumns } from '@ant-design/pro-components';
import { Typography } from 'antd';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { FALL_COLOR, RISE_COLOR } from '../../theme/tokens';
import { formatInstant } from '../../utils/format';
import { DASH, formatCount } from '../../utils/ratio';
import { formatSigned } from './format';

type Translate = (id: string) => string;

type Line = {
  id: string;
  accountId?: string;
  delta: number;
  reason: string;
  purchaseId?: string | null;
  spendKind: string | null;
  featureKey: string | null;
  itemKey: string | null;
  quantity: number | null;
  note: string | null;
  createdAt: string;
};

/** The reason of a ledger line in words; a reason the page does not know is shown as the code itself. */
export const reasonText = (t: Translate, messages: Record<string, unknown>, code: string) =>
  messages[`credits.reason.${code}`] ? t(`credits.reason.${code}`) : code;

const spendKindText = (t: Translate, messages: Record<string, unknown>, code: string | null) => {
  if (code === null) return DASH;
  return messages[`credits.spendKind.${code}`] ? t(`credits.spendKind.${code}`) : code;
};

/** A key (feature, item, purchase): any text, so it is cut to two lines and opens in full on click. */
const key = (value: string | null | undefined) => <EllipsisPopoverText text={value} width={180} />;

/**
 * The columns the account view and the all-accounts list share: change, reason, spend kind,
 * feature, item, quantity, note, time. The caller adds the id and the account; the account view
 * adds the purchase the line belongs to.
 */
export function ledgerColumns<T extends Line>(
  t: Translate,
  messages: Record<string, unknown>,
  locale: string,
  options: { withPurchase: boolean },
): ProColumns<T>[] {
  const common: ProColumns<T>[] = [
    {
      title: t('credits.ledger.delta'),
      dataIndex: 'delta',
      search: false,
      align: 'right',
      render: (_, row) => (
        <span
          data-testid="delta"
          style={{ color: row.delta > 0 ? RISE_COLOR : row.delta < 0 ? FALL_COLOR : undefined }}
        >
          {formatSigned(row.delta, locale)}
        </span>
      ),
    },
    {
      title: t('credits.ledger.reason'),
      dataIndex: 'reason',
      search: false,
      render: (_, row) => reasonText(t, messages, row.reason),
    },
    ...(options.withPurchase
      ? [
          {
            title: t('credits.ledger.purchase'),
            dataIndex: 'purchaseId',
            search: false,
            render: (_: unknown, row: T) => key(row.purchaseId),
          } as ProColumns<T>,
        ]
      : []),
    {
      title: t('credits.ledger.spendKind'),
      dataIndex: 'spendKind',
      search: false,
      render: (_, row) => spendKindText(t, messages, row.spendKind),
    },
    {
      title: t('credits.ledger.feature'),
      dataIndex: 'featureKey',
      search: false,
      render: (_, row) => key(row.featureKey),
    },
    {
      title: t('credits.ledger.item'),
      dataIndex: 'itemKey',
      search: false,
      render: (_, row) => key(row.itemKey),
    },
    {
      title: t('credits.ledger.quantity'),
      dataIndex: 'quantity',
      search: false,
      align: 'right',
      render: (_, row) => formatCount(row.quantity, locale),
    },
    {
      title: t('credits.ledger.note'),
      dataIndex: 'note',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.note} width={240} />,
    },
    {
      title: t('credits.ledger.time'),
      dataIndex: 'createdAt',
      search: false,
      render: (_, row) => <Typography.Text>{formatInstant(row.createdAt, locale)}</Typography.Text>,
    },
  ];
  return common;
}

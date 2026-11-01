import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import { App, Button, Switch } from 'antd';
import { useRef, useState } from 'react';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { PagedListTable } from '../../components/PagedListTable';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import {
  type CreditProduct,
  listAllCreditProducts,
  updateCreditProduct,
} from '../../services/credits';
import { failureLine } from '../../session/failureLine';
import { formatCount } from '../../utils/ratio';
import { assertPackUnchanged, PackChangedError } from './freshPack';
import { ProductModal } from './ProductModal';

/** The on-sale switch of one pack: one request per change, and the switch is back where it was when the backend refuses. */
function SaleSwitch({ pack, onChanged }: { pack: CreditProduct; onChanged: () => void }) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string) => intl.formatMessage({ id });
  const { run, pending } = useSingleFlight(async (enabled: boolean) => {
    try {
      await assertPackUnchanged(pack);
      await updateCreditProduct(pack.id, {
        credits: pack.credits,
        enabled,
        sortOrder: pack.sortOrder,
        ...(pack.surfaces ? { surfaces: pack.surfaces } : {}),
      });
    } catch (error) {
      if (error instanceof PackChangedError)
        message.warning(t('credits.products.changedMeanwhile'));
      else message.error(failureLine(intl, error));
    }
    onChanged();
  });
  return (
    <Switch
      checked={pack.enabled}
      loading={pending}
      aria-label={intl.formatMessage(
        { id: 'credits.products.enabledOf' },
        { store: pack.store, productId: pack.productId },
      )}
      onChange={(checked) => void run(checked)}
    />
  );
}

/** 额度包 (`SUBSCRIPTION:CONFIG`): the packs of every store, on sale or not. */
export default function CreditProductsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [editing, setEditing] = useState<CreditProduct | null | 'new'>(null);
  const reload = () => actionRef.current?.reload();

  const columns: ProColumns<CreditProduct>[] = [
    { title: t('credits.products.store'), dataIndex: 'store', search: false },
    {
      title: t('credits.products.productId'),
      dataIndex: 'productId',
      search: false,
      render: (_, row) => <EllipsisPopoverText text={row.productId} width={220} />,
    },
    {
      title: t('credits.products.credits'),
      dataIndex: 'credits',
      search: false,
      align: 'right',
      render: (_, row) => formatCount(row.credits, intl.locale),
    },
    {
      title: t('credits.products.enabled'),
      dataIndex: 'enabled',
      search: false,
      render: (_, row) => <SaleSwitch pack={row} onChanged={reload} />,
    },
    {
      title: t('credits.products.sortOrder'),
      dataIndex: 'sortOrder',
      search: false,
      align: 'right',
    },
    {
      title: t('credits.common.actions'),
      search: false,
      valueType: 'option',
      fixed: 'right',
      render: (_, row) => (
        <Button type="link" size="small" onClick={() => setEditing(row)}>
          {t('credits.products.editButton')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PagedListTable<CreditProduct>
        rowKey="id"
        columns={columns}
        actionRef={actionRef}
        // A small table of settings: every pack is read (page after page when the backend pages it) and the page is cut here.
        request={async ({ page, pageSize }) => {
          const items = await listAllCreditProducts();
          return {
            items: items.slice((page - 1) * pageSize, page * pageSize),
            total: items.length,
          };
        }}
        toolbar={[
          <Button key="new" type="primary" onClick={() => setEditing('new')}>
            {t('credits.products.new')}
          </Button>,
        ]}
      />
      <ProductModal
        open={editing !== null}
        pack={editing === 'new' || editing === null ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={reload}
      />
    </>
  );
}

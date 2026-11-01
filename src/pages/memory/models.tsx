import { useAccess, useIntl } from '@umijs/max';
import { Alert, Button, Card, Flex, Spin, Table } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { Can } from '../../components/Can';
import { EllipsisPopoverText } from '../../components/EllipsisPopoverText';
import { useFailure } from '../../hooks/useFailure';
import { type EmbeddingModel, listEmbeddingModels } from '../../services/memory';
import { ConfigForm } from '../config/ConfigForm';
import { ModelForm } from './ModelForm';

/** 记忆服务 · embedding 模型: the registered models, registering one, and the parameters that belong to it. */
export default function ModelsPage() {
  const intl = useIntl();
  const access = useAccess() as unknown as { canAccess: (code?: string) => boolean };
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [models, setModels] = useState<EmbeddingModel[] | null>(null);
  const { text: failure, fail, clear } = useFailure();
  const [registering, setRegistering] = useState(false);

  const load = useCallback(async () => {
    try {
      const { items } = await listEmbeddingModels();
      setModels(items);
      clear();
    } catch (error) {
      fail(error);
    }
  }, [fail, clear]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Flex vertical gap={16}>
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
      {!models && !failure ? <Spin /> : null}
      {models ? (
        <>
          {access.canAccess('MEMORY:MODEL_REGISTER') ? (
            <Flex justify="flex-end">
              <Button type="primary" onClick={() => setRegistering(true)}>
                {t('memory.model.register')}
              </Button>
            </Flex>
          ) : null}
          <Table<EmbeddingModel>
            rowKey="modelName"
            dataSource={models}
            pagination={false}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: t('memory.model.empty') }}
            columns={[
              { title: t('memory.model.col.name'), dataIndex: 'modelName' },
              {
                title: t('memory.model.col.teiBaseUrl'),
                dataIndex: 'teiBaseUrl',
                render: (text: string) => <EllipsisPopoverText text={text} width={360} />,
              },
              { title: t('memory.model.col.dimensions'), dataIndex: 'dimensions' },
            ]}
          />
        </>
      ) : null}
      <Can code="MEMORY:MODEL_REGISTER">
        <Card title={t('memory.model.params')}>
          <ConfigForm editPermission="MEMORY:MODEL_REGISTER" />
        </Card>
      </Can>
      <ModelForm
        open={registering}
        onClose={() => setRegistering(false)}
        onSaved={() => {
          setRegistering(false);
          void load();
        }}
      />
    </Flex>
  );
}

import { useIntl } from '@umijs/max';
import { Alert, Button, Card, Flex, Spin, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { PermissionCode } from '../../access/permissionCodes';
import { type ConfigItem, listConfig } from '../../services/config';
import { describeFailure } from '../../session/describe';
import { ConfigRow } from './ConfigRow';
import { specOf } from './configSchema';

type Props = {
  /** Only these keys. */
  keys?: string[];
  /** Every key that starts with one of these. */
  prefixes?: string[];
  /** Every key edited with this permission. The three filters are joined (a key matching any is shown). */
  editPermission?: PermissionCode;
};

const matches = (item: ConfigItem, { keys, prefixes, editPermission }: Props): boolean => {
  if (!keys && !prefixes && !editPermission) return true;
  return (
    Boolean(keys?.includes(item.key)) ||
    Boolean(prefixes?.some((p) => item.key.startsWith(p))) ||
    (editPermission !== undefined && item.editPermission === editPermission)
  );
};

/**
 * The operating parameters, grouped by the part of the key before the first dot. The server sends
 * only the keys this administrator may edit, so every row can be edited; a key the schema does not
 * know is listed in a warning and shown read-only. This is the one way the system page and the
 * "parameters" sections of the modules show configuration.
 */
export function ConfigForm(props: Props) {
  const intl = useIntl();
  const [items, setItems] = useState<ConfigItem[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items: rows } = await listConfig();
      setItems(rows);
      setFailure(null);
    } catch (error) {
      setFailure(describeFailure(intl, error).text);
    }
  }, [intl]);

  useEffect(() => {
    void load();
  }, [load]);

  if (failure) {
    return (
      <Alert
        type="error"
        showIcon
        title={intl.formatMessage({ id: 'pages.common.loadFailed' }, { message: failure })}
        action={
          <Button size="small" onClick={() => void load()}>
            {intl.formatMessage({ id: 'pages.common.retry' })}
          </Button>
        }
      />
    );
  }
  if (items === null) return <Spin />;

  const shown = items.filter((item) => matches(item, props));
  const unknown = shown.filter((item) => !specOf(item.key)).map((item) => item.key);
  const groups = new Map<string, ConfigItem[]>();
  for (const item of shown) {
    const spec = specOf(item.key);
    if (!spec) continue;
    groups.set(spec.group, [...(groups.get(spec.group) ?? []), item]);
  }

  return (
    <Flex vertical gap={16}>
      {unknown.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          title={intl.formatMessage({ id: 'config.unknownKeys' }, { keys: unknown.join(', ') })}
        />
      ) : null}
      {unknown.length > 0 ? (
        <Card size="small" title={intl.formatMessage({ id: 'config.unknownGroup' })}>
          {shown
            .filter((item) => !specOf(item.key))
            .map((item) => (
              <Flex
                key={item.key}
                vertical
                gap={2}
                style={{ padding: '8px 0' }}
                data-testid={`config-unknown-${item.key}`}
              >
                <Typography.Text code>{item.key}</Typography.Text>
                <Typography.Text style={{ overflowWrap: 'anywhere' }}>
                  {item.value === null
                    ? intl.formatMessage({ id: 'config.unset' })
                    : JSON.stringify(item.value)}
                </Typography.Text>
              </Flex>
            ))}
        </Card>
      ) : null}
      {[...groups.entries()].map(([group, rows]) => (
        <Card
          key={group}
          size="small"
          title={
            intl.messages[`config.group.${group}`]
              ? intl.formatMessage({ id: `config.group.${group}` })
              : group
          }
        >
          {rows.map((item) => (
            <ConfigRow
              key={item.key}
              spec={specOf(item.key) as NonNullable<ReturnType<typeof specOf>>}
              item={item}
              onChanged={() => void load()}
            />
          ))}
        </Card>
      ))}
    </Flex>
  );
}

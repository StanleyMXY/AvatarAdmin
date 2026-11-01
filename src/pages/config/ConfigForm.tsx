import { useIntl, useLocation } from '@umijs/max';
import { Alert, Button, Card, Flex, Spin, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PermissionCode } from '../../access/permissionCodes';
import type { ApiError } from '../../request/errors';
import { type ConfigItem, listConfig } from '../../services/config';
import { describeFailure } from '../../session/describe';
import { ConfigRow } from './ConfigRow';
import { specOf } from './configSchema';
import { refusalAlertText, refusalTexts } from './refusal';

type Props = {
  /** Only these keys. */
  keys?: string[];
  /** Every key that starts with one of these. */
  prefixes?: string[];
  /** Every key edited with this permission. The three filters are joined (a key matching any is shown). */
  editPermission?: PermissionCode;
  /** Never these keys, whatever the three filters say (for a page that edits them itself). */
  exclude?: string[];
  /** Called after a value was saved or reset, so a page can refresh what depends on it. */
  onChanged?: () => void;
};

const matches = (item: ConfigItem, { keys, prefixes, editPermission, exclude }: Props): boolean => {
  if (exclude?.includes(item.key)) return false;
  if (!keys && !prefixes && !editPermission) return true;
  return (
    Boolean(keys?.includes(item.key)) ||
    Boolean(prefixes?.some((p) => item.key.startsWith(p))) ||
    (editPermission !== undefined && item.editPermission === editPermission)
  );
};

/** What the backend refused that no row can show; scrolled into view, since the form can be long. */
function TopRefusals({ texts }: { texts: string[] }) {
  const box = useRef<HTMLDivElement>(null);
  const said = texts.join('\n');
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll again when the words change
  useEffect(() => {
    box.current?.scrollIntoView?.({ block: 'nearest' });
  }, [said]);
  return (
    <div ref={box} data-testid="config-refusals">
      <Alert
        type="error"
        showIcon
        title={
          <Flex vertical gap={4}>
            {texts.map((text) => (
              <span key={text}>{text}</span>
            ))}
          </Flex>
        }
      />
    </div>
  );
}

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
  // The last save or reset the backend refused: kept as the failure itself (not as translated
  // words) so the words follow the language, and shared by the rows so that a rule between two
  // keys is shown on both.
  const [refusal, setRefusal] = useState<{ origin: string; error: ApiError } | null>(null);

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

  // `/config#<key>` (the link of a page that needs one setting) scrolls to that row once the rows
  // are drawn; reading the rows again after a save does not scroll back.
  const { hash } = useLocation();
  const scrolledFor = useRef('');
  useEffect(() => {
    if (items === null || !hash || scrolledFor.current === hash) return;
    scrolledFor.current = hash;
    let key = hash.slice(1);
    try {
      key = decodeURIComponent(key);
    } catch {
      // not a valid escape: used as written
    }
    document.getElementById(`config-key-${key}`)?.scrollIntoView?.({ block: 'start' });
  }, [items, hash]);

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

  const shownKeys = new Set(shown.filter((item) => specOf(item.key)).map((item) => item.key));
  const texts = refusal ? refusalTexts(intl, refusal.error, shownKeys, refusal.origin) : null;

  return (
    <Flex vertical gap={16}>
      {texts && texts.top.length > 0 ? <TopRefusals texts={texts.top} /> : null}
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
          {rows.map((item) => {
            const field = texts?.rows.get(item.key) ?? null;
            return (
              <ConfigRow
                key={item.key}
                spec={specOf(item.key) as NonNullable<ReturnType<typeof specOf>>}
                item={item}
                refusalField={field}
                refusalAlert={
                  refusal && refusal.origin === item.key && !field
                    ? refusalAlertText(intl, refusal.error)
                    : null
                }
                onAttempt={() => setRefusal(null)}
                onRefused={(error) => setRefusal({ origin: item.key, error })}
                onChanged={() => {
                  setRefusal(null);
                  void load();
                  props.onChanged?.();
                }}
              />
            );
          })}
        </Card>
      ))}
    </Flex>
  );
}

import { QuestionCircleOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Tooltip } from 'antd';

/**
 * A column title with a hint icon. The hint is the language key `<id>.tip`; the title is the key
 * `<id>` unless `label` is given. The icon can be found by its test id `tip-<last part of the key>`.
 */
export function HeaderTip({ id, label }: { id: string; label?: string }) {
  const intl = useIntl();
  return (
    <span>
      {label ?? intl.formatMessage({ id })}
      <Tooltip title={intl.formatMessage({ id: `${id}.tip` })}>
        <QuestionCircleOutlined
          data-testid={`tip-${id.split('.').pop()}`}
          aria-hidden={false}
          style={{ marginInlineStart: 4 }}
        />
      </Tooltip>
    </span>
  );
}

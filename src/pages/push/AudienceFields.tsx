import { useIntl } from '@umijs/max';
import { Form, type FormInstance, Input, Select } from 'antd';
import { AUDIENCES, PLATFORMS } from '../../services/push';
import { parseAccountIds } from './bodies';
import { codeText } from './texts';

type Props = {
  form: FormInstance;
  /** The supported languages for the language filter; `null` when they are not known (any tag can then be typed). */
  locales: string[] | null;
};

/**
 * Who a task or a periodic push goes to. The form needs the fields `audience`, `accountIdsText`,
 * `platforms` and `locales`. With an account ID list the platform and language filters are
 * disabled and emptied: the backend refuses them there.
 */
export function AudienceFields({ form, locales }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const audience = Form.useWatch('audience', form);
  const byIds = audience === 'ACCOUNT_IDS';
  return (
    <>
      <Form.Item name="audience" label={t('push.audience.label')}>
        <Select
          options={AUDIENCES.map((a) => ({ value: a, label: codeText(intl, 'push.audience', a) }))}
          onChange={(next) => {
            if (next === 'ACCOUNT_IDS') form.setFieldsValue({ platforms: [], locales: [] });
          }}
        />
      </Form.Item>
      {byIds ? (
        <Form.Item
          name="accountIdsText"
          label={t('push.audience.accountIds')}
          extra={t('push.audience.accountIdsHelp')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                if (parseAccountIds(value ?? '').length === 0) {
                  throw new Error(t('push.audience.accountIdsRequired'));
                }
              },
            },
          ]}
        >
          <Input.TextArea rows={3} dir="auto" />
        </Form.Item>
      ) : null}
      <Form.Item
        name="platforms"
        label={t('push.audience.platforms')}
        extra={byIds ? t('push.audience.filtersOff') : t('push.audience.filtersHelp')}
      >
        <Select
          mode="multiple"
          disabled={byIds}
          options={PLATFORMS.map((p) => ({ value: p, label: codeText(intl, 'push.platform', p) }))}
        />
      </Form.Item>
      <Form.Item name="locales" label={t('push.audience.locales')}>
        <Select
          mode={locales === null ? 'tags' : 'multiple'}
          disabled={byIds}
          placeholder={locales === null ? t('push.audience.localesPlaceholder') : undefined}
          tokenSeparators={[',', ' ']}
          options={(locales ?? []).map((tag) => ({ value: tag, label: tag }))}
        />
      </Form.Item>
    </>
  );
}

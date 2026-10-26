import { useIntl } from '@umijs/max';
import { Alert, Flex, Form, Input } from 'antd';
import { type LinkTargetValue, linkTargetRule } from '../../components/LinkTargetField';
import { UploadField } from '../../components/UploadField';
import { trimSpec } from '../../utils/trimSpec';
import { LinkField } from './LinkField';
import { PushImage } from './PushImage';
import { UploadBox } from './UploadBox';
import type { useUploadSlot } from './uploadSlot';

type Props = {
  slot: ReturnType<typeof useUploadSlot>;
  /** The address of the picture the object has now, if it has one. */
  currentImageUrl?: unknown;
  /** The backend did not accept the upload id the form sent: the picture must be uploaded again. */
  rejected: boolean;
};

/**
 * The words, the link and the picture of a push: the part that a template, a manual task and a
 * periodic push have in common. The form needs the fields `title`, `body` and `link`. The picture
 * is uploaded first; only its upload id leaves the form.
 */
export function ContentFields({ slot, currentImageUrl, rejected }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  // The link control for a web address already says what is wrong with it; the rule still blocks
  // the form, but its own message would repeat that text, so for an address it carries none.
  const baseLinkRule = linkTargetRule(intl);
  const linkRule = {
    validator: async (rule: unknown, value: LinkTargetValue | undefined) => {
      try {
        await baseLinkRule.validator(rule, value);
      } catch (error) {
        if (value?.linkType === 'URL') throw new Error('');
        throw error;
      }
    },
  };
  const required = (id: string) => async (_: unknown, value: string | undefined) => {
    if (trimSpec(value ?? '') === '') throw new Error(t(id));
  };
  return (
    <>
      <Form.Item
        name="title"
        label={t('push.content.title')}
        rules={[{ validator: required('push.content.titleRequired') }]}
      >
        <Input dir="auto" />
      </Form.Item>
      <Form.Item
        name="body"
        label={t('push.content.body')}
        rules={[{ validator: required('push.content.bodyRequired') }]}
      >
        <Input.TextArea rows={3} dir="auto" />
      </Form.Item>
      <Form.Item
        name="link"
        label={t('push.content.link')}
        extra={t('push.content.linkHelp')}
        rules={[linkRule]}
      >
        <LinkField />
      </Form.Item>
      <Form.Item label={t('push.content.image')} extra={t('push.content.imageHelp')}>
        <Flex vertical gap={8}>
          {typeof currentImageUrl === 'string' && currentImageUrl !== '' ? (
            <Flex gap={8} align="center">
              <PushImage url={currentImageUrl} size={64} />
              <span>{t('push.content.imageCurrent')}</span>
            </Flex>
          ) : null}
          <UploadBox>
            <UploadField<{ uploadId: string }>
              key={slot.version}
              kind="pushImage"
              onBusyChange={slot.fieldProps.onBusyChange}
              onUploaded={slot.fieldProps.onUploaded}
              onCleared={slot.fieldProps.onCleared}
            />
          </UploadBox>
          {slot.busy ? <Alert type="info" showIcon title={t('push.content.uploadWait')} /> : null}
          {rejected ? (
            <Alert type="error" showIcon title={t('push.content.imageRejected')} />
          ) : null}
        </Flex>
      </Form.Item>
    </>
  );
}

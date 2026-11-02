import { useIntl } from '@umijs/max';
import { Alert, Button, Flex, Form, Input } from 'antd';
import { linkTargetRule } from '../../components/LinkTargetField';
import { UploadField } from '../../components/UploadField';
import type { useUploadSlot } from '../../hooks/useUploadSlot';
import { countCodePoints } from '../../utils/codePoints';
import { trimSpec } from '../../utils/trimSpec';
import { LinkField } from './LinkField';
import { PushImage } from './PushImage';

/** The longest title and body the backend takes, in code points after the ends are cut (contract 8.4; the columns are wider, the interface is not). */
export const TITLE_MAX = 100;
export const BODY_MAX = 500;

type Props = {
  slot: ReturnType<typeof useUploadSlot>;
  /** The address of the picture the object has now, if it has one. */
  currentImageUrl?: unknown;
  /** The backend did not accept the upload id the form sent: the picture must be uploaded again. */
  rejected: boolean;
  /** Set with `onRemoveChange` by a form that edits an object: the picture is to be taken away on save. */
  removeImage?: boolean;
  onRemoveChange?: (remove: boolean) => void;
};

/**
 * The words, the link and the picture of a push: the part that a template, a manual task and a
 * periodic push have in common. The form needs the fields `title`, `body` and `link`. The picture
 * is uploaded first; only its upload id leaves the form.
 */
export function ContentFields({
  slot,
  currentImageUrl,
  rejected,
  removeImage = false,
  onRemoveChange,
}: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  // The address box of the link control says what is wrong with a web address itself.
  const linkRule = linkTargetRule(intl, { quietUrl: true });
  // The number counted is the one the backend counts: code points, after the ends are cut.
  const lengthOf = (value: string | undefined) => countCodePoints(trimSpec(value ?? ''));
  const checked =
    (requiredId: string, tooLongId: string, max: number) =>
    async (_: unknown, value: string | undefined) => {
      if (trimSpec(value ?? '') === '') throw new Error(t(requiredId));
      const count = lengthOf(value);
      if (count > max) throw new Error(intl.formatMessage({ id: tooLongId }, { max, count }));
    };
  const count = (max: number) => ({ show: true, max, strategy: lengthOf });
  const hasPicture = typeof currentImageUrl === 'string' && currentImageUrl !== '';
  return (
    <>
      <Form.Item
        name="title"
        label={t('push.content.title')}
        rules={[
          {
            validator: checked(
              'push.content.titleRequired',
              'push.content.titleTooLong',
              TITLE_MAX,
            ),
          },
        ]}
      >
        <Input dir="auto" count={count(TITLE_MAX)} />
      </Form.Item>
      <Form.Item
        name="body"
        label={t('push.content.body')}
        rules={[
          { validator: checked('push.content.bodyRequired', 'push.content.bodyTooLong', BODY_MAX) },
        ]}
      >
        <Input.TextArea rows={3} dir="auto" count={count(BODY_MAX)} />
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
          {hasPicture ? (
            <Flex gap={8} align="center" wrap>
              <PushImage url={currentImageUrl} size={64} />
              <span>
                {t(
                  removeImage && !slot.uploadId
                    ? 'push.content.imageWillGo'
                    : 'push.content.imageCurrent',
                )}
              </span>
              {onRemoveChange ? (
                <Button size="small" onClick={() => onRemoveChange(!removeImage)}>
                  {t(removeImage ? 'push.content.imageKeep' : 'push.content.imageRemove')}
                </Button>
              ) : null}
            </Flex>
          ) : null}
          <UploadField<{ uploadId: string }>
            key={slot.version}
            kind="pushImage"
            onBusyChange={slot.fieldProps.onBusyChange}
            onUploaded={slot.fieldProps.onUploaded}
            onCleared={slot.fieldProps.onCleared}
          />
          {slot.busy ? <Alert type="info" showIcon title={t('push.content.uploadWait')} /> : null}
          {rejected ? (
            <Alert type="error" showIcon title={t('push.content.imageRejected')} />
          ) : null}
        </Flex>
      </Form.Item>
    </>
  );
}

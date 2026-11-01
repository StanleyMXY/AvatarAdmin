import { useIntl } from '@umijs/max';
import { Alert, App, Form, Input, Modal } from 'antd';
import { useFailure } from '../../hooks/useFailure';
import { RevalidateOnLocaleChange } from '../../hooks/useRevalidateOnLocaleChange';
import { useSingleFlight } from '../../hooks/useSingleFlight';
import { type DefaultAvatar, renameDefaultAvatar } from '../../services/avatar';
import { failureToForm } from '../../utils/failureToForm';
import { trimSpec } from '../../utils/trimSpec';
import { nameProblem } from './avatarName';
import { defaultAvatarFailure } from './defaultAvatarFailure';

type Props = {
  avatar: DefaultAvatar | null;
  onClose: () => void;
  onSaved: () => void;
};

/** Rename a default avatar. Only the name is sent. */
export function RenameDefaultAvatarModal({ avatar, onClose, onSaved }: Props) {
  const intl = useIntl();
  const { message } = App.useApp();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<{ name: string }>();
  const { text: failure, failWith, clear } = useFailure();

  const { run, pending } = useSingleFlight(async (values: { name: string }) => {
    if (!avatar) return;
    clear();
    try {
      await renameDefaultAvatar(avatar.id, trimSpec(values.name));
    } catch (error) {
      failureToForm(intl, form, error, ['name']);
      failWith((words) => defaultAvatarFailure(words, error));
      return;
    }
    message.success(t('avatar.defaults.renamed'));
    onSaved();
    onClose();
  });

  return (
    <Modal
      open={avatar !== null}
      title={t('avatar.defaults.rename')}
      destroyOnHidden
      mask={{ closable: false }}
      onCancel={pending ? undefined : onClose}
      afterClose={() => {
        form.resetFields();
        clear();
      }}
      okText={t('pages.common.submit')}
      cancelText={t('pages.common.cancel')}
      okButtonProps={{ loading: pending, disabled: pending }}
      cancelButtonProps={{ disabled: pending }}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        name="renameDefaultAvatar"
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: avatar?.name ?? '' }}
        onFinish={(values) => run(values)}
      >
        <RevalidateOnLocaleChange />
        <Form.Item
          name="name"
          label={t('avatar.defaults.name')}
          extra={t('avatar.defaults.nameHint')}
          rules={[
            {
              validator: async (_, value: string | undefined) => {
                const problem = nameProblem(value);
                if (problem) throw new Error(t(`avatar.defaults.nameProblem.${problem}`));
              },
            },
          ]}
        >
          <Input dir="auto" />
        </Form.Item>
        {failure ? <Alert type="error" title={failure} showIcon /> : null}
      </Form>
    </Modal>
  );
}

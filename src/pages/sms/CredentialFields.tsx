import { Flex, Input, Typography } from 'antd';
import { plainText } from '../../utils/plainText';
import type { CredentialValues } from './channelRules';

type Props = {
  /** The names the provider declares (`credentialNames` of `GET /sms/meta`): one write-only field for each, in this order. */
  names: readonly string[];
  /** The Form.Item gives these two. */
  value?: CredentialValues;
  onChange?: (value: CredentialValues) => void;
};

/**
 * The credentials of a channel as one field for each name the provider declares. The names are fixed
 * and not typed; each value is write-only (a password box without the eye), and nothing saved is ever
 * put in it, so every box is empty when the dialog opens.
 */
export function CredentialFields({ names, value, onChange }: Props) {
  return (
    <Flex vertical gap={8}>
      {names.map((name) => {
        const shown = plainText(name);
        return (
          <Flex key={name} vertical gap={2}>
            <Typography.Text type="secondary" dir="ltr" style={{ overflowWrap: 'anywhere' }}>
              {shown}
            </Typography.Text>
            <Input.Password
              aria-label={shown}
              value={value?.[name] ?? ''}
              onChange={(event) => onChange?.({ ...value, [name]: event.target.value })}
              autoComplete="new-password"
              visibilityToggle={false}
              spellCheck={false}
              dir="ltr"
            />
          </Flex>
        );
      })}
    </Flex>
  );
}

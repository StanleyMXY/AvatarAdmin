import { useIntl } from '@umijs/max';
import { Alert, Typography } from 'antd';
import { describeFailure } from '../../session/describe';

/**
 * A refusal of the backend, in the current language: the text of the error, and one line for each
 * detail with the name it points to (a switch key or a parameter) and the reason.
 */
export function FailureAlert({ error }: { error: unknown }) {
  const intl = useIntl();
  const { text, fields } = describeFailure(intl, error);
  return (
    <Alert
      type="error"
      showIcon
      title={text}
      description={
        fields.length > 0 ? (
          <div>
            {fields.map((field) => (
              <div key={`${field.ref}:${field.text}`}>
                <Typography.Text code>{field.ref}</Typography.Text> <span>{field.text}</span>
              </div>
            ))}
          </div>
        ) : undefined
      }
    />
  );
}

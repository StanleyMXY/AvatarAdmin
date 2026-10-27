import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormInstance } from 'antd';
import { Form, Input } from 'antd';
import { IntlProvider, useIntl } from 'react-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RevalidateOnLocaleChange } from './useRevalidateOnLocaleChange';

const MESSAGES = {
  'en-US': { required: 'Enter a name', short: 'At least 3 characters', server: 'Taken (en)' },
  'zh-CN': { required: '请填写名称', short: '至少 3 个字符', server: 'Taken (zh)' },
  'th-TH': { required: 'กรุณากรอกชื่อ', short: 'อย่างน้อย 3 ตัวอักษร', server: 'Taken (th)' },
} as const;
type Locale = keyof typeof MESSAGES;

let formRef: FormInstance | null = null;

function Fields({ withHook = true, open = true }: { withHook?: boolean; open?: boolean }) {
  const intl = useIntl();
  const [form] = Form.useForm();
  formRef = form;
  const t = (id: string) => intl.formatMessage({ id });
  return open ? (
    <Form form={form}>
      {withHook ? <RevalidateOnLocaleChange /> : null}
      <Form.Item
        name="name"
        label="name"
        rules={[
          { required: true, message: t('required') },
          { min: 3, message: t('short') },
        ]}
      >
        <Input aria-label="name" />
      </Form.Item>
      <Form.Item name="other" label="other" rules={[{ required: true, message: t('required') }]}>
        <Input aria-label="other" />
      </Form.Item>
    </Form>
  ) : null;
}

const draw = (locale: Locale, ui = <Fields />) => (
  <IntlProvider locale={locale} messages={MESSAGES[locale]} onError={() => {}}>
    {ui}
  </IntlProvider>
);

afterEach(() => {
  formRef = null;
  vi.restoreAllMocks();
});

describe('RevalidateOnLocaleChange', () => {
  it('writes the message of a field that shows one again in the new language and keeps the input', async () => {
    const user = userEvent.setup();
    const { rerender } = render(draw('en-US'));
    await user.type(screen.getByLabelText('name'), 'ab');
    await user.tab();
    expect(await screen.findByText(MESSAGES['en-US'].short)).toBeInTheDocument();

    rerender(draw('zh-CN'));
    expect(await screen.findByText(MESSAGES['zh-CN'].short)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(MESSAGES['en-US'].short)).toBeNull());
    expect(screen.getByLabelText('name')).toHaveValue('ab');

    rerender(draw('th-TH'));
    expect(await screen.findByText(MESSAGES['th-TH'].short)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(MESSAGES['zh-CN'].short)).toBeNull());
  });

  it('does not mark a field that showed no message', async () => {
    const user = userEvent.setup();
    const { rerender } = render(draw('en-US'));
    await user.type(screen.getByLabelText('name'), 'ab');
    await user.tab();
    await screen.findByText(MESSAGES['en-US'].short);
    rerender(draw('zh-CN'));
    await screen.findByText(MESSAGES['zh-CN'].short);
    expect(screen.queryByText(MESSAGES['zh-CN'].required)).toBeNull();
    expect(formRef?.isFieldTouched('other')).toBe(false);
  });

  it('shows nothing when no field showed a message', async () => {
    const { rerender } = render(draw('en-US'));
    rerender(draw('zh-CN'));
    await act(async () => {});
    expect(screen.queryByText(MESSAGES['zh-CN'].required)).toBeNull();
    expect(formRef?.getFieldsError().every((f) => f.errors.length === 0)).toBe(true);
  });

  it('leaves a message that came from the server when the rules of the field pass', async () => {
    const { rerender } = render(draw('en-US'));
    act(() => {
      formRef?.setFieldsValue({ name: 'abcd' });
      formRef?.setFields([{ name: 'name', errors: [MESSAGES['en-US'].server] }]);
    });
    expect(await screen.findByText(MESSAGES['en-US'].server)).toBeInTheDocument();
    rerender(draw('zh-CN'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(formRef?.getFieldError('name')).toEqual([MESSAGES['en-US'].server]);
    expect(screen.getByText(MESSAGES['en-US'].server)).toBeInTheDocument();
    expect(screen.getByLabelText('name')).toHaveValue('abcd');
  });

  it('does not check anything while the language stays the same', async () => {
    const user = userEvent.setup();
    const { rerender } = render(draw('en-US'));
    await user.type(screen.getByLabelText('name'), 'ab');
    await screen.findByText(MESSAGES['en-US'].short);
    const spy = vi.spyOn(formRef as FormInstance, 'validateFields');
    rerender(draw('en-US'));
    await act(async () => {});
    expect(spy).not.toHaveBeenCalled();
  });

  it('is silent while the form is not on screen (a closed dialog)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(draw('en-US', <Fields open={false} />));
    rerender(draw('zh-CN', <Fields open={false} />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(error).not.toHaveBeenCalled();
  });

  it('without it the message stays in the old language', async () => {
    const user = userEvent.setup();
    const { rerender } = render(draw('en-US', <Fields withHook={false} />));
    await user.type(screen.getByLabelText('name'), 'ab');
    await screen.findByText(MESSAGES['en-US'].short);
    rerender(draw('zh-CN', <Fields withHook={false} />));
    await act(async () => {});
    expect(screen.getByText(MESSAGES['en-US'].short)).toBeInTheDocument();
    expect(screen.queryByText(MESSAGES['zh-CN'].short)).toBeNull();
  });
});

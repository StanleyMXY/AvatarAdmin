import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Form, Input } from 'antd';
import { describe, expect, it } from 'vitest';
import { renderWithLocaleSwitch } from '../../tests/failureLanguage';
import { RevalidateOnLocaleChange } from '../hooks/useRevalidateOnLocaleChange';
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import { ApiError } from '../request/errors';
import { failureToForm } from './failureToForm';
import { setFieldReasons } from './fieldReasons';

const invalid = (...refs: string[]) =>
  new ApiError({
    code: 'INVALID_REQUEST',
    httpStatus: 400,
    message: 'raw words',
    data: { details: refs.map((ref) => ({ ref, reason: 'TOO_LONG' })) },
  });
const TOO_LONG = { en: enUS['reason.TOO_LONG'], zh: zhCN['reason.TOO_LONG'] };

type Handle = {
  form: ReturnType<typeof Form.useForm>[0];
  intl: Parameters<typeof failureToForm>[0];
};

/** A form with two boxes; `rules` gives the first one a rule, the second has none. */
function Dialog({ rules, hold }: { rules: boolean; hold: (handle: Handle) => void }) {
  const [form] = Form.useForm();
  // The page gets the translator of its own language, as a dialog does with `useIntl()`.
  const intl = useIntlOfPage();
  hold({ form, intl });
  return (
    <Form form={form}>
      <RevalidateOnLocaleChange />
      <Form.Item
        name="name"
        label="name"
        rules={rules ? [{ required: true, message: 'needed' }] : []}
      >
        <Input />
      </Form.Item>
      <Form.Item name="remark" label="remark">
        <Input />
      </Form.Item>
    </Form>
  );
}

import { useIntl } from 'react-intl';

const useIntlOfPage = () => useIntl() as unknown as Handle['intl'];

function setup(rules: boolean) {
  let handle: Handle | undefined;
  const view = renderWithLocaleSwitch(<Dialog rules={rules} hold={(h) => (handle = h)} />);
  return {
    view,
    put: (error: unknown) =>
      act(() => {
        const { form, intl } = handle as Handle;
        failureToForm(intl, form, error, ['name', 'remark']);
      }),
    form: () => (handle as Handle).form,
  };
}

const shown = () =>
  [...document.querySelectorAll('.ant-form-item-explain-error')].map((n) => n.textContent);

describe('the reasons under the fields are written again when the language is switched', () => {
  it.each([
    ['a form whose field has a rule', true],
    ['a form with no rule at all', false],
  ])('%s', async (_name, rules) => {
    const { view, put } = setup(rules);
    put(invalid('name', 'remark'));
    await waitFor(() => expect(shown()).toEqual([TOO_LONG.en, TOO_LONG.en]));
    await view.switchTo('zh-CN');
    await waitFor(() => expect(shown()).toEqual([TOO_LONG.zh, TOO_LONG.zh]));
    // and back: it follows every switch, not only the first
    await view.switchTo('en-US');
    await waitFor(() => expect(shown()).toEqual([TOO_LONG.en, TOO_LONG.en]));
  });

  it('does not bring back a reason that the person has changed away (the rule says the box is fine)', async () => {
    const { view, put, form } = setup(true);
    put(invalid('name'));
    await waitFor(() => expect(shown()).toEqual([TOO_LONG.en]));
    await userEvent.setup().type(screen.getAllByRole('textbox')[0], 'x');
    await waitFor(() => expect(shown()).toEqual([]));
    await view.switchTo('zh-CN');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(shown()).toEqual([]);
    expect(form().getFieldError('name')).toEqual([]);
  });

  it('does not bring back a reason after the form was reset', async () => {
    const { view, put, form } = setup(false);
    put(invalid('remark'));
    await waitFor(() => expect(shown()).toEqual([TOO_LONG.en]));
    act(() => form().resetFields());
    await waitFor(() => expect(shown()).toEqual([]));
    await view.switchTo('zh-CN');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(shown()).toEqual([]);
  });

  it('follows the newest failure: the field the second one does not name keeps no stale words', async () => {
    const { view, put, form } = setup(false);
    put(invalid('name'));
    await waitFor(() => expect(shown()).toEqual([TOO_LONG.en]));
    // submitted again: the second refusal is about another box, and the first box was cleared
    act(() => form().setFields([{ name: 'name', errors: [] }]));
    put(invalid('remark'));
    await waitFor(() => expect(shown()).toEqual([TOO_LONG.en]));
    await view.switchTo('zh-CN');
    await waitFor(() => expect(shown()).toEqual([TOO_LONG.zh]));
    expect(form().getFieldError('name')).toEqual([]);
    expect(form().getFieldError('remark')).toEqual([TOO_LONG.zh]);
  });

  it('writes a text of the page itself again, from its key', async () => {
    let handle: Handle | undefined;
    const view = renderWithLocaleSwitch(<Dialog rules={false} hold={(h) => (handle = h)} />);
    act(() => {
      const { form, intl } = handle as Handle;
      setFieldReasons(form, intl, [
        { name: 'remark', write: (other) => other.formatMessage({ id: 'auth.password.oldWrong' }) },
      ]);
    });
    await waitFor(() => expect(shown()).toEqual([enUS['auth.password.oldWrong']]));
    await view.switchTo('zh-CN');
    await waitFor(() => expect(shown()).toEqual([zhCN['auth.password.oldWrong']]));
  });

  it('still writes the message of a rule again, and leaves the typed values alone', async () => {
    const { view, form } = setup(true);
    await userEvent.setup().type(screen.getAllByRole('textbox')[1], 'ขอบคุณ');
    await act(async () => {
      await form()
        .validateFields()
        .catch(() => {});
    });
    await waitFor(() => expect(shown()).toEqual(['needed']));
    await view.switchTo('zh-CN');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(form().getFieldValue('remark')).toBe('ขอบคุณ');
  });
});

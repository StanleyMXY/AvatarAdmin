import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import { type LinkReasonKey, validateServerLink } from '../utils/linkRule';
import { LinkInput, linkRule } from './LinkInput';

const BAD: Record<LinkReasonKey, string> = {
  NOT_HTTPS: 'http://example.com/a',
  INVALID_HOST: 'https://exa mple.com/a',
  INVALID_PORT: 'https://example.com:99999x/a',
  INVALID_PATH: 'https://example.com/ü',
  TOO_LONG: `https://example.com/${'a'.repeat(2100)}`,
};

describe('LinkInput', () => {
  it.each(Object.keys(BAD) as LinkReasonKey[])(
    'shows the text of %s in the current language, not the key',
    (key) => {
      const value = BAD[key];
      const check = validateServerLink(value);
      expect(check.ok ? null : check.reasonKey).toBe(key);
      const { unmount } = renderPage(<LinkInput value={value} />);
      expect(screen.getByRole('alert')).toHaveTextContent(enUS[`reason.${key}`]);
      expect(screen.getByRole('alert').textContent).not.toContain(`reason.${key}`);
      unmount();
      renderPage(<LinkInput value={value} />, 'zh-CN');
      expect(screen.getByRole('alert')).toHaveTextContent(zhCN[`reason.${key}`]);
    },
  );

  it('shows nothing for a good link or for an empty one that is not required', () => {
    const { unmount } = renderPage(<LinkInput value="https://example.com/a?x=1#y" />);
    expect(screen.queryByRole('alert')).toBeNull();
    unmount();
    renderPage(<LinkInput value="" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('checks an empty value when it is required', () => {
    renderPage(<LinkInput value="" required />);
    expect(screen.getByRole('alert')).toHaveTextContent(enUS['reason.NOT_HTTPS']);
  });

  it('reports what is typed', () => {
    const onChange = vi.fn();
    renderPage(<LinkInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'https://a.com' } });
    expect(onChange).toHaveBeenCalledWith('https://a.com');
  });

  it('does not repeat the message when a form field already shows it', async () => {
    renderPage(
      <Form>
        <Form.Item name="link" rules={[linkRule({ formatMessage: ({ id }) => enUS[id] })]}>
          <LinkInput showError={false} />
        </Form.Item>
      </Form>,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'http://a.com' } });
    await waitFor(() => expect(screen.getAllByText(enUS['reason.NOT_HTTPS'])).toHaveLength(1));
  });

  it('accepts international host names only as the rule allows (punycode, not raw letters)', () => {
    renderPage(<LinkInput value="https://xn--o3cw4h.example/a" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('linkRule', () => {
  const rule = linkRule({ formatMessage: ({ id }) => enUS[id] }) as {
    validator: (r: unknown, v: string | undefined) => Promise<void>;
  };
  it('passes a good link and an empty one, and throws the text for a bad one', async () => {
    await expect(rule.validator({}, 'https://a.com/x')).resolves.toBeUndefined();
    await expect(rule.validator({}, undefined)).resolves.toBeUndefined();
    await expect(rule.validator({}, 'ftp://a.com')).rejects.toThrow(enUS['reason.NOT_HTTPS']);
  });
  it('refuses an empty link when required', async () => {
    const required = linkRule({ formatMessage: ({ id }) => enUS[id] }, { required: true }) as {
      validator: (r: unknown, v: string | undefined) => Promise<void>;
    };
    await expect(required.validator({}, '')).rejects.toThrow();
  });
});

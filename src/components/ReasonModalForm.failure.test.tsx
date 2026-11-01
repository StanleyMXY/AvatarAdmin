import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { useState } from 'react';
import { IntlProvider } from 'react-intl';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import enUS from '../locales/en-US';
import zhCN from '../locales/zh-CN';
import { ApiError } from '../request/errors';
import { ReasonModalForm } from './ReasonModalForm';

const type = (text: string) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
const refused = (details: { ref: string; reason: string }[]) =>
  new ApiError({
    code: 'INVALID_REQUEST',
    httpStatus: 400,
    message: 'a sentence in English from the backend',
    data: { details },
  });

function Reopens({ onSubmit }: { onSubmit: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open again
      </button>
      <ReasonModalForm
        open={open}
        title="Ban this user"
        onSubmit={onSubmit}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

describe('ReasonModalForm: the failure of a submit', () => {
  it('says what the fields were refused for, besides what the refusal is', async () => {
    const onSubmit = vi.fn(async () => {
      throw refused([{ ref: 'reason', reason: 'OUT_OF_RANGE' }]);
    });
    renderPage(
      <ReasonModalForm open title="Ban this user" onSubmit={onSubmit} onClose={vi.fn()} />,
    );
    type('spam');
    submit();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(enUS['error.INVALID_REQUEST']);
    expect(alert).toHaveTextContent(enUS['reason.OUT_OF_RANGE']);
    expect(alert).not.toHaveTextContent('a sentence in English from the backend');
  });

  it('says the same reason once when two fields were refused for it', async () => {
    const onSubmit = vi.fn(async () => {
      throw refused([
        { ref: 'reason', reason: 'OUT_OF_RANGE' },
        { ref: 'other', reason: 'OUT_OF_RANGE' },
      ]);
    });
    renderPage(
      <ReasonModalForm open title="Ban this user" onSubmit={onSubmit} onClose={vi.fn()} />,
    );
    type('spam');
    submit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent?.split(enUS['reason.OUT_OF_RANGE']).length).toBe(2);
  });

  it('is written in the language of the page when the language is switched while it is shown', async () => {
    const onSubmit = vi.fn(async () => {
      throw refused([{ ref: 'reason', reason: 'OUT_OF_RANGE' }]);
    });
    const ui = (locale: 'en-US' | 'zh-CN') => (
      <IntlProvider locale={locale} messages={locale === 'en-US' ? enUS : zhCN} onError={() => {}}>
        <App>
          <ReasonModalForm open title="Ban this user" onSubmit={onSubmit} onClose={vi.fn()} />
        </App>
      </IntlProvider>
    );
    const view = render(ui('en-US'));
    type('spam');
    submit();
    expect(await screen.findByRole('alert')).toHaveTextContent(enUS['error.INVALID_REQUEST']);
    view.rerender(ui('zh-CN'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(zhCN['error.INVALID_REQUEST']),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(zhCN['reason.OUT_OF_RANGE']);
  });
});

describe('ReasonModalForm: while it is sending and after it is closed', () => {
  it('cannot be closed by the Cancel button or the Escape key while the submit is on its way', async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const onClose = vi.fn();
    renderPage(
      <ReasonModalForm open title="Ban this user" onSubmit={onSubmit} onClose={onClose} />,
    );
    type('spam');
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', keyCode: 27 });
    expect(onClose).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts empty and without the old failure when it is opened again after being closed', async () => {
    const onSubmit = vi.fn(async () => {
      throw refused([{ ref: 'reason', reason: 'OUT_OF_RANGE' }]);
    });
    renderPage(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <Reopens onSubmit={onSubmit} />
      </ConfigProvider>,
    );
    type('spam, kept until the dialog is closed');
    submit();
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'open again' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

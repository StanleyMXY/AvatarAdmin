import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { ApiError } from '../request/errors';
import { ReasonModalForm } from './ReasonModalForm';

const mount = (props: Partial<React.ComponentProps<typeof ReasonModalForm>> = {}) => {
  const onSubmit = props.onSubmit ?? vi.fn(async () => {});
  const onClose = props.onClose ?? vi.fn();
  renderPage(
    <ReasonModalForm open title="Ban this user" onSubmit={onSubmit} onClose={onClose} {...props} />,
  );
  return { onSubmit, onClose };
};

// The parent that closes the dialog when the submit went through, as the pages do.
function ClosesAfterSuccess({ onSubmit }: { onSubmit: (reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <ReasonModalForm
      open={open}
      title="Ban this user"
      onSubmit={async (reason) => {
        await onSubmit(reason);
        setOpen(false);
      }}
      onClose={() => setOpen(false)}
    />
  );
}

const type = (text: string) =>
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

// Spaces the contract trims, written as code points so the source has no invisible characters.
const IDEOGRAPHIC = String.fromCharCode(0x3000);
const NBSP = String.fromCharCode(0xa0);

describe('ReasonModalForm', () => {
  it('sends the reason with its ends trimmed', async () => {
    const { onSubmit } = mount();
    type(`${IDEOGRAPHIC} spam accounts ${NBSP}`);
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('spam accounts'));
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['an ideographic space, a no-break space and a tab', `${IDEOGRAPHIC}${NBSP}\t`],
    ['U+0085 and U+001C, which the contract counts as spaces', '\u0085\u001c'],
  ])('refuses a reason that is %s, without sending', async (_l, text) => {
    const { onSubmit } = mount();
    type(text);
    submit();
    expect(await screen.findByText('Enter a reason')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('counts code points: 500 pass, 501 are refused', async () => {
    const { onSubmit } = mount();
    type('a'.repeat(501));
    submit();
    expect(await screen.findByText('The reason needs 1 to 500 characters')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    type('a'.repeat(500));
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('counts 500 emoji as 500, not 1000', async () => {
    const { onSubmit } = mount();
    type('😀'.repeat(500));
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('counts a Thai text with combining marks per code point', async () => {
    const { onSubmit } = mount({ min: 1, max: 4 });
    type('ก็ก็');
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    type('ก็ก็ก');
    submit();
    expect(await screen.findByText('The reason needs 1 to 4 characters')).toBeInTheDocument();
  });

  it('honours a different range', async () => {
    const { onSubmit } = mount({ min: 5, max: 10 });
    type('abcd');
    submit();
    expect(await screen.findByText('The reason needs 5 to 10 characters')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('stays open and shows the failure when the submit fails, and keeps what was typed', async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError({
        code: 'ADMIN_FORBIDDEN',
        httpStatus: 403,
        message: 'forbidden',
        data: null,
      });
    });
    const { onClose } = mount({ onSubmit });
    type('spam');
    submit();
    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('spam');
  });

  it('shows the backend sentence when the code has no text of its own', async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError({
        code: 'SOMETHING_NEW',
        httpStatus: 400,
        message: 'a brand new rule failed',
        data: null,
      });
    });
    mount({ onSubmit });
    type('spam');
    submit();
    expect(await screen.findByText(/a brand new rule failed/)).toBeInTheDocument();
  });

  it('sends once when the button is pressed many times, and disables the buttons meanwhile', async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    mount({ onSubmit });
    type('spam');
    const button = screen.getByRole('button', { name: /Submit/ });
    fireEvent.click(button);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    release();
  });

  it('sends nothing more once the submit went through and the dialog is closing, even when the button is pressed again', async () => {
    const onSubmit = vi.fn(async () => {});
    renderPage(<ClosesAfterSuccess onSubmit={onSubmit} />);
    type('spam');
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // The dialog is leaving, but its buttons are still in the page for a moment.
    const ok = document.querySelector('.ant-modal-footer .ant-btn-primary') as HTMLElement;
    await waitFor(() =>
      expect(document.querySelector('.ant-modal')?.className).toMatch(/-leave|-hidden/),
    );
    fireEvent.click(ok);
    await new Promise((r) => setTimeout(r, 100));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('closes on cancel and shows the hint', async () => {
    const user = userEvent.setup();
    const { onClose } = mount({ hint: 'Written to the user; one language only' });
    expect(screen.getByText('Written to the user; one language only')).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ['Arabic', 'حساب مزعج ينشر رسائل غير مرغوبة'],
    ['Indonesian', 'Akun spam yang mengirim pesan berulang'],
    ['Vietnamese', 'Tài khoản gửi tin nhắn rác liên tục'],
    ['Spanish', 'Cuenta de spam: envía mensajes repetidos ¿verdad?'],
    ['Chinese', '该账号反复发送垃圾信息'],
    ['English', 'Spam account sending repeated messages'],
  ])('sends a reason written in %s as it is', async (_language, reason) => {
    const { onSubmit } = mount();
    type(`  ${reason}  `);
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(reason));
  });

  it('forgets an old failure when it is submitted again', async () => {
    const onSubmit = vi
      .fn<(reason: string) => Promise<void>>()
      .mockRejectedValueOnce(
        new ApiError({ code: 'ADMIN_FORBIDDEN', httpStatus: 403, message: '', data: null }),
      )
      .mockResolvedValueOnce(undefined);
    mount({ onSubmit });
    type('spam');
    submit();
    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
    submit();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText('You do not have permission to do this.')).toBeNull(),
    );
  });
});

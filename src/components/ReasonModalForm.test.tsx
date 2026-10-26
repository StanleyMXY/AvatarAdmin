import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('closes on cancel and shows the hint', async () => {
    const user = userEvent.setup();
    const { onClose } = mount({ hint: 'Written to the user; one language only' });
    expect(screen.getByText('Written to the user; one language only')).toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});

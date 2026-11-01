import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { EllipsisPopoverText } from './EllipsisPopoverText';

afterEach(() => vi.unstubAllGlobals());

// Built from code points so that no invisible character sits in the source.
const ZWJ = String.fromCodePoint(0x200d);
const [man, woman, girl] = [0x1f468, 0x1f469, 0x1f467].map((c) => String.fromCodePoint(c));

const SAMPLES: [string, string][] = [
  ['Thai without spaces', 'สวัสดีครับวันนี้อากาศดีมากเลยนะครับ'.repeat(10)],
  ['Arabic', 'مرحبا بالعالم، هذا نص طويل جدا '.repeat(12)],
  ['emoji run', `😀${man}${ZWJ}${woman}${ZWJ}${girl}`.repeat(80)],
  ['5000 characters without spaces', 'x'.repeat(5000)],
  ['Vietnamese', 'Xin chào, đây là một đoạn văn bản rất dài. '.repeat(20)],
  ['Indonesian', 'Terima kasih banyak atas bantuannya '.repeat(20)],
  ['Spanish', '¿Cómo estás? Estoy muy bien, gracias. '.repeat(20)],
  ['Chinese', '这是一段很长很长的中文文字没有空格'.repeat(30)],
];

describe('EllipsisPopoverText', () => {
  it.each(SAMPLES)('opens to the whole text on click: %s', async (_name, text) => {
    const user = userEvent.setup();
    renderPage(<EllipsisPopoverText text={text} />);
    await user.click(screen.getByTitle('Show full text'));
    const full = await screen.findByTestId('full-text');
    expect(full.textContent).toBe(text);
  });

  it.each(SAMPLES)('breaks the words anywhere so it never widens the table: %s', (_name, text) => {
    renderPage(<EllipsisPopoverText text={text} />);
    const cell = screen.getByTitle('Show full text');
    expect(cell.style.overflowWrap).toBe('anywhere');
    expect(cell.style.wordBreak).toBe('break-word');
    expect(cell.style.overflow).toBe('hidden');
    expect(cell.style.maxWidth).toBe('240px');
  });

  it('cuts to the number of lines asked for', () => {
    renderPage(<EllipsisPopoverText text="hello" lines={3} />);
    // (the DOM test library drops the vendor-prefixed clamp properties, so the number is read from the element)
    expect(screen.getByTitle('Show full text')).toHaveAttribute('data-lines', '3');
  });

  it('copies the whole text, not the cut one', async () => {
    const writeText = vi.fn(async () => {});
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const text = 'ก'.repeat(500);
    renderPage(<EllipsisPopoverText text={text} />);
    await user.click(screen.getByTitle('Show full text'));
    await user.click(await screen.findByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(text));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('says so when copying is not possible instead of failing silently', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    renderPage(<EllipsisPopoverText text="abc" />);
    await user.click(screen.getByTitle('Show full text'));
    await user.click(await screen.findByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
  });

  it('shows a dash for nothing', () => {
    renderPage(<EllipsisPopoverText text={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('lets each text choose its own direction, so Arabic is not laid out from the left', async () => {
    const user = userEvent.setup();
    renderPage(<EllipsisPopoverText text={'مرحبا بالعالم'} />);
    expect(screen.getByTitle('Show full text')).toHaveAttribute('dir', 'auto');
    await user.click(screen.getByTitle('Show full text'));
    expect(await screen.findByTestId('full-text')).toHaveAttribute('dir', 'auto');
  });

  it('can fix the direction to left-to-right for an identifier that starts with an Arabic letter', async () => {
    const user = userEvent.setup();
    const label = '\u0645***@y***.com';
    renderPage(<EllipsisPopoverText text={label} dir="ltr" />);
    expect(screen.getByTitle('Show full text')).toHaveAttribute('dir', 'ltr');
    await user.click(screen.getByTitle('Show full text'));
    expect(await screen.findByTestId('full-text')).toHaveAttribute('dir', 'ltr');
  });

  it('keeps the text of the cell as the readable name of the button', () => {
    renderPage(<EllipsisPopoverText text="Hello there" />);
    expect(screen.getByRole('button', { name: 'Hello there' })).toBeInTheDocument();
  });

  it('tells assistive technology whether the whole text is open, and claims no popup kind it is not', async () => {
    const user = userEvent.setup();
    renderPage(<EllipsisPopoverText text="Hello there" />);
    const cell = screen.getByRole('button', { name: 'Hello there' });
    expect(cell).toHaveAttribute('aria-expanded', 'false');
    // The popover antd draws is a tooltip (it has a copy button but no dialog semantics of its own)
    expect(cell).not.toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(cell);
    await screen.findByTestId('full-text');
    expect(cell).toHaveAttribute('aria-expanded', 'true');
    // the cell is described by the popover once it is open, and the copy button can be reached by name
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    await user.click(cell);
    await waitFor(() => expect(cell).toHaveAttribute('aria-expanded', 'false'));
  });
});

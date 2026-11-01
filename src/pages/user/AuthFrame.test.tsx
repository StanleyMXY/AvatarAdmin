import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { AuthFrame } from './AuthFrame';

describe('the frame of the pages without a menu', () => {
  it('fills the window by itself and scrolls inside itself, so that the margin of the page body does not give the document a scroll bar and a border of another colour', () => {
    renderPage(
      <AuthFrame titleId="auth.login.title">
        <p>content</p>
      </AuthFrame>,
    );
    const frame = screen.getByTestId('auth-frame');
    expect(frame.style.position).toBe('fixed');
    expect(frame.style.inset).toMatch(/^0(px)?$/);
    expect(frame.style.overflowY).toBe('auto');
    // A height of the window plus a margin around it is what made the document scroll.
    expect(frame.style.minHeight).toBe('');
  });

  it('keeps the card reachable when the window is shorter than the card', () => {
    renderPage(
      <AuthFrame titleId="auth.login.title">
        <p>content</p>
      </AuthFrame>,
    );
    // Centred with automatic margins, not with `justify-content: center`, which cuts off the top of
    // a content that is taller than its box.
    const card = screen.getByText('content').closest('.ant-card') as HTMLElement;
    expect(card.style.margin).toBe('auto');
    expect(screen.getByTestId('auth-frame').style.justifyContent).toBe('');
  });
});

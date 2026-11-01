import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { HeaderTip } from './HeaderTip';

describe('HeaderTip', () => {
  it('writes the title of the key and the hint of the key with .tip, found by the last part of the key', async () => {
    renderPage(<HeaderTip id="campaign.stats.col.cpi" label="CPI (USD)" />);
    expect(screen.getByText('CPI (USD)')).toBeInTheDocument();
    await userEvent.setup().hover(screen.getByTestId('tip-cpi'));
    await waitFor(() =>
      expect(document.body.textContent).toContain('Total cost divided by installs.'),
    );
  });

  it('takes the title from the language file when no label is given', () => {
    renderPage(<HeaderTip id="campaign.stats.col.cpi" />);
    expect(screen.getByText(/^CPI/)).toBeInTheDocument();
  });
});

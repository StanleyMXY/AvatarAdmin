import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { ReadState } from './ReadState';

describe('ReadState', () => {
  it('shows the words of the failure with a retry that reads again', async () => {
    const onRetry = vi.fn();
    renderPage(<ReadState failure="Something went wrong." loading={false} onRetry={onRetry} />);
    expect(screen.getByText(/Something went wrong\./)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner while reading', () => {
    const { container } = renderPage(<ReadState failure={null} loading onRetry={() => {}} />);
    expect(container.querySelector('.ant-spin')).not.toBeNull();
  });

  it('draws nothing once the read has succeeded', () => {
    const { container } = renderPage(
      <ReadState failure={null} loading={false} onRetry={() => {}} />,
    );
    expect(container.querySelector('.ant-spin')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the failure rather than the spinner when both are set', () => {
    const { container } = renderPage(<ReadState failure="Failed." loading onRetry={() => {}} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(container.querySelector('.ant-spin')).toBeNull();
  });
});

import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderPage } from '../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../tests/stubs/umi-max';
import access from '../access';
import { MaskedText } from './MaskedText';

beforeEach(() => resetUmiStub());
const as = (permissions: string[], superAdmin = false) =>
  setTestAccess(access({ me: { superAdmin, permissions } }) as unknown as Record<string, unknown>);

describe('MaskedText', () => {
  it('shows the mask exactly as received', () => {
    as([]);
    renderPage(<MaskedText value="a***@example.com" />);
    expect(screen.getByText('a***@example.com')).toBeInTheDocument();
  });

  it('shows a dash for nothing', () => {
    as([]);
    renderPage(<MaskedText value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('says which permission shows the full value, only to someone without it', () => {
    as([]);
    const { unmount } = renderPage(<MaskedText value="***" needsCode="USER:EMAIL_VIEW" />);
    expect(
      screen.getByText(/USER:EMAIL_VIEW|permission to see the full value/),
    ).toBeInTheDocument();
    unmount();
    as(['USER:EMAIL_VIEW']);
    renderPage(<MaskedText value="***" needsCode="USER:EMAIL_VIEW" />);
    expect(screen.queryByText(/permission to see the full value/)).toBeNull();
  });

  it('keeps a long value without spaces inside its box and works for any script', () => {
    as([]);
    for (const text of ['ก'.repeat(300), 'م'.repeat(200), '😀'.repeat(100), 'Nguyễn***']) {
      const { container, unmount } = renderPage(<MaskedText value={text} />);
      expect(container.textContent).toContain(text);
      expect((container.querySelector('.ant-typography') as HTMLElement).style.overflowWrap).toBe(
        'anywhere',
      );
      unmount();
    }
  });
});

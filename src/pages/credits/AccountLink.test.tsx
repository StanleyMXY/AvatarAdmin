import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderPage } from '../../../tests/renderPage';
import { resetUmiStub, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { AccountLink } from './AccountLink';

const as = (permissions: string[]) =>
  setTestAccess(
    access({ me: { superAdmin: false, permissions } }) as unknown as Record<string, unknown>,
  );

beforeEach(() => resetUmiStub());

describe('the account ID of the credit pages', () => {
  it('is a link to the credit tab of the user page for an administrator who may open the user page', () => {
    as(['SUBSCRIPTION:VIEW', 'USER:VIEW']);
    renderPage(<AccountLink accountId="10000000001" />);
    const link = screen.getByRole('link', { name: '10000000001' });
    expect(link.getAttribute('href')).toBe('/users/10000000001?tab=credits');
  });

  it('is plain text, not a link into a page that would refuse, for one who may not', () => {
    as(['SUBSCRIPTION:VIEW']);
    renderPage(<AccountLink accountId="10000000001" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('10000000001')).toBeInTheDocument();
  });

  it('keeps an id of 5000 characters inside two lines, as a link and as text', () => {
    const long = 'x'.repeat(5000);
    as(['USER:VIEW']);
    const linked = renderPage(<AccountLink accountId={long} />);
    expect(linked.container.querySelector('a')?.style.overflowWrap).toBe('anywhere');
    linked.unmount();
    as([]);
    const plain = renderPage(<AccountLink accountId={long} />);
    const text = plain.container.querySelector('[title]') as HTMLElement;
    expect(text.style.overflowWrap).toBe('anywhere');
    expect(text.style.maxWidth).toBe('260px');
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetUmiStub, setTestAccess } from '../../tests/stubs/umi-max';
import access from '../access';
import { Can } from './Can';

beforeEach(() => resetUmiStub());

const as = (me: { superAdmin: boolean; permissions: string[] }) =>
  setTestAccess(access({ me }) as unknown as Record<string, unknown>);

describe('Can', () => {
  it('shows the children to an administrator who holds the code', () => {
    as({ superAdmin: false, permissions: ['USER:BAN'] });
    render(
      <Can code="USER:BAN">
        <button type="button">Ban</button>
      </Can>,
    );
    expect(screen.getByRole('button', { name: 'Ban' })).toBeInTheDocument();
  });

  it('shows nothing without the code, and the fallback when there is one', () => {
    as({ superAdmin: false, permissions: ['USER:VIEW'] });
    const { rerender } = render(
      <Can code="USER:BAN">
        <button type="button">Ban</button>
      </Can>,
    );
    expect(screen.queryByRole('button', { name: 'Ban' })).toBeNull();
    rerender(
      <Can code="USER:BAN" fallback={<span>no right</span>}>
        <button type="button">Ban</button>
      </Can>,
    );
    expect(screen.getByText('no right')).toBeInTheDocument();
  });

  it('matches the code exactly: no prefix, no wildcard, case sensitive', () => {
    as({ superAdmin: false, permissions: ['USER:BAN_ALL', 'USER', 'user:ban', 'USER:*'] });
    render(
      <Can code="USER:BAN">
        <span>yes</span>
      </Can>,
    );
    expect(screen.queryByText('yes')).toBeNull();
  });

  it('always shows to a super administrator', () => {
    as({ superAdmin: true, permissions: [] });
    render(
      <Can code="USER:BAN">
        <span>yes</span>
      </Can>,
    );
    expect(screen.getByText('yes')).toBeInTheDocument();
  });

  it('shows nothing when nobody is signed in', () => {
    as({ superAdmin: false, permissions: [] });
    setTestAccess(access(undefined) as unknown as Record<string, unknown>);
    render(
      <Can code="USER:BAN">
        <span>yes</span>
      </Can>,
    );
    expect(screen.queryByText('yes')).toBeNull();
  });
});

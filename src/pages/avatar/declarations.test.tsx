import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarState } from '../../../mock/_core/avatarData';
import avatarMock from '../../../mock/avatar.mock';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';
import DeclarationsPage from './declarations';
import { META, signIn, writesOf } from './testSetup';

const backend = () => useMockBackend({ default: avatarMock });

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => signIn('root'));

const rowOf = async (version: string) =>
  (await screen.findByText(version)).closest('tr') as HTMLTableRowElement;

describe('the upload declaration page', { timeout: 30000 }, () => {
  it('lists the versions with the languages, since when each is in force and which one is in force now', async () => {
    backend();
    renderPage(<DeclarationsPage />);
    const current = await rowOf('2026-10-v2');
    expect(within(current).getByText('In force')).toBeInTheDocument();
    expect(within(current).getByText('ar, en, es, id, th, vi, zh-Hans')).toBeInTheDocument();
    const draft = await rowOf('2026-11-v3-draft');
    expect(within(draft).getByText('—')).toBeInTheDocument();
    expect(within(draft).queryByText('In force')).not.toBeInTheDocument();
    expect(within(draft).getByText('No')).toBeInTheDocument();
  });

  it('shows "this deployment does not require the declaration" only when meta says declarationRequired is false', async () => {
    const notice = 'This deployment does not require the declaration to be ticked.';
    backend();
    setTestInitialState({ me: {}, meta: { ...META, declarationRequired: false } });
    const first = renderPage(<DeclarationsPage />);
    expect(await screen.findByText(notice)).toBeInTheDocument();
    first.unmount();

    setTestInitialState({ me: {}, meta: { ...META, declarationRequired: true } });
    const second = renderPage(<DeclarationsPage />);
    await rowOf('2026-10-v2');
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
    second.unmount();

    // A meta without the value (it could not be read) shows nothing either.
    const { declarationRequired: _left, ...without } = META;
    setTestInitialState({ me: {}, meta: without });
    renderPage(<DeclarationsPage />);
    await rowOf('2026-10-v2');
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
  });

  it('creates a version with its texts in several languages, as POST /declarations, and does not put it in force', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DeclarationsPage />);
    await user.click(await screen.findByRole('button', { name: 'New version' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Version'), { target: { value: ' 2027-v1 ' } });
    fireEvent.change(within(dialog).getByLabelText('en'), { target: { value: ' I agree ' } });
    fireEvent.change(within(dialog).getByLabelText('th'), { target: { value: 'ฉันยอมรับ' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/declarations',
      body: { version: '2027-v1', texts: { en: 'I agree', th: 'ฉันยอมรับ' } },
    });
    const created = await rowOf('2027-v1');
    expect(within(created).queryByText('In force')).not.toBeInTheDocument();
  });

  it('asks for a version and for a text, and says when the version exists already', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DeclarationsPage />);
    await user.click(await screen.findByRole('button', { name: 'New version' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a version.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Enter the text in at least one language.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText('Version'), { target: { value: '2026-10-v2' } });
    fireEvent.change(within(dialog).getByLabelText('en'), { target: { value: 'x' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('An item with the same unique value already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('puts a version in force after a question that says old versions are refused, and only then', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DeclarationsPage />);
    const draft = await rowOf('2026-11-v3-draft');
    await user.click(within(draft).getByRole('button', { name: 'Set in force' }));
    expect(
      await screen.findByText(/an older version held by a client will be refused/),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/declarations/2026-11-v3-draft/activate',
    });
    await waitFor(async () =>
      expect(within(await rowOf('2026-11-v3-draft')).getByText('In force')).toBeInTheDocument(),
    );
    expect(within(await rowOf('2026-10-v2')).queryByText('In force')).not.toBeInTheDocument();
  });

  it('has no button for the version that is in force already', async () => {
    backend();
    renderPage(<DeclarationsPage />);
    const current = await rowOf('2026-10-v2');
    expect(within(current).queryByRole('button', { name: 'Set in force' })).not.toBeInTheDocument();
  });

  it('says why when the backend refuses (the version is gone) and reads the list again', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DeclarationsPage />);
    const draft = await rowOf('2026-11-v3-draft');
    avatarState.declarations = avatarState.declarations.filter(
      (d) => d.version !== '2026-11-v3-draft',
    );
    await user.click(within(draft).getByRole('button', { name: 'Set in force' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText('The item was not found.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('2026-11-v3-draft')).not.toBeInTheDocument());
  });

  it('shows no write button to an administrator without DECLARATION:MANAGE in the interface', async () => {
    backend();
    setTestAccess(access({ me: { superAdmin: false, permissions: ['GENERATION:VIEW'] } }));
    renderPage(<DeclarationsPage />);
    const draft = await rowOf('2026-11-v3-draft');
    expect(within(draft).queryByRole('button', { name: 'Set in force' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New version' })).not.toBeInTheDocument();
  });
});

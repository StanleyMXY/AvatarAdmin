import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarState } from '../../../mock/_core/avatarData';
import avatarMock from '../../../mock/avatar.mock';
import channelsMock from '../../../mock/channels.mock';
import { fileOf, pngBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import ActionsPage from './actions';
import { chooseOption, signIn, stubObjectUrls, uploads, writesOf } from './testSetup';

vi.mock('../../request/upload', async () => (await import('./testSetup')).uploadModule);

const backend = () => useMockBackend({ default: avatarMock }, { default: channelsMock });

beforeEach(() => {
  signIn('root');
  stubObjectUrls();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rowOf = async (key: string) => {
  const cell = await screen.findByText(key);
  return cell.closest('tr') as HTMLTableRowElement;
};
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });

describe('the action catalog page: the list', { timeout: 30000 }, () => {
  it('has the columns of the spec and no type column, and no curve upload anywhere', async () => {
    backend();
    renderPage(<ActionsPage />);
    await rowOf('wave');
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(
      expect.arrayContaining([
        'Key',
        'Name',
        'Icon',
        'Styles',
        'Shown on',
        'Triggered by',
        'On',
        'Order',
        'Actions',
      ]),
    );
    expect(headers.some((h) => /^(Type|Kind|Curve)/i.test(h ?? ''))).toBe(false);
    expect(document.body.textContent).not.toMatch(/curve/i);
  });

  it('shows who can trigger each action, the icon or a placeholder, and the switch', async () => {
    backend();
    renderPage(<ActionsPage />);
    const wave = await rowOf('wave');
    expect(within(wave).getByText('User and agent')).toBeInTheDocument();
    expect(wave.querySelector('img')?.getAttribute('src')).toContain('mock-files');
    expect(within(await rowOf('smile')).getByText('User')).toBeInTheDocument();
    expect(within(await rowOf('shy')).getByText('Agent')).toBeInTheDocument();
    expect(within(await rowOf('nod')).getByTestId('no-picture')).toBeInTheDocument();
    expect(
      within(await rowOf('blow_kiss'))
        .getByRole('switch')
        .getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('turns an action off or on with one PUT to /enabled', async () => {
    const calls = backend();
    renderPage(<ActionsPage />);
    fireEvent.click(within(await rowOf('wave')).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/actions/1/enabled',
      body: { enabled: false },
    });
  });
});

describe('the action catalog page: generating for the looks that exist', { timeout: 30000 }, () => {
  it('has the button on every row, and it is disabled for an action that is off', async () => {
    backend();
    renderPage(<ActionsPage />);
    for (const key of ['wave', 'smile', 'shy', 'nod', 'dance']) {
      const button = within(await rowOf(key)).getByRole('button', {
        name: 'Generate for existing looks',
      });
      expect(button, key).toBeEnabled();
    }
    expect(
      within(await rowOf('blow_kiss')).getByRole('button', { name: 'Generate for existing looks' }),
    ).toBeDisabled();
  });

  it('asks first, and the question says that it costs money; nothing is sent before it is confirmed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    await user.click(
      within(await rowOf('wave')).getByRole('button', { name: 'Generate for existing looks' }),
    );
    expect(await screen.findByText(/generation costs money/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('says how many tasks were scheduled, from the answer', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    await user.click(
      within(await rowOf('wave')).getByRole('button', { name: 'Generate for existing looks' }),
    );
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText('7 generation tasks scheduled.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/actions/1/backfill',
    });
  });

  it('says that no look needs a clip when the answer is 0', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    await user.click(
      within(await rowOf('nod')).getByRole('button', { name: 'Generate for existing looks' }),
    );
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(await screen.findByText('No look needs a clip.')).toBeInTheDocument();
    expect(screen.queryByText(/generation tasks scheduled/)).not.toBeInTheDocument();
  });

  it('says why when the backend refuses (the action was switched off meanwhile) and reads the list again', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    const row = await rowOf('wave');
    const action = avatarState.actions.find((a) => a.key === 'wave');
    if (action) action.enabled = false;
    await user.click(within(row).getByRole('button', { name: 'Generate for existing looks' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    await waitFor(async () =>
      expect(
        within(await rowOf('wave'))
          .getByRole('switch')
          .getAttribute('aria-checked'),
      ).toBe('false'),
    );
  });

  it('sends one request when the confirmation is pressed twice at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    await user.click(
      within(await rowOf('wave')).getByRole('button', { name: 'Generate for existing looks' }),
    );
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await new Promise((r) => setTimeout(r, 200));
    expect(writesOf(calls)).toHaveLength(1);
  });
});

describe('the action catalog page: permissions', { timeout: 30000 }, () => {
  it('without ACTION:MANAGE in the interface there is no new, edit or generate button and the switch is off', async () => {
    backend();
    // The token may do everything; what the page shows follows the codes the interface holds.
    setTestAccess(access({ me: { superAdmin: false, permissions: ['GENERATION:VIEW'] } }));
    renderPage(<ActionsPage />);
    const row = await rowOf('wave');
    expect(within(row).getByRole('switch')).toBeDisabled();
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Generate for existing looks' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New action' })).not.toBeInTheDocument();
  });
});

describe('the action catalog page: new and edit', { timeout: 60000 }, () => {
  it("creates an action with the icon's uploadId and exactly the fields of the entity (no kind, no curve)", async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    await user.click(await screen.findByRole('button', { name: 'New action' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'spin' } });
    fireEvent.change(within(dialog).getByLabelText('en'), { target: { value: 'Spin' } });
    fireEvent.change(within(dialog).getByLabelText('Description for the agent'), {
      target: { value: 'Turns around once.' },
    });
    fireEvent.change(within(dialog).getByLabelText('Generation text'), {
      target: { value: 'The person turns around slowly.' },
    });
    choose(fileOf(pngBytes(64, 64), 'spin.png'));
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].url).toBe('/uploads/catalog-image');
    await within(dialog).findByText(/spin\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const body = writesOf(calls)[0].body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      [
        'compatibleStyles',
        'description',
        'enabled',
        'generationSpec',
        'iconUploadId',
        'key',
        'names',
        'sortOrder',
        'surfaces',
        'triggerableBy',
      ].sort(),
    );
    expect(body).toMatchObject({ key: 'spin', triggerableBy: 'BOTH', names: { en: 'Spin' } });
    expect(await screen.findByText('spin')).toBeInTheDocument();
  });

  it('does not send without an icon', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    await user.click(await screen.findByRole('button', { name: 'New action' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'spin' } });
    fireEvent.change(within(dialog).getByLabelText('en'), { target: { value: 'Spin' } });
    fireEvent.change(within(dialog).getByLabelText('Description for the agent'), {
      target: { value: 'Turns.' },
    });
    fireEvent.change(within(dialog).getByLabelText('Generation text'), {
      target: { value: 'turns' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Upload an icon first.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it.each([
    ['User', 'USER'],
    ['Agent', 'AGENT'],
    ['User and agent', 'BOTH'],
  ])('lets the trigger be %s and sends %s', async (label, value) => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    const row = await rowOf('smile');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Key')).toBeDisabled();
    // Start from another value so that the change is real.
    await chooseOption(user, 'Triggered by', value === 'USER' ? 'Agent' : 'User', dialog);
    await chooseOption(user, 'Triggered by', label, dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/actions/2',
      body: { triggerableBy: value },
    });
    expect('iconUploadId' in (writesOf(calls)[0].body as object)).toBe(false);
  });

  it('checks the generation text in code points: 2001 Arabic letters are too many, 2000 emoji are fine', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<ActionsPage />);
    await user.click(within(await rowOf('smile')).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Generation text'), {
      target: { value: 'ب'.repeat(2001) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The generation text must be 1 to 2000 characters long.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    fireEvent.change(within(dialog).getByLabelText('Generation text'), {
      target: { value: '😀'.repeat(2000) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });
});

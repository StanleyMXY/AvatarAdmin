import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarState, GENERATION_MS } from '../../../mock/_core/avatarData';
import avatarMock from '../../../mock/avatar.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { fileOf, pngBytes, zipBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { DEFAULT_AVATAR_FAILURE_REASONS } from '../../services/avatar';
import DefaultAvatarsPage from './defaultAvatars';
import { chooseOption, META, signIn, stubObjectUrls, uploads, writesOf } from './testSetup';

vi.mock('../../request/upload', async () => (await import('./testSetup')).uploadModule);

const backend = () => useMockBackend({ default: avatarMock });

beforeEach(() => {
  signIn('root');
  stubObjectUrls();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const MIRA = 'Mira'; // da-5: READY and active
const THAI = 'สวัสดีครับ วันนี้อากาศดีมาก'; // da-4: READY, not active
const ARABIC = 'مرحبا بك في التطبيق'; // da-3: DRAFT, failed with SUBJECT_UNDERAGE
const LUNA = 'Luna 😀'; // da-2: GENERATING
const LONG = 'A'.repeat(30); // da-1: DRAFT, no reason

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement;
/** The buttons of the actions cell (the last one) of a row; the name in the first cell is a button too. */
const buttonsOf = (row: HTMLElement) =>
  within(row.querySelector('td:last-child') as HTMLElement)
    .queryAllByRole('button')
    .map((b) => b.textContent);
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });
const png = (name = 'portrait.png') => fileOf(pngBytes(200, 200), name);

describe('the default avatar page: the list', { timeout: 30000 }, () => {
  it('lists the avatars newest first with name, style, both pictures (a placeholder where there is none), state and whether it is active', async () => {
    backend();
    renderPage(<DefaultAvatarsPage />);
    await rowOf(MIRA);
    const names = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    const order = [LONG, LUNA, ARABIC, THAI, MIRA].map((n) =>
      names.findIndex((t) => t.includes(n)),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i > 0)).toBe(true);
    const mira = await rowOf(MIRA);
    expect(within(mira).getByText('Realistic')).toBeInTheDocument();
    expect(within(mira).getByText('Ready')).toBeInTheDocument();
    expect(within(mira).getByText('Active')).toBeInTheDocument();
    expect(mira.querySelectorAll('img')).toHaveLength(2);
    const draft = await rowOf(ARABIC);
    expect(draft.querySelectorAll('img')).toHaveLength(1);
    expect(within(draft).getByTestId('no-picture')).toBeInTheDocument();
    const bare = await rowOf(LONG);
    expect(within(bare).getAllByTestId('no-picture')).toHaveLength(2);
  });

  it('reads the list again each time and uses the new addresses', async () => {
    backend();
    const first = renderPage(<DefaultAvatarsPage />);
    const before = (await rowOf(MIRA)).querySelector('img')?.getAttribute('src');
    first.unmount();
    renderPage(<DefaultAvatarsPage />);
    const after = (await rowOf(MIRA)).querySelector('img')?.getAttribute('src');
    expect(after).not.toBe(before);
  });

  it('shows the reason beside a draft that failed, in words, for each of the six reasons', async () => {
    const words: Record<string, string> = {
      CONTENT_REJECTED: 'Content rejected',
      GENERATION_FAILED: 'Generation failed',
      EXTERNAL_TIMEOUT: 'The generation service took too long',
      EXTERNAL_TASK_LOST: 'The generation service lost the task',
      SUBJECT_UNDERAGE: 'The person looks underage',
      NO_FACE_DETECTED: 'No face found in the picture',
    };
    expect(Object.keys(words).sort()).toEqual([...DEFAULT_AVATAR_FAILURE_REASONS].sort());
    backend();
    for (const reason of DEFAULT_AVATAR_FAILURE_REASONS) {
      const draft = avatarState.defaultAvatars.find((d) => d.id === 'da-3');
      if (draft) draft.failureReason = reason;
      const view = renderPage(<DefaultAvatarsPage />);
      const row = await rowOf(ARABIC);
      expect(within(row).getByTestId('failure-reason').textContent, reason).toBe(
        `Last generation failed: ${words[reason]}`,
      );
      view.unmount();
    }
  });

  it('shows the reason only beside a draft: a READY or generating avatar that still carries one shows none', async () => {
    for (const d of avatarState.defaultAvatars) {
      if (d.id === 'da-4' || d.id === 'da-2') d.failureReason = 'GENERATION_FAILED';
    }
    backend();
    renderPage(<DefaultAvatarsPage />);
    expect(within(await rowOf(THAI)).queryByTestId('failure-reason')).not.toBeInTheDocument();
    expect(within(await rowOf(LUNA)).queryByTestId('failure-reason')).not.toBeInTheDocument();
    expect(within(await rowOf(ARABIC)).getByTestId('failure-reason')).toBeInTheDocument();
  });

  it('shows no reason on a draft that has none, and none on an avatar that is not a draft', async () => {
    backend();
    renderPage(<DefaultAvatarsPage />);
    expect(within(await rowOf(LONG)).queryByTestId('failure-reason')).not.toBeInTheDocument();
    expect(within(await rowOf(MIRA)).queryByTestId('failure-reason')).not.toBeInTheDocument();
  });
});

describe('the default avatar page: the buttons follow the state', { timeout: 30000 }, () => {
  it('DRAFT: Generate, Rename, Delete', async () => {
    backend();
    renderPage(<DefaultAvatarsPage />);
    expect(buttonsOf(await rowOf(ARABIC))).toEqual(['Generate', 'Rename', 'Delete']);
    expect(buttonsOf(await rowOf(LONG))).toEqual(['Generate', 'Rename', 'Delete']);
  });

  it('GENERATING: shows it is running and has no button', async () => {
    backend();
    renderPage(<DefaultAvatarsPage />);
    const row = await rowOf(LUNA);
    expect(within(row).getByText('Generating')).toBeInTheDocument();
    expect(buttonsOf(row)).toEqual([]);
  });

  it('READY and not active: Set active, Rename, Delete', async () => {
    backend();
    renderPage(<DefaultAvatarsPage />);
    expect(buttonsOf(await rowOf(THAI))).toEqual(['Set active', 'Rename', 'Delete']);
  });

  it('active: Rename only, no Delete and no Set active', async () => {
    backend();
    renderPage(<DefaultAvatarsPage />);
    expect(buttonsOf(await rowOf(MIRA))).toEqual(['Rename']);
  });

  it('shows no button to an administrator without DEFAULT_AVATAR:MANAGE in the interface', async () => {
    backend();
    setTestAccess(access({ me: { superAdmin: false, permissions: ['GENERATION:VIEW'] } }));
    renderPage(<DefaultAvatarsPage />);
    for (const name of [MIRA, THAI, ARABIC, LUNA, LONG]) {
      expect(buttonsOf(await rowOf(name)), name).toEqual([]);
    }
    expect(screen.queryByRole('button', { name: 'New default avatar' })).not.toBeInTheDocument();
  });
});

describe('the default avatar page: the actions', { timeout: 30000 }, () => {
  it('Generate sends one POST, the row is generating and its failure reason is gone', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const row = await rowOf(ARABIC);
    expect(within(row).getByTestId('failure-reason')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/default-avatars/da-3/generate',
    });
    await waitFor(async () => {
      const again = await rowOf(ARABIC);
      expect(within(again).getByText('Generating')).toBeInTheDocument();
      expect(within(again).queryByTestId('failure-reason')).not.toBeInTheDocument();
      expect(buttonsOf(again)).toEqual([]);
    });
  });

  it('sends one request when Generate is pressed twice at once', async () => {
    const calls = backend();
    renderPage(<DefaultAvatarsPage />);
    const button = within(await rowOf(LONG)).getByRole('button', { name: 'Generate' });
    fireEvent.click(button);
    fireEvent.click(button);
    await new Promise((r) => setTimeout(r, 200));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('Refresh reads the list again: a generation that has finished shows as ready', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    expect(within(await rowOf(LUNA)).getByText('Generating')).toBeInTheDocument();
    const luna = avatarState.defaultAvatars.find((d) => d.id === 'da-2');
    if (luna) luna.startedAt = Date.now() - GENERATION_MS - 10;
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(async () =>
      expect(within(await rowOf(LUNA)).getByText('Ready')).toBeInTheDocument(),
    );
    expect(buttonsOf(await rowOf(LUNA))).toEqual(['Set active', 'Rename', 'Delete']);
  });

  it('Set active asks first, in words that say who sees it at once and what happens to the active one', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    await user.click(within(await rowOf(THAI)).getByRole('button', { name: 'Set active' }));
    expect(
      await screen.findByText(/Guests and accounts without an avatar will see it at once/),
    ).toBeInTheDocument();
    expect(screen.getByText(/becomes inactive but is kept/)).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: '/api/admin/default-avatars/da-4/activate',
    });
    await waitFor(async () => {
      expect(within(await rowOf(THAI)).getByText('Active')).toBeInTheDocument();
      expect(within(await rowOf(MIRA)).queryByText('Active')).not.toBeInTheDocument();
    });
    // The one that was active is kept, and now it can be deleted.
    expect(buttonsOf(await rowOf(MIRA))).toEqual(['Set active', 'Rename', 'Delete']);
    expect(buttonsOf(await rowOf(THAI))).toEqual(['Rename']);
  });

  it('Delete asks inline first and sends nothing when it is cancelled', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    await user.click(within(await rowOf(LONG)).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Delete this default avatar?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(writesOf(calls)).toHaveLength(0);
    expect(screen.getByText(LONG)).toBeInTheDocument();
  });

  it('Delete sends DELETE once it is confirmed, and the row goes', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    await user.click(within(await rowOf(LONG)).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'DELETE',
      url: '/api/admin/default-avatars/da-1',
    });
    await waitFor(() => expect(screen.queryByText(LONG)).not.toBeInTheDocument());
  });
});

describe('the default avatar page: when the backend refuses', { timeout: 30000 }, () => {
  it('Generate on an avatar that is generating already (409) says what state it is in, and the row is read again', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const row = await rowOf(LONG);
    const draft = avatarState.defaultAvatars.find((d) => d.id === 'da-1');
    if (draft) {
      draft.status = 'GENERATING';
      draft.startedAt = Date.now() + 1_000_000;
    }
    await user.click(within(row).getByRole('button', { name: 'Generate' }));
    expect(
      await screen.findByText('The action is not possible now. The avatar is: Generating.'),
    ).toBeInTheDocument();
    await waitFor(async () => expect(buttonsOf(await rowOf(LONG))).toEqual([]));
  });

  it('Set active on an avatar that is not ready (409) says its state', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const row = await rowOf(THAI);
    const ready = avatarState.defaultAvatars.find((d) => d.id === 'da-4');
    if (ready) ready.status = 'DRAFT';
    await user.click(within(row).getByRole('button', { name: 'Set active' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The action is not possible now. The avatar is: Draft.'),
    ).toBeInTheDocument();
  });

  it('Delete of an avatar that became active (409) says its state', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const row = await rowOf(THAI);
    for (const d of avatarState.defaultAvatars) d.isActive = d.id === 'da-4';
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The action is not possible now. The avatar is: Ready.'),
    ).toBeInTheDocument();
    expect(screen.getByText(THAI)).toBeInTheDocument();
  });

  it('Generate when the generation is not configured (503) says what is missing, and the draft stays a draft', async () => {
    backend();
    avatarState.generationConfigured = false;
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    await user.click(within(await rowOf(LONG)).getByRole('button', { name: 'Generate' }));
    expect(
      await screen.findByText(
        'What the generation needs has not been configured yet, so it cannot start.',
      ),
    ).toBeInTheDocument();
    expect(buttonsOf(await rowOf(LONG))).toEqual(['Generate', 'Rename', 'Delete']);
  });

  it('shows the usual text of an error that is none of those', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const row = await rowOf(LONG);
    avatarState.defaultAvatars = avatarState.defaultAvatars.filter((d) => d.id !== 'da-1');
    await user.click(within(row).getByRole('button', { name: 'Generate' }));
    expect(await screen.findByText('The item was not found.')).toBeInTheDocument();
  });
});

describe('the default avatar page: a new avatar', { timeout: 60000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: 'New default avatar' }));
    return screen.findByRole('dialog');
  };

  it('uploads the source first, then sends name, style and the upload id and nothing else (no portraitAuthorized), and lists the draft', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const dialog = await open(user);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].url).toBe('/uploads/default-avatar-source');
    await within(dialog).findByText(/portrait\.png/);
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: ' Vega ' } });
    await chooseOption(user, 'Style', 'Stylized 3D', dialog);
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'POST', url: '/api/admin/default-avatars' });
    const body = writesOf(calls)[0].body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['name', 'sourceUploadId', 'style']);
    expect(body).toMatchObject({ name: 'Vega', style: 'STYLIZED_3D' });
    expect(String(body.sourceUploadId)).toMatch(/^upl-/);
    const row = await rowOf('Vega');
    expect(within(row).getByText('Draft')).toBeInTheDocument();
    expect(buttonsOf(row)).toEqual(['Generate', 'Rename', 'Delete']);
  });

  it('cannot be sent without the confirmation about the portrait licence', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const dialog = await open(user);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/portrait\.png/);
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Vega' } });
    await chooseOption(user, 'Style', 'Realistic', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('Confirm this before you continue.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    // Ticked and then un-ticked is the same as not ticked.
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('asks for the source, a name and a style', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const dialog = await open(user);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a name.')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a style.')).toBeInTheDocument();
    expect(within(dialog).getByText('Confirm this before you continue.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    // Everything else filled in, but no source picture: still not sent.
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Vega' } });
    await chooseOption(user, 'Style', 'Realistic', dialog);
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Upload the source picture first.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('refuses a source over the size limit, over the pixel limit, or of the wrong type, before any upload', async () => {
    setTestInitialState({
      me: {},
      meta: { ...META, uploadMaxBytes: 2000, defaultAvatarSourceMaxPixels: 1_000_000 },
    });
    backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    await open(user);
    choose(fileOf(pngBytes(100, 100), 'big.png', 5000));
    expect(await screen.findByText(/The file is too large: limit 1\.95 KB/)).toBeInTheDocument();
    choose(fileOf(pngBytes(4000, 3000), 'wide.png'));
    expect(await screen.findByText(/too many pixels: limit 1 megapixel/)).toBeInTheDocument();
    choose(fileOf(zipBytes(), 'zip.png'));
    expect(await screen.findByText(/Wrong file type/)).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });

  it('applies the name rule before it sends: 31 emoji, a control character and a text-direction override are refused; 30 emoji and Arabic pass', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const dialog = await open(user);
    const submit = () => user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    for (const [name, text] of [
      ['😀'.repeat(31), 'The name must be 1 to 30 characters long.'],
      [
        `a${String.fromCharCode(7)}b`,
        'The name has a control or text-direction override character.',
      ],
      [
        `a${String.fromCharCode(0x202e)}b`,
        'The name has a control or text-direction override character.',
      ],
    ] as const) {
      fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: name } });
      await submit();
      expect(await within(dialog).findByText(text)).toBeInTheDocument();
    }
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('shows the backend text for the name as it comes (400) and keeps the dialog and the upload', async () => {
    const calls = backend();
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
      if (String(input).endsWith('/default-avatars') && init?.method === 'POST') {
        return jsonResponse(
          400,
          envelope('INVALID_REQUEST', { details: [{ ref: 'name', reason: 'TOO_LONG' }] }, 'name'),
        );
      }
      return real(input, init);
    });
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const dialog = await open(user);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/portrait\.png/);
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Vega' } });
    await chooseOption(user, 'Style', 'Realistic', dialog);
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findAllByText('The value is too long.')).not.toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(uploads).toHaveLength(1);
    expect(calls.length).toBeGreaterThan(0);
  });

  it('asks for the file again when the backend refuses the upload id', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    const dialog = await open(user);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/portrait\.png/);
    for (const upload of avatarState.uploads.values()) upload.used = true;
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Vega' } });
    await chooseOption(user, 'Style', 'Realistic', dialog);
    await user.click(within(dialog).getByRole('checkbox'));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(
        'The server did not accept the uploaded picture. Upload it again.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findAllByText('Upload the source picture first.')).not.toHaveLength(
      0,
    );
    expect(writesOf(calls)).toHaveLength(1);
  });
});

describe('the default avatar page: rename', { timeout: 30000 }, () => {
  it('sends only the new name, trimmed', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    await user.click(within(await rowOf(THAI)).getByRole('button', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue(THAI);
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: ' ชื่อใหม่ ' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/default-avatars/da-4',
      body: { name: 'ชื่อใหม่' },
    });
    expect(Object.keys(writesOf(calls)[0].body as object)).toEqual(['name']);
    expect(await screen.findByText('ชื่อใหม่')).toBeInTheDocument();
  });

  it('does not send an empty name', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    await user.click(within(await rowOf(MIRA)).getByRole('button', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: String.fromCharCode(0x3000, 0x20) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a name.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('says the state of an avatar that cannot be renamed now (409) and keeps the dialog open', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<DefaultAvatarsPage />);
    await user.click(within(await rowOf(THAI)).getByRole('button', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog');
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) =>
      init?.method === 'PUT'
        ? jsonResponse(409, envelope('INVALID_STATE', { status: 'GENERATING' }, 'busy'))
        : real(input, init),
    );
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Other' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The action is not possible now. The avatar is: Generating.'),
    ).toBeInTheDocument();
  });
});

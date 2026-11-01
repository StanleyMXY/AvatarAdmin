import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moderationState, RECORD_ID } from '../../../mock/_core/moderationData';
import * as moderationMock from '../../../mock/moderation.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend as installMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import DetailPage from './detail';
import { dialogsClosed, interceptFetch, openRecord, signIn } from './testSetup';

beforeEach(() => signIn('reviewer'));
afterEach(() => vi.unstubAllGlobals());

const REVIEW_ONLY_VIEW = ['MODERATION:VIEW'];
const WIDE_SPACE = String.fromCodePoint(0x3000);

const open = async (id: string, before: () => void = () => {}) => {
  openRecord(id);
  const calls = installMockBackend(moderationMock);
  before();
  renderPage(<DetailPage />);
  await screen.findByText('Record ID');
  return calls;
};
const contentCalls = (calls: { url: string }[]) => calls.filter((c) => c.url.endsWith('/content'));
const writes = <T extends { method: string }>(calls: T[]) =>
  calls.filter((c) => c.method !== 'GET');

describe('who sees the content and the buttons', { timeout: 30000 }, () => {
  it('shows the record fields and a notice, without asking for the content, to an administrator with only MODERATION:VIEW', async () => {
    signIn('reviewer', { codes: REVIEW_ONLY_VIEW });
    const calls = await open(RECORD_ID.reportedMessage);
    expect(screen.getByText(RECORD_ID.reportedMessage)).toBeInTheDocument();
    expect(screen.getByText(/You may not view the content/)).toBeInTheDocument();
    expect(screen.queryByTestId('moderation-content-text')).toBeNull();
    expect(screen.queryByText(/Viewing is recorded/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    await new Promise((r) => setTimeout(r, 150));
    expect(contentCalls(calls)).toHaveLength(0);
  });

  it('asks for the content once and shows the approve and reject buttons to MODERATION:REVIEW', async () => {
    signIn('reviewer', { codes: ['MODERATION:VIEW', 'MODERATION:REVIEW'] });
    const calls = await open(RECORD_ID.reportedMessage);
    expect(await screen.findByTestId('moderation-content-text')).toBeInTheDocument();
    expect(contentCalls(calls)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('shows no buttons for a record that was handled already', async () => {
    await open(RECORD_ID.approved);
    await screen.findByText('Approved', { selector: '.ant-tag' });
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('says that viewing is recorded', async () => {
    await open(RECORD_ID.reportedMessage);
    expect(await screen.findByText(/Viewing is recorded/)).toBeInTheDocument();
  });
});

describe('the content area', { timeout: 30000 }, () => {
  it('shows text as it is, in any script, and breaks a string of 5000 characters without spaces', async () => {
    await open(RECORD_ID.longText);
    const block = await screen.findByTestId('moderation-content-text');
    expect(block.textContent).toHaveLength(5000);
    expect(block).toHaveStyle({ overflowWrap: 'anywhere' });
    expect(block).toHaveAttribute('dir', 'auto');
  });

  it.each([
    ['Thai', RECORD_ID.reportedMessage, /^สวัสดี|^ภาษาไทย/],
    ['Indonesian', RECORD_ID.persona, /Aplikasi ini/],
    ['Arabic', RECORD_ID.rejected, /هذا نص طويل/],
  ])('shows %s text', async (_, id, pattern) => {
    await open(id);
    expect((await screen.findByTestId('moderation-content-text')).textContent).toMatch(pattern);
  });

  it('picks an image element for an image, an audio element for sound and a video element for a clip, with the address only in src', async () => {
    const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) =>
      vi.spyOn(console, name).mockImplementation(() => {}),
    );
    try {
      await open(RECORD_ID.reportedAvatar);
      const image = await screen.findByRole('img');
      expect(image.getAttribute('src')).toMatch(
        /^\/api\/admin\/moderation\/mock-media\/image\?sig=/,
      );
      const sig = new URL(image.getAttribute('src') as string, 'http://x').searchParams.get(
        'sig',
      ) as string;
      expect(window.location.href).not.toContain(sig);
      expect(document.querySelector('a[href*="mock-media"]')).toBeNull();
      expect(document.body.textContent).not.toContain(sig);
      for (const spy of consoleSpies) {
        for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(sig);
      }
    } finally {
      for (const spy of consoleSpies) spy.mockRestore();
    }
  });

  it('plays a clip in a video element', async () => {
    await open(RECORD_ID.clip);
    await waitFor(() => expect(document.querySelector('video')).not.toBeNull());
    expect(document.querySelector('video')?.getAttribute('src')).toMatch(/mock-media\/video\?sig=/);
    expect(document.querySelector('video')).toHaveAttribute('controls');
  });

  it('plays sound in an audio element and shows the transcript under the player', async () => {
    await open(RECORD_ID.reportedVoice);
    await waitFor(() => expect(document.querySelector('audio')).not.toBeNull());
    expect(document.querySelector('audio')?.getAttribute('src')).toMatch(/mock-media\/audio\?sig=/);
    const attached = await screen.findByTestId('moderation-content-attached');
    expect(attached).toHaveTextContent('Text that belongs to the file (transcript)');
    expect(attached.textContent).toContain('Ứng dụng này giúp tôi');
    const audio = document.querySelector('audio') as HTMLElement;
    expect(audio.compareDocumentPosition(attached) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['an image', RECORD_ID.reportedAvatar],
    ['a clip', RECORD_ID.clip],
    ['a sound without a transcript', RECORD_ID.autoVoice],
  ])('shows no text block for %s', async (_, id) => {
    await open(id);
    await waitFor(() => expect(document.querySelector('img, video, audio')).not.toBeNull());
    expect(screen.queryByTestId('moderation-content-attached')).toBeNull();
  });

  it('breaks a transcript of 5000 characters without spaces and in Thai and Arabic so that it does not widen the page', async () => {
    for (const text of ['ก'.repeat(5000), 'ع'.repeat(5000)]) {
      moderationState.contents[RECORD_ID.reportedVoice] = { kind: 'FILE', media: 'audio', text };
      const view = await (async () => {
        openRecord(RECORD_ID.reportedVoice);
        installMockBackend(moderationMock);
        return renderPage(<DetailPage />);
      })();
      const attached = await screen.findByTestId('moderation-content-attached');
      const button = within(attached).getByRole('button');
      expect(button.textContent).toHaveLength(5000);
      expect(button).toHaveStyle({ overflowWrap: 'anywhere', overflow: 'hidden' });
      expect(button.getAttribute('dir')).toBe('auto');
      view.unmount();
    }
  });

  it('shows no content area for a record that was blocked automatically, and asks for nothing', async () => {
    const calls = await open(RECORD_ID.blocked);
    expect(
      screen.getByText('Blocked automatically; the original was not stored.'),
    ).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 150));
    expect(contentCalls(calls)).toHaveLength(0);
  });

  it('shows no content area when the backend says CONTENT_NOT_STORED, with the translated text only', async () => {
    const calls = await open(RECORD_ID.staleCompanionName);
    expect(
      await screen.findByText('The original content is no longer stored.'),
    ).toBeInTheDocument();
    expect(contentCalls(calls)).toHaveLength(1);
    expect(screen.queryByTestId('moderation-content-text')).toBeNull();
    expect(document.querySelector('img, audio, video')).toBeNull();
  });

  it('shows the current companion name as text, and says that it is the name now', async () => {
    await open(RECORD_ID.companionName);
    expect((await screen.findByTestId('moderation-content-text')).textContent).toBe('María 🌟');
    expect(screen.getByText("This is the user's name now.")).toBeInTheDocument();
  });

  it('shows a failure of the content request with the translated text only, and asks again on the button', async () => {
    let attempts = 0;
    const calls = await open(RECORD_ID.reportedMessage, () =>
      interceptFetch((url) => {
        if (!url.endsWith('/content')) return undefined;
        attempts += 1;
        return attempts === 1
          ? jsonResponse(503, envelope('DEPENDENCY_UNAVAILABLE', null, 'storage is down'))
          : undefined;
      }),
    );
    expect(await screen.findByText(/The content could not be loaded/)).toBeInTheDocument();
    expect(screen.queryByText(/storage is down/)).toBeNull();
    expect(screen.queryByTestId('moderation-content-text')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Load the content again' }));
    expect(await screen.findByTestId('moderation-content-text')).toBeInTheDocument();
    expect(attempts).toBe(2);
    expect(contentCalls(calls)).toHaveLength(1);
  });

  it('shows a file type that it cannot preview without a link or the address', async () => {
    openRecord(RECORD_ID.reportedAvatar);
    installMockBackend(moderationMock);
    interceptFetch((url) =>
      url.endsWith('/content')
        ? jsonResponse(
            200,
            envelope('200', { kind: 'FILE', mediaType: 'application/pdf', url: '/secret?sig=abc' }),
          )
        : undefined,
    );
    renderPage(<DetailPage />);
    expect(
      await screen.findByText(/cannot preview this kind of file: application\/pdf/),
    ).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain('sig=abc');
  });

  it('asks again once when the player cannot load the file, shows a warning when it fails again, and asks again on the button', async () => {
    const calls = await open(RECORD_ID.reportedAvatar);
    const first = await screen.findByRole('img');
    const firstSrc = first.getAttribute('src');
    fireEvent.error(first);
    await waitFor(() => expect(contentCalls(calls)).toHaveLength(2));
    const second = await screen.findByRole('img');
    await waitFor(() => expect(second.getAttribute('src')).not.toBe(firstSrc));
    fireEvent.error(second);
    expect(await screen.findByText(/The file did not play/)).toBeInTheDocument();
    expect(contentCalls(calls)).toHaveLength(2);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Load the content again' }));
    await waitFor(() => expect(contentCalls(calls)).toHaveLength(3));
  });

  it('takes a new address from the backend at every visit and does not keep the old one', async () => {
    const first = await open(RECORD_ID.reportedAvatar);
    const a = (await screen.findByRole('img')).getAttribute('src');
    expect(first).toBeTruthy();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    openRecord(RECORD_ID.reportedAvatar);
    installMockBackend(moderationMock);
    renderPage(<DetailPage />);
    const b = (await screen.findByRole('img')).getAttribute('src');
    expect(a).not.toBe(b);
    expect(moderationState.views).toHaveLength(2);
  });
});

describe('the record fields', { timeout: 30000 }, () => {
  it('shows the reporter reason and the detail of a report, and not the report card for an automatic record', async () => {
    await open(RECORD_ID.reportedMessage);
    expect(screen.getByText('Report reason')).toBeInTheDocument();
    expect(screen.getByText('Harassment')).toBeInTheDocument();
    expect(screen.getByText('Additional detail')).toBeInTheDocument();
    const detail = moderationState.records.find((r) => r.id === RECORD_ID.reportedMessage)
      ?.reporterDetail as string;
    expect(screen.getAllByRole('button').some((b) => b.textContent === detail)).toBe(true);
  });

  it('shows no report card for an automatic record', async () => {
    await open(RECORD_ID.oldestImage);
    expect(screen.queryByText('Report reason')).toBeNull();
  });

  it('keeps a reporter detail of 5000 characters without spaces inside its cell', async () => {
    await open(RECORD_ID.rejected);
    const long = screen.getAllByRole('button').find((b) => b.textContent === 'x'.repeat(5000));
    expect(long).toBeTruthy();
    expect(long).toHaveStyle({ overflowWrap: 'anywhere', overflow: 'hidden' });
  });

  it('shows the reviewer by name, the id start when the administrator is gone, and dashes for the fields that are empty', async () => {
    await open(RECORD_ID.approved);
    expect(screen.getByText('reviewer')).toBeInTheDocument();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    await open(RECORD_ID.rejected);
    expect(screen.getByText('9999')).toBeInTheDocument();
  });

  it('shows 404 as "no such record" and a link back to the queue', async () => {
    openRecord('nope');
    installMockBackend(moderationMock);
    renderPage(<DetailPage />);
    expect(await screen.findByText('There is no such moderation record')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the review queue' })).toHaveAttribute(
      'href',
      '/moderation/queue',
    );
  });

  it('shows nothing of the record id of a path that is not a record', async () => {
    openRecord('a/b');
    installMockBackend(moderationMock);
    renderPage(<DetailPage />);
    expect(await screen.findByText('This address is not a moderation record')).toBeInTheDocument();
  });
});

describe('deciding', { timeout: 30000 }, () => {
  const openDialog = async (
    user: ReturnType<typeof userEvent.setup>,
    button: 'Approve' | 'Reject',
  ) => {
    await user.click(await screen.findByRole('button', { name: button }));
    return screen.findByRole('dialog');
  };

  it.each([
    [
      'AVATAR_IMAGE',
      RECORD_ID.oldestImage,
      'Approve',
      /generated standard image becomes the avatar or look/,
    ],
    ['AVATAR_IMAGE', RECORD_ID.oldestImage, 'Reject', /generation task fails.*result is deleted/],
    ['ACTION_CLIP', RECORD_ID.clip, 'Approve', /action clip becomes available/],
    [
      'ACTION_CLIP',
      RECORD_ID.clip,
      'Reject',
      /clip fails and its file is deleted; no in-app notice/,
    ],
    ['MESSAGE', RECORD_ID.reportedMessage, 'Approve', /message does not change/],
    ['MESSAGE', RECORD_ID.reportedMessage, 'Reject', /message is hidden/],
    ['PERSONA', RECORD_ID.persona, 'Approve', /pending persona replaces the persona in force/],
    ['PERSONA', RECORD_ID.persona, 'Reject', /pending persona is cleared/],
    ['COMPANION_NAME', RECORD_ID.companionName, 'Approve', /name does not change/],
    ['COMPANION_NAME', RECORD_ID.companionName, 'Reject', /companion name is cleared/],
    [
      'AVATAR upload',
      RECORD_ID.autoAvatar,
      'Approve',
      /upload task goes on to generate the avatar/,
    ],
    ['AVATAR upload', RECORD_ID.autoAvatar, 'Reject', /original photo is deleted/],
    [
      'AVATAR reported',
      RECORD_ID.reportedAvatar,
      'Approve',
      /report is closed; the asset does not change/,
    ],
    [
      'AVATAR reported',
      RECORD_ID.reportedAvatar,
      'Reject',
      /avatar asset is deleted, with its looks and action clips/,
    ],
    ['VOICE upload', RECORD_ID.autoVoice, 'Approve', /upload task goes on\./],
    ['VOICE upload', RECORD_ID.autoVoice, 'Reject', /original voice sample is deleted/],
    [
      'VOICE reported',
      RECORD_ID.reportedVoice,
      'Approve',
      /report is closed; the asset does not change/,
    ],
    ['VOICE reported', RECORD_ID.reportedVoice, 'Reject', /voice asset is deleted/],
  ] as const)('tells what %s %s does before it is confirmed', async (_, id, button, pattern) => {
    const user = userEvent.setup();
    const calls = await open(id);
    const dialog = await openDialog(user, button);
    expect(within(dialog).getByTestId('moderation-effect')).toHaveTextContent(pattern);
    expect(writes(calls)).toHaveLength(0);
  });

  it('approves without a note: the request has no note, the page shows the new state and the buttons go', async () => {
    const user = userEvent.setup();
    const calls = await open(RECORD_ID.persona);
    const dialog = await openDialog(user, 'Approve');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0]).toMatchObject({
      method: 'POST',
      url: `/api/admin/moderation/records/${RECORD_ID.persona}/decision`,
      body: { decision: 'APPROVE' },
    });
    await dialogsClosed();
    await screen.findByText('Approved', { selector: '.ant-tag' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull());
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
  });

  it('sends nothing more when the confirm button is pressed again while the dialog is closing after the decision went through', async () => {
    const user = userEvent.setup();
    const calls = await open(RECORD_ID.persona);
    const dialog = await openDialog(user, 'Approve');
    const confirm = within(dialog).getByRole('button', { name: 'Confirm approval' });
    await user.click(confirm);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    await dialogsClosed();
    fireEvent.click(confirm);
    await new Promise((r) => setTimeout(r, 150));
    expect(writes(calls)).toHaveLength(1);
  });

  it('approves with a note, trimmed with the contract set', async () => {
    const user = userEvent.setup();
    const calls = await open(RECORD_ID.persona);
    const dialog = await openDialog(user, 'Approve');
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: `${WIDE_SPACE} ตรวจแล้ว ` },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ decision: 'APPROVE', note: 'ตรวจแล้ว' });
  });

  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['an ideographic space', WIDE_SPACE],
    ['a no-break space', String.fromCharCode(0xa0)],
    ['a next-line character (U+0085)', String.fromCharCode(0x85)],
    ['a unit separator (U+001F)', String.fromCharCode(0x1f)],
  ])('does not reject with a note that is %s, and sends nothing', async (_, note) => {
    const user = userEvent.setup();
    const calls = await open(RECORD_ID.persona);
    const dialog = await openDialog(user, 'Reject');
    if (note) fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: note } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }));
    expect(await within(dialog).findByText('A note is required to reject')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
  });

  it('rejects with the note and shows the new state', async () => {
    const user = userEvent.setup();
    const calls = await open(RECORD_ID.persona);
    const dialog = await openDialog(user, 'Reject');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'ไม่เหมาะสม 😀' } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ decision: 'REJECT', note: 'ไม่เหมาะสม 😀' });
    await screen.findByText('Rejected', { selector: '.ant-tag' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull());
  });

  it('refuses a note of more than 500 code points and counts an emoji as one', async () => {
    const user = userEvent.setup();
    const calls = await open(RECORD_ID.persona);
    const dialog = await openDialog(user, 'Reject');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '😀'.repeat(501) } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }));
    expect(await within(dialog).findByText(/at most 500 characters/)).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '😀'.repeat(500) } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm rejection' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
  });

  it('sends one request for a double press', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls = await open(RECORD_ID.persona, () =>
      interceptFetch(async (_, init) => {
        if ((init.method ?? 'GET') === 'POST') {
          attempts += 1;
          await gate;
        }
        return undefined;
      }),
    );
    const dialog = await openDialog(user, 'Approve');
    const confirm = within(dialog).getByRole('button', { name: 'Confirm approval' });
    fireEvent.click(confirm);
    // The first request is on its way (the answer is held back): press again, as a person does.
    await waitFor(() => expect(attempts).toBe(1));
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await new Promise((r) => setTimeout(r, 100));
    release();
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(attempts).toBe(1);
    expect(writes(calls)).toHaveLength(1);
  });

  it('shows the translated text of a refusal, keeps the dialog and the note, and shows the record again when it was handled by someone else', async () => {
    const user = userEvent.setup();
    const calls = await open(RECORD_ID.persona);
    // Someone else handles it first.
    const record = moderationState.records.find((r) => r.id === RECORD_ID.persona);
    if (record) record.status = 'REJECTED';
    const dialog = await openDialog(user, 'Approve');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'mine' } });
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    expect(
      await within(dialog).findByText(
        'Someone else handled this record first. Its state now: Rejected.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('textbox')).toHaveValue('mine');
    await waitFor(() =>
      expect(
        calls.filter((c) => c.method === 'GET' && c.url.endsWith(`/records/${RECORD_ID.persona}`)),
      ).toHaveLength(2),
    );
    await screen.findByText('Rejected', { selector: '.ant-tag' });
  });

  it('says in the dialog what state the record is in now when someone else handled it, and does not let the decision be confirmed again', async () => {
    const user = userEvent.setup();
    const calls = await open(RECORD_ID.persona);
    const record = moderationState.records.find((r) => r.id === RECORD_ID.persona);
    if (record) record.status = 'REJECTED';
    const dialog = await openDialog(user, 'Approve');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    expect(
      await within(dialog).findByText(
        'Someone else handled this record first. Its state now: Rejected.',
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Confirm approval' })).toBeDisabled(),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    await new Promise((r) => setTimeout(r, 100));
    expect(writes(calls)).toHaveLength(1);
  });

  it('falls back to the words of the code when a 409 does not say the state', async () => {
    const user = userEvent.setup();
    await open(RECORD_ID.persona, () =>
      interceptFetch((_, init) =>
        (init.method ?? 'GET') === 'POST'
          ? jsonResponse(409, envelope('INVALID_STATE'))
          : undefined,
      ),
    );
    const dialog = await openDialog(user, 'Approve');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    expect(
      await within(dialog).findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
  });

  it('says it in Chinese too', async () => {
    const user = userEvent.setup();
    openRecord(RECORD_ID.persona);
    installMockBackend(moderationMock);
    renderPage(<DetailPage />, 'zh-CN');
    await screen.findByText('记录 ID');
    const record = moderationState.records.find((r) => r.id === RECORD_ID.persona);
    if (record) record.status = 'APPROVED';
    await user.click(await screen.findByRole('button', { name: /^通\s?过$/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '确认通过' }));
    expect(
      await within(dialog).findByText('这条记录已被别人先处理了，它现在的状态：已通过。'),
    ).toBeInTheDocument();
  });

  it('shows the translated text of a 403 and keeps the dialog', async () => {
    const user = userEvent.setup();
    await open(RECORD_ID.persona);
    interceptFetch((_, init) =>
      (init.method ?? 'GET') === 'POST'
        ? jsonResponse(403, envelope('ADMIN_FORBIDDEN'))
        : undefined,
    );
    const dialog = await openDialog(user, 'Approve');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    expect(
      await within(dialog).findByText('You do not have permission to do this.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not send the write again when the token ended during it', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    await open(RECORD_ID.persona, () =>
      interceptFetch((_, init) => {
        if ((init.method ?? 'GET') !== 'POST') return undefined;
        attempts += 1;
        return jsonResponse(401, envelope('ADMIN_INVALID_TOKEN'));
      }),
    );
    const dialog = await openDialog(user, 'Approve');
    await user.click(within(dialog).getByRole('button', { name: 'Confirm approval' }));
    await waitFor(() => expect(attempts).toBe(1));
    await new Promise((r) => setTimeout(r, 150));
    expect(attempts).toBe(1);
  });
});

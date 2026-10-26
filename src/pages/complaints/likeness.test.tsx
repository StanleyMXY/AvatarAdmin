import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarState } from '../../../mock/_core/avatarData';
import { resetConfigStore } from '../../../mock/_core/configStore';
import complaintsMock from '../../../mock/complaints.mock';
import * as configMock from '../../../mock/config.mock';
import { envelope, jsonResponse } from '../../../tests/httpStubs';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { history, setTestAccess } from '../../../tests/stubs/umi-max';
import access from '../../access';
import { signIn, writesOf } from '../avatar/testSetup';
import LikenessComplaintsPage from './likeness';

const backend = () => useMockBackend({ default: complaintsMock }, configMock);

// The reviewer has COMPLAINT:VIEW and COMPLAINT:MANAGE; support has COMPLAINT:VIEW only.
beforeEach(() => {
  signIn('reviewer');
  resetConfigStore();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const complaint = (n: number) => {
  const found = avatarState.complaints.find((c) => c.id.endsWith(String(n).padStart(8, '0')));
  if (!found) throw new Error(`no complaint ${n}`);
  return found;
};
const rowOf = async (n: number) =>
  (await screen.findByText(`person${n}@example.org`)).closest('tr') as HTMLTableRowElement;
/** The rows of the history table in the drawer (Ant Design draws a table with a scrolling body as two tables). */
const historyRows = (drawer: HTMLElement) =>
  [...drawer.querySelectorAll('.ant-table-tbody tr.ant-table-row')] as HTMLElement[];
const openDrawer = async (user: ReturnType<typeof userEvent.setup>, n: number) => {
  await user.click(within(await rowOf(n)).getByRole('button', { name: 'Details' }));
  return screen.findByRole('dialog');
};

describe('the complaint list', { timeout: 30000 }, () => {
  it('lists the complaints by the due time with email, received, due, state and handler, and says how to find the avatar is not decided', async () => {
    backend();
    renderPage(<LikenessComplaintsPage />);
    await rowOf(1);
    const emails = screen.getAllByText(/^person\d+@example\.org$/).map((e) => e.textContent ?? '');
    const first = emails.indexOf('person1@example.org');
    const second = emails.indexOf('person2@example.org');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(second);
    expect(
      screen.getByText(/How to find the avatar a complaint is about has not been decided/),
    ).toBeInTheDocument();
    const two = await rowOf(2);
    expect(within(two).getByText('Investigating')).toBeInTheDocument();
    expect(within(two).getByText('support')).toBeInTheDocument();
    // An administrator that was deleted: the first 8 characters of the id.
    expect(within(await rowOf(6)).getByText('9999')).toBeInTheDocument();
    expect(within(await rowOf(3)).getByText('—')).toBeInTheDocument();
  });

  it('marks the rows that are overdue and not closed, and only those', async () => {
    backend();
    renderPage(<LikenessComplaintsPage />);
    await rowOf(1);
    for (const n of [1, 2]) {
      const row = await rowOf(n);
      expect(row.querySelector('td.complaint-overdue'), `complaint ${n}`).not.toBeNull();
      expect(within(row).getByText('Overdue')).toBeInTheDocument();
    }
    // Not yet due, and closed (long past its due time but done): not marked.
    for (const n of [3, 4, 5, 6, 7]) {
      const row = await rowOf(n);
      expect(row.querySelector('td.complaint-overdue'), `complaint ${n}`).toBeNull();
      expect(within(row).queryByText('Overdue')).not.toBeInTheDocument();
    }
  });

  it('shows the whole row in the colour of the mark, not just one cell', async () => {
    backend();
    renderPage(<LikenessComplaintsPage />);
    const row = await rowOf(1);
    const cells = row.querySelectorAll('td');
    const marked = row.querySelectorAll('td.complaint-overdue');
    expect(marked.length).toBe(cells.length);
  });

  it('asks the backend for the state that was chosen', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    await rowOf(1);
    await user.click(screen.getByRole('combobox', { name: 'State' }));
    const options = await screen.findAllByText('Rejected', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    await user.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() => expect(calls.some((c) => c.url.includes('status=REJECTED'))).toBe(true));
    await waitFor(() => expect(screen.queryByText('person1@example.org')).not.toBeInTheDocument());
    expect(await screen.findByText('person7@example.org')).toBeInTheDocument();
  });

  it('keeps a description of Arabic, Thai, or 5000 letters without a space inside the drawer', async () => {
    backend();
    const user = userEvent.setup();
    const target = complaint(4);
    target.description = `${'ก'.repeat(500)}${'A'.repeat(5000)}${'ب'.repeat(500)}`;
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 4);
    const text = await within(drawer).findByTestId('complaint-description');
    expect(text.textContent).toHaveLength(6000);
    expect(text.style.overflowWrap).toBe('anywhere');
    expect(text.getAttribute('dir')).toBe('auto');
  });
});

describe('the complaint drawer: evidence', { timeout: 60000 }, () => {
  it('has one button for each file and the notice that viewing is recorded', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 4);
    expect(
      await within(drawer).findByText('Viewing a file is written to the audit log, every time.'),
    ).toBeInTheDocument();
    for (const n of [1, 2, 3]) {
      expect(within(drawer).getByRole('button', { name: `File ${n}` })).toBeInTheDocument();
    }
    expect(within(drawer).queryByRole('button', { name: 'File 4' })).not.toBeInTheDocument();
  });

  it('asks for a file by its index counted from 0, every time it is clicked, and uses the new address', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 4);
    const id = complaint(4).id;
    const reads = () => calls.filter((c) => c.url.includes('/evidence/'));
    await user.click(await within(drawer).findByRole('button', { name: 'File 1' }));
    const first = (await within(drawer).findByAltText('File 1')).getAttribute('src');
    console.log(
      [...drawer.querySelectorAll('button')].map((b) => b.outerHTML.slice(0, 200)).join('\n'),
    );
    expect(reads().map((c) => c.url)).toEqual([`/api/admin/likeness-complaints/${id}/evidence/0`]);
    await user.click(within(drawer).getByRole('button', { name: 'File 1' }));
    await waitFor(() => expect(reads()).toHaveLength(2));
    await waitFor(() =>
      expect(within(drawer).getByAltText('File 1').getAttribute('src')).not.toBe(first),
    );
    await user.click(within(drawer).getByRole('button', { name: 'File 2' }));
    await within(drawer).findByAltText('File 2');
    expect(reads()[2].url).toBe(`/api/admin/likeness-complaints/${id}/evidence/1`);
  });

  it('shows a picture as a picture and a PDF in a frame, by the media type', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 4);
    await user.click(await within(drawer).findByRole('button', { name: 'File 3' }));
    const frame = await waitFor(() => {
      const found = drawer.querySelector('iframe');
      expect(found).not.toBeNull();
      return found as HTMLIFrameElement;
    });
    expect(frame.getAttribute('title')).toBe('File 3');
    expect(frame.getAttribute('src')).toContain('.pdf');
    expect(within(drawer).queryByAltText('File 3')).not.toBeInTheDocument();
  });

  it.each([
    ['video/mp4', 'video'],
    ['audio/mpeg', 'audio'],
  ])('plays %s in a %s player', async (mediaType, tag) => {
    backend();
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) =>
      String(input).includes('/evidence/')
        ? jsonResponse(200, envelope('200', { url: 'https://files.example.org/e', mediaType }))
        : real(input, init),
    );
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 4);
    await user.click(await within(drawer).findByRole('button', { name: 'File 1' }));
    await waitFor(() => expect(drawer.querySelector(tag)).not.toBeNull());
    expect(drawer.querySelector(tag)?.getAttribute('src')).toBe('https://files.example.org/e');
    expect(drawer.querySelector(tag)?.hasAttribute('controls')).toBe(true);
  });

  it('offers a link that opens apart for a type it has no player for, and refuses an address that is not http or https', async () => {
    backend();
    const real = globalThis.fetch;
    let next = { url: 'https://files.example.org/e.bin', mediaType: 'application/octet-stream' };
    vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) =>
      String(input).includes('/evidence/')
        ? jsonResponse(200, envelope('200', next))
        : real(input, init),
    );
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 4);
    await user.click(await within(drawer).findByRole('button', { name: 'File 1' }));
    const link = await within(drawer).findByRole('link', { name: 'Open the file' });
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    next = { url: 'javascript:alert(1)', mediaType: 'image/png' };
    await user.click(within(drawer).getByRole('button', { name: 'File 2' }));
    expect(
      await within(drawer).findByText('The file address is not one that can be opened.'),
    ).toBeInTheDocument();
    expect(drawer.querySelector('img')).toBeNull();
  });

  it('says that the evidence does not exist when the backend answers 404', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 4);
    await within(drawer).findByRole('button', { name: 'File 3' });
    complaint(4).evidence.pop();
    await user.click(within(drawer).getByRole('button', { name: 'File 3' }));
    expect(await within(drawer).findByText('The evidence does not exist.')).toBeInTheDocument();
  });

  it('says so when a complaint has no evidence', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    expect(await within(drawer).findByText('No evidence files.')).toBeInTheDocument();
  });

  it('does not write the address to any log and does not put it into the address of the page', async () => {
    backend();
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const before = window.location.href;
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 4);
    await user.click(await within(drawer).findByRole('button', { name: 'File 1' }));
    const src = (await within(drawer).findByAltText('File 1')).getAttribute('src') ?? '';
    expect(src).toContain('mock-files');
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('mock-files');
      }
    }
    expect(window.location.href).toBe(before);
    expect(JSON.stringify([history.push, history.replace])).not.toContain('mock-files');
  });
});

describe('the complaint drawer: history', { timeout: 30000 }, () => {
  it('shows the changes oldest first with the state before and after, the note and the administrator', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 5);
    await within(drawer).findByText('History');
    await waitFor(() => expect(historyRows(drawer)).toHaveLength(2));
    const rows = historyRows(drawer);
    expect(rows[0].textContent).toContain('Received → Investigating');
    expect(rows[0].textContent).toContain('root');
    expect(rows[1].textContent).toContain('Investigating → Avatars removed');
    expect(rows[1].textContent).toContain('Found both avatars by the uploader email');
  });

  it('shows the first 8 characters of the id for an administrator that was deleted, and the note in any language', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 6);
    await waitFor(() => expect(historyRows(drawer)).toHaveLength(1));
    expect(historyRows(drawer)[0].textContent).toContain('9999');
    expect(historyRows(drawer)[0].textContent).toContain('Aplikasi ini sangat membantu saya');
  });

  it('says so when there is no change yet', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    expect(await within(drawer).findByText('No change yet.')).toBeInTheDocument();
  });
});

describe('the complaint drawer: handling', { timeout: 60000 }, () => {
  const stateOptions = async (user: ReturnType<typeof userEvent.setup>, drawer: HTMLElement) => {
    await user.click(within(drawer).getByRole('combobox', { name: 'New state' }));
    const list = [...document.querySelectorAll('.ant-select-item-option-content')]
      .filter((el) => !el.closest('.ant-select-dropdown-hidden'))
      .map((el) => el.textContent);
    return list;
  };

  it('offers only Investigating, No such avatar found and Rejected as the new state', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    await within(drawer).findByRole('combobox', { name: 'New state' });
    expect(await stateOptions(user, drawer)).toEqual([
      'Investigating',
      'No such avatar found',
      'Rejected',
    ]);
  });

  it('changes the state with the note, trimmed, shows the new state and the new line of the history, and reads the list again', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    await user.click(await within(drawer).findByRole('combobox', { name: 'New state' }));
    const options = await screen.findAllByText('Investigating', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    fireEvent.change(within(drawer).getByLabelText('Note'), {
      target: { value: ` ${'ب'.repeat(10)} 😀 ` },
    });
    await user.click(within(drawer).getByRole('button', { name: 'Change state' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: `/api/admin/likeness-complaints/${complaint(3).id}/status`,
      body: { status: 'INVESTIGATING', note: `${'ب'.repeat(10)} 😀` },
    });
    await waitFor(() =>
      expect(within(drawer).getAllByText('Investigating').length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(
        historyRows(drawer)
          .map((r) => r.textContent)
          .join('|'),
      ).toContain('Received → Investigating'),
    );
    const listReads = calls.filter((c) => c.url.startsWith('/api/admin/likeness-complaints?'));
    expect(listReads.length).toBeGreaterThanOrEqual(2);
  });

  it('sends no note when it is empty', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    await user.click(await within(drawer).findByRole('combobox', { name: 'New state' }));
    const options = await screen.findAllByText('Rejected', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    fireEvent.change(within(drawer).getByLabelText('Note'), {
      target: { value: String.fromCharCode(0x3000, 0x20) },
    });
    await user.click(within(drawer).getByRole('button', { name: 'Change state' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({ status: 'REJECTED' });
  });

  it('refuses a note of more than 1000 code points (Arabic letters count one each) and sends one of 1000 emoji', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    await user.click(await within(drawer).findByRole('combobox', { name: 'New state' }));
    const options = await screen.findAllByText('Investigating', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    fireEvent.change(within(drawer).getByLabelText('Note'), {
      target: { value: 'ب'.repeat(1001) },
    });
    await user.click(within(drawer).getByRole('button', { name: 'Change state' }));
    expect(
      await within(drawer).findByText('The note can have at most 1000 characters.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    fireEvent.change(within(drawer).getByLabelText('Note'), {
      target: { value: '😀'.repeat(1000) },
    });
    await user.click(within(drawer).getByRole('button', { name: 'Change state' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
  });

  it('cannot be sent without a new state', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    expect(await within(drawer).findByRole('button', { name: 'Change state' })).toBeDisabled();
  });

  it('sends once when the button is pressed twice at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    await user.click(await within(drawer).findByRole('combobox', { name: 'New state' }));
    const options = await screen.findAllByText('Investigating', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    const button = within(drawer).getByRole('button', { name: 'Change state' });
    fireEvent.click(button);
    fireEvent.click(button);
    await new Promise((r) => setTimeout(r, 200));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the state and hides the buttons when the backend says the complaint is closed already (409)', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    await user.click(await within(drawer).findByRole('combobox', { name: 'New state' }));
    const options = await screen.findAllByText('Investigating', {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    complaint(3).status = 'REJECTED';
    await user.click(within(drawer).getByRole('button', { name: 'Change state' }));
    expect(
      await within(drawer).findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(drawer).queryByRole('button', { name: 'Change state' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      within(drawer).queryByRole('button', { name: 'Remove avatars' }),
    ).not.toBeInTheDocument();
  });

  it('has no change or remove button for a closed complaint, whichever way it was closed', async () => {
    backend();
    const user = userEvent.setup();
    const view = renderPage(<LikenessComplaintsPage />);
    for (const n of [5, 6, 7]) {
      const drawer = await openDrawer(user, n);
      await within(drawer).findByText('History');
      expect(
        within(drawer).queryByRole('button', { name: 'Change state' }),
      ).not.toBeInTheDocument();
      expect(
        within(drawer).queryByRole('button', { name: 'Remove avatars' }),
      ).not.toBeInTheDocument();
      expect(within(drawer).queryByText('Handle')).not.toBeInTheDocument();
      await user.click(within(drawer).getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { hidden: false })).toBeNull());
    }
    view.unmount();
  });

  it('shows nothing to change without COMPLAINT:MANAGE, but the evidence and the history', async () => {
    signIn('support');
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    await within(drawer).findByText('Evidence');
    expect(within(drawer).queryByRole('button', { name: 'Change state' })).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('button', { name: 'Remove avatars' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
  });

  it("also with the code missing in the interface only (the token is still the reviewer's)", async () => {
    backend();
    setTestAccess(access({ me: { superAdmin: false, permissions: ['COMPLAINT:VIEW'] } }));
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 3);
    await within(drawer).findByText('Evidence');
    expect(within(drawer).queryByRole('button', { name: 'Change state' })).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('button', { name: 'Remove avatars' }),
    ).not.toBeInTheDocument();
  });
});

describe('the complaint drawer: removing avatars', { timeout: 60000 }, () => {
  const addIds = async (
    user: ReturnType<typeof userEvent.setup>,
    drawer: HTMLElement,
    ids: string[],
  ) => {
    const box = within(drawer).getByRole('combobox', { name: 'Avatar IDs' });
    for (const id of ids) await user.type(box, `${id}{Enter}`);
  };

  it('has the button disabled until an ID is entered', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 2);
    expect(await within(drawer).findByRole('button', { name: 'Remove avatars' })).toBeDisabled();
    await addIds(user, drawer, ['asset-1']);
    expect(within(drawer).getByRole('button', { name: 'Remove avatars' })).toBeEnabled();
  });

  it('asks first, with words that say it deletes looks, clips and files, notifies the uploader and cannot be undone; nothing is sent before', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 2);
    await addIds(user, drawer, ['asset-1']);
    await user.click(within(drawer).getByRole('button', { name: 'Remove avatars' }));
    const question = await screen.findByText(/It cannot be undone\./);
    expect(question.textContent).toContain('all their looks, action clips and files');
    expect(question.textContent).toContain('in-app notice that the content was rejected');
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends the IDs (several allowed, trimmed, once each), then the complaint shows as closed with the IDs listed and no more buttons', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 2);
    await addIds(user, drawer, ['asset-1', 'asset-2']);
    await user.click(within(drawer).getByRole('button', { name: 'Remove avatars' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'POST',
      url: `/api/admin/likeness-complaints/${complaint(2).id}/remove-avatars`,
      body: { assetIds: ['asset-1', 'asset-2'] },
    });
    expect(await within(drawer).findByText('asset-2')).toBeInTheDocument();
    expect(within(drawer).getAllByText('Avatars removed').length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(
        within(drawer).queryByRole('button', { name: 'Remove avatars' }),
      ).not.toBeInTheDocument(),
    );
    expect(within(drawer).queryByRole('button', { name: 'Change state' })).not.toBeInTheDocument();
  });

  it('sends one request when the confirmation is pressed twice at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 2);
    await addIds(user, drawer, ['asset-1']);
    await user.click(within(drawer).getByRole('button', { name: 'Remove avatars' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await new Promise((r) => setTimeout(r, 200));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the state when the backend says the complaint is closed already (409)', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<LikenessComplaintsPage />);
    const drawer = await openDrawer(user, 2);
    await addIds(user, drawer, ['asset-1']);
    complaint(2).status = 'REJECTED';
    await user.click(within(drawer).getByRole('button', { name: 'Remove avatars' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await within(drawer).findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(complaint(2).relatedAvatarAssetIds).toEqual([]);
  });
});

describe('the parameters of the complaint page', { timeout: 30000 }, () => {
  it('shows the two keys of COMPLAINT:MANAGE to an administrator who has it', async () => {
    backend();
    renderPage(<LikenessComplaintsPage />);
    expect(
      await screen.findByTestId('config-row-complaint.likeness_due_hours'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('config-row-complaint.retention_days')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid^="config-row-"]')).toHaveLength(2);
    expect(screen.getByText('Parameters')).toBeInTheDocument();
  });

  it('shows no parameters to an administrator without it', async () => {
    signIn('support');
    backend();
    renderPage(<LikenessComplaintsPage />);
    await rowOf(1);
    expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-testid^="config-row-"]')).toHaveLength(0);
  });
});

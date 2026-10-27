import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saved } from '../../../mock/_core/configStore';
import adsMock from '../../../mock/ads.mock';
import configMock from '../../../mock/config.mock';
import { fileOf, jpegBytes, mp4Bytes, pngBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import CreativesPage from './creatives';
import {
  adsState,
  chooseOption,
  dialogsClosed,
  holdWrites,
  jsonAnswer,
  META,
  overrideFetch,
  settled,
  signIn,
  uploadModule,
  uploads,
  writesOf,
} from './testSetup';

// The upload goes to the mock backend, which answers with the record it made (a test has no XMLHttpRequest).
vi.mock('../../request/upload', async () => {
  const base = (await import('./testSetup')).uploadModule;
  return { uploadFile: async (options: { url: string; file: File }) => base.uploadFile(options) };
});

const backend = () => useMockBackend({ default: adsMock }, { default: configMock });

beforeEach(() => {
  signIn('root');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const rows = () => [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')];
const cellsOf = (tr: Element) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
const creative = (id: string) => {
  const found = adsState.creatives.get(id);
  if (!found) throw new Error(`no creative ${id}`);
  return found;
};
const unit = (id: string) => adsState.units.get(id)!;
const rowOf = async (id: string) => {
  await waitFor(() => expect(document.querySelector(`tr[data-row-key="${id}"]`)).not.toBeNull());
  return document.querySelector(`tr[data-row-key="${id}"]`) as HTMLTableRowElement;
};
const load = async () => {
  const calls = backend();
  const user = userEvent.setup();
  renderPage(<CreativesPage />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  return { calls, user };
};
const labelsIn = (row: Element) =>
  [...(row.querySelector('td:last-child') as Element).querySelectorAll('button')]
    .map((b) => (b.textContent ?? '').trim())
    .filter(Boolean);
const dialog = () => screen.findByRole('dialog');
const confirmInline = async (
  user: ReturnType<typeof userEvent.setup>,
  row: Element,
  label: string,
) => {
  await user.click(within(row as HTMLElement).getByRole('button', { name: label }));
  await user.click(await screen.findByRole('button', { name: 'OK' }));
};
const fromMore = async (user: ReturnType<typeof userEvent.setup>, row: Element, label: string) => {
  await user.click(within(row as HTMLElement).getByRole('button', { name: 'More' }));
  await user.click(await screen.findByRole('menuitem', { name: label }));
};
const refuse = (path: string) =>
  overrideFetch(async ({ url, method }) =>
    method === 'GET' && url.pathname === path
      ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'SECRET BACKEND WORDS')
      : undefined,
  );

const png = (name = 'a.png', width = 1080, height = 1920, padTo?: number) =>
  fileOf(pngBytes(width, height), name, padTo);
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });
/** The next upload is read by the mock backend as this file. */
const nextMedia = (media: Partial<NonNullable<typeof adsState.nextMedia>> = {}) => {
  adsState.nextMedia = {
    mediaType: 'IMAGE',
    width: 1080,
    height: 1920,
    bytes: 380_211,
    durationSeconds: null,
    ...media,
  };
};

describe('the creative page: reading', { timeout: 30000 }, () => {
  it('opens with the delivery checklist and the note about the weight and the A/B test', async () => {
    await load();
    expect(screen.getByText(/Delivery checklist/)).toBeInTheDocument();
    expect(screen.getByTestId('ads-checklist-layers').querySelectorAll('li')).toHaveLength(5);
    const note = screen.getByTestId('ads-creatives-weight-note').textContent ?? '';
    expect(note).toMatch(
      /Approved creatives that are running under one unit are chosen at random by weight/,
    );
    expect(note).toMatch(/A\/B test/);
    expect(note).toMatch(/weight of a creative that is already live cannot be changed/);
  });

  it('has the columns of the spec in its order', async () => {
    await load();
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      'Thumbnail',
      'Unit',
      'Type',
      'Language',
      'Review status',
      'Serving status',
      'Weight',
      'Actions',
    ]);
  });

  it('shows the thumbnail, the unit by its name, the type, the language, the two statuses apart and the weight', async () => {
    await load();
    await waitFor(() => expect(cellsOf(rows()[0])[1]).not.toMatch(/^\d+$/));
    const one = await rowOf('1');
    expect(one.querySelector('img')?.getAttribute('src')).toMatch(/^data:image/);
    const cells = cellsOf(one);
    expect(cells[1]).toContain(unit('1').name);
    expect(cells[2]).toBe('Image');
    expect(cells[3]).toBe('All languages');
    expect(cells[4]).toBe('Approved');
    expect(cells[5]).toContain('Running');
    expect(cells[6]).toBe('100');
    expect(cellsOf(await rowOf('2'))[2]).toBe('Video');
    expect(cellsOf(await rowOf('2'))[3]).toBe('th');
  });

  it('shows the serving status of an approved creative as a switch with its words, and a dash for a creative that is not approved', async () => {
    await load();
    const approved = await rowOf('1');
    expect(within(approved).getByRole('switch')).toBeChecked();
    const paused = await rowOf('2');
    expect(within(paused).getByRole('switch')).not.toBeChecked();
    expect(cellsOf(paused)[5]).toContain('Paused');
    for (const id of ['3', '4']) {
      const row = await rowOf(id);
      expect(row.querySelector('[role="switch"]')).toBeNull();
      expect(cellsOf(row)[5]).toBe('—');
    }
  });

  it('shows the note of a rejection with the rejected creative, and keeps a 5000-letter note inside the table', async () => {
    backend();
    creative('4').reviewNote = 'ก'.repeat(5000);
    renderPage(<CreativesPage />);
    const row = await rowOf('4');
    expect(cellsOf(row)[4]).toContain('Rejected');
    const note = [...row.querySelectorAll('button[data-lines]')].find((b) =>
      (b.textContent ?? '').includes('ก'),
    );
    expect(note).toBeDefined();
    expect((note as HTMLElement).style.overflowWrap).toBe('anywhere');
  });

  it('gives an approved creative no Edit and no Delete, only the switch and the hint to make a new one', async () => {
    await load();
    for (const id of ['1', '2', '5', '6', '8']) {
      const row = await rowOf(id);
      expect(labelsIn(row), id).toEqual([]);
      expect(within(row).queryByRole('button', { name: /edit|delete/i })).toBeNull();
      expect(row.textContent).toContain(
        'To change the content, make a new creative and pause this one.',
      );
    }
  });

  it('gives a draft Edit and Approve, with Reject and Delete under More, and a rejected one Edit and Delete', async () => {
    const { user } = await load();
    const draft = await rowOf('3');
    expect(labelsIn(draft)).toEqual(['Edit', 'Approve', 'More']);
    await user.click(within(draft).getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(labelsIn(await rowOf('4'))).toEqual(['Edit', 'Delete']);
    expect((await rowOf('3')).textContent).not.toContain('To change the content');
  });

  it('shows a dash for a thumbnail that is missing or is not an address, and does not use a script address', async () => {
    backend();
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/ads/creatives') return undefined;
      return jsonAnswer(200, '200', {
        items: [
          {
            id: '1',
            adUnitId: '1',
            type: 'IMAGE',
            thumbnailUrl: null,
            reviewStatus: 'DRAFT',
            servingStatus: 'ACTIVE',
            weight: 1,
            language: '*',
          },
          {
            id: '2',
            adUnitId: '1',
            type: 'IMAGE',
            thumbnailUrl: 'javascript:alert(1)',
            reviewStatus: 'DRAFT',
            servingStatus: 'ACTIVE',
            weight: 1,
            language: '*',
          },
          {
            id: '3',
            adUnitId: '1',
            type: 'IMAGE',
            thumbnailUrl: { x: 1 },
            reviewStatus: 'DRAFT',
            servingStatus: 'ACTIVE',
            weight: 1,
            language: '*',
          },
        ],
        total: 3,
      });
    });
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(document.querySelectorAll('.ant-table-tbody img')).toHaveLength(0);
    expect(cellsOf(rows()[0])[0]).toBe('—');
  });

  it('does not break on a row whose fields have the wrong type', async () => {
    backend();
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/ads/creatives') return undefined;
      return jsonAnswer(200, '200', {
        items: [
          {
            id: '1',
            adUnitId: 5,
            type: {},
            language: [],
            reviewStatus: 'WEIRD',
            servingStatus: 7,
            weight: 'x',
            reviewNote: 9,
          },
          { id: '2', adUnitId: null, reviewStatus: 'REJECTED', reviewNote: { a: 1 } },
        ],
        total: 2,
      });
    });
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(document.body.textContent).toContain('WEIRD');
  });

  it('is written in Chinese too', async () => {
    backend();
    renderPage(<CreativesPage />, 'zh-CN');
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const heads = [...document.querySelectorAll('.ant-table-thead th')].map((h) => h.textContent);
    expect(heads).toEqual([
      '缩略图',
      '所属单元',
      '类型',
      '语言',
      '审核状态',
      '投放状态',
      '权重',
      '操作',
    ]);
    expect(screen.getByRole('button', { name: '新建素材' })).toBeInTheDocument();
    expect(document.body.textContent).toContain('要换内容请新建一条，再暂停旧的');
  });
});

describe('the filters', { timeout: 30000 }, () => {
  const lastQuery = (calls: { method: string; url: string }[]) => {
    const reads = calls.filter((c) => c.url.startsWith('/api/admin/ads/creatives?'));
    return new URL(reads[reads.length - 1].url, 'http://x').searchParams;
  };

  it('asks for the unit, the campaign, the two statuses and the type that were chosen, and for nothing that is empty', async () => {
    const { calls, user } = await load();
    expect([...lastQuery(calls).keys()].sort()).toEqual(['page', 'pageSize']);
    await chooseOption(user, 'Unit', unit('1').name);
    await chooseOption(user, 'Campaign', adsState.campaigns.get('2')!.name);
    await chooseOption(user, 'Review status', 'Approved');
    await chooseOption(user, 'Serving status', 'Paused');
    await chooseOption(user, 'Type', 'Video');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(lastQuery(calls).get('type')).toBe('VIDEO'));
    expect(Object.fromEntries(lastQuery(calls))).toMatchObject({
      adUnitId: '1',
      campaignId: '2',
      reviewStatus: 'APPROVED',
      servingStatus: 'PAUSED',
    });
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('reads the first page again when Search is pressed with the same filters', async () => {
    const { calls, user } = await load();
    const count = () => calls.filter((c) => c.url.startsWith('/api/admin/ads/creatives?')).length;
    const before = count();
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(count()).toBe(before + 1));
  });

  it('shows the answer of the newest read even when an older one arrives later', async () => {
    backend();
    const gates: Record<string, () => void> = {};
    let n = 0;
    overrideFetch(async ({ url, method }) => {
      if (method !== 'GET' || url.pathname !== '/api/admin/ads/creatives') return undefined;
      if (++n === 2) {
        await new Promise<void>((resolve) => {
          gates.old = resolve;
        });
        return jsonAnswer(200, '200', {
          items: [
            {
              id: '99',
              adUnitId: '1',
              type: 'IMAGE',
              reviewStatus: 'DRAFT',
              servingStatus: 'ACTIVE',
              weight: 1,
              language: 'OLD ANSWER',
            },
          ],
          total: 1,
        });
      }
      return undefined;
    });
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await chooseOption(user, 'Type', 'Video');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(n).toBe(2));
    await chooseOption(user, 'Type', 'Image');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(n).toBeGreaterThanOrEqual(3));
    await waitFor(() => expect(rows().length).toBeGreaterThan(1));
    gates.old();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.body.textContent).not.toContain('OLD ANSWER');
  });

  it('disables the unit filter and says which permission is missing when the units cannot be read, and shows the unit id', async () => {
    backend();
    refuse('/api/admin/ads/units');
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    expect(await screen.findByText('Needs the ADS:UNIT permission')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Unit' })).toBeDisabled();
    expect(cellsOf(await rowOf('1'))[1]).toBe('1');
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });
});

describe('approve, reject, serve and delete', { timeout: 40000 }, () => {
  it('approves after a question that says an approved creative cannot be edited, once, and the row shows Approved', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('3')).getByRole('button', { name: 'Approve' }));
    expect(
      await screen.findByText(/An approved creative cannot be edited or deleted, only paused/),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/ads/creatives/3/review',
      body: { reviewStatus: 'APPROVED' },
    });
    await waitFor(() =>
      expect(cellsOf(document.querySelector('tr[data-row-key="3"]')!)[4]).toBe('Approved'),
    );
  });

  it('sends one request when the approval is pressed twice', async () => {
    const { calls, user } = await load();
    const gate = holdWrites();
    await user.click(within(await rowOf('3')).getByRole('button', { name: 'Approve' }));
    const ok = await screen.findByRole('button', { name: 'OK' });
    fireEvent.click(ok);
    fireEvent.click(ok);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('asks for a note before a rejection, sends it trimmed with the review status, and the row shows the note', async () => {
    const { calls, user } = await load();
    await fromMore(user, await rowOf('3'), 'Reject');
    const form = within(await dialog());
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter a reason')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    await user.type(form.getByRole('textbox'), '  Logo too small สวัสดี ');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/ads/creatives/3/review',
      body: { reviewStatus: 'REJECTED', reviewNote: 'Logo too small สวัสดี' },
    });
    await waitFor(() =>
      expect(cellsOf(document.querySelector('tr[data-row-key="3"]')!)[4]).toContain('Rejected'),
    );
    expect(document.querySelector('tr[data-row-key="3"]')!.textContent).toContain(
      'Logo too small สวัสดี',
    );
  });

  it('keeps the dialog open and says why in the words of the code when the backend refuses a rejection', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'PUT' && url.pathname.endsWith('/review')
        ? jsonAnswer(409, 'INVALID_STATE', { status: 'APPROVED' }, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await fromMore(user, await rowOf('3'), 'Reject');
    const form = within(await dialog());
    await user.type(form.getByRole('textbox'), 'no');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await form.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('sends one request when the rejection is submitted twice', async () => {
    const { calls, user } = await load();
    await fromMore(user, await rowOf('3'), 'Reject');
    const form = within(await dialog());
    await user.type(form.getByRole('textbox'), 'twice');
    const gate = holdWrites();
    const submit = form.getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await settled();
    expect(gate.started()).toBe(1);
    // Enter in a field submits the form itself, after its check is over: still one request.
    const formElement = document.querySelector('.ant-modal form') as Element;
    fireEvent.submit(formElement);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('pauses and resumes an approved creative at once with the switch, without a question and without a new review', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('1')).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/ads/creatives/1/serving-status',
      body: { servingStatus: 'PAUSED' },
    });
    await waitFor(() =>
      expect(
        within(document.querySelector('tr[data-row-key="1"]')!).getByRole('switch'),
      ).not.toBeChecked(),
    );
    expect(cellsOf(document.querySelector('tr[data-row-key="1"]')!)[4]).toBe('Approved');
    await user.click(within(await rowOf('2')).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(writesOf(calls)[1].body).toEqual({ servingStatus: 'ACTIVE' });
  });

  it('sends one request when the switch is pressed twice', async () => {
    const { calls } = await load();
    const gate = holdWrites();
    const toggle = within(await rowOf('1')).getByRole('switch');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the words of the error code when the switch is refused', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'PUT' && url.pathname.endsWith('/serving-status')
        ? jsonAnswer(403, 'ADMIN_FORBIDDEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(within(await rowOf('1')).getByRole('switch'));
    expect(await screen.findByText('You do not have permission to do this.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('deletes a rejected creative after a question that says which can be deleted, and the upload goes with it', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('4')).getByRole('button', { name: 'Delete' }));
    expect(
      await screen.findByText(/Only a draft or a rejected creative can be deleted/),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'DELETE',
      url: '/api/admin/ads/creatives/4',
    });
    await waitFor(() => expect(adsState.creatives.has('4')).toBe(false));
  });

  it('keeps the row and says why when the delete is refused', async () => {
    backend();
    overrideFetch(async ({ method }) =>
      method === 'DELETE'
        ? jsonAnswer(409, 'INVALID_STATE', { status: 'APPROVED' }, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(within(await rowOf('4')).getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(
      await screen.findByText('The current state of the item does not allow this action.'),
    ).toBeInTheDocument();
    expect(adsState.creatives.has('4')).toBe(true);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });
});

describe('the form: the file', { timeout: 60000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'New creative' }));
    return within(await dialog());
  };
  const pickUnit = async (
    user: ReturnType<typeof userEvent.setup>,
    form: ReturnType<typeof within>,
    id: string,
  ) => {
    await user.click(form.getByRole('combobox', { name: 'Unit' }));
    const options = await screen.findAllByText(unit(id).name, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
  };

  it('writes the types, the size limit and the pixel limit of an ad file beside the control, from meta', async () => {
    const { user } = await load();
    const form = await open(user);
    const text = form.getByTestId('upload-input').closest('div')?.parentElement?.textContent ?? '';
    expect(text).toContain('Accepted: JPEG / PNG / MP4');
    expect(text).toContain('Max 50 MB');
    expect(text).toContain('Up to 36 megapixels (images only)');
  });

  it('does not show a second, native file box (only the button)', async () => {
    const { user } = await load();
    await open(user);
    expect(document.querySelector('.ads-upload-box')).not.toBeNull();
  });

  it('stops a file of another type before any upload, and says what is accepted', async () => {
    const { user } = await load();
    const form = await open(user);
    choose(fileOf(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]), 'a.gif'));
    expect(
      await form.findByText('Wrong file type. Accepted: JPEG / PNG / MP4'),
    ).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });

  it('stops a file that is larger than the limit of meta, saying the limit and the size, before any upload', async () => {
    signIn('root', { meta: { ...META, adMediaMaxBytes: 2000 } });
    const { user } = await load();
    const form = await open(user);
    choose(png('big.png', 100, 100, 5000));
    expect(await form.findByText(/The file is too large/)).toBeInTheDocument();
    expect(form.getByText(/limit 1.95 KB/)).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });

  it('stops a picture whose header declares more pixels than the limit, without decoding it, and a JPEG as well', async () => {
    const { user } = await load();
    const form = await open(user);
    choose(png('wide.png', 20000, 20000));
    expect(await form.findByText(/The image has too many pixels/)).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
    choose(fileOf(jpegBytes({ width: 30000, height: 30000 }), 'wide.jpg'));
    await waitFor(() =>
      expect(form.getAllByText(/The image has too many pixels/).length).toBeGreaterThan(0),
    );
    expect(uploads).toHaveLength(0);
  });

  it('takes a video without any pixel check: an MP4 goes to the upload', async () => {
    nextMedia({ mediaType: 'VIDEO', durationSeconds: 12, bytes: 4_800_000 });
    const { user } = await load();
    const form = await open(user);
    choose(fileOf(mp4Bytes(), 'clip.mp4'));
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0]).toMatchObject({ url: '/ads/media', name: 'clip.mp4' });
    expect(await form.findByText('Uploaded: clip.mp4')).toBeInTheDocument();
  });

  it('does not check anything it was not told the limit of: without the limits of meta the server decides', async () => {
    signIn('root', { meta: { ...META, adMediaMaxBytes: null, adImageMaxPixels: null } });
    const { user } = await load();
    await open(user);
    choose(png('wide.png', 20000, 20000));
    await waitFor(() => expect(uploads).toHaveLength(1));
  });

  it('shows what the server read from the file, read-only: the type, the dimensions, the size, the duration and the thumbnail', async () => {
    nextMedia({
      mediaType: 'VIDEO',
      width: 1080,
      height: 1920,
      bytes: 4_800_000,
      durationSeconds: 12,
    });
    const { user } = await load();
    const form = await open(user);
    choose(fileOf(mp4Bytes(), 'clip.mp4'));
    const media = await form.findByTestId('creative-media');
    expect(media.textContent).toContain('Video');
    expect(media.textContent).toContain('1080 × 1920 px');
    expect(media.textContent).toContain('4.58 MB');
    expect(media.textContent).toContain('12 s');
    expect(media.querySelector('img')?.getAttribute('src')).toMatch(/^data:image/);
    expect(within(media).queryByRole('textbox')).toBeNull();
    expect(within(media).queryByRole('spinbutton')).toBeNull();
  });

  it('shows a dash for the duration of a picture', async () => {
    nextMedia();
    const { user } = await load();
    const form = await open(user);
    choose(png());
    const media = await form.findByTestId('creative-media');
    expect(media.textContent).toMatch(/Duration\s*—/);
    expect(media.textContent).toContain('Image');
  });

  it('says that the file fits the placement of the unit, and when it does not, why: the ratio, the shorter side, the size', async () => {
    nextMedia();
    const { user } = await load();
    const form = await open(user);
    await pickUnit(user, form, '1');
    choose(png());
    expect(await form.findByText(/The file fits the placement app_open/)).toBeInTheDocument();
    nextMedia({ width: 1280, height: 720, bytes: 12_000_000 });
    choose(png('b.png'));
    const bad = await form.findByTestId('creative-spec-check');
    await waitFor(() => expect(bad.textContent).toMatch(/does not fit the placement app_open/));
    expect(bad.textContent).toMatch(/The ratio 16:9 is not within 3% of 9:16/);
    expect(bad.textContent).toMatch(
      /The shorter side is 720 px; at least 720 px is needed|The file is 11.44 MB; at most 10 MB is allowed/,
    );
    expect(bad.textContent).toMatch(/at most 10 MB is allowed/);
  });

  it('works out the ratio check again when another unit is chosen, and uses the tolerance of the configuration when it can read it', async () => {
    saved.set('ads.creative_aspect_tolerance_percent', {
      value: 20,
      updatedAt: '2026-10-25T00:00:00.000Z',
      updatedBy: '1001',
      updatedByUsername: 'root',
    });
    nextMedia({ width: 1080, height: 2200, bytes: 1000 });
    const { user } = await load();
    const form = await open(user);
    await pickUnit(user, form, '1');
    choose(png('c.png'));
    expect(await form.findByText(/The file fits the placement app_open/)).toBeInTheDocument();
  });

  it('says that the file cannot be compared when the placements cannot be read, and leaves it to the server', async () => {
    backend();
    refuse('/api/admin/ads/placements');
    nextMedia();
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await open(user);
    await pickUnit(user, form, '1');
    choose(png());
    expect(
      await form.findByText(/cannot be compared with the placement spec here/),
    ).toBeInTheDocument();
  });

  it('asks for the file first when none was uploaded, and sends nothing', async () => {
    const { calls, user } = await load();
    const form = await open(user);
    await pickUnit(user, form, '1');
    await user.type(form.getByRole('textbox', { name: 'Click target' }), 'https://example.com/a');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Upload the file first')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('says to set upload.public_base_url in the system configuration when the upload answers 503, with a link for CONFIG:MANAGE only', async () => {
    adsState.mediaAvailable = false;
    const { user } = await load();
    const form = await open(user);
    choose(png());
    const hint = await form.findByTestId('creative-upload-unavailable');
    expect(hint.textContent).toContain('upload.public_base_url');
    expect(hint.textContent).toMatch(/system configuration/);
    const link = within(hint).getByRole('link');
    expect(link.getAttribute('href')).toBe('/config');
    expect(form.queryByText('A required service or setting is unavailable right now.')).toBeNull();
  });

  it('shows the hint without a link to an administrator who lacks CONFIG:MANAGE', async () => {
    signIn('support', { codes: ['ADS:CREATIVE'] });
    adsState.mediaAvailable = false;
    const { user } = await load();
    const form = await open(user);
    choose(png());
    const hint = await form.findByTestId('creative-upload-unavailable');
    expect(hint.textContent).toContain('upload.public_base_url');
    expect(within(hint).queryByRole('link')).toBeNull();
  });

  it('takes the hint away when a later upload works', async () => {
    adsState.mediaAvailable = false;
    const { user } = await load();
    const form = await open(user);
    choose(png());
    await form.findByTestId('creative-upload-unavailable');
    adsState.mediaAvailable = true;
    choose(png('again.png'));
    await waitFor(() => expect(form.queryByTestId('creative-upload-unavailable')).toBeNull());
    expect(await form.findByText('Uploaded: again.png')).toBeInTheDocument();
  });

  it('says what went wrong in the words of the code for any other failure of the upload, never the backend words', async () => {
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'POST' && url.pathname === '/api/admin/ads/media'
        ? jsonAnswer(400, 'INVALID_FILE', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await open(user);
    choose(png());
    expect(
      await form.findByText('The file is empty, too large, or of an unsupported type.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    expect(form.queryByTestId('creative-upload-unavailable')).toBeNull();
  });

  it('keeps Submit disabled while the file is uploading and enables it afterwards', async () => {
    nextMedia();
    const { user } = await load();
    const form = await open(user);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const real = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        if (String(input).endsWith('/ads/media')) await gate;
        return real(input, init);
      }),
    );
    choose(png());
    await waitFor(() => expect(form.getByRole('button', { name: 'Submit' })).toBeDisabled());
    release();
    await waitFor(() => expect(form.getByRole('button', { name: 'Submit' })).not.toBeDisabled());
  });
});

describe('the form: creating', { timeout: 60000 }, () => {
  const open = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'New creative' }));
    return within(await dialog());
  };
  const pickUnit = async (
    user: ReturnType<typeof userEvent.setup>,
    form: ReturnType<typeof within>,
    id: string,
  ) => {
    await user.click(form.getByRole('combobox', { name: 'Unit' }));
    const options = await screen.findAllByText(unit(id).name, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
  };
  const fill = async (
    user: ReturnType<typeof userEvent.setup>,
    form: ReturnType<typeof within>,
    unitId = '1',
    target = 'https://example.com/a',
  ) => {
    await pickUnit(user, form, unitId);
    choose(png());
    await form.findByTestId('creative-media');
    const field = form.getByRole('textbox', { name: 'Click target' });
    await user.clear(field);
    await user.type(field, target);
  };

  it('opens with the click action OPEN_URL, the language "all", the weight 100 and "skippable" on', async () => {
    const { user } = await load();
    const form = await open(user);
    expect(form.getByRole('spinbutton', { name: 'Weight' })).toHaveValue('100');
    expect(form.getByRole('switch', { name: 'Skippable' })).toBeChecked();
    expect(form.getByRole('combobox', { name: 'Language' })).toHaveValue('*');
    expect(form.getByText('Open a web address')).toBeInTheDocument();
  });

  it('uploads first and then creates with the upload id and nothing about the file: no address, no size, no dimensions, no type', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form);
    expect(writesOf(calls).filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(uploads).toHaveLength(1);
    const uploadId = [...adsState.uploads.keys()].find((k) => k.startsWith('up-0'));
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    const create = writesOf(calls)[1];
    expect(create).toMatchObject({ method: 'POST', url: '/api/admin/ads/creatives' });
    const body = create.body as Record<string, unknown>;
    expect(body.uploadId).toBe(uploadId);
    expect(body).toMatchObject({
      adUnitId: '1',
      clickAction: 'OPEN_URL',
      clickTarget: 'https://example.com/a',
      language: '*',
      weight: 100,
      skippable: true,
    });
    for (const name of [
      'mediaUrl',
      'thumbnailUrl',
      'width',
      'height',
      'bytes',
      'durationSeconds',
      'type',
    ]) {
      expect(body, name).not.toHaveProperty(name);
    }
    expect(JSON.stringify(body)).not.toMatch(/https:\/\/media|data:image/);
    await dialogsClosed();
    await waitFor(() => expect(rows().length).toBe(11));
  });

  it('sends the trimmed words, an empty text as null, and a weight of 0', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form);
    await user.type(form.getByRole('textbox', { name: 'Title' }), '  ข้อเสนอ 🚀  ');
    await user.type(form.getByRole('textbox', { name: 'Advertiser' }), '   ');
    const weight = form.getByRole('spinbutton', { name: 'Weight' });
    await user.clear(weight);
    await user.type(weight, '0');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(writesOf(calls)[1].body).toMatchObject({
      title: 'ข้อเสนอ 🚀',
      body: null,
      ctaText: null,
      advertiserName: null,
      weight: 0,
      rewardAfterSeconds: null,
    });
  });

  it('does not take a weight below 0', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form);
    const weight = form.getByRole('spinbutton', { name: 'Weight' });
    await user.clear(weight);
    await user.type(weight, '-5');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter a whole number, 0 or more')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('takes a link only when it is https, and says why when it is not', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form, '1', 'http://example.com/a');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await form.findByText('The link must start with lowercase https://.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('makes the target of an in-app route a list of the screens of the app, and sends the screen', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await pickUnit(user, form, '1');
    choose(png());
    await form.findByTestId('creative-media');
    await user.click(form.getByRole('combobox', { name: 'Click action' }));
    await user.click(
      (
        await screen.findAllByText('Open a screen of the app', {
          selector: '.ant-select-item-option-content',
        })
      )[0],
    );
    expect(form.queryByRole('textbox', { name: 'Click target' })).toBeNull();
    await user.click(form.getByRole('combobox', { name: 'Click target' }));
    for (const label of [
      'Conversation',
      'Companion profile',
      'Store',
      'Credits',
      'Settings',
      'Message list',
      'Subscription',
      'Check-in',
      'Daily tasks',
    ]) {
      expect(
        await screen.findAllByText(label, { selector: '.ant-select-item-option-content' }),
        label,
      ).not.toHaveLength(0);
    }
    await user.click(
      (await screen.findAllByText('Store', { selector: '.ant-select-item-option-content' }))[0],
    );
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(writesOf(calls)[1].body).toMatchObject({
      clickAction: 'IN_APP_ROUTE',
      clickTarget: 'store',
    });
  });

  it('asks for a screen when the route is chosen and no screen is', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await pickUnit(user, form, '1');
    choose(png());
    await form.findByTestId('creative-media');
    await user.click(form.getByRole('combobox', { name: 'Click action' }));
    await user.click(
      (
        await screen.findAllByText('Open a screen of the app', {
          selector: '.ant-select-item-option-content',
        })
      )[0],
    );
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Choose a screen')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('shows the policy warning when a creative of a splash or interstitial placement is made unskippable, does not show it on a native placement, and still saves', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form, '1');
    expect(form.queryByTestId('creative-policy-warning')).toBeNull();
    await user.click(form.getByRole('switch', { name: 'Skippable' }));
    const warning = await form.findByTestId('creative-policy-warning');
    expect(warning.textContent).toMatch(/Full-screen ads must be easy to close/);
    expect(warning.textContent).toMatch(/Google Play/);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(writesOf(calls)[1].body).toMatchObject({ skippable: false });
    expect(await screen.findByText(/A full-screen ad should be easy to close/)).toBeInTheDocument();
  });

  it('does not show the policy warning for an unskippable creative on a native placement', async () => {
    nextMedia();
    const { user } = await load();
    const form = await open(user);
    await fill(user, form, '3');
    await user.click(form.getByRole('switch', { name: 'Skippable' }));
    expect(form.queryByTestId('creative-policy-warning')).toBeNull();
  });

  it('shows the warning of a long skip countdown that the backend sends with a save, and the creative is saved', async () => {
    saved.set('ads.skip_after_seconds', {
      value: 8,
      updatedAt: '2026-10-25T00:00:00.000Z',
      updatedBy: '1001',
      updatedByUsername: 'root',
    });
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form, '2');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(await screen.findByText(/skip countdown .*is over 5 seconds/i)).toBeInTheDocument();
  });

  it('requires a title and a button text on a native placement', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form, '3');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('A native placement needs a title')).toBeInTheDocument();
    expect(form.getByText('A native placement needs a button text')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('requires a reward threshold of 5 to 30 seconds on a rewarded placement, and takes one in range', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form, '4');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter 5 to 30 seconds')).toBeInTheDocument();
    const threshold = form.getByRole('spinbutton', { name: 'Reward threshold (seconds)' });
    await user.type(threshold, '4');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter 5 to 30 seconds')).toBeInTheDocument();
    await user.clear(threshold);
    await user.type(threshold, '31');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter 5 to 30 seconds')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    await user.clear(threshold);
    await user.type(threshold, '30');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(writesOf(calls)[1].body).toMatchObject({ rewardAfterSeconds: 30 });
  });

  it('does not take a threshold longer than the video, says how long the video is, and puts no such limit on a picture', async () => {
    nextMedia({ mediaType: 'VIDEO', durationSeconds: 8, bytes: 5_000_000 });
    const { calls, user } = await load();
    const form = await open(user);
    await pickUnit(user, form, '4');
    choose(fileOf(mp4Bytes(), 'clip.mp4'));
    await form.findByTestId('creative-media');
    const field = form.getByRole('textbox', { name: 'Click target' });
    await user.type(field, 'https://example.com/a');
    const threshold = form.getByRole('spinbutton', { name: 'Reward threshold (seconds)' });
    await user.type(threshold, '9');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await form.findByText('The threshold cannot be longer than the video (8 seconds)'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(1);
    await user.clear(threshold);
    await user.type(threshold, '8');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
  });

  it('has no reward threshold on a placement that is not rewarded', async () => {
    nextMedia();
    const { user } = await load();
    const form = await open(user);
    await pickUnit(user, form, '1');
    expect(form.queryByRole('spinbutton', { name: 'Reward threshold (seconds)' })).toBeNull();
  });

  it('puts the upload again when the backend does not accept the upload id, and sends nothing until a new file is uploaded', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form);
    for (const upload of adsState.uploads.values())
      if (!upload.id.startsWith('up-seed')) upload.used = true;
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await form.findByText('The backend did not accept the uploaded file. Upload it again.'),
    ).toBeInTheDocument();
    expect(form.queryByTestId('creative-media')).toBeNull();
    const posts = () => writesOf(calls).filter((c) => c.url === '/api/admin/ads/creatives');
    expect(posts()).toHaveLength(1);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(posts()).toHaveLength(1);
    nextMedia();
    choose(png('new.png'));
    await form.findByTestId('creative-media');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(posts()).toHaveLength(2));
  });

  it('puts the fault of the backend under the field it names, in the words of the reason, and keeps the dialog open', async () => {
    nextMedia();
    backend();
    overrideFetch(async ({ url, method }) =>
      method === 'POST' && url.pathname === '/api/admin/ads/creatives'
        ? jsonAnswer(
            400,
            'INVALID_REQUEST',
            {
              details: [
                { ref: 'clickTarget', reason: 'INVALID_HOST' },
                { ref: 'weight', reason: 'OUT_OF_RANGE' },
              ],
            },
            'SECRET BACKEND WORDS',
          )
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await open(user);
    await fill(user, form);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('The value is outside the allowed range.')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('sends one request when Submit is pressed twice', async () => {
    nextMedia();
    const { calls, user } = await load();
    const form = await open(user);
    await fill(user, form);
    const gate = holdWrites();
    const submit = form.getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await settled();
    expect(gate.started()).toBe(1);
    // Enter in a field submits the form itself, after its check is over: still one request.
    const formElement = document.querySelector('.ant-modal form') as Element;
    fireEvent.submit(formElement);
    await settled();
    expect(gate.started()).toBe(1);
    gate.release();
    await settled();
    expect(writesOf(calls).filter((c) => c.url === '/api/admin/ads/creatives')).toHaveLength(1);
  });

  it('disables the unit selector and says which permission is missing when the units cannot be read', async () => {
    backend();
    refuse('/api/admin/ads/units');
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    const form = await open(user);
    expect(form.getByRole('combobox', { name: 'Unit' })).toBeDisabled();
    expect(form.getByText('Needs the ADS:UNIT permission')).toBeInTheDocument();
  });
});

describe('the form: editing', { timeout: 60000 }, () => {
  it('opens a draft with its fields filled in, the unit fixed, and the file shown read-only', async () => {
    const { user } = await load();
    await user.click(within(await rowOf('3')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    expect(form.getByTestId('creative-unit-fixed')).toHaveTextContent(unit('2').name);
    expect(form.queryByRole('combobox', { name: 'Unit' })).toBeNull();
    expect(form.getByRole('textbox', { name: 'Title' })).toHaveValue(creative('3').title as string);
    expect(form.getByRole('textbox', { name: 'Click target' })).toHaveValue(
      creative('3').clickTarget,
    );
    expect(form.getByRole('combobox', { name: 'Language' })).toHaveValue('vi');
    const media = form.getByTestId('creative-media');
    expect(media.textContent).toContain('1080 × 1920 px');
    expect(media.textContent).toMatch(/Current file/);
  });

  it('saves without a new file: the request has the fields and no upload id', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('3')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    const title = form.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'New title');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const write = writesOf(calls)[0];
    expect(write).toMatchObject({ method: 'PUT', url: '/api/admin/ads/creatives/3' });
    const body = write.body as Record<string, unknown>;
    expect(body).not.toHaveProperty('uploadId');
    expect(body).not.toHaveProperty('adUnitId');
    expect(body).toMatchObject({ title: 'New title', weight: 100, language: 'vi' });
    await dialogsClosed();
    expect(creative('3').title).toBe('New title');
  });

  it('sends the new upload id when a new file is uploaded, and shows the new file instead of the current one', async () => {
    nextMedia({ width: 1080, height: 1920, bytes: 123_456 });
    const { calls, user } = await load();
    await user.click(within(await rowOf('3')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    choose(png('new.png'));
    await waitFor(() =>
      expect(form.getByTestId('creative-media').textContent).not.toMatch(/Current file/),
    );
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls).filter((c) => c.method === 'PUT')).toHaveLength(1));
    const body = writesOf(calls).find((c) => c.method === 'PUT')!.body as { uploadId: string };
    expect(body.uploadId).toMatch(/^up-0/);
    expect(JSON.stringify(body)).not.toMatch(/mediaUrl|thumbnailUrl/);
  });

  it('a rejected creative that is saved goes back to a draft', async () => {
    const { user } = await load();
    await user.click(within(await rowOf('4')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await dialogsClosed();
    await waitFor(() =>
      expect(cellsOf(document.querySelector('tr[data-row-key="4"]')!)[4]).toBe('Draft'),
    );
  });

  it('does not let the reward threshold of a rewarded creative be cleared', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('7')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    const threshold = form.getByRole('spinbutton', { name: 'Reward threshold (seconds)' });
    expect(threshold).toHaveValue('5');
    await user.clear(threshold);
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(await form.findByText('Enter 5 to 30 seconds')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('sends the threshold again with an edit of a rewarded creative', async () => {
    const { calls, user } = await load();
    await user.click(within(await rowOf('7')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    await user.click(form.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ rewardAfterSeconds: 5 });
  });

  it('shows a title of 5000 letters in the form without breaking it', async () => {
    backend();
    creative('3').title = 'ก'.repeat(5000);
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(within(await rowOf('3')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    expect(form.getByRole('textbox', { name: 'Title' })).toHaveValue('ก'.repeat(5000));
  });
});

describe('a session that ends while a write is on its way', { timeout: 40000 }, () => {
  it('shows that it has ended, in the words of the code, and does not send an approval again', async () => {
    backend();
    const taken = overrideFetch(async ({ url, method }) =>
      method === 'PUT' && url.pathname.endsWith('/review')
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await confirmInline(user, await rowOf('3'), 'Approve');
    expect(
      await screen.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });

  it('does not send a new creative again when the session ends on the way', async () => {
    nextMedia();
    backend();
    const taken = overrideFetch(async ({ url, method }) =>
      method === 'POST' && url.pathname === '/api/admin/ads/creatives'
        ? jsonAnswer(401, 'ADMIN_INVALID_TOKEN', null, 'SECRET BACKEND WORDS')
        : undefined,
    );
    const user = userEvent.setup();
    renderPage(<CreativesPage />);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByRole('button', { name: 'New creative' }));
    const form = within(await dialog());
    await user.click(form.getByRole('combobox', { name: 'Unit' }));
    const options = await screen.findAllByText(unit('1').name, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    choose(png());
    await form.findByTestId('creative-media');
    await user.type(form.getByRole('textbox', { name: 'Click target' }), 'https://example.com/a');
    await user.click(form.getByRole('button', { name: 'Submit' }));
    expect(
      await form.findByText('Your session has expired. Please sign in again.'),
    ).toBeInTheDocument();
    await settled();
    expect(taken).toHaveLength(1);
    expect(document.body.textContent).not.toContain('SECRET BACKEND WORDS');
  });
});

describe('a dialog that is opened again', { timeout: 40000 }, () => {
  it('shows the creative that is edited, not what was typed in the dialog that was closed before', async () => {
    const { user } = await load();
    await user.click(screen.getByRole('button', { name: 'New creative' }));
    const first = within(await dialog());
    await user.type(
      first.getByRole('textbox', { name: 'Click target' }),
      'https://abandoned.example/',
    );
    await user.type(first.getByRole('textbox', { name: 'Title' }), 'Typed and abandoned');
    await user.click(first.getByRole('button', { name: 'Cancel' }));
    await user.click(within(await rowOf('3')).getByRole('button', { name: 'Edit' }));
    const form = within(await dialog());
    expect(form.getByRole('textbox', { name: 'Click target' })).toHaveValue(
      creative('3').clickTarget,
    );
    expect(form.getByRole('textbox', { name: 'Title' })).toHaveValue(creative('3').title as string);
    expect(form.getByTestId('creative-media').textContent).toMatch(/Current file/);
  });
});

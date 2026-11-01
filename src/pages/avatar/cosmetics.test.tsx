import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avatarState } from '../../../mock/_core/avatarData';
import avatarMock from '../../../mock/avatar.mock';
import channelsMock from '../../../mock/channels.mock';
import { fileOf, pngBytes, zipBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { ApiError } from '../../request/errors';
import CosmeticsPage from './cosmetics';
import {
  chooseOption,
  dialogsClosed,
  expandSearch,
  signIn,
  stubObjectUrls,
  uploadModule,
  uploads,
  writesOf,
} from './testSetup';

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

const png = (name = 'preview.png') => fileOf(pngBytes(100, 100), name);
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });

describe('the cosmetic catalog page: the list', { timeout: 30000 }, () => {
  it('lists the items with key, type, name, preview, styles, ends, price, free, default, switch and order', async () => {
    backend();
    renderPage(<CosmeticsPage />);
    const row = await rowOf('outfit_red_dress');
    expect(within(row).getByText('Outfit')).toBeInTheDocument();
    expect(within(row).getByText('Hello, how are you today?')).toBeInTheDocument();
    expect(within(row).getByText('Stylized 3D')).toBeInTheDocument();
    expect(within(row).getByText('Android · All channels of the platform')).toBeInTheDocument();
    expect(within(row).getByText('150')).toBeInTheDocument();
    expect(within(row).getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(row.querySelector('img')?.getAttribute('src')).toContain('/api/admin/mock-files/');
    const everywhere = await rowOf('outfit_default');
    expect(within(everywhere).getByText('All ends')).toBeInTheDocument();
    expect(within(everywhere).getByText('—')).toBeInTheDocument();
  });

  it('shows the name in the interface language, English when the item has none, and any language when it has no English', async () => {
    backend();
    renderPage(<CosmeticsPage />, 'zh-CN');
    expect(
      within(await rowOf('outfit_red_dress')).getByText('你好，今天过得怎么样？'),
    ).toBeInTheDocument();
    // English is the fallback of an item with no Chinese name; a name in Thai only shows the Thai.
    expect(within(await rowOf('outfit_long_name')).getByText(/^A{300}$/)).toBeInTheDocument();
    expect(within(await rowOf('outfit_only_thai')).getByText(/ภาษาไทย/)).toBeInTheDocument();
  });

  it('holds a name of 300 letters without a space and an Arabic name in the cell, as a button with the full text in a popover', async () => {
    backend();
    renderPage(<CosmeticsPage />);
    const row = await rowOf('outfit_long_name');
    const cell = within(row).getByText(/^A{300}$/);
    expect(cell.closest('button')).not.toBeNull();
  });

  it('shows a placeholder where the file is missing (previewUrl null) and a picture where it is not', async () => {
    backend();
    renderPage(<CosmeticsPage />);
    const missing = await rowOf('bg_night_city');
    expect(within(missing).getByTestId('no-picture')).toBeInTheDocument();
    expect(missing.querySelector('img')).toBeNull();
    expect((await rowOf('bg_beach')).querySelector('img')).not.toBeNull();
  });

  it('reads the list again each time it is opened and uses the new addresses, none kept from before', async () => {
    backend();
    const first = renderPage(<CosmeticsPage />);
    const before = (await rowOf('bg_beach')).querySelector('img')?.getAttribute('src');
    first.unmount();
    renderPage(<CosmeticsPage />);
    const after = (await rowOf('bg_beach')).querySelector('img')?.getAttribute('src');
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it('pages the 26 items by 20', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await rowOf('outfit_default');
    expect(screen.queryByText('bulk_item_18')).not.toBeInTheDocument();
    await user.click(await screen.findByTitle('2'));
    expect(await screen.findByText('bulk_item_18')).toBeInTheDocument();
    expect(calls.some((c) => c.url.includes('page=2&pageSize=20'))).toBe(true);
  });

  it('asks the backend for the type, the on-sale state and the style that were chosen', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await rowOf('outfit_default');
    await expandSearch(user);
    await chooseOption(user, 'Type', 'Background');
    await chooseOption(user, 'Fits style', 'Realistic');
    await chooseOption(user, 'On', 'Off sale');
    await user.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.url.includes('kind=BACKGROUND') &&
            c.url.includes('style=REALISTIC') &&
            c.url.includes('enabled=false'),
        ),
      ).toBe(true),
    );
  });
});

describe('the cosmetic catalog page: the on/off switch', { timeout: 30000 }, () => {
  it('sends one PUT to /enabled with the new state and shows what the backend holds', async () => {
    const calls = backend();
    renderPage(<CosmeticsPage />);
    const row = await rowOf('outfit_red_dress');
    fireEvent.click(within(row).getByRole('switch'));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/cosmetics/3/enabled',
      body: { enabled: false },
    });
    await waitFor(async () =>
      expect(
        within(await rowOf('outfit_red_dress'))
          .getByRole('switch')
          .getAttribute('aria-checked'),
      ).toBe('false'),
    );
  });

  it('sends one request when the switch is pressed twice at once', async () => {
    const calls = backend();
    renderPage(<CosmeticsPage />);
    const sw = within(await rowOf('outfit_red_dress')).getByRole('switch');
    fireEvent.click(sw);
    fireEvent.click(sw);
    await waitFor(() => expect(writesOf(calls).length).toBeGreaterThanOrEqual(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('says why when the backend refuses, and reads the list again', async () => {
    backend();
    renderPage(<CosmeticsPage />);
    const row = await rowOf('outfit_red_dress');
    avatarState.cosmetics = avatarState.cosmetics.filter((c) => c.id !== '3');
    fireEvent.click(within(row).getByRole('switch'));
    expect(await screen.findByText('The item was not found.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('outfit_red_dress')).not.toBeInTheDocument());
  });
});

describe('the cosmetic catalog page: permissions', { timeout: 30000 }, () => {
  it('without COSMETIC:MANAGE (only the right to give) there is no new, no edit, and the switch is off', async () => {
    signIn('support', { codes: ['COSMETIC:GRANT'] });
    backend();
    renderPage(<CosmeticsPage />);
    const row = await rowOf('outfit_red_dress');
    expect(screen.queryByRole('button', { name: 'New item' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(row).getByRole('switch')).toBeDisabled();
  });
});

describe('the cosmetic catalog page: new item', { timeout: 60000 }, () => {
  const fillBasics = (dialog: HTMLElement, spec = 'a red hat with a wide brim') => {
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: ' red_hat ' } });
    fireEvent.change(within(dialog).getByLabelText('en'), { target: { value: ' Red hat ' } });
    fireEvent.change(within(dialog).getByLabelText('th'), { target: { value: 'หมวกแดง' } });
    fireEvent.change(within(dialog).getByLabelText('Generation text'), { target: { value: spec } });
  };

  it('uploads the picture first, then sends its uploadId and no address, and lists the new item', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    fillBasics(dialog);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].url).toBe('/uploads/catalog-image');
    await within(dialog).findByText(/Uploaded|preview\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() =>
      expect(writesOf(calls).filter((c) => c.url === '/api/admin/cosmetics')).toHaveLength(1),
    );
    const posted = writesOf(calls).find((c) => c.url === '/api/admin/cosmetics') as {
      body: Record<string, unknown>;
    };
    expect(posted.body).toMatchObject({
      key: 'red_hat',
      kind: 'OUTFIT',
      names: { en: 'Red hat', th: 'หมวกแดง' },
      generationSpec: 'a red hat with a wide brim',
      compatibleStyles: ['STYLIZED_3D'],
      surfaces: [],
      creditPrice: null,
      isFree: false,
      isDefault: false,
      sortOrder: 0,
      enabled: false,
    });
    expect(String(posted.body.previewUploadId)).toMatch(/^upl-/);
    expect(JSON.stringify(posted.body)).not.toMatch(/previewUrl|mock-files|http/);
    expect(await screen.findByText('red_hat')).toBeInTheDocument();
    await dialogsClosed();
  });

  it('sends the ends chosen in the picker', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    fillBasics(dialog);
    await chooseOption(user, 'Android', 'play · Android store', dialog);
    await chooseOption(user, 'iOS', 'All channels of the platform', dialog);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/preview\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({
      surfaces: [
        { platform: 'ANDROID', channel: 'play' },
        { platform: 'IOS', channel: null },
      ],
    });
  });

  it('does not send without a picture, and says so', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    fillBasics(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Upload a preview picture first.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('does not send the picture uploaded before when a new file was chosen and stopped before its upload', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    fillBasics(dialog);
    choose(png('first.png'));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/Uploaded|first\.png/);
    // The person picks another file; it is too big and never reaches the server.
    choose(fileOf(pngBytes(100, 100), 'big.png', 2 * 1024 * 1024 + 1));
    expect(await screen.findByText(/The file is too large: limit 2 MB/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Upload a preview picture first.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('asks for a key, a name in some language and a generation text', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter a key.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a name in at least one language.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter the generation text.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('counts the generation text in code points after trimming: 2000 emoji pass, 2001 Arabic letters do not, spaces only is empty', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    fillBasics(dialog, 'ب'.repeat(2001));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('The generation text must be 1 to 2000 characters long.'),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Generation text'), {
      target: { value: String.fromCharCode(0x3000, 0xa0, 0x20) },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter the generation text.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Generation text'), {
      target: {
        value: `${String.fromCharCode(0x3000)}${'😀'.repeat(2000)}${String.fromCharCode(0x3000)}`,
      },
    });
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/preview\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect((writesOf(calls)[0].body as { generationSpec: string }).generationSpec).toBe(
      '😀'.repeat(2000),
    );
  });

  it('stops a picture over 2 MiB, over 36 megapixels, or not a JPEG or PNG before any upload', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    await screen.findByRole('dialog');
    choose(fileOf(pngBytes(100, 100), 'big.png', 2 * 1024 * 1024 + 1));
    expect(await screen.findByText(/The file is too large: limit 2 MB/)).toBeInTheDocument();
    choose(fileOf(pngBytes(7000, 7000), 'wide.png'));
    expect(await screen.findByText(/too many pixels: limit 36 megapixels/)).toBeInTheDocument();
    choose(fileOf(zipBytes(), 'zip.png'));
    expect(await screen.findByText(/Wrong file type/)).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
    expect(calls.filter((c) => c.url.startsWith('/api/admin/uploads'))).toHaveLength(0);
  });

  it('shows the text of INVALID_FILE when the server refuses a picture the page let through', async () => {
    backend();
    const user = userEvent.setup();
    vi.spyOn(uploadModule, 'uploadFile').mockRejectedValueOnce(
      new ApiError({ code: 'INVALID_FILE', httpStatus: 400, message: 'bad', data: null }),
    );
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    await screen.findByRole('dialog');
    choose(png());
    expect(
      await screen.findByText('The file is empty, too large, or of an unsupported type.'),
    ).toBeInTheDocument();
  });

  it('shows the backend text under the field when it refuses, keeps the dialog open and keeps the upload', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    fillBasics(dialog);
    // The key of an existing item.
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'bg_beach' } });
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/preview\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('An item with the same unique value already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Sending again does not need the file again.
    fireEvent.change(within(dialog).getByLabelText('Key'), { target: { value: 'bg_beach_2' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(2));
    expect(uploads).toHaveLength(1);
  });

  it('asks for the file again when the backend refuses the upload id, and does not send it again', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    fillBasics(dialog);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/preview\.png/);
    for (const upload of avatarState.uploads.values()) upload.used = true;
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText(
        'The server did not accept the uploaded picture. Upload it again.',
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findAllByText('Upload a preview picture first.')).not.toHaveLength(
      0,
    );
    expect(writesOf(calls)).toHaveLength(1);
  });

  it('cannot be sent while the picture is still going up', async () => {
    backend();
    const user = userEvent.setup();
    let finish: (value: { uploadId: string }) => void = () => {};
    vi.spyOn(uploadModule, 'uploadFile').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    choose(png());
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeDisabled(),
    );
    finish({ uploadId: 'upl-late' });
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeEnabled(),
    );
  });

  it('sends once when Submit is pressed twice at once', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    await user.click(await screen.findByRole('button', { name: 'New item' }));
    const dialog = await screen.findByRole('dialog');
    fillBasics(dialog);
    choose(png());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/preview\.png/);
    const submit = within(dialog).getByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await new Promise((r) => setTimeout(r, 200));
    expect(writesOf(calls).filter((c) => c.method === 'POST')).toHaveLength(1);
  });
});

describe('the cosmetic catalog page: edit', { timeout: 60000 }, () => {
  it('shows the key and the type but does not let them change, and sends neither', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    const row = await rowOf('outfit_red_dress');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Key')).toBeDisabled();
    expect(within(dialog).getByLabelText('Key')).toHaveValue('outfit_red_dress');
    expect(within(dialog).getByRole('combobox', { name: 'Type' })).toBeDisabled();
    expect(within(dialog).getByLabelText('Generation text')).toHaveValue(
      'a red evening dress with thin straps',
    );
    fireEvent.change(within(dialog).getByLabelText('Generation text'), {
      target: { value: 'a green evening dress' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ method: 'PUT', url: '/api/admin/cosmetics/3' });
    const body = writesOf(calls)[0].body as Record<string, unknown>;
    expect('key' in body).toBe(false);
    expect('kind' in body).toBe(false);
    expect('previewUploadId' in body).toBe(false);
    expect(body).toMatchObject({ generationSpec: 'a green evening dress', creditPrice: 150 });
    await dialogsClosed();
  });

  it('sends a new picture only when one was uploaded, and null for a price that was cleared', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    const row = await rowOf('outfit_red_dress');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Credit price'), { target: { value: '' } });
    choose(png('new.png'));
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/new\.png/);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const body = writesOf(calls)[0].body as Record<string, unknown>;
    expect(body.creditPrice).toBeNull();
    expect(String(body.previewUploadId)).toMatch(/^upl-/);
  });

  it('shows the backend text for a field when it refuses: a default item must be free', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<CosmeticsPage />);
    const row = await rowOf('outfit_red_dress');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('switch', { name: 'Default' }));
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findAllByText('The value is outside the allowed range.'),
    ).not.toHaveLength(0);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

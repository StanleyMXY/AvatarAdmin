import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import avatarMock from '../../../mock/avatar.mock';
import { fileOf, pngBytes, zipBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { setTestAccess, setTestInitialState } from '../../../tests/stubs/umi-max';
import access from '../../access';
import RendererModelsPage from './rendererModels';
import {
  chooseOption,
  META,
  signIn,
  stubObjectUrls,
  uploadModule,
  uploads,
  writesOf,
} from './testSetup';

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

const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });
const zip = (name = 'avatar-renderer-1.2.0.zip') => fileOf(zipBytes(), name);

const fill = (dialog: HTMLElement, version = '1.2.0') => {
  fireEvent.change(within(dialog).getByLabelText('Version'), { target: { value: version } });
  fireEvent.change(within(dialog).getByLabelText('ABI'), { target: { value: ' x86_64 ' } });
  fireEvent.change(within(dialog).getByLabelText('Lowest app version code'), {
    target: { value: '150' },
  });
};

describe('the renderer model page', { timeout: 60000 }, () => {
  it('lists the fields of the contract; the size is in readable units and the digest is text, not a field', async () => {
    backend();
    renderPage(<RendererModelsPage />);
    const rows = await screen.findAllByText('AVATAR_RENDERER_V1');
    expect(rows).toHaveLength(3);
    const android = (await screen.findByText('arm64-v8a')).closest('tr') as HTMLElement;
    expect(within(android).getByText('1.0.0')).toBeInTheDocument();
    expect(within(android).getByText('Android')).toBeInTheDocument();
    expect(within(android).getByText('46 MB')).toBeInTheDocument();
    expect(
      within(android).getByText(
        /^a3f1c9d2e47b58c01f6a2b9d84e3705ca1b6f08d92e4c7a35b10d6e8f9a2c4b7$/,
      ),
    ).toBeInTheDocument();
    expect(android.querySelector('input[type="text"]')).toBeNull();
    expect(within(android).getByRole('switch').getAttribute('aria-checked')).toBe('true');
    const off = (await screen.findByText('armeabi-v7a')).closest('tr') as HTMLElement;
    expect(within(off).getByRole('switch').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText(/to every build; there is no scope/)).toBeInTheDocument();
  });

  it('turns a model on or off with one PUT to /enabled', async () => {
    const calls = backend();
    renderPage(<RendererModelsPage />);
    const off = (await screen.findByText('armeabi-v7a')).closest('tr') as HTMLElement;
    const sw = within(off).getByRole('switch');
    fireEvent.click(sw);
    fireEvent.click(sw);
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 100));
    expect(writesOf(calls)).toHaveLength(1);
    expect(writesOf(calls)[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/renderer-models/3/enabled',
      body: { enabled: true },
    });
  });

  it('uploads the zip first, then sends its id with the six fields and no digest or size', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<RendererModelsPage />);
    await user.click(await screen.findByRole('button', { name: 'Register a model' }));
    const dialog = await screen.findByRole('dialog');
    choose(zip());
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].url).toBe('/uploads/renderer-model');
    await within(dialog).findByText(/avatar-renderer-1\.2\.0\.zip/);
    fill(dialog);
    await chooseOption(user, 'Platform', 'Android', dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const body = writesOf(calls)[0].body as Record<string, unknown>;
    expect(writesOf(calls)[0]).toMatchObject({ method: 'POST', url: '/api/admin/renderer-models' });
    expect(Object.keys(body).sort()).toEqual(
      [
        'abi',
        'minVersionCode',
        'platform',
        'rendererFormatVersion',
        'rendererKind',
        'uploadId',
        'version',
      ].sort(),
    );
    expect(body).toMatchObject({
      rendererKind: 'AVATAR_RENDERER_V1',
      version: '1.2.0',
      platform: 'ANDROID',
      abi: 'x86_64',
      rendererFormatVersion: 1,
      minVersionCode: 150,
    });
    expect(String(body.uploadId)).toMatch(/^upl-/);
    // The new model is listed with the size of the uploaded file, which the backend took from its upload record.
    expect(await screen.findByText('x86_64')).toBeInTheDocument();
    expect(await screen.findAllByText('45 MB')).not.toHaveLength(0);
  });

  it('cannot be sent while the zip is going up, and not at all without a zip', async () => {
    const calls = backend();
    const user = userEvent.setup();
    let finish: (value: { uploadId: string }) => void = () => {};
    vi.spyOn(uploadModule, 'uploadFile').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPage(<RendererModelsPage />);
    await user.click(await screen.findByRole('button', { name: 'Register a model' }));
    const dialog = await screen.findByRole('dialog');
    fill(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Upload the model file first.')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
    choose(zip());
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeDisabled(),
    );
    finish({ uploadId: 'upl-unknown' });
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Submit' })).toBeEnabled(),
    );
  });

  it('stops a zip over renderAssetMaxBytes and a file that is not a zip before any upload', async () => {
    setTestInitialState({ me: {}, meta: { ...META, renderAssetMaxBytes: 1000 } });
    backend();
    const user = userEvent.setup();
    renderPage(<RendererModelsPage />);
    await user.click(await screen.findByRole('button', { name: 'Register a model' }));
    await screen.findByRole('dialog');
    choose(fileOf(zipBytes(), 'big.zip', 5000));
    expect(await screen.findByText(/The file is too large: limit 1,000 B/)).toBeInTheDocument();
    choose(fileOf(pngBytes(10, 10), 'model.zip'));
    expect(await screen.findByText(/Wrong file type/)).toBeInTheDocument();
    choose(fileOf(zipBytes(), 'model.rar'));
    expect(await screen.findAllByText(/Wrong file type/)).not.toHaveLength(0);
    expect(uploads).toHaveLength(0);
  });

  it('keeps the dialog open and says so when the same model exists already', async () => {
    backend();
    const user = userEvent.setup();
    renderPage(<RendererModelsPage />);
    await user.click(await screen.findByRole('button', { name: 'Register a model' }));
    const dialog = await screen.findByRole('dialog');
    choose(zip());
    await waitFor(() => expect(uploads).toHaveLength(1));
    await within(dialog).findByText(/avatar-renderer/);
    fireEvent.change(within(dialog).getByLabelText('Version'), { target: { value: '1.0.0' } });
    fireEvent.change(within(dialog).getByLabelText('ABI'), { target: { value: 'arm64-v8a' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(
      await within(dialog).findByText('An item with the same unique value already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('asks for every field, a whole format version of 1 or more, and a whole version code', async () => {
    const calls = backend();
    const user = userEvent.setup();
    renderPage(<RendererModelsPage />);
    await user.click(await screen.findByRole('button', { name: 'Register a model' }));
    const dialog = await screen.findByRole('dialog');
    choose(zip());
    await waitFor(() => expect(uploads).toHaveLength(1));
    fireEvent.change(within(dialog).getByLabelText('Format version'), { target: { value: '0' } });
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    expect(await within(dialog).findByText('Enter the version.')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter the ABI.')).toBeInTheDocument();
    expect(
      within(dialog).getByText('The format version must be a whole number, 1 or more.'),
    ).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('has no register button and no live switch without RENDERER:MANAGE in the interface', async () => {
    backend();
    setTestAccess(access({ me: { superAdmin: false, permissions: ['GENERATION:VIEW'] } }));
    renderPage(<RendererModelsPage />);
    const row = (await screen.findByText('arm64-v8a')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('switch')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Register a model' })).not.toBeInTheDocument();
  });
});

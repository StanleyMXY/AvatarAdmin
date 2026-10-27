import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appVersionsMock from '../../../mock/appVersions.mock';
import channelsMock from '../../../mock/channels.mock';
import { fileOf, zipBytes } from '../../../tests/imageBytes';
import { useMockBackend } from '../../../tests/mockBackend';
import { renderPage } from '../../../tests/renderPage';
import { META, signIn } from './testSetup';
import AppVersionsPage from './versions';

// This upload reports its progress and waits to be let go, so the page can be seen in between.
const gate = vi.hoisted(() => {
  let release: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release: () => release(), aborted: { value: false } };
});
vi.mock('../../request/upload', async () => {
  const { apiRequest } = await import('../../request/apiClient');
  return {
    uploadFile: async (options: {
      url: string;
      signal?: AbortSignal;
      onProgress?: (loaded: number, total: number) => void;
    }) => {
      options.onProgress?.(30, 120);
      options.signal?.addEventListener('abort', () => {
        gate.aborted.value = true;
      });
      await gate.promise;
      return apiRequest({ method: 'POST', url: options.url });
    },
  };
});

beforeEach(() => {
  signIn('root', { meta: META });
  gate.aborted.value = false;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the progress of the APK upload', () => {
  it('shows the progress while the file goes up and the file when it is up', async () => {
    useMockBackend({ default: appVersionsMock }, { default: channelsMock });
    const user = userEvent.setup();
    renderPage(<AppVersionsPage />);
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-table-tbody tr.ant-table-row').length).toBeGreaterThan(
        0,
      ),
    );
    await user.click(screen.getByRole('button', { name: 'New version' }));
    const form = within(await screen.findByRole('dialog'));
    await user.click(form.getByRole('combobox', { name: 'Channel package' }));
    const options = await screen.findAllByText(/Direct download/, {
      selector: '.ant-select-item-option-content',
    });
    await user.click(options[options.length - 1]);
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [fileOf(zipBytes(), 'avatar.apk')] },
    });
    expect(await form.findByText('Uploading 25%')).toBeTruthy();
    expect(form.getByRole('progressbar')).toBeTruthy();
    expect(form.queryByTestId('apk-info')).toBeNull();
    gate.release();
    expect(await form.findByTestId('apk-info')).toBeTruthy();
    expect(form.queryByRole('progressbar')).toBeNull();
    expect(form.getByText('Uploaded: avatar.apk')).toBeTruthy();
  });
});

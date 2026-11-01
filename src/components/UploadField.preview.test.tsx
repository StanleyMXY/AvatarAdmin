import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelope, type FakeXHR, stubXhr } from '../../tests/httpStubs';
import { fileOf, mp4Bytes, pngBytes } from '../../tests/imageBytes';
import { renderPage } from '../../tests/renderPage';
import { resetUmiStub, setTestInitialState } from '../../tests/stubs/umi-max';
import { resetSessionState, setToken } from '../request/session';
import { PREVIEW_MAX_PIXELS, UploadField } from './UploadField';

// The preview of a chosen picture: when it is made, when it is given back, and what a second choice of
// the same file does. (The checks of limits and the upload itself are in UploadField.test.tsx.)
let xhrs: FakeXHR[];
let urls: string[];

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
  xhrs = stubXhr();
  let n = 0;
  urls = [];
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => {
    n += 1;
    return `blob:preview-${n}`;
  });
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn((u: string) => {
    urls.push(u);
  });
  setTestInitialState({
    me: {},
    meta: { pushImageMaxBytes: 1_048_576, adMediaMaxBytes: 52_428_800 },
  });
});
afterEach(() => vi.unstubAllGlobals());

const mount = (kind: 'pushImage' | 'adMedia' = 'pushImage', onCleared = vi.fn()) => {
  const onUploaded = vi.fn();
  const view = renderPage(
    <UploadField
      kind={kind}
      onUploaded={onUploaded}
      onBusyChange={vi.fn()}
      onCleared={onCleared}
    />,
  );
  return { onUploaded, onCleared, ...view };
};
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });

describe('UploadField: the preview is given back when it is not needed any more', () => {
  it('when the upload fails', async () => {
    mount();
    choose(fileOf(pngBytes(100, 100), 'a.png'));
    await waitFor(() => expect(xhrs).toHaveLength(1));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    xhrs[0].respond(400, JSON.stringify(envelope('INVALID_FILE')));
    await waitFor(() => expect(urls).toEqual(['blob:preview-1']));
  });

  it('when another file is chosen, and when the control goes away', async () => {
    const { unmount } = mount();
    choose(fileOf(pngBytes(100, 100), 'a.png'));
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(200, JSON.stringify(envelope('200', { uploadId: 'u-1' })));
    await waitFor(() => expect(screen.getByText(/a\.png/)).toBeInTheDocument());
    choose(fileOf(pngBytes(120, 120), 'b.png'));
    await waitFor(() => expect(urls).toContain('blob:preview-1'));
    await waitFor(() => expect(xhrs).toHaveLength(2));
    unmount();
    expect(urls).toContain('blob:preview-2');
  });
});

describe('UploadField: the same file chosen again', () => {
  it('is sent again, and the form is told to forget the upload id of the first time', async () => {
    const { onUploaded, onCleared } = mount();
    const file = fileOf(pngBytes(100, 100), 'again.png');
    choose(file);
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(200, JSON.stringify(envelope('200', { uploadId: 'u-1' })));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ uploadId: 'u-1' }));
    choose(file);
    await waitFor(() => expect(xhrs).toHaveLength(2));
    expect(onCleared).toHaveBeenCalledTimes(1);
    xhrs[1].respond(200, JSON.stringify(envelope('200', { uploadId: 'u-2' })));
    await waitFor(() => expect(onUploaded).toHaveBeenLastCalledWith({ uploadId: 'u-2' }));
  });
});

describe('UploadField: the native file box is emptied after each choice, which is what lets the same file be chosen again', () => {
  it('writes an empty value to it as soon as a file has been taken', async () => {
    mount();
    const input = screen.getByTestId('upload-input') as HTMLInputElement;
    const writes: string[] = [];
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => '',
      set: (v: string) => writes.push(v),
    });
    choose(fileOf(pngBytes(100, 100), 'a.png'));
    await waitFor(() => expect(xhrs).toHaveLength(1));
    expect(writes).toEqual(['']);
  });
});

describe('UploadField: which files get a preview', () => {
  it('a picture is previewed by its type or by the ending of its name, not by neither', async () => {
    const cases: [string, string, boolean][] = [
      ['a.png', '', true],
      ['photo', 'image/png', true],
      ['A.PNG', '', true],
      ['photo', '', false],
    ];
    for (const [name, type, previewed] of cases) {
      (URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear();
      const { unmount } = mount();
      choose(new File([pngBytes(100, 100) as BlobPart], name, { type }));
      await waitFor(() => expect(xhrs.length).toBeGreaterThan(0));
      xhrs.length = 0;
      expect(URL.createObjectURL, `${name} / ${type}`).toHaveBeenCalledTimes(previewed ? 1 : 0);
      unmount();
    }
  });

  it('a video gets no preview, and is still uploaded', async () => {
    mount('adMedia');
    choose(fileOf(mp4Bytes(), 'clip.mp4'));
    await waitFor(() => expect(xhrs).toHaveLength(1));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('exactly 16 megapixels are previewed and one pixel more is not', async () => {
    expect(PREVIEW_MAX_PIXELS).toBe(16_000_000);
    const { unmount } = mount();
    choose(fileOf(pngBytes(4000, 4000), 'edge.png'));
    await waitFor(() => expect(xhrs).toHaveLength(1));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    unmount();
    (URL.createObjectURL as ReturnType<typeof vi.fn>).mockClear();
    xhrs.length = 0;
    mount();
    choose(fileOf(pngBytes(4001, 4000), 'over.png'));
    await waitFor(() => expect(xhrs).toHaveLength(1));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('a picture whose size cannot be read from its header is uploaded without a preview', async () => {
    mount();
    const cut = pngBytes(100, 100).slice(0, 14); // the signature and the start of the header chunk
    choose(new File([cut as BlobPart], 'cut.png', { type: 'image/png' }));
    await waitFor(() => expect(xhrs).toHaveLength(1)); // not refused: the type is told by the first bytes
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});

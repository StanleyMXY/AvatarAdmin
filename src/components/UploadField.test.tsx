import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { envelope, type FakeXHR, flush, stubXhr } from '../../tests/httpStubs';
import { fileOf, jpegBytes, mp4Bytes, pngBytes, zipBytes } from '../../tests/imageBytes';
import { renderPage } from '../../tests/renderPage';
import { resetUmiStub, setTestInitialState } from '../../tests/stubs/umi-max';
import { ApiError } from '../request/errors';
import { resetSessionState, setToken } from '../request/session';
import { isUploadIdRejection } from '../utils/uploadErrors';
import { UPLOAD_ENTRIES, type UploadKind } from '../utils/uploadLimits';
import { UploadField } from './UploadField';

let xhrs: FakeXHR[];
const META = {
  pushImageMaxBytes: 1_048_576,
  uploadMaxBytes: 10_485_760,
  adMediaMaxBytes: 52_428_800,
  apkMaxBytes: 104_857_600,
  renderAssetMaxBytes: 209_715_200,
  catalogImageMaxBytes: 2_097_152,
  catalogImageMaxPixels: 36_000_000,
  adImageMaxPixels: 36_000_000,
  defaultAvatarSourceMaxPixels: 250_000_000,
};

beforeEach(() => {
  resetUmiStub();
  resetSessionState();
  sessionStorage.clear();
  setToken('tok');
  xhrs = stubXhr();
  (URL as unknown as { createObjectURL: unknown }).createObjectURL = vi.fn(() => 'blob:preview');
  (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = vi.fn();
  setTestInitialState({ me: {}, meta: META });
});
afterEach(() => vi.unstubAllGlobals());

type Props = Partial<React.ComponentProps<typeof UploadField<{ uploadId: string }>>>;
const mount = (kind: UploadKind, props: Props = {}) => {
  const onUploaded = props.onUploaded ?? vi.fn();
  const onBusyChange = (props.onBusyChange ?? vi.fn()) as Mock<(busy: boolean) => void>;
  const view = renderPage(
    <UploadField kind={kind} onUploaded={onUploaded} onBusyChange={onBusyChange} {...props} />,
  );
  return { onUploaded, onBusyChange, ...view };
};
const choose = (file: File) =>
  fireEvent.change(screen.getByTestId('upload-input'), { target: { files: [file] } });

/** A valid file for each entry, and a way to make it too big in bytes. */
const GOOD: Record<UploadKind, () => File> = {
  pushImage: () => fileOf(pngBytes(100, 100), 'a.png'),
  catalogImage: () => fileOf(pngBytes(100, 100), 'a.png'),
  adMedia: () => fileOf(mp4Bytes(), 'a.mp4'),
  apk: () => fileOf(zipBytes(), 'app.apk'),
  rendererModel: () => fileOf(zipBytes(), 'model.zip'),
  defaultAvatarSource: () => fileOf(pngBytes(100, 100), 'a.png'),
};
const KINDS = Object.keys(GOOD) as UploadKind[];

describe('UploadField: limits beside the control', () => {
  it.each(KINDS)('%s shows its types and the limits that meta gives', (kind) => {
    mount(kind);
    const text = document.body.textContent ?? '';
    expect(text).toContain('Accepted:');
    expect(text).toMatch(/Max \d/);
  });

  it('hides the native file box with its own style, so that the form style cannot show it beside the button', () => {
    mount('catalogImage');
    const box = screen.getByTestId('upload-input');
    expect(box.style.display).toBe('none');
  });

  it('writes the numbers from meta, and changes them when meta changes', () => {
    const { unmount } = mount('catalogImage');
    expect(document.body.textContent).toContain('Max 2 MB');
    expect(document.body.textContent).toContain('Up to 36 megapixels');
    unmount();
    setTestInitialState({
      me: {},
      meta: { ...META, catalogImageMaxBytes: 5_242_880, catalogImageMaxPixels: 12_000_000 },
    });
    mount('catalogImage');
    expect(document.body.textContent).toContain('Max 5 MB');
    expect(document.body.textContent).toContain('Up to 12 megapixels');
  });

  it('shows no number when meta is empty', () => {
    setTestInitialState({ me: {}, meta: {} });
    mount('catalogImage');
    expect(document.body.textContent).not.toMatch(/\d/);
    expect(document.body.textContent).toContain('Accepted:');
  });
});

describe('UploadField: a file that breaks a limit is not sent', () => {
  it.each(KINDS)(
    '%s: too many bytes → says which item, the limit and the actual size, no request',
    async (kind) => {
      const limitField = UPLOAD_ENTRIES[kind].maxBytesField;
      setTestInitialState({ me: {}, meta: { ...META, [limitField]: 100 } });
      const { onUploaded } = mount(kind);
      choose(
        fileOf(
          GOOD[kind]().size > 0
            ? new Uint8Array(await GOOD[kind]().arrayBuffer())
            : new Uint8Array(),
          GOOD[kind]().name,
          5000,
        ),
      );
      expect(
        await screen.findByText(/The file is too large: limit 100 B, actual 4\.88 KB/),
      ).toBeInTheDocument();
      expect(xhrs).toHaveLength(0);
      expect(onUploaded).not.toHaveBeenCalled();
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    },
  );

  it.each(['catalogImage', 'adMedia', 'defaultAvatarSource'] as const)(
    '%s: too many pixels is refused with the limit and the actual value',
    async (kind) => {
      const field = UPLOAD_ENTRIES[kind].maxPixelsField as keyof typeof META;
      setTestInitialState({ me: {}, meta: { ...META, [field]: 1_000_000 } });
      mount(kind);
      choose(fileOf(pngBytes(4000, 3000), 'big.png'));
      expect(
        await screen.findByText(
          /The image has too many pixels: limit 1 megapixel.*, actual 12 megapixels/,
        ),
      ).toBeInTheDocument();
      expect(xhrs).toHaveLength(0);
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    },
  );

  it('refuses a declared 65535 x 65535 JPEG without decoding it', async () => {
    mount('catalogImage');
    choose(fileOf(jpegBytes({ width: 65535, height: 65535 }), 'huge.jpg'));
    expect(
      await screen.findByText(/too many pixels: limit 36 megapixels, actual 4,294\.84 megapixels/),
    ).toBeInTheDocument();
    expect(xhrs).toHaveLength(0);
  });

  it.each(KINDS)('%s: an empty file is refused', async (kind) => {
    mount(kind);
    choose(new File([], 'empty.bin'));
    expect(await screen.findByText('The file is empty')).toBeInTheDocument();
    expect(xhrs).toHaveLength(0);
  });

  it.each(KINDS)(
    '%s: a file of the wrong type is refused, by its content and not its name',
    async (kind) => {
      mount(kind);
      const wrong = kind === 'apk' || kind === 'rendererModel' ? pngBytes(1, 1) : zipBytes();
      choose(fileOf(wrong, kind === 'apk' ? 'app.apk' : 'looks-right.png'));
      expect(await screen.findByText(/Wrong file type\. Accepted:/)).toBeInTheDocument();
      expect(xhrs).toHaveLength(0);
    },
  );

  it('refuses an APK whose name does not end in .apk', async () => {
    mount('apk');
    choose(fileOf(zipBytes(), 'app.zip'));
    expect(await screen.findByText(/Wrong file type/)).toBeInTheDocument();
    expect(xhrs).toHaveLength(0);
  });
});

describe('UploadField: with meta empty nothing is checked but the type', () => {
  beforeEach(() => setTestInitialState({ me: {}, meta: {} }));

  it("uploads a large and a high-resolution file as usual, and shows the server's refusal", async () => {
    const { onUploaded } = mount('catalogImage');
    choose(fileOf(pngBytes(20000, 20000), 'huge.png', 3_000_000));
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(400, JSON.stringify(envelope('INVALID_FILE', null, 'too big')));
    expect(
      await screen.findByText('The file is empty, too large, or of an unsupported type.'),
    ).toBeInTheDocument();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});

describe('UploadField: the upload', () => {
  it.each(KINDS)(
    '%s posts to its endpoint with the file under the field "file", and gives the uploadId',
    async (kind) => {
      const { onUploaded } = mount(kind);
      choose(GOOD[kind]());
      await waitFor(() => expect(xhrs).toHaveLength(1));
      expect(xhrs[0].method).toBe('POST');
      expect(xhrs[0].url).toBe(`/api/admin${UPLOAD_ENTRIES[kind].endpoint}`);
      expect(xhrs[0].headers.Authorization).toBe('Bearer tok');
      expect((xhrs[0].body as FormData).get('file')).toBeInstanceOf(File);
      xhrs[0].respond(200, JSON.stringify(envelope('200', { uploadId: 'u-1' })));
      await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ uploadId: 'u-1' }));
    },
  );

  it('is busy while uploading and not after, on success and on failure', async () => {
    const { onBusyChange } = mount('pushImage');
    choose(GOOD.pushImage());
    await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(true));
    xhrs[0].progress(50, 100);
    expect(await screen.findByText('Uploading 50%')).toBeInTheDocument();
    xhrs[0].respond(200, JSON.stringify(envelope('200', { uploadId: 'u' })));
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(onBusyChange.mock.calls.map((c) => c[0])).toEqual([true, false]);

    onBusyChange.mockClear();
    choose(GOOD.pushImage());
    await waitFor(() => expect(xhrs).toHaveLength(2));
    xhrs[1].failNetwork();
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
    expect(onBusyChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it.each([
    [400, 'INVALID_FILE', /empty, too large, or of an unsupported type/],
    [503, 'DEPENDENCY_UNAVAILABLE', /required service or setting is unavailable/],
  ])('shows the text of %s %s', async (status, code, pattern) => {
    const { onUploaded } = mount('adMedia');
    choose(GOOD.adMedia());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(status, JSON.stringify(envelope(code)));
    await waitFor(() =>
      expect(document.querySelector('.ant-alert-error')?.textContent).toMatch(pattern),
    );
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('ignores a second file while one is on its way', async () => {
    mount('pushImage');
    choose(GOOD.pushImage());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    choose(GOOD.pushImage());
    await flush();
    expect(xhrs).toHaveLength(1);
  });

  it('makes the preview only after the check passed, and gives it up when the upload fails', async () => {
    mount('pushImage');
    choose(GOOD.pushImage());
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(document.querySelector('img')).not.toBeNull();
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(400, JSON.stringify(envelope('INVALID_FILE')));
    await waitFor(() => expect(document.querySelector('img')).toBeNull());
  });

  it('works for file names in Thai, Arabic and with emoji', async () => {
    mount('pushImage');
    for (const name of ['ภาพถ่าย.png', 'صورة.png', '😀.png']) {
      choose(fileOf(pngBytes(10, 10), name));
      await waitFor(() => expect(screen.queryByText(new RegExp(name))).toBeNull());
      const last = xhrs[xhrs.length - 1];
      last.respond(200, JSON.stringify(envelope('200', { uploadId: name })));
      expect(await screen.findByText(`Uploaded: ${name}`)).toBeInTheDocument();
    }
  });
});

describe('isUploadIdRejection', () => {
  const error = (httpStatus: number, code: string) =>
    new ApiError({ code, httpStatus, message: '', data: null });
  it('is true for the three answers about a bad uploadId, false for others', () => {
    expect(isUploadIdRejection(error(409, 'INVALID_STATE'))).toBe(true);
    expect(isUploadIdRejection(error(400, 'INVALID_REQUEST'))).toBe(true);
    expect(isUploadIdRejection(error(404, 'RESOURCE_NOT_FOUND'))).toBe(true);
    expect(isUploadIdRejection(error(403, 'ADMIN_FORBIDDEN'))).toBe(false);
    expect(isUploadIdRejection(error(409, 'OTHER'))).toBe(false);
    expect(isUploadIdRejection(new Error('x'))).toBe(false);
    expect(isUploadIdRejection(null)).toBe(false);
  });
});

describe('UploadField: review fixes', () => {
  it('shows no preview for a small file that declares a huge picture, but still uploads it', async () => {
    setTestInitialState({ me: {}, meta: {} });
    mount('pushImage');
    choose(fileOf(pngBytes(20000, 20000), 'huge.png'));
    await waitFor(() => expect(xhrs).toHaveLength(1));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows a preview for a picture whose header says it is small, and none when the size cannot be read', async () => {
    mount('pushImage');
    choose(fileOf(pngBytes(800, 600), 'ok.png'));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(document.querySelector('img')).not.toBeNull();
  });

  it('cancels the upload when the control goes away, and reports nothing afterwards but "not busy"', async () => {
    const { onUploaded, onBusyChange, unmount } = mount('pushImage');
    choose(GOOD.pushImage());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    unmount();
    expect(xhrs[0].aborted).toBe(true);
    await flush();
    expect(onUploaded).not.toHaveBeenCalled();
    expect(onBusyChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it('tells the form to forget the uploadId when another file is chosen, also when that file is refused', async () => {
    const onCleared = vi.fn();
    const { onUploaded } = mount('pushImage', { onCleared });
    choose(GOOD.pushImage());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(200, JSON.stringify(envelope('200', { uploadId: 'u-1' })));
    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith({ uploadId: 'u-1' }));
    expect(onCleared).not.toHaveBeenCalled();
    choose(new File([], 'empty.png'));
    expect(await screen.findByText('The file is empty')).toBeInTheDocument();
    expect(onCleared).toHaveBeenCalledTimes(1);
    choose(new File([], 'empty2.png'));
    await screen.findByText('The file is empty');
    expect(onCleared).toHaveBeenCalledTimes(1); // nothing held any more
  });

  it('calls onStart when a file is chosen, also when that file is refused', async () => {
    const onStart = vi.fn();
    mount('pushImage', { onStart });
    choose(new File([], 'empty.png'));
    await screen.findByText('The file is empty');
    expect(onStart).toHaveBeenCalledTimes(1);
    choose(GOOD.pushImage());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it('lets the page say a failed upload itself: onFailed gets the error, and when it answers true the control does not repeat it', async () => {
    const seen: unknown[] = [];
    const onFailed = vi.fn((error: unknown) => {
      seen.push(error);
      return true;
    });
    mount('adMedia', { onFailed });
    choose(GOOD.adMedia());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(503, JSON.stringify(envelope('DEPENDENCY_UNAVAILABLE')));
    await waitFor(() => expect(onFailed).toHaveBeenCalledTimes(1));
    expect(seen[0]).toBeInstanceOf(ApiError);
    expect((seen[0] as ApiError).code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(document.querySelector('.ant-alert-error')).toBeNull();
  });

  it('says the failure in its own words when onFailed answers false, and adds the reasons of the fields only when asked', async () => {
    const { unmount } = mount('adMedia', { onFailed: () => false });
    choose(GOOD.adMedia());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(
      400,
      JSON.stringify(envelope('INVALID_FILE', { details: [{ ref: 'file', reason: 'TOO_LONG' }] })),
    );
    await waitFor(() =>
      expect(document.querySelector('.ant-alert-error')?.textContent).toMatch(/unsupported type/),
    );
    expect(document.querySelector('.ant-alert-error')?.textContent).not.toMatch(/too long/i);
    unmount();
    xhrs = stubXhr();
    mount('adMedia', { withFieldReasons: true });
    choose(GOOD.adMedia());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(
      400,
      JSON.stringify(envelope('INVALID_FILE', { details: [{ ref: 'file', reason: 'TOO_LONG' }] })),
    );
    await waitFor(() =>
      expect(document.querySelector('.ant-alert-error')?.textContent).toMatch(/too long/i),
    );
  });

  it('makes no preview when showPreview is off, and uploads all the same', async () => {
    mount('pushImage', { showPreview: false });
    choose(GOOD.pushImage());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector('img')).toBeNull();
  });

  it('writes the "images only" note beside the control once, not in the message about one picture', async () => {
    setTestInitialState({ me: {}, meta: { ...META, adImageMaxPixels: 1_000_000 } });
    mount('adMedia');
    expect(document.body.textContent?.match(/images only/g)).toHaveLength(1);
    choose(fileOf(pngBytes(4000, 3000), 'big.png'));
    const alert = await screen.findByText(/too many pixels/);
    expect(alert.textContent).not.toContain('images only');
  });

  it("does not show an upload failure when the form's own handler throws", async () => {
    const onUploaded = vi.fn(() => {
      throw new Error('form bug');
    });
    mount('pushImage', { onUploaded });
    choose(GOOD.pushImage());
    await waitFor(() => expect(xhrs).toHaveLength(1));
    xhrs[0].respond(200, JSON.stringify(envelope('200', { uploadId: 'u' })));
    await waitFor(() => expect(onUploaded).toHaveBeenCalled());
    expect(screen.queryByText('Network error. Check your connection and try again.')).toBeNull();
  });

  it('says so when the chosen file cannot be read at all', async () => {
    mount('pushImage');
    const bad = new File([new Uint8Array(10)], 'x.png');
    Object.defineProperty(bad, 'slice', {
      value: () => {
        throw new Error('unreadable');
      },
    });
    choose(bad);
    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument();
    expect(xhrs).toHaveLength(0);
  });
});

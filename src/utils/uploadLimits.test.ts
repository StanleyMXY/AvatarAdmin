import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileOf, jpegBytes, mp4Bytes, pngBytes, zipBytes } from '../../tests/imageBytes';
import {
  checkUploadFile,
  describeUploadLimits,
  UPLOAD_ENTRIES,
  type UploadKind,
  type UploadLimitMeta,
} from './uploadLimits';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('UPLOAD_ENTRIES', () => {
  it('has exactly the six upload entries of the plan', () => {
    expect(Object.keys(UPLOAD_ENTRIES).sort()).toEqual(
      [
        'adMedia',
        'apk',
        'catalogImage',
        'defaultAvatarSource',
        'pushImage',
        'rendererModel',
      ].sort(),
    );
  });

  it('maps each entry to its endpoint, accepted types and meta fields', () => {
    expect(UPLOAD_ENTRIES.pushImage).toMatchObject({
      endpoint: '/uploads/image',
      accept: ['JPEG', 'PNG'],
      maxBytesField: 'pushImageMaxBytes',
    });
    expect(UPLOAD_ENTRIES.pushImage.maxPixelsField).toBeUndefined();
    expect(UPLOAD_ENTRIES.catalogImage).toMatchObject({
      endpoint: '/uploads/catalog-image',
      accept: ['JPEG', 'PNG'],
      maxBytesField: 'catalogImageMaxBytes',
      maxPixelsField: 'catalogImageMaxPixels',
    });
    expect(UPLOAD_ENTRIES.adMedia).toMatchObject({
      endpoint: '/ads/media',
      accept: ['JPEG', 'PNG', 'MP4'],
      maxBytesField: 'adMediaMaxBytes',
      maxPixelsField: 'adImageMaxPixels',
    });
    expect(UPLOAD_ENTRIES.apk).toMatchObject({
      endpoint: '/uploads/apk',
      accept: ['ZIP'],
      extensions: ['.apk'],
      maxBytesField: 'apkMaxBytes',
    });
    expect(UPLOAD_ENTRIES.rendererModel).toMatchObject({
      endpoint: '/uploads/renderer-model',
      accept: ['ZIP'],
      extensions: ['.zip'],
      maxBytesField: 'renderAssetMaxBytes',
    });
    expect(UPLOAD_ENTRIES.defaultAvatarSource).toMatchObject({
      endpoint: '/uploads/default-avatar-source',
      accept: ['JPEG', 'PNG'],
      maxBytesField: 'uploadMaxBytes',
      maxPixelsField: 'defaultAvatarSourceMaxPixels',
    });
  });
});

describe('checkUploadFile: size boundaries for each of the six entries', () => {
  const cases: {
    kind: UploadKind;
    name: string;
    bytes: () => Uint8Array;
    field: keyof UploadLimitMeta;
  }[] = [
    { kind: 'pushImage', name: 'a.png', bytes: () => pngBytes(10, 10), field: 'pushImageMaxBytes' },
    {
      kind: 'catalogImage',
      name: 'a.jpg',
      bytes: () => jpegBytes({ width: 10, height: 10 }),
      field: 'catalogImageMaxBytes',
    },
    { kind: 'adMedia', name: 'a.mp4', bytes: () => mp4Bytes(), field: 'adMediaMaxBytes' },
    { kind: 'apk', name: 'app.apk', bytes: () => zipBytes(), field: 'apkMaxBytes' },
    {
      kind: 'rendererModel',
      name: 'model.zip',
      bytes: () => zipBytes(),
      field: 'renderAssetMaxBytes',
    },
    {
      kind: 'defaultAvatarSource',
      name: 'a.png',
      bytes: () => pngBytes(10, 10),
      field: 'uploadMaxBytes',
    },
  ];

  it.each(cases)(
    '$kind: exactly the limit passes, one byte more is TOO_LARGE',
    async ({ kind, name, bytes, field }) => {
      const limit = 2000;
      const meta: Partial<UploadLimitMeta> = { [field]: limit };
      expect(await checkUploadFile(kind, fileOf(bytes(), name, limit), meta)).toEqual({ ok: true });
      expect(await checkUploadFile(kind, fileOf(bytes(), name, limit + 1), meta)).toEqual({
        ok: false,
        problem: 'TOO_LARGE',
        limit,
        actual: limit + 1,
      });
    },
  );

  it.each(cases)('$kind: a 0-byte file is EMPTY', async ({ kind, name }) => {
    expect(await checkUploadFile(kind, fileOf(new Uint8Array(0), name), {})).toEqual({
      ok: false,
      problem: 'EMPTY',
    });
  });
});

describe('checkUploadFile: pixel boundaries', () => {
  const pixelCases: { kind: UploadKind; field: keyof UploadLimitMeta; name: string }[] = [
    { kind: 'catalogImage', field: 'catalogImageMaxPixels', name: 'a.png' },
    { kind: 'adMedia', field: 'adImageMaxPixels', name: 'a.png' },
    { kind: 'defaultAvatarSource', field: 'defaultAvatarSourceMaxPixels', name: 'a.png' },
  ];

  it.each(pixelCases)(
    '$kind: width x height equal to the limit passes, one pixel more is TOO_MANY_PIXELS',
    async ({ kind, field, name }) => {
      const meta: Partial<UploadLimitMeta> = { [field]: 6000 };
      expect(await checkUploadFile(kind, fileOf(pngBytes(100, 60), name), meta)).toEqual({
        ok: true,
      });
      expect(await checkUploadFile(kind, fileOf(pngBytes(100, 61), name), meta)).toEqual({
        ok: false,
        problem: 'TOO_MANY_PIXELS',
        limit: 6000,
        actual: 6100,
      });
    },
  );

  it('checks JPEG dimensions the same way', async () => {
    const meta: Partial<UploadLimitMeta> = { catalogImageMaxPixels: 6000 };
    expect(
      await checkUploadFile(
        'catalogImage',
        fileOf(jpegBytes({ width: 60, height: 100 }), 'a.jpg'),
        meta,
      ),
    ).toEqual({ ok: true });
    const over = await checkUploadFile(
      'catalogImage',
      fileOf(jpegBytes({ width: 61, height: 100 }), 'a.jpg'),
      meta,
    );
    expect(over).toMatchObject({
      ok: false,
      problem: 'TOO_MANY_PIXELS',
      limit: 6000,
      actual: 6100,
    });
  });

  it('stays right for sizes whose product is far beyond 2^53', async () => {
    const meta: Partial<UploadLimitMeta> = { defaultAvatarSourceMaxPixels: 250000000 };
    const huge = await checkUploadFile(
      'defaultAvatarSource',
      fileOf(pngBytes(4294967295, 4294967295), 'a.png'),
      meta,
    );
    expect(huge).toMatchObject({ ok: false, problem: 'TOO_MANY_PIXELS', limit: 250000000 });
    const justOver = await checkUploadFile(
      'defaultAvatarSource',
      fileOf(pngBytes(94906267, 94906267), 'a.png'),
      {
        defaultAvatarSourceMaxPixels: Number.MAX_SAFE_INTEGER,
      },
    );
    expect(justOver).toMatchObject({
      ok: false,
      problem: 'TOO_MANY_PIXELS',
      limit: Number.MAX_SAFE_INTEGER,
    });
  });

  it('does not run the pixel check on an MP4 in the ad media entry', async () => {
    const meta: Partial<UploadLimitMeta> = { adImageMaxPixels: 1 };
    expect(await checkUploadFile('adMedia', fileOf(mp4Bytes(), 'a.mp4'), meta)).toEqual({
      ok: true,
    });
  });

  it('does not run a pixel check where the entry has none (push image)', async () => {
    const meta: Partial<UploadLimitMeta> = { pushImageMaxBytes: 1000, catalogImageMaxPixels: 1 };
    expect(await checkUploadFile('pushImage', fileOf(pngBytes(5000, 5000), 'a.png'), meta)).toEqual(
      { ok: true },
    );
  });

  it('never decodes the image to count pixels', async () => {
    const fail = () => {
      throw new Error('decode');
    };
    vi.stubGlobal('Image', fail);
    vi.stubGlobal('createImageBitmap', fail);
    const result = await checkUploadFile(
      'catalogImage',
      fileOf(pngBytes(60000, 60000), 'bomb.png', 100),
      {
        catalogImageMaxPixels: 36000000,
      },
    );
    expect(result).toMatchObject({
      ok: false,
      problem: 'TOO_MANY_PIXELS',
      limit: 36000000,
      actual: 3600000000,
    });
  });
});

describe('checkUploadFile: type', () => {
  it('accepts the types of each entry and rejects the others', async () => {
    const png = fileOf(pngBytes(10, 10), 'a.png');
    const jpg = fileOf(jpegBytes({ width: 10, height: 10 }), 'a.jpg');
    const mp4 = fileOf(mp4Bytes(), 'a.mp4');
    expect(await checkUploadFile('pushImage', png, {})).toEqual({ ok: true });
    expect(await checkUploadFile('pushImage', jpg, {})).toEqual({ ok: true });
    expect(await checkUploadFile('pushImage', mp4, {})).toEqual({
      ok: false,
      problem: 'WRONG_TYPE',
    });
    expect(await checkUploadFile('catalogImage', mp4, {})).toEqual({
      ok: false,
      problem: 'WRONG_TYPE',
    });
    expect(await checkUploadFile('adMedia', mp4, {})).toEqual({ ok: true });
    expect(await checkUploadFile('adMedia', png, {})).toEqual({ ok: true });
  });

  it('goes by the file header, not by the name: a text file called .png is wrong', async () => {
    const fake = fileOf(new TextEncoder().encode('this is not an image at all'), 'photo.png');
    expect(await checkUploadFile('pushImage', fake, {})).toEqual({
      ok: false,
      problem: 'WRONG_TYPE',
    });
  });

  it('an APK is a ZIP with the .apk extension: a .zip file in the APK entry is wrong', async () => {
    expect(await checkUploadFile('apk', fileOf(zipBytes(), 'app.apk'), {})).toEqual({ ok: true });
    expect(await checkUploadFile('apk', fileOf(zipBytes(), 'APP.APK'), {})).toEqual({ ok: true });
    expect(await checkUploadFile('apk', fileOf(zipBytes(), 'model.zip'), {})).toEqual({
      ok: false,
      problem: 'WRONG_TYPE',
    });
  });

  it('a renderer model must be a ZIP named .zip: an .apk file there is wrong', async () => {
    expect(await checkUploadFile('rendererModel', fileOf(zipBytes(), 'model.zip'), {})).toEqual({
      ok: true,
    });
    expect(await checkUploadFile('rendererModel', fileOf(zipBytes(), 'app.apk'), {})).toEqual({
      ok: false,
      problem: 'WRONG_TYPE',
    });
  });

  it('a right extension on the wrong content is still wrong', async () => {
    expect(await checkUploadFile('apk', fileOf(pngBytes(1, 1), 'app.apk'), {})).toEqual({
      ok: false,
      problem: 'WRONG_TYPE',
    });
    expect(await checkUploadFile('rendererModel', fileOf(mp4Bytes(), 'model.zip'), {})).toEqual({
      ok: false,
      problem: 'WRONG_TYPE',
    });
  });

  it('takes a Thai, Arabic or emoji file name in its stride', async () => {
    expect(await checkUploadFile('apk', fileOf(zipBytes(), 'แอป.apk'), {})).toEqual({ ok: true });
    expect(await checkUploadFile('rendererModel', fileOf(zipBytes(), 'نموذج 😀.zip'), {})).toEqual({
      ok: true,
    });
  });
});

describe('checkUploadFile: order of the checks', () => {
  it('reports EMPTY before WRONG_TYPE, WRONG_TYPE before TOO_LARGE, TOO_LARGE before TOO_MANY_PIXELS', async () => {
    const meta: Partial<UploadLimitMeta> = { catalogImageMaxBytes: 50, catalogImageMaxPixels: 1 };
    expect(
      await checkUploadFile('catalogImage', fileOf(new Uint8Array(0), 'a.png'), meta),
    ).toMatchObject({ problem: 'EMPTY' });
    expect(
      await checkUploadFile('catalogImage', fileOf(mp4Bytes(), 'a.mp4', 500), meta),
    ).toMatchObject({ problem: 'WRONG_TYPE' });
    expect(
      await checkUploadFile('catalogImage', fileOf(pngBytes(10, 10), 'a.png', 500), meta),
    ).toMatchObject({ problem: 'TOO_LARGE' });
    expect(
      await checkUploadFile('catalogImage', fileOf(pngBytes(10, 10), 'a.png'), {
        ...meta,
        catalogImageMaxBytes: 500,
      }),
    ).toMatchObject({ problem: 'TOO_MANY_PIXELS' });
  });
});

describe('checkUploadFile: limits that are missing', () => {
  it('skips only the pixel check when catalogImageMaxPixels is missing; the size check still runs', async () => {
    const big = fileOf(pngBytes(60000, 60000), 'a.png', 500);
    expect(await checkUploadFile('catalogImage', big, { catalogImageMaxBytes: 1000 })).toEqual({
      ok: true,
    });
    expect(await checkUploadFile('catalogImage', big, { catalogImageMaxBytes: 100 })).toMatchObject(
      { problem: 'TOO_LARGE' },
    );
  });

  it('skips the size check when pushImageMaxBytes is null', async () => {
    const big = fileOf(pngBytes(10, 10), 'a.png', 5 * 1024 * 1024);
    expect(await checkUploadFile('pushImage', big, { pushImageMaxBytes: null })).toEqual({
      ok: true,
    });
    expect(await checkUploadFile('pushImage', big, {})).toEqual({ ok: true });
  });

  it('skips a limit that is null, not a number or negative, rather than failing every file', async () => {
    const file = fileOf(zipBytes(), 'app.apk', 100);
    expect(await checkUploadFile('apk', file, { apkMaxBytes: Number.NaN })).toEqual({ ok: true });
  });

  it('skips the pixel check when the header cannot be read, leaving it to the server', async () => {
    const truncated = fileOf(pngBytes(10, 10).slice(0, 14), 'a.png');
    expect(await checkUploadFile('catalogImage', truncated, { catalogImageMaxPixels: 1 })).toEqual({
      ok: true,
    });
  });
});

describe('describeUploadLimits', () => {
  const meta: Partial<UploadLimitMeta> = {
    catalogImageMaxBytes: 2097152,
    catalogImageMaxPixels: 36000000,
    adMediaMaxBytes: 52428800,
    adImageMaxPixels: 36000000,
    apkMaxBytes: 104857600,
    renderAssetMaxBytes: 104857600,
    pushImageMaxBytes: 1048576,
    uploadMaxBytes: 209715200,
    defaultAvatarSourceMaxPixels: 250000000,
  };

  it('describes the catalog image in both interface languages', () => {
    expect(describeUploadLimits('catalogImage', meta, 'zh-CN')).toEqual({
      types: 'JPEG / PNG',
      maxBytes: '2 MB',
      maxPixels: '36 百万像素',
    });
    const en = describeUploadLimits('catalogImage', meta, 'en-US');
    expect(en.types).toBe('JPEG / PNG');
    expect(en.maxBytes).toBe('2 MB');
    expect(en.maxPixels).toBe('36 megapixels');
  });

  it('notes in both languages that the ad media pixel limit applies to images only', () => {
    const zh = describeUploadLimits('adMedia', meta, 'zh-CN');
    expect(zh.types).toBe('JPEG / PNG / MP4');
    expect(zh.maxBytes).toBe('50 MB');
    expect(zh.maxPixels).toContain('36 百万像素');
    expect(zh.maxPixels).toContain('只对图片');
    const en = describeUploadLimits('adMedia', meta, 'en-US');
    expect(en.maxPixels).toContain('36 megapixels');
    expect(en.maxPixels?.toLowerCase()).toContain('images only');
  });

  it('names the file types of APK and renderer model entries', () => {
    expect(describeUploadLimits('apk', meta, 'en-US')).toEqual({
      types: 'APK',
      maxBytes: '100 MB',
    });
    expect(describeUploadLimits('rendererModel', meta, 'en-US')).toEqual({
      types: 'ZIP',
      maxBytes: '100 MB',
    });
  });

  it('describes the push image and the default avatar source', () => {
    expect(describeUploadLimits('pushImage', meta, 'en-US')).toEqual({
      types: 'JPEG / PNG',
      maxBytes: '1 MB',
    });
    expect(describeUploadLimits('defaultAvatarSource', meta, 'en-US')).toEqual({
      types: 'JPEG / PNG',
      maxBytes: '200 MB',
      maxPixels: '250 megapixels',
    });
  });

  it('leaves out what is missing or null', () => {
    expect(describeUploadLimits('catalogImage', {}, 'en-US')).toEqual({ types: 'JPEG / PNG' });
    expect(describeUploadLimits('pushImage', { pushImageMaxBytes: null }, 'zh-CN')).toEqual({
      types: 'JPEG / PNG',
    });
    const noPixels = describeUploadLimits(
      'catalogImage',
      { catalogImageMaxBytes: 2097152 },
      'en-US',
    );
    expect('maxPixels' in noPixels).toBe(false);
  });

  it('formats fractions of a megapixel and of a megabyte', () => {
    expect(
      describeUploadLimits('catalogImage', { catalogImageMaxPixels: 2500000 }, 'en-US').maxPixels,
    ).toBe('2.5 megapixels');
    expect(
      describeUploadLimits('catalogImage', { catalogImageMaxBytes: 1572864 }, 'en-US').maxBytes,
    ).toBe('1.5 MB');
  });
});

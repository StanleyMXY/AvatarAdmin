import { formatBytes } from './format';
import { type FileKind, readImageSize, sniffFileKind } from './imageHeader';

/** The limits `GET /api/admin/meta` reports for the upload entries (task 7 includes this in `AdminMeta`). */
export type UploadLimitMeta = {
  pushImageMaxBytes: number | null;
  uploadMaxBytes: number;
  adMediaMaxBytes: number;
  apkMaxBytes: number;
  renderAssetMaxBytes: number;
  catalogImageMaxBytes: number;
  catalogImageMaxPixels: number;
  adImageMaxPixels: number;
  defaultAvatarSourceMaxPixels: number;
};

export type UploadKind =
  | 'pushImage'
  | 'catalogImage'
  | 'adMedia'
  | 'apk'
  | 'rendererModel'
  | 'defaultAvatarSource';

export type UploadEntry = {
  endpoint: string;
  accept: readonly FileKind[];
  /** Required file name extensions (lower case), on top of the file header, for entries that take ZIP. */
  extensions?: readonly string[];
  maxBytesField: keyof UploadLimitMeta;
  maxPixelsField?: keyof UploadLimitMeta;
};

export const UPLOAD_ENTRIES: Record<UploadKind, UploadEntry> = {
  pushImage: {
    endpoint: '/uploads/image',
    accept: ['JPEG', 'PNG'],
    maxBytesField: 'pushImageMaxBytes',
  },
  catalogImage: {
    endpoint: '/uploads/catalog-image',
    accept: ['JPEG', 'PNG'],
    maxBytesField: 'catalogImageMaxBytes',
    maxPixelsField: 'catalogImageMaxPixels',
  },
  adMedia: {
    endpoint: '/ads/media',
    accept: ['JPEG', 'PNG', 'MP4'],
    maxBytesField: 'adMediaMaxBytes',
    maxPixelsField: 'adImageMaxPixels',
  },
  apk: {
    endpoint: '/uploads/apk',
    accept: ['ZIP'],
    extensions: ['.apk'],
    maxBytesField: 'apkMaxBytes',
  },
  rendererModel: {
    endpoint: '/uploads/renderer-model',
    accept: ['ZIP'],
    extensions: ['.zip'],
    maxBytesField: 'renderAssetMaxBytes',
  },
  defaultAvatarSource: {
    endpoint: '/uploads/default-avatar-source',
    accept: ['JPEG', 'PNG'],
    maxBytesField: 'uploadMaxBytes',
    maxPixelsField: 'defaultAvatarSourceMaxPixels',
  },
};

export type UploadCheck =
  | { ok: true }
  | {
      ok: false;
      problem: 'EMPTY' | 'WRONG_TYPE' | 'TOO_LARGE' | 'TOO_MANY_PIXELS';
      limit?: number;
      actual?: number;
    };

/** A limit from `meta` that can be checked against; missing, `null`, negative or non-integer values are skipped. */
function usableLimit(meta: Partial<UploadLimitMeta>, field: keyof UploadLimitMeta): number | null {
  const value = meta[field];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

const hasExtension = (name: string, extensions: readonly string[]) => {
  const lower = name.toLowerCase();
  return extensions.some((extension) => lower.endsWith(extension));
};

/**
 * Checks a chosen file before it is uploaded, in this order: empty, type (file header, plus the
 * extension for ZIP entries), size, pixels (images only). A limit that `meta` does not have is not
 * checked; the server remains the final check. The image is not decoded.
 */
export async function checkUploadFile(
  kind: UploadKind,
  file: File,
  meta: Partial<UploadLimitMeta>,
): Promise<UploadCheck> {
  const entry = UPLOAD_ENTRIES[kind];
  if (file.size === 0) return { ok: false, problem: 'EMPTY' };

  const sniffed = await sniffFileKind(file);
  if (sniffed === null || !entry.accept.includes(sniffed))
    return { ok: false, problem: 'WRONG_TYPE' };
  if (entry.extensions && !hasExtension(file.name, entry.extensions)) {
    return { ok: false, problem: 'WRONG_TYPE' };
  }

  const maxBytes = usableLimit(meta, entry.maxBytesField);
  if (maxBytes !== null && file.size > maxBytes) {
    return { ok: false, problem: 'TOO_LARGE', limit: maxBytes, actual: file.size };
  }

  const isImage = sniffed === 'PNG' || sniffed === 'JPEG';
  const maxPixels = entry.maxPixelsField ? usableLimit(meta, entry.maxPixelsField) : null;
  if (isImage && maxPixels !== null) {
    const size = await readImageSize(file);
    if (size) {
      // BigInt: a PNG can declare 4294967295 x 4294967295, beyond 2^53.
      const pixels = BigInt(size.width) * BigInt(size.height);
      if (pixels > BigInt(maxPixels)) {
        return { ok: false, problem: 'TOO_MANY_PIXELS', limit: maxPixels, actual: Number(pixels) };
      }
    }
  }
  return { ok: true };
}

type PixelWords = { one: string; other: string; imagesOnly: string };

const PIXEL_WORDS: { zh: PixelWords; en: PixelWords } = {
  zh: { one: '百万像素', other: '百万像素', imagesOnly: '（只对图片）' },
  en: { one: 'megapixel', other: 'megapixels', imagesOnly: ' (images only)' },
};

/** The limits of an entry as text to show beside the file control; anything `meta` lacks is left out. */
export function describeUploadLimits(
  kind: UploadKind,
  meta: Partial<UploadLimitMeta>,
  locale: string,
): { types: string; maxBytes?: string; maxPixels?: string } {
  const entry = UPLOAD_ENTRIES[kind];
  const types = entry.extensions
    ? entry.extensions.map((extension) => extension.replace('.', '').toUpperCase()).join(' / ')
    : entry.accept.join(' / ');
  const result: { types: string; maxBytes?: string; maxPixels?: string } = { types };

  const maxBytes = usableLimit(meta, entry.maxBytesField);
  if (maxBytes !== null) result.maxBytes = formatBytes(maxBytes, locale);

  const maxPixels = entry.maxPixelsField ? usableLimit(meta, entry.maxPixelsField) : null;
  if (maxPixels !== null) {
    const words = locale.toLowerCase().startsWith('zh') ? PIXEL_WORDS.zh : PIXEL_WORDS.en;
    const megapixels = maxPixels / 1_000_000;
    const unit = megapixels === 1 ? words.one : words.other;
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(megapixels);
    const imagesOnly = entry.accept.some((k) => k !== 'JPEG' && k !== 'PNG')
      ? words.imagesOnly
      : '';
    result.maxPixels = `${number} ${unit}${imagesOnly}`;
  }
  return result;
}

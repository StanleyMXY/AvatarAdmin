// Reads image sizes and file kinds from the first bytes of a file with Blob.slice only. The
// image is never decoded: a small file can declare tens of thousands of pixels per side, and
// decoding it in the browser would freeze the tab.

export type ImageSize = { format: 'PNG' | 'JPEG'; width: number; height: number };
export type FileKind = 'PNG' | 'JPEG' | 'MP4' | 'ZIP';

const MAX_SCAN_BYTES = 4 * 1024 * 1024;
const CHUNK_BYTES = 64 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SNIFF_BYTES = 12;
const PNG_HEADER_BYTES = 24;

async function readRange(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  bytes.length >= at + signature.length && signature.every((b, i) => bytes[at + i] === b);

const isPng = (bytes: Uint8Array) => startsWith(bytes, PNG_SIGNATURE);
const isJpeg = (bytes: Uint8Array) => startsWith(bytes, [0xff, 0xd8, 0xff]);
const isZip = (bytes: Uint8Array) => startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]);
const isMp4 = (bytes: Uint8Array) => startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4);

/** What the first 12 bytes say the file is, whatever its name or declared type. */
export async function sniffFileKind(file: Blob): Promise<FileKind | null> {
  const head = await readRange(file, 0, SNIFF_BYTES);
  if (isPng(head)) return 'PNG';
  if (isJpeg(head)) return 'JPEG';
  if (isMp4(head)) return 'MP4';
  if (isZip(head)) return 'ZIP';
  return null;
}

/**
 * Width and height of a PNG (from the IHDR chunk) or a JPEG (from the start-of-frame segment,
 * found by walking the segments, within the first 4 MiB). `null` when the file is neither or the
 * header cannot be found or is nonsensical.
 */
export async function readImageSize(file: Blob): Promise<ImageSize | null> {
  const head = await readRange(file, 0, PNG_HEADER_BYTES);
  if (isPng(head)) return readPng(head);
  if (isJpeg(head)) return readJpeg(file, head);
  return null;
}

function readPng(head: Uint8Array): ImageSize | null {
  if (head.length < PNG_HEADER_BYTES) return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const isHeaderChunk = view.getUint32(8) === 13 && startsWith(head, [0x49, 0x48, 0x44, 0x52], 12);
  if (!isHeaderChunk) return null;
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { format: 'PNG', width, height } : null;
}

/** Sequential reader over a file: fetches each byte at most once and never past MAX_SCAN_BYTES. */
class ForwardReader {
  private start = 0;
  private bytes: Uint8Array;
  private readonly cap: number;

  constructor(
    private readonly blob: Blob,
    initial: Uint8Array,
  ) {
    this.bytes = initial;
    this.cap = Math.min(blob.size, MAX_SCAN_BYTES);
  }

  /** Makes bytes [offset, offset + length) available; false when they lie beyond the file or the scan limit. */
  async ensure(offset: number, length: number): Promise<boolean> {
    const end = offset + length;
    if (end > this.cap) return false;
    const have = this.start + this.bytes.length;
    if (offset >= this.start && end <= have) return true;
    const keep =
      offset >= this.start && offset < have
        ? this.bytes.subarray(offset - this.start)
        : new Uint8Array(0);
    const fetchFrom = keep.length > 0 ? have : offset;
    const fetchTo = Math.min(this.cap, Math.max(end, fetchFrom + CHUNK_BYTES));
    const fresh = await readRange(this.blob, fetchFrom, fetchTo);
    const merged = new Uint8Array(keep.length + fresh.length);
    merged.set(keep, 0);
    merged.set(fresh, keep.length);
    this.start = offset;
    this.bytes = merged;
    return merged.length >= length;
  }

  at(offset: number): number {
    return this.bytes[offset - this.start];
  }

  u16(offset: number): number {
    return (this.at(offset) << 8) | this.at(offset + 1);
  }
}

const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

async function readJpeg(file: Blob, head: Uint8Array): Promise<ImageSize | null> {
  const reader = new ForwardReader(file, head);
  let pos = 2;
  for (;;) {
    // A segment starts with 0xFF and a marker byte; any number of 0xFF fill bytes may come first.
    if (!(await reader.ensure(pos, 1)) || reader.at(pos) !== 0xff) return null;
    let markerAt = pos + 1;
    for (;;) {
      if (!(await reader.ensure(markerAt, 1))) return null;
      if (reader.at(markerAt) !== 0xff) break;
      markerAt++;
    }
    const marker = reader.at(markerAt);
    pos = markerAt + 1;
    if (marker === 0x00) return null;
    // Markers without a length: TEM, RSTn, SOI.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    // End of image, or start of scan before any frame header: there is no size to find.
    if (marker === 0xd9 || marker === 0xda) return null;
    if (!(await reader.ensure(pos, 2))) return null;
    const length = reader.u16(pos);
    if (length < 2) return null;
    if (isStartOfFrame(marker)) {
      // length, precision (1), height (2), width (2)
      if (length < 7 || !(await reader.ensure(pos, 7))) return null;
      const height = reader.u16(pos + 3);
      const width = reader.u16(pos + 5);
      return width > 0 && height > 0 ? { format: 'JPEG', width, height } : null;
    }
    pos += length;
  }
}

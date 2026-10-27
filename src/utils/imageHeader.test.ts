import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fileOf,
  jpegBytes,
  jpegSegment,
  mp4Bytes,
  pngBytes,
  zipBytes,
} from '../../tests/imageBytes';
import { readImageSize, sniffFileKind } from './imageHeader';

const MIB = 1024 * 1024;

/** Records every Blob.slice call on `blob` and returns the total number of bytes asked for. */
function recordSlices(blob: Blob): () => number {
  const original = blob.slice.bind(blob);
  let total = 0;
  vi.spyOn(blob, 'slice').mockImplementation((start?: number, end?: number, type?: string) => {
    const from = Math.max(0, start ?? 0);
    const to = Math.min(blob.size, end ?? blob.size);
    total += Math.max(0, to - from);
    return original(start, end, type);
  });
  return () => total;
}

function forbidDecoding() {
  const fail = () => {
    throw new Error('the browser must not decode the image');
  };
  vi.stubGlobal('Image', fail);
  vi.stubGlobal('createImageBitmap', fail);
  vi.stubGlobal('OffscreenCanvas', fail);
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((
    tag: string,
    options?: ElementCreationOptions,
  ) => {
    if (tag.toLowerCase() === 'canvas' || tag.toLowerCase() === 'img') fail();
    return create(tag, options);
  }) as typeof document.createElement);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('readImageSize: PNG', () => {
  it('reads width and height from the IHDR chunk', async () => {
    const file = fileOf(pngBytes(3000, 2000), 'a.png');
    expect(await readImageSize(file)).toEqual({ format: 'PNG', width: 3000, height: 2000 });
  });

  it('reads the full 32-bit range', async () => {
    const file = fileOf(pngBytes(4294967295, 4294967295), 'a.png');
    expect(await readImageSize(file)).toEqual({
      format: 'PNG',
      width: 4294967295,
      height: 4294967295,
    });
  });

  it('reads a roughly 100-byte file that declares 60000 x 60000 at once, without decoding it', async () => {
    forbidDecoding();
    const bytes = pngBytes(60000, 60000);
    expect(bytes.length).toBeLessThan(110);
    const file = fileOf(bytes, 'bomb.png', 100);
    const asked = recordSlices(file);
    expect(await readImageSize(file)).toEqual({ format: 'PNG', width: 60000, height: 60000 });
    expect(asked()).toBeLessThanOrEqual(64);
  });

  it('reads only the start of a large PNG', async () => {
    const file = fileOf(pngBytes(10, 10), 'big.png', 5 * MIB);
    const asked = recordSlices(file);
    expect(await readImageSize(file)).toEqual({ format: 'PNG', width: 10, height: 10 });
    expect(asked()).toBeLessThanOrEqual(64);
  });

  it('gives null for a truncated PNG, a wrong chunk type, and zero sizes', async () => {
    expect(await readImageSize(fileOf(pngBytes(5, 5).slice(0, 20), 'a.png'))).toBeNull();
    const wrongChunk = pngBytes(5, 5);
    wrongChunk[12] = 0x58;
    expect(await readImageSize(fileOf(wrongChunk, 'a.png'))).toBeNull();
    expect(await readImageSize(fileOf(pngBytes(0, 5), 'a.png'))).toBeNull();
    expect(await readImageSize(fileOf(pngBytes(5, 0), 'a.png'))).toBeNull();
  });
});

describe('readImageSize: JPEG', () => {
  it('reads a baseline JPEG (SOF0)', async () => {
    const file = fileOf(jpegBytes({ width: 4032, height: 3024 }), 'a.jpg');
    expect(await readImageSize(file)).toEqual({ format: 'JPEG', width: 4032, height: 3024 });
  });

  it('reads a progressive JPEG (SOF2)', async () => {
    const file = fileOf(jpegBytes({ width: 1920, height: 1080, sof: 0xc2 }), 'a.jpg');
    expect(await readImageSize(file)).toEqual({ format: 'JPEG', width: 1920, height: 1080 });
  });

  it('reads the other start-of-frame markers too', async () => {
    for (const sof of [0xc1, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]) {
      const file = fileOf(jpegBytes({ width: 640, height: 480, sof }), 'a.jpg');
      expect(await readImageSize(file)).toEqual({ format: 'JPEG', width: 640, height: 480 });
    }
  });

  it('skips APP1 segments totalling 70 KB, reading across chunk boundaries', async () => {
    // One segment holds at most 65535 bytes, so 70 KB of EXIF is several APP1 and APPn segments.
    const before = [jpegSegment(0xe1, 40000), jpegSegment(0xe1, 31000), jpegSegment(0xe2, 1000)];
    const file = fileOf(jpegBytes({ width: 6000, height: 4000, before }), 'exif.jpg');
    expect(file.size).toBeGreaterThan(70 * 1024);
    const asked = recordSlices(file);
    expect(await readImageSize(file)).toEqual({ format: 'JPEG', width: 6000, height: 4000 });
    expect(asked()).toBeLessThanOrEqual(4 * MIB);
  });

  it('skips a DHT segment (0xC4) and does not mistake it for a frame header', async () => {
    const dht = jpegSegment(0xc4, 30);
    const dqt = jpegSegment(0xdb, 65);
    const file = fileOf(jpegBytes({ width: 800, height: 600, before: [dqt, dht] }), 'a.jpg');
    expect(await readImageSize(file)).toEqual({ format: 'JPEG', width: 800, height: 600 });
  });

  it('does not take the JPEG-extension (0xC8) or arithmetic-conditioning (0xCC) markers for a frame', async () => {
    const before = [jpegSegment(0xc8, 4), jpegSegment(0xcc, 4)];
    const file = fileOf(jpegBytes({ width: 321, height: 123, before }), 'a.jpg');
    expect(await readImageSize(file)).toEqual({ format: 'JPEG', width: 321, height: 123 });
  });

  it('copes with fill bytes (0xFF) before a marker', async () => {
    const withFill = Uint8Array.from([
      0xff,
      0xd8,
      0xff,
      0xff,
      0xff,
      ...jpegSegment(0xe0, 14),
      ...jpegBytes({ width: 50, height: 60 }).slice(2),
    ]);
    expect(await readImageSize(fileOf(withFill, 'a.jpg'))).toEqual({
      format: 'JPEG',
      width: 50,
      height: 60,
    });
  });

  it('gives null when a scan starts before any frame header, or the file is cut off', async () => {
    const noFrame = Uint8Array.from([
      0xff,
      0xd8,
      ...jpegSegment(0xe0, 14),
      0xff,
      0xda,
      0,
      8,
      1,
      1,
      0,
      0,
      0x3f,
      0,
    ]);
    expect(await readImageSize(fileOf(noFrame, 'a.jpg'))).toBeNull();
    const whole = jpegBytes({ width: 100, height: 100 });
    expect(await readImageSize(fileOf(whole.slice(0, 9), 'a.jpg'))).toBeNull();
    expect(await readImageSize(fileOf(Uint8Array.from([0xff, 0xd8]), 'a.jpg'))).toBeNull();
  });

  it('gives up after 4 MiB without ever asking for more', async () => {
    // Endless APP segments: the frame header would only come after 5 MiB.
    const before: number[][] = [];
    for (let i = 0; i < 90; i++) before.push(jpegSegment(0xe1, 60000));
    const file = fileOf(jpegBytes({ width: 100, height: 100, before }), 'long.jpg');
    expect(file.size).toBeGreaterThan(4 * MIB);
    const asked = recordSlices(file);
    expect(await readImageSize(file)).toBeNull();
    expect(asked()).toBeLessThanOrEqual(4 * MIB);
  });

  it('gives null for a zero width or height', async () => {
    expect(await readImageSize(fileOf(jpegBytes({ width: 0, height: 10 }), 'a.jpg'))).toBeNull();
    expect(await readImageSize(fileOf(jpegBytes({ width: 10, height: 0 }), 'a.jpg'))).toBeNull();
  });

  it('never decodes: Image, createImageBitmap and canvas are not touched', async () => {
    forbidDecoding();
    expect(
      await readImageSize(fileOf(jpegBytes({ width: 60000, height: 60000 }), 'a.jpg')),
    ).toEqual({
      format: 'JPEG',
      width: 60000,
      height: 60000,
    });
  });
});

describe('readImageSize: other files', () => {
  it('gives null for files that are not PNG or JPEG', async () => {
    expect(await readImageSize(fileOf(mp4Bytes(), 'a.mp4'))).toBeNull();
    expect(await readImageSize(fileOf(zipBytes(), 'a.zip'))).toBeNull();
    expect(await readImageSize(fileOf(new Uint8Array(0), 'empty.png'))).toBeNull();
    expect(
      await readImageSize(fileOf(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]), 'short.png')),
    ).toBeNull();
    expect(await readImageSize(new Blob(['GIF89a......'], { type: 'image/gif' }))).toBeNull();
  });

  it('goes by the bytes, not by the name or declared type', async () => {
    const asJpg = fileOf(pngBytes(7, 9), 'photo.jpg');
    expect(await readImageSize(asJpg)).toEqual({ format: 'PNG', width: 7, height: 9 });
  });
});

describe('sniffFileKind', () => {
  it('knows PNG, JPEG, MP4 and ZIP by their signatures', async () => {
    expect(await sniffFileKind(fileOf(pngBytes(1, 1), 'x'))).toBe('PNG');
    expect(await sniffFileKind(fileOf(jpegBytes({ width: 1, height: 1 }), 'x'))).toBe('JPEG');
    expect(await sniffFileKind(fileOf(mp4Bytes(), 'x'))).toBe('MP4');
    expect(await sniffFileKind(fileOf(zipBytes(), 'x'))).toBe('ZIP');
  });

  it('looks for ftyp at offset 4 for MP4', async () => {
    const wrongPlace = Uint8Array.from([0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await sniffFileKind(fileOf(wrongPlace, 'x'))).toBeNull();
  });

  it('gives null for everything else, including empty and very short files', async () => {
    expect(await sniffFileKind(new Blob(['hello world, not an image']))).toBeNull();
    expect(await sniffFileKind(new Blob([]))).toBeNull();
    expect(await sniffFileKind(new Blob([Uint8Array.from([0xff])]))).toBeNull();
    expect(await sniffFileKind(new Blob(['GIF89a']))).toBeNull();
    expect(await sniffFileKind(new Blob(['%PDF-1.7']))).toBeNull();
  });

  it('reads only the first 12 bytes', async () => {
    const file = fileOf(zipBytes(), 'big.zip', 3 * MIB);
    const asked = recordSlices(file);
    expect(await sniffFileKind(file)).toBe('ZIP');
    expect(asked()).toBeLessThanOrEqual(12);
  });
});

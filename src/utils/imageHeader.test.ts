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
function recordSlices(blob: Blob): (() => number) & { calls: () => number } {
  const original = blob.slice.bind(blob);
  let total = 0;
  let calls = 0;
  vi.spyOn(blob, 'slice').mockImplementation((start?: number, end?: number, type?: string) => {
    calls++;
    const from = Math.max(0, start ?? 0);
    const to = Math.min(blob.size, end ?? blob.size);
    total += Math.max(0, to - from);
    return original(start, end, type);
  });
  return Object.assign(() => total, { calls: () => calls });
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

/** Makes every way of reading the whole file throw; only Blob.slice (a new Blob) still works. */
function forbidWholeFileReads(file: Blob) {
  const fail = () => {
    throw new Error('the whole file must not be read');
  };
  vi.spyOn(file, 'arrayBuffer').mockImplementation(fail);
  vi.spyOn(file, 'stream').mockImplementation(fail);
  vi.spyOn(file, 'text').mockImplementation(fail);
  vi.stubGlobal('FileReader', fail);
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

describe('reading only the start of a file', () => {
  it('readImageSize cannot be satisfied by reading the whole file: a PNG', async () => {
    const file = fileOf(pngBytes(640, 480), 'big.png', 3 * MIB);
    forbidWholeFileReads(file);
    const asked = recordSlices(file);
    expect(await readImageSize(file)).toEqual({ format: 'PNG', width: 640, height: 480 });
    expect(asked()).toBeGreaterThan(0);
    expect(asked()).toBeLessThanOrEqual(64);
  });

  it('readImageSize cannot be satisfied by reading the whole file: a JPEG', async () => {
    const file = fileOf(jpegBytes({ width: 640, height: 480 }), 'big.jpg', 3 * MIB);
    forbidWholeFileReads(file);
    const asked = recordSlices(file);
    expect(await readImageSize(file)).toEqual({ format: 'JPEG', width: 640, height: 480 });
    expect(asked()).toBeGreaterThan(0);
    expect(asked()).toBeLessThanOrEqual(128 * 1024);
  });

  it('sniffFileKind cannot be satisfied by reading the whole file', async () => {
    const file = fileOf(zipBytes(), 'big.zip', 3 * MIB);
    forbidWholeFileReads(file);
    const asked = recordSlices(file);
    expect(await sniffFileKind(file)).toBe('ZIP');
    expect(asked()).toBeGreaterThan(0);
    expect(asked()).toBeLessThanOrEqual(12);
  });

  it('reads a JPEG whose frame header lies after 72 KB in a few blocks of about 64 KB, not byte by byte and not 4 MiB at once', async () => {
    const before = [jpegSegment(0xe1, 40000), jpegSegment(0xe1, 31000), jpegSegment(0xe2, 1000)];
    const file = fileOf(jpegBytes({ width: 6000, height: 4000, before }), 'exif.jpg', 6 * MIB);
    const asked = recordSlices(file);
    expect(await readImageSize(file)).toEqual({ format: 'JPEG', width: 6000, height: 4000 });
    // The frame header starts at about 72 KB: one 24-byte read, then blocks of 64 KiB.
    expect(asked()).toBeLessThanOrEqual(72 * 1024 + 2 * 64 * 1024);
    expect(asked.calls()).toBeLessThanOrEqual(8);
  });
});

describe('a file kind is told by its whole signature, one byte off is not enough', () => {
  it('PNG: every one of the eight signature bytes counts', async () => {
    for (let i = 0; i < 8; i++) {
      const bytes = pngBytes(5, 5);
      bytes[i] ^= 0x01;
      expect(await sniffFileKind(fileOf(bytes, 'x'))).toBeNull();
      expect(await readImageSize(fileOf(bytes, 'x.png'))).toBeNull();
    }
  });

  it('PNG: the IHDR chunk length must be 13 and its name IHDR', async () => {
    const wrongLength = pngBytes(5, 5);
    wrongLength[11] = 12;
    expect(await readImageSize(fileOf(wrongLength, 'x.png'))).toBeNull();
    const wrongLengthHigh = pngBytes(5, 5);
    wrongLengthHigh[8] = 1;
    expect(await readImageSize(fileOf(wrongLengthHigh, 'x.png'))).toBeNull();
    for (let i = 12; i < 16; i++) {
      const wrongName = pngBytes(5, 5);
      wrongName[i] ^= 0x01;
      expect(await readImageSize(fileOf(wrongName, 'x.png'))).toBeNull();
    }
  });

  it('JPEG: the first three bytes are FF D8 FF', async () => {
    const noMarker = jpegBytes({ width: 5, height: 5 });
    noMarker[2] = 0xfe;
    expect(await sniffFileKind(fileOf(noMarker, 'x'))).toBeNull();
    expect(await readImageSize(fileOf(noMarker, 'x.jpg'))).toBeNull();
    const wrongStart = jpegBytes({ width: 5, height: 5 });
    wrongStart[0] = 0xfe;
    expect(await sniffFileKind(fileOf(wrongStart, 'x'))).toBeNull();
    const wrongSecond = jpegBytes({ width: 5, height: 5 });
    wrongSecond[1] = 0xd9;
    expect(await sniffFileKind(fileOf(wrongSecond, 'x'))).toBeNull();
  });

  it('ZIP: the four bytes are PK 03 04, not just PK', async () => {
    for (let i = 0; i < 4; i++) {
      const bytes = zipBytes();
      bytes[i] ^= 0x01;
      expect(await sniffFileKind(fileOf(bytes, 'x'))).toBeNull();
    }
  });

  it('MP4: every one of the four ftyp bytes counts', async () => {
    for (let i = 4; i < 8; i++) {
      const bytes = mp4Bytes();
      bytes[i] ^= 0x01;
      expect(await sniffFileKind(fileOf(bytes, 'x'))).toBeNull();
    }
  });

  it('JPEG: a frame header that is shorter than seven bytes gives no size', async () => {
    // SOF0 whose declared length is 6, one short of length + precision + height + width.
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 6, 8, 0, 5, 0, 5, 0x42, 0x42]);
    expect(await readImageSize(fileOf(bytes, 'x.jpg'))).toBeNull();
    const exactly = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 7, 8, 0, 5, 0, 9, 0x42, 0x42]);
    expect(await readImageSize(fileOf(exactly, 'x.jpg'))).toEqual({
      format: 'JPEG',
      width: 9,
      height: 5,
    });
  });

  it('JPEG: a segment that declares a length under 2 ends the search instead of looping', async () => {
    for (const length of [0, 1]) {
      const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, length, 0x41, 0x41, 0x41, 0x41]);
      expect(await readImageSize(fileOf(bytes, 'x.jpg'))).toBeNull();
    }
    // Length 2 is a segment with no payload and is skipped.
    const empty = Uint8Array.from([
      0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xc0, 0, 17, 8, 0, 4, 0, 3, 3, 1, 0x22, 0, 2, 0x11, 1, 3,
      0x11, 1,
    ]);
    expect(await readImageSize(fileOf(empty, 'x.jpg'))).toEqual({
      format: 'JPEG',
      width: 3,
      height: 4,
    });
  });
});

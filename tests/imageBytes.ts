// Hand-built file headers for tests of the file sniffing and upload checks. Nothing here decodes
// an image: the bytes are only as valid as the header the code under test reads.

const u16 = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff];
const u32 = (n: number): number[] => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG signature plus an IHDR chunk (and an IEND chunk), about 45 bytes, any declared size. */
export function pngBytes(width: number, height: number): Uint8Array {
  const ihdr = [...u32(13), 0x49, 0x48, 0x44, 0x52, ...u32(width), ...u32(height), 8, 2, 0, 0, 0];
  const crc = [0, 0, 0, 0];
  const iend = [...u32(0), 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];
  return Uint8Array.from([...PNG_SIGNATURE, ...ihdr, ...crc, ...iend]);
}

/** One JPEG segment: marker byte, 16-bit length (which counts itself), payload. */
export function jpegSegment(marker: number, payloadLength: number): number[] {
  if (payloadLength + 2 > 0xffff)
    throw new Error('a JPEG segment cannot be longer than 65535 bytes');
  return [0xff, marker, ...u16(payloadLength + 2), ...new Array<number>(payloadLength).fill(0x41)];
}

export type JpegOptions = {
  width: number;
  height: number;
  /** Start-of-frame marker: 0xC0 baseline, 0xC2 progressive, and so on. */
  sof?: number;
  /** Segments placed between SOI and the start-of-frame segment. */
  before?: number[][];
  /** Bytes appended after the start-of-frame segment (a stand-in for scan data). */
  tail?: number;
};

export function jpegBytes({
  width,
  height,
  sof = 0xc0,
  before = [],
  tail = 8,
}: JpegOptions): Uint8Array {
  const frame = [
    0xff,
    sof,
    ...u16(17),
    8,
    ...u16(height),
    ...u16(width),
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  ];
  return Uint8Array.from([
    0xff,
    0xd8,
    ...before.flat(),
    ...frame,
    ...new Array<number>(tail).fill(0x42),
  ]);
}

export function mp4Bytes(): Uint8Array {
  return Uint8Array.from([
    0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 2, 0,
  ]);
}

export function zipBytes(): Uint8Array {
  return Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 0, 0, 0, 0]);
}

/** A File over the given bytes; `padTo` appends zero bytes so the file reaches that exact size. */
export function fileOf(bytes: Uint8Array, name: string, padTo?: number): File {
  if (padTo === undefined || padTo <= bytes.length) return new File([bytes as BlobPart], name);
  return new File([bytes as BlobPart, new Uint8Array(padTo - bytes.length)], name);
}

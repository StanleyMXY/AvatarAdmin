import { describe, expect, it } from 'vitest';
import { maskTokenLikeText } from './maskTokenLikeText';

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOP.AO-J1Oxyz123';

describe('maskTokenLikeText', () => {
  it('keeps the start and the last six characters of a long random string and hides the middle', () => {
    const out = maskTokenLikeText(`Verifying purchase token ${TOKEN} failed with 410`);
    expect(out).toBe('Verifying purchase token abcd…xyz123 failed with 410');
    expect(out).not.toContain('mnopqrst');
    expect(out).not.toContain(TOKEN);
  });

  it('hides every such string in a text, also one in quotes, after an equals sign or in a link', () => {
    const out = maskTokenLikeText(
      `"${TOKEN}" token=${TOKEN} https://host/v1/purchases/${TOKEN}?x=1 ${TOKEN}.`,
    );
    expect(out).not.toContain('efghijklmnop');
    expect(out.match(/abcd…xyz123/g)).toHaveLength(4);
    expect(out.endsWith('abcd…xyz123.')).toBe(true);
  });

  it('hides a run of exactly twenty characters and leaves one of nineteen', () => {
    expect(maskTokenLikeText('a'.repeat(20))).toBe('aaaa…aaaaaa');
    expect(maskTokenLikeText('a'.repeat(19))).toBe('a'.repeat(19));
  });

  it('leaves the plain words of the languages of the interface and of the markets as they are', () => {
    const texts = [
      'การตรวจสอบการซื้อล้มเหลว: โทเค็นไม่ถูกต้องหรือหมดอายุแล้วกรุณาลองใหม่อีกครั้งภายหลัง',
      'فشل التحقق من عملية الشراء لأن الرمز غير صالح أو منتهي الصلاحية, يرجى المحاولة لاحقا',
      'Verifikasi pembelian gagal karena token tidak valid atau sudah kedaluwarsa',
      'Xác minh giao dịch mua không thành công vì mã không hợp lệ hoặc đã hết hạn',
      'La verificación de la compra falló porque el token no es válido o ha caducado',
      'Purchase verification failed: the store answered 410 Gone at 2026-11-03T08:00:00Z',
      '购买校验失败：商店返回 410，该订阅已过期，请稍后重试。购买校验失败购买校验失败购买校验失败',
      'The store answered 503 for order 2000001234567890 (retry 3 of 5)',
      'Error: timeout after 30 s; see the notes of the store',
    ];
    for (const text of texts) expect(maskTokenLikeText(text)).toBe(text);
  });

  it('does not touch letters of other scripts that stand inside a long string of ASCII', () => {
    const text = `${'x'.repeat(30)}การซื้อ`;
    expect(maskTokenLikeText(text)).toBe('xxxx…xxxxxxการซื้อ');
  });

  it('returns an empty text as it is', () => {
    expect(maskTokenLikeText('')).toBe('');
  });

  it('works in linear time on a text of 200000 characters, whatever it is made of', () => {
    const shapes = [
      'a'.repeat(200_000),
      'a'.repeat(19).concat(' ').repeat(10_000),
      '.'.repeat(200_000),
      '-'.repeat(200_000),
      `${'ab '.repeat(66_666)}`,
      `${'a.'.repeat(100_000)}`,
      `${'x'.repeat(19)}!`.repeat(10_000),
      'การ'.repeat(70_000),
    ];
    for (const text of shapes) {
      const started = performance.now();
      const out = maskTokenLikeText(text);
      expect(performance.now() - started).toBeLessThan(500);
      expect(out.length).toBeLessThanOrEqual(text.length + 1);
    }
  });
});

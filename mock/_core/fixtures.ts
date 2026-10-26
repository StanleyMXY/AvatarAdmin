// Sample data for the mock backend. Every language the product targets is here, not only
// Chinese: Thai, Arabic (right to left), Indonesian, Vietnamese, Spanish, English and Chinese,
// with long strings without spaces and emoji outside the BMP.
import { randomUUID } from 'node:crypto';

export const multilingualSamples = {
  th: [
    'สวัสดีครับ วันนี้อากาศดีมาก',
    'ขอบคุณสำหรับความช่วยเหลือของคุณ',
    'ภาษาไทยไม่มีช่องว่างระหว่างคำดังนั้นข้อความยาวๆอาจทำให้ตารางล้นได้ถ้าไม่จัดการให้ดี',
    'แอปนี้ใช้งานง่ายมาก 😀',
  ],
  ar: [
    'مرحبا بك في التطبيق',
    'شكرا جزيلا على مساعدتك',
    'هذا نص طويل جدا باللغة العربية يكتب من اليمين إلى اليسار ويحتوي على أرقام ١٢٣ وكلمات إنجليزية mixed in',
    'التطبيق رائع 🌟',
  ],
  id: [
    'Halo, apa kabar hari ini?',
    'Terima kasih atas bantuan Anda',
    'Aplikasi ini sangat membantu saya setiap hari dalam berkomunikasi dengan teman-teman baru',
    'Bagus sekali 👍',
  ],
  vi: [
    'Xin chào, hôm nay bạn thế nào?',
    'Cảm ơn bạn rất nhiều vì đã giúp đỡ',
    'Ứng dụng này giúp tôi nói chuyện với bạn bè mỗi ngày một cách dễ dàng và vui vẻ',
    'Tuyệt vời 🎉',
  ],
  es: [
    'Hola, ¿cómo estás hoy?',
    'Muchas gracias por tu ayuda',
    'Esta aplicación me ayuda a hablar con mis amigos todos los días sin ningún problema',
    '¡Qué bien! 🎶',
  ],
  en: [
    'Hello, how are you today?',
    'Thank you so much for your help',
    'This app helps me talk with my friends every day without any trouble at all',
    'Great stuff 🚀',
  ],
  zh: [
    '你好，今天过得怎么样？',
    '非常感谢你的帮助',
    '这个应用每天都帮我和朋友轻松地聊天而且完全没有任何问题所以我很喜欢它',
    '太棒了 🎉',
  ],
  // One string without any space or break opportunity, and one with a combining mark and a ZWJ sequence.
  longUnbroken: `${'A'.repeat(300)}`,
  edgeCases: ['ก็ก็ก็ก็', '\u{1F468}\u200D\u{1F469}\u200D\u{1F467} family', 'lam-alef ﻻ'],
} as const;

export type SampleLanguage = 'th' | 'ar' | 'id' | 'vi' | 'es' | 'en' | 'zh';

export const SAMPLE_LANGUAGES: readonly SampleLanguage[] = [
  'th',
  'ar',
  'id',
  'vi',
  'es',
  'en',
  'zh',
];

/** The `index`-th sample of the language, cycling through the list. */
export const sampleText = (language: SampleLanguage, index: number): string => {
  const list = multilingualSamples[language];
  return list[index % list.length];
};

/** A sample that cycles through all the languages: row 0 Thai, row 1 Arabic, and so on. */
export const sampleAny = (index: number): string =>
  sampleText(
    SAMPLE_LANGUAGES[index % SAMPLE_LANGUAGES.length],
    Math.floor(index / SAMPLE_LANGUAGES.length),
  );

export const makeUuid = (): string => randomUUID();

/** ISO-8601 UTC time `n` days before now (or before `from`). */
export const daysAgoIso = (n: number, from: Date = new Date()): string =>
  new Date(from.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

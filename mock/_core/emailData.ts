// In-memory state of the e-mail template endpoints of the mock backend (contract 17.4, item 14 of
// the field tables). The six templates and their default texts are declared here, in code, as the
// contract says; a row in `rows` is a change made through the page (the contract's `modified`).
// It hangs on `globalThis` like the rest of the mock state (see store.ts). Not a mock file itself:
// Umi's loader reads every file in mock/.

export type EmailDefault = {
  subject: string;
  body: string;
  /** Each with its braces, as in the template text. */
  placeholders: string[];
  requiredPlaceholders: string[];
};

export type EmailRow = { subject: string; body: string; updatedBy: string; updatedAt: string };

export type EmailStore = {
  defaults: Map<string, EmailDefault>;
  /** A row exists once the template was saved; a reset removes it. */
  rows: Map<string, EmailRow>;
};

const DEFAULTS: [string, EmailDefault][] = [
  [
    'REGISTER_CODE',
    {
      subject: 'Your {appName} verification code',
      body: 'Your {appName} verification code is {code}. It expires in {minutes} minutes. If you did not ask for it, ignore this e-mail.',
      placeholders: ['{code}', '{minutes}', '{appName}'],
      requiredPlaceholders: ['{code}'],
    },
  ],
  [
    'PASSWORD_RESET',
    {
      subject: 'Reset your {appName} password',
      body: 'Open {resetLink} to choose a new password. The link works for {minutes} minutes.',
      placeholders: ['{resetLink}', '{minutes}', '{appName}'],
      requiredPlaceholders: ['{resetLink}'],
    },
  ],
  [
    'DELETION_CONFIRM',
    {
      subject: 'Confirm that you want to delete your {appName} account',
      body: 'Open {confirmLink} to confirm. {subscriptionNotice} The link works for {minutes} minutes.',
      placeholders: ['{confirmLink}', '{subscriptionNotice}', '{minutes}', '{appName}'],
      requiredPlaceholders: ['{confirmLink}', '{subscriptionNotice}'],
    },
  ],
  [
    'PASSWORD_CHANGED',
    {
      subject: 'Your {appName} password was changed',
      body: 'Your password was changed at {time}. If this was not you, reset it now.',
      placeholders: ['{time}', '{appName}'],
      requiredPlaceholders: ['{time}'],
    },
  ],
  [
    'LOGIN_METHOD_ADDED',
    {
      subject: 'A new sign-in method was added to your {appName} account',
      body: '{method} was added as a sign-in method to your account at {time}. If this was not you, secure your account now.',
      placeholders: ['{method}', '{time}', '{appName}'],
      requiredPlaceholders: ['{method}', '{time}'],
    },
  ],
  [
    'LIKENESS_COMPLAINT_RECEIVED',
    {
      subject: 'We received your complaint to {appName}',
      body: 'We received your complaint about a photo and will answer within the legal period.',
      placeholders: ['{appName}'],
      requiredPlaceholders: [],
    },
  ],
];

function seed(): EmailStore {
  return { defaults: new Map(DEFAULTS), rows: new Map() };
}

const holder = globalThis as { __avatarAdminMockEmail?: EmailStore };

export const emailState: EmailStore = (() => {
  holder.__avatarAdminMockEmail ??= seed();
  return holder.__avatarAdminMockEmail;
})();

/** Puts the defaults back and forgets every change. `now` is not used: a change is stamped when it is made. */
export function resetEmailStore(_now: Date = new Date()): void {
  Object.assign(emailState, seed());
}

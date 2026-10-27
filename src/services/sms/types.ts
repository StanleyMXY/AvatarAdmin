// The shapes of the SMS endpoints (contract 23.4 and 23.6). The names of the fields are the names
// of the entities `SmsChannel`, `SmsTemplate` and `SmsSendRecord` in contract 23.4. What the contract
// leaves open (the name of the credentials field, the body of the switch, the answer of a test send,
// the names of the filters) follows docs/contract-requests/2026-10-26-admin-frontend-sms-email.md.

export type Page<T> = { items: T[]; total: number };

export const SMS_TYPES = ['OTP', 'MARKETING'] as const;
export type SmsType = (typeof SMS_TYPES)[number];

/** How a verification message went out: as a text message or as a push message. */
export const DELIVERY_CHANNELS = ['SMS', 'PUSH'] as const;
export type DeliveryChannel = (typeof DELIVERY_CHANNELS)[number];

export const RECORD_PURPOSES = ['LOGIN', 'DELETE', 'DELETE_WEB', 'EXPORT', 'TEST'] as const;
export type RecordPurpose = (typeof RECORD_PURPOSES)[number];

export const SEND_STATUSES = ['QUEUED', 'SENDING', 'SUCCESS', 'FAILED'] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const DELIVERY_STATUSES = ['PENDING', 'DELIVERED', 'FAILED', 'NOT_APPLICABLE'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/**
 * A channel as the list gives it. The credentials are never in it: the backend gives only
 * `hasCredentials`. The page reads these fields and no others.
 */
export type SmsChannel = {
  id: string;
  channelCode: string;
  name: string;
  providerCode: string;
  apiUrl: string;
  extConfig: unknown;
  /** Empty or missing means all countries. */
  countries: string[] | null;
  smsType: SmsType;
  enabled: boolean;
  priority: number;
  hasCredentials: boolean;
  createdAt: string;
  updatedAt: string;
};

/** The body of a create. `credentials` is left out unless something was typed. */
export type ChannelInput = {
  channelCode: string;
  name: string;
  providerCode: string;
  apiUrl: string;
  extConfig: Record<string, unknown> | null;
  countries: string[];
  smsType: SmsType;
  priority: number;
  enabled: boolean;
  credentials?: string;
};

/** The body of an update: the code and the switch cannot be changed here. */
export type ChannelPatch = Omit<ChannelInput, 'channelCode' | 'enabled'>;

export type SmsProvider = { code: string; allowedHosts: string[] };

export type SmsMeta = {
  providers: SmsProvider[];
  /** The test sends the signed-in administrator has left today; null when the answer does not say. */
  testRemainingToday: number | null;
};

export type SmsTemplate = {
  id: string;
  templateCode: string;
  name: string;
  locale: string;
  country: string | null;
  content: string;
  providerTemplateId: string | null;
  smsType: SmsType;
  enabled: boolean;
};

export type TemplateInput = {
  templateCode: string;
  name: string;
  smsType: SmsType;
  locale: string;
  country: string | null;
  content: string;
  providerTemplateId: string | null;
  enabled: boolean;
};

export type TemplatePatch = Omit<TemplateInput, 'templateCode' | 'enabled'>;

/** A send record. `mobile` is masked by the backend unless the administrator holds SMS:RECORD:PHONE_VIEW. */
export type SmsRecord = {
  msgId: string;
  channel: DeliveryChannel;
  vendorMsgId: string | null;
  channelCode: string;
  purpose: RecordPurpose;
  mobile: string;
  country: string | null;
  localeUsed: string | null;
  templateCode: string | null;
  /** The text with the verification code replaced by `****`. */
  contentRedacted: string;
  sendStatus: SendStatus;
  deliveryStatus: DeliveryStatus;
  failReason: string | null;
  /** When the code of this message was checked successfully; null when it was not used. */
  usedAt: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
};

export type RecordQuery = {
  page: number;
  pageSize: number;
  msgId?: string;
  vendorMsgId?: string;
  /** The whole number, matched exactly. */
  mobile?: string;
  channel?: DeliveryChannel;
  channelCode?: string;
  purpose?: RecordPurpose;
  sendStatus?: SendStatus;
  deliveryStatus?: DeliveryStatus;
  used?: boolean;
  from?: string;
  to?: string;
};

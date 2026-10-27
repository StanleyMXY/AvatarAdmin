// Types of the avatar and cosmetic endpoints. Field names are the backend's: contract 3.6 to 3.10
// and 17.4 (the "形象与装扮" row and the note on pictures), the entity columns of contract 18, and
// the backend note of 2026-10-21 (points 1 to 3) and its reply (points 5 and 6). Where the
// contract names no request parameter or answer shape, docs/contract-requests/
// 2026-10-26-admin-frontend-cosmetics-complaints.md says what is assumed.

export type Page<T> = { items: T[]; total: number };

export type AvatarStyle = 'STYLIZED_3D' | 'REALISTIC';
export const AVATAR_STYLES: readonly AvatarStyle[] = ['STYLIZED_3D', 'REALISTIC'];

export type Platform = 'ANDROID' | 'IOS';
export const PLATFORMS: readonly Platform[] = ['ANDROID', 'IOS'];

/** One end a catalog item is shown on (contract 3.7): a platform and a channel code, `null` for every channel of the platform. */
export type Surface = { platform: Platform; channel: string | null };

/** Language tag to text. */
export type LocalizedTexts = Record<string, string>;

// ---- cosmetics (COSMETIC:MANAGE) ----

export type CosmeticKind = 'OUTFIT' | 'BACKGROUND';
export const COSMETIC_KINDS: readonly CosmeticKind[] = ['OUTFIT', 'BACKGROUND'];

export type CosmeticItem = {
  id: string;
  key: string;
  kind: CosmeticKind;
  names: LocalizedTexts;
  /** A short-lived signed address; `null` when the file is missing. Never kept between visits. */
  previewUrl: string | null;
  generationSpec: string;
  compatibleStyles: AvatarStyle[];
  surfaces: Surface[];
  /** `null`: cannot be bought with credits. */
  creditPrice: number | null;
  isFree: boolean;
  isDefault: boolean;
  enabled: boolean;
  sortOrder: number;
};

export type CosmeticQuery = {
  page: number;
  pageSize: number;
  kind?: CosmeticKind;
  enabled?: boolean;
  style?: AvatarStyle;
};

/** The fields a cosmetic is written with; the picture goes as `previewUploadId`, never as an address. */
export type CosmeticFields = {
  names: LocalizedTexts;
  generationSpec: string;
  compatibleStyles: AvatarStyle[];
  surfaces: Surface[];
  creditPrice: number | null;
  isFree: boolean;
  isDefault: boolean;
  sortOrder: number;
  previewUploadId?: string;
};

export type CosmeticCreate = CosmeticFields & {
  key: string;
  kind: CosmeticKind;
  enabled?: boolean;
};

// ---- actions (ACTION:MANAGE) ----

export type TriggerableBy = 'USER' | 'AGENT' | 'BOTH';
export const TRIGGERABLE_BY: readonly TriggerableBy[] = ['USER', 'AGENT', 'BOTH'];

export type ActionItem = {
  id: string;
  key: string;
  names: LocalizedTexts;
  description: string;
  iconUrl: string | null;
  generationSpec: string;
  compatibleStyles: AvatarStyle[];
  surfaces: Surface[];
  triggerableBy: TriggerableBy;
  enabled: boolean;
  sortOrder: number;
};

export type ActionFields = {
  names: LocalizedTexts;
  description: string;
  generationSpec: string;
  compatibleStyles: AvatarStyle[];
  surfaces: Surface[];
  triggerableBy: TriggerableBy;
  sortOrder: number;
  iconUploadId?: string;
};

export type ActionCreate = ActionFields & { key: string; enabled?: boolean };

// ---- declarations (DECLARATION:MANAGE) ----

export type Declaration = {
  version: string;
  texts: LocalizedTexts;
  activeFrom: string | null;
  isActive: boolean;
};

// ---- renderer models (RENDERER:MANAGE) ----

export type RendererModel = {
  id: string;
  rendererKind: string;
  version: string;
  platform: Platform;
  abi: string;
  sha256: string | null;
  sizeBytes: number | null;
  rendererFormatVersion: number;
  minVersionCode: number;
  enabled: boolean;
  createdAt: string | null;
};

export type RendererModelCreate = {
  uploadId: string;
  rendererKind: string;
  version: string;
  platform: Platform;
  abi: string;
  rendererFormatVersion: number;
  minVersionCode: number;
};

// ---- generation tasks (GENERATION:VIEW) ----

export type GenerationTaskType = 'AVATAR' | 'VOICE' | 'LOOK' | 'LOOK_REPREPARE' | 'ACTION_CLIP';
export const GENERATION_TASK_TYPES: readonly GenerationTaskType[] = [
  'AVATAR',
  'VOICE',
  'LOOK',
  'LOOK_REPREPARE',
  'ACTION_CLIP',
];

export type GenerationTask = {
  id: string;
  /** `null`: a system task (the default avatar). */
  accountId: string | null;
  type: GenerationTaskType;
  status: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---- default avatars (DEFAULT_AVATAR:MANAGE) ----

/** There is no FAILED: a failed generation goes back to DRAFT and `failureReason` says why. */
export type DefaultAvatarStatus = 'DRAFT' | 'GENERATING' | 'READY';

export type DefaultAvatarFailureReason =
  | 'CONTENT_REJECTED'
  | 'GENERATION_FAILED'
  | 'EXTERNAL_TIMEOUT'
  | 'EXTERNAL_TASK_LOST'
  | 'SUBJECT_UNDERAGE'
  | 'NO_FACE_DETECTED';

export const DEFAULT_AVATAR_FAILURE_REASONS: readonly DefaultAvatarFailureReason[] = [
  'CONTENT_REJECTED',
  'GENERATION_FAILED',
  'EXTERNAL_TIMEOUT',
  'EXTERNAL_TASK_LOST',
  'SUBJECT_UNDERAGE',
  'NO_FACE_DETECTED',
];

export type DefaultAvatar = {
  id: string;
  name: string;
  style: AvatarStyle;
  status: DefaultAvatarStatus;
  isActive: boolean;
  failureReason: DefaultAvatarFailureReason | null;
  lookId: string | null;
  sourceImageUrl: string | null;
  previewUrl: string | null;
};

export type DefaultAvatarCreate = { name: string; style: AvatarStyle; sourceUploadId: string };

// ---- an account's avatars (the user detail page) ----

export type AccountLook = {
  lookId: string;
  status: string;
  outfitItemId: string | null;
  backgroundItemId: string | null;
  /** The user's face: a signed address, `null` when the file is missing. */
  previewUrl: string | null;
  createdAt: string;
};

export type AccountAvatar = {
  assetId: string;
  name: string;
  style: AvatarStyle;
  createdAt: string;
  currentLookId: string | null;
  isCurrent: boolean;
  looks: AccountLook[];
};

export type OwnedCosmetic = {
  itemId: string;
  itemKey: string;
  source: 'CREDITS' | 'ADMIN_GRANT';
  creditLedgerId: string | null;
  grantedAt: string;
};

export type AccountAvatars = { avatars: AccountAvatar[]; cosmetics: OwnedCosmetic[] };

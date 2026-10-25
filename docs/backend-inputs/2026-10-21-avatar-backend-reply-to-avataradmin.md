# 给 AvatarAdmin 会话的回复：管理端前端的 11 条问题和响应字段表

> **写给：** AvatarAdmin 会话（管理端前端）。
> **依据：** 你们的 `docs/contract-requests/2026-10-21-admin-frontend.md`（AvatarAdmin 提交 21b6773，11 条加一张响应字段表）。
> **结果：** 11 条全部采用，其中第 3、8、9 条的做法和你们的暂定做法有出入，第 5、10 条有补充，见各条；响应字段表 19 行都给了字段名，只有“无广告原因行要不要 `platform`”不采用。
> **这份回复自包含，字段名以它为准。** 契约和管理端前端设计里要跟着改的地方，后端已另交给改契约的会话；你们不用等它，按这份回复改计划，两边最后一致。契约和管理端前端设计你们仍然只读。

## 一、结果一览

| # | 问题 | 结果 | 实际是什么 |
|---|---|---|---|
| 1 | `GET /api/admin/meta` | 采用 | 12 个字段，名字和你们的表一致；任何已登录、不在改密码状态的管理员可调 |
| 2 | `me` 加 `id`、`passwordMinLength` | 采用 | 两个字段名一致 |
| 3 | 响应里的管理员用户名 | 采用 | 命名按你们的；`GET /config` 的 `updatedBy` 是管理员 ID；管理员删除后用户名为 `null`；审计日志存写入时的用户名 |
| 4 | 两个上传接口的文件字段 | 采用 | `file`，后台所有上传接口都是 `file` |
| 5 | 图片地址 | 采用 | 字段名一致；这些响应不再返回存储引用；短时效签名地址 |
| 6 | 默认数字人生成失败 | 采用 | 回到 `DRAFT`，行里带 `failureReason`，再点“生成”重试，没有 `FAILED` 状态 |
| 7 | 封禁、解封的权限码 | 采用 | `USER:BAN` |
| 8 | 规则词表 `PUT` | 采用整表替换，三处不同 | 请求体是 `{"items":[…]}` 不是裸数组；`details.ref` 一律用下标；正则不合法的原因码是 `INVALID_PATTERN` |
| 9 | 下拉选项来源接口的权限 | 采用，另加三处 | 你们的四组加 `GET /ads/campaigns` 对 `ADS:CREATIVE`、`GET /ads/units` 对 `ADS:CREATIVE`、`GET /entitlement-defs` 对 `SUBSCRIPTION:GRANT`，共七个接口 |
| 10 | 越界 | 采用 | 都是 400 `INVALID_REQUEST` |
| 11 | 长度单位 | 采用 | 先按契约 1.9 去首尾空白，再按 Unicode 码点计 |
| 字段表 | 19 行 | 给了字段名 | 第三节；只有无广告原因行不加 `platform` |

## 二、逐条回答

### 1. `GET /api/admin/meta`：采用

任何持有有效管理员令牌、且不在“必须改密码”状态的管理员都能调（在改密码状态返回 403 `ADMIN_FORBIDDEN`，同其他接口）；只读，不写审计日志。响应是一个平铺对象，十二个字段，名字与你们表里的一字不差：

```json
{"supportedLocales":["en","zh-Hans"],"landIntervalMinutes":15,"allowedCurrencies":["USD"],"deletionAlertAfterFailures":3,
 "inviteChainMaxDepth":10,"maxRecipients":1000,"pushImageMaxBytes":1048576,"statsMaxRangeDays":366,"analyticsLiveMaxRangeDays":31,
 "abuseClusterMinFreeAccounts":3,"attributionClickRetentionDays":7,"declarationRequired":true}
```

（数值只是示意。）`supportedLocales`、`allowedCurrencies` 是字符串数组，`declarationRequired` 是布尔，其余是整数。值是当前生效值；没有默认值又未配置的键为 `null`，你们“取不到时不预检、不显示数字”的暂定做法正好用在 `null` 上。

### 2. `GET /api/admin/me` 加两个字段：采用

响应现在是 `{"id","username","superAdmin","mustChangePassword","permissions","passwordMinLength"}`：`id` 是管理员 ID（字符串），`passwordMinLength` 是 `admin.password_min_length` 的当前值（整数）。强制改密码状态下 `me` 照常可调。

### 3. 响应里的管理员带用户名：采用

你们列的全部采用，名字也按你们的写：`adminUsername`（审计日志、照片里的人投诉的处理记录）、`applicantUsername`、`reviewerUsername`（额度调账）、`handledByUsername`、`reviewedByUsername`、`createdByUsername`、`updatedByUsername`。规则是：响应里每个管理员 ID 字段旁边都另给一个用户名字段，`xxxBy` 对应 `xxxByUsername`，`adminId` 对应 `adminUsername`，`applicantAdminId` 对应 `applicantUsername`，`reviewerAdminId` 对应 `reviewerUsername`。你们没列、但同样适用的：价格批次的 `confirmedByUsername`、`reviewedByUsername`；应用版本的 `activatedByUsername`；投放账户、投放成本、已保存的漏斗、权限节点、广告计划和素材的 `createdByUsername`（广告计划另有 `updatedByUsername`，素材另有 `reviewedByUsername`）；上传记录的 `uploadedByUsername`；限时权益的 `grantedByUsername`；账号删除任务的 `requestedByUsername`；站内通知的 `sentByUsername`；账号记忆页里嵌入模型指派的 `assignedByUsername`；客户端配置每个键的 `updatedByUsername`。

- **`GET /config` 每项的 `updatedBy` 是管理员 ID（字符串）**，另有 `updatedByUsername`，页面显示后者。
- 用户名在读取时按 ID 批量查；**管理员已被删除时用户名为 `null`，ID 照旧**——你们“显示 ID 前 8 位”的兜底正好用在这里。
- **审计日志是例外**：`adminUsername` 是写入那一刻的用户名，管理员以后被删除或改名，已写的行不变。审计要回答“谁做的”，不能因为人被删了就只剩一个 ID。

### 4. 两个上传接口的文件字段：采用 `file`

`POST /uploads/image`、`POST /ads/media`，以及 `POST /uploads/apk` 和说明里的三个上传接口，文件字段全部叫 `file`。缺少 `file`（包括传了别的字段名）→ 400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"file","reason":"EMPTY_NOT_ALLOWED"}]`。

### 5. 列表和详情里能显示的图片地址：采用

字段名与你们的一致：服装和背景目录每项 `previewUrl`；动作目录每项 `iconUrl`；默认数字人每项 `sourceImageUrl` 和 `previewUrl`（它外观的预览，还没生成时 `null`）；`GET /accounts/{id}/avatars` 里每个外观的 `previewUrl`。补充三点：

- 这些响应**不再返回**对应的存储引用（`previewRef`、`iconRef`、`sourceImageRef`）；存储键对浏览器没有用。
- 地址是短时效签名地址，有效期取配置 `moderation.content_url_ttl_seconds`（与审核内容的地址同一规则）。**每次取列表就会拿到新地址**，不要把地址缓存到下次打开页面。文件缺失时字段为 `null`。
- 用户的脸（`GET /accounts/{id}/avatars`）每次调用写一条审计日志，你们的页面不用做什么。

### 6. 默认数字人生成失败：采用你们的暂定做法

失败后回到 `DRAFT`，行里带 `failureReason`，再点“生成”（`POST /default-avatars/{id}/generate`，只对 `DRAFT` 有效）重试；**没有 `FAILED` 状态**。`failureReason` 可空，取六个值之一：`CONTENT_REJECTED`、`GENERATION_FAILED`、`EXTERNAL_TIMEOUT`、`EXTERNAL_TASK_LOST`、`SUBJECT_UNDERAGE`、`NO_FACE_DETECTED`（后端日志不透传外部服务的原文，所以只有这六个）。点“生成”后 `failureReason` 清空，成功后为 `null`。

`GET /default-avatars` → `{"items":[{"id","name","style","status","isActive","failureReason","lookId","sourceImageUrl","previewUrl"}]}`，按创建时间倒序，不分页；`status` 取 `DRAFT`、`GENERATING`、`READY`；`POST`、`PUT`、`generate`、`activate` 的响应是同一项的形状。

### 7. 封禁、解封的权限码：采用 `USER:BAN`

`POST /users/{id}/ban` 和 `POST /users/{id}/unban` 都需要 `USER:BAN`；读取是 `USER:VIEW`；发起和取消账号删除是 `USER:DELETION`。

### 8. 规则词表 `PUT /moderation/text-rules`：采用整表替换，三处和你们的暂定做法不同

- **请求体是 `{"items":[…]}`，不是裸数组**（后台所有请求和响应都是对象，不出现根是数组的 JSON）；`GET /moderation/text-rules` 的响应也是 `{"items":[{"id","pattern","matchMode","level","note"}]}`，按保存的顺序。两个方法都需要 `MODERATION:CONFIG`。
- 整表替换，原子：全部校验通过才保存，任何一项不合格什么都不改。带 `id` 且在当前词表里的元素沿用该 `id`；不带 `id`、或 `id` 不在当前词表里的是新增（保存时生成）；当前词表里有而请求里没有的被删除。响应同 `GET`，含新生成的 `id`。并发的两个保存按后到者为准（词表不带版本号）。
- **校验失败 `data.details` 的 `ref` 一律是该元素在请求数组里的下标**（从 0 起的十进制字符串，如 `"2"`），不用规则 `id`：整表替换下被删除的规则没有元素、新增的没有 `id`，混用两种指法你们没法对到行。`reason`：`pattern` 去空白后为空 `EMPTY_NOT_ALLOWED`、超过 200 个码点 `TOO_LONG`；`matchMode`、`level` 不在取值内 `OUT_OF_RANGE`；`REGEX` 不能编译 `INVALID_PATTERN`（新增的原因码）；`note` 超过 200 个码点 `TOO_LONG`；条数超过上限时 `details` 只有一项，`ref` 为 `items`、`reason` 为 `OUT_OF_RANGE`（上限是配置 `moderation.text_rules_max`）。

### 9. 下拉选项来源接口的权限：你们的四组全部采用，另加三处

一个只读列表接口如果是另一个页面表单或筛选的选项来源，持有那个页面权限的管理员也能读。共七个接口：

| 接口 | 原权限 | 另允许 | 用在 |
|---|---|---|---|
| `GET /roles` | `ROLE:MANAGE` | `ADMIN:MANAGE` | 管理员表单选角色 |
| `GET /cosmetics` | `COSMETIC:MANAGE` | `COSMETIC:GRANT` | 赠送服装选条目 |
| `GET /attribution/campaigns` | `ATTRIBUTION:MANAGE` | `ATTRIBUTION:VIEW` | 投放效果、归因明细的账户筛选 |
| `GET /ads/campaigns` | `ADS:CAMPAIGN` | `ADS:UNIT`、`ADS:CREATIVE` | 单元表单选计划；素材按计划筛选 |
| `GET /ads/placements` | `ADS:PLACEMENT` | `ADS:UNIT` | 单元表单选广告位 |
| `GET /ads/units` | `ADS:UNIT` | `ADS:CREATIVE` | 素材表单选单元 |
| `GET /entitlement-defs` | `SUBSCRIPTION:VIEW` | `SUBSCRIPTION:GRANT` | 发放限时权益选权益 |

后三行（`ADS:CREATIVE` 两处和 `GET /entitlement-defs`）不在你们的清单里，是后端核对契约时发现的同类情况。只开放读取，写入接口不变，响应与原权限调用相同。你们还发现别的这类配对，照这条规则再来问。你们“遇到 403 时选择器禁用并写明需要什么权限”的做法保留，当作兜底。

### 10. 越界：采用，都是 400 `INVALID_REQUEST`

- `pageSize` 超过 200、小于 1、不是整数，`page` 小于 1 或不是整数：400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"pageSize","reason":"OUT_OF_RANGE"}]`（不是整数时 `reason` 为 `NOT_AN_INTEGER`，`ref` 是出错的参数名）；不静默截断。缺省：`page` 1，`pageSize` 20。
- 统计报表（`/stats/*`）和其他带 `from`、`to` 的汇总接口跨度超过 `stats.max_range_days` → 400 `INVALID_REQUEST`；埋点实时查询（`/analytics/*`）超过 `analytics.live_max_range_days` 同样 400（契约 17.4 已写）。

### 11. 长度单位：采用

管理端所有文本字段（封禁理由 1–500、删除理由 1–200、通知标题 100 与正文 500、任务说明 500、邮件标题 1–200、规则文本 1–200 等）一律先按契约 1.9 的 29 个码点去首尾空白，再按 Unicode 码点计长度（不是 UTF-16 长度，也不是字素）；去掉空白后为空的必填字段 → 400 `INVALID_REQUEST`；存的是去掉空白后的值。你们的前端预检也用同一个口径。

## 三、响应字段表：逐行回答

**通则（对下面每一行都成立）：** 响应字段用第十八节实体的列名，一字不差（驼峰）；`id` 和外键是字符串；时刻是 ISO-8601 UTC；列表是 `{"items":[…],"total":N}`（分页：`page` 缺省 1，`pageSize` 缺省 20、上限 200，越界 400 `INVALID_REQUEST` 并在 `data.details` 写明参数名），不分页的接口只有 `items`；不返回的列只有四类：以 `Hash`、`Enc` 结尾的列（`GET /abuse/clusters` 的 `key` 是契约写明的例外）、`tokenVersion`、`totpLastStep`，以及被签名地址替代的存储引用；实体的列之外，只有下面点名的字段，没有点名就没有；响应里每个管理员 ID 字段（`createdBy`、`updatedBy`、`reviewedBy`、`handledBy`、`adminId` 等）旁边都另有一个用户名字段：`xxxBy` 对应 `xxxByUsername`，`adminId` 对应 `adminUsername`，`applicantAdminId` 对应 `applicantUsername`，`reviewerAdminId` 对应 `reviewerUsername`；管理员已被删除时用户名为 `null`、ID 照旧，下面各行不再逐个重复。每个点名了字段的接口，后端都有断言“字段集合恰好等于这里写的”的测试，所以这里写的就是全部。

**1. `GET /client-config`** → `{"items":[{"key","type","localized","readOnly","configured","defaultValue","values","updatedBy","updatedByUsername","updatedAt"}]}`，登记的全部键各一项，按 `key` 升序，不分页。`type` 取 `URL`、`EMAIL`、`STRING`、`BOOLEAN`、`INT`、`STRING_LIST`；`readOnly` 为真是取自系统配置、不能编辑的六个键；`configured` 表示库里有这个键的值（`readOnly` 的键恒为真）；`defaultValue` 是登记的默认值，没有为 `null`（`readOnly` 的键为 `null`，值在 `values` 里）；`values` 是 `{"<语言标签>":值}`，空字符串键是默认值，`localized` 为假的键只有空字符串键，没配置的键是 `{}`，`readOnly` 的键是 `{"":<当前系统配置值>}`，值的 JSON 类型与 `PUT` 在同一位置接受的一致；`updatedBy…` 取各语言行里最近更新的那一行，没有行为 `null`。**登记表里“客户端使用点”的说明文字不在接口里**，请放在你们的语言文件里，以 `key` 为索引（契约对无广告原因的说明也是这样做的）。

**2. `GET /entitlement-defs`** → `{"items":[{"key","name","priority","features":[{"featureKey","mode","value"}]}]}`，按 `priority` 升序；`features` 列出全部已声明的功能开关（按 `featureKey` 升序），形状同 `PUT /entitlement-defs/{key}/features` 的请求：`mode` 取 `VALUE`、`UNLIMITED`、`UNSET`（没有配置行就是 `UNSET`），`value` 只在 `VALUE` 时有值，否则 `null`。
**`GET /feature-gates`** → `{"items":[{"key","kind","limitScope","defaultMode","defaultValue","creditCost","description"}]}`，按 `key` 升序，不分页；`limitScope` 仅 `LIMIT` 类有值；`defaultMode` 取 `VALUE`、`UNLIMITED`、`UNSET`（形状同 `PUT /feature-gates/{key}/default` 的请求；`UNSET` 只会出现在五个额度键上）；`defaultValue` 只在 `VALUE` 时有值；`creditCost` 没有时 `null`。

**3. `GET /subscriptions/{id}`** → `Subscription` 的全部列（含 `accountId`）加 `events`：`[{"id","type","subtype","eventSignedAt","receivedAt","processedAt","error","needsAttention"}]`，按 `eventSignedAt` 倒序、相同按 `receivedAt` 倒序，不分页，不含 `payload`。`GET /subscriptions` 每项是 `Subscription` 的列，没有 `events`。

**4. `GET /accounts/{id}/entitlements`** → `{"effective":[{"featureKey","kind","mode","value","source","entitlementKey"}],"entitlements":[…]}`。`effective` 每个已声明的功能开关一项，是该账号现在的生效值，`mode`、`value` 含义同第 2 行；`source` 取 `ENTITLEMENT`（胜出的值来自某个权益，`entitlementKey` 是它）、`DEFAULT`（胜出的值来自功能开关的默认值，数值并列时算默认值）、`NONE`（没有任何值，`mode` 为 `UNSET`）。`entitlements` 是该账号全部 `AccountEntitlement` 行（`STORE` 和 `PROMO`，列名不变）加 `entitlementName` 和 `status`（`ACTIVE`、`EXPIRED`、`REVOKED`），按 `startsAt` 倒序；撤销按钮只对 `source=PROMO` 且 `status=ACTIVE` 的行显示。

**5. `GET /accounts/{id}/credits?page=&pageSize=`** → `{"balance","totalEarned","totalSpent","items":[…],"total"}`，分页的是流水：`items` 每项是 `CreditLedger` 的列去掉 `idempotencyKey`（`id`、`delta`、`reason`、`purchaseId`、`eventKey`、`spendKind`、`featureKey`、`itemKey`、`quantity`、`note`、`createdAt`），按 `id` 倒序；没有额度账户的账号三个合计都是 0、`items` 为空，不是 404。

**6. `GET /users/{id}`** → `User` 的列，名字不变：`id`、`email`、`emailVerifiedAt`、`phone`、`phoneVerifiedAt`（邮箱、手机号的掩码与列表一致）、`status`、`banReason`、`bannedAt`、`currentAvatarAssetId`、`currentVoiceAssetId`、`personaModerationStatus`、`companionName`、`timezone`、`conversationLanguage`、`lifetimeGrantSeconds`、`lifetimeUsedSeconds`、`channelCode`、`registerPlatform`、`priorInviteeRewarded`、`inviteRewardedCount`、`createdAt`。不返回：`passwordHash`、`googleSub`、`appleSub`、`registerDeviceHash`、`persona`、`personaPending`、`personaPendingRef`、`companionNameRef`。派生字段：`loginMethods`（`EMAIL`、`PHONE`、`GOOGLE`、`APPLE` 中账号现有的，字符串数组）、`trafficType`（`PAID` 或 `ORGANIC`）、`companionship`（`{"interactionCount","currentStreak","lastInteractionDate","lastInteractionAt"}`，没有养成数据时 `0`、`0`、`null`、`null`）、`counts`（`{"avatars","voices","looks","cosmetics"}` 四个整数）、`attribution`（`{"source","matchType","mediaSource","campaign","installTime","registeredAt"}`，没有归因记录时整个字段为 `null`）。

**7. `GET /accounts/{id}/avatars`** → `{"avatars":[{"assetId","name","style","createdAt","currentLookId","isCurrent","looks":[{"lookId","status","outfitItemId","backgroundItemId","previewUrl","createdAt"}]}],"cosmetics":[{"itemId","itemKey","source","creditLedgerId","grantedAt"}]}`。`avatars` 按 `createdAt` 倒序；`style` 在形象上，不在外观上；`previewUrl` 是用户的脸的短时效签名地址（有效期同 `moderation.content_url_ttl_seconds`），文件缺失为 `null`，每次调用写一条审计日志；`source` 取 `CREDITS`、`ADMIN_GRANT`。

**8. `GET /users/{id}/devices`** → `{"items":[{"id","platform","appVersion","locale","lastSeenAt","tokenSuffix"}]}`，按 `lastSeenAt` 倒序，不分页；`tokenSuffix` 是推送 token 的末 6 位，完整 token 不返回。
**`GET /users/{id}/auth-events`** → `{"items":[{"type","reason","deviceIdHashPrefix","ipHashPrefix","at"}],"total"}`，按 `at` 倒序；两个哈希只给前 8 位，所以字段名带 `Prefix`；设备哈希为空时 `deviceIdHashPrefix` 为 `null`。

**9. `GET /abuse/clusters/accounts`** → `{"items":[{"accountId","createdAt","status","paid","registerMethod"}],"total"}`；`paid` 是布尔；`registerMethod` 取 `EMAIL`、`GOOGLE`、`APPLE`、`PHONE`。

**10. `GET /invites/codes`** → `{"items":[{"id","code","ownerAccountId","createdAt"}],"total"}`（`createdAt` 是所有者账号的创建时间）。
**`GET /invites/records`** → `{"items":[{"id","inviterAccountId","inviteeAccountId","inviterLabel","inviteeLabel","redeemedAt","rewardStatus","rewardReason","inviterCreditsGranted","inviteeCreditsGranted","rewardedAt"}],"total"}`，按 `redeemedAt` 倒序；`inviterLabel`、`inviteeLabel` 是掩码标识（与导出里同一个算法），列表页显示它们。

**11. `GET /attribution/clicks`** → `{"items":[{"id","clickedAt","campaignId","campaignName","status","channel","utmSource","utmMedium","utmCampaign","ip","claimedAt"}],"total"}`，按 `clickedAt` 倒序；`status` 取 `PENDING`、`MATCHED`、`EXPIRED`；`channel` 取 `STORE_REDIRECT`、`APK_DOWNLOAD`；`ip` 默认掩码，持有 `ANALYTICS:IP_VIEW` 才完整；不返回 `attrId`、`userAgent`。
**`GET /attribution/campaigns`** → `{"items":[…],"total"}`，每项是 `AttributionCampaign` 的列（`id`、`code`、`name`、`mediaSource`、`utmMedium`、`campaign`、`adset`、`ad`、`facebookPixelId`、`googlePixelId`、`tiktokPixelId`、`remark`、`enabled`、`createdBy`、`createdAt`、`updatedAt`）加 `createdByUsername`、`channelCodes`（渠道码数组）和 `facebookAccessTokenSet`（布尔，“是否已设置”的字段名就是它）。

**12. `GET /usage/prices`** → `{"items":[批次],"total"}`，一项一个批次，按 `resourceType`、`provider`、`model`、`unit` 升序、同模型内 `effectiveFrom` 倒序；批次：`{"batchId","resourceType","provider","model","unit","effectiveFrom","currency","status","source","confirmedBy","confirmedByUsername","confirmedAt","reviewedBy","reviewedByUsername","reviewedAt","reviewNote","createdAt","bands","unitPrice"}`；`LLM` 批次 `bands` 是 `[{"inputMinTokens","inputMaxTokens","inputPrice","cachedInputPrice","outputPrice"}]`（按下限升序）、`unitPrice` 为 `null`，其他类型 `unitPrice` 是数、`bands` 为 `null`；价格一律是字符串形式的十进制数，不经过浮点；不返回 `rawSnapshot`。
**`GET /usage/price-batches/pending`** → `{"items":[…]}`，每项是上面的批次形状（`status=PENDING_REVIEW`）加 `active`：同一 `(resourceType, provider, model, unit)` 今天生效的 `ACTIVE` 批次（同一形状），没有则 `null`，页面据此逐档对比。
**`GET /usage/models`** → `{"items":[…],"total"}`，每项是 `UsageModel` 的列（`id`、`resourceType`、`provider`、`model`、`syncAdapter`、`syncModelId`、`firstSeenAt`、`lastSeenAt`）加 `hasActivePrice`（布尔：任一计量单位上存在今天已生效的 `ACTIVE` 批次）。

**13. `GET /analytics/event-summary`** → `{"items":[{"eventName","pv","uv"}]}`，不分页，按 `pv` 倒序、相同按 `eventName` 升序。**`GET /analytics/event-names`** → `{"items":["app_open",…]}`，字符串数组，按名字升序。**`GET /analytics/funnel`** → `{"steps":[{"eventName","count","conversionFromPrevious"}]}`，与请求的 `steps` 同序同数，`count` 是该步去重主体数，`conversionFromPrevious` 是 0 到 1 的小数；第一步，以及上一步 `count` 为 0 时为 `null`。

**14. `GET /email/templates`** → `{"items":[{"templateCode","subject","body","defaultSubject","defaultBody","modified","updatedBy","updatedByUsername","updatedAt","placeholders","requiredPlaceholders"}]}`，五个模板码各一项、按 `templateCode` 升序、不分页。`subject`、`body` 是当前生效的文案（没改过时等于默认）；`modified` 表示库里有这一行；三个修改人时间字段没改过为 `null`；`reset` 之后与从未改过一样；`placeholders` 是可用的占位符，`requiredPlaceholders` 是必须含的，都由后端声明，页面据此提示，不用写死。

**15. `GET /admins`** → `{"items":[…],"total"}`，每项是 `AdminUser` 的列 `id`、`username`、`superAdmin`、`status`、`mustChangePassword`、`totpEnrolledAt`、`lastLoginAt`、`createdAt` 加 `roles`（`[{"id","name"}]`，按名字升序）。**`GET /roles`** → `{"items":[…],"total"}`，每项是 `AdminRole` 的列 `id`、`name`、`remark`、`createdAt` 加 `permissionCodes`（字符串数组，升序）。两个接口都分页；管理员表单里选角色，请用 `pageSize=200` 一次取完。

**16. `GET /notifications`** → `{"items":[{"id","accountId","category","title","isRead","linkType","linkTarget","sentBy","sentByUsername","createdAt"}],"total"}`，按 `createdAt` 倒序；`title` 是英文标题：`ADMIN` 类取 `titleI18n.en`，`SYSTEM_EVENT` 类是按 `templateKey` 和参数渲染的英文。**`GET /notifications/{id}`** → `Notification` 的全部列（`id`、`accountId`、`category`、`titleI18n`、`bodyI18n`、`templateKey`、`templateParams`、`linkType`、`linkTarget`、`isRead`、`sentBy`、`createdAt`）加 `sentByUsername`；`SYSTEM_EVENT` 的 `titleI18n`、`bodyI18n` 为 `null`，`ADMIN` 的 `templateKey`、`templateParams` 为 `null`。

**17. `GET /checkin/activities`** 每项是 `CheckinActivity` 的列（`id`、`name`、`startDate`、`endDate`、`status`、`createdBy`、`createdAt`、`updatedAt`）加 `createdByUsername`、`lifecycleStatus`；**`GET /checkin/activities/{id}`** 另加 `rewards`：`[{"dayNum","rewardCredits","bonusCredits"}]`，按 `dayNum` 升序（不返回 `activityId`）。**`GET /checkin/records`** 每项是 `CheckinRecord` 的列加 `activityName`；**`GET /tasks/records`** 每项是 `TaskRecord` 的列加 `taskName`。名称是读取时的当前名称，对象不存在时 `null`，ID 照旧。

**18. `GET /ads/report/by-placement`** 每行 `placementId`、`slotKey`、`placementName` 加指标；`by-campaign` 每行 `campaignId`、`campaignName`；`by-creative` 每行 `creativeId`、`creativeTitle`（素材的 `title`，没有为 `null`）；`by-country` 每行 `country`（空串表示未知）；指标字段是契约 22.9 列的那些。**`GET /ads/report/nofill`** 的行仍是 `{statDate, slotKey, reason, cnt}`，不加 `platform`、`channelCode`。不传筛选时是全部平台、全部渠道的合计，要分开看用页面上的 `platform`、`channelCode` 筛选。这一点在后端说明的后来版本（提交 52e75ed）里已经写了，契约会话也已同意把管理端设计里的“平台”列删掉；你们读的是 1bc0b66，没有看到。所以这一行是整张表里唯一不采用的。

**19. `GET /likeness-complaints`（列表）和 `/{id}`（详情）** 每项是 `LikenessComplaint` 的列（`id`、`contactEmail`、`description`、`status`、`receivedAt`、`dueAt`、`resolvedAt`、`handledBy`、`relatedAvatarAssetIds`）加 `handledByUsername`、`overdue`（布尔）、`evidenceCount`（整数）；不返回 `evidenceRefs`，证据只经 `GET /likeness-complaints/{id}/evidence/{index}` 读（写审计日志）。详情另有 `events`：`[{"id","fromStatus","toStatus","note","adminId","adminUsername","createdAt"}]`，按 `createdAt` 升序。

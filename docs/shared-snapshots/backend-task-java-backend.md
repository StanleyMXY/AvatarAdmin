# AvatarApp Java 后端开发任务

## 背景

AvatarApp 是一个全新的 AI 数字人陪伴 App。整体架构分两条线：

1. **数字人 agent**（低延迟，走 LiveKit）——负责"对话怎么发生"，是独立项目 `AvatarAgent`（Python），**不是本任务范围**。本后端与它的接口只有第三节（3.5 合成服务）、第四、五、十三（13.2）、十四节写明的几处。
2. **App 后端（本任务）**——负责"账号、资产、养成数据、聊天记录"这些传统 REST 服务的部分，独立数据库，跟上面那条线并列、不是包含关系。

本任务覆盖 App 后端的**全部**职责（主设计文档第 7 节逐条对应）：账号与认证、资产库、LiveKit 会话集成、聊天记录、养成数据与里程碑、埋点、推送与召回、邀请、广告归因、内容审核与举报、客服反馈、账号删除与数据导出、系统监控数据接收、订阅与权益、记忆服务集成、应用内广告、手机号登录与短信管理、应用版本管理、站内通知、客户端远程配置（第二十二至二十六节）、额度购买（15.9）、每日签到与每日任务（第二十八节）、管理后台的后端（admin 模块）。这些功能统一设计、一次交付，本文档不存在"后续任务"。主设计文档第 7 节的"配置管理"一项（第 20 节 Firebase Remote Config）是纯客户端能力，后端没有接口；后端自己的运营参数见 17.5。第二十一节只给依赖顺序（哪个必须先存在），不是分阶段。

**订阅与权益**（第十五节）和**记忆服务集成**（第十六节）也在本任务内：订阅自建，哪些功能收费由运营在管理后台配置。

**本任务依赖两个外部服务提供目前不存在的能力**（已读源码核实，详见第十九节）：AvatarMemory 没有按账号清除/导出记忆的接口，形象生成服务是一个新仓库（3.5），要实现 3.5 的 `AvatarGenerationProvider` 接口（含 `delete`）。账号删除、资产删除都要用到，这些是对方项目必须补的，见第十三节。声音克隆与合成由 AvatarAgent 项目自带的合成服务 `tts_service`（VoxCPM2）提供，它已经实现了音色的注册、按名查询和删除（3.5、13.2），不在缺能力之列；此前文档里的 CosyVoice 不再用于产品。

设计依据的完整背景见 `docs/superpowers/specs/2026-09-29-app-shell-cloud-integration-design.md`，本文档是从中提炼出的、给后端开发直接用的接口与数据设计。凡本文档与主设计文档冲突，以本文档为准，主设计文档随后同步。

---

## 一、通用约定

### 1.1 技术栈

| 项目 | 选择 |
|------|------|
| 语言/框架 | Java 21 + Spring Boot 4.1.x（3.3.x 已于 2025-06-30 结束维护） |
| 构建工具 | Maven（后端开发选定，2026-10-09；构建工具不影响任何接口或数据约定，下面的依赖坐标 Maven 与 Gradle 通用） |
| 数据库 | PostgreSQL 16，走 Spring Data JPA；原始埋点事件存 MongoDB（主设计文档第 12 节：读写模式和增长速度与结构化数据不同，分开存储） |
| 认证 | 自签发 JWT（HS256）作 access token，配 refresh token（见 2.6）；跟 LiveKit 自己的房间 token 是两套完全不同的 token，不要混用；管理后台用另一套签名密钥和 audience（见第十七节） |
| LiveKit 集成 | 官方 Java/Kotlin Server SDK：`io.livekit:livekit-server:0.16.0`（Maven Central） |
| 推送 | Firebase Admin SDK（FCM），版本开发时核实 |
| 支付渠道 | 自建，直接对接 Apple App Store Server Notifications V2 / App Store Server API 和 Google Play Developer API（`purchases.subscriptionsv2`）+ Pub/Sub 推送，不用 RevenueCat 等第三方订阅服务（第十五节） |
| 定时任务 | Spring `@Scheduled`，多实例部署时用数据库锁保证同一任务只有一个实例执行（如 ShedLock），用于召回推送（第八节）、账号删除重试（第十三节）、资产任务轮询（3.5） |
| 缓存与限流 | Redis：多实例共享的限流计数（各节的 `RATE_LIMITED`，含 1.6 的未登录接口限流） |
| 文件存储 | 通过 `FileStorage` 接口读写上传文件、预览图、导出文件，以及形象的标准图、驱动资源包、动作片段（3.5）。生产环境必须是多实例共享的存储（S3 兼容对象存储或共享卷），不能是单机本地磁盘。选哪一种取决于部署方案，缺的输入是部署方案 |
| 音视频处理 | ffmpeg：广告素材的视频取首帧（22.9）、声音样本统一转码为 16-bit PCM WAV（3.5）。形象只收照片，不再有视频 |
| 运营可调参数 | 存后端自己的 `AppConfig` 表，由管理后台编辑（第十七节）。**不使用 Firebase Remote Config 读参数**：主设计文档第 20 节选它是给客户端功能开关/AB 用的，Firebase 文档只明确写了服务端 Remote Config 由 Node.js Admin SDK 支持，没有写 Java |

### 1.2 请求头

| Header | 必须 | 说明 |
|--------|------|------|
| Authorization | 除标注"无需登录"外必须 | `Bearer {本系统JWT}` |
| Accept-Language | 否 | 客户端对所有请求统一携带，取设备系统语言列表的前几项（BCP 47，可带权重，如 `th-TH, ar;q=0.9`）。短信模板（23.4）、更新说明（24.3）、站内通知（25.4）、客户端配置（26.3）据此取语言 |
| X-App-Version | 否 | 客户端版本名（如 `1.2.0`），所有请求都带。服务端只用于日志和按版本排查问题，不用于认证、限流和业务判断，缺失不报错。照 dramaBox 客户端每个请求带版本、平台、渠道等头 [核实 审计 D2]，只取这三个，设备型号、系统版本、设备 ID 不放头里（隐私最小化；设备 ID 已在游客创建和事件请求体里） |
| X-Platform | 否 | `ANDROID` 或 `IOS`，用途同上；另有一个业务用途：服装、背景、动作目录按条目的 `surfaces` 筛选（3.7、3.8）。这个头由客户端自报、可以冒充，只用于按商店政策筛选展示的条目，不用于认证和计费 |
| X-Channel | 否 | 安装渠道码（24.7），用途同 `X-Platform`（含目录按 `surfaces` 筛选）；格式不合法的值被丢弃，不报错 |
| Idempotency-Key | 仅 `POST /api/avatars`、`POST /api/voices`、`POST /api/avatars/{assetId}/looks` 必须 | 客户端为每次提交生成的随机键（UUID），重试用同一个键，规则见 3.2（建外观同一套规则，3.6：建外观可能扣额度、占外观名额，重试不能建出第二个）。`POST /api/cosmetics/{itemId}/redeem` 不用这个头，用请求体的 `idempotencyKey`，规则同 `POST /api/credits/spend`（3.7、15.9） |

**语言协商规则（全文只有这一份，各节引用它）**：服务端按 RFC 9110 解析完整的 `Accept-Language`，按 `q` 值从高到低（`q` 缺省为 1，同值保持出现顺序）逐项尝试，**不是只取第一项**；对每一项，先找完整匹配（`th-TH`，不区分大小写）；没有就找主语言子标签相同的条目（两边都取主语言子标签比较：请求 `zh-CN` 可以匹配条目 `zh-Hans`，请求 `th` 可以匹配条目 `th-TH`）：只有一个就取它；有多个时，先取“是请求标签前缀”的（按子标签边界，请求 `zh-Hant-TW` 先取条目 `zh-Hant`）；仍有多个时，再按文字变体筛选：标签显式写了 `Hans` 或 `Hant` 的按它，没写的只对 `zh` 推断，地区 `TW`、`HK`、`MO` 取 `Hant`，其余地区或没有地区取 `Hans`，请求和条目两边都这样算，取文字变体相同的；其他语言不做文字变体推断；最后取列表里靠前的第一个。所有项都没有可用的版本，回退 `en`（26.1 的回退不同，见 26.1）。"该资源有这种语言的版本"由各节定义（例如短信模板必须是启用的）。头缺失或无法解析时直接用 `en`。`q=0` 的项表示不接受，跳过。

内部服务间接口（数字人 agent、形象生成服务、云端渲染服务调用本后端，本后端调用 AvatarAgent 和形象生成服务）不用用户 JWT，用 HMAC 签名认证（1.8）：聊天记录写入（第五节）、管线监控上报（14.1）和用量上报（14.2，每个上报方一把）各用一把独立密钥。

### 1.3 统一响应格式

**成功响应：**
```json
{
    "code": "200",
    "message": "success",
    "data": { ... }
}
```

**失败响应：**
```json
{
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "data": null
}
```

**本文档里的响应示例**：除非特别说明，示例只写信封里 `data` 的值，实际响应都套在上面的信封里（`{"code":"200","message":"success","data":<示例>}`）；`304 Not Modified`（带 `If-None-Match` 的 `GET /api/config/client`，26.3）没有响应体，不带信封。

**HTTP 状态码与 dramaBox 的差异**：dramaBox 对业务异常一律返回 HTTP 200，只有 JWT 过滤器的 401 和限流的 429 设置状态码，失败时响应里不带 `data`（审计子任务读码，未逐条核实）；本契约按错误码返回 HTTP 状态码（1.4 的第二列），失败时 `data` 为 `null`。这是有意的偏离，2026-10-05 经用户确认保留。原因：状态码让网关、负载均衡和日志不解析响应体就能区分成功和失败 [推断，没有来源]；客户端按 `code` 处理，不依赖状态码。

### 1.4 通用错误码

| code | HTTP状态 | 说明 |
|------|---------|------|
| INVALID_TOKEN | 401 | JWT无效/过期/缺失 |
| INVALID_SIGNATURE | 401 | 内部服务调用（1.8）、供应商短信送达回执（23.5）、LiveKit webhook（4.2）和商店通知（15.5：Apple JWS 的证书链或签名无效，Google 身份令牌的签名、签发者、过期或受众不对）的签名无效（webhook 不做任何处理、没有副作用）、时间戳超出窗口、nonce 已用过或调用方标识未登记（1.8），不区分原因 |
| EMAIL_TAKEN | 409 | 邮箱已被注册 |
| ALREADY_REGISTERED | 409 | 请求带着已注册账号的登录令牌调用注册接口，不能重复注册（2.2） |
| REGISTRATION_REQUIRED | 403 | 该接口需要注册账号，游客凭据（2.1）不能调用；客户端引导用户注册或登录 |
| GUEST_QUOTA_EXHAUSTED | 403 | 游客的通话额度已用完（4.3）；客户端提示注册 |
| DEVICE_INTEGRITY_FAILED | 403 | 设备校验没有通过：不签发游客凭据（2.1），不创建账号（2.2、2.7、23.2），不接受自建归因的认领（10.4） |
| GUEST_ONLY | 403 | 该接口只供游客凭据使用，账号令牌调用（`GET /api/guest/quota`，2.1） |
| EMAIL_SEND_FAILED | 503 | 同步发送的邮件（注册验证码，2.2.1）发送失败，邮件服务商没有配置，或需要链接的邮件没有配置 `email.link_base_url`（2.2.1、2.9、13.4）；重置密码申请里单封邮件的发送失败只记日志，不返回这个错误（2.9） |
| SESSION_NOT_FOUND | 404 | 设备列表里的登录链不存在或不属于当前账号（2.9） |
| CHAT_BUSY | 409 | 该账号已有一轮文字对话在处理中，或同一 `messageKey` 的那一轮还没结束（5.4） |
| CALL_IN_PROGRESS | 409 | 账号有进行中的通话，不能发文字消息（5.4） |
| COST_EXISTS | 409 | 这个投放账户这一天已经有一条投放成本，用 `PUT` 修改（10.5） |
| INVITER_NOT_ELIGIBLE | 400 | 邀请码校验失败(见2.4) |
| INVALID_CREDENTIALS | 401 | 邮箱或密码错误 |
| INVALID_FILE | 400 | 上传文件为空/超限/类型不支持 |
| TASK_NOT_FOUND | 404 | 任务不存在或不属于当前账号(两种情况统一返回这个，不区分，避免泄露别人的任务ID是否存在) |
| ASSET_NOT_FOUND | 404 | 资产不存在或不属于当前账号 |
| INVALID_TIMEZONE | 400 | 发起会话（4.1）、发文字消息（5.4）、签到和每日任务（28.1、28.2）时缺少 `timezone` 或不是有效的 IANA 时区名 |
| PERSONA_TOO_LONG | 400 | 人格设定超过长度限制（见 2.5） |
| INVALID_REFRESH_TOKEN | 401 | refresh token 无效、过期或已被使用过（见 2.6） |
| INVALID_SOCIAL_TOKEN | 401 | Google/Apple 的 ID token 校验失败（见 2.7） |
| ACCOUNT_BANNED | 403 | 账号被管理员封禁（见 2.8）；响应体 `data` 带 `{"reason":"..."}` |
| ACCOUNT_DELETING | 403 | 账号正在执行删除（见第十三节） |
| ACCOUNT_DELETION_SCHEDULED | 403 | 账号已申请删除，处在宽限期内（13.1）；`data` 带 `{"scheduledAt":"..."}`；只有 `POST /api/account/deletion/cancel`、`POST /api/auth/logout`、只读的 `GET /api/account` 和 `purpose=DELETE` 的 `POST /api/auth/phone/otp/send` 可用 |
| CONTENT_REJECTED | 400 | 内容被自动审核判定为高风险，已拦截（见第十一节）；伴侣名字的中风险同样返回它（2.5.1） |
| REPORT_TARGET_NOT_FOUND | 404 | 举报的对象不存在或不属于当前账号 |
| BATCH_TOO_LARGE | 413 | 埋点批量事件条数或体积超限（见第七节） |
| RATE_LIMITED | 429 | 超过限流；登录失败锁定（2.3）、用量接口（14.2）和导出的最小间隔（13.3）的 429 带 `data.retryAfterSeconds`（整数秒，至少 1），用量接口和导出的最小间隔同时带 `Retry-After` 头；其他限流的 429 没有 `data`，也不带 `Retry-After` |
| INVALID_REQUEST | 400 | 请求参数不合法（字段缺失、密码少于 8 位或超过 `auth.password_max_length` 位、邮箱格式错误、文本超长、枚举值不在范围内等），`message` 写明是哪个字段。需要指出出错对象的接口在 `data` 里放 `{"details":[{"ref":"<出错对象>","reason":"<原因代码>"}]}`。`ref` 按接口固定：25.3 的账号列表是账号 ID；26.3 的 `PUT /client-config/{key}` 是语言标签，不带语言的默认值（空字符串键）写 `default`；17.5 的 `PUT /config/{key}` 是配置键；17.4 的 `PUT /moderation/text-rules` 是出错元素在请求数组 `items` 里的下标（从 0 起的十进制字符串，11.2）；其他按 1.7 校验链接的接口是出错的请求字段名（例如 `linkTarget`、`clickTarget`、`storeUrl`）。`reason` 是代码：账号类（25.3）`ACCOUNT_NOT_FOUND`（账号不存在）、`ACCOUNT_NOT_ACTIVE`（状态不是 `ACTIVE`）；值校验类（1.7、26.3、17.5 共用）`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`（依次对应 1.7 链接规则的各条，总长度超限用 `TOO_LONG`）、`INVALID_EMAIL`、`NOT_AN_INTEGER`、`OUT_OF_RANGE`、`NOT_BOOLEAN`、`INVALID_LANGUAGE_TAG`、`EMPTY_NOT_ALLOWED`、`INVALID_PATTERN`（规则词表里的正则无法编译，11.2）。人看的说明在 `message` 里（英文） |
| INVALID_INVITE_CODE | 400 | 邀请码不存在或格式不对（见 2.4） |
| INVALID_RESET_TOKEN | 400 | 密码重置令牌无效、已过期、已用过，或对应账号既不是 `ACTIVE` 也不是 `PENDING_DELETION`（见 2.9） |
| EXPORT_NOT_FOUND | 404 | 导出任务不存在或不属于当前账号 |
| EXPORT_NOT_READY | 409 | 导出任务未完成、已失败或已过期 |
| ADMIN_INVALID_CREDENTIALS | 401 | 管理员用户名或密码错误 |
| ADMIN_FORBIDDEN | 403 | 管理员缺少该接口所需的权限码 |
| ADMIN_INVALID_TOKEN | 401 | 管理员 JWT 无效、过期或缺失；用户 JWT 访问 `/api/admin/**` 同样返回它（17.2），前端据此跳登录页 |
| ADMIN_TOTP_REQUIRED | 401 | 账号和密码正确、该管理员已绑定二次验证，但请求没有带 `totp`（17.2） |
| ADMIN_TOTP_INVALID | 401 | 二次验证码错误、已用过或已过期（17.2） |
| SELF_REVIEW_FORBIDDEN | 403 | 额度调账申请人不能审核自己提交的申请（15.9） |
| ROLE_IN_USE | 409 | 角色仍分配给管理员，不能删除（17.3） |
| PERMISSION_HAS_CHILDREN | 409 | 权限节点下还有子节点，不能删除（17.3） |
| CHECKIN_NOT_AVAILABLE | 404 | 现在没有生效的签到活动（28.1） |
| TASK_NOT_CLAIMABLE | 409 | 这个任务现在不能领取：还没完成或已过期（28.2；已经领过的再次领取返回 200 和已发放的结果，不是这个错误）。`taskId` 不存在、或当前任务日没有这个任务的记录时返回 404 `RESOURCE_NOT_FOUND` |
| TASK_HAS_RECORDS | 409 | 任务配置已有任务记录，不能删除，也不能改 `taskType`、`targetValue`，只能停用（28.2） |
| CONTENT_NOT_STORED | 404 | 取审核记录的内容时原文已经不在：被自动拦截（`BLOCKED`）的记录没有保存原文；`COMPANION_NAME` 的待审记录对应的名字已被用户改过（记录的 `contentRef` 不等于当前 `User.companionNameRef`，2.5.1）（17.4） |
| PHONE_INVALID | 400 | 手机号无法解析或不是有效号码（23.3） |
| SMS_COUNTRY_NOT_SUPPORTED | 400 | 号码所在国家不在 `sms.allowed_country_codes` 里（23.3） |
| OTP_RESEND_TOO_SOON | 429 | 距上一次发送验证码不足 `sms.otp_resend_seconds`（邮箱验证码是 `email.otp_resend_seconds`）；`data` 为 `{"retryAfterSeconds":<剩余秒数>}`（23.3） |
| OTP_INVALID | 400 | 验证码错误（手机号 23.3，邮箱 2.2.1） |
| OTP_EXPIRED | 400 | 验证码已过期或已被作废（手机号 23.3，邮箱 2.2.1） |
| OTP_ATTEMPTS_EXCEEDED | 429 | 当前验证码错误次数达到上限，已作废，需重新发送（手机号 23.3，邮箱 2.2.1） |
| SMS_SEND_FAILED | 503 | 选中的短信通道发送失败（超时或供应商返回错误），没有可用的通道或模板，或全局每日发送上限已到（23.3、23.4）。号码级和 IP 级的发送次数超限用 `RATE_LIMITED`（429） |
| FEATURE_DISABLED | 404 | 功能未开启（手机号登录，23.1） |
| SUBSCRIPTION_VERIFY_FAILED | 400 | 购买凭证无效、商品不在映射里或包名不符（见 15.5） |
| SUBSCRIPTION_OWNED_BY_OTHER | 409 | 该订阅已绑定到另一个账号（见 15.2） |
| PURCHASE_VERIFY_FAILED | 400 | 额度购买凭证无效、购买已取消、数量不是 1、商品不在映射里、包名不符，或 Google 购买在入账前已被消耗（见 15.9） |
| PURCHASE_OWNED_BY_OTHER | 409 | 该额度购买已绑定到另一个账号（见 15.9） |
| INSUFFICIENT_CREDITS | 402 | 额度余额不足，或余额为负（见 15.9） |
| FEATURE_LIMIT_REACHED | 403 | 触达当前权益允许的功能上限，如形象/声音数量、每个形象的外观数（`avatar.looks_max`）、通话额度、文字额度（见 15.6、5.4、3.6）。`data` 按场景有这些形状：形象或声音数量（3.2）`{"feature":"AVATAR"|"VOICE","limit":"ASSET_COUNT","max":<上限>}`；建外观超限（3.6）`{"feature":"AVATAR_LOOK","limit":"LOOK_COUNT","max":<上限>}`；通话额度用完（4.1）`{"feature":"CALL","limit":"DAILY"|"MONTHLY","resetAt":"..."}` 或 `{"feature":"CALL","limit":"LIFETIME"}`，额度没有配置时 `{"feature":"CALL"}`（没有 `limit`、`resetAt`）；文字额度用完（5.4）`{"feature":"CHAT","limit":"DAILY"|"MONTHLY","resetAt":"..."}`，额度没有配置时 `{"feature":"CHAT"}` |
| MEMORY_SERVICE_ERROR | 502 | AvatarMemory 不可用：网络错误、超时、5xx，或它拒绝了我们的密钥（401）（见 16.1） |
| MEMORY_MODEL_CONFLICT | 409 | embedding 模型注册冲突：同名模型已注册但维度不同（见 16.3） |
| INVALID_DELETION_TOKEN | 400 | 网页删除确认令牌无效、过期或已用过（见 13.4） |
| INVALID_LANGUAGE | 400 | 会话语言不在 `chat.conversation_languages` 里（见 2.10、4.3） |
| AGENT_UNAVAILABLE | 503 | 发起会话时 dispatch 抛异常，或数字人 agent 没有加入房间、重发 dispatch 后仍然没有（见 4.1）；文字对话的 agent 接口没有配置、连不上、超时或出错（见 5.4，流内 `error` 事件也用它） |
| REQUEST_IN_PROGRESS | 409 | 同一个 `Idempotency-Key` 的上一个上传请求还在处理，稍后用同一个键重试（3.2） |
| RESOURCE_NOT_FOUND | 404 | 管理后台和其他接口里按 ID 找不到对象、且该对象没有自己的专用错误码时使用；`message` 写明对象类型 |
| INVALID_STATE | 409 | 对象当前的状态不允许这个操作（例如对已结束的对象再次结束）；`message` 写明当前状态，`data` 为 `{"status":"<当前状态>"}` |
| DUPLICATE_RESOURCE | 409 | 创建对象时唯一字段已存在（管理员用户名，不区分大小写；角色名；自定义权限码；投放账户 `code`；权益的 `priority`（15.3）；短信通道的 `channelCode`（23.4）；渠道的 `code` 和同一渠道的 `versionCode`（24.2、24.7）；服装和动作的 `key`（3.7、3.8））；`data.field` 写明是哪个字段（例如重复的投放账户 `code` 是 `"code"`，重复的短信通道是 `"channelCode"`） |
| CAMPAIGN_NOT_FOUND | 404 | 投放代码 `code` 不存在或投放账户已停用（10.4） |
| PRICE_CHANGED | 409 | 扣额度的请求（建外观 3.6、服装兑换 3.7、购买名额 15.9）的 `expectedCreditPrice` 与服务端此刻要扣的数额不一致（价格核对，见下面"扣额度请求的价格核对"）；`data` 为 `{"creditPrice":<此刻要扣的数额>}`；没有扣款、没有流水、没有创建任务或拥有记录，也不占用幂等键 |
| PACKAGE_PREPARING | 409 | 外观（或系统默认数字人的外观）还没有客户端所带 `rendererFormatVersion` 的 `READY` 驱动资源包：正在准备、上次准备失败还在退避中，或重试已用完；需要时后端已排了准备任务（不重复排）。带响应头 `Retry-After` 和 `data` `{"retryAfterSeconds":<秒>}`（取值见 3.9）。客户端先显示静态图，到时再请求（3.9） |
| RENDERER_FORMAT_UNSUPPORTED | 400 | 客户端所带的 `rendererFormatVersion` 不是任何一个启用的 `RendererModel` 的格式版本（3.9）：这个格式已经停用，或客户端发了不存在的值 |
| GENERATION_NOT_CONFIGURED | 503 | 形象生成的门槛配置（`generation.mouth_open_min_area`、`generation.mouth_open_min_brightness`，17.5，无默认值）有任一未配置，后端不向形象生成服务提交任务；上传形象（3.2）、新建外观（3.6）返回它，同时发后台告警 `GENERATION_CONFIG_MISSING`（17.4） |
| INTERNAL_ERROR | 500 | 服务端内部错误：本后端自己的数据库或缓存写入失败、未预料的异常，请求没有完成；`message` 不带内部细节，`data` 为 `null`。没有专用错误码的服务端错误都用它；客户端把它当可重试的错误（各接口另有规定的除外） |
| TEMPORARILY_UNAVAILABLE | 503 | 请求本身合法，但此刻给不出最终结果，稍后重试同一个请求会得到结果（例如同一个广告奖励的另一个请求还没提交完，22.6 第 3 步）；`data` 为 `null`。依赖服务不可用有各自的专用 503 码（`EMAIL_SEND_FAILED`、`SMS_SEND_FAILED`、`AGENT_UNAVAILABLE`、`GENERATION_NOT_CONFIGURED`），其他必需的依赖或配置不可用用 `DEPENDENCY_UNAVAILABLE`，也不用它 |
| METHOD_NOT_ALLOWED | 405 | 请求方法不支持；`data` 为 `null` |
| UNSUPPORTED_MEDIA_TYPE | 415 | 请求体的媒体类型不支持；`data` 为 `null` |
| DEPENDENCY_UNAVAILABLE | 503 | 必需的外部依赖（例如 Redis、设备校验服务）或必需的配置此刻不可用，请求被拒绝，不是请求本身有错；`data` 为 `null`。有专用 503 码的依赖（邮件、短信、agent、生成）仍用专用码；`TEMPORARILY_UNAVAILABLE` 仍只用于“请求合法、稍后重试同一个请求会得到结果” |

**扣额度请求的价格核对（通用规则，写在这里一次，各接口引用）**：配置里的价格、账号的 `avatar.look_free` 这类权益，都可能在客户端展示价格之后、用户点击之前变化；用户会被扣一个没有见过的数额。只有服务端能堵住这个窗口，而且必须在扣额度的请求本身里堵（单独加一个"价格还对吗"的接口，窗口还在）。
1. **每个扣额度的请求都带必填的 `expectedCreditPrice`**：整数，不小于 0，是用户看到的、这个请求总共要扣的额度，0 表示免费。缺少、不是整数或为负数 → 400 `INVALID_REQUEST`。目前有三个请求：`POST /api/avatars/{assetId}/looks`（3.6）、`POST /api/cosmetics/{itemId}/redeem`（3.7）、`POST /api/credits/spend`（15.9）。
2. **核对的位置**：在扣款的同一个事务里，用决定扣多少的同一段计算，排在幂等键查重和请求校验之后、余额检查之前。不一致 → 409 `PRICE_CHANGED`，`data` 为 `{"creditPrice":<此刻要扣的数额>}`；不扣款、不写流水、不创建任务或拥有记录，也不占用幂等键（客户端下一次尝试换新键）。
3. **一个共用的核对方法**：三个接口都调用它；以后新增任何要扣额度的功能也调用同一个方法，所以带价格的功能不可能不带这条规则上线。
4. **已完成的键**：同一个键已经完成过的请求，无论现在的价格是多少、重发的请求带的 `expectedCreditPrice` 是多少，都返回第一次的结果，不做任何比较（沿用各接口原有的幂等规则）。客户端对每件兑换的服装、每个功能加数量的名额购买各保存一个键，网络错误后用同一个键重发，所以价格在中间变过时，重发带的价格可以和第一次不同。已经拥有的服装仍是成功，不扣款，也不做比较。

### 1.5 配置与密钥清单

以下都是部署时的环境配置，不写进代码、不提交仓库；运营可调参数不在此列，见 17.5。

| 项 | 用途 |
|----|------|
| `LIVEKIT_URL`（对外地址）、`LIVEKIT_API_KEY`、`LIVEKIT_API_SECRET` | 发 token、dispatch、校验 webhook（4.1、4.2）；`LIVEKIT_URL` 同时作为响应里的 `serverUrl` |
| `LIVEKIT_AGENT_NAME` | dispatch 使用的 agent 名字，必须与 AvatarAgent 的同名环境变量一致，无默认值。AvatarAgent 的环境模板里当前填的是 `avatar-agent`，部署时两边填同一个值 |
| `JWT_SECRET`、`ADMIN_JWT_SECRET` | 用户与管理员两套签名密钥（1.1、17.2） |
| `INTERNAL_SIGNING_SECRET`、`PIPELINE_SIGNING_SECRET` | agent 写聊天记录（5.1）、管线监控上报（十四）的签名密钥（1.8），无默认值，缺失时启动失败 |
| `LLM_USAGE_SIGNING_SECRET` | agent 上报用量（14.2：LLM）的签名密钥（1.8，调用方标识 `llm-usage`），无默认值，缺失时启动失败 |
| `AVATARGEN_USAGE_SIGNING_SECRET`、`RENDER_USAGE_SIGNING_SECRET` | 形象生成服务、云端渲染服务上报用量（14.2）的签名密钥（1.8，调用方标识 `avatargen-usage`、`render-usage`），无默认值，缺失时启动失败 |
| `REFRESH_GRACE_ENC_KEY` | 加密暂存刷新令牌轮换宽限期内的新令牌对（2.6），AES-GCM 密钥，无默认值，不提交仓库；轮换它只会让宽限期内在途的刷新被当作复用检测处理 |
| `DASHSCOPE_PRICE_API_KEY` | 价格同步任务读阿里云 DashScope 价格接口（14.2）用的密钥，无默认值，不提交仓库；缺失时同步任务不运行并写告警 |
| `AGENT_CHAT_URL`、`AGENT_CHAT_SIGNING_SECRET` | 文字对话调用 AvatarAgent 的地址和签名密钥（1.8）（5.4 的 `POST /v1/chat/turn`），无默认值，不提交仓库；没有配置时 `POST /api/chat/messages` 在响应流开始前返回 503 `AGENT_UNAVAILABLE` |
| `AVATARMEMORY_URL`、`AVATARMEMORY_API_KEY`、`AVATARMEMORY_ADMIN_KEY` | API 密钥用于账号删除与导出、档位与模型指派；ADMIN 密钥用于档位配置与模型注册，两把不同，见第十六节 |
| `TTS_SERVICE_URL`、`TTS_ADMIN_API_KEY` | 声音克隆与合成服务（AvatarAgent 项目的 `tts_service`）的地址，以及注册、删除音色用的密钥（3.5、13.2）。地址指向 AvatarAgent 合成语音时用的同一个服务；密钥由合成服务持有，本后端持同一个值，无默认值，值由双方约定，不提交仓库 |
| `AVATAR_GEN_URL`、`AVATAR_GEN_SIGNING_SECRET` | 形象生成服务的地址，以及本后端调它的签名密钥（1.8，调用方标识 `backend-avatargen`）：形象生成、外部数据删除（3.5、13.2），无默认值，不提交仓库。人脸检测与年龄估计在形象生成服务里自己部署，本后端不需要额外凭证 |
| `RENDER_PACKAGE_SIGNING_SECRET` | 云端渲染服务取外观的片段和资源包（`GET /api/internal/looks/{lookId}/media`、`GET /api/internal/looks/{lookId}/package`，3.9）的签名密钥（1.8，调用方标识 `render-package`），无默认值，缺失时启动失败 |
| `POSTGRES_*`、`MONGO_URI`、`REDIS_URL` | 数据库与缓存 |
| `FCM_CREDENTIALS` | Firebase Admin SDK 服务账号（第八节） |
| `GOOGLE_CLIENT_IDS`、`APPLE_CLIENT_IDS` | 校验 ID token 的 `aud`（2.7）。Google：Android 客户端用 Credential Manager 请求 ID token 时，把 **Web 应用类型的客户端 ID** 作为 `serverClientId` 传入，令牌就是签发给这个 Web 客户端 ID 的，所以 `GOOGLE_CLIENT_IDS` 必须包含它（只配 Android/iOS 应用自己的客户端 ID 会让所有 Google 登录被拒）；iOS 若用自己的客户端 ID 取令牌，也一并加入 |
| `APPSFLYER_ENDPOINT_SECRET` | AppsFlyer 回传端点路径里的密钥（10.1），无默认值，不提交仓库 |
| `AF_PUSH_TOKEN_HEADER`、`AF_PUSH_TOKEN` | AppsFlyer 鉴权令牌头的名称（`Authorization` 或以 `X-` 开头）和值（10.1）；两个都配置时回传请求必须带，没有配置只看路径密钥，不提交仓库 |
| `ATTRIBUTION_TOKEN_ENC_KEY` | 加密存储投放账户的 Facebook 访问令牌的密钥（10.5），无默认值，不提交仓库 |
| `ADMIN_BOOTSTRAP_USERNAME`、`ADMIN_BOOTSTRAP_PASSWORD` | 创建第一个超级管理员（17.2） |
| `ADMIN_TOTP_ENC_KEY` | 加密存储管理员二次验证密钥用的密钥（17.2），无默认值，不提交仓库 |
| `SMS_CRED_ENC_KEY`、`OTP_HMAC_KEY` | 前者加密存储短信通道凭据，后者计算邮箱和手机号验证码的哈希（2.2.1、23.3），邮箱注册必需，无默认值，不提交仓库 |
| 审核服务、客服工具、邮件服务的凭证 | 见 11.2、十二、2.2.1、2.9，厂商选定后确定；邮件服务现在是注册必需的 |
| `FILE_STORAGE_*` | 1.1 的文件存储 |
| `DEPLOY_ENV` | `PRODUCTION` 或 `NON_PRODUCTION`，无默认值，缺失时启动失败。所有写着“生产环境……”的校验（`integrity.check_enabled`、`admin.totp_required`、审核服务未配置、`moderation.*_score` 等）都按它判断，不按 Spring profile 名称 |
| `ABUSE_HASH_KEY` | 计算 `RegistrationAudit`、`AuthEvent` 里 IP 哈希，`RegistrationAudit.deviceIdHash`，以及账号删除后留下的 `AbuseMarker.keyHash` 的密钥（2.11、13.5、17.4），无默认值，不提交仓库；轮换会使旧的防滥用标记失效 |
| Play Integrity 的服务账号与包名；iOS 的 App Attest 配置 | 游客凭据和所有新账号创建的设备校验（2.1、2.2、2.7、23.2）；`integrity.check_enabled` 为 `true` 时没有它们任何人都不能创建账号；具体凭证项以 Google、Apple 文档为准，**没有核实** |
| `APPLE_BUNDLE_ID`、`APPLE_IAP_KEY_ID`、`APPLE_IAP_ISSUER_ID`、`APPLE_IAP_PRIVATE_KEY` | Apple 订阅验证与状态查询（15.5、15.7），凭证项以 Apple 文档为准 |
| `GOOGLE_PLAY_PACKAGE_NAME`、`GOOGLE_SERVICE_ACCOUNT_JSON`、`GOOGLE_PUBSUB_AUDIENCE` | Google 订阅查询与 Pub/Sub 推送校验（15.5）；`GOOGLE_PLAY_PACKAGE_NAME` 还用于 Play 商店链接的校验（10.4、24.2），缺失时保存这类链接返回 400 `INVALID_REQUEST` |

### 1.6 限流

未登录、创建成本低的接口容易被刷（尤其 `POST /api/auth/guest`：每次调用都要请求外部的设备校验服务）。未登录接口按来源 IP 限流，已登录的敏感接口按账号限流（IP 取自受信任反向代理传入的头，部署方案决定），计数存 Redis：

| 接口 | 限制（`AppConfig` 键，默认值见 17.5） |
|------|------------------|
| `POST /api/auth/guest` | 每 IP 每小时 `ratelimit.guest_per_ip_per_hour`；另按 `deviceId` 每小时 `ratelimit.guest_per_device_per_hour` |
| `POST /api/auth/register`、`/google`、`/apple` | 每 IP 每小时 `ratelimit.register_per_ip_per_hour` |
| `POST /api/auth/email/otp/send` | 每 IP 每小时 `ratelimit.email_otp_per_ip_per_hour`；另有邮箱级限制（2.2.1） |
| `POST /api/auth/login` | 每 IP+邮箱 每分钟 `ratelimit.login_per_min`；另有按邮箱的失败次数限制和 IP 级跨邮箱限制（2.3） |
| `POST /api/auth/refresh` | 每 IP 每分钟 `ratelimit.refresh_per_min` |
| `POST /api/auth/password/reset-request` | 每 IP 每小时 `ratelimit.reset_per_ip_per_hour`；另按规范化邮箱每小时 `ratelimit.link_mail_per_email_per_hour`（不论邮箱是否存在；超出时仍返回成功但不发信，不泄露邮箱是否存在，2.9） |
| `POST /api/auth/password/reset` | 每 IP 每小时 `ratelimit.reset_confirm_per_ip_per_hour`（防止暴力猜重置令牌） |
| `POST /api/public/deletion-confirm` | 每 IP 每小时 `ratelimit.deletion_confirm_per_ip_per_hour`（防止暴力猜确认令牌） |
| 已登录的敏感接口：`POST /api/auth/password/change`、`POST /api/account/deletion`、`POST /api/account/deletion/cancel`、`POST /api/account/export`、`DELETE /api/account/sessions/{sessionId}`、`DELETE /api/account/sessions` | 每账号每小时 `ratelimit.sensitive_per_account_per_hour`（这六个接口共用一个计数器） |
| 所有已登录接口的兜底限制（不含本表已单独限流的接口和 `/api/internal/**`；游客凭据按 `deviceId` 计） | 每账号每分钟 `ratelimit.api_per_account_per_min`；超出 429 `RATE_LIMITED`。照 dramaBox 的限流拦截器按路径套用、用户接口按 uid 计 [核实 审计 13-41]；OWASP API Security 把“资源消耗不受限”列为风险 [推断，本次未核对原文] |
| `POST /api/internal/usage`（内部接口，不受上一行限制） | 每个调用方标识每分钟 `usage.rate_limit_per_min`；超出 429 `RATE_LIMITED`，带 `Retry-After`（整数秒）和 `data.retryAfterSeconds`（14.2） |
| `POST /api/public/likeness-complaints`（照片里的人投诉，11.6） | 每 IP 每小时 `ratelimit.likeness_complaint_per_ip_per_hour`（17.5 登记，默认 10，提议；键名和默认值形象渲染设计没有给，本行新定） |
| `POST /api/public/deletion-request` | 每 IP 每小时 `ratelimit.public_deletion_per_ip_per_hour`；邮箱路径另按规范化邮箱每小时 `ratelimit.link_mail_per_email_per_hour`（同重置密码，13.4） |
| `GET /go/{code}`（归因链接，不在 `/api` 下） | 每 IP 每小时 `ratelimit.attribution_click_per_ip_per_hour`；超限时仍然 302 跳转到商店，只是不记点击（10.4） |
| `POST /api/attribution/click`（落地页） | 每 IP 每小时 `ratelimit.attribution_click_per_ip_per_hour`（与 `GET /go/{code}` 共用） |
| `GET /api/public/attribution/pixels` | 每 IP 每小时 `ratelimit.attribution_click_per_ip_per_hour`（与点击接口共用，10.4） |
| `POST /api/attribution/claim` | 每 IP 每小时 `ratelimit.attribution_claim_per_ip_per_hour` |
| `POST /api/push-tokens`（游客凭据；账号令牌走上面的兜底限制） | 每 IP 每小时 `ratelimit.push_token_per_ip_per_hour` |
| `POST /api/push-tokens/unregister`（账号令牌或游客凭据） | 没有单独的限制，走上面的兜底限制（游客凭据按 `deviceId` 计） |
| 已登录的 `/api/admin/**` 接口 | 每个管理员 ID 每分钟 `admin.rate_limit_per_min`；超出 429 `RATE_LIMITED`（17.2） |
| `POST /api/chat/messages`（已登录） | 每账号每分钟 `ratelimit.chat_per_account_per_min`（5.4） |
| `POST /api/events` | 按 `deviceId` 和按账号各自每分钟 `events.rate_limit_per_min`（7.1）；不再计入上面的兜底限制 |
| `POST /api/ads/request`（账号令牌每账号，游客凭据每设备） | 30 次 / 60 秒（22.6，工程常量） |
| `POST /api/ads/track`（同上） | 60 次 / 60 秒（22.6，工程常量） |
| `GET /api/notifications`、`GET /api/notifications/unread-count`、`POST /api/notifications/read`、`POST /api/notifications/read-all`（每账号） | 分别 60、60、30、10 次 / 60 秒（25.4，工程常量）；不再计入兜底限制 |
| `POST /api/support/feedback`（已登录） | 每账号每小时 `support.rate_limit_per_hour`（默认 10，出处 12） |
| `POST /api/public/invite-events`（落地页） | 每 IP 每小时 `ratelimit.invite_event_per_ip_per_hour`（9.2） |
| `POST /api/auth/phone/otp/send` | 每 IP 每小时 `ratelimit.otp_per_ip_per_hour`；另有号码级限制（23.3） |
| `POST /api/auth/phone/login` | 每 IP+号码 每分钟 `ratelimit.login_per_min`（与邮箱登录共用同一个键，邮箱登录按 IP+邮箱）；另有验证码错误次数限制（23.3） |
| `GET /api/app-version`、`GET /api/config/client` | 每 IP 每分钟 `ratelimit.public_config_per_min`（17.5 登记，默认 60，提议）；响应有服务端缓存（24.3、26.1），限流只防滥用 |
| `POST /notify/sms/{channelCode}/report`（供应商回调，不在 `/api` 下） | 每 IP 每分钟 `ratelimit.sms_dlr_per_min`（17.5 登记，默认 300，提议）；反向代理必须把 `/notify/` 转发到本后端 |
| `POST /api/subscriptions/apple/notifications`、`POST /api/subscriptions/google/notifications`（商店通知，不带用户凭据） | 两个接口各按来源 IP 每 60 秒 600 次（15.5，工程常量）；超出 429 `RATE_LIMITED` |

超出返回 429 `RATE_LIMITED`（供应商回调超限同样返回 429，供应商会重试）。所有接口只通过 HTTPS 提供，明文 HTTP 不接受（密码、令牌、验证码都在请求里）。

### 1.7 服务器下发的链接的校验规则

客户端对服务器下发的所有链接用同一条严格规则：不符合的链接，客户端当作"未配置"并隐藏入口，用户看不到任何提示。所以后端在**保存时**（接口校验，后台表单做同样的前端校验）对下面所有链接应用同一条规则，运营才会在保存时发现问题，而不是上线后链接悄悄消失。适用范围：26.2 的各个 `URL` 键、推送模板与手动推送任务的 `linkTarget`（`linkType=URL`，8.3）、站内通知的 `linkTarget`（25.2）、广告素材的 `clickTarget`（`OPEN_URL`）、上传文件的对外基址 `upload.public_base_url`（广告素材和 APK 的地址由它拼出，22.9）、应用版本的 `storeUrl`（24.2）、归因的商店链接和链接根地址（`attribution.*`，10.4）、邮件里链接的根地址 `email.link_base_url`（17.5）。

规则（以 Android 仓库 `AvatarApp-android/android/README.md` 的 "Link rule" 一节为准，客户端的正则是 `HttpsLink.PATTERN`；整个值一次匹配，下面是它的文字版）：
- 以小写 `https://` 开头，前面不能有空格或其他字符；大写 `HTTPS://` 拒绝。
- 主机是 ASCII 字母、数字、`.`、`_`、`-`，以字母或数字开头（国际化域名只能写成 punycode，`xn--…`），或者是方括号括起来的 IPv6 地址；不能为空，不允许用户信息（`user@host`）。
- 端口可选，1 到 5 位数字；`https://host:/x`（空端口）拒绝。
- 路径、查询、片段可选，以 `/`、`?`、`#` 开头，只允许可打印 ASCII（`!` 到 `~`），不含反斜杠；不允许空格、制表符、换行、控制字符、双向控制字符和其他不可见字符；非 ASCII 必须百分号编码（例如 `caf%C3%A9`）。
- 配置类链接（26.2 的 URL 键、推送与站内通知的 URL 目标）总长度 ≤ 2048 个字符，超过 → `INVALID_REQUEST`。

不符合 → 400 `INVALID_REQUEST`，`data.details` 里写明原因（例如 `PUT /client-config/privacyPolicyUrl` 里 `en` 的值路径含非 ASCII 字符：`{"ref":"en","reason":"INVALID_PATH"}`，`ref` 和 `reason` 的定义见 1.4）。`DEEP_LINK`（自定义 scheme）、`mailto` 不适用此条，各有各的规则（22.9、`EMAIL` 类型）；`storeUrl` 既要符合本条，也要符合 24.2 的商店链接规则（更严）。


### 1.8 内部服务间调用的认证

服务间调用不使用用户 JWT，也不使用固定密钥头，而是对**每个请求**做 HMAC-SHA256 签名：数字人 agent 调本后端的 `POST /api/internal/messages`（5.1）、`POST /api/internal/pipeline-metrics`（14.1）和 `POST /api/internal/usage`（14.2），本后端调 AvatarAgent 的 `POST /v1/chat/turn`、`POST /v1/chat/ingest`（5.4），本后端调形象生成服务（3.5），云端渲染服务调本后端的 `GET /api/internal/looks/{lookId}/media`、`GET /api/internal/looks/{lookId}/package`（3.9）。照 dramaBox 的做法：HMAC 签名、每个对接方一把独立密钥、合作方回调再加时间窗和 nonce 防重放 [核实 审计 B7、14-02、14-03，dramaBox 侧我没有重读源码]。`AVATARMEMORY_API_KEY`、`AVATARMEMORY_ADMIN_KEY` 是 AvatarMemory 已实现的密钥方案，不在这个变更范围内。

**请求头：**

| Header | 说明 |
|--------|------|
| `X-Key-Id` | 调用方标识，每个标识一把独立密钥（最小权限，泄露一个不影响另一个）：`agent-messages`（agent 写聊天记录，密钥 `INTERNAL_SIGNING_SECRET`）、`pipeline-metrics`（管线指标上报，密钥 `PIPELINE_SIGNING_SECRET`）、`backend-chat`（本后端调 AvatarAgent，密钥 `AGENT_CHAT_SIGNING_SECRET`）、`llm-usage`（LLM 用量上报，密钥 `LLM_USAGE_SIGNING_SECRET`）、`backend-avatargen`（本后端调形象生成服务，密钥 `AVATAR_GEN_SIGNING_SECRET`，3.5）、`render-package`（云端渲染服务取外观的片段和资源包，密钥 `RENDER_PACKAGE_SIGNING_SECRET`，3.9）、`avatargen-usage`（形象生成服务上报用量，密钥 `AVATARGEN_USAGE_SIGNING_SECRET`，14.2）、`render-usage`（云端渲染服务上报用量，密钥 `RENDER_USAGE_SIGNING_SECRET`，14.2）。`llm-usage` 的名字沿用 |
| `X-Timestamp` | UTC 秒级时间戳 |
| `X-Nonce` | 随机串，至少 16 字节，base64url |
| `X-Signature` | 小写十六进制的 `HMAC-SHA256(secret, canonical)` |

`canonical` 是下面五项用换行符（`\n`）连接的字符串：HTTP 方法（大写）、请求路径加查询串（原样）、`X-Timestamp`、`X-Nonce`、请求体原始字节的 SHA-256（小写十六进制；没有请求体时是空字节串的 SHA-256）。

**验证（接收方）：** ① `X-Key-Id` 必须已登记，且该接口允许这个标识调用；② `X-Timestamp` 与当前时间相差不超过 `internal.signature_window_seconds`（300）；③ 用该标识的密钥重算签名，**常量时间比较**；④ nonce 用 Redis `SET NX` 记录，TTL 取窗口的两倍，已出现过的视为重放。任何一步失败都返回 401 `INVALID_SIGNATURE`，响应不透露是哪一步失败。密钥从环境变量读取，**没有默认值，缺失时启动失败**（`AGENT_CHAT_SIGNING_SECRET` 与 `AGENT_CHAT_URL` 例外：它们缺失时文字对话在运行期返回 503 `AGENT_UNAVAILABLE`，5.4）（dramaBox 的回调密钥有写死的默认值 [审计 11-10]）。收到的请求体要保留原始字节用于计算摘要，不能先解析再重新序列化。

---

### 1.9 首尾空白的定义

本文档里所有“去掉首尾空白”“去空白”“trim”，指的都是同一个字符集合：**Python `str.strip()` 不带参数时去掉的字符，共 29 个码点**：U+0009 到 U+000D、U+001C 到 U+001F、U+0020、U+0085、U+00A0、U+1680、U+2000 到 U+200A、U+2028、U+2029、U+202F、U+205F、U+3000 [核实 用 Python 的 `str.isspace()` 枚举全部码点得到这 29 个；合成服务在 `AvatarAgent/tts_service/registry.py:99` 用 `transcript.strip()` 处理参考录音原文，所以后端存下去的值必须是它再 `strip()` 一次也不变的值]。零宽空格 U+200B、BOM U+FEFF、方向标记等格式字符（类别 `Cf`）**不在这个集合里**，不会被去掉（2.4 的邀请码规范化是先单独删除 `Cf` 字符，再按这里的定义去首尾空白）。

实现要求：服务端和客户端都**不能直接用语言自带的 trim**，要按上面的码点集合自己实现（只去首尾，不动中间）。原因：Java 的 `String.trim()` 只去码点不大于 U+0020 的字符，会留下 U+0085、U+00A0、U+3000 等；Java 的 `String.strip()` 按 `Character.isWhitespace` 判断，不去 U+0085，也不去不间断空格 U+00A0、U+2007、U+202F；Kotlin 的 `trim()` 去的字符比 Java 的 `strip()` 多（包含不间断空格），但同样不去 U+0085 [推断，来自对这三个函数定义的了解，未在运行环境里逐码点枚举；实现时用 29 个码点的测试用例核对即可]。两端集合不一致，会让同一段文字在客户端算“没超长”、在服务端算“超长”，或者去空白后变成空值而被合成服务拒绝。

## 二、账号模块

### 2.1 游客会话凭据

```
POST /api/auth/guest
```

**鉴权：** 无需登录

**说明：** 支持"先体验、再决定是否注册"。**游客没有账号**：不创建 `User` 记录，没有账号 ID，没有刷新令牌，服务端不为游客保存任何内容（聊天记录、养成数据、记忆、资产、订阅都没有）。游客只拿到一个**游客凭据**（JWT，有效期同账号访问令牌，默认 24 小时），用来和默认数字人通话（4.3）。依据：dramaBox 的登录用户按 uid、游客按设备号 `device_id` 记录，游客的 uid 为 0、没有账号（`DramaverseDemo/docs/superpowers/specs/2026-09-04-ad-system-design.md:162-170`；游客是否带令牌没有逐条核实）；ChatGPT 未登录时同样不保存对话，登录后也不会关联到账号（OpenAI 帮助中心 "The ChatGPT home page"，只读了搜索摘要，没有读原页）。游客使用服务器下发的系统默认数字人（`DefaultAvatar`，用 `GET /api/default-avatar` 取，渲染方式与用户的形象相同，3.10）和 agent 的默认音色（4.3），不需要走第三节的上传流程。

**请求体：**
```json
{"deviceId":"7b0f3c4e-...","integrityToken":"...","platform":"ANDROID","channel":"play"}
```

| 字段 | 必须 | 说明 |
|------|------|------|
| deviceId | 是 | 客户端生成并持久化的设备 UUID，与事件接口（7.1）里的 `deviceId` 是同一个值 |
| integrityToken | 是（`integrity.check_enabled` 为 `false` 时可省略） | 设备校验令牌：Android 是 Play Integrity 令牌，iOS 是 App Attest 的凭据（Google 官方文档把 Play Integrity 令牌推荐给"检测伪造设备攻击后端"这个场景，`developer.android.com/identity/user-data-ids`）。**令牌绑定到具体请求**：客户端取令牌时把 `requestHash` 设为 `SHA-256("<用途>:<deviceId>")` 的小写十六进制（用途：游客创建 `GUEST`、创建账号 `REGISTER`、认领 `CLAIM`），服务端按同一公式重算，与令牌里的 `requestDetails.requestHash` 比对，不一致按校验失败处理；Google 文档：`requestHash` 把令牌绑定到具体请求，用请求参数的摘要，最长 500 字节，不设的话令牌只绑定设备、不绑定请求 [核实 developer.android.com Play Integrity 标准请求，2026-10-08 读取]。iOS 的 App Attest 绑定方式没有核实。服务端的其余校验细节（判定字段、重放保护）**没有核实，开发时按 Google、Apple 文档确定**（19.2）。**校验按请求里声明的渠道（`X-Channel`，24.7）分口径**：Android 的 `play`：设备完整性含 `MEETS_DEVICE_INTEGRITY`，应用被 Play 识别，包名等于 Play 上的包名；`direct`（官网直装，24.7）：设备完整性含 `MEETS_DEVICE_INTEGRITY`，包名和签名证书摘要等于官网安装包的（部署时配置），不要求被 Play 识别；渠道缺失或不是这两个值时，任一口径满足即通过；iOS 口径不变。非 Play 安装的 `direct` 包在设备可信时会得到什么应用识别结果，Play Integrity 文档没写，已列为待核实（19.2）；真机实测若得不到包名和证书摘要，`direct` 口径无法实现，要回来改契约，不能放宽成只看设备完整性。校验失败或设备不支持（模拟器、没有 Google 服务，或按所属口径不合格的安装包）返回 403 `DEVICE_INTEGRITY_FAILED`，宁可拒绝，不放行；这样的设备不能当游客用，也不能创建账号（2.2、2.7、23.2 创建账号同样要求设备校验），只能登录已有账号（邮箱登录不要求设备校验，2.3）。非生产环境可以把 `integrity.check_enabled`（17.5）设为 `false` 跳过校验，生产环境不允许设为 `false` |
| platform | 是 | `ANDROID` / `IOS` |
| channel | 否 | 客户端构建时写死的渠道码（24.7），不符合 `^[a-z0-9_-]{2,32}$` 的丢弃；存入 `GuestDevice.channelCode`（只在第一次记入） |

**逻辑：**
1. 校验 `integrityToken`（`integrity.check_enabled` 为 `false` 时跳过），不通过返回 403 `DEVICE_INTEGRITY_FAILED`，不签发凭据。
2. 按 `deviceId` 的 SHA-256 查找 `GuestDevice`（18），没有则创建并写 `firstSeenAt`（并发的同一 `deviceId` 插入撞主键就重读该行，按已有行处理），已有则更新 `lastSeenAt`。**额度属于这条设备记录**：同一 `deviceId` 反复调用本接口拿不到新的额度。新建记录时把当时的 `guest.call_minutes_total` × 60 记为 `grantedSeconds`；那时还没有配置的，`grantedSeconds` 留空，配置之后在本接口、`GET /api/guest/quota` 或发起会话时记入当时的值，**记入用条件更新**（`WHERE grantedSeconds IS NULL`），并发的几处只有一个写入成功，其余重读，所以发放值不会被覆盖。**额度在发放时就固定**：运营之后修改 `guest.call_minutes_total`，只影响之后发放的设备，已发放的 `grantedSeconds` 不变（做法同发放额度的通行方式：Stripe 的 Credit Grant 把发放的额度记录成带金额的对象，Orb 的试用额度在发放时记入账本，来源是搜索摘要，没有读原页）。
3. 签发游客凭据：JWT，声明含 `typ=guest`、`deviceId`、`exp`，没有账号 ID，有效期取 `auth.access_ttl_minutes`（2.6），用与账号访问令牌相同的签名密钥 `JWT_SECRET`（1.5），靠 `typ=guest` 区分。需要账号的接口收到 `typ=guest` 的凭据一律返回 403 `REGISTRATION_REQUIRED`，所以它不能被当作账号令牌使用。

**响应：**
```json
{"code":"200","message":"success","data":{"token":"...","expiresIn":86400,"callSecondsRemaining":600}}
```

`callSecondsRemaining` 是该设备剩余的游客通话额度（秒）= `max(0, grantedSeconds − usedSeconds − 进行中的游客会话已用秒数)`（公式同下面的 `GET /api/guest/quota`）；设备没有额度（`grantedSeconds` 为空或 0，即运营没有配置 `guest.call_minutes_total`，17.5）时为 0，游客不能通话。凭据过期后（任何接口返回 401 `INVALID_TOKEN`），客户端重新调用本接口。

**游客凭据能调用的接口**，其余需要账号的接口一律返回 403 `REGISTRATION_REQUIRED`（`data: null`），客户端据此引导用户注册或登录：

| 接口 | 说明 |
|------|------|
| `POST /api/sessions` | 游客路径，4.3 |
| `GET /api/guest/quota` | 返回 `{"callSecondsRemaining":600}`，客户端在通话结束后和打开页面时读取 |
| `POST /api/events` | 7.1：游客凭据按匿名处理，只记 `deviceId` |
| `POST /api/push-tokens`、`POST /api/push-tokens/unregister` | 游客推送令牌，8.1：游客只收运营发的公告 |
| `GET /api/ads/config`、`POST /api/ads/request`、`POST /api/ads/track` | 游客广告，22.1：只有 `app_open`、`call_end` 两个广告位，没有奖励 |
| `GET /api/config/client`、`GET /api/app-version` | 本来就不需要登录 |
| `GET /api/default-avatar` | 系统默认数字人的外观、标准图和片段下载地址，3.10 |
| `GET /api/renderer-models`、`GET /api/actions` | 渲染模型和动作目录（3.9、3.8），游客要在本地渲染默认数字人 |
| `GET /api/looks/{lookId}/media`、`GET /api/looks/{lookId}/package` | 只限当前生效的 `DefaultAvatar` 的外观（3.9）；其他 `lookId` 返回 404 `ASSET_NOT_FOUND` |
| 注册与登录接口（2.2、2.3、2.7、23.2） | 本来就不需要登录；请求带着游客凭据时凭据被忽略 |

`GET /api/guest/quota` 只接受游客凭据：没有令牌或令牌无效返回 401 `INVALID_TOKEN`，账号令牌返回 403 `GUEST_ONLY`（账号没有游客额度）。`callSecondsRemaining` = `grantedSeconds` − `usedSeconds` − 进行中的游客会话已经用掉的秒数（算法同账号额度，15.6），不小于 0。`grantedSeconds` 为空且 `guest.call_minutes_total` 已配置时，本接口同样先记入当时的值（规则同 4.3 的第 1 步），所以这里报的额度和发起会话时判断的一致；两处都没有配置时报 0，游客不能通话。

**重装应用可以重置额度，这个缺口接受**：`deviceId` 是客户端生成的 UUID，存在应用的私有存储里，卸载重装后是新的 UUID，对应新的 `GuestDevice` 和新的额度。Android 不允许应用读取真正的硬件标识（MAC 只有系统应用能读；IMEI 和序列号从 Android 10 起需要特权；Google 官方文档 `developer.android.com/identity/user-data-ids`）。该文档对"防止绕过内容限制"的建议就是用 GUID：用户要绕过必须重装应用，"这个负担足以阻止大多数人"。所以防护是 `deviceId`、Play Integrity 校验、小额度和创建限流（1.6），不追求 100%；`guest.call_minutes_total` 要按"重装就能重置"设小。没有 Google 服务的设备过不了 Play Integrity，拿不到游客凭据，也不能创建账号，只能登录已有账号，这是覆盖范围的代价（launch-todo）。

### 2.2 注册

```
POST /api/auth/register
```

**鉴权：** 无需登录。请求带着游客凭据（2.1）时，凭据被忽略；带着已注册账号的登录令牌时返回 409 `ALREADY_REGISTERED`，不允许已注册账号"再注册一次"。**无需登录的注册、登录接口收到无效、过期或已作废的令牌，一律当作没带，不报 401**：只有令牌通过 2.6 的完整检查（签名、`exp`、`aud`、`sid`、账号状态）才算“已登录”。

**请求体：**
```json
{"email":"user@example.com", "emailCode":"123456", "password":"xxxxxxxx", "integrityToken":"...", "inviteCode":"K7M2Q9XD", "deviceId":"7b0f3c4e-...", "client":{"platform":"ANDROID","appVersion":"1.2.0","deviceName":"Pixel 8"}}
```

| 字段 | 必须 | 说明 |
|------|------|------|
| email | 是 | 规范化后（2.2 下面）符合简化的 addr-spec：含且仅含一个 `@`，本地部分和域名都非空，域名至少含一个 `.`，总长不超过 254 **字节**（规范化后按 UTF-8 编码计字节数，不是字符数也不是码点数；254 是 RFC 5321 对邮箱地址路径长度的限制，该限制以字节计 [推断，来自对 RFC 5321 4.5.3.1.3 的记忆，未重读原文]；纯 ASCII 地址的字节数等于字符数）；否则 400 `INVALID_REQUEST` |
| emailCode | 是 | 先调 `POST /api/auth/email/otp/send`（2.2.1）收到的验证码，证明这个邮箱属于调用方 |
| password | 是 | 最少 8 位，最多 `auth.password_max_length`（128）位；允许任意字符（含空格和 Unicode），不设大小写、数字、符号的组成规则；超出范围返回 400 `INVALID_REQUEST` |
| integrityToken | 是 | 设备校验令牌，规则同 2.1（用途 `REGISTER`）；`integrity.check_enabled` 为 `false` 时可省略 |
| inviteCode | 否 | 见2.4 |
| deviceId | 是 | 同 2.1 的 `deviceId`；缺失返回 400 `INVALID_REQUEST`。用于记录游客设备转注册（见下）和多开检测（17.4） |
| client | 否 | 见下面的 `client` 对象 |

**核心逻辑：**
- 注册就是**全新注册**，创建一条 `User` 记录；**不携带游客期间的任何内容**——游客在服务端没有保存任何内容（2.1），所以没有需要迁移或合并的数据；游客额度（按设备）和终身额度（按账号）互相独立，注册后账号有自己的终身额度。
- **邮箱注册必须先验证邮箱属于调用方。** 校验顺序：缺 `deviceId` 返回 400 `INVALID_REQUEST`（先于一切，设备校验要用它算 `requestHash`）→ 设备校验（`integrityToken`，规则同 2.1，用途 `REGISTER`，缺失或不通过都返回 403 `DEVICE_INTEGRITY_FAILED`；`integrity.check_enabled` 为 `false` 时跳过）→ 字段与引用校验（**除邮箱唯一性（`EMAIL_TAKEN`，在验证码之后）外，所有不依赖验证码的校验都在验证码被消耗之前**：缺 `emailCode`、邮箱格式、密码长度返回 400 `INVALID_REQUEST`，`inviteCode` 格式不对或不存在返回 400 `INVALID_INVITE_CODE`；这样用户改正输入后可以用同一个验证码重试，不必重新等验证码）→ 验证码校验并消耗（错误 `OTP_INVALID`、`OTP_EXPIRED`、`OTP_ATTEMPTS_EXCEEDED`）→ 邮箱唯一（冲突 `EMAIL_TAKEN`，此时调用方已经证明拥有这个邮箱，所以不泄露邮箱是否已注册）→ 创建账号，`User.emailVerifiedAt` 置当前时间。验证码在 Redis 里，不参与数据库事务：验证码消耗之后创建账号失败（`EMAIL_TAKEN`，或数据库错误）时验证码已经作废，用户重新取码；接受这一点（`EMAIL_TAKEN` 时用户本来就要换邮箱）。没有邮箱验证，别人可以用你的邮箱抢先注册（账号预先劫持），2.7 的自动绑定规则也就不成立。邮箱一律先规范化再比较和存储，**规范化是两步，顺序固定：先去首尾空白（按 1.9 的集合），再把 ASCII 字母 A–Z 转成 a–z，其他字符一律不变**（不用语言自带的转小写函数：Java、Kotlin 的 `toLowerCase()`/`lowercase()` 是完整的 Unicode 映射，并且带区域设置，土耳其语环境里 `I` 会变成 `ı`，`İ` 会变成两个码点，同一个地址在不同设备上得到不同结果；ASCII 专用转换在服务端和客户端结果一致。非 ASCII 字母不转换，所以只有大小写不同的非 ASCII 地址会被当作两个地址，它们都要通过邮箱验证码证明拥有这个邮箱才能注册，不构成抢注，不另作处理）。254 字节的限制和上面的格式检查都在规范化之后做。规范化结果用于：`EMAIL_TAKEN` 的唯一性、`User.email`、2.3 登录、2.9 重置、2.2.1 验证码都用同一个规范化结果，不对 Gmail 的点号和加号别名归一（会误伤真实用户）。
- **密码存储**：用 Argon2id（内存 19 MiB、迭代 2、并行度 1，是 OWASP Password Storage Cheat Sheet 列出的最低推荐配置之一：m=19456 KiB、t=2、p=1），参数写在哈希串里。**所有收到密码的地方**（注册、登录、`password/change` 的新旧密码、`password/reset`、13.1 和 13.3 的重新验证）都按同一个顺序处理：先做 Unicode NFKC 规范化，再检查长度（按规范化后的 Unicode 码点计，最少 8、最多 `auth.password_max_length`），再哈希，不截断。超出最大长度的输入在哈希之前拒绝（注册、改密码、重置返回 400 `INVALID_REQUEST`；登录和重新验证返回 401 `INVALID_CREDENTIALS`，不做哈希）；少于 8 位只在设置密码时检查，登录不检查。登录成功时发现哈希参数低于当前配置，就用当前参数重新哈希并保存。
- **可选的 `client` 对象**：所有登录和注册请求（2.2、2.3、2.7、23.2）都可以带 `{"platform":"ANDROID","appVersion":"1.2.0","deviceName":"Pixel 8","channel":"play"}`（`channel` 是渠道码，24.7，创建账号时记入 `User.channelCode`，只记第一次、之后不变；`platform` 同样在创建账号时记入 `User.registerPlatform`，只记第一次，请求没带或不合法则为空，统计里归 `unknown`，17.6），存在这条登录链的 `RefreshToken` 上，供设备列表显示（2.9）；`platform` 取 `ANDROID`、`IOS`，`deviceName` 不超过 64 个字符并去掉控制字符。不合法的 `client`（取值不在范围、超长）不拒绝请求，丢弃该字段。刷新（2.6）不带 `client`，每次轮换出的新 `RefreshToken` 行从上一条复制这三个字段。
- 注册成功后，给这个账号生成一个**属于它自己的邀请码**（供分享给别人；在创建账号的同一个事务里生成，冲突重试用尽就整体回滚，所以账号一定有码）。**邀请记录**：请求带 `inviteCode` 且校验通过（2.4）时，在创建账号、写完 `RegistrationAudit` 之后，于同一个数据库事务里创建 `InviteRecord`（`rewardStatus=PENDING`）；`invite.reward_trigger=REGISTER` 时在这个事务里评估奖励（9.1，同设备检查读 `User.registerDeviceHash`，这一列在插入 `User` 行的同一条语句里写入）。所有创建新账号的路径（本节、2.7、23.2）都按这条处理。新建账号时还要按 13.5 查防滥用标记：命中则 `User.lifetimeGrantSeconds`、`lifetimeUsedSeconds`、`inviteRewardedCount` 取标记里的值，被邀请人命中 `inviteeRewarded` 时 `User.priorInviteeRewarded` 置 true（评估时据此记 `NOT_ELIGIBLE`、`PRIOR_ACCOUNT`，9.1、13.5）。
- **设备转注册标记**：请求带 `deviceId` 且对应的 `GuestDevice`（18）存在、`convertedAt` 为空时，写 `convertedAt` 为当前时间、`convertedAccountId` 为新账号 ID，只记第一次；`GuestDevice` 不存在或已转过，不报错也不改。所有创建新账号的路径（本节、2.7、23.2）都按这条处理，也都要求带 `deviceId`（缺失返回 400 `INVALID_REQUEST`）。统计用（17.6）。**自建归因关联**：`AttributionRecord.deviceId` 等于 `SHA-256(deviceId)`（注意是 SHA-256，不是 `registerDeviceHash` 那个 HMAC）的、`accountId` 为空的 `AttributionRecord`（`source=SELF`，10.4）回填这个账号并写 `registeredAt`，只填第一次。**注册审计**：创建账号的同时写一条 `RegistrationAudit`（18，供 17.4 的多开检测用），并把同一个设备 HMAC 哈希写进 `User.registerDeviceHash`（13.5 删除账号时用它写设备标记，审计行到期被清理后它仍在），所有创建新账号的路径都写。

**响应：**
```json
{"code":"200","message":"success","data":{"accountId":"...","token":"...","refreshToken":"...","expiresIn":86400}}
```

`token` 是 access token，`expiresIn` 是它的有效秒数；`refreshToken` 见 2.6。**2.2、2.3、2.6（刷新）、2.7 的响应都带 `accountId`、`token`、`refreshToken`、`expiresIn` 四个字段**（刷新响应带 `accountId` 让客户端能核对令牌属于哪个账号；第三方登录可能命中另一个已有账号，客户端要从响应里取账号 ID）。

### 2.2.1 邮箱验证码

```
POST /api/auth/email/otp/send
```

**鉴权：** 无需登录。**请求体：** `{"email":"user@example.com"}`（目前只有注册一种用途，所以没有 `purpose`）。**响应：** `{"code":"200","message":"success","data":{"expireSeconds":600,"resendSeconds":60}}`。

- 验证码的生成、存储、校验规则与手机号验证码相同（23.3）：6 位数字，`SecureRandom`；Redis 只存带密钥的哈希（HMAC-SHA256，用 `OTP_HMAC_KEY`，两种验证码共用），不存明文；比较用常量时间；验证成功后立即删除。
- 绑定 `(REGISTER, 规范化邮箱)`：规范化规则见 2.2。有效期 `email.otp_ttl_seconds`（600）；同一 `(REGISTER, 邮箱)` 两次发送间隔 ≥ `email.otp_resend_seconds`（60），否则 429 `OTP_RESEND_TOO_SOON`（`data.retryAfterSeconds`）；当前验证码前 `email.otp_max_attempts`（5）减 1 次错误返回 `OTP_INVALID`，第 5 次错误时作废并返回 `OTP_ATTEMPTS_EXCEEDED`，之后没有未决验证码，再提交返回 `OTP_EXPIRED`（规则同 23.3），重新发送会替换旧验证码并把错误次数清零；同一邮箱滚动 24 小时内 ≤ `email.max_per_address_per_day`（10），同一 IP 每小时 ≤ `ratelimit.email_otp_per_ip_per_hour`（20），超限 429 `RATE_LIMITED`（防止用本接口向任意邮箱发垃圾邮件）。
- **不管邮箱是否已注册都照常发送**，响应一致，不泄露邮箱是否已注册；已注册的邮箱在注册提交、验证码通过之后才返回 `EMAIL_TAKEN`（2.2）。
- 通过 `EmailSender` 发送（2.9），失败或邮件服务商没有配置返回 503 `EMAIL_SEND_FAILED`。验证码邮件只有英文一份，不按语言选模板（验证码靠数字识别，不依赖用户的语言能力）。模板存在数据库的 `EmailTemplate`（`subject`、`body`），代码里带一份默认文案，后台可以编辑和恢复默认（17.4 的"邮件模板"）。验证码邮件的 `templateCode` 是 `REGISTER_CODE`：`subject` 1 到 200 个字符，`body` 必须含 `{code}`，可用占位符 `{code}`、`{minutes}`（有效分钟数）、`{appName}`（取 `app.display_name`，17.5），正文不含链接。系统里所有邮件目前都只有英文一份、都走 `EmailTemplate`：密码重置邮件是 `PASSWORD_RESET`（2.9），网页删除确认邮件是 `DELETION_CONFIRM`（13.4），改密码或重置密码后的通知邮件是 `PASSWORD_CHANGED`（2.9），照片里的人投诉的确认邮件是 `LIKENESS_COMPLAINT_RECEIVED`（11.6），占位符和必含项见 17.4。
- 日志不记验证码，不记完整邮箱（只记掩码）。
- 校验发生在注册提交时（2.2），不单设"校验验证码"的接口。

### 2.3 登录

```
POST /api/auth/login
```

**鉴权：** 无需登录

**请求体：** `{"email":"...", "password":"...", "client":{"platform":"ANDROID","appVersion":"1.2.0","deviceName":"Pixel 8"}}`（`client` 可选，2.2）

**响应：** `{"code":"200","message":"success","data":{"accountId":"...","token":"...","refreshToken":"...","expiresIn":86400}}`

登录时账号状态为 `BANNED` 返回 `ACCOUNT_BANNED`，为 `DELETING` 返回 `ACCOUNT_DELETING`（见 2.8）；为 `PENDING_DELETION` 照常登录成功（凭据已验证），之后的请求按 2.8 处理；**先验证密码，通过后才返回这两个码**，不知道密码的人看不到账号状态。

**防暴力破解**（OWASP Authentication Cheat Sheet 的 Login Throttling 和统一错误响应两节）：
- 失败计数按**提交的规范化邮箱**记，不论这个邮箱对应的账号是否存在（否则 429 会泄露邮箱是否存在）。固定窗口，从第一次失败起算 `auth.login_failure_window_minutes`（15）；窗口内密码错误达到 `auth.login_max_failures_per_account`（10）次后，窗口剩余时间内该邮箱的邮箱密码登录一律返回 429 `RATE_LIMITED`（`data.retryAfterSeconds`），连正确密码也拒绝；被拒绝的请求不计数、不延长窗口；窗口结束计数清零，`password/reset` 成功也清零（2.9）。这是限速不是永久锁定，但**它允许别人持续阻止这个邮箱的密码登录**：攻击者每 15 分钟发 10 次错误请求就够了，低于下面的 IP 限制。这是 OWASP 指出的账号锁定的代价，接受它；受影响的用户在此期间可以用 Google、Apple、手机号登录（账号有这些方式的话），或走密码重置（2.9，不经过本接口，成功后计数清零）。
- 同一 IP 每小时跨邮箱的登录请求 ≤ `ratelimit.login_per_ip_per_hour`（100），防止对大量账号试同一个常见密码（密码喷洒）。
- 邮箱不存在、或账号存在但没有邮箱密码（只用 Google、Apple 或手机号登录）时，也做一次与真实校验同等成本的假哈希，响应时间不暴露这些情况；"邮箱不存在"和"密码错误"返回同一个 401 `INVALID_CREDENTIALS`、同一句 `message`。
- 登录成功、失败、被限速都写认证事件日志（2.11）。

### 2.4 邀请码规则

- **邀请码格式**：8 位，字符取自 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`（32 个，去掉容易混淆的 0、O、1、I）；生成时随机取，与已有的码冲突就重新生成；输入不区分大小写，存储和比较都按大写；**规范化步骤（客户端和服务端相同，顺序固定）**：先删除所有 Unicode 类别为 `Cf` 的格式字符（零宽空格 U+200B、零宽连接符 U+200C/U+200D、BOM U+FEFF、从左到右/从右到左标记 U+200E/U+200F、方向嵌入与覆盖 U+202A 到 U+202E、方向隔离 U+2066 到 U+2069 等；阿拉伯语、希伯来语环境里粘贴的文本常带这些字符），再去掉首尾空白，再转大写（**只按 ASCII 转：a–z 变 A–Z，其他字符一律不变**，不用语言相关的大小写映射；`ſ`（U+017F）、`ı`（U+0131）、`ß` 等字符在 Java、Kotlin 的默认大写转换里会变成 `S`、`I`、`SS` 而让非法输入变成合法码，所以两端都必须用 ASCII 专用的转换，转完留在码里的字符集外字符让格式检查失败）；格式不对按“邀请码不存在”处理，返回 400 `INVALID_INVITE_CODE`（不区分两种情况，避免被用来探测）。客户端检查剪贴板、链接和手动输入的邀请码用同一条规则：长度 8 且只含上面的字符。长度固定、字符集窄，剪贴板里的随机字符串被误认的概率小；这是本项目自己定的格式，dramaBox 的邀请码格式没有核对 [未核实]。本文档里的示例码 `K7M2Q9XD` 只是示意。
- 邀请码**只在注册时填一次**，不支持事后补填（早期方案里那种"N天窗口期"设计已经被否掉，不要做）。
- **反向邀请防护**：一个已经完成注册的账号，不能拿别人的邀请码去"申领"、把自己伪装成被邀请的新用户——这是真实的反作弊场景。两道校验：
  1. 只在注册这一次请求里接受邀请码：已登录的账号（带有效的账号令牌）调用注册接口，直接返回 `ALREADY_REGISTERED`，不会走到邀请码校验；登录已有账号时带的 `inviteCode` 一律忽略（2.7、23.2）。
  2. **邀请人资格校验**（照 `dramaBox` 的做法，`backend-task-invite-code-redesign.md:77-89`）：被邀请账号的 `createdAt` 必须晚于邀请人账号的 `createdAt`，否则返回 `INVITER_NOT_ELIGIBLE`。邀请码只在创建新账号时接受（上一条），新账号的 `createdAt` 必然晚于任何已存在的账号，所以这一道在当前流程里不会触发，作为防御保留（dramaBox 有这条检查）。
- **邀请码不存在**：返回 400 `INVALID_INVITE_CODE`，账号保持原状（不创建），客户端提示用户改正后重试。
- 邀请码本体不属于自己：如果填的邀请码恰好是自己的（不可能出现，因为账号还没生成邀请码就来填自己的码，但防御性判断一下），不建立邀请关系，静默忽略即可，不需要报错阻断注册流程。

### 2.5 人格设定（persona）

```
GET /api/persona     # 鉴权：JWT。返回 {"persona":"...","pendingPersona":null,"moderationStatus":"NONE","maxLength":2000}
PUT /api/persona     # 鉴权：JWT。请求体 {"persona":"..."}，空字符串表示清除。响应 data 与 GET 相同（保存后的 persona / pendingPersona / moderationStatus / maxLength），客户端据此立刻显示"审核中"
```

`GET` 响应字段：`persona` 是当前生效的值（dispatch 用它），没有设定时为空字符串；`pendingPersona` 是待审核中的新值，没有则为 `null`；`moderationStatus` 取 `NONE`（无待审）、`PENDING_REVIEW`（新值在人工复核中，生效的仍是旧值）、`REJECTED`（上一次提交被复核拒绝；`GET` 不会清除它，直到下一次 `PUT` 成功提交才变化，客户端据此一直显示"被拒绝"提示）；`maxLength` 是下面长度限制的当前配置值，客户端据此显示字数，不写死。

`persona` 是用户为数字人设定的角色（性格、说话风格、背景；伴侣的名字是单独的字段，见 2.5.1），纯文本，存在 `User.persona`（可空文本字段）。游客没有账号，不能设置（2.1，403 `REGISTRATION_REQUIRED`）。

- **生效时间**：只影响之后发起的会话。通话进行中修改不影响当前通话，因为 agent 只在会话开始时读取一次（见 4.1）。
- **长度限制**：不超过 2000 个字符（按 Unicode 码点计），配置项 `persona.max_length`，超出返回 400 `PERSONA_TOO_LONG`。这是提议值，可调。原因：persona 会拼进每一次会话的 LLM 系统提示词，长度直接影响每轮的 token 成本 [推断]。
- **不设单独的编辑频率限制**：保存一次 persona 不触发任何 LLM 调用，成本只发生在下次会话 [推断]。
- **内容审核**：persona 是用户输入的文本，会影响 AI 的输出，属于主设计文档第 17 节的审核对象，`PUT` 经过第十一节的文本审核：高风险返回 400 `CONTENT_REJECTED`，不保存；中风险写入 `User.personaPending` 并进人工复核队列，`persona`（生效值）保持不变直到复核通过；通过则 `personaPending` 覆盖 `persona`，`personaPending` 置空、`moderationStatus` 回到 `NONE`；复核拒绝则 `personaPending` 置空、`moderationStatus` 置 `REJECTED`，`persona` 不变。**状态转换**（都在 `User` 行上用条件更新；下面的 `moderationStatus` 在 `User` 上的列名是 `personaModerationStatus`，只有 GET 响应里叫 `moderationStatus`；**先审核新值，再按审核结果改状态**）：① 高风险：400 `CONTENT_REJECTED`，`User` 的所有字段都不变（含已有的待审值和 `moderationStatus`）；② 中风险：新值存进 `personaPending`，生成新的 `User.personaPendingRef`（UUID，写进新记录的 `contentRef`），`moderationStatus=PENDING_REVIEW`，已有的待审复核记录关闭（`status=REJECTED`、`note=SUPERSEDED`，不再进复核队列，也不改 `User`）；③ 低风险：直接覆盖 `persona`，同时关闭已有的待审复核记录（`status=REJECTED`、`note=SUPERSEDED`），清空 `personaPending`、`personaPendingRef`，`moderationStatus` 置 `NONE`（包括上次被拒绝留下的 `REJECTED`）；复核通过或拒绝时，只有记录的 `contentRef` 等于该用户当前的 `personaPendingRef` 才改 `User`，不等的（已被取代）只关闭记录；④ 清除（空字符串）不经审核，立即生效，同时清空 `personaPending`、`personaPendingRef`，`moderationStatus` 置 `NONE`，并关闭该用户待审的记录（`status=REJECTED`、`note=SUPERSEDED`）；⑤ 新值与当前生效的 `persona` 完全相同时，不重新审核（内容早已生效），按③处理：关闭已有的待审记录（`status=REJECTED`、`note=SUPERSEDED`），清空 `personaPending`、`personaPendingRef`，`moderationStatus` 置 `NONE`，返回当前状态。

### 2.5.1 伴侣名字（companionName）

依据：页面结构设计（`docs/superpowers/specs/2026-10-18-app-page-structure-design.md` 的 A、C、D 节和第三部分）：主界面顶部和伴侣资料页显示伴侣的名字，创建形象的流程里有起名一步；Character.AI、Replika 的创建流程都有起名（同目录 `2026-10-18-page-structure-research/avatar-create.md`）。在此之前伴侣的名字只能写进 persona 自由文本，客户端没有可以显示的名字。

```
PUT /api/companion-name    # 鉴权：JWT。请求体 {"name":"..."}。响应 data {"companionName":"..."}
```

- 存在 `User.companionName`（可空）。`GET /api/account` 返回它（2.9），没有设置时为 `null`，客户端显示系统默认数字人的名字（3.10）。
- **名字规则**（伴侣名字、形象名字、默认数字人名字共用，3.2、3.10 引用这一条）：先按 1.9 去掉首尾空白，再检查：为空、超过 30 个 Unicode 码点（工程常量）、含控制字符（Unicode `Cc` 类），或含双向文字覆盖和隔离字符 U+202A–U+202E、U+2066–U+2069 → 400 `INVALID_REQUEST`（这些字符可以让名字在界面上伪装成别的内容；正常名字用不到。U+200C、U+200D 是阿拉伯文、波斯文、印度系文字的正常字符，必须保留）。保存去掉首尾空白后的值。用户不能清除：请求里的名字不能为空，想换就改成别的名字。`User.companionName` 为 `null` 只表示没有设置（新账号，或审核服务故障时先保存的名字被复核拒绝后置空，见下面），这时客户端显示系统默认数字人的名字（3.10）。
- **与当前值相同**（2026-10-18 加）：新名字（去空白后）与当前 `User.companionName` 完全相同 → 直接返回当前值，不审核、不换 `companionNameRef`、不动已有的待审记录（做法同 persona 的 2.5 ⑤，但这里没有待审值要清）。
- 内容审核：名字显示在界面上，也进 agent 的系统提示词（4.1、5.4），所以经过第十一节的文本审核（规则 + 文本分类，11.1；`ModerationRecord.contentType=COMPANION_NAME`，`contentRef` 是这次保存的版本号 `User.companionNameRef`：每次成功保存都生成一个新的 UUID 写进 `User.companionNameRef`，做法同 persona 的 `personaPendingRef`）：
  - 审核服务正常返回时：高风险和中风险都返回 400 `CONTENT_REJECTED`，不保存（高风险按 11.1 写 `BLOCKED` 记录；中风险同样写 `status=BLOCKED`、`autoLevel=REVIEW` 的记录（`BLOCKED` 的定义是自动拦截、不进人工队列，18），所以审核统计把它算作自动拦截，不算人工拒绝）。没有保存的尝试，记录的 `contentRef` 填一个新生成、不写进 `User` 的 UUID。原因：名字很短，被拒后换一个即可；进复核的话排队的几个小时里没有名字可显示 [推断：取舍]。
  - 审核服务超时或报错时（11.2）：只跑规则词表这一层；规则判 `BLOCK` → 400 `CONTENT_REJECTED`；否则**保存**，同时写一条 `PENDING_REVIEW` 记录进人工复核队列（事后复核）。复核员看的是记录的 `contentRef` 仍等于 `User.companionNameRef` 时的当前 `User.companionName`（`ModerationRecord` 不存原文）；复核拒绝时执行条件更新 `UPDATE User SET companionName=NULL WHERE id=? AND companionNameRef=<记录的 contentRef>`：更新到 1 行才产生审核拒绝通知（25.3 第 1 条，`contentType=COMPANION_NAME`）；更新到 0 行（用户已经改名）就只关闭记录，不发通知；复核通过不改变什么。**每次成功保存（包括审核服务故障时的保存）都在同一个事务里关闭该账号 `contentType=COMPANION_NAME` 的待审记录**（`status=REJECTED`、`note=SUPERSEDED`，做法同 persona 的 2.5 ③），所以人工队列里不会留着一条看不到内容的旧记录；复核拒绝和用户改名同时发生时，条件更新保证不会把刚保存的新名字清空。这样审核服务故障不会让保存失败，也不会给用户"内容被拒"的假消息（11.2：服务故障不能让写入接口失败）。
- 生效时间同 persona：只影响之后发起的会话和文字轮次（4.1、5.4）。
- 游客没有账号，不能设置（403 `REGISTRATION_REQUIRED`）。
- 客户端在两处写它：创建形象流程的起名步骤（账号的 `companionName` 为空时，同一步填伴侣名字，先保存名字再上传形象）；伴侣资料页改名。

### 2.6 令牌刷新与登出

```
POST /api/auth/refresh    # 无需登录。请求体 {"refreshToken":"..."}
POST /api/auth/logout     # 鉴权：JWT。无请求体（当前登录链取自访问令牌里的 `sid`）
```

- **access token 有效期**配置项（`auth.access_ttl_minutes`，默认 1440，即 24 小时）；**refresh token 有效期**配置项（`auth.refresh_ttl_days`，默认 30），每次使用后有效期重新计算（滑动）；**例外：账号 `User.status=PENDING_DELETION` 时，保留下来的那条登录链（13.1 同步阶段 b）的 refresh token 到期时间不早于 `AccountDeletion.executeAfter`**（签发时和每次轮换时都取“滑动到期时间”与 `executeAfter` 中较晚的一个），所以设备在宽限期内不打开 App 也不会丢掉这条链，宽限期天数不受 `auth.refresh_ttl_days` 限制。默认值与 dramaBox 一致（访问令牌 86400 秒、刷新令牌 2592000 秒，`dramaBox/app/src/main/resources/application.yml:44-45`）。
- **用户访问令牌的声明**：`iss=avatarapp`、`aud=avatarapp-user`、`sub`（账号 ID）、`typ=user`、`sid`、`iat`、`exp`；游客令牌（2.1）`typ=guest`、`aud` 同用户令牌、没有 `sub` 和 `sid`；管理员令牌的 `aud=avatarapp-admin`（17.2）。每个需要登录的接口按 2.6 的顺序检查签名、`exp`、`aud`。
- **refresh token 每次使用即轮换**：`/api/auth/refresh` 成功时作废旧的、签发新的，响应同 2.3 的四个字段（含 `accountId`）。refresh token 在数据库里只存哈希，不存明文。
- **复用检测**：如果一个已经被轮换掉的 refresh token 再次出现，说明可能被盗用，此时作废该账号同一登录链（`familyId`）下的所有 refresh token，返回 `INVALID_REFRESH_TOKEN`，客户端只能重新登录。
- **轮换宽限（`auth.refresh_reuse_grace_seconds`，默认 10）**：刚被轮换掉的 refresh token 在宽限期内再次出现，**不判盗用**，返回与第一次相同的那一对新令牌（服务端在宽限期内暂存新令牌对：Redis 键 `refresh_grace:{旧令牌的哈希}`，值是新令牌对的密文，AES-GCM，密钥 `REFRESH_GRACE_ENC_KEY`（1.5），TTL 等于 `auth.refresh_reuse_grace_seconds`；数据库只存哈希、不存令牌明文，所以不能放数据库；宽限期内再次出现的旧令牌取到密文就解密后原样返回同一对，取不到（Redis 丢失、已过期）按复用检测处理；**轮换的顺序固定**：先校验出示的令牌（存在、未过期、账号状态允许），不通过就不碰 Redis；通过后对键 `refresh_grace:{旧令牌的哈希}` 做 `SET NX`，写入占位值 `PENDING`（TTL 同宽限期）；NX 成功的请求是唯一的轮换者，才去数据库用条件更新（`usedAt IS NULL`）把旧令牌标记为已使用并插入新令牌行，提交成功后再把键改写为新令牌对的密文；条件更新更新到 0 行（令牌已在别处被使用）按复用检测处理并删除这个键，数据库失败时也只有它删除这个键；NX 失败的并发请求在宽限期内短暂轮询该键，读到密文就解密返回同一对令牌，读到 `PENDING` 继续等，等满 `auth.refresh_reuse_grace_seconds` 仍没有密文才按复用检测处理。这样并发的两个刷新请求只会得到同一对令牌，也不会有人在数据库提交之前拿到一对库里不存在的令牌，随便编的令牌更写不出键）。原因：服务端已经轮换、响应在途中丢了（或客户端在收到响应后、写盘前进程被杀），客户端手里的旧令牌就成了"已被使用过"的令牌；没有宽限的话，这会被当作盗用而作废整条登录链——用户被迫重新登录。这是通行的做法（Auth0 把它叫 reuse interval / leeway）。超过宽限期的重放仍按上一条处理。
- **游客凭据没有刷新令牌**（2.1）：过期后客户端重新调用 `POST /api/auth/guest` 取新凭据。
- `logout` 作废**当前登录链**：该链的所有 refresh token 作废，`sid` 加入下面的作废集合，访问令牌立即失效。**"当前链"在整份契约里都指访问令牌里的 `sid`**（设备列表、改密码也一样），请求体里不再带 `refreshToken`，所以不存在"请求体的令牌属于别的链或别的账号"的情形。**推送令牌随登录链清除**：账号令牌登记的推送令牌记下登记时的 `sid`（`PushToken.sessionFamilyId`，8.1）；登录链被加入作废集合的任何时候（`logout`、改密码、重置密码、复用检测、设备列表远程退出，见下一条），服务端同时删除 `sessionFamilyId` 等于这些 `sid` 的推送令牌。所以不依赖客户端在登出之前先调推送令牌注销（登出之后访问令牌立即失效，再调注销会得到 401）；客户端登出后用游客凭据重新登记同一个令牌（8.1）。
- **访问令牌带 `sid`**（该登录链的 `familyId`；refresh 轮换留在同一条链里，刷新得到的新访问令牌带**同一个** `sid`）。后端维护已作废登录链的集合（Redis，键 `revoked_sid:{sid}`，保留 `auth.access_ttl_minutes`；`auth.access_ttl_minutes` 不得大于 refresh token 的有效期）。**每个需要登录的请求按这个顺序检查**：① 签名、`exp`、受众，不通过返回 401 `INVALID_TOKEN`；② 用户令牌必须带 `sid`，没有的按不通过处理（后端没有上线过，不存在没有 `sid` 的旧令牌），`sid` 在作废集合里返回 401 `INVALID_TOKEN`；③ 账号状态（2.8），`BANNED`/`DELETING`/`PENDING_DELETION` 返回 `ACCOUNT_BANNED`/`ACCOUNT_DELETING`/`ACCOUNT_DELETION_SCHEDULED`（403，`PENDING_DELETION` 时取消删除、登出、`GET /api/account`、`purpose=DELETE` 的 `otp/send` 除外；`BANNED` 时登出除外，2.8）；账号已被删除（`User` 行不存在）返回 401 `INVALID_TOKEN`。游客凭据（`typ=guest`，2.1）没有 `sid`，不检查作废集合；管理员令牌是另一套（17.2，`tokenVersion`）。
- 以下操作把登录链加入作废集合：`logout`（当前链）、改密码（除当前链之外的所有链，2.9）、重置密码（所有链）、复用检测触发（该链）、用户在设备列表里远程退出（2.9）。"所有链"指该账号有未过期 `RefreshToken` 行的所有 `familyId`（链上的 refresh token 全部过期，就不可能还有未过期的访问令牌）。**封禁不使用这个集合；开始删除只对被作废的其他登录链使用它（13.1），申请所用的链不进集合**：第③步的状态检查对该账号所有已发出的访问令牌立即生效，而封禁可以解除，集合里的条目只能等它过期、不能撤回，所以封禁一旦用了它，解封后原令牌会在最长 `auth.access_ttl_minutes` 内一直 401。这样撤销立即生效，不用等 24 小时的访问令牌过期。
- 账号状态为 `BANNED`/`DELETING` 时，refresh 拒绝，返回对应的 `ACCOUNT_BANNED`/`ACCOUNT_DELETING`（403）；`PENDING_DELETION` 时 refresh 照常，对申请删除所用的登录链和宽限期内重新登录得到的令牌有效：申请删除时已经作废了该账号其他登录链的 refresh token（13.1 接口内同步部分第 2 条），它们不会因为取消删除而恢复；访问令牌的请求会被 2.8 拦住。**只有当出示的 refresh token 本身验证为真**（哈希匹配、未过期、没有被轮换掉）才返回这两个码；验证不通过的一律返回通用的 `INVALID_REFRESH_TOKEN`，这样未持有有效令牌的人无法探测账号状态（OWASP Authentication Cheat Sheet：对未认证请求不泄露账号是否存在或被禁用）。`DELETING` 时 refresh 一律被拒（保留的登录链在步骤 6 之前仍是有效令牌，出示它得到 `ACCOUNT_DELETING`，所以验收按此写），删除任务把令牌删掉以后，再用旧令牌刷新得到 `INVALID_REFRESH_TOKEN`（账号已不存在，和令牌被作废无法区分，这是预期）。**`BANNED` 时不作废 refresh token**：封禁可以被管理员解除，作废令牌会让被误封的用户在解封后还得重新登录；封禁期间所有请求和 refresh 都被拒绝，解封后原 refresh token 和访问令牌都继续可用。

### 2.7 第三方登录

```
POST /api/auth/google    # 请求体 {"idToken":"...", "integrityToken":"...", "inviteCode":"K7M2Q9XD", "deviceId":"...", "client":{...}}，无需登录（同 2.2，`client` 可选）；新建账号时 `deviceId` 和 `integrityToken` 必须带
POST /api/auth/apple     # 请求体 {"identityToken":"...", "integrityToken":"...", "inviteCode":"K7M2Q9XD", "deviceId":"...", "client":{...}}，无需登录（同 2.2，`client` 可选）；新建账号时 `deviceId` 和 `integrityToken` 必须带
```

主设计文档 §8.1 要求支持 Apple/Google 登录；Android 客户端当前不提供 Apple 登录，接口为 iOS 保留（iOS 版本提供 Google 登录时，App Store 审核指南 4.8 要求同时提供等价登录，来源是搜索摘要，没有读 Apple 原页）。后端**必须自己校验**客户端传来的令牌：验证签名（Google/Apple 的公钥）、`aud` 等于本 App 配置的客户端 ID、未过期；校验失败返回 `INVALID_SOCIAL_TOKEN`。取令牌里稳定的用户标识（`sub`）存进 `User.googleSub` / `User.appleSub`（唯一），不用邮箱当标识。

- **响应**：同 2.2，带 `accountId`、`token`、`refreshToken`、`expiresIn` 四个字段，另带 `isNewAccount`（本次请求新建了账号为 `true`，命中已有账号为 `false`，客户端据此记 `register_completed`，7.3）；命中已有账号时 `accountId` 是那个账号的 ID。
- **账号匹配**：按 `sub` 找到已有账号则登录（请求里的 `integrityToken` 被忽略）；找不到则新建账号：必须带 `deviceId`（缺失返回 400 `INVALID_REQUEST`）和 `integrityToken`（规则同 2.1，用途 `REGISTER`，缺失或不通过返回 403 `DEVICE_INTEGRITY_FAILED`，不创建账号），邮箱由 Google、Apple 验证，只有令牌里 `email_verified` 为真时才同时写 `User.email` 和 `User.emailVerifiedAt`，否则两者都留空；其余同 2.2，含设备转注册标记。
- **游客凭据被忽略**：游客没有账号（2.1），请求带着游客凭据时按未登录处理。
- **邮箱冲突**：令牌里的邮箱已属于另一个邮箱密码账号时，只有那个账号的 `emailVerifiedAt` 非空（邮箱注册的账号恒为非空）**并且** Google 令牌的 `email_verified` 为 true，才把 `sub` 绑到那个账号，否则返回 `EMAIL_TAKEN`；绑定按登录处理，不要求 `integrityToken`，也不新建账号。这是防止有人用别人未验证的邮箱抢占账号；邮箱密码账号的邮箱在注册时已用验证码验证（2.2），所以这条规则才成立。Apple 的邮箱规则见第十九节待核实项。**`User.email` 全局唯一**（规范化后，非空时唯一的部分唯一索引，2.2），交叉情形：令牌里的邮箱已属于一个**没有邮箱密码**的账号（只用 Google 或 Apple 登录的账号）时一律返回 `EMAIL_TAKEN`，不绑定（账号合并没有设计，同 2.9 的理由）；令牌里没有邮箱，或 `email_verified` 不为真时，新建账号的 `User.email` 留空（未验证的邮箱不占用唯一索引，也就不会挡住这个邮箱真正的主人去注册）；手机号账号的 `User.email` 为空。
- 邀请码规则同 2.4：只在新建账号时接受。新建账号成功后，同 2.2 为该账号生成它自己的邀请码；请求带 `inviteCode` 且校验通过时建立 `InviteRecord`，规则同 2.2（`PENDING`、写入顺序、`REGISTER` 触发的评估）。新建账号时同样按 13.5 查防滥用标记（规则同 2.2）。
- 手机号登录：见第二十三节。规则和这里一致——号码已属于某个账号时，登录那个账号（`accountId` 是那个账号的 ID），不报冲突。

### 2.8 账号状态

`User.status`：`ACTIVE`、`BANNED`（管理员封禁，第十七节）、`PENDING_DELETION`（用户已申请删除、处在宽限期内，第十三节）、`DELETING`（宽限期满后正在执行删除，第十三节）。**`PENDING_DELETION` 的行为**：登录照常成功（凭据已经验证），签发令牌；之后除 `POST /api/account/deletion/cancel`、`POST /api/auth/logout`、只读的 `GET /api/account` 和 `purpose=DELETE` 的 `POST /api/auth/phone/otp/send` 外，所有需要登录的接口返回 403 `ACCOUNT_DELETION_SCHEDULED`，`data` 为 `{"scheduledAt":"..."}`，客户端据此显示“取消删除”界面；refresh 照常（对申请删除所用的登录链和宽限期内重新登录得到的令牌有效，2.6）；不发推送、不参与召回、不计入活跃统计（请求都被拦住，不产生归到这个账号的事件；这台设备的匿名事件仍然被接收，7.1）。`BANNED`、`DELETING` 时：所有需要登录的接口返回对应错误码（`ACCOUNT_BANNED` 403 / `ACCOUNT_DELETING` 403；`BANNED` 时 `POST /api/auth/logout` 例外，允许调用并作废当前登录链，封禁页的“登出”据此生效），refresh 拒绝（2.6），已发出的 access token 在校验时也检查状态，不等自然过期（检查顺序见 2.6：先令牌本身和作废集合，再账号状态；封禁从不使用作废集合，所以已发出的令牌得到的是 403 `ACCOUNT_BANNED`，不是 401；申请删除只对申请所用登录链之外的其他登录链使用作废集合（2.6、13.1，这些链的令牌得到 401 `INVALID_TOKEN`），申请所用的那条链的令牌在宽限期内得到上面 `PENDING_DELETION` 的行为，进入 `DELETING` 后得到 403 `ACCOUNT_DELETING`；账号被彻底删除之后才是 401 `INVALID_TOKEN`）。

**`ACCOUNT_BANNED` 的响应体带上封禁说明**：`{"code":"ACCOUNT_BANNED","message":"...","data":{"reason":"<面向用户的封禁说明>"}}`。`reason` 取自 `User.banReason`（管理员填写，第十七节），**是写给用户看的文字**，所以管理后台填写时要写用户能读懂的原因；它只有一种语言，客户端按原样显示。原因：被封禁的用户有权知道理由并申诉（欧盟 DSA 第 17 条要求对账号暂停给出清晰具体的理由说明，第 20 条要求提供免费的电子申诉渠道；本产品是否落入这两条的适用范围需要法务判断 [未核实]，但客户端按"给出理由 + 给出申诉入口"实现）。客户端在收到该码后**保持登录状态**，显示"账号已停用"全屏页（理由、申诉/客服入口、登出、账号删除网页入口），不自动创建新账号；申诉入口由后端的客户端远程配置下发（26.2），不是本后端的接口：**优先用 `supportEmail`（打开写给该地址的邮件），没有则用 `supportUrl`（https 链接）**，两者都没有（或客户端没有缓存）时不显示申诉入口，只显示理由和登出。本合同目前没有临时封禁（没有结束时间字段），所以响应体里没有期限。
- 不是封禁的 403 默认不带 `data`（保持 `data: null`），带 `data` 的只有 `FEATURE_LIMIT_REACHED`（3.2、4.1、5.4）和 `ACCOUNT_DELETION_SCHEDULED`（`scheduledAt`，2.8）。**注意**：`POST /api/auth/google`、`/api/auth/apple`、`/api/auth/phone/login` 命中的是目标账号，该账号被封禁或正在删除时返回的 403 说的是那个账号；客户端把它当作登录失败处理，不当作当前会话失效。

### 2.9 账户信息与密码

```
GET  /api/account                      # 鉴权：JWT
POST /api/auth/password/change         # 鉴权：JWT
POST /api/auth/password/reset-request  # 无需登录
POST /api/auth/password/reset          # 无需登录
GET  /api/account/sessions             # 鉴权：JWT。列出本账号的登录链（设备列表）
DELETE /api/account/sessions/{sessionId}  # 鉴权：JWT。远程退出一条登录链
DELETE /api/account/sessions           # 鉴权：JWT。退出除当前链之外的所有登录链
```

- `GET /api/account` 响应：`{"accountId":"...","email":"...","phoneMasked":"+*******1234","providers":["EMAIL","GOOGLE","PHONE"],"status":"ACTIVE","currentAvatarAssetId":"...","currentVoiceAssetId":"...","companionName":"...","createdAt":"..."}`。客户端用它决定当前登录方式、当前资产和伴侣名字（`companionName`，2.5.1，没有设置时为 `null`）。`providers` 取 `EMAIL`、`GOOGLE`、`APPLE`、`PHONE` 中账号具备的那些，按这个顺序：有邮箱和邮箱密码（`User.email` 与 `passwordHash` 都非空）→ `EMAIL`；`googleSub` 非空 → `GOOGLE`；`appleSub` 非空 → `APPLE`；`phone` 非空 → `PHONE`。没有手机号的账号 `phoneMasked` 为 `null`，手机号注册的账号 `email` 为 `null`。手机号掩码规则全文统一：只保留末 4 位，前面的数字以 `*` 代替，保留开头的 `+`。
- `GET /api/account` 在 `PENDING_DELETION` 时仍可调用（只读，2.8）：取消删除页据此只显示账号有的验证方式。
- `password/change`：请求体 `{"oldPassword":"...","newPassword":"..."}`；当前链取自访问令牌的 `sid`，不需要 `refreshToken`。只对有邮箱密码的账号可用（`GET /api/account` 的 `providers` 含 `EMAIL`；其他账号返回 409 `INVALID_STATE`，客户端按 `providers` 决定是否显示入口）。旧密码错误或超过最大长度都返回 401 `INVALID_CREDENTIALS`；成功后作废该账号除当前链之外的所有登录链（refresh token 作废，`sid` 加入作废集合，2.6），这些链的访问令牌立即失效，并向账号邮箱发一封 `PASSWORD_CHANGED` 通知邮件（17.4，只有英文，只含时间和"如果不是你本人，请立即重置密码"）。
- `password/reset-request`：请求体 `{"email":"..."}`，**无论邮箱是否已注册都返回成功**（不泄露邮箱是否存在）。邮箱符合发送条件（见本条末）时发送一封含一次性重置链接的邮件（模板 `PASSWORD_RESET`，只有英文一份，17.4），**重置令牌**：32 字节 CSPRNG 随机数（base64url），数据库 `PasswordResetToken`（18：`accountId`、`tokenHash`=SHA-256、`expiresAt`、`usedAt`）只存哈希，单次使用，有效期 `auth.reset_token_ttl_minutes`（默认 30）；同一账号再次申请时旧的未用令牌作废；重置成功时该账号所有未用令牌作废；账号删除时一并删除（13.1）。邮件里的链接是 `{email.link_base_url}/reset-password?token=<令牌>`，由系统生成并填进模板的 `{resetLink}` 占位符，根地址只取配置，**绝不取请求的 Host 头**；承载这个链接的页面必须走 HTTPS、响应头 `Referrer-Policy: no-referrer`，令牌只放查询参数。
  - **发送条件**：存在 `email` 等于该邮箱的账号，账号 `ACTIVE` 或 `PENDING_DELETION`（宽限期内忘了密码的人要能重置后登录并取消删除），且账号已经有邮箱密码（`passwordHash` 非空；邮箱注册的账号都有，它们的 `emailVerifiedAt` 恒为非空）。不符合的（邮箱不存在、只用 Google/Apple/手机号登录的账号、`BANNED`、`DELETING`）一律什么都不发，也返回成功。重置只能改已有的密码，不能给只用第三方登录的账号新增邮箱密码：新增登录方式等于账号绑定，而 2.7 的绑定规则只覆盖"第三方令牌进入邮箱密码账号"这一个方向，反方向没有设计，所以不做。
  - **限流**：每 IP（1.6）之外，按规范化邮箱每小时 `ratelimit.link_mail_per_email_per_hour`（不论邮箱是否存在）；超出时仍返回成功，但不发信、也不作废旧令牌，所以别人不能靠反复申请让受害者手里的重置链接失效，也灌不满对方的收件箱；每次重置申请都写一条 `PASSWORD_RESET_REQUEST` 事件（2.11）：超出邮箱级限制的那些 `reason=RATE_LIMITED`，没有对应账号时 `accountId` 为空。
  - **响应不泄露邮箱是否存在**：发信放进异步队列，响应不等待发信结果，所以响应内容和耗时不随邮箱是否存在而变；单封邮件发送失败只记日志，不返回给调用方。邮件服务商没有配置、或 `email.link_base_url` 没有配置时返回 503 `EMAIL_SEND_FAILED`——这是整个功能不可用，和邮箱是否存在无关。
- `password/reset`：请求体 `{"resetToken":"...","newPassword":"..."}`，令牌无效、过期、已用过，或令牌对应的账号既不是 `ACTIVE` 也不是 `PENDING_DELETION`，都返回 `INVALID_RESET_TOKEN`；成功后令牌作废，并作废该账号的全部 refresh token，所有登录链的访问令牌立即失效（2.6），清除该邮箱的登录失败计数（2.3），并向账号邮箱发一封 `PASSWORD_CHANGED` 通知邮件。
- 新密码的规则同 2.2（NFKC 规范化、最少 8 位、最多 `auth.password_max_length` 位、不设组成规则），不满足返回 400 `INVALID_REQUEST`。
- **设备列表**：`GET /api/account/sessions` 响应 `{"sessions":[{"sessionId":"<familyId>","createdAt":"...","lastUsedAt":"...","platform":"ANDROID","appVersion":"1.2.0","deviceName":"Pixel 8","current":true}]}`，只列未作废、未过期的登录链。一条链的 `createdAt` 取 `RefreshToken.familyCreatedAt`（登录时写入，轮换时从上一条复制，旧行被清理后仍稳定），`lastUsedAt` 是最近一条的 `createdAt`（最近一次登录或刷新），`platform`、`appVersion`、`deviceName` 取自登录时的 `client`（2.2），刷新时从上一条复制；`current` 是 `sessionId` 等于访问令牌里 `sid` 的那一条（没有 `sid` 的令牌到不了这里，2.6 第②步已拒绝）。`DELETE /api/account/sessions/{sessionId}` 把这条链的 refresh token 全部作废并把 `sid` 加入作废集合（2.6），不是本账号的链、不存在的、或已作废、已过期的 `sessionId` 返回 404 `SESSION_NOT_FOUND`；`sessionId` 是当前链时允许，等同于 `logout`；`DELETE /api/account/sessions` 对当前链之外的所有链做同样的事。两者都写认证事件日志（`SESSION_REVOKED`，2.11），并受 1.6 的敏感接口限流约束（和改密码共用计数器）。发邮件通过 `EmailSender` 接口，**邮件服务商是缺的输入**（第十九节），选定后实现一个适配器。

### 2.10 会话语言（language）

```
GET /api/language   # 鉴权：JWT。返回 {"language":"en","supported":["ar","my",...]}
PUT /api/language   # 鉴权：JWT。请求体 {"language":"th"}。响应与 GET 相同
```

`language` 是用户为数字人对话设置的语言：AvatarAgent 用它决定识别哪种语言、用哪种语言回答、怎么判断用户说完。一个会话一种语言，存在 `User.conversationLanguage`（可空）。从未设置过，或存储的值已经不在 `chat.conversation_languages` 里时，`GET` 返回 `en`，dispatch 也传 `en`（两处用同一个生效值，客户端看到的就是数字人实际说的语言）。游客没有账号，不能调用本接口（403 `REGISTRATION_REQUIRED`）；游客的会话语言在 `POST /api/sessions` 的请求体里带（4.3），可选语言列表登录前从客户端配置的 `conversationLanguages`（26.2）取得。

- **取值**：两位小写的 ISO 639-1 语言代码，必须在配置项 `chat.conversation_languages` 里，否则返回 400 `INVALID_LANGUAGE`，不保存。默认值是 AvatarAgent 当前的识别服务与合成服务都会说的 30 种语言：`ar my zh da nl en fi fr de el he hi id it ja km ko lo ms no pl pt ru es sw sv tl th tr vi` [核实 AvatarAgent 设计文档第 7 节；两个服务语言表的交集，2026-10-01]。菲律宾语用 `tl`（安卓系统给的 `fil` 要客户端转成 `tl`）；旧的印尼语 `in`、希伯来语 `iw` 同理转成 `id`、`he`。粤语（`yue`）目前不在内。
- **这个列表不能比 AvatarAgent 支持的更长**：AvatarAgent 收到不支持的语言会静默改用英语并记错误日志，用户会得到一个说英语的数字人而没有任何提示。往列表里加新语言之前，必须先确认 AvatarAgent 的两个服务都支持（与 `chat.model_tiers_allowed` 同一个上线顺序问题）[推断]。
- **`GET` 的 `supported`** 是 `chat.conversation_languages` 的当前值，客户端据此显示可选语言，不写死；语言名称的本地化由客户端做。
- **和 `locale` 无关**：推送文案语言（8.4，`app.supported_locales`）是界面与通知的语言，用户可以界面用中文、和数字人说泰语，两者互不影响，不要用一个推断另一个。
- **生效时间**：只影响之后发起的会话。通话进行中修改不影响当前通话，因为 agent 只在会话开始时读取一次（见 4.1）。
- 不经内容审核（取值是固定列表，不是用户输入的文本）；不设单独的频率限制。随账号删除一起删除（`User` 行），数据导出的 `profile.json` 带上它（13.3）。

### 2.11 认证事件日志

所有和认证有关的事件写入 MongoDB 集合 `auth_event`，用于事后排查和告警。字段：`type`（`REGISTER`、`LOGIN_OK`、`LOGIN_FAIL`、`LOGOUT`、`REFRESH_REUSE`（复用检测触发）、`PASSWORD_CHANGE`、`PASSWORD_RESET_REQUEST`（每次重置申请一条，包括超出限制和没有对应账号的，2.9）、`PASSWORD_RESET_DONE`、`OTP_FAIL`（邮箱或手机号验证码错误）、`SESSION_REVOKED`（设备列表里远程退出）、`SOCIAL_LINK`（第三方登录绑定到已有账号，2.7））、`accountId`（可空，登录失败且邮箱不存在时为空）、`ipHash`（客户端 IP 的 HMAC-SHA256，密钥 `ABUSE_HASH_KEY`，IP 取自受信任反向代理，1.6）、`deviceIdHash`（可空，`deviceId` 的 HMAC-SHA256，密钥同样是 `ABUSE_HASH_KEY`）、`reason`（可空，失败原因码，如 `INVALID_CREDENTIALS`、`RATE_LIMITED`）、`at`。**不写密码、令牌、验证码、完整邮箱和完整手机号。** 每条自带过期时间 `expireAt = at + auth.log_retention_days`（180），TTL 索引建在 `expireAt` 上（`expireAfterSeconds=0`），改配置只影响之后写入的记录；账号删除时删除该 `accountId` 的事件（13.1 步骤表第 5 步）。管理后台在用户详情里按账号查看（17.4 的"认证事件"）。

---

## 三、形象/声音资产模块

### 3.1 资产库概念

**一个账号可以有多个历史创建的形象/声音资产（资产库），不是只保留"当前一个"。** `User` 表上有 `currentAvatarAssetId`/`currentVoiceAssetId` 两个指针字段指向"当前使用"的资产，用户可以在资产库里随时切换、删除、新建。形象下面有外观（`AvatarLook`，3.6），形象的当前外观是 `AvatarAsset.currentLookId`。

上传 → 生成是一个**异步过程**：上传接口立即返回一个任务ID，真正的生成（照片→数字人形象数据，音频→声音克隆模型）由外部服务处理，本后端起一个后台轮询去跟外部服务确认完成状态，完成后才在资产库里落地一条新记录。**形象的生成分三段**：本后端审核原照（第十一节）→ 形象生成服务做人脸检测与年龄判断、生成第一个外观（3.5）→ 本后端审核生成结果（第十一节）；通过后在同一个事务里落地 `AvatarAsset` 和它的第一个 `AvatarLook`，并把 `AvatarAsset.currentLookId` 指向这个外观。**新资产落地时，如果账号当前还没有该类型的"当前使用"资产，新资产自动设为当前（条件更新：`UPDATE User SET currentXxxAssetId=? WHERE id=? AND currentXxxAssetId IS NULL`，两个任务同时落地只有一个成为当前）；已经有的，不改动当前指针，由用户在资产库里自己切换。**

### 3.2 上传形象 / 声音

```
POST /api/avatars   (multipart, 字段名 file，接受 jpg/png；另有文本字段 style、declarationVersion、name)
POST /api/voices     (multipart, 字段名 file，接受 wav/mp3/m4a；另有文本字段 transcript)
```

**`POST /api/avatars` 的 `style`、`declarationVersion`、`name` 字段**：形象只收照片，不再接受视频（单图驱动只需要一张图，形象渲染设计 3.1）。
- `style`（必填）：`STYLIZED_3D`（3D 动画质感）或 `REALISTIC`（写实），缺失或不在这两个值里返回 400 `INVALID_REQUEST`。配置项 `avatar.realistic_enabled`（17.5）为 `false` 时，`REALISTIC` 返回 400 `INVALID_REQUEST`。
- `declarationVersion`（必填）：用户勾选的上传声明的版本号（`DeclarationVersion`，由下面的 `GET /api/avatar-upload-options` 返回当前生效版本）。声明的意思是：照片里的人已满 18 岁，而且是我本人，或者我已经取得他的同意；我对上传的照片负责（具体文字由律师定，每套部署分别配置）。不勾选客户端不能提交。不是当前生效的版本返回 400 `INVALID_REQUEST`（客户端刷新声明后让用户重新勾选）。配置项 `avatar.declaration_required`（17.5）为 `false` 时客户端不显示声明，这个字段可以省略，`AvatarAsset.declarationVersion` 记空。后端在 `AvatarAsset` 上记下 `declarationVersion` 和 `declarationAcceptedAt`。
- `name`（必填，2026-10-18 加）：这个形象的名字，资产库里用它区分形象（页面结构设计 D 节，`docs/superpowers/specs/2026-10-18-app-page-structure-design.md`）。规则同 2.5.1 的名字规则（去掉首尾空白后 1 到 30 个 Unicode 码点、不含 `Cc` 和双向覆盖字符），否则 400 `INVALID_REQUEST`。保存去掉首尾空白后的值，存在 `GenerationTask.assetName`，形象落地时复制到 `AvatarAsset.name`。只有本人和管理员（17.4 的用户详情）看得到、不进 agent 的提示词，所以不经过内容审核。声音没有名字。

```
GET /api/avatar-upload-options    (JWT)
```

返回上传页需要的选项：当前生效的上传声明（版本号、按 `Accept-Language` 选的文案，语言协商见 1.2）和可选的风格（`avatar.realistic_enabled` 为 `false` 时不含 `REALISTIC`），以及照片的大小和像素上限。`avatar.declaration_required` 为 `false` 时不返回声明。

**响应：** `{"styles":["STYLIZED_3D","REALISTIC"],"declaration":{"version":"...","text":"..."},"maxBytes":209715200,"maxPixels":250000000}`。`styles` 是可选的风格；`declaration.version` 是 `DeclarationVersion.version`，上传时原样填进 `declarationVersion`；`declaration.text` 是按 `Accept-Language` 选好的一种语言的文案；`avatar.declaration_required` 为 `false` 时 `declaration` 为 `null`。**“当前生效的声明版本”**：同一时刻恰有一个，即 `isActive` 为真且 `activeFrom` 不在未来的那个版本（`activeFrom` 在未来的不算）。`avatar.declaration_required` 为 `true` 而没有生效版本时，`GET /api/avatar-upload-options` 返回 503 `GENERATION_NOT_CONFIGURED`；声明文本没有请求语言（语言协商见 1.2）时回退 `en`，`en` 也没有同样返回 503 `GENERATION_NOT_CONFIGURED`。

**`maxBytes` 和 `maxPixels`**：`maxBytes` 是整数，上传形象照片的文件大小上限（字节），取自 `upload.max_bytes` 的当前值（改这个键之后下一次请求已变）；`maxPixels` 是整数，上传形象照片允许的宽×高上限，当前是 250000000（工程常量，和下面“上传校验”里拒绝超大像素图用的是同一个值）。用户选好照片之后、上传之前，客户端用这两个值检查：文件长度超过 `maxBytes`，或从文件头读出的宽×高超过 `maxPixels`，就在选图页告诉用户限制是多少，不上传；客户端没取到这个接口的响应时不做提前检查，退回服务器的判断。服务器仍然是最终把关：超过任何一个都是 400 `INVALID_FILE`。

**`POST /api/voices` 的 `transcript` 字段（必填）**：参考音频里说的话。合成服务创建音色必须有它，为空会被拒绝（3.5）。约定由客户端提供：客户端录音界面给用户一段朗读文案，`transcript` 就是这段文案原文；用户选择已有音频文件上传时，客户端要求用户填写音频里说的内容。后端不做语音识别。先按 1.9 的集合去掉首尾空白，**再**检查：为空，或长度（按去掉首尾空白之后的 Unicode 码点计，客户端的字数上限也按去空白之后计）超过 `voice.transcript_max_chars`（默认 1000 个字符；17.5 保存时校验不大于 1000，因为合成服务只接受 1 到 1000 个字符，3.5）返回 400 `INVALID_REQUEST`（`message` 写明是 `transcript`，它是文本字段，不是文件问题）；存给合成服务的也是去掉首尾空白后的值（合成服务同样先去空白，只含空白的值会被它拒绝）。

**上传校验（在生成任务开始之前完成，不能等任务跑起来再报错；大小、类型、数量在写盘前，声音样本的时长在落盘后）：**
- 形象的文本字段（`POST /api/avatars` 的 `style`、`declarationVersion`、`name`，规则见上面）：紧跟在幂等键查重之后、读文件之前检查，不通过返回 400 `INVALID_REQUEST`，不落盘、不创建任务，也不占用幂等键
- 文件非空
- 大小不超过配置项 `upload.max_bytes` 的上限（默认 200MB）
- content-type 在白名单内：形象 `image/jpeg`、`image/png`；声音 `audio/wav`（也接受 `audio/x-wav`、`audio/wave`）、`audio/mpeg`、`audio/mp4`、`audio/x-m4a`。请求头里的类型不可信：落盘后再用图片解码器（形象照片）或 ffprobe（声音）按文件内容判断，实际内容不在白名单内、或与声明的类型不一致，返回 400 `INVALID_FILE` 并删除文件（“写盘前”的检查只看声明的类型）
- 照片的宽×高不超过 250000000（工程常量，`GET /api/avatar-upload-options` 的 `maxPixels`）：落盘后先读文件头得到宽高，超过 → 400 `INVALID_FILE` 并删除文件，不解码（一张几 KB 的 PNG 可以声明几万乘几万像素，解码会拖垮进程）
- 当前权益允许的数量上限（`assets.avatar_max` / `assets.voice_max`，15.6）：已有资产数**加上同类型所有非终态任务**（`PENDING`、`IN_REVIEW`、`PROCESSING`）数不小于上限，返回 403 `FEATURE_LIMIT_REACHED`，`data` 为 `{"feature":"AVATAR"|"VOICE","limit":"ASSET_COUNT","max":<上限>}`。写盘前检查一次（快速拒绝），创建任务时在账号级咨询锁（键 `asset_limit:{accountId}:{type}`）内再检查一次并在同一个锁内插入任务，所以并发的两个上传不会同时越过上限；第二次检查不通过时删除已落盘的文件并返回同样的 403
- 形象生成的门槛配置（`generation.mouth_open_min_area`、`generation.mouth_open_min_brightness`，17.5）有任一未配置：`POST /api/avatars` 返回 503 `GENERATION_NOT_CONFIGURED`，不创建任务（1.4）；默认服装或默认背景条目缺失（3.7，建形象要用它们）同样返回它。**形象上传时这一条先于上面的数量上限（403 `FEATURE_LIMIT_REACHED`）判断**，和 3.6 的次序一致（先 503，再 403）
- 声音样本的时长（落盘后、创建任务前，用 ffprobe 读取）：不在 `generation.voice_min_seconds` 到 `generation.voice_max_seconds`（默认 1 到 30 秒）之间，返回 400 `INVALID_FILE` 并删掉刚落盘的文件。这是合成服务的限制，超出范围的录音注册时会被它拒绝（3.5）；上限的原因是模型每次合成都要把整段参考录音重新编码，太长会拖慢每次合成（这个原因取自 `registry.py` 的代码注释，没有测量）[核实 AvatarAgent/tts_service/registry.py 的 `MIN_REFERENCE_SECONDS`、`MAX_REFERENCE_SECONDS` 两个常量]

**上传媒体的元数据一律在入库时由后端去除（服务端为准，客户端的去除只是额外的数据最小化）**：形象只有照片分支；下面的视频和音频分支只服务声音样本（音频）。照片可能带 GPS（EXIF/XMP/IPTC），视频容器里可能带 QuickTime 位置原子（`©xyz`、`com.apple.quicktime.location.*`）；位置信息是 GDPR 第 4 条定义的个人数据，而且安卓只对 API 29+ 的照片默认隐藏位置，**视频的位置信息安卓从不隐藏**（`developer.android.com/training/data-storage/shared/media`），所以不能依赖客户端或系统。规则（文件通过上面的校验、落盘后、创建任务前）：
- 照片：解码后应用 EXIF 方向、重新编码，输出不写任何元数据（OWASP File Upload Cheat Sheet 的 "image rewriting"）。重新编码时长边大于 3072 像素的等比缩小到 3072，一律编码为 JPEG（质量 95；带透明通道的 PNG 先铺白底）。理由：形象生成服务（AvatarEngine）的请求体整体上限是 20,000,000 字节（3.5），而 `upload.max_bytes` 允许 200 MB 的上传；AvatarEngine 自己处理照片时只用长边 2048 像素（AvatarEngine `avatarengine/imaging.py:34`，2026-10-18 读），所以缩到 3072 不损失生成用到的信息，也给它以后调大留了余量；3072 边长的 JPEG 正常只有几 MB。重新编码后仍大于 19,000,000 字节（给 multipart 的其他部分和 `request` 留出余量）→ 400 `INVALID_FILE`，删文件：按本节"不能等任务跑起来再报错"的原则在上传时拦下，不能等提交 AvatarEngine 时才 413。
- 视频和音频：用 ffmpeg 显式指定要保留的流，去掉全局/流/章节元数据并关闭编码器标识，例如 `ffmpeg -i in -map 0:v:0 -map 0:a:0? -map_metadata -1 -map_chapters -1 -fflags +bitexact -flags:v +bitexact -flags:a +bitexact -c copy -movflags +faststart out.mp4`（`-map 0` 会把数据/时间码轨道带过去，不要用）。`-c copy` 不改动编码比特流里的 SEI/用户数据，需要保证零透传、或本来就要统一编码/分辨率/码率时，改为重新编码。声音样本同样在落盘后、创建任务前用 ffmpeg 统一转码为 16-bit PCM WAV（标签随之丢弃），并用 ffprobe 核查（失败 400 `INVALID_FILE` 并删文件）；`originalFileRef` 指向这个处理后的 WAV，后台任务只发送它。
- 处理后用 `ffprobe -v error -show_entries format_tags:stream_tags -of json out` 核查，输出里还有 `location` 或 `com.apple.quicktime.location.*` 这类键则拒绝该文件（400 `INVALID_FILE`）并删除。
- 保存的是处理后的文件，原始上传（带元数据的版本）处理完成后立即删除；数据导出（13.3）里的"原始文件"指这个处理后的版本。
[核实 ffmpeg 源码 `fftools/ffmpeg_mux_init.c` 与 `libavformat/movenc.c`：`-map_metadata -1` 关闭全局/流/章节元数据的自动复制，mov 复用器只从输出自己的元数据字典写位置原子，2026-10-01]

**原始文件的保留**：上传的照片/声音样本在生成成功后仍保留，直到该资产或账号被删除，用途是数据导出（13.3）、外部服务数据丢失后的重建，以及换装（形象的新外观从原照生成，3.6）。它们可能是生物识别数据，所以保留期严格等于资产的生命周期，删除资产或账号时一并清除（3.4、13.1）。**形象原照的保留期是配置项** `avatar.source_photo_retention_days`（17.5）：0（默认）表示随形象的生命周期，即上面的规则；大于 0 时，原照到期由每天的清理任务删除（保留期从形象生成成功、即 `AvatarAsset.createdAt` 起算）（`AvatarAsset.originalFileRef` 置空），之后换装改从当前外观的标准图出发（3.6），收到照片里的人投诉时也无法用原照比对。

**内容审核**：文件校验通过、落盘后，任务的第一步是第十一节的审核（形象照片、声音样本都要审），审核通过才开始生成。形象任务审核通过后提交形象生成服务，由它先做人脸检测与年龄估计（同一次推理，3.5）：检测不到人脸 → 任务 `FAILED`（`NO_FACE_DETECTED`），人脸检测总是执行；`moderation.age_check_enabled`（17.5）为真时，判为明显未成年 → `FAILED`（`SUBJECT_UNDERAGE`，不转人工复核）；两种都由本后端删除原照。之后形象生成服务对每次尝试生成的标准图另做一次年龄判断（`moderation.age_check_enabled` 为真时；判为像未成年人时这一次尝试作废，用完 `generation.max_attempts` 次仍没有合格的图时任务 `FAILED`，`failureReason=GENERATION_FAILED`，不是 `SUBJECT_UNDERAGE`，原照不因此删除，3.5）。建外观（3.6）不再检查输入图，只检查生成图。本后端对生成结果做第二次审核（`moderation.generated_output_review`，11.1）。上传接口本身不等待审核结果，立即返回 `taskId`。

**响应：** `{"code":"200","message":"success","data":{"taskId":"..."}}`

**幂等键（请求头 `Idempotency-Key`，两个上传接口和建外观接口都要带）**：客户端每次"提交一个文件"生成一个随机键（UUID），该次提交的所有重试都发同一个键。原因：大文件上传可能已经在服务端处理完（文件落盘、任务创建），而响应在返回途中丢了，客户端只能重试；没有幂等键的话，重试会产生第二个任务和第二个资产，还会占用数量上限。规则：同一账号、同一个键在 24 小时内再次到达，**不重新处理文件，直接返回第一次的 `taskId`**（相同的成功响应）；缺少该头、或不是 UUID 格式返回 400 `INVALID_REQUEST`。键与账号一起唯一，不同账号发同一个键互不影响。**建外观的键还按目标形象区分**：键按 (账号, 任务类型, 形象) 绑定，同一个键用在同一账号的另一个形象上是新请求，创建新的任务，不返回第一个形象的 `taskId`，也不会得到 409 `REQUEST_IN_PROGRESS`。**检查顺序**：幂等键查重（数据库加 Redis 键）排在所有其他校验（类型、大小、数量上限）之前，所以剩最后一个名额时，第一次请求建出的任务占着名额，同一个键的重试拿到的是同一个 `taskId`，不是 403。**存储**：`GenerationTask.idempotencyKey`，`(accountId, avatarAssetId, idempotencyKey)` 唯一（上传形象和声音的任务 `avatarAssetId` 为空，按同为空处理，所以上传的键在同一账号内仍然全局唯一），键在创建任务的同一个事务里写入。**并发**：同一个键的第二个请求在第一个还没建出任务时到达（Redis 键 `upload_idem:{accountId}:{key}`（建外观再带上目标形象），`SET NX`，TTL 60 分钟并在处理期间每分钟续期，要长于最慢的上传加处理时间；任务建好或请求失败时删除）；标记过期后同键请求并行处理的极端情形，由数据库唯一键兜底：插入撞上 `(accountId, idempotencyKey)` 且旧任务在 24 小时之内时，回读已有任务并返回它的 `taskId`（200，响应和第一次相同），删除新落盘的文件。**409 `REQUEST_IN_PROGRESS` 只用于 Redis 标记仍在、任务还没建出的情形**，客户端稍后用同一个键重试。**失败**：第一次请求在建出任务之前失败（校验不通过的 400、403 等）不留下任何东西，同一个键之后可以再用，会重新校验；已经建出的任务即使后来 `FAILED` 也按“同一个键返回第一次的 `taskId`”处理，用户要重新生成就换新键。同一个键用在另一种类型的接口上（形象的键发到声音接口）→ 400 `INVALID_REQUEST`。**建外观接口 `POST /api/avatars/{assetId}/looks`（3.6）适用同一套规则**：键存 `GenerationTask.idempotencyKey`，与任务类型 `LOOK` 绑定（`LOOK` 的键发到上传接口、上传的键发到建外观接口，都是 400 `INVALID_REQUEST`）。服装兑换 `POST /api/cosmetics/{itemId}/redeem`（3.7）不走这套规则，用请求体的 `idempotencyKey`，存 `CreditLedger.idempotencyKey`（15.9）。键只在任务创建后 24 小时内有效：重放判定要求任务的 `createdAt` 在 24 小时之内，更早的同键请求按新请求处理（插入撞到旧任务的唯一键时，先把那条旧任务的 `idempotencyKey` 置空再插入）；每天一次的清理任务把超过 24 小时的任务的 `idempotencyKey` 置空，只是释放唯一索引。

### 3.3 任务状态轮询

```
GET /api/tasks/{taskId}
```

**响应：** `{"code":"200","message":"success","data":{"status":"PENDING|IN_REVIEW|PROCESSING|SUCCEEDED|FAILED","assetId":"...","lookId":null,"resultRef":"...","failureReason":"...","name":"..."}}`

状态含义：`PENDING` 已接收、等待审核/生成；`IN_REVIEW` 自动审核判为中风险，人工复核中，分两种：原照中风险（复核通过继续生成）、生成结果中风险（形象生成服务产出的标准图或片段，复核通过才落地，不是继续生成），拒绝都变 `FAILED`；`PROCESSING` 外部服务生成中；`SUCCEEDED` 完成，资产库里已有新记录；`FAILED` 失败，`failureReason` 只取六个值：`CONTENT_REJECTED`（审核拒绝，文件已删除）、`GENERATION_FAILED`（外部服务报错，或形象生成的自动检查用完 `generation.max_attempts` 次仍不合格）、`EXTERNAL_TIMEOUT`（外部服务超过配置时间仍未完成）、`EXTERNAL_TASK_LOST`（形象生成服务丢失任务，见 3.5）、`SUBJECT_UNDERAGE`（照片里的人被判为明显未成年，原照已删除，3.2）、`NO_FACE_DETECTED`（照片里检测不到人脸，原照已删除，3.2）。**外部服务返回的原文一律不透传给客户端**，只记后端日志。`assetId` 和 `resultRef` 只在 `SUCCEEDED` 时有值（资产被删除后两者为 `null`，3.4）；形象类任务（`AVATAR`、`LOOK`）响应里的 `resultRef` 恒为 `null`（它只用于 `delete`，3.5），声音任务不变。`LOOK` 任务成功时响应另带 `lookId`（新外观的 ID）。`failureReason` 对客户端只有这六个值，账号删除流程还会把非终态任务置 `FAILED` 并记内部值 `ACCOUNT_DELETED`（13.1 步骤表第 2 步），账号已不存在，客户端看不到它；`assetId` 用于调 `PUT /api/{avatars|voices}/{assetId}/active`，声音任务的 `resultRef` 是合成服务里的音色名。

**权限：** 只能查自己的任务，查别人的任务ID统一返回 `TASK_NOT_FOUND`（不区分"不存在"和"不是你的"，避免泄露别人任务ID是否存在）。

```
GET /api/tasks?limit=20
```

列出当前账号最近的任务（`limit` 默认 20，上限 50，非整数、≤ 0 或超过上限 → 400 `INVALID_REQUEST`，按创建时间倒序），响应 `{"tasks":[{"taskId":"...","type":"AVATAR","status":"...","assetId":null,"failureReason":null,"name":"...","createdAt":"..."}]}`。`name`（这里和单个任务的响应都有）是形象名字（`GenerationTask.assetName`：上传时填的值，改名时跟着改，3.4），只有 `AVATAR` 任务有，其他类型为 `null`，资产删除后也为 `null`（3.4）。`type` 可为 `AVATAR`、`VOICE`、`LOOK`；`ACTION_CLIP`、`LOOK_REPREPARE` 由后端自动排，不列给客户端。`IN_REVIEW` 可能持续数小时，客户端进程被杀后会丢掉 `taskId`，靠这个接口找回进行中的任务。

### 3.4 资产库 CRUD

```
GET    /api/avatars              # 列出当前账号的形象资产库
DELETE /api/avatars/{assetId}    # 删除一条（校验归属，越权返回ASSET_NOT_FOUND）；同时删除它的全部外观（AvatarLook）、外观的全部驱动资源包（LookPackage，所有格式版本）、动作片段（ActionClip）及标准图、驱动资源包、片段文件
PUT    /api/avatars/{assetId}/active  # 设为当前使用
PUT    /api/avatars/{assetId}         # 改名，请求体 {"name":"..."}，规则同 3.2 的 `name`（2026-10-18 加）；同一事务里把指向这个资产的任务行（`GenerationTask.assetId` 等于它 `AND type='AVATAR'`；`LOOK` 任务没有 `assetId`，它的目标形象记在 `avatarAssetId`，也不带名字）的 `assetName` 一起改掉
```

`/api/voices` 有前三个同构接口（列表、删除、设为当前），没有改名（声音没有名字）。

**响应**：`DELETE`、`PUT .../active` 和改名成功都返回 `data: null`（客户端用列表接口或 `GET /api/account` 刷新当前指针）；资产不存在或不属于当前账号返回 404 `ASSET_NOT_FOUND`；重复删除同一资产返回 404 `ASSET_NOT_FOUND`（记录已不存在，不是幂等成功）；对已经是当前的资产再次 `PUT .../active` 返回成功。

**列表响应**：`{"assets":[{"assetId":"...","name":"...","createdAt":"...","isCurrent":true,"previewUrl":"/api/avatars/{assetId}/preview","style":"STYLIZED_3D","currentLookId":"..."}]}`，按 `createdAt` 倒序。`name`、`previewUrl`、`style`、`currentLookId` 只有形象有，声音条目没有这些字段；形象的 `previewUrl` 是当前外观标准图的缩略图。`isCurrent` 由后端按 `User.currentXxxAssetId` 算出，客户端不自己推断。

**形象预览图**：由本后端生成：每个外观落地时从它的标准图缩小生成一张小 JPEG（长边 480 像素、质量 80，工程常量），存在本后端的存储里（`AvatarLook.previewRef`），每个外观一张，外观列表（3.6）也用它。形象的预览图取当前外观的那一张，`GET /api/avatars/{assetId}/preview`（JWT，校验归属）返回它；切换当前外观（3.6）后随之变化。预览图跟原始文件一样，删除外观或资产时一并删除。

**⚠️ 关键边界情况**：删除的资产如果正好是 `User.currentAvatarAssetId`/`currentVoiceAssetId` 指向的那一条，删除后必须把这个指针字段清空，**不能留一个指向已删除记录的悬空引用**——否则后续任何读取"当前形象"的地方都会崩或读到脏数据。`AvatarAsset.currentLookId` 不会悬空：当前外观不能单独删除（3.6）。

**删除必须同时清除外部数据**：形象是用户的人脸，克隆音色是用户的声纹，都可能被认定为生物识别数据（主设计文档 §6 隐私约束的同一依据）。删除资产时除了本库记录、原始上传文件、预览图，形象还要删除它的全部外观、动作片段，以及标准图、驱动资源包、片段文件；还要删除外部服务里的对应数据：形象生成服务里可能残留的临时文件和原照副本（形象生成服务不长期保存结果，3.5）、合成服务里注册的音色。合成服务和形象生成服务都有删除接口（3.5、13.2），`delete(resultRef)` 是必须具备的能力。本后端用第十三节的持久化外部删除任务去调用，失败自动重试，直到成功才算清除完成。资产记录本身在用户看来立即消失，不等外部删除完成；删资产行、清空 `User.currentXxxAssetId`（若指向它）、置空任务行里的引用、插入 `ExternalDeletionJob` 在同一个数据库事务里，崩溃不会丢掉外部引用。任务行（`GenerationTask`）里的 `assetId`、`assetName`、`originalFileRef`、`transcript`、`resultRef`、`externalName`、`lookId`、`actionItemId` 在资产删除时同时置空（任务行本身留到账号删除，只剩状态和时间），否则删除资产之后任务行仍然指着已删除的文件并留着用户的朗读文本。

### 3.5 跟外部生成服务的对接

形象生成和声音克隆由外部服务完成，本后端只发起任务、跟踪状态、保存结果引用（形象生成服务的产物由本后端取回存进 `FileStorage`），不实现生成算法。

**形象生成服务是一个新的独立服务**（Python，单独仓库；仓库名和服务名是 **AvatarEngine**，产品负责人 2026-10-16。环境变量 `AVATAR_GEN_URL`、`AVATAR_GEN_SIGNING_SECRET`、`AVATARGEN_USAGE_SIGNING_SECRET` 和调用方标识 `backend-avatargen`、`avatargen-usage` 说的是"形象生成"这个功能，不随仓库名改），替换此前 demo 用的 LiveTalking 适配器；它产出标准形象图、驱动资源包和动作片段，驱动资源包的格式见形象渲染设计（`docs/superpowers/specs/2026-10-11-avatar-rendering-design.md`）4.2。它**不长期保存生成结果**：任务完成后本后端取走产物存进自己的 `FileStorage`（1.1），服务随后删除自己的副本，所以个人数据只在本后端一处。本后端只依赖下面两个接口：

| 接口 | 方法 | 语义 |
|------|------|------|
| `AvatarGenerationProvider` | `submitAvatar(photo, ref, accountId, style, outfitSpec, backgroundSpec, options) → taskRef` | 建形象的第一个外观（`GenerationTask.type=AVATAR`），也用于生成系统默认数字人（3.10）。服务不长期保存结果，所以每次提交都带齐输入。`ref` 由本后端生成（`a_` 加不带横线的 UUID，匹配 `^[A-Za-z0-9_-]{1,64}$`） |
| | `submitLook(photo, ref, accountId, style, outfitSpec, backgroundSpec, options) → taskRef` | 给已有形象建新外观（`LOOK`，3.6），输入用原照；`avatar.source_photo_retention_days` 大于 0 且原照已删时改用当前外观的标准图 |
| | `submitReprepare(canonicalImage, ref, accountId, rendererFormatVersion, options) → taskRef` | 为外观准备指定格式版本的驱动资源包（`LOOK_REPREPARE`，3.9），只重做驱动准备，不重新生成标准图 |
| | `submitActionClip(drivingPackage, ref, accountId, actionGenerationSpec, options) → taskRef` | 生成一个动作片段（`ACTION_CLIP`，3.8）。输入是外观的驱动资源包，不是标准图：片段的首帧和尾帧要等于手机待机时画出的画面，这一帧要用资源包画（包里已有 `canonical.png`）。传外观创建时那个格式版本的包（外观的第一条 `LookPackage`），补生成（`backfill`）也一样；外观创建时的包已随格式停用被清理时，改用这个外观现存的、格式版本最小的 `READY` 包；一个都没有就先为当前格式排 `LOOK_REPREPARE`，成功后再排片段（3.8） |
| | `poll(taskRef) → {state, failureCode, failureDetail, outputs}` | `state` 取 `PENDING`、`RUNNING`、`SUCCEEDED`、`FAILED`、`LOST`。`FAILED` 时带 `failureCode`（`NO_FACE_DETECTED`、`SUBJECT_UNDERAGE`、`GENERATION_FAILED`）和 `failureDetail`（只进后端日志，不给客户端）。`LOST` 表示服务不认识这个任务（例如服务重启丢了任务）。`SUCCEEDED` 时 `outputs` 列出产物：`canonicalImage`、`canonicalImageCutout`、`drivingPackage`、`rendererFormatVersion`（这个包的格式版本）、`attempts`；`LOOK_REPREPARE` 只有 `drivingPackage`、`rendererFormatVersion`；片段任务为 `clip`、`durationMs`；三类都另带 `resultRef` |
| | `fetchOutput(taskRef, name) → 文件流` | 本后端取回产物存进 `FileStorage`，取完后调 `delete` |
| | `delete(ref)` | 删除服务里可能残留的临时文件和原照副本，幂等。**这是必须实现的能力**（3.4、13.2） |
| `VoiceCloneProvider` | `register(audio, name, transcript)` | 同步调用，返回即音色可用 |
| | `delete(name)` | 幂等 |

- **`accountId`**：每个提交方法都带，是任务所属的账号；系统默认数字人的任务为空（3.10）。形象生成服务上报 `GENERATION` 用量时要带它（14.2）。
- **`options`**：每个提交方法都带，内容是提交时的生成门槛、审核年龄设置和 AI 标记开关：`mouthOpenMinArea`、`mouthOpenMinBrightness`、`maxAttempts`、`ageCheckEnabled`、`underageRejectBelowAge`、`faceMinDetScore`、`aiLabelEnabled`，取自 `generation.mouth_open_min_area`、`generation.mouth_open_min_brightness`、`generation.max_attempts`、`moderation.age_check_enabled`、`moderation.underage_reject_below_age`、`moderation.face_min_det_score`、`generation.ai_label_enabled`（17.5）。形象生成服务自己不读本后端的配置（形象渲染设计 13.6）。建形象、建外观七项全部必填；重新准备、片段只用 `aiLabelEnabled`。
- 本后端调形象生成服务时带 1.8 的签名头，调用方标识 `backend-avatargen`（密钥 `AVATAR_GEN_SIGNING_SECRET`），地址 `AVATAR_GEN_URL`（1.5）。
- `resultRef` 对本后端和客户端都是不透明字符串（形象类任务对客户端恒为 `null`，3.3），只用于 `delete`；`AvatarAsset.resultRef` 存它，是形象生成服务给的引用。
- 本后端**轮询**：后台定时任务按 `generation.poll_interval_seconds`（默认 5）查询未完成任务，不依赖任何服务的完成回调（回调是否可靠因服务而异，不假设对方提供）。轮询覆盖 `AVATAR`、`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP` 四类任务；`SUCCEEDED` 后先用 `fetchOutput` 从服务取回产物存进 `FileStorage`，再调 `delete`。`LOST` 置任务 `FAILED`（`EXTERNAL_TASK_LOST`）；超过 `generation.avatar_timeout_minutes`（默认 60，适用于这四类）仍未完成置 `EXTERNAL_TIMEOUT`，**超时从任务提交给外部服务的时刻算**（`GenerationTask.submittedAt`，等待审核的时间不计入；任务进入生成结果复核 `IN_REVIEW` 时停表）。**这四类任务进入 `FAILED` 时，只要已经开始提交外部服务（提交调用已发出：拿到了 `externalRef`，或调用超时、抛异常而没拿到），无论原因是 `GENERATION_FAILED`、`EXTERNAL_TIMEOUT` 还是 `EXTERNAL_TASK_LOST`，一律创建一条 `ExternalDeletionJob`（类型 `AVATAR`）**：外部服务可能已经留下了部分数据（人脸素材），而任务没有成功就没有资产记录指向它们。删除用的标识是 `GenerationTask.externalName`（创建任务时生成并存下，就是提交方法的参数 `ref`，所以没拿到 `externalRef` 也能删），成功之后是 `resultRef`；`AvatarGenerationProvider.delete(ref)` 接受这两者中的任何一个，对不存在的数据幂等（服务说“没有”视为成功）。`LOOK` 任务 `FAILED` 时，如果建任务时扣过额度，写一条 `reason=SPEND_REVERSED` 的流水退回（3.6、15.9）。声音任务的同类规则在下面的状态码表里：声音任务在调用 `register` 之前就生成音色名（`v_` 加不带横线的 UUID）并存进 `GenerationTask.externalName`，所以注册超时、进程重启后清扫任务都能凭它创建删除任务。
- **落地检查（任何产物写进库之前）**：本后端把产物（资产、外观、驱动资源包、动作片段）落地之前，先检查目标还在：账号没有被删除、也没有处在 `DELETING`，形象和外观还存在。目标不在了（账号开始删除，或形象、外观在任务运行期间被用户删除）：丢弃这次结果，为 `resultRef` 和任务的 `externalName` 创建 `ExternalDeletionJob`（类型 `AVATAR`），任务置 `FAILED`；`LOOK` 任务已经扣过额度的，同时写 `SPEND_REVERSED` 退回（3.6、15.9）。账号删除执行时的同类规则见 13.1。
- 适配器按 `poll` 的 `failureCode` 写 `GenerationTask.failureReason`（`NO_FACE_DETECTED`、`SUBJECT_UNDERAGE`、`GENERATION_FAILED` 同名对应），外部服务的原始报错（`failureDetail`）只进日志（3.3）；形象生成的每次尝试是一次图像编辑加自动检查；编辑被拒绝、生成图读不了、生成图里没有人脸或被判为像未成年人、露齿不合格、生成图不能驱动，都只作废这一次尝试；用完 `generation.max_attempts` 次仍没有合格的是 `GENERATION_FAILED`。图像编辑服务不可用、或已计费但结果图没能取回时，立即 `GENERATION_FAILED`，不再尝试。**生成出来的标准图被判为像未成年人时，AvatarEngine 报 `GENERATION_FAILED`，不是 `SUBJECT_UNDERAGE`**：照片本身已经通过检查，不能让本后端按"照片里是未成年人"删原照。
- 声音克隆是同步调用，本后端在后台工作线程里调一次，超时 `generation.voice_timeout_seconds`（默认 120）。**后端重启后的恢复**：进程重启会让正在注册的声音任务停在 `PROCESSING` 而没有线程在跑；清扫任务（与轮询同一个，`generation.poll_interval_seconds`）把 `type=VOICE`、`status=PROCESSING` 且 `updatedAt` 早于 `generation.voice_timeout_seconds` + 60 秒之前的任务置 `FAILED`（`EXTERNAL_TIMEOUT`），并按下面的状态码表为 `GenerationTask.externalName`（音色名）创建 `VOICE` 类型的删除任务（服务端可能已经存下了）。

**当前的适配器**：声音用 AvatarAgent 项目自带的合成服务 `tts_service`（下面的"音色接口"，这是确定的方案）；形象用 AvatarEngine（上面的 `AvatarGenerationProvider`），它的 HTTP 接口是下面的定稿（2026-10-17，AvatarEngine 会话给出）。

**AvatarEngine 的 HTTP 接口（`AvatarGenerationProvider` 的适配器）**：地址 `AVATAR_GEN_URL`；全部请求带 1.8 的签名头，AvatarEngine 只接受调用方标识 `backend-avatargen`。响应用本契约的信封 `{"code","message","data"}`。

| 方法 | 路径 | 请求 | 成功响应 |
|---|---|---|---|
| `submitAvatar` | `POST /v1/avatar-tasks` | `multipart/form-data`：文件部分 `photo`；JSON 部分 `request` | 202，`data.taskRef` |
| `submitLook` | `POST /v1/look-tasks` | 文件部分 `photo`（原照；原照已过保留期时放当前外观的标准图）；`request` | 202，`data.taskRef` |
| `submitReprepare` | `POST /v1/reprepare-tasks` | 文件部分 `canonicalImage`；`request` | 202，`data.taskRef` |
| `submitActionClip` | `POST /v1/action-clip-tasks` | 文件部分 `drivingPackage`；`request` | 202，`data.taskRef` |
| `poll` | `GET /v1/tasks/{taskRef}` | — | `data.state`；`FAILED` 时 `data.failureCode`、`data.failureDetail`；`SUCCEEDED` 时 `data.outputs` |
| `fetchOutput` | `GET /v1/tasks/{taskRef}/outputs/{name}` | — | 文件流，响应头 `Content-Type`、`X-Content-SHA256` |
| `delete` | `DELETE /v1/refs/{ref}` | — | 204，幂等（13.2） |

**取回产物的单文件上限**：契约原来没有给产物文件任何大小上限（上面 20000000 字节是请求体的上限）。后端用 `fetchOutput` 取回产物时边读边计数，每个文件不超过 `upload.render_asset_max_bytes`（17.5）：响应头 `Content-Length` 超过上限就不读；没有该头或它不可信时，读到上限加一个字节就中止。超限算这个任务生成失败：任务 `FAILED`，`failureReason=GENERATION_FAILED`；已存下的半截文件删除；`LOOK` 任务已扣的额度退回（`SPEND_REVERSED`，3.6、15.9）；不重试，因为同一个产物再取仍然超限。

`request` 的字段（JSON，camelCase）：

| 字段 | 哪些任务要 | 说明 |
|---|---|---|
| `ref` | 全部 | 本后端生成，`^[A-Za-z0-9_-]{1,64}$`。`taskRef` 和 `resultRef` 都等于它 |
| `accountId` | 全部 | 可空：系统默认数字人为空（`null` 或不带该字段）；AvatarEngine 也把空字符串和只含空白的字符串当成空，但本后端应发 `null`。用量记录要它（14.2） |
| `style` | 建形象、建外观 | `STYLIZED_3D` / `REALISTIC` |
| `outfitSpec`、`backgroundSpec` | 建形象、建外观 | 服装、背景条目的 `generationSpec` 原文 |
| `rendererFormatVersion` | 重新准备 | 要准备的格式版本 |
| `actionGenerationSpec` | 片段 | 动作条目的 `generationSpec` 原文 |
| `options` | 全部 | 上面的七项。建形象、建外观七项全部必填；重新准备、片段只用 `aiLabelEnabled` |

- **`state`** 取 `PENDING`、`RUNNING`、`SUCCEEDED`、`FAILED`、`LOST`。**`failureCode`** 取 `NO_FACE_DETECTED`、`SUBJECT_UNDERAGE`、`GENERATION_FAILED`。`failureDetail` 只给后端日志，不给客户端。
- **`outputs` 的名字**：建形象、建外观为 `canonicalImage`（PNG）、`canonicalImageCutout`（PNG，带透明通道）、`drivingPackage`（zip），每个文件产物是 `{"contentType","size","sha256"}`，另有 `rendererFormatVersion`、`attempts`、`resultRef`；重新准备为 `drivingPackage`、`rendererFormatVersion`、`resultRef`；片段为 `clip`（MP4，只有一个 H.264 视频流、没有音轨；画面宽高恰好等于这个外观标准图 `canonicalImage` 的宽高）、`durationMs`、`resultRef`。
- **本后端不用的产物**：`canonicalImageCutout` 不取（抠图结果已经在驱动资源包里，3.9）；`attempts` 只写日志，不入库。
- **错误码**（AvatarEngine 回给本后端，不给客户端）：400 `INVALID_REQUEST`、401 `INVALID_SIGNATURE`、404 `NOT_FOUND`（取产物时任务未成功或没有这个产物）、409 `REF_CONFLICT`（同一 `ref` 已用于另一种任务，或已被删除）、413 `PAYLOAD_TOO_LARGE`（请求体整体上限 20,000,000 字节，AvatarEngine 的 `MAX_UPLOAD_BYTES`；本后端与它按同一个值部署。本后端发出的文件都在这个上限之内：照片见 3.2 的重新编码规则）、503 `UNAVAILABLE`。


**音色接口（`VoiceCloneProvider` 的适配器，对方是 AvatarAgent 的 `tts_service`）** [核实 AvatarAgent/tts_service/app.py、registry.py 及 tests/test_tts_app.py、tests/test_tts_registry.py，2026-10-01]：同一个服务既接收这里的注册和删除，也是 agent 合成语音时按名字取音色的地方，所以名字必须是同一个。
- **音色名约定**：音色资产的 `resultRef` 就是合成服务里的音色名，由本后端生成（例如 `v_` 加不带横线的 UUID），必须匹配 `^[A-Za-z0-9_-]{1,64}$`，合成服务会拒绝其他名字。
- **注册**：`POST {TTS_SERVICE_URL}/v1/voices`，请求头 `Authorization: Bearer <TTS_ADMIN_API_KEY>`，multipart 表单三个字段：`audio_file`（参考音频）、`name`（即 `resultRef`）、`transcript`（参考音频里说的话，必填，1 到 1000 个字符）。
- **删除**：`DELETE {TTS_SERVICE_URL}/v1/voices/{name}`，同样带密钥。
- **按名字查询**（后端一般用不到）：`GET {TTS_SERVICE_URL}/v1/voices/{name}`，不需要密钥，200 或 404。**没有列出全部音色的接口**：音色会随用户克隆增长，列表会暴露所有用户的音色名。

**音色接口的状态码**是判定成功与否的依据。与此前的 CosyVoice 不同，那边失败也可能返回 HTTP 200，这里用正常的 HTTP 状态码：

| 调用 | 状态码 | 含义与处理 |
|------|--------|-----------|
| 注册 | 201 | 成功，音色已可用于合成 |
| 注册 | 400 | 名字不合法、`transcript` 为空或超过 1000 个字符、音频解码不了、时长不在 1 到 30 秒、录音是静音。重试没有用，任务置 `FAILED`（`GENERATION_FAILED`） |
| 注册 | 401 | 密钥错误。后端配置问题，任务置 `FAILED` 并记错误日志，不透传给客户端 |
| 注册 | 409 | 已存在同名音色。名字是本任务生成的、每个任务唯一，所以这表示本任务之前的某次调用其实已经成功（例如 HTTP 客户端在超时后自动重试），**按成功处理** [推断] |
| 注册 | 413 | 上传超过 20 MB，任务置 `FAILED`。30 秒以内的 16-bit WAV 约 5.5 MB（48 kHz 立体声），远小于上限 |
| 注册 | 5xx、超时、连接错误 | 任务置 `FAILED`（`GENERATION_FAILED`；超过 `generation.voice_timeout_seconds` 为 `EXTERNAL_TIMEOUT`），用户可以重新上传。**服务端可能已经存下了这个音色**（例如超时发生在它写完之后），所以同时为这个音色名创建一条 `ExternalDeletionJob`（类型 `VOICE`），按删除的规则重试，404 视为成功 [推断：超时时无法知道服务端有没有写入]。否则会留下一条没有任何记录指向它的声纹 |
| 删除 | 204 | 成功 |
| 删除 | 404 | 音色已经不存在，**按成功处理**（幂等） |
| 删除 | 401、5xx、超时、连接错误 | 进入持久化外部删除任务重试（13.2） |

**判定成功的条件：注册返回 201（或 409），删除返回 204 或 404**，其余一律失败或重试。合成服务的原始错误体只进日志，不透传给客户端（3.3）。

**音频统一转码**：客户端可以上传 wav/mp3/m4a，合成服务用 libsndfile 解码，能解码哪些格式取决于它的版本，m4a（AAC）通常不行 [推断：libsndfile 不含 AAC 解码]。所以后端在上传校验阶段就用 ffmpeg 把声音样本统一转成 16-bit PCM WAV，调用时只发这个文件（采样率、单声道或立体声都可以，合成服务自己转成 16kHz 单声道），转码在上传校验阶段已经完成（3.2），失败时返回 400 `INVALID_FILE`、不创建任务。注册时合成服务还会把录音的响度归一到统一水平，后端不需要处理。

### 3.6 外观与换装

依据：形象渲染设计（`docs/superpowers/specs/2026-10-11-avatar-rendering-design.md`，下同）4.1、5.1、5.3。

**外观（`AvatarLook`）**：一个外观 = 一套服装 + 一个背景生成的一张标准形象图和它的驱动资源包（每个渲染器格式版本一个包，`LookPackage`，3.9）。一个形象（一张原照 + 一种风格）下面可以有多个外观，`AvatarAsset.currentLookId` 指向当前外观。**外观这一行只在生成成功时创建**（与 `AvatarAsset` 一样在任务落地的事务里写入），生成中和失败的状态看 `GenerationTask`；所以外观的状态只有 `READY`。某个格式版本的资源包是否在准备中记在 `LookPackage.status` 上，不改外观的状态（3.9）。形象被删除时它的所有外观一起删除（3.4）。

**换装** = 用原照和新的服装、背景给同一个形象新建一个外观（`GenerationTask.type=LOOK`），流程同 3.2 的生成和审核两段，不需要训练。旧外观保留，可以切回。输入用原照，不用当前外观的标准图（每次从原照出发，误差不会在一次次换装中累积 [推断]）；例外：`avatar.source_photo_retention_days` 大于 0、原照已到期删除时，改从当前外观的标准图出发（3.2）。

```
GET    /api/avatars/{assetId}/looks                  # 该形象的外观列表，每条带 status、isCurrent、预览（previewUrl，3.4 的外观预览图）
POST   /api/avatars/{assetId}/looks                  # {"outfitItemId","backgroundItemId","expectedCreditPrice"}，返回 taskId
PUT    /api/avatars/{assetId}/looks/{lookId}/active  # 设为当前外观
DELETE /api/avatars/{assetId}/looks/{lookId}         # 删除外观
```

都要 JWT，形象不存在或不属于当前账号返回 404 `ASSET_NOT_FOUND`。

**`GET /api/avatars/{assetId}/looks` 的响应：** `{"looks":[{"lookId":"...","status":"READY","isCurrent":true,"previewUrl":"...","outfitItemId":"...","backgroundItemId":"...","createdAt":"..."}],"newLookCreditPrice":0}`，按 `createdAt` 倒序。`status` 现在只有 `READY`（外观只在生成成功时创建；正在生成的外观看 `GET /api/tasks` 里的 `LOOK` 任务）；`isCurrent` 由后端按 `AvatarAsset.currentLookId` 算出；`previewUrl` 是这个外观的预览图（3.4）。**`newLookCreditPrice`** 是本账号此刻新建一个外观要花的额度：`avatar.look_free` 的生效值为真时为 0，否则取 `avatar.look_credit_price`（0 表示免费）。这两项一个是部署配置、一个是账号权益，客户端都读不到，所以由这里给出；客户端在扣费前用它让用户确认价格，响应里没有这个字段时不让新建（不能当成免费）；用户确认的价格随创建请求以 `expectedCreditPrice` 发回，服务端在扣费前核对（下面的 `POST`）。

**`POST /api/avatars/{assetId}/looks`**：
- 必须带 `Idempotency-Key`，规则同 3.2（键与任务类型 `LOOK` 绑定）。**检查顺序**：幂等键查重排在所有其他校验之前（3.2），所以同一个键已经建出过任务的重试，无论现在的价格是多少，都返回第一次的 `taskId`，不做价格核对；之后依次是下面的请求体校验（400）→ 503 `GENERATION_NOT_CONFIGURED` → 外观数上限（403）→ 价格核对（409 `PRICE_CHANGED`）→ 余额（402）→ 创建任务并扣费。
- `outfitItemId`、`backgroundItemId` 必须是已拥有或免费的条目、在当前端可见（3.7 的 `surfaces`）、适用于该形象的风格（`compatibleStyles`），否则 400 `INVALID_REQUEST` [推断：形象渲染设计 5.3 只写了条件，没有给错误码]。
- **`expectedCreditPrice`（必填，整数，不小于 0；通用规则见 1.4"扣额度请求的价格核对"，本接口是它的第一个用例）**：用户在确认界面上看到并同意的价格，0 表示免费；它应当是 `GET .../looks` 响应的 `newLookCreditPrice` 的值。缺少、不是整数或为负数 → 400 `INVALID_REQUEST`。原因：确认界面出现到用户点击之间，运营可能改了 `avatar.look_credit_price`，或账号的 `avatar.look_free` 刚好失效，请求本身不带价格的话，用户会被扣一个没有确认过的数额，只有服务端能堵住这个窗口。
- 生成门槛有未配置的 → 503 `GENERATION_NOT_CONFIGURED`（1.4）。
- 外观数上限：功能开关 `avatar.looks_max`（15.3）。它是**每个形象**的上限，生效值对账号下的每个形象分别适用，不能用额度买额外单位（`creditCost` 为空）。已有外观数加上该形象非终态的 `LOOK` 任务数不小于上限 → 403 `FEATURE_LIMIT_REACHED`，`data` 为 `{"feature":"AVATAR_LOOK","limit":"LOOK_COUNT","max":<上限>}`；检查和插入任务在账号级咨询锁里完成，规则同 3.2（15.6）。
- **收费**：配置项 `avatar.look_credit_price`（17.5，0 表示免费）；功能开关 `avatar.look_free`（`BOOLEAN`）为 true 的账号不收（例如订阅用户）。15.3 的 `creditCost` 是"买一个额外上限单位的价格"，不是"每做一次扣一次"，所以不能用它。**价格核对**：扣费前，在创建任务的同一个账号级咨询锁和事务里（与外观数上限的检查同一处）算出此刻要收的价格（`avatar.look_free` 的生效值为真时为 0，否则 `avatar.look_credit_price`，与 `newLookCreditPrice` 同一个算法），与 `expectedCreditPrice` 比较；不相等 → 409 `PRICE_CHANGED`，`data` 为 `{"creditPrice":<此刻的价格>}`，不扣款、不创建任务、不写流水，也不占用 `Idempotency-Key`（按 3.2 的失败规则，建出任务之前失败不留下任何东西；客户端换新键重发，因为上一次请求已经被明确拒绝）。相等才继续。扣费在创建 `LOOK` 任务的同一个事务里写一条流水（`reason=SPEND`，`spendKind=LOOK`，带任务 ID，`featureKey` 为空，15.9），金额就是核对通过的这个价格；余额不足返回 402 `INSUFFICIENT_CREDITS`，不创建任务。扣费事务提交之后记一条 `credits_spent` 事件（7.3：`featureKey`、`itemKey` 为空，`quantity` 为 1，`credits` 为扣的数额；价格为 0 时没有扣费，不记）。任务最终 `FAILED` 时写一条反向流水退回（`reason=SPEND_REVERSED`，`eventKey` 为任务 ID，保证只退一次）。
- 成功返回 `{"taskId":"..."}`，任务成功时 `GET /api/tasks/{taskId}` 带 `lookId`（3.3）。`LOOK` 任务成功不触发里程碑 `first_avatar`（6.3），也不记事件 `avatar_created`（7.3）。**新建外观不改变形象的当前外观**：新外观成功后只加进外观列表（`isCurrent` 为 `false`）；`AvatarAsset.currentLookId` 只在两种情况下改变：形象的第一个外观落地（形象任务成功，3.2）和 `PUT .../looks/{lookId}/active`。

**`DELETE .../looks/{lookId}`**：当前外观不能删，返回 409 `INVALID_STATE`；最后一个外观一定是当前外观，所以也不能删，要删就删整个形象（3.4）。删除外观同时删除它的动作片段（3.8）、所有格式版本的驱动资源包（`LookPackage` 行，3.9）、标准图、预览图、驱动资源包文件、片段文件。

**`PUT .../looks/{lookId}/active`**：外观不属于该形象返回 404 `ASSET_NOT_FOUND`，对已经是当前的外观再次设置返回成功 [推断：照 3.4 设当前形象的规则]。切换后形象的 `previewUrl` 随之变化（3.4）。

### 3.7 服装与背景目录

依据：形象渲染设计 2.2、4.1、5.2、5.3。

服装和背景共用一张目录表 `CosmeticItem`（`kind` 为 `OUTFIT` 或 `BACKGROUND`，第十八节），由运营在管理后台维护（17.4）。**用户不能输入自由文字描述服装**（内容安全）。每种 `kind` 各有一个 `isDefault=true` 的免费条目，建形象时用。

**按端筛选**：`surfaces` 是一个数组，每项是 `{"platform": "ANDROID"|"IOS", "channel": "<渠道码>"|null}`，`channel` 为 null 表示该平台的所有渠道；空数组表示所有端。请求的 `X-Platform`、`X-Channel`（1.2）匹配任意一项即可见。条目在某个端不可见时：目录不返回、不能兑换、不能用它新建外观。拥有关系不分端。

**拥有关系记在账号上**（`AccountCosmetic`），不随形象：删除形象不影响已拥有的服装；一旦获得永久拥有，包括用订阅赠送的额度兑换的服装。免费条目（`isFree`）所有人都能用，不需要记录。获得渠道：
- 用额度兑换：条目的 `creditPrice` 非空时可以兑换（`POST /api/cosmetics/{itemId}/redeem`）。
- 运营赠送：管理后台对某个账号发放（`source=ADMIN_GRANT`，17.4）。
- 订阅不直接附带服装；订阅的好处是每个计费周期赠送额度（`credits.period_grant`，15.9）。
- 不把每件服装登记成商店商品：服装留在自己的目录里，用额度兑换。

```
GET  /api/cosmetics?kind=OUTFIT|BACKGROUND   # 当前端可见的目录，每条带 owned、creditPrice
POST /api/cosmetics/{itemId}/redeem          # 用额度兑换，请求体 {"idempotencyKey":"...","expectedCreditPrice":100}
```

**`GET /api/cosmetics` 的响应：** `{"items":[{"itemId":"...","key":"...","kind":"OUTFIT","name":"...","previewUrl":"...","compatibleStyles":["STYLIZED_3D"],"creditPrice":100,"isFree":false,"isDefault":false,"owned":false}]}`，只含 `enabled`、在当前端可见的条目，按 `sortOrder` 排序。`kind` 是条目的种类（`OUTFIT`/`BACKGROUND`），与查询参数一致；`name` 是按 `Accept-Language` 从 `names` 里选好的一种语言（语言协商见 1.2）；`creditPrice` 为 `null` 表示不能用额度兑换；`owned` 只反映本账号有没有这个条目的 `AccountCosmetic` 行（免费条目不需要拥有记录，所以通常是 `false`）；客户端在 `owned || isFree` 时可以用这个条目建外观。**`kind` 是必填的查询参数**：缺少或不是 `OUTFIT`、`BACKGROUND` → 400 `INVALID_REQUEST`。请求没带 `X-Platform` 或 `X-Channel`（1.2）时，`surfaces` 非空的条目不出现，只有 `surfaces` 为空数组的条目可见。

**`redeem`**：`idempotencyKey` 的规则同 `POST /api/credits/spend`（15.9）。**`expectedCreditPrice`**（必填，规则见 1.4"扣额度请求的价格核对"）是用户看到的这件服装的价格，即 `GET /api/cosmetics` 里这个条目的 `creditPrice`。**检查顺序**：幂等键查重 → 请求校验（400、404）→ 已拥有（成功，不核对价格）→ 价格核对（409 `PRICE_CHANGED`，`data.creditPrice` 是条目此刻的 `creditPrice`）→ 余额（402）→ 扣款。在一个事务里写一条额度流水（`reason=SPEND`，`spendKind=COSMETIC`，`itemKey` 为条目的 `key`）和一条 `AccountCosmetic`（`source=CREDITS`）。成功响应 `{"itemId":"...","owned":true,"balance":200}`，`balance` 是兑换后的余额（同 `GET /api/credits` 的 `balance`）；同一个 `idempotencyKey` 重发返回第一次的结果。余额不足返回 402 `INSUFFICIENT_CREDITS`；已拥有返回成功（幂等，响应同上，`balance` 为当前余额，不扣款）；条目不存在、未启用或在当前端不可见返回 404 `RESOURCE_NOT_FOUND`，`creditPrice` 为空返回 400 `INVALID_REQUEST` [推断：形象渲染设计 2.2、5.2 只写了"不能兑换"，没有给错误码]。后端记事件 `credits_spent`（7.3，`params` 带 `itemKey`）。

### 3.8 动作与动作片段

依据：形象渲染设计 4.1、6.1–6.3。

动作目录 `ActionItem` 由运营维护（17.4）。**所有动作（笑、害羞、挥手等，用户点的和 agent 触发的）都是事先生成好的视频片段，由手机播放**（产品负责人 2026-10-16 决定：不再用渲染模型现算表情，因为格式 1 的渲染模型带不出笑容，形象渲染设计 6.1），所以动作没有种类之分，每个动作都有 `generationSpec`（生成片段用的描述）。`surfaces` 规则同 3.7；`triggerableBy` 取 `USER`、`AGENT`、`BOTH`；`description` 是给 agent 看的英文说明。

**动作片段（`ActionClip`）**：外观创建时（外观落地的事务提交之后），本后端为这个外观的每个适用的动作（`compatibleStyles` 包含形象的风格、`enabled`）各排一个 `ACTION_CLIP` 任务（`submitActionClip`，3.5），外观创建时就全部生成，不是用到时才生成；只在外观创建时排这一次，为外观准备其他格式版本的驱动资源包（`LOOK_REPREPARE`，3.9）不会再排。片段生成后走第十一节的审核（`moderation.generated_output_review` 为真时）：高风险则片段 `FAILED`，中风险则片段 `IN_REVIEW` 等人工复核（复核前不下发），通过后标为 `READY`。某个片段失败不影响外观和其他动作，只是这个动作在这个外观上不可用，**不发站内通知**。目录里新增一个动作时，已有外观不自动补生成；由运营在后台触发（`POST /actions/{id}/backfill`，17.4）。**片段用外观创建时那个格式版本的驱动资源包生成（`submitActionClip` 的输入，3.5；补生成也用这个包。外观创建时的包已随格式停用被清理时，改用这个外观现存的、格式版本最小的 `READY` 包；一个都没有就先为当前格式排 `LOOK_REPREPARE`，成功后再排片段），每个外观只生成一次，渲染器格式变了也不重新生成**（形象渲染设计 6.2）：片段的首尾帧不可能和每一档都对上（静态图档显示的是静态标准图），而片段开始和结束已有淡入淡出盖住接缝。引入新的渲染器格式时，发布检查要把片段的首尾帧和这个格式的待机画面比一比；跳变看得出来时，片段改为按格式版本分别生成（用现有的任务机制）。`ACTION_CLIP` 任务由后端自动排，不出现在 `GET /api/tasks` 里（3.3）。

```
GET /api/actions    # 当前端可见的动作目录（名称、图标），客户端用来显示动作按钮；游客凭据也可调用（2.1）
```

**响应：** `{"actions":[{"key":"wave","name":"...","iconUrl":"...","compatibleStyles":["STYLIZED_3D","REALISTIC"],"triggerableBy":"BOTH"}]}`，只含 `enabled`、在当前端可见的动作，按 `sortOrder` 排序；`name` 按 `Accept-Language` 从 `names` 里选（1.2）。没有动作种类字段。

**客户端判断一个动作在某个外观上能不能用，只看 `GET /api/looks/{lookId}/media`（3.9）的响应里有没有这个动作的 `READY` 片段**（`clips[].actionKey`）；目录里有、片段没有的动作不显示按钮。agent 能触发的动作由会话的 dispatch metadata `availableActions` 下发（4.1），同样只含当前外观上有 `READY` 片段的动作。

### 3.9 驱动资源与渲染模型下发

依据：形象渲染设计 4.2、8.4、8.6、第 9 节。

**驱动资源包**：内容是标准图（抠好图、带透明背景的版本和带背景的版本）、渲染器需要的预处理数据（人脸网格、UV 数据等，具体由渲染器决定）、一个清单文件（`rendererFormatVersion`、各文件的 sha256）。**资源包按渲染器格式版本分别保存**：一个外观每个格式版本最多一个包，记在 `LookPackage`（第十八节，`(lookId, rendererFormatVersion)` 唯一）。原因：老客户端的渲染器读不了新格式的包，只保存一个包时，新客户端触发重新准备之后老客户端就拿不到能用的包。包、标准图和片段都存在本后端的 `FileStorage`，经签名地址下载。

- **外观创建时**：形象生成服务按它当前的格式版本准备一个包（`poll` 的 `outputs` 带 `rendererFormatVersion`），在外观落地的同一个事务里写成这个外观的第一条 `LookPackage`（`READY`）。其他格式版本在客户端第一次请求时按需准备（下面的 409）。
- **支持的格式版本**：某个启用的 `RendererModel` 的 `rendererFormatVersion` 等于 N，N 就是支持的格式版本。
- **两类下载分开取**：与格式版本无关的媒体（带背景的标准图、动作片段）用 `media` 接口取，永远不返回 409；只有驱动资源包按格式版本用 `package` 接口取。静态图档（`renderMode=NONE`）的设备和没有可用渲染器的设备只调 `media` 接口。
- **签名地址的有效期**：本节和 3.10 返回的所有 `…Url` 都是签名地址，有效期取配置 `avatar.download_url_ttl_seconds`（17.5，默认 3600）；响应里的 `expiresAt`（UTC）= 签发时刻 + 这个时长，过期后客户端重新调同一个接口取新地址。

```
GET /api/looks/{lookId}/media                             # 标准图和 READY 片段的签名下载地址，与格式版本无关
GET /api/looks/{lookId}/package?rendererFormatVersion=N   # 格式版本 N 的驱动资源包的签名下载地址
GET /api/renderer-models?platform=&abi=                   # 当前平台和 ABI 可用的最新渲染模型和签名下载地址
```

两个外观接口的鉴权相同：JWT，校验外观归属；当前生效的默认数字人的外观所有账号和游客凭据都可以取（3.10、2.1），游客凭据取其他 `lookId` 返回 404 `ASSET_NOT_FOUND`。

**`GET /api/looks/{lookId}/media`**：**响应** `{"lookId":"...","canonicalImageUrl":"...","clips":[{"actionKey":"wave","downloadUrl":"...","sha256":"...","sizeBytes":2345678,"durationMs":5000}],"expiresAt":"2026-10-16T10:00:00Z"}`。
- `canonicalImageUrl` 是带背景的标准图（`AvatarLook.canonicalImageRef`）：静态图档显示它，渲染档在资源包还不能用时也显示它。
- `clips` 只含这个外观 `READY` 的 `ActionClip`（`actionKey` 是 `ActionItem.key`），没有就是空数组。片段的画面宽高恰好等于 `canonicalImageUrl` 那张标准图的宽高，客户端按标准图同一个位置和缩放叠放，不需要处理尺寸或宽高比不同的情况；片段没有声音（3.5）。
- 没有 `rendererFormatVersion`，不返回 409。

**`GET /api/looks/{lookId}/package`**：客户端带自己渲染器的格式版本 `rendererFormatVersion`（必填，正整数，缺失或不是正整数 → 400 `INVALID_REQUEST`）。按下面的顺序判断：
1. N 不是支持的格式版本 → 400 `RENDERER_FORMAT_UNSUPPORTED`（先于下一步：格式停用之后，即使这个外观还留着该格式的旧包也一律 400，直到每天的清理任务把旧包删掉）。
2. 这个外观有格式版本 N 的 `READY` 包 → 返回它（响应见下）。
3. 没有格式 N 的 `LookPackage` 行 → 在一个事务里插入一条 `status=PREPARING`、`attempts=0` 的 `LookPackage` 和一个 `LOOK_REPREPARE` 任务（`submitReprepare`，3.5），返回 409 `PACKAGE_PREPARING`。`(lookId, rendererFormatVersion)` 唯一，并发的请求撞到唯一键时不排任务，直接返回 409。
4. 行是 `PREPARING` → 409 `PACKAGE_PREPARING`，不排任务。
5. 行是 `FAILED`：`nextAttemptAt` 不为空且现在已到 → 用条件更新（`status=FAILED AND nextAttemptAt <= now`）把它置回 `PREPARING` 并排一个 `LOOK_REPREPARE` 任务，返回 409；条件更新没更新到行（并发的另一个请求已经排了）→ 只返回 409。现在还没到 `nextAttemptAt`，或 `nextAttemptAt` 为空（重试已用完）→ 只返回 409，不排任务。

`LOOK_REPREPARE` 任务的结果：
- 成功 → 这条 `LookPackage` 写入 `packageRef`、`sha256`、`sizeBytes`，置 `READY`，`attempts` 置 0、`nextAttemptAt` 置空；有 `OPEN` 的 `LOOK_PACKAGE_PREPARE_FAILED` 告警时自动 `RESOLVED`。
- `FAILED`（任何原因）→ 置 `FAILED`，`attempts + 1`。`attempts` 小于 `generation.reprepare_max_attempts`（17.5，默认 5）时 `nextAttemptAt = 现在 + min(retry.initial_seconds × 2^(attempts−1), retry.max_seconds)`（与 13.1 的退避同一公式，加正负 10% 的随机抖动）；达到上限时 `nextAttemptAt` 置空、不再自动重试，并写一条 `AdminAlert`（`LOOK_PACKAGE_PREPARE_FAILED`，17.4）。管理员人工关闭这条告警（`POST /alerts/{id}/resolve`）时把这条 `LookPackage` 的 `attempts` 清零、`nextAttemptAt` 置为现在，下一次请求重新排任务（本节新定）。
- 外观在准备期间被删除 → 任务结果丢弃（同 3.5 的落地规则）。默认数字人的外观同样适用，任务是系统任务（`GenerationTask.accountId` 为空，3.10）。

**409 `PACKAGE_PREPARING` 带重试时间**：照 1.6 的 429 的写法，带响应头 `Retry-After`（整数秒）和 `data.retryAfterSeconds`（同一个值）。`PREPARING` 时取 30（工程常量 [推断：重新准备只重做驱动准备，按分钟级估计]）；`FAILED` 且有 `nextAttemptAt` 时取到 `nextAttemptAt` 的剩余秒数（向上取整，至少 1）；`FAILED` 且重试已用完时取 `retry.max_seconds`。客户端收到 409 时先显示 `media` 接口给的静态图，按 `retryAfterSeconds` 之后再请求；客户端加载资源包之前仍要核对清单里的 `rendererFormatVersion` 与自己的渲染器一致，不一致就不加载（防御性检查，形象渲染设计 8.2）。

**响应：** `{"lookId":"...","rendererFormatVersion":1,"package":{"downloadUrl":"...","sha256":"...","sizeBytes":1234567},"expiresAt":"2026-10-16T10:00:00Z"}`。`rendererFormatVersion` 恒等于请求的 N；`package` 是格式 N 的 `LookPackage`。

**格式版本的停用**：停用一个格式版本前，先按第二十四节把各渠道生效版本的 `minVersionCode` 提到不再使用这个格式的 App 版本（强制更新），再停用使用这个格式的 `RendererModel`。之后带这个格式来请求的客户端得到 400 `RENDERER_FORMAT_UNSUPPORTED`（这时它们已经被强制更新拦住）。没有任何启用的 `RendererModel` 使用的格式版本，它的 `LookPackage` 行和文件由每天一次的清理任务删除（第十八节）。

**`GET /api/renderer-models`**（JWT 或游客凭据，2.1）：返回 `RendererModel` 里 `enabled`、匹配 `platform` 和 `abi` 的最新版本（**最新**：先取 `rendererFormatVersion` 最大的，同一个格式版本里取登记时间 `createdAt` 最晚的），所有构建、账号和游客拿到的一样（发布构建也用格式 1 的渲染模型，形象渲染设计 8.3）。渲染模型文件除了渲染网络，还包括手机上从音频算嘴形用的 LSTM 权重、`pca_mediapipe.pkl` 和转换层的形状表（形象渲染设计 7.3、7.4、8.4）。渲染模型 zip 上传的单文件上限是 `upload.render_asset_max_bytes`（17.5），后台上传的类型和检查见 17.4 附·通则第 6 条；从形象生成服务取回产物文件的同一个上限见 3.5。

**响应：** `{"model":{"rendererKind":"AVATAR_RENDERER_V1","version":"...","rendererFormatVersion":1,"downloadUrl":"...","sha256":"...","sizeBytes":12345678,"minVersionCode":120},"expiresAt":"2026-10-16T10:00:00Z"}`，字段取自 `RendererModel`（`downloadUrl` 是 `fileRef` 的签名地址，有效期同上）；`minVersionCode` 是能使用这个模型的最低 App 版本号（整数，含义同第二十四节的 `minVersionCode`）。**参数**：`platform` 不是 `ANDROID` 或 `IOS`，或 `abi` 缺失、为空、不匹配 `^[A-Za-z0-9_-]{1,32}$` → 400 `INVALID_REQUEST`；参数格式合法但没有匹配的模型时 `model` 和 `expiresAt` 都为 `null`，不是错误。

**内部接口（云端渲染服务调用）**：

```
GET /api/internal/looks/{lookId}/media
GET /api/internal/looks/{lookId}/package?rendererFormatVersion=N
```

云端渲染服务（只给手机本地跑不动的设备用，`renderMode=CLOUD`，4.1）按 dispatch metadata 的 `lookId` 取片段（`media`）和自己渲染器格式版本的资源包（`package`）的签名下载地址；判断规则和响应同上面两个客户端接口（409 `PACKAGE_PREPARING` 时按 `retryAfterSeconds` 重试）。按 1.8 签名调用，调用方标识 `render-package`，密钥 `RENDER_PACKAGE_SIGNING_SECRET`；同样适用于默认数字人的外观。

### 3.10 系统默认数字人

依据：形象渲染设计 4.3。

游客（2.1、4.3）和没有形象的账号都跟系统默认数字人对话，它由服务器下发、可以渲染，不再是客户端内置的形象。管理员在后台上传一张**有肖像授权**的图（或者合成的、不对应真人的图），选风格、填名字（`DefaultAvatar.name`，长度和字符规则同 2.5.1；所有语言用同一个名字，它是专有名词），按 3.2 同样的流程生成一个外观（服装、背景用默认条目）和它的动作片段，得到 `DefaultAvatar`（17.4）。每套部署各自配置，同一时刻只有一个生效。**名字创建时必填**，规则同 2.5.1 的名字规则，不合规 → 400 `INVALID_REQUEST`；改名（`PUT /default-avatars/{id} {name}`）同一规则，写审计日志（17.2）。

**状态与失败**：`DefaultAvatar.status` 取 `DRAFT`（刚上传，或生成失败后退回）、`GENERATING`、`READY`（生成成功），是否生效另由 `isActive` 表示。状态链：`DRAFT` → `GENERATING`（`POST /default-avatars/{id}/generate`，只对 `DRAFT` 有效）→ `READY`（生成成功）→ 生效（`POST /default-avatars/{id}/activate`，要求 `READY`；同一时刻只有一个生效，激活新的时旧的变为非生效但保留）。生成失败（含人工复核拒绝）退回 `DRAFT` 并写 `failureReason`（可空，取 3.3 的六个值之一），再调 `generate` 重试时清空它；没有 `FAILED` 状态。违反上述状态要求一律 409 `INVALID_STATE`；只有非生效且不在生成中的才能 `DELETE`。`GET /default-avatars` 返回 `{"items":[{"id","name","style","status","isActive","failureReason","lookId","sourceImageUrl","previewUrl"}]}`，不分页，按创建时间倒序（`sourceImageUrl`、`previewUrl` 是短时效签名地址，规则见 17.4 的通则；`previewUrl` 是它唯一外观的预览，未生成时 `null`）。

**系统任务的落地**：默认数字人的生成任务（`type=AVATAR`，`accountId` 为空）成功后，只创建一条 `AvatarLook`（`avatarAssetId`、`accountId` 为空）、它的驱动资源包和动作片段，并把 `DefaultAvatar.lookId` 指向它；不创建 `AvatarAsset`，不改任何 `User` 的指针，不触发里程碑，不计事件 `avatar_created`。

**部署上还没有生效的默认数字人时**（新部署在管理员生成并设为生效之前就是这样，2026-10-18 补）：`GET /api/default-avatar` 返回 404 `RESOURCE_NOT_FOUND`；游客和没有形象的账号的会话照常发起：dispatch 的 `lookId` 传空字符串、`availableActions` 传空数组、`companionName`（账号没有设置名字时）传空字符串，`renderMode` 取 `NONE`（没有外观就没有可渲染的东西），agent 只发布音频轨；`/v1/chat/turn` 同样取空值。客户端收到 404 时显示一个空的形象容器。

- 生成时不需要上传声明（管理员上传，肖像授权由运营负责）；年龄判断照做，默认数字人也不能是未成年人。
- 它的生成任务没有所属账号：`GenerationTask.accountId` 为空表示系统任务，系统任务不计入任何账号的数量上限、不扣额度。

```
GET /api/default-avatar    # 游客凭据或账号都可调用
```

返回当前生效的默认数字人的外观、标准图和片段的签名下载地址，与格式版本无关，不返回 409。渲染方式与用户的形象完全相同：要本地渲染的设备再用返回的 `lookId` 调 3.9 的 `GET /api/looks/{lookId}/package?rendererFormatVersion=N` 取驱动资源包（游客凭据只能取这个外观，2.1；没有格式 N 的包时同样是 409 `PACKAGE_PREPARING`，排的是系统任务 `LOOK_REPREPARE`）。静态图档的设备和没有可用渲染器的设备只调本接口。

**响应：** `{"style":"STYLIZED_3D","name":"...","lookId":"...","canonicalImageUrl":"...","clips":[{"actionKey":"wave","downloadUrl":"...","sha256":"...","sizeBytes":2345678,"durationMs":5000}],"expiresAt":"2026-10-16T10:00:00Z"}`。`style` 是 `DefaultAvatar.style`；`lookId` 是它的唯一外观；`canonicalImageUrl`、`clips`、`expiresAt` 与 3.9 的 `media` 响应相同（签名地址的有效期同 3.9）。会话里，游客和没有形象的账号的 dispatch metadata `lookId` 取默认数字人的外观（4.1、4.3）。`name` 是默认数字人的名字：游客和没有设置 `companionName` 的账号，客户端显示它，dispatch 和文字轮次的 `companionName` 也取它（4.1、4.3、5.4）。

---

## 四、LiveKit 会话模块

### 4.1 发起对话会话

```
POST /api/sessions
```

本节是已注册账号的流程；游客（游客凭据，2.1）的差异见 4.3。

**请求体：** `{"timezone":"Asia/Singapore","renderTier":"DEVICE"}`。`renderTier` 是客户端本地测速得出的设备能力（形象渲染设计 8.5）：客户端只发 `DEVICE`（本机能本地渲染）或 `CLOUD`（本机跑不动，需要云端渲染）；`CLOUD` 只表示设备能力，用不用得上云端由本后端在第 3 步按部署开关和账号权益决定，客户端读不到部署开关，不自己判断。选填：缺失或不是 `DEVICE`、`CLOUD`、`NONE` 时按 `NONE` 处理，不报错（`NONE` 仍然接受，按静态图加声音处理）；用来算第 3 步的 `renderMode`。`timezone` 必填，是 IANA 时区名，由客户端取设备当前时区。原因：agent 每轮要注入用户当地的当前日期时间，只有客户端知道用户在哪个时区。校验：名字必须在 `ZoneId.getAvailableZoneIds()` 里且不是偏移形式（`+08:00`、`GMT+8`、`Z` 等一律无效；`ZoneId.of` 也接受它们，所以不能只靠它），缺失或无效返回 400 `INVALID_TIMEZONE`。**客户端取不到 IANA 名（设备默认时区是偏移形式，如 `+08:00`、`GMT+8`）时的回退**：整点偏移用 `Etc/GMT` 加相反符号的整数（UTC+8 → `Etc/GMT-8`，UTC−5 → `Etc/GMT+5`，这是 IANA 的约定，名字在 `ZoneId.getAvailableZoneIds()` 里）；非整点偏移取代表时区：+05:30 `Asia/Kolkata`、+05:45 `Asia/Kathmandu`、+03:30 `Asia/Tehran`、+04:30 `Asia/Kabul`、+06:30 `Asia/Yangon`、+09:30 `Australia/Darwin`、+10:30 `Australia/Lord_Howe`、+08:45 `Australia/Eucla`、+12:45 `Pacific/Chatham`、+13:45 `Pacific/Chatham`（夏令时）、−02:30 `America/St_Johns`（夏令时）、−03:30 `America/St_Johns`、−09:30 `Pacific/Marquesas` [推断，未逐项核对 IANA 数据库]；**偏移为 0（`+00:00`、`GMT`、`Z`）发 `UTC`**（在 `ZoneId.getAvailableZoneIds()` 里）；不在上面列出的偏移也用 `UTC`。这样设备时区写法特殊也发得出请求，日界线至多差到代表时区的夏令时，此时不创建 Session、不 dispatch。校验通过后把它写入 `User.timezone`（每次发起会话都刷新），第八节的召回推送按用户当地时间发送时用。

**逻辑：**
1. **先对该账号加锁**（数据库行锁或咨询锁），在锁内按这个顺序完成"结束该账号已有的进行中会话 → 检查剩余分钟 → 创建 Session"（15.6；额度检查不通过时，已经结束的旧会话不恢复）：账号已有进行中的会话时，先删除它的房间并按 15.6 的结束流程收尾（`endedAt` 取 `userLeftAt`，它为空时取当前时间），**一个账号同一时刻只有一个进行中的会话**，防止并发发起绕过额度。检查通话额度（15.6）：按适用的通话额度键（`call.daily_minutes`、`call.monthly_minutes`；发起时没有任何有效权益的账号还有 `call.lifetime_minutes`，这样的会话记 `Session.freeTier=true`，15.6）的生效值判断。**没有任何有效权益的账号，适用的键都没有生效值（没有配置）时不能通话**（有有效权益的账号不受这条兜底约束），返回 403 `FEATURE_LIMIT_REACHED`（`message` 写明"Call quota is not configured"，`data={"feature":"CALL"}`，无 `limit`、`resetAt`）；某个有生效值且不是"不限"的键，本窗口已用完，同样返回 403 `FEATURE_LIMIT_REACHED`（`message` 写明是日额度、月额度还是终身额度，`data` 带 `{"limit":"DAILY","resetAt":"..."}` 、`{"limit":"MONTHLY","resetAt":"..."}` 或 `{"limit":"LIFETIME"}`（终身额度不重置，没有 `resetAt`），三种 `data` 都另带 `"feature":"CALL"`，文字额度用 `"CHAT"`，5.4）；**多个额度同时用完时，报告重置最晚的那一个**（终身额度不重置，排在最后），因为用户要等到它重置才能再次通话。这两种情况都不创建 Session、不 dispatch，记事件 `session_start_failed`（`reason=FEATURE_LIMIT_REACHED`，第七节）；否则算出本次通话的截止时间 `deadlineAt`。然后生成一个房间名（`room_` 加不带横线的 UUID，由服务端生成，不含账号信息，唯一）
2. **先落一条 `Session` 记录**（房间名、accountId、`timezone`、`modelTier`、`language`、`renderMode`（按第 3 步的规则算出）、`freeTier`、`deadlineAt`、`requestedAt`（落库时间，之后不再改动，统计接通耗时用，17.6）、开始时间），得到 `sessionId`。必须在 dispatch 之前：agent 写聊天记录要用 `sessionId`（见第五节），而 `sessionId` 只有记录落库后才存在
3. **用 LiveKit Server SDK 的 `AgentDispatchServiceClient` dispatch 一个 Agent 实例加入这个房间（agent 名字取配置 `LIVEKIT_AGENT_NAME`，必须与 AvatarAgent 一致，见 1.5），metadata 为 JSON 字符串：`{"accountId":"...","sessionId":"...","voiceId":"...","timezone":"...","persona":"...","companionName":"...","modelTier":"...","language":"...","guest":false,"renderMode":"DEVICE","availableActions":[{"key":"wave","description":"..."}],"lookId":"...","deadlineAt":"2026-09-30T10:00:00Z"}`**
   - `voiceId`：当前账号 `currentVoiceAssetId` 对应资产的 `resultRef`，即合成服务里的音色名（见 3.5）。账号没有当前音色时（以及游客，4.3）传空字符串，agent 会使用它自己配置的默认音色。**只有生成成功（`SUCCEEDED`，即合成服务已确认注册）的音色资产才会成为当前音色（3.1）**，所以这里的 `voiceId` 指向的音色在合成服务里已经注册；agent 的回退默认音色只是保险，不是保证
   - `timezone`：原样取自请求体（已在入口校验过有效）
   - `persona`：读取当前账号的 `User.persona`（见 2.5），没有设定时传空字符串，与 `voiceId` 同一模式
   - `companionName`：字符串。当前账号的 `User.companionName`（2.5.1），没有设置时取系统默认数字人的 `name`（3.10）；两者都没有（账号没有设置名字，且部署上还没有生效的默认数字人，3.10）时传空字符串。有值时是 1 到 30 个 Unicode 码点、已去掉首尾空白、不含 `Cc` 和双向覆盖字符（2.5.1 的名字规则）。agent 把它作为数字人自己的名字放进系统提示词，**以 `companionName` 为准，persona 文本和基础提示词（运维配置的 `LLM_SYSTEM_PROMPT`、`CHAT_SYSTEM_PROMPT`）里写的角色名都让位**；agent 遇到缺失、`null` 或空字符串时不加名字那一句，**不拒绝任务**（同 `persona`、`voiceId`，不是 `sessionId`、`accountId` 那种必填字段）（2026-10-18 加，需要 AvatarAgent 实现，见 19.2）
   - `modelTier`：该账号 `chat.model_tier` 功能开关的生效值（15.3），例如 `standard`。agent 据此选择模型，档位名与 AvatarAgent 的模型配置对应，这是跨项目约定，见第十九节。没有配置时取开关的默认值
   - `language`：当前账号的 `User.conversationLanguage`（见 2.10）；从未设置，或已经不在 `chat.conversation_languages` 里时传 `en`。agent 据此决定识别和回答的语言；它收到不支持的语言会改用英语，所以这里必须守住 2.10 的列表
   - `guest`：布尔，已注册账号的会话为 `false`，游客会话（4.3）为 `true`。`guest=true` 时 `accountId`、`voiceId`、`persona` 都是空字符串，agent 不写聊天记录、不读写记忆。缺省按 `false`
   - `renderMode`：本后端按请求体的 `renderTier` 算出：`DEVICE` → `DEVICE`；`CLOUD`，且部署配置 `render.cloud_enabled`（17.5）和账号功能开关 `render.cloud`（15.3）都为真 → `CLOUD`，否则 `NONE`；`NONE` → `NONE`。会话没有可渲染的外观时（账号没有形象，部署上也没有生效的默认数字人，3.10）一律取 `NONE`，不论 `renderTier`。agent 据此决定合成语音发给谁：`DEVICE` 以字节流发给用户的手机（手机自己播放和渲染），`CLOUD` 先请云端渲染服务加入房间再发给它（3.9），`NONE` 照旧发布音频轨（形象渲染设计 7.1、第 9 节）。同一值在第 2 步写进 `Session.renderMode`，并在响应里返回
   - `availableActions`：数组 `[{"key","description"}]`，当前外观上可用、`triggerableBy` 含 `AGENT`、`enabled` 的动作（3.8），并按发起这次会话的请求的 `X-Platform`、`X-Channel` 做和 `GET /api/actions` 一样的按端筛选（3.7、3.8：在这个端不可见的动作不进列表，agent 不会触发商店构建里隐藏的动作；文字对话每一轮按该轮请求的头算），`description` 是给 agent 看的英文说明；agent 把它们作为 LLM 可以调用的动作
   - `lookId`：当前形象的当前外观（`AvatarAsset.currentLookId`）；没有形象的账号取系统默认数字人的外观（3.10）；账号没有形象、部署上也没有生效的默认数字人时传空字符串（3.10）
   - `deadlineAt`：本次通话的截止时间（UTC，ISO-8601），即第 1 步算出的 `deadlineAt`（2026-10-17 加）。agent 按它定给云端渲染服务签的房间 token 的有效期（形象渲染设计第 9 节；AvatarAgent `docs/design.md` 第 7 节），不再固定 12 小时，所以 `session.max_duration_minutes` 不需要上限。dispatch 发生在第 4 步重算之前，重算后的截止时间最多晚约（`session.agent_join_retries` + 1）× `session.agent_join_timeout_seconds`（默认 24 秒）加上几次调用的耗时，所以 agent 签 token 时要在它上面加余量，不少于 10 分钟（同第 5 步房间 token 多给 10 分钟的做法）[推断：余量的取法]
   - 这十三个字段是本后端与数字人 agent（独立项目 `AvatarAgent`）之间的契约，字段名和含义不要改动
   - dispatch 失败（抛异常）时：删除第 2 步刚落库的 `Session` 记录，返回 503 `AGENT_UNAVAILABLE`，不发放房间 token，记事件 `session_start_failed`（`reason=DISPATCH_FAILED`）。否则会留下永远没有结束时间的记录
4. **确认 agent 已经加入房间，没有加入就重发 dispatch。** 观察到的事实：AvatarAgent 联调中有两次 dispatch 是在 agent 的 worker 上报"有空余容量"之前 0.7 到 1.4 秒创建的，agent 始终没有收到任务，之后 20 秒里也没有重新派发 [核实 AvatarAgent 联调 2026-10-01，LiveKit 服务器日志与 agent 日志的时间戳]。看起来是服务器在没有可用 worker 的瞬间收到显式 dispatch 时不排队、直接放弃，但服务器日志在成功和失败的房间里都有同样的"not dispatching agent job"一行，这个机制没有证实 [推断]。无论机制如何，dispatch 调用成功不等于有 agent 来了。
   - 后端在 dispatch 之后，每隔约 0.5 秒用 `RoomServiceClient.listParticipants` 查房间里有没有 agent 参与者（`kind` 为 AGENT；identity 以 `render_` 开头的参与者是云端渲染服务，参与者类型也是 agent，但不算 agent，不写进 `Session.agentIdentity`，见 4.2），最长等 `session.agent_join_timeout_seconds`。看到 agent 就把 `Session.agentJoinedAt` 置为当前时间、把该参与者的 identity 记进 `Session.agentIdentity`（4.2 靠它区分 agent 和用户），这是条件更新（要求 `agentJoinedAt` 和 `endedAt` 都为空）；更新不到行，说明这条 Session 已被取代或已被清理，按失败处理。**同一次条件更新里把 `startedAt` 重置为这个时间，并重新计算 `deadlineAt`**：第 1 步记下三个量——剩余额度秒数 `R`（各个有生效值且不是“不限”的键的剩余中最小的）、窗口结束时刻 `W`（这些键的窗口结束时间中最早的，没有就不参与）、硬上限秒数 `H`（`session.max_duration_minutes`）——重算时 `deadlineAt = min(startedAt + R, W, startedAt + H)`，所以等待 agent 的时间不会把截止时间推过窗口边界（15.6 的“不跨窗口”在这里同样成立）；等待期间窗口恰好结束、`W` 不晚于 `startedAt` 时，`deadlineAt` 取 `startedAt`，通话立即被到点扫描结束，响应的 `remainingSeconds` 为 0。通话时长（15.6 的 `durationSeconds = endedAt - startedAt`）和到点截止都从 agent 真正在房间里开始算，等待 agent 的最长约 24 秒不计入用户的额度，也不会让客户端倒计时比实际剩余时间短。响应里的 `deadlineAt` 取这个重新计算后的值。
   - 超时则先 `listDispatch` 找出该房间尚未完成的 dispatch 并 `deleteDispatch`，再重新 dispatch 一次（metadata 同上）；重发调用本身抛异常也算这次重发失败；最多重发 `session.agent_join_retries` 次。**重发能否让 agent 接到任务没有实测，联调时要验证（19.2）。**
   - 最终失败（重发用尽，或 Session 已被取代）：**先删除第 2 步落库的 `Session` 记录，再用 `RoomServiceClient` 删除房间**（房间不存在视为成功）。顺序不能反：先删房间会产生 `room_finished` webhook，webhook 找到 Session 就会走会话结束流程（4.2），把这次没有开始的通话计入额度和养成统计；先删 Session，webhook 找不到房间，按 4.2 静默忽略。然后返回 503 `AGENT_UNAVAILABLE`，不发放房间 token，记事件 `session_start_failed`（`reason=AGENT_UNAVAILABLE`，第七节）：这类 Session 不留记录，事件是它在统计里的唯一痕迹。**只有重发用尽才记这个事件**；因为被同一账号的新请求取代而失败的不记（那是用户重复点击，不是 agent 不可用，记了会拉低接通成功率）。
   - **`agentJoinedAt` 为空的 `Session` 是"启动中"，不是"进行中"。** 第 1 步"结束该账号已有的进行中会话"、到点扫描、webhook 遇到启动中的 Session，都走上一条的方式（删记录、删房间），不调用会话结束流程，不计入额度和养成统计（统一实现在 15.6 的 `finalizeSession` 里）。这样同一账号的第二次 `POST /api/sessions` 在第一次还在等 agent 时到达，不会把它当作已开始的通话结算，第一次随后的条件更新更新不到行，也按失败处理，"一个账号同一时刻只有一个进行中的会话"依然成立。
   - **agent 已加入、但用户一直没有进入房间的 Session 同样不是一次通话。** 触发场景：客户端在等待本接口返回的过程中取消，或拿到房间 token 后连接失败、进程被杀，客户端从来没有（或已经离开）房间，而 agent 参与者还在房间里，房间不会因为"没有人"而关闭（agent 本身是参与者，这一点没有实测 [推断]）。规则：`agentJoinedAt` 不为空且 `endedAt` 为空的 Session，如果在 `session.user_join_timeout_seconds`（默认 30，提议值）内房间里一直没有出现过非 agent 的参与者，到点扫描把它当作"没有开始的通话"处理——先删 `Session` 记录、再删房间，不计入额度和养成统计，和上一条同一实现（`finalizeSession` 里按"从未有用户加入"判断），丢弃时记事件 `session_discarded`（`reason=USER_NOT_JOINED`，第七节）。判断依据是 `Session.userJoinedAt`，起算点是 `agentJoinedAt`（`session.user_join_timeout_seconds` 从 agent 加入的时刻算起）：LiveKit 的 `participant_joined` webhook（4.2）里参与者不是 agent 时写入，只写第一次。webhook 投递可能丢，所以到点扫描在丢弃之前先用 `listParticipants` 查一次房间，有非 agent 参与者就补写 `userJoinedAt`、不丢弃。没有这一条，客户端无法终止一个已经计时的会话，额度会被白白扣掉直到下一次发起、到点或房间关闭。
   - **这个接口因此最长会阻塞（重发次数 + 1）× 等待秒数**（默认 3 × 8 = 24 秒，提议值），客户端对它的超时要大于这个值。账号锁只覆盖第 1、2 步，这一步在锁外。`listParticipants`、`listDispatch`、`deleteDispatch` 在 Java SDK 里的方法名开发时核实，和上面的 `createDispatch` 一样，别猜。
5. 用 LiveKit Server SDK 的 `AccessToken` 发一个房间 token 给客户端用：参与者 identity 是 `u_<sessionId>`（用户和游客都一样，不含账号 ID，也不可能等于 agent 的 identity）；有效期 `session.max_duration_minutes` 加 10 分钟；grant 只有 `roomJoin`（仅这个房间）、可发布可订阅，没有 `roomAdmin`、`roomCreate`

**⚠️ 需要开发时核实**：`io.livekit:livekit-server:0.16.0` 里 `AgentDispatchServiceClient.createDispatch` 有没有直接支持传 metadata 的重载（JS SDK 是 `createDispatch(roomName, agentName, {metadata:...})`，Java/Kotlin SDK 对应的写法需要看源码/Javadoc确认，别猜）。

**响应：** `{"code":"200","message":"success","data":{"sessionId":"...","roomName":"...","roomToken":"...","serverUrl":"wss://...","deadlineAt":"2026-09-30T10:00:00Z","remainingSeconds":3600,"quotaLimited":true,"renderMode":"DEVICE"}}`。`renderMode` 是第 3 步算出的值，客户端据此决定接收方式（字节流、云端渲染服务的音视频轨，或音频轨）。`renderMode=CLOUD` 的客户端收不到云端渲染服务的音视频轨时，要播放 agent 的音频轨，并显示当前外观的标准图（同 `NONE`）：agent 请不来渲染服务（没配置、请求失败）时这次会话改为发布音频轨。判断信号：手机看到 agent 参与者（identity 不以 `render_` 开头）发布的音频轨，就按 `NONE` 处理（正常的 `CLOUD` 会话里 agent 不发布音频轨）（AvatarAgent `docs/design.md` 第 7 节；形象渲染设计 8.5）

`serverUrl` 是客户端连接 LiveKit 的地址，取自后端配置（自建 LiveKit 的对外地址）。LiveKit 标准 token 端点的响应也是 `server_url` + `participant_token`（LiveKit 文档 `frontends/build/authentication/endpoint`），客户端的 `TokenSource` 需要这两个值；地址放在后端而不是写死在客户端，自建服务器换地址时客户端不用发版。

`deadlineAt` 是本次通话的截止时间（UTC），**所有账号都有**：受通话时长限额约束的账号取剩余额度和用量窗口结束时间中较早者，同时不超过硬上限 `session.max_duration_minutes`；不受限额约束的账号就是硬上限。`quotaLimited` 表示本次通话是否受限额约束，客户端只在为 `true` 时显示剩余时间倒计时并在临近时提醒。`remainingSeconds` 是响应生成时刻到 `deadlineAt` 的秒数（向下取整，和 `deadlineAt` 一起按等到 agent 加入之后重新计算的值给出）：客户端用它在本地倒计时，不依赖设备时钟与服务器时间一致；`deadlineAt` 仍然给出，用于对账和日志。到点后端会强制结束通话（15.6）。

**客户端每次"开始通话"只应调用本接口一次。** 每调用一次就产生一条 `Session` 记录和一次 dispatch，客户端不能把本接口当作"刷新 token"来用；房间 token 过期前的重连由 LiveKit SDK 用已有 token 处理。

### 4.2 LiveKit Webhook 接收

```
POST /livekit/webhook
```

**鉴权：** 用 LiveKit Server SDK 的 `WebhookReceiver` 校验签名，不是用户JWT。

**逻辑：**
- **云端渲染服务不是 agent，也不是用户**：identity 以 `render_` 开头的参与者（`render_<sessionId>`）是云端渲染服务（参与者类型是 agent，由 agent 签发它的 token，形象渲染设计第 9 节）。本节、4.1 第 4 步和 15.6 的所有判断都把它排除在外：不写进 `Session.agentIdentity`，它进房间不算用户进入（不写 `userJoinedAt`），它离开不算用户离开、不结束会话（不写 `userLeftAt`），存活核对和到点扫描里也不算"房间里还有用户"。
- 处理三种事件，其它事件类型忽略。LiveKit 会按顺序投递同一个目标的事件（前一个投递成功或被放弃之后才发后一个），投递失败会多次重试，`createdAt` 是 UNIX 秒 [核实 docs.livekit.io 的 webhooks-events 页，2026-10-08 读取]；写入用条件更新：`Session.lastParticipantEventAt` 记最近已应用的参与者事件的 `createdAt`，早于它的 `participant_joined`、`participant_left` 只忽略、不应用，所以乱序或重试的旧事件不会覆盖新事件，也不会在用户仍在房间时误关房间：
  - `participant_joined`，参与者不是 agent、也不是云端渲染服务（identity 以 `render_` 开头的忽略；判据：`participant.identity` 不等于 `Session.agentIdentity`——4.1 第 4 步用 `listParticipants` 识别出 agent 时记下它的 identity；**`agentIdentity` 还为空时**（agent 的 `participant_joined` 通常早于 0.5 秒一次的轮询）改用 `participant.kind == AGENT` 判断，`kind` 也取不到就忽略这个事件，由到点扫描丢弃前的 `listParticipants` 补写 `userJoinedAt`（4.1）[推断，字段名开发时核实]）：按房间名找 `Session`，`userJoinedAt` 为空时置为事件的 `createdAt`，同时把 `userLeftAt` 清空（用户重新进入）。
  - `participant_left`，参与者不是 agent、也不是云端渲染服务（identity 以 `render_` 开头的忽略）：`endedAt` 为空的 `Session` 置 `userLeftAt = createdAt`。房间由 15.6 的“用户离开后关闭房间”关闭，不在这里直接关。
  - `room_finished`：下一条。
- 根据房间名找到对应 `Session` 记录，调用 15.6 的会话结束流程（`endedAt` 取 `userLeftAt`，它为空时取事件的 `createdAt`；回填结束时间、时长，触发养成统计；`accountId` 为空的游客会话不触发养成统计，4.3）；`agentJoinedAt` 为空的（启动中，4.1 第 4 步）会被会话结束流程直接删除，不计入统计
- **幂等**：LiveKit 官方文档明确说webhook投递没有保证、会重试，同一个事件可能收到多次。幂等键是 `Session.statsAppliedAt`：只有它还是空的时候才真正处理，已经处理过的直接忽略，返回200。通话被后端到点强制结束（15.6）时同样走会话结束流程并置 `statsAppliedAt`，所以之后到达的 webhook 会被忽略，而养成统计不会漏算
- **找不到对应房间**（可能是历史数据清理后的重放，或者环境不匹配）：静默忽略，返回200，**不要抛异常**，否则LiveKit会一直重试
- **房间怎么关闭**：用户离开后房间里只剩 agent。LiveKit 的房间在最后一个参与者离开、经过一小段延迟后关闭 [核实 docs.livekit.io 的 rooms 页，2026-10-08 读取]；agent 本身是参与者，AvatarAgent 在用户离开后是否自己断开没有实测 [推断，19.2]，所以后端不依赖它：15.6 的“用户离开后关闭房间”会在 `userLeftAt` 之后 `session.user_leave_grace_seconds` 关闭房间，`room_finished` 随后到达。

### 4.3 游客发起会话（与 4.1 的差异）

游客凭据（2.1）调用 `POST /api/sessions` 走这条路径。除下表列出的之外与 4.1 相同。

| 4.1 的步骤 | 游客的做法 |
|---|---|
| 请求体 | `{"timezone":"Asia/Singapore","language":"en","renderTier":"DEVICE"}`。`renderTier` 同 4.1；`timezone` 同 4.1 必填；**`language` 必填**：游客没有账号，没有 `User.conversationLanguage`（2.10），缺失或空串返回 400 `INVALID_REQUEST`；取值必须在 `chat.conversation_languages` 里，否则 400 `INVALID_LANGUAGE`；游客在登录前从客户端配置的 `conversationLanguages`（26.2）取得这份列表。**不写 `User.timezone`**（没有 `User`） |
| 第 1 步：加锁、额度 | 锁的键是 `deviceId`（取自凭据），**一个设备同一时刻只有一个进行中的会话**，规则同账号。额度检查读 `GuestDevice`：`grantedSeconds` 为空且 `guest.call_minutes_total`（17.5）已配置时，先记入当时的值；`grantedSeconds`（空按 0）减去 `usedSeconds`，不足返回 403 `GUEST_QUOTA_EXHAUSTED`，不创建 Session、不 dispatch，记事件 `session_start_failed`（`reason=GUEST_QUOTA_EXHAUSTED`，第七节）。游客额度**不分用量周期**，是这台设备终身一次性的额度（试用） |
| 截止时间 `deadlineAt`、`quotaLimited` | `deadlineAt` 取剩余额度和硬上限 `session.max_duration_minutes` 中较小者；`quotaLimited` 恒为 `true` |
| 第 2 步：`Session` 记录 | `accountId` 为空，另写 `deviceId`（`GuestDevice` 的主键，哈希）、`freeTier=false`；`timezone`、`language` 取自请求体；`modelTier` 取 `chat.model_tier` 功能开关的默认值（15.3，没有账号就没有权益叠加） |
| 第 3 步：dispatch metadata | `guest` 为 `true`；`accountId`、`voiceId`、`persona` 传空字符串（agent 用它自己的默认音色和默认角色）；`companionName` 取系统默认数字人的 `name`（3.10；部署上没有生效的默认数字人时传空字符串）；`sessionId`、`timezone`、`language`、`modelTier` 同上；`lookId` 取系统默认数字人的外观（3.10；部署上没有生效的默认数字人时传空字符串，`availableActions` 传空数组），`availableActions` 按这个外观算；`deadlineAt` 同 4.1（游客的截止时间，上一行）；`renderMode` 照常按 `renderTier` 分档（4.1；部署上没有生效的默认数字人时取 `NONE`，3.10），其中账号功能开关 `render.cloud` 取开关的默认值 [推断：同上一行 `modelTier` 的做法，游客没有权益叠加] |
| 第 4、5 步 | 同 4.1 |
| 会话结束（15.6 `finalizeSession`） | 回填 `endedAt`、`durationSeconds` 后，把 `durationSeconds` 加到 `GuestDevice.usedSeconds`；**不触发养成统计**，置 `statsAppliedAt` |
| 响应 | 同 4.1；客户端另外读 `GET /api/guest/quota`（2.1）刷新剩余额度 |
| 保留 | 游客 `Session`（`accountId` 为空）保留 `guest.session_retention_days` 天（从 `startedAt` 起算）后由每天一次的清理任务删除；游客没有账号，账号删除流程（13.1）不会清理它们 |

**agent 的行为（跨项目约定，19）**：收到 `guest=true` 的 dispatch 时，不调用 `/api/internal/messages`（5.1），不读写 AvatarMemory，对话内容不落任何存储。这是 AvatarAgent 的 dispatch 契约里的 `guest` 字段（字段清单见 4.1），AvatarAgent 项目必须实现。

---

## 五、聊天记录模块

### 5.1 内部接口：写入聊天消息

```
POST /api/internal/messages
Header: X-Key-Id、X-Timestamp、X-Nonce、X-Signature（签名规则 1.8，调用方标识 `agent-messages`，密钥 `INTERNAL_SIGNING_SECRET`）
```

这是**数字人 agent 调用**的内部接口，不走用户JWT，走独立的服务间密钥。**以消息为单位写入，不要求成对**：助手先开口的问候、连续几条同角色消息、被打断的回复、只有用户消息的一轮，都是合法的。

**游客会话（dispatch 的 `guest=true`，4.3）不调用本接口**：游客没有账号，聊天内容不保存。**文字对话（5.4）的消息也不走本接口**，由后端自己存。

**请求体：**
```json
{"accountId":"...","sessionId":"...","messages":[
    {"messageKey":"<uuid>","role":"user","text":"...","createdAt":"2026-09-30T01:02:03.456Z","interrupted":false}
]}
```

| 字段 | 规则 |
|------|------|
| accountId | 必填，账号 UUID |
| sessionId | 必填，必须是该账号自己的会话，否则 400 `INVALID_REQUEST`（防止 agent 的 bug 把消息写到别人名下） |
| messages | 1 到 `chat.messages_max_batch`（默认 50）条，按列表顺序处理；单元素列表合法；0 条或超过上限返回 400 `INVALID_REQUEST` |
| messageKey | 必填，agent 为每条消息生成的 UUID。`(sessionId, messageKey)` 唯一，重复提交的直接忽略，所以 agent 重试不会产生重复消息 |
| role | `user` 或 `assistant` |
| text | 长度上限 `chat.message_max_chars`（默认 10000），超出返回 400 `INVALID_REQUEST`。空字符串（例如助手刚开口就被打断、没有任何已播放的文字）该条跳过，不算错误 |
| createdAt | 这条消息发生的时间（UTC，ISO-8601），也是聊天历史的排序键（5.2）。晚于服务器当前时间 5 分钟以上的，按收到时间处理（防时钟偏差） |
| interrupted | 助手消息被用户打断时为 true，此时 `text` 只是用户实际听到的那部分；用户消息恒为 false |

**整批校验**：先校验整个请求体。`accountId` 或 `sessionId` 缺失，任何一条的 `messageKey` 不是 UUID、`role` 不是 `user` 或 `assistant`、`createdAt` 缺失或不是有效的 ISO-8601 时间、`text` 缺失或不是字符串或超过长度上限、`interrupted` 缺失或不是布尔，整批返回 400 `INVALID_REQUEST`（`message` 写明第几条的哪个字段），**一条都不存**，agent 修正后整批重发（`messageKey` 去重保证重发安全）。审核高风险、空文字、重复这些不是错误，按下面的逻辑跳过单条。

**响应：** `{"code":"200","message":"success","data":{"accepted":2,"skipped":1}}`。`skipped` 包含：重复的、空文字的、审核判定高风险而未落库的、账号非 `ACTIVE` 而未存的。

**逻辑：** 逐条处理，每条文字先过第十一节的文本审核，再存为一条 `Message`：
- 审核判定高风险：这条文字**不落库**，只写一条不含原文的 `ModerationRecord`（类别、分数、账号），同一批里的其他消息正常存。
- 判定中风险：照常存，同时进人工复核队列；复核认定违规后把该条 `Message.hidden` 置为 true（AvatarMemory 里已经写入的记忆不撤回）。
- 审核服务超时或报错：按中风险处理（存下并进复核队列），不能丢消息，也不能因此让这个接口失败。
- 账号状态不是 `ACTIVE` 时（例如通话中被封禁或发起了删除）：不存，返回成功（`skipped` 计数，agent 侧不需要感知），避免账号删除后又产生新数据。

**⚠️ 隐私约束（重要）**：这里**只收文字**（agent 侧语音识别转写后的结果），本后端不接收、不存储**对话**的原始音频——对话音频全程走LiveKit的音频track，不经过这个接口，也不经过本后端任何地方。（用户主动上传的声音样本是另一回事，见 3.2：它用于克隆音色，保留到该资产或账号被删除为止，删除时连同外部服务里的音色一起清除，见 3.4 和第十三节。）语音录音在GDPR/美国伊利诺伊州BIPA下可能被认定为生物识别数据，合规要求比文字数据重得多；这条约束不是可选的（Replika 被意大利监管机构罚款 500 万欧元，理由是没有处理数据的合法依据、隐私政策不合规、没有年龄验证，说明这个品类正受到监管关注；不是因为保留对话记录 [核实 PYMNTS、Comm Law Group 对处罚决定的报道，2026-10-05]）。

### 5.2 客户端查看聊天历史

```
GET /api/chat/history?sessionId=&before=&updatedSince=&limit=50
```

四个参数都可省略，`limit` 上限 200（配置项 `chat.history_max_limit`）；`limit` 非整数、≤ 0 或超过上限、`before` 游标无法解析、`updatedSince` 不是有效的 ISO-8601 时间，都返回 400 `INVALID_REQUEST`。**按当前账号过滤**，越权查询 `sessionId` 返回空列表（不报错，也不泄露该 session 是否存在）。客户端要在离线时也能看历史，且要支持"通话结束后同步新消息"，所以除了按会话查，还要能按账号整体分页、增量同步。

**响应：**
```json
{"code":"200","message":"success","data":{
    "messages":[{"messageId":123,"sessionId":"...","source":"CALL","turnKey":null,"turnStatus":null,"sender":"USER","text":"...","timestamp":"...","interrupted":false,"updatedAt":"...","hidden":false}],
    "nextCursor":"..."
}}
```

| 参数 | 语义 |
|------|------|
| 无参数 | 该账号最新的 `limit` 条，按 `timestamp` 倒序（相同时按 `messageId` 倒序） |
| `sessionId` | 只返回该会话的消息 |
| `before` | 翻页游标，取上一页响应里的 `nextCursor`（对客户端不透明的串），返回更早的消息；解码失败 → 400 `INVALID_REQUEST`；到头时 `nextCursor` 为 `null` |
| `updatedSince` | 增量同步：返回 `updatedAt` 晚于该时间减 `chat.sync_overlap_seconds`（默认 60，提议）的消息（回看一小段，是因为 `updatedAt` 在写入时赋值而事务稍后才提交，客户端的时间点可能已经越过一条尚未提交的消息；回看会让已经收到的消息再次返回，客户端按 `messageId` 合并，重复无害；写入事务不得长于这个值），包括后来被复核隐藏的（此时 `hidden:true`，`text` 为空，作为墓碑让客户端从本地缓存删除）。不带此参数时，被隐藏的消息不出现在结果里。**`updatedSince` 可以和 `before` 同时使用**：结果仍按 `timestamp` 倒序、每页最多 `limit` 条，用 `nextCursor` 翻页，`nextCursor` 为 `null` 表示这次增量取完了。一次通话可能产生很多条消息，加上被隐藏的墓碑，超过一页是正常的，所以客户端必须翻完所有页、并且**只在翻完之后**才推进本地的同步时间点（取本次收到的最大 `updatedAt`），否则中间断掉会永久漏掉较早的变更 |

排序键是 `timestamp`（即写入时的 `createdAt`）：同一会话的消息可能分多次请求到达，到达顺序不一定等于发生顺序。`messageId` 在同一账号内单调递增，用作 `timestamp` 相同时的次序；`nextCursor` 同时编码这两个值。`interrupted` 为 true 的助手消息，`text` 只是用户听到的部分，客户端可据此标注。`updatedAt` 在消息创建、被隐藏、`turnStatus` 变化时更新。`source` 是 `CALL`（通话期间 agent 写入，5.1）或 `TEXT`（文字对话，5.4）；文字消息的 `sessionId` 为 `null`，用户的文字消息带 `turnStatus`（`PENDING`/`COMPLETED`/`FAILED`），`turnKey` 是文字消息所属那一轮的 `messageKey`（用户消息和它的回复相同，通话消息为 `null`），客户端据此显示"处理中"或"发送失败，点此重试"（用 `turnKey` 作为 `messageKey` 重发，5.4），换了设备或清了本地缓存也能重试，通话消息和助手消息的 `turnStatus` 为 `null`。带 `sessionId` 参数时只返回该通话的消息。

### 5.3 账号删除时的数据清理

账号删除时聊天记录文字要**物理删除**，不能只标记账号失效——这是 App Store/Play 强制要求，也是 GDPR 删除权的要求（Replika 的罚款理由不是保留对话记录，见第十三节开头）。具体流程见第十三节。

### 5.4 文字对话（不经过 LiveKit）

纯文字对话是**独立于通话的功能**：不创建 `Session`、不建 LiveKit 房间、不 dispatch agent。用户发一条文字，数字人用文字回复，回复流式返回。通话链路是为语音设计的（房间、dispatch、等待 agent 加入，4.1），文字不该承担这些成本和失败点。游客没有这个功能（游客凭据调用返回 403 `REGISTRATION_REQUIRED`，2.1；游客允许的接口清单里没有它）。

**本节的证据状态**：检查顺序、失败路径、幂等和计数规则是本文档的设计选择，没有对应的外部文档 [推断]；SSE 是业界对话接口流式输出的通行做法（OpenAI、Anthropic 的流式接口都是 SSE），没有逐页核对 [推断]；LiveTalking demo 里的文字模式是会话式的（`server/routes.py` 的 `/human`，`type=chat`），不是 HTTP 流式，不能直接照搬 [核实 LiveTalking 代码，由审计子任务读过]；**AvatarAgent 目前没有任何 HTTP 对话接口**（`avatar_agent/server.py` 只是 LiveKit `AgentServer`），下面的 `/v1/chat/turn` 和 `/v1/chat/ingest` 是要新做的跨项目约定（19.2）。

```
POST /api/chat/messages     # 鉴权：JWT（用户令牌）。响应是 text/event-stream
```

**请求体：** `{"messageKey":"<uuid>","text":"...","timezone":"Asia/Singapore","voiceReply":false}`

| 字段 | 规则 |
|------|------|
| messageKey | 必填，客户端为这条消息生成的 UUID，是幂等键：`(accountId, messageKey)` 唯一（存为 `Message.turnKey`），见"幂等与重试" |
| text | 必填，去掉首尾空白后不能为空，长度上限 `chat.message_max_chars`（10000，同 5.1），不合规返回 400 `INVALID_REQUEST` |
| timezone | 必填，IANA 时区名，规则同 4.1：缺失或无效返回 400 `INVALID_TIMEZONE`；通过后写入 `User.timezone`。用途同通话：agent 每轮要注入用户当地的当前日期时间，养成统计按用户当地日期算（6.2） |
| voiceReply | 可选，布尔，缺省 `false`：用户要求数字人用语音回复（形象渲染设计 7.5）。为真而功能开关 `chat.voice_reply`（15.3）的生效值为假时，按纯文字回复，不报错（开关可能随订阅变化，客户端显示的状态可能过期 [推断]） |

**检查顺序**（前一步不通过就不做后一步；错误都在响应流开始之前以普通 JSON 错误返回，状态码见 1.4）：
1. 令牌和账号状态（2.6、2.8）；然后是每账号限流（`ratelimit.chat_per_account_per_min`，429 `RATE_LIMITED`，1.6），幂等重放也计数。
2. 请求体校验（上表）。
3. **幂等**：`(accountId, messageKey)` 已存在时按"幂等与重试"处理。
4. **账号有进行中的通话**：有 `endedAt` 为空且 `deadlineAt` 在未来的 `Session`（含启动中的，4.1）→ 409 `CALL_IN_PROGRESS`。通话中的文字输入不属于本接口（AvatarAgent 的通话是否接收文字输入没有核实 [未核实]）。只在开始时检查：文字轮次进行中又发起了通话，不阻止通话，这一轮照常跑完。**挂断到 `room_finished` 之间有延迟**（房间在最后一个参与者离开后多久关闭取决于 LiveKit 的房间配置，没有实测 [未核实]，19.2），这段时间发文字会得到 409，客户端在挂断后遇到它就稍后重试。
5. **文字对话没有配置**：`AGENT_CHAT_URL` 或 `AGENT_CHAT_SIGNING_SECRET` 没有配置（1.5）→ 503 `AGENT_UNAVAILABLE`，不存任何东西，记事件 `text_turn_failed`（`reason=UNREACHABLE`）。
6. **同一账号同一时刻只有一个进行中的文字轮次**：Redis 锁，键 `chat_turn:{accountId}`，值是本轮的唯一标识，有效期 `chat.turn_timeout_seconds + chat.turn_lock_grace_seconds` 秒，释放时用 compare-and-delete（Lua）只删自己的值，每个阶段（第 8 步审核、调用 agent、回复审核、ingest）开始前也用 compare-and-set 续期（重设为同样的有效期，只续自己的值），所以锁覆盖整轮，所以某一轮超过有效期、锁已被后一轮取得时，前一轮退出不会误删后一轮的锁；拿不到锁 → 409 `CHAT_BUSY`。原因：并发的轮次会让两个回复基于同一份历史、互相看不见，也能绕过额度。**拿到锁之后，不论从哪条路径退出（第 7、8 步拒绝、失败、成功），退出前都释放锁**；账号删除任务等的就是这把锁（13.1）。
7. **额度**（15.6 的"文字额度"）：不够 → 403 `FEATURE_LIMIT_REACHED`，`data` 为 `{"feature":"CHAT","limit":"DAILY"|"MONTHLY","resetAt":"..."}`（两个额度同时用完时报重置较晚的，规则同 4.1）；没有任何有效权益的账号，适用的键（`chat.daily_messages`、`chat.monthly_messages`）都没有生效值时 → 403 `FEATURE_LIMIT_REACHED`（`message` 写明"Text quota is not configured"，`data={"feature":"CHAT"}`，无 `limit`、`resetAt`）。记事件 `text_turn_failed`（`reason=FEATURE_LIMIT_REACHED`，第七节）。
8. **内容审核**（第十一节）：用户文字高风险 → 400 `CONTENT_REJECTED`，不保存、不调用 agent，只写不含原文的 `ModerationRecord`，记事件 `text_turn_failed`（`reason=CONTENT_REJECTED`）；中风险照常处理，同时存下并进人工复核队列（复核违规则该条 `hidden`）；审核服务超时或报错按中风险处理，不能因此让接口失败。
9. 存用户消息：一条 `Message`（`sender=USER`、`source=TEXT`、`sessionId` 为空、`turnKey` = 请求的 `messageKey`、`turnStatus=PENDING`、`timestamp` = 服务器当前时间；用户时钟不可信，所以不用客户端时间）。

**响应（SSE）。** 第 9 步之后响应头为 `Content-Type: text/event-stream`、`Cache-Control: no-cache`、`X-Accel-Buffering: no`（反向代理不得缓冲，部署要求）。每 `chat.sse_keepalive_seconds`（15）秒发一行注释 `: keepalive`，防止代理因空闲断开。事件：

| 事件 | `data`（JSON） | 含义 |
|------|---------------|------|
| `accepted` | `{"messageId":123,"timestamp":"..."}` | 用户消息已存下（第 9 步）。客户端用它把本地"发送中"的消息替换成服务端的 |
| `delta` | `{"text":"..."}` | 助手回复的一段增量文字，按顺序拼接 |
| `done` | `{"messageId":124,"timestamp":"...","text":"<完整回复>","hidden":false}` | 回复完成并已存下；`text` 是完整回复，客户端以它为准覆盖拼接结果。回复被审核判为高风险而没有存下时，`messageId` 为 `null`、`text` 为空串、`hidden` 为 `true`，客户端撤回已显示的 `delta`；语音回复的 `audio`、`action` 事件在审核之前已经转发给客户端，已播出的音频撤不回来，这是接受的风险：客户端收到 `hidden` 为 `true` 的 `done` 时停止播放这一轮剩余的音频 |
| `audio` | `{"segmentId":"...","seq":0,"sampleRate":48000,"preSkip":312,"opus":"<base64>"}` | 只在语音回复时有：`preSkip` 只在每条回复的第一个 `audio` 事件（`seq=0`）里有，是解码输出开头要丢掉的编码器延迟样本数（48 kHz；libopus 是 312，约 6.5 毫秒），意义同通话字节流的 `pre_skip`（形象渲染设计 7.2）；合成语音，`opus` 是 base64，解码后的内容是"每个包前加 2 字节大端长度、包与包首尾相接"（与通话字节流 `avatar.audio` 同一封装，AvatarAgent `docs/design.md` 第 7 节"文字对话的语音回复"；形象渲染设计 7.2），每个包是 20 毫秒的 Opus 包（48 kHz 单声道），每个事件最多 10 个包；`seq` 从 0 递增；一条回复是一段语音，客户端为它新建一个解码器，按长度拆出各个包逐个解码，丢掉开头 `preSkip` 个样本，自己播放，同时从这段音频算嘴形（不下发驱动参数，形象渲染设计 7.4） |
| `action` | `{"v":1,"key":"wave","segmentId":"...","sampleOffset":12000}` | 只在语音回复时有：agent 触发的动作，字段同通话里的 `avatar.action` 事件（`segmentId`、`sampleOffset` 指出动作在哪段语音的哪个位置触发，片段在这之后的第一个停顿处播放，形象渲染设计 6.3。`sampleOffset` 是从这段语音开头算的样本数，48 kHz，不含 pre-skip；回复已经有字、语音还没开始时为 0；两者为 null 只在回复还没有字时，表示立即播放）；动作在当前外观上不可用时客户端忽略 |
| `error` | 同普通错误响应的 `{"code":"...","message":"...","data":...}` | 这一轮失败，之后没有别的事件。`code` 是 `AGENT_UNAVAILABLE`（`data` 为 `{"reason":"UNREACHABLE"\|"TIMEOUT"\|"AGENT_ERROR"}`），或账号状态变化时的 `ACCOUNT_BANNED`（`data` 为 `{"reason":"<封禁说明>"}`，同 2.8）、`ACCOUNT_DELETION_SCHEDULED`、`ACCOUNT_DELETING`。用户消息的 `turnStatus` 已置 `FAILED`，可以用同一个 `messageKey` 重试 |

**调用 AvatarAgent**（环境配置 `AGENT_CHAT_URL`、`AGENT_CHAT_SIGNING_SECRET`，1.5；跨项目约定，19.2）。两个接口，都带 1.8 的签名头（调用方标识 `backend-chat`，密钥 `AGENT_CHAT_SIGNING_SECRET`，AvatarAgent 按同样的规则验证）：

```
POST {AGENT_CHAT_URL}/v1/chat/turn     # 生成回复，SSE
POST {AGENT_CHAT_URL}/v1/chat/ingest   # 把一轮对话写入记忆
```

`/v1/chat/turn` 请求体：`{"accountId":"...","text":"...","history":[{"role":"user"|"assistant","text":"...","at":"<UTC 时间>"}],"timezone":"...","now":"<UTC 时间>","persona":"...","companionName":"...","modelTier":"...","language":"...","voiceReply":false,"voiceId":"...","availableActions":[{"key":"...","description":"..."}]}`。`voiceReply` 是请求的 `voiceReply` 且 `chat.voice_reply` 生效值为真时才为 `true`，开关不允许时为 `false`；`voiceId` 与 4.1 同取值（当前音色的 `resultRef`，没有时空字符串）；`availableActions` 与 4.1 dispatch metadata 同义，按当前外观算，没有形象的账号按系统默认数字人的外观算（3.10）。agent 的 SSE 响应在 `delta`、`done`、`error` 之外，语音回复时还有 `audio`、`action` 两种事件，本后端原样转发给客户端；纯文字回复不发它们。`persona`、`companionName`、`modelTier`、`language` 的取值和 4.1 dispatch metadata 里的同名字段完全一致（`User.persona`、`User.companionName`（没有设置时取默认数字人的 `name`，都没有时空字符串，agent 按 4.1 处理）、`chat.model_tier` 的生效值、`User.conversationLanguage` 的生效值，2.5、2.5.1、15.3、2.10），所以文字和通话说的是同一个角色、同一个档位、同一种语言。`history` 是该账号最近 `chat.text_context_messages`（20）条消息，按 `timestamp` 正序：只含未隐藏的；**含通话期间的消息**（文字和通话接得上）；不含 `turnStatus` 不是 `COMPLETED` 的文字用户消息（没有得到回复的），也不含本轮这一条（它在 `text` 里）。响应是 SSE：`event: delta`（`{"text":"..."}`）、`event: done`（`{"text":"<完整回复>"}`）、`event: error`（`{"code":"..."}`）。后端把 `delta` 原样转给客户端。agent 的职责：按 `accountId` 检索 AvatarMemory 的记忆并注入上下文；**不写记忆、不写 `Message`**（回复还没过审核）。

**失败的归类**：连接被拒、解析不到地址 → `UNREACHABLE`；从调用 agent 起算，整轮超过 `chat.turn_timeout_seconds`（60；用户文字的审核先于这次调用，不计入）→ `TIMEOUT`；非 2xx、流结束了还没有 `done`、agent 发来 `error`、事件格式不对 → `AGENT_ERROR`。"格式不对"只看 agent 各事件的必需字段（缺了或类型不对）：`delta` 是 `text`，`done` 是 `text`，`error` 是 `code`；`audio` 是 `segmentId`、`seq`、`sampleRate`、`opus`，`preSkip` 只有 `seq=0` 的事件里才有，不算必需；`action` 是 `v`、`key`，`segmentId`、`sampleOffset` 可以为 null。表里没有的字段（以后新增的字段）原样转发给客户端，不算格式不对。三种都用户消息 `turnStatus=FAILED`、响应流以 `error` 结束、记 `text_turn_failed`（`reason` 同）。

**回复收尾**（收到 agent 的 `done`，顺序固定）：
1. 账号状态不是 `ACTIVE`（轮次进行中被封禁、申请删除或开始删除）：不存回复、不 ingest，用户消息 `turnStatus=FAILED`，响应流以 `ACCOUNT_BANNED`、`ACCOUNT_DELETION_SCHEDULED` 或 `ACCOUNT_DELETING` 的 `error` 结束。
2. 回复文字过第十一节的文本审核：高风险 → 不存回复，只写不含原文的 `ModerationRecord`，**这一轮仍然算完成**：用户消息 `turnStatus=COMPLETED`，`done` 事件里 `messageId=null`、`hidden=true`，不 ingest；中风险或审核服务出错 → 存下并进复核队列，照常继续。
3. 存回复（一条 `Message`，`sender=ASSISTANT`、`source=TEXT`、`turnKey` 同用户消息、`timestamp` = 收到 `done` 时的服务器时间，一定晚于用户消息的）并把用户消息置 `COMPLETED`，**在同一个事务里，且置 `COMPLETED` 是条件更新（要求仍是 `PENDING`）**；更新不到行（被下面的清扫置了 `FAILED`）就回滚、丢弃回复，响应流以 `AGENT_UNAVAILABLE`（`reason=TIMEOUT`）的 `error` 结束。
4. 发 `done` 事件给客户端，**发出后立刻结束这条响应流**；下面第 5、6 步在服务端继续跑，不在这条流里。客户端收到 `done` 后紧接着发下一条消息，可能遇到上一轮还没收尾（锁还在）而得到 409 `CHAT_BUSY`，这是预期的行为，客户端稍后重试即可。
5. **ingest**：调 `/v1/chat/ingest`，请求体 `{"accountId":"...","userText":"...","replyText":"...","now":"...","timezone":"...","language":"..."}`，同步等待但最长 `chat.ingest_timeout_seconds`（10）；**失败或超时只记日志，不重试**（AvatarMemory 的写入不是幂等的，重试会产生近似重复的记忆 [核实 AvatarMemory 规格第 116 行]）。agent 的职责：和通话结束后写入记忆做同样的事，遵守 AvatarMemory 消费方的要求：注入今天的日期、检索结果带 `created_at` 渲染 [核实 AvatarAgent `prompts.py:47` 的日期注入和 AvatarMemory 规格]。写记忆放在审核之后，所以被拦下的回复、账号被封禁或删除时的回复都不会进入记忆；回复之后才被人工复核判违规的，记忆里已有的那一条不撤回，和通话（5.1）一致。
6. 记 `text_turn_completed`；触发养成统计（6.1、6.2）：在 6.2 的行锁事务内**先读旧的 `CompanionshipStats.lastTextAt` 做 6.1 的“同一段”判断，再把 `lastTextAt` 置为该轮用户消息的 `timestamp`**（不论是否新开一段，下一轮靠它判断）；再做每日任务进度刷新（28.2），释放锁。

**客户端中途断开连接不取消这一轮**：后端继续读完 agent 的流并照常收尾，客户端回来后用 5.2 的增量同步取到；这样回复不会因为用户切到后台而丢失。

**幂等与重试。** 同一个 `(accountId, messageKey)` 再次到来：
- `COMPLETED` → 返回 `accepted` 加一条 `done`（存下的回复；高风险被拦下的那种，`done` 里 `messageId=null`、`text` 为空串、`hidden=true`），没有 `delta`，不调用 agent。
- `PENDING` 且这一轮的锁还在 → 409 `CHAT_BUSY`。
- `FAILED`，或 `PENDING` 但锁已经过期（后端崩溃留下的）→ **重跑这一轮**：从第 4 步起检查到第 7 步（第 8、9 步跳过：用户消息已经审核过、存过）；通过后用户消息的 `turnStatus` 回到 `PENDING`，`timestamp` 和 `updatedAt` 更新为当前时间（重发就是现在发的，也让它按当前的额度窗口计数），先发 `accepted` 事件（`messageId` 是已存的那条用户消息），再从"调用 AvatarAgent"开始。失败的轮次不占额度，所以重试不会重复扣。`text` 和已存的不一致时按已存的处理，忽略请求里的 `text`。

**清扫任务。** 每 `chat.turn_sweep_seconds`（60）秒做一次条件更新：`turnStatus=PENDING` 且 `updatedAt` 早于 `chat.turn_timeout_seconds + chat.turn_lock_grace_seconds` 秒之前的用户消息，置 `FAILED`（同时更新 `updatedAt`，增量同步能取到），记 `text_turn_failed`（`reason=TIMEOUT`）。

**数据与隐私。** 文字对话的 `Message` 和通话的同表存放（18），账号删除时一并物理删除（13.1 步骤表第 6 步），数据导出带上（13.3，导出的每条消息带 `source`、`sessionId`（文字为 `null`）、`turnStatus`）。只存文字。**账号删除任务在第 1 步（AvatarMemory 清除）开始前，等该账号的 `chat_turn:{accountId}` 锁释放**（最长 `chat.turn_timeout_seconds + chat.turn_lock_grace_seconds`）：锁在 ingest 结束之后才释放（上面第 6 步），所以等到锁释放就保证不会再有迟到的记忆写入。

**和养成的关系**：文字对话计入互动次数、连续互动天数和 `day_N` 里程碑（6.1、6.2、6.3），不触发 `first_session`（首次通话）里程碑。

---

## 六、养成数据与里程碑模块

游客没有账号，游客会话不触发本节的任何统计（4.3）。

### 6.1 查询养成数据

```
GET /api/companionship
```

**响应：**
```json
{"code":"200","message":"success","data":{
    "daysCompanioned": 12,
    "interactionCount": 8,
    "currentStreak": 3,
    "relationshipStage": "BONDING"
}}
```

| 字段 | 计算方式 |
|------|---------|
| daysCompanioned | 账号创建时间到现在的自然日数（按用户所在时区的日期做简单日期差，不是"有互动的天数"；时区见 6.2；`User.timezone` 为空的账号，如从未发起过会话的账号，按 UTC） |
| interactionCount | 累计互动次数：每次 LiveKit 会话结束并触发养成统计（15.6 的 `finalizeSession`；包括到点被强制结束的，不含被丢弃的启动中会话和用户从未加入的会话，不设最短时长）+1；文字对话（5.4）按"一段"计：一轮文字对话完成时，距该账号上一条文字消息（`CompanionshipStats.lastTextAt`）超过 `companionship.text_burst_minutes`（30）才算新的一次、+1，不超过的算同一次，所以连续聊天刷不出次数。这对应主设计文档 §8.4 的"消息数+通话次数"，但按段不按条，防止刷。**积分公式和 50/150 阈值原来是按通话次数标定的，现在含文字互动，阈值是 `companionship.stage_thresholds` 配置项，上线后运营按真实数据调**，不用改代码 |
| currentStreak | **连续互动天数**，见6.2。读取时如果 `lastInteractionDate` 早于用户所在时区的"昨天"（已经断了至少一天），返回 0（存储值不改，下次会话结束时按 6.2 重置为 1）；否则返回存储值 |
| relationshipStage | 由 `daysCompanioned + interactionCount*2` 算出的积分。阈值是配置项（`AppConfig`，管理后台"养成管理"可改，第十七节），**默认值**：`<50`=SEEDLING，`<150`=BONDING，`>=150`=CLOSE。改阈值只影响之后的计算，不需要迁移数据 |

没有养成数据（没有 `CompanionshipStats` 行，从没有互动过）的账号：`interactionCount` 和 `currentStreak` 为 0，`daysCompanioned`、`relationshipStage` 仍照上面的公式算（`interactionCount` 取 0）。

### 6.2 连续互动天数(streak)的计算——⚠️ 容易犯错的点

**必须按自然日边界算，不是"距离上次互动是否超过24小时"这种滑动窗口。** 原因：如果用24小时滑动窗口，同一天两次通话之间只要间隔恰好跨过24小时，会被误判为"断掉了连续记录"，这是错的。

**自然日按用户所在时区算，不用 UTC。** 用户感知的"今天""昨天"是本地日期：新加坡用户早上 7 点通话，UTC 时间是前一天 23 点，按 UTC 算会把用户的连续记录算错，第八节的"连续记录要中断了"召回推送也会在错误的时间发出。时区取该次会话发起时上报并写入 `Session.timezone` 的值（4.1）；会话记录里没有时区的历史数据按 UTC。用户换时区（出差）时，用当前会话的时区算出 `today`；如果算出的 `today` 早于 `lastInteractionDate`（向西旅行），当作"同一天"处理，`streak` 不变，不倒退。

正确逻辑（每次会话结束时、每次文字轮次完成时各触发一次；文字轮次的 `timezone` 取请求体，5.4）：
```
today = 当前时间按该次会话的 timezone 转成的日期
if 该账号没有上次互动记录:
    streak = 1
else if 上次互动日期 >= today:
    streak 不变（同一天，已经互动过了，不重复+1；含向西旅行导致 today 更早的情况）
else if 上次互动日期 + 1天 == today:
    streak += 1
else:
    streak = 1  # 中间断了至少一天，重置
lastInteractionDate = max(lastInteractionDate, today)
lastInteractionAt = 当前时刻（UTC 时间戳，第八节召回推送判断“超过 `recall.inactive_hours` 没互动”用；文字对话也更新它）
```

`interactionCount` 每次通话结束 +1（文字轮次按 6.1 的分段规则，不一定 +1），跟streak的计算是两件事（同一天打两次电话，interactionCount+2，streak不变）。文字对话的互动次数规则见 6.1，连续天数用同一段逻辑。

`Session.timezone` 在 4.1 落库时一并写入，字段见第十八节。

**并发**：每次更新养成统计先对该账号的 `CompanionshipStats` 行加行锁（没有行时先插入，主键冲突就重读），读、算、写在同一个事务里：通话结束和文字轮次完成可以几乎同时发生，没有锁会丢一次 +1，或把连续天数重复重置。

### 6.3 里程碑

```
GET /api/milestones
```

**响应：** `{"code":"200","message":"success","data":{"milestones":[...]}}`，`milestones` 是该账号的里程碑时间线，按 `occurredAt` 升序，每条 `{"milestoneKey":"day_7","content":"...","occurredAt":"..."}`。`milestoneKey` 用于客户端本地化文案，`content` 是后端的默认文案。

**触发规则（每种里程碑一个固定key，同一账号同一key只记一次，天然幂等）：**

| 触发时机 | key | 内容示例 |
|---------|-----|---------|
| 第一个形象生成成功 | `first_avatar` | `You created your first avatar` |
| 第一次通话结束 | `first_session` | `You had your first call` |
| 陪伴天数达到N（N 取配置项 `milestone.days`，默认 7/30/100） | `day_7`/`day_30`/`day_100` | `{N} days together`（`{N}` 换成天数） |

`day_N` 在每次会话结束、每次文字轮次完成（5.4）、算出 `daysCompanioned` 后检查，达到且尚未记录才写入；触发时记一条 `milestone_reached` 事件（第七节）。`occurredAt` 取写入里程碑的时刻（检查发生的时刻，不是陪伴满 N 天的那个日历日）；`content` 是英文默认文案，客户端按 `milestoneKey` 本地化，不依赖它。里程碑本身不发推送：主设计文档没有定义这个触发场景，推送只有第八节的召回和管理后台手动发送两类。

**里程碑数据完全是本后端自己算的，跟另一个团队做的记忆/RAG服务无关**——那个服务目前的接口设计只面向对话管线做语义检索，没有面向客户端展示的读取接口，两条数据链路是分开的，不要尝试从那边拉里程碑数据。

---

## 七、埋点事件

依据：主设计文档第 12 节（核实自 `dramaBox` 的事件日志设计），客户端对应实现见 Android 计划。

### 7.1 接收接口

```
POST /api/events
```

**鉴权：可选。** 游客凭据、已登录账号、没有任何凭据（刚装完还没取到游客凭据）都可以调用。

**请求体：**
```json
{"deviceId":"7d0c...uuid", "context":{"platform":"ANDROID","appVersion":"1.0.0","osVersion":"14","deviceModel":"Pixel 8","locale":"en-SG","network":"WIFI"},
 "events":[{"name":"session_started","occurredAt":"2026-09-30T01:02:03.456Z","params":{"sessionId":"..."}}]}
```

| 字段 | 规则 |
|------|------|
| deviceId | 客户端首次启动时生成的 UUID 并持久保存，必填。未登录时用它代替账号 |
| context | `platform`、`appVersion`、`osVersion`（必填），`deviceModel`（设备型号）、`locale`（界面语言，IETF 标签）、`network`（发送这一批时的网络类型：`WIFI`/`CELLULAR`/`OTHER`）、`channel`（渠道码，24.7）（可省略），落到每条事件上。**不含 IP**：IP 由服务端从请求取（下面） |
| events | 一批事件。条数上限配置项 `events.max_batch`，默认 100（客户端单批 50，服务端上限比它宽，避免客户端升级阈值后被拒）；整个请求体上限配置项 `events.max_body_kb`，默认 512 KB。超限返回 413 `BATCH_TOO_LARGE`，整批不处理 |
| name | 1–64 个字符，匹配 `^[a-z0-9_]+$` |
| occurredAt | 客户端记录的事件发生时间（UTC，ISO-8601）。**服务端不信任它**：存为 `clientTime`，只用于排查，**统计日、保留期、漏斗和任何排序都不用它**，一律用服务端的 `receivedAt`（防止客户端篡改；dramaBox 同样忽略客户端时间，2026-08-21 的修复 `027bfcd` [核实]）。持久化离线队列里迟到上传的事件，按上传那天统计，这个误差接受 |
| params | 自由 JSON 对象，单条事件序列化后不超过 4 KB |

- **账号从哪来**：请求带有效 JWT，账号 ID 取自 JWT，**不信请求体里任何账号字段**；不带 JWT，或 JWT 无效/过期、`sid` 在作废集合里（2.6），或是游客凭据（2.1，没有账号 ID），一律当作匿名，只记 `deviceId`；JWT 有效但账号状态不是 `ACTIVE`（`BANNED`、`PENDING_DELETION`、`DELETING`）的同样当作匿名，否则账号删除流程第 5 步之后还会写入带账号的数据。**这个接口永远不返回 401**：因为过期令牌而丢事件，比记成匿名事件更糟。同时有账号和 `deviceId` 时两者都存，据此把匿名期的事件关联到之后创建的账号。
- **服务端补的字段**：`receivedAt`（服务器收到这一批的时间，UTC）；`seq`（事件在这一批里的下标，同一批事件的 `receivedAt` 相同，靠它保持先后）；`ip`（客户端 IP，取自受信任反向代理，1.6）；`country`（GeoIP 按 `ip` 解析出的国家码，没有配置 GeoIP 或解析不到时为空，GeoIP 选型是缺的输入，22.11）。存 IP 的依据和隐私要求见 7.2。后端自己产生的事件（7.3 里产生方为后端的）不经过本接口：`ip`、`country` 为空，`seq` 为 0，`receivedAt` 取事件产生的时刻。
- **整批无效与单条无效**：`deviceId` 缺失或不是 UUID、`context` 缺失、`context.platform`/`appVersion`/`osVersion` 缺失，整批 400 `INVALID_REQUEST`；单条的 `occurredAt` 缺失或不是有效的 ISO-8601 时间时，该条照收、`clientTime` 置空；`name` 不合规或 `params` 超限的事件被丢弃并计数，不影响同一批的其他事件。响应 `{"accepted":n,"dropped":m}`。
- **限流**：按 `deviceId` 和按账号各自限流，配置项 `events.rate_limit_per_min`，默认每分钟 60 次请求，超出返回 429 `RATE_LIMITED`，客户端保留队列稍后重试。
- **best-effort 写入**：写入 MongoDB 失败只记日志，仍返回 200。埋点故障不能影响客户端体验。

### 7.2 存储

MongoDB 集合 `event_log`：`{accountId, deviceId, name, source, params, context, clientTime, receivedAt, seq, ip, country, expireAt}`。**每条记录自带过期时间** `expireAt = receivedAt + events.ttl_days`（默认 180 天），TTL 索引建在 `expireAt` 上、`expireAfterSeconds=0`（dramaBox 就是这样做的 [核实 `EventLogDocument.java:106-109`]），所以修改 `events.ttl_days` 对之后写入的记录立即生效，不需要重建索引，已写入的记录保留原来的过期时间。索引：`(accountId, receivedAt)`、`(name, receivedAt)`、`(deviceId, receivedAt)`，供事件明细、漏斗、统计汇总层（17.6，按 `receivedAt` 的 UTC 日聚合）和游客留存（17.6）；另有 `(source, receivedAt)`。**`source`**：`CLIENT`（`POST /api/events` 写入的事件）或 `SERVER`（后端自己的代码路径写的事件，即 7.3 事件表里“产生方”为后端的）。日活等活跃类统计只数 `CLIENT`：照 dramaBox 数“当日任意事件”，同时避免后端事件（`push_sent`、`milestone_reached` 等）被当成用户回来过（17.6）。

**存 IP**：事件记录存客户端 IP。没有任何法规禁止存 IP；GDPR 把 IP 当作个人数据，要求有合法依据、告知用户、限制保留期、能响应删除和导出请求：IP 的保留期就是 `expireAt`，账号删除时按 `accountId` 删除该账号的事件（13.1 步骤表第 5 步），数据导出带上（13.3 的 `events.json`），没有账号的（游客和注册前的）事件到期自动过期。隐私政策和 Google Play 的 Data safety、Apple 的隐私标签要申报收集 IP，由法务确认，缺的输入（22.11、26.2）。业界做法是分裂的：GA4、Mixpanel 用 IP 推出位置后丢弃，Amplitude 存 `ip_address` 并提供关闭选项 [二手资料，没有读各家原文]；本项目选择存，用于分析、地理维度重算和排查滥用。

### 7.3 事件目录

事件名 + 自由 JSON 参数（主设计文档 §12 的"胖事件"模式），下表是已定的事件，接收接口对不在表里的合规事件名也照收。**每个事件只由一方产生**，避免重复计数：

| 事件 | 产生方 | params | 说明 |
|------|--------|--------|------|
| `app_open` | 客户端 | 无 | 每次冷启动一次；日活和留存数任意客户端事件（17.6），不只数它 |
| `app_foreground` | 客户端 | 无 | 每次回到前台一次（冷启动也记一次，在 `app_open` 之后）。照 dramaBox 的 `app_resume` [核实 审计 F5] |
| `app_background` | 客户端 | `durationSec` | 每次进入后台一次，带这次前台停留的秒数。照 dramaBox 的 `app_exit`（带时长）[核实 审计 F5] |
| `login_page_view` | 客户端 | `method`（`entry`/`phone`/`email`：展示的是哪一个页面。`entry` 是"登录或创建账号"入口页（列出 Google、手机号、邮箱几种方式，页面结构设计 H，2026-10-18 加）；`phone` 是手机号页，`email` 是邮箱登录或注册页。Google、Apple 是入口页（以及会话失效时的登录页）上的按钮，不单独记页面事件，Google 登录漏斗从 `entry` 起算） | 登录页展示时。登录漏斗，照 dramaBox 客户端已有的登录事件 [核实 审计 F5、23.7] |
| `otp_send` | 客户端 | `purpose`（`LOGIN`）, `country` | 用户点发送手机验证码时（邮箱注册验证码不记漏斗事件） |
| `otp_send_result` | 客户端 | `result`（`SUCCESS`/`FAILED`）, `errorCode`（可空）, `channel`（成功时 `SMS`/`PUSH`） | 发送验证码的结果返回时 |
| `login_submit` | 客户端 | `method`（`phone`/`email`/`google`/`apple`） | 用户点登录或注册时 |
| `login_result` | 客户端 | `method`（同上）, `result`（`SUCCESS`/`FAILED`）, `errorCode`（可空） | 登录或注册的结果返回时 |
| `avatar_created` | 客户端 | `taskId` | 客户端观察到形象任务（`type=AVATAR`）`SUCCEEDED` 时上报，同时转发 AppsFlyer（主设计文档 §15）；新建外观的 `LOOK` 任务成功不记它（3.6） |
| `voice_cloned` | 客户端 | `taskId` | 同上，声音任务 |
| `session_started` | 客户端 | `sessionId` | |
| `session_ended` | 客户端 | `sessionId`, `durationSec` | |
| `render_tier_assessed` | 客户端 | `tier`（`DEVICE`/`CLOUD`：本机能本地渲染 / 需要云端，4.1）, `avgFps`, `memoryMb`, `rendererModelVersion` | 客户端本地测速、确定渲染档位后上报（首次需要渲染时、以及渲染模型更新后；形象渲染设计 8.5）。同一档位在发起会话时作为 `renderTier` 上报（4.1）。参数名本表新定 |
| `message_sent` | 客户端 | `sessionId`（文字对话没有会话，为 `null`）, `channel`（`text`） | 客户端每发一条文字消息记一次（文字对话，5.4）；语音由 agent 转写，客户端不知道 |
| `push_opened` | 客户端 | `pushId`, `pushType` | 用户点开推送，召回效果评估（主设计文档 §18） |
| `experiment_assigned` | 客户端 | `experiment`, `group` | AB 分组结果（主设计文档 §20） |
| `register_completed` | 客户端 | `method`（`email` / `google` / `apple` / `phone`） | 注册成功时（Google、Apple、手机号：响应 `isNewAccount=true` 时记；邮箱注册恒为新账号）。**统计里"完成注册的账号数"不用它**（取自 `User`，17.6），它只用于漏斗 |
| `milestone_reached` | **后端** | `milestoneKey` | 6.3 里程碑写入时 |
| `push_sent` | **后端** | `pushId`, `pushType`, `triggerReason` | 每条推送发出时（第八节） |
| `subscription_started` | **后端** | `store`, `productId` | 订阅首次进入 `ACTIVE` 时（15.4） |
| `paywall_viewed` | 客户端 | `placement`（付费墙出现的位置，名字由客户端计划列出） | 订阅转化漏斗的第一步 |
| `purchase_initiated` | 客户端 | `kind`（`subscription` / `credits`）, `store`, `productId` | 用户点击购买、拉起商店支付界面时 |
| `purchase_failed` | 客户端 | `kind`, `store`, `productId`, `reason`（`USER_CANCELED` / `ERROR` / `PENDING`） | 商店返回取消、错误或待处理时 |
| `onboarding_step_viewed` | 客户端 | `step`（步骤名，由客户端计划列出） | 新用户引导每一步展示一次，用来找流失点 |
| `credit_purchased` | **后端** | `store`, `productId`, `credits` | 额度购买入账、写 `PURCHASE` 流水时（15.9） |
| `credits_spent` | **后端** | `featureKey`, `quantity`, `credits`, `itemKey` | 额度消费成功、事务提交之后（15.9 `spend`；服装兑换 3.7 的 `redeem`，带 `itemKey`；新建外观的扣费 3.6 同样记，`featureKey` 和 `itemKey` 为空，`quantity` 为 1，`credits` 是扣的数额；价格为 0 时没有扣费，不记）；其余情况 `itemKey` 为空 |
| `session_start_failed` | **后端** | `reason`（`FEATURE_LIMIT_REACHED` / `GUEST_QUOTA_EXHAUSTED` / `AGENT_UNAVAILABLE` / `DISPATCH_FAILED`） | 发起会话失败时（4.1）。这类 Session 不留记录，事件是它在统计里的唯一痕迹 |
| `session_discarded` | **后端** | `reason`（`USER_NOT_JOINED`）, `sessionId` | agent 已加入、用户一直没有进入房间，Session 被丢弃时（4.1） |
| `text_turn_completed` | **后端** | `durationMs`（从收到请求到存下回复）, `replyChars` | 文字轮次完成时（5.4） |
| `text_turn_failed` | **后端** | `reason`（`FEATURE_LIMIT_REACHED` / `CONTENT_REJECTED` / `UNREACHABLE` / `TIMEOUT` / `AGENT_ERROR`） | 文字轮次在检查阶段被拒绝，或调用 agent 失败、被清扫置为失败时（5.4）；`CALL_IN_PROGRESS`、`CHAT_BUSY` 是重复点击或状态冲突，不记 |
| `checkin_completed` | **后端** | `dayNum`, `consecutiveDays`, `credits` | 签到成功发放奖励时（28.1） |
| `task_rewarded` | **后端** | `taskId`, `taskType`, `credits` | 每日任务领奖成功时（28.2） |
| `invite_reward_granted` | **后端** | `inviteRecordId`, `inviterCredits`, `inviteeCredits`, `trigger`（`REGISTER`/`FIRST_CALL`） | 邀请奖励发放时（9.1） |
| `invite_share_clicked` | 客户端 | `shareChannel`（用户在系统分享面板里选的目标应用，客户端归一成 `^[a-z0-9_]{1,32}$` 的短码，如 `whatsapp`、`telegram`、`copy_link`，识别不出的为 `unknown`） | 用户点分享并选定目标时（9.2），分享漏斗的第一步 |
| `invite_link_click` | **后端** | `shareChannel`（可空） | 邀请链接的落地页被打开时（9.2，由落地页调公开接口产生，`accountId` 是邀请码的所有者） |
| `invite_download_click` | **后端** | `shareChannel`（可空） | 落地页上的下载按钮被点击时（9.2） |
| `ad_reward_granted` | **后端** | `impressionId`, `credits`, `slotKey` | 激励广告奖励发放时（22.6） |
| `phone_otp_sent` | **后端** | `country`, `purpose`, `channel`（`SMS`/`PUSH`） | 发送手机验证码时（23.7） |

**事件和指标的关系**：事件目录的用途是支撑第 17.6 列出的指标、17.4 的预设漏斗，以及运营临时搭的漏斗；用到哪些事件见 17.6 的口径。`purchase_failed`、`onboarding_step_viewed`、`credit_purchased`、`credits_spent` 目前只用于漏斗和事件明细，没有对应的汇总指标。**通话次数、通话时长、消息数以 `Session`、`Message` 两张表为准，不以 `session_started`、`session_ended`、`message_sent` 为准**：客户端进程可能被杀、语音消息客户端不可见。这三个事件只用于漏斗和归因。



---

## 八、推送通知与召回

依据：主设计文档第 13 节、第 18 节（核实自 `dramaBox` 的 `backend-task-fcm-data-only.md` 和 `backend-task-multi-token-push.md`）。

### 8.1 推送 token 注册

```
POST /api/push-tokens              # 鉴权：账号令牌或游客凭据（2.1）
POST /api/push-tokens/unregister   # 鉴权：账号令牌或游客凭据
```

注册请求体：`{"pushToken":"...","platform":"ANDROID","appVersion":"1.0.0","locale":"zh-Hans-SG"}`。

- **`push_token` 是唯一键，不是账号 ID。** 一个账号可以有多条（多设备、多次安装）。按 token 做 upsert：不存在则新建；已存在则同时覆盖 `locale`、`appVersion`、`platform` 和 `lastSeenAt`（8.4 的语言选择取最近登记的 token，这些值必须是新的）。
- **同一个 token 已经属于另一个账号或游客时，改绑到当前调用者。** 这是同一台设备换了登录账号（或游客登录、账号登出）的场景，不改绑的话旧主体会继续收到这台设备的推送。游客凭据登记时 `accountId` 为空、`deviceId` 存凭据里 `deviceId` 的 SHA-256（同 `GuestDevice`，2.1，不存原值）；账号令牌登记时 `accountId` 取自令牌、`deviceId` 清空、`sessionFamilyId` 取自令牌的 `sid`（游客登记时为空；登录链作废时据此清除，2.6）。登录或注册成功后客户端用账号令牌重新登记同一个 token，登出后用游客凭据再登记一次。
- **游客 token 的清理**：`lastSeenAt` 早于 `push.guest_token_retention_days`（默认 90）的游客 token，每天一次的清理任务删除；FCM 返回 `UNREGISTERED` 的照旧立即删除（8.3）。
- `unregister` 请求体 `{"pushToken":"..."}`，删除这条记录（用户在系统设置里关闭通知时客户端调用；登出时由服务端按 `sessionFamilyId` 清除，不依赖客户端，2.6）。token 不存在也返回成功。
- `locale` 用于选择推送文案语言（8.4）。
- `pushToken` 在 ANDROID 和 IOS 上都是 **FCM 注册令牌**：后端只用 FCM Admin SDK 发送，它不接受原始 APNs 设备令牌。iOS 客户端需要集成 Firebase Messaging 来取得 FCM 令牌，这一点由 iOS 计划确认（主设计文档 §8.7 写的是"APNs token"，与此需要对齐）。

### 8.2 通知偏好

```
GET /api/notification-preferences
PUT /api/notification-preferences
```

`{"recall":true,"announcement":true,"activity":true}`。`recall` 控制召回推送；`announcement` 控制管理后台手动发出的推送，以及运营发送的站内通知附带的推送（25.4）；`activity` 控制系统事件通知附带的推送（25.3：生成成功和失败、审核拒绝、导出就绪、订阅扣费问题），这些是用户自己的账号和任务的结果，和功能新闻分开，关掉公告不会错过"形象好了"（2026-10-18 加）。站内通知的收件箱记录不受偏好影响，总是写入。默认都是 `true`。偏好按账号存，不按设备。游客没有偏好行（调用这两个接口返回 403 `REGISTRATION_REQUIRED`），总是收运营的公告；关闭靠系统通知设置或 `unregister`。`PUT` 的请求体是完整的三个字段（缺任何一个 → 400 `INVALID_REQUEST`），响应 `data` 是保存后的 `{"recall":..,"announcement":..,"activity":..}`。

### 8.3 消息格式与发送

- 通过 FCM Admin SDK 发送。**ANDROID 令牌永远只发纯 `data` 消息，不设 `notification` 字段**，`AndroidConfig` 优先级 `HIGH`。原因（`dramaBox` 真实踩过的坑）：notification+data 组合消息在 App 被杀或后台时由系统拦截，客户端的 `onMessageReceived` 不会被调用，收不到。
- `data` 字段：`type`（`recall`、`announcement`、`notification`、`activity` 或 `otp`；`notification` 是运营发送的站内通知附带的推送（25.4，遵守 `announcement` 偏好），`activity` 是系统事件通知附带的推送（25.3，遵守 `activity` 偏好）；客户端收到这两种都刷新未读数，`activity` 另归入"我的账号和任务"通知渠道，`notification` 和 `announcement` 归入公告渠道，`recall` 归入召回渠道（这里的"渠道"是 Android 的系统通知渠道，由客户端按 `data.type` 选择，后端不下发渠道名，也不需要为它做任何事；2026-10-18 加）；`otp` 是 23.3 的验证码推送，**不是通知**：`data` 只含 `type=otp`、`code`、`purpose`，不展示、不受任何偏好控制、不写 `PushRecord`/`PushDelivery`，不进 17.6 的推送统计）、`title`、`body`、`linkType`、`linkTarget`、`imageUrl`、`pushId`。FCM 的 `data` 值都是字符串，缺省的字段传空字符串。`linkType` 取 `NONE`（点击只打开 App）、`SCREEN`（`linkTarget` 是客户端页面标识：`conversation`（主界面，即对话页）、`companion`（伴侣资料页：形象、外观、声音、人设、关系）、`store`（商店）、`credits`（积分页）、`settings`、`notifications`、`subscription`、`checkin`、`daily_tasks`（后两个打开积分页的签到、任务部分）；这是推送与站内通知（25.2）共用的唯一一份页面标识清单。2026-10-18 按页面结构设计（`docs/superpowers/specs/2026-10-18-app-page-structure-design.md`）把 `companionship`、`assets` 换成 `companion`，加 `store`、`credits`：前两个页面已不存在）、`URL`（`linkTarget` 必须符合 1.7 的链接规则）；后端创建模板和手动推送时校验。`pushId` 是 `PushRecord.id`，一次推送一个，不是每个 token 一个；游客 token 的推送不写 `PushRecord`（下面），其 `pushId` 传空字符串，客户端对空 `pushId` 不上报 `push_opened`。
- 一次发给同一账号的所有有效 token（游客 token 各自成一次推送，只发 `announcement`，不发召回，也不发站内通知附带的推送）；批量发送用 `sendEach` / `sendEachForMulticast`（每批最多 500 条；旧的 `sendMulticast`、`sendAll` 已弃用，不要用，依据 Firebase Java 参考页）。ANDROID 与 IOS 的 payload 不同，按平台分开发送。
- **失效 token 清理**：FCM 返回 `UNREGISTERED` 才删除该 token；其他错误保留，不删。**`PushDelivery.result` 的映射**：成功 `ACCEPTED`；`UNREGISTERED` → `INVALID_TOKEN` 并删除该 token；其余错误（含 `INVALID_ARGUMENT`、`SENDER_ID_MISMATCH`、网络错误和 5xx）→ `FAILED`，保留 token。
- **IOS 令牌**：纯 `data` 消息在 iOS 上是静默推送，系统不保证送达也不会显示通知（Apple 文档，我未核实），所以 IOS 令牌的 payload 预计需要带可见通知。后端按 `platform` 分支构造 payload；IOS 分支的具体格式取决于 iOS 客户端对到达性的核实结果，见第十九节。
- 每次推送写一条 `PushRecord`（账号、类型、触发原因、时间；游客 token 的推送例外：不写 `PushRecord`、`PushDelivery`，也不记 `push_sent`，只在 `PushTask` 的 `sentCount`、`failedCount` 上累加；这两个计数按每个 token 的发送结果计：`ACCEPTED` 记成功，`INVALID_TOKEN` 和 `FAILED` 记失败，游客 token 的规则相同），对每个 token 的发送结果各写一条 `PushDelivery`，并记一条 `push_sent` 事件（第七节），`triggerReason` 取 `daily_recall`、`streak_at_risk`、`admin` 或 `system_event`（25.3 的系统事件通知附带的推送）。

### 8.4 每日召回推送

不是用户操作触发的，是后端定时扫描后主动推送的留存手段（主设计文档 §18）。

定时任务每 10 分钟运行一次（配置项），找出满足下面条件的账号：

1. 账号 `ACTIVE`，至少有一个有效推送 token，`recall` 偏好为 `true`。
2. **当前是用户当地的发送窗口**：用户当地时间（`User.timezone`，未知按 UTC）处于 `recall.local_send_hour`（默认 19 点）起 `recall.window_minutes`（默认 60 分钟）内。窗口内每个账号的具体发送时刻 = 窗口起点 + `hash(accountId) mod 窗口分钟数`；账号被选中的条件是**当前时刻不早于它的发送时刻，且早于窗口终点加 `recall.scan_interval_minutes`**（最后一次扫描要能选到偏移落在窗口末段的账号，否则它们当天永远发不出），任务每 `recall.scan_interval_minutes` 分钟扫描一次，账号被分散到窗口内不同的扫描周期发出，不会所有用户同一时刻收到（主设计文档 §18 要求"避开所有用户同一时刻收到推送"）。
3. 频控（两条都要满足）：用户当地的今天（按 `User.timezone`）还没有收到过召回推送；距离上一次召回推送不少于 `recall.min_gap_hours`（默认 20）。第二条故意小于 24：每个账号的发送时刻固定在窗口内的某一分钟，扫描周期、夏令时和时区变化会让相邻两次发送的间隔在 24 小时上下浮动一两个小时，下限设成 24 会隔天跳过一次；“每天最多一次”由第一条（当地日期，下面的唯一约束）保证，该约束不含触发原因，所以 `daily_recall` 和 `streak_at_risk` 同一天合计也只有一条。
4. 满足下列触发原因之一，优先取前者：
   - `streak_at_risk`：`currentStreak >= recall.streak_min_days`（默认 7）且 `lastInteractionDate` 是用户当地的昨天（也就是今天还没互动，连续记录快断了）。
   - `daily_recall`：距离 `lastInteractionAt` 超过 `recall.inactive_hours`（默认 24 小时）；从未互动过的账号用 `User.createdAt` 代替。

**并发与幂等**：多实例部署时靠数据库锁保证只有一个实例跑任务；`PushRecord` 对 `(accountId, 用户当地日期)` 在召回类触发原因（`daily_recall`、`streak_at_risk`）上建部分唯一索引，防止同一天重复发（含两种原因各发一条）。**执行与恢复**：每个账号先插入 `PushRecord`（唯一约束挡住重复）再发送；进程在插入之后、发送之前崩溃，这个账号当天的召回推送丢失、不补发（少一次召回推送无害，补发有重复风险，所以选至多一次）。

**文案**：`PushTemplate` 按 `(triggerReason, locale)` 存标题和正文，管理后台可编辑（第十七节）；账号的 `locale` 取它最近注册的 token 上的值，按 1.2 的语言协商规则归一化到 `app.supported_locales`（先完整匹配，再按主语言子标签匹配该列表里的条目，例如列表里有 `zh-Hans` 时 `zh-CN`、`zh-SG` 都归到它）；没有匹配项时回退到 `push.default_locale`（`en`）。每个召回触发原因必须在 `app.supported_locales` 的每一种语言上都有模板才允许启用（管理后台保存时校验）。文案、发送时刻、频控参数都是 `AppConfig` 里的运营可调参数，不硬编码。

**回环**：召回推送发出记 `push_sent`（带 `triggerReason`），客户端点开记 `push_opened`（第七节），两者配合评估召回策略有没有效。

### 8.5 管理后台手动推送与周期推送

管理后台可以创建推送任务（第十七节 `PUSH:SEND`）：

- **受众 `audience`**：`ALL`（所有 token，含游客）、`ACCOUNTS`（只发注册账号）、`GUESTS`（只发游客 token）、`ACCOUNT_IDS`（指定账号 ID 列表，`accountIds`）。可以再叠加筛选：`platforms`（`ANDROID`/`IOS` 的子集）、`locales`（按 8.4 的规则归一化后的语言子集，取 token 上的 `locale`），空表示不限；`audience=ACCOUNT_IDS` 时带 `platforms` 或 `locales` 返回 400 `INVALID_REQUEST`。
- **内容**：标题、正文、深链（`linkType`/`linkTarget`，8.3）、图片。
- **发送时间**：立即（创建时 `scheduledAt` = 创建时刻）、一次性定时（`scheduledAt`，UTC 时刻）、或者由下面的周期推送生成。
- **执行**：后台任务分批执行，`type` 为 `announcement`，遵守账号的 `announcement` 偏好（游客没有偏好，总是发）。发送结果写 `PushRecord`，`triggerReason` 为 `admin`，`localDate` 取收件账号 `User.timezone` 下的当地日（没有时区按 UTC）。**状态转换与恢复**：`PENDING→RUNNING` 用条件更新认领（`WHERE status='PENDING' AND scheduledAt<=now`，更新到行的实例才执行），认领时写 `lockedAt`，每批更新 `cursor` 时同时刷新它，所有对 `cursor`、`status`、`sentCount`、`failedCount` 的写入都带 `WHERE lockedAt = <本实例上次写的值>`，更新不到行就放弃；`RUNNING` 任务的 `lockedAt` 早于现在减 `push.task_lease_minutes`（默认 15，提议）时可被任何实例重新认领，从 `PushTask.cursor`（最后处理完的账号或游客 token，格式见下）之后继续，每批最多 500 个 token 处理完更新一次 `cursor`；账号按账号 ID 升序处理，一个账号的全部 token 总是在同一批里，批边界不会把同一账号的 token 拆开，也就不会产生两条 `PushRecord`；游客 token 在账号之后按 token ID 升序处理，`cursor` 形如 `A:<账号 ID>` 或 `G:<token ID>`；崩溃时最多重发一批；全部处理完置 `DONE`。一次性定时任务错过时间的规则同周期推送：`scheduledAt` 早于现在减 `push.schedule_catchup_minutes` 的置 `CANCELLED`（`PushTask.note=MISSED`），不再发送。**受众只含 `ACTIVE` 账号**（`BANNED`、`PENDING_DELETION`、`DELETING` 的账号不收，游客 token 照旧）。

**周期推送 `PushSchedule`**：`repeat`（`DAILY`/`WEEKLY`/`MONTHLY`）、`daysOfWeek`（`WEEKLY` 用，1 到 7，周一为 1）、`dayOfMonth`（`MONTHLY` 用，1 到 31，当月没有这一天时取当月最后一天）、`timeOfDay`（`HH:mm`）、`timezone`（IANA 时区名，管理员选，默认 `UTC`；是一个固定时区，不是每个用户的当地时间：按用户当地时间发的是 8.4 的召回推送）、`startDate`、`endDate`（可空）、`enabled`，以及上面的受众和内容字段。"到点"指 `nextRunAt`（按 `timezone` 算出的下一次发送的 UTC 时刻，创建、修改、每次生成之后重算）不晚于现在。每 `push.schedule_scan_seconds`（默认 60）秒运行一次的后台任务，给到点的周期推送生成一条 `PushTask`（`scheduleId`、`scheduledAt=nextRunAt`）并重算 `nextRunAt`；`(scheduleId, scheduledAt)` 唯一，所以多实例或重复扫描不会重复生成；生成的任务走同一条执行路径。**停机之后**：生成任务时取“`nextRunAt` 之后、不晚于现在”的最后一个发送时刻作为 `scheduledAt`（只补发最近一次错过的），其余错过的跳过，再重算 `nextRunAt`；并且该 `scheduledAt` 不早于现在减 `push.schedule_catchup_minutes`（默认 60），更早的直接跳过，不补发。**夏令时**：按 `java.time` 的规则解析 `timeOfDay`，落在时区空档里（不存在的时刻）的，按 `java.time` 的规则加上空档的长度（例如空档是 02:00 到 03:00 时，02:30 变成 03:30），落在重叠里（出现两次）的取第一次。`startDate`、`endDate` 按周期推送自己的时区解释，两端都包含。停用或超过 `endDate` 之后不再生成，已生成的任务不受影响。依据：dramaBox 有按日、周、月重复的推送（`PushSchedule`、`PushScheduleGenerateJob`）[核实，由审计子任务读过]。

---

## 九、邀请码

注册时使用邀请码的规则见 2.4，防刷校验见 2.2/2.4。本节补客户端展示邀请码、邀请记录所需的接口，以及邀请奖励的规则。

```
GET /api/invite                          # 鉴权：JWT
GET /api/invite/records?page=&pageSize=  # 鉴权：JWT
```

**响应：** `{"code":"200","message":"success","data":{"code":"K7M2Q9XD","inviteLink":"https://example.com/invite?code=K7M2Q9XD","inviteCount":3,"rewardedCount":1,"reward":{"enabled":true,"inviterCredits":10,"inviteeCredits":5,"trigger":"FIRST_CALL","maxRewardedPerInviter":0,"startAt":null,"endAt":null}}}`。`code` 是该账号自己的邀请码（注册成功时生成，见 2.2），所以一定有值；游客凭据调用本接口返回 403 `REGISTRATION_REQUIRED`（2.1）。`inviteLink` 由服务端用客户端配置键 `inviteLinkBase`（26.2）加 `?code=` 加邀请码拼出，没有配置时为 `null`（客户端不显示分享入口；dramaBox 同样由服务端拼好链接返回）。`inviteCount` 是以该账号为邀请人的 `InviteRecord` 数量，`rewardedCount` 是 `User.inviteRewardedCount`（已获得奖励的次数，被邀请人删号后不减少）。`reward` 是当前生效的奖励配置：`enabled` = `invite.reward_enabled` 为真且当前时间在活动时间内，其余取自 `invite.*`（9.1），客户端据此显示"邀请好友各得 X 额度"，`enabled` 为 `false` 时不显示奖励文案。

**`GET /api/invite/records`**：`page` 从 1 开始，`pageSize` 默认 20、上限 100；响应 `{"items":[{"recordId":"...","inviteeLabel":"a***@d***.com","joinedAt":"...","status":"PENDING|REWARDED|NOT_ELIGIBLE","creditsEarned":10}],"total":N}`，按 `redeemedAt` 倒序，只含以当前账号为邀请人的记录。`inviteeLabel` 是被邀请人的掩码标识（邮箱按 17.4 的掩码规则，手机号按 2.9 的掩码规则；既没有邮箱也没有手机号时是账号 ID 的前 8 位），不显示完整邮箱或号码；`creditsEarned` 是邀请人这一边已经发放的额度（`PENDING`、`NOT_ELIGIBLE` 为 0）。游客返回 403 `REGISTRATION_REQUIRED`。

### 9.1 邀请奖励

奖励是**可配置的功能**：开关和数值都由运营在管理后台设置（`invite.*`，17.5，权限码 `INVITE:CONFIG`），默认关闭。邀请关系仍然只在注册时建立，防刷规则不变（2.4）。

- **配置**（两个金额是发放类键：评估发放时把当时的金额记进 `InviteRecord.inviterCreditsGranted`、`inviteeCreditsGranted`，之后改配置只影响之后发放的；其余是策略键，每次评估读当前值，改了立即对所有待评估的记录生效。金额按评估那一刻的配置发放，所以邀请人分享时看到的金额可能和最终发放的不同）：`invite.reward_enabled`、`invite.inviter_reward_credits`、`invite.invitee_reward_credits`（0 表示这一边不发）、`invite.reward_trigger`（`REGISTER` 或 `FIRST_CALL`）、`invite.first_call_min_seconds`、`invite.max_rewarded_per_inviter`（0 不限）、`invite.reward_start_at`、`invite.reward_end_at`。
- **状态**：创建 `InviteRecord` 时（2.2、2.7、23.2）`rewardStatus=PENDING`；触发时机到了才评估：`REGISTER` 在创建记录的同一个请求里评估；`FIRST_CALL` 在被邀请人的会话结束流程里评估（15.6 的 `finalizeSession`：账号会话的 `durationSeconds ≥ invite.first_call_min_seconds`，只评估 `PENDING` 的记录，所以只会有第一次满足的那一次起作用）。**会话结束流程里的评估不看当前的 `invite.reward_trigger`**，被邀请人有 `PENDING` 记录就评估：把触发从 `FIRST_CALL` 改成 `REGISTER` 之后，改动前遗留的 `PENDING` 记录会在被邀请人下一次满足时长的通话结束时评估（事件 `invite_reward_granted` 的 `trigger` 记 `FIRST_CALL`），不会一直悬着；从 `REGISTER` 改成 `FIRST_CALL` 不会有遗留（`REGISTER` 的记录创建时就已评估；创建时邀请人处于 `PENDING_DELETION` 而保持 `PENDING` 的除外，它们在被邀请人下一次满足时长的通话结束时评估）。
- **评估**，在一个数据库事务里，**先读双方 `User.status`：任一方不是 `ACTIVE` 就不建、不锁余额行，只更新记录状态（`PENDING_DELETION` 保持 `PENDING`，`BANNED`、`DELETING` 置 `NOT_ELIGIBLE`）**；双方都是 `ACTIVE` 才先锁邀请人的 `CreditBalance` 行，加锁后再读一次状态（行不存在就先 `INSERT … ON CONFLICT DO NOTHING` 建一行余额为 0 的，再 `SELECT … FOR UPDATE`；被邀请人的行同样）。全部满足才发：`invite.reward_enabled` 为真；当前时间在 `[invite.reward_start_at, invite.reward_end_at]` 内；邀请人和被邀请人都是 `ACTIVE`（任一方是 `PENDING_DELETION` 时本次不评估，记录保持 `PENDING`，取消删除之后下一次满足条件的通话结束再评估，不置 `NOT_ELIGIBLE`；`BANNED`、`DELETING` 才置 `NOT_ELIGIBLE`，`rewardReason=ACCOUNT_STATE`）；邀请人的 `User.inviteRewardedCount` 小于 `invite.max_rewarded_per_inviter`（非 0 时；这个计数只增不减，被邀请人删号、邀请记录被删之后邀请人也不会重新得到名额）；两人的 `User.registerDeviceHash` 不相同（任一方为空时跳过这一项；它不随审计行过期，13.5）；被邀请人的 `User.priorInviteeRewarded` 不为 true（创建账号时按 13.5 查标记后记下，评估时不再查标记，标记可能已过期）。不满足的：记录置 `NOT_ELIGIBLE`，`rewardReason` 取 `DISABLED`、`OUT_OF_WINDOW`、`ACCOUNT_STATE`、`LIMIT_REACHED`、`SAME_DEVICE`、`PRIOR_ACCOUNT` 之一，是终态，之后不再评估。
- **发放**：满足时把 `rewardStatus` 条件更新 `PENDING→REWARDED`，写 `inviterCreditsGranted`、`inviteeCreditsGranted`、`rewardedAt`，并给金额大于 0 的那一边写 `CreditLedger`（`reason=INVITE_REWARD`，`delta` 为金额，`eventKey` 为 `invite:<InviteRecord ID>:INVITER` 或 `:INVITEE`，沿用 `(reason, eventKey)` 唯一约束）、更新 `CreditBalance`，并在同一个事务里把邀请人的 `inviteRewardedCount` 加一，同时给被邀请人的 `User.inviteeRewardedAt` 写同一个时刻（`InviteRecord.rewardedAt`；不管被邀请人那一份金额是不是 0 都写，已有值时保留较早的）；条件更新没抢到的不重复发。提交之后记后端事件 `invite_reward_granted`（7.3）。
- **依据**：dramaBox 在邀请码被使用时按后台的邀请活动配置发放金币（`ReferralFacade.java:188-209` [核实，由审计子任务读过]）；本项目把触发时机做成可选，默认放在被邀请人第一次通话之后，减少批量注册刷奖励 [推断，没有逐家核对业界做法]。
- **账号删除**（13.1）删除该账号作为邀请人或被邀请人的 `InviteRecord`；已发放的额度流水随各自账号处理，对方账号已得到的额度不回收。

### 9.2 邀请分享漏斗与落地页事件

照 dramaBox 的分享统计（裂变漏斗：分享 → 链接点击 → 下载点击 → 注册，渠道分析按分享目标应用拆分 [子代理读码 dramaBox-admin `share-stats`、dramaBox `StatShareFunnelDaily`、`StatShareChannelDaily`、后台设计会话的笔记]；它的"解锁分享"和"剧热度"是短剧解锁专属，不做）：
- **分享**：客户端在用户点分享并选定目标应用时记 `invite_share_clicked`（7.3，带 `shareChannel`）。
- **链接点击、下载点击**：邀请链接（`inviteLink`，9）指向运营搭建的落地页（缺的输入，21）；落地页被打开时调 `POST /api/public/invite-events`，请求体 `{"code":"K7M2Q9XD","event":"LINK_CLICK"|"DOWNLOAD_CLICK","shareChannel":"whatsapp"}`（`shareChannel` 可省略，按 `^[a-z0-9_]{1,32}$` 校验，不合格的按 `unknown` 写入；`event` 不是 `LINK_CLICK`、`DOWNLOAD_CLICK` 时，和 `code` 不存在一样返回 200 且不写任何东西），无需登录，按 IP 限流（1.6，`ratelimit.invite_event_per_ip_per_hour`）。服务端用 `code` 找到邀请人，写一条后端事件 `invite_link_click` 或 `invite_download_click`（`accountId` 是邀请人，`deviceId` 为空）；`code` 先按 2.4 的规范化步骤处理（删格式字符、去首尾空白、转大写），格式不对或不存在都返回 200 且不写任何东西（不让人探测邀请码）。落地页和 API 同源部署，不开 CORS（17.2）。
- **邀请码怎么到达新安装**（Android；照 dramaBox 的安装来源读取：Play Install Referrer 加剪贴板 [核实 审计 J17]）：落地页的下载按钮把商店链接的 `referrer` 参数设为 `invite_code=<邀请码>`（URL 编码；和归因链接的 `attr_id`、UTM 一起时用 `&` 连接，规则同 10.4），同时把邀请码纯文本写入剪贴板。客户端首次启动先读 Install Referrer 里的 `invite_code`；没有（referrer 已读完且没有 `invite_code`，或按 10.4 判定为没有 referrer；还在重试读取的暂时失败期间不算没有）时，在用户**打开注册表单**时读一次剪贴板（不在首次启动读：这时新安装还在引导页上，而读剪贴板时 Android 12 起系统会提示“已粘贴” [推断，未核对]，提示会出现在用户看不懂的地方），只有内容符合邀请码格式（2.4）时才使用；读到的码预填该注册表单的邀请码字段，用户可以修改或清空；用户已经有账号、或不是新注册时忽略。邮箱注册和手机号登录的表单有邀请码字段，剪贴板值在这两个表单预填；Google、Apple 登录没有表单，随请求带上客户端已持有的待用邀请码（来自 Install Referrer 或之前预填的值）；稍后 referrer 才读到 `invite_code`、而用户已经提交注册时，以提交时表单里的值为准。服务端不需要新接口：认领接口（10.4）本来就收 `installReferrer`，邀请码照 2.4 随注册请求提交。iOS 没有 Install Referrer，iOS 客户端不在本次范围。
- **App Links**（Android；照 dramaBox 的 `https` autoVerify 链接 [核实 审计 E10]）：邀请链接所在域名托管 `/.well-known/assetlinks.json`（应用包名和签名证书指纹，域名由运营提供，缺的输入见 21），客户端声明 `autoVerify` 的 intent filter，路径取邀请链接的路径；已安装应用的用户点邀请链接直接打开应用，进入注册并预填链接里的 `code`（用户已有账号则忽略）；没有安装的用户仍然打开落地页。
- **注册**：`InviteRecord` 的创建数，按 `redeemedAt` 的 UTC 日。
- **统计表**（17.6）：`StatShareFunnelDaily`、`StatShareChannelDaily`；接口 `GET /invites/share-funnel`、`GET /invites/share-channels`（17.4）。UV 是各日去重人数，**不跨日相加**。
- **分享文案配置**：`inviteShareText`、`inviteShareTitle`、`inviteLinkBase` 在客户端远程配置里（26.2），后台在"客户端配置"页改（后台设计 5.21，接口 26.3），对应 dramaBox 的分享配置页。

---

## 十、广告归因与投放管理

依据：主设计文档第 15 节；投放账户、投放成本、投放效果、归因明细和自建点击归因照 dramaBox（`AdProxyController`、`AdProxyCostController`、`AdAttributionController`、`AdAttributionMatchUseCase`、`stat-proxy-daily` [核实，由审计子任务和后台设计会话读过]）。安装归因有两个来源，写进同一张 `AttributionRecord`，用 `source` 区分：

- `APPSFLYER`：客户端集成 AppsFlyer SDK，后端接收它的回传（10.1、10.2）。**iOS 的归因只靠这个来源**：iOS 从 App Store 安装，没有办法把点击编号带进 App，所以我们不自己处理 iOS 的数据，只接收 AppsFlyer 的结果。
- `SELF`：自建的点击到安装归因，**只做 Android**（10.4）。

两个来源可能对同一次安装各记一条，报表按来源分列、不相加。

### 10.1 接收 AppsFlyer 的 Push API 回传

```
POST /api/attribution/appsflyer/{endpointSecret}
```

AppsFlyer 的 Push API 把归因数据以 JSON（选 GET 时是查询参数）推送到控制台配置的端点：Export > API Access > Push API > Add Endpoint，选 POST 或 GET，可选消息类型和字段 [核实 AppsFlyer 官方 Push API 指南 `support.appsflyer.com/hc/en-us/articles/207034356`，由子任务读过，该文章最后更新 2026-10-01]。**Push API 是 AppsFlyer 的付费高级功能**，没有订阅时它的配置接口返回 402 [核实 同上与 `dev.appsflyer.com` 的 REST 文档]，业务要确认套餐包含它（缺的输入，19）。

- **鉴权**：（1）路径里的 `endpointSecret` 与配置值做常量时间比较，不匹配返回 404（不暴露端点存在），应用日志和访问日志必须屏蔽这段路径。（2）AppsFlyer 还提供鉴权令牌头：名称只能是 `Authorization` 或以 `X-` 开头，按应用在控制台或 REST 接口 `PUT /tokens/app/{app_id}` 里设置，不允许别的自定义头 [核实 同上]。环境变量 `AF_PUSH_TOKEN_HEADER`、`AF_PUSH_TOKEN`（1.5）都配置时，请求必须带这个头且值常量时间相等，否则 404；没有配置时只看路径密钥。控制台的"发送测试"不带令牌 [核实 同上]，所以启用令牌头之后用测试按钮得到 404 是预期。路径里放密钥能否通过 AppsFlyer 的"URL 不安全"校验，官方只给了查询参数的例子，[推断，没有核实]，上线前在控制台实测。
- **控制台配置**：方法用 POST；消息类型选安装、再互动和我们关心的应用内事件；取消勾选 `ip`、`user_agent`、`idfv`、`city`、`postal_code`（官方只说可选字段可以用控件勾选，没有逐字列出这几个 [推断]）。**`advertising_id`（Android）和 `idfa`（iOS）是必选字段，一定会发** [核实 同上]，所以下面"入库前丢弃"是必须做的，不只是保险。端点必须有有效域名、端口 80 或 443、TLS 1.2 以上，AppsFlyer 建议把它的服务器 IP 加入白名单（部署输入，21）[核实 同上]。
- **解析要容忍缺 key**：AppsFlyer 不发送空值对应的 key；"全选"不会自动带上以后新增的字段，2025-12-30 起"全部字段"只指保存配置时已经存在的字段 [核实 同上与官方公告]。收到不认识的字段忽略。
- **入库前丢弃个人数据字段**：`ip`、`user_agent`、`advertising_id`、`idfa`、`idfv`、`city`、`postal_code`。
- **保存的字段**：`app_id`、`event_name`、`event_time`、`event_type`、`appsflyer_id`、`customer_user_id`、`conversion_type`、`campaign_type`、`media_source`、`campaign`、`af_c_id`、`af_adset`、`af_adset_id`、`af_ad`、`af_ad_id`、`attributed_touch_type`、`attributed_touch_time`、`install_time`、`is_retargeting`、`platform`、`country_code`、`app_version`，以及成本字段 `af_cost_value`、`af_cost_currency`、`af_cost_model`、`cost_in_selected_currency`（Push API 里的真实字段名，不是 `cost_*` [核实 同上的字段字典]；消息里有才存）。
- **`customer_user_id` 对应的账号不存在或状态不是 `ACTIVE`** 时，`accountId` 记为空（这条归因仍保存，它只含设备与渠道信息），避免账号删除之后又重新产生与账号关联的数据。
- **去重**：`(appsflyer_id, event_name, event_time, event_type)` 唯一；重复的消息返回 200，不再写行；缺 `appsflyer_id` 的消息不入库，同样返回 200。官方没有说明 AppsFlyer 是否会重发消息 [核实 同上]，所以不把"重复投递"当作已知行为，去重只是防御。把 `event_type` 放进键里的原因：同一个应用内事件在"安装后应用内事件"和"再互动应用内事件"两者都开启时会发两遍 [核实 同上]，两遍的 `appsflyer_id`、`event_name`、`event_time` 相同，只有 `event_type` 不同（取值如 `install-in-app-event`、`re-attribution-in-app-event`，来自 AppsFlyer 的"新增 Push API 字段"公告，子任务转述，没有读原文）。
- **响应**：AppsFlyer 要求返回 200，4 秒内没有响应算发送失败 [核实 同上]，所以消息落库后立刻返回 200，请求体不是合法 JSON 返回 400，落库失败返回 500。AppsFlyer 失败后是否重试官方没有写，只写了"接收端不可用会丢数据，缺的数据用 Pull API 补" [核实 同上]：本项目不自动补数，这是已知限制，运营需要补时在 AppsFlyer 导出数据后联系开发导入。

### 10.2 把安装关联到账号

安装回传发生在用户创建账号**之前**，此时 `customer_user_id` 还是空的 [核实 AppsFlyer 官方：客户用户 ID 只关联到设置之后发生的应用内事件，安装事件不带它，除非在 SDK 启动前设置，而那样可能阻塞安装事件和归因]。所以由客户端在账号创建后把 AppsFlyer 设备 ID 告诉后端：

```
POST /api/attribution/link    # 鉴权：JWT。请求体 {"appsflyerId":"..."}
```

后端保存 `(accountId, appsflyerId)`，并把已有的、`appsflyer_id` 相同而 `accountId` 为空的 `AttributionRecord` 回填账号并写 `registeredAt`（为空时写当前时间，只填第一次）。**校验与规则**：`appsflyerId` 必填，1 到 64 个字符，只含字母、数字、`.`、`_`、`-`，否则 400 `INVALID_REQUEST`；游客凭据返回 403 `REGISTRATION_REQUIRED`；**`appsflyerId` 全局唯一，一次安装只归属第一个关联它的账号**：同一账号重复调用返回 200、不改任何东西；另一个账号（同一台设备上先后注册了两个账号）调用返回 200 但不改任何东西、不抢走归因，也不回填记录（响应不透露它已被占用）；同一账号可以关联多个 `appsflyerId`（多台设备）。响应 `data: null`。之后收到的同一 `appsflyer_id` 的回传直接带上账号并写 `registeredAt`（账号为 `ACTIVE` 时，否则同 10.1 记空）。客户端同时把 AppsFlyer 的 customer user ID 设为账号 ID，这样后续应用内事件的回传自带 `customer_user_id`。`POST /api/attribution/link` 需要账号令牌：客户端在注册或登录成功后调用，把注册之前就取到的 AppsFlyer ID 关联到这个账号，所以回填账号的动作发生在注册之后。

### 10.3 归因明细、汇总与投放效果

管理后台的"投放管理"模块（第十七节，`ATTRIBUTION:VIEW`）有四张报表：

- **归因明细**（`GET /attribution/records`）：两个来源的 `AttributionRecord`，可按来源、匹配方式、时间筛选。
- **点击明细**（`GET /attribution/clicks`）：自建归因的点击记录（10.4），列点击时间、投放账户、状态（`PENDING` 未认领且未过期、`MATCHED` 已认领、`EXPIRED` 未认领且已过期，由 `claimedAt` 和 `expireAt` 现算）、渠道、IP、UTM。这是 dramaBox 归因明细页的对应物（它的列表是点击记录，有待匹配、已匹配、已过期三种状态 [核实，后台设计会话读过]）。点击记录的匹配有效期是 `attribution.click_retention_days` 天，过期后再保留 `attribution.click_expired_keep_days`（默认 7，提议）天才物理删除，这几天里明细页还能看到 `EXPIRED`。
- **汇总**（`GET /attribution/summary?groupBy=source|media_source|campaign`）：按来源、媒体来源、活动汇总安装数、激活数（关联到账号后有 `avatar_created` 或 `session_started` 事件的账号数）、成本（AppsFlyer 带来的成本字段，有则展示，没有则为空）。**"安装"的判定**（暂定 [推断]）：`eventName = install`（自建归因的行就是这样写的，10.4）；AppsFlyer 回传里哪个 `event_name`、`event_type`、`conversion_type` 代表安装，核对 AppsFlyer 字段词典之后替换（19.2）。归因回传里没有收入数据（订阅金额在 17.4 的订阅统计里，是标价不是实收），这里没有收入。两个来源分列、不相加。
- **投放效果**（`GET /attribution/performance`，10.5）：自建归因的投放漏斗加成本。

### 10.4 自建点击归因（只做 Android，和 AppsFlyer 并存）

依据：用户 2026-10-05 的决定，照 dramaBox。它的归因历史是：先用落地页点击加 IP、UA 指纹匹配（会漏），再试过剪贴板（更不可靠），最后才有"下载 APK 时把归因编号写进 APK 签名块"这个精确的办法，指纹匹配保留作兜底 [核实 dramaBox `docs/apk-attribution-backend-task.md`、DramaverseDemo `ApkAttributionReader.kt`；匹配历史是用户的说明]。Google Play 安装用 Play Install Referrer：官方文档写明可以从 Google Play 安全地取回推广来源，信息保留 90 天，应在安装后第一次运行时只调用一次 [核实 `developer.android.com/google/play/installreferrer/library`]。三条路径按精度从高到低匹配：APK 签名块 → Play referrer → IP 加 UA 指纹；**兜底之后还是没有匹配上的，就是自然流量，不再追查**。

**1. 归因链接 `GET /go/{code}`**（不在 `/api` 下，不返回 JSON 信封；反向代理必须把 `/go/` 转发到本后端，同 `/notify/`）：
- `code` 必须对应一条启用的 `AttributionCampaign`，否则 404（纯文本，不回显 `code`；本接口不返回 JSON 信封，所以不用 `CAMPAIGN_NOT_FOUND`）。
- 按 User-Agent 判断：Android → 跳 `attribution.play_store_url`（没有配置 → 404 纯文本，不记点击），并记点击；**其他设备（iPhone、iPad、Mac、电脑等）→ 跳 `attribution.other_platform_url`，不记点击**（自建归因不处理它们），这个地址没有配置则 404。
- 商店链接保存时的校验（防止被配成开放重定向）：`attribution.play_store_url` 必须是 `https://play.google.com/store/apps/details?id=<包名>`，`id` 等于 `GOOGLE_PLAY_PACKAGE_NAME`（1.5），主机和路径固定，没有片段、端口、用户信息，查询键只允许 `id`、`hl`、`gl`（同 24.2 的规则）；`attribution.other_platform_url` 必须是 https 并符合 1.7；`attribution.link_base_url` 只能是 https 的源（没有路径、查询、片段，不带末尾斜杠）。
- 记一条 `AttributionClick`：`attrId`（16 字节 CSPRNG 的 base64url，22 个字符）、`campaignId`、`channel=STORE_REDIRECT`、`utmSource`/`utmMedium`/`utmCampaign`（取自请求的同名查询参数，不符合 `[A-Za-z0-9._-]{1,64}` 的丢弃，缺省取投放账户的默认值）、`ip`、`userAgent`（截断到 512 个字符）、`clickedAt`、`expireAt = clickedAt + attribution.click_retention_days`（匹配的有效期）、`purgeAt = expireAt + attribution.click_expired_keep_days`（物理删除时间，TTL 索引建在它上）。
- 302 跳转到商店链接加 `&referrer=<编码值>`：编码值是 `attr_id=<attrId>&utm_source=<…>&utm_medium=<…>&utm_campaign=<…>` 整体做一次 URL 编码（Google 要求 referrer 字符串经过 URL 编码、不超过 512 个字符 [核实 `developer.android.com/games/playgames/user-acquisition`]；各个 UTM 值限制在 64 个字符以内、只含 `A-Za-z0-9._-`，所以总长约 330 个字符以内，值里不会出现 `&`、`=`）。响应头 `Cache-Control: no-store`。
- **限流**：按 IP（1.6）。超限时仍然 302 跳转到商店，只是不记点击，不能把用户挡在商店之外。
- **客户端 IP** 取自 1.6 的受信任反向代理头，**丢弃客户端自带的 `X-Forwarded-For`**；指纹匹配的正确性依赖它（缺的部署输入，21）。

**1b. 落地页接口 `POST /api/attribution/click`**（给"直接下载 APK"的落地页用，无需登录，按 IP 限流，1.6）：请求体 `{"code":"<归因链接 code>","event":"PAGE_VIEW"|"DOWNLOAD_CLICK","utmSource":"…","utmMedium":"…","utmCampaign":"…"}`（UTM 可省略，规则同上）。`code` 必须是启用的 `AttributionCampaign`，否则 404 `CAMPAIGN_NOT_FOUND`。`PAGE_VIEW`：落地页被打开，计入当天的访问量（10.5），响应 `data: null`。`DOWNLOAD_CLICK`：用户点了下载。按请求的 User-Agent 判断（判断方式同 `GET /go/{code}`）：**不是 Android 时返回 200，`data` 为 `{"attrId":null}`，不记录点击**（自建归因只记 Android 的点击；指纹步骤把无法解析的 UA 当作兼容，非 Android 的点击若被记录，会和同一 IP、同一时间窗内的 Android 认领误匹配）。是 Android 时记一条 `channel=APK_DOWNLOAD` 的 `AttributionClick`（字段同上），响应 `{"code":"200","message":"success","data":{"attrId":"..."}}`，落地页拿到 `attrId` 后把它写进要下载的 APK 的签名块（第 6 条）；`attrId` 为 `null` 时落地页不注入。落地页和 API 同源部署（落地页放在 `attribution.link_base_url` 所在的域名下，由反向代理转发到本后端），所以**不开 CORS**，符合 17.2 的项目约定。落地页还要取像素编号（无需登录，按 IP 限流，1.6）：`GET /api/public/attribution/pixels?code=` 返回 `{"facebookPixelId":"…","googlePixelId":"…","tiktokPixelId":"…"}`（只有编号，没有访问令牌；没配置的为 `null`；`code` 不存在或已停用返回 404 `CAMPAIGN_NOT_FOUND`）。

**2. 安装后认领 `POST /api/attribution/claim`**（无需登录，按 IP 限流）：请求体 `{"deviceId":"...","integrityToken":"...","installReferrer":"attr_id=…&utm_source=…","apkAttrId":"...","appVersion":"1.0.0","osVersion":"14","deviceModel":"Pixel 8"}`。校验：`deviceId` 必填、不超过 64 个字符；`integrityToken` 规则同 2.1（用途 `CLAIM`；`integrity.check_enabled` 为 `false` 时可省略，缺失或不通过返回 403 `DEVICE_INTEGRITY_FAILED`），防止脚本伪造安装；`installReferrer` 可空、不超过 2048 个字符，超过返回 400 `INVALID_REQUEST`；`apkAttrId` 可空、不超过 128 个字符；`osVersion`、`deviceModel` 可空（兜底匹配用）。客户端在**安装后第一次启动**调用一次。服务端：

1. 设备哈希 = SHA-256(`deviceId`)。在一个 PostgreSQL 事务里先插入一行 `AttributionClaim`（设备哈希唯一）；已经存在 → 返回当时的结果，不再评估（防止安装之后才点广告的人回头认领，也防重复和并发）。重装应用会生成新的 `deviceId`（2.1），按新设备处理。
2. **精确匹配**，按顺序：先 `apkAttrId`，找到未认领、未过期的点击 → `APK_BLOCK`（它来自安装包本身，最可靠）；没有或找不到，再解析 `installReferrer`：**整串里没有未编码的 `=` 时，先对整串做一次 URL 解码；然后按 `&` 拆分，每一段按 `=` 拆成键和值，再对键和值各做 URL 解码**（Install Referrer API 返回的字符串是编码前还是编码后，官方没有写 [推断]，这样两种都能解析，而值里被编码的 `&`、`=` 不会被当成分隔符），取第一个 `attr_id`，找到未认领、未过期的点击 → `REFERRER`。
3. **指纹兜底**（照 dramaBox 的 `tryMatchOnAppStart`）：两种编号都没有，或都找不到、已被认领时，取请求 IP 在 `attribution.fingerprint_window_hours`（默认 24）内的、未认领且未过期（`expireAt` 晚于现在）的点击，按点击时间从新到旧遍历，取**第一条 UA 兼容的** → `FINGERPRINT`。"兼容"的规则照 dramaBox 的 `uaCompatible`：点击记录的 UA 里解析出 Android 主版本，和认领请求的 `osVersion` 主版本都有时必须相等；点击记录的 UA 里解析出设备型号时，认领请求的 `deviceModel` 必须包含它（忽略大小写）；认领请求没带 `osVersion`、`deviceModel`，或点击 UA 里解析不出来，视为兼容 [核实 dramaBox `AdAttributionMatchUseCase.uaCompatible`，本次读过]。兜底会漏、也可能错配（同一出口 IP 下有多人时），这是 dramaBox 的既有行为，匹配方式记为 `FINGERPRINT`，报表里和精确匹配分开显示，运营自己判断可信度。
4. 匹配成功：同一个事务里写一条 `AttributionRecord`（`source=SELF`、`eventName=install`、`eventTime` 和 `installTime` 取现在、`mediaSource`/`campaign`/`adset`/`ad` 取自 `AttributionCampaign`、`attributionCampaignId`、`attrId`、`deviceId`（哈希）、`matchType`、`appVersion`、`countryCode`（按请求 IP 的 GeoIP，没有配置为空））**认领发生在注册之后时**（用户先注册、认领请求后到，例如认领首次启动失败后重试成功）：写 `AttributionRecord` 时用 `HMAC-SHA256(ABUSE_HASH_KEY, deviceId)` 查 `RegistrationAudit.deviceIdHash`，找到账号（取最早的一个）且账号 `ACTIVE` 时，直接回填 `accountId`，`registeredAt` 取该账号的 `createdAt`；否则 `accountId` 留空，等之后创建账号时按 2.2 回填；认领事务提交后再用同样的条件重查一次并回填（注册与认领并发时，两边的查询都可能看不到对方未提交的行，重查补上这个缝隙）。这样注册数不会因为认领晚到而被低估（审计行保留 `abuse.audit_retention_days`，客户端最多重试 3 天，足够）。并更新认领行（`matched=true`、`attrId`）；`AttributionRecord.attrId` 唯一，所以同一个点击不会被两台设备认领；两台设备并发认领同一个点击时，输的一方的事务因唯一冲突回滚（认领行也随之回滚），随后**把第 1 到 4 步重新执行**（最多重跑 3 次，加第一次共评估 4 次）：重跑时该点击已被认领，会继续往后匹配（指纹兜底）或记为没有匹配，不向客户端返回 5xx。“未认领”定义为 `claimedAt` 为空**且**不存在 `attrId` 相同的 `AttributionRecord`（所以输家重跑时不会再选中赢家已占用的点击，即使赢家的 `claimedAt` 还没写上）；事务提交之后再把点击的 `claimedAt` 置上（只是加速过滤和明细状态）；重跑用完仍冲突按没有匹配处理。没有匹配：认领行 `matched=false`，计入当天的"未归因安装"（10.5）。
5. 响应 `{"matched":true|false}`，客户端不需要处理它。

**3. 关联账号**：这台设备之后创建账号时，回填 `accountId` 和 `registeredAt`（2.2 的"自建归因关联"）。账号删除（13.1 步骤表第 6 步）删除 `accountId` 等于该账号的 `AttributionRecord`。**没有账号的行**（`AttributionRecord` 里 `accountId` 为空、`AttributionClaim`）只含设备哈希和渠道信息，保留 从 `createdAt`（入库时间）起算 `attribution.record_retention_days`（默认 365）天后由每天一次的清理任务删除；导出（13.3）的 `attribution.json` 含该账号的归因记录：来源、投放账户、匹配方式、安装时间，不含 IP。

**4. 隐私与保留**：点击记录存 IP 和 UA，匹配有效期 `attribution.click_retention_days`（默认 30；IP 和 UA 实际保留到 `purgeAt`，即再多 `attribution.click_expired_keep_days` 天，隐私政策按两者之和披露，不小于 1，`attribution.fingerprint_window_hours` 不得超过它换算成的小时数）；`AttributionRecord` 不存 IP。收集这些要写进隐私政策（缺的输入，26.2）。认领是否受同意页约束是法务结论，缺的输入（`android/docs/launch-todo.md`）。

**5. 客户端行为**：首次启动调用认领接口；**只有收到 200 才置"已认领"标志**，失败（含 429、5xx、网络错误）下次启动重试，安装后最多重试 3 天；Install Referrer 返回 `FEATURE_NOT_SUPPORTED`（Play 商店版本不支持，是确定的“没有”）时当作没有 referrer，照常带 `apkAttrId` 调认领；`SERVICE_UNAVAILABLE`（Google 文档只写“连接没建立”，没有说是永久的 [核实 developer.android.com Install Referrer 库页，2026-10-08 读取]）和其他连接失败当作暂时失败：不置“已读”，下次再读，从第一次失败起满 1 小时仍读不到才当作没有 referrer、带 `apkAttrId` 照常认领（按暂时失败处理是推断）。

**6. 直接下载 APK 的签名块注入**（和 dramaBox 的做法一致；dramaBox 的设计文档称这是 Walle、VasDolly 这类渠道包工具的原理 [依据 dramaBox `docs/apk-attribution-backend-task.md`]）：
- **注入**：落地页在 1b 的 `DOWNLOAD_CLICK` 拿到 `attrId` 后，在要下载的 APK 的 APK Signing Block 里追加一个自定义的键值对：ID 取 `0x61766174`，值是 `attrId` 的 UTF-8 字符串（不超过 128 字节）。这个 ID 不能和 Android 已使用的签名块 ID 冲突（v2 `0x7109871a`、v3 `0xf05368c0` [核实 `source.android.com` 的 APK 签名方案文档，子任务读过]；v3.1 `0x1b93ad61`、对齐填充 `0x42726577` 凭记忆，没有核对）。注入和读取两端必须用同一个 ID。要求 APK 至少用 v2 签名（v1 没有签名块）。签名仍然有效：v2 的摘要覆盖的是 zip 内容、中央目录和文件尾，不含签名块里别的键值对，平台忽略不认识的 ID [核实 同上]。
- **落地页的注入脚本**是单独的前端交付物（需要域名和托管，21），后端只提供 1b 的接口和认领接口的 `apkAttrId` 字段。
- **读取**：Android 客户端首次启动时读自己的 APK 文件（`sourceDir`）：找文件尾 → 中央目录偏移 → 签名块（尾部的魔数 `APK Sig Block 42`，凭记忆写，没有核对 Google 文档）→ 找 ID 为 `0x61766174` 的键值对，取出值；读取失败、没有这个块（Google Play 安装、没注入过）都返回空，不是错误；只读一次，结果和"已读"标志存本地（dramaBox 的 `ApkAttributionReader` 同样）。所有渠道的包都带这段读取代码，Play 安装读不到就走 referrer。

### 10.5 投放管理（投放账户、投放成本、投放效果）

照 dramaBox 的"投放管理"模块：投放账户、投放成本、投放效果、归因明细四个页面 [核实 后台设计会话对 dramaBox-admin `plat/ad-proxy`、`CostPanel.tsx`、`stat-proxy-daily` 的笔记]。

**投放账户 `AttributionCampaign`**（权限 `ATTRIBUTION:MANAGE`；dramaBox 的"投放账户"是一个买量主体，有像素和关联渠道包，并能生成带 UTM 的落地页链接）：
- 字段：`code`（唯一，创建后不可改，3 到 32 位，小写字母、数字、`-`、`_`）、`name`、`mediaSource`（默认的 `utm_source`）、`campaign`（默认的 `utm_campaign`）、`utmMedium`（默认 `cpc`）、`adset`、`ad`（后两者可空）、`facebookPixelId`、`googlePixelId`、`tiktokPixelId`（可空）、`facebookAccessToken`（可空，**加密存储，密钥环境变量 `ATTRIBUTION_TOKEN_ENC_KEY`，响应里永远不返回明文**，只返回"已设置"；dramaBox 的页面编辑时把它回显到浏览器，这个不照搬 [核实 后台设计会话的笔记]。它的用途是 Facebook Conversions API 的服务端回传，具体事件和字段待核对 Facebook 文档后实现，缺的输入，19.2；dramaBox 有这个字段，是否调用没有核实）、`channelCodes`（关联的渠道包，24.7；数组，可为空，重复的码去重；每个码必须是已登记的渠道（`Channel.code`），不认识的码 → 400 `INVALID_REQUEST`；新关联一个已停用的渠道 → 409 `INVALID_STATE`，已经关联的渠道之后被停用不影响已有关联，24.7）、`remark`、`enabled`。**不能删除，只能停用**（历史点击和归因还要在报表里显示）。
- **生成链接** `GET /attribution/campaigns/{id}/link?platform=FACEBOOK|GOOGLE|TIKTOK&utmSource=&utmMedium=&utmCampaign=`：该投放账户没有这个平台的像素编号 → 400 `INVALID_REQUEST`（dramaBox 同样提示"请先配置该平台的 Pixel ID"）；否则返回 `{"url":"{attribution.link_base_url}/go/{code}?utm_source=…&utm_medium=…&utm_campaign=…"}`，UTM 缺省取账户的默认值，规则同 10.4 第 1 条。`attribution.link_base_url` 没有配置时返回 400 `INVALID_REQUEST`（`message` 写明未配置）。

**投放成本 `AttributionCost`**（权限 `ATTRIBUTION:MANAGE`；手工录入，没有广告平台接口同步 [核实 后台设计会话的笔记]）：`campaignId`、`statDate`（UTC 日）、`amount`（不小于 0，两位小数）、`currency`（固定为 `attribution.cost_currency`，默认 `USD`，整个系统一种币种，所以 CPA 可以直接算）、`remark`、`createdBy`；`(campaignId, statDate)` 唯一。接口：`GET /attribution/costs?campaignId=&from=&to=&page=&pageSize=`、`POST /attribution/costs`（重复的 `(campaignId, statDate)` 返回 409 `COST_EXISTS`，改用 `PUT`）、`PUT /attribution/costs/{id}`、`DELETE /attribution/costs/{id}`、`POST /attribution/costs/batch`（请求体是数组，元素 `{"campaignCode","statDate","amount","currency","remark"}`，服务端按 `code` 解析 `campaignId`，不存在则该行不合法；同一批内重复的 `(campaignCode, statDate)` 整批 400 并在 `data.details` 说明；条数不超过 `attribution.cost_batch_max`，默认 1000；**全部成功或全部失败**，任何一行不合法整批拒绝并在 `data.details` 里逐行说明；批量里已存在的 `(campaignId, statDate)` 按覆盖处理）。后台的 CSV 导入由浏览器解析成这个数组，表头 `campaign_code,stat_date,cost,currency,remark`，日期接受 `YYYY-MM-DD`、`YYYY/MM/DD`、`YYYY.MM.DD`，`currency` 与 `attribution.cost_currency` 不同的行不合法。写审计日志。

**投放效果 `GET /attribution/performance?from=&to=&campaignId=&groupBy=campaign|day`**（权限 `ATTRIBUTION:VIEW`，读汇总表 `StatAttributionDaily`，17.6）：每行是一个投放账户（或一天）的 `pageViews`（落地页访问量）、`clicks`（点击数：下载点击加归因链接跳转）、`clickRate`（`clicks / pageViews`，访问量为 0 时为 `null`）、`installs`（自建归因的匹配安装数）、`installRate`（`installs / clicks`，dramaBox 叫匹配率，"匹配数 ÷ 点击数"）、`registered`（口径同 17.6 `StatAttributionDaily` 的 `registered`：`source=SELF` 且 `attributionCampaignId` 非空、`registeredAt` 落在该日的归因记录数）、`registerRate`（`registered / installs`）、`cost`（总花费）、`cpa`（`cost / registered`，注册为 0 时为 `null`）、`cpi`（`cost / installs`）。另有一行"未归因"（`campaignId=0`），只有 `unattributedInstalls`：当天认领后没有匹配上的安装数，用来看自然量占比（dramaBox 对自然量只忽略不记录，这里记计数）。比率用汇总后的分子分母再算，不对各行比率求平均。`StatAttributionDaily` 的落地任务见 17.6，补数 `POST /stats/land/attribution-daily?date=`。

---

## 十一、内容审核与举报

依据：主设计文档第 17 节。这是平台合规硬性要求（App Store Review Guideline 1.2 和 Google Play 的 AI 生成内容/用户生成内容政策）。

### 11.1 审核对象与挂点

| 对象 | 审核发生的位置 | 检查方式 | 高风险（`BLOCK`） | 中风险（`REVIEW`） |
|------|---------------|---------|------------------|-------------------|
| 形象照片 | 生成任务的第一步（3.2） | 图片审核服务 | 任务 `FAILED`，`failureReason=CONTENT_REJECTED`，删除原照（此时还没有预览图） | 任务 `IN_REVIEW` |
| 声音样本 | 同上 | 音频审核服务；`transcript` 文本另按文本检查 | 同上 | 同上 |
| 照片里的人的年龄 | 第一步之后，形象生成服务内（人脸检测与年龄估计同一次推理，3.2）；生成的标准图另判一次（每次尝试的生成图，判为像未成年人只作废这一次尝试，3.5） | 人脸分析模型（格式 1）的年龄估计：任何一张检测分数不低于 `moderation.face_min_det_score` 的人脸，估计岁数低于 `moderation.underage_reject_below_age` 即判为明显未成年（`moderation.age_check_enabled` 为真时） | 任务 `FAILED`，`failureReason=SUBJECT_UNDERAGE`，删除原照；检测不到人脸为 `NO_FACE_DETECTED`（人脸检测总是执行） | 无：不转人工复核，判断不明确的放行 |
| 生成的标准图（`contentType=AVATAR_IMAGE`） | 形象生成服务产出之后、落地之前（3.2 的第三段，`AVATAR`、`LOOK` 任务；`moderation.generated_output_review` 为真时） | 图片审核服务 | 任务 `FAILED`，`failureReason=CONTENT_REJECTED`，删除生成结果 | 任务 `IN_REVIEW`，复核通过才落地 |
| 动作片段（`contentType=ACTION_CLIP`） | 片段生成之后（3.8；`moderation.generated_output_review` 为真时） | 视频审核服务 | 该片段 `FAILED`，不发站内通知 | 该片段 `IN_REVIEW`，复核前不下发 |
| 聊天文本 | 内部接口写入时（5.1） | 规则 + 文本分类 | 不落库，只留不含原文的 `ModerationRecord` | 落库并进复核队列，复核违规则 `hidden` |
| 文字对话消息 | 用户文字：`POST /api/chat/messages` 的第 8 步；助手回复：收到 agent 的 `done` 之后（5.4） | 规则 + 文本分类 | 用户文字：400 `CONTENT_REJECTED`，不保存、不调 agent；助手回复：不落库，只留不含原文的 `ModerationRecord` | 落库并进复核队列，复核违规则 `hidden` |
| persona | `PUT /api/persona`（2.5） | 规则 + 文本分类 | 400 `CONTENT_REJECTED`，不保存 | 存入 `personaPending`，复核通过才生效 |
| 伴侣名字 | `PUT /api/companion-name`（2.5.1） | 规则 + 文本分类 | 400 `CONTENT_REJECTED`，不保存，只留不含原文的 `BLOCKED` 记录（`contentRef` 填新生成、不写进 `User` 的 UUID） | 同样 400 `CONTENT_REJECTED`，不保存，不进复核，同样只留 `BLOCKED` 记录（`autoLevel=REVIEW`）；审核服务故障时按 2.5.1 先保存、事后复核 |

### 11.2 审核服务

后端定义接口 `ContentModerationProvider`，输入内容类型和内容（文本、文件），返回 `{level: PASS|REVIEW|BLOCK, categories, score, providerRef, serviceFailed}`（`serviceFailed` 为布尔：服务超时或报错时为 `true`，此时 `level` 取 `REVIEW`、`score` 为空；正常返回时为 `false`，调用方据此区分"服务故障"和"服务判定的中风险"，2026-10-18 加）；`level` 由 `AppConfig` 里的阈值（`moderation.block_score`、`moderation.review_score`）从服务返回的分数映射。文本检查是两层：先跑运营维护的规则词表（`AppConfig`，管理后台可编辑），再调服务的文本分类。

**规则词表 `moderation.text_rules`**：数组，每条 `{"id":"<UUID，保存时生成>","pattern":"…","matchMode":"SUBSTRING"|"WORD"|"REGEX","level":"REVIEW"|"BLOCK","note":"…"}`。`pattern` 去空白后 1 到 200 个码点；最多 `moderation.text_rules_max`（200）条；保存时校验，`REGEX` 必须能编译（Java `Pattern`），不合格返回 400 `INVALID_REQUEST`，`data.details` 一律用该元素在请求数组 `items` 里的下标（从 0 起的十进制字符串）作 `ref`（整表替换下，被删除的规则没有元素、新增的没有 `id`，只有下标对得到行），`reason` 用 1.4 的代码：`pattern` 去空白后为空 `EMPTY_NOT_ALLOWED`、超过 200 个码点 `TOO_LONG`；`matchMode`、`level` 不在取值内 `OUT_OF_RANGE`；`note` 超过 200 个码点 `TOO_LONG`；`REGEX` 不能编译 `INVALID_PATTERN`；条数超过 `moderation.text_rules_max` 时 `details` 只有一项，`ref` 为 `items`、`reason` 为 `OUT_OF_RANGE`。**匹配前先规范化**：对被审核文本做 Unicode NFKC、`toLowerCase(Locale.ROOT)`，并去掉 Unicode 类别为 `Cf` 的格式字符（零宽字符等，防止用它们绕过）；`SUBSTRING` 和 `WORD` 的 `pattern` 同样规范化，`REGEX` 按原样编译并带 `CASE_INSENSITIVE | UNICODE_CASE`。`SUBSTRING`：规范化文本包含该串即命中，适用于没有空格分词的文字（中文、日文、泰文、缅甸文等）；`WORD`：命中处的前后字符都不是字母或数字（`\p{L}`、`\p{N}`）才算，适用于拉丁等有空格的文字，避免短词误伤长词；`REGEX`：用 `find`。**正则执行有时间预算**（每条规则每次 20 毫秒，用检查时间的 `CharSequence` 包装实现，Java 的 `Pattern` 本身没有超时），超时按该规则命中、级别取 `REVIEW` 处理（宁可进复核也不放行，也不拖住请求）。**级别合并**：命中规则的最高级别与服务文本分类的级别取较高者（`BLOCK` > `REVIEW` > `PASS`）；规则命中 `BLOCK` 时不再调用服务（内容不必发给第三方），规则命中 `REVIEW` 时仍调用服务（它可能升级为 `BLOCK`）；服务出错时规则命中的级别与 `REVIEW` 取较高者。`ModerationRecord.categories` 记命中的规则 `id`（形如 `RULE:<id>`），不记命中的文字。规则词表为空时没有规则这一层。规则适用于所有文本对象：聊天消息、文字对话的用户文字与助手回复、persona、伴侣名字（2.5.1）、声音样本的 `transcript`。

**主设计文档只写了"第三方内容安全 API"，没有指定厂商。缺的输入是厂商选型，以及它是否覆盖视频和音频**（视频覆盖仍然需要，用途从"上传视频"变成"生成的动作片段"，3.8）。后端只依赖上面的接口，选定后实现一个适配器即可。**生产环境没有配置审核服务时，后端启动失败**（同 AvatarAgent 对 `AGENT_MAX_JOBS` 的处理思路：没有默认值，未配置就拒绝启动），避免带一个空的审核上线；开发和测试环境可用本地桩实现。

**审核服务超时（`moderation.call_timeout_seconds`）或报错**：按 `REVIEW` 处理（进复核队列），不能放行也不能丢内容，也不能让上传/写入接口失败。**例外：伴侣名字**（2.5.1）：调用方看到 `serviceFailed=true` 时只采用规则词表那一层的结果，规则不是 `BLOCK` 就保存并写 `PENDING_REVIEW` 记录（事后复核）；这是为了不让服务故障把所有人的伴侣名字都拒掉，名字很短，先保存再复核的代价小于拒掉。

### 11.3 举报

```
POST /api/reports    # 鉴权：JWT
```

**请求体：** `{"targetType":"MESSAGE","targetId":"123","reason":"SEXUAL","detail":"..."}`

| 字段 | 取值 |
|------|------|
| targetType | `MESSAGE`（聊天消息，含数字人的回复）、`AVATAR`、`VOICE`（资产库里的资产） |
| reason | `SEXUAL`、`HARASSMENT`、`VIOLENCE`、`SELF_HARM`、`OTHER` |
| detail | 自由文字，不超过 1000 个字符（按 Unicode 码点计） |

本产品是用户与自己数字人的一对一对话，用户只能看到自己的内容和数字人的回复，所以只允许举报当前账号自己的对象；对象不存在或不属于当前账号返回 404 `REPORT_TARGET_NOT_FOUND`。举报写一条 `source=REPORT` 的 `ModerationRecord`，进和自动审核**同一个**复核队列。同一账号对同一对象已有待处理举报时，返回已有的 `reportId`，不重复创建。响应 `{"reportId":"..."}`。

### 11.4 人工复核

管理后台的审核队列（第十七节，`MODERATION:REVIEW`）对每条 `ModerationRecord` 做 `APPROVE` 或 `REJECT`，效果：

| 对象 | APPROVE | REJECT |
|------|---------|--------|
| 上传任务（`IN_REVIEW`，原照中风险） | 任务继续生成 | 任务 `FAILED`（`CONTENT_REJECTED`），删除原照 |
| 生成任务（`IN_REVIEW`，生成结果中风险：`AVATAR`、`LOOK` 的标准图） | 落地形象或外观（3.2、3.6） | 任务 `FAILED`（`CONTENT_REJECTED`），删除原照或生成结果 |
| 动作片段（`ACTION_CLIP`，`IN_REVIEW`） | 片段 `READY` | 片段 `FAILED`，删除片段文件，不发站内通知（3.8） |
| 已有资产（来自举报） | 无变化 | 删除该资产：清空 `currentXxxAssetId`（若指向它）、删除文件（形象同时删除它的外观和片段，3.4），并触发第十三节的外部数据删除；资产所有者收到审核拒绝通知（25.3 第 1 条，`contentType` 为 `AVATAR` 或 `VOICE`），和记录 `REJECT` 的条件更新、资产行的删除在同一个事务里写入 |
| 聊天消息 | 无变化 | `Message.hidden=true`，`updatedAt` 更新（5.2 会把它作为墓碑同步给客户端） |
| persona 待审 | `personaPending` 覆盖 `persona`（仅当记录的 `contentRef` 等于该用户当前的 `personaPendingRef`，否则只关闭记录，2.5） | 清空 `personaPending`，`personaModerationStatus=REJECTED`（同样仅当 `contentRef` 匹配）：更新到 1 行才产生审核拒绝通知（25.3 第 1 条，`contentType=PERSONA`）；更新到 0 行（用户已提交了新版本）只关闭记录，不发通知 |
| 伴侣名字（审核服务故障时保存的，2.5.1） | 无变化 | 条件更新 `UPDATE User SET companionName=NULL WHERE id=? AND companionNameRef=<记录的 contentRef>`：更新到 1 行才产生审核拒绝通知（25.3 第 1 条，`contentType=COMPANION_NAME`）；更新到 0 行（已改名）只关闭记录，不发通知 |

裁决用条件更新（`WHERE status='PENDING_REVIEW'`），对已处理的记录再裁决 → 409 `INVALID_STATE`（`data.status` 是当前状态），所以两个审核员先后 `REJECT` 同一条不会重复删除资产。每次复核写一条 `AdminAuditLog`（谁、何时、对哪条、结论）。管理后台队列按待处理时长排序并展示最老一条的等待时长，因为政策要求举报的内容"必须真的被处理，不能摆设"。

### 11.5 不需要后端工作的部分

数字人回复上的"AI 生成"常驻标识（主设计文档 §17）和公开的社区规范页面入口都是客户端的事，后端不提供接口。

### 11.6 照片里的人投诉

依据：形象渲染设计 10.4、13.1.4。形象可以用任何人的照片生成（上传时用户声明已取得同意，3.2）。照片里的人不是我们的用户，用不了 App 内的举报（11.3），所以提供一个公开的网页表单"有人用了我的照片"：

```
POST /api/public/likeness-complaints    # 无需登录，multipart/form-data：contactEmail、description、可选的证据文件（字段 evidence）
```

- **请求字段**：`contactEmail` 按 2.2 的规则规范化并检查格式，不合格 400 `INVALID_REQUEST`；`description` 按 1.9 去掉首尾空白后 1 到 2000 个 Unicode 码点，否则 400 `INVALID_REQUEST`；证据是字段 `evidence` 的 0 到 5 个文件，每个不超过 10 MB，类型只收 JPEG、PNG、PDF，按文件头判断（不看请求头声明的类型），数量、大小或类型不合格 400 `INVALID_REQUEST`。成功返回 200，`data` 为 `{"complaintId":"<UUID>","dueAt":"<ISO-8601>"}`。
- 按 IP 限流（`ratelimit.likeness_complaint_per_ip_per_hour`，1.6），超限 429 `RATE_LIMITED`。
- 收到后生成一条 `LikenessComplaint`（状态 `RECEIVED`，`dueAt = receivedAt + complaint.likeness_due_hours`），并给 `contactEmail` 发确认邮件（模板 `LIKENESS_COMPLAINT_RECEIVED`，17.4）；确认邮件发送失败只记日志，不影响受理（照常返回 200）。
- 处理时限 `complaint.likeness_due_hours`（17.5，默认 48）；超过时限仍未结案写告警 `LIKENESS_COMPLAINT_OVERDUE`（17.4）。
- **怎么找到对应的形象，还没有定**：能否用投诉人的照片和用户上传的原照做人脸比对需要法律意见（缺的输入）；在此之前由运营根据投诉人提供的上传者信息（账号、邮箱、邀请码等）人工查找。
- **状态流转**：`PUT /likeness-complaints/{id}/status {status, note}`（17.4，`COMPLAINT:MANAGE`）只接受 `INVESTIGATING`、`RESOLVED_NOT_FOUND`、`REJECTED`；`RESOLVED_REMOVED` 只能由下面的删除执行产生，用 PUT 设它返回 400 `INVALID_REQUEST`。已结案的投诉（`RESOLVED_REMOVED`、`RESOLVED_NOT_FOUND`、`REJECTED`）不能再改，返回 409 `INVALID_STATE`（`data.status` 是当前状态，1.4），转换用条件更新。`note` 选填，去掉首尾空白后不超过 1000 个字符（本行新定）。**每次流转（包括删除执行）写一条 `LikenessComplaintEvent`**（`fromStatus`、`toStatus`、`note`、`adminId`、`createdAt`），同时照常写审计日志；`GET /likeness-complaints/{id}` 的"处理记录"取自 `LikenessComplaintEvent`，不取审计日志。`LikenessComplaint.handledBy` 取最近一次流转的管理员；进入已结案状态时写 `resolvedAt`。
- **查看证据**：管理员用 `GET /likeness-complaints/{id}/evidence/{index}`（17.4，`COMPLAINT:VIEW`）取证据文件：`index` 从 0 起，对应 `evidenceRefs` 的下标；返回 `{"url":"<短时效签名地址>","mediaType":"image/jpeg"}`，地址有效期与内容审核的签名地址相同；每次读取写一条审计日志，`detail` 只写投诉 ID 和下标；投诉不存在或下标越界返回 404 `RESOURCE_NOT_FOUND`。
- 投诉记录（含投诉人的邮箱和证据）和它的 `LikenessComplaintEvent` 从结案（`resolvedAt`）起保留 `complaint.retention_days` 天后由每天的清理任务一起删除（17.5）；没有结案的投诉不删除。

**投诉属实时的删除执行**：管理员在投诉详情里对查到的形象执行删除（`POST /likeness-complaints/{id}/remove-avatars {assetIds}`，17.4），效果与 11.4"已有资产被举报 `REJECT`"相同：在一个事务里删除 `AvatarAsset` 及其全部 `AvatarLook`、`ActionClip`，清空 `User.currentAvatarAssetId`（若指向它），删除原照、标准图、驱动资源包、片段、预览图，并为 `resultRef` 和该形象各任务的 `externalName` 插入 `ExternalDeletionJob`（类型 `AVATAR`，持久化重试，13.2）；手机缓存在客户端下次同步时删除。同一事务里把形象 ID 记进 `LikenessComplaint.relatedAvatarAssetIds`，投诉置 `RESOLVED_REMOVED`（写 `resolvedAt`、`handledBy`，插入一条 `LikenessComplaintEvent`）；写审计日志。已结案的投诉执行删除返回 409 `INVALID_STATE`。对上传者按本节处理：写一条 `source=COMPLAINT` 的 `ModerationRecord` 供统计，上传者收到 `notification.moderation.rejected`（`contentType=AVATAR`，25.3）。

---

## 十二、客服反馈

依据：主设计文档第 19 节。内部只做一个"提交反馈"入口，实际处理接入第三方客服工具，不自建工单系统。

```
POST /api/support/feedback    # 鉴权：JWT
```

**请求体：**
```json
{"category":"BUG","message":"...","context":{"appVersion":"1.0.0","osVersion":"14","deviceModel":"Pixel 8","locale":"zh-Hans-SG","recentErrors":["..."]}}
```

| 字段 | 规则 |
|------|------|
| category | `BUG`、`QUESTION`、`SUGGESTION`、`OTHER` |
| message | 1–4000 个字符（按 Unicode 码点计，一个 emoji 算一个；客户端也按码点计，不按 UTF-16 长度） |
| context.recentErrors | 客户端最近的错误摘要，最多 20 条，每条不超过 500 字符，用来帮助客服排查 |

**处理**：先存一条 `SupportFeedback`（转发状态 `PENDING`），再由后台任务通过 `SupportForwarder` 接口转发给第三方客服工具，成功后置 `FORWARDED` 并记对方返回的引用，失败按退避重试（转发任务挑选 `forwardStatus=PENDING` 且 `nextAttemptAt` 为空或不晚于现在的反馈）：下一次尝试的间隔 = `min(retry.initial_seconds × 2^(已失败次数−1), retry.max_seconds)`，加上正负 10% 的随机抖动（`SupportFeedback.nextAttemptAt`），连续失败达到 `retry.max_attempts`（默认 10）次后置 `FAILED` 并停止；`FAILED` 的反馈只能由管理员在后台重新转发（`POST /support/feedback/{id}/retry`，17.4，把状态置回 `PENDING`、失败次数清零）。多实例靠转发任务的数据库锁保证同一时刻只有一个实例处理。没有配置第三方客服工具时不转发，状态保持 `PENDING`，不计失败次数。响应 `{"feedbackId":"..."}`。限流：每账号每小时 `support.rate_limit_per_hour`（默认 10，1.6）。

**第三方客服工具选哪个是运营侧的决定**（主设计文档 §19 原文），缺的输入是选型结果；接口做成适配器，选定后实现一个即可。选定之前，反馈全部保存在 `SupportFeedback` 里，管理后台的"客服"模块（第十七节，`SUPPORT:VIEW`）可以直接查看，不会丢。

举报违规内容不走这个接口，走 11.3 的 `POST /api/reports`；客户端同一个入口里的两个分支分别调用这两个接口。

---

## 十三、账号删除与数据导出

App Store 和 Google Play 都强制要求应用内可以删除账号；数据导出是 GDPR 的数据可携权。账号删除是 GDPR 删除权（第 17 条）的要求，应用商店的账号删除规定也要求删除账号关联的数据，只有出于安全、防欺诈、合规等合法理由才可以保留，并且要告知用户保留什么、为什么、多久（Google Play 官方说明 [核实 support.google.com/googleplay/android-developer/answer/13327111]）。Replika 被意大利监管机构罚款 500 万欧元的理由是没有处理数据的合法依据、隐私政策不合规、没有年龄验证，不是删除后继续保留聊天记录（主设计文档 §7 原先的说法不准确 [核实 PYMNTS、Comm Law Group，2026-10-05]）。

### 13.1 账号删除

```
POST /api/account/deletion    # 鉴权：JWT
```

**请求体（重新验证身份）：** 邮箱账号 `{"password":"..."}`，密码错误返回 401 `INVALID_CREDENTIALS`；Google/Apple 账号 `{"socialToken":"..."}`，是一个新取得的 ID token，按 2.7 的方式校验且 `sub` 必须与该账号一致；手机号账号 `{"code":"..."}`，是先调 `POST /api/auth/phone/otp/send`（`purpose=DELETE`，不带 `phone` 即发给本账号的号码；带了则必须是本账号的号码，23.2）收到的 6 位短信验证码，错误返回 400 `OTP_INVALID`（过期或已作废 `OTP_EXPIRED`；第 `sms.otp_max_attempts` 次错误返回 429 `OTP_ATTEMPTS_EXCEEDED`，之后再提交返回 `OTP_EXPIRED`）。**同时有多种登录方式的账号，各种凭据都接受**：带 `password` 就按密码校验（错误返回 401 `INVALID_CREDENTIALS`），带 `socialToken` 就按第三方令牌校验（无效返回 401 `INVALID_SOCIAL_TOKEN`），带 `code` 就按短信验证码校验；有登录凭据的账号一种都不带返回 401 `INVALID_CREDENTIALS`。**同一个请求里同时带了多种凭据（例如 `password` 和 `code`）时，带了的每一种都必须通过**：按 `password`、`socialToken`、`code` 的顺序校验，第一个不通过的返回它自己的错误码，后面的不再校验（短信验证码不会因此被消耗）。客户端对这类账号优先发 `password`，其次 `socialToken`，最后 `code`。**账号是否能用某种凭据，只取决于账号上有没有这种登录方式，与 `auth.phone_login_enabled` 无关**（23.1）。**13.3 的导出使用同一套重新验证，规则和错误码完全相同**，只是手机号账号取验证码时 `purpose=EXPORT`（23.2）。

**删除原因（可选，2026-10-18 加）**：请求体另可带 `reason`，取 `NOT_USEFUL`、`TOO_EXPENSIVE`、`PRIVACY_CONCERN`、`TECHNICAL_PROBLEMS`、`FOUND_ALTERNATIVE`、`OTHER` 之一（页面结构设计 I 节：Replika 删除账号时先选原因）；缺省或 `null` 表示没选，其他值 → 400 `INVALID_REQUEST`（先校验 `reason`，再验证身份：两者同时不成立时返回 400，不是 401）。存在 `AccountDeletion.reason`，只存枚举、不收自由文本：`AccountDeletion` 在账号删除后仍保留，不能留个人信息。网页删除（13.4）和后台代发起（17.4）不带。

**接口内同步完成的部分**（同步阶段 a、b、d 成功返回时已生效，c 尽力而为）：
a. **条件更新** `User.status` 从 `ACTIVE` 或 `BANNED` 置为 `PENDING_DELETION`（`WHERE status IN ('ACTIVE','BANNED')`，同一事务里先 `SELECT … FOR UPDATE` 读出旧状态记为 `statusBefore`，再条件更新；更新不到行说明账号已经在删除流程里，按读到的状态返回 403 `ACCOUNT_DELETION_SCHEDULED`（带已有的 `scheduledAt`）或 403 `ACCOUNT_DELETING`，所以并发的两个申请只有一个成功，`statusBefore` 不会被第二个请求读成 `PENDING_DELETION`），此后除 `POST /api/account/deletion/cancel`、`POST /api/auth/logout`、只读的 `GET /api/account` 和 `purpose=DELETE` 的 `POST /api/auth/phone/otp/send` 外，所有需要登录的接口返回 403 `ACCOUNT_DELETION_SCHEDULED`（2.8）。
b. 作废该账号**除申请所用登录链（访问令牌里的 `sid`）之外**的全部 refresh token（网页路径 13.4 和后台代发起 17.4 没有当前链，作废全部），删除全部推送 token，并把被作废的那些登录链的 `familyId` 加入作废集合 `revoked_sid`（这些链永久作废，取消删除也不恢复，其访问令牌立即失效；申请所用的那条链不进作废集合，它此后的每个请求在状态检查处得到 `ACCOUNT_DELETION_SCHEDULED`，2.6）。保留申请所用的登录链，**并把它当前有效的 refresh token 的到期时间延长到不早于 `executeAfter`（同一个事务里更新，之后每次轮换沿用 2.6 的例外规则）**，是为了让这台设备在宽限期内——哪怕一直没有打开 App——能继续刷新令牌、显示“取消删除”界面并取消删除——手机号账号在宽限期内重新登录要靠 `LOGIN` 验证码，而手机号登录开关、国家白名单、全局短信上限都可能让它发不出来（23.3）；其他设备的登录链被作废，要重新登录。
c. 如果该账号有进行中的 LiveKit 房间，用 `RoomServiceClient` 删除房间，让 agent 立刻停止。
d. 创建一条 `AccountDeletion` 记录（`accountId` 在非终态 `SCHEDULED`、`PENDING`、`RUNNING`、`FAILED` 时唯一，用部分唯一索引保证；`AccountDeletion` 没有指向 `User` 的外键，`User` 行删除后它仍保留）：`status=SCHEDULED`，`executeAfter` = 现在 + `deletion.grace_days` 天（默认 14，范围 1 到 30），`statusBefore` = 申请时的 `User.status`（`ACTIVE` 或 `BANNED`，被封禁的账号可以走网页删除，13.4）。

**事务与失败语义**：同步阶段 a、b、d 在**一个数据库事务**里完成，全部成功或全部不生效（失败返回 500，账号保持原状态）；同一个事务里还把该账号尚在 `PENDING` 的导出任务置 `FAILED`（`failureReason=ACCOUNT_DELETION`，13.3）。同步阶段 c 在事务提交之后执行，尽力而为：删除房间失败只记日志，不影响响应；这次通话由 15.6 的到点扫描收尾（`finalizeSession` 对 `PENDING_DELETION` 的账号照常运行，其中的邀请奖励评估遇到 `PENDING_DELETION` 是跳过而不是失败，9.1）。进行中的上传任务（`GenerationTask`）在宽限期内不取消，账号可能取消删除；进入 `DELETING` 时的处理见下面步骤表的第 2 步。

响应 `{"deletionId":"...","scheduledAt":"<executeAfter>"}`。**宽限期**：从用户角度账号此刻起不可用（收不到推送、不参与召回、不计入活跃统计），但数据完整保留，用于取消删除。宽限期的依据是用户要求能找回账号（2026-10-05 的决定）；长度取 14 天而不是 30 天，是因为 GDPR 要求一个月内答复删除请求 [推断，未核对原文]；“可撤销的删除期”是常见做法 [未核对]。

**确认界面必须写明的内容**（App 内的确认页和 13.4 的网页都要有）：删除后额度余额会被清零、无法恢复；订阅不会随账号删除而自动取消，要先在 Apple 或 Google 的商店里取消；宽限期的天数（取自客户端配置 `accountDeletionGraceDays`，26.2）和“期间登录即可取消”。照 dramaBox 的删除页提示余额清零 [核实 审计 13-44]。

**取消删除**：`POST /api/account/deletion/cancel`（鉴权：JWT；请求体同 13.1 的重新验证身份；手机号账号取验证码用 `purpose=DELETE`（23.2），账号有哪些登录方式从宽限期内允许调用的 `GET /api/account` 取（`providers`，2.9））。`AccountDeletion.status=SCHEDULED` 时条件更新为 `CANCELED`（写 `canceledAt`），`User.status` 恢复为 `AccountDeletion.statusBefore`（申请时被封禁的账号取消后仍是 `BANNED`，宽限期不能用来绕过封禁），返回 200，`data` 为 `null`（`User.status` 的恢复和 `AccountDeletion` 的更新在同一个事务里；顺序同导出，13.3：先重新验证身份，再检查状态）；取消与宽限期满的定时任务争用同一个条件更新（`status=SCHEDULED`），只有一方成功；`User.status` 不是 `PENDING_DELETION`（例如重复取消、从未申请过），或 `AccountDeletion` 已被取消 → 409 `INVALID_STATE`；宽限期已满、定时任务已把 `User.status` 置为 `DELETING` 之后，请求在状态检查处先得到 403 `ACCOUNT_DELETING`，到不了取消接口（后台取消路径对 `DELETING` 返回 409，17.4）。取消后推送令牌需要客户端重新登记（宽限期开始时已注销）。宽限期内登录（任何登录方式）照常成功，客户端从第一个被拦住的请求返回的 `data.scheduledAt` 得知账号待删除，显示“取消删除”界面。这个接口归入 1.6 的已登录敏感接口，共用 `ratelimit.sensitive_per_account_per_hour`。

**宽限期满**：定时任务（每分钟一次，多实例用数据库锁，1.1）选出 `status=SCHEDULED` 且 `executeAfter ≤ 现在` 的记录，条件更新为 `PENDING`，同一个事务里把 `User.status` 置为 `DELETING`，然后按下面的步骤执行（`DELETING` 之后的流程不变）。

**后台完成的部分**（宽限期满、`User.status` 变为 `DELETING` 之后）：`AccountDeletion` 按下面的顺序逐步执行，每步记录状态、每步幂等，失败按退避重试，直到全部完成；连续失败达到配置次数后在管理后台告警（第十七节）。**账号在所有步骤完成前保持 `DELETING`，用户名下的邮箱和手机号在此期间不能被重新注册（该手机号再来登录得到 `ACCOUNT_DELETING`，23.2）。**

| 顺序 | 步骤 | 说明 |
|------|------|------|
| 1 | AvatarMemory 清除该账号数据 | 开始前先等该账号的文字对话锁 `chat_turn:{accountId}` 释放（5.4，最长 `chat.turn_timeout_seconds + chat.turn_lock_grace_seconds`），因为进行中的文字轮次收尾时还会写入记忆（等满最长时间锁仍被持有 → 本步按失败处理，`error=LOCK_HELD`，按退避重试，不调用 AvatarMemory）；再等 AvatarMemory 档位同步的锁 `memory_sync:{accountId}` 释放（16.1，同步任务执行前会检查账号状态，`DELETING` 的账号放弃同步，所以此后不会再有同步写入）；然后调 13.2 的 AvatarMemory 接口；对方返回"账号不存在"视为成功 |
| 2 | 合成服务删除该账号所有音色 | 先处理该账号所有非终态的 `GenerationTask`（包括 `LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP`）：置 `FAILED`（`failureReason=ACCOUNT_DELETED`，只供内部，3.3），已提交过外部服务的为它们创建 `ExternalDeletionJob`（每个任务的置 `FAILED` 和创建删除任务在同一个数据库事务里，按任务逐个提交，所以重试时已是终态的任务不会漏掉删除任务）；轮询任务落地资产（以及外观、动作片段）的事务先对 `User` 行 `SELECT … FOR SHARE` 再读 `status`（做法同 15.4），`DELETING` 或不存在则丢弃结果并创建删除任务，所以不会在步骤 6 之后把资产落在已删账号名下。然后对每条 `VoiceAsset`，按 `resultRef`（音色名）调 13.2 的接口 |
| 3 | 形象生成服务删除该账号所有生成的形象 | 对每条 `AvatarAsset.resultRef`，以及每条有 `externalName` 的 `LOOK`/`LOOK_REPREPARE`/`ACTION_CLIP` 任务，调 13.2 的接口（`delete`） |
| 4 | 删除本后端存储里的文件 | 原始上传的照片/音频、预览图、标准图、驱动资源包、动作片段文件、导出文件 |
| 5 | 删除 MongoDB 中该 `accountId` 的数据：`event_log` 的事件（含其中的 `ip`）、`auth_event` 的认证事件日志（2.11）、`ad_impression_log` 的广告展示记录（22.3）；`usage_log` 的记录不删，只把该账号的 `accountId` 和 `sessionId` 置空（用量和费用保留用于成本统计，14.2） | `event_log` 里只带 `deviceId`、没有关联账号的匿名事件不在其内。`SmsSendRecord`（23.4）没有 `accountId`，**不在这一步删除，到 `sms.record_retention_days` 由 TTL 索引自动删除**；这是有意的保留：记录里有完整号码、验证码已替换为 `****` 的正文和发送结果，用途是排查送达问题和识别短信盗刷，保留期短、仅管理员（需 `SMS:RECORD`）可见。这一保留要写进隐私政策（隐私政策的内容是缺的输入，26.2） |
| 6 | 先按 13.5 写防滥用标记，再删除 PostgreSQL 中该账号的行 | `Message`、`Session`、`CompanionshipStats`、`Milestone`、`GenerationTask`、`AvatarAsset`、`AvatarLook`、`LookPackage`（按该账号外观的 `lookId`）、`ActionClip`、`AccountCosmetic`、`VoiceAsset`、`PushToken`、`PushDelivery`（没有 `accountId`，按 `pushId` 属于该账号的 `PushRecord` 删除，所以必须先于 `PushRecord`）、`PushRecord`、`NotificationPreference`、`InviteCode`、`InviteRecord`（作为邀请人或被邀请人的都删）、`AttributionRecord` 和归因关联、`SupportFeedback`、`RefreshToken`、`ExportJob`、`CreditAdjustRequest`、`Notification`、`AdFrequencyState`、`AdRewardVerification`、`Subscription`、`SubscriptionEvent`（`accountId` 是该账号的，或 `subscriptionId` 属于该账号的订阅；15.3）、`AccountEntitlement`、`AccountMemoryTier`、`AccountEmbeddingAssignment`、`CreditLedger`、`CreditBalance`、`AccountFeatureBonus`、`DeletionToken`、`PasswordResetToken`、`RegistrationAudit`、`CheckinRecord`、`TaskRecord`、`AdminAlert`（`accountId` 是该账号的行，含已 `RESOLVED` 的）；`OneTimePurchase` 中 `accountId` 是该账号的行**不删除，转为无账号的墓碑**：`accountId` 置空、`tombstonedAt` 置当前时间，其余字段（商店、交易号、商品、额度数、状态）保留，作为幂等锚点，防止商店之后重发 `ONE_TIME_CHARGE` 或客户端重放 `verify` 时把这笔购买再入账或让别人认领（15.9）；墓碑行在 `deletion.tombstone_retention_days` 之后由每天一次的清理任务删除；`GuestDevice.convertedAccountId` 等于该账号的行置空（保留 `convertedAt`，只用于转化统计）。`ModerationRecord` 去掉 `accountId` 并清空 `reporterDetail`（用户自己写的文字；`reporterReason` 是枚举，保留）后保留用于审核统计，审核员的 `note` 同 `AdminAuditLog.detail` 一样**不得写入用户内容**；`PushTask.accountIds` 和 `PushSchedule.accountIds` 里含该账号的，从数组中移除；`AdminAuditLog` 的 `targetId` 保留（账号 ID 是不再关联任何其他信息的假名标识符），`LikenessComplaint.relatedAvatarAssetIds` 中属于该账号的形象 ID 同样保留（理由相同），并规定审计日志的 `detail` **不得写入用户内容或用户自己写的文字**，只写动作和标识 |
| 7 | 删除 `User` 行 | 最后一步，之后邮箱和手机号可以重新注册 |

`AccountDeletion` 记录在完成后仍保留账号 ID，这是有意的（用来确认删除已完成、排查失败），除账号 ID 外不含任何个人信息。

**`AccountDeletion` 状态机**：

| 转换 | 条件 |
|------|------|
| `SCHEDULED → CANCELED` | 用户或后台取消：条件更新 `status=SCHEDULED`，写 `canceledAt` |
| `SCHEDULED → PENDING` | 宽限期满的定时任务：条件更新 `status=SCHEDULED AND executeAfter ≤ 现在`，同一事务里 `User.status → DELETING`，并把 `nextAttemptAt` 置为现在（执行器的认领条件靠它） |
| `PENDING` 或 `FAILED → RUNNING` | 执行器认领：条件更新 `status IN ('PENDING','FAILED') AND nextAttemptAt ≤ 现在`（`PENDING` 的 `nextAttemptAt` 是进入 `PENDING` 的时刻），写 `lockedAt`；更新到行的实例才执行 |
| `RUNNING → RUNNING`（重新认领） | `lockedAt` 早于现在减 `deletion.lease_minutes`（默认 10，提议）：执行器崩溃后任何实例可以重新认领；执行器在步骤内每处理一个外部对象（或每 30 秒）刷新 `lockedAt`，所有对 `stepStates`、`status` 的写入都带条件 `WHERE lockedAt = <本执行器认领或上次刷新时写的值>`，更新不到行就放弃（说明已被别的实例重新认领）；各步幂等，重新认领是安全的 |
| `RUNNING → COMPLETED` | 7 步全部 `DONE`，写 `completedAt` |
| `RUNNING → FAILED` | 某一步失败：该步在 `stepStates` 里记 `FAILED` 和错误，`attempts + 1`，写 `lastError`，`nextAttemptAt = 现在 + min(retry.initial_seconds × 2^(attempts−1), retry.max_seconds)`，加正负 10% 的随机抖动 |

`stepStates` 是固定 7 项的 JSON 数组 `[{"step":1,"status":"PENDING|DONE|FAILED","finishedAt":null,"error":null}]`，按顺序执行；重试时 `DONE` 的步骤跳过，失败的步骤从头重做。**不会放弃**：`attempts` 达到 `deletion.alert_after_failures` 时写一条 `DELETION_FAILED` 告警（`refType=ACCOUNT_DELETION`，`refId` 是 `AccountDeletion.id`，同一条删除只写一条），之后继续按同一个公式重试（间隔不超过 `retry.max_seconds`），`COMPLETED` 时告警自动 `RESOLVED`。后台 `POST /account-deletions/{id}/retry`（17.4）只对 `FAILED` 有效，把 `nextAttemptAt` 置为现在；`PENDING`、`RUNNING`、`COMPLETED`、`SCHEDULED`、`CANCELED` 返回 409 `INVALID_STATE`。

步骤 1 和 3 依赖外部服务提供目前**不存在**的删除接口（13.2），对方补上之前这两步无法完成，账号会一直停在 `DELETING`；步骤 2 的合成服务已经有删除接口。这是硬依赖，见第二十一节。

第三方处的副本（AppsFlyer、Firebase 分析、第三方客服工具里的记录）不在本后端能删的范围内，各自的删除机制是否存在、怎么调用，见第十九节的待核实项。

### 13.2 需要外部服务补充的接口（对方项目必须实现）

以下是本后端对三个外部服务的接口要求。AvatarMemory 和形象生成服务目前没有对应能力（第十九节核实），需要对方补；合成服务（AvatarAgent 的 `tts_service`）已经实现：

| 服务 | 需要的接口 | 语义 |
|------|-----------|------|
| AvatarMemory | `DELETE /v1/accounts/{account_id}/data` | 删除该账号在记忆库里的全部持久化状态：档位与 embedding 模型指派、整理计数、已被取代的记忆记录，以及向量库里的记忆（具体表以 AvatarMemory 的 migrations 为准；persona 表已被 `0005_drop_persona.sql` 删除，不在其内）。幂等，账号不存在返回成功。请求头 `Authorization: Bearer <AVATARMEMORY_API_KEY>` |
| AvatarMemory | `GET /v1/accounts/{account_id}/export?limit=&cursor=` | 返回该账号的全部记忆，用于数据导出（13.3）。响应 200 `{"memories":[{"text":"…","created_at":"<UTC ISO-8601>"}],"next_cursor":null或"…"}`，按 `created_at` 升序，`limit` 默认 1000、上限 1000；后端循环取页直到 `next_cursor` 为空，整个取数受 `export.memory_timeout_seconds`（默认 120）限制。**账号不存在或没有任何记忆返回 200 和空数组，不是 404**，否则每个还没有记忆的新用户导出都会失败。请求头同上 |
| 合成服务（AvatarAgent 的 `tts_service`，**已实现**） | `DELETE /v1/voices/{name}` | 删除注册的音色，包括注册时保存的参考录音和原文（服务只保存这两个文件，没有别的音色特征数据）。音色名匹配 `^[A-Za-z0-9_-]{1,64}$`。请求头 `Authorization: Bearer <TTS_ADMIN_API_KEY>`。成功 204；音色不存在返回 404，本后端按成功处理（幂等，3.5） |
| 形象生成服务（新的独立服务，单独仓库，3.5） | `AvatarGenerationProvider.delete(ref)`，即 `DELETE {AVATAR_GEN_URL}/v1/refs/{ref}`（带 1.8 的签名头，调用方标识 `backend-avatargen`） | 删除服务里可能残留的临时文件和原照副本（服务不长期保存生成结果，3.5）。`ref` 是 `resultRef` 或 `GenerationTask.externalName`。幂等：对不存在的 ref 返回成功 |

**Java 调用 AvatarMemory 的全部场景见 16.1**：账号删除与导出、档位指派、embedding 模型指派，以及管理后台对档位配置和模型注册的读写。Java 需要配置 `AVATARMEMORY_URL`、`AVATARMEMORY_API_KEY`（与 AvatarAgent 持有同一个密钥）和 `AVATARMEMORY_ADMIN_KEY`（1.5）。

资产库删除（3.4）也用合成服务和形象生成服务的删除接口；那里的外部删除用同一套持久化重试机制：`ExternalDeletionJob`（类型 `AVATAR`/`VOICE`、外部引用、尝试次数、`nextAttemptAt`、`lastError`、状态 `PENDING`/`DONE`），失败自动重试直到成功：间隔 = `min(retry.initial_seconds × 2^(尝试次数−1), retry.max_seconds)` 加正负 10% 抖动，不放弃；执行器认领规则同 13.1 的状态机（条件更新加租约）。

### 13.3 数据导出

```
POST /api/account/export                        # 鉴权：JWT，请求体是 13.1 的重新验证身份（`password`、`socialToken` 或 `code`），规则和错误码同 13.1：`password` 错误 401 `INVALID_CREDENTIALS`，`socialToken` 无效 401 `INVALID_SOCIAL_TOKEN`，手机号账号的 `code`（取码时 `purpose=EXPORT`）错误 400 `OTP_INVALID`、过期 400 `OTP_EXPIRED`、第 `sms.otp_max_attempts` 次错误 429 `OTP_ATTEMPTS_EXCEEDED`。创建导出任务，响应 {"exportId":"..."}
GET  /api/account/export/{exportId}             # 响应 {"status":"PENDING|READY|FAILED|EXPIRED","expiresAt":"...","failureReason":"..."}；`expiresAt` 只在任务曾经 `READY` 时有值（`READY`、`EXPIRED`），`PENDING`、`FAILED` 为 `null`；`failureReason` 只在 `FAILED` 时有值，取 `MEMORY_SERVICE_ERROR`（AvatarMemory 导出失败）、`STORAGE_ERROR`（文件存储读写失败）、`TIMEOUT`（超过 `export.job_timeout_minutes`）、`ACCOUNT_DELETION`（账号申请了删除）、`INTERNAL_ERROR`
GET  /api/account/export/{exportId}/download    # 鉴权：JWT，校验归属，返回 zip 流（响应头 `Content-Type: application/zip`、`Content-Disposition: attachment`）；压缩包流式生成，不设大小上限，只受单次任务总时长 `export.job_timeout_minutes` 约束
```

- **内容**：zip 包，含 `profile.json`（账号 ID、邮箱、手机号（完整 E.164，是用户自己的数据）、创建时间、persona、伴侣名字、会话语言）、`messages.json`（全部聊天记录，含被隐藏的；每条带 `source`（`CALL`/`TEXT`）、`sessionId`（文字对话为 `null`）、`turnStatus`）、`sessions.json`、`companionship.json`（养成数据和里程碑）、`assets.json`（形象/声音资产元数据；形象另含 `name`、`style`、`declarationVersion`、`declarationAcceptedAt` 和每个外观的元数据：服装、背景、状态、时间）、`cosmetics.json`（该账号拥有的服装和背景 `AccountCosmetic`：条目 `key`、来源、时间）、`invites.json`（该账号自己的邀请码，以及作为邀请人和被邀请人的记录：兑换时间、状态、自己得到的额度；对方只给掩码标识，9 的 `inviteeLabel` 规则，不含对方的完整信息）、`events.json`（该账号名下的埋点事件，含 `deviceId`、`ip`、`country`——它们是用户自己的数据，不属于通则里要排除的哈希）、`attribution.json`（含关联的 `appsflyerId`）、`subscriptions.json`（订阅、权益和商店订阅记录）、`credits.json`（额度余额与流水，含 `AD_REWARD` 流水；另含额外单位 `AccountFeatureBonus` 和额度购买记录 `OneTimePurchase`：商店、商品、额度数、状态、时间，不含商店内部引用）、`notifications.json`（站内通知，25.2，标题正文给出全部语言）、`ads.json`（该账号的广告展示与奖励记录：`ad_impression_log` 里保留期内的事件，以及 `AdRewardVerification`）、`checkin.json`（签到记录）、`tasks.json`（每日任务记录）、`usage.json`（该账号名下的用量记录：资源类型、来源、模型、三种 token 数或数量与单位、时间，不含费用和价格，14.2）、`memory-assignments.json`（档位与 embedding 模型指派）、`memories.json`（来自 AvatarMemory 的导出接口）、`feedback.json`（客服反馈：类别、正文、上下文、时间）、`reports.json`（该账号提交的举报：对象类型、原因、补充文字、时间）、`auth-events.json`（认证事件：类型、原因、时间，不含 IP 哈希和设备哈希）、`notification-preferences.json`、`push-records.json`（推送记录：类型、触发原因、时间，以及每次推送的发送结果 `PushDelivery`：结果、时间，不含推送令牌），以及 `files/` 目录下用户当初上传的原始照片/音频和每个外观一张标准图（驱动资源包和动作片段由标准图派生，不导出 [推断，形象渲染设计 10.5]）。**每个文件包含对应实体除密码哈希、令牌哈希、IP 和设备的哈希、存储路径等内部引用之外的所有列**；**不导出**的只有这些：`RefreshToken`、`PasswordResetToken`、`DeletionToken`、`RegistrationAudit`、`AbuseMarker`、`PushToken`（设备令牌）、自动审核产生的 `ModerationRecord`（不含用户原文）、`AdminAlert`、`AdminAuditLog`、`ExportJob`、`AdFrequencyState`（频控计数，由展示记录推出）、`ActionClip`、`LookPackage`（动作片段和驱动资源包都由标准图派生，不导出，形象渲染设计 10.5）；`GenerationTask` 放进 `assets.json`（任务状态、时间、失败原因，不含文件引用），`CreditAdjustRequest` 放进 `credits.json`（类型、变动、理由、状态、时间，不含管理员 ID），与 13.1 步骤表第 6 步的删除清单对照时，除这些外都有对应的导出文件。
- **AvatarMemory 导出失败时不能悄悄漏掉记忆部分**，否则用户拿到的是一份不完整的数据：这一步按 `export.max_attempts` 重试，用尽后整个任务 `FAILED`（`MEMORY_SERVICE_ERROR`）。
- **创建时的判断顺序**：⓪ 先做 13.1 的重新验证身份（失败即返回，不进入后面各步；否则持有被盗访问令牌的人不用密码就能拿到已有 `READY` 任务的 `exportId`）；① 账号处于 `PENDING_DELETION` 或 `DELETING` → 403（下面）；② 该账号已有 `PENDING` 的任务，或已有 `READY` 且未过期的任务 → 直接返回它的 `exportId`（不新建，不受最小间隔限制）；③ 没有这样的任务时，距上一次**成功**导出（`READY` 的任务的创建时间，含已过期的）不足 `export.min_interval_hours`（默认 24）→ 429 `RATE_LIMITED`（`data.retryAfterSeconds` 和 `Retry-After` 头，值为距可再次导出的剩余秒数，至少 1）；④ 创建新任务之前，先把该账号 `READY` 且 `expiresAt` 已过的任务条件更新为 `EXPIRED` 并删除文件（过期清扫可能还没跑到，它们会占着 `ExportJob.accountId` 的部分唯一索引，新建会撞上），再插入新任务；插入撞上 `ExportJob.accountId` 的唯一约束（并发的两个 `POST`）时回到 ② 返回已有任务的 `exportId`。**任务 `FAILED` 之后再次 `POST` 创建一个新的导出任务**，不受最小间隔限制（只有成功的导出才计入间隔），否则用户会被卡在一个失败的任务上无法重试。
- 生成的 zip 在 `expiresAt`（默认生成后 24 小时，`export.ttl_hours`）之后删除；`download` 只有 `READY` 且未过期时可用。**任务生命周期**：`PENDING` 的任务由后台执行器认领（条件更新加租约，规则同 13.1 的状态机，租期 `export.lease_minutes`，崩溃后租约过期即可被重新认领），从 `createdAt` 起超过 `export.job_timeout_minutes`（默认 30，提议，大于租期）仍未完成置 `FAILED`（`TIMEOUT`）；某一步失败按 `export.max_attempts`（默认 3，提议）次重试（退避同 13.1），用尽置 `FAILED`；**认领条件**：`status='PENDING' AND (lockedAt IS NULL OR lockedAt < 现在 − export.lease_minutes) AND (nextAttemptAt IS NULL OR nextAttemptAt ≤ 现在)`；`fileRef` 含每次尝试的随机后缀；**执行器写 `READY` 用条件更新**（`WHERE status='PENDING' AND lockedAt = <本执行器写的值>`），更新不到行（任务已因申请删除或超时置 `FAILED`，或已被别的执行器重新认领）就只删除自己刚生成的 zip，不留孤儿文件，也不会删到别的执行器的文件；**过期清扫**：每 `export.sweep_minutes`（默认 10，提议）分钟一次，先把 `PENDING` 且 `createdAt` 早于现在减 `export.job_timeout_minutes` 的任务条件更新为 `FAILED`（`TIMEOUT`），再处理 `READY` 且 `expiresAt` 已过的任务：删除 zip 文件、置 `EXPIRED`（任务行本身保留到账号删除，只剩状态和时间）。账号申请删除时，`PENDING` 的任务置 `FAILED`（`ACCOUNT_DELETION`，13.1）；已经 `READY` 的文件在宽限期内不可下载（403），文件按上面的规则过期删除，账号删除步骤表的第 4 步也会清除。
- 导出任务在后台执行，避免请求超时；账号处于 `PENDING_DELETION` 或 `DELETING` 时不能创建导出（`ACCOUNT_DELETION_SCHEDULED` / `ACCOUNT_DELETING`）；距上次成功导出不足 `export.min_interval_hours` 时创建新任务返回 429 `RATE_LIMITED`。
- 错误码：`exportId` 不存在或不属于当前账号返回 404 `EXPORT_NOT_FOUND`；任务未完成（`PENDING`）、已失败或已过期时调用 `download` 返回 409 `EXPORT_NOT_READY`（`status` 接口照常返回状态，不报错）。

---

### 13.4 网页删除入口（Google Play 强制要求）

Google Play 政策（support.google.com/googleplay/android-developer/answer/13327111，读过原文）：应用允许创建账号，就必须提供应用内删除路径，**并且必须提供一个网页链接，让用户不打开应用也能申请删除账号和关联数据**，链接填在 Play Console 的 Data safety 表单里；删除前若需要额外步骤（例如取消订阅）必须清楚说明并提供支持流程。Apple 的 5.1.1(v) 要求应用内可删除，补充要求见第十九节。

后端提供两个不需要登录的接口，网页用它们完成"申请 → 邮箱确认 → 删除"：

```
POST /api/public/deletion-request    # 请求体 {"email":"..."} 或 {"phone":"+..."}（二选一）
POST /api/public/deletion-confirm    # 请求体 {"token":"..."}（邮箱路径）或 {"phone":"+...","code":"..."}（手机号路径）
```

- `deletion-request`（邮箱路径）：**无论邮箱是否已注册都返回成功**（不泄露邮箱是否存在）。存在对应的邮箱账号（邮箱已验证的账号：邮箱密码账号，或第三方登录且 `emailVerifiedAt` 非空；`BANNED` 也算，`PENDING_DELETION`、`DELETING` 不算（已经在删除流程里））时，发一封含一次性确认链接的邮件（模板 `DELETION_CONFIRM`，只有英文一份，17.4；链接是 `{email.link_base_url}/confirm-deletion?token=<令牌>`，规则同 2.9 的重置链接）；令牌只存哈希，有效期 `deletion.web_token_ttl_minutes`（默认 60）。同一邮箱在有效期内再次申请，使旧令牌作废；每个邮箱每小时受 `ratelimit.link_mail_per_email_per_hour` 限制，超出时仍返回成功但不发信、不作废旧令牌。**响应不泄露邮箱是否存在**，做法同 2.9 的重置请求：发信走异步队列，邮件服务商或 `email.link_base_url` 没有配置时返回 503 `EMAIL_SEND_FAILED`（与邮箱是否存在无关），单封发送失败只记日志。
- `deletion-request`（手机号路径）：**无论号码是否已注册都返回成功**。号码按 23.3 规范化后，存在对应的手机号账号（`ACTIVE` 或 `BANNED`）时，发一条用途为 `DELETE_WEB` 的短信验证码；不存在则什么都不发。**这条路径不受 `auth.phone_login_enabled` 约束**（手机号账号在登录被关闭后仍然必须能删除自己，Google Play 的要求，上文），也不受 `sms.allowed_country_codes` 和 `sms.daily_global_cap` 约束（号码已经是账号的号码，不是新的发送对象）；23.3 的号码级（含 60 秒间隔）和 IP 级限制照常适用，另受 `ratelimit.public_deletion_per_ip_per_hour` 约束。因为只有已注册号码才会真的发短信，攻击者不能借这条路径向任意号码发短信。**限制的结果不泄露号码是否注册**：号码级限制（间隔、每日次数）对规范化号码在 Redis 里计数，**不论号码是否注册、是否真的发了短信都计数**；号码级超限时仍返回成功、不发短信（静默），只有 IP 级超限返回 429 `RATE_LIMITED`（它与号码无关）。号码无法解析或不是有效号码返回 400 `PHONE_INVALID`（这不泄露注册情况）。
- `deletion-confirm`：邮箱路径令牌有效则按 13.1 执行删除，不需要再输入密码（用户已经证明自己控制该邮箱），返回 `{"deletionId":"...","scheduledAt":"..."}`（确认页写明宽限期天数和取消方法，13.1）；令牌无效、过期或已用过返回 400 `INVALID_DELETION_TOKEN`。手机号路径同理：验证码正确（规则同 23.3：错 `sms.otp_max_attempts` 次作废）即视为证明控制该号码，直接执行 13.1；验证码错误返回 400 `OTP_INVALID`，过期或作废返回 400 `OTP_EXPIRED`。**号码没有未决的验证码（没人申请过、已过期、已作废、已用过）时返回 `OTP_EXPIRED`**，对已注册和未注册的号码一样。要让两者在“申请过”之后也不可区分：`deletion-request` 对**未注册**的号码同样在 Redis 里写入一个占位验证码（随机值的哈希，永远校验不成功，不发短信），之后的有效期、错误次数、作废规则与真验证码完全一致，所以未注册号码也会 `OTP_INVALID` 若干次后 `OTP_ATTEMPTS_EXCEEDED`。这条路径的短信走异步队列，响应不等待发送结果（响应时间不随号码是否注册而变，做法同邮箱路径）；发送失败只记日志，用户可以再次申请。同一账号既有邮箱又有手机号时，两条路径都可用。**确认令牌对已经在删除流程里的账号**：`SCHEDULED` 时返回已有的 `{"deletionId","scheduledAt"}`（令牌作废，重复点击确认链接无害）；`PENDING`、`RUNNING`、`FAILED` 返回 403 `ACCOUNT_DELETING`（1.4）。
- 账号有有效订阅时，确认邮件和确认页面都必须说明：商店里的订阅不会因此取消，并写明如何取消（15.8）。
- 游客没有账号，没有需要删除的账号数据（游客只有设备记录，2.1）。网页上说明：无法使用 App 时联系客服，由客服按第十二节的反馈流程人工处理；被封禁的账号（所有接口都返回 `ACCOUNT_BANNED`，应用内删除做不到）用下面的网页表单自己删除，只有邮箱和手机号都用不了时才联系客服。客服联系方式是缺的输入。客户端封禁页的申诉入口按 2.8：优先 `supportEmail`，其次 `supportUrl`（26.2），封禁页上另有账号删除的网页入口（2.8）。
- **被封禁的账号也允许走网页删除**（`deletion-request` / `deletion-confirm` 不因 `User.status = BANNED` 而拒绝）：被封禁不能让用户失去删除自己数据的权利（GDPR 第 17 条）；删除按 13.1 执行，状态变为 `PENDING_DELETION`（宽限期满后变 `DELETING`）；宽限期内取消，账号回到 `BANNED`，不是 `ACTIVE`。验收见第二十节。
- 网页本身（说明、申请表单、确认页）是单独的交付物，需要域名和托管，后端只提供上面两个接口；缺的输入是域名和托管方案。2.9 的密码重置页（`/reset-password`）和这里的确认页（`/confirm-deletion`）都放在 `email.link_base_url` 下，是同一个缺的输入。Data safety 表单里删除问题的填写是运营在 Play Console 里的操作。
- 该接口按来源 IP 限流（1.6）。

### 13.5 删除后保留的防滥用标记

**目的**：阻止“删号再注册”重复领取一次性福利。不设防护时，删除账号后重新注册会重新领一次终身通话额度（15.3 的 `call.lifetime_minutes` 行原先只靠设备校验和人工处理）；邀请奖励同理。依据：用户要求保留数据（2026-10-05，防滥用、找回账号、产品分析三个目的）；Google Play 允许出于防欺诈保留数据，但要在隐私政策里写明保留什么、为什么、多久 [核实 support.google.com/googleplay/android-developer/answer/13327111]。

**写入**（13.1 步骤表第 6 步，删除行之前）：对这个账号上有的每一个标识各写一条 `AbuseMarker`：设备（`User.registerDeviceHash`，创建账号时记下的设备 HMAC 哈希，和 `RegistrationAudit.deviceIdHash` 同值；单独存在 `User` 上，因为 `RegistrationAudit` 只保留 `abuse.audit_retention_days`，账号注册超过这个天数后审计行已不在，删除时才不会没有设备键）、手机号（E.164）、规范化邮箱、Google sub、Apple sub，其中除设备外（设备已经是哈希）都先做 HMAC-SHA256（密钥 `ABUSE_HASH_KEY`）。每条带：`lifetimeGrantSeconds`、`lifetimeUsedSeconds`（取自 `User`）、`inviteeRewarded`（该账号作为被邀请人拿到过邀请奖励：看该账号的 `User` 行——`inviteeRewardedAt` 非空，或 `priorInviteeRewarded` 为真（后一项让“前一个账号被奖励过”沿着删号重新注册的链传下去）；不看 `InviteRecord`（邀请人先删号时它已经没了），也不看流水（被邀请人的奖励额度为 0 时 9.1 不写流水）；步骤 6 删除之前 `User` 行还在，所以删除时可以读到）、`inviteRewardedCount`（取自 `User.inviteRewardedCount`）、`expireAt` = 删除时间 + `deletion.abuse_marker_retention_days`（365）。同一 `(keyType, keyHash)` 已有标记时合并：`lifetimeGrantSeconds` 和 `lifetimeUsedSeconds` **作为一对**处理，取剩余额度（`lifetimeGrantSeconds − lifetimeUsedSeconds`，发放值 `-1`（不限）视为无穷大，发放值为空的一对不参与）最少的那一对，并列取已用量大的；`inviteRewardedCount` 取最大；`inviteeRewarded` 取或；`expireAt` 取较晚。合并在事务内对该标记行 `SELECT … FOR UPDATE` 之后进行（行不存在先 `INSERT … ON CONFLICT DO NOTHING` 再锁），共用同一设备的两个账号同时执行步骤 6 不会互相覆盖。分开取最大会把“不限”的哨兵值 `-1` 当成最小的数，也会把两个标记的发放值和已用量拼成从未存在过的组合，所以必须成对取。

**使用**：新建账号（2.2、2.7、23.2）时，按这次注册带的各个标识（设备、邮箱或手机号或第三方 sub）算出哈希去查：① `lifetimeGrantSeconds`、`lifetimeUsedSeconds` 取命中标记里剩余额度最少的那一对（规则同上面的合并）——恢复删除前最保守的状态，不重新发放，也不额外惩罚；② `User.inviteRewardedCount` 初值取命中标记里的最大值；③ 邀请奖励评估（9.1）：被邀请人命中 `inviteeRewarded` 的，创建账号时在 `User.priorInviteeRewarded` 记 true；9.1 评估时读这个标志，为 true 则记 `NOT_ELIGIBLE`、`rewardReason=PRIOR_ACCOUNT`（`FIRST_CALL` 触发时记录要保持 `PENDING` 到通话结束才评估，所以不能在创建账号时当场定）。没有命中则按原规则发放。

**性质与披露**：带密钥的哈希仍然是个人数据（假名化，不是匿名），所以有保留期限，并写进隐私政策（内容属于 26.2 缺的输入）：保留什么（设备、手机号、邮箱、第三方账号标识的哈希，加上通话额度用量和邀请奖励的标记）、为什么（防止重复领取一次性福利）、多久（`deletion.abuse_marker_retention_days`）。GDPR 下用哪条处理依据要法务确认 [推断，未核对]。`ABUSE_HASH_KEY` 轮换会使旧标记失效，已知的取舍。

**删除记录和审计日志里的账号 ID**（暂定不设保留期）：账号删除完成后仍保留两样——删除请求的记录（`AccountDeletion`：请求时间、执行结果、被删账号的 ID，只含账号 ID，没有其他个人信息，18）和管理员审计日志里被操作对象的 ID（`AdminAuditLog.targetId`，13.1）。为什么保留：证明删除已执行、追溯管理员的操作。保留多久：不限。这是产品负责人的政策点，他给出天数后再改本条和相关的描述；在那之前按不限写。这一项和上面的防滥用标记一起写进隐私政策的披露清单（保留什么、为什么、多久，26.2 缺的输入）。

**不保留的**：聊天、记忆、形象、声音、文件、事件明细全部照 13.1 删除；汇总统计表是预聚合的，不受删除影响；不为产品改进保留已删账号的对话内容（自由文本无法可靠匿名化，陪伴聊天内容敏感），本节不设计对话语料的保留；支付和订阅记录随账号删除，财务记录由 Apple、Google 保存 [推断，未核对各目标国家的税务要求]。

---

## 十四、系统监控数据接收

依据：主设计文档第 21 节。管线自身的 GPU/推理资源用量和报错率由 `AvatarAgent` 项目自己采集和计算，本后端只负责接收、存储，供管理后台展示，不涉及告警和自动扩缩容。**LLM 费用不由 agent 给**：agent 只报原始用量，价格表和费用计算在本后端（14.2）。

### 14.1 管线指标上报

```
POST /api/internal/pipeline-metrics
Header: X-Key-Id、X-Timestamp、X-Nonce、X-Signature（签名规则 1.8，调用方标识 `pipeline-metrics`，密钥 `PIPELINE_SIGNING_SECRET`）
```

不走用户 JWT，用 1.8 的 HMAC 签名，**单独的**调用方标识和密钥（不与聊天记录接口共用，最小权限：泄露一个不影响另一个）。签名无效返回 401 `INVALID_SIGNATURE`。

**请求体：**
```json
{"reportedAt":"2026-09-30T01:02:03Z","source":"agent-server-1","gpuUtilization":0.63,"errorCount":3,"errorRate":0.02}
```

| 字段 | 说明 |
|------|------|
| reportedAt | 采集时间（UTC） |
| source | 上报方标识（哪台 agent server），字符串，用来区分多实例 |
| gpuUtilization | 0 到 1 |
| errorCount / errorRate | 该采集周期内的报错数和报错率 |

**校验**：`reportedAt` 缺失或不是有效的 ISO-8601 时间、`source` 不是 1 到 64 个字符（字母、数字、`.`、`_`、`-`）、`gpuUtilization` 或 `errorRate` 不在 0 到 1 之间、`errorCount` 不是非负整数，整个请求返回 400 `INVALID_REQUEST`（`message` 写明字段）；`reportedAt` 晚于服务器当前时间 5 分钟以上、或早于 24 小时以上的，按收到时间处理。去重键用请求里的原始 `reportedAt`（超出窗口时另存 `effectiveAt` 为收到时间，图表和 `GET /monitor/pipeline` 按 `effectiveAt` 排序和筛选）；`(source, reportedAt)` 唯一：重复上报（重试）忽略，仍返回 200。响应 `{"code":"200","message":"success","data":null}`。

除 `reportedAt` 和 `source` 外，其余字段都可以缺省（存空值），因为上报方能采到什么由它决定。存 PostgreSQL 的 `PipelineMetricSnapshot`，保留期 `pipeline_metrics.retention_days`（默认 90 天），每天一次的清理任务删除过期行。管理后台"系统监控"模块展示时序图表（第十七节，`MONITOR:VIEW`）：`GET /monitor/pipeline?from=&to=&source=`，`from`、`to` 缺省取最近 24 小时，范围不超过 `monitor.max_range_days`（7，提议），超出 400 `INVALID_REQUEST`；响应 `{"items":[{"reportedAt":"…","source":"…","gpuUtilization":0.63,"errorCount":3,"errorRate":0.02}],"truncated":false}`，按 `effectiveAt` 升序（每项同时带 `reportedAt` 和 `effectiveAt`），最多 `monitor.max_points`（5000，提议）条，范围内更多时取最近的这么多条并置 `truncated:true`；没有数据时显示"暂无数据"，这个接口允许长期没有上报，不阻塞其他部分。

`AvatarAgent` 目前的设计文档没有这一上报（我通读全文，无相关内容），需要它补一个调用方；在它补上之前这个接口空着不影响任何其他功能。

### 14.2 用量上报与价格表

依据：用户要监控自己的 LLM 成本（2026-10-06，AvatarAgent 会话的请求 `AvatarAgent/docs/requests/2026-10-06-java-usage-report-request.md`，下面的事实标 [请求文档]，价格接口和用量返回是对方用真实调用核实过的）。agent 没有价格、也不该有：模型不同价格不同，价格会变，放在 agent 的环境变量里每次调价都要重新部署；GPU 成本无法归到单次会话，所以只有 LLM 费用能算（这是 2026-10-06 只收 LLM 用量时的原始理由；下一段的通用用量接口已经取代它，可以计价的资源扩到表里的所有类型，包括按会话渲染分钟计价的 `CLOUD_RENDER`）。通行做法是应用只报原始用量，价格表归记账的一方，费用在入库时算一次并存下当时的价格行 [请求文档，引 Langfuse、LiteLLM、OpenRouter、Portkey 的官方文档，我没有逐页核对]。`sessionCostEstimate`、`costUnit` 因此被取代，已从 14.1 删除。

**通用用量接口**（2026-10-11 采纳 `docs/superpowers/plans/2026-10-09-component-decoupling-metering-proposal.md` 第 2.3 节"上报接口的形状"，形象渲染设计 11.1、第 15 节第 2 步把它列为依赖）：原来只收 LLM 用量的 `POST /api/internal/llm-usage` 扩成通用用量接口 `POST /api/internal/usage`。每个产生外部费用或占用算力的组件按次上报原始用量（不报费用），价格和费用归本后端；每条记录带资源类型 `resourceType`，各类型有自己的数量字段：LLM 沿用原有的 `inputTokens`、`cachedInputTokens`、`outputTokens`，其余类型用 `quantity`，单位由类型决定（下表）。价格表按"资源类型 + 模型 + 计量单位"取价，LLM 的按输入长度分档不变。签名、幂等（`recordKey`）、限流、保留期、按天和来源出报表的逻辑对所有资源类型都一样，所以是一个接口而不是每种资源一个。下文没有特别写明的规则对所有类型都适用；只写 LLM 的（档位、缓存 token、价格同步）只适用于 `resourceType=LLM`。

| `resourceType` | 上报方（调用方标识） | `source` | 数量字段 | 计量单位 `unit`（价格表的单位） |
|---|---|---|---|---|
| `LLM` | AvatarAgent（`llm-usage`） | `CALL`、`TEXT` | `inputTokens`、`cachedInputTokens`、`outputTokens`：一条记录是一次 LLM 请求 | `TOKENS_1M`（每百万 token，按输入长度分档，下面的规则） |
| `IMAGE_EDIT` | 形象生成服务（`avatargen-usage`） | `GENERATION` | `quantity`：每次调用图像编辑模型一条，恒为 1；另带 `retry`（布尔，这次调用是不是同一任务的第 2 次及以后的尝试，3.5）。形象生成每次尝试只调用一次图像编辑，所以一个 `AVATAR` 或 `LOOK` 任务最多 `generation.max_attempts` 条 | `CALL` |
| `IMAGE_TO_VIDEO` | 形象生成服务（`avatargen-usage`） | `GENERATION` | `quantity`：每段动作片段一条，值是片段秒数 | `SECOND` |
| `MATTING` | 形象生成服务（`avatargen-usage`） | `GENERATION` | `quantity`：按次，每次一条，恒为 1（自己部署的，用于成本分摊） | `CALL` |
| `DRIVING_PREP` | 形象生成服务（`avatargen-usage`） | `GENERATION` | `quantity`：按次，每次驱动准备一条，恒为 1 | `CALL` |
| `AGE_ESTIMATION` | 形象生成服务（`avatargen-usage`） | `GENERATION` | `quantity`：人脸检测与年龄估计每次推理一条，恒为 1（11.1） | `CALL` |
| `CLOUD_RENDER` | 云端渲染服务（`render-usage`） | `CALL` | `quantity`：每次会话一条，值是渲染分钟数 | `MINUTE` |

形象生成一个任务的用量条数上限：`IMAGE_EDIT` 为 `generation.max_attempts`；`AGE_ESTIMATION` 建形象为 `generation.max_attempts` + 1（原照一次、每次尝试的生成图一次），建外观为 `generation.max_attempts`（不查输入图）；`MATTING`、`DRIVING_PREP` 各为 `generation.max_attempts`。

AvatarEngine 上报的 `provider`、`model` 取值（2026-10-17 定）：

| `resourceType` | `provider` | `model` |
|---|---|---|
| `IMAGE_EDIT` | `dashscope-intl.aliyuncs.com` | 实际调用的模型名，现在是 `qwen-image-3.0`（阿里云 2026-10-10 下线了 `qwen-image-edit` 系列） |
| `IMAGE_TO_VIDEO` | `dashscope-intl.aliyuncs.com` | 实际调用的模型名，现在是 `wan2.2-kf2v-flash`（备选 `wan2.7-i2v`） |
| `MATTING` | `avatarengine` | `modnet` |
| `DRIVING_PREP` | `avatarengine` | `avatar-renderer-v1`（每个渲染器格式一个名字） |
| `AGE_ESTIMATION` | `avatarengine` | `face-analysis-v1`（人脸分析模型（格式 1）） |

`IMAGE_EDIT` 的计数规则（用量记录用于成本统计，所以与实际收费一致；阿里云图像编辑只对成功生成的图收费，失败的调用不收费）：
- 每次返回了结果图片的调用一条；被内容安全拒绝的调用不算（输入侧、输出侧都不算）。
- 服务方已经报告成功、但结果没能取回的调用（例如结果图下载失败），照样算一条：这一次阿里云已经收费。`IMAGE_TO_VIDEO` 同理，任务成功但片段没能取回，照样按秒数记。
- 结果不确定的调用（请求发出后超时、连接断开，无法知道服务方是否执行了）不记用量；AvatarEngine 记一条警告日志（事件名 `provider_outcome_unknown`，带模型名和任务号），对账靠阿里云账单。

资源类型和计量单位的标识符来自形象渲染设计 13.1.3 第 9 条（资源类型）；`source=GENERATION`、`retry`、`quantity` 字段名和三个计量单位的名字是本节新定。每个调用方标识只能报自己那一行的类型，报别的类型整个请求 400 `INVALID_REQUEST`（最小权限，同 1.8）。解耦建议里另有 AvatarMemory 的 LLM 调用、ASR、TTS、embedding 的用量，它们的上报方和字段还没有设计，不在本次补入的范围内。

```
POST /api/internal/usage
Header: X-Key-Id、X-Timestamp、X-Nonce、X-Signature（签名规则 1.8；调用方标识与密钥：`llm-usage` / `LLM_USAGE_SIGNING_SECRET`（AvatarAgent），`avatargen-usage` / `AVATARGEN_USAGE_SIGNING_SECRET`（形象生成服务），`render-usage` / `RENDER_USAGE_SIGNING_SECRET`（云端渲染服务））
```

**请求体：**

```json
{"records":[{"recordKey":"<uuid>","resourceType":"LLM","source":"CALL","sessionId":"...","accountId":"...","guest":false,
             "provider":"...","model":"qwen-plus",
             "inputTokens":1200,"cachedInputTokens":800,"outputTokens":60,
             "at":"2026-10-06T01:02:03.456Z"},
            {"recordKey":"<uuid>","resourceType":"IMAGE_EDIT","source":"GENERATION","accountId":"...","guest":false,
             "provider":"dashscope-intl.aliyuncs.com","model":"qwen-image-3.0","quantity":1,"retry":false,
             "at":"2026-10-11T01:02:03.456Z"}]}
```

| 字段 | 规则 |
|------|------|
| resourceType | 必填，取上面表里的值，且必须是该调用方标识允许的类型，否则 400 |
| records | 1 到 `usage.max_batch`（200）条，否则 400 `INVALID_REQUEST`；一批里可以混合不同的资源类型。**`LLM` 的一条记录是一次 LLM 请求，不是会话汇总**：价格档位按单次请求的输入长度选，汇总成会话总数就丢了 [请求文档]。通话每个会话有若干条，文字对话每轮一条或两条（语音回复时模型只调了工具、没出字，会带着工具结果再请求一次） |
| recordKey | 必填，agent 为每条记录生成的 UUID，全局唯一；重复提交的忽略，所以 agent 重试不会重复入账 |
| source | `CALL`（通话）、`TEXT`（文字对话，5.4）或 `GENERATION`（形象生成，3.5），必须是该资源类型允许的值（上表），否则 400。`CALL` 必须带 `sessionId`；`TEXT` 没有 `sessionId`，且不能是游客（游客没有文字对话，5.4），否则 400；`GENERATION` 没有 `sessionId`、不能是游客，`accountId` 可以为空（系统默认数字人的生成任务没有所属账号，3.10），所以 `GENERATION` 不适用下一行"`guest=false` 时 `accountId` 必须非空"的规则 |
| sessionId | `CALL` 时必须是非空字符串，是会话 ID；`TEXT` 时不带、`null`、`""` 三种都接受，一律按空处理。**不校验归属，也不要求会话存在**：被丢弃的会话产生的用量同样是成本 |
| accountId、guest | `guest` 必填，布尔（缺失或不是布尔 → 400）。`guest=false` 时 `accountId` 必须是非空字符串；`guest=true`（游客通话，4.3）时 `accountId` 必须为空，**空的三种写法都接受**：空字符串 `""`、`null`、不带这个字段，后端一律按空处理（AvatarAgent 发的是 `""`，只认 `null` 会让每个游客批次都 400，而 400 不重试，整批丢失）；游客带了非空的 `accountId` 返回 400。**不校验账号是否存在或状态**，被封禁、正在删除的账号产生的用量同样是成本；但入库时若该账号已不存在或处于 `DELETING`，`accountId` 和 `sessionId` 按空存（账号删除后迟到的重试不能把已删账号的 ID 写回来，13.1） |
| provider、model | 必填，先按 1.9 去掉首尾空白，再检查各 1 到 128 个字符；入库的值和价格表的键都用去掉空白后的值，不是上报的原样（自己部署的模型由上报方自定一个固定的 `provider`） |
| quantity | 除 `LLM` 外必填：不小于 0 的 JSON 数（秒数、分钟数可以有小数），不大于 `usage.max_quantity_per_record`（本节新定，17.5），否则 400；`LLM` 记录不带它，带了忽略 |
| retry | 只有 `IMAGE_EDIT` 有，布尔，缺省 `false`；同一任务的第 2 次及以后的尝试为 `true` |
| inputTokens | 非负整数，**含**缓存命中的部分（OpenAI 格式的 `prompt_tokens` 就是含的）；价格档位按它选 |
| cachedInputTokens | 非负整数，其中命中缓存的部分，不能大于 `inputTokens`，否则 400。未缓存输入 = `inputTokens − cachedInputTokens`，写明这一点是因为否则缓存 token 会被算两遍 [请求文档，引 Langfuse 的警告] |
| outputTokens | 非负整数；思考模式的输出 token 已包含在内。agent 现在不用思考模式，需要时再加字段和价格行 [请求文档] |
| 三个 token 字段 | 只有 `LLM` 有，`LLM` 记录里都必填，必须是 JSON 整数（不接受小数、字符串、`null`），范围 0 到 `usage.max_tokens_per_record`（10000000，提议），超出或类型不对 → 400；请求里不认识的字段忽略 |
| at | 必填，这次请求发生的时间（UTC，ISO-8601，无法解析 → 400）；晚于服务器当前时间 5 分钟以上、或早于收到时间 7 天以上的，按收到时间处理 |

**响应：** `{"code":"200","message":"success","data":{"accepted":12,"skipped":1}}`，`skipped` 是重复的。**任何一条记录不合法，整个请求 400，不入库任何一条**，`data` 带第一条不合法记录在 `records` 里的下标 `{"index":3}`（从 0 起）；这说明 agent 的记录有 bug，不要原样重试同一批，要修正（建议 agent 发送前自己校验上面的规则）。**限流**：每个调用方标识每分钟最多 `usage.rate_limit_per_min`（600）次请求，超出 429 `RATE_LIMITED`（1.6），响应带 `Retry-After` 头，值是整数秒（RFC 9110 的 delay-seconds 形式，不用时间点），等于当前一分钟限流窗口还剩的秒数，至少 1；`data` 里同样带 `{"retryAfterSeconds":N}`（和 OTP、登录限速的 429 同一做法）。调用方应按它等待再重发，不要用固定的短间隔重试：限流窗口是一分钟；同一调用方标识下的所有 agent 进程和聊天服务共用这一个计数，所以建议调用方把几条记录合成一批发（一次最多 200 条）。游客通话**上报**：用量数字不是对话内容，不违反 4.3 的"游客不存对话"，而游客试用的成本正是运营要盯的（15.6 已经有免费通话总量告警）[请求文档的建议，采纳]。

**存储。** MongoDB 集合 `usage_log`（18），每条自带过期时间 `expireAt = receivedAt + usage.retention_days`（90），做法同 `event_log`（7.2）；每条记录带 `resourceType`，非 LLM 的记录另存 `quantity`、`unit`（由类型决定，上表）和 `retry`。索引 `(at)`、`(resourceType, provider, model, at)`、`(accountId, at)`（账号删除置空和数据导出都按账号查）。每收到一条记录，`UsageModel`（18）里该 `(resourceType, provider, model)` 没有行就新建，有就更新 `lastSeenAt`（同一请求内按模型合并，只写一次）。入库时在每条上写 `tier`：`guest=true` 为 `GUEST`；`CALL` 取该 `Session.freeTier`（`FREE`/`PAID`）；`TEXT` 和 `GENERATION` 取入库时该账号有没有有效权益（`AccountEntitlement`，没有为 `FREE`，有为 `PAID`）；`GENERATION` 而 `accountId` 为空（系统任务）为 `SYSTEM`；解析不到（会话已被丢弃、账号已删除）为 `UNKNOWN`。文字对话这一项是近似的 [推断]。账号删除时（13.1 步骤表第 5 步）去掉该账号记录里的 `accountId` 和 `sessionId`，用量和费用保留用于成本统计；数据导出（13.3）带上该账号的用量记录（资源类型、来源、模型、三种 token 数或数量与单位、时间），不含费用和价格。

**数值类型。** `costAmount`、价格和汇总里的费用都用十进制类型（MongoDB `Decimal128`，PostgreSQL `numeric`，价格 `numeric(20,10)`，汇总费用 `numeric(24,10)`），不用浮点；单次请求的费用很小（例如 15 个输入 token × 0.4 ÷ 1e6 = 6e-6），费用在十进制下计算，保留 10 位小数，舍入方式 `RoundingMode.HALF_UP`，对一条记录的总费用舍入一次（不是三个分量各舍入一次）。后台界面显示最多 6 位小数。

**价格表。** `UsagePrice`（18）：按"资源类型 + 模型 + 计量单位"取价，键是 `(resourceType, provider, model, unit)`。`LLM` 的每行是一个模型、一个生效日期、一个输入长度档位的价格，单位是每百万 token（`unit=TOKENS_1M`）；其余资源类型一个批次只有一行，即只有一档（`inputMinTokens=0`、`inputMaxTokens` 为空），价格是 `unitPrice`（每个计量单位的价格，`unit` 由类型决定，`numeric(20,10)`），三个 token 价格为空；下面"档位的边界"里多档的规则只适用于 `LLM`。`currency` 由行自带，因为阿里的价格接口没有币种字段 [请求文档]。同一模型同一生效日期的各档位行共用一个 `batchId`。**价格行只追加不修改**。状态：`PENDING_REVIEW`（待审，只能由同步生成）、`ACTIVE`（生效）、`REJECTED`（运营驳回，写 `reviewNote`、`reviewedBy`、`reviewedAt`）、`SUPERSEDED`（被取代：待审批次被同一模型更新的待审批次取代，或价格同步发现价格已恢复到最新 `ACTIVE` 批次时待审批次被置此状态（见下面的比较规则），或 `ACTIVE` 批次被同一模型、同一生效日期的新 `ACTIVE` 批次取代）、`RETIRED`（运营撤回一个填错或已停用的 `ACTIVE` 批次，备注必填）。手动编辑等于新建一批；与已有 `ACTIVE` 批次同模型同生效日期时，新批生效、旧批置 `SUPERSEDED`，所以同一 `(provider, model, effectiveFrom)` 最多一个 `ACTIVE` 批次。被记录引用的行不删除。**已入库记录的费用不改**：撤回或取代一批价格，只影响之后入库的记录和费用为空的补算，不订正历史费用，订正历史费用不在本版范围。**币种**：只存 USD，不做换算（业界没有哪个产品做换算 [请求文档，未逐一核对]）；`currency` 必须在配置 `usage_price.allowed_currencies`（默认 `["USD"]`）里，否则 400；同步生成的行币种取 `usage_price.default_currency`（USD），运营确认时必须核对；报表按币种分组，不跨币种相加。

**档位的边界。** 输入长度档位用整数、两端都包含：第一档 `inputMinTokens` 必须是 0，下一档的下限必须等于上一档的上限加 1，最后一档的上限为空（不限），所以档位既不重叠也没有缺口，任何输入长度都落在恰好一档里。手填（`POST /usage/prices`）和确认同步生成的批次（`confirm`）时都要校验，不满足返回 400 `INVALID_REQUEST`。

**批次的状态转换与校验。** `confirm` 和 `reject` 要求批次是 `PENDING_REVIEW`，`retire` 要求是 `ACTIVE`，否则 409 `INVALID_STATE`（`data.status` 是当前状态）；`batchId` 不存在 404 `RESOURCE_NOT_FOUND`。转换用条件更新（`WHERE status=<要求的状态>`），并发的两个确认只有一个成功。确认或手填一批 `ACTIVE` 时，同一 `(resourceType, provider, model, unit, effectiveFrom)` 的旧 `ACTIVE` 批次置 `SUPERSEDED`，两步在同一个事务里，并有部分唯一索引 `(resourceType, provider, model, unit, effectiveFrom) WHERE status='ACTIVE' AND inputMinTokens=0` 兜底（每个批次第一档的下限必须是 0，所以它就是“一个批次”的唯一键；每档一行，不能把档位下限之外的列放进这个索引）。手填的校验：`provider`、`model` 去掉首尾空白后 1 到 128 个字符；`currency` 在 `usage_price.allowed_currencies` 里；`effectiveFrom` 是有效日期（过去和将来都可以）；至少一个档位，不超过 `usage_price.max_bands`（20，提议）个；三个价格是不小于 0 的十进制数，最多 10 位小数，不大于 1000000；`cachedInputPrice` 可空。非 LLM 的批次：`resourceType`、`unit` 必须是上表里的一对，只有一档，只填 `unitPrice`（规则同上面的价格）。`reject`、`retire` 的 `note` 去掉首尾空白后 1 到 500 个字符。

**`UsageModel`。** 已见过的模型登记，键是 `(resourceType, provider, model)`：`syncAdapter` 为空表示只能手填价格（非 LLM 的模型都是手填，`syncAdapter` 只能对 `resourceType=LLM` 的模型设置），非空表示同步任务可以读它的价格，取值目前只有 `DASHSCOPE_INTL`（`PUT /usage/models/{id}` 校验，其他值 400）；`syncModelId` 是向价格接口查询时用的模型名，默认等于 `model`，不一致时运营在后台改。AvatarAgent 在真实调用里读到的取值（livekit 的 LLM 对象，DashScope 国际站，档位 standard；2026-10-06，AvatarAgent 会话核实）：`provider` = `dashscope-intl.aliyuncs.com`（`base_url` 的主机名），`model` = `qwen-plus`；价格表的键就是这一对。`syncAdapter` 仍由运营在后台设置（给这个模型设 `DASHSCOPE_INTL`），不由后端按 `provider` 的名字猜。

**费用计算（入库时算一次）。** 非 LLM 的记录：在 `(resourceType, provider, model, unit)` 的 `ACTIVE` 批次里按下面同样的规则取批次，`费用 = quantity × unitPrice`。LLM 的记录：在 `(resourceType=LLM, provider, model, unit=TOKENS_1M)` 的 `ACTIVE` 批次里取 `effectiveFrom` 不晚于 `at` 的 UTC 日期的批次，其中 `effectiveFrom` 最晚的一批（同一 `effectiveFrom` 最多一个 `ACTIVE` 批次，不会并列）；在这批里取 `inputMinTokens ≤ inputTokens ≤ inputMaxTokens`（上限空为不限）的那一档；`费用 = (inputTokens − cachedInputTokens) × inputPrice + cachedInputTokens × cachedInputPrice(空则取 inputPrice) + outputTokens × outputPrice`，价格按每百万 token 折算。把 `costAmount`、`costCurrency` 和用到的行的 `id`（`priceId`）写进这条记录；之后调价不改已算的记录 [请求文档]。找不到价格就是"没有价格"。

**没有价格的模型。** 记录照存，`costAmount` 为空；写一条 `USAGE_PRICE_MISSING` 告警（17.4，同一模型只写一条；自己部署、没有外部费用的模型，运营也要填一个价格（可以是 0 或分摊的算力成本），否则告警不会关闭）。之后某批价格变成可选（确认、手填，且 `effectiveFrom` 不晚于今天）时，后台任务补算该模型 `costAmount` 为空、`at` 不早于这批 `effectiveFrom` 的记录，**不改已有费用**，补算后对受影响的日期重新落地 `usage-cost`（17.6）。**补算的触发**：价格批次变成可选的那一刻（`confirm`，或 `POST /usage/prices` 且 `effectiveFrom` 不晚于今天）为该模型入队一个补算任务；另外每天 UTC 00:10 对每个仍有 `OPEN` 的 `USAGE_PRICE_MISSING` 告警的模型再补算一次（覆盖“生效日在将来、现在到了”的批次）；补算按 `at` 升序分批（每批 1000 条）处理，可中断续跑，多实例靠数据库锁互斥。早于这个 `effectiveFrom` 的无价格记录一直是无价格，所以运营确认时可以把 `effectiveFrom` 改到更早的日期来覆盖它们；将来日期的批次不会关闭告警。（LiteLLM 有"零成本请求"的警告，Portkey 把没价格的算成 0，后者会悄悄少算 [请求文档]，所以这里留空并告警。）

**价格同步。** 每天 `usage_price.sync_hour_utc`（2）点一个任务（`usage_price.sync_enabled` 为真，多实例用数据库锁，1.1），对 `syncAdapter` 非空的每个 `UsageModel` 调适配器读价格；没有任何模型配了适配器时任务什么都不做，也不检查密钥。当前唯一的适配器是阿里云 DashScope 国际站：`GET {usage_price.source_url}?service_site=international`，分页，`model=<syncModelId>` 过滤，`Authorization: Bearer <DASHSCOPE_PRICE_API_KEY>` [请求文档，对方真实调用返回 200，列出 270 个模型]。`usage_price.source_url` 必须是 https 且主机在适配器声明的白名单内（`dashscope-intl.aliyuncs.com`），否则保存时 400，防止把密钥发到别处。接口按**单次请求的输入总长**分档，每个条目有 `type`、`price`、`price_unit`、`price_name`、`time_band`，档位名在 `range_name`，单位是 `Per 1M tokens`，还有思考输出价、隐式缓存命中价（输入价的 20%）和批量价 [请求文档]。适配器只认单位为每百万 token 的标准价，整理成档位行（输入价、缓存输入价、输出价）；`range_name` 里的 K 按 1000 解析 [推断，未核对阿里文档，运营确认时核对边界]；思考输出价、批量价、限时分档这一版不用，原样存进 `rawSnapshot`。

**同步的比较规则。** 对每个模型，取接口返回整理成的价格内容（档位边界加三个价格），与下面三者比较：该模型最新的 `PENDING_REVIEW` 批次、`ACTIVE` 批次里 `effectiveFrom` 最晚的一个（含生效日在将来的批次）、该模型最近一次被驳回的批次（只比它之后没有新 `ACTIVE` 批次的）。内容与最新的待审批次相同：什么都不做；内容与最新 `ACTIVE` 批次相同、而存在待审批次：价格已经恢复，该待审批次置 `SUPERSEDED`；内容与最近驳回的相同：不重新生成（此时若存在内容不同的待审批次，把它置 `SUPERSEDED`）（避免每天重复提议已被驳回的价格）；其余情况生成一批新的 `PENDING_REVIEW`（`source=SYNC`，提议的 `effectiveFrom` 为检测当天，币种取默认币种），已有待审批次的置 `SUPERSEDED`。**不自动生效**：价格页只列标准价，限时折扣在控制台，快照别名也和价格页不一致 [请求文档]；运营在后台确认（可以改生效日期和币种）后才生效。OpenAI、Anthropic 没有价格接口，LiteLLM 的价格文件对 `qwen-plus` 是过期的（没有分档和缓存价）[请求文档]，所以手填入口是必需的。同步失败（接口报错、没有配置 `DASHSCOPE_PRICE_API_KEY`）写一条 `LLM_PRICE_SYNC_FAILED` 告警（`refType=LLM_PRICE_SYNC`、`refId=ALL`，同一时间只有一条 `OPEN`），下一次成功后自动 `RESOLVED`。

**后台接口**（17.4 "成本"，写操作都写审计日志）：
- `GET /usage/prices?resourceType=&provider=&model=&unit=&status=`：价格行，按模型和批次分组；`GET /usage/price-batches/pending`：待审批次，每批带当前生效批次的对比。权限 `COST:VIEW`。
- `POST /usage/prices {resourceType, provider, model, unit, effectiveFrom, currency, bands:[{inputMinTokens, inputMaxTokens, inputPrice, cachedInputPrice, outputPrice}] 或 unitPrice}`（`LLM` 填 `bands`，其余类型填 `unitPrice`）：手填，创建一批 `ACTIVE`、`source=MANUAL` 的行；`effectiveFrom` 可以是将来或过去的日期（过去的日期会触发上面的补算）；档位不满足边界规则返回 400。`POST /usage/price-batches/{batchId}/confirm {effectiveFrom?, currency?}`：待审批次置 `ACTIVE`；`POST /usage/price-batches/{batchId}/reject {note}`：驳回，备注必填；`POST /usage/price-batches/{batchId}/retire {note}`：撤回一个 `ACTIVE` 批次，备注必填。权限 `COST:PRICE`。
- `GET /usage/models`（含"有没有生效价格"、首次和最近出现时间，`COST:VIEW`）；`PUT /usage/models/{id} {syncAdapter, syncModelId}`（`COST:PRICE`）。

**汇总表。** `StatUsageCostDaily`（17.6）：按 UTC 日（取 `at` 的 UTC 日）、`resourceType`、`provider`、`model`、`unit`、`source`、`tier`、`currency` 汇总请求数（记录条数）、三种 token 数（`LLM`）、`quantity` 之和（其余类型）、费用、没有价格的请求数；费用为空的记录归在 `currency=NONE` 的行下（只有请求数和 token 数，费用为空），报表的币种筛选里也有这一项。来源是 `usage_log`，由现有落地任务按窗口重算，补算费用后对受影响的日期重新落地；早于原始记录保留期的日期不重算，保留已落地的值（17.6"保留"一行）。

**配置项**（17.5）：`usage.max_batch`、`usage.max_tokens_per_record`、`usage.max_quantity_per_record`、`usage_price.max_bands`、`usage.rate_limit_per_min`、`usage.retention_days`、`usage_price.sync_enabled`、`usage_price.sync_hour_utc`、`usage_price.default_currency`、`usage_price.allowed_currencies`、`usage_price.source_url`；环境变量 `LLM_USAGE_SIGNING_SECRET`、`AVATARGEN_USAGE_SIGNING_SECRET`、`RENDER_USAGE_SIGNING_SECRET`、`DASHSCOPE_PRICE_API_KEY`（1.5）。数值都是提议，没有来源。

**费用是下限，不是精确值。** 用户打断数字人时 LLM 请求被取消，最后一块用量可能没到，agent 拿不到这次请求的 token 数，而输入 token 厂商仍会计费；token 数为 0 的请求 agent 不报。所以后端算出的 LLM 费用是下限，要对到分只能事后核对阿里云账单 [AvatarAgent 会话，2026-10-06]。后台的成本报表要写明这一点（后台设计 5.23）。

**不做**：不做币种换算；不把 GPU 成本归到会话（算不出）；不自动生效价格；不订正历史费用；agent 不放价格 [请求文档]。

---

## 十五、订阅与权益（自建）

游客没有账号（2.1），本节所有需要用户登录的接口（含 `GET /api/subscription-products`、`GET /api/entitlements`；商店服务端通知的接收端点不带用户凭据，不受此限）对游客凭据一律返回 403 `REGISTRATION_REQUIRED`；客户端在购买前先引导用户注册或登录。订阅和额度只绑定到注册账号。

**决定：自建**，后端直接对接 Apple 和 Google 的官方服务端接口，不使用 RevenueCat 等第三方订阅服务，原因是后者对超过一定流水的部分永久抽 1%（主设计文档 §22）。做之前请让做过支付渠道对接的同事复核本节。

**哪些功能收费不由本文档决定，也不写死在代码里**：代码只声明"哪些功能可以被权益控制"（15.3 的功能开关），每个权益给这些功能什么值，由运营在管理后台配置（第十七节）。本节的机制在没有任何配置时不限制任何功能（通话额度和文字额度除外：没有任何有效权益的账号，适用的通话额度键都没有配置时不能通话、适用的文字额度键都没有配置时不能发文字，防止上线时忘了配置而让免费用户无限使用，15.6、5.4）。

### 15.1 依据

下表是本节设计依据的官方原文（2026-09-30 读过），凡本节写到的商店行为都能在其中找到。

| 内容 | 来源 |
|------|------|
| Apple 通知类型与子类型（`SUBSCRIBED`、`DID_RENEW`、`DID_FAIL_TO_RENEW`、`GRACE_PERIOD_EXPIRED`、`EXPIRED`、`REFUND`、`REVOKE`、`DID_CHANGE_RENEWAL_STATUS`、`DID_CHANGE_RENEWAL_PREF` 等） | developer.apple.com/documentation/appstoreservernotifications/notificationtype 和 `subtype` |
| Apple 通知负载里的 `notificationUUID`（"用它识别重复通知"） | `responsebodyv2decodedpayload` |
| Apple 交易里的 `appAccountToken`（购买时由你生成的 UUID，用来把交易关联到你自己服务里的用户；不提供则该字段省略）、`environment`、`currency` | `jwstransactiondecodedpayload` |
| Google 通知类型（`SUBSCRIPTION_PURCHASED`、`RENEWED`、`RECOVERED`、`CANCELED`、`ON_HOLD`、`IN_GRACE_PERIOD`、`REVOKED`、`EXPIRED` 等，通知只带类型和 `purchaseToken`） | developer.android.com/google/play/billing/rtdn-reference |
| Google 要求收到通知后调 `purchases.subscriptionsv2.get`，并称它是订阅状态的 source of truth | developer.android.com/google/play/billing/lifecycle/subscriptions |
| Google `subscriptionState`：`PENDING`、`ACTIVE`、`PAUSED`、`IN_GRACE_PERIOD`、`ON_HOLD`、`CANCELED`（已取消但未到期）、`EXPIRED`、`PENDING_PURCHASE_CANCELED`；订阅资源里有 `externalAccountIdentifiers.obfuscatedExternalAccountId`、`acknowledgementState`、`testPurchase`、`linkedPurchaseToken`、`recurringPrice` | developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2 |
| Google 购买流程：客户端购买 → 服务器验证 → 发放内容 → 确认；**3 天内不确认会被自动退款并撤销权益**；宽限期内用户仍应保有权益 | developer.android.com/google/play/billing/integrate、`lifecycle/subscriptions` |

### 15.2 账号如何和商店订阅关联

商店通知里没有我们的账号，靠购买时客户端埋进去的标识来关联：

- **Apple**：购买时客户端把 `appAccountToken` 设为账号 ID（账号 ID 是 UUID，见第十八节）。交易和通知里都带回它。
- **Google**：购买时客户端在 `BillingFlowParams` 里设置 obfuscated account ID 为账号 ID。后端从 `subscriptionsv2.get` 返回的 `externalAccountIdentifiers.obfuscatedExternalAccountId` 读出。账号 ID 是随机 UUID，本身不含个人信息 [推断]；该字段的长度和字符限制我没核实，见第十九节。
- **订阅商品不开启 Apple 家庭共享。** 家庭成员也会收到 `SUBSCRIBED`、`REVOKE` 通知，但成员的交易是否带购买者的 `appAccountToken`，我在 Apple 文档里确认不了，所以不让这种情况出现。

**绑定规则（`verify` 和收到通知时都按这个顺序判断）：**

1. 该 `(store, storeRef)` 已有 `Subscription` 且 `accountId` 已设置：与当前账号一致才放行；否则 409 `SUBSCRIPTION_OWNED_BY_OTHER`（该账号处于 `PENDING_DELETION` 或 `DELETING` 时也一样，等删除完成、订阅行被清除后才可重新绑定）。
2. 否则看购买时埋的标识：
   - 存在且等于当前账号：绑定。
   - 存在且指向另一个**仍然存在**的账号：409 `SUBSCRIPTION_OWNED_BY_OTHER`，不自动转移（管理员可在后台处理）。
   - 存在但指向的账号**已不存在**（用户删除了账号，商店订阅仍在扣款，之后重新注册并恢复购买）：允许绑定到当前账号。否则用户会一直付费却永远拿不回权益。
   - 不存在（用户在旧版本或 App 外购买）：绑定到当前账号，依据是持有购买凭证。
3. 订阅只绑定到注册账号：游客凭据调用 `verify` 和任何购买、恢复购买接口都返回 403 `REGISTRATION_REQUIRED`，所以不存在"游客期间买的订阅"。

**Google 换档、重新订阅会产生新的 `purchaseToken`**（Google 文档 `lifecycle/subscriptions`：升级、降级、取消后重新订阅时，旧订阅作废，新建一个带新令牌的订阅），收到新令牌时按下面的顺序找账号：

1. 新订阅自己的 `obfuscatedExternalAccountId`；
2. `linkedPurchaseToken`（指向被替换的旧订阅，取旧订阅所属账号）；
3. 用户在 Play 商店的订阅中心里重新订阅时，通知是 `SUBSCRIPTION_PURCHASED` 且**没有** `linkedPurchaseToken`，此时 `subscriptionsv2.get` 返回的 `outOfAppPurchaseContext` 里有 `expiredExternalAccountIdentifiers` 和 `expiredPurchaseToken`（仅出现在未确认的重新订阅上），用其中任一个查到账号。

找到账号后，旧订阅经 `get` 刷新为 `EXPIRED`。**不强制“同一账号在同一商店同一时刻只有一条非终态订阅”**：换档的旧订阅要等新订阅 `get` 之后才变成终态，其间两条并存；用户也可能在 Play 里同时持有两个订阅商品。权益取最高档，不叠加（15.3），`GET /api/entitlements` 的 `subscriptions` 列出全部未终结的订阅。全部找不到时 `accountId` 留空，订阅仍按商店的真实状态保存，等客户端 `verify` 时绑定。

### 15.3 概念与数据模型

| 实体 | 关键字段 | 说明 |
|------|---------|------|
| `SubscriptionProduct` | store(渠道标识，目前 `APPLE`/`GOOGLE`，可扩展，15.10), productId, entitlementKey, enabled, sortOrder, surfaces(格式同 3.7，空数组表示所有端；客户端列表按它过滤，15.5) | 商品和价格在商店后台配置，后端只存"商品 → 权益"的映射和是否在售，**不自建价格表**。`enabled=false` 的商品不出现在客户端的商品列表里。**每个 Google 订阅商品只配置一个基础方案（base plan）**：月付、年付用不同的订阅商品（不同的 `productId`），不要放在同一个订阅商品的多个基础方案里——本后端和客户端都以 `productId` 识别订阅，客户端在同一订阅内换基础方案的规则与跨订阅换档不同（Play 订阅文档） |
| `EntitlementDef` | key, name, priority | 权益定义，如 `premium`，由运营在后台创建。`priority` 用于多个权益冲突时决定取谁的值（`priority` 唯一，保存时校验，重复 409 `DUPLICATE_RESOURCE`） |
| `FeatureGate` | key, kind(`BOOLEAN`/`LIMIT`/`STRING`), limitScope(仅 `LIMIT`：`PERMANENT`/`PERIODIC`/`LIFETIME`), defaultValue, creditCost(可空，仅 `PERMANENT` 的 `LIMIT`), description | **由代码声明**的功能开关，加一个受控功能就是加一条。`creditCost` 是用额度（15.9）购买该上限的一个单位所需的额度数，为空表示不能用额度购买。见下表 |
| `EntitlementFeature` | entitlementKey, featureKey, value | 某个权益给某个功能开关的值，运营在后台配置。`LIMIT` 类的"不限"用哨兵值 `"UNLIMITED"` 存储（API 里返回 `null`）；**没有这一行**表示该权益没有配置这个开关，回退到默认值，这与"不限"是两回事 |
| `Subscription` | id, accountId(可空), store(渠道标识，15.10), storeRef(渠道自己的订阅标识：Apple 的 `originalTransactionId`、Google 的 `purchaseToken`), linkedPurchaseToken(可空), productId, state, currentPeriodStart, currentPeriodEnd, gracePeriodEndsAt(可空), autoRenew, environment(`PRODUCTION`/`SANDBOX`), acknowledgementState(仅 Google), purchasedAt, firstActiveAt(可空), voidedAt(可空), lastEventSignedAt(可空), lastSyncedAt, createdAt, updatedAt | `(store, storeRef)` 唯一。`currentPeriodEnd`：Apple 取交易的 `expiresDate`，Google 取 `lineItems[].expiryTime`（多项时取最大）；`gracePeriodEndsAt`：Apple 取续订信息的 `gracePeriodExpiresDate`，Google 在宽限期内取被延长的 `expiryTime`；`currentPeriodStart`：首个周期取 `purchasedAt`，之后每次周期推进（续订、Apple 升级开始新计费周期、Google 换档产生的新订阅）时取推进前的 `currentPeriodEnd`，不依赖各商店是否提供当前周期的起点；`firstActiveAt` 记首次进入 `ACTIVE` 的时间（用于只记一次 `subscription_started`）；`lastEventSignedAt` 用于 Apple 通知排序（15.4） |
| `SubscriptionEvent` | id, subscriptionId(可空), accountId(可空，事件能关联到账号时记下，账号删除时据此清除，13.1), store, sourceEventId, type(两个商店都存符号枚举名：Apple 的 `notificationType`，Google 整数 `notificationType` 对应的枚举名，如 `SUBSCRIPTION_RENEWED`), subtype, payload, eventSignedAt(商店给出的事件时间：Apple 的 `signedDate`，Google 的 `eventTimeMillis`), receivedAt, processedAt, error, needsAttention(布尔，默认 false；`pendingRefundReviewNotification` 置真，15.4；人工处理后由 `POST /subscription-events/{id}/ack` 置假，17.4) | 不可变的事件日志。`payload` 存商店通知解码后的内容，**入库前对解码后的整个 JSON 递归删除 `appAccountToken`、`obfuscatedExternalAccountId` 两个账号标识键（含嵌套的 `signedTransactionInfo`、`signedRenewalInfo` 解码结果）**（账号标识已记在 `accountId` 列），这样删除账号后事件里没有残留的账号标识。`(store, sourceEventId)` 唯一：Apple 用 `notificationUUID`，Google 用 `(purchaseToken, eventTimeMillis, notificationType)` 的组合 |
| `AccountEntitlement` | id, accountId, entitlementKey, source(`STORE`/`PROMO`), subscriptionId(可空), startsAt, expiresAt(可空), grantedBy(可空), reason(可空), revokedAt(可空), expiryHandledAt(可空) | 账号当前的权益。`PROMO` 是管理员发放的限时权益，不影响商店里的订阅。`expiryHandledAt`(可空)：仅 `PROMO` 使用，权益到期后已触发档位同步的时间，到期扫描据此只处理一次（15.7） |

**代码声明的功能开关**（初始十五条，都对应本文档里已经存在的能力，其中后五条来自形象渲染设计 11.2；开关的默认值是"不限制"，没有配置时什么都不受控；通话额度的三个键、文字额度的两个键，以及 `avatar.looks_max`（默认 5）、`credits.period_grant`（默认 0）是例外，见下表）：

| key | kind | 默认值 | 作用点 |
|-----|------|--------|--------|
| `memory.tier` | `STRING` | `default` | 账号在 AvatarMemory 里的档位名（15.6） |
| `assets.avatar_max` | `LIMIT`（`PERMANENT`） | 不限（`null`） | 资产库里形象的数量上限（上传时校验，3.2） |
| `assets.voice_max` | `LIMIT`（`PERMANENT`） | 不限（`null`） | 资产库里声音的数量上限 |
| `call.daily_minutes` | `LIMIT`（`PERIODIC`） | **未配置**（不是"不限"） | 每个账号本地日（`User.timezone`，没有时区按 UTC）可用的通话分钟数，免费和订阅用户都适用，窗口见 15.6。通话额度的键有三种状态：数字、`UNLIMITED`（明确不限）、未配置。**未配置的键不限制通话；但没有任何有效权益的账号（免费账号），适用的键（`call.daily_minutes`、`call.monthly_minutes`、`call.lifetime_minutes`）都没有配置时不能通话**；有有效权益的账号不受这条兜底约束（他们付了费，只受硬上限 `session.max_duration_minutes` 约束），后台保存权益或商品映射时提醒运营这个权益没有配置通话额度（管理后台设计）：运营只配一个键就够，又不会因为忘了配置而无限通话。业界免费额度多数是小时或天级的短窗口（Claude、ChatGPT 免费版是 5 小时窗口，Character.AI 免费版每天 5 次通话，来源是搜索摘要里的二手资料），一天一个窗口让用户每天都有一次"额度用完、去付费"的触点 |
| `call.monthly_minutes` | `LIMIT`（`PERIODIC`） | **未配置**（不是"不限"） | 每个用量周期可用的通话分钟数：订阅用户按订阅计费周期，其余按 UTC 日历月（15.6）；状态规则同 `call.daily_minutes`，有生效值的键都要有剩余。给免费用户配一个月额度可以限制单个账号一个月的总成本（日额度乘以 30 天的上限）；通话是成本驱动项 |
| `call.lifetime_minutes` | `LIMIT`（`LIFETIME`） | **未配置**（不是"不限"） | 终身总通话分钟数，**只约束没有任何有效权益的账号**（免费账号）：用完不重置，之后只能订阅或购买。**发放类**：账号创建时把当时的数值记进 `User.lifetimeGrantSeconds`，之后改配置只影响之后创建的账号（17.5 的发放规则）；创建时没配置的账号，配置之后在第一次发起会话时记入当时的值。已用量记在 `User.lifetimeUsedSeconds`，只累计账号没有有效权益时开始的会话（`Session.freeTier`）。状态规则同 `call.daily_minutes`。可以和日额度、月额度任意组合，运营在后台配置选择：只用终身额度（用完只能订阅）、只用日额度（每天重置）、或组合（例如终身 30 分钟加每天 5 分钟）。Replika 的免费版不含语音通话，我们的免费通话额度是产品的体验钩子，终身额度让每个新账号只能领一次，对反复刷额度的收益最低；删除账号后重新注册，由防滥用标记恢复删除前的发放值和已用量（13.5），不会重新领；换邮箱新建账号时设备标识命中同一条标记，结果一样；设备校验和运营的人工处理是补充，不靠这个键本身（Replika 免费版不含通话来自搜索摘要里的二手资料） |
| `chat.daily_messages` | `LIMIT`（`PERIODIC`） | **未配置**（不是"不限"） | 每个账号本地日（`User.timezone`，没有时区按 UTC）可以发的文字对话消息条数（5.4），窗口和计数见 15.6。状态规则和通话额度键完全一致：数字、`UNLIMITED`、未配置；**未配置的键不限制；但没有任何有效权益的账号，适用的键（`chat.daily_messages`、`chat.monthly_messages`）都没有配置时不能发文字**，有有效权益的账号不受这条兜底约束 |
| `chat.monthly_messages` | `LIMIT`（`PERIODIC`） | **未配置**（不是"不限"） | 每个用量周期可以发的文字对话消息条数：订阅用户按订阅计费周期，其余按 UTC 日历月（15.6）；状态规则同 `chat.daily_messages`，有生效值的键都要有剩余 |
| `chat.model_tier` | `STRING` | `standard` | 数字人使用的模型档位名，写入 dispatch metadata 的 `modelTier`（4.1）；档位名是与 AvatarAgent 的跨项目约定 |
| `ads.removed` | `BOOLEAN` | `false` | 账号是否去掉应用内广告；订阅权益配成 `true` 实现"去广告"，作用点是 22.4 第 2 步。**极性是"去掉"而不是"展示"**：`BOOLEAN` 跨权益取或（最慷慨的权益生效），"展示广告"为真的权益会把另一个权益的去广告盖掉；"去掉广告"为真取或，任何一个权益给了去广告就生效。默认值 `false` 也符合上面"默认是不限制"。这个键名也避开了与 `AppConfig` 总开关 `ads.enabled`（17.5）重名 |
| `avatar.looks_max` | `LIMIT`（`PERMANENT`），`creditCost` 恒为空 | 5（推断：按每个外观的生成费用估计，运营调整） | **每个形象**的外观数上限（建外观时校验，3.6）。生效值对账号下的每个形象分别适用，与按账号计、可以用额度买额外单位的 `LIMIT` 不同：不能用额度买额外单位，不加 `AccountFeatureBonus`；0 表示只能有建形象时的第一个外观 |
| `avatar.look_free` | `BOOLEAN` | `false` | 为 true 的账号新建外观不收额度（`avatar.look_credit_price`，3.6），例如订阅用户 |
| `credits.period_grant` | `LIMIT`（`PERIODIC`），`creditCost` 恒为空 | 0 | 订阅每个计费周期赠送的额度数（15.9 的 `SUBSCRIPTION_GRANT`）。它是数量不是上限：保存时额外校验，不接受 `UNLIMITED`；0 表示不送；每期怎么发（首次、续订、升级降级、两个商店订阅同时存在）见 15.9 |
| `render.cloud` | `BOOLEAN` | `false` | 账号能否用云端渲染档（4.1 的 `renderMode=CLOUD`），还要同时满足部署配置 `render.cloud_enabled`（17.5）：部署配置是"这套部署有没有这个能力"，功能开关是"这个账号能不能用" |
| `chat.voice_reply` | `BOOLEAN` | `false` | 文字对话能否选语音回复（5.4 的 `voiceReply`）；可能只给订阅用户 |

**`creditCost` 默认为空**：没有配置的开关不能用额度购买。价格属于运营决定，代码里不带默认值；运营在管理后台给某个开关设置了 `creditCost` 之后，用户才能用额度购买它的额外单位（`PUT /feature-gates/{key}/credit-cost`，17.4）。

**功能值的取值范围**（管理后台保存权益的功能值、功能开关默认值时校验，不合格 400 `INVALID_REQUEST`）：`BOOLEAN` 取 `true` 或 `false`；`LIMIT` 取整数 0 到 `entitlement.limit_max`（1000000，提议），或哨兵 `UNLIMITED`；**`0` 是合法值，意思是“不允许”**（形象或声音数量上限为 0 表示不能新建；`avatar.looks_max` 为 0 表示只能有建形象时的第一个外观；通话或文字额度为 0 表示这个窗口内一分钟、一条都没有），它既不是“未配置”也不是“不限”；`avatar.looks_max` 同样允许 `UNLIMITED`；`credits.period_grant` 另加校验：不接受 `UNLIMITED`，0 表示不送；`STRING` 类按各自的规则校验（`memory.tier` 见 16.2，`chat.model_tier` 见 15.6）。额度购买 `spend` 的 `quantity` 是 1 到 `credits.spend_max_quantity`（100，提议）的整数，`featureKey` 不存在、或不可用额度购买，都是 400 `INVALID_REQUEST`（15.9）。

**账号某个功能开关的生效值**：取该账号所有当前有效的 `AccountEntitlement` 对应的 `EntitlementFeature` 值；`BOOLEAN` 取或；`LIMIT` 取最大（不限最大），**取最大时把默认值也算进去**（即 `max(默认值, 各权益的值)`），这样一个权益配得比免费默认值还低，也不会让用户的上限比免费用户更低；`STRING` 取 `priority` 最高的权益的值，只在**配置了这个开关的权益**之间比较；没有任何有效权益或该权益没配这个开关时，取 `FeatureGate.defaultValue`（管理后台可改默认值，这就是"免费用户的限制"）。通话额度的键多一个"未配置"状态：默认值和所有有效权益都没有配置某个键时，这个键没有生效值，不限制通话（`GET /api/entitlements` 的 `features` 里不出现它）；适用的通话额度键都没有生效值时账号不能通话（15.6）。`call.lifetime_minutes` 不参与"取最大"：它只对没有任何有效权益的账号评估，取默认值；权益的 `EntitlementFeature` 里不能配置它（17.4）。**同一账号在多个渠道各有订阅时，权益取最高档，不叠加**。`PERMANENT` 的 `LIMIT` 在上述结果不是"不限"时，再加上用额度购买的额外单位（`AccountFeatureBonus`，15.9），额外单位与订阅上限是相加的（订阅给 3 个槽位、额外买了 2 个，就是 5 个）。**两个例外**：`avatar.looks_max` 是"每个形象"的上限，生效值对账号下的每个形象分别适用，不能用额度买额外单位（`creditCost` 为空，不加 `AccountFeatureBonus`）；`credits.period_grant` 的生效值是每个计费周期赠送的额度数（15.9），不加额外单位。**权益失效后账号可能超出新的上限**（例如已有 6 个形象，上限降为 1 加 2 个额外槽位）：已有的资产全部保留，当前使用的指针不变，只是不能再新建。

**有效权益**：未撤销，`startsAt <= now`，且 `expiresAt` 为空或大于 now。`STORE` 来源的 `expiresAt` 按订阅状态取：`ACTIVE`、`CANCELED` 取 `currentPeriodEnd`；`IN_GRACE_PERIOD` 取 `gracePeriodEndsAt`（宽限期内 Apple 的 `expiresDate` 已经过去，权益靠 `gracePeriodEndsAt` 保持有效）。每次同步订阅状态时重新计算并更新 `expiresAt`。**`STORE` 权益的创建与失效**：订阅第一次进入有权益状态（`ACTIVE`、`CANCELED`、`IN_GRACE_PERIOD`）且已绑定账号时，创建一行 `source=STORE` 的 `AccountEntitlement`（`startsAt` 取当时的时间，`subscriptionId` 指向订阅）；订阅进入 `PENDING`、`ON_HOLD`、`PAUSED`、`EXPIRED`、`REVOKED` 时把它置 `revokedAt`；恢复为有权益状态时清除 `revokedAt`（同一订阅同一权益只有一行）。订阅换了商品（Apple 的升级、降级：通知里的 `productId` 变了，15.4）时，这一行的 `entitlementKey` 改成新商品对应的权益，更新同一行，不新建行、也不撤销旧行；新旧商品对应同一个权益时什么都不变。

### 15.4 订阅状态

内部状态和是否有权益（依据 15.1 的原文）：

| 内部状态 | 含义 | 有权益 |
|----------|------|:------:|
| `PENDING` | 已创建，等待付款 | 否 |
| `ACTIVE` | 有效 | 是 |
| `CANCELED` | 已关闭自动续订，但未到期 | 是（到 `currentPeriodEnd`） |
| `IN_GRACE_PERIOD` | 扣款失败，商店在宽限期内重试 | 是（到 `gracePeriodEndsAt`） |
| `ON_HOLD` | 扣款失败且已过宽限期（Apple 的计费重试期，Google 的账号挂起） | 否 |
| `PAUSED` | 用户暂停（Google） | 否 |
| `EXPIRED` | 已过期 | 否 |
| `REVOKED` | 退款、撤销或家庭共享移除 | 否，立即失效。**粘性**：`get` 的结果不能把它改回 `EXPIRED`（Google 撤销后的订阅资源返回 `EXPIRED`），只有 Apple `REFUND_REVERSED` 能解除 |

订阅未关联到账号不是状态：`accountId` 为空，`state` 照存商店的真实状态。

**先分类，再处理**：Apple 交易信息里的 `type` 字段区分商品类型（自动续订订阅、非消耗型、消耗型、非续订订阅，Apple `type` 文档，读过）。后端按 `type` 和 `productId` 归类：自动续订订阅且 `productId` 在 `SubscriptionProduct` 里 → 订阅流程（本节）；消耗型且在 `CreditProduct` 里 → 额度流程（15.9）；其他类型，或 `productId` 两边都不在 → 只记事件并标错误，不改任何状态。

**Apple 订阅通用规则**（只适用于订阅类交易，额度交易没有 `signedRenewalInfo`）：处理任何订阅相关的 Apple 通知时，都从通知里的 `signedTransactionInfo` 和 `signedRenewalInfo` 刷新 `productId`、`currentPeriodEnd`、`autoRenew`、`gracePeriodEndsAt`，再按下表调整状态。这样降级后 `DID_RENEW` 换成新商品、`RENEWAL_EXTENDED` 延长到期日都自然生效。**当前为 `REVOKED` 时，除 `REFUND_REVERSED` 外的 Apple 通知只记事件，不改 `state`**（退款之后再到的 `DID_RENEW`、`EXPIRED` 不能把它改掉）。`lastEventSignedAt` 的排序也只用于订阅。

**Apple 通知 → 状态**（按 `notificationType` 和 `subtype`）：

| 通知 | 处理 |
|------|------|
| `SUBSCRIBED`（`INITIAL_BUY`、`RESUBSCRIBE`） | → `ACTIVE`；`firstActiveAt` 为空时置值并记 `subscription_started`（第七节） |
| `DID_RENEW` | → `ACTIVE`（`BILLING_RECOVERY` 子类型是从计费失败中恢复） |
| `DID_FAIL_TO_RENEW`，子类型 `GRACE_PERIOD` | → `IN_GRACE_PERIOD`（继续提供服务） |
| `DID_FAIL_TO_RENEW`，子类型为空 | → `ON_HOLD`（不在宽限期，可以停止服务；App Store 继续重试计费最长 60 天，此时提示用户检查付款方式） |
| `GRACE_PERIOD_EXPIRED` | → `ON_HOLD` |
| `EXPIRED`（任何子类型） | → `EXPIRED` |
| `DID_CHANGE_RENEWAL_STATUS` | 仅当前状态为 `ACTIVE`、`CANCELED` 时切换状态：`AUTO_RENEW_DISABLED` → `CANCELED`（`autoRenew=false`），`AUTO_RENEW_ENABLED` → `ACTIVE`；当前是 `IN_GRACE_PERIOD`、`ON_HOLD`、`EXPIRED`、`REVOKED` 时只更新 `autoRenew`，不改状态（否则宽限期内的权益会被误切断） |
| `DID_CHANGE_RENEWAL_PREF` | `UPGRADE`：立即生效并开始新的计费周期，换成新商品；`DOWNGRADE`：下一个续订周期才生效，当前商品不变；子类型为空：取消了降级 |
| `OFFER_REDEEMED`（已有有效订阅时兑换优惠） | 子类型 `UPGRADE`：立即生效；`DOWNGRADE`：下个续订日生效；子类型为空：只刷新订阅信息 |
| `RENEWAL_EXTENDED` | 续订日被延长，`currentPeriodEnd` 按新值刷新 |
| `REFUND`、`REVOKE` | 订阅商品：→ `REVOKED`，并按 15.9"订阅每期赠送"扣回这一期赠送的额度。**额度商品（消耗型）的 `REFUND`**：按 15.9 的退款状态表处理，不改任何订阅状态 |
| `REFUND_REVERSED` | 订阅商品：退款被撤销，Apple 要求恢复被撤走的权益，续订日不变。按交易信息重新判定状态（未过期则恢复 `ACTIVE`），并解除 `REVOKED`，并按 15.9 写 `REFUND_REVERSED` 把扣回的赠送额度加回。额度商品：按 15.9 的退款状态表把之前扣回的额度加回。出处：Apple 通知类型文档说 `REFUND_REVERSED` 适用于所有内购类型（含消耗型），"如果你的应用因相关退款撤销过内容或服务，需要恢复它们"，即 Apple 的预期是退款时撤销、撤销退款时恢复 |
| `CONSUMPTION_REQUEST` | 只记事件，**不回应**。Apple 的 Send Consumption Information 页面写明：客户提供了同意才调用该接口发送消费数据，没有同意就不要响应；收到通知后 12 小时内回应；同意必须是用户主动选择加入（opt-in），由开发者自己取得。它对任何商品类型都会触发，包括自动续订订阅和消耗型商品（额度）。本应用没有征求这种同意的机制，所以订阅和额度购买的退款申请都不回应，这符合"没有同意就不响应" |
| `REFUND_DECLINED`、`RESCIND_CONSENT`、`EXTERNAL_PURCHASE_TOKEN` | 只记事件，不改状态 |
| `ONE_TIME_CHARGE` | Apple 文档：用户**购买**消耗型、非消耗型或非续订订阅时的通知类型（**每一次购买都会收到**），兑换这些商品的优惠码时同样是这个类型。额度商品（消耗型）：按 15.9 入账，找不到账号（例如在 App Store 里兑换优惠码，没有 `appAccountToken`）则创建 `UNCLAIMED` 记录等客户端 `verify` 认领；其他商品类型只记事件 |
| `RENEWAL_EXTENSION`（子类型 `SUMMARY`、`FAILURE`） | 批量延期的汇总，只记事件；与单个订阅的 `RENEWAL_EXTENDED` 不同，后者要刷新到期日 |
| `TEST` | 只记事件，返回 200 |
| `PRICE_INCREASE` 及其他不改变访问权的类型 | 只记 `SubscriptionEvent`，不改状态 |
| 不认识的类型 | 记 `SubscriptionEvent` 并标错误，供后台查看和重试（不丢弃） |

**Google 通知 → 状态**：`notificationType` 是整数（值见 15.1 引用的 rtdn-reference，代码里用枚举）。通知只带类型和 `purchaseToken`。**收到任何 `subscriptionNotification` 都调 `purchases.subscriptionsv2.get` 拉取全量状态，以返回的 `subscriptionState` 为准**（官方要求）。`subscriptionState` 的真实取值都带前缀，如 `SUBSCRIPTION_STATE_ACTIVE`：

| `subscriptionState` | 内部状态 |
|------|------|
| `..._ACTIVE` | `ACTIVE` |
| `..._CANCELED` | `CANCELED` |
| `..._IN_GRACE_PERIOD` | `IN_GRACE_PERIOD` |
| `..._ON_HOLD` | `ON_HOLD` |
| `..._PAUSED` | `PAUSED` |
| `..._EXPIRED` | `EXPIRED` |
| `..._PENDING` | `PENDING` |
| `..._PENDING_PURCHASE_CANCELED` | 忽略这次购买；有 `linkedPurchaseToken` 时用它再查被替换的原订阅 |
| `..._UNSPECIFIED` 或其他未知值 | 不改状态，记事件并标错误 |

其余规则：
- `SUBSCRIPTION_REVOKED`（12）→ `REVOKED`。
- `voidedPurchaseNotification`（退款、拒付等）：`productType` 为 `PRODUCT_TYPE_ONE_TIME`（2）的是额度商品，按 `orderId` 找到入账记录并扣回额度（15.9），不进订阅流程；`PRODUCT_TYPE_SUBSCRIPTION`（1）的按下面处理。订阅：记 `SubscriptionEvent`，设置 `voidedAt`，同时按 15.9 扣回被作废的那次交易对应的 `SUBSCRIPTION_GRANT`（流水 `eventKey` 用 `orderId` 加 `:voided`），同样调 `get` 并按上表处理；Google 文档没有说明作废的购买会使订阅资源直接变成撤销，所以不在这里直接判 `REVOKED`。退款统计以 `voidedAt` 和事件为准，不依赖 `state`。（作废购买接口 `purchases.voidedpurchases.list` 同时覆盖一次性商品和订阅，官方建议和实时通知配合使用，对账任务用它补漏，15.7。）
- `pendingRefundReviewNotification`、`testNotification`：记事件；前者在管理后台"订阅事件"里标为需人工关注，后者直接返回成功。
- 用户在 Play 商店订阅中心里换档、重新订阅：见 15.2 的账号查找。

**去重与乱序**：先按 `(store, sourceEventId)` 去重，已处理过的直接忽略并返回成功。Google 以 `get` 的结果为准，所以乱序无害。Apple 通知按 `signedDate` 排序：不晚于该订阅 `lastEventSignedAt` 的通知只记录、不覆盖状态（等于的是同一事件的重放）。**`verify` 里的 Apple 交易同样受这个排序约束**：交易的 `signedDate` 不晚于该订阅的 `lastEventSignedAt` 时，只用于核对归属和绑定账号，不覆盖状态、`currentPeriodEnd`（不倒退）和 `REVOKED`（`verify` 不能解除 `REVOKED`，只有 `REFUND_REVERSED` 能）；晚于时按通知同样的规则更新并推进 `lastEventSignedAt`。这样客户端拿旧交易重放 `verify`，不能把已退款或已过期的订阅改回有效。Google 的 `verify` 总以 `subscriptionsv2.get` 为准，不受此影响。

**账号状态与商店通知、对账、`verify` 的写入**（三条路径共用这一条）：先在事务外完成全部商店 HTTP 查询（Google `get`、Apple 状态查询，可能很慢，不能放进持有行锁的事务），再开事务：处理放在一个数据库事务里，先对 `User` 行加共享锁（`SELECT … FOR SHARE`）再读 `status`，写入和状态检查在同一个事务里；13.1 把状态改成 `DELETING` 的条件更新需要行写锁，所以两者互斥——处理在先则提交后状态才变，状态已变则处理看到 `DELETING`。**状态变化的通知**：订阅状态真的变成 `IN_GRACE_PERIOD` 或 `ON_HOLD` 的那一次（条件更新更新到行），账号是 `ACTIVE` 时在同一个事务里写 `notification.subscription.billing_issue`（25.3）；重复到达的商店通知和对账没有状态变化，不再写。

| 账号状态 | 处理 |
|------|------|
| `ACTIVE`、`BANNED`、`PENDING_DELETION` | 照常记录订阅和购买的事实，更新权益与额度、写流水：用户已经付款，封禁和宽限期不改变这个事实（`BANNED` 只是登录被拦；宽限期内取消删除后账号要能看到期间发生的续订、退款） |
| `DELETING`，或账号不存在 | **不写任何账号相关的行**：订阅按 15.2 当作账号已不存在处理（`accountId` 留空的订阅照常记录商店的真实状态，没有权益）；额度购买只命中或写入无账号的 `OneTimePurchase` 墓碑或锚点行（15.9），不创建权益、不写流水、不创建 `UNCLAIMED`；事件照记（`accountId` 为空）；对商店仍返回 2xx |

凡是向账号写入额度流水、签到记录、任务记录、通知的路径（广告奖励 22.6 第 7 步、签到 28.1、领取任务奖励 28.2、运营发送通知 25.3、邀请奖励 9.1）都遵守同一条：写入事务里先对 `User` 行加共享锁（`SELECT … FOR SHARE`，或更强的 `FOR UPDATE`，28.1、28.2 用后者）再读 `status`，`DELETING` 或不存在一律拒绝，不会在 13.1 步骤表第 6 步之后写出孤儿行。

无账号的 `Subscription` 行：处于终态（`EXPIRED`、`REVOKED`）且 `updatedAt` 早于 `subscription.orphan_retention_days`（默认 90，提议）的，由每天一次的清理任务删除，并同时删除指向它的 `SubscriptionEvent`；`accountId` 和 `subscriptionId` 都为空、`receivedAt` 早于同一期限的事件也一并删除；非终态的保留（商店仍在扣款，用户重新注册后可以按 15.2 认领）。

### 15.5 接口

**接收商店通知（不走用户 JWT）**

```
POST /api/subscriptions/apple/notifications    # App Store Server Notifications V2，请求体 {"signedPayload":"<JWS>"}
POST /api/subscriptions/google/notifications   # Google Pub/Sub 的推送
```

- Apple：在 App Store Connect 里分别配置生产和沙盒地址，指向同一接口，环境从负载里读。JWS 必须验签（证书链回到 Apple 根证书）后才可信；具体验签方式见第十九节（我这次没读到原文）。**响应约定**（Apple 文档 `responding-to-app-store-server-notifications`）：返回 2xx 视为成功；其他状态码 Apple 视为失败并重试——v2 通知在生产环境重试 5 次，间隔 1、12、24、48、72 小时。所以：事件写入数据库之后返回 200；处理逻辑出错但事件已保存时同样返回 200，由对账任务补偿；只有连事件都没能保存时才返回非 2xx 让 Apple 重试。漏收的通知可以用 App Store Server API 的通知历史接口补（对账任务使用，接口细节见第十九节）。
- Google：RTDN 通过 Pub/Sub 送达，推送订阅的鉴权方式（推送请求携带的身份令牌）见第十九节，未核实。**只有事件已经写入数据库之后才返回 2xx**，否则 Pub/Sub 会因非 2xx 重试；处理逻辑出错但事件已保存时同样返回 2xx，由对账任务补偿。
- **两个通知接口的共同规则**：各按来源 IP 每 60 秒 600 次，超出 429 `RATE_LIMITED`（1.6）；Apple JWS 的证书链或签名无效、Google 身份令牌无效（签名、签发者、过期，或受众不对）→ 401 `INVALID_SIGNATURE`，不保存事件、不改任何状态，响应不说明是哪一步失败；验签通过、但负载里的包标识与配置不符，或处理出错而事件已保存 → 事件照存并记 `error`，返回 200；只有连事件都没能保存才返回非 2xx。
- **沙盒**：Apple 的 `environment=SANDBOX`、Google 的 `testPurchase` 有值，都记录事件和订阅（`environment=SANDBOX`）。应用商店审核人员和测试账号是拿沙盒或测试购买去测生产环境的后端 [推断：商店审核的通行做法，未在文档里核实]，所以 `subscription.accept_sandbox` **默认 true**：沙盒购买同样发放权益，但在订阅统计中排除（17.4）。要禁止时把它设为 false，此时沙盒购买只记录、不发放。

**客户端调用（JWT）**

```
GET  /api/subscription-products                # 在售商品列表
GET  /api/entitlements                         # 当前权益与功能开关的生效值
POST /api/subscriptions/google/verify          # 请求体 {"productId":"...","purchaseToken":"..."}
POST /api/subscriptions/apple/verify           # 请求体 {"signedTransaction":"<JWS>"}
```

- `GET /api/subscription-products`：`{"products":[{"store":"GOOGLE","productId":"...","entitlementKey":"premium","sortOrder":1,"features":{"assets.avatar_max":null,"assets.voice_max":5,"call.monthly_minutes":600,"chat.model_tier":"premium","avatar.looks_max":20,"avatar.look_free":true,"credits.period_grant":100,"render.cloud":true,"chat.voice_reply":true}}],"freeFeatures":{"assets.avatar_max":1,"assets.voice_max":1,"call.daily_minutes":10,"chat.model_tier":"standard","avatar.looks_max":5,"avatar.look_free":false,"credits.period_grant":0,"render.cloud":false,"chat.voice_reply":false}}`，只含 `enabled=true` 且在当前端可见的商品（`surfaces`，格式同 3.7，按请求的 `X-Platform`、`X-Channel` 过滤，1.2；某个渠道没有配给它的商品时 `products` 为空数组，`freeFeatures` 照常返回）。价格和名称由客户端向商店查询，后端不提供。**`features`** 是该商品对应的这一个权益的各功能开关取值（`EntitlementFeature` 与 `FeatureGate.defaultValue` 合并后的结果；不带额度购买的额外单位——那是账号的，只出现在 `GET /api/entitlements`；没有生效值的额度键不出现；`LIMIT` 类的"不限"在 JSON 里是 `null`，与 `GET /api/entitlements` 的 `features` 同样的取值类型）；**`freeFeatures`** 是没有任何权益时各开关的生效值（即默认值；没有配置的通话额度键和文字额度键都不出现）。付费页要展示"每个档位给什么、免费给什么"，而 `entitlements` 只返回当前账号的生效值，所以商品列表必须自带这两项（客户端不自己推算）。**`sortOrder` 从低档到高档递增**（同一档位的不同周期商品可以相同或相邻），客户端用它判断换档是升级还是降级（升级立即生效，降级下个续订日生效，15.6），所以运营配置商品顺序时必须按档位高低排。
- `GET /api/entitlements`：`{"entitlements":[{"key":"premium","source":"STORE","expiresAt":"...","inGracePeriod":false,"autoRenew":true}],"features":{"memory.tier":"premium","assets.avatar_max":null,"assets.voice_max":5,"call.daily_minutes":30,"call.monthly_minutes":600,"chat.model_tier":"premium","avatar.looks_max":20,"avatar.look_free":true,"credits.period_grant":100,"render.cloud":true,"chat.voice_reply":true},"usage":{"call.daily_minutes":{"used":5,"resetAt":"2026-10-02T16:00:00Z"},"call.monthly_minutes":{"used":120,"resetAt":"2026-10-01T00:00:00Z"}},"subscriptions":[{"store":"GOOGLE","productId":"...","sortOrder":1,"state":"ACTIVE","currentPeriodEnd":"...","autoRenew":true}]}`。`features` 是后端算好的生效值（含额度购买的额外单位），客户端不自己计算；`usage` 是限额类开关的已用量，每项 `{"used":<数量，向下取整；通话键是分钟，文字额度键是条数>,"resetAt":<UTC 时间或 null>}`，终身额度另带 `granted`（发放的分钟数）且 `resetAt` 为 `null`，形如 `{"used":5,"granted":30,"resetAt":null}`；发放值为“不限”的终身额度不出现在 `usage` 里（不限没有“剩余”可显示），客户端对 `granted` 为空或负数也不报错；`subscriptions` 每项带该商品的 `sortOrder`（商品已下架也带，客户端据此判断换档是升级还是降级），是该账号名下所有未终结的订阅（可能有多条，同一渠道也可以有多条），没有时为空数组。客户端在购买前用它检查用户是否已在别的商店订阅并提示所在商店（服务端拦不住用户在两个商店都买，只会照常记录，权益取最高档）。
- `verify`：**客户端购买成功（或恢复购买）后必须调用**。后端向商店查询该购买（Google 调 `subscriptionsv2.get`，Apple 验 JWS 并核对 `bundleId`、`appAccountToken`），按 15.2 绑定账号，写订阅和权益，然后**由后端确认（acknowledge）**（下一条），返回同 `GET /api/entitlements` 的内容。购买凭证无效或包名不符：400 `SUBSCRIPTION_VERIFY_FAILED`；商品不在 `SubscriptionProduct` 映射里也是 400（`enabled=false` 只控制是否展示，已有该商品订阅的用户仍可验证和续订）；归属别的账号：409 `SUBSCRIPTION_OWNED_BY_OTHER`。
- **确认（acknowledge）由后端做**：Google 要求 3 天内确认，否则购买会被自动退款、权益被撤销（`lifecycle/subscriptions`、`integrate`）。官方建议在后端确认，并明确说这样"即使用户没有打开 App"也能在 3 天内完成，这对用户在 Play 商店订阅中心里重新订阅的情形（没人会调 `verify`）是唯一的办法。所以：后端在发放权益之后调用 `purchases.subscriptions.acknowledge`（Google 文档给出的方法）；发放的时机有两个：`verify` 成功时，以及收到 `SUBSCRIPTION_PURCHASED` 通知并按 15.2 关联到账号时。确认前先看 `acknowledgementState`，已确认的不重复调用。客户端也可以在 `verify` 成功后调 `BillingClient.acknowledgePurchase()`，两边都是幂等的。对账任务（15.7）对超过 `subscription.unacked_alert_hours`（默认 24）仍未确认的购买在管理后台告警。
- 恢复购买用同一个 `verify` 接口：客户端向商店查询用户已有的购买（Google 的 `queryPurchasesAsync`，Apple 的当前权益），逐个调用。

### 15.6 权益变化对其他模块的影响

- **上传形象/声音（3.2）**：写盘前用 `assets.avatar_max` / `assets.voice_max` 的生效值校验，已有数量（含所有非终态任务，规则和 `data` 见 3.2）不小于上限时返回 403 `FEATURE_LIMIT_REACHED`，`message` 写明是哪个上限。
- **建外观（3.6）**：用 `avatar.looks_max` 的生效值校验，数量是该形象已有的外观加上该形象非终态的 `LOOK` 任务，规则同 3.2 的咨询锁；不小于上限时返回 403 `FEATURE_LIMIT_REACHED`（`data` 见 3.6）。
- **通话时长（`call.daily_minutes`、`call.monthly_minutes`、`call.lifetime_minutes`）**：日额度、月额度各有自己的"用量窗口"，终身额度没有窗口；有生效值的键都要有剩余才能通话。**月窗口的划分是我从结构推出来的设计选择，没有竞品或商店出处**：用户按订阅周期付费，月中订阅的人按自然月算，第一个月拿不到完整额度。
  - **月窗口由决定生效值的那条订阅来定**：有效的 `STORE` 订阅里，提供 `call.monthly_minutes` 最大生效值的那一条（并列时取 `currentPeriodEnd` 较晚的），窗口 = `[currentPeriodStart, currentPeriodEnd)`。
  - **月窗口，没有这样的订阅**（免费用户、只有 `PROMO` 权益、订阅已过期）：窗口 = UTC 日历月，起点取 `max(本 UTC 月初, 最近一条订阅权益的结束时间)`。订阅期间的通话不计入回到免费之后的额度，避免刚过期就发现免费额度已经用光。
  - **日窗口**（`call.daily_minutes`）：不看订阅，所有账号相同：账号本地日 `[本地 0 点, 下一个本地 0 点)`，本地日按 `User.timezone`（没有时区的账号按 UTC）。4.1 每次发起会话先把请求里的时区写进 `User.timezone`，再算窗口。用户改设备时区可以重新划分本地日、多得一份日额度，这个偏差接受（同广告频控，22.1）。订阅状态变化不影响日窗口。
  - **终身额度**（`call.lifetime_minutes`）：不分窗口，只对发起会话时没有任何有效权益（`AccountEntitlement`）的账号生效，这样的会话记 `Session.freeTier=true`（以发起时为准：发起后才购买订阅的会话，整段时长仍计入终身额度；游客会话没有 `User`，一律 `freeTier=false`，用游客额度，4.3）。`User.lifetimeGrantSeconds`：空表示还没发放，`-1` 表示发放的是"不限"，否则是发放的秒数；创建账号时（2.2、2.7、23.2）先按 13.5 查防滥用标记：命中则 `lifetimeGrantSeconds`、`lifetimeUsedSeconds` 直接取标记里的值（恢复删除前的状态，不重新发放）；没有命中时，若 `call.lifetime_minutes` 已配置就记入当时的值，没配置留空，之后在第一次发起会话时记入，**记入时把 `lifetimeUsedSeconds` 清零**（配置之前的免费通话是不受限的，不计入新发放的额度）；已发放的值不再变化，之后把 `call.lifetime_minutes` 改回未配置或改成不限，也不改变已发放账号的值。剩余 = `lifetimeGrantSeconds − lifetimeUsedSeconds − 进行中的免费会话已用的秒数`，`lifetimeUsedSeconds` 在会话结束流程（下）里累加，只累加 `freeTier=true` 的会话。订阅期间的通话不计入，订阅过期回到免费后剩余额度接着用。
  - **免费通话总量告警**：Redis 计数器 `free_call_seconds:{会话结束时刻所在的 UTC 日}`，会话结束流程里累加免费通话（`Session.freeTier=true` 的会话和游客会话）的 `durationSeconds`；达到 `call.free_daily_alert_minutes`（17.5，没有配置不告警）× 60 秒时写一条 `AdminAlert`（`type=FREE_CALL_MINUTES_HIGH`），同一天只写一条，次日 UTC 零点自动 `RESOLVED`。**只告警，不拒绝通话**：拒绝会让正常的免费用户被别人用光额度。这个计数器只用于告警，是近似值：累加和 `statsAppliedAt` 标记是两次写入，进程在中间崩溃会有少量误差，可以接受，不用于任何拒绝决定。
  - **已用分钟**（日额度、月额度各算各的窗口）= 窗口内所有 `Session` 的时长之和（`Session.startedAt` 落在窗口内的会话；已结束的取 `durationSeconds`，进行中的取 `min(当前时间, deadlineAt) − startedAt`）。`(accountId, startedAt)` 建索引。
  - **衔接**：免费 → 订阅：窗口立即换成订阅的当前周期，订阅之前的通话不计入，用户马上拿到完整额度。续订：周期推进即新窗口。Apple 升级（立即生效并开始新计费周期）和 Google 换档（新购买令牌产生新订阅）同样开新窗口，升级当刻额度重新开始；降级在下个续订日才生效，不影响当前窗口。订阅过期回到免费：按上一条重新计算，从权益结束时刻起给一份免费额度。
  - **截止时间**：`deadlineAt = min(现在 + 各个有生效值且不是"不限"的键的剩余分钟中最小的, 这些键（终身额度没有窗口，不参与）的窗口结束时间中最早的, 现在 + session.max_duration_minutes)`，写入 `Session.deadlineAt`。限额账号的通话因此**不会跨过窗口边界**（到边界就结束，之后重新拨打属于新窗口），不会出现"最后一天深夜开始的通话白用下个窗口额度"的问题；不受限额约束的账号只受硬上限 `session.max_duration_minutes`（默认 240，提议）约束，所以任何会话都有 `deadlineAt`。`GET /api/entitlements` 的 `usage` 里每个有生效值的通话键各有一项，`resetAt` = 该键的窗口结束时间（月窗口：订阅取 `currentPeriodEnd`，免费取下一个 UTC 月初；日窗口：下一个本地 0 点）。
  - **通话中权益或窗口变化**（发放或失效权益、续订、升级、降级等）：重新计算该账号进行中会话的 `deadlineAt`，**只延长不缩短**；这样续订恰好发生在通话中，或用户在通话中升级，通话不会因为旧的截止时间被切断。`chat.model_tier` 不受此影响（见下）。
  - **会话结束流程 `finalizeSession(sessionId, endedAt)`**：**`agentJoinedAt` 为空的 Session（启动中，agent 从未加入，4.1 第 4 步）不是一次通话：直接删除该记录并返回，不写时长，不触发养成统计。**`agentJoinedAt` 不为空、但 `userJoinedAt` 和 `userLeftAt` 都为空的 Session**（用户从未进入过房间，4.1 第 4 步）同样不是一次通话：直接删除该记录，记 `session_discarded`（`reason=USER_NOT_JOINED`），同时删除 `sessionId` 等于它的 `Message`（agent 在用户加入前可能已经写了问候），不写时长，不触发统计；到点扫描在调用这里之前已经用 `listParticipants` 确认过房间里没有非 agent 参与者（4.1），`room_finished` 到达时则要求 `userLeftAt` 也为空。**其余：若 `endedAt` 为空则回填（调用方同时传 `endReason`，写进 `Session.endReason`：到点扫描 `DEADLINE`、用户离开后的关闭 `USER_LEFT`、`room_finished` 且 `userLeftAt` 为空 `ROOM_FINISHED`、`room_finished` 且 `userLeftAt` 不为空 `USER_LEFT`、封禁 `BANNED`、被同账号新请求取代 `SUPERSEDED`），写 `durationSeconds = endedAt - startedAt`，触发第六节的养成统计并置 `statsAppliedAt`（**游客会话**，即 `accountId` 为空的 Session，改为把 `durationSeconds` 加到 `GuestDevice.usedSeconds`，不触发养成统计，4.3）；`Session.freeTier=true` 的会话还把 `durationSeconds` 加到 `User.lifetimeUsedSeconds`（15.6）；`freeTier=true` 的会话和游客会话还把 `durationSeconds` 累加到当日免费通话总量（15.6，告警用）；账号会话的 `durationSeconds ≥ invite.first_call_min_seconds` 且该账号有 `PENDING` 的 `InviteRecord`（作为被邀请人）时，按 9.1 评估邀请奖励（在置 `statsAppliedAt` 之后的独立事务里执行，评估本身幂等：失败只记日志，下一次满足条件的通话结束时重试）；账号会话还刷新每日任务进度（28.2，刷新的是包含 `endedAt` 的那个任务日，该日记录仍是 `IN_PROGRESS` 或 `CLAIMABLE` 才更新；同样在独立事务里、幂等）；这些 PostgreSQL 写入（`durationSeconds`、养成统计、`GuestDevice.usedSeconds`、`User.lifetimeUsedSeconds`）与条件置 `statsAppliedAt` 在同一个数据库事务里，Redis 计数器和后面的邀请、任务刷新在事务之后；以 `statsAppliedAt` 为空作为执行条件，所以幂等。LiveKit webhook（4.2）、到点扫描、用户离开后的关闭扫描和存活核对都调用它，谁先到谁生效，不会漏算养成统计，也不会重复。
  - **到点强制结束**：后台任务每 `session.deadline_scan_seconds`（默认 30）扫描 `deadlineAt` 已过且 `statsAppliedAt` 为空的会话（启动中的 Session，即 `agentJoinedAt` 为空的，改按 `requestedAt < 现在 − ((session.agent_join_retries + 1) × session.agent_join_timeout_seconds + 10 秒)` 判断：它的 `deadlineAt` 在 agent 加入前还没按真实起点重算，可能比等待 agent 的时间还短），用 `RoomServiceClient` 删除 LiveKit 房间（**房间不存在视为成功**：用户可能从未加入），然后以 `endedAt = deadlineAt` 调用会话结束流程。因为所有会话都有硬上限，webhook 丢失的会话也会被同一个扫描收尾，不需要单独的清扫任务。这样不需要 AvatarAgent 配合截断。
  - **用户离开后关闭房间**：同一个后台任务（`session.deadline_scan_seconds`）还扫描 `userLeftAt` 不为空、`endedAt` 为空，并且 `userLeftAt` 早于现在减 `session.user_leave_grace_seconds`（默认 15，提议；给网络抖动后的重连留时间，重连会触发 `participant_joined` 把 `userLeftAt` 清空）的会话：用 `RoomServiceClient` 删除房间（不存在视为成功），然后以 `endedAt = userLeftAt` 调用会话结束流程（扫描选中会话与删除房间之间，若重连的 `participant_joined` 把 `userLeftAt` 清空了，会话结束流程的条件更新要求 `userLeftAt` 仍等于选中时的值，不满足就放弃这次收尾）。额度按用户实际离开的时刻算，扫描的延迟不计入用户的时长。**webhook 丢失的兜底**：对 `userJoinedAt` 不为空、`userLeftAt` 为空的进行中会话，每 `session.liveness_check_seconds`（默认 300，提议；用 Redis 键 `session_liveness:{sessionId}` 节流）用 `listParticipants` 核对一次，房间不存在或房间里没有非 agent 参与者，就把 `userLeftAt` 置为当前时间（丢失的 webhook 给不出真实时刻，这是近似），由上面的规则收尾；这样丢了 `participant_left` 的会话最多多算一个核对间隔加宽限期，而不是一直算到 `deadlineAt`（最长 `session.max_duration_minutes`）。
- **文字额度（`chat.daily_messages`、`chat.monthly_messages`，5.4）**：规则和通话额度对应，只有计量单位不同（条数，不是分钟）：窗口的划分、生效值、"未配置不限制"和"没有有效权益的账号两个键都未配置不能发"的兜底、月窗口由订阅决定，全部同上面的通话额度；没有终身额度。**已用条数** = 窗口内（按 `Message.timestamp`）该账号 `source=TEXT`、`sender=USER`、`turnStatus` 为 `PENDING` 或 `COMPLETED` 的消息条数；`FAILED` 的轮次不计（用户没得到回复，重试不重复扣），被审核拦下的消息没有存下所以也不计。同一账号同一时刻只有一个进行中的轮次（5.4 的锁），所以并发不会超发。`GET /api/entitlements` 的 `usage` 里每个有生效值的文字额度键各有一项，`{"used":<条数>,"resetAt":...}`，`resetAt` 规则同通话键；`features` 里也带生效值。没有"到点强制结束"：额度只在发起每一轮时检查。
- **模型档位（`chat.model_tier`）**：发起会话时取生效值写入 `Session.modelTier` 和 dispatch metadata（4.1），会话进行中权益变化不影响当前通话。管理后台保存这个开关的值（权益的 `EntitlementFeature` 或默认值）时，校验必须在配置项 `chat.model_tiers_allowed` 里，否则返回 `INVALID_REQUEST`；AvatarAgent 遇到不认识的档位名按 `standard` 处理并记错误日志（跨项目约定，第十九节）；因此新增档位的上线顺序是先 AvatarAgent、后本后端的允许列表（17.5）。
- **AvatarMemory 档位同步**：任何会改变账号 `memory.tier` 生效值的变化（权益发放、失效、撤销、商品映射或权益配置被修改，或 `memory.tier` 的默认值被修改）之后，为该账号入队一个同步任务（`AccountMemoryTier.syncStatus=PENDING`；**每个账号至多一个待执行任务**，已有就不再入队，但每次变化都把 `AccountMemoryTier.targetVersion` 加一，即使任务正在执行）。**任务执行时才读目标档位**：重新计算该账号当前的 `memory.tier` 生效值（不用入队时的值，所以连续两次变化不会先后错乱）；与 `AccountMemoryTier.tierName` 相同（没有这一行按 `default` 比较）则用同样的条件更新（`WHERE targetVersion = <任务开始时读到的版本>`）置 `SYNCED` 并写 `assignedAt` 为现在；不同则调用 `PUT /v1/accounts/{id}/tier`，成功后写 `tierName`、`assignedAt`，并用条件更新置 `SYNCED`（`WHERE targetVersion = <任务开始时读到的版本>`）；更新不到行说明执行期间又有变化，保持 `PENDING` 并立即再执行一轮，所以执行期间的变化不会丢。**执行前提**：持有 Redis 锁 `memory_sync:{accountId}`；检查 `User.status`，`DELETING` 或账号不存在则放弃（删除任务，不调用 AvatarMemory，13.1 步骤表第 1 步依赖这一点）。同步由持久化的重试任务执行（`AccountMemoryTier` 带 `attempts`、`nextAttemptAt`、`lastError`；退避 `min(retry.initial_seconds × 2^(attempts−1), retry.max_seconds)` 加正负 10% 抖动，不放弃），失败不影响权益本身。AvatarMemory 返回 404（档位不存在）视为配置错误：`syncStatus=FAILED`，不重试，写 `MEMORY_SYNC_FAILED` 告警（`refType=ACCOUNT_MEMORY_TIER`，`refId` 是账号 ID）；修好配置后，后台重新保存权益配置会再次入队。
- **埋点**：订阅首次进入 `ACTIVE` 时后端记 `subscription_started`（第七节）。

### 15.7 对账与到期

- **订阅对账**（`subscription.reconcile_interval_minutes`，默认 60）：对每个非终态订阅（`PENDING`、`ACTIVE`、`CANCELED`、`IN_GRACE_PERIOD`、`ON_HOLD`、`PAUSED`，**包括 `accountId` 为空的**），以及 Apple 的 `REVOKED` 订阅（`REFUND_REVERSED` 可能被漏收），当 `currentPeriodEnd` 已过或 `lastSyncedAt` 早于该间隔时，向商店重新查询并修正状态和字段（Google 调 `subscriptionsv2.get`；Apple 用 App Store Server API 查询订阅状态，并用通知历史接口补漏收的通知，接口细节见第十九节）。通知丢失、延迟都靠它兜底。它同时检查 Google 订阅的 `acknowledgementState`，超过 `subscription.unacked_alert_hours` 仍未确认的告警。
- **权益到期扫描**（`entitlement.expiry_scan_minutes`，默认 5）：`PROMO` 权益按时间到期，不经过订阅通知，所以单独扫描 `source=PROMO`、`expiresAt` 已过、`expiryHandledAt` 为空的 `AccountEntitlement`（`STORE` 来源的权益到期由订阅状态同步驱动，15.4，不在这里处理），为该账号入队 15.6 的档位同步并把 `expiryHandledAt` 置为当前时间（每条权益只处理一次）。否则到期的限时权益会让账号在 AvatarMemory 里一直保持高档位。
- **额度对账**（同一个定时任务）：(1) 校验每个账号 `CreditBalance.balance == SUM(CreditLedger.delta)`，`totalEarned`、`totalSpent` 分别等于流水里正、负 `delta` 的汇总，不一致写 `CREDIT_LEDGER_MISMATCH` 告警（`refType=CREDIT_BALANCE`，`refId` 是账号 ID，同一账号只写一条 `OPEN`，下一次对账一致时自动 `RESOLVED`）；(2) Google：用 `purchases.voidedpurchases.list` 补漏收的作废通知（官方说明该接口同时覆盖一次性商品和订阅，并建议与实时通知配合使用；它有查询时间窗口和配额，对账间隔必须小于窗口，具体数值和参数见第十九节）；(3) Apple：用通知历史接口补漏收的 `REFUND` 和 `ONE_TIME_CHARGE`（接口细节见第十九节）；(4) `consumedAt` 为空的 Google 购买继续消耗，超过 `credits.unconsumed_alert_hours` 告警。

### 15.8 账号删除

删除账号时删除该账号的 `Subscription`、`SubscriptionEvent`、`AccountEntitlement`（第十三节步骤 6）。删除之后商店对这些订阅发来的通知，按 15.4 的“账号状态与商店通知”处理：账号不存在，订阅以无账号的行记录商店的真实状态，没有权益。**商店里的订阅不会因此取消**，用户仍会被继续扣款，所以客户端在删除确认前要根据 `GET /api/entitlements` 提示用户先去商店取消订阅。这个提示是必须的：Google 政策（support.google.com/googleplay/android-developer/answer/13327111，读过原文）要求删除前若需要额外步骤（例如取消订阅），必须清楚说明并提供支持流程；Apple 对有内购的应用的补充要求见第十九节。网页删除入口见 13.4。

### 15.9 额度（消耗型商品）

**决定：额度是独立的一次性商品，不放进订阅商品里。** 依据：Google 订阅政策原文（support.google.com/googleplay/android-developer/answer/9900533，读过）：订阅不得用来提供实质上一次性的权益，例如一次性发放额度或货币的 SKU；不能提供持续价值的商品必须使用应用内商品，不能用订阅商品。另一个会话调研了五家竞品（Replika、Character.AI、Nomi、Kindroid、Chai），均为"多档订阅 + 消耗型额度"，我没有逐家复核。

**额度的用途**先按竞品的用法：购买额外的形象/声音槽位。用途由 `FeatureGate` 声明（`creditCost`，15.3）；竞品另有"额外生成次数"，本应用目前没有这个受控功能，等产品定义后加一条开关即可，机制不用改。另有两个不经过 `FeatureGate` 的用途（形象渲染设计 5.1、5.2）：兑换服装和背景（3.7 的 `redeem`，价格是条目的 `creditPrice`）；新建外观（3.6，价格是 `avatar.look_credit_price`，`avatar.look_free` 为真的账号免收）。

**订阅每期赠送**（形象渲染设计 5.2）：订阅不直接附带服装，订阅的好处是每个计费周期赠送额度，数量是功能开关 `credits.period_grant`（15.3）的生效值，0 表示不送。订阅进入新的计费周期时（首次购买和每次续订）写一条 `reason=SUBSCRIPTION_GRANT` 的流水，`eventKey` 为该计费周期的交易号，所以每期只发一次。**每期怎么发**：首次购买发一次，之后每个计费周期各发一次，每次一份发放时账号当前有效的 `credits.period_grant`。Apple 升级立即生效，额度在进入新计费周期时再发，不在升级当刻补发；降级在下个周期生效，到时按新档发。Google 换档产生新的购买令牌，作为一个新订阅：首次购买发一次，旧订阅过期后不再发。同一账号有两个商店订阅时，各按自己的计费周期各发一次，不合并。每期发放凭商店给的每期唯一订单号去重：Apple 取 `transactionId`，Google 取 `orderId`，重复通知不重复发（字段名开发时按商店文档核对 [推断]）。**订阅退款时这一期赠送的额度全部扣回**，规则同额度包的退款（下面"退款"一节的产品决定：整笔扣回，不管已经花掉多少，余额允许为负，为负时不能消费，之后入账直接抵扣）：找到被退款的那次交易对应的 `SUBSCRIPTION_GRANT` 流水（`eventKey` 是该交易号），写一条 `reason=REFUND` 的流水，`delta` 为那条赠送流水的负数，`eventKey` 是那次退款事件的 ID（同额度包的规则）；没有找到赠送流水（该期没有送，或数量为 0）时不写；Apple `REFUND_REVERSED` 写一条 `REFUND_REVERSED` 流水把它加回。已经用这些额度兑换的服装、建的外观不回收（同"已经购买的额外槽位不回收"）（2026-10-11 决定：相似情形照同一规则）。额度不设过期（见下面的"不过期与恢复"），所以不需要把付费额度和免费额度分开记账。

#### 数据

| 实体 | 关键字段 | 说明 |
|------|---------|------|
| `CreditProduct` | store(渠道标识，目前 `APPLE`/`GOOGLE`，可扩展，15.10), productId, credits, enabled, sortOrder, surfaces(格式同 3.7，空数组表示所有端；客户端列表按它过滤，15.9) | 额度包在商店后台配置，后端只存"商品 → 额度数"。**按数量 1 销售**（不开启多数量购买） |
| `OneTimePurchase` | id, store, storeTransactionId, purchaseToken(仅 Google), productId, accountId(可空), tombstonedAt(可空，账号删除后转为墓碑的时间，或从未入账的锚点行的建立时间，13.1、本行说明), environment(`PRODUCTION`/`SANDBOX`), credits, state(`UNCLAIMED`/`CREDITED`/`REFUNDED`), creditedAt(可空), consumedAt(可空，仅 Google), createdAt, updatedAt | 一笔一次性购买的当前状态。`(store, storeTransactionId)` 唯一，`storeTransactionId` 是 Apple 的 `transactionId`、Google 的 `orderId`。`accountId` 为空表示无法关联到账号（`UNCLAIMED`），等客户端 `verify` 认领；`REFUNDED` 而 `creditedAt` 为空表示"先退款、后入账"（相当于“先退款锚点”，该购买在收到 `REFUND_REVERSED` 之前不再入账，`REFUND_REVERSED` 到达时回到 `UNCLAIMED`，见下面的退款表）。**`tombstonedAt` 非空、`accountId` 为空的行**是为防重复留下的幂等锚点（13.1），与 `UNCLAIMED`（`accountId` 为空、等待认领、`tombstonedAt` 为空）不同，按 `creditedAt` 分两种：① **墓碑**（`creditedAt` 非空）：已入过账的购买在账号删除时转成的，不可认领，`verify` 命中一律 409 `PURCHASE_OWNED_BY_OTHER`（否则买一次、删号、再注册、再 `verify`，同一笔购买会重复入账）；② **锚点行**（`creditedAt` 为空）：从未入过账的购买留下的（见下面“从未见过的购买命中 `DELETING` 或不存在的账号”，和 Apple 第 6 步），可以认领：之后的 `verify` 来自能入账的账号时，按账号绑定规则（下面 Google 第 3 步、Apple 第 3 步）入账给调用者，条件更新为 `CREDITED` 并清空 `tombstonedAt`，结果与 `verify` 先到时相同。两种行：`ONE_TIME_CHARGE` 重发命中什么都不做，`REFUND`、`REFUND_REVERSED` 命中只更新 `state`、不写流水（没有账号）；`REFUND` 找不到对应购买行时只记事件、不创建任何行。**从未见过的购买命中 `DELETING` 或不存在的账号**（15.4 的账号状态规则）：创建一行 `OneTimePurchase`，`accountId` 空、`tombstonedAt` 为当前时间、`state=UNCLAIMED`、`credits` 取商品映射、`creditedAt` 空，只当幂等锚点，不入账、不写流水 |
| `CreditLedger` | id, accountId, delta(有符号整数), reason(`PURCHASE`/`REFUND`/`REFUND_REVERSED`/`SPEND`/`ADMIN_GRANT`/`ADMIN_ADJUST`/`AD_REWARD`/`INVITE_REWARD`/`CHECKIN_REWARD`/`TASK_REWARD`/`SUBSCRIPTION_GRANT`/`SPEND_REVERSED`), purchaseId(可空), eventKey(可空), idempotencyKey(可空), spendKind(可空，仅 `SPEND` 和 `SPEND_REVERSED`：`FEATURE` 买功能开关单位，即 `featureKey` 的现有用法；`COSMETIC` 兑换服装和背景，带 `itemKey`；`LOOK` 新建外观，任务 ID 记在 `eventKey`（本行新定：`(reason, eventKey)` 唯一，`SPEND` 与 `SPEND_REVERSED` 的 `reason` 不同，所以同一个任务 ID 可以各出现一次）), featureKey(可空；新建外观的流水为空，不把外观写进 `featureKey`，以免和按功能开关分组的额度统计混在一起), itemKey(可空，兑换的条目 `CosmeticItem.key`), quantity(可空), note(可空), createdAt | **只追加，不修改不删除**（账号删除除外）。`(reason, eventKey)` 唯一：`PURCHASE` 的 `eventKey` 是交易号；`REFUND`、`REFUND_REVERSED` 的 `eventKey` 是那次退款事件的 ID（Apple 的 `notificationUUID`；Google 的作废通知没有事件 ID，用 `orderId` 加 `:voided`）；`ADMIN_GRANT`、`ADMIN_ADJUST` 的 `eventKey` 是 `CreditAdjustRequest.id`；`AD_REWARD` 的 `eventKey` 是 `impressionId`；`INVITE_REWARD` 的 `eventKey` 是 `invite:<InviteRecord ID>:INVITER` 或 `:INVITEE`；`CHECKIN_REWARD` 的 `eventKey` 是 `checkin:<账号 ID>:<签到日期>`；`TASK_REWARD` 的 `eventKey` 是 `task:<TaskRecord ID>`；`SUBSCRIPTION_GRANT` 的 `eventKey` 是该计费周期的交易号（首次购买和每次续订各一条，数量取 `credits.period_grant` 的生效值）；`SPEND_REVERSED` 的 `eventKey` 是 `LOOK` 任务的 ID（任务失败退回建外观扣的额度，保证只退一次，3.6）。`(accountId, idempotencyKey)` 唯一：消费幂等（`spend` 和 3.7 的 `redeem` 共用） |
| `CreditBalance` | accountId, balance, totalEarned, totalSpent, updatedAt | 行在第一次需要时创建（`INSERT … ON CONFLICT DO NOTHING` 再加锁），不在创建账号时创建。余额 = 流水的总和。`totalEarned` = 正的 `delta` 之和，`totalSpent` = 负的 `delta` 的绝对值之和（含退款扣回和负向调账），所以 `balance = totalEarned − totalSpent`；三个数与流水写入放在同一个数据库事务里、对该行加锁更新；对账任务定期校验 `balance == SUM(delta)` 以及两个累计值与流水一致（15.7）。**余额可以为负**。累计值照 dramaBox 的 `WalletCoinAccount`（`balance`、`totalEarned`、`totalSpent`）[核实 审计 行 43、48] |
| `AccountFeatureBonus` | accountId, featureKey, amount | 用额度购买的额外上限单位，加到 `PERMANENT` 的 `LIMIT` 开关的生效值上（15.3） |

#### 接口（JWT）

```
GET  /api/credit-products              # 在售额度包
GET  /api/credits                      # 余额和已购买的额外单位
GET  /api/credits/ledger?type=&before=&limit=  # 流水，分页，供用户查看；`type` 取 `all`（默认）、`earn`、`spend`
POST /api/credits/google/verify        # {"productId":"...","purchaseToken":"..."}
POST /api/credits/apple/verify         # {"signedTransaction":"<JWS>"}
POST /api/credits/spend                # {"featureKey":"assets.avatar_max","quantity":1,"idempotencyKey":"<uuid>","expectedCreditPrice":100}
```

- `GET /api/credit-products`：`{"products":[{"store":"GOOGLE","productId":"...","credits":100,"sortOrder":1}]}`，只含 `enabled=true` 且在当前端可见的商品（`surfaces`，格式同 3.7，按请求的 `X-Platform`、`X-Channel` 过滤，1.2；某个渠道没有配给它的商品时 `products` 为空数组）。价格由客户端向商店查询。
- `GET /api/credits`：`{"balance":300,"totalEarned":500,"totalSpent":200,"todayEarned":50,"bonus":{"assets.avatar_max":1,"assets.voice_max":0},"costs":{"assets.avatar_max":100,"assets.voice_max":80}}`。**`costs`** 是每个**当前可以用额度购买**的功能开关的单价（`creditCost` 非空、且该账号的生效值不是"不限"），没有配置价格或已不限的开关不出现；客户端靠它在花额度之前展示价格并判断余额够不够（客户端不写死任何价格）。**`totalEarned`、`totalSpent`** 是 `CreditBalance` 的同名字段（15.9 实体表）；**`todayEarned`** 是账号本地日（`User.timezone`，为空时按 UTC 日）内正的 `delta` 之和。照 dramaBox `GET /coin/balance`（`balance`、`totalEarned`、`totalSpent`、`todayEarned`）[核实 审计 行 48]。
- `GET /api/credits/ledger?before=&limit=`：`{"entries":[{"id":9,"delta":-100,"reason":"SPEND","spendKind":"FEATURE","featureKey":"assets.avatar_max","itemKey":null,"eventKey":null,"quantity":1,"createdAt":"..."}],"nextCursor":"..."}`（`reason` 还可取 `SUBSCRIPTION_GRANT`、`SPEND_REVERSED`；新建外观的流水 `spendKind=LOOK`、`featureKey` 为空，任务 ID 在 `eventKey`；`eventKey` 是 `CreditLedger.eventKey`，没有时为 `null`），按 `id` 倒序；`before` 是上一页返回的不透明 `nextCursor`，没有更多时 `nextCursor` 为 `null`；`limit` 默认 50、上限 100；`type`：`all`（默认）、`earn`（`delta` > 0）、`spend`（`delta` < 0，含退款扣回和负向调账），其他值 400 `INVALID_REQUEST`。不用页码翻页，因为插入新行会让页码翻页重复或漏行（理由同 25 章通知）；dramaBox 用页码和 `type=all|earn|spend` 筛选 [核实 审计 行 49]。
- `spend`：需要该开关有 `creditCost`、当前生效值不是"不限"（否则没有可买的），所需额度 = `creditCost × quantity`。**`expectedCreditPrice`**（必填，规则见 1.4"扣额度请求的价格核对"）是用户看到的总价，即 `GET /api/credits` 的 `costs` 里这个开关的单价乘以 `quantity`。**检查顺序**：幂等键查重 → 请求校验（含开关不可用额度购买或已不限的 400）→ 价格核对（409 `PRICE_CHANGED`，`data.creditPrice` 是此刻的 `creditCost × quantity`）→ 余额（402）→ 扣款，事务提交之后记 `credits_spent` 事件（7.3）。余额不足返回 402 `INSUFFICIENT_CREDITS`；开关不可用额度购买或已不限返回 400 `INVALID_REQUEST`。成功：写一条 `SPEND` 流水（`delta` 为负）、增加 `AccountFeatureBonus`，返回 `{"balance":200,"features":{...},"bonus":{...}}`（新余额、新的功能开关生效值——与 `GET /api/entitlements` 的 `features` 同形——和新的额外单位）。**幂等**：同一账号、同一个 `idempotencyKey` 再次到达（网络重试、响应丢失后的重发），**不再扣款，直接返回第一次的结果**（200，同样的 `balance`/`features`/`bonus`）；同一个键但 `featureKey` 或 `quantity` 与第一次不同返回 400 `INVALID_REQUEST`；已完成的键重发时带的 `expectedCreditPrice` 与第一次不同，也不比较、不返回 409（1.4）。客户端在网络类错误（含 5xx）后用同一个键重试，只有收到明确的业务错误才换新键。**键的保留期**：`CreditLedger` 对 `(accountId, idempotencyKey)` 有唯一约束且流水只追加，所以键与流水同寿命，**不会过期**，任何时候用同一个键重发都返回第一次的结果（不像 Stripe 那样 24 小时后清理）。因此客户端必须**一个用户意图一个键**：只有同一次兑换的重试才复用键，用户隔了很久、重新决定再兑换一次，必须用新键，否则会拿到旧的结果而没有真正兑换。客户端目前只在 24 小时内复用一个未得到明确回应的键，比服务端保留期短，是安全的。
- 两个 `verify` 的响应：`{"status":"CREDITED","balance":300}`；Google 购买还在待处理时返回 `{"status":"PENDING"}`（不入账）。

#### 购买入账

**入账事件**：任何一次入账（Google 第 4 步、Apple 第 4 步、`UNCLAIMED` 转 `CREDITED` 的认领、Apple 一次性购买的 `ONE_TIME_CHARGE` 路径）的事务提交之后，记一条 `credit_purchased` 事件（7.3）。

**并发与幂等的总原则**：`OneTimePurchase` 以 `(store, storeTransactionId)` 唯一，`verify` 与商店通知谁先到谁先创建记录，另一个发现已存在就按现有状态处理（已入账 = 成功），不会重复入账。

**Google**：
1. 购买时客户端把账号 ID 设为 obfuscated account ID（与 15.2 相同）。**客户端不得自己调用 `consumeAsync`**：一旦在后端入账之前被消耗，后端看到的就是"已消耗"的购买，无法自动入账（此时靠客服核实后用额度调账申请（`kind=GRANT`，走审核，见下文）补发，并写一条后台告警（`AdminAlert`，17.4））。
2. 客户端购买成功后调 `credits/google/verify`。后端调 `purchases.products.get` 取得 `orderId`，**先按 `(google, orderId)` 查 `OneTimePurchase`**：已存在且属于当前账号并已入账 → 直接返回成功（同时若 `consumedAt` 为空，触发消耗重试）；属于另一个账号 → 409 `PURCHASE_OWNED_BY_OTHER`；状态 `REFUNDED` → 400 `PURCHASE_VERIFY_FAILED`；墓碑（`tombstonedAt` 非空且 `creditedAt` 非空）→ 409 `PURCHASE_OWNED_BY_OTHER`；已存在且为 `UNCLAIMED`（`tombstonedAt` 为空，实时通知创建、等认领），或 `tombstonedAt` 非空而 `creditedAt` 为空（从未入账的锚点行）→ 按第 3 步的账号绑定规则判断，通过则对该行条件更新 `UNCLAIMED→CREDITED`（锚点行同时清空 `tombstonedAt`）、写 `PURCHASE` 流水并更新余额（同第 4 步），然后走第 5 步。
3. 不存在时才做校验：购买状态为已购买——**待处理（pending）的购买返回 `{"status":"PENDING"}`，不入账**，等类型 1 通知或客户端稍后再次 `verify`（Google 文档：只有转为已购买才发放）；已取消的、`quantity` 不是 1、商品不在 `CreditProduct` 里、包名不符、`consumptionState` 为已消耗（入账之前就被客户端消耗了，写后台告警，靠客服核实后用额度调账申请补发）的，都返回 400 `PURCHASE_VERIFY_FAILED`；校验项是：购买已完成、`quantity` 为 1、商品在 `CreditProduct` 里、包名相符、`consumptionState` 为未消耗。`obfuscatedExternalAccountId` 存在且与当前账号一致才入账，存在但指向仍存在的另一个账号 → 409，指向已不存在或正在删除（`DELETING`）的账号 → 绑定到当前账号（同 Apple），不存在则依据持有购买凭证绑定到当前账号。沙盒/测试购买按 `subscription.accept_sandbox` 处理（该配置同时适用于订阅和额度）。
4. 入账：在一个事务里创建 `OneTimePurchase`（`CREDITED`）、写 `PURCHASE` 流水（`eventKey` 为 `orderId`）、更新余额。
5. **入账之后**后端调 `purchases.products.consume`（Google 文档对有后端的应用推荐这样做，且用户消耗之后才能再次购买同一商品），成功后置 `consumedAt`。消耗失败不回滚入账，由重试任务（`retry.*`）继续；超过 `credits.unconsumed_alert_hours`（默认 24）仍未消耗的，在管理后台告警（Google 对未确认的购买 3 天后会自动退款并撤销）。
6. 实时通知 `oneTimeProductNotification`：类型 1（已购买）时后端用 `purchaseToken` 调 `get`，能通过 obfuscated ID 关联到账号的按第 3–5 步处理，不能关联的创建 `UNCLAIMED` 记录，等客户端 `verify` 认领；类型 2（待处理购买被取消）忽略并记事件。**这类通知需要在 Play Console 的实时通知主题设置里开启一次性商品事件**（见第十九节）。

**Apple**：
1. 购买时客户端设 `appAccountToken` 为账号 ID。
2. 客户端购买成功后调 `credits/apple/verify`。后端验 JWS，核对 `bundleId`、`environment`；交易的 `type` 必须是消耗型（Consumable），`productId` 在 `CreditProduct` 里，数量为 1；**交易带 `revocationDate`（已退款或被撤销）的拒绝**，返回 400 `PURCHASE_VERIFY_FAILED`。
3. 账号关联：`appAccountToken` 等于当前账号 → 绑定；交易没有 `appAccountToken` → 依据持有已签名的交易绑定到当前账号；`appAccountToken` 指向已删除、不存在或正在删除（`DELETING`）的账号 → 同样绑定到当前调用的账号（与 Google 第 3 步一致）；属于另一个仍存在的账号，或该 `transactionId` 的 `OneTimePurchase` 已属于另一个账号 → 409 `PURCHASE_OWNED_BY_OTHER`。该 `transactionId` 已有 `OneTimePurchase` 时：已入过账的墓碑（`tombstonedAt` 和 `creditedAt` 都非空）→ 409 `PURCHASE_OWNED_BY_OTHER`；状态 `REFUNDED` → 400 `PURCHASE_VERIFY_FAILED`；`UNCLAIMED` 或从未入账的锚点行（`tombstonedAt` 非空、`creditedAt` 为空）→ 按上面的绑定规则判断，通过则认领这一行（第 4 步更新它，不新建，锚点行同时清空 `tombstonedAt`）。
4. 创建 `OneTimePurchase`（`CREDITED`；第 3 步认领了已有的行时，改为条件更新那一行）、写 `PURCHASE` 流水（`eventKey` 为 `transactionId`）、更新余额，返回成功。
5. **后端返回成功之后，客户端才调 `Transaction.finish()`**（Apple 文档：交付了购买内容之后才 finish）。客户端有未完成（unfinished）的交易时再次上送 `verify`，靠上面的幂等不会重复入账。
6. **`ONE_TIME_CHARGE` 通知**（Apple 文档：用户购买消耗型、非消耗型或非续订订阅时的通知类型，**每一次购买都会收到**；兑换这些商品的优惠码时同样是这个类型，可通过负载里的优惠信息区分）：先按交易的 `type` 分类（15.4）。属于消耗型且 `productId` 在 `CreditProduct` 里的：按 `appAccountToken` 找账号，找到就按第 4 步入账；**没有 `appAccountToken`**（例如在 App Store 里而不是在应用内兑换优惠码）→ 创建 `UNCLAIMED` 记录，等客户端 `verify` 认领，认领时同样按第 3 步的规则。**有 `appAccountToken`，但它指向的账号已删除、不存在或正在删除**（`DELETING` 也算）→ 不入账、不写额度流水，建一行从未入账的锚点行（`accountId` 空、`tombstonedAt` 为当前时间、`state=UNCLAIMED`、`creditedAt` 空，保留 `deletion.tombstone_retention_days` 天）。之后的 `verify` 来自能入账的账号时可以认领它（第 3 步的绑定规则），入账给调用者，结果与 `verify` 先到时相同；已入过账的购买转成的墓碑不可认领（见 `OneTimePurchase` 的说明）。通知本身不入账，没有人认领的购买需要退款时走商店。

#### 退款

`OneTimePurchase.state` 决定退款怎么处理，下面每一步都是幂等的：

| 事件 | 当前状态 | 处理 |
|------|----------|------|
| 退款（Apple `REFUND`、Google 作废通知） | `CREDITED` | 写 `REFUND` 流水（`delta = -credits`），状态 → `REFUNDED` |
| 同上 | `UNCLAIMED`（从未入账） | 状态 → `REFUNDED`，不写流水（先退款锚点）；之后这笔购买的 `verify` 一律拒绝，用户不会拿到已退款的额度 |
| 同上 | `REFUNDED` | 重复事件，忽略 |
| Apple `REFUND_REVERSED` | `REFUNDED` 且已入账过 | 写 `REFUND_REVERSED` 流水（`delta = +credits`），状态 → `CREDITED` |
| 同上 | `REFUNDED` 但从未入账过 | 状态 → `UNCLAIMED`（允许之后认领） |
| Apple `REFUND_REVERSED` | `CREDITED` 或 `UNCLAIMED` | 通知乱序（撤销先于退款到达）：忽略并只记事件；之后到达的退款按该交易的 `REFUND` 事件正常处理 |

这样"退款、撤销退款、再退款"的顺序也能正确处理，因为每次退款事件用它自己的事件 ID 做流水的唯一键。

- **Apple**：消耗型商品的 `REFUND`、`REFUND_REVERSED` 见 15.4；`REFUND_REVERSED` 适用于所有内购类型，Apple 要求恢复被撤销的内容或服务。
- **Google**：`voidedPurchaseNotification` 且 `productType` 为一次性商品，按 `orderId` 找到 `OneTimePurchase`。对账任务用 `purchases.voidedpurchases.list` 补漏收的通知（15.7）。Google 文档没有"作废被撤销"的通知类型，所以没有对应的恢复。
- **产品决定（用户已确认；商店文档没有规定已花掉的额度遇到退款怎么办，竞品也没有出处，这不是业界做法）**：**整笔额度全部扣回**，不管其中已经花掉多少；**余额允许为负**；**余额为负时不能消费**（`spend` 的条件是余额不小于所需额度，负数自然满足不了）；用户之后购买新额度时，入账的额度**直接抵扣负数**——余额本来就是流水求和，负数只是总和为负，不需要单独的欠款表。已经购买的额外槽位（`AccountFeatureBonus`）不回收。这意味着"买了额度、买槽位、再退款"之后槽位仍会保留，负余额是唯一的追回手段。

#### 不过期与恢复

- Apple 3.1.1 原文："通过应用内购买获得的额度或游戏内货币不得过期，并且要对任何可恢复的内购提供恢复机制"。所以额度**永不过期**；恢复机制 = 余额存在服务端，换设备、重装、重新登录同一账号即可看到；未完成的交易靠上面的 `verify` 幂等补入账。
- 管理员发放的额度同样不过期。

#### 管理后台

- 额度包配置（`CreditProduct` 增改查、是否在售），权限 `SUBSCRIPTION:CONFIG`。
- **手动发放和调整走"申请 → 审核"，不直接写流水**（依据：dramaBox 的金币手动调账同样是申请人提交、审核人通过或驳回，驳回必须写原因 [子代理读码 dramaBox-admin `src/pages/wallet/wallet-coin-adjust-request`]；该页面不比较申请人与审核人，本项目由后端强制）。`CreditAdjustRequest(id, accountId, kind(GRANT/ADJUST), delta, reason, status(PENDING/APPROVED/REJECTED), applicantAdminId, reviewerAdminId, reviewNote, ledgerId(可空), createdAt, reviewedAt)`：
  - `POST /credit-adjust-requests`（`SUBSCRIPTION:GRANT`）：`kind=GRANT` 时 `delta` 必须为正，对应流水 `reason=ADMIN_GRANT`；`kind=ADJUST` 时 `delta` 可正可负，可使余额为负，用于纠错和补扣，对应 `reason=ADMIN_ADJUST`。
  - `POST /credit-adjust-requests/{id}/approve`、`/reject`（`CREDIT:REVIEW`）：申请人 ID 等于审核人 ID 返回 403 `SELF_REVIEW_FORBIDDEN`；只有 `PENDING` 的申请可以审核（条件更新，重复审核返回 409 `INVALID_STATE`，`data.status` 是当前状态，不重复写流水）；驳回必须带 `note`。通过时在**同一个事务**里写 `CreditLedger`（`eventKey` 取申请 ID，保证幂等）并更新 `CreditBalance`，把 `ledgerId` 写回申请。
  - 申请、通过、驳回都写审计日志。账号处于 `PENDING_DELETION` 或 `DELETING` 时，**创建申请和通过申请**都返回 403 `ACCOUNT_DELETION_SCHEDULED` 或 `ACCOUNT_DELETING`（1.4）；账号不存在 404 `RESOURCE_NOT_FOUND`；已创建的申请在账号进入这两个状态后仍是 `PENDING` 时，由通过时的检查拦下，账号删除时随 `CreditAdjustRequest` 删除（13.1）。
  - `GET /credit-adjust-requests`、`GET /accounts/{id}/credits`（余额与流水）权限 `SUBSCRIPTION:VIEW`。
  - `GET /credits/accounts?accountId=&balanceMin=&balanceMax=&page=&pageSize=`：全部有额度账户的账号，列 `accountId`、`balance`、`totalEarned`、`totalSpent`、`updatedAt`；`accountId` 精确匹配，余额范围可只填一端；按 `updatedAt` 倒序；`pageSize` 默认 20、上限 200。权限 `SUBSCRIPTION:VIEW`。
  - `GET /credits/transactions?accountId=&reason=&type=&from=&to=&page=&pageSize=`：全部账号的额度流水，列 `id`、`accountId`、`delta`、`reason`、`spendKind`、`featureKey`、`itemKey`、`quantity`、`eventKey`、`note`、`createdAt`；`accountId` 精确匹配，`reason` 取流水原因枚举，`type` 取 `earn`、`spend`（定义同 `GET /api/credits/ledger`），`from`、`to` 按 `createdAt`；按 `id` 倒序；分页同上。权限 `SUBSCRIPTION:VIEW`。依据：dramaBox-admin 的 `GET /wallet/wallet-coin-account`、`GET /wallet/wallet-coin-transaction` [核实 审计 行 62]。
- 统计（`FINANCE:VIEW`）：按商品的额度包销量、退款扣回量；沙盒不计入。

#### 账号删除

删除账号时删除 `CreditLedger`、`CreditBalance`、`AccountFeatureBonus` 中该账号的行（第十三节步骤 6）；`OneTimePurchase` 中 `accountId` 是该账号的行**转为墓碑**（`accountId` 置空、`tombstonedAt` 置当前时间，保留 `deletion.tombstone_retention_days` 天），不删除。`accountId` 为空的 `UNCLAIMED` 记录不含个人信息，保留。墓碑、锚点行和 `UNCLAIMED` 只含商店交易号、商品和额度数，不含账号；墓碑到期（`deletion.tombstone_retention_days`）之后，持有旧交易的人用 `verify` 重放，且交易的 `appAccountToken` 指向已删账号时可以入账给当前账号（15.9 的绑定规则）——这个窗口接受，保留期要大于商店重发通知和对账补漏的时间窗；隐私政策要写明这一保留（26.2）。

### 15.10 新增渠道

接哪些渠道（除 Apple、Google 之外是否还有别的）和怎么实现，都还没定。本文档只保证**内部模型不绑定渠道**，将来增加渠道不需要改模型：

- `Subscription.store`、`SubscriptionProduct.store`、`CreditProduct.store`、`SubscriptionEvent.store`、`OneTimePurchase.store` 是渠道标识，目前取 `APPLE`、`GOOGLE`，是可扩展的枚举，不是写死的两个值。
- 渠道适配器的职责：验证通知或购买凭证的真实性；找到对应账号；给出去重用的事件 ID；把渠道自己的状态映射到 15.4 的内部状态，或映射成 15.9 的入账与扣回。适配器之外的订阅、权益、事件、额度和管理后台都不感知渠道。
- 新增渠道时的通知类型、状态映射、账号关联方式、退款处理，以及平台对购买入口的限制，由那时选定的渠道决定，本文档不预设。

---

## 十六、记忆服务集成（AvatarMemory）

依据：AvatarMemory 设计文档「Tiered configuration」「Embedding model registry」两节，以及 `app/routers/admin.py`、`app/routers/accounts.py` 的已实现接口。AvatarMemory 有**两把不同的密钥**：`AVATARMEMORY_API_KEY`（App 后端接口面）和 `AVATARMEMORY_ADMIN_KEY`（管理接口面，改档位配置会影响该档位的所有账号，所以单独授权）。本后端两把都持有，环境配置见 1.5。

### 16.1 Java 调用 AvatarMemory 的全部场景

| 场景 | 接口 | 密钥 | 触发 |
|------|------|------|------|
| 账号删除 | 13.2 的清除接口 | API | 用户删除账号 |
| 数据导出 | 13.2 的导出接口 | API | 用户导出数据 |
| 档位指派 | `PUT /v1/accounts/{id}/tier` | API | 账号 `memory.tier` 生效值变化（15.6） |
| embedding 模型指派 | `PUT /v1/accounts/{id}/embedding-model` | API | 技术人员在管理后台手动指派（16.3） |
| 档位配置读写 | `GET/PUT /v1/admin/tiers[/{name}]` | ADMIN | 技术人员在管理后台操作（16.2） |
| embedding 模型读取与注册 | `GET /v1/admin/embedding-models`、`PUT /v1/admin/embedding-models/{name}` | ADMIN | 技术人员在管理后台操作（16.3） |

除此之外没有调用关系：检索与写入记忆是 AvatarAgent 的事。AvatarMemory 不可用时不影响账号、会话、聊天的任何功能。

**错误映射**（AvatarMemory 的响应 → 本后端管理接口的响应）：422（请求体不合法）→ 400 `INVALID_REQUEST`，带上它的 `detail`；409（模型维度冲突）→ 409 `MEMORY_MODEL_CONFLICT`；404 → 404 `RESOURCE_NOT_FOUND`（`message` 写明是档位还是模型）；网络错误、超时、5xx、401（密钥被拒）→ 502 `MEMORY_SERVICE_ERROR`。档位同步任务遇到 404 的处理见 15.6。**调用与落库的先后**：管理后台的写接口（注册模型、更新档位、指派模型）先调 AvatarMemory，成功后才写本后端的记录（`AccountEmbeddingAssignment`、审计日志）；调用失败不写记录。AvatarMemory 已成功而本后端落库失败，返回 500 并记日志，重复同一个操作是幂等的（两个 `PUT` 都是幂等写入）。账号级的档位同步相反：先把 `AccountMemoryTier` 写成 `PENDING` 再调用（15.6），因为它是后台重试任务。

**名称规则**：档位名和 embedding 模型名由本后端校验为 `^[A-Za-z0-9_-]{1,64}$`（AvatarMemory 的路径参数没有格式限制 [核实 AvatarMemory `app/routers/admin.py`、`accounts.py`，2026-10-08]，名字进了 URL 路径，所以限制字符集），保存 `memory.tier`、`PUT /memory/tiers/{name}`、注册模型时都校验，不合格 400 `INVALID_REQUEST`。**同步锁**：档位同步任务和账号删除的第 1 步用同一个 Redis 锁 `memory_sync:{accountId}` 互斥（13.1、15.6）。

**字段命名**：本后端的管理接口一律 camelCase，转发给 AvatarMemory 时转成它的 snake_case：`topK`→`top_k`、`recencyChannelEnabled`→`recency_channel_enabled`、`recencyChannelCount`→`recency_channel_count`、`consolidationEnabled`→`consolidation_enabled`、`consolidationThreshold`→`consolidation_threshold`、`teiBaseUrl`→`tei_base_url`、`tierName`→`tier_name`、`modelName`→`model_name`。取值范围来自 AvatarMemory 的 `tiers.py`：`top_k` 1–100、`recency_channel_count` 0–100、`consolidation_threshold` 1–100000；类型严格（不接受字符串形式的数字），不接受额外字段和显式 null。

### 16.2 档位配置

档位是一组运行参数（AvatarMemory 设计文档）：`top_k`、`recency_channel_enabled`、`recency_channel_count`、`consolidation_enabled`、`consolidation_threshold`。账号没有指派时用 `default` 档。**哪个档位给哪些账号，由 `memory.tier` 功能开关决定（15.3），档位本身的内容在这里配置。**

管理后台（`/api/admin/memory/...`，权限见第十七节）：

- `GET /memory/tiers`、`GET /memory/tiers/{name}`：读取，权限 `MEMORY:VIEW`；列表响应 `{"items":[{"tierName","topK","recencyChannelEnabled","recencyChannelCount","consolidationEnabled","consolidationThreshold"}]}`。
- `PUT /memory/tiers/{name}`：请求体是档位配置 JSON（camelCase，见 16.1），未给出的字段保持原值（AvatarMemory 的合并语义）。权限 `MEMORY:TIER_CONFIG`，写审计日志。**页面必须提示：修改会立即影响该档位下所有账号。** **名字不存在时这个接口会新建档位**，新档位未给出的字段取自 `default` 档（AvatarMemory 的 `upsert_tier`），并且 AvatarMemory 没有删除档位的接口。所以名字不在 `GET /memory/tiers` 列表里时，页面必须先弹出确认（"将新建档位 X"），防止手误造成永久多余的档位；这也是运营创建 `premium` 等新档位的方式。
- `memory.tier` 的值必须是 AvatarMemory 里已存在的档位。管理后台保存**任何会写入 `memory.tier` 的配置**时都校验：权益的 `EntitlementFeature`，以及 `PUT /feature-gates/memory.tier/default`（免费用户的档位）。校验方式是 `GET /v1/admin/tiers/{name}`，不存在返回 `INVALID_REQUEST`。默认值指向不存在的档位会让所有账号的同步都返回 404。
- **不提供手动给单个账号指派档位**。档位由权益自动决定，手动改会在下次同步时被覆盖；要给某个账号更高档位，用管理员发放限时权益（第十七节）。

### 16.3 embedding 模型

账号没有指派记录时用 `bge-m3`（当前唯一注册的模型）。模型的注册与账号的指派都是技术人员的判断，**后端没有任何自动指派规则**：文档里没有模型与语言的映射，也不需要（目前只有一个模型）。

管理后台：

- `GET /memory/embedding-models`：已注册模型列表，权限 `MEMORY:VIEW`，响应 `{"items":[{"modelName","teiBaseUrl","dimensions"}]}`。
- `PUT /memory/embedding-models/{name}`：注册模型，请求体 `{"teiBaseUrl":"...","dimensions":1024}`，权限 `MEMORY:MODEL_REGISTER`（仅技术角色），写审计日志。**页面必须提示：先把 TEI 容器启动好再注册。** 请求体校验：`teiBaseUrl` 必须是 http 或 https 的绝对地址、不含用户信息，主机在配置 `memory.tei_allowed_hosts` 的白名单内（防止被指到任意内网地址），`dimensions` 是 1 到 8192 的整数，不合格 400 `INVALID_REQUEST`。同名模型已注册但维度不同时，AvatarMemory 返回 409（其向量表已按原维度创建，必须换一个新名字），本后端返回 409 `MEMORY_MODEL_CONFLICT`，原样展示其 `detail`。
- `PUT /accounts/{id}/memory/embedding-model`：请求体 `{"modelName":"..."}`，把账号指到某个已注册模型，权限 `MEMORY:MODEL_ASSIGN`（仅技术角色），写审计日志，并记一条 `AccountEmbeddingAssignment`。**页面必须警告：** AvatarMemory 设计文档写明切换只影响之后的新写入，不会为已有历史重新计算向量；每个模型有自己独立的向量表，检索按账号当前模型走，所以切换后旧记忆大概率检索不到，直到人工做数据迁移 [推断：来自设计文档两句话，未实测]。
- `GET /accounts/{id}/memory`：该账号当前的档位指派（`AccountMemoryTier`：档位名、同步状态、最近一次同步时间和错误，只有当前一行，没有档位历史）和 embedding 模型指派历史（`AccountEmbeddingAssignment`，每次手动指派一条）；响应 `{"tier":{"tierName","syncStatus","assignedAt","lastError"},"embeddingAssignments":[{"modelName","assignedBy","assignedAt"}]}`，“最近一次同步时间”就是 `tier.assignedAt`（档位同步成功或确认已相同时都写它）；AvatarMemory 没有查询账号档位或模型的接口，所以由本后端自己记录。权限 `MEMORY:VIEW`。账号不存在 404 `RESOURCE_NOT_FOUND`。

### 16.4 不做的事

- 不提供记忆内容的浏览、编辑（管理端和用户侧都不做）。用户侧记忆管理（像 Replika、ChatGPT 那样让用户查看和删除单条记忆）是产品范围，已决定暂不做，AvatarMemory 也没有对应的接口。
- 账号数据的合规访问与删除由 13.2 的导出、清除接口覆盖。

### 16.5 数据

| 实体 | 关键字段 | 说明 |
|------|---------|------|
| `AccountMemoryTier` | accountId, tierName(可空，空表示从未指派，按 `default` 比较), syncStatus(`PENDING`/`SYNCED`/`FAILED`), targetVersion(每次 `memory.tier` 生效值可能变化时加一，15.6), attempts, nextAttemptAt(可空), lastError, assignedAt(可空) | 本后端最近一次向 AvatarMemory 指派的档位；`SYNCED` 表示 AvatarMemory 已确认 |
| `AccountEmbeddingAssignment` | id, accountId, modelName, assignedBy(管理员 ID), assignedAt | 每次手动指派一条 |

---

## 十七、管理后台（admin 模块）

依据：主设计文档第 16 节（核实自 `dramaBox` 的后端模块结构和 `dramaBox-admin` 的真实配置）。本节是后端 admin 模块的接口、权限和统计汇总层的设计；管理后台**前端**（Ant Design Pro + Umi Max，参照 `dramaBox-admin`）的页面设计在 `docs/admin-frontend-design.md`，两份文档一起设计：前端每个统计页要的指标，在本节有对应的汇总表和接口（17.6），本节没有的接口前端不假设它存在。

### 17.1 模块与分层

- 后端按模块拆分：`app`（面向客户端的接口，即本文前面各节）、`admin`（面向管理后台，镜像相同的功能域）、`common`（只放数据库、缓存、消息队列这类基础设施，不放业务逻辑）。
- 分层：Controller → Facade → Service/Mapper → Entity，按功能域分包（user、push、event、invite、attribution、moderation、support、config、monitor、admin 自身）。
- Facade 层做跨领域编排；**Service 不允许直接调用另一个领域的 Service**，跨领域必须经过 Facade，防止隐性耦合。

### 17.2 管理员认证

- 独立的 `AdminUser` 账号体系，与用户账号完全分开：`POST /api/admin/auth/login`（用户名 + 密码 + 二次验证码，见本节「二次验证」）返回管理员 JWT，成功响应的 `data` 是 `{"token":"<管理员 JWT>","expiresAt":"<ISO-8601 UTC>"}`（`totp/enroll` 成功同形）。管理员 JWT 使用**独立的签名密钥和 audience**，用户 JWT 不能访问 `/api/admin/**`，管理员 JWT 也不能访问用户接口。有效期 `admin.jwt_ttl_hours`（默认 8）。
- 第一个超级管理员没有人能创建它，由部署时的环境变量（用户名、初始密码）在数据库里没有任何管理员时创建，创建后要求首次登录改密码。
- `GET /api/admin/me` 返回 `{"id","username","superAdmin","mustChangePassword","passwordMinLength","permissions":["USER:VIEW",…]}`（`id` 是管理员 ID，字符串，额度调账页据此对自己提交的申请禁用“审核”，后端仍返回 403 `SELF_REVIEW_FORBIDDEN`；`passwordMinLength` 是 `admin.password_min_length` 的当前值，整数——强制改密码的管理员只能调 `me` 和改密码，所以密码长度放在 `me` 里），前端据此渲染菜单（`superAdmin=true` 返回全部内置权限码，不含自定义节点；普通管理员返回其全部角色的权限码并集）；`POST /api/admin/auth/change-password`（请求体 `{oldPassword,newPassword}`）改密码，成功后该管理员已签发的令牌全部失效（`tokenVersion` 加一），不返回新令牌，前端回登录页重新登录。`mustChangePassword` 为 true 时只允许调用这两个接口，其余返回 403 `ADMIN_FORBIDDEN`。管理员登录失败返回 401 `ADMIN_INVALID_CREDENTIALS`。
- **所有写操作和所有查看用户上传内容（形象、声音原始文件，以及生成的标准图和动作片段）的操作**都写一条 `AdminAuditLog`（管理员 ID、动作、对象类型、对象 ID、详情、时间），管理后台的"系统管理"里可查（`AUDIT:VIEW`）。
- 对管理后台接口做限流（`admin.rate_limit_per_min`，按管理员 ID）。
- **登录限流**：登录接口按"IP + 用户名"限流，`ratelimit.admin_login_per_min`，超出返回 429 `RATE_LIMITED`。依据：dramaBox 的管理端登录接口没有限流，它的 `HandlerInterceptor` 限流器只在 `app` 模块 [子代理读码 dramaBox `admin/.../AdminAuthController`]，不照搬。
- **密码规则**：管理员密码至少 `admin.password_min_length`（默认 12）个字符；不得与用户名相同。只存哈希（bcrypt 或 Argon2），**浏览器端不做任何哈希，密码走 HTTPS 明文提交**（dramaBox 在浏览器里做无盐 MD5，不照搬）。
- **二次验证（TOTP，所有管理员强制）**：RFC 6238，6 位数字、30 秒步长、验证时允许前后各一个步长。依据：管理员能查看用户上传的形象和声音原始文件、封禁账号、修改订阅配置，泄露一个账号的后果重；dramaBox 的管理端同样用 TOTP [子代理读码 dramaBox `AdminAuthController`]。
  - **登录**：`{username, password, totp?}`。账号或密码错误 → 401 `ADMIN_INVALID_CREDENTIALS`；`AdminUser.status=DISABLED` 的管理员，密码正确也返回同一个 401 `ADMIN_INVALID_CREDENTIALS`（不区分停用和密码错误，先校验密码，用户名不存在或已停用时同样做一次假哈希，响应时间一致），并写一条失败登录的应用日志（用户名只记哈希；不写 `AdminAuditLog`，它的 `adminId` 必填，用户名不存在时没有管理员 ID）。已发出的管理员令牌在下一次请求时按 `tokenVersion` 和 `status` 被拒（401 `ADMIN_INVALID_TOKEN`）。账号密码正确、已绑定、但没带 `totp` → 401 `ADMIN_TOTP_REQUIRED`（前端据此显示验证码输入框）；验证码错误、已被用过 → 401 `ADMIN_TOTP_INVALID`（每个管理员记录最近一次通过验证的步长 `AdminUser.totpLastStep`，步长不大于它的验证码一律拒绝，防重放）。
  - **首次绑定**：账号密码正确、尚未绑定时，登录返回 200 `{"status":"ENROLL_REQUIRED","enrollToken":"...","otpauthUri":"otpauth://totp/..."}`（`enrollToken` 一次性、有效期 `admin.totp_enroll_ttl_minutes`；存 Redis，键 `admin_totp_enroll:{enrollToken 的哈希}`，值是管理员 ID 和待确认的 TOTP 密钥（用 `ADMIN_TOTP_ENC_KEY` 加密），TTL 同有效期，不进数据库）；前端用 `otpauthUri` 显示二维码，管理员在认证器里扫码后用 `POST /api/admin/auth/totp/enroll {enrollToken, totp}` 提交第一个验证码，通过后返回管理员 JWT：`AdminUser.totpSecretEnc` 在验证码通过时才写入，同时写 `totpEnrolledAt`，`totpEnrolledAt` 为空就是未绑定；`enrollToken` 无效、过期、已用 → 401 `ADMIN_INVALID_TOKEN`，验证码错 → 401 `ADMIN_TOTP_INVALID`（令牌不作废，错误计入同一个 `admin.totp_max_failures` 计数，超过后令牌作废）；`enroll` 成功时把该验证码的步长写入 `totpLastStep`（防止立即在登录里重放）；每次签发管理员 JWT（登录或 `enroll` 成功）时更新 `AdminUser.lastLoginAt`。
  - **存储**：密钥用 AES-256-GCM 加密后存 `AdminUser.totpSecretEnc`，加密密钥只来自环境变量 `ADMIN_TOTP_ENC_KEY`，不进配置文件和代码仓库（dramaBox 明文存密钥且凭据提交进了仓库，不照搬）。
  - **爆破防护**：同一用户名连续 `admin.totp_max_failures` 次验证码错误，`admin.totp_lockout_minutes` 分钟内拒绝该用户名的登录（429 `RATE_LIMITED`）。
  - **重置**：`POST /admins/{id}/reset-totp`（`ADMIN:MANAGE`，17.4）清除密钥，该管理员下次登录重新绑定（同时清 `totpEnrolledAt`、`totpLastStep`，并把 `tokenVersion` 加一，已发出的令牌立即失效）。第一个超级管理员（环境变量创建）也必须绑定。
  - 配置项 `admin.totp_required` 默认 `true`；设为 `false` 只允许在非生产环境，生产环境启动时发现为 `false` 则拒绝启动。**不按 Spring profile 名称跳过验证**（dramaBox 用 `demo, dev, test, local` 名单跳过，部署时 profile 配错就等于没有二次验证）。
- **访问来源**：管理后台网页和 `/api/admin/**` 部署在同一个域名下，由反向代理（网关）转发 `/api` 前缀，**不使用 CORS 白名单机制**（项目约定）；令牌放 `Authorization: Bearer` 头，不放 Cookie，不拼进 URL。
- **令牌失效**：管理员被停用、密码被重置、二次验证被重置后，该管理员已签发的令牌立即失效（令牌里带 `AdminUser.tokenVersion`，不等于库里的值就拒绝，返回 401 `ADMIN_INVALID_TOKEN`）；改密码同理。dramaBox 用 Redis 版本号实现"每次登录踢掉旧令牌"，本项目只在这几种操作时作废，允许同一管理员同时多处登录 [推断：设计选择]。

### 17.3 RBAC

管理员 - 角色 - 权限三层：`AdminUser` 通过 `AdminUserRole` 挂角色，`AdminRole` 通过 `AdminRolePermission` 挂权限码（层级式字符串，如 `USER:VIEW`）。`AdminUser.superAdmin=true` 跳过所有权限检查。每个管理接口声明所需权限码，缺少则返回 403。权限码与菜单一一对应，新增管理功能就新增权限码。

- **权限树可以在后台编辑**（用户 2026-10-05 的决定：管理系统的权限必须可配置；dramaBox 也有权限树管理页，`/permission` 的增删改和角色授权 [子代理读码 dramaBox 笔记 `_scratch_dramabox_admin_system.md`]）。`AdminPermission` 表（18）每个节点有 `code`（唯一）、`parent`、`type`（`MENU` 或 `FUNCTION`）、`sortOrder`、`nameZh`、`nameEn`、`builtin`。**内置节点**由代码里声明的权限码（枚举或常量）在每次启动时同步进表（每个节点的 `parent`、`type`、`sortOrder`、默认中英文名以 `docs/admin-frontend-design.md` 的“模块 | 页面 | 权限 | 接口”表为准：每个页面对应一个 `MENU` 节点，该页面的接口权限码是它的 `FUNCTION` 子节点；代码里的常量按那份表逐条写）：新增的码插入（名称和排序取代码里的默认值，`builtin=true`），已存在的码**不覆盖**后台改过的名称和排序；代码里不再声明的内置码从表里删除并清理对应的授权，写一条警告日志。**接口和页面只检查代码里声明的内置码**，所以：内置节点可以改名称（`nameZh`、`nameEn`）和排序，**不能改 `code`、`parent`，不能删除**（改了就和代码里的检查对不上，dramaBox 靠约 19 个 SQL 脚本手工维护权限树，反复出现过错码和孤儿节点 [子代理读码 dramaBox `sql/migrate-*.sql`、`sql/fix-sms-permission-parent.sql`、`docs/sql/patch_admin_user_domain_permissions_fix.sql`]，这里把这类改动限制在代码和迁移里）；**自定义节点**可以新增、改名、调整父节点和排序、删除（有子节点时返回 409 `PERMISSION_HAS_CHILDREN`，删除时同时清理角色授权）。自定义节点能分配给角色，用来给权限分组，或者为之后新增的页面预留；它们对现有接口没有效力。接口：`GET /permissions`（`[{code,parent,type,sortOrder,nameZh,nameEn,builtin}]`，`parent` 为空表示根）、`POST /permissions`、`PUT /permissions/{code}`、`DELETE /permissions/{code}`。写操作需要 `PERMISSION:MANAGE`，读取需要 `ROLE:MANAGE` 或 `PERMISSION:MANAGE`；写操作写审计日志，并使权限缓存失效。
- **权限不放进 JWT**：令牌里只有管理员 ID，每次请求按管理员 → 角色 → 权限码加载（进程内缓存 `admin.permission_cache_seconds`，角色权限改动后主动失效缓存）。依据：dramaBox 把角色放进令牌，角色的权限码每次请求从库里读，所以改角色的权限马上生效，但给管理员换角色要等重新登录 [子代理读码 dramaBox `AdminJwtService`、`AdminJwtAuthFilter`]；本项目的管理员有多个角色，角色集合也每次读取，换角色同样马上生效。
- 管理端不设置只读账号，建角色时每个模块的查看权限和该模块的操作权限一起授予。
- 权限码精确匹配，没有父子继承；给角色分配权限时，前端勾选父节点会同时勾选全部子节点，保存的是完整的码列表。
- 删除角色：仍分配给管理员时返回 409 `ROLE_IN_USE`；删除时同时删除该角色的权限分配行（dramaBox 删除角色不清理，会留下悬空的授权 [子代理读码 dramaBox `AdminRoleController`]）。
- **权限不按平台或产品限定范围**：AvatarApp 只有一个产品，Android 和 iOS 只是统计的筛选维度（17.6），不是权限维度；一个角色看到的是全部平台的数据。需要把某个角色限定到某个平台时，这一条要重新设计。

### 17.4 各模块的接口

所有接口在 `/api/admin` 下。列表接口统一用 `page`（**从 1 开始**，缺省 1）、`pageSize`（缺省 20、上限 200）分页，`page` 小于 1、`pageSize` 小于 1 或大于 200、不是整数，一律 400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"<参数名>","reason":"OUT_OF_RANGE"}]`（不是整数时 `reason` 为 `NOT_AN_INTEGER`），不静默截断，响应 `{"items":[...],"total":N}`，没有特别写明排序的一律按创建时间倒序（时间相同按 `id` 倒序）。响应字段、管理员用户名、图片地址、字段长度单位和下拉选项来源接口的读取权限，见本节后面的“17.4 附：通则与响应字段表”（那里点名的字段就是全部字段）。**逐接口权限**：模块行里没有逐条标注的接口，读取（GET）用该模块的 `*:VIEW`（没有 `VIEW` 码的模块用它唯一的码），写入用该模块的写权限码；推送：模板和图片上传 `PUSH:TEMPLATE`，任务和周期推送 `PUSH:SEND`，记录查看 `PUSH:VIEW`；埋点：漏斗和明细读取 `ANALYTICS:VIEW`，已保存漏斗的写 `ANALYTICS:FUNNEL_MANAGE`；客服 `retry` `SUPPORT:MANAGE`；用户读接口 `USER:VIEW`。后台设计文档里的 `/analytics/summary` 等是前端页面路由，不是接口路径，接口路径以本节为准。**后台接口的通用错误规则**：路径或请求里的 ID 找不到对象，且该对象没有专用错误码（如用户接口里的 `ASSET_NOT_FOUND`、`EXPORT_NOT_FOUND`、`SESSION_NOT_FOUND`（设备列表里的登录链）和公开接口里的 `CAMPAIGN_NOT_FOUND`；后台接口找不到一律 `RESOURCE_NOT_FOUND`，包括 `/attribution/campaigns/{id}`（后台要能找到并启用已停用的投放账户）和 `GET /sessions/{id}`）时，统一返回 404 `RESOURCE_NOT_FOUND`；对象当前状态不允许这个操作（编辑已结束的计划、重复审核、删除不是草稿的对象、对终态再次转换等），统一返回 409 `INVALID_STATE`（`data.status` 是当前状态）；各节写“不允许”“不能编辑”而没有写状态码的，都按这两条。**现查类统计**（邀请统计、订阅与额度统计）来自会随账号删除而减少的原始表（`InviteRecord`、`SubscriptionEvent`、`CreditLedger` 在 13.1 步骤表第 6 步被删；归因汇总里有账号的 `AttributionRecord` 行同样消失；审核统计不受影响，`ModerationRecord` 删号后保留），账号删除后它们的历史值会下降，口径说明里要写明；要保留历史值的指标走汇总表（17.6）。**时间约定：时刻（instant）一律是 ISO-8601 UTC 字符串；统计接口的日期参数和 `statDate` 是 `YYYY-MM-DD`，按 UTC 日历日（17.6；签到、任务两类统计例外，用账号本地日）。** 管理后台前端的页面、字段、按页面的权限见 `docs/admin-frontend-design.md`，那份文档的每个页面都回指到这里的接口；这里没有的接口，那份文档不会假设它存在。

| 模块 | 权限码 | 接口 |
|------|--------|------|
| 用户管理 | `USER:VIEW`、`USER:EMAIL_VIEW`、`USER:PHONE_VIEW`、`USER:BAN`、`USER:DELETION`、`USER:EXPORT` | `GET /users`（按账号 ID、邮箱、状态、注册渠道（`User.channelCode`）、流量类型（`PAID`：账号 `installTime` 最早的那条安装类 `AttributionRecord`（账号有多行时只看它；用户详情的归因字段同样取这一条）的 `mediaSource` 非空（“安装类”指 `source=SELF` 的行，以及 `source=APPSFLYER` 且 `eventName` 为安装的行；`APPSFLYER` 安装事件的 `eventName` 取值 10.1 核实前标 [推断]）、忽略大小写后不等于 `organic`；`ORGANIC`：其余。AppsFlyer 用 `Organic` 表示自然流量 [推断，未在本契约里核对]）、媒体来源（`AttributionRecord.mediaSource`）筛选）；`GET /users/export?<与 /users 相同的筛选>`（需要 `USER:EXPORT`，并且需要 `USER:VIEW`（缺任何一个 → 403 `ADMIN_FORBIDDEN`），导出 `.xlsx`，其余规则同 `GET /sms/records/export`：行数不超过 `export.max_rows`、每个管理员每小时 `ratelimit.export_per_admin_per_hour` 次、表头随 `Accept-Language`、每次导出写审计日志；邮箱和手机号按 `USER:EMAIL_VIEW`、`USER:PHONE_VIEW` 掩码，不含 IP、内容和资产；依据：dramaBox 有 `DRAMA:USER:EXPORT` [核实 审计 D5]）；`GET /users/{id}`（资料（含伴侣名字 `companionName`）、状态、封禁原因、养成数据、资产数量、外观数量与拥有的服装（服装的赠送接口见下面的"形象与装扮"行）、归因：取该账号的 `AttributionRecord`，含 `source`、`matchType`、`mediaSource`、`campaign`、`installTime`、`registeredAt`；依据：dramaBox 详情返回渠道名和归因 [核实 审计 D9]）；`GET /accounts/{id}/avatars`（只读，`USER:VIEW`：该账号的形象及其外观（形象名字、风格、状态、预览图、创建时间）和拥有的服装；预览图是用户的脸，按 17.2 写审计日志）；`GET /users/{id}/sessions`（会话记录，含起止时间和时长）；`GET /users/{id}/devices`（推送 token 的平台、App 版本、最近活跃时间，token 值只显示末 6 位）；`POST /users/{id}/ban {reason}`（`USER:BAN`；`reason` 必填，去掉首尾空白后 1 到 500 个字符，是写给用户看的文字，2.8）与 `POST /users/{id}/unban`（`USER:BAN`；解封把 `banReason`、`bannedAt` 置空；状态不允许时返回 409 `INVALID_STATE`，见下面的状态矩阵；封禁**不**作废 refresh token，也不使用 `sid` 作废集合（2.6）：封禁期间所有请求得到 403 `ACCOUNT_BANNED`，解封后原令牌继续可用；封禁时**删除该账号所有进行中的 LiveKit 房间**并按 15.6 收尾，因为封禁不会自己切断已经在进行的通话，通话在对话页内进行，通话期间客户端不再发后端请求，发现不了封禁）；`GET /account-deletions?status=`（删除任务状态，含失败告警和用户选的删除原因 `reason`，`USER:DELETION`）；`POST /account-deletions/{id}/retry`（`USER:DELETION`，只对 `FAILED` 有效，13.1）；`POST /users/{id}/deletion {reason}` 与 `POST /users/{id}/deletion/cancel`（`USER:DELETION`）：替无法使用应用和网页流程的用户（例如被封禁后联系客服的用户，13.4）发起或取消删除，效果与用户自己申请相同（13.1 的同步阶段 a 到 d，同样有宽限期，不能跳过宽限期立即删除），不要求重新验证身份——核对用户身份是客服流程的责任，不在系统里做；`reason` 必填，1 到 200 个字符，只写审计日志（不得写入用户内容），`AccountDeletion.requestedBy` 记管理员 ID；前置状态不满足时返回 409 `INVALID_STATE`。**邮箱默认掩码返回**（如 `a***@d***.com`：本地部分保留首字符再加 `***`，本地部分只有一位时写 `*`；域名的每一段保留首字符再加 `***`，顶级域原样），持有 `USER:EMAIL_VIEW` 才返回完整邮箱，列表和详情一致；按邮箱筛选只支持完整邮箱的精确匹配（先按 2.2 规范化），不支持模糊，避免用筛选反推邮箱（依据：dramaBox 对手机号按 `DRAMA:USER:PHONE_VIEW` 掩码，同一做法）。**手机号同样默认掩码返回**（规则见 2.9：只保留末 4 位），持有 `USER:PHONE_VIEW` 才返回完整号码；`GET /users` 增加按手机号筛选，只支持完整 E.164 号码的精确匹配（先按 23.3 规范化），不支持模糊。`GET /users` 每行返回 `id`、`email`、`phone`、`status`、`channelCode`（注册渠道）、`trafficType`（`PAID`/`ORGANIC`）、`createdAt`、`timezone`、`conversationLanguage`（`email`、`phone` 都按上述规则掩码或完整，没有则为 `null`）；`GET /users/{id}` 另返回 `banReason`、`bannedAt`、养成数据、资产数量 |
| 内容审核 | `MODERATION:VIEW`、`MODERATION:REVIEW`、`MODERATION:CONFIG` | `GET /moderation/records?status=&source=`（默认按待处理时长排序）；`GET /moderation/records/{id}`；`GET /moderation/records/{id}/content`（`MODERATION:REVIEW`，取被审核的文件或文本，写审计日志；响应 `{"kind":"TEXT","text":"..."}` 或 `{"kind":"FILE","mediaType":"image/jpeg","url":"<短时效签名地址>"}`，地址有效期 `moderation.content_url_ttl_seconds`；`BLOCKED` 的记录没有内容，返回 404 `CONTENT_NOT_STORED`；`COMPANION_NAME` 的待审记录返回当前 `User.companionName`（`{"kind":"TEXT","text":"..."}`），其 `contentRef` 不等于当前 `User.companionNameRef` 时同样返回 404 `CONTENT_NOT_STORED`）；`GET /moderation/stats?from=&to=`（`MODERATION:VIEW`，`from`、`to` 跨度不超过 `stats.max_range_days`，响应 `{"items":[{"statDate","contentType","source","created","approved","rejected","blocked"}],"avgHandleSeconds":<数字或null>,"oldestPendingSeconds":<数字或null>}`，按日、按内容类型和来源统计新增、通过、拒绝、自动拦截数，已处理记录的平均处理时长，当前最老待处理的等待时长；现查 `ModerationRecord`，量小）；`POST /moderation/records/{id}/decision {decision:APPROVE\|REJECT, note}`（`note` 在 `APPROVE` 时选填、`REJECT` 时必填；效果见 11.4）；`GET /moderation/text-rules` → `{"items":[{"id","pattern","matchMode","level","note"}]}`；`PUT /moderation/text-rules`，请求体 `{"items":[…]}`，整表替换：带 `id` 且在当前词表里的元素沿用该 `id`，不带 `id` 或 `id` 不在当前词表里的是新增（保存时生成），当前词表里有而请求里没有的被删除；整表原子，全部通过才保存；响应同 `GET`（规则词表，两个方法都需要 `MODERATION:CONFIG`，规则格式见 11.2） |
| 形象与装扮 | `COSMETIC:MANAGE`、`COSMETIC:GRANT`、`ACTION:MANAGE`、`DECLARATION:MANAGE`、`RENDERER:MANAGE`、`DEFAULT_AVATAR:MANAGE`、`GENERATION:VIEW` | 形象渲染设计第 12 节，权限码由它的 13.1.3 第 6 条新定：`GET/POST/PUT /cosmetics`、上下架（服装和背景目录 `CosmeticItem`：多语言名称、预览图、生成描述、适用风格、适用的端 `surfaces`、额度价格、默认条目，3.7；`COSMETIC:MANAGE`）；`GET/POST/PUT /actions`（动作目录 `ActionItem`：多语言名称、图标、给 agent 的英文说明、生成片段用的描述、适用风格、适用的端、谁能触发，3.8）、`POST /actions/{id}/backfill`（给已有外观补生成这个动作的片段，3.8；`ACTION:MANAGE`）；`GET /accounts/{id}/cosmetics`、`POST /accounts/{id}/cosmetics {itemId, reason}`（查看账号拥有的服装、运营赠送，`source=ADMIN_GRANT`，写审计日志；`COSMETIC:GRANT`）；`/declarations` 新建上传声明版本（多语言文案）与设为生效（`DECLARATION:MANAGE`，3.2）；`/renderer-models` 上传、启用、停用渲染模型（`RENDERER:MANAGE`，3.9）；`/default-avatars` 上传有肖像授权的图、选风格、填名字（必填；生成后也可以改名，`PUT /default-avatars/{id} {name}`，规则 2.5.1，不合规 400 `INVALID_REQUEST`，写审计日志）、生成、查看结果、设为生效（`DEFAULT_AVATAR:MANAGE`，3.10，每套部署同一时刻只有一个生效）；`GET /generation-tasks?status=FAILED&type=`（失败的生成任务和原因，`GENERATION:VIEW`）。**目录接口的请求字段**：文件一律传对应上传记录的 `uploadId`，先经下面三个上传接口上传（`multipart/form-data`，文件字段叫 `file`；类型、大小和处理见 17.4 附·通则第 6 条，成功返回 `{"uploadId":"<UUID>"}`，每次上传写审计日志）：`POST /uploads/catalog-image`（服装、背景、动作的图片，持有 `COSMETIC:MANAGE` 或 `ACTION:MANAGE`，`AdminUpload.kind=CATALOG_IMAGE`）、`POST /uploads/renderer-model`（渲染模型文件，`RENDERER:MANAGE`，`kind=RENDERER_MODEL`）、`POST /uploads/default-avatar-source`（默认数字人的原图，`DEFAULT_AVATAR:MANAGE`，`kind=DEFAULT_AVATAR_SOURCE`）。请求字段名同实体列名去掉 `Ref` 加 `UploadId`：`POST/PUT /cosmetics` 用 `previewUploadId`；`POST/PUT /actions` 用 `iconUploadId`；`POST /renderer-models` 用 `uploadId`（另有 `rendererKind`、`version`、`platform`、`abi`、`rendererFormatVersion`、`minVersionCode`；`sha256`、`sizeBytes` 取自上传记录，请求里带了一律忽略）；`POST /default-avatars` 用 `sourceUploadId`，另有 `name`、`style`，不收 `portraitAuthorized`（肖像授权由运营负责，3.10，没有这个字段）。上下架：`PUT /cosmetics/{id}/enabled {"enabled":true|false}`、`PUT /actions/{id}/enabled {"enabled":…}`、`PUT /renderer-models/{id}/enabled {"enabled":…}`。上传声明：`GET /declarations`、`POST /declarations {"version","texts"}`（`texts` 是语言标签到文案的对象）、`PUT /declarations/{version}/activate`。其余请求字段名同第 18 章该实体的列名；响应按 17.4 附的通则。`uploadId` 的校验沿用 22.9 的机制：不存在 404 `RESOURCE_NOT_FOUND`、已被使用 409 `INVALID_STATE`、`kind` 不符 400 `INVALID_REQUEST`。生成结果的人工复核沿用上一行的审核队列（`contentType` 为 `AVATAR_IMAGE`、`ACTION_CLIP`，11.1）。本模块的配置项和功能开关走 17.5 和 15.3 现有的页面 |
| 投诉 | `COMPLAINT:VIEW`、`COMPLAINT:MANAGE` | 照片里的人投诉（11.6，`LikenessComplaint`）：`GET /likeness-complaints`（列表，按 `dueAt` 排序并标出到期，`COMPLAINT:VIEW`）、`GET /likeness-complaints/{id}`（详情与处理记录，处理记录取自 `LikenessComplaintEvent`，`COMPLAINT:VIEW`）、`PUT /likeness-complaints/{id}/status {status, note}`（状态流转，规则见 11.6：只接受 `INVESTIGATING`、`RESOLVED_NOT_FOUND`、`REJECTED`，已结案 409 `INVALID_STATE`，写 `LikenessComplaintEvent` 和审计日志；`COMPLAINT:MANAGE`）、`POST /likeness-complaints/{id}/remove-avatars {assetIds}`（删除查到的形象，效果见 11.6，写审计日志；`COMPLAINT:MANAGE`）、`GET /likeness-complaints/{id}/evidence/{index}`（取投诉的证据文件，`COMPLAINT:VIEW`：`index` 从 0 起，对应 `LikenessComplaint.evidenceRefs` 的下标；返回 `{"url":"<短时效签名地址>","mediaType":"image/jpeg"}`，`mediaType` 是该文件的类型，地址有效期与内容审核的签名地址相同（`moderation.content_url_ttl_seconds`）；每次读取写一条审计日志，`detail` 只写投诉 ID 和下标；投诉不存在或下标越界返回 404 `RESOURCE_NOT_FOUND`）。权限码由形象渲染设计 13.1.3 第 6 条新定；状态流转接口 2026-10-11 定 |
| 养成管理 | `COMPANIONSHIP:CONFIG` | 通过 `PUT /config/{key}` 修改 `companionship.*`、`milestone.*` 键（见 17.5） |
| 推送管理 | `PUSH:VIEW`、`PUSH:TEMPLATE`、`PUSH:SEND`、`PUSH:CONFIG` | `GET/POST/PUT/DELETE /push/templates`（按 `triggerReason`+`locale`）；`GET /push/tasks`、`POST /push/tasks`（创建手动推送，8.5）、`POST /push/tasks/{id}/cancel`；`GET/POST/PUT/DELETE /push/schedules`（周期推送，8.5；响应带 `nextRunAt`；`DELETE` 等于停用并保留已生成的任务）；`GET /push/records`（列账号 ID、类型、`triggerReason`、本地日期、创建时间；`GET /push/records/{id}` 返回对每个 token 的 `PushDelivery`）；`POST /uploads/image`（推送模板和任务的图片，`multipart/form-data`、文件字段叫 `file`，缺少 `file` → 400 `INVALID_REQUEST`、`data.details` 为 `[{"ref":"file","reason":"EMPTY_NOT_ALLOWED"}]`，后台所有上传接口一致（`POST /uploads/apk`、`POST /ads/media` 同）；`PUSH:TEMPLATE` 或 `PUSH:SEND`，jpg/png、不超过 `upload.push_image_max_bytes`，返回 `uploadId` 和地址；模板、任务和周期推送只接受 `uploadId`（`AdminUpload.kind=PUSH_IMAGE`，机制同 22.9，`imageUrl` 由后端从上传记录填，不接受手填），未使用的按 `upload.orphan_hours` 清理；模板或周期推送被删除、换图时，旧的上传记录和文件随即删除；创建 `PushTask`（含由周期推送生成的）时把图片复制成任务自己的一份（`consumedByType=PUSH_TASK`），所以模板或周期推送的删除、换图不影响已生成的任务，任务进入终态（`DONE`、`CANCELLED`）超过 `push.task_image_retention_days`（默认 30，提议）天后，每天的清理任务删除它的图片；依据：dramaBox 只在前端限制推送图片为 jpg/png 且不超过 1 MB，后端没有强制 [子代理读码 dramaBox-admin `src/pages/push/pushImageField.ts`、dramaBox `UploadFacade`]；本项目由后端强制）；推送效果见 17.6；召回参数（8.4）通过 `PUT /config/{key}` 修改，需 `PUSH:CONFIG` |
| 埋点管理 | `ANALYTICS:VIEW`、`ANALYTICS:FUNNEL_MANAGE`、`ANALYTICS:IP_VIEW` | 这四个接口现查 `event_log`，时间范围不超过 `analytics.live_max_range_days`，超出返回 `INVALID_REQUEST`：`GET /analytics/events`（按账号、设备、事件名、时间范围查明细，展开显示 `params`、`context`；每条带 `receivedAt`、`clientTime`、`country`、`ip`：**`ip` 默认掩码返回**（IPv4 末段、IPv6 后半段以 `*` 代替），持有 `ANALYTICS:IP_VIEW` 才返回完整 IP，与邮箱、手机号的掩码规则一致）；`GET /analytics/event-summary?from=&to=`（每个事件名的触发次数 `pv` 与去重账号数 `uv`，**不分页**，一次返回范围内全部事件名）；`GET /analytics/event-names?from=&to=`（范围内出现过的事件名，供漏斗输入联想）；`GET /analytics/funnel?steps=a,b,c&windowHours=&from=&to=`（`steps` 2 到 10 个事件名，`windowHours` 默认 24、范围 1 到 720，`SavedFunnel.windowHours` 同范围，不合格 400 `INVALID_REQUEST`；按顺序完成各事件的去重主体数与相邻步骤转化率（**主体**：事件的 `accountId`；没有时取同一 `deviceId` 在窗口内带账号的事件的 `accountId`，仍没有则用 `deviceId`，所以注册前的匿名 `app_open` 和注册后带账号的 `register_completed` 能串成同一个主体；事件的先后按（`receivedAt`，`seq`）排序，客户端时间不参与，`windowHours` 按收到时间计，持久化离线队列里迟到上传的事件会让跨批次的间隔偏大，接受；`windowHours` 是同一账号完成相邻两步之间允许的最长间隔，是本项目新增的参数，dramaBox 的漏斗没有）。已保存的漏斗：`GET/POST/PUT/DELETE /analytics/funnels`（`SavedFunnel`：名称、步骤列表、`windowHours`、`isPreset`；预设漏斗只读，`ANALYTICS:FUNNEL_MANAGE` 才能写；依据：dramaBox 的漏斗配置同样可保存、预设只读）。预设漏斗由代码在启动时写入：注册漏斗（`app_open` → `register_completed`）、激活漏斗（`register_completed` → `avatar_created` → `voice_cloned` → `session_started`）、付费漏斗（`paywall_viewed` → `purchase_initiated` → `subscription_started`）。**留存不在这里**，由 17.6 的汇总表提供 |
| 统计报表 | `STATS:VIEW`、`STATS:LAND`、`STATS:EXPORT` | 日报、留存、回流、游客设备转注册、游客留存、游客额度使用、通话质量、推送效果，以及总览页用到的数据，除游客额度使用是现查 `GuestDevice` 之外全部来自汇总表；接口、口径、补数、导出见 17.6 |
| 通话 | `SESSION:VIEW` | `GET /sessions`（全部会话，含游客会话；筛选账号 ID、是否游客（`guest=true` 或 `guest=false`）、`requestedAt` 时间范围、是否进行中、是否被到点强制结束（`endReason=DEADLINE`）；列 `id`、账号 ID（游客会话为空）、`deviceId`（游客会话才有，只显示前 8 位）、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`）；`GET /sessions/{id}`。账号维度的会话仍用 `GET /users/{id}/sessions` |
| 邀请管理 | `INVITE:VIEW`、`INVITE:CONFIG` | `GET /invites/codes`（列邀请码、所有者账号 ID、创建时间）、`GET /invites/records`（列邀请人、被邀请人、兑换时间、奖励状态 `rewardStatus`、不符合原因 `rewardReason`、已发额度；按兑换时间倒序；可按 `rewardStatus` 筛选）、`GET /invites/stats?from=&to=`（现查 `InviteRecord`，不汇总）。`stats` 响应：`totalInvitees`（范围内 `InviteRecord` 条数）、`activeInviters`（范围内至少邀请成功一人的去重邀请人数）、`registeredAccounts`（截至 `to` 的账号总数，分母单独返回）、`avgInvitesPerInviter`（`totalInvitees / activeInviters`，`activeInviters` 为 0 时为 `null`）、`daily`（`[{date, invitees, activeInviters}]`，一天一行）、`ranking`（`limit` 默认 50、上限 200，`[{inviterAccountId, inviteCount}]`）、`rewardedInvitees`（范围内 `REWARDED` 的记录数）、`creditsGranted`（范围内已发放的额度总和，邀请人和被邀请人两边）。**裂变层级**（照 dramaBox 的邀请链层级统计 `/depth-stats`、`/chain` [子代理读码 dramaBox-admin `stat/invite`、后台设计会话的笔记]）：`GET /invites/depth-stats?from=&to=` 返回 `{depthDistribution:[{depth,count}],avgDepth,maxDepth,totalChains}`——一个账号的深度 = 沿邀请人往上数到根的层数（被邀请人的邀请人没有邀请人，则被邀请人深度为 1，依此类推），`avgDepth` 是范围内新增被邀请人的平均深度，`maxDepth` 是最大深度，`totalChains` 是范围内不同根账号（没有邀请人的账号）的数量；`GET /invites/chain?rootAccountId=&maxDepth=` 返回 `{root:{accountId,label,joinedAt},children:[…],totalDescendants,maxDepth}`，`maxDepth` 取 1 到 `invite.chain_max_depth`（默认 5），默认 3，节点的 `label` 是掩码标识（规则同邀请记录列表，9）。**分享漏斗**：`GET /invites/share-funnel?from=&to=` 返回逐日的 `StatShareFunnelDaily` 行；`GET /invites/share-channels?from=&to=&shareChannel=` 返回逐日逐分享渠道的 `StatShareChannelDaily` 行。邀请奖励参数（9.1）通过 `PUT /config/{key}` 修改，需 `INVITE:CONFIG`。口径依据：dramaBox 的邀请统计定义 [子代理读码 dramaBox `docs/statistics-module-design.md` 四、4.1]；奖励指标 `rewardedInvitees`、`creditsGranted` 是本项目新增的（九节） |
| 每日签到 | `CHECKIN:VIEW`、`CHECKIN:MANAGE` | 见 28.1：`GET/POST/PUT/DELETE /checkin/activities`、`PUT /checkin/activities/{id}/status`（带 `confirm` 探测重叠活动）、`GET /checkin/records`；签到统计见 17.6 |
| 每日任务 | `TASK:VIEW`、`TASK:MANAGE` | 见 28.2：`GET/POST/PUT/DELETE /tasks/configs`、`PUT /tasks/configs/{id}/status`、`GET /tasks/records`；任务统计见 17.6 |
| 投放管理（广告归因） | `ATTRIBUTION:VIEW`、`ATTRIBUTION:MANAGE` | **查看**（`ATTRIBUTION:VIEW`）：`GET /attribution/records`（可按 `source`、`matchType`、时间筛选）；`GET /attribution/clicks?from=&to=&campaignId=&status=&keyword=&page=&pageSize=`（自建归因的点击明细，状态现算，10.3；`status` 取 `PENDING`/`MATCHED`/`EXPIRED`；`keyword` 在 UTM 来源、媒介、活动里做包含匹配，按完整 IP 精确匹配只在持有 `ANALYTICS:IP_VIEW` 时生效，否则忽略；`ip` 默认掩码返回，持有 `ANALYTICS:IP_VIEW` 才返回完整 IP，规则同事件明细）；`GET /attribution/summary?groupBy=source\|media_source\|campaign`（10.3）；`GET /attribution/performance?from=&to=&campaignId=&groupBy=campaign\|day`（投放效果，10.5）。**管理**（`ATTRIBUTION:MANAGE`，所有写操作写审计日志）：`GET /attribution/campaigns?keyword=&enabled=&page=&pageSize=`（`keyword` 在编码和名称里做包含匹配）、`POST /attribution/campaigns`、`PUT /attribution/campaigns/{id}`（投放账户，没有 `DELETE`，只能停用，10.5）；`GET /attribution/campaigns/{id}/link`（生成带 UTM 的链接）；`GET/POST/PUT/DELETE /attribution/costs`、`POST /attribution/costs/batch`（投放成本，10.5）。`attribution.*` 参数通过 `PUT /config/{key}` 修改，需 `ATTRIBUTION:MANAGE` |
| 客服 | `SUPPORT:VIEW`、`SUPPORT:MANAGE` | `GET /support/feedback`、`GET /support/feedback/{id}`；`POST /support/feedback/{id}/retry`（重新转发，12） |
| 系统监控 | `MONITOR:VIEW`、`MONITOR:MANAGE` | `GET /monitor/pipeline?from=&to=&source=`（第十四节，无数据返回空列表）、`GET /alerts?status=&type=`（`MONITOR:VIEW`）；`POST /alerts/{id}/resolve`（`MONITOR:MANAGE`，写审计日志；后台告警，见表后的说明） |
| 成本 | `COST:VIEW`、`COST:PRICE` | `GET /stats/usage-cost`（17.6）；价格、待审批次、模型登记的接口见 14.2：`GET /usage/prices`、`GET /usage/price-batches/pending`、`GET /usage/models`（`COST:VIEW`）；`POST /usage/prices`、`POST /usage/price-batches/{batchId}/confirm`、`POST /usage/price-batches/{batchId}/reject`、`POST /usage/price-batches/{batchId}/retire`、`PUT /usage/models/{id}`（`COST:PRICE`，写操作写审计日志） |
| 系统管理 | `ADMIN:MANAGE`、`ROLE:MANAGE`、`PERMISSION:MANAGE`、`AUDIT:VIEW` | `GET/POST/PUT/DELETE /admins`（创建时由创建者设置初始密码，规则同 17.2，`mustChangePassword` 置为真；管理员可分配多个角色：`POST/PUT /admins` 请求体 `{"username","password"(仅创建),"roleIds":[…],"superAdmin":false}`；`POST/PUT /roles` 请求体 `{"name","remark","permissionCodes":[…]}`，给角色分配不存在的权限码 400 `INVALID_REQUEST`）；`POST /admins/{id}/status {status}`（启用、停用；停用后该管理员的令牌立即失效，不能停用自己，最后一个启用的超级管理员不能被停用；只有 `superAdmin=true` 的管理员能设置或清除 `superAdmin`，持有 `ADMIN:MANAGE` 的管理员不能修改自己的角色和 `superAdmin`，“最后一个启用的超级管理员”的保护同样适用于清除其 `superAdmin` 的操作）；`POST /admins/{id}/reset-password {newPassword}`（`mustChangePassword` 置为真）；`POST /admins/{id}/reset-totp`（清除二次验证密钥，下次登录重新绑定）；`GET/POST/PUT/DELETE /roles`（含分配权限码；角色仍分配给管理员时删除返回 409 `ROLE_IN_USE`）；`GET/POST/PUT/DELETE /permissions`（权限树，见 17.3）；`GET /audit-logs?adminId=&action=&targetType=&targetId=&from=&to=`。权限：`/admins` 各接口 `ADMIN:MANAGE`；`/roles` `ROLE:MANAGE`；`/permissions` 的读取 `ROLE:MANAGE` 或 `PERMISSION:MANAGE`，写操作 `PERMISSION:MANAGE`；`/audit-logs` `AUDIT:VIEW`。`AdminUser.status` 取 `ACTIVE`、`DISABLED`；`DELETE /admins/{id}` 同样不能删除自己、不能删除最后一个启用的超级管理员。**以上写操作均写审计日志** |
| 系统配置 | `CONFIG:MANAGE`，以及 17.5 里各键的编辑权限码 | `GET /config`：返回当前管理员**有权编辑的键**的当前值、默认值、所需编辑权限；持有 `CONFIG:MANAGE` 的管理员得到全部键，只持有模块权限码（如 `COMPANIONSHIP:CONFIG`、`PUSH:CONFIG`、`INVITE:CONFIG`）的管理员只得到那些码对应的键，不返回 403；`PUT /config/{key}`（按 17.5 每个键的"编辑权限"校验，值不合法返回 `INVALID_REQUEST`，写审计日志；成功时响应 `data` 为 `{"key":"…","value":…,"warnings":[{"code":"…","message":"…","count":n}]}`，`warnings` 不拦截保存，目前有：`PHONE_LOGIN_DISABLED_ACCOUNTS`（关闭 `auth.phone_login_enabled` 时，`count` 是现有手机号账号数）、`SMS_COUNTRY_UNCOVERED`（`sms.allowed_country_codes` 里有国家没有启用的通道覆盖，`message` 列出国家）、`AD_SKIP_AFTER_TOO_LONG`（`ads.skip_after_seconds` 超过 5）、`AD_FORCE_CLOSE_DISABLED`（`ads.force_close_seconds` 为 0 而存在不可跳过的开屏或插屏素材）；`PUT /sms/channels/{id}` 改 `countries` 时响应同样带 `SMS_COUNTRY_UNCOVERED`）；`GET /meta`：任何持有有效管理员令牌、且不在“必须改密码”状态的管理员都可调，不挂权限码，在改密码状态返回 403 `ADMIN_FORBIDDEN`，只读，不写审计日志。原因：`GET /config` 只返回当前管理员有权编辑的键，而有些页面要显示自己无权编辑的运营参数（例如推送模板页按支持的语言列表画“触发原因 × 语言”矩阵，`app.supported_locales` 的编辑权限是 `CONFIG:MANAGE`）。响应是一个平铺对象，字段恰好是这二十个：前十二个与配置键一一对应，后八个是上传限制：`supportedLocales`（`app.supported_locales`，字符串数组）、`landIntervalMinutes`（`stats.land_interval_minutes`）、`allowedCurrencies`（`usage_price.allowed_currencies`，字符串数组）、`deletionAlertAfterFailures`（`deletion.alert_after_failures`）、`inviteChainMaxDepth`（`invite.chain_max_depth`）、`maxRecipients`（`notification.max_recipients`）、`pushImageMaxBytes`（`upload.push_image_max_bytes`）、`statsMaxRangeDays`（`stats.max_range_days`）、`analyticsLiveMaxRangeDays`（`analytics.live_max_range_days`）、`abuseClusterMinFreeAccounts`（`abuse.cluster_min_free_accounts`）、`attributionClickRetentionDays`（`attribution.click_retention_days`）、`declarationRequired`（`avatar.declaration_required`，布尔）；后八个是上传限制，管理端在上传按钮旁显示并在上传前检查：`uploadMaxBytes`（`upload.max_bytes` 的当前值，默认数字人源图上传的文件大小上限）、`adMediaMaxBytes`（`upload.ad_media_max_bytes` 的当前值，广告素材）、`apkMaxBytes`（`upload.apk_max_bytes` 的当前值，APK）、`renderAssetMaxBytes`（`upload.render_asset_max_bytes` 的当前值，渲染模型 zip）、`catalogImageMaxBytes`（2097152，工程常量，服装、背景预览图和动作图标）、`catalogImageMaxPixels`（36000000，工程常量，同上的宽×高上限）、`adImageMaxPixels`（36000000，工程常量，广告素材里图片的宽×高上限，视频没有这条）、`defaultAvatarSourceMaxPixels`（250000000，工程常量，默认数字人源图的宽×高上限）。值是当前生效值；前十二个里没有默认值又未配置的键为 `null`，后八个都不会是 `null`（四个键都有默认值，其余是工程常量）。这些值都不含机密，所以不按字段判断权限 |
| 订阅管理 | `SUBSCRIPTION:VIEW`、`SUBSCRIPTION:GRANT`、`SUBSCRIPTION:CONFIG`、`FINANCE:VIEW` | `GET /subscriptions`（按账号、状态、商店、商品筛选）；`GET /subscriptions/{id}`（含事件时间线）；`GET /accounts/{id}/entitlements`（账号当前权益与功能开关的生效值，含来源）；`POST /accounts/{id}/promo-entitlements {entitlementKey, durationDays, reason}` 与 `POST /promo-entitlements/{id}/revoke`（`SUBSCRIPTION:GRANT`，写审计日志，不影响商店里的订阅）；`GET/POST/PUT /entitlement-defs`、`PUT /entitlement-defs/{key}/features`（请求体 `{"features":[{"featureKey":"…","mode":"VALUE"、"UNLIMITED" 或 "UNSET","value":…}]}`，`UNSET` 删除该权益对这个开关的配置行（回退到默认值），`UNLIMITED` 存哨兵值，`VALUE` 必须带 `value`；`call.lifetime_minutes` 不能出现在权益的功能值里（它只对免费账号生效），请求里带它返回 400 `INVALID_REQUEST`；请求里没出现的开关保持不变；权益的功能值，保存 `memory.tier` 时校验档位存在，16.2；保存 `chat.model_tier` 时校验值在 `chat.model_tiers_allowed` 里，15.6）、`GET /feature-gates`、`PUT /feature-gates/{key}/default`（请求体 `{"mode":"VALUE"、"UNLIMITED" 或 "UNSET","value":…}`，规则同权益的功能值；`UNSET` 只对五个额度键（三个通话额度键、`chat.daily_messages`、`chat.monthly_messages`）有效，其余开关的默认值不能是未配置，返回 `INVALID_REQUEST`）、`GET/PUT /subscription-products`（商品到权益的映射与在售开关）、`GET /subscription-events?status=FAILED`（也可按 `needsAttention=true` 筛选）、`POST /subscription-events/{id}/reprocess`、`POST /subscription-events/{id}/ack`（把 `needsAttention` 置假，写审计日志）（写入类配置均为 `SUBSCRIPTION:CONFIG`；`POST /subscription-events/{id}/reprocess` 和 `/ack` 需要 `SUBSCRIPTION:GRANT`；读取接口——`GET /subscriptions`、`/subscriptions/{id}`、`/accounts/{id}/entitlements`、`/entitlement-defs`、`/feature-gates`、`/subscription-products`、`/subscription-events`——均为 `SUBSCRIPTION:VIEW`）；`GET /subscriptions/stats?from=&to=`（响应 `{"items":[{"statDate","store","productId","active","new","renewed","canceled","expired","refunded","listPriceAmount","listPriceCurrency"}]}`，`from`、`to` 跨度同上，现查；列口径：`new` = 当日 `firstActiveAt` 的订阅数（同 17.6 的 `newSubscriptions`）；`renewed` = 当日续订事件数（Apple `DID_RENEW`，Google `SUBSCRIPTION_RENEWED`）；`canceled` = 当日关闭自动续订的事件数（Apple `DID_CHANGE_RENEWAL_STATUS` 的 `AUTO_RENEW_DISABLED`，Google `SUBSCRIPTION_CANCELED`）；`expired` = 当日到期事件数（Apple `EXPIRED`，Google `SUBSCRIPTION_EXPIRED`）；`refunded` = `voidedAt` 或 `REFUND`/`REVOKE` 事件落在当日的订阅数（去重）；`active` 取自 `StatSubscriptionSnapshot`（17.6），缺失的日子为 `null`；`FINANCE:VIEW`：活跃订阅数、新增、续订、取消、过期、退款次数，按商店和商品分；金额是标价，不是实收：Apple 交易的 `price`（整数，除以 1000）和 `currency`（`price` 存在时才有），Google 的 `lineItems[].autoRenewingPlan.recurringPrice`（官方说明不含折扣和税），要实收金额需要 Google 的订单接口 `orders.get`，先不做；沙盒订阅不计入统计）。**管理后台不提供退款操作**：Apple 的退款由 Apple 处理；Google 有 `purchases.subscriptionsv2.revoke`，是否退款我没核实，先只展示退款事件。支持人员有 `SUBSCRIPTION:VIEW`/`GRANT`，没有 `FINANCE:VIEW`（看不到财务数据） |
| 额度 | `SUBSCRIPTION:CONFIG`、`SUBSCRIPTION:GRANT`、`CREDIT:REVIEW`、`SUBSCRIPTION:VIEW`、`FINANCE:VIEW` | 见 15.9：`GET/POST/PUT /credit-products`（额度包配置，`SUBSCRIPTION:CONFIG`）；`PUT /feature-gates/{key}/credit-cost`（用额度购买该开关一个单位的价格；`avatar.looks_max`、`credits.period_grant` 的 `creditCost` 恒为空，对它们设置非空价格返回 400 `INVALID_REQUEST`，15.3；`SUBSCRIPTION:CONFIG`）；手动发放和调整**不直接生效，走申请 → 审核**（15.9）：`POST /credit-adjust-requests {accountId, kind, delta, reason}`（`SUBSCRIPTION:GRANT`；`kind` 为 `GRANT` 时 `delta` 必须为正，为 `ADJUST` 时可正可负）、`GET /credit-adjust-requests?status=&accountId=`（`SUBSCRIPTION:VIEW`）、`POST /credit-adjust-requests/{id}/approve {note?}`、`POST /credit-adjust-requests/{id}/reject {note}`（`CREDIT:REVIEW`，驳回必须写原因，申请人不能审核自己的申请，返回 403 `SELF_REVIEW_FORBIDDEN`）；`GET /accounts/{id}/credits`（余额与流水，`SUBSCRIPTION:VIEW`）；`GET /credits/accounts`、`GET /credits/transactions`（全部账号的额度账户和流水，`SUBSCRIPTION:VIEW`）；`GET /credits/stats?from=&to=`（响应 `{"purchases":[{"store","productId","packs","credits"}],"refunded":[{"store","productId","credits"}],"spent":[{"spendKind","featureKey","itemKey","count","credits"}]}`，`spent` 先按 `spendKind`（`FEATURE`/`COSMETIC`/`LOOK`，15.9）分组，`FEATURE` 再按 `featureKey` 分，`COSMETIC` 再按 `itemKey` 分；`from`、`to` 跨度同上；`packs` = 当日 `PURCHASE` 流水条数，`spent` 取 `SPEND` 减 `SPEND_REVERSED`：`spent.count` = 当日 `SPEND` 流水的 `quantity` 之和减去当日 `SPEND_REVERSED` 流水的条数（每条冲销一次建外观的扣费，数量按 1 计，同一个 `spendKind` 里相减），`spent.credits` = 当日 `SPEND` 的 `-delta` 之和减去当日 `SPEND_REVERSED` 的 `delta` 之和；`FINANCE:VIEW`：额度包销量和退款扣回额度按商店和商品分，消费额度按功能开关分，沙盒不计入） |
| 记忆服务 | `MEMORY:VIEW`、`MEMORY:TIER_CONFIG`、`MEMORY:MODEL_REGISTER`、`MEMORY:MODEL_ASSIGN` | 见 16.2、16.3：`GET/PUT /memory/tiers[/{name}]`；`GET/PUT /memory/embedding-models[/{name}]`；`GET /accounts/{id}/memory`；`PUT /accounts/{id}/memory/embedding-model` |
| 应用内广告 | `ADS:CAMPAIGN`、`ADS:PLACEMENT`、`ADS:UNIT`、`ADS:CREATIVE`、`ADS:REPORT` | 见 22.9 |
| 短信管理 | `SMS:CHANNEL`、`SMS:CHANNEL:CONFIG`、`SMS:TEMPLATE`、`SMS:RECORD`、`SMS:RECORD:PHONE_VIEW`、`SMS:RECORD:EXPORT` | 见 23.6 |
| 多开检测 | `ABUSE:VIEW` | `GET /abuse/clusters?by=DEVICE 或 IP&from=&to=&minFreeAccounts=&page=&pageSize=`（`by` 取 `DEVICE` 或 `IP`；`from`、`to` 按 `RegistrationAudit.createdAt`；只返回免费账号数不小于 `minFreeAccounts`（默认取 `abuse.cluster_min_free_accounts`）的聚类，按免费账号数倒序，每行 `key`（完整的不透明值，是 HMAC、不可逆；这是 17.4 通则里“`Hash` 结尾的列不返回”的例外，因为下一个接口要原样传回它）、`accounts`、`freeAccounts`、`paidAccounts`、`firstCreatedAt`、`lastCreatedAt`）；`GET /abuse/clusters/accounts?by=&key=&page=&pageSize=`（该聚类下的账号：账号 ID、创建时间、状态、是否付费、注册方式）。"付费"指当前有有效的 `STORE` 订阅权益；付费账号不计入 `freeAccounts`，也不处理。封号用已有的 `POST /users/{id}/ban`。`deviceId` 是客户端自己生成的，伪造者每次换一个就不会聚在一起，所以 `by=DEVICE` 只抓得住没有伪造 `deviceId` 的多开，`by=IP` 补充一部分。设备本身的真实性由 `integrityToken`（2.1）把关，这份报表不替代它。每天一次的清理任务删除超过 `abuse.audit_retention_days` 的 `RegistrationAudit` 行。同一个 IP 下可能有大量真实用户（移动网络的共用出口，[推断]，没有核实），`by=IP` 的结果只作参考 |
| 认证事件 | `USER:VIEW` | `GET /users/{id}/auth-events`（分页，按时间倒序，列类型、原因、设备哈希前 8 位、IP 哈希前 8 位、时间，2.11） |
| 邮件模板 | `EMAIL:TEMPLATE` | `GET /email/templates`（返回每个模板的当前内容、默认文案、是否被改过）；`PUT /email/templates/{templateCode}`（`subject` 1 到 200 个字符，`body` 必须含该模板要求的占位符，否则 `INVALID_REQUEST`，写审计日志）；`POST /email/templates/{templateCode}/reset`（恢复默认文案，写审计日志）。`templateCode` 由代码声明，不能新增或删除，目前有五个，都只有英文：`LIKENESS_COMPLAINT_RECEIVED`（11.6，照片里的人投诉的收到确认，占位符 `{appName}`，没有必须含的占位符；占位符本行新定）、`REGISTER_CODE`（2.2.1，占位符 `{code}`、`{minutes}`、`{appName}`，必须含 `{code}`）、`PASSWORD_RESET`（2.9，占位符 `{resetLink}`（系统生成的完整重置链接，2.9）、`{minutes}`、`{appName}`，必须含 `{resetLink}`）、`DELETION_CONFIRM`（13.4，占位符 `{confirmLink}`、`{subscriptionNotice}`、`{minutes}`、`{appName}`，必须含 `{confirmLink}` 和 `{subscriptionNotice}`；账号有有效订阅时系统把 `{subscriptionNotice}` 填成固定的英文说明（商店订阅不会因删号取消，并写明如何取消，15.8），没有订阅时填空，所以模板不能去掉它）、`PASSWORD_CHANGED`（2.9，占位符 `{time}`、`{appName}`，必须含 `{time}`） |
| 应用版本 | `APPVERSION:VIEW`、`APPVERSION:MANAGE`、`APPVERSION:ACTIVATE` | 见 24.2 |
| 渠道包 | `CHANNEL:MANAGE` | `GET /channels`（任何登录的管理员）、`POST /channels`、`PUT /channels/{code}`（24.7） |
| 站内通知 | `NOTIFICATION:VIEW`、`NOTIFICATION:SEND` | 见 25.4 |
| 客户端配置 | `CLIENTCONFIG:VIEW`、`CLIENTCONFIG:MANAGE` | 见 26.3 |



**后台告警（`AdminAlert`）**：本文多处写"在管理后台告警"，统一落为一条 `AdminAlert(id, type, accountId(可空), refType, refId, detail, status(OPEN/RESOLVED), createdAt, resolvedAt)`，由出问题的代码路径写入，同一对象（`type`、`refId`）已有 `OPEN` 的不重复写。`type` 共十四种：`DELETION_FAILED`（账号删除任务的失败次数达到 `deletion.alert_after_failures`，13.1；`refType=ACCOUNT_DELETION`，`refId` 是 `AccountDeletion.id`）、`SUBSCRIPTION_UNACKED`（Google 订阅超过 `subscription.unacked_alert_hours` 仍未确认，15.5、15.7；`refType=SUBSCRIPTION`，`refId` 是 `Subscription.id`）、`CREDIT_UNCONSUMED`（Google 额度购买超过 `credits.unconsumed_alert_hours` 仍未消耗，15.9；`refType=ONE_TIME_PURCHASE`，`refId` 是 `OneTimePurchase.id`）、`CREDIT_CONSUMED_BEFORE_CREDITED`（额度购买在入账前已被消耗，15.9；`refType=STORE_ORDER`，`refId` 是 `GOOGLE:<orderId>`，此时可能还没有 `OneTimePurchase` 行）、`MEMORY_SYNC_FAILED`（档位同步状态为 `FAILED`，15.6；`refType=ACCOUNT_MEMORY_TIER`，`refId` 是账号 ID）、`SMS_DAILY_CAP_REACHED`（短信每日总量达到 `sms.daily_global_cap`，23.3；`refType=SMS_GLOBAL_CAP`，`refId` 为 UTC 日期，同一天只写一条）、`FREE_CALL_MINUTES_HIGH`（当日免费通话总分钟数达到 `call.free_daily_alert_minutes`，15.6；`refType=FREE_CALL_BUDGET`，`refId` 为 UTC 日期，同一天只写一条，次日 UTC 零点自动 `RESOLVED`）、`USAGE_PRICE_MISSING`（上报了没有价格的模型，14.2；`refType=USAGE_MODEL`，`refId` 为 `resourceType/provider/model`，同一模型只写一条，该模型有了 `effectiveFrom` 不晚于今天的 `ACTIVE` 价格批次后自动 `RESOLVED`，将来日期的批次不算）、`LLM_PRICE_SYNC_FAILED`（价格同步任务失败或没有配置 `DASHSCOPE_PRICE_API_KEY`，14.2；`refType=LLM_PRICE_SYNC`、`refId=ALL`，同一时间只有一条 `OPEN`，下一次同步成功后自动 `RESOLVED`；没有任何模型配置同步适配器时不写）、`CREDIT_LEDGER_MISMATCH`（额度余额与流水不一致，15.7；`refType=CREDIT_BALANCE`，`refId` 是账号 ID，同一账号一条 `OPEN`）、`AVATAR_DELETION_OVERDUE`（外部删除任务超过 `avatar.deletion_due_hours` 仍未完成，17.5；`refType=EXTERNAL_DELETION_JOB`，`refId` 是 `ExternalDeletionJob.id`，完成后自动 `RESOLVED`）、`LIKENESS_COMPLAINT_OVERDUE`（照片里的人投诉超过 `complaint.likeness_due_hours` 仍未结案，11.6；`refType=LIKENESS_COMPLAINT`，`refId` 是 `LikenessComplaint.id`，结案后自动 `RESOLVED`）、`GENERATION_CONFIG_MISSING`（形象生成的门槛配置 `generation.mouth_open_min_area`、`generation.mouth_open_min_brightness` 有未配置的，1.4、17.5；`refType=APP_CONFIG`，`refId=GENERATION`，配置齐后自动 `RESOLVED`）、`LOOK_PACKAGE_PREPARE_FAILED`（某个外观某个格式版本的驱动资源包准备失败次数达到 `generation.reprepare_max_attempts`，3.9；`refType=LOOK_PACKAGE`，`refId` 是 `LookPackage.id`，`accountId` 取外观所属账号，默认数字人的外观为空；包变为 `READY` 或这条 `LookPackage` 被删除时自动 `RESOLVED`；人工关闭时把它的 `attempts` 清零、允许重新准备，3.9）。**凡是能确定账号的告警（`refId` 是账号 ID，或订阅、购买已绑定账号），同时填 `accountId` 列**，账号删除时按它清除（13.1 步骤表第 6 步）；所以 `SUBSCRIPTION_UNACKED`、`CREDIT_UNCONSUMED`、`CREDIT_CONSUMED_BEFORE_CREDITED`（账号已知时）也带 `accountId`，删除账号后不会留下永远 `OPEN` 的告警。对象恢复正常（删除任务完成、订阅已确认、额度已消耗、同步成功、对账一致）时自动置 `RESOLVED`（`CREDIT_CONSUMED_BEFORE_CREDITED` 除外：它没有可检测的恢复条件，客服用调账补发后人工 `POST /alerts/{id}/resolve` 关闭），`SMS_DAILY_CAP_REACHED` 在下一个 UTC 日零点置 `RESOLVED`；`POST /alerts/{id}/resolve` 用于人工关闭（写审计日志）。

**账号状态与后台操作**（以账号 ID 为对象的后台写操作按下表处理；账号不存在一律 404 `RESOURCE_NOT_FOUND`）：

| 操作 | `ACTIVE` | `BANNED` | `PENDING_DELETION` | `DELETING` |
|---|---|---|---|---|
| 封禁 | 成功 | 409 `INVALID_STATE`（已封禁） | 409 `INVALID_STATE` | 409 `INVALID_STATE` |
| 解封 | 409 `INVALID_STATE` | 成功 | 409 `INVALID_STATE` | 409 `INVALID_STATE` |
| 后台发起删除 | 成功 | 成功（`statusBefore=BANNED`） | 409 `INVALID_STATE` | 409 `INVALID_STATE` |
| 后台取消删除 | 409 `INVALID_STATE` | 409 `INVALID_STATE` | 成功（`AccountDeletion` 是 `SCHEDULED` 时） | 409 `INVALID_STATE` |
| 发放限时权益 | 成功 | 成功 | 403 `ACCOUNT_DELETION_SCHEDULED` | 403 `ACCOUNT_DELETING` |
| 撤销限时权益 | 成功 | 成功 | 成功 | 403 `ACCOUNT_DELETING` |
| 创建、通过额度申请 | 成功 | 成功 | 403 `ACCOUNT_DELETION_SCHEDULED` | 403 `ACCOUNT_DELETING` |
| 指派 embedding 模型 | 成功 | 成功 | 403 `ACCOUNT_DELETION_SCHEDULED` | 403 `ACCOUNT_DELETING` |
| 发送站内通知（25.3） | 成功 | 400 `INVALID_REQUEST`（`data.details` 列出账号） | 400 `INVALID_REQUEST` | 400 `INVALID_REQUEST` |
| 手动推送指定账号（8.5） | 成功 | 请求接受，发送时跳过 | 请求接受，发送时跳过 | 请求接受，发送时跳过 |
| 驳回额度申请 | 成功 | 成功 | 成功 | 成功 |
| 查看（资料、会话、权益、额度流水等） | 成功 | 成功 | 成功 | 成功（行还在时） |

删除任务本身的操作（`retry`）按 13.1 的状态机，不看 `User.status`。

#### 17.4 附：通则与响应字段表

**通则**（对本节所有后台接口成立）：

1. **响应字段**：用第十八节实体的列名，一字不差（驼峰）；`id` 和外键是字符串；时刻是 ISO-8601 UTC；列表是 `{"items":[…],"total":N}`（分页规则见本节开头），不分页的接口只有 `items`。不返回的列只有四类：以 `Hash`、`Enc` 结尾的列（`GET /abuse/clusters` 的 `key` 是写明的例外；哈希类只在已写明的地方给前 8 位，字段名带 `Prefix`）、`tokenVersion`、`totpLastStep`，以及被签名地址替代的存储引用（第 3 条）。实体的列之外，只有下面的字段表和各接口点名的字段，没有点名就没有。管理端前端按它定义类型。
2. **响应里的管理员用户名**：响应里每个管理员 ID 字段旁边都另给一个用户名字段：`xxxBy` 对应 `xxxByUsername`，`adminId` 对应 `adminUsername`，`applicantAdminId` 对应 `applicantUsername`，`reviewerAdminId` 对应 `reviewerUsername`；读取时按 ID 查，管理员已被删除时用户名为 `null`、ID 照旧；字段表各行不再逐个重复。涉及的字段：`AdminAuditLog.adminId`、`LikenessComplaintEvent.adminId`、`CreditAdjustRequest.applicantAdminId`、`reviewerAdminId`、`LikenessComplaint.handledBy`、`ModerationRecord.reviewedBy`、`UsagePrice.confirmedBy`、`reviewedBy`、`PushTask.createdBy`、`PushSchedule.createdBy`、`AppVersionRelease.createdBy`、`activatedBy`、`CheckinActivity.createdBy`、`AttributionCampaign.createdBy`、`AttributionCost.createdBy`、`SavedFunnel.createdBy`、`AdminPermission.createdBy`、`AdCampaign.createdBy`、`updatedBy`、`AdCreative.createdBy`、`reviewedBy`、`EmailTemplate.updatedBy`、`AppConfig.updatedBy`（`GET /config` 每项）、`ClientConfigValue.updatedBy`、`AdminUpload.uploadedBy`、`AccountEntitlement.grantedBy`、`AccountDeletion.requestedBy`、`AccountEmbeddingAssignment.assignedBy`（`GET /accounts/{id}/memory`）、`Notification.sentBy`。**`AdminAuditLog` 例外**：18 章该实体有一列 `adminUsername`（可空），写入时把当时的用户名记进去，之后管理员改名或被删都不改已写的行（审计行要比管理员活得久，不会随 `DELETE /admins` 删除；“谁做的”是审计日志存在的原因）。
3. **响应里的图片地址**：服装和背景目录（`CosmeticItem`）的响应加 `previewUrl`，动作目录（`ActionItem`）加 `iconUrl`，默认数字人加 `sourceImageUrl` 和 `previewUrl`（它唯一外观的预览，未生成时 `null`），`GET /accounts/{id}/avatars` 里每个外观加 `previewUrl`；这些响应不再返回对应的存储引用列（`previewRef`、`iconRef`、`sourceImageRef`、`AvatarLook.previewRef`）。地址是短时效签名地址，有效期取 `moderation.content_url_ttl_seconds`（规则同审核内容的地址，不新增配置键），文件缺失为 `null`；`GET /accounts/{id}/avatars` 是用户的脸，每次调用按 17.2 写审计日志。这是后台响应里的地址，与 3.7、3.8 里客户端目录的预览和图标地址不是一回事，互不影响。
4. **字段的长度单位**：管理端字段的长度（封禁理由、删除理由、通知标题和正文、任务说明、邮件标题、规则文本等）都按 1.9 去首尾空白之后的 Unicode 码点数计；去掉空白后为空的必填字段 → 400 `INVALID_REQUEST`；存去掉空白后的值。
5. **下拉选项来源接口的读取权限**：一个只读列表接口如果是另一个页面表单或筛选的选项来源，持有那个页面权限的管理员也能读：`GET /roles` 另允许 `ADMIN:MANAGE`；`GET /cosmetics` 另允许 `COSMETIC:GRANT`；`GET /attribution/campaigns` 另允许 `ATTRIBUTION:VIEW`；`GET /ads/campaigns` 另允许 `ADS:UNIT`、`ADS:CREATIVE`；`GET /ads/placements` 另允许 `ADS:UNIT`；`GET /ads/units` 另允许 `ADS:CREATIVE`；`GET /entitlement-defs` 另允许 `SUBSCRIPTION:GRANT`。只开放读取，写入接口的权限不变，响应与原权限调用相同。

6. **目录上传接口**（`POST /uploads/catalog-image`、`/uploads/renderer-model`、`/uploads/default-avatar-source`）：都是 `multipart/form-data`，文件字段 `file`；成功返回 `{"uploadId":"<UUID>"}`，每次上传写一条审计日志。类型按文件内容判断（文件头），不看请求声明的类型或扩展名；空文件、超过大小上限、内容类型不在名单里、文件读不出来、图片宽高超过像素上限，一律 400 `INVALID_FILE`，并删除已存的文件。图片先读文件头得到宽高，超过像素上限的直接拒绝，不解码（一张几 KB 的 PNG 可以声明几万乘几万像素，解码会拖垮进程）；在上限以内的大图用抽样解码，解码占用的内存有上限。
   - `catalog-image`（持有 `COSMETIC:MANAGE` 或 `ACTION:MANAGE`；服装、背景的预览图和动作的图标）：`image/jpeg`、`image/png`；不超过 2097152 字节（2 MiB）；宽×高不超过 36000000；这两个上限是工程常量，不设配置键；解码后重新编码以去掉元数据，尺寸不变，JPEG 仍存 JPEG，PNG 仍存 PNG 并保留透明通道。
   - `renderer-model`（`RENDERER:MANAGE`；渲染模型的 zip 包）：`application/zip`；不超过 `upload.render_asset_max_bytes`（17.5）；必须是 zip，根目录有 `manifest.json`，其中的 `rendererKind` 是字符串，不合格 400 `INVALID_FILE`；上传时流式计算 SHA-256，记进 `AdminUpload.sha256`，登记渲染模型时 `sha256`、`sizeBytes` 取自上传记录，请求里带了一律忽略。
   - `default-avatar-source`（`DEFAULT_AVATAR:MANAGE`；有肖像授权的默认数字人源图）：`image/jpeg`、`image/png`；上传时不超过 `upload.max_bytes`（3.2，默认 200 MB）；宽×高不超过 250000000；处理按 3.2 的照片规则——应用 EXIF 方向、重新编码为 JPEG（质量 95）、长边超过 3072 像素等比缩小、不写任何元数据；**处理之后仍大于 19000000 字节 → 400 `INVALID_FILE`**（3.5 给形象生成服务的请求体上限是 20000000 字节，留出余量）；存下的是处理后的文件。

**字段表**（逐接口；上面的通则对每一行都成立）：

**1. `GET /client-config`** → `{"items":[{"key","type","localized","readOnly","configured","defaultValue","values","updatedBy","updatedByUsername","updatedAt"}]}`，登记的全部键各一项，按 `key` 升序，不分页。`type` 取 `URL`、`EMAIL`、`STRING`、`BOOLEAN`、`INT`、`STRING_LIST`；`readOnly` 为真是取自系统配置、不能编辑的六个键；`configured` 表示库里有这个键的值（`readOnly` 的键恒为真）；`defaultValue` 是登记的默认值，没有为 `null`（`readOnly` 的键为 `null`，值在 `values` 里）；`values` 是 `{"<语言标签>":值}`，空字符串键是默认值，`localized` 为假的键只有空字符串键，没配置的键是 `{}`，`readOnly` 的键是 `{"":<当前系统配置值>}`，值的 JSON 类型与 `PUT` 在同一位置接受的一致；`updatedBy…` 取各语言行里最近更新的那一行，没有行为 `null`。登记表里“客户端使用点”的说明文字不在接口里，在管理端前端的语言文件里，以 `key` 为索引（无广告原因的说明文字同理，22.9）。

**2. `GET /entitlement-defs`** → `{"items":[{"key","name","priority","features":[{"featureKey","mode","value"}]}]}`，按 `priority` 升序；`features` 列出全部已声明的功能开关（按 `featureKey` 升序），形状同 `PUT /entitlement-defs/{key}/features` 的请求：`mode` 取 `VALUE`、`UNLIMITED`、`UNSET`（没有配置行就是 `UNSET`），`value` 只在 `VALUE` 时有值，否则 `null`。**`GET /feature-gates`** → `{"items":[{"key","kind","limitScope","defaultMode","defaultValue","creditCost","description"}]}`，按 `key` 升序，不分页；`limitScope` 仅 `LIMIT` 类有值；`defaultMode` 取 `VALUE`、`UNLIMITED`、`UNSET`（形状同 `PUT /feature-gates/{key}/default` 的请求；`UNSET` 只会出现在五个额度键上）；`defaultValue` 只在 `VALUE` 时有值；`creditCost` 没有时 `null`。

**3. `GET /subscriptions/{id}`** → `Subscription` 的全部列（含 `accountId`）加 `events`：`[{"id","type","subtype","eventSignedAt","receivedAt","processedAt","error","needsAttention"}]`，按 `eventSignedAt` 倒序、相同按 `receivedAt` 倒序，不分页，不含 `payload`。`GET /subscriptions` 每项是 `Subscription` 的列，没有 `events`。

**4. `GET /accounts/{id}/entitlements`** → `{"effective":[{"featureKey","kind","mode","value","source","entitlementKey"}],"entitlements":[…]}`。`effective` 每个已声明的功能开关一项，是该账号现在的生效值，`mode`、`value` 含义同第 2 行；`source` 取 `ENTITLEMENT`（胜出的值来自某个权益，`entitlementKey` 是它）、`DEFAULT`（胜出的值来自功能开关的默认值，数值并列时算默认值）、`NONE`（没有任何值，`mode` 为 `UNSET`）。`entitlements` 是该账号全部 `AccountEntitlement` 行（`STORE` 和 `PROMO`，列名不变）加 `entitlementName` 和 `status`（`ACTIVE`、`EXPIRED`、`REVOKED`），按 `startsAt` 倒序；撤销按钮只对 `source=PROMO` 且 `status=ACTIVE` 的行显示。

**5. `GET /accounts/{id}/credits?page=&pageSize=`** → `{"balance","totalEarned","totalSpent","items":[…],"total"}`，分页的是流水：`items` 每项是 `CreditLedger` 的列去掉 `idempotencyKey`（`id`、`delta`、`reason`、`purchaseId`、`eventKey`、`spendKind`、`featureKey`、`itemKey`、`quantity`、`note`、`createdAt`），按 `id` 倒序；没有额度账户的账号三个合计都是 0、`items` 为空，不是 404。

**6. `GET /users/{id}`** → `User` 的列，名字不变：`id`、`email`、`emailVerifiedAt`、`phone`、`phoneVerifiedAt`（邮箱、手机号的掩码与列表一致）、`status`、`banReason`、`bannedAt`、`currentAvatarAssetId`、`currentVoiceAssetId`、`personaModerationStatus`、`companionName`、`timezone`、`conversationLanguage`、`lifetimeGrantSeconds`、`lifetimeUsedSeconds`、`channelCode`、`registerPlatform`、`priorInviteeRewarded`、`inviteRewardedCount`、`createdAt`。不返回：`passwordHash`、`googleSub`、`appleSub`、`registerDeviceHash`、`persona`、`personaPending`、`personaPendingRef`、`companionNameRef`。派生字段：`loginMethods`（`EMAIL`、`PHONE`、`GOOGLE`、`APPLE` 中账号现有的，字符串数组）、`trafficType`（`PAID` 或 `ORGANIC`）、`companionship`（`{"interactionCount","currentStreak","lastInteractionDate","lastInteractionAt"}`，没有养成数据时 `0`、`0`、`null`、`null`）、`counts`（`{"avatars","voices","looks","cosmetics"}` 四个整数）、`attribution`（`{"source","matchType","mediaSource","campaign","installTime","registeredAt"}`，没有归因记录时整个字段为 `null`）。

**7. `GET /accounts/{id}/avatars`** → `{"avatars":[{"assetId","name","style","createdAt","currentLookId","isCurrent","looks":[{"lookId","status","outfitItemId","backgroundItemId","previewUrl","createdAt"}]}],"cosmetics":[{"itemId","itemKey","source","creditLedgerId","grantedAt"}]}`。`avatars` 按 `createdAt` 倒序；`style` 在形象上，不在外观上；`previewUrl` 是用户的脸的短时效签名地址（通则第 3 条），文件缺失为 `null`，每次调用写一条审计日志；`source` 取 `CREDITS`、`ADMIN_GRANT`。

**8. `GET /users/{id}/devices`** → `{"items":[{"id","platform","appVersion","locale","lastSeenAt","tokenSuffix"}]}`，按 `lastSeenAt` 倒序，不分页；`tokenSuffix` 是推送 token 的末 6 位，完整 token 不返回。**`GET /users/{id}/auth-events`** → `{"items":[{"type","reason","deviceIdHashPrefix","ipHashPrefix","at"}],"total"}`，按 `at` 倒序；两个哈希只给前 8 位，所以字段名带 `Prefix`；设备哈希为空时 `deviceIdHashPrefix` 为 `null`。

**9. `GET /abuse/clusters/accounts`** → `{"items":[{"accountId","createdAt","status","paid","registerMethod"}],"total"}`；`paid` 是布尔；`registerMethod` 取 `EMAIL`、`GOOGLE`、`APPLE`、`PHONE`。

**10. `GET /invites/codes`** → `{"items":[{"id","code","ownerAccountId","createdAt"}],"total"}`（`createdAt` 是所有者账号的创建时间）。**`GET /invites/records`** → `{"items":[{"id","inviterAccountId","inviteeAccountId","inviterLabel","inviteeLabel","redeemedAt","rewardStatus","rewardReason","inviterCreditsGranted","inviteeCreditsGranted","rewardedAt"}],"total"}`，按 `redeemedAt` 倒序；`inviterLabel`、`inviteeLabel` 是掩码标识（与导出里同一个算法），列表页显示它们。

**11. `GET /attribution/clicks`** → `{"items":[{"id","clickedAt","campaignId","campaignName","status","channel","utmSource","utmMedium","utmCampaign","ip","claimedAt"}],"total"}`，按 `clickedAt` 倒序；`status` 取 `PENDING`、`MATCHED`、`EXPIRED`；`channel` 取 `STORE_REDIRECT`、`APK_DOWNLOAD`；`ip` 默认掩码，持有 `ANALYTICS:IP_VIEW` 才完整；不返回 `attrId`、`userAgent`。**`GET /attribution/campaigns`** → `{"items":[…],"total"}`，每项是 `AttributionCampaign` 的列（`id`、`code`、`name`、`mediaSource`、`utmMedium`、`campaign`、`adset`、`ad`、`facebookPixelId`、`googlePixelId`、`tiktokPixelId`、`remark`、`enabled`、`createdBy`、`createdAt`、`updatedAt`）加 `createdByUsername`、`channelCodes`（渠道码数组）和 `facebookAccessTokenSet`（布尔，“是否已设置”的字段名就是它）。

**12. `GET /usage/prices`** → `{"items":[批次],"total"}`，一项一个批次，按 `resourceType`、`provider`、`model`、`unit` 升序、同模型内 `effectiveFrom` 倒序；批次：`{"batchId","resourceType","provider","model","unit","effectiveFrom","currency","status","source","confirmedBy","confirmedByUsername","confirmedAt","reviewedBy","reviewedByUsername","reviewedAt","reviewNote","createdAt","bands","unitPrice"}`；`LLM` 批次 `bands` 是 `[{"inputMinTokens","inputMaxTokens","inputPrice","cachedInputPrice","outputPrice"}]`（按下限升序）、`unitPrice` 为 `null`，其他类型 `unitPrice` 是数、`bands` 为 `null`；价格一律是字符串形式的十进制数，不经过浮点；不返回 `rawSnapshot`。**`GET /usage/price-batches/pending`** → `{"items":[…]}`，每项是上面的批次形状（`status=PENDING_REVIEW`）加 `active`：同一 `(resourceType, provider, model, unit)` 今天生效的 `ACTIVE` 批次（同一形状），没有则 `null`，页面据此逐档对比。**`GET /usage/models`** → `{"items":[…],"total"}`，每项是 `UsageModel` 的列（`id`、`resourceType`、`provider`、`model`、`syncAdapter`、`syncModelId`、`firstSeenAt`、`lastSeenAt`）加 `hasActivePrice`（布尔：任一计量单位上存在今天已生效的 `ACTIVE` 批次）。

**13. `GET /analytics/event-summary`** → `{"items":[{"eventName","pv","uv"}]}`，不分页，按 `pv` 倒序、相同按 `eventName` 升序。**`GET /analytics/event-names`** → `{"items":["app_open",…]}`，字符串数组，按名字升序。**`GET /analytics/funnel`** → `{"steps":[{"eventName","count","conversionFromPrevious"}]}`，与请求的 `steps` 同序同数，`count` 是该步去重主体数，`conversionFromPrevious` 是 0 到 1 的小数；第一步，以及上一步 `count` 为 0 时为 `null`。

**14. `GET /email/templates`** → `{"items":[{"templateCode","subject","body","defaultSubject","defaultBody","modified","updatedBy","updatedByUsername","updatedAt","placeholders","requiredPlaceholders"}]}`，五个模板码各一项、按 `templateCode` 升序、不分页。`subject`、`body` 是当前生效的文案（没改过时等于默认）；`modified` 表示库里有这一行；三个修改人时间字段没改过为 `null`；`reset` 之后与从未改过一样；`placeholders` 是可用的占位符，`requiredPlaceholders` 是必须含的，都由后端声明，页面据此提示，不用写死。**两个数组的每一项都带花括号，和模板正文里写的一样（例如 `"{code}"`）；`PUT` 的必含检查就是正文里含这个带花括号的字符串，区分大小写，缺了返回 400 `INVALID_REQUEST`。**

**15. `GET /admins`** → `{"items":[…],"total"}`，每项是 `AdminUser` 的列 `id`、`username`、`superAdmin`、`status`、`mustChangePassword`、`totpEnrolledAt`、`lastLoginAt`、`createdAt` 加 `roles`（`[{"id","name"}]`，按名字升序）。**`GET /roles`** → `{"items":[…],"total"}`，每项是 `AdminRole` 的列 `id`、`name`、`remark`、`createdAt` 加 `permissionCodes`（字符串数组，升序）。两个接口都分页；管理员表单里选角色，用 `pageSize=200` 一次取完。

**16. `GET /notifications`** → `{"items":[{"id","accountId","category","title","isRead","linkType","linkTarget","sentBy","sentByUsername","createdAt"}],"total"}`，按 `createdAt` 倒序；`title` 是英文标题：`ADMIN` 类取 `titleI18n.en`，`SYSTEM_EVENT` 类是按 `templateKey` 和参数渲染的英文。**`GET /notifications/{id}`** → `Notification` 的全部列（`id`、`accountId`、`category`、`titleI18n`、`bodyI18n`、`templateKey`、`templateParams`、`linkType`、`linkTarget`、`isRead`、`sentBy`、`createdAt`）加 `sentByUsername`；`SYSTEM_EVENT` 的 `titleI18n`、`bodyI18n` 为 `null`，`ADMIN` 的 `templateKey`、`templateParams` 为 `null`。

**17. `GET /checkin/activities`** 每项是 `CheckinActivity` 的列（`id`、`name`、`startDate`、`endDate`、`status`、`createdBy`、`createdAt`、`updatedAt`）加 `createdByUsername`、`lifecycleStatus`；**`GET /checkin/activities/{id}`** 另加 `rewards`：`[{"dayNum","rewardCredits","bonusCredits"}]`，按 `dayNum` 升序（不返回 `activityId`）。**`GET /checkin/records`** 每项是 `CheckinRecord` 的列加 `activityName`；**`GET /tasks/records`** 每项是 `TaskRecord` 的列加 `taskName`。名称是读取时的当前名称，对象不存在时 `null`，ID 照旧。

**18. `GET /ads/report/by-placement`** 每行 `placementId`、`slotKey`、`placementName` 加指标；`by-campaign` 每行 `campaignId`、`campaignName`；`by-creative` 每行 `creativeId`、`creativeTitle`（素材的 `title`，没有为 `null`）；`by-country` 每行 `country`（空串表示未知）；指标字段是 22.9 列的那些。**`GET /ads/report/nofill`** 的行仍是 `{statDate, slotKey, reason, cnt}`，不加 `platform`、`channelCode`；不传筛选时是全部平台、全部渠道的合计，要分开看用页面上的 `platform`、`channelCode` 筛选。

**19. `GET /likeness-complaints`（列表）和 `/{id}`（详情）** 每项是 `LikenessComplaint` 的列（`id`、`contactEmail`、`description`、`status`、`receivedAt`、`dueAt`、`resolvedAt`、`handledBy`、`relatedAvatarAssetIds`）加 `handledByUsername`、`overdue`（布尔）、`evidenceCount`（整数）；不返回 `evidenceRefs`，证据只经 `GET /likeness-complaints/{id}/evidence/{index}` 读（写审计日志）。详情另有 `events`：`[{"id","fromStatus","toStatus","note","adminId","adminUsername","createdAt"}]`，按 `createdAt` 升序。

**20. `GET /default-avatars`** 的形状见 3.10。

### 17.5 运营可调参数（`AppConfig`）

运营可调参数存 `AppConfig(key, value(JSON), updatedBy, updatedAt)`，进程内缓存；写入后在 Redis 把版本号 `appconfig_version` 加一，每个实例读配置前比对版本号，变了就重新加载，所以任何实例的下一次请求都读到新值，通过 `PUT /api/admin/config/{key}` 修改（17.4）。默认值只是代码里的常量，就是下表里的这些，不散落魔法数字；`AppConfig` 里只有被 `PUT` 保存过的键才有一行，数据库迁移不写默认值。每个键有"编辑权限"：`CONFIG:MANAGE` 是系统级键，其余是对应模块的权限。"无默认值"的键，未配置时相关功能不可用或启动失败，见"说明"。以下默认值里，标"提议"的是我给的起点，可调；其余出自前面各节的需求。**取值校验**（`PUT /config/{key}` 返回 400 `INVALID_REQUEST`，`data.details` 写明键）：布尔键只接受 `true`/`false`；整数键在各行没有另写范围时必须是整数，`*_days`、`*_hours`、`*_minutes`、`*_seconds`、`*_per_*`、`*_max_*` 一律不小于 1（“0 表示不限/关闭”的键在各行写明）；关系约束：`retry.initial_seconds ≤ retry.max_seconds`、`auth.password_max_length ≥ 8`（最短密码长度固定为 8，2.2；小于 8 时注册和重置密码都无法成功）、`export.job_timeout_minutes > export.lease_minutes`、`auth.access_ttl_minutes ≤ auth.refresh_ttl_days × 1440`、`moderation.review_score < moderation.block_score`、`events.ttl_days ≥ 30 + stats.land_window_days`（wau/mau 和 `silenceDays=30` 的回流要回看 30 天，窗口重算时这些事件不能已经过期）、`stats.land_window_days ≥ 1`。**另外**：`persona.max_length`、`upload.max_bytes`、`events.max_batch`、`events.max_body_kb`、`export.max_rows`、`export.max_attempts`、`retry.max_attempts`、`monitor.max_points`、`sms.send_timeout_ms`、`notification.max_recipients`、`moderation.text_rules_max`、`attribution.cost_batch_max`、`entitlement.limit_max`、`usage_price.max_bands`、`usage.max_batch`、`sms.daily_global_cap` 必须不小于 1；`ads.creative_aspect_tolerance_percent` 在 0 到 20；`recall.local_send_hour`、`usage_price.sync_hour_utc` 在 0 到 23。**JSON 型键**：`companionship.stage_thresholds` 的各阈值是正整数且随阶段严格递增；`milestone.days` 是 1 到 20 个互不相同的正整数；`app.supported_locales` 的元素匹配 `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`、不超过 35 个字符、互不相同、含 `en`；`sms.allowed_country_codes` 的元素是 ISO 3166-1 alpha-2（两个大写字母）；`chat.conversation_languages` 的元素是两位小写 ISO 639-1 代码；不合格 400 `INVALID_REQUEST`。

**每个键要分清是"策略"还是"发放"。** 策略（限流、阈值、有效期、校验范围）在每次评估时读当前值，改了对所有人立刻生效。发放（把一个具体数量给某个对象，之后由它消耗）必须在发放时把数量记入那条记录，之后改配置只影响之后的发放，否则历史记录的含义会跟着配置变。已核实的发放类键：`guest.call_minutes_total` 记入 `GuestDevice.grantedSeconds`（2.1）；`call.lifetime_minutes`（功能开关，不是 `AppConfig` 行）记入 `User.lifetimeGrantSeconds`（15.6）；广告位的 `rewardCredits` 在请求广告时记入 `AdRewardVerification.creditsGranted`（22.4 第 9 步）；`invite.inviter_reward_credits`、`invite.invitee_reward_credits` 在评估奖励时记入 `InviteRecord.inviterCreditsGranted`、`inviteeCreditsGranted`（9.1）；`session.max_duration_minutes` 在发起会话时折算进 `Session.deadlineAt`（4.1 第 2 步）；`auth.*` 的有效期折算进令牌的 `exp`；`deletion.grace_days` 记入 `AccountDeletion.executeAfter`（13.1）；`deletion.abuse_marker_retention_days` 记入 `AbuseMarker.expireAt`（13.5）。新增会发放数量的键，必须在说明列写明记入哪个字段。

| key | 默认值 | 出处 | 编辑权限 | 说明 |
|-----|--------|------|---------|------|
| `auth.access_ttl_minutes` | 1440 | 2.6 | `CONFIG:MANAGE` | 与 dramaBox 一致（24 小时）；游客凭据同用此有效期（2.1）；保存时必须不大于 `auth.refresh_ttl_days` 换算成的分钟数，否则 `INVALID_REQUEST`（2.6 撤销"所有链"的依据） |
| `auth.refresh_ttl_days` | 30 | 2.6 | `CONFIG:MANAGE` | 与 dramaBox 一致（30 天）；保存时按天换算后不得小于 `auth.access_ttl_minutes`（向上取整），否则 `INVALID_REQUEST` |
| `auth.refresh_reuse_grace_seconds` | 10 | 2.6 | `CONFIG:MANAGE` | refresh token 轮换后的重放宽限，宽限内返回与第一次相同的令牌对，不判盗用 |
| `guest.call_minutes_total` | 空（未配置按 0，游客不能通话） | 2.1、4.3 | `CONFIG:MANAGE` | 每台游客设备终身一次性的通话额度，单位分钟；没有代码默认值，数值是产品和运营的决定；只影响之后发放的设备，已有设备的 `grantedSeconds` 不变（2.1）；重装应用可绕过（2.1 的已知限制），按这个风险设小 |
| `auth.reset_token_ttl_minutes` | 30 | 2.9 | `CONFIG:MANAGE` | 提议 |
| `admin.jwt_ttl_hours` | 8 | 17.2 | `CONFIG:MANAGE` | |
| `admin.rate_limit_per_min` | 300 | 17.2 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.guest_per_ip_per_hour` | 20 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `guest.session_retention_days` | 90 | 4.3 | `CONFIG:MANAGE` | 提议，游客 `Session` 记录的保留天数 |
| `integrity.check_enabled` | `true` | 2.1、2.2、2.7、23.2 | `CONFIG:MANAGE` | 游客凭据和新建账号的设备校验开关；非生产环境可以设为 `false`；生产环境保存 `false` 返回 400 `INVALID_REQUEST` |
| `ratelimit.guest_per_device_per_hour` | 5 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.register_per_ip_per_hour` | 20 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.email_otp_per_ip_per_hour` | 20 | 1.6、2.2.1 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.reset_confirm_per_ip_per_hour` | 20 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.deletion_confirm_per_ip_per_hour` | 20 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.api_per_account_per_min` | 120 | 1.6 | `CONFIG:MANAGE` | 提议，所有已登录接口的兜底限制 |
| `internal.signature_window_seconds` | 300 | 1.8 | `CONFIG:MANAGE` | 提议，内部调用签名的时间戳窗口 |
| `ratelimit.sensitive_per_account_per_hour` | 10 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.login_per_ip_per_hour` | 100 | 2.3 | `CONFIG:MANAGE` | 提议，同一 IP 每小时跨邮箱的登录请求数，防密码喷洒 |
| `auth.login_max_failures_per_account` | 10 | 2.3 | `CONFIG:MANAGE` | 提议 |
| `auth.login_failure_window_minutes` | 15 | 2.3 | `CONFIG:MANAGE` | 提议 |
| `auth.password_max_length` | 128 | 2.2 | `CONFIG:MANAGE` | 提议，防止超长密码拖慢哈希；保存时必须不小于 8，否则 `INVALID_REQUEST` |
| `auth.log_retention_days` | 180 | 2.11 | `CONFIG:MANAGE` | 提议，认证事件日志的保留天数；记入每条的 `expireAt`，改配置只影响之后写入的记录 |
| `email.link_base_url` | 无默认值 | 2.9、13.4 | `CONFIG:MANAGE` | 邮件里链接的根地址，必须是 https、不带末尾斜杠、可以带路径前缀（如 `https://app.example.com/m`），保存时按 1.7 的规则校验；没有配置时需要链接的邮件（密码重置、删除确认）发不出去，返回 503 `EMAIL_SEND_FAILED`。链接只取这个配置，**不取请求的 Host 头** |
| `abuse.audit_retention_days` | 90 | 17.4 | `CONFIG:MANAGE` | 提议，注册审计的保留天数 |
| `tokens.cleanup_grace_days` | 1 | 18 | `CONFIG:MANAGE` | 提议，过期的刷新令牌（只按 `expiresAt`，已轮换的行在自己的有效期内必须保留，2.6）、过期或已使用的重置令牌和删除确认令牌多留几天再清理 |
| `maintenance.done_job_retention_days` | 30 | 18 | `CONFIG:MANAGE` | 提议，已完成的外部删除任务保留多少天 |
| `maintenance.resolved_alert_retention_days` | 180 | 18 | `CONFIG:MANAGE` | 提议，已解决的后台告警保留多少天 |
| `abuse.cluster_min_free_accounts` | 5 | 17.4 | `CONFIG:MANAGE` | 提议，多开检测默认只列出免费账号数不小于它的聚类 |
| `call.free_daily_alert_minutes` | 无默认值 | 15.6 | `CONFIG:MANAGE` | 当日免费通话（免费账号和游客）总分钟数达到它时写后台告警，只告警不拒绝；没有配置不告警 |
| `email.otp_ttl_seconds` | 600 | 2.2.1 | `CONFIG:MANAGE` | 提议，邮箱验证码有效期 |
| `email.otp_resend_seconds` | 60 | 2.2.1 | `CONFIG:MANAGE` | 提议，同一邮箱两次发送的最小间隔 |
| `email.otp_max_attempts` | 5 | 2.2.1 | `CONFIG:MANAGE` | 提议，一个验证码最多错几次 |
| `email.max_per_address_per_day` | 10 | 2.2.1 | `CONFIG:MANAGE` | 提议，同一邮箱滚动 24 小时内最多发几次 |
| `ratelimit.login_per_min` | 10 | 1.6 | `CONFIG:MANAGE` | 提议，按 IP+邮箱；邮箱登录按 IP+邮箱，手机号登录按 IP+号码，共用此键 |
| `ratelimit.refresh_per_min` | 30 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.reset_per_ip_per_hour` | 10 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.push_token_per_ip_per_hour` | 60 | 1.6、8.1 | `CONFIG:MANAGE` | 提议，游客登记推送 token 的限流 |
| `ratelimit.chat_per_account_per_min` | 20 | 1.6、5.4 | `CONFIG:MANAGE` | 提议，只防脚本，成本上限靠 15.6 的文字额度 |
| `ratelimit.link_mail_per_email_per_hour` | 3 | 1.6、2.9、13.4 | `CONFIG:MANAGE` | 提议，同一邮箱每小时最多触发几封带链接的邮件（重置密码、网页删除确认）；超出时仍返回成功，不发信 |
| `ratelimit.public_deletion_per_ip_per_hour` | 5 | 1.6 | `CONFIG:MANAGE` | 提议 |
| `persona.max_length` | 2000 | 2.5 | `CONFIG:MANAGE` | Unicode 码点数 |
| `chat.conversation_languages` | `["ar","my","zh","da","nl","en","fi","fr","de","el","he","hi","id","it","ja","km","ko","lo","ms","no","pl","pt","ru","es","sw","sv","tl","th","tr","vi"]` | 2.10 | `CONFIG:MANAGE` | 允许用户选的会话语言。**不能比 AvatarAgent 的识别服务与合成服务都会说的语言更长**，往里加新语言之前先确认对方两个服务都支持，否则用户会得到一个静默说英语的数字人。保存后同时使客户端配置缓存失效（26.1，`conversationLanguages` 来自它）。保存时列表必须包含 `en`（会话语言的回退值是 `en`，2.10），否则 `INVALID_REQUEST` |
| `upload.max_bytes` | 209715200 | 3.2 | `CONFIG:MANAGE` | 200 MB |
| `voice.transcript_max_chars` | 1000 | 3.2 | `CONFIG:MANAGE` | 保存时必须在 1 到 1000 之间（合成服务只接受 1 到 1000 个字符，3.5）；保存后同时使客户端配置缓存失效（26.1，`voiceTranscriptMaxChars` 来自它） |
| `generation.poll_interval_seconds` | 5 | 3.5 | `CONFIG:MANAGE` | |
| `generation.voice_timeout_seconds` | 120 | 3.5 | `CONFIG:MANAGE` | 提议 |
| `generation.voice_min_seconds` | 1 | 3.2 | `CONFIG:MANAGE` | 声音样本最短时长，必须与合成服务的限制一致（3.5）；保存时必须在 1 到 30 之间且不大于 `generation.voice_max_seconds`；保存后同时使客户端配置缓存失效（`voiceMinSeconds` 来自它） |
| `generation.voice_max_seconds` | 30 | 3.2 | `CONFIG:MANAGE` | 声音样本最长时长，同上；保存时必须在 1 到 30 之间且不小于 `generation.voice_min_seconds`；保存后同时使客户端配置缓存失效（`voiceMaxSeconds` 来自它） |
| `generation.avatar_timeout_minutes` | 60 | 3.5 | `CONFIG:MANAGE` | 提议，形象生成可能排队。`AVATAR`、`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP` 任务从提交起的超时，等待生成结果复核（`IN_REVIEW`）的时间不计入 |
| `generation.max_attempts` | 3 | 3.5 | `CONFIG:MANAGE` | 形象生成总共最多尝试几次，含第一次；每次尝试一次图像编辑，任何一项自动检查不合格（3.5）都作废这一次；用完仍不合格任务 `FAILED`（`GENERATION_FAILED`）。默认值按 `qwen-image-3.0` 的标价（输入 0.003 + 输出 0.03 美元/张，每次尝试一张）和 spike 的成功率估计 [推断]。保存时校验 1 到 10 的整数（AvatarEngine 只接受这个范围，范围外的值会让每个生成任务提交失败，3.5）。随提交请求传给形象生成服务（服务自己不读本后端的配置，形象渲染设计 13.6） |
| `generation.reprepare_max_attempts` | 5 | 3.9 | `CONFIG:MANAGE` | 某个外观某个格式版本的驱动资源包（`LookPackage`）准备失败多少次后不再自动重试，并写告警 `LOOK_PACKAGE_PREPARE_FAILED`；两次之间按 `retry.initial_seconds`、`retry.max_seconds` 指数退避 |
| `avatar.download_url_ttl_seconds` | 3600 | 3.9 | `CONFIG:MANAGE` | 外观的标准图、动作片段、驱动资源包和渲染模型的签名下载地址的有效期（3.9、3.10），响应的 `expiresAt` = 签发时刻 + 它。默认值按一个片段或资源包在慢速网络上下载完、又不让地址长期有效估计 [推断] |
| `generation.mouth_open_min_area` | 无默认值 | 3.5 | `CONFIG:MANAGE` | 露齿检查：嘴唇内缘的最小面积。**单位**：面积 = 嘴唇内缘多边形（MediaPipe 人脸关键点 78、191、80、81、82、13、312、311、310、415、308、324、318、402、317、14、87、178、88、95）内的像素数 ÷ 两眼外眼角（关键点 33、263）距离的平方，没有单位，与图片分辨率无关；建议值 0.035（AvatarEngine 2026-10-18 在半身场景构图上实测，43 张输出、7 个人；换图像编辑模型、提示词或构图后要重测）。保持无默认值：这个值跟着 AvatarEngine 用的图像编辑模型和提示词走，本后端的代码默认值不会随它变。保存时校验是数字且大于 0（等于 0 就是不检查）。**它和 `generation.mouth_open_min_brightness` 任一未配置时，本后端不向形象生成服务提交任务**：上传形象、新建外观返回 503 `GENERATION_NOT_CONFIGURED`（1.4），并写告警 `GENERATION_CONFIG_MISSING`（17.4） |
| `generation.mouth_open_min_brightness` | 无默认值 | 3.5 | `CONFIG:MANAGE` | 露齿检查：嘴唇内缘的最小平均亮度。**单位**：亮度 = 上一行那个嘴唇内缘多边形内像素 RGB 三通道的平均值，0–255；建议值 50（依据同上一行；75 会误挡很深肤色在暖光下明显露齿的图）；保持无默认值，理由同上一行；保存时校验是 0 到 255 之间的数字；未配置时的处理同上一行 |
| `generation.ai_label_enabled` | `true` | 3.5 | `CONFIG:MANAGE` | 生成的标准图和动作片段是否写入机器可读的"AI 生成"标记（欧盟 AI 法第 50 条，具体要求待核实原文，形象渲染设计 10.5） |
| `avatar.realistic_enabled` | `true` | 3.2 | `CONFIG:MANAGE` | 是否允许写实风格 `REALISTIC`；为 `false` 时上传 `REALISTIC` 返回 400 `INVALID_REQUEST`，`GET /api/avatar-upload-options` 不返回它 |
| `avatar.declaration_required` | `true` | 3.2 | `CONFIG:MANAGE` | 是否必须勾选上传声明；为 `false` 时客户端不显示声明，`declarationVersion` 可以省略 |
| `avatar.source_photo_retention_days` | 0 | 3.2 | `CONFIG:MANAGE` | 形象原照保留多少天；0 表示随形象的生命周期（3.2 现有规则）。大于 0 时从 `AvatarAsset.createdAt`（形象生成成功）起算，到期由每天一次的清理任务删除原照（`AvatarAsset.originalFileRef` 置空），代价有两个：之后换装只能从当前外观的标准图出发（3.6），收到照片里的人投诉时无法用原照比对、只能人工查找（11.6） |
| `avatar.deletion_due_hours` | 72 | 17.4 | `CONFIG:MANAGE` | 删除形象、外观或账号后，文件和形象生成服务里的副本必须在多少小时内删完；外部删除任务（13.2）超过这个时限仍未完成就写告警 `AVATAR_DELETION_OVERDUE`（17.4）。默认值参考外部删除任务现有的重试节奏 [推断，形象渲染设计写明"待契约核对"，还没有核对] |
| `avatar.look_credit_price` | 0 | 3.6 | `CONFIG:MANAGE` | 新建外观消耗多少额度；0 表示免费；`avatar.look_free` 为真的账号不收 |
| `render.cloud_enabled` | `false` | 4.1 | `CONFIG:MANAGE` | 这套部署是否开放云端渲染档（`renderMode=CLOUD`）；还要同时满足账号功能开关 `render.cloud`。默认 `false`：打开会产生服务器成本。云端渲染用与手机相同的格式 1 渲染模型（形象渲染设计第 9 节），许可状况照实记录、以后再谈，不阻止打开 |
| `retry.initial_seconds` | 60 | 12、13.1、13.2、3.9、15.6、15.9 | `CONFIG:MANAGE` | 提议，账号删除、外部删除、客服转发、外观资源包准备失败（3.9）后的退避起点 |
| `retry.max_seconds` | 21600 | 12、13.1、13.2、3.9、15.6、15.9 | `CONFIG:MANAGE` | 提议，退避上限 6 小时 |
| `retry.max_attempts` | 10 | 12、13.1 | `CONFIG:MANAGE` | 提议，客服转发连续失败多少次后置 `FAILED`；账号删除不受此限制（13.1，不会放弃，只告警） |
| `chat.history_max_limit` | 200 | 5.2 | `CONFIG:MANAGE` | |
| `chat.messages_max_batch` | 50 | 5.1 | `CONFIG:MANAGE` | 提议，单次写入的消息条数上限 |
| `chat.message_max_chars` | 10000 | 5.1、5.4 | `CONFIG:MANAGE` | 提议，单条消息的字符上限（文字对话的用户消息同样适用） |
| `chat.turn_timeout_seconds` | 60 | 5.4 | `CONFIG:MANAGE` | 提议，一轮文字对话从调用 agent 到收到 `done` 的最长时间，超时算失败 |
| `chat.turn_lock_grace_seconds` | 30 | 5.4 | `CONFIG:MANAGE` | 提议，文字轮次的锁和清扫在 `chat.turn_timeout_seconds` 之外多留的时间（收尾和 ingest 用） |
| `chat.ingest_timeout_seconds` | 10 | 5.4 | `CONFIG:MANAGE` | 提议，轮次完成后写入记忆的最长等待，失败不重试 |
| `chat.sse_keepalive_seconds` | 15 | 5.4 | `CONFIG:MANAGE` | 提议，流式响应的保活间隔 |
| `chat.turn_sweep_seconds` | 60 | 5.4 | `CONFIG:MANAGE` | 提议，把超时的 `PENDING` 文字轮次置 `FAILED` 的扫描间隔 |
| `chat.text_context_messages` | 20 | 5.4 | `CONFIG:MANAGE` | 提议，文字对话调用 agent 时带上的最近消息条数（含通话期间的消息）；这是每轮 LLM 输入成本的直接参数 |
| `attribution.link_base_url` | 无默认值 | 10.4 | `ATTRIBUTION:MANAGE` | 归因链接的根地址（https，不带末尾斜杠，保存时按 1.7 校验）；没有配置时后台拿不到完整链接 |
| `attribution.play_store_url` | 无默认值 | 10.4 | `ATTRIBUTION:MANAGE` | Android 商店页链接，必须是 `https://play.google.com/store/apps/details?id=<包名>`，规则同 24.2 的 Android 链接（保存时校验）；没有配置时 Android 的归因链接返回 404 |
| `attribution.other_platform_url` | 无默认值 | 10.4 | `ATTRIBUTION:MANAGE` | 非 Android 设备打开归因链接时的跳转地址（https，按 1.7 校验）；没有配置时这些设备得到 404，也不记点击 |
| `attribution.click_retention_days` | 30 | 10.4 | `ATTRIBUTION:MANAGE` | 点击记录的保留天数，不小于 1，且不小于 `attribution.fingerprint_window_hours` 换算成天数后向上取整的值，否则 `INVALID_REQUEST`；记入每条的 `expireAt`，改配置只影响之后写入的记录 |
| `attribution.fingerprint_window_hours` | 24 | 10.4 | `ATTRIBUTION:MANAGE` | 指纹兜底匹配的窗口：点击到认领之间最长多久；不得超过 `attribution.click_retention_days` 换算成的小时数，否则 `INVALID_REQUEST`；照 dramaBox 的 24 小时 |
| `attribution.record_retention_days` | 365 | 10.4 | `ATTRIBUTION:MANAGE` | 提议，没有账号的归因记录和认领记录的保留天数，不小于 1 |
| `attribution.cost_currency` | `USD` | 10.5 | `ATTRIBUTION:MANAGE` | 投放成本的币种（ISO 4217 三位字母），整个系统一种，所以 CPA 可以直接算 |
| `attribution.cost_batch_max` | 1000 | 10.5 | `ATTRIBUTION:MANAGE` | 提议，批量录入投放成本一次最多几行 |
| `attribution.click_expired_keep_days` | 7 | 10.4 | `ATTRIBUTION:MANAGE` | 提议，点击记录匹配有效期过后再保留多少天才物理删除 |
| `ratelimit.attribution_click_per_ip_per_hour` | 600 | 1.6、10.4 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.attribution_claim_per_ip_per_hour` | 60 | 1.6、10.4 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.invite_event_per_ip_per_hour` | 600 | 1.6、9.2 | `CONFIG:MANAGE` | 提议 |
| `events.max_batch` | 100 | 7.1 | `CONFIG:MANAGE` | |
| `export.max_rows` | 100000 | 17.6 | `CONFIG:MANAGE` | 提议，一次导出的最大行数 |
| `ratelimit.export_per_admin_per_hour` | 20 | 17.6 | `CONFIG:MANAGE` | 提议，每个管理员每小时的导出次数 |
| `events.max_body_kb` | 512 | 7.1 | `CONFIG:MANAGE` | |
| `events.rate_limit_per_min` | 60 | 7.1 | `CONFIG:MANAGE` | 按设备和按账号各自计 |
| `events.ttl_days` | 180 | 7.2 | `CONFIG:MANAGE` | 写入时算出每条记录的 `expireAt`，修改只影响之后写入的记录，不需要重建索引；必须不小于 `30 + stats.land_window_days`（`stats.land_window_days` 默认 3，所以默认下限是 33），否则 `INVALID_REQUEST` |
| `recall.scan_interval_minutes` | 10 | 8.4 | `PUSH:CONFIG` | |
| `recall.local_send_hour` | 19 | 8.4 | `PUSH:CONFIG` | 用户当地小时 |
| `recall.window_minutes` | 60 | 8.4 | `PUSH:CONFIG` | |
| `recall.min_gap_hours` | 20 | 8.4 | `PUSH:CONFIG` | 与上一次召回推送的最小间隔；故意小于 24，原因见 8.4 |
| `recall.inactive_hours` | 24 | 8.4 | `PUSH:CONFIG` | |
| `recall.streak_min_days` | 7 | 8.4 | `PUSH:CONFIG` | |
| `app.display_name` | `AvatarApp` | 2.2.1 | `CONFIG:MANAGE` | 提议，邮件模板里 `{appName}` 的取值；产品名还没有定（19.2），先用工作名 `AvatarApp`；保存时去掉首尾空白后 1 到 100 个字符，否则 `INVALID_REQUEST` |
| `app.supported_locales` | `["en"]` | 8.4 | `CONFIG:MANAGE` | 界面和通知（推送、站内通知、客户端配置）支持的语言清单。初始只有 `en`：海外产品不以任何单一语言为默认，目标市场的语言清单是产品输入（客户端界面语言清单，未定，19.2）；往里加语言之前，客户端要有翻译、每个召回触发原因要有该语言的模板，否则保存召回模板启用时校验不通过 |
| `push.default_locale` | `en` | 8.4 | `PUSH:CONFIG` | 归一化后没有对应模板时的回退语言 |
| `push.schedule_scan_seconds` | 60 | 8.5 | `PUSH:CONFIG` | 提议，周期推送生成任务的扫描间隔 |
| `push.guest_token_retention_days` | 90 | 8.1 | `PUSH:CONFIG` | 提议，游客推送 token 多久没更新就清理 |
| `push.schedule_catchup_minutes` | 60 | 8.5 | `PUSH:CONFIG` | 提议，停机后周期推送最多补发多久以内错过的那一次 |
| `invite.reward_enabled` | `false` | 9.1 | `INVITE:CONFIG` | 邀请奖励总开关 |
| `invite.inviter_reward_credits` | 0 | 9.1 | `INVITE:CONFIG` | **发放类**：邀请人每次得到的额度数，0 表示这一边不发；发放时记进 `InviteRecord.inviterCreditsGranted`，之后改配置只影响之后发放的 |
| `invite.invitee_reward_credits` | 0 | 9.1 | `INVITE:CONFIG` | **发放类**：被邀请人得到的额度数，记进 `InviteRecord.inviteeCreditsGranted`，规则同上 |
| `invite.reward_trigger` | `FIRST_CALL` | 9.1 | `INVITE:CONFIG` | `REGISTER`（被邀请人注册成功时评估）或 `FIRST_CALL`（被邀请人第一次满足时长的通话结束时评估）；业界的邀请奖励通常在被邀请人完成关键动作后发放 [推断，没有逐家核对] |
| `invite.first_call_min_seconds` | 60 | 9.1 | `INVITE:CONFIG` | 提议，`FIRST_CALL` 触发所需的最短通话秒数 |
| `invite.max_rewarded_per_inviter` | 0 | 9.1 | `INVITE:CONFIG` | 每个邀请人最多获得奖励的次数，0 不限 |
| `invite.chain_max_depth` | 5 | 17.4 | `INVITE:CONFIG` | 邀请链查询允许的最大深度（dramaBox 的页面范围是 1 到 5）；`GET /invites/chain` 不带 `maxDepth` 时默认取 3 |
| `tasks.sweep_seconds` | 60 | 28.2 | `CONFIG:MANAGE` | 提议，把过期的可领取任务置 `EXPIRED` 的清扫间隔 |
| `invite.reward_start_at` | 空 | 9.1 | `INVITE:CONFIG` | 奖励活动的开始（UTC 时刻，ISO-8601），空表示不限；评估时看当时的时间；与 `invite.reward_end_at` 都有值时开始必须早于结束，否则 `INVALID_REQUEST` |
| `invite.reward_end_at` | 空 | 9.1 | `INVITE:CONFIG` | 奖励活动的结束（UTC 时刻，ISO-8601），空表示不限；校验同 `invite.reward_start_at` |
| `companionship.text_burst_minutes` | 30 | 6.1 | `COMPANIONSHIP:CONFIG` | 提议，两条文字消息相隔不超过这么多分钟算同一次互动 |
| `companionship.stage_thresholds` | `{"BONDING":50,"CLOSE":150}` | 6.1 | `COMPANIONSHIP:CONFIG` | 积分小于 BONDING 阈值为 SEEDLING |
| `milestone.days` | `[7,30,100]` | 6.3 | `COMPANIONSHIP:CONFIG` | |
| `moderation.block_score` | 无默认值 | 11.2 | `MODERATION:CONFIG` | 随审核服务选型确定。生产环境未配置时，依赖审核的用户端接口（11.1）返回 503 `DEPENDENCY_UNAVAILABLE`，生成任务不处理；管理端接口（17.4）不受影响：运营先在管理端配置这两个值，再让用户端上线。契约不规定管理端和用户端是不是同一个进程 |
| `moderation.review_score` | 无默认值 | 11.2 | `MODERATION:CONFIG` | 随审核服务选型确定，必须小于 `moderation.block_score`；未配置时的行为同 `moderation.block_score` |
| `moderation.call_timeout_seconds` | 10 | 11.2 | `MODERATION:CONFIG` | 提议，一次调用审核服务的超时；超时按中风险处理（11.2；伴侣名字除外，2.5.1） |
| `memory.tei_allowed_hosts` | 无默认值 | 16.3 | `MEMORY:MODEL_REGISTER` | 注册 embedding 模型时 `teiBaseUrl` 允许的主机白名单；未配置时不能注册模型 |
| `moderation.text_rules` | 空列表 | 11.2 | `MODERATION:CONFIG` | 运营维护的规则词表（也可通过 `/moderation/text-rules` 编辑） |
| `moderation.text_rules_max` | 200 | 11.2 | `MODERATION:CONFIG` | 提议，规则词表最多的条数 |
| `moderation.age_check_enabled` | `true` | 11.1 | `MODERATION:CONFIG` | 是否按年龄拒绝照片（判为明显未成年 → `SUBJECT_UNDERAGE`）；人脸检测总是执行，不受它控制（3.2）。随提交请求传给形象生成服务 |
| `moderation.underage_reject_below_age` | 16 | 11.1 | `MODERATION:CONFIG` | 估计岁数低于这个值就判为明显未成年并拒绝。默认值是推断，要用目标市场人群的照片实测人脸分析模型（格式 1）的年龄误差后调整。风格化后估计年龄普遍偏小：p1 原照 29 → 3D 风格 22、写实 24，p6 原照 37 → 23（AvatarEngine 2026-10-17 实测）；9 人全是成年人，未成年人的表现没测。生成图也用这个门槛（3.2）。保存时校验 0 到 100 的整数（AvatarEngine 只接受这个范围）。随提交请求传给形象生成服务 |
| `moderation.face_min_det_score` | 0.5 | 11.1 | `MODERATION:CONFIG` | 人脸检测分数门槛，低于它的不算检测到人脸（人脸分析模型（格式 1）的默认检测门槛）。实测：9 张原照里真实人脸最低 0.7278，生成图最低 0.797，误检最高 0.1441（AvatarEngine 2026-10-17）。保存时校验 0.1 到 1 之间的数字（含两端；0.1 是人脸检测模型自己的下限，低于它的值不起作用，AvatarEngine 对它返回 400）。随提交请求传给形象生成服务 |
| `moderation.generated_output_review` | `true` | 11.1 | `MODERATION:CONFIG` | 是否审核生成的标准图和动作片段（3.2、3.8） |
| `complaint.likeness_due_hours` | 48 | 11.6 | `COMPLAINT:MANAGE` | 照片里的人投诉的处理时限，超过写告警 `LIKENESS_COMPLAINT_OVERDUE`（参照美国 TAKE IT DOWN Act 对私密图像的 48 小时，形象渲染设计 10.4） |
| `complaint.retention_days` | 365 | 11.6 | `COMPLAINT:MANAGE` | 投诉记录（含投诉人的邮箱和证据）及其处理记录 `LikenessComplaintEvent` 从结案（`resolvedAt`）起保留多少天，到期由每天一次的清理任务一起删除，没有结案的投诉不删除 [推断：默认值待律师意见] |
| `support.rate_limit_per_hour` | 10 | 12 | `CONFIG:MANAGE` | |
| `export.min_interval_hours` | 24 | 13.3 | `CONFIG:MANAGE` | |
| `export.ttl_hours` | 24 | 13.3 | `CONFIG:MANAGE` | |
| `export.job_timeout_minutes` | 30 | 13.3 | `CONFIG:MANAGE` | 提议，导出任务从创建起的最长时间，超过置 `FAILED`（`TIMEOUT`）；必须大于 `export.lease_minutes`；认领租期见 `export.lease_minutes` |
| `export.lease_minutes` | 10 | 13.3 | `CONFIG:MANAGE` | 提议，导出任务的认领租期，超过后其他实例可以重新认领 |
| `export.max_attempts` | 3 | 13.3 | `CONFIG:MANAGE` | 提议，导出任务某一步失败后的最大尝试次数 |
| `export.sweep_minutes` | 10 | 13.3 | `CONFIG:MANAGE` | 提议，导出文件过期清扫的间隔 |
| `export.memory_timeout_seconds` | 120 | 13.2、13.3 | `CONFIG:MANAGE` | 提议，从 AvatarMemory 取全部记忆的总超时 |
| `deletion.alert_after_failures` | 5 | 13.1 | `CONFIG:MANAGE` | `AccountDeletion.attempts`（失败次数）达到此数时在后台告警一次，之后继续重试 |
| `deletion.web_token_ttl_minutes` | 60 | 13.4 | `CONFIG:MANAGE` | 提议 |
| `deletion.grace_days` | 14 | 13.1 | `CONFIG:MANAGE` | 提议，范围 1 到 30；申请删除后的宽限期天数，发放类（记入 `AccountDeletion.executeAfter`，之后改配置不影响已申请的）；保存后同时使客户端配置缓存失效（26.1，`accountDeletionGraceDays` 来自它） |
| `deletion.abuse_marker_retention_days` | 365 | 13.5 | `CONFIG:MANAGE` | 提议，防滥用标记的保留天数，发放类（记入 `AbuseMarker.expireAt`） |
| `deletion.lease_minutes` | 10 | 13.1 | `CONFIG:MANAGE` | 提议，删除执行器的认领租期，超过后其他实例可以重新认领 |
| `deletion.tombstone_retention_days` | 365 | 13.1、15.9 | `CONFIG:MANAGE` | 提议，`OneTimePurchase` 无账号墓碑的保留天数，与防滥用标记一致；要大于商店重发通知和对账补漏的时间窗 |
| `pipeline_metrics.retention_days` | 90 | 十四 | `CONFIG:MANAGE` | |
| `monitor.max_range_days` | 7 | 14.1 | `CONFIG:MANAGE` | 提议，`GET /monitor/pipeline` 允许的最大时间范围 |
| `monitor.max_points` | 5000 | 14.1 | `CONFIG:MANAGE` | 提议，`GET /monitor/pipeline` 一次最多返回的点数 |
| `usage.max_batch` | 200 | 14.2 | `CONFIG:MANAGE` | 提议，`POST /api/internal/usage` 一次最多几条 |
| `usage.max_tokens_per_record` | 10000000 | 14.2 | `CONFIG:MANAGE` | 提议，一条记录里每个 token 字段允许的最大值 |
| `usage.max_quantity_per_record` | 1000000 | 14.2 | `CONFIG:MANAGE` | 提议，非 LLM 记录的 `quantity` 允许的最大值（键名和默认值本行新定） |
| `entitlement.limit_max` | 1000000 | 15.3 | `SUBSCRIPTION:CONFIG` | 提议，`LIMIT` 类功能值允许的最大整数 |
| `credits.spend_max_quantity` | 100 | 15.3 | `SUBSCRIPTION:CONFIG` | 提议，一次 `spend` 允许的最大数量 |
| `usage.rate_limit_per_min` | 600 | 14.2、1.6 | `CONFIG:MANAGE` | 提议，每个调用方标识每分钟最多几次请求 |
| `usage.retention_days` | 90 | 14.2 | `CONFIG:MANAGE` | 提议，`usage_log` 原始记录的保留天数；日汇总表永久保留；发放类（记入每条的 `expireAt`） |
| `usage_price.sync_enabled` | `true` | 14.2 | `CONFIG:MANAGE` | 提议，价格同步任务的开关 |
| `usage_price.sync_hour_utc` | 2 | 14.2 | `CONFIG:MANAGE` | 提议，每天几点（UTC）同步 |
| `usage_price.default_currency` | `USD` | 14.2 | `CONFIG:MANAGE` | 提议，同步生成的价格行的币种（阿里的价格接口没有币种字段） |
| `usage_price.allowed_currencies` | `["USD"]` | 14.2 | `CONFIG:MANAGE` | 价格行允许的币种（用户 2026-10-06 的决定：只存 USD，不换算）；手填和确认时不在列表里返回 400 |
| `usage_price.max_bands` | 20 | 14.2 | `COST:PRICE` | 提议，一个价格批次最多的档位数 |
| `usage_price.source_url` | 阿里云 DashScope 国际站价格接口地址 | 14.2 | `CONFIG:MANAGE` | 提议，默认 `https://dashscope-intl.aliyuncs.com/api/v1/models`（请求文档里对方真实调用过）；保存时校验：必须是 https，且主机在适配器声明的白名单内，否则 400（防止密钥被发到别处） |
| `subscription.accept_sandbox` | `true` | 15.5 | `SUBSCRIPTION:CONFIG` | 沙盒/测试购买是否发放权益（订阅和额度都适用）。默认 true，因为商店审核和测试账号用沙盒购买去测生产后端；沙盒订阅不计入统计 |
| `subscription.reconcile_interval_minutes` | 60 | 15.7 | `SUBSCRIPTION:CONFIG` | 提议 |
| `subscription.orphan_retention_days` | 90 | 15.4 | `SUBSCRIPTION:CONFIG` | 提议，无账号且已终结的订阅行的保留天数 |
| `subscription.unacked_alert_hours` | 24 | 15.5、15.7 | `SUBSCRIPTION:CONFIG` | 提议，Google 订阅超过此时间仍未确认则告警（3 天后会被自动退款） |
| `entitlement.expiry_scan_minutes` | 5 | 15.7 | `SUBSCRIPTION:CONFIG` | 提议，限时权益到期扫描间隔 |
| `credits.unconsumed_alert_hours` | 24 | 15.9 | `SUBSCRIPTION:CONFIG` | 提议，Google 额度购买超过此时间仍未消耗则告警 |
| `session.deadline_scan_seconds` | 30 | 15.6 | `CONFIG:MANAGE` | 提议，通话到点强制结束的扫描间隔 |
| `session.max_duration_minutes` | 240 | 15.6 | `CONFIG:MANAGE` | 提议，单次通话的硬上限；所有账号都适用，也是 webhook 丢失时兜底收尾的依据 |
| `session.agent_join_timeout_seconds` | 8 | 4.1 | `CONFIG:MANAGE` | 提议，dispatch 之后等 agent 加入房间的最长时间 |
| `session.agent_join_retries` | 2 | 4.1 | `CONFIG:MANAGE` | 提议，等不到 agent 时重发 dispatch 的次数 |
| `session.user_join_timeout_seconds` | 30 | 4.1 | `CONFIG:MANAGE` | 提议，agent 已加入后用户一直没有进入房间多久，就把这个 Session 当作没有开始的通话删除（不计额度） |
| `session.user_leave_grace_seconds` | 15 | 15.6 | `CONFIG:MANAGE` | 提议，用户离开房间后等多久才关闭房间（给重连留时间） |
| `session.liveness_check_seconds` | 300 | 15.6 | `CONFIG:MANAGE` | 提议，对进行中的会话核对一次房间里是否还有用户的间隔（兜底 `participant_left` webhook 丢失） |
| `chat.sync_overlap_seconds` | 60 | 5.2 | `CONFIG:MANAGE` | 提议，`updatedSince` 增量同步回看的秒数 |
| `push.task_lease_minutes` | 15 | 8.5 | `PUSH:CONFIG` | 提议，推送任务的认领租期，超过后可被其他实例重新认领 |
| `push.task_image_retention_days` | 30 | 17.4 | `PUSH:CONFIG` | 提议，推送任务进入终态后保留它的图片多少天 |
| `chat.model_tiers_allowed` | `["standard"]` | 15.6 | `CONFIG:MANAGE` | `chat.model_tier` 允许的档位名。**上线顺序：增加新档位时，必须先在 AvatarAgent 的模型档位配置（`LLM_TIERS`）里加同名档位并部署，再把名字加到这里。** 反过来的话，被分到新档位的用户会静默使用 `standard`，只有 agent 的错误日志能看出来 |
| `stats.land_window_days` | 3 | 17.6 | `CONFIG:MANAGE` | 汇总任务每次重算最近几天；迟到的数据（例如跨午夜才结束的通话）在窗口内自动纳入。依据：dramaBox 的 5 个汇总任务回溯 3 天（`StatLandWindow.DEFAULT_DAYS = 3`），其余只落昨天 [子代理读码 DramaverseDemo `docs/backend/java-backend-reference.md` 统计层一节] |
| `stats.land_interval_minutes` | 15 | 17.6 | `CONFIG:MANAGE` | 当天数据的刷新间隔。依据：dramaBox 部分汇总任务当天每 15 分钟落地一次 [同上] |
| `admin.totp_enroll_ttl_minutes` | 10 | 17.2 | `CONFIG:MANAGE` | 提议，绑定二次验证的一次性令牌有效期 |
| `admin.totp_max_failures` | 5 | 17.2 | `CONFIG:MANAGE` | 提议，连续几次验证码错误后锁定 |
| `admin.totp_lockout_minutes` | 5 | 17.2 | `CONFIG:MANAGE` | 提议，锁定时长 |
| `stats.max_range_days` | 366 | 17.6 | `CONFIG:MANAGE` | 汇总类报表单次查询的最大跨度。依据：dramaBox `OpsStatDateRange.MAX_SPAN_DAYS` |
| `analytics.live_max_range_days` | 31 | 17.4 | `CONFIG:MANAGE` | 提议，现查 `event_log` 的接口（事件明细、事件汇总、事件名、漏斗）的最大时间跨度 |
| `admin.totp_required` | `true` | 17.2 | `CONFIG:MANAGE` | 生产环境为 `false` 则拒绝启动；保存时生产环境保存 `false` 同样返回 400 `INVALID_REQUEST`（同 `integrity.check_enabled`）；为 `false`（仅非生产）时登录只校验用户名和密码，忽略 `totp` 和绑定状态 |
| `admin.password_min_length` | 12 | 17.2 | `CONFIG:MANAGE` | 提议 |
| `admin.permission_cache_seconds` | 30 | 17.3 | `CONFIG:MANAGE` | 提议 |
| `ratelimit.admin_login_per_min` | 10 | 17.2 | `CONFIG:MANAGE` | 提议，按 IP+用户名 |
| `moderation.content_url_ttl_seconds` | 300 | 17.4 | `MODERATION:CONFIG` | 提议，审核内容签名地址的有效期 |
| `upload.push_image_max_bytes` | 1048576 | 17.4 | `CONFIG:MANAGE` | 推送图片大小上限。依据：dramaBox 推送图片限 1 MB [子代理读码 dramaBox-admin `src/pages/push/pushImageField.ts`] |
| `ads.enabled` | `false` | 22.4 | `ADS:PLACEMENT` | 应用内广告总开关（全局）；账号级的"去广告"是 15.3 的功能开关 `ads.removed`，两者键名不同 |
| `ads.preload_enabled` | `true` | 22.10 | `ADS:PLACEMENT` | |
| `ads.preload_ttl_minutes` | 60 | 22.10 | `ADS:PLACEMENT` | 范围 1–240，保存时校验 |
| `ads.skip_after_seconds` | 5 | 22.10 | `ADS:PLACEMENT` | 范围 0–60，保存时校验；为了符合 Google Play 对全屏广告可关闭的要求应保持较小，超过 5 后台警告（22.7） |
| `ads.force_close_seconds` | 15 | 22.10 | `ADS:PLACEMENT` | 范围 0–60，保存时校验；非激励广告展示满这么多秒后无论素材是否可跳过都强制出现关闭按钮；0 表示不启用兜底（22.7） |
| `ads.history_feed_interval` | 5 | 22.10 | `ADS:PLACEMENT` | 范围 3–50，保存时校验 |
| `ads.call_end_interval` | 3 | 22.10 | `ADS:PLACEMENT` | 范围 0–999，保存时校验；0 表示不展示通话结束插屏 |
| `ads.log_retention_days` | 90 | 22.3 | `CONFIG:MANAGE` | 提议，展示记录的 TTL；记入每条的 `expireAt`，改配置只影响之后写入的记录 |
| `ads.creative_aspect_tolerance_percent` | 3 | 22.2 | `ADS:PLACEMENT` | 提议，素材宽高比与广告位要求允许的相对误差 |
| `ads.reward_complete_grace_seconds` | 120 | 22.4 | `ADS:PLACEMENT` | 激励广告展示后超过“奖励时长加这个宽限”仍没有终态事件，就视为作废并释放名额 |
| `upload.orphan_hours` | 24 | 22.9、24.2 | `CONFIG:MANAGE` | 提议，上传了但没有被素材或版本使用的文件多久后清理 |
| `upload.ad_media_max_bytes` | 52428800 | 22.9 | `CONFIG:MANAGE` | 提议，广告素材上传的大小上限（50 MB） |
| `upload.public_base_url` | 无默认值 | 22.9、24.2 | `CONFIG:MANAGE` | 上传文件（广告素材、缩略图、APK）的对外基址：https、不带末尾斜杠、可以带路径前缀，保存时按 1.7 校验；没有配置时 `POST /ads/media` 和 APK 上传返回 503 `DEPENDENCY_UNAVAILABLE`。拼出的地址是公开的，不签名、不过期（22.9） |
| `upload.render_asset_max_bytes` | 104857600 | 3.5、3.9、17.4 | `CONFIG:MANAGE` | 渲染模型 zip 上传的单文件上限（100 MiB，整数，不小于 1）；也是后端从形象生成服务取回每个产物文件（外观标准图、驱动资源包、动作片段）的单文件上限（3.5） |
| `auth.phone_login_enabled` | `false` | 23.1 | `CONFIG:MANAGE` | **保存时**跨键校验：设为 `true` 时，`sms.allowed_country_codes`、`sms.daily_global_cap` 必须已配置，且至少有一个启用的短信通道，否则 `INVALID_REQUEST`；开关为 `true` 期间，清空这两个键、停用或删除最后一个启用的通道同样被拒（23.1）。保存后同时使客户端配置缓存失效（26.1）。关闭它不影响已有手机号账号删除自己（13.1、13.4） |
| `sms.otp_ttl_seconds` | 300 | 23.1 | `CONFIG:MANAGE` | 提议 |
| `sms.otp_resend_seconds` | 60 | 23.3 | `CONFIG:MANAGE` | 提议 |
| `sms.otp_max_attempts` | 5 | 23.3 | `CONFIG:MANAGE` | 提议 |
| `sms.max_per_phone_per_day` | 10 | 23.3 | `CONFIG:MANAGE` | 提议；滚动 24 小时窗口，不是日历日 |
| `ratelimit.otp_per_ip_per_hour` | 20 | 23.3 | `CONFIG:MANAGE` | 提议 |
| `sms.allowed_country_codes` | 无默认值 | 23.3 | `CONFIG:MANAGE` | ISO 国家码列表；为空则手机号登录无法启用（保存时校验，见 `auth.phone_login_enabled`） |
| `sms.daily_global_cap` | 无默认值 | 23.3 | `CONFIG:MANAGE` | 每日短信总量上限，达到后拒绝发送并写告警；为空则手机号登录无法启用 |
| `sms.send_timeout_ms` | 5000 | 23.1 | `CONFIG:MANAGE` | 提议 |
| `sms.record_retention_days` | 30 | 23.4 | `CONFIG:MANAGE` | 提议，发送记录的 TTL |
| `sms.dlr_max_skew_seconds` | 300 | 23.5 | `CONFIG:MANAGE` | 提议 |
| `sms.dlr_pending_seconds` | 600 | 23.5 | `CONFIG:MANAGE` | 提议 |
| `sms.test_per_day` | 5 | 23.6 | `CONFIG:MANAGE` | 提议，每个管理员每天的测试发送条数 |
| `appversion.cache_seconds` | 60 | 24.3 | `CONFIG:MANAGE` | 提议；Redis 缓存的兜底有效期，状态变化时主动删键（24.3） |
| `upload.apk_max_bytes` | 104857600 | 24.2 | `CONFIG:MANAGE` | APK 上传的大小上限（字节），同 dramaBox 的 100 MB；反向代理的请求体上限要同步放宽（部署输入） |
| `ratelimit.public_config_per_min` | 60 | 1.6 | `CONFIG:MANAGE` | 提议；`GET /api/app-version`、`GET /api/config/client` 每 IP |
| `ratelimit.likeness_complaint_per_ip_per_hour` | 10 | 1.6 | `CONFIG:MANAGE` | 提议；`POST /api/public/likeness-complaints` 每 IP（键名和默认值本行新定） |
| `ratelimit.sms_dlr_per_min` | 300 | 1.6 | `CONFIG:MANAGE` | 提议；短信送达回执每 IP |
| `notification.max_recipients` | 1000 | 25.3 | `CONFIG:MANAGE` | 提议 |
| `notification.read_retention_days` | 90 | 25.5 | `CONFIG:MANAGE` | 提议 |
| `notification.unread_retention_days` | 365 | 25.5 | `CONFIG:MANAGE` | 提议 |
| `notification.max_per_account` | 500 | 25.5 | `CONFIG:MANAGE` | 提议 |

### 17.6 统计汇总层

依据：dramaBox 的统计设计 [子代理读码 dramaBox `docs/statistics-module-design.md`、`docs/gap-analysis-admin-design.md`、`docs/admin-page-restructure.md`，DramaverseDemo `docs/backend/java-backend-reference.md` 的统计层一节]：每晚写日汇总表，页面只读汇总表，读汇总表的统计页有"重新落地该日"补数；它自己的缺口分析把"没有每日跑批，数据看板无可信数据源"列为第一优先级（不是原话）。**这是 dramaBox 的先例，不是 AvatarApp 数据量下的实测**：选预聚合是照搬一个被它验证过的做法，数据量大到什么程度才需要换方案，我没有数据。

| 设计点 | 内容 |
|---|---|
| 读写分离 | 报表页只读汇总表，请求里不扫 `event_log`、`Session`、`Message`。只有事件明细、事件汇总、事件名、漏斗四个自由查询现查 `event_log`（17.4，有时间跨度上限） |
| 日界线 | 除签到、任务两类（`StatCheckinDaily`、`StatTaskDaily`，账号本地日，见各自的说明）外，所有汇总按 **UTC 日历日**，`statDate` 是 `YYYY-MM-DD`。这是口径，前端不做时区换算；运营在新加坡看到的"今天"和 UTC 日会差 8 小时，页面要写明 |
| 平台维度 | 有 `platform` 列的汇总表一共五张：`StatDailyEvent`、`StatRetention`、`StatGuestRetention`（以下几句说明这三张）和 `StatAdDaily`、`StatAdNofillDaily`（广告展示的平台，取广告请求时存下的 `context.platform`，22.3、22.8）；其余汇总表没有 `platform` 列。前三张里，只有来自 `event_log` 的指标有 `platform`（`ANDROID`、`IOS`、`ALL`），取事件的 `context.platform`（缺失或不在 `ANDROID`/`IOS` 内的归 `unknown`，`/stats/daily?platform=unknown` 可查）；`ALL` 行**独立去重计算**，不是两个平台相加（去重人数不可加）。来自 `User`、`Session`、`Message`、`Subscription`、`GuestDevice` 的指标（含 `guestDevicesNew`、`guestDevicesConverted`）不按平台拆分（`StatDailyBusiness` 的主键不含 `platform`），只出现在 `ALL` 行；**两个留存表例外**：`StatRetention` 的 `platform` 取账号注册时的平台（`User.registerPlatform`，缺失为 `unknown`），`StatGuestRetention` 的 `platform` 取 `GuestDevice.platform` |
| 导出 | `GET /stats/export/{name}?<与对应报表相同的参数>`：把聚合报表导出成 Excel（`.xlsx`），`name` 与报表的对应：`daily`=`/stats/daily`、`retention`=`/stats/retention`、`reactivation`=`/stats/reactivation`、`guest`=游客日报 `/stats/guest/daily`、`guest-retention`=`/stats/guest/retention`、`session-quality`=`/stats/session-quality`、`push`=`/stats/push`、`usage-cost`=`/stats/usage-cost`、`invite-records`=`/invites/records`、`invite-stats`=`/invites/stats`、`share-funnel`=`/invites/share-funnel`、`share-channel`=`/invites/share-channels`、`attribution-performance`=`/attribution/performance`、`ads-report`=`/ads/report/overview`（22.9）、`checkin-daily-users`=`/stats/checkin/daily-users`、`checkin-streaks`=`/stats/checkin/streak-buckets`、`task-summary`=`/stats/tasks/summary`。响应 `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`，`Content-Disposition: attachment; filename="<name>-<from>-<to>.xlsx"`。权限：`STATS:EXPORT`，并且还要有对应接口所需的查看权限（`STATS:VIEW`、`INVITE:VIEW`、`ATTRIBUTION:VIEW`、`COST:VIEW` 或 `ADS:REPORT`，例如 `invite-records` 需要 `INVITE:VIEW`）。鉴权用普通的 `Authorization: Bearer`，前端用 `fetch` 取回再保存（dramaBox 用 `window.open` 在 URL 里带固定的 `token=123`，由网关替换成真实令牌 [子代理读码 dramaBox-admin `stat.ts`]，这个不照搬）。行数不超过 `export.max_rows`（默认 100000），超出返回 400 `INVALID_REQUEST`，`message` 提示缩小范围；每个管理员每小时最多 `ratelimit.export_per_admin_per_hour` 次，超出 429；**只导出聚合数据，不含用户级个人数据**：`invite-records` 里的邀请人和被邀请人是掩码标识，没有 IP。表头文字按请求的 `Accept-Language`（`zh-Hans` 或 `en`）取后端语言文件里的字段名。每次导出写一条审计日志（报表名、筛选参数、行数）。依据：dramaBox 的导出中心（统计页的"导出 Excel"，7 个接口 `/stat/daily/export` 等）[子代理读码 dramaBox-admin `stat.ts`、dramaBox `ExcelExportHelper`、后台设计会话的笔记] |
| 渠道维度 | `StatDailyEvent`、`StatDailyBusiness`、`StatRetention`、`StatGuestRetention` 另有 `channelCode`（`ALL` 或渠道码，24.7）：事件类指标的渠道取事件的 `context.channel`（没有的归 `unknown`），`ALL` 行独立去重计算；业务类指标的渠道取账号的 `User.channelCode`（注册渠道），游客设备类取 `GuestDevice.channelCode`，没有渠道的老数据归 `unknown`；订阅快照、有效订阅数这类没有渠道的指标只出现在 `ALL` 行（`channel` 不是 `ALL` 时 `/stats/daily` 的 `activeSubscriptions` 返回 `null`）；业务类指标的 `ALL` 行是各渠道之和（每个账号只属于一个注册渠道，所以包括 `accountsWithCall` 在内的去重账号数也可以相加）；留存的 cohort 渠道取账号的注册渠道。依据：dramaBox 的统计页普遍有渠道包筛选 [子代理读码 dramaBox-admin `ChannelSelect`、后台设计会话的笔记] |
| 数据来源规则 | 行为类指标（活跃、留存里的"出现"）取 `event_log`；业务结果（新增账号、游客设备转注册、通话、消息、订阅、额度）取业务表。两类不混用。依据：dramaBox 的统计设计文档明确规定，且它的第一版因混用被返工过 [子代理读码 dramaBox `docs/stat-eventlog-migration.md`、`statistics-module-design.md` 十] |
| 补数 | 任务每次重算最近 `stats.land_window_days` 天，对每个（日期、维度）先删后插、同一事务，幂等（`StatRetention`、`StatGuestRetention`、`StatGuestCohort` 三张表例外：`cohortSize` 在 cohort 当天写入，每个 `dN` 格子在第 N 天按列更新，不整行删插，否则会清掉其他 N 已落地的格子）；读汇总表的统计页有"重新落地该日"，调 `POST /stats/land/{name}?date=`（`STATS:LAND`，写审计日志）。**手动补数和定时任务共用同一把分布式锁**，不会交错执行 |
| 留存的分群 | 账号留存的 cohort 是注册日（`User.createdAt` 的 UTC 日），游客留存的 cohort 是设备首次出现日（`GuestDevice.firstSeenAt`）；两者都是创建那一刻确定、永远不变的值，不从 `event_log` 现取（`event_log` 会过期）。不再有“首次打开”来源表：把注册之前的游客期回溯进账号 cohort，会让已落地的 cohort 悄悄多出成员，而落地任务只重算最近 `stats.land_window_days` 天（2026-10-05 决定，照 dramaBox 按注册日分群，游客另有单独统计） |
| 比率与去重人数 | 汇总表只存分子分母，比率在报表层算，不存比率、不对比率求平均；日活、周活、月活是去重人数，**不跨日相加**，接口只返回逐日行 |
| 保留 | 汇总表永久保留；`event_log` 的记录各自过期（7.2），所以早于 `event_log` 里现存最早一条 `receivedAt` 的 UTC 日不能重算事件类汇总（受 `event_log` 保留期保护的列，补数和 `StatLandJob` 对它们保留已落地值，其余列照常重算：`StatDailyEvent` 全部列；`StatSessionQualityDaily.agentUnavailable`、`limitReached`、`discardedUserNotJoined`；`StatPushDaily.pushesOpened`；`StatShareFunnelDaily`、`StatShareChannelDaily` 的事件来源列；`StatRetention` 的 `ACTIVE`、`StatGuestRetention`、`StatReactivation` 的事件判断）（来源已过期，先删后插只会把已有的行清空），补数接口对这类 `date` 返回 400 `INVALID_REQUEST`。游客会话类的列（`guestSessionsConnected`、`guestCallSecondsTotal`，以及通话质量的 `connected` 和接通耗时的 `joinLe2s`、`joinLe5s`、`joinLe10s`、`joinGt10s`、`joinMsSum`；接通耗时和 `connected` 在同一批会话上计算，四档之和要等于 `connected`）同理：早于 `guest.session_retention_days` 的日期，游客 `Session` 已被删除，补数不重算这几列，保留已落地的值（不会出现分档里没有游客、`connected` 里有游客）。`usage_log` 同理：早于 `usage.retention_days` 的日期，原始记录已过期，`usage-cost` 不重算，保留已落地的值（补数接口对这类日期不报错） |
| 总览页 | 没有自己的接口：调 `/stats/daily`（`ALL`，最近 90 天）和 `/stats/retention`（最近 90 天），平台分布另调 `/stats/daily?platform=ANDROID`、`IOS`（只取当天），环比、同比在浏览器里算。依据：dramaBox 的总览页没有自己的接口，而是调用多个已有统计接口（日报、留存、分享、邀请、渠道）[子代理读码 dramaBox `docs/statistics-phase-1.5-design.md` 任务 1] |

#### 汇总表

| 表 | 主键 | 列 |
|---|---|---|
| `StatDailyEvent` | `statDate`, `platform`, `channelCode` | `dau`, `dauDevices`, `wau`, `mau`, `avatarCreatedAccounts`, `voiceClonedAccounts`, `sessionStartedAccounts` |
| `StatDailyBusiness` | `statDate`, `channelCode` | `newAccountsRegistered`, `guestDevicesNew`, `guestDevicesConverted`, `guestSessionsConnected`, `guestCallSecondsTotal`, `sessionsConnected`, `accountsWithCall`, `callSecondsTotal`, `messagesUser`, `messagesAssistant`, `newSubscriptions`, `creditPurchases`, `creditsSpent` |
| `StatSubscriptionSnapshot` | `statDate` | `activeSubscriptions`, `writtenAt`, `backfilled` |
| `StatRetention` | `cohortDate`, `retentionType`（`ACTIVE`/`CALL`）, `platform`, `channelCode` | `cohortSize`, `d1`, `d3`, `d5`, `d7`, `d14`, `d21`, `d30`, `d60`, `d90`（人数；到期之前为空） |
| `StatReactivation` | `statDate`, `silenceDays`（7/14/30） | `silentUsers`, `reactivated` |
| `StatGuestCohort` | `cohortDate` | `cohortSize`, `d0`, `d1`, `d2`, `d3`, `d5`, `d7`, `d14`, `d30`（累计转化人数；到期之前为空） |
| `StatGuestRetention` | `cohortDate`, `platform`, `channelCode` | `cohortSize`, `d1`, `d3`, `d5`, `d7`, `d14`, `d21`, `d30`, `d60`, `d90`（设备数；到期之前为空） |
| `StatSessionQualityDaily` | `statDate` | `connected`, `agentUnavailable`, `limitReached`, `discardedUserNotJoined`, `joinLe2s`, `joinLe5s`, `joinLe10s`, `joinGt10s`, `joinMsSum` |
| `StatPushDaily` | `statDate`, `triggerReason` | `pushesSent`, `deliveriesOk`, `deliveriesFailed`, `pushesOpened` |
| `StatUsageCostDaily` | `statDate`, `resourceType`, `provider`, `model`, `unit`, `source`, `tier`, `currency` | `requests`, `inputTokens`, `cachedInputTokens`, `outputTokens`（三个 token 列只有 `LLM` 有值）, `quantity`（非 LLM 的数量之和）, `costAmount`, `unpricedRequests`（来源 `usage_log`，14.2；报表按币种分组，不跨币种相加） |
| `StatAdDaily` | `statDate`, `campaignId`, `placementId`, `adUnitId`, `creativeId`, `platform`, `channelCode`, `country`（空串表示未知，22.3） | 广告指标列见 22.3 / 22.8；来源是 Mongo `ad_impression_log` |
| `StatAdNofillDaily` | `statDate`, `platform`, `channelCode`, `slotKey`, `reason` | `cnt`；来源是 Redis 无广告计数（22.4），补数有日期范围保护（22.8） |
| `StatAttributionDaily` | `statDate`, `campaignId`（0 是"未归因"行） | `pageViews`（来源：Mongo 的落地页访问计数 `attribution_page_view`，`PAGE_VIEW` 到达时按（日期、投放账户）自增）、`clicks`（`AttributionClick` 数）、`installs`（`source=SELF` 的 `AttributionRecord` 数，按 `installTime` 的 UTC 日）、`registered`（`source=SELF` 且 `attributionCampaignId` 非空的记录，按 `registeredAt` 的 UTC 日）、`unattributedInstalls`（仅 `campaignId=0` 行：`AttributionClaim.matched=false` 的数，按 `createdAt` 的 UTC 日）；点击记录只保留 `attribution.click_retention_days` 天，所以落地任务和补数都只重算点击记录还在的日期，更早的日期不删不插；和其他日汇总一样随 `stats.land_interval_minutes` 刷新当天，运营当天就能看到安装和点击 |
| `StatShareFunnelDaily` | `statDate` | `sharePv`（`invite_share_clicked` 次数）, `shareUv`（去重账号数）, `linkClickPv`, `linkClickUv`（去重邀请码所有者）, `downloadClickPv`, `downloadClickUv`（去重邀请码所有者）, `registered`（`InviteRecord` 按 `redeemedAt`）；来源 `event_log` 和 `InviteRecord` |
| `StatShareChannelDaily` | `statDate`, `shareChannel` | `sharePv`, `shareUv`；来源 `event_log` 的 `invite_share_clicked` |
| `StatCheckinDaily` | `statDate`, `consecutiveDays` | `checkins`, `creditsGranted`；来源 `CheckinRecord`（28.1）；`statDate` 是**账号本地日**（`checkinDate`），不是 UTC 日，是上面"所有汇总按 UTC 日历日"的例外 |
| `StatTaskDaily` | `statDate`, `taskId` | `totalRecords`, `completedCount`, `rewardedCount`, `creditsIssued`；来源 `TaskRecord`（28.2）；`statDate` 是 `taskDate`（账号本地日，同样是 UTC 规则的例外），四个指标都按记录的 `taskDate` 归并，领奖发生在第二天的也计入 `taskDate` 那天 |

#### 口径

下面的"账号"指 `accountId` 非空；"当日"指 `receivedAt`（事件）或对应时间字段落在该 UTC 日。

- `dau`：当日出现过任意客户端事件（`event_log.source=CLIENT`，7.2）的去重账号（取事件的 `accountId`）。后端自己写的事件（`push_sent`、`milestone_reached` 等）不算活跃。照 dramaBox 的“当日有任意事件” [核实 审计 F16]，同时用 `source` 排除后端事件对口径的污染；此前只数冷启动 `app_open`，会漏掉进程一直活着、切回前台继续使用的用户 [推断，无来源]。指标说明里要写明口径。`dauDevices`：当日出现过任意客户端事件的去重 `deviceId`（含尚未创建账号的匿名设备）；`wau`、`mau`：截至 `statDate`（含）最近 7、30 个 UTC 日内出现过任意客户端事件的去重账号。`app_open` 仍然是每次冷启动一条，用于冷启动统计，不再是活跃的唯一口径。
- `avatarCreatedAccounts`、`voiceClonedAccounts`、`sessionStartedAccounts`：当日出现对应事件的去重账号。"完成注册的账号数"就是 `newAccountsRegistered`（业务结果取自 `User`，不取自客户端事件）。
- `newAccountsRegistered`：当日创建的账号（`User.createdAt` 在当日）。`guestDevicesNew`：当日第一次出现的游客设备（`GuestDevice.firstSeenAt` 在当日）；`guestDevicesConverted`：当日转注册的游客设备（`GuestDevice.convertedAt` 在当日）。`guestSessionsConnected`、`guestCallSecondsTotal`：游客会话（`Session.accountId` 为空）里接通的会话数和通话总秒数，口径同 `sessionsConnected`、`callSecondsTotal`；后两者以及 `accountsWithCall`、`messages*` 只统计有账号的会话。
- `sessionsConnected`：`Session.startedAt` 在当日、`endedAt` 非空且 `accountId` 非空的会话数（被丢弃的"启动中"和"用户未进入"的 Session 在 4.1 已删除，不在表里）；`accountsWithCall`：其中去重账号数；`callSecondsTotal`：`durationSeconds` 之和。
- `messagesUser`、`messagesAssistant`：`Message.timestamp` 在当日、按 `sender` 计数（含 `hidden`）。
- `newSubscriptions`：`Subscription.firstActiveAt` 在当日、`environment=PRODUCTION`。
- **`activeSubscriptions`（`StatSubscriptionSnapshot`）**：当日结束时的有效订阅数，`PRODUCTION`，"有效"指订阅状态为 `ACTIVE`、`CANCELED`、`IN_GRACE_PERIOD`（15.4 的"有权益"列），按订阅行计数，**包含 `accountId` 为空的订阅**（账号已删除或尚未绑定，商店仍在扣款，是真实的订阅；账号已删除的订阅行在 13.1 步骤表第 6 步被删，要等其后收到商店通知或对账（15.7）重新创建出无账号的行才被计数，在那之前计数偏低，接受）。它是**日末快照，单独一张表**，不放进 `StatDailyBusiness`：窗口重算对 `StatDailyBusiness` 先删后插，会把同一行里的快照一起删掉。写入规则：每天 00:10 UTC 的任务为 `D−1` 写一行，**只在该行不存在时写入，已存在不覆盖**；任务当天失败，该日没有快照，`/stats/daily` 对该日返回 `null`；手动补数 `subscription-snapshot` 只在该行缺失时写入，写入时 `backfilled=true`（用的是当前状态，只是近似），页面标注"回填值"。当天（未结束）的值返回 `null`。
- `creditPurchases`：当日 `reason=PURCHASE` 的流水条数，按 `purchaseId` 关联 `OneTimePurchase`，`environment=PRODUCTION`（沙盒不计）；`creditsSpent`：当日 `reason=SPEND` 的 `-delta` 之和，减去当日 `reason=SPEND_REVERSED` 的 `delta` 之和（失败任务退回的额度不算消费）。
- **留存**：账号留存的 cohort 是注册日：`User.createdAt` 的 UTC 日等于 `cohortDate` 的账号（注册那一刻确定、之后不变，所以 cohort 成员不会事后增减）；`platform` 取 `User.registerPlatform`（缺失为 `unknown`），`channelCode` 取 `User.channelCode`，`ALL` 行含全部。`ACTIVE`：第 N 天（`cohortDate + N`）出现过任意客户端事件；`CALL`：第 N 天有 `sessionsConnected` 口径的会话（会话不分平台，平台行也一样统计）。**第 N 天是当天这一点，不是“N 天内任意一天”**（业界的 N 日留存同样是“恰好第 N 天”：Amplitude 的 Return On、Adjust 的 exactly N days later [核实 搜索摘要，没有逐页通读]）。落地时对日期 `D` 填 `cohortDate = D − N` 的格子（N 取 1、3、5、7、14、21、30、60、90），窗口重算同样补齐。账号之后被删除，不改动已落地的行；**但偏差要写明**：`cohortSize` 在 cohort 当天落地后不再改动，而之后才落地的 `d30`、`d60`、`d90` 格子只数当时仍存在的账号，所以该 cohort 在这段时间里被真正删除（宽限期 `deletion.grace_days` 之后）的账号占比，会让这些后落地的格子偏低。不为此保存按账号的成员表，那等于长期保留已删账号的标识，和删除的目的相反；接受这个偏差，报表说明里写明。依据：dramaBox 的留存按注册日分群、第 N 天当天点式统计，天数含 5 和 21 [核实 审计 F22、F24]。业界默认的“所有新用户留存”按首次使用日分群（GA4 first touch、Amplitude New User、AppsFlyer 和 Adjust 的安装日 [核实 搜索摘要]），在本项目里就是下面的游客留存（设备级）；注册账号按注册日分群是各分析工具都支持的自选起始事件。**不把注册之前的游客期回溯进账号 cohort**：回溯会让已落地的 cohort 悄悄多出成员，而落地任务只重算最近 `stats.land_window_days` 天（2026-10-05 决定）。
- **游客留存**（`StatGuestRetention`；dramaBox 有游客留存 [核实 审计 F34：`/stat/guest/retention`]）：cohort 是 `GuestDevice.firstSeenAt` 的 UTC 日等于 `cohortDate` 的设备（所有通过设备校验、拿到游客凭据的新设备；已转注册的设备照常计入，这就是业界默认的“所有新用户留存”），`platform` 取 `GuestDevice.platform`，`channelCode` 取 `GuestDevice.channelCode`，`ALL` 行含全部。第 N 天 = 当天 `event_log` 里有该设备（`deviceId` 取 SHA-256 后与 `GuestDevice.deviceIdHash` 比对）的任意客户端事件，匿名事件和带账号的事件都算。天数、点式、补数规则同账号留存。没有通过设备校验的设备没有 `GuestDevice` 行，不在这份统计里。
- **回流**：`silentUsers` = `User.createdAt` 的 UTC 日早于 `statDate − silenceDays`、且在 `[statDate − silenceDays, statDate − 1]` 内没有任何客户端事件的账号数；`reactivated` = 其中 `statDate` 当天出现过任意客户端事件的账号数。沉默与回流的概念取自 dramaBox [子代理读码 dramaBox `docs/admin-enhancement-batch1.md` 任务 5]；dramaBox 用“注册用户且这段时间 `event_log` 没有任何记录”，这里同样按注册日，活跃认任意客户端事件（`source=CLIENT`），后端产生的事件（`push_sent`、`milestone_reached` 等）不代表用户回来过，不算。
- **游客额度使用**（`/stats/guest/quota`，数字人产品特有，dramaBox 没有对应物）：给运营判断 `guest.call_minutes_total`（17.5）设得是否合适。对 `firstSeenAt` 落在 `from` 到 `to` 的游客设备，现查 `GuestDevice`（`firstSeenAt` 上要有索引），**用每台设备自己的 `grantedSeconds` 计算**：`configuredTotalSeconds` = 当前 `guest.call_minutes_total` × 60（只供参考，只影响之后发放的设备），未配置为 `null`；`devices` 设备数；`noGrant` `grantedSeconds` 为空或 0 的设备数；`neverCalled` 有额度且 `usedSeconds` 为 0 的设备数；`avgUsedSeconds` 有额度的设备的平均已用秒数；`exhausted` `grantedSeconds` 大于 0 且 `usedSeconds` 不小于 `grantedSeconds` 的设备数；`buckets` 对有额度的设备按 `usedSeconds ÷ grantedSeconds` 分成六档：等于 0、(0, 25%]、(25%, 50%]、(50%, 75%]、(75%, 100%)、不小于 100%，每档给 `devices` 和 `converted`（其中 `convertedAt` 非空的设备数）。运营中途改过额度数值时，不同时期发放的设备按各自当时的额度分档，所以百分比是相对各自额度的。`usedSeconds` 取自 `GuestDevice` 而不是现算 `Session`，因为游客 `Session` 超过 `guest.session_retention_days` 会被删除。
- **游客转注册**：游客在服务端没有账号（2.1），`StatGuestCohort` 来自 `GuestDevice`：cohort 是当日第一次出现的游客设备（`firstSeenAt` 在当日），`dN` = 其中 `convertedAt` 与 `firstSeenAt` 相差不超过 N 个 UTC 日的累计设备数，`d0` 是同日转注册。补数规则同留存：`guest-cohort` 的 `date` 是检查日，填 `cohortDate = D − N` 的格子（N 取 0、1、2、3、5、7、14、30），`d0` 在 cohort 当天落地时写入。
- **通话质量**：`connected`：口径同 `sessionsConnected`，但**含游客会话**（`accountId` 为空的也算），因为通话质量衡量的是服务本身，`agentUnavailable` 里也包含游客发起的失败；`agentUnavailable`：事件 `session_start_failed` 中 `reason` 为 `AGENT_UNAVAILABLE` 或 `DISPATCH_FAILED` 的数；`limitReached`：`reason` 为 `FEATURE_LIMIT_REACHED` 或 `GUEST_QUOTA_EXHAUSTED` 的数；`discardedUserNotJoined`：事件 `session_discarded` 的数；接通耗时 = `agentJoinedAt − requestedAt`，只统计 `connected` 的会话（按 `startedAt` 所在日），分到**互斥**的四档：≤2 秒、>2 且 ≤5 秒、>5 且 ≤10 秒、>10 秒（`joinLe2s`、`joinLe5s`、`joinLe10s`、`joinGt10s` 依次对应这四档，每个会话只落在一档），并累加毫秒数 `joinMsSum` 供求平均。被丢弃的 Session 已删除，没有接通耗时。**接通成功率 = `connected / (connected + agentUnavailable)`**；`limitReached` 是额度限制、`discardedUserNotJoined` 是客户端没有进入房间，都不算 agent 侧的失败，单独展示。`Session` 需要 `startedAt` 单列索引。
- **推送效果**：全部按 `PushRecord.createdAt` 所在日归并：`pushesSent` = 当日 `PushRecord` 数（只含账号，游客 token 的推送不写记录、不计入，8.3）；`deliveriesOk` = 这些推送下 `PushDelivery.result=ACCEPTED`（推送平台已接受）的数，`deliveriesFailed` = `INVALID_TOKEN` 与 `FAILED` 的数（`PushDelivery.result` 的三个取值见第 18 节，第八节的发送实现必须写入其中之一）；`pushesOpened` = 当日 `push_opened` 事件中去重的 `pushId` 数，记在**点开当天**，按 `pushId` 关联 `PushRecord` 取 `triggerReason`，关联不到（账号已删除）的丢弃。

#### 任务

- **`StatLandJob`**：事件类汇总对早于 `event_log` 现存最早一条 `receivedAt` 的日期同样跳过、保留已落地的值（同手动补数的保护）；多实例部署时用分布式锁保证同一时刻只有一个实例运行。每 `stats.land_interval_minutes` 分钟重算当天（UTC）；每天 00:10 UTC 重算 `D−1` 到 `D−stats.land_window_days`。当天的行是临时值，次日起固定（窗口内仍可能因跨午夜才结束的通话等迟到数据小幅上调；事件按收到时间统计，不会因迟到而回写）。
- **`StatReconcileJob`**：每天 03:00 UTC 核对 `D−(stats.land_window_days+1)` 到 `D−(stats.land_window_days+4)` 这 4 天（比补数窗口更早、已经固定的日子；窗口内的日子和实时查询同一份数据，核对没有意义）：已落地的 `newAccountsRegistered` 与 `User` 表按 `createdAt` 的现时计数比较。已落地值**大于**现时计数写 WARN（之后有账号被删除，这是正常的）；已落地值**小于**现时计数写 ERROR（含日期和差值）。依据：dramaBox 有夜间对账任务，容差和只记日志的做法不同，这里是本项目自己的规则 [子代理读码 dramaBox `StatReconcileJob`，05:10 GMT+8]。账号删除会让日后的重算结果低于当时落地的值，这是隐私删除的后果，不是错误。
- 任务失败不影响其他任务，下一轮重试；失败写 ERROR 日志，含任务名和日期。

#### 报表接口

除 `/stats/usage-cost`（权限 `COST:VIEW`）外均为 GET，权限 `STATS:VIEW`；`from`、`to` 是 `YYYY-MM-DD`，跨度不超过 `stats.max_range_days`，不传时取最近 7 天；响应 `{"items":[...]}`（不分页，一般一天一行；例外：`/stats/checkin/streak-buckets` 每个连续天数一行，`/stats/tasks/summary` 范围内每个任务一行，28.1、28.2）。

| 接口 | 参数 | 每行字段 |
|---|---|---|
| `/stats/daily` | `from`, `to`, `platform`（默认 `ALL`）, `channel`（默认 `ALL`） | `StatDailyEvent` 的列；`platform=ALL` 时还有 `StatDailyBusiness` 的列和 `activeSubscriptions`（来自 `StatSubscriptionSnapshot`，当天和缺失的日子为 `null`）、`activeSubscriptionsBackfilled`，其余平台这些列为 `null` |
| `/stats/retention` | `from`, `to`（cohort 日期范围）, `type`（`ACTIVE`/`CALL`，默认 `ACTIVE`）, `platform`（默认 `ALL`）, `channel`（默认 `ALL`） | `StatRetention` 的列 |
| `/stats/checkin/daily-users` | `from`, `to` | `[{statDate,userCount}]`（28.1，日期是账号本地日） |
| `/stats/checkin/streak-buckets` | `from`, `to` | `[{consecutiveDays,checkinCount}]`（28.1） |
| `/stats/tasks/summary` | `from`, `to` | 每个任务的 `{taskId,taskName,totalRecords,completedCount,rewardedCount,creditsIssued,completionRate}`（28.2） |
| `/stats/tasks/daily` | `from`, `to` | 逐日的 `{statDate,totalRecords,completedCount,rewardedCount}`（28.2） |
| `/stats/reactivation` | `from`, `to`, `silenceDays`（7/14/30，默认 7） | `StatReactivation` 的列 |
| `/stats/guest/daily` | `from`, `to`（固定返回 `channelCode=ALL` 行） | `statDate`, `guestDevicesNew`, `guestDevicesConverted` |
| `/stats/guest/cohort` | `from`, `to`（这张表不按渠道和平台拆分，没有这两个维度） | `StatGuestCohort` 的列 |
| `/stats/guest/retention` | `from`, `to`（cohort 日期范围）, `platform`（默认 `ALL`）, `channel`（默认 `ALL`） | `StatGuestRetention` 的列 |
| `/stats/guest/quota` | `from`, `to`（按 `GuestDevice.firstSeenAt` 的 UTC 日期）| 现查 `GuestDevice`，不汇总，没有落地和补数；响应是单个对象（不是 `items`）：`{"configuredTotalSeconds":n或null,"devices":n,"noGrant":n,"neverCalled":n,"avgUsedSeconds":n或null（没有有额度的设备时为 `null`）,"exhausted":n,"buckets":{"ZERO":{"devices":n,"converted":n},"LE_25":{"devices":n,"converted":n},"LE_50":{"devices":n,"converted":n},"LE_75":{"devices":n,"converted":n},"LT_100":{"devices":n,"converted":n},"GE_100":{"devices":n,"converted":n}}}`，六档含义见下面"口径"里的"游客额度使用"；`from`/`to` 超过 `stats.max_range_days` 同其他报表 |
| `/stats/session-quality` | `from`, `to` | `StatSessionQualityDaily` 的列 |
| `/stats/push` | `from`, `to`, `triggerReason`（可选） | `StatPushDaily` 的列 |
| `/stats/usage-cost` | `from`, `to`, `resourceType`, `provider`, `model`, `source`, `tier`, `currency`（都可选；权限 `COST:VIEW`，不是 `STATS:VIEW`） | `StatUsageCostDaily` 的列 |

补数：`POST /stats/land/{name}?date=YYYY-MM-DD`，`name` 取 `daily-event`、`daily-business`、`subscription-snapshot`（只写缺失的行，`backfilled=true`）、`retention`、`reactivation`、`guest-cohort`、`guest-retention`、`session-quality`、`push`、`usage-cost`、`ad-daily`（广告日汇总，第二十二节 22.8，两张广告表的来源和补数保护不同）、`attribution-daily`（投放效果，10.5）、`share-funnel`、`share-channel`（分享统计，9.2）、`checkin-daily`、`task-daily`（28），权限 `STATS:LAND`，写审计日志。`retention` 的 `date` 是**检查日**：填该日对应的各个 N 的格子，不是整行重算（依据：dramaBox 同样如此 [子代理读码 dramaBox-admin `src/pages/stat/retention/index.tsx` 的提示文字]）。

#### 不汇总、现查的报表

邀请统计（`InviteRecord`，17.4）、订阅和额度统计（`FINANCE:VIEW`，17.4）、审核统计（`ModerationRecord`，17.4）、归因汇总（`AttributionRecord`，10.3）：来自事务表、量小，现查。

---

## 十八、数据模型总览

**账号 ID 格式**：`User.id` 是 UUID 字符串（36 个字符，不含空白）。AvatarMemory 只接受 1 到 128 个字符、不含空白的 `account_id`（AvatarAgent 设计文档第 7、11 节），UUID 满足这一要求。

| 实体 | 关键字段 | 说明 |
|------|---------|------|
| User | id, email(可空,手机号账号为空；规范化后非空时唯一，2.2、2.7), emailVerifiedAt(可空，邮箱验证通过的时间，2.2、2.7), passwordHash(可空), status(ACTIVE/BANNED/PENDING_DELETION/DELETING), banReason(可空), bannedAt(可空), googleSub(可空,唯一), appleSub(可空,唯一), phone(可空,E.164,唯一，23.8), phoneVerifiedAt(可空), currentAvatarAssetId, currentVoiceAssetId, persona(可空文本), personaPending(可空文本), personaModerationStatus(NONE/PENDING_REVIEW/REJECTED), personaPendingRef(可空，UUID，当前待审版本，2.5), companionName(可空，伴侣名字，2.5.1), companionNameRef(可空，UUID，每次保存伴侣名字时重新生成，事后复核用，2.5.1), timezone(可空), conversationLanguage(可空), lifetimeGrantSeconds(可空，终身额度的发放值，-1 表示不限，15.6), lifetimeUsedSeconds, channelCode(可空，注册渠道，24.7，只在创建时记入), registerDeviceHash(可空，创建账号时的设备 HMAC 哈希，13.5), registerPlatform(可空，`ANDROID`/`IOS`，创建账号时取请求的 `client.platform`，请求没带则为空，统计里归 `unknown`，只在创建时记入), priorInviteeRewarded(默认 false，创建账号时命中防滥用标记的 `inviteeRewarded` 则为 true，13.5、9.1), inviteeRewardedAt(可空，作为被邀请人的奖励评估通过的时刻，9.1；13.5 据此判断“被邀请人拿到过奖励”), inviteRewardedCount(默认 0，创建账号时命中防滥用标记则取标记里的最大值（13.5）；作为邀请人已获得邀请奖励的次数，只增不减，9.1), createdAt | 见 2.x |
| RefreshToken | id, accountId, familyId, familyCreatedAt, tokenHash, createdAt, expiresAt, usedAt, revokedAt, platform, appVersion, deviceName | 只存哈希；复用检测靠 `usedAt`（2.6）；设备列表的 `lastUsedAt` 取该链最近一条的 `createdAt`（2.9）；`platform`、`appVersion`、`deviceName` 取自登录和注册请求里可选的 `client` 对象（2.2），供设备列表显示（2.9） |
| InviteCode | id, code(唯一，8 位，字符集 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`，大写存储，2.4), ownerAccountId | 每个账号注册时自动生成一个 |
| InviteRecord | id, inviterAccountId, inviteeAccountId(唯一：一个账号最多被邀请一次，邀请关系是一棵树), redeemedAt, rewardStatus(`PENDING`/`REWARDED`/`NOT_ELIGIBLE`，创建时 `PENDING`), rewardReason(可空：`DISABLED`/`OUT_OF_WINDOW`/`ACCOUNT_STATE`/`LIMIT_REACHED`/`SAME_DEVICE`/`PRIOR_ACCOUNT`), inviterCreditsGranted(可空), inviteeCreditsGranted(可空), rewardedAt(可空) | 奖励规则见 9.1；发放金额记在这里，之后改配置不影响 |
| CheckinActivity | id, name, startDate(可空), endDate(可空), status(`DRAFT`/`ACTIVE`/`DISABLED`), createdBy, createdAt, updatedAt | 签到活动（28.1）；`lifecycleStatus` 的 `ENDED` 现算 |
| CheckinReward | activityId, dayNum, rewardCredits, bonusCredits | 签到奖励阶梯，`(activityId, dayNum)` 唯一（28.1） |
| CheckinRecord | id, accountId, activityId, checkinDate(账号本地日), dayNum, consecutiveDays, rewardCredits, bonusCredits, createdAt | `(accountId, checkinDate)` 唯一；发放的数值记在这里；账号删除时删除（13.1） |
| TaskConfig | id, taskName, taskType(`daily_login`/`call_seconds`/`text_messages`), targetValue, rewardCredits, description, claimTimeoutSeconds(可空), sortOrder, status(`ENABLED`/`DISABLED`), createdAt, updatedAt | 每日任务配置（28.2） |
| TaskRecord | id, accountId, taskId, taskDate(账号本地日), timezone, windowStartAt, windowEndAt, targetValue(创建时快照), rewardCredits(可空，达成时快照), currentProgress, status(`IN_PROGRESS`/`CLAIMABLE`/`REWARDED`/`EXPIRED`), completedAt(可空), claimDeadlineAt(可空), rewardedAt(可空), creditsGranted(可空) | `(accountId, taskId, taskDate)` 唯一；账号删除时删除（13.1） |
| GenerationTask | id, accountId(可空：为空表示系统任务，用于生成系统默认数字人，不计入任何账号的上限、不扣额度，3.10), type(AVATAR/VOICE/LOOK/LOOK_REPREPARE/ACTION_CLIP), status(PENDING/IN_REVIEW/PROCESSING/SUCCEEDED/FAILED；允许 `PROCESSING → IN_REVIEW`，即生成结果中风险进复核，3.3), externalRef, resultRef, assetId(可空：任务成功后产出的 `AvatarAsset` 或 `VoiceAsset`，`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP` 任务恒为空，3.3), avatarAssetId(可空：`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP` 任务从创建起记它的目标形象，`AVATAR` 任务为空), lookId(可空：`LOOK` 任务成功后记新外观，`LOOK_REPREPARE`、`ACTION_CLIP` 任务从创建起记目标外观，`AVATAR` 任务为空), actionItemId(可空，仅 `ACTION_CLIP`), style(可空，仅 `AVATAR`、`LOOK`：形象的风格，`LOOK` 取形象已有的风格), declarationVersion、declarationAcceptedAt(可空，仅 `AVATAR`，3.2：落地时写进 `AvatarAsset`), outfitItemId、backgroundItemId(可空，仅 `AVATAR`、`LOOK`：这次生成用的服装和背景条目，`AVATAR` 取默认条目，`LOOK` 取请求里选的，3.6：落地时写进 `AvatarLook`), rendererFormatVersion(可空：`LOOK_REPREPARE` 是要准备的格式版本，3.9；`AVATAR`、`LOOK` 是生成服务这次准备的资源包的格式版本，落地时写进 `LookPackage`), failureReason(`CONTENT_REJECTED`/`GENERATION_FAILED`/`EXTERNAL_TIMEOUT`/`EXTERNAL_TASK_LOST`/`SUBJECT_UNDERAGE`/`NO_FACE_DETECTED`，内部值 `ACCOUNT_DELETED`), moderationRecordId(可空), originalFileRef, transcript(可空,仅声音), assetName(可空，仅 `AVATAR`：上传时填的形象名字，3.2), externalName(创建任务时生成：形象类任务是提交方法的 `ref`，声音是音色名，3.5), idempotencyKey(可空，与 accountId、avatarAssetId 一起唯一（`avatarAssetId` 为空按同为空处理），24 小时后置空，3.2；`LOOK` 同样适用), submittedAt(可空，提交给外部服务的时间，超时从它算，3.5), createdAt, updatedAt | externalRef是外部生成服务那边的任务引用；资产删除时 `assetId`、`assetName`、`originalFileRef`、`transcript`、`resultRef`、`externalName`、`lookId`、`actionItemId` 置空（3.4） |
| AvatarAsset / VoiceAsset | id, accountId, resultRef, originalFileRef, createdAt；仅形象另有 name(1 到 30 个码点，3.2), style(`STYLIZED_3D`/`REALISTIC`), declarationVersion(可空，`avatar.declaration_required=false` 时为空), declarationAcceptedAt(可空), currentLookId | 一个账号可以有多条(资产库)。`VoiceAsset.resultRef` 是合成服务里的音色名，见 3.5；`AvatarAsset.resultRef` 是形象生成服务给的引用，只用于 `delete`。形象的预览取当前外观的 `AvatarLook.previewRef`（按 `currentLookId`，3.4），`AvatarAsset` 自己没有预览列；`originalFileRef` 在 `avatar.source_photo_retention_days` 大于 0 时到期置空（原照已删，3.2） |
| AvatarLook | id, avatarAssetId(可空，默认数字人的外观为空), accountId(可空，默认数字人的外观为空), outfitItemId, backgroundItemId, status(`READY`), canonicalImageRef, previewRef, createdAt | 外观（3.6）。只在生成成功时创建，所以状态只有 `READY`；驱动资源包按格式版本记在 `LookPackage`。形象被删除时它的所有外观一起删除 |
| LookPackage | id, lookId, rendererFormatVersion, packageRef(可空，不是 `READY` 时为空), sha256(可空，同上), sizeBytes(可空，同上), status(`READY`/`PREPARING`/`FAILED`), attempts(准备失败的次数), nextAttemptAt(可空：`FAILED` 时下一次允许重试的时刻，重试用完时为空), createdAt | 外观的驱动资源包，每个渲染器格式版本最多一个（3.9）；`(lookId, rendererFormatVersion)` 唯一。外观创建时写第一条；客户端或云端渲染服务请求其他支持的格式版本时插入 `PREPARING` 行并排 `LOOK_REPREPARE`，成功置 `READY`，失败置 `FAILED` 并按退避设 `nextAttemptAt`，失败 `generation.reprepare_max_attempts` 次后不再重试并告警（3.9）。外观、形象、账号删除时随外观一起删除（行和文件，3.4、3.6、13.1）；没有任何启用的 `RendererModel` 使用的格式版本的行和文件由每天的清理任务删除 |
| CosmeticItem | id, key(唯一，创建后不可改), kind(`OUTFIT`/`BACKGROUND`), names(多语言), previewRef, generationSpec(生成用的描述，只有管理员能写；英文，去掉首尾空白（按 1.9 的集合）后 1 到 2000 个 Unicode 码点，保存时校验；它原样接进 AvatarEngine 的英文提示词：服装写成能接在 "The person is wearing" 后面的名词短语，背景写成能接在 "Background:" 后面的场景描述（标准图是带场景的半身像，形象渲染设计第二部分）), compatibleStyles, surfaces(格式见 3.7), creditPrice(可空：空表示不能用额度兑换), isFree, isDefault, enabled, sortOrder | 服装和背景目录（3.7）。每种 `kind` 各有一个 `isDefault=true` 的免费条目 |
| AccountCosmetic | accountId, itemId, source(`CREDITS`/`ADMIN_GRANT`), creditLedgerId(可空), grantedAt | 账号拥有的服装和背景，一旦获得永久拥有（3.7）；免费条目不需要这条记录；账号删除时删除（13.1） |
| ActionItem | id, key(唯一), names, description(给 agent 看的英文说明), iconRef, generationSpec(生成片段用的描述；完整的英文句子，后面由 AvatarEngine 接一段固定的英文结尾；去掉首尾空白（按 1.9 的集合）后 1 到 2000 个 Unicode 码点，保存时校验), compatibleStyles, surfaces, triggerableBy(`USER`/`AGENT`/`BOTH`), enabled, sortOrder | 固定动作目录（3.8）；所有动作都是事先生成的片段，没有种类字段 |
| ActionClip | id, lookId, actionItemId, status(`PENDING`/`GENERATING`/`IN_REVIEW`/`READY`/`FAILED`), clipRef, sha256, sizeBytes, durationMs, createdAt | 每个外观的每个适用动作一段片段（3.8）；`(lookId, actionItemId)` 唯一；`sha256`、`sizeBytes` 在片段文件取回时算出，随 media 响应下发（3.9） |
| RendererModel | id, rendererKind(`AVATAR_RENDERER_V1`：格式 1 的渲染模型，资源包和渲染模型 zip 的 `manifest.json` 里的 `rendererKind` 同值；以后加自己的模型), version, platform, abi, fileRef, sha256, sizeBytes, rendererFormatVersion, minVersionCode(整数，能使用这个模型的最低 App 版本号，含义同第二十四节的 `minVersionCode`), enabled, createdAt(登记时间，登记后不变；3.9 判定“最新”用它) | 渲染模型文件的版本登记（3.9）；`(rendererKind, version, platform, abi)` 唯一；文件包括渲染网络、LSTM 权重、`pca_mediapipe.pkl` 和转换层的形状表，所有构建都下发；渲染模型文件名为 `avatar-renderer-<版本>.zip` |
| DeclarationVersion | version(唯一), texts(多语言), activeFrom, isActive | 上传声明的文案版本（3.2），每套部署分别配置 |
| LikenessComplaint | id, contactEmail, description, evidenceRefs, status(`RECEIVED`/`INVESTIGATING`/`RESOLVED_REMOVED`/`RESOLVED_NOT_FOUND`/`REJECTED`), receivedAt, dueAt, resolvedAt(进入已结案状态时写), handledBy(最近一次流转的管理员), relatedAvatarAssetIds | 照片里的人的投诉（11.6）。投诉人的邮箱和证据也是个人数据，保留 `complaint.retention_days` 天后删除（17.5）；`relatedAvatarAssetIds` 在被投诉的账号删除后照样保留（只是 ID，理由同 `AdminAuditLog.targetId`，13.1） |
| LikenessComplaintEvent | id, complaintId, fromStatus, toStatus, note(可空), adminId, createdAt | 投诉的处理记录（11.6）：每次状态流转（含删除执行）一行，`GET /likeness-complaints/{id}` 的"处理记录"取自它；随投诉一起按 `complaint.retention_days` 删除 |
| DefaultAvatar | id, style, name(非空，默认数字人的名字，创建时必填，3.10), sourceImageRef, lookId(它的唯一外观), status(`DRAFT`/`GENERATING`/`READY`，3.10), failureReason(可空，取 3.3 的六个值之一，3.10), isActive | 系统默认数字人（3.10），同一时刻只有一个生效 |
| ExternalDeletionJob | id, type(AVATAR/VOICE), externalRef, attempts, nextAttemptAt, lockedAt(可空), status(`PENDING`/`DONE`), lastError, createdAt(`AVATAR_DELETION_OVERDUE` 从它起算), completedAt(可空，进入 `DONE` 时写，已完成任务的保留期从它起算) | 资产删除时清外部数据的重试任务（13.2）。**不含账号 ID**，账号删除后不受影响 |
| Session | id, accountId(可空，游客会话为空，4.3), deviceId(可空，仅游客会话), freeTier, roomName, requestedAt, timezone, modelTier, language, renderMode(`DEVICE`/`CLOUD`/`NONE`，4.1), deadlineAt, startedAt, endReason(可空，`DEADLINE`/`USER_LEFT`/`ROOM_FINISHED`/`BANNED`/`SUPERSEDED`，15.6), agentJoinedAt(可空), lastParticipantEventAt(可空，最近已应用的参与者 webhook 的 `createdAt`，4.2), agentIdentity(可空，agent 参与者的 identity，4.1 第 4 步记下，4.2 据此区分 agent), userJoinedAt(可空，`participant_joined` webhook 写入，4.2), userLeftAt(可空，`participant_left` 写入或存活核对补写，重连时清空，4.2、15.6), endedAt(可空), durationSeconds(可空), statsAppliedAt(可空) | 一次LiveKit房间会话；`deadlineAt` 所有会话都有（15.6）；`agentJoinedAt` 为空表示"启动中"，agent 加入房间后由 4.1 第 4 步写入；`durationSeconds`、`statsAppliedAt` 由会话结束流程写入 |
| GuestDevice | deviceIdHash(主键，`deviceId` 的 SHA-256), platform, channelCode(可空，24.7), firstSeenAt, lastSeenAt, grantedSeconds(可空，发放时记入的额度秒数，2.1), usedSeconds, convertedAt(可空), convertedAccountId(可空) | 游客的设备级额度和转注册记录（2.1、4.3），不含任何内容。`convertedAccountId` 在账号删除时置空（13.1）。设备记录的保留期限和隐私政策表述是缺的输入（保留太短会让额度被绕过）；游客 `Session` 的保留见 4.3 |
| EmailTemplate | templateCode(主键，代码声明：`REGISTER_CODE`、`PASSWORD_RESET`、`DELETION_CONFIRM`、`PASSWORD_CHANGED`、`LIKENESS_COMPLAINT_RECEIVED`), subject, body, updatedBy, updatedAt | 邮件模板，只有英文一份，后台可编辑，没有改过时用代码里的默认文案（2.2.1、2.9、13.4、11.6） |
| PasswordResetToken | id, accountId, tokenHash, expiresAt, usedAt | 重置令牌，只存哈希，单次使用（2.9）；账号删除时删除（13.1） |
| RegistrationAudit | accountId(主键), deviceIdHash(`deviceId` 的 HMAC-SHA256，密钥 `ABUSE_HASH_KEY`；创建账号的请求都必须带 `deviceId`，所以不为空), ipHash, method(`EMAIL`/`GOOGLE`/`APPLE`/`PHONE`), createdAt | 创建账号时写，供多开检测（17.4）；保留 `abuse.audit_retention_days`，每天一次的清理任务删除过期行，账号删除时删除 |
| AuthEvent（MongoDB `auth_event`） | type, accountId(可空), ipHash, deviceIdHash(可空), reason(可空), at, expireAt | 认证事件日志（2.11），TTL `auth.log_retention_days` |
| Message | id(账号内单调递增), accountId, sessionId(可空，文字对话没有), source(`CALL`/`TEXT`), messageKey(仅 `CALL`), turnKey(仅 `TEXT`：这一轮用户消息的 `messageKey`，用户消息和它的回复相同), turnStatus(可空：仅 `TEXT` 的用户消息，`PENDING`/`COMPLETED`/`FAILED`), sender(USER/ASSISTANT), text, timestamp(即 createdAt), interrupted, updatedAt, hidden | 只存文字，不存音频；`CALL` 的 `(sessionId, messageKey)` 唯一；`TEXT` 的 `(accountId, turnKey, sender)` 唯一 |
| CompanionshipStats | accountId, interactionCount, currentStreak, lastInteractionDate, lastInteractionAt, lastTextAt(可空，最近一条文字消息的时间，6.1 判断是否算新的一次互动) | |
| Milestone | id, accountId, milestoneKey(唯一约束: accountId+key), content, occurredAt | |
| PushToken | id, pushToken(唯一), accountId(可空，游客为空), deviceId(可空，仅游客 token，SHA-256 哈希), sessionFamilyId(可空，账号令牌登记时取自 `sid`，登录链作废时据此删除，2.6、8.1), platform(ANDROID/IOS), appVersion, locale, lastSeenAt | 唯一键是 `pushToken` 不是账号（8.1）；游客 token 过期清理见 8.1 |
| NotificationPreference | accountId, recall, announcement, activity(默认 true，2026-10-18 加) | 8.2 |
| PushRecord | id(即 `pushId`), accountId, pushType, triggerReason(daily_recall/streak_at_risk/admin/system_event), localDate, createdAt | 一次推送一条。对召回类原因（只发账号），`(accountId, localDate)` 在 `triggerReason IN ('daily_recall','streak_at_risk')` 时唯一（部分唯一索引，8.4）；`admin`、`system_event` 类不受此约束；`localDate` 对所有原因都是发送时账号时区（`User.timezone`，为空时 UTC）的日期 |
| PushDelivery | id, pushId, pushTokenId, result(`ACCEPTED` 推送平台已接受 / `INVALID_TOKEN` 平台说 token 已失效 / `FAILED` 其他失败), sentAt | 一次推送对每个 token 的发送结果；第八节的发送实现必须写入这三个取值之一，17.6 据此统计推送效果 |
| PushTemplate | id, triggerReason, locale, title, body, linkType, linkTarget, imageUrl, enabled(默认 false) | `(triggerReason, locale)` 唯一；只有召回类原因（`daily_recall`、`streak_at_risk`）有模板，`admin` 和 `system_event` 的文字来自推送任务或通知本身，保存其他原因的模板 → 400 `INVALID_REQUEST`；召回触发原因要启用，必须该原因下 `app.supported_locales` 的每种语言都有模板（8.4，保存时校验） |
| PushTask | id, createdBy, audience(ALL/ACCOUNTS/GUESTS/ACCOUNT_IDS), accountIds, platforms, locales, title, body, linkType, linkTarget, imageUrl, scheduledAt, scheduleId(可空), status(PENDING/RUNNING/DONE/CANCELLED), lockedAt(可空), cursor(可空，最后处理完的账号或游客 token，形如 `A:<账号 ID>`、`G:<token ID>`，8.5), note(可空，如 `MISSED`), sentCount, failedCount | 管理后台手动推送（8.5）；`(scheduleId, scheduledAt)` 唯一 |
| PushSchedule | id, createdBy, repeat(DAILY/WEEKLY/MONTHLY), daysOfWeek, dayOfMonth, timeOfDay, timezone, startDate, endDate(可空), enabled, nextRunAt, audience, accountIds, platforms, locales, title, body, linkType, linkTarget, imageUrl, createdAt | 周期推送（8.5） |
| EventLog（MongoDB） | accountId(可空), deviceId(可空，`source=SERVER` 的事件为空), name, source(`CLIENT`/`SERVER`), params, context, clientTime(客户端自报，不信任), receivedAt, seq, ip, country(可空), expireAt | TTL 索引在 `expireAt`，每条自带过期时间（7.2）；索引 `(accountId, receivedAt)`、`(name, receivedAt)`、`(deviceId, receivedAt)`、`(source, receivedAt)`；存 IP，隐私要求见 7.2 |
| AttributionRecord | id, source(`APPSFLYER`/`SELF`), accountId(可空), registeredAt(可空，关联到账号的时间，只填第一次), appsflyerId(可空，仅 `APPSFLYER`), deviceId(可空，仅 `SELF`，SHA-256 哈希), attrId(可空，仅 `SELF`), matchType(可空，仅 `SELF`：`APK_BLOCK`/`REFERRER`/`FINGERPRINT`), eventName, eventType(可空，仅 `APPSFLYER`), eventTime, conversionType, campaignType, mediaSource, campaign, attributionCampaignId(可空，仅 `SELF`，指向 `AttributionCampaign`), afCampaignId(可空，仅 `APPSFLYER`，`af_c_id`), adset, afAdsetId(可空), ad, afAdId(可空), attributedTouchType(可空), attributedTouchTime(可空), appId(可空), installTime, isRetargeting, platform, countryCode, appVersion, cost(可空，仅 `APPSFLYER`，`af_cost_value`), costCurrency(可空，`af_cost_currency`), costModel(可空，`af_cost_model`), costInSelectedCurrency(可空，`cost_in_selected_currency`), createdAt(入库时间；没有账号的记录的保留期从它起算，10.4) | `APPSFLYER`：`(appsflyerId, eventName, eventTime, eventType)` 唯一；`SELF`：`attrId` 唯一、`deviceId` 唯一；不存 IP、UA、广告 ID（10.1、10.4）；没有账号的行保留 `attribution.record_retention_days` |
| AttributionCampaign（投放账户） | id, code(唯一，创建后不可改), name, mediaSource, utmMedium, campaign, adset(可空), ad(可空), facebookPixelId(可空), googlePixelId(可空), tiktokPixelId(可空), facebookAccessTokenEnc(可空，加密，永不返回明文), channelCodes(关联的渠道包，24.7), remark, enabled, createdBy, createdAt, updatedAt | 10.5；不能删除，只能停用 |
| AttributionClick（MongoDB） | id, attrId(唯一), campaignId, channel(`STORE_REDIRECT`/`APK_DOWNLOAD`), utmSource, utmMedium, utmCampaign, ip, userAgent, clickedAt, claimedAt(可空), expireAt, purgeAt | TTL 索引在 `purgeAt`（`expireAfterSeconds=0`），`expireAt` 只用于匹配和明细状态（`attribution.click_retention_days`、`attribution.click_expired_keep_days`）；索引 `(ip, clickedAt)`；存 IP 和 UA，隐私要求见 10.4；点击记录只有 Android 的点击：`GET /go/{code}` 遇到非 Android 设备不记点击，`POST /api/attribution/click` 的 `DOWNLOAD_CLICK` 在 UA 不是 Android 时返回 200 和 `{"attrId":null}`、不记点击（10.4） |
| AttributionClaim | deviceIdHash(主键), matched, attrId(可空), createdAt | 自建归因的认领记录，一台设备一行，保证认领只评估一次（10.4）；没有账号，保留 `attribution.record_retention_days` |
| AttributionPageView（MongoDB 计数） | (statDate, campaignId) 唯一, count, expireAt | 落地页访问计数，`PAGE_VIEW` 到达时自增（10.4 1b）；`expireAt = statDate + attribution.record_retention_days`，TTL 索引（`expireAfterSeconds=0`）自动过期 |
| AttributionCost | id, campaignId, statDate(UTC 日), amount, currency, remark(可空), createdBy, createdAt, updatedAt | `(campaignId, statDate)` 唯一；手工录入的投放成本（10.5） |
| AttributionLink | accountId, appsflyerId(全局唯一) | 10.2；一次安装只归属第一个关联它的账号；账号可有多条 |
| ModerationRecord | id, accountId(可空), contentType(AVATAR/VOICE/MESSAGE/PERSONA/COMPANION_NAME/AVATAR_IMAGE/ACTION_CLIP；`COMPANION_NAME` 是伴侣名字，2.5.1；`AVATAR_IMAGE` 是生成的标准图，`ACTION_CLIP` 是动作片段，11.1), contentRef, source(AUTO/REPORT/COMPLAINT；`COMPLAINT` 是照片里的人投诉属实后删除形象时写的记录，供统计，11.6), autoLevel, categories, score, providerRef, status(PENDING_REVIEW/APPROVED/REJECTED/BLOCKED), reporterReason, reporterDetail, reviewedBy, reviewedAt, note, createdAt | 不存被审核内容的原文（BLOCK 的文本不落库）；`contentRef`：`MESSAGE` 取 `Message.id`（已保存的消息），被拦下没有保存的消息取一个新生成的 UUID（不对应任何 `Message`）；`BLOCKED` 表示自动拦截、不进人工队列的记录；账号删除后去掉 `accountId` 并清空举报文字后保留（13.1） |
| SupportFeedback | id, accountId, category, message, context, forwardStatus(PENDING/FORWARDED/FAILED), forwardRef, attempts, nextAttemptAt(可空), lastError(可空), createdAt | 转发的退避和失败规则见 12 |
| AccountDeletion | id, accountId, requestedBy(可空，后台代用户发起时的管理员 ID，17.4), reason(可空，用户选的删除原因枚举，13.1), status(SCHEDULED/CANCELED/PENDING/RUNNING/FAILED/COMPLETED), executeAfter(宽限期满的时间), statusBefore(申请删除时的 `User.status`，取消时恢复), canceledAt(可空), stepStates(7 项数组，13.1), attempts(失败次数), lastError, nextAttemptAt(可空：`SCHEDULED`、`CANCELED` 时为空，进入 `PENDING` 时置为现在), lockedAt(可空), createdAt, completedAt | 只含账号 ID，无其他个人信息；`SCHEDULED` 在宽限期内，到期后变 `PENDING` 开始执行（13.1）；`CANCELED` 是用户在宽限期内取消 |
| AbuseMarker | id, keyType(`DEVICE`/`PHONE`/`EMAIL`/`GOOGLE`/`APPLE`), keyHash(HMAC-SHA256，密钥 `ABUSE_HASH_KEY`；`DEVICE` 直接用 `User.registerDeviceHash`), lifetimeGrantSeconds(可空), lifetimeUsedSeconds, inviteeRewarded, inviteRewardedCount, createdAt, expireAt | 账号删除后留下的防滥用标记（13.5）；`(keyType, keyHash)` 唯一；每天一次的清理任务删除 `expireAt` 已过的行（同 `RegistrationAudit`）；不含账号 ID、内容和明文 |
| DeletionToken | id, accountId, tokenHash, expiresAt, usedAt | 网页删除的一次性确认令牌（13.4），随账号删除清除 |
| ExportJob | id, accountId, status(PENDING/READY/FAILED/EXPIRED), fileRef, expiresAt, failureReason(`MEMORY_SERVICE_ERROR`/`STORAGE_ERROR`/`TIMEOUT`/`ACCOUNT_DELETION`/`INTERNAL_ERROR`), attempts, lockedAt(可空), nextAttemptAt(可空), createdAt | 生命周期见 13.3 |
| PipelineMetricSnapshot | id, reportedAt, effectiveAt, source, gpuUtilization, errorCount, errorRate | 各指标可空（十四）；`sessionCostEstimate`、`costUnit` 已删除，用量与费用见 14.2 |
| UsagePrice | id, batchId, resourceType, provider, model, unit(`TOKENS_1M`/`CALL`/`SECOND`/`MINUTE`，14.2), effectiveFrom(UTC 日), currency, inputMinTokens, inputMaxTokens(可空，空表示不限), inputPrice(仅 LLM), cachedInputPrice(可空，仅 LLM，空则按 inputPrice), outputPrice(仅 LLM；以上三个价格都是每百万 token，`numeric(20,10)`), unitPrice(非 LLM，每个计量单位，`numeric(20,10)`), status(`PENDING_REVIEW`/`ACTIVE`/`REJECTED`/`SUPERSEDED`/`RETIRED`), source(`SYNC`/`MANUAL`), rawSnapshot(可空，同步到的原始条目), confirmedBy(可空), confirmedAt(可空), reviewNote(可空，驳回和撤回的备注), reviewedBy(可空), reviewedAt(可空), createdAt | 价格表，只追加不修改，同一 `batchId` 的各行是同一模型同一生效日期的一组档位；档位边界规则和状态含义见 14.2；被引用的行不删除 |
| UsageModel | id, resourceType, provider, model(`(resourceType, provider, model)` 唯一), syncAdapter(可空，目前只有 `DASHSCOPE_INTL`，只用于 `LLM`；空表示只能手填价格), syncModelId(可空，默认等于 model), firstSeenAt, lastSeenAt | 已见过的模型登记，每条上报的记录都会更新 `lastSeenAt`，同步任务和"没有价格"告警的依据（14.2） |
| usage_log（MongoDB） | recordKey(唯一), resourceType(`LLM`/`IMAGE_EDIT`/`IMAGE_TO_VIDEO`/`MATTING`/`DRIVING_PREP`/`AGE_ESTIMATION`/`CLOUD_RENDER`), source(`CALL`/`TEXT`/`GENERATION`), sessionId(可空), accountId(可空), guest, tier(`GUEST`/`FREE`/`PAID`/`SYSTEM`/`UNKNOWN`), provider, model, inputTokens(仅 LLM), cachedInputTokens(仅 LLM), outputTokens(仅 LLM), quantity(非 LLM), unit(非 LLM), retry(仅 `IMAGE_EDIT`), at, receivedAt, costAmount(可空，`Decimal128`), costCurrency(可空), priceId(可空), expireAt | 用量记录（原 `llm_usage_log`，14.2 的通用用量接口），每条自带过期时间 `expireAt = receivedAt + usage.retention_days`；账号删除时去掉 `accountId`、`sessionId`（13.1 步骤表第 5 步）；索引 `(at)`、`(resourceType, provider, model, at)`、`(accountId, at)`（14.2） |
| 订阅与权益相关实体 | `SubscriptionProduct`、`EntitlementDef`、`FeatureGate`、`EntitlementFeature`、`Subscription`、`SubscriptionEvent`、`AccountEntitlement` | 字段见 15.3。`FeatureGate` 的行由代码声明，每次启动时同步：新增的 key 插入（`defaultValue` 取代码里的默认值），已存在的**不覆盖**后台改过的 `defaultValue` 和 `creditCost`；代码里不再声明的 key 不删除，写一条警告日志（和 `AdminPermission` 不同：权限码不再声明就从表里删除，而功能开关的 key 可能还被权益配置引用，所以只告警） |
| 额度相关实体 | `CreditProduct`、`OneTimePurchase`、`CreditLedger`、`CreditBalance`、`AccountFeatureBonus` | 字段见 15.9 |
| 记忆服务相关实体 | `AccountMemoryTier`、`AccountEmbeddingAssignment` | 字段见 16.5 |
| AppConfig | key, value(JSON), updatedBy, updatedAt | 17.5 |
| AdminUser | id, username, passwordHash, superAdmin, status(`ACTIVE`/`DISABLED`), mustChangePassword, totpSecretEnc(可空，加密存储，17.2), totpEnrolledAt(可空), totpLastStep(可空，防重放，17.2), tokenVersion, lastLoginAt(可空), createdAt | |
| AdminRole | id, name(唯一), remark(可空), createdAt | 17.3 |
| AdminUserRole | adminId, roleId | `(adminId, roleId)` 唯一；删除管理员或角色时一并删除 |
| AdminRolePermission | roleId, permissionCode | `(roleId, permissionCode)` 唯一；删除角色或自定义权限节点时一并删除（17.3） |
| AdminPermission | code(主键), parent(可空), type(`MENU`/`FUNCTION`), sortOrder, nameZh, nameEn, builtin, createdBy(可空), createdAt, updatedAt | 权限树（17.3）；内置节点由代码同步，不能改 `code`、`parent`、不能删除 |
| AdminAuditLog | id, adminId, adminUsername(可空，写入时记下当时的用户名，之后不改，17.4 附), action, targetType, targetId, detail, createdAt | |
| CreditAdjustRequest | id, accountId, kind(GRANT/ADJUST), delta, reason, status(PENDING/APPROVED/REJECTED), applicantAdminId, reviewerAdminId(可空), reviewNote(可空), ledgerId(可空), createdAt, reviewedAt(可空) | 手动发放和调整的申请与审核，15.9 |
| SavedFunnel | id, name, steps(事件名列表), windowHours, isPreset, createdBy(可空), createdAt, updatedAt | 已保存的漏斗，预设由代码写入，17.4 |
| AdminUpload | id(即 `uploadId`), kind(`AD_MEDIA`/`APK`/`PUSH_IMAGE`/`CATALOG_IMAGE`/`RENDERER_MODEL`/`DEFAULT_AVATAR_SOURCE`), fileRef, thumbnailRef(可空), mediaType, width(可空), height(可空), bytes, durationSeconds(可空), sha256(仅 `APK` 和 `RENDERER_MODEL`), uploadedBy, createdAt, deletingAt(可空，孤儿清理中), consumedAt(可空), consumedByType(可空，`CREATIVE`/`APP_VERSION`/`PUSH_TEMPLATE`/`PUSH_SCHEDULE`/`PUSH_TASK`/`COSMETIC`/`ACTION`/`RENDERER_MODEL`/`DEFAULT_AVATAR`), consumedById(可空) | 管理后台上传文件的记录（22.9、24.2）：创建素材或版本时只接受 `uploadId`；未被使用的按 `upload.orphan_hours` 清理 |
| AdminAlert | id, type, accountId(可空), refType, refId, detail, status(`OPEN`/`RESOLVED`), createdAt, resolvedAt(可空) | 后台告警，17.4；`(type, refId)` 在 `OPEN` 时唯一；账号删除时按 `accountId` 删除（13.1） |
| 广告实体 | `AdCampaign`、`AdPlacement`、`AdUnit`、`AdCreative`、`AdFrequencyState`、`AdRewardVerification`、`StatAdDaily`、`StatAdNofillDaily`；MongoDB 集合 `ad_impression_log` | 字段见 22.2（`AdPlacement`）和 22.3（其余） |
| 短信实体 | `SmsChannel`、`SmsTemplate`；MongoDB 集合 `SmsSendRecord` | 字段见 23.4；`User` 另加 `phone`（E.164，唯一）、`phoneVerifiedAt`（23.8） |
| `AppVersionRelease` | 见 24.1 | |
| `Channel` | 见 24.7 | |
| `Notification` | 见 25.2 | |
| `ClientConfigValue` | 见 26.4 | |
| 统计汇总实体 | `StatDailyEvent`、`StatDailyBusiness`、`StatSubscriptionSnapshot`、`StatRetention`、`StatReactivation`、`StatGuestCohort`、`StatGuestRetention`、`StatUsageCostDaily`、`StatSessionQualityDaily`、`StatPushDaily`、`StatAttributionDaily`、`StatShareFunnelDaily`、`StatShareChannelDaily`、`StatCheckinDaily`、`StatTaskDaily` | 字段和口径见 17.6；哪些表有 `platform` 维度见 17.6 的平台维度一行 |

**唯一键与索引**（实现必须建立，各节的幂等和查找依赖它们；标“唯一”的是唯一约束，其余是普通索引）：
- 唯一：`AdminUser.username`（不区分大小写，冲突 409 `DUPLICATE_RESOURCE`）、`AdminRole.name`、`AdminPermission.code`（冲突同样 `DUPLICATE_RESOURCE`）、`User.email`（规范化后，非空时唯一）、`User.phone`、`User.googleSub`、`User.appleSub`；`Session.roomName`（4.2 按它查找）；`InviteCode.code`、`InviteCode.ownerAccountId`；`AttributionLink.appsflyerId`；`RefreshToken.tokenHash`；`PushToken.pushToken`；`GenerationTask(accountId, avatarAssetId, idempotencyKey)`（`avatarAssetId` 为空的行按同为空处理）；`PipelineMetricSnapshot(source, reportedAt)`（14.1 靠它去重）；`CosmeticItem.key`、`ActionItem.key`、`AccountCosmetic(accountId, itemId)`、`ActionClip(lookId, actionItemId)`、`LookPackage(lookId, rendererFormatVersion)`、`DeclarationVersion.version`、`RendererModel(rendererKind, version, platform, abi)`。
- 部分唯一：`ModerationRecord(accountId, contentType, contentRef)` 在 `source=REPORT` 且 `status=PENDING_REVIEW` 时（11.3）；`AccountDeletion.accountId` 在 `status IN ('SCHEDULED','PENDING','RUNNING','FAILED')` 时（13.1）；`ExportJob.accountId` 在 `status IN ('PENDING','READY')` 时（13.3 创建时的判断顺序靠它）；`UsagePrice(resourceType, provider, model, unit, effectiveFrom)` 在 `status='ACTIVE' AND inputMinTokens=0` 时（14.2）；`AdminAlert(type, refId)` 在 `status='OPEN'` 时；`PushRecord(accountId, localDate)` 在召回类触发原因时（8.4）。
- 普通索引：`Message(accountId, timestamp, id)`、`Message(accountId, updatedAt)`（5.2 的读取和增量同步）、`Message(turnStatus, updatedAt)`（5.4 的清扫）、`Session` 的扫描列 `deadlineAt`、`statsAppliedAt`、`userLeftAt`、`requestedAt`、`agentJoinedAt`（15.6、4.1 第 4 步的扫描）各一个索引、`RefreshToken(accountId)`（设备列表、全部登出、13.1 删除）、`PasswordResetToken.tokenHash`（重置时按令牌查）、MongoDB `auth_event(accountId, at)`（管理员按账号读最新的认证事件）、`Session(accountId, startedAt)`、`Session.startedAt`、`GuestDevice.firstSeenAt`、`RefreshToken.familyId`（轮换在同一条链里产生多行，不能唯一）、`RegistrationAudit(deviceIdHash, createdAt)`、`RegistrationAudit(ipHash, createdAt)`（17.4 多开检测）。
- 各实体行里已写明的唯一约束同样必须建立：`AccountEntitlement(subscriptionId, entitlementKey)`（同一订阅同一权益只有一行）、`EntitlementDef.key` 与 `EntitlementDef.priority`、`SubscriptionProduct(store, productId)`、`CreditProduct(store, productId)`、`EntitlementFeature(entitlementKey, featureKey)`、`AccountFeatureBonus(accountId, featureKey)`、`CreditBalance.accountId`、`FeatureGate.key`、`InviteRecord.inviteeAccountId`、`CheckinRecord(accountId, checkinDate)`、`TaskRecord(accountId, taskId, taskDate)`、`CreditLedger(reason, eventKey)` 与 `(accountId, idempotencyKey)`、`OneTimePurchase(store, storeTransactionId)`、`Subscription(store, storeRef)`、`PushTemplate(triggerReason, locale)`、`PushTask(scheduleId, scheduledAt)`、`AttributionCost(campaignId, statDate)`、`AbuseMarker(keyType, keyHash)`、`Message(sessionId, messageKey)`（`CALL`）与 `Message(accountId, turnKey, sender)`（`TEXT`）、`Milestone(accountId, milestoneKey)`、`CheckinReward(activityId, dayNum)`、`AdminUserRole`、`AdminRolePermission`、`UsageModel(resourceType, provider, model)`、`AttributionRecord`（两组，见上）、`AttributionClick.attrId`、`AttributionPageView(statDate, campaignId)`、`usage_log.recordKey`、MongoDB `ad_impression_log(impressionId, eventType)`（22.4 的展示和完成事件幂等靠它兜底）、`SubscriptionEvent(store, sourceEventId)`、`AppVersionRelease(channelCode, versionCode)` 与每渠道至多一个 `ACTIVE`、`AccountMemoryTier.accountId`、`CompanionshipStats.accountId`、`NotificationPreference.accountId`、`AdRewardVerification.impressionId`、`AdFrequencyState(accountId, placementId, statDate)`、`AdPlacement.slotKey`、`Channel.code`、`SmsChannel.channelCode`、`SmsSendRecord.msgId`、`ClientConfigValue(configKey, locale)`；普通索引另有 `User.createdAt`、`Message.timestamp`、`Subscription.firstActiveAt`、`PushRecord.createdAt`、`CreditLedger(reason, createdAt)`、`InviteRecord.redeemedAt`、`AttributionRecord.accountId`、`GuestDevice.convertedAt`、`CheckinRecord.checkinDate`、`TaskRecord.taskDate`、`AttributionRecord.installTime`、`AttributionRecord.registeredAt`、`AttributionClaim.createdAt`、`PushDelivery.pushId`，以及 MongoDB `AttributionClick.clickedAt`（单独一个，除 `(ip, clickedAt)` 之外；日汇总按时间读）。

**每天一次的清理任务**（多实例用数据库锁，1.1；各节自己写明的清理照旧）：删除已过期的 `RefreshToken`（**只按 `expiresAt`** 早于现在 `tokens.cleanup_grace_days` 天，默认 1；已轮换的行在自己的有效期内必须保留，复用检测靠它们认出“已被轮换的令牌再次出现”，2.6）、`PasswordResetToken`、`DeletionToken`（`expiresAt` 或 `usedAt` 早于同一期限）；`GenerationTask.idempotencyKey` 置空（创建超过 24 小时，3.2）；`OneTimePurchase` 墓碑（`tombstonedAt` 早于 `deletion.tombstone_retention_days`，13.1）；无账号且已终结的 `Subscription`（`subscription.orphan_retention_days`，15.4）；`PipelineMetricSnapshot`（`pipeline_metrics.retention_days`，14.1）；`RegistrationAudit`（`abuse.audit_retention_days`）、`AbuseMarker`（`expireAt`）；游客的 `PushToken`（`push.guest_token_retention_days`，8.1）和游客 `Session`（`guest.session_retention_days`，4.3）；无账号的 `AttributionRecord`、`AttributionClaim`（从各自的 `createdAt` 起算，`attribution.record_retention_days`，10.4）。`ExternalDeletionJob` 中 `status=DONE` 且完成超过 `maintenance.done_job_retention_days`（默认 30，提议）天的行、`AdminAlert` 中 `RESOLVED` 且解决超过 `maintenance.resolved_alert_retention_days`（默认 180，提议）天的行；`avatar.source_photo_retention_days` 大于 0 时到期的形象原照（文件删除、`AvatarAsset.originalFileRef` 置空，3.2）；`complaint.retention_days` 到期（从 `resolvedAt` 起算，没有结案的不删）的 `LikenessComplaint` 及其 `LikenessComplaintEvent` 和证据文件（11.6）；`rendererFormatVersion` 不被任何启用的 `RendererModel` 使用的 `LookPackage` 行和它的资源包文件（3.9，格式版本停用之后）。MongoDB 里带 `expireAt` 的集合靠 TTL 索引，不在此列。

---

## 十九、跨系统集成点核实清单

### 19.1 本次修订已核实的事实

| 事实 | 依据 |
|------|------|
| AvatarMemory 没有删除或导出账号数据的接口 | `AvatarMemory/app/main.py:15-17` 只挂了 admin、accounts、memories 三个路由；`app/routers/accounts.py:20,28` 只有两个 PUT（档位、embedding 模型）；`memories.py:35,98` 是 retrieve 和 ingest |
| 合成服务（AvatarAgent 的 `tts_service`）提供音色的注册、按名查询、删除，没有列出全部音色的接口 | `AvatarAgent/tts_service/app.py` 的路由 `POST /v1/voices`、`GET /v1/voices/{name}`、`DELETE /v1/voices/{name}`；`tests/test_tts_app.py`（2026-10-01） |
| 合成服务注册音色是同步调用，没有任务概念；失败用正常的 HTTP 状态码（400、401、409、413），不再是 CosyVoice 的"HTTP 200 加 error" | `tts_service/app.py` 的 `register_voice`；`tests/test_tts_app.py`（2026-10-01）。CosyVoice 的旧行为见 `D:\Projects\CosyVoice\cosyvoice_api_server.py:191-220`，不再使用 |
| 两次显式 dispatch 在 agent 的 worker 上报"有空余容量"之前 0.7 到 1.4 秒创建，agent 始终没有收到任务，之后 20 秒里也没有重新派发；服务器日志在成功和失败的房间里都有"not dispatching agent job since no worker is available"，所以"服务器放弃 dispatch"这个机制没有证实 | AvatarAgent 联调 2026-10-01 的 LiveKit 服务器日志与 agent 日志时间戳（泰语 0.735 秒、西班牙语 1.393 秒；菲律宾语那次同样偏早但没有结果）；4.1 的重发逻辑是对这个观察的防御 |
| AvatarMemory 已删除 persona 表 | `AvatarMemory/migrations/0005_drop_persona.sql` |
| dramaBox 的邀请人资格校验：被邀请人 `createdAt` 必须晚于邀请人，否则 `INVITER_NOT_ELIGIBLE` | `dramaBox/docs/backend-task-invite-code-redesign.md:77-89` |
| Apple/Google 订阅通知类型、状态枚举、账号关联字段、Google 3 天确认要求 | 见 15.1（2026-09-30 读的官方原文） |
| Google 账号删除政策：应用内删除路径 + 网页删除链接；删除前需额外步骤（如取消订阅）必须说明并提供支持流程 | support.google.com/googleplay/android-developer/answer/13327111（2026-09-30 读过） |
| Apple 通知重试：v2 在生产环境重试 5 次，间隔 1、12、24、48、72 小时；2xx 视为成功 | developer.apple.com/documentation/appstoreservernotifications/responding-to-app-store-server-notifications |
| Google 订阅政策：订阅不得提供一次性发放的额度或货币，此类商品必须用应用内商品 | support.google.com/googleplay/android-developer/answer/9900533（2026-09-30 读过） |
| Apple 3.1.1：通过应用内购买获得的额度或货币不得过期，并要对可恢复的内购提供恢复机制 | developer.apple.com/app-store/review/guidelines/（2026-09-30 读过） |
| Google 一次性商品：`purchases.products.get`/`consume`/`acknowledge`；RTDN `oneTimeProductNotification` 类型 1 已购买、2 待处理被取消；`voidedPurchaseNotification` 的 `productType` 1 订阅、2 一次性；`purchases.voidedpurchases.list` 同时覆盖一次性商品和订阅 | Google Play Developer API 参考、rtdn-reference、voided-purchases（2026-09-30 读过） |
| Apple：`ONE_TIME_CHARGE` 是用户购买消耗型/非消耗型/非续订订阅时的通知类型（每一次购买都会收到），兑换优惠码时同样是这个类型；`REFUND_REVERSED` 适用于所有内购类型，需要恢复被撤销的内容或服务；交易信息的 `type` 区分自动续订订阅、非消耗型、消耗型、非续订订阅，另有 `revocationDate`、`purchaseDate`、`quantity`；交付内容后才 `finish()` 交易 | notificationtype、`type`、`jwstransactiondecodedpayload`、StoreKit `Transaction.finish()`（2026-09-30 读过） |
| `CONSUMPTION_REQUEST` 的处理规则：有用户同意才回应，12 小时内，同意必须 opt-in；对包括自动续订订阅在内的所有商品类型触发 | developer.apple.com/documentation/appstoreserverapi/send-consumption-information（2026-09-30 读过；由另一会话先提出，我重新读过原文） |
| AvatarMemory 有两把密钥；只有 PUT，没有查询账号档位或账号模型的接口 | AvatarMemory 设计文档「Tiered configuration」「Embedding model registry」；`app/routers/admin.py`、`app/routers/accounts.py` |
| Firebase 服务端 Remote Config 只明确支持 Node.js Admin SDK | Firebase 文档 `remote-config/server` 页正文；我查到的 Java 参考页实际是 iOS 的，Java 支持未核实，因此后端参数不依赖它 |
| LiveKit 客户端 `TokenSource` 需要服务器地址和令牌两个值 | LiveKit 文档 `frontends/build/authentication/endpoint`（`server_url`、`participant_token`）和 `custom`（Android `TokenSourceResponse(LIVEKIT_URL, participantToken)`） |

### 19.2 开发前必须确认的项（不能假设本文档写的就是最新的）

**原有项：**
- [ ] 与 AvatarEngine 按 3.5 的接口定稿联调 `AvatarGenerationProvider` 的 HTTP 接口（`submitAvatar`、`submitLook`、`submitReprepare`、`submitActionClip`、`poll`、`fetchOutput`、`delete`）
- [ ] `io.livekit:livekit-server:0.16.0` 的 `AgentDispatchServiceClient.createDispatch` 是否支持直接传 metadata，具体方法签名
- [ ] `io.livekit:livekit-server:0.16.0` 里 webhook 解析出的 `Room` 对象拿房间名的具体 getter 方法名
- [ ] 跟 `AvatarAgent` 约定文字对话的两个新接口（5.4）：`POST /v1/chat/turn`（SSE：`delta`、`done`、`error`，语音回复时另有 `audio`、`action`；请求另带 `voiceReply`、`voiceId`、`availableActions`）和 `POST /v1/chat/ingest`；`persona`、`companionName`、`modelTier`、`language` 与 dispatch 同义；AvatarAgent 现在没有 HTTP 接口（`avatar_agent/server.py` 只是 LiveKit `AgentServer`），需要新增。同时**实测**挂断后 LiveKit 房间多久关闭、`room_finished` 多久到达（决定 5.4 第 4 步 `CALL_IN_PROGRESS` 的窗口）
- [ ] 跟 `AvatarAgent` 确认：`/api/internal/messages` 的契约（按消息写入、`messageKey`、`createdAt`、`interrupted`，5.1），dispatch 的 metadata 十三个字段（`accountId`、`sessionId`、`voiceId`、`timezone`、`persona`、`companionName`、`modelTier`、`language`、`guest`、`renderMode`、`availableActions`、`lookId`、`deadlineAt`，4.1），以及 dispatch 用的 agent 名字（`LIVEKIT_AGENT_NAME`）两边是否一致
- [ ] 跟 `AvatarAgent` 约定 `companionName`（2026-10-18 加，2.5.1）：dispatch metadata（4.1）和 `/v1/chat/turn` 请求（5.4）都带它，agent 把它作为数字人自己的名字放进系统提示词；AvatarAgent 需要实现
- [ ] 跟 `AvatarAgent` 确认 `guest=true` 的 dispatch：不调用 `/api/internal/messages`、不读写 AvatarMemory、`accountId` 为空字符串时不报错（4.3）
- [ ] 设备校验（2.1），以下都**没有核实**（`requestHash` 对请求的绑定方式已核实，2.1），开发前必须核实：Play Integrity 的服务端校验方式和要求的判定、开发和测试环境如何拿到测试响应；iOS 的 App Attest 的用法
- [ ] 1.5 里每一个与别的服务共用的密钥，具体值由双方约定好，不要硬编码在代码里提交到仓库，缺一个就是对应那条链路不通：与 AvatarAgent 共用的 `INTERNAL_SIGNING_SECRET`、`PIPELINE_SIGNING_SECRET`、`AGENT_CHAT_SIGNING_SECRET`、`LLM_USAGE_SIGNING_SECRET`（AvatarAgent 按 1.8 实现对本后端调用的签名和对 `backend-chat` 请求的验证）；与形象生成服务共用的 `AVATAR_GEN_SIGNING_SECRET`（本后端调它）、`AVATARGEN_USAGE_SIGNING_SECRET`（它上报用量）；与云端渲染服务共用的 `RENDER_USAGE_SIGNING_SECRET`（它上报用量）、`RENDER_PACKAGE_SIGNING_SECRET`（它取外观的片段和资源包）；与 AvatarMemory 共用的 `AVATARMEMORY_API_KEY`、`AVATARMEMORY_ADMIN_KEY`；与合成服务共用的 `TTS_ADMIN_API_KEY`

**本次新增的项：**
- [ ] **AvatarMemory 实现 13.2 的清除和导出两个接口**（跨项目，对方项目的工作）
- [ ] 合成服务（AvatarAgent）已实现 `DELETE /v1/voices/{name}`（含删除参考录音和原文）；确认部署后的 `TTS_SERVICE_URL`，并与 AvatarAgent 约定 `TTS_ADMIN_API_KEY`
- [ ] 跟 `AvatarAgent` 确认 `chat.conversation_languages` 与它当前两个服务都支持的语言一致（2.10），以及 `language` 缺失时它按英语处理
- [ ] 跟云端渲染服务和 AvatarAgent 确认通用用量上报（14.2）的资源类型、`provider`/`model` 的取值和数量字段（`CLOUD_RENDER`；AvatarEngine 的 `IMAGE_EDIT`、`IMAGE_TO_VIDEO`、`MATTING`、`DRIVING_PREP`、`AGE_ESTIMATION` 已在 14.2 定下，2026-10-17），以及 AvatarAgent 把上报路径改为 `POST /api/internal/usage`、每条加 `resourceType`
- [ ] 跟 `AvatarAgent` 确认 LLM 用量上报（14.2）：一条记录是一次 LLM 请求；`inputTokens` 含缓存命中部分；通话和文字对话两条路径都报；游客通话也报；`provider`、`model` 在真实配置下的取值（价格表的键；通话路径已核实为 `dashscope-intl.aliyuncs.com` 和 `qwen-plus`，文字对话路径用同一配置时应相同，联调时确认）；通话路径用框架给出的 `LLMMetrics`，文字对话路径要带 `include_usage`
- [ ] **联调验证重发有效**：在 agent 容量满的瞬间 dispatch，确认 4.1 第 4 步的 `deleteDispatch` 加重新 `createDispatch` 之后 agent 能接到任务（AvatarAgent 联调只观察到 dispatch 丢失，没有试过重发）
- [ ] `io.livekit:livekit-server:0.16.0` 里 `RoomServiceClient.listParticipants`（怎么识别 agent 参与者）、`AgentDispatchServiceClient.listDispatch`、`deleteDispatch` 的具体方法签名（4.1）
- [ ] **形象生成服务实现 `delete(resultRef)`**，含原始上传素材
- [ ] `AvatarAgent` 补上向 `/api/internal/pipeline-metrics` 上报（当前设计文档无此内容）
- [ ] AppsFlyer：（1）套餐是否包含 Push API（付费高级功能，没有订阅时配置接口返回 402，10.1）；（2）路径里放密钥能否通过控制台的"URL 不安全"校验（官方只给了查询参数的例子，上线前在控制台实测）；（3）AppsFlyer 的服务器 IP 白名单（部署输入）；（4）`event_type` 的取值以 AppsFlyer 的字段字典为准（10.1 里的取值来自公告转述）
- [ ] Facebook Conversions API：投放账户保存了 Facebook 访问令牌（10.5），服务端转化回传发哪些事件、带哪些字段、用哪个接口版本，核对 Facebook 官方文档后实现；dramaBox 有这个字段，是否调用没有核实
- [ ] 第三方处的数据删除机制：AppsFlyer、Firebase 分析、第三方客服工具各自是否提供、如何调用，账号删除时是否需要调用
- [ ] FCM Admin SDK（Java）：`UNREGISTERED` 的异常类型和识别方式（`data` 值必须为字符串、多播每批上限已在 8.3 写明并有出处）
- [ ] IOS 推送到达性：纯 `data` 的静默推送在 iOS 上的送达和展示行为，决定 8.3 IOS 分支的 payload
- [ ] **订阅里按计费周期发放额度是否符合 Google Play 政策**（负责人：产品负责人，必要时法务）：19.1 里"Google 订阅政策"那一行和 15.9 记录的政策是订阅不得一次性发放额度或货币；15.3 和 15.9 提供的是按计费周期发放的额度（`credits.period_grant`，流水原因 `SUBSCRIPTION_GRANT`），默认 0，即不发。"每个周期发放"算订阅权益还是"一次性发放的额度"，政策没有写明，也没有核实；核实之前 `credits.period_grant` 保持 0，不为 Google 订阅配置大于 0 的值
- [ ] Google ID token 的服务端校验库；Apple identity token 的校验细节和邮箱规则（含隐藏邮箱中继）
- [ ] 手机号登录：接口已在第二十三节设计；缺的输入是短信供应商的选定与适配器（23.8）
- [ ] 审核服务厂商选型，及其对视频、音频的覆盖（11.2）
- [ ] 第三方客服工具选型（十二）
- [ ] Apple JWS（通知和交易）的验签方式：证书链回到 Apple 根证书的具体校验步骤，是否使用 Apple 官方的 Java 服务端库（15.5）
- [ ] Apple App Store Server API 查询订阅状态的接口与凭证（15.7）
- [ ] Google Pub/Sub 推送订阅的鉴权方式（推送请求携带的身份令牌如何校验，15.5）
- [ ] Google `BillingFlowParams` 的 obfuscated account ID 的长度与字符限制，确认能直接放账号 UUID（15.2）
- [ ] Google `purchases.subscriptionsv2.revoke` 是否退款并撤销，管理端能否据此提供退款操作（17.4 先只展示退款事件）
- [ ] Google `pendingRefundReviewNotification` 的处理时限与需要调用的接口（15.4 目前只记录并标为需人工关注）
- [ ] Apple 对有内购的应用账号删除的补充要求（developer.apple.com/support/offering-account-deletion-in-your-app/），我没读到原文（15.8）；App Store Server API 的通知历史接口细节（15.5、15.7）
- [ ] 网页删除页面和密码重置页（2.9）的域名与托管方案，`email.link_base_url` 的值，以及客服联系方式（13.4）
- [ ] 邮件发送服务是否支持非 ASCII 邮箱地址（SMTPUTF8，RFC 6531）：2.2 的格式检查接受它们（只限制 254 字节），选定邮件服务商后核实；不支持时发信返回 `EMAIL_SEND_FAILED`（2.2.1），是否在格式检查里提前拒绝非 ASCII 地址取决于这个核实结果
- [ ] **AvatarAgent 接受 dispatch metadata 的 `modelTier` 字段，并把档位名映射到模型配置**（跨项目，对方项目的工作；档位名是双方约定，本后端只透传）
- [ ] AvatarAgent 遇到不认识的 `modelTier` 档位名按 `standard` 处理（跨项目约定，15.6）
- [ ] Google：实时通知主题需要在 Play Console 里开启一次性商品事件才会收到 `oneTimeProductNotification`（15.9）；`purchases.voidedpurchases.list` 默认只返回应用内商品，订阅需要 `type=1`，有查询时间窗口和每日配额（核对 agent 报告的数值是 30 天和 6000 次，我没逐项读原文）（15.7）
- [ ] Apple 通知里如何区分优惠码兑换（`ONE_TIME_CHARGE` 负载里的优惠信息字段名，15.9）
- [ ] Google 额度商品关闭多数量购买的设置方式，以及 `orderId` 与 `purchaseToken` 在作废购买中的对应（15.9）
- [ ] Apple 消耗型交易未完成时的重新投递机制（`Transaction.unfinished`），我只读到"交付后才 finish"这一句（15.9）
- [ ] 视频取首帧用的 ffmpeg 在部署环境可用（22.9）
- [ ] `event_log` 的 TTL 索引建在每条记录自带的 `expireAt` 上（7.2），`events.ttl_days` 修改只影响之后写入的记录、不需要重建索引；开发时核实 MongoDB 对这种索引（`expireAfterSeconds=0`）的行为
- [ ] 合成服务对 m4a/AAC 的解码能力，我没有测试；后端统一转码为 WAV 后不依赖它（3.5）
- [ ] 邮件服务商及其接口（密码重置发信 2.9、注册验证码 2.2.1）
- [ ] iOS 客户端取得 FCM 令牌的方式（8.1），主设计文档 §8.7 写的是 APNs token
- [ ] 部署方案：共享文件存储、Redis、受信任反向代理传 IP 的方式（1.1、1.6）：代理传客户端 IP 的头名称和代理的网段（限流、注册审计、指纹兜底都依赖它）
- [ ] 目标市场的界面语言清单（`app.supported_locales` 的取值；客户端翻译和召回模板要先到位）：产品输入
- [ ] 游客设备记录（`GuestDevice`）的保留期和隐私政策表述：产品和法务决定（保留太短会让额度被绕过，18）
- [ ] 部署和运营要提供的取值：`memory.tei_allowed_hosts`（TEI 服务主机名）、`attribution.link_base_url`/`attribution.play_store_url`/`attribution.other_platform_url`（归因链接域名和商店页地址）、`direct` 渠道的包名（发布方提供）、上传文件的对外基址 `upload.public_base_url`（域名或 CDN，22.9）、站内通知五类系统事件（审核拒绝、导出就绪、订阅扣费问题、生成成功、生成失败，25.3）和后台测试短信的英文文案（产品提供）
- [ ] 财务统计是否需要 Google 的实收金额（需要则调用 `orders.get`，17.4 目前先不做，只展示标价）：产品决定

**2026-10-08 实现者视角复核新增的未核实项**（集中登记最主要的几项，不保证完整；以各节里的 [推断]、“凭记忆”、“没有来源”标记为准，开发时逐项核实）：
- [ ] LiveKit webhook 里非 agent 参与者的识别字段（`participant.kind` 是否在 Java SDK 的 `WebhookEvent` 里可用，4.2）；AvatarAgent 在用户离开后是否自己断开、只剩 agent 的房间是否保持打开（4.2、15.6 不依赖它，实测只用来调整 `session.user_leave_grace_seconds`）
- [ ] AvatarAgent 的通话是否接收文字输入（5.4 第 4 步目前一律用 `CALL_IN_PROGRESS` 挡住）
- [ ] libphonenumber 对美国、加拿大等 NANP 号码返回 `FIXED_LINE_OR_MOBILE` 的行为（23.3，验收依赖它）
- [ ] APK 签名块的 v3.1 ID `0x1b93ad61`、对齐填充 ID `0x42726577` 和尾部魔数 `APK Sig Block 42`（10.4 第 6 条，凭记忆写，没有核对 Google 文档）
- [ ] App Store 链接的形状 `/<国家码>/app/<名称>/id<数字>` 或 `/app/id<数字>`（24.2，没有核实 Apple 文档）
- [ ] DashScope 价格接口 `range_name` 里 K 按 1000 解析（14.2，运营确认价格批次时核对边界）
- [ ] Apple 交易 JWS 的 `signedDate` 字段可用于排序 `verify` 里的交易（15.4）
- [ ] 签到的连续规则和阶梯走完后循环（28.1，dramaBox 服务端没有读过源码）；可信推送的判定是照 dramaBox 的 `resolveTrustedPush`（23.3，没有重读该文件）

---

## 二十、验收清单

**账号与认证**
- [ ] `POST /api/auth/guest`（设备校验通过）→ 得到游客凭据和 `callSecondsRemaining`，数据库里没有 `User` 行；设备校验不通过 → 403 `DEVICE_INTEGRITY_FAILED`；同一 `deviceId` 重复调用，额度不重置
- [ ] 游客凭据调用需要账号的接口（`GET /api/account`、资产、聊天记录、`GET /api/invite`、订阅与额度相关接口）→ 403 `REGISTRATION_REQUIRED`；游客凭据发起会话 → 4.3 的路径，`Session.accountId` 为空，dispatch 的 `guest` 为 `true`，agent 不写聊天记录
- [ ] 改 `guest.call_minutes_total` 后，已有设备的 `grantedSeconds` 不变，新设备取新值；`grantedSeconds` 为空的设备在配置之后首次创建凭据或发起会话时记入当时的值
- [ ] 游客额度用完 → `POST /api/sessions` 返回 403 `GUEST_QUOTA_EXHAUSTED`；未配置 `guest.call_minutes_total` → 同样不能通话；游客会话结束后 `GuestDevice.usedSeconds` 增加 `durationSeconds`，不产生养成统计
- [ ] 邮箱注册缺 `emailCode` → 400 `INVALID_REQUEST`；验证码错误 → `OTP_INVALID`；邮箱已注册 → 验证码通过之后才返回 `EMAIL_TAKEN`；`email/otp/send` 对已注册和未注册的邮箱都照常发送、响应一致；邮件服务商没有配置 → 503 `EMAIL_SEND_FAILED`
- [ ] 邮箱规范化：`  User@Example.COM  `（尾部带 U+00A0）规范化成 `user@example.com`，注册、登录、重置、验证码绑定、`EMAIL_TAKEN` 都按它匹配；`İstanbul@example.com`、`ı@example.com` 里的非 ASCII 字母不变；土耳其语区域设置的 JVM 下 `INFO@EXAMPLE.COM` 仍得到 `info@example.com`；254 字节的纯 ASCII 地址通过，255 字节被拒绝，127 个两字节字符加 `@x.co` 超过 254 字节被拒绝（按字节计，不按字符计）
- [ ] 邮件模板：`PUT /email/templates/REGISTER_CODE` 的 `body` 不含 `{code}`、`PASSWORD_RESET` 不含 `{resetLink}`、`PASSWORD_CHANGED` 不含 `{time}`、`DELETION_CONFIRM` 不含 `{confirmLink}` 或 `{subscriptionNotice}` → 400 `INVALID_REQUEST`；有有效订阅的账号收到的删除确认邮件里 `{subscriptionNotice}` 有英文说明，没有订阅时为空；保存后下一封验证码邮件用新内容；`reset` 后恢复默认文案；没有改过时用代码里的默认文案；两种操作都写审计日志
- [ ] `GET /email/templates` 里 `REGISTER_CODE` 的 `requiredPlaceholders` 是 `["{code}"]`，每个模板的 `placeholders` 和 `requiredPlaceholders` 每项都以 `{` 开头、以 `}` 结尾；`PUT` 的必含检查按带花括号的字符串在正文里区分大小写地查找，缺了 → 400 `INVALID_REQUEST`
- [ ] 新建账号（邮箱、Google/Apple 新身份、手机号新号码）缺 `integrityToken` 或校验不通过 → 403 `DEVICE_INTEGRITY_FAILED`；登录已有账号不要求
- [ ] 令牌绑定到用途和设备：用 `GUEST` 用途取的令牌去创建账号、令牌的 `requestHash` 不是 `SHA-256("<用途>:<deviceId>")`（换了 `deviceId` 或用途）→ 403 `DEVICE_INTEGRITY_FAILED`；认领接口只接受 `CLAIM` 用途的令牌
- [ ] 邮箱注册成功后 `User.emailVerifiedAt` 有值；Google/Apple 新账号只有令牌 `email_verified` 为真时才写
- [ ] 登录防暴力破解：同一邮箱 15 分钟内密码错 10 次后，窗口内连正确密码也返回 429 `RATE_LIMITED`，窗口过后恢复，Google 登录不受影响；同一 IP 一小时跨邮箱超过 `ratelimit.login_per_ip_per_hour` → 429；邮箱不存在和密码错误的响应（状态码、`message`）相同；账号被封禁时密码错误仍返回 `INVALID_CREDENTIALS`，不泄露状态
- [ ] 密码规则：129 位 → 400；含空格和 Unicode 的密码可以注册和登录；没有大小写、数字、符号的组成要求；登录成功时哈希参数过旧会被重新哈希
- [ ] 令牌作废：改密码后其他登录链的访问令牌立即 401，当前链仍可用并收到 `PASSWORD_CHANGED` 邮件；重置密码后所有链立即 401；`logout` 后该链访问令牌立即 401；复用检测触发后该链立即 401；封禁账号的访问令牌 → 403 `ACCOUNT_BANNED`（不是 401），解封后同一个令牌继续可用；没有 `sid` 的用户令牌 → 401 `INVALID_TOKEN`；刷新得到的新访问令牌带同一个 `sid`
- [ ] 重置令牌：单次使用；同一账号再次申请后旧令牌失效；邮件链接的根地址取自 `email.link_base_url`，改请求的 Host 头不影响；没有配置 `email.link_base_url` → 503 `EMAIL_SEND_FAILED`；`password/reset` 每 IP 超限 → 429；`deletion-confirm` 每 IP 超限 → 429；`password/reset` 成功后登录失败计数清零并发 `PASSWORD_CHANGED`
- [ ] 重置请求：邮箱不存在、手机号账号、只用 Google 登录的账号、`BANNED`、`DELETING` 都返回成功且不发信（`PENDING_DELETION` 的邮箱密码账号照常发信，重置成功后可以登录并取消删除）；同一邮箱每小时超过 `ratelimit.link_mail_per_email_per_hour` 仍返回成功、不发信、旧令牌不失效；响应内容不随邮箱是否存在而变
- [ ] 登录失败计数：按提交的规范化邮箱计数，不存在的邮箱第 10 次失败同样返回 429；锁定期间的请求不延长窗口；只用 Google 登录的账号对应的邮箱同样返回 401 `INVALID_CREDENTIALS`
- [ ] 认证事件：注册、登录成功、登录失败、退出、复用检测、改密码、重置请求（每次申请一条，超出限制的 `reason=RATE_LIMITED`，没有对应账号时 `accountId` 为空）、重置完成、验证码错误、远程退出、第三方绑定各写一条 `auth_event`，不含密码、令牌、验证码、完整邮箱；`GET /users/{id}/auth-events` 没有 `USER:VIEW` → 403 `ADMIN_FORBIDDEN`
- [ ] 多开检测权限：`GET /abuse/clusters`、`GET /abuse/clusters/accounts` 没有 `ABUSE:VIEW` → 403 `ADMIN_FORBIDDEN`；两个接口都分页；创建账号请求缺 `deviceId` → 400 `INVALID_REQUEST`
- [ ] `POST /api/account/export` 不带或带错重新验证凭据 → 401（手机号账号验证码错误 → 400 `OTP_INVALID`）；`password/change`、`account/deletion`、`account/export` 每账号每小时超过 `ratelimit.sensitive_per_account_per_hour` → 429
- [ ] 设备列表：`GET /api/account/sessions` 只返回本账号未作废的登录链并标出 `current`；远程退出后该链的访问令牌立即 401；退出别人的链或不存在的链 → 404 `SESSION_NOT_FOUND`；退出当前链等同于 `logout`；`DELETE /api/account/sessions` 保留当前链
- [ ] 认证事件保留：每条带 `expireAt = at + auth.log_retention_days`，到期被 TTL 删除；限速是 `reason=RATE_LIMITED` 的 `LOGIN_FAIL`；账号删除后该账号的事件被清除
- [ ] 多开检测：同一设备或同一 IP 下创建 5 个免费账号 → 出现在 `GET /abuse/clusters` 里；有有效订阅的账号不计入 `freeAccounts`；`RegistrationAudit` 超过 `abuse.audit_retention_days` 被清除、账号删除时一并清除
- [ ] 免费通话总量告警：当日免费通话和游客通话总分钟数达到 `call.free_daily_alert_minutes` → 写一条 `FREE_CALL_MINUTES_HIGH` 告警，同一天不重复，次日 UTC 零点自动 `RESOLVED`；没有配置该键不写；达到阈值后通话不被拒绝
- [ ] 注册（邮箱未被占用，带验证过的邮箱和设备校验令牌）→ 新账号，没有任何游客期间的数据；邮箱已被占用 → `EMAIL_TAKEN`；请求带游客凭据时凭据被忽略；带已注册账号的令牌 → `ALREADY_REGISTERED`
- [ ] 游客发起会话时 `language` 缺失或为空串 → 400 `INVALID_REQUEST`，不在 `chat.conversation_languages` 里 → 400 `INVALID_LANGUAGE`；同一设备已有进行中的游客会话时再发起 → 先结束旧会话（规则同账号）
- [ ] 同一 `deviceId` 一小时内创建游客凭据超过 `ratelimit.guest_per_device_per_hour` → 429 `RATE_LIMITED`
- [ ] 游客凭据调用 `POST /api/events` → 记为匿名，只带 `deviceId`，不带账号
- [ ] `GET /api/guest/quota`：游客凭据返回剩余秒数（含进行中会话已用的时间）；没有令牌 → 401 `INVALID_TOKEN`；账号令牌 → 403 `GUEST_ONLY`
- [ ] 游客凭据有效期等于 `auth.access_ttl_minutes`（默认 1440）；过期后任意接口 401 `INVALID_TOKEN`，重新调用 `POST /api/auth/guest` 取新凭据
- [ ] 设备校验不通过（模拟器、没有 Google 服务；`play` 渠道的非 Play 安装，`direct` 渠道的包名或签名证书摘要与官网安装包不符）→ 403 `DEVICE_INTEGRITY_FAILED`，`direct` 渠道的官网安装包在设备可信时通过，渠道缺失或不是这两个值时任一口径满足即通过；`integrity.check_enabled=false` 的非生产环境跳过校验，生产环境保存 `false` → 400 `INVALID_REQUEST`；重装应用后得到新的 `deviceId` 和新的额度（已知缺口，2.1）
- [ ] 游客凭据调用 `POST /api/push-tokens` → 登记成功，`PushToken.accountId` 为空、`deviceId` 是凭据里 `deviceId` 的哈希；游客调用 `GET/PUT /api/notification-preferences` → 403 `REGISTRATION_REQUIRED`（广告接口对游客开放，见 22.12）
- [ ] 游客 `Session` 超过 `guest.session_retention_days` 后被定时任务删除
- [ ] `/stats/guest/quota`：六档 `devices` 之和加 `noGrant` 等于 `devices`，每档 `converted` 不大于该档 `devices`，`exhausted` 等于第六档的 `devices`；额度不同的两台设备（运营中途改过配置）各自按自己的 `grantedSeconds` 分档
- [ ] 全新注册（不带JWT）→ 正常创建账号
- [ ] 已注册账号带着邀请码再走注册流程 → 返回`ALREADY_REGISTERED`，不走邀请码逻辑
- [ ] access token 过期后用 refresh token 换到新的一对；超过 `auth.refresh_reuse_grace_seconds` 之后，旧的 refresh token 再次使用 → `INVALID_REFRESH_TOKEN`，且同一登录链的所有 refresh token 被作废（宽限期内的重放返回同一对新令牌，不判盗用）
- [ ] `logout` 后该 refresh token 不能再刷新
- [ ] Google/Apple 令牌校验失败（签名错、`aud` 不符、过期）→ `INVALID_SOCIAL_TOKEN`；请求带游客凭据走第三方登录 → 凭据被忽略，按未登录处理
- [ ] Google 令牌邮箱属于已有邮箱账号且 `email_verified=true` → 绑定并登录那个账号，不要求 `integrityToken`，没有新建账号
- [ ] Google 令牌邮箱属于已有邮箱账号且 `email_verified=false` → `EMAIL_TAKEN`，不绑定
- [ ] 被封禁账号：登录、刷新（出示真实有效的 refresh token）、已发出的 access token 调任何接口都返回 `ACCOUNT_BANNED`，响应体 `data.reason` 是封禁说明；封禁**不**作废 refresh token，解封后原 refresh token 和访问令牌都继续可用；出示无效或乱写的 refresh token 一律得到 `INVALID_REFRESH_TOKEN`，不泄露账号状态
- [ ] 封禁一个正在通话的账号 → 该账号所有进行中的房间被删除并按 15.6 收尾（正常计入已用时长，不是"没有开始"）；被封禁账号对 `POST /api/public/deletion-request` / `deletion-confirm` 正常执行，账号进入 `PENDING_DELETION`
- [ ] 对 `PENDING_DELETION`、`DELETING` 状态的账号 `POST /users/{id}/ban`、`unban` → 409 `INVALID_STATE`；被封禁的账号走网页删除进入 `PENDING_DELETION`，宽限期内取消 → 状态回到 `BANNED`，不是 `ACTIVE`
- [ ] 用户列表导出：`GET /users/export` 返回 `.xlsx`，没有 `USER:EXPORT` 或没有 `USER:VIEW` → 403；没有 `USER:EMAIL_VIEW`、`USER:PHONE_VIEW` 时邮箱和手机号掩码；不含 IP、内容和资产；超过 `export.max_rows` → 400；每次导出有审计日志；`GET /users` 可按注册渠道、流量类型、媒体来源筛选，`GET /users/{id}` 带归因
- [ ] 通用限流：已登录账号一分钟内超过 `ratelimit.api_per_account_per_min` 次请求 → 429 `RATE_LIMITED`；游客凭据按 `deviceId` 计；`/api/internal/**` 不适用；已单独限流的接口按各自的限制
- [ ] 删除任务完成后（令牌已被删除），用旧 refresh token 刷新 → `INVALID_REFRESH_TOKEN`；删除进行中（令牌尚未删除）用有效 refresh token 刷新 → `ACCOUNT_DELETING`
- [ ] 上传带 GPS 的照片（JPEG、PNG）和声音样本 → 入库后的文件用 `ffprobe`/EXIF 读取都没有位置信息；带有 `location` 或 `com.apple.quicktime.location.*` 键且无法去除的文件被拒绝（`INVALID_FILE`）；原始上传在处理后已删除
- [ ] 填不存在的邀请码注册 → `INVALID_INVITE_CODE`，账号未创建
- [ ] 邀请码格式：小写、带首尾空白的合法码注册 → 按大写、去空白后匹配；长度不是 8 或含 `0`、`O`、`1`、`I` 的码 → 400 `INVALID_INVITE_CODE`，账号未创建；`POST /api/public/invite-events` 对同样的输入先去空白、转大写再查，格式不对或不存在都返回 200 且不写任何东西
- [ ] 邀请码大写转换只按 ASCII：`K7M2Q9Xſ`（`ſ` 是 U+017F）和 `K7M2Q9Xı`、`K7M2Q9ß`（不足 8 位）在注册和 `POST /api/public/invite-events` 都不会被转成合法码，注册返回 400 `INVALID_INVITE_CODE`、账号未创建；客户端的规范化对同样的输入得到同样的结果（含不在字符集内的字符，客户端不把它当邀请码）
- [ ] `GET /api/account` 对手机号注册的账号返回 `email:null`；密码重置：`reset-request` 对已注册和未注册邮箱都返回成功；令牌过期或重复使用 → `INVALID_RESET_TOKEN`；重置成功后该账号所有 refresh token 作废
- [ ] `password/change` 旧密码错误 → `INVALID_CREDENTIALS`；成功后除当前登录链外其余登录链失效
- [ ] 未登录接口超出 1.6 的限流 → 429 `RATE_LIMITED`（尤其 `POST /api/auth/guest`）
- [ ] `POST /api/events` 按 `deviceId` 和按账号各限 `events.rate_limit_per_min`，不再计入兜底限制；`/api/ads/request`、`/api/ads/track`、`/api/notifications/*`、`/api/support/feedback` 有 1.6 里各自的限流
- [ ] 邮箱注册时 `inviteCode` 不存在或密码太短 → 对应的 400，验证码**未被消耗**，用户改正后用同一个验证码重试成功
- [ ] 游客 `GET /api/guest/quota` 在 `grantedSeconds` 为空而 `guest.call_minutes_total` 已配置时 → 先记入配置值再返回，与发起会话时的判断一致
- [ ] 刷新令牌宽限期内重放刚被轮换的令牌 → 返回与第一次相同的那一对（取自 Redis 密文）；Redis 里没有该密文时 → 按复用检测处理；数据库里没有令牌明文
- [ ] `logout`、改密码、重置密码、复用检测、设备列表远程退出之后，对应登录链登记的推送令牌已被删除（`sessionFamilyId` 匹配）；客户端不先注销也不会继续收到那台设备的推送
- [ ] Google 或 Apple 令牌的邮箱属于一个只用 Google/Apple 登录的账号 → `EMAIL_TAKEN`；令牌 `email_verified` 不为真 → 新账号 `User.email` 为空，之后这个邮箱的主人仍可用它邮箱注册
- [ ] 手机号账号在宽限期内：申请删除的那台设备的登录链保留，宽限期内刷新照常，可以取消删除；其他设备要重新登录；手机号登录被关闭、国家被移出白名单或全局上限到顶时，重新登录得不到验证码，此时后台 `POST /users/{id}/deletion/cancel` 可以替用户取消
- [ ] 刷新令牌并发：同一个刚好有效的旧令牌同时发两个刷新请求 → `SET NX` 赢的一方返回新令牌对，输的一方读到赢家先写好的 Redis 密文，返回同一对，不判盗用
- [ ] 刷新令牌宽限：并发的两个请求只有 `SET NX` 成功的一方轮换，另一方轮询读到同一对令牌；注册缺 `deviceId` → 400（先于设备校验）；`BANNED` 状态下 `POST /api/auth/logout` 成功并作废当前链；无邮箱密码的账号调用 `password/change` → 409 `INVALID_STATE`；`transcript` 缺失或超长 → 400 `INVALID_REQUEST`；`voice.transcript_max_chars` 保存大于 1000 → `INVALID_REQUEST`
- [ ] 邀请码规范化：带零宽空格、`U+200E`/`U+200F`、`U+202A`–`U+202E` 的合法码（阿拉伯语环境粘贴）在客户端和服务端都规范化成同一个大写码；注册、`POST /api/public/invite-events` 都按同一步骤

**人格与资产**
- [ ] 人格设定超过 `persona.max_length` → 返回 `PERSONA_TOO_LONG`，不保存；`GET /api/persona` 返回当前 `maxLength`
- [ ] 伴侣名字：`PUT /api/companion-name` 去掉首尾空白后为空、超过 30 个码点或含控制字符 → 400 `INVALID_REQUEST`；高风险、中风险 → 400 `CONTENT_REJECTED`，不保存；成功后 `GET /api/account` 的 `companionName` 是新值；游客 → 403 `REGISTRATION_REQUIRED`；dispatch 和 `/v1/chat/turn` 的 `companionName` 是账号的名字，没有设置的账号和游客取默认数字人的 `name`
- [ ] 伴侣名字，细节：含 U+202A–U+202E 或 U+2066–U+2069 → 400 `INVALID_REQUEST`，含 U+200C、U+200D 的名字可保存；与当前值相同 → 返回当前值、不调用审核、`companionNameRef` 不变；审核服务正常返回的中风险 → 400 `CONTENT_REJECTED` 并写 `status=BLOCKED`、`autoLevel=REVIEW` 的记录（`contentRef` 是新生成的 UUID，不写进 `User`）
- [ ] 伴侣名字，审核服务故障路径（`serviceFailed=true`）：规则不是 `BLOCK` → 保存、写 `PENDING_REVIEW` 记录、`companionNameRef` 换新；规则判 `BLOCK` → 400 `CONTENT_REJECTED`；之后再次成功保存 → 旧待审记录被关闭（`REJECTED`、`SUPERSEDED`）；复核拒绝且 `contentRef` 仍等于 `companionNameRef` → `companionName` 置空并产生 `COMPANION_NAME` 的审核拒绝通知；用户已改名 → 只关闭记录、不发通知；`GET /moderation/records/{id}/content` 在 `contentRef` 等于当前 `companionNameRef` 时返回当前名字，否则 404 `CONTENT_NOT_STORED`
- [ ] 形象名字：`POST /api/avatars` 缺 `name` 或不合规则 → 400 `INVALID_REQUEST`；形象落地后列表的 `name` 等于上传时填的值；`GET /api/tasks` 的 `AVATAR` 任务带 `name`；`PUT /api/avatars/{assetId}` 改名成功，别人的或不存在的资产 → 404 `ASSET_NOT_FOUND`；资产删除后任务行的 `assetName` 置空；数据导出含伴侣名字和形象名字
- [ ] 删除原因：`POST /api/account/deletion` 的 `reason` 不在枚举里 → 400 `INVALID_REQUEST`；合法值存进 `AccountDeletion.reason`；不带 `reason` 照常删除；`reason` 不合法同时重新验证身份也失败 → 400 `INVALID_REQUEST`（先于 401）
- [ ] 埋点事件 `login_page_view`：`method=entry`、`phone`、`email` 都被接受并写入 `event_log`，参数原样保留（7.3）
- [ ] 通话进行中修改人格，当前通话不受影响，下一次发起的会话使用新值
- [ ] persona 中风险：`persona` 不变、`personaPending` 有值、`moderationStatus=PENDING_REVIEW`；复核通过后才生效；复核拒绝 → `REJECTED`
- [ ] `PUT /api/language` 设为不在 `chat.conversation_languages` 里的值 → 400 `INVALID_LANGUAGE`，不保存；从未设置过时 `GET` 返回 `en`；通话进行中修改，当前通话不受影响，下一次会话的 dispatch 用新值
- [ ] dispatch 的 metadata 含 `language`；账号没有设置，或设置的值已经不在列表里 → 传 `en`
- [ ] dispatch 之后 agent 没有加入房间：`session.agent_join_timeout_seconds` 后先删除该房间未完成的 dispatch 再重发，重发 `session.agent_join_retries` 次仍没有 → 先删 `Session` 记录再删房间（不计入额度和养成统计，没有 `room_finished` 引起的结算）、返回 503 `AGENT_UNAVAILABLE`、没有发房间 token
- [ ] 同一账号在第一次 `POST /api/sessions` 还在等 agent 加入时再次发起 → 第一条启动中的 `Session` 被删除（不计入额度和养成统计），第一次返回 503 `AGENT_UNAVAILABLE`，第二次正常进行；任何时刻该账号只有一个进行中的会话
- [ ] agent 已加入房间、但客户端在 `session.user_join_timeout_seconds` 内一直没有进入房间（例如客户端在等待 `POST /api/sessions` 返回时取消，或拿到 token 后进程被杀）→ 到点扫描删除该 `Session` 和房间，不计入额度和养成统计，也没有 `room_finished` 引起的结算；用户在这段时间内进入房间则正常计时
- [ ] 通话时长和 `deadlineAt` 从 `agentJoinedAt` 开始算（4.1），等待 agent 的时间不计入额度；响应里的 `deadlineAt` 是重新计算后的值
- [ ] 注册音色超时或返回 5xx → 任务 `FAILED`，并已为该音色名创建 `ExternalDeletionJob`（类型 `VOICE`）
- [ ] 上传超限/空/类型不对的文件 → 在写盘前就被拒绝，返回`INVALID_FILE`；`POST /api/voices` 缺 `transcript`、为空或超长 → 400 `INVALID_REQUEST`；长度按去掉首尾空白之后算：1000 个字符加首尾空白可以通过，1001 个字符被拒绝；首尾空白按 1.9 的集合：前面带 U+0085、U+00A0、U+3000 的 1000 个字符通过，只含这些字符的值被拒绝，前面带 U+200B 的 1000 个字符（不是空白）算 1001 个，被拒绝
- [ ] 创建音色：合成服务返回 201 → 成功；返回 400、401、413、5xx 或超时 → 任务 `FAILED`；返回 409 → 按成功处理
- [ ] 删除音色：合成服务返回 204 和 404 都算成功；其他状态进入持久化重试
- [ ] 声音样本时长不在 1 到 30 秒 → 400 `INVALID_FILE`，落盘的文件已删除
- [ ] 任务成功后 `GET /api/tasks/{id}` 返回 `assetId`；账号原来没有当前形象时新形象自动成为当前，已有当前形象时不改动指针；形象任务成功时同时落地第一个外观，`AvatarAsset.currentLookId` 指向它；`LOOK` 任务成功后新外观不成为当前外观，`currentLookId` 不变，只有 `PUT .../looks/{lookId}/active` 才改
- [ ] `GET /api/tasks` 能找回进行中的任务（含 `IN_REVIEW`）
- [ ] 形象生成服务丢失任务（`poll` 返回 `LOST`）→ 任务 `FAILED`，`failureReason=EXTERNAL_TASK_LOST`；外部服务的报错原文不出现在任何客户端响应里
- [ ] 声音样本上传 m4a → 后端转码为 WAV 后调用合成服务；合成服务返回 400、401、413、5xx 或超时 → 任务 `FAILED`
- [ ] 上传的形象/声音被自动审核判高风险 → 任务 `FAILED`（`CONTENT_REJECTED`），上传文件已删除（此时还没有预览图），不进入生成
- [ ] 照片里的人被判为明显未成年 → 任务 `FAILED`（`SUBJECT_UNDERAGE`），原照已删除，不转人工复核；检测不到人脸 → `FAILED`（`NO_FACE_DETECTED`），原照已删除；`moderation.age_check_enabled=false` 时不按年龄拒绝，人脸检测照常
- [ ] 生成结果（标准图）被判高风险 → 任务 `FAILED`（`CONTENT_REJECTED`）；中风险 → 任务 `IN_REVIEW`，复核通过才落地形象或外观，拒绝后 `FAILED`
- [ ] 中风险 → 任务 `IN_REVIEW`，复核通过后继续生成，拒绝后 `FAILED`
- [ ] 资产列表返回 `isCurrent`（由后端算），形象条目有 `previewUrl` 且可取到图片；越权取预览图 → `ASSET_NOT_FOUND`；切换当前外观后 `previewUrl` 的图随之变化
- [ ] 删除当前使用的形象资产 → `User.currentAvatarAssetId`被清空，不留悬空引用；外部数据删除任务已创建；该形象的外观、动作片段及标准图、驱动资源包、片段文件全部删除
- [ ] 查询/删除别人的资产或任务 → 统一返回 `ASSET_NOT_FOUND` / `TASK_NOT_FOUND`，不泄露是否存在
- [ ] persona 已有待审值时再次 `PUT` → 新值取代待审值，旧复核记录关闭（`SUPERSEDED`）；旧记录之后被复核通过**不会**覆盖 `persona`；清除（空字符串）同时清空待审值并把 `moderationStatus` 置 `NONE`；与当前生效值相同的 `PUT` 不创建待审
- [ ] 两个并发的 `POST /api/avatars` 在只剩一个名额时 → 只有一个成功，另一个 403 `FEATURE_LIMIT_REACHED`（`data.limit=ASSET_COUNT`、`data.max` 为上限），数量口径含 `PROCESSING` 的任务
- [ ] 同一个 `Idempotency-Key` 并发到达 → 第二个 409 `REQUEST_IN_PROGRESS`；第一次校验失败（400）后同一个键可以重用；形象的键用在声音接口 → 400；24 小时后键可复用；建外观接口 `POST /api/avatars/{assetId}/looks` 同样满足本条（`LOOK` 的键用在上传接口 → 400）；同一个键用在同一账号的另一个形象上建外观 → 新请求，建出新的任务（不返回第一个形象的 `taskId`，也不是 409）
- [ ] 上传的文件扩展名或声明的类型是 jpg，但内容是别的格式 → 400 `INVALID_FILE`，文件已删除
- [ ] 形象照片重新编码（3.2）：长边 6000 像素的 PNG 照片 → 存下的 `originalFileRef` 是长边 3072 的 JPEG，没有元数据；长边 2000 的照片不放大；带透明通道的 PNG → 透明部分是白色；重新编码后大于 19,000,000 字节 → 400 `INVALID_FILE`，文件已删除；提交 AvatarEngine 的请求体不超过 20,000,000 字节
- [ ] `DELETE` 和 `PUT .../active` 成功返回 `data: null`；重复删除同一资产 → 404 `ASSET_NOT_FOUND`；删除资产后其任务行的 `assetId`、`assetName`、`originalFileRef`、`transcript`、`resultRef`、`externalName`、`lookId`、`actionItemId` 已置空
- [ ] 形象任务（`AVATAR`、`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP`）因 `GENERATION_FAILED`、`EXTERNAL_TIMEOUT` 或 `EXTERNAL_TASK_LOST` 进入 `FAILED` → 都创建了 `AVATAR` 类型的 `ExternalDeletionJob`；超时从提交给外部服务的时刻算，等待审核的时间不计入
- [ ] 声音任务停在 `PROCESSING` 且没有线程在跑（模拟进程重启）→ 清扫任务把它置 `FAILED`（`EXTERNAL_TIMEOUT`）并创建 `VOICE` 删除任务
- [ ] 剩最后一个形象名额时，第一次上传成功，用同一个 `Idempotency-Key` 重试 → 返回同一个 `taskId`，不是 403；创建时间超过 24 小时的同键请求按新请求处理
- [ ] persona 低风险新值：直接生效，已有待审记录关闭（`SUPERSEDED`），`personaPending` 清空，`moderationStatus` 回到 `NONE`；高风险新值：`User` 所有字段不变；中风险新值：取代旧的待审值
- [ ] 声音任务在注册前就有 `externalName`；注册超时或进程重启后，清扫任务凭 `externalName` 创建 `VOICE` 删除任务；资产删除后任务行的 `assetId`、`resultRef`、`externalName` 为空，`GET /api/tasks/{id}` 此时 `data.assetId`、`data.resultRef` 为 `null`，`status`、`failureReason` 照常返回
- [ ] 声音样本上传后在创建任务前被转码并去元数据，`originalFileRef` 指向处理后的 WAV；形象任务的提交调用（`submitAvatar` 等，3.5）超时或抛异常（没有 `externalRef`）→ 凭 `externalName` 创建 `AVATAR` 删除任务；同一 `Idempotency-Key` 在 Redis 标记过期后并行处理 → 数据库唯一键兜底，回读并返回已有任务、删除新落盘的文件

**外观、装扮、动作与渲染资源（3.2、3.6–3.10、11.6，形象渲染设计）**
- [ ] `POST /api/avatars` 上传 mp4/mov → 400 `INVALID_FILE`；缺 `style` 或取值不对 → 400 `INVALID_REQUEST`；`avatar.realistic_enabled=false` 时 `REALISTIC` → 400；`declarationVersion` 不是当前生效版本 → 400（同一时刻只有一个生效版本，`activeFrom` 在未来的不算）；`avatar.declaration_required=true` 而没有生效版本 → `GET /api/avatar-upload-options` 返回 503 `GENERATION_NOT_CONFIGURED`，声明文本没有请求语言时回退 `en`，`en` 也没有同样 503；`avatar.declaration_required=false` 时不带 `declarationVersion` 也能上传，`AvatarAsset.declarationVersion` 为空
- [ ] `GET /api/avatar-upload-options` 的 `maxBytes` 等于 `upload.max_bytes` 的当前值（改这个键之后下一次请求已变），`maxPixels` 是 250000000；上传超过 `maxBytes` 的照片、宽×高超过 `maxPixels` 的照片，都是 400 `INVALID_FILE`
- [ ] 两个露齿门槛键任一未配置 → 上传形象和新建外观都返回 503 `GENERATION_NOT_CONFIGURED`，不创建任务（上传形象时它先于数量上限的 403 `FEATURE_LIMIT_REACHED` 判断；默认服装或背景条目缺失也返回它），有一条 `GENERATION_CONFIG_MISSING` 告警；配齐后告警自动 `RESOLVED`
- [ ] 建外观：外观数达到 `avatar.looks_max` → 403 `FEATURE_LIMIT_REACHED`（`data.feature=AVATAR_LOOK`、`limit=LOOK_COUNT`），并发两个请求在只剩一个名额时只有一个成功；上限按每个形象分别计算，用额度不能买额外外观
- [ ] 建外观的价格核对（3.6）：`expectedCreditPrice` 缺少、是小数或字符串、为负数 → 400 `INVALID_REQUEST`；`avatar.look_credit_price` 为 10 时带 `expectedCreditPrice=5` → 409 `PRICE_CHANGED`，`data.creditPrice` 为 10，余额不变、没有 `LOOK` 任务、没有流水；`avatar.look_free` 为真的账号带 `expectedCreditPrice=10` → 409，`data.creditPrice` 为 0；带 `expectedCreditPrice=10` 且价格是 10 → 成功并扣 10；运营在两次请求之间把价格从 10 改成 20：第一次请求（价格 10）建出任务后，用同一个 `Idempotency-Key` 和同样的 `expectedCreditPrice=10` 重试 → 仍返回第一次的 `taskId`，不是 409，也不再扣款；价格不一致且余额也不足 → 409（先于 402）；已达外观数上限且价格不一致 → 403（先于 409）
- [ ] 服装兑换的价格核对（3.7、1.4）：`expectedCreditPrice` 缺少、是小数或字符串、为负数 → 400 `INVALID_REQUEST`；条目 `creditPrice` 为 100 时带 `expectedCreditPrice=50` → 409 `PRICE_CHANGED`，`data.creditPrice` 为 100，余额不变、没有流水、没有 `AccountCosmetic`，同一个 `idempotencyKey` 之后带 100 重发 → 成功（键没有被占用）；带 100 → 成功并扣 100；已拥有的条目带任何 `expectedCreditPrice`（包括与现价不同的）→ 成功、不扣款、不比较；同一个键已完成后用不同的 `expectedCreditPrice` 重发 → 返回第一次的结果，不是 409；价格不一致且余额也不足 → 409（先于 402）；条目不存在或不可见（404）、`creditPrice` 为空（400）先于价格核对
- [ ] 购买名额的价格核对（15.9、1.4）：`POST /api/credits/spend` 的 `expectedCreditPrice` 缺少、是小数或字符串、为负数 → 400 `INVALID_REQUEST`；`creditCost` 为 100、`quantity` 为 2 时带 200 → 成功并扣 200，带 100 → 409 `PRICE_CHANGED`，`data.creditPrice` 为 200，余额不变、没有流水、没有 `AccountFeatureBonus`，同一个键之后带 200 重发 → 成功；同一个键但 `featureKey` 或 `quantity` 与第一次不同 → 400（先于价格核对）；已完成的键用不同的 `expectedCreditPrice` 重发 → 返回第一次的结果，不是 409；价格不一致且余额也不足 → 409（先于 402）；开关不可用额度购买或已不限 → 400（先于价格核对）
- [ ] 三个扣额度的请求共用同一个价格核对方法（1.4）：核对在扣款的同一个事务里，排在余额检查之前，核对失败时不写流水、不创建任务或拥有记录、不占用幂等键
- [ ] 建外观收费：`avatar.look_credit_price` 大于 0 且 `avatar.look_free` 为假时，创建任务的同时写一条 `SPEND` 流水（`spendKind=LOOK`，`featureKey` 为空）；余额不足 → 402 `INSUFFICIENT_CREDITS`，没有任务；任务 `FAILED` → 恰好一条 `SPEND_REVERSED` 退回；`avatar.look_free` 为真的账号不扣
- [ ] 外观：删除当前外观 → 409 `INVALID_STATE`；切换当前外观后形象的 `previewUrl` 变化；删除外观同时删除它的片段和文件
- [ ] 服装目录：缺 `kind` 或 `kind` 不认识 → 400 `INVALID_REQUEST`；请求没带 `X-Platform`/`X-Channel` 时 `surfaces` 非空的条目不出现；`surfaces` 不含当前 `X-Platform`/`X-Channel` 的条目不出现在 `GET /api/cosmetics`，不能兑换，不能用来建外观；`redeem` 同一个 `idempotencyKey` 重发不重复扣款；已拥有再兑换返回成功不扣款；删除形象后拥有的服装仍在
- [ ] 目录接口的请求：`POST/PUT /cosmetics` 用 `previewUploadId`，`POST/PUT /actions` 用 `iconUploadId`，`POST /renderer-models` 用 `uploadId`（`sha256`、`sizeBytes` 取自上传记录，请求里带了被忽略），`POST /default-avatars` 用 `sourceUploadId` 并带 `name`、`style`；`uploadId` 不存在 → 404 `RESOURCE_NOT_FOUND`，已被使用 → 409 `INVALID_STATE`，`kind` 不符 → 400 `INVALID_REQUEST`；上下架 `PUT …/{id}/enabled {"enabled":…}`；`POST /declarations {"version","texts"}` 后 `PUT /declarations/{version}/activate` 设为生效
- [ ] 订阅每期赠送：首次购买和每次续订各写一条 `SUBSCRIPTION_GRANT`（数量取 `credits.period_grant`），同一计费周期的通知重复到达不重复发放；Apple 升级当刻不补发、进入新周期时发，降级到下个周期按新档发；Google 换档按新订阅首次购买发一次、旧订阅过期后不再发；同一账号两个商店订阅各按自己的周期各发一次；去重凭 Apple 的 `transactionId`、Google 的 `orderId`；该期订阅退款 → 写一条等额的 `REFUND` 流水扣回（余额可以变负），`REFUND_REVERSED` 加回；`credits.period_grant` 保存 `UNLIMITED` → 400
- [ ] 动作片段：外观创建时为每个适用的动作（`compatibleStyles` 含形象的风格、`enabled`）各排一个 `ACTION_CLIP` 任务，为外观准备其他格式版本的资源包（`LOOK_REPREPARE`）不再排；`GET /api/actions` 的响应没有动作种类字段；片段高风险 → 该片段 `FAILED`，外观和其他片段不受影响，没有站内通知；`GET /api/tasks` 不列出 `ACTION_CLIP`、`LOOK_REPREPARE`
- [ ] `GET /api/looks/{lookId}/media` 和 `GET /api/default-avatar` 不带格式版本、从不返回 409，`clips` 只含 `READY` 片段，`expiresAt` = 签发时刻 + `avatar.download_url_ttl_seconds`
- [ ] 资源包按格式版本分别保存：外观有格式 N 的 `READY` 包 → 返回它，响应的 `rendererFormatVersion` 等于 N；没有格式 N 的包而 N 是某个启用的 `RendererModel` 的格式版本 → 409 `PACKAGE_PREPARING`（带 `Retry-After` 和 `data.retryAfterSeconds`），有一条 `PREPARING` 的 `LookPackage` 和一个 `LOOK_REPREPARE` 任务，并发和重复请求不会排第二个；任务成功后同一请求返回格式 N 的包，原有其他格式的包仍在、老客户端照样拿到自己的格式；N 不被任何启用的 `RendererModel` 使用 → 400 `RENDERER_FORMAT_UNSUPPORTED`（即使这个外观还留着该格式的旧包，格式检查在前）；外观的状态始终是 `READY`
- [ ] 准备失败的退避：任务失败 → 行变 `FAILED`、`attempts` 加一、`nextAttemptAt` 按退避公式；`nextAttemptAt` 之前的请求返回 409 且不排任务，`retryAfterSeconds` 是到 `nextAttemptAt` 的剩余秒数；之后的第一个请求重新排（并发只排一个）；失败达到 `generation.reprepare_max_attempts` → 不再排任务，有一条 `LOOK_PACKAGE_PREPARE_FAILED` 告警；人工关闭告警后下一次请求重新排；包变 `READY` 后告警自动 `RESOLVED`
- [ ] 格式版本停用：停用某个格式的全部 `RendererModel` 后，每天的清理任务删除这个格式的 `LookPackage` 行和文件；删除外观、形象、账号时外观的所有格式的包（行和文件）一起删除
- [ ] 渲染模型：`GET /api/renderer-models` 对账号和游客凭据返回同样的最新版本（按 `platform`、`abi`、`enabled` 筛选，再取 `rendererFormatVersion` 最大的、同一格式版本里 `createdAt` 最晚的）；`platform` 不是 `ANDROID`/`IOS`、`abi` 为空或不匹配 `^[A-Za-z0-9_-]{1,32}$` → 400 `INVALID_REQUEST`；格式合法但没有匹配的模型 → `model`、`expiresAt` 为 `null`，不是错误
- [ ] `RENDERER_MODEL` 上传超过 `upload.render_asset_max_bytes` → 400 `INVALID_FILE` 且文件被删，把这个键改大之后同一个文件通过；不是 zip、根目录没有 `manifest.json`、`manifest.json` 的 `rendererKind` 不是字符串 → 400 `INVALID_FILE`；登记渲染模型时 `sha256`、`sizeBytes` 取自上传记录
- [ ] 从形象生成服务取回的产物文件超过 `upload.render_asset_max_bytes` → 任务 `FAILED`（`GENERATION_FAILED`），半截文件被删，`LOOK` 任务已扣的额度退回（`SPEND_REVERSED`），不重试
- [ ] 三个目录上传接口（`catalog-image`、`renderer-model`、`default-avatar-source`）：声明极大宽高的小图（例如 60000×60000、几 KB 的 PNG）→ 400 `INVALID_FILE`，不解码；类型按文件内容判断；`catalog-image` 超过 2097152 字节或像素超过 36000000 → 400 `INVALID_FILE`，通过的图重新编码、去掉元数据；`default-avatar-source` 像素超过 250000000 → 400 `INVALID_FILE`，处理后（EXIF 方向、JPEG 质量 95、长边不超过 3072、无元数据）仍大于 19000000 字节 → 400 `INVALID_FILE`；每次上传写审计日志
- [ ] 默认数字人名字：创建时缺 `name` 或不合规 → 400 `INVALID_REQUEST`；`GET /api/default-avatar` 返回 `name`；`PUT /default-avatars/{id}` 改名成功并写审计日志，不合规 → 400；部署上没有生效的默认数字人时 `GET /api/default-avatar` → 404 `RESOURCE_NOT_FOUND`，会话照常发起且 dispatch 的 `lookId`、`companionName` 为空字符串、`renderMode=NONE`
- [ ] 默认数字人状态：`generate` 只对 `DRAFT` 有效；`activate` 要求 `READY`，激活新的时旧的变为非生效但保留，同一时刻只有一个生效；生成失败（含人工复核拒绝）退回 `DRAFT` 并写 `failureReason`，再 `generate` 清空它；违反状态 → 409 `INVALID_STATE`；`DELETE` 只对非生效且不在生成中的有效；`GET /default-avatars` 按 3.10 的形状返回，不分页，按创建时间倒序
- [ ] 系统默认数字人：游客凭据调 `GET /api/default-avatar`、`GET /api/renderer-models`、`GET /api/actions` 成功，调 `GET /api/looks/{lookId}/media`、`GET /api/looks/{lookId}/package` 只对生效的默认数字人的外观成功；`POST /api/sessions` 不带 `renderTier` 或带非法值 → `renderMode=NONE`，不报错；`renderTier=DEVICE` → `renderMode=DEVICE`；它的生成任务 `accountId` 为空，不占任何账号的名额、不扣额度；年龄判断照做
- [ ] 照片里的人投诉：`POST /api/public/likeness-complaints` 不需要登录、按 IP 限流、发确认邮件；超过 `complaint.likeness_due_hours` 未结案 → `LIKENESS_COMPLAINT_OVERDUE` 告警；`remove-avatars` 后形象、外观、片段和文件都删除，外部删除任务已建，投诉为 `RESOLVED_REMOVED`，上传者收到 `contentType=AVATAR` 的站内通知，有一条 `source=COMPLAINT` 的审核记录；表单：`contactEmail` 格式不合格、`description` 去空白后为空或超过 2000 个码点、证据超过 5 个文件、单个超过 10 MB、或按文件头不是 JPEG、PNG、PDF → 400 `INVALID_REQUEST`；成功 200 并返回 `complaintId`、`dueAt`；确认邮件发送失败不影响受理
- [ ] 投诉证据：`GET /likeness-complaints/{id}/evidence/{index}` 对合法下标（从 0 起）返回 `url` 和 `mediaType`，每次读取写一条审计日志（`detail` 只有投诉 ID 和下标）；下标越界或投诉不存在 → 404 `RESOURCE_NOT_FOUND`；没有 `COMPLAINT:VIEW` → 403
- [ ] 投诉状态流转：`PUT /likeness-complaints/{id}/status` 设 `RESOLVED_REMOVED` → 400；对已结案的投诉再改或再执行删除 → 409 `INVALID_STATE`；每次流转（含删除执行）有一条 `LikenessComplaintEvent`，详情的处理记录与它一致，同时有审计日志；进入已结案状态时 `resolvedAt` 有值，`handledBy` 是最近一次流转的管理员；投诉到 `complaint.retention_days` 后连同处理记录被删除
- [ ] `GET /accounts/{id}/avatars`：持有这个接口所需的权限就能看，没有则 403，返回形象及其外观（风格、状态、预览图、创建时间）和拥有的服装，每次查看有审计日志
- [ ] 外部删除任务超过 `avatar.deletion_due_hours` 未完成 → `AVATAR_DELETION_OVERDUE` 告警，完成后自动 `RESOLVED`
- [ ] 文字对话语音回复：`chat.voice_reply` 为假时 `voiceReply=true` 按纯文字回复、不报错，调 agent 的 `voiceReply` 为 `false`；为真时 agent 的 `audio`、`action` 事件原样转发

**会话与聊天**
- [ ] 发起会话时 `Session` 记录先于 dispatch 落库；dispatch 失败时该记录被删除，不发放房间 token
- [ ] dispatch 的 metadata 是含 `accountId`、`sessionId`、`voiceId`、`timezone`、`persona`、`companionName`、`modelTier`、`language`、`guest`、`renderMode`、`availableActions`、`lookId`、`deadlineAt` 的 JSON；`deadlineAt` 等于第 1 步算出的截止时间；identity 以 `render_` 开头的参与者进出房间不写 `agentIdentity`、`userJoinedAt`、`userLeftAt`，不结束会话；`renderTier=CLOUD` 而 `render.cloud_enabled` 或 `render.cloud` 有一个为假 → `renderMode=NONE`；没有形象的账号和游客的 `lookId` 是系统默认数字人的外观（部署上没有生效的默认数字人时是空字符串、`renderMode=NONE`，见默认数字人的验收项）；没有当前音色时 `voiceId` 为空字符串，没有设定人格时 `persona` 为空字符串
- [ ] 发起会话时 `timezone` 缺失或无效 → 返回 `INVALID_TIMEZONE`，不创建 Session、不 dispatch；有效时写入 `User.timezone` 和 `Session.timezone`
- [ ] 会话响应包含 `serverUrl`；dispatch 使用的 agent 名字取自配置 `LIVEKIT_AGENT_NAME`
- [ ] LiveKit webhook 对同一个`room_finished`事件重复投递两次 → 只处理一次，`Session.endedAt`和养成数据的`interactionCount`都不会被重复计入
- [ ] LiveKit webhook 收到一个找不到对应`Session`的房间名 → 静默忽略，返回200，不抛异常
- [ ] 内部调用的签名（1.8）：正确签名通过；改动请求体一个字节、时间戳超出 `internal.signature_window_seconds`、同一 nonce 重放、未登记的 `X-Key-Id`、用另一个标识的密钥签名 → 均 401 `INVALID_SIGNATURE`；对应的密钥环境变量缺失 → 启动失败；`POST /api/internal/messages` 不能绕过签名
- [ ] 写入单条用户消息、单条助手消息（助手先开口的问候）、连续两条助手消息、一次多条 → 都成功，`GET /api/chat/history` 按 `timestamp` 排序返回
- [ ] 同一 `messageKey` 重复提交 → 只存一条，响应的 `skipped` 计数正确
- [ ] `interrupted=true` 的助手消息 → 存下，历史接口返回 `interrupted:true`
- [ ] `text` 为空 → 跳过、不报错；超过 `chat.message_max_chars` → 400 `INVALID_REQUEST`；`sessionId` 不属于该 `accountId` → 400 `INVALID_REQUEST`
- [ ] 同一批里有一条被审核判高风险 → 该条不落库，其余正常存
- [ ] 聊天文本高风险 → 该条不落库、无原文的 `ModerationRecord` 已写；审核服务超时 → 存下并进复核队列，接口仍成功
- [ ] 文字对话：`POST /api/chat/messages` 返回 SSE，依次是 `accepted`、若干 `delta`、`done`；`done` 的 `text` 等于 `delta` 拼接；`GET /api/chat/history` 随后能取到这两条（`source=TEXT`、`sessionId=null`、用户消息 `turnStatus=COMPLETED`）
- [ ] 文字对话检查：游客凭据 → 403 `REGISTRATION_REQUIRED`；缺 `timezone` → 400 `INVALID_TIMEZONE`；`text` 为空或超过 `chat.message_max_chars` → 400 `INVALID_REQUEST`；账号有进行中的通话 → 409 `CALL_IN_PROGRESS`；上一轮没结束又发 → 409 `CHAT_BUSY`（包括收到 `done` 之后立刻发下一条、上一轮还在写记忆的情形，稍后重试成功）；用户文字被判高风险 → 400 `CONTENT_REJECTED`，没有存下，agent 没有被调用
- [ ] 文字额度：没有有效权益、`chat.daily_messages` 和 `chat.monthly_messages` 都没配置 → 403 `FEATURE_LIMIT_REACHED`（`data.feature=CHAT`）；配了日额度 3，第 4 条 → 403 `data.limit=DAILY` 带 `resetAt`；`FAILED` 的轮次不占额度，用同一个 `messageKey` 重试成功后只占一条；有有效权益而键未配置 → 不限制；`GET /api/entitlements` 的 `usage` 带文字键
- [ ] 文字对话失败：agent 不可达、超时（`chat.turn_timeout_seconds`）、中途断流 → 流以 `error` 结束，用户消息 `turnStatus=FAILED`，记 `text_turn_failed`；客户端中途断开不取消这一轮，回复照常存下；同一 `messageKey` 在 `COMPLETED` 后重发 → 返回存下的回复，不再调用 agent；后端崩溃留下的 `PENDING` 被清扫置 `FAILED`
- [ ] 文字对话收尾：agent 的回复被审核判高风险 → 不存回复，用户消息 `turnStatus=COMPLETED`，`done` 的 `messageId=null`、`hidden=true`，没有调用 `/v1/chat/ingest`；同一 `messageKey` 重发 → 同样的 `done`，不调用 agent；回复存下后调用了 `/v1/chat/ingest` 一次，它失败或超时 → 只记日志、不重试、`done` 已经发出；第 7、8 步被拒绝后下一次请求不是 `CHAT_BUSY`（锁已释放）；`AGENT_CHAT_URL` 没配置 → 503 `AGENT_UNAVAILABLE` 且没有留下 `PENDING` 消息；重试一条 `FAILED` 的消息 → `timestamp` 更新为当前时间，按当前窗口计数；`GET /api/chat/history` 带 `turnKey`
- [ ] 文字对话和养成：一轮完成后 `lastInteractionAt` 和 `lastTextAt` 更新；30 分钟内的第二条文字不增加 `interactionCount`，超过 30 分钟的增加 1；连续天数按请求体 `timezone` 的日期算；不触发 `first_session`
- [ ] 文字对话和账号：轮次进行中账号被封禁 → 回复不存，流以 `ACCOUNT_BANNED` 的 `error` 结束；账号删除前等进行中的轮次结束再清 AvatarMemory；删除后 `Message` 里该账号的文字消息都没有了
- [ ] `GET /api/chat/history` 不带参数返回该账号最新消息；`before` 翻页到头 `nextCursor=null`；越权 `sessionId` 返回空列表
- [ ] 消息被复核隐藏后：普通查询不再返回它；`updatedSince` 查询返回带 `hidden:true`、无 `text` 的墓碑
- [ ] 用户离开房间（收到非 agent 的 `participant_left`）后房间里只剩 agent → `session.user_leave_grace_seconds` 之后房间被后端关闭，`endedAt` 等于 `userLeftAt`（不是 webhook 到达或扫描的时刻），额度按这个时长扣；宽限期内用户重新进入 → `userLeftAt` 被清空，房间不关
- [ ] `participant_left` webhook 丢失 → 存活核对（`session.liveness_check_seconds`）发现房间没有用户后补写 `userLeftAt` 并收尾，不会一直算到 `deadlineAt`
- [ ] 用户加入判断：`participant_joined`（非 agent）写入 `userJoinedAt`；webhook 丢失但房间里有用户时，到点扫描丢弃前的 `listParticipants` 补写，不误丢弃
- [ ] 等 agent 加入期间窗口边界或额度变化 → 重算后的 `deadlineAt = min(startedAt + R, W, startedAt + H)`，不超过窗口结束；多个额度同时用完时 `FEATURE_LIMIT_REACHED` 报告重置最晚的那一个
- [ ] `POST /api/internal/messages` 的批次里有一条 `role` 非法、`createdAt` 缺失或 `text` 超长 → 整批 400，一条都没存；重发修正后的整批成功
- [ ] `updatedSince` 增量同步：消息的事务在客户端推进游标之后才提交 → 下一次同步仍能取到（回看 `chat.sync_overlap_seconds`）；重复返回的消息按 `messageId` 合并无害
- [ ] `POST /api/internal/messages` 的 `messages` 为空数组或超过 `chat.messages_max_batch` → 400 `INVALID_REQUEST`，一条都不存
- [ ] 用户一直没进入房间：到点扫描用 `listParticipants` 确认房间里没有非 agent 参与者后丢弃，`Session` 记录和 `sessionId` 等于它的 `Message`（agent 的问候）都被删除；`participant_joined` webhook 丢失但房间里有用户时不被误丢弃；只剩 `participant_left`（`userLeftAt` 有值）而 `userJoinedAt` 为空时按“加入过”处理
- [ ] `participant_joined`/`participant_left` 乱序或重试：较旧的事件不覆盖较新的（`lastParticipantEventAt`）；`agentIdentity` 为空时按 `participant.kind` 判断，`kind` 也取不到则忽略；被新请求取代的会话以 `endedAt = userLeftAt`（空则当前时间）收尾，`endReason=SUPERSEDED`
- [ ] 游客发起会话缺 `language` 或为空串 → 400 `INVALID_REQUEST`；不在列表里 → 400 `INVALID_LANGUAGE`；`grantedSeconds` 并发写入只有一个成功（`WHERE grantedSeconds IS NULL`）
- [ ] 文字对话的锁值是本轮唯一标识，某一轮超过有效期后前一轮退出不会删掉后一轮的锁；每个文字轮次完成都更新 `CompanionshipStats.lastTextAt`；`interactionCount` 通话每次结束 +1、文字按段计
- [ ] 发起会话的 `timezone` 是 `+08:00`、`GMT+8`、`Z` → 400 `INVALID_TIMEZONE`；客户端回退用 `Etc/GMT-8` 等 IANA 名成功
- [ ] 4.1 回退表的每一项名字都在 `ZoneId.getAvailableZoneIds()` 里，`Etc/GMT-8`、`Etc/GMT+5`、`UTC`、`Australia/Lord_Howe`、`Pacific/Chatham`、`America/St_Johns` 发起会话都成功（200，不是 `INVALID_TIMEZONE`）

**养成**
- [ ] 同一天两次通话结束 → `interactionCount`+2，`currentStreak`不变
- [ ] 昨天和今天各一次通话 → `currentStreak`变成2
- [ ] 三天前一次、今天一次(中间断了) → `currentStreak`重置为1
- [ ] 用户在 UTC+8，本地早 7 点（UTC 前一天 23 点）和本地次日早 9 点各通话一次 → `currentStreak` 为 2（按用户时区，不按 UTC）
- [ ] 通话时区变西导致 `today` 早于 `lastInteractionDate` → `streak` 不倒退
- [ ] 陪伴数据从0天开始，跨过 `milestone.days` 里的天数时对应里程碑各只生成一条，不重复；修改阈值配置后新阈值生效
- [ ] 修改 `companionship.stage_thresholds` 后，`relationshipStage` 按新阈值计算
- [ ] `lastInteractionDate` 早于用户本地昨天时读取 `GET /api/companionship` → `currentStreak` 返回 0，等于昨天时返回存储值；`GET /api/milestones` 每条带 `milestoneKey`，按 `occurredAt` 升序；没有养成数据的账号 `interactionCount`、`currentStreak` 为 0，`daysCompanioned`、`relationshipStage` 照公式算；游客 `Session` 的保留期从 `startedAt` 起算
- [ ] 通话结束和文字轮次完成并发 → `CompanionshipStats` 行锁保证 `interactionCount` 不丢、`currentStreak` 不重复重置；被丢弃的启动中会话和用户从未加入的会话不计互动次数
- [ ] `day_N` 里程碑的 `occurredAt` 是写入时刻；`content` 是英文

**埋点**
- [ ] 不带 JWT、带 `deviceId` 调用 `POST /api/events` → 成功，事件记为匿名；带过期 JWT → 同样成功（不返回 401）
- [ ] 请求体里伪造他人 `accountId` → 被忽略，账号取自 JWT
- [ ] 用状态为 `PENDING_DELETION`、`DELETING` 或 `BANNED` 账号的有效 JWT 调用 `POST /api/events` → 事件记为匿名，不带 `accountId`
- [ ] 一批里有名称不合规的事件 → 该条被丢弃，其余入库，响应 `dropped` 计数正确
- [ ] 超过 `events.max_batch` 或请求体上限 → 413 `BATCH_TOO_LARGE`，整批不处理
- [ ] MongoDB 写入失败 → 接口仍返回 200，仅记日志
- [ ] 里程碑写入时后端产生 `milestone_reached` 事件；推送发出时产生 `push_sent`
- [ ] 事件上下文与掩码：事件带 `deviceModel`、`locale`、`network`；`GET /analytics/events` 的 `ip` 默认掩码，持有 `ANALYTICS:IP_VIEW` 才完整；`events.ttl_days` 低于下限（`30 + stats.land_window_days`）→ `INVALID_REQUEST`
- [ ] 客户端上报的 `register_completed` 事件被接收（`method` 参数）

**推送**
- [ ] 同一个 `pushToken` 先属于账号 A，账号 B 登录后注册 → 改绑到 B，A 不再收到该设备的推送
- [ ] 同一账号注册两个不同 token → 两条记录，发送时两个都收到
- [ ] FCM 对某 token 返回 `UNREGISTERED` → 该 token 被删除；返回其他错误 → 不删
- [ ] 发出的 ANDROID 消息不含 `notification` 字段，优先级 `HIGH`，`data` 的值全是字符串
- [ ] `recall` 偏好为 false 的账号不发召回；`announcement` 为 false 不发手动推送
- [ ] 召回：24 小时未互动的账号在其本地发送窗口内收到 `daily_recall`；连续 7 天且今天未互动的账号收到 `streak_at_risk`（优先于前者）
- [ ] 同一账号同一当地日期最多一条召回（`daily_recall` 和 `streak_at_risk` 合计，唯一约束生效），距上一次召回不足 `recall.min_gap_hours`（默认 20）小时不发；多实例同时运行任务不会重复发
- [ ] 同一时区的多个账号被分散到窗口内不同的扫描周期发出，不集中在同一次扫描
- [ ] 手动推送任务按受众批量发送，`PushRecord.triggerReason=admin`；`audience=GUESTS` 只发游客 token，`ACCOUNTS` 不发游客，`ALL` 都发；`platforms`、`locales` 筛选生效
- [ ] 游客推送：游客凭据登记 token → `accountId` 为空；之后账号令牌登记同一 token → 改绑到账号、`deviceId` 清空；登出后游客凭据再登记 → 回到游客；游客 token 收不到召回推送和站内通知附带的推送，收得到公告；游客 token 的推送不写 `PushRecord`、`PushDelivery`、`push_sent`，`PushTask.sentCount`、`failedCount` 包含它们，按每个 token 的结果计（`ACCEPTED` 记成功，`INVALID_TOKEN`、`FAILED` 记失败）；游客登记 token 超过 `ratelimit.push_token_per_ip_per_hour` → 429；90 天未更新的游客 token 被清理任务删除
- [ ] 周期推送细节：停机超过 `push.schedule_catchup_minutes` 后恢复 → 只补发窗口内最近一次，更早的跳过；夏令时空档里的时刻顺延、重叠取第一次；`startDate`、`endDate` 按周期推送的时区；`audience=ACCOUNT_IDS` 带 `platforms` → 400；周期推送增删改：`PUT` 改时刻后 `nextRunAt` 重算，`DELETE` 后不再生成、已生成的保留
- [ ] 周期推送：`WEEKLY` 周一 09:00（指定时区）→ 每周一到点生成一条 `PushTask`；同一时刻重复扫描不产生第二条；`MONTHLY` 的 31 日在 30 天的月份取 30 日；停用或超过 `endDate` 后不再生成，已生成的不受影响
- [ ] 一次推送发给账号的两个 token → 一条 `PushRecord`、两条 `PushDelivery`；`pushId` 在 `push_sent`、`data.pushId`、`push_opened` 中是同一个值
- [ ] `linkType=URL` 且 `linkTarget` 不是 https → 创建模板/手动推送时被拒绝
- [ ] 召回推送：相邻两天的发送时刻差 23 或 25 小时（夏令时、扫描周期）→ 不会被隔天跳过；同一当地日期不会发第二次；`recall.min_gap_hours` 默认 20
- [ ] 召回推送的语言归一化来自 `app.supported_locales`，没有硬编码语言；列表里没有的语言回退 `push.default_locale`；某个召回原因缺少列表中任一语言的模板 → 不能启用
- [ ] 手动推送任务：两个实例同时到点只有一个认领；`RUNNING` 任务租期过期后被另一个实例从 `cursor` 之后继续；错过时间超过 `push.schedule_catchup_minutes` 的一次性任务置 `CANCELLED`；受众不含非 `ACTIVE` 账号
- [ ] 游客 token 的推送 `data.pushId` 为空字符串，客户端不上报 `push_opened`；管理员推送的 `PushRecord.localDate` 取收件账号时区的当地日；`PushTask.cursor` 的批边界不会把同一账号的 token 拆开

**邀请与归因**
- [ ] 自建归因·链接：启用的 `code` + Android UA → 302，`Location` 以 `attribution.play_store_url` 开头，referrer 是 `attr_id=<该点击的 attrId>&utm_source=…&utm_medium=…&utm_campaign=…` 整体编码一次、不超过 512 个字符；非 Android 的 UA → 302 到 `attribution.other_platform_url` 且**不记点击**；停用或不存在的 `code` → 404 且不记点击、不回显 `code`；对应地址没配置 → 404；保存 `attribution.play_store_url` 时主机不是 `play.google.com`、有片段、端口、多余查询键 → `INVALID_REQUEST`；`attribution.link_base_url` 带路径或查询 → `INVALID_REQUEST`；点击记录带 `ip`、`userAgent`、`expireAt`、`purgeAt`：`expireAt` 之后明细显示 `EXPIRED`，到 `purgeAt` 才被 TTL 删除；每 IP 超限 → 仍然 302 但不记点击；UTM 参数含 `&`、`=` 或超过 64 个字符 → 丢弃，用账户默认值
- [ ] 自建归因·认领：referrer 里的 `attr_id` 有效 → 写 `AttributionRecord`（`source=SELF`、`matchType=REFERRER`、渠道字段取自 `AttributionCampaign`），同一事务更新 `AttributionClaim`，点击的 `claimedAt` 随后置上；同一设备再次认领（含并发）→ 返回同样结果、不新增记录；`installReferrer` 编码前后两种形式都能解析，值里夹带 `&` 的伪造参数不会改变取到的第一个 `attr_id`；没有编号、同 IP 24 小时内有未认领点击且系统版本和设备型号兼容 → `FINGERPRINT`，取从新到旧的第一条兼容的；型号不兼容的不匹配；窗口外的点击不匹配；点击已被认领 → 第二台设备认领不到（`attrId` 唯一）；两台设备并发认领同一个点击 → 一台成功，另一台回滚后重新评估一次，不返回 5xx；没有 `integrityToken` → 403 `DEVICE_INTEGRITY_FAILED`；`deviceId` 缺失或超过 64 个字符、`installReferrer` 超过 2048 个字符 → 400；每 IP 超限 → 429；安装之后才点广告的设备回头认领 → 返回已有结果，不评估；兜底也没有匹配 → `matched=false`，当天 `unattributedInstalls` +1
- [ ] 自建归因·APK 签名块：`POST /api/attribution/click` 的 `PAGE_VIEW` → 当天访问量 +1，`DOWNLOAD_CLICK` → Android 的 UA 返回 `attrId` 并记点击（`channel=APK_DOWNLOAD`），UA 不是 Android 返回 200 和 `{"attrId":null}`、不记点击；不存在或停用的 `code` → 404；每 IP 超限 → 429；响应不带 CORS 头；`GET /api/public/attribution/pixels?code=` 只返回像素编号，不含访问令牌；认领请求带 `apkAttrId` 有效 → `matchType=APK_BLOCK`，同时带 `apkAttrId` 和 referrer 时以 `apkAttrId` 为准；`apkAttrId` 找不到、已被认领或过期 → 退回 referrer，再退回指纹；超过 128 个字符 → 400；客户端在没有签名块的包（Play 安装）上读到空，不报错，只读一次；认领失败（含 429、5xx）时客户端下次启动重试，最多 3 天
- [ ] 自建归因·账号与后台：设备之后注册账号 → `AttributionRecord.accountId` 回填并写 `registeredAt`，只填第一次，三条创建账号的路径（邮箱、Google/Apple、手机号）都生效；账号删除后该行已删除；没有账号的 `AttributionRecord` 和 `AttributionClaim` 超过 `attribution.record_retention_days` 被清理任务删除；导出的 `attribution.json` 含该账号的归因记录、不含 IP
- [ ] 投放账户：`code` 不合规 → 400 `INVALID_REQUEST`，重复 → 409 `DUPLICATE_RESOURCE`（`data.field` 为 `code`），创建后不可改；没有删除接口，停用后链接 404、历史点击和归因仍在报表；`GET /attribution/campaigns/{id}/link` 在没有该平台像素编号时 → 400，否则返回带 UTM 的链接；`facebookAccessToken` 加密存储，所有响应只返回"已设置"；没有 `ATTRIBUTION:MANAGE` → 403 `ADMIN_FORBIDDEN`
- [ ] 投放成本：`POST` 重复的 `(campaignId, statDate)` → 409 `COST_EXISTS`；`amount` 为负 → `INVALID_REQUEST`；批量里有一行不合法 → 整批拒绝且 `data.details` 逐行说明；批量里已存在的日期按覆盖处理；超过 `attribution.cost_batch_max` → `INVALID_REQUEST`；币种与 `attribution.cost_currency` 不同 → `INVALID_REQUEST`
- [ ] 投放效果：`pageViews`、`clicks`、`installs`、`registered`、`cost` 与点击记录、归因记录、成本记录一致；当天的行随 `stats.land_interval_minutes` 刷新，当天就能在报表里看到；`clickRate`、`installRate`、`registerRate`、`cpa`、`cpi` 在分母为 0 时为 `null`；比率用汇总后的分子分母计算；"未归因"行只有 `unattributedInstalls`；点击记录过期之后补数不删已落地的行；没有 `ATTRIBUTION:VIEW` → 403
- [ ] 邀请分享漏斗：`invite_share_clicked` 带 `shareChannel`；`POST /api/public/invite-events` 对存在的邀请码写 `invite_link_click`/`invite_download_click`（`accountId` 是邀请人、`deviceId` 为空），不存在的邀请码也返回 200 且不写事件，每 IP 超限 → 429，响应不带 CORS 头；`GET /invites/share-funnel` 的 `registered` 等于当日 `InviteRecord` 数；UV 不跨日相加；没有 `INVITE:VIEW` → 403
- [ ] 邀请链层级：`GET /invites/depth-stats` 的 `depthDistribution` 各深度的 `count` 之和等于范围内被邀请人数（`totalChains` 是范围内不同根账号数，两者只有每个根账号恰好邀请一人时才相等）；`GET /invites/chain` 的 `maxDepth` 超过 `invite.chain_max_depth` → `INVALID_REQUEST`；节点标识是掩码；同一个被邀请人不会出现两次（`inviteeAccountId` 唯一）
- [ ] 邀请奖励补充：邀请人或被邀请人是 `BANNED`、`DELETING` → `NOT_ELIGIBLE(ACCOUNT_STATE)`；任一方是 `PENDING_DELETION` → 本次不评估、记录保持 `PENDING`，取消删除后下一次满足条件的通话结束再评估；游客会话、启动中的会话、不足 `invite.first_call_min_seconds` 的通话不触发评估；到点强制结束和 webhook 两条路径结束的会话同样触发；被邀请人删号后邀请人的 `inviteRewardedCount` 不减少，上限仍然生效；删号后该账号作为邀请人或被邀请人的 `InviteRecord` 都已删除；三条创建账号的路径（邮箱、Google/Apple、手机号）都创建 `PENDING` 的邀请记录，`REGISTER` 触发时在同一事务里评估；`invite.reward_start_at` 不早于 `invite.reward_end_at` → `INVALID_REQUEST`
- [ ] `GET /api/invite` 游客凭据 → 403 `REGISTRATION_REQUIRED`，账号返回自己的码、`inviteLink`（没配 `inviteLinkBase` 时为 `null`）、被邀请人数、已奖励数和当前奖励配置；`GET /api/invite/records` 分页、掩码标识（邮箱本地部分保留首字符加 `***`，只有一位时写 `*`；域名每一段保留首字符加 `***`，顶级域原样；既没有邮箱也没有手机号时是账号 ID 的前 8 位）、只含自己作为邀请人的记录，游客 → 403
- [ ] 邀请奖励：`invite.reward_enabled=false` 时 `FIRST_CALL` 触发的评估把记录置 `NOT_ELIGIBLE(DISABLED)`；开启、`FIRST_CALL`、被邀请人第一次通话满 `invite.first_call_min_seconds` → 两边各一条 `CreditLedger`（`INVITE_REWARD`，`eventKey` 分别为 `...:INVITER`、`...:INVITEE`），余额更新，`InviteRecord` 记下发放金额；通话不足该时长不触发；同一记录再次评估不重复发；`REGISTER` 触发在注册请求里就发；邀请人已达 `invite.max_rewarded_per_inviter` → `NOT_ELIGIBLE(LIMIT_REACHED)`；两人的 `User.registerDeviceHash` 相同 → `NOT_ELIGIBLE(SAME_DEVICE)`；活动时间外 → `OUT_OF_WINDOW`；改配置后已发放的金额不变；没有 `INVITE:CONFIG` 的管理员 `PUT /config/invite.*` → 403
- [ ] AppsFlyer 回传：路径密钥错误 → 404；配置了 `AF_PUSH_TOKEN_HEADER`、`AF_PUSH_TOKEN` 后缺令牌头或值不对 → 404；`advertising_id`、`idfa`、`ip`、`user_agent`、`idfv`、`city`、`postal_code` 入库前已丢弃；成本字段按 `af_cost_value`、`af_cost_currency`、`af_cost_model`、`cost_in_selected_currency` 读取；同一 `(appsflyer_id, event_name, event_time, event_type)` 只存一条，重复的返回 200，`event_type` 不同的两条都存；缺 `appsflyer_id` 的消息 → 200 且不入库；请求体不是合法 JSON → 400；落库后在 4 秒内返回 200
- [ ] 回传中带了 `ip`、`user_agent`、`advertising_id` 等字段 → 入库前被丢弃
- [ ] 回传缺少可选字段的 key → 正常解析，不报错
- [ ] 回传里 `customer_user_id` 对应的账号不存在或状态不是 `ACTIVE` → 记录保存但 `accountId` 为空
- [ ] 客户端调用 `POST /api/attribution/link` 后，此前 `accountId` 为空的同 `appsflyer_id` 记录被回填
- [ ] 邀请奖励触发从 `FIRST_CALL` 改为 `REGISTER` 后，遗留的 `PENDING` 记录在被邀请人下一次满足时长的通话结束时被评估
- [ ] `POST /api/attribution/link`：`appsflyerId` 格式不对 → 400；同一账号重复调用 → 200 不变；另一个账号用同一个 `appsflyerId` → 200 但不抢走归因；游客凭据 → 403
- [ ] 自建归因：认领请求晚于注册到达（审计行里能按设备 HMAC 找到账号）→ 写入的 `AttributionRecord` 直接带 `accountId` 和 `registeredAt`（取账号 `createdAt`）
- [ ] `POST /api/attribution/click` 和 `GET /api/public/attribution/pixels` 的 `code` 不存在或已停用 → 404 `CAMPAIGN_NOT_FOUND`；`GET /go/{code}` 不存在 → 404 纯文本
- [ ] `FIRST_CALL` 触发时，被邀请人创建账号命中防滥用标记 `inviteeRewarded` → `User.priorInviteeRewarded=true`，评估时读它记 `NOT_ELIGIBLE(PRIOR_ACCOUNT)`，标记过期后也一样；`CreditBalance` 行不存在时评估先建行再加锁；`POST /api/public/invite-events` 的 `shareChannel` 不合格按 `unknown`、`event` 非法返回 200 不写
- [ ] 被邀请人奖励额度为 0 时（默认）：A 邀请 B 并评估为 `REWARDED`，B 的 `inviteeRewardedAt` 有值；A 删号，B 随后删号，同一台设备重新注册账号 C 并带另一个邀请人 D 的码：C 的 `priorInviteeRewarded` 为真，D 与 C 的邀请记录评估为 `NOT_ELIGIBLE`、`rewardReason=PRIOR_ACCOUNT`；`invite.invitee_reward_credits` 大于 0 时同样成立
- [ ] AppsFlyer 记录回填账号时 `registeredAt` 同时写入（只填第一次）；账号不是 `ACTIVE` 时后续回传 `accountId` 记空；点击记录过期后再保留 `attribution.click_expired_keep_days` 天才被 TTL 删除，期间明细页显示 `EXPIRED`；`attribution.play_store_url` 未配置时 Android 访问归因链接 → 404；投放成本批量接口的重复 `(campaignCode, statDate)` → 整批 400

**审核与举报**
- [ ] 生产配置下没有审核服务 → 后端启动失败
- [ ] 生产环境 `moderation.block_score`、`moderation.review_score` 任一未配置 → 依赖审核的用户端接口返回 503 `DEPENDENCY_UNAVAILABLE`、生成任务不处理，管理端接口照常可用，运营在管理端配好两个值之后用户端接口恢复
- [ ] 举报自己账号下的消息/资产 → 创建 `source=REPORT` 记录进复核队列；举报别人的或不存在的对象 → `REPORT_TARGET_NOT_FOUND`
- [ ] 同一账号对同一对象已有待处理举报时重复举报 → 返回同一个 `reportId`；该举报复核完成后再举报 → 创建新记录
- [ ] 复核 REJECT 已有资产 → 资产被删除、指针清空、外部删除任务创建
- [ ] 每次复核和每次查看用户上传内容都写 `AdminAuditLog`
- [ ] 规则词表：`SUBSTRING` 命中不分大小写、不受零宽字符绕过；`WORD` 不误伤包含该词的长词；`REGEX` 编译失败 → 保存时 400，执行超时 → 按命中 `REVIEW` 处理；规则命中 `BLOCK` 时不调用审核服务；规则 `REVIEW` 与服务 `BLOCK` 并存时取 `BLOCK`；`ModerationRecord.categories` 只含 `RULE:<id>`，不含命中的文字

**客服**
- [ ] `POST /api/support/feedback` 存下记录并转发；转发失败 → 状态 `PENDING`/`FAILED`，后台重试，记录不丢；超过每小时限额 → 429
- [ ] 反馈转发连续失败 `retry.max_attempts` 次后置 `FAILED` 并停止；管理员重新转发后状态回到 `PENDING`、失败次数清零；间隔按 `retry.initial_seconds` 翻倍、不超过 `retry.max_seconds`

**账号删除与导出**
- [ ] 删除时密码错误 → 401；成功后立即：账号状态 `PENDING_DELETION`、除申请所用登录链之外的 refresh token 作废（网页路径和后台代发起没有当前链，全部作废）、推送 token 全部删除、进行中的房间被删除，响应带 `scheduledAt`（= 现在 + `deletion.grace_days`）
- [ ] `PENDING_DELETION` 和 `DELETING` 期间该邮箱不能重新注册；全部步骤完成后可以
- [ ] 宽限期：`PENDING_DELETION` 期间登录成功，除取消删除、登出、只读的 `GET /api/account`（200，带 `providers`）和 `purpose=DELETE` 的 `otp/send` 外，其他接口返回 403 `ACCOUNT_DELETION_SCHEDULED`（`data.scheduledAt`），带该账号 JWT 的 `purpose=EXPORT` 仍是 403，`purpose=LOGIN` 不需要登录、宽限期内的手机号照常发码登录；`POST /api/account/deletion/cancel` 带正确的重新验证 → `User.status=ACTIVE`、`AccountDeletion.status=CANCELED`；定时任务把状态置 `DELETING` 之后再取消 → 403 `ACCOUNT_DELETING`；从未申请过或已取消后再取消 → 409 `INVALID_STATE`；`executeAfter` 已过但定时任务还没跑、仍是 `SCHEDULED` 时取消成功；宽限期满，定时任务把 `AccountDeletion` 置 `PENDING`、`User.status` 置 `DELETING` 并开始删除；`deletion.grace_days` 改配置不影响已申请的
- [ ] 宽限期长于 refresh token 有效期：`auth.refresh_ttl_days=7`、`deletion.grace_days=14` 时申请删除，申请所用登录链的 refresh token 到期时间不早于 `executeAfter`；设备第 10 天才打开 App，`POST /api/auth/refresh` 仍成功，能显示“取消删除”并取消；取消之后（`User.status` 回到 `ACTIVE`）下一次轮换的到期时间回到“现在 + `auth.refresh_ttl_days`”；其他登录链仍然被作废
- [ ] 手机号账号在宽限期内取消删除：`otp/send`（`purpose=DELETE`，不带 `phone`）收到验证码 → `POST /api/account/deletion/cancel` 带 `code` 成功；宽限期内 `GET /api/account` 返回 200，带 `providers` 和 `status=PENDING_DELETION`
- [ ] 防滥用标记：删除时写入 `AbuseMarker`（设备、手机号、邮箱、第三方 sub 各一条，只有哈希和数值）；用同一设备或同一邮箱重新注册 → `lifetimeGrantSeconds`、`lifetimeUsedSeconds` 取标记里的值，不重新发放，`inviteRewardedCount` 取标记里的值；被邀请人命中 `inviteeRewarded` → 邀请记录 `NOT_ELIGIBLE`、`PRIOR_ACCOUNT`；`expireAt` 过后清理任务删除标记；没有命中标记的新账号按原规则发放；删除确认页写明额度清零、订阅要先在商店取消、宽限期天数
- [ ] 外部服务某一步失败 → 该步骤重试，账号保持 `DELETING`，`attempts` 达到 `deletion.alert_after_failures` 后管理后台可见告警
- [ ] 完成后：PostgreSQL 中该账号所有行、MongoDB 中该账号的事件、存储里的文件、AvatarMemory 的数据、合成服务里的音色、形象生成服务里的形象都已清除（逐项抽查）
- [ ] 导出：生成的 zip 含 13.3 列出的全部文件；AvatarMemory 导出失败 → 任务 `FAILED`，不产出不完整的包；过期后下载失败且文件已删除
- [ ] 网页删除请求：同一邮箱每小时超过 `ratelimit.link_mail_per_email_per_hour` 仍返回成功、不发信、旧令牌不失效；`PENDING_DELETION`、`DELETING` 账号、没有已验证邮箱的账号不发信；没有配置 `email.link_base_url` 或邮件服务商 → 503 `EMAIL_SEND_FAILED`，与邮箱是否存在无关
- [ ] 网页删除：`deletion-request` 对已注册和未注册邮箱都返回成功；已注册的收到确认邮件；`deletion-confirm` 令牌有效则执行 13.1 的删除，重复使用或过期 → 400 `INVALID_DELETION_TOKEN`；同一邮箱重复申请使旧令牌作废；有有效订阅的账号，邮件里有取消订阅的说明
- [ ] 并发提交两个删除申请 → 只有一个成功，另一个 403 `ACCOUNT_DELETION_SCHEDULED`（带 `scheduledAt`），`statusBefore` 是 `ACTIVE` 或 `BANNED`，不会是 `PENDING_DELETION`；第 1、2、4 步其中一步失败时整体回滚，账号保持原状态
- [ ] 取消删除与宽限期满的定时任务同时发生 → 只有一方成功；账号不处于待删除、或 `AccountDeletion` 已不是 `SCHEDULED` 时取消 → 409 `INVALID_STATE`
- [ ] 删除执行器：`RUNNING` 的任务 `lockedAt` 过期后被另一个实例重新认领并从未完成的步骤继续；某一步失败后 `FAILED`、`nextAttemptAt` 按退避增长；`attempts` 达到 `deletion.alert_after_failures` 写一条 `DELETION_FAILED` 告警（`refType=ACCOUNT_DELETION`）且继续重试，完成后告警 `RESOLVED`；`retry` 接口对 `FAILED` 以外的状态 → 409 `INVALID_STATE`
- [ ] 进入 `DELETING` 时账号有 `PROCESSING` 的形象任务（`AVATAR`、`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP`）→ 任务置 `FAILED`（内部 `ACCOUNT_DELETED`）并创建 `AVATAR` 删除任务；轮询任务此后不再为该账号落地资产
- [ ] 删除的第 6 步：`PushDelivery` 随 `PushRecord` 删除，`SubscriptionEvent` 按 `accountId` 或所属订阅删除，`AdminAlert`（含 `RESOLVED`）删除，`PushSchedule.accountIds` 与 `PushTask.accountIds` 都移除该账号，`ModerationRecord` 去掉 `accountId` 并清空 `reporterDetail`；`OneTimePurchase` 变成无账号墓碑（`accountId` 为空、`tombstonedAt` 有值），到 `deletion.tombstone_retention_days` 才被清理
- [ ] 已删除账号的已入账购买转成的墓碑（`creditedAt` 非空）：`ONE_TIME_CHARGE` 通知被商店重发，或旧交易的 `credits/apple/verify` 重放 → 不新增入账、不创建 `UNCLAIMED` 记录（墓碑命中）；`verify` 返回 409 `PURCHASE_OWNED_BY_OTHER`；买一次、删号、再注册、再 `verify` 同一笔 → 409，不重复入账
- [ ] 通知先到、令牌指向已删除、不存在或正在删除的账号时建了锚点行（`creditedAt` 为空）之后，当前账号 `verify` 同一笔交易 → 按绑定规则入账给调用者，`tombstonedAt` 清空，结果与 `verify` 先到相同；Google 额度购买同理；锚点行状态已是 `REFUNDED` 时 `verify` → 400 `PURCHASE_VERIFY_FAILED`
- [ ] 防滥用标记：账号注册超过 `abuse.audit_retention_days`（`RegistrationAudit` 已被清理）后删除，`DEVICE` 标记仍写成功（键取 `User.registerDeviceHash`）；同一键已有标记时合并（发放值与已用量成对取剩余最少的一对，`inviteRewardedCount` 取最大，`inviteeRewarded` 取或，`expireAt` 取较晚）；标记在删除行之前写入
- [ ] 导出：已有 `PENDING` 或未过期的 `READY` 任务时再次 `POST` → 返回同一个 `exportId`，不返回 429；没有这样的任务且距上次成功导出不足 `export.min_interval_hours` → 429；`FAILED` 之后立即可重新创建
- [ ] 导出生命周期：超过 `export.job_timeout_minutes` 置 `FAILED`（`TIMEOUT`）；AvatarMemory 导出失败 → `FAILED`（`MEMORY_SERVICE_ERROR`）；AvatarMemory 对没有记忆的账号返回 200 和空数组时导出成功且 `memories.json` 为空；过期清扫删除 zip 并置 `EXPIRED`，`download` → 409 `EXPORT_NOT_READY`；申请删除时 `PENDING` 的导出置 `FAILED`（`ACCOUNT_DELETION`），宽限期内 `download` 返回 403；不存在或别人的 `exportId` → 404 `EXPORT_NOT_FOUND`；`status` 接口的 `expiresAt` 只在曾经 `READY` 的任务（`READY`、`EXPIRED`）有值；`download` 响应头 `Content-Type: application/zip`、`Content-Disposition: attachment`；最小间隔内再建新任务 → 429，带 `data.retryAfterSeconds` 和 `Retry-After` 头
- [ ] 导出包含 `feedback.json`、`reports.json`、`auth-events.json`、`notification-preferences.json`、`push-records.json`，且各文件不含密码或令牌哈希、IP 与设备哈希、存储路径
- [ ] 网页手机号删除路径：号码已注册与未注册的响应、响应时间一致；号码级限流超限静默成功且不发短信（注册与否都一样）；未申请过验证码的号码（注册与否）提交确认 → 都是 400 `OTP_EXPIRED`；申请过之后（含未注册号码的占位验证码）错误 → 都是 `OTP_INVALID`，第 `sms.otp_max_attempts` 次错误时是 `OTP_ATTEMPTS_EXCEEDED`，之后再提交都是 `OTP_EXPIRED`；`PHONE_INVALID` 在号码无法解析、无效或线路类型被拒时返回，与号码是否注册无关
- [ ] 网页删除确认令牌对 `SCHEDULED` 的账号再次确认 → 返回已有的 `deletionId` 和 `scheduledAt`；对已在执行的删除 → 403 `ACCOUNT_DELETING`
- [ ] `GuestDevice.convertedAccountId` 在账号删除后置空而 `convertedAt` 保留；`deletion.grace_days` 保存 0 或 31 → 400 `INVALID_REQUEST`
- [ ] 防滥用标记合并：同一 `(keyType, keyHash)` 的两个标记一个是（发放 600、已用 600）、一个是（发放 1200、已用 0）→ 合并后取剩余最少的那一对（600/600）；发放值为 `-1`（不限）的一对不会因为数值小而被丢弃，且视为无穷大剩余；发放值为空的一对不参与
- [ ] 删除步骤 1 等锁超时 → 本步失败（`LOCK_HELD`）并退避重试、不调用 AvatarMemory；步骤 2 把任务置 `FAILED` 与创建 `ExternalDeletionJob` 在同一事务里；轮询落地资产与置 `DELETING` 互斥（`FOR SHARE`），`DELETING` 后落地的结果被丢弃并创建删除任务；执行器带 `lockedAt` 条件写入，被别的实例重新认领后旧执行器的写入更新不到行
- [ ] 导出创建前先做重新验证身份；过期但未被清扫的 `READY` 任务在新建前被置 `EXPIRED`，不阻塞新建；清扫任务把超时的 `PENDING` 置 `FAILED(TIMEOUT)`；`credits.json` 含 `AccountFeatureBonus` 和 `OneTimePurchase`，`events.json` 含 `deviceId`、`ip`

**订阅与权益**
- [ ] 没有任何权益配置时，`assets.avatar_max`/`assets.voice_max` 不限制上传；管理员把默认上限设为 N 后，已有数量不小于 N 的账号上传返回 403 `FEATURE_LIMIT_REACHED`
- [ ] Google：购买后调用 `verify` → 订阅 `ACTIVE`，权益生效，`GET /api/entitlements` 的 `features` 是生效值；obfuscated account ID 属于别的账号 → 409 `SUBSCRIPTION_OWNED_BY_OTHER`；凭证无效 → 400 `SUBSCRIPTION_VERIFY_FAILED`
- [ ] Apple：`verify` 与通知都要验签，签名无效的一律拒绝；`appAccountToken` 与账号 ID 一致才绑定；商店通知接口：Apple JWS 的证书链或签名无效、Google 身份令牌无效（签名、签发者、过期或受众不对）→ 401 `INVALID_SIGNATURE`，不保存事件、不改状态，响应不说明哪一步失败；验签通过但包标识不符、或处理出错而事件已保存 → 200 且事件记 `error`；两个接口各按来源 IP 每 60 秒 600 次，超出 429 `RATE_LIMITED`
- [ ] 同一 Apple `notificationUUID` 投递两次 → 只处理一次；Google 通知乱序 → 最终状态以 `subscriptionsv2.get` 的结果为准
- [ ] Apple `DID_FAIL_TO_RENEW`（`GRACE_PERIOD`）→ 权益保持有效；`GRACE_PERIOD_EXPIRED` → 权益失效；Google `IN_GRACE_PERIOD` → 权益保持有效，`ON_HOLD` → 失效
- [ ] 关闭自动续订（Apple `AUTO_RENEW_DISABLED`、Google `CANCELED`）→ 权益保持到 `currentPeriodEnd`；`REFUND`/`REVOKE`/`SUBSCRIPTION_REVOKED` → 立即失效
- [ ] 沙盒/测试购买默认发放权益且不计入订阅统计；`subscription.accept_sandbox=false` 时只记录、不发放
- [ ] 管理员发放 `PROMO` 权益 → 生效并写审计日志，到期自动失效，不改变商店里的订阅；撤销后立即失效
- [ ] 权益变化导致 `memory.tier` 生效值改变 → 调用 AvatarMemory 的 `PUT /tier`；AvatarMemory 不可用时权益不受影响，同步任务退避重试，`AccountMemoryTier.syncStatus` 反映状态
- [ ] 管理后台把权益的 `memory.tier` 设为 AvatarMemory 里不存在的档位 → `INVALID_REQUEST`
- [ ] 对账任务能把丢了通知的订阅（含 `PENDING`、`accountId` 为空的）修正到商店里的真实状态；Google 订阅超过 `subscription.unacked_alert_hours` 仍未确认的在后台告警
- [ ] 账号删除后订阅相关行全部清除
- [ ] Apple：降级后的 `DID_RENEW` 换成新商品并更新权益映射；`RENEWAL_EXTENDED` 延长到期日；`OFFER_REDEEMED` 按子类型处理
- [ ] Apple：`REFUND` 后收到 `REFUND_REVERSED` → 权益恢复（续订日不变）
- [ ] Apple 宽限期内 `expiresDate` 已过，权益仍有效（靠 `gracePeriodEndsAt`），宽限期结束后失效
- [ ] Google 升级/降级产生新 `purchaseToken` → 经 `linkedPurchaseToken` 关联到同一账号，旧订阅变 `EXPIRED`，其间同一账号同一商店可以有两条非终态订阅（不强制，15.2）
- [ ] Google 用户在 Play 商店订阅中心重新订阅（没有 `linkedPurchaseToken`）→ 经 `outOfAppPurchaseContext` 关联账号，后端在 3 天内确认，不会被自动退款
- [ ] `verify` 成功后后端已确认（`acknowledgementState` 已确认）；重复调用不重复确认
- [ ] 已有订阅行绑定账号 A，账号 B 用不带标识的同一令牌调 `verify` → 409，不被抢走；标识指向已被删除的账号 → 允许绑定到当前账号
- [ ] `PROMO` 权益到期 → 到期扫描触发档位同步，AvatarMemory 档位回到 `default`
- [ ] `GET /api/subscription-products` 不含 `enabled=false` 的商品，但已有该商品订阅的用户仍可 `verify`；商品不在映射里 → 400
- [ ] `GET /api/subscription-products` 每个商品带 `features`（权益取值与默认值合并，`LIMIT` 不限为 `null`），顶层带 `freeFeatures`（各开关默认值，没有配置的通话和文字额度键不出现）；`sortOrder` 按档位从低到高；只返回在当前端可见（`surfaces`）的商品，某个渠道没有配给它的商品时 `products` 为空数组；`features` 不含额度购买的额外单位，没有生效值的额度键不出现
- [ ] `GET /api/credits` 带 `totalEarned`、`totalSpent`、`todayEarned`，`balance == totalEarned − totalSpent`，`todayEarned` 按 `User.timezone` 的本地日（为空按 UTC）；`GET /api/credits/ledger?type=earn` 只含 `delta > 0` 的行，`type=spend` 只含 `delta < 0` 的行，其他值 → 400；`GET /credits/accounts`、`GET /credits/transactions` 没有 `SUBSCRIPTION:VIEW` → 403，筛选和分页如 15.9
- [ ] `GET /api/credits` 的 `costs` 只含 `creditCost` 非空且该账号生效值不是"不限"的开关；`GET /api/credit-products`、`GET /api/credits/ledger`（`entries`+`nextCursor`，游标翻页）、`POST /api/credits/spend`（`balance`+`features`+`bonus`）的响应形状如 15.9；`GET /api/credit-products` 只返回在当前端可见（`surfaces`）的商品，某个渠道没有配给它的商品时 `products` 为空数组
- [ ] 同时有邮箱密码和 Google 登录的账号，`POST /api/account/deletion` 带 `password` 或带 `socialToken` 都能通过重新验证；同时带 `password` 和 `code` 时两种都必须通过，第一个不通过的返回它自己的错误码，短信验证码不被消耗
- [ ] `GOOGLE_CLIENT_IDS` 含 Android 客户端用作 `serverClientId` 的 Web 客户端 ID 时，用该 ID 取得的 Google ID token 能通过 `POST /api/auth/google`
- [ ] 第三方登录响应带 `isNewAccount`：Google、Apple 首次登录新建账号为 `true`，再次登录同一账号为 `false`；客户端据此记 `register_completed`
- [ ] `GET /api/chat/history` 同时带 `updatedSince` 和 `before` 时按 `timestamp` 倒序分页，翻页到 `nextCursor` 为 `null`，不漏不重（含被隐藏的墓碑）
- [ ] `PUT /api/persona`、`PUT /api/notification-preferences` 的响应 `data` 是保存后的完整对象；`moderationStatus` 为 `PENDING_REVIEW` 时 `pendingPersona` 有值
- [ ] `POST /api/avatars`、`POST /api/voices` 带相同 `Idempotency-Key` 的第二次请求不重新处理文件，返回第一次的 `taskId`；缺少该头 → 400 `INVALID_REQUEST`；不同账号发同一个键互不影响
- [ ] `POST /api/credits/spend` 同一账号同一 `idempotencyKey` 的第二次请求返回第一次的结果且不再扣款；同一个键但 `featureKey`/`quantity` 不同 → 400 `INVALID_REQUEST`
- [ ] `GET /api/entitlements` 的 `subscriptions[]` 每项带 `sortOrder`（商品已下架也带）
- [ ] 注册、登录、刷新、第三方登录的响应都带 `accountId`、`token`、`refreshToken`、`expiresIn` 四个字段（2.2）
- [ ] refresh token 被轮换后，在宽限期内用旧令牌再次刷新返回同一对新令牌且不作废登录链；超过宽限期再用旧令牌 → 作废整条登录链、`INVALID_REFRESH_TOKEN`
- [ ] 导出任务 `FAILED` 之后再次 `POST /api/account/export` 得到新任务，不受最小间隔限制
- [ ] 反馈 `message`、举报 `detail`、声音 `transcript` 的长度限制按 Unicode 码点计
- [ ] 多个权益合并：`BOOLEAN` 取或、`LIMIT` 取最大（`UNLIMITED` 最大）、`STRING` 取 `priority` 最高；没有 `EntitlementFeature` 行时用默认值，这与 `UNLIMITED` 不同
- [ ] 支持角色（没有 `FINANCE:VIEW`）调用订阅统计 → 403；失败的订阅事件可在后台重新处理
- [ ] 额度统计：`creditsSpent` 和 `GET /credits/stats` 的 `spent` 取 `SPEND` 减 `SPEND_REVERSED`：失败的建外观任务退回额度后，当天的消费额度和次数相应减少
- [ ] Pub/Sub 推送：事件写入数据库之后才返回 2xx
- [ ] Apple 通知：事件保存成功返回 200，即使处理逻辑出错；连事件都未能保存才返回非 2xx；`CONSUMPTION_REQUEST` 等只记事件的类型不会产生"不认识的类型"错误
- [ ] 账号处于 `DELETING` 或已不存在时，商店通知（订阅状态、续订、退款）和对账：不写账号相关的行（无 `AccountEntitlement`、无流水、不创建 `tombstonedAt` 为空的 `UNCLAIMED`；从未见过的额度购买命中这类账号 → 只建 `accountId` 为空、`tombstonedAt` 有值的锚点行（`state=UNCLAIMED`），不入账、不写流水，之后的 `verify` 可以认领它，15.9），订阅以无账号的行记商店的真实状态，事件照记，对商店返回 2xx；`PENDING_DELETION` 和 `BANNED` 时照常记录并更新权益
- [ ] 处理中途账号被推入 `DELETING`：处理事务持有 `User` 行共享锁，状态变更在其后；不会在第 6 步之后又写出账号相关的行
- [ ] Apple `verify` 用旧交易（`signedDate` 不晚于 `lastEventSignedAt`）重放：不改状态、`currentPeriodEnd` 不倒退、`REVOKED` 不被解除；较新的交易正常更新
- [ ] 同一账号同一商店同时有两条非终态订阅 → 不报错，权益取最高档，`GET /api/entitlements` 的 `subscriptions` 都列出
- [ ] `SubscriptionEvent.payload` 入库时已去掉 `appAccountToken` 和 `obfuscatedExternalAccountId`；无账号且终结超过 `subscription.orphan_retention_days` 的订阅被清理，非终态的保留
- [ ] 功能值：`LIMIT` 取 0 → 合法，表示不允许（上传或发起被拒，不同于未配置和不限）；负数、小数、超过 `entitlement.limit_max` → 400；`spend` 的 `quantity` 为 0 或超过 `credits.spend_max_quantity` → 400
- [ ] 权益到期扫描只处理 `expiryHandledAt` 为空的 `PROMO` 权益，处理后置值，不会重复入队
- [ ] 商店 HTTP 查询在数据库事务之外完成；`DID_CHANGE_RENEWAL_STATUS` 在 `IN_GRACE_PERIOD`/`ON_HOLD` 时只更新 `autoRenew`，不改状态；`SubscriptionEvent.payload` 递归去掉账号标识键；Google 额度 `verify` 命中 `UNCLAIMED` 行或从未入账的锚点行 → 按绑定规则认领并入账，命中已入过账的墓碑 → 409；档位同步“相同则 SYNCED”也带 `targetVersion` 条件

**额度**
- [ ] Google：`credits/google/verify` 入账一次，重复调用（同一 `orderId`）不重复入账；入账后后端调 `consume`，`consume` 失败不回滚入账，重试任务继续，超过 `credits.unconsumed_alert_hours` 告警
- [ ] Apple：`credits/apple/verify` 以 `transactionId` 为键幂等；交易 `type` 不是消耗型、带 `revocationDate`、或 `productId` 不在额度商品里 → 400 `PURCHASE_VERIFY_FAILED`；没有 `appAccountToken` 时依据持有交易绑定到当前账号
- [ ] Apple `ONE_TIME_CHARGE` 对每次额度购买都会到达：与 `verify` 的先后顺序无关，只入账一次；没有 `appAccountToken`（如商店内兑换优惠码）→ `UNCLAIMED`，客户端 `verify` 后认领入账；`appAccountToken` 指向已删除、不存在或正在删除的账号 → 不入账、不写流水，建带删除标记的锚点行，之后的 `verify`（来自能入账的账号）→ 认领并入账给调用者，结果与 `verify` 先到相同；客户端 `verify` 的交易里 `appAccountToken` 指向已删除或不存在的账号 → 绑定到当前调用的账号并入账
- [ ] Google `verify`：待处理购买返回 `{"status":"PENDING"}` 且不入账；`quantity` 不是 1 → 400；已入账并已消耗的购买再次 `verify`（客户端重试）→ 成功，不报错；`orderId` 已属于另一个账号 → 409
- [ ] 退款状态机：未入账的购买先收到退款 → `REFUNDED` 且不写流水，之后 `verify` 被拒；`CREDITED` 收到退款 → 扣回；再收到 `REFUND_REVERSED` → 加回；再次退款 → 再次扣回；重复事件忽略
- [ ] 购买凭证的 obfuscated ID/`appAccountToken` 属于另一个账号 → 409 `PURCHASE_OWNED_BY_OTHER`
- [ ] Apple `REFUND` 扣回对应额度，`REFUND_REVERSED` 加回；Google `voidedPurchaseNotification`（一次性）扣回；均以交易键幂等
- [ ] 已花掉额度后退款 → 整笔额度全部扣回，余额为负，`spend` 返回 402 `INSUFFICIENT_CREDITS`；再购买额度时入账直接抵扣负数（余额 = 流水总和，没有单独的欠款记录）；已购买的额外槽位不回收
- [ ] `spend`：余额足够时扣额度、增加 `AccountFeatureBonus`，`GET /api/entitlements` 的生效值随之提高；同一 `idempotencyKey` 重复提交不重复扣；开关没有 `creditCost` 或已不限 → 400
- [ ] 额度永不过期；账号删除后额度相关行全部清除，`OneTimePurchase` 除外（转为无账号的墓碑，`deletion.tombstone_retention_days` 之后清理）
- [ ] 额度购买退款的 `REFUND` 找不到购买行 → 只记事件，不创建行；墓碑或锚点行命中的 `REFUND`、`REFUND_REVERSED` 只更新 `state`、不写流水
- [ ] 额度调账申请：账号处于 `PENDING_DELETION` 或 `DELETING` 时创建就被拒绝（403 对应错误码），账号不存在 → 404 `RESOURCE_NOT_FOUND`；申请创建之后账号进入 `PENDING_DELETION`/`DELETING`，`approve` → 403 `ACCOUNT_DELETION_SCHEDULED`/`ACCOUNT_DELETING`，申请仍是 `PENDING`、不写流水；`reject` 在任何账号状态下都成功
- [ ] 额度对账发现 `balance != SUM(delta)` → 写一条 `CREDIT_LEDGER_MISMATCH` 告警（同一账号一条 `OPEN`），下次对账一致时自动 `RESOLVED`

**通话时长与模型档位**
- [ ] 通话额度：没有任何有效权益的账号，适用的键（日、月、终身）都没有配置 → 发起会话 403 `FEATURE_LIMIT_REACHED`（"通话额度未配置"）；只配其中一个 → 只受这一个约束，另一个不限制；某个键配成 `UNLIMITED` → 明确不限
- [ ] 终身额度：账号创建时 `call.lifetime_minutes` 已配置 → `User.lifetimeGrantSeconds` 记入当时的值，之后改配置不影响已创建的账号；创建时没配置的账号，配置之后第一次发起会话时记入；只有发起时没有任何有效权益的会话（`freeTier=true`）累计 `lifetimeUsedSeconds`；用完 → 403，`data.limit=LIFETIME`，没有 `resetAt`；订阅期间的通话不计入，订阅过期后剩余额度接着用；终身、日、月额度可以任意组合，任何一个用完都不能通话
- [ ] 日额度用完 → 403，`data.limit=DAILY`，`resetAt` 是下一个本地 0 点；本地日按 `User.timezone`；`deadlineAt` 不晚于日窗口结束时间；日额度和月额度同时配置时任何一个用完都不能通话，`deadlineAt` 取剩余分钟较小者
- [ ] 响应带 `remainingSeconds`，等于响应生成时刻到 `deadlineAt` 的秒数（向下取整），不为负
- [ ] `deadlineAt` 所有会话都有：不受限额约束的账号等于硬上限 `session.max_duration_minutes`，`quotaLimited=false`；受限账号取剩余额度、用量窗口结束时间和硬上限中最早者，`quotaLimited=true`；本用量周期已用完 → 403 `FEATURE_LIMIT_REACHED`，不创建 Session、不 dispatch
- [ ] 订阅用户的额度按订阅计费周期重置，不按自然月：月中订阅后立即拿到完整额度，订阅前的通话不计入；续订后额度重新开始
- [ ] Apple 升级（新计费周期）和 Google 换档（新订阅）后额度重新开始；降级不影响当前窗口
- [ ] 订阅过期回到免费：订阅期间的通话不计入免费额度，窗口起点为 `max(UTC 月初, 订阅权益结束时间)`
- [ ] 限额账号的通话不会跨过窗口边界：在月末最后几分钟开始的通话，`deadlineAt` 不晚于窗口结束
- [ ] 同一账号同一时刻只有一个进行中的会话：并发两次 `POST /api/sessions` 不会让总通话时长超过剩余额度；第二次发起时旧会话的房间被删除并收尾
- [ ] 通话被后端到点强制结束后，养成统计（`interactionCount`、streak、`first_session`、`day_N`）照常触发一次；之后到达的 webhook 被忽略，不重复；到点扫描删除房间时房间不存在视为成功；用户从未加入的 Session 被丢弃、不触发养成统计（15.6）
- [ ] 通话中续订或升级使窗口/生效值改变 → 进行中会话的 `deadlineAt` 被延长，不被缩短
- [ ] 权益失效后已有资产数量超过新上限 → 已有资产保留、当前指针不变，只是不能新建
- [ ] 多个权益的 `LIMIT` 取 `max(默认值, 各权益的值)`，权益配置值低于免费默认值时用户上限不低于免费用户
- [ ] 管理后台：`PUT /feature-gates/{key}/credit-cost` 设置后用户才能用额度购买该开关；`GRANT` 申请的 `delta` 不为正 → `INVALID_REQUEST`，`ADJUST` 申请通过后可使余额为负（申请与审核流程见 15.9）；保存 `chat.model_tier` 的值不在 `chat.model_tiers_allowed` 里 → `INVALID_REQUEST`；`GET /api/credits/ledger` 分页返回该账号流水
- [ ] 通话到 `deadlineAt` 仍未结束 → 后台任务删除 LiveKit 房间并结束会话；之后 webhook 到达按幂等规则忽略
- [ ] dispatch metadata 含 `modelTier`，取自 `chat.model_tier` 的生效值；通话进行中权益变化不影响当前通话
- [ ] 同一账号在两个渠道各有订阅 → `GET /api/entitlements` 的 `subscriptions` 列出全部，权益取最高档、不叠加

**记忆服务**
- [ ] `PUT /memory/tiers/{name}` 需要 `MEMORY:TIER_CONFIG`，未给出的字段保持原值，写审计日志；AvatarMemory 不可用 → 502 `MEMORY_SERVICE_ERROR`，其他功能不受影响
- [ ] 注册模型需要 `MEMORY:MODEL_REGISTER`；同名不同维度 → AvatarMemory 的 409 原样展示
- [ ] 手动指派账号的 embedding 模型需要 `MEMORY:MODEL_ASSIGN`，写审计日志并记一条 `AccountEmbeddingAssignment`；没有任何自动指派
- [ ] AvatarMemory 返回 422 → `INVALID_REQUEST`；409 → `MEMORY_MODEL_CONFLICT`；401/5xx/网络错误 → 502 `MEMORY_SERVICE_ERROR`
- [ ] `PUT /memory/tiers/{name}` 名字不存在时，页面先确认再新建；把 `memory.tier` 的默认值设为不存在的档位 → `INVALID_REQUEST`
- [ ] 档位同步：任务执行时读取当前生效档位（入队后又变化时以最新为准）；同一账号至多一个待执行任务；账号 `DELETING` 或不存在时放弃且不调用 AvatarMemory；与账号删除第 1 步通过 `memory_sync:{accountId}` 互斥；404 → `FAILED` 不重试并写 `MEMORY_SYNC_FAILED`（`refType=ACCOUNT_MEMORY_TIER`）；其他错误按退避重试且不放弃
- [ ] 档位名或模型名含 `/`、空格或超过 64 个字符 → 400；管理后台写接口 AvatarMemory 失败时本后端不写 `AccountEmbeddingAssignment`；AvatarMemory 的 404 映射为 404 `RESOURCE_NOT_FOUND`
- [ ] `GET /accounts/{id}/memory` 返回当前档位指派和模型指派历史，不存在的账号 → 404 `RESOURCE_NOT_FOUND`

**监控与后台**
- [ ] `POST /api/internal/pipeline-metrics` 签名无效 → `INVALID_SIGNATURE`；缺省除 `reportedAt`/`source` 外的字段 → 成功
- [ ] `POST /api/internal/usage`：签名规则同 1.8（`llm-usage`、`avatargen-usage`、`render-usage` 各用自己的密钥），签名无效 → 401 `INVALID_SIGNATURE`；`records` 为空或超过 `usage.max_batch` → 400；`cachedInputTokens` 大于 `inputTokens`、`guest=true` 带了非空 `accountId`、`guest=false` 的 `accountId` 为空（`""`、`null`、没带字段都算空）、`CALL` 的 `sessionId` 为空、`TEXT` 且 `guest=true` → 400；`guest=true` 的 `accountId` 用 `""`、`null`、不带字段、`TEXT` 的 `sessionId` 用 `null`、`""`、不带字段，都入库且按空存；任何一条不合法 → 整个请求 400、不入库任何一条，`data.index` 指向第一条不合法记录（从 0 起）；同一 `recordKey` 重复提交只入库一条，响应 `skipped` 计数；每分钟超过 `usage.rate_limit_per_min` → 429，带 `Retry-After`（整数秒，等于限流窗口还剩的秒数，至少 1）和 `data.retryAfterSeconds`；被封禁、正在删除的账号和不存在的会话产生的用量照常入库，账号已不存在或处于 `DELETING` 时 `accountId`、`sessionId` 按空存；每条上报都更新 `UsageModel.lastSeenAt`，没有登记的模型自动新建
- [ ] 通用用量（14.2）：每条记录缺 `resourceType` 或取值不在表里 → 400；调用方标识报了不属于它的资源类型（例如 `avatargen-usage` 报 `LLM`、`llm-usage` 报 `IMAGE_EDIT`）→ 400；非 LLM 记录缺 `quantity`、为负或超过 `usage.max_quantity_per_record` → 400；`GENERATION` 记录 `accountId` 为空时入库，`tier=SYSTEM`；非 LLM 记录的费用 = `quantity × unitPrice`，取 `(resourceType, provider, model, unit)` 的生效批次；没有价格 → `costAmount` 为空并有 `USAGE_PRICE_MISSING` 告警；`/stats/usage-cost` 按 `resourceType` 分列
- [ ] LLM 费用：按 `inputTokens` 选档（档位整数、两端包含，第一档下限 0，下一档下限 = 上一档上限 + 1，最后一档上限为空），`(inputTokens − cachedInputTokens) × 输入价 + cachedInputTokens × 缓存输入价 + outputTokens × 输出价`（每百万 token，十进制，保留 10 位小数）；同一模型有多个 `effectiveFrom` 不晚于 `at` 的 `ACTIVE` 批次时取 `effectiveFrom` 最晚的；记录里存下 `costAmount`、`costCurrency`、`priceId`；之后新建、取代、撤回价格批次都不改已入库记录的费用；没有价格的模型：记录入库、费用为空，写一条 `USAGE_PRICE_MISSING`（同一模型只写一条）；`effectiveFrom` 不晚于今天的批次生效后，只补算该模型费用为空、`at` 不早于这批 `effectiveFrom` 的记录并重新落地受影响的日期，告警关闭；将来日期的批次不关闭告警；价格表的行不可被修改（编辑 = 新批次，同模型同生效日期的新 `ACTIVE` 批次把旧批置 `SUPERSEDED`）；手填或确认的档位有缺口、重叠、第一档下限不是 0、最后一档上限不为空 → 400；币种不在 `usage_price.allowed_currencies` → 400
- [ ] 价格同步：每天一次，对 `syncAdapter` 非空的模型读阿里价格接口，没有任何模型配了适配器时不运行、不写告警；内容与最新待审批次相同不生成；与最新 `ACTIVE` 批次相同而存在待审批次 → 该待审批次置 `SUPERSEDED`；与最近驳回的相同不重新生成；其余生成 `PENDING_REVIEW` 批次并取代旧的待审批次；待审批次不会自动生效，`POST /usage/price-batches/{batchId}/confirm` 后才被费用计算选中（按 `effectiveFrom`）；`reject`、`retire` 不带备注 → 400；没有 `DASHSCOPE_PRICE_API_KEY` 或接口失败 → `LLM_PRICE_SYNC_FAILED`（`refId=ALL`），下一次成功后自动关闭；`usage_price.source_url` 不是 https 或主机不在白名单 → 400；没有 `COST:PRICE` 不能确认、驳回、撤回、手填、改模型登记；`syncAdapter` 不是 `DASHSCOPE_INTL` 或空 → 400
- [ ] 成本报表：`GET /stats/usage-cost` 需要 `COST:VIEW`，导出需要 `STATS:EXPORT` 加 `COST:VIEW`；不同币种分开返回，不相加；费用为空的请求归在 `currency=NONE` 的行，`unpricedRequests` 等于当日费用为空的请求数；统计日是 `at` 的 UTC 日；补算费用后受影响的日期被重新落地；早于 `usage.retention_days` 的日期不重算，保留已落地的值；账号删除后该账号的 `usage_log` 记录 `accountId`、`sessionId` 为空，费用和 token 数保留；数据导出（13.3）带 `usage.json`，不含费用和价格
- [ ] 用户 JWT 调 `/api/admin/**` → 拒绝；管理员 JWT 调用户接口 → 拒绝
- [ ] `GET /api/admin/me` 返回权限码，另含 `id`（字符串）和 `passwordMinLength`（整数，等于 `admin.password_min_length` 的当前值）；`mustChangePassword=true` 的管理员只能调 `me` 和改密码，其余 403 `ADMIN_FORBIDDEN`
- [ ] `GET /api/admin/meta`：只持有 `ABUSE:VIEW` 的管理员调得 200 且含 `abuseClusterMinFreeAccounts`；`mustChangePassword` 为真 → 403 `ADMIN_FORBIDDEN`；响应字段集合恰好是 17.4 列的那二十个；值是当前生效值，前十二个里没有默认值又未配置的键为 `null`，后八个上传限制都不为 `null`，其中 `uploadMaxBytes`、`adMediaMaxBytes`、`apkMaxBytes`、`renderAssetMaxBytes` 等于对应配置键的当前值（改键之后下一次请求已变），另四个是 2097152、36000000、36000000、250000000；不写审计日志
- [ ] 广告素材上传：图片宽×高超过 36000000 → 400 `INVALID_FILE`，不解码，文件被删；视频不受这条限制
- [ ] `PUT /api/admin/config/{key}`：缺少该键的编辑权限 → 403；值不合法 → `INVALID_REQUEST`；成功后配置立即生效并写审计日志
- [ ] 账号删除后：`ModerationRecord` 的举报文字已清空、`PushTask.accountIds` 不再含该账号
- [ ] 缺少所需权限码 → 403；`superAdmin` 不受权限码限制；封禁、审核决定、推送创建等写操作均有审计日志
- [ ] 管线指标上报：`gpuUtilization` 大于 1、`errorCount` 为负、`source` 含非法字符 → 400；`reportedAt` 晚于当前 5 分钟以上按收到时间处理；同一 `(source, reportedAt)` 重复上报 → 200 且只有一行；`GET /monitor/pipeline` 范围超过 `monitor.max_range_days` → 400，超过 `monitor.max_points` 条时返回最近的并带 `truncated:true`；超过 `pipeline_metrics.retention_days` 的行被每天的清理任务删除
- [ ] LLM 用量上报：缺 `guest`、缺 `at`、`provider` 或 `model` 为空白、token 字段为小数或字符串、超过 `usage.max_tokens_per_record` → 整批 400 且 `data.index` 指向第一条不合法的记录（从 0 起）
- [ ] 价格批次：`confirm` 一个不是 `PENDING_REVIEW` 的批次 → 409 `INVALID_STATE`；`retire` 一个不是 `ACTIVE` 的批次 → 409；不存在的 `batchId` → 404 `RESOURCE_NOT_FOUND`；并发两个 `confirm` 只有一个成功；同一 `(resourceType, provider, model, unit, effectiveFrom)` 只会有一个 `ACTIVE` 批次；手填价格为负数、超过 10 位小数、币种不在白名单、档位数超过 `usage_price.max_bands` → 400；费用按 `HALF_UP` 舍入到 10 位小数，只对总费用舍入一次
- [ ] 补算：批次生效（`confirm`）后该模型 `costAmount` 为空的记录被补算；每天 00:10 对仍有 `OPEN` 的 `USAGE_PRICE_MISSING` 告警的模型再补算一次；补算分批、可中断续跑
- [ ] 账号状态矩阵：对 `BANNED` 再封禁、对 `ACTIVE` 解封 → 409 `INVALID_STATE`；封禁、解封在 `PENDING_DELETION` 和 `DELETING` 都是 409 `INVALID_STATE`；发放限时权益、创建或通过额度申请、指派 embedding 模型在 `PENDING_DELETION` → 403 `ACCOUNT_DELETION_SCHEDULED`，在 `DELETING` → 403 `ACCOUNT_DELETING`；撤销限时权益在 `PENDING_DELETION` 成功、在 `DELETING` → 403 `ACCOUNT_DELETING`；账号不存在 → 404 `RESOURCE_NOT_FOUND`
- [ ] 后台代用户发起删除：`USER:DELETION` 权限，`reason` 必填，`AccountDeletion.requestedBy` 记管理员 ID，同样走宽限期；对 `PENDING_DELETION` 再发起 → 409 `INVALID_STATE`；后台取消只在 `SCHEDULED` 时成功；写审计日志且 `detail` 不含用户内容
- [ ] 已停用（`DISABLED`）的管理员用正确的密码登录 → 401 `ADMIN_INVALID_CREDENTIALS`，与密码错误不可区分；其已发出的令牌下一次请求被拒
- [ ] 告警：`CREDIT_LEDGER_MISMATCH`、`MEMORY_SYNC_FAILED` 等 `refId` 是账号 ID 的告警同时带 `accountId`，账号删除后这些行（含 `RESOLVED`）被清除；`POST /alerts/{id}/resolve` 需要 `MONITOR:MANAGE`，只有 `MONITOR:VIEW` 的管理员 → 403 `ADMIN_FORBIDDEN`
- [ ] `GET/PUT /moderation/text-rules` 只有 `MODERATION:CONFIG` 能调用
- [ ] `PUT /moderation/text-rules` 整表替换：带 `id` 且在当前词表里的元素沿用该 `id`，不带 `id` 或 `id` 不在当前词表里的是新增，请求里没有的被删除；任何一项不合格整表都不保存，`data.details` 的 `ref` 是该元素在请求数组里的下标；`REGEX` 编译失败 `reason=INVALID_PATTERN`；条数超过 `moderation.text_rules_max` 时 `details` 只有一项（`ref=items`，`reason=OUT_OF_RANGE`）
- [ ] 每天一次的清理任务：过期的 `RefreshToken`、`PasswordResetToken`、`DeletionToken` 被删除；`GenerationTask.idempotencyKey` 在 24 小时后置空；墓碑、无账号终结订阅、`PipelineMetricSnapshot` 按各自保留期清理
- [ ] 统计：账号之后被删除的 cohort，已落地的行不改；`activeSubscriptions` 包含无账号的订阅行
- [ ] `FeatureGate` 启动同步：新增的 key 被插入，`defaultValue` 取代码里的默认值；已存在的 key 不覆盖后台改过的 `defaultValue` 和 `creditCost`；代码里不再声明的 key 保留并写警告日志
- [ ] `ADMIN_TOTP`：`enrollToken` 存 Redis，`enroll` 成功才写 `totpSecretEnc`、`totpEnrolledAt`、`lastLoginAt`；`superAdmin` 只有超级管理员能设置，不能改自己的角色，不能清除最后一个启用的超级管理员；管理员用户名重复（不区分大小写）→ 409 `DUPLICATE_RESOURCE`；响应不含任何以 `Hash`、`Enc` 结尾的列；封禁 `reason` 缺失或超过 500 个字符 → 400，解封后 `banReason`、`bannedAt` 为空
- [ ] `PUT /config/{key}`：布尔键提交非布尔、受“不小于 1”规则覆盖的整数键提交 0 或负数（`avatar.source_photo_retention_days` 等 0 是合法值的键除外）、违反关系约束（`retry.initial_seconds > retry.max_seconds` 等）→ 400；`admin.totp_required` 生产保存 `false` → 400；`chat.conversation_languages` 不含 `en` → 400；`events.ttl_days` 小于 `30 + stats.land_window_days` → 400；`auth.refresh_ttl_days` 小于访问令牌有效期 → 400
- [ ] 形象生成相关的配置范围（17.5）：`generation.max_attempts` 保存 0 或 11、`moderation.underage_reject_below_age` 保存 -1 或 101、`moderation.face_min_det_score` 保存 0.09 或 1.01、`generation.mouth_open_min_area` 保存 0、`generation.mouth_open_min_brightness` 保存 256 → 400 `INVALID_REQUEST`；服装、背景、动作条目的 `generationSpec` 去掉首尾空白后为空或超过 2000 个码点 → 400 `INVALID_REQUEST`
- [ ] 后台推送图片上传返回 `uploadId`，模板和任务只接受 `uploadId`；`GET /sessions` 的“到点强制结束”按 `endReason=DEADLINE` 筛选；预设注册漏斗用 `deviceId` 回溯合并匿名事件和带账号事件；`StatLandJob` 对 `event_log` 已过期的日期跳过、不清空已落地的行；`StatAttributionDaily.registered` 只含 `source=SELF` 且有投放账户的记录

### 管理后台新增与统计汇总层（17.2、17.3、17.6）

- [ ] 管理员登录：账号密码正确、已绑定、不带 `totp` → 401 `ADMIN_TOTP_REQUIRED`；验证码错误，或同一步长内同一验证码第二次提交 → 401 `ADMIN_TOTP_INVALID`；同一用户名连续 5 次验证码错误 → 5 分钟内 429 `RATE_LIMITED`
- [ ] 未绑定二次验证的管理员登录 → 200 `ENROLL_REQUIRED`；`enroll` 成功才返回 JWT；`enrollToken` 复用或过期 → 失败
- [ ] 生产环境 `admin.totp_required=false` → 启动失败；数据库里 `totpSecretEnc` 不是明文，换掉 `ADMIN_TOTP_ENC_KEY` 后不能解密
- [ ] 管理员被停用、重置密码、重置二次验证后，已签发的令牌 → 401 `ADMIN_INVALID_TOKEN`；不能停用自己；最后一个启用的超级管理员不能被停用
- [ ] 删除仍分配给管理员的角色 → 409 `ROLE_IN_USE`；修改角色的权限后，在 `admin.permission_cache_seconds` 内对该角色的管理员生效；`GET /permissions` 包含代码里声明的全部内置码
- [ ] 权限树：内置节点改 `code`、`parent` 或删除 → `INVALID_REQUEST`，改名称和排序成功且重启后不被覆盖；新增的自定义节点可以分配给角色；删除有子节点的节点 → 409 `PERMISSION_HAS_CHILDREN`；删除自定义节点后角色授权行一并清理；代码里新增一个权限码，重启后表里出现、名称取默认值；没有 `PERMISSION:MANAGE` 的管理员 `POST/PUT/DELETE /permissions` → 403 `ADMIN_FORBIDDEN`，写操作有审计日志
- [ ] 没有 `USER:EMAIL_VIEW` 的管理员在用户列表和详情里看到掩码邮箱，有则看到完整邮箱；按邮箱模糊筛选不返回结果
- [ ] 没有 `USER:PHONE_VIEW` 的管理员在用户列表和详情里看到掩码手机号（只留末 4 位），有则看到完整号码；手机号筛选只接受完整号码的精确匹配，不同写法的同一号码命中同一个账号
- [ ] 额度调账：申请人审核自己的申请 → 403 `SELF_REVIEW_FORBIDDEN`；同一申请重复审核 → 409 `INVALID_STATE` 且不重复写流水；通过时流水 `reason` 为 `ADMIN_GRANT` 或 `ADMIN_ADJUST`、`eventKey` 为申请 ID；`GRANT` 的 `delta` 不为正 → `INVALID_REQUEST`；驳回不带 `note` → `INVALID_REQUEST`
- [ ] 带 `deviceId` 注册成功 → 对应 `GuestDevice.convertedAt`、`convertedAccountId` 只在第一次写入；设备记录不存在 → 不报错；创建账号的请求（邮箱注册、Google/Apple 新建、手机号新建）不带 `deviceId` → 400 `INVALID_REQUEST`
- [ ] 发起会话因额度用完（账号 `FEATURE_LIMIT_REACHED`，游客 `GUEST_QUOTA_EXHAUSTED`）、agent 不可用失败，各记一条 `session_start_failed`；用户一直没进入房间被丢弃记 `session_discarded`；`Session.requestedAt` 在 agent 加入后不变，`startedAt` 变
- [ ] 7.3 里后端产生的事件（含 `ad_reward_granted`、`phone_otp_sent`、`invite_reward_granted`、`text_turn_completed`、`text_turn_failed`）都写入 `event_log` 且 `source=SERVER`（后端事件不经过接收接口，7.1）；后端产生的事件客户端不重复上报
- [ ] 导出：`GET /stats/export/daily` 返回 `.xlsx`，行数和对应报表一致，表头随 `Accept-Language` 切换；没有 `STATS:EXPORT` → 403；有 `STATS:EXPORT` 但没有该报表的查看权限 → 403；超过 `export.max_rows` → 400；每管理员每小时超过 `ratelimit.export_per_admin_per_hour` → 429；`invite-records` 导出里没有完整邮箱、手机号和 IP；每次导出有审计日志；令牌放在 `Authorization` 头，URL 里没有令牌
- [ ] 渠道维度：`/stats/daily?channel=play` 只含渠道 `play` 的事件类和业务类指标，`channel=ALL` 事件类指标独立去重、业务类指标等于各渠道之和；没有渠道的数据在 `unknown`；`channel≠ALL` 时 `activeSubscriptions` 为 `null`；客户端上报的 `channel`（游客创建、`client.channel`、事件 `context.channel`）格式不合法时被丢弃、不报错，版本检查的 `channel` 格式不合法时返回 `hasUpdate=false`（24.3）；`/stats/retention?channel=` 的 cohort 渠道取账号的注册渠道（`User.channelCode`），`/stats/guest/retention?channel=` 取 `GuestDevice.channelCode`
- [ ] 汇总幂等：同一日重复落地结果不变；跨午夜才结束的通话在窗口内被计入前一天；早于 `event_log` 现存最早记录的日期补数 → 400 `INVALID_REQUEST`（改大 `events.ttl_days` 之后同样成立）
- [ ] 同一账号同一天在 ANDROID 和 IOS 都有 `app_open`：两个平台行各计 1，`ALL` 行计 1；`/stats/daily?platform=ANDROID` 的业务列为 `null`
- [ ] 留存：cohort 为 `D` 的账号，`d7` 在 `D+7` 日落地之前为空，落地后只统计 `D+7` 当天出现的人，不含 `D+1` 到 `D+6`
- [ ] `activeSubscriptions` 是日末快照：窗口重算和手动补数之后不变
- [ ] `StatReconcileJob` 在人为制造差异时写 ERROR 日志
- [ ] 报表跨度超过 `stats.max_range_days` → `INVALID_REQUEST`；手动补数写审计日志，没有 `STATS:LAND` → 403 `ADMIN_FORBIDDEN`；手动补数和定时任务不会同时对同一日期执行
- [ ] 只持有 `COMPANIONSHIP:CONFIG` 的管理员调 `GET /config` 得到 200，且只含 `companionship.*`、`milestone.*` 键；只持有 `PUSH:CONFIG` 的只含推送相关键；只持有 `INVITE:CONFIG` 的只含 `invite.*` 键；`GET /api/admin/me` 含 `mustChangePassword`
- [ ] 下拉选项来源接口（17.4 附·通则第 5 条）：只持有新增的那个码的管理员调用 → 200，响应与原权限调用相同——`GET /roles` 只持有 `ADMIN:MANAGE`；`GET /cosmetics` 只持有 `COSMETIC:GRANT`；`GET /attribution/campaigns` 只持有 `ATTRIBUTION:VIEW`；`GET /ads/campaigns` 只持有 `ADS:UNIT` 或只持有 `ADS:CREATIVE`；`GET /ads/placements` 只持有 `ADS:UNIT`；`GET /ads/units` 只持有 `ADS:CREATIVE`；`GET /entitlement-defs` 只持有 `SUBSCRIPTION:GRANT`；只持有无关的码 → 403 `ADMIN_FORBIDDEN`；这些接口对应的写入接口权限不变
- [ ] 响应里的管理员用户名：每个管理员 ID 字段旁边有对应的用户名字段（`xxxBy` → `xxxByUsername`，`adminId` → `adminUsername`，`applicantAdminId` → `applicantUsername`，`reviewerAdminId` → `reviewerUsername`）；管理员被删除后用户名为 `null`、ID 照旧；`AdminAuditLog` 写入时记下当时的用户名，管理员改名或被删后已写的行不变
- [ ] 后台响应里的图片地址：服装和背景目录有 `previewUrl`，动作目录有 `iconUrl`，默认数字人有 `sourceImageUrl`、`previewUrl`，`GET /accounts/{id}/avatars` 的每个外观有 `previewUrl`，都不再返回对应的存储引用列；地址是短时效签名地址，文件缺失为 `null`；`GET /accounts/{id}/avatars` 每次调用写一条审计日志
- [ ] 字段表（17.4 附）里点名的接口，响应字段集合恰好等于表里写的字段，没有多出的列；管理端字段按 1.9 去首尾空白后的 Unicode 码点数计长度，去掉空白后为空的必填字段 → 400 `INVALID_REQUEST`，存的是去掉空白后的值
- [ ] 留存分群：账号留存的 cohort 取注册日（`User.createdAt` 的 UTC 日），`platform` 取 `User.registerPlatform`；游客第 0 天首次出现、第 10 天注册 → 第 0 天的游客留存 cohort 含这台设备，第 10 天的账号留存 cohort 含这个账号，已落地的第 0 天账号 cohort 不变（没有回溯）；账号被删除不改动已落地的行；天数为 1、3、5、7、14、21、30、60、90，游客转化队列为 d0、d1、d2、d3、d5、d7、d14、d30
- [ ] 活跃口径：`dau` 数当日有任意 `source=CLIENT` 事件的去重账号，后端事件（`push_sent`、`milestone_reached` 等）不计入；`dauDevices`、`wau`、`mau`、`ACTIVE` 留存、回流同口径；游客留存：cohort 是 `GuestDevice.firstSeenAt` 的 UTC 日，第 N 天按 `deviceId` 的 SHA-256 与 `deviceIdHash` 比对，匿名事件和带账号的事件都算，已转注册的设备照常计入
- [ ] `activeSubscriptions`：每天只在该日行缺失时写入；窗口重算和手动补数不覆盖已有的值；任务当天失败，该日返回 `null`，补数写入的行 `backfilled=true`
- [ ] 回流：只统计 `source=CLIENT` 的任意客户端事件，后端事件（`push_sent` 等）不使人从沉默变回流
- [ ] 通话质量：用户重复点击发起通话（后一个请求取代前一个）不记 `session_start_failed`；dispatch 抛异常记 `reason=DISPATCH_FAILED`；接通耗时的四档互斥，总和等于 `connected`
- [ ] `PushDelivery.result` 只会是 `ACCEPTED`、`INVALID_TOKEN`、`FAILED`；推送效果的送达成功数只数 `ACCEPTED`
- [ ] 事件时间：客户端上报的 `occurredAt` 被存为 `clientTime`，统计日和保留期取 `receivedAt`；同一批事件的先后靠 `seq` 保持；事件记录带 `ip` 和 `country`（没有 GeoIP 时 `country` 为空）；修改 `events.ttl_days` 后新写入的记录用新值、旧记录不变；账号删除后该账号的事件（含 `ip`）已删除；漏斗接口带 `from`、`to`，超过 `analytics.live_max_range_days` → `INVALID_REQUEST`
- [ ] 后台告警：账号删除连续失败超过阈值、Google 订阅未确认、额度购买未消耗、入账前已被消耗、档位同步失败、短信每日总量达到上限（`SMS_DAILY_CAP_REACHED`，次日 UTC 零点自动 `RESOLVED`），各写一条 `OPEN` 的 `AdminAlert`，同一对象不重复写，对象恢复后自动 `RESOLVED`（`CREDIT_CONSUMED_BEFORE_CREDITED` 只能人工关闭）
- [ ] `PUT /entitlement-defs/{key}/features` 的 `UNSET` 删除配置行，`UNLIMITED` 与"未配置"在 `GET /accounts/{id}/entitlements` 里生效值不同

---

## 二十一、实现依赖顺序

以下只列**什么必须先存在**，不是分阶段：全部内容一次交付。

| 依赖 | 被依赖方需要它的原因 |
|------|---------------------|
| 数据库迁移（PostgreSQL 全部实体、MongoDB 集合和 TTL 索引、`AdPlacement` 四行（22.2）、18 节的唯一键和索引），以及启动时的种子逻辑（`AdminPermission` 内置权限树和 `FeatureGate` 声明（17.3、18）、预设 `SavedFunnel`、`Channel` 三行（需要读 `GOOGLE_PLAY_PACKAGE_NAME`、`APPLE_BUNDLE_ID`，24.7）；`EmailTemplate` 的默认文案在代码里，没改过时用它，不入库） | 所有模块 |
| 认证（含 refresh、第三方登录、账号状态） | 所有需要登录的接口，以及 admin 的封禁 |
| Play Integrity 与 iOS App Attest 的凭证和开通 | 游客凭据（2.1）和所有新账号（2.2、2.7、23.2）：没有它们生产环境不能创建任何账号，游客也拿不到凭据 |
| 审核服务适配器（11.2） | 资产上传任务、聊天写入、文字对话（5.4）、persona、伴侣名字（2.5.1） |
| 会话、聊天记录、养成数据 | 召回推送（读 `CompanionshipStats`）、账号删除（要删的数据） |
| 反向代理对 `/go/` 的转发、归因链接的域名、`attribution.*` 的商店链接；受信任反向代理头（指纹兜底依赖客户端 IP，丢弃客户端自带的 `X-Forwarded-For`）；直接下载 APK 的落地页（含签名块注入脚本，同源部署，10.4 第 6 条） | 自建归因的点击跳转和 APK 下载归因（10.4）；没有它们归因链接和 APK 下载归因不能用 |
| AppsFlyer 的 Push API 订阅、控制台端点配置、服务器 IP 白名单 | iOS 和 AppsFlyer 渠道的归因（10.1）；Push API 是付费高级功能 |
| 额度流水（15.9）、会话结束流程（15.6）、文字对话（5.4） | 每日签到和每日任务的奖励与进度（28） |
| 推送 token 与偏好（含游客 token） | 召回推送、手动推送、周期推送（8.5） |
| 订阅与权益（第十五节） | 上传上限校验（3.2）、发起会话（4.1：通话额度和 `chat.model_tier`）、文字对话（5.4 第 7 步：文字额度）、`GET /api/entitlements`、AvatarMemory 档位同步（15.6）、管理后台订阅模块 |
| 防滥用标记 `AbuseMarker`（13.5）、注册审计 `RegistrationAudit`（2.2）、环境变量 `ABUSE_HASH_KEY`（1.5，无默认值） | 所有创建新账号的路径（2.2、2.7、23.2）、邀请奖励评估（9.1）、账号删除第 6 步、多开检测（17.4）；会话、聊天记录、养成数据本身不依赖它们 |
| 环境变量 `FCM_CREDENTIALS`、`ATTRIBUTION_TOKEN_ENC_KEY`、`LLM_USAGE_SIGNING_SECRET`、`AVATARGEN_USAGE_SIGNING_SECRET`、`RENDER_USAGE_SIGNING_SECRET`、`DASHSCOPE_PRICE_API_KEY`、`APPSFLYER_ENDPOINT_SECRET`、`TTS_SERVICE_URL` 与 `TTS_ADMIN_API_KEY`、`REFRESH_GRACE_ENC_KEY` | 各自对应的功能（推送与验证码推送投递、投放账户令牌加密、LLM 用量上报、价格同步、AppsFlyer 回传端点、声音克隆、刷新令牌宽限，1.5）；缺失时对应功能不可用或启动失败，具体方式见各节 |
| 环境变量 `JWT_SECRET`、`ADMIN_JWT_SECRET`、`INTERNAL_SIGNING_SECRET`、`PIPELINE_SIGNING_SECRET`、`LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`/`LIVEKIT_AGENT_NAME`、`ADMIN_BOOTSTRAP_USERNAME`/`ADMIN_BOOTSTRAP_PASSWORD`、`DEPLOY_ENV` | 缺失时启动失败（1.5、1.8）；没有它们认证、会话和管理后台都不能用 |
| Apple 与 Google 的服务端凭证（App Store Server API 密钥、Play 服务账号）和 Pub/Sub 配置 | 订阅通知接收、购买验证与对账（15.5、15.7） |
| AvatarAgent 实现 `POST /v1/chat/turn` 和 `POST /v1/chat/ingest`（5.4：SSE 流式回复、检索记忆、写入记忆、使用 `persona`/`companionName`/`modelTier`/`language`） | 文字对话；`AGENT_CHAT_URL` 没配置时 `POST /api/chat/messages` 返回 503 `AGENT_UNAVAILABLE`，配置了但对方没实现时每一轮以 `error` 事件结束；通话不受影响 |
| AvatarAgent、形象生成服务、云端渲染服务按 14.2 上报用量（`POST /api/internal/usage`，带 `resourceType`） | 成本报表；对方未实现之前对应的资源类型在报表里为空，其余功能不受影响 |
| AvatarAgent 接受 dispatch 的 `modelTier` 并映射到模型 | `chat.model_tier`（4.1）；对方未实现之前该开关不生效，其余功能不受影响 |
| AvatarMemory 的两把密钥 | 档位同步、档位配置、模型注册与指派（第十六节） |
| 各领域 Service 存在 | admin 模块（Facade 编排它们） |
| 事件目录（7.3）、`Session.requestedAt`、`GuestDevice.convertedAt`、`GuestDevice.platform` 与 `channelCode`、`User.registerPlatform` 与 `channelCode`、`Channel`（24.7）、广告展示记录和无广告计数（22）、自建归因的点击与认领（10.4）、`PushRecord` 与 `PushDelivery`、`usage_log`、`CheckinRecord`、`TaskRecord`、定时任务运行环境与分布式锁 | 统计汇总层（17.6），再往后是统计报表和管理后台的总览页 |
| 环境变量 `ADMIN_TOTP_ENC_KEY` | 管理员二次验证绑定与登录（17.2）；未配置时生产环境启动失败 |
| 管理后台网页的域名和反向代理（与 `/api` 同域） | 管理后台上线 |
| 短信供应商选型与适配器、`SMS_CRED_ENC_KEY`、允许的国家列表和每日上限 | 手机号登录上线（第二十三节）；之前 `auth.phone_login_enabled` 保持 `false` |
| 环境变量 `OTP_HMAC_KEY`（验证码哈希密钥） | 邮箱注册验证码（2.2.1，必需）和手机号验证码（23.3） |
| GeoIP 数据库、素材存储 | 广告的地理定向、素材上传（22.11）、事件记录和广告展示记录里的 `country`（7.1、22.3）；之前 `geo` 定向不生效、素材不能上传、`country` 为空 |
| 邀请落地页、`inviteLinkBase` 的域名、`/.well-known/assetlinks.json` 托管和签名证书指纹 | 邀请链接分享与 App Links（9.2）；没有它们 `inviteLink` 为 `null`、App Links 不生效 |
| 订阅与权益（第十五节）、额度（15.9） | 广告的激励奖励（`AD_REWARD` 流水）、"去广告"权益（`ads.removed` 功能开关） |
| 推送（第八节）、内容审核（11.4）、数据导出（13.3）、订阅状态（15.4）、生成任务（3.3） | 站内通知的推送附带（25.4）和五类系统事件通知的产生点（25.3）；推送载荷的 `notification` 类型和页面标识清单（8.3）要先存在 |
| 反向代理对 `/notify/` 的转发 | 短信送达回执（23.5）；没有它，送达状态永远停在 `PENDING` |
| 推送 token 与发送（第八节） | 站内通知的"同时推送"（25.4） |
| 隐私政策等页面的域名与内容 | 客户端远程配置的内容（26.2）；之前入口不显示 |
| 邮件服务商选型与凭证 | 邮箱注册验证码（2.2.1）和密码重置发信（2.9）；未选定前邮箱注册和 `password/reset-request` 都无法真正发信，`email/otp/send` 返回 503 `EMAIL_SEND_FAILED` |
| 网页删除页面和密码重置页的域名与托管 | 网页删除入口（13.4，Google Play 的强制要求）、密码重置页（2.9）、`email.link_base_url`；没有它们，重置和删除确认邮件都发不出去 |
| 部署方案（共享文件存储、Redis、受信任反向代理） | 文件存储（1.1）、限流（1.6）、作废登录链集合与刷新令牌宽限（2.6）、验证码（2.2.1、23.3）、文字对话锁（5.4）、AvatarMemory 同步锁（16.1）、广告元数据与计数（22）、应用版本与客户端配置缓存（24.3、26.1）、内部调用的 nonce 重放保护（1.8）、短信回执暂存（23.5） |
| **AvatarMemory、形象生成服务的删除/导出接口（13.2）** | 账号删除的步骤 1 和 3、资产删除时形象的外部清除、数据导出；这两个接口不存在时，账号会停在 `DELETING`，导出无法完成 |
| AvatarAgent 的合成服务 `tts_service` 和 `TTS_ADMIN_API_KEY` | 声音克隆、音色删除（3.5、13.2）；删除接口已存在，账号删除的步骤 2 不受阻 |
| **审核服务厂商选型与凭证** | 生产环境启动（11.2） |
| 第三方客服工具选型 | 转发适配器（未选定前反馈保存在库里，不丢） |
| **形象生成服务（新仓库）实现 3.5 的 `AvatarGenerationProvider` 接口**（`submitAvatar`、`submitLook`、`submitReprepare`、`submitActionClip`、`poll`、`fetchOutput`、`delete`），以及环境变量 `AVATAR_GEN_URL`、`AVATAR_GEN_SIGNING_SECRET` | 建形象（3.2）、换装（3.6）、动作片段（3.8）、驱动资源包重新准备（3.9）、系统默认数字人（3.10）、资产删除和账号删除里形象的外部清除（13.1、13.2） |
| 通用用量接口（14.2，`POST /api/internal/usage`） | 形象生成服务、云端渲染服务的用量上报（形象渲染设计 11.1）；没有它这些用量无处上报 |
| AvatarAgent 接受 dispatch 的 `renderMode`、`availableActions`（以及 `lookId`、`deadlineAt`：渲染服务 token 的有效期，4.1），文字对话的 `voiceReply`、`voiceId`、`availableActions` | 通话的渲染档（4.1）、agent 触发的动作（3.8）、文字对话的语音回复（5.4）；对方未实现之前 agent 照旧发布音频轨、不触发动作、只回文字 [推断：AvatarAgent 设计里 `renderMode` 缺失按 `NONE` 处理，形象渲染设计 13.8]。**`render.cloud_enabled`（默认 `false`）只能在 AvatarAgent 读 `deadlineAt`、按它定渲染服务 token 的有效期之后才打开**：在那之前 agent 给渲染服务的 token 固定 12 小时，长于它的通话会在重连时进不了房间 |
| 云端渲染服务和 `RENDER_PACKAGE_SIGNING_SECRET` | `renderMode=CLOUD`（4.1、3.9）；用与手机相同的格式 1 渲染模型；`render.cloud_enabled` 默认 `false` |

其余模块之间（埋点、归因、客服、监控接收）没有相互依赖，可以并行；邀请奖励依赖额度流水（15.9）、会话结束流程（15.6）和注册审计（2.2）。

---

> 第二十二至二十六节是 2026-10-02 补入的：应用内广告、手机号登录与短信、应用版本管理、站内通知、客户端远程配置。章节编号接在"依赖顺序"之后，只是为了不改动前面已有的交叉引用；这几节的依赖已经列在第二十一节的表里，22.11 和 23.8 另列各自缺的输入。

## 二十二、应用内广告（自建）

依据：用户 2026-10-02 的决定——不再调研竞品，自建一套参照 dramaBox 的广告系统，AvatarApp 客户端同步加广告功能。来源 [子代理读码 DramaverseDemo `docs/superpowers/specs/2026-09-17-ad-system-spec.md`、`2026-09-16-ad-frequency-impression-counting-design.md`、`2026-09-19-ad-gate-chain-by-initiation.md`、`docs/backend/ad-system-review-fixes.md`，dramaBox `AdSelectionUseCase`、`AdTrackingUseCase`、`AdDailyStatLandUseCase`、`sql/migrate-ad-system*.sql`，Android `AdPreloadManager`、`AdPlayerFragment`、`AdTracker`]。**下面保留 dramaBox 的模型和选取流程，同时改掉它已被发现的缺陷**（改动尽量写明原因；有一批只是字段、索引、权限码前缀的命名差异，没有写原因、也没有行为影响，交给命名的批量决定统一处理）；与 AvatarApp 相关的映射（广告位、奖励、去广告权益）是本项目的设计，按"设计选择"标注。

### 22.1 关键设计点

| 设计点 | 内容 |
|---|---|
| 模型 | 四层：广告计划 `AdCampaign` → 广告单元 `AdUnit`（计划 × 广告位，带定向、权重、单元日上限）→ 素材 `AdCreative`；广告位 `AdPlacement` 是系统预置的位置，不能通过接口新增或删除 |
| 身份 | 广告接口接受账号令牌或游客凭据（2.1），都不要求注册，和 dramaBox 一致（它的三个广告接口是可选登录，游客按设备号 [核实 `AdController.java:48,61,76`]）：账号请求按 `accountId`，游客请求按凭据里的 `deviceId`。没有任何凭据（设备校验没通过、拿不到游客凭据）的请求返回 401 `INVALID_TOKEN`，不展示广告：自建广告的展示要向广告主计量，不接受没有设备校验的匿名展示。**游客只看强制展示的广告位 `app_open`、`call_end`**：游客没有账号，没有额度（credits）、不在奖励系统里，所以没有 `reward_credits`；游客没有聊天历史，所以没有 `history_feed`。奖励记录按 `accountId`，游客的展示记录 `accountId` 为空。每次展示绑定到发起它的主体（展示元数据里存带类型的主体：`ACCOUNT:<账号 ID>` 或 `GUEST:<deviceId>`，两种不会混淆），`/ads/track` 的调用者必须等于这个主体（恢复 dramaBox 的"请求设备必须等于展示元数据里的设备"检查）。首次启动不展示开屏广告（AdMob 的开屏广告建议里写明"首次启动不展示开屏广告"，dramaBox 用本地标记实现 [核实 `MainActivity.kt:495-500`]），开屏广告只在启动流程（含同意页）结束之后的主界面展示 |
| 游客频控 | 游客**不设每日上限、不设服务端冷却**（产品决定 2026-10-05：游客不是目标客户之前要尽量引导注册，注册账号才有每日上限）。服务端不为游客保存任何频控状态；冷却分钟数由客户端本地执行（22.7），避免广告连着弹出（AdMob 的开屏广告指引要求不要紧挨着别的广告展示 [核实 `support.google.com/admob/answer/9341964`]）。`call_end` 的间隔本来就由客户端数（22.10），不是游客特有的。单元日上限（`AdUnit.dailyImpressionCap`）对游客和账号合计，仍然生效 |
| 日界线 | 频控按**账号自己的本地日**（`User.timezone`，4.1 发起会话、5.4 发文字消息、28.1 和 28.2 的请求每次都刷新；`User.timezone` 为空的账号按 UTC 日）；报表按 UTC 日（17.6）。用户当天改时区会重新划分本地日、多出一份额度，这个偏差接受。**每个计数用处理那个事件时的服务器时间换算成账号本地日**：请求检查用请求到达的时间，`IMPRESSION` 的计数用 `IMPRESSION` 到达的时间，奖励发放（`rewardGrantedCount`）用 `COMPLETE` 到达的时间；所以跨午夜的一次展示，请求和展示算前一天、奖励次数算后一天。dramaBox 固定 GMT+8，AvatarApp 面向全球，所以不能照搬 |
| 计数时机 | 同 dramaBox 2026-09-16 的改动：选取时只读计数，`IMPRESSION` 事件到达时才加一；预取了但没展示的广告不占额度、不启动冷却 |
| 奖励 | 激励广告看完后由**服务端**在一个数据库事务里发放额度（`CreditLedger`，`reason=AD_REWARD`），客户端只收结果。dramaBox 的奖励发放在客户端本地，服务端只标记"已验证"，金币奖励那条路径永远不会被走到，这两点都不照搬。**防刷的真正控制是发放时的每日上限**（22.6 第 7 步）：服务端无法证明用户真的看了一个自家托管的广告（客户端可以不渲染就按时间发 `COMPLETE`），所以每个展示的时间检查只限制速率，不限制总量；每账号每本地日的奖励次数上限才限制总量。dramaBox 只在请求时检查频控，改过的客户端可以先请求几十个再一起完成 |
| 去广告 | 新增代码声明的功能开关 `ads.removed`（`BOOLEAN`，默认 `false`），订阅权益可把它配成 `true`；生效值为 `true` 的账号所有广告位返回无广告（设计选择；极性的理由见 15.3） |
| 展示记录 | 写 MongoDB 集合 `ad_impression_log`，每条自带过期时间 `expireAt = eventTime + ads.log_retention_days`，TTL 索引建在 `expireAt` 上（`expireAfterSeconds=0`），做法同 `event_log`（7.2），所以改保留期配置对之后写入的记录立即生效。记录带客户端 IP（`ip`，取自受信任反向代理，1.6）和服务端用它解析的 `country`，写在展示元数据里，之后的事件沿用；`platform`、`appVersion`、`context`、`channel` 也一样：`/ads/request` 校验过的 `context`（22.4）和请求的渠道码在请求时存进展示元数据，之后每个事件的日志行都从元数据复制这几个字段（`/ads/track` 的请求里没有它们，22.6），所以 `StatAdDaily.platform` 有确定的来源；不存设备标识。存 IP 的依据、隐私要求和账号删除、保留期规则同 7.2（没有任何法规禁止存 IP，GDPR 把它当个人数据，需要告知、限制保留期、响应删除和导出）；游客的行没有账号，只靠 `ads.log_retention_days` 的 TTL 过期。dramaBox 用 MySQL 按月分表，既没有保留任务、跨月又会重复入库 |
| 统计 | 日汇总表加补数，沿用 17.6 的任务窗口、先删后插和 UTC 日 |
| 后台 | 计划、广告位、单元、素材、报表五组页面，权限码 `ADS:CAMPAIGN`、`ADS:PLACEMENT`、`ADS:UNIT`、`ADS:CREATIVE`、`ADS:REPORT` |

### 22.2 广告位（预置，迁移脚本写入；加一个广告位需要代码加迁移）

| `slotKey` | 形式 | 位置 | 默认频控（每账号每本地日） | 默认冷却 |
|---|---|---|---|---|
| `app_open` | `SPLASH` | 冷启动；热启动时后台停留达到冷却分钟数（≥，22.7） | 2 | 30 分钟 |
| `call_end` | `INTERSTITIAL` | 通话结束、通话结束弹窗关闭之后（通话在对话页内进行，没有单独的通话界面，页面结构设计 B 节），每 `ads.call_end_interval` 次通话一次（`0` = 关闭间隔触发，即不展示通话结束广告，22.10） | 3 | 10 分钟 |
| `history_feed` | `NATIVE` | 对话页的消息列表中每 `ads.history_feed_interval` 条之后插一张 | 10 | 0 |
| `reward_credits` | `REWARDED` | 用户主动点"看广告得额度"，入口由客户端计划定义（例如额度不足提示里） | 5 | 空（用户主动触发，不设冷却） |

这四个广告位是我按 AvatarApp 的界面映射 dramaBox 的五个广告位（`app_open`、`episode_unlock`、`episode_end`、`home_feed`、`theater_list`）得出的，是**设计选择**；dramaBox 的 `episode_*`、`theater_list` 与剧集强相关，不搬。**任何广告都不会在通话进行中展示**，客户端在通话中不请求、不展示（设计选择）。

`AdPlacement`：`id`、`slotKey`（唯一）、`adFormat`（`SPLASH`/`INTERSTITIAL`/`NATIVE`/`REWARDED`）、`name`、`enabled`、`frequencyCap`（每账号每本地日的展示数，0 不限，游客不适用；激励广告位不能是 0，它同时是每日可得奖励的次数上限）、`cooldownMinutes`（空表示不适用，0 表示无冷却）、`rewardCredits`（仅 `REWARDED`，看完一次发放的额度数，必须大于 0）、`creativeAspect`、`creativeMinShortSide`、`creativeMaxBytes`（素材规格，只读）、`updatedAt`。

素材规格的格式和初值（迁移脚本写入，运营不能在后台改，要改走迁移）：`creativeAspect` 是 `宽:高` 的字符串，素材的宽高比与它的相对误差不超过 `ads.creative_aspect_tolerance_percent`（默认 3）；`creativeMinShortSide` 是较短边的最小像素数；`creativeMaxBytes` 是文件字节数上限。**初值照 dramaBox：四个广告位都是 9:16、较短边 720 像素、10 MB** [核实 dramaBox `sql/migrate-ad-placement-creative-spec.sql` 的预置值，后台设计会话的笔记 `_scratch_dramabox_ads.md` 第 99 到 104 行；dramaBox 的 `home_feed`、`app_open`、`episode_end`、`episode_unlock` 都是这组值]；原生广告位 `history_feed` 对应它的 `home_feed`，同样是 9:16：

| `slotKey` | `creativeAspect` | `creativeMinShortSide` | `creativeMaxBytes` |
|---|---|---|---|
| `app_open` | `9:16` | 720 | 10485760（10 MB） |
| `call_end` | `9:16` | 720 | 10485760（10 MB） |
| `history_feed` | `9:16` | 720 | 10485760（10 MB） |
| `reward_credits` | `9:16` | 720 | 10485760（10 MB） |

没有 dramaBox 的"按产品覆盖行"（`source_type`、`_ALL_`）：AvatarApp 只有一个产品。dramaBox 的计数和日志里放的是覆盖行的 id、单元挂的是基线行的 id，创建或删除覆盖行会让当天的计数清零、统计分裂到两个 id，这个问题随之消失。

### 22.3 数据

- `AdCampaign`：`id`、`name`、`description`、`status`（`DRAFT`/`ACTIVE`/`PAUSED`/`ENDED`）、`priority`（数值小优先，默认 100）、`startAt`、`endAt`（空表示立即生效/永不结束）、`createdBy`、`updatedBy`、`createdAt`、`updatedAt`。没有 dramaBox 的 `target_type`（它只被校验和存储，不影响选取）。
- `AdUnit`：`id`、`campaignId`、`placementId`、`name`、`status`（`DRAFT`/`ACTIVE`/`PAUSED`）、`targeting`（JSON，22.5，**保存时按 schema 校验**）、`weight`（默认 100）、`dailyImpressionCap`（全体账号和游客合计，0 不限）、`surfaces`（格式同 3.7，空数组表示所有端；选取时按请求的 `X-Platform`、`X-Channel` 过滤，22.4）。
- `AdCreative`：`id`、`adUnitId`、`type`（`IMAGE`/`VIDEO`）、`uploadId`（关联的上传记录，22.9）、`mediaUrl`、`thumbnailUrl`（这两个不存，响应时由 `uploadId` 拼出公开地址，22.9）、`width`、`height`、`bytes`、`durationSeconds`、`clickAction`（`OPEN_URL`/`DEEP_LINK`/`IN_APP_ROUTE`）、`clickTarget`、`language`（`*` 或语言代码）、`reviewStatus`（`DRAFT`/`APPROVED`/`REJECTED`）、`servingStatus`（`ACTIVE`/`PAUSED`，与审核状态相互独立）、`weight`、`rewardAfterSeconds`（仅激励广告）、`skippable`、`title`、`body`、`ctaText`、`advertiserName`、`reviewNote`、`reviewedBy`、`reviewedAt`、`createdBy`、`createdAt`、`updatedAt`。**原生广告的 `ctaText` 必填且按语言存**，客户端缺省时用本地化的资源字符串，不写死英文（dramaBox 客户端渲染服务端的 `ctaText`，只在它为空时才回退成写死的英文 "Learn More" [核实 `AdCreativeMapper.kt:48-57`]）。
- `AdFrequencyState`（只有注册账号有，游客不保存，22.1）：`accountId`、`placementId`、`statDate`（账号本地日）、`impressionCount`、`rewardGrantedCount`（仅 `REWARDED` 广告位使用，当天已发放奖励的次数）、`lastImpressionAt`；`(accountId, placementId, statDate)` 唯一；保留 7 天，每天清理。
- `AdRewardVerification`（只有注册账号有，游客没有奖励）：`impressionId`（唯一）、`accountId`、`creditsGranted`、`status`（`PENDING`/`VERIFIED`/`REJECTED`）、`rejectReason`（可空：`DAILY_CAP`、`EXPIRED`、`ERROR`、`CLOSED_EARLY`）、`verifiedAt`、`createdAt`；`createdAt` 早于 `now − (4 小时 + ads.reward_complete_grace_seconds + 30 秒)` 的 `PENDING` 行由清理任务置 `REJECTED`（`EXPIRED`）：元数据最长 240 分钟，`IMPRESSION` 会把它延长到至少 `impressionAt + rewardAfterSeconds + ads.reward_complete_grace_seconds`（22.6 第 4 步，`rewardAfterSeconds` 最大 30），所以阈值要盖住延长后的存活时间，否则合法的 `COMPLETE` 会遇到已被清掉的验证行。
- `ad_impression_log`（MongoDB）：`impressionId`、`eventType`、`adUnitId`、`creativeId`、`placementId`、`campaignId`、`accountId`（游客为空）、`ip`、`country`（GeoIP 解析，解析不到为空）、`platform`、`channel`（渠道码，缺失或不合法为 `unknown`）、`appVersion`、`watchSeconds`、`context`、`eventTime`（服务器时间）、`expireAt`；索引：`(impressionId, eventType)` 唯一、`(eventTime)`（日汇总任务按时间读）、`(expireAt)`（TTL 索引，`expireAfterSeconds=0`，保留期 `ads.log_retention_days` 在写入时算进 `expireAt`）、`(accountId)`（账号删除与导出按账号读）。**不存设备标识**（dramaBox 存了 IP 和设备号 [核实 `AdImpressionLog.java:80-98`]；这里存 IP，不存设备号，因为展示的主体绑定在 Redis 元数据里，日志不需要它）。游客的行（`accountId` 为空）不会被账号删除流程触及，只靠 `ads.log_retention_days` 的 TTL 过期。
- 索引（PostgreSQL）：`AdUnit(placementId, status)`、`AdCreative(adUnitId, reviewStatus, servingStatus)`、`AdCampaign(status, endAt)`（自动置 `ENDED` 的任务用）、`AdRewardVerification(status, createdAt)`（清理任务用）。
- 汇总表：`StatAdDaily`（`statDate`, `campaignId`, `placementId`, `adUnitId`, `creativeId`, `platform`, `channelCode`, `country`（空串表示未知））和 `StatAdNofillDaily`（`statDate`, `platform`, `channelCode`, `slotKey`, `reason`, `cnt`；主键含 `channelCode`，缺省 `unknown`），指标列同 dramaBox，另加 `guestImpressions`（游客的展示数，已包含在 `impressions` 里，供运营比较游客和账号的广告展示）：`impressions`、`starts`、`viewableImpressions`、`nonViewableImpressions`、`undeterminedImpressions`、`clicks`、`completions`、`skips`、`errors`、`uniqueUsers`、`totalWatchSeconds`。`platform` 取 `ANDROID`/`IOS`；`channelCode` 是安装渠道码（`X-Channel`，24.7），缺失或格式不合法记为 `unknown`，这样商店构建和直装构建的展示可以分开统计（不是 dramaBox 的按产品覆盖行）。

状态机（同 dramaBox）：计划 `DRAFT→ACTIVE`、`ACTIVE⇄PAUSED`、`DRAFT/ACTIVE/PAUSED→ENDED`，`ENDED` 终态且不可编辑；删除只允许 `DRAFT` 或 `ENDED` 且名下没有单元。**新增：`endAt` 过了由定时任务自动置 `ENDED`**（dramaBox 没有，靠选取时过滤时间窗口）。单元 `DRAFT→ACTIVE`、`ACTIVE⇄PAUSED`；删除只允许 `DRAFT` 且没有素材。素材：创建为 `DRAFT` + `servingStatus=ACTIVE`；审核只能从 `DRAFT` 到 `APPROVED`/`REJECTED`；内容（含权重）只有 `DRAFT`、`REJECTED` 可改，改 `REJECTED` 的回到 `DRAFT` 并清空审核备注；`servingStatus` 只有 `APPROVED` 的能切换；删除只允许 `DRAFT`、`REJECTED`。已通过的素材不能改，要换就新建一条再暂停旧的。

### 22.4 选取流程（`POST /api/ads/request` 内部）

输入：账号令牌或游客凭据（22.1）、`slotKey`、`context`（`platform`、`appVersion`、`osVersion`、`language`；激励广告不需要 `dramaId` 这类内容参数）。`context` 的校验：`platform` 必须是 `ANDROID` 或 `IOS`，否则 400 `INVALID_REQUEST`；`appVersion`、`osVersion` 各不超过 32 个字符、只含字母、数字和 `.`、`_`、`-`，不合格的丢弃（按没带处理，依赖它的定向不匹配）；`language` 是不超过 35 个字符的 BCP 47 标签，不合格的丢弃并改用 `Accept-Language`（1.2）。国家码由服务端从客户端 IP 解析（GeoIP 数据库，选型是缺的输入，第二十二节末尾），**不取客户端自报**。按顺序，每个退出点记一个无广告原因：

1. `ads.enabled`（AppConfig 总开关，默认 `false`）不是 `true` → `GLOBAL_OFF`。
2. 账号的功能开关 `ads.removed` 生效值为 `true` → `ENTITLEMENT_OFF`（设计选择；游客没有这个开关，跳过）。
3. 广告位不存在（未知的 `slotKey` 也是，响应 `data: null`，不是 400）或 `enabled=false` → `PLACEMENT_OFF`；游客请求 `history_feed` 或 `reward_credits` → `NOT_FOR_GUEST`（22.1）。
4. **频控**（**游客跳过本步**：不设每日上限，服务端不保存游客的频控状态，响应里 `notBeforeDelayMs` 为 0，冷却由客户端本地执行，22.1）：读该账号当天的 `AdFrequencyState`；**非激励广告位**：`frequencyCap > 0` 且 `impressionCount` 已达上限 → `FREQ_CAP`；**激励广告位不看 `impressionCount`**，它的上限只用一个计数，就是下面附加检查里的已发奖次数加待完成数（避免展示数和发奖数两个计数各判一次，两种实现结果不同）。冷却**不是无广告**：`cooldownMinutes > 0` 且当前时间早于 `lastImpressionAt + 冷却` 时，广告照常下发，响应里带相对延迟 `notBeforeDelayMs`（相对值，不信设备时钟），并给 `COOLDOWN_SUPPRESSED` 计数。`cooldownMinutes` 为空的广告位跳过冷却。**激励广告位的附加检查**：该账号当天的 `rewardGrantedCount` 加上它名下**仍然有效**的 `PENDING` 验证行数已达 `frequencyCap` → `FREQ_CAP`。"仍然有效"指元数据（Redis `ad:impression:{id}`）还存在：先取该账号名下的 `PENDING` 行（至多几行，受下面“有效 `PENDING` 验证行达到 2 个”的常量约束），逐个检查 Redis 键，键已不存在的（预取的广告过期没人看）、或已有 `IMPRESSION`（元数据 `impressionAt` 非空）但超过 `impressionAt + rewardAfterSeconds + ads.reward_complete_grace_seconds`（默认 120）仍没有终态事件的（用户中途关掉了而没有上报，或进程被杀），顺手用条件更新（`WHERE status='PENDING'`，更新不到行即跳过）置 `REJECTED`（`rejectReason=EXPIRED`）、不再计数，因为元数据没了以后这个展示的 `COMPLETE` 本来就只能得到 `EXPIRED`（22.6 第 1 步）；这样预取的激励广告过期不会让用户被一直判 `FREQ_CAP`、看到"暂无可看的广告"，不必等 4 小时后的清理任务（清理任务仍然保留，处理没有被请求碰到的行）；请求时已有的有效 `PENDING` 验证行达到 2 个（工程常量，预取深度 1 加一个在途；不是配置键），达到或超过 → `FREQ_CAP`。这样一次请求不出去几十个未完成的奖励广告（发放时还会再检查一次，22.6 第 7 步）。
5. 可选单元：`placementId` 匹配、单元 `ACTIVE`、计划 `ACTIVE` 且在 `[startAt, endAt]` 内；按 `priority` 升序分组（同一优先级一组），一组内的单元全部被排除后才试下一组；空 → `NO_ELIGIBLE_UNIT`。
6. 组内按**权重随机**选单元：`weight` 为空按 100；`weight` 为 0 的单元**从不被选**（dramaBox 里一组全是 0 时仍会下发第一个，本项目改为不下发）。一组全是 0 → 该组视为空，记 `NO_ELIGIBLE_UNIT` 后试下一组。
7. **先**判单元的 `surfaces`（22.3）：不包含请求的 `X-Platform`、`X-Channel`（1.2；请求没带这两个头时，`surfaces` 非空的单元不匹配）→ `TARGETING_MISS`，排除该单元继续。**再**判定向（22.5）：不匹配 → `TARGETING_MISS`，排除该单元继续；单元日上限（Redis 计数 `ad:unit:imp:{unitId}:{UTC 日}`）已达 → `UNIT_DAILY_CAP`，排除继续。
8. 素材：`APPROVED` 且 `servingStatus=ACTIVE`，语言为 `*`、或请求语言和素材语言的**主语言子标签**相同（`en` 匹配 `en-US`；dramaBox 是精确匹配，`en` 不匹配 `en-US`）；激励广告的素材 `rewardAfterSeconds` 必填（保存时已校验在 5–30，22.9），不存在空值回退。没有 → `NO_CREATIVE`，排除继续。素材按权重随机，规则同第 6 步。
9. 生成 `impressionId`（UUID）；**先**把元数据写 Redis `ad:impression:{id}`（带类型的主体 `ACCOUNT:<账号 ID>` 或 `GUEST:<deviceId>`；`ip`、`country`；各 ID、`rewardAfterSeconds`、`issuedAt`，`impressionAt` 先为空），TTL = `ads.preload_ttl_minutes`（上限 240 分钟）；元数据里存校验后的 `context`（`platform`、`appVersion`、`osVersion`、`language`，被丢弃的字段不存）和渠道码 `channel`（取自 `X-Channel`，缺失或格式不合法为 `unknown`）；写入失败（带重试和熔断）→ `META_WRITE_FAIL`，排除该单元继续（此时还没有任何数据库行，不留孤儿）。**再**对激励广告写一条 `PENDING` 的 `AdRewardVerification`，`creditsGranted = placement.rewardCredits`（服务端定，客户端不能指定）；这一步写失败 → 删除刚写的 Redis 键并返回 500 `INTERNAL_ERROR`，不下发广告。
10. 所有组都排除完 → 返回最后一个原因（只记最后一个，这是 dramaBox 的做法，已知限制）。

无广告时响应 `data: null`（HTTP 200），客户端不重试。每个无广告原因按（日期、平台、渠道、广告位、原因）累加 Redis 计数（渠道取请求的 `X-Channel`，缺失或格式不合法记 `unknown`），TTL 8 天，由日汇总任务读走（22.8）。

### 22.5 定向规则（`AdUnit.targeting`）

JSON，键用 snake_case，全部可选，缺省或空表示不限。保存时校验：键必须是下面这几个、类型正确、版本号和时间格式可解析，否则 `INVALID_REQUEST`（dramaBox 不校验，坏 JSON 在选取时被当作"不匹配"，该单元永远不下发且没有任何提示）。

| 键 | 规则 |
|---|---|
| `platforms` | `["ANDROID","IOS"]` 的子集 |
| `geo` | 国家码列表（ISO 3166-1 alpha-2），请求的国家码（服务端解析）在列表内才匹配；解析不到国家时不匹配 |
| `os_version_min`、`app_version_min` | 点分版本号，请求值存在且 ≥ 才匹配；逐段比较数值，缺的段当 0；每一段取开头的数字来比（`0-beta` 按 0）；请求值的某一段不以数字开头时，该值不匹配任何版本条件 |
| `languages` | 语言代码列表，按主语言子标签比较（`en` 匹配 `en-US`） |
| `day_parts` | `[{"start":"H:mm","end":"H:mm"}]`，**按账号本地时间**（`User.timezone`；游客没有时区，按 UTC），任一时段包含当前时间即匹配，两端包含，`start > end` 表示跨午夜（dramaBox 固定 GMT+8） |

dramaBox 的 `content_source` 是短剧内容源，已弃用，不搬。

### 22.6 客户端接口（账号令牌或游客凭据，信封 `{code,message,data}`）

| 接口 | 限流（每账号，游客每设备） |
|---|---|
| `GET /api/ads/config` | 无单独限流，适用 1.6 的兜底限制 |
| `POST /api/ads/request` | 30 次 / 60 秒 |
| `POST /api/ads/track` | 60 次 / 60 秒 |

**`GET /api/ads/config`**：`globalConfig`（`adsEnabled`=总开关为真且账号的 `ads.removed` 为假、`preloadEnabled`、`preloadTtlMinutes`、`callEndInterval`、`forceCloseSeconds`（取自 `ads.force_close_seconds`；客户端缺失该字段时按 15 处理））和 `placements[]`（`slotKey`、`adFormat`、`enabled`、`frequencyCap`、`cooldownMinutes`、`feedInterval`（仅 `history_feed`））；`adsEnabled` 为 `false` 时 `placements` 为空数组，客户端据此隐藏所有广告位。游客凭据调用时：`placements` 只含 `app_open`、`call_end`，`frequencyCap` 为 0（不设上限），`adsEnabled` 不看 `ads.removed`。

**`POST /api/ads/request`**：请求 `{slotKey, context}`；成功 `{impressionId, adUnitId, creative{id,type,mediaUrl,thumbnailUrl,durationSeconds,clickAction,clickTarget,title,body,ctaText,advertiserName}, displayRules{skippable,skipAfterSeconds,rewardAfterSeconds,mustComplete,rewardCredits,notBeforeDelayMs}}`；无广告 `data: null`。`displayRules`：激励广告 `skippable=false`、`mustComplete=true`、`rewardAfterSeconds` 取素材值，`rewardCredits` 取广告位值；其他广告 `skippable` 取素材值（创建素材时默认 `true`），`skipAfterSeconds` 取 `ads.skip_after_seconds`（默认 5）；`notBeforeDelayMs` 是相对毫秒。

**`POST /api/ads/track`**：请求 `{impressionId, event, watchSeconds?}`。`impressionId` 必须是 UUID 格式；`watchSeconds` 可省略，给出时必须是 0 到 86400 的整数；不合格都是 400 `INVALID_REQUEST`；激励 `COMPLETE` 省略 `watchSeconds` 按 0 处理（得到 `WATCH_TOO_SHORT`）。`event` 必须是下面九个之一，否则 `INVALID_REQUEST`（dramaBox 不校验，未知事件名照样入库）：`IMPRESSION`、`START`（仅视频）、`VIEWABLE`、`NOT_VIEWABLE`、`CLICK`、`COMPLETE`、`SKIP`、`ERROR`、`CLOSE`（用户在达到奖励条件之前关闭广告页，只对激励广告有意义：其他广告位收到也接受并记录，没有别的效果；它不计入任何汇总指标）。**响应**：只要请求本身合法，一律 HTTP 200，`data` 是 `{"status":"OK|DUPLICATE|EXPIRED|REJECTED","rewardGranted":<bool>,"credits":<发放的额度，未发放为 0>,"reason":"<REJECTED 时的原因，其余为 null>"}`（dramaBox 的 `AdTrackResponse` 已经有 `status` 字段，取值 `ACCEPTED`/`DUPLICATE`/`EXPIRED`/`REJECTED` [核实，由审计子任务读过]；这里沿用 `status`，取值改成本契约的 `OK`/`DUPLICATE`/`EXPIRED`/`REJECTED`，另加 `rewardGranted`、`credits`、`reason`）。`reason` 取 `NO_IMPRESSION`（先于 `IMPRESSION` 的事件）、`WATCH_TOO_SHORT`、`DAILY_CAP`（激励奖励当天次数已满）、`TERMINAL_EXISTS`（终态事件已有一个）。`INVALID_REQUEST`（400）只用于请求不合法：事件名不认识、元数据里的主体不是当前调用者、字段缺失。`ACCOUNT_DELETING`、`ACCOUNT_DELETION_SCHEDULED`（403）按 2.8。客户端只在 `status=OK` 或 `DUPLICATE` 且 `rewardGranted` 为真时给用户展示奖励。

处理：

1. 读 Redis 元数据；不存在 → `status=EXPIRED`（激励广告的 `COMPLETE` 先查验证行（要求 `AdRewardVerification.accountId` 等于当前调用者，否则 `INVALID_REQUEST`）：已 `VERIFIED` 则返回 `OK` 和已发奖励，响应丢了重试也能拿到）。
2. 元数据里的主体（`ACCOUNT:<账号 ID>` 或 `GUEST:<deviceId>`）必须等于当前调用者，否则 `INVALID_REQUEST`。
3. **幂等门**：Redis `SET NX ad:ev:{impressionId}:{event}`（TTL 同元数据）；没抢到 → `DUPLICATE`（重复的激励 `COMPLETE` 按第 1 步查验证行返回已发奖励；验证行还是 `PENDING`、赢家还没提交时，返回 503 `TEMPORARILY_UNAVAILABLE`，客户端按 22.7 重试，不返回 `DUPLICATE` 加 `rewardGranted=false`，那会让客户端不再重试）。Mongo 的 `(impressionId, eventType)` 唯一索引是兜底：写入遇到 `DuplicateKey` 视为 `DUPLICATE`，不再计数。**只有抢到幂等门的请求才会累加计数器和写记录**，所以并发的两个 `IMPRESSION` 不会重复计数。
4. **顺序规则**（dramaBox 里这是客户端规则 [核实 `AdPlayerFragment.kt:659-670`，由审计子任务读过]，服务端不校验）：**除 `ERROR`、`CLOSE` 以外**的非 `IMPRESSION` 事件之前，元数据里必须已有 `impressionAt`（`IMPRESSION` 抢到幂等门时写入服务器当前时间，不依赖 Mongo，并把元数据、幂等门、终态键的 TTL 延长到至少 `impressionAt + rewardAfterSeconds + ads.reward_complete_grace_seconds`：预取的广告可能到 TTL 末尾才展示），否则 `REJECTED/NO_IMPRESSION`（并释放第 3 步的幂等门，让之后补发的该事件还能处理）。**`ERROR` 和 `CLOSE` 不受"先有 `IMPRESSION`"约束**（`CLOSE` 同样可能发生在渲染完成之前，见第 5 步）；`ERROR` 的理由如下：素材渲染失败、全屏广告加载失败（22.7）发生在 `IMPRESSION` 之前（`IMPRESSION` 要素材渲染完成才发），按顺序规则这些 `ERROR` 会永远被拒、错误率统计里看不到；所以 `ERROR` 只要元数据存在且主体一致就记录（`status=OK`），计入 `errors` 指标，占终态（第 5 步）。激励广告的展示发生 `ERROR` 时，同一处理里把它的 `PENDING` 验证行置 `REJECTED`（`rejectReason=ERROR`），否则渲染失败的激励广告会占着"同时未完成"的名额（22.4 第 4 步），直到 4 小时后才被清理。其余事件的顺序规则不变。`ERROR` 之后又到的 `IMPRESSION` 照常处理（它不是终态事件），但随后的 `COMPLETE`、`SKIP` 会因终态已被占用返回 `REJECTED/TERMINAL_EXISTS`。
5. **终态事件**：`COMPLETE`、`SKIP`、`ERROR`、`CLOSE` 每个展示最多一个。`CLOSE` 和 `ERROR` 一样不受第 4 步“先有 `IMPRESSION`”约束（用户可能在广告渲染完成前就关闭）；激励广告收到 `CLOSE` 时，同一处理里把它的 `PENDING` 验证行置 `REJECTED`（`rejectReason=CLOSED_EARLY`），释放“同时未完成”的名额（22.4 第 4 步），否则中途关掉的激励广告要等元数据过期才释放。激励广告的 `COMPLETE` 先做第 6 步的检查，通过后才用 Redis `SETNX ad:terminal:{impressionId}`（TTL 同元数据）占终态；`SKIP`、`ERROR`、`CLOSE` 直接占。没占到 → `REJECTED/TERMINAL_EXISTS`。因此被拒绝的 `COMPLETE`（时间不够）不占终态，可以在元数据有效期内重试。第 7 步事务因数据库错误失败（500 `INTERNAL_ERROR`）时释放终态键和幂等门，客户端按 22.7 重试；因业务原因被拒（`DAILY_CAP`）则保留，那个展示就此作废。
6. 激励广告的 `COMPLETE` 检查：`watchSeconds ≥ rewardAfterSeconds − 1`（容差 1 秒：视频的真实时长可能略小于后台记录的 `durationSeconds`，上传时四舍五入，而运营可以把 `rewardAfterSeconds` 配成等于 `durationSeconds`，一个完整看完 9.98 秒视频的用户，客户端按整秒上报会少于阈值；客户端同时改成视频播到结束时向上取整上报。`VIDEO` 素材保存时已保证 `rewardAfterSeconds ≤ durationSeconds`（22.9），所以不需要再和 `durationSeconds` 取小；`IMAGE` 没有时长，只用 `rewardAfterSeconds`），且**服务器收到该 `IMPRESSION`（`impressionAt`）到现在 ≥ `rewardAfterSeconds` − 2 秒**（dramaBox 从发放广告的时间算，预取的广告会提前几十分钟，这条检查形同虚设，所以改为从 `IMPRESSION` 到达算起）；不满足 → `REJECTED/WATCH_TOO_SHORT`，不写 `COMPLETE`，不占终态，不占幂等门（释放）。这只限制每个展示的速率：客户端可以发了 `IMPRESSION` 不渲染就等够时间再发 `COMPLETE`，服务端分辨不出，所以总量由第 7 步的每日上限控制。
7. 发放奖励（只有第 6 步通过）：**同一个数据库事务里**——对 `(accountId, placementId, statDate)` 的 `AdFrequencyState` 行加行锁（不存在先插入），`rewardGrantedCount ≥ frequencyCap`（`frequencyCap` 为 0 表示不限，激励广告位不允许配 0，22.9 校验）→ 条件更新验证行 `PENDING→REJECTED`（`rejectReason=DAILY_CAP`），返回 `REJECTED/DAILY_CAP`；否则条件更新验证行 `PENDING→VERIFIED`，`rewardGrantedCount` 加一，写 `CreditLedger`（`reason=AD_REWARD`，`delta=creditsGranted`，`eventKey=impressionId`，沿用 `(reason, eventKey)` 唯一约束）并更新 `CreditBalance`。条件更新没抢到的，重读验证行并返回赢家的结果，**验证行的 `rejectReason` 映射成响应**：`DAILY_CAP` → `REJECTED/DAILY_CAP`；`EXPIRED` → `status=EXPIRED`；`ERROR`、`CLOSED_EARLY` → `REJECTED/TERMINAL_EXISTS`；`VERIFIED` → `OK`、`rewardGranted=true`；重读发现**元数据在而验证行不存在**（22.4 第 9 步两次写入之间进程崩溃的残留）→ `status=EXPIRED`，不补建验证行，也不发放。账号处于 `PENDING_DELETION`、`DELETING` 时拒绝（`ACCOUNT_DELETION_SCHEDULED`、`ACCOUNT_DELETING`）。**提交之后**再做不在事务里的事：记后端事件 `ad_reward_granted`（7.1 的事件库写入本来就是尽力而为，不能与数据库事务原子），写 Mongo 的 `COMPLETE` 记录。
8. 写展示记录（Mongo，失败只记日志不影响响应）；账号的 `IMPRESSION` 同时给 `AdFrequencyState.impressionCount` 和单元日计数加一，游客只加单元日计数（数据库和 Redis 不在同一个事务里，Redis 计数在回滚时可能多一，这是 dramaBox 文档承认并接受的偏差）。`IMPRESSION` 的 `impressionCount` 增加**不检查上限**（展示已经发生），上限只在 `/ads/request` 和奖励发放时检查。

### 22.7 客户端行为（Android 与 iOS 一致；模式取自 dramaBox 客户端）

- **配置**：冷启动无条件刷新一次，会话内超过 30 分钟再刷新；缓存到本地，没有缓存时所有广告位视为关闭。配置缓存按凭据类型（账号、游客）分开，凭据切换时丢弃并重新拉取（游客的配置只有两个广告位，不能带到账号上）；拿不到游客凭据（设备校验没通过，22.1）时不请求广告、不展示，这不是错误。
- **预取池**：每个广告位一个队列；`app_open`、`call_end`、`reward_credits` 深度 1，`history_feed` 深度 3，上限 8；缺口并行补，一轮没拿到广告就停；无广告不重试，异常按 10/20/40 秒重试；预取 TTL 取 `min(preloadTtlMinutes, 上限)`，上限 `app_open` 240 分钟、其他 60 分钟。冷却用单调时钟：响应到达时记下 `elapsedRealtime + notBeforeDelayMs`；队首广告还在冷却，该广告位暂不展示、不出队。凭据切换（游客注册或登录成为账号、账号登出变回游客、登录到另一个账号）清空所有队列，因为服务端把每次展示绑定到发起它的主体（账号 ID 或游客设备）；游客注册得到的是一个新账号（2.2），不是升级，队列同样清空。
- **展示事件**：`IMPRESSION` 要素材渲染完成且页面在前台才发（视频首帧或图片加载完成；原生卡片还要窗口有焦点，列表行还要可见面积大于 0）；`START` 只在视频首帧发一次；`VIEWABLE`：视频连续播放 2 秒、图片显示 1 秒（列表行：面积 ≥ 50% 连续 1 秒），`NOT_VIEWABLE` 在页面销毁时发（展示过但未达可视），两者对同一展示互斥；终态事件只在前台发，后台时推迟到回到前台。
- **关闭与奖励**：可跳过的广告显示 `skipAfterSeconds` 倒计时；非激励广告展示满 `forceCloseSeconds` 秒（配置 `ads.force_close_seconds`，默认 15，来自 `GET /api/ads/config`；0 表示不启用）后强制可关闭（dramaBox 客户端把 15 秒写死，这里改成配置）。**合规靠配置**：Google Play 广告政策要求会占满屏幕的广告"easily dismissible without penalty"并提供清晰的关闭方式（原文取自 `support.google.com/googleplay/android-developer/answer/9857753`，2026-10-02 读过，页面没有给出具体秒数），所以开屏、插屏素材应保持"可跳过"、`ads.skip_after_seconds` 保持较小（默认 5）。这是运营配置，后端不拦截，后台在配成"不可跳过"、倒计时超过 5 秒、或 `ads.force_close_seconds` 为 0 且存在不可跳过的开屏或插屏素材时给出风险警告（admin-frontend-design 5.17）；激励广告倒计时到 `min(rewardAfterSeconds, 时长)`，之后关闭才算得奖，之前返回要弹确认"退出将没有奖励"；激励广告的 `COMPLETE` 用一个协程按顺序：等 `track` 返回 → 显示结果 → 关闭页面，期间显示"验证中"遮罩。**奖励在倒计时结束的那一刻就已经算“得到”**（`watchSeconds ≥ rewardAfterSeconds − 1` 且距 `IMPRESSION` 满足 22.6 第 6 步），所以倒计时结束之后用户点离开、返回或关闭，都发 `COMPLETE`（不弹“退出将没有奖励”确认）；倒计时结束前离开才发 `CLOSE`。**非用户拆除**（页面被系统销毁、应用被切到后台后进程重建等）：倒计时已结束 → 发 `COMPLETE`；未结束 → 发 `CLOSE`。**暂停或后台时已得到的奖励**：终态事件只在前台发（上一条），所以回到前台后补发 `COMPLETE`（服务端的元数据和终态键 TTL 在 `IMPRESSION` 时已延长到 `impressionAt + rewardAfterSeconds + ads.reward_complete_grace_seconds`，22.6 第 4 步，超过则得到 `EXPIRED`，客户端不重试）；进程被杀来不及发的，靠服务端的宽限兜底（22.4 第 4 步）。**`CLOSE`**：激励广告在达到奖励条件之前被用户关闭（含“退出将没有奖励”确认后退出）时，关闭页面的同时发一次 `CLOSE`（此时页面在前台，不走“终态事件后台时推迟”的规则）；其他广告位不发；进程被杀来不及发的，服务端靠 `ads.reward_complete_grace_seconds` 兜底（22.4 第 4 步）。
- **上报**：除激励 `COMPLETE` 外都是火后即忘，按 2、8、30 秒重试 3 次，进程被杀则丢弃（dramaBox 的明确决定，保留）；激励 `COMPLETE` 等返回（重复提交是安全的，22.6 第 1、3 步；响应是 5xx（500 `INTERNAL_ERROR`、503 `TEMPORARILY_UNAVAILABLE`）或网络错误时按 2、8、30 秒重试，`REJECTED` 不重试）。
- **点击**：整屏广告点击区域任意位置；原生卡片只有 CTA 按钮可点。**`clickAction` 必须真正实现**（dramaBox 客户端从不读它）：`OPEN_URL` 只允许符合 1.7 链接规则的 https 链接；`DEEP_LINK` 只允许本应用声明的 scheme；`IN_APP_ROUTE` 的 `clickTarget` 只能是 8.3 页面标识清单里的值（清单只在 8.3 写一份，这里不重复），不含任何带参数的页面；这份清单就是路由白名单，后端保存时校验，客户端新增可跳转页面要先扩展 8.3 的清单（与推送、站内通知共用）。
- **各广告位触发**：`app_open` 冷启动（首次启动除外）或热启动后台停留 ≥ 冷却分钟数（冷却为 0 时最少间隔 60 秒），最多等 3 秒（从访问令牌就绪、即 `GET /api/ads/config` 可以发出时起算；令牌过期时先刷新，刷新耗时不计入；游客凭据过期时重新取凭据，即 `POST /api/auth/guest`，含设备校验，耗时同样不计入），迟到的丢弃，请求在途或已有广告在屏时不重入；`call_end` 通话结束、通话结束弹窗关闭后（通话在对话页内进行，没有单独的通话界面），每 `callEndInterval` 次一次，无广告不消耗间隔计数，请求最多等 3 秒，展示前确认仍在预期页面；`history_feed` 每 `feedInterval` 条插一张，只有预取已领到才插，领到但渲染失败的保留空位并上报 `ERROR`；`reward_credits` 由用户主动触发，无广告时提示"暂无可看的广告"。
- **不展示的情形**：通话进行中；广告位关闭；`adsEnabled=false`；游客不请求也不展示 `history_feed`、`reward_credits`。游客没有服务端冷却：客户端每发出一次 `IMPRESSION`，就把该广告位的最近展示时间（设备墙钟）写进本地存储，下一次展示前要求距上次不少于 `cooldownMinutes`；进程重启、重启手机后仍然有效，所以这里不用单调时钟；本地时间比记录的更早（用户改了时钟）时把记录重置为当前时间（22.1）。

### 22.8 统计

沿用 17.6 的任务（先删后插、窗口 `stats.land_window_days`、UTC 日、分布式锁）和手动补数：`POST /stats/land/ad-daily?date=`（`STATS:LAND`，在 17.6 的 `name` 列表和表清单里登记）。两张表的来源不同，补数的保护也不同：

- `StatAdDaily`（来源 Mongo 展示记录）：`date` 早于 `ads.log_retention_days` 的补数返回 400（来源已过期，先删后插只会把已有的行清空，与 17.6 对其他统计表的规则相同）。
- `StatAdNofillDaily`（来源 Redis 无广告计数，键 TTL 8 天，按（日期、平台、渠道、广告位、原因）分别计数）：只处理最近 7 个 UTC 日内的 `date`；更早的 `date`，这张表**不删不插**，补数请求只重算 `StatAdDaily` 并在响应里说明 `nofillSkipped=true`。读取用 `MGET`，不用 `KEYS`；`MGET` 失败时中止，不删已有行。键不存在（过期或当天没有）与失败是两回事，所以不能靠"读到空"判断数据丢了，只能靠上面的日期范围保护。

指标口径：`guestImpressions` 是 `accountId` 为空的 `IMPRESSION` 数（包含在 `impressions` 里）；`country` 取展示元数据里 `/ads/request` 时解析的国家；`channelCode` 同样取元数据里请求时存下的渠道码（缺失或不合法为 `unknown`）；`uniqueUsers` 取 `IMPRESSION` 组的去重账号数（游客不计入），**只存在每个（日、叶子）行上，不做汇总行相加，报表也不展示独立用户数**（跨日、跨行相加没有意义，按范围实时去重要扫 Mongo；dramaBox 现行代码里汇总行是把叶子相加的近似值 [子代理读码 `AdDailyStatLandUseCase.java:144-157,262`、`AdReportFacade.java:338,456`]，这里有意不照搬，是一处删减）；视频指标（`starts`、`completions`、`skips`、`totalWatchSeconds`）只统计素材类型当前是 `VIDEO` 的；`undeterminedImpressions = max(0, impressions − viewable − nonViewable)`。报表公式（比率用分子分母汇总后再除，不对各行比率求平均）：CTR = clicks / impressions；完播率 = completions / starts；可见率 = viewable / (viewable + nonViewable)；可测量率 = (viewable + nonViewable) / impressions；平均观看时长 = totalWatchSeconds / starts [子代理读码 dramaBox `AdReportFacade`；dramaBox 的用户手册里只有平均观看时长的公式是过期的，其余口径与代码一致 [核实，由审计子任务读过]]。

### 22.9 后台接口与校验（`/api/admin`）

| 资源 | 接口 | 权限 |
|---|---|---|
| 计划 | `GET/POST /ads/campaigns`、`GET/PUT /ads/campaigns/{id}`、`PUT …/status`、`DELETE …/{id}` | `ADS:CAMPAIGN` |
| 广告位 | `GET /ads/placements`、`PUT /ads/placements/{id}`（`enabled`、`frequencyCap`、`cooldownMinutes`、`rewardCredits`） | `ADS:PLACEMENT` |
| 单元 | `GET/POST /ads/units`、`GET/PUT /ads/units/{id}`（`GET` 返回单元及其素材的只读列表；`PUT` 只改单元自己的字段 `name`、`targeting`、`weight`、`dailyImpressionCap`，不碰素材，素材只能通过 `/ads/creatives` 修改）、`PUT …/status`、`DELETE …/{id}` | `ADS:UNIT` |
| 素材 | `GET/POST /ads/creatives`、`PUT …/{id}`、`PUT …/{id}/review`、`PUT …/{id}/serving-status`、`DELETE …/{id}`；`POST /ads/media`（上传素材文件，`multipart/form-data`、文件字段叫 `file`，缺少 `file` → 400 `INVALID_REQUEST`、`data.details` 为 `[{"ref":"file","reason":"EMPTY_NOT_ALLOWED"}]`，返回 `uploadId`、`mediaUrl`、`thumbnailUrl`、`width`、`height`、`bytes`、`durationSeconds`、`mediaType`，见下） | `ADS:CREATIVE` |
| 报表 | `GET /ads/report/overview`、`/by-placement`、`/by-campaign`、`/by-creative`、`/by-country`、`/nofill`（参数 `from`、`to`，`platform` 可选，`channelCode` 可选，规则见下） | `ADS:REPORT` |
| 辅助 | `GET /ads/meta` 返回 `{geoConfigured}`（GeoIP 是否已配置，后台单元表单据此提示）；无广告原因的说明文字没有接口，枚举在前端语言文件里 | 任一 `ADS:*` |

列表筛选（都支持 `page`、`pageSize`，规则同其他后台列表）：`/ads/campaigns` 按 `name`（包含）、`status`；`/ads/units` 按 `campaignId`、`placementId`、`status`、`name`；`/ads/creatives` 按 `adUnitId`、`campaignId`、`reviewStatus`、`servingStatus`、`type`。

报表响应：`overview` 返回 `{totals:{...}, daily:[{statDate, impressions, clicks, completions}]}`；`by-*` 返回行数组，每行是维度键（`placementId`/`campaignId`/`creativeId` 及其名称，或 `country`）加指标；`nofill` 返回 `[{statDate, slotKey, reason, cnt}]` 按原因汇总的数组。指标字段：`impressions`、`guestImpressions`、`starts`、`viewableImpressions`、`nonViewableImpressions`、`undeterminedImpressions`、`clicks`、`completions`、`skips`、`errors`、`totalWatchSeconds`，以及服务端用汇总后的分子分母算好的比率 `ctr`、`completionRate`、`viewableRate`、`measurableRate`、`avgWatchSeconds`（分母为 0 时为 `null`）。**没有独立用户数**（22.8）。`from`、`to` 是 UTC 日，区间不超过 `stats.max_range_days`（17.5、17.6 已登记的统计查询区间上限），超过 → `INVALID_REQUEST`。**`channelCode` 筛选**（六个报表接口都支持，响应形状不变）：不传 = 全部渠道；传了只含该渠道；传 `unknown` 看没带渠道的数据；不符合 `^[a-z0-9_-]{2,32}$` → 400 `INVALID_REQUEST`；与 `platform` 同时传是两个条件都满足。**导出**：`GET /stats/export/ads-report`（17.6）带与 `/ads/report/overview` 相同的参数——`from`、`to`，可选的 `platform`、`channelCode`——导出的就是页面上按这些筛选看到的那份。

校验和 dramaBox 的差别（都是它的遗留缺陷）：
- **素材接口的警告**：`POST/PUT /ads/creatives` 成功时响应 `data` 带 `warnings`（不拦截保存）：开屏或插屏素材 `skippable=false` 时 `AD_NOT_SKIPPABLE`，`ads.skip_after_seconds` 超过 5 时 `AD_SKIP_AFTER_TOO_LONG`。

- **素材规格由服务端校验**：素材文件必须先经 `POST /ads/media` 上传：服务端读出类型、尺寸、大小、时长，生成缩略图（图片缩到长边 480 像素的 JPEG；视频用 ffmpeg 取首帧，生成长边 480、质量 80 的 JPEG），接受 `image/jpeg`、`image/png`、`video/mp4`，大小上限 `upload.ad_media_max_bytes`，按文件内容判型，不符、为空或超限 400 `INVALID_FILE` 并删除文件，图片和视频同样去除元数据（规则同 3.2）。图片的宽×高超过 36000000（工程常量，`GET /meta` 的 `adImageMaxPixels`）同样 400 `INVALID_FILE` 并删除文件：先读文件头得到宽高，超过就拒绝，不解码；视频没有这条。写一条上传记录 `AdminUpload`（`uploadId`、`kind=AD_MEDIA`、`fileRef`、`thumbnailRef`（文件和缩略图的存储引用）、`width`、`height`、`bytes`、`durationSeconds`、`mediaType`、`uploadedBy`、`createdAt`、`consumedAt` 空）。**创建和修改素材只接受 `uploadId`，且上传记录的 `kind` 必须是 `AD_MEDIA`**（`kind` 不符 400 `INVALID_REQUEST`）：`width`、`height`、`bytes`、`durationSeconds`、`type` 全部取自上传记录，`mediaUrl`、`thumbnailUrl` 由上传记录的编号拼出（下面“上传文件的公开地址”），请求里带这些字段一律忽略（所以没有手填的办法）；创建时在事务里校验上传记录存在且未被使用，对照广告位的 `creativeAspect`、`creativeMinShortSide`、`creativeMaxBytes`、`ads.creative_aspect_tolerance_percent`，通过后在同一事务里用条件更新置 `consumedAt`、`consumedByType=CREATIVE`、`consumedById`（`UPDATE … WHERE consumedAt IS NULL AND deletingAt IS NULL`，更新不到行即已被使用或正在被清理）；素材的 `uploadId` 字段记下这个关联，素材删除时据此删文件；规格不符 400 `INVALID_REQUEST`，已被使用 409 `INVALID_STATE`，不存在 404 `RESOURCE_NOT_FOUND`。修改 `DRAFT`、`REJECTED` 素材时换成新的 `uploadId`：旧上传的记录和文件随即删除；请求带的 `uploadId` 等于素材当前的，视为没有变化。`mediaType` 的取值是 `IMAGE`、`VIDEO`（`AD_MEDIA`）或 `APK`，素材的 `type` 取它。**孤儿清理**：每天一次的清理任务先条件更新置 `deletingAt`（`WHERE consumedAt IS NULL AND createdAt < …`，已被消耗的排除），删文件成功后再删记录，文件删除失败的下次清理重试，以此清理 `consumedAt` 为空且早于 `upload.orphan_hours`（默认 24，提议）的上传记录和文件，与创建素材的条件更新互斥；素材被删除时（只有 `DRAFT`、`REJECTED` 能删）连同它的文件一并删除。24.2 的 APK 上传用同一个机制。dramaBox 的规格检查只在管理后台前端，绕过前端就绕过了检查。
- **上传文件的公开地址**（广告素材、缩略图、APK 共用）：客户端拿到的 `mediaUrl`、`thumbnailUrl`（22.3）、`apkUrl`、`downloadUrl`（24.2、24.3）是公开的 https 地址：不签名、不需要认证、不会过期（客户端缓存广告最多 240 分钟，更新包可以隔很久才下载，签名地址会在缓存期内失效）。地址由配置项 `upload.public_base_url`（17.5）加上传记录的编号拼出，数据里不存绝对地址，所以换域名只改配置、不用改数据。可以放在 CDN 后面，契约不要求。素材被删除或换了文件、上传记录被清理之后，旧地址返回 404。`upload.public_base_url` 没有配置时，`POST /ads/media` 和 APK 上传返回 503 `DEPENDENCY_UNAVAILABLE`。形象和外观文件的下载地址（3.9）不在此列，它们仍是带有效期的签名地址。
- 激励素材 `rewardAfterSeconds` 必填且在 5 到 30 之间，`VIDEO` 素材还不能超过 `durationSeconds`（`IMAGE` 没有时长，只受 5–30 约束）；Merge Patch 把激励素材的 `rewardAfterSeconds` 写成 `null` → `INVALID_REQUEST`；激励广告位的 `frequencyCap` 必须大于 0（它同时是每日奖励次数上限，22.6 第 7 步），`rewardCredits` 必须大于 0；`weight ≥ 0`；原生广告位的素材 `title`、`ctaText` 必填；`clickTarget` 按 `clickAction` 校验：`OPEN_URL` 符合 1.7 的链接规则（`mediaUrl`、`thumbnailUrl` 由 `POST /ads/media` 生成，同样满足），`DEEP_LINK` 的 scheme 是本应用声明的，`IN_APP_ROUTE` 必须是 8.3 页面标识清单里的值。
- 更新用 JSON Merge Patch 语义：请求里显式写 `null` 的字段被清空，没出现的字段不变（dramaBox 用的 MyBatis-Plus 默认跳过 `null`，计划的 `endAt`、素材的 `rewardAfterSeconds` 等清不掉）。
- 所有写操作写 `AdminAuditLog`，素材审核记 `reviewedBy`、`reviewedAt`；`detail` 只记改动的字段名和新旧值，不含用户内容。

### 22.10 配置、事件、账号删除

`AppConfig` 键（17.5 登记）：`ads.enabled`（默认 `false`）、`ads.preload_enabled`（`true`）、`ads.preload_ttl_minutes`（60，范围 1–240，保存时校验）、`ads.skip_after_seconds`（5，范围 0–60，保存时校验）、`ads.force_close_seconds`（15，范围 0–60，保存时校验，0 表示不启用兜底）、`ads.history_feed_interval`（5，范围 3–50，保存时校验）、`ads.call_end_interval`（3，范围 0–999；`0` 表示关闭间隔触发、等于不展示通话结束广告，由客户端据 `GET /api/ads/config` 的 `callEndInterval` 执行，服务端不数通话次数）、`ads.log_retention_days`（90，提议）、`ads.creative_aspect_tolerance_percent`（3，提议，22.2）、`ads.reward_complete_grace_seconds`（120，22.4）。工程常量不进配置：奖励检查的时钟宽限 2 秒、激励广告同时未完成的上限 2 个、Redis 元数据上限 4 小时（`IMPRESSION` 之后可延长到略多于 4 小时，22.6 第 4 步；22.3 的清理阈值已计入）、请求与上报限流、无广告计数 TTL 8 天、单元日计数 TTL 2 天、可视阈值。其余时间参数（预取深度、重试间隔、可视阈值）保持工程常量，运营改动不会破坏统计口径。

7.3 新增后端事件 `ad_reward_granted`（`impressionId`、`credits`、`slotKey`）。15.3 的代码声明功能开关新增 `ads.removed`（`BOOLEAN`，默认 `false`，作用点是 22.4 第 2 步）；15.9 的流水 `reason` 新增 `AD_REWARD`（只增加，不受退款扣回影响）。

账号删除（13.1）要同时删除该账号的 `AdFrequencyState`、`AdRewardVerification`，以及 MongoDB 里该账号的 `ad_impression_log`。游客的展示记录没有账号，不在删除范围，到期由 TTL 自动过期。

### 22.11 缺的输入与依赖

| 项 | 需要什么 |
|---|---|
| GeoIP 数据库 | 选型（例如 MaxMind GeoLite2 需要许可证，或由网关提供国家码头）；没有它，`geo` 定向的单元永远不匹配，后台单元表单要在没有配置时给出提示 |
| 素材存储与转码 | `POST /ads/media` 的存储位置，沿用 1.1 的文件存储 |
| 客户端广告位的入口 | 由客户端计划列出（`reward_credits` 的入口）；`IN_APP_ROUTE` 的白名单已定为 8.3 页面标识清单（22.7） |
| 广告位和奖励额度的初值 | `rewardCredits` 迁移时写入一个初值，运营可改；初值是产品决定，缺输入 |
| 广告隐私披露 | 第一方广告用账号语言、时区、IP 解析的国家做定向，并记录展示事件（存 IP 和国家，22.1；隐私披露内容由法务确认）。Google Play 的 Data safety 表单、Apple 的隐私标签、欧盟的同意（是否需要同意横幅）该怎么填，我没有核实；隐私政策的内容与域名也是缺的输入（26.2）。上线前必须有结论 |
| 激励广告的客户端入口与奖励额度 | 每日 `frequencyCap` 就是每日可得奖励次数，`reward_credits` 的 `frequencyCap` 初值（默认 5，22.2）与 `rewardCredits` 的乘积就是每个账号每天最多通过广告得到的额度；这个量是否合适是产品决定 |

### 22.12 验收

- [ ] `ads.enabled` 为 `false` → 所有广告位无广告，`GET /api/ads/config` 的 `placements` 为空；账号的功能开关 `ads.removed` 生效值为 `true` → 同样无广告，原因分别是 `GLOBAL_OFF`、`ENTITLEMENT_OFF`；两个权益同时有效、一个把 `ads.removed` 配成 `true`、另一个没配这个开关 → 仍然无广告
- [ ] 游客广告：游客凭据调用 `GET /api/ads/config` → `placements` 只含 `app_open`、`call_end`，`frequencyCap` 为 0；请求 `app_open` 成功，请求 `reward_credits`、`history_feed` → `data: null`（`NOT_FOR_GUEST`）；游客连续请求超过账号 `frequencyCap` 的次数仍然下发，`notBeforeDelayMs` 为 0，没有写任何 `AdFrequencyState`；没有任何凭据 → 401 `INVALID_TOKEN`；游客凭据对账号的 `impressionId` 调 `/ads/track` → 400 `INVALID_REQUEST`；游客的展示记录 `accountId` 为空、`ip` 和 `country` 有值，库里没有 `deviceId`；`/ads/report/by-country` 按国家汇总；`StatAdDaily.guestImpressions` 等于游客的 `IMPRESSION` 数；账号删除后游客的行不受影响、到期被 TTL 删除
- [ ] 频控：预取 3 个广告不增加 `impressionCount`，`IMPRESSION` 到达才加一；达到 `frequencyCap` 后 `/ads/request` 返回无广告（`FREQ_CAP`）；账号时区不同，当天的划分按各自的本地日
- [ ] 冷却：冷却期内请求，广告照常下发并带 `notBeforeDelayMs`；激励广告位（冷却为空）没有冷却
- [ ] 选取：同优先级的单元按权重随机；权重 0 的单元从不下发，一组全是 0 → 该组视为没有可选单元；优先级高的组全部被排除后才试下一组
- [ ] 定向：`languages: ["en"]` 匹配请求语言 `en-US`；保存非法的 `targeting`（未知键、版本号无法解析、时间格式错误）→ `INVALID_REQUEST`；`day_parts` 按账号本地时间（游客按 UTC）
- [ ] 跳过与点击：素材新建时 `skippable` 默认 `true`；`ads.skip_after_seconds` 保存 61 → `INVALID_REQUEST`，保存 0–60 成功（超过 5 时后台出警告，不拦截）；`ads.force_close_seconds` 默认 15、保存 61 → `INVALID_REQUEST`、保存 0 成功；`GET /api/ads/config` 的 `globalConfig.forceCloseSeconds` 与它一致，修改后下一次请求就变；`IN_APP_ROUTE` 的 `clickTarget` 不在 8.3 清单里（例如 `profile/42`）→ `INVALID_REQUEST`
- [ ] 素材：服务端拒绝规格不符的文件（比例、最短边、大小、激励素材的 `rewardAfterSeconds` 不在 5–30 或超过时长）；原生广告位缺 `title` 或 `ctaText` → `INVALID_REQUEST`；已通过的素材不能编辑，只能暂停
- [ ] 跟踪：`CLOSE` 在 `IMPRESSION` 之前也被接受并占终态，非激励广告位收到 `CLOSE` 只记录、没有别的效果；激励 `COMPLETE` 遇到已被清扫置 `REJECTED(EXPIRED)` 的验证行 → `status=EXPIRED`；遇到 `ERROR`、`CLOSED_EARLY` 的 → `REJECTED/TERMINAL_EXISTS`；元数据在而验证行不存在 → `status=EXPIRED`；未知 `event` → 400 `INVALID_REQUEST`；没有 `IMPRESSION` 就报 `COMPLETE` → 200 `status=REJECTED, reason=NO_IMPRESSION`；**没有 `IMPRESSION` 就报 `ERROR`（渲染或加载失败）→ 200 `status=OK` 且记录，`errors` 指标 +1，之后同一展示的 `COMPLETE`/`SKIP` → `REJECTED/TERMINAL_EXISTS`；激励广告的这种 `ERROR` 把验证行置 `REJECTED(ERROR)`，不再占"同时未完成"名额**；`COMPLETE` 和 `SKIP` 对同一展示只能有一个（`TERMINAL_EXISTS`）；重复事件 → `DUPLICATE`；并发的两个 `IMPRESSION` 只计一次频控；元数据过期 → `EXPIRED`
- [ ] 激励广告：`watchSeconds` 不足、或距 `IMPRESSION` 的服务端时间不足 → `REJECTED/WATCH_TOO_SHORT` 且不发放，**之后在元数据有效期内重发合格的 `COMPLETE` 仍然成功**（被拒的 `COMPLETE` 不占终态）；发放时 `CreditLedger` 多一条 `AD_REWARD`，`eventKey` 为 `impressionId`，余额同时更新；并发两次 `COMPLETE` 只发放一次；响应丢失后重发 `COMPLETE` 返回已发放的结果
- [ ] 观看时长容差：`rewardAfterSeconds=10` 的视频，`watchSeconds=9` 且距 `IMPRESSION` 的服务端时间 ≥ 8 秒 → 发放；`watchSeconds=8` → `REJECTED/WATCH_TOO_SHORT`；`IMAGE` 素材同样按 `rewardAfterSeconds − 1` 比较
- [ ] 过期的待验证行：预取一个激励广告，等其元数据过期（Redis 键不存在），再请求 `reward_credits` → 不被判 `FREQ_CAP`，该行变成 `REJECTED(EXPIRED)`；元数据仍在的 `PENDING` 行照常计入名额
- [ ] `ads.call_end_interval=0` 保存成功，`GET /api/ads/config` 返回 `callEndInterval=0`；`1` 到 `999` 同样可保存，`1000` → `INVALID_REQUEST`
- [ ] **防刷**：改过的客户端连续请求 `reward_credits`，`rewardGrantedCount` 加 `PENDING` 行数达到 `frequencyCap`（或有效 `PENDING` 行已有 2 个）后 `/ads/request` 返回无广告；即便已经拿到了超出上限的多个 `impressionId`，按时间合格地全部完成，发放到第 `frequencyCap` 次后其余的 `COMPLETE` 返回 `REJECTED/DAILY_CAP`，验证行 `REJECTED`，额度不再增加；跨本地日零点后重新计数
- [ ] 展示记录在 `ads.log_retention_days` 之后被 TTL 自动删除；账号删除后该账号的展示记录、频控行、奖励验证行都被删除
- [ ] 计划到 `endAt` 自动变 `ENDED`；更新请求里显式写 `null` 的字段（如 `endAt`）被清空
- [ ] 日汇总：重复落地结果不变；`MGET` 失败时不删除已有的无广告行；报表比率用分子分母汇总后再除；对早于 `ads.log_retention_days` 的日期补数 `ad-daily` → 400；对早于最近 7 个 UTC 日（`date` < 今天 − 6）的日期补数，`StatAdNofillDaily` 的已有行不变并返回 `nofillSkipped=true`；报表不返回独立用户数
- [ ] 广告报表按渠道：六个报表接口带 `channelCode=play` 只含 Google Play 版的数据，`channelCode=unknown` 只含没带渠道的数据，不传是全部渠道的合计；`channelCode` 不符合 `^[a-z0-9_-]{2,32}$` → 400 `INVALID_REQUEST`；与 `platform` 同时传两个条件都满足；`/ads/report/nofill` 带 `channelCode` 只含该渠道的无广告原因
- [ ] 广告报表导出：选了 `channelCode=play` 再 `GET /stats/export/ads-report`，只含该渠道的行，行数等于同参数的 `daily`；带 `platform` 时两个条件都满足；`channelCode` 格式不合格 → 400 `INVALID_REQUEST`
- [ ] 未知 `slotKey` 和停用的广告位都返回 `data: null`（`PLACEMENT_OFF`），不是 400；各无广告原因按（日期、平台、渠道、广告位、原因）累加 Redis 计数，`COOLDOWN_SUPPRESSED` 在广告照常下发时也计数，计数 TTL 为 8 天
- [ ] Merge Patch 把激励素材的 `rewardAfterSeconds` 写成 `null` → `INVALID_REQUEST`；后端事件 `ad_reward_granted` 在奖励事务提交之后记，参数 `impressionId`、`credits`、`slotKey`
- [ ] `COMPLETE` 的验证行属主不是当前调用者 → `INVALID_REQUEST`；元数据已过期而验证行 `VERIFIED` 且属主一致 → `OK` 和已发奖励；并发的第二个 `COMPLETE` 遇到 `PENDING` 的验证行 → 可重试的 503；预取的广告在元数据 TTL 末尾才展示，`IMPRESSION` 后元数据 TTL 被延长，合法的 `COMPLETE` 仍成功；孤儿清理已置 `deletingAt` 的上传不能再被创建消费
- [ ] 选取的失败路径：Redis 写元数据失败 → `META_WRITE_FAIL`、排除该单元继续；激励广告验证行写失败 → 删除刚写的 Redis 键并返回 500 `INTERNAL_ERROR`、不下发广告；单元的 `surfaces` 不含请求的 `X-Platform`、`X-Channel`（请求没带头时，`surfaces` 非空的单元）→ `TARGETING_MISS`，在定向之前判断；版本条件每一段取开头的数字比较（`0-beta` 按 0），某一段不以数字开头 → 不匹配；`StatAdDaily` 和展示日志的渠道码缺失或不合法记 `unknown`；`UNIT_DAILY_CAP`（游客和账号合计）、`TARGETING_MISS`、`NO_CREATIVE`（素材语言 `*` 或主语言子标签匹配）都排除该单元继续；全部排除后只返回最后一个原因
- [ ] `/ads/track` 的失败与并发：第 7 步事务因数据库错误失败（5xx）后终态键和幂等门被释放、客户端重试成功，业务拒绝（`DAILY_CAP`）则不释放；写入撞 `DuplicateKey` 视为 `DUPLICATE`；账号 `PENDING_DELETION`/`DELETING` 时拒绝发放；`IMPRESSION` 不检查上限；`/ads/request` 第 31 次、`/ads/track` 第 61 次（60 秒内）→ 429
- [ ] 状态机、权限与校验：计划 `ENDED` 终态不可编辑，删除只允许 `DRAFT` 或 `ENDED` 且名下没有单元；单元、素材按 22.3 的状态机，违反 → 409 `INVALID_STATE`；`servingStatus` 只有 `APPROVED` 的能切换；激励广告位 `frequencyCap` 或 `rewardCredits` 为 0 → `INVALID_REQUEST`；`weight < 0` → `INVALID_REQUEST`；报表 `from`/`to` 跨度超过 `stats.max_range_days` → `INVALID_REQUEST`；缺 `ADS:CAMPAIGN`/`ADS:PLACEMENT`/`ADS:UNIT`/`ADS:CREATIVE`/`ADS:REPORT` → 403 `ADMIN_FORBIDDEN`；写操作有审计日志；`GET /ads/meta` 返回 `geoConfigured`
- [ ] 配置范围与清理：`ads.preload_ttl_minutes` 保存 0 或 241、`ads.history_feed_interval` 保存 2 或 51 → `INVALID_REQUEST`；`AdFrequencyState` 保留 7 天后被每天的清理任务删除；`PENDING` 且 `createdAt` 早于 4 小时加 `ads.reward_complete_grace_seconds` 再加 30 秒的验证行被置 `REJECTED(EXPIRED)`，更晚的不动（IMPRESSION 延长了元数据存活时间的展示，其 `COMPLETE` 仍可得到奖励）；`POST /ads/media` 传不在白名单内的类型、空文件、超过 `upload.ad_media_max_bytes` → 400 `INVALID_FILE` 并删除文件
- [ ] 定向：`geo` 在国家解析不到时不匹配、没配 GeoIP 时永不匹配；`os_version_min`/`app_version_min` 缺的段当 0、请求缺值时不匹配；`platforms` 取 `ANDROID`/`IOS` 的子集
- [ ] 上传记录的 `kind`：用 `APK` 的 `uploadId` 创建素材、用 `AD_MEDIA` 的 `uploadId` 创建版本 → 400 `INVALID_REQUEST`；删除 `DRAFT` 素材或 `DRAFT` 版本时它的文件随之删除；修改草稿素材换新 `uploadId` 时旧上传被删除；带素材当前 `uploadId` 的 `PUT` 不报错；孤儿清理与创建并发时，被创建消费的上传不会被清理
- [ ] 素材上传：`POST /ads/media` 返回 `uploadId`、`mediaUrl`、`thumbnailUrl`（图片缩略图长边 480 的 JPEG，视频取首帧）；两个地址是公开的 https 地址，不签名、不需要认证、不过期，由 `upload.public_base_url` 和上传编号拼出，素材删除后返回 404，`upload.public_base_url` 没配置时上传 → 503 `DEPENDENCY_UNAVAILABLE`；创建素材只接受 `uploadId`，请求里手填的 `mediaUrl`、`thumbnailUrl`、`width`、`bytes` 被忽略；同一个 `uploadId` 用第二次 → 409 `INVALID_STATE`；宽高比超出 `ads.creative_aspect_tolerance_percent`、较短边小于 `creativeMinShortSide`、超过 `creativeMaxBytes` → `INVALID_REQUEST`；未被使用的上传在 `upload.orphan_hours` 后连文件被清理；`PUT /ads/units/{id}` 不改素材
- [ ] 激励广告位的频控只用一个计数：已发奖次数加有效待完成数；`impressionCount` 达到 `frequencyCap` 不影响激励广告位的请求；`CLOSE` 事件把 `PENDING` 验证行置 `REJECTED(CLOSED_EARLY)` 并释放名额，`CLOSE` 后再报 `COMPLETE` → `REJECTED/TERMINAL_EXISTS`；用户没上报 `CLOSE` 时，超过 `impressionAt + rewardAfterSeconds + ads.reward_complete_grace_seconds` 的待完成行在下一次请求时被置 `REJECTED(EXPIRED)`
- [ ] 计数的本地日用处理事件那一刻的服务器时间：跨午夜的一次激励展示，请求和展示记前一天、`rewardGrantedCount` 记在 `COMPLETE` 到达的那一天
- [ ] 入参校验：`context.platform` 不是 `ANDROID`/`IOS` → 400；`appVersion` 含非法字符被丢弃（依赖版本的定向不匹配）；`impressionId` 不是 UUID、`watchSeconds` 为负数或超过 86400 → 400；激励 `COMPLETE` 缺 `watchSeconds` → `REJECTED/WATCH_TOO_SHORT`
- [ ] `ad_impression_log` 每条自带 `expireAt`，改 `ads.log_retention_days` 只影响之后写入的记录；`StatAdDaily` 的主键含 `country`，同一展示数据按国家分行
- [ ] 通话进行中，客户端不请求也不展示广告（客户端验收，见客户端计划）

---

## 二十三、手机号登录与短信管理

依据：用户 2026-10-02 的决定——参照 dramaBox-admin 做手机号登录和短信管理。来源 [子代理读码 dramaBox `UserController`、`UserFacade`、`SmsUseCase`、`OtpDeliveryOrchestrator`、`SmsProvider`、`LaaffricSmsCallbackHandler`、`sql/migrate-sms-channel-template.sql`，dramaBox-admin `src/pages/sms/*`，Android `LoginFragment`]。抽取时发现 dramaBox 这套有大量安全和可靠性缺陷，下面**保留它的结构（OTP 存储与校验、先写记录再发送、通道与模板管理、送达回执匹配），逐条改掉缺陷**，每处写明原因。AvatarApp 是面向东南亚、中东、欧美的海外产品，不能以任何一种语言或国家为默认，所以国家码、模板语言、号码格式都不照搬 dramaBox（它只支持 +63 菲律宾、英文模板）。

### 23.1 关键设计点

| 设计点 | 内容 |
|---|---|
| 登录方式 | 在邮箱/Google/Apple 之外新增手机号加短信验证码；首次登录自动注册 |
| 总开关 | `auth.phone_login_enabled`（默认 `false`）。关闭时**用途为 `LOGIN` 的**发送和登录接口返回 404 `FEATURE_DISABLED`，客户端据此隐藏入口。**它只关闭登录和注册，不降低校验强度，也不影响删除账号**：用途为 `DELETE` 的发送（应用内）和网页删除的手机号路径（13.4）不受它约束，否则手机号账号在运营关闭登录后就删不掉自己（Google Play 和 App Store 的要求）。dramaBox 的 `otpEnabled` 关闭后任何验证码都能登录任何号码，本项目没有这种开关。关闭登录会让只有手机号的现有账号登不进来（它们仍可在已登录的设备上继续使用，也可以删除账号），后台在关闭这个开关时要提示现有手机号账号的数量 |
| 账号归属 | 手机号就是账号标识（同 dramaBox）：不提供给已有的邮箱或第三方账号绑定、换绑、解绑手机号的接口。手机号账号丢失号码后无法再通过手机号登录；邮箱或第三方账号不受影响。这是沿用 dramaBox 的范围，是否需要换绑流程是产品决定，需要用户确认 |
| 号码 | 用 libphonenumber 解析并校验，统一存 E.164，`User.phone` 唯一；国家码由用户选择，默认值取设备区域，不写死 |
| 验证码 | 6 位数字，`SecureRandom`；Redis 只存带密钥的哈希（HMAC-SHA256）和这次发送的 `msgId`（校验成功时据此回写发送记录的 `usedAt`，23.4），有效期 `sms.otp_ttl_seconds`（300）；绑定 `(purpose, 号码)`，各个用途（`LOGIN`、`DELETE`、`DELETE_WEB`、`EXPORT`）互不通用；**不存明文，管理员也看不到验证码**（OWASP ASVS V2.7.5 要求验证端只保留验证码的哈希 [核实 ASVS 4.0 第 2 章]；用户 2026-10-05 确认不提供“查看验证码”；dramaBox 把明文存在 Redis、消息队列、Mongo，还提供后台"查看验证码"，持有该权限的人可以先触发验证码再登录任何账号） |
| 投递渠道 | 保留 dramaBox 的"可信推送"：验证码默认走短信；请求带来的 `pushToken` 与该号码所属账号名下已登记的一条有效推送令牌完全相等时，改走 FCM 数据推送（省短信费、减少短信被刷），失败回退短信。规则见 23.3，推送载荷见 8.3 的 `type=otp` |
| 发送 | 同步发送，限时 `sms.send_timeout_ms`；按国家和优先级选出一个通道发送，失败不切换、不重试，直接返回 503 `SMS_SEND_FAILED`（用户 2026-10-05 的决定）。**例外是 `DELETE_WEB`**（13.4 网页删除的手机号路径）：短信走异步队列，响应不等待发送结果，发送失败只记日志，不返回 503。dramaBox 先返回 200 再异步发送，失败用户收不到验证码也不知道，且只有一个默认通道 |
| 滥用防护 | 号码级、IP 级、全局级限流 + 国家白名单 + 每日总量上限与告警；详见 23.3。dramaBox 的发送接口除了每号码 60 秒一次外没有任何限流，是短信费用盗刷的典型入口 |
| 记录 | `SmsSendRecord` 存 MongoDB，**真正的 TTL 索引**（dramaBox 的"30 天保留"没有生效，因为那个字段上建的是普通索引） |
| 后台 | 短信渠道、短信模板、发送记录三组页面，权限码 `SMS:CHANNEL`、`SMS:CHANNEL:CONFIG`、`SMS:TEMPLATE`、`SMS:RECORD`、`SMS:RECORD:PHONE_VIEW`、`SMS:RECORD:EXPORT` |

### 23.2 接口

| 接口 | 鉴权 | 说明 |
|---|---|---|
| `POST /api/auth/phone/otp/send` | 无（`DELETE`、`EXPORT` 要 JWT；账号处于 `PENDING_DELETION` 时 `DELETE` 仍然允许，只发到本账号的号码，手机号账号取消删除要用，2.8） | 请求 `{phone?, purpose, pushToken?}`，`purpose` 取 `LOGIN`、`DELETE` 或 `EXPORT`（`EXPORT` 用于 13.3 导出前的重新验证，规则同 `DELETE`），`pushToken` 是客户端当前的 FCM 令牌（可选，缺失就走短信）；`LOGIN` 必须带 `phone`；`DELETE`、`EXPORT` 要 JWT，`phone` 可省略（客户端只有 `phoneMasked`，不该让用户重输整个号码），省略时服务端用当前账号自己的号码；带了 `phone` 但不是当前账号的号码 → 400 `INVALID_REQUEST`（`message` 说明不是本账号的号码）；当前账号没有手机号而省略 `phone` → 400 `INVALID_REQUEST`。`DELETE` 和 `EXPORT` 的号码因此总是当前账号的号码，且**不受 `auth.phone_login_enabled`、`sms.allowed_country_codes`、`sms.daily_global_cap` 约束**（理由同 13.4 手机号路径）。响应 `{expireSeconds, resendSeconds, channel}`，`channel` 是 `SMS` 或 `PUSH`（23.3）。`LOGIN` 且 `auth.phone_login_enabled` 关闭 → 404 `FEATURE_DISABLED` |
| `POST /api/auth/phone/login` | 无 | 请求 `{phone, code, inviteCode?, deviceId?, integrityToken?, client?}`（新建账号时 `deviceId` 必须带，缺失返回 400 `INVALID_REQUEST`；`client` 同 2.2），`inviteCode` 与 2.2、2.7 一致；成功响应同 2.3 的登录响应，另加 `isNewAccount`。**号码已属于某个账号 → 登录那个账号**（`accountId` 是那个账号的 ID）；这样换新手机重装应用的老用户能直接回到自己的账号。号码未注册：新建账号，**必须带 `integrityToken`**（规则同 2.1，用途 `REGISTER`，缺失或不通过返回 403 `DEVICE_INTEGRITY_FAILED`；登录已有账号不要求；顺序：先校验验证码但不消耗，再检查 `deviceId`（缺失返回 400 `INVALID_REQUEST`）、`inviteCode`（格式不对或不存在返回 400 `INVALID_INVITE_CODE`，同 2.2，在消耗验证码之前）和 `integrityToken`，都通过才消耗验证码并创建账号，设备校验失败不会白白用掉验证码；**消耗是 Redis 上的原子“比较哈希并删除”（Lua 脚本）**，带同一个验证码的并发请求只有一个消耗成功，失败的一个返回 `OTP_EXPIRED`，所以不会创建两个账号，也不会让同一个验证码登录两次）（`phoneVerifiedAt` 置当前时间；设备转注册标记同 2.2）。请求带着游客凭据时凭据被忽略。账号状态同 2.3/2.8：`BANNED` → `ACCOUNT_BANNED`，`PENDING_DELETION` 照常登录成功（2.8），`DELETING` → `ACCOUNT_DELETING`（号码还被正在删除的账号占着时也是 `ACCOUNT_DELETING`，不新建账号）。邀请码规则同 2.4（只在新建账号时接受；登录已有账号时带了 `inviteCode` 也忽略，不报错）；所有注册路径（邮箱、Google/Apple、手机号）都接受邀请码，邀请关系和 9 节的邀请统计才完整（`InviteRecord` 的创建和奖励评估同 2.2，奖励规则见 9.1；新建账号时同样按 13.5 查防滥用标记，规则同 2.2）。因为现在没有"号码已被占用"的情形，本节不再有 `PHONE_TAKEN` |
| 账号删除（13.1）的身份确认 | JWT | 手机号账号：先 `otp/send` 用途 `DELETE`（不带 `phone`，服务端用本账号的号码发送，23.2），再在删除请求里带 `code`；同时有密码或第三方登录的账号三种凭据任选其一（13.1 的规则）。网页路径见 13.4 |

新增错误码（登记到 1.4）：`PHONE_INVALID`（400）、`SMS_COUNTRY_NOT_SUPPORTED`（400）、`OTP_RESEND_TOO_SOON`（429，`data.retryAfterSeconds`）、`OTP_INVALID`（400）、`OTP_EXPIRED`（400）、`OTP_ATTEMPTS_EXCEEDED`（429）、`SMS_SEND_FAILED`（503）、`FEATURE_DISABLED`（404）。号码级、IP 级超限用已有的 `RATE_LIMITED`（429），全局每日上限到了用 `SMS_SEND_FAILED`。dramaBox 的客户端期待 `OTP_RATE_LIMIT`，服务端实际发的是 `OTP_NOT_EXPIRED`，所以"请稍后再试"的提示从来没出现过；本项目以这里的码为准，客户端按码映射本地化文案。

### 23.3 验证码、限流与防滥用

- **验证次数**：同一 `(purpose, 号码)` 当前验证码最多错 `sms.otp_max_attempts`（5）次，用 Redis 原子计数；前 4 次错误返回 `OTP_INVALID`，**第 5 次错误时作废这个验证码，这一次的响应就是 `OTP_ATTEMPTS_EXCEEDED`**，之后没有未决验证码，再提交返回 `OTP_EXPIRED`，要重新发送才能继续（邮箱验证码同此，2.2.1）。**重新发送会替换旧验证码并把错误次数清零**，所以对一个号码一个滚动 24 小时内最多猜 `sms.max_per_phone_per_day × sms.otp_max_attempts` = 50 次，6 位码的命中概率约 5×10⁻⁵（这个上界依赖"替换并清零"，两个实现必须一致）。**不对号码上锁**：dramaBox 的做法是锁住号码 300 秒（实际是错 3 次后第 4 次起上锁，不论码对不对 [子代理读码 dramaBox `SmsUseCase.java:47-48,200-213`]），而发送接口是公开的，任何人都能反复触发验证码再输错，把受害者锁在登录之外。
- **验证成功**：验证码一次性，成功后立即删除；比较用常量时间。
- **发送限制**（每一层都要）：同一 `(purpose, 号码)` 两次发送间隔 ≥ `sms.otp_resend_seconds`（60）；同一号码**滚动 24 小时**内 ≤ `sms.max_per_phone_per_day`（10）；同一 IP 每小时 ≤ `ratelimit.otp_per_ip_per_hour`（20）；全局每个 UTC 日 ≤ `sms.daily_global_cap`，达到后拒绝发送（503 `SMS_SEND_FAILED`）并写告警 `SMS_DAILY_CAP_REACHED`（17.4）。号码级、IP 级超限返回 429 `RATE_LIMITED`，`OTP_RESEND_TOO_SOON` 只用于 60 秒间隔。**例外是 `DELETE_WEB`（13.4）**：号码级超限（含 60 秒间隔）静默成功、不发短信，不返回 `OTP_RESEND_TOO_SOON` 或 429，只有 IP 级超限返回 429 `RATE_LIMITED`，另受 `ratelimit.public_deletion_per_ip_per_hour` 约束。限流计数用原子操作（dramaBox 先自增再设过期，非原子）。用途为 `DELETE`、`EXPORT` 的发送（23.2）和网页删除的 `DELETE_WEB`（13.4）不受国家白名单和全局上限约束，号码级和 IP 级照常。**已知的取舍**：发送接口是公开的，攻击者能向一个受害者号码连续触发发送、用完它的 24 小时额度，使该号码在窗口内收不到登录验证码，最长一个滚动 24 小时；IP 级限制（每 IP 每小时 20 条）限制了攻击者能同时针对多少个号码，但不能消除这个问题。设备完整性校验（下面）能降低它，是缺的输入。这是保护短信费用与号码主人不被轰炸所必须付出的代价，不是疏漏。
- **可信推送投递**（`pushToken` 判定，dramaBox 的 `OtpDeliveryOrchestrator.resolveTrustedPush` 的做法 [子代理读码，由 ai-avatar-61 转述用户的要求，我没有重读该文件]）：同时满足才走推送——① 规范化后的号码对应的账号存在；② 请求里的 `pushToken` 与该账号名下已登记（8.1）的一条推送令牌**完全相等**（令牌在账号登录成功后才登记，所以一台设备第一次请求验证码一定走短信）。`LOGIN`、`DELETE`、`EXPORT` 三种用途都适用（`DELETE_WEB` 没有令牌，不适用）。推送载荷是 8.3 的 `type=otp`，`data` 只含 `code`、`purpose`；FCM 返回失败（例如 `UNREGISTERED`）或发送超时 → 立即回退短信，该回退算一次短信发送，受 `sms.daily_global_cap` 约束（到限 → 503 `SMS_SEND_FAILED`；`DELETE`、`EXPORT` 用途的回退和这两种用途的发送一样不受全局上限约束），并**重新生成验证码、替换推送时的旧码、错误次数清零**（旧码可能已经送达，不能再用）。令牌不匹配、缺失、账号不存在**一律走短信，响应一模一样**，不暴露原因，所以这个判定不能用来探测号码是否已注册。令牌是长随机串，攻击者拿到号码也拿不到目标设备的令牌，验证码不会被推到那台设备以外的设备。限制与取舍：① 国家白名单、号码级、IP 级、全局级限流照常对所有请求计数，攻击者拿陌生令牌仍会触发短信，这些限制不能因为有推送就去掉；② 全局每日短信上限（`sms.daily_global_cap`）只计短信条数，不计推送；上限到了以后，满足推送条件的请求仍可走推送，其余返回 503 `SMS_SEND_FAILED`；③ **推送投递后的第一次短信回退不受重发间隔限制**：某 `(purpose, 号码)` 走了推送后，服务端在 Redis 记一个标记（有效期同验证码），之后该 `(purpose, 号码)` 的**第一次**不带 `pushToken`（或令牌不匹配）从而走短信的重发，不受 `sms.otp_resend_seconds` 限制，发出后标记作废；它仍然计入号码滚动 24 小时额度、IP 限流、全局上限和 `SmsSendRecord`，并像任何重发一样替换旧验证码、清零错误次数；再之后的重发照旧受 60 秒限制。没有推送在先就没有这个例外，攻击者无法借它绕过间隔（要先有一次令牌匹配的推送，而推送只发给已登记设备）。④ FCM 只保证接受不保证送达（iOS 的纯 `data` 消息是静默推送，到达性更差，8.3），客户端在等待自动填入时给"改用短信重发"，重发请求**不带 `pushToken`**，这样一定走短信；⑤ 验证码经过 FCM 的服务器，和短信经过运营商一样是明文传输的信道，这一点接受；⑥ 验证码推送不是通知：不展示，不受 8.2 偏好控制，不写 `PushRecord`、`PushDelivery`，不进 17.6 的推送统计；日志和记录里的验证码一律替换为 `****`（23.3 日志条）；⑦ dramaBox 在 `otpEnabled` 关闭后任何验证码（"0000"）都能登录，本项目没有这个绕过。
- **国家白名单**：`sms.allowed_country_codes`（ISO 国家码列表）无默认值；为空则手机号登录无法启用（`PUT /config/{key}` 设 `auth.phone_login_enabled=true` 时校验，17.5）。号码国家不在白名单 → 400 `SMS_COUNTRY_NOT_SUPPORTED`。
- **号码处理**：libphonenumber 解析，必须有效（无效或线路类型被拒都返回 400 `PHONE_INVALID`），线路类型只接受 `MOBILE`、`FIXED_LINE_OR_MOBILE`（美国、加拿大等 NANP 号码的号码库不区分固话和手机，会返回它）、`VOIP` 和 `UNKNOWN`，拒绝 `FIXED_LINE`、`TOLL_FREE`、`PREMIUM_RATE`、`SHARED_COST`、`UAN`、`PERSONAL_NUMBER`、`PAGER`、`VOICEMAIL`（libphonenumber 对 NANP 返回 `FIXED_LINE_OR_MOBILE` 是我对该库行为的记忆，inferred, unverified；`VOIP` 接受是因为合法用户经常用网络号码，拒绝它能挡住多少盗刷我没有数据），结果统一为 E.164；用于限流和唯一性的都是规范化后的值（dramaBox 只用 `^\+\d{8,15}$` 检查形状，同一个号码的不同写法会变成两个账号）。账号被删除时同时释放号码（dramaBox 删除账号后号码永久不能再注册）。
- **日志**：任何级别的日志都不记验证码、不记完整号码（只记掩码），也不记通道返回的原始响应体（dramaBox 在 DEBUG 记完整的队列消息，在 INFO 记通道响应）。
- 设备完整性校验（Play Integrity、App Attest）是短信费用盗刷的业界常见防线；游客创建和新账号创建已经要求它（2.1、2.2），发送验证码接口是否也要求，是缺的输入（23.8）。

### 23.4 通道、模板、记录

**`SmsChannel`**：`id`、`channelCode`（管理员指定，唯一）、`name`、`providerCode`（必须是后端已注册的适配器之一）、`apiUrl`（必须是 https，且主机在适配器声明的白名单内）、`credentialsEnc`（**加密存储**，AES-GCM，密钥来自环境变量 `SMS_CRED_ENC_KEY`；dramaBox 明文存库，初始数据里还提交了真实凭据）、`extConfig`（JSON：`appId`、按国家的 `senderIds`）、`countries`（可空；通道服务的国家码，空表示全部）、`smsType`（`OTP` 或 `MARKETING`，创建时必填；发验证码只选 `OTP` 通道；`MARKETING` 目前没有任何发送功能使用，和 dramaBox 一样只是保留的类型 [核实 dramaBox 唯一调用处 `SmsUseCase.java:99` 只用 `OTP`]）、`enabled`、`priority`（数值小优先；同一国家有多个通道时取它最小的一个，不用于失败切换）、`createdAt`、`updatedAt`。接口永远不返回凭据，只返回 `hasCredentials`；更新时凭据字段留空表示不修改。删除、停用（`PUT …/enabled`）通道，或改 `smsType`、`countries` 使它不再是最后一个覆盖的启用 `OTP` 通道时，如果 `auth.phone_login_enabled=true` **或存在手机号账号**（它们删除账号要靠短信），返回 `INVALID_REQUEST`；模板同理，不能停用或删除最后一个启用的 `OTP` 模板。

**`SmsTemplate`**：`id`、`templateCode`、`name`、`locale`（语言代码，如 `en`、`zh-Hans`、`ar`）、`country`（可空，进一步限定国家）、`content`、`providerTemplateId`（可空；有些国家要求预先登记模板或发送方 ID，登记后的编号）、`smsType`（`OTP` 或 `MARKETING`，创建时必填，发验证码只选 `OTP` 模板）、`enabled`。`OTP` 模板的内容必须包含 `{code}`（dramaBox 只要求有任意 `{xxx}`）；可用占位符 `{code}`、`{minutes}`（有效分钟数）、`{appName}`。同一 `(smsType, locale, country)` 有多个启用模板时取 `id` 最小的。**选择规则**：用户语言按 1.2 的语言协商规则取 `otp/send` 请求头 `Accept-Language`：按 `q` 逐项尝试，对每一项依次找 `(locale, country)` 完全匹配的启用模板、同语言不限国家的启用模板，找到就用；所有项都没有，回退 `en`（同样先国家后不限国家）；没有任何可用模板 → 503 `SMS_SEND_FAILED`，不使用写死的文案（dramaBox 随机选一个模板、没有语言概念，并在没有模板时用写死的英文）。

**通道选择与发送**：选出启用、`smsType=OTP`、国家匹配的通道，取 `priority` 最小的一个（相同时取 `id` 小的），调用 `SmsProvider.send(message)`；失败（超时、供应商返回错误）**不切换到其他通道、不重试**，记录更新为 `FAILED`，返回 503 `SMS_SEND_FAILED`（用户 2026-10-05 的决定）。业界依据：自动切换通常由平台内部完成（Twilio Verify 称每个目的地有多条运营商线路，故障时自动切换）或做渠道回退（Vonage Verify v2：短信失败再走语音或 WhatsApp），没有标准要求应用自建多供应商切换 [核实 Twilio、Vonage 官方文档与博客，2026-10-05 查，属厂商宣传性质]。适配器接口只有 `send` 和回执解析两个方法，按 `providerCode` 注册，没有 dramaBox 那种"发送写死某一家、只有回执解析可插拔"的问题。**没有任何启用的、`smsType=OTP`、国家匹配的通道时**，返回 503 `SMS_SEND_FAILED`（`message` 写明没有可用通道），不创建 `SmsSendRecord`，写 ERROR 日志；启用手机号登录时的校验只保证至少有一个启用的通道，不保证覆盖白名单里的每个国家，所以后台保存 `sms.allowed_country_codes` 和通道的 `countries` 时，对“白名单里没有任何启用通道覆盖的国家”给出警告（不拦截）。**供应商未选定**，生产上线前必须实现至少一家的适配器；之前只留接口和一个测试桩，测试桩只在非生产环境可用。

**`SmsSendRecord`（MongoDB）**：`msgId`（本地 UUID，唯一）、`channel`（`SMS`/`PUSH`，投递渠道，23.3；推送也记在这里，因为它和短信是同一件事的两种投递）、`vendorMsgId`（有索引；推送没有）、`channelCode`（短信通道编码；推送固定 `FCM`）、`purpose`（`LOGIN`/`DELETE`/`DELETE_WEB`/`EXPORT`，后台测试发送为 `TEST`）、`mobile`（E.164）、`country`、`localeUsed`、`templateCode`（推送为空）、`contentRedacted`（验证码替换为 `****` 后的正文）、`sendStatus`（`QUEUED`/`SENDING`/`SUCCESS`/`FAILED`；推送为 FCM 是否接受）、`deliveryStatus`（`PENDING`/`DELIVERED`/`FAILED`；推送没有送达回执，固定 `NOT_APPLICABLE`）、`failReason`、`usedAt`（这条记录对应的验证码被成功校验的时间，空表示未使用；校验成功时按 Redis 里与哈希一起存的 `msgId` 回写，不涉及验证码本身；照 dramaBox 记录的 `used`、`used_at` 标志 [核实 审计 R61、R89]）、`createdAt`、`sentAt`、`deliveredAt`、`ttlExpiredAt`（带 `expireAfterSeconds=0` 的 TTL 索引，保留期 `sms.record_retention_days`，默认 30）。`(mobile, createdAt)`、`sendStatus`、`createdAt` 建索引。**不存验证码和明文正文**。

状态转移带前置条件：`deliveryStatus` 的 `DELIVERED`、`FAILED` 是终态，之后到达的 `PENDING` 回执不得改回，两个终态之间也不再转换（先到者生效）。**发送中的清扫**：`sendStatus` 为 `QUEUED`/`SENDING` 且 `createdAt` 早于 `now − (sms.send_timeout_ms + 60 秒)` 的记录，每分钟一次置 `FAILED`（`failReason=TIMEOUT`），进程崩溃不会让它们永远停在发送中（dramaBox 的状态写入没有前置条件；它的 24 小时去重键内后到的回执被丢弃，所以只有去重键过期之后到达的回执才可能把 `DELIVERED` 改回 `PENDING` [子代理读码 dramaBox `SmsReportListener.java:37-54`、`SmsSendRecordService.java:118-144`]）。

### 23.5 送达回执

`POST /notify/sms/{channelCode}/report`（公开，不走 Spring Security）。由适配器按供应商规范校验签名：**签名必须覆盖请求体**，并校验时间戳在 `sms.dlr_max_skew_seconds`（默认 300）内（dramaBox 的签名只覆盖时间戳，30 分钟内可用任意请求体重放；它的 `/push-report` 回调路径还完全没有签名校验 [子代理读码 dramaBox `LaaffricSmsCallbackHandler.java:27,71-78`、`LaaffricSmsPushReportCallbackHandler.java:58`]，本项目所有回调路径一律校验）。该路径要被反向代理转发（1.6），限流见 1.6。按 `vendorMsgId` 找记录；找不到则保留该回执一段时间（`sms.dlr_pending_seconds`，默认 600）等记录补上 `vendorMsgId`，不是直接丢弃：暂存在 Redis（键 `dlr_pending:{channelCode}:{vendorMsgId}`，值是回执列表，TTL 等于 `sms.dlr_pending_seconds`）；**回放由发送路径触发**——发送成功、把 `vendorMsgId` 写进 `SmsSendRecord` 之后立刻检查这个键，有暂存的回执就按到达顺序应用并删除键（状态转移规则同上）。**回执方写入暂存键之后必须再按 `vendorMsgId` 重查一次记录**，已存在就立即应用并删键，否则“回执方查不到、发送方写入并检查（键还空）、回执方才写暂存键”这个交错会让回执永远没人回放。幂等键是 `(vendorMsgId, status)`，不是只用 `vendorMsgId`（dramaBox 每条消息 24 小时内只处理第一个回执，后到的 `DELIVERED` 被丢弃）。**响应**：签名无效或时间戳超出窗口 → 401 `INVALID_SIGNATURE`（不透露是哪一步）；`channelCode` 不存在或通道已停用 → 404 `RESOURCE_NOT_FOUND`；其余（含找不到记录而暂存、重复回执）一律 200；日志里不记请求头签名和完整号码。

### 23.6 后台接口（`/api/admin`）

| 资源 | 接口 | 权限 |
|---|---|---|
| 渠道 | `GET /sms/channels`、`GET /sms/channels/{id}`（不返回凭据） | `SMS:CHANNEL` |
| | `POST /sms/channels`、`PUT /sms/channels/{id}`（含凭据）、`DELETE /sms/channels/{id}`、`PUT …/enabled` | `SMS:CHANNEL:CONFIG`（dramaBox 的 `PUT /{id}` 用的是低一级的权限，没有 `CONFIG` 的管理员也能改凭据和地址） |
| | `POST /sms/channels/{id}/test {mobile}` | `SMS:CHANNEL:CONFIG`，管理员在请求里提供号码，正文固定为测试文案，不能自定义；每个管理员每天不超过 `sms.test_per_day` 条（超出 → 429 `RATE_LIMITED`）；写审计日志和发送记录（dramaBox 的测试发送可以向任意号码发任意正文，没有上限，也不留记录） |
| | `GET /sms/meta` 返回 `{providers:[{code, allowedHosts}], testRemainingToday}`：后端已注册的短信适配器（渠道表单的服务商下拉据此填充，`apiUrl` 的主机白名单也在这里）和当前管理员今天还剩多少条测试发送额度（`sms.test_per_day` 减去已用） | 任一 `SMS:*` |
| 模板 | `GET/POST /sms/templates`、`PUT/DELETE /sms/templates/{id}`、`PUT …/enabled` | `SMS:TEMPLATE` |
| 发送记录 | `GET /sms/records`（筛选 `msgId`、`vendorMsgId`、号码（完整精确匹配）、投递渠道（`SMS`/`PUSH`）、通道、用途、发送状态、送达状态、是否已使用（`usedAt` 是否为空）、时间范围；按创建时间倒序，`pageSize` 上限 200） | `SMS:RECORD` |
| | `GET /sms/records/export?<与 /sms/records 相同的筛选>`：导出 `.xlsx`，`Content-Disposition: attachment; filename="sms-records-<from>-<to>.xlsx"`。规则同 17.6 的导出：`Authorization: Bearer`，行数不超过 `export.max_rows`（超出 400 `INVALID_REQUEST`），每个管理员每小时最多 `ratelimit.export_per_admin_per_hour` 次（超出 429），表头随 `Accept-Language`，每次导出写审计日志（筛选参数、行数）。这是记录级导出，不受 17.6“只导出聚合数据”的限制，所以号码按 `SMS:RECORD:PHONE_VIEW` 掩码，正文里的验证码已是 `****`。依据：dramaBox 有 `GET /sms/sendRecord/export`（xlsx，最多 5 万行，`SMS:SEND_RECORD:EXPORT`）[审计 R96] | `SMS:RECORD:EXPORT`，另需 `SMS:RECORD` |

号码默认掩码（规则同 2.9：只保留末 4 位），持有 `SMS:RECORD:PHONE_VIEW` 才返回完整号码；筛选只支持完整号码精确匹配，不支持模糊或正则（用户 2026-10-05 确认；dramaBox 的号码筛选是不转义的正则；Stripe 客户搜索对电话也只做精确匹配（`phone:"+..."`），邮箱和姓名才支持子串 [核实 Stripe 官方文档]；模糊匹配还会让没有完整号码权限的人逐位探测被掩码的号码 [推断，无来源]）。**没有"查看验证码"**（用户 2026-10-05 确认，验证码只存哈希）。导出见上面的 `GET /sms/records/export`，权限 `SMS:RECORD:EXPORT`。所有写操作写审计日志，`detail` 只记改动的字段名，**不含凭据值、验证码或完整号码**（渠道凭据变化只记"凭据已更新"）。

### 23.7 客户端（Android 和 iOS 一致）

- 手机号输入带国家选择器，默认值取设备区域；用 libphonenumber（Android `libphonenumber-android`，iOS `PhoneNumberKit`）解析并校验，提交 E.164。**不写死国家码、号码位数或提示文字**（dramaBox 客户端写死了 +63 和菲律宾号码规则）。
- 发送验证码时带上当前 FCM 令牌 `pushToken`（取不到就不带）。响应 `channel=PUSH` 时，只在登录页或删除确认页正在等待**该号码**的验证码时消费 `type=otp` 的推送并自动填入提交，其他时候丢弃；该推送不展示任何通知。等待超过几秒没收到时显示"改用短信重发"，重发请求不带 `pushToken`。`channel=SMS` 时用短信自动读取（下一条）。
- 验证码 6 位；Android 接入 SMS Retriever 或 User Consent 自动填入，iOS 输入框设置 `textContentType = .oneTimeCode`。
- 重发倒计时取自接口返回的 `resendSeconds`（dramaBox 客户端写死 60 秒，服务端返回的间隔从没传给客户端）。
- 按错误码映射本地化文案，覆盖 23.2 的全部错误码以及 `RATE_LIMITED`、`ACCOUNT_BANNED`、`ACCOUNT_DELETING`、`ACCOUNT_DELETION_SCHEDULED`；网络错误与服务端错误区分。
- 勾选用户协议后才能提交；登录成功后按 2.3 的响应处理，新账号走引导。
- `auth.phone_login_enabled=false` 时（服务端 `GET` 客户端配置里的 `phoneLoginEnabled`，第二十六节）不显示手机号入口。
- 登录页相关埋点沿用 7.3 的事件目录，另加后端事件 `phone_otp_sent`（`country`、`purpose`、`channel`）供漏斗使用；`register_completed.method` 增加 `phone`。

### 23.8 配置、数据变更与缺的输入

- **`User`** 新增 `phone`（可空，E.164，唯一索引）、`phoneVerifiedAt`（可空）；`email` 在手机号注册的账号上为空。`GET /api/account` 返回 `phoneMasked` 和 `providers` 里的 `PHONE`（2.9）。`User.phone` 在 §18 的 `User` 行登记。
- **配置键**（17.5 登记）：`auth.phone_login_enabled`（`false`）、`sms.otp_ttl_seconds`（300）、`sms.otp_resend_seconds`（60）、`sms.otp_max_attempts`（5）、`sms.max_per_phone_per_day`（10）、`ratelimit.otp_per_ip_per_hour`（20）、`sms.allowed_country_codes`（无默认值）、`sms.daily_global_cap`（无默认值）、`sms.send_timeout_ms`（5000）、`sms.record_retention_days`（30）、`sms.dlr_max_skew_seconds`（300）、`sms.dlr_pending_seconds`（600）、`sms.test_per_day`（5）；除标"无默认值"的外，默认值都是提议。环境变量：`SMS_CRED_ENC_KEY`、`OTP_HMAC_KEY`（验证码哈希密钥）。
- **缺的输入**：短信供应商（要选覆盖东南亚、中东、欧美的服务商；有些国家要求预先登记发送方 ID 和模板，供应商的覆盖范围、价格、这些要求我都没有核实）；设备完整性校验（Play Integrity、App Attest）——它是 23.3 里那个号码级限额取舍的主要缓解手段（游客创建和新账号创建已经要求设备校验，2.1、2.2；发送验证码接口是否也要求，建议上线前决定并实现，由用户定）；允许的国家列表；每日全局上限的取值。

### 23.9 验收

- [ ] `auth.phone_login_enabled=false` 时 `LOGIN` 用途的发送和登录返回 404 `FEATURE_DISABLED`，客户端配置里 `phoneLoginEnabled` 为 `false`；**此时 `DELETE` 用途的发送和网页删除的手机号路径仍然可用**，手机号账号能删除自己
- [ ] `PUT /config/auth.phone_login_enabled` 设为 `true` 时，没有配置 `sms.allowed_country_codes`、`sms.daily_global_cap` 或没有启用的通道 → `INVALID_REQUEST`；开关为 `true` 时清空这两个键、停用或删除最后一个启用的通道 → `INVALID_REQUEST`
- [ ] 同一号码的不同写法（带空格、带前导 0、带 `+`）规范化后是同一个账号；无效号码 → `PHONE_INVALID`；国家不在白名单 → `SMS_COUNTRY_NOT_SUPPORTED`
- [ ] 验证码 6 位，库里和日志里没有明文；验证码错 5 次 → `OTP_ATTEMPTS_EXCEEDED` 且该验证码作废，**号码本身不被锁**，重新发送后可以继续登录，新验证码的错误次数从零开始；验证码一次性
- [ ] 发送限流各层生效：同号码 60 秒内再发 → `OTP_RESEND_TOO_SOON`（`data.retryAfterSeconds`）；同号码滚动 24 小时内超过上限、同 IP 每小时超过上限 → 429 `RATE_LIMITED`（`DELETE_WEB` 除外：号码级超限静默成功、不发短信，只有 IP 级超限返回 429，13.4）；全局达到 `sms.daily_global_cap` 后拒绝发送（503 `SMS_SEND_FAILED`）并写 `SMS_DAILY_CAP_REACHED` 告警，次日 UTC 零点该告警自动 `RESOLVED`；`DELETE`、`EXPORT` 用途不受全局上限约束
- [ ] 美国、加拿大等 NANP 手机号（库返回 `FIXED_LINE_OR_MOBILE`）可以登录；固话、免费电话号码被拒（`PHONE_INVALID`）
- [ ] 可信推送：新设备（令牌未登记在该号码的账号下）第一次请求验证码 → `channel=SMS`，有短信记录；同一设备登录成功后再请求 → `channel=PUSH`，设备收到 `type=otp` 的数据推送，`SmsSendRecord` 有一条 `channel=PUSH`、没有短信、没有 `PushRecord`；推送失败（令牌失效）→ 回退短信，`channel=SMS`；别人拿到号码、用不匹配的令牌或不带令牌请求 → 短信，响应与号码未注册时完全一样，验证码不会推到登记设备以外；`purpose=DELETE` 同样适用；全局短信上限只计短信条数，推送不计，上限到了之后满足推送条件的请求仍走推送；推送路径下号码级、IP 级限流照常计数；记录和日志里没有验证码明文；不存在"关闭后任何验证码都能登录"的路径
- [ ] 推送后的短信回退：走了推送之后，**第一次**不带 `pushToken` 的重发立即发出短信（不受 60 秒间隔限制），号码 24 小时额度、IP 限流、全局上限、`SmsSendRecord` 都照常计入，新验证码替换旧的；紧接着的下一次重发仍返回 `OTP_RESEND_TOO_SOON`；没有推送在先的重发照旧受 60 秒限制
- [ ] 邀请码：`POST /api/auth/phone/login` 新号码注册时带 `inviteCode` → 建立 `InviteRecord`（规则同 2.4）；登录已有账号时带 `inviteCode` 被忽略、不报错；无效邀请码 → `INVALID_INVITE_CODE`
- [ ] 删除账号：`purpose=DELETE` 的 `otp/send` 不带 `phone` → 发给本账号的号码；带了别人的号码 → 400 `INVALID_REQUEST`；当前账号没有手机号 → 400 `INVALID_REQUEST`；`LOGIN` 不带 `phone` → 400 `INVALID_REQUEST`
- [ ] 选中的通道发送失败 → 不切换、不重试，记录 `FAILED`，503 `SMS_SEND_FAILED`，客户端立刻得到错误；同一国家有多个启用的通道时用 `priority` 最小的；只有 `smsType=OTP` 的通道和模板会被选中；没有适用的模板 → 同样 503，不使用写死的文案
- [ ] 模板按号码国家和用户语言选择；缺 `{code}` 的模板保存被拒；记录里的正文已把验证码替换为 `****`，没有验证码字段
- [ ] 没有凭据或带游客凭据，用未注册的手机号登录 → 缺 `integrityToken` 返回 403 且验证码没有被消耗；带有效的 `integrityToken` → 新建账号（`phoneVerifiedAt` 有值）；用**已注册**的手机号登录 → 返回那个已有账号的 `accountId`（不报错）；账号删除完成后号码可以重新注册，宽限期内用该号码登录成功（账号 `PENDING_DELETION`，之后的请求得到 `ACCOUNT_DELETION_SCHEDULED`），宽限期满、删除进行中登录得到 `ACCOUNT_DELETING`；被封禁的账号用手机号登录得到 `ACCOUNT_BANNED`
- [ ] 手机号账号删除账号时用短信验证码（用途 `DELETE`）确认；不是该账号的号码发的验证码不能用；同时有邮箱密码和手机号的账号，三种凭据任一都能通过 13.1
- [ ] 手机号账号在网页上删除：`deletion-request {phone}` 对已注册和未注册的号码返回相同结果，只有已注册的才收到短信；`deletion-confirm {phone, code}` 通过后按 13.1 执行；验证码错误 → `OTP_INVALID`
- [ ] 手机号账号的导出包含 `profile.json` 里的完整号码；`SmsSendRecord` 不因账号删除而被删除，到 `sms.record_retention_days` 由 TTL 删除
- [ ] 通道凭据加密存储，接口永远不返回；没有 `SMS:CHANNEL:CONFIG` 不能改地址和凭据；`apiUrl` 非 https 或主机不在适配器白名单 → `INVALID_REQUEST`
- [ ] 送达回执：签名覆盖请求体，请求体被改动 → 401；时间戳偏差超过 `sms.dlr_max_skew_seconds` → 401；`channelCode` 不存在或通道已停用 → 404；重复回执和暂存的回执都返回 200；暂存的回执在发送路径写入 `vendorMsgId` 之后被回放；`DELIVERED` 之后到达的 `PENDING` 不改回；回执先于记录到达，不丢
- [ ] 发送记录有真正的 TTL 索引，`sms.record_retention_days` 之后被删除；无 `SMS:RECORD:PHONE_VIEW` 看到掩码号码（只留末 4 位）；号码筛选只接受完整号码精确匹配；验证码校验成功后对应记录的 `usedAt` 有值，可按“是否已使用”筛选；`GET /sms/records/export` 返回 `.xlsx`，没有 `SMS:RECORD:EXPORT` → 403，号码按 `SMS:RECORD:PHONE_VIEW` 掩码，超过 `export.max_rows` → 400，每次导出有审计日志；`GET /sms/meta` 返回已注册适配器和当日剩余测试额度
- [ ] 任何日志里没有验证码、完整号码和通道原始响应
- [ ] 验证码错误次数：第 1 到 4 次错误 → `OTP_INVALID`，第 5 次错误 → `OTP_ATTEMPTS_EXCEEDED` 且验证码作废，之后再提交 → `OTP_EXPIRED`；`phone/login` 带同一个验证码并发提交 → 只有一个消耗成功并创建账号，另一个 `OTP_EXPIRED`
- [ ] 没有任何启用的、`smsType=OTP`、国家匹配的通道 → 503 `SMS_SEND_FAILED`，不创建发送记录；`purpose=EXPORT` 与 `DELETE` 一样走可信推送、不受国家白名单和全局上限约束；后台测试发送的记录 `purpose=TEST`
- [ ] 送达回执的暂存：回执先于 `vendorMsgId` 写入到达 → 暂存在 Redis，发送路径写入 `vendorMsgId` 后被回放；无效签名 401，未知通道 404
- [ ] 手机号新建账号缺 `deviceId` → 400 且验证码未被消耗；`inviteCode` 无效 → 400 `INVALID_INVITE_CODE` 且验证码未被消耗；暂存的回执超过 `sms.dlr_pending_seconds` 仍无记录 → 被丢弃；`sendStatus` 停在 `SENDING` 超过 `sms.send_timeout_ms` 加 60 秒 → 被清扫置 `FAILED`（`TIMEOUT`）；`DELIVERED` 与 `FAILED` 之间不互相转换；存在手机号账号时不能停用最后一个启用的 `OTP` 通道或模板；后端事件 `phone_otp_sent` 在发送验证码时记
- [ ] 各用途的验证码互不通用（`LOGIN` 的码不能用于 `DELETE`）；验证码过期 → `OTP_EXPIRED`；更新通道时凭据字段留空表示不修改；模板按 `Accept-Language` 的 `q` 顺序逐项、先国家后不限国家、都没有回退 `en`；后台测试发送每管理员每天超过 `sms.test_per_day` → 429 `RATE_LIMITED`，正文固定，写发送记录（`purpose=TEST`）；回执接口超过 `ratelimit.sms_dlr_per_min` → 429
- [ ] 可信推送失败回退短信：受 `sms.daily_global_cap` 约束（到限 → 503 `SMS_SEND_FAILED`，`DELETE`/`EXPORT` 用途除外），回退重新生成验证码、替换推送时的旧码、错误次数清零；回执方写入暂存键之后重查记录，与发送路径交错时回执不丢
- [ ] 保存 `auth.phone_login_enabled=false` 的响应带 `warnings`（`PHONE_LOGIN_DISABLED_ACCOUNTS`，`count` 为现有手机号账号数）；保存 `sms.allowed_country_codes` 后有国家没有启用通道覆盖 → `warnings` 带 `SMS_COUNTRY_UNCOVERED`；`ads.skip_after_seconds` 超过 5 → `AD_SKIP_AFTER_TOO_LONG`；`ads.force_close_seconds` 保存 0 而存在不可跳过的开屏或插屏素材 → `AD_FORCE_CLOSE_DISABLED`；创建不可跳过的开屏素材 → 响应 `warnings` 带 `AD_NOT_SKIPPABLE`

---

## 二十四、应用版本管理与强制更新

依据：dramaBox 的 `app_version_release`、`GET /config/app-version` 和它的侧载自更新方案 [子代理读码 dramaBox `AppVersionFacade`、`ConfigFacade.checkAppVersion`、`sql/migrate-app-version-release.sql`、`UploadFacade.uploadApk`，DramaverseDemo `SelfUpdateManager.kt`、`InAppUpdateManager.kt`，dramaBox-admin `src/pages/plat/app-version/index.tsx`]。dramaBox 的这套**按渠道包管理版本**：每个渠道一个生效版本；侧载渠道包带 APK 地址、文件大小、SHA-256，客户端自己下载安装；上架 Google Play 的包用 Play In-App Updates，由 Play Console 里设置的更新优先级（4 及以上强制）决定，不调这个接口；它在 `plat_app_config` 里的 `forceUpdate` 开关在 Android 客户端上没有任何作用，后台能改但不生效。AvatarApp 有三个渠道（24.7）：Google Play（`play`）、官网直接下载的 APK（`direct`）、App Store（`appstore`），所以**两种机制都要**：版本表按渠道管理，STORE 渠道带商店链接，DIRECT 渠道带 APK 上传、地址、大小和 SHA-256，客户端自更新（24.4）。**强制更新以后端的最低版本号为唯一依据**（iOS 和直接下载的包没有 Play In-App Updates 这样的机制），Play 渠道也不使用 Play 的更新优先级，不引入 `forceUpdate` 这类并行开关：这是对 dramaBox 的 Play 包做法的有意改动，理由是三个渠道用同一套判定，行为一致、不会出现"后台改了不生效"的开关。

### 24.1 数据

`AppVersionRelease`：`id`、`channelCode`（渠道包，24.7；范围键，创建后不可改）、`platform`（`ANDROID`/`IOS`，取自渠道，冗余存一份方便筛选）、`versionName`（`x.y.z`）、`versionCode`（整数；Android 取 `versionCode`，iOS 取 `CFBundleVersion`，**iOS 的构建号必须是整数**，这是对两个客户端的约定）、`minVersionCode`（整数，≥1，≤ `versionCode`）、`storeUrl`（STORE 渠道必填，DIRECT 渠道为空）、`apkUploadId`（关联的上传记录，24.2）、`apkUrl`（不存，由 `apkUploadId` 拼出公开地址，22.9）、`apkSizeBytes`、`apkSha256`（DIRECT 渠道必填，STORE 渠道为空；只能由 APK 上传接口产生，不接受手填）、`changelog`（JSON 对象，键是语言代码如 `en`、`zh-Hans`，值是更新说明；必须有 `en`）、`status`（`DRAFT`/`ACTIVE`/`ARCHIVED`）、`createdBy`、`activatedBy`、`activatedAt`、`createdAt`、`updatedAt`。

- 版本按**渠道**管理，每个渠道各有自己的生效版本；`platform` 取自渠道。
- **唯一约束**（dramaBox 的表没有任何唯一约束，"每个渠道至多一个生效版本"只靠应用层加锁保证 [子代理读码 dramaBox `sql/migrate-app-version-release.sql`、`AppVersionFacade.updateStatus`]）：`UNIQUE (channelCode, versionCode)`；PostgreSQL 部分唯一索引，每个 `channelCode` 至多一行 `status='ACTIVE'`；列表索引 `(channelCode, status, createdAt DESC)`。

### 24.2 状态机与后台操作

和 dramaBox 一致：`DRAFT → ACTIVE`（同一事务里对该渠道所有行 `SELECT … FOR UPDATE`，把原来的 `ACTIVE` 置为 `ARCHIVED`，再把本行置为 `ACTIVE`，条件更新 `WHERE status='DRAFT'`）；`ACTIVE → ARCHIVED`（手动下线）；`ARCHIVED` 是终态。只有 `DRAFT` 能编辑和删除。创建时一律是 `DRAFT`。违反状态机的操作（编辑或删除非草稿、激活 `ARCHIVED`、下线非 `ACTIVE`）返回 409 `INVALID_STATE`；版本不存在 404 `RESOURCE_NOT_FOUND`。

校验：`versionCode` 严格大于该渠道当前 `ACTIVE` 的 `versionCode`（创建、编辑草稿、激活三处都检查）；`1 ≤ minVersionCode ≤ versionCode`；`versionName` 匹配 `^\d+\.\d+\.\d+$`；`storeUrl`（STORE 渠道必填，DIRECT 渠道必须为空）按渠道所属平台校验：**ANDROID** 必须是 `https://play.google.com/store/apps/details?id=<应用包名>`，`id` 等于环境变量 `GOOGLE_PLAY_PACKAGE_NAME`（1.5），查询键**只允许 `id`（必填，只出现一次，等于包名）、`hl`、`gl`（各至多一次）**，除这三个键外不允许其他查询键（包括 `referrer`），也不允许端口、用户信息、片段；`hl`、`gl` 的值匹配 `[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})?`；主机 `play.google.com` 不区分大小写，路径必须是 `/store/apps/details`（以上与客户端 `PlayListing` 一致，客户端只接受这种值，否则用自己的包名构造商店链接，所以录错链接不会让强制更新页面唯一的按钮指向别处）；**IOS** 主机必须是 `apps.apple.com`，路径形如 `/<国家码>/app/<名称>/id<数字>` 或 `/app/id<数字>`（App Store 链接的这个形状是我的印象，没有核实 Apple 文档）。两者都还要符合 1.7 的链接规则；`changelog` 含 `en`。DIRECT 渠道的版本必须带 `apkUploadId`（APK 上传接口返回的 `uploadId`，下面），`apkUrl`、`apkSizeBytes`、`apkSha256` 全部取自上传记录，请求里带这三个字段一律忽略（所以没有手填的办法）；STORE 渠道带 `apkUploadId` → `INVALID_REQUEST`；上传记录的 `kind` 必须是 `APK`（不符 400 `INVALID_REQUEST`），不存在 404 `RESOURCE_NOT_FOUND`，已被别的版本使用 409 `INVALID_STATE`；创建时在同一事务里用条件更新（`WHERE consumedAt IS NULL AND deletingAt IS NULL`）置 `consumedAt`、`consumedByType=APP_VERSION`、`consumedById`，版本的 `apkUploadId` 记下关联，`DRAFT` 版本删除时据此删文件；编辑 `DRAFT` 版本时换新的 `apkUploadId`，旧上传记录和文件随即删除，带当前 `apkUploadId` 视为无变化。出错返回 `INVALID_REQUEST`，`message` 写明字段（dramaBox 的报错是写死的中文，不照搬）。

**APK 上传** `POST /api/admin/uploads/apk`（`multipart/form-data`，字段 `file`，权限 `APPVERSION:MANAGE`，照 dramaBox 的 `UploadFacade.uploadApk` [子代理读码]）：文件不能为空、扩展名 `.apk`、大小不超过 `upload.apk_max_bytes`（17.5，默认 100 MB，同 dramaBox），不符返回 400 `INVALID_FILE`；**文件里必须有 APK Signing Block（尾部有魔数 `APK Sig Block 42`，即 v2 以上签名）**，否则 400 `INVALID_FILE`——直接下载渠道要靠它注入归因编号（10.4 第 6 条）；服务端流式计算 SHA-256，用随机对象名存进 1.1 的文件存储（内容类型 `application/vnd.android.package-archive`），写一条 `AdminUpload`（`kind=APK`，22.9 的机制），响应 `{"uploadId":"…","apkUrl":"…","apkSizeBytes":123,"apkSha256":"…"}`，后台表单显示后三项（只读），创建版本时只提交 `uploadId`。未被版本使用的上传按 `upload.orphan_hours` 清理；`DRAFT` 版本被删除时连同它的 APK 文件一并删除，`ARCHIVED` 版本的文件保留（用于核对和排查，不用于回滚：Android 不允许安装 `versionCode` 更低的包，要回退只能发布一个 `versionCode` 更高的新包）。

**激活前确认商店可见（本项目新增，只适用于 STORE 渠道；DIRECT 渠道不需要 `confirmStoreLive`，带了也忽略，改为服务端在激活时确认存储里的 APK 文件存在、大小和 SHA-256 与记录一致，否则 `INVALID_REQUEST`；文件校验在开事务之前完成，事务内只复核记录里的 `apkSha256` 未变，避免 100 MB 的哈希计算占着行锁）**：激活一个版本就是对所有用户宣布"有新版本可更新"（`minVersionCode` 高于用户当前版本的还会被强制更新）；如果这时商店里的新版本还没对用户可见（审核、分阶段发布），用户会被带到一个没有新版本的商店页，强制更新的用户则永久卡住。所以 **STORE 渠道每一次** `DRAFT→ACTIVE` 的请求都必须带 `confirmStoreLive=true`，后台页面在此时弹出确认"新版本已经在商店对用户可见了吗"，不带则返回 400 `INVALID_REQUEST`；当新版本的 `minVersionCode` 大于当前 `ACTIVE` 行的 `versionCode`（即会强制**已经装着当前最新版本**的用户更新）时，确认框的文字改为强提示。取"每一次"而不是只在抬高最低版本时，是因为可选更新同样会把用户带到没有新版本的商店页。dramaBox 没有这个保护 [子代理读码 dramaBox `AppVersionFacade`：没有发布可见性的检查]。

接口（`/api/admin`）：`GET /app-versions?channelCode=&platform=&status=`、`GET /app-versions/{id}`、`POST /app-versions`、`PUT /app-versions/{id}`（仅草稿）、`PUT /app-versions/{id}/status {status, confirmStoreLive?}`、`DELETE /app-versions/{id}`（仅草稿）、`POST /uploads/apk`（上面）。权限：`APPVERSION:VIEW` 查看，`APPVERSION:MANAGE` 创建、编辑、删除草稿、上传 APK，`APPVERSION:ACTIVATE` 激活、下线（dramaBox 只有一个权限码，谁有谁能做所有事 [子代理读码 同上]，这里拆开）。所有写操作写审计日志。列表默认按"生效中的排前面，其余按创建时间倒序"（同 dramaBox）。

### 24.3 客户端检查接口

```
GET /api/app-version?platform=ANDROID&versionCode=123&channel=play
```

不需要登录（dramaBox 同样不需要，它用 `X-Channel`、`X-App-Version-Code` 请求头，这里用查询参数）。`platform`、`versionCode` 必填，`channel`（渠道码，24.7）可省略，省略时取该平台的默认渠道（`ANDROID` → `play`，`IOS` → `appstore`）；直接下载的包必须带 `channel=direct`。缺失、`versionCode` 不是正整数、平台不认识、`channel` 格式不合法（不符合 `^[a-z0-9_-]{2,32}$`；不当作没带，不落到默认渠道）或渠道不认识、渠道所属平台与请求的 `platform` 不一致、该渠道没有 `ACTIVE`，一律返回 `hasUpdate=false`（失败时放行，同 dramaBox）。服务端按 `(channelCode)` 把生效版本缓存在 **Redis**（所有实例共享，不用进程内缓存），有效期 `appversion.cache_seconds`（默认 60，兜底），激活或下线的事务提交后，先把 `appversion_ver:{channelCode}` 加一再删除该渠道的缓存键；读取者读库前先取这个版本号，写回缓存时用 Lua 比对版本号未变才写，所以读到旧值的读取者不会把旧值写回缓存，所以任何实例的下一次请求都读到新结果（dramaBox 每次请求都查库，不缓存 [子代理读码 `ConfigFacade`、`AppVersionReleaseServiceImpl`]）。

判定（和 dramaBox 的 `ConfigFacade.checkAppVersion` 一致）：客户端 `versionCode` ≥ 生效版本的 `versionCode` → 无更新（相等也是无更新）；否则 `hasUpdate=true`，`forceUpdate = versionCode < minVersionCode`（等于 `minVersionCode` 时是可选更新，不是强制）。

响应：`{"hasUpdate":true,"forceUpdate":false,"latestVersion":"1.2.0","latestVersionCode":120,"storeUrl":"https://…","downloadUrl":null,"fileSize":null,"sha256":null,"changelog":"…"}`；STORE 渠道有 `storeUrl`，DIRECT 渠道有 `downloadUrl`（公开的 https 地址，22.9）、`fileSize`、`sha256`（dramaBox 的响应同样有这三个字段 [子代理读码 `ConfigFacade`]），另一种渠道的这些字段为 `null`；无更新时只有 `hasUpdate=false`、`forceUpdate=false`。**`hasUpdate`、`forceUpdate` 必须序列化为 JSON 布尔值**（`true`/`false`），不能是字符串 `"true"` 或数字 `1`：客户端严格解析，类型不对就按失败放行（本接口失败时放行，上文），后端一旦序列化成字符串，强制更新会悄悄失效。`changelog` 按 1.2 的语言协商规则取 `Accept-Language`（`changelog` 里有哪些语言键就是可用版本），没有则取 `en`。不返回 `minVersionCode`（dramaBox 返回了，但客户端从不使用 [子代理读码 `SelfUpdateManager`]）。

### 24.4 客户端行为（Android 和 iOS 一致）

- **检查时机**：冷启动一次；回到前台时距上次检查满 10 分钟再查（数字取自 dramaBox [子代理读码 `SelfUpdateManager`]）。
- **强制更新**（STORE 渠道）：不可取消的对话框，唯一的按钮打开 `storeUrl`；**整个应用被挡住**，包括应用恢复到前台时重新显示（dramaBox 的强制对话框不可取消、回到前台会重显，但检查点只在 `MainActivity`、`HomeFragment`、`HomePlayerFragment` 三处，且 Fragment 状态已保存时会跳过显示，有缺口 [子代理读码 `SelfUpdateManager.kt:204`、`AppUpdateDialog.kt:36,43-45,75-76`]；本项目把对话框放在应用的根层，不依赖各页面各自检查）。Android 在强制更新时先判断 Play In-App Updates 的 `IMMEDIATE` 是否可用（`isUpdateTypeAllowed`）：可用就走 `IMMEDIATE` 流程，不可用或失败就打开 `storeUrl`；iOS 打开 `storeUrl`。
- **可选更新**：可关闭的对话框，"稍后"之后 24 小时内不再提示，**按目标版本记录**（dramaBox 的"稍后"不分版本，关掉 1.0.29 会连带压住 24 小时内发布的 1.0.30 [子代理读码 `SelfUpdateManager`]）。
- **DIRECT 渠道的自更新**（照 dramaBox 的 `SelfUpdateManager`，只在直接下载的构建里，上架 Google Play 的包没有这套代码和下面的权限 [子代理读码 dramaBox 笔记 `_scratch_dramabox_app_version.md`]）：检查到 `hasUpdate` 后，可选更新弹出对话框（版本名、更新说明、文件大小、"立即更新"、"稍后"，"稍后"的规则同上），强制更新是不可取消的对话框，只有"立即更新"。点击后客户端把 `downloadUrl` 下载到应用私有目录并显示进度，下载完成后**校验 SHA-256 与响应里的 `sha256` 一致**，不一致就删除文件并提示失败、可以重试，校验通过才通过 `FileProvider` 调系统安装器安装；没有"安装未知应用"权限时先引导用户到系统设置授权（清单里声明 `REQUEST_INSTALL_PACKAGES`，只在直接下载的构建里声明）；已经下载并校验通过的文件不重复下载。更新包必须用和已安装版本相同的签名密钥签名，否则系统拒绝安装（运维约束）。
- **失败**：网络错误、接口报错一律放行，不提示、不阻挡。
- 强制更新页面上的文案走客户端的语言文件。

### 24.5 配置和事件

不新增配置项给客户端用；`appversion.cache_seconds`（默认 60，提议）和 `upload.apk_max_bytes`（默认 104857600，即 100 MB，同 dramaBox 的上限）在 17.5 的表里登记。不在客户端远程配置（第二十六节）里放 `forceUpdate`、`appVersionAndroid` 这类键，避免出现 dramaBox 那样"能改但不生效"的开关。

### 24.6 验收

- [ ] 同一渠道激活第二个版本，原生效版本自动 `ARCHIVED`；同时激活两个版本（并发）最终恰好一个 `ACTIVE`（先后顺序不同，成功的一方也不同）；数据库部分唯一索引拒绝每个渠道出现两个 `ACTIVE`
- [ ] 客户端 `versionCode` 等于、大于生效版本 → `hasUpdate=false`；介于 `minVersionCode` 和生效版本之间 → 可选；小于 `minVersionCode` → 强制；等于 `minVersionCode` → 可选
- [ ] 响应里 `hasUpdate`、`forceUpdate` 的 JSON 类型是布尔（接口测试断言类型，不是只比较文字），强制更新场景下 `forceUpdate` 是 `true` 而不是 `"true"` 或 `1`
- [ ] `storeUrl` 校验：ANDROID 行不是 `https://play.google.com/store/apps/details?id=<GOOGLE_PLAY_PACKAGE_NAME>`（含包名不符、其他主机、`referrer` 等多余查询键、重复键、端口、片段）→ `INVALID_REQUEST`，带 `hl`、`gl` 的合法链接可保存；IOS 行不是 `apps.apple.com` 的 App Store 链接 → `INVALID_REQUEST`
- [ ] 缺 `platform`、`versionCode` 为 0 或非数字、平台不认识、没有生效版本 → `hasUpdate=false`，不报错
- [ ] STORE 渠道的任何 `DRAFT→ACTIVE` 都必须带 `confirmStoreLive=true`，不带 → 400 `INVALID_REQUEST`；DIRECT 渠道不需要它，带了被忽略；`minVersionCode` 大于当前生效行的 `versionCode` 时后台确认框用强提示文字
- [ ] `ACTIVE`、`ARCHIVED` 的版本不能编辑、不能删除；`ARCHIVED` 不能再激活
- [ ] `changelog` 缺 `en` → 400；客户端用 `Accept-Language: zh-Hans` 拿到中文，没有该语言的拿到英文；`Accept-Language: th-TH, zh-Hans;q=0.9` 且更新说明没有 `th` 时拿到中文（按 `q` 逐项，不是只看第一项）
- [ ] 激活或下线后，检查接口在下一次请求就返回新结果（缓存已失效）；两个后端实例时，在实例 A 激活，实例 B 的下一次请求也返回新结果（缓存在 Redis）
- [ ] 渠道：每个渠道各有一个生效版本，激活 `direct` 的新版本不影响 `play`；`channel` 缺省时 Android 取 `play`、iOS 取 `appstore`；渠道和平台不一致、渠道不存在、`channel` 格式不合法 → `hasUpdate=false`（不会落到默认渠道）；`GET /api/app-version?platform=ANDROID&versionCode=…&channel=direct` 返回 `downloadUrl`、`fileSize`、`sha256`，`storeUrl` 为 `null`；STORE 渠道相反
- [ ] APK 上传：超过 `upload.apk_max_bytes`、扩展名不是 `.apk`、文件里没有 APK Signing Block → 400 `INVALID_FILE`；返回的 `apkSha256` 与文件一致；`apkUrl`、`downloadUrl` 是公开的 https 地址（不签名、不过期）；创建 DIRECT 版本只接受 `apkUploadId`，请求里手填的 `apkUrl`、`apkSizeBytes`、`apkSha256` 被忽略，STORE 版本带 `apkUploadId` → `INVALID_REQUEST`，同一个 `uploadId` 用第二次 → 409 `INVALID_STATE`，未被使用的上传在 `upload.orphan_hours` 后被清理；激活 DIRECT 版本时存储里的文件缺失或 SHA-256 不一致 → `INVALID_REQUEST`；没有 `APPVERSION:MANAGE` → 403
- [ ] 自更新（客户端）：下载后 SHA-256 与响应不一致 → 删除文件、不安装、可重试；强制更新时没有"安装未知应用"权限 → 引导到系统设置，对话框不能关闭；Play 渠道的包里没有 `REQUEST_INSTALL_PACKAGES` 权限和自更新代码
- [ ] 只有 `APPVERSION:ACTIVATE` 的管理员能激活和下线；每个写操作有审计日志
- [ ] 对 `ACTIVE`/`ARCHIVED` 的版本编辑、删除，或激活 `ARCHIVED`、下线非 `ACTIVE` → 409 `INVALID_STATE`；不存在的版本 → 404 `RESOURCE_NOT_FOUND`
- [ ] 停用的渠道（`Channel.enabled=false`）：不能新建或激活版本；`GET /api/app-version` 对它返回 `hasUpdate=false`；统计里的历史数据照常按渠道显示
- [ ] 版本列表默认“生效中的排前面，其余按创建时间倒序”；停用渠道下新建版本、投放账户新关联 → 409 `INVALID_STATE`；`POST /channels` 的 `IOS` 加 `DIRECT` → `INVALID_REQUEST`；版本检查缓存失效竞态：读取者在提交前读到旧值、写者删键后，读取者写回被版本号比对拒绝，下一次请求读到新结果
- [ ] 版本校验：`versionCode` 不大于该渠道当前 `ACTIVE` 的（创建、编辑草稿、激活三处）、`minVersionCode` 不在 1 到 `versionCode`、`versionName` 不匹配 `x.y.z`、STORE 渠道缺 `storeUrl` 或 DIRECT 渠道带 `storeUrl` → `INVALID_REQUEST`；`(channelCode, versionCode)` 重复 → 数据库拒绝；`GET /api/app-version` 超过 `ratelimit.public_config_per_min` → 429；`PUT /channels/{code}` 只能改 `name`、`packageName`、`enabled`；渠道种子只在 `packageName` 为空时用环境变量填，不覆盖后台改过的值；`PUT /channels/{code}` 改 `enabled` 后版本检查缓存立即失效

### 24.7 渠道包

照 dramaBox 的"渠道包管理"（`plat_channel`：一个渠道 = 一个应用、平台、分发来源的发行包，用作归因、统计和版本管理的维度 [子代理读码 dramaBox 笔记 `_scratch_dramabox_admin_modules_b.md` 3.4]）。

- **`Channel`**：`code`（唯一，创建后不可改，匹配 `^[a-z0-9_-]{2,32}$`，`unknown` 是统计里"没有渠道"的保留值，不能作为渠道码）、`name`、`platform`（`ANDROID`/`IOS`，创建后不可改）、`distribution`（`STORE` 商店分发 / `DIRECT` 官网直接下载，创建后不可改；`DIRECT` 只能配 `ANDROID`，否则 `INVALID_REQUEST`）、`packageName`（Android 的 `applicationId` 或 iOS 的 bundle ID）、`enabled`、`createdAt`、`updatedAt`。预置三行：`play`（`ANDROID`、`STORE`，包名取 `GOOGLE_PLAY_PACKAGE_NAME`）、`direct`（`ANDROID`、`DIRECT`）、`appstore`（`IOS`、`STORE`，包名取 `APPLE_BUNDLE_ID`）。SQL 迁移读不了环境变量，所以这三行由应用启动时的种子逻辑写入：行不存在就插入，`packageName` 为空时才用环境变量填，不覆盖后台改过的值。
- **后台接口**（`/api/admin`）：`GET /channels`（任何登录的管理员都能调，供各页面的筛选下拉用，dramaBox 同样如此）、`POST /channels`、`PUT /channels/{code}`（只能改 `name`、`packageName`、`enabled`）；没有 `DELETE`，只能停用（历史数据还要按渠道显示）。权限 `CHANNEL:MANAGE`，写操作写审计日志。
- **客户端上报渠道**：客户端带自己构建时写死的渠道码：游客凭据请求体的 `channel`（2.1，存 `GuestDevice.channelCode`，只记第一次）、登录和注册请求的 `client.channel`（2.2，创建账号时存 `User.channelCode`，之后不变）、事件的 `context.channel`（7.1）。不符合 `^[a-z0-9_-]{2,32}$` 的值丢弃（版本检查的 `channel`（24.3）不丢弃：格式不合法的和不认识的一样返回 `hasUpdate=false`）；服务端**不拿渠道表去校验客户端上报的渠道码**（dramaBox 同样不校验，[子代理读码 `ConfigFacade`]），统计里没有渠道的归 `unknown`。
- **用途**：版本管理的范围键（24.1）；投放账户关联的渠道包（10.5）；统计的渠道维度（17.6）；事件上下文。
- **缓存**：`PUT /channels/{code}` 改动 `enabled` 时同样删除该渠道的版本检查缓存键（24.3），否则最长 `appversion.cache_seconds` 内继续下发更新。
- **`enabled=false` 的效果**：停用的渠道不能新建版本、不能激活版本、不能被投放账户新关联，都返回 409 `INVALID_STATE`；`GET /api/app-version` 对停用的渠道返回 `hasUpdate=false`（已有的 `ACTIVE` 版本保留但不再下发）；统计、归因的历史数据照常按渠道显示；客户端上报的渠道码不受影响（本来就不校验）；重新启用后恢复。
- **验收**：渠道码或平台、分发方式创建后不能改 → `INVALID_REQUEST`；渠道码 `unknown` → `INVALID_REQUEST`；`POST/PUT /channels` 没有 `CHANNEL:MANAGE` → 403；`GET /channels` 任一登录管理员可调；没有 `DELETE` 接口；客户端上报格式不合法的渠道码被丢弃，不报错（版本检查的 `channel` 除外，格式不合法返回 `hasUpdate=false`，24.3）。

---

## 二十五、站内通知

依据：dramaBox 的站内通知收件箱和后台"发送系统通知"（用户 2026-10-02 同意加入）[子代理读码 dramaBox `user_notification`、`NotificationController`、`NotificationFacade`、`NotificationPushUseCase`、`UserNotificationController`，dramaBox-admin `src/pages/drama-user/user-notification`，Android `NotificationFragment`、`NotificationManager`]。dramaBox 的模型和实现带着短剧的评论回复、评论点赞，以及一批缺陷；下面只取通用的"系统消息收件箱"，改掉缺陷。

### 25.1 关键设计点

| 设计点 | 内容 |
|---|---|
| 范围 | 只有系统消息：运营发给指定账号的消息，和业务流程自动产生的系统事件消息。不做评论回复、点赞这类互动通知（AvatarApp 没有评论） |
| 多语言 | 运营发的消息按语言分别填写标题和正文（必须有 `en`），收件人看到的是按他的语言取的那一份；系统事件消息用模板键加参数，按收件人的语言在读取时渲染。dramaBox 的消息是单一语言的自由文本，推送里甚至会出现原始的 i18n 键 |
| 时间 | 响应里的时间是 UTC 的 ISO-8601，客户端按本地时区显示（dramaBox 固定 GMT+8 且客户端直接截取字符串） |
| 分页 | 游标分页，按 `(createdAt, id)` 倒序（dramaBox 用页码，插入新行会让翻页重复或漏行） |
| 推送 | 运营发送时可选"同时推送"（遵守 `announcement` 偏好）；系统事件通知总是附带推送（遵守 `activity` 偏好，25.3）；推送在数据库事务提交之后发出，按收件人账号的语言渲染推送文字（账号语言：该账号最近注册的推送 token 上的 `locale`，按 8.4 的规则归一化，没有 token 则不推送；dramaBox 的评论审核路径在事务里同步调 FCM、推送正文用原始 i18n 键，管理员手动发送那条路径不在事务里 [子代理读码 `NotificationPushUseCase.java:75-85`、`UserCommentAdminFacade.java:30-38`]） |
| 保留 | 定时清理；账号删除时一并删除（dramaBox 两者都没有） |
| 深链 | `linkType` + `linkTarget`，**与推送载荷共用同一套取值和校验**（8.3）：`NONE`、`SCREEN`（`linkTarget` 取 8.3 的页面标识清单）、`URL`（https）；没有 dramaBox 那几个短剧专属的引用字段 |

### 25.2 数据

`Notification`：`id`、`accountId`、`category`（`ADMIN`：运营发送；`SYSTEM_EVENT`：业务流程产生）、`titleI18n`（JSON，语言代码 → 文字，仅 `ADMIN`）、`bodyI18n`（同上）、`templateKey`（仅 `SYSTEM_EVENT`，模板键）、`templateParams`（JSON）、`linkType`（`NONE`/`SCREEN`/`URL`，同 8.3）、`linkTarget`、`isRead`、`sentBy`（运营发送时的管理员 ID）、`createdAt`。索引 `(accountId, createdAt DESC, id DESC)`、`(accountId, isRead)`。`URL` 必须符合 1.7 的链接规则；`SCREEN` 的目标必须在 8.3 的页面标识清单里（后端保存时校验，客户端新增页面需要先扩展这份清单）。

### 25.3 谁来创建

- **运营发送**：后台 `POST /api/admin/notifications/send`，请求 `{accountIds, titleI18n, bodyI18n, linkType?, linkTarget?, push}`。`accountIds` 至少 1 个（空数组 `INVALID_REQUEST`）、去重（有重复项 `INVALID_REQUEST`）、最多 `notification.max_recipients`（1000）个，**每个账号必须存在且状态是 `ACTIVE`**，否则整个请求返回 `INVALID_REQUEST`，`data.details` 列出有问题的账号（1.4；dramaBox 不检查账号是否存在，会写出没有主人的行）；`titleI18n`、`bodyI18n` 的语言键匹配 `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` 且不超过 35 个字符；`titleI18n` 每种语言 ≤ 100 个字符，`bodyI18n` ≤ 500 个字符（都先按 1.9 去掉首尾空白，存去掉空白后的值，再按 Unicode 码点计长度；去掉空白后为空的值 → `INVALID_REQUEST`），都必须含 `en`。没有"全体用户"选项：要给全体用户发消息，用手动推送任务（8.5）；本节不做群发收件箱。
- **业务流程产生**（模板键在语言文件里维护，必须覆盖 `app.supported_locales` 里的每一种语言（17.5），并且必须有 `en` 作回退；`app.supported_locales` 将来增加语言，模板同步补齐）：
  1. 内容审核拒绝（11.4 的 `REJECT` 针对上传任务、生成结果、被举报而删除的已有形象或声音、persona，或审核服务故障时先保存的伴侣名字，2.5.1）→ `notification.moderation.rejected`，参数 `contentType`（`AVATAR`、`VOICE`、`PERSONA`、`LOOK`、`COMPANION_NAME`）：`AVATAR` 也覆盖建形象的生成结果被拒；`LOOK` 是建外观的生成结果被拒；动作片段被拒不发通知（片段只是不可用，3.8）；persona 和伴侣名字只在 11.4 的条件更新真的更新到一行时才通知，过期的待审记录（用户已经提交了新版本）只关闭记录、不通知；照片里的人投诉属实、`remove-avatars` 删除形象时（11.6），上传者同样收到一条（`contentType=AVATAR`），和投诉置 `RESOLVED_REMOVED` 的更新在同一个事务里写入。链接：都指向伴侣资料页（`SCREEN`，目标 `companion`；形象、声音、外观和 persona 都在那一页，页面结构设计 C 节，2026-10-18 改）。
  2. 数据导出就绪（13.3 的 `ExportJob` 变为 `READY`）→ `notification.export.ready`，无参数，链接指向设置页（`SCREEN`，目标 `settings`，导出入口在那里）。
  3. 订阅进入 `IN_GRACE_PERIOD` 或 `ON_HOLD`（15.4）→ `notification.subscription.billing_issue`，参数 `state`（`IN_GRACE_PERIOD`、`ON_HOLD`），链接到客户端的订阅页（`SCREEN`，目标 `subscription`）。
  4. 生成成功（2026-10-18 加）：账号的 `AVATAR`、`VOICE`、`LOOK` 任务变为 `SUCCEEDED`（3.3）→ `notification.generation.succeeded`，参数 `contentType`（`AVATAR`、`VOICE`、`LOOK`），链接指向伴侣资料页（`SCREEN`，目标 `companion`）。系统任务（`accountId` 为空）和 `ACTION_CLIP`、`LOOK_REPREPARE` 不发。
  5. 生成失败（2026-10-18 加）：账号的 `AVATAR`、`VOICE`、`LOOK` 任务变为 `FAILED` → `notification.generation.failed`，参数 `contentType` 和 `failureReason`（3.3 的六个值），链接同上。人工复核拒绝（11.4 的 `REJECT`）已经由第 1 条通知，不再发这一条；内部值 `ACCOUNT_DELETED` 不发；系统任务不发。
  **系统事件通知的推送**（2026-10-18 加）：以上每一条通知落库、事务提交之后都附带推送，规则同 25.4 的推送（按收件账号的语言渲染这条通知的标题和正文、`type=activity`（不是 `notification`，8.3）、没有可用 token 时只写收件箱、推送失败不回滚通知），但遵守的是 `activity` 偏好（8.2），不是 `announcement`；`PushRecord.triggerReason=system_event`，推送的链接取这条通知自己的链接。原因：这几类都是用户在等或必须处理的结果：生成要等几分钟到几小时，用户离开 App 之后只有推送能告诉他结果（Character.AI 的介绍视频生成"可以关掉 App 等推送通知"，`2026-10-18-page-structure-research/avatar-create.md`）；导出要等后台任务；扣费问题不处理会失去订阅。
  **写入时机**：生成成功、失败的通知和任务状态的条件更新在同一个事务里写入（状态更新不到行就不写），导出就绪的通知和 `ExportJob` 变为 `READY` 的条件更新在同一个事务里写入；订阅进入宽限期或挂起的通知和订阅状态的条件更新在同一个事务里写入（只在状态真的变化的那一次写，15.4）；所以崩溃不会丢通知，也不会写两次。推送在事务提交之后发。
  **账号状态规则**：系统事件通知只给 `ACTIVE` 的账号写（`BANNED`、`PENDING_DELETION`、`DELETING` 的账号看不到收件箱，也不该在删除后产生新行）；写入和状态检查在同一个事务里，对 `User` 行加共享锁（做法同 15.4 的“账号状态与商店通知”），所以不会在 13.1 步骤表第 6 步之后写出孤儿行。

### 25.4 接口

客户端（JWT）：

| 接口 | 限流（每账号） | 说明 |
|---|---|---|
| `GET /api/notifications?cursor=&limit=` | 60 次 / 60 秒 | `limit` 默认 20，范围 1–50，越界或 `cursor` 非法 → 400 `INVALID_REQUEST`；响应 `{items:[{id,title,body,linkType,linkTarget,isRead,createdAt}], nextCursor}`，没有更多页时 `nextCursor` 是 JSON `null`；`cursor` 是对客户端不透明的串，解码失败 → 400 `INVALID_REQUEST`；标题正文按 1.2 的语言协商规则取 `Accept-Language`（`titleI18n`/`bodyI18n` 里的语言键就是可用版本），没有则取 `en`；`SYSTEM_EVENT` 用同一规则渲染模板 |
| `GET /api/notifications/unread-count` | 60 次 / 60 秒 | `{count}`，一次查询 |
| `POST /api/notifications/read` | 30 次 / 60 秒 | `{ids}`，数量 1 到 100，空数组或超过 100 个都是 400 `INVALID_REQUEST`；只处理属于当前账号的，其余忽略；成功 `data: null` |
| `POST /api/notifications/read-all` | 10 次 / 60 秒 | 无请求体；成功 `data: null` |

后台（`/api/admin`）：`POST /notifications/send`（`NOTIFICATION:SEND`，写审计日志；响应 `{"created":n}`，n 是写入的通知数；推送在提交后逐收件人尽力发送，失败只记日志，不影响响应）；`GET /notifications?accountId=&category=&isRead=&from=&to=`（`NOTIFICATION:VIEW`，列表里正文按 `en` 显示）；`GET /notifications/{id}`（`NOTIFICATION:VIEW`，返回全部语言的标题和正文、模板键和参数、已读状态、发送人）。

**推送**：`send` 带 `push=true` 时，通知落库、事务提交之后，对每个收件账号按其语言渲染文字，走 8.1 的推送 token 和发送流程，推送 `type` 为 `notification`、遵守用户的 `announcement` 偏好（8.2、8.3；偏好关闭时只写收件箱），写一条 `PushRecord`（`triggerReason=admin`），链接指向客户端的消息列表（`SCREEN`，目标 `notifications`）；账号没有可用的推送 token 时只写收件箱，不算失败。推送的失败不回滚通知。

### 25.5 保留与账号删除

清理任务每天一次：已读超过 `notification.read_retention_days`（90）的删除，未读超过 `notification.unread_retention_days`（365）的删除，每个账号最多保留最新 `notification.max_per_account`（500）条。账号删除（13.1）时删除该账号全部通知。

### 25.6 客户端

入口放在设置或"我的"页，带未读红点（数字超过 99 显示 `99+`）；未读数在冷启动、回到前台、收到 `type=notification` 或 `type=activity` 的推送时取一次，登出后清零，没有定时轮询；列表无限滚动，到倒数第 3 条时取下一页，有下拉刷新和失败重试（dramaBox 两者都没有）；点击一行标记已读并按 `linkType` 跳转；"全部已读"调用 `read-all`。所有文案走本地化资源。

### 25.7 配置与权限

`AppConfig` 键（17.5 登记）：`notification.max_recipients`（1000）、`notification.read_retention_days`（90）、`notification.unread_retention_days`（365）、`notification.max_per_account`（500），默认值都是提议。权限码 `NOTIFICATION:VIEW`、`NOTIFICATION:SEND`。

### 25.8 验收

- [ ] `send`：`accountIds` 里有不存在的账号或非 `ACTIVE` 的账号 → 400 `INVALID_REQUEST`，`data.details` 列出有问题的账号，一条都不写；超过 `notification.max_recipients` → 400；`titleI18n` 或 `bodyI18n` 缺 `en` → 400；标题超过 100 或正文超过 500 个字符 → 400；`URL` 不符合 1.7、`SCREEN` 目标不在 8.3 清单里 → 400
- [ ] 页面标识：保存通知或广告的 `SCREEN` / `IN_APP_ROUTE` 目标时，`companionship`、`assets` → 400 `INVALID_REQUEST`，`companion`、`store`、`credits` 可以保存（8.3 清单）
- [ ] 收件箱：`GET /api/notifications` 按 `(createdAt, id)` 倒序游标分页，翻页不重复不漏行（翻页期间插入新行也一样）；`limit` 超出 1 到 50 → 400；标题正文按 `Accept-Language` 协商，没有该语言取 `en`；`SYSTEM_EVENT` 按同一规则渲染模板，模板缺该语言时回退 `en`
- [ ] `read` 只处理属于当前账号的 ID，别人的忽略且不报错；超过 100 个 ID → 400；`read-all` 把当前账号全部置已读；`unread-count` 与列表一致
- [ ] 推送：`push=true` 且账号 `announcement` 偏好开启 → 提交后发出 `type=notification` 的推送并写 `PushRecord`（`triggerReason=admin`）；偏好关闭 → 只写收件箱；账号没有推送 token → 只写收件箱，不算失败；推送失败不回滚通知
- [ ] 系统事件：审核拒绝（含照片里的人投诉属实、`remove-avatars` 删除形象后上传者收到的那一条，11.6；被举报的已有形象或声音经复核删除后所有者收到的那一条，11.4；persona 的待审记录已过期时 `REJECT` 只关闭记录、不产生通知）、导出就绪、订阅进入宽限期或挂起各产生一条通知，参数和链接按 25.3 的枚举；账号不是 `ACTIVE`（含 `PENDING_DELETION`、`DELETING`）时不产生；账号删除完成后不留孤儿行
- [ ] 生成结果：账号的形象、声音、外观任务成功各产生一条 `notification.generation.succeeded`，失败产生一条 `notification.generation.failed`（带 `failureReason`）；人工复核拒绝只产生审核拒绝那一条；系统任务、动作片段、重新准备驱动包不产生；通知和任务状态更新在同一个事务里；系统事件通知都附带推送（`triggerReason=system_event`），遵守 `activity` 偏好、不受 `announcement` 影响，链接取通知自己的链接，审核拒绝的链接是 `companion`
- [ ] 通知偏好：`PUT /api/notification-preferences` 缺 `activity` → 400 `INVALID_REQUEST`；`activity=false` 时系统事件通知只写收件箱、不推送，`announcement=false` 不影响系统事件推送；系统事件推送的 `type` 是 `activity`，运营发送的是 `notification`
- [ ] 推送模板：保存 `admin` 或 `system_event` 触发原因的 `PushTemplate` → 400 `INVALID_REQUEST`；召回类原因（`daily_recall`、`streak_at_risk`）的模板规则不变（8.4、18）
- [ ] 保留：已读超过 `notification.read_retention_days`、未读超过 `notification.unread_retention_days` 的被清理，每个账号只保留最新 `notification.max_per_account` 条；账号删除时全部删除，数据导出带 `notifications.json`
- [ ] 后台：`GET /notifications/{id}` 返回全部语言的标题正文；没有 `NOTIFICATION:SEND` 不能发送、没有 `NOTIFICATION:VIEW` 不能查看
- [ ] `POST /notifications/send` 响应 `{"created":n}`；推送失败不影响响应和已写入的通知
- [ ] 输入边界：`accountIds` 为空数组或有重复项 → 400；语言键不匹配 `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` 或超过 35 个字符 → 400；推送文字按收件账号的语言渲染（账号语言取最近注册推送 token 的 `locale`，按 8.4 的规则归一化）；`read` 的 `ids` 为空数组或超过 100 个 → 400，`read`/`read-all` 成功 `data: null`；`cursor` 解码失败或 `limit` 越界 → 400；没有更多页时 `nextCursor` 是 JSON `null`

---

## 二十六、客户端远程配置

依据：dramaBox 的 `plat_app_config` 和 `GET /config/app`（用户 2026-10-02 同意加入）[子代理读码 dramaBox `PlatAppConfigServiceImpl`、`PlatAppConfigKey`、`ConfigFacade`、`PlatAppConfigController`，dramaBox-admin `src/pages/plat/plat-app-config`，Android `MainActivity`、`ShareGateManager`、`LoginFragment`]。dramaBox 的这套有一批明确的缺陷（保存页面时把当前分组的字段各发一次 HTTP 请求、写成覆盖行 [子代理读码 dramaBox-admin `plat-app-config/index.tsx:285-302`]；多个字段不在一个事务里保存；空值会遮住全局值；默认值在后端、后台、客户端三处各写一份并且已经不一致（例如 `socialPopupIntervalDays` 是 1 / 7 / 1）；客户端声明的 35 个字段里有 10 个从来不读，其中恰恰包括 AvatarApp 要搬的隐私政策、用户协议、客服、邀请链接、分享文案这几项，客户端把协议网址写死在登录页 [子代理读码 `ConfigModels.kt:26-68`、`LoginFragment.kt:282`]；后端没有审计和缓存），下面保留"服务端下发、后台可改、不发版生效"的结构并逐条改掉。

**与现有配置的分工**：17.5 的 `AppConfig` 是**后端自己的运营参数**，客户端看不到；本节是**客户端可见的配置**（链接、文案）；A/B 实验和客户端功能开关仍走 Firebase Remote Config（主设计文档 §20），不放这里；应用版本检查是第二十四节；广告的客户端配置是 22.6 的 `GET /api/ads/config`。

### 26.1 关键设计点

| 设计点 | 内容 |
|---|---|
| 键的登记 | 每个键在代码里声明：类型（`STRING`/`URL`/`EMAIL`/`BOOLEAN`/`INT`/`STRING_LIST`；`STRING_LIST` 是字符串数组，在 `values` 里是 JSON 数组，只能由系统派生，不能用 `PUT` 设置）、默认值、校验（`URL` 按 1.7 的链接规则、整数范围、邮箱格式）、是否按语言区分（`localized`）、是否对客户端可见。后台表单、保存校验、客户端契约都来自这一份登记，不再各写各的 |
| 语言 | `localized` 的键，每种语言一个值，另有一个不带语言的默认值；解析顺序：按 1.2 的语言协商规则逐项尝试请求语言（每项先完整匹配再主语言子标签匹配，该键有这种语言的值就用）→ 该键不带语言的默认值 → 登记里的默认值（这一条是对 1.2 的覆盖：最终回退是这个键自己的默认行，不是 `en`；逐项尝试的算法仍按 1.2）。不按产品或渠道覆盖（AvatarApp 只有一个产品） |
| 空值 | 行不存在表示"沿用默认"；空字符串对 `URL`、`EMAIL` 类型不合法（保存时拒绝），对 `STRING` 类型是合法的值。这样空值不会遮住全局默认 |
| 保存 | 一个键的所有语言值作为整体在一个事务里替换；只保存改动过的键；缺省语言可"重置"（删除该语言的行） |
| 下发 | `GET /api/config/client`，无需登录。响应依赖请求语言，所以带 `Vary: Accept-Language` 和 `Cache-Control: public, max-age=300`。服务端把**全部键的全部语言值**（一张小表）缓存在 Redis（所有实例共享），每次请求按 1.2 的语言协商规则对每个键独立解析、拼出响应体（不按语言缓存响应体，因为请求头是多值、每个键可用的语言不同）；`configVersion` 是该响应体内容的哈希，同时就是 `ETag`，所以只有对这个请求的解析结果有影响的保存才会改变它。失效：后台保存、重置客户端配置，或 `auth.phone_login_enabled`、`deletion.grace_days`、`chat.conversation_languages`、`voice.transcript_max_chars`、`generation.voice_min_seconds`、`generation.voice_max_seconds` 被修改（`phoneLoginEnabled`、`accountDeletionGraceDays`、`conversationLanguages`、`voiceTranscriptMaxChars`、`voiceMinSeconds`、`voiceMaxSeconds` 来自它们，17.5）时，删除这张表的缓存键 |
| 消费者 | 每个下发的键都有一个明确的客户端使用点（26.2 的表）；没有使用点的键不登记 |
| 审计 | 每次保存写 `AdminAuditLog`，`detail` 里记改动前后的值 |

### 26.2 登记的键

| 键 | 类型 | `localized` | 默认值 | 客户端使用点 |
|---|---|---|---|---|
| `privacyPolicyUrl` | `URL` | 是 | 无默认值 | 登录页、设置页的隐私政策入口 |
| `termsOfServiceUrl` | `URL` | 是 | 无默认值 | 登录页、设置页的服务条款入口 |
| `communityGuidelinesUrl` | `URL` | 是 | 无默认值 | 举报页和设置页的社区规范入口（主设计文档 §17 要求有公开的规范页面） |
| `supportUrl` | `URL` | 是 | 无默认值 | 设置页的帮助与反馈入口；封禁页的申诉入口在没有 `supportEmail` 时的备选 |
| `supportEmail` | `EMAIL` | 否 | 无默认值 | 客服邮件入口；**封禁页的申诉入口优先用它**（2.8） |
| `accountDeletionUrl` | `URL` | 是 | 无默认值 | 设置页的"网页删除账号"入口、被封禁页面的删除入口（13.4） |
| `inviteLinkBase` | `URL` | 否 | 无默认值 | 邀请链接的根地址：服务端用它加 `?code=` 加邀请码拼出 `GET /api/invite` 返回的 `inviteLink`（9），客户端不自己拼；没有配置时 `inviteLink` 为 `null`；保存时拒绝带查询或片段（服务端固定追加 `?code=`） |
| `inviteShareText` | `STRING` | 是 | 无默认值 | 邀请页分享文案。可用占位符只有 `{link}`（客户端换成 `GET /api/invite` 返回的 `inviteLink`）和 `{code}`（邀请码）；保存时含其他 `{…}` 形式的占位符 → `INVALID_REQUEST`；文案里没有 `{link}` 时客户端在文案后另起一行追加邀请链接；不超过 500 个字符 |
| `inviteShareTitle` | `STRING` | 是 | 无默认值 | 邀请页分享弹窗的标题，不超过 200 个字符；没有配置时客户端用自己的默认文案（对应 dramaBox 的分享弹窗标题 `shareGateTitle`）。副标题键 `inviteShareSubtitle` 已删除：Android 系统分享面板没有副标题位置，没有任何平台使用它，等有使用者时再加 |
| `phoneLoginEnabled` | `BOOLEAN` | 否 | 取自 `auth.phone_login_enabled`，**不在这里编辑** | 登录页是否显示手机号入口（第二十三节） |
| `accountDeletionGraceDays` | `INT` | 否 | 取自 `deletion.grace_days`，**不在这里编辑** | 删除确认页写宽限期天数（13.1）；客户端在申请删除之前拿不到别的来源 |
| `conversationLanguages` | `STRING_LIST` | 否 | 取自 `chat.conversation_languages`，**不在这里编辑** | 游客发起通话要带合法的 `language`（4.3），游客调不了 `GET /api/language`（2.10），登录前就从这里取得列表，选第一个支持的系统语言，不用试错；已登录用户的列表仍来自 `GET /api/language` |
| `voiceTranscriptMaxChars` | `INT` | 否 | 取自 `voice.transcript_max_chars`，**不在这里编辑** | 声音克隆页的朗读文案/说明文字输入框的字数上限，超过时在客户端提示，不发请求（3.2 的 `transcript` 校验与它同值） |
| `voiceMinSeconds` | `INT` | 否 | 取自 `generation.voice_min_seconds`，**不在这里编辑** | 声音克隆页的录音/所选音频的最短时长，不足时客户端提示，不上传（3.2 的时长校验与它同值） |
| `voiceMaxSeconds` | `INT` | 否 | 取自 `generation.voice_max_seconds`，**不在这里编辑** | 录音的最长时长（到点自动停止录音）和所选音频的最长时长，超过时客户端提示，不上传 |
| `drivingLookaheadMs` | `INT` | 否 | 200（推断，真机上调整） | 某段语音开始播放前，客户端至少要收到这段开头多少毫秒的音频（手机从音频算嘴形，模型输出比音频晚约 160 毫秒（推断，没在手机上测），默认值是这段延迟加余量（推断）；形象渲染设计 7.4） |
| `renderTierLocalMinFps` | `INT` | 否 | 25（推断，真机测速后调整） | 设备分级：本地测速的平均帧率达到它才用本地渲染档（形象渲染设计 8.5） |
| `renderTierMaxMemoryMb` | `INT` | 否 | 512（推断，真机测速后调整） | 设备分级：本地渲染的内存门槛（形象渲染设计 8.5） |
| `avatarCacheMaxMb` | `INT` | 否 | 500（推断） | 驱动资源包和动作片段的本地缓存总量上限，按最近使用淘汰，当前外观不淘汰（形象渲染设计 8.6） |

"无默认值"的键没有配置时，客户端对应入口不显示（`URL`/`EMAIL` 类型）或不可用（`inviteLinkBase`），不显示空链接或写死的网址；上线前这些键必须配好。**域名和链接的实际内容缺输入**（产品名和域名未定）。

### 26.3 接口

- 客户端：`GET /api/config/client`（无需登录）。请求头 `Accept-Language`；响应 `{"configVersion":"<哈希>","values":{"privacyPolicyUrl":"…","phoneLoginEnabled":true,…}}`，只含可见且已配置的键，已按请求语言解析；支持 `If-None-Match`（`ETag` 即 `configVersion`），未变化返回 304。
- 后台（`/api/admin`）：`GET /client-config`（全部键：登记信息、各语言的当前值、是否已配置）；`PUT /client-config/{key}`，请求体 `{"values":{"":"默认值","zh-Hans":"…","ar":"…"}}`，整体替换这个键的全部语言值（`values` 为空对象 → 400；语言键匹配 `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` 且不超过 35 个字符，空字符串键是默认值），校验按登记（类型、https、整数范围、`localized` 为否的键只接受空语言键），失败返回 `INVALID_REQUEST`，`data.details` 指出是哪个语言的值（1.4）；对取自系统配置的只读键（`phoneLoginEnabled`、`accountDeletionGraceDays`、`conversationLanguages`、`voiceTranscriptMaxChars`、`voiceMinSeconds`、`voiceMaxSeconds`）执行 `PUT` 或 `reset` 返回 400 `INVALID_REQUEST`；写审计日志，`detail` 记改动前后的值（这些键都是公开配置，不含机密）；`POST /client-config/{key}/reset`（删除该键全部行）。权限 `CLIENTCONFIG:VIEW`、`CLIENTCONFIG:MANAGE`。

### 26.4 数据

`ClientConfigValue`：`configKey`、`locale`（空字符串表示默认值）、`value`、`updatedBy`、`updatedAt`；`(configKey, locale)` 唯一。

### 26.5 客户端行为

冷启动取一次，之后回到前台且距上次超过 30 分钟再取；带 `If-None-Match`；响应缓存到本地存储。失败时用本地缓存；没有缓存时，只有隐私政策和服务条款两项使用**构建配置里的兜底网址**（商店审核要求应用内有隐私政策入口），其余入口不显示。客户端不再写死这些网址。老客户端忽略未知字段，新客户端对缺失的键按"入口不显示"处理，不会因为缺字段崩溃。

### 26.6 验收

- [ ] 同一个键保存多个语言值，是一个事务：其中一个语言校验失败，整体不保存
- [ ] `URL` 类型提交 `http://…` 或空字符串 → `INVALID_REQUEST`；`localized=false` 的键提交非空语言键 → `INVALID_REQUEST`
- [ ] 1.7 链接规则的边界：`HTTPS://…` 拒绝、`https://host:/x`（空端口）拒绝、`https://host:8443/a` 和方括号 IPv6 接受、含空格的路径拒绝、总长超过 2048 的配置类链接拒绝
- [ ] 1.7 链接规则在所有适用位置（26.2 的 URL 键、推送与站内通知的 `URL` 目标、广告 `OPEN_URL`、`storeUrl`）一致生效：含非 ASCII 主机（未转 punycode）、含非 ASCII 路径（未百分号编码）、含 `user@host`、反斜杠、控制字符、不可见字符、双向控制字符的链接，保存都返回 `INVALID_REQUEST`，`data.details` 写明原因
- [ ] 请求 `Accept-Language: zh-Hans-CN` 取到 `zh-Hans` 的值；没有该语言取默认值；默认值也没有则该键不出现在响应里；`Accept-Language: th-TH, ar;q=0.9` 时，某键有 `ar` 没有 `th` → 取 `ar` 的值（按 `q` 逐项，每个键独立解析）
- [ ] 后台保存某键的 `zh-Hans` 值后，`Accept-Language: zh-Hans` 的 `configVersion` 变化、带旧 `If-None-Match` 不再返回 304；`Accept-Language: en` 的响应没有受影响时 `configVersion` 不变；响应带 `Vary: Accept-Language`
- [ ] 修改 `auth.phone_login_enabled` 后，下一次 `GET /api/config/client`（任何实例）里的 `phoneLoginEnabled` 和 `configVersion` 都已更新
- [ ] `accountDeletionGraceDays`、`conversationLanguages`、`voiceTranscriptMaxChars`、`voiceMinSeconds`、`voiceMaxSeconds` 取自 `deletion.grace_days`、`chat.conversation_languages`、`voice.transcript_max_chars`、`generation.voice_min_seconds`、`generation.voice_max_seconds`，后台不能编辑（对它们 `PUT` 或 `reset` → 400 `INVALID_REQUEST`）；修改这些配置后下一次 `GET /api/config/client` 的值和 `configVersion` 已更新；游客（没有任何凭据）也能取到；`generation.voice_min_seconds` 保存 31、0，或大于 `generation.voice_max_seconds` 的值 → 400 `INVALID_REQUEST`；`inviteShareSubtitle` 不再登记，`PUT /client-config/inviteShareSubtitle` → 404
- [ ] 两个后端实例时，在实例 A 保存配置，实例 B 的下一次请求就返回新值
- [ ] 每次保存有审计日志，含改动前后的值；没有 `CLIENTCONFIG:MANAGE` → 403
- [ ] `phoneLoginEnabled` 不能通过 `PUT` 修改，值随 `auth.phone_login_enabled` 变化；`PUT /client-config/{key}` 的 `key` 未登记 → 404 `RESOURCE_NOT_FOUND`；带 `If-None-Match` 且 `configVersion` 未变 → 304；`inviteShareText` 含 `{link}`、`{code}` 以外的占位符 → `INVALID_REQUEST`，`inviteShareTitle` 超过 200 个字符、`inviteShareText` 超过 500 个字符 → `INVALID_REQUEST`；`STRING_LIST` 键 `PUT` → 400；空字符串对 `STRING` 合法、对 `URL`/`EMAIL` 不合法；`POST /client-config/{key}/reset` 恢复默认；没有 `CLIENTCONFIG:VIEW` 不能读

---

## 二十七、本次补入各节的汇总登记

下面是第二十二至二十八节，以及 2026-10-11 按形象渲染设计（`docs/superpowers/specs/2026-10-11-avatar-rendering-design.md` 第 13.1 节）和解耦与计量建议（`docs/superpowers/plans/2026-10-09-component-decoupling-metering-proposal.md` 第 2.3 节）补入的内容在前面各节登记的索引，实现时按这张表检查有没有漏掉：

| 登记位置 | 内容 |
|---|---|
| 1.4 错误码 | 23.2 的 `PHONE_INVALID`、`SMS_COUNTRY_NOT_SUPPORTED`、`OTP_RESEND_TOO_SOON`、`OTP_INVALID`、`OTP_EXPIRED`、`OTP_ATTEMPTS_EXCEEDED`、`SMS_SEND_FAILED`、`FEATURE_DISABLED`；1.4 的 `INVALID_REQUEST` 增加 `data.details`、`OTP_RESEND_TOO_SOON` 增加 `data.retryAfterSeconds` |
| 1.5 密钥 | `SMS_CRED_ENC_KEY`、`OTP_HMAC_KEY`、`ABUSE_HASH_KEY` |
| 7.3 事件目录 | 后端事件 `ad_reward_granted`（22.10）、`phone_otp_sent`（23.7，含 `channel`）；`register_completed.method` 增加 `phone` |
| 1.6 未登录限流 | 手机号发送与登录、`GET /api/app-version`、`GET /api/config/client`、短信回执（`ratelimit.public_config_per_min`、`ratelimit.sms_dlr_per_min` 登记在 17.5） |
| 8.3 推送载荷 | `type` 增加 `notification`、`activity`（系统事件通知的推送，25.3）、`otp`（验证码推送，23.3）；`SCREEN` 目标增加 `notifications`、`subscription`、`checkin`、`daily_tasks`（后两个是第二十八节的页面，8.3 的清单是推送、站内通知、广告共用的唯一一份） |
| 15.3 功能开关 | `ads.removed`（22.10） |
| 15.9 额度流水 | `reason` 增加 `AD_REWARD`、`INVITE_REWARD`、`CHECKIN_REWARD`、`TASK_REWARD` |
| 13.1、13.3、13.4 账号删除、导出、网页删除 | 删除 `AdFrequencyState`、`AdRewardVerification`、Mongo `ad_impression_log`、`Notification`；手机号账号用短信验证码确认（23.2）；`SmsSendRecord` 有意保留到 TTL；导出增加手机号、`notifications.json`、`ads.json`；网页删除增加手机号路径，不受 `auth.phone_login_enabled` 约束 |
| 17.4 用户管理 | 手机号掩码与 `USER:PHONE_VIEW`、按完整号码筛选 |
| 17.4 后台接口 | 广告（22.9）、短信（23.6）、应用版本（24.2）、渠道（24.7）、通知（25.4）、客户端配置（26.3）、签到与每日任务（28.1、28.2） |
| 17.5 配置项 | 广告（22.10）、短信与手机号登录（23.8）、`appversion.cache_seconds`（24.5）、通知（25.7）、`upload.apk_max_bytes`（24.2）、`upload.orphan_hours`（22.9、24.2）、`upload.ad_media_max_bytes`（22.9） |
| 17.4 后台告警 | `AdminAlert` 类型增加 `SMS_DAILY_CAP_REACHED`（23.3，`refType=SMS_GLOBAL_CAP`，`refId` 为 UTC 日期） |
| 17.6 统计 | 广告日汇总 `ad-daily`、表 `StatAdDaily`、`StatAdNofillDaily`（22.8） |
| 18 数据模型 | 22.3、23.4、23.8（`User.phone`、`phoneVerifiedAt`）、24.1、24.7（`Channel`）、25.2、26.4、28.1 和 28.2（`CheckinActivity`、`CheckinReward`、`CheckinRecord`、`TaskConfig`、`TaskRecord`）的全部实体 |
| 1.4 错误码（二十八） | `CHECKIN_NOT_AVAILABLE`、`TASK_NOT_CLAIMABLE`、`TASK_HAS_RECORDS`；`INVALID_TIMEZONE` 扩展到签到和每日任务 |
| 7.3 事件目录（二十八） | 后端事件 `checkin_completed`、`task_rewarded` |
| 8.3 推送载荷（二十八） | `SCREEN` 目标增加 `checkin`、`daily_tasks` |
| 13.1、13.3（二十八） | 删除 `CheckinRecord`、`TaskRecord`；导出 `checkin.json`、`tasks.json` |
| 17.5 配置项（二十八） | `tasks.sweep_seconds` |
| 17.6 统计（二十八） | `StatCheckinDaily`、`StatTaskDaily`，接口 `/stats/checkin/*`、`/stats/tasks/*` |
| 1.2 请求头（形象渲染） | `X-Platform`、`X-Channel` 增加目录按 `surfaces` 筛选的业务用途；`Idempotency-Key` 增加 `POST /api/avatars/{assetId}/looks` |
| 1.4 错误码（形象渲染） | `FEATURE_LIMIT_REACHED` 增加外观数（`data` 为 `{"feature":"AVATAR_LOOK","limit":"LOOK_COUNT","max":…}`）；新增 409 `PACKAGE_PREPARING`（带 `Retry-After` 和 `data.retryAfterSeconds`）、400 `RENDERER_FORMAT_UNSUPPORTED`（2026-10-16 取代原来的 409 `PACKAGE_OUTDATED`：资源包改为按格式版本分别保存）、503 `GENERATION_NOT_CONFIGURED` |
| 1.5 环境变量（形象渲染、通用用量） | 删除 `LIVETALKING_URL`；新增 `AVATAR_GEN_URL`、`AVATAR_GEN_SIGNING_SECRET`、`AVATARGEN_USAGE_SIGNING_SECRET`、`RENDER_USAGE_SIGNING_SECRET`、`RENDER_PACKAGE_SIGNING_SECRET` |
| 1.6 限流（形象渲染、通用用量） | `POST /api/public/likeness-complaints`（`ratelimit.likeness_complaint_per_ip_per_hour`）；`POST /api/internal/llm-usage` 改为 `POST /api/internal/usage`（`usage.rate_limit_per_min`） |
| 1.8 调用方标识（形象渲染、通用用量） | `backend-avatargen`、`render-package`、`avatargen-usage`、`render-usage`；`llm-usage` 沿用 |
| 第三节 资产（形象渲染） | 3.1–3.5 改写：只收照片、`style` 与 `declarationVersion`、`GET /api/avatar-upload-options`、三段式生成、`failureReason` 增加 `SUBJECT_UNDERAGE`、`NO_FACE_DETECTED`、`AvatarGenerationProvider` 的四个提交方法与 `fetchOutput`、删除 LiveTalking 适配器；新增 3.6 外观与换装、3.7 服装与背景目录、3.8 动作与动作片段、3.9 驱动资源与渲染模型下发、3.10 系统默认数字人；`AvatarGenerationProvider` 的四个提交方法都带 `accountId` 和 `options`（生成门槛、审核年龄设置、AI 标记开关）；原照保留期从 `AvatarAsset.createdAt` 起算 |
| 2.1 游客（形象渲染） | 游客的默认形象改为服务器下发的系统默认数字人，游客可调用 `GET /api/default-avatar`、`GET /api/renderer-models`、`GET /api/actions`，以及只限生效的默认数字人外观的 `GET /api/looks/{lookId}/media`、`GET /api/looks/{lookId}/package` |
| 4.1、4.3 会话（形象渲染） | 请求体 `renderTier`；dispatch metadata 增加 `renderMode`、`availableActions`、`lookId`（十一个字段；2026-10-17 再加 `deadlineAt`，共十二个）；`Session.renderMode`；响应 `renderMode`；`renderTier` 选填，缺失或无效按 `NONE`，不报错 |
| 5.4 文字对话（形象渲染） | 请求 `voiceReply`；SSE 事件 `audio`、`action`；`/v1/chat/turn` 请求增加 `voiceReply`、`voiceId`、`availableActions` |
| 7.3 事件目录（形象渲染） | 客户端事件 `render_tier_assessed`；`credits_spent` 增加 `itemKey`；`avatar_created` 写明只对 `type=AVATAR` |
| 11 审核（形象渲染） | 11.1 增加年龄判断、生成的标准图（`AVATAR_IMAGE`）、动作片段（`ACTION_CLIP`）；11.4 增加生成结果与片段的复核效果；新增 11.6 照片里的人投诉（`POST /api/public/likeness-complaints`、`remove-avatars`、`ModerationRecord.source=COMPLAINT`） |
| 13.1、13.2、13.3 删除与导出（形象渲染、通用用量） | 删除增加 `AvatarLook`、`ActionClip`、`AccountCosmetic` 和标准图、驱动资源包、片段文件，形象生成服务的删除接口改为 `DELETE {AVATAR_GEN_URL}/v1/refs/{ref}`；导出增加形象的风格、声明、外观元数据、每个外观的标准图和 `cosmetics.json`，`llm-usage.json` 改为 `usage.json` |
| 14.2 用量（通用用量） | 通用用量接口 `POST /api/internal/usage`、`resourceType`、价格表按资源类型 + 模型 + 计量单位；`LlmPrice`、`LlmModel`、`llm_usage_log`、`StatLlmCostDaily` 改名为 `UsagePrice`、`UsageModel`、`usage_log`、`StatUsageCostDaily`；后台路径 `/llm/*` 改为 `/usage/*`，报表 `llm-cost` 改为 `usage-cost`；配置键 `llm_usage.*`、`llm_price.*` 改为 `usage.*`、`usage_price.*` |
| 15.3、15.5、15.6 功能开关（形象渲染） | `avatar.looks_max`、`avatar.look_free`、`credits.period_grant`、`render.cloud`、`chat.voice_reply`；`avatar.looks_max` 与 `credits.period_grant` 的取值和生效值规则；建外观的上限校验 |
| 15.9 额度流水（形象渲染） | `reason` 增加 `SUBSCRIPTION_GRANT`、`SPEND_REVERSED`；字段 `spendKind`、`itemKey`；用途增加兑换服装和新建外观；订阅每期赠送；订阅退款扣回这一期的赠送额度（规则同额度包退款，15.4、15.5 的通知处理也引用它），`REFUND_REVERSED` 加回 |
| 17.4 后台（形象渲染） | 模块"形象与装扮"、"投诉"及其权限码；用户详情的外观与服装；审计扩到标准图和片段；额度统计按 `spendKind`、`itemKey` 分；告警 `AVATAR_DELETION_OVERDUE`、`LIKENESS_COMPLAINT_OVERDUE`、`GENERATION_CONFIG_MISSING`、`USAGE_PRICE_MISSING`（原 `LLM_PRICE_MISSING`）；邮件模板 `LIKENESS_COMPLAINT_RECEIVED`；`PUT /likeness-complaints/{id}/status`（流转规则见 11.6）、`GET /accounts/{id}/avatars` |
| 17.5 配置项（形象渲染、通用用量） | 形象渲染设计 10.6 的十六个键；删除 `generation.avatar_model`；`generation.avatar_timeout_minutes` 的适用范围；`ratelimit.likeness_complaint_per_ip_per_hour`、`usage.max_quantity_per_record`；每天清理到期原照和投诉记录 |
| 18 数据模型（形象渲染、通用用量） | 新增 `AvatarLook`、`CosmeticItem`、`AccountCosmetic`、`ActionItem`、`ActionClip`、`RendererModel`、`DeclarationVersion`、`LikenessComplaint`、`LikenessComplaintEvent`、`DefaultAvatar`；`AvatarAsset`、`GenerationTask`、`Session`、`ModerationRecord`、`usage_log`、`UsagePrice`、`UsageModel` 的新字段；新增唯一约束 |
| 19、20、21（形象渲染、通用用量） | 19 删除 LiveTalking 的核实项、改为与形象生成服务联调；20 新增"外观、装扮、动作与渲染资源"一组验收和通用用量的验收；21 新增形象生成服务、通用用量接口、AvatarAgent 的新字段、云端渲染服务四项依赖 |
| 25.3 站内通知（形象渲染） | `notification.moderation.rejected` 的 `contentType` 增加 `LOOK`；动作片段被拒不发通知 |
| 26.2 客户端配置（形象渲染） | `drivingLookaheadMs`、`renderTierLocalMinFps`、`renderTierMaxMemoryMb`、`avatarCacheMaxMb` |
| 3、4.1、5.4、7.3、15.9、17.4、18、20（形象渲染，2026-10-16 Android 实现计划带来的改动） | 所有动作都是事先生成的片段：`ActionItem` 去掉 `kind`、`expressionPresetRef`，外观创建时为每个适用的动作生成 `ActionClip`，`GET /api/actions` 没有种类字段，后台去掉表情曲线文件；驱动资源包按渲染器格式版本分别保存：新实体 `LookPackage`（`READY`/`PREPARING`/`FAILED`，准备失败按退避重试，达到 `generation.reprepare_max_attempts` 后告警 `LOOK_PACKAGE_PREPARE_FAILED`），`AvatarLook` 去掉 `drivingPackageRef`、`rendererFormatVersion`、状态只剩 `READY`，`GenerationTask.rendererFormatVersion`，package 接口的 409 `PACKAGE_PREPARING`（带重试秒数）与 400 `RENDERER_FORMAT_UNSUPPORTED`，格式版本停用的顺序与每天的清理；与格式无关的标准图和片段改由新接口 `GET /api/looks/{lookId}/media`（及内部同名接口）取，`GET /api/default-avatar` 不带格式版本；配置 `generation.reprepare_max_attempts`、`avatar.download_url_ttl_seconds`；`RendererModel.minAppVersion` 改名 `minVersionCode`（整数）；客户端接口的 JSON 响应（`avatar-upload-options`、外观列表含 `newLookCreditPrice`、media、package、default-avatar、actions、cosmetics、redeem、renderer-models）；`ActionClip` 加 `sha256`、`sizeBytes`；SSE `audio` 的 `opus` 封装（2 字节大端长度 + 包，每个事件最多 10 个包）；`renderTier` 客户端只发 `DEVICE`、`CLOUD`；额度流水条目带 `eventKey` |
| 3.2、3.5、3.8、3.9、14.2、17.5、18（形象渲染，2026-10-17 AvatarEngine 名字和接口） | 形象生成服务定名 AvatarEngine；四个提交方法加 `accountId`；`options` 加 `aiLabelEnabled`；`poll` 加 `failureCode`、`failureDetail`；`submitActionClip` 改传驱动资源包（创建时的包已被清理时的取包规则见 3.8）；HTTP 接口定稿（路由、`request`、`outputs`、错误码）；14.2 的 provider/model 表；露齿面积、亮度的单位；`rendererKind`=`AVATAR_RENDERER_V1`，渲染模型文件名 `avatar-renderer-<版本>.zip` |
| 3.2、3.5、3.9、11.1、14.2、17.5、18、20（形象渲染，2026-10-17 AvatarEngine 实现和实测后的补充，`docs/superpowers/plans/2026-10-17-avatarengine-notes-for-contract.md` 第 1–11 条，含 `2026-10-17-avatarengine-usage-metering-correction.md`） | 14.2：`IMAGE_EDIT` 只记返回了图片的调用和已计费但结果没取回的调用，被内容安全拒绝的不记，结果不确定的不记；模型名 `qwen-image-3.0`；每次尝试一次图像编辑，`retry` 的含义改为同一任务第 2 次及以后的尝试；新增每个任务各资源类型的用量条数上限。3.2、3.5、11.1：每次尝试的检查与作废规则（编辑被拒绝、图读不了、没有人脸或像未成年人、露齿不合格、不能驱动都只作废这一次；服务不可用或已计费未取回立即失败），生成图的年龄检查只在 `moderation.age_check_enabled` 为真时做，建外观不查输入图；3.2 照片重新编码（长边大于 3072 缩到 3072、统一 JPEG、仍大于 19,000,000 字节则 400 `INVALID_FILE`）；3.5 的 413 写明请求体上限 20,000,000 字节、`accountId` 空的写法、片段为只有 H.264 视频流且宽高等于标准图；3.9 `clips` 的画面宽高等于标准图。17.5：露齿门槛建议值 0.035 / 50（仍无默认值），`generation.max_attempts`、`moderation.underage_reject_below_age`、`moderation.face_min_det_score`、两个露齿门槛的保存校验范围。18：`CosmeticItem`、`ActionItem` 的 `generationSpec` 写成英文、1 到 2000 个码点。20：两条验收项（配置范围和照片重新编码） |
| 1.4、3.6、3.7、15.9、20（形象渲染，2026-10-20 Android 客户端提出：所有扣额度的请求都带 `expectedCreditPrice`） | 1.4 新增"扣额度请求的价格核对"通用规则：每个扣额度的请求带必填的 `expectedCreditPrice`（整数，不小于 0，用户看到的总价，0 表示免费）；在扣款的同一个事务里用同一段计算核对，排在幂等键查重和请求校验之后、余额检查之前；不一致返回 409 `PRICE_CHANGED`（`data.creditPrice` 为此刻要扣的数额），不扣款、不写流水、不建任务或拥有记录、不占用幂等键；一个共用的核对方法，三个接口和以后的付费功能都调用；已完成的键和已拥有的服装不做比较。`PRICE_CHANGED` 的错误码行改成通用。3.6 指向通用规则，检查顺序不变。3.7 `redeem` 请求体加 `expectedCreditPrice`（条目的 `creditPrice`），顺序：幂等键 → 校验 → 已拥有 → 价格 409 → 余额 402。15.9 `spend` 请求体加 `expectedCreditPrice`（`costs` 单价 × `quantity`），顺序：幂等键 → 校验 → 价格 409 → 余额 402。20 加三条验收项 |
| 1.4、3.6、20（形象渲染，2026-10-17 Android 客户端提出的建外观价格核对） | `POST /api/avatars/{assetId}/looks` 请求体加必填的 `expectedCreditPrice`（整数，0 表示免费，用户确认的价格）；扣费前在同一个锁和事务里与此刻的价格比较，不一致返回 409 `PRICE_CHANGED`（`data.creditPrice` 为此刻的价格），不扣款、不建任务；检查顺序：幂等键 → 请求体 400 → 503 → 外观数上限 403 → 价格 409 → 余额 402；新增错误码 `PRICE_CHANGED`；20 增加一条验收项 |
| 4.1、4.2、4.3、5.4、14.2、20（形象渲染，2026-10-17 AvatarAgent 实现带来的补充） | dispatch metadata 加 `deadlineAt`（十二个字段）；identity 以 `render_` 开头的云端渲染服务不算 agent、不算用户；`renderMode=CLOUD` 收不到渲染服务的轨时播放 agent 的音频轨；SSE `audio` 加 `preSkip`，多出的字段原样转发、不算格式不对；`sampleOffset` 的单位和取值；文字对话一轮可能有两条 LLM 用量 |
| 1.4、2.5、2.5.1、2.9、3.2、3.3、3.4、3.10、4.1、4.3、5.4、7.3、8.2、8.3、11.1、11.2、11.4、13.1、13.3、17.4、17.5、18、19.2、20、21、22.2、22.7、25.1、25.3、25.6、25.8（页面结构，2026-10-18） | 伴侣名字 `User.companionName` 与 `PUT /api/companion-name`，dispatch metadata 和 `/v1/chat/turn` 加 `companionName`（十三个字段，AvatarAgent 要实现）；形象名字（上传必填 `name`、`GenerationTask.assetName`、列表和任务列表带 `name`、`PUT /api/avatars/{assetId}` 改名）；默认数字人 `name`；页面标识清单换成新页面（`companion`、`store`、`credits` 替换 `companionship`、`assets`）；生成成功和失败的系统事件通知，系统事件通知都附带推送（`triggerReason=system_event`，新偏好 `activity`，`NotificationPreference.activity`）；伴侣名字的审核记录类型 `COMPANION_NAME`、审核服务故障时先保存后复核（`ContentModerationProvider` 返回 `serviceFailed`，11.2）、名字规则统一在 2.5.1（含双向覆盖字符）、没有生效的默认数字人时的取值（3.10）、`companionName` 的取值约束和优先级（4.1）；删除账号可选原因 `AccountDeletion.reason`；事件 `login_page_view` 的 `method` 增加 `entry`（登录入口页展示）；广告位 `call_end`、`history_feed` 的位置按单一对话页改写。17.5 的 `moderation.call_timeout_seconds` 说明加伴侣名字例外；25.6 未读数在收到 `type=activity` 的推送时也刷新。依据 `docs/superpowers/specs/2026-10-18-app-page-structure-design.md` |
| 1.3、1.4、1.6、17.5、18、19.2、22–26（2026-10-21 小改清单） | 1.3 响应示例只写 `data` 的值、304 没有响应体；1.4 新增 500 `INTERNAL_ERROR`、503 `TEMPORARILY_UNAVAILABLE`，`DUPLICATE_RESOURCE` 扩到权益 `priority`、短信通道、渠道、版本、服装和动作，`INVALID_REQUEST` 的 `data.details` 定义了 `ref` 和 `reason` 代码；1.6 补了管理端限流行；17.5 新增键 `app.display_name`；18 补了唯一约束和索引（含 Mongo `ad_impression_log(impressionId, eventType)`）；19.2 补全共用密钥清单并新增 Google 订阅周期额度政策核实项；22–26 的细节修正见各节 |
| 3.2、3.6、3.7、3.9、5.4、6.1、6.3、8.3、9、11.6、13.1、13.3、15.3、15.5、15.9、17.4、17.6、18、22.3–22.8、25.4、28.1、28.2（2026-10-21 对接方看得到、之前没写的细节） | 渲染模型“最新”的次序与参数校验（`RendererModel.createdAt`）；新建外观不改当前外观；声明的“当前生效”；服装目录 `kind` 必填；形象上传的错误次序；建外观的幂等键按形象区分（`GenerationTask` 唯一键含 `avatarAssetId`）；文字对话流在 `done` 后结束；里程碑次序与无养成数据的默认值；推送计数；邀请记录脱敏；多种凭据同时出现；导出的下载细节和 429；商店通知接口的限流、401 与 200；订阅与额度商品的 `surfaces`；`features` 的键；额度统计里退款抵消；用户导出需要 `USER:VIEW`；AppsFlyer 重复与缺 id；投诉表单字段；广告单元 `surfaces` 与统计的渠道维度；版本号比较；通知分页；签到与每日任务的重复与进行中 |
| 1.4、10.4、13.5、15.3、15.9、17.5、17.6、18、22.9、24.2、24.3（2026-10-21 对第二版回复的修改） | 1.4 新增 405 `METHOD_NOT_ALLOWED`、415 `UNSUPPORTED_MEDIA_TYPE`、503 `DEPENDENCY_UNAVAILABLE`；17.5 审核阈值未配置时用户端接口返回 503、管理端不受影响；13.5 删除记录和审计日志里的账号 ID 暂不设保留期并披露；15.9 Apple 额度购买指向已删除账号的两条路径、从未入账的锚点行可以被之后的 `verify` 认领而已入过账的墓碑不可认领（Apple 和 Google 一致）、订阅每期赠送的规则；上传文件（广告素材、缩略图、APK）的公开地址和配置项 `upload.public_base_url`；10.4 非 Android 的下载点击不记录（`attrId` 为 `null`）；17.6 归因日汇总随当天刷新落地 |
| 17.6、22.3、22.4、22.8、22.9（2026-10-21 对第三份回复的修改） | 应用内广告报表（不是买量投放）的六个接口加可选参数 `channelCode`（不传 = 全部渠道，`unknown` = 没带渠道，格式不合法 400，与 `platform` 同时传两个条件都满足）；`StatAdNofillDaily` 加 `channelCode` 列，无广告原因按（日期、平台、渠道、广告位、原因）计数；管理端广告报表页加渠道下拉；广告报表导出带同样的 `platform`、`channelCode`；管理端“无广告原因分布”表删去平台列 |
| 17.2、17.4、17.5 之后的“17.4 附”、3.10、11.2、18、1.4（2026-10-21 对第五份回复的修改） | 新接口 `GET /api/admin/meta`（十二个字段）；`/api/admin/me` 加 `id`、`passwordMinLength`；17.4 的通则和逐接口响应字段表（管理员用户名字段、后台图片地址、长度单位、下拉选项来源接口的读取权限、不返回的列只有四类）；后台列表分页的缺省值与校验；封禁和解封的权限码 `USER:BAN`；默认数字人的状态链和 `failureReason`；规则词表整表替换和 `reason` 代码 `INVALID_PATTERN`；后台上传接口的文件字段名 `file`；`AdminAuditLog.adminUsername` |
| 9.1、13.5、18、17.4、19.2（2026-10-21 对第七份回复的修改） | `User.inviteeRewardedAt`：被邀请人的奖励评估通过时与奖励同一事务写入（金额为 0 也写），13.5 的 `inviteeRewarded` 改读 `User` 行（`inviteeRewardedAt` 或 `priorInviteeRewarded`）；17.4“形象与装扮”行的目录接口请求字段名（`previewUploadId`、`iconUploadId`、`uploadId`、`sourceUploadId`）、三个目录上传接口及 `AdminUpload` 的新 `kind`、上下架和上传声明接口；19.2 加过一项缺的输入（三个目录上传接口的类型和大小上限），已由第八份回复补齐并删除 |
| 3.2、17.4、22.9（2026-10-22 对第九份回复的修改） | `GET /api/avatar-upload-options` 加 `maxBytes`、`maxPixels`，3.2 补照片宽×高上限；`GET /api/admin/meta` 从十二个字段变成二十个（加八个上传限制）；22.9 补广告素材图片的宽×高上限 |
| 3.5、3.9、17.4 附、17.5（2026-10-21 对第八份回复的修改） | 三个目录上传接口的文件类型、大小和像素上限（17.4 附·通则第 6 条）；新配置键 `upload.render_asset_max_bytes`；3.5 从形象生成服务取回产物时的单文件上限和超限处理 |

---

## 二十八、每日签到与每日任务

依据：用户 2026-10-05 的决定——dramaBox 已验证有用的功能都带过来，签到和每日任务是常见的留存功能，不属于短剧专属。照 dramaBox 的"活动管理"模块（签到配置、签到记录、签到统计，观看任务配置、任务记录、任务统计 [子代理读码 dramaBox-admin `src/pages/act/*`、`stat/act-signin-ops`、`stat/act-watch-task-ops`，后台设计会话的笔记 `_scratch_dramabox_admin_modules_a.md` 5、`_scratch_dramabox_admin_stats.md` 3.12-3.13]）。奖励是**额度**（15.9），不是金币；dramaBox 的"观看集数""观看时长"任务是剧集专属，换成 AvatarApp 自己的任务类型（28.2）。dramaBox 的后端部分没有读过源码（只读了后台页面和类型），所以下面的服务端规则里凡是没有 dramaBox 出处的都标了 [推断]。

游客没有账号和额度，不能签到、不能做任务（游客凭据调用本节的客户端接口返回 403 `REGISTRATION_REQUIRED`）。

### 28.1 每日签到

**数据**（18）：
- `CheckinActivity`：`id`、`name`、`startDate`、`endDate`（日历日，空表示不限）、`status`（`DRAFT`/`ACTIVE`/`DISABLED`）、`createdBy`、`createdAt`、`updatedAt`。接口返回的 `lifecycleStatus` 另有 `ENDED`（`endDate` 早于“UTC−12 时区此刻的日期”，也就是地球上最后一个时区也过了 `endDate`，现算，不存；这样不会出现用户本地日还在 `endDate` 内、后台却显示已结束的情形，因为资格按账号本地日判断）。
- `CheckinReward`：`activityId`、`dayNum`（1 到 N，连续）、`rewardCredits`（≥ 0）、`bonusCredits`（≥ 0，默认 0，"额外额度"）；至少一行。
- `CheckinRecord`：`id`、`accountId`、`activityId`、`checkinDate`（账号本地日）、`dayNum`、`consecutiveDays`、`rewardCredits`、`bonusCredits`（**发放时记入的数值**，之后改阶梯不影响已发的）、`createdAt`；`(accountId, checkinDate)` 唯一。

**规则**：
- **日界线是账号的本地日**（`User.timezone`），所以两个客户端接口都要带 `timezone`（IANA 时区名，缺失或无效返回 400 `INVALID_TIMEZONE`，通过后写入 `User.timezone`，规则同 4.1）。
- 同一时刻只有一个生效的签到活动：`status=ACTIVE` 且本地日在 `[startDate, endDate]` 内。没有 → `GET` 返回 `activity: null`，`POST` 返回 404 `CHECKIN_NOT_AVAILABLE`。
- `POST /api/checkin`：在一个数据库事务里——该账号当天（本地日）已有记录，**或该账号最近一条签到记录的 `checkinDate` 晚于今天的本地日**（时区改小造成的“回到过去”，见下面的防刷）→ 直接返回最近那条记录并带 `alreadyCheckedIn=true`，**不重复发放**（幂等）；并发的两个请求撞上 `(accountId, checkinDate)` 唯一约束时，输的一方重读并按同样方式返回 `alreadyCheckedIn=true`，额度只发一次；否则 `consecutiveDays` = 昨天（本地日）有签到记录则昨天的 `consecutiveDays` 加一，否则为 1 [推断，dramaBox 的连续规则没有读服务端代码；活动换了也接着算]；`dayNum = ((consecutiveDays − 1) mod N) + 1`，N 是阶梯的天数，**阶梯走完后从第 1 天重新循环** [推断，dramaBox 走完以后怎么处理没有核实]；奖励 = 阶梯里该 `dayNum` 的 `rewardCredits + bonusCredits`；写 `CheckinRecord`、写一条 `CreditLedger`（`reason=CHECKIN_REWARD`，`delta` 为奖励，`eventKey = checkin:<accountId>:<checkinDate>`，沿用 `(reason, eventKey)` 唯一约束）并更新 `CreditBalance`；奖励为 0 时只写记录不写流水。账号不是 `ACTIVE` 拒绝（2.8）。提交之后记后端事件 `checkin_completed`（7.3）。
- **防止靠改时区重复领取**：签到日（`checkinDate`）必须严格大于该账号最近一条签到记录的签到日，否则按上面的幂等处理，不发放。时区在这里只会让签到日提前至多两个日历日（UTC−12 与 UTC+14 之间相差 26 小时），而每个签到日只能领一次，所以长期的上限仍然是每个真实日一次，改时区最多一次性提前领到后面两天的奖励，随后要等本地日追上才能再领；这个一次性的提前量接受。**同一账号的签到在事务内先对 `User` 行 `SELECT … FOR UPDATE` 再读最近一条记录和写新记录**（锁等待由数据库处理，不另设 Redis 锁），并发的两个不同时区的请求不会各自读到同一条“最近一条”而都通过单调检查。
- **客户端接口**（`/api`，用户令牌）：`GET /api/checkin?timezone=` → `{"activity":{"id":"…","name":"…","startDate":"…","endDate":"…","rewards":[{"dayNum":1,"rewardCredits":1,"bonusCredits":0}]},"checkedInToday":false,"consecutiveDays":3,"nextDayNum":4}`（**取值公式**（令 `last` 为该账号最近一条签到记录，和 `POST` 用同一个判断）：`checkedInToday` = `last.checkinDate` 不早于今天本地日（含时区改小后“最近一条在今天之后”的情形，此时 `POST` 也返回 `alreadyCheckedIn=true`，两个接口一致）；`consecutiveDays` = `checkedInToday` 为真则取 `last.consecutiveDays`，否则 `last.checkinDate` 等于昨天（本地日）则取 `last.consecutiveDays`，否则 0——也就是断签后为 0，不是保留旧值；`nextDayNum` = `(consecutiveDays mod N) + 1`，N 是生效活动的阶梯天数，今天已签时它是明天会领的那一档，没签时是今天会领的那一档；没有生效活动时 `activity` 为 `null`，三个字段取 `false`、0、`null`）；`POST /api/checkin` 请求体 `{"timezone":"Asia/Singapore"}` → `{"alreadyCheckedIn":false,"dayNum":4,"consecutiveDays":4,"rewardCredits":2,"bonusCredits":1,"balance":15}`；`alreadyCheckedIn=true` 时 `balance` 是此刻的当前余额，`dayNum`、`consecutiveDays`、`rewardCredits`、`bonusCredits` 是那条记录第一次发放的值。

**活动的生命周期**（照 dramaBox）：`DRAFT → ACTIVE`（发布）、`ACTIVE → DISABLED`（停用）、`DISABLED → ACTIVE`（启用）；只有 `DRAFT` 且没有签到记录的活动能删除；任何状态都能编辑（改阶梯只影响之后的签到）；**编辑一个 `ACTIVE` 活动的日期范围时做同样的重叠探测**：`PUT /checkin/activities/{id}` 带 `confirm`，范围改后与其他 `ACTIVE` 活动重叠时不执行，返回 200 `{"applied":false,"disabledActivities":[…]}`，确认后（`confirm=true`）执行并停用它们。发布、启用和编辑日期都在 `pg_advisory_xact_lock(hashtext('checkin_activity'))` 内先探测再执行（锁的键必须是整数，由名字算出固定的值），`confirm=true` 以执行时实际重叠的集合为准，并发的两次发布不会同时 `ACTIVE`。**运行时的决胜规则**（本不应出现多个同时生效的活动，数据异常时防御）：取 `startDate` 最晚的（空按最早），再取 `id` 最大的。**同一时间只允许一个生效的活动**：发布或启用时，日期范围与它重叠的其他 `ACTIVE` 活动会被停用。接口 `PUT /checkin/activities/{id}/status {"status":"ACTIVE","confirm":false}` 先探测：有重叠的活动时不执行，返回 200 `{"applied":false,"disabledActivities":[{"id":"…","name":"…"}]}`，后台弹确认框列出将被停用的活动，用户确认后用 `confirm=true` 再请求，执行并停用它们；没有重叠时 `confirm` 为何值都直接执行 [核实 dramaBox-admin `act-signin-config` 的探测和确认流程]。

**后台接口**（`/api/admin`）：`GET /checkin/activities?name=&lifecycleStatus=`、`GET /checkin/activities/{id}`（含阶梯）、`POST /checkin/activities`、`PUT /checkin/activities/{id}`、`DELETE /checkin/activities/{id}`、`PUT /checkin/activities/{id}/status`、`GET /checkin/records?accountId=&activityId=&from=&to=`（列账号、活动、签到日期、天数、连续天数、奖励额度）。权限：`CHECKIN:VIEW` 查看，`CHECKIN:MANAGE` 增删改和状态；写操作写审计日志。

**统计**（17.6）：`StatCheckinDaily`（`statDate`、`consecutiveDays`；`checkins` 当天该连续天数的签到次数、`creditsGranted`），来源 `CheckinRecord`；接口 `GET /stats/checkin/daily-users?from=&to=` 返回 `{"items":[{statDate,userCount}]}`（每天一次签到，所以人数等于次数之和），`GET /stats/checkin/streak-buckets?from=&to=` 返回 `{"items":[{consecutiveDays,checkinCount}]}`（范围内按连续天数分布，每个连续天数一行）；落地 `checkin-daily`，导出 `checkin-daily-users`、`checkin-streaks`。

### 28.2 每日任务

照 dramaBox 的"观看任务"：运营配置每日任务，用户完成后领奖励 [子代理读码 dramaBox-admin `act-watch-task-config`、`act-watch-task-record`]。任务类型换成 AvatarApp 自己的：

**任务类型 `taskType`**（代码声明，新增类型要加代码）：
- `daily_login`：每日登录。进度：账号当前任务日里第一次调用 `GET /api/daily-tasks`（客户端冷启动时调用一次）时置为 1。`daily_login` 的进度只由 `GET /api/daily-tasks` 置 1，`refreshTaskProgress` 对它取 `max(现值, 本次触发是不是 GET)`，不重新算，所以会话结算触发的刷新不会把它算回 0。没有联网的一天不算登录：服务端只能记录到达服务端的请求；读取失败时客户端在回到前台和网络恢复时重试。
- `call_seconds`：每日通话时长（秒）。进度 = `TaskRecord` 的时间窗口 `[windowStartAt, windowEndAt)` 内账号**结束**（`Session.endedAt`）的会话的 `durationSeconds` 之和（从 `Session` 重新算，所以重复触发结果不变；跨午夜的通话整段算在结束的那一天）。
- `text_messages`：每日文字消息条数。进度 = 时间窗口内账号 `source=TEXT` 且 `turnStatus=COMPLETED` 的用户消息条数，按 `Message.timestamp` 归入窗口（从 `Message` 重新算）。

**数据**（18）：
- `TaskConfig`：`id`、`taskName`（≤ 100）、`taskType`、`targetValue`（≥ 1，`call_seconds` 的单位是秒；`daily_login` 的 `targetValue` 必须是 1，否则 `INVALID_REQUEST`，因为它的进度只有 0 和 1）、`rewardCredits`（≥ 0）、`description`（≤ 500）、`claimTimeoutSeconds`（可空：达成后必须在这么多秒内领取，空表示当天（本地日）内随时可以领取）、`sortOrder`、`status`（`ENABLED`/`DISABLED`）、`createdAt`、`updatedAt`。**修改限制**：已经有 `TaskRecord` 的配置不能改 `taskType` 和 `targetValue`（409 `TASK_HAS_RECORDS`，要换就停用旧的、新建一个）；`taskName`、`description`、`rewardCredits`、`claimTimeoutSeconds`、`sortOrder`、`status` 任何时候都能改，`rewardCredits` 的修改只影响之后才达成的记录（达成时快照，见下）。
- `TaskRecord`：`id`、`accountId`、`taskId`、`taskDate`（账号本地日）、`currentProgress`、`status`（`IN_PROGRESS` 进行中 / `CLAIMABLE` 可领取 / `REWARDED` 已领奖 / `EXPIRED` 已过期）、`timezone`（创建这条记录时请求带的时区）、`windowStartAt`、`windowEndAt`（`taskDate` 在该时区的起止，UTC）、`targetValue`（创建时快照）、`rewardCredits`（**达成变为 `CLAIMABLE` 时快照**）、`completedAt`、`claimDeadlineAt`、`rewardedAt`、`creditsGranted`（发放时记入，等于快照）；`(accountId, taskId, taskDate)` 唯一，也就是每个账号每个任务每个本地日一条（dramaBox 的任务配置有 `dailyLimit`，它的帮助文字说明当前数据模型每天只有一条记录，这个字段实际不起作用 [子代理读码，后台页面文字]，这里不设）。

**规则**：
- **任务日**：一个账号的任务日窗口 `[windowStartAt, windowEndAt)` 互不重叠（用户离线几天后相邻窗口之间允许有空隙），**同一个 `taskDate` 的所有记录共用同一个窗口和 `timezone`**（记录创建时从该任务日已有的窗口复制，没有则按下面新开），进度按窗口算，不随用户之后改时区而变，所以重新算的结果是确定的，同一段活动也不会被两个任务日重复计入。**取当前任务日并建记录在事务内先对 `User` 行 `SELECT … FOR UPDATE` 之后完成**（插入记录遇唯一冲突就重读），两个不同时区的并发请求不会开出重叠的窗口。**取当前任务日**：① 存在 `windowStartAt ≤ 现在 < windowEndAt` 的窗口，它就是当前任务日；② 否则新开一个窗口：设 `L` 为请求时区的本地日；账号已有任务日且 `L` 不晚于最后的 `taskDate` 时（时区改小、或最后一个窗口刚结束），`taskDate = 最后的 taskDate + 1`，窗口从最后窗口的终点开始，长 24 小时；否则 `taskDate = L`，窗口起点是 `max(L 在请求时区的本地 0 点, 最后窗口的终点)`，终点是 L 在请求时区的次日本地 0 点。这样改时区不会开出已经过去的任务日，也不会靠改时区在同一真实日里再领一轮；时区改大时任务日最多提前两个日历日（UTC−12 与 UTC+14 之间），这个一次性的提前量接受（同签到）。**`refreshTaskProgress` 的时区输入**：会话结束流程取该 `Session.timezone`，文字轮次完成取请求体的 `timezone`，`GET /api/daily-tasks` 和领取取请求的 `timezone`；已有当前窗口时不需要时区。
- **进度刷新**：会话结束流程（15.6）、文字轮次完成（5.4）之后，以及 `GET /api/daily-tasks`、领取在组装响应之前，调用 `refreshTaskProgress(accountId, 目标任务日)`（会话结算的目标是包含 `endedAt` 的窗口，没有这样的窗口就跳过；其余触发的目标是当前任务日）：为每个 `ENABLED` 的任务取或建当天的 `TaskRecord`，按上面的规则重新算 `currentProgress`，达到记录上快照的 `targetValue` 且状态还是 `IN_PROGRESS` 时置 `CLAIMABLE`，写 `completedAt`、快照 `rewardCredits`（取配置当时的值），`claimTimeoutSeconds` 非空则写 `claimDeadlineAt = completedAt + claimTimeoutSeconds`。重新算而不是累加，所以重复触发不会多算；放在各自事务提交之后的独立事务里，失败只记日志，下一次触发时补上。
- `GET /api/daily-tasks?timezone=`（规则同签到的 `timezone`；路径不叫 `/api/tasks`，那是 3.3 的资产生成任务）：响应 `{"tasks":[…]}`（外层同 3.3 的资产任务列表），内容是当天的任务列表，按 `sortOrder`，每项 `{taskId, taskName, taskType, targetValue, rewardCredits, description, currentProgress, status, claimDeadlineAt}`；`status=IN_PROGRESS`（进行中）的任务，`rewardCredits` 取当前配置值（运营之后改了奖励，列表跟着变）；达成之后（`CLAIMABLE`、`REWARDED`、`EXPIRED`）取记录上的快照；读取时先把已过 `claimDeadlineAt` 的 `CLAIMABLE` 置 `EXPIRED`。
- `POST /api/daily-tasks/{taskId}/claim`（请求体 `{"timezone":"…"}`）：当前任务日的记录必须是 `CLAIMABLE` 且 `claimDeadlineAt` 为空或晚于现在，否则 409 `TASK_NOT_CLAIMABLE`；**领取先执行 `refreshTaskProgress`（取当前任务日、建出记录）再判断**，所以窗口已过的旧记录领不到，新任务日的记录是 `IN_PROGRESS` → 409，不依赖清扫任务；`taskId` 不存在、配置已被删除、或配置被停用而当前任务日没有它的记录 → 404 `RESOURCE_NOT_FOUND`（配置之后被停用不影响领取：已经达成的记录按快照照常领取）；在一个事务里条件更新 `CLAIMABLE → REWARDED`、记 `creditsGranted`（取记录上的快照）、写 `CreditLedger`（`reason=TASK_REWARD`，`eventKey = task:<TaskRecord.id>`）、更新 `CreditBalance`；奖励快照为 0 时只置 `REWARDED`、不写流水（同签到）；已经 `REWARDED` 再领 → 200 返回已发放的结果（幂等）；响应是更新后的单个任务对象（字段同列表的一项）。提交之后记后端事件 `task_rewarded`。
- **过期**：`windowEndAt` 已过的 `IN_PROGRESS` 和 `CLAIMABLE` 记录（没有完成，或完成了没领），在读取时和每 `tasks.sweep_seconds`（默认 60）秒的清扫任务里置 `EXPIRED`，同时处理已过 `claimDeadlineAt` 的 `CLAIMABLE` 记录；所以旧的进行中记录不会永远留在 `IN_PROGRESS`。`GET /api/daily-tasks` 返回当前任务日里 `ENABLED` 配置的记录，外加配置已被停用但状态是 `CLAIMABLE` 的记录。dramaBox 靠客户端调 `/task/expire` 并给服务端留一个兜底缓冲 [子代理读码 dramaBox-admin 的配置项文字]，这里全部由服务端判断，不依赖客户端。

**后台接口**（`/api/admin`）：`GET /tasks/configs?taskName=&taskType=&status=`、`GET /tasks/configs/{id}`、`POST /tasks/configs`、`PUT /tasks/configs/{id}`、`DELETE /tasks/configs/{id}`（已有任务记录时返回 409 `TASK_HAS_RECORDS`，只能停用）、`PUT /tasks/configs/{id}/status`（`ENABLED`/`DISABLED`）、`GET /tasks/records?accountId=&status=&from=&to=`。权限：`TASK:VIEW`、`TASK:MANAGE`；写操作写审计日志。

**统计**（17.6）：`StatTaskDaily`（`statDate`、`taskId`；`totalRecords`、`completedCount`（`completedAt` 非空的记录数）、`rewardedCount`、`creditsIssued`），来源 `TaskRecord`；接口 `GET /stats/tasks/summary?from=&to=` 返回 `{"items":[...]}`，范围内每个任务一行（不是一天一行），每行 `{taskId,taskName,totalRecords,completedCount,rewardedCount,creditsIssued,completionRate}`（`completionRate = completedCount / totalRecords`，分母为 0 时为 `null`），`GET /stats/tasks/daily?from=&to=` 返回 `{"items":[...]}`，逐日一行 `{statDate,totalRecords,completedCount,rewardedCount}`；落地 `task-daily`，导出 `task-summary`。

### 28.3 账号删除、导出、验收

- 账号删除（13.1 步骤表第 6 步）删除该账号的 `CheckinRecord`、`TaskRecord`；已发放的额度流水随账号清除。数据导出（13.3）带上 `checkin.json`、`tasks.json`。
- 验收：
  - [ ] 签到：没有生效活动 → `GET` 的 `activity` 为 `null`，`POST` → 404 `CHECKIN_NOT_AVAILABLE`；同一本地日重复 `POST` → 200 `alreadyCheckedIn=true`，额度只发一次，`balance` 是此刻的余额，金额字段是第一次发放的值；连续两天签到 `consecutiveDays` 为 2，隔一天重置为 1；连续天数超过阶梯天数后 `dayNum` 从 1 循环；奖励记在 `CheckinRecord` 和 `CreditLedger`（`CHECKIN_REWARD`，`eventKey` 为 `checkin:<账号>:<日期>`），之后改阶梯不影响已发的；`timezone` 缺失 → 400 `INVALID_TIMEZONE`；换时区后日界线按新时区；游客 → 403 `REGISTRATION_REQUIRED`；账号被封禁 → 403 `ACCOUNT_BANNED`
  - [ ] 签到活动：发布时日期范围重叠 → 探测返回 `disabledActivities`，确认后重叠的活动被停用；删除有签到记录的活动 → 不允许；`DRAFT` 且没有记录可删；阶梯天数不连续或没有行 → `INVALID_REQUEST`；没有 `CHECKIN:MANAGE` → 403 `ADMIN_FORBIDDEN`
  - [ ] 任务：三种类型的进度来源和重新算的结果正确（重复触发不多算）；达到目标置 `CLAIMABLE`；领取发放一次 `TASK_REWARD`，重复领取返回同样结果；`claimTimeoutSeconds` 过后 → `EXPIRED` 且领取 → 409 `TASK_NOT_CLAIMABLE`；前一天的 `CLAIMABLE` 记录在今天变成 `EXPIRED`；`GET /api/daily-tasks` 第一次调用当天 `daily_login` 进度为 1；进行中的任务 `rewardCredits` 取当前配置值（运营改了奖励，列表跟着变），已达成的取记录上的快照
  - [ ] 任务配置：`targetValue` 小于 1 或 `description` 超过 500 字符 → `INVALID_REQUEST`；已有记录的配置删除 → 409 `TASK_HAS_RECORDS`，停用成功；停用后未达成的记录不再返回，已达成（`CLAIMABLE`）的仍返回且可领取
  - [ ] 统计：`StatCheckinDaily`、`StatTaskDaily` 与记录一致，补数幂等；两个统计接口的比率分母为 0 时为 `null`；导出 `checkin-daily-users`、`checkin-streaks`、`task-summary` 有 `STATS:EXPORT` 才能下载
  - [ ] 防刷：签到后把时区改到更早的时区再 `POST` → 200 `alreadyCheckedIn=true`、不发放，此时 `GET` 的 `checkedInToday` 也为 `true`；改到更晚的时区最多提前领到后面两天，随后本地日追上之前不能再领；任务日窗口互不重叠，改小时区时 `taskDate = 最后的 taskDate + 1` 且窗口从上一个窗口的终点开始，不会开出已经过去的任务日，也不会重复计入同一段通话
  - [ ] 并发的两个签到请求 → 额度只发一次，输的一方返回 `alreadyCheckedIn=true`；`GET /api/checkin` 的 `consecutiveDays` 在断签后为 0、今天已签时含今天，`nextDayNum` 为 `(consecutiveDays mod N) + 1`
  - [ ] 活动：编辑一个 `ACTIVE` 活动的日期范围与另一个 `ACTIVE` 活动重叠 → 探测返回 `disabledActivities`，确认后执行；`lifecycleStatus=ENDED` 的判定是 UTC−12 时区的日期过了 `endDate`，在此之前本地日仍在范围内的账号还能签到
  - [ ] 任务：停用配置后已达成（`CLAIMABLE`）的记录仍可按快照领取，列表仍显示；已有记录的配置改 `taskType` 或 `targetValue` → 409 `TASK_HAS_RECORDS`；达成后改 `rewardCredits` 不影响已达成的记录；`windowEndAt` 已过的 `IN_PROGRESS`、`CLAIMABLE` 记录被置 `EXPIRED`；`call_seconds` 按 `Session.endedAt` 落在窗口内计，跨午夜的通话整段算结束那天
  - [ ] 签到活动：`DISABLED → ACTIVE` 启用时同样做重叠探测；`confirm=false` 且无重叠时直接执行；多个活动同时满足时取 `startDate` 最晚的、再取 `id` 最大的；奖励为 0 时只写记录、不写流水；`GET /checkin/records` 按账号、活动、日期筛选，缺 `CHECKIN:VIEW` → 403；两个不同时区的并发签到请求在账号级锁内串行，只发一次
  - [ ] 任务：领取当前任务日没有记录的 `taskId` → 404 `RESOURCE_NOT_FOUND`；窗口已过的旧记录领取 → 409 `TASK_NOT_CLAIMABLE`（领取先执行 `refreshTaskProgress`）；并发两次 `claim` 只发放一次；缺 `timezone` → `INVALID_TIMEZONE`；`daily_login` 的 `targetValue` 不是 1 → `INVALID_REQUEST`；缺 `TASK:VIEW`/`TASK:MANAGE` → 403；`GET /tasks/records` 按账号、状态、日期筛选；两个不同时区的并发请求不会开出重叠的任务日窗口；会话在窗口结束之后才结算时，刷新的是包含 `endedAt` 的那个任务日
  - [ ] 对 `IN_PROGRESS` 的记录领取 → 409 `TASK_NOT_CLAIMABLE`；奖励快照为 0 的任务领取只置 `REWARDED`、不写流水；`taskName` 超过 100、`rewardCredits` 小于 0、`claimTimeoutSeconds` 小于 1 → `INVALID_REQUEST`；`daily_login` 的进度不会被会话结算触发的刷新算回 0；后端事件 `checkin_completed`、`task_rewarded` 在奖励提交之后记
  - [ ] `StatCheckinDaily` 按 `checkinDate` 归并（账号本地日，跨 UTC 日的签到不会拆到两天），`StatTaskDaily` 按 `taskDate` 计入（领奖在次日的任务仍算在 `taskDate` 那天）；并发发布两个重叠的签到活动只有一个最终 `ACTIVE`


# 给负责人：契约（`backend-task-java-backend.md`）第 17.4、17.5 节需要在 AvatarApp 的 main 上做的修改（后端第一批交付引起）

> **写给：** 负责人，由他决定谁在 AvatarApp 的 `main` 上改 `docs/backend-task-java-backend.md`。本仓库 `docs/shared-snapshots/backend-task-java-backend.md` 是只读快照，没有改。
> **来源：** `docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 的第 2 节 (b)（告警类型）、(d)（设置键，d1–d18）、"4. 没有核实的"第 7 条、第 3 节第 1 条，以及 2026-10-31 追加的 W2a、GROUP A、GROUP B 两节。后端的原始请求文件（`item-NN.md`、`ip-storage-switches.md`、`retention-settings.md`、`w5b-ranges-and-account-memory.md`、`w6b-changes.md`、`w7-changes.md`）在后端仓库里，本仓库读不到；下面凡是清单没有写出的（例如章节号、检查顺序），明写"清单没有给出"，不替后端编。
> **行号：** 快照里的行号。17.4 的后台告警一段在第 2326 行，17.5 的表从第 2404 行起。
> **为什么这份文件重要：** 管理端前端的设置页（`CONFIG_SCHEMA`）的键清单本来只从 17.5 的表生成，表里没有的键会被当成"未识别的配置项"。后端已经返回了 25 个表里没有的键。契约改完之前，管理端前端用一份单独的"契约采纳前的后端额外键"清单（计划任务 10），契约采纳后从清单里删；检查脚本会在清单里的键出现在契约表里时报错，提醒删除。

---

## 一、17.4 后台告警一段（第 2326 行）：`type` 共十四种 → 十八种

### 1.1 要改的句子

- **现在：** "`type` 共十四种：`DELETION_FAILED`…`LOOK_PACKAGE_PREPARE_FAILED`…"
- **改成：** "`type` 共十八种"，在 `LOOK_PACKAGE_PREPARE_FAILED` 之后补下面四种（顺序以后端为准；后端的数据库约束列出十七个值，`STAT_RELAND_FAILED` 是第十八个）。

### 1.2 新增的四种

| `type` | 含义 | `refType` | `refId` | `accountId` | `detail` | 打开 | 自动解决 | 手动解决 |
|---|---|---|---|---|---|---|---|---|
| `SUPPORT_FORWARD_FAILED` | 客服反馈转发用尽次数 | `SUPPORT_FEEDBACK` | `SupportFeedback.id`（UUID 文本） | 反馈所属账号（所以'关联账号'可点进用户详情） | 固定为 `attempts_exhausted`（不含反馈正文，也不含转发器的错误文字；错误文字在反馈列表的 `lastError`） | 客服转发的轮次把反馈置为 `FAILED`（次数达到 `retry.max_attempts`）的同一个事务里；同一个反馈同一时刻只有一条 `OPEN` | 管理员对这条反馈点'重试'（`POST /api/admin/support/feedback/{id}/retry`，反馈回到 `PENDING`）时，同一事务里自动 `RESOLVED`；重试后又失败会开一条新的 | 可以（`POST /alerts/{id}/resolve`），对反馈没有副作用 |
| `POSTBACK_CREDENTIAL_FAILED` | 广告投放活动的转化回传凭证不能用 | `ATTRIBUTION_CAMPAIGN` | `AttributionCampaign.id` | 空 | 广告平台返回的错误码（可能为空），或固定值 `token_unreadable`（存着的访问令牌用当前密钥解不开）、`pixel_id_malformed`（存着的像素编号不符合 `^[A-Za-z0-9]{1,64}$`）；**一条打开的告警，后来不同原因的失败会替换它的 `detail`**（2026-10-31 的更正，以前是保留第一次的） | 同一活动一条 `OPEN`；该活动停止回传，到期行按重试公式退避 | 管理员重新填写令牌或像素编号（`PUT /attribution/campaigns/{id}`）时，或该活动的回传发送成功时 | 可以 |
| `SUBSCRIPTION_EVENT_FAILED` | 订阅事件处理失败 | **清单没有给出** | **清单没有给出** | **清单没有给出** | **清单没有给出** | **清单没有给出** | **清单没有给出** | **清单没有给出** |
| `STAT_RELAND_FAILED` | 统计日重新落地连续失败 | `STAT_RELAND_DAY` | `<落地器名>:<yyyy-MM-dd>`，例如 `usage-cost:2026-10-10` | 空 | 只有异常类名 | 某个统计日被标记为需要重新落地（成本回填给旧用量补了价格之后），连续失败 5 次；同一个统计日一条 `OPEN` | 该日期落地成功时自动 `RESOLVED` | 可以；该日期仍然失败时下一次失败会再次打开。在此期间该日期按 10、20、40 分钟这样递增的间隔重试，最长 6 小时一次 |

- `SUBSCRIPTION_EVENT_FAILED` 只在后端的两个请求文件里被点名（数据库约束列出十七个值），写它的请求不在后端交给我们的文件里。**请后端补这一行**，在补全之前契约里只能写类型名，管理端前端页面只给它类型名称，`detail` 和关联对象原样显示，不编说明。
- `POSTBACK_CREDENTIAL_FAILED` 在后端的请求里被说明'出自设计决定，要由另一个请求写进契约'（清单第 4 节第 7 条）；清单里没有看到那个请求，所以这里一并列出。
- "凡是能确定账号的告警，同时填 `accountId` 列，账号删除时按它清除"这一句（第 2326 行末尾）对 `SUPPORT_FORWARD_FAILED` 适用（`accountId` 是反馈所属账号）；对另外三种，`accountId` 为空（`SUBSCRIPTION_EVENT_FAILED` 清单没有给出）。

### 1.3 `GET /alerts` 的参数校验（2026-10-31 的追加）

- **现在：** 17.4 系统监控行写 `GET /alerts?status=&type=`。
- **改成：** 补："`status` 只能是 `OPEN` 或 `RESOLVED`，`type` 只能是上面十八种之一，否则 400 `INVALID_REQUEST`；不带参数表示全部，空字符串是一个取值（对 `status`、`type` 都是 400）。"
- **检查顺序：** 清单没有给出。 **错误：** 400 `INVALID_REQUEST`，`details` 的 `ref` 是参数名（清单没有明写 `ref`，按其他参数错误的惯例；请后端确认）。
- **测试：** `status=open`、`status=`（空）、`type=UNKNOWN`、`type=`（空）各得 400；不带参数得全部；十八种类型各能作为 `type` 过滤。

### 1.4 "重试"与告警的联动（17.4 客服行）

- **补：** 17.4 客服行的 `POST /support/feedback/{id}/retry` 写明：重试把 `FAILED` 的反馈置回 `PENDING` 的同一事务里，该反馈上打开的 `SUPPORT_FORWARD_FAILED` 告警自动 `RESOLVED`；重试没有改变任何东西（反馈不存在、反馈不是 `FAILED`）时告警保持打开。
- **测试：** 对 `FAILED` 反馈重试 → 告警 `RESOLVED`；对不存在的反馈、非 `FAILED` 的反馈重试 → 告警仍 `OPEN`；重试后又失败 → 一条新的 `OPEN`。

---

## 二、17.5 运营可调参数表（第 2404 行起）：补 25 个键，改 3 个键的范围

后端的 `GET /api/admin/config` 已经返回下面所有键（它遍历后端登记的全部键，登记表与'契约表加额外键'相等），管理员可编辑。对契约原文逐个 `grep`，这 25 个键都是 0 次。每个键的编辑权限在表里；除非另写，类型和取值范围见"说明"。默认值只是代码里的常量。

### 2.1 更早的 7 个额外键（不是第一批新增）

| key | 默认值 | 出处 | 编辑权限 | 说明 |
|---|---|---|---|---|
| `push.task_poll_seconds` | 15 | 清单没有给出章节 | `PUSH:CONFIG` | 整数，最小 1。与 `push.schedule_catchup_minutes` 有保存规则，见 2.4 |
| `memory.call_timeout_seconds` | 10 | 清单没有给出章节 | `CONFIG:MANAGE` | 整数，最小 1 |
| `attribution.postback_enabled` | false | 清单没有给出章节 | `ATTRIBUTION:MANAGE` | 布尔 |
| `attribution.facebook_graph_version` | `v26.0` | 清单没有给出章节 | `ATTRIBUTION:MANAGE` | 字符串，必须匹配 `^v[0-9]{2}\.[0-9]$` |
| `ratelimit.events_per_ip_per_minute` | 600 | 清单没有给出章节 | `CONFIG:MANAGE` | 整数，最小 1 |
| `chat.moderation_concurrency` | 16 | 清单没有给出章节 | `CONFIG:MANAGE` | 整数 1 到 32；批次内部并发 |
| `chat.moderation_deadline_ms` | 2000 | 清单没有给出章节 | `CONFIG:MANAGE` | 整数 **100 到 2500**（2026-10-31 起；以前是 100 到 2900，请求 `w5b-ranges-and-account-memory.md` 第 2 节） |

### 2.2 第一批交付新增的键（d1–d9，2026-10-29）

编辑权限都是 `CONFIG:MANAGE`，类型都是整数。

| key | 默认值 | 取值范围 | 来源请求 | 说明（运营能观察到的） |
|---|---|---|---|---|
| `chat.moderation_global_concurrency` | 64 | 1 到 512 | item-14 | 每个应用实例（app、worker 各自计数）同时在途的内容审核服务调用上限，所有调用方合计；等空位的时间计入该次调用自己的期限（`moderation.call_timeout_seconds`；聊天批次还有 `chat.moderation_deadline_ms`），超时按审核服务超时处理（该内容进复核）。批次内部的 `chat.moderation_concurrency` 不变。改动在下一次等待时生效。是每个实例各自的上限，不是整个集群共用 |
| `export.parallelism` | 3 | 1 到 4（每个导出任务可能占两个数据库连接） | item-23 | 后台数据导出同时组装的任务数上限；每轮导出开始时读取，保存后从下一轮生效 |
| `ratelimit.apk_download_per_ip_per_min` | 30 | 最小 1，无上限 | item-05 | APK 下载（`GET /download/{uploadId}.apk`）每个 IP 每分钟次数；`GET`、`HEAD`、带 `Range` 的请求各算一次；超出答 429 |
| `ratelimit.push_image_per_ip_per_min` | 120 | 最小 1，无上限 | item-05 | 推送图片（`GET /public/push-images/{uploadId}`）每个 IP 每分钟次数 |
| `ratelimit.ad_media_per_ip_per_min` | 120 | 最小 1，无上限 | item-05 | 广告素材及缩略图（`GET /public/ads/media/{uploadId}` 与 `…/thumbnail`）每个 IP 每分钟次数，两个路径共用一个计数器 |
| `analytics.funnel_max_concurrency` | 2 | 1 到 32 | item-22 | 一个 admin 实例同时计算的漏斗个数上限（每次计算最多读 20 万条事件，约 100 MB）；超出时漏斗请求答 429 `RATE_LIMITED`（无 `data`、无 `Retry-After`）；每次漏斗请求都读取，保存后下一次请求生效；按实例计数 |
| `integrity.app_attest_max_keys_per_device` | 3 | 最小 1，无上限 | item-18 | 同一个 `deviceId` 30 天内最多认证几个 iOS 设备校验密钥；再多一个，手机端得到 403 `DEVICE_INTEGRITY_FAILED`；重装、从备份恢复、换机时会生成新密钥；手机端没收到响应时的原样重发不计入 |
| `ratelimit.app_attest_challenge_per_ip_per_hour` | 60 | 最小 1，无上限 | item-18 | `POST /api/integrity/app-attest/challenge` 每个 IP 每小时次数；默认是游客每 IP 限额的 3 倍 |
| `ratelimit.app_attest_key_per_ip_per_hour` | 20 | 最小 1，无上限 | item-18 | `POST /api/integrity/app-attest/keys` 每个 IP 每小时次数；默认同 `ratelimit.guest_per_ip_per_hour` |

### 2.3 2026-10-30 新增的键（d10–d18）

| key | 默认值 | 取值范围 | 编辑权限 | 来源请求 | 说明 |
|---|---|---|---|---|---|
| `integrity.app_attest_unsupported_allowed` | true | 布尔 | `CONFIG:MANAGE` | item-18 | 开：不能使用设备校验的 iPhone（手机端读到 `isSupported` 为 false，`integrityToken` 传 `unsupported`）可以创建游客凭据和新账号，作为未经认证的 iOS 设备；已经认证过密钥的 `deviceId`、以及游客记录是 Android 的 `deviceId` 不能这样做；原有的按 IP、按设备限流照常。关：这些 iPhone 得到 403 `DEVICE_INTEGRITY_FAILED`。每次校验时读取。Android 不受影响 |
| `events.store_client_ip` | true | 布尔 | `CONFIG:MANAGE` | `ip-storage-switches.md` | 开：每条埋点事件存客户端 IP。关：新写入的事件不存 IP（`ip` 为空），国家仍照常由 IP 推出；已经存下的 IP 到事件过期（`events.ttl_days`）才消失。管理端埋点列表里 IP 一栏对这些事件显示为空。每次写入时读取 |
| `ads.store_client_ip` | true | 布尔 | `CONFIG:MANAGE` | `ip-storage-switches.md` | 开：每条广告展示记录存客户端 IP。关：新写入的展示记录不存 IP（预加载期限内保存的展示元数据也不再带 IP），国家、平台、渠道等照常；已存下的 IP 到记录过期（`ads.log_retention_days`）才消失。每次写入时读取 |
| `attribution.store_click_ip` | true | 布尔 | **`ATTRIBUTION:MANAGE`**（不是 `CONFIG:MANAGE`） | `ip-storage-switches.md` | 开：每条自建归因的点击记录存客户端 IP。关：新点击不存 IP，点击明细（`GET /attribution/clicks`）里这些点击的 IP 一栏为空；**自建归因里靠 IP 的指纹匹配对这些点击不再生效**（按点击编号的匹配不受影响），所以关掉后安装只能靠点击编号归因。已存下的点击保留 IP 到被清除（`attribution.click_retention_days` 加 `attribution.click_expired_keep_days`）。每次写入点击时读取 |
| `chat.message_retention_days` | 0 | 整数，0 或不小于 32，且大于 `stats.land_window_days`，否则保存时 400，`details` 里写出两个键 | `CONFIG:MANAGE` | `retention-settings.md` | 聊天消息和账号已结束的通话记录保留多少天。0 表示保留到账号删除。大于 0：每天一次的清理任务（03:30 UTC）删除早于该天数的消息和通话记录；开着或未结算的会话、待人工复核的消息、`PENDING` 的文字轮、账号订阅当前周期内的行不删。之后用户的聊天历史、数据导出里没有这些消息，后台的会话列表变短，待复核的已删消息在后台看不到内容；已落地的统计不变 |
| `voice.source_sample_retention_days` | 0 | 整数，最小 0 | `CONFIG:MANAGE` | `retention-settings.md` | 声音样本原文件（和任务上的转写）保留多少天，从音色创建起算。0 表示随音色的生命周期。大于 0：到期由每天一次的清理任务删除，音色本身继续可用；之后数据导出里没有该音色的原始 wav，音色在合成服务里丢失时无法用样本重建，待复核的被举报音色没有样本可听（有待复核记录的音色不删） |
| `guest.device_retention_days` | 0 | 整数，0 或不小于 91 加 `stats.land_window_days`，否则保存时 400 | `CONFIG:MANAGE` | `retention-settings.md` | 游客设备记录从最后一次出现起保留多少天。0 表示不删除。大于 0：到期由每天一次的清理任务删除（仍有未结束游客会话的设备不删）。**警告**：游客额度记在设备记录上，记录删除后该设备下次出现按新设备处理并重新发放额度，所以设得太短会让游客额度被绕过；已落地的统计不变 |
| `support.feedback_retention_days` | 0 | 整数，最小 0 | `CONFIG:MANAGE` | `retention-settings.md` | 客服反馈（含用户原文）保留多少天，从提交起算。0 表示保留到账号删除。大于 0：到期由每天一次的清理任务删除，不分转发状态（待转发、已转发、失败）；还没转发的被删后不会再转发；已经转发给第三方客服工具的副本在对方系统里，这里删不掉 |
| `moderation.record_retention_days` | 0 | 整数，最小 0 | **`MODERATION:CONFIG`**（不是 `CONFIG:MANAGE`） | `retention-settings.md` | 审核记录保留多少天，从创建起算。0 表示不删除。大于 0：到期由每天一次的清理任务删除，状态为待复核（`PENDING_REVIEW`）的永远不删。之后审核统计里被删日期的数字变小（统计是读记录实时算的），已删的记录在后台打不开 |

- 加上 2.1 的 7 个和 2.2 的 9 个，共 25 个。这 25 个键里编辑权限为 `CONFIG:MANAGE` 的 20 个、`PUSH:CONFIG` 1 个、`ATTRIBUTION:MANAGE` 3 个（`attribution.postback_enabled`、`attribution.facebook_graph_version`、`attribution.store_click_ip`）、`MODERATION:CONFIG` 1 个。改契约时 17.5 表的总行数、各权限码的键数（管理端前端计划里'224 个键里 160 个 `CONFIG:MANAGE`，其余分属 10 个码'的数字）要同步改。
- 表里'章节'列：清单没有给出这些键的契约章节号，由改契约的人按键所属的功能填。
- 关系校验的保存错误（`chat.message_retention_days`、`guest.device_retention_days` 与 `stats.land_window_days`，同 `events.ttl_days` 的做法）：400 `INVALID_REQUEST`，`details` 写出两个键，`reason` 是 `OUT_OF_RANGE`。

### 2.4 已在表里、范围变化的键（GROUP B，2026-10-31）

| key | 现在的取值范围 | 改成 | 来源请求 |
|---|---|---|---|
| `recall.window_minutes`（默认 60） | 整数，没有上限 | 整数 1 到 1440 | `w5b-ranges-and-account-memory.md` 第 3 节 |
| `recall.scan_interval_minutes`（默认 10） | 整数，没有上限 | 整数 1 到 1440 | 同上 |
| `push.schedule_catchup_minutes`（默认 60） | 整数，最小 1 | 整数 1 到 10080，并加保存规则：`push.schedule_catchup_minutes × 60 ≥ 600 + push.task_poll_seconds`，保存或恢复默认任一个键时检查；违反时 400 `INVALID_REQUEST`，`details` 先写保存的键、再写另一个键，两个 `reason` 都是 `OUT_OF_RANGE` | 同上第 4 节 |

- 在这些范围收紧之前保存的值继续有效，直到该键再被保存（这一句也要写进 17.5 开头的取值校验一段）。
- 默认值下催补分钟数至少是 11（`⌈(600 + 15) ÷ 60⌉ = 11`）。
- **测试：** `recall.window_minutes=1441` → 400；`push.schedule_catchup_minutes=10081` → 400；`push.schedule_catchup_minutes=10`（默认轮询 15 秒）→ 400 且 `details[0].ref` 是 `push.schedule_catchup_minutes`；保存 `push.task_poll_seconds=61`（催补 10 分钟时）→ 400 且 `details[0].ref` 是 `push.task_poll_seconds`；`DELETE` 任一键同样检查；`chat.moderation_deadline_ms=2501` → 400，2500 通过。

### 2.5 17.5 开头的取值校验一段：补保存失败的新 `data` 字段

17.5 开头已经说明'整数键不小于 1、关系约束'；请补上后端 2026-10-29 起新增的保存错误形状（管理端前端的设置页靠它们显示，不再读 `message`）：

| 键 | 条件 | 状态与码 | `data` |
|---|---|---|---|
| `app.supported_locales` | 列表里任一语言没有随版本发布的通知模板文件（语言标签与文件名比较不区分大小写，整个标签要匹配；现在随版本发布的文件只有 `en`） | 400 `INVALID_REQUEST` | `details` 为 `[{"ref":"app.supported_locales","reason":"OUT_OF_RANGE"}]`，另有 `missingLanguages`（没有文件的语言标签数组，按请求里的顺序）；`DELETE`（回到 `["en"]`）永远通过；因召回模板被拒的 `data.missingRecallTemplates` 不再存在 |
| `push.default_locale` | 某个有启用模板的召回原因没有新语言的启用模板 | 400 `INVALID_REQUEST` | `details` 为 `[{"ref":"push.default_locale","reason":"OUT_OF_RANGE"}]`，另有 `defaultLocale`（要保存的语言）和 `reasons`（缺它的召回原因数组，字母序） |
| `auth.phone_login_enabled` | 设为 `true` 而缺'启用的、`smsType=OTP`、语言 `en`（不区分大小写）、国家为空'的短信模板 | 400 `INVALID_REQUEST` | `details` 为 `[{"ref":"SmsTemplate","reason":"EMPTY_NOT_ALLOWED"}]`（`ref` 是固定词，不是设置键） |
| `usage_price.default_currency`、`usage_price.allowed_currencies` | 默认币种不在允许列表里（区分大小写；`DELETE` 这两个键之一按代码默认值判断） | 400 `INVALID_REQUEST` | `details` 同时列两个键，保存的键在前，`reason` 都是 `OUT_OF_RANGE` |
| `attribution.cost_currency` | 改成与当前有效值不同的币种（含 `DELETE` 回 `USD` 而当前不是 `USD`），且 `AttributionCost` 里有任何一行成本 | 400 `INVALID_REQUEST` | `details` 为 `[{"ref":"attribution.cost_currency","reason":"OUT_OF_RANGE"}]`；保存相同的值永远通过 |

- 这些错误的 `message` 英文句子不写进契约（管理端界面不显示它）。
- **检查顺序：** 清单没有给出各键保存规则的内部顺序。
- **测试：** 每行一例，包括 `data` 字段的内容和顺序。

### 2.6 预告：`moderation.model_check_enabled`（不在本次请求里）

清单第 3 节第 1 条：布尔，默认 `true`，编辑权限 `MODERATION:CONFIG`，契约章节 11.2，随后端的请求 `moderation-switch.md` 一起进入 17.5。后端还没做（等负责人说开始），这里只提醒：它进入 17.5 时，管理端前端的额外键清单要再加一个。

---

## 三、17.4 其他行的变化（供改契约的人对照；每一项的完整请求在后端的请求文件里）

这些变化改的是已有路由的字段、参数、错误，清单第 2 节 (a) 逐行给了来源。管理端前端设计文档里的对应修改见 `docs/contract-requests/2026-10-31-design-doc-changes-from-backend-d1.md`；契约 17.4 的对应行是否已经由后端的请求改过，我们无法核实，请改契约的人对照后端的请求文件确认。

| 17.4 行 | 变化 | 清单行 |
|---|---|---|
| 系统管理（角色、管理员） | 操作者只能授出、操作自己持有的权限；违反时 403 `ADMIN_FORBIDDEN`，`data` 为 `null` | a1 |
| 登录、绑定认证器 | 库里二次验证密钥解不开：登录 401 `ADMIN_TOTP_INVALID`（以前 500），绑定 401 `ADMIN_INVALID_TOKEN` 且 `enrollToken` 作废 | a2、a3 |
| 推送管理（模板） | 召回模板规则重新设计，错误 `data` 为 `{defaultLocale, reason}`；`GET /push/templates` 多 `missingLocales` | a5、a14、e1 |
| 推送管理（手动任务） | 停机后已开始但没发出任何一条的任务显示 `CANCELLED`、`note=MISSED` | GROUP A |
| 短信管理（模板、渠道） | 至少一个启用的英文不限国家验证码模板；渠道 `credentials` 值必须是非空字符串 | a6、e2、W2a |
| 通话 | 详情多 `maxDurationMinutes` | a7 |
| 成本（价格确认） | 确认时批次的币种必须在 `usage_price.allowed_currencies` 里 | a8 |
| 投放管理 | 成本币种锁；效果接口的范围错误形状；回传凭证告警的自动关闭 | a9、b2、GROUP B |
| 埋点管理（漏斗） | 并发上限，超出 429 `RATE_LIMITED` 无 `data` 无 `Retry-After` | a10 |
| 投诉 | 列表加 `status` 参数，取值多 `OPEN` | a11 |
| 订阅管理（统计） | Google 行 `listPriceAmount`、`listPriceCurrency` 有值 | a12 |
| 内容审核（文本规则） | `SUBSTRING`、`WORD` 做形近字折叠，`REGEX` 不折叠 | a13 |
| 邮件模板 | 第六个模板 `LOGIN_METHOD_ADDED` | c1 |
| 用户管理（封禁） | 封禁时没能立即结束的通话由后台扫描以 `BANNED` 结束 | GROUP A |
| 记忆服务 | `GET /accounts/{id}/memory` 多 `truncated`、`totalCount` | GROUP B |
| 系统管理（权限树、审计日志） | 节点类型不能改；筛选长度上限 64/64/255 | W2a |
| 系统监控（告警） | 本文第一节 | b1、b2、GROUP A、W2a |

清单还列了与管理端前端无关的后端变化（手机端接口、运维日志等），不在这里。GROUP B 里'手机端普通 403 页面现在是 403 `FORBIDDEN`（以前是 400 `INVALID_REQUEST`）'属于客户端接口，不影响管理端前端。

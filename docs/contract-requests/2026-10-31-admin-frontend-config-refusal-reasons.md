# 给后端：系统配置页保存被拒时，前端需要结构化的原因（开启手机号登录、图 API 版本的原因码、成对的键）

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端的系统配置页（`ConfigForm`/`ConfigRow`），后端第一批交付清单 `docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 的 a4、a6、a8、a9、d14、d16 和 2026-10-31 追加的 GROUP B。
> **背景：** 负责人定的规则是：错误码已知时，界面只显示按码翻译的文字，不附后端的英文 `message`。所以凡是靠 `message` 里的细节才讲得清的情形，前端要后端给结构化字段。下面每一条都说明前端现在怎么做（按最小做法继续），以及希望后端补什么。

## 一、开启手机号登录被拒：缺的是哪一项（后端已答复，不需要结构化字段）

- **接口：** `PUT /config/auth.phone_login_enabled`，`value` 为 `true`。
- **后端的答复（2026-11-02，第 42 条）：** 400 的 `data.details` 已经是一项缺失一条，按顺序最多四条，`reason` 都是 `EMPTY_NOT_ALLOWED`：`sms.allowed_country_codes`（没设或为空）、`sms.daily_global_cap`（没设）、`SmsChannel`（没有启用的验证码渠道）、`SmsTemplate`（没有启用、验证码类型、语言 en、不限国家的模板）。后端建议不加 `missing` 数组（重复信息）。
- **前端现在做的：** 逐条按 `ref` 显示。`sms.allowed_country_codes`、`sms.daily_global_cap` 是设置键，表单里有这两行时写在对应的行上，没有时写在表单顶部；`SmsChannel`、`SmsTemplate` 各一句固定文字，写在表单顶部。不再固定写一句最常见的缺项，也不解析 `message`。
- **不再需要后端做什么。**

## 二、`attribution.facebook_graph_version` 格式不对时的原因码

- **接口：** `PUT /config/attribution.facebook_graph_version`。
- **现状：** 清单只写了"必须匹配 `^v[0-9]{2}\.[0-9]$`"，没有写不匹配时 `details[].reason` 是哪个码。
- **前端现在做的：** 提交前自己检查这个格式，不匹配时按 `OUT_OF_RANGE` 显示（"超出允许的范围"），假后端也返回 `OUT_OF_RANGE`。这是猜的，不是契约。
- **希望：** 后端写明这个情形的 `reason`（若是 `OUT_OF_RANGE` 就保持；若另有码，告诉前端，前端加按码文字）。

## 三、成对的键：`details` 是否总是把另一个键也列出来

- 清单明确写了会把两个键都列出来（保存的键在前）的有：a8（`usage_price.default_currency`、`usage_price.allowed_currencies`）、GROUP B（`push.schedule_catchup_minutes`、`push.task_poll_seconds`）、d14/d16（与 `stats.land_window_days`），以及 `events.ttl_days` 与 `stats.land_window_days`（清单 d 节"同 events.ttl_days 的做法"）。
- 前端对所有 `ref` 是设置键的 `details` 条目，都在对应的行下显示这一条拒绝的文字，所以成对的两行都会显示。
- 契约 17.5 里其他成对的规则（`retry.initial_seconds`/`retry.max_seconds`、`moderation.review_score`/`moderation.block_score`、`generation.voice_min_seconds`/`generation.voice_max_seconds`、`export.lease_minutes`/`export.job_timeout_minutes`、`auth.access_ttl_minutes`/`auth.refresh_ttl_days`）没有写 `details` 是否也列两个键。
- **希望：** 后端确认这几对是否同样列两个键（保存的键在前）；前端两种形状都能处理，只列一个键时另一行没有文字。

## 四、保存 `app.supported_locales` 被拒

- 前端只在 `details` 里有 `ref` 为 `app.supported_locales`、`reason` 为 `OUT_OF_RANGE` 时说"每种语言都要有随版本发布的通知模板文件，列表里必须保留 en"，有 `data.missingLanguages` 时再补一句"没有模板文件的语言：…"。页面不依赖这个字段。
- **希望：** 同一个 `ref` 和 `reason` 如果后端还用在别的情形（例如列表缺 `en`、有重复项），请告诉前端，前端会加按情形区分的文字；这两种情形前端在提交前已经自己拦住。

核对于 2026-11-01

33 个变更请求文件（32 个功能项文件 + `admin-frontend-design-item-03.md`）：22 个改变管理端前端能看到或要处理的东西（21 个功能项文件 + `admin-frontend-design-item-03.md`），11 个不改变。

# 第一批交付（delivery 1）给管理端前端的改动清单

日期 2026-10-29。写给：AvatarAdmin 项目的会话，和改 `admin-frontend-design.md` 的人（在 AvatarApp 的 main 上）。后端代码在 AvatarBackend 分支 `backend-changes`（合并提交 `89370b6`，已是当前 `backend-implementation` 的祖先）。

来源约定：`item-NN.md` 和 `admin-frontend-design-item-03.md` 指 `D:\Projects\PycharmProjects\AvatarBackend\.superpowers\sdd\2026-10-21-avatar-backend\contract-requests\` 下的文件，后面的数字是我读到的行号；`FINAL-REPORT-D1.md` 在上一层目录；"设计文档"指 `AvatarApp\docs\admin-frontend-design.md`（行号是 AvatarApp main 上的行号，AvatarAdmin 里的快照 `docs/shared-snapshots/admin-frontend-design.md` 与它逐字节相同，我用 `diff` 核对过）；"契约"指 `AvatarApp\docs\backend-task-java-backend.md`（同样与快照相同）；"计划"指 AvatarAdmin 的 `docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`。表里说的"第 N 节"是设计文档的节号。

## 1. 不改变管理端的 11 个请求（先排除，免得重复读）

| 请求（用普通话说它是什么，括号里是文件） | 为什么管理端不受影响 | 来源 |
|---|---|---|
| 苹果和谷歌登录的一次性 nonce（`item-02.md`） | 只涉及手机端的 `/api/auth/google`、`/api/auth/apple` 和用户自己的删除账号、导出的重新验证 | item-02.md 第 9–23、45–55 行 |
| 其余八个服务间签名密钥至少 32 字节（`item-04.md`） | 启动检查，没有错误码、响应、设置的变化 | item-04.md 第 15–20 行 |
| 公开文件路由的安全响应头（`item-06.md`） | 响应头对前端没有可见作用；唯一相关的是部署：前端部署文档里的反向代理示例不要再给 `/api/` 加这六个头（后端运维手册第 5 节要求代理不加第二个值），计划第 894 行要求写 `docs/deploy.md` | item-06.md 第 7–16 行；计划第 894 行 |
| 苹果退款先于购买行到达的处理（`item-13.md`） | 只影响手机端的购买验证和退款表 | item-13.md 第 7–10、30–47 行 |
| 共用的 Redis 断路器（`item-15.md`） | 只改变 Redis 故障时请求的耗时，路由的答案不变 | item-15.md 第 11–17 行 |
| 失败日志按来源限速（`item-16.md`） | 只改变运维日志 | item-16.md 第 11–16 行 |
| 导出压缩包删除失败时由清扫删除（`item-24.md`） | 不改契约，不改接口 | item-24.md 第 1–5 行 |
| 改密码时作废未使用的重置令牌（`item-26.md`） | 用户端的 `password/change`、`password/reset` | item-26.md 第 11–33 行 |
| 文字对话续轮次锁时 Redis 出错记 `REDIS_ERROR`（`item-28.md`） | 只是事件 `text_turn_failed` 的 `reason` 多一个取值；管理端事件明细把 `params` 显示成格式化的 JSON（设计文档第 258 行），没有按取值列举的界面 | item-28.md 第 7–9 行；设计文档第 258 行 |
| 目录、动作、商品的按端可见规则统一（`item-31.md`） | 变化的是手机端请求的过滤结果；管理端目录页的字段和"不选任何一项表示所有端"不变 | item-31.md 第 5–22 行；设计文档第 439 行 |
| 数据导出带上待审核的人设（`item-32.md`） | 是用户自己下载的导出文件，不是管理端页面 | item-32.md 第 5–9 行 |

## 2. 改变管理端的 22 个请求，逐行

"管理端页面"一栏用设计文档的名字和节号。"AvatarAdmin 现状"一律是：本地 `main` 只做完计划的任务 1（脚手架）和登录页，下面所有页面都还没有代码（见第 4 节第 1 条），所以每行是"要写进计划和代码的"，不是"要改已有代码"。

22 个请求和下面的行的对应（请求用普通话说，括号里是文件）：管理员只能授出自己持有的权限（item-01）→ a1；第六个邮件模板（item-03 的邮件部分，加 admin-frontend-design-item-03）→ c1；公开文件路由限流的三个设置键（item-05）→ d3 到 d5；加密值绑定到所在行（item-07）和上一把加密密钥（item-08）→ a2、a3；保存语言列表要有模板文件（item-09）→ a4、e3；召回模板覆盖规则（item-10）→ a5、e1；英文验证码短信模板规则（item-11）→ a6、e2；通话截止时间的上限记录（item-12）→ a7；审核供应商调用的全局并发上限（item-14）→ d1；默认币种必须在允许币种里（item-17）→ a8、e5；iOS 设备校验的三个设置键（item-18）→ d7 到 d9；管理员权限变更立即生效（item-19）→ e6；投放成本币种锁（item-20）→ a9、e4；投放回传凭证告警（item-21）→ b2；漏斗并发上限（item-22）→ a10、d6；导出并行度设置键（item-23）→ d2；投诉列表状态筛选（item-25）→ a11；订阅统计里的谷歌标价（item-27）→ a12；屏蔽词形近字折叠（item-29）→ a13；客服转发告警（item-30）→ b1。

### (a) 已有路由上新增或改变的字段、参数、错误

| 行 | 管理端用户看到什么 / 前端要处理什么（精确名字） | 管理端页面 | 来源 |
|---|---|---|---|
| a1 | **管理员只能授出自己持有的权限（`item-01.md`）。** 以下操作违反规则时返回 403 `ADMIN_FORBIDDEN`，`data` 为 `null`，什么都不改：① `POST /roles`：`permissionCodes` 里有操作者没有的码；② `PUT /roles/{id}`：操作者不能改自己被分配的角色，角色原有的码和请求里的 `permissionCodes` 都必须是操作者持有的；`DELETE /roles/{id}`：角色原有的码必须是操作者持有的；③ `POST /admins`、`PUT /admins/{id}`：`roleIds` 里各角色的码合起来必须是操作者持有的；④ `PUT /admins/{id}`、`POST /admins/{id}/status`、`POST /admins/{id}/reset-password`、`POST /admins/{id}/reset-totp`、`DELETE /admins/{id}`：目标管理员当前持有的码必须是操作者持有的。`superAdmin=true` 的操作者不受这四条限制。"持有"指操作者各角色权限码的并集，后端保存时从数据库读。四条英文消息（只供参考，原样展示即可）："Administrators can only grant permissions they hold"、"Administrators cannot change a role they hold"、"Administrators can only change roles whose permissions they hold"、"Administrators can only act on administrators whose permissions they hold"。每个路由的检查顺序见来源（第一个不通过的先答）；前端不需要复刻顺序，只需要在 403 时展示后端 `message`，并且 403 不跳转（设计文档第 26 行已定）。 | 5.16 系统管理：管理员（`/system/admins`）、角色（`/system/roles`）；3.4 权限判断 | item-01.md 第 17、19–29、33 行 |
| a2 | **管理员登录时，库里存的二次验证密钥解不开，现在答 401 `ADMIN_TOTP_INVALID`（以前是 500 `INTERNAL_ERROR`）。** 这次尝试和输错验证码一样计入二次验证的锁定次数。原因包括：换了 `ADMIN_TOTP_ENC_KEY` 又没配上一把、数据损坏、密文被复制到另一个管理员行上。恢复办法：能登录的超级管理员重置该管理员的二次验证（`POST /admins/{id}/reset-totp`）。（`item-07.md`、`item-08.md`） | 3.1 登录与二次验证；5.16 管理员的"重置二次验证" | item-08.md 第 7、33、60 行；item-07.md 第 11 行 |
| a3 | **绑定认证器时，待确认的密钥解不开，`POST /api/admin/auth/totp/enroll` 答 401 `ADMIN_INVALID_TOKEN`，并且这个 `enrollToken` 作废。** 前端按设计文档第 73 行的做法回登录页重来；注意它和"登录页的 401 `ADMIN_INVALID_TOKEN` 跳登录"是同一个码，不会被当成别的错误。（`item-07.md`、`item-08.md`） | 3.2 绑定认证器页 `/user/enroll` | item-08.md 第 33、60 行；item-07.md 第 12 行 |
| a4 | **保存语言列表被拒（`item-09.md`）。** `PUT /config/app.supported_locales`：列表里任一语言没有通知模板文件时，400 `INVALID_REQUEST`，`message` 为 `app.supported_locales has languages without a notification template file: <语言，逗号分隔>`，`data.details` 为 `[{"ref":"app.supported_locales","reason":"OUT_OF_RANGE"}]`，另有新字段 `data.missingLanguages`（没有文件的语言标签数组，按请求里的顺序）。语言标签与文件名比较不区分大小写，整个标签要匹配（`pt` 不能用 `pt-BR` 的文件）。现在随版本发布的文件只有 `en`，所以加任何其他语言都会被拒，直到该语言的文件随版本发布。`DELETE /config/app.supported_locales`（回到 `["en"]`）永远通过。 | 5.15 系统配置（行 `app.supported_locales`）；影响 5.11 推送模板的"触发原因 × 语言"矩阵（语言列取自这个键） | item-09.md 第 13、29–33 行 |
| a5 | **召回模板写入被拒的错误形状（`item-10.md`，规则见 e1；这条规则已在 2026-10-29 重新设计并实现）。** `POST /push/templates`（`enabled=true` 时）、`PUT /push/templates/{id}`、`DELETE /push/templates/{id}`：违反规则时 400 `INVALID_REQUEST`，什么都不写，`data` 为 `{"defaultLocale":"<默认语言>","reason":"<触发原因>"}`（以前的 `data.missingLocales` 不存在了）。`message` 有三种，都写明怎么做：① 该原因有别的语言启用、却没有启用的默认语言模板（新建、启用、编辑造成）："<reason> needs an enabled template in <lang> (the default language) while other languages are enabled; enable or restore it first"；② 操作会把默认语言模板从其他启用的语言身边拿走（停用、删除、改语言、改原因）："<reason> needs an enabled template in <lang> (the default language) while other languages are enabled; disable the other languages of <reason> first, or keep the <lang> template enabled"（此时同一原因下还有别的语言启用）；③ 该原因唯一启用的模板就是默认语言那条，却被改成别的语言（此时没有别的语言启用）："<reason> would have no enabled template in <lang>, the default language: keep this template in <lang> and enabled, and create the other language as a new template"。保存 `push.default_locale`（`PUT/DELETE /config/push.default_locale`）时，某个有启用模板的召回原因没有新语言的启用模板：400 `INVALID_REQUEST`，`message` 为 "push.default_locale cannot be <lang>: these recall reasons have enabled templates but none in <lang>: <reason>, <reason>; enable the <lang> template of each of them first"，`data.details` 为 `[{"ref":"push.default_locale","reason":"OUT_OF_RANGE"}]`，另有 `data.defaultLocale`（要保存的语言）和 `data.reasons`（缺它的召回原因数组，字母序）。保存 `app.supported_locales` 不再因为召回模板被拒绝：`data.missingRecallTemplates` 不存在了，只剩 a4 的 `data.missingLanguages`。 | 5.11 推送 → 模板（`/push/templates`）；5.15（`push.default_locale`） | item-10.md 第 69–81 行 |
| a6 | **短信模板写入、开启手机号登录被拒的新情形（`item-11.md`）。** 在管理端创建/修改/启用/停用/删除短信模板，把"启用、`smsType=OTP`、`locale` 等于 `en`（不区分大小写）、`country` 为空"的最后一个模板拿掉：400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"SmsTemplate","reason":"OUT_OF_RANGE"}]`，`message` 为 "The last enabled OTP template in language en for every country (no country set) cannot be removed or changed while phone login is on or phone accounts exist"（"手机号登录开着，或存在手机号账号"时才判）。`PUT /config/auth.phone_login_enabled` 设为 `true` 时缺这个模板：`data.details` 里是 `{"ref":"SmsTemplate","reason":"EMPTY_NOT_ALLOWED"}`（这一项以前就是这个形状），`message` 逐项写出缺的内容，缺英文不限国家模板时写 "an enabled OTP SMS template in language en for every country (no country set)"。**注意：这两处 `details[].ref` 是 `SmsTemplate`，不是设置键**，而计划任务 10 写的是"`details` 按 `ref` 对到该行"；`ref` 对不到任何行时，前端要把 `message` 显示在该行/该表单上，不能丢。规则本身见 e2。 | 5.18 短信管理 → 模板（`/sms/templates`）；5.15（`auth.phone_login_enabled`） | item-11.md 第 25、37–40 行；计划第 469 行 |
| a7 | **通话详情多一个字段 `maxDurationMinutes`（`item-12.md`）。** `GET /api/admin/sessions/{id}` 返回整数（分钟，不小于 0，不为空）：发起这次通话时记下的 `session.max_duration_minutes`；之后管理员改设置不影响已发起的通话。会话列表 `GET /sessions` 的九列不变。用来解释"为什么这次通话的截止时间和现在的设置不一样"。 | 5.5 通话 → 会话列表 `/sessions/list` 的详情（计划任务 19 用抽屉） | item-12.md 第 9 行；契约第 2301 行 |
| a8 | **默认币种必须在允许币种里（`item-17.md`）。** ① `PUT /api/admin/config/usage_price.default_currency` 或 `usage_price.allowed_currencies` 违反"默认币种 ∈ 允许列表"：400 `INVALID_REQUEST`，`message` 为 "usage_price.allowed_currencies must contain usage_price.default_currency"，`data.details` 同时列两个键：`[{ref:<保存的键>, reason:OUT_OF_RANGE},{ref:<另一个键>, reason:OUT_OF_RANGE}]`（保存的键在前；item-17.md 第 22 行把字段写成 `key`，后端代码 `ConfigValidator.java`（`89370b6`）第 26、116–123 行是 `ref`，与其他校验错误一样，前端按 `ref` 对到行，同一个错误会同时出现在两个键的行下）；`DELETE` 这两个键之一按代码默认值判断；比较区分大小写。② `POST /api/admin/usage/price-batches/{batchId}/confirm`：无论请求体有没有 `currency`，批次最终用的币种（请求体给的，没给就是批次自己的）都必须在 `usage_price.allowed_currencies` 里，否则 400 `INVALID_REQUEST`，`message` 为 "currency must be one of usage_price.allowed_currencies"，批次保持 `PENDING_REVIEW`，审计日志也不写。检查顺序：批次存在 404 → 生效日期合法 400 → 币种 400 → LLM 档位规则 400 → 条件更新 `PENDING_REVIEW → ACTIVE`（409 `INVALID_STATE`）。运营在请求体里给出允许列表内的 `currency` 即可确认。 | 5.15（两个键）；5.23 成本 → 价格 → 待审价格（`/cost/prices`，确认） | item-17.md 第 17、21–22、32、35 行 |
| a9 | **投放成本币种锁（`item-20.md`）。** `PUT /api/admin/config/attribution.cost_currency` 改成与当前有效值不同的币种，或 `DELETE` 回默认值 `USD` 而当前不是 `USD`：只要 `AttributionCost` 里有任何一行成本，就 400 `INVALID_REQUEST`，`message` 为 `attribution.cost_currency cannot be changed from <当前> to <提议> because cost rows exist (one currency is used for all cost rows)`，`data.details` 为 `[{"ref":"attribution.cost_currency","reason":"OUT_OF_RANGE"}]`，什么都不存。保存与当前相同的值永远通过。要改币种：先逐行 `DELETE /attribution/costs/{id}` 删光成本，再改设置。规则的运营后果见 e4。 | 5.13 投放管理 → 归因参数（`/campaign/settings`）和投放成本页签；5.15 | item-20.md 第 7–11 行 |
| a10 | **漏斗请求有并发上限（`item-22.md`）。** `GET /api/admin/analytics/funnel`：参数合格但这个 admin 实例同时在算的漏斗已达 `analytics.funnel_max_concurrency`（默认 2）时，立刻答 429 `RATE_LIMITED`，不排队，**没有 `data`，没有 `Retry-After` 头**（所以没有倒计时可显示）。管理端应提示稍后再试（设计文档第 26 行已定 429 提示稍后重试）。检查顺序：`steps` → `windowHours` → `from`/`to` 与范围 → 并发上限（429）→ 计算（MongoDB 超时仍是 400 `INVALID_REQUEST`，原因 `TOO_SLOW`）；出错的计算会释放名额。保存的漏斗路由 `/analytics/funnels` 不受限。 | 5.6 埋点管理 → 漏斗分析（`/analytics/funnel`） | item-22.md 第 13、23、27、31 行 |
| a11 | **投诉列表新增查询参数 `status`（`item-25.md`）。** `GET /api/admin/likeness-complaints?status=…`：取值 `OPEN`（等于 `RECEIVED` 和 `INVESTIGATING` 两个状态，即未结案）或 `RECEIVED`、`INVESTIGATING`、`RESOLVED_REMOVED`、`RESOLVED_NOT_FOUND`、`REJECTED` 之一；不传或传空值不过滤；区分大小写，`open`、逗号分隔的多个值、带空白的值都是 400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"status","reason":"OUT_OF_RANGE"}]`。`total` 按同一个条件计数；排序仍是 `dueAt` 升序、同时间按 `id`；`page`、`pageSize` 的错误先于 `status` 检查。权限仍是 `COMPLAINT:VIEW`。设计文档第 451 行已写"列表筛选状态（五个值）"，新增的是 `OPEN` 这个"未结案"取值。 | 5.25 投诉 → 照片里的人投诉（`/complaints/likeness`） | item-25.md 第 13、27–29 行；设计文档第 451 行 |
| a12 | **订阅统计的 Google 行有了标价（`item-27.md`）。** `GET /api/admin/subscriptions/stats`（`FINANCE:VIEW`）：Google 行的 `listPriceAmount` 现在是当天该商品最后一条带价格的事件的 `recurringPrice`，十进制字符串（例如 `"24.99"`，去掉尾零），`listPriceCurrency` 是它的 `currencyCode`；当天没有任何事件带价格（例如预付计划没有 `autoRenewingPlan`，或事件是改动前处理的）时两个字段都是 `null`；苹果行不变；沙盒订阅仍不计入。以前 Google 行恒为 `null`。价格是字符串，不要经过浮点。 | 5.10 订阅与额度 → 订阅统计（`/subscriptions/stats`） | item-27.md 第 7、11 行；契约第 2311 行 |
| a13 | **文本规则页的匹配说明要改（`item-29.md`，接口不变）。** `SUBSTRING` 和 `WORD` 规则现在在规范化之后再做形近字折叠（用 Unicode 16.0.0 的 UTS #39 `confusables.txt` 裁出的 775 条；只折叠另一种文字的形近字，ASCII 和同一文字内的字母不折叠）：规则 "сука"（西里尔字母）同时命中 "сука" 和 "СУКА"；用形近字母（如西里尔 а、с、о，希腊 ο，土耳其语无点 ı 折叠成 i）替换拉丁字母的文本也会命中拉丁写法的规则。`REGEX` 规则不折叠，行为不变。保存规则时，`SUBSTRING`/`WORD` 的 `pattern` 规范化并折叠后去空白为空，也是 `EMPTY_NOT_ALLOWED`（以前对规范化后的文本就有这条检查，结果相同）。已知副作用（`FINAL-REPORT-D1.md` 第 4 节）：全大写俄语词 `КОТ` 会命中规则 `kot`，土耳其语规则 `sik` 会命中 "sık sık"。没有新字段、新错误码。设计文档第 281 行写的说明是"匹配前会做规范化（不分大小写，去掉零宽字符）"，需要补上"SUBSTRING 和 WORD 另外做形近字折叠，REGEX 不折叠"。 | 5.8 内容审核 → 文本规则（`/moderation/rules`，`MODERATION:CONFIG`） | item-29.md 第 15–22、30、34–35 行；设计文档第 281 行；FINAL-REPORT-D1.md 第 76 行 |
| a14 | **模板列表多一个字段 `data.missingLocales`（`item-10.md`）。** `GET /push/templates` 的响应从 `{"items":[…]}` 变成 `{"items":[…],"missingLocales":{"daily_recall":[…],"streak_at_risk":[…]}}`：两个召回原因各一个数组，列出 `app.supported_locales` 里还没有**启用**模板的语言，按 `app.supported_locales` 的顺序，全都有则为空数组；原因下没有任何启用模板时是整个语言清单；不受 `triggerReason`、`locale` 过滤影响（过滤只缩小 `items`）。它只是信息：管理端把"触发原因 × 语言"矩阵里这些格子标成"回退到默认语言"，不当错误，保存也不被拒绝。 | 5.11 推送 → 模板（`/push/templates`） | item-10.md 第 81 行 |

### (b) 新的告警类型

后端现在共有 17 种告警类型：契约 17.4 列的 14 种 + `POSTBACK_CREDENTIAL_FAILED` + `SUBSCRIPTION_EVENT_FAILED` + `SUPPORT_FORWARD_FAILED`（item-30.md 第 11、15 行：数据库约束列出十七个值，迁移 `V1044`）。设计文档第 342 行列了 14 种（同契约 17.4 的 14 种），计划任务 13 的 `ALERT_TYPES` 是同样的 14 种（计划第 529 行），并且有"未知类型显示原始类型字符串，不崩溃"的测试（计划第 532 行）。下面是第一批交付里新增或改变的两种。

| 行 | 管理端用户看到什么 / 前端要处理什么（精确名字） | 管理端页面 | 来源 |
|---|---|---|---|
| b1 | **客服反馈转发用尽次数的告警（`item-30.md`）：** `AdminAlert.type` = `SUPPORT_FORWARD_FAILED`；`refType` = `SUPPORT_FEEDBACK`，`refId` = `SupportFeedback.id`（UUID 文本）；`accountId` = 反馈所属账号（所以"关联账号"可以点进用户详情）；`detail` 固定为 `attempts_exhausted`（不含反馈正文，也不含转发器的错误文字，错误文字在反馈列表的 `lastError`）。触发：worker 的转发轮次把反馈置为 `FAILED`（次数达到 `retry.max_attempts`）的同一个事务里。同一个反馈同一时刻只有一条 `OPEN`。解决：管理员对这条反馈点"重试"（`POST /api/admin/support/feedback/{id}/retry`，反馈回到 `PENDING`）时，同一事务里自动 `RESOLVED`；重试后又失败会开一条新的；也可以手动 `POST /alerts/{id}/resolve` 关闭（对反馈没有副作用）。重试没有改变任何东西（id 不存在、反馈不是 `FAILED`）时告警保持打开。 | 5.14 客服、记忆服务、系统监控 → 告警（`/monitor/alerts`）和客服（`SUPPORT:MANAGE` 的"重试"） | item-30.md 第 7–11、17 行 |
| b2 | **投放回传凭证告警多了两个固定的 `detail`（`item-21.md`）：** 类型 `POSTBACK_CREDENTIAL_FAILED`（广告投放活动的转化回传凭证不能用）；`refType` = `ATTRIBUTION_CAMPAIGN`，`refId` = `AttributionCampaign.id`，`accountId` 为空，同一活动一条 `OPEN`。`detail` 取值：Meta 返回的错误码（可能为空），或新增的固定值 `token_unreadable`（存着的访问令牌用当前 `ATTRIBUTION_TOKEN_ENC_KEY` 解不开）、`pixel_id_malformed`（存着的像素 id 不符合 `^[A-Za-z0-9]{1,64}$`）。该活动停止回传，到期行按重试公式退避。自动 `RESOLVED`：管理员重新填写令牌或像素 id（`PUT /attribution/campaigns/{id}`）时，或该活动的回传发送成功时。一条已经因 Meta 拒绝而打开的告警保留第一次的 `detail`，后来的情形不会改它。这个类型目前既不在契约 17.4 的 14 种里（item-21.md 第 7 行说它出自设计决定，要由另一个请求写进契约），也不在设计文档和计划的类型表里。 | 5.14 告警（`/monitor/alerts`）；5.13 投放账户（编辑令牌/像素 id 会自动关闭） | item-21.md 第 7、11、15–17、23 行 |

### (c) 新的邮件模板

| 行 | 管理端用户看到什么 / 前端要处理什么（精确名字） | 管理端页面 | 来源 |
|---|---|---|---|
| c1 | **第六个邮件模板 `LOGIN_METHOD_ADDED`（登录方式已添加通知）。** 账号新增一种登录方式后发到账号邮箱：谷歌登录的自动绑定，或用户登录后自己添加谷歌登录（`POST /api/account/login-methods/google`）。只有英文。`GET /email/templates` 现在返回六项（顺序以后端返回为准，计划任务 28 写的是按 `templateCode` 升序）；`PUT /email/templates/LOGIN_METHOD_ADDED` 保存；`POST …/reset` 恢复默认。`placeholders`（后端返回的顺序）：`{method}`（登录方式名称，目前只有 `Google`）、`{time}`（添加时间，`yyyy-MM-dd HH:mm UTC`）、`{appName}`（取 `app.display_name`）；`requiredPlaceholders`：`{method}`、`{time}`（正文缺任一个，后端 400 `INVALID_REQUEST`，`message` 写明缺哪个；测试 `EmailTemplateAdminIT.theSixthTemplateCanBeSavedAndResetLikeTheOthers`）。页面上给它的中文用途说明："登录方式已添加通知（账号新增一种登录方式后发到账号邮箱：Google 自动绑定，或用户登录后自己添加 Google 登录）"。路由、权限（`EMAIL:TEMPLATE`）、菜单都不变。设计文档第 382 行和计划任务 28 里"五个模板"要改成六个；计划任务 28 已经规定占位符和必含项由后端的 `placeholders`、`requiredPlaceholders` 给，所以编辑页的校验不用写死这个模板，只需要用途说明文字和测试数据。后端默认英文标题 `A new sign-in method was added to your {appName} account`，默认正文由"恢复默认"从 `defaultSubject`、`defaultBody` 显示，前端不写死。 | 5.18a 邮件模板（`/email/templates`，`EMAIL:TEMPLATE`） | admin-frontend-design-item-03.md 第 18–33、45–47、58–65 行；item-03.md 第 45–49 行；计划第 822 行 |

### (d) 第一批交付新增的设置键（出现在 5.15 系统配置页，`GET /config` 会返回）

核对：`git diff fb617a2 89370b6 -- tools/extra-config-keys.toml` 新增的键正好是下面 d1–d9 这 9 个（`FINAL-REPORT-D1.md` 第 29 行：设置数 232 → 241，也是 +9）。9 个键的编辑权限都是 `CONFIG:MANAGE`，类型都是整数。2026-10-30 又新增 d10（布尔开关，`CONFIG:MANAGE`，App Attest 改动），下面"这些键"的处理同样适用于它。`GET /config` 返回它们：`ConfigAdminFacade.items`（admin 模块，`89370b6` 第 78–86 行）取 `ConfigService.items()`，后者遍历 `ConfigKeyTypes.all()`，该类的注释（第 38 行）写明它必须恰好等于 `ConfigKeys.ALL`（契约表加额外键）。

| 行 | 设置键 | 默认值 | 取值范围 | 编辑权限 | 管理端用户看到什么（普通话） | 来源 |
|---|---|---|---|---|---|---|
| d1 | `chat.moderation_global_concurrency` | 64 | 整数 1 到 512 | `CONFIG:MANAGE` | 每个应用实例（app、worker 各自计数）同时在途的内容审核服务调用上限，所有调用方合计；等空位的时间计入该次调用自己的期限（`moderation.call_timeout_seconds`；聊天批次还有 `chat.moderation_deadline_ms`），超时按审核服务超时处理（该内容进复核）。批次内部的 `chat.moderation_concurrency` 不变。改动在下一次等待时生效。是每个实例各自的上限，不是整个集群共用 | item-14.md 第 14、33–37 行；extra-config-keys.toml 第 71–80 行 |
| d2 | `export.parallelism` | 3 | 整数 1 到 4（每个导出任务可能占两个数据库连接） | `CONFIG:MANAGE` | 后台数据导出同时组装的任务数上限；每轮导出开始时读取，保存后从下一轮生效 | item-23.md 第 10–18 行；toml 第 93–102 行 |
| d3 | `ratelimit.apk_download_per_ip_per_min` | 30 | 整数，最小 1，无上限 | `CONFIG:MANAGE` | APK 下载（`GET /download/{uploadId}.apk`）每个 IP 每分钟次数；`GET`、`HEAD`、带 `Range` 的请求各算一次；超出答 429（手机端自更新按 `Retry-After` 退避，不是管理端界面） | item-05.md 第 40、44 行；toml 第 104–112 行 |
| d4 | `ratelimit.push_image_per_ip_per_min` | 120 | 整数，最小 1，无上限 | `CONFIG:MANAGE` | 推送图片（`GET /public/push-images/{uploadId}`）每个 IP 每分钟次数 | item-05.md 第 41、44 行；toml 第 114–122 行 |
| d5 | `ratelimit.ad_media_per_ip_per_min` | 120 | 整数，最小 1，无上限 | `CONFIG:MANAGE` | 广告素材及缩略图（`GET /public/ads/media/{uploadId}` 与 `…/thumbnail`）每个 IP 每分钟次数，两个路径共用一个计数器 | item-05.md 第 42、44 行；toml 第 124–132 行 |
| d6 | `analytics.funnel_max_concurrency` | 2 | 整数 1 到 32 | `CONFIG:MANAGE` | 一个 admin 实例同时计算的漏斗个数上限（每次计算最多读 20 万条事件，约 100 MB）；超出时漏斗请求答 429（a10）；每次漏斗请求都读取，保存后下一次请求生效；按实例计数，不是集群共用 | item-22.md 第 11–13 行；toml 第 134–143 行 |
| d7 | `integrity.app_attest_max_keys_per_device` | 3 | 整数，最小 1，无上限 | `CONFIG:MANAGE` | 同一个 `deviceId` 30 天内最多认证几个 iOS App Attest 密钥；再多一个，手机端得到 403 `DEVICE_INTEGRITY_FAILED`；苹果在重装、从备份恢复、换机时会生成新密钥；手机端没收到响应时的原样重发不计入 | item-18.md 第 68 行；toml 第 145–153 行 |
| d8 | `ratelimit.app_attest_challenge_per_ip_per_hour` | 60 | 整数，最小 1，无上限 | `CONFIG:MANAGE` | `POST /api/integrity/app-attest/challenge` 每个 IP 每小时次数；默认是游客每 IP 限额的 3 倍（一次 iOS 游客创建要一个认证挑战和一个断言挑战） | item-18.md 第 70 行；toml 第 164–172 行 |
| d9 | `ratelimit.app_attest_key_per_ip_per_hour` | 20 | 整数，最小 1，无上限 | `CONFIG:MANAGE` | `POST /api/integrity/app-attest/keys` 每个 IP 每小时次数；默认同 `ratelimit.guest_per_ip_per_hour` | item-18.md 第 71 行；toml 第 174–182 行 |
| d10 | `integrity.app_attest_unsupported_allowed` | true | 布尔值（开关） | `CONFIG:MANAGE` | 开（默认）：不能使用 App Attest 的 iPhone（手机端读到 `isSupported` 为 false，`integrityToken` 传 `unsupported`）可以创建游客凭据和新账号，作为未经认证的 iOS 设备；已经认证过密钥的 `deviceId`、以及游客记录是 Android 的 `deviceId` 不能这样做；原有的按 IP、按设备限流照常。关：这些 iPhone 得到 403 `DEVICE_INTEGRITY_FAILED`，不能创建游客凭据和新账号。每次校验时读取，保存后下一次请求生效。Android 不受影响。2026-10-30 新增 | item-18.md 第 55、69 行；toml 第 155–162 行 |
| d11 | `events.store_client_ip` | true | 布尔值（开关） | `CONFIG:MANAGE` | 开（默认）：每条埋点事件存客户端 IP。关：新写入的事件不存 IP（`ip` 为空），国家仍照常由 IP 推出，所以国家统计不变；已经存下的 IP 到事件过期（`events.ttl_days`）才消失。管理端的埋点列表里 IP 一栏对这些事件显示为空。每次写入时读取，保存后下一批事件生效。2026-10-30 新增（合规按地区部署配置） | 契约请求 `ip-storage-switches.md`；toml 第 193–200 行 |
| d12 | `ads.store_client_ip` | true | 布尔值（开关） | `CONFIG:MANAGE` | 开（默认）：每条广告展示记录存客户端 IP。关：新写入的展示记录不存 IP（Redis 里按预加载期限保存的展示元数据也不再带 IP），国家、平台、渠道等照常；已经存下的 IP 到记录过期（`ads.log_retention_days`）才消失。每次写入时读取，保存后下一条记录生效。2026-10-30 新增 | 契约请求 `ip-storage-switches.md`；toml 第 202–209 行 |
| d13 | `attribution.store_click_ip` | true | 布尔值（开关） | `ATTRIBUTION:MANAGE` | 开（默认）：每条自建归因的点击记录存客户端 IP。关：新点击不存 IP，点击明细（`GET /attribution/clicks`）里这些点击的 IP 一栏为空；**自建归因里靠 IP 的"指纹匹配"对这些点击不再生效**（按点击编号的匹配不受影响），所以关掉后安装只能靠点击编号归因。已经存下的点击保留 IP 到被清除（`attribution.click_retention_days` 加 `attribution.click_expired_keep_days`）。注意编辑权限是 `ATTRIBUTION:MANAGE`，不是 `CONFIG:MANAGE`。每次写入点击时读取，保存后下一次点击生效。2026-10-30 新增 | 契约请求 `ip-storage-switches.md`；toml 第 211–218 行 |
| d14 | `chat.message_retention_days` | 0 | 整数，0 或不小于 32（且大于 `stats.land_window_days`，否则保存时 400，`details` 里写出两个键） | `CONFIG:MANAGE` | 聊天消息和账号已结束的通话记录保留多少天。0（默认）表示保留到账号删除。大于 0：每天一次的清理任务（03:30 UTC）删除早于该天数的消息和通话记录；开着或未结算的会话、待人工复核的消息、`PENDING` 的文字轮、账号订阅当前周期内的行不删。之后用户的聊天历史、数据导出里没有这些消息，后台的会话列表变短，待复核的已删消息在后台看不到内容；已落地的统计不变；AvatarMemory 里的记忆不受影响。每次运行读取，保存后下一次运行生效。2026-10-30 新增（合规按地区部署配置） | 契约请求 `retention-settings.md`；toml |
| d15 | `voice.source_sample_retention_days` | 0 | 整数，最小 0 | `CONFIG:MANAGE` | 声音样本原文件（和任务上的转写）保留多少天，从音色创建起算。0（默认）表示随音色的生命周期。大于 0：到期由每天一次的清理任务删除，音色本身继续可用；之后数据导出里没有该音色的原始 wav，音色在合成服务里丢失时无法用样本重建，待复核的被举报音色没有样本可听（有待复核记录的音色不删）。每次运行读取。2026-10-30 新增 | 契约请求 `retention-settings.md`；toml |
| d16 | `guest.device_retention_days` | 0 | 整数，0 或不小于 91 加 `stats.land_window_days`（否则保存时 400） | `CONFIG:MANAGE` | 游客设备记录从最后一次出现起保留多少天。0（默认）表示不删除。大于 0：到期由每天一次的清理任务删除（仍有未结束游客会话的设备不删）。**警告**：游客额度记在设备记录上，记录删除后该设备下次出现按新设备处理并重新发放额度，所以设得太短会让游客额度被绕过；已落地的统计不变。每次运行读取。2026-10-30 新增 | 契约请求 `retention-settings.md`；toml |
| d17 | `support.feedback_retention_days` | 0 | 整数，最小 0 | `CONFIG:MANAGE` | 客服反馈（含用户原文）保留多少天，从提交起算。0（默认）表示保留到账号删除。大于 0：到期由每天一次的清理任务删除，不分转发状态（待转发、已转发、失败）；还没转发的被删后不会再转发；已经转发给第三方客服工具的副本在对方系统里，这里删不掉。后台客服列表只显示剩下的。每次运行读取。2026-10-30 新增 | 契约请求 `retention-settings.md`；toml |
| d18 | `moderation.record_retention_days` | 0 | 整数，最小 0 | `MODERATION:CONFIG` | 审核记录保留多少天，从创建起算。0（默认）表示不删除。大于 0：到期由每天一次的清理任务删除，状态为待复核（`PENDING_REVIEW`）的永远不删。之后审核统计里被删日期的数字变小（统计是读记录实时算的），已删的记录在后台打不开。每次运行读取。2026-10-30 新增。**注意编辑权限是 `MODERATION:CONFIG`，不是 `CONFIG:MANAGE`** | 契约请求 `retention-settings.md`；toml |

这 10 个键（d1–d10）在契约 17.5 的表里都还没有（d1–d9 对契约原文逐个 `grep` 得 0 次；d10 是 2026-10-30 新键，契约请求 `item-05`、`item-14`、`item-18`、`item-22`、`item-23` 正是要把它们写进去）。这对 AvatarAdmin 有一个具体后果：计划任务 10 规定 `CONFIG_SCHEMA` 的键清单只从契约 17.5 的表生成，并且"`GET /config` 返回而 schema 里没有的键"会被当成"未识别的配置项"，页面顶部警告、只读显示（计划第 456–460、469 行）。所以这 10 个键按计划现在的写法会被只读显示。**处理（第 5 节第一段指令里写成了动作）：给这 10 个键在 `CONFIG_SCHEMA` 里加条目，并让检查脚本有一个单独的"契约采纳前的后端额外键"清单，契约采纳后从清单里删。** 后端另有 7 个更早的额外键（不是第一批新增，同样不在契约 17.5 里，同样处理）：`push.task_poll_seconds`（整数，默认 15，最小 1，`PUSH:CONFIG`）、`memory.call_timeout_seconds`（整数，默认 10，最小 1，`CONFIG:MANAGE`）、`attribution.postback_enabled`（布尔，默认 false，`ATTRIBUTION:MANAGE`）、`attribution.facebook_graph_version`（字符串，默认 `v26.0`，必须匹配 `^v[0-9]{2}\.[0-9]$`，`ATTRIBUTION:MANAGE`）、`ratelimit.events_per_ip_per_minute`（整数，默认 600，最小 1，`CONFIG:MANAGE`）、`chat.moderation_concurrency`（整数，默认 16，1 到 32，`CONFIG:MANAGE`）、`chat.moderation_deadline_ms`（整数，默认 2000，100 到 2900，`CONFIG:MANAGE`）（来源 toml 第 11–91 行）。

d11–d13 是 2026-10-30 新增的三个布尔开关（硬规则审计 C1），同样不在契约 17.5 的表里（契约请求 `ip-storage-switches.md` 要把它们写进去），上面"这 10 个键"的处理同样适用于它们：在 `CONFIG_SCHEMA` 里加条目（类型布尔，默认 `true`，编辑权限如表），并放进"契约采纳前的后端额外键"清单；这样一共是 13 个第一批以来新增的额外键，加上更早的 7 个。

d14–d18 是 2026-10-30 新增的五个数据保留期整数键（硬规则审计 C5 到 C9），同样不在契约 17.5 的表里（契约请求 `retention-settings.md` 要把它们写进去），上面的处理同样适用于它们：在 `CONFIG_SCHEMA` 里加条目（类型整数，默认 0，最小 0，编辑权限如表，其中 d18 是 `MODERATION:CONFIG`），并放进"契约采纳前的后端额外键"清单；这样一共是 18 个第一批以来新增的额外键，加上更早的 7 个。两个键有保存时的关系校验（d14、d16 与 `stats.land_window_days`，同 `events.ttl_days` 的做法）：保存失败时 `details` 里写出两个键，`reason` 是 `OUT_OF_RANGE`；管理端不需要预先校验，展示后端返回的 `message` 和 `details` 即可。

### (e) 改变运营在已有页面上必须怎么做的规则

| 行 | 规则和运营要做的事（精确名字） | 管理端页面 | 来源 |
|---|---|---|---|
| e1 | **召回模板规则：只要求默认语言（`item-10.md`，a5 是错误形状，a14 是列表信息；2026-10-29 已重新设计并实现，取代了以前的"每种语言都要有"）。** 规则：对每个召回触发原因（`daily_recall`、`streak_at_risk`），只要它有至少一条**启用**的模板，就必须有一条默认语言（`push.default_locale`，默认 `en`）的**启用**模板；这是唯一的硬规则。一条启用模板都没有的原因没有这个要求。其他语言的模板可选，可以按任意顺序创建、启用、停用、编辑、删除，只要同一原因下还有别的语言启用时默认语言那条没动；账号的语言没有模板时发默认语言那条（发送逻辑没变，两者都没有就跳过该账号并记一条 WARN）。语言标签区分大小写地精确比较；列表之外的语言可以有模板。每次写入后按"写入之后的状态"判断，不满足则整个保存被拒、什么都不写：创建（`enabled=true`）、编辑（编辑前或编辑后任一状态是启用；改原因时旧原因也判）、停用、删除模板，以及保存/恢复默认 `push.default_locale`（新默认语言下，每个有启用模板的原因都要有该语言的启用模板）。停用状态的模板不计入，也不被判断。保存 `app.supported_locales` **永远不会**因为召回模板被拒绝（只剩 a4/e3 的通知模板文件检查，没变）。运营怎么用：① 一个原因的第一条要启用的模板必须是默认语言的，之后其他语言任意顺序；② 任何一种非默认语言随时可以停用、改、删；默认语言那条只有在同一原因下别的语言都已停用后才能停用或删除（它是唯一启用的模板时随时可以）；要整体关掉一个原因，先停其他语言，最后停默认语言；③ 想把 `push.default_locale` 改成别的语言，先为每个有启用模板的原因启用该语言的模板；④ 给 `app.supported_locales` 加语言不需要先动召回模板，缺的语言在模板列表的 `missingLocales`（a14）里显示，发送时回退到默认语言。错误文字见 a5，它写明了怎么做。 | 5.11 推送 → 模板（`/push/templates`，`PUSH:TEMPLATE`）；5.15（`push.default_locale`、`app.supported_locales`） | item-10.md 第 5–11、83–90 行 |
| e2 | **至少一个启用的英文验证码短信模板（`item-11.md`，a6 是它的错误形状）。** 规则：始终要有至少一个 `smsType=OTP`、启用、`locale` 等于 `en`（不区分大小写，所以 `EN` 算，`en-GB`、`en-US` 不算）、`country` 为空的模板（选择规则末尾回退到的那个，只服务一个国家的英文模板服务不了其他国家）。守卫条件（和原来的"最后一个启用的 OTP 模板"守卫相同）：`auth.phone_login_enabled` 为真，或至少有一个手机号账号。创建不受影响；写入后仍有别的合格模板就不受影响；已经缺合格模板的旧状态不拦无关的编辑，只拦"拿掉最后一个合格模板"。原来的"最后一个 OTP 模板"守卫先判，消息不变。`PUT /config/auth.phone_login_enabled` 设为 `true` 时同样要有这个模板（a6）。没有合格模板时发验证码仍是 503 `SMS_SEND_FAILED`（选模板的逻辑没改）。 | 5.18 短信管理 → 模板（`/sms/templates`）；5.15（`auth.phone_login_enabled`） | item-11.md 第 17、25、37–41 行 |
| e3 | **增加支持语言之前，该语言的通知模板文件要先随版本发布（`item-09.md`，a4 是错误形状）。** 运营不能先改设置再等文件；顺序是"文件随版本发布 → （召回模板，见 e1）→ 把语言加进 `app.supported_locales`"；比较不区分大小写、整个标签要匹配。 | 5.15（`app.supported_locales`）；5.11 | item-09.md 第 13、21、29 行 |
| e4 | **成本币种锁（`item-20.md`，a9 是错误形状）。** 只要有任何一条投放成本，`attribution.cost_currency` 就不能改（也不能重置到非当前值的默认值）；要换币种：先 `DELETE /attribution/costs/{id}` 删光所有成本行，再改设置。批量和单条成本录入仍要求 `currency` 等于这个设置。设置写入和成本写入之间没有锁：同一瞬间写入的成本行可能带旧币种（只是被报表忽略，和其他币种的行一样），这是防误操作，不是事务保证。 | 5.13 投放管理 → 投放成本页签、归因参数 | item-20.md 第 10–11、25 行 |
| e5 | **默认币种必须在允许币种里（`item-17.md`，a8 是错误形状）。** 保存其中一个键时，拿提议的值和另一个键的当前值（已保存的或默认的）比较：所以要把 `usage_price.default_currency` 改成新币种，要先把它加进 `usage_price.allowed_currencies`；要把当前默认币种从允许列表里去掉，要先改默认币种（由 item-17.md 第 21 行的比较规则推出）。每日价格同步生成的批次用默认币种，这条关系保证它们总能被确认；确认时批次的币种必须在允许列表里（a8 ②）。 | 5.15；5.23 价格 | item-17.md 第 21、36 行 |
| e6 | **管理员权限变更在所有实例的下一次请求生效（`item-19.md`）。** 改角色的权限码、创建或删除角色、给管理员换角色、创建或删除管理员、删除自定义权限节点、启动时同步内置权限树：提交后受影响管理员的下一次请求，在每个 admin 实例上都按新权限判断（Redis 可用时）；Redis 不可用时最长 `admin.permission_cache_seconds`（默认 30）后生效，查权限本身不因 Redis 不可用而失败。没有新接口、字段、错误码；超级管理员不受影响。前端的做法（进入应用时取一次权限，收到 403 `ADMIN_FORBIDDEN` 时重取一次，不轮询）不用改，要改的是设计文档第 88 行那句"缓存不超过 `admin.permission_cache_seconds`"的说法。 | 3.4 权限判断；5.16 系统管理 | item-19.md 第 17、27、33–37 行；设计文档第 88 行 |

## 3. 已决定、下一轮也会碰管理端前端的改动（Changes decided for the next round that will also touch the admin frontend）

以下三条里，第 1、3 条是：**not built yet, waiting for the owner's go**（还没有做，等负责人说开始）；现在不实现，不写占位代码，不改计划里的任务。第 2 条已经做完（2026-10-29），留在这里只是保持编号。细节只写到负责人已经定的程度，其余不猜。

1. **文字审核的"模型检查"有了开关，并取消"生产启动时没配审核供应商就拒绝启动"。** 新增一个开/关设置，控制文字审核是否调用审核模型（供应商）检查；同时去掉现在的生产环境启动拒绝（没有配置任何审核供应商时）。设置键已定（2026-10-29，正在实现）：`moderation.model_check_enabled`，布尔，默认 `true`，编辑权限 `MODERATION:CONFIG`，契约章节 11.2；它控制**所有内容类型**（文字、人设、伴侣名字、消息、照片、声音、生成图和动作片段）是否调用第三方审核服务，关闭时文字仍过运营维护的规则词表；模型检查实际运行要同时满足：开关打开、有审核服务、`moderation.block_score` 和 `moderation.review_score` 都设了，缺任何一个就只跑规则词表，不再回 503、也不再拒绝启动（启动时只打一条警告）。它会出现在 5.15 系统配置页；因为设置页的键清单是从契约 17.5 的表生成的（本节第 4 条第 2 点），这一行必须随契约请求 `moderation-switch.md` 一起进入契约 17.5。
2. **召回模板规则已重新设计并实现（不再是预告）。** 一个召回原因只需要有一条**启用**的、默认语言（`push.default_locale`）的模板；其他语言可选，没有时回退到默认语言；管理端页面把缺的语言显示为信息（`GET /push/templates` 的 `data.missingLocales`，a14）；保存支持语言列表（`app.supported_locales`）不会因为召回模板被拒绝。现行规则和错误形状见第 2 节 a5、a14、e1，它们取代了以前的"每种语言都要有"。负责人的原话"保存支持语言列表永远不会因为模板而被拒绝"在这次任务里按"只指召回模板"实现：a4/e3 的通知模板文件检查（`app.supported_locales` 里的语言没有 `notification/templates/<语言>.json` 就拒绝）保持不变，这次任务的指令明确写了。
3. **对其他写死的合规行为做一次完整审计，可能新增更多设置。** 哪些设置、几个，现在不知道（unknown yet）。

## 4. 没有核实的

1. **AvatarAdmin 里这些页面有没有代码。** 我读了本地 `D:\Projects\PycharmProjects\AvatarAdmin`：`src/pages` 下只有 `user/login/index.tsx`，`config/routes.ts` 只有登录路由，`docs/superpowers/handoff/ledger.md` 最后一行是"任务 1 完成，负责人要求在任务 2 之前停止"，`git log` 最新是 `7a7da06`。所以审核、召回模板、投诉、告警、通话详情、邮件模板、漏斗、价格批次确认这些页面在本地没有代码。我没有做 `git fetch`，`git branch -a` 只有 `main` 和 `origin/main`，看不到云端会话可能已经推送的 `claude/…` 分支；那里是否已经做了更多，我不知道。
2. **设置页怎么建。** 只能从计划任务 10 读到（计划第 441–471 行）：手写的 `CONFIG_SCHEMA`（每个键一项：类型、分组、范围、编辑权限），键清单用 `grep` 从契约 17.5 的表生成，`scripts/check-config-keys.ts` 比较两者；`GET /config` 返回而 schema 里没有的键 → 警告并只读。现在 `scripts/check-config-keys.ts` 只是一个故意 `exit 1` 的占位文件，`src/pages/config` 不存在，所以这套机制没有任何实现，"9 个新键会被当成未识别项"是按计划文字推出的，没有运行过。
3. **各页面里的具体做法（计划任务）。** 我读了计划任务 10、13、14、15、19、20、22、26、28、31 里与本清单相关的段落，任务 11 只读了订阅统计那一行，任务 7（登录）和任务 25（投放管理）的正文我没有读；第 5 节指令里的"任务对应关系"是按这些任务的标题和规格节号对的，没有逐条核对任务内容。
4. **谷歌订阅标价在统计页上显示不显示。** 设计文档第 297 行和计划任务 11 都没有写出订阅统计的列名；`listPriceAmount`、`listPriceCurrency` 在 AvatarAdmin 的文档里只出现在契约快照一次（契约第 2311 行）。我只读了 item-27.md，没有读后端的统计响应代码，所以 a12 里这两个字段的形状（十进制字符串或 `null`）来自请求文件。
5. **`GET /api/admin/me` 的 `permissions` 是否正好等于 item-01 说的"持有的权限码"（各角色权限码的并集）。** 没查后端代码。所以 a1 没有要求前端把角色权限树里操作者没有的节点预先禁用；后端是最终裁决，前端只负责在 403 时展示。
6. **`SUBSCRIPTION_EVENT_FAILED` 的细节。** 它只在 item-21.md 第 7 行和 item-30.md 第 11、15 行被点名；这 33 个请求文件里没有它的 `refType`、`detail`、自动解决条件。写它的请求（item-21 说是任务 C3）不在 `contract-requests` 文件夹里，我没找到。第 2 节 (b) 因此没有这个类型的行。
7. **契约/设计文档会不会收到把 `POSTBACK_CREDENTIAL_FAILED`、`SUBSCRIPTION_EVENT_FAILED` 写进 17.4 的请求。** item-21.md 第 7 行说要由另一个请求写；这 33 个文件和 `D1-CONTRACT-REQUESTS-INDEX.md` 里没有。所以在那之前，设计文档第 342 行和计划的 `ALERT_TYPES` 都比后端少三种（b1、b2 的两种和 `SUBSCRIPTION_EVENT_FAILED`）。
8. **设计文档第 12 节验收清单的现有内容。** 我只搜了与本清单相关的页面关键字：投诉（5.25）、漏斗、系统配置、成本（5.23）、短信管理（5.18）已有行，没有匹配"邮件"的行（和 admin-frontend-design-item-03.md 第 56 行的说法一致）；没有逐行读完整节，第 5 节第二段指令里"各页面加或扩一行"没有逐条对照现有措辞。
9. **后端运行行为。** 本清单里所有错误码、消息、字段都来自请求文件（它们是"从后端已完成的实现写出来的"）；我另外只在代码里核对了三处：`GET /config` 会返回额外键（`ConfigAdminFacade.java` 第 78–86 行，`ConfigService.java` 第 168–171 行，`ConfigKeyTypes.java` 第 38 行注释）、关系类错误的 `details` 字段名是 `ref`（`ConfigValidator.java` 第 26、116–123 行）、(d) 的 9 个键与 `git diff fb617a2 89370b6 -- tools/extra-config-keys.toml` 一致。其余没有用代码或运行去验证；没有启动后端，没有请求过任何接口。
10. **item-06（安全响应头）对管理端部署的影响。** 我把它列为"不改变管理端"，依据是计划第 894 行写明前端用同域反向代理、`/api/` 转发、其余走单页应用回退；后端把这六个响应头加在 admin 的每个业务端口响应上（item-06.md 第 11 行）。我没有核对管理端的静态文件是否也可能由后端 admin 应用提供（若是，`Content-Security-Policy: default-src 'none'` 会影响页面本身）。

## 5. 可直接贴的指令

### 5.1 给 AvatarAdmin 的会话

先由负责人做一步（AvatarAdmin 的会话只读自己的仓库，见它的 `CLAUDE.md`，看不到 AvatarBackend）：用 `cp -p` 把本文件复制到 AvatarAdmin 的 `docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md`，并在那里的 `README.md` 表里加一行；`admin-frontend-design-item-03.md` 里管理端前端要用的东西（模板码、用途说明、占位符、必含项）已经写进本文件第 2 节 (c)，不需要另外复制。然后贴下面这段：

```
读 docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md（后端第一批交付给管理端前端的改动清单）。

1. 第 2 节 (a)(b)(c)(e) 的每一行，并入前端计划 docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md 里对应任务的接口、测试和界面文字；任务对应：登录与绑定认证器 a2、a3 → 任务 7；设置页 a4、a8（两个币种键）、a9 的设置键部分、e3、e5 → 任务 10；订阅统计 a12 → 任务 11；告警 b1、b2 → 任务 13（客服的"重试"会自动关闭客服转发告警）；投诉 a11 → 任务 14；文本规则的说明文字 a13 → 任务 15；通话详情 a7 → 任务 19；漏斗 a10 → 任务 20；推送模板 a5、a14、e1 → 任务 22；投放成本和归因参数 a9、e4 → 任务 25；价格批次确认 a8 → 任务 26；短信模板 a6、e2 和邮件模板 c1 → 任务 28；管理员与角色的 403 a1、权限生效 e6 → 任务 31 和任务 3/4 里关于 403 的处理。已经写好的代码按同样的行落实；还没有代码的页面，只改计划，到做那个任务时一并实现。
2. 第 2 节 (d) 的 10 个设置键（d1–d10，d10 是布尔开关）：它们现在不在契约 17.5 的表里（后端在等契约采纳），但 GET /config 会返回它们，管理员可编辑。给这 10 个键在 CONFIG_SCHEMA 里各加一项（类型、范围、editPermission 取表里的值，默认值不进 schema，仍以 GET /config 的 defaultValue 为准，label 和 desc 两种语言都写），并让 check-config-keys 脚本有一个单独的"契约采纳前的后端额外键"清单（这 10 个，加上表后面列的那 7 个更早的额外键），契约采纳后再从清单里删；不要让它们落到"存在未识别的配置项"的警告里，也不要让检查脚本因它们失败。
3. 第 3 节第 1、3 条是预告：不实现、不写占位代码、不改计划；它们动手时会有新的清单。第 3 节第 2 条（召回模板规则）已经实现，按第 2 节 a5、a14、e1 落实：展示后端 message（它写明怎么做）；用 GET /push/templates 的 data.missingLocales 在"触发原因 × 语言"矩阵里把缺的格子标成"回退到默认语言"的信息，不当错误；前端不复刻规则逻辑（后端是最终校验，设计文档第 307 行和计划任务 22 的第一条测试已经这样写）；保存 app.supported_locales 时不再有召回模板的错误，保存 push.default_locale 时可能有 data.reasons。
4. 清单里已经写明的事不要再问负责人；清单第 4 节列的是我没核实的，遇到时按"契约的缺口不是阻塞"处理（写成 docs/contract-requests/ 里的新问题文件，当前任务按最小做法继续）。
5. 做完后报告：哪些行没能落实、为什么（含第 4 节第 1 条的情况：如果你的仓库里这些页面已经有代码，写出哪些文件已按清单改了，哪些与清单冲突）。
```

### 5.2 给在 AvatarApp 的 main 上改 `admin-frontend-design.md` 的人

```
admin-frontend-design.md 是共享文档，只在 main 上改。依据：D:\Projects\PycharmProjects\AvatarBackend\.superpowers\sdd\2026-10-21-avatar-backend\ADMIN-FRONTEND-CHANGES.md（第 2 节逐行，每行有来源）。按下面的节号更新（行号是改动前 main 上的行号）：
- 5.18a 邮件模板（第 382 行）：五个模板变六个，加 LOGIN_METHOD_ADDED，用途说明、占位符、必含项的措辞用 D:\Projects\PycharmProjects\AvatarBackend\.superpowers\sdd\2026-10-21-avatar-backend\contract-requests\admin-frontend-design-item-03.md 的"Change to line 382"一节（行 45–47）原文；后端依据节号加上 2.7。
- 3.4 权限判断（第 88 行）：权限变化的生效改为"所有实例的下一次请求生效，Redis 不可用时最长 admin.permission_cache_seconds"（清单 e6）。
- 3.1/3.2（第 61–73 行）：登录时二次验证密钥解不开答 401 ADMIN_TOTP_INVALID；绑定时待确认密钥解不开答 401 ADMIN_INVALID_TOKEN 且 enrollToken 作废（清单 a2、a3）。
- 5.5 通话（第 251 行）：详情多一个 maxDurationMinutes（清单 a7）。
- 5.6 漏斗分析（第 259 行）：并发上限，超出答 429 RATE_LIMITED，无 data、无 Retry-After（清单 a10）。
- 5.8 文本规则（第 281 行）：匹配说明补上 SUBSTRING 和 WORD 的形近字折叠、REGEX 不折叠（清单 a13）。
- 5.10 订阅统计（第 297 行）：Google 行的 listPriceAmount、listPriceCurrency 有值，没有价格时为 null（清单 a12）。
- 5.11 推送模板（第 307 行）："每个召回触发原因必须在列表里的每种语言上都有模板才允许启用"这句改为新规则（清单 a5、a14、e1，请求文件 item-10.md 第 1 节给出契约 8.4 的新句子）：召回原因只要有一条启用的模板，就必须有默认语言（push.default_locale）的启用模板，其他语言可选并回退到默认语言；矩阵里缺的格子用 GET /push/templates 的 missingLocales 显示为信息；其余（语言列取自 app.supported_locales 不变）。
- 5.13 投放管理（第 334 行附近的归因参数，和投放成本页签第 329 行）：attribution.cost_currency 已有成本行时不能改，先删成本（清单 a9、e4）。
- 5.14 告警（第 342 行）：类型表补 SUPPORT_FORWARD_FAILED（清单 b1）；POSTBACK_CREDENTIAL_FAILED 的 detail 取值 token_unreadable、pixel_id_malformed（清单 b2）；这两个类型和 SUBSCRIPTION_EVENT_FAILED 还没有进契约 17.4，等契约改完再补，先不要自己编它们的说明。
- 5.15 系统配置（第 348–350 行）：分组前缀补 integrity.；"后端校验失败时展示 message 和 data.details"补充这几个新的 data 字段：missingLanguages（保存 app.supported_locales）、defaultLocale 和 reasons（保存 push.default_locale）、details 的 ref 可能是 SmsTemplate 而不是设置键（auth.phone_login_enabled）；新增 10 个设置键的清单见 (d) 节，与契约 17.5 的采纳一起处理。
- 5.16 系统管理（第 356–357 行）：管理员、角色的新 403 ADMIN_FORBIDDEN 规则（清单 a1）。
- 5.18 短信模板（第 377 行）：至少一个启用的英文、不限国家的 OTP 模板（清单 a6、e2）。
- 5.23 价格（第 429 行）：确认时批次最终币种必须在 usage_price.allowed_currencies 里，否则 400（清单 a8）。
- 5.25 投诉（第 451 行）：列表状态筛选加 OPEN（未结案）（清单 a11）。
- 第 12 节验收清单：为上面各页各加或扩一行；邮件模板（5.18a）目前没有这一行（admin-frontend-design-item-03.md 第 56 行）。
不要把后端实现细节（密钥怎么派生、锁名、内部表）写进设计文档；每行清单已经只写了其他方能观察到的东西，如果有句子像内部机制，不要抄，告诉我。
```


## W2a answers that are now 400 (small-defect batch; details in contract-requests\w2a-admin-400-answers.md)
- SMS channels `POST/PUT /api/admin/sms/channels`: `credentials` values must be non-null strings (null value or name = 400 `EMPTY_NOT_ALLOWED` on `credentials`); to keep credentials unchanged omit the field or send `{}`.
- `GET /api/admin/alerts`: `status` OPEN or RESOLVED, `type` one of the 17 alert types, otherwise 400 (omit the parameter for "all", an empty string is a value); the type filter options come from the 17 types.
- `GET /api/admin/audit-logs`: `action`/`targetType` at most 64 characters, `targetId` at most 255 (inputs get maxLength).
- `PUT /api/admin/permissions/{code}`: the type of a node cannot change (400 on `type`); the type field is read-only on edit.
- E-mail template subject/body with a NUL character: 400 (not producible from a normal form).

## GROUP B (2026-10-31): changed setting ranges (belongs to section 2(d)) and changed answers

Settings (5.15 system config page; `CONFIG_SCHEMA` entries to update):
- `chat.moderation_deadline_ms`: range now integer 100 to 2500 (was 100 to 2900; also the 2(d) paragraph above that lists it as "100 到 2900"). Request: contract-requests\w5b-ranges-and-account-memory.md section 2.
- `recall.window_minutes` (default 60) and `recall.scan_interval_minutes` (default 10): integer 1 to 1440 (had no maximum). Request: same file, section 3.
- `push.schedule_catchup_minutes` (default 60): integer 1 to 10080, plus a save rule with `push.task_poll_seconds`: `push.schedule_catchup_minutes x 60 >= 600 + push.task_poll_seconds`, checked when either key is saved or reset; violation: 400 `INVALID_REQUEST`, `data.details` names the saved key first and the other key second, both reason `OUT_OF_RANGE`. Show the rule as a hint on both fields (with the defaults the catch-up must be at least 11). A value saved before these limits stays in effect until that key is saved again. Request: same file, section 4.

Answers:
- `GET /api/admin/accounts/{id}/memory`: two new fields next to `embeddingAssignments`: `truncated` (boolean, true when the account has more than the newest 200 assignments shown) and `totalCount` (all assignments of the account). Show "only the newest 200 are shown" when `truncated` is true. Request: same file, section 1.
- `GET /api/admin/attribution/performance` (and its export): range errors are now the ones of every other statistics page: `from` after `to` -> `details[0].ref` `from`, message "from is after to" (was ref `to`, "to is before from"); range too long -> ref `to`, message "The range exceeds stats.max_range_days" (was "The range is longer than N days"); malformed date or year below 1 -> reason `OUT_OF_RANGE` (was `INVALID_FORMAT`). Request: contract-requests\w3b-changes.md (Row 268).
- Client-facing app only (not the admin frontend): a plain 403 from the error page is now 403 `FORBIDDEN` (was 400 `INVALID_REQUEST`). Request: contract-requests\w7-changes.md A1.

## GROUP A (2026-10-31): a new alert type, a changed alert detail, and three changed outcomes

No new setting (section 2(d) unchanged by GROUP A).

Alert types (5.14 alerts page `/monitor/alerts`; belongs to section 2(b)):
- New type `STAT_RELAND_FAILED` (the 18th; the type filter of `GET /api/admin/alerts` and the type table get it; label "Statistics re-landing failed"): a statistics date marked for landing again (after the cost backfill priced old usage) failed 5 times in a row. `refType` `STAT_RELAND_DAY`, `refId` `<lander>:<yyyy-MM-dd>` (for example `usage-cost:2026-10-10`), `accountId` empty, `detail` the exception class name only. One open alert per date. Resolved automatically when the date lands; can be resolved by hand (it opens again at the next failure while the date keeps failing). Meanwhile the date is retried after 10, 20, 40 ... minutes, at most every 6 hours. Request: contract-requests\w6b-changes.md (Row 347).
- Correction to b2 (`POSTBACK_CREDENTIAL_FAILED`): an open alert no longer keeps its first `detail`; a later failure with another reason replaces it (`token_unreadable`, `pixel_id_malformed` or Meta's error code), still one open alert per campaign. Request: contract-requests\w7-changes.md A3.

Changed outcomes an operator can see:
- Ban (5.4 users, `POST /api/admin/users/{id}/ban`): the answers are unchanged (a repeated ban is still 409 `INVALID_STATE`). New: if the ban committed but its calls could not be ended at once, the worker's deadline scan ends them with end reason `BANNED` within one scan interval (`session.deadline_scan_seconds`), so the call records page shows them ended shortly after. Request: contract-requests\group-a-changes.md section 1.
- Push tasks (5.11 push tasks list): after the push executor was down for longer than `push.schedule_catchup_minutes`, a task that had been started but had not sent anything shows `CANCELLED` with note `MISSED` (before: it stayed `RUNNING` and was sent late). Request: same file, section 2.
- Uploads (`/api/admin/uploads/image`, `/catalog-image`, `/apk`, `/api/admin/ads/media`, ...): a multipart upload without a declared length (chunked) is now answered after authentication and the permission check (401 `ADMIN_INVALID_TOKEN`, 403 `ADMIN_FORBIDDEN` first), then 400 `INVALID_REQUEST` "Invalid request" (before: 400 at once). Browsers always declare the length of a `FormData` upload, so the admin frontend is not affected in practice. Request: same file, section 3.

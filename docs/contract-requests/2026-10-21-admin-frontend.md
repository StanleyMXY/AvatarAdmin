# 给后端和契约负责人的问题、规格修改清单、契约变更请求（定稿）

> **写给：** AvatarBackend 会话（后端）、改契约和规格的负责人。定稿日期 2026-10-27（任务 32 步骤 4）。
> **依据：** 第一部分是规划时（2026-10-21）写好、已交给后端的问题，现按后端的回复更新；第二部分是执行 32 个任务中新发现的问题（来自 `docs/contract-requests/2026-10-26-admin-frontend-*.md` 的 25 份文件，合并重复后）；第三部分是规格要在 AvatarApp `main` 上修改的地方；第四部分是前端需要的契约变更请求。
> **规则：** 规格和契约只在 AvatarApp `main` 上改，本仓库 `docs/shared-snapshots/` 里的快照只读，我们不改。契约的缺口不是阻塞，每条都有前端暂时的做法。

## 条数

| 部分 | 内容 | 条数 |
|---|---|---|
| 第一部分 | 规划时的问题（原 11 条加回话文件里的 1 条邮件模板占位符问题） | 12 条：已回答 12、未回答 0 |
| | 响应字段表 | 20 行：已回答 20、未回答 0（后端按 19 条编号回复，其中无广告原因行不加 `platform` 这一点不采用，其余采用） |
| 第二部分 | 执行中新发现的问题（合并重复后，按模块） | **201 条**，全部是"未回复"（还没交给后端）；另有 12 处原问题文件里问过、但现有回复和契约已经回答的点，没有算进 201 条，单列在 2.22 |
| 第三部分 | 规格需要在 `main` 上修改的地方 | 3.1 计划冲突表 8 行（7 行未改，1 行 `main` 上已改）；3.2 任务报告和评审的条目 44 行（40 行要改，1 行规格不用改，1 行是重复的交叉引用，2 行有条件）；3.3 改计划或任务书的 2 条 |
| 第四部分 | 契约变更请求 | 9 条完整的请求，加一张"其他要在契约里补的文字"的表（8 行）。其中 7 条在第二部分有对应的问题条目（共 14 条），另外 2 条（4.4、4.7）只在第四部分，不算在 201 条里 |

第二部分各模块的条数：

| 节 | 模块 | 条数 |
|---|---|---|
| 2.1 | 登录与权限 | 4 |
| 2.2 | 系统管理：管理员、角色、权限树、审计日志 | 18 |
| 2.3 | 渠道包与应用版本 | 18 |
| 2.4 | 统计报表：共用、日报、留存、游客、总览 | 8 |
| 2.5 | 通话 | 5 |
| 2.6 | 埋点管理 | 4 |
| 2.7 | 用户 | 6 |
| 2.8 | 内容审核 | 6 |
| 2.9 | 形象与装扮、照片里的人投诉 | 10 |
| 2.10 | 记忆服务、系统监控、客服 | 6 |
| 2.11 | 订阅与权益 | 9 |
| 2.12 | 额度 | 5 |
| 2.13 | 成本 | 7 |
| 2.14 | 推送 | 18 |
| 2.15 | 邀请与分享 | 5 |
| 2.16 | 活动管理：签到、每日任务 | 14 |
| 2.17 | 投放管理 | 18 |
| 2.18 | 应用内广告 | 8 |
| 2.19 | 短信与邮件模板 | 19 |
| 2.20 | 站内通知与客户端配置 | 11 |
| 2.21 | 共用：导出与链接规则 | 2 |
| | 合计 | 201 |

## 没有得到回复的问题（单独列出）

- **第一部分：没有。** 11 条问题、回话文件里的 1 条问题和 20 行字段表，后端都已回复（见第一部分各条下面的"状态"和回复里的行号）。
- **第二部分：201 条全部没有得到回复**，因为它们是执行中才发现的，还没有交给后端。它们就是第二部分 2.1 到 2.21 各节里的条目，每条写了接口或字段、为什么需要、前端暂定的做法和来源文件。2.22 的 12 处是核对现有回复后发现已经被回答的，不在其中。
- **第三、四部分**的条目是对负责人的请求（谁在 `main` 上改规格和契约），不是对后端的问题；第三部分里带"待负责人先定"的 8 行需要负责人先决定行为。

## 安全相关的条目（优先看）

下面这些和权限、凭据、隐私有关，按严重程度排在最前。括号里是它们在第二部分和第四部分的位置。

1. **非超级管理员可以对超级管理员重置密码和二次验证，等于接管超级管理员账号**（任务 31 评审发现，契约没写这种情况）。第二部分 2.2 第一条；完整的契约变更请求见 4.2。
2. **后台读订阅的接口把完整的 Google 购买令牌发给只有 `SUBSCRIPTION:VIEW` 的管理员**，而持有购买凭证的人可以在 `google/verify` 认领订阅。第二部分 2.11 最后一条；完整的契约变更请求见 4.1（只返回末 6 位）。
3. **会话列表的 `deviceId` 可能把完整的游客设备哈希送到浏览器**（它是游客额度和锁的稳定标识）。第二部分 2.5 第二条；契约变更请求见 4.9（只返回前 8 位）。
4. **凭据类字段**：短信渠道凭据在请求体里的字段名和类型、以及它永不回显（2.19 第一条）；`extConfig` 里会不会放凭据（2.19 第四条）；已设置的 Facebook 访问令牌怎样清除、响应里永不返回明文（2.17 第八条）；管理员创建、重置的响应里从不返回密码或临时密码（2.2 第五条）；审计日志 `detail` 里从不写密码、令牌、验证码、凭据（2.2 第十六条）。
5. **未打码的 IP、令牌、号码和内部信息**：点击明细里 IP 掩码的格式（2.17 最后一条，完整 IP 只给 `ANALYTICS:IP_VIEW`）；短信记录的号码掩码和存库格式（2.19 第十六条）；推送发送结果里 token 的展示（2.14 第十七条）；账号删除任务的 `lastError` 会不会含用户内容或内部地址（2.7 第四条）；渲染模型响应里的存储引用 `fileRef`（2.9 第二条）。
6. **登录验证码锁定的响应**：第 5 次错误返回 401 还是 429、锁定期间错误密码返回什么，决定能否被用来区分密码对错（2.1 第三条）。


---

# 第一部分：规划时交给后端的问题（已按后端的回复更新）

> 这一部分是规划时写好、交给后端的原文（11 条问题加一张响应字段表），问题和“暂定做法”的文字没有改动；每条问题下面新加了一行“状态”，写后端的回复是什么和出处。回复文件是 `docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md`（下文写作“回复”，AvatarBackend 提交 57c388c，对应 4e1f538）、`…reply-2-to-avataradmin.md`（邮件模板占位符）、`…reply-3-to-avataradmin-upload-limits.md`（上传限制）。

> **写给：** AvatarBackend 会话（后端）。
> **依据：** 后端 2026-10-21 的说明（AvatarBackend 提交 1bc0b66）已读，管理端前端的计划已按它改完（`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`）。说明里定下的接口不再出现在这里。
> **规则：** 下面是说明里没有、管理端前端又需要的点。我们不自己猜：每条写了我们需要什么和为什么，"暂定做法"是后端回复之前前端临时的做法，回复之后改我们这边。契约和管理端前端设计只在 AvatarApp `main` 上改，我们不改它们。
> **回复方式：** 逐条回答"采用 / 不采用并说明实际是什么"即可，不需要重复我们的写法。

## 一、新增或补充的接口（11 条，全部已回答）

### 1. 只读接口 `GET /api/admin/meta`：页面需要、但读不到的配置值

> **状态：已回答，采用。** 十二个字段，名字与本表一字不差；任何已登录、不在“必须改密码”状态的管理员可调，只读，不写审计日志；没有默认值又未配置的键为 `null`（回复 `docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md` 第 27–37 行）。后端后来在第三份回复里又加了八个上传限制字段（`uploadMaxBytes` 等，`docs/backend-inputs/2026-10-22-avatar-backend-reply-3-to-avataradmin-upload-limits.md` 第 22–37 行），`meta` 现在共 20 个字段。

**为什么需要：** `GET /config` 只返回当前管理员有权编辑的键。下面这些值对应的键，编辑权限（`CONFIG:MANAGE`，或者 `INVITE:CONFIG`、`ATTRIBUTION:MANAGE`）不属于使用它们的页面的权限，所以持有页面权限的管理员读不到。

**需要：** 任何持有有效管理员令牌、且不在"必须改密码"状态的管理员都能调，返回当前生效值（没有默认值又未配置的键为 `null`）：

| 字段 | 来自配置键 | 哪个页面用 |
|---|---|---|
| `supportedLocales` | `app.supported_locales` | 推送模板的"触发原因 × 语言"完整性矩阵、客户端配置的语言页签、站内通知 / 应用版本更新说明 / 广告素材 / 服装名称的语言页签 |
| `landIntervalMinutes` | `stats.land_interval_minutes` | 总览页"今日数据每隔多少分钟刷新一次" |
| `allowedCurrencies` | `usage_price.allowed_currencies` | 价格页的币种下拉 |
| `deletionAlertAfterFailures` | `deletion.alert_after_failures` | 账号删除任务页，失败次数达到它的行高亮 |
| `inviteChainMaxDepth` | `invite.chain_max_depth` | 邀请链查询的深度上限 |
| `maxRecipients` | `notification.max_recipients` | 站内通知的收件人上限 |
| `pushImageMaxBytes` | `upload.push_image_max_bytes` | 推送图片的大小提示 |
| `statsMaxRangeDays` | `stats.max_range_days` | 统计页日期范围的上限提示 |
| `analyticsLiveMaxRangeDays` | `analytics.live_max_range_days` | 事件汇总 / 明细 / 漏斗的日期范围上限提示 |
| `abuseClusterMinFreeAccounts` | `abuse.cluster_min_free_accounts` | 多开检测的阈值输入框默认值 |
| `attributionClickRetentionDays` | `attribution.click_retention_days` | 归因点击明细页"点击记录只保留多少天"的说明 |
| `declarationRequired` | `avatar.declaration_required` | 上传声明页顶部"当前部署不要求勾选声明"的提示 |

**暂定做法：** 取不到（404、字段缺失）时，页面不做前端预检、不显示数字，只展示后端校验的错误；不写死任何数字。

### 2. `GET /api/admin/me` 加两个字段

> **状态：已回答，采用。** 响应是 `{"id","username","superAdmin","mustChangePassword","permissions","passwordMinLength"}`，`id` 是管理员 ID（字符串），强制改密码状态下 `me` 照常可调（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:39-41`）。

- `id`：管理员 ID。额度调账页要判断"申请人是不是我"，才能把"审核"按钮对自己的申请禁用（后端仍返回 403 `SELF_REVIEW_FORBIDDEN`）。
- `passwordMinLength`：`admin.password_min_length` 的当前值。强制改密码的管理员只能调 `me` 和改密码，所以放在 `me` 里。

**暂定做法：** 没有 `id` 时不禁用审核按钮，由后端的 403 兜底；没有 `passwordMinLength` 时不做长度预检。

### 3. 响应里的管理员带用户名

> **状态：已回答，采用，并扩大了范围。** 每个管理员 ID 字段旁都另给一个用户名字段（`xxxBy` 对应 `xxxByUsername`，`adminId` 对应 `adminUsername`，`applicantAdminId` 对应 `applicantUsername`，`reviewerAdminId` 对应 `reviewerUsername`）；`GET /config` 每项的 `updatedBy` 是管理员 ID，另有 `updatedByUsername`；管理员已删除时用户名为 `null`、ID 照旧；审计日志的 `adminUsername` 是写入那一刻的用户名，之后不变（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:43-49`）。

**为什么需要：** 页面要显示"谁操作的"，现在响应只有管理员 ID，运营看不懂。

**需要：** 凡是响应里表示管理员的 ID 字段，同时给一个同名加 `Username` 的字段：审计日志的 `adminUsername`；额度调账申请的 `applicantUsername`、`reviewerUsername`；照片里的人投诉的 `handledByUsername`；审核记录的 `reviewedByUsername`；推送任务和周期推送、应用版本、签到活动的 `createdByUsername`；邮件模板的 `updatedByUsername`；`GET /config` 每项的 `updatedBy` 请说明是管理员 ID 还是用户名（页面要显示用户名）。

**暂定做法：** 没有用户名字段时显示管理员 ID 的前 8 位。

### 4. 两个已有上传接口的文件字段名

> **状态：已回答，采用。** 字段名是 `file`，后台所有上传接口都是 `file`；缺少 `file`（包括传了别的字段名）→ 400 `INVALID_REQUEST`，`details` 为 `[{"ref":"file","reason":"EMPTY_NOT_ALLOWED"}]`（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:51-53`）。

`POST /uploads/image`（推送图片）和 `POST /ads/media`（广告素材）请求里的文件字段叫什么？说明里三个新上传接口是 `file`、"已有的上传不变"，契约也没写这两个的字段名（`POST /uploads/apk` 契约写了 `file`）。

**暂定做法：** `file`。

### 5. 列表和详情里能显示的图片地址

> **状态：已回答，采用。** 字段名与本条一致；这些响应不再返回 `previewRef`、`iconRef`、`sourceImageRef`；地址是短时效签名地址，有效期取 `moderation.content_url_ttl_seconds`，每次取列表都拿新地址；文件缺失时为 `null`；用户的脸每次调用写一条审计日志（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:55-61`）。

**为什么需要：** 响应按 17.4 通则只有 `previewRef`、`iconRef`、`sourceImageRef` 这类存储引用，浏览器不能直接显示。

**需要：** 在下面这些响应里加能显示的地址字段（短时效签名地址或公开地址，规则同审核内容的地址）：服装 / 背景目录的 `previewUrl`；动作目录的 `iconUrl`；默认数字人的 `sourceImageUrl` 和它的外观预览 `previewUrl`；`GET /accounts/{id}/avatars` 里每个外观的 `previewUrl`（用户的脸，仍写审计日志）。

**暂定做法：** 没有这些字段时列表显示占位图，不拼地址。

### 6. 默认数字人生成失败是什么状态

> **状态：已回答，采用。** 失败后回到 `DRAFT`，行里带 `failureReason`（六个值之一或 `null`），没有 `FAILED` 状态，点“生成”重试并清空原因（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:63-67`）。

说明里的状态链是 `DRAFT` → `GENERATING` → `READY` → 生效，没有写生成失败。失败后是回到 `DRAFT`、还是有单独的状态？运营怎么重试？失败原因放在哪个字段？

**暂定做法：** 失败后回到 `DRAFT`，行里带 `failureReason`，再点"生成"重试；前端按"状态加可选的失败原因"画，不假设有 `FAILED`。

### 7. 封禁、解封接口的权限码

> **状态：已回答，采用。** `POST /users/{id}/ban` 和 `/unban` 需要 `USER:BAN`，读取 `USER:VIEW`，发起和取消账号删除 `USER:DELETION`（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:69-71`）。

契约 17.4 用户管理行里 `USER:BAN` 只出现在模块的权限码列表里，没有标在 `POST /users/{id}/ban` 和 `POST /users/{id}/unban` 上。是 `USER:BAN` 吗？

**暂定做法：** `USER:BAN`。

### 8. 规则词表 `PUT /moderation/text-rules` 的请求体

> **状态：已回答，采用整表替换，三处与本条的暂定做法不同。** 请求体是 `{"items":[…]}` 不是裸数组（`GET` 的响应也是 `{"items":[…]}`，两个方法都要 `MODERATION:CONFIG`）；校验失败时 `details` 的 `ref` 一律是元素在请求数组里的下标（不用规则 `id`）；正则不合法的原因码是 `INVALID_PATTERN`（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:73-77`）。

契约 11.2 说词表是数组，每条 `{id, pattern, matchMode, level, note}`，`id` 保存时生成，但没写 `PUT` 的请求体是整个数组替换，还是逐条增删改。

**暂定做法：** 整表替换：请求体是整个数组，新增的条目不带 `id`；校验失败时 `data.details` 用规则 `id`（新增的用下标）指到行。

### 9. 下拉选项的来源接口的权限

> **状态：已回答，四组全部采用，另加三处。** 共七个接口：`GET /roles`（另允许 `ADMIN:MANAGE`）、`GET /cosmetics`（`COSMETIC:GRANT`）、`GET /attribution/campaigns`（`ATTRIBUTION:VIEW`）、`GET /ads/campaigns`（`ADS:UNIT`、`ADS:CREATIVE`）、`GET /ads/placements`（`ADS:UNIT`）、`GET /ads/units`（`ADS:CREATIVE`）、`GET /entitlement-defs`（`SUBSCRIPTION:GRANT`）；只开放读取，“遇到 403 时选择器禁用”的做法保留作兜底（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:79-93`）。

页面权限和选项来源接口的权限不同，持有页面权限的管理员收到 403，选择器没法用：

| 页面（权限） | 选项来源接口（现在的权限） | 提议 |
|---|---|---|
| 管理员表单的角色多选（`ADMIN:MANAGE`） | `GET /roles`（`ROLE:MANAGE`） | 另允许 `ADMIN:MANAGE` |
| 用户详情"赠送服装"的条目选择（`COSMETIC:GRANT`） | `GET /cosmetics`（`COSMETIC:MANAGE`） | 另允许 `COSMETIC:GRANT` |
| 投放效果和归因明细的投放账户筛选（`ATTRIBUTION:VIEW`） | `GET /attribution/campaigns`（`ATTRIBUTION:MANAGE`） | 另允许 `ATTRIBUTION:VIEW` |
| 广告单元表单的计划和广告位（`ADS:UNIT`） | `GET /ads/campaigns`（`ADS:CAMPAIGN`）、`GET /ads/placements`（`ADS:PLACEMENT`） | 另允许 `ADS:UNIT` |

**暂定做法：** 遇到 403 时选择器禁用，并写明"需要某某权限才能列出选项"，不崩溃。

### 10. 越界时返回什么

> **状态：已回答，采用。** 都是 400 `INVALID_REQUEST`：`pageSize` 超过 200、小于 1、不是整数，`page` 小于 1 或不是整数，`details` 为 `[{"ref":"pageSize","reason":"OUT_OF_RANGE"}]`（不是整数时 `NOT_AN_INTEGER`），不静默截断；`/stats/*` 跨度超过 `stats.max_range_days` 和 `/analytics/*` 超过 `analytics.live_max_range_days` 同样 400（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:95-98`）。

- 列表的 `pageSize` 超过 200；
- 统计报表（`/stats/*`）的 `from`、`to` 跨度超过 `stats.max_range_days`（归因汇总说明里已写 400，其余没写）。

**暂定做法：** 400 `INVALID_REQUEST`；前端不依赖具体状态码，只展示后端文字。

### 11. 管理端字段的长度单位

> **状态：已回答，采用。** 先按契约 1.9 去首尾空白，再按 Unicode 码点计长度（不是 UTF-16 长度，也不是字素）；去空白后为空的必填字段 400；存的是去空白后的值（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:100-102`）。

契约对管理端字段（封禁理由 1–500、删除理由 1–200、通知标题 100 / 正文 500、任务说明 500、邮件标题 1–200、规则文本 1–200 等）只写"字符"；只有人格设定、伴侣名字、举报详情、反馈正文、`generationSpec` 明写 Unicode 码点。请说明这些是否都按码点数。

**暂定做法：** 都按码点数，首尾空白按契约 1.9 的 29 个码点去掉。

## 二、响应字段只用一句话描述的接口（20 行，全部已回答）

契约 17.4 开头说"响应字段即第十八节对应实体的字段"，下面这些接口的响应不是单一实体的列，契约和说明里也没有给字段名。请给出字段名，或者说明"就是实体的列加某某"。右列是页面显示需要的内容（来自管理端前端设计的页面描述）。

| 接口 | 页面需要的内容 |
|---|---|
| `GET /client-config` | 每个键：键、说明、类型、是否按语言区分、是否已配置、客户端使用点、各语言的当前值 |
| `GET /entitlement-defs` | 每个权益：key、名称、priority、每个功能开关的配置（`VALUE` / `UNLIMITED` / `UNSET` 加值） |
| `GET /feature-gates` | 每个开关：key、类型、范围、默认值的三种状态（具体值 / 不限 / 未配置）、额度单价、说明 |
| `GET /subscriptions/{id}` | 订阅的列，加事件时间线（类型、子类型、商店事件时间、接收时间、处理时间、错误） |
| `GET /accounts/{id}/entitlements` | 每个功能开关的生效值和来源；限时权益的列表（用于撤销） |
| `GET /accounts/{id}/credits` | 余额、累计获得、累计消耗、流水（变动、原因、关联购买、消费类别、功能、条目、数量、备注、时间） |
| `GET /users/{id}` | 资料、状态、封禁信息、养成数据、资产数量、外观数量、归因字段（契约已点名的 `companionName`、`banReason`、`bannedAt` 之外的字段名） |
| `GET /accounts/{id}/avatars` | 形象（含名字）、外观（风格、状态、预览、创建时间）、拥有的服装（含来源 `source`） |
| `GET /users/{id}/devices`、`/auth-events` | 设备：平台、App 版本、最近活跃、令牌末 6 位；认证事件：类型、原因、设备和 IP 哈希前 8 位、时间 |
| `GET /abuse/clusters/accounts` | 账号 ID、创建时间、状态、是否付费、注册方式 |
| `GET /invites/codes`、`/invites/records` | 邀请码：所有者、创建时间；记录：邀请人和被邀请人的掩码标识、兑换时间、奖励状态、不符合原因、已发额度 |
| `GET /attribution/clicks`、`/campaigns` | 点击：状态（待认领 / 已匹配 / 已过期）、渠道、UTM、IP（掩码）、认领时间；投放账户：Facebook 访问令牌"是否已设置"的字段名、关联渠道包 |
| `GET /usage/prices`、`/usage/price-batches/pending`、`/usage/models` | 按模型和批次分组的档位；待审批次与当前生效批次的逐档对比；模型是否有生效价格 |
| `GET /analytics/funnel`、`/event-names`、`/event-summary` | 每步的去重人数和相邻转化率；事件名列表；事件名、`pv`、`uv` |
| `GET /email/templates` | 模板编码、标题、正文、默认标题和正文、是否改过、最后修改人和时间 |
| `GET /admins`、`/roles` | 管理员：角色列表（ID 和名称）；角色：权限码列表 |
| `GET /notifications`、`/notifications/{id}` | 列表的标题（`en`）；详情的全部语言标题和正文、模板键和参数 |
| `GET /checkin/activities/{id}`、`/checkin/records`、`/tasks/records` | 活动的奖励阶梯；记录里的活动名称、任务名称（页面不显示数字 ID） |
| `GET /ads/report/by-*`、`/ads/report/nofill` | 行的维度名称（广告位、计划、素材、国家）；无广告原因行的 `platform`（汇总表主键里有，说明里的返回字段漏了） |
| `GET /likeness-complaints/{id}` | 投诉的列、处理记录、证据文件个数 |


### 回复对照（20 行）

> 后端的回复按 19 条编号（`GET /entitlement-defs` 和 `GET /feature-gates` 合在第 2 条里），本表按本文件的 20 行逐行对照。通则（`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:106`）：响应字段用第十八节实体的列名一字不差、驼峰；`id` 和外键是字符串；时刻是 ISO-8601 UTC；列表是 `{"items":[…],"total":N}`；不返回以 `Hash`、`Enc` 结尾的列、`tokenVersion`、`totpLastStep` 和被签名地址替代的存储引用；每个点名了字段的接口，后端都有断言“字段集合恰好等于这里写的”的测试。

| 接口 | 状态 | 回复里的位置（行号） |
|---|---|---|
| `GET /client-config` | 已回答 | 108 |
| `GET /entitlement-defs` | 已回答 | 110 |
| `GET /feature-gates` | 已回答 | 111 |
| `GET /subscriptions/{id}` | 已回答 | 113 |
| `GET /accounts/{id}/entitlements` | 已回答 | 115 |
| `GET /accounts/{id}/credits` | 已回答 | 117 |
| `GET /users/{id}` | 已回答 | 119 |
| `GET /accounts/{id}/avatars` | 已回答 | 121 |
| `GET /users/{id}/devices`、`/auth-events` | 已回答 | 123–124 |
| `GET /abuse/clusters/accounts` | 已回答 | 126 |
| `GET /invites/codes`、`/invites/records` | 已回答 | 128–129 |
| `GET /attribution/clicks`、`/campaigns` | 已回答（“是否已设置”的字段名是 `facebookAccessTokenSet`） | 131–132 |
| `GET /usage/prices`、`/usage/price-batches/pending`、`/usage/models` | 已回答（价格一律是字符串形式的十进制数；但同一条里 `unitPrice` 一处写“是数”、一处写“字符串”，见第二部分 2.13 第七条） | 134–136 |
| `GET /analytics/funnel`、`/event-names`、`/event-summary` | 已回答 | 138 |
| `GET /email/templates` | 已回答（`placeholders`、`requiredPlaceholders` 每项带花括号，见下面第 12 条） | 140 |
| `GET /admins`、`/roles` | 已回答 | 142 |
| `GET /notifications`、`/notifications/{id}` | 已回答 | 144 |
| `GET /checkin/activities/{id}`、`/checkin/records`、`/tasks/records` | 已回答 | 146 |
| `GET /ads/report/by-*`、`/ads/report/nofill` | 已回答；**这一点不采用**：无广告原因行不加 `platform`、`channelCode`（后端说明的后来版本已写，契约会话已同意把管理端设计里的“平台”列删掉） | 148 |
| `GET /likeness-complaints/{id}` | 已回答 | 150 |

**暂定做法：** 前端按契约 §18 的实体列和页面描述定义类型，字段名和上表不一致处，后端回复后我们改。


## 三、回话文件里追加的一条（`2026-10-21-admin-frontend-ack.md`）

### 12. 邮件模板的 `placeholders`、`requiredPlaceholders`：每项带不带花括号

> **状态：已回答。** 每一项都带花括号，和模板正文里写的完全一样（例如 `["{code}","{minutes}","{appName}"]`、必含 `["{code}"]`）；后端保存时的必含检查就是“正文里含这个带花括号的字符串”，区分大小写，缺了任何一个必含项 `PUT` 返回 400 `INVALID_REQUEST`；前端也用数组里的原样字符串在正文里找，“比较前去掉花括号”的暂定做法去掉（`docs/backend-inputs/2026-10-21-avatar-backend-reply-2-to-avataradmin.md` 第 6–14 行）。

问：`GET /email/templates` 每项的 `placeholders`（可用）和 `requiredPlaceholders`（必须含）是 `"{code}"` 这种带花括号的，还是 `"code"` 这种只有名字的？我们为什么需要：编辑页要检查正文是否含有必含的占位符。暂定做法：比较前去掉两端的花括号，两种写法都识别。

---

# 第二部分：执行中新发现的、后端或契约负责人必须回答的问题

> **范围：** 管理端前端 32 个任务执行中写下的 25 份问题文件（`docs/contract-requests/2026-10-26-admin-frontend-*.md`），逐份读完、合并重复、按模块分组。那 25 份文件和这份文件的第一部分、`2026-10-21-admin-frontend-ack.md` 一起，是 `docs/contract-requests/` 里的全部 27 份。原文件保持原样不改，以这份为准。
> **怎么数：** 一条问题 = 一个接口或字段上要后端（或契约负责人）回答的一件事；同一件事在几份文件里出现只算一条，在"来源"里列全。原文里的子问题（例如"请求体里 A、B 两个字段是不是必填"）放在同一条里，不拆开数。
> **状态：** 这一部分的问题都还没有交给后端，所以"状态"一律是"未回复"。核对现有的后端回复（`docs/backend-inputs/` 四份）和契约快照后，有一部分已经被回答，它们不算新问题，单列在本部分末尾的表里（"已被现有回复回答的部分"）。
> **每条的写法：** 问什么；为什么需要；暂定做法（前端在后端回复之前现在的做法，回复后改前端）；来源。"来源"里的 `xxx.md` 是 `docs/contract-requests/2026-10-26-admin-frontend-xxx.md` 的简写，"§"后是该文件的节号。【安全】标记的是和权限、凭据、隐私有关的条目，它们同时列在文件最前面。
> **没有一条阻塞：** 每条都有能继续的最小做法（`CLAUDE.md`：契约的缺口不是阻塞）。

## 2.1 登录与权限（4 条）

- **`GET /api/admin/permissions` 的响应形状和节点字段。** 问：`data` 是不是 `{"items":[节点…]}`（平铺、不分页、按 `sortOrder` 升序，用 `parent` 指向父节点的 `code`）？`MENU` 节点的 `parent` 是 `null` 吗？每个节点是不是 `code`、`parent`、`type`、`sortOrder`、`nameZh`、`nameEn`、`builtin`、`createdByUsername`？为什么：角色编辑页的权限树选择、权限树管理页都读它，`POST/PUT /permissions` 的请求体和删除时的 409 `PERMISSION_HAS_CHILDREN` 也要同一套字段。暂定：按上面的形状；页面只读契约写明的七个字段，`builtin` 不是 `false`（含缺失）的节点一律按内置处理（不删除、不改父节点）。来源：`auth-and-permissions.md` §一、`system.md` 三.5。
- **`POST /api/admin/auth/change-password` 失败时返回什么。** 问：旧密码错是不是 401 `ADMIN_INVALID_CREDENTIALS`（不能是 401 `ADMIN_INVALID_TOKEN`，那个会让前端回登录页）？新密码太短、与用户名相同是不是 400 `INVALID_REQUEST`，`details` 的 `ref` 是 `newPassword`，`reason` 用哪个代码（"太短"最接近 `OUT_OF_RANGE`，"与用户名相同"没有合适的代码）？长度按码点还是 UTF-16 单位？为什么：改密码页要把错误放到对应输入框旁，"旧密码错"和"新密码不合规"文字不同。暂定：旧密码错 401 `ADMIN_INVALID_CREDENTIALS`；新密码太短或等于用户名 400 `INVALID_REQUEST`，`details` 为 `[{"ref":"newPassword","reason":"OUT_OF_RANGE"}]`；长度按码点；前端提交前按 `GET /me` 的 `passwordMinLength` 自己也检查。来源：`auth-and-permissions.md` §二。
- **【安全】验证码锁定（`admin.totp_max_failures`）的响应。** 问：第 5 次错误验证码本身返回 401 `ADMIN_TOTP_INVALID`、之后才是 429 `RATE_LIMITED`，还是第 5 次就是 429？这个 429 带不带 `data.retryAfterSeconds`（契约 §1.4 写其他限流的 429 没有 `data`）？锁定期间密码错的登录返回 429 还是 401 `ADMIN_INVALID_CREDENTIALS`？绑定（`enroll`）一步超过次数后返回 429 还是 401 `ADMIN_INVALID_TOKEN`？为什么：登录页要决定显示"请 N 分钟后再试"还是通用的"请求过于频繁"；锁定期间对错误密码返回不同状态码会让攻击者区分密码对错。暂定：第 5 次错误就返回 429 且带 `data.retryAfterSeconds`；锁定期间不论密码对错都返回 429；`enroll` 超过次数时第 5 次返回 429、令牌作废，之后同一令牌返回 401 `ADMIN_INVALID_TOKEN`；前端读 `retryAfterSeconds`，没有时显示通用文字。来源：`auth-and-permissions.md` §三。
- **权限树里几个码的父节点和类型。** 问：后端实际写入的父节点是什么：`COSMETIC:GRANT` 是 `COSMETIC:MANAGE` 的子节点还是 `USER:VIEW` 的；`STATS:EXPORT`、`STATS:LAND` 是 `STATS:VIEW` 的子节点还是各自页面的；`SUBSCRIPTION:CONFIG` 既是"额度包"页的页面权限又是权益定义、功能开关、商品映射三页的保存权限，它是 `MENU` 还是 `FUNCTION`？为什么：角色编辑页"勾选父节点同时勾选全部子节点"的行为取决于它。暂定：假后端把这几个码挂在同领域的页面下（`COSMETIC:GRANT` → `COSMETIC:MANAGE`，`STATS:EXPORT`、`STATS:LAND` → `STATS:VIEW`），`SUBSCRIPTION:CONFIG` 是 `MENU`；前端不写死任何父子关系，全部读 `GET /permissions` 的 `parent`。来源：`auth-and-permissions.md` §四。

## 2.2 系统管理：管理员、角色、权限树、审计日志（18 条）

- **【安全】非超级管理员能不能对超级管理员重置密码和二次验证（任务 31 评审发现）。** 问：持有 `ADMIN:MANAGE` 但不是超级管理员的人，可以对超级管理员重置密码和二次验证，再自己登录并绑定验证器，等于接管超级管理员账号。后端对"非超级管理员操作超级管理员账号（重置密码、重置二次验证、停用、删除、改角色）"是否一律返回 403？错误码是什么？契约 §17.4 没有写这种情况。为什么：这是权限提升路径。暂定：页面不改动，按钮的显示只看权限码和"自己"的保护，后端是最终裁决；如果负责人希望前端也挡一层（对超级管理员那一行，非超级管理员看不到这些按钮），这是新增行为，要先确认。完整的契约变更请求见第四部分第 2 条。来源：`system.md` "补充"一节、`task-31-review.md`。
- **拒绝"改自己的角色和 `superAdmin`""停用或删除自己""最后一个启用的超级管理员被停用、删除、清除标志"时返回什么错误码。** 问：契约只写"不能"，错误码表里没有对应的码。为什么：界面在错误码已知时只显示译文，需要码。暂定：针对自己的拒绝 403 `ADMIN_FORBIDDEN`，针对最后一个超级管理员的拒绝 409 `INVALID_STATE`（`data.status` 是当前状态）；这两个码的译文只说"没有权限"和"状态不允许"，所以页面在这两种拒绝后面加一句固定的话。请求给专用的错误码（例如 `ADMIN_SELF_PROTECTED`、`LAST_SUPER_ADMIN`），前端加译文后去掉那句固定的话。来源：`system.md` 一.1、`task-31-report.md`。
- **`PUT /admins/{id}` 的请求体：哪些字段可省略。** 问：缺省字段表示"不改"而不是"清空"吗？`username` 需要带吗？为什么：读不到角色列表时，发 `roleIds: []` 会拿走全部角色。暂定：不发 `username`；只发有改动的 `roleIds`（整体替换）和 `superAdmin`；管理员自己的那一行一个都不发；不是超级管理员的人不发 `superAdmin`；读不到角色列表时不发 `roleIds`。来源：`system.md` 一.2。
- **自己的行带了 `roleIds` 或 `superAdmin` 时（即使值没变）是否一律拒绝。** 暂定：假后端按"带了就拒绝"做。来源：`system.md` 一.3。
- **【安全】`POST /admins`、`PUT /admins/{id}`、`POST …/status`、重置密码、重置二次验证、删除的响应形状，以及响应里从不出现密码。** 问：创建和修改是否返回一行 `GET /admins` 里的那种对象，状态、重置密码、重置二次验证、删除返回 `null`？后端从不在响应里返回密码或临时密码吗（契约规定密码由创建者设置，没有"生成初始密码"的接口）？为什么：页面没有"显示一次的密码"对话框，如果后端返回了密码，页面不会处理也不会隐藏。暂定：如上；页面只用响应判断成功，不读任何密码字段。来源：`system.md` 一.4。
- **管理员用户名和密码的规则、创建和重置时 400 的 `ref`。** 问：用户名的长度和字符有没有限制？创建时密码问题的 `ref` 是 `password`、重置时是 `newPassword`、用户名是 `username`、角色是 `roleIds` 吗？为什么：表单要把错误放到对应输入框。暂定：页面只检查用户名去首尾空白后不为空；密码按 `GET /me` 的 `passwordMinLength`（码点数）、不得与用户名相同、两次输入一致检查。来源：`system.md` 一.5。
- **`DUPLICATE_RESOURCE` 的 `data.field` 取值。** 问：管理员重名是 `username`、角色重名是 `name`、权限节点码重复是 `code` 吗？为什么：页面把译文放到同名的表单项下面。暂定：如上；不认识的 `field` 只显示在对话框底部。来源：`system.md` 一.6、二.1。
- **角色 `PUT /roles/{id}` 的请求体和名称规则。** 问：整体替换，总是发完整的 `name`、`remark`、`permissionCodes`，`remark` 空时发 `null`，`permissionCodes` 可以是空数组；名称唯一，大小写是否敏感；名称和备注的长度上限。暂定：整体替换；名称去首尾空白后不能为空；假后端大小写不敏感；页面不限制长度。来源：`system.md` 二.1。
- **自定义权限节点的码能不能放进角色的 `permissionCodes`。** 问：契约 §17.3 写能，"给角色分配不存在的权限码 400"，请确认"存在"包含自定义节点。暂定：页面允许勾选自定义节点和真实权限码清单里的码，不允许勾选"标成内置但页面码清单里没有"的节点。来源：`system.md` 二.2。
- **权限树 `POST`、`PUT` 的请求体和不可改的字段。** 问：创建 `{code, parent, type, sortOrder, nameZh, nameEn}`（根节点 `parent` 为 `null`）；修改 `{nameZh, nameEn, sortOrder}`，自定义节点改父节点时另带 `parent`；`code` 和 `type` 创建后确实不能改吗？暂定：内置节点永远不带 `parent`；`code`、`type` 不在修改请求里。来源：`system.md` 三.1。
- **权限节点的码、名称、排序的限制。** 问：码的格式和长度、名称长度、`sortOrder` 的范围。暂定：页面要求码去首尾空白后不为空、不含空白、控制字符或格式字符（含零宽和双向控制）、至多 100 个码点；名称不为空；排序是整数。来源：`system.md` 三.2。
- **把节点移到自己或自己后代下面（成环）时返回什么。** 暂定：400 `INVALID_REQUEST`，`details` 为 `[{ref:'parent', reason:'OUT_OF_RANGE'}]`；页面的父节点选项里本来就没有自己和后代，正常使用碰不到。来源：`system.md` 三.3。
- **改内置节点的父节点、删除内置节点时返回什么。** 暂定：改父节点 400 `INVALID_REQUEST`（`ref: 'parent'`），删除内置节点 409 `INVALID_STATE`；页面不提供这两个操作。来源：`system.md` 三.4。
- **审计日志 `GET /audit-logs` 的 `from`、`to` 格式。** 问：ISO-8601 时刻（UTC），`from` 含、`to` 不含吗？暂定：页面把所选的 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，页面注明 UTC。来源：`system.md` 四.1。
- **审计日志 `adminId`、`action`、`targetType`、`targetId` 是精确匹配吗，能否给 `action`、`targetType` 的取值清单。** 为什么：有清单页面可以做成下拉。暂定：都是精确匹配，页面只去首尾空白，自由输入。来源：`system.md` 四.2。
- **【安全】审计日志 `detail` 的类型，以及它里面从不写密码、令牌、验证码、凭据。** 问：`detail` 是字符串还是 JSON？请确认 `detail` 从不含密码、令牌、验证码、凭据（契约写 `detail` 只记改动的字段名和新旧值）。为什么：审计页面会把它展示给所有持有 `AUDIT:VIEW` 的人。暂定：页面当作"类型不定"，字符串原样显示，对象和数组写成 JSON；另外把键名带 password、secret、token、credential、authorization、apikey、cookie、signature、totp 的值，和文字里"password=…""token: …"这样的写法显示成 `********`，是第二道防线，不是对后端要求的替代；页面不把任何行写进日志。来源：`system.md` 四.3。
- **审计日志 `adminUsername` 为 `null` 的行，以及改名后用 ID 过滤。** 问：管理员过滤用的是 ID，改名后仍能筛到旧行吗？暂定：页面显示管理员 ID 的前 8 位；已删除或改名的行显示写入时的名字（后端回复第 3 条已定"审计日志存写入时的用户名"）。来源：`system.md` 四.4。
- **只有 `AUDIT:VIEW`、没有 `ADMIN:MANAGE` 的管理员怎么按"管理员"筛选。** 问：能否给一个只读的管理员名单接口（只含 `id`、`username`）？暂定：这类管理员输入管理员 ID，没有下拉。来源：`system.md` 四.5。

## 2.3 渠道包与应用版本（18 条）

- **`GET /channels` 的响应形状和字段名。** 问：`data` 是 `{"items":[…]}` 还是裸数组？分页吗？字段名是契约 §24.7 `Channel` 实体列 `code`（后端回复通则也写"响应字段用第十八节实体的列名，一字不差"），还是 `channelCode`？有没有 `updatedAt`？为什么：所有统计页、广告报表、目录、投放账户的"渠道包"下拉都读它，渠道包管理页也读；字段名不对，下拉会是空的。暂定：提交 0201f1c 起前端读契约的列名 `code`（之前任务 9 的读取按 `channelCode`，对遵守契约的后端所有渠道筛选都是空的）；不分页；两种外层形状都接受；假后端只给 `code`。来源：`stats-and-channels.md` 一、`app-versions.md` 一.1、一.2。
- **`POST /channels` 的请求体和响应。** 暂定：请求体 `{code, name, platform, distribution, packageName}`，`packageName` 为空时发 `null`；创建后默认启用（不发 `enabled`）；响应不读，成功后重新读列表。来源：`app-versions.md` 一.3。
- **`PUT /channels/{code}` 是整条替换还是只改带来的字段；只发 `{"enabled":false}` 行不行。** 为什么：整条替换会用页面上一次读到的值覆盖别人刚改的名称。暂定：每次都发 `name`、`packageName`、`enabled` 三个字段（两种理解都行）。来源：`app-versions.md` 一.4。
- **渠道名称、包名的长度和格式。** 暂定：名称不限长度（去首尾空白后不为空）；包名可空，不空时只收字母、数字、点、连字符、下划线。请给真实上限和包名规则。来源：`app-versions.md` 一.5。
- **渠道包写接口的错误细节。** 问：渠道码重复是 409 `DUPLICATE_RESOURCE`、`data.field = "code"`；渠道码是 `unknown`、格式不对、`IOS` 加 `DIRECT` 是 400，`details` 的 `ref` 分别是 `code`、`code`、`distribution`；要改渠道码、平台、分发方式时 400 的 `ref` 是被改的字段，请确认 `ref` 和原因码。为什么：页面不显示后端 `message`，只显示错误码和原因码的译文。来源：`app-versions.md` 一.6。
- **`GET /app-versions` 是否分页、`data` 的形状。** 暂定：前端发 `page`、`pageSize`（10、20、50、100）；读到 `{items,total}` 就用后端的页，读到裸数组或没有 `total` 就在浏览器里切页。来源：`app-versions.md` 二.1。
- **版本行里有哪些字段。** 问：列表行和详情里有没有 `apkUrl`、`apkSizeBytes`、`apkSha256`（契约说 `apkUrl` 不存、由 `apkUploadId` 拼出，但列表要显示文件大小和 SHA-256 前 8 位）？`changelog` 是不是以语言代码为键的对象？（`createdByUsername`、`activatedByUsername` 已由后端回复第 3 条回答。）暂定：行里有这三个字段，商店渠道三者为 `null`，直装渠道的 `storeUrl` 为 `null`。来源：`app-versions.md` 二.2。
- **某渠道当前生效版本怎么读。** 问：页面用 `GET /app-versions?channelCode=<码>&status=ACTIVE` 读，取其中 `status=ACTIVE` 且 `channelCode` 相同的一行，只当提示，这样读对吗（需要 `APPVERSION:VIEW`）？来源：`app-versions.md` 二.4。
- **版本的写请求体。** 暂定：创建 `{channelCode, versionName, versionCode, minVersionCode, changelog, storeUrl 或 apkUploadId}`；商店渠道只带 `storeUrl`，直装渠道只带 `apkUploadId`，不带 `apkUrl`、`apkSizeBytes`、`apkSha256`；`changelog` 去掉了空白的语言；修改同样不带 `channelCode`；编辑直装草稿没换文件也带当前 `apkUploadId`；`PUT …/status` 是 `{status, confirmStoreLive?}`，只有商店渠道激活时带 `confirmStoreLive: true`；响应不读。请确认。来源：`app-versions.md` 三.1。
- **`versionCode`、`minVersionCode` 的上限。** 问：契约只写整数、≥ 1，上限是 Java 的 `int`（2147483647）还是别的？暂定：页面接受 1 到 2^53−1。来源：`app-versions.md` 三.2。
- **更新说明（`changelog`）的限制。** 问：每种语言的长度上限；非 `supportedLocales` 的语言代码后端收不收。暂定：页面不限制长度和语言个数，语言代码取 `GET /meta` 的 `supportedLocales` 加英文加这条版本已有的。来源：`app-versions.md` 三.3。
- **字段错误怎么指到字段。** 问：400 `INVALID_REQUEST` 的 `data.details` 里 `ref` 是否用请求体的字段名：`versionName`、`versionCode`（不大于生效版本时）、`minVersionCode`、`storeUrl`、`changelog`（缺 `en`）、`apkUploadId`、`confirmStoreLive`（商店渠道激活没带）、`channelCode`（渠道不存在）；`reason` 用语言文件里已有的码；`storeUrl` 不符合安卓或 iOS 规则时给一个专用原因码。为什么：页面不显示后端 `message`。暂定：提交前自己检查并给出具体原因，后端拒绝时只能显示"输入内容不合法"。来源：`app-versions.md` 三.4。
- **激活直装渠道版本时文件校验失败怎么告诉运营。** 问：请给 `details`（`ref` 是 `apkUploadId`，`reason` 是"文件不存在"或"校验和不一致"的专用码）。暂定：只显示 `INVALID_REQUEST` 的译文。来源：`app-versions.md` 三.5。
- **409 `INVALID_STATE` 有几种原因怎么区分。** 问：版本不是草稿、渠道已停用、上传记录已被别的版本使用，都是 409 `INVALID_STATE`；请给 `data.status` 一个确定的取值（例如渠道停用 `CHANNEL_DISABLED`、上传已使用 `UPLOAD_USED`），或在 `details` 里给 `ref`。暂定：请求带了新上传的文件时，409 且 `data.status` 不是版本状态，就提示重新上传，同时显示 409 的译文。来源：`app-versions.md` 三.6。
- **`(channelCode, versionCode)` 重复。** 问：是 409 `DUPLICATE_RESOURCE`、`data.field = "versionCode"` 吗？它先于还是晚于"不大于生效版本"的检查？暂定：如此，页面把译文放到版本号字段下面。来源：`app-versions.md` 三.7。
- **商店链接检查用的包名。** 问：契约写安卓链接的 `id` 等于环境变量 `GOOGLE_PLAY_PACKAGE_NAME`，页面只知道渠道包的 `packageName`（`play` 预置行由同一个环境变量填，但运营可以改）；后端用的是哪一个？如果以环境变量为准，请把它放进 `GET /meta`（不含机密）。暂定：用所选渠道包的 `packageName` 对照；渠道没有包名时只检查 `id` 像不像应用包名。来源：`app-versions.md` 三.8。
- **iOS 商店链接的形状。** 问：契约写主机 `apps.apple.com`、路径 `/<国家码>/app/<名称>/id<数字>` 或 `/app/id<数字>`，并说没有核实；后端收不收 `/us/app/id<数字>`（没有名称）和带查询参数（如 `?l=th`）的链接？暂定：严格按契约两种路径，查询参数和片段不限制。来源：`app-versions.md` 三.9。
- **APK 缺 v2 以上签名时的专用原因码。** 问：规格 5.19 写"显示后端的错误原因"，而已定的规则是错误码已知时只显示译文，`INVALID_FILE` 只有一条"文件为空、超出大小限制或类型不支持"。请在缺签名时给 `details: [{"ref":"file","reason":"<专用码>"}]` 并告诉我们码。暂定：上传区旁常驻一句"文件必须带 v2 及以上的签名"，失败时显示 `INVALID_FILE` 的译文。来源：`app-versions.md` 四.1、`task-29-report.md`。

## 2.4 统计报表：共用、日报、留存、游客、总览（8 条）

- **`stats.max_range_days` 的"跨度"怎么数。** 问：10 月 1 日到 10 月 31 日，跨度是 31（含两端的天数）还是 30（两端日期之差）？（越界返回 400 `INVALID_REQUEST` 已由后端回复第 10 条回答。）为什么：日期范围选择器在超限时提示、不发请求；差一天会多拒绝一个后端接受的范围，或多放行一个后端会返回 400 的范围。暂定：前端和假后端都按"含两端的天数"计，天数大于上限就拒绝（保守的一侧）。来源：`stats-and-channels.md` 二。
- **`/stats/daily` 范围内某天没有汇总行（含当天还没落地）时，是不返回这一行，还是返回各列为 0 或 `null` 的行。** 为什么：趋势图要补满范围内每一天；总览的六张卡片以"今天"的值为当前值，没有这一行时应显示"—"（不知道）而不是 0（今天真的没人）。暂定：没有行的日子在趋势图补 0；行里为 `null` 的列在图里按 0 画、在表格里显示"—"；今天没有行，或某列是 `null`，卡片显示"—"，不标"临时值"，较昨日、较 7 天前也显示"—"，趋势图今天这一点留空；今天的行里某列是真正的 0 则显示 0。来源：`stats-and-channels.md` 三、`dashboard.md` 一。
- **补数 `retention` 和 `reactivation` 各覆盖哪些行。** 问：`POST /stats/land/retention?date=D` 是否一次把 `ACTIVE` 和 `CALL` 两种类型、所有平台和渠道的格子都填了？`POST /stats/land/reactivation?date=D` 是否三个沉默天数（7、14、30）都重算？为什么：留存页的两个页签共用一个落地条；如果只填一种，运营点了"重新落地该日"却看不到另一个页签变化，页面需要两个按钮。暂定：按"都填"处理，落地条在两个留存页签上是同一个，成功后重新读当前页签；回流页签同理。来源：`daily-retention.md` 一。
- **留存、回流、游客日报、转化进度、游客留存范围内某天没有汇总行时的返回。** 问：`/stats/retention`、`/stats/reactivation`、`/stats/guest/daily`、`/stats/guest/cohort`、`/stats/guest/retention` 在某个 cohort 日或统计日没有汇总行时，是不返回这一天，还是返回 `cohortSize`/`silentUsers` 为 0、各格为 `null` 的行？为什么：矩阵里补出一行"人数 0"会被读成"那天没有注册"。暂定：留存矩阵和游客的三张表只显示后端返回的行，不补行；回流的图补满范围内每一天（没有行的日子人数按 0，回流率留空档不是 0%），回流表只显示后端返回的行。来源：`daily-retention.md` 二、`guest-stats.md` 二。
- **`activeSubscriptionsBackfilled` 在没有快照的日子是 `null` 还是 `false`。** 为什么：日报的"有效订阅"列在值带"回填"标记时要读这个标志；契约只写 `activeSubscriptions` 当天和缺失的日子为 `null`。暂定：只在 `activeSubscriptions` 是数字且标志为 `true` 时标"回填"；标志为 `null`、`false` 或缺失都当作"不是回填"，值为 `null` 一律显示"—"。来源：`daily-retention.md` 三。
- **昨天 cohort 的 `d1` 什么时候有值，是不是临时值。** 问：今天第一次落地之前，昨天 cohort 的 `d1` 是 `null` 还是 0？今天落地之后、今天结束之前，它是不是临时值？为什么：总览的 D1 卡取 `ACTIVE` 类型里最新一个 `d1` 非空的 cohort；如果落地前返回 0 而不是 `null`，会显示"0%"被读成"昨天注册的人一个也没回来"。暂定：`d1` 为 `null` 才算没有值，0 是真的 0；`cohortDate` 加一天等于今天（UTC）的那个 cohort 的 `d1` 标"临时值"，更早的不标。来源：`dashboard.md` 二。
- **游客额度配置为 0 时 `configuredTotalSeconds` 返回 0 还是 `null`。** 问：把 `guest.call_minutes_total` 明确设成 0 和没配置，在后端是不是同一种状态？为什么：额度使用页签的第一张卡片，`null` 显示"未配置，游客不能通话"，0 显示"0 分钟"。暂定：`null` 显示"未配置，游客不能通话"，0 显示"0 分钟"，不把 0 当作未配置。来源：`guest-stats.md` 一。
- **游客留存能不能按 `unknown` 平台查。** 问：契约写 `/stats/daily?platform=unknown` 可查，`/stats/guest/retention?platform=unknown` 是否同样可查？为什么：能查，运营才能看出平台缺失的那部分设备留得怎么样。暂定：前端只提供 `ALL`、`ANDROID`、`IOS` 三个选项。来源：`guest-stats.md` 三。

## 2.5 通话（5 条）

- **`GET /sessions` 的筛选参数名和格式。** 问：账号 ID 是 `accountId`（精确匹配）吗？`requestedAt` 范围是 `from`（含）、`to`（不含）的 ISO-8601 时刻，还是 `YYYY-MM-DD` 的 UTC 日？"是否进行中"是 `ongoing=true|false` 吗？`endReason` 除 `DEADLINE` 外是否也接受 §15.6 的其他四个值，不认识的值是 400 吗？`guest`、`ongoing` 不是布尔、时刻格式不对、`to` 早于 `from` 时是不是 400（`NOT_BOOLEAN` 等）？为什么：参数名猜错，后端会静默忽略，页面显示的就是没有筛选的结果，运营会以为"该账号没有会话"。暂定：只发有值的参数：`accountId`、`guest`、`from`、`to`（所选 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`）、`ongoing`、`endReason=DEADLINE`（页面只问"是"）。来源：`sessions.md` 一。
- **【安全】会话列表的 `deviceId` 返回完整值还是前 8 位。** 问：契约写"只显示前 8 位"，没说是后端只返回前 8 位，还是返回完整哈希、由前端截取。建议后端只返回前 8 位并把字段名改成 `deviceIdPrefix`（认证事件那一行就是 `deviceIdHashPrefix`），或在契约里写明这个接口里的 `deviceId` 就是前 8 位。为什么：完整的设备哈希是游客的稳定标识（游客额度、锁都按它），页面不需要，也不应送到浏览器里（开发者工具、网络面板都看得到）。暂定：页面一律只取前 8 个字符显示（按字符），完整值不进页面文字、提示、属性，也不写日志。完整的变更请求见第四部分第 9 条。来源：`sessions.md` 二。
- **`GET /sessions/{id}` 返回哪些字段，有没有不该给运营看的。** 暂定：响应是 §18 `Session` 的列：除列表那九个外，详情抽屉读 `freeTier`、`roomName`、`timezone`、`renderMode`、`deadlineAt`、`endReason`、`agentJoinedAt`、`userJoinedAt`、`userLeftAt`；不读 `lastParticipantEventAt`、`agentIdentity`、`statsAppliedAt`；问 `roomName` 能不能显示。来源：`sessions.md` 三。
- **列表里怎么认出游客会话。** 暂定：账号 ID 为 `null` 或空串的行就是游客会话（账号列显示"游客"、设备列显示前 8 位）。请确认。来源：`sessions.md` 四。
- **"进行中"是否包括"启动中"（`agentJoinedAt` 为空）的会话。** 暂定：页面不区分，只发 `ongoing`；`endedAt` 和 `durationSeconds` 都为空的行，时长列写"进行中"。如果后端的"进行中"含启动中的记录，请在契约里写明，页面才能把它们标成"启动中"。来源：`sessions.md` 五。

## 2.6 埋点管理（4 条）

- **四个现查接口 `from`、`to` 的写法。** 问：`event-summary`、`event-names`、`funnel`、`events` 的 `from`、`to` 是 `YYYY-MM-DD`（UTC 日，含两端，同 `/stats/*`）还是带时刻的 ISO-8601？"跨度不超过 `analytics.live_max_range_days`"按含两端的天数算吗？不传时是 400 还是默认范围？越界时 `details` 的 `ref` 是 `to` 吗？（越界返回 400 已由后端回复第 10 条回答。）为什么：页面用日期范围选择器，选哪一天就发哪一天，不能自己换算成时刻；事件明细的排查常常要精确到分钟，如果要时刻，页面要加时间选择。暂定：都发 `from`、`to`，`YYYY-MM-DD`，UTC 日，含两端；缺任何一个假后端返回 400，`ref` 是缺的那个参数，跨度超限时 `ref` 是 `to`。来源：`analytics.md` 一。
- **`GET /analytics/events` 的参数和响应字段。** 问：参数名是否 `accountId`、`deviceId`、`eventName`、`from`、`to`、`page`、`pageSize`（精确匹配，空则不筛）？响应是否分页的 `{"items","total"}`、按 `receivedAt` 倒序（同一批里按 `seq` 倒序）？每条是否 `id`、`eventName`、`accountId`（没有账号为 `null`）、`deviceId`、`receivedAt`、`clientTime`（客户端没给或不合规为 `null`）、`country`、`ip`、`params`、`context`（存储里事件名叫 `name`，这里按其他三个接口叫 `eventName`；有没有稳定的行键 `id`）？平台、App 版本是不是只从 `context.platform`、`context.appVersion` 读？为什么：列表页要写类型、表格要有行键，字段名猜错会让整列为空。暂定：以上全部按"是"。来源：`analytics.md` 二。
- **已保存漏斗 `/analytics/funnels` 的形状和规则。** 问：`GET` 是 `{"items":[…]}` 还是裸数组，排序？`POST`、`PUT` 请求体是否 `{"name","steps","windowHours"}`，`PUT` 整体替换，响应是更新后的 `SavedFunnel`，`DELETE` 成功 `data` 为 `null`？名称长度、是否唯一、重名是否 409 `DUPLICATE_RESOURCE`（`data.field` 是 `name`）？预设漏斗被 `PUT`、`DELETE` 时返回什么？步骤事件名是否要符合 `^[a-z0-9_]+$`？步骤数、`windowHours` 不合格时 `ref` 是 `steps`、`windowHours` 吗？为什么：预设漏斗靠 `isPreset` 隐藏按钮，但别的管理员同时操作时要有确定的错误。暂定：名称去首尾空白后 1 到 100 个码点，不能与别的漏斗同名；预设的 `PUT`、`DELETE` 返回 409 `INVALID_STATE`（`data.status` 取 `PRESET`）；找不到 404 `RESOURCE_NOT_FOUND`；步骤只在前端拒绝含逗号的名字和空名字。来源：`analytics.md` 三。
- **漏斗步骤里的逗号。** 问：契约写 `steps=a,b,c`，事件名里有逗号时怎么办；后端若要收带逗号的名字，需要转义规则或改用重复参数。暂定：页面拒绝含逗号的步骤，不做转义。来源：`analytics.md` 四。

## 2.7 用户（6 条）

- **`GET /users` 和 `GET /users/export` 的七个筛选参数名。** 问：是否 `accountId`、`email`、`phone`、`status`、`channelCode`、`trafficType`、`mediaSource`？除邮箱和手机号（先规范化）外是否精确匹配（`mediaSource` 是否忽略大小写）？`status` 取 `ACTIVE`、`BANNED`、`PENDING_DELETION`、`DELETING`，其他值是 400 吗？为什么：参数名猜错，筛选会被后端静默忽略，导出就会导出全部用户。暂定：用上面七个名字，只发有值的参数，值只去首尾空白；假后端 `mediaSource` 忽略大小写，其余精确。来源：`users.md` 一。
- **`GET /users/{id}/sessions` 的响应字段和分页。** 问：是否 `{"items","total"}`、按 `requestedAt` 倒序分页？每项是 `Session` 的哪些列（后端回复的字段表里没有这一行）？暂定：分页，每项读 `id`、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`、`endReason`；进行中的 `endedAt`、`durationSeconds` 为 `null`，页面写"进行中"。来源：`users.md` 二。
- **账号删除任务：怎么知道宽限期何时结束、是谁发起的。** 问：能否二选一：（a）`GET /account-deletions` 增加 `accountId` 筛选；（b）`GET /users/{id}` 在账号处于 `PENDING_DELETION` / `DELETING` 时带 `deletion: {id, status, executeAfter, requestedBy, requestedByUsername}`。为什么：客服要告诉用户宽限期到哪天；用户详情现在没有这些。暂定：页面不显示宽限期截止时间，只用账号状态；后端给出后详情页的横幅里加上。来源：`users.md` 三。
- **【安全】账号删除任务 `lastError` 会不会含用户内容或内部地址。** 问：页面把它当文字显示，长度不限；请确认里面不会有用户内容、令牌、内部主机名。（`stepStates` 页面不读、不显示。）来源：`users.md` 三"另"。
- **封禁、解封、发起删除、取消删除、重试成功时的 `data`。** 暂定：页面不读这些响应，成功后重新读 `GET /users/{id}`（或任务列表）；假后端：封禁、解封、取消、重试返回 `null`，发起删除返回 `{"scheduledAt": …}`。来源：`users.md` 四。
- **多开检测 `GET /abuse/clusters` 的 `from`、`to` 格式。** 问：契约只写"按 `RegistrationAudit.createdAt`"，是 ISO-8601 时刻还是 `YYYY-MM-DD`（额度流水有同一个问题）？`minFreeAccounts` 填 0 时发 0 对吗？暂定：页面按 UTC 日选，发 `from=<起始日>T00:00:00Z`、`to=<结束日的后一天>T00:00:00Z`，即 `[from, to)`；`minFreeAccounts` 留空不发，填 0 发 0。来源：`users.md` 五。

## 2.8 内容审核（6 条）

- **`GET /moderation/records` 能不能按内容类型筛选。** 问：是否支持 `contentType=<七个值之一>`，不在范围内是否 400 `INVALID_REQUEST`（`ref` 为 `contentType`，原因 `OUT_OF_RANGE`）？为什么：队列有七种内容类型，运营需要只看某一种（例如只看生成的动作片段）；契约 §17.4 只写了 `status`、`source`。暂定：选了就发 `contentType=…`；若后端不支持，这个筛选不起作用（不会报错，只是不过滤）。来源：`moderation.md` 一。
- **审核记录的字段形状。** 问：`categories` 是字符串数组（如 `["RULE:<id>","sexual"]`）还是逗号分隔的字符串？`autoLevel`、`score` 在 `source=REPORT` 的记录上是 `null` 吗？`GET /moderation/records/{id}` 的 `data` 与列表同形状吗？等待时长要不要后端直接给秒数？暂定：`categories` 按字符串数组，`null` 或空显示"—"；等待时长在前端用 `createdAt` 算，只对 `PENDING_REVIEW` 显示。来源：`moderation.md` 二。
- **`POST /moderation/records/{id}/decision` 的响应、`note` 长度、检查顺序。** 问：响应 `data` 是更新后的记录还是 `null`？`note` 最长多少码点？检查顺序是不是参数（400）、记录是否存在（404）、状态（409 `INVALID_STATE`，`data.status` 为当前状态）？暂定：页面不读响应，成功后重新取记录；`note` 去首尾空白后拒绝时至少 1 个、最多 500 个码点（通过时可不填，空的不发）。来源：`moderation.md` 三。
- **`GET /moderation/stats` 的口径。** 问：`approved`、`rejected` 算记录的创建日还是处理日？`avgHandleSeconds` 是范围内处理的记录还是范围内创建的记录的平均？`oldestPendingSeconds` 是否与 `from`、`to` 无关（总是当前最老的待处理记录）？没有记录的日子是整行没有还是各数为 0？为什么：总览的"审核积压"卡片只要 `oldestPendingSeconds` 一个数，如果依赖范围就会漏掉更早创建、仍在等待的记录，显示偏小。暂定：`created`、`blocked` 算创建日，`approved`、`rejected` 算处理日；`avgHandleSeconds` 取范围内处理的记录；`oldestPendingSeconds` 与范围无关，队列页和总览都把 `from`、`to` 写成今天（UTC）；没有记录的日子没有行。来源：`moderation.md` 四、`dashboard.md` 三。
- **内容签名地址的过期时刻。** 建议：在 `FILE` 响应里加 `expiresAt`，这样页面可以在过期前主动重新取，不必靠播放器加载失败来发现。暂定：每次打开详情重新取；播放器加载失败时自动重新取一次，再失败就提示并给"重新取内容"按钮。来源：`moderation.md` 五。
- **配置键 `moderation.text_rules` 与 `GET/PUT /moderation/text-rules` 是不是同一份数据。** 问：规则页保存后，`GET /config` 里该键的值会同步变化吗？暂定：假后端不同步；页面把配置里的该键只读并指向规则页。来源：`moderation.md` 六。

## 2.9 形象与装扮、照片里的人投诉（10 条）

- **各列表分不分页、有哪些筛选参数。** 问：`GET /cosmetics`、`/actions`、`/declarations`、`/renderer-models`、`/generation-tasks` 分页吗（`page`、`pageSize`，带 `total`）？`GET /cosmetics` 的筛选参数是不是 `kind`、`enabled`、`style`（匹配 `compatibleStyles` 包含它的条目）？`/generation-tasks` 只有 `status`、`type`，按创建时间倒序吗？`GET /likeness-complaints` 的筛选参数是 `status` 吗，按 `dueAt` 升序吗？为什么：服装条目会超过 20 条，筛选参数名错了会静默失效。暂定：前端总是发 `page`、`pageSize`，响应有 `total` 就用服务端分页，没有就在前端切页；空值不发。来源：`cosmetics-complaints.md` 一。
- **【安全】渲染模型响应里的 `fileRef`。** 问：`RendererModel` 的 `fileRef` 是存储引用，后端回复通则只列了 `previewRef`、`iconRef`、`sourceImageRef` 等被签名地址替代；管理端要不要收到 `fileRef`？为什么：存储键对浏览器没有用，也不应暴露。暂定：不使用也不显示。来源：`cosmetics-complaints.md` 二.1。
- **`names`、`texts` 的语言标签，`en` 是否必填。** 暂定：表单语言框取 `GET /meta` 的 `supportedLocales` 加 `en`，已存在条目里的其他标签也保留；名称至少一种语言非空，不强制 `en`。来源：`cosmetics-complaints.md` 二.2。
- **服装、动作 `POST`/`PUT` 的请求体。** 问：`POST` 发 `key`、`kind`（动作没有）、`names`、`generationSpec`（动作另有 `description`）、`compatibleStyles`、`surfaces`、`creditPrice`（`null` 表示不能用额度兑换）、`isFree`、`isDefault`、`triggerableBy`（动作）、`sortOrder`、`enabled`，加 `previewUploadId`/`iconUploadId`；预览图和图标创建时必填吗？`enabled` 创建时能带吗？`PUT` 发除 `key`、`kind`、`enabled` 之外的全部可编辑字段（整体替换，`creditPrice: null` 清除价格），图片只在换了图时才带；`kind` 创建后是否只读？暂定：如上，预览图和图标创建时必填，`kind` 不带。来源：`cosmetics-complaints.md` 二.3、二.4。
- **默认条目的规则。** 问：每种 `kind` 一个 `isDefault=true` 的免费条目；把另一个条目设为默认时，旧默认条目是自动取消还是 409？`isDefault` 为真而 `isFree` 为假是 400 吗，`ref` 是 `isDefault` 吗？暂定：假后端对后者 400。来源：`cosmetics-complaints.md` 二.5。
- **目录字段的长度和格式。** 问：`key`、`names` 每个值、动作 `description`、声明 `version`、`texts` 每个值的长度上限和字符规则（契约只有 `generationSpec` 的 1..2000 码点）。暂定：前端只检查非空和 `generationSpec` 的长度，其余交给后端的 400 并按错误码译文显示。来源：`cosmetics-complaints.md` 二.6。
- **声明版本 `version` 的格式、重复、`activeFrom`。** 问：是自由文本还是日期加序号？重复是 409 `DUPLICATE_RESOURCE`（`data.field` 是 `version`）吗？从未生效的版本 `activeFrom` 是 `null` 吗？暂定：都按"是"。来源：`cosmetics-complaints.md` 二.7。
- **几个写操作成功时的 `data` 和错误。** 问：`PUT /likeness-complaints/{id}/status`、`POST …/remove-avatars` 返回更新后的详情还是空？`POST /accounts/{id}/cosmetics` 返回新建的 `AccountCosmetic` 行吗，重复赠送同一件是 409 `DUPLICATE_RESOURCE`，条目不存在是 404 吗？`PUT /declarations/{version}/activate`、`PUT …/enabled` 返回更新后的行吗？暂定：前端不使用这些响应，成功后重新读取；假后端赠送重复返回 409（`data.field` 为 `itemId`）。来源：`cosmetics-complaints.md` 三。
- **`INVALID_STATE` 的 `data.status` 与几个状态规则。** 问：动作补生成遇到已停用的动作返回 409 时 `data` 里有没有状态？`PUT /default-avatars/{id}` 改名在哪些状态下被拒绝？对已生效的默认数字人再 `activate` 是幂等成功还是 409？暂定：`data.status` 缺失时只显示 `error.INVALID_STATE` 通用文字；生成中的不显示"改名"按钮；再激活按成功不变。来源：`cosmetics-complaints.md` 四。
- **`GET /accounts/{id}/avatars` 里 `isCurrent` 的含义。** 问：后端回复第 7 条字段表列了形象的 `isCurrent`，没写含义；我们理解为"这个形象是账号当前使用的形象（`User.currentAvatarAssetId`）"，是否如此？来源：`cosmetics-complaints.md` 五。

## 2.10 记忆服务、系统监控、客服（6 条）

- **`GET /alerts` 的响应形状。** 问：是否 `{"items","total"}`、接受 `page`、`pageSize`，`total` 在带 `status=OPEN` 时是满足筛选的总数而不是当前页条数？不带 `status` 时是全部状态还是只返回 `OPEN`？按 `createdAt` 倒序吗？`detail` 是字符串还是 JSON 对象？为什么：告警页是分页表格；总览的"未处理告警"卡片只读 `GET /alerts?status=OPEN&page=1&pageSize=1` 的 `total`，如果 `total` 是当前页条数，卡片永远显示 1。暂定：分页的 `{items,total}`，字段名同实体的列，不带 `status` 是全部，倒序，`detail` 是字符串或 `null`；告警页默认筛选 `status=OPEN`，由页面发出；`total` 不是数字时卡片显示"—"。来源：`memory-monitor-support.md` 一、`dashboard.md` 四。
- **`GET /support/feedback` 的分页、筛选、列表里带不带全文。** 问：接受 `page`、`pageSize`，响应 `{items,total}`、按 `createdAt` 倒序吗？能不能按 `forwardStatus`（`PENDING`、`FORWARDED`、`FAILED`）和 `category` 筛选？列表每行是 `SupportFeedback` 的全部列（含 `message` 和 `context`）还是摘要？为什么：客服要找的是转发失败的那几条（只有它们能点"重试"）；正文最长 4000 个码点，`context` 里最近的错误最多 20 条、每条 500 字符，每行都带全文时 200 行的一页会很大。暂定：分页、倒序，页面不加筛选；列表行按实体的全部列读，详情抽屉另取 `GET /support/feedback/{id}`。来源：`memory-monitor-support.md` 二。
- **`POST /support/feedback/{id}/retry` 和 `POST /alerts/{id}/resolve` 的响应和状态错误。** 问：成功时 `data` 是什么？对不是 `FAILED` 的反馈重试、对已 `RESOLVED` 的告警关闭，是不是 409 `INVALID_STATE`，`data.status` 为当前状态？暂定：页面忽略成功响应，失败显示 `error.INVALID_STATE` 并重新读列表。来源：`memory-monitor-support.md` 三。
- **记忆服务三个写接口的响应、`MEMORY_MODEL_CONFLICT` 的 `detail` 位置、校验错误的 `ref`/`reason`。** 问：`PUT /memory/tiers/{name}`、`PUT /memory/embedding-models/{name}`、`PUT /accounts/{id}/memory/embedding-model` 成功时的 `data`？409 `MEMORY_MODEL_CONFLICT` 里记忆服务那句话在 `data.detail` 还是 `message`？名字不合格（`^[A-Za-z0-9_-]{1,64}$`）、`teiBaseUrl` 主机不在白名单、`dimensions` 越界时 `details` 的 `ref`、`reason` 各是什么？为什么：页面要把记忆服务写的那句话（写明了原来登记的维度）原样展示给技术人员。暂定：成功响应一律忽略；`detail` 读 `data.detail`，不是字符串就显示 `error.MEMORY_MODEL_CONFLICT` 的通用文字；校验失败按 `ref`（`name`、`teiBaseUrl`、`dimensions`、`topK` 等）对到表单项，原因用现有代码（`INVALID_PATH`、`INVALID_HOST`、`NOT_HTTPS`、`OUT_OF_RANGE`、`NOT_AN_INTEGER`、`NOT_BOOLEAN`）。来源：`memory-monitor-support.md` 四。
- **管线监控页的时间范围上限从哪里读。** 问：能不能在 `GET /meta` 里加 `monitorMaxRangeDays`（当前生效的 `monitor.max_range_days`）？为什么：页面的范围选项（最近 1 小时到 7 天）要和上限一致，否则配置调小以后"最近 7 天"会稳定得到 400。暂定：页面固定提供到 7 天，超限时显示后端的 400 文字。来源：`memory-monitor-support.md` 五。
- **`embeddingAssignments` 的顺序和"当前模型"。** 暂定：页面按 `assignedAt` 倒序自己排，最新一条当作当前模型；没有记录时显示默认模型 `bge-m3`。如果后端的"当前模型"不是最新一条，请告诉我们。来源：`memory-monitor-support.md` 六。

## 2.11 订阅与权益（9 条）

- **`GET /subscription-products`、`PUT /subscription-products` 的形状。** 问：响应是不是 `{"items":[{"store","productId","entitlementKey","enabled","sortOrder","surfaces"}]}`？`PUT` 是一条记录、按 `(store, productId)` 新增或修改，还是整表替换 `{"items":[…]}`？`entitlementKey` 不存在是 400（`ref` 为 `entitlementKey`）吗？暂定：响应 `{"items":[…]}`，按 `store`、`sortOrder`、`productId` 排；`PUT` 一条记录，请求体带全部六个字段（`surfaces` 原样带回，页面不编辑它）；权益不存在 400，原因 `OUT_OF_RANGE`。来源：`subscriptions.md` 一。
- **`POST /entitlement-defs` 和 `PUT /entitlement-defs/{key}` 的请求体。** 问：创建是否 `{"key","name","priority"}`，修改是否 `{"name","priority"}`（`key` 不能改）？`key`、`name` 的格式和长度上限？`key` 或 `priority` 重复是 409 `DUPLICATE_RESOURCE`（`data.field` 为 `key` 或 `priority`）吗？响应是该权益的一项吗？暂定：如上，前端只检查非空（`priority` 为整数），其余交给后端并按 `ref` 放到字段旁。来源：`subscriptions.md` 二。
- **`PUT /feature-gates/{key}/credit-cost` 的请求体和拒绝。** 问：请求体是否 `{"creditCost": 整数或 null}`（`null` 清除）？对不能设置单价的开关（非永久的 `LIMIT`、`avatar.looks_max`、`credits.period_grant`、`BOOLEAN`、`STRING`）是 400 `INVALID_REQUEST` 吗？单价的取值范围？暂定：如上，`ref` 为 `creditCost`；页面只让永久的 `LIMIT`（`avatar.looks_max` 除外）的单元格可编辑。来源：`subscriptions.md` 三。
- **`GET /subscriptions` 的筛选参数名。** 问：是否 `accountId`（精确）、`state`、`store`、`productId`（精确）？暂定：用这四个名字，空值不发。来源：`subscriptions.md` 四。
- **`GET /subscription-events` 的行、`status` 取值、"失败"的定义，以及重处理和已处理的响应和错误。** 问：每行是 `SubscriptionEvent` 的列去掉 `payload`，分页 `{"items","total"}`，按 `eventSignedAt` 倒序吗？`status` 除 `FAILED` 外还有别的值吗？"失败"是否等于 `error` 不为空？对一个没有失败的事件重新处理、对一个不需要关注的事件点已处理，是 409 `INVALID_STATE` 吗？两个接口的响应体？为什么：页面只在 `error` 不为空的行上显示"重新处理"，只在 `needsAttention` 的行上显示"已处理"。暂定：行如上，筛选只提供 `status=FAILED` 和 `needsAttention=true`，响应体不读，失败按错误码显示文字后重新读列表。来源：`subscriptions.md` 五。
- **限时权益发放和撤销的限制与错误。** 问：`durationDays` 的上限，`reason` 的长度（我们按 1 到 500 个码点）；响应是不是 `{"id": "<新权益行的 id>"}`；撤销要不要请求体（理由）；账号不存在 404、账号不是正常状态 400 且原因 `ACCOUNT_NOT_ACTIVE`；撤销一条不是 `PROMO`、或已 `EXPIRED`/`REVOKED` 的行是 409 `INVALID_STATE` 吗？暂定：发放前端预检 `durationDays` 为 1 以上整数、理由 1 到 500 个码点；撤销不带请求体；撤销按钮只在 `source=PROMO` 且 `status=ACTIVE` 的行显示。来源：`subscriptions.md` 六。
- **`GET /subscriptions/stats` 里 `listPriceAmount` 的 JSON 类型。** 问：数字还是十进制字符串（价格批次接口用字符串）？同一天、同一商店、同一商品有两种币种时是两行吗？暂定：两种都接受，用浏览器的货币格式显示；币种不是合法代码时按原文写出；缺失显示"—"。来源：`subscriptions.md` 七。
- **权益功能值的上限 `entitlement.limit_max` 能不能放进 `GET /meta`。** 为什么：契约 15.3 写 `LIMIT` 取值 0 到 `entitlement.limit_max`（默认 1000000），这个键属于 `SUBSCRIPTION:CONFIG`，只读 `SUBSCRIPTION:VIEW` 的管理员取不到。暂定：前端只检查"0 以上的整数"，上限交给后端并把拒绝文字显示在那一行旁。来源：`subscriptions.md` 八。
- **【安全】后台读订阅的接口不应把完整 Google 购买令牌发给只有查看权限的管理员。** 问：`GET /subscriptions`、`GET /subscriptions/{id}` 现在把 Google 的 `storeRef`（就是 `purchaseToken`）和 `linkedPurchaseToken` 完整发给持有 `SUBSCRIPTION:VIEW` 的管理员，而契约 15.2 的绑定规则让持有购买凭证的人可以在 `google/verify` 认领订阅。能否对 Google 只返回末 6 位（字段名带 `Suffix`，做法同 17.4 附表的 `tokenSuffix`）？暂定：订阅详情抽屉对 Google 只显示 `…` 加末 6 位，不带复制按钮，Apple 的 `originalTransactionId` 照常显示；响应 JSON 里的完整令牌前端挡不住。完整变更请求见第四部分第 1 条。来源：`subscriptions.md` 九、`task-11-review.md` C1。

## 2.12 额度（5 条）

- **`GET/POST/PUT /credit-products`（额度包配置）的形状、路径、请求体。** 问：`GET` 的 `data` 是 `{"items":[…]}`（不分页），每行是 `id`（字符串）、`store`、`productId`、`credits`、`enabled`、`sortOrder`、`surfaces` 吗？`PUT` 路径是 `PUT /credit-products/{id}` 还是用 `store` 加 `productId` 定位，创建后 `store`、`productId` 能改吗？`POST` 请求体是否 `{store, productId, credits, enabled, sortOrder, surfaces}`，重复是 409 `DUPLICATE_RESOURCE`（`data.field` 是什么），`credits` 的范围？`PUT` 里没出现的字段（尤其是 `surfaces`）是保持不变还是按空数组（所有端）覆盖？暂定：`PUT /credit-products/{id}`，请求体 `{credits, enabled, sortOrder}`，列表行带 `surfaces` 时原样带回；`POST` 不带 `surfaces`；`store` 下拉只列 `APPLE`、`GOOGLE`；假后端重复 409（`data.field` 为 `productId`），`credits` 不是正整数 400。来源：`credits.md` 一。
- **`GET /credits/transactions` 的 `from`、`to` 格式。** 问：ISO-8601 UTC 时刻（`2026-10-01T00:00:00Z`）还是 UTC 日？`to` 含不含？为什么：时间范围筛选发错格式，整个筛选失效或 400。暂定：页面用 UTC 日历日选择，发 `from=<起始日>T00:00:00Z`、`to=<结束日的后一天>T00:00:00Z`，即 `[from, to)`。来源：`credits.md` 二。
- **`GET /credits/stats` 不传 `from`、`to` 时取什么。** 暂定：页面总是传（默认最近 7 个 UTC 日，含今天），不依赖默认值；按 `YYYY-MM-DD`、含两端、跨度不超过 `stats.max_range_days` 理解。来源：`credits.md` 三。
- **额度调账申请的 `reason`、`note`、`delta` 限制。** 问：长度范围；`delta` 能不能为 0、绝对值有没有上限；`ADJUST` 负数让余额低于 0 以外还有没有限制。为什么：表单要在发请求前提示。暂定：`reason` 和 `note` 去首尾空白后 1 到 500 个码点（驳回的 `note` 必填，通过的可空）；`delta` 必须是整数，`ADJUST` 不能为 0，不设上限；超出以后端 400 为准。来源：`credits.md` 四。
- **`approve` 同时可能触发多个错误时的检查顺序。** 问：申请人就是审核人（403 `SELF_REVIEW_FORBIDDEN`）、申请不在 `PENDING`（409 `INVALID_STATE`）、账号待删除或删除中（403 `ACCOUNT_DELETION_SCHEDULED` / `ACCOUNT_DELETING`）的先后。暂定：假后端按"权限 → 申请存在（404）→ 申请人是否本人（403）→ 状态（409）→ 账号状态（403）"检查；`reject` 同样，没有账号状态一步，另在最前面检查 `note`（400）；前端对每种结果只展示后端返回的错误，不依赖先后。来源：`credits.md` 五。

## 2.13 成本（7 条）

- **`GET /stats/usage-cost` 里 `costAmount` 和 `quantity` 的 JSON 类型。** 问：能不能和价格一样用字符串形式的十进制数返回？为什么：JSON 数在浏览器里解析成浮点，`0.0000000001` 这样的小额、十位小数的总和会丢位或变成 `1e-10`；成本报表要把同一币种的金额精确相加。暂定：前端两种都收，字符串原样保留，数用十进制文字展开，之后全部用文字做精确加法；如果后端回的是数，精度在 JSON 解析时已丢，前端补不回来。来源：`cost.md` 一。
- **`GET /usage/models` 的筛选参数。** 问：能不能加 `hasActivePrice=false`、`resourceType=` 筛选？（`GET /usage/prices`、`/usage/models` 的响应带 `total`、列表分页 `page`、`pageSize` 默认 20 上限 200，已由后端回复第 12 条和通则回答。）暂定：前端发 `page`、`pageSize=200` 一页页读到 `total`（最多 50 页，读不全时页面写明"只读到了 N 条里的 M 条"），筛选在前端做。来源：`cost.md` 二。
- **`PUT /usage/models/{id}` 的请求体细节。** 问：取消适配器时 `syncAdapter` 传 `null` 还是空字符串？`syncAdapter` 为空时 `syncModelId` 还要不要？`syncModelId` 长度上限？对非 `LLM` 的模型设适配器返回什么错误（我们假定 400，`ref` 为 `syncAdapter`）？暂定：取消发 `null`；`syncModelId` 始终发（去首尾空白，1 到 128 个字符）；非 `LLM` 的模型页面不让选适配器。来源：`cost.md` 三。
- **`POST /usage/prices` 的响应，以及档位或价格不合法时 400 的 `ref`、`reason`；`confirm` 因档位不连续被拒绝时同样。** 为什么：页面在确认框里显示"为什么被拒绝"，只显示 `error.<码>` 和已有译文的 `reason.<码>`。暂定：不读成功时的 `data`；假后端用 `ref=bands/currency/effectiveFrom/unitPrice`，`reason=OUT_OF_RANGE`。请给出"缺口"或"重叠"这样更具体的 `reason` 代码，前端再加译文。来源：`cost.md` 四。
- **价格上限 1000000 谁来检查。** 问：前端只检查格式（数字 0-9、最多十位小数、无符号、无指数），上限交给后端（超过时 400，页面显示 `error.INVALID_REQUEST` 的译文），这个分工可以吗？为什么：`12345678.1234567890` 这样的值要在读取、显示、提交中保持字符串不变。来源：`cost.md` 五。
- **价格批次要不要"填的人不能自己确认"的规则（给契约负责人）。** 契约和规格里价格批次没有双人复核：`PENDING_REVIEW` 只能由价格同步生成，手填的批次直接是 `ACTIVE`，撤回和驳回也没有"不能是同一个管理员"的限制，所以页面没有做自我复核的拦截。如果运营要这条规则，请在契约里写成完整的规则（哪些接口、错误码），前端再按额度调账申请（`SELF_REVIEW_FORBIDDEN`）的做法加。来源：`cost.md` 六、`task-26-review.md`。
- **非 `LLM` 批次的 `unitPrice` 在 JSON 里是字符串还是数。** 问：后端第一份回复第 12 条写"其他类型 `unitPrice` 是数"，同一条又写"价格一律是字符串形式的十进制数"，自相矛盾，请说明。暂定：页面两种都收，不影响行为。来源：`task-26-review.md`（实现者的问题文件漏问，评审补）。

## 2.14 推送（18 条）

- **`/push/templates/{id}` 里的 `{id}` 是什么。** 问：契约写"按 `triggerReason`+`locale`"，路径里是实体 `id` 还是 `(triggerReason, locale)`？暂定：用 `id`；`POST` 带 `triggerReason`、`locale`，`PUT` 不带（建好后不改）。来源：`push.md` 一.1。
- **`GET /push/templates` 是否分页、有无筛选。** 暂定：分页 `{items,total}`，无筛选；完整性矩阵需要全部模板，前端用 `pageSize=200` 一页页读到取够 `total`。来源：`push.md` 一.2。
- **模板请求体字段。** 暂定：`{triggerReason, locale, title, body, linkType, linkTarget, enabled, imageUploadId?}`（`PUT` 没有前两项）；图片的字段名契约没写，暂定 `imageUploadId`；`linkType` 为 `NONE` 时 `linkTarget` 传空字符串，是否也接受 `null`？来源：`push.md` 一.3。
- **怎样去掉模板、周期推送上已有的图片。** 暂定：前端不提供去掉图片，`PUT` 不带 `imageUploadId` 表示图片不变。来源：`push.md` 一.4。
- **推送标题和正文的长度上限。** 为什么：契约通则第 4 条没有列推送。暂定：前端只检查去首尾空白后不为空，长度交给后端（假后端按标题 200、正文 1000 个码点拒绝，仅为演示失败的显示）。请给真实上限，前端再加计数。来源：`push.md` 一.5。
- **启用模板时缺语言的拒绝是什么错误。** 问：契约 §8.4 写"保存时校验"，错误是 400 `INVALID_REQUEST` 且 `details` 为 `[{"ref":"enabled","reason":"OUT_OF_RANGE"}]` 吗，还是有专用原因码？暂定：如此；前端在启用前已按 `supportedLocales` 提示缺哪几种语言。来源：`push.md` 一.6。
- **删除一条已启用的模板会让该语言缺模板。** 问：后端是拒绝、允许，还是同时把该触发原因停用？暂定：前端行内确认后发 `DELETE`，按后端的回答显示。来源：`push.md` 一.7。
- **同一 `(triggerReason, locale)` 再 `POST`。** 问：409 `DUPLICATE_RESOURCE`（`data.field` 是什么）还是覆盖？暂定：前端发之前就拦住，后端按 409 处理。来源：`push.md` 一.8。
- **`GET /push/tasks` 的参数和响应。** 问：是否分页 `{items,total}`、按计划时间倒序、每项是 `PushTask` 的列加 `createdByUsername`？支持 `status` 筛选吗？暂定：前端只读 `id`、`audience`、`status`、`note`、`title`、`sentCount`、`failedCount`、`createdBy`、`createdByUsername`、`scheduledAt`，没有筛选。来源：`push.md` 二.1。
- **立即发送要不要显式带 `scheduledAt`。** 暂定：前端不带，由后端填创建时刻；定时发送带 UTC 时刻（ISO-8601，`…Z`）。来源：`push.md` 二.2。
- **手动任务请求体。** 暂定：`{audience, accountIds?, platforms?, locales?, title, body, linkType, linkTarget, imageUploadId?, scheduledAt?}`；`audience=ACCOUNT_IDS` 时只带 `accountIds`；其他受众不带 `accountIds`；筛选为空时整项不带；`accountIds` 的条数上限和每个 ID 的格式没写，前端只去掉空项和重复项。来源：`push.md` 二.3。
- **`POST /push/tasks/{id}/cancel` 的响应和错误。** 暂定：成功响应忽略；非 `PENDING` 返回 409 `INVALID_STATE`，`data.status` 为当前状态。来源：`push.md` 二.4。
- **`DELETE /push/schedules/{id}` 之后这一行还在列表里吗。** 暂定：留在列表里（`enabled=false`，`nextRunAt=null`），前端删除后重新读列表。来源：`push.md` 三.1。
- **周期推送请求体，`PUT` 是整条替换还是可只带改动字段。** 暂定：`{repeat, daysOfWeek?, dayOfMonth?, timeOfDay, timezone, startDate, endDate, enabled, 受众与内容字段同手动任务, imageUploadId?}`；只带所选重复方式用的天字段；`endDate` 不结束传 `null`；`PUT` 带完整字段（列表开关也是整条 `PUT`，只改 `enabled`）。若支持只带 `enabled`，前端可以更小。来源：`push.md` 三.2。
- **周期推送校验失败的 `ref`/`reason`。** 问：`daysOfWeek` 为空、`dayOfMonth` 越界、`timeOfDay` 格式、`timezone` 不是 IANA 名、`startDate`/`endDate` 不合法或 `endDate` 早于 `startDate`。暂定：`ref` 取字段名，`reason` 用 `EMPTY_NOT_ALLOWED` 或 `OUT_OF_RANGE`；前端发请求前已按同一规则拦住。来源：`push.md` 三.3。
- **`GET /push/records` 要不要筛选。** 问：运营要查"某个账号收到过什么"和"某天的召回"，需要按账号 ID、触发原因、本地日期（或创建时间范围）筛选吗？暂定：页面没有筛选，只分页。来源：`push.md` 四.1。
- **【安全】`GET /push/records/{id}` 里发送结果数组叫什么，要不要给 token 末 6 位。** 问：契约写"返回对每个 token 的 `PushDelivery`"；响应是 `PushRecord` 的列加 `deliveries: [{id, pushId, pushTokenId, result, sentAt}]` 吗？`pushTokenId` 是记录 ID 不是 token 本身，要不要像 `GET /users/{id}/devices` 那样给 `tokenSuffix` 和平台？暂定：前端也接受数组叫 `items`；两者都没有就显示"没有记录到发送结果"；只显示 `pushTokenId`。来源：`push.md` 四.2。
- **推送图片上传返回的地址字段名，`imageUrl` 是长期地址还是短时效签名地址。** 暂定：前端只用 `uploadId`，不用也不显示上传返回的地址；列表里的 `imageUrl` 当作可直接显示的地址，每次读列表都用新取到的，不缓存。来源：`push.md` 五。

## 2.15 邀请与分享（5 条）

- **`GET /invites/share-funnel`、`/share-channels` 的 `data` 形状。** 问：`data` 是 `{"items":[…]}` 吗？行的字段名是不是 §17.6 的列名（漏斗行 `statDate`、`sharePv`、`shareUv`、`linkClickPv`、`linkClickUv`、`downloadClickPv`、`downloadClickUv`、`registered`；渠道行 `statDate`、`shareChannel`、`sharePv`、`shareUv`），日期 `YYYY-MM-DD`？某天汇总还没落地时是不返回那一行还是返回数字为 `null` 或 0 的行？`from`、`to` 是含两端的 UTC 日、跨度不超过 `stats.max_range_days` 吗，不传怎么办？`shareChannel` 不合格写成 `unknown`，没有渠道时会不会是空串或 `null`？暂定：按 `{items}` 和上面的字段名；没有行的日子在趋势图补 0、在合计里不算；行里数字缺失、不是数字或为负按"不知道"显示"—"，不进合计；渠道为空显示"—"。来源：`invite.md` 一。
- **`GET /invites/chain` 的节点形状和边界。** 问：`children` 里每个节点是不是 `{accountId, label, joinedAt, children:[…]}`？`joinedAt` 对后代是被邀请时间（`InviteRecord.redeemedAt`）吗，对根是账号创建时间还是被邀请时间？响应的 `maxDepth` 是实际到达的深度还是请求深度的回显，没有后代时是 0 吗？`rootAccountId` 对应账号不存在是 404 `RESOURCE_NOT_FOUND` 吗？`rootAccountId` 为空 400（`ref` 为 `rootAccountId`）、`maxDepth` 超出 `1..invite.chain_max_depth` 400（`ref` 为 `maxDepth`）吗？节点很多时会不会截断？暂定：按上面的形状；`maxDepth` 不是数字时页面自己从树里数；页面一次画出所有后代，显示掩码标识和时间，不显示 `accountId`。来源：`invite.md` 二。
- **`GET /invites/depth-stats` 在范围内没有被邀请人时的值。** 问：`avgDepth`、`maxDepth` 是 `null`、0 还是不返回？暂定：页面把 `null`、缺失、非数字都显示"—"；`depthDistribution` 为空数组时不画图，写"这个范围内没有人被邀请"。来源：`invite.md` 三。
- **`GET /invites/stats` 的边界。** 问：`limit` 超过 200 是 400 `INVALID_REQUEST`（`ref` 为 `limit`）还是静默取 200？`registeredAccounts` 是"截至 `to` 当天结束的账号总数"（UTC）吗？`daily` 是不是范围内每天一行（没有邀请的日子为 0）？暂定：页面只发 1 到 200 的整数；`registeredAccounts` 缺失或为 0 时参与率显示"—"；`daily` 缺的日子补 0。来源：`invite.md` 四。
- **邀请记录、邀请码的取值和筛选。** 问：没有发放时 `inviterCreditsGranted`、`inviteeCreditsGranted` 是 0 还是 `null`？`GET /invites/codes` 有没有筛选参数（按所有者账号、邀请码）？导出 `invite-records` 是否要求同时带 `from`、`to`？暂定：0 显示 0、`null` 显示"—"；`codes` 页面不提供筛选；导出只带当前列表在用的 `rewardStatus`。来源：`invite.md` 五。

## 2.16 活动管理：签到、每日任务（14 条）

- **`GET /tasks/configs` 每项是否带 `hasRecords`（对应契约变更请求，见第四部分第 3 条）。** 为什么：规格 5.22 要求"已有任务记录的配置，类型和目标值只读"，契约 §28.2 的列和后端第 17 条回复都没有能回答"有没有记录"的字段（`GET /tasks/records` 也不能按任务筛选）。暂定：页面不读这个字段也能工作——编辑时类型和目标值可改，后端对有记录的配置返回 409 `TASK_HAS_RECORDS` 时，页面把两个字段还原成原值并变为只读；行里带 `hasRecords: true` 时一打开表单就只读（后端不返回，假后端也不返回）。来源：`activity.md` 一.1。
- **对有记录的配置，`PUT /tasks/configs/{id}` 带没改的 `taskType`、`targetValue` 是否成功。** 为什么：页面每次发完整请求体（`PUT` 是整条替换）。契约写"不能改"，请确认原值不算改。来源：`activity.md` 一.2。
- **四个列表（`/checkin/activities`、`/checkin/records`、`/tasks/configs`、`/tasks/records`）是否分页。** 暂定：分页，`page` 从 1，`pageSize` 取 10、20、50、100，响应 `{items,total}`；签到活动按 `id` 倒序，签到记录和任务记录按创建时间倒序，任务配置按 `sortOrder` 升序。来源：`activity.md` 二.1。
- **筛选的匹配方式。** 问：`name`、`taskName` 是"包含"还是前缀、是否不分大小写？`accountId`、`activityId` 精确匹配？暂定：页面把输入去掉首尾空白后原样发出，空的不发；页面没有 `from`、`to` 筛选。来源：`activity.md` 二.2。
- **`GET /tasks/records` 的 `status` 非法值。** 问：取 `IN_PROGRESS`、`CLAIMABLE`、`REWARDED`、`EXPIRED`，传别的值是 400 `INVALID_REQUEST`、`ref` 为 `status` 吗？来源：`activity.md` 二.3。
- **签到活动的写请求体和 `name` 上限。** 暂定：`POST`、`PUT /checkin/activities[/{id}]` 为 `{name, startDate, endDate, rewards:[{dayNum, rewardCredits, bonusCredits}]}`；不限时传 `null`；`dayNum` 按行序号从 1 连续；`bonusCredits` 总是显式带（默认 0）。`name` 长度上限契约没写，请给出。来源：`activity.md` 三.1。
- **编辑生效中活动时的 `confirm`。** 问：页面只在"存储状态是 `ACTIVE` 且开始日或结束日变了"时先发 `confirm:false` 的 `PUT`，其余情况发不带 `confirm` 的 `PUT`；请确认后者在没有重叠风险时直接成功、没有重叠时 `confirm:false` 也直接执行，以及执行成功时的响应是什么。暂定：把"没有 `disabledActivities`、`applied` 不是 `false`"都当作已执行。来源：`activity.md` 三.2。
- **`PUT /checkin/activities/{id}/status` 的请求体和不允许的转换。** 暂定：发布和启用 `{"status":"ACTIVE","confirm":false|true}`，停用 `{"status":"DISABLED"}`；不允许的转换（发布已生效的活动、停用草稿）409 `INVALID_STATE`，`data.status` 为当前状态。来源：`activity.md` 三.3。
- **`DELETE /checkin/activities/{id}` 对非草稿或已有签到记录的活动。** 暂定：409 `INVALID_STATE`（`data.status` 为当前状态）；契约只写"不允许"没写码。来源：`activity.md` 三.4。
- **`lifecycleStatus=ENDED` 的活动按钮怎么给。** 暂定：按存储状态 `status` 给操作按钮（`ACTIVE` 仍显示"停用"，因为后端的重叠规则也按存储状态算）。如果后端希望已结束的活动按别的方式处理，请说明。来源：`activity.md` 三.5。
- **每日任务写请求体。** 问：`{taskName, taskType, targetValue, rewardCredits, description, claimTimeoutSeconds, sortOrder}`；`description` 为空时接受 `""` 吗；`claimTimeoutSeconds` 的下限。暂定：`description` 空发 `""`，`claimTimeoutSeconds` 空发 `null`、要填则不小于 1 的整数。来源：`activity.md` 四.1。
- **任务类型的选项来源。** 问：规格写"选项取自后端声明的类型"，契约 §28.2 说类型"代码声明"，但没有接口或 `GET /meta` 字段列出；请在 `GET /meta` 加 `taskTypes` 数组。暂定：页面写死三个（`daily_login`、`call_seconds`、`text_messages`），后端给出别的类型码原样显示。来源：`activity.md` 四.2。
- **`PUT /tasks/configs/{id}/status` 的请求体、`DELETE` 对有记录配置的返回。** 暂定：`{"status":"ENABLED"|"DISABLED"}`，成功响应不读；`DELETE` 有记录返回 409 `TASK_HAS_RECORDS`，页面显示译文（"改用停用"）。来源：`activity.md` 四.3、四.4。
- **两个统计页的"用户本地日"。** 问：`POST /stats/land/checkin-daily`、`task-daily` 的 `date` 是统计行的 `statDate`（用户本地日）吗？`date` 和报表的 `to` 最晚可到哪一天（UTC+14 的本地日可以比 UTC 的今天晚一天）？两个导出的 `from`、`to` 与报表相同吗，签到统计两个页签是否各导 `checkin-daily-users`、`checkin-streaks`？暂定：页面把所选日子原样发出，不检查；默认值是 UTC 的昨天；导出跟着页签。来源：`activity.md` 五。

## 2.17 投放管理（18 条）

- **`GET /attribution/performance` 行里的字段名。** 问：按投放账户分组的行带 `campaignId`（字符串，`"0"` 是未归因行），按日分组的行带 `statDate`；能否直接带上 `campaignCode`、`campaignName`（列表里的投放账户可能多于一页）？暂定：页面从 `GET /attribution/campaigns` 里按 `campaignId` 对出编码和名称，响应里带了就优先用。来源：`campaign.md` 一.1。
- **`performance` 里数的类型。** 问：`cost`、`cpa`、`cpi` 是数还是十进制字符串？暂定：两种都接受；比率和每单位花费用页面上的分子分母重新算（契约写明），分母为 0 或负数显示"—"。来源：`campaign.md` 一.2。
- **"未归因"行。** 暂定：只在 `groupBy=campaign` 且没选 `campaignId` 时有一行 `campaignId=0`、只有 `unattributedInstalls`；`groupBy=day` 的各日行页面不读 `unattributedInstalls`。如果按日也要看自然量，请说明字段放在哪。来源：`campaign.md` 一.3。
- **导出 `attribution-performance` 的参数。** 暂定：页面发 `from`、`to`、`campaignId`（选了才发）和 `groupBy=campaign`；导出是按投放账户汇总还是按日、是否接受 `groupBy`，请确认。来源：`campaign.md` 一.4。
- **成本币种怎样让只有 `ATTRIBUTION:VIEW` 的管理员读到。** 请求：`GET /meta` 增加 `attributionCostCurrency`，或在 `performance` 的响应里带 `currency`。为什么：`attribution.cost_currency` 的编辑权限是 `ATTRIBUTION:MANAGE`，`GET /config` 不会给只有 `VIEW` 的管理员。暂定：读不到时投放效果表头不写币种，只写数。来源：`campaign.md` 一.5。
- **`PUT /attribution/campaigns/{id}` 是整条替换还是只改带来的字段，创建时 `enabled` 默认值。** 暂定：页面总是发完整字段（状态开关也是整条 `PUT`，只改 `enabled`），不带 `code`，令牌只在输入了新令牌时才带；创建时发 `enabled: true`。来源：`campaign.md` 二.1、二.2。
- **`POST` 一个已有的 `code`。** 暂定：409 `DUPLICATE_RESOURCE`，`data.field` 为 `code`；页面发之前已按已读到的列表拦住。来源：`campaign.md` 二.3。
- **【安全】怎样清除已设置的 Facebook 访问令牌。** 问：契约写"响应里永远不返回明文"，只说了设置；后端支持用 `null` 清除吗？（"是否已设置"的字段名 `facebookAccessTokenSet` 已由后端回复第 11 条回答。）暂定：页面不提供清除（留空表示不修改）；若支持，页面再加一个"清除令牌"的确认操作。来源：`campaign.md` 二.4。
- **`GET /attribution/campaigns/{id}/link` 的两种 400 怎么区分。** 请求：在 `data.details` 里给 `ref`（`platform`、`attribution.link_base_url`）和 `reason`（`EMPTY_NOT_ALLOWED`）。为什么：契约只写缺像素编号和缺链接根地址都是 400 `INVALID_REQUEST`，前端不显示后端 `message`。暂定：缺像素时不发请求；缺根地址时读 `GET /config` 的 `attribution.link_base_url`，为空就不发请求并写明。来源：`campaign.md` 二.5。
- **落地页接口地址的写法。** 问：页面显示 `POST {attribution.link_base_url}/api/attribution/click`（契约 10.4 写落地页放在 `attribution.link_base_url` 所在域名下，由反向代理转发），请确认。来源：`campaign.md` 二.6。
- **`GET /attribution/costs` 的行字段。** 问：行是 `AttributionCost` 的列加 `createdByUsername`（已回答）；是否加 `campaignCode`、`campaignName`？`amount` 在响应里是数还是字符串？暂定：页面用 `campaignId` 对到投放账户列表；两种都接受，显示两位小数。来源：`campaign.md` 三.1。
- **`GET /attribution/costs` 的 `from`、`to`。** 暂定：`YYYY-MM-DD`（UTC 日，含两端），默认最近 30 天。来源：`campaign.md` 三.2。
- **成本单笔 `POST`、`PUT` 的请求体。** 暂定：`{campaignId, statDate, amount, currency, remark}`，`campaignId` 字符串，`amount` 是 JSON 数（先检查不小于 0、最多两位小数、整数位不超过 13 位）；`PUT` 也带 `campaignId`、`statDate`（值不变）；读不到 `attribution.cost_currency` 时不带 `currency`；`remark` 空传 `null`。来源：`campaign.md` 三.3。
- **`POST /attribution/costs/batch` 的响应和失败明细格式。** 问：400 时 `ref` 的真实格式（假后端："<行下标，从 0 起>.<字段>"，如 `"2.campaignCode"`，批内重复是后一行下标，条数超限或不是数组是 `"body"`）和原因码。为什么：有了行号约定，页面可以写成"第 N 行"。暂定：成功不读响应，提示用自己的行数；失败逐条显示 `ref` 原样和 `reason.<码>` 译文。来源：`campaign.md` 三.4。
- **批量覆盖的结果能否告诉前端。** 问：响应里能不能给"新增几行、覆盖几行"？暂定：页面在弹窗里一直写明"已存在的 `(campaignId, statDate)` 会被覆盖"，不统计覆盖几行。来源：`campaign.md` 三.5。
- **`GET /attribution/clicks` 的 `from`、`to`。** 暂定：和 `GET /attribution/records` 一样：ISO-8601 时刻，`from` 含、`to` 不含，按 `clickedAt` 筛；所选 UTC 日变成 `[from 00:00:00Z, 后一天 00:00:00Z)`；`campaignId` 是字符串。来源：`campaign.md` 四.1。
- **`GET /attribution/summary` 的 `key` 缺失时的值。** 问：分组值缺失（例如记录没有 `mediaSource`）时是 `null` 还是空串？暂定：两种都显示"—"。来源：`campaign.md` 四.2。
- **【安全】点击明细 IP 掩码的格式。** 问：后端回复第 11 条已定 `ip` 默认掩码、持有 `ANALYTICS:IP_VIEW` 才完整；掩码的具体格式没写。暂定：页面不解析、不改写，原样显示后端给的串。来源：`campaign.md` 四.3。

## 2.18 应用内广告（8 条）

- **五组资源的列表和单个对象的形状。** 问：`GET /ads/campaigns`、`/ads/units`、`/ads/creatives` 是 `{"items","total"}`，`GET /ads/placements`（四行）是 `{"items"}`？对象字段是 §22.3 的列名，管理员 ID 旁带 `…Username`（已回答）？素材行里 `type`、`width`、`height`、`bytes`、`durationSeconds`、`mediaUrl`、`thumbnailUrl` 是否都在列表里，每次读列表给新地址吗？暂定：既收 `{items,total}` 也收裸数组，没有 `total` 时按条数算；缩略图只有 `https://` 或 `data:image/` 开头的地址才画。来源：`ads.md` 一。
- **各写接口的请求体。** 问：计划、广告位、单元、素材、状态接口的请求体（见原文表格），尤其三个状态接口的字段名；审核接口用 `reviewStatus` 还是 `decision`；`PUT /ads/units/{id}` 的 `targeting` 是整体替换还是嵌套的 Merge Patch，前端发的 `null` 键会不会被类型校验拒绝。暂定：计划 `{name, description, priority, startAt, endAt}`，状态 `{status}`，广告位只发改动的字段，素材 `{adUnitId, uploadId, clickAction, clickTarget, language, weight, skippable, rewardAfterSeconds, title, body, ctaText, advertiserName}`（不发地址、尺寸、大小、时长、`type`），审核 `{reviewStatus: "APPROVED"}` 或 `{reviewStatus: "REJECTED", reviewNote}`，`targeting` 按嵌套 Merge Patch、`null` 的键被去掉。来源：`ads.md` 二。
- **只有 `ADS:CREATIVE` 的管理员读不到素材表单需要的信息。** 问：二选一：（a）`GET /ads/placements` 对 `ADS:CREATIVE` 也开放，并且 `GET /ads/meta` 多返回 `creativeAspectTolerancePercent`；（b）单元的响应里带 `placementSlotKey`、`placementFormat` 和素材规格三项（`creativeAspect`、`creativeMinShortSide`、`creativeMaxBytes`）。为什么：后端回复第 9 条把 `GET /ads/campaigns`、`/ads/units` 对 `ADS:CREATIVE` 开放，没有开放 `GET /ads/placements`，也读不到 `ads.creative_aspect_tolerance_percent`；表单要对照广告位规格给"通过/不通过"、判断广告位形式、算比例容差。暂定：读不到广告位时页面写明"读不到这个单元所在的广告位，没法对照规格，以服务器的检查为准"，容差用契约默认值 3%。来源：`ads.md` 三。
- **"强制可关闭兜底为 0 且存在不可跳过素材"的警告怎么判断。** 问：后端判断"存在"用哪些素材（所有状态？只数已通过且投放中的？）？能否在 `GET /ads/meta` 加 `notSkippableFullScreenCount`？为什么：保存配置时 `warnings` 的 `AD_FORCE_CLOSE_DISABLED` 前端已显示，页面常驻的那一条只能自己数，而没有 `ADS:CREATIVE` 的管理员读不到素材列表。暂定：有 `ADS:CREATIVE` 时读全部单元和素材按 `skippable=false`、不是 `REJECTED`、单元的广告位是开屏或插屏来数，没有时显示不带数字的警告。来源：`ads.md` 四。
- **删除计划、单元时的错误。** 问：计划名下有单元、单元名下有素材时返回什么？是 409 `INVALID_STATE`（页面看不出是"状态不对"还是"名下有单元"），还是专用的 409（如 `RESOURCE_IN_USE`，`data.what` 是 `units` 或 `creatives`）？草稿计划名下有单元时能不能删？暂定：能读到单元的管理员，页面对有单元的计划不提供删除（按钮灰掉并写明原因）；读不到时提供按钮，后端拒绝时显示 `error.INVALID_STATE` 的译文；单元的删除不预判。来源：`ads.md` 五。
- **长度、范围、格式的真实上限。** 问：计划名称、描述、优先级范围、单元名称、素材标题/正文/按钮文字/广告主、拒绝备注的长度；`DEEP_LINK` 的 scheme 清单；版本号能不能带后缀。暂定：页面只做契约写明的检查，拒绝备注按 1 到 500 个码点，`DEEP_LINK` 只检查非空且不超过 2048 个字符，版本号只收"数字加点"，其余交给后端 400。来源：`ads.md` 六。
- **`targeting` 校验失败时 `details` 的 `ref`。** 问：`ref` 是 `targeting`、`targeting.geo` 还是 `geo`？时段第几行出错时是 `targeting.day_parts[0]` 吗？暂定：接受 `targeting`、`targeting.<键>`、`<键>`（snake_case），键后带 `[0]` 或 `.0.start` 都归到这个键下，认不出的显示在表单底部。来源：`ads.md` 七。
- **广告报表的几处。** 问：`GET /ads/report/overview` 的 `daily` 是否只返回有数据的日子，当天有没有数据？`totals` 里的比率字段是否和每行一样？`by-country` 的 `country` 是大写 ISO 3166-1 alpha-2 吗，空串是"未知"？暂定：页面把缺的日子在折线图上补 0；对每个比率再检查分母，为 0 或非数一律显示"—"。来源：`ads.md` 八.1–八.3。

## 2.19 短信与邮件模板（19 条）

- **【安全】短信渠道凭据在请求体里叫什么、是什么类型。** 问：契约写"`PUT /sms/channels/{id}`（含凭据）""留空表示不修改"，实体列是 `credentialsEnc`，请求字段名没写；有的供应商要两三个凭据，要不要结构化的值？暂定：`credentials`，一个字符串（页面是一个密码框）；留空时请求体里没有这个键（不是空串，不是 `null`）；页面永远不显示已保存的凭据。来源：`sms-email.md` 一.1。
- **`PUT /sms/channels/{id}` 是整条替换还是只改带来的字段。** 暂定：页面总是发完整的可编辑字段：`name`、`providerCode`、`apiUrl`、`extConfig`、`countries`、`smsType`、`priority`，加输入了才有的 `credentials`；不带 `channelCode` 和 `enabled`；`extConfig` 空发 `null`，国家空发 `[]`。来源：`sms-email.md` 一.2。
- **`PUT …/enabled` 的请求体、`POST /sms/channels` 的 `enabled` 默认值。** 暂定：`{"enabled": true|false}`；新建总是显式发 `enabled`，默认 `false`。来源：`sms-email.md` 一.3、一.4。
- **【安全】`extConfig` 是 JSON 对象还是 JSON 字符串，里面会不会有凭据。** 暂定：请求发对象（或 `null`），响应对象、字符串都能读；页面的"凭据永不回显"依赖后端不把凭据放进 `extConfig`（规格只写它含 `appId` 和发送方 ID），请确认。来源：`sms-email.md` 一.5、`task-28-review.md`。
- **`channelCode` 的格式和长度。** 为什么：契约写"管理员指定，唯一"，回调路径 `POST /notify/sms/{channelCode}/report` 把它放在路径里。暂定：只接受字母、数字、连字符、下划线，1 到 64 个字符。来源：`sms-email.md` 一.6。
- **`providers[].allowedHosts` 的匹配规则。** 问：条目是精确主机名，还是后缀或通配（如 `*.example.com`）？暂定：按主机名（小写、不含端口）精确比较，列表为空时不检查。来源：`sms-email.md` 一.7。
- **`POST /sms/channels/{id}/test` 的响应和错误。** 暂定：页面不读响应，成功就提示并关闭，随后重读 `GET /sms/meta` 得剩余次数；手机号参数名 `mobile`，原样发（去首尾空白，不改写成 E.164）；号码无效期望 400 `PHONE_INVALID`，当天次数用完期望 429 `RATE_LIMITED`。来源：`sms-email.md` 一.8。
- **删除、停用、改 `smsType` 或 `countries` 被拒绝时用专用错误码。** 请求：换一个专用错误码（如 `LAST_OTP_CHANNEL`），或在 `details` 里给 `ref`（`channel`）和 `reason`。为什么：契约返回 `INVALID_REQUEST`（条件：`auth.phone_login_enabled=true` 或存在手机号账号），译文是"输入内容不合法"，看不出原因。暂定：页面操作前提示这两个条件，被拒绝后在译文后加一句固定的说明。来源：`sms-email.md` 一.9。
- **页面怎样知道"存在手机号账号"（对应契约变更请求，见第四部分第 5 条）。** 请求：`GET /sms/meta` 增加 `phoneLoginEnabled`（布尔）和 `phoneAccountCount`（整数）。为什么：只有后端知道；`GET /config` 只给有权编辑的键，没有 `CONFIG:MANAGE` 的管理员读不到 `auth.phone_login_enabled`。暂定：页面操作前读 `GET /config`，读到就写明开着还是关着，读不到就写"读不到"，两种都写明"存在手机号账号时后端同样拒绝，本页看不到有没有"。来源：`sms-email.md` 一.10。
- **"最后一个覆盖的启用验证码通道"的算法。** 问：页面按国家算：一个启用的 `OTP` 通道只要有一个国家没有别的启用的 `OTP` 通道覆盖，就算最后一个（空国家表示全部国家，别的通道也是空时才算覆盖了它），读不到全部通道时一律当作最后一个；后端的算法是否相同？暂定：以后端为准，页面只决定要不要先问。来源：`sms-email.md` 一.11。
- **短信模板列表是否分页、有无筛选。** 暂定：按 `page`、`pageSize` 分页，`{items,total}`，没有筛选。来源：`sms-email.md` 二.1。
- **短信模板请求体。** 暂定：创建 `{templateCode, name, smsType, locale, country, content, providerTemplateId, enabled}`（`country`、`providerTemplateId` 空发 `null`，`country` 写成大写），更新不带 `templateCode` 和 `enabled`，`PUT …/enabled` 是 `{"enabled": true|false}`。来源：`sms-email.md` 二.2。
- **模板缺 `{code}`（以及邮件模板缺必含项）时 400 的原因码。** 问：假后端用 `[{ref:'content', reason:'MISSING_PLACEHOLDER'}]`，请给真实的原因码。暂定：语言文件里没有的原因码，字段下写"输入内容不合法"。来源：`sms-email.md` 二.3、四.2。
- **改模板的 `smsType` 能不能使"最后一个启用的 `OTP` 模板"消失。** 暂定：页面把改类型也当作需要先问的操作；后端如果不拒绝，只是多问了一次。来源：`sms-email.md` 二.4。
- **`GET /sms/records` 的筛选参数名和时间范围。** 问：是否记录的列名：`msgId`、`vendorMsgId`、`mobile`（完整号码精确匹配）、`channel`（`SMS`/`PUSH`）、`channelCode`、`purpose`、`sendStatus`、`deliveryStatus`，"是否已使用"是 `used`（`true`/`false`），时间范围 `from`、`to`；`from` 含、`to` 不含的 ISO-8601 时刻、按 `createdAt` 筛吗？暂定：所选 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，默认最近 7 个 UTC 日，页面注明 UTC；导出文件名用响应头里的名字，页面不拼。来源：`sms-email.md` 三.1、三.2。
- **【安全】号码的掩码格式和存库格式。** 问：页面原样显示后端给的掩码串（契约 §23.6：默认只保留末 4 位）；号码筛选不做归一化，用户自己写成存库的格式（E.164），请确认存库的号码不带空格。来源：`sms-email.md` 三.3。
- **短信导出的筛选参数、行数上限和错误。** 问：导出请求用的筛选参数和列表完全一致（列表参数去掉 `page`、`pageSize`）吗？超出行数（400 `INVALID_REQUEST`）和每小时次数用完（429 `RATE_LIMITED`）的处理见"导出"一节。暂定：只显示译文加"缩小筛选"的提示。来源：`sms-email.md` 三.5。
- **邮件模板 `PUT` 和 `reset` 的响应。** 暂定：页面不读响应，成功后重读 `GET /email/templates`。来源：`sms-email.md` 四.1。
- **邮件正文长度、空正文。** 暂定：页面要求去首尾空白后正文不为空，不限制长度（契约写标题 1 到 200 个字符，正文只写"必含占位符"）。来源：`sms-email.md` 四.3。

## 2.20 站内通知与客户端配置（11 条）

- **`GET /notifications` 筛选参数的格式。** 问：`accountId` 原样；`category` 取 `ADMIN`、`SYSTEM_EVENT`；`isRead` 取 `true`/`false`；`from`、`to` 是 ISO-8601 时刻、`from` 含 `to` 不含、按 `createdAt` 筛吗？按 `createdAt` 倒序（同一时刻再按 `id` 倒序）？暂定：所选 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，页面注明 UTC。来源：`notifications.md` 一.1。
- **`POST /notifications/send` 被拒绝时 `details` 的 `ref` 和原因码。** 问：有问题的账号 `ref` 是账号 ID 本身、`reason` 是 `ACCOUNT_NOT_FOUND`/`ACCOUNT_NOT_ACTIVE`；收件账号列表本身 `ref: "accountIds"`，空数组 `EMPTY_NOT_ALLOWED`、重复项 `DUPLICATE_VALUE`、超过 `notification.max_recipients` 为 `OUT_OF_RANGE`；标题正文 `ref` 是 `titleI18n.<语言标签>`/`bodyI18n.<语言标签>`；链接 `ref: "linkTarget"`（或 `linkType`），页面标识不在清单里时请给原因码（假后端用 `INVALID_VALUE`）。请给真实形式。暂定：按此写，不认识的 `ref` 原样列出，没有译文的原因码写"输入内容不合法"。来源：`notifications.md` 一.2。
- **`details` 会不会截断。** 问：收件人最多 1000 个，全部有问题时是 1000 条；如果会截断，请在 `data` 里给总数（如 `data.total`）。暂定：页面列出拿到的全部（列表框可滚动），不写"还有 N 个"。来源：`notifications.md` 一.3。
- **没有链接时省略 `linkType`、`linkTarget` 是否等于 `NONE`。** 来源：`notifications.md` 一.4。
- **语言标签区分大小写吗。** 问：后端是否把 `EN` 当作 `en`？暂定：页面要求英文那一项的键正好是小写 `en`，其他标签原样发，同一次里大小写不同的两个标签（`th` 和 `TH`）当作重复，不让加。来源：`notifications.md` 一.5。
- **一种语言只写了标题或只写了正文。** 问：契约写 `titleI18n`、`bodyI18n` 各自含 `en`，没写两边语言集合必须相同；如果后端允许只写标题，客户端对没有正文的语言怎么取？暂定：页面要求每个添加的语言标题和正文都要填。来源：`notifications.md` 一.6。
- **收件账号 ID 区分大小写吗。** 问：如果不区分，`ABC` 和 `abc` 会被后端当作重复，整批 400。暂定：页面只去首尾空白（29 个码点）、去空行、去重复，大小写不同当作两个 ID。来源：`notifications.md` 一.7。
- **客户端配置 `PUT /client-config/{key}`、`POST …/reset` 的响应。** 暂定：页面不读响应，成功后重读 `GET /client-config`。来源：`notifications.md` 二.1。
- **客户端配置 `PUT` 被拒绝时其余原因码。** 问：`localized` 为否的键提交了非空语言键，真实原因码是什么（假后端用 `ref: <语言键>`、`reason: INVALID_LANGUAGE_TAG`）；`inviteShareText` 含其他 `{…}` 占位符、`inviteLinkBase` 带查询或片段，契约写 `INVALID_REQUEST` 没写原因码（假后端分别用 `INVALID_PLACEHOLDER` 和 `INVALID_PATH`）。（默认值的 `ref` 契约 §1.4 已定为 `default`，见本部分末尾的表。）暂定：语言文件里没有译文的原因码，页面写"输入内容不合法"。来源：`notifications.md` 二.2。
- **`EMAIL` 类型的格式规则。** 问：契约只写"邮箱格式"，后端的真实规则？暂定：去首尾空白后不超过 254 个字符、恰好一个 `@`、`@` 前后都不空、`@` 后有一个点、没有空白。来源：`notifications.md` 二.6。
- **客户端配置预览用的语言匹配顺序。** 问：契约 1.2 和 26.1 写"同一主语言有多个条目时取列表里靠前的第一个"，没写列表按什么排序；页面按标签的字母顺序理解，请确认。（要让预览和客户端实际收到的完全一致，请求预览接口，见第四部分第 7 条。）来源：`notifications.md` 二.7。

转入第四部分的两项：`GET /client-config` 补字段和预览接口（`notifications.md` 二.3、二.5、二.7 里请求的部分）、`PUT /client-config/{key}` 加 `expectedUpdatedAt`（二.4）。它们在原文件里是"请求"，这里直接写成完整的契约变更请求（第四部分第 4.4、4.7 条），不再重复算作问题。

## 2.21 共用：导出与链接规则（2 条）

- **导出超过行数上限时要给可翻译的原因（对应契约变更请求，见第四部分第 6 条）。** 问：契约写 400 `INVALID_REQUEST`、`message` 提示缩小范围；界面按负责人的决定不显示 `message`。请加结构化原因：`data.details` 里 `{ "ref": "range", "reason": "EXPORT_TOO_MANY_ROWS" }`，并在 `data` 里带上限 `maxRows`。为什么：界面要说清"超过了 N 行的上限，请缩小范围"，不能靠解析英文 `message`。暂定：`ExportButton` 在任何 400 `INVALID_REQUEST` 后在通用文字后追加"如果范围很大，请缩小日期范围或筛选条件（一次导出有行数上限）"。来源：`export-row-limit.md`。
- **服务器下发链接的完整正则（给契约负责人）。** 问：契约 §1.7 说客户端的正则是 `HttpsLink.PATTERN`，下面只有文字版，管理端读不到那个仓库；请把完整正则原文和标志位给我们。为什么：后台表单要对所有链接字段做和客户端相同的校验；文字版里"方括号括起来的 IPv6 地址"没写具体字符集，现在的写法是方括号内只允许十六进制数字、冒号和点，且至少含一个冒号（`https://[:]` 通过，`https://[1.2.3.4]` 和带区域标识的被拒绝），如果客户端更严格，表单会放过客户端会隐藏的链接。暂定：保持文字版的实现；拿到原文后让 `src/utils/linkRule.test.ts` 逐字对照。来源：`link-pattern.md`。

## 2.22 已被现有回复回答的部分（不再算新问题）

核对 `docs/backend-inputs/` 四份文件和契约快照后，下面这些在问题文件里问过的点，其实已经有答案。它们没有放进上面各节的条数里；上面各节里"部分已回答"的条目，只保留了还没有答案的那一半。

| 问题文件里问的 | 已有的答案 | 出处 |
|---|---|---|
| `system.md` 一.7：`GET /roles` 对 `ADMIN:MANAGE` 开不开放 | 开放，管理员表单选角色用；`GET /ads/placements` 只另开放给 `ADS:UNIT`（所以 `ads.md` 三的问题仍然成立） | `2026-10-21-avatar-backend-reply-to-avataradmin.md:85`、`:89` |
| `system.md` 一.8：`passwordMinLength` 在 `GET /meta` 还是 `GET /me` | 在 `GET /me`（`{"id","username","superAdmin","mustChangePassword","permissions","passwordMinLength"}`） | 同上 `:39-41` |
| 管理员用户名字段：`ads.md` 一.2、`campaign.md` 三.1、`push.md` 二.1、`users.md` 三、`app-versions.md` 二.2、`system.md` 三.5 | 每个管理员 ID 字段旁都有 `…Username`：广告计划的 `createdByUsername`/`updatedByUsername`、素材的 `reviewedByUsername`、投放成本和投放账户的 `createdByUsername`、推送任务的 `createdByUsername`、账号删除任务的 `requestedByUsername`、应用版本的 `activatedByUsername`、权限节点的 `createdByUsername`；管理员已删除时为 `null`，ID 照旧 | 同上 `:43-49` |
| `ads.md` 八.4：广告报表导出带哪些参数 | `GET /stats/export/ads-report` 带页面上同样的 `from`、`to`、`platform`、`channelCode` | `2026-10-21-avatar-backend-note-for-avataradmin.md:57` |
| `app-versions.md` 四.2：`upload.public_base_url` 没配置时 APK 上传返回什么 | 503 `DEPENDENCY_UNAVAILABLE` | 同上 `:16` |
| `campaign.md` 二.4 里"已设置"的字段名 | `facebookAccessTokenSet`（布尔） | `…reply-to-avataradmin.md:132` |
| `cost.md` 二：`GET /usage/prices`、`/usage/models` 的分页 | 响应是 `{"items","total"}`，分页通则 `page` 缺省 1、`pageSize` 缺省 20、上限 200，越界 400 | 同上 `:106`、`:134`、`:136` |
| `notifications.md` 一.1：站内通知列表分页 | 同上通则；`GET /notifications` 是 `{"items","total"}`，按 `createdAt` 倒序（筛选参数格式仍未回答，见 2.20） | 同上 `:106`、`:144` |
| `analytics.md` 一：范围越界返回什么 | 400 `INVALID_REQUEST`（`/analytics/*` 超过 `analytics.live_max_range_days`）；日期格式、含不含两端仍未回答，见 2.6 | 同上 `:97-98` |
| `notifications.md` 二.2：客户端配置默认值的 `ref` 是不是空字符串 | 不是：契约 §1.4 写明 `PUT /client-config/{key}` 的 `ref` 是语言标签，不带语言的默认值（空字符串键）写 `default`。前端已按此改（提交 03d06a5），问题文件里"空字符串"的写法作废 | `docs/shared-snapshots/backend-task-java-backend.md:111` |
| `notifications.md` 二.3、二.5：`GET /client-config` 要不要加 `min`、`max`、`maxLength`、`placeholders`、`source` | 后端回复列出了这个接口的全部字段：`key`、`type`、`localized`、`readOnly`、`configured`、`defaultValue`、`values`、`updatedBy`、`updatedByUsername`、`updatedAt`，并写明"这里写的就是全部"，没有这五项；"客户端使用点"的说明文字不在接口里。所以这是对契约的变更请求，不是问题，见第四部分第 7 条 | 同上 `:106`、`:108` |
| 第一部分之外的补充问题（邮件模板占位符每项带不带花括号） | 每项都带花括号，前端检查用数组里的原样字符串在正文里找 | `2026-10-21-avatar-backend-reply-2-to-avataradmin.md:8-14` |

这张表一共 12 行（其中"管理员用户名字段"一行合并了 6 份文件里的同一个点）。

---

# 第三部分：规格需要在 main 上修改的地方

> **给谁：** 项目负责人，由他决定谁在 AvatarApp `main` 上改 `docs/admin-frontend-design.md`。本仓库的 `docs/shared-snapshots/admin-frontend-design.md`（AvatarApp `main` 提交 36626b12 的快照）只读，不改。
> **怎么读：** "现在的文字"都是对着快照逐条核对过的原文（引号里是原文）。"应改成"是提议的文字。标"待负责人先定"的是新增或改变行为的变更，不是单纯的文字对齐，定了之后才改。
> **范围：** （一）计划里"规格与契约的冲突"表的全部行；（二）各任务报告和评审里"规格需要在 main 上修改的地方"一节的全部条目，合并重复后列出；（三）不是改规格、而是改计划或任务书的两条。要改契约的请求在第四部分。

## 3.1 计划"规格与契约的冲突"表的全部行（8 行）

计划写于 2026-10-21，当时 13 行冲突里已有 6 行（订阅四页的读权限、审核内容区、动作目录、`GET /config` 的写法、14 种告警、五个邮件模板）连同完整的 `MEMORY:` 权限码在 `main` 上改好。下面 8 行是计划里仍然留着的。对着 36626b12 快照核对：7 行仍未改，1 行（第 8 行）`main` 上已经改了。

| 序 | 规格的位置 | 现在的文字 | 应改成 | 原因（契约怎么写） | 来源 |
|---|---|---|---|---|---|
| 1 | 5.0 路由总表，"埋点管理"行和"记忆服务"行的接口栏 | 埋点行页面栏写"事件汇总、事件明细、漏斗分析 `/analytics/summary`、`/analytics/detail`、`/analytics/funnel`"，接口栏写"`/analytics/*`"；记忆行页面栏写"档位 `/memory/tiers`、embedding 模型 `/memory/models`"，接口栏写"`/memory/*`" | 埋点行接口栏写 `GET /analytics/events`、`/analytics/event-summary`、`/analytics/event-names`、`/analytics/funnel`、`/analytics/funnels`（增删改）；记忆行接口栏写 `GET/PUT /memory/tiers`、`GET/PUT /memory/embedding-models`、`GET /accounts/{id}/memory`、`PUT /accounts/{id}/memory/embedding-model`。并在表前一句话写明：页面路由不是接口路径（契约 §17.4 通则） | 契约的接口路径是这些；页面路由（`/analytics/summary` 等）可以不同，规格把两者混在一栏 | 计划"规格与契约的冲突"表第 1 行 |
| 2 | 5.0 路由总表，"成本"菜单的"价格"行 | "`COST:VIEW`（确认、驳回、手填、改模型登记需 `COST:PRICE`）" | "`COST:VIEW`（确认、驳回、撤回、手填、改模型登记需 `COST:PRICE`）" | 撤回也是 `COST:PRICE`（契约 §17.4 成本行）；5.23 正文和 §12 验收清单已经写了"撤回" | 计划表第 2 行 |
| 3 | 5.24 的"生成任务"，以及 5.0 的同名行 | 5.24："失败的生成任务，筛选类型（`AVATAR`、`VOICE`、`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP`）和时间"；5.0 接口栏 `GET /generation-tasks?status=FAILED&type=` | 5.24 改成"筛选类型"，去掉"和时间" | 接口参数只有 `status`、`type`，没有时间筛选 | 计划表第 3 行、`task-14-review.md` |
| 4 | "关键设计点"表的"一级菜单"行 | "…成本、系统配置（含客户端配置）、短信管理、系统管理（含应用版本）（页面清单见第 5 节）"，清单里没有邮件模板 | 在"系统配置（含客户端配置）"和"短信管理"之间加"邮件模板"（5.0 表里它是单独的一级菜单，顺序就是这样） | 清单与 5.0 表不一致 | 计划表第 4 行 |
| 5 | 5.0 路由总表，"通话"、"订阅与额度"、"客服"三处 | "会话列表 `/sessions/list`、详情"、"订阅列表、详情 `/subscriptions/list`"、"反馈列表、详情 `/support/feedback`"，没有给详情路由 | 在表后加一句：这三处的详情在抽屉里打开，没有独立路由 | 前端按此实现；规格没给详情路由 | 计划表第 5 行 |
| 6 | 5.12 邀请，"裂变层级页签" | "`Statistic` 平均链路深度（一位小数）、最大链路深度、链路节点数" | "…最大链路深度、链数（范围内不同根账号的数量）" | 契约 §17.4 邀请管理行：`GET /invites/depth-stats` 的 `totalChains` 是范围内不同根账号（没有邀请人的账号）的数量，不是节点数；页面已写"链数" | 计划表第 6 行、`task-23-report.md`、`task-23-review.md` |
| 7 | 3.3 首次登录与改密码 | "`me` 返回 `mustChangePassword` 为真时，只允许进入改密码页"，没给路由 | 加上改密码页的路由 `/user/change-password` | 路由是计划自己定的，规格里没有 | 计划表第 7 行 |
| 8 | 5.17 应用内广告，广告报表的"无广告原因分布"表 | **`main` 上已改。** 快照现在写"无广告原因分布"表（日期、广告位、原因、次数；接口返回的是全部平台、全部渠道的合计，或页面筛选范围内的合计）"，不再有"平台"列 | 不需要再改 | `GET /ads/report/nofill` 的行是 `{statDate, slotKey, reason, cnt}`，没有 `platform`、`channelCode` | 计划表第 8 行；`…reply-to-avataradmin.md:148`；`…note-for-avataradmin.md:58` |

## 3.2 各任务报告和评审里"规格需要在 main 上修改的地方"的全部条目（合并后 44 行）

按规格章节顺序排。和 3.1 重复的条目只在这里注明"同 3.1 第 N 行"（第 21 行）。

| 序 | 规格的位置 | 现在的文字 | 应改成 | 原因 | 来源 |
|---|---|---|---|---|---|
| 1 | 4.2（第 108、109 行）、5.10 权益定义（第 293 行）、5.15（第 350 行）、5.18a（第 382 行）、5.19（第 389 行）、第 8 节链接输入（第 476 行）。**待负责人先定** | 4.2："失败保持打开并展示后端 `message`""Java 返回 `INVALID_REQUEST` 时，`message` 写明是哪个字段，前端原样展示"；5.10："不合法的 `INVALID_REQUEST` 原样展示"；5.15："在该行下展示 `message` 和 `data.details`"；5.18a："在表单下展示 `message`"；5.19："文件没有 v2 以上签名时显示后端的错误原因"；第 8 节："返回的 `data.details` 原样展示"。而规格自己的第 459 行写："用户可见的提示文字由前端按错误码映射，`message` 只作兜底展示" | 统一成负责人已定的规则：已知错误码时界面只显示按错误码翻译的文字，不显示后端 `message`；`data.details` 里有译文的 `reason` 显示译文，没有译文的写通用句"输入内容不合法"；只有不认识的错误码才显示通用的失败文字。唯一例外：记忆服务的 409 `MEMORY_MODEL_CONFLICT` 按契约 16.3 原样显示其 `detail`（第 340 行）。另见第四部分第 6 条：导出超行数需要一个可翻译的原因码 | 负责人的决定与这几处字面冲突，规格自己的第 459 行也与它们冲突；英文 `message` 是开发者文字，不能面向运营 | `task-3-report.md` 变更 1；`task-28-report.md:116`；`task-29-review.md:45`；`export-row-limit.md` |
| 2 | 4.4（第 122 行）"留存页的日期标签" | "留存页的日期标签是'检查日'，提示'会回填该日对应的各个 N 的格子，不是整行重算'" | 加限定：这只适用于"活跃留存"和"通话留存"两个页签；"回流留存"页签的落地日期是统计日，`reactivation` 的汇总表主键是 `statDate`、没有 N 格子，不能写"回填各个 N 的格子" | 契约 17.6"补数"一行只对 `retention`、`guest-cohort`、`guest-retention` 写"填 `cohortDate = D − N` 的格子" | `task-17-review.md`（不是缺陷 1） |
| 3 | 5.1 看板，"6 张 `StatCard`" 和 "数据"两条。**待负责人先定** | "每张有当前值、较昨日、较 7 天前"；"当天的值是临时值，卡片旁标注…" | 写明当前值是不是未过完的今天：按字面做时，UTC 零点后的头几个小时今天只有一小部分，较昨日几乎所有卡都是很大的负数。若运营该看完整日的比较，改成"最近一个完整日"（这是变更，页面现在按字面做并标"临时值"） | 规格没有写变化值怎么处理 | `task-21-report.md`（第 1 条）、`task-21-review.md` |
| 4 | 5.1，D1 卡 | "D1 留存（`ACTIVE` 类型里最新一个 `d1` 非空的 cohort）" | 补一句：D1 卡的当前值不是今天而是最新有 `d1` 的 cohort，"较昨日"就是这个 cohort 的前一个 cohort | 规格没写，页面这样做 | `task-21-report.md`（第 2 条） |
| 5 | 5.1，趋势图 | "趋势图：范围预设（今天、近 7 天、近 14 天、近 30 天、自定义）…每个指标叠加一条虚线的'上周同期'"；"各取最近 90 天" | 写明自定义范围最早只能到 90 天前，"上周同期"的虚线在最早的七天没有数据（留空档） | 数据只取最近 90 天 | `task-21-report.md`（第 3 条） |
| 6 | 5.1，平台分布 | "环形图，当日 `ANDROID` 与 `IOS` 的 `dau`" | 写明占比是这两个平台的占比；`unknown` 平台（契约 §17.6）的日活不在里面，所以占比和日活卡上的总数对不上 | 同左 | `task-21-report.md`（第 4 条） |
| 7 | 5.4 游客统计，"落地条"（第 246 行） | "落地条（`STATS:LAND`）：同时调 `daily-business`、`guest-cohort` 和 `guest-retention`，在游客日报、转化进度队列、游客留存三个页签显示" | 补一句：这个条的日期，对游客日报是统计日，对转化进度队列和游客留存两张表是检查日（页面上的说明已经这样写） | 规格没写这个条的日期含义 | `task-18-report.md` |
| 8 | 5.7a 末尾 | "设备列表不在管理后台，是用户自己的功能（Java 2.9）" | 删去这句，或改成"用户自己的设备列表（登录链）在 Java 2.9，不在管理后台；管理后台看到的是推送注册" | 与 5.7 的"设备"页签、契约 §17.4 的 `GET /users/{id}/devices` 矛盾；契约 2.9 的"设备列表"是用户自己的登录会话，两者不是一回事 | `task-16-report.md`；`task-16-review.md`；`users.md` 六.1 |
| 9 | 5.0 "用户详情 `/users/:id`" 行（或 5.7） | 没有写详情页的页签怎么选；5.10 额度账户写"点开进用户详情的'额度'页签" | 加：详情页用 `?tab=` 选页签，取值 `overview`、`avatars`、`attribution`、`sessions`、`devices`、`authEvents`、`entitlements`、`credits`、`memory`；没有查看权限的页签、不认识的取值都打开概览 | 额度账户页和额度流水页已经链接 `/users/<id>?tab=credits`，这些取值是其他模块链接过来的地址约定 | `task-16-report.md`；`task-12-report.md`；`task-16-review.md` 变更 3；`users.md` 六.2 |
| 10 | 5.10 权益定义与功能值（第 293 行） | 只写了权益列表和功能值编辑，没有新增、编辑权益 | 补："新增、编辑权益（`POST/PUT /entitlement-defs`，需 `SUBSCRIPTION:CONFIG`；key、名称、优先级）"。**待负责人先定**：这两个对话框是任务书和规格都没有的新增行为，评审要求负责人确认保留还是删除 | 契约有这两个接口，权益"由运营在后台创建"，没有它们这一页只能看不能建 | `task-11-report.md`；`task-11-review.md` C2 |
| 11 | 5.10 商品映射（第 295 行） | "列商店、商品 ID、对应权益、在售开关、排序" | 补："新增、编辑映射和在售开关（`PUT /subscription-products`，需 `SUBSCRIPTION:CONFIG`）"。同上待负责人先定 | 同上 | `task-11-report.md`；`task-11-review.md` C2 |
| 12 | 5.10 功能开关（第 294 行） | "额度单价只有永久的 `LIMIT` 开关可编辑"，没写保存的接口和权限 | 补："`PUT …/credit-cost` 需 `SUBSCRIPTION:CONFIG`" | 5.0 表已写 `…/credit-cost`，权限没写 | `task-11-report.md` |
| 13 | 5.10 事件重处理（第 296 行） | "列表看 `FAILED`，每行'重新处理'" | 写清"失败"的定义（等后端回复 `subscriptions.md` 五之后：`error` 不为空，还是 `status=FAILED` 的别的含义） | 页面只在 `error` 不为空的行上显示"重新处理" | `task-11-report.md` |
| 14 | 5.10 功能开关（第 294 行） | 文字额度："保存权益的功能值时同样提醒" | 把文字额度提醒的文字也写进规格（现在只写了通话那句"这个权益的订阅用户通话不受日额度、月额度限制"） | 页面按两个键对称做了（`QuotaWarnings`），文字是实现者拟的 | `task-11-report.md` |
| 15 | 5.10 订阅统计。**待负责人先定** | "活跃订阅数、新增、续订、取消、过期、退款次数，按商店和商品分" | 写明顶部"活跃订阅数"取哪一天：现在取"行里最后一天"，最后一天只要有一行 `active` 为 `null`（契约 17.6：当天快照没有时为 `null`）整张卡就显示"—"；建议改成"取最后一个有快照的日子并写出是哪一天" | 默认范围含今天，所以大概率显示"—" | `task-11-review.md` C3 |
| 16 | 5.10 额度包（第 298 行） | "列商店、商品 ID、额度数、在售开关、排序" | 若运营要在管理端设置额度包的适用端，补上 `surfaces` 这一列和编辑方式；不需要则写明"适用端不在管理端设置"。现在页面不显示、不改，保存时原样带回 | 契约 `CreditProduct` 有 `surfaces` | `task-12-report.md`；`credits.md` 一 |
| 17 | 5.10 额度流水（第 301 行） | "筛选账号 ID（精确）、原因、类型（全部、获得、消耗）、时间范围" | 写明时间范围是 UTC 日（页面发 `[起始日 00:00:00Z, 结束日后一天 00:00:00Z)`）；待后端回复 `credits.md` 二后与接口对齐 | 契约 §15.9 只写"`from`、`to` 按 `createdAt`" | `task-12-report.md`；`credits.md` 二 |
| 18 | 5.11 发送记录（第 310 行）和计划 | 规格："展开行显示对每个 token 的发送结果" | **规格不用改**；计划里"详情用抽屉"那一句要改成"没有自己的路由"（见 3.3） | 规格明确写了展开行，页面按它做 | `task-22-report.md`；`task-22-review.md` 不是缺陷 1 |
| 19 | 5.11 召回参数（第 312 行） | "`recall.*`、`push.default_locale`，渲染同 5.15" | 改成"`PUSH:CONFIG` 的全部键"（实际有 12 个：另有 `push.schedule_scan_seconds`、`push.guest_token_retention_days`、`push.schedule_catchup_minutes`、`push.task_lease_minutes`、`push.task_image_retention_days`） | 该权限码下的键不止 `recall.*` | `task-22-report.md` |
| 20 | 5.12 分享统计的"渠道分析"（第 318 行） | 写了分享渠道下拉、饼图、前 5 个渠道趋势线、明细表，没有写下拉选的渠道作用在哪几块 | 写明：下拉只筛明细表和导出（导出带 `shareChannel`），饼图和趋势线始终是全部渠道；或者写"三块都筛"（页面现在按前者，只选一个渠道时饼图永远是 100%）。**待负责人先定** | 契约的 `share-channels` 接口有 `shareChannel` 参数，筛选是接口级的 | `task-23-report.md`；`invite.md` 六；`task-23-review.md` |
| 21 | 5.12 裂变层级页签 | 同 3.1 第 6 行（链路节点数 → 链数） | 同 3.1 第 6 行 | 同 3.1 第 6 行 | `task-23-report.md` |
| 22 | 5.0 "投放效果 `/campaign/stats`"行的接口栏 | "`/attribution/performance`（有落地条 `attribution-daily`）" | 补："`GET /attribution/campaigns`（`ATTRIBUTION:VIEW` 也能读，契约 §17.4 通则第 5 条）、`GET /config`（读成本币种 `attribution.cost_currency`）" | 页面实际还用这两个接口 | `task-25-report.md` |
| 23 | 5.13 点击明细（第 331 行附近） | "关键字（IP 或 UTM）" | 补："完整 IP 的精确匹配只在持有 `ANALYTICS:IP_VIEW` 时生效，否则忽略"（页面已写说明） | 契约的规则，规格没写 | `task-25-report.md` |
| 24 | 5.14 系统监控（第 341 行）。**条件：负责人接受页面的时间范围按钮才改** | 只写了"按 `source` 筛选"，没有写时间范围 | 补："时间范围默认最近 24 小时，可选 1 小时到 7 天（契约 §14.1 的 `monitor.max_range_days`）" | 页面有"最近 1 小时 / 6 小时 / 24 小时 / 3 天 / 7 天"五个按钮 | `task-13-report.md`（变更候选 1） |
| 25 | 5.14 系统监控（第 341 行）。**条件：负责人接受后才改** | "页面上有一个链接跳到成本报表" | 改成"有 `COST:VIEW` 时是链接，没有时是纯文字说明" | 没有 `COST:VIEW` 的人点链接只会得到 403 | `task-13-report.md`（变更候选 2） |
| 26 | 5.16 管理员（第 356 行） | "启用/停用（不能停用自己，最后一个启用的超级管理员不能被停用）" | 补全并写明被拒绝时的错误码：不能停用或删除自己、不能修改自己的角色和 `superAdmin`、最后一个启用的超级管理员不能被停用、删除、清除标志；错误码待后端回复 `system.md` 一.1 后写进去；页面按错误码显示译文 | 契约错误码表里没有对应的码 | `task-31-report.md` |
| 27 | 5.16 管理员（第 356 行） | "初始密码（规则同 3.3，创建后 `mustChangePassword` 为真）" | 写明最小长度来自 `GET /me` 的 `passwordMinLength`，不是 `GET /meta` | 后端回复第 2 条 | `task-31-report.md` |
| 28 | 5.16 角色（第 357 行） | "勾选父节点同时勾选全部子节点，保存时整体替换该角色的权限集合" | 补写取消时的行为：取消一个后代时父节点的码也从列表里去掉（现在的做法）；并说明后果——通过这个树不能给角色"页面码加上一部分功能码"以外的组合。**待负责人先定**是保持，还是改成取消后代时保留祖先的码、父节点复选框用三种状态 | 契约 §17.3 只写了勾选，没写取消 | `task-31-report.md`；`task-31-review.md` |
| 29 | 5.16 审计日志（第 359 行） | "筛选管理员、动作、对象类型、对象 ID、时间范围" | 写明：`from`/`to` 的格式（待后端回复 `system.md` 四.1）、`detail` 的类型（待回复四.3）、`adminId`、`action`、`targetType`、`targetId` 是精确匹配 | 契约 §17.4 没写 | `task-31-report.md` |
| 30 | 5.17 素材（第 369 行附近） | "…再填类型、语言、点击动作与目标、时长、可否跳过…" | 改成"类型、尺寸、大小、时长由上传记录给出，只读；再填语言、点击动作与目标、可否跳过…" | 契约 §22.9：`type`、`width`、`height`、`bytes`、`durationSeconds` 全部取自上传记录，请求里带了也忽略 | `task-27-report.md`；`ads.md` 九.1 |
| 31 | 5.17 广告位与全局设置 | "`GET /config` 和 `PUT /config/{key}` 的 `ads.*` 键" | 改成"`ADS:PLACEMENT` 的全部键（9 个）"；第十个 `ads.log_retention_days` 的编辑权限是 `CONFIG:MANAGE`，只在系统配置页出现 | 同左 | `task-27-report.md`；`ads.md` 九.2 |
| 32 | 5.17 单元（第 368 行） | "状态：草稿 → 投放中 ⇄ 暂停；删除只允许草稿且没有素材" | 写明激活、暂停、恢复是否要确认（页面先问一次，与计划的"行内确认"一致）。**待负责人先定** | 规格没写 | `task-27-report.md`；`ads.md` 九.3 |
| 33 | 5.18 渠道（第 376 行） | "删除或停用前提示：它是唯一启用的通道且手机号登录已开启时不能删除、不能停用" | 按契约 §23.4 改成"手机号登录已开启**或存在手机号账号**"，并把"改类型、改国家使它不再是最后一个覆盖的启用验证码通道"也写进去；模板同理 | 契约 §23.4 的条件更宽 | `task-28-report.md`；`sms-email.md` 一.9–一.11 |
| 34 | 5.18 渠道表单 | "…国家、类型…、优先级…、启用" | 写明"启用"只在创建时填，编辑时用列表里的开关（`PUT …/enabled`） | 编辑请求体不带 `enabled` | `task-28-report.md` |
| 35 | 5.18 发送记录（第 378 行） | "页面右上角有'导出 Excel'按钮…筛选消息 ID、供应商消息 ID、号码…" | 导出按钮的文字与共用控件（"导出"）对齐，或改共用控件；写出筛选的参数名（待后端回复 `sms-email.md` 三.1） | 规格写"导出 Excel"，共用控件文字是"导出" | `task-28-report.md` |
| 36 | 5.19 应用版本，"APK 上传"（第 389 行），与本表第 1 行同一规则 | "文件没有 v2 以上签名时显示后端的错误原因" | 二选一：后端给专用的原因码并加译文；或改成"显示 `INVALID_FILE` 的译文，并在上传区旁写明需要 v2 以上签名"（页面现在是后者） | 与"已知错误码只显示译文"冲突 | `task-29-report.md`；`task-29-review.md`；`app-versions.md` 五.1 |
| 37 | 5.19"预置三行"一句；5.0 的"渠道包 `/system/channels`"行和各页面的渠道包下拉说明 | "预置三行：`play`、`direct`、`appstore`"，没有写渠道包列表的字段名 | 写明渠道包的字段名是契约 §24.7 `Channel` 实体的列 `code`，不是 `channelCode`（`channelCode` 是别的实体上引用渠道的字段）；`GET /channels` 的形状待后端回复 | 之前任务 9 的读取和问题文件写的是 `channelCode`，对遵守契约的后端所有渠道下拉都是空的；前端已在提交 0201f1c 改成读 `code` | `task-29-report.md`；`app-versions.md` 一.1、五.2；提交 0201f1c |
| 38 | 5.20 站内通知（第 399 行） | "收件账号（每行一个账号 ID，最多 1000 个…）""标题和正文（…`en` 必填；标题 ≤ 100、正文 ≤ 500 个字符，实时计数）" | 改成"最多 `maxRecipients` 个（`notification.max_recipients`，默认 1000，页面取 `GET /meta` 的 `maxRecipients`）"；长度写成"先按契约 1.9 去首尾空白，再按 Unicode 码点数" | 上限是配置；长度口径见后端回复第 11 条 | `task-30-report.md` |
| 39 | 5.21 客户端配置（第 406 行） | "`URL` 只允许 https""'重置'删除该键全部语言值""保存只提交改动过的键" | "`URL` 符合契约 1.7 的链接规则"（大写 `HTTPS`、空端口、非 ASCII 主机或路径、用户信息等都不行）；把"重置"和契约 26.1 的"缺省语言可重置"写清是两种操作、各叫什么；"一次只保存一个键，没有改动时不能保存" | 与契约 1.7、26.1 不一致 | `task-30-report.md` |
| 40 | 5.21 只读键（第 408 行） | "由某某配置决定，在系统配置里改" | 接口给 `source`（系统配置的键名），见第四部分第 7 条；在那之前页面把六个对应关系放在语言文件里 | `GET /client-config` 没有给这个对应关系 | `task-30-report.md`；`notifications.md` 二.5 |
| 41 | 5.22 任务配置（第 419 行） | "已有任务记录的配置，类型和目标值只读" | 补一句数据从哪里来：`GET /tasks/configs` 要有 `hasRecords`（见第四部分第 3 条），否则这一条只能在保存失败（409 `TASK_HAS_RECORDS`）之后才能做到 | 契约没有能回答"有没有记录"的字段 | `task-24-report.md`；`activity.md` 一、六 |
| 42 | 5.22 任务配置 | "任务类型（必填，选项取自后端声明的类型：每日登录、每日通话时长、每日文字消息…）" | 写明声明在哪里（目前没有接口，也不在 `GET /meta` 里，页面写死三个）；见第四部分第 8 条 | 同左 | `task-24-report.md`；`activity.md` 四.2、六 |
| 43 | 5.22 签到统计（第 418 行） | "…导出 Excel…" | 写明两个页签各导哪一个：契约有两个导出名 `checkin-daily-users`（每日签到人数）、`checkin-streaks`（连续签到分布） | 规格只写"导出 Excel" | `task-24-report.md`；`activity.md` 五.2 |
| 44 | 5.23 成本，报表顶部（第 427 行） | "LLM 对账以阿里云账单为准" | 改成"LLM 对账以云厂商账单为准"（页面中文"云厂商账单"，英文"cloud vendor's bill"） | 项目规则：仓库里不出现第三方产品名。契约里同步适配器取值 `DASHSCOPE_INTL` 是协议值，页面在适配器下拉里原样显示 | `task-26-report.md`；`task-26-review.md` 不是缺陷 5 |

（以上 44 行中，第 18 行是"规格不用改"的核对记录；第 21 行是与 3.1 第 6 行重复的交叉引用；第 24、25 行是有条件的，负责人不接受页面上的那个做法就不用改；其余 40 行都要改。其中第 1、3、10、11、15、20、28、32 行带"待负责人先定"，先定了行为再改文字。）

## 3.3 不是改规格，是改计划或任务书的两条

| 序 | 位置 | 现在的文字 | 应改成 | 来源 |
|---|---|---|---|---|
| 1 | 计划第 39 行"通话 / 订阅 / 客服"一行（`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`） | "详情用抽屉" | "没有自己的路由"（它的理由是规格没给详情路由，不是规定详情的形式；5.11 发送记录和埋点明细规格明确写了展开行，以规格为准） | `task-22-report.md`；`task-22-review.md` 不是缺陷 1 |
| 2 | 任务书 31（计划里任务 31 的文字） | "`GET /roles` 要 `ROLE:MANAGE`" | "`GET /roles` 要 `ROLE:MANAGE`，另允许 `ADMIN:MANAGE`"（契约 §17.4 附·通则第 5 条；后端回复第 9 条） | `task-31-report.md`；`system.md` 一.7 |

---

# 第四部分：变更请求给契约（AvatarApp main）

> **给谁：** 项目负责人，由他决定谁在 AvatarApp `main` 上改 `docs/backend-task-java-backend.md`（本仓库的快照只读，提交 36626b12 对应的内容）。
> **性质：** 这些是前端需要的契约变更，不是问题。每条按 `CLAUDE.md` 写成完整的变更请求：名称、行为、检查顺序、错误、测试。"检查顺序"和"错误"里凡是契约、回复里没有写明的，是我们的提议，标"提议"，由改契约的人定。前端的暂定做法在第二部分各条里，后端落地后改前端。
> **共 9 条完整的请求，加一张"其他要在契约里补的文字"的表。**

## 4.1 【安全】后台读订阅的接口对 Google 购买令牌脱敏

- **名称：** 订阅读取接口对 Google 订阅的令牌只返回末 6 位。
- **现状：** 契约 15.3：`GET /subscriptions` "每项是 `Subscription` 的列"，含 `storeRef`（Google 就是 `purchaseToken`）和 `linkedPurchaseToken`；15.2 的绑定规则让持有购买凭证的人可以在 `google/verify` 认领订阅。所以持有 `SUBSCRIPTION:VIEW`（页面入口权限，客服也有）的管理员，在响应 JSON 里看得到完整令牌，前端不显示也挡不住开发者工具。
- **行为：** `GET /subscriptions`、`GET /subscriptions/{id}`，以及返回 `linkedPurchaseToken` 的所有位置：Google 订阅的 `storeRef` 和 `linkedPurchaseToken` 只返回末 6 位，字段名带 `Suffix`（沿用 17.4 附表第 8 条 `tokenSuffix` 的做法；字段的具体名字，例如 `storeRefSuffix`、`linkedPurchaseTokenSuffix`，由改契约的人定）；Apple 的 `originalTransactionId` 不变。若运营确实要完整令牌，需要单独的权限码和审计日志，不放进 `SUBSCRIPTION:VIEW`。
- **检查顺序、错误：** 只是响应字段变化，没有新错误；列表筛选里没有按令牌筛选的参数，不受影响。
- **测试：** 持有 `SUBSCRIPTION:VIEW` 的管理员读一条 Google 订阅，响应里找不到完整令牌（列表、详情、嵌套的 `linkedPurchaseToken` 都查）；Apple 订阅的标识照旧返回；末 6 位字段等于完整令牌的末 6 位。
- **前端配合：** 订阅详情抽屉对 Google 只显示 `…` 加末 6 位，不带复制按钮（已做）。
- **来源：** `docs/superpowers/handoff/reports/task-11-review.md` 变更 C1（那里已写完整）；`subscriptions.md` 九。

## 4.2 【安全】非超级管理员不能操作超级管理员账号

- **名称：** 超级管理员账号受保护：只有超级管理员能对它做危险操作。
- **现状：** 契约 §17.4 系统管理行没有写这种情况。持有 `ADMIN:MANAGE` 但不是超级管理员的人，可以对超级管理员重置密码和二次验证，再自己登录并绑定验证器，等于接管超级管理员账号（任务 31 评审发现）。
- **行为：** 调用者的 `superAdmin` 为假，而目标管理员的 `superAdmin` 为真时，下面五个操作一律拒绝：`PUT /admins/{id}`（改角色、改 `superAdmin`）、`POST /admins/{id}/status`（停用）、`POST /admins/{id}/reset-password`、`POST /admins/{id}/reset-totp`、`DELETE /admins/{id}`。读（`GET /admins`）不受影响。超级管理员对超级管理员的操作规则不变（仍受"不能停用或删除自己""最后一个启用的超级管理员不能被停用、删除、清除标志"约束）。
- **检查顺序（提议）：** 令牌有效 → 不在"必须改密码"状态 → 持有 `ADMIN:MANAGE`（403 `ADMIN_FORBIDDEN`）→ 目标存在（404 `RESOURCE_NOT_FOUND`）→ 调用者非超级管理员且目标是超级管理员（403）→ 针对自己的保护 → 最后一个超级管理员的保护（409）→ 请求体校验（400）。
- **错误：** 403，错误码由改契约的人定：沿用 `ADMIN_FORBIDDEN`，或和"针对自己的保护"一起定专用码（见 2.2 第二条问题，建议 `ADMIN_SELF_PROTECTED`、`LAST_SUPER_ADMIN` 一类）。是否对被拒绝的尝试写审计日志，也由改契约的人定。
- **测试（提议）：** 非超级管理员（有 `ADMIN:MANAGE`）对超级管理员做五个操作，各得 403，且目标的密码哈希、二次验证状态、令牌版本、角色、状态都没有变；对普通管理员做同样的操作成功；超级管理员对超级管理员和对普通管理员做这些操作的原有行为不变；针对自己和最后一个超级管理员的测试照旧。
- **前端配合：** 目前不改，按钮的显示只看权限码和"自己"的保护，后端是最终裁决；如果负责人希望前端也挡一层（对超级管理员那一行，非超级管理员看不到这些按钮），这是新增行为，要先确认。
- **来源：** `system.md` "补充"一节；`task-31-review.md`。

## 4.3 任务配置带 `hasRecords`，并明确"原值不算改"

- **名称：** `GET /tasks/configs` 和 `GET /tasks/configs/{id}` 的每个任务配置带 `hasRecords`。
- **现状：** 规格 5.22 要求"已有任务记录的配置，类型和目标值只读"；契约 §28.2 的 `TaskConfig` 列、后端第 17 条回复都没有能回答"有没有记录"的字段，`GET /tasks/records` 也不能按任务筛选。页面只能在保存失败（409 `TASK_HAS_RECORDS`）之后才把这两个字段变成只读。
- **行为：** 响应加布尔字段 `hasRecords`：该配置是否已有至少一条 `TaskRecord`。同时在契约里写明：对有记录的配置，`PUT /tasks/configs/{id}` 带**没改的** `taskType` 和 `targetValue` 视为无变化，成功；只有改了其中之一才返回 409 `TASK_HAS_RECORDS`（页面的 `PUT` 是整条替换，改名字或奖励时也会带着这两个字段的原值）。
- **检查顺序、错误：** 读接口没有新错误。`PUT` 的顺序（提议）：权限 → 配置存在（404）→ 请求体校验（400）→ 有记录且 `taskType` 或 `targetValue` 与库里不同（409 `TASK_HAS_RECORDS`）→ 保存。
- **测试：** 没有记录的配置 `hasRecords` 为假；产生一条任务记录后为真（列表和详情都查）；有记录时 `PUT` 带原值改名成功；带不同的 `targetValue` 返回 409 `TASK_HAS_RECORDS` 且什么都没改；`DELETE` 有记录的配置仍返回 409 `TASK_HAS_RECORDS`。
- **前端配合：** 页面已预留：行里带 `hasRecords: true` 时一打开表单就只读。
- **来源：** `activity.md` 一.1、一.2。

## 4.4 客户端配置 `PUT` 加 `expectedUpdatedAt`，防止两个管理员互相覆盖

- **名称：** `PUT /client-config/{key}` 接受 `expectedUpdatedAt`。
- **现状：** 契约 26.3：`PUT /client-config/{key}` 请求体 `{"values":{…}}`，整体替换这个键的全部语言值，请求里没有"我读到的版本"。两个管理员同时打开同一个键，后保存的会把先保存的新加的语言静默删掉。
- **行为：** 请求体可选加 `expectedUpdatedAt`：取 `GET /client-config` 里该键的 `updatedAt`（取各语言行里最近更新的那一行；库里没有行时为 `null`）。带了它，且与库里该键当前最近更新时间不同（含"传了时刻但库里没有行""传了 `null` 但库里已有行"），返回 409 `INVALID_STATE`，整个键什么都不改；不带它，行为和今天完全一样（向后兼容）。
- **检查顺序（提议）：** 权限（403）→ 键已登记（404 `RESOURCE_NOT_FOUND`）→ 键不是只读（400，同现在）→ `expectedUpdatedAt` 比较（409 `INVALID_STATE`，`data` 里可带当前的 `updatedAt`）→ `values` 逐项校验（400 `INVALID_REQUEST`，`details` 同 26.3）→ 在一个事务里整体替换。
- **错误：** 409 `INVALID_STATE`（已有的码）。
- **测试：** 带的值与库里相同时成功；别人先保存后，用旧的 `expectedUpdatedAt` 保存得 409，且库里的值是别人保存的那一份；库里没有行时传 `null` 成功、传一个时刻得 409；库里已有行时传 `null` 得 409；不带该字段时保存成功（兼容）；409 之后没有任何语言值被改动。`POST …/reset` 要不要同样接受它，由改契约的人定。
- **前端配合：** 页面现在在保存前重新读取这个键，和打开时的 `updatedAt`（没有就比各语言的值）比较，不一致就不保存，提示"已被他人修改"并给"重新载入"（见 `2026-10-27-admin-frontend-concurrent-save.md`）；读和写之间仍有时间窗，后端支持 `expectedUpdatedAt` 后页面把它放进请求体，409 走同一个提示。
- **来源：** `notifications.md` 二.4。

## 4.5 `GET /sms/meta` 加 `phoneLoginEnabled` 和 `phoneAccountCount`

- **名称：** 短信元信息接口告诉前端手机号登录是否开启、有多少手机号账号。
- **现状：** 契约 §23.6（快照第 3717 行）：`GET /sms/meta` 返回 `{providers:[{code, allowedHosts}], testRemainingToday}`，权限为任一 `SMS:*`。删除、停用、改 `smsType` 或 `countries` 使它不再是最后一个覆盖的启用验证码（`OTP`）通道，在 `auth.phone_login_enabled=true` **或存在手机号账号**时返回 `INVALID_REQUEST`。页面无从知道"存在手机号账号"，`GET /config` 只返回当前管理员有权编辑的键，没有 `CONFIG:MANAGE` 的管理员连 `auth.phone_login_enabled` 都读不到。
- **行为：** 响应加 `phoneLoginEnabled`（布尔，等于 `auth.phone_login_enabled` 的当前值）和 `phoneAccountCount`（整数，现有手机号账号的数量）。权限与 `GET /sms/meta` 现有的相同（任一 `SMS:*`），只读，不写审计日志。
- **检查顺序、错误：** 无新错误；上面那条拒绝规则本身不变。同时建议（见 2.19 第八条问题）这类拒绝换一个专用错误码（如 `LAST_OTP_CHANNEL`），或在 `data.details` 里给 `ref`（`channel`）和 `reason`，页面就不必靠"操作前提示"推断原因。
- **测试：** 手机号登录开启、有手机号账号时两个字段如实返回；关闭且没有手机号账号时为 `false` 和 `0`；只持有 `SMS:RECORD` 的管理员也能读；响应里原有两个字段不变。
- **前端配合：** 拿到后页面在操作前直接写出结论；现在写"读到就写明开着还是关着，读不到就写'读不到'，并写明存在手机号账号时后端同样拒绝，本页看不到有没有"。
- **来源：** `sms-email.md` 一.9、一.10。

## 4.6 导出超过行数上限时返回可翻译的结构化原因

- **名称：** 导出超过 `export.max_rows` 的错误带原因码和上限数字。
- **现状：** 契约 17.6 导出一节：超过 `export.max_rows`（`export.max_rows` 默认 100000，快照第 2499 行）返回 400 `INVALID_REQUEST`，"`message` 提示缩小范围"。`message` 是英文开发者文字，界面按负责人的决定（已知错误码只显示译文）不显示它，所以管理员只看到通用的"输入内容不合法"。
- **行为：** 该 400 的 `data.details` 里放一项 `{"ref":"range","reason":"EXPORT_TOO_MANY_ROWS"}`，并在 `data` 里带上限 `maxRows`（整数）。适用于 `GET /stats/export/{name}`、`GET /users/export`、`GET /sms/records/export` 以及所有按 `export.max_rows` 限制的导出。
- **检查顺序（提议）：** 权限（403）→ 参数校验（400，其他原因）→ 行数检查（400 `EXPORT_TOO_MANY_ROWS`）→ 生成文件；每小时次数限制（429 `RATE_LIMITED`）的位置不变。
- **错误：** 400 `INVALID_REQUEST`，原因码 `EXPORT_TOO_MANY_ROWS`（新增，需要加进 §1.4 的原因代码清单）。
- **测试：** 构造超过上限的范围，响应的 `data.details` 恰好含这一项，`data.maxRows` 等于当前配置值；不超过时正常返回 `.xlsx`；改了 `export.max_rows` 后 `maxRows` 跟着变；没有导出权限仍是 403。
- **前端配合：** 拿到后加 `reason.EXPORT_TOO_MANY_ROWS`（带 `{maxRows}`）的译文，去掉 `ExportButton` 现在在任何 400 `INVALID_REQUEST` 后追加的那句固定提示。
- **来源：** `export-row-limit.md`；`sms-email.md` 三.5；`ads.md` 八.4。

## 4.7 `GET /client-config` 加字段，并加预览接口

- **名称：** 客户端配置的登记信息补全，并让后端算预览。
- **现状：** 后端`docs/backend-inputs/2026-10-21-avatar-backend-reply-to-avataradmin.md:1`列出 `GET /client-config` 每项的全部字段（`key`、`type`、`localized`、`readOnly`、`configured`、`defaultValue`、`values`、`updatedBy`、`updatedByUsername`、`updatedAt`），并写明"这里写的就是全部"。整数范围、文字最大长度（`inviteShareText` 500、`inviteShareTitle` 200）、`inviteShareText` 的可用占位符、`inviteLinkBase` 不能带查询或片段，都只在契约 §26.2 的文字里；只读键对应的系统配置键名也不在接口里；预览要靠前端按契约 1.2 和 26.1 自己算。
- **行为：** （a）每项加 `min`、`max`（`INT`）、`maxLength`（`STRING`）、`placeholders`（允许的占位符名数组）；（b）`readOnly` 为真的键加 `source`（对应的系统配置键名，如 `auth.phone_login_enabled`）；（c）新增只读接口 `GET /client-config/preview?acceptLanguage=…`，返回后端按同一份缓存和同一个算法算出的各键的值与来源（用到的是请求语言命中了哪个条目，还是回退到不带语言的值，还是回退到登记的默认值）。
- **检查顺序、错误：** （a）（b）只是响应字段增加，无新错误；（c）权限同 `GET /client-config`（`CLIENTCONFIG:VIEW`），`acceptLanguage` 不是合法语言标签时 400 `INVALID_REQUEST`（`details` 的 `ref` 为 `acceptLanguage`，`reason` 为 `INVALID_LANGUAGE_TAG`）。
- **测试：** 每个 `INT` 键的 `min`/`max`、每个 `STRING` 键的 `maxLength` 与契约 §26.2 一致；`readOnly` 的六个键都有 `source`；预览接口对 `zh-TW`、`zh-HK`、`th`、`ar`、`id`、`vi`、`es` 及不在列表里的标签，返回与客户端实际收到的完全相同的值；"同一主语言有多个条目时按什么顺序取第一个"在契约里写明（前端现在按标签的字母顺序理解，契约没有说）。
- **前端配合：** 拿到（a）后页面在输入时检查，不必等后端拒绝；拿到（b）后不再在语言文件里存六个对应关系；拿到（c）后预览直接显示后端的结果，不再自己算。
- **来源：** `notifications.md` 二.3、二.5、二.7；`task-30-report.md`。

## 4.8 `GET /api/admin/meta` 补六个值

- **名称：** 元信息接口补上页面读不到的六个配置值。
- **现状：** `GET /config` 只返回当前管理员有权编辑的键；下面这些值所在的键，编辑权限不属于使用它们的页面的权限，所以持有页面权限的管理员读不到。后端回复第 1 条和第 3 份回复已把 `meta` 做成 20 个字段，下面这些不在其中。
- **行为：** 在 `GET /api/admin/meta`（同样规则：任何持有有效管理员令牌、不在"必须改密码"状态的管理员可调，只读，不写审计日志）里加：
  - `monitorMaxRangeDays`：当前生效的 `monitor.max_range_days`（管线监控页的时间范围上限）。来源 `memory-monitor-support.md` 五。
  - `attributionCostCurrency`：当前生效的 `attribution.cost_currency`（只有 `ATTRIBUTION:VIEW` 的管理员读不到，投放效果表头要写币种；也可以改为在 `performance` 的响应里带 `currency`）。来源 `campaign.md` 一.5。
  - `taskTypes`：后端声明的每日任务类型数组（`daily_login`、`call_seconds`、`text_messages`…），页面就不用写死。来源 `activity.md` 四.2。
  - `entitlementLimitMax`：当前生效的 `entitlement.limit_max`（权益功能值 `LIMIT` 的上限，默认 1000000）。来源 `subscriptions.md` 八。
  - `googlePlayPackageName`：环境变量 `GOOGLE_PLAY_PACKAGE_NAME` 的值（不含机密），商店链接检查用。来源 `app-versions.md` 三.8。
  - `creativeAspectTolerancePercent`：当前生效的 `ads.creative_aspect_tolerance_percent`（`GET /ads/meta` 里也可以，见 2.18 第三条问题）。来源 `ads.md` 三。
  另外 `GET /ads/meta` 建议加 `notSkippableFullScreenCount`（见 2.18 第四条问题）。
- **检查顺序、错误：** 同现有 `meta`，无新错误；值没有默认值又未配置时为 `null`，前端按"取不到时不预检、不显示数字"处理。
- **测试：** 每个字段等于对应配置键（或环境变量）的当前值；改了配置后下一次请求读到新值；`ATTRIBUTION:VIEW`、`SUBSCRIPTION:VIEW`、`ADS:CREATIVE` 等只持有页面权限的管理员都能读到；在"必须改密码"状态下返回 403 `ADMIN_FORBIDDEN`；响应里不出现任何机密。
- **前端配合：** 现在各页取不到时都不做前端预检；拿到后各页加上限提示。
- **来源：** 上面各条。

## 4.9 【安全】会话列表的设备标识只返回前 8 位

- **名称：** `GET /sessions` 的游客设备标识只返回前缀。
- **现状：** 契约 §17.4 通话行写"`deviceId`（游客会话才有，只显示前 8 位）"，没说"只显示"是谁做。认证事件那一行用 `deviceIdHashPrefix`（只给前 8 位），这一行字段名是 `deviceId`。完整的设备哈希是游客的稳定标识（游客额度、锁都按它），页面不需要，送到浏览器后在开发者工具、网络面板里都看得到。
- **行为：** `GET /sessions` 和 `GET /sessions/{id}` 的游客会话只返回设备哈希的前 8 位，字段名改为 `deviceIdPrefix`（或在契约里写明这两个接口里的 `deviceId` 就是前 8 位）。账号会话该字段为 `null`。
- **检查顺序、错误：** 只是响应字段变化，无新错误。
- **测试：** 游客会话的响应里找不到长度大于 8 的设备哈希；该前缀等于完整哈希的前 8 位；账号会话的该字段为 `null`；详情和列表一致。
- **前端配合：** 页面现在无论后端返回完整值还是前 8 位，都只取前 8 个字符显示，完整值不进页面文字、提示、属性，也不写日志。
- **来源：** `sessions.md` 二。

## 4.10 其他要在契约里补的文字（不新增行为，只补文字）

下面这些不是新行为，是契约没写清的地方；问题和暂定做法在第二部分，这里列出该写进契约的位置。

| 契约的位置 | 要补的文字 | 对应的问题 |
|---|---|---|
| §17.4 额度行末尾 | 现在写"消费额度按功能开关分"，而同一句里的响应形状 `spent` 先按 `spendKind` 再按功能或条目分，规格 5.10 写按消费类别。以响应形状和规格为准，这句话要改 | `task-12-report.md` 规格需要修改的地方第 3 条 |
| §17.4 通话行 | 写出 `GET /sessions` 五个筛选的参数名和格式；规格 5.5 因此不用改 | 2.5 第一条；`sessions.md` 六 |
| §17.4 推送管理行、响应字段表 | 补推送各接口的列表参数和响应字段 | 2.14 全部；`task-22-report.md` |
| §1.4 `INVALID_REQUEST` 原因代码清单 | 加 `EXPORT_TOO_MANY_ROWS`（4.6）；按需要加缺必含占位符、缺 v2 签名、商店链接各规则、最后一个验证码通道等专用原因码 | 2.19 第十三条、2.3 第十八条、2.3 第十二条 |
| §17.4 系统管理行 | 写出"不能修改自己的角色和 `superAdmin`""不能停用或删除自己""最后一个启用的超级管理员"的错误码 | 2.2 第二条 |
| §17.2 | 写出验证码锁定（`admin.totp_max_failures`）时的响应：429 是否带 `retryAfterSeconds`、哪一次开始、`enroll` 一步的行为 | 2.1 第三条 |
| 契约 §17.6 | 写出补数 `retention`、`reactivation` 各覆盖哪些行；汇总行缺失时各报表返回什么；`stats.max_range_days` 的"跨度"怎么数；游客留存能否按 `unknown` 平台查 | 2.4 |
| 契约 §1.7 | 给出客户端 `HttpsLink.PATTERN` 的完整正则原文和标志位 | 2.21 第二条 |

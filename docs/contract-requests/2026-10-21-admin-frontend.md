# 给后端的问题：管理端前端需要、后端的说明里没有的接口

> **写给：** AvatarBackend 会话（后端）。
> **依据：** 后端 2026-10-21 的说明（AvatarBackend 提交 1bc0b66）已读，管理端前端的计划已按它改完（`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`）。说明里定下的接口不再出现在这里。
> **规则：** 下面是说明里没有、管理端前端又需要的点。我们不自己猜：每条写了我们需要什么和为什么，"暂定做法"是后端回复之前前端临时的做法，回复之后改我们这边。契约和管理端前端设计只在 AvatarApp `main` 上改，我们不改它们。
> **回复方式：** 逐条回答"采用 / 不采用并说明实际是什么"即可，不需要重复我们的写法。

## 一、新增或补充的接口

### 1. 只读接口 `GET /api/admin/meta`：页面需要、但读不到的配置值

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

- `id`：管理员 ID。额度调账页要判断"申请人是不是我"，才能把"审核"按钮对自己的申请禁用（后端仍返回 403 `SELF_REVIEW_FORBIDDEN`）。
- `passwordMinLength`：`admin.password_min_length` 的当前值。强制改密码的管理员只能调 `me` 和改密码，所以放在 `me` 里。

**暂定做法：** 没有 `id` 时不禁用审核按钮，由后端的 403 兜底；没有 `passwordMinLength` 时不做长度预检。

### 3. 响应里的管理员带用户名

**为什么需要：** 页面要显示"谁操作的"，现在响应只有管理员 ID，运营看不懂。

**需要：** 凡是响应里表示管理员的 ID 字段，同时给一个同名加 `Username` 的字段：审计日志的 `adminUsername`；额度调账申请的 `applicantUsername`、`reviewerUsername`；照片里的人投诉的 `handledByUsername`；审核记录的 `reviewedByUsername`；推送任务和周期推送、应用版本、签到活动的 `createdByUsername`；邮件模板的 `updatedByUsername`；`GET /config` 每项的 `updatedBy` 请说明是管理员 ID 还是用户名（页面要显示用户名）。

**暂定做法：** 没有用户名字段时显示管理员 ID 的前 8 位。

### 4. 两个已有上传接口的文件字段名

`POST /uploads/image`（推送图片）和 `POST /ads/media`（广告素材）请求里的文件字段叫什么？说明里三个新上传接口是 `file`、"已有的上传不变"，契约也没写这两个的字段名（`POST /uploads/apk` 契约写了 `file`）。

**暂定做法：** `file`。

### 5. 列表和详情里能显示的图片地址

**为什么需要：** 响应按 17.4 通则只有 `previewRef`、`iconRef`、`sourceImageRef` 这类存储引用，浏览器不能直接显示。

**需要：** 在下面这些响应里加能显示的地址字段（短时效签名地址或公开地址，规则同审核内容的地址）：服装 / 背景目录的 `previewUrl`；动作目录的 `iconUrl`；默认数字人的 `sourceImageUrl` 和它的外观预览 `previewUrl`；`GET /accounts/{id}/avatars` 里每个外观的 `previewUrl`（用户的脸，仍写审计日志）。

**暂定做法：** 没有这些字段时列表显示占位图，不拼地址。

### 6. 默认数字人生成失败是什么状态

说明里的状态链是 `DRAFT` → `GENERATING` → `READY` → 生效，没有写生成失败。失败后是回到 `DRAFT`、还是有单独的状态？运营怎么重试？失败原因放在哪个字段？

**暂定做法：** 失败后回到 `DRAFT`，行里带 `failureReason`，再点"生成"重试；前端按"状态加可选的失败原因"画，不假设有 `FAILED`。

### 7. 封禁、解封接口的权限码

契约 17.4 用户管理行里 `USER:BAN` 只出现在模块的权限码列表里，没有标在 `POST /users/{id}/ban` 和 `POST /users/{id}/unban` 上。是 `USER:BAN` 吗？

**暂定做法：** `USER:BAN`。

### 8. 规则词表 `PUT /moderation/text-rules` 的请求体

契约 11.2 说词表是数组，每条 `{id, pattern, matchMode, level, note}`，`id` 保存时生成，但没写 `PUT` 的请求体是整个数组替换，还是逐条增删改。

**暂定做法：** 整表替换：请求体是整个数组，新增的条目不带 `id`；校验失败时 `data.details` 用规则 `id`（新增的用下标）指到行。

### 9. 下拉选项的来源接口的权限

页面权限和选项来源接口的权限不同，持有页面权限的管理员收到 403，选择器没法用：

| 页面（权限） | 选项来源接口（现在的权限） | 提议 |
|---|---|---|
| 管理员表单的角色多选（`ADMIN:MANAGE`） | `GET /roles`（`ROLE:MANAGE`） | 另允许 `ADMIN:MANAGE` |
| 用户详情"赠送服装"的条目选择（`COSMETIC:GRANT`） | `GET /cosmetics`（`COSMETIC:MANAGE`） | 另允许 `COSMETIC:GRANT` |
| 投放效果和归因明细的投放账户筛选（`ATTRIBUTION:VIEW`） | `GET /attribution/campaigns`（`ATTRIBUTION:MANAGE`） | 另允许 `ATTRIBUTION:VIEW` |
| 广告单元表单的计划和广告位（`ADS:UNIT`） | `GET /ads/campaigns`（`ADS:CAMPAIGN`）、`GET /ads/placements`（`ADS:PLACEMENT`） | 另允许 `ADS:UNIT` |

**暂定做法：** 遇到 403 时选择器禁用，并写明"需要某某权限才能列出选项"，不崩溃。

### 10. 越界时返回什么

- 列表的 `pageSize` 超过 200；
- 统计报表（`/stats/*`）的 `from`、`to` 跨度超过 `stats.max_range_days`（归因汇总说明里已写 400，其余没写）。

**暂定做法：** 400 `INVALID_REQUEST`；前端不依赖具体状态码，只展示后端文字。

### 11. 管理端字段的长度单位

契约对管理端字段（封禁理由 1–500、删除理由 1–200、通知标题 100 / 正文 500、任务说明 500、邮件标题 1–200、规则文本 1–200 等）只写"字符"；只有人格设定、伴侣名字、举报详情、反馈正文、`generationSpec` 明写 Unicode 码点。请说明这些是否都按码点数。

**暂定做法：** 都按码点数，首尾空白按契约 1.9 的 29 个码点去掉。

## 二、响应字段只用一句话描述的接口

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

**暂定做法：** 前端按契约 §18 的实体列和页面描述定义类型，字段名和上表不一致处，后端回复后我们改。

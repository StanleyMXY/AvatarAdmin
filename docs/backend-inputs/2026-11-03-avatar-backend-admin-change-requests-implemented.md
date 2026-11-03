# 后端已实现的管理端改动请求：给 AvatarAdmin 前端会话

本文件自成一体，与更新后的接口文档一起使用。凡措辞以接口文档为准；本文件只列出本批次的改动，并标出会破坏现有前端代码的部分。所有路径都以 `/api/admin` 开头，文中省略这个前缀。请求编号就是前端自己问题清单里的编号。

## 一、概要

前端共提出 41 条请求（按问题清单的行数计）：后端答复为 33 条建议做、8 条建议不做。33 条建议做的条目对应 28 个请求编号（编号 67 一条里含 6 个小项：`GET /meta` 的五个字段和 `GET /ads/meta` 的一个计数，所以占 6 行；其中广告计数同时就是编号 122 的内容，后端只实现了一次）。这 33 条已经全部在后端实现，没有未完成项，也没有新发现的遗留项。8 条不做的原因各一句（详见第四节）：

- 30 号（额度包乐观锁）：后台没有任何按 `updatedAt` 比较的乐观锁，单给额度包加一个会让后台写法不统一，应由契约统一规定。
- 42 号（开启手机号登录被拒时加 `missing` 数组）：`details` 已经说明缺哪几项，再加一个数组是重复信息。
- 52 号（游客留存 `platform=unknown`）：游客设备入库时平台必为 `ANDROID` 或 `IOS`，加这个选项永远是空表。
- 62 号（直接给等待秒数）：每行带服务器时间的秒数在缓存和重复请求下立刻过时，前端用创建时间自己算；`oldestPendingSeconds` 已给出服务器时钟下最老一条。
- 65 号（客服反馈列表摘要模式）：筛选已能缩小结果，接口文档规定列表返回全部列，前端把 `pageSize` 设小即可。
- 67 号中的 `attributionCostCurrency`：成本页持有 `ATTRIBUTION:MANAGE`，`GET /config` 已返回该键，成本行和投放效果已带 `currency`。
- 70 号（改币种配置的 reason、拒绝 `ZZZ`）：配置值校验的 reason 是封闭集合，格式问题统一用 `OUT_OF_RANGE`，拒绝 `ZZZ` 要维护币种清单，收益很小。
- 93 号（漏斗步骤事件名含逗号）：事件名本身不可能含逗号，转义规则没有对象可用。

本批次没有其他待办。新增的接口只有两个：`GET /audit-logs/meta` 和 `GET /audit-logs/admins`。

## 二、会破坏现有前端代码的改动（先看这一节）

下面每一条都会让按旧写法写的前端代码出错或显示错误，必须修改。

1. 破坏：`GET /renderer-models` 的每个条目不再返回 `fileRef`（11 号）。读取这个字段的代码、列和类型定义都要删除。客户端下载渲染模型走的公开接口不变。接口文档通则 3 的名单里要加上 `RendererModel.fileRef`（接口文档由别处修改，不在本文件范围）。
2. 破坏：`GET /subscriptions` 和 `GET /subscriptions/{id}`（2 号）。
   - `linkedPurchaseToken` 字段已删除。
   - `storeRef` 在 `store` 为 GOOGLE 时现在是 `null`（其他商店仍然返回完整值）。
   - 新增 `storeRefSuffix` 和 `linkedPurchaseTokenSuffix`（字符串或 `null`，取原值末 6 位）。
   - 显示或复制完整 Google 购买令牌的代码要改成显示末 6 位。
3. 破坏：`GET /subscription-events`（2 号），只影响 `store` 为 GOOGLE 的事件。
   - `sourceEventId`：第一个 `:` 之前的部分被截成它的末 6 位，其余部分保留。
   - `payload` 在任意层级里：`purchaseToken` 改名为 `purchaseTokenSuffix`，`pendingRefundToken` 改名为 `pendingRefundTokenSuffix`（值都是末 6 位）。
   - 按这些字段取值、搜索或比对的代码都要改。
4. 破坏：短信渠道和模板的保护性 400（41 号）。涉及 `/sms/channels/{id}` 的写入、删除和 `/enabled`，以及 `/sms/templates`。`data.details[0].reason` 以前是 `OUT_OF_RANGE`，现在是下面四个值之一，`OUT_OF_RANGE` 不再出现在这四种情形里：
   - `LAST_OTP_CHANNEL`，`ref` 为 `SmsChannel`（最后一个验证码渠道）
   - `COUNTRY_LOSES_OTP_CHANNEL`，`ref` 为 `SmsChannel`（某国家失去验证码渠道覆盖）
   - `LAST_OTP_TEMPLATE`，`ref` 为 `SmsTemplate`（最后一个验证码模板）
   - `LAST_ENGLISH_FALLBACK_TEMPLATE`，`ref` 为 `SmsTemplate`（最后一个英文且不限国家的兜底模板）

   这四个值扩充了接口文档里原有的封闭 reason 集合；前端的错误码译文表要加这四条，并删掉对这四种情形按 `OUT_OF_RANGE` 翻译的逻辑。
5. 破坏：`PUT /cosmetics/{id}`（97 号）。传入与已存的不同的 `kind` 现在返回 400 `INVALID_REQUEST`，`data.details = [{ref: "kind", reason: "OUT_OF_RANGE"}]`（与 `key` 的处理完全相同）；不传 `kind` 现在合法，保留原值（以前不传是 400 `EMPTY_NOT_ALLOWED`）。服装编辑表单要把 `kind` 当作创建后只读，不传或原样传回都可以。
6. 可能破坏：短信渠道凭据校验变严（5 号），`POST /sms/channels` 和 `PUT /sms/channels/{id}`，`ref` 为 `credentials`。每个供应商适配器声明自己需要的凭据名称：缺少所需名称返回 400 `EMPTY_NOT_ALLOWED`；多出适配器不使用的名称返回 400 `OUT_OF_RANGE`；把 `providerCode` 改成需要凭据的适配器而没有传凭据，返回 400 `EMPTY_NOT_ALLOWED`。`PUT` 传空的 `credentials` 仍然是保留已存的凭据。以前能保存的拼错名称现在会被拒绝；表单要按 `GET /sms/meta` 的 `credentialNames` 生成输入项。
7. 变化：应用版本相关 409 的 `data.status` 取值（47 号），见表中 47 号一行。渠道停用时是 `DISABLED`，版本状态不对时是该版本当前状态；前端不要再按 `CHANNEL_DISABLED`、`UPLOAD_USED` 之类自拟的值判断（上传已被使用仍是 `CONSUMED`）。
8. 权限放宽（不破坏，但要知道）：`GET /ads/placements` 以前只接受 `ADS:PLACEMENT`、`ADS:UNIT`；现在 `ADS:CREATIVE` 也能读（40 号）。写入接口权限不变。前端按权限隐藏广告位下拉或素材规格的逻辑可以放开。
9. 新字段使响应字段集合变大：`GET /me` 由六个字段变为七个，`GET /meta` 由二十个变为二十五个。如果前端有对字段集合做严格校验的类型定义或测试，要同步更新。

其余改动全部是新增字段、新增参数或新增接口，不会让旧代码出错。

## 三、逐条对照表

按请求编号排序。"错误"一列写法：HTTP 状态、顶层码、`data` 里的 `ref` 和 `reason`。

| 请求 | 前端问的是什么 | 后端现在返回或接受什么 | 前端要改或现在可以用 |
|---|---|---|---|
| 2 | 订阅查询只返回 Google 购买令牌和关联购买令牌的末 6 位 | `GET /subscriptions`、`GET /subscriptions/{id}`：删除 `linkedPurchaseToken`；`storeRef` 在 `store`=GOOGLE 时为 `null`；新增 `storeRefSuffix`、`linkedPurchaseTokenSuffix`（string 或 null，末 6 位）；其他商店的 `storeRef` 仍完整返回，Apple 的 `originalTransactionId` 保留。`GET /subscription-events`（仅 GOOGLE 事件）：`sourceEventId` 第一个 `:` 之前的部分截为末 6 位；`payload` 任意层级的 `purchaseToken` 变为 `purchaseTokenSuffix`、`pendingRefundToken` 变为 `pendingRefundTokenSuffix` | 破坏性，见第二节第 2、3 条。显示改用 `*Suffix` 字段 |
| 5 | 短信渠道 `credentials` 的形状、各供应商要哪些名称、空值怎么处理 | `GET /sms/meta` 的 `providers[]` 每项新增 `credentialNames`（string[]，`local-stub` 为空数组）。`POST /sms/channels`、`PUT /sms/channels/{id}`：缺少所需名称为 400 `INVALID_REQUEST`，`ref`=`credentials`，`reason`=`EMPTY_NOT_ALLOWED`；多出不使用的名称为 `OUT_OF_RANGE`；换成需要凭据的 `providerCode` 却没传凭据为 `EMPTY_NOT_ALLOWED`；`PUT` 传空 `credentials` 保留已存凭据 | 表单按所选供应商的 `credentialNames` 生成输入项；处理上述三种 400（第二节第 6 条）。本条中前端还问过整体替换还是合并、长度条数上限；来源材料里除上述内容外没有写，以接口文档为准 |
| 11 | 渲染模型的 `fileRef` 不返回给管理端 | `GET /renderer-models` 每项不再有 `fileRef`；公开客户端下载接口不变 | 破坏性，见第二节第 1 条。删掉该字段的读取 |
| 12 | 推送记录详情里发送结果能看出平台和令牌末 6 位 | `GET /push/records/{id}` 的 `deliveries` 每项新增 `platform`（`ANDROID`、`IOS` 或 `null`）、`tokenSuffix`（string 或 `null`，末 6 位）。发送时写入，所以即使令牌后来被删除也能显示；改动之前产生的旧记录两项为 `null` | 详情页的发送结果表可加两列，`null` 显示为空 |
| 17 | 四类"只能授出自己持有的权限"的 403 能说明是哪一条挡住 | `/admins` 和 `/roles` 的写入接口返回 403，顶层码仍是 `ADMIN_FORBIDDEN`，`data.reason` 为 `GRANT_NOT_HELD`、`ROLE_NOT_HELD`、`OWN_ROLE`、`ADMIN_NOT_HELD`、`SUPER_TARGET`、`SUPER_FLAG` 之一 | 以前 `data` 为 `null`；现在可以按 `data.reason` 给出具体提示。增加六条译文 |
| 19 | `GET /me` 加 `roleIds`，或 `GET /roles` 每行加 `heldByMe` | `GET /me` 新增 `roleIds`（string[]，按文本排序的角色编号）。`GET /roles` 没有加 `heldByMe`（这一半没做，见第四节） | 用 `/me.roleIds` 与 `/roles` 的列表自行比对得出"我持有的角色" |
| 22 | 自己保护、最后一个超管、并发修改的 409 能区分 | `/admins` 写入接口的 409 `INVALID_STATE`，`data.reason` 与原有的 `data.status` 并存，`reason` 为 `SELF_PROTECTED`、`LAST_SUPER_ADMIN`、`CONCURRENT_CHANGE` 之一；没有新增顶层错误码 | 按 `data.reason` 区分三种提示；`data.status` 仍保留 |
| 35 | 召回模板被默认语言规则拒绝时能区分三种情形 | 推送模板写入的 400 `INVALID_REQUEST`，`data` 在原有 `defaultLocale`、`reason` 旁新增 `case`，取值 `DEFAULT_MISSING`、`DEFAULT_REQUIRED_BY_OTHERS`、`DEFAULT_MOVED_AWAY`；错误码、`message`、检查顺序不变 | 按 `data.case` 给三种不同的引导文字 |
| 37 | 任务配置列表带 `hasRecords` | 任务配置的列表项、`GET /tasks/configs/{id}`，以及 `POST /tasks/configs`、`PUT /tasks/configs/{id}`、`PUT /tasks/configs/{id}/status` 的返回，都新增布尔 `hasRecords`（该配置是否已有记录） | 有记录时可直接把类型和目标值置为只读，不必等 409。该请求中前端还问过"带未改的 `taskType`、`targetValue` 的 PUT 算不算改"；后端的实现：带未改的 `taskType`、`targetValue` 的 PUT 不算改动，不会返回 409 |
| 40 | 只有"广告素材"权限的管理员读不到广告位和素材规格 | `GET /ads/placements` 现在 `ADS:PLACEMENT`、`ADS:UNIT`、`ADS:CREATIVE` 任一权限都可读（只读，写入权限不变）。`GET /ads/meta` 新增 `creativeAspectTolerancePercent`（数字，取自配置 `ads.creative_aspect_tolerance_percent` 的当前值） | 素材表单可直接读广告位规格，并在前端按容差预检宽高比 |
| 41 | 保护性 400 要有专用 reason；短信元数据加手机登录开关和账号数 | 四个新 reason 见第二节第 4 条。`GET /sms/meta` 顶层现在恰好是：`providers`、`testRemainingToday`、`phoneLoginEnabled`（boolean）、`phoneAccountCount`（number）；`providers[]` 每项恰好是 `code`、`allowedHosts`、`credentialNames` | 破坏性，见第二节第 4 条。只有短信权限的管理员现在也能读到登录开关和手机账号数 |
| 45 | 审计日志的 `action`、`targetType` 取值清单 | 新接口 `GET /audit-logs/meta`（权限 `AUDIT:VIEW`），返回 `{"actions": [...], "targetTypes": [...]}`。取值来自后端一张常量表（132 个动作、47 个对象类型），并有测试保证每个写入点用的值都在表里；两张清单都按字符编码顺序排列。注意大小写：`NOTIFICATION`、`PUSH_SCHEDULE`、`PUSH_TASK`、`PUSH_TEMPLATE` 四个对象类型是全大写，其余是首字母大写的驼峰（与已有数据一致） | 审计日志的 `action`、`targetType` 筛选改为下拉，选项取自此接口；值原样使用，不要自行改大小写 |
| 46 | 只有审计查看权限的人要有管理员名单来筛选"谁做的" | 新接口 `GET /audit-logs/admins`（权限 `AUDIT:VIEW`），返回 `{"items": [{"id": ..., "username": ...}]}`，只含 `id`、`username`，按 `username` 排序。管理员是硬删除的，已删除的不在名单里。`GET /admins` 没有放宽（只有审计权限的人读它仍是 403） | "操作者"筛选改为下拉；已删除管理员的旧记录仍可按 `adminId` 手输筛选 |
| 47 | 版本和渠道的 409 要有确定的 `data.status` | `/app-versions` 的 409 `INVALID_STATE`：`data.status` 为版本当前状态（`DRAFT`、`ACTIVE`、`ARCHIVED`）；渠道已停用时为 `DISABLED`；上传已被使用仍为 `CONSUMED`（最后一项来自后端的答复，本批次未改） | 按 `data.status` 判断并给提示；不要使用前端自拟的 `CHANNEL_DISABLED`、`UPLOAD_USED` |
| 60 | 用户详情里能看到待执行的账号删除 | `GET /users/{id}` 新增 `deletion`：没有未完成的删除时为 `null`，否则对象含 `id`、`status`、`executeAfter`、`requestedBy`、`requestedByUsername`、`createdAt`。`requestedByUsername` 在用户自己发起或发起的管理员已被删除时为 `null`。`GET /account-deletions` 没有加 `accountId` 筛选 | 详情页直接显示"到哪天、谁发起"，不再需要另查删除列表 |
| 61 | 审核队列按内容类型筛选 | `GET /moderation/records` 新增参数 `contentType`（七种内容类型之一，取值以接口文档为准）；非法值为 400 `INVALID_REQUEST`，`data.details = [{ref: "contentType", reason: "OUT_OF_RANGE"}]`，处理方式与 `status`、`source` 相同 | 队列页加类型筛选，由服务端筛选，分页和总数正确 |
| 67 | `GET /meta` 补值 | `GET /meta` 新增五个字段：`monitorMaxRangeDays`（number，当前生效值）、`taskTypes`（string[]，后端代码里的每日任务类型清单）、`entitlementLimitMax`（number，当前生效值）、`creativeAspectTolerancePercent`（number，当前生效值）、`googlePlayPackageName`（string；环境变量 `GOOGLE_PLAY_PACKAGE_NAME` 未设置、为空或只含空白时为 `null`，只有这一个字段会是 `null`）。注意它是后端校验商店链接时使用的环境值，不是 `play` 渠道自己登记的包名。`GET /ads/meta` 的 `notSkippableFullScreenCount` 见 122 号。`attributionCostCurrency` 没做（见第四节） | 页面里写死的监控最大范围、任务类型清单、权益上限、素材容差，改为读取这些字段；商店链接预检用 `googlePlayPackageName`。任一管理员都能读这些值，不需要额外权限 |
| 69 | 用量模型列表按资源类型和有无有效价格筛选 | `GET /usage/models` 新增参数 `resourceType`（取值为用量资源类型的枚举值，以接口文档为准）和 `hasActivePrice`（`true`/`false`）；非法值为 400 `INVALID_REQUEST`（没有 `details`，与 `/usage/prices` 一样）；总数随筛选变化 | "只看没有有效价格的模型"改由服务端筛选 |
| 75 | 成本录入批量成功后能看到覆盖了多少行 | `POST /attribution/costs/batch` 的成功响应保留 `count`，新增 `overwritten`（整数，已存在而被覆盖的行数） | 导入结果显示被覆盖的行数；`count` 包含被覆盖的行（`count` = 本次写入的总行数，`overwritten` 是其中被覆盖的那部分） |
| 92 | 版本写接口 400 带 `ref` 和 `reason` | `/app-versions` 写接口里由请求字段引起的 400 `INVALID_REQUEST`：`data.details = [{ref, reason}]`。例外：激活时对已存 APK 文件的检查（文件缺失、大小不符、SHA-256 不符，仅 DIRECT 渠道）、`upload.public_base_url` 未配置、检查期间 APK 被改动，这三类 400 只有 `message`，`data` 为 `null`，页面不要读 `data.details`。`ref` 可取：`channelCode`、`status`、`confirmStoreLive`、`apkUploadId`、`versionName`、`versionCode`、`minVersionCode`、`storeUrl`、`changelog`、`changelog.<语言>`；`reason` 取 `EMPTY_NOT_ALLOWED`、`OUT_OF_RANGE`、`INVALID_FORMAT`；`storeUrl` 另有链接类原因 `NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`、`PACKAGE_NAME_NOT_CONFIGURED`，`changelog.<语言>` 的语言键不合格时为 `INVALID_LANGUAGE_TAG` | 版本表单按 `ref` 逐字段提示，不再笼统写"输入内容不合法" |
| 97 | 服装、动作的请求体；服装 `kind` 创建后不可改 | 只有服装 `kind` 的规则改变，见第二节第 5 条。动作部分来源材料没有改动 | 破坏性，见第二节第 5 条 |
| 103 | 管线监控能列出全部来源 | `GET /monitor/pipeline` 新增 `sources`（string[]）：最近 `monitor.max_range_days` 天内有过上报的全部来源，每个来源一次，按码点顺序排序；不受请求中的 `from`、`to`、`source` 影响 | 来源下拉取自 `sources`；停止上报的来源在短范围里没有点，也能在下拉里看到 |
| 111 | 价格写入 400 的逐字段提示 | `POST /usage/prices` 的 400 `INVALID_REQUEST`：`data.details = [{ref, reason}]`；`ref` 为 `resourceType`、`unit`、`currency`、`unitPrice`、`bands`，或出错字段的路径（如 `bands[1].inputMinTokens`）；`reason` 取 `EMPTY_NOT_ALLOWED`、`OUT_OF_RANGE`、`NOT_AN_INTEGER`。没有新增"缺口""重叠"之类的 reason | 价格表单按 `ref` 路径在对应的档位字段下提示；档位缺口、重叠仍由前端自己检查 |
| 112 | 确认价格批次因币种被拒时有 `details` | `POST /usage/price-batches/{batchId}/confirm` 的 400 `INVALID_REQUEST`，`data.details` 的形状同 111；币种被拒时为 `[{ref: "currency", reason: "OUT_OF_RANGE"}]`，即使请求没有传 `currency` 也是如此（按批次自己的币种检查） | 确认对话框收到 `ref=currency` 时提示"该批次的币种不在允许列表内" |
| 114 | 推送记录按日期筛选 | `GET /push/records` 新增参数 `from`、`to`（`YYYY-MM-DD`，UTC 日，含首尾，各自可省略），按创建时间筛选；日期格式不对或 `to` 早于 `from` 为 400 `INVALID_REQUEST`，`data.details = [{ref: "from" 或 "to", reason: "OUT_OF_RANGE"}]`（格式不对时 `ref` 是出错的那个参数，先查 `from`；`to` 早于 `from` 时 `ref` 一律是 `to`）。原有的 `accountId`、`triggerReason` 筛选不变；没有按本地日期的筛选 | 记录页加日期范围筛选；日期按 UTC 日解释 |
| 122 | 强制可关闭兜底为 0 且存在不可跳过素材的警告 | `GET /ads/meta` 新增 `notSkippableFullScreenCount`（整数），与现有 `nonSkippableFullScreenExists` 用同一个条件计算（后端只实现一次）。该接口对任一 `ADS:*` 权限开放 | 只有 `ADS:PLACEMENT` 权限的管理员也能常驻看到警告：计数大于 0 且 `ads.force_close_seconds` 为 0 时显示 |
| 134 | `FILE` 类审核内容的地址有过期时间 | `GET /moderation/records/{id}/content`：新增 `expiresAt`；`kind`=`FILE` 时为时间戳（签发时刻加配置 `moderation.content_url_ttl_seconds`，UTC），`kind`=`TEXT` 时响应里没有这个字段（这个响应不输出值为空的字段） | 过期前主动重新获取，不必等播放失败；少产生审计记录 |
| 137 | 记忆模型登记冲突时给出原维度 | `PUT /memory/embedding-models/{name}` 的 409，`data` 现在是 `{detail, registeredDimensions}`；`registeredDimensions` 是该名称原来登记的维度（整数，调用前读取），读不到时为 `null`；`detail` 保留；记忆服务的其他 409 现在也是这个形状，只是 `registeredDimensions` 为 `null` | 冲突提示里显示原有维度，帮助运维决定换哪个名称 |

## 四、不做的 8 条请求，以及前端怎么办

前端保持现在的做法，不需要改动。

| 请求 | 前端原本问的 | 后端不做的原因 | 前端继续怎么做 |
|---|---|---|---|
| 30 | 额度包写入带 `updatedAt`，`PUT` 接受 `expectedUpdatedAt` | 后台没有任何按 `updatedAt` 比较的乐观锁（广告计划、素材只有按预期状态的条件更新，额度包的 `PUT` 本身没有任何比较）；单给额度包加会使后台写法不统一；该页面写入权限的持有人很少，且每次修改都有前后值审计；要做应在契约里对所有整行覆盖的写接口统一规定 | 照现在的方式整行提交，不发送 `expectedUpdatedAt` |
| 42 | 开启手机号登录被拒时，400 的 `data` 加 `missing` 数组 | `details` 已经给出缺哪几项，再加数组是重复信息 | 读 `data.details` 判断缺哪几项 |
| 52 | `/stats/guest/retention?platform=unknown` | 游客设备的平台入库时必为 `ANDROID` 或 `IOS`，该选项永远是空表 | 不提供 `unknown` 选项 |
| 62 | 审核队列直接给等待秒数 | 每行带服务器时间的秒数在缓存和重复请求下会立刻过时；业界队列页由前端按创建时间计算；`oldestPendingSeconds` 已给出服务器时钟下最老一条 | 前端用记录的创建时间自己计算等待时长；最老一条用 `oldestPendingSeconds` |
| 65 | `GET /support/feedback` 的摘要模式 | 筛选已能缩小结果；接口文档附录规则 1 规定列表返回全部列 | 把 `pageSize` 设小（例如 20 到 50）控制响应大小 |
| 67 中的 `attributionCostCurrency` | `GET /meta` 返回成本币种 | 成本页持有 `ATTRIBUTION:MANAGE`，`GET /config` 已返回该键；成本行和投放效果已带 `currency` | 从 `GET /config` 读取该键，或使用成本行、投放效果里的 `currency` |
| 70 | `PUT /config/attribution.cost_currency` 对格式不对的币种换 reason、拒绝 `ZZZ` | 配置值校验的 reason 是封闭集合，格式类问题统一用 `OUT_OF_RANGE`，已有成本行时也是 `OUT_OF_RANGE`，新增代码要先改契约；拒绝 `ZZZ` 需要维护币种清单，收益很小 | 前端提前校验币种格式，冲突不会发生；`OUT_OF_RANGE` 照常按配置值错误处理 |
| 93 | 漏斗步骤事件名含逗号时的转义或重复参数 | 事件名本身不可能含逗号，转义规则没有对象可用 | 步骤继续用逗号分隔传递 |

另外，19 号请求中的 `GET /roles` 每行加 `heldByMe` 这一半也没有做（理由：`/roles` 是下拉选项来源，每行带"我的"字段会让同一份列表依赖调用者）；前端用 `/me.roleIds` 自行比对。60 号请求中的 `GET /account-deletions` 加 `accountId` 筛选也没有做，改由用户详情的 `deletion` 对象满足。

## 五、后端没有核实的部分

1. 全量集成测试没有在后端的开发环境里跑过：实现这批改动时只跑了与改动相关的测试和架构测试，全量集成测试在代码推送后由持续集成运行。另外，应用服务和后台任务两个模块只做了编译，没有跑它们的测试（推送发送逻辑在这两个模块里也会运行）。
2. 本文件的措辞、字段名和取值，以随本文件一起附上的接口文档为准；两者若有出入，以接口文档为准。
3. 41 号新增的四个 reason 值是后端在实现时定的名字，需要扩充接口文档里原有的封闭 reason 集合；`PUT /cosmetics/{id}` 的 `kind` 规则也需要在接口文档里补一句。附上的接口文档若没有这两处，以本文件为准并告知后端。
4. 来源材料里没有写明的细节，本文件没有补充，例如：61 号的七种内容类型与 69 号的用量资源类型的具体取值。这些请以接口文档为准，文档里也没有的向后端确认。

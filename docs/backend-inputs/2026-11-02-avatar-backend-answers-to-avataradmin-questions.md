# 后端对管理端前端 140 条问题的回答

这是一份独立的文档，读它不需要别的文件。它回答的是 AvatarAdmin 的 `docs/contract-requests/for-backend.md` 里的 140 条待答问题，
另外对照复查了该文件末尾“契约已写”的 12 条。

**依据：** 新版接口文档（AvatarApp 仓库 main 提交 e07469d1 的 `docs/backend-task-java-backend.md`）和后端代码（AvatarBackend 仓库）。
每个结论后面写了读过的文件和行号；本文里的“接口文档第 N 行”指新版接口文档的行号，旧版快照的行号对不上，所以请先把
`docs/shared-snapshots/backend-task-java-backend.md` 换成新版。
**怎么得出的：** 8 个代理按模块读代码作答，再由 8 个新代理逐条独立核对（约 1,200 个具体说法），核对出的 18 处更正已写进答案；
仍然无法确认的写在每条的“核实程度”里。**没有运行任何请求、构建或测试**，“已核实”指读过代码。
**后端这次没有改任何代码。** 文中“改动请求”是向后端提出的请求，还没有做；在后端真的改之前，前端按后端现在的行为开发。


## 数量

- 共 140 条问题，另有每组的“对照复查”行（核对 for-backend.md 末尾“契约已写”的 12 条是否仍然正确）。
- 前端暂定做法与后端实际不一致、或回答里写明前端（含前端的假后端）要改的：49 条。
- 向后端提出的改动请求：建议做 33 项，建议不做 8 项（这些是请求，后端这次没有改任何代码，是否做由后端一侧决定）。
- 没有完全核实（部分核实或未核实）：17 条，原因写在各条的“核实程度”里。


## 一、前端要改的（49 条）

| 编号 | 模块 | 问的是什么 | 前端要改什么 |
|---|---|---|---|
| 5 | 短信与邮件 | 短信渠道 `credentials` 是什么形状、整体替换还是合并、各供应商要哪些名称、旧写法答什么、长度条数上限、空值 | ①“整体替换”的提示正确，保留；②假后端对 `null` 答 400，真后端是“保持不变并成功”，对空名称、空值也是接受，假后端和前端的测试按真后端改；③字符串旧写法真后端答的是不带 `details` 的 400，页面遇到时按“没有 details 的 400”处理；④页面想做“清空凭据”目前做不到，不要提供这个入口）。 |
| 10 | 登录与权限 | 验证码连续错误到上限时的状态码和 `retryAfterSeconds` | ①“第 5 次就答 429”改为第 5 次仍是 401 `ADMIN_TOTP_INVALID`，从第 6 次起（密码正确时）才是 429，页面在第 5 次时可以自己提示“再错将被锁定”；②“锁定期间一律 429”改为：只有密码正确才是 429，密码错误仍是 401 `ADMIN_INVALID_CREDENTIALS`，页面不要因为 401 就断定没被锁；③“绑定超次数 429 且令牌作废”改为：绑定一步超次数答 401 `ADMIN_INVALID_TOKEN`，不是 429，页面应回到登录第一步；④ 429 要区分有无 `data.retryAfterSeconds`：有就写“N 秒后再试”，没有（IP+用户名限流）用通用文字。 |
| 16 | 部署 | 后端加的安全响应头是哪六个、值、加在哪些响应上；`/api/admin/**` 是否自己设 `Cache-Control`；反向代理还需要补哪些？ | 示例配置里只给 `/api/` 加 `Cache-Control: no-store` 的那一条要删掉，或写成替换；后端已经给了，再加会让响应里出现两个 `Cache-Control`）。 |
| 22 | 系统管理 | 拒绝“改自己的角色或超管标志”“停用或删除自己”“最后一个启用的超管被停用、删除、清除标志”时，错误码是什么？能否给专用码？ | 针对自己不是 403 `ADMIN_FORBIDDEN`，是 409 `INVALID_STATE`；最后一个超管本来就是 409 `INVALID_STATE`，这条一致。页面在 409 后加的固定话要按“是不是自己那一行”分两句，因为 409 本身不告诉原因）。 |
| 26 | 埋点管理 | `GET /analytics/events` 的参数名、`from`/`to` 格式、排序、响应里的事件名字段与行标识、平台与版本从哪读 | ①读 `name`，不要读 `eventName`；筛选参数也叫 `name`，不是 `eventName`；②可以读 `id`，后端有；③`from`/`to` 要发完整 ISO 时刻，不能发 `YYYY-MM-DD`——见 56；④平台、版本从 `context.platform`、`context.appVersion` 读，SERVER 来源的行允许为空）。 |
| 28 | 订阅与权益 | `PUT /subscription-products` 是单条按 (store, productId) 新增或修改，还是整表替换？`entitlementKey` 不存在是 400 吗 | ①请求体要写成 `{"items":[那一条]}`；②`PUT` 成功后 `data` 为 `null`，要重新 `GET /subscription-products` 才能拿到最新列表；③`entitlementKey` 不存在时的错误是 404，不是 400）。`GET` 的 `{items}` 形状一致。 |
| 30 | 额度 | 额度包 `/credit-products`：GET 形状、有没有 id、PUT 路径和请求体（surfaces 不出现时是保持还是清空）、重复答什么、credits 范围、productId 长度；能否带 updatedAt 并让 PUT 接受 expectedUpdatedAt | ①没有 `PUT /credit-products/{id}`，改成 `PUT /credit-products`，请求体带 `store`、`productId`、`credits`、`enabled`、`sortOrder`、`surfaces` 六项；②`GET` 的行没有 id，前端要以 `(store, productId)` 作为行标识；③`surfaces` 必须带，保存前要把读到的值原样回传；④读这个页面要 `SUBSCRIPTION:CONFIG`）。"保存前重读比较"这一做法仍然可用，因为后端没有并发保护。 |
| 33 | 推送 | `GET /push/templates` 响应是否保留 `total`、是否分页、有哪些筛选参数 | 模板列表只请求一次，不要翻页。现在的“有 `total` 就读到取够，没有就读到空页为止”会死循环，因为第二页还是返回同样的全部内容，永远不是空页；`pageSize=200` 也可以不传）。 |
| 34 | 推送 | 模板与周期推送：`linkType` 为 `NONE` 时 `linkTarget` 传什么、怎样去掉图片、标题正文长度上限 | 标题上限 100、正文上限 500，页面计数和假后端都改，现在假后端按 200、1000 演示；可以加“去掉图片”，发 `uploadId: null`；`PUT` 里模板要带 `enabled`，否则会被当成 `false` 而停用；读响应用 `imageUploadId`/`imageUrl`，请求用 `uploadId`，不要把 GET 到的 `imageUrl` 原样带回 `PUT`；`linkTarget` 传 `""` 或 `null` 都可以）。 |
| 35 | 推送 | 召回模板被默认语言规则拒绝时 400 的 `data` 能否加 `case`；`PUT /push/templates/{id}` 是否真的接受 `locale`、`triggerReason` | `PUT /push/templates/{id}` 必须带 `triggerReason`、`locale`（以及 `title`、`body`、`enabled`）；现在前端“`PUT` 不带这两项”会得到 400。通用句子在没有 `case` 之前可以继续用）。 |
| 36 | 邀请与分享 | `/invites/share-funnel`、`/share-channels`：没生成汇总的日子是否返回行；`from`、`to` 含两端吗、不传怎么办；`shareChannel` 无渠道时是什么 | 读漏斗行时 `sharePv` 等六个数要能接受 `null`，显示“—”，不要当 0 参与合计；渠道行的“无渠道”显示 `unknown`，不要等 `null` 或空串；其余——按 `{items}` 读、没有行的日子补 0——一致）。 |
| 38 | 投放管理 | `GET /attribution/performance` 的行字段、数的类型、未归因行出现的条件 | 。前端要改：(a) `campaignId` 按数处理（比较 `=== 0`，不是 `"0"`）；(b) 直接用行里的 `campaignCode`、`campaignName`，投放账户列表只作回退；(c) 按日分组时也会有最后一行未归因行，要用 `unattributedInstalls` 识别并显示（你们暂定"按日分组不读 `unattributedInstalls`"，会漏掉自然量）；(d) `cost`、`cpa`、`cpi` 收到的是数，不用再兼容字符串；(e) 导出可以发 `groupBy=day`，不必固定 `campaign`。 |
| 39 | 应用内广告 | 创建单元（`POST /ads/units`）收不收 `surfaces` | 。前端要改：单元列表和表单显示 `surfaces`（例如"仅 ANDROID"、"ANDROID/play"），创建和编辑时发送 `surfaces`；响应形状不需要再兼容裸数组。**代码和文档矛盾**：文档第 3714 行写 `PUT` 只改四个字段，代码 `updateUnit` 也接受并保存 `surfaces`（`AdAdminService.java:459`、注释 `:441-446` 写"by R22.10"），需要由改文档的人把 `surfaces` 加进文档，或者通知后端去掉；在改之前前端可以依赖代码的行为。 |
| 41 | 短信与邮件 | “最后一个覆盖的启用验证码通道”被拒时能否给专用错误码；`GET /sms/meta` 能否加 `phoneLoginEnabled`、`phoneAccountCount` | 被拒时可以直接按 `ref`（`SmsChannel`/`SmsTemplate`）+ `reason`（`OUT_OF_RANGE`）显示固定说明，不必只显示“输入内容不合法”；要注意同一个 `ref` 下有两种情形，固定说明要写成覆盖两种的话，或等后端拆分原因码；操作前的提示条件“登录开关为真或存在手机号账号”和后端一致）。 |
| 42 | 系统配置 | 开启手机号登录被拒时，400 的 `data` 能否加数组 `missing` | 现在前端“固定写一句最常见的缺项”，应改成逐条按 `details` 里的 `ref` 显示：`sms.allowed_country_codes`、`sms.daily_global_cap` 对应设置行，`SmsChannel`、`SmsTemplate` 各一句固定文字；`SmsTemplate` 那句已经正确，不用动）。 |
| 44 | 系统管理 | `PUT /admins/{id}` 缺省的字段是“不改”而不是“清空”吗？`username` 要带吗？自己那一行带了 `roleIds` 或 `superAdmin` 是否一律拒绝？ | ①“不发 `username`”不行，必须发；②“只发有改动的字段”不行，`username` 和完整的 `roleIds` 必须每次都发；只有 `superAdmin` 可以省；③“自己那一行一个都不发”改为：自己那一行也必须发 `username` 和**当前**的 `roleIds`，不发会 400；`superAdmin` 省略。 |
| 47 | 渠道包与应用版本 | 409 `INVALID_STATE` 能否给确定的 `data.status`；重复检查先后 | 暂定"遇到 409 且 `data.status` 不是版本状态就提示重新上传"会误判，因为渠道停用的 409 没有 `data`，会被当成"上传问题"。要改成精确判断 `data.status === "CONSUMED"` 才提示重新上传；`data` 缺失时只显示通用的 `error.INVALID_STATE` 文字，或按触发的操作自己判断（新建版本遇到无 `data` 的 409 多半是渠道停用）。若后端按下面的请求补上 `data.status`，再改回按值区分）。 |
| 54 | 通话 | `GET /sessions` 的筛选参数名、时间格式、"进行中"参数名、非法值是否 400 | 做法一致（只发有值的参数），但名字和格式要对：不一致处——前端要改：①"进行中"参数用 `inProgress`；②`from`/`to` 发 ISO 时刻，不是日期；③`guest` 只发小写 `true`/`false`。 |
| 56 | 埋点管理 | `event-summary`、`event-names`、`funnel`、`events` 的 `from`/`to` 格式、跨度算法、不传时的行为、越界时的 `ref` | ①发 ISO 时刻，不发 `YYYY-MM-DD`；`to` 要自己算成"次日 00:00:00Z"才能含最后一天；②没有默认范围，页面必须有默认的时间范围并总是传两个参数；③跨度限制是 31 天的时长，不是"含两端天数"；④越界错误绑定到 `to` 字段，`TOO_SLOW`/`TOO_MANY_EVENTS` 绑定到 `from` 字段）。 |
| 59 | 用户 | `GET /users/{id}/sessions` 按哪一列倒序；行里有哪些列 | 会话页签不要读 `endReason`；需要时点开某一行再调 `GET /sessions/{id}`。`id, requestedAt, startedAt, endedAt, durationSeconds, modelTier, language` 都在，可以保留）。 |
| 61 | 内容审核 | `GET /moderation/records` 是否支持 `contentType` 筛选；不认识的查询参数忽略还是 400 | 不要用"发参数 + 客户端再过滤"，那样分页和总数是错的；在后端加上筛选之前，类型筛选只能当作"本页内的显示过滤"，并在界面上说明；或者先不提供类型筛选）。 |
| 64 | 形象与装扮 | 五个目录列表分不分页、`/cosmetics` 筛选参数、生成任务和投诉的排序 | ①`/cosmetics` 只能发 `kind`；"上下架状态"和"适用风格"筛选要在前端对已读到的页内做，或把这两个筛选从页面去掉；不能指望后端过滤，否则翻页后总数和页内条数对不上。②假后端的目录排序要改成 `kind`、`sortOrder`、`key`（服装）与 `sortOrder`、`key`（动作）。分页、`total`、生成任务与投诉的排序与前端一致）。 |
| 72 | 推送 | 手动任务：`status` 筛选；立即发送要不要带 `scheduledAt`；`accountIds` 上限和格式；`cancel` 的响应和错误 | “取消”按钮对 `PENDING` 和 `RUNNING` 都可以显示，不是只有待发送，前端暂定的“非待发送答 409”与后端不符；其余——立即发送不带 `scheduledAt`、409 `INVALID_STATE` 带 `data.status`——一致。列表按创建时间倒序、不是计划时间，只是告知，问题表里没有对应的前端排序假设）。 |
| 73 | 邀请与分享 | `GET /invites/chain`：嵌套节点形状、`joinedAt` 含义、`maxDepth`、404/400 的 `ref`、会不会截断 | 请求参数名用 `rootAccountId`；不能假定“一次画出所有后代”，要读 `truncated`，为 `true` 时提示只显示了前 10000 个节点，并以 `totalDescendants` 作为总数）。 |
| 75 | 投放管理 | 成本录入：`amount` 类型、不带 `currency`、批量 400 的明细格式、成功响应 | 。前端要改：(a) 成功响应读 `count`，不要等 `{imported, overwritten}`；提示按"已导入 n 行（已存在的日期被覆盖）"写，当前后端给不出新增和覆盖各几行；(b) `details` 里 `index` 是独立字段（从 0 起），`ref` 是字段名，显示"第 N 行"时用 `index + 1`；不要按 `"<下标>.<字段>"` 拆字符串；(c) 不认识的投放账户编码的原因码是 `NOT_FOUND`，不是 `OUT_OF_RANGE`；批内重复是 `DUPLICATE`，每个重复行都有一项；(d) 需要补 `NEGATIVE`、`TOO_MANY_DECIMALS` 两个原因码的译文（文档第 112 行的清单里没有它们，但代码会返回）；(e) 成本行直接用 `campaignCode`、`campaignName`；(f) 不带 `currency` 可以。 |
| 76 | 投放管理 | `GET /attribution/clicks` 的 `from`、`to`；`GET /attribution/summary` 缺失分组值的 `key` | 点击明细部分不一致：前端要改，所选的 UTC 日直接发 `from=YYYY-MM-DD`、`to=YYYY-MM-DD`（`to` 就是最后一天，不要转成"后一天 00:00:00Z"，否则会多包含一天，而且带时间的值会被 400）；`summary` 的 `key` 部分一致（显示"—"即可，只会是空串）。 |
| 77 | 应用内广告 | 状态、审核、上下架接口的请求体字段名；`targeting` 的更新是不是嵌套合并 | 字段名（`status`、`servingStatus`、`reviewStatus`、`reviewNote`）一致；`targeting` 部分不一致：前端和假后端要改成整体替换（发完整对象，空的键不发；改成空的键可以直接不发，不需要靠 `null` 去删）。 |
| 78 | 短信与邮件 | `PUT` 是否整条替换；`PUT …/enabled` 请求体；新建 `enabled` 默认值；`channelCode` 格式长度；`allowedHosts` 精确还是通配；测试发送无效号码答什么 | ①文档与代码都是“没带保持原值”，前端发全字段没问题，但不要用 null 表示清空；②`…/enabled` 的响应是裸渠道对象，没有 `warnings` 包装；③主机比较“页面按主机名精确比较”和后端一致，但要做不区分大小写）。 |
| 82 | 告警 | 投放回传凭证告警：只改名字（像素编号不变）、请求里没有令牌字段，算"重新填写"吗；广告平台错误码有没有固定写法和长度上限 | 模拟服务关闭告警的条件应改为"有新令牌（即使内容相同）、令牌被清除（原来有）、或像素编号和原来不同（含被清空）"；"只改名字"的请求要带上原像素编号，否则会被当作清空像素）。 |
| 87 | 系统管理 | 权限节点 `POST` / `PUT` 的请求体，码的格式和长度，名称长度，排序范围 | ①“页面要求码不含空白和控制字符、至多 100 个码点”改为 `[A-Za-z0-9_:#/.-]{1,128}`；②修改请求里除了不带 `code`、`type` 外，必须总是带当前 `parent`，否则自定义节点会被移到根下、内置节点会被拒；③`nameZh`、`nameEn` 在 `PUT` 里也是必填。 |
| 88 | 系统管理 | 把节点移到自己或后代下面（成环）答什么错误？成环、改内置节点的父节点答 400 时 `details` 是什么？删内置节点？ | “删内置节点现在是 409 `INVALID_STATE`”不对，后端实际就是契约的 400 `INVALID_REQUEST`，`ref` 为 `code`，前端的模拟服务按契约做即可；成环 400 且 `ref` 为 `parent`、改内置父节点 400 这两条一致）。 |
| 89 | 渠道包与应用版本 | `POST /channels` 默认启用吗；`PUT /channels/{code}` 只发 `{"enabled":false}` 行不行 | 每次都发三项能用，但正是前端担心的"用页面上次读到的值覆盖别人刚改的名称"；后端支持只发改动的字段，所以停用/启用开关只发 `{"enabled":x}`，改名只发 `{"name":x}`）。 |
| 90 | 渠道包与应用版本 | 渠道名称和包名的长度上限、规则，400 的 `ref` 和原因码 | 名称加 64 码点上限；包名加 255 上限；页面不要期待渠道的 400 带 `ref`/原因码，只能按提交的字段在前端自己检查，后端 400 时显示通用文字）。 |
| 91 | 渠道包与应用版本 | `versionCode`、`minVersionCode` 上限；更新说明每种语言长度、不在支持列表里的语言收不收 | 数字上限改成 1 到 2147483647；"商店渠道只带 storeUrl、直装渠道只带 apkUploadId"一致；更新说明键的规则与长度按上面检查）。 |
| 95 | 内容审核 | `POST /moderation/records/{id}/decision` 的响应 `data`、`note` 最长多少码点、检查顺序 | `note` 上限改为 1000 个码点；`APPROVE` 时可不填，只有 `REJECT` 才必填；`note` 超长或缺失的错误在 `details[0].ref` 为 `note`，`decision` 非法在 `ref` 为 `decision`）。"不读响应"一致。 |
| 96 | 形象与装扮 | 目录条目的 `names`、`texts` 里 `en` 是否必填 | 表单里 `en` 必填，只填别的语言会被后端 400；错误的 `ref` 是 `names.en` 或 `texts.en`）。 |
| 97 | 形象与装扮 | 服装、动作 `POST/PUT` 请求体是否如前端所写 | `PUT` 必须带 `kind` 和 `enabled`（带当前值），服装还要带 `isFree`、`isDefault`、`sortOrder`，动作要带 `description`、`triggerableBy`、`sortOrder`；创建时 `enabled` 必填；预览图、图标创建时必填与前端一致；`creditPrice: null`、图片只在换图时带与前端一致）。 |
| 98 | 形象与装扮 | 每种 `kind` 一个默认免费条目：设另一个为默认时旧默认怎样；`isDefault` 真而 `isFree` 假是 400 吗 | 不要假设 400 且 `ref` 为 `isDefault`；表单提示改成"保存后其他默认条目会自动取消"；遇到 409 `INVALID_STATE` 且 `data.kind` 存在，提示"该种类必须保留一个启用、免费、两种风格都适用的默认条目"）。 |
| 100 | 形象与装扮 | 动作补生成遇已停用动作的 409；默认数字人改名在哪些状态被拒；对已生效的再 `activate` | 改名按钮在"生成中"也可以显示（后端不拒绝），不必隐藏；"再激活当作成功"一致；`data.status` 缺失时只显示通用文字，一致）。 |
| 104 | 订阅与权益 | `POST/PUT /entitlement-defs` 的请求体、key 与 name 的格式长度、key 重复是否 409 且 `data.field` 为 `key`、响应形状 | 可以补预检，`key` 匹配 `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` 且创建后不可改，`name` 去空白后 1 到 100 个码点；`priority` 之外的取值范围后端不限制；两种重复都要处理 `data.field` 为 `key` 或 `priority`）。只检查非空和整数不会出错，只是更多错误要靠后端的 400 展示。 |
| 105 | 订阅与权益 | `PUT /feature-gates/{key}/credit-cost` 请求体是否 `{"creditCost": 整数或 null}`？除 `avatar.looks_max`、`credits.period_grant` 之外不能设置单价的开关是 400 吗？单价取值范围 | 可编辑的开关不是"所有永久的额度类开关"，而是 `assets.avatar_max`、`assets.voice_max` 两个；用 `kind=LIMIT` 且 `limitScope=PERMANENT` 判断会把 `avatar.looks_max` 也放进来，保存会被拒）。 |
| 106 | 订阅与权益 | 限时权益发放与撤销：durationDays 上限、reason 长度、发放响应、撤销要不要理由、撤销非限时权益或已失效的行是否 409 | 预检 `durationDays` 要加上限 3650；`reason` 1 到 500 码点一致；撤销不带请求体一致）。 |
| 108 | 额度 | 调账申请的 `reason`、`note` 长度上限，`ADJUST` 的 `delta` 能否为 0、绝对值是否有上限 | 预检 `ADJUST` 不能为 0 一致，但还要加 `GRANT` 必须为正，以及 `delta` 绝对值不超过 1000000000；`reason`、`note` 1 到 500 码点一致，注意 `note` 只在驳回时必填）。 |
| 111 | 成本 | `POST /usage/prices` 成功时 `data` 是什么？档位或价格不合法、确认因档位不连续被拒时 400 的 `ref`、`reason` 是什么（能否给"缺口""重叠"这样的具体码） | 后端不会给"有译文的原因"，因为根本没有 `details`；前端只能显示通用句，或直接显示英文 `message`）。 |
| 114 | 推送 | `GET /push/records` 要不要按账号、触发原因、本地日期筛选 | 页面可以加账号编号和触发原因两个筛选，后端已支持；本地日期筛选后端没有）。 |
| 116 | 邀请与分享 | `depth-stats` 范围内没有被邀请人时 `avgDepth`、`maxDepth` 是什么；`stats` 的 `limit` 超过 200 | `maxDepth` 在没有被邀请人时是 `0` 而不是 `null`，要用 `depthDistribution` 为空或 `totalChains === 0` 判断显示“—”，不要只靠 `null`；`limit` 不要传超过 200 的值，传了得到 400）。 |
| 130 | 客户端配置 | 同一主语言、前缀与文字变体都比不出先后时“取列表里靠前的第一个”，客户端配置里这个“列表”按什么顺序排 | 预览排序不能用“字母顺序”的本地化比较（如 `localeCompare`）或忽略大小写的比较，要用按码元的原始字符串比较，且先排除默认值那一行；契约两处都没写这个顺序，建议由改契约的人补写）。 |
| 135 | 形象与装扮 | 投诉改状态、删除形象、赠送服装、声明激活或上下架成功时返回什么；重复赠送是 409 吗；条目不存在是 404 吗 | 一致（前端不读响应，成功后重新读取）。前端的假后端要改：投诉改状态、删除形象、赠送服装成功返回 `null`；重复赠送返回成功而不是 409 `DUPLICATE_RESOURCE`。 |
| 139 | 系统配置 | 14 个设置项的说明核对，特别是 `recall.window_minutes`、`recall.inactive_hours`、`recall.streak_min_days`、`export.min_interval_hours`、`support.rate_limit_per_hour`、`events.max_body_kb` 的单位和方向，以及审核分数与阈值的方向 | 第 2 条（`generation.poll_interval_seconds`）的说明要改成“后端检查未完成生成任务的间隔”；第 3、4、5 条补“超过会被拒”的后果；第 8、9、11、12 条补上面的起算点、方向、按谁；`moderation.*` 可以把方向写回；其余保持）。 |

## 二、向后端提出的改动请求：建议做（33 项）

| 编号 | 模块 | 问的是什么 | 理由和做法 |
|---|---|---|---|
| 2 | 订阅与权益 | `GET /subscriptions`、`GET /subscriptions/{id}` 能否只返回购买令牌和关联购买令牌的末 6 位（字段名带 Suffix） | 建议做。理由：契约 1971 写明持有购买凭证的人可以绑定没有账号标识的订阅，管理员的查看权限用不到完整令牌；做法是 Google 的 `storeRef` 和 `linkedPurchaseToken` 只返回末 6 位（新字段名由契约会话定），Apple 的 `originalTransactionId` 是客服去 App Store Connect 查单用的标识，不是凭据，可以保留；`/subscription-events` 的 `sourceEventId` 和 `payload.subscriptionNotification.purchaseToken` 必须同步遮，否则等于没遮。 |
| 5 | 短信与邮件 | 短信渠道 `credentials` 是什么形状、整体替换还是合并、各供应商要哪些名称、旧写法答什么、长度条数上限、空值 | 建议做（让每个适配器声明所需的凭据名称，`GET /sms/meta` 的供应商项加 `credentialNames`，保存时缺名称或多出名称就按 `credentials` 拒绝；名称拼错会让渠道静默不可用，适配器自己最清楚需要什么，只影响后台，不影响 Android 和 AvatarAgent）。 |
| 11 | 形象与装扮 | 渲染模型的 `fileRef` 要不要返回给管理端 | 建议做（存储键对浏览器没有用；这个管理接口只有管理端前端在用，客户端下载渲染模型走的是另一组公开接口，去掉这一列不影响别的调用方；需要同时在接口文档通则 3 的名单里加上 `RendererModel.fileRef`，改的是后端的响应类和契约一行）。 |
| 12 | 推送 | `GET /push/records/{id}` 里发送结果的数组叫什么，要不要给令牌末 6 位和平台 | 建议做（运营看不出是哪台设备，而失效令牌的行恰恰查不到令牌；做法是发送时把平台和令牌末 6 位随发送结果一起存下来，响应里加 `platform`、`tokenSuffix`，只影响管理后台这一个响应，Android 和 AvatarAgent 不受影响；已有的历史行这两项为 `null`）。 |
| 17 | 系统管理 | 四类“只能授出自己持有的权限”的 403，`data` 能否改为 `{"reason":"<代码>"}`？ | 建议做。理由：页面只看错误码无法告诉操作者是哪一条挡住了他，`message` 是英文且没有承诺稳定；做法是在 `data` 里加 `{"reason":"GRANT_NOT_HELD" \| "ROLE_NOT_HELD" \| "OWN_ROLE" \| "ADMIN_NOT_HELD" \| "SUPER_TARGET" \| "SUPER_FLAG"}`，顶层错误码仍是 `ADMIN_FORBIDDEN`；只影响管理端，Android、AvatarAgent 不调这些接口；同时要改契约第 2392 行的“`data` 为 `null`”。名字由后端定，上面是建议值。 |
| 19 | 系统管理 | 能否在 `GET /me` 加 `roleIds`，或在 `GET /roles` 每行加 `heldByMe`？ | 建议做 `roleIds`（加在 `/me`），建议不做 `heldByMe`（加在 `/roles`）。理由：`/me` 是“当前管理员是谁”的唯一位置，加一个字符串数组几乎零成本，也不影响 Android、AvatarAgent；`/roles` 是另一个页面的选项来源（通则第 5 条），每行带“我的”字段会让同一份列表依赖调用者，不如让前端用 `/me.roleIds` 自己比对。 |
| 22 | 系统管理 | 拒绝“改自己的角色或超管标志”“停用或删除自己”“最后一个启用的超管被停用、删除、清除标志”时，错误码是什么？能否给专用码？ | 建议做（不新增顶层错误码，只在这些 409 的 `data` 里加 `"reason"`：`SELF_PROTECTED`、`LAST_SUPER_ADMIN`、`CONCURRENT_CHANGE`，保留 `status` 字段）。理由：自己 / 最后一个超管 / 撞车三种在前端无法从响应分辨，尤其撞车和最后一个超管只有后端知道；与 17 号用同一个机制，管理端内部使用，不影响 Android、AvatarAgent；顶层错误码是共用词表，不建议新增 `ADMIN_SELF_PROTECTED`、`LAST_SUPER_ADMIN`；契约第 150 行（`data` 为 `{"status"}`）和第 2392 行要同步改。 |
| 35 | 推送 | 召回模板被默认语言规则拒绝时 400 的 `data` 能否加 `case`；`PUT /push/templates/{id}` 是否真的接受 `locale`、`triggerReason` | 建议做（给 `data` 加 `case`，取 `DEFAULT_MISSING`、`DEFAULT_REQUIRED_BY_OTHERS`、`DEFAULT_MOVED_AWAY`；理由：三种情形教运营做的事不同，后端已经知道是哪一种，只加一个字段，错误码、`message`、检查顺序都不变；只有管理后台调用这些接口，不影响 Android 和 AvatarAgent；接口文档 17.4 推送行也需要同步这一个字段）。 |
| 37 | 活动管理 | `GET /tasks/configs` 能否带 `hasRecords`；已有记录的配置 `PUT` 带没改的 `taskType`、`targetValue` 算不算改 | 建议做（列表和详情加布尔字段 `hasRecords`；理由：规格要求有记录的配置的类型和目标值只读，现在只能在被 409 拒绝之后才知道；后端按页内的配置编号一次 `EXISTS` 查询即可，`task_record.task_id` 已有索引；只影响管理后台，不影响 Android 和 AvatarAgent）。 |
| 40 | 应用内广告 | 只有"广告素材"权限的管理员读不到广告位和素材规格 | 建议做。做法：`GET /ads/placements` 的读取权限加上 `ADS:CREATIVE`（只读，写入接口权限不变，与通则第 5 条"下拉选项来源接口"同一原则，素材表单正是广告位的使用方），并在 `GET /ads/meta` 加 `creativeAspectTolerancePercent`（整数）。理由：规格校验是服务端强制的，前端读不到规格就只能提交后看 400，运营体验差；两项都是只读加字段，不影响 Android、AvatarAgent；比"在单元响应里带广告位和规格"改动小，且广告位只有四行。（备选 (b) 也可行，但会让单元列表每行带重复数据。） |
| 41 | 短信与邮件 | “最后一个覆盖的启用验证码通道”被拒时能否给专用错误码；`GET /sms/meta` 能否加 `phoneLoginEnabled`、`phoneAccountCount` | 建议做。①给这四种情形各一个不同的 `reason`（最后一个验证码渠道、某国家失去覆盖、最后一个验证码模板、最后一个英文不限国家模板）；②`GET /sms/meta` 加 `phoneLoginEnabled` 和 `phoneAccountCount`。理由：现在四种情形在 `ref`+`reason` 上分不开，前端规则是“错误码已知才按码译文”，这些端点只给后台用，不影响 Android 和 AvatarAgent；只有短信权限的管理员读不到登录开关，没有别的办法拿到。 |
| 45 | 系统管理 | 审计日志的 `adminId`、`action`、`targetType`、`targetId` 是精确匹配吗？能否给 `action`、`targetType` 的取值清单？长度口径？ | 建议做。理由：`action` 拼错时不报错、只返回空页，自由输入对运维不友好，行业里审计日志都给动作下拉；做法是后端把动作和对象类型集中成一张常量表（并加测试：每个写入点都用表里的值），再给一个只读列表接口（`AUDIT:VIEW`）；不影响其他调用方；前端在后端给出之前继续自由输入。 |
| 46 | 系统管理 | 只有“审计日志查看”权限、没有“管理员管理”权限的人，能否有只读的管理员名单接口（只含 `id`、`username`）？ | 建议做，但不是放宽 `GET /admins`，而是新增一个只含 `id`、`username` 的小接口（`AUDIT:VIEW`，建议 `GET /audit-logs/admins`，分页或全量）。理由：筛选“谁做的”是审计查看的基本用法，现在只能手输 UUID；`GET /admins` 还含状态、最近登录时间、角色，不应该给只有审计权限的人；审计日志本来就让他们看到所有操作者的用户名，所以暴露 `id` + `username` 没有新增信息；已删除的管理员不在名单里，仍可按旧 `adminId` 手输筛选。契约通则第 5 条可以顺势加一行。 |
| 47 | 渠道包与应用版本 | 409 `INVALID_STATE` 能否给确定的 `data.status`；重复检查先后 | 建议做（把版本、渠道的 409 补上 `data.status`，与文档 150 和 2372 对齐：渠道停用写 `DISABLED`（渠道当前状态），版本状态不对写版本的当前 `status`（`DRAFT`/`ACTIVE`/`ARCHIVED`），上传被用保持 `CONSUMED`；比前端提的 `CHANNEL_DISABLED`/`UPLOAD_USED` 更贴合"`data.status` 是对象当前状态"的通则，其他调用方只多读到一个字段，不受影响）。 |
| 60 | 用户 | 能否让 `GET /account-deletions` 加 `accountId` 筛选，或让 `GET /users/{id}` 带 `deletion` 对象 | 建议做。做法：在 `GET /users/{id}` 里加 `deletion` 字段（没有未完成的删除时为 null），内容至少 `id, status, executeAfter, requestedBy, requestedByUsername, createdAt`，用已有的 `findOpenByAccount` 取。理由：客服要对用户说"到哪天、谁发起"，这是详情页本来就该展示的数据，而且已有索引支持一次按账号取，不需要新增筛选；`accountId` 筛选没有合适的索引（现有索引都以 status 或时间开头，部分唯一索引只覆盖未完成状态）。两个二选一，选前者。 |
| 61 | 内容审核 | `GET /moderation/records` 是否支持 `contentType` 筛选；不认识的查询参数忽略还是 400 | 建议做。加 `contentType` 参数，取值是上面七种之一，非法 400（`ref:"contentType"`），与 `status`、`source` 同样处理（`ModerationFacade.parse` 现成）。理由：队列有七种类型，运营按类型处理是常态，客户端过滤会让分页和总数出错；改动很小（门面加一个参数、仓库加一个条件），Android 和 AvatarAgent 不调用这个接口。 |
| 67 | 共用 | `GET /meta` 能否补六个值；`GET /ads/meta` 能否加 `notSkippableFullScreenCount` | `monitorMaxRangeDays`：建议做（持有页面权限的人读不到配置键，不加就只能 400 后才知道；字段是当前生效值，无机密）。 |
| 67 | 共用 | `GET /meta` 能否补六个值；`GET /ads/meta` 能否加 `notSkippableFullScreenCount` | `taskTypes`：建议做（常量清单，避免页面写死三个）。 |
| 67 | 共用 | `GET /meta` 能否补六个值；`GET /ads/meta` 能否加 `notSkippableFullScreenCount` | `entitlementLimitMax`：建议做（同上，无机密）。 |
| 67 | 共用 | `GET /meta` 能否补六个值；`GET /ads/meta` 能否加 `notSkippableFullScreenCount` | `creativeAspectTolerancePercent`：建议做（同上，无机密）。 |
| 67 | 共用 | `GET /meta` 能否补六个值；`GET /ads/meta` 能否加 `notSkippableFullScreenCount` | `googlePlayPackageName`：建议做（包名是公开信息；前端要预检商店链接就必须知道它；放进 `GET /meta` 即可。注意不能用 `play` 渠道的 `packageName` 代替：后端校验链接时用的是环境变量，渠道包名被运营改过后两者会不同）。 |
| 67 | 共用 | `GET /meta` 能否补六个值；`GET /ads/meta` 能否加 `notSkippableFullScreenCount` | `GET /ads/meta` 的 `notSkippableFullScreenCount`：建议做（没有 `ADS:CREATIVE` 的管理员数不了；需要先在契约里定义"算哪些素材"，当前后端没有这个计数，是新增计算）。 |
| 69 | 成本 | `/usage/models` 能否加 `hasActivePrice=false`、`resourceType` 筛选 | 建议做。理由：在服务端按 `resourceType` 和 `hasActivePrice` 筛选分页列表是后台列表的通行做法，是纯新增参数（不影响别的调用方），值不合法时与 `/usage/prices` 一样答 400；前端虽有逐页读取的办法，但模型登记会随用量增长。 |
| 75 | 投放管理 | 成本录入：`amount` 类型、不带 `currency`、批量 400 的明细格式、成功响应 | 建议做（成功响应加 `overwritten` 字段）。做法：保留 `count`，再加 `overwritten`（其中已存在而被覆盖的行数），实现上在批量写入的 SQL `ON CONFLICT` 处用 `RETURNING (xmax = 0)` 区分新增和覆盖。理由：批量导入后告诉运营"新增几行、覆盖几行"是批量导入界面的通行做法，覆盖是静默改钱，应该能看到；只是在响应里加字段，只影响管理端；需要同时改文档第 1535 行的响应写法。 |
| 92 | 渠道包与应用版本 | 版本写接口 400 的 `ref` 和 `reason` | 建议做（版本字段的 400 也像目录接口那样带 `data.details=[{"ref":"<请求字段名>","reason":"EMPTY_NOT_ALLOWED"\|"OUT_OF_RANGE"\|"INVALID_FORMAT"}]`：页面不显示英文 `message`，没有码就只能写"输入内容不合法"；目录、配置、推送接口已经这样做，加字段不影响别的调用方）。 |
| 97 | 形象与装扮 | 服装、动作 `POST/PUT` 请求体是否如前端所写 | 建议做（服装的 `kind` 创建后禁止修改：改种类会让已有形象引用的服装条目变成另一类，和 `key` 一样应创建后不可改；Android、AvatarAgent 只读目录，不受影响；前端的做法本来就是不改）。 |
| 103 | 记忆服务与监控 | 能否在管线监控响应里加 `sources`，或提供单独的来源列表接口 | 建议做。在响应里加 `sources`（字符串数组）：最近 `monitor.max_range_days` 天内有过上报的全部来源，按字母排序，不受请求的 `source` 参数影响。理由：停止上报的来源在短范围里没有点，正是监控最需要看到的；有 `(source, effective_at, id)` 索引，查 7 天内去重来源代价很小；这个接口只有管理后台调用，Android 和 AvatarAgent（上报方走另一条 `POST /api/internal/...` 接口）不受影响。比单独做一个接口好：少一次请求，且与图表同一份数据。 |
| 111 | 成本 | `POST /usage/prices` 成功时 `data` 是什么？档位或价格不合法、确认因档位不连续被拒时 400 的 `ref`、`reason` 是什么（能否给"缺口""重叠"这样的具体码） | 建议做（给 `details`，但不新增"缺口/重叠"码）。理由：同类后台写接口的校验失败都带 `data.details=[{ref, reason}]`，价格页要逐字段提示；`ref` 可用出错字段的路径（如 `bands[1].inputMinTokens`），`reason` 用已有的 `OUT_OF_RANGE`、`EMPTY_NOT_ALLOWED`、`NOT_AN_INTEGER`；"缺口""重叠"属于新增原因码，而契约 112 的原因码是封闭集合，要加得先改契约，一条 message 已能说明，所以不建议单独加。 |
| 112 | 成本 | 确认待审批次因币种不在允许列表被拒时，`data.details` 能否是 `[{"ref":"currency","reason":"OUT_OF_RANGE"}]`（即使请求体没给 currency） | 建议做。理由：与第 111 条同理，后台其他写接口都带 `details`；这里 `ref=currency`、`reason=OUT_OF_RANGE` 都是已有的写法，只改一个抛错点，不影响其他调用方；前端目前只能靠"确认前把币种选项限制在允许列表内"来绕开，但批次自己的币种被移出列表这种情况前端选项拦不住。 |
| 114 | 推送 | `GET /push/records` 要不要按账号、触发原因、本地日期筛选 | 建议做（加 `from`、`to` 两个按创建时间（UTC 日）筛选的参数，规则同其他报表；理由：运营要查“某天的召回”，按创建时间有现成索引，按 `local_date` 单独过滤没有索引，量大时慢；只影响管理后台，不影响 Android 和 AvatarAgent）。 |
| 122 | 应用内广告 | "强制可关闭兜底为 0 且存在不可跳过素材"的警告，后端怎么判断"存在" | 建议做。做法：`GET /ads/meta` 增加 `notSkippableFullScreenCount`（整数），口径就是上面 SQL 的 `count(*)`（和 `nonSkippableFullScreenExists` 同一个条件）。理由：能改 `ads.force_close_seconds` 的是 `ADS:PLACEMENT`，通常读不到素材列表，所以这类管理员无法常驻看到这条警告，只能在保存时才看到；meta 本来就开放给任一 `ADS:*` 权限，加一个计数不泄露内容；只加字段，不影响 Android、AvatarAgent。 |
| 134 | 内容审核 | `FILE` 类内容响应能否加 `expiresAt` | 建议做。`FILE` 响应加 `expiresAt`（UTC，= 签发时刻 + `moderation.content_url_ttl_seconds`）。理由：和文档里所有其他签名地址响应（外观、动作片段、渲染模型都带 `expiresAt`）保持一致；前端可以在过期前重取，不必靠播放失败来发现，也就少产生审计记录；一行代码的改动，其他调用方不受影响。 |
| 137 | 记忆服务与监控 | 409 `MEMORY_MODEL_CONFLICT` 的 `data` 里能否加整数字段 `registeredDimensions` | 建议做。409 的 `data` 加整数 `registeredDimensions`（来自注册前读到的同名模型；读不到时为 null）。理由：技术人员需要看到原来登记的维度才能决定换哪个名字；数据后端已经有；对其他调用方没有影响，因为这是管理后台专用的错误体，原有的 `detail` 字段保留，向后兼容。 |

## 三、向后端提出的改动请求：建议不做（8 项）

| 编号 | 模块 | 问的是什么 | 理由 |
|---|---|---|---|
| 30 | 额度 | 额度包 `/credit-products`：GET 形状、有没有 id、PUT 路径和请求体（surfaces 不出现时是保持还是清空）、重复答什么、credits 范围、productId 长度；能否带 updatedAt 并让 PUT 接受 expectedUpdatedAt | 建议不做（带 `expectedUpdatedAt`）。理由：后台没有按 `updatedAt` 做的乐观锁比较（在 admin、core、common 的 `.java`、`.sql`、`.xml` 里搜了 `expectedUpdatedAt`、`If-Match`、`IfMatch`、`expectedVersion`，0 处命中；广告计划、广告素材的修改只有按预期状态做的条件更新，是状态比较，不是 `updatedAt` 比较，见 COR/ad/repository/AdAdminRepository.java:202-215、537-568；额度包 `PUT /credit-products` 本身没有任何比较，COR/facade/CreditFacade.java:463-489），单独给额度包加一个会让后台的写法不统一；这个页面写入权限的持有人很少，且每次修改都有前后值审计；真要做应在契约里对所有"整行覆盖"的后台写接口统一规定。 |
| 42 | 系统配置 | 开启手机号登录被拒时，400 的 `data` 能否加数组 `missing` | 建议不做（`details` 已经给出缺哪几项，模板只有一个判断条件，再加一个 `missing` 数组是重复信息，还要同步契约）。 |
| 52 | 统计报表 | `/stats/guest/retention?platform=unknown` 能否像日报一样查询 | 建议不做（游客设备的平台在入库时必为 `ANDROID` 或 `IOS`，加这个选项永远是空表） |
| 62 | 内容审核 | `categories` 的类型；`source=REPORT` 时 `autoLevel`、`score`；详情与列表是否同形状；能否直接给等待秒数 | 建议不做（等待秒数）。理由：列表里每条都带服务器时间的秒数会让缓存和重复请求下的数字立刻过时，业界队列页都是前端用创建时间算；`oldestPendingSeconds` 已经提供了服务器时钟下的最老一条。 |
| 65 | 客服 | `GET /support/feedback` 能否按 `forwardStatus`、`category` 筛选；列表每行是全部列还是摘要 | 建议不做（摘要模式）。理由：筛选已经能把结果缩到很少几条；文档 17.4 附录规则 1 规定列表返回全部列；前端把 `pageSize` 设小（如 20-50）即可控制大小。 |
| 67 | 共用 | `GET /meta` 能否补六个值；`GET /ads/meta` 能否加 `notSkippableFullScreenCount` | `attributionCostCurrency`：建议不做（成本页持有 `ATTRIBUTION:MANAGE`，`GET /config` 已返回该键；成本行和投放效果已带 `currency`）。 |
| 70 | 成本 | `PUT /config/attribution.cost_currency` 收到格式不对的币种（usd、euro、US、空串）是否拒绝、答什么、reason 能否不用 `OUT_OF_RANGE`？小写拒绝还是改大写？`ZZZ` 是否拒绝？用量价格的允许币种列表是否也管这个键 | 建议不做（改 reason、拒绝 `ZZZ`）。理由：契约 112 里 `PUT /config/{key}` 的值校验 reason 是一个封闭集合，格式类问题统一用 `OUT_OF_RANGE`，契约 1535 又把"已有成本行"也定为 `OUT_OF_RANGE`，单独加新代码要改契约；前端已提前校验格式，冲突不会发生；拒绝 `ZZZ` 需要维护一份币种清单，收益很小。 |
| 93 | 埋点管理 | 漏斗步骤的事件名里有逗号怎么办 | 建议不做（转义规则或重复参数：事件名本身不可能含逗号，加了没有对象可用） |

## 四、没有完全核实的（17 条）

| 编号 | 模块 | 缺什么 |
|---|---|---|
| 2 | 订阅与权益 | 部分核实：`payload` 里带 `purchaseToken` 这一点已读到代码（入库前 `scrub(n.payload())` 只去掉 `appAccountToken`、`obfuscatedExternalAccountId`，COR/facade/SubscriptionFacade.java:505、1002-1019；适配器另去四个账号键，GoogleSubscriptionAdapter.java:161-162，都不含 `purchaseToken`）。无法确认的一点：Apple 的 `originalTransactionId` "不是凭据、可以保留"是对 Apple 商店行为的判断，不是后端代码里能读到的事实，也没有逐行读 Apple 的绑定分支，所以"它不能用来认领订阅"没有证实 |
| 5 | 短信与邮件 | 部分核实（缺：字符串写法答 400 是从处理器代码推出，没有测试也没有运行；数字、布尔值是否被自动转文本未运行验证）。 |
| 9 | 系统管理 | 部分核实（缺：客户端配置、广告素材配置等其他用 `change(...)` 记录的取值是否可能含机密，未逐个读；运营配置键的取值看过，是数字类） |
| 13 | 用户 | 部分核实（"失败的异常会不会是匿名类"无法确认：删除步骤抛出的异常类型很多，没有逐个步骤去查；匿名类的 `getSimpleName()` 返回空串是 Java 语言行为，拼接方式在 DeletionExecutor.java:251、:259 已读到） |
| 15 | 部署 | 部分核实（缺：嵌套第三方 jar 内部未展开） |
| 16 | 部署 | 部分核实（缺：管理端口 9080 的响应是否带这六个头，代码、测试、runbook 都没有写，无法确认） |
| 30 | 额度 | 部分核实：额度包接口的各项和上面的搜索结果（0 处命中）已核实；没有逐个读完后台所有 PUT 接口，所以不断言"后台所有 PUT 都没有任何并发比较"，只确认没有按 `updatedAt` 做的乐观锁 |
| 38 | 投放管理 | 部分核实（"JSON 数"是根据字段类型、搜不到全局序列化设置、以及上面测试断言推出的，我没有运行请求看原始响应）。 |
| 45 | 系统管理 | 部分核实（缺：除本组模块外的动作与对象类型取值没有逐个列出） |
| 54 | 通话 | 部分核实（①"未知参数被忽略"是读代码推断，没有发请求验证；②`from`/`to` 带 `+08:00` 之类偏移能不能被 `Instant.parse` 接受，没有读到项目里的相关代码也没有运行，无法确认，所以只建议发 `Z` 结尾的 UTC 时刻；其余已核实） |
| 75 | 投放管理 | 部分核实（`amount`、`cost` 是 JSON 数这一点同 38：由字段类型、搜不到全局序列化设置、测试断言推出，没有运行请求看原始响应）。 |
| 79 | 短信与邮件 | 部分核实（缺：`from`/`to` 带偏移量写法是否被 `Instant.parse` 接受，未运行验证；`Z` 结尾的写法已按代码确认）。 |
| 91 | 渠道包与应用版本 | 部分核实（超过 2147483647 时的实际响应没有运行；类型、列类型和统一异常处理已读） |
| 93 | 埋点管理 | 部分核实（"重复参数怎么处理"没有核实，并且不影响结论） |
| 101 | 记忆服务与监控 | 部分核实（记忆服务返回的 422、409 的 `detail` 具体文字是外部服务产生的，本仓库里看不到） |
| 119 | 活动管理 | 部分核实：“没有上限”已确认（`TaskAdminTypes.java:20-30` 是 `Integer`，`DailyTaskAdminService.java:204-208` 只检查下限 1）；“超过 32 位整数范围的数是不带 `details` 的 400”只读到请求体读不懂时统一返回 400（`GlobalExceptionHandler.java:106-111`），仓库里没有针对溢出整数的代码或配置，也没运行，所以这一点无法确认 |
| 137 | 记忆服务与监控 | 部分核实（记忆服务 409 的 `detail` 文字本身是否已含维度，是外部服务产生的，本仓库里看不到） |

## 五、回答文件里单独汇总的“接口文档与后端代码互相矛盾的地方”（原文）

只收录回答文件里有单独汇总节的组；没有汇总节的组（D、E、F），矛盾点写在各问题的答案和依据里，需要时在该组回答文件里搜“接口文档”。

### A-admins-auth-deploy：后端代码与接口文档互相矛盾的地方（汇总）

- 10：管理员二次验证锁定的 429 带 `data.retryAfterSeconds` 和 `Retry-After` 头（`AdminAuthService.java:412-419`，测试 `AdminAuthIT.java:281-284` 断言了），而契约第 111 行只把用户登录锁定、用量接口、导出最小间隔列为带这个字段，并写“其他限流的 429 没有 `data`，也不带 `Retry-After`”；`ApiException.java` 的类注释也写“登录锁定不带 `Retry-After`”（指用户登录）。需要在契约第 111 行补上“管理员二次验证锁定”，或者改代码。
- 85（及 86、87）：管理员用户名 / 角色名 / 权限码重复的 409 `DUPLICATE_RESOURCE` 没有 `data.field`，契约第 151 行写明有。
- 复查 3：契约第 2363 行写 `GET /permissions` 返回裸数组 `[…]`，第 2434 行通则写 `{"items":[…]}`；代码按通则。
- 45：审计日志筛选参数的长度用 UTF-16 单位数（`AuditLogFacade.java:82-83`，`requireLength`），契约通则第 4 条写按码点计（第 2392 行写的是“个字符”）；对实际取值（ASCII）无影响。
- 88（代码内部）：`PermissionTreeService.java:28-34` 的类注释仍写内置节点违规答 409 `INVALID_STATE`，实际代码（`:109-126,148-150`）和契约都是 400 `INVALID_REQUEST`；只是过时注释，不影响行为。
- 4：契约第 2357 行令牌失效的列表没有写“删除管理员”，而代码里删除后令牌同样 401 `ADMIN_INVALID_TOKEN`；不矛盾，是文字没写全。

### B-stats-analytics-sessions：接口文档与后端代码互相矛盾的地方（本组范围内）

- 统计接口的日期范围：DOC:2815 写"日期格式不对或年份小于 1 → `OUT_OF_RANGE`"，但 `/stats/*` 走的 `StatQueryService.range` 调用的是不带最小年份参数的 `StatsRange.resolve`（`CORE/stats/service/StatQueryService.java:89-95` → `CORE/shared/time/StatsRange.java:34-37` 传入 `Year.MIN_VALUE`），所以像 `0000-01-01` 这样年份为 0 的日期代码不会按文档拒绝（投放效果报表等两处调用传了最小年份 1：`CORE/attribution/service/PerformanceReportService.java:90-98`、`ADM/facade/AttributionAdminFacade.java:189-197`）。我没有运行验证年份 0 会得到什么结果；对前端无实际影响，只是文档与代码不一致。

### C-users-moderation-support-alerts-memory：后端代码与接口文档互相矛盾的地方

没有发现本组问题范围内的矛盾（逐项对照了文档 2288-2314、1531、1611、2376-2377、2389-2390、2409、2630 与代码）。唯一值得标注的是对照复查 10 的两点补充（不是矛盾，是"两处编辑权限都是 MODERATION:CONFIG"的说法对通用配置接口不完整）。

### G-sms-notifications-clientconfig-config：后端代码与接口文档互相矛盾（或文档自相矛盾）的地方

- 5/78：DOC 3852 写“`credentials` 是值为非空字符串的对象”；代码只拒 null，空串的值、空串的名称都接受（`SmsAdminFacade.java:438-445`）。
- 138：DOC 2473 写“五个模板码各一项”，DOC 2401 和代码、数据库约束都是六个（`V1__schema.sql:393-395`）。
- 41：DOC 3833 对渠道被拒没写 `details`，代码有 `[{"ref":"SmsChannel","reason":"OUT_OF_RANGE"}]`（文档缺，不算冲突）。

### H-channels-cosmetics-shared：后端代码和接口文档互相矛盾的地方

- 47、100、98：接口文档 150 和 2372 写 409 `INVALID_STATE` 的 `data` 是 `{"status":"<当前状态>"}`；代码里版本和渠道的状态错误（`AppVersionAdminService.java:410-412`）、动作补生成（`LookFacade.java` 的停用动作）、默认数字人（`DefaultAvatarFacade.java:436-441`）的 409 没有 `data`，服装默认条目的 409 带的是 `data.kind`（`CatalogAdminService.java:285-288`）。本组涉及的接口里，只有上传被用（`data.status="CONSUMED"`，`DefaultAdminUploadService.java:301`）带 `data.status`；其他模块的 409 `INVALID_STATE` 有不少是带 `data.status` 的，例如投诉（`ComplaintFacade.java:565`）、删除（`DeletionAdminFacade.java:136`）、统计落地（`StatsAdminFacade.java:244`）、客服（`SupportAdminFacade.java:92`）、管理员账号（`AdminAccountService.java:428`）、签到活动（`CheckinAdminService.java:317`）、额度调整申请（`AdjustRequestService.java:92`）、权益（`EntitlementFacade.java:359`）、登录方式（`LoginMethodFacade.java:92`）、审核（`ModerationFacade.java:320`）、价格批次（`PriceTableService.java:469`）、推送任务（`PushTaskService.java:82`）、封禁（`BanService.java:70`）。
- 23：接口文档 2434（通则 1）写不分页的接口只有 `items`；`GET /channels` 的代码返回裸数组，没有 `items`。文档 3984 没有单独写这个接口的外层形状。

## 编号在哪一部分

按 for-backend.md 的编号找答案：下表给出每个编号所在的部分，每部分内的小节标题就是“### 编号（模块）问题”。

| 部分 | 编号 |
|---|---|
| A（admins-auth-deploy） | 1, 4, 8, 9, 10, 14, 15, 16, 17, 18, 19, 20, 21, 22, 44, 45, 46, 85, 86, 87, 88 |
| B（stats-analytics-sessions） | 3, 24, 25, 26, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 93 |
| C（users-moderation-support-alerts-memory） | 13, 27, 43, 58, 59, 60, 61, 62, 63, 65, 66, 82, 94, 95, 101, 102, 103, 134, 137, 140 |
| D（subscriptions-credits-cost） | 2, 28, 29, 30, 31, 32, 68, 69, 70, 104, 105, 106, 107, 108, 109, 110, 111, 112 |
| E（push-invite-activity） | 12, 33, 34, 35, 36, 37, 71, 72, 73, 74, 113, 114, 115, 116, 117, 118, 119, 120 |
| F（campaign-ads） | 7, 38, 39, 40, 75, 76, 77, 121, 122, 123, 124, 125 |
| G（sms-notifications-clientconfig-config） | 5, 6, 41, 42, 78, 79, 80, 81, 126, 127, 128, 129, 130, 131, 132, 133, 138, 139 |
| H（channels-cosmetics-shared） | 11, 23, 47, 64, 67, 83, 84, 89, 90, 91, 92, 96, 97, 98, 99, 100, 135, 136 |


---

# 第 A 部分：admins-auth-deploy

共 21 条：已核实 17 条，部分核实 4 条（9、15、16、45），未核实 0 条；前端要改 6 条（10、16、22、44、87、88）；改动请求 5 条（17、19、22、45、46，都是建议做；其中 19 号只做 `/me` 加 `roleIds`，`/roles` 加 `heldByMe` 那一项另写为建议不做）；接口文档新版已写明 4 条（1、18、22、88，其余只写明一部分）。另有 2 条对照复查（3、4），都已核实，3 号有一处需要更正。

已按独立核对结果更正：更正 5 处，行号 6 处。

说明：
- 路径都相对 `D:\Projects\PycharmProjects\AvatarBackend`，除非写明“契约”。契约 = `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md`（提交 e07469d1）。问题表里写的契约行号是旧版行号，本文一律改写成新版行号（核对过：第 111 行 RATE_LIMITED、第 118 行 ADMIN_FORBIDDEN、第 151 行 DUPLICATE_RESOURCE、第 2392 行“系统管理”整行、第 3489 行权限树验收项）。
- “错误信封”：所有响应都是 `{"code":"…","message":"…","data":…}`，成功时 code 是字符串 "200"，失败时 code 是错误码（`common/src/main/java/com/avatarapp/backend/common/web/ApiResponse.java:10-24`）。下文说“答 401 X”就是 HTTP 状态 401、`code` 为 X。
- 只做了读代码和读测试，没有运行任何东西。测试文件只当佐证，结论落在主代码行号上。

---

### 1（系统管理）持有“管理员管理”权限但不是超级管理员的人，能不能对超级管理员重置密码、重置二次验证、停用、删除、改角色？一律拒绝吗？错误码？
- 答案：一律拒绝，五个操作（改资料含改角色 `PUT /admins/{id}`、停用启用 `status`、重置密码、重置二次验证、删除）都是同一个检查：目标是超级管理员而操作者不是 → 403 `ADMIN_FORBIDDEN`，`message` 是 "Only a super administrator can change a super administrator"，`data` 为 `null`。对改资料、重置密码、重置二次验证、删除这四个操作，这个检查在“目标存在”之后、其他所有检查之前（所以对不存在的 id 先答 404 `RESOURCE_NOT_FOUND`）；`status` 接口先校验请求里的状态值（不是 `ACTIVE` 或 `DISABLED` 答 400 `INVALID_REQUEST`，`ref` 为 `status`、`reason` 为 `OUT_OF_RANGE`），再查目标存在，再做这个检查。操作者是超级管理员时不受限。
  另外有一条前端没问、但会同样答 403 的规则：非超级管理员对“角色权限码超出自己所持权限码”的普通管理员，也不能做这五个操作（403 `ADMIN_FORBIDDEN`，message "Administrators can only act on administrators whose permissions they hold"）。
- 依据：`core/src/main/java/com/avatarapp/backend/core/adminuser/service/AdminAccountService.java:407-412`（超管目标检查）；调用点 `:188`（update）、`:237`（setStatus）、`:264`（resetPassword）、`:279`（resetTotp）、`:293`（delete）；目标权限码检查 `:419-421`；先查存在的 `lock` 在 `:316-341`；`status` 接口先校验状态值再 `lock`（`:233-237`）；测试 `admin/src/test/java/com/avatarapp/backend/admin/SystemAdminIT.java:141-188`（五个路由逐个断言 403 `ADMIN_FORBIDDEN` 且数据未变）；契约第 2392 行（“只有 superAdmin=true 的管理员能对一个 superAdmin=true 的管理员执行……其他持有 ADMIN:MANAGE 的管理员一律得到 403 ADMIN_FORBIDDEN”以及检查顺序）。
- 和前端暂定做法：一致（对超级管理员那一行，非超级管理员不显示任何操作）。补充：前端如想对第二条规则也提前隐藏，要拿“目标行的角色权限码”和“我的 `permissions`”比较，见 18 号。
- 改动请求：无
- 核实程度：已核实

### 4（系统管理）管理员被 DELETE 之后，他之前签发的令牌调用管理端接口，是否答 401 `ADMIN_INVALID_TOKEN`？
- 答案：是。每次请求都按令牌里的管理员 id 重新查 `admin_user`（条件：id 相同、`status='ACTIVE'`、`token_version` 相同）。行已被删除，查不到，令牌被拒；过滤器把这个请求留作“未认证”，安全链的入口处统一答 401 `ADMIN_INVALID_TOKEN`，message "Invalid or expired token"，`data` 为 `null`。令牌过期、签名错、不是管理员受众、停用、改密码、重置二次验证也都是同一个 401，不会有 403、404 或 500。所以前端看到 401 `ADMIN_INVALID_TOKEN` 就可以确定是“登录失效或账号没了”，回登录页；“服务暂时不可用”页只用于 5xx 和网络错误。
- 依据：`core/.../adminuser/service/AdminAuthService.java:455-486`（`authenticate` 查不到行抛 `AdminTokenRejected("administrator")`）；`admin/src/main/java/com/avatarapp/backend/admin/security/AdminAuthenticationFilter.java:47-56`（吞掉拒绝，不设认证）；`admin/.../security/AdminSecurityConfiguration.java:56-62`（`anyRequest().authenticated()` 与入口处写 401 `ADMIN_INVALID_TOKEN`）；`AdminErrorWriter.java:24-32`。DELETE 管理员本身删的是 `admin_user` 行和 `admin_user_role` 行（`AdminAccountService.java:301-302`）。测试里没有“删除后用旧令牌请求”的专门用例，只有停用、重置密码、重置二次验证、改密码后令牌失效的用例（`AdminAuthIT.java:387-420` 的 `aChangedTokenVersionStopsIssuedTokens`、`:461`）；删除这条是由代码路径推出（查不到行与停用后查不到行走同一个分支）。契约第 2357 行写了停用、重置密码、重置二次验证、改密码四种，没有把“删除”写进去；第 119 行写明“管理员 JWT 无效、过期或缺失”都是 401 `ADMIN_INVALID_TOKEN`。
- 和前端暂定做法：一致（不猜 403、404）。可以简化：401 `ADMIN_INVALID_TOKEN` 直接回登录页。
- 改动请求：无（契约第 2357 行建议把“删除管理员”补进令牌失效的列表，属契约文字补充，不是后端改动）
- 核实程度：已核实（代码路径；无针对删除的测试）

### 8（系统管理）创建、修改管理员的成功响应是什么形状？重置密码、重置二次验证、启停、删除返回 `null` 吗？
- 答案：
  - 创建管理员 `POST /admins`：`data` 是 `{"id":"<UUID 字符串>"}`，只有这一个字段，不是 `GET /admins` 里的对象。
  - 修改管理员 `PUT /admins/{id}`：`data` 是 `null`。
  - `POST /admins/{id}/status`、`POST /admins/{id}/reset-password`、`POST /admins/{id}/reset-totp`、`DELETE /admins/{id}`：`data` 都是 `null`。
  - 响应里没有任何密码字段，服务端不生成临时密码（密码都是请求体里的 `password` / `newPassword`）。
  - 顺带：创建角色 `POST /roles` 也是 `{"id":…}`，`PUT/DELETE /roles/{id}` 是 `null`；权限节点的 `POST/PUT/DELETE /permissions` 都是 `null`（没有返回 code，因为 code 是请求里自己给的）。
- 依据：`admin/.../controller/AdminUserAdminController.java:48-86`（各方法返回类型 `ApiResponse<CreatedResponse>` / `ApiResponse<Void>`）；`admin/.../facade/SystemAdminFacade.java:79`（`CreatedResponse(UUID id)`）；`RoleAdminController.java:46-63`；`PermissionAdminController.java:49-66`；测试 `SystemAdminIT.java:121-124`（取 `data.id`）。契约第 2392 行写了“创建时由创建者设置初始密码”，没有逐个写响应形状。
- 和前端暂定做法：一致（页面只用响应判断成功，不读密码字段）。
- 改动请求：无
- 核实程度：已核实

### 9（系统管理）审计日志的 `detail` 是字符串还是 JSON？能否保证里面从不写密码、令牌、验证码、凭据？
- 答案：
  - 类型：JSON 对象（不是字符串）。库里是 `jsonb` 列，非空；接口把它原样解析成 JSON 返回。对象最多有三个键，没有内容的键不出现，所以可能是 `{}`：`ids`（对象，名字到标识值，如 `{"adminId":"…"}`）、`changes`（数组，每项 `{"field","before","after"}`，值可以是 `null`、字符串、数、布尔、数组，或配置值的 JSON）、`adminText`（对象，键只会是 `REASON` 或 `NOTE`，值是管理员自己输入的原因或备注）。
  - 保证：写入口是类型封死的。`AuditDetail` 只有 `id`、`change`、`adminText` 三个入口，值只接受空、字符串、数、布尔、UUID、枚举、时间、JSON 树和它们的列表，其他对象直接抛异常；整个后端只有 `AdminAuditLogService.record` 一个地方往 `admin_audit_log` 写。我另外搜了所有 `.id(`、`.change(`、`.adminText(` 调用里名字含 token、secret、password、credential、totp、otp、code 的（搜索式：`\.(change|id|adminText)\("[^"]*(token|secret|password|credential|totp|otp|code)`，在 admin、core、app、worker 四个模块的 main 里命中 30 条左右）：命中的都是对象编码（`channelCode`、`templateCode`、权限节点 `code`、角色 `permissionCodes`、`versionCode`）和两个布尔标记 `tokenSet`、`tokenCleared`（投放账户的令牌只记“设了/清了”，不记值，`CampaignService.java:120-154`）；没有任何一处把密码、令牌、验证码、二次验证密钥放进去。管理员创建、重置密码、重置二次验证、改密码的审计 `detail` 里只有 `adminId`（和创建时的用户名、superAdmin、roleIds）。
  - 没有核实到的部分：`changes` 里的 before/after 会原样记配置项（`AppConfig`、客户端配置）的值，我没有逐个检查所有配置键的值是不是可能放机密；引用 `AuditDetail` 的文件共 42 个（不含 `AuditDetail.java` 本身），我读了管理员体系的全部和其余的调用名，没有逐个读每个调用传入的值。配置项写入审计只有 `ConfigWriteService.java:96,118` 两处，都是 `change(key, 旧值, 新值)`；运营配置键名里带 token 的都是数字类取值（时长、长度、次数），没有看到机密；客户端配置（`ClientConfigValue`）、广告素材配置等其他用 `change(...)` 的地方没有逐个读。
- 依据：`core/src/main/java/com/avatarapp/backend/core/shared/audit/AuditDetail.java:34-152`（三个入口、`checkValue`、`toJson`）；`AdminAuditLogService.java:44-63`（唯一写入点）；`AdminAuditLogReader.java:73-87`（读取 SQL 与行映射）、`admin/.../facade/AuditLogFacade.java:36-48,71-78`（`detail` 是 `JsonNode`）；`core/src/main/resources/db/migration/V1__schema.sql:98-108`（`detail jsonb NOT NULL`）；`AdminAccountService.java:171-180,272,286,304-309`；`AdminAuthService.java:519-524`。契约第 2345 行、第 2435 行只写了“写一条审计日志”和字段，没有写 `detail` 的形状。
- 和前端暂定做法：一致（按“类型不定”显示，再遮敏感键名的字符串值，作为第二道防线）。现在已知类型固定是对象，可以直接按 `ids` / `changes` / `adminText` 三块排版，遮罩留着无害。
- 改动请求：无
- 核实程度：部分核实（缺：客户端配置、广告素材配置等其他用 `change(...)` 记录的取值是否可能含机密，未逐个读；运营配置键的取值看过，是数字类）

### 10（登录与权限）验证码连续错误到上限时的状态码和 `retryAfterSeconds`
- 答案（上限默认 5 次，锁定默认 5 分钟，配置键 `admin.totp_max_failures`、`admin.totp_lockout_minutes`）：
  1. 达到上限的那一次错误本身（第 5 次错误验证码）：答 401 `ADMIN_TOTP_INVALID`，不是 429。第 6 次起（密码正确时）才答 429 `RATE_LIMITED`。（每次尝试在校验前先占一个名额，名额用完才拒；第 1 到第 5 次都会被真正校验。）
  2. 这个 429 带 `data.retryAfterSeconds`（整数秒，至少 1，为锁剩余时间），而且**同时带 `Retry-After` 响应头**。契约第 111 行没有把管理员二次验证锁定列进“带 `retryAfterSeconds`”的名单，也说其他限流的 429 “不带 `Retry-After`”，代码与这句话不一致，见本文末尾“矛盾”一节。
  3. 锁定期间“一律 429”不对：锁的检查在密码校验**之后**。锁定期间用错误密码登录，答的是 401 `ADMIN_INVALID_CREDENTIALS`（和平时完全一样，不暴露锁的存在）；只有密码正确才答 429（即使没带 `totp` 也是 429，不再是 `ADMIN_TOTP_REQUIRED`）。
  4. 登录接口另有一条独立的限流：同一 IP + 同一用户名（忽略大小写）每分钟超过 `ratelimit.admin_login_per_min`（测试里是 10 次）答 429 `RATE_LIMITED`，没有 `data`，没有 `Retry-After`；它在校验密码**之前**，所以这种 429 里没有 `retryAfterSeconds`，页面要用通用文字。
  5. 绑定认证器那一步 `POST /auth/totp/enroll`：错误验证码答 401 `ADMIN_TOTP_INVALID`，与登录共用同一个计数；第 5 次错误本身仍答 401 `ADMIN_TOTP_INVALID`，同时令牌作废；之后再用这个令牌（哪怕验证码对）答 401 `ADMIN_INVALID_TOKEN`；超过次数的并发请求同样答 401 `ADMIN_INVALID_TOKEN` 并作废令牌。绑定一步从来不答 429。令牌作废后，再用用户名密码登录会答 429（锁还在）。
  6. 计数或锁用的 Redis 不可用时，登录、绑定都答 503 `DEPENDENCY_UNAVAILABLE`（登录节流是“失败即关闭”）。
- 依据：`core/.../adminuser/service/AdminAuthService.java:219-281`（顺序：登录限流 → 密码 → 停用 → `refuseWhileLocked` → 绑定或 `ADMIN_TOTP_REQUIRED` → `reserveAttempt` → 校验）、`:396-419`（`refuseWhileLocked`、`locked` 构造 429、`retryAfterSeconds`、`retryAfterHeader=true`）、`:335-385`（enroll 的次数与作废）、`:443-446`（503）；`common/src/main/java/com/avatarapp/backend/common/redis/RedisScripts.java:59-72` 与 `RedisCounters.java:106-121`（名额：计数不超过上限才放行，超过则不加计数、不延长）；`ConfigKeys.java:552-556`（默认 5、5）；`core/.../ratelimit/service/RateLimitServiceImpl.java:70-78`（普通限流无 `data`）；测试 `admin/.../AdminAuthIT.java:260-290`（前 5 次 `ADMIN_TOTP_INVALID`，第 6 次 429，`retryAfterSeconds` 290 到 300，`retry-after` 头等于它，锁定期间错误密码仍是 `ADMIN_INVALID_CREDENTIALS`）、`:293-306`（4 次错后第 5 次对的仍登录成功）、`:322-340`（绑定五次错后令牌作废）、`:343-356`（登录 10 次后限流 429）、`:587-611`（并发）；契约第 2350-2353 行、第 111 行。
- 和前端暂定做法：不一致（前端要改：①“第 5 次就答 429”改为第 5 次仍是 401 `ADMIN_TOTP_INVALID`，从第 6 次起（密码正确时）才是 429，页面在第 5 次时可以自己提示“再错将被锁定”；②“锁定期间一律 429”改为：只有密码正确才是 429，密码错误仍是 401 `ADMIN_INVALID_CREDENTIALS`，页面不要因为 401 就断定没被锁；③“绑定超次数 429 且令牌作废”改为：绑定一步超次数答 401 `ADMIN_INVALID_TOKEN`，不是 429，页面应回到登录第一步；④ 429 要区分有无 `data.retryAfterSeconds`：有就写“N 秒后再试”，没有（IP+用户名限流）用通用文字。）
- 改动请求：无
- 核实程度：已核实

### 14（共用）目录、动作、渲染模型、默认数字人、账号形象、投诉证据、审核内容这些带短时效签名地址的读接口，响应能否都带 `Cache-Control: no-store`？
- 答案：现在已经满足。管理端应用的每一个响应（含成功、各种错误、401、404）都默认带 `Cache-Control: no-store`，由一个全局过滤器在请求最前面设置；管理端的控制器没有任何一处自己改 `Cache-Control`（我搜了 `admin/src/main` 下所有 `Cache-Control`、`CacheControl`、`CACHE_CONTROL`，没有设置，只有一行注释；管理端控制器也不使用 `ResponseEntity`，xlsx 导出只写 `Content-Disposition`），所以上面列的读接口都是 `no-store`。
- 依据：`common/src/main/java/com/avatarapp/backend/common/web/SecurityHeadersFilter.java:55`（`Cache-Control: no-store`）、`:47-48,98-105`（最高优先级，默认值，处理者自己设才会替换）；`AdminApplication.java` 扫描 `com.avatarapp.backend.common`（`admin/src/main/java/com/avatarapp/backend/admin/AdminApplication.java:14` 的 `scanBasePackages`）；`AdminSecurityConfiguration.java:44-49`（关掉 Spring Security 自己的头，避免重复）；`AdminXlsxExporter.java:153`；测试 `admin/src/test/java/com/avatarapp/backend/admin/SecurityHeadersIT.java:30-58`（只覆盖 401、登录接口、`/no/such/route` 的 404，没有对这些具体读接口逐个断言）；`docs/runbook.md:348-356`。
- 和前端暂定做法：一致（前端请求也带 no-store 无害，但不必依赖）。
- 改动请求：无（已满足）
- 核实程度：已核实（机制与“管理端无覆盖”；没有对这些具体接口逐个跑响应头）

### 15（部署）后端的管理端应用有没有任何会返回前端页面（网页、脚本、样式、图片）的路由或静态资源配置？
- 答案：没有。管理端应用只有 `/api/admin/**` 的接口和（单独的管理端口 9080 上的）健康检查/指标；没有静态资源目录、没有模板引擎、没有 Swagger 之类带页面的依赖，也没有自定义的资源映射。未匹配的路径（包括 `/`、`/index.html`）答 404 JSON `RESOURCE_NOT_FOUND`，并且也带那组安全头。所以前端静态文件必须由反向代理（或另一个静态站点）提供，后端的 `Content-Security-Policy: default-src 'none'` 不会作用到前端页面（前提是代理不把前端页面请求转给管理端应用）。
  核实的方法：① 管理端模块 `src/main/resources` 下只有 `application.yml` 和 `i18n/export/*.properties`（用 `find` 列出）；② 全仓库搜 `addResourceHandlers`、`spring.web.resources`、`add-mappings`、`static-locations`：0 处；③ 全仓库找名为 `static`、`public`、`templates`、`webapp` 的目录：只有 `core/src/main/resources/notification/templates`（通知模板，不是静态位置）；④ `admin/pom.xml`、`core/pom.xml`、`common/pom.xml` 没有 springdoc、swagger、webjars、thymeleaf、freemarker、mustache；⑤ 已构建的 `admin/target/avatar-admin.jar` 自身条目里没有 `static`、`public`、`.html`、`.js`、`.css`。没有核实的：jar 里嵌套的第三方 jar 内部（没有展开）。
- 依据：`admin/src/main/java/com/avatarapp/backend/admin/AdminApplication.java:17-24`；`admin/src/main/resources/application.yml:1-52`；`common/.../web/GlobalExceptionHandler.java:175-178`（`NoResourceFoundException` → 404 `RESOURCE_NOT_FOUND`）；`SecurityHeadersIT.java:52-58`（`/no/such/route` → 404 且带安全头）；`docs/runbook.md:291-292`（反向代理路由表：`/api/admin/**` → `admin:8080`，其余到 `app:8081`，没有写前端静态文件）；契约第 2356 行（网页和接口同一域名，由反向代理转发 `/api` 前缀）。
- 和前端暂定做法：一致（部署文档要求前端静态文件由反向代理提供）。注意：runbook 的路由表“其余全部转 app:8081”，前端静态文件的路由要在它之前单独配置，runbook 没写这一条。
- 改动请求：无
- 核实程度：部分核实（缺：嵌套第三方 jar 内部未展开）

### 16（部署）后端加的安全响应头是哪六个、值、加在哪些响应上；`/api/admin/**` 是否自己设 `Cache-Control`；反向代理还需要补哪些？
- 答案：
  1. 六个头和值（一字不差）：`X-Content-Type-Options: nosniff`；`Cache-Control: no-store`；`Referrer-Policy: no-referrer`；`Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`；`X-Frame-Options: DENY`；`Strict-Transport-Security: max-age=31536000; includeSubDomains`。
  2. 加在哪：管理端业务端口（8080）的**每一个**响应，包括成功、各种错误、安全链的 401/403、404、文件下载以外的所有。不是只加公开文件路由。管理端口 9080（健康检查和指标）上带不带这些头，代码和测试里都没有断言，`docs/runbook.md:348` 也只写了业务端口，所以没有核实；前端不访问 9080（`docs/runbook.md:300`：管理端口永不经反向代理）。HSTS 无条件发送（应用看不到代理的 TLS）。
  3. 处理者自己设同名头会“替换”默认值而不是追加；`/api/admin/**` 的控制器没有任何一个自己设 `Cache-Control`（见 14 号），所以管理端接口响应的 `Cache-Control` 恒为 `no-store`。
  4. 反向代理要做的：对 `/api/admin/**` 不要再加这六个头里的任何一个；如果一定要加，必须是“替换”而不是“追加”（用 nginx 时先 `proxy_hide_header` 再 `add_header`，否则同一个头出现两次）；runbook 要求这些主机只走 HTTPS，且提醒 HSTS 带 `includeSubDomains` 会波及同域所有子域。前端静态页面的响应头（比如页面自己的 CSP）后端不管，由代理或静态站点自己给——这是我的建议，不是代码里的事实。
- 依据：`common/.../web/SecurityHeadersFilter.java:25-30,52-62,98-105`；`AdminSecurityConfiguration.java:44-49`（关掉 Spring Security 默认头，保证只有一个来源）；`admin/src/test/.../SecurityHeadersIT.java:30-58` 与 `common/src/test/java/com/avatarapp/backend/testkit/SecurityHeaderAssertions.java:25-34,57-67`（每个头恰好一次，且没有 `Pragma`、`Expires`、`X-XSS-Protection`）；`docs/runbook.md:348-356`（“a proxy or CDN header of the same name replaces ours, never appends”是 runbook 对代理的要求）。契约对 `/api/admin/**` 没有写这六个头（在契约里搜 `Content-Security-Policy`、`X-Frame-Options`、`Strict-Transport` 命中 0 处；`nosniff` 只命中第 3728 行，是别的上下文；`Referrer-Policy` 只命中第 566 行，写的是密码重置链接所在页面要走 HTTPS 并带 `Referrer-Policy: no-referrer`，针对 `app` 一侧的重置链接页面，不是管理端接口）。
- 和前端暂定做法：不一致（前端要改：示例配置里只给 `/api/` 加 `Cache-Control: no-store` 的那一条要删掉，或写成替换；后端已经给了，再加会让响应里出现两个 `Cache-Control`）。
- 改动请求：无
- 核实程度：部分核实（缺：管理端口 9080 的响应是否带这六个头，代码、测试、runbook 都没有写，无法确认）

### 17（系统管理）四类“只能授出自己持有的权限”的 403，`data` 能否改为 `{"reason":"<代码>"}`？
- 答案：现在这四类 403 的 `data` 都是 `null`，只有英文 `message` 不同；契约第 2392 行也明确写了“违反任何一条 403 `ADMIN_FORBIDDEN`（`data` 为 `null`）”。系统管理的授权规则里实际有六种互不相同的 403 `message`（都是同一个错误码 `ADMIN_FORBIDDEN`，按触发位置）：
  ① 创建或修改管理员时 `roleIds` 的角色权限码超出自己所持 / 创建或修改角色时 `permissionCodes` 超出自己所持：message 都是 "Administrators can only grant permissions they hold"（两处同文，页面按接口区分）；
  ② 修改或删除角色时，角色原有权限码超出自己所持："Administrators can only change roles whose permissions they hold"；
  ③ 修改自己被分配的角色："Administrators cannot change a role they hold"；
  ④ 对权限码超出自己的管理员做修改、启停、重置、删除："Administrators can only act on administrators whose permissions they hold"；
  另外两种不在“四类”里，但同样是 403 `ADMIN_FORBIDDEN`：⑤ 对超级管理员操作（见 1 号）；⑥ 非超级管理员设置或清除 `superAdmin`（创建时 `superAdmin=true` 也一样），message "Only a super administrator can change superAdmin"。
  管理端还有两句框架层的 403 `ADMIN_FORBIDDEN`，不属于系统管理的授权规则：强制改密码期间 "Password change required"，缺权限码 "Permission denied"（`admin/.../security/AdminAccessInterceptor.java:42,45`）。
  前端的映射：契约四条对应 ①（创建角色、创建或修改管理员的 roleIds）、②③（修改角色）、②（删除角色）、④（对目标管理员的五个操作）。
- 依据：`core/.../adminuser/service/AdminAccountService.java:57-58`（①④ 的 message）、`:407-412`（⑤）、`:423-425`（⑥）、`:419-421`（④）；`AdminRoleService.java:45-46`（①②）、`:146`（③）；`AdminPermissionService.java:138-145`（`requireHeld` 抛 403，无 `data`）；`common/.../web/ApiException.java:46-48`；契约第 2392 行。
- 和前端暂定做法：一致（写一句覆盖四类规则的通用话；现在后端也没有别的信息可用）。注意不要解析英文 `message` 来区分。
- 改动请求：建议做。理由：页面只看错误码无法告诉操作者是哪一条挡住了他，`message` 是英文且没有承诺稳定；做法是在 `data` 里加 `{"reason":"GRANT_NOT_HELD" | "ROLE_NOT_HELD" | "OWN_ROLE" | "ADMIN_NOT_HELD" | "SUPER_TARGET" | "SUPER_FLAG"}`，顶层错误码仍是 `ADMIN_FORBIDDEN`；只影响管理端，Android、AvatarAgent 不调这些接口；同时要改契约第 2392 行的“`data` 为 `null`”。名字由后端定，上面是建议值。
- 核实程度：已核实

### 18（系统管理）对非超级管理员，`GET /me` 的 `permissions` 是否正好等于规则里“持有的权限码”？
- 答案：对非超级管理员，是同一个集合：两者都是“该管理员所有角色的权限码并集”，用同一条 SQL 取（`admin_user_role` 连 `admin_role_permission`，去重）。`/me` 读的是进程内缓存（最长 `admin.permission_cache_seconds`，默认 30 秒；改角色、换角色、删除等写操作提交后会立刻使本机缓存失效并升高 Redis 里的共享版本号，其他实例下一次请求即重读），而“授权规则”那四条检查每次直接读数据库（不走缓存）。所以只有时间差：刚改过权限的 30 秒内（Redis 不可用时），`/me` 可能比规则所用集合旧。没有“一边有、另一边没有”的码类型：`/me` 会包含被分配到角色里的 `MENU:` 页面节点和自定义节点，规则所用集合也一样包含。
  对超级管理员不同：`/me` 返回全部 79 个内置权限码（不含自定义节点），而这四条规则对超级管理员不检查（直接放行）；所以超级管理员不需要预先禁用任何节点。
- 依据：`core/.../adminuser/service/AdminPermissionService.java:90-95`（`codesOf`：超管返回内置码，否则 `roleCodes`）、`:111-128`（缓存与版本号）、`:138-145`（规则读 `storedCodesOf`，超管直接放行）、`:185-192`（同一条 SQL）；`admin/.../facade/AdminAuthFacade.java:49-56,77-85`；`core/.../adminuser/api/BuiltinPermissionTree.java:23-197`（79 个 `PermissionCodes.` 节点）；契约第 2392 行（“持有的权限码”指各角色权限码的并集，保存时按最新数据判断）、第 2344 行（`/me`）。
- 和前端暂定做法：一致（按 `permissions` 预先禁用，后端 403 兜底；缓存时间差正好由 403 兜底）。
- 改动请求：无
- 核实程度：已核实

### 19（系统管理）能否在 `GET /me` 加 `roleIds`，或在 `GET /roles` 每行加 `heldByMe`？
- 答案：现在都没有。`/me` 恰好六个字段：`id`、`username`、`superAdmin`、`mustChangePassword`、`permissions`、`passwordMinLength`；`GET /roles` 每项是 `id`、`name`、`remark`、`createdAt`、`permissionCodes`。要知道“我持有哪些角色”，现在只有两条路：持有 `ADMIN:MANAGE` 时，`GET /admins` 里自己那一行的 `roles`；否则没有办法。“不能改自己持有的角色”这条规则只对非超级管理员生效（超级管理员可以改），判断依据是 `admin_user_role` 里有没有这条关联。
- 依据：`admin/.../facade/AdminAuthFacade.java:49-56`；`admin/.../facade/SystemAdminFacade.java:62`；`core/.../adminuser/service/AdminRoleService.java:145-147`（`!actor.superAdmin() && permissions.holdsRole(...)`）；`AdminPermissionService.java:168-173`；契约第 2344 行、第 2392 行。
- 和前端暂定做法：一致（等 403 后显示通用句）。
- 改动请求：建议做 `roleIds`（加在 `/me`），建议不做 `heldByMe`（加在 `/roles`）。理由：`/me` 是“当前管理员是谁”的唯一位置，加一个字符串数组几乎零成本，也不影响 Android、AvatarAgent；`/roles` 是另一个页面的选项来源（通则第 5 条），每行带“我的”字段会让同一份列表依赖调用者，不如让前端用 `/me.roleIds` 自己比对。
- 核实程度：已核实

### 20（登录与权限）`COSMETIC:GRANT`、`STATS:EXPORT`、`STATS:LAND` 的父节点实际是谁？`SUBSCRIPTION:CONFIG` 是 `MENU` 还是 `FUNCTION`？
- 答案（内置权限树，启动时同步进表；已存在的码的 `parent`、`type` 每次启动都跟着代码走）：
  - `COSMETIC:GRANT`：父节点 `MENU:/users/:id`（用户详情页），类型 `FUNCTION`。
  - `STATS:EXPORT`：父节点 `MENU:STAT`（“统计报表”这个一级菜单本身，不是 `MENU:/stat/daily`），类型 `FUNCTION`。注意同组的 `STATS:VIEW` 的父节点是 `MENU:/stat/daily`，两者不同。
  - `STATS:LAND`：父节点 `MENU:/cost/report`（成本报表页），类型 `FUNCTION`。
  - `SUBSCRIPTION:CONFIG`：`FUNCTION`，父节点 `MENU:/credits/products`。
- 依据：`core/src/main/java/com/avatarapp/backend/core/adminuser/api/BuiltinPermissionTree.java:36`（COSMETIC:GRANT）、`:138`（STATS:EXPORT）、`:161`（STATS:LAND）、`:85`（SUBSCRIPTION:CONFIG）、`:137`（STATS:VIEW 对照）；同步规则 `core/.../adminuser/service/PermissionTreeSync.java:23-34,92-117`（已存在的码保留后台改过的名称和排序，`parent` 与 `type` 跟随代码）。这个文件是从 `docs/admin-frontend-design.md` 生成的（文件首行注明），契约第 2363 行写明以那份设计文档为准。
- 和前端暂定做法：一致（不写死任何父子关系，全部读 `parent`）。
- 改动请求：无
- 核实程度：已核实

### 21（登录与权限）`POST /auth/change-password` 失败时的状态码、`ref`、`reason`、长度口径
- 答案：
  - 旧密码错：401 `ADMIN_INVALID_CREDENTIALS`，message "Invalid password"（不是 `ADMIN_INVALID_TOKEN`，不会让前端回登录页）。旧密码为空、超长也是这个 401；旧密码在新密码校验**之前**检查。
  - 新密码不合规：400 `INVALID_REQUEST`，`data.details = [{"ref":"newPassword","reason":"<码>"}]`（只报第一个失败的）。`reason`：为空 `EMPTY_NOT_ALLOWED`；太长（超过 `auth.password_max_length`，默认 128）`TOO_LONG`；太短（少于 `admin.password_min_length`，默认 12）`OUT_OF_RANGE`；与用户名相同（忽略大小写）`OUT_OF_RANGE`。注意：“太短”和“与用户名相同”用的是同一个 `reason`，只能靠 `message`（"Password too short" / "Password must differ from the username"）区分。
  - 长度口径：先做 NFKC 规范化，再按 Unicode 码点数计，不去首尾空白（密码不裁剪）。所以前端的预校验也应该先 NFKC 再数码点。新密码不要求与旧密码不同。
  - 成功后该管理员所有令牌（含当前这个）立即失效，`mustChangePassword` 清除；`GET /me` 的 `passwordMinLength` 给出当前最小长度。
- 依据：`core/.../adminuser/service/AdminAuthService.java:498-525`（顺序与错误）；`AdminInputRules.java:70-101`（NFKC、`EMPTY_NOT_ALLOWED` / `TOO_LONG` / `OUT_OF_RANGE`）、`:104-107`（`details` 形状）、`common/.../text/CodePoints.java:13-15`；`ConfigKeys.java:78-79,567-568`（默认 128、12）；测试 `AdminAuthIT.java:442-455`（旧密码错 `ADMIN_INVALID_CREDENTIALS`；太短 400 且 `ref` 为 `newPassword`；与用户名相同 400）、`:461`（改完旧令牌 401）；契约第 2344 行、第 2348 行、第 112 行 INVALID_REQUEST 行里的 `reason` 词表。
- 和前端暂定做法：一致（旧密码错 401 `ADMIN_INVALID_CREDENTIALS`；太短 400 `OUT_OF_RANGE`；按码点）。补充：“太长”是 `TOO_LONG`、“为空”是 `EMPTY_NOT_ALLOWED`；与用户名相同也是 `OUT_OF_RANGE`；码点数要在 NFKC 之后算。
- 改动请求：无
- 核实程度：已核实

### 22（系统管理）拒绝“改自己的角色或超管标志”“停用或删除自己”“最后一个启用的超管被停用、删除、清除标志”时，错误码是什么？能否给专用码？
- 答案：全部是 409 `INVALID_STATE`，`data` 为 `{"status":"<目标管理员当前状态>"}`（自己的情形下就是 `"ACTIVE"`，不能用来区分原因）。不是 403。只有 `message` 不同：
  - 改自己的角色或 `superAdmin`（值真的变了才算；带了但没变不拒绝，见 44 号）："Administrators cannot change their own roles or superAdmin"；
  - 停用或启用自己："Administrators cannot change their own status"（`status` 接口对自己的任何值都拒，包括 `ACTIVE`）；
  - 删除自己："Administrators cannot delete themselves"；
  - 最后一个启用的超管被停用、删除、清除标志："The last active super administrator must stay"；
  - 与另一个正在进行的超管变更撞车（死锁回退）："Another change to a super administrator is in progress; try again"，同样 409。
  检查顺序（契约第 2392 行逐接口写明，代码与之一致）：先“超管目标只能超管操作”403，再“目标权限码”403，再“自己”409，最后“最后一个超管”409。所以前端容易判断：目标行的 id 等于 `/me.id` 就是“自己”那条规则；其余 409 是“最后一个超管”（或撞车）。
- 依据：`AdminAccountService.java:200-205`（update）、`:239-244`（setStatus）、`:295-300`（delete）、`:344-356`（最后一个超管、撞车）、`:427-429`（`invalidState` 的 `data`）；测试 `SystemAdminIT.java:196-218`（自己改角色/停用/删除均 `INVALID_STATE`，`data.status` 为 `ACTIVE`）、`:234-266`；契约第 2392 行（“修改自己的角色或 superAdmin 409 `INVALID_STATE`”“对自己 409”“最后一个启用的超级管理员 409”）、第 150 行。
- 和前端暂定做法：不一致（前端要改：针对自己不是 403 `ADMIN_FORBIDDEN`，是 409 `INVALID_STATE`；最后一个超管本来就是 409 `INVALID_STATE`，这条一致。页面在 409 后加的固定话要按“是不是自己那一行”分两句，因为 409 本身不告诉原因）。
- 改动请求：建议做（不新增顶层错误码，只在这些 409 的 `data` 里加 `"reason"`：`SELF_PROTECTED`、`LAST_SUPER_ADMIN`、`CONCURRENT_CHANGE`，保留 `status` 字段）。理由：自己 / 最后一个超管 / 撞车三种在前端无法从响应分辨，尤其撞车和最后一个超管只有后端知道；与 17 号用同一个机制，管理端内部使用，不影响 Android、AvatarAgent；顶层错误码是共用词表，不建议新增 `ADMIN_SELF_PROTECTED`、`LAST_SUPER_ADMIN`；契约第 150 行（`data` 为 `{"status"}`）和第 2392 行要同步改。
- 核实程度：已核实

### 44（系统管理）`PUT /admins/{id}` 缺省的字段是“不改”而不是“清空”吗？`username` 要带吗？自己那一行带了 `roleIds` 或 `superAdmin` 是否一律拒绝？
- 答案：
  - `username`：必填。缺省或为空白 → 400 `INVALID_REQUEST`，`details=[{"ref":"username","reason":"EMPTY_NOT_ALLOWED"}]`。每次 `PUT` 都要带，不带不是“不改”，是报错。
  - `roleIds`：必填，整体替换。缺省（`null`）→ 400，`ref` 为 `roleIds`，`reason` 为 `EMPTY_NOT_ALLOWED`；发 `[]` 就是拿走全部角色。读不到角色列表时绝不能发 `[]`；包含不存在的角色 → 400，`ref` 为 `roleIds`，`reason` 为 `OUT_OF_RANGE`。
  - `superAdmin`：可选。缺省（`null`）= 不改；给了与当前相同的值 = 不改，不算“改”；给了不同的值 = 改（需要超管）。
  - 请求体里的 `password` 在 `PUT` 里被忽略（改密码用 `reset-password`）。
  - 自己那一行：不是“带了就拒绝”，是“值变了才拒绝”。`roleIds` 与当前角色集合相同（顺序无关）、`superAdmin` 缺省或与当前相同时，`PUT` 成功（可以改自己的用户名）；`roleIds` 集合变了或 `superAdmin` 变了 → 409 `INVALID_STATE`（见 22 号）。
- 依据：`core/.../adminuser/service/AdminAccountService.java:186-228`（`:190` 用户名必填，`:191` 与 `:363-391` 的 `existingRoles` 必填，`:196` 的 `superChanged` 对 `null` 为假，`:200-202` 自己；`:216-218` 角色全量替换）；`AdminInputRules.java:40-60`（`EMPTY_NOT_ALLOWED`）；`admin/.../controller/AdminUserAdminController.java:35,55-60`；测试 `SystemAdminIT.java:196-218`（`sameRolesRename` 自己带着相同的角色改名 200；自己带 `[]` 且原本有角色 → `INVALID_STATE`）；契约第 2392 行（只写了请求体 `{"username","password"(仅创建),"roleIds":[…],"superAdmin":false}` 和检查顺序，没有写哪些可省）。
- 和前端暂定做法：不一致（前端要改：①“不发 `username`”不行，必须发；②“只发有改动的字段”不行，`username` 和完整的 `roleIds` 必须每次都发；只有 `superAdmin` 可以省；③“自己那一行一个都不发”改为：自己那一行也必须发 `username` 和**当前**的 `roleIds`，不发会 400；`superAdmin` 省略。）
- 改动请求：无
- 核实程度：已核实

### 45（系统管理）审计日志的 `adminId`、`action`、`targetType`、`targetId` 是精确匹配吗？能否给 `action`、`targetType` 的取值清单？长度口径？
- 答案：
  - 匹配：四个都是精确匹配（SQL `=`，区分大小写，不做前缀或模糊）。`adminId` 必须是 UUID，不是 UUID → 400；`from` 含、`to` 不含，ISO-8601 时刻，格式不对 → 400，`details=[{"ref":"from"|"to","reason":"OUT_OF_RANGE"}]`。注意：空字符串**不会**被当成“不筛选”：`action=` 会被当作 `action = ''` 去精确匹配，结果为空页。前端要把空输入的参数整个不发。
  - 长度：`action`、`targetType` 超过 64、`targetId` 超过 255 → 400 `INVALID_REQUEST`，`details=[{"ref":"<参数名>","reason":"OUT_OF_RANGE"}]`；格式合法但不存在的值返回空页。这里的长度用的是 Java 字符串的 UTF-16 单位数（`String.length()`），不是码点数，与契约通则第 4 条（码点）不一致；这三个字段在库里的实际值都是 ASCII，对前端输入框没有实际影响，输入框按 64 / 64 / 255 个字符限制即可。
  - 取值清单：没有集中的常量表或枚举，也没有列出取值的接口。动作和对象类型是散在各业务代码里的常量，共 39 个文件、135 个 `audit.record(` 调用（在 `core`、`admin`、`app`、`worker` 的 `src/main` 里数），其中一部分是拼出来的（例如推送写 `<对象>_CREATE` / `_UPDATE` / `_DELETE`）。本组模块里确定的取值：`action` = `ADMIN_CREATE`、`ADMIN_UPDATE`、`ADMIN_STATUS`、`ADMIN_RESET_PASSWORD`、`ADMIN_RESET_TOTP`、`ADMIN_DELETE`、`ADMIN_PASSWORD_CHANGE`、`ROLE_CREATE`、`ROLE_UPDATE`、`ROLE_DELETE`、`PERMISSION_CREATE`、`PERMISSION_UPDATE`、`PERMISSION_DELETE`；`targetType` = `AdminUser`、`AdminRole`、`AdminPermission`。其余模块的完整清单我没有列（不在本组，也没有逐个展开拼接的常量），所以“能否给出清单”的答案是：现在不能直接给出完整清单。
  - 排序：创建时间倒序，同时间按 `id` 倒序。每行有 `adminUsername`（写入时记下的名字，可能为 `null`）。
- 依据：`admin/.../controller/AuditLogController.java:23-37`；`admin/.../facade/AuditLogFacade.java:25-30,53-78,82-87`；`core/.../shared/audit/AdminAuditLogReader.java:33-77`；`V1__schema.sql:98-112`；`AdminAccountService.java:173,227,254,272,286,306`、`AdminAuthService.java:521`、`AdminRoleService.java:125,164,194`、`PermissionTreeService.java:96,134,158`（取值）；用 `grep -rn "audit.record("` 数出写入点；契约第 2392 行（“`action`、`targetType` 超过 64 个字符或 `targetId` 超过 255 个字符返回 400 `INVALID_REQUEST`；格式合法但不存在的 `action` 返回空页”）、第 2435 行（`adminUsername`）。
- 和前端暂定做法：一致（精确匹配，自由输入）。补充：空输入不要发空字符串参数。
- 改动请求：建议做。理由：`action` 拼错时不报错、只返回空页，自由输入对运维不友好，行业里审计日志都给动作下拉；做法是后端把动作和对象类型集中成一张常量表（并加测试：每个写入点都用表里的值），再给一个只读列表接口（`AUDIT:VIEW`）；不影响其他调用方；前端在后端给出之前继续自由输入。
- 核实程度：部分核实（缺：除本组模块外的动作与对象类型取值没有逐个列出）

### 46（系统管理）只有“审计日志查看”权限、没有“管理员管理”权限的人，能否有只读的管理员名单接口（只含 `id`、`username`）？
- 答案：现在没有。`GET /admins` 整个控制器要求 `ADMIN:MANAGE`，`GET` 没有放宽；`/meta`、`/me` 也不含管理员名单。整个后端只有 `AuditLogController` 一个接口要求 `AUDIT:VIEW`。`AUDIT:VIEW` 的持有者能拿到的管理员信息是审计日志每一行里的 `adminId` 和 `adminUsername`，以及管理员相关审计行 `detail` 里目标管理员的编号（`detail.ids.adminId`）和用户名（创建、修改、删除管理员的行，`detail.changes` 里 `username` 的新旧值）。
- 依据：`admin/.../controller/AdminUserAdminController.java:25,43-46`（类级 `@RequirePermission(ADMIN_MANAGE)`，`list` 无覆盖）；`AuditLogController.java:25`（唯一使用 `AUDIT_VIEW` 的位置）；`AdminAccountService.java:171-180,220-223,304-309`（审计 `detail` 里的目标管理员编号与用户名）；`admin/.../facade/AdminMetaFacade.java:31`（`MetaResponse` 无名单）；契约第 2392 行（`/admins` 各接口 `ADMIN:MANAGE`）、第 2438 行通则第 5 条（只有 `GET /roles` 另允许 `ADMIN:MANAGE`，没有 `/admins`）。
- 和前端暂定做法：一致（输入管理员编号，没有下拉）。
- 改动请求：建议做，但不是放宽 `GET /admins`，而是新增一个只含 `id`、`username` 的小接口（`AUDIT:VIEW`，建议 `GET /audit-logs/admins`，分页或全量）。理由：筛选“谁做的”是审计查看的基本用法，现在只能手输 UUID；`GET /admins` 还含状态、最近登录时间、角色，不应该给只有审计权限的人；审计日志本来就让他们看到所有操作者的用户名，所以暴露 `id` + `username` 没有新增信息；已删除的管理员不在名单里，仍可按旧 `adminId` 手输筛选。契约通则第 5 条可以顺势加一行。
- 核实程度：已核实

### 85（系统管理）管理员用户名的长度和字符限制；创建时和重置时 400 的 `ref`；重名的 409
- 答案：
  - 用户名：先去首尾空白（契约 1.9 的空白集合），长度 1 到 64 个码点；不能含控制字符（U+0000 到 U+001F、U+007F 到 U+009F，用 `Character.isISOControl` 判）；除此之外不限字符，中间可以有空格、可以是任何文字。不做 NFKC。唯一性不区分大小写（库里是 `lower(username)` 唯一索引）。登录时同样忽略大小写。
  - 创建时（`POST /admins`）的 400 `INVALID_REQUEST`，`details` 里只有一项（第一个失败的）：`ref` 为 `username`（`EMPTY_NOT_ALLOWED` / `TOO_LONG` / `OUT_OF_RANGE`）、`password`（`EMPTY_NOT_ALLOWED` / `TOO_LONG` / `OUT_OF_RANGE`，含“太短”“与用户名相同”）、`roleIds`（缺省 `EMPTY_NOT_ALLOWED`；有不存在的角色 `OUT_OF_RANGE`）。校验顺序：用户名 → 密码 → 角色。
  - 重置密码（`POST /admins/{id}/reset-password`）：`ref` 为 `newPassword`，`reason` 同上。
  - 重名：409 `DUPLICATE_RESOURCE`（管理员用户名、角色名、权限节点码都是这个码），但 `data` 是 `null`，没有 `data.field`。契约第 151 行写的是 `data.field` 写明字段，代码对这三个对象没有做到，见“矛盾”一节。前端只能按接口推断是哪一个字段：`/admins` 是 `username`，`/roles` 是 `name`，`/permissions` 是 `code`。
- 依据：`core/.../adminuser/service/AdminInputRules.java:22,40-60,86-107`；`AdminAccountService.java:152-169`（创建顺序）、`:166-168,212-214`（重名 409，无 data）、`:262-266`（重置的 `newPassword`）、`:363-391`（`roleIds`）；`V1__schema.sql:2635`（`admin_user_username_key ON admin_user (lower(username))`）；`AdminAuthService.java:541-544`；测试 `SystemAdminIT.java:103-132`（重名 409 `DUPLICATE_RESOURCE`、短密码 `ref` 为 `password`）；契约第 2392 行、第 2437 行通则第 4 条、第 151 行。
- 和前端暂定做法：一致（按这些名字放，不认识的显示在对话框底部）。补充：重名 409 没有 `data.field`，要按接口推断。
- 改动请求：无（重名的 `data.field` 是代码没有达到契约，应由后端补，见“矛盾”）
- 核实程度：已核实

### 86（系统管理）`POST/PUT /roles` 是否整体替换？名称大小写是否敏感？名称和备注的长度上限？
- 答案：
  - 整体替换：是。`PUT` 把名称、备注、权限码全部替换（删除旧的权限码再插入新的）。`name` 必填；`permissionCodes` 必填（缺省 → 400，`ref` 为 `permissionCodes`，`EMPTY_NOT_ALLOWED`），可以是空数组；`remark` 可省，省略、`null`、全空白都存成 `null`。所以每次都发完整的三个字段是对的，`remark` 为空时发 `null` 也行。
  - 名称大小写：敏感。库里是 `UNIQUE (name)`，没有 `lower()`，`Ops` 和 `ops` 是两个不同的角色名；先去首尾空白再比较。重名 409 `DUPLICATE_RESOURCE`（`data` 为 `null`）。
  - 长度（码点）：名称 1 到 64，备注最多 500（库列也是 64 / 500）；不能含控制字符；超长 `reason` 为 `TOO_LONG`，名称为空 `EMPTY_NOT_ALLOWED`，控制字符 `OUT_OF_RANGE`；`ref` 为 `name` 或 `remark`。权限码里有不存在的 → 400，`ref` 为 `permissionCodes`，`reason` 为 `OUT_OF_RANGE`。
- 依据：`core/.../adminuser/service/AdminRoleService.java:105-133`（创建）、`:136-171`（修改，全量替换 `:159-160`）、`:201-228`（`permissionCodes` 规则）；`AdminInputRules.java:25-28,45-60`；`V1__schema.sql:2638-2645`；`admin/.../controller/RoleAdminController.java:38,46-57`；契约第 2392 行（请求体与检查顺序）、第 2437 行通则第 4 条。
- 和前端暂定做法：一致（整体替换；页面不限制长度——建议页面也按 64 / 500 码点限制，免得提交后才被拒）。
- 改动请求：无
- 核实程度：已核实

### 87（系统管理）权限节点 `POST` / `PUT` 的请求体，码的格式和长度，名称长度，排序范围
- 答案：
  - `POST /permissions`：`{code, parent, type, sortOrder, nameZh, nameEn}`。`code` 必填，**只允许** ASCII 字母、数字和 `_ : # / . -`，1 到 128 个字符，区分大小写；`type` 必填，`MENU` 或 `FUNCTION`；`parent` 可省（根），给了必须是已存在的节点；`sortOrder` 可省（默认 0），整数，没有范围检查（受 32 位整数限制）；`nameZh`、`nameEn` 必填，各 1 到 100 个码点，不能含控制字符。第一个失败的检查给 400 `INVALID_REQUEST`，`ref` 依次是 `code`、`type`、`parent`、`nameZh`、`nameEn`，`reason` 是 `OUT_OF_RANGE` / `EMPTY_NOT_ALLOWED` / `TOO_LONG`；码重复 409 `DUPLICATE_RESOURCE`（`data` 为 `null`）。
  - `PUT /permissions/{code}`：`{nameZh, nameEn, sortOrder?, parent?, type?, code?}`。`nameZh`、`nameEn` 必填；`sortOrder` 缺省 = 保持不变；`type` 缺省或等于当前类型都可以，不同 → 400 `ref` 为 `type`；`code` 缺省或等于路径里的码都可以，不同 → 400 `ref` 为 `code`。**`parent` 没有“缺省 = 不改”：缺省等于 `null`。** 对自定义节点，缺省 / `null` 会把节点移到根下；对内置节点，缺省 / `null` 与当前父节点不同（几乎所有内置节点都有父节点）就是 400 `ref` 为 `parent`。所以 `PUT` 必须总是带当前的 `parent`（根节点就带 `null`），要移动时带新值。
  - 前端“改父节点时另带 `parent`”的想法需要改：不是“另带”，是“永远带”。
- 依据：`core/.../adminuser/service/PermissionTreeService.java:42`（码的正则）、`:64-100`（创建顺序与重复）、`:103-143`（修改：`:108` `parent = input.parent()`，`:109-116` 码和类型，`:118-126` 内置与自定义的父节点处理）、`:169-183`（`parentOf`）；`AdminInputRules.java:31,45-60`；`V1__schema.sql:2659-2673`（`code varchar(128)`，名称 `varchar(100)`）；`admin/.../controller/PermissionAdminController.java:35-41`；测试 `SystemAdminIT.java:915-947`（修改内置节点时请求体里带着原 `parent`）；契约第 2363 行（类型不能改、400 `INVALID_REQUEST`、`details` 为 `[{"ref":"type","reason":"OUT_OF_RANGE"}]`，带当前类型或不带都可以）。
- 和前端暂定做法：不一致（前端要改：①“页面要求码不含空白和控制字符、至多 100 个码点”改为 `[A-Za-z0-9_:#/.-]{1,128}`；②修改请求里除了不带 `code`、`type` 外，必须总是带当前 `parent`，否则自定义节点会被移到根下、内置节点会被拒；③`nameZh`、`nameEn` 在 `PUT` 里也是必填。）
- 改动请求：无
- 核实程度：已核实

### 88（系统管理）把节点移到自己或后代下面（成环）答什么错误？成环、改内置节点的父节点答 400 时 `details` 是什么？删内置节点？
- 答案（都是 400 `INVALID_REQUEST`，`data.details` 只有一项）：
  - 把节点的 `parent` 设为它自己：`ref` 为 `parent`，`reason` 为 `OUT_OF_RANGE`，message "A node cannot be its own parent"。
  - 把节点移到它的后代下面：`ref` 为 `parent`，`reason` 为 `OUT_OF_RANGE`，message "A node cannot move under itself"。
  - `parent` 指向不存在的节点：`ref` 为 `parent`，`OUT_OF_RANGE`，"Unknown parent"。
  - 改内置节点的父节点：`ref` 为 `parent`，`OUT_OF_RANGE`，"A built-in node keeps its parent"。
  - 请求体里的 `code` 与路径不同（内置和自定义都一样）：`ref` 为 `code`，`OUT_OF_RANGE`。
  - 删除内置节点：**400 `INVALID_REQUEST`**，`ref` 为 `code`，`reason` 为 `OUT_OF_RANGE`，message "A built-in node cannot be deleted"。不是 409 `INVALID_STATE`。这与契约一致（契约第 3489 行：内置节点改 `code`、`parent` 或删除 → `INVALID_REQUEST`）。
  - 删除有子节点的自定义节点：409 `PERMISSION_HAS_CHILDREN`。
  注意：`PermissionTreeService` 类头注释还写着“409 `INVALID_STATE` 且 `data.status="BUILTIN"`”，那是过时的注释，代码和测试都是 400。
- 依据：`core/.../adminuser/service/PermissionTreeService.java:109-126`（改 code、type、内置父节点）、`:146-153`（删除内置 `:148-150` 为 400，有子节点 `:151-154` 为 409）、`:169-183`、`:186-198`（成环检查）、类头注释 `:28-34`（过时）；`AdminInputRules.java:104-107`；测试 `SystemAdminIT.java:938-956`（注释写明 “Contract 20 (L3353): INVALID_REQUEST (task Z1D fix; X1 had answered 409 INVALID_STATE)”；移动、改码、删除内置节点都断言 400 `INVALID_REQUEST`）、`:998-1003`（移到子节点下 400，有子节点 409 `PERMISSION_HAS_CHILDREN`）；契约第 3489 行、第 2363 行、第 124 行。
- 和前端暂定做法：不一致（前端要改：“删内置节点现在是 409 `INVALID_STATE`”不对，后端实际就是契约的 400 `INVALID_REQUEST`，`ref` 为 `code`，前端的模拟服务按契约做即可；成环 400 且 `ref` 为 `parent`、改内置父节点 400 这两条一致）。
- 改动请求：无
- 核实程度：已核实

---

## 对照复查

### 复查 3（登录与权限）`GET /api/admin/permissions` 的响应形状和节点字段
- 新版接口文档写法是否变了：没有变，且内部自相矛盾仍在。第 2363 行（17.3）写 `GET /permissions`（`[{code,parent,type,sortOrder,nameZh,nameEn,builtin}]`，裸数组）；第 2434 行（17.4 通则第 1 条）写不分页的接口只有 `items`；第 2914 行实体表 `AdminPermission` 含 `createdBy`、`createdAt`、`updatedAt`；第 2435 行写 `AdminPermission.createdBy` 旁边另给 `createdByUsername`。
- 代码是否这样做：是通则的写法。响应 `data` 是 `{"items":[…]}`，没有 `total`；每项恰好 11 个字段：`code`、`parent`、`type`、`sortOrder`、`nameZh`、`nameEn`、`builtin`、`createdBy`、`createdByUsername`、`createdAt`、`updatedAt`（`parent` 为根时是 `null`；`createdBy` 为 `null` 的内置节点其 `createdByUsername` 也是 `null`；创建者已被删除时 `createdBy` 保留、`createdByUsername` 为 `null`）。排序：代码是 `ORDER BY parent NULLS FIRST, sort_order, code`（先根节点，再按父节点编码字符串、排序号、编码），不是通则默认的创建时间倒序；契约对这个接口没有写排序，前端自己按 `sortOrder` 排是对的。字段断言在测试里是“恰好这 11 个”。依据：`admin/.../facade/SystemAdminFacade.java:65-76,162-183`；`PermissionTreeService.java:58-61`；测试 `SystemAdminIT.java:918-930,1024-1049`；契约上述行。
- 结论：仍然正确。需要补充更正两点：① 字段是 11 个，不是 8 个加 `createdByUsername`（多了 `createdAt`、`updatedAt`，契约实体表第 2914 行里有这两列，所以不算违约）；② 排序实际是“根在前，再按父节点编码、`sortOrder`、编码”，不是创建时间倒序，前端不要依赖返回顺序。
- 核实程度：已核实

### 复查 4（系统管理）审计日志按管理员编号筛选：管理员被改名或删除后还能筛到他以前的行吗
- 新版接口文档写法是否变了：行号变了，意思没变。现在是第 2435 行（17.4 通则第 2 条的“`AdminAuditLog` 例外”：`adminUsername` 写入时记下，之后管理员改名或被删都不改已写的行，审计行不会随 `DELETE /admins` 删除）和第 2915 行（实体表：`adminId, adminUsername(可空…)`）。
- 代码是否这样做：是。`admin_audit_log` 没有指向 `admin_user` 的外键；`DELETE /admins/{id}` 只删 `admin_user_role` 和 `admin_user` 两个表的行；改名只更新 `admin_user.username`；写入审计行时把当时的用户名存进 `admin_username` 列，之后没有任何更新语句；筛选 `adminId` 是 `admin_id = ?`，所以删除或改名后仍能筛到他以前的行，行里 `adminId` 不变，`adminUsername` 是当时的名字。依据：`V1__schema.sql:98-112`（无外键，`admin_username` 列）；`AdminAccountService.java:301-302,207-211`；`core/.../shared/audit/AdminAuditLogService.java:44-63`；`AdminAuditLogReader.java:44-47`；测试 `SystemAdminIT.java:435-460`（删除后审计行仍在、`admin_username` 仍是原名）、`:462-495`（改名后早先的行不变，一个管理员的两条审计行名字分别是旧名和新名）。
- 结论：仍然正确。
- 核实程度：已核实

---

## 我发现的、问题表没问到但前端会踩到的坑

1. 权限节点码里带 `/` 的节点，`PUT` / `DELETE /permissions/{code}` 很可能调不通（推断，没有运行验证）。内置的页面节点码大量带 `/`（例如 `MENU:/system/audit`，见 `BuiltinPermissionTree.java:196`），自定义节点的码也允许 `/` 和 `#`（`PermissionTreeService.java:42`）；而路由是单段路径 `@PutMapping("/{code}")`、`@DeleteMapping("/{code}")`（`PermissionAdminController.java:55,62`）；我在全仓库搜了 `encoded slash`、`StrictHttpFirewall`、`HttpFirewall`、`ALLOW_ENCODED`、`{code:`：没有任何自定义配置。未编码的 `/` 会让路由不匹配（404），编码成 `%2F` 通常会被 Tomcat 或 Spring Security 的防火墙当作非法路径拒绝（400）。现有测试用的码都不带 `/`（`SystemAdminIT.java:915,983`），没覆盖这种情况。前端如要“重命名内置菜单节点”，这是真实风险，需要后端先确认或修（改成请求体里带码，或放开路径匹配）。
2. 同一类事：`PUT /permissions/{code}` 不带 `parent` 会把自定义节点移到根下（见 87 号）。
3. `PUT /admins/{id}` 必须带 `username` 和完整 `roleIds`（见 44 号）；发空数组会拿走全部角色。
4. 审计日志筛选里，空字符串参数会被当作精确匹配 `''`，返回空页（见 45 号）；`AdminAuditLogReader.java:44-58`、`AuditLogController.java:27-36` 没有把空白转成“不筛选”。
5. 重名 409 `DUPLICATE_RESOURCE` 在管理员、角色、权限节点三处都没有 `data.field`（`AdminAccountService.java:167,213`、`AdminRoleService.java:119,157`、`PermissionTreeService.java:92`），契约第 151 行写的是有；前端不能依赖 `data.field`。
6. 并发移动权限节点可能造成环（推断，没有运行验证）：`PermissionTreeService.update` 只对被移动的那个节点加行锁（`:163-167`），查祖先链的 `requireNotUnderItself`（`:186-198`）不加锁，两个请求同时把 A 挪到 B 下、把 B 挪到 A 下，可能都通过检查而成环。成环后，前端按 `parent` 建树时会找不到根或死循环，建树代码要对环有防御（访问过的节点不再进入）。
7. 管理员的 `PUT /admins/{id}` 对非超管操作者还会检查“目标的角色权限码是否都被操作者持有”（403，见 1 号），隐藏按钮不能只看目标是不是超管；用 `/me.permissions` 与目标行的角色权限码（需要 `GET /roles` 的 `permissionCodes`）比较才能提前隐藏。
8. 登录接口在 `admin.totp_required=true`（默认）时，未绑定的管理员第一次登录返回的是 200 `{"status":"ENROLL_REQUIRED","enrollToken","otpauthUri"}`，不是令牌；响应的 `data` 里没有 `token` 键，前端要按 `status` 字段分支（`admin/.../facade/AdminAuthFacade.java:34-44`，契约第 2351 行）。

## 后端代码与接口文档互相矛盾的地方（汇总）

- 10：管理员二次验证锁定的 429 带 `data.retryAfterSeconds` 和 `Retry-After` 头（`AdminAuthService.java:412-419`，测试 `AdminAuthIT.java:281-284` 断言了），而契约第 111 行只把用户登录锁定、用量接口、导出最小间隔列为带这个字段，并写“其他限流的 429 没有 `data`，也不带 `Retry-After`”；`ApiException.java` 的类注释也写“登录锁定不带 `Retry-After`”（指用户登录）。需要在契约第 111 行补上“管理员二次验证锁定”，或者改代码。
- 85（及 86、87）：管理员用户名 / 角色名 / 权限码重复的 409 `DUPLICATE_RESOURCE` 没有 `data.field`，契约第 151 行写明有。
- 复查 3：契约第 2363 行写 `GET /permissions` 返回裸数组 `[…]`，第 2434 行通则写 `{"items":[…]}`；代码按通则。
- 45：审计日志筛选参数的长度用 UTF-16 单位数（`AuditLogFacade.java:82-83`，`requireLength`），契约通则第 4 条写按码点计（第 2392 行写的是“个字符”）；对实际取值（ASCII）无影响。
- 88（代码内部）：`PermissionTreeService.java:28-34` 的类注释仍写内置节点违规答 409 `INVALID_STATE`，实际代码（`:109-126,148-150`）和契约都是 400 `INVALID_REQUEST`；只是过时注释，不影响行为。
- 4：契约第 2357 行令牌失效的列表没有写“删除管理员”，而代码里删除后令牌同样 401 `ADMIN_INVALID_TOKEN`；不矛盾，是文字没写全。

---

# 第 B 部分：stats-analytics-sessions

共 17 条：已核实 15 条，部分核实 2 条，未核实 0 条；前端要改 3 条；改动请求 2 条（建议做 0、建议不做 2）；接口文档新版已写明 11 条（含 2 条对照复查行）。
已按独立核对结果更正：更正 1 处，行号 2 处。

# 回答：问题组 B-stats-analytics-sessions（统计报表、埋点管理、通话）

路径缩写（读者照此补全）：
- `ADM` = `D:\Projects\PycharmProjects\AvatarBackend\admin\src\main\java\com\avatarapp\backend\admin`
- `CORE` = `D:\Projects\PycharmProjects\AvatarBackend\core\src\main\java\com\avatarapp\backend\core`
- `TEST` = `D:\Projects\PycharmProjects\AvatarBackend\admin\src\test\java\com\avatarapp\backend\admin`
- `SQL` = `D:\Projects\PycharmProjects\AvatarBackend\core\src\main\resources\db\migration\V1__schema.sql`
- `DOC` = `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md`（读到的版本是 AvatarApp 提交 e07469d1，用 git 查过）。DOC 的行号全部是新版行号，和问题表里的旧行号（2301、2351、2663 等）对不上，不要拿旧行号去找。

核实方式：只读源码和测试，没有运行任何东西。"测试"指我读了测试代码里断言了什么，没有跑。

---

### 3（通话）`GET /sessions/{id}` 的游客设备标识是否同样只返回前 8 位
- 答案：是。详情接口返回的 `deviceId` 只在"账号编号为空"（游客会话）时才有值，并且是前 8 个字符；账号会话的 `deviceId` 是 `null`。完整值不会出现在响应里。列表接口（`GET /sessions`）用的是同一个取前 8 位的方法，所以详情和列表一致。顺带：库里这一列本来就是 64 位十六进制的 SHA-256 哈希（不是设备原始编号），取前 8 位是在哈希上再截短。
- 依据：`ADM/facade/SessionAdminFacade.java:99`（详情：账号为空才取 `PersonalDataMask.hashPrefix`，否则 `null`）；`CORE/facade/UserAdminFacade.java:374`（列表同样）；`common/src/main/java/com/avatarapp/backend/common/text/PersonalDataMask.java:20,93-98`（前 8 个字符，不足 8 位则原样）；`SQL:846,871`（`device_id` 是 64 位十六进制）。DOC:2384（"`deviceId` 只显示前 8 位，账号会话为 null"）。
- 和前端暂定做法：一致（前端自己再取前 8 位也没有害处，后端本来就只给 8 位；前端不需要处理完整哈希）。
- 改动请求：无
- 核实程度：已核实

### 24（统计报表）`/stats/daily` 范围内某天没有汇总行（含当天还没汇总）时，是不返回这一行，还是返回 0/`null` 行
- 答案：分三种情况，逐个说：
  1. 这一天在两张日汇总表里都没有行：整行不返回（不补空行）。接口文档明写"没有落地的日子不出现，不补空行"。
  2. 这一天只有部分行：返回这一天，缺的那一块各列是 `null`（JSON 里键存在，值为 `null`，不是 0）。具体：`platform=ALL` 时，如果这天只有"业务行"没有"事件行"（比如这天没有任何客户端事件），则 `dau`、`dauDevices`、`wau`、`mau`、`avatarCreatedAccounts`、`voiceClonedAccounts`、`sessionStartedAccounts` 七列是 `null`；如果只有事件行没有业务行，则 `newAccountsRegistered` 等十三个业务列是 `null`。`platform` 不是 `ALL` 时，业务十三列、`activeSubscriptions`、`activeSubscriptionsBackfilled` 一律是 `null`（`channel` 不是 `ALL` 时 `activeSubscriptions` 也是 `null`）。
  3. 当天（UTC 今天）：不是"还没汇总"。后台任务每 `stats.land_interval_minutes`（默认 15 分钟）重算一次当天，所以当天的行在当天第一轮落地之后就存在，数值是临时的，次日起固定（接口文档 2809 明写"当天的行是临时值，次日起固定"）。当天第一轮落地之前整行不存在。当天的 `activeSubscriptions` 恒为 `null`（日末快照，当天没结束）。
  还要注意：`platform=ALL` 的业务行在落地时对每个落地日一定会写一行 `ALL` 渠道（各列最小是 0，不是 `null`），所以一个落地过的日子在 `platform=ALL&channel=ALL` 下基本总会出现；但事件列在"当天没有任何客户端事件"时是 `null` 不是 0——前端显示"—"比显示 0 更接近事实（"没有事件行"和"这天确实 0 活跃"在库里无法区分）。
- 依据：`CORE/stats/service/StatQueryService.java:168-212`（日期集合是事件行日期与业务行日期的并集，缺的一块用 `new Long[7]` / `new Long[13]` 全 `null`；快照只在 `day.isBefore(today)` 且 `platform=ALL&channel=ALL` 时取，行 181-183、208-209）；`CORE/stats/repository/StatReportRepository.java:54-98,103-116`（取不到的列读成 `null`，`nullableLong`）；`CORE/stats/service/DailyBusinessLander.java:116-117,124`（`ALL` 渠道总是进入渠道集合）和 `CORE/stats/service/DailyEventLander.java:85-93`（只有出现过事件的平台与渠道才有行）；`worker/src/main/java/com/avatarapp/backend/worker/job/StatLandJob.java:69-86` 和 `CORE/stats/service/StatLandService.java:148-151`（当天按间隔重算）；`SQL:3179-3196`（业务列允许 `NULL`）；测试 `TEST/StatsAdminIT.java:236-295`（断言 `newAccountsRegistered` 为 `null`、当天 `activeSubscriptions` 为 `null`、其他平台业务列为 `null`）。DOC:2815（"只返回已经落地的日子……不补空行"）、2819（`/stats/daily` 行）、2809（当天是临时值）。
- 和前端暂定做法：一致（"没有行当作不知道；趋势图补 0"）。补充两点前端要知道：(a) 有行时的 `null` 也要按"不知道"处理，不能当 0；(b) 当天的行是临时值，卡片上最好标注"今日数据未结束"。
- 改动请求：无
- 核实程度：已核实

### 25（统计报表）`/stats/retention`、`/reactivation`、`/guest/daily`、`/guest/cohort`、`/guest/retention` 范围内某天没有汇总行时，返回还是补行
- 答案：五个接口都只返回库里已有的行，不补行，也不会返回"人数 0、各格 `null`"的占位行。各接口的细节：
  - `/stats/retention`：行的键是（cohort 日期、类型 ACTIVE/CALL、平台、渠道）。某天没有人注册，这一天的 cohort 不会有任何行（后端只给"确实有账号"的平台和渠道组合写行，没有账号的组合不写）。所以"没有行"可能是"那天没人注册"，也可能是"还没落地"，后端从返回值上区分不了。前端不补 0 是对的。
  - `/stats/reactivation`：落地时一次写 7、14、30 三个沉默天数的三行（即使 `silentUsers` 是 0 也写），查询只返回你传的 `silenceDays`（默认 7）那一行；`silentUsers`、`reactivated` 是不可空的数。已落地的日子一定有行，没有行就是没落地（或事件已过期被保护而没重算）。
  - `/stats/guest/daily`：每个落地过业务行 `ALL` 渠道的日子一行，`guestDevicesNew`、`guestDevicesConverted` 通常是数（可以是 0），极端情况下（游客设备已被清理而没有落地过）可能是 `null`。
  - `/stats/guest/cohort`：某天没有任何游客设备，这个 cohort 不写行。
  - `/stats/guest/retention`：同账号留存，没有设备的平台/渠道组合不写行。
  - 行内的 `null` 只表示"这一格还没到期、还没写"，不是 0（见 51）。
- 依据：`CORE/stats/repository/StatReportRepository.java:122-207`（五个查询都只 `SELECT` 已有行，`ORDER BY` 日期）；`CORE/stats/service/RetentionLander.java:85-91,95-101`（只对 `accountCohort` 查到的组合写行）；`CORE/stats/service/ReactivationLander.java:65-83`（三个沉默天数一次写三行）；`CORE/stats/service/GuestCohortLander.java:17,55`（"A cohort without devices gets no row"，`counts[0] == 0` 就跳过）；`CORE/stats/service/GuestRetentionLander.java:68,79`；`CORE/stats/api/StatReportRows.java:82`（`ReactivationItem` 是基本类型 `long`）。DOC:2815（不补空行）、2772-2775（到期之前为空）。
- 和前端暂定做法：一致（"只显示后端返回的行，不补行"）。回流图补满日期时，补出来的天要画成"无数据"而不是 0，因为没有行 = 没落地。
- 改动请求：无
- 核实程度：已核实

### 26（埋点管理）`GET /analytics/events` 的参数名、`from`/`to` 格式、排序、响应里的事件名字段与行标识、平台与版本从哪读
- 答案：
  - 参数名：`accountId`、`deviceId`、`name`（不是 `eventName`）、`from`、`to`，另有分页 `page`、`pageSize`（默认 1 和 20，最大 200，超出是 400 不会被截断）。
  - `from`、`to`：必填，ISO-8601 时刻（例如 `2026-10-01T00:00:00Z`），不是 `YYYY-MM-DD`。区间是 `[from, to)`（含 `from`、不含 `to`），按 `receivedAt` 过滤。`from` 必须早于 `to`，跨度不超过 `analytics.live_max_range_days`（默认 31 天）。详见 56。
  - 排序：按 `receivedAt` 倒序（新的在前）；`receivedAt` 相同的行顺序由库的索引决定，每行带 `seq`，同一批里 `seq` 大的在前。
  - 响应每项的字段（整套）：`id`（字符串，是库里文档编号的 24 位十六进制）、`accountId`、`deviceId`、`name`（事件名叫 `name`，不是 `eventName`）、`source`（`CLIENT`/`SERVER`）、`params`（对象）、`context`（对象）、`clientTime`、`receivedAt`、`seq`、`ip`、`country`。所以有稳定的行标识 `id`，旧版契约"没有 `id`"已不成立，可以当列表的行键。
  - 平台和版本：事件行没有单独的 `platform`、`appVersion` 列，只能从 `context` 里读：`context.platform`、`context.appVersion`、`context.osVersion`（必有，来自客户端上报）以及 `deviceModel`、`locale`、`network`、`channel`（可能为 `null`）。注意 `source=SERVER`（后端自己写的事件）的 `context`、`clientTime`、`ip`、`country`、`deviceId` 都是 `null`，这种行的平台和版本列要显示空。
  - `ip` 默认是掩码的（`203.0.113.*`），持有 `ANALYTICS:IP_VIEW` 才返回完整 IP。
  - 同一个接口族里，`event-summary` 和 `funnel` 的每行事件名字段叫 `eventName`（`event-names` 返回的是字符串数组）。只有 `events` 的行用 `name`。
  - 事件名参数 `name` 必须符合 `[a-z0-9_]{1,64}`，否则 400（`ref=name`，`reason=INVALID_FORMAT`）。
- 依据：`ADM/controller/AnalyticsAdminController.java:50-66`（参数名与 `AdminPageQuery`）；`CORE/facade/AnalyticsFacade.java:69-81`（`EventItem` 字段）、`170-186`、`337-360`（范围规则）、`92`（`SummaryItem.eventName`）、`103`（`FunnelStepItem.eventName`）；`CORE/event/service/EventQueryService.java:162`（`Sorts.descending(receivedAt)`）、`234`（`id` 取 ObjectId 的十六进制）、`231-246`；`CORE/event/service/EventIntakeService.java:70-71,158-181`（`context` 的键）；`CORE/event/service/MongoServerEventRecorder.java:74`（后端事件 `context` 为 `null`）；`CORE/event/service/EventCatalog.java:23,118`；测试 `TEST/AnalyticsAdminIT.java:130-145`（断言字段含 `id`、`name`、`receivedAt`）。DOC:2382（"每项 `id, accountId, deviceId, name, source, params, context, clientTime, receivedAt, seq, ip, country`，`receivedAt` 新的在前"）、2888（EventLog 实体）。
- 和前端暂定做法：不一致（前端要改：①读 `name`，不要读 `eventName`；筛选参数也叫 `name`，不是 `eventName`；②可以读 `id`，后端有；③`from`/`to` 要发完整 ISO 时刻，不能发 `YYYY-MM-DD`——见 56；④平台、版本从 `context.platform`、`context.appVersion` 读，SERVER 来源的行允许为空）。
- 改动请求：无
- 核实程度：已核实

### 48（统计报表）`stats.max_range_days` 的"跨度"是含两端的天数还是两端日期之差
- 答案：含两端的天数。代码先算 `days = (to − from 的天数差) + 1`，只有 `days > stats.max_range_days` 才拒绝。例：上限 31，10 月 1 日到 10 月 31 日是 31 天，通过；10 月 1 日到 11 月 1 日是 32 天，拒绝。默认上限 366（所以 365 天差、即含两端 366 天可以，367 天不行）。拒绝时是 400 `INVALID_REQUEST`，`data.details[0].ref = "to"`，`reason = "OUT_OF_RANGE"`，`message` 是 "The range exceeds stats.max_range_days"。`from` 晚于 `to` 时 `ref = "from"`。这条规则同一个类在统计之外的几个报表（额度、邀请、审核、广告）里也用，但本回答只核对了 `/stats/*` 的调用点。
- 依据：`CORE/shared/time/StatsRange.java:59-62`（`ChronoUnit.DAYS.between(...) + 1`，`> maxDays` 拒绝）；`CORE/stats/service/StatQueryService.java:87-99`（调用点）；`CORE/shared/config/ConfigKeys.java:558-559` 与 `ConfigKeyTypes.java:554`（默认 366）；佐证测试 `TEST/CreditStatsAdminIT.java:152-160`（额度统计接口 366 天通过、367 天拒绝）。DOC:2694（默认 366）、2815（"跨度不超过 `stats.max_range_days`"；文档没写明是否含两端，以代码为准）。
- 和前端暂定做法：一致
- 改动请求：无
- 核实程度：已核实

### 49（统计报表）`POST /stats/land/retention` 是否一次补两种留存、所有平台和渠道；`reactivation` 是否三个沉默天数都重算
- 答案：
  - `retention`：一次调用会把"活跃留存"（ACTIVE）和"通话留存"（CALL）两种都重算，覆盖每一个有账号的（平台、渠道）组合以及对应的 `ALL` 汇总行。例外（调用仍返回 200）：日期早于事件日志里现存最早事件时，ACTIVE 的格子保留已落地的值、只重算 CALL；日期早于聊天记录的保留线（每日清理可能已删掉当天的会话行）时，CALL 的格子也保留已落地的值。
  - 但要注意 `date` 的含义是"检查日"，一次调用不是"重算一行 cohort"：对检查日 D，它写 D 这天的 cohort 人数，并把 D−1、D−3、D−5、D−7、D−14、D−21、D−30、D−60、D−90 这九个 cohort 各自对应的那一个格子（`d1`、`d3`……`d90`）补上，其他格子不动。所以要补齐某一个 cohort 行的全部格子，需要用九个不同的检查日各调一次（加上 cohort 当天本身一次）。补数按钮的日期选择器应该按"检查日"来写提示，不是"cohort 日期"。
  - `reactivation`：一次调用会把 7、14、30 三个沉默天数的三行一起重算（先删后插这一天的三行）。来源事件已过期的日期会被拒绝（400，`ref = "date"`，`data.details[0].reason = "SOURCE_EXPIRED"`），判断规则见下面"事件过期的判断"。
  - 手动补数共用一把全局锁：拿不到锁时立刻 409 `INVALID_STATE`，`data.status = "LANDING_IN_PROGRESS"`，不会排队。成功返回 `{name, date}`。
  - 游客侧是另外两个名字：`guest-retention`（游客留存）、`guest-cohort`（游客转注册）；`/stats/guest/daily` 的数据来自 `daily-business`；账号日报来自 `daily-event` 和 `daily-business`。
  - 事件过期的判断（四个"全部来自事件日志"的名字 `daily-event`、`share-channel`、`guest-retention`、`reactivation` 会做这个检查，过期则 400 `SOURCE_EXPIRED`，`ref = "date"`，提示文字是"来源事件已过期，已落地的值保留"）：`guest-retention`、`share-channel` 只看补数日期本身是否早于现存最早事件所在的 UTC 日。`daily-event` 和 `reactivation` 还要看读取窗口的起点：它们分别向前读 29 天和 30 天（`DailyEventLander.LOOKBACK_DAYS = 29`、`ReactivationLander.LOOKBACK_DAYS = 30`）。判定顺序：①日期早于最早事件日 → 过期；②窗口起点（日期减 29 或 30 天）不早于最早事件日 → 不过期；③窗口起点早于最早事件日时：日期在定时任务窗口（`stats.land_window_days`，默认 3 天）之外 → 过期；日期在任务窗口之内 → 只有窗口起点不早于"曾见到的最早事件日"才算过期（早于它说明那些事件从来没存在过，局部窗口就是真值，不算过期）。所以对 `reactivation`，日期在最早事件日之后、但不满 30 天时，仍可能被拒绝（`daily-event` 同理，差在 29 天）；补数按钮的"可补日期"不能只按事件保留期提示，页面要把这个 400 当正常业务提示显示，不要预先判断。`retention` 不在这四个名字里：它自己只看日期本身（见上面 `retention` 的例外，调用仍是 200）。
- 依据：`CORE/stats/service/RetentionLander.java:17-29,60-124`（类型 62-73；九个 N 的格子 93-115；日期含义见类注释 17-22）；`CORE/stats/service/ReactivationLander.java:60-83`（`SILENCE_DAYS` 三个值、`summary.replace` 一次写三行）；`CORE/stats/service/StatLandService.java:42-44`（回看天数表）、`107-124`（检查顺序与 `SOURCE_EXPIRED`，115-121）；`CORE/stats/service/StatProtection.java:74-94`（`eventWindowExpired` 的判断）、`109-117`（任务窗口界限）；`CORE/stats/service/DailyEventLander.java:34`、`CORE/stats/service/ReactivationLander.java:34`（回看天数 29、30）；`CORE/stats/api/StatLandNames.java:9-26,50-51`；`ADM/facade/StatsAdminFacade.java:228-249`（锁与 409）。DOC:2834（`retention` 的 `date` 是检查日，填各个 N 的格子，不是整行重算）、2759（补数共用全局锁、409、成功返回值、`cohortSize` 的写入规则）。
- 和前端暂定做法：一致（"按都补处理"）。补充：补数按钮对 `retention` 要写成"按检查日补"，不是"补这一天的 cohort"；对 `reactivation`、`daily-event` 最早的约 30 天、29 天也可能被拒绝，页面要把 400 `SOURCE_EXPIRED` 当正常提示显示，不要只按事件保留期预判。
- 改动请求：无
- 核实程度：已核实

### 50（统计报表）`activeSubscriptionsBackfilled` 在没有快照的日子是 `null` 还是 `false`
- 答案：`null`。`activeSubscriptions` 和 `activeSubscriptionsBackfilled` 总是同时有值或同时是 `null`：有值的条件是 `platform=ALL`、`channel=ALL`、这一天早于今天（UTC）并且库里有这一天的快照行；其他情况（没有快照、当天、`platform` 不是 `ALL`、`channel` 不是 `ALL`）两个都是 `null`。有快照时 `activeSubscriptionsBackfilled` 是 `true` 或 `false`（库里该列不可空），`true` 表示这一行是手动补数用当前状态近似写入的。
- 依据：`CORE/stats/service/StatQueryService.java:183,208-209`（`s == null ? null : s.backfilled()`）；`CORE/stats/api/StatReportRows.java:47-48`（类型是 `Long`、`Boolean`）；`SQL:3198-3204`（`backfilled boolean NOT NULL`）；测试 `TEST/StatsAdminIT.java:262-276`（有快照 `true`，当天与其他平台 `activeSubscriptions` 为 `null`）。DOC:2797（快照规则与"回填值"标注）、2819。
- 和前端暂定做法：一致（"只在值是数字且标志为 true 时标回填"）
- 改动请求：无
- 核实程度：已核实

### 51（统计报表）今天汇总之后、今天结束之前，昨天那批新用户的 `d1`（今天落地的格子）算不算临时值
- 答案：算，而且要小心：这个格子在当天不是 `null`，也可能是 0。道理：对检查日 D 的落地，会把 cohort D−1 的 `d1` 写成"D 这天已经出现的人数"。当天按 `stats.land_interval_minutes`（默认 15 分钟）重算，所以当天第一轮落地之后这一格就有值了，早上很早可能写出 0，之后随一天过去逐步增大，要等次日 00:10（UTC）的窗口轮次才写成最终值。也就是说：
  - `dN` 为 `null` = 这个 cohort 日期 + N 天还在未来（没到期，没值）；
  - cohort 日期 + N 天 == 今天（UTC）时，格子是非 `null` 但属于临时值，哪怕是 0 也不能读成"一个也没回来"；
  - 过了今天之后固定。
  同理，cohort 日期 == 今天时，`cohortSize` 也是临时值（当天还会有人注册）。你们暂定的"日期加一天等于今天的那批标临时值"对 `d1` 成立，对其他 N 同样成立（日期加 N 天等于今天）；ACTIVE 和 CALL 两种类型、账号留存和游客留存（`/guest/retention`）规则相同。
- 依据：`CORE/stats/service/RetentionLander.java:17-22,93-115`（检查日 D 填 cohort D−N 的 `dN`，没有命中人数时写 0：行 100、`zeroWhere` 105-106）；`CORE/stats/service/StatLandService.java:148-151,153-175`（当天按间隔落地，次日 00:10 窗口轮次重落 D−1…）；`worker/src/main/java/com/avatarapp/backend/worker/job/StatLandJob.java:69-86`；`CORE/stats/service/GuestRetentionLander.java:75-91`（游客同理）。DOC:2772-2775（"到期之前为空"）、2809（"当天的行是临时值，次日起固定"）、2799（第 N 天是当天这一点）。
- 和前端暂定做法：一致（"`null` 才算没有值；日期加一天等于今天的那批标临时值"）。补充：规则不止 `d1`，所有 `dN` 都是"cohort 日期 + N 天 == 今天"时为临时值。
- 改动请求：无
- 核实程度：已核实

### 52（统计报表）`/stats/guest/retention?platform=unknown` 能否像日报一样查询
- 答案：请求不会报错（`unknown`，不分大小写，被接受并按小写 `unknown` 去查），但永远查不到行。原因：游客留存的平台取自游客设备表的 `platform` 列，这一列在库里被约束为只能是 `ANDROID` 或 `IOS`（不允许空和其他值），所以 `stat_guest_retention` 里不会出现 `unknown` 平台的行；`ALL` 行是 `ANDROID` 与 `IOS` 的和，已经含全部游客设备。"平台缺失的设备"对游客不存在，不需要这个选项。相对地，账号留存 `/stats/retention?platform=unknown` 是有数据的（取注册时的 `registerPlatform`，缺失归 `unknown`），`/stats/daily?platform=unknown` 也有。游客侧的渠道 `channel=unknown` 有数据（设备没有渠道码时归 `unknown`）。
- 依据：`SQL:326-343`（`guest_device.platform ... CHECK IN ('ANDROID','IOS')`，行 338）；`CORE/stats/service/StatQueryService.java:101-112,234-236`（`platform()` 接受 `UNKNOWN`，游客留存也走这个方法）；`CORE/stats/repository/StatSourceRepository.java:257-267`（游客 cohort 按设备 `platform` 分组）；`CORE/stats/service/GuestRetentionLander.java:68,79`。DOC:2755（三张带平台的表里，`StatGuestRetention` 的平台取 `GuestDevice.platform`）。
- 和前端暂定做法：一致（只提供 `ALL`、`ANDROID`、`IOS`）。
- 改动请求：建议不做（游客设备的平台在入库时必为 `ANDROID` 或 `IOS`，加这个选项永远是空表）
- 核实程度：已核实

### 53（统计报表）`/stats/daily`、`/retention`、`/reactivation`、`/guest/*` 返回的 `items` 是否保证按日期升序
- 答案：是，升序（旧的在前）。逐个核实：`/daily` 用日期有序集合逐日输出；`/retention`、`/guest/retention`、`/reactivation`、`/guest/cohort` 的 SQL 都带 `ORDER BY cohort_date`（或 `stat_date`）；`/guest/daily` 来自按日期排序的映射。因为每个接口的筛选维度已经固定（类型、平台、渠道、沉默天数各取一个值），每个日期只有一行，所以日期升序就是完整的顺序。
- 依据：`CORE/stats/service/StatQueryService.java:177-181`（`TreeSet`）、`222-228`；`CORE/stats/repository/StatReportRepository.java:54-56,77-79`（`TreeMap`）、`126,153,177,192`（`ORDER BY`）。DOC:2815（"按日期升序"，另注明 `/stats/push` 同日按 `triggerReason`）。
- 和前端暂定做法：一致（"按收到的顺序显示，模拟服务按升序返回"）
- 改动请求：无
- 核实程度：已核实

### 54（通话）`GET /sessions` 的筛选参数名、时间格式、"进行中"参数名、非法值是否 400
- 答案（逐小问）：
  - 账号编号参数：叫 `accountId`，必须是 UUID，否则 400（`ref=accountId`，`reason=INVALID_FORMAT`）。
  - 时间范围：参数名 `from`、`to`，作用于 `requestedAt`；格式是 ISO-8601 时刻（如 `2026-10-01T00:00:00Z`，用 Java 的 `Instant.parse` 解析，建议带 `Z`；带 `+08:00` 之类偏移我没有测，别发），不是 `YYYY-MM-DD`。`from` 含、`to` 不含（`requested_at >= from AND requested_at < to`）。两个都可以单独传，也可以不传；后端不检查 `from` 早于 `to`（反过来传只是查不到），也没有最大跨度限制。格式不对 400（`ref=from` 或 `to`，`reason=INVALID_FORMAT`）。
  - "是否进行中"：参数名是 `inProgress`（不是 `ongoing`）。`true` = 没有结束时间（`endedAt` 为空），`false` = 有结束时间。只认小写 `true`、`false`，其他（`1`、`yes`、`TRUE`）400（`reason=OUT_OF_RANGE`）。
  - 游客：`guest=true` 查账号编号为空的会话，`guest=false` 查有账号编号的；规则同上。
  - 结束原因：`endReason`，取值是 `DEADLINE`、`USER_LEFT`、`ROOM_FINISHED`、`BANNED`、`SUPERSEDED` 之一（"被到点强制结束"就是 `endReason=DEADLINE`），不认识的值 400（`ref=endReason`，`reason=OUT_OF_RANGE`）。
  - 空字符串（`?inProgress=`）被当作没传；后端不认识的参数名（例如 `ongoing`）被静默忽略，不会报错也不会过滤，这是我在控制器里只看到上述 6 个参数声明、并搜 `getParameterMap`/`getParameterNames` 在 admin、common、app、core 的主代码里只命中一个请求体大小过滤器（没有拒绝未知参数的代码）后做的判断，没有跑请求验证。
  - 排序与分页：按 `requestedAt` 倒序（再按 `id` 倒序）；分页参数 `page`、`pageSize`，响应是 `{items, total}`。每行字段：`id`、`accountId`、`deviceId`（游客才有，前 8 位）、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`。
- 依据：`ADM/controller/SessionAdminController.java:36-46`（参数声明）；`ADM/facade/SessionAdminFacade.java:121-182`（解析与 400）；`CORE/session/repository/SessionAdminRepository.java:63-72,86,103-128`（过滤条件、排序）；`CORE/session/api/SessionEndReason.java`；`CORE/facade/UserAdminFacade.java:181-190`；测试 `TEST/AdminRecordsIT.java:367-374`（`inProgress=true/false`、非法值 `guest=yes`、`endReason=TIMEOUT`、`accountId=x`、`from=today`、`inProgress=1` 都应 400）。DOC:2384（参数名、含不含、400、排序全部写明）。
- 和前端暂定做法：做法一致（只发有值的参数），但名字和格式要对：不一致处——前端要改：①"进行中"参数用 `inProgress`；②`from`/`to` 发 ISO 时刻，不是日期；③`guest` 只发小写 `true`/`false`。
- 改动请求：无
- 核实程度：部分核实（①"未知参数被忽略"是读代码推断，没有发请求验证；②`from`/`to` 带 `+08:00` 之类偏移能不能被 `Instant.parse` 接受，没有读到项目里的相关代码也没有运行，无法确认，所以只建议发 `Z` 结尾的 UTC 时刻；其余已核实）

### 55（通话）会话列表里"进行中"是否包括"启动中"（`agentJoinedAt` 为空）；空账号编号当游客
- 答案：
  - 包括。"进行中"的判断只看 `ended_at IS NULL`，启动中的会话（agent 还没进房间，`agentJoinedAt` 为空）没有结束时间，所以 `inProgress=true` 会把它们一起查出来。接口文档也明写"含启动中的会话"。
  - 列表行里没有 `agentJoinedAt` 这一列（只有 9 列），所以列表上区分不了"启动中"和"进行中"；要区分就得点进详情（`GET /sessions/{id}` 有 `agentJoinedAt`）。启动中的状态很短（最长约等待 agent 加入的超时时间，文档说约 24 秒，加上扫描间隔），失败的启动中会话会被删除，不留记录。
  - 启动中会话的 `startedAt` 不是空：创建时就写了（库里不可空），agent 加入后会被重置为加入时刻。所以不能用 `startedAt` 是否为空来判断启动中。
  - 游客：`accountId` 为空就是游客会话（库里有约束：账号编号和设备哈希二选一）；游客行 `deviceId` 有值（前 8 位）。
  - 时长列：进行中的会话 `durationSeconds` 是 `null`（结束时才写），前端"endedAt 为空时写进行中"可行。
- 依据：`CORE/session/repository/SessionAdminRepository.java:120-122`（`ended_at IS NULL`）；`CORE/facade/UserAdminFacade.java:181-190`（列表行的 9 列）；`ADM/facade/SessionAdminFacade.java:40-63`（详情含 `agentJoinedAt`）；`SQL:855-863,869`（`started_at NOT NULL`、`duration_seconds NULL`、账号/设备二选一约束）。DOC:2384（"`inProgress`（`true` = `endedAt` 为空，含启动中的会话）"）、960-963（启动中规则）、2871（Session 实体）。
- 和前端暂定做法：一致（空编号当游客；时长列写"进行中"）。补充：列表里不能把"启动中"单独标出，除非前端在详情里取 `agentJoinedAt`。
- 改动请求：无
- 核实程度：已核实

### 56（埋点管理）`event-summary`、`event-names`、`funnel`、`events` 的 `from`/`to` 格式、跨度算法、不传时的行为、越界时的 `ref`
- 答案（四个接口规则相同，逐小问）：
  - 格式：ISO-8601 时刻（`Instant.parse`），例如 `2026-10-01T00:00:00Z`；传 `2026-10-01`（只有日期）会 400（`reason=INVALID_FORMAT`）。不是 `YYYY-MM-DD` 的 UTC 日。
  - 区间含不含：`[from, to)`，含 `from`、不含 `to`，按事件的 `receivedAt` 过滤。要查"10 月 1 日整天"就是 `from=2026-10-01T00:00:00Z&to=2026-10-02T00:00:00Z`。
  - 跨度：不是按天数，是按时长算：`to − from` 的时长大于 `analytics.live_max_range_days` 天（默认 31，运行时每次请求读取）才拒绝，恰好 31×24 小时通过，多 1 秒就拒绝。
  - 不传：`from`、`to` 必填，缺哪个就 400（`reason=MISSING`；两个都缺时先报 `from`），没有默认范围。
  - 越界时的 `ref`：`to` 不晚于 `from`（含相等）→ `ref=to`，`reason=OUT_OF_RANGE`；跨度超限 → `ref=to`，`reason=OUT_OF_RANGE`，`message` 是 "The range is longer than 31 days"；格式错 → 各自的 `ref`（`from` 或 `to`），`reason=INVALID_FORMAT`。
  - 另外两个范围相关的 400，`ref` 都是 `from`：MongoDB 30 秒内没查完 → `reason=TOO_SLOW`；漏斗读取超过 200,000 次 → `reason=TOO_MANY_EVENTS`。
  - `funnel` 的检查顺序：`steps` → `windowHours` → `from`/`to` 与跨度 → 并发上限（超过 `analytics.funnel_max_concurrency`，默认 2，立刻 429 `RATE_LIMITED`，不排队）。`events` 的顺序：先范围，再 `name` 格式。
  - 事件明细要精确到分钟：直接发带分钟的 ISO 时刻即可，页面需要时间选择；跨度限制照 31 天算。
  - 保存的漏斗（`/analytics/funnels`）不带 `from`/`to`，不受这些限制。
- 依据：`CORE/facade/AnalyticsFacade.java:170-223`（四个接口先取 `range`）、`337-349`（`!start.isBefore(end)` → `to` / `OUT_OF_RANGE`；`Duration.between(start, end).compareTo(Duration.ofDays(maxDays)) > 0` → `to` / `OUT_OF_RANGE`）、`351-360`（`MISSING`、`INVALID_FORMAT`）、`362-368`（`TOO_SLOW`，`ref=from`）；`CORE/event/service/FunnelService.java:133-153`（`TOO_MANY_EVENTS`、`TOO_SLOW`）；`CORE/shared/config/ConfigKeys.java:561-562`（默认 31）；测试 `TEST/AnalyticsAdminIT.java:186-205`（恰好 31 天通过，31 天加 1 秒、缺 `from`、`from==to` 都是 `INVALID_REQUEST`）。DOC:2382（"`from`、`to` 必填，ISO-8601 时刻，`from < to`"、检查顺序、`TOO_SLOW`）、2695（默认 31）。
- 和前端暂定做法：不一致（前端要改：①发 ISO 时刻，不发 `YYYY-MM-DD`；`to` 要自己算成"次日 00:00:00Z"才能含最后一天；②没有默认范围，页面必须有默认的时间范围并总是传两个参数；③跨度限制是 31 天的时长，不是"含两端天数"；④越界错误绑定到 `to` 字段，`TOO_SLOW`/`TOO_MANY_EVENTS` 绑定到 `from` 字段）。
- 改动请求：无
- 核实程度：已核实

### 57（埋点管理）已保存漏斗 `/analytics/funnels` 的形状、排序、请求体、重名、名称长度、预设、步骤规则、错误 `ref`
- 答案：
  - 权限：读（`GET`）要 `ANALYTICS:VIEW`；`POST`、`PUT`、`DELETE` 要 `ANALYTICS:FUNNEL_MANAGE`。
  - `GET /analytics/funnels`：分页（`page`、`pageSize`），响应 `{items, total}`；排序：预设在前，其余按创建时间倒序（同时间再按 `id`）。`GET /analytics/funnels/{id}` 返回单个对象；`id` 不是 UUID 或不存在 → 404 `RESOURCE_NOT_FOUND`。
  - 每个漏斗的字段：`id`、`name`、`steps`（字符串数组）、`windowHours`（整数）、`isPreset`（布尔）、`createdBy`（预设为 `null`）、`createdByUsername`（管理员被删除或预设时为 `null`）、`createdAt`、`updatedAt`。
  - `POST`/`PUT` 请求体：`{name, steps, windowHours}`；`PUT` 是整体替换，不是局部更新——`windowHours` 不传按默认 24，不是保持原值。
  - 校验顺序：先 `name`，再 `steps`，再 `windowHours`，再才是 `id`/存在性。错误都是 400 `INVALID_REQUEST`，`data.details` 里一项 `{ref, reason}`：
    - `name`：先去首尾空白（后端定义的 29 个空白码点），空 → `ref=name`，`reason=EMPTY_NOT_ALLOWED`；超过 100 个码点 → `reason=TOO_LONG`；含控制字符 → `reason=OUT_OF_RANGE`。
    - `steps`：个数不在 2 到 10（含缺失）→ `ref=steps`，`reason=OUT_OF_RANGE`；某一项不是 `[a-z0-9_]{1,64}`（含 `null`、含前后空格）→ `reason=INVALID_FORMAT`；同一事件名重复 → `reason=DUPLICATE`。请求体里的步骤不会被去空白（和 `GET /funnel` 的查询参数不同，后者会去空白）。
    - `windowHours`：不在 1 到 720 → `ref=windowHours`，`reason=OUT_OF_RANGE`；不传 → 24。
  - 重名：不报 409。管理员保存的漏斗可以互相重名，也可以和预设重名（只有预设之间名字唯一，由启动时的写入保证）。所以"data.field 为 name"的 409 不存在。
  - 预设漏斗：对预设 `PUT`/`DELETE` → 409 `INVALID_STATE`（`message` 是 "A preset funnel is read only"）。预设名字是 `Registration`、`Activation`、`Payment`，`isPreset=true`，`createdBy` 为 `null`。
  - 并发：更新/删除一个已被别人删掉的漏斗 → 404 `RESOURCE_NOT_FOUND`；对预设 → 409。两种情况的判断在同一事务里完成。
  - 事件名规则：`[a-z0-9_]{1,64}`，只有小写字母、数字、下划线（不能含逗号、空格、连字符）。
  - 审计：创建、更新、删除各写一条审计记录。
- 依据：`ADM/controller/AnalyticsAdminController.java:48,92-126`；`CORE/facade/AnalyticsFacade.java:114-123,227-301`（含 `input` 的校验顺序，行 298-301）；`CORE/event/service/SavedFunnelService.java:28,52-58,86-105`（`refused`：不存在 404、预设 409）；`CORE/event/service/FunnelRules.java:42-74`；`CORE/event/repository/SavedFunnelRepository.java:49-57,87-97`（排序、`NOT is_preset` 条件）；`CORE/adminuser/service/AdminInputRules.java:32-34,45-60`；`SQL:2726-2745`（表约束；注释 2740-2742："Funnels saved by administrators may share a name"）；`CORE/event/service/EventCatalog.java:23`；测试 `TEST/AnalyticsAdminIT.java:357-393`（预设 `PUT`/`DELETE` 为 409 `INVALID_STATE`）。DOC:2382（保存的漏斗段落）、2917（SavedFunnel 实体）。
- 和前端暂定做法：一致（名称去空白后 1 到 100 个码点；预设的 `PUT`/`DELETE` 答 409 `INVALID_STATE`）。补充：不要做"重名提示"，后端允许重名；`PUT` 要带齐三个字段。
- 改动请求：无
- 核实程度：已核实（请求体 JSON 类型不对时的报错形状，例如 `steps` 传成字符串，我没有读到对应的专门代码，只有全局的 "Malformed or invalid request body" 400）

### 93（埋点管理）漏斗步骤的事件名里有逗号怎么办
- 答案：不会出现这种事件名。事件名的格式是 `[a-z0-9_]{1,64}`（只有小写字母、数字、下划线），任何合法事件名都不含逗号，所以不需要转义规则。`GET /analytics/funnel?steps=a,b,c` 的 `steps` 就是按逗号切开、每段去首尾空白、每段必须是合法事件名（空段和不合法的段 → 400 `ref=steps`，`reason=INVALID_FORMAT`）。保存漏斗的 `POST`/`PUT` 本来就用 JSON 数组，逗号根本不是分隔符，同样只认合法事件名。重复参数（`steps=a&steps=b`）：控制器只声明了一个字符串参数 `steps`，我没有核实 Spring 对重复参数的处理，也不建议依赖。
- 依据：`CORE/event/service/EventCatalog.java:23,118`；`CORE/event/service/FunnelRules.java:30-39,42-56`（`raw.split(",", -1)`，每段 `Whitespace.strip`，再逐个校验）；`ADM/controller/AnalyticsAdminController.java:82-90`。
- 和前端暂定做法：一致（页面拒绝含逗号的步骤）。更好的做法是页面直接按 `[a-z0-9_]{1,64}` 校验每个步骤，并优先用 `event-names` 的联想。
- 改动请求：建议不做（转义规则或重复参数：事件名本身不可能含逗号，加了没有对象可用）
- 核实程度：部分核实（"重复参数怎么处理"没有核实，并且不影响结论）

---

## 对照复查

### 复查 6（统计报表）游客通话额度设成 0 时 `configuredTotalSeconds` 是 0 还是 `null`
- 新版接口文档写法是否变了：没变，意思相同。DOC:2802 写"`configuredTotalSeconds` = 当前 `guest.call_minutes_total` × 60……未配置为 `null`"；DOC:2829 的响应示例写 `"configuredTotalSeconds":n或null`；DOC:2498 写配置键"空（未配置按 0，游客不能通话）"。
- 代码是否这样做：是。`configuredTotalSeconds()` 先看这个键有没有值（库里有保存行，或有代码默认值——这个键没有默认值），没有就返回 `null`；有就返回 `值 × 60`。显式保存 0 则返回 0，因为保存行存在。配置键允许的范围是 0 到 1440 分钟。`CORE/stats/service/StatQueryService.java:251-258`；`CORE/shared/config/StoredSettings.java:111-114`（`rows.containsKey(...) || spec.hasDefault()`）；`CORE/shared/config/ConfigKeyTypes.java:302`（范围 0 到 1440，无默认值）；测试 `TEST/StatsAdminIT.java:590-598`。
- 结论：仍然正确。（行为上，设成 0 和未配置都让游客不能通话；区别只在这个展示字段：0 对 `null`。）

### 复查 7（通话）`GET /sessions/{id}` 还返回哪些字段，`roomName` 能不能给运营看
- 新版接口文档写法是否变了：没变，位置变了。通则在 DOC:2434；通话行在 DOC:2384（"`Session` 的全部第十八节列，`deviceId` 只显示前 8 位，账号会话为 null"）；Session 实体在 DOC:2871。
- 代码是否这样做：是。详情接口返回 22 个字段：`id`、`accountId`、`deviceId`（游客才有，前 8 位）、`freeTier`、`roomName`、`requestedAt`、`timezone`、`modelTier`、`language`、`renderMode`、`deadlineAt`、`startedAt`、`endReason`、`agentJoinedAt`、`lastParticipantEventAt`、`agentIdentity`、`userJoinedAt`、`userLeftAt`、`endedAt`、`durationSeconds`、`statsAppliedAt`、`maxDurationMinutes`，正好是 DOC:2871 里 Session 的 22 列，一列不多一列不少，所以 `roomName` 会返回。`ADM/facade/SessionAdminFacade.java:40-63,96-118`。
- 结论：仍然正确。要不要显示 `roomName` 由前端决定；它是通话房间名，不是个人隐私信息，后端没有隐藏它。

---

## 我发现的、问题表没问到但前端会踩到的坑

1. 会话列表行没有 `agentJoinedAt`：列表上"启动中"和"进行中"分不开，只有详情才有这一列。`CORE/facade/UserAdminFacade.java:181-190`。
2. `/stats/daily` 里事件七列在"当天没有任何客户端事件"时是 `null` 而不是 0（业务行存在，事件行不存在），日报卡片要把 `null` 显示成"—"。`CORE/stats/service/StatQueryService.java:181`。
3. 平台参数大小写：请求里 `platform=android` 也行，但响应里的 `platform` 字段是规范化后的 `ANDROID`/`IOS`/`ALL`，而"未知"平台是小写 `unknown`（不是 `UNKNOWN`）；前端做平台比较或筛选回显时要照这个大小写。`CORE/stats/service/StatQueryService.java:102-111`；测试 `TEST/StatsAdminIT.java:269-273`。
4. 当天的行（日报、回流、游客日报、留存的当天 cohort 与到期格子）全是临时值，不止留存：每 15 分钟（`stats.land_interval_minutes`，默认 15）刷新。DOC:2809、2690。
5. `GET /analytics/events` 的 `total` 是用同一个筛选条件现数的，和明细同受 30 秒查询时限，超时同样是 400 `TOO_SLOW`（`ref=from`），页面要有"缩小时间范围"的提示。`CORE/event/service/EventQueryService.java:121-126`、`CORE/facade/AnalyticsFacade.java:362-368`。
6. 事件汇总 `event-summary` 的 `uv` 是去重后的账号数，匿名事件（`accountId` 为空）只算在 `pv` 里，不算 `uv`；每个事件名最多返回 1000 个，按 `pv` 倒序再按名字。`CORE/event/service/EventQueryService.java:168-194`。
7. 保存漏斗的 `PUT` 请求缺 `windowHours` 会把窗口重置成 24，而不是保持原值（见 57），编辑页要把原值回填再提交。`CORE/event/service/SavedFunnelService.java:52-58`。

## 接口文档与后端代码互相矛盾的地方（本组范围内）

- 统计接口的日期范围：DOC:2815 写"日期格式不对或年份小于 1 → `OUT_OF_RANGE`"，但 `/stats/*` 走的 `StatQueryService.range` 调用的是不带最小年份参数的 `StatsRange.resolve`（`CORE/stats/service/StatQueryService.java:89-95` → `CORE/shared/time/StatsRange.java:34-37` 传入 `Year.MIN_VALUE`），所以像 `0000-01-01` 这样年份为 0 的日期代码不会按文档拒绝（投放效果报表等两处调用传了最小年份 1：`CORE/attribution/service/PerformanceReportService.java:90-98`、`ADM/facade/AttributionAdminFacade.java:189-197`）。我没有运行验证年份 0 会得到什么结果；对前端无实际影响，只是文档与代码不一致。

---

# 第 C 部分：users-moderation-support-alerts-memory

共 21 条（20 条待答 + 1 条对照复查）：已核实 18 条，部分核实 3 条（13，缺的是失败的异常会不会是匿名类，没有逐个删除步骤去查；101、137，缺的是记忆服务自己返回的文字，那是外部服务，本仓库里读不到），未核实 0 条；前端要改 4 条（59、61、82、95）；改动请求 7 条（建议做 5：60、61、103、134、137；建议不做 2：62、65）；接口文档新版完全写明 7 条（58、59、65、94、95、102、140），部分写明 8 条（27、43、63、66、82、101、134、137）。

已按独立核对结果更正：更正 3 处，行号 5 处。

说明：
- 路径简写：`后端` = `D:\Projects\PycharmProjects\AvatarBackend`；`文档` = `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md`（新版，下面写"文档 N"是该文件第 N 行；前端表里的旧行号 2289、2294、2307、2326 在新版里已经变了，对应关系是：用户行 2376、内容审核行 2377、客服行 2389、系统监控（含告警）行 2390、记忆服务行 2396、告警类型说明 2409、配置表 2630）。
- 控制器在 `admin\src\main\java\com\avatarapp\backend\admin\controller\`，门面在 `admin\...\facade\` 和 `core\src\main\java\com\avatarapp\backend\core\facade\`，下面只写文件名:行号，目录靠文件名可找到。
- "门面"指控制器背后真正做判断的那个类。

### 13（用户）账号删除任务的 `lastError` 会不会含用户内容、令牌或内部主机名
- 答案：不会。`lastError` 只由一处写入：删除执行器在某一步失败时写成 `"step <第几步>: " + <异常的简单类名>`，如果是锁被占用则写 `"step <第几步>: LOCK_HELD"`。只用类名（`getSimpleName()`），不带异常消息，所以不会带用户内容、令牌、主机名。写入时截断到 255 个字符。步骤状态 `stepStates[].error` 存的也是同一个类名（或 `LOCK_HELD`）。任务成功完成时 `lastError` 被清成 null。管理员发起的删除，管理员写的 `reason` 只进审计日志，不进这张表（表里 `reason` 在管理员入口是 null；该列即使有值也只允许 `NOT_USEFUL` 等六个固定值，见 V1__schema.sql:2391-2392）。
  - 一个边角（推断，未实测）：如果失败的异常是匿名类，`getSimpleName()` 会是空串，这时 `lastError` 就只有 `"step 3: "`，页面应能容忍后半截为空。
  - 对应的 `DELETION_FAILED` 告警的 `detail` 是 `"Account deletion failed <N> times, last at step <K> (<类名>)"`，同样只有类名。
- 依据：DeletionExecutor.java:250-259（拼 error 与调用 rows.fail）、:270-271（告警 detail）、:252（stepStates 的 error）；AccountDeletionRepository.java:31（`LAST_ERROR_MAX = 255`）、:243-255（`fail` 截断并写入）、:233（`complete` 清空）；AccountDeletionFacade.java:136-139（管理员入口 reason 传 null、auditReason 只进审计）；文档 2376（"失败告警由 status=FAILED、attempts、lastError 表示"，没有规定 lastError 的内容）。
- 和前端暂定做法：一致（原样显示，不读 `stepStates`；长度最多 255，可以放心不截断）。
- 改动请求：无
- 核实程度：部分核实（"失败的异常会不会是匿名类"无法确认：删除步骤抛出的异常类型很多，没有逐个步骤去查；匿名类的 `getSimpleName()` 返回空串是 Java 语言行为，拼接方式在 DeletionExecutor.java:251、:259 已读到）

### 27（记忆服务与监控）`GET /alerts` 的 `detail` 是字符串还是 JSON 对象；`total` 是不是当前页条数
- 答案：
  1. `detail` 是字符串，可以为 null（数据库列是 `text NULL`，Java 里是 `String`）。不是 JSON 对象。
  2. `total` 是满足同一组 `status`、`type` 筛选的全部行数（单独跑了一条 `SELECT count(*)`），不是当前页条数。所以"未处理告警"卡片可以请求 `GET /alerts?status=OPEN&pageSize=1`，读 `total`。
  3. 响应形状是 `{"items":[...],"total":N}`；每项字段：`id, type, accountId, refType, refId, detail, status, createdAt, resolvedAt`。排序：`createdAt` 新的在前，再按 `id` 倒序。
  4. `status` 只认 `OPEN`、`RESOLVED`；`type` 只认 18 种之一，否则 400（见 140）。
- 依据：AlertFacade.java:38-47（AlertItem）、:50-65；AdminAlertReader.java:52（count）、:59（排序）、:41-60；V1__schema.sql:44-54（admin_alert 表，`detail text NULL`）；文档 2390、2409。
- 和前端暂定做法：一致（`detail` 当文字显示；`total` 是数字，"不是数字显示—"的兜底可保留但不会触发）。
- 改动请求：无
- 核实程度：已核实

### 43（告警）`SUBSCRIPTION_EVENT_FAILED` 的 `refType`、`refId`、`accountId`、`detail`，何时自动解决，能否手动关闭，运营该做什么
- 答案：
  1. `refType` 固定是 `SUBSCRIPTION_EVENT`；`refId` 是商店通知事件（`SubscriptionEvent`）的 id（UUID 文本）；`accountId` 取事件上的账号，查不到就是 null（所以页面不能假设有账号）。
  2. `detail` 是一句英文：`Store <商店> event <事件类型> gave up after <次数> store outages; no subscription is known for it`，次数目前恒为 60（商店不可用重试上限 `MAX_TRANSIENT_ATTEMPTS = 60`）。里面只有商店名、事件类型和次数，没有用户内容。文档没有规定这个 `detail` 的写法，以代码为准。
  3. 什么时候写：只有当这个事件因商店不可用连续失败 60 次、并且没有关联到任何订阅时才写；已经关联订阅的事件只标"需要关注"，不写这条告警。
  4. 自动解决：事件之后被处理成功（后台任务处理完后检查 `processedAt`），或运营对该事件执行 `POST /subscription-events/{id}/ack`。只执行 `reprocess`（重新处理）不会解决它。
  5. 手动关闭：可以。`POST /alerts/{id}/resolve` 对这个类型没有额外的关闭钩子（搜 `AlertResolveHook`，实现类只有"外观驱动包"那一种告警的钩子），所以只是把告警置为 `RESOLVED` 并写审计日志；它不会改动事件本身的"需要关注"标记。
  6. 运营该做什么：文档没有写操作步骤。系统里能做的事是：到订阅事件页（`GET /subscription-events?needsAttention=true`）找到 `refId` 对应的事件，用 `reprocess` 重新排队处理，或者确认无需处理后 `ack`（ack 会连带关闭这条告警）。页面可以用这句话提示。
- 依据：SubscriptionFacade.java:894-907（`openGiveUpAlert`）、:165（`MAX_TRANSIENT_ATTEMPTS = 60`）、:937-950（达到 60 次才开告警）、:910-921 与 :1363（处理成功后解决）、:1268-1283（ack 解决）、:1243-1244（reprocess 不解决）；AlertTypes.java:33、:76；AlertRefTypes.java（`SUBSCRIPTION_EVENT`）；LookPackageAlertResolveHook.java:32-34（唯一的钩子，针对 `LOOK_PACKAGE_PREPARE_FAILED`）；SubscriptionAdminController.java:58-74（三个路由）；文档 2409（`SUBSCRIPTION_EVENT_FAILED` 的 refType/refId/accountId/自动解决条件均已写明，`detail` 没写）。
- 和前端暂定做法：一致（原样显示 `refType`、`refId`、`detail`；`accountId` 可能为 null 要容忍）。建议页面给这条告警加一句固定说明（见上面第 6 点），这是前端自己的文案。
- 改动请求：无
- 核实程度：已核实

### 58（用户）`GET /users` 和 `GET /users/export` 七个筛选参数名；匹配方式；`mediaSource` 是否忽略大小写；`status` 非法值是否 400
- 答案：
  1. 七个参数名完全正确：`accountId, email, phone, status, channelCode, trafficType, mediaSource`，列表和导出一模一样。另外两个列表接口都接受分页参数 `page`、`pageSize`（导出不分页，不看它们）。其他不认识的查询参数会被直接忽略（控制器没声明、也没有严格校验，全仓库只有一个读 `getParameterMap` 的类，那是请求体长度限制，不检查查询参数）。所以参数名写错筛选会被静默忽略，导出会导出全部——名字不能错。
  2. 空串等于没传（`present()` 判断非空才筛选），所以前端"只发有值的参数"没问题。
  3. 各参数规则：
     - `accountId`：必须是 UUID，否则 400，`details=[{ref:"accountId",reason:"INVALID_FORMAT"}]`。
     - `email`：先按 2.2 规范化再精确匹配；规范化不了的值（不像邮箱）不报错，直接返回空结果（列表 `items=[]`、`total=0`；导出是空文件，不是全部用户）。
     - `phone`：按 E.164 规范化后精确匹配；不是完整号码 → 400，`{ref:"phone",reason:"INVALID_FORMAT"}`。
     - `status`：取 `ACTIVE`、`BANNED`、`PENDING_DELETION`、`DELETING` 之一，区分大小写；非法值 → 400，`{ref:"status",reason:"OUT_OF_RANGE"}`。
     - `channelCode`：精确匹配（`u.channel_code = ?`），区分大小写，不去空白。
     - `trafficType`：只能是 `PAID` 或 `ORGANIC`，否则 400，`{ref:"trafficType",reason:"OUT_OF_RANGE"}`。
     - `mediaSource`：精确匹配最早那条安装记录的 `mediaSource`，**区分大小写**（数据库列是 `text`，SQL 是 `media_source = ?`，没有 lower）。注意：`trafficType` 判定里对 `organic` 是忽略大小写的，这是两回事。
  4. 一次只报告第一个错误（`status` 和 `trafficType` 同时非法只会看到先检查到的那个；检查顺序：accountId、status、trafficType、phone，然后 email）。
  5. 导出的非法参数也是同样的 400（先判断 `USER:VIEW` 权限，再检查参数，再开始流式输出）。
- 依据：UserAdminController.java:66-84（列表参数）、:86-109（导出参数）；UserAdminFacade.java:495-542（`filter`：各项检查与顺序）、:263-272、:278-296；UserAdminRepository.java:197-235（`where`：`u.id = ?`、`u.email = ?`、`u.phone = ?`、`u.status = ?`、`u.channel_code = ?`、`media_source = ?`）、:40、:35-36；InstallRecordSql.java:35-36；V1__schema.sql:1744（`media_source text NULL`）；AccountStatus.java；文档 2376（参数名与规则）。
- 和前端暂定做法：一致。
- 改动请求：无
- 核实程度：已核实

### 59（用户）`GET /users/{id}/sessions` 按哪一列倒序；行里有哪些列
- 答案：
  1. 按 `requestedAt` 倒序，相同时按 `id` 倒序（SQL：`ORDER BY requested_at DESC, id DESC`）。
  2. 响应 `{"items":[...],"total":N}`。每行**只有九个字段**：`id, accountId, deviceId, requestedAt, startedAt, endedAt, durationSeconds, modelTier, language`（账号会话的 `deviceId` 恒为 null）。
  3. **没有 `endReason`**。前端暂定读的 `endReason` 在这个接口的行里不存在（会是 undefined）。要看结束原因，要调 `GET /sessions/{id}`（返回会话表全部列，含 `endReason`），或者在 `GET /sessions` 里用 `endReason=` 筛选但那也不返回该列。
  4. 账号不存在或 id 不是 UUID → 404 `RESOURCE_NOT_FOUND`（"Account not found"）。
- 依据：UserAdminController.java:117-122；UserAdminFacade.java:181-190（`SessionListItem`，九个字段）、:327-339、:370-381；SessionAdminRepository.java:86（排序）、:24-28；文档 2376（"每项是'通话'行的九列"）、2384（九列的名字；`GET /sessions/{id}` 才是全部列）。
- 和前端暂定做法：不一致（前端要改：会话页签不要读 `endReason`；需要时点开某一行再调 `GET /sessions/{id}`。`id, requestedAt, startedAt, endedAt, durationSeconds, modelTier, language` 都在，可以保留）。
- 改动请求：无（文档已把这个接口定义为通话行的九列，且有详情接口可补）
- 核实程度：已核实

### 60（用户）能否让 `GET /account-deletions` 加 `accountId` 筛选，或让 `GET /users/{id}` 带 `deletion` 对象
- 答案：现在两样都没有。
  1. `GET /account-deletions` 只认 `status`（外加分页），没有 `accountId`；`status` 非法 → 400，空串 = 不筛选。按时间新的在前。
  2. `GET /users/{id}` 返回的 26 个字段里没有 `deletion`。只有 `status`（状态为 `PENDING_DELETION` 时才知道在宽限期）。
  3. 只有一种情况拿得到宽限期截止时间：运营点"发起删除"那一刻，响应 `data` 是 `{"deletionId","scheduledAt"}`（`scheduledAt` 就是 `executeAfter`）。之后再看就没有了。
  4. 底层已有现成的查法：数据库对未完成的删除任务（`SCHEDULED/PENDING/RUNNING/FAILED`）按账号有唯一索引，服务里有 `findOpenByAccount`。
- 依据：DeletionAdminController.java:49-54；DeletionAdminFacade.java:101-121（只有 status）；UserAdminFacade.java:136-163 对应的 UserDetail（无 deletion）；ScheduledDeletion.java；AccountDeletionRepository.java:95-104（`findOpenByAccount`）、:267-282；V1__schema.sql:2404（`account_deletion_account_open_key`，account_id 上的唯一索引，只覆盖未完成状态）；文档 2376。
- 和前端暂定做法：一致（现在页面确实拿不到宽限期截止时间）。
- 改动请求：建议做。做法：在 `GET /users/{id}` 里加 `deletion` 字段（没有未完成的删除时为 null），内容至少 `id, status, executeAfter, requestedBy, requestedByUsername, createdAt`，用已有的 `findOpenByAccount` 取。理由：客服要对用户说"到哪天、谁发起"，这是详情页本来就该展示的数据，而且已有索引支持一次按账号取，不需要新增筛选；`accountId` 筛选没有合适的索引（现有索引都以 status 或时间开头，部分唯一索引只覆盖未完成状态）。两个二选一，选前者。
- 核实程度：已核实

### 61（内容审核）`GET /moderation/records` 是否支持 `contentType` 筛选；不认识的查询参数忽略还是 400
- 答案：
  1. 不支持。控制器只声明了 `status`、`source` 两个筛选（外加分页）。
  2. 不认识的查询参数（包括 `contentType`）被**直接忽略**，不是 400。所以前端发了 `contentType` 不会报错，但也完全不起作用，列表里会混进七种类型（`AVATAR, VOICE, MESSAGE, PERSONA, COMPANION_NAME, AVATAR_IMAGE, ACTION_CLIP`）。
  3. `status` 取 `PENDING_REVIEW, APPROVED, REJECTED, BLOCKED`，`source` 取 `AUTO, REPORT, COMPLAINT`；非法值 400，`{ref:"status"|"source",reason:"OUT_OF_RANGE"}`；空串 = 不筛选。
  4. 排序固定"最老的在前"（`created_at ASC, id ASC`），**不带 `status` 时会把已处理、已拦截的也混在里面**。做待处理队列必须带 `status=PENDING_REVIEW`。
  5. 前端"对返回的行再过滤一次"的后果：分页和 `total` 是按全部类型算的，过滤后每页行数不一致、可能整页为空，`total` 也不对。
- 依据：ModerationAdminController.java:38-46；ModerationFacade.java:218-230、:479-489（`parse`）；ModerationRecordRepository.java:209-229（只有 status、source 两个条件，排序）、:311-323（`filter`）；ContentType.java；ModerationSource.java；ModerationStatus.java；在 admin、common、core 三个模块的主代码里搜 `getParameterMap`/`getParameterNames`：只有 common 的 RequestBodyLimitFilter.java:246、:251 命中（worker、app 模块未搜），用来包请求体，不校验查询参数；文档 2377（"records?status=&source="）。
- 和前端暂定做法：不一致（前端要改：不要用"发参数 + 客户端再过滤"，那样分页和总数是错的；在后端加上筛选之前，类型筛选只能当作"本页内的显示过滤"，并在界面上说明；或者先不提供类型筛选）。
- 改动请求：建议做。加 `contentType` 参数，取值是上面七种之一，非法 400（`ref:"contentType"`），与 `status`、`source` 同样处理（`ModerationFacade.parse` 现成）。理由：队列有七种类型，运营按类型处理是常态，客户端过滤会让分页和总数出错；改动很小（门面加一个参数、仓库加一个条件），Android 和 AvatarAgent 不调用这个接口。
- 核实程度：已核实

### 62（内容审核）`categories` 的类型；`source=REPORT` 时 `autoLevel`、`score`；详情与列表是否同形状；能否直接给等待秒数
- 答案：
  1. `categories` 是字符串数组（`List<String>`，数据库是 jsonb 数组且有检查约束必须是数组），不是逗号分隔的字符串。
  2. `source=REPORT`（用户举报）时 `autoLevel` 为 null、`score` 为 null、`providerRef` 为 null、`categories` 是空数组 `[]`，`reporterReason`（`SEXUAL/HARASSMENT/VIOLENCE/SELF_HARM/OTHER`）和 `reporterDetail` 有值。`source=COMPLAINT`（照片里的人投诉导致形象被删，只为统计而写）也是 `autoLevel` null、`categories` `[]`、状态直接是 `APPROVED`。
  3. 详情 `GET /moderation/records/{id}` 和列表每行是同一个形状（同一个 `RecordItem`，18 个字段：`id, accountId, sessionId, contentType, contentRef, source, autoLevel, categories, score, providerRef, status, reporterReason, reporterDetail, reviewedBy, reviewedByUsername, reviewedAt, note, createdAt`）。`accountId` 可能为 null（账号删除后清空）；`reporterDetail` 在账号删除后也被清空。
  4. 后端不给等待秒数：记录里没有这个字段。只有 `GET /moderation/stats` 里的 `oldestPendingSeconds`（全局最老的一条）。其余要用 `createdAt` 在前端算。
- 依据：ModerationFacade.java:195-213（RecordItem）、:232-264（detail 与 item）；ModerationRecordData.java；V1__schema.sql:2202-2227（`categories jsonb NOT NULL` 与 `moderation_record_categories_check`）；ModerationRecordRepository.java:109-134（REPORT 的 insert 里 `auto_level` NULL、`categories '[]'`、`score` NULL）、:240-244（账号删除清空）；ModerationService.java:428-445（COMPLAINT 记录）；文档 2377。
- 和前端暂定做法：一致（按数组；前端用 `createdAt` 算等待时长；`autoLevel`、`score` 要容忍 null）。
- 改动请求：建议不做（等待秒数）。理由：列表里每条都带服务器时间的秒数会让缓存和重复请求下的数字立刻过时，业界队列页都是前端用创建时间算；`oldestPendingSeconds` 已经提供了服务器时钟下的最老一条。
- 核实程度：已核实

### 63（内容审核）`GET /moderation/stats` 的 `approved`/`rejected` 算创建日还是处理日；`avgHandleSeconds` 的范围；没有记录的日子有没有行；`oldestPendingSeconds` 是否与范围无关
- 答案：
  1. `created, approved, rejected, blocked` 都是按**创建日**（UTC）分组：先挑出创建时间在范围内的记录，再数这些记录**现在**的状态（`APPROVED` 数 approved，`BLOCKED` 数 blocked；`rejected` 数 `REJECTED` 但不含"被重新提交顶替而关闭"的那种——`reviewed_by` 为空且 `note='SUPERSEDED'`，没人拒绝过它）。不是处理日。所以一条上周创建、今天才通过的记录，算在上周那一行。
  2. `avgHandleSeconds`：范围内**创建**的记录里、由管理员处理过的那些，从创建到处理的平均秒数；没有则为 null。不是"范围内处理的"。
  3. 没有记录的日子没有行（是 GROUP BY 的结果）；每行是（日期、内容类型、来源）一个组合，所以同一天可能有多行；排序按日期、类型、来源。
  4. `oldestPendingSeconds`：当前所有 `PENDING_REVIEW` 记录里最老一条到现在的秒数（`min(created_at)`，不看 `from`、`to`），没有待处理为 null，且不会小于 0。前端"按与范围无关处理"正确。
  5. 范围：`from`、`to` 格式 `YYYY-MM-DD`（UTC 日），都不传 = 最近 7 天含今天；传一个，另一个按 ±6 天补（不超过今天）；`from` 晚于 `to` 或跨度超过 `stats.max_range_days` → 400。前端把 `from`、`to` 都传今天是合法的。
- 依据：ModerationFacade.java:388-416、:89；ModerationRecordRepository.java:264-288（stats SQL：`created_at` 范围、`GROUP BY 1,2,3`、三个 `FILTER`）、:294-300（avg）、:303-307（oldest）；StatsRange.java（范围规则全文）；ModerationStatRow.java；文档 2377（"当前最老待处理的等待时长"）。
- 和前端暂定做法：一致。
- 改动请求：无
- 核实程度：已核实

### 65（客服）`GET /support/feedback` 能否按 `forwardStatus`、`category` 筛选；列表每行是全部列还是摘要
- 答案：
  1. 已经支持：`forwardStatus`（`PENDING/FORWARDED/FAILED`）、`category`（`BUG/QUESTION/SUGGESTION/OTHER`），另外还有 `accountId`（UUID）。别的值 400，`{ref:<参数名>,reason:"OUT_OF_RANGE"}`；缺省或空串 = 不筛选。区分大小写。
  2. 列表每行是**全部列**，没有摘要版：`id, accountId, category, message, context, forwardStatus, forwardRef, attempts, nextAttemptAt, lastError, createdAt`。`message` 最长 4000 个码点，`context` 里有设备信息和最近错误文字，所以 200 行确实可能很大（最坏约几 MB）。页大小默认 20，最大 200，超过是 400（不会截断）。
  3. 排序固定 `createdAt` 倒序、`id` 倒序。
- 依据：SupportAdminController.java:37-45；SupportAdminFacade.java:64-72、:115-134；SupportValues.java:13、:16；SupportFeedbackView.java（全部列）；SupportFeedbackRepository（support 仓库）的 ORDER BY：`core\...\support\repository\*.java:162`；AdminPageQuery.java（最大 200）；文档 2389（筛选与全部列）、12 节字段表（`message` 1-4000 码点，文档 12 节"字段校验"那一行）。
- 和前端暂定做法：一致（暂定"不加筛选"可以升级：加上 `forwardStatus=FAILED` 即可只看转发失败的）。
- 改动请求：建议不做（摘要模式）。理由：筛选已经能把结果缩到很少几条；文档 17.4 附录规则 1 规定列表返回全部列；前端把 `pageSize` 设小（如 20-50）即可控制大小。
- 核实程度：已核实

### 66（客服）`POST /support/feedback/{id}/retry`、`POST /alerts/{id}/resolve` 成功时 `data`；状态不对是否 409 `INVALID_STATE` 且 `data.status`
- 答案：
  1. 反馈重试：成功时 `data` 是**重试之后的整行**（和列表一行同形状，`forwardStatus` 变成 `PENDING`，`attempts` 0，`nextAttemptAt` 与 `lastError` 为 null）。
  2. 告警关闭：成功时 `data` 是 `null`。
  3. 对不是 `FAILED` 的反馈重试：409 `INVALID_STATE`，`message` "Only a FAILED feedback can be forwarded again"，`data` 是 `{"status":"<当前 forwardStatus>"}`。id 不存在或格式不对：404 `RESOURCE_NOT_FOUND`，先于 409 判断。
  4. 对已经 `RESOLVED` 的告警再关闭：409 `INVALID_STATE`，`message` "Alert is already resolved"，**但 `data` 是 null，没有 `data.status`**。前端的预期（带 `data.status`）对告警不成立。告警不存在：404 `RESOURCE_NOT_FOUND`（"Alert not found"）。
  5. 告警的 id 路径参数按 UUID 解析，**格式不对的 id 是 400 `INVALID_REQUEST`（message "Invalid value for parameter: id"，没有 `details`）**，不是 404；反馈的 id 按文本解析，格式不对是 404。
  6. 反馈重试成功时，会顺带把该反馈的 `SUPPORT_FORWARD_FAILED` 告警置为 `RESOLVED`。
- 依据：SupportAdminController.java:53-57；SupportAdminFacade.java:80-102、:104-113；SupportService.java:262-272（`retry`、`RetryRefusal`，:265 解决告警）；SupportFeedbackRepository.java:152-155（`statusOf`）；AlertAdminController.java:37-42；AdminAlertService.java:158-203（`resolveManually`；:175 404、:179 409 无 data）；GlobalExceptionHandler.java:143-146（类型不匹配 → 400，仅 message）；文档 2389（反馈重试：返回该行、409 带 `data.status`）、2390 与 2409（告警关闭写审计，未写响应）。
- 和前端暂定做法：一致（忽略成功响应，失败显示 409 译文并重新读列表）。需知道：告警的 409 没有 `data.status`，不能依赖它显示"当前状态"。
- 改动请求：无
- 核实程度：已核实

### 82（告警）投放回传凭证告警：只改名字（像素编号不变）、请求里没有令牌字段，算"重新填写"吗；广告平台错误码有没有固定写法和长度上限
- 答案：
  1. 只改名字、像素编号不变、没带令牌：**不算**，告警不会被关闭，那条待发送的回传也不会被重置。判断规则：令牌字段是"设置新值"（非空字符串）或"清除"（显式 null 且原来有令牌）算令牌变了；像素编号按值和原来比较，不一样算变了。任一变了才重置回传并关闭告警。
  2. 注意三点与前端暂定做法的差别：
     - 重新提交**同样内容**的令牌也算变了（只要是"设置新值"就算），会关闭告警。
     - **清除令牌**（`facebookAccessToken: null`，且原来有令牌）也算变了，会关闭告警。
     - `PUT` 是整体替换：不带 `facebookPixelId` 就等于把像素编号清成 null，这就成了"像素编号变了"，也会关闭告警（同时把像素清掉）。所以前端"只改名字"的请求必须把原像素编号一起发回去。
  3. 告警的 `detail`：Meta 返回的错误码的十进制文本（后端存的是整数，例如 `"190"`，所以不会超过 11 个字符），**也可以为 null**（没有错误码时，如 401/403 没带错误体）；或者固定值 `token_unreadable`（令牌打不开）、`pixel_id_malformed`（像素编号格式不对）。已有 `OPEN` 告警时，新的失败原因不同就替换 `detail`（显示最近一次原因）。会被判为凭证失败的 Meta 错误码是 10、102、104、190、200、294，以及 100 加子码 33，另外 HTTP 401/403 也算。
  4. `refType=ATTRIBUTION_CAMPAIGN`，`refId` 是活动 id，`accountId` 为 null。
- 依据：CampaignService.java:129-158（:139-141 令牌与像素的变化判断、:144-147 重置并关闭告警）、:50-52；CampaignInputs.java:105（缺省像素 → null）、:118-141（令牌的 KEEP/CLEAR/SET）、:25-31 说明；CampaignAdminRepository.java:132（更新时总是写入 `f.facebookPixelId()`）；PostbackForwardService.java:199-216、:225-238、:405-408、:375；PostbackResponseClassifier.java:24、:44-57；PostbackClient.java:80（`Integer metaErrorCode`）；PostbackForwardService.java:82、:85（两个固定值）；文档 1531（"`PUT` 替换每个可编辑字段（缺省的可空字段变为 null）"）、2409（"管理员重新填写令牌或像素 id 时自动 RESOLVED"，没写"同样内容"和"清除"的情形）。
- 和前端暂定做法：不一致（前端要改：模拟服务关闭告警的条件应改为"有新令牌（即使内容相同）、令牌被清除（原来有）、或像素编号和原来不同（含被清空）"；"只改名字"的请求要带上原像素编号，否则会被当作清空像素）。
- 改动请求：无
- 核实程度：已核实

### 94（用户）封禁、解封、发起删除、取消删除、重试成功时 `data` 返回什么
- 答案：
  - 封禁 `POST /users/{id}/ban`：`null`。
  - 解封 `POST /users/{id}/unban`：`null`。
  - 发起删除 `POST /users/{id}/deletion`：`{"deletionId":"<UUID>","scheduledAt":"<ISO-8601 UTC，即宽限期结束时刻>"}`。
  - 取消删除 `POST /users/{id}/deletion/cancel`：`null`。
  - 重试删除任务 `POST /account-deletions/{id}/retry`：该任务的整行（字段同 `GET /account-deletions` 的一行，含 `requestedByUsername`，是重试之后的状态）。
  - 三个删除相关接口状态不允许时 409 `INVALID_STATE`，`data.status` 是当前状态（发起删除/取消删除是账号状态，重试是任务状态）。封禁/解封的 409 同样带 `data.status`（文档写明）。
- 依据：UserAdminController.java:130-143（ban/unban 返回 `ApiResponse.ok(null)`）；DeletionAdminController.java:56-75；DeletionAdminFacade.java:124-151（retry 返回行）；ScheduledDeletion.java；AccountDeletionFacade.java:136-139、:245-253（管理员入口 409 带 `statusData`）、:265、:303（取消时 409）；文档 2376（逐项写明）。
- 和前端暂定做法：一致（不读响应，成功后重新读取）。
- 改动请求：无
- 核实程度：已核实

### 95（内容审核）`POST /moderation/records/{id}/decision` 的响应 `data`、`note` 最长多少码点、检查顺序
- 答案：
  1. 成功时 `data` 是 `null`。
  2. `note`：去首尾空白（文档 1.9 的空白集合）后**最多 1000 个码点**，不能含控制字符；**`REJECT` 时必填，`APPROVE` 时选填**（选填且去空白后为空就存 null）。前端暂定的"1 到 500、一律必填"与后端不同。
  3. 检查顺序：权限（`MODERATION:REVIEW`，不够 403 `ADMIN_FORBIDDEN`）→ `{id}` 不是 UUID（400 `INVALID_REQUEST`，只有 message，没有 `details`）→ `decision` 缺失/空 → 400 `EMPTY_NOT_ALLOWED`，不是 `APPROVE`/`REJECT`（区分大小写）→ 400 `OUT_OF_RANGE` → `note`（`REJECT` 缺失 → `EMPTY_NOT_ALLOWED`，超长 → `TOO_LONG`，含控制字符 → `OUT_OF_RANGE`，`ref` 都是 `note`）→ 记录不存在 404 `RESOURCE_NOT_FOUND`（"Moderation record not found"）→ 记录已处理 409 `INVALID_STATE`，`data.status` 是当前状态（`APPROVED/REJECTED/BLOCKED`；"The record has already been decided"）。即：参数先于记录是否存在，存在性先于状态。一次只报告第一个错误。
  4. 以上之后才执行该类型的后续动作（删除资产、通知等，同一个事务），其内部的业务错误本次未逐个核实。
- 依据：ModerationAdminController.java:36（DecisionRequest）、:60-71；ModerationFacade.java:86（`NOTE_MAX = 1000`）、:274-301（`decide`：:277 decision、:278 note、:279-280 条件更新）、:303-313、:315-321（409）、:323-325（404）；AdminInputRules.java:45-60（`text`：去空白、必填、长度、控制字符，`ref` 即字段名）、:104-107（`invalid`）；GlobalExceptionHandler.java:143-146；文档 2377（"note 在 APPROVE 时选填、REJECT 时必填，…最多 1000 个码点"）、1612（409 带 `data.status`）。
- 和前端暂定做法：不一致（前端要改：`note` 上限改为 1000 个码点；`APPROVE` 时可不填，只有 `REJECT` 才必填；`note` 超长或缺失的错误在 `details[0].ref` 为 `note`，`decision` 非法在 `ref` 为 `decision`）。"不读响应"一致。
- 改动请求：无
- 核实程度：已核实

### 101（记忆服务与监控）三个写接口成功时 `data`；名字不合格、`teiBaseUrl` 主机不在白名单、`dimensions` 越界等校验失败的 `ref` 和 `reason`
- 答案：
  1. 成功时的 `data`：
     - `PUT /memory/tiers/{name}` → 合并之后的档位全部字段：`{tierName, topK, recencyChannelEnabled, recencyChannelCount, consolidationEnabled, consolidationThreshold}`（取自记忆服务的返回）。
     - `PUT /memory/embedding-models/{name}` → `{modelName, teiBaseUrl, dimensions}`。
     - `PUT /accounts/{id}/memory/embedding-model` → 新增的那条指派 `{modelName, assignedBy, assignedByUsername, assignedAt}`。
  2. 本后端自己的校验失败：一律 400 `INVALID_REQUEST`，`data.details` 是只有**一项**的数组 `[{ref, reason}]`（只报第一个错）。所有校验都在调用记忆服务之前完成。
     - 名字不合格（不是 `^[A-Za-z0-9_-]{1,64}$`）：`ref` 是 `name`（档位名、模型名的路径参数）；指派接口里请求体的 `modelName` 不合格时 `ref` 是 `modelName`；`reason` 都是 `OUT_OF_RANGE`。
     - 请求体不是 JSON 对象（含缺失）：`ref:"body"`，`reason:"EMPTY_NOT_ALLOWED"`。多了不认识的字段：`ref` 是该字段名，`OUT_OF_RANGE`。字段值为显式 null：`ref` 是该字段名，`EMPTY_NOT_ALLOWED`。
     - `teiBaseUrl`：缺失/空/不是字符串 → `EMPTY_NOT_ALLOWED`；超过 2048 个字符或含 NUL → `TOO_LONG`；不是合法 URL、不是绝对的 http/https、带用户信息、没有主机、**主机不在 `memory.tei_allowed_hosts` 白名单里** → 全部是 `INVALID_HOST`（主机比较忽略大小写）。
     - `dimensions`：缺失 → `EMPTY_NOT_ALLOWED`；不是整数（例如 `1.5`、字符串）→ `NOT_AN_INTEGER`；不在 1 到 8192 → `OUT_OF_RANGE`。
     - 档位字段：`topK` 1-100、`recencyChannelCount` 0-100、`consolidationThreshold` 1-100000，越界 `OUT_OF_RANGE`，不是整数 `NOT_AN_INTEGER`；两个布尔字段不是布尔 → `NOT_BOOLEAN`。`ref` 都是字段名。
     - 检查顺序（注册模型）：名字 → 请求体形状（不认识的字段、null）→ `teiBaseUrl` → `dimensions`。
  3. 记忆服务自己的拒绝：它返回 422 → 400 `INVALID_REQUEST`，**形状不同**：`message` 是它的 `detail` 文字（最多 1000 字符；没有则 "The memory service rejected the request"），`data` 是 `{"detail":"…"}`，没有 `details/ref`；404 → 404 `RESOURCE_NOT_FOUND`（"Memory tier not found" 或 "Embedding model not found"）；409 → 见 137；网络错误、超时、5xx、401 → 502 `MEMORY_SERVICE_ERROR`（"The memory service is unavailable"）。
  4. 指派接口另有：账号不存在 404 "Account not found"；账号 `PENDING_DELETION` → 403 `ACCOUNT_DELETION_SCHEDULED`，`data.scheduledAt`；`DELETING` → 403 `ACCOUNT_DELETING`。
  5. 注意：`memory.tei_allowed_hosts` **没有默认值，没设置时白名单当作空**，此时任何注册都会 400 `INVALID_HOST`。技术人员第一次用之前要先在配置里设置它，页面可以提示。
- 依据：MemoryAdminController.java:51-84；MemoryAdminFacade.java:131-160（返回类型）、:188-228、:260-283、:318-356、:421-445（错误映射）、:447-471（`tierUpdate`、`object`）、:473-500、:503-534（`teiBaseUrl`，:525-531 白名单）、:536-545（`requireName`、`invalid`）；ConfigReasons.java:12-19（reason 取值）；MemoryNames.java；AvatarMemoryTransport.java:175（只有 404/409/422 是"拒绝"，其余失败都走 502）；MemoryRejectedException.java:11-24（detail 最多 1000）；ConfigKeys.java:374-375（`memory.tei_allowed_hosts` 无默认值）；文档 2288（错误映射）、2290（名称规则）、2292（字段命名，含档位字段取值范围、不接受额外字段和显式 null）、2312（`teiBaseUrl`、`dimensions` 校验）、2301。文档没有写三个 PUT 成功时的 `data`，上面是代码行为。
- 和前端暂定做法：一致（成功响应忽略；按字段名对到表单项）。需注意：路径里的名字错误 `ref` 是 `name`、不是表单里的字段名；记忆服务 422 没有 `ref`，只能显示整体错误。
- 改动请求：无
- 核实程度：部分核实（记忆服务返回的 422、409 的 `detail` 具体文字是外部服务产生的，本仓库里看不到）

### 102（记忆服务与监控）`embeddingAssignments` 的顺序，"当前模型"是不是最新的一条
- 答案：
  1. 顺序：`assignedAt` 新的在前（相同时 `id` 倒序），所以第 0 项就是最新的。最多 200 条，`truncated` 表示是否还有更早的，`totalCount` 是该账号指派总数（两个字段总是出现）。
  2. "当前模型"：后端没有自己算"当前模型"。每次指派都是先调记忆服务成功、再写一条记录，所以最新的一条就是最后一次成功指派的模型，也就是记忆服务当前使用的模型（记忆服务没有查询接口，只能这样推）。如果列表为空（`totalCount` 为 0），文档规定该账号用默认模型 `bge-m3`（代码里没有这个字面量，是记忆服务的默认）。
  3. 特例：记忆服务成功但本后端落库失败时，返回 500 且没有记录，这时最新一条会落后于真实情况；重做同一个指派能补上缺失的那一行（记忆服务那一侧的 `PUT` 是幂等的）。但本后端的指派历史不去重：每次成功都新生成一个 id 并插入一行，第一次已经成功后再提交同一个模型名，会多出一行同名记录。
  4. 响应还有 `tier`：`{tierName, syncStatus, assignedAt, lastError}`，账号从未排过同步时整个 `tier` 为 null。
- 依据：MemoryAdminFacade.java:288-315（`accountMemory`）、:159-160；MemoryAdminService.java:25、:42-45；AccountEmbeddingAssignmentRepository.java:31-35（纯 `INSERT`，无 `ON CONFLICT`）、:35-39（`ORDER BY assigned_at DESC, id DESC LIMIT ?`）；MemoryAdminService.java:54-58（`recordAssignment`：每次新生成 id 再插入，无"同模型已是最新一条就跳过"的判断）；MemoryAdminFacade.java:339-354（先调记忆服务、后写行）；文档 2307（默认 `bge-m3`）、2314（顺序、200 条、`truncated`、`totalCount`）、2288（先调用后落库、500 的情形）。
- 和前端暂定做法：一致（按 `assignedAt` 倒序，最新的当作当前；后端返回已经是这个顺序，前端不必再排）。列表为空时前端应显示"默认模型（bge-m3）"。用户重复提交同一个模型，历史里会出现连续多条同名记录，页面不要因此认为数据出错，也不要去重。
- 改动请求：无
- 核实程度：已核实

### 103（记忆服务与监控）能否在管线监控响应里加 `sources`，或提供单独的来源列表接口
- 答案：现在没有。`GET /monitor/pipeline?from=&to=&source=` 的响应只有 `{"items":[...],"truncated":bool}`，每个点带自己的 `source`；没有来源清单，也没有单独的来源接口（在 admin、core 两个模块的主代码里搜 `"sources"`、`DISTINCT source`、`monitor/sources`，监控相关代码里没有命中；命中的只有归因统计里的无关注释）。范围上限 `monitor.max_range_days`（默认 7 天），最多返回最新 `monitor.max_points`（默认 5000）个点，超出时 `truncated=true`，并且是保留最新的点。`source` 参数必须符合 `^[A-Za-z0-9._-]{1,64}$`，否则 400。
- 依据：MonitorAdminController.java:26-31；MonitorTypes（core\...\monitor\api\MonitorTypes.java）里 `PipelineSeries(items, truncated)`；PipelineMetricService.java:127-172（`series`）；PipelineMetricRepository.java:62-86（`newest`）；ConfigKeys.java:447-451（默认 7 天、5000 点）；V1__schema.sql:2514-2516（索引 `effective_at` 与 `(source, effective_at, id)`）；文档 1822-1824、2657-2658。
- 和前端暂定做法：一致（下拉只列见过的来源）。
- 改动请求：建议做。在响应里加 `sources`（字符串数组）：最近 `monitor.max_range_days` 天内有过上报的全部来源，按字母排序，不受请求的 `source` 参数影响。理由：停止上报的来源在短范围里没有点，正是监控最需要看到的；有 `(source, effective_at, id)` 索引，查 7 天内去重来源代价很小；这个接口只有管理后台调用，Android 和 AvatarAgent（上报方走另一条 `POST /api/internal/...` 接口）不受影响。比单独做一个接口好：少一次请求，且与图表同一份数据。
- 核实程度：已核实

### 134（内容审核）`FILE` 类内容响应能否加 `expiresAt`
- 答案：现在没有。`GET /moderation/records/{id}/content` 的 `FILE` 响应是 `{"kind":"FILE","mediaType":"…","url":"<签名地址>"}`，有附带文字时多一个 `text`，没有值的字段不出现；`TEXT` 是 `{"kind":"TEXT","text":"…"}`。签名地址有效期取配置 `moderation.content_url_ttl_seconds`，**默认 300 秒**（5 分钟）。
  - 注意：每次调这个接口（不管是新开还是播放失败后重取）都会写一条审计日志（`MODERATION_CONTENT_VIEW`）。所以前端"每次打开重取，播放失败再取一次"会产生多条审计记录，这是故意的（每次查看都记录），不是 bug。
  - 注意：默认 5 分钟较短，审核员把页面开着不动再去播放就可能已过期。
- 依据：ModerationFacade.java:329-335（`ContentView`，`NON_NULL`）、:344-379（:363-371 FILE 分支与签名；:372-377 审计）；ConfigKeys.java:577（默认 `"300"`）；FileStorage.java:60（`signedGetUrl(key, ttl)`）；文档 2377（响应形状）、857（其他签名地址的响应都带 `expiresAt`）。
- 和前端暂定做法：一致。
- 改动请求：建议做。`FILE` 响应加 `expiresAt`（UTC，= 签发时刻 + `moderation.content_url_ttl_seconds`）。理由：和文档里所有其他签名地址响应（外观、动作片段、渲染模型都带 `expiresAt`）保持一致；前端可以在过期前重取，不必靠播放失败来发现，也就少产生审计记录；一行代码的改动，其他调用方不受影响。
- 核实程度：已核实

### 137（记忆服务与监控）409 `MEMORY_MODEL_CONFLICT` 的 `data` 里能否加整数字段 `registeredDimensions`
- 答案：现在没有。409 的 `message` 是记忆服务返回的 `detail` 英文原文（记忆服务没给就用固定句子 "The embedding model is registered with other dimensions"），`data` 是 `{"detail":"<同一段文字>"}`（没有 detail 时为 `{"detail":null}`）。没有维度字段。
  - 后端在注册之前其实已经读到了这个模型原来登记的维度（为审计日志而读：`GET` 记忆服务的模型列表里找同名的那一项），所以加这个字段不需要多一次调用。
  - 前端现在也有别的办法：`GET /memory/embedding-models` 的每一项就带 `dimensions`，可以在收到 409 后读一次列表。
- 依据：MemoryAdminFacade.java:429-433（409 的 message 与 data）、:260-283（:269-272 先读到 `before`，其 `dimensions()` 即原登记维度）、:143（`ModelItem`）、:246-257；MemoryRejectedException.java:11-24；文档 144（错误码）、2312（"原样展示其 detail"）、2311（模型列表响应带 `dimensions`）。
- 和前端暂定做法：一致（只显示错误码译文）。
- 改动请求：建议做。409 的 `data` 加整数 `registeredDimensions`（来自注册前读到的同名模型；读不到时为 null）。理由：技术人员需要看到原来登记的维度才能决定换哪个名字；数据后端已经有；对其他调用方没有影响，因为这是管理后台专用的错误体，原有的 `detail` 字段保留，向后兼容。
- 核实程度：部分核实（记忆服务 409 的 `detail` 文字本身是否已含维度，是外部服务产生的，本仓库里看不到）

### 140（告警）`GET /alerts` 参数校验失败时 `details` 的 `ref` 是不是参数名
- 答案：是。`status` 或 `type` 不在取值内 → 400 `INVALID_REQUEST`，`data.details = [{"ref":"status"|"type","reason":"OUT_OF_RANGE"}]`。
  - `status` 只认 `OPEN`、`RESOLVED`；`type` 认 18 种告警类型。区分大小写。
  - **空字符串也算一个值**，同样 400（要查全部就不带这个参数）。这一点与客服、删除任务列表不同（它们把空串当作不筛选）。
  - 两个都非法只报 `status`（先检查）。
  - 分页参数非法：`ref` 是 `page` 或 `pageSize`，`reason` 是 `OUT_OF_RANGE`（越界或小于 1、大于 200）或 `NOT_AN_INTEGER`。
- 依据：AlertFacade.java:27、:50-53、:67-74；AlertTypes.java:62-82（`all()` 即 18 种）；AdminPageQuery.java（`invalid`，ref 为参数名）；文档 2390（"`ref` 为 `status`|`type`，`reason` 为 `OUT_OF_RANGE`；空字符串也算一个值，返回 400"）。
- 和前端暂定做法：一致。
- 改动请求：无
- 核实程度：已核实

### 对照复查 10（内容审核）配置键 `moderation.text_rules` 与 `/moderation/text-rules` 是同一份数据吗
- 新版接口文档写法是否变了：内容没变，行号变了。配置表在文档 2630："`moderation.text_rules` … `MODERATION:CONFIG` … 运营维护的规则词表（也可通过 `/moderation/text-rules` 编辑）"；内容审核行在文档 2377："`GET /moderation/text-rules` …；`PUT /moderation/text-rules` … 规则词表，两个方法都需要 `MODERATION:CONFIG`，规则格式见 11.2"。（旧版是 2294、2533。）
- 代码是否这样做：是同一份。`GET` 读的是配置键 `moderation.text_rules`（ModerationFacade.java:426-430）；`PUT` 先校验再通过配置写入服务保存到同一个键 `moderation.text_rules`（ModerationFacade.java:439-470，:468 `configWriter.save(ConfigKeys.MODERATION_TEXT_RULES.key(), …)`），因此会和通用配置接口一样写一条 `CONFIG_UPDATE` 审计并推进配置版本；通用接口 `PUT /api/admin/config/moderation.text_rules` 使用同一个校验器（TextRulesConfigValidator.java:21-41）。权限：两条路由都要求 `MODERATION:CONFIG`（ModerationAdminController.java:80-94）；键的编辑权限也是 `MODERATION:CONFIG`（ConfigKeys.java:378-379）。
  - 两点需要知道的差别：① 通用配置接口的校验要求**每个元素自带 `id`（合法的 UUID）**，而 `/moderation/text-rules` 的 `PUT` 允许不带 `id`、保存时生成（TextRules 的 `Shape.STORED` 与 `Shape.REQUEST`；ModerationAdminIT.java:247-266 的测试 `theGenericConfigRouteUsesTheSameRules`）。② 通用配置接口除了键自己的编辑权限外，持有 `CONFIG:MANAGE` 的管理员也能改（ConfigAdminFacade.java:116-121），而 `/moderation/text-rules` 两个方法只认 `MODERATION:CONFIG`（AdminAccessInterceptor.java:44 按路由注解检查）。
- 结论：仍然正确（同一份数据）。补充上面两点：说"两处编辑权限都是 `MODERATION:CONFIG`"对 `/moderation/text-rules` 成立，对通用配置接口还要加上持有 `CONFIG:MANAGE` 的管理员。
- 核实程度：已核实

## 我发现的、问题表没问到但前端会踩到的坑

1. 内容审核列表不带 `status` 时，会把已通过、已拒绝、已自动拦截（`BLOCKED`）的记录一起按"最老在前"排出来，等于把历史排在前面（ModerationRecordRepository.java:210-220；ModerationFacade.java:219-230）。待处理队列必须带 `status=PENDING_REVIEW`。
2. `{id}` 路径参数的格式不对时，各模块不一致：内容审核（ModerationAdminController.java:50、56、63）、告警（AlertAdminController.java:39）、记忆账号（MemoryAdminController.java:74、82）按 UUID 解析，格式不对返回 400 `INVALID_REQUEST`（只有 message "Invalid value for parameter: id"，没有 `details`，GlobalExceptionHandler.java:143-146）；用户、客服、删除任务（UserAdminFacade.java:585-594；SupportAdminFacade.java:104-113；DeletionAdminFacade.java:193-202）则是 404 `RESOURCE_NOT_FOUND`。前端对"打开一个手改网址里的坏 id"要分别处理。
3. `GET /alerts` 的空串筛选值是 400，而 `GET /support/feedback`、`GET /account-deletions`、`GET /users` 把空串当作"不筛选"（AlertFacade.java:67-73；SupportAdminFacade.java:126-129；DeletionAdminFacade.java:103；UserAdminFacade.java:581-583）。前端筛选下拉的"全部"选项在告警页必须不发参数，不能发空串。
4. 告警关闭的 409 不带 `data.status`（AdminAlertService.java:179），而反馈重试、删除任务重试、审核裁决、封禁/解封的 409 都带。
5. 记忆服务相关的 400 有两种形状：本后端自己校验的是 `data.details[{ref,reason}]`，记忆服务 422 转来的是 `data.detail`（字符串，没有 `ref`）（MemoryAdminFacade.java:434-438 与 :542-545）。`memory.tei_allowed_hosts` 没配置时所有模型注册都是 `INVALID_HOST`（MemoryAdminFacade.java:525-531；ConfigKeys.java:374-375 无默认值）。
6. 投放活动 `PUT` 是整体替换：只改名字而不带 `facebookPixelId` 会把像素编号清空（并因此关闭凭证告警）（CampaignAdminRepository.java:132；CampaignService.java:141-146；文档 1531）。
7. 用户会话行没有 `endReason`（UserAdminFacade.java:181-190），见 59。审核记录统计的 `rejected` 不含"被重新提交顶替关闭"的记录（ModerationRecordRepository.java:270-271），所以 `created` 不等于 `approved + rejected + blocked + 待处理`，页面不要用等式校验。
8. 用户列表 `email` 筛选的值如果不是合法邮箱，返回空结果而不是 400（UserAdminFacade.java:527-532），导出也是空文件；`phone` 不合法才是 400。前端不要把"没有结果"当成"邮箱没有匹配"，也可能是写错了。

## 后端代码与接口文档互相矛盾的地方
没有发现本组问题范围内的矛盾（逐项对照了文档 2288-2314、1531、1611、2376-2377、2389-2390、2409、2630 与代码）。唯一值得标注的是对照复查 10 的两点补充（不是矛盾，是"两处编辑权限都是 MODERATION:CONFIG"的说法对通用配置接口不完整）。

---

# 第 D 部分：subscriptions-credits-cost

共 19 条（18 条待答 + 1 条对照复查）：已核实 17 条，部分核实 2 条（编号 2、30），未核实 0 条；前端要改 7 条（28、30、104、105、106、108、111）；改动请求 6 条（建议做 4：2、69、111、112；建议不做 2：30、70）；接口文档新版已写明主要问点 6 条（28、29、105、106、108、110，其余小问文档没写，以代码为准；104 的请求体、格式、长度契约没写），另加对照复查 1 行。
已按独立核对结果更正：更正 5 处，行号 1 处。

路径简写（本文件内通用）：
- ADM = `D:\Projects\PycharmProjects\AvatarBackend\admin\src\main\java\com\avatarapp\backend\admin`
- COR = `D:\Projects\PycharmProjects\AvatarBackend\core\src\main\java\com\avatarapp\backend\core`
- 契约 = `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md`（新版，e07469d1；下文"契约 N"指该文件第 N 行，问题表里写的旧行号已不适用）
- 所有后台接口的成功响应外层都是 `{"code":"200","message":"success","data":...}`，失败是 `{"code":"<错误码>","message":"...","data":null 或 {details/field/status...}}`（common 模块 ApiResponse.java:5-20）。下文说"返回 X"指 `data` 里的内容。
- 分页列表统一 `page`（默认 1）、`pageSize`（默认 20，上限 200），不合法 400（ADM/web/AdminPageQuery.java:11-30；契约 2372）。

---

### 2（订阅与权益）`GET /subscriptions`、`GET /subscriptions/{id}` 能否只返回购买令牌和关联购买令牌的末 6 位（字段名带 Suffix）
- 答案：
  - 现在不是。两个接口把订阅表的每一列原样返回，`storeRef` 和 `linkedPurchaseToken` 都是完整值，没有任何遮盖，也没有带 `Suffix` 的字段。`storeRef` 在 Apple 是 `originalTransactionId`，在 Google 是 `purchaseToken`（契约 1990）。问题表里说的"购买令牌"在代码里的字段名就是 `storeRef`。
  - 列表接口每项见 `AdminSubscriptionItem`（`storeRef`、`linkedPurchaseToken` 在记录定义的第 4、5 个位置，详情 `AdminSubscriptionView` 里位置相同），详情接口 `AdminSubscriptionView` 多一个 `events` 时间线（时间线不含 payload）。
  - 同一份数据还有第二条出口：`GET /subscription-events` 每行的 `sourceEventId`（Google 事件是 `<purchaseToken>:<eventTimeMillis>:<类型>`，由 `dedupeEventId` 拼出）和 `payload`（入库前只删了 `obfuscatedExternalAccountId` 等账号标识键，没有删 `purchaseToken`）。所以只遮 `/subscriptions` 挡不住令牌，事件接口要同时处理。
  - 契约依据：契约 17.4 通则第 1 条（2434）规定响应字段用实体列名一字不差，不返回的列只有 Hash/Enc 结尾等四类，`Subscription` 的这两列不在其中（1990），所以代码和契约一致，都是完整返回。
- 依据：COR/facade/SubscriptionFacade.java:1058-1080（列表项记录）、1082-1108（详情记录）、1164-1204（详情组装，`r.storeRef()` 1184、`r.linkedPurchaseToken()` 1185）、1293-1315（`item()`）；ADM/controller/SubscriptionAdminController.java:38-56；COR/subscription/adapter/GoogleSubscriptionAdapter.java:85-92（注释写明 sourceEventId 的构成）、432-451（`dedupeEventId`）、160-163（去掉的账号标识键清单）；契约 1971（"持有购买凭证"即可绑定无标识的订阅）、1990、2434。
- 和前端暂定做法：基本一致。前端在抽屉里只显示末 6 位是可行的，但响应里完整令牌仍然存在，前端自己无法藏住（问题表已指出）。字段名现在是 `storeRef`、`linkedPurchaseToken`，没有 `Suffix` 字段。展示事件详情或 `sourceEventId` 列时也要遮。
- 改动请求：建议做。理由：契约 1971 写明持有购买凭证的人可以绑定没有账号标识的订阅，管理员的查看权限用不到完整令牌；做法是 Google 的 `storeRef` 和 `linkedPurchaseToken` 只返回末 6 位（新字段名由契约会话定），Apple 的 `originalTransactionId` 是客服去 App Store Connect 查单用的标识，不是凭据，可以保留；`/subscription-events` 的 `sourceEventId` 和 `payload.subscriptionNotification.purchaseToken` 必须同步遮，否则等于没遮。
- 核实程度：部分核实：`payload` 里带 `purchaseToken` 这一点已读到代码（入库前 `scrub(n.payload())` 只去掉 `appAccountToken`、`obfuscatedExternalAccountId`，COR/facade/SubscriptionFacade.java:505、1002-1019；适配器另去四个账号键，GoogleSubscriptionAdapter.java:161-162，都不含 `purchaseToken`）。无法确认的一点：Apple 的 `originalTransactionId` "不是凭据、可以保留"是对 Apple 商店行为的判断，不是后端代码里能读到的事实，也没有逐行读 Apple 的绑定分支，所以"它不能用来认领订阅"没有证实

### 28（订阅与权益）`PUT /subscription-products` 是单条按 (store, productId) 新增或修改，还是整表替换？`entitlementKey` 不存在是 400 吗
- 答案：
  - 请求体是 `{"items":[{store, productId, entitlementKey, enabled, sortOrder, surfaces}, ...]}`，一次可以带多项。每项按 (store, productId) 新增或更新；请求里没列出的商品保持不动，永远不会被删。所以不是整表替换。前端"PUT 一条"的做法可行，但必须把这一条包进 `items` 数组。
  - 六个字段每项都必填：`enabled`、`sortOrder` 缺了答 400 `EMPTY_NOT_ALLOWED`；`surfaces` 缺了（null）也是 400，空数组 `[]` 才表示"所有端"，不存在"不传就保持不变"。
  - `entitlementKey` 不存在：答 404 `RESOURCE_NOT_FOUND`（message "Entitlement not found"），不是 400。（该服务类自己的注释写的是 400，代码实际是 404，见 EntitlementAdminService.java:583-584 与 590-592；契约 2372 的通用规则"请求里的 ID 找不到对象一律 404"与代码一致。）
  - 同一个请求里同一个 (store, productId) 出现两次：409 `DUPLICATE_RESOURCE`，`data.field` 为 `productId`。
  - 校验失败的字段规则：`store` 必须匹配 `[A-Z][A-Z0-9_]{1,31}`（不限于 APPLE、GOOGLE）；`productId` 去首尾空白后 1 到 255 个码点、不含控制字符；`surfaces` 最多 50 项，每项 `platform` 为 ANDROID 或 IOS，`channel` 可空（空表示该平台所有渠道）。失败一律 400 `INVALID_REQUEST`，`data.details=[{ref, reason}]`。
  - 整个请求在一个事务里，任何一项失败，所有项都不保存。内容没变的项不写库、不写审计。
  - 响应：`PUT` 成功时 `data` 是 `null`，不是 `{items}`。`GET /subscription-products` 才返回 `{"items":[{store, productId, entitlementKey, enabled, sortOrder, surfaces}]}`（六列，没有 id 和时间戳，不分页，按 store、sortOrder、productId 升序）。
- 依据：ADM/controller/SubscriptionProductAdminController.java:19-24（类注释）、38-48（GET/PUT，`ProductsRequest` 在第 36 行）；COR/subscription/service/EntitlementAdminService.java:77-78（正则）、253-285（`validateProducts`）、287-312（`surfaces`）、314-326（`requireText`）、580-655（`upsertProducts`）；COR/facade/EntitlementFacade.java:231-256；COR/subscription/api/EntitlementAdminTypes.java:22-29、52-62；契约 2394（"逐项新增或更新，不删除未列出的商品"、GET 形状）、2372（404 通用规则）。
- 和前端暂定做法：不一致（前端要改：①请求体要写成 `{"items":[那一条]}`；②`PUT` 成功后 `data` 为 `null`，要重新 `GET /subscription-products` 才能拿到最新列表；③`entitlementKey` 不存在时的错误是 404，不是 400）。`GET` 的 `{items}` 形状一致。
- 改动请求：无
- 核实程度：已核实

### 29（订阅与权益）`GET /subscription-events` 每行是不是订阅事件列去掉 payload？status 除 FAILED 外还有什么？"失败"是否等于 error 不为空？对没失败的事件重新处理、对不需要关注的事件点"已处理"是 409 吗？两个接口的响应
- 答案：
  - 每行不是去掉 payload，而是**带** payload：字段是 `id, subscriptionId, accountId, store, sourceEventId, type, subtype, payload, eventSignedAt, receivedAt, processedAt, error, needsAttention, status`。`payload` 是 JSON 对象（不是字符串）。列表带 `total`，按 `receivedAt` 倒序（相同按 id 倒序）。只有订阅详情 `GET /subscriptions/{id}` 里的事件时间线才不含 payload。
  - `status` 有三个值：`PENDING`、`PROCESSED`、`FAILED`。它不是存的列，是算出来的：`processedAt` 不为空是 `PROCESSED`；否则 `error` 不为空是 `FAILED`；两者都空是 `PENDING`。筛选参数 `status` 只接受这三个值，其他值 400（ref `status`，reason `OUT_OF_RANGE`），空字符串也是 400。
  - "失败 = error 不为空"基本成立，精确说法是"没处理过且 error 不为空"。成功处理时代码会同时把 error 清空，所以已处理的行 error 恒为空。`needsAttention` 是另一个独立的标记，可以出现在 PENDING、PROCESSED、FAILED 的行上，不等于失败。会置真的情形有两种：一是事件类型是 `PENDING_REFUND_REVIEW`（Google 的待审核退款通知，入库时按类型置真；类型集合里只有这一个，Apple 没有对应类型）；二是处理时遇到商店不可用、重试到上限后，事件同时得到 `error` 和 `needsAttention=true`（所以 FAILED 的行也可能为真）。
  - `POST /subscription-events/{id}/reprocess`：只要事件没处理过就答 200，`data` 是 `{"id":"<事件id>","status":"QUEUED"}`，把 error 清空并重置重试次数，由后台任务重新处理；所以对 `PENDING` 的行点重新处理也不是 409。对已处理的事件答 409 `INVALID_STATE`，`data.status` 是 `PROCESSED`；事件不存在 404。
  - `POST /subscription-events/{id}/ack`：把 `needsAttention` 置假，成功 `data` 为 `null`。幂等：对本来就不需要关注的事件也是 200（不写审计，也不报 409）；事件不存在 404。同时会把该事件对应的"事件处理失败"告警置为已解决。
  - 权限：读 `SUBSCRIPTION:VIEW`，`reprocess`、`ack` 用 `SUBSCRIPTION:GRANT`。
- 依据：ADM/controller/SubscriptionAdminController.java:58-79；COR/facade/SubscriptionFacade.java:1120-1137（事件项记录）、1143（状态集合）、1207-1233（`adminEvents`）、1245-1265（`reprocess`）、1268-1284（`acknowledge`）、1286-1291（`eventStatus`）；COR/subscription/api/StoreEventTypes.java:80-81（`NEEDS_ATTENTION` 只含 `PENDING_REFUND_REVIEW`）；COR/facade/SubscriptionFacade.java:531（入库时按该集合置 `needsAttention`）；COR/subscription/repository/SubscriptionRepository.java:402-411（重试到上限时 `error` 与 `needs_attention` 同时置上）、341（处理成功同时清 error）、425-431（`requeue`）、434-440（`acknowledgeAttention`）、590（排序）、605-619（状态筛选 SQL，FAILED 为 `processed_at IS NULL AND error IS NOT NULL`）；契约 2394（status 由"已处理、有错误无处理、两者皆无"推出；reprocess 对已处理答 409 `INVALID_STATE`；ack 幂等）、1991（事件实体列）。
- 和前端暂定做法：一致（筛选只提供 `FAILED` 和 `needsAttention=true` 是后端支持范围的子集；只在 `error` 不为空的行显示"重新处理"也不会出错，只是后端也允许对 PENDING 行重新处理）。
- 改动请求：无
- 核实程度：已核实

### 30（额度）额度包 `/credit-products`：GET 形状、有没有 id、PUT 路径和请求体（surfaces 不出现时是保持还是清空）、重复答什么、credits 范围、productId 长度；能否带 updatedAt 并让 PUT 接受 expectedUpdatedAt
- 答案：
  - 路径：`GET /api/admin/credit-products`、`POST /api/admin/credit-products`（新增）、`PUT /api/admin/credit-products`（修改）。**PUT 的路径里没有 id**，商品由请求体里的 `(store, productId)` 指明。没有按 id 的路径，也没有 DELETE。
  - `GET`：返回 `{"items":[{store, productId, credits, enabled, sortOrder, surfaces}]}`，**没有 id**，没有 `total`，没有 `updatedAt`，包含停售的商品，按 `sortOrder`、`store`、`productId` 排序。权限是 `SUBSCRIPTION:CONFIG`（只持有 `SUBSCRIPTION:VIEW` 的人读不了）。
  - `POST` 与 `PUT` 的请求体相同，六个字段都必填：`store`（`[A-Z][A-Z0-9_]{1,31}`）、`productId`、`credits`、`enabled`、`sortOrder`、`surfaces`。`surfaces` 不出现（null）答 400 `EMPTY_NOT_ALLOWED`，不是"保持不变"，也不是"按空数组覆盖"；传 `[]` 才表示所有端。
  - `credits`：整数，1 到 1000000000（十亿，代码取的上界，契约没写）；越界 400 `OUT_OF_RANGE`。`productId`：去首尾空白后 1 到 255 个码点，不含控制字符。
  - 重复：`POST` 一个已存在的 (store, productId) 答 409 `DUPLICATE_RESOURCE`，`data.field` 为 `productId`。`PUT` 一个不存在的商品答 404 `RESOURCE_NOT_FOUND`。
  - 响应：`POST` 的 `data` 是 `{store, productId}`；`PUT` 的 `data` 是 `null`。
  - `updatedAt`/`expectedUpdatedAt`：目前没有。数据库表有 `updated_at` 列，但接口不返回，`PUT` 也不比较。两个管理员同时改同一个额度包，后保存的覆盖先保存的（最后写入者胜）；每次真实修改会写一条审计，记录变更前后的值，所以覆盖可追溯。
- 依据：ADM/controller/CreditAdminController.java:46-69；COR/credit/api/CreditAdminTypes.java:34-53；COR/credit/service/CreditProductService.java:43-45、97-163（校验）、165-174（`create`，重复）、176-197（`update`，不存在）、81-86；COR/credit/repository/CreditRepository.java:385-390（排序）；COR/facade/CreditFacade.java:436-489（含审计，仅在真有变化时写）；COR/credit/service/CreditInputs.java:23（上界）；core/src/main/resources/db/migration/V1__schema.sql:1441-1456（表有 updated_at）；契约 2175（`CreditProduct` 列）、2247（"增改查"）、2395（权限 `SUBSCRIPTION:CONFIG`）。
- 和前端暂定做法：不一致（前端要改：①没有 `PUT /credit-products/{id}`，改成 `PUT /credit-products`，请求体带 `store`、`productId`、`credits`、`enabled`、`sortOrder`、`surfaces` 六项；②`GET` 的行没有 id，前端要以 `(store, productId)` 作为行标识；③`surfaces` 必须带，保存前要把读到的值原样回传；④读这个页面要 `SUBSCRIPTION:CONFIG`）。"保存前重读比较"这一做法仍然可用，因为后端没有并发保护。
- 改动请求：建议不做（带 `expectedUpdatedAt`）。理由：后台没有按 `updatedAt` 做的乐观锁比较（在 admin、core、common 的 `.java`、`.sql`、`.xml` 里搜了 `expectedUpdatedAt`、`If-Match`、`IfMatch`、`expectedVersion`，0 处命中；广告计划、广告素材的修改只有按预期状态做的条件更新，是状态比较，不是 `updatedAt` 比较，见 COR/ad/repository/AdAdminRepository.java:202-215、537-568；额度包 `PUT /credit-products` 本身没有任何比较，COR/facade/CreditFacade.java:463-489），单独给额度包加一个会让后台的写法不统一；这个页面写入权限的持有人很少，且每次修改都有前后值审计；真要做应在契约里对所有"整行覆盖"的后台写接口统一规定。
- 核实程度：部分核实：额度包接口的各项和上面的搜索结果（0 处命中）已核实；没有逐个读完后台所有 PUT 接口，所以不断言"后台所有 PUT 都没有任何并发比较"，只确认没有按 `updatedAt` 做的乐观锁

### 31（成本）`GET /stats/usage-cost` 的 costAmount、quantity 能否像价格一样用十进制字符串返回
- 答案：现在就是字符串，不需要改。`costAmount` 和 `quantity` 都是十进制字符串（去掉小数末尾多余的 0，例如 `"24.99"`、`"0"`），为空时是 `null`：`quantity` 对 LLM 行可能为 `null`；"未定价"那一行（`currency=NONE`）的 `costAmount` 恒为 `null`。`requests`、`unpricedRequests` 是不可空的 JSON 整数；`inputTokens`、`cachedInputTokens`、`outputTokens` 是可空整数，只有 `LLM` 行有值，非 LLM 行是 `null`（与 `quantity` 相反，`quantity` 对 `LLM` 行为 `null`）。前端要把这三列定义成"整数或 null"，汇总时把 `null` 当作"没有"，不能当 0 显示。注意：这里的字符串去掉了末尾的 0，而 `/usage/prices` 的价格字符串保留 10 位小数（例如 `"0.0000000000"`），两处写法不同，前端用文字做精确加法时不要依赖位数。
- 依据：COR/stats/api/StatReportRows.java:134-150（字段类型 `String quantity`、`String costAmount`；`Long inputTokens, Long cachedInputTokens, Long outputTokens` 在 145-147）；COR/stats/service/UsageCostLander.java:92-95（非 LLM 行三个 token 列落 `null`，LLM 行 `quantity` 落 `null`）；COR/stats/service/StatQueryService.java:273-345（组装与 `plain` 去零，未定价行置空在 326-327 附近）；core/src/main/resources/db/migration/V1__schema.sql:3291-3309（`quantity numeric(38,12) NULL`、`cost_amount numeric(30,10) NULL`）；权限 `COST:VIEW`：ADM/controller/StatsAdminController.java:159-178。契约 2778、2832、1924 只写了列名，**没有写**这两列是字符串，建议契约补一句。
- 和前端暂定做法：对 `costAmount`、`quantity` 一致（"两种都收"够用，实际只会收到字符串或 null）；`inputTokens`、`cachedInputTokens`、`outputTokens` 要按"整数或 null"处理。
- 改动请求：无（现状已满足；仅建议契约补写类型）
- 核实程度：已核实

### 32（成本）非 LLM 批次的 `unitPrice` 在 `GET /usage/prices`、待审批次接口（含 `active` 那份）里是字符串还是数
- 答案：字符串。三个接口的批次都由同一个函数组装：LLM 批次的 `bands[].inputPrice/cachedInputPrice/outputPrice` 是字符串，`unitPrice` 为 `null`；非 LLM 批次 `unitPrice` 是字符串，`bands` 为 `null`。字符串固定 10 位小数（数据库是 `numeric(20,10)`），例如 `0` 返回 `"0.0000000000"`。待审批次里嵌套的 `active` 用同一个函数，所以也是字符串。接口里数字类型的只有 `bands[].inputMinTokens`、`inputMaxTokens`（整数）。
- 依据：ADM/facade/UsageAdminFacade.java:200-223（`item()`，`plain(r.unitPrice())`）、225-248（待审批次，`active` 由 `item()` 生成，第 120 行）、250-259（`bands`）、274-277（`plain` = `toPlainString`）；COR/monitor/api/UsageAdminTypes.java:17-44、50-70（字段类型均为 `String`）；测试 admin/src/test/java/com/avatarapp/backend/admin/UsageAdminIT.java:356-359（`unitPrice` 传 0，响应 `"0.0000000000"`）。契约：2469 同一段里既写"其他类型 `unitPrice` 是数"，又写"价格一律是字符串形式的十进制数"，前后矛盾，代码取后者。
- 和前端暂定做法：一致（字符串原样保留是对的；"数"那一支永远不会出现）。
- 改动请求：无（契约 2469 的"是数"三个字需要契约会话改正）
- 核实程度：已核实

### 68（订阅与权益）`GET /subscriptions` 的筛选参数是不是 `accountId`、`state`、`store`、`productId`
- 答案：是，这四个名字，外加分页的 `page`、`pageSize`。校验：`accountId` 必须是标准写法的 UUID，否则 400（ref `accountId`，reason `OUT_OF_RANGE`）；`state` 必须是 `PENDING, ACTIVE, CANCELED, IN_GRACE_PERIOD, ON_HOLD, PAUSED, EXPIRED, REVOKED` 之一；`store` 目前只接受 `APPLE`、`GOOGLE`；`productId` 精确匹配，不去空白。**参数传空字符串不会被当作"不筛选"**：`accountId=`、`state=`、`store=` 会得到 400，`productId=` 会筛出 0 行，所以前端"空值不发"是必须的。排序：创建时间倒序（相同按 id 倒序）。
- 依据：ADM/controller/SubscriptionAdminController.java:38-49；COR/facade/SubscriptionFacade.java:1146-1162、1327-1340（`uuidParam`，含空串→400）、1342-1346；COR/subscription/api/SubscriptionState.java:8-16；COR/subscription/api/Store.java:7-9；COR/subscription/repository/SubscriptionRepository.java:540-575。契约 2394 只写"按账号、状态、商店、商品筛选"，**没有写参数名**，参数名以代码为准。
- 和前端暂定做法：一致
- 改动请求：无
- 核实程度：已核实

### 69（成本）`/usage/models` 能否加 `hasActivePrice=false`、`resourceType` 筛选
- 答案：现在不能。`GET /usage/models` 只认 `page`、`pageSize`，没有任何筛选参数；每项带 `hasActivePrice`（布尔：任一计量单位上今天有生效的 ACTIVE 批次），按 `resourceType, provider, model` 升序，响应 `{items, total}`。`pageSize` 最大 200（超过 400，不会截断）。与之相对，`GET /usage/prices` 有筛选：`resourceType`、`provider`、`model`、`unit`、`status`，值不在枚举内或传空串都是 400。待审批次 `GET /usage/price-batches/pending` 不分页，最多 1000 批。
- 依据：ADM/controller/UsageAdminController.java:41-64；ADM/facade/UsageAdminFacade.java:83-132；COR/monitor/repository/UsageModelRepository.java:141（`ORDER BY resource_type, provider, model LIMIT ? OFFSET ?`）；COR/monitor/service/PriceTableService.java:61-62、442-450；契约 1920-1922、2469。
- 和前端暂定做法：一致（`pageSize=200` 逐页读、在前端筛选可行；最多 50 页对应上限 10000 条）。
- 改动请求：建议做。理由：在服务端按 `resourceType` 和 `hasActivePrice` 筛选分页列表是后台列表的通行做法，是纯新增参数（不影响别的调用方），值不合法时与 `/usage/prices` 一样答 400；前端虽有逐页读取的办法，但模型登记会随用量增长。
- 核实程度：已核实

### 70（成本）`PUT /config/attribution.cost_currency` 收到格式不对的币种（usd、euro、US、空串）是否拒绝、答什么、reason 能否不用 `OUT_OF_RANGE`？小写拒绝还是改大写？`ZZZ` 是否拒绝？用量价格的允许币种列表是否也管这个键
- 答案：
  - 是否拒绝：拒绝。这个键的规则是"字符串，必须整串匹配 `^[A-Z]{3}$`"，不去空白、不转大小写。`usd`、`euro`、`US`、`" USD"`（带空格）都拒绝，答 400 `INVALID_REQUEST`，message 为 `Invalid value for attribution.cost_currency`，`data.details=[{"ref":"attribution.cost_currency","reason":"OUT_OF_RANGE"}]`。
  - 空串 `""`（以及 `value` 为 null）：400，reason 是 `EMPTY_NOT_ALLOWED`。不是字符串的值（数字、布尔等）：reason `OUT_OF_RANGE`。
  - 小写：拒绝，不会自动改成大写。
  - `ZZZ`：**接受**。代码只检查"三位大写字母"，没有对照 ISO 4217 的币种清单（契约 2581 写的是"ISO 4217 三位字母"，代码比契约宽）。
  - 与"已有投放成本不能改币种"的关系：两种拒绝的 `ref`、`reason` 完全相同（都是 `attribution.cost_currency` + `OUT_OF_RANGE`），只有 message 不同（后者是 `attribution.cost_currency cannot be changed from X to Y because cost rows exist ...`）。检查顺序是先查格式，格式通过后才查"是否已有成本行"，所以格式不对的请求永远得到上面第一种答案。保存与当前相同的值始终通过。
  - 用量价格的允许币种列表 `usage_price.allowed_currencies`：与这个键无关，只管价格行的币种（手填和确认批次），它和 `usage_price.default_currency` 之间有一条互相包含的校验，但不涉及 `attribution.cost_currency`。
- 依据：COR/shared/config/ConfigKeyTypes.java:66、72、407（`string("attribution.cost_currency","USD").pattern(CURRENCY).domainValidator("T2")`）；COR/shared/config/ConfigKeySpec.java:161-168、223-258（字符串检查：非字符串→`OUT_OF_RANGE`，空串→`EMPTY_NOT_ALLOWED`，不匹配→`patternReason()`=`OUT_OF_RANGE`，289-291）；COR/shared/config/ConfigValidator.java:137-148（格式不过就抛错，后面的阶段不再执行）、211-223（details 的形状）；COR/attribution/service/AttributionConfigValidator.java:103-112（成本行检查）；ADM/controller/ConfigAdminController.java:52-56、64-78；ConfigValidator.java:380-386（允许币种与默认币种的关系）；契约 112（`PUT /config/{key}` 的 `ref` 是配置键）、1535、2581。
- 和前端暂定做法：一致（三位大写字母、提交前拦住与后端同一规则）。前端的"一律解释为已有成本行"不可靠：格式不对时后端也是同一个 reason；只要前端提前拦住格式，剩下的 `OUT_OF_RANGE` 才可解释为"已有成本行"。
- 改动请求：建议不做（改 reason、拒绝 `ZZZ`）。理由：契约 112 里 `PUT /config/{key}` 的值校验 reason 是一个封闭集合，格式类问题统一用 `OUT_OF_RANGE`，契约 1535 又把"已有成本行"也定为 `OUT_OF_RANGE`，单独加新代码要改契约；前端已提前校验格式，冲突不会发生；拒绝 `ZZZ` 需要维护一份币种清单，收益很小。
- 核实程度：已核实

### 104（订阅与权益）`POST/PUT /entitlement-defs` 的请求体、key 与 name 的格式长度、key 重复是否 409 且 `data.field` 为 `key`、响应形状
- 答案：
  - `POST /entitlement-defs`：请求体 `{key, name, priority}`，成功 `data` 是 `{"key":"<key>"}`。
  - `PUT /entitlement-defs/{key}`：请求体 `{name, priority}`（体里带 `key` 会被忽略，以路径为准），成功 `data` 为 `null`；路径上的权益不存在 404。
  - `key`（只在创建时检查）：1 到 64 个字符，首字符是字母或数字，其后可以是字母、数字、`.`、`_`、`-`（正则 `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`），不符合 400（ref `key`，`OUT_OF_RANGE`）。
  - `name`：去首尾空白后 1 到 100 个码点，不含控制字符；空 400 `EMPTY_NOT_ALLOWED`，超长 400 `TOO_LONG`。
  - `priority`：必填整数（缺了 400 `EMPTY_NOT_ALLOWED`），代码对取值范围没有限制（负数、0 都可）。`priority` 全表唯一。
  - 重复：409 `DUPLICATE_RESOURCE`，`data.field` 是 `key` 或 `priority`，message 为 `The entitlement key already exists` / `The entitlement priority already exists`。判断方式：冲突后查哪个权益占着这个 `priority`，占着的不是当前 key 就报 `priority`，否则报 `key`。因此"key 已存在、同时 priority 被另一个权益占用"时报 `priority`，改完 priority 再保存才会报 `key`。
  - `GET /entitlement-defs`：`{"items":[{key, name, priority, features:[{featureKey, mode, value}]}]}`，按 `priority` 升序，`features` 列出所有已声明的开关（按 `featureKey` 升序，没有配置行时 `mode` 是 `UNSET`）。权限 `SUBSCRIPTION:VIEW` 或 `SUBSCRIPTION:GRANT`，写入权限 `SUBSCRIPTION:CONFIG`。
- 依据：ADM/controller/EntitlementAdminController.java:41-42、56-76；COR/subscription/service/EntitlementAdminService.java:73、77、209-218（`validateDef`）、314-326、343-358（`defs()`）、476-511（`writeDef` 与重复判断）；COR/facade/EntitlementFacade.java:127-128、141-167；契约 151（`DUPLICATE_RESOURCE` 行，列出了权益的 `priority`）、1987、2394、2449（`GET` 形状）。契约没有写创建/修改的请求体、`key`/`name` 的格式长度，也没有明说 `key` 重复的 `data.field`（代码给 `key`，与"`data.field` 写明是哪个字段"的总规则一致）。
- 和前端暂定做法：不一致（前端要改：可以补预检，`key` 匹配 `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` 且创建后不可改，`name` 去空白后 1 到 100 个码点；`priority` 之外的取值范围后端不限制；两种重复都要处理 `data.field` 为 `key` 或 `priority`）。只检查非空和整数不会出错，只是更多错误要靠后端的 400 展示。
- 改动请求：无
- 核实程度：已核实

### 105（订阅与权益）`PUT /feature-gates/{key}/credit-cost` 请求体是否 `{"creditCost": 整数或 null}`？除 `avatar.looks_max`、`credits.period_grant` 之外不能设置单价的开关是 400 吗？单价取值范围
- 答案：
  - 请求体就是 `{"creditCost": <整数或 null>}`。字段缺失（`{}`）400 `EMPTY_NOT_ALLOWED`（ref `creditCost`），明确写 `null` 表示清除价格，答 200。成功 `data` 为 `null`。开关 key 不存在 404。
  - 非空价格的取值范围：整数（`5.0` 这类小数写法算不是整数，答 `NOT_AN_INTEGER`），最小 1，没有写死的上限（受 64 位整数限制）。小于 1 是 400 `OUT_OF_RANGE`。
  - 哪些开关可以设非空价格：只有 `assets.avatar_max` 和 `assets.voice_max` 两个。规则是"永久型（PERMANENT）的数量上限开关，并且不是 `avatar.looks_max`、`credits.period_grant`"；其余开关（布尔、文本、按周期或终生的额度开关）设非空价格一律答 400 `INVALID_REQUEST`，`data.details=[{"ref":"creditCost","reason":"OUT_OF_RANGE"}]`。清除（`null`）对所有开关都允许。
  - 注意 `avatar.looks_max` 的 `limitScope` 也是 `PERMANENT`，但它被明确排除；`credits.period_grant` 的 `limitScope` 是 `PERIODIC`。所以不能用"`limitScope=PERMANENT`"来判断可编辑。
  - 这个修改不触发配置变更钩子，写审计 `FEATURE_GATE_CREDIT_COST_UPDATE`（前后值）。权限 `SUBSCRIPTION:CONFIG`。
- 依据：ADM/controller/EntitlementAdminController.java:50-51、100-106；COR/subscription/service/EntitlementAdminService.java:220-241；COR/facade/EntitlementFacade.java:210-222；COR/subscription/service/EntitlementMerge.java:33（`NO_BONUS`=`avatar.looks_max`+`credits.period_grant`）；COR/subscription/service/GateRow.java:27-29；COR/subscription/service/FeatureGateRegistry.java:37-98（各开关的 `limitScope`：`assets.avatar_max` 39-43、`assets.voice_max` 44-48、`avatar.looks_max` 50-54、`credits.period_grant` 89-93）；测试 admin/src/test/java/com/avatarapp/backend/admin/EntitlementAdminIT.java:209-227（设置 25、缺字段 400、`null` 清除）；契约 2395（"`avatar.looks_max`、`credits.period_grant` 的 `creditCost` 恒为空，设置非空价格返回 400"）、2014。代码比契约宽松的方向相反，即其他不可购买的开关也一并拒绝，与契约"没有配置的开关不能用额度购买"一致。
- 和前端暂定做法：不一致（前端要改：可编辑的开关不是"所有永久的额度类开关"，而是 `assets.avatar_max`、`assets.voice_max` 两个；用 `kind=LIMIT` 且 `limitScope=PERMANENT` 判断会把 `avatar.looks_max` 也放进来，保存会被拒）。
- 改动请求：无
- 核实程度：已核实

### 106（订阅与权益）限时权益发放与撤销：durationDays 上限、reason 长度、发放响应、撤销要不要理由、撤销非限时权益或已失效的行是否 409
- 答案：
  - 发放 `POST /accounts/{id}/promo-entitlements`，请求体 `{entitlementKey, durationDays, reason}`：
    - `durationDays`：整数，1 到 3650（十年，代码取的上界，契约没写）；缺了 400 `EMPTY_NOT_ALLOWED`，越界 400 `OUT_OF_RANGE`（ref `durationDays`）。
    - `reason`：必填，去首尾空白后 1 到 500 个码点；空 400 `EMPTY_NOT_ALLOWED`，超长 400 `TOO_LONG`。
    - 响应 `data` 是 `{"id":"<权益行 id>"}`。生效区间是 `[现在, 现在+天数)`。
  - 校验顺序：请求体字段 400（`entitlementKey` 缺失→`durationDays`→`reason`）→ 账号不存在 404 → 账号 `PENDING_DELETION` 403 `ACCOUNT_DELETION_SCHEDULED`（`data.scheduledAt`）/ `DELETING` 403 `ACCOUNT_DELETING` → `entitlementKey` 不存在 404 `RESOURCE_NOT_FOUND`（不是 400；代码里方法注释写 400，实际是 404）。封禁账号可以发放。
  - 撤销 `POST /promo-entitlements/{id}/revoke`：不需要请求体，也没有理由字段。该行不存在，或不是限时权益（来源是商店订阅）：404 `RESOURCE_NOT_FOUND`（不是 409）。账号 `DELETING` 403 `ACCOUNT_DELETING`（`PENDING_DELETION` 与封禁账号可以撤销）。该行已不是生效状态（已撤销 `REVOKED` 或已到期 `EXPIRED`）：409 `INVALID_STATE`，`data.status` 为当前状态。成功 `data` 为 `null`。
  - 权限都是 `SUBSCRIPTION:GRANT`，都写审计。
- 依据：ADM/controller/EntitlementAdminController.java:53-54、114-127；COR/facade/EntitlementFacade.java:82-85（`MAX_PROMO_DAYS=3650`、`MAX_REASON=500`）、292-337（发放）、339-373（撤销，`promoRow` 370-373）、412-422（`reason()`）；COR/subscription/service/EntitlementAdminService.java:407-449（`findPromo`、`lockedPromo`、`status()`）；契约 2394（请求体）、2419-2420（账号状态表：发放/撤销的 403 情形）、2453（撤销按钮只对 `source=PROMO` 且 `status=ACTIVE` 显示）；测试 EntitlementAdminIT.java:230 起（发放/撤销用例，未逐行读）。
- 和前端暂定做法：不一致（前端要改：预检 `durationDays` 要加上限 3650；`reason` 1 到 500 码点一致；撤销不带请求体一致）。
- 改动请求：无
- 核实程度：已核实

### 107（订阅与权益）`GET /subscriptions/stats` 同一天、同一商店、同一商品有两种币种时是两行吗
- 答案：不是。结果按 (日期, 商店, 商品) 各一行，一行只有一个 `listPriceAmount` 和 `listPriceCurrency`，取当天该商品**最后一条带价格的事件**的价格和币种（SQL 用 `DISTINCT ON (day, store, product_id)` 按事件时间倒序取一条）。同一天同一商品出现两种币种时，只显示最后一条事件的那种币种，另一种不会出现。每天另有一行合计（`store`、`productId` 为 `null`，`listPriceAmount`/`listPriceCurrency` 为 `null`，`active` 取当天快照）。金额是十进制字符串（去掉末尾 0）。权限是 `FINANCE:VIEW`，不是 `SUBSCRIPTION:VIEW`。
- 依据：COR/stats/repository/StatReportRepository.java:507-619（主查询；价格选择在 552-556，分组键 557-562，输出排序 570）；COR/stats/service/StatQueryService.java:387-433（合计行与明细行的组装，合计行 `null` 价格在 410-411 附近）；COR/stats/api/StatReportRows.java:185-196；ADM/controller/SubscriptionStatsAdminController.java:26-31；契约 2394（`listPriceAmount`、`listPriceCurrency` 的口径）。
- 和前端暂定做法：一致（各行各显示）。注意：行内的币种与金额只代表当天最后一条带价格的事件，不能用它们跨行相加得出"收入"，契约本来也说这是标价不是实收。
- 改动请求：无
- 核实程度：已核实

### 108（额度）调账申请的 `reason`、`note` 长度上限，`ADJUST` 的 `delta` 能否为 0、绝对值是否有上限
- 答案：
  - `reason`（创建申请时）：必填，去首尾空白后 1 到 500 个码点；`note`（审核备注）：通过时可选（空或缺失按没有），驳回时必填；都是去空白后最多 500 个码点，超长 400 `TOO_LONG`，缺失（必填时）400 `EMPTY_NOT_ALLOWED`。
  - `delta`：整数，**不能为 0**（`GRANT` 和 `ADJUST` 都一样，0 答 400 `OUT_OF_RANGE`，ref `delta`）；绝对值最大 1000000000（十亿）；`GRANT` 必须为正；`ADJUST` 可正可负。（十亿是代码取的上界，契约没写。）
  - 其他：`kind` 只能是 `GRANT` 或 `ADJUST`，缺了 400 `EMPTY_NOT_ALLOWED`，其他值 400 `OUT_OF_RANGE`；`accountId` 必填 UUID。创建成功 `data` 是 `{"id":...}`。
- 依据：COR/credit/service/AdjustRequestService.java:47-70；COR/credit/service/CreditInputs.java:16-51（500 码点、十亿上界）；ADM/controller/CreditAdminController.java:46-50、71-76、87-101；COR/facade/CreditFacade.java:493-514、561-562、586-587；契约 2249（`GRANT` 为正，`ADJUST` 可正可负、可使余额为负）、2250（驳回必须带 `note`）、2437（长度按去空白后的码点数计）；契约没有写 500 和十亿。
- 和前端暂定做法：不一致（前端要改：预检 `ADJUST` 不能为 0 一致，但还要加 `GRANT` 必须为正，以及 `delta` 绝对值不超过 1000000000；`reason`、`note` 1 到 500 码点一致，注意 `note` 只在驳回时必填）。
- 改动请求：无
- 核实程度：已核实

### 109（额度）`approve`、`reject` 同时触发多个错误时的检查先后
- 答案（按代码里的先后）：
  - `approve`：①备注超长 400 `TOO_LONG` → ②申请不存在 404 → ③申请人就是审核人 403 `SELF_REVIEW_FORBIDDEN` → ④账号不存在 404 → ⑤账号 `PENDING_DELETION` 403 `ACCOUNT_DELETION_SCHEDULED` / `DELETING` 403 `ACCOUNT_DELETING` → ⑥申请不在 `PENDING` 状态 409 `INVALID_STATE`（`data.status` 是当前状态）。所以对已处理过的申请，若账号正在删除，答的是 403 而不是 409。
  - `reject`：①备注缺失或超长 400 → ②申请不存在 404 → ③申请人就是审核人 403 `SELF_REVIEW_FORBIDDEN` → ④不在 `PENDING` 409 `INVALID_STATE`。驳回**不检查账号状态**（契约状态表也写驳回在任何账号状态下都成功）。
  - 权限（`CREDIT:REVIEW`）在这些之前由拦截器检查，没权限先答 403 `ADMIN_FORBIDDEN`。
- 依据：COR/facade/CreditFacade.java:553-579（approve）、581-599（reject）、601-610（`reviewable`：404 与自审 403）、612-622（`requireAdjustable`）；COR/credit/service/AdjustRequestService.java:84-94（409）；契约 2250、2251、2425（驳回行）、2421（创建、通过的账号状态规则）；契约没有规定先后。
- 和前端暂定做法：一致（只展示后端错误，不依赖先后）。
- 改动请求：无
- 核实程度：已核实

### 110（成本）`PUT /usage/models/{id}` 取消适配器时 `syncAdapter` 传 null 还是空串？为空时 `syncModelId` 还要吗？`syncModelId` 长度上限？对非 LLM 模型设适配器答什么错误
- 答案：
  - 取消适配器：`null`、空串 `""`、不带这个字段，三种效果相同，都会清除适配器。请求体整个缺失也等于清除。
  - `syncAdapter` 非空时只接受 `DASHSCOPE_INTL`，其他值 400 `INVALID_REQUEST`（message `syncAdapter must be empty or DASHSCOPE_INTL`）。
  - `syncModelId` 在适配器为空时**仍然会被存**：传了非空值就保存这个值；不传或只有空白，会被改回模型名 `model`。所以前端"始终发"是对的，而且必须发——如果取消适配器时漏发，运营之前改过的 `syncModelId` 会被重置成模型名。
  - `syncModelId` 长度：去首尾空白后 1 到 128 个码点，不含 NUL；超出 400 `INVALID_REQUEST`（message `syncModelId must be 1 to 128 characters`）。
  - 对非 LLM 模型设置非空适配器：400 `INVALID_REQUEST`，message `syncAdapter can only be set for LLM models`。以上这些 400 都**没有** `data.details`，只有英文 message。
  - 模型 id 不存在 404 `RESOURCE_NOT_FOUND`。检查顺序：适配器取值是否合法（400）→ 模型是否存在（404）→ 是否 LLM（400）。
  - 成功响应：`data` 是更新后的模型整行 `{id, resourceType, provider, model, syncAdapter, syncModelId, firstSeenAt, lastSeenAt, hasActivePrice}`，不是空。
- 依据：COR/monitor/service/PriceTableService.java:361-395；COR/monitor/service/PriceRules.java:98-106；COR/monitor/service/UsageRecordValidator.java:42（`MAX_NAME=128`）；ADM/controller/UsageAdminController.java:93-98；ADM/facade/UsageAdminFacade.java:158-161；COR/monitor/api/UsageAdminTypes.java:75-85、93-94；契约 1909（适配器只能对 LLM 设置，目前只有 `DASHSCOPE_INTL`，其他值 400）、1922。
- 和前端暂定做法：一致（取消发 `null`、`syncModelId` 始终发都对；可补充 `syncModelId` 最长 128 的预检）。
- 改动请求：无
- 核实程度：已核实

### 111（成本）`POST /usage/prices` 成功时 `data` 是什么？档位或价格不合法、确认因档位不连续被拒时 400 的 `ref`、`reason` 是什么（能否给"缺口""重叠"这样的具体码）
- 答案：
  - 成功：`data` 是新建的那一批，形状与 `GET /usage/prices` 的一项相同（`batchId, resourceType, provider, model, unit, effectiveFrom, currency, status, source, confirmedBy…, createdAt, bands, unitPrice`），`status` 是 `ACTIVE`，`source` 是 `MANUAL`，`confirmedBy` 是操作人。同一键同一生效日的旧 `ACTIVE` 批次会同时变成 `SUPERSEDED`。
  - 失败：400 `INVALID_REQUEST`，**只有英文 `message`，`data` 为 `null`，没有 `details`，没有 `ref` 和 `reason`**。`POST /usage/prices` 和 `confirm` 的档位、价格错误都是这样。message 举例：`The first band must start at inputMinTokens 0`；`Each band must start at the previous inputMaxTokens plus 1 (no gap, no overlap)`（缺口与重叠是同一条消息，不区分）；`Only the last band may have no inputMaxTokens`；`The last band must have no inputMaxTokens`；`inputMaxTokens must not be below inputMinTokens`；价格越界 `bands[0].inputPrice must be a decimal from 0 to 1000000 with at most 10 decimal places`（会带出错的字段路径）；`At most N bands are allowed`；币种、日期、`unit` 不对也各有一条 message。
  - 手填时档位按 `inputMinTokens` 排序后再校验，录入顺序无关；价格可传 JSON 数或十进制字符串。
- 依据：ADM/controller/UsageAdminController.java:66-70；ADM/facade/UsageAdminFacade.java:134-140、176-185；COR/monitor/service/PriceTableService.java:106-229（`parseManual` 及各 message）、233-284（`createManual`）、292-323（`confirm`，档位复查在 301-307）；COR/monitor/service/PriceRules.java:53-81（`bandViolation`）、89-96、147-149（`invalid` 只带 message）；common/src/main/java/com/avatarapp/backend/common/web/ApiException.java:29-31（无 data 的构造）；测试 UsageAdminIT.java:419 起（非法输入用例，未逐行读）；契约 1905、1907、1921。契约只写"返回 400"，没写 `ref`、`reason`。
- 和前端暂定做法：不一致（前端要改：后端不会给"有译文的原因"，因为根本没有 `details`；前端只能显示通用句，或直接显示英文 `message`）。
- 改动请求：建议做（给 `details`，但不新增"缺口/重叠"码）。理由：同类后台写接口的校验失败都带 `data.details=[{ref, reason}]`，价格页要逐字段提示；`ref` 可用出错字段的路径（如 `bands[1].inputMinTokens`），`reason` 用已有的 `OUT_OF_RANGE`、`EMPTY_NOT_ALLOWED`、`NOT_AN_INTEGER`；"缺口""重叠"属于新增原因码，而契约 112 的原因码是封闭集合，要加得先改契约，一条 message 已能说明，所以不建议单独加。
- 核实程度：已核实

### 112（成本）确认待审批次因币种不在允许列表被拒时，`data.details` 能否是 `[{"ref":"currency","reason":"OUT_OF_RANGE"}]`（即使请求体没给 currency）
- 答案：现在不能。`POST /usage/price-batches/{batchId}/confirm` 在币种不在 `usage_price.allowed_currencies` 里时答 400 `INVALID_REQUEST`，message 为 `currency must be one of usage_price.allowed_currencies`，`data` 为 `null`，没有 `details`。请求体不带 `currency` 时，检查的是批次自己的币种（批次的币种后来被移出允许列表就会触发），所以确实会出现"请求里没给币种却被拒"的情形，手填 `POST /usage/prices` 同理。
- 依据：COR/monitor/service/PriceTableService.java:222-229（`currency()`）、292-323（`confirm`，币种在 300 行，注释说明请求没给币种也检查批次自己的币种）；COR/monitor/service/PriceRules.java:147-149；契约 1907（"币种须在 `allowed_currencies`"）、2669（手填和确认时不在列表里返回 400）。
- 和前端暂定做法：一致（被拒且无 details 时只显示通用句，正是现状）。
- 改动请求：建议做。理由：与第 111 条同理，后台其他写接口都带 `details`；这里 `ref=currency`、`reason=OUT_OF_RANGE` 都是已有的写法，只改一个抛错点，不影响其他调用方；前端目前只能靠"确认前把币种选项限制在允许列表内"来绕开，但批次自己的币种被移出列表这种情况前端选项拦不住。
- 核实程度：已核实

---

## 对照复查

### 复查 11（成本）价格上限 1000000 由谁检查
- 新版接口文档写法是否变了：没变实质，行号换了。手填价格的校验在契约 1907："三个价格是不小于 0 的十进制数，最多 10 位小数，不大于 1000000"（非 LLM 的 `unitPrice` 规则相同），不合格 400 `INVALID_REQUEST`；"价格一律是字符串形式的十进制数，不经过浮点"在契约 2469。
- 代码是否这样做：是。上限 1000000、最多 10 位小数、不小于 0 都在后端检查，不合格 400 `INVALID_REQUEST`，message 如 `bands[0].inputPrice must be a decimal from 0 to 1000000 with at most 10 decimal places`，没有 `details`；响应里价格是字符串（见第 32 条）。依据：COR/monitor/service/PriceRules.java:18-22、89-96；COR/monitor/service/PriceTableService.java:154-155、165-171；ADM/facade/UsageAdminFacade.java:274-277。
- 结论：仍然正确（前端只检查格式、上限交后端，与分工一致）。需补充一处更正：契约 2469 同一段里"其他类型 `unitPrice` 是数"一句与代码和同段后半句都不符，非 LLM 的 `unitPrice` 实际也是字符串（需契约会话改正）；另外错误里没有 `ref`，前端无法把这条 400 对应到具体输入框，只能显示 message 或通用句。

---

## 我发现的、问题表没问到但前端会踩到的坑

1. 读 `GET /credit-products` 需要 `SUBSCRIPTION:CONFIG`，不是 `SUBSCRIPTION:VIEW`（ADM/controller/CreditAdminController.java:52-56）；而读 `GET /subscription-products` 只要 `SUBSCRIPTION:VIEW`（SubscriptionProductAdminController.java:38-39）。持有只读订阅权限的客服角色进额度包页会得到 403。
2. `GET /subscriptions/stats` 要 `FINANCE:VIEW`，持有 `SUBSCRIPTION:VIEW` 不够（ADM/controller/SubscriptionStatsAdminController.java:26-27；契约 2394 末尾）。
3. 列表筛选传空字符串的行为不一致：`/subscriptions`、`/subscription-events`、`/usage/prices` 传空串会 400（SubscriptionFacade.java:1327-1340 是 `/subscriptions` 的 `uuidParam`，1208-1215 是 `/subscription-events` 的 `status`、`needsAttention` 检查；UsageAdminFacade.java:85-93），而 `/stats/usage-cost` 把空串当作"不筛选"忽略（StatQueryService.java:276-317）。统一规则：前端一律不发空值。
4. 价格字符串位数不同：`/usage/prices` 的价格保留 10 位小数（`"0.0000000000"`，UsageAdminFacade.java:275-277），`/stats/usage-cost` 和 `/subscriptions/stats` 的金额去掉末尾 0（StatQueryService.java:344-346；StatReportRepository.java:587 的 `stripTrailingZeros`）。比较两处数值要用小数比较，不要比字符串。
5. `GET /usage/price-batches/pending` 不分页、没有 `total`，最多返回 1000 批（PriceTableService.java:61-62）。
6. `PUT /usage/models/{id}` 漏发 `syncModelId` 会把已改过的值重置成模型名（PriceTableService.java:381-383），见第 110 条；前端表单必须始终回传当前值。
7. `PUT /entitlement-defs/{key}` 与 `PUT /subscription-products`、`PUT /credit-products` 成功后 `data` 都是 `null`，不会回传保存后的行，前端需要自己重新读取；`POST /entitlement-defs` 回 `{key}`，`POST /credit-products` 回 `{store, productId}`，`POST /credit-adjust-requests` 回 `{id}`。
8. 价格相关的 400（`POST /usage/prices`、`confirm`、`PUT /usage/models/{id}`）没有 `details`，与 `PUT /config/{key}`、权益、额度类接口不同，前端不能统一按 `details` 取字段提示（见第 111、112、110 条）。
9. 有两处代码内部注释与实际行为不符（不是契约与代码的矛盾），前端按行为为准：`EntitlementAdminService.java:582-583` 注释写"未知权益 key 是 400"，实际是 404（590-592 行）；`EntitlementFacade.java:295` 的发放注释同样写"400 for an unknown entitlement"，实际是 404（323-326 行）。

---

# 第 E 部分：push-invite-activity

共 18 条：已核实 17 条，部分核实 1 条（119），未核实 0 条；前端要改 8 条（33、34、35、36、72、73、114、116）；改动请求 4 条（建议做 4、建议不做 0；分别在 12、35、37、114）；接口文档新版已写明 3 条（12、33、114 的事实小问；其余条目新版只写明一部分）。
已按独立核对结果更正：更正 1 处，行号 1 处。

说明：
- 路径简写：`PAF` = `core/src/main/java/com/avatarapp/backend/core/facade/PushAdminFacade.java`；`PTS` = `core/.../push/service/PushTemplateService.java`；`PTaskS` = `core/.../push/service/PushTaskService.java`；`PTR` = `core/.../push/repository/PushTaskRepository.java`；`INV` = `core/.../facade/InviteFacade.java`；`CK` = `core/.../checkin/service/`；`SCHEMA` = `core/src/main/resources/db/migration/V1__schema.sql`。路径都在 `D:\Projects\PycharmProjects\AvatarBackend\` 下，`core/...` 省略的中间部分是 `com/avatarapp/backend/core`。
- “接口文档”指 `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md`（新版），行号是该文件的行号。
- 本组的列表、详情都包在 `{"code","message","data"}` 信封里，下面说的字段都是 `data` 里的字段。分页列表的 `data` 是 `{items, total}`（`PAF:142`、`admin/.../web/AdminPage.java:7`），`pageSize` 默认 20、最大 200，越界是 400（`admin/.../web/AdminPageQuery.java:17-18`）。

---

### 12（推送）`GET /push/records/{id}` 里发送结果的数组叫什么，要不要给令牌末 6 位和平台
- 答案：
  - 数组叫 `deliveries`，不叫 `items`。每一项只有四个字段：`id`、`pushTokenId`、`result`、`sentAt`（`result` 取 `ACCEPTED`、`INVALID_TOKEN`、`FAILED`）。没有 `pushId`（暂定做法里写的 `pushId` 不会出现，不影响）。整个响应是记录自己的列（`id`、`accountId`、`pushType`、`triggerReason`、`localDate`、`timezone`、`createdAt`）加 `deliveries`。记录没有发送结果时 `deliveries` 是空数组 `[]`，不是缺失。
  - 现在不给令牌末 6 位和平台。而且后端就算想给也不能直接连表查：发送结果表的 `push_token_id` 没有外键，推送令牌在 FCM 返回失效（`INVALID_TOKEN`）时、用户注销或会话撤销时会被删掉，所以最需要看的“失效”那几行，令牌行往往已经不在了。
- 依据：`PAF:224`（`DeliveryItem(id, pushTokenId, result, sentAt)`）、`PAF:227-235`（`RecordDetail`）、`PAF:494-512`（读取）；`core/.../push/repository/PushRecordRepository.java:128`、`:170-179`（查询）；`SCHEMA:1967-1976`（发送结果表，只有 `push_delivery_push_fkey`，无令牌外键）；`core/.../push/repository/PushTokenRepository.java:72-96`（删令牌的语句）；对比设备列表的 `tokenSuffix`：`core/.../facade/UserAdminFacade.java:167`、`:390`。接口文档 2381 行写明：“`deliveries`（每项 `id`、`pushTokenId`、`result`、`sentAt`，不含 token 本身）”。
- 和前端暂定做法：一致（数组名 `deliveries`，两种名字都接受也没问题；“没有记录到发送结果”对应 `deliveries` 为空数组）。
- 改动请求：建议做（运营看不出是哪台设备，而失效令牌的行恰恰查不到令牌；做法是发送时把平台和令牌末 6 位随发送结果一起存下来，响应里加 `platform`、`tokenSuffix`，只影响管理后台这一个响应，Android 和 AvatarAgent 不受影响；已有的历史行这两项为 `null`）。
- 核实程度：已核实

### 33（推送）`GET /push/templates` 响应是否保留 `total`、是否分页、有哪些筛选参数
- 答案：
  - 响应是 `{items, missingLocales}`，没有 `total`。不分页：控制器方法只有 `triggerReason`、`locale` 两个参数，没有 `page`、`pageSize`；传了 `page=2` 会被忽略，仍然返回全部模板。
  - 筛选参数两个：`triggerReason`、`locale`，精确匹配，不校验取值（取值不对就是空列表，不是 400）。排序按 `triggerReason`、`locale`、`id`。`missingLocales` 不受这两个筛选影响，永远按全部模板算。
  - `missingLocales` 的形状：`{"daily_recall":[…],"streak_at_risk":[…]}`，两个召回原因各一个数组，列出 `app.supported_locales` 里还没有启用模板的语言。
- 依据：`admin/.../controller/PushAdminController.java:44-49`；`PAF:147-148`（`TemplateList`）、`PAF:243-249`；`core/.../push/repository/PushTemplateRepository.java:86-95`（SQL，排序，不分页）；`PTS:181-188`（`missingLocalesByReason`）。接口文档 2381 行：“`GET /push/templates` 不分页，只有 `items`，可按 `triggerReason`、`locale` 筛选”；`missingLocales` 说明同在 2381 行。
- 和前端暂定做法：不一致（前端要改：模板列表只请求一次，不要翻页。现在的“有 `total` 就读到取够，没有就读到空页为止”会死循环，因为第二页还是返回同样的全部内容，永远不是空页；`pageSize=200` 也可以不传）。
- 改动请求：无
- 核实程度：已核实

### 34（推送）模板与周期推送：`linkType` 为 `NONE` 时 `linkTarget` 传什么、怎样去掉图片、标题正文长度上限
- 答案：
  - `linkType=NONE` 时 `linkTarget` 传空串 `""`、传 `null`、不传，三种都接受，都存成 `null`（响应里 `linkTarget` 为 `null`）。`NONE` 配一个非空的 `linkTarget` 是 400，`ref=linkTarget`、`reason=OUT_OF_RANGE`。`linkType` 不传按 `NONE`。`SCREEN` 要求 `linkTarget` 是已知页面标识，`URL` 要求符合 1.7 链接规则。
  - 去掉图片：`PUT` 里带 `"uploadId": null` 就是去掉（旧的上传记录随即删除）；不带 `uploadId` 或带当前值表示不变；带新的 `uploadId` 表示换图（旧图随即删除）。模板和周期推送都是这样。
  - 标题 1 到 100 个、正文 1 到 500 个码点（码点按去掉首尾空白之后算；一个汉字或一个表情算一个码点，不是 UTF-16 单位）。空白、全是空白、缺失都是 400 `EMPTY_NOT_ALLOWED`；超长是 400 `TOO_LONG`；含 NUL 字符是 400 `INVALID_CHARACTER`。数据库列更宽（标题 200、正文 1000），但接口按 100、500 拒绝。模板、手动任务、周期推送的上限相同。
  - 请求体里图片字段只有 `uploadId`。带 `imageUrl` 会被拒绝（400，`ref=imageUrl`）；带 `imageUploadId` 不会报错，而是被忽略，图片保持不变。响应里的字段名是 `imageUploadId` 和 `imageUrl`（请求叫 `uploadId`，响应叫 `imageUploadId`，两边名字不同）。
  - 模板的 `enabled`：请求里不传按 `false`，`PUT` 也是（整行替换）。
- 依据：`PAF:903-926`（`link`）、`PAF:522-541`（`imageField`）、`PAF:555-565`（`replaceImage`）、`PAF:876-901`（`text`）、`PAF:70-72`（上限常量）、`PAF:593-610`（`templateInput`，含 `enabled` 默认 false）；`core/.../notification/service/NotificationLinkRule.java:34-58`（`NONE` 规则）；响应字段 `PAF:150-162`。接口文档 2381 行写明 `uploadId: null` 去图、`imageUrl` 不接受手填；1389 行（8.4）写明标题 1–100、正文 1–500；1397 行同。
- 和前端暂定做法：不一致（前端要改：标题上限 100、正文上限 500，页面计数和假后端都改，现在假后端按 200、1000 演示；可以加“去掉图片”，发 `uploadId: null`；`PUT` 里模板要带 `enabled`，否则会被当成 `false` 而停用；读响应用 `imageUploadId`/`imageUrl`，请求用 `uploadId`，不要把 GET 到的 `imageUrl` 原样带回 `PUT`；`linkTarget` 传 `""` 或 `null` 都可以）。
- 改动请求：无
- 核实程度：已核实

### 35（推送）召回模板被默认语言规则拒绝时 400 的 `data` 能否加 `case`；`PUT /push/templates/{id}` 是否真的接受 `locale`、`triggerReason`
- 答案：
  - 现在 `data` 只有 `defaultLocale` 和 `reason` 两个字段，没有 `case`。`message` 里的三种句子是英文的，写在 `PTS:221-237`，区分三种情形的变量（`takesItAway`、`others.isEmpty()`）在同一个方法里已经算出来，所以加 `case` 在后端是很小的改动。
  - `PUT` 接受并且**要求**请求体里有 `triggerReason` 和 `locale`：整行替换，这两项缺了就是 400（`EMPTY_NOT_ALLOWED`）。所以改语言、改原因都做得到，情形 3（唯一启用的默认语言模板被改成别的语言）在管理端会出现。改成已存在的（原因，语言）组合是 409 `DUPLICATE_RESOURCE`，`data.field = "locale"`；改成两个召回原因以外的值是 400，`ref=triggerReason`、`reason=OUT_OF_RANGE`。
  - 校验顺序：先看请求体形状（400 `details`），再锁行（404），再换图，再判断召回原因、默认语言规则（400 带 `defaultLocale`、`reason`）、唯一性（409）；同一个事务，任何一步失败都整体回滚，包括图片的占用和删除。
- 依据：`PTS:210-240`（`requireDefaultLanguage`，`data` 只有 `defaultLocale`、`reason`）；`PTS:111-147`（`update`，含 `judgeOld`/`judgeNew`，改原因、改语言的路径）；`PAF:274-294`、`PAF:593-610`（`PUT` 读取 `triggerReason`、`locale`，`requiredString` 对缺失报 `EMPTY_NOT_ALLOWED`）；`PTS:267-272`（409）；`PTS:191-198`。全库搜索 `DEFAULT_MISSING`、`DEFAULT_REQUIRED_BY_OTHERS`：0 处命中。接口文档 2381 行写明 `data` 为 `{"defaultLocale","reason"}`，没有 `case`；3267 行（验收）也只写 `data.defaultLocale`、`data.reason`。
- 和前端暂定做法：不一致（前端要改：`PUT /push/templates/{id}` 必须带 `triggerReason`、`locale`（以及 `title`、`body`、`enabled`）；现在前端“`PUT` 不带这两项”会得到 400。通用句子在没有 `case` 之前可以继续用）。
- 改动请求：建议做（给 `data` 加 `case`，取 `DEFAULT_MISSING`、`DEFAULT_REQUIRED_BY_OTHERS`、`DEFAULT_MOVED_AWAY`；理由：三种情形教运营做的事不同，后端已经知道是哪一种，只加一个字段，错误码、`message`、检查顺序都不变；只有管理后台调用这些接口，不影响 Android 和 AvatarAgent；接口文档 17.4 推送行也需要同步这一个字段）。
- 核实程度：已核实

### 36（邀请与分享）`/invites/share-funnel`、`/share-channels`：没生成汇总的日子是否返回行；`from`、`to` 含两端吗、不传怎么办；`shareChannel` 无渠道时是什么
- 答案：
  - 没有生成汇总的日子不返回行，也不补空行；只返回已经落地的日子，按日期升序（渠道表同一天按 `shareChannel` 排）。当天（UTC）的行在统计落地任务第一次运行之后才会出现。
  - `from`、`to` 都含（SQL 是 `>=` 和 `<=`），按 UTC 日历日，格式 `YYYY-MM-DD`。两个都不传：最近 7 天（含今天，UTC）。只传 `from`：`to` 取 `from` 往后 6 天，最晚到今天；只传 `to`：`from` 取 `to` 往前 6 天。跨度不超过 `stats.max_range_days`（默认 366）。错误：`from` 晚于 `to` 是 400，`ref=from`、`reason=OUT_OF_RANGE`；超过跨度是 400，`ref=to`、`OUT_OF_RANGE`；日期格式不对是 400，`ref` 为 `from` 或 `to`、`OUT_OF_RANGE`。显式传的 `to` 可以晚于今天，不会被拒绝（只是不会有行）。
  - 响应是 `{"items":[…]}`。漏斗行：`statDate`、`sharePv`、`shareUv`、`linkClickPv`、`linkClickUv`、`downloadClickPv`、`downloadClickUv`、`registered`。这 7 个数是可空的：事件来源已过期时（事件日志保留期之后补数），前六个为 `null`，只有 `registered` 有值。渠道行：`statDate`、`shareChannel`、`sharePv`、`shareUv`，都不为空。
  - `shareChannel` 没有渠道时不是空串也不是 `null`，而是字符串 `unknown`（客户端没传、不是文本、或不符合 `^[a-z0-9_]{1,32}$` 都归 `unknown`）。`shareChannel` 筛选参数是精确匹配，不校验格式，没有匹配就是空列表。
  - 只有有分享事件的渠道才有行；一个渠道当天没有分享就没有那一行（要补 0 由前端做）。
- 依据：`admin/.../controller/InviteShareStatsAdminController.java:28-42`；`core/.../stats/service/StatQueryService.java:52-58`（“Rows are the landed days only, ascending”）、`:87-99`（`range`）、`:371-379`；`core/.../stats/repository/StatReportRepository.java:365-401`（SQL，`>=`、`<=`）；`core/.../shared/time/StatsRange.java:47-62`、`:66-83`；`core/.../stats/api/StatReportRows.java:168-178`（行的类型，漏斗各数为 `Long` 可空，渠道各数为 `long`）；`SCHEMA:3358-3376`（`share_channel NOT NULL`，漏斗列可空）；`core/.../stats/service/ShareChannelLander.java:30-45`（归为 `unknown`）；`core/.../stats/service/ShareFunnelLander.java:57-72`（事件过期时只写 `registered`）；`ConfigKeys.java:558-559`（`stats.max_range_days` 默认 366）。接口文档 2385 行（分享漏斗一段）和 2815 行写明范围规则、`{"items":[…]}`、排序、“没有落地的日子不出现”、`shareChannel` 精确匹配；渠道无值时取什么、漏斗数是否可空，新版没写。
- 和前端暂定做法：不一致（前端要改：读漏斗行时 `sharePv` 等六个数要能接受 `null`，显示“—”，不要当 0 参与合计；渠道行的“无渠道”显示 `unknown`，不要等 `null` 或空串；其余——按 `{items}` 读、没有行的日子补 0——一致）。
- 改动请求：无
- 核实程度：已核实

### 37（活动管理）`GET /tasks/configs` 能否带 `hasRecords`；已有记录的配置 `PUT` 带没改的 `taskType`、`targetValue` 算不算改
- 答案：
  - 现在列表和详情都没有 `hasRecords`。配置的响应字段是 `id`、`taskName`、`taskType`、`targetValue`、`rewardCredits`、`description`、`claimTimeoutSeconds`、`sortOrder`、`status`、`createdAt`、`updatedAt`。
  - 带没改的 `taskType`、`targetValue` 不算改。后端把请求值和库里的当前值比较，只有不同才算改；只有“有不同”且“该配置已有任务记录”才返回 409 `TASK_HAS_RECORDS`。所以 `PUT` 可以整条带上这两项原值。
  - 校验和拒绝的顺序：先查配置是否存在（404），再校验请求体（400，例如 `daily_login` 的 `targetValue` 必须是 1），最后才是“改了类型或目标值且已有记录”的 409。
- 依据：`core/.../checkin/api/TaskAdminTypes.java:34-46`（`TaskConfigItem` 没有 `hasRecords`）；`CK/DailyTaskAdminService.java:122-148`（`update`：`:124` 先 404，`:125` 校验，`:126` 比较，`:127` 判断有记录）、`:228-230`；`SCHEMA:2953`（`task_record_task_id_idx`，按 `task_id` 判断是否有记录走索引）。接口文档 4245 行写明 409 `TASK_HAS_RECORDS` 和哪些字段永远能改；“带原值不算改”新版没有明写。
- 和前端暂定做法：一致（不依赖 `hasRecords`，409 后还原并只读也能工作；`PUT` 带原值不会误报）。
- 改动请求：建议做（列表和详情加布尔字段 `hasRecords`；理由：规格要求有记录的配置的类型和目标值只读，现在只能在被 409 拒绝之后才知道；后端按页内的配置编号一次 `EXISTS` 查询即可，`task_record.task_id` 已有索引；只影响管理后台，不影响 Android 和 AvatarAgent）。
- 核实程度：已核实

### 71（推送）`/push/templates/{id}` 的 `{id}` 是实体编号还是 `(triggerReason, locale)`；同一组合再 `POST` 是不是 409
- 答案：
  - `{id}` 是实体编号（UUID，字符串形式的 36 位带横线写法）。路径里不是 UUID 是 400 `INVALID_REQUEST`（没有 `details`）；编号不存在是 404 `RESOURCE_NOT_FOUND`。
  - 同一（`triggerReason`，`locale`）再 `POST` 是 409 `DUPLICATE_RESOURCE`，`data` 是 `{"field":"locale"}`（`PUT` 改成已存在的组合也是同一个 409）。数据库有唯一约束，所以并发也一样。注意校验顺序：启用状态的新模板先过默认语言规则（400），再插入时才碰到唯一约束（409）。
- 依据：`admin/.../controller/PushAdminController.java:58-70`（`@PathVariable UUID id`）；`PTS:78-104`、`:267-272`（409 与 `data.field`）、`:274-276`（404）；`SCHEMA:2014`（`push_template_trigger_locale_key`，`UNIQUE (trigger_reason, locale)`）；`common/.../web/GlobalExceptionHandler.java:143-146`（路径不是 UUID 时的 400）。接口文档 2381 行只写“按 `triggerReason`+`locale`”，没有写路径里是什么，新版没有明写 `{id}`。
- 和前端暂定做法：一致
- 改动请求：无
- 核实程度：已核实

### 72（推送）手动任务：`status` 筛选；立即发送要不要带 `scheduledAt`；`accountIds` 上限和格式；`cancel` 的响应和错误
- 答案：
  - `GET /push/tasks` 支持 `status` 筛选，取值 `PENDING`、`RUNNING`、`DONE`、`CANCELLED`，别的值是 400（`ref=status`、`OUT_OF_RANGE`）。**排序是按创建时间倒序（`createdAt`，再按 `id`），不是按计划时间。**分页 `{items,total}`。每项是任务表的全部列加 `createdByUsername`（管理员已删除时为 `null`，`createdBy` 照旧）；有 `lockedAt`、`cursor`、`note`、`sentCount`、`failedCount`、`finishedAt`、`scheduleId`、`imageUploadId`、`imageUrl` 等。
  - 立即发送：不带 `scheduledAt`（或带 `null`）就是立即，后端填创建时刻。**不要**为“立即”显式带 `scheduledAt`：只要带了而且早于服务器的当前时刻就是 400（`ref=scheduledAt`、`OUT_OF_RANGE`），客户端时钟稍慢、请求在路上耗了时间都会被拒。定时发送带 ISO-8601 且必须带时区偏移的时间（`2026-11-03T10:00:00Z` 或 `+08:00` 都行），不带偏移是 400；晚于年份 9999 末也是 400。
  - `accountIds`：`audience=ACCOUNT_IDS` 时必填，1 到 10000 个，每个是字符串形式的 36 位带横线 UUID；有重复时是 400，`ref` 是那个重复的编号、`reason=DUPLICATE`；格式不对或超过 10000 个是 `ref=accountIds`、`OUT_OF_RANGE`；为空是 `EMPTY_NOT_ALLOWED`。别的受众带了 `accountIds` 是 400 `OUT_OF_RANGE`。`ACCOUNT_IDS` 带 `platforms` 或 `locales`（不为空）也是 400。`platforms` 取 `ANDROID`、`IOS`；`locales` 必须是 `app.supported_locales` 的子集。后端创建时不检查这些账号编号是否存在。
  - `POST /push/tasks/{id}/cancel`：成功时 `data` 是取消之后的整条任务（`status=CANCELLED`，有 `finishedAt`）。可以取消的是 `PENDING` **和 `RUNNING`**（正在发送的任务也能取消，执行器在下一次读状态时停下，已发出的计数保留）；`DONE`、`CANCELLED` 的任务是 409 `INVALID_STATE`，`data` 是 `{"status":"<当前状态>"}`；任务不存在是 404。
- 依据：`PAF:316-333`（`status` 校验，`tasks.page`）、`PTR:123-138`（SQL，`ORDER BY created_at DESC, id DESC`）；`PAF:335-368`（`createTask`：`:347-353` `scheduledAt`，`:821-838` 解析）；`PAF:639-670`（`accountIds`）、`:672-718`（`platforms`、`locales`）、`PAF:612-637`；`PAF:78`（`MAX_ACCOUNT_IDS = 10_000`）；`PAF:370-385`、`PTaskS:77-85`（`cancel`）、`PTR:279-287`（`status IN ('PENDING','RUNNING')`）；`core/.../facade/PushTaskFacade.java:305-311`（执行器看到 `CANCELLED` 就停）；`PAF:164-187`（`TaskItem`）。接口文档 2381 行：“`GET /push/tasks` 可按 `status` 筛选…按 `createdAt` 倒序”；1397 行：`accountIds` 1 到 10000 个、不重复、带 `platforms`/`locales` 的 400、`scheduledAt` 早于当前时刻的 400；1399 行：立即 = 创建时刻。`cancel` 的响应、可取消的状态，新版没写。
- 和前端暂定做法：不一致（前端要改：“取消”按钮对 `PENDING` 和 `RUNNING` 都可以显示，不是只有待发送，前端暂定的“非待发送答 409”与后端不符；其余——立即发送不带 `scheduledAt`、409 `INVALID_STATE` 带 `data.status`——一致。列表按创建时间倒序、不是计划时间，只是告知，问题表里没有对应的前端排序假设）。
- 改动请求：无
- 核实程度：已核实

### 73（邀请与分享）`GET /invites/chain`：嵌套节点形状、`joinedAt` 含义、`maxDepth`、404/400 的 `ref`、会不会截断
- 答案：
  - 请求参数叫 `rootAccountId`（不是 `accountId`）和 `maxDepth`。`maxDepth` 取 1 到 `invite.chain_max_depth`（默认 5）；不传时取 3 与该设置中较小的一个。
  - 响应：`{root:{accountId,label,joinedAt}, children:[…], totalDescendants, maxDepth, truncated}`。`children` 里每个节点形状是 `{accountId, label, joinedAt, children:[…]}`，嵌套的子节点和第一层完全相同（`root` 不带 `children`，`children` 在响应顶层）。没有后代时 `children` 是 `[]`。
  - `joinedAt`：节点是它被邀请时间（邀请记录的 `redeemedAt`）；根账号如果自己也是被邀请人，取它自己的被邀请时间，否则取账号创建时间。`label` 是掩码标识（邮箱或手机号掩码，都没有时是账号编号前 8 位）。
  - 响应里的 `maxDepth` 是实际返回的节点里最深的一层（没有后代时为 0），不是请求的深度。
  - 错误：`rootAccountId` 缺失是 400 `ref=rootAccountId`、`EMPTY_NOT_ALLOWED`；格式不是账号编号是 `INVALID_FORMAT`；`maxDepth` 不是整数是 `ref=maxDepth`、`NOT_AN_INTEGER`，超出 1 到上限是 `OUT_OF_RANGE`（不截断成上限）；账号不存在是 404 `RESOURCE_NOT_FOUND`。
  - 会截断：`children` 最多返回 10000 个节点（按层从浅到深，同一上级下按被邀请时间从早到晚取），超出时 `truncated=true`；`totalDescendants` 是 `maxDepth` 层内的全部后代数，不受截断影响。
- 依据：`admin/.../controller/InviteAdminController.java:63-68`；`INV:606-670`（`chain`，`:610` 节点，`:616-617` 响应，`:629-632` 参数，`:633-636` 404，`:637-639` 根的 `joinedAt`，`:656` 最深层）；`INV:739-751`（`intParam`）、`:753-766`（`uuidParam`）；`core/.../invite/service/InviteQueryService.java:41`（10000）、`:113-146`；`core/.../facade/InviteFacade.java:98-99`（默认 3）。接口文档 2385 行写明形状、`truncated`、`maxDepth`、`joinedAt` 含义、404/400；`ref` 的具体值新版没写。
- 和前端暂定做法：不一致（前端要改：请求参数名用 `rootAccountId`；不能假定“一次画出所有后代”，要读 `truncated`，为 `true` 时提示只显示了前 10000 个节点，并以 `totalDescendants` 作为总数）。
- 改动请求：无
- 核实程度：已核实

### 74（活动管理）签到活动 `name`、任务配置 `taskName` 是包含还是前缀、是否不分大小写；`/tasks/records` 的 `status` 非法值是 400 吗
- 答案：
  - `name`（签到活动列表）和 `taskName`（任务配置列表）都是“包含”匹配，不分大小写（`strpos(lower(…), lower(?)) > 0`），不是前缀。筛选值先去首尾空白，空了就当没传；超过 100 个码点是 400（`TOO_LONG`）；含控制字符是 400。
  - `/tasks/records` 的 `status` 非法值是 400，`ref=status`、`reason=OUT_OF_RANGE`；合法值 `IN_PROGRESS`、`CLAIMABLE`、`REWARDED`、`EXPIRED`。同样，`/tasks/configs` 的 `taskType`（`daily_login`、`call_seconds`、`text_messages`）、`status`（`ENABLED`、`DISABLED`），`/checkin/activities` 的 `lifecycleStatus`（`DRAFT`、`ACTIVE`、`DISABLED`、`ENDED`）非法值都是 400 `OUT_OF_RANGE`。`accountId`、`activityId` 不是编号格式、`from`/`to` 不是 `yyyy-MM-dd`、`from` 晚于 `to` 都是 400（后者 `ref=to`）。
  - 排序：签到活动、任务配置按 `createdAt` 倒序，签到记录按 `createdAt` 倒序，任务记录按 `windowStartAt` 倒序。四个列表都是分页 `{items,total}`，`pageSize` 默认 20、最大 200。
- 依据：`core/.../checkin/repository/CheckinRepository.java:285`、`core/.../checkin/repository/TaskRepository.java:373`（`strpos(lower…)`）；`CK/CheckinInputs.java:72-84`（`optionalText`）、`:108-122`（`oneOf`、`optionalOneOf`）、`:124-135`（`optionalUuid`）、`:140-145`（`dateOrder`）；`admin/.../facade/CheckinAdminFacade.java:63-76`、`:93-120`；`admin/.../facade/DailyTaskAdminFacade.java:46-52`、`:85-96`；`CheckinRepository.java:269`、`:335`；`TaskRepository.java:358`、`:396`（排序）；`CK/TaskTypes.java:16-22`（取值）；`CK/CheckinAdminService.java:46-47`。接口文档 4255 行：“`name`/`taskName` 筛选按部分匹配，忽略大小写”，列表排序也在该行；非法值是否 400 新版没写。
- 和前端暂定做法：一致（分页，`pageSize` 取 10、20、50、100 都在上限 200 以内；筛选框可以放心当“包含，不分大小写”用）。
- 改动请求：无
- 核实程度：已核实

### 113（推送）周期推送：`PUT` 整条替换还是只带 `enabled`；校验失败的 `ref`、`reason`；`DELETE` 之后这一行还在吗
- 答案：
  - `PUT` 是整条替换，不能只带 `enabled`：`audience`、`title`、`body`、`repeat`、`timeOfDay`、`startDate`、`enabled` 都是必填的，缺一个就是 400。图片按 `uploadId` 规则处理（不带 = 不变，`null` = 去掉）。所以前端用启用开关时也要带完整的字段（图片字段可以不带）。
  - 校验失败是 400 `INVALID_REQUEST`，所有问题一次性列在 `data.details`（每项 `{ref, reason}`），`ref` 是字段名：
    - `repeat`：缺失 `EMPTY_NOT_ALLOWED`，不是 `DAILY`/`WEEKLY`/`MONTHLY` 为 `OUT_OF_RANGE`。
    - `daysOfWeek`：`WEEKLY` 时缺失或空数组是 `EMPTY_NOT_ALLOWED`；不是整数数组、有不在 1 到 7 的值、有重复是 `OUT_OF_RANGE`；不是 `WEEKLY` 却带了非空数组也是 `OUT_OF_RANGE`（空数组或 `null` 可以）。
    - `dayOfMonth`：`MONTHLY` 时缺失是 `EMPTY_NOT_ALLOWED`，不是 1 到 31 的整数是 `OUT_OF_RANGE`；不是 `MONTHLY` 却带了非 `null` 的值是 `OUT_OF_RANGE`。
    - `timeOfDay`：缺失 `EMPTY_NOT_ALLOWED`；不是 `HH:mm`（`00:00` 到 `23:59`）是 `OUT_OF_RANGE`。
    - `timezone`：不传或 `null` 取 `UTC`；不是 Java 认识的时区名是 `OUT_OF_RANGE`。
    - `startDate`：缺失 `EMPTY_NOT_ALLOWED`；格式不是 `YYYY-MM-DD` 或不是真实日期是 `OUT_OF_RANGE`。`endDate`：可空，格式错或早于 `startDate` 是 `OUT_OF_RANGE`。
    - `enabled`：缺失 `EMPTY_NOT_ALLOWED`，不是布尔 `NOT_BOOLEAN`。
    - 受众和内容字段的 `ref` 同手动任务（`audience`、`accountIds`、`platforms`、`locales`、`title`、`body`、`linkType`、`linkTarget`）。
  - `DELETE` 是停用，不是删行：这一行仍在列表里，`enabled=false`、`nextRunAt=null`、图片字段（`imageUploadId`、`imageUrl`）变成 `null`（图片上传记录随即删除）；已生成的任务不受影响。不存在的编号是 404。
- 依据：`PAF:423-446`（`updateSchedule`）、`PAF:720-800`（`timing`：`:727-751` `daysOfWeek`，`:753-766` `dayOfMonth`，`:767-770` `timeOfDay`，`:772-781` `timezone`，`:782-786` 起止日期，`:787-795` `enabled`）、`PAF:802-819`（`date`）、`PAF:840-860`（`requiredString`）；`PAF:448-467`（`deleteSchedule`）、`core/.../push/service/PushScheduleService.java:121-150`（`disable`：`enabled=false`、下次运行时间 `null`、图片 `null`）；`PAF:389-397`（列表仍含该行）；`PAF:569-585`（`details` 结构）。接口文档 2381 行：“`DELETE` 等于停用并保留已生成的任务”“`PUT` 是整行替换”；1402 行（周期推送字段）；`ref`/`reason` 的取值新版没写。
- 和前端暂定做法：一致（整条 `PUT`、`ref` 取字段名、`reason` 用 `EMPTY_NOT_ALLOWED`/`OUT_OF_RANGE`；另外还会有 `NOT_BOOLEAN`，前端按钮不会触发）。
- 改动请求：无
- 核实程度：已核实

### 114（推送）`GET /push/records` 要不要按账号、触发原因、本地日期筛选
- 答案：
  - 现在已经支持按 `accountId` 和 `triggerReason` 筛选，两个可以一起用。不支持按本地日期或创建时间筛选。
  - `accountId` 必须是字符串形式的 36 位 UUID，否则 400（`ref=accountId`、`OUT_OF_RANGE`）；`triggerReason` 必须是 `daily_recall`、`streak_at_risk`、`admin`、`system_event` 之一，否则 400（`ref=triggerReason`、`OUT_OF_RANGE`）。排序按创建时间倒序（再按 `id`）；分页 `{items,total}`。每项：`id`、`accountId`、`pushType`、`triggerReason`、`localDate`、`timezone`、`createdAt`。
- 依据：`admin/.../controller/PushAdminController.java:117-124`；`PAF:471-491`；`core/.../push/repository/PushRecordRepository.java:130-156`（筛选 SQL，排序）；`SCHEMA:1964-1965`（`push_record_created_at_idx`，`push_record_account_idx`；`local_date` 只出现在召回当天的唯一索引里，没有单独的索引）。接口文档 2381 行：“`GET /push/records` 可按 `accountId`、`triggerReason` 筛选，…按 `createdAt` 倒序”。
- 和前端暂定做法：不一致（前端要改：页面可以加账号编号和触发原因两个筛选，后端已支持；本地日期筛选后端没有）。
- 改动请求：建议做（加 `from`、`to` 两个按创建时间（UTC 日）筛选的参数，规则同其他报表；理由：运营要查“某天的召回”，按创建时间有现成索引，按 `local_date` 单独过滤没有索引，量大时慢；只影响管理后台，不影响 Android 和 AvatarAgent）。
- 核实程度：已核实

### 115（推送）推送图片上传返回的地址字段叫什么；列表里的 `imageUrl` 是长期地址还是短时效签名地址
- 答案：
  - `POST /uploads/image`（multipart，文件字段叫 `file`）成功返回 `{"uploadId":"…","imageUrl":"…"}`。地址字段叫 `imageUrl`。
  - `imageUrl` 是公开的、不过期的地址：`{PUBLIC_BASE_URL}/public/push-images/{uploadId}`，不是签名地址，没有有效期，可以缓存。只有上传记录被删除（模板、周期推送换图或删除，任务进入终态超过 `push.task_image_retention_days` 天，或上传后未被使用超过 `upload.orphan_hours`）之后这个地址才失效（那时访问得到 404）。同一个 `uploadId` 对应的地址不会变。模板、周期推送、任务各自拥有自己的上传记录，所以任务的图片不受模板换图影响。手动创建任务（`POST /push/tasks`）时不复制：请求里的 `uploadId` 被任务直接占用；复制只发生在周期推送生成任务的时候。一个已经被别的行（模板、周期推送）占用的 `uploadId` 不能再拿来创建任务，会得到 409 `INVALID_STATE`，`data.status = "CONSUMED"`，所以用模板的图片建手动任务时要重新上传一张图拿新的 `uploadId`，不能把模板的 `imageUploadId` 当 `uploadId` 传。
  - 图片类型按文件头判断（JPEG 或 PNG），不信客户端声明的类型；缺 `file` 是 400 `INVALID_REQUEST`，`details` 为 `[{"ref":"file","reason":"EMPTY_NOT_ALLOWED"}]`；文件不合规是 400 `INVALID_FILE`。权限 `PUSH:TEMPLATE` 或 `PUSH:SEND`。
- 依据：`admin/.../controller/UploadAdminController.java:14-34`；`admin/.../facade/UploadAdminFacade.java:59`（`ImageUploadResponse(uploadId, imageUrl)`）、`:66-90`（上传）、`:92-99`（缺 `file` 的 400）、`:102` 起（按文件头判断类型）；`core/.../shared/upload/AdminUploadService.java:84-91`（`urlOf` 文档：“public, non-expiring address”）；`app/.../controller/PublicPushImageController.java:19-36`（`/public/push-images/{uploadId}`）；`PAF:358`（手动建任务时 `consumeImage(…, PUSH_TASK, id)`，直接占用）、`PAF:55`（类注释“never copyAsOwn”）、`PAF:547-553`；`core/.../facade/PushTaskFacade.java:550`、`:562`（`copyAsOwn` 只在周期推送生成任务时调用）；`core/.../shared/upload/DefaultAdminUploadService.java:281-302`（`consume`：已被占用时 409 `INVALID_STATE`、`data.status=CONSUMED`）。接口文档 2381 行：“返回 `uploadId` 和地址”，没写字段名；该行另写“创建 `PushTask`（含由周期推送生成的）时把图片复制成任务自己的一份”，对手动任务与代码不符（手动任务不复制，直接占用）。
- 和前端暂定做法：一致（每次读列表都用新取到的地址也没问题，只是不必这样做；上传响应里除 `uploadId` 外，还可以用 `imageUrl` 作上传后的预览图）。补充：创建手动任务时不能把模板或周期推送正在用的 `uploadId` 传进去，要重新上传。
- 改动请求：无
- 核实程度：已核实

### 116（邀请与分享）`depth-stats` 范围内没有被邀请人时 `avgDepth`、`maxDepth` 是什么；`stats` 的 `limit` 超过 200
- 答案：
  - 没有被邀请人时 `depth-stats` 返回：`depthDistribution: []`（空数组）、`avgDepth: null`、`maxDepth: 0`（数字 0，不是 `null`）、`totalChains: 0`。四个字段都会出现。
  - `GET /invites/stats` 的 `limit`：默认 50，范围 1 到 200，超过 200 是 400（`ref=limit`、`reason=OUT_OF_RANGE`），不是静默取 200；小于 1 也是同样；不是整数是 `NOT_AN_INTEGER`。
  - 顺带：`stats` 里没有邀请人时 `avgInvitesPerInviter` 是 `null`；`daily` 每个 UTC 日一行，没有记录的日子是 0（不缺日）；`ranking` 可以为空数组。
- 依据：`INV:579-604`（`DepthStatsResponse`，`:603` `invitees == 0 ? null`，`:595` 初始 `max = 0`）；`core/.../invite/repository/InviteRecordRepository.java:312-332`（没有行时 `rows` 为空，`totalChains` 为 0）；`INV:93-96`（50、200）、`:546-563`（`stats`，`:549` 取 `limit`，`:556` `avgInvitesPerInviter`）、`:565-573`（`daily` 补零）、`:738-751`（`intParam`，不截断）。接口文档 2385 行：“`limit` 默认 50、上限 200”；`avgInvitesPerInviter` 为 `null` 的情形也在同一行；`depth-stats` 空范围的值新版没写；`limit` 越界的处理新版没写。
- 和前端暂定做法：不一致（前端要改：`maxDepth` 在没有被邀请人时是 `0` 而不是 `null`，要用 `depthDistribution` 为空或 `totalChains === 0` 判断显示“—”，不要只靠 `null`；`limit` 不要传超过 200 的值，传了得到 400）。
- 改动请求：无
- 核实程度：已核实

### 117（邀请与分享）没有发放奖励时 `inviterCreditsGranted`、`inviteeCreditsGranted` 是 0 还是 `null`；`/invites/codes` 有没有筛选；导出 `invite-records` 是否要求同时带 `from`、`to`
- 答案：
  - 这两个字段在 `GET /invites/records` 里是可空的数字。状态是 `PENDING`（还没评估）或 `NOT_ELIGIBLE`（不符合）的记录没有发放，这两个字段是 `null`；`REWARDED` 的记录是发放那一刻记下的金额，某一边金额配置为 0 时那一边是 `0`（不是 `null`）。同样 `rewardReason`、`rewardedAt` 在没发放时为 `null`。
  - `/invites/codes` 没有筛选参数，只有分页（`page`、`pageSize`）。响应每项 `{id, code, ownerAccountId, createdAt}`，`createdAt` 是所有者账号的创建时间，新的在前。`/invites/records` 只有一个筛选 `rewardStatus`（`PENDING`、`REWARDED`、`NOT_ELIGIBLE`，别的值 400），按被邀请时间倒序。
  - 导出 `invite-records`（`GET /stats/export/invite-records`）不要求 `from` 和 `to` 同时带。两个都不传时取最近 7 天；只传一个时另一个相隔 6 天（最晚到今天）；可以带 `rewardStatus`。时间区间按 UTC 日的 `[from 的 00:00:00，to 次日 00:00:00)` 过滤被邀请时间。导出需要同时有 `STATS:EXPORT` 和 `INVITE:VIEW`。
- 依据：`core/.../invite/repository/InviteRecordRepository.java:70-85`（`markRewarded` 写入发放金额，`markNotEligible` 不写）；`SCHEMA:206-218`（`inviter_credits_granted bigint NULL`、`invitee_credits_granted bigint NULL`）；`INV:483-522`（`AdminRecordItem`，`Long` 可空）；`admin/.../controller/InviteAdminController.java:34-45`（`codes` 只有 `AdminPageQuery`，`records` 只有 `rewardStatus`）；`INV:457-480`（`codes`）；`admin/.../facade/StatsAdminFacade.java:254-290`（导出：`:269` 用 `queries.range(query.get("from"), query.get("to"))`，缺的取默认）；`core/.../facade/InviteRecordsExportSource.java:79-91`（`rewardStatus` 取自 `other`，区间取 `params.from()`/`params.to()`）；`core/.../shared/time/StatsRange.java:47-62`。接口文档 2385 行写明字段、`codes` 的形状；2756 行写明 `invite-records` 的区间规则、需要 `INVITE:VIEW` 和 `rewardStatus`；没有发放时这两个字段的值，新版没写。
- 和前端暂定做法：一致（0 显示 0，`null` 显示“—”）。
- 改动请求：无
- 核实程度：已核实

### 118（活动管理）签到活动写接口：`POST/PUT` 请求体字段、`name` 长度上限、状态接口成功时的响应、不允许转换的错误、`DELETE` 的错误
- 答案：
  - 请求体（`POST` 和 `PUT` 相同，`PUT` 整条替换阶梯）：`{name, startDate, endDate, rewards:[{dayNum, rewardCredits, bonusCredits}], confirm}`。`name` 1 到 100 个码点（去首尾空白后算；控制字符 400）；`startDate`、`endDate` 是 `yyyy-MM-dd` 字符串或 `null`（不限），`startDate` 不能晚于 `endDate`（相等可以）；`rewards` 1 到 60 行，`dayNum` 必须恰好是 1 到 N 各出现一次，`rewardCredits`、`bonusCredits` 各 0 到 100000，`bonusCredits` 不传按 0。请求体里没有 `status`：新建的活动一律是 `DRAFT`。`confirm` 只在编辑一个 `ACTIVE` 活动并改变日期范围时才有用。
  - 响应：`POST` 返回活动详情（`ActivityDetail`：列表那些字段加 `lifecycleStatus`、`createdByUsername` 和 `rewards` 阶梯）；`PUT /checkin/activities/{id}` 和 `PUT /checkin/activities/{id}/status` 返回 `{applied, disabledActivities:[{id,name}], activity}`：应用成功是 `applied:true`，`activity` 是详情，`disabledActivities` 是这次被停用的活动；需要确认（和别的 `ACTIVE` 活动日期重叠且 `confirm` 不是 `true`）时是 `applied:false`，`activity` 为 `null`，`disabledActivities` 列出将被停用的活动，什么也没写。
  - 状态接口请求体 `{status, confirm}`，`status` 只能是 `ACTIVE` 或 `DISABLED`（别的值，包括 `DRAFT`、`ENDED`，是 400 `ref=status`、`OUT_OF_RANGE`，缺失是 `EMPTY_NOT_ALLOWED`）。允许的转换：`DRAFT→ACTIVE`、`DISABLED→ACTIVE`、`ACTIVE→DISABLED`；其余（含 `ACTIVE→ACTIVE`、`DRAFT→DISABLED`）都是 409 `INVALID_STATE`，`data` 是 `{"status":"<活动当前的存储状态>"}`。
  - `DELETE`：活动不是 `DRAFT`，或已有签到记录，都是 409 `INVALID_STATE`，`data.status` 是当前存储状态（注意：有签到记录的 `DRAFT` 活动，`data.status` 仍是 `DRAFT`）；成功返回 `data: null`；不存在 404。
  - `lifecycleStatus` 是 `status` 的展示值：`ACTIVE` 且 `endDate` 早于 UTC−12 时区的今天时显示 `ENDED`，库里不存在 `ENDED` 这个存储状态；按钮是否可点要按存储的 `status` 判断。
- 依据：`core/.../checkin/api/CheckinAdminTypes.java:17-27`（输入）、`:33-58`（`ActivityItem`、`ActivityDetail`）、`:72`（`ApplyResult`）；`CK/CheckinAdminService.java:145-155`（`create`）、`:163-184`（`update`）、`:192-223`（`setStatus`，`:195` 只允许 `ACTIVE`/`DISABLED`，`:201-206` 转换表）、`:229-237`（`delete`）、`:261-305`（校验）、`:315-318`（409 的 `data`）、`:85-98`（`lifecycleStatus`）；`CK/CheckinInputs.java:25-43`（上限）；`admin/.../controller/CheckinAdminController.java:57-84`（路由）、`admin/.../facade/CheckinAdminFacade.java:85-95`。接口文档 4231 行写明响应形状、重叠探测时机、`DELETE` 和状态转换的 409 `INVALID_STATE` 带 `data.status`、`status` 非法 400；4229 行写明生命周期；请求体字段名和 `name` 的长度上限新版没有逐项写。
- 和前端暂定做法：一致（按存储状态给按钮；不允许的转换当 409 `INVALID_STATE`）。
- 改动请求：无
- 核实程度：已核实

### 119（活动管理）每日任务写接口：`description` 为空是否接受 `""`；`claimTimeoutSeconds` 下限
- 答案：
  - `description` 传 `""`、只有空白、不传、传 `null`，都接受，都存成 `null`，响应里 `description` 是 `null`（不是 `""`）。非空时去首尾空白后不超过 500 个码点，超过是 400（`ref=description`、`TOO_LONG`），含控制字符是 400。
  - `claimTimeoutSeconds`：不传或 `null` 表示“当天（本地日）内随时可以领取”；传值时最小是 1，`0` 或负数是 400（`ref=claimTimeoutSeconds`、`reason=OUT_OF_RANGE`）。校验里没有设置上限（类型是 32 位整数，超出范围的数大概率在请求体解析时被拒绝，返回不带 `details` 的 400，这一点没有核实）。
  - 其他字段：`taskName` 1 到 100 码点；`taskType` 是 `daily_login`、`call_seconds`、`text_messages` 之一；`targetValue` 1 到 1000000000，`daily_login` 必须是 1；`rewardCredits` 0 到 100000；`sortOrder` 0 到 9999；`status` 可不传（`POST` 不传是 `DISABLED`，`PUT` 不传保持原状）。字段类型不对（例如把数字写成字符串）是不带 `details` 的 400 `INVALID_REQUEST`。
- 依据：`CK/DailyTaskAdminService.java:193-218`（`validate`：`:203` 描述，`:204-208` 下限，`:199` `daily_login`）；`CK/CheckinInputs.java:68-86`（`optionalText`：空串变 `null`，超长 `TOO_LONG`）；`core/.../checkin/api/TaskAdminTypes.java:20-30`（输入类型，`claimTimeoutSeconds` 是 `Integer`）；`common/.../web/GlobalExceptionHandler.java:106-110`（请求体读不懂的 400）。接口文档 4245 行写明 `taskName` ≤ 100、`description` ≤ 500、`claimTimeoutSeconds` 可空；4255 行写明请求体；验收一行 4274 行写明 `claimTimeoutSeconds` 小于 1 → `INVALID_REQUEST`。
- 和前端暂定做法：一致（空描述发 `""` 可以；但读回来是 `null`，表单要把 `null` 显示为空）。
- 改动请求：无
- 核实程度：部分核实：“没有上限”已确认（`TaskAdminTypes.java:20-30` 是 `Integer`，`DailyTaskAdminService.java:204-208` 只检查下限 1）；“超过 32 位整数范围的数是不带 `details` 的 400”只读到请求体读不懂时统一返回 400（`GlobalExceptionHandler.java:106-111`），仓库里没有针对溢出整数的代码或配置，也没运行，所以这一点无法确认

### 120（活动管理）`POST /stats/land/checkin-daily`、`task-daily` 的 `date` 是用户本地日吗；报表的 `to` 和补数的 `date` 最晚可到哪一天
- 答案：
  - 这两个汇总的 `statDate` 是账号本地日（签到的 `checkinDate`、任务的 `taskDate`），所以补数的 `date` 的意思就是“账号本地日”，落地时统计的是本地日等于这个日期的签到或任务记录。
  - 补数 `date` 最晚是今天（UTC）：晚于 UTC 今天是 400（`ref=date`、`reason=OUT_OF_RANGE`，消息“date is in the future”）；缺失是 `EMPTY_NOT_ALLOWED`，格式不对是 `OUT_OF_RANGE`。也就是说 UTC+14 的本地日比 UTC 的今天晚一天时，那一天要等 UTC 到了那个日期才能补；日期选择器的上限按 UTC 今天设。`checkin-daily`、`task-daily` 不属于“完全由事件生成”的名字，没有“来源已过期”的限制，早的日期可以补。
  - 报表（`/stats/checkin/daily-users`、`/stats/checkin/streak-buckets`、`/stats/tasks/summary`、`/stats/tasks/daily`）的 `to`：显式传的 `to` 没有上限检查（可以晚于今天，只是不会有行）；不传时默认的范围最晚到 UTC 今天。跨度不超过 `stats.max_range_days`（默认 366）。
  - 补数成功返回 `{"name":"…","date":"YYYY-MM-DD"}`；拿不到锁（正在落地）是 409 `INVALID_STATE`，`data.status = "LANDING_IN_PROGRESS"`；`name` 不存在是 404。
- 依据：`core/.../stats/service/CheckinDailyLander.java:14-17`、`core/.../stats/service/TaskDailyLander.java:12-16`（本地日）；`core/.../stats/service/StatLandService.java:107-124`（`checkManual`：`:111` 解析，`:112-114` 晚于今天（UTC）的 400，`:115-121` 仅对事件来源的名字做过期检查）、`:218-230`（`parseDate`）；`core/.../stats/api/StatLandNames.java:50-51`（“完全由事件生成”的名字只有 `daily-event`、`share-channel`、`guest-retention`、`reactivation`，不含 `checkin-daily`、`task-daily`）；`admin/.../facade/StatsAdminFacade.java:228-248`（`land`，含拿不到锁的 409）；`core/.../shared/time/StatsRange.java:47-62`（`to` 显式时不检查今天）。接口文档 2759 行写明补数的 `date` 缺失、格式不对或晚于今天（UTC）→ 400，拿不到锁 409 `INVALID_STATE`、`data.status` 为 `LANDING_IN_PROGRESS`；2754 行写明签到、任务两类按账号本地日；2815 行写明默认范围规则；显式 `to` 可晚于今天，新版没写。
- 和前端暂定做法：一致（把所选日子原样发出）；补充：补数的日期选择器上限设为 UTC 今天，报表的 `to` 不需要限制。
- 改动请求：无
- 核实程度：已核实

---

## 对照复查

### 复查行 12（推送）推送执行器停机后，已经发出一部分的任务显示什么状态
- 新版接口文档写法是否变了：没有变，意思相同。8.5 的“执行”一段在 1400 行：“`RUNNING` 任务的 `lockedAt` 早于现在减 `push.task_lease_minutes`（默认 15）时可被任何实例重新认领，从 `PushTask.cursor` … 之后继续…崩溃时最多重发一批；全部处理完置 `DONE`。一次性定时任务错过时间的规则同周期推送：`scheduledAt` 早于现在减 `push.schedule_catchup_minutes` 的置 `CANCELLED`（`PushTask.note=MISSED`）…执行器停止的时间超过 `push.schedule_catchup_minutes` 后恢复时，已进入 `RUNNING` 但一条都没发出（`sentCount`、`failedCount` 为 0）、`scheduledAt` 早于追赶窗口的任务置为 `CANCELLED`、备注 `MISSED`…；已发出过一部分的任务接着发剩下的收件人，已发过的不重发。”（新版比旧版多写了后两句的恢复细节，原先那句的结论仍在。）
- 代码是否这样做：基本这样做。租约过期的 `RUNNING` 任务进候选并被重新认领：`PTR:208`（候选含 `status = 'RUNNING' AND locked_at < ?`）、`PTR:242-243`（`reclaimExpired`）；认领后从游标之后继续、处理完置 `DONE`：`core/.../facade/PushTaskFacade.java:305`（取任务游标）、`:319-321`（没有下一批就 `finish`）。一次性定时任务过期置 `CANCELLED`、`note=MISSED`：`PTR:147-153`（`cancelMissed`，只处理 `PENDING`）、`PushTaskFacade.java:235`。执行器停机超过追赶窗口后，没发出任何东西的 `RUNNING` 任务置 `CANCELLED`/`MISSED`：`PTR:160-166`（`cancelAbandoned`）、`PushTaskFacade.java:222-234`（用心跳判断停机）。已发出一部分的任务不会被取消：`cancelAbandoned` 要求 `cursor IS NULL AND sent_count = 0 AND failed_count = 0`（`PTR:163-164`），已发出过的不满足，所以留在 `RUNNING`，等租约过期后接着发，最终 `DONE`。
- 一处和接口文档字面不同：接口文档只写“`sentCount`、`failedCount` 为 0”，代码还要求 `cursor` 为空（`PTR:164`）。差别只出现在“前几批都没有可发的令牌，所以游标已前进、两个计数仍是 0”的任务：代码不会把它置 `MISSED`，而是接着发。对运营可见的结果几乎没有差别，但两边字面不一致。
- 结论：仍然正确（管理端看到的状态：已发出一部分的任务显示 `RUNNING`（`sentCount` 大于 0）直至接手后变 `DONE`，不会被自动取消；一条都没发出的才显示 `CANCELLED` 且 `note=MISSED`；运营手动取消仍然可以对 `RUNNING` 任务操作，见第 72 条）。需要更正的只有一点：“没发出”在代码里还多一个“游标为空”的条件，见上；建议由改接口文档的会话决定写进文档还是改代码。

---

## 我发现的、问题表没问到但前端会踩到的坑

1. 模板列表不分页，翻页会死循环：`GET /push/templates` 忽略 `page`、`pageSize`，第二页仍是全部内容（`admin/.../controller/PushAdminController.java:44-49`；`PAF:243-249`）。前端“读到空页为止”永远读不完。
2. `PUT /push/templates/{id}` 缺 `enabled` 会被当成 `false`（模板被停用，且可能触发默认语言规则的 400）；缺 `triggerReason`、`locale` 是 400（`PAF:593-610`）。
3. 请求用 `uploadId`、响应用 `imageUploadId`（`PAF:150-162` 对比 `PAF:529-534`）；请求体里带 `imageUrl` 是 400（`PAF:526-528`），带 `imageUploadId` 被静默忽略（图片不变，没有任何报错）。
4. 手动推送任务“立即发送”不要显式带 `scheduledAt`：带了而又早于服务器当前时刻就是 400（`PAF:347-353`）。
5. 手动推送任务的取消，`RUNNING` 的任务也能取消（`PTR:279-287`）；列表是按创建时间倒序，不是计划时间（`PTR:123-128`）。
6. 周期推送停用（`DELETE`）会清掉图片（`imageUploadId`、`imageUrl` 变 `null`），行还在列表里（`core/.../push/service/PushScheduleService.java:121-148`）；停用之后再用 `PUT` 重新启用时，原来的图片已经没有了（图片本来就是可选的），想要图片要重新上传并带新的 `uploadId`。
7. 周期推送 `PUT` 里 `daysOfWeek` 只能在 `WEEKLY` 时给非空数组，`dayOfMonth` 只能在 `MONTHLY` 时给非 `null` 值，否则是 400 `OUT_OF_RANGE`（`PAF:750-751`、`:764-765`）。切换重复方式时要清掉另一个字段。
8. 分享漏斗行里六个事件来源的数（`sharePv` 等）在事件过期后的补数下会是 `null`（`core/.../stats/service/ShareFunnelLander.java:57-72`、`core/.../stats/api/StatReportRows.java:168-176`）。
9. 邀请链接口参数名是 `rootAccountId`（`admin/.../controller/InviteAdminController.java:66`），并且有 `truncated`（`INV:616-617`）。
10. 每日任务配置的 `description` 提交 `""` 读回是 `null`（`CK/CheckinInputs.java:72-86`）；`PUT /tasks/configs/{id}` 的校验顺序是先 404 再 400 再 409（`CK/DailyTaskAdminService.java:124-127`）。
11. 签到活动的 `PUT` 和状态接口返回的是带 `applied` 的包装对象，不是活动本身；活动详情在 `data.activity`（`core/.../checkin/api/CheckinAdminTypes.java:72`），`POST` 才直接返回详情（`CK/CheckinAdminService.java:145-155`、`admin/.../facade/CheckinAdminFacade.java:85-95`）。
12. 请求体字段类型不对（如数字写成字符串）时，签到、任务这几个用类型化请求体的接口返回的是不带 `details` 的 400（`common/.../web/GlobalExceptionHandler.java:106-110`）；而推送的接口是自己逐字段校验，带 `data.details`（`PAF:569-585`）。表单把后端的 `details` 映射到字段时要两种情形都处理。

---

# 第 F 部分：campaign-ads

共 12 条：已核实 10 条，部分核实 2 条，未核实 0 条；前端要改 5 条（38、39、75、76、77）；改动请求 5 项（建议做 4 项：40、75、121 取链接的 400 明细、122；建议不做 1 项：121 只改 enabled）；接口文档新版已写明 2 条（7、76），另有 5 条（38、75、77、121、125）只写明一部分。另有 2 条对照复查：复查 1（IP 掩码）仍然正确，仅有一个边角差异；复查 8（删除计划、单元）仍然正确。

已按独立核对结果更正：更正 1 处，行号 4 处。

说明：所有行号都是我这次打开读过的。后端代码根目录 `D:\Projects\PycharmProjects\AvatarBackend`（下文省略，写作 `admin/…`、`core/…`）；接口文档 `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md`（下文写作"文档第 N 行"，是新版 e07469d1 的行号，和问题表里的旧行号不同）。我没有运行任何测试或构建，"已核实"的意思是读过代码，不是跑过。

先说一个贯穿几条的事实：投放账户、投放成本、点击、效果报表里的 `id`、`campaignId` 在代码里是 Java 的 `long`，序列化成 JSON 数（不是字符串）；应用内广告的所有 `id` 是 UUID 字符串。依据：`admin/src/main/java/com/avatarapp/backend/admin/facade/CampaignCostAdminFacade.java:83-84`（`long id`）、`:108-110`（`long id, long campaignId`）、`admin/…/facade/AttributionClickAdminFacade.java:63-66`（`long campaignId`）、`core/…/attribution/api/PerformanceRows.java:18-19`（`long campaignId`）、`admin/…/facade/AdAdminFacade.java:119-120`（`UUID id`）。我搜了 `ToStringSerializer`、`JsonComponent`、`ValueSerializer`、`write-numbers-as-strings`、各个 `application.yml` / `avatar-shared.yml` 里的 `jackson`，没有任何命中，所以没有把 `long` 统一转成字符串的全局设置。

---

### 7（投放管理）怎样清除已设置的广告平台访问令牌，请求里写 `null` 可以吗
- 答案：可以。保存投放账户（`PUT /attribution/campaigns/{id}`）时，请求体里 `facebookAccessToken` 的三种写法：不写这个字段或写空串 `""` = 保持原来的令牌不变；写 `null` = 清除令牌；写一个 1 到 1024 个可打印 ASCII 字符（不含空格）的字符串 = 替换令牌。清除不需要服务器配置加密密钥（只有"设置新令牌"需要，没有密钥时返回 503 `DEPENDENCY_UNAVAILABLE`）。清除后响应里的 `facebookAccessTokenSet` 变为 `false`。令牌只能在 `PUT` 里清除，`POST`（创建）写 `null` 等于没有令牌。审计日志里记 `tokenCleared`，不记令牌内容。清除一个本来就没设置过的令牌不算"令牌改变"，不会触发待发回传的重置。
- 依据：`core/src/main/java/com/avatarapp/backend/core/attribution/service/CampaignInputs.java:118-134`（空串或缺失 = KEEP，`null` = CLEAR，其他 = SET 且要符合 `TOKEN` 规则）、`:47`（令牌正则）；`admin/…/facade/CampaignCostAdminFacade.java:227-240`（CLEAR 分支不取密钥，SET 分支无密钥时抛 503）；`core/…/service/CampaignService.java:139-140`（清除且原来已设置才算改变）；文档第 1531 行（"`null` = 清除"）。
- 和前端暂定做法：一致（前端"留空表示不修改"与后端相同）。前端现在可以加一个"清除令牌"的确认操作，发 `"facebookAccessToken": null`；不是必须修改。
- 改动请求：无（后端已支持）。
- 核实程度：已核实。

### 38（投放管理）`GET /attribution/performance` 的行字段、数的类型、未归因行出现的条件
- 答案（逐小问）：
  1. 行里标识投放账户和日期的字段：按账户分组（`groupBy=campaign`，默认）的行带 `campaignId`、`campaignCode`、`campaignName`；按日分组（`groupBy=day`）的行带 `statDate`，不带 `campaignId`。所以你们猜的 `campaignId` 和 `statDate` 都对，但 `campaignId` 是 JSON 数（`0` 是未归因，不是字符串 `"0"`）。
  2. 能否直接带 `campaignCode`、`campaignName`：已经带了，在按账户分组的每一行里，直接使用，不必再去投放账户列表里对。极少数情况下（账户标签读不到）这两个字段是 `null`，此时才需要回退到列表对照。
  3. `cost`、`cpa`、`cpi` 是数还是字符串：是 JSON 数（后端字段类型是 `BigDecimal`，没有自定义序列化）。`cost` 固定两位小数（没有成本行时 `0.00`），`cpa`、`cpi` 两位小数，分母为 0 时是 `null`；三个比率 `clickRate`、`installRate`、`registerRate` 是六位小数，分母为 0 时是 `null`。页面收到的是数，不会收到字符串。
  4. "未归因"行是否只在 `groupBy=campaign` 且没选账户时出现：不对。只要请求没带 `campaignId`，最后一行就是未归因行，两种分组方式都有。它的形状固定为 `{"campaignId":0,"unattributedInstalls":N}`，没有别的字段；按日分组时，各日行里没有 `unattributedInstalls`，自然量只在这最后一行（整个范围的合计）。选了 `campaignId` 时没有这一行。判断这一行：按账户分组时看 `campaignId === 0`；按日分组时这一行没有 `statDate` 而有 `unattributedInstalls`。
  5. 导出 `GET /stats/export/attribution-performance`（对应暂定做法里的"导出参数"）：接受 `from`、`to`、`campaignId`、`groupBy`（`campaign` 默认或 `day`），其他参数忽略；列和报表逐列相同，最后一列多一个 `unattributedInstalls`，只在未归因行有值。需要 `STATS:EXPORT` 加 `ATTRIBUTION:VIEW`。
- 依据：`core/src/main/java/com/avatarapp/backend/core/attribution/api/PerformanceRows.java:18-33`（`CampaignItem`，含 `campaignCode`、`campaignName`、`BigDecimal cost/cpa/cpi`）、`:34-47`（`DayItem`：`statDate` 起，没有 `campaignId`）、`:48`（`UnattributedItem(long campaignId, long unattributedInstalls)`）；`core/…/service/PerformanceReportService.java:125-194`（按 `q.campaignId() == null` 追加未归因行，分组方式不参与判断，`:190-192`）、`:210-223`（比率六位、金额两位、分母为 0 给 `null`）；`core/…/facade/PerformanceExportSource.java:22-30, 78-92`（导出参数与列）；`admin/src/test/java/com/avatarapp/backend/admin/PerformanceAdminIT.java:119`（测试里 `cost` 用 `decimalValue()` 断言为 42.50，只有数值节点才成立）、`:134`（按账户分组的未归因行）、`:149`（按日分组时第三项是 `unattributedInstalls`）；文档第 1537 行（写明了字段名 `campaignCode`、`campaignName`、`campaignId=0` 的未归因行、"没有给 `campaignId` 时最后一行"、导出多一列），文档没有写 `cost`/`cpa`/`cpi` 是数还是字符串。
- 和前端暂定做法：不一致。前端要改：(a) `campaignId` 按数处理（比较 `=== 0`，不是 `"0"`）；(b) 直接用行里的 `campaignCode`、`campaignName`，投放账户列表只作回退；(c) 按日分组时也会有最后一行未归因行，要用 `unattributedInstalls` 识别并显示（你们暂定"按日分组不读 `unattributedInstalls`"，会漏掉自然量）；(d) `cost`、`cpa`、`cpi` 收到的是数，不用再兼容字符串；(e) 导出可以发 `groupBy=day`，不必固定 `campaign`。
- 改动请求：无（后端已带编码和名称）。
- 核实程度：部分核实（"JSON 数"是根据字段类型、搜不到全局序列化设置、以及上面测试断言推出的，我没有运行请求看原始响应）。

### 39（应用内广告）创建单元（`POST /ads/units`）收不收 `surfaces`
- 答案（逐小问）：
  1. `GET /ads/units` 的行里带不带 `surfaces`：带。每个单元的响应对象字段是 `id, campaignId, placementId, name, status, targeting, weight, dailyImpressionCap, surfaces`（`GET /ads/units/{id}` 另有 `creatives`）。`surfaces` 是数组，每项 `{"platform":"ANDROID"|"IOS","channel":"<渠道码>"|null}`，空数组 `[]` 表示所有端。
  2. `POST /ads/units` 接不接受：接受。可选字段，缺省或 `null` 或 `[]` = 所有端。校验：必须是数组；每项恰好有 `platform` 和 `channel` 两个键；`platform` 是 `ANDROID` 或 `IOS`；`channel` 是 `null` 或匹配 `[a-z0-9_-]{2,32}` 的字符串；重复项合并；不合格 400 `INVALID_REQUEST`，`details` 为 `[{ref:"surfaces", reason:"OUT_OF_RANGE"}]`。
  3. `PUT /ads/units/{id}` 接不接受：接受（代码接受，但文档写的是只改四个字段，两边不一致，见下）。缺省 = 不变，`null` 或 `[]` = 改成所有端。
  4. 要不要在后台显示和编辑：后端支持，建议显示并可编辑，否则别处创建的"仅安卓"单元在列表里看不出，而 iOS 请求实际被排除（选取时按 `surfaces` 过滤）。
  5. 列表形状：`GET /ads/campaigns`、`/ads/units`、`/ads/creatives` 是 `{"items":[…],"total":N}`，`GET /ads/placements` 是 `{"items":[…]}`（不分页），所以不需要兼容裸数组。
- 依据：`core/src/main/java/com/avatarapp/backend/core/ad/service/AdAdminService.java:388-401`（`createUnit` 读 `surfaces`）、`:447-459`（`updateUnit` 读 `surfaces`，缺省沿用旧值）；`core/…/service/AdInputs.java:342-378`（`surfaces` 的校验）；`admin/…/facade/AdAdminFacade.java:149-162`（`UnitItem` 含 `surfaces`）、`:205-215`（`Items`）；`admin/…/controller/AdAdminController.java:118-146`；`admin/src/main/java/com/avatarapp/backend/admin/web/AdminPage.java:7`（`{items,total}`）；`admin/src/test/java/com/avatarapp/backend/admin/AdAdminApiIT.java:120-130`（单元字段集合含 `surfaces`）；文档第 3622 行（`AdUnit` 含 `surfaces`）、第 3714 行（`PUT` 只改 `name`、`targeting`、`weight`、`dailyImpressionCap`）。
- 和前端暂定做法：不一致。前端要改：单元列表和表单显示 `surfaces`（例如"仅 ANDROID"、"ANDROID/play"），创建和编辑时发送 `surfaces`；响应形状不需要再兼容裸数组。**代码和文档矛盾**：文档第 3714 行写 `PUT` 只改四个字段，代码 `updateUnit` 也接受并保存 `surfaces`（`AdAdminService.java:459`、注释 `:441-446` 写"by R22.10"），需要由改文档的人把 `surfaces` 加进文档，或者通知后端去掉；在改之前前端可以依赖代码的行为。
- 改动请求：无（后端已接受）。
- 核实程度：已核实。

### 40（应用内广告）只有"广告素材"权限的管理员读不到广告位和素材规格
- 答案（现状）：
  1. `GET /ads/placements` 允许的权限是 `ADS:PLACEMENT` 和 `ADS:UNIT`，不含 `ADS:CREATIVE`；只持有 `ADS:CREATIVE` 的管理员调用得 403 `ADMIN_FORBIDDEN`。
  2. `GET /ads/meta` 的响应只有 `{"geoConfigured": true|false}` 一个字段，不含 `creativeAspectTolerancePercent`。允许任一 `ADS:*` 权限调用。
  3. 单元响应里只有 `placementId`，没有广告位的 `slotKey`、形式（`adFormat`）和素材规格三项（`creativeAspect`、`creativeMinShortSide`、`creativeMaxBytes`）。素材响应里也没有。
  4. 容差 `ads.creative_aspect_tolerance_percent` 的编辑权限是 `ADS:PLACEMENT`（所以 `GET /config` 不会给只有 `ADS:CREATIVE` 的管理员），默认值 3。
  所以只有 `ADS:CREATIVE` 时，素材表单确实读不到规格；`GET /ads/units`、`GET /ads/campaigns` 对 `ADS:CREATIVE` 开放，可以拿到 `placementId`，但对不出规格。
- 依据：`admin/src/main/java/com/avatarapp/backend/admin/controller/AdAdminController.java:103-107`（placements 权限）、`:118-127`（units 权限含 `ADS_CREATIVE`）、`:223-233`（meta）；`admin/…/facade/AdAdminFacade.java:212`（`record Meta(boolean geoConfigured)`）、`:444`；`:134-147`（`PlacementItem` 含规格三项）、`:149-162`（`UnitItem` 无广告位字段）；`core/…/shared/config/ConfigKeys.java:606-607`（容差键的编辑权限 `ADS:PLACEMENT`）；文档第 2438 行（通则第 5 条：`GET /ads/placements` 另允许 `ADS:UNIT`）、第 3717 行（meta 只返回 `geoConfigured`）。代码和文档一致。
- 和前端暂定做法：一致（读不到时写明以服务器检查为准，容差用 3%）。
- 改动请求：建议做。做法：`GET /ads/placements` 的读取权限加上 `ADS:CREATIVE`（只读，写入接口权限不变，与通则第 5 条"下拉选项来源接口"同一原则，素材表单正是广告位的使用方），并在 `GET /ads/meta` 加 `creativeAspectTolerancePercent`（整数）。理由：规格校验是服务端强制的，前端读不到规格就只能提交后看 400，运营体验差；两项都是只读加字段，不影响 Android、AvatarAgent；比"在单元响应里带广告位和规格"改动小，且广告位只有四行。（备选 (b) 也可行，但会让单元列表每行带重复数据。）
- 核实程度：已核实。

### 75（投放管理）成本录入：`amount` 类型、不带 `currency`、批量 400 的明细格式、成功响应
- 答案（逐小问）：
  1. `GET /attribution/costs` 的 `amount` 是数还是字符串：JSON 数（`BigDecimal`，固定两位小数，如 `12.50`）。请求里 `amount` 可以发 JSON 数或数字字符串（`"12.5"`），都按小数读，不经过浮点；不能为负，最多两位小数（更多位是错误，不舍入），小于 10^16。注意：返回的 JSON 数最大可以有 18 位有效数字，浏览器解析会丢精度，前端自己限制 13 位整数是合理的。
  2. 响应行的字段（文档没写，代码有）：`id, campaignId, campaignCode, campaignName, statDate, amount, currency, remark, createdBy, createdByUsername, createdAt, updatedAt`。所以成本行里已经带投放账户的编码和名称，不必用 `campaignId` 去对。`statDate` 是 `YYYY-MM-DD` 字符串。
  3. 读不到成本币种时不带 `currency` 行不行：行。单条 `POST`、`PUT` 和批量的每一行，`currency` 缺省或空串都等于 `attribution.cost_currency` 当前值；带了就必须等于它，否则该字段错误 `CURRENCY_MISMATCH`。另外，成本列表的每一行都带 `currency`，`GET /meta` 的字段里没有成本币种。
  4. 批量 400 的 `data.details`：每项是 `{"index": <数组里从 0 起的位置，数>, "ref": "<字段名>", "reason": "<原因码>"}`。注意 `index` 和 `ref` 是两个独立字段，不是 `"2.campaignCode"` 那样拼在一起。行内字段的 `ref` 取 `campaignCode`、`statDate`、`amount`、`currency`、`remark`；元素不是对象时 `ref` 为 `line`、`reason` 为 `INVALID_TYPE`。整批层面的错误没有 `index`：不是数组 `{ref:"body", reason:"INVALID_TYPE"}`；条数超过 `attribution.cost_batch_max` `{ref:"body", reason:"OUT_OF_RANGE"}`（在读任何一行之前）；空数组 `{ref:"body", reason:"REQUIRED"}`；请求体缺失 `REQUIRED`、不是合法 JSON `INVALID_FORMAT`（`ref` 都是 `body`）。原因码：`REQUIRED`、`INVALID_TYPE`、`INVALID_FORMAT`、`TOO_LONG`（remark 超过 500 个码点）、`CONTROL_CHARACTER`、`OUT_OF_RANGE`（金额不小于 10^16）、`NEGATIVE`（金额为负）、`TOO_MANY_DECIMALS`（金额超过两位小数）、`CURRENCY_MISMATCH`、`NOT_FOUND`（`campaignCode` 不存在，或格式就不是合法的投放账户编码）、`DUPLICATE`。批内重复的 `(campaignCode, statDate)`：这一组的每一行都得到 `{index, ref:"campaignCode", reason:"DUPLICATE"}`（不是只标后一行）。所有问题一次列全，整批不写入。
  5. 成功响应是不是 `{imported, overwritten}`：不是。成功响应是 `{"count": N}`，N 是写入的行数（新增加覆盖的总和），没有新增几行、覆盖几行的拆分。
  6. 单条 `POST` 的错误：`campaignId` 指向不存在的账户 → `{ref:"campaignId", reason:"NOT_FOUND"}`；同一账户同一天已有成本 → 409 `COST_EXISTS`；`PUT` 只改 `amount` 和 `remark`，带了不同的 `campaignId`/`statDate`/`currency` → 400，`reason` 是 `IMMUTABLE`。
- 依据：`core/src/main/java/com/avatarapp/backend/core/attribution/service/CostInputs.java:36-47, 50-86`（金额规则、`NEGATIVE`/`TOO_MANY_DECIMALS`）、`:119-127`（币种缺省）；`core/…/service/CostService.java:96-105, 192-250`（批量检查、`index`/`ref`/`reason`、整批层面的 `body` 错误、重复组的每一行）；`admin/…/facade/CampaignCostAdminFacade.java:108-123`（`CostItem` 字段、`BatchResponse(int count)`）、`:219-223`；`core/…/attribution/api/CampaignAdminTypes.java:88-99`；`core/…/repository/CostRepository.java:28-32`（行里连表取 `campaign_code`、`campaign_name`）；`admin/…/facade/AdminMetaFacade.java:33-54`（meta 字段表）；`admin/src/test/java/com/avatarapp/backend/admin/CostAdminIT.java:130-147, 255-285`（金额和批量明细的测试）；文档第 1535 行（`{"count":N}`、`index`/`ref`/`reason` 的形状、`DUPLICATE`、`NOT_FOUND`、币种可省略；没有写成本行的响应字段）、第 112 行（原因码清单没有 `NEGATIVE`、`TOO_MANY_DECIMALS`）。
- 和前端暂定做法：不一致。前端要改：(a) 成功响应读 `count`，不要等 `{imported, overwritten}`；提示按"已导入 n 行（已存在的日期被覆盖）"写，当前后端给不出新增和覆盖各几行；(b) `details` 里 `index` 是独立字段（从 0 起），`ref` 是字段名，显示"第 N 行"时用 `index + 1`；不要按 `"<下标>.<字段>"` 拆字符串；(c) 不认识的投放账户编码的原因码是 `NOT_FOUND`，不是 `OUT_OF_RANGE`；批内重复是 `DUPLICATE`，每个重复行都有一项；(d) 需要补 `NEGATIVE`、`TOO_MANY_DECIMALS` 两个原因码的译文（文档第 112 行的清单里没有它们，但代码会返回）；(e) 成本行直接用 `campaignCode`、`campaignName`；(f) 不带 `currency` 可以。
- 改动请求：建议做（成功响应加 `overwritten` 字段）。做法：保留 `count`，再加 `overwritten`（其中已存在而被覆盖的行数），实现上在批量写入的 SQL `ON CONFLICT` 处用 `RETURNING (xmax = 0)` 区分新增和覆盖。理由：批量导入后告诉运营"新增几行、覆盖几行"是批量导入界面的通行做法，覆盖是静默改钱，应该能看到；只是在响应里加字段，只影响管理端；需要同时改文档第 1535 行的响应写法。
- 核实程度：部分核实（`amount`、`cost` 是 JSON 数这一点同 38：由字段类型、搜不到全局序列化设置、测试断言推出，没有运行请求看原始响应）。

### 76（投放管理）`GET /attribution/clicks` 的 `from`、`to`；`GET /attribution/summary` 缺失分组值的 `key`
- 答案（逐小问）：
  1. 点击明细的 `from`、`to`：不是 ISO 时刻，是 `YYYY-MM-DD` 的 UTC 日，两端都包含，作用于 `clickedAt`（后端把 `from` 转成当天 00:00:00Z，把 `to` 转成次日 00:00:00Z 作不含的上界）。不限跨度。`from` 晚于 `to` → 400。传 ISO 时刻（带时分秒）会被拒绝：400 `INVALID_REQUEST`，`details` 为 `[{ref:"from"或"to", reason:"OUT_OF_RANGE"}]`。`campaignId` 筛选参数是正整数（数字串），响应里每行的 `campaignId` 是数。
  2. 注意区别：`GET /attribution/records`（归因明细）的 `from`、`to` 才是 ISO-8601 时刻，`from` 含、`to` 不含（作用于 `eventTime`）；点击明细和它不同。
  3. `GET /attribution/summary` 缺失分组值时 `key`：永远是字符串，缺失（`mediaSource` 或 `campaign` 为空）时是空串 `""`，不会是 `null`；按 `source` 分组时 `key` 就是来源本身（`APPSFLYER` 或 `SELF`）。
- 依据：`admin/src/main/java/com/avatarapp/backend/admin/facade/AttributionClickAdminFacade.java:84-102`（日转 UTC 区间）、`:123-139`（只收 `^\d{4}-\d{2}-\d{2}$`，错误 `OUT_OF_RANGE`）、`:34-35`（类注释）；`admin/…/facade/AttributionAdminFacade.java:211-221`（records 的 ISO 时刻，`Instant.parse`）；`core/…/attribution/repository/AttributionRecordRepository.java:416-421`（`COALESCE(media_source, '')`、`COALESCE(campaign, '')`）、`core/…/api/AttributionGroupBy.java:5-8`（注释写空值归在空串下）；文档第 1486 行（点击明细 `from`/`to` 是 `YYYY-MM-DD` 的 UTC 日，两端都含）、第 1485 行（records 是 ISO 时刻）、第 1487 行（`key` 空值为空字符串）。
- 和前端暂定做法：点击明细部分不一致：前端要改，所选的 UTC 日直接发 `from=YYYY-MM-DD`、`to=YYYY-MM-DD`（`to` 就是最后一天，不要转成"后一天 00:00:00Z"，否则会多包含一天，而且带时间的值会被 400）；`summary` 的 `key` 部分一致（显示"—"即可，只会是空串）。
- 改动请求：无。
- 核实程度：已核实。

### 77（应用内广告）状态、审核、上下架接口的请求体字段名；`targeting` 的更新是不是嵌套合并
- 答案（逐小问）：
  1. 计划状态 `PUT /ads/campaigns/{id}/status`：请求体 `{"status": "ACTIVE"|"PAUSED"|"ENDED"}`（`DRAFT` 也在可识别的取值里，但没有任何转移指向它，会得到 409）。单元状态 `PUT /ads/units/{id}/status`：`{"status": "ACTIVE"|"PAUSED"}`（`DRAFT` 取值识别但转移被拒）。素材上下架 `PUT /ads/creatives/{id}/serving-status`：`{"servingStatus": "ACTIVE"|"PAUSED"}`，仅 `APPROVED` 的素材能切换。
  2. 素材审核 `PUT /ads/creatives/{id}/review`：字段是 `reviewStatus`（不是 `decision`），取 `APPROVED` 或 `REJECTED`；备注字段是 `reviewNote`，驳回时必填（去首尾空白后 1 到 500 个码点），通过时可选。只有 `DRAFT` 的素材能审核。
  3. 错误：取值不在范围 → 400 `INVALID_REQUEST`（`ref` 是字段名，`reason` `OUT_OF_RANGE`）；缺字段 → `EMPTY_NOT_ALLOWED`；状态机不允许的转移（含"同状态"）→ 409 `INVALID_STATE`。
  4. `targeting` 是不是嵌套 Merge Patch：不是。`PUT /ads/units/{id}` 里只要出现 `targeting`，就整体替换原来的 `targeting` 对象，不做嵌套合并（Merge Patch 只作用在请求体的顶层字段：出现才改，缺省不变，`null` 清空）。所以前端更新时必须发完整的 `targeting` 对象，只发改动的键会把其他键丢掉；`"targeting": null` 或 `{}` = 清空为 `{}`。
  5. 发 `null` 的键会不会被类型校验拒绝：不会。`targeting` 内部值为 `null` 的键被跳过校验（但键名必须是六个已知键之一），原样保存并在响应里返回为 `null`，选取时 `null` 等于不限。所以前端可以发不含该键的对象（推荐），也可以发 `null`，效果相同；其中版本号键 `os_version_min`/`app_version_min` 发空串 `""` 会被拒绝（要么发合法版本号，要么不发或发 `null`）。
- 依据：`core/src/main/java/com/avatarapp/backend/core/ad/service/AdAdminService.java:274-291`（计划状态，`:280` 转移表）、`:492-505`（单元状态）、`:674-694`（审核，`:681` 驳回必须备注，`:685` 仅 DRAFT）、`:696-707`（上下架）、`:447-459`（`updateUnit`：`targeting` 整体替换）；`core/…/service/AdInputs.java:206-215`（`oneOf`，`OUT_OF_RANGE`）、`:267-320`（`targeting` 校验，`:281-283` 值为 `null` 的键跳过，`:319` 原样序列化保存）；`core/…/service/AdTargeting.java:90`（`restricts` 对 `null` 视为不限）；文档第 3724 行（四个请求体、`reviewNote` 1–500、409）、第 3730 行（Merge Patch 语义）。文档没有写 `targeting` 是整体替换还是嵌套合并。
- 和前端暂定做法：字段名（`status`、`servingStatus`、`reviewStatus`、`reviewNote`）一致；`targeting` 部分不一致：前端和假后端要改成整体替换（发完整对象，空的键不发；改成空的键可以直接不发，不需要靠 `null` 去删）。
- 改动请求：无（建议由改文档的人把"`targeting` 整体替换"写进文档第 3730 行附近，避免别人按 RFC 7396 实现）。
- 核实程度：已核实。

### 121（投放管理）投放账户的 `PUT`、`enabled` 默认值、取链接的 400、落地页接口地址
- 答案（逐小问）：
  1. `PUT /attribution/campaigns/{id}` 是整条替换还是可以只改 `enabled`：整条替换，不能只发 `enabled`。`name`、`mediaSource`、`campaign` 在 `PUT` 里同样必填（缺了 400，`details` 逐项列 `REQUIRED`）。可编辑字段里缺省的可空字段（`adset`、`ad`、三个像素编号、`remark`）会被清成 `null`，缺省的 `utmMedium` 变回 `cpc`。例外（缺省 = 不变）：`enabled`、`channelCodes`（缺省或 `null`）、`facebookAccessToken`（缺省或空串）。`code` 可不带，带了且不同 → 400 `IMMUTABLE`。所以前端"整条 `PUT`、只改 `enabled`"的做法正确：先拿当前整条再改 `enabled`，不要少发字段，否则会清掉像素、备注等。
  2. 创建时 `enabled` 的默认值：`true`（缺省或 `null`）。
  3. 取链接接口的两种 400 能否给 `ref` 和 `reason`：现状如下。平台缺失或不是 `FACEBOOK`/`GOOGLE`/`TIKTOK` → 400，`details` 为 `[{ref:"platform", reason:"INVALID_FORMAT"}]`。该账户没有这个平台的像素编号 → 400，`details` 为 `[{ref:"platform", reason:"REQUIRED"}]`（不是 `EMPTY_NOT_ALLOWED`）。`attribution.link_base_url` 没配置 → 400 `INVALID_REQUEST`，**没有 `details`**，只有英文 `message`。账户 id 不存在 → 404 `RESOURCE_NOT_FOUND`。检查顺序：平台 → 账户存在 → 像素 → 链接根地址。
  4. 落地页接口地址的写法：`POST {attribution.link_base_url}/api/attribution/click`（请求体 `{code, event: "PAGE_VIEW"|"DOWNLOAD_CLICK", utmSource, utmMedium, utmCampaign}`，无需登录）；取像素编号 `GET {…}/api/public/attribution/pixels?code=`；归因链接是 `{attribution.link_base_url}/go/{code}`。和你们暂定的写法一致。
  5. `POST` 的 `code` 重复：409 `DUPLICATE_RESOURCE`，`data.field = "code"`（文档第 151 行通则表和第 1531 行已写，代码一致）。
- 依据：`core/src/main/java/com/avatarapp/backend/core/attribution/service/CampaignInputs.java:82-98`（`create` 标志只影响 `code`，`name`/`mediaSource`/`campaign` 在 `PUT` 同样必填）、`:100-103`、`:109-117`（`enabled` 缺省）、`:118-135`；`core/…/service/CampaignService.java:109-120`（创建，`:115` 默认 `true`）、`:129-142`（更新，`:131-133` `code` 不同 → `IMMUTABLE`，`:138` `enabled` 缺省 = 不变）、`:166-189`（`link`：平台 `:167-170`，像素 `:177-180`，根地址 `:181-183` 无 `details`）；`admin/…/facade/CampaignCostAdminFacade.java:152-159`；`app/src/main/java/com/avatarapp/backend/app/controller/AttributionClickController.java:41`（`POST /api/attribution/click`）、`AttributionPixelController.java:31`、`GoRedirectController.java:38`；文档第 1531 行（PUT 语义）、第 1533 行（链接，未给 `details`）、第 1503 行（落地页接口）。
- 和前端暂定做法：一致（整条 `PUT`、创建发 `enabled: true`、落地页地址写法）。取链接的两个 400 前端现在应按"像素缺失 = `platform`/`REQUIRED`"和"根地址缺失 = 无明细"来判断（暂定做法是自己预判，可以保留）。
- 改动请求：(1) 建议做：`attribution.link_base_url` 没配置的 400 也给 `details`：`ref` 为 `attribution.link_base_url`，`reason` 为 `REQUIRED`（和像素缺失的原因码同一族，两种 400 才能靠 `details` 区分，不再靠英文 `message`）；这与文档第 112 行"需要指出出错对象的接口在 `data` 里放 `details`"的通则一致；要同时改文档第 1533 行。(2) 建议不做：让 `PUT` 支持只带 `enabled`：文档第 1531 行已把 `PUT` 定义为整条替换，加例外会让"缺省的字段变为 null"的规则更难记；前端用整条 `PUT` 就能做开关，代价只是多发几个字段。
- 核实程度：已核实。

### 122（应用内广告）"强制可关闭兜底为 0 且存在不可跳过素材"的警告，后端怎么判断"存在"
- 答案（逐小问）：
  1. 判断"存在"用哪些素材：数据库里满足全部三个条件的素材：`skippable = false`，`review_status` 不是 `REJECTED`（所以 `DRAFT` 和 `APPROVED` 都算），所属广告位的形式是 `SPLASH`（开屏）或 `INTERSTITIAL`（插屏）。不看 `servingStatus`（暂停的也算），不看单元或计划的状态，不看是否已通过。和你们暂定的口径（不数已拒绝的、广告位是开屏或插屏）相同，但要注意不能再加"投放中"之类的条件。
  2. 这个警告什么时候由后端给：保存配置 `ads.force_close_seconds`（`PUT /config/{key}`，编辑权限 `ADS:PLACEMENT`）且新值是整数 0、并且此刻数据库里存在满足上面三个条件的素材时，响应的 `warnings` 带 `AD_FORCE_CLOSE_DISABLED`（新值为 0 但没有这样的素材，或新值不是整数，都不带）；保存不可跳过的开屏或插屏素材（`POST/PUT /ads/creatives`）时，如果这个键当前是 0，也在响应 `warnings` 里给。后端不提供"当前是否存在"的常驻查询。
  3. 能否在 `GET /ads/meta` 加 `notSkippableFullScreenCount`：现在没有，meta 只返回 `geoConfigured`（见 40）。
- 依据：`core/src/main/java/com/avatarapp/backend/core/ad/service/AdConfigWarningProvider.java:25-27`（注释写明条件）、`:79-92`（保存配置时 `value == 0 && catalog.nonSkippableFullScreenExists()`）、`:95-108`（保存素材时）；`core/…/ad/repository/AdAdminRepository.java:607-616`（SQL：`c.skippable = false AND c.review_status <> 'REJECTED' AND p.ad_format IN ('SPLASH','INTERSTITIAL')`）；`core/…/shared/config/ConfigKeys.java:594-595`（`ads.force_close_seconds` 的编辑权限 `ADS:PLACEMENT`）；`admin/…/facade/AdAdminFacade.java:212`；文档第 2393 行（"`ads.force_close_seconds` 为 0 而存在不可跳过的开屏或插屏素材"，没有写哪些状态算"存在"）。
- 和前端暂定做法：一致（口径相同）。
- 改动请求：建议做。做法：`GET /ads/meta` 增加 `notSkippableFullScreenCount`（整数），口径就是上面 SQL 的 `count(*)`（和 `nonSkippableFullScreenExists` 同一个条件）。理由：能改 `ads.force_close_seconds` 的是 `ADS:PLACEMENT`，通常读不到素材列表，所以这类管理员无法常驻看到这条警告，只能在保存时才看到；meta 本来就开放给任一 `ADS:*` 权限，加一个计数不泄露内容；只加字段，不影响 Android、AvatarAgent。
- 核实程度：已核实。

### 123（应用内广告）各个字段的长度、范围、`DEEP_LINK` 的 scheme、版本号后缀
- 答案（逐项；长度都按去首尾空白之后的 Unicode 码点数计，存的是去空白后的值）：
  - 计划名称：1 到 100（必填）。计划描述：最多 500（可空，去空白后为空 = `null`）。
  - 计划优先级 `priority`：整数 0 到 2147483647；创建时不发或发 `null` = 100；**更新时发 `null` 会被拒绝**（400，`reason` `EMPTY_NOT_ALLOWED`），不想改就不要发。数值小优先。
  - 计划 `startAt`、`endAt`：ISO-8601 且必须带时区偏移（`Z` 或 `+08:00`），不带偏移的 `2026-11-01T10:00:00` 会被拒（`reason` `OUT_OF_RANGE`）；可发 `null` 清空；两者都有时 `startAt` 必须早于 `endAt`（否则 `ref:"endAt"`）。
  - 单元名称：1 到 100（必填）。单元 `weight`：整数 0 到 2147483647；创建时缺省 100。`dailyImpressionCap`：整数 0 到 2147483647（0 不限）。
  - 素材标题 `title` 最多 200；正文 `body` 最多 1000；按钮文字 `ctaText` 最多 100；广告主 `advertiserName` 最多 100；点击目标 `clickTarget` 最多 2048。以上都可为空（原生广告位的 `title`、`ctaText` 必填）。素材 `weight` 0 到 2147483647；`language` 是 `*` 或 BCP 47 标签（不超过 35 个字符）。
  - 拒绝备注 `reviewNote`：1 到 500（驳回必填）。
  - 激励阈值 `rewardAfterSeconds`：激励广告位的素材必填，5 到 30，视频还不能超过视频时长；非激励广告位带它 → 400。
  - `DEEP_LINK` 的 scheme 清单：为空。本应用没有声明自定义 scheme，所以 `clickAction=DEEP_LINK` 的任何 `clickTarget` 都得到 400（`ref:"clickTarget"`，`reason:"OUT_OF_RANGE"`）。前端建议把 `DEEP_LINK` 选项隐藏或置灰并提示"本应用尚未声明自定义 scheme"，而不是让运营填了再被拒。`OPEN_URL` 要符合文档 1.7 的链接规则（https）；`IN_APP_ROUTE` 要是文档 8.3 页面标识清单里的值。
  - 版本号 `os_version_min`、`app_version_min`：字符串，不超过 32 个字符，按"."分段，每一段必须以数字开头，后面可以跟任意后缀。所以 `13`、`1.2.0`、`1.2-beta`、`1.2.0-rc1` 都合法（比较时只取每段开头的数字，`0-beta` 按 0）；`beta`、`1..2`、`1.2.`、空串、`v1.2` 不合法（`reason` `OUT_OF_RANGE`，`ref` `targeting.os_version_min` 等）。
  - 其他定向键：`platforms` 是 `ANDROID`/`IOS` 的子集；`geo` 的每项必须是两位**大写**字母国家码；`languages` 每项是 BCP 47 标签；`day_parts` 每项恰好 `{"start","end"}` 两个键，值是 `H:mm`（小时 0 到 23，分钟两位）。
- 依据：`core/src/main/java/com/avatarapp/backend/core/ad/service/AdAdminService.java:83-92`（长度常量）、`:189`（`priority` 范围）、`:233-236`（更新时 `priority` 不能清空）、`:311-316`（`startAt` 早于 `endAt`）、`:749-798`（素材字段）、`:800-833`（激励阈值、原生必填，非激励带阈值 `:819`）、`:674-694`（备注）；`core/…/service/AdInputs.java:49-51, 64`（`TIME`、`TARGETING_KEYS`、空的 scheme 清单）、`:125-135`（必填文本）、`:154-163`（整数范围）、`:192-203`（`OffsetDateTime.parse`，必须带偏移）、`:293-299`（版本号校验）、`:390-424`（`clickTarget` 校验，`DEEP_LINK` 在 `:410-415`）；`core/…/service/AdTargeting.java:35, 121-136`（每段取开头数字，不以数字开头则无效）；文档第 3724 行（`DEEP_LINK` 一律 400，`OUT_OF_RANGE`）、第 3729 行（激励阈值）、第 3653-3659 行（定向键规则）。文档没有写各个文本字段的具体上限。
- 和前端暂定做法：基本一致（前端只做契约写明的检查，其余交给后端的 400）。前端可以补充：上面的上限做实时检查；`DEEP_LINK` 隐藏或置灰；版本号后缀其实允许（前端现在只收数字加点，比后端严，不会出错，要放宽就放宽）；更新计划时不要发 `priority: null`；`startAt`/`endAt` 一定带时区偏移。
- 改动请求：无。
- 核实程度：已核实。

### 124（应用内广告）`targeting` 校验失败时 `details` 的 `ref`
- 答案：`ref` 是 `targeting.<键名>`，键名用 snake_case，例如 `targeting.geo`、`targeting.day_parts`、`targeting.os_version_min`；未知键也是 `targeting.<那个未知键名>`。`targeting` 本身不是对象时，`ref` 是 `targeting`。`reason` 一律是 `OUT_OF_RANGE`。时段哪一行出错不带下标：`day_parts` 里任一项不合格，`ref` 都是 `targeting.day_parts`，不会出现 `targeting.day_parts[0]`；列表里某项不合格（如 `geo` 里有小写国家码）也只是 `targeting.geo`。每次只报第一个发现的问题（不是一次列全）。请求体根本不是 JSON 对象时 `ref` 为 `body`。`surfaces` 的错误 `ref` 是 `surfaces`。
- 依据：`core/src/main/java/com/avatarapp/backend/core/ad/service/AdInputs.java:267-320`（`:277` `String ref = "targeting." + key`，`:272` 非对象用 `targeting`，`:300-315` `day_parts` 的错误用 `ref`）、`:71-75`（`invalid` 只带一项明细）、`:88-96`（`Patch.of` 的 `body` 错误）；文档第 3651 行（只写"保存时校验…否则 `INVALID_REQUEST`"，没有写 `ref`）。
- 和前端暂定做法：一致（前端接受 `targeting`、`targeting.<键>`、`<键>`，实际只会出现前两种；没有 `[0]` 下标）。
- 改动请求：无（只报第一个问题可以接受；表单一次一个错误即可）。
- 核实程度：已核实。

### 125（应用内广告）广告报表：`daily` 补日、`totals` 比率、`by-country` 国家码
- 答案（逐小问）：
  1. `overview` 的 `daily` 是否只返回有数据的日子：是。只有在 `stat_ad_daily` 里有至少一行的 UTC 日才出现，按日期升序；没有数据的日子不出现，前端补 0 是对的。每个日行只有 `statDate`（`YYYY-MM-DD` 字符串）、`impressions`、`clicks`、`completions` 四个字段。
  2. 当天有没有数据：有。汇总任务每 `stats.land_interval_minutes` 分钟（默认 15）重算当天，所以 UTC 当天一旦有展示记录落地就会出现，但最多落后一个间隔，也不是实时。
  3. `totals` 里的比率字段是否和每行一样：一样。`totals` 与各报表的行用同一个函数生成：11 个计数指标（`impressions, guestImpressions, starts, viewableImpressions, nonViewableImpressions, undeterminedImpressions, clicks, completions, skips, errors, totalWatchSeconds`）加 5 个比率（`ctr, completionRate, viewableRate, measurableRate, avgWatchSeconds`），比率由汇总后的分子分母算出，是 JSON 小数（未舍入的浮点数），分母为 0 时是 `null`。范围内没有任何数据时，计数全是 0、比率全是 `null`。
  4. `by-country` 的 `country`：大写 ISO 3166-1 alpha-2 两位码（例如 `SG`）；空串 `""` 表示未知（落地时凡不是两位大写字母的值都归为空串）。
  5. 其他：`by-placement`、`by-campaign`、`by-creative`、`by-country`、`nofill` 的响应是 `{"items":[…]}`，不分页；`nofill` 的行是 `{statDate, slotKey, reason, cnt}`（`statDate` 是字符串）；名称（`placementName`、`campaignName`、`creativeTitle`）读取时现取，对象已不存在或素材没有标题时为 `null`。
- 依据：`core/src/main/java/com/avatarapp/backend/core/ad/service/AdReportService.java:96-115`（`overview`，`daily` 来自 `stats.grouped(f, STAT_DATE)`）、`:191-215`（`metrics` 与 `ratio`，分母为 0 给 `null`，返回 `Double`）、`:145-153`（`country`）、`:156-167`（`nofill`）；`core/…/ad/repository/AdStatRepository.java:134-163`（`totals` 与 `grouped` 的 SQL，只统计表里有的行）；`core/…/service/AdStatLandService.java:117, 416-419`（国家只收 `[A-Z]{2}`，否则空串）；`core/…/shared/geo/GeoIpResolver.java:10-14`（大写 alpha-2）；`core/…/stats/service/StatLandService.java:149-151, 181-198`（当天落地，遍历所有落地器）、`worker/…/job/StatLandJob.java:19-25`（每 `stats.land_interval_minutes` 当天落地）；文档第 3721 行（`daily` 只含已落地的日子，比率分母为 0 为 `null`，`country` 空串为未知）、第 2690 行（`stats.land_interval_minutes` 默认 15）。
- 和前端暂定做法：一致（缺的日子补 0；分母为 0 显示"—"。后端给 `null` 时前端自然显示"—"，前端再检查一遍分母也不矛盾）。
- 改动请求：无。
- 核实程度：已核实。

---

## 对照复查

### 复查 1（投放管理）点击明细和埋点事件明细里 IP 的掩码格式
- 新版接口文档写法是否变了：变了，更具体。旧版写"IPv4 末段、IPv6 后半段以 `*` 代替"，新版写明：IPv4 `a.b.c.d` → `a.b.c.*`；IPv6（不压缩的八组）→ 前四组加 `:*`，例如 `2001:db8:0:0:*`；其他 → `*`；存为空的 IP 仍为空；持有 `ANALYTICS:IP_VIEW` 才返回完整 IP，与邮箱、手机号掩码一致（文档第 2382 行，点击明细见第 1486、2388、2467 行）。
- 代码是否这样做：是。IPv4 四段且每段 1 到 3 位十进制数、不大于 255 → `a.b.c.*`；八组、每组 1 到 4 位十六进制 → 前四组加 `:*`；其他返回 `*`；`null` 保持 `null`。点击明细和埋点事件明细都调用同一个 `IpMask.mask`，持有 `ANALYTICS:IP_VIEW` 时不掩码。依据：`common/src/main/java/com/avatarapp/backend/common/text/IpMask.java:23-36`、`admin/…/facade/AttributionClickAdminFacade.java:92, 117`、`core/…/facade/AnalyticsFacade.java:333`（我搜了 `IpMask` 的调用，非测试代码里只有这两处）。点击记录在 `attribution.store_click_ip` 为 `false` 时存的 IP 是 `null`（`core/…/attribution/service/ClickRecordService.java:107`），响应里仍是 `null`。
- 结论：仍然正确。一个边角差异：文档说"存为空的 IP 仍为空"，代码只对 `null` 保持 `null`；如果存的是空串 `""`，`IpMask.mask("")` 会返回 `*`（`IpMask.java:23-36`）。我没有查到哪里会存空串（点击不存 IP 时存 `null`），所以不影响现状，前端把 `null` 显示为"—"、把 `*` 原样显示即可。
- 核实程度：已核实。

### 复查 8（应用内广告）删除名下有单元的计划、名下有素材的单元，草稿计划名下有单元能不能删
- 新版接口文档写法是否变了：没变。状态机一段仍写"计划删除只允许 `DRAFT` 或 `ENDED` 且名下没有单元；单元删除只允许 `DRAFT` 且没有素材"（文档第 3630 行），验收项第 3778 行写"违反 → 409 `INVALID_STATE`"。我搜了新版文档里 `RESOURCE_IN_USE`，0 处命中，代码里也是 0 处命中。
- 代码是否这样做：是。删除计划：状态不是 `DRAFT`/`ENDED` → 409 `INVALID_STATE`；名下有单元（不论计划是草稿还是已结束）→ 409 `INVALID_STATE`，所以草稿计划名下有单元不能删。删除单元：状态不是 `DRAFT` → 409 `INVALID_STATE`；名下有素材 → 409 `INVALID_STATE`。这些 409 的 `data` 为空（只带英文 `message`，没有 `status`、`what` 之类的字段），所以前端无法从响应判断是"状态不对"还是"名下有子项"，只能像暂定做法那样先预判。依据：`core/src/main/java/com/avatarapp/backend/core/ad/service/AdAdminService.java:294-306`（计划）、`:512-525`（单元）、`:907-909`（`invalidState` 只带 message，`new ApiException(ErrorCode.INVALID_STATE, message)`）。
- 结论：仍然正确。
- 核实程度：已核实。

---

## 我发现的、问题表没问到但前端会踩到的坑

1. 投放账户、成本、点击、效果报表里的 `id`/`campaignId` 是 JSON 数，但文档 17.4 通则第 1 条写"`id` 和外键是字符串"（文档第 2434 行）；代码是 `long`（依据见文首）。前端类型按数处理（或统一转字符串再用），不要假设是字符串；两边需要由文档修订者决定改哪边。
2. 成本行（`GET/POST/PUT /attribution/costs`）的响应带 `campaignCode`、`campaignName`、`currency`、`createdByUsername`（`CampaignCostAdminFacade.java:108-120`），文档第 1535 行没有列这些字段；前端不需要再去对账户名称。
3. 成本列表 `GET /attribution/costs` 的权限只有 `ATTRIBUTION:MANAGE`（`admin/…/controller/CostAdminController.java:37-38`）；只有 `ATTRIBUTION:VIEW` 的管理员读不到成本列表，只能在投放效果报表里看汇总后的成本。
4. 成本录入的原因码 `NEGATIVE`、`TOO_MANY_DECIMALS` 在代码里（`CostInputs.java:38-39`），但文档第 112 行的原因码清单和第 1535 行都没写，前端的译文表要补。
5. 更新计划时 `priority` 不能发 `null`（`AdAdminService.java:233-236`，`EMPTY_NOT_ALLOWED`）；而前端暂定做法是"五个字段全发，没填的是 `null`"，创建没问题（`null` = 100），更新会 400。`startAt`/`endAt` 必须带时区偏移（`AdInputs.java:199`）。
6. 更新单元时 `targeting` 是整体替换（见 77），`weight` 发 `null` 会把单元权重清成 `null`（选取时按默认 100，文档第 3641 行），`dailyImpressionCap` 发 `null` 变成 0；前端表单不要因为"没填"就发 `null`，除非确实想清空。
7. 效果报表按日分组时也有未归因行，且这一行是 `{campaignId:0, unattributedInstalls}`，不是日行（`PerformanceReportService.java:190-192`）；前端渲染按日表格时要把它从日行里分出来，否则会出现一个没有日期的行。
8. 点击明细的 `from`/`to` 与归因明细的 `from`/`to` 格式不同（点击明细是日期，归因明细是 ISO 时刻，见 76），两个页面不要共用同一个日期转换函数。
9. 文档第 3714 行说 `PUT /ads/units/{id}` 只改四个字段，代码还接受 `surfaces`（见 39）。
10. `POST/PUT /ads/creatives` 的响应是素材对象展开后再加 `warnings`（`@JsonUnwrapped`，`AdAdminFacade.java:197-198`），不是 `{creative:{…}, warnings:[…]}`，读取时 `warnings` 与素材字段在同一层。

---

# 第 G 部分：sms-notifications-clientconfig-config

共 19 条（18 条待答 + 1 条对照复查）：已核实 17 条，部分核实 2 条，未核实 0 条；前端要改 6 条（5、41、42、78、130、139）；改动请求 3 条（建议做 2：5、41；建议不做 1：42）；接口文档新版已写明 7 条（6、79、80、127、128、129、133），另有 8 条只写明一部分（5、41、42、78、126、131、132、138）。
已按独立核对结果更正：更正 3 处（131、126、139），行号 2 处（41、126 引用的 `checkBody`）。

路径简写（都在 `D:\Projects\PycharmProjects\AvatarBackend` 下，行号是我实际打开读到的）：
- CORE = `core/src/main/java/com/avatarapp/backend/core`
- ADMIN = `admin/src/main/java/com/avatarapp/backend/admin`
- COMMON = `common/src/main/java/com/avatarapp/backend/common`
- DOC = `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md`（新版，下面只写行号）

读法提示：后端所有“被拒”的 400 都是 `INVALID_REQUEST`，细节放在 `data.details`，每项 `{ref, reason}`（`ref` 指出错的对象，`reason` 是原因码）。下面说“ref=X、reason=Y”就是这个意思。

---

### 5（短信与邮件）短信渠道 `credentials` 是什么形状、整体替换还是合并、各供应商要哪些名称、旧写法答什么、长度条数上限、空值
- 答案：
  1. 是不是“名称到文本值”的一层映射：是。请求类里写的是 `Map<String, String> credentials`（名称→文本）。值只能是文本；数字、布尔会不会被自动转成文本取决于 JSON 库的默认转换，我没有运行验证，前端不要发。
  2. 有条目时整体替换还是按名称合并：**整体替换**。更新时用新加密出来的整张映射覆盖库里的旧密文，没带或空时保持旧的（`newCredentials.orElse(old.credentialsEnc())`）；没有任何“合并”或“只删某个名称”的路径。附带后果：一旦保存过凭据，用 `PUT` 没有办法把凭据清空成“没有”（空映射 `{}` 和不带该字段都表示“不改”）。
  3. 每个供应商需要哪些名称：后端现在没有这个信息。适配器接口 `SmsGateway` 只有 `providerCode`、`allowedHosts`、`usableHere`、`send` 四个方法，没有“凭据名称”；`GET /sms/meta` 的供应商项只有 `code` 和 `allowedHosts`。仓库主代码里唯一的适配器是 `local-stub`（搜 `implements SmsGateway`：主代码 1 处，另有 2 处在测试里），它不需要任何凭据，而且生产环境不可用，所以生产环境下 `providers` 现在是空列表，真实供应商选定后才有。
  4. 收到旧写法（一个字符串）：请求体无法读成映射，走统一的“请求体读不了”处理，返回 400 `INVALID_REQUEST`，`message` 是 "Malformed or invalid request body"，**没有 `details`**。这一条是从处理器代码推出来的，没有测试覆盖。
  5. 名称和值的长度、条数上限：代码里**没有**（我读了 `SmsAdminFacade.seal` 和 `SmsCredentialCipher.encrypt`，只检查 null）。唯一的上限是整个请求体 8 MiB（`avatar.http.max-body-bytes`，`core/src/main/resources/avatar-shared.yml:65`）。
  6. 空值是否允许：**允许**。名称是空串、值是空串，后端都收（只拒 null，拒绝时 400，ref=`credentials`，reason=`EMPTY_NOT_ALLOWED`）。这和接口文档“值为非空字符串”的字面意思有出入（见文末矛盾清单）。
  7. 另外两个和假后端不同的实际行为：`credentials: null` 等同于不带这个字段，**保持原凭据并成功**（`seal` 里 `credentials == null || isEmpty` 直接返回“没有新凭据”），不是 400；没配 `SMS_CRED_ENC_KEY` 时带非空 `credentials` 的保存返回 503 `DEPENDENCY_UNAVAILABLE`，而且这个检查在其他字段校验之前（`createChannel` 先 `seal` 再开事务）。
- 依据：`ADMIN/facade/SmsAdminFacade.java:131-141`（请求类）、`:221-256`（创建/更新先 seal）、`:432-447`（`seal`：空或 null 视为没带，只拒 null）；`CORE/sms/service/SmsChannelAdminService.java:183`（`newCredentials.orElse(old.credentialsEnc())`）；`CORE/sms/service/SmsCredentialCipher.java:97-108`（加密，key 缺失 503）；`CORE/sms/port/SmsGateway.java:15-33`、`ADMIN/facade/SmsAdminFacade.java:182-186,303-308`（meta 只有 code、allowedHosts）；`CORE/sms/adapter/LocalStubSmsGateway.java:27-47`；`COMMON/web/GlobalExceptionHandler.java:106-111`（读不了的请求体）；DOC 3833（`credentialsEnc` 段：更新时凭据字段留空表示不修改、缺密钥 503）、DOC 3852（`credentials` 是值为非空字符串的对象；null 值或 null 名 → 400，`details` 为 `[{"ref":"credentials","reason":"EMPTY_NOT_ALLOWED"}]`；不改凭据时省略或传 `{}`）。
- 和前端暂定做法：不一致（前端要改：①“整体替换”的提示正确，保留；②假后端对 `null` 答 400，真后端是“保持不变并成功”，对空名称、空值也是接受，假后端和前端的测试按真后端改；③字符串旧写法真后端答的是不带 `details` 的 400，页面遇到时按“没有 details 的 400”处理；④页面想做“清空凭据”目前做不到，不要提供这个入口）。
- 改动请求：建议做（让每个适配器声明所需的凭据名称，`GET /sms/meta` 的供应商项加 `credentialNames`，保存时缺名称或多出名称就按 `credentials` 拒绝；名称拼错会让渠道静默不可用，适配器自己最清楚需要什么，只影响后台，不影响 Android 和 AvatarAgent）。
- 核实程度：部分核实（缺：字符串写法答 400 是从处理器代码推出，没有测试也没有运行；数字、布尔值是否被自动转文本未运行验证）。

### 6（短信与邮件）短信渠道 `extConfig` 在请求和响应里是 JSON 对象还是字符串
- 答案：请求和响应里都是 **JSON 对象**。请求类里是 `Map<String, Object> extConfig`，响应类 `SmsChannelView.extConfig` 也是 `Map<String, Object>`，总是对象，不会是字符串或 null。具体：
  - 请求发字符串 → 读不了，400（同第 5 条第 4 点）。
  - 创建时不带或 `null` → 存成 `{}`；更新时不带或 `null` → 保持原值；更新时发 `{}` → 替换成空对象。
  - 内容不检查键名：`appId`、`senderIds` 只是约定，后端不校验，也不扫描里面有没有凭据；它整体原样返回。序列化后超过 16384 个字符 → 400 ref=`extConfig`、reason=`TOO_LONG`；含 NUL 控制字符 → `OUT_OF_RANGE`。
  - 凭据在单独的加密列里，响应只有 `hasCredentials`，这一点和契约一致；但“里面不会放凭据”靠的是运营不往 `extConfig` 里写，后端没有拦。
- 依据：`ADMIN/facade/SmsAdminFacade.java:131-141`；`CORE/sms/service/SmsChannelAdminService.java:118,175,298-307,319-336`（`extConfig()` 限制在 300-305 行）；`CORE/sms/api/SmsChannelView.java:11-33`；DOC 3833（`extConfig`（JSON：`appId`、按国家的 `senderIds`））。
- 和前端暂定做法：一致（请求发对象或 `null`、响应按对象读；`null` 在更新时的含义是“不改”，不是“清空”）。
- 改动请求：无
- 核实程度：已核实

### 41（短信与邮件）“最后一个覆盖的启用验证码通道”被拒时能否给专用错误码；`GET /sms/meta` 能否加 `phoneLoginEnabled`、`phoneAccountCount`
- 答案：
  1. 被拒时现在返回什么：400 `INVALID_REQUEST`，**有 `details`**（前端表里写“没有 details”是旧契约的状态）。渠道：`[{"ref":"SmsChannel","reason":"OUT_OF_RANGE"}]`，`message` 是英文句子，分两种：`This change would leave no enabled OTP channel while …`（没有任何启用的验证码渠道了）、`This change would leave no enabled OTP channel for <国家码列表> while …`（白名单里某国家没渠道覆盖了）。模板：`[{"ref":"SmsTemplate","reason":"OUT_OF_RANGE"}]`，也分两种（最后一个启用的验证码模板；最后一个“英文且不限国家”的验证码模板），两种的 `ref` 和 `reason` 相同，只有 `message` 不同。没有 `LAST_OTP_CHANNEL` 这类专用码（`ErrorCode` 里没有；我在 `ErrorCode.java` 里搜了 `OTP`、`LAST`，命中的只有 `OTP_*` 四个验证码流程码和 `ADMIN_TOTP_*` 两个管理员二次验证码，没有 `LAST` 开头的）。
  2. 触发条件：`auth.phone_login_enabled` 为真，或存在手机号账号（`settings.getBool(AUTH_PHONE_LOGIN_ENABLED) || users.countWithPhone() > 0`）。
  3. `GET /sms/meta`：现在返回 `{providers:[{code, allowedHosts}], testRemainingToday}`，没有 `phoneLoginEnabled`、`phoneAccountCount`。手机号账号数量只在内部用（`SmsAdminFacade.guarded()`、保存 `auth.phone_login_enabled=false` 时的警告 `PHONE_LOGIN_DISABLED_ACCOUNTS`）。我搜了 `countWithPhone`，没有任何后台接口把它返回出来。`phoneLoginEnabled` 可以从 `GET /config` 读，但那个接口只给当前管理员“有权编辑的键”，只有短信权限的管理员读不到。
- 依据：`CORE/sms/service/SmsChannelAdminService.java:243-276`（渠道 guard，`SmsInputs.invalid("SmsChannel", OUT_OF_RANGE, …)` 在 266-274）；`CORE/sms/service/SmsTemplateAdminService.java:161-182`（模板 guard）；`ADMIN/facade/SmsAdminFacade.java:186,303-308,423-425`；`CORE/facade/SmsConfigWarningProvider.java:58-70`；`COMMON/web/ErrorCode.java:54-57`；DOC 3833（模板的 `details` 写了 `[{"ref":"SmsTemplate","reason":"OUT_OF_RANGE"}]`，**渠道的 `details` 文档没写**）、DOC 3854（meta 的形状）。
- 和前端暂定做法：不一致（前端要改：被拒时可以直接按 `ref`（`SmsChannel`/`SmsTemplate`）+ `reason`（`OUT_OF_RANGE`）显示固定说明，不必只显示“输入内容不合法”；要注意同一个 `ref` 下有两种情形，固定说明要写成覆盖两种的话，或等后端拆分原因码；操作前的提示条件“登录开关为真或存在手机号账号”和后端一致）。
- 改动请求：建议做。①给这四种情形各一个不同的 `reason`（最后一个验证码渠道、某国家失去覆盖、最后一个验证码模板、最后一个英文不限国家模板）；②`GET /sms/meta` 加 `phoneLoginEnabled` 和 `phoneAccountCount`。理由：现在四种情形在 `ref`+`reason` 上分不开，前端规则是“错误码已知才按码译文”，这些端点只给后台用，不影响 Android 和 AvatarAgent；只有短信权限的管理员读不到登录开关，没有别的办法拿到。
- 核实程度：已核实

### 42（系统配置）开启手机号登录被拒时，400 的 `data` 能否加数组 `missing`
- 答案：现在的 400 已经是“一项缺失一条 `details`”：`PUT /config/auth.phone_login_enabled` 值为 `true` 时，依次检查并各加一条（只加缺的）：①`sms.allowed_country_codes` 没设或为空 → ref=`sms.allowed_country_codes`、reason=`EMPTY_NOT_ALLOWED`；②`sms.daily_global_cap` 没设 → ref=`sms.daily_global_cap`、`EMPTY_NOT_ALLOWED`；③没有启用的验证码渠道 → ref=`SmsChannel`、`EMPTY_NOT_ALLOWED`；④没有“启用、验证码类型、语言 en（不区分大小写）、不限国家”的模板 → ref=`SmsTemplate`、`EMPTY_NOT_ALLOWED`。所以最多 4 条，前端从 `ref` 就能知道缺哪几项。`message` 是 `Phone login cannot be enabled; missing: <逐项英文>`。第④项只有一个条件（英文不限国家的启用验证码模板），后端没有单独检查“有没有任何验证码模板”，因为“英文不限国家”已经包含它；所以前端设想的 `OTP_TEMPLATE_ANY` 这个码没有对应的独立判断。
- 依据：`CORE/sms/service/SmsSettingValidator.java:102-129`；`CORE/sms/service/SmsCoverageService.java:25-38`（模板判断）；`CORE/sms/repository/SmsTemplateRepository.java:86-92`（SQL：`sms_type='OTP' AND enabled AND country IS NULL AND lower(locale)='en'`）；`CORE/shared/config/ConfigValidator.java:166-181`（域校验器的位置）；DOC 2718（“`message` 逐项写出缺的内容”，没写 `details` 的各 `ref`）。
- 和前端暂定做法：不一致（前端要改：现在前端“固定写一句最常见的缺项”，应改成逐条按 `details` 里的 `ref` 显示：`sms.allowed_country_codes`、`sms.daily_global_cap` 对应设置行，`SmsChannel`、`SmsTemplate` 各一句固定文字；`SmsTemplate` 那句已经正确，不用动）。
- 改动请求：建议不做（`details` 已经给出缺哪几项，模板只有一个判断条件，再加一个 `missing` 数组是重复信息，还要同步契约）。
- 核实程度：已核实

### 78（短信与邮件）`PUT` 是否整条替换；`PUT …/enabled` 请求体；新建 `enabled` 默认值；`channelCode` 格式长度；`allowedHosts` 精确还是通配；测试发送无效号码答什么
- 答案：
  1. `PUT /sms/channels/{id}` 是不是整条替换：**不是**，是“没带的字段保持原值”。`name`、`providerCode`、`apiUrl`、`extConfig`、`countries`、`smsType`、`priority`、`enabled` 为 null（没带）时都保留原值；`credentials` 空或没带保留原值。要清空国家列表必须发 `countries: []`（不能发 null）。`channelCode` 可以带，但必须等于原值，不同返回 400 ref=`channelCode`、reason=`OUT_OF_RANGE`（不能改）。换 `providerCode` 而不带 `apiUrl` 时，旧 `apiUrl` 会按新供应商的主机白名单重新检查。模板的 `PUT` 同理（没带的字段保持原值）。前端如果每次都发全部字段，行为等同整条替换，没问题。
  2. `PUT …/enabled` 的请求体：`{"enabled": true|false}`，缺失或 null → 400 ref=`enabled`、reason=`EMPTY_NOT_ALLOWED`。响应是**裸的渠道对象**（`SmsChannelView`），不像 `POST`、`PUT /sms/channels/{id}` 那样包一层 `{channel, warnings}`。模板的 `…/enabled` 同样的请求体，响应是模板对象。
  3. 新建时 `enabled` 默认：**true**（没带时）；`priority` 没带默认 0；`smsType` 新建必填（缺 → ref=`smsType`、`EMPTY_NOT_ALLOWED`）。模板新建 `enabled` 默认 true。
  4. `channelCode` 格式和长度：`^[A-Za-z0-9_-]{1,64}$`，区分大小写（`A` 和 `a` 是两个不同的编码；唯一约束是数据库精确比较）；重复 → 409 `DUPLICATE_RESOURCE`。不符合 → ref=`channelCode`、reason=`OUT_OF_RANGE`。`templateCode` 同一规则。`name` 去首尾空白后 1 到 100 个字符。
  5. `allowedHosts`：是**精确主机名**，比较时不区分大小写，没有后缀、通配的写法。校验只比 `apiUrl` 里的主机名，端口和路径不比；必须是 https，不能带 `user@`，否则 ref=`apiUrl`、reason=`INVALID_HOST`；`apiUrl` 总长不超过 2048。
  6. 测试发送无效号码：400 `PHONE_INVALID`（不是 `INVALID_REQUEST`），无 `details`。检查顺序：渠道不存在 404 → 号码无效 400 `PHONE_INVALID` → 当天额度用完 429 `RATE_LIMITED`（无供应商调用）→ 渠道不可用 503 `SMS_SEND_FAILED`。无效号码不占当天额度；额度在判断渠道是否可用**之前**就扣了，所以 503 `SMS_SEND_FAILED` 也会扣一条。供应商拒绝时不是 HTTP 错误：返回 200，`sendStatus=FAILED`、`failReason` 有值。
- 依据：`CORE/sms/service/SmsChannelAdminService.java:106-148`（创建，默认值在 119-120）、`:155-216`（更新，159-161 `channelCode` 不可改，163-183 没带保持原值）；`CORE/sms/service/SmsInputs.java:28,92-97,140-157`；`ADMIN/controller/SmsAdminController.java:89-94`、`ADMIN/facade/SmsAdminFacade.java:258-271`（`setChannelEnabled` 返回渠道）、`:496-504`（`enabled()`）；`CORE/sms/service/SmsTemplateAdminService.java:77,100-144`；`CORE/sms/service/SmsTestSendService.java:107-162`（顺序 110-119，额度 113，渠道可用 116-119）、`CORE/sms/service/PhoneNumbers.java:53-72`；`COMMON/web/ErrorCode.java:34,52,58,74`（`RATE_LIMITED` 429、`PHONE_INVALID` 400、`SMS_SEND_FAILED` 503、`DUPLICATE_RESOURCE` 409）；`CORE/sms/adapter/LocalStubSmsGateway.java:36-40`（白名单写法）；DOC 3833（`apiUrl` 必须是 https 且主机在白名单内）、DOC 3853（测试发送，429 `RATE_LIMITED`）、DOC 3827（无效号码 `PHONE_INVALID`）。
- 和前端暂定做法：不一致（前端要改：①文档与代码都是“没带保持原值”，前端发全字段没问题，但不要用 null 表示清空；②`…/enabled` 的响应是裸渠道对象，没有 `warnings` 包装；③主机比较“页面按主机名精确比较”和后端一致，但要做不区分大小写）。
- 改动请求：无
- 核实程度：已核实

### 79（短信与邮件）`GET /sms/records` 的筛选参数名是不是记录的列名
- 答案：是。参数名正好是 `msgId`、`vendorMsgId`、`mobile`、`channel`、`channelCode`、`purpose`、`sendStatus`、`deliveryStatus`、`used`、`from`、`to`（11 个），再加分页参数 `page`、`pageSize`（`pageSize` 默认 20，最多 200，越界 400）。具体行为：
  - `channel` 是“投递渠道”（`SMS`/`PUSH`），`channelCode` 是“短信通道编码”（`PUSH` 记录固定 `FCM`），别搞混。
  - 文本类筛选（`msgId`、`vendorMsgId`、`mobile`、`channel`、`channelCode`、`purpose`、`sendStatus`、`deliveryStatus`）都是**精确相等**；后端**不校验取值**，写错（如 `sendStatus=foo`）不会 400，只会得到空列表。
  - `mobile` 按库里存的原样比较，库里是 E.164（`+` 加数字，无空格），所以前端必须发同样的写法；后端**不会**把 `+65 9123 4567` 规整后再比（用户列表的手机号筛选会规整，这里不会）。
  - `used` 只认小写 `true`/`false`，其他值 400（ref=`used`、reason=`OUT_OF_RANGE`）。
  - `from`、`to`：按 `Instant.parse` 读，`from` 含、`to` 不含（`createdAt >= from`、`createdAt < to`）；读不了 → 400 ref=`from`/`to`、reason=`OUT_OF_RANGE`。请使用 `2026-10-01T00:00:00Z` 这种写法；带偏移量（`+08:00`）的写法是否也被接受，取决于 JDK 的 `Instant.parse`，我没有运行验证。
  - 导出：`GET /sms/records/export` 接受同样的 11 个筛选，没有分页参数；导出请求里多带 `page`、`pageSize` 也不会出错（会被忽略），去掉更干净。
  - 排序固定：创建时间倒序，同一时间按 `msgId` 倒序。
- 依据：`ADMIN/controller/SmsAdminController.java:154-196`；`ADMIN/facade/SmsAdminFacade.java:192-209,506-547`；`CORE/sms/service/SmsSendRecordStore.java:205-216,233-259`（`bson`：`from` 246-248、`to` 249-251）；`CORE/sms/service/SmsRecordCollection.java:8-25`（列名）；`ADMIN/web/AdminPageQuery.java:18-25`；DOC 3856、3857（导出接受相同筛选）。
- 和前端暂定做法：一致（参数名正确；“导出发列表参数去掉 `page`、`pageSize`”正确）。
- 改动请求：无
- 核实程度：部分核实（缺：`from`/`to` 带偏移量写法是否被 `Instant.parse` 接受，未运行验证；`Z` 结尾的写法已按代码确认）。

### 80（站内通知）`GET /notifications` 的 `from`、`to` 是 ISO 时刻吗、含与不含；`isRead` 取值
- 答案：`from`、`to` 是带时区偏移的 ISO-8601 时刻（用 `OffsetDateTime.parse` 读，`Z`、`+08:00` 都行；只有日期、或没有偏移的本地时间读不了），`from` **含**（`created_at >= from`）、`to` **不含**（`created_at < to`）。读不了或超出 `0001-01-01` 到 `9999-12-31` → 400 ref=`from`/`to`、reason=`OUT_OF_RANGE`。`isRead` 只认小写 `true`、`false`，其他 → 400 ref=`isRead`、reason=`NOT_BOOLEAN`。`category` 只认 `ADMIN`、`SYSTEM_EVENT`（大写），其他 → ref=`category`、`OUT_OF_RANGE`。`accountId` 必须是 36 位标准 UUID 写法（大小写都行），否则 ref=`accountId`、`OUT_OF_RANGE`。排序：创建时间倒序，同一时间按 id 倒序。
- 依据：`CORE/facade/NotificationFacade.java:326-352`（参数检查）、`:595-609`（`time`）；`CORE/notification/repository/NotificationRepository.java:176-196`（SQL 条件，191 行 `>= ?`、195 行 `< ?`）；`ADMIN/controller/NotificationAdminController.java:46-58`；DOC 4037（“`from` 含、`to` 不含，ISO-8601 带时区偏移；`isRead` 取 `true`/`false`；`category` 取 `ADMIN`/`SYSTEM_EVENT`；`accountId` 为 UUID”）。
- 和前端暂定做法：一致（所选 UTC 日变成 `[from, to)`，发 `…T00:00:00Z` 即可）。
- 改动请求：无
- 核实程度：已核实

### 81（客户端配置）整体替换时没变化的语言行 `updatedAt` 是否也更新；内容相同的重复 `PUT` 能否幂等成功
- 答案：
  1. 没变化的行的 `updatedAt`：**也更新**。`PUT` 的做法是先删掉这个键的所有行，再把请求里的所有语言各插入一行，所有行用同一个新时刻（微秒精度）和同一个 `updatedBy`。键的 `updatedAt`（`GET /client-config` 里的那个）是各行里最大的一个，所以保存成功后一定变成这次保存的时刻。接口里看不到每个语言行各自的时间，只有键一级的 `updatedAt`、`updatedBy`。
  2. 重复的、内容相同的 `PUT`：**成功**。后端不比较内容、也不检查版本（我在整个仓库的 java 文件和新版文档里搜 `expectedUpdatedAt`，都是 0 处命中），所以重发一次照样返回 200 和该键的最新条目；效果是 `updatedAt`、`updatedBy` 变成这次的值，并多写一条审计日志。
  3. 要注意的坑：请求体里带 `expectedUpdatedAt` 不会被拒，而是**被静默忽略**（控制器只取 `values` 成员），也不会返回 409。前端不能指望后端挡住并发覆盖。
- 依据：`CORE/clientconfig/service/ClientConfigService.java:370-387`（`replace`：377-384 先删后插、同一个 `now`）、`:334-357`（键的 `updatedAt` 取各行最大）；`CORE/clientconfig/repository/ClientConfigRepository.java:49-63`；`ADMIN/controller/ClientConfigAdminController.java:65-76`（只取 `values`）；`ADMIN/facade/ClientConfigAdminFacade.java:41-52,74-78`（响应只有键级 `updatedBy`/`updatedAt`）；DOC 4118（`PUT`、`reset` 返回 `GET /client-config` 里的同一项形状；没有 `expectedUpdatedAt`）。
- 和前端暂定做法：一致（“`updatedAt` 相同时前端也比较各语言的值”继续保留；后端每次保存都会让所有行的时间一起变，所以不会漏，只是比值多一道保险）。
- 改动请求：无（本问不要求；前端先前提的 `expectedUpdatedAt`（4.4 条）仍是未采纳的独立请求，不在本组）。
- 核实程度：已核实

### 126（短信与邮件）短信模板创建与更新的请求体；缺 `{code}` 的原因码；邮件模板缺必含项的原因码
- 答案：
  1. 短信模板请求体（创建和更新同一个类）：`{templateCode, name, locale, country, content, providerTemplateId, smsType, enabled}`。创建时 `templateCode`、`name`、`locale`、`content`、`smsType` 必填（缺了各自 `EMPTY_NOT_ALLOWED` 或对应码），`country`、`providerTemplateId` 可空，`enabled` 默认 true；更新时没带的字段保持原值，`templateCode` 不能改（不同 → ref=`templateCode`、`OUT_OF_RANGE`）。
  2. 短信模板缺 `{code}`：400，ref=`content`、reason=`OUT_OF_RANGE`，`message` 是 "An OTP template must contain {code}"（只对 `smsType=OTP` 检查）。同一字段上的其他拒绝：未知占位符（只允许 `{code}`、`{minutes}`、`{appName}`）→ ref=`content`、`OUT_OF_RANGE`；空 → `EMPTY_NOT_ALLOWED`；超过 1000 个字符 → `TOO_LONG`；含控制字符（换行、回车、制表符除外）→ `OUT_OF_RANGE`。`locale` 不是语言标签 → ref=`locale`、`INVALID_LANGUAGE_TAG`；`country` 不是库认识的国家码 → ref=`country`、`OUT_OF_RANGE`。注意缺 `{code}` 和未知占位符用的是同一个 ref+reason，只能靠 `message` 区分。
  3. 邮件模板缺必含项：400 `INVALID_REQUEST`，**没有 `details`**，原因只在英文 `message` 里：`body must contain {code}`（`{code}` 换成该模板要求的占位符）；未知占位符 `body contains an unknown placeholder {x}`；`subject is required`（`subject` 没带或为 null 时）；`subject` 是空串、全空白或超过 200 个字符时是 `subject must be 1 to 200 characters`；`body is required`（`body` 为 null 或全空白）；含 NUL `… contains a character that cannot be stored`。所以邮件模板这一类现在没有机器可读的原因码。
  4. 短信模板列表 `GET /sms/templates` 返回 `{items:[…]}`，**不分页**，没有 `total`（渠道列表同样）。
- 依据：`ADMIN/facade/SmsAdminFacade.java:151-159`、`:481-494`；`CORE/sms/service/SmsTemplateAdminService.java:64-97,100-144,192-198`；`CORE/sms/service/SmsInputs.java:30,66-90,104-109`；`CORE/mail/service/EmailTemplateService.java:82-99,127-168`（`checkSubject` 128-139，`checkBody` 141-151）；`ADMIN/facade/EmailTemplateAdminFacade.java:60-67,83-85`；`ADMIN/facade/SmsAdminFacade.java:176-180,312-314`（列表无分页）；DOC 3835（`OTP` 模板必须含 `{code}`）、DOC 2401、2473（邮件模板必含项，缺了 400 `INVALID_REQUEST`）。
- 和前端暂定做法：一致（“遇到没有译文的原因码写‘输入内容不合法’”适用于邮件模板这类没有 `details` 的 400；短信模板这边有 ref=`content`、reason=`OUT_OF_RANGE`，可以加一句固定说明）。
- 改动请求：无
- 核实程度：已核实

### 127（站内通知）`POST /notifications/send` 被拒时 `details` 的 `ref` 和原因码；会不会被截断、总数放在哪
- 答案：先做请求体检查（不碰数据库，所有问题一次列完，不写任何行），通过后再查账号，两个阶段的结果不会混在同一个响应里。
  1. 收件人列表 `accountIds`：缺、null、空数组 → ref=`accountIds`、`EMPTY_NOT_ALLOWED`；不是数组 → ref=`accountIds`、`OUT_OF_RANGE`；个数超过 `notification.max_recipients`（默认 1000）→ ref=`accountIds`、`OUT_OF_RANGE`（只这一条，不再逐个检查）；某个元素不是 36 位标准 UUID → ref=该元素的文本（最多取前 64 个字符，去掉 NUL；元素不是字符串时 ref 为 `accountIds`）、`OUT_OF_RANGE`；重复的账号 → ref=该账号 ID（规整成小写的标准写法，每个重复的 ID 只报一次）、reason=`DUPLICATE`。
  2. 标题和正文（`titleI18n`、`bodyI18n`，规则相同）：缺、null、空对象 → ref=`titleI18n.en`（正文是 `bodyI18n.en`）、`EMPTY_NOT_ALLOWED`；不是对象 → ref=`titleI18n`、`OUT_OF_RANGE`；某个语言键不合法（不匹配 `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` 或超过 35 个字符）→ ref=`titleI18n.<语言键>`、`INVALID_LANGUAGE_TAG`；忽略大小写后重复的语言键 → 后出现的那个 ref=`titleI18n.<键>`、`DUPLICATE`；值不是字符串 → `OUT_OF_RANGE`；含 U+0000 → `INVALID_CHARACTER`；去空白后为空 → `EMPTY_NOT_ALLOWED`；超长（标题 100、正文 500 个字符，去空白后按码点算）→ `TOO_LONG`；没有小写 `en` 键（区分大小写，`EN` 不算）→ ref=`titleI18n.en`、`EMPTY_NOT_ALLOWED`。
  3. 其他字段：`push` 缺或 null → ref=`push`、`EMPTY_NOT_ALLOWED`，不是布尔 → `NOT_BOOLEAN`；链接 ref=`linkType`/`linkTarget`（见第 128 条）。
  4. 账号检查（请求体都通过后）：账号不存在 → ref=账号 ID（小写标准写法）、`ACCOUNT_NOT_FOUND`；状态不是 `ACTIVE` → `ACCOUNT_NOT_ACTIVE`；有一个就整个请求失败、什么都不写，所有有问题的账号一并列出。
  5. 会不会被截断、总数放哪：**不截断**，`details` 里有多少问题就列多少条（最多约等于收件人上限 1000 条）；也**没有总数字段**，`data` 里只有 `details`。我在 `common/web` 下搜了 `details`，没有看到任何截断逻辑。
- 依据：`CORE/facade/NotificationFacade.java:274-324`（账号阶段，`ACCOUNT_NOT_FOUND`/`ACCOUNT_NOT_ACTIVE` 在 292-296）、`:406-431`（`parseSend`）、`:433-466`（`accountIds`）、`:468-516`（`texts`，缺 `en` 在 512-514）、`:616-632`；`CORE/facade/NotificationFacade.java:88-97`（长度常量与 `DUPLICATE`/`INVALID_CHARACTER`）；DOC 4015（同样的 `ref` 与 `reason` 约定，包括 `accountIds` 的三种情形和重复的写法）、DOC 112（`ref` 约定）。
- 和前端暂定做法：一致（“按我们写的形式处理，不认识的 `ref` 原样列出”可行；缺 `en` 的 `ref` 是 `titleI18n.en`/`bodyI18n.en`，文档 4015 没写这一条，要补进前端的 `ref` 清单）。
- 改动请求：无
- 核实程度：已核实

### 128（站内通知）没有链接时省略 `linkType`、`linkTarget` 是否等于 `NONE`；语言标签大小写；只写标题或只写正文；收件账号编号大小写
- 答案：
  1. 省略（或 null）`linkType` = `NONE`；省略（或 null、空字符串）`linkTarget` = 没有目标。`NONE` 带非空 `linkTarget` → ref=`linkTarget`、`OUT_OF_RANGE`。`linkType` 不是 `NONE`/`SCREEN`/`URL`（含空字符串）→ ref=`linkType`、`OUT_OF_RANGE`；`SCREEN` 没目标 → `linkTarget`、`EMPTY_NOT_ALLOWED`，目标不在清单里 → `OUT_OF_RANGE`；`URL` 按 1.7 的链接规则，原因码是链接规则的那些；`linkType`、`linkTarget` 的 JSON 类型不是字符串 → `OUT_OF_RANGE`。
  2. 语言标签大小写：语言键**接受大写**（匹配 `^[A-Za-z]{2,3}…`），原样存；但“必须含 `en`”是**区分大小写**的，`EN` 不满足，缺 `en` 会被拒。同一张表里忽略大小写后重复的键 → `DUPLICATE`。
  3. 一种语言只写标题或只写正文：**允许**。`titleI18n` 和 `bodyI18n` 是两张独立的表，只要求各自含 `en`，不要求两张表的语言一致；读取时标题和正文各自按语言协商取。
  4. 收件账号编号：接受大小写任意的 36 位标准 UUID，内部转成 UUID 比较，重复判断不区分大小写，响应里的 `ref` 一律是小写标准写法；不是 36 位标准写法（如缺连字符）→ 不接受。
- 依据：`CORE/facade/NotificationFacade.java:468-516`（`texts`：483 语言键、487 忽略大小写查重、512 `node.has("en")`）、`:518-538`（`link`）、`:616-626`（`canonicalUuid`）、`:412-413`（标题与正文各自独立解析）；`CORE/notification/service/NotificationLinkRule.java:34-59`；DOC 4015（“`linkType` 缺省为 `NONE`，`NONE` 不能带 `linkTarget`（空字符串视为没有）”；语言键规则；“都必须含 `en`”）。
- 和前端暂定做法：一致（页面要求小写 `en`正确；“每种语言标题正文都要填”比后端更严，可以保留，也可以放宽，后端都收）。
- 改动请求：无
- 核实程度：已核实

### 129（客户端配置）`PUT`、`reset` 成功返回什么；`PUT` 被拒的 `reason`（非本地化键提交语言键、`inviteShareText` 含其他占位符、`inviteLinkBase` 带查询或片段）；`EMAIL` 的真实格式规则
- 答案：
  1. 成功返回：`PUT` 和 `reset` 都返回该键在 `GET /client-config` 里的**同一项**：`{key, type, localized, readOnly, configured, defaultValue, values, updatedBy, updatedByUsername, updatedAt}`（保存后重新读出来的）。`reset` 之后 `configured=false`、`values={}`、`updatedBy`/`updatedAt` 为 null。对只读键（`phoneLoginEnabled` 等六个）`PUT`/`reset` → 400 `INVALID_REQUEST`（无 `details`）；键不存在 → 404 `RESOURCE_NOT_FOUND`。
  2. 非本地化的键提交了语言键：ref=该语言标签、reason=`INVALID_LANGUAGE_TAG`（`localized=false` 的键只接受空字符串键，即默认值）。
  3. `inviteShareText` 含 `{link}`、`{code}` 以外的 `{…}`：ref=所在语言标签（默认值写 `default`）、reason=`OUT_OF_RANGE`；超长（500 个字符，去空白后算）→ `TOO_LONG`。`inviteShareTitle` 超 200 → `TOO_LONG`，不检查花括号。
  4. `inviteLinkBase` 带 `?` 或 `#`：ref 同上、reason=`INVALID_PATH`；其余按 1.7 链接规则给 `NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`；空字符串 → `EMPTY_NOT_ALLOWED`。
  5. `EMAIL`（`supportEmail`）：先去首尾空白，全空 → `EMPTY_NOT_ALLOWED`；再按 2.2 的简化规则：恰好一个 `@`，`@` 前后都不为空，`@` 后至少有一个 `.`，UTF-8 不超过 254 字节；不满足 → `INVALID_EMAIL`；通过后存成“只把 ASCII 大写字母改小写”的写法。不检查域名字符、空格、`..` 等。
  6. 整体问题的 ref=`values`：缺或 null 或空对象 → `EMPTY_NOT_ALLOWED`，不是对象 → `OUT_OF_RANGE`，超过 64 种语言 → `OUT_OF_RANGE`。每种语言的所有问题一次性全列。值是 JSON null → `EMPTY_NOT_ALLOWED`；类型不对（文本类给了数字等）→ `OUT_OF_RANGE`；整数类给了小数或字符串 → `NOT_AN_INTEGER`，超范围 → `OUT_OF_RANGE`；布尔类 → `NOT_BOOLEAN`。
  7. 请求体不是 JSON 对象、有重复键、尾部有多余内容 → 400 `INVALID_REQUEST`，无 `details`。
- 依据：`ADMIN/facade/ClientConfigAdminFacade.java:41-52,74-93`；`CORE/clientconfig/service/ClientConfigService.java:318-357,370-429`；`CORE/clientconfig/service/ClientConfigValidator.java:85-129`（语言键 111-117）、`:157-170`（`URL`）、`:172-187`（`EMAIL`）、`:189-208`（`STRING`）、`:210-222`（`INT`）；`CORE/clientconfig/service/ClientConfigRegistry.java:80-99`（键与占位符、`inviteLinkBase` 的 `noQueryOrFragment`）；`CORE/user/service/EmailNormalizer.java:34-49`；`ADMIN/controller/ClientConfigAdminController.java:30-39,65-76`；DOC 4118（所有这些原因码都已写明，只有“非本地化键提交语言键”写的是笼统的 `INVALID_REQUEST`）、DOC 112（`ref` 约定）。
- 和前端暂定做法：部分一致（“不读响应”可行；邮箱按我们自己的规则检查——前端的本地规则不要比后端严，否则会拦住后端能收的写法；若要对齐，用上面第 5 点的简化规则；`INVALID_LANGUAGE_TAG` 用于非本地化键，需要一条按码译文）。
- 改动请求：无
- 核实程度：已核实

### 130（客户端配置）同一主语言、前缀与文字变体都比不出先后时“取列表里靠前的第一个”，客户端配置里这个“列表”按什么顺序排
- 答案：按这个键已存的语言标签（不含默认值那一行）做 Java 字符串**自然顺序**排序（`sorted()`），即按 UTF-16 码元逐个比较：**区分大小写**，大写字母排在小写字母之前（`Zh` 在 `en` 之前），连字符 `-` 排在字母和数字之前（`zh` 在 `zh-Hans` 之前）。标签原样存（不转小写），所以实际顺序取决于运营录入时的大小写。在这之前的步骤（完整匹配、同主语言的前缀匹配、`zh` 的文字变体筛选）按契约 1.2 先做，排序只在最后一步决定。
- 依据：`CORE/clientconfig/service/ClientConfigService.java:162-174`（165-167 行 `sorted()` 后交给协商）；`COMMON/text/LanguageNegotiator.java:145-176`（`choose` 最后 `candidates.getFirst()`）；`CORE/clientconfig/service/ClientConfigValidator.java:107-124`（标签原样存）；DOC 50（1.2 “最后取列表里靠前的第一个”，没写客户端配置里这个列表的顺序）、DOC 4082（26.1 语言行，同样没写）。
- 和前端暂定做法：不一致（前端要改：预览排序不能用“字母顺序”的本地化比较（如 `localeCompare`）或忽略大小写的比较，要用按码元的原始字符串比较，且先排除默认值那一行；契约两处都没写这个顺序，建议由改契约的人补写）。
- 改动请求：无
- 核实程度：已核实

### 131（系统配置）`attribution.facebook_graph_version` 格式不对时 `details` 里的 `reason`
- 答案：`OUT_OF_RANGE`。该键是字符串型，要求匹配 `^v[0-9]{2}\.[0-9]$`；不匹配走通用的“正则不匹配”分支，除 `push.default_locale`（用 `INVALID_LANGUAGE_TAG`）外一律 `OUT_OF_RANGE`。ref=`attribution.facebook_graph_version`。同一个键上的其他拒绝：空字符串 → `EMPTY_NOT_ALLOWED`，不是字符串 → `OUT_OF_RANGE`，含控制字符 → `OUT_OF_RANGE`。默认值 `v26.0`，编辑权限 `ATTRIBUTION:MANAGE`。新版文档 17.5 的设置表里有这个键（DOC 2583：默认 `v26.0`，出处 10.5，编辑权限 `ATTRIBUTION:MANAGE`，说明写“必须匹配 `^v[0-9]{2}\.[0-9]$`，否则 400 `INVALID_REQUEST`；Meta 对一个版本的支持期约一年……到期前调高”），转化回传一节（DOC 1532）也引用了它；文档没有写原因码，原因码以代码为准（代码里它的标记是 `Origin.EXTRA`）。
- 依据：`CORE/shared/config/ConfigKeys.java:699-700`；`CORE/shared/config/ConfigKeySpec.java:223-258`（正则不匹配在 251-253）、`:289-291`（`patternReason`）；`CORE/shared/config/ConfigValidator.java:137-147`（第一阶段先检查键自己的规则）；DOC 2583（表里的这一行）、DOC 1532。
- 和前端暂定做法：一致（原因码 `OUT_OF_RANGE` 不变；前端可以直接取 DOC 2583 的说明文字写这个键的说明：Graph API 版本、格式 `v26.0`、到期前调高）
- 改动请求：无
- 核实程度：已核实

### 132（系统配置）其余成对设置保存被拒时 `details` 是否也列出两个键（保存的键在前）
- 答案：是。所有“关系约束”走同一个地方：关系不成立时，`details` 先放被保存的键（`OUT_OF_RANGE`），再放同一关系里的其他键（`OUT_OF_RANGE`）。你问的五对都在这张关系表里：`retry.initial_seconds` / `retry.max_seconds`（初始不能大于最大）；`moderation.review_score` / `moderation.block_score`（复核分必须小于拦截分）；`generation.voice_min_seconds` / `generation.voice_max_seconds`（最短不能大于最长）；`export.job_timeout_minutes` / `export.lease_minutes`（超时必须大于租约）；`auth.access_ttl_minutes` / `auth.refresh_ttl_days`（访问令牌分钟数不能超过刷新令牌天数×1440）。注意两点：①关系只在“两个键都有值”时才检查（审核两个分数没有默认值，另一个没保存过就不检查）；保存的值本身先过键自己的规则，没过时只列这一个键，不会列另一个；②重置某个无默认值的键时关系不检查。
- 依据：`CORE/shared/config/ConfigValidator.java:150-165`（循环，列出两个键在 156-163）、`:283-368`（关系表：重试 284-287、导出 288-291、令牌 292-298、审核 299-302、声音时长 365-368）、`:241-249`（`allSet`）；DOC 2489（只写了 `usage_price`、`push` 等几对会列两个键，上面五对没写 `details`）。
- 和前端暂定做法：一致（“两种形状都能处理”可保留；真实后端一律是两个键）。
- 改动请求：无
- 核实程度：已核实

### 133（系统配置）保存 `app.supported_locales` 被拒时，同一组 `ref` 和 `reason` 是否还用在别的情形
- 答案：是，`ref=app.supported_locales`、`reason=OUT_OF_RANGE` 还用在这些情形：①值不是数组；②某个元素不是字符串或含控制字符；③忽略大小写后有重复项；④缺 `en`（区分大小写，`EN` 不算）。另外，某个元素不是合法语言标签（不匹配正则或超过 35 个字符）的原因码是 `INVALID_LANGUAGE_TAG`，不是 `OUT_OF_RANGE`；一个键上可能同时有几条（每个不同的 `reason` 各一条）。只有“有语言没有通知模板文件”这一种会带 `data.missingLanguages`（按请求顺序列出缺文件的语言），其余情形没有这个字段，所以前端可以用“有没有 `missingLanguages`”来区分。检查顺序：键自己的规则（数组、标签、重复、含 `en`）在先，没过就不会走到模板文件检查。
- 依据：`CORE/shared/config/ConfigKeyTypes.java:56,63-64,434-440`（规则：`LOCALE_TAG`、`distinctIgnoringCase`、`mustContain("en")`）；`CORE/shared/config/ConfigKeySpec.java:306-339`（元素逐个检查、重复 327-330、缺 `en` 335-337）；`CORE/facade/SupportedLocalesConfigValidator.java:47-65`（模板文件检查，`missingLanguages` 在 55-62）；`CORE/shared/config/ConfigValidator.java:137-147,166-179`；DOC 2603（保存被拒的写法与 `data.missingLanguages`）、DOC 2489（元素规则、不重复、含 `en`）。
- 和前端暂定做法：一致（前端提交前已拦住缺 `en`、重复；其余情形 `OUT_OF_RANGE` 但没有 `missingLanguages` 时，不要显示“缺模板文件”的话）。
- 改动请求：无
- 核实程度：已核实

### 138（短信与邮件）邮件模板 `PUT` 和 `reset` 的响应；正文长度上限、能否为空
- 答案：
  1. 响应：`PUT` 和 `reset` 都返回该模板在 `GET /email/templates` 里的同一项：`{templateCode, subject, body, defaultSubject, defaultBody, modified, updatedBy, updatedByUsername, updatedAt, placeholders, requiredPlaceholders}`（保存后重新读出）；`reset` 之后 `modified=false`，`updatedBy`/`updatedAt` 为 null，`subject`/`body` 等于默认值。`templateCode` 不在清单里 → 404 `RESOURCE_NOT_FOUND`。
  2. 正文能否为空：**不能**。去空白后为空 → 400 `INVALID_REQUEST`（`body is required`），无 `details`；还要含该模板的全部必含占位符（带花括号、区分大小写），且只能用该模板声明的占位符。
  3. 正文长度上限：代码里**没有**。正文原样存（不去首尾空白），数据库列是 `text`，唯一的上限是整个请求体 8 MiB。标题（`subject`）去空白后 1 到 200 个字符。标题和正文都不能含 NUL（U+0000）。
  4. 模板个数：代码和数据库约束里都是 **6 个**（`REGISTER_CODE`、`PASSWORD_RESET`、`DELETION_CONFIRM`、`PASSWORD_CHANGED`、`LIKENESS_COMPLAINT_RECEIVED`、`LOGIN_METHOD_ADDED`）。
- 依据：`ADMIN/facade/EmailTemplateAdminFacade.java:35-51,60-87`；`CORE/mail/service/EmailTemplateService.java:82-99,127-168`；`CORE/mail/api/EmailTemplateCode.java:11-28,31`；`core/src/main/resources/db/migration/V1__schema.sql:386-397`；`core/src/main/resources/avatar-shared.yml:65`；DOC 2401（`subject` 1 到 200 个字符、必含占位符、不含 NUL）、DOC 2473（响应字段；这里写“五个模板码”，与 2401 的“六个”和代码不一致）。
- 和前端暂定做法：一致（“不读响应；要求去空白后正文不为空，不限长度”与后端一致；若页面想显示最新状态可直接读响应）。
- 改动请求：无
- 核实程度：已核实

### 139（系统配置）14 个设置项的说明核对，特别是 `recall.window_minutes`、`recall.inactive_hours`、`recall.streak_min_days`、`export.min_interval_hours`、`support.rate_limit_per_hour`、`events.max_body_kb` 的单位和方向，以及审核分数与阈值的方向
- 答案：逐行（“对”表示前端的话和代码行为一致）：
  1. `admin.jwt_ttl_hours`：对。签发管理员令牌时按这个小时数设定过期；改了只影响之后签发的令牌，已签发的不变。
  2. `generation.poll_interval_seconds`：**需改写**。这是后端后台任务自己的周期：每隔这么多秒做一轮“提交生成任务”“查询未完成任务的结果”“清扫声音任务”（三个定时任务共用这个值），不是客户端轮询；任何客户端接口都不返回它。建议说法：“后端检查未完成的生成任务的间隔，秒”。
  3. `chat.history_max_limit`：基本对，但要补一句：请求里的 `limit` 超过它不是被截成它，而是 400；不带 `limit` 时取 50 与它的较小者（`DEFAULT_HISTORY_LIMIT = 50`）。
  4. `events.max_batch`：基本对，补一句：一次上传的事件数超过它，整个请求被拒，413 `BATCH_TOO_LARGE`。
  5. `events.max_body_kb`：对；1 KB = **1024 字节**（`×1024`），超过 413 `BATCH_TOO_LARGE`。
  6. `recall.scan_interval_minutes`：对。后台定时任务每隔这么多分钟扫描一次；它还影响候选窗口（窗口末尾再加一个扫描间隔，保证最后一次扫描仍能覆盖到窗口末尾的账号）。范围 1 到 1440。
  7. `recall.window_minutes`：对，且方向明确：**从“当地发送小时”整点起向后**的窗口（不是以该小时为中心），长度为这个分钟数（范围 1 到 1440）。每个账号在窗口内的具体发送分钟 = 账号 ID 的哈希对窗口分钟数取余，所以窗口越长，发送越分散。
  8. `recall.inactive_hours`：对，但要补“从哪一刻起算”：从账号**最后一次互动时刻**（`lastInteractionAt`，文字对话和通话都会更新）起算；从没互动过的账号从**账号创建时刻**起算；条件是“超过”（严格大于）这个小时数；用于“每日召回”这一类原因。
  9. `recall.streak_min_days`：对，方向是**大于等于**（`currentStreak >= 设定值`），并且最后互动日期是用户当地的昨天（今天还没互动，连续记录快断了）才触发“连续记录有断掉风险”召回，优先于每日召回。
  10. `milestone.days`：对。账号的“陪伴天数”达到（大于等于）数组里某个值就记一个里程碑；数组是 1 到 20 个互不相同的正整数；每次检查时现读，改了从下一次检查开始生效，不补发以前的。
  11. `support.rate_limit_per_hour`：对，补充：按**账号**（不是按 IP）、针对 `POST /api/support/feedback`，每小时最多这么多次，超过 429 `RATE_LIMITED`。
  12. `export.min_interval_hours`：对，补充：按**用户账号**（用户自己的数据导出，不是管理员的统计导出），从该账号上一次**成功**导出的创建时刻起算（失败或进行中的不算），间隔内再申请 → 429 `RATE_LIMITED`（响应带 `retryAfterSeconds`）。
  13. `export.ttl_hours`：对，补充：导出文件发布时就把“过期时刻 = 发布时刻 + 这个小时数”记到那一条导出上，之后改设置不影响已发布的；过期后由清扫任务标记过期并删除文件。
  14. `ads.preload_enabled`：对。它通过 `GET /api/ads/config` 的 `globalConfig.preloadEnabled` 告诉客户端是否预加载广告（配合 `ads.preload_ttl_minutes`）。
  - 审核分数与阈值的方向（`moderation.block_score`、`moderation.review_score`）：审核服务给出分数（0 到 1）后，**分数 ≥ 拦截阈值 → 拦截；否则分数 ≥ 复核阈值 → 进人工复核；否则通过**。两个阈值取值范围是大于 0、不超过 1，最多三位小数；复核阈值必须小于拦截阈值（两个都保存时检查）。所以调高阈值是“更少拦截、更少误伤”。两个阈值里只要有任何一个没保存，就不调用审核服务（读没保存的键会抛 `ConfigNotSetException`，`modelCheck()` 捕获后返回 null）；调用还要求 `moderation.model_check_enabled` 为真且恰好有一个审核服务适配器。可以把方向写回说明；若要写“未保存时的行为”，写“任一阈值没保存都不调用”。
  - `complaint.likeness_due_hours`：处理时限在**投诉收到时**就算好并存下来（截止时刻 = 收到时刻 + 设定小时数），之后改设置只影响以后收到的投诉，不影响已有的。说明里“改大会更晚发现”的推断方向是对的，但只针对新投诉。
- 依据：`CORE/adminuser/service/AdminAuthService.java:386-391`；`worker/src/main/java/com/avatarapp/backend/worker/job/GenerationPollJob.java:26-33`、`GenerationSubmitJob.java:28-35`、`VoiceSweepJob.java:24-32`；`CORE/facade/ChatFacade.java:87,452-456,498-512`；`CORE/event/service/EventIntakeService.java:116-119,135-137`、`CORE/facade/EventFacade.java:52-62`；`CORE/push/service/RecallSelector.java:64-72,82-100,105-120,127-145,149-157,165-173`（窗口、触发、`>=`、`>`）、`CORE/push/service/RecallService.java:75-83`、`worker/src/main/java/com/avatarapp/backend/worker/job/RecallScanJob.java:43-46`；`CORE/growth/service/MilestoneService.java:67-82`；`CORE/ratelimit/service/RateRuleTable.java:306-314`、`CORE/ratelimit/api/SubjectKind.java:15-16`；`CORE/export/service/ExportService.java:164-177`、`CORE/export/repository/ExportJobRepository.java:94-103`、`CORE/export/service/ExportRunner.java:340-343`；`CORE/ad/service/AdSelectionService.java:167-176`；`CORE/moderation/service/ModerationService.java:195-210,281-292`、`CORE/shared/config/ConfigKeyTypes.java:468-473`；`CORE/moderation/service/LikenessComplaintService.java:178-180`；DOC 1380-1385（召回条件，与代码一致）、DOC 1213（`lastInteractionAt`）、DOC 247（支持反馈限流“每账号每小时”）、DOC 2500、2544、2565、2589、2592、2596-2601、2621、2640-2642、2704（这些行的“说明”栏确实是空的或只有范围）、DOC 2622-2623（审核分数说明）。
- 和前端暂定做法：不一致（前端要改：第 2 条（`generation.poll_interval_seconds`）的说明要改成“后端检查未完成生成任务的间隔”；第 3、4、5 条补“超过会被拒”的后果；第 8、9、11、12 条补上面的起算点、方向、按谁；`moderation.*` 可以把方向写回；其余保持）。
- 改动请求：无
- 核实程度：已核实

---

## 对照复查

### 对照复查 2（短信与邮件）短信发送记录里号码的掩码格式，存库的号码是否不带空格
- 新版接口文档写法是否变了：没变。号码掩码规则全文统一（DOC 562，2.9 一节）：“只保留末 4 位，前面的数字以 `*` 代替，保留开头的 `+`”；发送记录的 `mobile` 是 E.164（DOC 3839）；号码默认掩码、持有 `SMS:RECORD:PHONE_VIEW` 才返回完整号码、筛选只支持完整号码精确匹配（DOC 3859、3898）。
- 代码是否这样做：是。①掩码：`CORE/sms/service/SmsRecordQueryService.java:48-65`（`+` 保留，数字只留最后 4 个，其余换成 `*`，例如 `+6591234567` → `+******4567`；与 `COMMON/text/PersonalDataMask.java:67-90` 的 `maskPhone` 是同一规则，两处各有一份实现）；记录列表和导出行在无 `SMS:RECORD:PHONE_VIEW` 时都套用它（`SmsRecordQueryService.java:67-88`；`SmsAdminFacade.java:375-380,392-405`）；导出的审计筛选里号码也先掩码（`SmsAdminFacade.java:396`）。②存库：所有写发送记录的路径都用 `PhoneNumbers.parse(...)` 的 `e164()`（`CORE/sms/service/PhoneNumbers.java:53-72`，格式化成 `PhoneNumberFormat.E164`，即 `+` 加纯数字，无空格、连字符、括号；入口 `PhoneAuthFacade.java:195,246,395,427`，测试发送 `SmsTestSendService.java:112,129`）；推送记录和短信记录用同一个字段（`PhoneOtpService.java:208-219,288`）。③筛选：`mobile` 按存的原样精确比较（`SmsSendRecordStore.java:237,255-259`），不做规整。
- 结论：仍然正确。补充一点：号码少于 4 位数字时会全部显示（不会出现，因为存的都是有效 E.164），且筛选时要发 E.164 原样写法。
- 核实程度：已核实

---

## 我发现的、问题表没问到但前端会踩到的坑

1. 假后端与真后端在 `credentials` 上不同：`credentials: null`、空名称、空值，真后端都当作合法（null = 不改；空名称、空值会被加密保存），不是 400（`ADMIN/facade/SmsAdminFacade.java:432-447`）。
2. 生产环境下 `GET /sms/meta` 的 `providers` 目前是空列表：主代码里唯一的适配器 `local-stub` 在生产环境 `usableHere()=false`，渠道表单的服务商下拉会是空的，直到真实供应商适配器加入（`CORE/sms/adapter/LocalStubSmsGateway.java:45-47`；`CORE/sms/service/SmsProviders.java:51-53`）。
3. 渠道的“最后一个验证码渠道”被拒的 `details` 是 `SmsChannel`+`OUT_OF_RANGE`，文档 23.4 只写了模板的 `SmsTemplate` 那一半（`CORE/sms/service/SmsChannelAdminService.java:267-274`）。
4. 渠道的 `POST`、`PUT` 响应是 `{channel, warnings}`，而 `PUT …/enabled` 响应是裸渠道对象（`ADMIN/facade/SmsAdminFacade.java:174,258-271`）。
5. 短信记录列表的筛选值不做取值校验（写错得到空列表），`mobile` 不规整（`CORE/sms/service/SmsSendRecordStore.java:233-259`）。
6. 测试发送在判断渠道是否可用之前就扣了当天额度，`SMS_SEND_FAILED` 503 也会扣一条；无效号码不扣（`CORE/sms/service/SmsTestSendService.java:112-120`）。
7. 客户端配置 `PUT` 请求里的 `expectedUpdatedAt` 被静默忽略，不会 409（`ADMIN/controller/ClientConfigAdminController.java:65-76`）。
8. 开启手机号登录被拒时 `details` 最多 4 条，`ref` 可能是配置键，也可能是 `SmsChannel`、`SmsTemplate`（不是配置键，页面上没有对应行）（`CORE/sms/service/SmsSettingValidator.java:102-129`）。
9. 站内通知的 `from`、`to` 必须带时区偏移（`Z` 或 `+08:00`），只写日期会 400（`CORE/facade/NotificationFacade.java:595-609`）。
10. 邮件模板的所有拒绝都没有 `details`，原因只在英文 `message` 里（`CORE/mail/service/EmailTemplateService.java:127-168`）。

## 后端代码与接口文档互相矛盾（或文档自相矛盾）的地方
- 5/78：DOC 3852 写“`credentials` 是值为非空字符串的对象”；代码只拒 null，空串的值、空串的名称都接受（`SmsAdminFacade.java:438-445`）。
- 138：DOC 2473 写“五个模板码各一项”，DOC 2401 和代码、数据库约束都是六个（`V1__schema.sql:393-395`）。
- 41：DOC 3833 对渠道被拒没写 `details`，代码有 `[{"ref":"SmsChannel","reason":"OUT_OF_RANGE"}]`（文档缺，不算冲突）。

---

# 第 H 部分：channels-cosmetics-shared

共 20 条（18 条待答 + 2 条对照复查）：已核实 19 条，部分核实 1 条（编号 91），未核实 0 条；前端要改 10 条（47、64、89、90、91、96、97、98、100，另有 135 要改的是前端的假后端）；改动请求 11 项（建议做 10、建议不做 1；按请求项计：编号 11 一项、47 一项、67 七项、92 一项、97 一项）；接口文档新版已写明 6 条（11、47、67、84、90、92，仅按 18 条待答计）。

已按独立核对结果更正：更正 1 处，行号 3 处。

读法说明：
- 路径都相对 `D:\Projects\PycharmProjects\AvatarBackend`；"接口文档"= `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md`（提交 e07469d1，下面只写行号）。
- 没有运行任何请求、构建或测试。凡写"已核实"都是读了代码行；个别靠运行才能确认的细节在该条里写明。
- 控制器简称：`admin/.../controller/` = `admin/src/main/java/com/avatarapp/backend/admin/controller/`；`admin/.../facade/` 同理；`core/...` = `core/src/main/java/com/avatarapp/backend/core/`。
- "INVALID_REQUEST 只有 message、没有 ref"的意思：响应 `data` 是 `null`，只有一句英文 `message`，没有 `data.details`。

### 11（形象与装扮）渲染模型的 `fileRef` 要不要返回给管理端
- 答案：现在会返回。`GET /renderer-models`、`POST /renderer-models`、`PUT /renderer-models/{id}/enabled` 的响应项 `AdminRendererModel` 有 `fileRef`（存储里的文件键），同时有 `sha256`、`sizeBytes`、`rendererFormatVersion`、`minVersionCode`、`enabled`、`createdAt`。接口文档通则只把四类列排除在响应之外（`Hash`/`Enc` 结尾、`tokenVersion`、`totpLastStep`、被签名地址替代的存储引用），`RendererModel.fileRef` 不在被替代的名单里，所以文档和代码一致：返回。
- 依据：`core/.../catalog/api/CatalogAdminTypes.java:109-121`（`fileRef` 在第 115 行）；`admin/.../facade/CatalogAdminFacade.java:346-360`（第 353 行把 `r.fileRef()` 填进响应）；`admin/.../controller/CatalogAdminController.java:164-185`；接口文档 2434（通则 1）、2436（通则 3 只列 `previewRef`、`iconRef`、`sourceImageRef`、`AvatarLook.previewRef`）。
- 和前端暂定做法：一致（前端不使用、不显示即可，多出一个字段不影响）。
- 改动请求：建议做（存储键对浏览器没有用；这个管理接口只有管理端前端在用，客户端下载渲染模型走的是另一组公开接口，去掉这一列不影响别的调用方；需要同时在接口文档通则 3 的名单里加上 `RendererModel.fileRef`，改的是后端的响应类和契约一行）。
- 核实程度：已核实

### 23（渠道包与应用版本）`GET /channels` 分页吗、字段名、外层形状
- 答案：
  1. 不分页。返回全部渠道，按 `code` 升序（SQL `ORDER BY code`）。接口方法没有分页参数，所以 `page`、`pageSize` 发了也被忽略（不会校验，传 0 也不报错）。
  2. 字段名是 `code`（不是 `channelCode`），整行是：`code`、`name`、`platform`、`distribution`、`packageName`、`enabled`、`createdAt`、`updatedAt`。有 `updatedAt`。
  3. 外层形状：`data` 直接是一个数组 `[ {...}, {...} ]`，不是 `{items:[...]}`，也没有 `total`。这和接口文档通则 1 写的"不分页的接口只有 `items`"不一致（见文末矛盾清单）。前端"两种外层形状都接受"的做法正好兜住。
  4. 谁能调：任何已登录的管理员（`@AdminAuthenticated`，不挂权限码），与接口文档一致。
- 依据：`admin/.../controller/ChannelAdminController.java:39-43`（返回类型 `ApiResponse<List<ChannelItem>>`）；`admin/.../facade/AppVersionAdminFacade.java:134-142`（`ChannelItem` 的字段）、`251-255`；`core/.../appversion/repository/ChannelRepository.java:49`；测试 `admin/src/test/java/com/avatarapp/backend/admin/AppVersionAdminIT.java:645-651`（对 `data` 直接遍历取 `code`）；接口文档 3984（只写了"`GET /channels`（任何登录的管理员都能调）"，没写外层形状）、2434（通则 1）。
- 和前端暂定做法：一致（读 `code`、两种外层形状都接受、不分页）。
- 改动请求：无
- 核实程度：已核实

### 47（渠道包与应用版本）409 `INVALID_STATE` 能否给确定的 `data.status`；重复检查先后
- 答案：
  1. 现在的 409 `INVALID_STATE` 里只有"上传记录已被别的版本使用"这一种带 `data`：`{"status":"CONSUMED"}`，`message` 是 "Upload is already used"。渠道已停用、版本不是草稿（编辑、删除、激活时）、下线时版本不是生效中、激活时同渠道已被别人激活，这几种都是 409 `INVALID_STATE`，但 `data` 是 `null`，只有英文 `message`（"The channel is disabled"、"Only a DRAFT version can be edited or deleted"、"Only a DRAFT version can be activated"、"Only an ACTIVE version can be archived"、"Another version of this channel was activated"）。没有 `CHANNEL_DISABLED`、`UPLOAD_USED` 这样的值，上传被用的状态值就是 `CONSUMED`。
  2. 这和接口文档不一致：文档 150 行和 2372 行写 409 `INVALID_STATE` 的 `data.status` 是当前状态，应该总是有（见文末矛盾清单）。
  3. 检查先后：新建版本时先过请求体字段检查（400）和上传记录检查（404/400），然后在事务里是 `(channelCode, versionCode)` 重复（409 `DUPLICATE_RESOURCE`，`data.field="versionCode"`）→ 版本号不大于该渠道所有其他版本（含草稿、已下线）的最大值（400 `INVALID_REQUEST`，`message` 写明最大值）→ 渠道已停用（409，无 `data`）→ 写入 → 消耗上传（已被用时 409，`data.status="CONSUMED"`）。所以重复检查先于"不大于"检查，与接口文档 3926 一致（"先于大小比较"）。激活时检查顺序是：状态 409 → `confirmStoreLive` 400 → 版本号 400（必须大于该渠道所有生效过的版本）→ 直装版本的文件与基址 400 → 渠道停用 409，与文档 3930 一致。
- 依据：`core/.../shared/upload/DefaultAdminUploadService.java:301`；`core/.../appversion/service/AppVersionAdminService.java:117-126`、`202-243`（第 205 行重复/大小检查，206 行停用检查，228-230 行消耗上传）、`250-306`、`335-363`、`387-412`（`invalidState` 不带 data）；`admin/.../facade/AppVersionAdminFacade.java:212-247`；错误信封 `common/src/main/java/com/avatarapp/backend/common/web/ApiException.java:29-35`、`GlobalExceptionHandler.java:80-104`（`data` 原样输出）；接口文档 150、2372、3926、3930。
- 和前端暂定做法：不一致（前端要改：暂定"遇到 409 且 `data.status` 不是版本状态就提示重新上传"会误判，因为渠道停用的 409 没有 `data`，会被当成"上传问题"。要改成精确判断 `data.status === "CONSUMED"` 才提示重新上传；`data` 缺失时只显示通用的 `error.INVALID_STATE` 文字，或按触发的操作自己判断（新建版本遇到无 `data` 的 409 多半是渠道停用）。若后端按下面的请求补上 `data.status`，再改回按值区分）。
- 改动请求：建议做（把版本、渠道的 409 补上 `data.status`，与文档 150 和 2372 对齐：渠道停用写 `DISABLED`（渠道当前状态），版本状态不对写版本的当前 `status`（`DRAFT`/`ACTIVE`/`ARCHIVED`），上传被用保持 `CONSUMED`；比前端提的 `CHANNEL_DISABLED`/`UPLOAD_USED` 更贴合"`data.status` 是对象当前状态"的通则，其他调用方只多读到一个字段，不受影响）。
- 核实程度：已核实

### 64（形象与装扮）五个目录列表分不分页、`/cosmetics` 筛选参数、生成任务和投诉的排序
- 答案：
  1. 分页：`GET /cosmetics`、`/actions`、`/declarations`、`/renderer-models`、`/generation-tasks` 全部分页，参数是 `page`（从 1）、`pageSize`（默认 20、最大 200），响应 `{"items":[...],"total":N}`。`page`/`pageSize` 不合法是 400（`data.details=[{"ref":"page"|"pageSize","reason":"OUT_OF_RANGE"|"NOT_AN_INTEGER"}]`）。前端总是发 `page`、`pageSize`、响应有 `total` 就按服务端分页，正好。
  2. `/cosmetics` 的筛选参数只有 `kind`（`OUTFIT`/`BACKGROUND`；其他值或空字符串 400，`ref` 为 `kind`，`reason` 为 `OUT_OF_RANGE`）。没有 `enabled`，也没有 `style`：这两个参数发了会被静默忽略（没有任何"未知参数"检查），也就是前端暂定的筛选会静默失效。排序固定是 `kind`、`sortOrder`、`key`（不是只按 `sortOrder`）。
  3. `/actions` 排序 `sortOrder`、`key`；`/renderer-models` 按 `createdAt` 倒序、同时间按 `id` 倒序；`/declarations` 先生效中的，再按 `activeFrom` 倒序（从未生效的排最后），再按 `version`；这四个目录除 `/cosmetics` 的 `kind` 外没有任何筛选参数。
  4. `/generation-tasks` 只有 `status`、`type` 两个筛选，排序 `createdAt` 倒序、同时间 `id` 倒序，是的。`status` 取 `PENDING`、`IN_REVIEW`、`PROCESSING`、`SUCCEEDED`、`FAILED`；`type` 取 `AVATAR`、`VOICE`、`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP`；空字符串当作没传；其他值是 400 `INVALID_REQUEST`，只有 `message`（"status is not a known value"），没有 `ref`。
  5. 投诉列表：按 `dueAt` 升序、同时间按 `id` 升序（状态筛选已答，不重复）。
- 依据：`admin/.../controller/CatalogAdminController.java:59-64`、`96-100`、`142-146`、`164-168`；`web/AdminPageQuery.java:14-18`、`web/AdminPageQueryResolver.java`；`core/.../catalog/api/CatalogAdminTypes.java:20-25`；`core/.../catalog/repository/CatalogRepository.java:147`、`358`、`460`、`539`；`admin/.../facade/CatalogAdminFacade.java:116-126`；`admin/.../controller/GenerationTaskAdminController.java:27-31`、`admin/.../facade/GenerationTaskAdminFacade.java:49-82`、`core/.../asset/service/GenerationTaskService.java:296-300`、`core/.../asset/api/TaskStatus.java:4-10`、`TaskType.java:4-10`；`core/.../moderation/repository/LikenessComplaintRepository.java:85`、`93`、`118`；接口文档 2372（分页通则）、2378（`GET /generation-tasks?status=FAILED&type=`）、2483（投诉列表排序与过滤）。
- 和前端暂定做法：不一致（前端要改：①`/cosmetics` 只能发 `kind`；"上下架状态"和"适用风格"筛选要在前端对已读到的页内做，或把这两个筛选从页面去掉；不能指望后端过滤，否则翻页后总数和页内条数对不上。②假后端的目录排序要改成 `kind`、`sortOrder`、`key`（服装）与 `sortOrder`、`key`（动作）。分页、`total`、生成任务与投诉的排序与前端一致）。
- 改动请求：无
- 核实程度：已核实

### 67（共用）`GET /meta` 能否补六个值；`GET /ads/meta` 能否加 `notSkippableFullScreenCount`
- 答案：现状：`GET /api/admin/meta` 的响应正好 20 个字段（12 个配置值 + 8 个上传限制），不含这六个值；`GET /ads/meta` 只返回 `{"geoConfigured":bool}`。接口文档 2393 和 3717 也是这样写的，文档和代码一致。逐项看后端是否容易给、是否有别的办法：
  1. `monitorMaxRangeDays`：对应配置键 `monitor.max_range_days`（编辑权限 `CONFIG:MANAGE`，默认 7）；管线监控页的权限是 `MONITOR:VIEW`，持有它的人读不到这个键。
  2. `attributionCostCurrency`：对应键 `attribution.cost_currency`（编辑权限 `ATTRIBUTION:MANAGE`，默认 `USD`）。投放成本页的权限正是 `ATTRIBUTION:MANAGE`，按文档 2393 `GET /config` 对只持有模块权限码的管理员返回那些码对应的键，所以成本页已经能读到它。此外成本列表每行有 `currency`，投放效果 `GET /attribution/summary` 的每项 `costs` 是 `[{currency, amount}]`（按币种分开，不相加），所以"在投放效果响应里带 currency"已经成立，不需要再加。
  3. `taskTypes`：不是配置键，是代码里的常量 `daily_login`、`call_seconds`、`text_messages`。
  4. `entitlementLimitMax`：键 `entitlement.limit_max`（编辑权限 `SUBSCRIPTION:CONFIG`，默认 1000000）；权益发放页用的是 `SUBSCRIPTION:GRANT`，读不到。
  5. `googlePlayPackageName`：是环境变量 `GOOGLE_PLAY_PACKAGE_NAME`，不是配置键，后端在每次保存版本时读取它。
  6. `creativeAspectTolerancePercent`：键 `ads.creative_aspect_tolerance_percent`（编辑权限 `ADS:PLACEMENT`，默认 3）；素材页用 `ADS:CREATIVE`，读不到。
  7. `notSkippableFullScreenCount`：后端没有现成的这个数；保存配置时的 `AD_FORCE_CLOSE_DISABLED` 警告已经由后端算。
- 依据：`admin/.../facade/AdminMetaFacade.java:31-51`、`53-75`；`admin/.../controller/AdminAuthController.java:68-72`；`admin/.../controller/AdAdminController.java:223-233`、`admin/.../facade/AdAdminFacade.java:211-212`、`444-446`；`core/.../shared/config/ConfigKeys.java:256`（`attribution.cost_currency`）、`448`（`monitor.max_range_days`）、`463`（`entitlement.limit_max`）、`607`（`ads.creative_aspect_tolerance_percent`）；`core/.../checkin/service/TaskTypes.java:11-17`；`admin/.../controller/MonitorAdminController.java:24-25`；`admin/.../facade/AttributionAdminFacade.java:93-96`（`CostItem(currency, amount)`）、`admin/.../facade/CampaignCostAdminFacade.java:106-119`；`core/.../appversion/service/AppVersionInputs.java`（环境变量由 `AppVersionAdminFacade.java:70`、`173` 读取）；接口文档 2393、3717。
- 和前端暂定做法：一致（取不到时不做前端预检、不显示数字；这符合现状）。
- 改动请求：
  - `monitorMaxRangeDays`：建议做（持有页面权限的人读不到配置键，不加就只能 400 后才知道；字段是当前生效值，无机密）。
  - `taskTypes`：建议做（常量清单，避免页面写死三个）。
  - `entitlementLimitMax`：建议做（同上，无机密）。
  - `creativeAspectTolerancePercent`：建议做（同上，无机密）。
  - `googlePlayPackageName`：建议做（包名是公开信息；前端要预检商店链接就必须知道它；放进 `GET /meta` 即可。注意不能用 `play` 渠道的 `packageName` 代替：后端校验链接时用的是环境变量，渠道包名被运营改过后两者会不同）。
  - `GET /ads/meta` 的 `notSkippableFullScreenCount`：建议做（没有 `ADS:CREATIVE` 的管理员数不了；需要先在契约里定义"算哪些素材"，当前后端没有这个计数，是新增计算）。
  - `attributionCostCurrency`：建议不做（成本页持有 `ATTRIBUTION:MANAGE`，`GET /config` 已返回该键；成本行和投放效果已带 `currency`）。
- 核实程度：已核实

### 83（共用）明细类列表的 `from`、`to` 是带时刻的 ISO 时间还是 UTC 日
- 答案：六个都是带时刻的 ISO-8601 时间，不是 UTC 日；`from` 含、`to` 不含（SQL/查询是 `>= from`、`< to`）。前端把所选 UTC 日变成 `[第一天T00:00:00Z, 最后一天的后一天T00:00:00Z)` 的做法是对的。逐个：
  1. 审计日志 `GET /audit-logs`：按 `createdAt`；用 `Instant.parse`，所以写 `2026-10-01T00:00:00Z` 这种带 `Z` 的形式最稳；只有 `null`（没传）算没条件，传空字符串 `from=` 是 400（`ref` 为 `from`，`reason` 为 `OUT_OF_RANGE`）。
  2. 会话列表 `GET /sessions`：按 `requestedAt`；`Instant.parse`；空字符串当没传；格式错是 400，`reason` 为 `INVALID_FORMAT`。
  3. 多开检测 `GET /abuse/clusters`：按注册审计的 `createdAt`；`Instant.parse`；空字符串当没传；格式错 `INVALID_FORMAT`。
  4. 额度流水 `GET /credits/transactions`：按 `createdAt`；`Instant.parse`；空字符串是 400（`reason` 为 `OUT_OF_RANGE`）。
  5. 站内通知 `GET /notifications`：按 `createdAt`；用 `OffsetDateTime.parse`，必须带时区偏移（`Z` 可以），日期不带时间会 400；空字符串 400（`OUT_OF_RANGE`）。
  6. 短信发送记录 `GET /sms/records`（导出同参数）：按 `createdAt`；`Instant.parse`；空字符串 400（`OUT_OF_RANGE`）。
  通用：只带日期（`2026-10-01`）一律 400；上面的 400 都是 `INVALID_REQUEST`，`data.details=[{"ref":"from"|"to","reason":...}]`。`Instant.parse` 对 `Z` 以外的偏移写法我没有运行验证，页面只发 `Z` 形式即可。
- 依据：审计 `admin/.../facade/AuditLogFacade.java:59-67`、`91-103`，`core/.../shared/audit/AdminAuditLogReader.java:63-67`；会话 `admin/.../facade/SessionAdminFacade.java:141-142`、`160-168`，`core/.../session/repository/SessionAdminRepository.java:113-117`；多开 `admin/.../facade/AbuseAdminFacade.java:77-81`、`135-143`，`core/.../abuse/repository/AbuseClusterRepository.java:120-124`；额度流水 `core/.../facade/CreditFacade.java:669-690`、`769-777`，`core/.../credit/repository/CreditRepository.java:273-278`；通知 `core/.../facade/NotificationFacade.java:352`、`595-609`，`core/.../notification/repository/NotificationRepository.java:190-196`；短信 `admin/.../facade/SmsAdminFacade.java:531-541`，`core/.../sms/service/SmsSendRecordStore.java:246-251`；接口文档 2384（会话：ISO-8601，`from` 含、`to` 不含）、4037（通知：`from` 含、`to` 不含，带时区偏移）、2254（额度流水只写"按 `createdAt`"）、2392（审计日志没写格式）、2399（多开没写格式）、3856（短信只写"时间范围"）。
- 和前端暂定做法：一致（发出的格式正确；注意不要给审计日志、额度流水、通知、短信记录发空字符串的 `from`/`to`，没选时整个参数不要发）。
- 改动请求：无
- 核实程度：已核实（偏移写法的宽松程度未运行验证）

### 84（共用）报表类 `from`、`to`：额度统计、投放成本——格式、含不含、不传取什么
- 答案：
  1. 额度统计 `GET /credits/stats`：`YYYY-MM-DD`，UTC 日，含两端（统计从 `from` 当日 00:00Z 到 `to` 次日 00:00Z 前）。都不传取最近 7 天（含今天）；只传 `from` 时 `to` 是 `from` 加 6 天但不晚于今天（`from` 在今天之后则 `to=from`）；只传 `to` 时 `from` 是 `to` 减 6 天。`from` 晚于 `to` 是 400（`ref` 为 `from`，`reason` 为 `OUT_OF_RANGE`）；跨度超过 `stats.max_range_days`（默认 366）是 400（`ref` 为 `to`，`OUT_OF_RANGE`）；格式不对 400（`ref` 为出错的那个参数）。空字符串当没传。
  2. 投放成本列表 `GET /attribution/costs`：`from`、`to` 是 `YYYY-MM-DD`，UTC 日，两端都含（`stat_date >= from AND stat_date <= to`）；不传就是不过滤（不是默认 7 天）；没有跨度上限；`to` 早于 `from` 是 400（`ref` 为 `to`，`OUT_OF_RANGE`）；格式不对 400（`INVALID_FORMAT`）；空字符串当没传。
  3. 如果"投放成本"指投放效果汇总 `GET /attribution/summary`：同额度统计的规则（含两端的 UTC 日，默认最近 7 天，受 `stats.max_range_days` 限制，年份不小于 1）。
- 依据：`core/.../facade/CreditFacade.java:709-745`；`core/.../shared/time/StatsRange.java:34-64`、`66-83`；`admin/.../facade/CampaignCostAdminFacade.java:171-186`、`271-280`；`core/.../attribution/service/CostInputs.java:106-116`；`core/.../attribution/repository/CostRepository.java:171-176`；`admin/.../facade/AttributionAdminFacade.java:187-198`；接口文档 2395（额度统计，与代码一致）、1535（成本列表：`from`、`to` 是两端都含的 UTC 日）、2372（时间约定）。
- 和前端暂定做法：一致（页面总是传 `from`、`to` 的 UTC 日，不依赖默认值）。
- 改动请求：无
- 核实程度：已核实

### 89（渠道包与应用版本）`POST /channels` 默认启用吗；`PUT /channels/{code}` 只发 `{"enabled":false}` 行不行
- 答案：
  1. `POST /channels` 创建后默认启用：请求体不带 `enabled` 时为 `true`，只有明确传 `false` 才是停用（`!Boolean.FALSE.equals(enabled)`）。请求体不需要带 `enabled`；必填的是 `code`、`name`、`platform`、`distribution`，`packageName` 可不带。
  2. `PUT /channels/{code}` 只发 `{"enabled":false}` 可以：没带的字段保持原值（`name` 为 `null` 取原值，`packageName` 为 `null` 取原值，`enabled` 为 `null` 取原值）；`packageName` 传空字符串表示清空（JSON 的 `null` 是"没带"，不是清空）；`name` 传空白是 400。改了 `enabled` 才会清版本检查缓存。
  3. 带 `code`、`platform`、`distribution` 且与现值不同 → 400，相同视为无变化；渠道不存在 → 404（路径里的码格式不合法也是 404）。
- 依据：`core/.../appversion/service/AppVersionInputs.java:164-183`（第 182 行 `!Boolean.FALSE.equals(in.enabled())`）；`core/.../appversion/service/AppVersionAdminService.java:166-193`、`418-422`；`core/.../appversion/api/AppVersionAdminTypes.java:12-24`；`admin/.../facade/AppVersionAdminFacade.java:267-273`；测试 `AppVersionAdminIT.java:607-640`、`656-662`；接口文档 3984（"不带的字段不变，`packageName` 传空字符串表示清空"，与代码一致）。
- 和前端暂定做法：不一致（前端要改：每次都发三项能用，但正是前端担心的"用页面上次读到的值覆盖别人刚改的名称"；后端支持只发改动的字段，所以停用/启用开关只发 `{"enabled":x}`，改名只发 `{"name":x}`）。
- 改动请求：无
- 核实程度：已核实

### 90（渠道包与应用版本）渠道名称和包名的长度上限、规则，400 的 `ref` 和原因码
- 答案：
  1. 渠道名称：去首尾空白后 1 到 64 个码点，不能是空白；存的是去空白后的值。前端暂定的"名称不限长度"要改成 64。
  2. 包名：可不填；传空字符串或 `null`（创建时）表示没有；非空时至多 255 个字符，只允许 `A-Z a-z 0-9 . _ -`；没有"必须含点"之类的包名结构检查。前端暂定的字符集正确，再加上 255 的上限。
  3. 400 的 `ref` 和原因码：渠道的所有 400（码格式不对或是 `unknown`、平台不是 `ANDROID`/`IOS`、分发方式不是 `STORE`/`DIRECT`、`DIRECT` 配 `IOS`、名称为空或太长、包名太长或字符不对、创建后改了码/平台/分发方式）都是 `INVALID_REQUEST`，只有英文 `message`（例如 "name is longer than 64 characters"、"platform cannot be changed"），没有 `ref` 也没有原因码。检查顺序：码 → 名称 → 平台 → 分发方式 → `DIRECT` 配 `IOS` → 包名，第一个不合格的就返回。
  4. 渠道码重复 → 409 `DUPLICATE_RESOURCE`，`data.field="code"`；渠道不存在 → 404 `RESOURCE_NOT_FOUND`。
  5. 数据库对码、平台、分发方式、`DIRECT` 只能配 `ANDROID` 还有一层兜底约束。
- 依据：`core/.../appversion/service/AppVersionInputs.java:44-51`、`164-210`；`core/.../appversion/service/AppVersionAdminService.java:140-159`、`406-408`、`418-422`；`core/src/main/resources/db/migration/V1__schema.sql:2762-2776`；接口文档 3983（码格式、`unknown`、`DIRECT` 只能配 `ANDROID`、名称 1 到 64、包名至多 255 个 `[A-Za-z0-9._-]`）、3984（重复 409 `data.field="code"`）、150/151/112（错误行；112 行说 `ref` 只在需要指出出错对象的接口出现，渠道不属于）。
- 和前端暂定做法：不一致（前端要改：名称加 64 码点上限；包名加 255 上限；页面不要期待渠道的 400 带 `ref`/原因码，只能按提交的字段在前端自己检查，后端 400 时显示通用文字）。
- 改动请求：无
- 核实程度：已核实

### 91（渠道包与应用版本）`versionCode`、`minVersionCode` 上限；更新说明每种语言长度、不在支持列表里的语言收不收
- 答案：
  1. `versionCode`、`minVersionCode` 的类型是 32 位整数（Java `Integer`，数据库列 `integer`），上限 2147483647（2^31-1），不是前端暂定的 2^53-1。范围：`versionCode >= 1`；`1 <= minVersionCode <= versionCode`，不合格 400，只有 `message`（"versionCode must be a positive integer"、"minVersionCode must be between 1 and versionCode"）。超过 2147483647 的数字在读请求体时就读不进去，预期是 400 `INVALID_REQUEST`，`message` 为 "Malformed or invalid request body"，没有 `ref`（这一点我读了类型和统一的异常处理，没有运行请求确认）。
  2. 更新说明 `changelog`：必须是对象，至多 30 种语言；语言键匹配 `[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*`，至多 35 个字符；每种语言的文字 1 到 4000 个码点，不能是空白，必须是字符串；必须有 `en`。键不合法 → 400，`data.details=[{"ref":"changelog.<键>","reason":"INVALID_LANGUAGE_TAG"}]`。其余错误只有 `message`（"changelog must contain en"、"changelog has more than 30 languages"、"changelog.xx must be a non-empty text"、"changelog.xx is longer than 4000 characters"）。
  3. 不在支持列表里的语言代码：收。后端只检查键的形状，不拿 `app.supported_locales` 比对。
  4. `versionName`：`x.y.z`（ASCII 数字），至多 32 个字符。
  5. 提交方式：商店渠道（`STORE`）只带 `storeUrl`，带 `apkUploadId` → 400；直装渠道（`DIRECT`）必须带 `apkUploadId`，带非空 `storeUrl` → 400。与前端暂定一致。`apkUrl`、`apkSizeBytes`、`apkSha256` 请求里带了被忽略。
- 依据：`core/.../appversion/api/AppVersionAdminTypes.java:28-39`（`Integer versionCode`、`minVersionCode`）；`core/src/main/resources/db/migration/V1__schema.sql:2783-2784`、`2802-2804`；`core/.../appversion/service/AppVersionInputs.java:30-41`、`76-102`、`129-161`；`common/.../web/GlobalExceptionHandler.java:106-112`；接口文档 3926（`changelog` 规则：至多 35 字符的键、至多 30 种、每种 1 到 4000；`1 ≤ minVersionCode ≤ versionCode`）、3917（`versionCode` 只写"整数"，没写上限）。
- 和前端暂定做法：不一致（前端要改：数字上限改成 1 到 2147483647；"商店渠道只带 storeUrl、直装渠道只带 apkUploadId"一致；更新说明键的规则与长度按上面检查）。
- 改动请求：无
- 核实程度：部分核实（超过 2147483647 时的实际响应没有运行；类型、列类型和统一异常处理已读）

### 92（渠道包与应用版本）版本写接口 400 的 `ref` 和 `reason`
- 答案：
  1. 除 `storeUrl` 和 `changelog` 的语言键之外，其他字段的 400 都没有 `ref`：`versionName`、`versionCode`、`minVersionCode`、`changelog`（缺 `en`、为空、超过 30 种、文字太长或为空）、`apkUploadId`、`confirmStoreLive`、`channelCode` 都只返回 `INVALID_REQUEST` 加一句英文 `message`，`data` 是 `null`。例：`versionName is required`、`versionName must look like 1.2.3 (at most 32 characters)`、`apkUploadId is required for a DIRECT channel`、`apkUploadId is not allowed for a STORE channel`、`apkUploadId is not an APK upload`（上传存在但不是 APK）、`confirmStoreLive must be true: confirm the new version is visible in the store`、`channelCode is required`、`Unknown channelCode`、`channelCode cannot be changed`、`status must be ACTIVE or ARCHIVED`。
  2. 有 `ref` 的只有两处：`storeUrl`（`ref="storeUrl"`）和 `changelog.<语言键>`（`reason="INVALID_LANGUAGE_TAG"`）。
  3. `storeUrl` 的 `reason`：只返回第一个违反的原因，取值是 `EMPTY_NOT_ALLOWED`（商店渠道没填）、`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`（超过 2048）、`PACKAGE_NAME_NOT_CONFIGURED`（环境变量 `GOOGLE_PLAY_PACKAGE_NAME` 没配）。具体：安卓链接的主机不是 `play.google.com` 是 `INVALID_HOST`；有端口 `INVALID_PORT`；路径不是 `/store/apps/details`、有片段、`id` 缺失或重复或不等于环境变量里的包名、出现 `id`/`hl`/`gl` 以外的查询键、`hl`/`gl` 值不合法，全都是同一个 `INVALID_PATH`（没有单独的"id 不一致"原因）。IOS 链接：主机不是 `apps.apple.com` → `INVALID_HOST`，路径形状不对或有片段 → `INVALID_PATH`。直装渠道带了 `storeUrl` → 只有 `message`（"storeUrl must be empty for a DIRECT channel"），没有 `ref`。
  4. 激活直装版本时文件不存在或校验和不一致：400 `INVALID_REQUEST`，只有 `message`，没有 `reason`：`The version has no APK`、`The APK file of this version is missing`、`The APK file of this version is missing or has another size`、`The APK file of this version does not match its SHA-256`、`upload.public_base_url is not configured`、`The APK of this version changed while it was being checked; try again`。APK 缺 v2 以上签名是上传时的 400 `INVALID_FILE`，不在版本接口里。`apkUploadId` 指向不存在的上传 → 404 `RESOURCE_NOT_FOUND`；已被用 → 409 `INVALID_STATE`，`data.status="CONSUMED"`。
- 依据：`core/.../appversion/service/AppVersionInputs.java:76-126`、`129-161`、`208-210`；`core/.../appversion/service/AppVersionAdminService.java:117-135`、`342`；`admin/.../facade/AppVersionAdminFacade.java:167-182`、`212-247`、`281-292`、`299-320`；`common/src/main/java/com/avatarapp/backend/common/text/LinkRule.java:64-91`（Play 链接）、`121-142`（App Store 链接）、`18-26`（原因常量）；接口文档 112（链接字段的 `ref` 是请求字段名）、3926（"出错返回 `INVALID_REQUEST`，`message` 写明字段"）、3928（APK 上传 400 `INVALID_FILE`）、3930（激活检查顺序）。
- 和前端暂定做法：一致（前端提交前自己检查并给出具体原因是唯一的办法；只有 `storeUrl` 和更新说明语言键能用后端的 `reason` 翻译）。
- 改动请求：建议做（版本字段的 400 也像目录接口那样带 `data.details=[{"ref":"<请求字段名>","reason":"EMPTY_NOT_ALLOWED"|"OUT_OF_RANGE"|"INVALID_FORMAT"}]`：页面不显示英文 `message`，没有码就只能写"输入内容不合法"；目录、配置、推送接口已经这样做，加字段不影响别的调用方）。
- 核实程度：已核实

### 96（形象与装扮）目录条目的 `names`、`texts` 里 `en` 是否必填
- 答案：必填。服装、动作的 `names` 和上传声明的 `texts` 都必须含 `en`，缺了是 400 `INVALID_REQUEST`，`data.details=[{"ref":"names.en"|"texts.en","reason":"EMPTY_NOT_ALLOWED"}]`。整个对象缺失或为空是 `ref` 为 `names`/`texts`，`reason` 为 `EMPTY_NOT_ALLOWED`。数据库注释也写明"always with en"。接口文档没有写这条（文档只说客户端按 `Accept-Language` 选语言，没有写后台是否强制 `en`）。
- 依据：`core/.../catalog/service/CatalogInputs.java:123-141`（`en` 检查在 137-139 行）；`core/.../catalog/service/CatalogAdminService.java:214`（`names`）、`535`（`texts`）；`core/src/main/resources/db/migration/V1__schema.sql:416`、`496`；接口文档 2861（只写"names(多语言)"）。
- 和前端暂定做法：不一致（前端要改：表单里 `en` 必填，只填别的语言会被后端 400；错误的 `ref` 是 `names.en` 或 `texts.en`）。
- 改动请求：无
- 核实程度：已核实

### 97（形象与装扮）服装、动作 `POST/PUT` 请求体是否如前端所写
- 答案：
  1. `POST /cosmetics` 必填：`key`、`kind`（`OUTFIT`/`BACKGROUND`）、`names`、`generationSpec`、`compatibleStyles`（`STYLIZED_3D`、`REALISTIC` 至少一个、不重复）、`isFree`、`isDefault`、`enabled`、`sortOrder`、`previewUploadId`；可不带或为 `null`：`creditPrice`、`surfaces`（`null` 等于空数组，所有端）。`POST /actions` 必填：`key`、`names`、`description`、`generationSpec`、`compatibleStyles`、`triggerableBy`（`USER`/`AGENT`/`BOTH`）、`enabled`、`sortOrder`、`iconUploadId`；`surfaces` 可不带。
  2. 预览图、图标创建时必填：缺 `previewUploadId`/`iconUploadId` 是 400（`ref` 为该字段名，`reason` 为 `EMPTY_NOT_ALLOWED`）。上传不存在 404，上传的类型不对 400，已被别的对象用过 409（`data.status="CONSUMED"`）。
  3. `enabled` 创建时必须带（不是"能带"，是必填），缺了 400（`ref` 为 `enabled`）。
  4. `PUT /cosmetics/{id}` 不是"除 `key`、`kind`、`enabled` 之外的全部字段"：后端要求带 `kind`、`names`、`generationSpec`、`compatibleStyles`、`isFree`、`isDefault`、`enabled`、`sortOrder`（缺任何一个都是 400），`key` 可不带（带了必须等于现有的，否则 400，`ref` 为 `key`），`previewUploadId` 可不带（不带就保留原图；带的与当前相同也算没换）。`creditPrice: null` 清除价格，是对的；`isFree: true` 时必须 `creditPrice` 为空，否则 400（`ref` 为 `creditPrice`）；`creditPrice` 非空时范围是 1 到 1000000000。`PUT /actions/{id}` 同理：`description`、`triggerableBy`、`enabled`、`sortOrder`、`names`、`generationSpec`、`compatibleStyles` 都必须带，`key`、`iconUploadId` 可不带。整体替换，是的（`surfaces` 不带会变成空数组，即所有端，所以编辑时要原样带回）。
  5. `kind` 不是创建后只读：`PUT` 会把请求里的 `kind` 写进数据库（`UPDATE ... SET kind = ?`），后端没有"kind 不能改"的检查。前端把它当只读、编辑时带回当前值是安全的。
  6. 重复的 `key` → 409 `DUPLICATE_RESOURCE`，`data.field="key"`。
- 依据：`core/.../catalog/api/CatalogAdminTypes.java:34-46`、`66-76`；`core/.../catalog/service/CatalogAdminService.java:119-145`（预览图必填在 123，重复 key 在 125-127）、`148-174`（`key` 检查 152-154）、`212-232`（必填字段全在这里）、`311-338`、`341-367`、`400-427`；`core/.../catalog/repository/CatalogRepository.java:219-240`（第 222 行更新 `kind`）；`core/.../catalog/service/CatalogInputs.java:80-103`、`144-155`、`158-184`；测试 `admin/src/test/java/com/avatarapp/backend/admin/CatalogAdminIT.java:380-394`（创建时全字段都带）；接口文档 2378（"PUT/POST"字段名同实体列名去掉 `Ref` 加 `UploadId`）、2861（`key` 创建后不可改）。
- 和前端暂定做法：不一致（前端要改：`PUT` 必须带 `kind` 和 `enabled`（带当前值），服装还要带 `isFree`、`isDefault`、`sortOrder`，动作要带 `description`、`triggerableBy`、`sortOrder`；创建时 `enabled` 必填；预览图、图标创建时必填与前端一致；`creditPrice: null`、图片只在换图时带与前端一致）。
- 改动请求：建议做（服装的 `kind` 创建后禁止修改：改种类会让已有形象引用的服装条目变成另一类，和 `key` 一样应创建后不可改；Android、AvatarAgent 只读目录，不受影响；前端的做法本来就是不改）。
- 核实程度：已核实

### 98（形象与装扮）每种 `kind` 一个默认免费条目：设另一个为默认时旧默认怎样；`isDefault` 真而 `isFree` 假是 400 吗
- 答案：
  1. 把另一个条目设为默认：旧默认自动取消（同一事务里 `UPDATE ... SET is_default=false WHERE kind=? AND is_default AND id<>?`），不是 409。
  2. `isDefault` 为真而 `isFree` 为假：不是 400，后端没有这条检查（数据库也没有约束）。结果取决于这个种类原来有没有"合格的默认条目"（默认、启用、免费、两种风格都适用）：原来有 → 这次保存会让它失去合格默认，整笔回滚并返回 409 `INVALID_STATE`，`data={"kind":"OUTFIT"|"BACKGROUND"}`（注意是 `data.kind`，不是 `data.status`），`message` 为 "The change leaves the kind without its default item"；原来没有 → 保存成功，得到一个不合格的默认条目。
  3. 同样的 409 `data.kind` 还会出现在：取消唯一合格默认的 `isDefault`、把它停用、改成收费、去掉一种适用风格。
- 依据：`core/.../catalog/service/CatalogAdminService.java:133-135`、`164-166`（取消旧默认）、`212-232`（没有 `isDefault` 与 `isFree` 的联合检查）、`270-291`（`eligibleKinds`、`requireDefaultsKept`，`Map.of("kind", kind)` 在 288 行）；`core/.../catalog/repository/CatalogRepository.java:171-180`、`193-196`；`core/src/main/resources/db/migration/V1__schema.sql:430-439`（无联合约束）；接口文档 813、2861（只写"每种 `kind` 各有一个 `isDefault=true` 的免费条目"，没有写切换行为和 409）。
- 和前端暂定做法：不一致（前端要改：不要假设 400 且 `ref` 为 `isDefault`；表单提示改成"保存后其他默认条目会自动取消"；遇到 409 `INVALID_STATE` 且 `data.kind` 存在，提示"该种类必须保留一个启用、免费、两种风格都适用的默认条目"）。
- 改动请求：无
- 核实程度：已核实

### 99（形象与装扮）`key`、`names`、`description`、声明 `version`、`texts` 的长度和字符规则；声明 `version` 格式、重复、`activeFrom`
- 答案：
  1. `key`（服装、动作相同）：匹配 `^[a-z0-9][a-z0-9_.-]{0,63}$`，即 1 到 64 个字符，小写字母或数字开头，其后可含小写字母、数字、`_`、`.`、`-`；不合格 400（`ref` 为 `key`，`reason` 为 `OUT_OF_RANGE` 或缺失时 `EMPTY_NOT_ALLOWED`）。
  2. `names` 的每个值：去首尾空白后 1 到 100 个码点，不含控制字符（换行、制表符也不行）；至多 64 种语言；语言标签匹配 `^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$`（不合格 `ref` 为 `names`，`reason` 为 `INVALID_LANGUAGE_TAG`；值的错误 `ref` 为 `names.<标签>`，原因为 `EMPTY_NOT_ALLOWED`/`TOO_LONG`/`OUT_OF_RANGE`）；不要求在 `app.supported_locales` 里；必须有 `en`。
  3. 动作 `description`：去首尾空白后 1 到 2000 个码点，必填；允许换行，不允许 U+0000。`generationSpec`：1 到 2000 个码点，必填，同样不允许 U+0000。
  4. 声明 `version`：不是自由文本，也不是日期加序号，而是匹配 `^[A-Za-z0-9._-]{1,64}$` 的字符串（没有空格、没有斜杠；可以是 `2026-10-01.1` 这样，后端不检查含义）；不合格 400（`ref` 为 `version`，`OUT_OF_RANGE`）。重复 → 409 `DUPLICATE_RESOURCE`，`data.field="version"`，是的。
  5. 声明 `texts`：每个值去首尾空白后 1 到 20000 个码点，允许换行（只禁 U+0000），至多 64 种语言，必须有 `en`，标签规则同 `names`。
  6. 声明 `activeFrom`：新建的版本是 `null`，是的（数据库约束保证：生效中的一定有 `activeFrom`）。`isActive` 才是"现在是否生效"：被新版本顶替的旧版本 `isActive` 变成 `false`，但它的 `activeFrom` 保留原值，不会回到 `null`；再次设为生效时 `activeFrom` 改成这次的时间。
  7. 所有文字都存去空白后的值。
- 依据：`core/.../catalog/service/CatalogInputs.java:38-71`（常量）、`87-93`、`106-120`、`123-141`；`core/.../catalog/service/CatalogAdminService.java:214-216`、`402-404`、`532-546`（重复 `version` 在 536-538）、`549-566`、`622-624`；`core/.../catalog/repository/CatalogRepository.java:551-557`、`563-569`；`core/src/main/resources/db/migration/V1__schema.sql:494-507`；接口文档 2861（只写了 `generationSpec` 的 1 到 2000，其余长度没有写）、2378（声明接口）。
- 和前端暂定做法：一致（前端只检查非空和 `generationSpec` 长度，其余等后端的 400 也可以；若要在前端预检，用上面的数字）。
- 改动请求：无
- 核实程度：已核实

### 100（形象与装扮）动作补生成遇已停用动作的 409；默认数字人改名在哪些状态被拒；对已生效的再 `activate`
- 答案：
  1. 动作补生成（`POST /actions/{id}/backfill`）遇到已停用的动作：409 `INVALID_STATE`，`message` 为 "The action is disabled"，`data` 是 `null`，没有状态。动作不存在（含路径里的 id 不是合规 UUID）→ 404 `RESOURCE_NOT_FOUND`。成功返回 `{"scheduled":n}`。
  2. 默认数字人改名（`PUT /default-avatars/{id}`）：任何状态都不会被拒（草稿、生成中、已就绪、已生效都可以改），只有两种拒绝：id 不存在 404，名字不合规 400（`INVALID_REQUEST`，只有 `message`："name must be 1 to 30 characters without control characters"；名字去首尾空白后 1 到 30 个码点，不含控制字符和双向控制字符）。
  3. 对已经生效的默认数字人再调 `activate`：幂等成功（返回该默认数字人，不报 409，还是会写一条审计记录）。`activate` 只对状态为 `READY` 的有效，其他状态 409 `INVALID_STATE`（`data` 为 `null`，`message` 为 "Only a READY default avatar can be activated"）；不存在 404。
  4. 默认数字人的所有 409 `INVALID_STATE`（生成、激活、删除）都没有 `data.status`，与第 1 条同理（见文末矛盾清单）。
- 依据：`core/.../facade/LookFacade.java:536-541`（停用动作的 409 在 539-541 行）、`182`（`BackfillResponse(long scheduled)`）；`admin/.../controller/ActionClipAdminController.java:30-48`；`core/.../facade/DefaultAvatarFacade.java:184-201`（改名无状态检查）、`265-276`（激活）、`384-390`、`436-441`（`invalidState` 不带 data）；`core/.../asset/service/DefaultAvatarService.java:169-186`（已生效直接返回 true，176-178 行）；`core/.../facade/AvatarFacade.java:50`、`219-232`（名字规则）；接口文档 911（状态链与"违反上述状态要求一律 409 `INVALID_STATE`"）、2378（改名接口）、150（`data.status` 写法）。
- 和前端暂定做法：不一致（前端要改：改名按钮在"生成中"也可以显示（后端不拒绝），不必隐藏；"再激活当作成功"一致；`data.status` 缺失时只显示通用文字，一致）。
- 改动请求：无
- 核实程度：已核实

### 135（形象与装扮）投诉改状态、删除形象、赠送服装、声明激活或上下架成功时返回什么；重复赠送是 409 吗；条目不存在是 404 吗
- 答案：
  1. 投诉改状态 `PUT /likeness-complaints/{id}/status`：成功返回 `data: null`（不是更新后的详情）。删除形象 `POST /likeness-complaints/{id}/remove-avatars`：成功 `data: null`。
  2. 赠送服装 `POST /accounts/{id}/cosmetics`：成功 `data: null`（不返回 `AccountCosmetic` 行）。重复赠送同一件不是 409：已拥有时直接成功，不写第二行，也不写审计记录。`reason` 必填（1 到 500 个码点）。
  3. 条目不存在 → 404 `RESOURCE_NOT_FOUND`；账号不存在 → 404；账号待删除 → 403 `ACCOUNT_DELETION_SCHEDULED`；账号删除中 → 403 `ACCOUNT_DELETING`；缺 `itemId`/`reason` → 400。
  4. 声明激活 `PUT /declarations/{version}/activate`：返回更新后的声明（`version`、`texts`、`activeFrom`、`isActive`）；对已经生效的再激活是成功（原样返回，`activeFrom` 不变）；版本不存在 404。
  5. 上下架 `PUT /cosmetics|actions|renderer-models/.../enabled`：返回更新后的条目（服装、动作、渲染模型的完整响应项）；设成已有的值也是成功，返回当前条目；请求体缺 `enabled` 是 400。
- 依据：`admin/.../controller/ComplaintAdminController.java:52-72`（两个 `ApiResponse<Void>`）；`admin/.../controller/CatalogAdminController.java:86-92`、`116-122`、`132-138`（`ApiResponse<Void>`）、`156-160`、`179-185`；`admin/.../facade/CatalogAdminFacade.java:276-300`；`core/.../catalog/service/CatalogAdminService.java:177-210`、`549-566`、`577-602`（已拥有直接 `return false`，586-588 行）；接口文档 2378 只写请求和权限，没有写成功响应、重复赠送，与代码不冲突。
- 和前端暂定做法：一致（前端不读响应，成功后重新读取）。前端的假后端要改：投诉改状态、删除形象、赠送服装成功返回 `null`；重复赠送返回成功而不是 409 `DUPLICATE_RESOURCE`。
- 改动请求：无
- 核实程度：已核实

### 136（形象与装扮）`GET /accounts/{id}/avatars` 里形象的 `isCurrent`
- 答案：是。`isCurrent` 为真表示这个形象的 id 等于账号的 `currentAvatarAssetId`（账号当前使用的形象）。外观里没有 `isCurrent`；`currentLookId` 在形象上，表示该形象当前使用的外观。账号不存在 404。
- 依据：`admin/.../facade/AvatarAdminFacade.java:80-86`（形象项的字段）、`94-112`（第 97 行取 `user.currentAvatarAssetId()`，第 111 行 `a.id().equals(current)`）；接口文档 2459（字段表写了 `isCurrent`，没有解释含义）。
- 和前端暂定做法：一致
- 改动请求：无
- 核实程度：已核实

### 对照复查 5（渠道包与应用版本）`GET /app-versions` 是否分页、`data` 形状、`apkUrl` 等字段、`changelog` 形状、读某渠道生效版本
- 新版接口文档写法是否变了：没有变化。分页与 `{items,total}` 见 2372；行字段（`apkUploadId`、`apkSizeBytes`、`apkSha256`、`apkUrl` 不存、由 `apkUploadId` 拼出、`changelog` 必须有 `en`）见 3917；接口 `GET /app-versions?channelCode=&platform=&status=` 与"列表默认生效中的排前面，其余按创建时间倒序"见 3932。
- 代码是否这样做：是。
  - 分页：用 `page`、`pageSize`，响应 `{"items":[...],"total":N}`（`admin/.../controller/AppVersionAdminController.java:43-52`；`web/AdminPage.java:7`）。
  - 行字段：`id`、`channelCode`、`platform`、`versionName`、`versionCode`、`minVersionCode`、`storeUrl`、`apkUploadId`、`apkUrl`、`apkSizeBytes`、`apkSha256`、`changelog`、`status`、`createdBy`、`createdByUsername`、`activatedBy`、`activatedByUsername`、`activatedAt`、`createdAt`、`updatedAt`（`admin/.../facade/AppVersionAdminFacade.java:111-131`、`363-385`）。`apkUrl` 拼成 `{upload.public_base_url}/download/{uploadId}.apk`，没有 `apkUploadId`（商店渠道）或没配置基址时为 `null`（`core/.../appversion/service/AppVersionUrls.java` 的 `apkUrl`）。`versionCode`、`minVersionCode` 是 JSON 数字（32 位整数）。
  - `changelog`：以语言键为键、文字为值的对象（`Map<String,String>`），必有 `en`（`AppVersionInputs.java:129-161`；数据库约束 `V1__schema.sql:2804`）。
  - 读某渠道生效版本：`GET /app-versions?channelCode=<码>&status=ACTIVE`，数据库有"每个渠道至多一行 `ACTIVE`"的唯一索引（`V1__schema.sql:2811`），所以 `items` 为 0 或 1 条。
  - 排序：生效中的在前，再按创建时间倒序，同时间按 `id` 倒序（`core/.../appversion/repository/AppVersionReleaseRepository.java:195-205`）。筛选参数 `channelCode`、`platform`、`status` 值不合法是 400（`message` 为 "Invalid filter: <名>"，无 `ref`），空字符串当没传（`AppVersionAdminFacade.java:147-159`、`338-346`）。
- 结论：仍然正确

### 对照复查 9（渠道包与应用版本）安卓商店链接 `id` 用哪个包名；IOS 链接收哪些写法
- 新版接口文档写法是否变了：没有变化，仍在 3926（"**ANDROID** 必须是 `https://play.google.com/store/apps/details?id=<应用包名>`，`id` 等于环境变量 `GOOGLE_PLAY_PACKAGE_NAME`……查询键只允许 `id`（必填，只出现一次）、`hl`、`gl`（各至多一次）……**IOS** 主机必须是 `apps.apple.com`，路径形如 `/<国家码>/app/<名称>/id<数字>` 或 `/app/id<数字>`"）；文档里明说 iOS 形状是印象，没有核实 Apple 文档。
- 代码是否这样做：是。
  - 安卓：`id` 必须等于环境变量 `GOOGLE_PLAY_PACKAGE_NAME`，不是渠道自己的 `packageName`；该变量每次保存时现读（`AppVersionAdminFacade.java:70`、`173`、`192`）。主机 `play.google.com`（不区分大小写）、无端口、路径恰为 `/store/apps/details`、无片段、查询键只允许 `id`（必填、一次、与包名逐字相等，不做 URL 解码）、`hl`、`gl`（各至多一次，值匹配 `[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})?`）（`common/src/main/java/com/avatarapp/backend/common/text/LinkRule.java:64-91`、`233-269`）。变量没配 → 400，`reason` 为 `PACKAGE_NAME_NOT_CONFIGURED`（`LinkRule.java:73-75`、`AppVersionInputs.java:116-123`）。
  - IOS：主机 `apps.apple.com`（不区分大小写）、无端口、无片段；路径必须匹配 `/<恰好两个字母>/app/<名称>/id<数字>` 或 `/app/id<数字>`（`LinkRule.java:37`、`121-142`）。所以没有名称的 `/us/app/id123` 不收（不匹配第一种形状，也不是 `/app/id…`）；国家码在代码里是恰好两个 ASCII 字母，比文档的"国家码"更具体；路径之外的查询参数不限制。
  - 两类都先过 1.7 的通用链接规则（含总长不超过 2048，`TOO_LONG`）。
  - 注意：选路径用的是渠道的平台，不是渠道码——任何 `ANDROID` 且 `STORE` 的渠道（包括运营新建的非 Google 商店渠道）都必须填 `play.google.com` 的链接（`AppVersionInputs.java:112-114`）。
- 结论：仍然正确（补充一条：国家码是恰好两个字母；ANDROID 的 STORE 渠道一律按 Play 链接校验）

### 我发现的、问题表没问到但前端会踩到的坑
1. 服装 `PUT` 必须带 `kind`、`enabled`、`isFree`、`isDefault`、`sortOrder`，动作 `PUT` 必须带 `description`、`triggerableBy`、`enabled`、`sortOrder`：缺了会 400，不是"没带就保持原值"（`core/.../catalog/service/CatalogAdminService.java:212-232`、`400-427`）。同时 `surfaces` 不带会被改成"所有端"（`CatalogInputs.java:157-161`）。
2. `GET /channels` 的 `data` 是裸数组（`ChannelAdminController.java:41`），而其余不分页的列表是 `{items:[...]}`；类型定义不要按 `items` 写死。
3. 审计日志、额度流水、站内通知、短信记录的 `from`/`to` 传空字符串会 400，会话列表和多开检测则当作没传（见第 83 条）；日期选择器清空时整个参数不要发。
4. 版本号上限是 2147483647；超过时只得到没有 `ref` 的通用 400（第 91 条）。
5. 版本、渠道、默认数字人、动作补生成的 409 `INVALID_STATE` 大多没有 `data.status`；只有"上传已被使用"带 `data.status="CONSUMED"`，服装默认条目的 409 带的是 `data.kind` 而不是 `data.status`。页面读 `error.data.status` 前必须判空（第 47、98、100 条）。
6. 版本写接口的 400 大多没有 `data.details`；读 `error.data.details[0]` 之前必须判空（第 92 条）。请求体类型不对（如把数字写成无法读成整数的值）是 400 "Malformed or invalid request body"，同样没有 `data`（`common/.../web/GlobalExceptionHandler.java:106-112`）。
7. `GET /generation-tasks` 的 `status`/`type` 取值不合法时 400 只有 `message`，没有 `ref`（`GenerationTaskAdminFacade.java:72-82`）。
8. 声明被新版本顶替后 `activeFrom` 保留旧值（不是 `null`），用 `isActive` 判断是否生效（第 99 条）。
9. 版本 `PUT`（编辑草稿）不检查渠道是否停用，只有新建和激活检查（`AppVersionAdminService.java:250-306` 没有 `requireEnabled`）；接口文档 3988 也只写"不能新建版本、不能激活版本"，一致。
10. 激活版本的响应、下线版本的响应都是更新后的版本项；删除草稿版本成功是 `data: null`（`AppVersionAdminController.java` 的 `delete`）。

### 后端代码和接口文档互相矛盾的地方
- 47、100、98：接口文档 150 和 2372 写 409 `INVALID_STATE` 的 `data` 是 `{"status":"<当前状态>"}`；代码里版本和渠道的状态错误（`AppVersionAdminService.java:410-412`）、动作补生成（`LookFacade.java` 的停用动作）、默认数字人（`DefaultAvatarFacade.java:436-441`）的 409 没有 `data`，服装默认条目的 409 带的是 `data.kind`（`CatalogAdminService.java:285-288`）。本组涉及的接口里，只有上传被用（`data.status="CONSUMED"`，`DefaultAdminUploadService.java:301`）带 `data.status`；其他模块的 409 `INVALID_STATE` 有不少是带 `data.status` 的，例如投诉（`ComplaintFacade.java:565`）、删除（`DeletionAdminFacade.java:136`）、统计落地（`StatsAdminFacade.java:244`）、客服（`SupportAdminFacade.java:92`）、管理员账号（`AdminAccountService.java:428`）、签到活动（`CheckinAdminService.java:317`）、额度调整申请（`AdjustRequestService.java:92`）、权益（`EntitlementFacade.java:359`）、登录方式（`LoginMethodFacade.java:92`）、审核（`ModerationFacade.java:320`）、价格批次（`PriceTableService.java:469`）、推送任务（`PushTaskService.java:82`）、封禁（`BanService.java:70`）。
- 23：接口文档 2434（通则 1）写不分页的接口只有 `items`；`GET /channels` 的代码返回裸数组，没有 `items`。文档 3984 没有单独写这个接口的外层形状。

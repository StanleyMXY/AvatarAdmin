这个目录放管理端前端写给后端、以及请改规格和契约的人的问题与变更请求，共 42 个文件，按模块写；规格、契约和后端的文件只读，不在这里改。
要转给后端的人：只看下面“一、要后端回答的问题”（也可直接发同目录的 `for-backend.md`）；改规格和契约的人看“二”；已有答案的看“三”；找某个文件看“四”。
每个文件末尾的“核对于 2026-11-01”表示这一天逐小节核对过；已被后端回答或已按负责人决定实现的小节，在原文里标了“已答”或“已按决定实现”，不用再问。

# 一、要后端回答的问题

共 152 条，由 429 个仍待回答的小节合并而来（同一个问题常在汇总文件 `2026-10-21-admin-frontend.md` 和模块文件里各写一次，已合并，出处列写全）；按重要程度排序——第 1–18 条：权限、凭据、隐私和会话安全；第 19–46 条：响应形状、字段名、错误码和权限规则，猜错会让前端读空、显示错或误判；第 47–92 条：参数名、时间范围、分页、顺序和口径，猜错会让结果不对或被静默忽略；第 93–145 条：请求体细节、长度限制和校验原因码，猜错最多是提交失败或提示不准；第 146–152 条：只影响说明文字或体验。

| 编号 | 模块 | 问后端什么 | 为什么需要 | 我们现在按什么暂定做法 | 出处 |
|---|---|---|---|---|---|
| 1 | 系统管理 | 持有“管理员管理”权限但不是超级管理员的人，能不能对超级管理员重置密码、重置二次验证、停用、删除、改角色？后端是否一律拒绝，错误码是什么（契约没写） | 否则等于能接管超级管理员账号，是权限提升的路径 | 前端对超级管理员那一行，非超级管理员看不到任何操作；后端仍是最终裁决 | `2026-10-26-admin-frontend-system.md` “补充”一节；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 1 条 |
| 2 | 订阅与权益 | `GET /subscriptions`、`GET /subscriptions/{id}` 能否对安卓商店订阅的购买令牌和关联购买令牌只返回末 6 位（字段名带 `Suffix`） | 完整令牌发给只有查看权限的管理员，持有购买凭证的人可以用它认领订阅，前端藏不住响应里的数据 | 详情抽屉只显示末 6 位、没有复制按钮 | `2026-10-26-admin-frontend-subscriptions.md` 第九节；`2026-10-21-admin-frontend.md` 第二部分 2.11 第 9 条 |
| 3 | 通话 | `GET /sessions` 和 `GET /sessions/{id}` 的游客设备标识能否只返回前 8 位（建议字段名改为 `deviceIdPrefix`，或在契约写明这里的 `deviceId` 就是前 8 位） | 完整设备哈希是游客额度的稳定标识，不该送到浏览器 | 前端只取前 8 个字符显示，完整值不进页面也不写日志 | `2026-10-26-admin-frontend-sessions.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.5 第 2 条 |
| 4 | 系统管理 | 管理员被 `DELETE` 之后，他之前签发的令牌调用管理端接口，后端是否答 401 `ADMIN_INVALID_TOKEN`（停用、重置时契约已是 401） | 现在如果答 403、404 或 500，前端分不清“账号没了”和“后端出错”，这个人会停在“服务暂时不可用”页 | 不猜 403、404，保持不可用页并提供“重试”和“退出登录” | `2026-10-31-admin-frontend-deleted-admin-token.md` 全文 |
| 5 | 短信与邮件 | 短信渠道的 `credentials` 是不是“名称到文本值”的一层映射？有条目时是整体替换已保存的凭据，还是按名称合并？每个供应商需要哪些名称（能否在 `GET /sms/meta` 的供应商项里给 `credentialNames`）？收到旧写法（一个字符串）答什么？名称和值的长度、条数上限？空值是否允许 | 凭据永不回显，前端按映射做了“名称加值”的输入行；整体替换还是合并决定运营要不要重填全部，弄错会丢凭据 | 按整体替换写提示，页面不发空值 | `2026-10-31-admin-frontend-sms-credentials-shape.md` 全文 |
| 6 | 短信与邮件 | 短信渠道的 `extConfig` 是 JSON 对象还是 JSON 字符串？里面会不会放凭据 | 页面“凭据永不回显”靠后端不把凭据放进 `extConfig` | 请求发对象或 `null`，响应两种都能读 | `2026-10-26-admin-frontend-sms-email.md` 第一节第 5 条；`2026-10-21-admin-frontend.md` 第二部分 2.19 第 4 条 |
| 7 | 投放管理 | 怎样清除已设置的广告平台访问令牌（能用 `null` 吗）？任何接口的响应里是否都不返回明文 | 现在页面无法清除令牌，只能覆盖 | 页面不提供清除，留空表示不修改 | `2026-10-26-admin-frontend-campaign.md` 第二节第 4 条；`2026-10-21-admin-frontend.md` 第二部分 2.17 第 8 条 |
| 8 | 系统管理 | 创建、修改、重置密码等管理员接口的响应里，是否永远不会出现密码或临时密码？创建和修改返回的是不是 `GET /admins` 里那种对象，其余返回 `null` | 页面没有“只显示一次的密码”对话框，后端若返回了密码，页面也不会隐藏 | 页面只用响应判断成功，不读任何密码字段 | `2026-10-26-admin-frontend-system.md` 第一节第 4 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 5 条 |
| 9 | 系统管理 | 审计日志的 `detail` 是字符串还是 JSON？能否保证里面从不写密码、令牌、验证码、凭据 | 所有有审计查看权限的人都看得到 | 按“类型不定”显示，另把敏感键名的字符串值遮成星号，作第二道防线 | `2026-10-26-admin-frontend-system.md` 第四节第 3 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 16 条 |
| 10 | 登录与权限 | 验证码连续错误达到上限时：第 5 次错误本身答 401 还是 429？这个 429 带 `data.retryAfterSeconds` 吗？锁定期间密码错的登录答 429 还是 401？绑定认证器一步超过次数答什么 | 登录页要决定写“N 分钟后再试”还是通用文字；锁定期间对错误密码答不同状态码，会让人区分密码对错 | 第 5 次就答 429 并带 `retryAfterSeconds`；锁定期间一律 429；绑定超次数 429 且令牌作废 | `2026-10-26-admin-frontend-auth-and-permissions.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.1 第 3 条 |
| 11 | 形象与装扮 | 渲染模型的 `fileRef`（存储引用）要不要返回给管理端 | 存储键对浏览器没有用，也不该暴露 | 不使用也不显示 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第二节第 1 条；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 2 条 |
| 12 | 投放管理 | 点击明细里 IP 的掩码是什么格式（默认掩码，持有 `ANALYTICS:IP_VIEW` 才完整） | 页面原样显示，要知道格式才能写出说明 | 原样显示后端给的字符串 | `2026-10-26-admin-frontend-campaign.md` 第四节第 3 条；`2026-10-21-admin-frontend.md` 第二部分 2.17 第 18 条 |
| 13 | 短信与邮件 | 发送记录里号码的掩码是什么格式？存库的号码是否不带空格（E.164） | 号码筛选页面不做归一化，需要告诉运营怎么写 | 原样显示掩码；筛选只去首尾空白 | `2026-10-26-admin-frontend-sms-email.md` 第三节第 3 条；`2026-10-21-admin-frontend.md` 第二部分 2.19 第 16 条 |
| 14 | 推送 | `GET /push/records/{id}` 里发送结果的数组叫什么（`deliveries` 还是 `items`）？要不要像设备列表那样给出推送令牌末 6 位和平台 | 现在只能显示令牌记录编号，运营看不出是哪台设备 | 两种数组名都接受；都没有就写“没有记录到发送结果” | `2026-10-26-admin-frontend-push.md` 第四节第 2 条；`2026-10-21-admin-frontend.md` 第二部分 2.14 第 17 条 |
| 15 | 用户 | 账号删除任务的 `lastError` 里会不会含用户内容、令牌或内部主机名 | 页面把它原样显示给运营，长度不限 | 原样显示，不读 `stepStates` | `2026-10-26-admin-frontend-users.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.7 第 4 条 |
| 16 | 共用 | 目录、动作、渲染模型、默认数字人、账号形象、投诉证据、审核内容这些带短时效签名地址的读接口，响应能否都带 `Cache-Control: no-store` | 浏览器缓存会让再次查看没有审计记录，还会复用快过期的地址 | 前端对这些请求都带 no-store，不依赖响应头 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第六节；`2026-11-01-admin-frontend-moderation-and-reports-order.md` 第一节 |
| 17 | 部署 | 后端的管理端应用有没有任何会返回前端页面（网页、脚本、样式、图片）的路由或静态资源配置 | 如果有，后端的 `Content-Security-Policy: default-src 'none'` 会让页面白屏 | 部署文档要求前端静态文件由反向代理提供 | `2026-10-31-backend-question-static-files-and-security-headers.md` 问题 1 |
| 18 | 部署 | 后端加的那组安全响应头具体是哪六个、值是什么、加在哪些响应上（只加公开文件路由，还是管理端业务端口的每个响应）？`/api/admin/**` 的响应是否自己设 `Cache-Control`？反向代理还需要补哪些 | 反向代理再加会让同一个头在响应里出现两次 | 示例配置只给 `/api/` 加 `Cache-Control: no-store` | `2026-10-31-backend-question-static-files-and-security-headers.md` 问题 2、问题 3 |
| 19 | 系统管理 | 四类“只能授出自己持有的权限”的 403，`data` 能否改为 `{"reason":"<代码>"}`（例如 `GRANT_NOT_HELD`、`OWN_ROLE`、`ROLE_NOT_HELD`、`ADMIN_NOT_HELD`，名称由后端定） | 界面不显示后端的英文句子，只看错误码时没法告诉操作者是哪一条挡住了他 | 写一句覆盖四类规则的通用话 | `2026-10-31-admin-frontend-admin-forbidden-reason.md` 第一节 |
| 20 | 系统管理 | 对非超级管理员，`GET /me` 的 `permissions` 是否正好等于规则里“持有的权限码”（各角色权限码的并集）？有没有一边有、另一边没有的码？不同的话请给出规则所用集合的读取方式 | 前端据此在权限树里预先禁用节点 | 按 `permissions` 预先禁用，后端 403 兜底 | `2026-10-31-admin-frontend-admin-forbidden-reason.md` 第二节 |
| 21 | 系统管理 | 能否在 `GET /me` 加 `roleIds`，或在 `GET /roles` 每行加 `heldByMe` | “不能改自己持有的角色”现在只能等后端答 403 才提示，页面无法提前禁用编辑 | 等 403 后显示通用句 | `2026-10-31-admin-frontend-admin-forbidden-reason.md` 第三节 |
| 22 | 登录与权限 | `GET /api/admin/permissions` 的响应是不是 `{"items":[节点…]}`（平铺、不分页、按 `sortOrder` 升序，`MENU` 节点的 `parent` 为 `null`），节点字段是否为 `code`、`parent`、`type`、`sortOrder`、`nameZh`、`nameEn`、`builtin`、`createdByUsername` | 角色编辑页的权限树和权限树管理页都靠它 | 按这个形状读；`builtin` 不是 false 的一律按内置处理 | `2026-10-26-admin-frontend-auth-and-permissions.md` 第一节；`2026-10-26-admin-frontend-system.md` 第三节第 5 条；`2026-10-21-admin-frontend.md` 第二部分 2.1 第 1 条 |
| 23 | 登录与权限 | 权限树里 `COSMETIC:GRANT`、`STATS:EXPORT`、`STATS:LAND` 的父节点实际写的是谁？`SUBSCRIPTION:CONFIG` 是页面（`MENU`）还是功能（`FUNCTION`） | 角色页“勾选父节点同时勾选子节点”的行为取决于它 | 前端不写死任何父子关系，全部读 `parent` | `2026-10-26-admin-frontend-auth-and-permissions.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.1 第 4 条 |
| 24 | 登录与权限 | `POST /auth/change-password` 失败时：旧密码错是不是 401 `ADMIN_INVALID_CREDENTIALS`；新密码太短或与用户名相同是不是 400 且 `ref` 为 `newPassword`、`reason` 用哪个码；密码长度按码点还是 UTF-16 单位计 | 旧密码错不能是会让前端回登录页的 401 `ADMIN_INVALID_TOKEN`；要把错误放到对应输入框旁 | 旧密码错 401 `ADMIN_INVALID_CREDENTIALS`；太短 400 `OUT_OF_RANGE`；按码点 | `2026-10-26-admin-frontend-auth-and-permissions.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.1 第 2 条 |
| 25 | 系统管理 | 拒绝“改自己的角色或超级管理员标志”“停用或删除自己”“最后一个启用的超级管理员被停用、删除、清除标志”时，错误码是什么（能否给专用码，如 `ADMIN_SELF_PROTECTED`、`LAST_SUPER_ADMIN`） | 界面只显示按错误码翻译的文字，现有 403、409 的译文看不出原因 | 针对自己答 403 `ADMIN_FORBIDDEN`，最后一个超管答 409 `INVALID_STATE`，页面后面加一句固定的话 | `2026-10-26-admin-frontend-system.md` 第一节第 1 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 2 条 |
| 26 | 渠道包与应用版本 | `GET /channels` 的 `data` 是 `{"items":[…]}` 还是裸数组？分页吗？字段是契约里的 `code` 还是 `channelCode`？有没有 `updatedAt` | 所有统计页、广告报表、目录、投放账户的渠道下拉都读它，字段名不对下拉会是空的 | 读 `code`；两种外层形状都接受；不分页 | `2026-10-26-admin-frontend-stats-and-channels.md` 第一节；`2026-10-26-admin-frontend-app-versions.md` 第一节第 1、2 条；`2026-10-21-admin-frontend.md` 第二部分 2.3 第 1 条 |
| 27 | 统计报表 | `/stats/daily` 范围内某天没有汇总行（包括当天还没汇总）时，是不返回这一行，还是返回各列为 0 或 `null` 的行 | 总览卡片要区分“不知道”（显示“—”）和真的 0 | 没有行当作不知道；趋势图补 0 | `2026-10-26-admin-frontend-stats-and-channels.md` 第三节；`2026-10-26-admin-frontend-dashboard.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.4 第 2 条 |
| 28 | 统计报表 | `/stats/retention`、`/reactivation`、`/guest/daily`、`/guest/cohort`、`/guest/retention` 范围内某天没有汇总行时，是不返回，还是返回人数为 0、各格为 `null` 的行 | 补出的“人数 0”会被读成“那天没有注册” | 只显示后端返回的行，不补行（回流的图补满日期） | `2026-10-26-admin-frontend-daily-retention.md` 第二节；`2026-10-26-admin-frontend-guest-stats.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.4 第 4 条 |
| 29 | 埋点管理 | `GET /analytics/events` 的参数名（`accountId`、`deviceId`、`eventName`、`from`、`to`、`page`、`pageSize`）、响应是否分页 `{items,total}` 且按 `receivedAt` 倒序、每条的字段（`id`、`eventName`、`accountId`、`deviceId`、`receivedAt`、`clientTime`、`country`、`ip`、`params`、`context`）有没有稳定的 `id`？平台和版本是否只能从 `context` 里读 | 字段名猜错整列为空 | 以上全部按“是”做 | `2026-10-26-admin-frontend-analytics.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.6 第 2 条 |
| 30 | 记忆服务与监控 | `GET /alerts` 的 `detail` 是字符串还是 JSON 对象？带 `status=OPEN` 时 `total` 是满足筛选的总数吗（不带 `status` 是全部，后端已答） | 总览“未处理告警”卡片只读 `total`，若它是当前页条数就永远显示 1 | `detail` 当文字显示；`total` 不是数字时卡片显示“—” | `2026-10-26-admin-frontend-memory-monitor-support.md` 第一节；`2026-10-26-admin-frontend-dashboard.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.10 第 1 条 |
| 31 | 订阅与权益 | `GET /subscription-products` 的响应是不是 `{"items":[{store,productId,entitlementKey,enabled,sortOrder,surfaces}]}`？`PUT` 是一条记录按 `(store, productId)` 新增或修改，还是整表替换？`entitlementKey` 不存在是 400 吗 | 商品映射页的读写 | 响应 `{items}`；`PUT` 一条，带全部六个字段 | `2026-10-26-admin-frontend-subscriptions.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.11 第 1 条 |
| 32 | 订阅与权益 | `GET /subscription-events` 每行是不是订阅事件的列去掉 `payload`？`status` 除 `FAILED` 外还有别的值吗？“失败”是否等于 `error` 不为空？对没失败的事件重新处理、对不需要关注的事件点“已处理”是不是 409？这两个接口的响应 | 页面只在 `error` 不为空的行显示“重新处理”，取决于“失败”的定义 | 筛选只提供 `status=FAILED` 和 `needsAttention=true` | `2026-10-26-admin-frontend-subscriptions.md` 第五节；`2026-10-21-admin-frontend.md` 第二部分 2.11 第 5 条 |
| 33 | 额度 | 额度包 `/credit-products`：`GET` 的形状、有没有 `id`、`PUT` 的路径和请求体（`surfaces` 不出现时是保持不变还是按空数组覆盖）、重复时答什么、`credits` 范围、`productId` 长度上限；能否每行带 `updatedAt` 并让 `PUT` 接受 `expectedUpdatedAt`（不一致答 409） | 两个管理员同时改同一个额度包会静默覆盖 | `PUT /credit-products/{id}` 带 `{credits,enabled,sortOrder}`；保存前重读比较 | `2026-10-26-admin-frontend-credits.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.12 第 1 条 |
| 34 | 成本 | `GET /stats/usage-cost` 的 `costAmount`、`quantity` 能否像价格一样用十进制字符串返回 | JSON 数在浏览器里变成浮点，小额会丢位，同币种相加要精确 | 两种都收，之后用文字做精确加法；后端若回数，精度在解析时已丢 | `2026-10-26-admin-frontend-cost.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.13 第 1 条 |
| 35 | 成本 | 非 LLM 批次的 `unitPrice` 在 `GET /usage/prices`、待审批次接口（包括 `active` 那份）里是字符串还是数（后端第一份回复同一条里两种说法） | 单价最多十位小数，经浮点会丢位 | 两种都收，字符串原样保留 | `2026-10-26-admin-frontend-cost.md` 第八节；`2026-10-21-admin-frontend.md` 第二部分 2.13 第 7 条 |
| 36 | 推送 | `GET /push/templates` 的响应现在是 `{items, missingLocales}`：是否保留 `total`、是否分页、有哪些筛选参数 | “触发原因乘语言”矩阵要读全部模板 | 有 `total` 就读到取够，没有就读到空页为止 | `2026-10-26-admin-frontend-push.md` 第一节第 2 条；`2026-10-21-admin-frontend.md` 第二部分 2.14 第 2 条 |
| 37 | 推送 | 模板与周期推送的请求体里，图片字段叫 `imageUploadId` 还是 `uploadId`？`linkType` 为 `NONE` 时 `linkTarget` 传空串还是 `null`？怎样去掉已有的图片？标题和正文的长度上限是多少 | 契约没写；若是 `uploadId`，要改类型、请求体、前端模拟服务和测试 | 用 `imageUploadId`；不提供去掉图片 | `2026-10-26-admin-frontend-push.md` 第一节第 3、4、5 条；`2026-10-21-admin-frontend.md` 第二部分 2.14 第 3、4、5 条 |
| 38 | 推送 | 召回模板被默认语言规则拒绝时，400 的 `data` 里能否加 `case`（`DEFAULT_MISSING`、`DEFAULT_REQUIRED_BY_OTHERS`、`DEFAULT_MOVED_AWAY`）？`PUT /push/templates/{id}` 是否真的接受请求体里的 `locale`、`triggerReason`（改语言、改原因） | 三种情形教运营做的事不同，只靠 `defaultLocale`、`reason` 区分不出；若不接受，第三种情形在管理端永远不会出现 | 写一句覆盖三种情形的通用话 | `2026-10-31-admin-frontend-push-default-language-case.md` 第三节、第四节；`2026-10-31-design-doc-changes-from-backend-d1.md` “待后端确认的点”第 5 条 |
| 39 | 邀请与分享 | `GET /invites/share-funnel`、`/share-channels` 的 `data` 是不是 `{items}`，行字段名是否是汇总表的列名，日期格式，当天汇总还没生成的日子是否返回，`from`、`to` 含两端吗、不传怎么办，`shareChannel` 没有渠道时是空串还是 `null` | 分享统计页的图表与合计 | 按 `{items}` 读；没有行的日子补 0 | `2026-10-26-admin-frontend-invite.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.15 第 1 条 |
| 40 | 活动管理 | `GET /tasks/configs`（及详情）能否带布尔字段 `hasRecords`？对已有任务记录的配置，`PUT` 带没改的 `taskType`、`targetValue` 算不算改（是否视为无变化而成功） | 规格要求已有记录的配置类型和目标值只读，现在只能在保存被 409 拒绝后才变只读 | 不依赖这个字段，409 后还原成原值并只读 | `2026-10-26-admin-frontend-activity.md` 第一节第 1、2 条；`2026-10-21-admin-frontend.md` 第二部分 2.16 第 1、2 条 |
| 41 | 投放管理 | `GET /attribution/performance` 的行用什么字段标投放账户（`campaignId`，“0”是未归因）和日期（`statDate`）？能否直接带 `campaignCode`、`campaignName`？`cost`、`cpa`、`cpi` 是数还是字符串？“未归因”行是否只在 `groupBy=campaign` 且没选账户时出现？导出是否接受 `groupBy` | 表格的列 | 从投放账户列表按编号对出编码和名称 | `2026-10-26-admin-frontend-campaign.md` 第一节第 1、2、3、4 条；`2026-10-21-admin-frontend.md` 第二部分 2.17 第 1、2、3、4 条 |
| 42 | 应用内广告 | 五组资源的列表是 `{items,total}`（广告位是 `{items}`）吗？对象字段是否是实体列名加 `…Username`？素材行里 `type`、`width`、`height`、`bytes`、`durationSeconds`、`mediaUrl`、`thumbnailUrl` 是否都在，每次读列表都给新地址吗？单元的 `surfaces` 在列表里带不带、写接口收不收、后台要不要显示和编辑 | 后台既不显示也不发 `surfaces`，别处创建的“仅安卓”单元会让运营困惑 | 既收 `{items,total}` 也收裸数组；`surfaces` 不显示不发送 | `2026-10-26-admin-frontend-ads.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.18 第 1 条 |
| 43 | 应用内广告 | 只有“广告素材”权限的管理员读不到广告位和素材规格：`GET /ads/placements` 能否也对这个权限开放，并在 `GET /ads/meta` 返回 `creativeAspectTolerancePercent`；或者在单元响应里带广告位和素材规格 | 素材表单要对照规格给“通过/不通过” | 读不到时写明以服务器检查为准，容差用契约默认的 3% | `2026-10-26-admin-frontend-ads.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.18 第 3 条 |
| 44 | 短信与邮件 | 删除、停用、改类型或国家使它不再是最后一个覆盖的启用验证码通道而被拒时，能否给专用错误码（如 `LAST_OTP_CHANNEL`），或在 `details` 里给 `ref`（`channel`）和 `reason`？`GET /sms/meta` 能否加 `phoneLoginEnabled`、`phoneAccountCount`？“最后一个覆盖的启用验证码通道”的算法是否同页面（按国家算，空国家表示全部国家） | 现在译文是“输入内容不合法”，看不出原因，页面也不知道有没有手机号账号 | 操作前提示这两个条件，被拒后加一句固定说明 | `2026-10-26-admin-frontend-sms-email.md` 第一节第 9、10、11 条；`2026-10-21-admin-frontend.md` 第二部分 2.19 第 8、9、10 条 |
| 45 | 系统配置 | 开启手机号登录被拒时，400 的 `data` 能否加数组 `missing`（每项一个固定大写码，如 `OTP_TEMPLATE_ANY`、`OTP_TEMPLATE_EN_ALL_COUNTRIES`） | `message` 说“逐项”写出缺的内容，前端不解析英文句子，不知道缺的是哪几项 | 固定写一句最常见的缺项 | `2026-10-31-admin-frontend-config-refusal-reasons.md` 第一节 |
| 46 | 告警 | `SUBSCRIPTION_EVENT_FAILED` 告警的 `refType`、`refId`、`accountId`、`detail` 取值是什么，什么时候自动解决，能否手动关闭，运营看到后该做什么 | 告警页要让运营明白指的是哪个对象、要不要处理 | `refType`、`refId`、`detail` 原样显示，不加说明 | `2026-10-31-admin-frontend-alerts-new-types.md` 第一节；`2026-10-31-design-doc-changes-from-backend-d1.md` “待后端确认的点”第 3 条 |
| 47 | 系统管理 | `PUT /admins/{id}` 缺省的字段是“不改”而不是“清空”吗？`username` 需要带吗？自己那一行带了 `roleIds` 或 `superAdmin`（即使值没变）是否一律拒绝 | 读不到角色列表时发 `roleIds: []` 会拿走全部角色 | 不发 `username`；只发有改动的字段；自己那一行一个都不发 | `2026-10-26-admin-frontend-system.md` 第一节第 2、3 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 3、4 条 |
| 48 | 系统管理 | 审计日志的 `adminId`、`action`、`targetType`、`targetId` 是精确匹配吗？能否给出 `action`、`targetType` 的取值清单？这几个筛选字段的长度上限按码点还是 UTF-16 单位计（上限数字后端已答） | 有清单页面可以做成下拉；长度口径决定输入框怎么限制 | 精确匹配，自由输入 | `2026-10-26-admin-frontend-system.md` 第四节第 2 条；`2026-10-31-design-doc-changes-from-backend-d1.md` “待后端确认的点”第 2 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 15 条 |
| 49 | 系统管理 | 审计日志按管理员编号筛选：管理员被改名或删除后，还能筛到他以前的行吗（写入时的用户名后端已答） | 页面显示管理员编号的前 8 位和写入时的名字 | 按编号筛选 | `2026-10-26-admin-frontend-system.md` 第四节第 4 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 17 条 |
| 50 | 系统管理 | 只有“审计日志查看”权限、没有“管理员管理”权限的人，能否有只读的管理员名单接口（只含 `id`、`username`）供按管理员筛选 | 现在这类人只能手输管理员编号 | 输入管理员编号，没有下拉 | `2026-10-26-admin-frontend-system.md` 第四节第 5 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 18 条 |
| 51 | 渠道包与应用版本 | `GET /app-versions` 是否分页、`data` 是什么形状？行里有没有 `apkUrl`、`apkSizeBytes`、`apkSha256`，`changelog` 是不是以语言代码为键的对象？某渠道当前生效的版本用 `?channelCode=&status=ACTIVE` 读对吗 | 列表要显示文件大小和哈希前 8 位 | 发 `page`、`pageSize`；读到 `{items,total}` 就用后端的页，否则在浏览器里切页 | `2026-10-26-admin-frontend-app-versions.md` 第二节第 1、2、4 条；`2026-10-21-admin-frontend.md` 第二部分 2.3 第 6、7、8 条 |
| 52 | 渠道包与应用版本 | 409 `INVALID_STATE` 有几种原因（版本不是草稿、渠道已停用、上传记录已被别的版本使用），能否给确定的 `data.status`（如 `CHANNEL_DISABLED`、`UPLOAD_USED`）？`(channelCode, versionCode)` 重复是不是 409 `DUPLICATE_RESOURCE` 且 `data.field` 为 `versionCode`，先于还是晚于“不大于生效版本”的检查 | 页面要提示运营该做什么 | 带新上传文件时遇到 409 且 `data.status` 不是版本状态，就提示重新上传 | `2026-10-26-admin-frontend-app-versions.md` 第三节第 6、7 条；`2026-10-21-admin-frontend.md` 第二部分 2.3 第 14、15 条 |
| 53 | 统计报表 | `stats.max_range_days` 的“跨度”是含两端的天数（10 月 1 日到 31 日是 31），还是两端日期之差（30） | 差一天会多拒绝或多放行一个范围 | 按含两端的天数计 | `2026-10-26-admin-frontend-stats-and-channels.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.4 第 1 条 |
| 54 | 统计报表 | `POST /stats/land/retention` 是否一次把“活跃留存”和“通话留存”两种、所有平台和渠道的格子都补了？`reactivation` 是否三个沉默天数（7、14、30）都重算 | 决定补数按钮要几个 | 按“都补”处理 | `2026-10-26-admin-frontend-daily-retention.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.4 第 3 条 |
| 55 | 统计报表 | `activeSubscriptionsBackfilled` 在没有快照的日子是 `null` 还是 `false` | 决定“回填”标记何时显示 | 只在值是数字且标志为 true 时标“回填” | `2026-10-26-admin-frontend-daily-retention.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.4 第 5 条 |
| 56 | 统计报表 | 今天第一次汇总之前，昨天那批新用户的 `d1` 是 `null` 还是 0？今天汇总之后、今天结束之前，它算不算临时值 | 0 会被读成“昨天注册的人一个也没回来” | `null` 才算没有值；日期加一天等于今天的那批标“临时值” | `2026-10-26-admin-frontend-dashboard.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.4 第 6 条 |
| 57 | 统计报表 | 把 `guest.call_minutes_total` 明确设成 0 时，`configuredTotalSeconds` 是 0 还是 `null`？两者在后端是不是同一种状态 | 卡片文字不同 | `null` 显示“未配置，游客不能通话”，0 显示“0 分钟” | `2026-10-26-admin-frontend-guest-stats.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.4 第 7 条 |
| 58 | 统计报表 | `/stats/guest/retention?platform=unknown` 能否像日报一样查询 | 运营才能看出平台缺失的那部分设备留得怎么样 | 只提供 `ALL`、`ANDROID`、`IOS` 三个选项 | `2026-10-26-admin-frontend-guest-stats.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.4 第 8 条 |
| 59 | 统计报表 | `/stats/daily`、`/retention`、`/reactivation`、`/guest/*` 返回的 `items` 是否保证按日期升序 | 前端按收到的顺序画，倒序会让折线横轴从新到旧 | 按收到的顺序显示，前端模拟服务按升序返回 | `2026-11-01-admin-frontend-moderation-and-reports-order.md` 第三节 |
| 60 | 通话 | `GET /sessions` 的筛选参数名和格式：账号编号是 `accountId` 吗；时间范围是 `from`、`to`（ISO 时刻，含与不含）还是 UTC 日；“是否进行中”是 `ongoing` 吗；`endReason` 除 `DEADLINE` 外是否也接受另外四个值；非法值是否 400 | 参数名猜错后端会静默忽略，运营会以为“该账号没有会话” | 只发有值的参数 | `2026-10-26-admin-frontend-sessions.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.5 第 1 条 |
| 61 | 通话 | `GET /sessions/{id}` 还会返回哪些字段，`roomName` 能不能给运营看（`maxDurationMinutes` 后端已答） | 不该给运营看的字段不应读取 | 读 `freeTier`、`roomName`、`timezone`、`renderMode`、`deadlineAt`、`endReason` 和三个进出时刻 | `2026-10-26-admin-frontend-sessions.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.5 第 3 条 |
| 62 | 通话 | 会话列表里账号编号为空就是游客会话吗？“进行中”是否包括“启动中”（`agentJoinedAt` 为空）的会话 | 页面决定怎么标游客和启动中 | 空编号当游客；时长列写“进行中” | `2026-10-26-admin-frontend-sessions.md` 第四节、第五节；`2026-10-21-admin-frontend.md` 第二部分 2.5 第 4、5 条 |
| 63 | 埋点管理 | `GET /analytics/event-summary`、`/event-names`、`/funnel`、`/events` 的 `from`、`to` 是 `YYYY-MM-DD`（UTC 日，含两端）还是带时刻的 ISO 时间？跨度按含两端的天数算吗？不传是 400 还是默认范围？越界时 `ref` 是 `to` 吗 | 事件明细常要精确到分钟，格式决定要不要加时间选择 | 发 `YYYY-MM-DD`（UTC 日，含两端） | `2026-10-26-admin-frontend-analytics.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.6 第 1 条 |
| 64 | 埋点管理 | 已保存漏斗 `/analytics/funnels` 的 `GET` 形状与排序、`POST/PUT` 请求体、重名是否 409（`data.field` 为 `name`）、名称长度、预设漏斗被改或删时答什么、步骤事件名规则、步骤数或窗口不合格时的 `ref` | 编辑要给准确提示，并发操作时需要确定的错误 | 名称去空白后 1 到 100 个码点；预设的 `PUT/DELETE` 答 409 `INVALID_STATE` | `2026-10-26-admin-frontend-analytics.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.6 第 3 条 |
| 65 | 用户 | `GET /users` 和 `GET /users/export` 的七个筛选参数名是不是 `accountId`、`email`、`phone`、`status`、`channelCode`、`trafficType`、`mediaSource`？除邮箱手机号外是精确匹配吗，`mediaSource` 忽略大小写吗？`status` 取非法值是 400 吗 | 参数名猜错筛选会被静默忽略，导出会导出全部用户 | 用这七个名字，只发有值的参数 | `2026-10-26-admin-frontend-users.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.7 第 1 条 |
| 66 | 用户 | `GET /users/{id}/sessions` 是不是分页的 `{items,total}`、按 `requestedAt` 倒序，每项有哪些列 | 用户详情的“会话”页签 | 读 `id`、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`、`endReason` | `2026-10-26-admin-frontend-users.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.7 第 2 条 |
| 67 | 用户 | 能否二选一：`GET /account-deletions` 加 `accountId` 筛选，或 `GET /users/{id}` 在待删除、删除中时带 `deletion` 对象（含到期时间和发起人） | 客服要告诉用户宽限期到哪天、是谁发起的删除 | 页面不显示宽限期截止时间 | `2026-10-26-admin-frontend-users.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.7 第 3 条 |
| 68 | 内容审核 | `GET /moderation/records` 是否支持 `contentType` 筛选（非法值是否 400）？不认识的查询参数是忽略还是 400 | 队列有七种内容类型，运营要只看某一种；后端若忽略，列表会混进别的类型 | 页面发 `contentType`，并对返回的行再过滤一次 | `2026-10-26-admin-frontend-moderation.md` 第一节；`2026-11-01-admin-frontend-moderation-and-reports-order.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.8 第 1 条 |
| 69 | 内容审核 | 审核记录里 `categories` 是字符串数组还是逗号分隔的字符串？`source=REPORT` 时 `autoLevel`、`score` 为 `null` 吗？详情与列表同形状吗？后端能否直接给等待秒数 | 影响列的显示 | 按数组；前端用 `createdAt` 算等待时长 | `2026-10-26-admin-frontend-moderation.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.8 第 2 条 |
| 70 | 内容审核 | `GET /moderation/stats` 里 `approved`、`rejected` 算创建日还是处理日？`avgHandleSeconds` 是范围内处理的还是范围内创建的记录的平均？`oldestPendingSeconds` 是否与 `from`、`to` 无关？没有记录的日子有没有行 | 总览“审核积压”卡片只要最老的等待秒数，若依赖范围会显示偏小 | 按“与范围无关”处理，`from`、`to` 都传今天 | `2026-10-26-admin-frontend-moderation.md` 第四节；`2026-10-26-admin-frontend-dashboard.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.8 第 4 条 |
| 71 | 形象与装扮 | `GET /cosmetics`、`/actions`、`/declarations`、`/renderer-models`、`/generation-tasks` 是否分页？`/cosmetics` 的筛选参数是 `kind`、`enabled`、`style` 吗？`/generation-tasks` 只有 `status`、`type` 且按创建时间倒序吗？投诉列表按 `dueAt` 升序吗（投诉的状态筛选后端已答） | 服装会超过 20 条要翻页，参数名错了筛选静默失效 | 总是发 `page`、`pageSize`，响应没有 `total` 就在前端切页 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第一节；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 1 条 |
| 72 | 客服 | `GET /support/feedback` 能否按 `forwardStatus`、`category` 筛选？列表每行是全部列（含正文和上下文）还是摘要 | 客服要找转发失败的几条，200 行带全文太大 | 分页、倒序，不加筛选 | `2026-10-26-admin-frontend-memory-monitor-support.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.10 第 2 条 |
| 73 | 客服 | `POST /support/feedback/{id}/retry`、`POST /alerts/{id}/resolve` 成功时 `data` 是什么？对不是失败状态的反馈重试、对已关闭的告警再关闭，是不是 409 `INVALID_STATE` 且 `data.status` 为当前状态 | 并发操作时要给出明确提示 | 忽略成功响应；失败显示 409 译文并重新读列表 | `2026-10-26-admin-frontend-memory-monitor-support.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.10 第 3 条 |
| 74 | 共用 | `GET /api/admin/meta` 能否再补这六个值：`monitorMaxRangeDays`、`attributionCostCurrency`（或在投放效果响应里带 `currency`）、`taskTypes`、`entitlementLimitMax`、`googlePlayPackageName`、`creativeAspectTolerancePercent`；`GET /ads/meta` 能否加 `notSkippableFullScreenCount` | 这些值所在配置键的编辑权限不属于使用它们的页面，持有页面权限的人读不到 | 取不到时不做前端预检，也不显示数字 | `2026-10-26-admin-frontend-memory-monitor-support.md` 第五节；`2026-10-26-admin-frontend-campaign.md` 第一节第 5 条；`2026-10-26-admin-frontend-activity.md` 第四节第 2 条；`2026-10-26-admin-frontend-subscriptions.md` 第八节；`2026-10-26-admin-frontend-app-versions.md` 第三节第 8 条；`2026-10-26-admin-frontend-ads.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.10 第 5 条；2.17 第 5 条；2.16 第 12 条；2.11 第 8 条 |
| 75 | 订阅与权益 | `GET /subscriptions` 的筛选参数是不是 `accountId`、`state`、`store`、`productId` | 参数名猜错筛选静默失效 | 用这四个名字，空值不发 | `2026-10-26-admin-frontend-subscriptions.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.11 第 4 条 |
| 76 | 成本 | `GET /usage/prices`、`/usage/models` 是否接受 `page`、`pageSize`，默认页大小是多少？`/usage/models` 能否加 `hasActivePrice=false`、`resourceType` 筛选 | 页面要读全所有批次 | `pageSize=200` 一页页读（最多 50 页），筛选在前端做 | `2026-10-26-admin-frontend-cost.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.13 第 2 条 |
| 77 | 成本 | `PUT /config/attribution.cost_currency` 收到格式不对的币种（`usd`、`euro`、`US`、空串）是否拒绝、答什么、`reason` 能否不用 `OUT_OF_RANGE`？小写是拒绝还是改成大写？`ZZZ` 是否拒绝？用量价格的允许币种列表是否也管这个键 | 页面把 `OUT_OF_RANGE` 一律解释为“已有成本行，不能改币种” | 页面要求三位大写字母，提交前拦住 | `2026-10-31-admin-frontend-cost-currency-format.md` 全文 |
| 78 | 推送 | `/push/templates/{id}` 里的 `{id}` 是实体编号还是 `(triggerReason, locale)`？同一组合再 `POST` 是 409 吗（`data.field` 是什么） | 路径写法 | 用实体 `id`；前端发送前先拦住 | `2026-10-26-admin-frontend-push.md` 第一节第 1、8 条；`2026-10-21-admin-frontend.md` 第二部分 2.14 第 1、8 条 |
| 79 | 推送 | `GET /push/tasks` 是否分页、按计划时间倒序、每项是推送任务的列加 `createdByUsername`，支持 `status` 筛选吗？立即发送要不要显式带 `scheduledAt`？手动任务请求体、`accountIds` 的条数上限和格式？`cancel` 的响应，以及对非待发送任务的错误 | 列表与表单 | 立即发送不带 `scheduledAt`；`cancel` 非待发送答 409 `INVALID_STATE` | `2026-10-26-admin-frontend-push.md` 第二节第 1、2、3、4 条；`2026-10-21-admin-frontend.md` 第二部分 2.14 第 9、10、11、12 条 |
| 80 | 邀请与分享 | `GET /invites/chain` 的节点是不是 `{accountId,label,joinedAt,children}`，`joinedAt` 的含义，`maxDepth` 是不是实际到达的深度，账号不存在 404、参数越界 400 的 `ref`，节点很多会不会截断 | 邀请链树的显示 | 按这些理解；页面一次画出所有后代 | `2026-10-26-admin-frontend-invite.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.15 第 2 条 |
| 81 | 活动管理 | 签到活动、签到记录、任务配置、任务记录四个列表是否分页？`name`、`taskName` 是包含还是前缀、是否不分大小写？`/tasks/records` 的 `status` 取非法值是 400 吗 | 筛选与翻页 | 分页，`pageSize` 取 10、20、50、100 | `2026-10-26-admin-frontend-activity.md` 第二节第 1、2、3 条；`2026-10-21-admin-frontend.md` 第二部分 2.16 第 3、4、5 条 |
| 82 | 投放管理 | `GET /attribution/costs` 的行是否带 `campaignCode`、`campaignName`，`amount` 是数还是字符串？单笔和批量的 `POST/PUT` 请求体是否如我们所写？读不到成本币种时不带 `currency` 行不行（后端说录入仍要求 `currency` 等于设置）？批量 400 的 `ref` 格式和原因码，以及响应是不是 `{imported, overwritten}` | 成本录入与“新增几行、覆盖几行”的提示 | 用投放账户编号对出名称；响应没有这两个数时只写“已导入 n 行” | `2026-10-26-admin-frontend-campaign.md` 第三节第 1、2、3、4、5 条；`2026-10-21-admin-frontend.md` 第二部分 2.17 第 11、12、13、14、15 条 |
| 83 | 投放管理 | `GET /attribution/clicks` 的 `from`、`to` 是 ISO 时刻（含与不含）吗？`GET /attribution/summary` 的分组值缺失时 `key` 是 `null` 还是空串 | 筛选与显示 | 所选 UTC 日变成 `[from, to)`；两种都显示“—” | `2026-10-26-admin-frontend-campaign.md` 第四节第 1、2 条；`2026-10-21-admin-frontend.md` 第二部分 2.17 第 16、17 条 |
| 84 | 应用内广告 | 计划、广告位、单元、素材各写接口的请求体是否如我们所写？尤其三个状态接口的字段名；审核接口用 `reviewStatus` 还是 `decision`；单元的 `targeting` 是整体替换还是嵌套合并，发 `null` 的键会不会被类型校验拒绝 | 表单提交方式 | `targeting` 按嵌套合并，`null` 的键当作去掉 | `2026-10-26-admin-frontend-ads.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.18 第 2 条 |
| 85 | 应用内广告 | 删除名下有单元的计划、名下有素材的单元时，答 409 `INVALID_STATE` 还是专用码（如 `RESOURCE_IN_USE` 加 `data.what`）？草稿计划名下有单元能不能删 | 页面分不清是“状态不对”还是“名下还有东西” | 能读到单元的管理员，对有单元的计划不提供删除 | `2026-10-26-admin-frontend-ads.md` 第五节；`2026-10-21-admin-frontend.md` 第二部分 2.18 第 5 条 |
| 86 | 短信与邮件 | 短信渠道：`PUT` 是整条替换吗？`PUT …/enabled` 的请求体、新建时 `enabled` 的默认值？`channelCode` 的格式和长度？供应商 `allowedHosts` 是精确主机名还是后缀或通配？测试发送的响应和错误（无效号码 `PHONE_INVALID`、次数用完 `RATE_LIMITED`） | 表单与开关 | 整条 `PUT`；页面按主机名精确比较 | `2026-10-26-admin-frontend-sms-email.md` 第一节第 2、3、4、6、7、8 条；`2026-10-21-admin-frontend.md` 第二部分 2.19 第 2、3、5、6、7 条 |
| 87 | 短信与邮件 | `GET /sms/records` 的筛选参数名是不是记录的列名（`msgId`、`vendorMsgId`、`mobile`、`channel`、`channelCode`、`purpose`、`sendStatus`、`deliveryStatus`，以及 `used`、`from`、`to`）？导出用的筛选参数是否与列表完全一致 | 参数名猜错会被静默忽略 | 用这些名字；导出发列表参数去掉 `page`、`pageSize` | `2026-10-26-admin-frontend-sms-email.md` 第三节第 1、5 条；`2026-10-21-admin-frontend.md` 第二部分 2.19 第 15、17 条 |
| 88 | 站内通知 | `GET /notifications` 的筛选参数格式：`accountId` 原样；`category` 取 `ADMIN`、`SYSTEM_EVENT`；`isRead` 取 `true/false`；`from`、`to` 是 ISO 时刻吗（含与不含） | 筛选 | 所选 UTC 日变成 `[from, to)` | `2026-10-26-admin-frontend-notifications.md` 第一节第 1 条；`2026-10-21-admin-frontend.md` 第二部分 2.20 第 1 条 |
| 89 | 客户端配置 | 整体替换保存时，没有变化的语言行的 `updatedAt` 是否也更新？保存的回复丢了、用户再按保存时，内容相同的重复 `PUT` 能否幂等成功 | 否则版本比较会漏；回复丢失后再保存会被误报“已被他人修改” | `updatedAt` 相同时前端也比较各语言的值 | `2026-10-27-admin-frontend-concurrent-save.md` 第四节第 1、2 条 |
| 90 | 告警 | 投放回传凭证告警：只改名字（像素编号不变）、请求里没有令牌字段，算“重新填写”吗？广告平台错误码有没有固定写法和长度上限 | 否则运营改个备注就会把还没修好的告警关掉 | 前端模拟服务只在有新令牌或像素编号变化时才关闭告警 | `2026-10-31-admin-frontend-alerts-new-types.md` 第二节、第三节 |
| 91 | 共用 | 明细类列表的 `from`、`to`：审计日志、会话列表（按发起时间）、多开检测、额度流水、站内通知、短信发送记录——是带时刻的 ISO 时间（`from` 含、`to` 不含），还是 UTC 日 | 页面把所选的 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，格式不对筛选会失效或 400 | 照左边的写法发出，页面注明按 UTC | `2026-10-26-admin-frontend-system.md` 第四节第 1 条；`2026-10-26-admin-frontend-users.md` 第五节；`2026-10-26-admin-frontend-credits.md` 第二节；`2026-10-26-admin-frontend-sms-email.md` 第三节第 2 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 14 条；2.7 第 6 条；2.12 第 2 条 |
| 92 | 共用 | 报表类接口的 `from`、`to`：额度统计、投放成本——是 `YYYY-MM-DD`（UTC 日，含两端、跨度不超过 `stats.max_range_days`）吗？不传时取什么 | 日期范围选择器选哪一天就发哪一天 | 页面总是传 `from`、`to`，不依赖默认值 | `2026-10-26-admin-frontend-credits.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.12 第 3 条 |
| 93 | 系统管理 | 管理员用户名的长度和字符限制是什么？创建时密码、用户名、角色问题的 400 `ref` 是 `password`、`username`、`roleIds`，重置时是 `newPassword` 吗？管理员重名、角色重名、权限节点码重复的 409 `data.field` 是 `username`、`name`、`code` 吗 | 错误要放到对应输入框 | 按这些名字放，不认识的显示在对话框底部 | `2026-10-26-admin-frontend-system.md` 第一节第 5、6 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 6、7 条 |
| 94 | 系统管理 | `POST/PUT /roles` 的请求体是否整体替换（总发完整的 `name`、`remark`、`permissionCodes`，`remark` 空时发 `null`，权限码可为空数组）？名称大小写是否敏感，名称和备注的长度上限 | 表单提交方式 | 整体替换；页面不限制长度 | `2026-10-26-admin-frontend-system.md` 第二节第 1 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 8 条 |
| 95 | 系统管理 | 权限节点 `POST` 请求体是否 `{code,parent,type,sortOrder,nameZh,nameEn}`，`PUT` 是否 `{nameZh,nameEn,sortOrder}`（自定义节点改父节点时另带 `parent`）？码的格式和长度、名称长度、排序范围（“修改时类型不能改，改了答 400 且 `ref` 为 `type`”后端已答） | 表单提交方式 | 修改里不带 `code`、`type`；页面要求码不含空白和控制字符、至多 100 个码点 | `2026-10-26-admin-frontend-system.md` 第三节第 1、2 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 10、11 条 |
| 96 | 系统管理 | 把节点移到自己或自己后代下面（成环）、改内置节点的父节点、删除内置节点，各答什么错误 | 页面不提供这些操作，但并发操作时需要确定的错误 | 成环 400 且 `ref` 为 `parent`；改内置父节点 400；删内置节点 409 `INVALID_STATE` | `2026-10-26-admin-frontend-system.md` 第三节第 3、4 条；`2026-10-21-admin-frontend.md` 第二部分 2.2 第 12、13 条 |
| 97 | 渠道包与应用版本 | `POST /channels` 的请求体是否 `{code,name,platform,distribution,packageName}`（创建后默认启用，不发 `enabled`）？`PUT /channels/{code}` 是整条替换还是只改带来的字段，只发 `{"enabled":false}` 行不行 | 整条替换会用页面上一次读到的值覆盖别人刚改的名称 | 每次都发 `name`、`packageName`、`enabled` 三项 | `2026-10-26-admin-frontend-app-versions.md` 第一节第 3、4 条；`2026-10-21-admin-frontend.md` 第二部分 2.3 第 2、3 条 |
| 98 | 渠道包与应用版本 | 渠道名称和包名的长度上限、包名规则是什么？渠道码重复、`unknown`、格式不对、`IOS` 加 `DIRECT`、要改渠道码或平台或分发方式时，400 或 409 的 `ref` 和原因码分别是什么 | 页面只显示错误码和原因码的译文 | 名称不限长度；包名只收字母、数字、点、连字符、下划线 | `2026-10-26-admin-frontend-app-versions.md` 第一节第 5、6 条；`2026-10-21-admin-frontend.md` 第二部分 2.3 第 4、5 条 |
| 99 | 渠道包与应用版本 | 版本创建、修改、状态接口的请求体是否如我们所写（创建 `{channelCode,versionName,versionCode,minVersionCode,changelog,storeUrl 或 apkUploadId}`，状态 `{status,confirmStoreLive?}`）？`versionCode`、`minVersionCode` 的上限？更新说明每种语言的长度上限，以及不在支持列表里的语言代码收不收 | 表单提交方式 | 商店渠道只带 `storeUrl`，直装渠道只带 `apkUploadId`；页面接受 1 到 2^53-1 | `2026-10-26-admin-frontend-app-versions.md` 第三节第 1、2、3 条；`2026-10-21-admin-frontend.md` 第二部分 2.3 第 9、10、11 条 |
| 100 | 渠道包与应用版本 | 版本写接口 400 的 `ref` 是不是请求体字段名（`versionName`、`versionCode`、`minVersionCode`、`storeUrl`、`changelog`、`apkUploadId`、`confirmStoreLive`、`channelCode`）？商店链接不符合规则、激活直装版本时文件不存在或校验和不一致、APK 缺 v2 以上签名，各给什么专用原因码 | 页面不显示后端的 `message`，没有码只能写“输入内容不合法” | 提交前自己检查并给出具体原因 | `2026-10-26-admin-frontend-app-versions.md` 第三节第 4、5 条、第四节第 1 条；`2026-10-21-admin-frontend.md` 第二部分 2.3 第 12、13、18 条 |
| 101 | 渠道包与应用版本 | 商店链接检查里安卓链接的 `id` 用的是渠道包的 `packageName` 还是环境变量里的包名？后端收不收没有名称的 `IOS` 渠道商店链接 `/us/app/id<数字>` 和带查询参数的链接 | 页面检查和后端不一致会放过或误拦 | 用所选渠道的包名；`IOS` 渠道严格按契约的两种路径 | `2026-10-26-admin-frontend-app-versions.md` 第三节第 8、9 条；`2026-10-21-admin-frontend.md` 第二部分 2.3 第 16、17 条 |
| 102 | 埋点管理 | 漏斗步骤的事件名里有逗号怎么办（转义规则，或改用重复参数） | 管理员手输步骤，逗号会被拆开 | 页面拒绝含逗号的步骤 | `2026-10-26-admin-frontend-analytics.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.6 第 4 条 |
| 103 | 用户 | 封禁、解封、发起删除、取消删除、重试成功时，`data` 返回什么 | 只影响页面要不要读 | 不读，成功后重新读取 | `2026-10-26-admin-frontend-users.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.7 第 5 条 |
| 104 | 内容审核 | `POST /moderation/records/{id}/decision` 的响应 `data` 是什么、`note` 最长多少码点、检查顺序是不是参数、记录是否存在、状态 | 表单提示 | 不读响应；`note` 去空白后 1 到 500 个码点 | `2026-10-26-admin-frontend-moderation.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.8 第 3 条 |
| 105 | 内容审核 | 配置键 `moderation.text_rules` 与 `GET/PUT /moderation/text-rules` 是同一份数据吗（规则页保存后，配置接口里该键的值同步变化吗） | 决定配置页里该键要不要只读 | 配置页里该键只读并指向规则页 | `2026-10-26-admin-frontend-moderation.md` 第六节；`2026-10-21-admin-frontend.md` 第二部分 2.8 第 6 条 |
| 106 | 形象与装扮 | 目录条目的 `names`、`texts` 里 `en` 是否必填 | 目录接口对客户端按语言回退到 `en` | 不强制，至少一种语言非空 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第二节第 2 条；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 3 条 |
| 107 | 形象与装扮 | 服装、动作的 `POST/PUT` 请求体是否如我们所写（`PUT` 不带 `key`、`kind`、`enabled`，整体替换，`creditPrice: null` 清除价格，图片只在换图时带）？预览图和图标创建时必填吗？`enabled` 创建时能带吗？`kind` 创建后只读吗 | 请求体猜错会保存失败 | 如括号所写 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第二节第 3、4 条；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 4 条 |
| 108 | 形象与装扮 | 每种 `kind` 一个默认的免费条目：把另一个设为默认时，旧默认自动取消还是 409？`isDefault` 为真而 `isFree` 为假是 400（`ref` 为 `isDefault`）吗 | 表单提示 | 假设后者是 400 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第二节第 5 条；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 5 条 |
| 109 | 形象与装扮 | `key`、`names`、动作 `description`、声明 `version`、`texts` 的长度上限和字符规则是什么？声明 `version` 是自由文本还是日期加序号，重复是 409（`data.field` 为 `version`）吗，从未生效过的版本 `activeFrom` 是 `null` 吗 | 表单检查 | 只检查非空和 `generationSpec` 的长度 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第二节第 6、7 条；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 6、7 条 |
| 110 | 形象与装扮 | 动作补生成遇到已停用动作的 409，`data` 里有没有状态？默认数字人改名在哪些状态下被拒？对已生效的默认数字人再调 `activate` 是幂等成功还是 409 | 页面的按钮与提示 | 生成中的不显示“改名”；再激活当作成功 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 9 条 |
| 111 | 记忆服务与监控 | 记忆服务三个写接口成功时 `data` 是什么？名字不合格、`teiBaseUrl` 的主机不在白名单、`dimensions` 越界等校验失败的 `ref` 和 `reason` 是什么 | 校验失败要对到表单项 | 成功响应一律忽略；按字段名对到表单项 | `2026-10-26-admin-frontend-memory-monitor-support.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.10 第 4 条 |
| 112 | 记忆服务与监控 | `embeddingAssignments` 的顺序，后端的“当前模型”是不是最新的一条（后端已说只显示最新 200 条并给 `truncated`、`totalCount`） | 决定“当前模型”显示哪个 | 按 `assignedAt` 倒序，最新的当作当前 | `2026-10-26-admin-frontend-memory-monitor-support.md` 第六节；`2026-10-21-admin-frontend.md` 第二部分 2.10 第 6 条 |
| 113 | 记忆服务与监控 | 能否在管线监控响应里加 `sources`（最近 `monitor.max_range_days` 天内上报过的全部来源），或提供单独的来源列表接口 | 停止上报的来源在较短范围里没有点，也就不在下拉里，而这正是监控最想看到的 | 下拉只列这次会话里见过的来源 | `2026-10-26-admin-frontend-memory-monitor-support.md` 第七节 |
| 114 | 订阅与权益 | `POST/PUT /entitlement-defs` 的请求体（创建 `{key,name,priority}`，修改 `{name,priority}`）、`key` 和 `name` 的格式与长度、`key` 或 `priority` 重复是否 409 且 `data.field` 为对应字段、响应形状 | 表单提交方式 | 只检查非空和 `priority` 为整数 | `2026-10-26-admin-frontend-subscriptions.md` 第二节；`2026-10-21-admin-frontend.md` 第二部分 2.11 第 2 条 |
| 115 | 订阅与权益 | `PUT /feature-gates/{key}/credit-cost` 的请求体是否 `{"creditCost": 整数或 null}`？对不能设置单价的开关是 400 吗？单价取值范围 | 表单提交方式 | 只让永久的额度类开关可编辑 | `2026-10-26-admin-frontend-subscriptions.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.11 第 3 条 |
| 116 | 订阅与权益 | 限时权益发放与撤销：`durationDays` 的上限、`reason` 的长度、发放响应是否 `{id}`、撤销要不要理由；账号不存在 404、账号不是正常状态 400 `ACCOUNT_NOT_ACTIVE`、撤销非限时权益或已失效的行 409，是否如此 | 表单预检 | 发放前预检 `durationDays` 为 1 以上整数、理由 1 到 500 个码点；撤销不带请求体 | `2026-10-26-admin-frontend-subscriptions.md` 第六节；`2026-10-21-admin-frontend.md` 第二部分 2.11 第 6 条 |
| 117 | 订阅与权益 | `GET /subscriptions/stats` 同一天、同一商店、同一商品有两种币种时是两行吗（金额是十进制字符串后端已答） | 金额显示与合计 | 各行各显示 | `2026-10-26-admin-frontend-subscriptions.md` 第七节；`2026-10-21-admin-frontend.md` 第二部分 2.11 第 7 条 |
| 118 | 额度 | 调账申请的 `reason`、`note` 的长度范围，`delta` 能不能为 0、绝对值有没有上限，`ADJUST` 负数让余额低于 0 以外还有没有限制 | 表单发请求前的提示 | `reason`、`note` 去空白后 1 到 500 个码点；`ADJUST` 不能为 0 | `2026-10-26-admin-frontend-credits.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.12 第 4 条 |
| 119 | 额度 | `approve`、`reject` 同时触发多个错误时的检查先后（申请人就是审核人 403、申请不在待审状态 409、账号待删除或删除中 403） | 多个原因同时存在时提示哪一个 | 只展示后端返回的错误，不依赖先后 | `2026-10-26-admin-frontend-credits.md` 第五节；`2026-10-21-admin-frontend.md` 第二部分 2.12 第 5 条 |
| 120 | 成本 | `PUT /usage/models/{id}` 取消适配器时 `syncAdapter` 传 `null` 还是空串？`syncAdapter` 为空时 `syncModelId` 还要吗？`syncModelId` 长度上限？对非 LLM 模型设适配器答什么 | 表单提交方式 | 取消发 `null`；`syncModelId` 始终发 | `2026-10-26-admin-frontend-cost.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.13 第 3 条 |
| 121 | 成本 | `POST /usage/prices` 成功时 `data` 是什么？档位或价格不合法、确认因档位不连续被拒时 400 的 `ref`、`reason` 是什么（能否给“缺口”“重叠”这样的具体码） | 确认框要显示为什么被拒绝 | 有译文的原因逐条显示，其余略去 | `2026-10-26-admin-frontend-cost.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.13 第 4 条 |
| 122 | 成本 | 价格上限 1000000 由谁检查：前端只检查格式，上限交后端返回 400，这个分工可以吗 | 价格要在读取、显示、提交中保持字符串不变 | 如左 | `2026-10-26-admin-frontend-cost.md` 第五节；`2026-10-21-admin-frontend.md` 第二部分 2.13 第 5 条 |
| 123 | 成本 | 确认待审批次因币种不在允许列表被拒时，`data.details` 能否是 `[{"ref":"currency","reason":"OUT_OF_RANGE"}]`（即使请求体没给 `currency`） | 没有 details 页面只能说“输入内容不合法”，运营看不出是币种 | 确认前把币种选项限制在允许列表内；被拒且无 details 时只显示通用句 | `2026-10-31-admin-frontend-growth-confirm-currency-details.md` 全文 |
| 124 | 推送 | 周期推送：`DELETE` 之后这一行还留在列表里吗？`PUT` 是整条替换还是可以只带 `enabled`？请求体字段是否如我们所写？校验失败（`daysOfWeek`、`dayOfMonth`、`timeOfDay`、`timezone`、起止日期）的 `ref`、`reason` 是什么 | 表单与开关 | 整条 `PUT`；`ref` 取字段名 | `2026-10-26-admin-frontend-push.md` 第三节第 1、2、3 条；`2026-10-21-admin-frontend.md` 第二部分 2.14 第 13、14、15 条 |
| 125 | 推送 | `GET /push/records` 要不要按账号、触发原因、本地日期筛选 | 运营要查“某个账号收到过什么” | 页面只分页 | `2026-10-26-admin-frontend-push.md` 第四节第 1 条；`2026-10-21-admin-frontend.md` 第二部分 2.14 第 16 条 |
| 126 | 推送 | 推送图片上传返回的地址字段叫什么？列表里的 `imageUrl` 是长期地址还是短时效签名地址 | 是否可缓存 | 每次读列表都用新取到的地址 | `2026-10-26-admin-frontend-push.md` 第五节；`2026-10-21-admin-frontend.md` 第二部分 2.14 第 18 条 |
| 127 | 推送 | 推送执行器停机后，已经发出一部分的任务显示什么状态（一条都没发出的显示已取消并注明错过，后端已答） | 页面状态文案 | 按后端返回显示 | `2026-10-31-design-doc-changes-from-backend-d1.md` “待后端确认的点”第 1 条 |
| 128 | 邀请与分享 | `depth-stats` 范围内没有被邀请人时 `avgDepth`、`maxDepth` 是 `null`、0 还是不返回？`stats` 的 `limit` 超过 200 是 400 还是静默取 200？`registeredAccounts` 的口径？`daily` 是否每天一行 | 页面显示“—”还是 0 | `null`、缺失都显示“—”；缺的日子补 0 | `2026-10-26-admin-frontend-invite.md` 第三节、第四节；`2026-10-21-admin-frontend.md` 第二部分 2.15 第 3、4 条 |
| 129 | 邀请与分享 | 没有发放奖励时 `inviterCreditsGranted`、`inviteeCreditsGranted` 是 0 还是 `null`？`/invites/codes` 有没有筛选参数？导出 `invite-records` 是否要求同时带 `from`、`to` | 显示与导出 | 0 显示 0，`null` 显示“—” | `2026-10-26-admin-frontend-invite.md` 第五节；`2026-10-21-admin-frontend.md` 第二部分 2.15 第 5 条 |
| 130 | 活动管理 | 签到活动写接口：请求体、`name` 长度上限、编辑生效中活动时 `confirm` 的语义（无重叠风险时是否直接成功、成功响应是什么）、状态接口请求体与不允许转换的错误、`DELETE` 非草稿或已有签到记录的活动的错误、已结束活动的按钮怎么给 | 表单与确认流程 | 按存储状态给按钮；不允许的转换当 409 `INVALID_STATE` | `2026-10-26-admin-frontend-activity.md` 第三节第 1、2、3、4、5 条；`2026-10-21-admin-frontend.md` 第二部分 2.16 第 6、7、8、9、10 条 |
| 131 | 活动管理 | 每日任务写接口：`description` 为空是否接受 `""`、`claimTimeoutSeconds` 的下限、状态接口请求体 | 表单提交方式 | 空描述发 `""` | `2026-10-26-admin-frontend-activity.md` 第四节第 1、3 条；`2026-10-21-admin-frontend.md` 第二部分 2.16 第 11、13 条 |
| 132 | 活动管理 | `POST /stats/land/checkin-daily`、`task-daily` 的 `date` 是用户本地日吗？报表的 `to` 和补数的 `date` 最晚可到哪一天（UTC+14 的本地日可以比 UTC 的今天晚一天） | 日期选择器的上限 | 把所选日子原样发出 | `2026-10-26-admin-frontend-activity.md` 第五节第 1 条；`2026-10-21-admin-frontend.md` 第二部分 2.16 第 14 条 |
| 133 | 投放管理 | `PUT /attribution/campaigns/{id}` 是整条替换还是可以只改 `enabled`？创建时 `enabled` 的默认值？`POST` 重复 `code` 是 409（`data.field` 为 `code`）吗？取链接接口的两种 400 能否在 `details` 里给 `ref`（`platform`、`attribution.link_base_url`）和 `reason`？落地页接口地址的写法 | 开关与提示 | 整条 `PUT`；创建发 `enabled: true` | `2026-10-26-admin-frontend-campaign.md` 第二节第 1、2、3、5、6 条；`2026-10-21-admin-frontend.md` 第二部分 2.17 第 6、7、9、10 条 |
| 134 | 应用内广告 | “强制可关闭兜底为 0 且存在不可跳过素材”的警告，后端判断“存在”用哪些素材？能否在 `GET /ads/meta` 加 `notSkippableFullScreenCount` | 没有素材权限的管理员数不了 | 有权限时自己数（不数已拒绝的），否则显示不带数字的警告 | `2026-10-26-admin-frontend-ads.md` 第四节；`2026-10-21-admin-frontend.md` 第二部分 2.18 第 4 条 |
| 135 | 应用内广告 | 计划与单元名称、描述、素材标题正文按钮广告主、拒绝备注的长度，优先级范围，`DEEP_LINK` 的 scheme 清单，版本号能不能带后缀 | 表单实时检查 | 只做契约写明的检查，其余交给后端的 400 | `2026-10-26-admin-frontend-ads.md` 第六节；`2026-10-21-admin-frontend.md` 第二部分 2.18 第 6 条 |
| 136 | 应用内广告 | `targeting` 校验失败时 `details` 的 `ref` 是 `targeting`、`targeting.geo` 还是 `geo`？时段第几行出错是不是 `targeting.day_parts[0]` | 把错误放到对应的键 | 三种写法都接受 | `2026-10-26-admin-frontend-ads.md` 第七节；`2026-10-21-admin-frontend.md` 第二部分 2.18 第 7 条 |
| 137 | 应用内广告 | 广告报表：`overview` 的 `daily` 是否只返回有数据的日子、当天有没有数据？`totals` 里的比率字段是否和每行一样？`by-country` 的 `country` 是大写两位国家码吗，空串是“未知”吗 | 趋势图补日与比率显示 | 缺的日子补 0；分母为 0 一律显示“—” | `2026-10-26-admin-frontend-ads.md` 第八节；`2026-10-21-admin-frontend.md` 第二部分 2.18 第 8 条 |
| 138 | 短信与邮件 | 短信模板列表是否分页？创建与更新的请求体？模板缺 `{code}` 时 400 的真实原因码是什么（邮件模板缺必含项同理，后端目前只说 `message` 写明缺哪个） | 页面遇到没有译文的原因码只能写“输入内容不合法” | 如左 | `2026-10-26-admin-frontend-sms-email.md` 第二节第 1、2、3 条、第四节第 2 条；`2026-10-21-admin-frontend.md` 第二部分 2.19 第 11、12、13 条 |
| 139 | 站内通知 | `POST /notifications/send` 被拒时 `details` 的 `ref` 和原因码（有问题的账号、收件人列表本身、标题正文、链接）是什么？`details` 会不会被截断，总数放在哪 | 表单把原因放到对应位置 | 按我们写的形式处理，不认识的 `ref` 原样列出 | `2026-10-26-admin-frontend-notifications.md` 第一节第 2、3 条；`2026-10-21-admin-frontend.md` 第二部分 2.20 第 2、3 条 |
| 140 | 站内通知 | 没有链接时省略 `linkType`、`linkTarget` 等于 `NONE` 吗？语言标签区分大小写吗（`EN` 当作 `en` 吗）？一种语言只写标题或只写正文是否允许？收件账号编号是否区分大小写 | 表单规则 | 页面要求英文键是小写 `en`；每种语言标题正文都要填 | `2026-10-26-admin-frontend-notifications.md` 第一节第 4、5、6、7 条；`2026-10-21-admin-frontend.md` 第二部分 2.20 第 4、5、6、7 条 |
| 141 | 客户端配置 | `PUT /client-config/{key}`、`POST …/reset` 成功时返回什么？`PUT` 被拒的 `ref` 和原因码（非本地化的键提交了语言键、`inviteShareText` 含其他占位符、`inviteLinkBase` 带查询或片段）？`EMAIL` 类型的真实格式规则 | 页面遇到没有译文的原因码只写“输入内容不合法” | 不读响应；邮箱按我们自己的规则检查 | `2026-10-26-admin-frontend-notifications.md` 第二节第 1、2、6 条；`2026-10-21-admin-frontend.md` 第二部分 2.20 第 8、9、10 条 |
| 142 | 客户端配置 | 同一主语言有多个条目时，按什么顺序取第一个（页面按标签字母顺序理解） | 预览要和客户端实际收到的一致 | 字母顺序 | `2026-10-26-admin-frontend-notifications.md` 第二节第 7 条；`2026-10-21-admin-frontend.md` 第二部分 2.20 第 11 条 |
| 143 | 系统配置 | `attribution.facebook_graph_version` 格式不对时，`details` 里的 `reason` 是哪个码 | 前端按 `OUT_OF_RANGE` 猜的 | `OUT_OF_RANGE` | `2026-10-31-admin-frontend-config-refusal-reasons.md` 第二节 |
| 144 | 系统配置 | 契约里其余成对的设置（重试初始与最大秒、审核复核与拦截分、音色最短与最长秒、导出租约与超时、访问与刷新令牌有效期）保存被拒时，`details` 是否也列出两个键（保存的键在前） | 只列一个键时另一行没有提示 | 两种形状都能处理 | `2026-10-31-admin-frontend-config-refusal-reasons.md` 第三节 |
| 145 | 系统配置 | 保存 `app.supported_locales` 被拒时，同一组 `ref` 和 `reason` 是否还用在别的情形（缺 `en`、有重复项） | 前端想按情形区分文字 | 这两种情形前端提交前已自己拦住 | `2026-10-31-admin-frontend-config-refusal-reasons.md` 第四节 |
| 146 | 内容审核 | `FILE` 类内容响应能否加 `expiresAt` | 页面可以在过期前主动重取，不必靠播放失败来发现 | 每次打开重取，播放失败再取一次 | `2026-10-26-admin-frontend-moderation.md` 第五节；`2026-10-21-admin-frontend.md` 第二部分 2.8 第 5 条 |
| 147 | 形象与装扮 | 投诉改状态、删除形象、赠送服装、声明激活或上下架成功时返回什么？重复赠送同一件是 409 吗，条目不存在是 404 吗 | 只影响页面要不要读响应 | 不读，成功后重新读取 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第三节；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 8 条 |
| 148 | 形象与装扮 | `GET /accounts/{id}/avatars` 里形象的 `isCurrent` 是否指“账号当前使用的形象” | 文字理解 | 按此理解 | `2026-10-26-admin-frontend-cosmetics-complaints.md` 第五节；`2026-10-21-admin-frontend.md` 第二部分 2.9 第 10 条 |
| 149 | 记忆服务与监控 | 409 `MEMORY_MODEL_CONFLICT` 的 `data` 里能否加整数字段 `registeredDimensions`（这个模型名原来登记的维度） | 界面不再显示记忆服务写的整句英文，技术人员看不到原来登记的维度 | 只显示错误码的译文 | `2026-11-01-admin-frontend-translated-error-texts.md` 全文 |
| 150 | 短信与邮件 | 邮件模板 `PUT` 和 `reset` 的响应是什么？正文长度上限、能否为空 | 只影响页面是否读响应、要不要限制长度 | 不读响应；要求去空白后正文不为空，不限长度 | `2026-10-26-admin-frontend-sms-email.md` 第四节第 1、3 条；`2026-10-21-admin-frontend.md` 第二部分 2.19 第 18、19 条 |
| 151 | 系统配置 | 请后端核对系统配置页里 14 个设置项的说明（见该文件的表），特别是 `recall.window_minutes`、`recall.inactive_hours`、`recall.streak_min_days`、`export.min_interval_hours`、`support.rate_limit_per_hour`、`events.max_body_kb` 的单位和方向，以及审核分数与阈值的方向 | 契约里这 14 项说明为空，页面按键名推了一句，猜错运营会按错的意思改值 | 写得保守，只说键名本身的意思；回复后只改语言文件 | `2026-11-01-admin-frontend-config-key-descriptions.md` 全文 |
| 152 | 告警 | `GET /alerts` 的参数校验失败（`status`、`type` 不在取值内）时，`details` 的 `ref` 是不是参数名 | 界面把错误放到对应筛选项 | 按参数名处理 | `2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md` 第 1.3 节 |

# 二、给改规格和契约的人的变更请求

这些不是向后端提问，而是请负责人指定的人在 AvatarApp 的 main 上改规格或契约（本仓库的快照只读，不改）。共 131 个小节，下面按文件列出。

| 文件 | 小节 | 一句话 | 改哪份 |
|---|---|---|---|
| `2026-10-21-admin-frontend.md` | 第三部分 3.1（8 行） | 规格里还留着的 8 处文字与契约或实现不一致（路由总表的接口栏、撤回的权限、生成任务筛选、一级菜单、详情抽屉、链数、改密码页路由；无广告原因表主分支已改） | 规格 |
| `2026-10-21-admin-frontend.md` | 第三部分 3.2（44 行） | 各任务报告里记下的规格应改处：错误文字的显示规则、留存页日期标签、看板、权益与商品映射的新增、额度包适用端、分享渠道下拉的作用范围、系统管理的规则、广告素材字段、短信渠道删除条件、应用版本、通知长度、客户端配置、任务配置、签到统计导出、成本对账措辞等；其中带“待负责人先定”的行，负责人 2026-10-27 已就多项定了按现状保留或采用（`docs/superpowers/handoff/decisions-2026-10-27.md` 第 12、35、38、45 行），定了之后只差把文字改进规格 | 规格 |
| `2026-10-21-admin-frontend.md` | 第三部分 3.3（2 行） | 计划第 39 行“详情用抽屉”、任务书 31 里 `GET /roles` 的权限要改 | 计划和任务书 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.1 | 订阅读取接口对安卓商店购买令牌只返回末 6 位 | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.2 | 超级管理员账号受保护：只有超级管理员能对它做危险操作 | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.3 | 任务配置带 `hasRecords`，并写明“原值不算改” | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.4 | 客户端配置 `PUT` 加 `expectedUpdatedAt`，防止两个管理员互相覆盖 | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.5 | `GET /sms/meta` 加 `phoneLoginEnabled`、`phoneAccountCount` | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.6 | 导出超过行数上限时返回 `EXPORT_TOO_MANY_ROWS` 和 `maxRows` | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.7 | `GET /client-config` 补 `min`、`max`、`maxLength`、`placeholders`、`source` 并加预览接口 | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.8 | `GET /api/admin/meta` 补六个值 | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.9 | 会话列表的游客设备标识只返回前 8 位 | 契约 |
| `2026-10-21-admin-frontend.md` | 第四部分 4.10（8 行） | 契约里该补的 8 处文字（额度行、通话行、推送行、原因代码清单、系统管理行、验证码锁定、补数与缺失行、链接正则） | 契约 |
| `2026-10-21-admin-frontend.md` | 第二部分 2.13 第 6 条、2.21 第 1、2 条 | 价格批次要不要“填的人不能自己确认”的规则；导出超行数的结构化原因（同 4.6）；客户端链接校验的完整正则 | 契约 |
| `2026-10-26-admin-frontend-activity.md` | 六（2 条） | 规格 5.22 要补 `hasRecords` 的数据来源、任务类型声明在哪里 | 规格 |
| `2026-10-26-admin-frontend-ads.md` | 九.1–九.3 | 规格 5.17：素材类型尺寸时长只读、广告位全局设置只渲染 9 个键、单元状态切换是否确认 | 规格 |
| `2026-10-26-admin-frontend-app-versions.md` | 五.1、五.2 | 规格 5.19：APK 缺签名的错误文字；渠道包字段名是 `code` 不是 `channelCode` | 规格 |
| `2026-10-26-admin-frontend-cost.md` | 六 | 契约要不要写价格批次的双人复核规则 | 契约 |
| `2026-10-26-admin-frontend-credits.md` | “另”一段 | 规格 5.10 额度包列要不要加适用端（负责人已定按现状保留） | 规格 |
| `2026-10-26-admin-frontend-invite.md` | 六 | 规格 5.12 分享渠道下拉作用在哪几块 | 规格 |
| `2026-10-26-admin-frontend-sessions.md` | 六 | 契约 17.4 通话行补 `GET /sessions` 的筛选参数名和格式 | 契约 |
| `2026-10-26-admin-frontend-users.md` | 六.1、六.2 | 规格 5.7a 的“设备列表不在管理后台”与 5.7 矛盾；规格补用户详情 `?tab=` 的取值 | 规格 |
| `2026-10-26-admin-frontend-export-row-limit.md` | 全文 | 契约 17.6 导出超过行数上限时加结构化原因 | 契约 |
| `2026-10-26-admin-frontend-link-pattern.md` | 全文 | 请给出客户端链接校验的完整正则原文和标志位 | 契约 |
| `2026-10-26-admin-frontend-notifications.md` | 二.3、二.4、二.5 | 客户端配置登记信息补字段、加 `expectedUpdatedAt`、只读键给 `source`（同汇总文件 4.4、4.7） | 契约 |
| `2026-10-27-admin-frontend-concurrent-save.md` | 二、三 | 客户端配置重置也接受 `expectedUpdatedAt`；规则词表加 `updatedAt` 与 `expectedUpdatedAt` | 契约 |
| `2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md` | 全文（11 小节） | 契约 17.4 告警类型十四种改十八种并补四种的说明、17.5 补 25 个设置键并改 3 个键的范围、17.4 其他行的变化 | 契约 |
| `2026-10-31-design-doc-changes-from-backend-d1.md` | 第 1–16 节、“最后”一节（26 小节） | 管理端前端设计要跟着后端第一批交付改的地方（权限生效时间、二次验证密钥、通话详情、漏斗并发上限、封禁、文本规则、订阅统计、推送模板、投放成本币种锁、告警类型、系统配置、系统管理、短信与邮件模板、价格确认币种、投诉状态筛选、验收清单），以及 7 句疑似后端内部机制的句子请负责人或后端确认是否需要 | 规格 |

# 三、已回答或已按决定实现的

后端已回答 56 个小节，已按负责人决定实现 4 个小节，不再问，不在这里展开：在原文里找带“已答”“已按决定实现”字样的标注（汇总文件第一部分的 32 个和 2.22 的 12 行本来就写了状态）。另有 20 处只答了一半，仍算待回答，原文里标了“部分已答”“前半已答”或“该小问已答”。另有 20 个小节本来就没有提问（只是说明或前端自己已处理），不属于任何一类。

# 四、每个问题文件一句话索引

“待回答小节数”是该文件里仍待后端回答的小节个数；同一个问题在几个文件里各写过一次，所以各文件数相加（429）大于第一节的 152 条。

| 文件 | 问什么 | 待回答小节数 |
|---|---|---|
| `2026-10-21-admin-frontend-ack.md` | 邮件模板占位符是否带花括号（已答） | 0 |
| `2026-10-21-admin-frontend.md` | 汇总文件：规划期 12 个问题与 20 行字段表（已答）、执行期 201 条新问题、规格与契约的变更请求 | 193 |
| `2026-10-26-admin-frontend-activity.md` | 活动管理（签到、每日任务）的参数、请求体、`hasRecords` 字段 | 14 |
| `2026-10-26-admin-frontend-ads.md` | 应用内广告后台接口的列表形状、请求体、权限缺口、校验与错误 | 8 |
| `2026-10-26-admin-frontend-analytics.md` | 埋点三个页面的时间范围写法、明细字段、已保存漏斗 | 4 |
| `2026-10-26-admin-frontend-app-versions.md` | 应用版本与渠道包的列表形状、字段名、请求体与错误细节 | 19 |
| `2026-10-26-admin-frontend-auth-and-permissions.md` | 权限树响应形状、改密码失败形状、验证码锁定、权限树父节点 | 4 |
| `2026-10-26-admin-frontend-campaign.md` | 投放效果、投放账户、投放成本、归因明细的响应字段与请求体 | 19 |
| `2026-10-26-admin-frontend-cosmetics-complaints.md` | 形象与装扮目录、投诉列表的参数、请求体、写操作响应、缓存头 | 12 |
| `2026-10-26-admin-frontend-cost.md` | 成本报表与价格接口的字段类型、分页、请求体细节 | 6 |
| `2026-10-26-admin-frontend-credits.md` | 额度包管理接口、额度相关的时间筛选、调账文字的限制 | 5 |
| `2026-10-26-admin-frontend-daily-retention.md` | 日报与留存的补数范围、缺失日期、回填标志 | 3 |
| `2026-10-26-admin-frontend-dashboard.md` | 总览页用到的当天数据、昨日留存、审核积压、未处理告警总数 | 4 |
| `2026-10-26-admin-frontend-export-row-limit.md` | 导出超行数时要给可翻译的原因（给契约） | 0 |
| `2026-10-26-admin-frontend-guest-stats.md` | 游客统计的零额度、缺失日期、`unknown` 平台 | 3 |
| `2026-10-26-admin-frontend-invite.md` | 邀请统计、邀请链、分享统计的响应形状与边界 | 5 |
| `2026-10-26-admin-frontend-link-pattern.md` | 客户端链接校验的完整正则（给契约） | 0 |
| `2026-10-26-admin-frontend-memory-monitor-support.md` | 告警、客服反馈、记忆服务、管线监控的响应形状与没写的行为 | 7 |
| `2026-10-26-admin-frontend-moderation.md` | 审核队列筛选、记录字段、判定响应、统计口径 | 6 |
| `2026-10-26-admin-frontend-notifications.md` | 站内通知与客户端配置的参数、错误明细、限制 | 11 |
| `2026-10-26-admin-frontend-push.md` | 推送模板、手动任务、周期推送、发送记录的请求与响应 | 16 |
| `2026-10-26-admin-frontend-sessions.md` | 会话列表的筛选参数、设备标识长度、详情字段 | 5 |
| `2026-10-26-admin-frontend-sms-email.md` | 短信渠道、短信模板、发送记录、邮件模板的请求体与错误 | 20 |
| `2026-10-26-admin-frontend-stats-and-channels.md` | 渠道包列表形状、日期范围跨度、统计响应里的空值 | 3 |
| `2026-10-26-admin-frontend-subscriptions.md` | 订阅与权益的请求体、筛选参数、事件列表、令牌脱敏 | 9 |
| `2026-10-26-admin-frontend-system.md` | 管理员、角色、权限树、审计日志的请求体、错误码、参数 | 18 |
| `2026-10-26-admin-frontend-users.md` | 用户列表筛选、用户会话、删除任务、写操作响应 | 5 |
| `2026-10-27-admin-frontend-concurrent-save.md` | 整体替换式保存的版本检查（客户端配置、规则词表） | 2 |
| `2026-10-31-admin-frontend-admin-forbidden-reason.md` | “只能授出自己持有的权限”的 403 要有结构化原因、`GET /me` 的权限集合 | 3 |
| `2026-10-31-admin-frontend-alerts-new-types.md` | 新增告警类型里没写清的几处 | 3 |
| `2026-10-31-admin-frontend-config-refusal-reasons.md` | 系统配置保存被拒时前端需要的结构化原因 | 4 |
| `2026-10-31-admin-frontend-cost-currency-format.md` | 成本币种格式不对时后端怎么答 | 1 |
| `2026-10-31-admin-frontend-deleted-admin-token.md` | 已删除管理员的令牌在管理端接口上的应答 | 1 |
| `2026-10-31-admin-frontend-growth-confirm-currency-details.md` | 确认价格批次因币种被拒时 `details` 里要有 `currency` | 1 |
| `2026-10-31-admin-frontend-push-default-language-case.md` | 召回模板被默认语言规则拒绝时 `data` 里要有情形字段 | 2 |
| `2026-10-31-admin-frontend-sms-credentials-shape.md` | 短信渠道凭据映射的细节 | 1 |
| `2026-10-31-backend-question-static-files-and-security-headers.md` | 前端静态文件会不会由后端提供、安全响应头加在哪些响应上 | 3 |
| `2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md` | 契约 17.4、17.5 要改的地方（给负责人，后端第一批交付引起） | 0 |
| `2026-10-31-design-doc-changes-from-backend-d1.md` | 管理端前端设计要改的地方（给负责人，后端第一批交付引起）；末尾 5 个待后端确认的点（其中 4 个仍待回答） | 4 |
| `2026-11-01-admin-frontend-config-key-descriptions.md` | 系统配置页 14 个设置项的说明请后端核对 | 1 |
| `2026-11-01-admin-frontend-moderation-and-reports-order.md` | 审核内容的缓存头、内容类型筛选的兜底、报表行顺序 | 3 |
| `2026-11-01-admin-frontend-translated-error-texts.md` | 记忆服务模型冲突的 409 要有原来登记的维度 | 1 |

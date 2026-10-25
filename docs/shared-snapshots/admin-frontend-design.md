# AvatarApp 管理后台前端设计

统计：本文的断言用三类标注：`[核实]`（我本人读过原文）、`[子代理读码]`（调研子代理读过源码，我读的是它的报告）、`[推断]`。2026-10-01 写成时共 87 处标注（45 处核实、38 处子代理读码、4 处推断）；2026-10-02 补入 5.17–5.21 及相关改动后**没有重新逐条计数**，其中大量断言来自子代理读码，**不要把本文当作全部已验证**。没有标注的句子是设计选择或页面描述，依据在同一段的标注里。

核对：共做过三轮独立子代理核对。第一轮（本文与 Java 文档的一致性、17.6 的技术可行性、dramaBox 的来源声明）发现 4 处阻塞、约 20 处错误，已改；第二轮核对 dramaBox-admin 前端代码的 15 条声明，14 条确认、1 条说过头，已改；第三轮（2026-10-02，核对 Java 第二十二至二十七节、本文 5.17–5.21、主设计文档 §8.9–8.12）发现 4 处阻塞、30 处错误，报告在 `docs/_scratch_verification_admin2.md`，已逐条改入本文、Java 文档和主设计文档。**第三轮的修改之后没有再做第四轮独立核对**，所以 Java 新增的部分（17.2–17.6、7.3 新事件、第十八节、第二十节、第二十二至二十七节）仍应由真人开发再看一遍。Java 文档里 ai-avatar-bd 此前留下的四处小问题（`auth.refresh_reuse_grace_seconds` 不在 17.5、`Session.userJoinedAt` 在 4.1 与第 18 节不一致、`PushTemplate` 没有"启用"字段、订阅事件的"需人工关注"标记没有字段）已在 2026-10-02 补齐（17.5、第 18 节、`needsAttention` 与 `ack` 接口）。

标注约定：`[核实 来源]` = 我本人打开并读过该文件（`Java §x` 是 `docs/backend-task-java-backend.md` 的该节；`dramaBox-admin` 是 `D:\Projects\GitProject\dramaBox-admin`；`dramaBox` 是 `D:\Projects\GitProject\dramaBox`）；`[子代理读码 路径]` = 调研子代理读过该文件并写进报告，我读的是报告，没有重读源码；`[推断]` = 由已核实事实推出，或是本文自己的设计选择。

这份文档和 Java 文档是一起设计的：每个页面要的数据，在 Java §17.4、§17.6 有对应接口或汇总表；本文列出的页面，没有接口支撑的一个也没有。

## 关键设计点

| 设计点 | 我的理解 |
|---|---|
| 来由 | 用户 2026-09-29 要求后台管理系统的功能设计和风格参考 dramaBox-admin；本文是它的完整展开，与 Java 文档 §17 一起设计 |
| 交付位置 | 独立文档，放在 AvatarApp 仓库；后端契约在 Java §17、§22–§26；由 Java 开发完成后端和前端，前端代码仓库名还没定（第 11 节） |
| 技术栈与风格 | Ant Design Pro + Umi Max + antd + `@ant-design/charts`；ProLayout 侧边栏；深色为默认，布局、圆角、字号取 dramaBox-admin 的令牌；**主色用科技蓝，接近 Tiffany blue：`#0ABAB5`**（用户 2026-10-02 定了方向，具体色值是我按 Tiffany blue 的通用色值选的，见第 7 节） |
| 菜单顺序 | 总览 → 核心业务 → 变现 → 增长 → 数据 → 系统；高频靠前、低频靠后；路由数组的顺序就是菜单顺序 [子代理读码 DramaverseDemo `docs/admin-menu-reorder-proposal.md`；核实 dramaBox-admin/config/routes.ts 文件头] |
| 统计页的位置 | 业务统计放在对应业务模块内，全局跨模块指标放在统计报表，总览只放关键指标卡片 [核实 dramaBox/docs/admin-page-restructure.md 第一节]；埋点管理只放事件本身（事件汇总、明细、漏斗），这一条出自该文档的目标菜单树，不是它写明的原则 |
| 一级菜单 | 总览、用户（含站内通知）、内容审核、形象与装扮（服装与背景目录、动作目录、上传声明、渲染模型、生成任务、系统默认数字人）、投诉（照片里的人投诉）、通话、养成管理、订阅与额度、应用内广告、推送、邀请、活动管理、投放管理、统计报表、埋点管理、客服、记忆服务、系统监控、成本、系统配置（含客户端配置）、短信管理、系统管理（含应用版本）（页面清单见第 5 节） |
| 统计数据来源 | 统计报表、通话分析与质量、推送效果、总览来自 Java §17.6 的汇总表，页面不要求后端现算，这些页有"重新落地该日"（需 `STATS:LAND`）；事件汇总、明细、漏斗、邀请统计、审核统计、订阅与额度统计现查，没有落地条 |
| 总览页 | 没有自己的接口，调 `/stats/daily`、`/stats/retention` 取 90 天数据，平台分布另调 `/stats/daily` 的两个平台各一次（只取当天），环比同比在浏览器里算 [核实 Java §17.6；子代理读码 dramaBox-admin dashboard] |
| 路由与权限 | 每条路由带 `access`，值就是 Java §17.4 的权限码，精确匹配；超级管理员全通；菜单、标签页、路由三处用同一份判断 |
| 登录 | 用户名 + 密码 + 二次验证（TOTP，所有管理员强制）；首次登录先绑定认证器；`mustChangePassword` 时只能改密码；密码不在浏览器里做哈希 |
| 令牌 | `Authorization: Bearer` 头，放 `sessionStorage`，不进 URL 和 Cookie |
| 错误处理 | 成功判断是 `code === "200"`；401 `ADMIN_INVALID_TOKEN` 跳登录并带回跳地址；403 `ADMIN_FORBIDDEN` 提示无权限、不跳转；429 提示稍后重试 |
| 列表页 | 一个封装好的分页列表组件；请求 `page`（从 1）、`pageSize`，响应 `data.items`、`data.total` |
| 时间 | 时刻是 ISO-8601 UTC 字符串，按浏览器时区显示；统计的日期是 `YYYY-MM-DD` 的 UTC 日历日，页面上标注"UTC"，不做时区换算 |
| 危险操作 | 行内确认；带 `reason`/`note` 的接口，表单里必填；影响面大的配置按 Java 要求写明后果 |
| 审计 | 前端不传"谁操作的"，后端按令牌记；系统管理下有审计日志页（dramaBox-admin 没有这个页面） |
| 指标说明 | 每个复杂统计页顶部有可关闭的"如何阅读此报表"，指标列标题带提示图标；文字走语言文件 [子代理读码 dramaBox `docs/stat-metric-help-system.md`] |
| 导出 | 统计页的聚合报表有"导出 Excel"（Java §17.6 导出，权限 `STATS:EXPORT`）；统计导出不做用户级个人数据（隐私）；发送记录的导出是记录级，号码按 `SMS:RECORD:PHONE_VIEW` 掩码（5.18）；dramaBox 用 `window.open` 在 URL 里带固定 `token=123` 的做法不照搬，用 `fetch` 带 `Authorization` 头取回再保存 |
| 语言 | 中文（简体）和英文，默认取浏览器语言，不是中文时回退英文；组件里不写死任何语言的文字 |
| 不搬的 dramaBox 模块 | 剧集内容库、金币钱包（对应我们的额度）、优惠券（用户确认暂时不需要）、分享解锁的"解锁规则"和"剧热度"（分享配置和分享统计已带过来）、引流管理、播放质量：AvatarApp 没有对应功能，或属于短剧业务。**签到、每日任务（观看任务换成 AvatarApp 自己的任务类型）、渠道包、投放管理已补回**（2026-10-05：这几块最初没有被判断过就漏掉了） |
| 要搬的 dramaBox 模块（2026-10-02 用户明确要求参照） | 应用内广告（自建一套，AvatarApp 客户端同步加广告功能）、短信管理与手机号登录、版本管理与强制更新、站内通知、客户端远程配置；页面在 5.17–5.21，后端在 Java 第二十二至二十六节 |
| 实现范围 | 所有页面一次交付，不分阶段；第 13 节只给依赖顺序 |

## 1 定位与边界

- 管理后台前端是运营和客服用的网页，只调用 Java 的 `/api/admin/**`（Java §17）。不直接调用 AvatarAgent、AvatarMemory 或外部服务；记忆档位和 embedding 模型也经 Java（Java §16.2、§16.3）。
- 不处理用户端功能；账号删除的公开网页（Java §13.4）是另一个页面，不在本文。
- 不提供记忆内容的浏览与编辑（Java §16.4）、订阅退款操作（Java §17.4）。
- RBAC 不按平台限定范围：AvatarApp 只有一个产品，Android 和 iOS 是统计的筛选维度，不是权限维度（Java §17.3）。

## 2 技术栈、工程约定与不照搬的做法

- 栈与 dramaBox-admin 一致 [子代理读码 dramaBox-admin/package.json]；版本在建仓库时取当时的稳定版，不照抄它的版本号。
- 工程结构沿用它：`config/routes.ts` 集中路由与 `access`；`src/access.ts` 用 `Proxy` 把路由的 `access` 字符串当权限码判断；`src/services/<模块>/` 每个接口一个函数；`src/pages/<模块>/`；`src/locales/`；`src/components/` [核实 dramaBox-admin/config/routes.ts；子代理读码 dramaBox-admin/src/access.ts]。
- 路由文件里每个菜单页面的路由有 `name`（对应菜单文案的键）、`component`、`access`；重定向、登录页、404 没有 [核实 dramaBox-admin/config/routes.ts；子代理读码 独立核对]。路由 `name` 同时是菜单文案和标签标题的键。
- 统计页的组件放在各自模块目录下；dramaBox-admin 把业务统计组件仍放在 `pages/stat/` 下再挂到业务路由 [子代理读码 dramaBox/docs/admin-page-restructure.md 页面搬迁清单]，本项目直接放在业务模块目录里，路由和组件目录一致。
- 响应封装：只在一个文件里判断成功与否并归一化；业务代码不再各写一遍 `isOk`（dramaBox-admin 重复声明了很多次 [子代理读码 报告 §10.2]）。
- 旧路由：重命名或搬动的路由保留 `redirect`，不直接删除 [核实 dramaBox-admin/config/routes.ts 448-457 行]。
- 路由 `access` 只用权限表里真实存在的码，不在前端拼出合成的码 [子代理读码 dramaBox/.cursor/rules/layered-architecture.mdc]。
- **不照搬的做法**：浏览器里对密码做 MD5；每个请求带固定的 `token=123`；用 `window.open` 打开带参数的导出 URL；401 只靠响应体里的 `UNAUTHORIZED` 字符串、没有 403 处理；组件里写死的中文或英文；外部 CDN 的字体和 logo 地址；`menu.ts` 里别的项目遗留的键；权限树节点名永远优先取中文；主题切换时整页刷新；README、mock、manifest 保留模板内容；没有任何测试 [子代理读码 dramaBox-admin 的 requestErrorConfig、locales、theme、README、mock、jest 配置]。本项目的前端仓库要有测试，命令见第 12 节。

## 3 认证、权限与外壳

### 3.1 登录与二次验证（Java §17.2）

- 路由 `/user/login`，不带布局。字段：用户名、密码；需要时出现第三个字段"验证码"。
- 流程：先提交用户名和密码 → 响应：
  - 401 `ADMIN_INVALID_CREDENTIALS`：提示账号或密码错误；
  - 401 `ADMIN_TOTP_REQUIRED`：显示验证码输入框，用同一次输入的账号密码和验证码重新提交；
  - 401 `ADMIN_TOTP_INVALID`：提示验证码错误，清空验证码框；
  - 200 `ENROLL_REQUIRED`：进入绑定页（3.2）；
  - 200 且带令牌：存 `sessionStorage`，调 `GET /api/admin/me` 取用户名、`superAdmin`、权限码，然后跳回跳地址或 `/dashboard`。
- 防重复提交：提交期间禁用按钮并用标志位挡住重复点击（dramaBox-admin 同样如此，因为它的会话版本号有竞态 [子代理读码 dramaBox-admin/src/pages/user/login/index.tsx]）。
- 令牌有效期 `admin.jwt_ttl_hours`（默认 8）[核实 Java §17.5]；过期后任何请求返回 401 `ADMIN_INVALID_TOKEN`，跳登录页并带回跳地址。
- 没有"忘记密码"自助入口：管理员忘记密码，由有 `ADMIN:MANAGE` 的管理员重置（Java §17.4）。

### 3.2 绑定认证器页 `/user/enroll`

- 显示 `otpauthUri` 生成的二维码，说明用任意兼容 TOTP 的认证器扫描，输入第一个验证码，提交 `POST /api/admin/auth/totp/enroll {enrollToken, totp}`；`enrollToken` 10 分钟有效、一次性，过期则回登录页重来 [核实 Java §17.2]。
- 页面不显示、不缓存 `enrollToken` 以外的任何凭据。

### 3.3 首次登录与改密码

- `me` 返回 `mustChangePassword` 为真时，只允许进入改密码页；Java 对其余接口返回 403 `ADMIN_FORBIDDEN` [核实 Java §17.2]。
- 改密码 `POST /api/admin/auth/change-password {oldPassword,newPassword}`。新密码至少 `admin.password_min_length`（默认 12）个字符、不得与用户名相同；"确认密码一致"在前端校验 [核实 Java §17.2]。改密码成功后清除令牌，回登录页。

### 3.4 权限判断

- 管理端不设置只读账号，建角色时每个模块的查看权限和该模块的操作权限一起授予。
- 权限码精确匹配，不做通配或前缀匹配；超级管理员通过所有判断 [核实 Java §17.3；子代理读码 dramaBox-admin/src/access.ts]。
- 菜单按 `access` 过滤，没有任何可见子项的父菜单也隐藏；总览只需登录，但卡片按权限显示（5.1）。
- 页面内按钮和列：用 `useAccess().canAccess(code)`。Java 接口声明了更细权限码的操作（`SUBSCRIPTION:GRANT`、`MODERATION:REVIEW`、`CREDIT:REVIEW`、`STATS:LAND`、`USER:EMAIL_VIEW` 等），按那个码控制，不只看页面的查看码。
- 后端是最终裁决：前端隐藏不等于安全，写操作仍由 Java 校验并返回 403 `ADMIN_FORBIDDEN`。
- 权限变化的生效：Java 每次请求按管理员 → 角色 → 权限码加载，缓存不超过 `admin.permission_cache_seconds`（Java §17.3）。前端的权限列表在每次进入应用时取一次，另外在收到 403 `ADMIN_FORBIDDEN` 时重新取一次；不用定时器轮询。

### 3.5 外壳

- 侧边栏布局，顶栏右侧：语言切换、主题切换、头像菜单（改密码、退出登录）。
- 多标签页：每个访问过的菜单路由一个可关闭标签，总览不可关闭；右键菜单有关闭其他、关闭全部、关闭左侧、关闭右侧、刷新；标签列表存 `localStorage`；标签按当前权限过滤；标题随语言切换更新 [子代理读码 dramaBox-admin/src/app.tsx 的 TabManager]。"刷新"只重新加载该标签的数据，不整页重载。
- 退出登录：清除令牌和标签缓存，回登录页（Java 没有退出接口，令牌靠到期和 `tokenVersion` 失效）。
- 页面标题、登录页标题与 logo 走构建变量，产品名未定时不写死。

## 4 通用页面规范

### 4.1 列表页

- 一个分页列表组件封装 ProTable：固定分页选项（10/20/50/100，默认 20）、骨架屏、空状态、列设置、搜索区默认折叠；搜索区用列定义里的"仅搜索/仅表格"开关决定字段归属 [子代理读码 dramaBox-admin/src/components/PagedListTable]。
- 请求 `page`、`pageSize`，响应 `{"code":"200","message":"success","data":{"items":[...],"total":N}}` [核实 Java §1.3、§17.4]。dramaBox-admin 的响应 `data` 是数组、`total` 在顶层，所以分页组件的响应适配是本项目要改的地方。
- 日期范围筛选：时刻类参数传 ISO-8601 UTC 字符串；统计页的日期传 `YYYY-MM-DD`（UTC 日历日）[核实 Java §17.4]。
- 长文本（消息、反馈、参数 JSON）用"点击展开并可复制"的省略组件 [子代理读码 dramaBox-admin/src/components/EllipsisPopoverText]。

### 4.2 表单与写操作

- 创建与编辑用弹窗表单，编辑时预填；提交成功关闭并刷新列表，失败保持打开并展示后端 `message` [子代理读码 报告 §10.2]。
- 校验与 Java 的约束一致；Java 返回 `INVALID_REQUEST` 时，`message` 写明是哪个字段，前端原样展示。
- 带 `reason` 或 `note` 的接口（封禁、审核判定、发放权益、额度调账申请与审核）：理由必填。封禁理由会展示给被封禁的用户，表单旁写明"这是写给用户看的文字，只有一种语言"（Java §1.4、§2.8）。

### 4.3 危险操作

- 行内删除、取消、重试：行内确认（`Popconfirm`，确认按钮用危险色）；成功或失败提示用顶部的 `message`，不用 `notification` [子代理读码 dramaBox/docs/2026-07-26-admin-ui-redesign-design.md 第 7 条]。
- 影响面大的配置（档位修改、embedding 模型指派、新建档位）：按 Java §16.2、§16.3 要求的提示文字弹出确认，文字取自 Java 原文。
- 一行的操作超过 3 个时，显示前 2 个，其余收进"更多"下拉 [子代理读码 同上]。

### 4.4 统计页的共同结构

- 筛选栏（日期范围、平台、查询）→（可选的）提示面板 → 图表 → 明细表。图表和表同时存在 [子代理读码 dramaBox/docs/statistics-phase-1.5-design.md "图+表共存"]。
- **导出**：日报、留存、游客统计、通话质量、推送效果、邀请统计和分享统计、投放效果、广告报表、成本报表的页面右上角有"导出 Excel"按钮（只对持有 `STATS:EXPORT` 的管理员显示），调 `GET /stats/export/{name}`，参数和当前筛选一致，用 `fetch` 带 `Authorization` 头取回后保存，导出中显示进度，超过行数上限时显示后端的提示 [核实 Java §17.6]。
- **读汇总表的统计页都有"重新落地该日"**（日报、留存、游客统计、成本报表、通话分析、通话质量、推送效果；事件汇总、明细、漏斗、邀请统计、审核统计、订阅与额度统计、游客额度使用是现查，没有）：一个日期选择器（默认昨天）加按钮，调 Java 的 `POST /stats/land/{name}?date=`，成功后重新加载；只对持有 `STATS:LAND` 的管理员显示。留存页的日期标签是"检查日"，提示"会回填该日对应的各个 N 的格子，不是整行重算"[核实 Java §17.6；子代理读码 dramaBox-admin/src/pages/stat/retention]。
- 页面顶部标注"统计日按 UTC 计算"。
- 趋势图缺失的日期补 0（dramaBox 把"趋势图日期补零"做成了一项增强功能，列在它 2026-08-04 的增强清单里，`TrendChart` 补零 [子代理读码 dramaBox `docs/admin-enhancement` 的任务清单，后台设计会话的笔记]；之前这里写"不补 0"只标了 [推断：设计选择]，没有证据，改回 dramaBox 的做法）；留存矩阵未到期的格子显示"—"，不显示 0%，因为那不是缺失，是还没到时间。
- 去重人数（日活、周活、月活）不跨日相加；多日范围只显示逐日，不显示"合计"。
- 图表用 `@ant-design/charts`，配色取 dramaBox-admin 的图表色板，涨 `#22C55E`、跌 `#EF4444` [子代理读码 dramaBox-admin/src/theme/chartColors.ts]。
- **指标说明**：复杂报表（留存、回流、游客转化队列、游客留存、漏斗、通话质量）顶部有可关闭的"如何阅读此报表"提示，关闭状态记在 `localStorage`（键 `reportHelper:<pageKey>`）；指标列的标题旁有提示图标，说明定义和算法，文字取 Java §17.6 的口径。文字键：页面级 `stat.<page>.helper.title/content`，列级在原键后加 `.tip` [子代理读码 dramaBox/docs/stat-metric-help-system.md 二]。不是每个页面都加，自解释的列不加。

## 5 菜单与页面清单

### 5.0 路由总表

接口栏是 Java §17.4、§17.6 里的接口；括号里的权限码是该操作单独需要的码。

| 菜单 | 页面（路由） | access | 接口 |
|---|---|---|---|
| 总览 | 看板 `/dashboard` | 登录即可 | `/stats/daily`、`/stats/retention`；`/moderation/stats`（有 `MODERATION:VIEW` 时） |
| 用户 | 用户列表 `/users/list` | `USER:VIEW`（导出需 `USER:EXPORT`；完整邮箱需 `USER:EMAIL_VIEW`，完整手机号需 `USER:PHONE_VIEW`） | `GET /users`、`GET /users/export` |
| | 多开检测 `/users/abuse` | `ABUSE:VIEW` | `/abuse/clusters`、`/abuse/clusters/accounts` |
| | 用户详情 `/users/:id` | `USER:VIEW` | `GET /users/{id}`、`/sessions`、`/devices`、`/auth-events`；封禁、解封（`USER:BAN`）；发放、撤销限时权益（`SUBSCRIPTION:GRANT`）；"形象与服装"页签 `GET /accounts/{id}/avatars`（`USER:VIEW`，返回形象、外观和拥有的服装，含 `source`，查看写审计日志）、`GET /accounts/{id}/cosmetics`（`COSMETIC:GRANT`）、赠送服装 `POST /accounts/{id}/cosmetics`（`COSMETIC:GRANT`）；发放、撤销限时权益 `POST /accounts/{id}/promo-entitlements`、`POST /promo-entitlements/{id}/revoke`（`SUBSCRIPTION:GRANT`）；管理员发起、取消删除 `POST /users/{id}/deletion {reason}`、`POST /users/{id}/deletion/cancel`（`USER:DELETION`）；"订阅与权益""额度""记忆"页签 `GET /accounts/{id}/entitlements`（`SUBSCRIPTION:VIEW`）、`GET /accounts/{id}/credits`（`SUBSCRIPTION:VIEW`）、`GET /accounts/{id}/memory`（`MEMORY:VIEW`） |
| | 账号删除任务 `/users/deletions` | `USER:DELETION` | `GET /account-deletions`、`POST …/retry`（只对失败的任务有效） |
| | 站内通知 `/users/notifications` | `NOTIFICATION:VIEW` | `/notifications`、`/notifications/{id}`、`/notifications/send`（`NOTIFICATION:SEND`） |
| 内容审核 | 队列 `/moderation/queue`、详情 `/moderation/:id` | `MODERATION:VIEW`（内容区需 `MODERATION:REVIEW`） | `/moderation/records`、`…/content`（`MODERATION:REVIEW`）、`…/decision`（`MODERATION:REVIEW`） |
| | 文本规则 `/moderation/rules` | `MODERATION:CONFIG` | `GET/PUT /moderation/text-rules` |
| | 审核统计 `/moderation/stats` | `MODERATION:VIEW` | `GET /moderation/stats` |
| 形象与装扮 | 服装与背景目录 `/avatar/cosmetics` | `COSMETIC:MANAGE` | `/cosmetics`（增改查、上下架） |
| | 动作目录 `/avatar/actions` | `ACTION:MANAGE` | `/actions`（增改查）、`POST /actions/{id}/backfill` |
| | 上传声明 `/avatar/declarations` | `DECLARATION:MANAGE` | `/declarations`（新建版本、设为生效） |
| | 渲染模型 `/avatar/renderer-models` | `RENDERER:MANAGE` | `/renderer-models`（上传、启用、停用） |
| | 生成任务 `/avatar/generation-tasks` | `GENERATION:VIEW` | `GET /generation-tasks?status=FAILED&type=` |
| | 系统默认数字人 `/avatar/default-avatars` | `DEFAULT_AVATAR:MANAGE` | `/default-avatars`（上传有授权的图、选风格、填名字、生成、设为生效、改名 `PUT /default-avatars/{id}`） |
| 投诉 | 照片里的人投诉 `/complaints/likeness` | `COMPLAINT:VIEW` | `/likeness-complaints`、`/likeness-complaints/{id}`；`PUT /likeness-complaints/{id}/status`、`POST /likeness-complaints/{id}/remove-avatars`（`COMPLAINT:MANAGE`） |
| 通话 | 会话列表 `/sessions/list`、详情 | `SESSION:VIEW` | `GET /sessions`、`/sessions/{id}` |
| | 通话分析 `/sessions/analytics` | `STATS:VIEW` | `GET /stats/daily` |
| | 通话质量 `/sessions/quality` | `STATS:VIEW` | `GET /stats/session-quality` |
| 养成管理 | `/companionship` | `COMPANIONSHIP:CONFIG` | `GET /config`、`PUT /config/{key}` |
| 订阅与额度 | 订阅列表、详情 `/subscriptions/list` | `SUBSCRIPTION:VIEW` | `/subscriptions`、`/subscriptions/{id}` |
| | 权益定义与功能值 `/subscriptions/entitlements` | `SUBSCRIPTION:VIEW`（保存需 `SUBSCRIPTION:CONFIG`） | `/entitlement-defs`、`…/features` |
| | 功能开关 `/subscriptions/gates` | `SUBSCRIPTION:VIEW`（改默认值、额度单价需 `SUBSCRIPTION:CONFIG`） | `/feature-gates`、`…/default`、`…/credit-cost`（含形象渲染设计 11.2 的五个开关：`avatar.looks_max`、`avatar.look_free`、`credits.period_grant`、`render.cloud`、`chat.voice_reply`） |
| | 商品映射 `/subscriptions/products` | `SUBSCRIPTION:VIEW`（保存需 `SUBSCRIPTION:CONFIG`） | `/subscription-products` |
| | 事件重处理 `/subscriptions/events` | `SUBSCRIPTION:VIEW`（重新处理、已处理需 `SUBSCRIPTION:GRANT`） | `/subscription-events`、`…/reprocess`、`…/ack` |
| | 订阅统计 `/subscriptions/stats` | `FINANCE:VIEW` | `/subscriptions/stats` |
| | 额度包 `/credits/products` | `SUBSCRIPTION:CONFIG` | `/credit-products` |
| | 调账申请与审核 `/credits/requests` | `SUBSCRIPTION:VIEW` | `/credit-adjust-requests`（申请 `SUBSCRIPTION:GRANT`，审核 `CREDIT:REVIEW`） |
| | 额度账户 `/credits/accounts` | `SUBSCRIPTION:VIEW` | `/credits/accounts` |
| | 额度流水 `/credits/transactions` | `SUBSCRIPTION:VIEW` | `/credits/transactions`（显示 `spendKind`、`itemKey`，原因含 `SUBSCRIPTION_GRANT`、`SPEND_REVERSED`） |
| | 额度统计 `/credits/stats` | `FINANCE:VIEW` | `/credits/stats`（消费额度按 `spendKind` 分，服装兑换再按 `itemKey` 分） |
| 应用内广告 | 计划 `/ads/campaigns` | `ADS:CAMPAIGN` | `/ads/campaigns` |
| | 广告位与全局设置 `/ads/placements` | `ADS:PLACEMENT` | `/ads/placements`、`GET /config` 和 `PUT /config/{key}` 的 `ads.*` 键 |
| | 单元 `/ads/units` | `ADS:UNIT` | `/ads/units`、`/ads/meta` |
| | 素材 `/ads/creatives` | `ADS:CREATIVE` | `/ads/creatives`、`/ads/media` |
| | 广告报表 `/ads/report` | `ADS:REPORT` | `/ads/report/*`；补数 `POST /stats/land/ad-daily`（`STATS:LAND`） |
| 推送 | 模板 `/push/templates` | `PUSH:TEMPLATE` | `/push/templates`、`/uploads/image` |
| | 手动推送任务 `/push/tasks` | `PUSH:SEND` | `/push/tasks`、`…/cancel` |
| | 周期推送 `/push/schedules` | `PUSH:SEND` | `/push/schedules` |
| | 发送记录 `/push/records` | `PUSH:VIEW` | `/push/records`、`/push/records/{id}` |
| | 推送效果 `/push/stats` | `STATS:VIEW` | `/stats/push` |
| | 召回参数 `/push/recall` | `PUSH:CONFIG` | `GET /config`、`PUT /config/{key}` |
| 邀请 | 邀请码、邀请记录、邀请统计（含裂变层级）`/invite/codes`、`/invite/records`、`/invite/stats` | `INVITE:VIEW` | `/invites/codes`、`/invites/records`、`/invites/stats`、`/invites/depth-stats`、`/invites/chain` |
| | 分享统计 `/invite/share-stats` | `INVITE:VIEW` | `/invites/share-funnel`、`/invites/share-channels` |
| 活动管理 | 签到配置 `/act/act-signin-config`、签到记录 `/act/act-signin-record` | `CHECKIN:VIEW` | `/checkin/activities`、`/checkin/records`（写需 `CHECKIN:MANAGE`） |
| | 签到统计 `/act/act-signin-stats` | `STATS:VIEW` | `/stats/checkin/daily-users`、`/stats/checkin/streak-buckets`（落地条 `checkin-daily`） |
| | 任务配置 `/act/act-task-config`、任务记录 `/act/act-task-record` | `TASK:VIEW` | `/tasks/configs`、`/tasks/records`（写需 `TASK:MANAGE`） |
| | 任务统计 `/act/act-task-stats` | `STATS:VIEW` | `/stats/tasks/summary`、`/stats/tasks/daily`（落地条 `task-daily`） |
| | 奖励设置 `/invite/rewards` | `INVITE:CONFIG` | `GET /config`、`PUT /config/{key}` |
| 投放管理 | 投放效果 `/campaign/stats` | `ATTRIBUTION:VIEW` | `/attribution/performance`（有落地条 `attribution-daily`） |
| | 投放账户与成本 `/campaign/accounts`（两个页签） | `ATTRIBUTION:MANAGE` | `/attribution/campaigns`、`…/{id}/link`、`/attribution/costs`、`…/batch`；渠道包下拉取 `/channels` |
| | 归因明细 `/campaign/attribution` | `ATTRIBUTION:VIEW` | `/attribution/clicks`、`/attribution/records`、`/attribution/summary` |
| | 归因参数 `/campaign/settings` | `ATTRIBUTION:MANAGE` | `GET /config`、`PUT /config/{key}` |
| 统计报表 | 日报 `/stat/daily`、留存 `/stat/retention`、游客统计 `/stat/guest` | `STATS:VIEW` | `/stats/daily`、`/stats/retention`、`/stats/reactivation`、`/stats/guest/*` |
| | 导出（各统计页右上角的按钮） | `STATS:EXPORT`（另需对应接口的查看权限） | `/stats/export/{name}` |
| 埋点管理 | 事件汇总、事件明细、漏斗分析 `/analytics/summary`、`/analytics/detail`、`/analytics/funnel` | `ANALYTICS:VIEW` | `/analytics/*`（保存漏斗 `ANALYTICS:FUNNEL_MANAGE`；完整 IP `ANALYTICS:IP_VIEW`） |
| 客服 | 反馈列表、详情 `/support/feedback` | `SUPPORT:VIEW` | `/support/feedback`；重试（`SUPPORT:MANAGE`） |
| 记忆服务 | 档位 `/memory/tiers`、embedding 模型 `/memory/models` | `MEMORY:VIEW` | `/memory/*`（写操作各需 `MEMORY:TIER_CONFIG`、`MEMORY:MODEL_REGISTER`、`MEMORY:MODEL_ASSIGN`） |
| 系统监控 | 管线监控 `/monitor`、告警 `/monitor/alerts` | `MONITOR:VIEW`（关闭告警另需 `MONITOR:MANAGE`） | `GET /monitor/pipeline`、`GET /alerts`、`POST /alerts/{id}/resolve` |
| 成本 | 成本报表 `/cost/report` | `COST:VIEW`（导出另需 `STATS:EXPORT`，重新落地需 `STATS:LAND`） | `/stats/usage-cost`、`/stats/export/usage-cost`（按资源类型分列，Java §14.2 的通用用量） |
| | 价格 `/cost/prices` | `COST:VIEW`（确认、驳回、手填、改模型登记需 `COST:PRICE`） | `/usage/prices`、`/usage/price-batches/pending`、`/usage/price-batches/{batchId}/confirm`、`/usage/price-batches/{batchId}/reject`、`/usage/price-batches/{batchId}/retire`、`/usage/models` |
| 系统配置 | 后端参数 `/config` | `CONFIG:MANAGE` | `GET /config`、`PUT /config/{key}` |
| | 客户端配置 `/config/client` | `CLIENTCONFIG:VIEW` | `/client-config`（写需 `CLIENTCONFIG:MANAGE`） |
| 邮件模板 | 邮件模板 `/email/templates` | `EMAIL:TEMPLATE` | `/email/templates`、`…/reset` |
| 短信管理 | 渠道 `/sms/channels` | `SMS:CHANNEL` | `/sms/channels`（写、测试发送需 `SMS:CHANNEL:CONFIG`）、`GET /sms/meta` |
| | 模板 `/sms/templates` | `SMS:TEMPLATE` | `/sms/templates` |
| | 发送记录 `/sms/records` | `SMS:RECORD`（导出需 `SMS:RECORD:EXPORT`） | `GET /sms/records`（完整号码需 `SMS:RECORD:PHONE_VIEW`）、`GET /sms/records/export` |
| 系统管理 | 管理员 `/system/admins` | `ADMIN:MANAGE` | `/admins`、`…/status`、`…/reset-password`、`…/reset-totp` |
| | 角色 `/system/roles` | `ROLE:MANAGE` | `/roles`、`/permissions`（只读，角色授权用） |
| | 权限树 `/system/permissions` | `PERMISSION:MANAGE` | `/permissions`（读写） |
| | 应用版本 `/system/app-versions` | `APPVERSION:VIEW` | `/app-versions`、`/uploads/apk`（写和上传需 `APPVERSION:MANAGE`，激活下线需 `APPVERSION:ACTIVATE`） |
| | 渠道包 `/system/channels` | `CHANNEL:MANAGE` | `/channels`（列表任何登录的管理员可调） |
| | 审计日志 `/system/audit` | `AUDIT:VIEW` | `GET /audit-logs` |

用户详情里的"订阅与权益""额度""记忆"三个页签，分别用 `GET /accounts/{id}/entitlements`、`GET /accounts/{id}/credits`、`GET /accounts/{id}/memory`，有对应查看权限才显示 [核实 Java §17.4]。

### 5.1 看板 `/dashboard`

- 只需登录；卡片按管理员持有的权限显示：统计类卡片需要 `STATS:VIEW`，审核积压卡片需要 `MODERATION:VIEW`。
- 6 张 `StatCard`，每张有当前值、较昨日、较 7 天前（百分比；留存用百分点）：新增账号（`newAccountsRegistered`，取 `StatDailyBusiness`）、日活（`dau`）、D1 留存（`ACTIVE` 类型里最新一个 `d1` 非空的 cohort）、通话总分钟（`callSecondsTotal / 60`）、新订阅（`newSubscriptions`）、游客设备转注册（`guestDevicesConverted`）。有 `MODERATION:VIEW` 时多一张"审核积压"：最老待处理的等待时长 [核实 Java §17.4 审核统计、§17.6 口径；卡片结构取自 子代理读码 dramaBox-admin/src/pages/stat/dashboard/index.tsx]。
- 趋势图：范围预设（今天、近 7 天、近 14 天、近 30 天、自定义）；指标多选（日活、新增账号、通话总分钟、D1 留存，至少保留一个，默认日活 + 新增账号）；每个指标叠加一条虚线的"上周同期"[同上]。
- 平台分布：环形图，当日 `ANDROID` 与 `IOS` 的 `dau`；因为 `/stats/daily` 一次只返回一个平台，这张图另外调两次（`platform=ANDROID`、`platform=IOS`，只取当天）。看板共 4 次调用：日报 `ALL` 一次、留存一次、平台两次。
- 有 `MONITOR:VIEW` 时多一张"未处理告警"卡片（`GET /alerts?status=OPEN` 的条数），点击进入告警页。
- 快捷入口：日报、留存、游客统计、通话质量、订阅统计；按钮按目标页面的权限显示。
- 数据：`/stats/daily` 与 `/stats/retention` 各取最近 90 天，一次并行请求；比较在浏览器里算。当天的值是临时值，卡片旁标注"今日数据每隔 `stats.land_interval_minutes` 分钟刷新一次"（这个值由 Java 提供，页面不写死数字）。
- 不搬 dramaBox-admin 总览的渠道饼图、邀请排行、分享卡点等卡片（属于它的业务）[子代理读码 报告 §12]。

### 5.2 日报 `/stat/daily`

- 筛选：日期范围（默认 7 天）、平台（`ALL`/`ANDROID`/`IOS`）、渠道包（`ALL` 或渠道码，选项取自 `GET /channels`）、查询；落地条（`STATS:LAND`，同时调 `daily-event` 和 `daily-business`）。
- 两个页签：**趋势图**（指标多选，默认日活 + 新增账号）和**数据明细**（表格，不分页，左侧固定日期列）。
- 列（取自 Java §17.6，括号内是字段）：日期；日活（`dau`）、周活（`wau`）、月活（`mau`）、匿名设备日活（`dauDevices`）；新增账号（`newAccountsRegistered`，取自账号表，不取自客户端事件）、新增游客设备（`guestDevicesNew`）、游客设备转注册（`guestDevicesConverted`）；创建形象账号、克隆声音账号、发起通话账号（`sessionStartedAccounts`）；通话次数（`sessionsConnected`）、通话人数（`accountsWithCall`）、通话总分钟、人均通话分钟（`callSecondsTotal / 60 / accountsWithCall`，分母为 0 显示"—"）；用户消息数、助手消息数；新订阅、有效订阅（日末快照；当天和缺失的日子显示"—"，回填的值带"回填"标记）、额度购买次数、额度消耗；游客通话次数（`guestSessionsConnected`）、游客通话总分钟（`guestCallSecondsTotal / 60`）。
- 平台不是 `ALL` 时，业务类列显示"—"，并在表头旁说明"这些指标没有平台维度"[核实 Java §17.6 平台维度一行]。
- 需要列提示的指标：日活（写明“当天有任意客户端事件的账号数，后端自己产生的事件不算”）、周活、月活、匿名设备日活、新增游客设备（写明"按设备第一次出现的日期计，重装应用会产生新的设备记录"）、通话次数（写明"只含有账号的会话，游客通话单独一列"）、有效订阅。

### 5.3 留存报表 `/stat/retention`

- 三个页签：**活跃留存**（`type=ACTIVE`，默认）、**通话留存**（`type=CALL`）、**回流留存**。
- 活跃留存和通话留存：筛选日期范围（cohort，默认 30 天）、平台、渠道包；图表 `RetentionTrendChart`（D1、D3、D5、D7、D14、D21、D30、D60、D90 多选，默认 D1、D7、D30）加 `RetentionMatrix`（cohort 日期、基数人数、各 Dn 的人数和百分比，绿色热力底色，未到期显示"—"）[子代理读码 dramaBox-admin/src/pages/stat/components/RetentionMatrix.tsx]。
- 回流留存：沉默天数选择（7/14/30，默认 7）；折线（回流率）、柱状（回流用户数）、表（统计日期、沉默用户数、回流用户数、回流率）。回流不分平台。
- 提示面板（`retention`、`reactivation` 两个 pageKey）：说明 cohort 的定义“账号注册的那一天”（注册之前的游客期不算，游客另有单独的游客留存）、Dn 表示第 N 天当天仍活跃（有任意客户端事件）、百分比的分母是基数人数；回流的定义取 Java §17.6 的文字，并写明“后台产生的推送等事件不算活跃”。

### 5.4 游客统计 `/stat/guest`

- 游客在服务端没有账号（Java §2.1），所以这里统计的是**设备**，不是账号：新增游客设备、转注册的设备（`GuestDevice`）。
- 四个页签：**游客日报**（日期、新增游客设备、游客设备转注册、当日转化率 = `guestDevicesConverted / guestDevicesNew`，注意这是"今天转注册的设备数 ÷ 今天新增的游客设备数"，不是同一批设备的转化率，列提示里写明）、**转化进度队列**、**游客留存**和**额度使用**。
- 转化进度队列：矩阵（cohort 日期、基数设备数、D0、D1、D2、D3、D5、D7、D14、D30，每格显示累计转化设备数和百分比，D1 起带"(+新增)"）；环形图"转化耗时分布"（D0 同日、D1、D2、D3、D4–D5、D6–D7、D8–D14、D15–D30，各档是相邻两列累计值之差，按各 cohort 求和；未到期的格子不计入，避免低估延迟转化）；堆叠柱状图"按队列日的转化耗时构成"（每个 cohort 一根柱，分段是同日、次日、第 2 日、第 3 日及以后各自转化的设备数；**不是按来源分，`StatGuestCohort` 没有来源维度**）。图表结构取自 dramaBox 的转化进度页签，区间按本项目 `StatGuestCohort` 的列（d0、d1、d2、d3、d5、d7、d14、d30）重新划分，不是它的 D0、D1、D2、D3、D5–D7、D7+ [子代理读码 dramaBox-admin/src/pages/stat/guest/index.tsx；字段取自 Java §17.6]。
- 游客留存页签：筛选日期范围（cohort，默认 30 天）、平台、渠道包；图表和矩阵同账号留存（`RetentionTrendChart`、`RetentionMatrix`，D1、D3、D5、D7、D14、D21、D30、D60、D90，基数是设备数），数据 `/stats/guest/retention`；提示写明“cohort 是设备第一次出现的那一天，已转注册的设备照常计入，没有通过设备校验的设备不在内”。依据：dramaBox 有游客留存 [核实 审计 F34]。
- 额度使用页签（数字人产品特有，dramaBox 没有）：数据 `/stats/guest/quota`，现查，没有落地条；日期范围按设备第一次出现的日期。6 张卡片：当前游客额度（`configuredTotalSeconds / 60` 分钟，只影响之后发放的设备，未配置显示"未配置，游客不能通话"）、设备数（`devices`）、没有额度的设备数（`noGrant`）、从未通话占比（`neverCalled / (devices − noGrant)`）、用完额度占比（`exhausted / (devices − noGrant)`）、人均已用分钟（`avgUsedSeconds / 60`）；分档柱状图（六档各自的设备数）；分档转化表（每档设备数、转注册设备数、转化率 = `converted / devices`）。列提示写明"每台设备按发放时的额度分档，运营改过额度数值只影响之后发放的设备"和"转注册指这台设备后来注册了账号"；页签顶部放一个跳到系统配置页 `guest.call_minutes_total` 那一行的链接（持有 `CONFIG:MANAGE` 才显示）。
- 落地条（`STATS:LAND`）：同时调 `daily-business`、`guest-cohort` 和 `guest-retention`，在游客日报、转化进度队列、游客留存三个页签显示。
- 没有 dramaBox 的“转化漏斗”页签：转化漏斗在埋点管理的漏斗页，有预设“注册漏斗”和“激活漏斗”。

### 5.5 通话

- **会话列表**：`SESSION:VIEW`，筛选账号 ID、是否游客（`guest`）、`requestedAt` 时间范围、是否进行中、是否被到点强制结束；列 `id`、账号 ID（游客会话显示"游客"，没有跳转）、设备（游客会话才有，前 8 位）、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`；点账号 ID 跳用户详情，游客会话没有这个链接 [核实 Java §17.4 通话行]。
- **通话分析**：`STATS:VIEW`，数据同 `/stats/daily`（`ALL`）：通话次数、通话人数、通话总分钟、人均通话分钟、人均通话次数的趋势图和明细表；日期范围、落地条（`daily-business`）。这是 dramaBox-admin"内容分析"的类比（它分析的是剧的播放和互动，这里分析通话）[推断：类比]。
- **通话质量**：`STATS:VIEW`，数据 `/stats/session-quality`。6 张卡片：接通成功率（`connected / (connected + agentUnavailable)`）、平均接通耗时（`joinMsSum / connected`）、接通耗时 ≤2 秒占比、>10 秒占比、额度限制次数（`limitReached`）、用户未进入次数（`discardedUserNotJoined`）；趋势图（接通成功率）；堆叠柱状图（四档接通耗时，四档互斥，每个会话只落在一档，总和等于接通数）；明细表。dramaBox-admin 的播放质量页有"超过阈值的卡片红框"，本页同样：接通成功率低于 95% 或 >10 秒占比超过 5% 时红框，阈值取自构建配置，不写死在页面里 [子代理读码 dramaBox-admin/src/pages/event/playback/pages.tsx；阈值数字是我定的，需运营确认]。落地条：`session-quality`。

### 5.6 埋点管理

- **事件汇总** `/analytics/summary`：日期范围（默认 7 天，不超过 `analytics.live_max_range_days`）、查询；表格：事件名、触发次数（`pv`）、去重账号数（`uv`），可排序，默认按 `pv` 降序，前端分页 50 [核实 Java §17.4；子代理读码 dramaBox-admin/src/pages/event/summary]。无落地条（现查）。
- **事件明细** `/analytics/detail`：筛选账号 ID、设备 ID、事件名（联想来自 `event-names`）、时间范围（必填）；列事件名、账号、设备、接收时间（`receivedAt`，统计用）、客户端时间（`clientTime`，不可信，仅供排查）、平台、App 版本、国家、IP（默认掩码，持有 `ANALYTICS:IP_VIEW` 才显示完整）；展开行显示 `params` 和 `context` 的格式化 JSON [核实 Java §17.4、§7.2]。
- **漏斗分析** `/analytics/funnel`：已保存漏斗选择框（预设带"系统预设"标签）、日期范围、步骤（可输入的多选，选项来自 `event-names`）、`windowHours`（同一账号完成相邻两步之间允许的最长间隔，是本项目新增的参数，dramaBox 的漏斗没有）；按钮：查询、另存为、编辑、删除（预设不可改，`ANALYTICS:FUNNEL_MANAGE` 才能写）；结果是漏斗图（步骤、去重账号数、相邻步骤转化率）加表格。预设：注册漏斗、激活漏斗、付费漏斗（Java §17.4）。提示面板：说明"同一账号按顺序在窗口内依次完成各步骤才算"。去重人数不跨日聚合，多日范围结果就是整个范围内的去重人数 [核实 Java §17.4；子代理读码 dramaBox-admin/src/pages/event/funnel]。

### 5.7 用户

- **用户列表**：筛选账号 ID、邮箱（完整邮箱精确匹配）、手机号（完整 E.164 精确匹配）、状态、注册渠道、流量类型（付费、自然）、媒体来源；列账号 ID、邮箱（掩码，持有 `USER:EMAIL_VIEW` 才显示完整）、手机号（掩码只留末 4 位，持有 `USER:PHONE_VIEW` 才显示完整；手机号注册的账号邮箱为空）、状态、注册渠道、流量类型、创建时间、时区、会话语言；点账号 ID 进详情 [核实 Java §17.4]。
- **用户详情**（页面，带页签）：概览（资料（含伴侣名字 `companionName`，没有设置时显示为空）、状态、封禁原因与时间、养成数据、资产数量）、形象与服装（`GET /accounts/{id}/avatars`：形象（含形象名字）及其外观（风格、状态、预览图、创建时间）、拥有的服装及来源；预览图是用户的脸，查看写审计日志；"赠送服装"按钮需 `COSMETIC:GRANT`，选条目、必填理由，写审计日志；Java §17.4）、归因（来源、匹配方式、媒体来源、活动、安装时间、注册时间）、会话（`GET /users/{id}/sessions`）、设备（平台、App 版本、最近活跃、token 末 6 位）、认证事件（5.7a）、订阅与权益、额度、记忆（各页签需对应查看权限）。"订阅与权益"页签除了生效值和来源，还有发放、撤销限时权益（`SUBSCRIPTION:GRANT`）：发放表单字段为权益、天数、理由（必填），`POST /accounts/{id}/promo-entitlements`；撤销 `POST /promo-entitlements/{id}/revoke`；页面注明"不影响商店里的订阅"。这是给某个账号更高记忆档位的唯一办法（Java §16.2）[核实 Java §17.4]。
- **发起、取消删除**（`USER:DELETION`，用户详情里）：替无法使用应用的用户（例如被封禁后联系客服的用户）发起删除或取消删除。发起：弹窗必填理由（1 到 200 个字符，只进审计日志，不要写用户的内容），写明“与用户自己申请相同，有宽限期，不会立即删除；核对用户身份是客服流程的责任”；状态已是待删除或删除中时按钮禁用（后端 409 `INVALID_STATE`）。取消：只在待删除（`PENDING_DELETION`）且宽限期内可用。账号状态为待删除或删除中时，发放限时权益、新建额度申请、指派 embedding 模型的按钮禁用（后端返回 403 `ACCOUNT_DELETION_SCHEDULED` 或 `ACCOUNT_DELETING`）[核实 Java §17.4 状态矩阵]。
- **封禁、解封**（`USER:BAN`）：状态为待删除（`PENDING_DELETION`）或删除中（`DELETING`）的账号，封禁按钮禁用（后端返回 409 `INVALID_STATE`）；封禁弹窗必填理由（1 到 500 个字符），旁边写明"这是写给用户看的文字，只有一种语言"；弹窗确认文字写明"封禁会立即结束该账号进行中的通话，不作废登录令牌，解封后原令牌继续可用"[核实 Java §17.4 用户管理行]。
- **账号删除任务**：列任务 ID、账号 ID、状态（`SCHEDULED` 宽限期内、`CANCELED` 已取消、`PENDING`、`RUNNING`、`FAILED`、`COMPLETED`）、用户选的删除原因（`reason`：`NOT_USEFUL`、`TOO_EXPENSIVE`、`PRIVACY_CONCERN`、`TECHNICAL_PROBLEMS`、`FOUND_ALTERNATIVE`、`OTHER`，用户没选或后台代发起的为空）、预定执行时间（`executeAfter`）、重试次数、最近错误、创建与完成时间；`FAILED` 行有"重试"；重试次数超过 `deletion.alert_after_failures` 的行高亮（同时 Java 会写一条 `DELETION_FAILED` 告警） [核实 Java §17.4、§17.5]。
- **用户列表导出**（`USER:EXPORT`）：列表右上角有“导出 Excel”按钮（只对持有 `USER:EXPORT` 的管理员显示），调 `GET /users/export`，参数和当前筛选一致，规则同统计页的导出（`fetch` 带 `Authorization` 头取回后保存，导出中显示进度，超过行数上限时显示后端的提示）；邮箱和手机号按 `USER:EMAIL_VIEW`、`USER:PHONE_VIEW` 掩码，不含 IP、内容和资产。依据：dramaBox 有用户列表导出，导出和手机号完整显示是两个单独的权限码 [核实 审计 D5]。

### 5.7a 多开检测与认证事件

- **多开检测** `/users/abuse`：`ABUSE:VIEW`。两个页签（按设备、按 IP），日期范围默认最近 7 天；列：聚类标识（哈希前 8 位）、账号数、免费账号数、付费账号数、首次和最后创建时间；只列出免费账号数不小于阈值的聚类（阈值输入框，默认取 `abuse.cluster_min_free_accounts`）。点一行展开该聚类下的账号（账号 ID 链接到用户详情、创建时间、状态、是否付费、注册方式），免费账号的行有"封禁"按钮（需要 `USER:BAN`，复用用户详情的封禁流程；付费账号的行没有）。页面顶部写明：付费账号不计入、不处理；同一个 IP 下可能有大量真实用户，按 IP 的结果只作参考。
- **认证事件**：用户详情页的一个页签（`USER:VIEW`），按时间倒序分页，列类型、原因、设备和 IP 的哈希前 8 位、时间。
- 设备列表不在管理后台，是用户自己的功能（Java 2.9）。

### 5.8 内容审核

- **队列**：列 ID、内容类型（形象、声音、消息、persona、伴侣名字 `COMPANION_NAME`、生成的标准图 `AVATAR_IMAGE`、动作片段 `ACTION_CLIP`）、来源（自动、举报、投诉 `COMPLAINT`）、自动判定级别、类别、分数、状态、创建时间；筛选状态、来源；默认按待处理时长排序；页面顶部显示最老一条待处理的等待时长（Java §11.4：政策要求举报必须真的被处理）[核实 Java §11.4、§17.4]。
- **详情**：记录字段；内容区只对持有 `MODERATION:REVIEW` 的管理员显示，只持有 `MODERATION:VIEW` 的管理员看到记录字段和"无权查看内容"的提示，页面入口仍是 `MODERATION:VIEW`（Java §17.4：`GET /moderation/records/{id}/content` 需要 `REVIEW` 并写审计日志）；内容区取 `GET /moderation/records/{id}/content`：文本直接显示，文件按 `mediaType` 用图片、音频、视频播放器显示（地址为短时效签名地址，过期后重新取，不缓存）；页面写明"查看会被记录"；举报来源的记录显示举报理由和补充说明；`BLOCKED` 的记录没有内容区，显示"自动拦截，未保存原文"；`COMPANION_NAME` 的待审记录（审核服务故障时先保存的名字）显示用户当前的名字，记录对应的名字已被用户改过时接口返回 404 `CONTENT_NOT_STORED`，同样没有内容区 [核实 Java §17.4、§18]。
- **判定**（`MODERATION:REVIEW`）：`APPROVE`/`REJECT`、`note`（通过时选填，拒绝时必填）；确认弹窗先展示这次判定对该类内容的后果，文字取自 Java §11.4 的效果表 [核实 Java §11.4]。
- **文本规则**（`MODERATION:CONFIG`）：词表编辑，每条规则是匹配文本（1 到 200 个字符）、匹配方式（`SUBSTRING` 子串，适合中文、泰文等没有空格的文字；`WORD` 整词，适合拉丁文字；`REGEX` 正则，保存时校验能否编译）、级别（`REVIEW` 进复核，`BLOCK` 直接拦截）、备注；最多 `moderation.text_rules_max` 条；说明文字写明匹配前会做规范化（不分大小写，去掉零宽字符）、正则有执行时间预算、规则命中 `BLOCK` 时内容不会再发给审核服务 [核实 Java §11.2、§17.4]。
- **审核统计**：日期范围；按日、按内容类型和来源的新增、通过、拒绝、自动拦截数；已处理记录的平均处理时长；当前最老待处理的等待时长（Java §17.4）。

### 5.9 养成管理

- 一张表单读写 `companionship.stage_thresholds`（`{"BONDING":50,"CLOSE":150}`）、`milestone.days`（`[7,30,100]`）和 `companionship.text_burst_minutes`（30，两条文字消息相隔不超过这么多分钟算同一次互动）[核实 Java §17.5]。
- 前端校验：阈值为整数且 `BONDING` 小于 `CLOSE`；里程碑天数为不重复的正整数。后端的 `INVALID_REQUEST` 是最终校验。
- 提示：改阈值只影响之后的计算，不迁移数据（Java §6.1）。

### 5.10 订阅与额度

- **订阅列表**：筛选账号 ID、状态、商店、商品；列订阅 ID、账号 ID、商店、商品、状态（`PENDING`、`ACTIVE`、`CANCELED`、`IN_GRACE_PERIOD`、`ON_HOLD`、`PAUSED`、`EXPIRED`、`REVOKED`）、当前周期起止、是否自动续订、环境（沙盒带标签）、购买时间 [核实 Java §15.3、§15.4、§17.4]。详情：订阅字段加事件时间线（类型、子类型、商店给出的事件时间、接收时间、处理时间、错误）。
- **权益定义与功能值**（页面入口 `SUBSCRIPTION:VIEW`，保存需 `SUBSCRIPTION:CONFIG`）：权益列表（key、名称、priority）；每个权益有"功能值"编辑，每个功能开关一行，控件由类型决定：`BOOLEAN` 用开关，`LIMIT` 用数字输入加"不限"勾选，`STRING` 用文本框。每行三种状态：**未配置**（回退默认值）、**具体值**、**不限**；未配置与不限是两回事，界面必须区分。保存 `memory.tier`、`chat.model_tier` 时后端校验，不合法的 `INVALID_REQUEST` 原样展示 [核实 Java §15.3、§17.4]。
- **功能开关**：列 key、类型、范围（永久、周期、终身）、默认值、额度单价、说明；`PUT …/default` 改默认值（即免费用户的限制）；额度单价只有永久的 `LIMIT` 开关可编辑，其余行的该单元格禁用 [核实 Java §15.3]；`avatar.looks_max`（每个形象的外观数上限）和 `credits.period_grant`（订阅每期赠送的额度数）的额度单价也禁用，`credits.period_grant` 的默认值和权益功能值不能选"不限"（Java §15.3）。通话额度的三个键（`call.daily_minutes`、`call.monthly_minutes`、`call.lifetime_minutes`）的"默认值"单元格有三种显示：数字、不限、未配置；**三个键都没有配置时**页面顶部显示红条"通话额度未配置，免费用户不能通话"（只配其中一个不显示）。文字额度的两个键（`chat.daily_messages`、`chat.monthly_messages`）规则完全相同：默认值单元格有三种显示，**两个键都没有配置时**页面顶部另显示红条"文字额度未配置，免费用户不能发文字"，保存权益的功能值时同样提醒；`UNSET` 对这五个额度键有效。保存权益的功能值或订阅商品映射时，如果这个权益没有配置 `call.daily_minutes`、`call.monthly_minutes`，而默认值也没有配置，显示提醒"这个权益的订阅用户通话不受日额度、月额度限制"。`call.lifetime_minutes` 不出现在权益的功能值里（它只对免费账号生效，后端拒绝保存）；它的说明里写明：只影响之后创建的账号，已有账号的发放值不变，创建时没配置的账号在配置之后第一次发起会话时记入当时的值。
- **商品映射**：列商店、商品 ID、对应权益、在售开关、排序。商品价格在商店后台，这里没有 [核实 Java §15.3]。
- **事件重处理**（页面入口 `SUBSCRIPTION:VIEW`，"重新处理"和"已处理"需 `SUBSCRIPTION:GRANT`，没有就不显示按钮）：列表看 `FAILED`，每行"重新处理"；另有"需人工关注"筛选（`needsAttention=true`，例如 Google 的待审退款通知），每行"已处理"按钮（`POST /subscription-events/{id}/ack`）。
- **订阅统计**（`FINANCE:VIEW`）：活跃订阅数、新增、续订、取消、过期、退款次数，按商店和商品分；页面用文字写明"金额是标价不是实收，沙盒订阅不计入"。没有退款操作 [核实 Java §17.4]。
- **额度包**（`SUBSCRIPTION:CONFIG`）：列商店、商品 ID、额度数、在售开关、排序。
- **调账申请与审核**（dramaBox-admin 的"金币调账审核"的对应页面 [子代理读码 dramaBox-admin/src/pages/wallet/wallet-coin-adjust-request]）：列表筛选状态、账号 ID；列账号 ID、类型（发放/调整）、变动额度（带正负号）、理由、状态、申请人、审核人、审核备注、申请与审核时间。新建申请（`SUBSCRIPTION:GRANT`）：账号 ID、类型、额度、理由；通过（`CREDIT:REVIEW`）：备注可选；驳回：备注必填。申请人本人的申请，审核按钮禁用并提示，后端仍会返回 `SELF_REVIEW_FORBIDDEN`。
- **额度账户** `/credits/accounts`（`SUBSCRIPTION:VIEW`）：筛选账号 ID（精确）、余额范围；列账号 ID（点开进用户详情的“额度”页签）、余额（为负时用醒目颜色）、累计获得、累计消耗、更新时间；按更新时间倒序，分页。依据：dramaBox-admin 的金币账户页 [审计 行 62]，接口见 Java §15.9。
- **额度流水** `/credits/transactions`（`SUBSCRIPTION:VIEW`）：筛选账号 ID（精确）、原因、类型（全部、获得、消耗）、时间范围；列流水 ID、账号 ID、变动（带正负号）、原因（含 `SUBSCRIPTION_GRANT` 订阅每期赠送、`SPEND_REVERSED` 建外观失败退回）、消费类别（`spendKind`：功能、服装、外观）、功能、条目（`itemKey`）、数量、备注、时间；按 ID 倒序，分页。依据：dramaBox-admin 的金币流水页 [审计 行 62]。
- **账号额度**（用户详情里）：余额和流水（变动、原因、关联购买、消费类别、功能、条目、数量、备注、时间）。**余额为负时用醒目颜色显示，并写明"为负时不能消费，新购买的额度会先抵扣"**（Java §15.9 的产品决定）。
- **额度统计**（`FINANCE:VIEW`）：额度包销量、消费额度、退款扣回额度，按商店和商品分，沙盒不计入；消费额度按消费类别（功能、服装、外观）分，服装再按条目分（Java §17.4）。

### 5.11 推送

- **模板**（`PUSH:TEMPLATE`）：按触发原因加语言管理标题、正文、链接类型与目标、图片地址；顶部是"触发原因 × 语言"的完整性矩阵，语言列表取配置项 `app.supported_locales`（初始只有 `en`；往里加语言之前客户端要先有翻译，Java §17.5），缺的格子标红；每个召回触发原因必须在列表里的每种语言上都有模板才允许启用，保存时的最终校验在后端（Java §8.4）。图片用 `POST /uploads/image` 上传，只允许 jpg/png 且不超过 `upload.push_image_max_bytes`，上传中禁止提交；提交模板或任务时只带上传返回的 `uploadId`（图片地址由后端从上传记录填，不能手填） [核实 Java §8.4、§17.4；校验取自 子代理读码 dramaBox-admin/src/pages/push/pushImageField.ts]。
- **手动推送任务**（`PUSH:SEND`）：创建表单字段：受众（全部含游客、仅注册账号、仅游客、账号 ID 列表）、平台和语言筛选（账号 ID 列表时不可选）、标题、正文、链接类型与目标、图片、发送时间（立即或定时）；列表列：状态（`PENDING`、`RUNNING`、`DONE`、`CANCELLED`）、已发数、失败数、创建人、计划时间；`PENDING` 行可取消 [核实 Java §8.5、§18]。
- **周期推送** `/push/schedules`（`PUSH:SEND`）：列表列：重复方式、发送时刻与时区、起止日期、启用开关、受众、下次生成时间；创建和编辑表单：重复方式（每天、每周选星期、每月选几号，31 日在短月取月末的提示）、发送时刻、时区（IANA 下拉，默认 UTC，说明"固定时区，不是每个用户的当地时间"）、起止日期、受众与筛选、标题、正文、链接、图片；删除等于停用，已生成的任务保留 [核实 Java §8.5、§17.4]。
- **发送记录**（`PUSH:VIEW`）：列账号、类型、触发原因、本地日期、创建时间；展开行显示对每个 token 的发送结果。
- **推送效果**（`STATS:VIEW`）：日期范围、触发原因筛选；按日、按触发原因的发送数、送达成功数、送达失败数、点开数、点开率（`pushesOpened / pushesSent`，列提示写明"点开数记在点开当天，与发送日不一定是同一天"）；趋势图加明细表；落地条 `push`。dramaBox-admin 没有推送效果页；它的缺口分析指出的是推送投递与送达回写没有实现、表里没有送达数字段 [子代理读码 dramaBox/docs/gap-analysis-admin-design.md 第一部分.6]，推送效果页是本项目自己的。
- **召回参数**（`PUSH:CONFIG`）：`recall.*`、`push.default_locale`，渲染同 5.15。

### 5.12 邀请

- 邀请码：列邀请码、所有者账号 ID、创建时间。邀请记录：列邀请人、被邀请人、兑换时间、奖励状态（待满足条件、已奖励、不符合）、不符合原因、已发额度，可按奖励状态筛选。
- **奖励设置**（`INVITE:CONFIG`）：`invite.*` 各键的表单：总开关、邀请人奖励额度、被邀请人奖励额度（0 表示这一边不发）、触发时机（注册时、第一次通话后）、第一次通话的最短秒数、每个邀请人最多奖励次数（0 不限）、活动起止时间；页面写明"金额在发放时记进邀请记录，之后修改只影响之后发放的"，渲染同 5.15 [核实 Java §9.1、§17.5]。
- **分享统计** `/invite/share-stats`（`INVITE:VIEW`，读汇总表，有"重新落地该日"，落地 `share-funnel` 和 `share-channel`）：三个页签。**总览**：卡片（总分享 PV、链接点击 PV、下载点击、邀请注册数，这些都是可相加的计数；UV 是各日去重人数，**不跨日相加**（4.4），所以不做 UV 合计卡片，只在趋势图和明细表里逐日显示）、每日分享 PV 折线。**裂变漏斗**：漏斗图 分享 → 链接点击 → 下载点击 → 注册（比率 = 本步 ÷ 上一步）、四条序列的趋势线、明细表（日期、分享 PV、分享 UV、链接点击 PV、下载点击、注册）。**渠道分析**：分享渠道下拉（来自数据中出现过的渠道，另有"全部"）、分享渠道占比饼图、前 5 个渠道的趋势线（其余并入"其他"）、明细表（日期、分享渠道、PV、UV），有"导出 Excel"。dramaBox 的"解锁分享""普通分享"类型和"剧分享热度"页签是短剧解锁专属，不做 [核实 Java §9.2]。
- **邀请统计**：日期范围；KPI：总邀请注册（`totalInvitees`）、活跃邀请人数（`activeInviters`）、邀请参与率（`activeInviters / registeredAccounts`）、人均邀请数（`avgInvitesPerInviter`）；趋势图（每日邀请注册、每日活跃邀请人）；排行（Top N，默认 50）。KPI 另加已奖励邀请数（`rewardedInvitees`）、已发放额度（`creditsGranted`）；没有 K-Factor。排行表每行有"查看裂变"按钮，切到"裂变层级"页签并载入该账号的邀请链。**裂变层级页签**：`Statistic` 平均链路深度（一位小数）、最大链路深度、链路节点数；柱状图"深度分布"（横轴"N 级"，纵轴人数）；邀请链树：账号 ID 输入框、深度 1 到 `invite.chain_max_depth`（页面默认取 3，上限是这个配置，默认 5）、`Tree` 展示后代（掩码标识和邀请时间），头部显示后代数和实际深度；有"导出 Excel"（邀请统计） [核实 Java §17.4 邀请管理行、九节 9.1；dramaBox 的邀请统计定义见 Java 该行的出处]。

### 5.13 投放管理

照 dramaBox-admin 的"投放管理"模块：投放效果、投放账户（含投放成本页签）、归因明细 [核实 dramaBox 后台笔记 `docs/_scratch_dramabox_admin_modules_b.md` 3.3、`_scratch_dramabox_admin_stats.md` 的 stat-proxy-daily]；后端见 Java §10。这一块在最初的后台设计里漏掉了（没有被采纳也没有被明确排除），2026-10-05 补上。

- **投放效果** `/campaign/stats`（`ATTRIBUTION:VIEW`，读汇总表，有"重新落地该日"，需要 `STATS:LAND`）：筛选日期范围（默认 7 天）、投放账户；汇总表列：投放账户编码、名称、访问量（`pageViews`）、点击数、点击率、安装数、注册数、安装率（安装数 ÷ 点击数，dramaBox 叫匹配率）、注册转化率（注册数 ÷ 安装数）、总花费、CPA（总花费 ÷ 注册数）、CPI（总花费 ÷ 安装数），分母为 0 显示"—"；按日明细表（`groupBy=day`，日期加同上各列；选了投放账户时是该账户的逐日，没选时是全部投放账户合计的逐日；每页 20 行）。"未归因"行显示当天认领后没有匹配上的安装数，并显示它占（匹配安装加未归因安装）的比例，用来看自然量。比率分母为 0 一律显示"—"。图表加表格同时存在。导出按钮（统计导出，Java §17.6）。顶部有"如何阅读此报表"。
- **投放账户与成本** `/campaign/accounts`（`ATTRIBUTION:MANAGE`，两个页签）：
  - **投放账户**：列表列：投放 ID（`code`，可复制）、显示名称、关联渠道包（标签）、Facebook、Google、TikTok 像素（悬浮显示编号）、状态开关（立即提交，没有二次确认）、创建时间、操作；搜索关键字（编码或名称）和状态筛选。创建和编辑弹窗（宽 640，三个分区）：基本信息（`code` 只在创建时可填，`^[a-z0-9_-]{3,32}$`，创建后只读；显示名称；媒体来源；活动名；UTM 媒介，默认 `cpc`；广告组；广告；备注）、像素配置（Facebook 像素编号、**Facebook 访问令牌**（密码框；已设置时只显示"已设置"，**不回显明文**，留空表示不修改；dramaBox 在编辑时把令牌回显到浏览器，这个不照搬）、Google 像素编号、TikTok 像素编号）、关联渠道包（复选框，选项取自 `/channels`，Java §24.7）。操作：编辑、生成链接，**没有删除**，只有状态开关。
  - **生成链接弹窗**（宽 640）：平台单选（Facebook、Google、TikTok，选择时把 UTM Source 默认成平台名）、UTM Source、UTM Medium（占位 `cpc`）、UTM Campaign；点"生成"先检查该账户有没有这个平台的像素编号，没有则提示"请先配置该平台的像素编号"；有则调 `GET /attribution/campaigns/{id}/link`，显示链接和复制按钮；弹窗里同时显示该 `code` 的落地页接口地址（`POST /api/attribution/click`，给直接下载 APK 的落地页用）和"链接根地址没有配置"的提示（Java §10.4、§10.5）。
  - **投放成本**：筛选投放账户和日期范围；列：显示名称、日期、花费（两位小数）、币种（固定为 `attribution.cost_currency`）、备注、录入者、创建时间、操作（编辑、删除，行内确认）。工具栏"录入花费"（弹窗宽 480：投放账户必选，编辑时只读；日期必选，默认今天，编辑时只读；花费必填、不小于 0、两位小数；币种只读；备注）和"批量录入"（弹窗宽 720，两个页签：JSON——文本框，接受一个数组，或每行一个对象；CSV——选 `.csv` 文件由浏览器解析，表头 `campaign_code,stat_date,cost,currency,remark`，日期接受 `YYYY-MM-DD`、`YYYY/MM/DD`、`YYYY.MM.DD`，提供模板下载 `attribution-cost-template.csv`（两行示例）；任一行不合法整批拒绝，并按行显示原因）；提交 `POST /attribution/costs/batch`，已存在的日期按覆盖处理，提交前提示这一点。
- **归因明细** `/campaign/attribution`（`ATTRIBUTION:VIEW`，现查，没有落地条），三个页签：
  - **点击明细**：筛选点击时间范围（默认 7 天）、投放账户、状态（待认领、已匹配、已过期）、关键字（IP 或 UTM）；列：ID、点击时间、投放账户、状态标签、客户端 IP（默认掩码，持有 `ANALYTICS:IP_VIEW` 才显示完整）、渠道（商店跳转或 APK 下载）、UTM Source、UTM Medium、UTM Campaign、认领时间。点击记录只保留 `attribution.click_retention_days` 天，页面注明。
  - **安装与注册**（两个来源的 `AttributionRecord`）：列事件名、事件时间、转化类型、广告类型、媒体来源、campaign、adset、ad、安装时间、是否再营销、平台、国家、App 版本、成本、账号 ID（可空，点击跳用户详情）、**来源**（`APPSFLYER`/`SELF`）、**匹配方式**（`APK_BLOCK` 安装包签名块、`REFERRER` 商店来源、`FINGERPRINT` 指纹兜底；指纹兜底会漏、也可能错配，列提示写明可信度较低）、投放账户、注册时间；可按来源、匹配方式、时间筛选 [核实 Java §18 AttributionRecord]。
  - **汇总**：按 `groupBy`（来源、媒体来源、campaign）切换，表格加条形图；列安装数、激活数、成本（有则显示，没有则为空）。两个来源分列、不相加（同一次安装可能各记一条，Java §10.3）。没有收入数据，所以没有 ROI 列。
- **归因参数** `/campaign/settings`（`ATTRIBUTION:MANAGE`）：`attribution.*` 各键的表单：链接根地址、Android 商店链接、其他设备的跳转地址（三个 URL 键按 Java §1.7 校验，保存时按 §10.4 的规则限制主机，错误原因照后端 `data.details` 显示）、点击保留天数、指纹窗口小时数、没有账号的记录保留天数、成本币种、批量录入上限，渲染同 5.15。页面说明匹配顺序：安装包签名块 → 商店来源 → 同 IP 指纹兜底；兜底之后仍没有匹配上的就是自然流量 [核实 Java §10.4、§17.5]。
- **不做**：dramaBox-admin 归因页的点击标识（`fbclid`、`gclid`）列，本后端不存；iOS 的归因只靠 AppsFlyer，自建归因只统计 Android（Java §10）。

### 5.14 客服、记忆服务、系统监控

- **客服**：列类别（`BUG`、`QUESTION`、`SUGGESTION`、`OTHER`）、账号 ID、转发状态（`PENDING`、`FORWARDED`、`FAILED`）、转发引用、创建时间；详情显示正文和 `context`（App 版本、系统版本、设备型号、语言、最近错误）；`FAILED` 行有"重试"（`SUPPORT:MANAGE`）；不做回复和工单（Java §12）。
- **记忆服务**：档位列表和详情（`top_k`、`recency_channel_enabled`、`recency_channel_count`、`consolidation_enabled`、`consolidation_threshold`）；修改档位（`MEMORY:TIER_CONFIG`）表单顶部提示"修改会立即影响该档位下所有账号"，名字不在列表里时先确认"将新建档位 X"（没有删除档位的接口）；embedding 模型列表，注册（`MEMORY:MODEL_REGISTER`）提示"先把 TEI 容器启动好再注册"，同名不同维度返回 409 `MEMORY_MODEL_CONFLICT` 时原样展示 `detail`；账号维度（用户详情的"记忆"页签）显示指派历史，指派模型（`MEMORY:MODEL_ASSIGN`）警告"只影响之后的新写入，已有历史不会重新计算，旧记忆大概率检索不到"；不提供给单个账号手动指派档位，不做记忆内容浏览 [核实 Java §16.2–16.4]。
- **系统监控**：时间序列图：GPU 利用率、报错数与报错率，按 `source` 筛选；用量与费用（LLM 和形象渲染各资源类型）不在这里，页面上有一个链接跳到成本报表（Java §14.2），空值不画点；没有数据时显示"暂无数据"，不是错误 [核实 Java §14、§17.4]。
- **告警** `/monitor/alerts`（查看 `MONITOR:VIEW`，“关闭”按钮需要 `MONITOR:MANAGE`，没有就不显示）：`GET /alerts?status=&type=`；列类型（账号删除失败、订阅未确认、额度购买未消耗、额度购买入账前已被消耗、额度余额与流水不一致、档位同步失败、短信每日总量达到上限、免费通话总分钟数过高、模型没有价格（`USAGE_PRICE_MISSING`，各资源类型）、LLM 价格同步失败、形象数据删除超时（`AVATAR_DELETION_OVERDUE`）、照片里的人投诉超时（`LIKENESS_COMPLAINT_OVERDUE`）、形象生成门槛未配置（`GENERATION_CONFIG_MISSING`）、外观驱动资源包准备失败（`LOOK_PACKAGE_PREPARE_FAILED`））、关联账号、关联对象、详情、状态、创建时间；点关联账号跳用户详情；"关闭"调 `POST /alerts/{id}/resolve`（写审计日志）；对象恢复后后端自动置为已解决。看板上有未处理告警数的卡片 [核实 Java §17.4 后台告警]。

### 5.15 系统配置 `/config`

- `GET /config` 只返回当前管理员有权编辑的键：持有 `CONFIG:MANAGE` 得到全部，只持有模块权限码（`COMPANIONSHIP:CONFIG`、`PUSH:CONFIG`、`INVITE:CONFIG`、`MODERATION:CONFIG`、`COMPLAINT:MANAGE` 等，按 Java §17.5 每个键的编辑权限）得到那些码对应的键，不会 403（Java §17.4），所以养成管理和召回参数页可以直接用它。
- 前端维护配置键的 schema：`src/pages/config/configSchema.ts` 里每个键有分组、类型（数字、字符串、布尔、JSON）、默认值、校验、标签与说明的语言键；`GET /config` 提供当前值、默认值、所需编辑权限。这是 dramaBox-admin 的做法（schema 在前端，页面对未识别的键给出警告）[子代理读码 dramaBox-admin/src/pages/plat/plat-app-config/configSchema.ts]，所以 `GET /config` 不需要返回说明文字。
- 页面按键的前缀分组（`auth.`、`admin.`、`ratelimit.`、`chat.`、`upload.`、`generation.`、`session.`、`events.`、`stats.`、`analytics.`、`recall.`、`export.`、`deletion.`、`subscription.`、`credits.`、`guest.`、`avatar.`、`render.`、`moderation.`、`complaint.`、`usage.`、`usage_price.` 等），每行显示当前值、默认值、是否已被修改；只有持有该键所需编辑权限的管理员才能编辑，其余只读 [核实 Java §17.5]。
- 未在 schema 里的键，页面顶部警告"存在未识别的配置项：…"，只读显示；JSON 值解析失败时该行禁用保存。
- 保存：一次只保存一个键（`PUT /config/{key}`），后端校验失败返回 `INVALID_REQUEST` 时在该行下展示 `message` 和 `data.details`（整数键不小于 1、关系约束等规则见 Java §17.5 开头）；保存成功时若响应带 `warnings`（例如关闭手机号登录时的现有手机号账号数、短信白名单里没有通道覆盖的国家、跳过倒计时过长），在该行下用警告样式展示，不阻止保存（Java §17.4）。
- 六个需要在行内写明风险的键，文字取自 Java §17.5 的说明列：`render.cloud_enabled`（默认 `false`，打开会产生服务器成本）、`moderation.underage_reject_below_age`（估计岁数低于它就拒绝照片；默认 16 是推断，要实测目标市场人群的年龄误差后调整）、`complaint.likeness_due_hours`（照片里的人投诉的处理时限，超过写告警）、`guest.call_minutes_total`（未配置游客不能通话；重装应用可以重置额度，要设得很小）、`chat.model_tiers_allowed`（增加新档位前必须先在 AvatarAgent 的 `LLM_TIERS` 里加同名档位并部署）、`chat.conversation_languages`（不能比 AvatarAgent 的识别和合成服务都会说的语言更长）。
- 各模块的局部配置（养成管理、召回参数）渲染方式与本页一致，只显示自己负责的键。

### 5.16 系统管理

- **管理员**（`ADMIN:MANAGE`）：列用户名、是否超级管理员、状态、必须改密码、角色、最近登录、创建时间。表单：用户名（创建后不可改）、初始密码（规则同 3.3，创建后 `mustChangePassword` 为真）、角色（**多选**，Java 是管理员—角色多对多；dramaBox-admin 是单角色 [子代理读码 dramaBox-admin/src/pages/system/admin-user/UserEdit.tsx]）、超级管理员标志。行操作：启用/停用（不能停用自己，最后一个启用的超级管理员不能被停用）、重置密码、重置二次验证、删除；这些是 dramaBox-admin 做不到的（它没有停用管理员和重置 TOTP 的路径）[子代理读码 报告 §3.1]。
- **角色**（`ROLE:MANAGE`）：列表加新建、编辑、删除；角色仍分配给管理员时删除失败，展示 `ROLE_IN_USE`。分配权限用可勾选的树：勾选父节点同时勾选全部子节点，保存时整体替换该角色的权限集合；树来自 `GET /permissions`（每个节点有 `parent`，为空表示根） [子代理读码 dramaBox-admin/src/pages/system/admin-role/RolePermission.tsx；核实 Java §17.3]。
- **权限树**（读取 `ROLE:MANAGE` 或 `PERMISSION:MANAGE`，增删改需要 `PERMISSION:MANAGE`）：树形表格，列节点名称（按界面语言取 `nameZh`/`nameEn`）、权限码、类型（菜单、功能）、排序、是否内置；操作：新增节点（选父节点、类型、码、中英文名称、排序；码创建后只读）、编辑（**内置节点只能改名称和排序**，码和父节点不可改，不可删除；自定义节点可改名称、排序、父节点）、删除自定义节点（行内确认；有子节点时失败，展示 `PERMISSION_HAS_CHILDREN`）。页面顶部写明："自定义节点可以分配给角色，用来给权限分组或为以后的页面预留，对现有接口没有效力；接口和页面只检查系统内置的权限码"（Java §17.3）。
- **审计日志**（`AUDIT:VIEW`）：筛选管理员、动作、对象类型、对象 ID、时间范围；列管理员、动作、对象类型、对象 ID、详情、时间 [核实 Java §17.4]。

### 5.17 应用内广告

依据：dramaBox-admin 的"应用内广告"五组页面 [子代理读码 dramaBox-admin `src/pages/in-app-ad/*`、DramaverseDemo `docs/ad-system-user-guide.md`]，后端见 Java 第二十二节。

- **投放检查清单**（每个广告页顶部可折叠，取自 dramaBox 的用户手册，因为"配好了却没有广告"是它最常见的运营问题）：广告要真正投出去，需要五层同时满足，按顺序检查——总开关 `ads.enabled` 已开启（默认关闭）→ 广告位已启用 → 计划为"投放中"且在起止时间内 → 单元为"投放中" → 素材为"已通过"且"投放中"。任何一层不满足，App 都拿不到广告。账号的订阅权益里有"去广告"（功能开关 `ads.removed`，Java §15.3）同样看不到广告；激励广告位当天的奖励次数用完（`frequencyCap`）也拿不到。**游客只拿得到 `app_open`、`call_end` 两个广告位**，用游客身份测试 `history_feed`、`reward_credits` 看不到广告是正常的（原因 `NOT_FOR_GUEST`）。
- **计划** `/ads/campaigns`：列名称、状态、优先级、起止时间、创建人、更新时间；筛选名称、状态；表单：名称、描述、优先级（数值越小越优先，默认 100）、起止时间（结束不得早于开始）；状态按钮：激活、暂停、恢复、结束（行内确认）；删除只允许草稿或已结束且名下没有单元；已结束的计划不可编辑；结束时间到了会由后端自动结束，列表上标注 [核实 Java §22.3]。
- **广告位与全局设置** `/ads/placements`：四个预置广告位，列广告位键、形式、名称、启用开关、频控（每账号每本地日展示数，0 不限，游客不适用、不设上限，Java 22.1；**激励广告位不能是 0，它同时是每天最多可得奖励的次数**，表单在激励广告位上直接这样标注）、冷却分钟（激励广告位显示"—"，不可改）、奖励额度（只有激励广告位可改，必须大于 0；旁边显示"每账号每天最多通过广告得到 = 频控 × 奖励额度"）、素材规格（比例、最短边、大小，只读）；不能新增或删除广告位。页面上半部是"广告全局设置"，渲染 `ads.*` 键（5.15 的方式）；`ads.skip_after_seconds` 填大于 5 的值时显示警告"全屏广告需要容易关闭，倒计时过长有违反 Google Play 广告政策的风险"（不阻止保存）；`ads.force_close_seconds`（强制可关闭兜底，默认 15，0 表示不启用）为 0 而开屏或插屏下存在"不可跳过"的素材时，同样警告（不阻止保存）；并提示：总开关默认关闭，关闭时 App 隐藏所有广告位；联调时可把频控和冷却临时改成 0（不限）方便连续测试，测完改回。频控按**展示**计数，预取了但没展示的广告不占额度 [核实 Java §22.4、§22.10；提示文字取自 子代理读码 DramaverseDemo `docs/ad-system-user-guide.md`]。
- **单元** `/ads/units`：列名称、所属计划、广告位、状态、权重、单元日上限、定向摘要；表单：计划、广告位、名称、权重（≥ 0，同一优先级的单元按权重随机，0 表示不会被选中）、单元日上限（全体账号和游客合计，0 不限）、定向编辑器（平台多选、国家多选、系统最低版本、App 最低版本、语言多选、时段列表，时段按用户本地时间）；保存前按 Java §22.5 的规则校验，错误指到具体字段。`GET /ads/meta` 返回 `geoConfigured=false` 时，国家定向旁显示"地理定向尚未配置，设置了也不会匹配"。状态：草稿 → 投放中 ⇄ 暂停；删除只允许草稿且没有素材。
- **素材** `/ads/creatives`：列缩略图、所属单元、类型、语言、审核状态、投放状态（已通过的可开关，立即生效，不需要重新审核）、权重；创建表单：先上传文件（调 `POST /ads/media`，页面显示服务端读出的尺寸、大小、时长和缩略图，并对照广告位规格给出通过或不通过；**提交创建或修改时只带上传返回的 `uploadId`**，文件地址、尺寸、大小、时长都由后端取自上传记录，表单里这些字段只读；未提交的上传 24 小时后被后端清理；一个 `uploadId` 只能用一次），再填类型、语言、点击动作与目标（`OPEN_URL` 只允许 https；`IN_APP_ROUTE` 的目标做成下拉，选项是 Java §8.3 的页面标识清单）、时长、可否跳过（默认"可跳过"；所属广告位是开屏或插屏时若选"不可跳过"，表单显示警告"全屏广告需要容易关闭，不可跳过有违反 Google Play 广告政策的风险"，不阻止保存）、激励阈值秒数（激励素材必填，5–30；视频素材还不能超过时长，图片素材没有时长限制；不能清空）、标题、正文、按钮文字（原生广告位必填）、广告主；审核：通过，或拒绝并填备注（拒绝必填备注），拒绝后可修改，修改后回到草稿；**已通过的素材不能修改和删除，只能暂停**——页面在这些按钮上提示"要换内容请新建一条，再暂停旧的"，并解释权重：同一单元下已通过且投放中的素材按权重随机，要做素材 A/B 测试就用权重控制流量比例，已上线素材的权重不能改。两个状态分开显示（审核状态、投放状态），不要混淆。
- **广告报表** `/ads/report`：筛选日期范围（默认 7 天）、平台、渠道（下拉：全部、各渠道码、`unknown`；渠道码列表取自 `GET /channels`，Java §24.7，任一登录管理员可调；选中后把值作为 `channelCode` 传给六个报表接口，选“全部”不传；Java §22.9）；落地条（`ad-daily`）；顶部 KPI 卡片：展示、游客展示（`guestImpressions`，包含在展示里）、视频开始播放、点击、视频完播、视频跳过、可视展示、不可视展示、未判定可视、点击率、完播率、可见率、可测量率、视频平均观看时长（比率两位小数的百分比，分母为 0 显示"—"），每张带提示图标说明公式（取自 Java §22.8）。**没有"独立用户"**：去重人数跨日、跨行相加没有意义，Java 的汇总表只在每个（日、叶子）行上存它，报表不展示（dramaBox 的报表展示了一个相加得到的近似值，这里有意删去）；趋势：折线图（展示与点击）加按日明细表；"无广告原因分布"表（日期、广告位、原因、次数；接口返回的是全部平台、全部渠道的合计，或页面筛选范围内的合计，要按平台或渠道分开看用页面上的筛选，表里不加列），原因枚举配本地化的说明（`GLOBAL_OFF`、`ENTITLEMENT_OFF`、`PLACEMENT_OFF`、`NOT_FOR_GUEST`、`FREQ_CAP`、`COOLDOWN_SUPPRESSED`、`NO_ELIGIBLE_UNIT`、`TARGETING_MISS`、`UNIT_DAILY_CAP`、`NO_CREATIVE`、`META_WRITE_FAIL`）；四个页签按广告位、按计划、按素材、按国家下钻，共用一张表。没有收入、eCPM、填充率：这些数据在自建广告系统里不存在（dramaBox 同样没有）[核实 Java §22.8；子代理读码 dramaBox-admin `src/pages/in-app-ad/report`]。

### 5.18 短信管理

依据：dramaBox-admin 的"短信管理"三个页面 [子代理读码 dramaBox-admin `src/pages/sms/*`]，后端见 Java 第二十三节；去掉“查看验证码”（用户 2026-10-05 确认，验证码只存哈希）；导出保留（dramaBox 有，权限 `SMS:RECORD:EXPORT`）。

- **渠道** `/sms/channels`：列渠道编码、名称、供应商、服务的国家、优先级、启用开关（立即生效）、是否已配置凭据；表单：渠道编码（创建时填，唯一，创建后不可改）、名称、供应商（下拉，选项来自 `GET /sms/meta` 的已注册适配器；接口地址的主机白名单也来自它）、接口地址（https）、凭据（密码框；编辑时留空表示不修改，**页面永远拿不到已保存的凭据**）、扩展配置（JSON，含 `appId` 和按国家的发送方 ID）、国家（多选，空表示全部）、类型（`OTP` 或 `MARKETING`，创建时必填，发验证码只用 `OTP` 通道）、优先级（同一国家有多个通道时取数值最小的一个；发送失败时不会切换到别的通道）、启用。**测试发送**按钮：弹窗填号码，正文固定为测试文案，显示当天剩余次数（取自 `GET /sms/meta` 的 `testRemainingToday`）；需要 `SMS:CHANNEL:CONFIG`。删除或停用前提示：它是唯一启用的通道且手机号登录已开启时不能删除、不能停用。
- **模板** `/sms/templates`：列模板编码、名称、类型、语言、国家、内容、供应商模板编号、启用；表单：模板编码（创建时填，创建后不可改）、名称、类型（`OTP` 或 `MARKETING`，创建时必填，发验证码只用 `OTP` 模板）、语言、国家（可空）、内容（`OTP` 模板必须含 `{code}`，可用 `{minutes}`、`{appName}`，页面实时校验）、供应商模板编号（可空）、启用。页面顶部提示选模板的规则：先按号码国家和用户语言（取请求头 `Accept-Language`）匹配，其次同语言不限国家，最后回退英文；没有任何可用模板时发送会失败。
- **发送记录** `/sms/records`：只读；筛选消息 ID、供应商消息 ID、号码（完整号码精确匹配）、投递渠道（短信或推送）、通道、用途、发送状态、送达状态、是否已使用、时间范围；列消息 ID、供应商消息 ID、号码（默认掩码，持有 `SMS:RECORD:PHONE_VIEW` 才显示完整）、国家、用途、投递渠道（验证码走推送的行没有供应商消息 ID 和送达状态）、通道、发送状态、送达状态、是否已使用（验证码被成功校验的时间）、失败原因、创建与发送时间；正文显示已把验证码替换为 `****` 的内容。没有“查看验证码”（验证码只存哈希，不提供）。页面右上角有“导出 Excel”按钮（只对持有 `SMS:RECORD:EXPORT` 的管理员显示），调 `GET /sms/records/export`，参数和当前筛选一致，规则同统计页的导出：`fetch` 带 `Authorization` 头取回后保存，导出中显示进度，超过行数上限时显示后端的提示；导出的号码按 `SMS:RECORD:PHONE_VIEW` 掩码。

### 5.18a 邮件模板

后端见 Java 2.2.1、17.4。只有英文一份，目前有五个模板：`REGISTER_CODE`（注册验证码）、`PASSWORD_RESET`（密码重置）、`DELETION_CONFIRM`（网页删除确认）、`PASSWORD_CHANGED`（密码已更改通知）、`LIKENESS_COMPLAINT_RECEIVED`（照片里的人投诉的确认邮件）。列表显示模板编码、标题、是否被改过、最后修改人和时间；编辑页有标题（1 到 200 个字符）、正文、该模板的占位符说明和必含项（`REGISTER_CODE` 必含 `{code}`，`PASSWORD_RESET` 必含 `{resetLink}`，`DELETION_CONFIRM` 必含 `{confirmLink}` 和 `{subscriptionNotice}`，后者由系统填订阅说明，不能删；`PASSWORD_CHANGED` 必含 `{time}`）和"恢复默认"（行内确认，恢复前显示默认文案）；保存时前端先校验必含项，后端校验失败返回 `INVALID_REQUEST` 时在表单下展示 `message`。

### 5.19 应用版本与渠道包

依据：dramaBox-admin 的"版本管理"和"渠道包管理" [子代理读码 dramaBox-admin `src/pages/plat/app-version/index.tsx`、`plat/plat-channel/index.tsx`]，后端见 Java 第二十四节。版本按渠道管理，直接下载渠道带 APK 上传（2026-10-05 补回：最初的设计假设只有商店渠道，去掉了 APK 上传和渠道包）。

- **版本列表**：筛选渠道包、平台、状态；列渠道包、平台、版本名、版本号、最低版本号、状态（草稿、生效中、已归档）、商店链接或 APK（DIRECT 渠道显示文件大小和 SHA-256 前 8 位）、创建人、激活时间；生效中的排前面。
- **表单**（仅草稿可编辑）：渠道包（必选，创建后只读）、版本名（`x.y.z`）、版本号（整数，Android 的 `versionCode`、iOS 的构建号）、最低版本号（≥ 1，不超过版本号，旁边写明"低于此版本号的用户将被强制更新"）、更新说明（按语言页签，`en` 必填）；**STORE 渠道**：商店链接（Android 必须是 `https://play.google.com/store/apps/details?id=<应用包名>`，只可另带 `hl`、`gl`；iOS 是 App Store 链接；表单实时校验，规则见 Java §24.2）；**DIRECT 渠道**：APK 上传控件（调 `POST /api/admin/uploads/apk`，显示上传进度，上传中禁止提交；上传成功后显示文件地址、大小、SHA-256（只读，不能手改），提交时只带返回的 `uploadId`（字段 `apkUploadId`）；文件没有 v2 以上签名时显示后端的错误原因）。
- **操作**：草稿 → 编辑、激活、删除；生效中 → 下线（行内确认"下线后该渠道将不再提示更新"）；已归档 → 无操作。**STORE 渠道每一次激活**都要弹出确认，勾选"新版本已经在商店对用户可见"后才能提交（提交时带 `confirmStoreLive=true`），确认框写明"激活后将成为该渠道唯一生效版本"和后果（不勾选无法提交，否则用户会被带到一个没有新版本的商店页，被强制更新的用户永久无法使用）；当新版本的最低版本号大于当前生效版本的版本号时，确认框用强提示文字。**DIRECT 渠道**激活时由后端确认文件存在且校验和一致，页面不弹商店可见确认，只弹"激活后该渠道的用户将被提示下载此 APK"[核实 Java §24.2]。
- 页面顶部写明判定规则：客户端版本号等于或高于生效版本 → 不提示；介于最低版本号和生效版本之间 → 可选更新；低于最低版本号 → 强制更新；等于最低版本号时是可选更新。
- **渠道包管理** `/system/channels`（`CHANNEL:MANAGE`，系统管理下的一页）：列表列渠道码、名称、平台、分发方式（商店分发、官网直接下载）、包名、启用开关、创建时间；创建弹窗：渠道码（`^[a-z0-9_-]{2,32}$`，创建后只读）、名称、平台（创建后只读）、分发方式（创建后只读）、包名；编辑只能改名称、包名、启用；**没有删除**，只有启用开关。预置三行：`play`、`direct`、`appstore`。各页面的渠道包下拉取 `GET /channels`（任何登录的管理员都能调）[核实 Java §24.7]。

### 5.20 站内通知

依据：dramaBox-admin 的"用户通知" [子代理读码 dramaBox-admin `src/pages/drama-user/user-notification`]，后端见 Java 第二十五节。

- 列表：筛选账号 ID、类别（运营发送、系统事件）、是否已读、时间范围；列账号 ID、类别、标题（`en`）、是否已读、发送人、创建时间；点一行打开详情（`GET /notifications/{id}`），看全部语言的标题和正文、模板键和参数。
- 发送（`NOTIFICATION:SEND`）：弹窗表单——收件账号（每行一个账号 ID，最多 1000 个，提交前后端校验全部存在且正常，有问题的账号列在错误里，整批不发）、标题和正文（按语言页签，`en` 必填；标题 ≤ 100、正文 ≤ 500 个字符，实时计数）、链接类型（无、页面、网址）与目标（页面取 Java §8.3 的标识清单做下拉，网址只允许 https）、"同时推送"勾选（推送遵守用户的公告类通知偏好，偏好关闭的用户只收到收件箱消息）。页面注明：要给全体用户发消息请用推送管理里的手动推送任务，这里只发给指定账号。dramaBox-admin 的发送表单只有一个自由填写的用户 ID，没有校验 [子代理读码 报告 A.6]，这里改进。

### 5.21 客户端配置

依据：dramaBox-admin 的"应用配置"页面（配置 schema 在前端、按分组渲染）[子代理读码 dramaBox-admin `src/pages/plat/plat-app-config`]，后端见 Java 第二十六节。

- 一张表列出所有登记的键：键、说明、类型、是否按语言区分、是否已配置、客户端使用点；点击一行进入编辑。
- 编辑：按语言页签（"默认"加已添加的语言）填值，类型决定控件和校验（`URL` 只允许 https，`EMAIL` 格式，`BOOLEAN` 开关，`INT` 数字；`STRING_LIST` 只读，由系统派生）；空值对 `URL`、`EMAIL` 不合法；整个键作为一个整体保存，其中一个语言校验失败则不保存；"重置"删除该键全部语言值；保存只提交改动过的键。
- **预览**：选一种语言，显示该语言下客户端实际会拿到的值，并标出来源是"该语言""默认值"还是"未配置"。
- 只读的键（不在这里编辑）：`phoneLoginEnabled`（来源 `auth.phone_login_enabled`）、`accountDeletionGraceDays`（`deletion.grace_days`）、`conversationLanguages`（`chat.conversation_languages`）、`voiceTranscriptMaxChars`（`voice.transcript_max_chars`）、`voiceMinSeconds`（`generation.voice_min_seconds`）、`voiceMaxSeconds`（`generation.voice_max_seconds`），旁边注明“由某某配置决定，在系统配置里改”；对它们保存或重置，后端返回 400。`inviteShareSubtitle` 已删除，页面不再有这个键。
- 页面顶部提示：未配置的链接类入口在 App 里不显示。每个键的"客户端使用点"来自 Java §26.2。
- 不照搬 dramaBox 的做法：保存页面时把当前分组的字段各发一次请求并写成覆盖行、多个字段并发保存且不在一个事务里、空值遮住全局默认 [子代理读码 dramaBox-admin 页面与 报告 C.1–C.3]。

### 5.22 活动管理（每日签到、每日任务）

照 dramaBox-admin 的"活动管理"模块（签到配置、签到记录、观看任务配置、观看任务记录，以及两个统计页 [核实 dramaBox 后台笔记 `_scratch_dramabox_admin_modules_a.md` 5、`_scratch_dramabox_admin_stats.md` 3.12-3.13]）；后端见 Java 第二十八节。观看任务换成每日任务，类型是每日登录、每日通话时长、每日文字消息。这一块最初没有被判断过就漏掉了，2026-10-05 补上。

- **签到配置** `/act/act-signin-config`（`CHECKIN:VIEW`，写需 `CHECKIN:MANAGE`）：筛选活动名称、状态（草稿、进行中、已结束、停用）；列：活动名称、状态、时间（开始日、结束日、创建、更新）、操作。操作按库里的状态给："查看"（详情弹窗：名称、状态、起止、奖励阶梯表"第 N 天、奖励额度、额外额度"）和"编辑"始终有；草稿：发布、删除（行内确认"确定删除该签到活动？仅草稿且无签到记录时可删除"）；进行中：停用（行内确认）；停用：启用。**发布和启用先探测重叠**：先用 `confirm=false` 请求，如果响应里有 `disabledActivities`，弹确认框"确认启用并停用重叠活动？将停用以下日期范围重叠的活动：{名称}"，确认后用 `confirm=true` 再请求；没有重叠就直接成功。**编辑生效中的活动的日期范围时同样先探测**（`PUT` 带 `confirm`，规则同上）。表单（弹窗宽 560）：活动名称（必填）、开始日期、结束日期（日期选择，可空）、奖励阶梯列表（至少一行，按钮"添加一天"：第 N 天按行序号生成，奖励额度必填、不小于 0 的整数，额外额度不小于 0、默认 0）。页面说明：签到按用户的本地日算，阶梯走完后从第 1 天循环 [核实 Java §28.1]。
- **签到记录** `/act/act-signin-record`（`CHECKIN:VIEW`）：筛选账号 ID、活动 ID；列：账号 ID（可复制）、签到活动、签到日期、第几天、连续天数、奖励额度（含额外额度）、创建时间。只读。
- **签到统计** `/act/act-signin-stats`（`STATS:VIEW`，读汇总表，有"重新落地该日"，落地 `checkin-daily`，导出 Excel）：筛选日期范围（默认 7 天，日期是用户的本地日，不是 UTC 日，页面注明）；两个页签：**每日签到人数**（折线图加表：签到日期、人数）、**连续签到分布**（柱状图，横轴"N 天"，加表：连续天数、签到次数）。
- **任务配置** `/act/act-task-config`（`TASK:VIEW`，写需 `TASK:MANAGE`）：筛选任务名称、任务类型、状态；列：任务名称、任务类型、目标值、奖励额度、说明（省略展开）、领取倒计时（秒）、排序、状态、时间、操作（编辑；启用或停用，行内确认；删除，行内确认，已有记录时失败并展示 `TASK_HAS_RECORDS`，提示改用停用）。表单：任务名称（必填）、任务类型（必填，选项取自后端声明的类型：每日登录、每日通话时长、每日文字消息；**已有任务记录的配置，类型和目标值只读**，后端 409 `TASK_HAS_RECORDS`，要换就停用旧的、新建一个）、目标值（必填，不小于 1，默认 1；通话时长的单位是秒，旁边写明）、奖励额度（不小于 0，默认 0）、说明（多行，最多 500 字符，带计数）、领取倒计时（秒，可空，旁边写明"空 = 当天内随时可以领取"）、排序 [核实 Java §28.2]。
- **任务记录** `/act/act-task-record`（`TASK:VIEW`）：筛选账号 ID、状态；列：账号 ID、任务名称（显示名称；dramaBox 这一列显示的是数字任务编号，不照搬）、统计日期、当前进度（含目标值）、状态（进行中、可领取、已领奖、已过期）、达标时间、领奖时间、发放额度、创建时间。只读。
- **任务统计** `/act/act-task-stats`（`STATS:VIEW`，读汇总表，落地 `task-daily`，导出 Excel；日期是用户的本地日，不是 UTC 日，页面注明；领奖发生在第二天的也计入任务所属的那天）：趋势图（记录数、完成数、领奖次数，缺失日期补 0）加表（任务名称、记录数、完成数、领奖次数、完成率保留一位小数、发放额度）。

### 5.23 成本

依据：用户要监控 LLM 成本（2026-10-06）；2026-10-11 Java §14.2 扩成通用用量接口，除 LLM 外还有形象渲染设计 11.1 的资源类型（图像编辑、图生视频、抠图、驱动准备、年龄估计、云端渲染）；接口和口径见 Java §14.2、§17.6。DramaBox 没有对应物 [推断：dramaBox 没有 LLM 调用]。

- **成本报表** `/cost/report`（`COST:VIEW`，读汇总表；有“重新落地该日”，需 `STATS:LAND`；有“导出 Excel”，调 `GET /stats/export/usage-cost`，需 `STATS:EXPORT`）：筛选日期范围（默认 7 天）、资源类型、模型、来源（通话、文字对话、形象生成）、使用者类型（游客、免费、付费、系统、未知）、币种（含“无费用”，对应没有价格的请求）；卡片：总费用、请求数、没有价格的请求数（点击跳到价格页的“模型”页签，筛选“没有生效价格”）；趋势图：每日费用，按模型堆叠；表：按资源类型、模型、来源、使用者类型汇总的请求数、输入 token、缓存输入 token、输出 token（只有 LLM）、数量与单位（其余资源类型）、费用。**不同币种分开显示，不相加**；费用为空的请求不计入费用，页面写明“没有价格的请求只计次数”；统计日是请求发生的 UTC 日；报表顶部写明“费用按各组件上报的用量和价格表计算；LLM 费用是下限：用户打断通话时被取消的 LLM 请求可能没有用量，厂商仍会计费，LLM 对账以阿里云账单为准；自己部署的资源类型的费用取决于运营填的分摊价格”。
- **价格** `/cost/prices`（`COST:VIEW` 可看；确认、驳回、撤回、手填、改模型登记需 `COST:PRICE`），四个页签：
  - **待审价格**：列待审批次：模型、新价格与当前生效价格的逐档对比（输入价、缓存输入价、输出价，档位边界）、币种（下拉，选项来自 `usage_price.allowed_currencies`；确认时必须核对，因为阿里的接口没有币种字段）、提议的生效日期（可改，可改到更早的日期以覆盖已有的无价格记录）；档位不连续时“确认”被后端拒绝并显示原因；“确认”调 `POST /usage/price-batches/{batchId}/confirm`，“驳回”必填备注；页面写明“确认之前不会按这个价格计费”。
  - **当前价格**：每个模型当前生效的批次，按档位列输入价、缓存输入价、输出价、币种、生效日期；展开看历史批次（含被驳回、被取代、已撤回的）；`ACTIVE` 批次有“撤回”按钮（备注必填），页面写明“撤回只影响之后入库的记录，已入库的费用不改”。
  - **手填价格**：表单：资源类型、提供方、模型、生效日期（可以是过去或将来）、币种（下拉）；资源类型不是 LLM 时只填一个单价（单位由资源类型决定，表单只读显示：次、秒或分钟），没有档位；LLM 填档位行（输入长度下限、上限（最后一档为空）、输入价、缓存输入价（空则按输入价）、输出价，每百万 token，可加多行）；表单实时检查档位：第一档下限 0、下一档下限 = 上一档上限 + 1、最后一档上限为空；保存即新建一批 `ACTIVE`，与已有批次同模型同生效日期时旧批被取代，页面写明“价格只追加不修改，保存后不能再改这批，需要改就再填一批”。
  - **模型**：已见过的模型：资源类型、提供方、模型、是否有生效价格（没有的标红，可按此筛选）、同步适配器（空或 `DASHSCOPE_INTL`，只有 LLM 的模型能设；空表示只能手填）、同步用的模型名、首次和最近出现时间；“同步适配器”和“同步用的模型名”可改。
- 告警在 `/monitor/alerts`（5.14），新增两种类型：模型没有价格（`USAGE_PRICE_MISSING`，任何资源类型）、LLM 价格同步失败；同时持有 `MONITOR:VIEW` 和 `COST:PRICE` 的管理员在价格页顶部看到未关闭的这两种告警的条数，点击进告警页（只有 `COST:PRICE` 没有 `MONITOR:VIEW` 时不显示条数）。

### 5.24 形象与装扮

依据：形象渲染设计（`docs/superpowers/specs/2026-10-11-avatar-rendering-design.md`）第 12 节、13.5.3；接口和权限码见 Java §17.4"形象与装扮"行，数据见 Java §3.6–3.10、§18。页面路由名是本文新定。生成结果的人工复核不在这里，沿用 5.8 的审核队列（内容类型 `AVATAR_IMAGE`、`ACTION_CLIP`）。

- **服装与背景目录** `/avatar/cosmetics`（`COSMETIC:MANAGE`）：列表筛选类型（服装、背景）、上下架状态、适用风格；列 key、类型、名称（当前界面语言，没有时显示 `en`）、预览图、适用风格、适用的端、额度价格（空表示不能用额度兑换）、免费、默认、上架、排序。新建、编辑：key（创建后只读）、多语言名称、预览图、生成描述（只有管理员能写，用户不能输入自由文字描述服装）、适用风格（`STYLIZED_3D`、`REALISTIC`）、适用的端（`surfaces`：平台加渠道码的组合，渠道码下拉取 `/channels`，可选"该平台全部渠道"；不选任何一项表示所有端）、额度价格、免费、默认（每种类型一个默认的免费条目）、排序；上下架是行内开关。
- **动作目录** `/avatar/actions`（`ACTION:MANAGE`）：列 key、名称、图标、适用风格、适用的端、可触发方（用户、agent、两者）、启用、排序。表单：给 agent 看的英文说明、生成描述（只有管理员能写，Java §3.8：所有动作都是带生成描述的预生成片段，没有种类，也没有曲线上传），其余字段同服装目录。每个动作的行都有"给已有外观补生成"（`POST /actions/{id}/backfill`），确认框写明"会为每个已有外观生成一段片段并产生生成费用"；新增的动作不会自动给已有外观生成。
- **上传声明** `/avatar/declarations`（`DECLARATION:MANAGE`）：列版本、生效时间、是否当前生效；新建版本：多语言文案（文字由律师定）；"设为生效"确认框写明"之后用户上传形象必须勾选这一版，客户端拿到的旧版本会被拒绝"。部署配置 `avatar.declaration_required` 为 `false` 时页面顶部提示"当前部署不要求勾选声明"。
- **渲染模型** `/avatar/renderer-models`（`RENDERER:MANAGE`）：列渲染器、版本、平台、ABI、格式版本、最低 App 版本、大小、SHA-256、启用；上传、启用、停用。渲染模型对所有构建都下发，不分范围（发布构建也用格式 1 的渲染模型，形象渲染设计 8.3）。渲染模型文件名为 `avatar-renderer-<版本>.zip`，`rendererKind` 为 `AVATAR_RENDERER_V1`（契约第十八节）。
- **生成任务** `/avatar/generation-tasks`（`GENERATION:VIEW`）：失败的生成任务，筛选类型（`AVATAR`、`VOICE`、`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP`）和时间；列任务 ID、账号 ID（系统任务为空，标"系统"）、类型、失败原因、创建与更新时间。
- **系统默认数字人** `/avatar/default-avatars`（`DEFAULT_AVATAR:MANAGE`）：列表（名字、风格、源图、外观预览、是否生效）；新建：上传图（表单必须勾选"这张图有肖像授权或是合成的、不对应真人"）、选风格、填名字（必填，规则同 Java §2.5.1，所有语言用同一个名字，不合规时接口返回 400 `INVALID_REQUEST`），提交后生成外观和动作片段，显示生成任务状态；生成后可以改名（`PUT /default-avatars/{id}`，同一规则，写审计日志）；"设为生效"同一时刻只有一个，确认框写明"游客和没有形象的账号会立刻看到它"（它的名字也是这些用户的伴侣名字）。
- 本模块的配置项（`avatar.*`、`generation.*`、`render.*`）和功能开关在 5.15 和 5.10 现有的页面编辑。

### 5.25 投诉

依据：形象渲染设计第 12 节、10.4；接口见 Java §11.6、§17.4"投诉"行。页面路由名是本文新定。

- **照片里的人投诉** `/complaints/likeness`（`COMPLAINT:VIEW`）：列表筛选状态（`RECEIVED`、`INVESTIGATING`、`RESOLVED_REMOVED`、`RESOLVED_NOT_FOUND`、`REJECTED`）；列投诉 ID、联系邮箱、收到时间、到期时间（`dueAt`）、状态、处理人；按到期时间排序，已过期未结案的行高亮（同时 Java 会写 `LIKENESS_COMPLAINT_OVERDUE` 告警）。详情：说明、证据文件（查看写审计日志）、处理记录（每次流转一行：原状态、新状态、备注、管理员、时间，取自 Java 的 `LikenessComplaintEvent`）、关联的形象 ID。
- **处理**（`COMPLAINT:MANAGE`）：状态流转（`PUT /likeness-complaints/{id}/status`：状态下拉只有调查中 `INVESTIGATING`、查无此形象 `RESOLVED_NOT_FOUND`、驳回 `REJECTED`，"已删除" `RESOLVED_REMOVED` 只由下面的删除形象产生；已结案的投诉不显示流转和删除按钮，后端对它们返回 409 `INVALID_STATE`；备注选填；写审计日志）；"删除形象"输入查到的形象 ID（可多个），确认框写明"会删除这些形象及其全部外观、动作片段和文件，上传者会收到内容被拒的站内通知，不能撤销"，调 `POST /likeness-complaints/{id}/remove-avatars`，成功后投诉为 `RESOLVED_REMOVED`。页面写明"怎么找到对应的形象还没有定：在法律意见出来之前，只能按投诉人提供的上传者信息人工查找"（Java §11.6）。

## 6 界面语言

- 两种界面语言：`zh-CN` 和 `en-US`；键为扁平的点分字符串：`pages.*` 放共用文案，`menu.<路由名>[.<子路由名>]` 与路由 `name` 对应，各模块用 `<模块>.<字段>`，统计页的说明用 `stat.<页面>.helper.*` 与 `.tip` [子代理读码 dramaBox-admin/src/locales；dramaBox/docs/stat-metric-help-system.md]。
- 默认语言取浏览器语言，不是中文时回退英文。dramaBox-admin 默认中文，且 `baseNavigator: true` 时浏览器语言会覆盖默认值 [子代理读码 dramaBox-admin/config/config.ts]；本项目面向海外市场（项目 CLAUDE.md），不把中文当默认。
- 组件里不写死任何语言的文字（dramaBox-admin 的 `FormActionBar`、`StatCard`、`ImageUpload` 等有写死的中文或英文 [子代理读码 报告 §9.4]）；日期、数字、百分比用 `Intl` 格式化；测试里有一条检查，扫描源码中不经语言文件的中文或英文字面量。
- 请求头带 `Accept-Language`；Java 管理端的 `message` 是否按它本地化，Java 未写，前端不依赖：用户可见的提示文字由前端按错误码映射，`message` 只作兜底展示 [推断：设计选择]。
- 权限码、功能开关、配置键、事件名在界面上需要人读的名称：前端按键查翻译表，没有就显示键本身，不报错、不空白。
- 运营人员的界面语言已定为中文（简体）和英文（第 11 节）。

## 7 样式与主题

- **主色**：用户定的方向是科技蓝，接近 Tiffany blue。取通用的 Tiffany blue 色值 `#0ABAB5`，悬停 `#3DCBC7`，按下 `#089A96`（后两个是我按明暗各调一档）。圆角 12/16/8、字号 14 取 dramaBox-admin 的令牌 [子代理读码 dramaBox-admin/src/theme/tokens.ts]。产品名和 logo 未定，走构建变量，主色也放在构建变量里，以后换色不改代码。
- **对比度**：白色文字放在 `#0ABAB5` 上对比度约 2.4:1，不够；主按钮等实心主色元素用深色文字（`#06201F`，对比度约 7:1）。对比度是我按相对亮度公式算的，设计时要用对比度检查工具再确认一遍 [推断]。
- 三种模式：`dim`（默认，容器 `#1C2D3E`，背景 `#15202B`，蓝灰底与青色主色搭配）、`deep`（容器 `#0F2329`，背景 `#0A171B`，偏青的深色；取代 dramaBox-admin 的靛蓝深色 `deep-indigo`，它和青色主色不搭）、`light`（容器 `#FFFFFF`，背景 `#FAFAFA`）；模式存 `localStorage`。切换模式不整页刷新，图表在模式变化时用新的主题重新渲染 [推断：设计选择]。
- 布局：侧边栏 240 px、固定顶栏 56 px、内容区铺满、页面容器内边距 24 [子代理读码 dramaBox-admin/config/defaultSettings.ts]。
- 涨 `#22C55E`、跌 `#EF4444`（取自 dramaBox-admin）；图表色板换成以主色为首：`#0ABAB5, #3B82F6, #A78BFA, #F59E0B, #EC4899, #94A3B8`（dramaBox-admin 的色板是靛蓝系，与青色主色冲突，所以重配；色值是我选的）。
- 字体用系统字体栈，不引入外部 CDN 字体和外部 logo 地址。
- 统计卡片：数字计数动画、骨架屏、涨跌色、玻璃卡片背景，沿用 `StatCard` 的结构（标题、值、较昨日、较上周、提示图标）[子代理读码 dramaBox-admin/src/pages/stat/components/StatCard.tsx]；其默认的"较昨日""周同比"改为走语言文件。
- 渐变页面标题和背景光斑这类装饰：不做。dramaBox-admin 有 [子代理读码 报告 §9.4]，它们不承载信息，且在深色三模式下都要单独调；这是设计取舍，用户若要同样的视觉再加。

## 8 数据与安全约束

- **链接输入统一校验**：凡是填写链接的表单（客户端配置的 URL 键、推送模板与手动推送任务、站内通知、广告素材的点击目标、应用版本的商店链接）都在前端用 Java §1.7 的同一条规则实时校验（https；主机和路径 ASCII；无用户信息、反斜杠、控制字符、不可见字符、双向控制字符），出错时写明原因（例如"路径含非 ASCII 字符，请百分号编码"）。后端是最终校验，返回的 `data.details` 原样展示。规则只在一个共用的校验函数里写一次。

- 令牌只放 `sessionStorage` 和内存，不写 `localStorage`，不进 URL。
- 被审核的内容文件、签名地址不写入前端日志，不放进可分享的 URL；每次查看都从接口重新取。
- 查看用户上传内容的入口处写明"查看会被记录"（Java §17.2）。
- 列表里不展示用户的聊天文字，除非接口明确返回（审核详情里的被审核消息是例外，且每次查看有审计）[核实 Java §17.4]。
- 前端仓库不提交任何密钥；构建变量只放产品名、logo 地址、接口基础地址。
- 管理员 JWT 使用独立签名密钥和 audience，用户令牌不能访问 `/api/admin/**`（Java §17.2）。

## 9 本文依赖的后端与客户端契约

下面每一项都已写进 Java 文档（2026-10-01、2026-10-02 两轮改动，以及 2026-10-11 按形象渲染设计和通用用量接口的改动）；客户端一栏是需要 Android 计划同步实现的部分。

| 页面需要的 | 在哪里定义 | 谁来实现 |
|---|---|---|
| 统计汇总表、定时任务、补数、7 个报表接口 | Java §17.6 | Java |
| 事件目录新增 10 个事件 | Java §7.3 | 客户端 4 个：`paywall_viewed`、`purchase_initiated`、`purchase_failed`、`onboarding_step_viewed`；Java 6 个：`credit_purchased`、`credits_spent`、`session_start_failed`、`session_discarded`、`ad_reward_granted`、`phone_otp_sent`（另有 `register_completed.method` 增加 `phone`） |
| `GuestDevice.convertedAt`、`Session.requestedAt` | Java §2.2、§4.1、§18 | Java |
| 管理员 TOTP、停用与重置、令牌失效 | Java §17.2、§17.4 | Java |
| 权限树的增删改（`/permissions`）与内置节点同步 | Java §17.3 | Java |
| 额度调账申请与审核 | Java §15.9、§17.4 | Java |
| 邮箱掩码与 `USER:EMAIL_VIEW`；手机号掩码、`USER:PHONE_VIEW`、按完整号码筛选 | Java §17.4 | Java |
| 事件汇总、事件名、可保存漏斗 | Java §17.4 | Java |
| 审核内容的返回形式、审核统计 | Java §17.4 | Java |
| 推送图片上传 | Java §17.4 | Java |
| 邀请统计响应字段 | Java §17.4 | Java |
| 会话列表（全部账号） | Java §17.4 | Java |
| 应用内广告：模型、选取、接口、统计、后台接口 | Java 第二十二节 | Java；AvatarApp 客户端同步加广告功能（22.7），AvatarApp 客户端计划要新增广告任务 |
| 手机号登录与短信管理 | Java 第二十三节 | Java；客户端加手机号登录界面（23.7） |
| 应用版本与强制更新 | Java 第二十四节 | Java；客户端加版本检查与更新界面（24.4） |
| 站内通知 | Java 第二十五节 | Java；客户端加消息列表与未读数（25.6） |
| 客户端远程配置 | Java 第二十六节 | Java；客户端按键消费并去掉写死的网址（26.5） |
| 日末订阅快照 `StatSubscriptionSnapshot` | Java §17.6 | Java |
| `GET /config` 按管理员权限过滤 | Java §17.4 | Java |
| 后台告警 `AdminAlert` 与 `GET /alerts` | Java §17.4 | Java |
| `PUT /entitlement-defs/{key}/features` 的 `VALUE`/`UNLIMITED`/`UNSET` | Java §17.4 | Java |
| `PushDelivery.result` 三个取值；`session_start_failed` 的 `DISPATCH_FAILED` | Java §18、§7.3 | Java |
| 额度账户和额度流水页：`GET /credits/accounts`、`GET /credits/transactions`；`GET /api/credits` 的累计字段 | Java §15.9、§17.4 | Java；客户端：额度页显示累计获得、累计消耗、今日获得 |
| 短信发送记录导出 `GET /sms/records/export`（`SMS:RECORD:EXPORT`）、记录的“已使用”标志、通道和模板的 `smsType` | Java §23.4、§23.6 | Java |
| 用户列表导出 `GET /users/export`（`USER:EXPORT`）、列表的渠道、流量类型、媒体来源筛选、详情的归因 | Java §17.4 | Java |
| `event_log.source`、游客留存 `StatGuestRetention` 和 `/stats/guest/retention`、`User.registerPlatform`、活跃留存类型 `ACTIVE` | Java §7.2、§17.6、§18 | Java |
| 账号删除宽限期（`PENDING_DELETION`、`AccountDeletion` 的预定执行时间）、防滥用标记 `AbuseMarker` | Java §13.1、§13.5、§18 | Java；客户端：登录后被拦截的“取消删除”界面 |
| 通用用量上报 `POST /api/internal/usage`（原 `llm-usage`，带 `resourceType`）、价格表 `UsagePrice`、价格同步、`StatUsageCostDaily` 和 `/stats/usage-cost`、权限 `COST:VIEW`、`COST:PRICE` | Java §14.2、§17.4、§17.6、§18 | Java；AvatarAgent、形象生成服务、云端渲染服务负责上报 |
| 形象与装扮、投诉：`/cosmetics`、`/actions`、`/accounts/{id}/cosmetics`、`GET /accounts/{id}/avatars`、`PUT /likeness-complaints/{id}/status`、`LikenessComplaintEvent`（处理记录）、`/declarations`、`/renderer-models`、`/default-avatars`、`/generation-tasks`、`/likeness-complaints` 及权限码；审核内容类型 `AVATAR_IMAGE`、`ACTION_CLIP` 和来源 `COMPLAINT`；四个新告警类型 | Java §3.6–3.10、§11.6、§17.4、§18 | Java；形象生成服务负责生成 |

通话质量全部来自 Java 的 `Session` 表和后端事件，AvatarAgent 不需要为此新增东西；成本报表需要 AvatarAgent、形象生成服务、云端渲染服务按 Java §14.2 上报用量（上表）。

## 10 与 dramaBox-admin 的取舍对照

| dramaBox-admin | 本项目 |
|---|---|
| 统计页分散在业务模块里，统计报表只留全局报表 | 同，见 5.0 |
| 看板无自己的接口 | 同 |
| 统计预聚合加补数（它只有 6 个页面有补数，邀请统计是实时） | 同，读汇总表的页面有补数，现查的页面没有，Java §17.6 |
| 指标说明系统（页面级面板加列级提示） | 同，4.4 |
| 配置 schema 在前端 | 同，5.15 |
| 金币调账申请 → 审核 | 同，额度调账（5.10） |
| 渠道日报页（已删除）、游客转化漏斗 | 不做；漏斗在埋点管理（游客留存已做，见 5.4） |
| 播放质量三页 | 换成通话质量（5.5） |
| 内容分析（剧排行、逐集） | 换成通话分析（5.5） |
| 剧集、券码、分享解锁规则、引流 | 不做 |
| 签到与观看任务、渠道包、投放管理、分享统计 | 做：签到和每日任务见 5.22，渠道包见 5.19，投放管理见 5.13，分享统计见 5.12 |
| 应用内广告、短信管理、版本管理、用户通知、应用配置 | 做，见 5.17–5.21 |
| 权限树可编辑 | 可编辑；内置节点（代码里声明的码）只能改名称和排序，自定义节点完整增删改 |
| 无审计日志页 | 有 |
| 浏览器 MD5 密码、`token=123`、明文 TOTP 密钥、提交进仓库的凭据 | 不照搬 |
| 导出（`window.open` 带 token） | 做，但改成带 `Authorization` 头的 `fetch` 下载，不在 URL 里带令牌 |

## 11 已定的和缺的输入

用户 2026-10-02 已定：

| 项 | 结论 |
|---|---|
| 开发者 | Java 后端和管理后台前端都由 Java 开发完成（前端代码仓库名还没定） |
| 部署 | 管理后台网页与 `/api` 同域，由反向代理转发，**不使用 CORS 白名单机制** |
| 界面语言 | 中文（简体）和英文 |
| 主色 | 科技蓝，接近 Tiffany blue，取 `#0ABAB5`（第 7 节） |
| 看板 | 按业界标准，5.1 的 6 张卡片作为定稿；广告指标放在广告报表页（5.17），看板不放广告卡片 |
| 通话质量红框阈值 | 接通成功率低于 95%、接通耗时超过 10 秒的占比高于 5%，先这么定 |
| 兑换码 | 暂时不需要，不出现券码模块 |
| 应用内广告 | 需要；**不再调研，参照 dramaBox 的自建广告系统做一套**，AvatarApp 客户端也要加广告功能；设计见 Java 文档第二十二节 |
| 手机号登录与短信管理 | 参照 dramaBox-admin 做；设计见 Java 文档第二十三节 |
| 版本管理与强制更新 | 参照 dramaBox 的实现做；设计见 Java 文档第二十四节 |
| 站内通知、客户端远程配置 | 用户 2026-10-02 同意加入（参照 dramaBox）；设计见 Java 文档第二十五、二十六节 |

还缺的输入：

| 项 | 需要什么 |
|---|---|
| 前端代码仓库名 | 用户指定 |
| 部署域名 | 用户指定；与账号删除网页（Java §13.4）可能同一套托管 |
| 产品名、logo | 产品名未定，目前走构建变量 |
| 短信服务商 | 未选；dramaBox 只接了一家，AvatarApp 面向东南亚、中东、欧美，要选覆盖这些地区的服务商，选定前适配器只留接口 |
| 允许发短信的国家列表、每日全局短信上限 | 用户指定；没有它们手机号登录开关保存不了（Java §23.3、§17.5） |
| 设备完整性校验（Play Integrity、App Attest） | 用户决定是否加入；它是短信盗刷和号码级限额被滥用的主要缓解手段（Java §23.8） |
| GeoIP 来源 | 选型；没有它，按国家定向的广告单元不会匹配（Java §22.11） |
| 广告素材存储与转码、奖励额度初值 | 沿用文件存储的选型；`rewardCredits` 初值是产品决定（Java §22.11） |
| 隐私政策、服务条款、社区规范、客服、账号删除网页的域名和内容 | 用户指定；客户端配置里的链接类键在配好之前，App 里对应入口不显示（Java §26.2） |
| 照片里的人投诉：怎么找到对应的形象 | 法律意见：能否用投诉人的照片和用户上传的原照做人脸比对（Java §11.6，形象渲染设计 14.1）；之前只能人工查找 |
| 手机号账号是否需要绑定、换绑号码的流程 | 目前沿用 dramaBox：手机号即账号，不提供换绑（Java §23.1），用户确认或另提需求 |

## 12 验收清单与测试

验收：

- [ ] 持有不同权限码的管理员登录后，菜单只出现其有权的项；直接访问无权的地址得到权限提示，不是白屏；超级管理员看到全部菜单
- [ ] 登录：未带验证码 → 出现验证码框；验证码错误 → 提示并清空；未绑定 → 进入绑定页，绑定成功才进入应用；`mustChangePassword` 时只能进改密码页
- [ ] 令牌过期后任意请求跳登录页，登录后回到原页面；403 `ADMIN_FORBIDDEN` 提示无权限且不跳转
- [ ] 每个列表页：分页、筛选、空状态、加载状态
- [ ] 邮箱：没有 `USER:EMAIL_VIEW` 时显示掩码，有则显示完整；手机号同理（`USER:PHONE_VIEW`，掩码只留末 4 位）
- [ ] 封禁：理由必填，旁边有"写给用户看的文字"说明
- [ ] 内容审核：队列按等待时长排序，顶部显示最老一条的等待时长；判定前展示后果文字；`BLOCKED` 记录不显示内容区
- [ ] 订阅功能值编辑：未配置、具体值、不限三种状态能区分并正确保存
- [ ] 额度：余额为负时醒目显示并带说明；调账申请人不能审核自己的申请
- [ ] 每个统计页：标注"UTC"；落地条只对 `STATS:LAND` 显示；趋势图缺失日期补 0；留存未到期格子显示"—"；去重人数没有跨日合计
- [ ] 日报：平台不是 `ALL` 时业务类列显示"—"
- [ ] 漏斗：预设只读；自定义可保存、编辑、删除
- [ ] 系统配置：只有持有该键所需权限的管理员能编辑；JSON 值格式错误时不提交；未识别的键有警告
- [ ] 管理员：不能停用自己；删除仍分配给管理员的角色时展示 `ROLE_IN_USE`
- [ ] 切换语言后菜单、标签标题、表单校验文字都随之变化，没有残留的另一种语言；切换主题模式不整页刷新
- [ ] 活动管理（5.22）：发布或启用签到活动先探测重叠，确认框列出将被停用的活动；草稿以外的活动没有删除按钮；奖励阶梯至少一行；任务配置删除失败时提示改用停用；已有记录的任务配置的类型和目标值只读；编辑生效中的签到活动的日期范围也先探测重叠；任务记录列显示任务名称不是数字；统计页有落地条和导出；没有 `CHECKIN:MANAGE`、`TASK:MANAGE` 的管理员看不到新建和编辑
- [ ] 成本（5.23）：没有 `COST:VIEW` 看不到成本报表和价格页；没有 `COST:PRICE` 看不到确认、驳回、撤回、手填和改模型登记的按钮；没有 `STATS:EXPORT` 看不到导出，没有 `STATS:LAND` 看不到重新落地；待审批次确认前页面写明不会按新价格计费；档位有缺口或重叠时表单拦住；币种下拉只有 `usage_price.allowed_currencies` 里的值；不同币种分开显示、不相加；费用为空的请求归在“无费用”；价格保存后没有编辑入口，只有“撤回”和再填一批；系统监控页没有成本图，只有跳到成本报表的链接
- [ ] 投放管理（5.13）：投放账户没有删除按钮；Facebook 访问令牌编辑时不回显；批量录入任一行不合法整批拒绝并按行显示原因；投放效果比率分母为 0 显示"—"，有"未归因"行；点击明细的 IP 默认掩码；没有 `ATTRIBUTION:MANAGE` 的管理员看不到账户与成本、归因参数页
- [ ] 应用内广告（5.17）：投放检查清单显示；激励广告位的频控不能提交 0；已通过的素材没有编辑和删除按钮，只有暂停；素材先上传再创建，规格不符时在表单里给出原因；报表没有"独立用户"，有"游客展示"卡片和按国家页签；无广告原因枚举（含 `NOT_FOR_GUEST`）都有本地化说明
- [ ] 短信管理（5.18）：渠道的凭据永远不回显，编辑时留空表示不修改；供应商下拉来自 `GET /sms/meta`；测试发送显示当天剩余次数；没有 `SMS:RECORD:PHONE_VIEW` 时号码掩码；`OTP` 模板缺 `{code}` 时不能保存；没有“查看验证码”；有 `SMS:RECORD:EXPORT` 才显示导出按钮，导出的号码按权限掩码
- [ ] 额度账户与额度流水（5.10）：没有 `SUBSCRIPTION:VIEW` 看不到这两个页面；账号 ID 筛选是精确匹配；余额为负的行用醒目颜色；流水类型筛选“获得”只出现正的变动、“消耗”只出现负的变动
- [ ] 渠道包（5.19）：没有删除按钮；渠道码、平台、分发方式创建后只读；各统计页和版本列表的渠道包下拉都有数据；没有 `CHANNEL:MANAGE` 的管理员看不到渠道包管理页
- [ ] 应用版本（5.19）：DIRECT 渠道的表单有 APK 上传控件，上传中不能提交，文件地址、大小、SHA-256 只读；STORE 渠道没有；激活必须勾选"新版本已经在商店对用户可见"，否则不能提交；已归档的版本没有操作；更新说明缺 `en` 不能保存；只有 `APPVERSION:ACTIVATE` 的管理员看到激活和下线按钮
- [ ] 站内通知（5.20）：收件账号有不存在或非正常状态的，整批不发并列出这些账号；标题正文缺 `en` 或超长不能提交；列表点开能看到全部语言
- [ ] 客户端配置（5.21）：`URL` 类型填 `http://` 或空值不能保存；预览显示每个键的来源；`phoneLoginEnabled`、`accountDeletionGraceDays`、`conversationLanguages`、`voiceTranscriptMaxChars`、`voiceMinSeconds`、`voiceMaxSeconds` 只读；一个语言的值校验失败时整个键不保存
- [ ] 形象与装扮（5.24）：没有对应权限码的管理员看不到对应页面；服装和动作的 key 创建后只读；适用的端不选任何一项时显示"所有端"；"给已有外观补生成"有费用提示；上传声明"设为生效"前有确认；系统默认数字人新建必须勾选肖像授权，同一时刻只有一个生效
- [ ] 投诉（5.25）：没有 `COMPLAINT:VIEW` 看不到投诉页；没有 `COMPLAINT:MANAGE` 看不到状态流转和删除形象按钮；过期未结案的行高亮；删除形象的确认框写明后果
- [ ] 投诉处理（5.25）：状态下拉只有 `INVESTIGATING`、`RESOLVED_NOT_FOUND`、`REJECTED`（没有 `RESOLVED_REMOVED`）；已结案的投诉不显示状态流转和删除形象按钮；详情的处理记录与 `LikenessComplaintEvent` 一致（每次流转一行：原状态、新状态、备注、管理员、时间）
- [ ] 用户详情的"形象与服装"页签：列出形象（含形象名字）及其外观（风格、状态、预览图、创建时间）；持有这个页面所需的权限就能看，没有则 403；每次查看都有审计日志；没有 `COSMETIC:GRANT` 看不到赠送按钮；赠送必填理由
- [ ] 内容审核队列显示生成的标准图、动作片段两种内容类型，来源筛选有"投诉"；成本报表能按资源类型筛选，非 LLM 的行显示数量与单位而不是 token
- [ ] 全仓库没有写死的 `token=123`、MD5、外部 CDN 地址、未走语言文件的文案

测试（dramaBox-admin 没有测试 [子代理读码 报告 §1.1]，本项目要有）：`access` 判断、响应封装、分页组件的响应适配、配置 schema 校验、日期口径转换各有单元测试；登录与权限过滤有组件测试；`lint` 与类型检查在提交前执行。

## 13 实现依赖顺序

同一次交付，不是分阶段：Java 补齐第 9 节的契约 → 前端脚手架与构建变量 → 响应封装、登录与绑定、权限、外壳 → 分页列表组件、统计页共用组件（`StatCard`、趋势图、留存矩阵、落地条、指标说明）→ 各模块页面 → 语言文件与主题 → 验收。


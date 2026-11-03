# AvatarApp 管理后台前端 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 AvatarAdmin 仓库里一次交付 AvatarApp 管理后台的全部页面（规格 5.0 路由总表共 73 行，其中 72 行有页面、导出那一行没有页面，共 83 条页面路由），后端未就绪处用按契约写的假后端开发，接上真后端时只切代理。

**Architecture:** Umi Max + Ant Design Pro 的单页应用；请求层、权限、外壳、共用组件、统计共用组件先建好，再按模块各自一个目录（`services/`、`pages/`、`mock/`、`locales/`）落页面，模块之间不共享文件，所以互相独立。假后端是 Umi 开发服务器的 `mock/`（只在开发服务器里运行，不进构建产物），请求的是真实的 `/api/admin/**` 路径。

**Tech Stack:** 见下面关键设计点表（版本在表里，以任务 1 的实测为准）。

**Spec:** `D:\Projects\PycharmProjects\AvatarApp\docs\admin-frontend-design.md`（AvatarApp main；首版计划按 c63b29dd 写成，2026-10-21 后端的说明（AvatarBackend 提交 1bc0b66）之后按 main 当前的版本改过，执行时以 main 当时的版本为准）；后端契约 `D:\Projects\PycharmProjects\AvatarApp\docs\backend-task-java-backend.md` 第 17 节及它指向的各节（下文写作"契约 §x"）。两份文档是共享文档，本仓库不复制、不修改它们；本仓库里写"规格 §x"指第一份。

## 关键设计点

| 设计点 | 我的理解 |
|---|---|
| 交付物 | 在已克隆的空仓库 AvatarAdmin（远程 `git@github.com:StanleyMXY/AvatarAdmin.git`，分支 main，不重新 init）里写管理后台前端；规格 5.0 路由总表里 72 个有页面的行（共 73 行，导出行没有页面）一次全部做完，没有阶段，也没有标成可有可无的项 |
| 依据 | 页面、字段、权限码按规格；接口按契约 §17 和它指向的 §8、§10、§11、§14.2、§15、§16、§22–§26、§28；契约没定的接口和全部响应字段名，以后端 2026-10-21 的两份文件为准且自包含：说明 `AvatarBackend/docs/superpowers/plans/2026-10-21-avatar-backend-note-for-avataradmin.md`（提交 1bc0b66）和对我们 11 条问题的逐条回复 `AvatarBackend/docs/superpowers/plans/2026-10-21-avatar-backend-reply-to-avataradmin.md`（提交 4e1f538）；两处都没有的接口，列成新问题交给后端，不自己猜；2026-11-02 起另以后端对 140 条问题的回答（`docs/backend-inputs/2026-11-02-avatar-backend-answers-to-avataradmin-questions.md`）和新版接口文档（同目录 `2026-11-02-backend-task-java-backend-e07469d1.md`）为准，与上面两份说明不一致的地方以后者为准（见下面"后端的回答（2026-11-02）"一节） |
| Git | 计划提交在 main（第一个提交）；实现在分支 `admin-frontend`；全部完成后合回 main；提交不问你，推送先问你 |
| 命名 | 包名 `avatar-admin`；仓库的文件、文件夹、标识符、注释、文档里不出现参照项目或任何第三方产品名；参照项目只用于看结构，不复制代码 |
| 技术栈 | Umi Max 4.7.25、React 19.3.x、antd 6.6.x、`@ant-design/pro-components` 3.1.14-7（预发布线，精确锁定）、`@ant-design/plots`、dayjs、TypeScript 5.9.x、Node ^22.22.1 或 ≥24（任务 1 按已装包的 engines 核实：lint-staged 17.6.0 要求 ≥22.22.1，vitest 4.1.10 排除 Node 23；本机 25.6.1）；规划时这一组在 Node 25.6.1 上构建和组件测试都通过，以任务 1 的实测为准 |
| 为什么是 antd 6 加预发布的 pro-components | pro-components 稳定版 2.8.10 的 peer 只声明 antd 4/5；Ant Design Pro 官方模板今天用的就是 antd 6 加 pro-components 3.1.14 线；参照项目是 antd 6 加 2.8.10 再手工打补丁，不照做 |
| 图表库 | `@ant-design/plots`（规格写的 `@ant-design/charts` 里的统计图部分，官方模板也用它；charts 多带的图谱和流程图库我们用不到）；这一条偏离规格文字，你可以改回 |
| 测试 | Vitest 4.1.x 加 happy-dom 加 Testing Library；`@umijs/max` 和 `@ant-design/plots` 在测试里别名到 `tests/stubs/` 里的桩（应用代码照常从 `@umijs/max` 导入）；不用 Jest（规划时实测：Jest 加 Umi 测试预设在 Node 25 下加载 `jest.config.ts` 即报错，改成 CommonJS 配置后单个测试要 295 秒）；时区相关的测试在测试里用 `withTimeZone(tz, fn)` 设 `process.env.TZ`（本机实测有效），Vitest 用 `forks` 进程池 |
| HTTP 栈 | 自写 `fetch` 客户端，不用 Umi 的 request 插件（axios）；JSON 和下载共用它，上传用 XHR 取进度 |
| 代码风格 | Biome 加 `tsc --noEmit`；husky 的 pre-commit 跑 lint-staged（只检查暂存文件）和 tsc；不上 commitlint |
| 包管理与缓存 | npm，提交 lockfile；npm 缓存和临时目录放 D 盘（C 盘快满）；脚本都从仓库根目录用 `npm run` 或 `node` 运行 |
| 假后端 | Umi `mock/`：内存里有状态（新建后列表能看到）、数据多语言；`npm run dev:mock` 用假后端，`npm run dev:api` 关掉假后端并把 `/api` 代理到 `ADMIN_API_PROXY_TARGET`；前端代码两种模式完全一样 |
| 假账号 | 假后端预置几个管理员：超级管理员、客服、财务、内容审核员、必须改密码的、未绑定认证器的；假验证码只在假后端里生效，写进 README，不是密钥 |
| 假数据的语言 | 泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文都有，不只有中文（项目的市场规则）；测试结论里写明覆盖了哪些语言 |
| 请求层 | 只有一个文件判断 `code === "200"`；成功返回 `data`，失败抛 `ApiError{code,httpStatus,message,data}`；每个接口一个带类型的函数，放 `src/services/<模块>/` |
| 错误文字 | 用户看到的文字按 `error.<错误码>` 查语言文件（包括后端新增的 405 `METHOD_NOT_ALLOWED`、415 `UNSUPPORTED_MEDIA_TYPE`、503 `DEPENDENCY_UNAVAILABLE`、503 `TEMPORARILY_UNAVAILABLE`，其中后两个的界面文字要分别写成"依赖或配置此刻不可用"和"请求合法，稍后重试"）；负责人已定：错误码已知时界面只显示按码翻译的文字，不附后端 `message`，后端 `message` 只在码未知时作兜底。后端 2026-10-29 起的新错误形状（见各任务）也照此处理：同一个码在不同情形下需要不同说明时，说明取自页面自己知道的操作加后端给的结构化 `data` 字段（例如 `data.missingLanguages`、`data.defaultLocale`、`data.reasons`、`details[].ref`），不取自 `message`；确实只有 `message` 才讲得清的情形，写成 `docs/contract-requests/` 里的问题文件请后端给结构化字段，前端当前按最小做法（只显示按码翻译的通用文字）继续 |
| 令牌与会话 | 令牌只在内存和 `sessionStorage`；401 `ADMIN_INVALID_TOKEN` 清令牌并带回跳地址去登录页；403 `ADMIN_FORBIDDEN` 提示无权限、重新取 `/me` 的权限、不跳转；429 带整数 `data.retryAfterSeconds` 时写"N 秒后再试"，没有这个字段时（例如同一 IP 加用户名的登录限流）只用通用的稍后重试文字（后端的回答第 10 条） |
| 登录 | 流程按规格 3.1–3.3；绑定认证器的二维码在浏览器里用 `qrcode.react` 由 `otpauthUri` 生成，密钥不发给任何外部二维码服务 |
| 权限 | 权限码精确匹配、超级管理员全通；`src/access/permissionCodes.ts` 是唯一的码清单，由 grep 规格和契约生成并记录数量（规划时核对：契约与规格各 79 个 AvatarApp 权限码，集合相同）；路由、菜单、标签、页面内按钮用同一个判断 |
| 路由 | `config/routes.ts` 只做装配，每个模块一个路由文件，按规格的菜单顺序装配；路径和 `name` 逐行取自规格 5.0 表，`access` 的取法见下一行；脚本 `scripts/check-route-inventory.ts` 把 routes 和规格表对一遍，`access` 不应有任何不一致 |
| 规格与契约冲突时 | 接口、权限和路径以契约为准，路由 `access` 取该页面主读接口在契约里要求的码，每个写按钮取该写接口的码。订阅四页（读 `SUBSCRIPTION:VIEW`、写 `CONFIG`、重处理和已处理 `GRANT`）、审核内容区（`MODERATION:REVIEW`）、动作目录（无种类、无表情曲线）、`GET /config` 的写法、完整的 `MEMORY:` 权限码，规格已在 main 上按契约改好，计划按改后的规格；邮件模板和告警类型后端已多于规格和契约写的（规格写五个模板和 14 种告警，后端现在是六个模板和 18 种告警：见任务 13、28，变更请求在 `docs/contract-requests/2026-10-31-design-doc-changes-from-backend-d1.md` 和 `docs/contract-requests/2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md`，计划先按后端的现状做）；规格里仍然留着的冲突（埋点和记忆的接口路径与页面路由不同、价格页漏了撤回权限、生成任务的时间筛选、裂变层级的"链路节点数"、一级菜单清单漏了邮件模板、会话 / 订阅 / 客服详情和改密码页没有路由）列在"规格与契约的冲突"表，任务 32 交给你去改 |
| 无只读账号 | 规格 3.4 新增的规则：管理端不设只读账号，建角色时每个模块的查看权限和操作权限一起授予；前端不做任何拦截（角色编辑页保存时不检查），页面里的按钮仍各自按各自的权限码显示；权限模型和 `:VIEW` 码不变 |
| 详情的形式 | 会话、订阅、客服反馈、推送记录、照片投诉、站内通知的详情用抽屉（规格没给它们路由）；只有 `/users/:id` 和 `/moderation/:id` 是独立路由 |
| 菜单 | "邮件模板"单独一个一级菜单，位置在系统配置和短信管理之间（照 5.0 表的顺序；规格的一级菜单文字清单漏了它，记为规格内部不一致） |
| 标签页 | 自己写 TabManager，不做 keep-alive（切换标签会重新挂载页面）；标签列表存 `localStorage`，按当前权限过滤；总览固定不可关；"刷新"只重新加载该标签 |
| 语言 | 只有 zh-CN 和 en-US；初始语言取已保存的选择，否则取浏览器语言：任何 `zh` 开头归 zh-CN，其余归 en-US；键是扁平点分字符串，语言文件按模块拆开；有测试扫描源码里不经语言文件的文字 |
| 时间 | 时刻用 `Intl` 按浏览器时区显示；统计日是 UTC 的 `YYYY-MM-DD`，选哪天就发哪天、不做时区换算，页面标注 UTC；"默认昨天"按 UTC 算；签到、任务统计标注"用户本地日" |
| 文本规则 | 所有"去首尾空白"按契约 §1.9 的 29 个码点自己实现，不用 `String.trim`；管理端所有文本字段的长度先去空白、再按 Unicode 码点计（不是 UTF-16 长度，也不是字素），去空白后为空的必填字段后端返回 400，存的是去掉空白后的值——后端的回复已确认，前端预检用同一个口径 |
| 链接校验 | 一个 `validateServerLink`，规则是契约 §1.7，所有链接字段共用 |
| 主题 | dim、deep、light 三种模式，取值照规格 §7；模式存 `localStorage`；切换不刷新页面，图表跟着重绘；实心主色按钮的文字颜色按对比度自动选深色或白色；有对比度测试 |
| 构建变量 | `ADMIN_PRODUCT_NAME`、`ADMIN_LOGO_URL`、`ADMIN_PRIMARY_COLOR`、`ADMIN_PRIMARY_HOVER`、`ADMIN_PRIMARY_ACTIVE`、通话质量红框阈值 `ADMIN_QUALITY_MIN_SUCCESS_RATE`（0.95）和 `ADMIN_QUALITY_MAX_SLOW_SHARE`（0.05），开发期另有 `ADMIN_API_PROXY_TARGET`；默认值取规格 §7 和 §11，默认标志是仓库内的中性 SVG，不引外部地址；仓库不放密钥 |
| 前端读不到的配置值 | 页面需要、但编辑权限不属于该页权限的配置值（例如模板页要的 `app.supported_locales`），不写死数字：从 `GET /api/admin/meta` 取（后端已定：任何已登录、不在改密码状态的管理员可调，平铺对象 20 个字段：12 个配置值，没有默认值又未配置的键为 `null`；另 8 个上传限制，都是整数、不会是 `null`）；值为 `null` 或接口取不到（404，后端还没上线时）就不做前端预检、不显示数字，交给后端校验并原样展示后端错误 |
| 导出 | `fetch` 带 `Authorization`，先看状态码和内容类型再保存；失败的 JSON 展示给用户、绝不存成文件；显示已接收的字节数 |
| 上传限制的提前检查 | 六个上传入口（推送图片、服装 / 背景预览图和动作图标、广告素材、APK、渲染模型 zip、默认数字人源图）都在控件旁写出可接受的类型和限制（文件大小换算成 MB，像素换算成百万像素），选好文件后、上传之前检查类型、空文件、文件大小、图片宽×高，超限就在页面上说出是哪一项、限制多少、实际多少，不发请求；限制来自 `meta`（推送图片 `pushImageMaxBytes`，其余七个入口的八个字段见任务 7），`meta` 取不到某项时不检查那一项、把服务器返回的错误文字显示出来（服务器仍是最终把关，超限是 400 `INVALID_FILE`）；宽高只读图片文件头里的数字（PNG 的 IHDR 块、JPEG 的 SOF 段），绝不把整张图交给浏览器解码（一张声明几万乘几万像素的小图会让浏览器卡死） |
| 上传 | 先上传、后创建：`XMLHttpRequest` 的 multipart（要进度条），文件字段名一律 `file`（后台所有上传接口都是；缺少 `file` 时后端返回 400 `INVALID_REQUEST`，`details` 为 `[{ref:"file", reason:"EMPTY_NOT_ALLOWED"}]`），响应 `data.uploadId`；创建或修改时只提交 `uploadId`（目录用 `previewUploadId`、`iconUploadId`，渲染模型用 `uploadId`，默认数字人用 `sourceUploadId`），后端不认手填的地址、大小、校验和；上传中禁止提交；`uploadId` 的错误：种类不符 400 `INVALID_REQUEST`、已被别的对象用了 409 `INVALID_STATE`、不存在 404 `RESOURCE_NOT_FOUND`；`upload.public_base_url` 没配置时广告素材和 APK 上传返回 503 `DEPENDENCY_UNAVAILABLE`，页面提示先去系统配置里设置它 |
| 校验失败的文字 | `INVALID_REQUEST` 的 `data.details` 是 `[{ref, reason}]`，`reason` 是代码（接口文档新版 29 个：`ACCOUNT_NOT_FOUND`、`ACCOUNT_NOT_ACTIVE`、`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`、`INVALID_EMAIL`、`NOT_AN_INTEGER`、`OUT_OF_RANGE`、`NOT_BOOLEAN`、`INVALID_LANGUAGE_TAG`、`EMPTY_NOT_ALLOWED`，以及规则词表专用的 `INVALID_PATTERN`，这 14 个旧快照也有；新版另有 `RESOURCE_NOT_FOUND`、`DUPLICATE`、`INVALID_CHARACTER`、`INVALID_FORMAT`、`PACKAGE_NAME_NOT_CONFIGURED`、`SOURCE_EXPIRED`、`TOO_SLOW`、`TOO_MANY_EVENTS` 和 10.5 的 `REQUIRED`、`INVALID_TYPE`、`CONTROL_CHARACTER`、`IMMUTABLE`、`NOT_FOUND`、`DISABLED`、`CURRENCY_MISMATCH`）：界面文字按 `reason` 查语言文件（键 `reason.<代码>`），后端 `message` 里的英文说明只作兜底；`ref` 的含义由接口决定（配置是键、词表是数组下标、分页是参数名、上传是 `file`、账号列表是账号 ID、短信模板规则是固定词 `SmsTemplate`、投诉列表的状态筛选是参数名 `status`）；`ref` 对不到页面上任何一行或一个字段时（例如保存 `auth.phone_login_enabled` 时的 `SmsTemplate`），文字显示在提交的那一行或那个表单上，不丢；前端自己的链接校验用同一组代码，所以同一条文字两边共用 |
| 统计页 | 读汇总表；标注 UTC；"重新落地该日"需要 `STATS:LAND`；趋势图缺失日补 0；未到期的留存格显示"—"；去重人数不跨日相加；比率在浏览器里算，分母为 0 显示"—"（规格 4.4、5.2、5.13） |
| 配置键 | `src/pages/config/configSchema.ts` 每个键一项，键清单由 grep 契约 §17.5 的表得到（规划时 224 行），标签和说明进两个语言文件；`GET /config` 只返回当前管理员有权编辑的键，所以页面没有只读行；返回里不在 schema 里的键警告并只读，schema 里有而返回里没有的键（没有编辑权限）不显示、不警告；每行有"恢复默认"（`DELETE /config/{key}`，后端清掉这个键、回到代码里的默认值），行里显示 `updatedAt`、`updatedBy`（库里没有这个键的行时为 `null`，表示还是默认值）；`value` 为 `null` 表示没有默认值又未配置；后端有 26 个键已经出现在 `GET /config` 里、却还没有写进契约 §17.5 的表（更早的 7 个额外键加 2026-10-29 至 10-30 的 18 个新键，再加接口文档新版 11.2 的审核总开关 `moderation.model_check_enabled`，清单见任务 10；新版的键表正好比快照多这 26 个），它们在 `CONFIG_SCHEMA` 里有条目、放进检查脚本单独的"契约采纳前的后端额外键"清单，不落到"未识别的配置项"警告里，契约采纳后从清单里删 |
| 配置键的归属页面 | 224 个键里 160 个是 `CONFIG:MANAGE`，由 `/config` 渲染；其余 64 个键分属 10 个模块权限码（推送 12、审核 10、邀请 9、归因 9、广告位 9、订阅 8、养成 3、投诉 2、记忆 1、成本 1；另有契约采纳前的 26 个额外键，其中 `CONFIG:MANAGE` 20、`PUSH:CONFIG` 1、`ATTRIBUTION:MANAGE` 3、`MODERATION:CONFIG` 2，契约采纳后并入这些数），每个码的键由拥有它的模块页面用 `ConfigForm` 按权限码整组渲染——规格只给了养成管理、召回参数、奖励设置、归因参数、广告全局设置五处，审核（规则页）、订阅（功能开关页）、投诉、记忆（模型页）、成本（价格页）五个模块各加一段"参数"区，否则这些键只有 `CONFIG:MANAGE` 够得着 |
| 下拉选项来源的权限 | 后端已把七个选项来源接口对使用它的页面权限开放读取（`GET /roles` 对 `ADMIN:MANAGE`、`GET /cosmetics` 对 `COSMETIC:GRANT`、`GET /attribution/campaigns` 对 `ATTRIBUTION:VIEW`、`GET /ads/campaigns` 对 `ADS:UNIT` 和 `ADS:CREATIVE`、`GET /ads/placements` 对 `ADS:UNIT`、`GET /ads/units` 对 `ADS:CREATIVE`、`GET /entitlement-defs` 对 `SUBSCRIPTION:GRANT`）；选择器收到 403 仍然禁用并写明缺哪个权限，当作兜底 |
| 契约和后端都没写的点 | 目前没有：我们的 11 条问题和响应字段表后端已逐条回复（只有"无广告原因行加 `platform`"不采用，页面不显示这一列）；做的时候再发现两处文件都没有的接口，写成新的一份文件交给后端，不改后端的回复，也不自己猜 |
| 给后端的问题 | 第一份 `docs/contract-requests/2026-10-21-admin-frontend.md`（AvatarAdmin 提交 21b6773）已被后端回复，保持原样不再改；新问题写新的文件；任务 32 再加"规格需要在 main 上修改的地方"；我不改 AvatarApp 的文档，也不改后端的回复 |
| 评审深度 | 请求层、令牌与会话、权限判断与路由守卫、导出下载、凭据类字段（不回显）做深度评审；其余任务一次独立评审，不做复审轮次 |
| 任务顺序 | 任务 1–10 是地基，按顺序做；模块任务（11–31）彼此独立，依赖关系见"执行顺序"；任务 32 最后 |
| 时间预算 | 你确认本计划之后、动手之前，我按任务 1 实测的安装、构建、测试耗时给出预算，你确认后才开始写代码 |
| 完成标准 | 报告开头先写未修复项、记录项、未运行项、阻塞项的数量；规格 §12 的验收清单逐条跑完；没有占位页面 |

## Global Constraints

规格里全项目适用的要求，每个任务隐含包含：

- 响应成功判断 `code === "200"`；列表请求 `page`（从 1）、`pageSize`（选项 10/20/50/100，默认 20，后端上限 200），响应 `data.items`、`data.total`（规格 4.1）。
- 浏览器里不对密码做任何哈希；请求不带固定 token；不用 `window.open` 打开带参数的导出地址；401 / 403 / 429 分别处理（规格 §2"不照搬的做法"和关键设计点表的"错误处理"一行）。
- 不引外部 CDN 的字体、logo 或脚本；字体用系统字体栈（规格 §7）。
- 组件里不写死任何语言的文字；日期、数字、百分比用 `Intl`（规格 §6）。
- 时刻是 ISO-8601 UTC 字符串；统计日是 UTC 日历日 `YYYY-MM-DD`，签到与任务统计例外（规格 5.22，契约 §17.4）。
- 带 `reason` / `note` 的写操作，理由在表单里必填；封禁理由旁写明"这是写给用户看的文字，只有一种语言"（规格 4.2）。
- 行内删除 / 取消 / 重试用行内确认（Popconfirm，危险色），提示用顶部 `message` 不用 `notification`；一行的操作超过 3 个时显示前 2 个、其余收进"更多"（规格 4.3）。
- 链接字段一律走 `validateServerLink`；凭据类字段（短信渠道凭据、Facebook 访问令牌）永不回显，留空表示不修改（规格 5.13、5.18）。
- 被审核内容的文件地址和签名地址不写进日志、不放进可分享的 URL，每次查看重新取（规格 §8）。
- 页面需要、但编辑权限不属于该页权限的配置值，不写死数字，取法见关键设计点表"前端读不到的配置值"。
- 不留调试日志；需要日志时用同一个标签 `[avatar-admin]`。
- 复制文件用 `cp -p` 保留修改时间。
- 项目市场规则（AI-Avatar 项目 CLAUDE.md）：不把任何单一语言当默认；假数据和测试覆盖目标市场语言，只有中文样本时，结论里写明"只覆盖中文"。
- 仓库里不出现参照项目名或其他第三方产品名；不输出韩文。

## Review Focus

规格对这些输入没有逐条说，但最容易咬到真人，每条在拥有它的任务里有测试：

1. **导出 / 下载失败不能被存成文件**：429（每小时次数）、400（超行数）、403、令牌过期时后端回的是 JSON；要展示后端提示，不能把 JSON 存成 `.xlsx`（任务 3、8）。
2. **UTC 日边界**：新加坡的运营在本地 00:00–08:00 选"今天"或默认"昨天"，不能多一天或少一天；日期选择器选的日历日原样当作 UTC 日发出（任务 2、9）。
3. **空值和零分母**：`null` 的平台列、`activeSubscriptions=null`、未到期的留存格、分母为 0 的比率，一律显示"—"，不能出现 `0`、`NaN`、`Infinity`、`null%`（任务 2、9、17）。
4. **任意文字**：阿拉伯语（从右到左）、泰语（没有空格）、emoji 等 BMP 以外的码点、超长无空格字符串出现在反馈、审核文本、通知标题、规则词表里；表格不撑破、长度按码点数、首尾空白按 29 码点集合去掉（任务 2、8）。
5. **会话丢失和重复提交**：写操作提交途中令牌过期，登录后回到原页面且不会重复写；连点"通过 / 激活 / 封禁 / 发放"只发一次请求；收到 403 后按钮按新权限隐藏（任务 3、7、8）。

## 任务的统一写法

每个任务都是下面五步，下文各任务只写这五步里需要决定的内容（Tests、Implement 的签名与取值），不重复步骤本身：

- [ ] 步骤 1：写 Tests 里列的失败测试
- [ ] 步骤 2：运行这些测试，确认因为"功能不存在"而失败（不是因为拼写或配置错误）
- [ ] 步骤 3：按 Interfaces 和 Implement 实现
- [ ] 步骤 4：运行本任务的测试、`npm run lint`、`npm run tsc`，全部通过
- [ ] 步骤 5：提交（一个任务一个或几个提交，提交说明写这个任务做了什么）

测试只在本任务的文件范围内跑；全量测试和构建在任务 32 跑一次，之后某个修复只重跑它影响的测试。模块任务另有两条共同要求：
- 本模块的每个接口先读契约对应的节和后端的说明；两处都没写清的点（字段名、请求体、权限码）不自己猜：先查后端的两份文件（说明和回复），都没有就写一份新的问题文件（`docs/contract-requests/` 下，接口、字段、我们为什么需要），在任务报告里列出，本任务按最小的做法继续、不阻塞，后端回复后再改；
- 本模块的页面文字全部进 `src/locales/zh-CN/<模块>.ts` 和 `src/locales/en-US/<模块>.ts`，两边键相同。

## 后端的回复（4e1f538）和我们原来暂定做法的出入

后端对我们 11 条问题全部采用，字段名以它的回复为准，各任务的 Interfaces 已按它写。和我们原来的暂定做法有出入或补充的只有这些：

| 条目 | 后端定的 | 对前端的影响 |
|---|---|---|
| 管理员用户名 | 命名按我们的；`GET /config` 的 `updatedBy` 是管理员 ID，另有 `updatedByUsername`；用户名读取时按 ID 查，管理员已删除时用户名为 `null`、ID 照旧；审计日志的 `adminUsername` 是写入当时的用户名，不随改名变 | 显示用户名，为 `null` 时显示 ID 前 8 位；审计日志直接显示 `adminUsername` |
| 图片地址 | 响应不再返回存储引用；地址是短时效签名地址（有效期同审核内容地址），每次取列表都拿到新地址，文件缺失为 `null` | 不缓存地址，每次打开页面重新取列表；`null` 显示占位图 |
| 规则词表 | 请求体和响应都是 `{items:[…]}`，不是裸数组；整表替换、原子；带 `id` 且在当前词表里的沿用 `id`，其余是新增；`details.ref` 一律是数组下标（从 0 起的字符串）；正则不合法的原因代码是 `INVALID_PATTERN`；超过条数上限时 `details` 只有一项，`ref` 为 `items`、`reason` 为 `OUT_OF_RANGE` | 按下标把错误对到行；上限提示显示在整张表上 |
| 选项来源接口 | 七个（比我们提的多三个：`GET /ads/campaigns` 和 `GET /ads/units` 对 `ADS:CREATIVE`、`GET /entitlement-defs` 对 `SUBSCRIPTION:GRANT`） | 素材表单按计划、按单元选择，发放限时权益选权益，都不再需要额外权限 |
| 越界 | 分页参数和日期范围越界都是 400 `INVALID_REQUEST`，`details` 的 `ref` 是出错的参数名，原因 `OUT_OF_RANGE` 或 `NOT_AN_INTEGER`；不静默截断；`page` 缺省 1，`pageSize` 缺省 20 | 假后端同样这样做 |
| `GET /me`、`GET /api/admin/meta` | `me` 加 `id`、`passwordMinLength`，强制改密码状态下照常可调；`meta` 20 个字段，改密码状态下返回 403 | 登录后只在不需要改密码时才取 `meta` |
| 无广告原因行 | 仍是 `{statDate, slotKey, reason, cnt}`，不加 `platform`、`channelCode`；广告报表不传筛选时是全部平台、全部渠道的合计 | 规格 5.17 表里的"平台"列不显示（后端说明契约会话已同意把设计里的这一列删掉） |
| 默认数字人生成失败 | 回到 `DRAFT`，行里带 `failureReason`（六个值之一或 `null`），没有 `FAILED` 状态 | 和我们的暂定做法一致 |

后端已另交给改契约的会话去改契约和管理端前端设计；我们不用等，也不改它们。

## 后端的回答（2026-11-02）

后端对我们的 140 条问题逐条作了回答（`docs/backend-inputs/2026-11-02-avatar-backend-answers-to-avataradmin-questions.md`，下称"后端的回答"），并给出新版接口文档（`docs/backend-inputs/2026-11-02-backend-task-java-backend-e07469d1.md`）。后端这次没有改任何代码。计划这样使用它们：

- 后端的回答第一节列的 49 处"前端要改"已并入各任务的接口、请求体、错误、测试和界面文字，句末标出"后端的回答第 N 条"（N 是我们原来的问题编号）；原来按推测写的做法已经去掉，以后端实际行为为准。
- 后端的回答第二、三节是向后端提出的改动请求（建议做 33 项、建议不做 8 项）。后端还没有改，所以计划仍按后端现在的行为写，不把它们当作已存在；完整清单，以及后端做了之后前端要改什么，在 `docs/contract-requests/2026-11-02-requests-to-backend.md`。
- 后端的回答第四节列的 17 条没有完全核实的，计划按回答里写的保守做法处理，各任务里写明"未完全核实"；每条缺什么、怎么处理，在上面那个清单文件的"未完全核实"一节。
- 后端的回答第五节和各组汇总里"接口文档与后端代码互相矛盾"的地方，整理在 `docs/contract-requests/2026-11-02-contract-contradictions.md`，计划按后端代码的实际行为写；新版接口文档与旧快照的差别在 `docs/contract-requests/2026-11-02-contract-version-diff.md`。
- 新版接口文档已经把 2026-10-29 清单里的多项内容写进了契约（25 个契约采纳前的额外配置键、18 种告警类型、六个邮件模板、权限节点类型不可改、四类"只能授出自己持有的权限"等）。计划里写"契约采纳前"的地方，等快照换成新版之后，以新版为准：`check-config-keys` 脚本会按设计在额外键清单里的键出现在契约表时失败，提示从清单里删。这些差别和对前端的影响在 `docs/contract-requests/2026-11-02-contract-version-diff.md`。
- `docs/shared-snapshots/` 里的快照不改，由负责人整份替换；后端的回答里"接口文档第 N 行"指新版接口文档的行号。

## 规格与契约的冲突（规划时已逐行核对，以契约为准）

2026-10-21 后端的说明之前核对出 13 行冲突，其中 6 行（订阅四页的读权限、审核内容区、动作目录、`GET /config` 的写法、14 种告警、五个邮件模板）连同完整的 `MEMORY:` 权限码，AvatarApp main 上的规格已按契约改好，计划按改后的规格。规格里仍然留着的是下面 8 行；实现按契约做，每条在任务 32 的"规格需要在 main 上修改的地方"里列给你：

| 规格的位置 | 规格写的 | 契约写的 | 实现怎么做 |
|---|---|---|---|
| 5.0 埋点管理、记忆服务 | 接口栏写 `/analytics/*`、`/memory/*`，页面路由 `/analytics/summary`、`/analytics/detail` | 接口是 `/analytics/events`、`/event-summary`、`/event-names`、`/funnel`、`/funnels` 和 `/memory/tiers`、`/memory/embedding-models`，另有 `/accounts/{id}/memory`、`PUT /accounts/{id}/memory/embedding-model`（§17.4 通则明说页面路由不是接口路径） | 服务函数用契约的路径 |
| 5.0 价格 | 写权限漏了"撤回"（5.23 正文有） | 撤回也是 `COST:PRICE`（§17.4 成本行） | 撤回按钮要 `COST:PRICE` |
| 5.24 生成任务 | 筛选类型和时间 | 接口参数只有 `status`、`type` | 只按类型筛选，不做时间筛选 |
| 第 1 节一级菜单文字清单 | 清单里没有邮件模板 | — | 按 5.0 表的顺序，"邮件模板"单独一个一级菜单 |
| 5.0 通话 / 订阅 / 客服 | 写"会话列表、详情""订阅列表、详情""反馈列表、详情"，没给详情路由 | — | 详情用抽屉 |
| 5.12 裂变层级页签 | 统计项"链路节点数" | `GET /invites/depth-stats` 的 `totalChains` 是范围内不同根账号（没有邀请人的账号）的数量，不是节点数（§17.4 邀请管理行） | 页面显示"链数（根账号数）"，文字取契约的含义 |
| 3.3 改密码页 | "只允许进入改密码页"，没给路由 | — | 路由 `/user/change-password` 是本计划自己定的 |
| 5.17 广告报表的无广告原因分布表 | 列含"平台" | `GET /ads/report/nofill` 的行是 `{statDate, slotKey, reason, cnt}`，没有 `platform`、`channelCode`（后端回复第 18 条；后端说明契约会话已同意把设计里的这一列删掉） | 页面不显示平台列；广告报表有平台和渠道两个筛选（见任务 27），无广告原因行本身没有这两列 |

---

## 文件结构

```
AvatarAdmin/
  package.json  .npmrc  .gitignore  .editorconfig  biome.json  tsconfig.json  README.md  .env.example
  .husky/pre-commit  .lintstagedrc
  config/   config.ts  buildVars.ts  proxy.ts  routes.ts  routes/<模块>.ts（每个模块一个）
  mock/     _core/（store、http、auth、permissions、paginate、fixtures）  <模块>.mock.ts（每个模块一个）
  public/   logo.svg
  scripts/  check-route-inventory.ts  check-permission-codes.ts  check-config-keys.ts
  docs/     superpowers/plans/  contract-requests/
  src/
    app.tsx  access.ts  global.tsx
    access/        permissionCodes.ts  canAccess.ts
    request/       apiClient.ts  envelope.ts  errors.ts  session.ts  download.ts  upload.ts
    theme/         tokens.ts  modes.ts  chartTheme.ts  contrast.ts
    utils/         trimSpec.ts  codePoints.ts  linkRule.ts  utcDay.ts  ratio.ts  format.ts  resolveLocale.ts
    components/    layout/  stat/  PagedListTable  EllipsisPopoverText  RowActions  DangerConfirmButton
                   ReasonModalForm  LinkInput  UploadField  MaskedText  StatusTag  JsonField  Can  ExportButton
    services/<模块>/   types.ts  各接口函数
    pages/<模块>/
    locales/       zh-CN.ts  en-US.ts  zh-CN/<模块>.ts  en-US/<模块>.ts
  tests/           setup 与跨模块的扫描测试
```

模块目录名（`services/`、`pages/`、`mock/`、`locales/` 共用）：`auth`、`stats`、`config`、`companionship`、`subscriptions`、`credits`、`memory`、`monitor`、`support`、`avatar`、`complaints`、`moderation`、`users`、`sessions`、`analytics`、`dashboard`、`push`、`invite`、`activity`、`campaign`、`cost`、`ads`、`sms`、`email`、`appVersions`、`channels`、`notifications`、`clientConfig`、`system`。登录、绑定、强制改密码三个页面按规格的路由放在 `src/pages/user/`（单数），与管理员用户管理的 `src/pages/users/`（复数）是两个目录。

## 任务 1：脚手架、工具链、技术栈实测

**Files:**
- Create: `package.json`、`.npmrc`、`.gitignore`、`.editorconfig`、`biome.json`、`tsconfig.json`、`vitest.config.ts`、`tests/setup.ts`、`tests/stubs/umi-max.tsx`、`tests/stubs/plots.tsx`、`tests/withTimeZone.ts`、`config/config.ts`、`config/buildVars.ts`、`config/proxy.ts`、`config/routes.ts`（此时只有登录页占位路由，任务 4 重写）、`src/app.tsx`（最小）、`public/logo.svg`、`.husky/pre-commit`、`.lintstagedrc`、`.env.example`、`README.md`
- Test: `tests/smoke.test.tsx`

**Interfaces:**
- Produces（npm 脚本）：`dev:mock`（假后端开）、`dev:api`（`MOCK=none`，代理到 `ADMIN_API_PROXY_TARGET`）、`build`、`test`（`vitest run`）、`test:watch`、`lint`（`biome check`）、`tsc`（`tsc --noEmit`）、`check:routes`、`check:codes`、`check:config-keys`（三个脚本用 `tsx` 运行，任务 4、10 提供实现）；`postinstall` 跑 `max setup`，`prepare` 跑 `husky`。
- 依赖（精确版本以通过本任务构建和冒烟测试的锁文件为准；规划时试装通过的组合是：Umi Max 4.7.25、antd 6.6.7、React / React DOM 19.3.1、`@ant-design/pro-components` 3.1.14-7、`@ant-design/plots` 2.6.8、`@ant-design/icons` 6.3.4、dayjs 1.11.23、TypeScript 5.9.3、Vitest 4.1.10、happy-dom 20.14.6、Testing Library React 16.3.3、react-intl 12.1.5）；另加 `qrcode.react`、`tsx`、`cross-env`、Biome、husky、lint-staged、`@testing-library/jest-dom`、`@testing-library/user-event`，版本在安装时取当时的稳定版。Umi Max、pro-components、antd、React 用精确版本，不用 `^`。
- 工程约定：`.npmrc` 写 `legacy-peer-deps=true`（pro-components 的子包 `pro-layout`、`pro-table` 的 peer 仍只声明 antd 4/5，官方模板同样这样配置，README 里写明原因）；`config/config.ts` 带 `esbuildMinifyIIFE: true`（规划时实测：缺它时 `max build` 在 esbuild 辅助函数检查处失败）。

**规划时的实测（任务 1 的结果要和它对照，写进任务报告，时间预算用它们）:**
- 试装目录：安装 4 分 09 秒（1755 个包）；第一次构建 1 分 28 秒（因缺 `esbuildMinifyIIFE` 失败），加了之后第二次构建 29 秒通过；Vitest 冷启动 2 分 31 秒（导入占 135 秒），第二次 15 秒；Jest 加 Umi 测试预设单个测试 295 秒且先因 ESM 配置报错。
- 需要的环境：`npm_config_cache` 和 `TMP`、`TEMP` 指到 D 盘（C 盘快满）；Node 25.6.1 下构建和 Vitest 均可运行，Node 打印 `--localstorage-file` 警告，无害。

**Tests（`tests/smoke.test.tsx`）:**
- 渲染一个带 `useIntl` 文案、`ProTable`（一行数据）、`@ant-design/plots` 折线（桩）的组件，断言文案和表格内容出现。
- `withTimeZone('America/Los_Angeles', () => new Date('2026-10-21T17:30:00Z').getHours())` 得 10，`withTimeZone('Asia/Singapore', …)` 得 1；函数返回后时区还原。
- `localStorage` 与 `sessionStorage` 在测试环境里可读写，抛异常的版本（用 `vi.spyOn(Storage.prototype, 'setItem')`）能被后面任务的 try/catch 覆盖。

**Gate:** 依次运行并保存输出：`npm install`、`npm run build`、`npm test`、`npm run lint`、`npm run tsc`，并人工检查仓库文件里没有参照项目名或其他第三方产品名（任务 6 的扫描测试建好之后由测试负责）。**任何一项在锁定的版本组合上失败，停下来把错误报告给你，不静默换版本。** 通过后创建分支 `admin-frontend` 并在其上提交。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 2：纯函数工具（不依赖任何框架）

**Files:**
- Create: `src/utils/trimSpec.ts`、`codePoints.ts`、`linkRule.ts`、`utcDay.ts`、`ratio.ts`、`format.ts`、`resolveLocale.ts`，`src/utils/imageHeader.ts`、`uploadLimits.ts`，`src/theme/contrast.ts`
- Test: 同名 `*.test.ts`，放在各文件旁边

**Interfaces:**
- Produces:
  - `trimSpec(s: string): string`：去掉首尾属于契约 §1.9 那 29 个码点的字符，中间不动
  - `countCodePoints(s: string): number`；`lengthWithin(s: string, min: number, max: number): boolean`（先 `trimSpec` 再数码点）
  - `validateServerLink(value: string, opts?: { maxLength?: number }): { ok: true } | { ok: false; reasonKey: LinkReasonKey }`，`LinkReasonKey` 就是后端 `INVALID_REQUEST` 原因代码里与链接有关的那几个（`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`），界面文字取 `reason.<代码>`（语言文件里每个代码有文字），前端校验和后端校验共用同一条文字
  - `todayUtc(now?: Date): string`、`yesterdayUtc(now?: Date): string`、`lastNDaysUtc(n: number, now?: Date): { from: string; to: string }`、`pickedDay(d: Dayjs): string`（用选中的日历日的年月日，不经过时区）、`daysBetween(from: string, to: string): string[]`、`utcDayRangeToInstants(from: string, to: string): { from: string; to: string }`（把统计日范围 `[from, to]` 变成后端按时刻筛选的 `[from 当日 00:00:00Z, to 次日 00:00:00Z)`，`to` 不含，给 `GET /attribution/records` 这类按 `eventTime` 筛的接口用）
  - `safeRatio(n: number | null | undefined, d: number | null | undefined): number | null`（`d` 为 0 / 空 / 非有限数，或 `n` 为空 → `null`）、`formatPercent(r: number | null, locale: string, digits?: number): string`、`formatCount(n: number | null | undefined, locale: string): string`，空值一律返回导出的常量 `DASH`（`'—'`）
  - `readImageSize(file: Blob): Promise<{ format: 'PNG' | 'JPEG'; width: number; height: number } | null>`：只用 `Blob.slice` 读文件头——PNG 读开头的 IHDR 块，JPEG 按段长逐段往后找 SOF 段（`C0`–`CF`，除 `C4`、`C8`、`CC`，跳过 APPn 等段，分块读，最多读到文件的前 4 MiB），不是 PNG / JPEG 的签名或找不到时返回 `null`；**不调用任何会解码图片的浏览器接口**（`Image`、`createImageBitmap`、`canvas`）
  - `sniffFileKind(file: Blob): Promise<'PNG' | 'JPEG' | 'MP4' | 'ZIP' | null>`：读文件头前 12 字节按签名判类型（MP4 看偏移 4 处的 `ftyp`）
  - `type UploadKind = 'pushImage' | 'catalogImage' | 'adMedia' | 'apk' | 'rendererModel' | 'defaultAvatarSource'`；`UPLOAD_ENTRIES: Record<UploadKind, { endpoint: string; accept: readonly ('PNG' | 'JPEG' | 'MP4' | 'ZIP')[]; extensions?: readonly string[]; maxBytesField: keyof UploadLimitMeta; maxPixelsField?: keyof UploadLimitMeta }>`；`type UploadLimitMeta = { pushImageMaxBytes: number | null; uploadMaxBytes: number; adMediaMaxBytes: number; apkMaxBytes: number; renderAssetMaxBytes: number; catalogImageMaxBytes: number; catalogImageMaxPixels: number; adImageMaxPixels: number; defaultAvatarSourceMaxPixels: number }`（`AdminMeta` 在任务 7 里包含它，任务 2 不依赖任务 7）：推送图片 `/uploads/image`、JPEG / PNG、`pushImageMaxBytes`；目录图片 `/uploads/catalog-image`、JPEG / PNG、`catalogImageMaxBytes`、`catalogImageMaxPixels`；广告素材 `/ads/media`、JPEG / PNG / MP4、`adMediaMaxBytes`、`adImageMaxPixels`（只对图片）；APK `/uploads/apk`、ZIP 加扩展名 `.apk`、`apkMaxBytes`；渲染模型 `/uploads/renderer-model`、ZIP 加扩展名 `.zip`、`renderAssetMaxBytes`；默认数字人源图 `/uploads/default-avatar-source`、JPEG / PNG、`uploadMaxBytes`、`defaultAvatarSourceMaxPixels`
  - `checkUploadFile(kind: UploadKind, file: File, meta: Partial<UploadLimitMeta>): Promise<{ ok: true } | { ok: false; problem: 'EMPTY' | 'WRONG_TYPE' | 'TOO_LARGE' | 'TOO_MANY_PIXELS'; limit?: number; actual?: number }>`：依次查空文件、类型（按文件头签名和扩展名）、大小、像素（只对图片）；`meta` 里缺少或为 `null` 的限制字段，跳过对应那一项；`describeUploadLimits(kind: UploadKind, meta: Partial<UploadLimitMeta>, locale: string): { types: string; maxBytes?: string; maxPixels?: string }`（"2 MB"、"36 百万像素"这类显示用文字；缺失的项不出现）
  - `formatInstant(iso: string, locale: string): string`（`Intl.DateTimeFormat`，浏览器时区；解析不了就原样返回）、`formatBytes(n: number, locale: string): string`
  - `resolveInitialLocale(stored: string | null, browserLanguages: readonly string[]): 'zh-CN' | 'en-US'`
  - `contrastRatio(fg: string, bg: string): number`、`pickOnPrimary(primaryHex: string): string`（主色上深色文字 `#06201F` 与白色里对比度更高的一个）

**Tests:**
- `trimSpec`：29 个码点各自在首尾都被去掉；U+200B、U+FEFF 不被去掉；U+0085、U+001C–U+001F 被去掉（语言自带的 `trim` 做不到，用例里并排断言 `' x'.trim()` 与 `trimSpec` 的差别）；中间的空白不动。
- `lengthWithin`：emoji（BMP 以外）算 1 个码点；泰语组合符、阿拉伯语连字各自按码点数；`' a '` 在 `1..1` 内；全空白字符串长度为 0。
- `validateServerLink`：契约 §1.7 的每一条各一个正例和反例——大写 `HTTPS://`、前导空格、用户信息、空端口、6 位端口、IPv6 方括号（接受）、`xn--` 域名（接受）、Unicode 域名（拒绝）、路径含非 ASCII（拒绝并给"请百分号编码"类的原因 `INVALID_PATH`）、反斜杠、制表符、U+202E、总长 2048 与 2049（`TOO_LONG`）；每个拒绝用例断言得到的是上面五个原因代码之一。
- `readImageSize`：用手工拼出的字节构造 PNG（3000×2000）、基线 JPEG（SOF0）、渐进式 JPEG（SOF2）、SOF 前面有 70 KB 的 APP1（EXIF）段并要跨块读取的 JPEG、SOF 前面有 DHT（`C4`）的 JPEG 各一个，得到正确的宽高；被截断的文件、签名不对的文件得 `null`；一个只有约 100 字节却声明 60000×60000 的 PNG 立刻读出宽高，**且 `Image`、`createImageBitmap`、`canvas` 都没有被调用**（测试里把它们换成一调用就抛错的桩）；PNG 只读开头约 64 字节，对 `Blob.slice` 的调用记录显示请求的总字节数不超过 4 MiB。
- `sniffFileKind`：PNG、JPEG、MP4（偏移 4 处是 `ftyp`）、ZIP（`PK`）各一例，其他得 `null`。
- `checkUploadFile`：对六个入口各测一次边界——文件大小恰好等于上限通过、多 1 字节 `TOO_LARGE`（带 `limit` 和 `actual`）；图片宽×高恰好等于上限通过、多 1 个像素 `TOO_MANY_PIXELS`；PNG 声明 4294967295×4294967295 得 `TOO_MANY_PIXELS`（乘积超过 2^53 也不丢精度，用 BigInt 或先除再比较）；广告素材的 MP4 不做像素检查；APK 入口选 `.zip` 文件、渲染模型入口选 `.apk` 文件得 `WRONG_TYPE`；0 字节得 `EMPTY`；`meta` 里缺少 `catalogImageMaxPixels` 时只跳过像素检查、大小检查照常；`pushImageMaxBytes` 为 `null` 时跳过大小检查。
- `describeUploadLimits`：目录图片得类型 "JPEG / PNG"、"2 MB"、"36 百万像素"，两种语言的文字都存在；广告素材的像素提示注明"只对图片"。
- `utcDayRangeToInstants('2026-10-21','2026-10-21')` 得 `2026-10-21T00:00:00Z` 到 `2026-10-22T00:00:00Z`（`to` 不含），在两个时区下一样。
- `utcDay`：每个用例用 `withTimeZone('Asia/Singapore', …)` 与 `withTimeZone('America/Los_Angeles', …)` 各跑一遍（`tests/withTimeZone.ts` 在运行时设 `process.env.TZ` 并在结束后还原，本机实测有效；Shell 里的 `TZ=… node` 在 Git Bash 下不生效，不用）；`now = 2026-10-21T17:30:00Z`（新加坡已是 10-22 01:30）时 `todayUtc` 是 `2026-10-21`、`yesterdayUtc` 是 `2026-10-20`；`pickedDay(dayjs('2026-10-21'))` 在两个时区都是 `2026-10-21`；`lastNDaysUtc(7)` 含今天共 7 个日历日。
- `ratio`：分母 0、`null`、`NaN` 都得 `null`；`formatPercent(null)` 是 `'—'`；`0` 与 `null` 的显示不同（`0%` 对 `—`）；不会出现 `NaN`、`Infinity`、`null%`。
- `resolveInitialLocale`：已保存的合法值优先；`['zh-TW']`、`['zh-Hans-CN']`、`['zh']` → `zh-CN`；`['th-TH','en']`、`['ar']`、`[]` → `en-US`；保存值不合法时按浏览器语言。
- `contrast`：`contrastRatio('#FFFFFF','#0ABAB5')` 约 2.4（规格 §7 的算法核对）；`pickOnPrimary('#0ABAB5')` 返回 `#06201F` 且对比度不低于 4.5；换成深色主色时返回白色。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 3：请求层

**Files:**
- Create: `src/request/envelope.ts`、`errors.ts`、`session.ts`、`apiClient.ts`、`download.ts`、`upload.ts`、`src/locales/zh-CN/error.ts`、`src/locales/en-US/error.ts`（契约 §1.4 通用错误码表里每个码一条用户看得懂的文字，键是 `error.<码>`，另有 `error.NETWORK_ERROR`、`error.INVALID_RESPONSE`、`error.UNKNOWN`；表里包括后端新增的 405、415、503 两个；接口文档新版另加 413 `PAYLOAD_TOO_LARGE` 和 403 `FORBIDDEN`，两种语言的文字已先写好）、`src/locales/zh-CN/reason.ts`、`src/locales/en-US/reason.ts`（`INVALID_REQUEST` 的原因代码各一条文字，键是 `reason.<代码>`：旧快照的 14 个 `ACCOUNT_NOT_FOUND`、`ACCOUNT_NOT_ACTIVE`、`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`、`INVALID_EMAIL`、`NOT_AN_INTEGER`、`OUT_OF_RANGE`、`NOT_BOOLEAN`、`INVALID_LANGUAGE_TAG`、`EMPTY_NOT_ALLOWED`、`INVALID_PATTERN`，加接口文档新版 1.4 另列的 15 个 `RESOURCE_NOT_FOUND`、`DUPLICATE`、`INVALID_CHARACTER`、`INVALID_FORMAT`、`PACKAGE_NAME_NOT_CONFIGURED`、`SOURCE_EXPIRED`、`TOO_SLOW`、`TOO_MANY_EVENTS`、`REQUIRED`、`INVALID_TYPE`、`CONTROL_CHARACTER`、`IMMUTABLE`、`NOT_FOUND`、`DISABLED`、`CURRENCY_MISMATCH`）、`src/locales/errorCodes.generated.json`（由 `sed` 取 §1.4 表、`grep` 出第一列得到，保存原始输出和行数；生成脚本是 `scripts/gen-error-codes.ts`（`npm run gen:error-codes -- [接口文档路径]`），`scripts/contractErrors.ts` 的读表函数都接受接口文档的文本，路径不给时读 `docs/shared-snapshots/` 的快照，指定路径可读另一版文档）
- Test: 同名 `*.test.ts`、`src/locales/error.test.ts`（`errorCodes.generated.json` 里每个码在两个语言文件里都有非空文字）

**Interfaces:**
- Consumes: 任务 2 的 `resolveInitialLocale`（取当前语言写 `Accept-Language`）
- Produces:
  - `class ApiError extends Error { code: string; httpStatus: number; data: unknown; details: { ref: string; reason: string }[] }`；网络失败的 `code` 是 `NETWORK_ERROR`，响应不是 JSON 信封的是 `INVALID_RESPONSE`；`details` 取自 `data.details`（没有则为空数组）；`describeError(e: ApiError, t: (key: string) => string): { text: string; fields: { ref: string; text: string }[] }`：`text` 取 `error.<code>`，每个 `details` 项取 `reason.<reason>`，查不到时退回后端 `message`（英文）
  - `type Page<T> = { items: T[]; total: number }`
  - `apiRequest<T>(o: { method: 'GET'|'POST'|'PUT'|'DELETE'; url: string; params?: Record<string, unknown>; body?: unknown; signal?: AbortSignal }): Promise<T>`：返回信封的 `data`；`params` 里 `undefined`、`null`、`''` 丢弃，数组原样交给调用方先 `join`
  - `getToken(): string | null`、`setToken(t: string)`、`clearToken()`（内存加 `sessionStorage`，读写都包 try/catch，存储不可用时只用内存）
  - `setSessionHandlers(h: { onExpired: () => void; onForbidden: () => void })`
  - `downloadFile(o: { url: string; params?: Record<string, unknown>; fallbackName: string; onProgress?: (bytes: number) => void }): Promise<{ filename: string; bytes: number }>`
  - `uploadFile<T>(o: { url: string; file: File; fields?: Record<string, string>; onProgress?: (loaded: number, total: number) => void; signal?: AbortSignal }): Promise<T>`
- 任务 5 起所有 `services/*` 只通过这里发请求。

**Tests（打桩 `globalThis.fetch` 和 `XMLHttpRequest`）:**
- 成功信封返回 `data`；HTTP 200 但 `code` 不是 `"200"` → 抛 `ApiError`；请求带 `Authorization: Bearer <token>`、`Accept-Language`。
- 401 且 `code=ADMIN_INVALID_TOKEN` → 清令牌、调用 `onExpired` 一次（并发的多个 401 只触发一次）；401 `ADMIN_INVALID_CREDENTIALS`、`ADMIN_TOTP_REQUIRED`、`ADMIN_TOTP_INVALID` 不触发 `onExpired`，只抛错（登录页要靠它们工作）。
- 403 `ADMIN_FORBIDDEN` → 调用 `onForbidden`、抛错；429 → `ApiError`，`code` 是 `RATE_LIMITED`；`fetch` 抛异常 → `NETWORK_ERROR`；响应体不是 JSON → `INVALID_RESPONSE`。
- `downloadFile`：200 且内容类型是 xlsx → 触发保存，文件名取 `Content-Disposition`（含 `filename*=UTF-8''` 的非 ASCII 名）；429、400、403 的 JSON 体 → 抛 `ApiError`（带后端 `code`、`message`）且**没有触发保存**；401 → 走 `onExpired`；200 但内容类型是 `application/json` → 当错误处理；`onProgress` 收到累计字节数。
- `uploadFile`：进度回调；信封解析与 `apiRequest` 一致；带授权头；401 走 `onExpired`；`abort` 能取消；请求体是 `FormData`，浏览器会带上长度（后端对没有声明长度的 multipart 上传，鉴权和权限检查之后才答 400 `INVALID_REQUEST`，前端因此不需要处理这个情形，也不为它写界面文字）。
- 403 `ADMIN_FORBIDDEN` 的处理不依赖是哪条规则拒绝的：后端对管理员权限、角色的新授予规则（任务 31）和别的权限不足都答同一个码、`data` 为 `null`，请求层照常调用 `onForbidden`、抛错，页面按自己知道的操作说明原因（不读 `message`）。
- `setToken` 在 `sessionStorage` 抛异常时不崩溃，且令牌**没有**写进 `localStorage`。
- `describeError`：`INVALID_REQUEST` 带 `details: [{ref:'privacyPolicyUrl', reason:'NOT_HTTPS'}]` 时，`fields` 里该项的文字取 `reason.NOT_HTTPS` 的本地化文字而不是后端英文；`reason` 不认识时退回后端 `message`；两种语言下旧快照的 14 个原因代码和接口文档新版另列的 15 个都有非空文字（`src/locales/error.test.ts` 另用 `docs/backend-inputs/` 里的新版文档检查新版 1.4 表的 81 个错误码和 29 个原因代码，快照换成新版之后不会因文字缺失失败）；`error.<码>` 缺失时用 `error.UNKNOWN` 加后端 `message`。
- 原因代码另有两个（后端的回答第 75 条）：成本批量录入会返回 `NEGATIVE`（金额为负）和 `TOO_MANY_DECIMALS`（金额超过两位小数），接口文档 `INVALID_REQUEST` 一行的清单里没有它们。共用的 `reason.*` 只放接口文档清单里写了的原因代码（有测试守着这一点），所以这两个码的译文先放在批量导入对话框自己的语言文件里，不进 `reason.*`，上面"14 个"的断言不变；等接口文档把它们写进 `INVALID_REQUEST` 一行之后，再挪进 `reason.*` 并把断言改成 16 个。清单外的原因代码仍退回后端 `message`，不显示别的内容。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 4：权限码、权限判断、路由装配、菜单

**Files:**
- Create: `src/access/permissionCodes.ts`、`src/access/canAccess.ts`、`src/access.ts`、`src/locales/zh-CN/permission.ts`、`src/locales/en-US/permission.ts`（每个权限码一条名称，键是 `permission.<码>`，权限树页和角色编辑用）、`config/routes.ts`、`config/routes/<模块>.ts`（所有模块，初始 `export default []`）、`scripts/check-route-inventory.ts`、`scripts/check-permission-codes.ts`
- Test: `src/access/canAccess.test.ts`、`config/routes.test.ts`、`src/locales/permission.test.ts`

**Interfaces:**
- Produces:
  - `PERMISSION_CODES: readonly string[]` 与 `type PermissionCode`；文件头注释写生成它的 grep 命令、日期、行数（规划时的独立核对：契约和规格各 79 个 AvatarApp 权限码，集合相同；契约里另有 3 个引用参照项目的码出现在"依据"说明里，不是本项目的码，要排除；`MEMORY:MODEL_REGISTER`、`MEMORY:MODEL_ASSIGN`、`USER:EMAIL_VIEW`、`USER:PHONE_VIEW` 不在规格 5.0 表里，但在规格正文里，要入表）
  - `canAccess(me: { superAdmin: boolean; permissions: readonly string[] } | undefined, code: string | undefined): boolean`：`code` 为空 = 只需登录；超级管理员恒真；其余精确匹配，不做前缀或通配
  - `src/access.ts`：Umi 的 `access` 工厂，返回用 `Proxy` 包装的对象，路由的 `access` 字符串就是权限码
  - `type AdminRoute = { path: string; name?: string; icon?: string; component?: string; access?: PermissionCode; routes?: AdminRoute[]; redirect?: string; layout?: false }`
  - `config/routes.ts` 按规格的菜单顺序装配：登录、绑定、改密码（无布局）→ 根路径重定向到 `/dashboard` → 各模块路由文件 → 404；菜单顺序就是数组顺序
  - `filterMenu(routes: AdminRoute[], can: (code?: string) => boolean): AdminRoute[]`：没有可见子项的父菜单也隐藏

**Implement:**
- 生成权限码：在规格第 3–5 节和契约 §17.3、§17.4、§22.9、§23.6、§24.2、§25.7、§26.3、§28 里 grep 反引号内形如 `[A-Z_]+(:[A-Z_]+)+` 的词，保存原始输出和数量（规划时是 82 个词）；去掉契约"依据"说明里引用参照项目的 3 个权限码（两个带参照项目前缀、一个是 `SMS:SEND_RECORD:EXPORT`，它们不是本项目的码），其余全部入表，结果必须是 79 个；与规划时的核对不一致就停下来查原因。
- `scripts/check-route-inventory.ts <规格路径>`：解析规格 5.0 表（73 行，跳过没有页面路由的"导出"那一行），列出每行的页面路由和 `access`，与 `config/routes/*` 装配结果对比，输出缺失、多余、`access` 不一致，任何一项不为零都算错误（订阅四页的 `access` 规格已按契约改成 `SUBSCRIPTION:VIEW`，不再有例外）；`scripts/check-permission-codes.ts <规格路径> <契约路径>`：重新 grep，与 `PERMISSION_CODES` 对比。这两个脚本在任务 32 跑；各模块任务用 `npm run check:routes -- <规格路径>` 看自己那一块。
- 各模块的路由文件在各自任务里填；任务 4 只建空文件和装配，保证后面的任务互不修改同一个文件。

**Tests:**
- `canAccess`：精确匹配；`USER:VIEW` 不匹配 `USER:VIEW_ALL` 或 `USER`；超级管理员通过任意码；`code` 为空只需 `me` 存在；`me` 为空一律假。
- `filterMenu`：父菜单的子项全部无权限时父菜单隐藏；只有一个子项有权限时父菜单显示。
- `config/routes.test.ts`：每个带 `access` 的路由，值都在 `PERMISSION_CODES` 里；没有两个路由同一个 `path`；带 `name` 的路由都有 `component` 或 `routes`；根路径重定向到 `/dashboard`；`/users/abuse` 排在 `/users/:id` 之前。
- `permission.test.ts`：`PERMISSION_CODES` 里每个码在两个语言文件里都有非空名称，反过来语言文件里没有多出来的码。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 5：假后端核心与认证接口

**Files:**
- Create: `mock/_core/store.ts`、`http.ts`、`auth.ts`、`permissions.ts`、`paginate.ts`、`fixtures.ts`、`mock/auth.mock.ts`、`mock/system.permissions.mock.ts`
- Test: `mock/_core/*.test.ts`、`mock/auth.mock.test.ts`

**Interfaces:**
- Produces:
  - `ok<T>(data: T)` / `fail(httpStatus, code, message, data?)` 生成契约 §1.3 的信封
  - `guard(perm: PermissionCode | PermissionCode[] | null, handler)`：校验令牌（无效或过期 → 401 `ADMIN_INVALID_TOKEN`）、`mustChangePassword` 时除 `me` 和改密码外一律 403 `ADMIN_FORBIDDEN`、缺权限 → 403 `ADMIN_FORBIDDEN`、成功后交给 handler；handler 里可取 `req.admin`
  - `paginate<T>(rows: T[], page: number, pageSize: number): Page<T>`（`page` 从 1，`pageSize` 超过 200 时 400 `INVALID_REQUEST`，后端已确认：分页参数越界返回 400 `INVALID_REQUEST`，`details` 为 `[{ref: 参数名, reason: OUT_OF_RANGE 或 NOT_AN_INTEGER}]`，缺省 `page` 1、`pageSize` 20）
  - `fixtures`：`multilingualSamples`（泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文各若干条，含长串无空格和 emoji），`makeUuid()`，`daysAgoIso(n)`
  - 预置管理员（用户名、权限集合）：`root`（超级）、`support`、`finance`、`reviewer`、`newhire`（`mustChangePassword`）、`fresh`（未绑定认证器）；假验证码 `000000`；假密码写进 README 并注明只对假后端有效
  - 接口：`POST /api/admin/auth/login`、`POST /api/admin/auth/totp/enroll`、`POST /api/admin/auth/change-password`、`GET /api/admin/me`（响应 `{id, username, superAdmin, mustChangePassword, permissions, passwordMinLength}`，强制改密码状态下照常可调）、`GET /api/admin/meta`（平铺对象，20 个字段（12 个配置值加 8 个上传限制），任何已登录且不在改密码状态的管理员可调，在改密码状态返回 403 `ADMIN_FORBIDDEN`；值取契约 §17.5 对应键的默认值，没有默认值的键为 `null`）、`GET /api/admin/permissions`（权限树，由 `PERMISSION_CODES` 和路由元数据生成：每个页面一个 `MENU` 节点，该页面的其余权限码是它的 `FUNCTION` 子节点，名称取自任务 4 建的 `src/locales/{zh-CN,en-US}/permission.ts`，假后端用相对路径导入它们）

**Implement:**
- 假后端文件只用相对路径导入（Umi 的 mock 加载器不一定解析 `@/` 别名）；`config/config.ts` 的 `mock: { exclude: ['mock/_core/**', 'mock/**/*.test.ts'] }`，避免工具文件和测试文件被当成接口文件加载。
- 每个模块的假后端文件导出 Umi 约定的 `{ 'METHOD /api/admin/path': handler }` 对象，handler 用 `guard` 包住。

**Tests（直接调用 handler，不起服务器）:**
- 契约 §17.2 的每个分支：密码错 → 401 `ADMIN_INVALID_CREDENTIALS`；已停用的管理员同样；已绑定未带 `totp` → 401 `ADMIN_TOTP_REQUIRED`；验证码错 → 401 `ADMIN_TOTP_INVALID`；未绑定 → 200 `ENROLL_REQUIRED`（带 `enrollToken`、`otpauthUri`）；`enroll` 验证码错 → `ADMIN_TOTP_INVALID`；`enroll` 成功返回令牌；`change-password` 成功后旧令牌失效。
- 验证码连续错误的锁定（后端的回答第 10 条）（上限 `admin.totp_max_failures` 默认 5 次，锁 `admin.totp_lockout_minutes` 默认 5 分钟）：第 1 到第 5 次错误验证码都答 401 `ADMIN_TOTP_INVALID`（第 5 次本身仍是 401，不是 429）；锁生效后，只有密码正确才答 429 `RATE_LIMITED`，带整数 `data.retryAfterSeconds`（至少 1，为锁的剩余时间）和相同值的 `Retry-After` 头，没带 `totp` 也是 429（不再是 `ADMIN_TOTP_REQUIRED`）；密码错误仍答 401 `ADMIN_INVALID_CREDENTIALS`（和平时一样，不暴露锁的存在）；`enroll` 一步第 5 次错误仍答 401 `ADMIN_TOTP_INVALID`，同时这个 `enrollToken` 作废，之后再用它（验证码对也一样）答 401 `ADMIN_INVALID_TOKEN`，绑定一步从来不答 429，令牌作废后再用用户名密码登录会答 429；另有同一 IP 加同一用户名（忽略大小写）的登录限流，429 没有 `data`、没有 `Retry-After`，在校验密码之前判断。契约 §1.4 只把用户登录锁定、用量接口、导出最小间隔列为带 `retryAfterSeconds`，后端代码另给管理员二次验证锁定也带（两边不一致，列在 `docs/contract-requests/2026-11-02-contract-contradictions.md`），前端两种形状都能处理。
- `me`：普通管理员返回其权限码；超级管理员返回全部内置码；`mustChangePassword` 的管理员调其他接口 → 403 `ADMIN_FORBIDDEN`。
- `guard`：无令牌 / 篡改令牌 → 401；缺权限 → 403；`paginate` 的边界（`pageSize=201`、`page=0`）。
- 权限树：节点数等于权限码数；每个 `FUNCTION` 节点的 `parent` 是存在的 `MENU` 节点。

**Gate（除了上面的单元测试，还要经过真实的 Umi 开发服务器）:** 后台启动 `npm run dev:mock`，用返回命令（不是 sleep）等到服务就绪，再用 `curl` 依次请求：无令牌的 `GET /api/admin/me` 得 401 信封；`POST /api/admin/auth/login`（`root` 加假密码，假验证码）得令牌；带令牌的 `GET /api/admin/me` 得全部 79 个权限码（`root` 是超级管理员）；然后停掉服务。保存输出。这一步证明 mock 加载器真的加载了这些文件。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 6：主题、语言基础设施、外壳

**Files:**
- Create: `src/theme/tokens.ts`、`modes.ts`、`chartTheme.ts`；`config/buildVars.ts`、`src/buildVars.ts`；`src/components/layout/TabManager.tsx`、`ThemeSwitch.tsx`、`LangSwitch.tsx`、`HeaderDropdown.tsx`；`src/pages/403.tsx`、`404.tsx`；`src/locales/zh-CN.ts`、`en-US.ts`（聚合）及 `zh-CN/<模块>.ts`、`en-US/<模块>.ts`（所有模块各建一个空对象文件）、`zh-CN/pages.ts`、`en-US/pages.ts`（共用文案）；`tests/noHardcodedText.test.ts`；改 `src/app.tsx`、`config/config.ts`
- Test: `src/theme/modes.test.ts`、`src/components/layout/TabManager.test.tsx`、`src/locales/parity.test.ts`、`tests/noHardcodedText.test.ts`

**Interfaces:**
- Consumes: 任务 2 的 `pickOnPrimary`、`resolveInitialLocale`；任务 4 的 `canAccess`、`filterMenu`
- Produces:
  - `type ThemeMode = 'dim' | 'deep' | 'light'`；`getModeTokens(mode: ThemeMode): ModeTokens`；`useThemeMode(): [ThemeMode, (m: ThemeMode) => void]`（存 `localStorage`，读写 try/catch，切换只改 ConfigProvider 的 token，不刷新页面）
  - `getChartTheme(mode: ThemeMode): ChartThemeConfig`（色板 `#0ABAB5, #3B82F6, #A78BFA, #F59E0B, #EC4899, #94A3B8`，涨 `#22C55E`、跌 `#EF4444`）
  - `buildVars`：`productName`、`logoUrl`、`primary`、`primaryHover`、`primaryActive`（默认值取规格 §7）
  - 语言文件键规则：扁平点分；`menu.<路由 name>[.<子 name>]`、`permission.<权限码>`、`error.<错误码>`、`link.error.*`、`pages.*`（共用文案，规格 §6）；各模块 `<模块>.<字段>`
  - `TabManager` 属性：`{ routes: AdminRoute[]; can: (code?: string) => boolean; locale: string; children: ReactNode }`

**Implement:**
- 三种模式的取值照规格 §7（dim 容器 `#1C2D3E`、背景 `#15202B`；deep 容器 `#0F2329`、背景 `#0A171B`；light 容器 `#FFFFFF`、背景 `#FAFAFA`）；侧边栏 240、顶栏 56、内容区内边距 24、圆角 12/16/8、字号 14；实心主色元素的文字色用 `pickOnPrimary`。
- 外壳：侧边栏布局，顶栏右侧依次是语言切换、主题切换、头像菜单（改密码、退出登录）；退出登录清令牌和标签缓存后回登录页；页面标题与 logo 取 `buildVars`。
- `config/config.ts` 必须有 `esbuildMinifyIIFE: true`（任务 1 的实测：缺它时构建在 esbuild 辅助函数检查处失败）、`hash: true`、`locale: { default: 'en-US', antd: true, baseNavigator: false }`（初始语言自己用 `resolveInitialLocale` 决定）、`access`、`model`、`initialState`、`antd`、`layout`；开发期 `proxy` 读 `ADMIN_API_PROXY_TARGET`。
- `tests/noHardcodedText.test.ts`：用 TypeScript 编译器 API 扫 `src/**/*.tsx`，找 JSX 文本节点和 `title`、`label`、`placeholder`、`content`、`message` 这类属性里含字母或 CJK 的字符串字面量，允许清单在 `tests/noHardcodedText.allow.json`（每项写原因）；同一个测试文件再扫整个仓库（不含 `node_modules`、`dist`、`docs`）里的 `token=123`、`md5`、`cdn.`、`https://` 开头的外部地址（`localhost` 和 `docs` 除外）、参照项目名；被禁止的产品名在测试文件里拆成两段字符串拼接（避免扫描文件自己被命中）；这个扫描从任务 6 起就在单元测试里，所以后面每个模块一落地就被检查。

**Tests:**
- `modes`：三种模式的容器色和背景色等于规格值；对每种模式，正文色对背景色与容器色的对比度都不低于 4.5；主色按钮文字（`pickOnPrimary`）对主色不低于 4.5。
- `TabManager`：访问路由 → 出现标签；总览标签没有关闭按钮；关闭其他 / 全部 / 左侧 / 右侧各自只留下该留的；刷新只改被刷新标签的 key（子组件重新挂载，其余标签的子组件不重新挂载）；刷新后从 `localStorage` 恢复标签列表；恢复时按当前权限过滤（没有权限的标签被丢掉）；切换语言后标签标题更新；`localStorage` 抛异常时不崩溃。
- `parity`：`zh-CN` 与 `en-US` 的键集合相同；没有空值；每个带 `name` 的路由都有 `menu.<name>` 键；每个权限码都有 `permission.<码>` 键（路由和权限码此时可能还不全，测试对"已存在的"做检查，任务 32 再整体收紧）。
- `noHardcodedText`：在一个故意含硬编码文字的临时 fixture 上能报出；在仓库当前代码上通过。
- 无权限：已登录但没有路由 `access` 的管理员直接访问该地址，得到带权限提示的 403 页，不是空白；超级管理员和有权限的管理员正常进入。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 7：登录、绑定认证器、强制改密码、会话流程

**Files:**
- Create: `src/pages/user/login/index.tsx`、`src/pages/user/enroll/index.tsx`、`src/pages/user/change-password/index.tsx`、`src/components/layout/ChangePasswordModal.tsx`、`src/session/useSession.ts`、`src/session/returnUrl.ts`、`src/services/auth/*.ts`、`config/routes/auth.ts`、`src/locales/*/auth.ts`
- Modify: `src/app.tsx`（`getInitialState`、路由守卫、`setSessionHandlers`）
- Test: 同名 `*.test.tsx` / `*.test.ts`

**Interfaces:**
- Consumes: 任务 3 的 `apiRequest`、`setToken`、`setSessionHandlers`；任务 4 的 `canAccess`；任务 6 的外壳
- Produces:
  - `login(body: { username: string; password: string; totp?: string }): Promise<LoginResult>`，`LoginResult = { token: string; expiresAt: string } | { status: 'ENROLL_REQUIRED'; enrollToken: string; otpauthUri: string }`（线上格式，契约 §17.2：成功时 `data` 就是 `{token, expiresAt}`，没有 `status`；只有绑定分支带 `status`，用 `'token' in r` 区分；任务 5 的假后端同样不给成功响应加 `status`）；`enrollTotp(body: { enrollToken: string; totp: string })`；`changePassword(body: { oldPassword: string; newPassword: string })`；`getMe(): Promise<{ id: string; username: string; superAdmin: boolean; mustChangePassword: boolean; permissions: string[]; passwordMinLength: number }>`（后端已定，字段名以它的回复为准；真后端还没上线、字段缺失时按缺失处理，不报错）
  - `type AdminMeta = { supportedLocales: string[] | null; landIntervalMinutes: number | null; allowedCurrencies: string[] | null; deletionAlertAfterFailures: number | null; inviteChainMaxDepth: number | null; maxRecipients: number | null; pushImageMaxBytes: number | null; statsMaxRangeDays: number | null; analyticsLiveMaxRangeDays: number | null; abuseClusterMinFreeAccounts: number | null; attributionClickRetentionDays: number | null; declarationRequired: boolean | null; uploadMaxBytes: number; adMediaMaxBytes: number; apkMaxBytes: number; renderAssetMaxBytes: number; catalogImageMaxBytes: number; catalogImageMaxPixels: number; adImageMaxPixels: number; defaultAvatarSourceMaxPixels: number }`（后端回复第 1 条的十二个字段加第三份回复新增的八个上传限制字段，一字不差；八个上传限制是整数、不会是 `null`，其中 `catalogImageMaxBytes`（2097152）、`catalogImageMaxPixels`（36000000）、`adImageMaxPixels`（36000000）、`defaultAvatarSourceMaxPixels`（250000000）是固定值，`uploadMaxBytes`、`adMediaMaxBytes`、`apkMaxBytes`、`renderAssetMaxBytes` 取自 `upload.max_bytes`、`upload.ad_media_max_bytes`、`upload.apk_max_bytes`、`upload.render_asset_max_bytes` 的当前值；`supportedLocales`、`allowedCurrencies` 是字符串数组，`declarationRequired` 是布尔，其余是整数；没有默认值又未配置的键为 `null`）
  - `getAdminMeta(): Promise<AdminMeta>` 与 `useAdminMeta(): Partial<AdminMeta>`：登录后、且 `me.mustChangePassword` 为假时取一次（在改密码状态后端返回 403）；请求失败（含真后端还没有这个接口时的 404）得到空对象；某项为 `null` 或缺失，页面都按"前端读不到的配置值"处理（不预检、不显示数字），不报错
  - `safeReturnUrl(raw: string | null | undefined): string`：只接受以单个 `/` 开头的站内路径（拒绝 `//host`、`http://…`、`javascript:`、含反斜杠），否则返回 `/dashboard`
  - `useSession()`：`{ me, refreshPermissions(), signOut() }`

**Tests:**
- 登录：初始没有验证码框；收到 `ADMIN_TOTP_REQUIRED` 后出现，并用同一份账号密码加验证码重新提交；`ADMIN_TOTP_INVALID` 提示并清空验证码框，提示文字写明"如果确认验证码没有输错仍然失败，请联系超级管理员重置二次验证"（后端在库里存的二次验证密钥解不开时，也答 401 `ADMIN_TOTP_INVALID`，并和输错验证码一样计入锁定次数；前端分不出这两种情形，恢复办法是有权限的超级管理员对该管理员做"重置二次验证"）；`ADMIN_INVALID_CREDENTIALS` 提示"账号或密码错误"；`ENROLL_REQUIRED` 进入绑定页，`enrollToken` 在内存里、**不在 URL 里**；成功后令牌在 `sessionStorage`、**不在 `localStorage`**，并调用 `getMe`，然后跳到 `safeReturnUrl`。
- 连点登录按钮只发一次请求（Review Focus 5）。
- 登录页的锁定提示（后端的回答第 10 条）：页面不假定第 5 次错误验证码就被锁（那一次仍是 401 `ADMIN_TOTP_INVALID`），也不因为得到 401 就写"账号没有被锁"（锁定期间密码错误同样是 401 `ADMIN_INVALID_CREDENTIALS`）；429 带整数 `data.retryAfterSeconds` 时显示"N 秒后再试"（数字用 `Intl` 格式化），没有这个字段时显示通用的稍后重试文字，不显示倒计时；绑定一步错误验证码超过次数后得到 401 `ADMIN_INVALID_TOKEN`（不是 429），页面清掉内存里的 `enrollToken`、回到登录第一步，登录页不显示"验证码错误"。测试：带 `retryAfterSeconds` 的 429 与不带的 429 各一例，锁定期间 401 `ADMIN_INVALID_CREDENTIALS` 一例，绑定页 401 `ADMIN_INVALID_TOKEN` 回登录页一例。
- `safeReturnUrl`：`/users/42?tab=x` 原样；`//evil.example`、`https://evil.example`、`javascript:alert(1)`、`/\evil` 都得 `/dashboard`。
- 绑定页：二维码是本地生成的（渲染结果里没有任何 `http` 开头的 `img` 地址，也没有对外部域名发请求）；验证码错提示并保留 `enrollToken`；`enrollToken` 过期（401 `ADMIN_INVALID_TOKEN`）回登录页；待确认的密钥在后端解不开时同样答 401 `ADMIN_INVALID_TOKEN` 并且这个 `enrollToken` 作废：两种情形页面都清掉内存里的 `enrollToken`、回登录页重来，登录页不显示"验证码错误"（假后端有一个触发它的账号，测试两种触发原因得到同一结果）。
- 强制改密码：`mustChangePassword` 为真时，访问任何其他路由都被重定向到改密码页；前端校验两次一致、不等于用户名、非空，`me.passwordMinLength` 有值时再校验长度（按码点数），没有值时长度错误由后端 `INVALID_REQUEST` 的 `message` 展示；成功后清令牌回登录页。
- `getAdminMeta` 返回 404 或网络失败时，`useAdminMeta()` 得到空对象，页面不崩溃、不弹错误；`me.mustChangePassword` 为真时**不发** `meta` 请求；`meta` 里某项是 `null` 时，使用它的页面按"读不到"处理（用一个 `maxRecipients: null` 的例子断言不预检）。
- 会话：收到 401 `ADMIN_INVALID_TOKEN` 清令牌并跳 `/user/login?redirect=<当前路径>`；登录后回到该路径；收到 403 `ADMIN_FORBIDDEN` 提示无权限、不跳转、`refreshPermissions` 被调用一次，之后按钮按新权限显示；不用定时器轮询（后端的权限变更在所有实例的下一次请求生效，缓存服务不可用时最长 `admin.permission_cache_seconds` 后生效，所以"进入应用取一次、403 时重取一次"够用，前端不加轮询或倒计时，也没有新接口、字段或错误码）。
- 写操作途中令牌过期（Review Focus 5）：提交请求得到 401，页面跳登录，登录后回到原页面；原请求**没有被自动重发**。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 8：共用界面组件

**Files:**
- Create: `src/components/PagedListTable.tsx`、`EllipsisPopoverText.tsx`、`RowActions.tsx`、`DangerConfirmButton.tsx`、`ReasonModalForm.tsx`、`LinkInput.tsx`、`LinkTargetField.tsx`、`UploadField.tsx`、`MaskedText.tsx`、`StatusTag.tsx`、`JsonField.tsx`、`Can.tsx`、`ExportButton.tsx`、`src/hooks/useSingleFlight.ts`、`src/utils/screenTargets.ts`
- Test: 同名 `*.test.tsx`

**Interfaces:**
- Consumes: 任务 2 的工具；任务 3 的 `apiRequest`、`downloadFile`、`uploadFile`、`Page`、`ApiError`
- Produces:
  - `PagedListTable<T, F>`：属性 `{ rowKey; columns; request: (p: { page: number; pageSize: number } & F) => Promise<Page<T>>; toolbar?; defaultCollapsed?: true }`；内部把 `Page<T>` 适配成 ProTable 的 `{ data, total, success }`；分页选项固定 10/20/50/100，默认 20
  - `useSingleFlight<A extends unknown[], R>(fn: (...a: A) => Promise<R>): { run: (...a: A) => Promise<R | undefined>; pending: boolean }`：执行中再次调用直接忽略
  - `DangerConfirmButton`：属性 `{ confirmText; onConfirm: () => Promise<void> }`，确认中禁用
  - `ReasonModalForm`：属性 `{ open; title; reasonLabel; min?: number; max?: number; hint?: ReactNode; onSubmit: (reason: string) => Promise<void>; onClose }`；理由先 `trimSpec`，再按码点数检查 `min..max`（默认 1..500）；提交失败保持打开并展示 `ApiError.message`
  - `LinkInput`：antd Form 控件，规则用 `validateServerLink`，出错文字取 `link.error.*`
  - `SCREEN_TARGETS: readonly string[]`（`src/utils/screenTargets.ts`）：契约 §8.3 的页面标识清单，推送、站内通知、广告素材的"页面"目标共用这一份（规划时 9 个：`conversation`、`companion`、`store`、`credits`、`settings`、`notifications`、`subscription`、`checkin`、`daily_tasks`；执行时按契约当时的清单为准）；`LinkTargetField`：属性 `{ value: { linkType: 'NONE' | 'SCREEN' | 'URL'; linkTarget: string }; onChange }`，`SCREEN` 时目标是 `SCREEN_TARGETS` 的下拉，`URL` 时目标走 `LinkInput`，`NONE` 时目标为空串
  - `UploadField<T extends { uploadId: string }>`：属性 `{ kind: UploadKind; onUploaded: (r: T) => void; onBusyChange: (busy: boolean) => void }`；端点、可接受的类型和限制都从任务 2 的 `UPLOAD_ENTRIES[kind]` 和 `useAdminMeta()` 取；控件旁常显示限制行（`describeUploadLimits`：类型、最大多少 MB、最大多少百万像素）；选好文件后先 `checkUploadFile`，不通过就在控件下说出是哪一项（类型不对、空文件、文件太大、图片像素太多）、限制多少、实际多少，**不发请求**；通过才上传。上传端点（都是 `multipart/form-data`、字段 `file`、响应 `data.uploadId`）的权限：`/uploads/catalog-image` 要 `COSMETIC:MANAGE` 或 `ACTION:MANAGE`，`/uploads/renderer-model` 要 `RENDERER:MANAGE`，`/uploads/default-avatar-source` 要 `DEFAULT_AVATAR:MANAGE`；服务器仍是最终把关：400 `INVALID_FILE`（空文件、超限、按内容判出的类型不符；默认数字人源图经服务器处理后仍大于 19,000,000 字节也是它，前端预检不了）、503 `DEPENDENCY_UNAVAILABLE`（`upload.public_base_url` 没配置）都按 `describeError` 显示
  - `MaskedText`：原样显示后端给的掩码值，不尝试还原，旁边可放"需要 X 权限才能看完整值"的提示
  - `Can`：`<Can code="USER:BAN">…</Can>`，用 `useAccess`
  - `ExportButton`：属性 `{ name: string; params: Record<string, unknown>; viewCode: PermissionCode }`；只有同时持有 `STATS:EXPORT` 和 `viewCode` 才渲染（其他导出按各页自己的码，用 `requiredCodes` 属性覆盖）；请求 `GET /api/admin/stats/export/{name}`（或传入的 `url`），显示已接收字节数

**Tests:**
- `PagedListTable`：请求参数 `page` 从 1；返回 `{items,total}` 被正确适配；分页选项是 10/20/50/100；先发的慢请求晚于后发的快请求返回时，旧结果被丢弃；请求失败显示错误状态和后端 `message`，不崩溃；空结果显示空状态。
- `EllipsisPopoverText`：点击展开后能看到完整文字；复制按钮写入完整文字；阿拉伯语、泰语长串、emoji、一个 5000 字符无空格串都不报错，且元素带 `word-break` / `overflow-wrap` 样式（Review Focus 4）。
- `useSingleFlight` 与 `DangerConfirmButton`：连点两次只调用一次 `onConfirm`（Review Focus 5）。
- `ReasonModalForm`：全空白理由（含 U+3000、U+00A0）被拒；501 个码点被拒、500 个通过；500 个 emoji 通过（按码点数）；提交失败保持打开并显示后端文字；提交中按钮禁用。
- `LinkInput`：每种 `reasonKey` 都显示本地化文字，不显示键本身。
- `LinkTargetField`：三种类型各自序列化正确；`SCREEN` 的下拉恰好是 `SCREEN_TARGETS`；切换类型时清空目标。
- `UploadField`：对六个 `kind` 各测一次——超限的文件（大小、像素各一例）不触发任何 `XMLHttpRequest`，页面文字写明哪一项超限、限制和实际各是多少；限制行里的数字来自 `meta`，换一组 `meta` 值文字随之变化；`meta` 为空对象时不显示数字、不做检查、上传照常发出，服务器返回 400 `INVALID_FILE` 时显示它的文字；预览图只在检查通过之后才生成。
- `UploadField`：上传中 `onBusyChange(true)`，完成或失败后 `false`；失败按 `describeError` 显示（400 `INVALID_FILE`、503 `DEPENDENCY_UNAVAILABLE` 各一例）；成功回调带 `uploadId`；表单提交时后端判 `uploadId` 已被别的对象用了（409 `INVALID_STATE`）、种类不符（400 `INVALID_REQUEST`）或不存在（404 `RESOURCE_NOT_FOUND`），表单提示"请重新上传文件"并清掉这个 `uploadId`，不重发。
- `RowActions`：3 个操作全显示；4 个显示前 2 个加"更多"。
- `ExportButton`：没有 `STATS:EXPORT` 不渲染；成功触发保存；429 / 400 / 403 显示后端提示且**不保存文件**（Review Focus 1）；显示进度字节数。
- `JsonField`：非法 JSON 时给出错误并向父表单报告"不可提交"。
- `Can`：无权限时子节点不渲染，超级管理员恒渲染。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 9：统计共用组件与统计接口

**Files:**
- Create: `src/services/stats/types.ts` 以及契约 §17.6 报表接口表里每个接口一个函数文件（`daily`、`retention`、`reactivation`、`guestDaily`、`guestCohort`、`guestRetention`、`guestQuota`、`sessionQuality`、`push`、`usageCost`、`checkinDailyUsers`、`checkinStreakBuckets`、`tasksSummary`、`tasksDaily`）、`land.ts`、`export.ts`；`src/services/channels/getChannels.ts`（`GET /channels`，任何登录的管理员可调）和 `src/components/ChannelSelect.tsx`（渠道包下拉，供各统计页、目录、投放账户用）；`src/components/stat/StatCard.tsx`、`TrendChart.tsx`、`RetentionMatrix.tsx`、`RetentionTrendChart.tsx`、`LandBar.tsx`、`ReportHelper.tsx`、`UtcNotice.tsx`、`DateRangeUtc.tsx`、`PlatformChannelFilter.tsx`；`mock/stats.mock.ts`、`mock/channels.mock.ts`（预置 `play`、`direct`、`appstore` 三行，写接口留给任务 29）、`config/routes/stat.ts`（空）、`src/locales/*/stats.ts`
- Test: 同名测试

**Interfaces:**
- Consumes: 任务 2 的 `daysBetween`、`safeRatio`、`DASH`、`yesterdayUtc`、`pickedDay`；任务 6 的 `getChartTheme`；任务 8 的 `ExportButton`、`Can`
- Produces:
  - 每个报表函数形如 `getDaily(p: { from: string; to: string; platform?: string; channel?: string }): Promise<{ items: StatDailyRow[] }>`；行类型字段取契约 §17.6 汇总表的列名，可空列的类型含 `null`；`getGuestQuota` 例外，响应是单个对象（契约 §17.6 报表接口表）
  - `landStat(name: LandName, date: string): Promise<void>`，`LandName` 是契约 §17.6 补数一节列的名字的联合类型
  - `fillMissingDays<T extends { statDate: string }>(rows: T[], from: string, to: string, zero: (statDate: string) => T): T[]`
  - `StatCard` 属性 `{ title; value: number | null; previous?: number | null; previousLabel: string; unit?: 'count' | 'percent' | 'percentPoint'; tip?: ReactNode }`
  - `TrendChart` 属性 `{ rows; xField: 'statDate'; series: { field: string; label: string; dashed?: boolean }[]; from; to }`（内部调用 `fillMissingDays`，缺的日子补 0）
  - `RetentionMatrix` 属性 `{ rows: RetentionRow[]; days: number[] }`；单元格空值显示 `DASH` 而不是 `0%`
  - `LandBar` 属性 `{ name: LandName | LandName[]; onLanded: () => void }`：只对持有 `STATS:LAND` 的管理员渲染；日期默认 `yesterdayUtc()`；多个名字时依次调用
  - `ReportHelper` 属性 `{ pageKey: string }`，文字键 `stat.<pageKey>.helper.title` / `.content`；关闭状态存 `localStorage` 的 `reportHelper:<pageKey>`，读写 try/catch
  - `DateRangeUtc` 属性 `{ value: { from: string; to: string }; onChange: (v: { from: string; to: string }) => void; maxDays?: number; refused?: unknown }`：选中的日历日经 `pickedDay` 原样当作 UTC 日；`maxDays` 来自 `useAdminMeta()`（统计页用 `statsMaxRangeDays`，埋点现查页用 `analyticsLiveMaxRangeDays`），选出的范围超过它时给出提示且不触发查询，没有 `maxDays` 时不限制、交给后端
  - `DateRangeUtc` 的 `refused`（新版 17.6）：页面把读取失败时的错误对象传进来；错误是 400 `INVALID_REQUEST`、`details` 里有 `ref` 为 `from` 或 `to` 的项时，控件下面写一行红字（按原因和日期翻译，不附后端的 `message`，`data-testid="stat-range-error"`），控件标成错误状态；别的 `ref` 不在这里写，仍由页面的失败条显示。所有统计页（日报、留存、游客四个页签、通话质量、通话分析、推送、额度、订阅、审核、邀请两页、广告报表、成本报表、投放效果、归因汇总、签到和任务统计）都传 `refused`。`useFailure()` 另返回 `error`（交给 `fail` 的那个错误）供页面传入。文字键 `stat.common.range.*`。
  - `PlatformChannelFilter` 属性 `{ value: { platform: string; channel: string }; onChange; withPlatform?: boolean }`（平台 `ALL`/`ANDROID`/`IOS`，渠道包取自 `getChannels`）；`UtcNotice`：无属性，显示"统计日按 UTC 计算"

**Tests:**
- `DateRangeUtc`：用 `withTimeZone('Asia/Singapore', …)` 和固定时钟，本地 10 月 22 日 01:30（此时 UTC 还是 10 月 21 日）：手动在日历上选 10 月 22 日，发出 `2026-10-22`（原样，不做时区换算）；点预设"今天"发出的是 UTC 的今天 `2026-10-21`，点"昨天"发出 `2026-10-20`；范围超过 `maxDays` 时提示且不触发查询；`maxDays` 缺失时不限制。
- `fillMissingDays`：缺失的日子补出全 0 行，按日期升序，不重复；`from > to` 返回空数组。
- `StatCard`：上涨 / 下跌用涨 `#22C55E`、跌 `#EF4444`；`previous` 为 `null` 或 0 时变化显示 `DASH`；`percentPoint` 显示"百分点"而不是"%"；值为 `null` 显示 `DASH`。
- `RetentionMatrix`：空值格显示 `DASH`，有值为 0 的格显示 `0%`（两者不同）；基数为 0 的行百分比显示 `DASH`。
- `LandBar`：没有 `STATS:LAND` 不渲染；默认日期是 UTC 昨天（用 `withTimeZone('Asia/Singapore', …)` 与固定时钟断言）；点击发 `POST /stats/land/{name}?date=`，成功后调用 `onLanded`；失败显示后端文字。
- `ReportHelper`：关闭后刷新仍关闭；`localStorage` 抛异常时照常显示且不崩溃。
- `TrendChart`：随主题模式切换用新主题重绘（断言传给图表的配置变化）。
- `mock/stats.mock.ts`：`/stats/daily` 在 `platform≠ALL` 时业务列为 `null`；`activeSubscriptions` 当天为 `null`；`/stats/retention` 未到期的 `dN` 为 `null`；`from/to` 跨度超过 `stats.max_range_days` 返回 400 `INVALID_REQUEST`（后端已确认：分页参数和日期范围越界都是 400 `INVALID_REQUEST`）；缺 `STATS:VIEW` 返回 403；`POST /stats/land/*` 缺 `STATS:LAND` 返回 403。
- 所有统计接口的日期范围（新版 17.6；假后端共用 `mock/_core/statRange.ts` 的 `rangeOf`，导出也共用）：两个日期都不给取到今天为止的最近 7 天；只给一个时另一个取相隔 6 天，最晚到今天（所以只给的 `from` 晚于今天时终点早于起点，按 `from` 晚于 `to` 处理）；先检查格式（`from` 在前）：不是真实的日历日或年份小于 1 → 400 `INVALID_REQUEST`，`ref` 是该参数，原因 `OUT_OF_RANGE`（message `<ref> must be YYYY-MM-DD`）；然后 `from` 晚于 `to` → `ref` 为 `from`（"from is after to"）；然后跨度超过 `stats.max_range_days` → `ref` 为 `to`（"The range exceeds stats.max_range_days"）。页面总是同时发两个日期，默认范围取 7 天（游客队列、留存 30 天）和 `useAdminMeta().statsMaxRangeDays` 中较小的，所以首次读取不会被上限拒绝（归因汇总页的选择器没有上限提示，仍是 7 天）；当天未过完的日子照旧标"临时值"，与范围规则无关。测试：`mock/_core/statRange.test.ts`（一个日期、无日期、空值、年份边界、检查顺序、上限为 5 时默认范围被拒）和 `src/pages/statRangeRefusal.test.tsx`（上限设为 3 天而页面不知道时，二十个统计页都把 `to` 的拒绝写在日期控件下，英文和中文；页面被告知上限为 3 天时，首次读取不超过 3 天且不被拒）。

- [ ] 步骤 1–5 按"任务的统一写法"

## 任务 10：配置键 schema、配置表单、系统配置页、养成管理页

**Files:**
- Create: `scripts/check-config-keys.ts`、`src/pages/config/configSchema.ts`、`configKeys.generated.json`、`ConfigForm.tsx`、`index.tsx`、`src/pages/companionship/index.tsx`、`src/services/config/*.ts`、`mock/config.mock.ts`、`config/routes/config.ts`、`config/routes/companionship.ts`、`src/locales/*/config.ts`、`src/locales/*/companionship.ts`
- Test: 同名测试

**Interfaces:**
- Consumes: 任务 3、8
- Produces:
  - `type ConfigKind = 'int' | 'string' | 'bool' | 'json' | 'url'`；`type ConfigKeySpec = { key: string; kind: ConfigKind; editPermission: PermissionCode; group: string; min?: number; max?: number; risk?: boolean; relatedKeys?: string[]; editedElsewhere?: string; validate?: (v: unknown) => string | null }`；`CONFIG_SCHEMA: ConfigKeySpec[]`；`CONFIG_PRE_ADOPTION_KEYS: string[]`（契约采纳前的后端额外键，见 Implement；`relatedKeys` 是保存时后端会互相检查的键，两个键的行上都显示同一条关系提示）；`editedElsewhere` 是该键有专门编辑器的页面路径（目前只有 `moderation.text_rules` → `/moderation/rules`，契约 §17.5 写明它也可通过 `/moderation/text-rules` 编辑）：`ConfigForm` 把这样的键显示为只读并附链接，不提供第二个编辑器
  - 线上格式（后端的说明）：`GET /config` → `{ items: ConfigItem[] }`，`ConfigItem = { key: string; value: unknown | null; defaultValue: unknown | null; editPermission: PermissionCode; updatedAt: string | null; updatedBy: string | null; updatedByUsername: string | null }`（`updatedBy` 是管理员 ID，页面显示 `updatedByUsername`，为 `null` 而 `updatedBy` 非空时显示 ID 前 8 位），不分页、按键名升序，只含当前管理员有权编辑的键；`PUT /config/{key}` 请求体 `{ value }`；`DELETE /config/{key}` 清掉这个键、回到默认值；
  - `listConfig(): Promise<{ items: ConfigItem[] }>`、`saveConfig(key: string, value: unknown): Promise<ConfigSaveResult>`、`resetConfig(key: string): Promise<ConfigSaveResult>`，`ConfigSaveResult = { key: string; value: unknown; warnings: { code: string; message: string; count?: number }[] }`（`count` 只有 `PHONE_LOGIN_DISABLED_ACCOUNTS` 带；`resetConfig` 的 `warnings` 为空数组）；三个接口里键不存在 404 `RESOURCE_NOT_FOUND`，没有该键的编辑权限 403 `ADMIN_FORBIDDEN`，值不合法 400 `INVALID_REQUEST`（`details` 的 `ref` 是键、`reason` 是原因代码）
  - `ConfigForm`：属性 `{ keys?: string[]; prefixes?: string[]; editPermission?: PermissionCode }`（三个筛选取并集；都不传渲染 `GET /config` 返回的全部键），按前缀分组渲染；保存一次一个键；这是系统配置页和所有模块"参数"区共用的渲染方式

**Implement:**
- 键清单的取法（规划时 224 行；执行时重跑，以当时的 §17.5 为准，数量写进任务报告）：
  ```bash
  sed -n '/^### 17.5/,/^### 17.6/p' <契约路径> | grep -E '^\| `[a-z_.]+`' | tee keys.raw.txt | wc -l
  ```
  从原始输出生成 `configKeys.generated.json`（键、编辑权限列）；`CONFIG_SCHEMA` 每一项对应其中一行，类型按"默认值"列和 §17.5 的取值校验一段判断，`editPermission` 取"编辑权限"列；schema 里**不存默认值**（默认值只以 `GET /config` 返回的 `defaultValue` 为准，一个量只有一个来源），范围校验取 §17.5 开头的取值校验一段，标签和说明键为 `config.<键>.label` / `config.<键>.desc`，两种语言都写；六个需要写明风险的键（规格 5.15）带 `risk: true` 并取契约说明列的文字。
- `CONFIG_HOSTS: Record<PermissionCode, string>`：每个出现在 schema 里的非 `CONFIG:MANAGE` 的 `editPermission`（规划时 10 个）对应承载它的页面路径——`COMPANIONSHIP:CONFIG`→`/companionship`、`PUSH:CONFIG`→`/push/recall`、`INVITE:CONFIG`→`/invite/rewards`、`ATTRIBUTION:MANAGE`→`/campaign/settings`、`ADS:PLACEMENT`→`/ads/placements`、`MODERATION:CONFIG`→`/moderation/rules`、`SUBSCRIPTION:CONFIG`→`/subscriptions/gates`、`COMPLAINT:MANAGE`→`/complaints/likeness`、`MEMORY:MODEL_REGISTER`→`/memory/models`、`COST:PRICE`→`/cost/prices`；各页面任务在页面里放一段 `<ConfigForm editPermission="…" />`，不挑键，该码的键整组渲染。
- `scripts/check-config-keys.ts <契约路径>`：重新 grep，与 `configKeys.generated.json` 和 `CONFIG_SCHEMA` 的键集合比较，任务 32 跑。
- 契约采纳前的后端额外键（后端的 `GET /config` 已经返回它们、管理员可编辑，契约 §17.5 的表里还没有，对契约原文逐个 grep 得 0 次；类型、范围、编辑权限取自后端 2026-10-29 清单，默认值不进 schema）：`CONFIG_SCHEMA` 为每个键加一项，`label` 和 `desc` 两种语言都写，键名放进 `CONFIG_PRE_ADOPTION_KEYS`，不落到"未识别的配置项"警告里。共 26 个：25 个来自后端清单，1 个来自接口文档新版（见下面的"审核总开关"）：
  - 更早的 7 个：`push.task_poll_seconds`（整数，最小 1，`PUSH:CONFIG`）、`memory.call_timeout_seconds`（整数，最小 1，`CONFIG:MANAGE`）、`attribution.postback_enabled`（布尔，`ATTRIBUTION:MANAGE`）、`attribution.facebook_graph_version`（字符串，匹配 `^v[0-9]{2}\.[0-9]$`，`ATTRIBUTION:MANAGE`）、`ratelimit.events_per_ip_per_minute`（整数，最小 1，`CONFIG:MANAGE`）、`chat.moderation_concurrency`（整数 1 到 32，`CONFIG:MANAGE`）、`chat.moderation_deadline_ms`（整数 100 到 2500，`CONFIG:MANAGE`）。
  - 第一批交付的整数键，编辑权限都是 `CONFIG:MANAGE`：`chat.moderation_global_concurrency`（1 到 512，说明里写明是每个应用实例各自的上限，不是整个集群共用）、`export.parallelism`（1 到 4）、`ratelimit.apk_download_per_ip_per_min`、`ratelimit.push_image_per_ip_per_min`、`ratelimit.ad_media_per_ip_per_min`（三个都是最小 1、无上限）、`analytics.funnel_max_concurrency`（1 到 32，说明里写明超出时漏斗请求答 429，按实例计数）、`integrity.app_attest_max_keys_per_device`、`ratelimit.app_attest_challenge_per_ip_per_hour`、`ratelimit.app_attest_key_per_ip_per_hour`（三个都是最小 1、无上限）。
  - 布尔开关：`integrity.app_attest_unsupported_allowed`（`CONFIG:MANAGE`；说明写明关闭后不能使用设备校验的 iPhone 创建游客凭据和新账号）、`events.store_client_ip`（`CONFIG:MANAGE`）、`ads.store_client_ip`（`CONFIG:MANAGE`）、`attribution.store_click_ip`（编辑权限是 `ATTRIBUTION:MANAGE`，不是 `CONFIG:MANAGE`；说明写明关闭后自建归因的"指纹匹配"对新点击不再生效，安装只能靠点击编号归因，带 `risk: true`）。
  - 数据保留天数，整数，最小 0（0 表示不删除或保留到账号删除，说明按键写明）：`chat.message_retention_days`（0 或不小于 32，且大于 `stats.land_window_days`，两个键互为 `relatedKeys`）、`voice.source_sample_retention_days`、`guest.device_retention_days`（0 或不小于 91 加 `stats.land_window_days`，与它互为 `relatedKeys`；说明写明设得太短会让游客额度被绕过，带 `risk: true`）、`support.feedback_retention_days`（以上编辑权限 `CONFIG:MANAGE`）、`moderation.record_retention_days`（编辑权限是 `MODERATION:CONFIG`，不是 `CONFIG:MANAGE`；待复核的记录永不删）。保存时的关系校验由后端做，前端不预先校验，失败时 `details` 里写出两个键，两行都显示错误。
  - 审核总开关 `moderation.model_check_enabled`（接口文档新版 11.2、17.5；布尔，默认 `true`，编辑权限 `MODERATION:CONFIG`）：对所有内容类型（文字、人设、伴侣名字、聊天消息、照片、声音样本、生成的标准图和动作片段）打开或关闭对外部审核服务的调用。说明写明关闭的后果：从不调用审核服务，模型这一层一律按通过处理，文字仍检查运营维护的规则词表（判拦截的照常拒绝、判复核的仍进复核），生成的标准图和动作片段也不被审核、直接按通过落地，即使 `moderation.generated_output_review` 开着；说明也写明打开之后要同时已注册审核服务、并且保存了 `moderation.block_score` 与 `moderation.review_score` 两个分数才会运行模型检查，缺任何一个都不调用服务、不报错；保存后下一次检查生效，不需要重启。`moderation.block_score`、`moderation.review_score` 的说明改成新版的行为（任一分数未保存时不调用审核服务，不报错、不返回 503，文字仍过规则词表，其他内容放行；旧快照写的"生产环境未配置时用户端接口 503"不再成立），`moderation.generated_output_review` 的说明补"总开关关闭时这一项查不出东西"。这个开关不带 `risk`（`risk` 只有 7 个键）。
  - `scripts/check-config-keys.ts` 另检查：额外键清单里的键不能出现在契约表里（出现了说明契约已采纳，失败并提示从清单里删）；`CONFIG_SCHEMA` 的键集合恰好等于契约表的键加这份清单。脚本的接口文档路径可省略（省略时读快照），也可指定另一版文档：用接口文档新版跑，输出 26 行"is in the contract now"（正好是这份清单的 26 个键）和 26 行"generated file is missing"（`configKeys.generated.json` 要用 `npm run gen:config-keys -- <路径>` 重新生成），没有关于 schema 的提示；`scripts/configKeysAdoption.test.ts` 用新版文档断言这一点。
- 接口文档新版对已有键的范围调整（schema 的 `min`、`max` 和假后端同步改）：`upload.max_bytes`、`upload.push_image_max_bytes`、`upload.ad_media_max_bytes`、`upload.render_asset_max_bytes`、`upload.apk_max_bytes` 为整数 1 到 536870912（512 MiB）；`notification.max_recipients` 为整数 1 到 10000；`events.ttl_days` 必须不小于 `31 + stats.land_window_days`（默认窗口 3，所以默认下限是 34，旧快照是 30 加窗口）；`recall.*` 和 `push.schedule_catchup_minutes` 的范围上面已写。
- `admin.totp_required`：生产环境保存 `false` 是 400 `INVALID_REQUEST`（接口文档新版 17.2、17.5，契约没有写 `details`）；数据库里已经是 `false` 时生产环境照常启动。系统配置页该行保存失败时显示 `error.INVALID_REQUEST` 的按码翻译的文字，不附后端 `message`；说明写明生产环境不能保存为关闭。假后端默认按生产环境答（`mock/_core/configStore.ts` 的 `deployEnv.production`，测试可以关掉），非生产环境允许保存 `false`；`integrity.check_enabled` 任何环境都可保存 `false`。
- 三个已有键的范围变了：`recall.window_minutes`、`recall.scan_interval_minutes` 现在是整数 1 到 1440（契约表里没有上限），`push.schedule_catchup_minutes` 是整数 1 到 10080；schema 的 `min`、`max` 按这个写。`push.schedule_catchup_minutes` 与 `push.task_poll_seconds` 有保存规则 `push.schedule_catchup_minutes × 60 ≥ 600 + push.task_poll_seconds`（保存或恢复默认任一个键时都检查），两个键互为 `relatedKeys`，两行上都写出这条规则作提示，两个值都在表单里时按当前值算出最小值（默认值下催补分钟数至少是 11）；违反时后端答 400 `INVALID_REQUEST`，`details` 先写保存的键、再写另一个键，原因都是 `OUT_OF_RANGE`，两行都显示错误；保存在这些范围收紧之前的值继续有效，直到该键再被保存。
- 保存被拒时 `data` 里新增的结构化字段用来填按码翻译的文字（不显示 `message`）：保存 `app.supported_locales` 时有语言没有通知模板文件：400 `INVALID_REQUEST`，`details` 为 `[{ref:'app.supported_locales', reason:'OUT_OF_RANGE'}]`，`data.missingLanguages` 是没有文件的语言标签数组（按请求里的顺序），该行显示"这些语言还没有随版本发布的通知模板文件：…"（语言标签原样列出）；保存或恢复默认 `push.default_locale` 时某个有启用模板的召回原因没有新语言的启用模板：400，`data.defaultLocale`（要保存的语言）和 `data.reasons`（缺它的召回原因，字母序），该行显示"先为这些召回原因启用该语言的模板：…"（原因名按推送页同一组文字翻译，查不到显示原值）；保存 `auth.phone_login_enabled` 为 `true` 被拒时（后端的回答第 42 条），400 的 `details` 一项缺失一条、最多 4 条（只列缺的），页面逐条按 `ref` 显示固定文字，都显示在提交的那一行：`sms.allowed_country_codes`（`EMPTY_NOT_ALLOWED`）→"先设置短信允许的国家码"，`sms.daily_global_cap`（`EMPTY_NOT_ALLOWED`）→"先设置短信每日全局上限"（这两项的 `ref` 是设置键，同时对到各自的设置行），`SmsChannel`（`EMPTY_NOT_ALLOWED`）→"需要至少一个启用的验证码短信渠道"，`SmsTemplate`（`EMPTY_NOT_ALLOWED`，不是设置键）→"需要一个启用的、语言为 en、不限国家的验证码短信模板"；不读 `message`；后端没有单独检查"有没有任何验证码模板"（"英文不限国家"已包含它）。
- 币种键的关系（`usage_price.default_currency`、`usage_price.allowed_currencies`，互为 `relatedKeys`）：默认币种必须在允许列表里（区分大小写）；违反时 `details` 同时写两个键（保存的键在前），两行都显示错误；说明写明顺序：要把默认币种改成新币种，先把它加进允许列表；要把当前默认币种从允许列表去掉，先改默认币种；`DELETE` 这两个键之一按代码里的默认值判断。`attribution.cost_currency`：只要有任何一条投放成本就不能改成不同的币种，也不能恢复默认到不同的值（保存相同的值永远通过）；违反时 400，`details` 为 `[{ref:'attribution.cost_currency', reason:'OUT_OF_RANGE'}]`；该行的说明写明"已有投放成本时不能修改；要换币种，先在投放成本页逐行删光成本，再改这里"。
- `app.supported_locales` 的说明写明顺序：通知模板文件随版本发布 → 再把语言加进来；比较不区分大小写、整个标签要匹配（`pt` 不能用 `pt-BR` 的文件）；召回模板不需要先动，缺的语言在推送模板页显示为"回退到默认语言"；恢复默认回到 `["en"]`，永远通过。
- 养成管理页读写 `companionship.stage_thresholds`、`milestone.days`、`companionship.text_burst_minutes`，前端校验见规格 5.9；页面写明"改阈值只影响之后的计算，不迁移数据"（规格 5.9，契约 §6.1）。
- 十四个设置项的说明文字按后端的回答第 139 条核对（`config.<键>.desc`，两种语言都改；未列出的保持原样）：`generation.poll_interval_seconds` 是"后端检查未完成生成任务的间隔（秒）"，不是客户端轮询，任何客户端接口都不返回它；`chat.history_max_limit` 补"请求的 `limit` 超过它是 400，不是被截成它；不带 `limit` 时取 50 与它的较小者"；`events.max_batch` 补"一次上传的事件数超过它，整个请求被拒（413 `BATCH_TOO_LARGE`）"；`events.max_body_kb` 补"1 KB 为 1024 字节，超过同样 413 `BATCH_TOO_LARGE`"；`recall.inactive_hours` 补"从账号最后一次互动（文字对话和通话都算）起算，从没互动过的从账号创建起算，严格超过这个小时数才算，用于每日召回"；`recall.streak_min_days` 补"连续天数大于等于该值，并且最后互动日是用户当地的昨天时才触发连续记录有断掉风险的召回，优先于每日召回"；`support.rate_limit_per_hour` 补"按账号（不是按 IP）、针对 `POST /api/support/feedback`，超过 429"；`export.min_interval_hours` 补"按用户账号、针对用户自己的数据导出（不是管理员的统计导出），从该账号上一次成功导出的创建时刻起算，间隔内再申请 429"；`moderation.block_score`、`moderation.review_score` 写回方向："分数大于等于拦截阈值拦截，否则大于等于复核阈值进人工复核，否则通过；调高阈值是更少拦截；复核阈值必须小于拦截阈值；两个阈值有任何一个没保存就不调用审核服务"；`complaint.likeness_due_hours` 补"处理时限在收到投诉时算好并存下，改设置只影响之后收到的投诉"；`recall.window_minutes` 补"从当地发送小时的整点起向后的窗口（不是以该小时为中心），窗口越长发送越分散"（本来就对，写明方向）。测试：这些键的说明在两种语言里非空，并含上面各条的要点（按关键词断言各一例）。

**Tests:**
- 键集合：`CONFIG_SCHEMA` 的键集合等于 `configKeys.generated.json`；每个键在两个语言文件里都有 label 和 desc。
- `editedElsewhere`：`moderation.text_rules` 在系统配置页和审核规则页的"参数"区里都是只读行，带指向规则编辑器的链接；规则页的"参数"区因此是该码的另外 9 个键。
- 键归属：schema 里每个非 `CONFIG:MANAGE` 的 `editPermission` 在 `CONFIG_HOSTS` 里都有页面（断言覆盖，漏一个就失败）；`<ConfigForm editPermission="MODERATION:CONFIG" />` 只渲染该码的键（假后端按权限过滤，所以没有这个权限的管理员看不到这一区）；schema 里有而 `GET /config` 没返回的键（没有编辑权限）不显示也不警告。
- `ConfigForm`：`GET /config` 返回的行都可编辑（后端只返回有权编辑的键，没有只读行）；返回而 schema 里没有的键 → 页面顶部警告"存在未识别的配置项"并只读显示；JSON 键解析失败时该行保存按钮禁用；保存只发这一个键的 `PUT /config/{key}`，请求体是 `{ "value": … }`；`value` 为 `null` 的行显示"未配置"（没有默认值又没设置过），不当成空字符串或 0；`updatedAt` 非空的行显示更新时间和 `updatedByUsername`，并有"恢复默认"（行内确认，调 `DELETE /config/{key}`，成功后该行回到 `defaultValue`，`updatedAt` 变空）；`updatedAt` 为空的行"恢复默认"禁用；后端 `INVALID_REQUEST` 的 `data.details` 按 `ref` 对到该行、文字取 `reason.<代码>`（`describeError`）；响应带 `warnings` 时用警告样式显示且不阻止，`PHONE_LOGIN_DISABLED_ACCOUNTS` 带 `count`；六个风险键各有行内风险文字；`upload.public_base_url` 没有默认值，未配置时该行旁写明"广告素材和 APK 上传需要它"。
- 额外键：`CONFIG_SCHEMA` 的键集合等于 `configKeys.generated.json` 加 `CONFIG_PRE_ADOPTION_KEYS`（26 个，每个的类型和编辑权限与上面一致，`attribution.store_click_ip` 是 `ATTRIBUTION:MANAGE`、`moderation.record_retention_days` 和 `moderation.model_check_enabled` 是 `MODERATION:CONFIG`）；`GET /config` 返回这些键时不出现"未识别的配置项"警告；检查脚本在额外键清单里的键出现在契约表时失败（用一份造出来的契约文本断言）；范围：`chat.moderation_deadline_ms` 的 2501 被前端拒、2500 通过，`recall.window_minutes` 的 1441 被拒，`push.schedule_catchup_minutes` 的 10081 被拒。
- 关系提示和关系错误：`push.schedule_catchup_minutes` 与 `push.task_poll_seconds` 两行都有规则提示，默认值（60 和 15）下提示最小值 11；后端答 400 且 `details` 是这两个键时两行都显示错误；币种两个键、`chat.message_retention_days` 与 `stats.land_window_days` 同理；`attribution.cost_currency` 被拒时该行显示锁定说明。
- 结构化字段：保存 `app.supported_locales` 得到带 `data.missingLanguages` 的 400，该行文字列出这些语言标签，且页面上没有出现后端 `message` 的英文原句；保存 `push.default_locale` 得到带 `data.defaultLocale`、`data.reasons` 的 400，该行列出这些召回原因；`auth.phone_login_enabled` 得到 `details` 含 `sms.allowed_country_codes`、`sms.daily_global_cap`、`SmsChannel`、`SmsTemplate` 的 400，每一项各出一句固定文字（`details` 里没有的项不出现），文字显示在这一行；每个文字阿拉伯语、泰语的语言标签和原因名各一例，不撑破行。
- 假后端：实现上面所有的保存规则（缺语言文件的 `app.supported_locales`、召回原因缺默认语言模板的 `push.default_locale`、`auth.phone_login_enabled` 设为 `true` 时依次检查并各加一条 `details`（`sms.allowed_country_codes` 没设或为空、`sms.daily_global_cap` 没设、没有启用的验证码渠道 `SmsChannel`、没有启用的英文不限国家验证码模板 `SmsTemplate`，原因都是 `EMPTY_NOT_ALLOWED`）、两个币种键的关系、有成本行时的 `attribution.cost_currency`、`push.schedule_catchup_minutes` 与 `push.task_poll_seconds`、`chat.message_retention_days` 与 `guest.device_retention_days` 对 `stats.land_window_days` 的关系），错误形状同后端；`GET /config` 返回 26 个额外键，按各自的编辑权限过滤；`PUT /config/admin.totp_required` 在假后端的生产环境（默认）保存 `false` 答 400 `INVALID_REQUEST`、不带 `details`，非生产环境通过；`events.ttl_days` 的下限是 31 加窗口。
- 养成管理：阈值非整数、`BONDING ≥ CLOSE`、里程碑天数重复或含 0 时不提交；只有 `COMPANIONSHIP:CONFIG` 的管理员 `GET /config` 只得到这三个键（假后端按权限过滤）。
- 假后端：缺编辑权限的 `PUT`、`DELETE` 返回 403；键不存在返回 404；整数键小于 1 返回 400 且 `data.details` 是 `[{ref: 键, reason: 'OUT_OF_RANGE'}]`；关系约束（`retry.initial_seconds ≤ retry.max_seconds` 等）返回 400；`GET /config` 按键名升序且只含该管理员有权编辑的键；`DELETE` 后 `value` 回到默认值、`warnings` 为空。

- [ ] 步骤 1–5 按"任务的统一写法"

---

## 模块任务（11–31）

模块任务彼此独立，只依赖地基任务 1–10，下面单独写明的跨模块依赖除外。每个模块任务的 Files 都是：`src/services/<模块>/`、`src/pages/<模块>/`、`mock/<模块>.mock.ts`、`config/routes/<模块>.ts`、`src/locales/{zh-CN,en-US}/<模块>.ts` 及对应测试，下面不再重复。假后端的每个接口都按契约对缺权限、对象不存在（404 `RESOURCE_NOT_FOUND`）、状态不允许（409 `INVALID_STATE`，`data.status` 是当前状态）、重复（409 `DUPLICATE_RESOURCE`，`data.field`）返回相应错误，列表接口用 `paginate`；假数据用 `multilingualSamples`；响应字段名一律按后端的回复：管理员 ID 字段旁带 `…Username`（管理员已删除时为 `null`）、图片带 `…Url`（每次取列表给新的地址，缺失为 `null`）、分页或日期范围越界返回 400 `INVALID_REQUEST`（`details` 的 `ref` 是参数名）。

### 任务 11：订阅与权益

**Refs:** 规格 5.10 前半（订阅列表、权益定义与功能值、功能开关、商品映射、事件重处理、订阅统计）；契约 §15.3–§15.6、§17.4 订阅管理行。路由取规格 5.0"订阅与额度"中这六行（权益定义、功能开关、商品映射、事件重处理四页的 `access` 规格已改成 `SUBSCRIPTION:VIEW`），这三页的写按钮取 `SUBSCRIPTION:CONFIG`，事件的"重新处理""已处理"取 `SUBSCRIPTION:GRANT`。功能开关页另有一段 `<ConfigForm editPermission="SUBSCRIPTION:CONFIG" />`（该码的 8 个参数键）。订阅详情（含事件时间线）用抽屉。

**Interfaces:**
- Produces: `type FeatureValue = { mode: 'VALUE'; value: unknown } | { mode: 'UNLIMITED' } | { mode: 'UNSET' }`；`FeatureValueEditor`（属性 `{ type: 'BOOLEAN'|'LIMIT'|'STRING'; value: FeatureValue; allowUnset: boolean; allowUnlimited: boolean; onChange }`）；`saveEntitlementFeatures(key, features)`、`saveGateDefault(key, FeatureValue)`、`saveGateCreditCost(key, number | null)`；账号维度给用户详情（任务 16）用的 `getAccountEntitlements(id)`、`grantPromoEntitlement(id, { entitlementKey, durationDays, reason })`、`revokePromoEntitlement(promoId)`。

- 响应类型（后端回复第 2–4 条）：`EntitlementDef = { key; name; priority; features: { featureKey; mode: 'VALUE'|'UNLIMITED'|'UNSET'; value: unknown | null }[] }`（按 `priority` 升序，`features` 列出全部已声明的开关、按 `featureKey` 升序，没有配置行就是 `UNSET`）；`FeatureGate = { key; kind: 'BOOLEAN'|'LIMIT'|'STRING'; limitScope: string | null; defaultMode: 'VALUE'|'UNLIMITED'|'UNSET'; defaultValue: unknown | null; creditCost: number | null; description: string }`（`limitScope` 仅 `LIMIT` 类有值，`UNSET` 只会出现在五个额度键上）；`SubscriptionDetail = Subscription 的全部列（含可空的 `periodOrderId`：当前计费周期在商店的订单标识，详情抽屉用 `plainText` 显示，空显示“—”；新版契约 15.3）& { events: { id; type; subtype; eventSignedAt; receivedAt; processedAt; error; needsAttention }[] }`（事件按 `eventSignedAt` 倒序，不含 `payload`；列表项没有 `events`）；`AccountEntitlements = { effective: { featureKey; kind; mode; value; source: 'ENTITLEMENT'|'DEFAULT'|'NONE'; entitlementKey: string | null }[]; entitlements: (AccountEntitlement 的列 & { entitlementName; status: 'ACTIVE'|'EXPIRED'|'REVOKED' })[] }`（`entitlements` 按 `startsAt` 倒序）。
- 发放限时权益时，权益的选项来自 `GET /entitlement-defs`（后端已对 `SUBSCRIPTION:GRANT` 开放读取）。
- 商品映射的写法（后端的回答第 28 条）：`GET /subscription-products` → `{items:[{store, productId, entitlementKey, enabled, sortOrder, surfaces}]}`（恰好这六列，没有 id 和时间戳，不分页，按 `store`、`sortOrder`、`productId` 升序）；`PUT /subscription-products` 的请求体是 `{items:[…]}`，一次可带多项，按 (`store`, `productId`) 逐项新增或更新，没列出的商品不动、永远不会被删，整个请求在一个事务里（任何一项失败都不保存）；页面一次保存一行，把这一行包进 `items`；六个字段每项都必填，`surfaces` 不能缺（`[]` 才表示所有端，不存在"不传就保持不变"，保存时把读到的值原样回传）；成功时 `data` 是 `null`，所以保存后重新 `GET` 列表；`entitlementKey` 不存在是 404 `RESOURCE_NOT_FOUND`（不是 400）；同一请求里同一 (`store`, `productId`) 出现两次是 409 `DUPLICATE_RESOURCE`，`data.field` 为 `productId`；校验失败是 400 带 `details`：`store` 匹配 `[A-Z][A-Z0-9_]{1,31}`（不止 APPLE、GOOGLE），`productId` 去空白后 1 到 255 个码点且不含控制字符，`surfaces` 最多 50 项、每项 `platform` 为 `ANDROID` 或 `IOS`、`channel` 可空。假后端同样处理。
- 权益定义的写法（后端的回答第 104 条）：`POST /entitlement-defs` 请求体 `{key, name, priority}`，成功 `data` 是 `{key}`；`PUT /entitlement-defs/{key}` 请求体 `{name, priority}`（体里的 `key` 被忽略，以路径为准），成功 `data` 是 `null`，不存在 404。页面预检：`key` 匹配 `[A-Za-z0-9][A-Za-z0-9._-]{0,63}` 且创建后不可改，`name` 去空白后 1 到 100 个码点，`priority` 必填整数（取值范围后端不限制，负数和 0 都可）；`priority` 全表唯一，重复是 409 `DUPLICATE_RESOURCE`，`data.field` 为 `key` 或 `priority`，两种都要处理（"key 已存在同时 priority 被另一个权益占用"时报的是 `priority`，改完再保存才会报 `key`）。
- 额度单价的写法（后端的回答第 105 条）：`PUT /feature-gates/{key}/credit-cost` 请求体 `{creditCost: 整数或 null}`，字段缺失（`{}`）是 400 `EMPTY_NOT_ALLOWED`（`ref` 为 `creditCost`），`null` 表示清除价格、答成功；非空价格必须是整数（`5.0` 这类写法是 `NOT_AN_INTEGER`）且不小于 1，没有写死的上限；成功 `data` 为 `null`，开关 key 不存在 404；只有 `assets.avatar_max` 和 `assets.voice_max` 两个开关可以设非空价格，其余开关设非空价格一律 400 `INVALID_REQUEST`，`details` 为 `[{ref:'creditCost', reason:'OUT_OF_RANGE'}]`，清除（`null`）对所有开关都允许；权限 `SUBSCRIPTION:CONFIG`。
- 限时权益的发放与撤销（后端的回答第 106 条）：发放 `POST /accounts/{id}/promo-entitlements` 请求体 `{entitlementKey, durationDays, reason}`，`durationDays` 是 1 到 3650 的整数（缺失 `EMPTY_NOT_ALLOWED`，越界 `OUT_OF_RANGE`，`ref` 为 `durationDays`），`reason` 去空白后 1 到 500 个码点（空 `EMPTY_NOT_ALLOWED`、超长 `TOO_LONG`），成功 `data` 是 `{id}`，生效区间 `[现在, 现在+天数)`；检查顺序：请求体字段 400 → 账号不存在 404 → 账号 `PENDING_DELETION` 403 `ACCOUNT_DELETION_SCHEDULED`（`data.scheduledAt`）/ `DELETING` 403 `ACCOUNT_DELETING` → `entitlementKey` 不存在 404 `RESOURCE_NOT_FOUND`（不是 400）；封禁账号可以发放。撤销 `POST /promo-entitlements/{id}/revoke` 不带请求体、没有理由字段；该行不存在或不是限时权益（来源是商店订阅）是 404（不是 409）；账号 `DELETING` 是 403 `ACCOUNT_DELETING`（`PENDING_DELETION` 与封禁账号可以撤销）；该行已不是生效状态（`REVOKED` 或 `EXPIRED`）是 409 `INVALID_STATE`，`data.status` 是当前状态；成功 `data` 为 `null`。权限都是 `SUBSCRIPTION:GRANT`。

**Tests:**
- 账号的权益页签：`effective` 每个开关一行，显示生效值和来源（权益 / 默认值 / 无）；`entitlements` 里"撤销"按钮只对 `source=PROMO` 且 `status=ACTIVE` 的行显示（再加 `SUBSCRIPTION:GRANT`）。
- 订阅详情抽屉的事件时间线用 `eventSignedAt`（商店给出的事件时间）倒序，`error` 非空的事件标红，`needsAttention` 的事件有标记。
- 发放与撤销的预检（后端的回答第 106 条）：`durationDays` 为 1 到 3650 的整数，`reason` 1 到 500 个码点；撤销不带请求体；假后端按上面的错误和检查顺序返回。
- 商品映射和权益定义的假后端（后端的回答第 28、104 条）：`PUT /subscription-products` 只接受 `{items:[…]}`，成功返回 `null`，`entitlementKey` 不存在返回 404，缺 `surfaces` 返回 400；权益定义重复返回 409 且 `data.field` 在 `key` 与 `priority` 两种情形都出现。
- 订阅的购买令牌（未完全核实，后端的回答第 2 条）：响应里 `storeRef`、`linkedPurchaseToken` 仍是完整令牌（后端只在"改动请求"里提出只返回末 6 位，还没做），抽屉里只显示末 6 位、没有复制按钮，事件列表的 `sourceEventId` 和事件详情里的购买令牌同样只显示末 6 位；Apple 的 `originalTransactionId` 是否可以保留是对 App Store 行为的判断、后端没有逐行核实，页面对它的处理不变。
- `FeatureValueEditor`：三种状态界面上可区分，序列化分别是 `{mode:'UNSET'}`、`{mode:'UNLIMITED'}`、`{mode:'VALUE',value}`；`UNSET` 只在功能开关默认值的五个额度键上能选；`credits.period_grant` 不能选"不限"；`call.lifetime_minutes` 不出现在权益的功能值里。
- 额度单价单元格（后端的回答第 105 条）：只有 `assets.avatar_max`、`assets.voice_max` 两个开关可编辑，其余开关一律禁用；不能用"`kind=LIMIT` 且 `limitScope=PERMANENT`"判断（`avatar.looks_max` 的 `limitScope` 也是 `PERMANENT`，保存会被拒）；可编辑开关写成一个常量清单，后端对清单外的开关答 400 时显示按原因翻译的文字。
- 三个通话额度键默认值**都**未配置 → 顶部红条；只配一个 → 无红条；两个文字额度键同理有各自的红条。
- 保存权益的功能值或商品映射时：这个权益**既没有**配置 `call.daily_minutes` **也没有**配置 `call.monthly_minutes`，而且这两个键的默认值也都没有配置 → 显示"该权益的订阅用户通话不受日 / 月额度限制"提醒；任何一个键有值就不提醒（契约 §15.3："运营只配一个键就够"）。
- `call.lifetime_minutes` 的说明文字存在：只影响之后创建的账号，已有账号的发放值不变，创建时没配置的账号在配置之后第一次发起会话时记入当时的值（规格 5.10）。
- 事件重处理页：列表筛选 `FAILED` 与 `needsAttention`；"重新处理""已处理"按钮只对 `SUBSCRIPTION:GRANT` 渲染。
- 路由权限：持有 `SUBSCRIPTION:VIEW` 就能进权益定义、功能开关、商品映射、事件重处理四页，保存按钮各按 `SUBSCRIPTION:CONFIG` 显示，"重新处理""已处理"按 `SUBSCRIPTION:GRANT` 显示（规格 3.4 的规则是建角色时查看权限和操作权限一起授予，前端不拦截，只按各自的码显示）；没有 `VIEW` 的管理员进这四页得到 403 页（读接口是 `VIEW`）。
- 功能开关页的"参数"区只渲染 `SUBSCRIPTION:CONFIG` 的键，没有该码的管理员看不到这一区。
- 订阅统计：页面文字写明"金额是标价不是实收，沙盒不计入"；没有退款操作的入口。Google 行的 `listPriceAmount` 现在有值：当天该商品最后一条带价格的事件的 `recurringPrice`，十进制字符串（例如 `"24.99"`，去掉尾零），`listPriceCurrency` 是它的币种；当天没有任何事件带价格（例如预付计划，或事件是后端改动前处理的）时两个字段都是 `null`，显示"—"，不显示 0；苹果行不变。测试：`"24.99"` 和 `"0.0000000001"` 原样显示（不经过 `Number`，不出现科学计数法）；两个字段同时为 `null` 的 Google 行显示"—"；币种缺失而金额有值时只显示金额，不凑出币种；假后端同时给出有价格和 `null` 的 Google 行。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 12：额度

**Refs:** 规格 5.10 后半（额度包、调账申请与审核、额度账户、额度流水、额度统计、账号额度）；契约 §15.9、§17.4 额度行。路由取规格 5.0"订阅与额度"中额度相关五行。

**Interfaces:**
- Produces: `createAdjustRequest(body)`、`approveAdjustRequest(id, note?)`、`rejectAdjustRequest(id, note)`；给用户详情用的 `getAccountCredits(id, { page, pageSize })`，响应 `{ balance; totalEarned; totalSpent; items: LedgerRow[]; total }`（后端回复第 5 条），`LedgerRow = { id; delta; reason; purchaseId; eventKey; spendKind; featureKey; itemKey; quantity; note; createdAt }`，流水按 `id` 倒序分页，没有额度账户的账号三个合计是 0、`items` 为空（不是 404）；调账申请行带 `applicantUsername`、`reviewerUsername`；`NegativeBalance` 展示组件（余额为负时醒目颜色并带"为负时不能消费，新购买的额度会先抵扣"）。
- 额度包（后端的回答第 30 条）：`GET /credit-products` → `{items:[{store, productId, credits, enabled, sortOrder, surfaces}]}`，没有 id、没有 `total`、没有 `updatedAt`，含停售的商品，按 `sortOrder`、`store`、`productId` 排序，读取要 `SUBSCRIPTION:CONFIG`（只有 `SUBSCRIPTION:VIEW` 读不了，页面的路由权限和读取按钮按这个码）；新增 `POST /credit-products`（成功 `data` 是 `{store, productId}`；已存在的 (`store`, `productId`) 是 409 `DUPLICATE_RESOURCE`，`data.field` 为 `productId`），修改 `PUT /credit-products`（**路径里没有 id**，商品由请求体的 (`store`, `productId`) 指明，不存在 404；成功 `data` 是 `null`；没有按 id 的路径，也没有 `DELETE`）。两者请求体相同，六项都必填：`store`（`[A-Z][A-Z0-9_]{1,31}`）、`productId`（去空白后 1 到 255 个码点、不含控制字符）、`credits`（整数 1 到 1000000000，越界 `OUT_OF_RANGE`）、`enabled`、`sortOrder`、`surfaces`；`surfaces` 不出现（`null`）是 400 `EMPTY_NOT_ALLOWED`，不是"保持不变"也不是"按空数组覆盖"，`[]` 才是所有端，所以保存前把读到的值原样回传。行标识用 (`store`, `productId`)。后端没有并发保护（后保存的覆盖先保存的），"保存前重新读取这一行、与打开时比较"的已定做法继续使用，请求里不带 `expectedUpdatedAt`（后端建议不做，见请求清单）。

**Tests:**
- `me.id` 有值且申请人是当前管理员时，审核按钮禁用并提示（`id` 是 `GET /me` 里后端已加的字段，真后端还没上线、字段缺失时不禁用，由后端的 `SELF_REVIEW_FORBIDDEN` 兜底）；后端返回 `SELF_REVIEW_FORBIDDEN` 时展示。
- 驳回备注必填（`trimSpec` 后 1 到 500 个码点），通过时备注可不填（空或缺失按没有）；创建申请的 `reason` 必填、1 到 500 个码点；`delta` 是整数，不能为 0（`GRANT` 和 `ADJUST` 一样，0 是 400 `OUT_OF_RANGE`，`ref` 为 `delta`），绝对值不超过 1000000000，`GRANT` 必须为正，`ADJUST` 可正可负；`kind` 缺失 400 `EMPTY_NOT_ALLOWED`、其他值 400 `OUT_OF_RANGE`；创建成功 `data` 是 `{id}`；以上预检是前端先拦，后端为准（后端的回答第 108 条）。
- 余额为负的行用警示色；流水筛选"获得"发 `type=earn`、"消耗"发 `type=spend`（契约 §15.9 的参数，断言发出的参数）；账号额度页签对没有额度账户的账号显示三个 0 和空流水，不报错。
- 账号 ID 筛选是精确匹配（不做模糊），提交的是用户输入的完整值。
- 额度统计的消费额度按 `spendKind` 分，服装再按 `itemKey` 分；沙盒不计入的说明文字存在。
- 没有 `SUBSCRIPTION:VIEW` 看不到账户、流水页；没有 `SUBSCRIPTION:GRANT` 看不到"新建申请"；没有 `CREDIT:REVIEW` 看不到通过 / 驳回。
- 额度包页（后端的回答第 30 条）：修改请求发到 `PUT /credit-products`（不是 `/credit-products/{id}`），请求体带六项，`surfaces` 是读到的原值；列表行用 (`store`, `productId`) 做行键；只有 `SUBSCRIPTION:VIEW` 的管理员进不了这一页（读取要 `CONFIG`）；保存前重读与打开时比较，不一致不保存并提示"已被他人修改"；假后端按上面的路径、请求体、错误（重复 409、不存在 404、缺 `surfaces` 400）返回，`GET` 的行没有 id。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 13：记忆服务、系统监控与告警、客服

**Refs:** 规格 5.14；契约 §16.2–§16.3、§14、§17.4（系统监控行、后台告警一段）、§12。路由取规格 5.0 的"记忆服务""系统监控""客服"各行；反馈详情用抽屉。接口路径用契约的：`/memory/tiers[/{name}]`、`/memory/embedding-models[/{name}]`、`GET /accounts/{id}/memory`、`PUT /accounts/{id}/memory/embedding-model`、`GET /monitor/pipeline`、`GET /alerts`、`POST /alerts/{id}/resolve`。记忆模型页另有一段 `<ConfigForm editPermission="MEMORY:MODEL_REGISTER" />`；写权限用完整的码 `MEMORY:TIER_CONFIG`、`MEMORY:MODEL_REGISTER`、`MEMORY:MODEL_ASSIGN`。

**Interfaces:**
- 响应类型（契约 §16.2–§16.3 加后端回复第 3 条）：档位 `{ items: { tierName; topK; recencyChannelEnabled; recencyChannelCount; consolidationEnabled; consolidationThreshold }[] }`；模型 `{ items: { modelName; teiBaseUrl; dimensions }[] }`；`GET /accounts/{id}/memory` → `{ tier: { tierName; syncStatus; assignedAt; lastError }; embeddingAssignments: { modelName; assignedBy; assignedByUsername; assignedAt }[]; truncated: boolean; totalCount: number }`（后端 2026-10-31 新增后两个字段：`embeddingAssignments` 最多给最新的 200 条，账号的指派多于 200 条时 `truncated` 为真，`totalCount` 是该账号的全部指派数）。
- Produces: `listAlerts(p: { status?: 'OPEN'|'RESOLVED'; type?: string; page; pageSize })`、`resolveAlert(id)`（给总览任务 21 用）；`getAccountMemory(id)`、`assignEmbeddingModel(accountId, name)`（给用户详情用）；`ALERT_TYPES`：后端现在的全部 18 种告警类型的常量表——契约后台告警一段列的 14 种（规格 5.14 只列了 13 种，少了 `LOOK_PACKAGE_PREPARE_FAILED`），加后端第一批交付以来新增的 4 种：`POSTBACK_CREDENTIAL_FAILED`（广告投放活动的转化回传凭证不能用）、`SUBSCRIPTION_EVENT_FAILED`、`SUPPORT_FORWARD_FAILED`（客服反馈转发用尽次数）、`STAT_RELAND_FAILED`（统计日重新落地连续失败，英文标签"Statistics re-landing failed"）。这 4 种还没有进契约 17.4 和规格（变更请求见 `docs/contract-requests/2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md`）。`SUBSCRIPTION_EVENT_FAILED` 的 `refType`、`detail`、自动解决条件后端没有写出，页面只给它类型名称，`detail` 和关联对象原样显示，不编造说明。

**Tests:**
- 告警类型常量表等于后端的 18 种（上面列的）；未知类型显示原始类型字符串，不崩溃；每种类型在两种语言里有文字；类型筛选的选项就是这 18 种。
- 告警筛选：`status` 只发 `OPEN` 或 `RESOLVED`，`type` 只发这 18 种之一，"全部"时不带这个参数（后端把空字符串当成一个取值，对 `status`、`type` 都是 400）：断言选"全部"后发出的地址里没有 `status=` 和 `type=`；假后端对不在取值内的 `status`、`type`（含空字符串）答 400 `INVALID_REQUEST`，`details` 的 `ref` 是参数名。
- `SUPPORT_FORWARD_FAILED`：`refType` 是 `SUPPORT_FEEDBACK`，`refId` 是反馈 ID，关联账号点击跳 `/users/:id`，`detail` 固定为 `attempts_exhausted`，显示成本地化文字"转发次数已用尽"（不含反馈正文，错误文字在客服反馈列表的 `lastError`）；在客服页对该反馈点"重试"（`POST /support/feedback/{id}/retry`）后，假后端在同一操作里把这条 `OPEN` 告警置 `RESOLVED`，重新取告警列表就看不到它；重试没有改变任何东西（反馈不存在、反馈不是 `FAILED`）时告警保持打开；手动"关闭"这条告警对反馈没有副作用，关闭确认文字不提反馈。
- `POSTBACK_CREDENTIAL_FAILED`：`refType` 是 `ATTRIBUTION_CAMPAIGN`，`refId` 是投放账户 ID，没有关联账号；`detail` 的 `token_unreadable`（存着的访问令牌用当前密钥解不开）、`pixel_id_malformed`（存着的像素编号格式不对）各有本地化文字，其他值（广告平台返回的错误码，可能为空）原样显示，空值显示"—"；一条打开的告警里的 `detail` 会被后来不同原因的失败替换（不是保留第一次的），假后端按此更新；管理员在投放账户页重新提交令牌、清除令牌或改了像素编号（关闭条件见任务 25，后端的回答第 82 条）时，假后端把这条告警置 `RESOLVED`；`detail` 是 Meta 返回错误码的十进制文本（如 `190`），没有错误码时（例如 401、403 没带错误体）可以是 `null`，也可以是固定值 `token_unreadable`、`pixel_id_malformed`。
- `STAT_RELAND_FAILED`：`refType` 是 `STAT_RELAND_DAY`，`refId` 形如 `usage-cost:2026-10-10`（落地器名和统计日，原样显示），`detail` 只是异常类名（原样显示，不翻译）；手动"关闭"的确认文字写明"该日期仍然失败时会再次打开告警；后台会按 10、20、40 分钟这样递增的间隔重试，最长 6 小时一次"；这个日期落地成功时告警自动 `RESOLVED`。
- 记忆：`truncated` 为真时，账号记忆区在指派列表旁写"只显示最新 200 条，共 N 条"（N 取 `totalCount`），为假时不显示这句；`totalCount` 缺失（真后端还没上线）时按"没有这个字段"处理，不显示这句也不报错；假后端对指派数超过 200 的账号给 200 条加 `truncated: true`。
- 告警页："关闭"按钮只对 `MONITOR:MANAGE` 渲染；关联账号点击跳 `/users/:id`；关闭调用 `POST /alerts/{id}/resolve`；`LOOK_PACKAGE_PREPARE_FAILED` 类型的关闭确认写明"会把这个驱动资源包的失败次数清零并重新排准备任务"（契约 §3.9）。
- 记忆档位：修改表单顶部有"会立即影响该档位下所有账号"；档位名不在列表里时先确认"将新建档位 X"；embedding 模型注册返回 409 `MEMORY_MODEL_CONFLICT` 时显示按码翻译的文字（`error.MEMORY_MODEL_CONFLICT`：同名模型已注册但维度不同），不显示记忆服务那句只有一种语言的 `detail`（它写明原来登记的维度；要显示维度，请后端给结构化字段，见 `docs/contract-requests/2026-11-01-admin-frontend-translated-error-texts.md`；后端的回答第 137 条建议加整数 `registeredDimensions`，还没做；记忆服务返回的 422、409 的 `detail` 文字由外部服务产生，后端的回答第 101、137 条没有核实它的内容（未完全核实），页面不解析也不显示它，422 没有 `ref`，只显示整体错误）；指派模型的警告文字存在，账号处于待删除 / 删除中时按钮禁用。
- 系统监控：没有数据的序列显示"暂无数据"而不是错误；空值点不画；页面有跳转成本报表的链接；没有成本图。
- 管线查询的时间参数（新版 14.1）：`from`、`to` 都不给取最近 24 小时；只给 `from` 取其后 24 小时，只给 `to` 取其前 24 小时；`from` 晚于 `to` 或不是带时区的 ISO-8601 时刻 → 400 `INVALID_REQUEST`（假后端不给 `details`，新版没写）；每个点多一个 `id`（`PipelinePoint.id: string | number`，假后端给不重复的数字）；页面总是同时发两个以 `Z` 结尾的时刻，页面只画图所以不用 `id`。
- 客服：`FAILED` 行的"重试"只对 `SUPPORT:MANAGE` 渲染；详情抽屉显示 `context` 的各字段；长反馈（阿拉伯语、泰语长串）不撑破列表。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 14：形象与装扮、照片里的人投诉

**Refs:** 规格 5.24、5.25；契约 §3.2、§3.7–§3.10、§11.6、§17.4 形象与装扮行和投诉行（投诉列表的 `status` 筛选另有取值 `OPEN`，来自后端 2026-10-29 的清单）；后端的说明第二节第 1–3 条。路由取规格 5.0"形象与装扮"六行和"投诉"一行。投诉页另有一段 `<ConfigForm editPermission="COMPLAINT:MANAGE" />`（2 个参数键）。请求写法（后端已定）：
- 上传：`POST /uploads/catalog-image`（服装 / 背景预览图和动作图标）、`POST /uploads/renderer-model`（zip）、`POST /uploads/default-avatar-source`（有肖像授权的源图），都是 `multipart/form-data`、字段 `file`、响应 `data.uploadId`；创建或修改只认 `uploadId`。
- `POST/PUT /cosmetics` 用 `previewUploadId`，`POST/PUT /actions` 用 `iconUploadId`，其余请求体字段名同契约 §18 该实体的列名；`POST /renderer-models` 是 JSON：`uploadId`、`rendererKind`、`version`、`platform`、`abi`、`rendererFormatVersion`、`minVersionCode`（`sha256`、`sizeBytes` 取自上传记录，不填）。
- 上下架：`PUT /cosmetics/{id}/enabled`、`PUT /actions/{id}/enabled`、`PUT /renderer-models/{id}/enabled`，请求体 `{enabled}`。
- 声明：`GET /declarations`、`POST /declarations {version, texts}`、`PUT /declarations/{version}/activate`。
- 动作补生成：`POST /actions/{id}/backfill`，响应 `{scheduled: N}`；动作不存在 404，已停用 409 `INVALID_STATE`；只对风格适用且缺片段或片段 `FAILED` 的外观补，重复调用只补还缺的。
- 默认数字人（`DEFAULT_AVATAR:MANAGE`）：`GET /default-avatars`（每行带 `status`）、`POST /default-avatars {name, style, sourceUploadId}`、`PUT /default-avatars/{id} {name}`（只改名）、`POST /default-avatars/{id}/generate`、`POST /default-avatars/{id}/activate`、`DELETE /default-avatars/{id}`；状态 `DRAFT` → `GENERATING` → `READY` → 生效（`isActive`）；`generate` 只对 `DRAFT`，`activate` 要求 `READY`，同一时刻只有一个生效（激活新的，旧的变成非生效但保留），只有非生效且不在生成中的能删，违反一律 409 `INVALID_STATE`；生成的前置配置没配好 503 `GENERATION_NOT_CONFIGURED`。`POST /default-avatars` 不收 `portraitAuthorized`。
- 投诉证据：`GET /likeness-complaints/{id}/evidence/{index}`（`index` 从 0 起，`COMPLAINT:VIEW`），返回 `{url, mediaType}`，每次读取写审计日志，越界 404 `RESOURCE_NOT_FOUND`。
- 响应字段（后端回复第 5、6、19 条）：服装 / 背景目录每项带 `previewUrl`、动作目录每项带 `iconUrl`、默认数字人每项带 `sourceImageUrl` 和 `previewUrl`（外观还没生成时 `null`）、`GET /accounts/{id}/avatars` 每个外观带 `previewUrl`；这些响应不再返回 `previewRef`、`iconRef`、`sourceImageRef`；地址是短时效签名地址，每次取列表都是新的，文件缺失为 `null`，所以页面不缓存地址、每次打开页面重新取列表、`null` 显示占位图。
- `GET /default-avatars` → `{items:[{id, name, style, status, isActive, failureReason, lookId, sourceImageUrl, previewUrl}]}`，按创建时间倒序，不分页；`status` 取 `DRAFT`、`GENERATING`、`READY`，**没有 `FAILED`**：生成失败回到 `DRAFT`，行里带 `failureReason`（`CONTENT_REJECTED`、`GENERATION_FAILED`、`EXTERNAL_TIMEOUT`、`EXTERNAL_TASK_LOST`、`SUBJECT_UNDERAGE`、`NO_FACE_DETECTED` 之一或 `null`），再点"生成"重试，点"生成"后 `failureReason` 清空；`POST`、`PUT`、`generate`、`activate` 的响应是同一项的形状。
- `GET /likeness-complaints`（列表）和 `/{id}`（详情）每项是 `LikenessComplaint` 的列（`id`、`contactEmail`、`description`、`status`、`receivedAt`、`dueAt`、`resolvedAt`、`handledBy`、`relatedAvatarAssetIds`）加 `handledByUsername`、`overdue`（布尔）、`evidenceCount`（整数）；不返回 `evidenceRefs`；详情另有 `events: [{id, fromStatus, toStatus, note, adminId, adminUsername, createdAt}]`，按 `createdAt` 升序。

**Interfaces:**
- Consumes: 任务 9 的 `getChannels`（渠道包下拉）；任务 8 的 `UploadField`
- Produces: `SurfacesPicker`（平台加渠道码的组合，能选"该平台全部渠道"，不选任何一项表示所有端，值格式按契约 §3.7）；`getAccountAvatars(id)`（返回形象、外观和拥有的服装，含 `source`，`USER:VIEW`，用户详情用）、`grantCosmetic(id, { itemId, reason })`（`COSMETIC:GRANT`，用户详情用）；`DefaultAvatarStatus = 'DRAFT' | 'GENERATING' | 'READY'`；`DefaultAvatarFailureReason` 是上面六个值的联合类型。

**Tests:**
- `SurfacesPicker`：不选任何项时显示"所有端"，序列化为契约 §3.7 规定的"无限制"取值；选"该平台全部渠道"与选具体渠道的序列化各自正确。
- 服装 / 动作：`key` 创建后只读；预览图 / 图标先走 `POST /uploads/catalog-image` 再把 `previewUploadId` / `iconUploadId` 放进创建或修改请求，请求体里没有图片地址；超过 `catalogImageMaxBytes`（2 MiB）、宽×高超过 `catalogImageMaxPixels`（36 百万像素）或不是 JPEG / PNG 的文件，上传前就被拦下（`UploadField kind="catalogImage"`），后端 400 `INVALID_FILE` 仍按 `describeError` 显示作兜底；`generationSpec` 的长度按码点数检查 1..2000（先 `trimSpec`），阿拉伯语和 emoji 各一例；上下架是行内开关，调 `…/enabled`。
- 动作目录：**没有类型列，也没有表情曲线上传**；每一行都有"给已有外观补生成"，确认框写明会产生生成费用；已停用的动作该按钮禁用；点击后提示"已安排 N 个生成任务"（取响应的 `scheduled`），`scheduled` 为 0 时提示"没有需要补生成的外观"；`triggerableBy` 三个取值（`USER`、`AGENT`、`BOTH`）都能选。
- 上传声明：新建版本（多语言文案）和"设为生效"（确认文字存在）调 `POST /declarations`、`PUT /declarations/{version}/activate`；`useAdminMeta().declarationRequired` 为 `false` 时顶部有"当前部署不要求勾选声明"的提示，缺失或为 `true` 时不显示。
- 渲染模型：先上传 zip（`POST /uploads/renderer-model`，`UploadField kind="rendererModel"`，上传前检查 `renderAssetMaxBytes` 和 zip 类型，上传中不能提交），再以 JSON 提交 `uploadId` 和表单里的 `rendererKind`、`version`、`platform`、`abi`、`rendererFormatVersion`、`minVersionCode`，请求体里没有 `sha256`、`sizeBytes`；列表列出契约 §18 的字段，`sha256`、`sizeBytes` 只读；启用、停用是行内开关。
- 系统默认数字人：新建流程是"上传源图（`POST /uploads/default-avatar-source`，`UploadField kind="defaultAvatarSource"`，上传前检查 `uploadMaxBytes`、`defaultAvatarSourceMaxPixels` 和 JPEG / PNG 类型）→ 填名字、选风格、勾选'这张图有肖像授权或是合成的、不对应真人'（只是界面确认，未勾选不能提交，请求体里没有 `portraitAuthorized`）→ `POST /default-avatars` 得到 `DRAFT`"；按状态显示按钮：`DRAFT` 有"生成"，`GENERATING` 显示进行中，没有生成、设为生效、删除，但仍可改名（后端任何状态都允许改名，后端的回答第 100 条），`READY` 有"设为生效"，非生效且不在生成中的有"删除"（行内确认）；已生效的行没有"删除"；设为生效的确认文字写明"游客和没有形象的账号会立刻看到它"，并说明原来生效的会变成非生效但保留；`DRAFT` 行带 `failureReason` 时显示本地化的失败原因（六个值各有文字），"生成"成功发出后该原因消失；每个按钮在后端 409 `INVALID_STATE` 时展示当前状态；503 `GENERATION_NOT_CONFIGURED` 时提示生成的前置配置没配好；名字必填，后端 400 `INVALID_REQUEST` 时按 `details` 里 `name` 的原因码显示按码翻译的文字，放在名字输入框下；改名只发 `{name}`，名字去空白后 1 到 30 个码点且不含控制字符和双向控制字符，不合格是 400 `INVALID_REQUEST`、只有 `message` 没有 `details`；对已经生效的再 `activate` 是幂等成功（返回该默认数字人，不报 409）；`activate` 对非 `READY` 的是 409 `INVALID_STATE`，默认数字人所有的 409 `INVALID_STATE`（生成、激活、删除）都没有 `data.status`，页面读 `data.status` 前先判空，缺失时只显示通用的 `error.INVALID_STATE` 文字（后端的回答第 100 条）；需要 `DEFAULT_AVATAR:MANAGE`。
- 生成任务：只按类型筛选（接口参数只有 `status`、`type`，不做时间筛选），类型含全部五种；系统任务（账号为空）显示"系统"。
- 五个目录列表的分页、筛选与排序（后端的回答第 64 条）：`GET /cosmetics`、`/actions`、`/declarations`、`/renderer-models`、`/generation-tasks` 全部服务端分页（`page` 从 1，`pageSize` 默认 20、最大 200，响应 `{items,total}`；参数不合法是 400，`details` 的 `ref` 为 `page` 或 `pageSize`）；`/cosmetics` 的筛选参数只有 `kind`（`OUTFIT` 或 `BACKGROUND`，其他值和空字符串是 400，`ref` 为 `kind`），没有 `enabled`、`style`，发了会被后端静默忽略，所以页面的"上下架状态""适用风格"两个筛选做成对已读到的这一页的前端过滤，筛选框旁写明"只筛选当前页"，分页总数仍是服务端的总数（不用"发参数"冒充服务端筛选）；排序：服装 `kind`、`sortOrder`、`key`，动作 `sortOrder`、`key`，渲染模型 `createdAt` 倒序（同时间按 `id` 倒序），声明先生效中的、再按 `activeFrom` 倒序（从未生效的排最后）、再按 `version`；`/actions`、`/declarations`、`/renderer-models` 除这些外没有任何筛选参数；`/generation-tasks` 只有 `status`（`PENDING`、`IN_REVIEW`、`PROCESSING`、`SUCCEEDED`、`FAILED`）和 `type`（`AVATAR`、`VOICE`、`LOOK`、`LOOK_REPREPARE`、`ACTION_CLIP`），空字符串当作没传，其他值是 400 `INVALID_REQUEST` 只有 `message`、没有 `ref`；投诉列表按 `dueAt` 升序（同时间按 `id` 升序）。假后端的目录排序同上。
- 多语言名称与声明文案（后端的回答第 96 条）：服装、动作的 `names` 和上传声明的 `texts` 都必须含 `en`，表单里 `en` 必填，只填别的语言会被后端 400；错误的 `ref` 是 `names.en` 或 `texts.en`，整个对象缺失或为空时 `ref` 是 `names` 或 `texts`，原因都是 `EMPTY_NOT_ALLOWED`，页面把错误对到对应的语言输入框。
- 服装、动作的请求体（后端的回答第 97 条）：`POST /cosmetics` 必填 `key`、`kind`、`names`、`generationSpec`、`compatibleStyles`（`STYLIZED_3D`、`REALISTIC` 至少一个、不重复）、`isFree`、`isDefault`、`enabled`、`sortOrder`、`previewUploadId`，可不带 `creditPrice`、`surfaces`（`null` 等于空数组，所有端）；`POST /actions` 必填 `key`、`names`、`description`、`generationSpec`、`compatibleStyles`、`triggerableBy`、`enabled`、`sortOrder`、`iconUploadId`，可不带 `surfaces`；创建时 `enabled` 必填。`PUT /cosmetics/{id}` 必须带 `kind`（当前值，页面不让改）、`names`、`generationSpec`、`compatibleStyles`、`isFree`、`isDefault`、`enabled`（当前值）、`sortOrder`，缺任何一个是 400；`key` 可不带（带了必须等于现有的，`ref` 为 `key`）；`previewUploadId` 只在换图时带（不带就保留原图）；`creditPrice: null` 清除价格，`isFree: true` 时 `creditPrice` 必须为空（`ref` 为 `creditPrice`），非空时 1 到 1000000000；`PUT /actions/{id}` 必须带 `description`、`triggerableBy`、`enabled`、`sortOrder`、`names`、`generationSpec`、`compatibleStyles`，`key`、`iconUploadId` 可不带；两者都是整体替换，`surfaces` 不带会变成空数组（所有端），所以编辑时把读到的 `surfaces` 原样带回；重复的 `key` 是 409 `DUPLICATE_RESOURCE`，`data.field` 为 `key`；`kind` 后端其实会被 `PUT` 改写（没有"不能改"的检查），页面一律带回当前值。
- 每种 `kind` 的默认条目（后端的回答第 98 条）：把另一个条目设为默认时，旧的默认条目在同一事务里自动取消默认（不是 409），表单提示写成"保存后其他默认条目会自动取消"；`isDefault` 为真而 `isFree` 为假不是 400（后端没有这条检查），不要假设 `ref` 为 `isDefault` 的 400；这个种类原来有合格默认条目（默认、启用、免费、两种风格都适用）而这次保存让它失去合格默认（取消唯一合格默认的 `isDefault`、把它停用、改成收费、去掉一种适用风格，或把别的条目设为不合格的默认）时，整笔回滚并返回 409 `INVALID_STATE`，`data` 是 `{kind: "OUTFIT"|"BACKGROUND"}`（注意是 `data.kind`，不是 `data.status`），页面在 `data.kind` 存在时显示"该种类必须保留一个启用、免费、两种风格都适用的默认条目"；假后端同样处理。
- 假后端的成功响应（后端的回答第 135 条）：投诉改状态 `PUT /likeness-complaints/{id}/status`、删除形象 `POST /likeness-complaints/{id}/remove-avatars`、赠送服装 `POST /accounts/{id}/cosmetics` 成功时 `data` 都是 `null`（页面本来不读响应，成功后重新读取）；重复赠送同一件不是 409 `DUPLICATE_RESOURCE`：已拥有时直接成功，不写第二行；赠送的 `reason` 必填 1 到 500 个码点；条目不存在 404、账号不存在 404、账号待删除 403 `ACCOUNT_DELETION_SCHEDULED`、删除中 403 `ACCOUNT_DELETING`、缺 `itemId` 或 `reason` 400；声明 `PUT /declarations/{version}/activate` 返回更新后的声明（对已生效的再激活是成功，原样返回），上下架 `PUT …/enabled` 返回更新后的条目（设成已有的值也成功，请求体缺 `enabled` 是 400）。
- 删除形象与投诉改状态的规则（新版契约 11.6，已按此实现）：`remove-avatars` 的 `assetIds` 不是数组或为空是 400 `EMPTY_NOT_ALLOWED`；超过 20 个、有重复（大小写不同的同一 UUID 也算重复）、元素不是 UUID 字符串是 400 `OUT_OF_RANGE`（`ref` 都是 `assetIds`）；找不到的形象是 404 `RESOURCE_NOT_FOUND`，`details` 每个找不到的 ID 一项（`ref` 是该 ID，`reason` 是 `RESOURCE_NOT_FOUND`），什么都不删；已结案的投诉 409 `INVALID_STATE`；把投诉改成它当前的状态同样 409 `INVALID_STATE`；`note` 不得含控制字符（含换行和制表符），否则 400。页面：形象 ID 的输入框最多 20 个（再输入的不保留并写明），同一 UUID 大小写不同只留一个，不是 UUID 的 ID 在输入框下面指名说明并禁用删除按钮，不发请求；状态下拉里投诉当前的状态灰掉不能选；备注含控制字符（包括在文本框里按回车产生的换行）不发请求并写明原因；失败时只显示按码翻译的文字，404 的每个找不到的 ID 单独一行（ID 加原因文字）。假后端按此检查，顺序是投诉 404、请求体 400、状态 409、形象 404，成功时删除这些形象（用户的形象列表里不再有）。
- 赠送服装（用户详情用的 `grantCosmetic` 所在的选择框）：条目列表来自 `GET /cosmetics`（后端已对 `COSMETIC:GRANT` 开放读取）；仍收到 403 时选择器禁用并写明"需要 `COSMETIC:MANAGE` 或 `COSMETIC:GRANT` 才能列出条目"，当作兜底，不崩溃。
- 投诉列表的状态筛选：选项是"未结案"（发 `status=OPEN`，等于 `RECEIVED` 和 `INVESTIGATING` 两个状态）加 `RECEIVED`、`INVESTIGATING`、`RESOLVED_REMOVED`、`RESOLVED_NOT_FOUND`、`REJECTED` 五个，不选时不带 `status`（空字符串也不发）；取值区分大小写，只发这六个字面值；`total` 与同一条件一致，排序仍按 `dueAt` 升序；假后端对 `open`、逗号分隔的多个值、带空白的值答 400 `INVALID_REQUEST`，`details` 为 `[{ref:'status', reason:'OUT_OF_RANGE'}]`，`page`、`pageSize` 的错误先于 `status` 检查；切换筛选后分页回到第 1 页。
- 投诉：已结案状态不显示流转和删除形象按钮；状态下拉只有 `INVESTIGATING`、`RESOLVED_NOT_FOUND`、`REJECTED`；删除形象的确认文字写明"不能撤销"；到期未结案的行高亮；没有 `COMPLAINT:MANAGE` 看不到流转和删除；证据文件按 `index`（从 0 起）逐个取，每次点击重新取 `{url, mediaType}`，按 `mediaType` 用图片或相应播放器显示，地址不写日志、不放进可分享的 URL，页面有"查看会被记录"的提示；越界的 404 显示"证据不存在"；页面写明"怎么找到对应的形象还没有定：在法律意见出来之前，只能按投诉人提供的上传者信息人工查找"（规格 5.25）。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 15：内容审核

**Refs:** 规格 5.8；契约 §11.2、§11.4、§17.4 内容审核行。路由取规格 5.0"内容审核"三行（四条路由：队列和详情同一行，`/moderation/:id` 是独立路由）。文本规则页另有一段 `<ConfigForm editPermission="MODERATION:CONFIG" />`：该码的 12 个键（契约表 10 个加额外键 2 个）里 `moderation.text_rules` 就是规则词表，由词表编辑器编辑（`GET/PUT /moderation/text-rules`），参数区只渲染另外 11 个键（契约表里该码的另外 9 个，加契约采纳前的额外键 `moderation.record_retention_days` 和 `moderation.model_check_enabled`；任务 10 的 `editedElsewhere`）。

**Interfaces:**
- Produces: `getModerationContent(id): Promise<{ kind: 'TEXT'; text: string } | { kind: 'FILE'; mediaType: string; url: string; text?: string }>`（`FILE` 带配套文本时多一个 `text` 字段，目前只有声音样本带转写；每次进入详情和签名地址过期后重新取，不缓存、不写日志）；`decideModeration(id, { decision: 'APPROVE' | 'REJECT'; note?: string })`；`getModerationStats({ from, to })`（给总览用）。

**Tests:**
- 内容区只对持有 `MODERATION:REVIEW` 的管理员取内容（契约：`GET …/content` 要 `REVIEW`，规格 5.8 同）；没有 `REVIEW` 的管理员看到记录字段和"无权查看内容"的提示，并且**没有发出取内容的请求**。
- 内容区的 `FILE` 响应带 `text` 字段时（目前只有声音样本带转写文字），在播放器下方显示这段文字（长文字用 `EllipsisPopoverText`，阿拉伯语、泰语长串不撑破）；没有 `text` 字段就不显示这一块；`TEXT` 响应不变。
- `BLOCKED` 的记录没有内容区，显示"自动拦截，未保存原文"；`COMPANION_NAME` 记录得到 404 `CONTENT_NOT_STORED` 时同样没有内容区。
- 内容区按 `mediaType` 选图片、音频、视频播放器；文件地址只出现在媒体元素的 `src` 上，不出现在 `location`、链接或 `console` 输出里；页面写明"查看会被记录"。
- 举报来源的记录显示举报理由和补充说明（`reporterReason`、`reporterDetail`，长文字用 `EllipsisPopoverText`）。
- 判定（后端的回答第 95 条）：拒绝（`REJECT`）时备注必填，通过（`APPROVE`）时可不填（选填且去空白后为空就存 `null`），备注去空白后最多 1000 个码点且不含控制字符；错误的 `details[0].ref`：`decision` 缺失或为空是 `decision`（`EMPTY_NOT_ALLOWED`）、不是 `APPROVE` 或 `REJECT`（区分大小写）是 `decision`（`OUT_OF_RANGE`），拒绝时缺备注是 `note`（`EMPTY_NOT_ALLOWED`）、超长是 `note`（`TOO_LONG`）、含控制字符是 `note`（`OUT_OF_RANGE`）；`{id}` 不是 UUID 是没有 `details` 的 400；记录不存在 404；记录已处理是 409 `INVALID_STATE`，`data.status` 是当前状态（`APPROVED`、`REJECTED`、`BLOCKED`）；成功 `data` 为 `null`，页面不读响应；确认弹窗先显示这次判定对该类内容的后果（文字取契约 §11.4 的效果表，每种内容类型一条）；连点只发一次请求；"通过""拒绝"按钮只对持有 `MODERATION:REVIEW` 的管理员渲染。
- 队列默认按等待时长排序，顶部显示最老一条的等待时长；来源筛选含"投诉"，内容类型含 `AVATAR_IMAGE`、`ACTION_CLIP`。列表接口只有 `status`（`PENDING_REVIEW`、`APPROVED`、`REJECTED`、`BLOCKED`）和 `source`（`AUTO`、`REPORT`、`COMPLAINT`）两个筛选加分页，不认 `contentType`，发了也被静默忽略（后端的回答第 61 条）：内容类型筛选做成对已读到的这一页的前端过滤，旁边写明"只筛选当前页，页数和总数按全部类型计"，不用"发参数再过滤"冒充服务端筛选，也不依赖它的分页和总数；队列固定"最老的在前"（`created_at` 升序），不带 `status` 会混进已处理、已拦截的记录，所以待处理队列总是带 `status=PENDING_REVIEW`；`status`、`source` 的非法值是 400（`ref` 为参数名，`OUT_OF_RANGE`），空字符串当作不筛选；后端加了 `contentType` 之后改为发参数（见请求清单）。
- 文本规则：每条规则的字段是匹配文本（`pattern`，1..200 个码点）、匹配方式三种（`SUBSTRING`、`WORD`、`REGEX`）、级别（`REVIEW`、`BLOCK`）、备注；页面说明存在：匹配前会做规范化（不分大小写、去掉零宽字符），`SUBSTRING` 和 `WORD` 规则在规范化之后另外做形近字折叠（把另一种文字里长得一样的字母折成同一个，例如规则用西里尔字母写的词同时命中大小写两种写法，用形近字母替换了拉丁字母的文本也会命中拉丁写法的规则；只折叠另一种文字的形近字，ASCII 和同一文字内的字母不折叠），`REGEX` 规则不折叠、行为不变；已知副作用写进说明：全大写的俄语词可能命中用拉丁字母写的规则，土耳其语的规则可能命中带无点 ı 的词；正则有执行时间预算、命中 `BLOCK` 的内容不会再发给审核服务；`note` 最多 200 个码点；`REGEX` 在前端用 `new RegExp` 只给**不阻止保存**的提示（后端用 Java `Pattern`，语法有差异，以后端为准）；泰语、阿拉伯语的 `SUBSTRING` 规则能录入并回显；`SUBSTRING`、`WORD` 的 `pattern` 在规范化和折叠后去空白为空时仍是 `EMPTY_NOT_ALLOWED`（接口和错误码都没变），假后端按此校验。接口（后端回复第 8 条）：`GET/PUT /moderation/text-rules` 的请求体和响应都是 `{items:[{id, pattern, matchMode, level, note}]}`（按保存的顺序，两个方法都要 `MODERATION:CONFIG`）；`PUT` 是原子的整表替换：带 `id` 且在当前词表里的元素沿用该 `id`，不带 `id` 或 `id` 不在当前词表里的是新增，当前有而请求里没有的被删除；响应含新生成的 `id`；校验失败时 `data.details` 的 `ref` 一律是该元素在请求数组里的下标（从 0 起的字符串），原因 `EMPTY_NOT_ALLOWED`（`pattern` 去空白后为空）、`TOO_LONG`（`pattern` 或 `note` 超长）、`OUT_OF_RANGE`（`matchMode`、`level` 不在取值内）、`INVALID_PATTERN`（`REGEX` 不能编译），按下标把错误对到行；条数超过 `moderation.text_rules_max` 时 `details` 只有一项，`ref` 为 `items`、原因 `OUT_OF_RANGE`，提示显示在整张表上；任何一项不合格什么都不保存，页面保持编辑内容不丢。
- 审核统计：日期范围用 UTC 日；`avgHandleSeconds`、`oldestPendingSeconds` 为 `null` 时显示"—"。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 16：用户（列表、详情、导出、删除任务、多开检测）

**Refs:** 规格 5.7、5.7a；契约 §2.8、§13.1、§17.4 用户管理行、认证事件行、多开检测行、账号状态与后台操作矩阵。路由取规格 5.0"用户"中除"站内通知"外的四行。**依赖：任务 11、12、13、14**（详情的订阅与权益、额度、记忆、形象与服装页签用它们的接口）。

**Interfaces:**
- 响应类型（后端回复第 6–9 条）：
  - `UserDetail`：`User` 的列 `id`、`email`、`emailVerifiedAt`、`phone`、`phoneVerifiedAt`（邮箱、手机号的掩码与列表一致）、`status`、`banReason`、`bannedAt`、`currentAvatarAssetId`、`currentVoiceAssetId`、`personaModerationStatus`、`companionName`、`timezone`、`conversationLanguage`、`lifetimeGrantSeconds`、`lifetimeUsedSeconds`、`channelCode`、`registerPlatform`、`priorInviteeRewarded`、`inviteRewardedCount`、`createdAt`，加派生字段 `loginMethods`（`EMAIL`、`PHONE`、`GOOGLE`、`APPLE` 中现有的）、`trafficType`（`PAID` 或 `ORGANIC`）、`companionship`（`{interactionCount, currentStreak, lastInteractionDate, lastInteractionAt}`，没有养成数据时 `0`、`0`、`null`、`null`）、`counts`（`{avatars, voices, looks, cosmetics}`）、`attribution`（`{source, matchType, mediaSource, campaign, installTime, registeredAt}`，没有归因记录时整个字段为 `null`）；后端不返回人设、密码哈希、第三方登录标识。
  - `AccountAvatars = { avatars: { assetId; name; style; createdAt; currentLookId; isCurrent; looks: { lookId; status; outfitItemId; backgroundItemId; previewUrl; createdAt }[] }[]; cosmetics: { itemId; itemKey; source: 'CREDITS'|'ADMIN_GRANT'; creditLedgerId; grantedAt }[] }`（形象按 `createdAt` 倒序；`style` 在形象上，不在外观上）。
  - 设备 `GET /users/{id}/devices` → `{items:[{id, platform, appVersion, locale, lastSeenAt, tokenSuffix}]}`（令牌末 6 位，不分页）；认证事件 `GET /users/{id}/auth-events` → `{items:[{type, reason, deviceIdHashPrefix, ipHashPrefix, at}], total}`（两个哈希只给前 8 位，设备哈希为空时 `null`）；多开聚类的账号 `GET /abuse/clusters/accounts` → `{items:[{accountId, createdAt, status, paid, registerMethod}], total}`（`paid` 布尔，`registerMethod` 取 `EMAIL`、`GOOGLE`、`APPLE`、`PHONE`）；删除任务行是 `AccountDeletion` 的列加 `requestedByUsername`。
- Produces: `BanUserModal`（属性 `{ accountId; status; onDone }`，多开检测页复用）、`StartDeletionModal`；详情页签：概览、形象与服装、归因、会话、设备、认证事件、订阅与权益、额度、记忆（各页签需要对应的查看权限才出现）。

**Tests:**
- 用户列表的筛选项齐全：账号 ID、邮箱（完整精确）、手机号（完整 E.164 精确）、状态、注册渠道、流量类型（付费、自然）、媒体来源。
- 邮箱、手机号：没有 `USER:EMAIL_VIEW` / `USER:PHONE_VIEW` 时原样显示后端给的掩码值；筛选框提交的是用户输入的完整值（不做模糊、不截取）。
- 详情：概览页签显示 `loginMethods`、`trafficType`、`companionship`、`counts`；`attribution` 为 `null` 时显示"没有归因记录"；设备页签显示令牌末 6 位（`tokenSuffix`），认证事件页签的设备、IP 列显示前 8 位哈希（`deviceIdHashPrefix`、`ipHashPrefix`，为空显示"—"）；多开聚类的账号行用 `paid` 决定有没有"封禁"按钮；形象与服装页签里外观的预览图用 `previewUrl`（`null` 显示占位图，不缓存地址）。
- 会话页签（后端的回答第 59 条）：`GET /users/{id}/sessions` 响应 `{items,total}`，按 `requestedAt` 倒序、相同时按 `id` 倒序，每行只有九个字段：`id`、`accountId`、`deviceId`（账号会话恒为 `null`）、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`；**没有 `endReason`**，页签不读也不显示结束原因列，需要时点开某一行调 `GET /sessions/{id}`（返回会话全部列）取；账号不存在或 id 不是 UUID 是 404 `RESOURCE_NOT_FOUND`；假后端的行同样只有这九个字段。
- 封禁 / 解封按钮只对 `USER:BAN` 渲染（后端已确认 ban、unban 都要 `USER:BAN`）；封禁：理由必填，1..500 个码点，旁边有"这是写给用户看的文字，只有一种语言"；弹窗确认文字写明"封禁会结束进行中的通话（通常立即结束；个别通话没能立即结束时，后台会在一个扫描间隔内以结束原因 `BANNED` 结束它们，所以通话记录页稍后会显示它们已结束），不作废登录令牌，解封后原令牌继续可用"；重复封禁仍是 409 `INVALID_STATE`，页面展示当前状态；状态为 `PENDING_DELETION` / `DELETING` 的账号封禁按钮禁用；连点只发一次。
- 发起 / 取消删除按钮只对 `USER:DELETION` 渲染；发起删除：理由 1..200 个码点，说明有宽限期；状态已是待删除 / 删除中时按钮禁用；取消删除只在 `PENDING_DELETION` 且在宽限期内可用；账号处于这两种状态时，发放权益、新建额度申请、指派模型的按钮禁用。
- 发放限时权益：理由必填，页面写明"不影响商店里的订阅"；撤销有行内确认。
- 删除任务页：`FAILED` 行有"重试"；`attempts` 达到 `useAdminMeta().deletionAlertAfterFailures` 的行高亮，取不到阈值时不高亮（不写死数字）；原因枚举六种都有本地化文字，为空时显示"—"。
- 删除任务的 `lastError`（未完全核实，后端的回答第 13 条）：后端拼出的文字最长 255，没有逐个删除步骤核实异常类型，也不能保证它不含内部主机名或用户内容；页面只当纯文本显示（不当 HTML、不解析、不读 `stepStates`），不截断，不写日志，不放进可分享的链接。
- 导出按钮只对同时持有 `USER:EXPORT` 和 `USER:VIEW` 的管理员渲染（契约：`GET /users/export` 两个码都要），参数与当前筛选一致，规则同 `ExportButton`。
- 详情"形象与服装"页签里拥有的服装显示来源 `source`（额度兑换或运营赠送）。
- 多开检测：两个页签（设备、IP）；阈值输入框留空表示服务器默认值（不发该参数），`useAdminMeta().abuseClusterMinFreeAccounts` 有值时作为占位提示；展开聚类后免费账号行有"封禁"（需要 `USER:BAN`），付费账号行没有；页面顶部的两条说明存在。
- 详情的"形象与服装"页签只要 `USER:VIEW` 就可见，页签里写明"预览图是用户的脸，查看会被记录"；"赠送服装"需要 `COSMETIC:GRANT` 且理由必填。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 17：日报与留存报表

**Refs:** 规格 5.2、5.3、4.4；契约 §17.6。路由 `/stat/daily`、`/stat/retention`（`STATS:VIEW`）。

**Interfaces:**
- Consumes: 任务 9 的全部统计组件与 `getDaily`、`getRetention`、`getReactivation`
- Produces: `buildDailyColumns(platform: string): ColumnDef[]`（平台不是 `ALL` 时业务类列标记为"无平台维度"）

**Tests:**
- 日报有两个页签：趋势图（指标多选，默认日活加新增账号）和数据明细（表格不分页，左侧固定日期列）。
- 平台不是 `ALL`：业务类列所有单元格显示"—"，表头旁有"这些指标没有平台维度"；`ALL` 时正常显示。
- 人均通话分钟 = `callSecondsTotal / 60 / accountsWithCall`，分母 0 显示"—"；`activeSubscriptions` 为 `null` 显示"—"，`activeSubscriptionsBackfilled` 为真的值带"回填"标记；七个指标列有提示图标。
- 趋势图缺失日期补 0；多日范围只逐日显示，页面上没有任何"合计"列或卡片（周活、月活、日活不跨日相加）。
- 留存：三个页签（活跃、通话、回流）；D1、D3、D5、D7、D14、D21、D30、D60、D90 多选，默认 D1、D7、D30；回流的沉默天数 7 / 14 / 30，默认 7；未到期格显示"—"；"如何阅读此报表"提示面板可关闭。
- 落地条：日报同时落地 `daily-event` 和 `daily-business`；留存页签落地 `retention` / `reactivation`；日期标签在留存页是"检查日"并有"回填该日对应各 N 的格子，不是整行重算"的说明。
- 导出：名字分别是 `daily`、`retention`、`reactivation`，参数等于当前筛选。
- 页面顶部有"统计日按 UTC 计算"；渠道包下拉取自 `getChannels`。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 18：游客统计

**Refs:** 规格 5.4；契约 §17.6（游客转注册、游客留存、游客额度使用）。路由 `/stat/guest`（`STATS:VIEW`），四个页签。

**Interfaces:**
- Produces: `buildConversionDistribution(rows: GuestCohortRow[]): { bucket: string; devices: number }[]`（八档：同日、D1、D2、D3、D4–D5、D6–D7、D8–D14、D15–D30，各档是相邻两列累计值之差，按各 cohort 求和，未到期的格子不计入）；`buildConversionStack(rows)`（每个 cohort 一根柱，分段：同日、次日、第 2 日、第 3 日及以后）

**Tests:**
- `buildConversionDistribution`：手算例子（两个 cohort，一个已全部到期，一个只到期到 D3）得到预期的八档，未到期的格子不计入任何档；各档之和等于参与计算的 cohort 的 D30（或最后到期列）累计转化数之和。
- 游客日报的转化率 = `guestDevicesConverted / guestDevicesNew`，列提示写明它不是同一批设备的转化率；分母 0 显示"—"。
- 额度使用：六张卡片的公式——未用占比 `neverCalled / (devices − noGrant)`、用完占比 `exhausted / (devices − noGrant)`、人均已用分钟 `avgUsedSeconds / 60`；`devices − noGrant` 为 0 时显示"—"；`configuredTotalSeconds` 为 `null` 显示"未配置，游客不能通话"；六档柱状图与分档转化表（转化率 `converted / devices`）。
- 跳到系统配置 `guest.call_minutes_total` 的链接只对 `CONFIG:MANAGE` 渲染。
- 落地条在游客日报、转化进度队列、游客留存三个页签出现，落地 `daily-business`、`guest-cohort`、`guest-retention`；额度使用页签没有落地条。
- 导出：游客日报导出名 `guest`，游客留存导出名 `guest-retention`，参数等于当前筛选；游客留存页签的提示写明"cohort 是设备第一次出现的那一天，已转注册的设备照常计入，没有通过设备校验的设备不在内"。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 19：通话（会话列表、通话分析、通话质量）

**Refs:** 规格 5.5；契约 §4.1、§17.4 通话行、§17.6 通话质量。路由 `/sessions/list`（`SESSION:VIEW`，详情用抽屉）、`/sessions/analytics`、`/sessions/quality`（`STATS:VIEW`）。

**Interfaces:**
- Consumes: 任务 9；构建变量 `ADMIN_QUALITY_MIN_SUCCESS_RATE`（默认 0.95）、`ADMIN_QUALITY_MAX_SLOW_SHARE`（默认 0.05），加入任务 6 的 `buildVars`

**Tests:**
- 会话列表：游客会话的账号列显示"游客"且无链接，设备只显示前 8 位；账号会话的账号 ID 链接到 `/users/:id`；筛选含是否游客、是否进行中、是否到点强制结束（`endReason=DEADLINE`）。请求参数按后端的回答第 54 条：`accountId` 必须是 UUID（否则 400，`ref=accountId`、`INVALID_FORMAT`）；"是否进行中"的参数叫 `inProgress`（不是 `ongoing`），`true` 表示 `endedAt` 为空，`false` 表示有结束时间；`guest` 为 `true` 查账号编号为空的会话、`false` 查有账号编号的；这两个布尔参数只认小写 `true`、`false`，`1`、`yes`、`TRUE` 都是 400（`OUT_OF_RANGE`）；`from`、`to` 作用于 `requestedAt`，是 ISO-8601 时刻（不是 `YYYY-MM-DD`），`from` 含、`to` 不含：页面把所选的 UTC 日范围用 `utcDayRangeToInstants` 转成以 `Z` 结尾的时刻再发，保守起见不发带 `+08:00` 之类偏移的写法（后端对偏移写法是否可解析没有核实，未完全核实），格式不对 400（`ref` 为 `from` 或 `to`，`INVALID_FORMAT`），后端不检查 `from` 早于 `to`、没有最大跨度；`endReason` 取 `DEADLINE`、`USER_LEFT`、`ROOM_FINISHED`、`BANNED`、`SUPERSEDED` 之一（其他值 400，`ref=endReason`）；只发有值的参数（空字符串被当作没传；后端不认识的参数名被静默忽略，这是读代码推断、没有发请求验证，所以参数名一律按这里写）；按 `requestedAt` 倒序（再按 `id` 倒序），响应 `{items,total}`，每行 `id`、`accountId`、`deviceId`（游客才有，前 8 位）、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`。假后端按此返回。
- 通话质量：接通成功率 = `connected / (connected + agentUnavailable)`；平均接通耗时 = `joinMsSum / connected`；四档互斥，总和等于 `connected`；接通成功率低于阈值或 >10 秒占比高于阈值的卡片红框（阈值取构建变量，断言换阈值后结果变化）；分母为 0 显示"—"。
- 会话详情抽屉：显示 `maxDurationMinutes`（整数分钟，不小于 0，不为空）"发起这次通话时记下的通话时长上限"，旁边说明"之后管理员改系统配置不影响已发起的通话，所以它可能和现在的设置不同"；列表的九列不变，不加这一列；`maxDurationMinutes` 缺失（真后端还没上线）时这一项显示"—"，不报错；假后端的详情带这个字段，且改过 `session.max_duration_minutes` 的假数据里有一条和当前设置不同的会话。结束原因 `endReason` 的取值里 `BANNED`（账号被封禁后结束；封禁时没能立即结束的通话，由后台的到期扫描在一个扫描间隔内以它结束）在抽屉里有本地化文字，测试一个 `BANNED` 的会话；列表的筛选不变。
- 通话分析：人均通话分钟、人均通话次数分母为 0 显示"—"；落地条 `daily-business`；通话质量落地条 `session-quality`，通话质量导出名 `session-quality`。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 20：埋点管理（事件汇总、事件明细、漏斗）

**Refs:** 规格 5.6；契约 §7、§17.4 埋点管理行。路由（页面）`/analytics/summary`、`/analytics/detail`、`/analytics/funnel`（`ANALYTICS:VIEW`）；服务函数用契约的接口路径（页面路由不是接口路径，契约 §17.4 开头明说）：`GET /analytics/events`、`/analytics/event-summary`、`/analytics/event-names`、`/analytics/funnel`、`GET/POST/PUT/DELETE /analytics/funnels`。事件汇总接口不分页，一次返回全部事件名（前端分页 50）。

- 响应类型（后端回复第 13 条）：`GET /analytics/event-summary` → `{items:[{eventName, pv, uv}]}`（不分页，按 `pv` 倒序、相同按 `eventName` 升序）；`GET /analytics/event-names` → `{items: string[]}`（升序）；`GET /analytics/funnel` → `{steps:[{eventName, count, conversionFromPrevious}]}`，与请求的 `steps` 同序同数，`count` 是该步去重主体数，`conversionFromPrevious` 是 0 到 1 的小数，第一步以及上一步 `count` 为 0 时为 `null`。
- 时间范围（后端的回答第 56 条）：`events`、`event-summary`、`event-names`、`funnel` 四个接口规则相同。`from`、`to` 必填，是 ISO-8601 时刻（例如 `2026-10-01T00:00:00Z`），传 `YYYY-MM-DD` 会 400（`INVALID_FORMAT`）；区间是 [`from`, `to`)，含 `from`、不含 `to`，按事件的 `receivedAt` 过滤，所以所选日历日 [a, b] 要转成 `from = a 00:00:00Z`、`to = (b 的次日) 00:00:00Z`（用 `utcDayRangeToInstants`）才含最后一天；没有默认范围，缺哪个都是 400（两个都缺先报 `from`），所以页面必须有默认的时间范围、总是传两个参数；跨度按时长算：`to − from` 大于 `analytics.live_max_range_days` 天（默认 31，每次请求现读）才拒绝，恰好 31×24 小时通过，不是"含两端的天数"；错误：`to` 不晚于 `from`（含相等）是 `ref=to`、`OUT_OF_RANGE`，跨度超限是 `ref=to`、`OUT_OF_RANGE`，格式错是 `from` 或 `to`、`INVALID_FORMAT`；MongoDB 30 秒内没查完是 `ref=from`、`TOO_SLOW`，漏斗读取超过 200000 次是 `ref=from`、`TOO_MANY_EVENTS`；`events` 的检查顺序是先范围、再 `name` 格式；事件明细要精确到分钟，页面提供时间选择，直接发带分钟的 ISO 时刻，跨度仍按 31 天算；保存的漏斗 `/analytics/funnels` 不带 `from`、`to`，不受这些限制。假后端按此返回。
- 事件明细的参数与行（后端的回答第 26 条）：参数 `accountId`、`deviceId`、`name`（**不是 `eventName`**，必须匹配 `[a-z0-9_]{1,64}`，否则 400，`ref=name`、`INVALID_FORMAT`）、`from`、`to`、`page`、`pageSize`（默认 1 和 20，最大 200，超出是 400，不会被截断）；按 `receivedAt` 倒序（相同时每行的 `seq` 大的在前）；行字段 `id`（24 位十六进制字符串，作列表行键）、`accountId`、`deviceId`、`name`（事件名叫 `name`，不是 `eventName`）、`source`（`CLIENT` 或 `SERVER`）、`params`、`context`、`clientTime`、`receivedAt`、`seq`、`ip`、`country`；事件行没有单独的平台、版本列，平台和版本从 `context.platform`、`context.appVersion` 读（`context` 里另有 `osVersion`，以及可能为 `null` 的 `deviceModel`、`locale`、`network`、`channel`）；`source=SERVER`（后端自己写的事件）的行 `context`、`clientTime`、`ip`、`country`、`deviceId` 都是 `null`，这样的行平台和版本列显示"—"；同一个接口族里 `event-summary` 和 `funnel` 的行事件名字段叫 `eventName`，只有 `events` 的行叫 `name`。假后端的行同此形状。

**Tests:**
- 事件汇总：默认按 `pv` 降序，前端分页 50；日期范围默认 7 天（`DateRangeUtc` 的 `maxDays` 取 `useAdminMeta().analyticsLiveMaxRangeDays`），超过后端上限而前端没有这个值时展示后端的 `INVALID_REQUEST` 文字。
- 事件明细：时间范围必填；IP 列原样显示后端给的值（掩码或完整），后端关闭 `events.store_client_ip` 之后写入的事件 `ip` 为空，显示"—"（国家照常显示）；展开行显示格式化的 `params`、`context` JSON；`clientTime` 列带"客户端自报，不可信"提示；事件名联想来自 `event-names`。
- 漏斗：步骤 2..10 个，不足或超过时不能查询；`windowHours` 1..720，默认 24；事件名里不含逗号（含逗号时拒绝，因为参数用逗号连接）；预设漏斗带"系统预设"标签、没有编辑、删除，自定义的有且需要 `ANALYTICS:FUNNEL_MANAGE`；相邻步骤转化率取响应的 `conversionFromPrevious`（0–1 小数，显示成百分比；`null` 显示"—"，前端不自己重算）；保存的漏斗另存为、编辑、删除各调对应接口；提示面板写明"同一账号按顺序在窗口内依次完成各步骤才算"，去重人数不跨日聚合。漏斗查询有并发上限：参数合格但这个后端实例同时在算的漏斗已达 `analytics.funnel_max_concurrency`（默认 2）时，立刻答 429 `RATE_LIMITED`，不排队，没有 `data`，也没有 `Retry-After` 头：页面显示"漏斗计算繁忙，请稍后再试"，不显示倒计时，不自动重试，查询按钮恢复可用；选已保存的漏斗后自动查询得到 429 时同样只显示这条提示，不循环重发；保存的漏斗列表（`/analytics/funnels`）不受这个上限；检查顺序是 `steps` → `windowHours` → 日期范围 → 并发上限 → 计算，假后端按此顺序，并能由测试把名额占满以触发 429；计算本身超时仍是 400 `INVALID_REQUEST`，原因 `TOO_SLOW`，页面显示按原因翻译的文字。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 21：总览

**Refs:** 规格 5.1；契约 §17.6 总览页一行。路由 `/dashboard`（登录即可）。**依赖：任务 13（告警）、15（审核统计）、17。**

**Interfaces:**
- Produces: `computeCardChange(series: Array<{ date: string; value: number | null }>, today: string): { current: number | null; vsYesterday: number | null; vs7DaysAgo: number | null }`；`latestCohortWithD1(rows)`

**Tests:**
- `computeCardChange`：百分比变化；留存用百分点差；前一天缺失或为 0 时变化为 `null`（显示"—"）；当天值标注为临时值。
- D1 留存卡取 `ACTIVE` 类型里最新一个 `d1` 非空的 cohort。
- 六张统计卡按权限显示：没有 `STATS:VIEW` 没有统计类卡片；没有 `MODERATION:VIEW` 没有审核积压卡；没有 `MONITOR:VIEW` 没有未处理告警卡；快捷入口按目标页面权限显示。
- 统计类请求恰好 4 个：`/stats/daily`（`ALL`，90 天）、`/stats/retention`（90 天）、`/stats/daily?platform=ANDROID`、`…IOS`（只取当天）；另外持有 `MODERATION:VIEW` 时多 1 个 `/moderation/stats`，持有 `MONITOR:VIEW` 时多 1 个 `/alerts?status=OPEN`，没有这两个权限就不发。
- 趋势图指标多选至少保留一个，默认日活加新增账号，每个指标叠加虚线的"上周同期"；范围预设五种。
- 当天值旁的刷新说明：`useAdminMeta().landIntervalMinutes` 有值时写出数字，没有时只写"今日数据是临时值"，不写死数字。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 22：推送

**Refs:** 规格 5.11；契约 §8.3–§8.5、§17.4 推送管理行。路由取规格 5.0"推送"六行（记录详情用抽屉）。召回参数页渲染 `<ConfigForm editPermission="PUSH:CONFIG" />`，即该码的全部 13 个键（契约表里的 12 个，加契约采纳前的额外键 `push.task_poll_seconds`；规格只点名了 `recall.*` 与 `push.default_locale`，其余键同样只有这一页够得着）。

**Interfaces:**
- Consumes: 任务 8 的 `UploadField`、`LinkTargetField`；`useAdminMeta()` 的 `supportedLocales`、`pushImageMaxBytes`

**Tests:**
- 模板列表的响应是 `{items, missingLocales: {daily_recall: string[], streak_at_risk: string[]}}`：两个召回原因各一个数组，列出 `app.supported_locales` 里还没有**启用**模板的语言（按该设置的顺序，全都有则为空数组，该原因下没有任何启用模板时是整个语言清单），不受 `triggerReason`、`locale` 过滤影响（过滤只缩小 `items`）。矩阵：行是触发原因，列是 `supportedLocales`，`missingLocales` 里的格子标成中性的信息"回退到默认语言"，不标红、不当错误，也不阻止保存；某个原因的所有列都在 `missingLocales` 里（没有任何启用的模板）时，该行标"没有启用的模板"；`supportedLocales` 缺失时不显示矩阵，只显示模板列表；响应里没有 `missingLocales`（真后端还没上线）时不标任何格子，也不报错。模板列表只请求一次，不翻页、不发 `page`、`pageSize`（后端没有分页，传了被忽略且仍返回全部模板；响应也没有 `total`，所以"有 `total` 就读到取够、没有就读到空页为止"会死循环，因为第二页还是同样的全部内容）；筛选参数只有 `triggerReason`、`locale`，精确匹配、不校验取值（取值不对得到空列表，不是 400），排序按 `triggerReason`、`locale`、`id`（后端的回答第 33 条）。
- 召回模板规则只在后端校验，前端不复刻：规则是"每个召回触发原因只要有一条启用的模板，就必须有一条默认语言（`push.default_locale`）的启用模板"，其他语言可选并回退到默认语言，语言标签区分大小写地精确比较。创建（`enabled=true`）、编辑、停用、删除违反它时后端答 400 `INVALID_REQUEST`，什么都不写，`data` 为 `{defaultLocale, reason}`（默认语言和触发原因）：页面显示一条按码翻译的文字，把这两个值填进去，并写出做法——"先启用默认语言的模板；要停用、删除或改掉默认语言的模板，先停用同一原因下其他语言的模板；唯一启用的模板是默认语言时不能把它改成别的语言，请保持它为默认语言并启用，另建其他语言的新模板"；这条文字不区分后端的三种情形（后端 `message` 能区分，需要结构化字段才能在不读 `message` 的前提下区分，见问题文件），页面不显示 `message`。模板页顶部写明运营怎么用：一个原因的第一条要启用的模板必须是默认语言的；之后其他语言任意顺序创建、启用、停用、编辑、删除；默认语言那条只有在同一原因下别的语言都已停用后才能停用或删除（它是唯一启用的模板时随时可以）；整体关掉一个原因，先停其他语言、最后停默认语言；改 `push.default_locale` 之前，先为每个有启用模板的原因启用新语言的模板；往 `app.supported_locales` 加语言不需要先动召回模板。假后端实现这条规则和错误形状；保存 `app.supported_locales` 不再因为召回模板被拒。
- 图片：`UploadField kind="pushImage"`，只接受 JPEG / PNG，上传前按 `pushImageMaxBytes` 检查大小（取不到该值时不检查，后端拒绝时显示按错误码翻译的文字）；上传中提交按钮禁用；提交只带 `uploadId`，请求体里没有 `imageUrl`。
- 模板、手动任务、周期推送的文字与链接（后端的回答第 34 条）：标题去空白后 1 到 100 个码点、正文 1 到 500 个码点（一个汉字或一个表情算一个码点，不是 UTF-16 单位；页面计数和假后端都按 100、500，不再按 200、1000）；空白、全是空白、缺失是 400 `EMPTY_NOT_ALLOWED`，超长是 `TOO_LONG`，含 NUL 是 `INVALID_CHARACTER`；`linkType=NONE` 时 `linkTarget` 传 `""`、`null`、不传都接受（都存成 `null`），`NONE` 配非空 `linkTarget` 是 400（`ref=linkTarget`、`OUT_OF_RANGE`），`linkType` 不传按 `NONE`；图片：请求只认 `uploadId`（带 `imageUrl` 是 400，`ref=imageUrl`；带 `imageUploadId` 不报错但被忽略），响应里的字段叫 `imageUploadId` 和 `imageUrl`（请求叫 `uploadId`，两边名字不同），所以不要把 GET 到的 `imageUrl` 或 `imageUploadId` 原样带回 `PUT`；`PUT` 里带 `"uploadId": null` 是去掉图片（旧上传记录随即删除），页面在有图片的行上提供"去掉图片"；不带 `uploadId` 或带当前值是不变，带新值是换图；模板的 `enabled` 请求里不传按 `false`，`PUT` 是整行替换，所以 `PUT` 必须带 `enabled`（否则会被当作 `false` 而停用）。
- 模板的 `PUT`（后端的回答第 35 条）：`PUT /push/templates/{id}` 必须带 `triggerReason`、`locale`、`title`、`body`、`enabled`（整行替换，缺 `triggerReason` 或 `locale` 是 400 `EMPTY_NOT_ALLOWED`；"`PUT` 不带这两项"会得到 400），所以改语言、改原因都做得到，唯一启用的默认语言模板被改成别的语言的情形在这里会出现；改成已存在的（原因，语言）组合是 409 `DUPLICATE_RESOURCE`，`data.field` 为 `locale`；`triggerReason` 不是两个召回原因之一是 400（`ref=triggerReason`、`OUT_OF_RANGE`）；后端的检查顺序：请求体形状（400 `details`）→ 锁行（404）→ 换图 → 召回原因与默认语言规则（400，`data` 带 `defaultLocale`、`reason`，目前没有 `case`）→ 唯一性（409），同一个事务，任何一步失败整体回滚（包括图片的占用和删除）；默认语言规则被拒时仍显示上面那条不区分三种情形的通用文字，后端给了 `case` 之后再拆开（见请求清单）。
- 链接用 `LinkTargetField`：类型 `NONE`（点击只打开 App）、`SCREEN`（目标是 `SCREEN_TARGETS` 的下拉）、`URL`（走 `LinkInput`，总长 ≤ 2048）；模板、手动任务、周期推送三处都一样。
- 手动任务：受众选"账号 ID 列表"时平台、语言筛选禁用；`PENDING` 和 `RUNNING` 行都有"取消"（后端的回答第 72 条：正在发送的任务也能取消，执行器在下一次读状态时停下，已发出的计数保留；确认文字写明"已经发出的不会撤回"），`DONE`、`CANCELLED` 的任务取消是 409 `INVALID_STATE`，`data.status` 是当前状态，任务不存在 404，成功时 `data` 是取消之后的整条任务（`status=CANCELLED`、有 `finishedAt`）；任务列表支持 `status` 筛选（`PENDING`、`RUNNING`、`DONE`、`CANCELLED`，别的值 400，`ref=status`），按创建时间（`createdAt`，再按 `id`）倒序而不是按计划时间，每项带 `createdByUsername`（管理员已删除时为 `null`）；立即发送不要带 `scheduledAt`（不带或 `null` 就是立即，后端填创建时刻；带了而且早于服务器当前时刻是 400，`ref=scheduledAt`、`OUT_OF_RANGE`，客户端时钟稍慢或请求在路上耗时就会被拒）；定时发送带 ISO-8601 且必须带时区偏移的时刻（`2026-11-03T10:00:00Z` 或 `+08:00` 都行，不带偏移是 400）；`accountIds`（受众 `ACCOUNT_IDS` 时必填）1 到 10000 个 36 位带横线的 UUID 字符串，重复是 400（`ref` 是那个重复的编号、`DUPLICATE`），格式不对或超过 10000 个是 `ref=accountIds`、`OUT_OF_RANGE`，为空 `EMPTY_NOT_ALLOWED`，后端创建时不检查这些账号是否存在；任务列表里状态 `CANCELLED` 且备注（`note`）为 `MISSED` 的行显示本地化文字"错过执行时间，未发送"（推送执行器停机超过 `push.schedule_catchup_minutes` 后，已经开始但还没发出任何一条的任务会被取消，而不是继续 `RUNNING` 后补发），其他备注原样显示；周期推送：每月 31 日在短月取月末的提示存在，时区下拉默认 UTC 并说明"固定时区，不是每个用户的当地时间"；删除的文字是"停用，已生成的任务保留"。
- 推送效果：点开率 = `pushesOpened / pushesSent`，分母 0 显示"—"，列提示写明"点开数记在点开当天"；落地条 `push`；导出 `push`。
- 推送记录页（后端的回答第 114 条）：`GET /push/records` 支持按 `accountId`（36 位 UUID，否则 400，`ref=accountId`、`OUT_OF_RANGE`）和 `triggerReason`（`daily_recall`、`streak_at_risk`、`admin`、`system_event` 之一，否则 400，`ref=triggerReason`、`OUT_OF_RANGE`）筛选，两个可以同用，页面加这两个筛选；不支持按本地日期或创建时间筛选（后端建议加 `from`、`to`，还没做，见请求清单），页面不提供日期筛选；按创建时间倒序（再按 `id`），分页 `{items,total}`，每项 `id`、`accountId`、`pushType`、`triggerReason`、`localDate`、`timezone`、`createdAt`。
- 召回参数页用 `<ConfigForm editPermission="PUSH:CONFIG" />`，`recall.*` 与 `push.default_locale` 和该码的其余键都在里面；`recall.window_minutes`、`recall.scan_interval_minutes` 是 1 到 1440，`push.schedule_catchup_minutes` 是 1 到 10080 并与 `push.task_poll_seconds` 有互相检查的规则，两行都写出规则提示（见任务 10）；没有该码的管理员进不了这个路由。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 23：邀请与分享

**Refs:** 规格 5.12；契约 §9.1–§9.2、§17.4 邀请管理行。路由 `/invite/codes`、`/invite/records`、`/invite/stats`、`/invite/share-stats`（`INVITE:VIEW`）、`/invite/rewards`（`INVITE:CONFIG`，菜单挂在"活动管理"下，照规格 5.0）。

- 响应类型（后端回复第 10 条）：`GET /invites/codes` → `{items:[{id, code, ownerAccountId, createdAt}], total}`（`createdAt` 是所有者账号的创建时间）；`GET /invites/records` → `{items:[{id, inviterAccountId, inviteeAccountId, inviterLabel, inviteeLabel, redeemedAt, rewardStatus, rewardReason, inviterCreditsGranted, inviteeCreditsGranted, rewardedAt}], total}`，按 `redeemedAt` 倒序；列表页显示掩码标识 `inviterLabel`、`inviteeLabel`，不显示完整账号 ID。

**Tests:**
- 裂变层级页签的统计项：平均链路深度（一位小数）、最大链路深度、链数（`totalChains`，根账号数；不叫"节点数"，见冲突表）。
- 邀请统计 KPI：参与率 = `activeInviters / registeredAccounts`；人均邀请数为 `null` 时显示"—"；排行表"查看裂变"切到裂变页签并带上账号；裂变深度输入 `1..inviteChainMaxDepth`（`useAdminMeta` 给，缺失时不限上界、默认 3，由后端校验）；邀请链树节点显示掩码标识。
- 分享统计的取数（后端的回答第 36 条）：`/invites/share-funnel`、`/invites/share-channels` 响应 `{items:[…]}`，没有生成汇总的日子不返回行、也不补空行（只返回已落地的日子，按日期升序，渠道表同一天按 `shareChannel` 排；当天 UTC 的行在统计落地任务第一次运行之后才出现），趋势图缺失日补 0 由前端做；`from`、`to` 是 UTC 日 `YYYY-MM-DD`、两端都含，两个都不传是最近 7 天（含今天），只传一个时另一端取其 ±6 天，跨度不超过 `stats.max_range_days`；错误：`from` 晚于 `to` 是 `ref=from`，超过跨度是 `ref=to`，格式不对是 `from` 或 `to`，原因都是 `OUT_OF_RANGE`，显式传的 `to` 可以晚于今天；漏斗行 `statDate`、`sharePv`、`shareUv`、`linkClickPv`、`linkClickUv`、`downloadClickPv`、`downloadClickUv`、`registered`，其中前六个数在事件来源已过期（事件日志保留期之后补数）时是 `null`、只有 `registered` 有值：`null` 显示"—"，不当 0，不参与合计，比率的分母为 `null` 或 0 时显示"—"；渠道行 `statDate`、`shareChannel`、`sharePv`、`shareUv` 都不为空，`shareChannel` 没有渠道时是字符串 `unknown`（不是 `null`、不是空串），页面把 `unknown` 识别为"无渠道"并显示本地化的"未知渠道"；只有有分享事件的渠道才有行，一个渠道某天没有分享就没有那一行（补 0 由前端做）；`shareChannel` 筛选精确匹配、不校验格式。假后端同此形状。
- 邀请链（后端的回答第 73 条）：`GET /invites/chain` 的参数是 `rootAccountId`（不是 `accountId`）和 `maxDepth`（1 到 `invite.chain_max_depth`，默认 5；不传取 3 与该设置中较小的一个；非整数是 `NOT_AN_INTEGER`，超出范围是 `OUT_OF_RANGE`，不会被截成上限）；缺 `rootAccountId` 是 400（`ref=rootAccountId`、`EMPTY_NOT_ALLOWED`），格式不对是 `INVALID_FORMAT`，账号不存在 404；响应 `{root:{accountId,label,joinedAt}, children:[{accountId,label,joinedAt,children:[…]}], totalDescendants, maxDepth, truncated}`（`children` 在响应顶层，`root` 不带 `children`；没有后代时是 `[]`；响应里的 `maxDepth` 是实际返回节点里最深的一层，没有后代为 0，不是请求的深度）；`joinedAt` 是节点被邀请的时间（根账号自己也是被邀请人则取它被邀请的时间，否则取账号创建时间）；`label` 是掩码标识；不能假定一次画出所有后代：`children` 最多返回 10000 个节点（按层从浅到深，同一上级下按被邀请时间从早到晚取），超出时 `truncated` 为 `true`，页面提示"只显示了前 10000 个节点"，总数用 `totalDescendants`（不受截断影响，是 `maxDepth` 层内的全部后代数）。
- 邀请统计的边界值（后端的回答第 116 条）：范围内没有被邀请人时 `depth-stats` 返回 `depthDistribution: []`、`avgDepth: null`、`maxDepth: 0`（数字 0，不是 `null`）、`totalChains: 0`，页面用 `totalChains === 0`（或 `depthDistribution` 为空）判断显示"—"，不要只靠 `maxDepth` 是否为 `null`；`GET /invites/stats` 的 `limit` 默认 50、范围 1 到 200，超过 200 是 400（`ref=limit`、`OUT_OF_RANGE`），小于 1 同样，不是整数是 `NOT_AN_INTEGER`，页面不传超过 200 的值；没有邀请人时 `avgInvitesPerInviter` 是 `null`；`daily` 每个 UTC 日一行（没有记录的日子是 0，不缺日），`ranking` 可以是空数组。
- 分享统计：总览没有任何 UV 合计卡片；渠道分析的饼图占比与前 5 个渠道加"其他"；漏斗比率 = 本步 ÷ 上一步；落地条同时落地 `share-funnel`、`share-channel`；导出名 `share-funnel`、`share-channel`、`invite-stats`、`invite-records`。
- 奖励设置页用 `<ConfigForm editPermission="INVITE:CONFIG" />` 渲染该码的全部 9 个键（含 `invite.chain_max_depth`），页面写明"金额在发放时记入邀请记录，之后修改只影响之后发放的"。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 24：活动管理（签到、每日任务）

**Refs:** 规格 5.22；契约 §28。路由取规格 5.0"活动管理"中签到、任务相关的四行（共六条路由；奖励设置那一行在任务 23）。

**Interfaces:**
- Produces: `probeActivityOverlap(action, id, body)`：先 `confirm=false`。`PUT /checkin/activities/{id}` 与 `…/status` 的响应是 `{applied: true|false, disabledActivities: [{id, name}], activity: <详情> | null}`（新版契约 28.1）：以 `applied` 判断是否已写入，不看 `disabledActivities` 是否为空——`applied: true` 就是已写入（返回 `null`，不再询问），`applied: false` 才是重叠询问（返回 `disabledActivities`，可以是空列表），由页面弹确认框，确认后以 `confirm=true` 再发

- 响应类型（后端回复第 17 条）：`GET /checkin/activities` 每项是 `CheckinActivity` 的列（`id`、`name`、`startDate`、`endDate`、`status`、`createdBy`、`createdAt`、`updatedAt`）加 `createdByUsername`、`lifecycleStatus`；`GET /checkin/activities/{id}` 另加 `rewards: [{dayNum, rewardCredits, bonusCredits}]`（按 `dayNum` 升序）；`GET /checkin/records` 每项是 `CheckinRecord` 的列加 `activityName`；`GET /tasks/records` 每项是 `TaskRecord` 的列加 `taskName`；名称是读取时的当前名称，对象不存在时为 `null`、ID 照旧（显示"—"和 ID）。

**Tests:**
- 发布 / 启用签到活动、编辑生效中活动的日期范围：先探测；有重叠时确认框列出将被停用的活动名，取消则不发第二次；无重叠直接成功。
- 草稿以外的活动没有删除按钮；奖励阶梯至少一行，"第 N 天"按行序号生成，奖励额度为不小于 0 的整数，额外额度不小于 0、默认 0；页面说明"签到按用户的本地日算，阶梯走完后从第 1 天循环"。
- 任务配置：已有记录的配置，类型与目标值只读；删除失败返回 `TASK_HAS_RECORDS` 时提示改用停用；目标值不小于 1（默认 1），`daily_login` 类型的目标值固定为 1（契约 §28.2）；通话时长类的目标值旁写明单位是秒；奖励额度不小于 0（默认 0）；说明最多 500 个码点并有计数；领取倒计时（秒）可空，旁边写明"空 = 当天内随时可以领取"。
- 任务目标值的上限（未完全核实，后端的回答第 119 条）：后端只检查下限 1，没有上限（`Integer`）；超过 32 位整数范围的数是否得到不带 `details` 的 400 没有核实。页面保守处理：目标值预检不超过 2147483647，后端仍答不带 `details` 的 400 时只显示通用的 `error.INVALID_REQUEST` 文字；`description` 为空时发 `""` 可以，但读回来是 `null`，表单把 `null` 显示为空。
- 任务记录显示任务名称而不是数字 ID；两个统计页标注"日期是用户的本地日"；落地条 `checkin-daily` / `task-daily`；导出 `checkin-daily-users`、`checkin-streaks`、`task-summary`。
- 没有 `CHECKIN:MANAGE` / `TASK:MANAGE` 看不到新建和编辑。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 25：投放管理

**Refs:** 规格 5.13；契约 §10.3–§10.5、§17.4 投放管理行。路由取规格 5.0"投放管理"四行。归因参数页渲染 `<ConfigForm editPermission="ATTRIBUTION:MANAGE" />`，即该码的全部 12 个键（契约表里的 9 个，规格点名了其中 8 个，`attribution.click_expired_keep_days` 也在内；加契约采纳前的额外键 `attribution.postback_enabled`、`attribution.facebook_graph_version`、`attribution.store_click_ip`）。投放效果页的投放账户筛选、归因明细的投放账户筛选，选项来自 `GET /attribution/campaigns`（要 `ATTRIBUTION:MANAGE`），只有 `ATTRIBUTION:VIEW` 的管理员收到 403 时，筛选器禁用并写明缺哪个权限。

**Interfaces:**
- Consumes: 任务 9 的 `getChannels`
- Produces: `parseCostBatch(input: { kind: 'json'; text: string } | { kind: 'csv'; text: string }): { rows: CostRow[]; errors: { line: number; reason: string }[] }`（纯函数；日期接受 `YYYY-MM-DD`、`YYYY/MM/DD`、`YYYY.MM.DD` 并统一成 `YYYY-MM-DD`；任一行出错则 `rows` 为空）

- 响应类型（后端回复第 11 条）：`GET /attribution/clicks` → `{items:[{id, clickedAt, campaignId, campaignName, status, channel, utmSource, utmMedium, utmCampaign, ip, claimedAt}], total}`（按 `clickedAt` 倒序；`status` 取 `PENDING`、`MATCHED`、`EXPIRED`；`channel` 取 `STORE_REDIRECT`、`APK_DOWNLOAD`；`ip` 默认掩码，持有 `ANALYTICS:IP_VIEW` 才完整）；`GET /attribution/campaigns` → `{items, total}`，每项是 `AttributionCampaign` 的列（`id`、`code`、`name`、`mediaSource`、`utmMedium`、`campaign`、`adset`、`ad`、`facebookPixelId`、`googlePixelId`、`tiktokPixelId`、`remark`、`enabled`、`createdBy`、`createdAt`、`updatedAt`）加 `createdByUsername`、`channelCodes`（渠道码数组）、`facebookAccessTokenSet`（布尔，"已设置"就看它，令牌本身永不返回）。

**Tests:**
- `parseCostBatch`：JSON 数组、每行一个对象两种写法；CSV 表头 `campaign_code,stat_date,cost,currency,remark`；三种日期写法归一；负数花费、非数字、缺字段、不存在的日期（`2026-02-30`）各按行报原因；一行错整批 `rows` 为空；超过 `attribution.cost_batch_max` 行时报错（该值从 `GET /config` 读，ATTRIBUTION:MANAGE 可读）；`currency` 与 `attribution.cost_currency` 不同的行不合法（契约 §10.5）；同一批内重复的（投放账户编码，日期）整批拒绝并按行说明。
- 批量录入弹窗：提交前提示"已存在的日期会被覆盖"；提供模板下载 `attribution-cost-template.csv`（表头加两行示例）；JSON 与 CSV 两个页签。
- 成本录入的接口细节（后端的回答第 75 条）：金额请求里可以发 JSON 数或数字字符串（页面发十进制字符串，不经浮点），不能为负，最多两位小数（更多位是错误，不舍入），小于 10^16；响应的 `amount` 是 JSON 数（`BigDecimal`，固定两位小数，如 `12.50`，这一点由字段类型推出、没有看过原始响应，未完全核实），最大可有 18 位有效数字，浏览器解析会丢精度，所以页面把整数部分限制在 13 位以内；成本行字段 `id`、`campaignId`、`campaignCode`、`campaignName`、`statDate`（`YYYY-MM-DD`）、`amount`、`currency`、`remark`、`createdBy`、`createdByUsername`、`createdAt`、`updatedAt`，直接用行里的 `campaignCode`、`campaignName`，不必用 `campaignId` 去对；单条 `POST`、`PUT` 和批量的每一行都可以不带 `currency`（缺省或空串等于 `attribution.cost_currency` 当前值，带了就必须等于它，否则该字段错误 `CURRENCY_MISMATCH`），成本列表每行都带 `currency`，`GET /meta` 里没有成本币种；**批量成功响应是 `{count: N}`**（N 是写入的行数，新增加覆盖的总和），不是 `{imported, overwritten}`，提示写成"已导入 N 行（已存在的日期被覆盖）"，当前后端给不出新增和覆盖各几行（见请求清单）；批量 400 的 `data.details` 每项是 `{index, ref, reason}`：`index` 是数、从 0 起，`ref` 是字段名（`campaignCode`、`statDate`、`amount`、`currency`、`remark`），显示"第 N 行"时用 `index + 1`，不要把 `"<下标>.<字段>"` 当字符串拆；元素不是对象时 `ref` 为 `line`、`reason` 为 `INVALID_TYPE`；整批层面的错误没有 `index`，`ref` 都是 `body`：不是数组 `INVALID_TYPE`，条数超过 `attribution.cost_batch_max`（在读任何一行之前）`OUT_OF_RANGE`，空数组或请求体缺失 `REQUIRED`，不是合法 JSON `INVALID_FORMAT`；行级原因码：`REQUIRED`、`INVALID_TYPE`、`INVALID_FORMAT`、`TOO_LONG`（`remark` 超过 500 个码点）、`CONTROL_CHARACTER`、`OUT_OF_RANGE`（金额不小于 10^16）、`NEGATIVE`、`TOO_MANY_DECIMALS`、`CURRENCY_MISMATCH`、`NOT_FOUND`（`campaignCode` 不存在，或格式就不是合法的投放账户编码，不是 `OUT_OF_RANGE`）、`DUPLICATE`（批内重复的 (`campaignCode`, `statDate`)，这一组的每一行都有一项，不是只标后一行）；所有问题一次列全，整批不写入。单条 `POST`：`campaignId` 指向不存在的账户是 `{ref:'campaignId', reason:'NOT_FOUND'}`，同一账户同一天已有成本是 409 `COST_EXISTS`；`PUT` 只改 `amount` 和 `remark`，带了不同的 `campaignId`、`statDate`、`currency` 是 400（`reason` 为 `IMMUTABLE`）。假后端按此返回。
- 列表与明细的筛选（新版契约 10.3、10.5，负责人已授权按业界做法加）：
  - 投放账户列表：搜索区有“关键字”（`keyword`，对 `code`、`name` 不区分大小写的包含匹配，`%`、`_`、`\` 按字面；输入框限 100 个码点，按码点数不按 UTF-16 单位，粘贴超长时截到 100 个码点且不切开代理对）和“状态”（`enabled=true|false`，其他值 400），放在共用分页表（`PagedListTable`）的筛选列里；此前“离开页签再回来保留搜索与页码”（`initial`/`onCommit`）不变；两者都为空时请求里不带这两个参数。
  - 点击明细：`status`（`PENDING`、`MATCHED`、`EXPIRED`，由 `claimedAt` 和 `expireAt` 现算；持有其 `attrId` 的归因记录让点击也算 `MATCHED`，所以这样的点击也会出现在选“待认领”的列表里，页面写一句说明）和 `keyword`（最多 200 个字符，页面按 200 个码点限制输入；在 UTM 来源、媒介、活动上各自做不区分大小写的字面包含匹配，持有 `ANALYTICS:IP_VIEW` 时还匹配完整等于 `ip`；含 U+0000 是 400 `INVALID_REQUEST`，`details` 为 `keyword`、`INVALID_FORMAT`）；两个筛选都在点“查询”时才发出，并从第 1 页读起。
  - 汇总：`groupBy` 页面只会发三个合法取值，缺失或取值不对后端是 400；这类 400 页面只显示按错误码翻译的文字，不显示后端 `message`。
  - 假后端按此检查：账户关键字超过 100 个码点、点击关键字超过 200 个码点各 400（`ref` 为 `keyword`，`reason` 为 `TOO_LONG`：契约没写这两处的 `reason`，写在 `docs/contract-requests/2026-11-02-new-differences-b4.md`）；关键字在几个字段上各自匹配，不跨字段。
- 投放账户：`code` 符合 `^[a-z0-9_-]{3,32}$`，创建后只读；没有删除按钮，只有状态开关（立即提交，无二次确认）；Facebook 访问令牌输入框永远是空的，已设置只显示"已设置"，留空提交时请求体不含该字段。
- 生成链接：所选平台没有像素编号时提示"请先配置该平台的像素编号"且不发请求；有则显示链接和复制按钮，并显示落地页接口地址；链接根地址未配置的提示。
- 投放效果：比率分母 0 显示"—"；有"未归因"行及其占比；落地条 `attribution-daily`；导出 `attribution-performance`；页面顶部有可关闭的"如何阅读此报表"提示面板。
- 投放效果的行与导出（后端的回答第 38 条）：按账户分组（`groupBy=campaign`，默认）的行带 `campaignId`、`campaignCode`、`campaignName`；按日分组（`groupBy=day`）的行带 `statDate`、不带 `campaignId`。`campaignId` 是 JSON 数，`0` 表示未归因（比较 `=== 0`，不是 `"0"`）；直接用行里的 `campaignCode`、`campaignName`，投放账户列表只在这两个字段为 `null`（账户标签读不到的极少数情况）时作回退。只要请求没带 `campaignId`，两种分组的最后一行都是未归因行，形状固定为 `{campaignId: 0, unattributedInstalls: N}`、没有别的字段（按日分组时该行没有 `statDate`，自然量只在这一行，是整个范围的合计，各日行里没有 `unattributedInstalls`）：按账户分组看 `campaignId === 0`，按日分组看"没有 `statDate` 而有 `unattributedInstalls`"，页面都要识别并显示；选了 `campaignId` 时没有这一行。`cost`、`cpa`、`cpi` 和三个比率（`clickRate`、`installRate`、`registerRate`）在后端是 JSON 数（`cost` 固定两位小数，没有成本行时 `0.00`；`cpa`、`cpi` 两位小数；比率六位小数；分母为 0 时 `cpa`、`cpi`、比率是 `null`）；这一点后端只是由字段类型推出、没有看过原始响应（未完全核实），所以解析时同时接受数和数字字符串，显示用固定小数位格式化，页面自己不对它们做求和等浮点运算，`null` 显示"—"。导出 `GET /stats/export/attribution-performance` 接受 `from`、`to`、`campaignId`、`groupBy`（`campaign` 或 `day`，其他参数忽略），页面导出时带上当前的分组，不固定为 `campaign`；列与报表逐列相同，最后一列多 `unattributedInstalls`（只在未归因行有值）；需要 `STATS:EXPORT` 加 `ATTRIBUTION:VIEW`。
- 归因明细的三个页签（后端已定的接口）：
  - 点击明细：`GET /attribution/clicks`；页面注明点击记录只保留多少天（`useAdminMeta().attributionClickRetentionDays`，取不到时不写数字）；IP 列原样显示，`attribution.store_click_ip` 关闭之后的点击 `ip` 为空，显示"—"（页面说明写明：关闭后自建归因的指纹匹配对这些点击不生效，按点击编号的匹配不受影响）；直装渠道的非 Android 下载点击后端不记录，页面说明里写明。 点击明细的 `from`、`to`（后端的回答第 76 条）是 `YYYY-MM-DD` 的 UTC 日、两端都含、作用于 `clickedAt`：所选的 UTC 日直接发，`to` 就是最后一天，不要转成"后一天 00:00:00Z"（否则多包含一天，而且带时间的值会被 400，`ref` 为 `from` 或 `to`、`OUT_OF_RANGE`）；`from` 晚于 `to` 是 400，不限跨度；`campaignId` 筛选是正整数；注意与下面的安装与注册（`/attribution/records`）不同，那个才是 ISO-8601 时刻、`from` 含 `to` 不含。汇总 `GET /attribution/summary` 缺失分组值（`mediaSource` 或 `campaign` 为空）时 `key` 是空串 `""`（永远是字符串，不会是 `null`），页面显示"—"；按 `source` 分组时 `key` 就是来源本身。
  - 安装与注册：`GET /attribution/records?source=&matchType=&from=&to=&page=&pageSize=`；`source` 只有 `APPSFLYER`、`SELF`，`matchType` 只有 `APK_BLOCK`、`REFERRER`、`FINGERPRINT`；时间范围用 `utcDayRangeToInstants` 把所选的 UTC 日变成 ISO-8601 时刻（`from` 含、`to` 不含，按 `eventTime` 筛）；按 `eventTime` 倒序；列取响应字段 `id`、`source`、`eventName`、`eventTime`、`conversionType`、`campaignType`、`mediaSource`、`campaign`、`adset`、`ad`、`installTime`、`isRetargeting`、`platform`、`countryCode`、`appVersion`、`cost`、`costCurrency`、`costModel`、`costInSelectedCurrency`、`accountId`（可空，点击跳用户详情）、`registeredAt`、`matchType`、`attributionCampaignId`；设备和 AppsFlyer 的标识后端不返回，页面也不显示；匹配方式列提示指纹兜底可信度较低。
  - 汇总：`GET /attribution/summary?groupBy=source|media_source|campaign&from=&to=`，`groupBy` 必填；`from`、`to` 是 `YYYY-MM-DD`（UTC 日，含两端），不传取最近 7 天；响应 `{items:[{source, key, installs, activations, costs:[{currency, amount}]}]}`，不分页；两个来源分列、不相加；`costs` 按币种分别显示（"USD 12.30 / EUR 4.00"），不跨币种求和，没有成本时为空；表格旁说明"早于事件保留期的安装，激活数会偏低"；没有收入数据，所以没有 ROI 列。
- 成本币种锁（`attribution.cost_currency`）：投放成本页和归因参数页都写明"只要有任何一条投放成本，成本币种就不能修改；要换币种，先逐行删除全部成本，再改归因参数里的成本币种；批量和单条录入的币种必须等于这个设置"；成本币种设置被后端拒绝（400，`details` 的 `ref` 是 `attribution.cost_currency`）时，归因参数页该行显示锁定说明（文字见任务 10），不显示后端 `message`；假后端有成本行时拒绝改成不同的币种（含恢复默认到不同的值），保存相同的值永远通过，删光成本行之后可以改；同一瞬间写入的成本行可能带旧币种，这只是防误操作，不是事务保证，页面不承诺。
- 投放账户的转化回传告警（任务 13 的 `POSTBACK_CREDENTIAL_FAILED`）：在投放账户页保存（`PUT /attribution/campaigns/{id}`）时，只要下面任一成立，假后端就重置待发送的回传并把该账户那条 `OPEN` 告警置 `RESOLVED`（后端的回答第 82 条；测试：保存前告警列表里有，保存后没有）：令牌字段是"设置新值"（非空字符串，即使内容与原来相同）；令牌被清除（显式 `null` 且原来有令牌）；像素编号与原来不同（含被清空）。只改名字且像素编号不变、没带令牌字段的保存不关闭告警，也不重置回传。`PUT` 是整体替换：不带 `facebookPixelId` 就等于把像素编号清成 `null`，那既关闭告警又清掉像素，所以页面"只改名字"等不涉及凭据的保存，请求里必须把原来的像素编号一起带回（令牌字段仍然留空时不带）。
- 投放效果（`GET /attribution/performance` 和它的导出）的范围错误现在和别的统计页相同：`from` 晚于 `to` → `details[0].ref` 是 `from`；范围超过 `stats.max_range_days` → `ref` 是 `to`；日期格式不对或年份小于 1 → 原因 `OUT_OF_RANGE`（以前是 `INVALID_FORMAT`）；页面按 `ref` 把错误显示在日期范围控件上，文字按原因翻译，假后端的三种情形按此返回。这个做法现在是所有统计页共用的（任务 9 的 `DateRangeUtc` 的 `refused`），不再是这一页自己的。
- 投放效果的"今天"是临时值：归因日汇总随当天刷新（每 15 分钟），不是一天一次，页面说明与总览一致。
- 没有 `ATTRIBUTION:MANAGE` 看不到账户与成本、归因参数页。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 26：成本

**Refs:** 规格 5.23；契约 §14.2、§17.4 成本行、§17.6 `usage-cost`。路由 `/cost/report`、`/cost/prices`（`COST:VIEW`，写操作 `COST:PRICE`，含确认、驳回、**撤回**、手填、改模型登记）。价格页另有一段 `<ConfigForm editPermission="COST:PRICE" />`（1 个参数键）。

**Interfaces:**
- Produces: `validateBands(bands: Band[]): { ok: true } | { ok: false; reasonKey: string }`（第一档下限 0；下一档下限 = 上一档上限 + 1；最后一档上限为空）；`useAdminMeta().allowedCurrencies`

- 响应类型（后端回复第 12 条）：`GET /usage/prices` → `{items: PriceBatch[], total}`（一项一个批次，按 `resourceType`、`provider`、`model`、`unit` 升序、同模型内 `effectiveFrom` 倒序）；`PriceBatch = { batchId; resourceType; provider; model; unit; effectiveFrom; currency; status; source; confirmedBy; confirmedByUsername; confirmedAt; reviewedBy; reviewedByUsername; reviewedAt; reviewNote; createdAt; bands: Band[] | null; unitPrice: string | null }`，`LLM` 批次的 `bands` 是 `[{inputMinTokens, inputMaxTokens, inputPrice, cachedInputPrice, outputPrice}]`（按下限升序）、`unitPrice` 为 `null`，其他资源类型 `unitPrice` 有值、`bands` 为 `null`；**所有价格都是字符串形式的十进制数，不经过浮点**，不返回 `rawSnapshot`；`GET /usage/price-batches/pending` → `{items}`，每项是批次形状（`status=PENDING_REVIEW`）加 `active`（同一模型今天生效的 `ACTIVE` 批次，同一形状，没有则 `null`，页面据此逐档对比）；`GET /usage/models` → `{items, total}`，每项是 `UsageModel` 的列加 `hasActivePrice`（布尔）。

**Tests:**
- 价格是十进制字符串：`"0.0000000001"`、`"12345678.1234567890"` 在读取、显示、手填提交（请求里仍是字符串）全程不变，不出现科学计数法，不被 `Number` 转换吞掉精度；档位边界（token 数）是整数。
- `validateBands`：缺口、重叠、第一档不从 0 起、最后一档有上限、单档各一个反例和正例。
- 报表：不同币种分开显示、不相加；费用为空的请求归"无费用"组；"没有价格的请求"卡片点击跳到价格页"模型"页签并带"没有生效价格"筛选；非 LLM 行显示数量与单位而不是 token；导出需 `STATS:EXPORT`，落地需 `STATS:LAND`。
- 报表顶部写明"费用按各组件上报的用量和价格表计算；LLM 费用是下限：用户打断通话时被取消的 LLM 请求可能没有用量，厂商仍会计费，LLM 对账以云厂商账单为准；自己部署的资源类型的费用取决于运营填的分摊价格"（规格 5.23）。
- 价格页文字：撤回处写明"撤回只影响之后入库的记录，已入库的费用不改"，手填处写明"价格只追加不修改，保存后不能再改这批，需要改就再填一批"。
- 价格写入与错误（后端的回答第 111 条）：`POST /usage/prices` 成功时 `data` 是新建的那一批，形状与 `GET /usage/prices` 的一项相同（`status` 为 `ACTIVE`，`source` 为 `MANUAL`，`confirmedBy` 是操作人；同一键同一生效日的旧 `ACTIVE` 批次同时变成 `SUPERSEDED`）；手填时档位按 `inputMinTokens` 排序后再校验，录入顺序无关，价格可传 JSON 数或十进制字符串（页面发字符串）。档位或价格不合法、`confirm` 因档位不连续被拒，都是 400 `INVALID_REQUEST`，**只有英文 `message`，`data` 为 `null`，没有 `details`、`ref`、`reason`**（缺口与重叠是同一句，不区分）：页面拿不到有译文的原因，所以具体的档位错误由前端自己的 `validateBands` 预检给出，后端 400 时只显示按码翻译的 `error.INVALID_REQUEST` 通用句，不显示英文 `message`；假后端同样不给 `details`。
- 价格：待审批次确认前页面写明"确认之前不会按这个价格计费"；币种下拉只含 `allowedCurrencies`（缺失时下拉不可用并提示），确认请求总是带下拉当前选中的 `currency`（批次自己的币种在允许列表里时作默认选中，不在时必须先选一个允许的币种才能确认）；后端的确认规则：批次最终用的币种（请求体给的，没给就是批次自己的）必须在 `usage_price.allowed_currencies` 里，否则 400 `INVALID_REQUEST`，批次保持 `PENDING_REVIEW`，页面保持在待审列表、显示按码翻译的文字加"币种必须在允许的币种里；可以在系统配置里先把它加进 `usage_price.allowed_currencies`"，不显示后端 `message`；确认的检查顺序是批次存在 404 → 生效日期合法 400 → 币种 400 → LLM 档位规则 400 → 条件更新 `PENDING_REVIEW → ACTIVE`（409 `INVALID_STATE`），假后端按此顺序并且在币种被拒时不改批次、不写审计；驳回、撤回备注必填；价格保存后没有编辑入口；非 LLM 手填只有一个单价，单位由资源类型决定且只读；同时持有 `MONITOR:VIEW` 和 `COST:PRICE` 才显示未关闭告警条数；没有 `COST:PRICE` 看不到确认、驳回、撤回、手填、改模型登记。
- 模型页签：没有生效价格的行标红并可按此筛选；"同步适配器"只对 LLM 可改。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 27：应用内广告

**Refs:** 规格 5.17；契约 §22 全节。路由取规格 5.0"应用内广告"五行。广告位页的全局设置用 `<ConfigForm editPermission="ADS:PLACEMENT" />`（9 个键；第十个 `ads.*` 键 `ads.log_retention_days` 的编辑权限是 `CONFIG:MANAGE`，只出现在系统配置页，这一页不显示也不警告）；接口是 `GET /config` 加 `PUT /config/{key}`（没有 `GET /config/{key}`）。单元表单里的计划和广告位选项来自 `GET /ads/campaigns`（`ADS:CAMPAIGN`）和 `GET /ads/placements`（`ADS:PLACEMENT`），只有 `ADS:UNIT` 的管理员收到 403 时，对应选择器禁用并写明缺哪个权限。

**Interfaces:**
- Consumes: 任务 8 的 `UploadField`、`LinkInput`、`SCREEN_TARGETS`（`IN_APP_ROUTE` 的目标下拉）；任务 10 的 `ConfigForm`（广告全局设置）
- Produces: `TargetingEditor`（平台、国家、系统最低版本、App 最低版本、语言、时段列表，时段按用户本地时间）

- 响应类型（后端回复第 18 条）：`GET /ads/report/by-placement` 每行 `placementId`、`slotKey`、`placementName` 加指标；`by-campaign` 每行 `campaignId`、`campaignName`；`by-creative` 每行 `creativeId`、`creativeTitle`（没有为 `null`）；`by-country` 每行 `country`（空串表示未知）；指标字段是契约 §22.9 列的那些；`GET /ads/report/nofill` 的行是 `{statDate, slotKey, reason, cnt}`，**没有 `platform`、`channelCode`**，所以无广告原因表只有日期、广告位、原因、次数四列（规格 5.17 的"平台"列不显示）；不传筛选时是全部平台、全部渠道的合计。

**Tests:**
- 每个广告页顶部可折叠的投放检查清单存在，五层条件按顺序列出，游客只有 `app_open`、`call_end` 两个广告位的说明存在。
- 广告位页文字：总开关默认关闭（关闭时 App 隐藏所有广告位）、联调时可把频控和冷却临时改成 0（不限）测完改回、频控按展示计数（预取了但没展示的不占额度）。
- 广告位：激励广告位的频控输入不能为 0，旁边显示"每账号每天最多通过广告得到 = 频控 × 奖励额度"；不能新增或删除广告位；`ads.skip_after_seconds` 大于 5 或 `ads.force_close_seconds` 为 0 且存在不可跳过素材时显示警告但不阻止保存（读取 `warnings`）。
- 素材文件上传前检查（`UploadField kind="adMedia"`）：类型 JPEG / PNG / MP4，大小 `adMediaMaxBytes`，图片另查宽×高 `adImageMaxPixels`，视频（MP4）没有像素检查。
- 素材上传 `POST /ads/media` 返回 503 `DEPENDENCY_UNAVAILABLE`（`upload.public_base_url` 没配置）时，上传控件旁提示"先在系统配置里设置 `upload.public_base_url`"，持有 `CONFIG:MANAGE` 的管理员带链接到 `/config`，其余人只看到提示文字。
- 素材：先上传再创建，提交只带 `uploadId`，表单里尺寸、大小、时长只读；规格不符时给出原因；已通过的素材没有编辑、删除，只有暂停，提示"要换内容请新建一条，再暂停旧的"；审核状态与投放状态分开显示；拒绝必须填备注；开屏或插屏选"不可跳过"显示政策警告；激励阈值 5..30 且视频不超过时长；`IN_APP_ROUTE` 目标是下拉。
- 计划：删除只对草稿或已结束且没有单元的；已结束不可编辑。单元：权重 ≥ 0，0 表示不会被选中；`geoConfigured=false` 时国家定向旁有提示。
- 单元的 `surfaces`（后端的回答第 39 条）：`GET /ads/units` 每行字段 `id`、`campaignId`、`placementId`、`name`、`status`、`targeting`、`weight`、`dailyImpressionCap`、`surfaces`（`GET /ads/units/{id}` 另有 `creatives`）；`surfaces` 是数组，每项 `{platform: "ANDROID"|"IOS", channel: "<渠道码>"|null}`，`[]` 表示所有端；`POST /ads/units` 接受可选的 `surfaces`（缺省、`null`、`[]` 都是所有端；每项恰好有 `platform`、`channel` 两个键，`channel` 为 `null` 或匹配 `[a-z0-9_-]{2,32}`，重复项合并；不合格 400 `INVALID_REQUEST`，`details` 为 `[{ref:'surfaces', reason:'OUT_OF_RANGE'}]`）；`PUT /ads/units/{id}` 也接受 `surfaces`（缺省是不变，`null` 或 `[]` 是改成所有端）。页面的单元列表和表单显示 `surfaces`（例如"仅 ANDROID"、"ANDROID/play"）并可编辑（用任务 14 的 `SurfacesPicker`），创建和编辑时发送 `surfaces`，否则别处创建的"仅安卓"单元在列表里看不出，而 iOS 请求实际被排除。列表形状：`GET /ads/campaigns`、`/ads/units`、`/ads/creatives` 是 `{items,total}`，`GET /ads/placements` 是 `{items}`（不分页），不再兼容裸数组。接口文档（第 3714 行）写 `PUT` 只改四个字段，后端代码 `updateUnit` 也接受并保存 `surfaces`，两边不一致（见 `docs/contract-requests/2026-11-02-contract-contradictions.md`），在文档改之前页面依赖代码的行为。
- 状态、审核、上下架与 `targeting`（后端的回答第 77 条）：`PUT /ads/campaigns/{id}/status` 请求体 `{status: ACTIVE|PAUSED|ENDED}`，`PUT /ads/units/{id}/status` 是 `{status: ACTIVE|PAUSED}`（`DRAFT` 能识别但没有任何转移指向它，得 409），`PUT /ads/creatives/{id}/serving-status` 是 `{servingStatus: ACTIVE|PAUSED}`（仅 `APPROVED` 的素材能切换），`PUT /ads/creatives/{id}/review` 是 `{reviewStatus: APPROVED|REJECTED, reviewNote}`（字段叫 `reviewStatus`，不是 `decision`；驳回时 `reviewNote` 必填，去空白后 1 到 500 个码点，通过时可选；只有 `DRAFT` 的素材能审核）；取值不在范围是 400（`ref` 是字段名、`OUT_OF_RANGE`），缺字段 `EMPTY_NOT_ALLOWED`，状态机不允许的转移（含"同状态"）是 409 `INVALID_STATE`。`targeting` 是**整体替换，不做嵌套合并**：`PUT /ads/units/{id}` 里只要出现 `targeting` 就替换整个原对象（请求体顶层字段才是"出现才改、缺省不变、`null` 清空"）；所以页面更新时必须发完整的 `targeting` 对象，只发改动的键会丢掉其他键；改成"空"的键直接不发，不靠 `null` 去删（发 `null` 的键后端也接受，原样保存并在响应里是 `null`，选取时等于不限）；`"targeting": null` 或 `{}` 是清空为 `{}`；键名只能是六个已知键，版本号键 `os_version_min`、`app_version_min` 发空串 `""` 会被拒，要么发合法版本号、要么不发。假后端按整体替换实现。
- 报表筛选（后端说明第 7 条的后来版本，提交 52e75ed）：广告报表的六个接口（`/ads/report/overview`、`/by-placement`、`/by-campaign`、`/by-creative`、`/by-country`、`/nofill`）除了 `from`、`to`、可选的 `platform`，都多一个可选参数 `channelCode`（不传 = 全部渠道，传了只含该渠道，可以传 `unknown` 看没带渠道的数据，格式不合格 400 `INVALID_REQUEST`），页面加一个渠道下拉（全部、各渠道码、`unknown`），渠道码取自 `GET /channels`；导出 `ads-report` 带页面上同样的筛选（`from`、`to`、`platform`、`channelCode`），所见即所得；不传筛选时是全部平台、全部渠道的合计；页面上没有"独立用户"列或卡片（测试断言）；有"游客展示"卡片和按广告位、计划、素材、国家四个下钻页签；十一种无广告原因都有本地化文字；比率分母 0 显示"—"；落地条 `ad-daily`；导出 `ads-report`。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 28：短信管理与邮件模板

**Refs:** 规格 5.18、5.18a；契约 §23.4、§23.6、§2.2.1、§17.4 邮件模板行（规格和契约写的是五个邮件模板，后端现在是六个，见 `docs/contract-requests/2026-10-31-design-doc-changes-from-backend-d1.md`）。路由取规格 5.0"短信管理"三行和"邮件模板"一行。

**Tests:**
- 渠道：凭据输入框永远是空的，编辑时留空表示不修改（请求体不含该字段，或为 `{}`）；`POST/PUT /sms/channels` 的 `credentials` 是"名称到文本值"的一层映射（后端的回答第 5 条），保存是**整体替换**（页面提示保留：填了就替换已保存的全部凭据，所以要填全）；没带、`null`、`{}` 都表示不修改并成功（保持原凭据）；映射里的值或名称为 `null` 时后端答 400 `EMPTY_NOT_ALLOWED`（`ref` 是 `credentials`）；空串的名称或值后端其实接受（接口文档写"非空字符串"，代码只拒 `null`），页面自己不发空值；值只能是文本，数字、布尔不要发（后端是否自动转成文本没有运行验证）；名称、值的长度和条数后端没有限制（只有整个请求体 8 MiB 的上限）；没有配置凭据加密密钥时带非空 `credentials` 的保存答 503 `DEPENDENCY_UNAVAILABLE`，这个检查先于其他字段校验；一旦保存过凭据，`PUT` 没有办法把凭据清成"没有"，所以页面**不提供"清空凭据"入口**；字符串旧写法后端答不带 `details` 的 400 `INVALID_REQUEST`（由处理器代码推出，没有测试也没运行，未完全核实），页面遇到"没有 `details` 的 400"只显示 `error.INVALID_REQUEST` 通用句；`GET /sms/meta` 的供应商项目前只有 `code`、`allowedHosts`（没有各供应商需要哪些凭据名称，生产环境下 `providers` 现在可能是空列表）；请求体里任何时候都不出现 `null` 的凭据值（测试：只填一个凭据字段、其余留空时，空的字段不进请求体；编辑时全部留空则不带 `credentials`），假后端对映射里的 `null` 值答 400，页面按原因显示在凭据区；假后端对整体的 `credentials: null` 答成功并保持原凭据（不是 400），对空串的名称和值也接受（后端的回答第 5 条）；供应商下拉来自 `GET /sms/meta`；测试发送弹窗显示当天剩余次数，需要 `SMS:CHANNEL:CONFIG`；启用开关走 `PUT …/enabled`，立即生效；删除、停用、或改 `smsType` / `countries` 使它不再是最后一个覆盖的启用 `OTP` 通道时，如果 `auth.phone_login_enabled` 为真**或存在手机号账号**，后端返回 `INVALID_REQUEST`，页面在操作前提示这两个条件，后端仍答 `INVALID_REQUEST` 时显示按码翻译的文字，后面加一句说明这两个条件，不显示后端 `message`（契约 §23.4）。 被拒时的 `details`（后端的回答第 41 条）：渠道是 `[{ref:"SmsChannel", reason:"OUT_OF_RANGE"}]`，模板是 `[{ref:"SmsTemplate", reason:"OUT_OF_RANGE"}]`；同一个 `ref` 下有两种情形（渠道：没有任何启用的验证码渠道了 / 白名单里某国家没有渠道覆盖了；模板：最后一个启用的验证码模板 / 最后一个"英文且不限国家"的验证码模板），`ref` 和 `reason` 相同、只有英文 `message` 不同，所以页面按 `ref` 显示一句覆盖两种情形的固定说明，不读 `message`（等后端拆分原因码之后再分开，见请求清单）；触发条件"`auth.phone_login_enabled` 为真或存在手机号账号"与后端一致；`GET /sms/meta` 没有 `phoneLoginEnabled`、`phoneAccountCount`，只有短信权限的管理员读不到登录开关和手机号账号数，操作前的提示按页面已知的信息尽力判断，后端为准。
- 模板规则（至少一个启用的英文验证码模板）：只要 `auth.phone_login_enabled` 为真或存在手机号账号，就必须始终有至少一个 `smsType=OTP`、启用、`locale` 等于 `en`（不区分大小写，`EN` 算，`en-GB`、`en-US` 不算）、`country` 为空的模板（选模板的规则末尾回退到的那个，只服务一个国家的英文模板服务不了其他国家）；创建不受影响；写入后仍有别的合格模板就不受影响；已经缺合格模板的旧状态不拦无关的编辑，只拦"拿掉最后一个合格模板"（创建、修改、启用、停用、删除都判）；原来的"最后一个启用的 OTP 模板"检查先判，消息不变。违反时后端答 400 `INVALID_REQUEST`，`details` 为 `[{ref:'SmsTemplate', reason:'OUT_OF_RANGE'}]`（`ref` 是固定词 `SmsTemplate`，不是设置键，页面上没有这个 `ref` 的行）：页面把文字显示在模板表单或行内确认上，写明"手机号登录开着或存在手机号账号时，必须保留至少一个启用的、语言为 en、不限国家的验证码模板"，不显示后端 `message`，也不丢；模板页顶部同样写出这条规则，并在拿掉最后一个合格模板的操作之前提示（前端按当前列表算，后端为准）；没有合格模板时发验证码仍是 503 `SMS_SEND_FAILED`，选模板的逻辑不变。假后端实现这条规则，错误形状同后端，测试每个写操作各一例，大小写 `EN` 与 `en-GB` 各一例。
- 模板：`OTP` 类型缺 `{code}` 时实时报错且不能保存；可用占位符 `{minutes}`、`{appName}`；选模板规则的说明存在；编码创建后只读；不能停用或删除最后一个启用的 `OTP` 模板（操作前提示；后端 `INVALID_REQUEST` 时显示按码翻译的文字加一句说明那两个条件，被拒的是最后一个英文、不限国家的验证码模板时显示页面自己的说明文字，都不显示后端 `message`）。
- 渠道与模板的 `PUT`、启用开关、测试发送（后端的回答第 78 条）：`PUT /sms/channels/{id}` **不是整条替换**，而是"没带的字段保持原值"（`name`、`providerCode`、`apiUrl`、`extConfig`、`countries`、`smsType`、`priority`、`enabled` 为 `null` 或没带都保留原值；`credentials` 空或没带保留原值），页面发全部字段等同整条替换，没有问题，但**不要用 `null` 表示清空**：要清空国家列表必须发 `countries: []`；`channelCode` 可以带，但必须等于原值，否则 400（`ref=channelCode`、`OUT_OF_RANGE`），页面把它当创建后只读；换 `providerCode` 而不带 `apiUrl` 时，旧 `apiUrl` 按新供应商的主机白名单重新检查；模板的 `PUT` 同理。`PUT …/enabled` 的请求体是 `{enabled: true|false}`，缺失或 `null` 是 400（`ref=enabled`、`EMPTY_NOT_ALLOWED`）；**响应是裸的渠道对象**（模板的是模板对象），没有 `POST`、`PUT /sms/channels/{id}` 那样的 `{channel, warnings}` 包装，页面按各自的形状读，假后端同样。新建时 `enabled` 默认 `true`、`priority` 默认 0、`smsType` 必填（缺则 `ref=smsType`、`EMPTY_NOT_ALLOWED`）。`channelCode`、`templateCode` 匹配 `^[A-Za-z0-9_-]{1,64}$` 且**区分大小写**（`A` 和 `a` 是两个不同的编码），重复 409 `DUPLICATE_RESOURCE`，不符合 `ref` 为该字段、`OUT_OF_RANGE`；`name` 去空白后 1 到 100 个字符。`allowedHosts` 是**精确主机名**、比较时**不区分大小写**、没有后缀或通配写法，只比 `apiUrl` 里的主机名（端口和路径不比），必须是 https、不能带 `user@`，否则 `ref=apiUrl`、`INVALID_HOST`；`apiUrl` 总长不超过 2048。测试发送无效号码是 400 `PHONE_INVALID`（不是 `INVALID_REQUEST`），没有 `details`；后端的检查顺序是渠道不存在 404 → 号码无效 400 → 当天额度用完 429 `RATE_LIMITED` → 渠道不可用 503 `SMS_SEND_FAILED`（无效号码不占当天额度，503 也会扣一条）；供应商拒绝时不是 HTTP 错误，而是 200 且 `sendStatus=FAILED`、`failReason` 有值，页面按发送结果显示。
- 发送记录：号码默认显示后端的掩码，持有 `SMS:RECORD:PHONE_VIEW` 才是完整值；没有任何"查看验证码"入口；导出按钮只对 `SMS:RECORD:EXPORT` 渲染；验证码走推送的行不显示供应商消息 ID 和送达状态。 时间范围参数只发以 `Z` 结尾的 UTC 时刻（后端对带偏移写法是否可解析没有运行验证，未完全核实，后端的回答第 79 条）；导出时去掉 `page`、`pageSize`。
- 邮件模板：`GET /email/templates` → `{items:[{templateCode, subject, body, defaultSubject, defaultBody, modified, updatedBy, updatedByUsername, updatedAt, placeholders, requiredPlaceholders}]}`（六个模板码各一项、按 `templateCode` 升序、不分页；`modified` 表示库里有这一行，没改过时三个修改人时间字段为 `null`；`reset` 之后与从未改过一样）；**可用的占位符和必含的占位符由后端的 `placeholders`、`requiredPlaceholders` 给，前端不写死模板码对应的规则**：编辑页提示可用占位符（原样显示带花括号的字符串），保存前检查必含的占位符都在（`placeholders`、`requiredPlaceholders` 每项都带花括号，和正文里写的完全一样，后端回复第二份已确认：用数组里的原样字符串在正文里找，区分大小写，不去花括号，也不做大小写折叠；缺任何一个必含项，前端先拦住并写明缺哪几个；后端仍返回 400 `INVALID_REQUEST` 时显示按码翻译的文字，不显示 `message`），后端返回了前端不认识的模板码照样显示、可编辑；标题 1..200 个码点；"恢复默认"先显示 `defaultSubject`、`defaultBody` 再行内确认；模板清单取后端返回。
- 第六个邮件模板 `LOGIN_METHOD_ADDED`（登录方式已添加通知）：账号新增一种登录方式（谷歌登录的自动绑定，或用户登录后自己添加谷歌登录）后发到账号邮箱，只有英文；`GET /email/templates` 现在返回六项，`PUT /email/templates/LOGIN_METHOD_ADDED` 保存，`POST …/reset` 恢复默认；后端给的 `placeholders` 是 `{method}`（登录方式名称，目前只有 `Google`）、`{time}`（添加时间，`yyyy-MM-dd HH:mm UTC`）、`{appName}`，`requiredPlaceholders` 是 `{method}`、`{time}`；编辑页的校验不写死这个模板，只靠后端给的两个数组；正文缺任一必含项时前端不让保存，后端也答 400 `INVALID_REQUEST`；默认标题和正文由"恢复默认"从 `defaultSubject`、`defaultBody` 显示，前端不写死。列表里每个模板的用途说明在语言文件里（键按模板码），给它写：zh-CN "登录方式已添加通知（账号新增一种登录方式后发到账号邮箱：Google 自动绑定，或用户登录后自己添加 Google 登录）"，en-US 写同样的意思；后端返回前端没有用途说明的模板码时，用途说明留空，仍然显示、可编辑。路由、权限（`EMAIL:TEMPLATE`）、菜单不变。测试数据里含这个模板（占位符和必含项如上），并有一例标题或正文是泰语、阿拉伯语的修改。
- 邮件模板的标题或正文含 NUL 字符时后端答 400（正常表单敲不出来，粘贴可能带入）：页面按错误码显示，假后端按此返回，不另写前端检查。
- 必含占位符检查：`requiredPlaceholders` 为 `["{code}"]` 时，正文含 `{code}` 通过；只含 `code`、含 `{CODE}`、含 `{ code }` 都不通过并指出缺 `{code}`。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 29：应用版本与渠道包

**Refs:** 规格 5.19；契约 §24.1–§24.2、§24.7。路由 `/system/app-versions`（`APPVERSION:VIEW`）、`/system/channels`（`CHANNEL:MANAGE`）。

**Interfaces:**
- Produces: `validateStoreUrl(platform: 'ANDROID' | 'IOS', url: string, packageName?: string): { ok: true } | { ok: false; reasonKey: string }`（Android 必须是 `https://play.google.com/store/apps/details?id=<包名>`，只可另带 `hl`、`gl`；同时过 `validateServerLink`）

**Tests:**
- `validateStoreUrl`：正例；包名不符、多余参数、`http`、非 Play 域名各一反例。
- 页面顶部写明判定规则：客户端版本号等于或高于生效版本 → 不提示；介于最低版本号和生效版本之间 → 可选更新；低于最低版本号 → 强制更新；等于最低版本号时是可选更新。
- 表单：渠道包创建后只读；新的版本号规则按新版接口文档 §24.2 和后端的回答第 47 条：创建版本、编辑草稿时改了版本号，必须大于该渠道其他所有版本（含草稿、已下线）的最大版本号；激活时必须大于该渠道所有生效过的版本（`ACTIVE`、`ARCHIVED`）的最大版本号；同一渠道版本号重复是 409 `DUPLICATE_RESOURCE`（`data.field` 为 `versionCode`，先于大小比较）；前端用列表里已读到的该渠道各版本先做提示，后端为准（旧快照写的"严格大于当前生效版本"已不对）：表单读取该渠道的全部版本（分页读完，`readChannelVersions`），新建时要大于其中最大的版本号，编辑草稿时要大于除自己以外最大的，而版本号没改时不比较（后端只在改动时比较）；激活对话框的提示用 `ACTIVE`、`ARCHIVED` 两种状态中最大的版本号（草稿不算，没有生效版本但有下线版本时也要提示）；读取失败时表单不比较，激活对话框退回页面列表里已有的各版本；检查顺序（后端的回答第 47 条）：重复（409）先于大小（400，只有 `message`、没有 `details`），激活时是状态 409、`confirmStoreLive` 400、版本号 400、渠道停用 409；最低版本号 ≥ 1 且不超过版本号；更新说明缺 `en` 不能保存；STORE 渠道没有 APK 控件，DIRECT 渠道有（`UploadField kind="apk"`，上传前检查 `apkMaxBytes` 和 `.apk` 压缩包类型），上传中禁止提交，地址、大小、SHA-256 只读。
- 权限：新建、编辑草稿、删除草稿、上传 APK 的按钮只对 `APPVERSION:MANAGE` 渲染（规格 5.0）。
- APK 上传返回 503 `DEPENDENCY_UNAVAILABLE`（`upload.public_base_url` 没配置）时，上传控件旁提示"先在系统配置里设置 `upload.public_base_url`"，持有 `CONFIG:MANAGE` 的管理员带链接到 `/config`，其余人只看到提示文字。
- 激活：STORE 渠道必须勾选"新版本已经在商店对用户可见"才能提交，提交带 `confirmStoreLive=true`；新最低版本号大于当前生效版本号时用强提示文字；DIRECT 渠道不弹商店确认；已归档的版本没有操作；只有 `APPVERSION:ACTIVATE` 才有激活和下线按钮；下线有行内确认。
- 渠道包：没有删除按钮，只有启用开关；编辑只能改名称、包名、启用。
- 409 `INVALID_STATE` 的判断（后端的回答第 47 条）：只有"上传记录已被别的版本使用"带 `data`：`{status: "CONSUMED"}`；渠道已停用、版本不是草稿（编辑、删除、激活）、下线时版本不是生效中、激活时同渠道已被别人激活，这几种都是 409 `INVALID_STATE` 但 `data` 是 `null`、只有英文 `message`。页面只在 `data.status === "CONSUMED"` 时提示"请重新上传"；`data` 缺失时只显示通用的 `error.INVALID_STATE` 文字，或按触发的操作自己判断（新建版本遇到没有 `data` 的 409 多半是渠道停用，但不当成确定）；读 `error.data.status` 前一律先判空。若后端按请求补上 `data.status`（渠道停用 `DISABLED`，版本状态不对写版本当前状态），再改回按值区分。检查顺序：新建版本先是请求体字段 400，再是上传记录检查（404/400），事务内依次是 (`channelCode`, `versionCode`) 重复 409、版本号不大于该渠道其他版本的最大值 400（`message` 写明最大值）、渠道已停用 409（无 `data`）、写入、消耗上传（已被用时 409，`data.status="CONSUMED"`）；激活依次是状态 409 → `confirmStoreLive` 400 → 版本号 400 → 直装版本的文件与基址 400 → 渠道停用 409。假后端同样处理。
- 渠道包的创建、启用与字段限制（后端的回答第 89、90 条）：`POST /channels` 不带 `enabled` 时默认启用（只有明确传 `false` 才停用），必填 `code`、`name`、`platform`、`distribution`，`packageName` 可不带；`PUT /channels/{code}` 只发改动的字段：启停开关只发 `{enabled: x}`，改名只发 `{name: x}`（没带的字段保持原值，这样不会用页面上次读到的值覆盖别人刚改的名称），`packageName` 传空字符串表示清空（JSON 的 `null` 是"没带"，不是清空），`name` 传空白是 400；带 `code`、`platform`、`distribution` 且与现值不同是 400，相同视为无变化；渠道不存在 404（路径里的码格式不合法也是 404）；渠道码重复 409 `DUPLICATE_RESOURCE`（`data.field="code"`）。限制：名称去首尾空白后 1 到 64 个码点（存的是去空白后的值）；包名可不填，非空时至多 255 个字符、只允许 `A-Z a-z 0-9 . _ -`（没有"必须含点"的检查）。渠道的所有 400（码格式、平台不是 `ANDROID`/`IOS`、分发方式不是 `STORE`/`DIRECT`、`DIRECT` 配 `IOS`、名称或包名不合格、创建后改了码/平台/分发方式）都是 `INVALID_REQUEST`、**只有英文 `message`，没有 `ref` 也没有原因码**，检查顺序是码 → 名称 → 平台 → 分发方式 → `DIRECT` 配 `IOS` → 包名：页面按提交的字段在前端自己检查，后端 400 时只显示通用句，不期待 `ref`。
- 版本号与更新说明的限制（后端的回答第 91、92 条）：`versionCode` 的类型是 32 位整数，范围 1 到 2147483647（不是 2^53−1），`1 ≤ minVersionCode ≤ versionCode`，不合格是 400、只有 `message`；超过 2147483647 的数在读请求体时就读不进去，预期是没有 `ref` 的 400 `INVALID_REQUEST`（"Malformed or invalid request body"，只读了类型和统一异常处理、没有运行请求确认，未完全核实），页面预检上限 2147483647；`versionName` 匹配 `x.y.z`（ASCII 数字）至多 32 个字符；`changelog` 必须是对象、至多 30 种语言，语言键匹配 `[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*` 且至多 35 个字符，每种语言的文字是 1 到 4000 个码点的非空白字符串，必须有 `en`；后端不拿 `app.supported_locales` 比对语言键，不在支持列表里的语言也收；键不合法是 400，`details` 为 `[{ref:'changelog.<键>', reason:'INVALID_LANGUAGE_TAG'}]`，其余错误只有 `message`（所以读 `error.data.details[0]` 前先判空，请求体类型不对同样是没有 `data` 的 400）；商店渠道只带 `storeUrl`（带 `apkUploadId` 是 400），直装渠道必须带 `apkUploadId`（带非空 `storeUrl` 是 400），请求里带 `apkUrl`、`apkSizeBytes`、`apkSha256` 会被忽略。版本编辑（`PUT`，仅草稿）不检查渠道是否停用，只有新建和激活检查。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 30：站内通知与客户端配置

**Refs:** 规格 5.20、5.21；契约 §25.4、§26.2–§26.3、§1.7。路由 `/users/notifications`（`NOTIFICATION:VIEW`）、`/config/client`（`CLIENTCONFIG:VIEW`）。

- 响应类型（后端回复第 1、16 条）：`GET /client-config` → `{items:[{key, type, localized, readOnly, configured, defaultValue, values, updatedBy, updatedByUsername, updatedAt}]}`（登记的全部键各一项、按 `key` 升序、不分页；`type` 取 `URL`、`EMAIL`、`STRING`、`BOOLEAN`、`INT`、`STRING_LIST`；`readOnly` 为真是取自系统配置、不能编辑的那六个键；`configured` 表示库里有这个键的值（`readOnly` 的键恒为真）；`defaultValue` 是登记的默认值，没有为 `null`；`values` 是 `{"<语言标签>": 值}`，空字符串键是默认值，`localized` 为假的键只有空字符串键，没配置的键是 `{}`，`readOnly` 的键是 `{"": 当前系统配置值}`，值的 JSON 类型与 `PUT` 在同一位置接受的一致）；**登记表里每个键的"说明"和"客户端使用点"文字不在接口里**，放在语言文件里以 `key` 为索引（`clientConfig.<key>.desc`、`clientConfig.<key>.usage`），查不到时显示 `key`。`GET /notifications` → `{items:[{id, accountId, category, title, isRead, linkType, linkTarget, sentBy, sentByUsername, createdAt}], total}`（`title` 是英文标题）；`GET /notifications/{id}` → `Notification` 的全部列（`id`、`accountId`、`category`、`titleI18n`、`bodyI18n`、`templateKey`、`templateParams`、`linkType`、`linkTarget`、`isRead`、`sentBy`、`createdAt`）加 `sentByUsername`；`SYSTEM_EVENT` 的 `titleI18n`、`bodyI18n` 为 `null`，`ADMIN` 的 `templateKey`、`templateParams` 为 `null`。

**Tests:**
- 发送：收件账号每行一个 ID、去重；超过 `useAdminMeta().maxRecipients` 时提示（缺失时交给后端）；后端 400 的 `data.details` 逐个账号列出且整批不发；标题 ≤100、正文 ≤500（码点，实时计数）；`en` 必填；链接用 `LinkTargetField`（无、页面、网址；"页面"的下拉就是 `SCREEN_TARGETS`，"网址"走 `LinkInput`）；"同时推送"勾选旁写明"推送遵守用户的公告类通知偏好，偏好关闭的用户只收到收件箱消息"；页面注明"全体用户请用手动推送任务"；发送按钮和弹窗只对 `NOTIFICATION:SEND` 渲染。
- 列表点开抽屉看到全部语言的标题与正文、模板键和参数。
- 列表筛选的格式（新版 25.4）：`from`（含）、`to`（不含）是带时区偏移的 ISO-8601 时刻，页面把所选的 UTC 日写成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，不随浏览器时区变（测试在四个相差很远的时区里断言发出的时刻相同）；`category` 只发 `ADMIN` 或 `SYSTEM_EVENT`，`isRead` 只发 `true`/`false`；假后端对不合法的 `from`、`to`（没有时区、只有日期等）、`category`、`isRead`、不是 UUID 的 `accountId` 一律答 400 `INVALID_REQUEST`，页面显示按码翻译的文字。
- 客户端配置：列表列出键、说明、类型、是否按语言区分、是否已配置、客户端使用点；`URL` 类型填 `http://` 或空值不能保存；`STRING_LIST` 只读；一个语言校验失败整个键不保存；"重置"删除该键全部语言值（行内确认）；预览按所选语言显示实际取值并标出来源（该语言 / 默认值 / 未配置）；`readOnly` 为真的键（规划时就是那六个，由接口的 `readOnly` 决定，前端不写死）各自显示"由 X 配置决定，在系统配置里改"，没有 `inviteShareSubtitle`；没有 `CLIENTCONFIG:MANAGE` 看不到保存和重置。 预览的排序（后端的回答第 130 条）：同一主语言、前缀与文字变体都比不出先后时"取列表里靠前的第一个"，这个列表是该键已存的语言标签（不含默认值那一行）按 Java 字符串自然顺序（按 UTF-16 码元逐个比较）排序的结果：区分大小写，大写字母排在小写字母之前（`Zh` 在 `en` 之前），连字符 `-` 排在字母和数字之前（`zh` 在 `zh-Hans` 之前），标签原样存、不转小写；所以预览排序不能用 `localeCompare` 之类的本地化比较，也不能忽略大小写，要用按码元的原始字符串比较，并先排除默认值那一行；完整匹配、同主语言前缀匹配、`zh` 的文字变体筛选仍按契约 §1.2 先做，排序只在最后一步决定；契约两处都没写这个顺序（建议由改契约的人补写）。测试：`Zh` 与 `en`、`zh` 与 `zh-Hans` 各一例，断言用的是码元比较。

- [ ] 步骤 1–5 按"任务的统一写法"

### 任务 31：系统管理（管理员、角色、权限树、审计日志）

**Refs:** 规格 5.16；契约 §17.2–§17.4 系统管理行。路由取规格 5.0"系统管理"中管理员、角色、权限树、审计日志四行（应用版本和渠道包在任务 29）。

**Interfaces:**
- Produces: `PermissionTreeSelect`（属性 `{ nodes: PermissionNode[]; value: string[]; onChange }`：勾选父节点同时勾选全部后代，部分后代选中时父节点为半选，值是完整的码列表）

- 响应类型（后端回复第 3、15 条）：`GET /admins` → `{items, total}`，每项是 `AdminUser` 的列 `id`、`username`、`superAdmin`、`status`、`mustChangePassword`、`totpEnrolledAt`、`lastLoginAt`、`createdAt` 加 `roles: [{id, name}]`（按名字升序）；`GET /roles` → `{items, total}`，每项是 `AdminRole` 的列 `id`、`name`、`remark`、`createdAt` 加 `permissionCodes`（升序）；两个接口都分页，管理员表单里选角色用 `pageSize=200` 一次取完；审计日志的 `adminUsername` 是写入当时的用户名，管理员以后被删除或改名，已写的行不变，直接显示它；别处的 `…Username` 为 `null`（管理员已删除）而 ID 非空时，显示 ID 前 8 位。

**Tests:**
- `PermissionTreeSelect`：勾选父节点得到父节点和全部后代；取消一个后代，父节点变半选并从值里去掉；保存的值是完整列表；节点名按界面语言取 `nameZh` / `nameEn`，缺一种时用另一种，都缺时显示码。
- 管理员和角色的授予规则（后端是最终裁决，前端不复刻规则逻辑，也不预先禁用权限树里操作者没有的节点）：`superAdmin=true` 的操作者不受限；其他操作者"持有"的权限是自己各角色权限码的并集。违反时后端答 403 `ADMIN_FORBIDDEN`，`data` 为 `null`，什么都不改，页面不跳转（任务 3、7 的 403 处理照常：提示无权限、重取一次 `/me`）。页面按自己提交的操作显示按码翻译的原因文字（不读 `message`）：创建、修改角色时权限码里有自己没有的 → "只能授出自己持有的权限"；修改自己被分配的角色 → "不能修改自己持有的角色"；修改、删除角色时角色原有的权限码不全是自己持有的 → "只能处理权限都在自己持有范围内的角色"；创建、修改管理员时所选角色的权限码合起来不全是自己持有的 → "只能授出自己持有的权限"；对管理员做修改、启用或停用、重置密码、重置二次验证、删除，而目标管理员持有自己没有的权限 → "只能处理权限都在自己持有范围内的管理员"。假后端实现这五类检查并返回 403，每个路由的检查顺序不要求前端复刻；测试各一例，且断言 403 之后 `refreshPermissions` 被调用一次、没有跳转。
- 管理员：持有 `ADMIN:MANAGE` 的管理员不能修改自己的角色和 `superAdmin`（对自己的行这两项禁用）；`superAdmin` 开关只对超级管理员可用；不能停用或删除自己、最后一个启用的超级管理员（按钮禁用；后端仍拒绝时，403 / 409 显示按错误码翻译的文字）；角色是多选，选项来自 `GET /roles`（要 `ROLE:MANAGE`），只有 `ADMIN:MANAGE` 的管理员收到 403 时，角色选择器禁用并写明缺哪个权限；用户名创建后只读；重置密码、重置二次验证有确认；`DUPLICATE_RESOURCE` 的 `data.field` 指到对应表单项。
- 角色：删除仍分配给管理员的角色时展示 `ROLE_IN_USE`；权限树读取需要 `ROLE:MANAGE` 或 `PERMISSION:MANAGE`。
- 针对自己和最后一个超管的拒绝（后端的回答第 22 条）：拒绝"改自己的角色或 `superAdmin`"（值真的变了才算，带了但没变不拒绝）、"停用或启用自己"（`status` 接口对自己的任何值都拒，包括 `ACTIVE`）、"删除自己"，以及"最后一个启用的超管被停用、删除、清除标志"，**全部是 409 `INVALID_STATE`，不是 403 `ADMIN_FORBIDDEN`**，`data` 是 `{status: "<目标管理员当前状态>"}`（自己的情形下就是 `"ACTIVE"`，不能用来区分原因），只有英文 `message` 不同；与另一个正在进行的超管变更撞车（死锁回退）同样是 409。后端的检查顺序是"超管目标只能超管操作"403 → "目标权限码"403 → "自己"409 → "最后一个超管"409。页面在 409 之后加的固定话按"是不是自己那一行"分两句（目标行 `id` 等于 `/me.id` 就是"自己"那条规则，写"不能修改、停用或删除自己"；否则写"必须保留最后一个启用的超级管理员，或另一项超管变更正在进行，请重试"），因为 409 本身不告诉原因（后端建议在 `data` 里加 `reason`，还没做，见请求清单）。假后端对这三个自己的操作返回 409 `INVALID_STATE`（`data.status` 为 `ACTIVE`）。
- 管理员 `PUT` 的必带字段（后端的回答第 44 条）：`PUT /admins/{id}` 的 `username` 必填（缺省或空白是 400，`ref=username`、`EMPTY_NOT_ALLOWED`），每次都要带，不带不是"不改"而是报错；`roleIds` 必填且整体替换（缺省 `null` 是 400，`ref=roleIds`、`EMPTY_NOT_ALLOWED`；`[]` 就是拿走全部角色，所以读不到角色列表时绝不能发 `[]`；包含不存在的角色是 400，`ref=roleIds`、`OUT_OF_RANGE`），页面每次都发 `username` 和**完整的** `roleIds`，不再"只发有改动的字段"；`superAdmin` 可选（缺省或与当前相同是不改，不同才是改，需要超管）；请求体里的 `password` 在 `PUT` 里被忽略（改密码用 `reset-password`）。自己那一行也必须发 `username` 和**当前的** `roleIds`（集合与当前相同、顺序无关，就能成功改用户名），`superAdmin` 省略；`roleIds` 集合变了或 `superAdmin` 变了才是 409 `INVALID_STATE`。
- 权限节点的 `POST`、`PUT`、删除（后端的回答第 87、88 条）：`POST /permissions` 请求体 `{code, parent, type, sortOrder, nameZh, nameEn}`：`code` 必填，**只允许** `[A-Za-z0-9_:#/.-]{1,128}`（区分大小写；页面不再用"不含空白和控制字符、至多 100 个码点"），`type` 必填（`MENU` 或 `FUNCTION`），`parent` 可省（根）、给了必须是已存在的节点，`sortOrder` 可省（默认 0，整数，没有范围检查），`nameZh`、`nameEn` 必填各 1 到 100 个码点、不含控制字符；第一个失败的检查给 400，`ref` 依次是 `code`、`type`、`parent`、`nameZh`、`nameEn`，原因 `OUT_OF_RANGE` / `EMPTY_NOT_ALLOWED` / `TOO_LONG`；码重复 409 `DUPLICATE_RESOURCE`，`data` 为 `null`（没有 `data.field`）。`PUT /permissions/{code}` 请求体 `{nameZh, nameEn, sortOrder?, parent?, type?, code?}`：`nameZh`、`nameEn` 在 `PUT` 里也必填；`sortOrder` 缺省是保持不变；`type` 缺省或等于当前值可以、不同是 400（`ref=type`）；`code` 缺省或等于路径里的码可以、不同是 400（`ref=code`）；**`parent` 没有"缺省 = 不改"，缺省等于 `null`**：自定义节点缺省会被移到根下，内置节点缺省且与当前父节点不同是 400（`ref=parent`），所以修改请求里除了不带 `code`、`type`，必须**总是带当前的 `parent`**（根节点带 `null`），要移动时带新值。其他拒绝都是 400 `INVALID_REQUEST`、`details` 只有一项：`parent` 设为它自己（`ref=parent`、`OUT_OF_RANGE`）、移到它的后代下面（成环，同样）、指向不存在的节点（同样）、改内置节点的父节点（同样）；**删除内置节点是 400 `INVALID_REQUEST`（`ref=code`、`OUT_OF_RANGE`），不是 409 `INVALID_STATE`**，与契约一致；删除有子节点的自定义节点是 409 `PERMISSION_HAS_CHILDREN`。假后端按此实现（删内置节点已按契约改成 400）。
- 权限树页：内置节点只能改名称和排序（码、父节点不可改，无删除）；编辑时"类型"字段只读（后端不允许改节点类型，请求里改了 `type` 会得 400，所以表单不提供修改，请求体里 `type` 取原值或不带）；自定义节点可改父节点、可删除；有子节点时删除展示 `PERMISSION_HAS_CHILDREN`；页面顶部写明自定义节点对现有接口没有效力。
- 审计日志：筛选管理员、动作、对象类型、对象 ID、时间范围；动作、对象类型的输入框 `maxLength` 为 64，对象 ID 为 255（后端对更长的值答 400，所以输入框不让输入更长的；后端只写了"字符数"，没有写明按码点还是按 UTF-16 单位计，前端按码点数限制，粘贴超长时截断并提示）；管理员列显示 `adminUsername`（写入当时的用户名，不随改名变）。

- [ ] 步骤 1–5 按"任务的统一写法"

---

## 任务 32：收尾验收

**Files:**
- Create: `docs/contract-requests/2026-10-21-admin-frontend.md`（定稿）、`docs/deploy.md`；Modify: `README.md`
- 不新增业务代码；这个任务只做检查，发现的缺陷按它的分类处理（立即修、记录、变更）。

- [ ] **步骤 1：整体检查**，每条都保存命令输出：
  - `npm run lint`、`npm run tsc`、`npm test`（全量一次）、`npm run build`；
  - `npm run check:routes -- <规格路径>`：缺失 0、多余 0、`access` 不一致 0；
  - `npm run check:codes -- <规格路径> <契约路径>`、`npm run check:config-keys -- <契约路径>`：差异为 0；
  - 语言文件：每个路由 `name`、每个权限码、每个错误码、每个配置键都有两种语言的文字（`parity` 测试收紧到全量）；
  - 扫描：仓库里没有 `token=123`、`md5`、外部 CDN 地址、参照项目名、`TODO`、`FIXME`、`console.`、占位页面；
  - `npm run build` 的产物里没有 `mock/` 的任何内容（按假账号用户名和假验证码 grep `dist/`）。
- [ ] **步骤 2：规格 §12 验收清单逐条对到测试或手工检查**，写成一张"条目 → 对应测试名或检查方法 → 结果"的表放进任务报告；没有对应测试的条目补测试。
- [ ] **步骤 3：浏览器走查**：`npm run dev:mock`，用 `root` 登录，用 `support`、`finance`、`reviewer` 各登录一次，每个模块打开至少一个页面；如果当前会话没有可用的浏览器工具，报告里写"浏览器走查未运行"并给出未走查的页面数，不用其他方式替代。
- [ ] **步骤 4：定稿给后端的问题和规格修改清单**：`docs/contract-requests/2026-10-21-admin-frontend.md` 第一部分（计划阶段已写好交给后端）按后端的回复更新，执行中新发现的、说明里没有的接口追加成新的问题；再加"规格需要在 main 上修改的地方"一节，内容是本计划"规格与契约的冲突"表的全部行（规划时 8 行，执行中发现的再加），每行写规格的位置、现在的文字、应改成什么；后端 2026-10-29 清单（含 2026-10-31 追加）引起的规格和契约变更已经单独写成变更请求 `docs/contract-requests/2026-10-31-design-doc-changes-from-backend-d1.md` 和 `docs/contract-requests/2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md`，这里只列出它们、不重复；两部分的条数写进报告，没有得到回复的问题单独列出。
- [ ] **步骤 5：部署文档** `docs/deploy.md`：同域反向代理（`/api/` 转发、其余走单页应用回退到 `index.html`）的完整 nginx 示例、哈希文件名资源的缓存头、构建变量清单与构建命令；后端在 admin 业务端口的响应上自己加了一组安全响应头，所以 `/api/` 的 `location` 里不要再加这些头，也**不要再加 `Cache-Control`**（后端对 `/api/admin/**` 的响应恒设 `Cache-Control: no-store`，处理者自己设同名头会"替换"默认值而不是追加，反向代理再加一个会让响应里出现两个 `Cache-Control`；一定要加时必须是替换：nginx 先 `proxy_hide_header` 再 `add_header`；后端的回答第 16 条）；后端管理端口 9080（健康检查和指标）上有没有这六个头没有核实（未完全核实），前端不访问 9080；nginx 里 `location` 自己写了 `add_header` 就不再继承 `server` 一级的，示例因此在 `server` 一级不放 `add_header`，文档里写清原因、内容安全策略该放的位置和用 `curl -i` 的验证方法，示例配置用 `nginx -t` 和一个假后端实测过；前端的静态文件不能由后端的 admin 应用提供（后端对自己页面的处理没有核实，写成给后端的问题文件）；README 写运行方式（`dev:mock`、`dev:api`）、假账号、构建变量、测试命令。
- [ ] **步骤 6：报告**：开头先写"修复未完成的数量 / 记录项数量 / 未运行项数量 / 阻塞项数量"，再写其余；然后把 `admin-frontend` 合回 main（提交不问你）；**推送前问你**。

---

## 执行顺序（依赖）

- 任务 1 → 2 → 3 → 4 → 5 → 6 → 7；任务 8 依赖 2、3、6；任务 9 依赖 2、3、6、8；任务 10 依赖 3、8。
- 模块任务都依赖 1–10。额外依赖：16 依赖 11、12、13、14；21 依赖 13、15、17；17、18、19 依赖 9（已含）；其余模块任务之间没有依赖，可任意顺序或并行（并行时每个模块任务只改自己目录里的文件，路由、语言、假后端文件在任务 4、6、5 已为每个模块建好）。
- 任务 32 在全部完成后。

## 自检（对照规格）

- 规格 5.0 的 72 个页面行：任务 10–31 各认领若干行，任务 4 的脚本在任务 32 核对全集；用户详情、站内通知、短信、邮件、版本、渠道包、投放、成本、形象、投诉、广告、活动都有对应任务。
- 规格 §12 的验收清单：每一条在对应模块任务的 Tests 里有断言，任务 32 步骤 2 再逐条对一遍。
- 规格 §6 / §8 / §2 的全局要求：在 Global Constraints 和任务 3、6、8 里；扫描测试在任务 6。
- 本计划里反复使用的名字：`useAdminMeta`、`getChannels`、`ConfigForm`、`ExportButton`、`LandBar`、`ReasonModalForm`、`validateServerLink`、`trimSpec` 都在 Interfaces 里定义过。

核对于 2026-11-02

# 模块任务（11–31）的实现说明

给实现一个模块任务的会话或子代理读。先读仓库根的 `CLAUDE.md`，再读 `execution-conventions.md`，再读这份，最后读你的任务书（`bash docs/superpowers/handoff/brief.sh N`，在仓库根运行）和它指向的规格、契约、后端文件。

## 你拿到的东西

地基任务 1–10 已经做完并评审过：请求层、权限和路由、假后端、主题和外壳、登录和会话、共用组件、统计共用组件、配置表单。你的任务是**一个模块**：它的接口函数、页面、假后端、路由、语言文字和测试。你不改共享文件（见"不要改的文件"）。

## 要建的文件（每个模块任务都一样）

- `src/services/<模块>/`：每个接口一个带类型的函数，用 `apiRequest`（`src/request/apiClient.ts`，路径写 `/users`，前缀 `/api/admin` 自动加）、`downloadFile`、`uploadFile`；响应类型字段名**一律按** `docs/backend-inputs/` 的四份文件，契约 §17 以及它指向的各节；两处都没写的接口或字段，不要猜：写成新的问题文件放到 `docs/contract-requests/`（接口、字段、我们为什么需要、暂定做法），在报告里列出，本任务按最小做法继续。
- `src/pages/<模块>/`：页面，默认导出一个组件。路由 `component` 写 `./<模块>/<页面>`。
- `mock/<模块>.mock.ts`：假后端，默认导出 `{ 'METHOD /api/admin/path': handler }`，**只有默认导出**（辅助函数、假数据放 `mock/_core/<模块>Data.ts`，Umi 的 mock 加载器会读 `mock/` 下每个文件）。测试文件 `mock/<模块>.mock.test.ts`。
- `config/routes/<模块>.ts`：现在是空数组。用 `menuGroup('<菜单键>', [页面路由…])`（`config/menus.ts`），路径、顺序取规格 5.0 表（`ROUTE_ORDER`）；每个页面路由有 `path`、`name`、`component`、`access`（权限码，取规格和任务书写的那个）；详情抽屉不是路由。`name` 对应语言键 `menu.<菜单键>.<name>`，两种语言都要写。
- `src/locales/zh-CN/<模块>.ts` 和 `src/locales/en-US/<模块>.ts`：现在是空对象。键扁平点分，建议 `<模块>.<页面>.<项>`；两边键相同、占位符相同；en-US 里不能有中日韩字符；**不要**把本模块的文字写进别的文件。
- 对应的测试：`*.test.ts(x)` 放在被测文件旁边。

## 共用工具箱（直接用，不要重写）

**请求与会话**（`src/request`、`src/session`）
- `apiRequest<T>({ method, url, params, body })`；失败抛 `ApiError{ code, httpStatus, message, data, details }`。`Page<T> = { items, total }`。列表请求 `page` 从 1，`pageSize` 取 10/20/50/100（默认 20，后端上限 200）。
- `describeFailure(intl, error)`（`src/session/describe.ts`）→ `{ error, text, fields:[{ref,text}] }`，文字按 `error.<码>` 和 `reason.<码>` 查语言文件；`noticeText`/`Notice` 用于提示条（存键不存译文，切换语言时跟着变）。
- `useSession()`、`useAdminMeta()`（`src/session/useSession.ts`）：`useAdminMeta()` 是 `GET /meta` 的值，缺项或为 `null` 就不检查、不显示数字，交给后端。
- `useSingleFlight(fn)`（`src/hooks`）、`useSubmitOnce()`（`src/session`）：写操作一律防重复提交。

**权限**：`useAccess().canAccess(code)`、`<Can code="…">`（`src/components/Can.tsx`）。权限码精确匹配，超级管理员全通；只能用 `src/access/permissionCodes.ts` 里的码。按钮按各自接口要求的码显示，不只看页面的查看码；后端是最终裁决。

**表格和操作**：`PagedListTable`（ProTable，服务端分页，请求形如 `request({page,pageSize,...筛选})` 返回 `Page<T>`）、`RowActions`（3 个以内全显示，4 个起显示前 2 个加"更多"）、`DangerConfirmButton`（行内确认）、`ReasonModalForm`（理由必填，去首尾空白后按码点数 1..500，提交失败保持打开）、`EllipsisPopoverText`（长文字，任意文字不撑破表格）、`MaskedText`、`StatusTag`、`JsonField`、`LinkInput`/`linkRule`、`LinkTargetField`/`linkTargetRule`（推送、站内通知、广告的链接目标）、`UploadField`（上传，**先上传后创建，只提交 `uploadId`**；`onCleared` 在换文件时清掉旧 `uploadId`；`isUploadIdRejection(error)` 判断 409/400/404 后提示重新上传）、`ExportButton`（导出：`name`、`params`、`viewCode`，要 `STATS:EXPORT` 加页面的码，或 `requiredCodes`）。
- 行内删除、取消、重试用行内确认（危险色）；提示用顶部 `message`（`App.useApp()`），不用 `notification`；**不要用静态的 `Modal.confirm` / `message.*`**，用 `const { message, modal } = App.useApp()`。
- 带 `reason`/`note` 的写操作，理由在表单里必填；封禁理由旁写明"这是写给用户看的文字，只有一种语言"。

**统计**（`src/components/stat`、`src/services/stats`）：`StatCard`、`TrendChart`、`RetentionMatrix`、`RetentionTrendChart`、`LandBar`、`ReportHelper`、`UtcNotice`、`DateRangeUtc`、`PlatformChannelFilter`、`ChannelSelect`；报表函数 `getDaily` 等、`landStat`、`fillMissingDays`。统计日是 UTC 日历日，选哪天就发哪天，页面标注 UTC。

**配置**：`<ConfigForm editPermission="…" />`（`src/pages/config/ConfigForm.tsx`）按权限码整组渲染该码的配置键；任务书写明哪些页面放这一段"参数"区。

**格式与文本**：`src/utils/`：`trimSpec`（契约 §1.9 的 29 个码点，**不要用 `String.trim`**）、`countCodePoints`/`lengthWithin`、`formatInstant`、`formatBytes`、`formatCount`、`formatPercent`、`safeRatio`、`DASH`、`validateServerLink`、`SCREEN_TARGETS`、`UPLOAD_ENTRIES`/`checkUploadFile`、上传限制来自 `useAdminMeta()`。空值、零分母一律显示"—"，不显示 `0`、`NaN`、`null%`。

## 假后端怎么写

- `mock/_core/`：`guard(权限码|null, handler)`（401、必须改密码时 403、缺权限 403，给 `req.admin`）、`ok`、`fail`、`invalidRequest(message, details)`、`MockHttpError`、`paginateQuery(rows, req)`、`bodyOf(req)`、`multilingualSamples`/`sampleText`（泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文，含长串无空格和 emoji）、`store`（管理员）、`statRange`（日期范围校验）、`xlsx`（样例导出）。
- 状态要在内存里有（新建后列表能看到），挂在 `globalThis` 上（照 `mock/_core/configStore.ts`），保存 mock 文件时不丢。**测试里要能重置**。
- 每个接口按契约对：缺权限 403 `ADMIN_FORBIDDEN`、对象不存在 404 `RESOURCE_NOT_FOUND`、状态不允许 409 `INVALID_STATE`（`data.status` 是当前状态）、重复 409 `DUPLICATE_RESOURCE`（`data.field`）、分页或日期范围越界 400 `INVALID_REQUEST`（`details` 的 `ref` 是参数名）；响应字段名按后端的回复：管理员 ID 旁带 `…Username`（管理员已删除时为 `null`）、图片带 `…Url`（每次取列表给新地址，缺失为 `null`）。
- 假数据要含七种语言，不只有中文；只覆盖中文的检查，结论里写明"只覆盖中文"。

## 测试怎么写

- 页面测试：`renderPage(<Page/>)`（`tests/renderPage.tsx`，带语言文件和 antd `App`）；用 `tests/mockBackend.ts` 的 `signInAs('root')` 和 `useMockBackend(mockModule…)` 让页面直接对着你的假后端（`resetStore()` 重置管理员；你的模块状态自己提供重置函数）；Umi 桩用 `setTestAccess`、`setTestInitialState`（带 `{ me, meta }`）、`setTestLocation`、`history`（`tests/stubs/umi-max.tsx`）；权限用 `access({ me: { superAdmin, permissions } })` 生成再 `setTestAccess`。需要 `fetch` 细节时用 `tests/httpStubs.ts`。
- 先写失败的测试，确认因"功能不存在"而失败（不是拼写或配置错）；再实现；再跑绿。记下 RED 和 GREEN 的命令与输出（报告里写）。
- 每个写操作测：权限不足不渲染按钮、成功、后端拒绝时显示文字（`error.<码>`、`reason.<码>`）、重复点击只发一次、请求途中令牌过期不重发。
- 要覆盖的输入（计划里的 Review Focus）：阿拉伯语、泰语、emoji、5000 字符无空格串出现在反馈、审核文字、标题、词表里时表格不撑破；空值和零分母显示"—"；UTC 日边界；导出失败不存成文件。
- 变异检查：对你写的关键判断（权限显示、状态转移、校验、防重复）至少各做一次"把判断反过来或拿掉，看测试是否变红"。
- 文字扫描（`tests/noHardcodedText.*`）：`src/**/*.tsx` 里不能有不经语言文件的文字。确实需要的字面量（单位、协议词）放 `src/pages/<模块>/hardcodedText.allow.json`（数组，每项 `{file,text,reason}`，不用的条目会让测试失败）。不要在源码里留原始的隐藏字符或非 ASCII 空格（测试里用 `String.fromCharCode`/`String.fromCodePoint` 构造）。
- 只跑和你有关的测试：`npx vitest run <路径>`；`npx biome check <路径>`；`npx tsc --noEmit`（只看自己路径下的报错）；**不跑全量测试和构建**。

## 真实浏览器检查（每个模块任务做一次）

假后端加真实浏览器能看到单元测试看不到的东西。在你自己的端口起 `PORT=<你的端口> BROWSER=none npm run dev:mock`（用 curl 循环等就绪），用 Playwright（`require('playwright')`，`chromium.launch()` 不需要选项；脚本放在你自己的临时目录，不进仓库）登录 `root`/`mock-password-root`（验证码 `000000`，README 有全部账号表），打开你的每个页面：看控制台错误、看布局（截图）、点一遍主要操作。停服务按监听进程的 PID，**不要用 `pkill -f`**。

## 提交

- 提交不用问，每次只提交自己任务的路径：`git add <路径…>`，然后 `git commit -m "<做了什么>" -- <路径…>`（提交说明写英文，描述这个任务做了什么，不带编号式缩写），**不要**用 `git add -A`、`git commit -a`、`git add -f`、`--no-verify`。
- 提交说明末尾加这两行：
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` 和 `Claude-Session: https://claude.ai/code/session_01CsnYfkmJXQzYkFMAQiD7AZ`。
- 钩子（lint-staged 和暂存文件的类型检查）必须通过；失败就修，不绕过。同时有别的会话在同一个检出里提交，遇到 `index.lock` 就等几秒再试。
- **不要推送**，推送由主会话做。

## 不要改的文件

`tests/stubs/*`、`tests/setup.ts`、`tests/*.ts(x)` 的共用辅助、`vitest.config.ts`、`config/config.ts`、`config/routes.ts`、`config/menus.ts`、`src/app.tsx`、`src/locales/zh-CN.ts`、`src/locales/en-US.ts`、`src/locales/*/{pages,menu,error,reason,permission,auth,config,stats,…共用}.ts`（别的模块的文件也不碰）、`src/components/*` 和 `src/hooks/*`、`src/utils/*`、`src/request/*`、`src/session/*`、`mock/_core/*`（除非任务书写明你可以加自己模块的辅助文件，如 `mock/_core/<模块>Data.ts`）。需要改这些时，在报告里写成"需要改共享文件"并写清改什么、为什么，本任务按最小的做法继续（例如在自己目录里写一个本地版本），不阻塞。发现共用组件有缺陷也只在报告里写，别自己改。

## 发现的问题怎么分类

每个发现只能是：**立即修**（输出错误、崩溃、数据丢失、安全或隐私暴露、协议或契约被破坏）、**记录**（真实但不影响正确性的小缺陷，写文件行号加触发步骤）、**变更**（新增或改变行为，不是遗留项）、**不是缺陷**（写理由和文件行号）、**阻塞**（只有别人能给的输入）。不用"可选、以后、小改动、不值得"代替分类。契约的缺口不是阻塞。

## 规则（来自 CLAUDE.md，最容易犯的几条）

- 对负责人的报告用中文；代码、标识符、提交说明用英文；不输出韩文。
- 仓库里（文件、文件夹、标识符、注释、文档）不出现参照项目名或任何第三方产品名（契约的说明列里有，写文字时略去，只写这个量本身的含义）；不复制参照项目的代码。
- 界面只有 zh-CN 和 en-US；浏览器里不对密码做哈希；令牌不进 URL；被审核内容的文件地址和签名地址不写日志、不放进可分享的 URL、每次查看重新取；凭据类字段永不回显（留空表示不修改）。
- 不留调试日志；需要时用同一个标签 `[avatar-admin]`。
- 不加计划里没有的功能、待办或路线图条目；不写阶段、里程碑。
- 规格和契约是共享文档，**只读**；本仓库 `docs/shared-snapshots/` 是快照，不改。要改它们的地方写成完整的变更请求（名称、行为、检查顺序、错误、测试）放进报告。
- 不要克隆、挂载或读取 AvatarApp、AvatarBackend 等其他仓库。

## 报告（`docs/superpowers/handoff/reports/task-N-report.md`）

开头先写：**立即修未修 N、记录项 N、未运行 N、阻塞 N**（有未完成项时不用"完成、通过、干净"这些词）。然后写：改了哪些文件；红到绿的命令和输出；真实浏览器检查看了什么、发现什么；变异检查列表（每个变异和结果）；覆盖了哪些语言（只覆盖中文的写明）；问题文件清单；"需要改共享文件"清单；"规格需要在 main 上修改的地方"清单；记录项清单（文件行号加触发步骤）；变更候选。报告文件和你的代码一起提交（报告路径也在你的提交路径里）。

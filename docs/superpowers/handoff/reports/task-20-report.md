立即修未修 0、记录项 2、未运行 3、阻塞 0。另有一份给后端的问题文件（接口没写清的参数和响应字段，不阻塞）。

# 任务 20 报告：埋点管理（事件汇总、事件明细、漏斗分析）

环境：Node 24.22.1。一次独立评审还没做（按 CLAUDE.md：页面、报表、新增测试做一次独立评审，由主会话安排）。

## 做了什么

- `src/services/analytics/index.ts`：契约 §17.4 的接口各一个带类型的函数：`GET /analytics/events`、`/event-summary`、`/event-names`、`/funnel`，`GET/POST/PUT/DELETE /analytics/funnels`。`steps` 用逗号连成一个参数。
- `src/pages/analytics/`：
  - `summary.tsx` 事件汇总：日期范围默认最近 7 个 UTC 日，`maxDays` 取 `analyticsLiveMaxRangeDays`（没有这个值就不在前端限制，后端的 `INVALID_REQUEST` 只显示 `error.INVALID_REQUEST` 的译文）；一次拿全部事件名，前端分页 50，默认按 `pv` 降序，三列都能排序；"查询"按钮。
  - `detail.tsx` 事件明细：账号 ID、设备 ID、事件名（联想来自 `event-names`）、时间范围（不能清空，默认 7 天）；列事件名、账号（匿名为"—"）、设备、接收时间（提示"统计用"）、客户端时间（提示"客户端自报，不可信，仅供排查"）、平台、App 版本（这两列读 `context`）、国家、IP（后端给什么显示什么）；展开行显示格式化的 `params`、`context`（长串无空格也不撑破）；服务端分页，页大小 10/20/50/100。
  - `funnel.tsx` 漏斗分析：已保存漏斗选择框（预设带"系统预设"标签）、步骤（可输入的多选，选项来自 `event-names`）、窗口小时数（默认 24）、日期范围；步骤 2 到 10 个、窗口 1 到 720 的整数、步骤里不能有逗号也不能为空，不合格时不能查询、不能另存为、不能编辑（并写出原因）；结果是漏斗图加表格（序号、事件名、去重账号数、相邻步骤转化率），转化率直接用响应的 `conversionFromPrevious`（`null` 显示"—"，没有任何自己算的比率；图里的标签也用同一个值）；另存为、编辑、删除需要 `ANALYTICS:FUNNEL_MANAGE`，预设没有编辑和删除（另存为可以用来复制）；名称对话框、删除的行内确认都防重复提交；提示面板写明"同一账号按顺序在窗口内依次完成各步骤才算"、去重人数不跨日聚合、没有账号的事件按设备串联。
  - `FunnelNameModal.tsx`、`ReadState.tsx`、`useRead.ts`、`funnelRules.ts`、`testSetup.ts`：对话框、读取状态条、读取钩子（新的读取开始后，旧的回答作废）、漏斗规则、测试公用的登录。
- `mock/analytics.mock.ts`、`mock/_core/analyticsData.ts`：假后端。事件日志（约 330 条，含登录前后的事件、四十个只出现一次的事件名所以汇总有第二页、泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文的参数、5000 字符无空格串、emoji、客户端时钟偏差一天的事件、后端自己产生的事件）、三个预设漏斗；IP 没有 `ANALYTICS:IP_VIEW` 时掩码（IPv4 末段、IPv6 后半段）；漏斗按"主体"算（账号，没有就取同一设备带账号的事件的账号，再没有用设备），按（接收时间，`seq`）排序，窗口按相邻两步间隔；范围缺参数、跨度超过 31 天、页大小超过 200 都是 400 `INVALID_REQUEST`（`ref` 是参数名）；漏斗重名 409 `DUPLICATE_RESOURCE`、预设写入 409 `INVALID_STATE`、找不到 404 `RESOURCE_NOT_FOUND`。
- `config/routes/analytics.ts`：三个页面路由，权限 `ANALYTICS:VIEW`；`src/locales/{zh-CN,en-US}/analytics.ts`：所有文字，键相同。
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-analytics.md`。

## 红到绿

先写测试再实现。红（实现之前，同一批命令）：

```
npx vitest run mock/analytics.mock.test.ts src/services/analytics src/pages/analytics config/routes/analytics.test.ts
 ❯ src/pages/analytics/funnel.test.tsx (0 test)        Failed to resolve import "../../../mock/_core/analyticsData"
 ❯ mock/analytics.mock.test.ts (0 test)                Failed to resolve import "./_core/analyticsData"
 ❯ src/pages/analytics/detail.test.tsx (0 test)        Failed to resolve import "../../../mock/analytics.mock"
 ❯ src/pages/analytics/summary.test.tsx (0 test)       Failed to resolve import "../../../mock/_core/analyticsData"
 ❯ src/services/analytics/analytics.test.ts (0 test)   Failed to resolve import "./index"
 ❯ src/pages/analytics/funnelRules.test.ts (0 test)    Failed to resolve import "./funnelRules"
 ❯ config/routes/analytics.test.ts (6 tests | 3 failed) expected [] to deeply equal [ Array(3) ] / to have a length of 1 but got +0
 Test Files  7 failed (7)    Tests  3 failed | 3 passed (6)
```

全部因为"功能不存在"（模块不存在、路由是空数组）失败，不是拼写或配置错。绿（实现之后）：

```
npx vitest run mock/analytics.mock.test.ts src/services/analytics src/pages/analytics config/routes/analytics.test.ts
 Test Files  7 passed (7)    Tests  97 passed (97)
```

97 个测试：假后端 25、服务 6、漏斗规则 8、路由 6、事件汇总页 11、事件明细页 15、漏斗页 26。`npx tsc --noEmit` 和 `npx biome check` 对本任务路径没有报错；`tests/noHardcodedText.test.ts` 里对 `src/**/*.tsx` 的扫描通过。

注意：全仓库的"隐藏字符"扫描（`tests/noHardcodedText.test.ts` 的 `has no hidden, direction-control or non-ASCII space character`）现在是红的，原因是别的任务的文件 `mock/push.mock.test.ts:156` 里有一个原始的全角空格，不是本任务的文件；我的测试里的特殊空白都用 `String.fromCharCode` 构造。

## 真实浏览器检查（Playwright，端口 8320，时区 Asia/Singapore）

从暂存区之外的副本（scratchpad 下 `t20/app`）起 `max dev`，登录 `root`，三个页面都打开过：
- 事件汇总：55 个事件名，第一页 50 行、第二页 5 行，默认 `pv` 降序（`app_open` 79/45 在最上），点"事件名"表头后按名字排；请求是 `GET /analytics/event-summary?from=2026-10-20&to=2026-10-26`；控制台没有错误。
- 事件明细：20 行一页、共 5 页；展开行显示格式化的 `context`，`params` 为空显示"—"；悬停"客户端时间"出提示；事件名联想选 `session_started` 后查询得 7 行；IP 列显示后端给的值（掩码的 `203.0.114.*` 由于表格横向滚动在窄屏外，宽屏下可见）。
- 漏斗：选预设"激活漏斗"后查询，漏斗图四段，表格 45、28（62.2%）、14（50%）、7（50%），第一步转化率"—"；真实浏览器里连续输入多个步骤能加上（jsdom 里只能加一个，见记录项 1）；加入含逗号的步骤后显示"事件名里不能有逗号"、查询按钮禁用；另存为（泰语、阿拉伯语、emoji 的名字）双击确定只发一次 POST；编辑发 PUT、删除发 DELETE，提示"已更新""已删除"。
- zh-CN、宽度 420 的手机视口：三个页面的标题和文字都是中文，没有缺文字的提示；事件明细页一开始整页有横向滚动（筛选表单最后一行太宽），已修（给那一项 `width: 100%`），复查后三页都没有页面级的横向滚动。
- 发现并修了两个 antd 的弃用警告：`Table` 的 `rowKey` 函数带 `index`、`Modal` 的 `maskClosable`。
- 停服务：按监听 8320 的进程 PID 结束（`killport.py 8320`，没有用 `pkill -f`），之后 8320 不再响应。别的任务在跑的 `task12` 那个服务没有碰。
- 第一次起服务时我把副本的 `node_modules` 做成了指向仓库的符号链接，umi 的缓存因此写进了仓库的 `node_modules/.cache/mfsu`（被 .gitignore 忽略、可再生）；发现页面白屏后改成"目录里放逐项符号链接、缓存留在副本里"重起。这次缓存可能被别的任务的服务读到，对它们是可再生的缓存，我没有清它（别的服务在用）。

## 变异检查（25 个，各自跑相关测试）

每个都是改一处判断、跑对应测试、再还原。第一次抓到 22 个；3 个没抓到，其中 2 个是测试太弱，已加强后重跑变红（所以 24 个变红）；1 个是等价变异。

- 变红：`canManage` 恒为真；预设显示编辑和删除；转化率不取响应而是自己算；`null` 转化率显示 0%；"另存为"在表单不合格时仍可点；步骤数上限改 11（规则测试和页面测试各一次）；步骤数下限改 1；窗口上限改 721；逗号检查拿掉；事件汇总页大小 20；去掉默认 `pv` 降序；前端忽略 `analyticsLiveMaxRangeDays`；默认范围 6 天；事件明细去掉"客户端时间"提示；范围改成本地日期；账号 ID 不去空白；IP 被改动；假后端的 IP 掩码判断反过来；假后端漏斗忽略窗口；假后端预设可写；路由权限码写错。
- 第一次没抓到、加强后变红：名称对话框去掉防重复提交（原来的测试两次点击发生在同一个同步步里，后一次被 antd 吃掉；现在让 POST 悬着再点两次加回车，只许一次 POST）；步骤去空白改用 `String.trim`（原来的测试用的 U+3000 和 U+00A0 两个方法都去掉；现在用只有契约去掉的 U+0085 和只有 `String.trim` 去掉的 U+FEFF）。
- 等价变异（不是缺陷）：服务函数不自己 `join` 逗号，直接把数组传给请求层。请求层的 `buildQuery`（`src/request/apiClient.ts:47` 起）本来就把数组写成逗号连接的一个值，结果一样；测试断言的是线上 URL，所以不变红是对的。

## 覆盖的语言

界面只有 zh-CN 和 en-US，两种语言键相同（真实浏览器看过 zh-CN）。假数据和测试覆盖泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文：事件的 `params` 里七种语言的文字各一条；5000 字符无空格泰文串在 `params`、漏斗名里；emoji；阿拉伯语和泰语的参数在展开行里原样显示。事件名本身按契约只有 `[a-z0-9_]`，所以事件名的测试用的是这个字符集和 64 字符的长名字、2500 个泰文字符的名字（表格不撑破）。UTC 日边界（新加坡 01:30 的 27 日，发的是 26 日，范围 20 日到 26 日）在三个页面的测试里都有。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-analytics.md`：（1）`from`、`to` 的格式和跨度含不含两端、缺参数怎么办；（2）`GET /analytics/events` 的参数名和响应字段（`eventName` 还是 `name`、有没有 `id`、平台和版本是否只在 `context` 里）；（3）已保存漏斗的列表形状、请求体、名称长度和唯一性、预设写入的错误、步骤名要不要符合 `^[a-z0-9_]+$`；（4）步骤里的逗号。都有暂定做法。

## 需要改共享文件

没有。

## 规格需要在 main 上修改的地方

没有。（规格 5.6 写的三个预设漏斗名和契约一致；`测试` 里的"事件明细时间范围必填"在页面里是范围不能清空，默认 7 天。）

## 记录项（2）

1. `src/pages/analytics/funnel.test.tsx` 的 `addStep`：在 happy-dom 里，同一个多选框第二次"输入加回车"加不上步骤（真实浏览器里连续加 3 个步骤都加上了，见上），所以"多个步骤、第 11 个步骤、含逗号的步骤"的测试用"先保存到假后端再选择"的办法放进步骤，只有最后一个步骤是真的输入出来的。触发：把测试里的 `seed` 换成连续 `addStep`。后果：输入多个步骤的路径只有真实浏览器检查覆盖，没有自动测试。建议修（换成不受 happy-dom 限制的驱动方式，或补一个浏览器测试）。
2. `src/pages/analytics/detail.test.tsx`：IP 列表头的提示（`analytics.detail.ipTip`）没有测试；只有"接收时间"和"客户端时间"的提示测了。触发：把 `detail.tsx` 里 `tip={t('analytics.detail.ipTip')}` 改成空串，测试不变红。后果：提示丢失没人发现。建议修（补一个悬停断言）。

## 未运行（3）

1. 全量测试和构建：按规则最后一起跑。
2. 用不是 `root` 的管理员做真实浏览器检查（掩码 IP、没有写权限时的按钮）：这两点在单元测试里覆盖（`ANALYTICS:IP_VIEW` 在假后端测试，"没有 `FUNNEL_MANAGE` 不显示另存为、编辑、删除"在页面测试），真实浏览器里只用 `root` 看过。
3. Firefox、Safari；真实后端（后端没有接口的字段表，见问题文件）。

## 变更候选

- 事件明细的时间范围现在只到日，排查某个时间点的事件时可能要精确到分钟；要不要加时间选择，取决于后端对 `from`、`to` 的回答（问题文件第一条）。这是新增行为，要先和负责人确认。
- 选已保存的漏斗后要不要自动查询：现在只填入步骤和窗口，不自动查；规格写的是有"查询"按钮，没有写选择后自动查。

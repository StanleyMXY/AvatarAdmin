立即修未修 0、记录项 3、未运行 4、阻塞 0。另有五个契约问题写成了问题文件，等后端回复；有三处需要改共享文件、一处变更候选，见下面各节。

# 任务 19 报告：通话（会话列表、通话分析、通话质量）

提交：`e805349`（实现、测试、问题文件和这份报告）。`src/locales/zh-CN/sessions.ts` 被同一个检出里另一个任务的提交 `e63ba4e` 一起带进去了（文件内容是本任务的，已在 main 之前的历史里，状态干净）；这是并行会话共用索引造成的，不影响内容。

环境：Node 24.22.1，Chromium（Playwright）。本任务的测试共 119 个（会话列表 26、通话质量页面 35、通话分析页面 19、通话质量算法 15、假后端 16、接口函数 2、路由 6），全部通过；`biome` 无报错；`tsc` 在本任务的路径下无报错（项目里别的任务的在写文件有报错，不是本任务的）。这是新页面和报表，按规则做一次独立评审，由负责人另派；我做了实现、变异检查和真实浏览器检查，没有给自己做评审。

## 构建变量（任务 6 已经做好，本任务没有改）

`ADMIN_QUALITY_MIN_SUCCESS_RATE`（默认 0.95）和 `ADMIN_QUALITY_MAX_SLOW_SHARE`（默认 0.05）已经在 `config/buildVars.ts`（读环境变量、默认值、范围 0 到 1 的校验）、`config/config.ts` 的 `define`、`src/buildVars.ts`（浏览器里读，缺失时用默认值，字段名 `qualityMinSuccessRate`、`qualityMaxSlowShare`）、`.env.example`、`README.md` 的变量表里，并且各有测试（`config/buildVars.test.ts`、`src/buildVars.test.ts`，本次一起跑过，全部通过）。所以没有碰这个共享文件。通话质量页面读 `src/buildVars.ts`，红框阈值从这里来，页面里没有写死的数字。

## 改了哪些文件

- `src/services/sessions/{index,types}.ts`：`listSessions`（`GET /sessions`，筛选 `accountId`、`guest`、`from`、`to`、`ongoing`、`endReason`）、`getSession`（`GET /sessions/{id}`）。
- `src/pages/sessions/`：
  - `list.tsx`（会话列表）、`SessionDrawer.tsx`（详情抽屉，不是路由）、`AccountCell.tsx`（账号 ID 链接或"游客"）、`PlainValue.tsx`（后端文字一律转成纯文字、任意长度可折行）、`format.ts`（设备前 8 位、时长、时间）。
  - `analytics.tsx`（通话分析）、`analyticsRows.ts`（五个指标的计算）。
  - `quality.tsx`（通话质量）、`qualityMetrics.ts`（接通成功率、平均接通耗时、四档占比、合计、红框判断）。
  - `charts.tsx`（折线图和堆叠柱状图，纵轴写单位）、`useStatRead.ts`（读取，旧答案不覆盖新答案）。
  - 测试：`list.test.tsx`、`analytics.test.tsx`、`quality.test.tsx`、`qualityMetrics.test.ts`。
- `mock/sessions.mock.ts`、`mock/_core/sessionsData.ts`、`mock/sessions.mock.test.ts`：`GET /api/admin/sessions` 和 `/sessions/:id`（`SESSION:VIEW`）；60 条样例，含游客会话（设备是完整的 64 位哈希，用来检验页面只取 8 位）、进行中的、到点强制结束的、泰语/阿拉伯语/表情符号的模型档位和时区、5000 个字符的账号 ID；状态在 `globalThis` 上，`resetSessionsStore()` 可重置。
- `config/routes/sessions.ts`、`config/routes/sessions.test.ts`：通话菜单下 `/sessions/list`（`SESSION:VIEW`）、`/sessions/analytics`、`/sessions/quality`（`STATS:VIEW`）。
- `src/locales/{zh-CN,en-US}/sessions.ts`：菜单名和三个页面的全部文字（键两边相同）。
- `docs/contract-requests/2026-10-26-admin-frontend-sessions.md`：契约问题。
- 通话分析和通话质量用的报表接口（`getDaily`、`getSessionQuality`）、落地条、导出、日期范围、"如何阅读此报表"都是任务 9 的共用部件，假后端用任务 9 的 `mock/stats.mock.ts`。

## 红到绿

先写测试再写实现。红（实现不存在时）：

```
npx vitest run src/pages/sessions src/services/sessions mock/sessions.mock.test.ts config/routes/sessions.test.ts
 FAIL  mock/sessions.mock.test.ts                     Failed to resolve import "./_core/sessionsData"
 FAIL  src/pages/sessions/list.test.tsx               Failed to resolve import "../../../mock/_core/sessionsData"
 FAIL  src/pages/sessions/analytics.test.tsx          Failed to resolve import "./analytics"
 FAIL  src/pages/sessions/quality.test.tsx            Failed to resolve import "./quality"
 FAIL  src/pages/sessions/qualityMetrics.test.ts      Failed to resolve import "./qualityMetrics"
 FAIL  src/services/sessions/sessions.test.ts         Failed to resolve import "./index"
 FAIL  config/routes/sessions.test.ts                 5 个用例：路由是 []、menu.sessions.list 没有文字
 Test Files  7 failed (7)    Tests  5 failed | 1 passed (6)
```

（原始输出在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/t19-red.txt`。）全部是因为"功能不存在"，不是拼写或配置。

绿：同一条命令，`Test Files 7 passed (7)，Tests 119 passed (119)`。另外跑了 `src/locales`、`src/buildVars.test.ts`、`config/buildVars.test.ts`、`config/menus.test.ts`、`config/routes.test.ts`，全部通过；`tests/noHardcodedText.test.ts` 有 1 项失败（"没有隐藏字符"），报的是别的任务正在写的 `mock/campaign.mock.test.ts`，本任务的文件在这一项里没有任何报告。写页面过程中测试还红过几次，都是测试写法的问题（构建变量的替身把主题要用的颜色也替掉了；提示面板抢了 `role="alert"`），已改。

补测：变异检查发现三个变异活下来后补了三个测试（见下面）。

## 对照规格 5.5 逐条（"每个视觉元素按规格画"）

会话列表
- 筛选五项：账号 ID、是否游客、请求时间范围、是否进行中、是否到点强制结束（`endReason=DEADLINE`）。浏览器里看到五个标签，选"是否游客=是"后只发 `guest=true`，页面里 15 行全是"游客"。
- 列：会话 ID、账号 ID、设备、请求时间、开始时间、结束时间、时长、模型档位、语言，正好这九列。游客会话：账号列"游客"，没有链接；设备只显示前 8 位（完整哈希不在页面文字、提示、属性里，有测试检查整页 HTML）。账号会话：账号 ID 是指向 `/users/:id` 的链接，设备列"—"。
- 详情在抽屉里（会话 ID 点开，每次打开重新读一次），不是路由；404 时只显示 `error.RESOURCE_NOT_FOUND` 的译文。

通话分析
- 一张趋势图，五条线：通话次数、通话人数、通话总分钟、人均通话分钟、人均通话次数；纵轴"次数 / 分钟"，横轴"日期（UTC）"。明细表六列，日期列固定在左，无分页、无合计行。
- 请求是 `GET /stats/daily?from&to&platform=ALL`，没有平台和渠道筛选；落地条 `daily-business`，只对 `STATS:LAND` 显示；没有导出（规格 4.4 的导出清单里没有通话分析）。
- 人均通话分钟 = 通话总秒数 ÷ 60 ÷ 通话人数；人均通话次数 = 通话次数 ÷ 通话人数；分母为 0 或缺值显示"—"（图里是断开的空档），真的 0 显示 0；后端给的负数显示"—"；没有行的日子，图里次数、人数、分钟补 0，两个人均是空档。

通话质量
- 六张卡片，顺序和规格一致：接通成功率、平均接通耗时、≤2 秒占比、>10 秒占比、额度限制次数、用户未进入次数；数字取整个日期范围的合计后再算比率（不是各天比率的平均）。每张卡片标题旁有提示图标；成功率和 >10 秒占比的卡片下面写着"低于 95% 时红框""高于 5% 时红框"。
- 红框：成功率低于阈值、或 >10 秒占比高于阈值，对应的那一张卡片画红色边框（边框加外圈，数字也变红，并且有一行红字），刚好等于阈值不画；值不知道（分母为 0）不画；别的卡片永远不画。阈值取构建变量，测试里换了阈值（低一点、高一点、两个方向）结果就变。
- 接通成功率 = connected / (connected + agentUnavailable)；平均接通耗时 = joinMsSum / connected（毫秒转秒）；四档（≤2、2–5、5–10、>10 秒）每档占 connected 的比例；分母为 0 显示"—"；"有尝试但一个没接通"是 0%（不是"—"）并画红框。
- 趋势图一张折线（接通成功率，纵轴"成功率（%）"，没有行或没有分母的日子是断开的空档，不是 0%）；一张堆叠柱状图（四档接通耗时，纵轴"接通数（次）"，每天四档之和等于当天接通数，缺的日子补 0）；明细表 11 列，日期列固定在左，无分页。
- 页面顶部写"统计日按 UTC 计算"；"如何阅读此报表"可关闭，关闭状态存 `localStorage` 的 `reportHelper:sessionQuality`（刷新后仍关闭，浏览器里验证过）；落地条 `session-quality`；导出名 `session-quality`，参数是"点过查询之后"的日期，需要 `STATS:EXPORT` 加 `STATS:VIEW`；点两下只发一次请求（落地、导出都有测试）。
- 错误只显示错误码对应的译文，不显示后端的话；旧的答案不会覆盖新的（两个报表页都有"第一次请求慢、第二次快"的测试）。

## 真实浏览器检查（Chromium，端口 8319，`root` 登录）

从 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/t19/copy` 的副本起的（含 `src/.umi`，`node_modules` 用链接）；副本里把别的任务正在写的 `config/routes/campaign.ts` 清空了，因为它指向还没写完的页面会让 Umi 起不来（只改了副本）。脚本在 `scratchpad/t19/t19-*.js`，截图在 `scratchpad/t19/shots/`。

- 三个页面都打开，主要操作都点了；控制台没有页面错误。只有一条 antd 的警告（抽屉的 `width` 已弃用），已改成 `size`。
- 会话列表：20 行，布局没有横向溢出（1400 和 390 像素宽都没有）；5000 个字符的账号 ID 两行截断，泰语模型档位在单元格里截断；游客行"游客"+设备 8 位（`7aa8f5b3`）；账号行链接 `/users/<id>`；"是否游客=是"请求 `guest=true`；"否"加"到点强制结束=是"请求 `guest=false&endReason=DEADLINE`，8 行。抽屉：游客会话和 5000 字符的会话都打开，抽屉里没有横向溢出。
- 通话分析：趋势图五条线加图例，表 7 行；点两下"重新落地该日"只发一个 `POST /stats/land/daily-business?date=2026-10-25`（UTC 昨天）。
- 通话质量：6 张卡片，2 张图，表 7 行；导出下载到 `session-quality-2026-10-20-2026-10-26.xlsx`；落地 `POST /stats/land/session-quality?date=2026-10-25`；关闭说明后刷新仍关闭。任务 9 的假数据里成功率 94% 到 97%、>10 秒占比恒为 5%，所以默认看不到红框（见记录项 1）；我用 Playwright 拦截请求给了一组差的数据：成功率 80% 和 >10 秒占比 7.5% 两张卡片红框（暗色和亮色主题都看了，边框 `rgb(220,68,70)`），其他四张不画；没有行的日子成功率是空档，表里是"—"。
- 浏览器看出来并已修的 5 处：抽屉 `width` 弃用警告；折线图横轴日期互相挤在一起（改成月-日，提示框里仍是完整日期）；只有一天有数据时折线图什么也看不到（给每个点加了标记）；抽屉里"请求时间"等标签折成两行（标签列固定宽度）；账号 ID 是 UUID 时在列表里折成两行（放宽到 320 像素）。
- 手机宽度（390 像素）三个页面没有横向溢出。
- 服务按监听进程 PID（31791）停掉，端口 8319 已释放，没有用 `pkill -f`。

## 变异检查

51 个变异，改的是副本里的源码，每个跑相关测试再还原。最后全部被测试抓住（其中 3 个第一轮活下来，补测后抓住）。

- 接通成功率：分母不含不可用次数；平均接通耗时不除以 1000；红框在阈值上也画（低、高各一个）；低红框方向反了；成功率阈值写死 0.95；>10 秒阈值写死 0.05；不知道的值也画红框；合计只取最后一天；没有日子时合计是 0 而不是空。
- 红框落点：成功率卡片被 >10 秒占比带红框；>10 秒卡片被成功率带红框（这两个第一轮活下来，补了两个测试："只有自己的数字超限的卡片才画红框"）。
- 图：柱状图不堆叠；折线图把未知画成 0；折线图不补满日期；通话分析图不补满日期。
- 请求和按钮：导出名；落地名（质量页和分析页各一个）；导出要另一个查看权限；点"查询"什么也不做；导出取了正在编辑的日期而不是点过查询的日期（这个第一轮活下来，补了测试"导出的是屏幕上的日期，不是还在编辑的日期"）；不发 `platform=ALL`；"说明"的存储键写错。
- 旧答案覆盖新答案（去掉计数比较）；显示后端的话而不是译文。
- 通话分析的计算：人均分钟不除 60；人均次数除以次数；总分钟不除 60；没有行的日子人均是 0；负数被接受；没有人通话时人均是 0。
- 会话列表：每个会话都当作账号会话；设备取 9 位；游客筛选反了；到点强制结束筛选发错值；进行中筛选反了；日期范围的结束没有移到后一天；账号链接路径错；已结束的显示"进行中"；游客有链接；抽屉里显示完整设备；账号 ID 不去首尾空白；会话 ID 不编码。
- 路由权限：列表要 `STATS:VIEW`；分析要 `SESSION:VIEW`。
- 假后端：进行中反了；范围结束含在内；列表要 `STATS:VIEW`；游客筛选反了；账号 ID 按前缀匹配。

## 覆盖的语言

界面：zh-CN 和 en-US 两种，页面和卡片标题在两种语言下都测过（`sessions` 键两边相同、占位符相同，`src/locales` 的一致性测试通过）。假数据和测试：语言标签含 `th`、`ar`、`id`、`vi`、`es`、`en`、`zh` 七种；长文字（泰语、阿拉伯语、中文、表情符号、5000 个字符不换行的串）覆盖在账号 ID、模型档位、语言、时区、房间名里（列表和抽屉都测了，浏览器里也看了泰语、表情符号和 5000 字符）。印尼语、越南语、西班牙语只作为语言标签（`id`、`vi`、`es`）出现，没有这三种语言的长文字；这三种语言的长文字布局只覆盖到"和泰语、阿拉伯语同样是任意文字"这个程度。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-sessions.md`：（一）`GET /sessions` 里账号 ID、时间范围、是否进行中三个筛选的参数名，`endReason` 还接受哪些值，非法值怎么回；（二）`deviceId` 是完整哈希还是前 8 位（建议后端只返回前 8 位）；（三）`GET /sessions/{id}` 返回哪些字段；（四）列表里怎么认出游客会话；（五）"进行中"是否包括"启动中"的会话。五条都有暂定做法，不阻塞。

## 需要改共享文件

1. `src/components/stat/TrendChart.tsx`：没有纵轴标题和单位的入口，所以通话两个页面用了本地的 `src/pages/sessions/charts.tsx`（折线加堆叠柱状，纵轴有标题，空档不画成 0，日期标签用月-日）。共用组件加上标题和空档属性后可以删掉本地版本。
2. `src/hooks`：现在有三份"读取、旧答案不覆盖新答案"的钩子（`src/pages/users/useRead.ts`、`src/pages/stat/guest/useReport.ts`、本任务的 `src/pages/sessions/useStatRead.ts`），应该有一份共用的。
3. `src/components/stat/ReportHelper.tsx`：说明文字不能带占位符（组件取文字时不传值），所以阈值数字不能写在说明里，我把它们写在两张卡片下面。

## 规格需要在 main 上修改的地方

无。（规格 5.5 会话列表没有写筛选的参数名，这在契约；问题文件第一条请后端补到契约 §17.4 通话行。）

## 记录项（建议全部修）

1. `mock/stats.mock.ts:107-128`（任务 9 的文件）：`/stats/session-quality` 的样例里 >10 秒占比固定是 5%，`agentUnavailable` 占 0 到 6%，所以成功率 94% 到 97%、>10 秒占比 5%：在开发用假后端里这个页面的卡片一般都不画红框，只有个别天成功率低于 95%（但合计后是 95.4%）。触发：`npm run dev:mock` 打开通话质量页，看不到红框。后果：只在假数据下，运营看不到红框长什么样（本任务用拦截的数据看过）。建议样例里加一天明显差的数据。
2. `src/pages/sessions/list.test.tsx`："打开一个会话再打开另一个，旧的答案不覆盖新的"这个用例在去掉 `useStatRead` 里的计数比较后仍然通过（变异 M16 被通话质量和通话分析的用例抓住，但不是这个用例）。原因：抽屉关闭时组件卸载，卸载本身也让旧答案作废；从界面上也做不到不关抽屉就直接打开另一个（遮罩挡住了列表）。所以没有真实后果，但这个用例不能证明钩子里的那一行。建议直接给 `useStatRead` 写钩子测试（两次读取、先发的后到）。
3. `src/pages/sessions/quality.tsx`：卡片数字是整个日期范围的合计，但最近一天（今天）的行是临时值，数字之后还会变（契约 §17.6：当天的行是临时值，次日起固定）；页面上没有标识。触发：范围含今天时看卡片。后端没有标志，只能在文字里写，目前没写。

## 未运行（4）

- 全量测试和构建（按规则最后一起跑）。
- 浏览器里的中文界面：中文只在单元测试里看了（页头、卡片标题、时长），没有在浏览器里截图看布局；Firefox、Safari 也没看。
- 手机宽度下图表的触摸交互（只看了 390 像素宽没有横向溢出）。
- 真正的 Microsoft Excel 打开导出样例（导出是任务 9 的共用部件，本任务没有改）。

## 不是缺陷

- 通话分析的 `sessionsConnected`、`accountsWithCall` 只统计有账号的会话（契约 §17.6），所以通话分析的数字不含游客；页面上写了一句说明，游客通话在日报里。
- 会话列表"是否到点强制结束"只有"是"一个选项：契约只有 `endReason=DEADLINE` 这一种写法，没有"不是到点结束"。
- 抽屉不显示 `lastParticipantEventAt`、`agentIdentity`、`statsAppliedAt`：内部字段，运营不需要（问题文件第三条问后端）。
- 通话分析页没有"如何阅读此报表"：规格 4.4 只列了留存、回流、游客转化队列、游客留存、漏斗、通话质量；通话分析的两个人均列的标题旁有提示图标。

## 变更候选

1. 通话分析的一张图里五条线量纲不同（次数、人数、分钟、人均分钟、人均次数），人均两条线在浏览器里贴着 0 的横线，图例点一下可以隐藏大数的线。规格写的是一张趋势图，我按它做了；要改成左右两个纵轴（人数和分钟一个轴、人均一个轴）是变更，需要负责人决定。
2. 会话列表加"到点强制结束=否"和"结束原因"筛选：需要后端先支持，属于契约变更。

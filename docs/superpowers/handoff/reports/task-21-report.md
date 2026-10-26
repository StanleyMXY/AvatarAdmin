立即修未修 0、记录项 4、未运行 3、阻塞 0。另有四个契约问题写成了问题文件，等后端回复；需要改共享文件 2 处（见下）。

# 任务 21 报告：总览 `/dashboard`

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。本任务的测试共 115 个（页面 59、纯函数 44、`useSource` 钩子 7、路由 5，分文件见"红到绿"），全部通过；`biome`、`tsc`（只看本任务路径）无报错。本任务做的是新页面，规则里属于"页面、报表：一次独立评审"，评审由负责人另派（我只做了实现、变异检查和真实浏览器检查，没有给自己做评审）。

## 改了哪些文件

- `src/pages/dashboard/overview.tsx`：页面（路由 `./dashboard/overview`）。八张卡片（六张统计卡、审核积压、未处理告警）、趋势图、平台分布环形图、快捷入口；每个请求有自己的状态，一张卡失败只显示它自己的失败和"重试"，别的卡照常显示数字。
- `src/pages/dashboard/cardChange.ts`：`computeCardChange(series, today)`（签名与任务书一致，另有可省略的第三个参数 `kind: 'relative' | 'points' = 'relative'`，留存卡传 `'points'` 得百分点差）、`latestCohortWithD1(rows)`，以及 `shiftDay`、`dailySeries`、`retentionD1Series`、`cleanFigure`。
- `src/pages/dashboard/trendData.ts`：趋势图的五种范围预设、四个指标、每天的值和"上周同期"的值（`trendPoints`）。
- `src/pages/dashboard/trendChart.ts`、`TrendSection.tsx`：趋势图（范围预设、指标多选至少保留一个、虚线的"上周同期"、轴上写单位）。
- `src/pages/dashboard/PlatformRing.tsx`、`QuickLinks.tsx`、`OverviewCard.tsx`、`NavButton.tsx`、`changeText.ts`、`dashboardSources.ts`、`useSource.ts`：环形图、快捷入口、卡片、站内跳转按钮、变化的文字、六个请求、"每个请求一个状态"的钩子（旧答案不覆盖新答案）。
- 测试：`cardChange.test.ts`（25）、`trendData.test.ts`（15）、`changeText.test.ts`（4）、`useSource.test.tsx`（7）、`overview.test.tsx`（59）、`config/routes/dashboard.test.ts`（5）。
- `config/routes/dashboard.ts`：`/dashboard`，菜单 `dashboard`，页面名 `overview`，没有 `access`（登录即可）。
- `src/locales/{zh-CN,en-US}/dashboard.ts`：保留任务 17 的全部键（`menu.stats.*`、`stat.daily.*`、`stat.retention.*`、`stat.reactivation.*`，一个字没动），在同一个文件里加了本任务的键（`menu.dashboard.overview`、`dashboard.*`）；每个键只定义一次；文件头注释改成两件事都写。
- `docs/contract-requests/2026-10-26-admin-frontend-dashboard.md`：四个契约问题。
- 没有改假后端：任务 9 的 `mock/stats.mock.ts`、任务 13 的 `mock/monitor.mock.ts`、任务 15 的 `mock/moderation.mock.ts` 已经满足本页。

## 对照规格 5.1 和任务书逐条

- 只需登录；统计类卡片、趋势图、环形图要 `STATS:VIEW`，审核积压卡要 `MODERATION:VIEW`，未处理告警卡要 `MONITOR:VIEW`；没有对应权限就不渲染，也不发那个请求。快捷入口按目标页面的权限：日报、留存、游客统计、通话质量要 `STATS:VIEW`，订阅统计要 `FINANCE:VIEW`（与规格 5.0 一致，路由测试把每个已存在的目标页面的 `access` 和这里的码对一遍）。一个权限都没有时显示"没有可显示的总览卡片"，不是空白页。
- 请求数是测试：只有 `STATS:VIEW` 时恰好 4 个（`/stats/daily` `platform=ALL` 取 90 天、`/stats/retention` `type=ACTIVE` 取 90 天、`/stats/daily?platform=ANDROID`、`…IOS` 只取当天）；加 `MODERATION:VIEW` 多 1 个 `/moderation/stats`（`from=to=今天`），加 `MONITOR:VIEW` 多 1 个 `/alerts?status=OPEN&page=1&pageSize=1`（只读 `total`）；没有这两个权限就一个都不发；只有某一个权限时只发对应的那一个；什么权限都没有时一个请求都不发。改趋势图的范围或指标不再请求。
- 六张卡片：新增账号（`newAccountsRegistered`）、日活（`dau`）、D1 留存、通话总分钟（`callSecondsTotal / 60`）、新订阅、游客设备转注册。每张有当前值、较昨日、较 7 天前；百分比保留一位小数；留存用百分点（"+5 pp" / "+5 个百分点"）；涨绿跌红，变成 0 不上色；前一天缺失、为 `null` 或 0 时是"—"；值为 0 显示 0，值不存在显示"—"；不会出现 NaN、null、负数（计数里的负数和非有限数按"不知道"处理）。
- 当天值是临时值：五张按日的卡片在数字旁有"临时值"标记；今天还没有这一行时卡片显示"—"、不标临时值。D1 卡取 `ACTIVE` 类型里最新一个 `d1` 非空的 cohort，卡上写出 cohort 日期；因为昨天这个 cohort 的 `d1` 是今天才数出来的，所以 cohort 日期加一天等于今天的那个 D1 也标"临时值"（见问题文件第二条）。D1 的较昨日、较 7 天前是这个 cohort 往前一天和往前七天的 cohort。
- 刷新说明：`useAdminMeta().landIntervalMinutes` 是大于 0 的数字时写"今日数据是临时值，每隔 N 分钟刷新一次"，N 取后端给的值（测试用 15 和 7 都写对了）；没有值、为 null、0、负数或不是数字时只写"今日数据是临时值"，不出现任何数字。页面顶部写"统计日按 UTC 计算"。
- 审核积压卡：`oldestPendingSeconds` 用审核页的 `formatDuration` 写成"3 d 4 h"；`null`（没有待处理）显示"—"并写"没有待处理的内容"。未处理告警卡：显示 `total`，0 显示 0，`total` 不是数字显示"—"。两张卡（整张卡和里面的链接）都能点进去（`/moderation/queue`、`/monitor/alerts`），点链接不会跳两次。
- 趋势图：一张图，范围预设五种（今天、近 7 天、近 14 天、近 30 天、自定义），默认近 7 天；指标多选（日活、新增账号、通话总分钟、D1 留存），删到最后一个时不起作用，默认日活加新增账号，按规格的顺序保存；每个指标一条实线加一条同色虚线"（上周同期）"；人数和分钟共用左轴，百分比（D1）用右轴，单独选 D1 时在左轴；每个轴的标题写单位（"账号数"、"分钟"、"%"，几个单位用 " / " 连起来）。过去的日子没有行补 0（规格 4.4），今天没有行、某列为 `null`、范围在已读 90 天之外都留空档，不画 0；D1 没有 cohort 也留空档。一天的范围画不出线，改画带数字的点。自定义范围只能选已读的 90 天之内。
- 平台分布：环形图，当日 `ANDROID` 与 `IOS` 的 `dau`（两个请求，只取今天），环旁写数值和占比，标"临时值"；两个都没有数字或都是 0 时写"今日还没有按平台拆分的日活"，不画空环。任一请求失败时环单独显示失败和"重试"，只重试失败的那个。

## 红到绿

先写测试再写实现。红（实现和路由都不存在时）：

```
npx vitest run src/pages/dashboard config/routes/dashboard.test.ts
 FAIL  src/pages/dashboard/cardChange.test.ts   Error: Failed to resolve import "./cardChange" ... Does the file exist?
 FAIL  src/pages/dashboard/overview.test.tsx    Error: Failed to resolve import "./overview" ... Does the file exist?
 FAIL  src/pages/dashboard/trendData.test.ts    Error: Failed to resolve import "./trendData" ...
 FAIL  src/pages/dashboard/useSource.test.tsx   Error: Failed to resolve import "./useSource" ...
 FAIL  config/routes/dashboard.test.ts > ... > is /dashboard in the 总览 menu with an existing component and no permission code
       AssertionError: expected [] to have a length of 1 but got +0
 FAIL  ... > is the first page of the assembled table and needs only a sign-in
       AssertionError: expected { path: '/users/list', … } to deeply equal { path: '/dashboard', access: null }
 FAIL  ... > shows in the menu for an administrator without any permission     expected [] to deeply equal [ '/dashboard' ]
 FAIL  ... > has a menu text in both languages and opens under it                TypeError: Cannot read properties of undefined (reading 'name')
 Test Files  5 failed (5)   Tests  4 failed (4)
```

绿（同一条命令，实现之后）：`Test Files 6 passed (6)`，`Tests 115 passed (115)`，其中 `config/routes/dashboard.test.ts` 5、`cardChange.test.ts` 25、`changeText.test.ts` 4、`overview.test.tsx` 59、`trendData.test.ts` 15、`useSource.test.tsx` 7。相关的既有测试一并跑过：`src/locales`（两种语言键一致、占位符一致、en-US 没有中文）、`tests/noHardcodedText.test.ts`、`config` 下全部测试：35 个文件、822 个测试全部通过。页面测试写好之后，实现一次通过的原因是测试先写、实现照着测试的 id 和文字写；其后在真实浏览器里发现的三处问题（见下）又各补了测试（单日的点、图表重建、小数）。

## 真实浏览器检查（Chromium，端口 8321，`root` 登录；从 `git archive` 加本任务文件的副本启动，放在临时目录，避免和共享检出里别的会话的 `src/.umi` 抢）

- `root`（所有权限）：恰好 6 个请求（4 个统计请求、`/moderation/stats?from=to=今天`、`/alerts?status=OPEN&page=1&pageSize=1`），参数和测试里的一致；八张卡片都有数字（新增账号 61、日活 1,429、D1 36%（cohort 2026-10-24）、通话分钟 2,779.5、新订阅 25、游客转注册 45、审核积压 3 d 4 h、告警 15）；说明行"每隔 15 分钟刷新一次"；五个快捷入口；点"日报"进入日报页；点卡片和点卡片里的链接各跳一次到告警页、审核队列。
- 其他账号：`reviewer` 只有审核积压卡、只发 1 个请求、没有趋势图和快捷入口；`finance` 有六张统计卡、趋势图、五个快捷入口（含订阅统计）；`support` 有四个快捷入口，没有订阅统计。（`fresh` 要先绑定认证器，没有走登录；告警卡的权限路径由单元测试覆盖。）
- 趋势图：五个预设逐个点过；指标加上 D1 和通话分钟后左轴"Accounts / Minutes"、右轴"%"，实线和同色虚线都画出来；"今天"画点和数字；暗色（Dim）和浅色（Light）都看过，中文界面看过。
- 拦截 `/stats/daily?…platform=ALL` 返回 500：五张日卡和趋势图各自显示"加载失败：服务器错误…"（只有错误码对应的译文，后端的话"raw backend words"没有出现），D1、审核、告警、环形图照常；放行后点"重试"，日活恢复，并且只多发 1 个日报请求。
- 390 像素宽：没有横向溢出。
- 控制台：只有构建工具关于 `async/await` 的警告和登录第一步的一次 401（预期）。没有页面错误。
- 浏览器里发现并已修的三处（都是单元测试里的假图表看不到的）：（1）从"今天"切回"近 7 天"后，图表库保留了单日时的数字标签（图表库在选项变化时不清旧的标记）——现在范围是一天还是多天、指标一变就换一张新图，有测试（换指标和切预设时图表元素被替换）；（2）通话分钟的数字标签和提示框带很长的小数（2872.283333…）——图里的值取一位小数；（3）"今天"只剩数字标签、没有点——单日时加点标记（实线实心、上周同期淡一点）。
- 服务按监听进程的 PID 停掉（本机没有 `ss`，我从 `/proc/net/tcp` 的监听 inode 找到进程 4980 和第二次启动的 18583，各自 `kill`，端口已释放），没有用 `pkill -f`。

## 变异检查

41 个变异，每个都是改源码、跑本任务的测试、还原。第一轮 35 个被抓住，6 个活下来；补了测试后这 6 个重做，全部被抓住。

被抓住：未处理告警卡不看权限；审核权限判断反过来；没有 `STATS:VIEW` 也发环形图的请求；订阅统计入口要 `STATS:VIEW`；游客统计入口指向日报；较昨日前一天为 0 也算（除以 0）；D1 用相对变化而不是百分点；最新 cohort 取第一个而不是最新；最新 cohort 不排除 `CALL` 类型；`d1` 为 0 当成没有值；日卡的"临时值"去掉；D1 的"临时值"规则去掉；刷新说明接受 0 分钟；最后一个指标也能删；虚线不画成虚线；"上周同期"取 6 天前；过去没有行的日子不补 0；今天没有行补 0；旧答案覆盖新答案；旧的失败覆盖新数据；告警请求 `pageSize` 改成 20；留存请求去掉 `type`；日报请求去掉 `platform=ALL`；只读 60 天；趋势图 D1 用小数不用百分数；轴标题去掉单位；两个轴都放左边；环形图画全 0；计数接受负数；审核"没有待处理"的说明去掉；选 D1 时不要求留存请求成功；涨跌颜色对调；默认预设改成 30 天；通话分钟不除 60；图里的值不取一位小数（这条是浏览器里发现小数问题后补测试时做的）。

第一轮活下来、补测后被抓住：刷新说明写死 15（原测试恰好用 15，补了用 7 的测试）；环形图和审核请求用浏览器本地日而不是 UTC 日（Auckland 时区的测试原来只查日报请求，补上环形图和审核请求）；变化的颜色按没四舍五入的值取（补了 `changeText.test.ts`：-0.04% 写"0%"、不上色）；图表不重建（补了元素被替换的测试）；指标不按规格顺序保存（补了标签顺序的测试）；自定义范围不限制已读天数（补了日历里 `2026-10-27` 是禁用格的测试）。

## 覆盖了哪些语言

界面 zh-CN 和 en-US 两种（页面测试里各有一组用中文渲染，浏览器里两种都看过；`src/locales` 的一致性测试保证两边键、占位符相同，en-US 没有中文字符）。本页没有显示任何用户输入或后端给的自由文字（只有数字、日期、固定名称和错误码对应的译文），所以泰语、阿拉伯语、印尼语、越南语、西班牙语的假数据没有进入这个页面；这一项只覆盖中文和英文界面。

## 问题文件清单

`docs/contract-requests/2026-10-26-admin-frontend-dashboard.md`：（一）UTC 零点之后、第一次落地之前，今天这一行返回不返回；（二）昨天 cohort 的 `d1` 什么时候有值、是不是临时值；（三）`oldestPendingSeconds` 和 `from`、`to` 有没有关系；（四）`/alerts?status=OPEN` 的 `total` 是不是全部未处理数。四条都有暂定做法，不阻塞。

## 需要改共享文件

1. `src/components/stat/StatCard.tsx` 只有一个对比（`previous`），而规格 5.1 要每张卡片同时有较昨日和较 7 天前，还要"临时值"标记。本任务在 `src/pages/dashboard/OverviewCard.tsx`、`changeText.ts` 里做了本地版本（规则和 `StatCard` 一样：前一天 0 或缺失是"—"、涨绿跌红、百分点用 pp）。建议给 `StatCard` 加第二个对比和临时值标记，之后可以删掉本地版本。
2. `src/components/stat/DateRangeUtc.tsx` 的预设是今天、昨天、近 7 天、近 30 天，而规格 5.1 的趋势图要的是今天、近 7 天、近 14 天、近 30 天、自定义，并且自定义范围要限制在已读的 90 天之内（它不能禁用日期）。本任务在 `TrendSection.tsx` 里直接用了日期选择器。

## 规格需要在 main 上修改的地方

1. 5.1 写"当前值、较昨日、较 7 天前"，没有说当前值是不是未过完的今天。按字面做的结果：UTC 零点后的头几个小时，今天只有一小部分，较昨日几乎所有卡都会是很大的负数。如果运营看到的应该是完整日的比较，需要规格写明改成"最近一个完整日"（那是变更，不是缺陷；本任务按规格字面做，并标了"临时值"）。
2. 5.1 写"较昨日、较 7 天前"，D1 卡的当前值不是今天而是最新有 `d1` 的 cohort，较昨日就是这个 cohort 的前一个 cohort；规格没有写这一点，建议补一句。
3. 5.1 写趋势图和比较各取最近 90 天，所以自定义范围最早只能到 90 天前，"上周同期"那条虚线在最早的七天没有数据（留空档）；建议规格写明自定义范围的限制。
4. 5.1 的平台分布只有 Android 和 iOS，占比是这两个的占比，`unknown` 平台（契约 §17.6）的日活不在里面，所以占比和日活卡上的总数对不上；建议规格写明。

## 记录项（建议全部修）

1. `src/pages/dashboard/overview.tsx:5` 从 `../moderation/duration` 取 `formatDuration`（别的模块的页面目录里的函数）。触发：审核模块把这个文件改名或移动。结果：总览编译失败。应该放进 `src/utils/`（共享文件，本任务不能动）。
2. `src/pages/dashboard/TrendSection.tsx:52`（`failed` 那一段）：趋势图用到的任何一个请求失败，整张图换成失败提示。触发：留存请求失败，再把 D1 选进指标。结果：已经读到的日活、新增账号也不画。可以改成只缺失败那个指标。
3. 图表的提示框（悬停）没有测试也没有在浏览器里悬停看过：`src/pages/dashboard/trendChart.ts:88` 里 D1 的提示框数值格式化（加"%"、一位小数）是一个函数，测试用的假图表不会调用它。触发：悬停 D1 的一个点。预期"30%"，我没有验证。
4. `src/pages/dashboard/QuickLinks.tsx`：通话质量入口指向 `/sessions/quality`，这个路由现在不在路由表里（`config/routes/sessions.ts` 还是空的，通话页面是别的任务），点它会到 404；路由测试对"已在路由表里的目标"核对权限码，通话页面上线后会自动核对。触发：现在用 `root` 点"通话质量"。结果：404 页面。这个入口是规格 5.1 写的，所以没有去掉。

## 未运行（3）

- 全量测试和构建（按规则最后一起跑）。
- Firefox、Safari；深（Deep）主题的截图没看（看了暗色 Dim 和浅色 Light）；手机宽度下图表的触摸交互（只看了 390 像素宽没有横向溢出）。
- 独立评审（本任务是页面，规则要一次独立评审，由负责人另派）。

## 变更候选

- `StatCard` 加第二个对比和临时值标记（需要改共享文件第 1 条）。
- 总览的比较改成"最近一个完整日"（规格修改第 1 条）。
- 趋势图一个请求失败时只缺那个指标，其余照画（记录项 2）。

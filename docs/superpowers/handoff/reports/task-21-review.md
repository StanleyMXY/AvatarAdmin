立即修 0、记录 6、变更 1、不是缺陷 5、阻塞 0

# 任务 21（总览 `/dashboard`，提交 ca6d62d）独立评审

评审方式：先读 `CLAUDE.md`、执行约定、模块任务说明、任务书（`brief.sh 21`）、规格 5.0 和 5.1、契约 §17.6 总览一行、问题文件和实现者的报告；再逐文件读 `src/pages/dashboard/` 的全部源码；然后在副本里（`git archive ca6d62d`，放在 scratchpad 的 `t21r-copy`，共享检出没有被改动）跑测试和变异。我没有改共享检出里的任何源文件，也没有提交。

重跑结果（副本，Node 24）：本任务 6 个测试文件 115 个测试全部通过；`biome check` 对本任务路径无报错；`tsc --noEmit` 里没有 dashboard 的诊断；`src/locales` 一致性测试和 `tests/noHardcodedText.test.ts`（副本里先 `git init`，因为该测试要 `git ls-files`）通过。

## 一、规格 5.1 逐句对照

| 规格的句子 | 页面实际做的 | 结论 |
|---|---|---|
| 只需登录；统计类卡片需要 `STATS:VIEW`，审核积压卡需要 `MODERATION:VIEW` | 路由没有 `access`（`config/routes/dashboard.ts`）；`overview.tsx:73-75` 取三个权限码，各卡、趋势图、环形图按码渲染，没有码不渲染也不发请求 | 一致 |
| 6 张统计卡，每张有当前值、较昨日、较 7 天前（百分比；留存用百分点） | 新增账号、日活、D1、通话总分钟、新订阅、游客设备转注册，顺序同规格（`overview.tsx:35-45, 137-146`）；每张两个对比，留存用 `points`（`cardChange.ts:48-55`，`(current-earlier)*100`） | 一致 |
| 新增账号 `newAccountsRegistered`、日活 `dau`、通话总分钟 `callSecondsTotal/60`、新订阅 `newSubscriptions`、游客设备转注册 `guestDevicesConverted` | `cardChange.ts` 的 `dailyFigure` 字段名与后端回复和 `StatDailyRow` 一致，分钟除以 60 | 一致 |
| D1 留存：`ACTIVE` 类型里最新一个 `d1` 非空的 cohort | `latestCohortWithD1`（`cardChange.ts:86-95`）：只取 ACTIVE、平台 ALL、渠道 ALL，`d1` 非空（0 算有值），取 `cohortDate` 最大的；`d1` 是人数，页面除以 `cohortSize`，契约 §17.6 的 `StatRetention` 写的就是人数 | 一致 |
| 前一天缺失或为 0 → 变化为 null，显示"—" | `changeAgainst`（`cardChange.ts:48-55`）：`earlier === null` 或 `<= 0` 返回 null；`describeChange` 把 null 写成 `—`；负数和非有限数经 `cleanFigure` 当作"不知道" | 一致 |
| 当天的值是临时值，卡片旁标注 | 五张按日的卡在当前值不为 null 时标"临时值"（`overview.tsx:99`）；今天没有这一行时显示"—"且不标；D1 在 cohort 日期加一天等于今天时标（`overview.tsx:123-125`，来自问题文件第二条） | 一致（D1 的标记是实现者按契约缺口做的暂定，已写成问题文件） |
| 有 `MODERATION:VIEW` 时多一张"审核积压"：最老待处理的等待时长 | `oldestPendingSeconds` 经 `formatDuration` 写出；`null` 显示"—"并写"没有待处理的内容"；整卡和链接都进审核队列 | 一致 |
| 有 `MONITOR:VIEW` 时多一张"未处理告警"（`GET /alerts?status=OPEN` 的条数），点击进入告警页 | `/alerts?status=OPEN&page=1&pageSize=1` 读 `total`；整卡和链接进 `/monitor/alerts`（路由表里存在）；`total` 不是数字显示"—" | 一致（`total` 的含义已写成问题文件第四条） |
| 趋势图：范围预设今天、近 7 天、近 14 天、近 30 天、自定义 | `trendData.ts` 的 `RANGE_PRESETS` 五种；自定义的日历限制在已读的 90 天内 | 一致 |
| 指标多选（日活、新增账号、通话总分钟、D1 留存），至少保留一个，默认日活 + 新增账号 | `TREND_METRICS`、`DEFAULT_METRICS`；`TrendSection.tsx` 的 `onChange` 在删到 0 个时直接返回；保存时按规格顺序 | 一致 |
| 每个指标叠加一条虚线的"上周同期" | `trendChart.ts` 每个指标一条实线加一条同色 `lineDash` 的线，名字"（上周同期）"；`lastWeek` 取 `shiftDay(statDate,-7)` | 一致 |
| 单位（任务书要求的轴上单位） | 轴标题写"账号数 / 分钟 / %"，几个单位用 " / " 连接；百分比用右轴 | 一致 |
| 平台分布：环形图，当日 `ANDROID` 与 `IOS` 的 `dau`，另调两次，只取当天 | `loadPlatformDau`：`from=to=今天（UTC）`，`platform=ANDROID/IOS`；环旁写数值和占比；都没有数字或都为 0 时写说明，不画空环 | 一致 |
| 看板共 4 次调用：日报 `ALL` 一次、留存一次、平台两次 | `STATS:VIEW` 下恰好 4 个请求（`/stats/daily?platform=ALL` 90 天、`/stats/retention?type=ACTIVE&platform=ALL` 90 天、两个平台）；另加 `/moderation/stats`、`/alerts` 各 1 个；没有权限的不发；改范围或指标不请求（趋势图不含任何请求钩子） | 一致 |
| 快捷入口：日报、留存、游客统计、通话质量、订阅统计；按钮按目标页面的权限显示 | `QuickLinks.tsx:10-16` 五个入口，权限码取规格 5.0（日报、留存、游客、通话质量 `STATS:VIEW`；订阅统计 `FINANCE:VIEW`）；无任何入口时整块不渲染 | 一致，但通话质量的目标页现在不存在，见记录 R1 |
| 数据：各取最近 90 天，一次并行请求；比较在浏览器里算 | 五张日卡和趋势图共用一次日报请求，D1 和趋势图共用一次留存请求；比较在浏览器里算 | 一致 |
| 卡片旁标注"今日数据每隔 `stats.land_interval_minutes` 分钟刷新一次"，页面不写死数字 | `validMinutes`（`overview.tsx:48-49`）：有限数字且大于 0 才写数字（数字取 `useAdminMeta().landIntervalMinutes`），否则只写"今日数据是临时值"；语言文件没有数字；`useAdminMeta()` 在没有 meta 时返回 `{}`，不会读到 null | 一致（位置见不是缺陷 N2） |
| 不搬渠道饼图、邀请排行、分享卡点 | 没有 | 一致 |

其他要求的核对：
- 每张卡自己的失败和重试：`useSource` 每个请求一个状态，`OverviewCard` 失败时只显示自己的错误和"重试"（按错误码取译文，不显示后端原话）；日报失败时五张日卡和趋势图各自显示失败，D1、审核、告警、环形图照常。
- 旧答案不覆盖新答案、卸载后的答案被丢弃：`useSource.ts` 用递增序号，我把这个判断去掉后 `useSource.test.tsx` 变红。
- 计数不为负、null 和 0 分开：`cleanFigure` 统一处理；值为 0 显示 0，不存在显示"—"；环形图排除 0 和 null。
- UTC：全部日期来自 `todayUtc`、`lastNDaysUtc`、`shiftDay`（`setUTCFullYear` 和 `toISOString`）、`daysBetween`；唯一用到本地时间的是日期选择器的 `dayjs(...)` 和 `pickedDay`，二者成对使用（按选中的日历日读年月日），不发生时区换算。我把审核请求和环形图请求改成本地日，各有测试变红。
- 语言文件：zh-CN 和 en-US 的 `dashboard.*` 键相同、占位符相同；任务 17 的键（`menu.stats.*`、`stat.daily.*`、`stat.retention.*`、`stat.reactivation.*`）一个没少——`git show ca6d62d -- src/locales` 里被删除的行只有两行重复的文件头注释。`.tsx` 里没有写死的文字（只有 `{' '}` 空格）；没有第三方产品名、没有韩文、没有调试日志。
- 跨目录导入：`overview.tsx:5` 的 `formatDuration`，见 R2。

## 二、变异检查（我自己做的 32 个，来自实现者声称的 41 个及补充）

做法：在副本里改一处，跑 `npx vitest run src/pages/dashboard config/routes/dashboard.test.ts`，还原。脚本在 scratchpad 的 `t21r-mutate.mjs`，变异清单是同目录的 `t21r-muts1.json`、`t21r-muts2.json`。

被抓住（30 个）：未处理告警卡不看权限；审核卡权限判断反过来；环形图请求不看 `STATS:VIEW`；订阅统计入口要 `STATS:VIEW`；游客入口要 `FINANCE:VIEW`；前一天为 0 也算；D1 用相对变化不用百分点；最新 cohort 取最旧；`d1` 为 0 当没有值；日卡的"临时值"去掉；D1 的临时值规则反过来；刷新说明接受 0；较 7 天前取 6 天；告警请求 `pageSize` 改 20；留存请求去掉 `type`；通话分钟不除 60；过去没有行的日子不补 0；旧答案覆盖新答案；环形图 0 不过滤；环形图请求用本地日；审核请求用本地日；趋势图指标可删到 0 个；趋势图"上周同期"取 6 天前；日报窗口 60 天；涨跌颜色不区分；说明行在没有 `STATS:VIEW` 时也显示；空页面判断忽略快捷入口；留存行的 `retentionType` 过滤去掉；D1 的 `cohortSize` 为 0 不留空档；自定义范围不限制已读天数。

活下来（2 个，见记录 R4、R5）：D1 提示框的数值格式函数改成直接输出；`loadOpenAlertCount` 去掉 `cleanFigure`（负数的 `total` 不再变成"—"）。

结论：实现者声称的变异检查属实，我没有发现与之不符的地方。

## 三、你特别问的几点

1. "当前值 = 今天（未过完）"这个选择是否最安全：规格 5.1 的句子是"6 张 `StatCard`，每张有当前值、较昨日、较 7 天前"和"当天的值是临时值，卡片旁标注……"，也就是说规格自己就把卡片的值定为"当天的值"并要求标注临时，页面按字面做，是唯一不改变规格行为的读法；另一种读法（最近一个完整日）会改变数字的含义，是变更，不是缺陷。所以这个选择不是缺陷（N1）。但"临时值"标记只贴在数字旁，较昨日和较 7 天前两行没有任何标记，而且涨绿跌红照常上色：UTC 零点后的头几个小时，今天只有一小部分，较昨日几乎每张卡都是很大的红色负数，没有任何提示说明这是未过完的一天和整天的比较。标记对数字够用，对两个变化值不够。这个怎么处理要负责人选，归为变更 C1。
2. 通话质量快捷入口：只受权限（`STATS:VIEW`）约束，没有路由存在检查；`config/routes/sessions.ts` 现在是空的（任务 19 的页面还没有合入），所以现在持有 `STATS:VIEW` 的管理员点它会到 404。不是"保护到不会显示死链接"。见 R1。
3. 刷新说明的数字：取 `useAdminMeta().landIntervalMinutes`，大于 0 的有限数字才写；null、0、负数、非数字、缺项都只写"今日数据是临时值"。测试用 15 和 7 都写对，我把判断放宽到 0 后变红，把数字写死则实现者已验证被抓住。

## 四、发现

### 立即修（0）

没有。

### 记录（6）

R1. 通话质量快捷入口指向现在不存在的路由，也没有路由存在检查。
- 位置：`src/pages/dashboard/QuickLinks.tsx:15`；对应的测试 `config/routes/dashboard.test.ts:49-53`。
- 触发：用任何持有 `STATS:VIEW` 的账号（或 `root`）在任务 19 合入前打开 `/dashboard`，点"通话质量"。
- 错误结果：进入 404 页面（`config/routes/sessions.ts` 是空数组）。
- 另外：路由测试只核对"已经在路由表里的目标"（`found` 是按存在过滤的），如果任务 19 最终把路径改成别的名字，这个测试不会变红，入口会一直指向 404。入口本身是规格 5.1 要求的，不应去掉；建议任务 19 合入后把这条测试改成"五个目标都必须在路由表里"。

R2. 总览从别的模块的页面目录导入函数。
- 位置：`src/pages/dashboard/overview.tsx:5`（`../moderation/duration`）。`src/utils/` 里没有 `formatDuration`；它写出的文字用 `moderation.duration.*` 键，总览的显示也依赖审核模块的语言键。
- 触发：审核模块移动或改名 `duration.ts`，或删掉 `moderation.duration.*` 键。
- 错误结果：总览编译失败，或审核积压卡显示键名。
- 同意实现者的记录：应当放进 `src/utils/`（共享文件，本任务不能动）。

R3. 趋势图只要用到的一个请求失败，整张图都不画。
- 位置：`src/pages/dashboard/TrendSection.tsx:49-52`（`needed`、`failed`）和 `:143-153`。
- 触发：让 `/stats/retention` 失败，把 D1 留存加进指标（默认的日活和新增账号已经读到）。
- 错误结果：整张图换成失败提示，已经读到的日活和新增账号也不画。
- 同意实现者的记录。

R4. D1 提示框数值格式函数没有测试。
- 位置：`src/pages/dashboard/trendChart.ts:88`。
- 触发：我把 `` `${Math.round(v * 10) / 10}%` `` 改成 `` `${v}` ``，115 个测试全部通过（变异活下来）。
- 错误结果（如果坏了）：悬停 D1 的点时提示框写 `30.123456`，没有"%"，一位小数的约束失效。测试用的假图表不调用这个函数。同意实现者的记录。

R5. 未处理告警数里的负数没有测试。
- 位置：`src/pages/dashboard/dashboardSources.ts:55`（`cleanFigure(answer.total)`）。
- 触发：我把它改成 `typeof answer.total === 'number' ? answer.total : null`，全部测试通过（变异活下来）；现有测试只测了"不是数字"。
- 错误结果（如果坏了）：后端给 `-3` 时卡片写 `-3`，违反"计数不为负"。当前实现是对的，是测试缺口。

R6. 统计跨度配置小于 90 天时，总览的统计类内容全部失败。
- 位置：`src/pages/dashboard/dashboardSources.ts:9, 18, 25`（固定 90 天）。契约 §17.6：`from`、`to` 的跨度不超过 `stats.max_range_days`（默认 366），`useAdminMeta().statsMaxRangeDays` 可读（日报、留存页已经用它）。
- 触发：运营把 `stats.max_range_days` 改成 31，打开 `/dashboard`。
- 错误结果：日报和留存两个请求返回 400 `INVALID_REQUEST`，五张日卡、D1 卡和趋势图全部显示失败，重试也不会好。规格写的是 90 天，所以默认配置下没有问题；这是对配置变化的健壮性，修法是取 `min(90, statsMaxRangeDays)`（只在有值时）并让自定义范围和比较按实际读到的天数降级。

### 变更（1）

C1. 较昨日、较 7 天前拿一个没过完的日子和完整日比，却照常涨绿跌红，只在数字旁标"临时值"。
- 位置：`src/pages/dashboard/overview.tsx:99-100`（`temporary` 只传给数字旁的标记，`changes` 照常上色）、`src/pages/dashboard/OverviewCard.tsx` 的 `Change`。
- 后果：UTC 零点后的头几个小时，今天只有一小部分，几乎每张卡的较昨日是很大的红色负数；运营可能读成"今天大跌"。
- 为什么是变更不是缺陷：规格没有写变化值怎么处理，页面按字面做；任何改法都会新增或改变行为。需要负责人先定：(a) 在变化值旁也标"临时值"并去掉颜色；(b) 说明行里加一句"较昨日、较 7 天前拿的是未过完的今天"；(c) 改成最近一个完整日（改变数字含义，要改规格）。D1 卡同理（它的当前值是今天才数出来的）。

### 不是缺陷（5）

N1. "当前值 = 今天"。理由见上面第三节第 1 点：规格 5.1 第 3 个要点写"当前值"，第 9 个要点写"当天的值是临时值，卡片旁标注"，页面按字面做并标了临时值（`overview.tsx:99, 123`）。与 C1 是两回事：这里判定的是"取值日"，C1 是"变化值的呈现"。
N2. 刷新说明是页面上方的一行，而不是每张卡旁边各一句。规格写"卡片旁标注"，页面做法是每张日卡数字旁有"临时值"标记，说明行（`overview.tsx:128-135`，`data-testid="dashboard-explain"`）在统计卡上方统一说明刷新间隔；每张卡重复同一句话没有增加信息。规格没有要求每张卡一句。
N3. 页面用本地的 `OverviewCard`，没有用共享的 `StatCard`。`src/components/stat/StatCard.tsx:7-13` 只有一个 `previous` 和一个 `previousLabel`，做不到规格要求的"较昨日、较 7 天前"两个对比和临时值标记；共享文件不归本任务改，实现者已在报告里写明并给出规则一致的本地版本。
N4. D1 的 cohort 人数为 0（那天没有新账号）而 `d1` 为 0 时，卡片显示"—"，同时仍写队列日。`cardChange.ts:90` 按规格取"最新一个 `d1` 非空的 cohort"，`:98-101` 对分母 0 给 null（`d1/0` 无意义）；回退到更早的 cohort 会背离规格那句话。
N5. 趋势图里"人数"和"分钟"共用左轴（`trendChart.ts:37-38, 102`）。规格只要求轴上写单位；页面把两个单位写在同一个轴标题上（"账号数 / 分钟"），百分比单独右轴。量级相差大时曲线会偏平，但这是设计取舍，规格没有规定轴的分法，且实现者在报告里写明。

### 阻塞（0）

没有。

## 五、需要负责人决定的

- C1（变化值的呈现）。
- R1 到 R6 建议全部修；其中 R2 要改共享文件（`src/utils/`），R1 的测试改动要等任务 19 合入。
- 问题文件 `docs/contract-requests/2026-10-26-admin-frontend-dashboard.md` 的四个问题我读过，与代码里的暂定做法一一对应，不算阻塞。

## 六、没有做的

- 没有启动开发服务器，也没有开真实浏览器；实现者报告里的真实浏览器检查我没有重做，只重跑了测试。
- 没有跑全量测试和构建（按规则最后一起跑）。
- 语言覆盖：本页只显示数字、日期、固定名称和错误码对应的译文，没有用户输入或后端自由文字，所以泰语、阿拉伯语、印尼语、越南语、西班牙语的假数据不进入这个页面；对本页的检查只覆盖中文和英文界面。

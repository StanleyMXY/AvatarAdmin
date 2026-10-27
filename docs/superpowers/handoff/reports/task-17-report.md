立即修未修 0、记录项 8、未运行 4、阻塞 0。

# 任务 17 报告：日报与留存报表

环境：Node 24.22.1。本任务的测试共 70 个（列定义 21、日报页面 21、留存页面 22、路由 6），全部通过；`biome`、`tsc`（只看本任务路径）无报错。本任务做的是新页面，规则里属于"页面、报表：一次独立评审"，评审由负责人另派（我只做了实现、变异检查和真实浏览器检查，没有给自己做评审）。

## 改了哪些文件

- `src/pages/stat/dailyColumns.ts`：`buildDailyColumns(platform)`（23 列的定义，平台不是 `ALL` 时业务类列标记为无平台维度）、`toViewRow`（秒转分钟、人均通话分钟）、`formatDailyCell`、`isBackfilledCell`。
- `src/pages/stat/daily.tsx`：日报页面（趋势图和数据明细两个页签）。
- `src/pages/stat/retention.tsx`：留存页面（活跃留存、通话留存、回流留存三个页签）。
- `src/pages/stat/CheckDayLandBar.tsx`：留存页签专用的落地条（日期标签"检查日"加说明）。
- `src/pages/stat/ReactivationCharts.tsx`：回流的折线（回流率）和柱状（回流用户数）。
- 测试：`dailyColumns.test.ts`、`daily.test.tsx`、`retention.test.tsx`、`config/routes/dailyRetention.test.ts`。
- `config/routes/stats.ts`：统计菜单下的 `/stat/daily`、`/stat/retention`，权限 `STATS:VIEW`（这个文件现在只有我的两条；游客统计加入时往同一个菜单数组里加）。
- `src/locales/{zh-CN,en-US}/dashboard.ts`：菜单名和本任务全部文字（见下面"需要改共享文件"第 2 条，原因在那里）。
- `docs/contract-requests/2026-10-26-admin-frontend-daily-retention.md`：三个契约问题。
- 没有改假后端：任务 9 的 `mock/stats.mock.ts` 已能满足本任务（日报、留存、回流、补数、导出都有）。

## 红到绿

先写测试再写实现。红（实现不存在时）：

```
npx vitest run src/pages/stat config/routes/dailyRetention.test.ts
 FAIL  src/pages/stat/daily.test.tsx            Error: Failed to resolve import "./daily" ... Does the file exist?
 FAIL  src/pages/stat/dailyColumns.test.ts      Error: Failed to resolve import "./dailyColumns" ...
 FAIL  src/pages/stat/retention.test.tsx        Error: Failed to resolve import "./retention" ...
 FAIL  config/routes/dailyRetention.test.ts     expected [] to deeply equal [ …(2) ]（路由不存在，4 个用例）
```

绿：同一条命令，`Test Files 4 passed, Tests 70 passed`。写页面过程中测试还红过两次，都是页面本身的问题或测试写法：留存页切到回流页签后"如何阅读此报表"面板不出现（见记录项 1，已在页面里用 `key` 绕开，有测试守着）；导出按钮在导出进行中名字是"loading Export"，测试改为等待。

相关的既有测试一并跑过：`src/locales`、`src/components/stat`、`mock/stats.mock.test.ts`、`tests/noHardcodedText.test.ts`：576 通过，1 个失败，失败的是"没有隐藏字符"一项，指向别的会话正在写的 `mock/avatar.mock.test.ts:196`，不是本任务的文件（本任务的文件在这一项里没有任何报告）。

## 对照任务书逐条

- 日报两个页签、指标多选默认日活加新增账号、表格不分页、日期列固定在左：有测试。
- 平台不是 `ALL`：15 个业务类列所有单元格显示"—"（后端即使多发了数字也不显示），表格上方的提示"这些指标没有平台维度……"；`ALL` 时没有这条提示、数字正常。趋势图的指标下拉里这些指标变成禁用并带"无平台维度"后缀，已选的不画。
- 人均通话分钟按 `callSecondsTotal / 60 / accountsWithCall`，分母 0 或缺值显示"—"，真的 0 显示 0；`activeSubscriptions` 为 `null` 显示"—"；`activeSubscriptionsBackfilled` 为真且有值时带"回填"标记；七个提示图标正好是日活、周活、月活、匿名设备日活、新增游客设备、通话次数、有效订阅。
- 趋势图缺失日期补 0（用任务 9 的 `TrendChart`）；页面没有合计行、合计卡片（测试检查没有 `.ant-table-summary`、没有 Statistic、没有 Card）。
- 留存：三个页签；D1…D90 九个选项多选，默认 D1、D7、D30（图是每个所选天一张图，矩阵是对应的列）；回流沉默天数 7/14/30 默认 7；未到期格"—"、真的 0 显示 0%；提示面板可关闭，关闭状态各页签各记各的。
- 落地条：日报同时调 `daily-event` 和 `daily-business`；留存的活跃和通话页签调 `retention`，日期标签"检查日（UTC）"并写"会回填该日对应的各个 N 的格子，不是整行重算"；回流页签调 `reactivation`，标签是普通的"日期（UTC）"（回流的日期就是统计日，那句说明对它不成立）。没有 `STATS:LAND` 不渲染。
- 导出：日报 `daily`；留存两个页签 `retention`（带 `type`）；回流 `reactivation`（带 `silenceDays`，没有平台和渠道）。参数是"点过查询之后的筛选"，不是正在编辑还没查询的筛选（有测试）。
- 页面顶部"统计日按 UTC 计算"；渠道下拉取自 `getChannels`；日期默认范围按 UTC 算（Pacific/Auckland 时区下测过）；错误只显示错误码对应的译文，不显示后端的话（测试里后端的话是 `raw backend words`，断言页面里没有）。
- 筛选用"改了再点查询才发请求"的方式（日报、留存），规格 4.4 的"查询"按钮。

## 变异检查

约 30 个变异，除一个等价变异外全部被测试抓住。每个都是改源码、跑相关测试、还原：

被抓住：平台条件反过来；人均分钟不除 60；人均分钟分母 0 时按 1 除；回填标记条件放宽；空值显示 0；去掉"无平台维度显示破折号"；导出参数取编辑中的筛选；日报落地只调一个名字；日报导出名改错；趋势图下拉不禁用无平台指标；默认指标去掉新增账号；表格改成分页；去掉日期列固定；默认范围 7 天改 30 天；去掉回填标记；去掉平台提示；留存默认天数少一个；回流导出名用 `retention`；回流请求多带 `platform`；留存页换回共用落地条（标签变回"日期"）；沉默天数默认改 14；去掉 `ReportHelper` 的 `key`；通话页签的 `type` 固定成 `ACTIVE`；留存默认范围 30 天改 7 天；回流率零分母显示 0；回流图不补满日期；落地条去掉权限判断；落地条默认日改成今天（21 个用例全红）。

第一轮有 2 个活下来：回流图不补满日期（因此补了一个测试：范围 30 天只有 1 行时，两张图各 30 个点，缺的日子人数 0、回流率空档，表只有 1 行，补测后变异被抓住）；回流表里直接用除法代替 `safeRatio`（等价变异：`formatPercent` 对 `NaN`、`Infinity` 本来就显示"—"，不改变输出）。另有一个第一轮写错了匹配串没改到（"通话次数列改成事件类"），重做后被抓住。

## 真实浏览器检查（Chromium，端口 8317，`root` 登录）

两个页面都打开、点过主要操作：

- 控制台：只有构建工具关于 `async/await` 的警告（不是本任务代码），和登录第一步验证码未填时的一次 401（预期的）。没有页面错误。
- 日报：趋势图（暗色主题）画出日活和新增账号两条线；明细表 7 行 23 列，数字带千分位，人均通话分钟 3.4；改成 Android 后点查询，业务类单元格全是"—"，提示条出现；有效订阅一列 7 天里 3 个"回填"标记、今天是"—"；悬停提示图标出现定义文字；渠道下拉是 全部、play · Android store、direct · Direct download、appstore · iOS store；导出下载到 `daily-2026-10-20-2026-10-26.xlsx`（请求参数是查询后的 ANDROID）；落地条依次 POST `daily-event` 和 `daily-business`（日期 2026-10-25，即 UTC 昨天），然后重新读报表。390 像素宽的手机尺寸页面没有横向溢出。
- 留存：活跃页签 D1、D7、D30 三张图和矩阵，最新两天的 D1 是"—"，D30 全是"—"（范围内还没有到期的 cohort），所以 D30 那张图是空的，是对的；"检查日（UTC）"和说明文字可见；通话页签请求 `type=CALL`；回流页签有折线（纵轴百分比）、柱状、表，切 30 天重新请求；关闭"如何阅读此报表"后刷新仍关闭，回流页签的面板独立。
- 服务按监听进程 PID（7869）停掉，端口已释放，没有用 `pkill -f`。

覆盖的语言：界面 zh-CN 和 en-US 两种（测试用 en-US；`src/locales` 一致性测试检查两种语言键和占位符相同、en-US 没有中文字符）。假数据是数字，没有文字，所以泰语、阿拉伯语、印尼语、越南语、西班牙语这类文字没有进入本任务的页面：本任务的页面不显示用户输入的文字（渠道名取自渠道列表，假后端里的渠道名是英文）。这一项只覆盖英文和中文界面。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-daily-retention.md`：（一）补数 `retention`、`reactivation` 各覆盖哪些类型和沉默天数；（二）留存和回流"某天没有汇总行"怎么返回；（三）没有快照的日子 `activeSubscriptionsBackfilled` 是 `null` 还是 `false`。三条都有暂定做法，不阻塞。

## 需要改共享文件

1. 任务 9 的 `LandBar` 增加可选的日期标签和说明属性，`RetentionMatrix` 增加可选的表头标签属性（任务 9 记录项 3 已提）；现在留存页用本任务的 `CheckDayLandBar`（`src/pages/stat/CheckDayLandBar.tsx`）做本地版本，其余规则和共用的一样。共用组件改好后可以删掉本地版本。
2. 语言文件：统计菜单对应的文件是任务 9 的 `stats.ts`（你说不能改），而 `src/locales/zh-CN.ts` 的聚合和 `parity.test.ts` 的文件清单都是固定的，新增文件需要改共享文件。所以我把菜单名和本任务的文字放进了空的 `dashboard.ts`（键是 `menu.stats.*`、`stat.daily.*`、`stat.retention.*`、`stat.reactivation.*`，和 `dashboard.*` 不冲突）。总览任务（21）写这个文件时要保留这些键（它如果整个重写文件会丢掉它们，`parity.test.ts` 和 `config/routes/dailyRetention.test.ts` 会红）；游客统计任务（18）同样需要这个问题的答案，建议负责人在地基层加一个统计报表的语言文件。
3. 共用的 `ReportHelper` 在 `pageKey` 变化时不重新读关闭状态（见记录项 1），本任务在页面里用 `key` 绕开。

## 规格需要在 main 上修改的地方

无。（规格 5.3 写回流留存的"折线（回流率）、柱状（回流用户数）、表"，我按它做了。）

## 记录项（建议全部修）

1. `src/components/stat/ReportHelper.tsx:24`：`useState(() => wasClosed(pageKey))` 只在第一次挂载读关闭状态。触发：在同一个组件实例上把 `pageKey` 从 `retention` 换成 `reactivation`（留存页切到回流页签），而前者已被关闭，则后者也不显示。结果：回流页签的说明面板看不到。本任务已用 `key` 绕开，有测试（`retention.test.tsx` 的面板用例，去掉 `key` 后变红）；共用组件应改为按 `pageKey` 重读。
2. `src/components/stat/RetentionTrendChart.tsx`：纵轴是 0 到 1 的小数（浏览器里看到 0.5），提示框也没有百分号，同一页的矩阵显示百分比。任务 9 记录项 1，仍未修。
3. `src/components/stat/RetentionMatrix.tsx`：规格 5.3 要"各 Dn 的人数和百分比，绿色热力底色"，现在只有百分比、没有底色。任务 9 记录项 2，仍未修；留存页因此也只有百分比。
4. `src/components/stat/RetentionTrendChart.tsx`：一次只画一个 N，所以多选的 D1、D7、D30 在页面里是三张图，不是一张图三条线。规格写的是一张图多选；要一张图需要这个组件接受多个 N。
5. `src/pages/stat/daily.tsx`：详情表按后端给的顺序（旧的在前），不补缺失的日子（图补、表不补，任务书只要求图补）；当天是临时值，没有任何标识。触发：看当天的行，数字之后还会变。后端契约没有标志，只能在文字里写，目前没写。
6. `src/pages/stat/daily.tsx` 趋势图：不同量纲的指标（人数、分钟、额度消耗）画在同一个纵轴上，额度消耗（几万）会把日活压成近乎直线。触发：同时选额度消耗和日活。需要决定是否加双纵轴（属于变更，不是本任务的遗留）。
7. `src/pages/stat/daily.test.tsx`：趋势图 y 轴、图例和主题没有测试（只测了传给图的数据）；浏览器里看过暗色主题，亮色没有看。
8. `src/pages/stat/retention.test.tsx` 的"面板可关闭"用例最后一步（关闭回流面板后回到活跃页签仍是关闭）验证不了"互不影响"，因为活跃面板在前面已经关掉了，见同一用例的最后几行。

## 未运行（4）

- 全量测试和构建（按规则最后一起跑）。
- Firefox、Safari；亮色主题和 Deep 主题下的截图没看（只看了默认的 Dim 暗色）。
- 手机宽度下图表的触摸交互（只看了 390 像素宽没有横向溢出）。
- 真正的 Microsoft Excel 打开导出样例（任务 9 已记录，本任务没有改导出）。

## 变更候选

- 留存矩阵加人数和热力底色、留存趋势图多条线合一（记录项 2、3、4 的共用组件改动）。
- 趋势图双纵轴（记录项 6）。

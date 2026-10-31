立即修未修 0、记录项 3、未运行 3、阻塞 0

# 当天临时值（决定事项 4）：总览、日报、通话质量三处统一

分支 `claude/jolly-dirac-4pq9g6`。决定来源：`docs/superpowers/handoff/decisions-2026-10-27.md` 事项 4。

## 一、"完整日"怎么判断（写在代码里，也写在这里）

- **完整日 = 这一天的 UTC 日期早于今天的 UTC 日期。** 今天不是完整日；今天之后的日子既不是完整日，也不算"临时值"（还没开始，没有值）。
- "今天"取 `todayUtc()`（`src/utils/utcDay.ts`：`now.toISOString().slice(0, 10)`），日期是 `YYYY-MM-DD` 的 UTC 日历日，不读浏览器时区，和现有日期工具一致。总览用它读数据时的 `window.to`（同一个值）。
- 依据：后端每隔 `stats.land_interval_minutes` 分钟重算当天（UTC），当天过完才固定（契约 17.6，`docs/shared-snapshots/backend-task-java-backend.md` 第 2700 行一带）。
- 有"滞后"的数：次日留存 D1 是在队列日的下一天才数出来的，所以 D1 的"完整"要再晚一天：`day + 1 < today`（参数 `lagDays`）。总览里 D1 卡片用 `lagDays = 1`。
- 共用工具：`src/utils/settledDay.ts`（`isSettledDay`、`isProvisionalDay`、`changeIsFinal`、`hasProvisionalDay`），三处页面和图都从这里取判断，没有各写一套。

## 二、做了什么

**共用的小工具和组件（新文件）**
- `src/utils/settledDay.ts`：上面的判断。
- `src/components/stat/ProvisionalTag.tsx`：统一的"临时值"标记（带悬停说明），总览卡片、平台环图、日报、通话质量都用它。
- `src/components/stat/provisionalChart.ts`：图上的空心点怎么画（`provisionalPoints`、`hollowPointsMark`）和柱子的虚线边框样式（`provisionalColumnStyle`）。

**总览**（`src/pages/dashboard/`）
- 卡片的"较昨日、较 7 天前"：两边都是完整日才用红绿；含今天（或还在统计的 D1）时数字照常写出，但用中性灰色，并带悬停说明（`data-tone="provisional"`）。这样日常的五张卡片（今天）一律是灰色；D1 卡片最新那天的次日留存已经算完时仍是红绿。（`cardChange.ts` 的 `changeFinality`、`changeText.ts` 的 `describeChange` 多一个 `final` 参数、`OverviewCard.tsx`、`overview.tsx`）
- 趋势图：今天（D1 为队列日的昨天）的点画成空心点，线不断；上周的虚线不画空心点。（`trendChart.ts`、`TrendSection.tsx`）
- "临时值"标记换成共用组件，平台环图同样；语言键 `dashboard.temp` 删除，改用 `stat.common.provisional`。

**日报**（`src/pages/stat/daily.tsx`、`src/components/stat/TrendChart.tsx`）
- 明细表里今天那一行的日期后面带"临时值"。
- 趋势图今天的点画成空心点，图下写一行说明。`TrendChart` 新增可选参数 `today`，只有日报传了它，其他页面的图不变。

**通话质量**（`src/pages/sessions/quality.tsx`、`charts.tsx`）
- 范围里有今天那一行时，六张卡片各带"临时值"；明细表今天那一行带"临时值"。
- 成功率折线今天的点是空心点；按天堆叠的柱子今天那根颜色变浅并带虚线边框；图下写一行说明。`DayLineChart`、`StackedDayChart` 新增可选参数 `today`，通话分析页没传，所以不变。

**语言文件**：`src/locales/{zh-CN,en-US}/stats.ts` 新增 5 个键（`stat.common.provisional`、`.tip`、`.changeTip`、`.chartNote`、`.columnNote`）；两边键相同。

**对"涨跌只在两边完整日才算"的理解**：这里的"算"指"判断好坏（红绿）"。今天是临时值时，数字仍写出来（总览卡片只有"今天对比前一天"这一种比较，不写就没有信息），用灰色并有说明。如果负责人的意思是"含今天时连数字也不写，显示破折号"，改动是 `changeText.ts` 里一行，请告诉我。

## 三、测试（文件和位置）

先写测试，确认红（因为功能不存在），再实现，再变绿。

| 文件 | 内容 |
|---|---|
| `src/utils/settledDay.test.ts` | 完整日判断：昨天及更早为完整、今天不是、未来不是；月末年末闰日；`lagDays`；非法日期不抛错；用 UTC 日期而不是本地日期（第 7–100 行） |
| `src/pages/dashboard/cardChange.test.ts` | `changeFinality`（第 298 行起） |
| `src/pages/dashboard/changeText.test.ts` | 含临时日时 tone 为 `provisional`，仍写破折号（第 57 行起） |
| `src/pages/dashboard/overview.test.tsx` | 完整日的涨跌红绿（第 359 行起）；今天的涨跌是灰色且数字照写（第 389 行）；还在统计的 D1 为灰色、中文说明（第 407 行）；无法比较时不带说明（第 424 行）；趋势图今天空心点、D1 晚一天、今天没数字时没有空心点（第 756 行起）；单日范围不再画实心点 |
| `src/pages/dashboard/trendChart.test.ts`（新） | 空心点与实线同一批数据（共用比例尺）、半径函数（今天 5，其余 0）、D1 滞后、左右轴各自的标记、单日不画实心、上周虚线不画空心 |
| `src/pages/stat/daily.test.tsx` | 今天空心点、说明、没有行时的空心 0（规格 4.4 要求缺日补 0）、明细表今天标记、中文、没有今天行不标（第 254 行起） |
| `src/pages/sessions/quality.test.tsx` | 六张卡标记、全是旧日不标、表格今天行、折线空心点、柱子标记与样式、说明、中文（第 442 行起） |
| `src/components/stat/provisionalChart.test.ts`、`ProvisionalTag.test.tsx` | 画法和标记的单元测试 |

**红（实现之前）**
命令：`npx vitest run src/pages/dashboard src/pages/stat/daily.test.tsx src/pages/sessions/quality.test.tsx src/utils/settledDay.test.ts src/components/stat/provisionalChart.test.ts src/components/stat/ProvisionalTag.test.tsx`
结果：`Test Files 8 failed | 2 passed (10)`，`Tests 23 failed | 169 passed (192)`。失败原因是 `changeFinality is not a function`、找不到 `settledDay`、`provisionalChart`、`ProvisionalTag` 三个模块、找不到 `provisional-row`、`provisional-chart-note`、拿到的 tone 是 `rise` 而不是 `provisional` 等，都是功能不存在，不是拼写或配置错。

**绿（实现之后）**
- `npx vitest run src/components/stat src/pages/sessions src/pages/stat src/pages/dashboard src/utils src/locales tests/noHardcodedText.test.ts`：`Test Files 1 failed | 41 passed (42)`，`Tests 1 failed | 1075 passed | 1 expected fail`。那 1 个失败在 `tests/noHardcodedText.test.ts` 的"没有公共 CDN 地址"，指向 `src/request/apiClient.test.ts:483`，不是我的文件（别的会话正在改请求层）；我跑的第一轮同一个测试是绿的。语言文件一致性（parity）和"禁止写死文字"里和我有关的部分没有报错。
- 提交前钩子（lint-staged、暂存文件类型检查）见"提交"一节。
- `npx biome check`：我的所有路径无报错（用 `--write` 整理过格式）。`npx tsc --noEmit`：我的路径下无报错。

**变异检查**（改一处判断，看测试是否变红，之后恢复）

| 变异 | 结果 |
|---|---|
| 完整日判断 `<` 改成 `<=`（今天算完整） | 11 个测试变红 |
| 涨跌不管是否完整一律判红绿 | 3 个变红 |
| D1 的滞后天数 1 改成 0 | 2 个变红 |
| 日报今天行不标记 | 3 个变红 |
| 空心点筛选反过来（画完整日不画今天） | 6 个变红 |
| 通话质量卡片去掉标记 | 2 个变红 |
| 空心点半径对所有天都是 5（不分今天） | 第一次变异检查时 **没有** 变红（模拟的图组件把函数丢掉了），所以补了 `trendChart.test.ts` 直接测函数；补完再做，变红 |
| 单日范围实心点不排除临时值 / D1 滞后改 0（再次对 `trendChart.test.ts`） | 各变红 1 个、2 个 |

## 四、真实浏览器检查

起假后端（端口 8733，用完已按进程号停掉），用 Playwright 登录 `root`，打开总览、日报（趋势和明细）、通话质量，看截图和控制台。
- 总览：五张日常卡片的涨跌是灰色，D1 卡片的涨跌是绿色；趋势图今天的点是空心点，线连到今天；点击"今天"按钮时单日也是空心点；平台环图标记正常。
- 日报：趋势图今天的点是空心点，下面有说明；明细表今天那行有"临时值"。
- 通话质量：卡片有标记；折线今天是空心点；柱子今天那根浅色加虚线边框；表格今天那行有标记。
- 发现并改掉的两个问题（只在真实浏览器里才看得到）：① 总览图里空心点画在另一把比例尺上，位置对不上线（图库默认让每个子图用自己的比例尺）。改成给空心点用和实线同一批数据，比例尺自然一致。② 通话质量折线最开始用"按行取形状"的写法，图例里多出"circle / hollowCircle"两项，所有点形状也不对；改为在折线上叠一层只含今天的空心点标记。
- 控制台只有一条 401（未登录时的探测请求，以前就有）。
- 只看了英文、深色（Dim）主题；中文只在单元测试里覆盖，见"未运行"。

## 五、没做的和原因

- 通话质量卡片的红框（成功率低于下限、慢接通占比高于上限）仍按含今天的合计判断。红框是阈值提示，不是涨跌比较，决定里没有要求改；是否要在合计含临时值时也不亮红框，是行为变更，等负责人定。
- 通话分析页（`src/pages/sessions/analytics.tsx`）和其他用共用趋势图的页面没有接入（见记录项）。

## 六、发现的问题（按 CLAUDE.md 分类）

**记录项 3**
1. 通话分析页 `src/pages/sessions/analytics.tsx:141` 的折线含今天的数据，但没有空心点和"临时值"标记。触发：打开通话分析，范围含今天，今天的点和别的天一样是实心。决定里只点了三处，所以没接；接入只需传 `today={todayUtc()}`。建议修。
2. 其他用共用 `TrendChart` 的页面（`src/pages/activity/signinStats.tsx:131`、`taskStats.tsx:119`、`ads/report.tsx:215`、`campaign/stats.tsx:308`、`invite/InviteOverview.tsx:113`、`ShareChannelsTab.tsx:102`、`ShareFunnelTab.tsx:75`、`ShareOverview.tsx:56`、`push/stats.tsx:188`）今天的点同样是实心。触发：范围含今天。`TrendChart` 现在有可选参数 `today`，各页传入即可；注意 `taskStats`（任务统计）按规格第 421 行用的是"用户本地日"而不是 UTC 日，不能直接套用同一个今天；其余页面用的是哪种日，我没有逐个查。建议修。
3. 总览趋势图 `src/pages/dashboard/trendChart.ts`（实线和虚线两个子图，约第 80–100 行）：文件注释写"实线和虚线共用一把比例尺"，但图库对每个子图默认用独立的比例尺（`scale.y.independent` 默认 true，合并到每个子图）。我在浏览器里验证了"数据不同的同组子图确实各用各的比例尺"（空心点子集画错位置就是这个原因）；由此推断实线和虚线当前也可能各用各的，但我没有单独用实线和虚线复现。触发：选"日活"，上周最大值经取整后和本周的不同（例如本周最大 1,200、上周最大 1,500），虚线按另一把尺子画。我这次没有改它，因为改成共用比例尺会让坐标轴消失（试过，已撤回）。

**不是缺陷（供参考）**
- 日报里今天还没有行时，趋势图画成空心的 0：规格 4.4 规定趋势图缺日补 0（`docs/shared-snapshots/admin-frontend-design.md` 第 124 行），所以按规格；总览里今天没有行则是空白，两处不同是已有的差异。

**变更候选（等负责人定）**
- 合计含临时值时，通话质量卡片是否仍亮红框（见"没做的"）。

## 七、需要改共享文件

- `src/locales/{zh-CN,en-US}/stats.ts`、`dashboard.ts` 是共用语言文件，我加了 5 个键并删了 `dashboard.temp`（只有总览用过，已无引用）。只增删这些行，没碰别的。
- `src/components/stat/TrendChart.tsx` 是共用组件，只加了可选参数 `today`，不传时行为不变。

## 八、提交

见回复主会话的提交哈希。提交只含本区域的路径，不含别的会话的文件。

## 九、未运行 3

1. 全量测试和构建（按约定不跑）。
2. 浅色和 Deep 主题下、中文界面下的浏览器截图（中文只由单元测试覆盖：总览卡片说明、日报标记、通话质量标记）。
3. 低版本浏览器、手机宽度下的空心点和虚线边框显示。

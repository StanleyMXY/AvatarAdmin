立即修 2、记录 12、变更 2、不是缺陷 5、阻塞 0

# 任务 17（日报与留存报表）评审，提交 076fe3f

评审方式：先读 CLAUDE.md、执行约定、模块任务书、任务书正文、规格 4.4/5.2/5.3、契约 17.6 和后端回复；再逐行读 `src/pages/stat/{daily,dailyColumns,retention,CheckDayLandBar,ReactivationCharts}` 和它们用到的共用件（`RetentionMatrix`、`RetentionTrendChart`、`TrendChart`、`LandBar`、`ExportButton`、`ReportHelper`、`DateRangeUtc`、`utcDay`）；再在 `git archive` 出来的副本里（scratchpad 下的 copy，没有动共享检出）自己做变异检查，并写了一份临时探测测试。本任务的 4 个测试文件在主检出里 70 个全过（我自己跑的）。`tests/noHardcodedText.test.ts` 在主检出里唯一的失败指向别人未提交的 moderation 文件，不是本任务的文件。

这是"页面、报表"，按规则做一次独立评审；没有用到深度评审的内容（导出下载和请求层是共用件，本次只看页面怎么接它们）。

## 一、立即修（2）

### 1. 留存矩阵没有"各 Dn 的人数"，也没有"绿色热力底色"，规格 5.3 明写了这两样

- 规格 5.3：`RetentionMatrix（cohort 日期、基数人数、各 Dn 的人数和百分比，绿色热力底色，未到期显示"—"）`。
- 现状：`src/components/stat/RetentionMatrix.tsx` 每个 Dn 格只渲染 `formatPercent(...)` 一个百分比（该文件 render 里只有 `<Typography.Text>`），没有人数，没有任何底色。留存页（`src/pages/stat/retention.tsx:108` 的 `<RetentionMatrix rows={retention} days={chosenDays} />`）原样用它。
- 触发步骤：打开 `/stat/retention`，看活跃留存或通话留存的矩阵。
- 错误结果：运营看不到 D1 是 40 人还是 4 人（只有 40%），基数很小的 cohort 无法判断百分比可信度；没有热力底色就没法一眼扫出哪一天掉了。这是规格逐字要求而页面没做的东西，不是风格问题。
- 如果带着它上线：规格要求的两个特性缺失，验收时会被挑出。游客统计的留存页签（任务 18，规格 5.4 写"同账号留存"）用同一个共用件，会带着同样的缺口。
- 为什么是立即修：任务 17 的任务书写的是"消费任务 9 的全部统计组件"，规格 5.3 是需求来源；该条目在任务 9 报告记录项 2 和任务 17 报告记录项 3 里都被放进了"记录"，分类错了——那条的判据是"真实但不影响正确性"，而这里是规格明写的功能没有。任务 17 报告开头的"立即修未修 0"因此不成立。
- 修的位置：共用件 `src/components/stat/RetentionMatrix.tsx`（模块任务不能改，需要负责人授权给一个有权改共享文件的会话；也影响任务 18）。单元格要带人数（`d{n}` 本身）和百分比，底色按百分比深浅；测试要覆盖：有人数、0 人数与未到期（`null`）区分、基数为 0 不显示百分比、深浅随值变化。

### 2. 多选的 D1、D3…D90 在页面上是 N 张图，规格 5.3 写的是一个"留存趋势图"带多选

- 规格 5.3：`图表 RetentionTrendChart（D1、D3、D5、D7、D14、D21、D30、D60、D90 多选，默认 D1、D7、D30）加 RetentionMatrix`。图表是一个组件，多选是它的选择项。
- 现状：`src/components/stat/RetentionTrendChart.tsx` 的 props 是 `{ rows, day: number }`，一次只能画一个 N；`src/pages/stat/retention.tsx:101` 用 `chosenDays.map` 渲染 N 个图（默认 3 个，全选 9 个，每个 260 像素高，各自的纵轴量程不同）。任务 17 报告记录项 4 自己也写了"规格写的是一张图多选"。
- 触发步骤：打开留存页，默认就是 3 张图；全选是 9 张。
- 错误结果：不能在同一个坐标里比较 D1、D7、D30 的走势（这是多选这个选择项存在的原因）；页面高度随选择线性增长；图的纵轴不统一，D30 的图因为数值小而被放大到看起来和 D1 一样高。
- 说明我的判断依据：规格这句话可以有另一种读法（"每个所选 N 一张图"也算"多选"），但规格的写法是单数的"图表"，且任务 17 的实现者自己读成了一张图；我按字面读为偏离规格。若负责人认为按 N 分图可以接受，这条要由负责人改成"变更"并同时改规格措辞；在那之前我不降级。
- 修的位置：共用件 `RetentionTrendChart` 接收 `days: number[]`，用颜色字段区分系列（类似 `TrendChart` 的 `colorField`），页面一处调用。未到期的点要留空档不画 0（现有测试"draws no point for a cohort without a value for that day"要保留）。

## 二、对任务 17 报告里 8 个记录项的判断

| 报告项 | 我的分类 | 理由 |
|---|---|---|
| 1 `ReportHelper` 不随 `pageKey` 重读 | 记录 | 共用件缺陷；页面用 `key` 绕开，我把 `key` 拿掉做了变异，`retention.test.tsx` 的面板用例变红，所以现在的输出是对的。见记录 1 |
| 2 `RetentionTrendChart` 纵轴是小数、没有百分号 | 记录 | 数据对、显示口径和矩阵不一致。见记录 2 |
| 3 矩阵没有人数和热力底色 | **立即修** | 见上面第 1 条 |
| 4 多选是三张图不是一张图三条线 | **立即修** | 见上面第 2 条 |
| 5 明细表顺序、不补缺日、当天临时值无标识 | 拆开：当天临时值无标识是**变更**；表不补缺日是**不是缺陷**；对后端行顺序的假设见**记录 7** | 见各自条目 |
| 6 不同量纲共用一个纵轴 | **变更** | 规格 5.2、4.4 没有任何关于纵轴的要求；见变更 1 |
| 7 趋势图没有测纵轴/图例/主题 | 记录 | 见记录 8 |
| 8 面板"互不影响"用例最后一步验证不了 | 记录 | 我读了 `retention.test.tsx:422-448`：关闭回流面板后回到活跃页签断言"仍是关闭"，但活跃面板在用例前半段已经被关掉了，这一步通过与否都不依赖"回流面板的关闭有没有污染活跃面板"。属实 |

## 三、记录（12）

每条是真实但不影响页面当前输出正确性的缺陷。建议全部修。

1. `src/components/stat/ReportHelper.tsx:24`（共用件）：`useState(() => wasClosed(pageKey))` 只在第一次挂载读。触发：同一实例上 `pageKey` 从已关闭的 `retention` 换成 `reactivation`。结果：回流面板不出现。任务 17 用 `key` 绕开（`retention.tsx` 里 `ReportHelper` 的 `key`），页面输出对；共用件应按 `pageKey` 重读。
2. `src/components/stat/RetentionTrendChart.tsx`（共用件）：纵轴和提示框是 0 到 1 的小数，没有百分号，同页矩阵是百分比。触发：打开留存页看 D1 图，纵轴刻度 0.2、0.4。结果：同一个量两种写法。
3. 图表提示框的名字和数值没有本地化/格式化（我读 `@antv/g2` 的 `MaybeTooltip` 源码得出，**没有在浏览器里核实**）：`src/pages/stat/ReactivationCharts.tsx:52-79` 的两张图没有 `colorField`，提示项的名字取 `yField`，即英文字段名 `rate`、`reactivated`，回流率提示框的数值是未格式化的小数（轴上已经用 `formatPercent`）；`src/pages/stat/dailyColumns.ts:23` 的 `callMinutesPerAccount` 没有取整，日报趋势图里选"人均通话分钟"，提示框会显示 3.4166666666666665 这类长小数（表里是 3.4）。结果：提示框里出现没有走语言文件的英文字段名和长小数。修的时候先在浏览器里看一次再动手。
4. `src/pages/stat/daily.tsx:69`、`src/pages/stat/retention.tsx:79`：`load` 的依赖数组里有 `intl`。触发：数据已显示时切换界面语言。结果：整页重新请求并先清空成加载状态；输出正确，多一次请求。这是任务 12 评审记录 8 记过的同一个写法（该页用 `intlRef` 的写法见 `src/pages/moderation/stats.tsx`）。
5. `src/pages/stat/retention.tsx:34`（`initialFilter` 默认 30 天）、`:169`（`maxDays={meta.statsMaxRangeDays}`）：`DateRangeUtc` 只在选日期时校验跨度，默认范围不校验。触发：管理员把 `stats.max_range_days`（契约 17.5，默认 366，`CONFIG:MANAGE` 可改）设成小于 30，再打开留存页。结果：首次请求就是 400 `INVALID_REQUEST`，页面上是"加载失败"，要自己缩小日期才能恢复。日报默认 7 天，同理但只在设置小于 7 时出现。
6. `src/pages/stat/dailyColumns.ts:147`（`isBackfilledCell`）和语言键 `stat.daily.col.activeSubscriptions.tip`：契约 17.6"渠道维度"一行写了 `channel` 不是 `ALL` 时 `activeSubscriptions` 返回 `null`。触发：渠道包选某个渠道、平台 `ALL`、点查询。结果："有效订阅"整列都是"—"，提示文字只说"当天和没有快照的日子显示—"，没有说渠道的原因，运营会以为快照坏了。显示是对的，说明缺一句。
7. 对后端行顺序的假设：契约 17.6 的报表接口表没有写 `/stats/daily`、`/stats/retention`、`/stats/reactivation` 的行顺序，后端回复里也没有，任务 17 的问题文件也没有问。`daily.tsx` 的明细表（`dataSource={viewRows}`）、`RetentionMatrix`、`RetentionTrendChart`（`rows` 直接作为数据）、回流表（`retention.tsx` 的 `dataSource={reactivation}`）都按收到的顺序画；只有两处趋势图经 `fillMissingDays` 排成升序。触发：后端若按日期倒序返回——留存折线 X 轴从新到旧，明细表最新在最上。结果：显示顺序取决于未被承诺的后端行为。建议在问题文件里加一问，页面不预先排序（排序属于变更）。
8. `src/pages/stat/daily.test.tsx`：趋势图的纵轴、图例、主题模式只测了传给图的数据，没有测 `axis`/`theme`（桩会把配置序列化到 `data-config`，可以断言）。报表自己也承认亮色主题没看。
9. `src/pages/stat/retention.test.tsx:422-448`：见上表第 8 项。
10. `src/pages/stat/CheckDayLandBar.tsx` 没有自己的测试文件；页面测试也没有"连点落地按钮只发一次"和"落地失败后显示错误文字、不重新读取报表"。我把共用的 `src/hooks/useSingleFlight.ts` 里的 `if (running.current) return undefined;` 改成 `if (false)`（副本里），`daily.test.tsx` 和 `retention.test.tsx` 的 43 个用例仍全过，即：页面级没有任何测试守着"落地双击保护"。我另写了探测测试确认**现在的行为是对的**：三次连点只发 1 次 POST；落地返回 400 时显示按错误码翻译的文字、不显示后端原话、不重新读取报表；日报第二个名字（`daily-business`）失败时第一个已落地，报表仍重新读取并显示错误。所以这是测试缺口，不是行为缺陷。
11. `src/pages/stat/daily.tsx:208-209`：趋势图的 `from`/`to` 取 `applied.range`。变异：改成 `draft.range.from`（副本里），70 个用例全过。即没有测试断言"改了日期范围但没点查询，图的横轴不变"。现在的行为是对的（取已提交的范围）；如果被改错，图会用没查询的日期补 0，画出没请求过的日期的零值，是真正的错误输出，所以值得补测。
12. `src/pages/stat/daily.tsx:148`、`retention.tsx:169`：`maxDays={meta.statsMaxRangeDays ?? undefined}`。变异：改成 `maxDays={undefined}`（副本里），70 个用例全过。即页面接线没有测试（共用件 `DateRangeUtc` 自己有测试，但页面有没有把后端给的上限传进去没人管）。

## 四、变更（2）

1. 趋势图不同量纲的指标共用一个纵轴（`src/pages/stat/daily.tsx:204`，`TrendChart` 单轴）。触发：同时选"额度消耗"（几万）和"日活"（几百）。结果：日活被压成近乎一条直线。数据没错。规格 5.2、4.4 没有任何关于纵轴的要求，所以这不是规格偏离；加双纵轴、按量纲分图或归一化都是新行为，需要负责人定做法。
2. 日报当天的行是临时值（契约 17.6 "当天的行是临时值，次日起固定"），页面默认的 7 天范围包含今天（`daily.tsx:33`），表格和图都不标。规格 5.2 没有要求标识；加一个标识（表里的标记，或图里的虚线末段）是新行为，需要负责人确认。

## 五、不是缺陷（5）

1. 回流页签的落地条日期标签是"日期（UTC）"，不是"检查日"（`retention.tsx` 里回流用 `LandBar`，其余用 `CheckDayLandBar`）。规格 4.4 写"留存页的日期标签是检查日，提示会回填该日对应的各个 N 的格子"，任务书也写"日期标签在留存页是检查日"。但契约 17.6"补数"一行只对 `retention`、`guest-cohort`、`guest-retention` 写"填 `cohortDate = D − N` 的格子"，`StatReactivation` 的主键是 `statDate`、没有 N 格子，在回流页签上写"会回填各个 N 的格子"是错话。所以按契约对。（实现者的问题文件第一问也问了补数 `reactivation` 覆盖范围。）
2. 明细表不补缺失的日子，只有图补 0。规格 4.4 只写"趋势图缺失的日期补 0"；表里补一行"人数 0"会被读成"那天真的是 0"，和"没有这一天的数据"混淆。`daily.tsx:129-137`（表直接用 `viewRows`）。
3. 平台提示放在明细表上方（antd 表格的 `title`，`daily.tsx:125`、`:137`），不是每个业务列头各挂一个图标。规格 5.2 写"在表头旁说明'这些指标没有平台维度'"，提示条紧贴表头正上方，文字就是规格给的那句，业务列的单元格全是"—"（`dailyColumns.ts:137` 的 `formatDailyCell`，后端多发了数字也不显示，已有测试）。趋势图那边的下拉里这些指标禁用并带"无平台维度"后缀。
4. 回流率/回流表直接用除法而不用 `safeRatio` 的变异存活（报告里的"等价变异"）：属实。`formatPercent` 对 NaN、Infinity 返回"—"（`src/utils/ratio.ts:19`），输出不变。
5. 日报落地条只调 `daily-event` 和 `daily-business`，不调 `subscription-snapshot`，所以"回填"标记不会由这个落地条产生。规格 5.2 和任务书明确写了这两个名字；`subscription-snapshot` 是契约里单独的补数名。页面按规格做，不是偏离。

## 六、逐项核对（没有发现问题的部分）

- UTC 日历日：`daily.tsx:33`、`retention.tsx:34` 用 `lastNDaysUtc`；日期选择器值经 `pickedDay` 按选中的年月日原样发送（`DateRangeUtc` 的 `asPickerDate`/`pickedDay` 成对，没有时区换算）；落地日默认 `yesterdayUtc()`；日报页和留存页各有 Pacific/Auckland 的用例（`daily.test.tsx:140`、`retention.test.tsx:145`）。请求参数就是 `from=YYYY-MM-DD&to=YYYY-MM-DD`。边界：范围包含今天（UTC），当天是临时值（见变更 2）。
- 无平台维度的列：`dailyColumns.ts` 的 15 个业务列（新增账号、游客新增/转注册、通话次数、通话人数、通话总分钟、人均通话分钟、两种消息数、新订阅、有效订阅、额度购买次数、额度消耗、游客通话次数、游客通话总分钟）与契约 17.6 的 `StatDailyBusiness` 加订阅快照一致；7 个事件列（日活、周活、月活、匿名设备日活、创建形象/克隆声音/发起通话账号）保留。变异"条件反过来"：16 个用例变红。
- 人均通话分钟：`safeRatio(callSecondsTotal, accountsWithCall)` 再除 60；分母 0 或缺值为 `null` 显示"—"，真的 0 显示 0。变异"不除 60"：2 个用例变红。
- 回填标记：只在 `activeSubscriptions` 是数字且 `activeSubscriptionsBackfilled === true` 时出现；`null`/`false` 都不标。变异（`!== false`）：1 个用例变红。
- 留存语义：未到期（`null`）显示"—"，真的 0 显示 0%，基数 0 显示"—"（共用矩阵）；折线对没有值的 cohort 不画点。回流：无沉默用户时率为空档，不是 0%。
- 导出：日报、留存、回流分别传 `daily`、`retention`、`reactivation`；参数取 `applied`（点过查询的筛选），回流不带平台和渠道，带 `silenceDays`。变异（改取 `draft`）：1 个用例变红。
- 权限：`ExportButton` 需要 `STATS:EXPORT` 和 `viewCode="STATS:VIEW"`；落地条只要 `STATS:LAND`；路由 `STATS:VIEW`。三者独立，没有 `STATS:LAND` 时 `CheckDayLandBar` 和 `LandBar` 都不渲染。
- 错误显示：`describeFailure(...).text` 放进 `pages.common.loadFailed`，后端原话不进页面（日报、留存各有用例）；落地失败是 `message.error(翻译文字)`。
- 文字：`tests/noHardcodedText.test.ts` 对本任务文件没有任何报告；`src/locales` 一致性测试（键、占位符、en-US 无中日韩字符）通过；我 grep 了第三方产品名、"工单"、"台账"、"阶段"、"里程碑"、调试输出，本任务文件里都没有。
- 规格 5.2 的 7 个列提示文字与规格一致（日活的"后端自己产生的事件不算"、新增游客设备的"重装应用会产生新的设备记录"、通话次数的"游客通话单独一列"）。

## 七、变异抽查（我自己做的，在副本里，每次只改一处、跑 `src/pages/stat` 和 `config/routes/dailyRetention.test.ts` 共 70 个用例，之后还原）

报告里的变异抽查了 9 个，全部复现被抓住：

| 变异 | 结果 |
|---|---|
| 平台条件反过来（`dailyColumns.ts`） | 16 个变红 |
| 人均分钟不除 60 | 2 个变红 |
| 日报导出参数改取编辑中的筛选 | 1 个变红 |
| 日报落地只调 `daily-event` | 1 个变红 |
| `CheckDayLandBar` 去掉 `STATS:LAND` 判断 | 1 个变红 |
| 回流请求多带 `platform` | 1 个变红 |
| 去掉 `ReportHelper` 的 `key` | 1 个变红 |
| 空值显示 "0" 而不是 "—" | 6 个变红 |
| 回填条件放宽为 `!== false` | 1 个变红 |
| 去掉留存已选天数的排序 | 1 个变红 |

我另做的、报告没有列的 3 个变异，**全部存活**（测试缺口，见记录 10-12）：共用 `useSingleFlight` 的保护拿掉；日报趋势图的 `from` 改取编辑中的范围；日报的 `maxDays` 接线拿掉。

## 八、没有查到或没有运行的

- 没有在浏览器里看（没有启动开发服务器）；记录 3 是读 G2 源码推断，需要浏览器核实。
- 没有全量测试和构建（按规则最后一起跑）。
- 语言：只覆盖中文和英文界面；假数据是数字，页面不显示用户输入的文字，泰语、阿拉伯语等不适用于这两个页面（报告已写明）。

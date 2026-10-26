立即修未修 0、记录项 4、未运行 3、阻塞 0。另有三个契约问题写成了问题文件，等后端回复；需要改共享文件 2 处（见下）。

# 任务 18 报告：游客统计

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。本任务测试共 68 个（页面 44、纯函数 18、路由 6），全部通过；`biome`、`tsc`（只看本任务路径）无报错。本任务做的是新页面，规则里属于"页面、报表：一次独立评审"，评审由负责人另派（我只做了实现、变异检查和真实浏览器检查，没有给自己做评审）。

## 改了哪些文件

- `src/pages/stat/guest.tsx`：页面，四个页签（游客日报、转化进度队列、游客留存、额度使用），顶部写明统计日按 UTC、这里统计的是设备不是账号。
- `src/pages/stat/guest/`：`conversion.ts`（`buildConversionDistribution`、`buildConversionStack`、`dailyConversionRate`）、`quota.ts`（六张卡片的公式、分档转化率）、`GuestDailyTab.tsx`、`GuestCohortTab.tsx`、`GuestRetentionTab.tsx`、`GuestQuotaTab.tsx`、`DeviceCohortMatrix.tsx`（设备队列矩阵）、`GuestLandBar.tsx`（落地条）、`useReport.ts`、`ReportState.tsx`。
- 测试：`src/pages/stat/guest.test.tsx`、`src/pages/stat/guest/conversion.test.ts`、`quota.test.ts`、`config/routes/guestStats.test.ts`。
- `config/routes/stats.ts`：在统计菜单里加 `/stat/guest`（`STATS:VIEW`），没有动任务 17 的两条；`config/routes/dailyRetention.test.ts` 只过滤自己的两条路由，不受影响，仍然通过，没有改它。
- `src/locales/{zh-CN,en-US}/guestStats.ts`：本页全部文字，含菜单名 `menu.stats.guest`（别的文件里没有这个键）。
- `docs/contract-requests/2026-10-26-admin-frontend-guest-stats.md`：三个契约问题。
- 没有改假后端：任务 9 的 `mock/stats.mock.ts` 已有 `/stats/guest/{daily,cohort,retention,quota}`、补数和导出，够用。

## 对照任务书逐条

- `buildConversionDistribution(rows)`：八档，键为 `D0、D1、D2、D3、D4-D5、D6-D7、D8-D14、D15-D30`（页面翻译成"同日、D1 …"），各档是相邻两列累计值之差，按 cohort 求和；一档的两列只要有一列未到期（`null`），这个 cohort 的这一档就不计入。手算例子（两个 cohort：全部到期的 10、15、18、20、24、27、30、33，和只到 D3 的 4、6、7、9）得到 14、7、4、4、4、3、3、3，总和 42 = 33 + 9。
- `buildConversionStack(rows)`：每个 cohort 一根柱，分段 `D0`、`D1`、`D2`、`D3-later`（第 3 日及以后 = 最后一个到期列减 D2）；未到期的分段和什么都没到期的 cohort 不出现（不画成 0）。
- 游客日报：列为日期、新增游客设备、游客设备转注册、当日转化率；转化率 = 转注册 ÷ 新增，新增为 0 显示"—"、真的 0 显示 0%、可以超过 100%；三个列头有提示，转化率的提示写明"不是同一批设备的转化率"。
- 额度使用：六张卡片按规格公式，分母 `devices − noGrant` 不大于 0 显示"—"；`configuredTotalSeconds` 为 `null` 显示"未配置，游客不能通话"（0 显示"0 分钟"，见问题文件第一条）；六档柱状图；分档转化表（转化率 = `converted / devices`，设备数 0 显示"—"）；两个列提示；没有落地条、没有导出；跳系统配置的链接只对 `CONFIG:MANAGE` 渲染。
- 转化进度队列：矩阵（设备首次出现日、基数设备数、D0 到 D30 共八列，每格"累计设备数 · 百分比"，D1 起带"(+新增)"，新增带正负号；未到期"—"，基数 0 的百分比"—"）、环形图、堆叠柱状图（旁边写明"不是按来源分"）。
- 游客留存：日期范围（默认 30 天）、平台、渠道包、D1 到 D90 多选（默认 D1、D7、D30）；按主会话的通知用 `<RetentionTrendChart rows days />`，一张图多条线；矩阵用本页自己的 `DeviceCohortMatrix`（原因见"需要改共享文件"），格子"设备数 · 百分比"加绿色底色（0% 和"—"没有底色）；常驻的提示（不是可关闭的面板）写明"cohort 是设备第一次出现的那一天，已转注册的设备照常计入，没有通过设备校验的设备不在内"。
- 落地条：一个落地条，依次调用 `daily-business`、`guest-cohort`、`guest-retention`（规格 5.4 是"同时调"三个），在游客日报、转化进度队列、游客留存三个页签出现，额度使用页签没有；日期标签"检查日（UTC）"并写明对两张队列表是回填各个 N 的格子；只对 `STATS:LAND`；中途失败就停，已落地的部分仍然重读；重复点击只发一次。
- 导出：游客日报 `guest`（参数 `from`、`to`），游客留存 `guest-retention`（`from`、`to`、`platform`、`channel`），参数是"点过查询之后的筛选"，不是正在编辑的；转化进度和额度使用没有导出（契约没有对应名字）。
- 错误只显示错误码对应的译文，不显示后端的话；日期默认范围按 UTC 算（Pacific/Auckland 时区下测过）。

## 红到绿

先写测试；实现不存在时因"模块不存在"失败：

```
npx vitest run src/pages/stat/guest
 FAIL  src/pages/stat/guest/conversion.test.ts   Error: Failed to resolve import "./conversion" ... Does the file exist?
 FAIL  src/pages/stat/guest/quota.test.ts        Error: Failed to resolve import "./quota" ... Does the file exist?
npx vitest run src/pages/stat/guest.test.tsx
 FAIL  src/pages/stat/guest.test.tsx             Error: Failed to resolve import "./guest" ... Does the file exist?
```

实现后：纯函数 `Test Files 2 passed, Tests 18 passed`；页面第一次 57 个里 2 个红（两处都是测试里 `data-testid` 在表头重复出现，改成只取表头里的第一个），改好后全绿。主会话通知（共享的留存矩阵和趋势图改了）之后我把单元格文字改成"1,200 · 100%"的写法，趋势图改成一张图多条线，同一条命令最终：`Test Files 4 passed, Tests 68 passed`（`src/pages/stat/guest`、`config/routes/guestStats.test.ts`）。相关的既有测试一并跑过：`src/pages/stat`、`config/routes/dailyRetention.test.ts`、`src/locales`、`src/components/stat`、`mock/stats.mock.test.ts`：全部通过；`tests/noHardcodedText.test.ts` 有失败，失败项是别的会话正在写的文件（`src/pages/analytics/funnel.tsx:271`；之前还有 `mock/moderation.mock.test.ts`、`src/pages/moderation/*.test.*` 里的隐藏字符），本任务的文件在扫描里没有报告。

## 变异检查

共 35 个变异（改源码、跑相关测试、还原），最终全部被测试抓住：

- 转化分布：各档改成累计值而不是差；未到期的起点按 0 算；未到期的终点按 0 算。
- 堆叠：第 3 日及以后从 D3 而不是 D2 起算。
- 日报转化率：分子分母对调；`dailyConversionRate` 在分母为 0 时的行为由测试守着。
- 额度：分母不减 `noGrant`；平均已用秒数不除 60；未配置显示成 0；分档转化率的分母改错。
- 权限：跳系统配置的链接对所有人显示；落地条对所有人显示；额度使用页签加上落地条；转化进度或游客留存页签去掉落地条。
- 落地：去掉 `guest-retention`；成功后不重读；去掉 `useSingleFlight`。
- 导出：游客留存导出名写成 `guest`；日报导出名改错；日报或游客留存的导出参数取正在编辑的筛选。
- 页面：游客留存的提示去掉；游客留存改成一个 N 一张图；日报默认范围 7 天改 30 天；游客留存默认天数少一个；去掉矩阵的"新增"；D0 也带"新增"；未到期格子不显示"—"；绿色底色去掉；0% 也加底色；`useReport` 不丢过期的回答。
- 路由：`access` 改成 `STATS:EXPORT`。

第一轮有 3 个活下来，都已补测试后被抓住：游客留存导出取正在编辑的筛选（补了"改了平台还没点查询就导出"的测试）；落地按钮重复点击（补了连点两次只发一组三个请求的测试；原来的变异只去掉了 `disabled`，是等价变异，真正去掉 `useSingleFlight` 的变异现在被抓住）；0% 也加底色（补了断言）。

另有一件要说明的事：我的变异脚本放在会话共用的临时目录里，脚本名和别的会话重名，期间有另一个会话在同一个检出里重复运行了它，两次运行互相抢着改我的源文件，中途留下过两处没有还原的变异（`GuestCohortTab.tsx` 少了落地条、`conversion.ts` 的堆叠起点）。我发现测试变红后逐项核对并还原，之后在没有别的变异进程时重跑了全部相关测试（451 个全绿，包含语言文件一致性测试）。

## 真实浏览器检查（Chromium，端口 8318，`root` 登录，英文界面、默认的 Dim 暗色主题）

- 控制台：只有构建工具关于 `async/await` 的警告，和登录第一步的一次 401（预期的）。没有页面错误。
- 游客日报：7 行，转化率 14.3% 等；点"重新落地该日"依次 POST 三个名字（日期 2026-10-25 即 UTC 昨天），然后重新读；导出下载 `guest-2026-10-20-2026-10-26.xlsx`。
- 转化进度队列：30 行矩阵、环形图、堆叠柱状图（两张画布）；绿色底色随百分比变深，未到期是"—"。
- 游客留存：一张图多条线、矩阵 30 行；导出下载 `guest-retention-2026-09-27-2026-10-26.xlsx`。
- 额度使用：六张卡片、六档柱状图、分档表 6 行；链接指向 `/config#guest.call_minutes_total`。
- 390 像素宽没有横向溢出。
- 发现：（一）假后端的游客转化数据累计值不单调（见记录项 1），所以浏览器里能看到负的"新增"和堆叠图里的负柱，页面按数据如实显示，已把新增的符号写成"(-2)"而不是"(+-2)"；（二）六张卡片在 1400 像素宽时折成 5 加 1，已把卡片最小宽度从 200 改到 150（改后没有再看一遍截图）。
- 服务：我启动的开发服务在我要停它时端口 8318 已经没有监听（不知道是谁停的），所以没有执行按 PID 停止；没有用 `pkill -f`。

## 覆盖的语言

界面 zh-CN 和 en-US 两种（页面测试用 en-US，另有一个测试用 zh-CN 检查四个页签名；`src/locales` 一致性测试检查两种语言键和占位符相同、en-US 没有中文字符）。本页只显示数字和渠道码，不显示用户输入的文字，所以泰语、阿拉伯语、印尼语、越南语、西班牙语这类文字没有进入本页的任何检查：这一项只覆盖英文和中文界面。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-guest-stats.md`：（一）游客额度配置为 0 时 `configuredTotalSeconds` 是 0 还是 `null`；（二）游客日报、转化进度、游客留存里某天没有汇总行怎么返回；（三）游客留存能不能按 `unknown` 平台查。三条都有暂定做法，不阻塞。

## 需要改共享文件

1. `src/components/stat/RetentionMatrix.tsx`：表头"注册日""人数"写死，游客留存要"设备首次出现日""设备数"（任务 9 记录项 3、任务 17 已提）。现在用本页自己的 `src/pages/stat/guest/DeviceCohortMatrix.tsx`（格式和共用的一致，另有"新增"），共用组件加了标签属性后可以删掉本地版本。落地条同理：`src/components/stat/LandBar.tsx` 不能一次落三个名字加自己的说明，本页用 `src/pages/stat/guest/GuestLandBar.tsx`。
2. `src/pages/config/ConfigRow.tsx:155`：每一行只有 `data-testid`，没有 `id`，所以 `/config#guest.call_minutes_total` 打开系统配置页但不会滚到那一行。需要给行加上和配置键同名的 `id`（并在页面挂载后按 `location.hash` 滚动）。

## 规格需要在 main 上修改的地方

无。（规格 5.4 写"落地条同时调三个"，我按它做了一个落地条；规格没写这个条的日期对日报是统计日、对两张队列表是检查日，页面上的说明写了这一点。）

## 记录项（建议全部修）

1. `mock/_core/statData.ts` 的 `guestCohortRow`（约 151 行，经 `cells` 函数）：每个格子各自加 ±20% 的随机，累计值不单调。触发：打开转化进度队列页签，2026-09-27 这行 D2 是 58、D3 是 56。结果：页面显示"(-2)"，堆叠图出现负柱；真实后端的累计值按定义不会下降。这是共享假数据文件，需要改成先算增量再累加。
2. `src/pages/stat/guest/DeviceCohortMatrix.tsx` 和 `GuestLandBar.tsx` 是共用组件的本地版本，会和共用的各自演变（需要改共享文件第 1 条）。
3. `/config#guest.call_minutes_total` 不滚到那一行（需要改共享文件第 2 条）。结果：运营点了链接得到的是整张配置页。
4. 游客留存的平台筛选没有 `unknown`（共用的 `PlatformChannelFilter` 只有三个选项，问题文件第三条）：平台缺失的设备只能在"全部"里间接看到。

## 未运行（3）

- 全量测试和构建（按规则最后一起跑）。
- 亮色和 Deep 主题、中文界面的截图、Firefox、Safari、手机宽度下图表的触摸交互（只看了默认的 Dim 暗色、英文界面，390 像素宽只看了没有横向溢出）。
- 对着真实后端的检查（只有假后端；落地三个名字、额度公式、`unknown` 平台都需要真实数据验证）。

## 变更候选

无（没有加计划里没有的东西）。

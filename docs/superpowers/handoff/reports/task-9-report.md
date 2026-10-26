# 任务 9 报告：统计共用组件与统计接口

立即修未修 0、记录项 6、未运行 3、阻塞 0。另有三个契约问题写成了问题文件，等后端回复。

提交：`7afccc1`、`e6f121f`（实现）、`105deaa`（评审后的修复）。环境：Node 24.22.1。一次独立评审（29 个变异、Chromium 探针）。

## 做了什么

- `src/services/stats/`：契约 §17.6 的 14 个报表接口各一个函数（参数名取契约）、`landStat`（16 个补数名）、`fillMissingDays`、行类型（可空列带 `null`）；`src/services/channels/getChannels.ts`（`GET /channels`，接受 `{items}` 或裸数组）。
- `src/components/stat/`：`StatCard`（涨绿跌红、对比值为 `null` 或 0 时变化显示"—"、百分点单独写）、`TrendChart`（补满范围内每一天，随主题重绘）、`RetentionMatrix`（空格"—"和 0% 区分）、`RetentionTrendChart`、`LandBar`（只对 `STATS:LAND` 渲染，默认 UTC 昨天，多个名字依次调用）、`ReportHelper`（关闭状态存 `localStorage`，读写容错）、`UtcNotice`、`DateRangeUtc`（所选日历日原样当 UTC 日发出，预设按 UTC 算，超过 `maxDays` 提示且不触发查询）、`PlatformChannelFilter`；`src/components/ChannelSelect.tsx`（渠道列表全页共享一次读取）。
- 假后端：`mock/stats.mock.ts`（14 个报表加补数）、`mock/channels.mock.ts`（预置 `play`、`direct`、`appstore`）、`mock/export.mock.ts`（样例 `.xlsx`：一列日期加一列数；用 openpyxl 和 LibreOffice 都能打开，泰语、阿拉伯语、emoji 和 `<&>"'` 都对）、数据在 `mock/_core/{statData,statRange,xlsx}.ts`。
- 三个契约问题写在 `docs/contract-requests/2026-10-26-admin-frontend-stats-and-channels.md`：渠道包列表的响应形状；`stats.max_range_days` 的"跨度"是含两端的天数还是日期之差；某天没有汇总行时 `/stats/daily` 是不返回还是返回全 `null` 的行。

## 红到绿

先写测试；模块不存在时因"模块不存在"失败。绿：`src/components/stat`、`src/services/stats`、`mock/stats.mock.test.ts`、`mock/export.mock.test.ts` 共约 190 个测试通过；`tsc`、`biome` 通过。

## 评审与修复

评审者的结论：立即修 3、记录 8、不是缺陷 4。UTC 日边界在真实 Chromium（新加坡时区、时钟固定在当地 10 月 22 日 01:30）里正确：预设"今天"发 `2026-10-21`、"昨天"发 `2026-10-20`，补数默认日是 `2026-10-20`。

立即修 3 条，**全部已修并有测试**：
1. 假后端里渠道不是 `ALL` 时 `activeSubscriptions` 仍有数字（契约写明 `null`）。已修；没有快照的日子 `activeSubscriptionsBackfilled` 也是 `null`。
2. `DateRangeUtc`：超过 `maxDays` 的预设被拒绝后，选择框仍显示被拒绝的范围，和页面上的数据对不上；手动输入时提示还弹两次。已修（拒绝后用 `key` 重画选择框回到当前值；提示用同一个 `key`）。
3. `TrendChart` 把行里为 `null` 的列画成 0，"今天还没有订阅快照"会被读成"订阅数清零"。已修：没有行的日子补 0（规格 4.4），行里为 `null` 的列留空档。

记录项里一并修的：`LandBar` 多个名字时第一个成功第二个失败，页面不重读（现在有部分成功就通知页面）；补了"正好等于 `maxDays`"的测试；渠道名里的商店名改为中性名字。

## 仍然记录的 6 项（建议全部修）

1. `RetentionTrendChart` 纵轴没有百分号，提示框也没格式化，而矩阵里同一个量显示百分比（`RetentionTrendChart.tsx`）。
2. `RetentionMatrix` 规格 5.3 要"各 Dn 的人数和百分比，绿色热力底色"，现在只有百分比（`RetentionMatrix.tsx`）。
3. `RetentionMatrix` 的表头"注册日""人数"写死；游客留存的分群是"设备首次出现日"、单位是设备数，组件没有改标签的入口。`LandBar` 也没有标签和提示的入口：规格 4.4 要求留存页写"检查日"并提示"会回填各个 N 的格子，不是整行重算"（`stat.common.land.hint` 目前没有组件使用）。留存页（任务 17、18）要用时需要给这两个组件加属性。
4. 测试缺口：`statRange.ts` 的上限差一天、`ReportHelper` 的 `setItem` 去掉容错，现有测试都不变红（React 事件处理器里的异常不让测试失败）。
5. 假后端缺口：usage-cost 只处理 `currency`，忽略 `resourceType/provider/model/source/tier`；范围上限用固定值，不跟 `/config` 里 `stats.max_range_days` 的改动。
6. 渠道码和渠道名的商店名：契约里有 Google Play、App Store 这样的名字；仓库里已换成中性名字，但文字扫描没有这条规则，要不要把商店名也列入禁用词需要你判断。

## 未运行（3）

- 真正的 Microsoft Excel 打开导出样例（用过 openpyxl 和 LibreOffice）。
- Firefox、Safari、手机宽度、夏令时跨午夜的时区。
- 全量测试和构建（按规则最后一起跑）。

## 不是缺陷

函数合在 `reports.ts` 而不是一接口一个文件，导出由任务 8 的 `ExportButton` 承担；`StatCard` 在百分点卡片对比值为 0 时变化显示"—"是计划的字面要求；`PlatformChannelFilter` 没有 `unknown` 平台选项（规格只写了 ALL、ANDROID、IOS）。

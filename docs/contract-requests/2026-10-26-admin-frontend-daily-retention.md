# 给后端的问题：日报和留存报表里契约没写清的三处

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 17（日报与留存报表）。下面三处契约 §17.6 和后端的回复里都没有写清，前端和假后端按"暂定做法"先做，后端回复后再改。这些不阻塞页面。

## 一、补数 `retention` 和 `reactivation` 各覆盖哪些行

契约 §17.6 的补数列表里只有 `retention` 和 `reactivation` 两个名字，没有写：

- `POST /stats/land/retention?date=D` 是不是一次把 `ACTIVE` 和 `CALL` 两种类型的格子都填了（`StatRetention` 是一张表，主键里有 `retentionType`、`platform`、`channelCode`），还是只填其中一种？填的是不是所有平台、所有渠道的行？
- `POST /stats/land/reactivation?date=D` 是不是三个沉默天数（7、14、30）都重算？

**我们为什么需要：** 留存页的"活跃留存"和"通话留存"两个页签共用一个落地条，落地的是 `retention`。如果它只填其中一种类型，运营点了"重新落地该日"却看不到另一个页签变化，页面需要两个按钮。回流页签的落地条同理。

**暂定做法：** 前端把 `retention` 当作"两种类型、所有平台和渠道都填"，把 `reactivation` 当作"三个沉默天数都重算"；落地条在两个留存页签上是同一个，成功后重新读当前页签。假后端对这两个名字只回成功，不区分。

## 二、留存和回流报表里"某一天没有汇总行"怎么返回

这是 `docs/contract-requests/2026-10-26-admin-frontend-stats-and-channels.md` 第三条（日报的同类问题）在留存和回流上的延伸。范围内某个 cohort 日（`/stats/retention`）或统计日（`/stats/reactivation`）没有汇总行时，是不返回这一天，还是返回一行 `cohortSize`/`silentUsers` 为 0、各格为 `null` 的行？

**我们为什么需要：** 留存矩阵里，没有行的日子不出现；有行但格子为 `null` 的日子出现一行"—"。回流的趋势图要补满范围内每一天。

**暂定做法：** 留存矩阵只显示后端返回的行（不补行，因为补出来的"人数 0"会被读成"那天没有注册"）；回流的图补满范围内每一天，没有行的日子人数按 0，回流率留空档（不是 0%）；回流表只显示后端返回的行。

## 三、`activeSubscriptionsBackfilled` 在没有快照的日子是 `null` 还是 `false`

契约 §17.6 写 `activeSubscriptions` 在当天和缺失的日子为 `null`，没有写同一行的 `activeSubscriptionsBackfilled` 此时的值。

**我们为什么需要：** 日报的"有效订阅"列在值带"回填"标记时要读这个标志；值为 `null` 时没有可标记的数。

**暂定做法：** 前端只在 `activeSubscriptions` 是数字且 `activeSubscriptionsBackfilled === true` 时标"回填"；标志为 `null`、`false` 或缺失都当作"不是回填"，值为 `null` 时一律显示"—"。假后端在没有快照的日子两个字段都给 `null`。

核对于 2026-11-01

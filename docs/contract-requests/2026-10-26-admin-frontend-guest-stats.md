# 给后端的问题：游客统计里契约没写清的三处

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 18（游客统计）。下面三处契约 §17.6 和后端的回复里都没有写清，前端和假后端按"暂定做法"先做，后端回复后再改。这些不阻塞页面。

## 一、游客额度配置为 0 时 `configuredTotalSeconds` 返回 0 还是 `null`

契约写"未配置为 `null`"，又写"设备没有额度（`grantedSeconds` 为空或 0，即运营没有配置 `guest.call_minutes_total`）时游客不能通话"。没有写：运营把 `guest.call_minutes_total` 明确设成 0 时，`configuredTotalSeconds` 是 0 还是 `null`；设成 0 和没配置在后端是不是同一种状态。

**我们为什么需要：** 额度使用页签的第一张卡片，`null` 显示"未配置，游客不能通话"，0 会显示"0 分钟"。两者对运营的含义是一样的（游客都不能通话），但文字不同。

**暂定做法：** 前端把 `null` 显示为"未配置，游客不能通话"，把 0 显示为"0 分钟"；不把 0 当作未配置。

## 二、游客日报、转化进度、游客留存里"某一天没有汇总行"怎么返回

这是 `docs/contract-requests/2026-10-26-admin-frontend-daily-retention.md` 第二条在 `/stats/guest/daily`、`/stats/guest/cohort`、`/stats/guest/retention` 上的延伸：范围内某天没有汇总行时，是不返回这一天，还是返回一行 `cohortSize` 为 0、各格为 `null` 的行？

**我们为什么需要：** 转化进度和游客留存的矩阵只显示后端返回的行；补出一行"设备数 0"会被读成"那天没有新设备"。

**暂定做法：** 三个表都只显示后端返回的行，不补行。

## 三、游客留存能不能按 `unknown` 平台查

契约 §17.6 写 `StatGuestRetention` 的 `platform` 取 `GuestDevice.platform`，缺失或不在 `ANDROID`、`IOS` 内的归 `unknown`，并说 `/stats/daily?platform=unknown` 可查；没有写 `/stats/guest/retention?platform=unknown` 是否同样可查。

**我们为什么需要：** 规格 5.4 的平台筛选只有 `ALL`、`ANDROID`、`IOS`。如果 `unknown` 的设备能查，运营才能看出平台缺失的那部分设备留得怎么样；`ALL` 行里是包含它们的。

**暂定做法：** 前端只提供 `ALL`、`ANDROID`、`IOS` 三个选项（用的是统计共用的平台筛选）。

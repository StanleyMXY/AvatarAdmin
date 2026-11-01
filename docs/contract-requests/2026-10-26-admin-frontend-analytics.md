# 给后端的问题：埋点管理三个页面用到的接口里没有写清的地方

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 20（埋点管理：事件汇总、事件明细、漏斗分析）。契约 §7、§17.4 埋点管理行和后端回复第 13 条写了四个现查接口和已保存漏斗的权限、范围上限、`event-summary`、`event-names`、`funnel` 的响应；下面几处没有写。前端和假后端按"暂定做法"先做，后端回复后再改。没有一处是阻塞：每一处都有能继续的最小做法。

## 一、`from`、`to` 的写法

契约写了 `GET /analytics/event-summary?from=&to=`、`/event-names?from=&to=`、`/funnel?…&from=&to=`，事件明细写了"时间范围"，没有写这两个参数是什么格式、两端含不含。`/stats/*` 的 `from`、`to` 是 `YYYY-MM-DD`。

**问：**
1. 四个接口的 `from`、`to` 是 `YYYY-MM-DD`（UTC 日，含两端，同 `/stats/*`），还是带时刻的 ISO-8601 时间？
2. "跨度不超过 `analytics.live_max_range_days`"按含两端的天数算吗（`from`=1 日、`to`=31 日是 31 天，合格）？
3. 不传 `from`、`to` 时是 400，还是取默认范围（比如最近 7 天）？
4. 越界时 `data.details` 的 `ref` 是 `to` 吗？

**我们为什么需要：** 页面用日期范围选择器，选哪一天就发哪一天（统计日是 UTC 日），不能自己换算成时刻；事件明细的排查常常要精确到分钟，如果后端要时刻，页面要加时间选择。

**暂定做法：** 四个接口都发 `from`、`to`，`YYYY-MM-DD`，UTC 日，含两端；页面一定会发，所以不依赖缺省行为；假后端缺任何一个返回 400 `INVALID_REQUEST`，`details` 的 `ref` 是缺的那个参数，跨度超过上限时 `ref` 是 `to`。

## 二、`GET /analytics/events` 的参数和响应字段

契约只写"按账号、设备、事件名、时间范围查明细，每条带 `receivedAt`、`clientTime`、`country`、`ip`，展开显示 `params`、`context`"，后端的四份回复里也没有这个接口的字段表。

**问：**
1. 查询参数名是不是 `accountId`、`deviceId`、`eventName`、`from`、`to`、`page`、`pageSize`（精确匹配，空则不筛）？
2. 响应是不是分页的 `{"items":[…],"total":N}`，按 `receivedAt` 倒序（同一批里按 `seq` 倒序）？
3. 每条的字段是不是 `id`、`eventName`、`accountId`（没有账号为 `null`）、`deviceId`、`receivedAt`、`clientTime`（客户端没给或不合规为 `null`）、`country`（`null` 可）、`ip`、`params`、`context`？`event_log` 的存储里事件名叫 `name`，这里按其他三个接口的写法叫 `eventName`；有没有 `id`（我们要一个稳定的行键）？
4. 平台、App 版本是不是只从 `context.platform`、`context.appVersion` 读（存储里没有单独的列）？

**我们为什么需要：** 列表页要写类型、表格要有行键；字段名猜错会让整列为空。

**暂定做法：** 照上面的 1 到 4 全部按"是"做；平台和 App 版本从 `context` 里读，读不到显示"—"。

## 三、已保存漏斗 `GET/POST/PUT/DELETE /analytics/funnels`

契约只写了 `SavedFunnel` 的字段（名称、步骤列表、`windowHours`、`isPreset`）和权限，实体表里是 `id, name, steps, windowHours, isPreset, createdBy, createdAt, updatedAt`。

**问：**
1. `GET` 的响应是 `{"items":[…]}` 还是裸数组？不分页吗？排序？
2. `POST`、`PUT` 的请求体是不是 `{"name","steps","windowHours"}`，`PUT` 是整体替换？响应是不是更新后的 `SavedFunnel`（含 `createdByUsername`，按回复第 3 条的规则）？`DELETE` 成功时 `data` 是 `null`？
3. 名称的长度限制是多少（按去首尾空白后的码点数）？名称要不要唯一？重名时是不是 409 `DUPLICATE_RESOURCE`，`data.field` 是 `name`？
4. `PUT`、`DELETE` 预设漏斗时返回什么？
5. 步骤的事件名要不要符合 `^[a-z0-9_]+$`（7.1 对上报的事件名有这个规则），还是任何不含逗号的字符串都收？步骤数、`windowHours` 不合格时 `details` 的 `ref` 是 `steps`、`windowHours` 吗？

**我们为什么需要：** 保存和编辑要给出准确的提示；预设漏斗的"没有编辑、删除"页面靠 `isPreset` 隐藏按钮，但别的管理员同时操作过时要有确定的错误。

**暂定做法：** 1 到 2 全按"是"；名称去首尾空白后 1 到 100 个码点，不能与别的漏斗同名，重名返回 409 `DUPLICATE_RESOURCE`（`data.field` 是 `name`）；预设的 `PUT`、`DELETE` 返回 409 `INVALID_STATE`（`data.status` 取 `PRESET`）；步骤只在前端拒绝含逗号的名字和空名字，其余交给后端；找不到返回 404 `RESOURCE_NOT_FOUND`。页面对已知错误码只显示 `error.<码>` 的译文。

## 四、漏斗步骤参数里的逗号

契约写 `steps=a,b,c`，没有写事件名里有逗号时怎么办。7.1 的事件名规则 `^[a-z0-9_]+$` 本来不允许逗号，但漏斗的步骤是管理员手输的。

**暂定做法：** 页面拒绝含逗号的步骤（不能查询、不能保存），不做转义。后端如果要收带逗号的名字，需要另给转义规则或改用重复参数。

核对于 2026-11-01

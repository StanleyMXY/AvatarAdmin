# 给后端的问题：签到活动、每日任务两组后台接口的参数、响应形状和一个缺的字段

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 24（活动管理：签到、每日任务）。契约 §28.1、§28.2 和后端第 17 条回复写了实体的列、权限和业务规则，没有写下面几处。前端和假后端按"暂定做法"先做，后端回复后再改。没有一处是阻塞：每一处都有能继续的最小做法。

## 一、需要新增的字段（唯一一处会改变页面行为）

1. **`GET /tasks/configs` 的每一项（以及 `GET /tasks/configs/{id}`）需要 `hasRecords`（布尔：这个配置是否已有任务记录）。** 规格 5.22 要求"已有任务记录的配置，类型和目标值只读"，契约 §28.2 的 `TaskConfig` 列和后端第 17 条回复都没有能回答"有没有记录"的字段（`GET /tasks/records` 也没有按任务筛选）。**暂定：** 页面不读这个字段也能工作——编辑时类型和目标值可改，后端对有记录的配置返回 409 `TASK_HAS_RECORDS` 时，页面把两个字段还原成原值并变为只读，并提示"要换就停用旧任务、新建一个"；表单里始终写着"已有任务记录的任务不能改类型和目标值"。页面已经预留：行里带 `hasRecords: true` 时，一打开表单就只读（当前后端不返回这个字段，假后端也不返回，所以浏览器里看到的是第一种路径）。请确认字段名，或给出别的办法。
2. **同一个问题的另一半：** 对有记录的配置，`PUT /tasks/configs/{id}` 带**没改的** `taskType` 和 `targetValue` 是否成功？页面每次都发完整的请求体（`PUT` 是整条替换），所以改名字或奖励时 `taskType`、`targetValue` 是原值。契约写"不能改"，请确认原值不算改。

## 二、列表的参数和响应（契约只写了地址和筛选名）

1. **四个列表**（`GET /checkin/activities`、`/checkin/records`、`/tasks/configs`、`/tasks/records`）**是否分页？** **暂定：** 分页，`page` 从 1，`pageSize` 取 10、20、50、100，响应 `{items,total}`（后端第 11 条回复的通则）。签到活动按 `id` 倒序，签到记录和任务记录按创建时间倒序，任务配置按 `sortOrder` 升序。
2. **筛选的写法。** `name`、`taskName` 是按"包含"匹配还是前缀、是否不分大小写？`lifecycleStatus` 取 `DRAFT`、`ACTIVE`、`ENDED`、`DISABLED`；`accountId`、`activityId` 是精确匹配。**暂定：** 页面把输入去掉首尾空白后原样发出，空的不发；匹配方式以后端为准。页面没有 `from`、`to` 筛选（规格 5.22 没有列），服务函数留了参数。
3. **`GET /tasks/records` 的 `status`** 取 `IN_PROGRESS`、`CLAIMABLE`、`REWARDED`、`EXPIRED`；传别的值是 400 `INVALID_REQUEST`，`details` 的 `ref` 是 `status`？

## 三、签到活动的写接口

1. **请求体。** 暂定：`POST`、`PUT /checkin/activities[/{id}]` 为 `{name, startDate, endDate, rewards:[{dayNum, rewardCredits, bonusCredits}]}`；`startDate`、`endDate` 不限时传 `null`；`dayNum` 按行序号从 1 连续；`bonusCredits` 总是显式带（默认 0）。`name` 的长度上限契约没写，页面只检查去掉首尾空白后不为空，请给出上限，前端再加检查。
2. **编辑生效中活动时的 `confirm`。** 页面只在"活动的存储状态是 `ACTIVE` 且开始日或结束日变了"时，先发带 `confirm:false` 的 `PUT`；其余情况（草稿、停用的活动、生效中但日期没变）发不带 `confirm` 的 `PUT`。请确认：① 后者在没有重叠风险时直接成功；② 没有重叠时 `confirm:false` 的 `PUT` 直接执行（契约对状态接口写了"没有重叠时 `confirm` 为何值都直接执行"，对 `PUT` 没写）；③ **执行成功时的响应是什么**（页面把"没有 `disabledActivities`、`applied` 不是 `false`"都当作已执行；假后端返回更新后的活动）。
3. **`PUT /checkin/activities/{id}/status`** 的请求体：发布和启用是 `{"status":"ACTIVE","confirm":false|true}`，停用是 `{"status":"DISABLED"}`。不允许的转换（例如发布已经生效的活动、停用草稿）暂定 409 `INVALID_STATE`，`data.status` 是当前状态；页面显示该码的文字并重新读列表。
4. **`DELETE /checkin/activities/{id}`** 对非草稿或已有签到记录的活动：暂定 409 `INVALID_STATE`（`data.status` 是当前状态）。契约只写了"不允许"，没有写码。
5. **`lifecycleStatus=ENDED`** 的活动，页面按存储状态 `status` 给操作按钮（`ACTIVE` 仍显示"停用"，因为后端的重叠规则也按存储状态算）。如果后端希望已结束的活动按别的方式处理，请说明。

## 四、每日任务的写接口

1. **请求体。** 暂定：`{taskName, taskType, targetValue, rewardCredits, description, claimTimeoutSeconds, sortOrder}`。`description` 为空时发 `""`（不发 `null`），`GET` 返回的 `description` 可能是 `null`，页面显示"—"；`claimTimeoutSeconds` 为空发 `null`，页面要求填的话是不小于 1 的整数；`sortOrder` 是整数（可为负，页面不限制）。请确认 `description` 空时接受 `""`，以及 `claimTimeoutSeconds` 的下限。
2. **任务类型的选项来源。** 规格写"选项取自后端声明的类型"，契约 §28.2 说类型"代码声明"，但没有接口或 `GET /meta` 字段列出它们。**暂定：** 页面写死三个（`daily_login`、`call_seconds`、`text_messages`）；列表里后端给出的别的类型码原样显示。以后新增类型要么改页面，要么请在 `GET /meta` 里加一个 `taskTypes` 数组，页面就不用改。
3. **`PUT /tasks/configs/{id}/status`** 的请求体 `{"status":"ENABLED"|"DISABLED"}`，成功响应页面不读。
4. **`DELETE /tasks/configs/{id}`** 对有记录的配置返回 409 `TASK_HAS_RECORDS`，页面显示该码的文字（共用语言文件里的文字已经写了"改用停用"）。

## 五、两个统计页（"用户的本地日"）

1. **`POST /stats/land/checkin-daily`、`task-daily` 的 `date`** 是统计行的 `statDate`（即用户的本地日）吗？页面的默认值是"昨天"（UTC 的昨天），范围是后端允许的最大日期吗（UTC+14 的本地日可以比 UTC 的今天晚一天）？**暂定：** 页面把选的日子原样发出，不检查；日期选择器里的"最近 7 天、30 天"以 UTC 今天为终点。请说明报表的 `to` 和落地的 `date` 最晚可到哪一天。
2. **两个导出的 `from`、`to`** 与报表相同；签到统计有两个页签，导出跟着页签：`checkin-daily-users`（每日签到人数）、`checkin-streaks`（连续签到分布）。规格只写"导出 Excel"，没有说两个页签各导哪个，这是前端的选择。

## 六、规格需要在 main 上修改的地方

- 规格 5.22 "任务配置" 写"已有任务记录的配置，类型和目标值只读"，应补一句数据从哪里来（本文第一节的 `hasRecords`），否则这一条只能在保存失败之后才能做到。
- 规格 5.22 "任务配置" 写"选项取自后端声明的类型"，应写明声明在哪里（本文第四节第 2 条）。

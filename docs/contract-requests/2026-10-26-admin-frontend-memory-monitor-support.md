# 给后端的问题：告警、客服反馈、记忆服务、管线监控的响应形状和几处没写的行为

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 13（记忆服务、系统监控与告警、客服）。契约 §12、§14.1、§16.2–§16.3、§17.4 和后端的四份文件里没有写清下面几处，前端和假后端按"暂定做法"先做，后端回复后再改。没有一处是阻塞：每一处都有能继续的最小做法。

## 一、`GET /alerts` 的响应形状

契约 §17.4 写了 `AdminAlert` 的列（`id`、`type`、`accountId`、`refType`、`refId`、`detail`、`status`、`createdAt`、`resolvedAt`）和查询参数 `status`、`type`，字段表里没有这一行。

**问：**
1. 响应是不是 `{"items":[…],"total":N}`，接受 `page`、`pageSize`？
2. 不带 `status` 时是全部状态，还是只返回 `OPEN`？
3. 排序是不是按 `createdAt` 倒序？
4. `detail` 是字符串还是 JSON 对象？

**我们为什么需要：** 告警页是分页表格，要知道总数；"未处理告警"卡片（总览页）用 `GET /alerts?status=OPEN` 的 `total`；`detail` 要显示在一个格子里。

**暂定做法：** 分页的 `{items,total}`，字段名同实体的列，不带 `status` 是全部，按创建时间倒序，`detail` 是字符串或 `null`（如果是对象，页面要另外设计怎么显示，请确认）。告警页默认筛选 `status=OPEN`，由页面发出。

## 二、`GET /support/feedback` 的筛选、分页和列表里带不带全文

契约 §17.4 只写了 `GET /support/feedback`、`GET /support/feedback/{id}` 和重试，没有写参数和响应。

**问：**
1. 列表接受 `page`、`pageSize` 吗，响应是 `{items,total}` 吗，排序是不是按 `createdAt` 倒序？
2. 能不能按 `forwardStatus`（`PENDING`、`FORWARDED`、`FAILED`）和 `category` 筛选？
3. 列表的每一行是不是 `SupportFeedback` 的全部列（含 `message` 和 `context`），还是只有摘要？

**我们为什么需要：** 客服要找的是转发失败的那几条（只有它们能点"重试"）；反馈多了以后只能翻页找很慢。正文最长 4000 个码点，`context` 里最近的错误最多 20 条，每条 500 字符，列表每行都带全文时 200 行的一页会很大。

**暂定做法：** 分页的 `{items,total}`，倒序，没有筛选（页面不加筛选，直到后端确认参数名）；列表行按实体的全部列读，详情抽屉另取 `GET /support/feedback/{id}`。

## 三、`POST /support/feedback/{id}/retry` 和 `POST /alerts/{id}/resolve` 的响应和状态错误

契约写了重试要把状态置回 `PENDING`、失败次数清零，关闭告警写审计日志，没有写响应 `data` 和对不该操作的状态的错误。

**问：**
1. 两个接口成功时 `data` 是什么？（`null`，还是更新后的对象？）
2. 对不是 `FAILED` 的反馈重试、对已经 `RESOLVED` 的告警关闭，是不是 409 `INVALID_STATE`，`data.status` 是当前状态？

**我们为什么需要：** 页面成功后重新读列表，不依赖响应；但别的管理员同时操作过的行，要给出"当前状态不允许这个操作"的提示（`error.INVALID_STATE`）。

**暂定做法：** 页面忽略成功响应的 `data`；假后端对上面两种情况返回 409 `INVALID_STATE` 和 `{"status":"<当前状态>"}`，页面显示 `error.INVALID_STATE` 的文字并重新读列表。

## 四、记忆服务三个写接口的响应、`MEMORY_MODEL_CONFLICT` 里 `detail` 的位置、名字不合格的错误

契约 §16.2–§16.3 写了请求、权限和"409 `MEMORY_MODEL_CONFLICT`，原样展示其 `detail`"，没有写：

**问：**
1. `PUT /memory/tiers/{name}`、`PUT /memory/embedding-models/{name}`、`PUT /accounts/{id}/memory/embedding-model` 成功时的 `data` 是什么？
2. 409 `MEMORY_MODEL_CONFLICT` 里的 `detail`（记忆服务那句话）在响应的哪里：`data.detail`，还是 `message`？
3. 名字不合格（`^[A-Za-z0-9_-]{1,64}$`）、`teiBaseUrl` 的主机不在白名单、`dimensions` 越界时，`data.details` 的 `ref` 和 `reason` 各是什么？（我们的页面发请求前就按同一规则拦住，这是给后端校验兜底时的显示用。）

**我们为什么需要：** 技术人员需要知道原来登记的维度是多少；校验失败要对到表单项。

**暂定做法：** 成功响应的 `data` 一律忽略，写完重新读列表；冲突时只显示 `error.MEMORY_MODEL_CONFLICT` 的译文（按负责人的规则，已知错误码只显示按码翻译的文字，记忆服务那句只有一种语言的 `detail` 不显示；曾经的"读 `data.detail` 原样显示"已取消）。要让页面写出原来登记的维度，请在这个 409 的 `data` 里给结构化字段，见 `2026-11-01-admin-frontend-translated-error-texts.md`；校验失败按 `ref` 为 `name`、`teiBaseUrl`、`dimensions`、`topK`、`recencyChannelCount`、`consolidationThreshold`、`recencyChannelEnabled`、`consolidationEnabled`、`modelName` 对到表单项，原因用现有的 `reason` 代码（路径里的名字不合格用 `INVALID_PATH`，主机不允许用 `INVALID_HOST`，非 http(s) 用 `NOT_HTTPS`，越界用 `OUT_OF_RANGE`，不是整数用 `NOT_AN_INTEGER`，不是布尔用 `NOT_BOOLEAN`）。

## 五、管线监控页的时间范围上限从哪里读

契约 §14.1 写 `GET /monitor/pipeline` 的范围不超过 `monitor.max_range_days`（提议值 7），超出 400；`GET /meta` 的 20 个字段里没有它。

**问：** 能不能在 `GET /meta` 里加一个 `monitorMaxRangeDays`（整数，当前生效值）？

**我们为什么需要：** 页面的时间范围选项（最近 1 小时、6 小时、24 小时、3 天、7 天）要和上限一致，否则这个配置调小以后，"最近 7 天"会稳定地得到 400。

**暂定做法：** 页面固定提供到 7 天；超限时显示 400 `INVALID_REQUEST` 按码翻译的文字（不显示后端的 `message`），其他选项照常可用。

## 六、`embeddingAssignments` 的顺序

契约 §16.3 写"每次手动指派一条"，没有写顺序。

**暂定做法：** 页面按 `assignedAt` 倒序自己排，最新的一条当作"当前模型"；没有记录时显示默认模型 `bge-m3`（契约 §16.3 写明的默认）。如果后端的"当前模型"不是最新一条，请告诉我们。

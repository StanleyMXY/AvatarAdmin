# 给后端的问题：会话列表的筛选参数名、设备字段的长度、会话详情的字段、"进行中"的含义

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 19（通话：会话列表、通话分析、通话质量）。契约 §17.4 通话行只写了筛选的含义，只有 `guest` 和 `endReason=DEADLINE` 给了参数名；`GET /sessions/{id}` 没有写响应字段；后端的四份文件里没有通话相关的内容。前端和假后端按下面的"暂定做法"先做，后端回复后再改。通话分析（`GET /stats/daily`）和通话质量（`GET /stats/session-quality`、导出 `session-quality`、落地 `session-quality` 和 `daily-business`）的字段和口径契约 §17.6 写得清楚，不在此列。

## 一、`GET /sessions` 的筛选参数叫什么

契约写"筛选账号 ID、是否游客（`guest=true` 或 `guest=false`）、`requestedAt` 时间范围、是否进行中、是否被到点强制结束（`endReason=DEADLINE`）"。账号 ID、时间范围、是否进行中这三项没有写参数名和格式。

**我们为什么需要：** 会话列表页（规格 5.5）有这五个筛选。参数名猜错，后端会静默忽略，页面显示的就是没有筛选的结果，运营会以为"该账号没有会话"。

**问：**
1. 账号 ID 是不是 `accountId`，精确匹配（和 `GET /users` 一样）？
2. `requestedAt` 的范围是不是 `from`（含）、`to`（不含），ISO-8601 时刻（和 `GET /attribution/records` 一致）？还是 `YYYY-MM-DD` 的 UTC 日？
3. "是否进行中"是不是 `ongoing=true` / `ongoing=false`？
4. `endReason` 除了 `DEADLINE`，是否也接受 §15.6 的其他四个值（`USER_LEFT`、`ROOM_FINISHED`、`BANNED`、`SUPERSEDED`）？不认识的值是 400 `INVALID_REQUEST` 吗？
5. `guest`、`ongoing` 不是 `true`/`false` 时是不是 400 `INVALID_REQUEST`（`details` 的 `ref` 是参数名，原因 `NOT_BOOLEAN`）？时刻格式不对、`to` 早于 `from` 呢？

**暂定做法：** 页面只发有值的参数：`accountId`（原样，只去首尾空白，按 §1.9 的集合）、`guest=true|false`、`from`、`to`（页面上选的是 UTC 日，发 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，和额度流水、多开检测同一做法）、`ongoing=true|false`、`endReason=DEADLINE`（页面只能问"是"，因为契约只有这一种写法，没有"不是到点结束"）。假后端按这个含义过滤，非法值返回 400。

## 二、`deviceId` 返回完整值还是前 8 位

契约写"`deviceId`（游客会话才有，只显示前 8 位）"，没有说"只显示"是谁做：后端只返回前 8 位，还是返回完整的哈希、由前端只显示前 8 位。认证事件那一行用的是 `deviceIdHashPrefix`（字段名带 `Prefix`，只给前 8 位），这一行字段名是 `deviceId`。

**我们为什么需要：** 完整的设备哈希是游客的稳定标识（游客额度、锁都按它），管理后台页面不需要，也不应该把它送到浏览器里（开发者工具、网络面板里都看得到）。

**暂定做法：** 页面一律只取前 8 个字符显示（按字符，不会把表情符号切成两半），完整值在任何地方都不出现：不进页面文字、提示、属性，也不写日志。后端无论返回完整值还是前 8 位，页面都对。**建议后端只返回前 8 位，并把字段名改成 `deviceIdPrefix`（或在契约里写明 `deviceId` 在这个接口里就是前 8 位）。**

## 三、`GET /sessions/{id}` 返回哪些字段

契约只写了路径，错误按通则（找不到是 404 `RESOURCE_NOT_FOUND`）。

**暂定做法：** 响应是 §18 `Session` 的列，按通则字段名一字不差：除了列表那九个（`id`、`accountId`、`deviceId`、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`）外，详情抽屉读 `freeTier`、`roomName`、`timezone`、`renderMode`、`deadlineAt`、`endReason`、`agentJoinedAt`、`userJoinedAt`、`userLeftAt`。不读 `lastParticipantEventAt`、`agentIdentity`、`statsAppliedAt`（内部字段，运营不需要）。`endReason` 取 §15.6 的五个值，别的值原样显示；每个时刻字段为 `null` 时显示"—"。**问：** 这样读有没有不该返回给运营看的字段（`roomName` 是通话的房间名，我们当作可以显示）？

**现状（2026-11-01）：** 后端 2026-10-29 清单 a7 已写明详情多一个字段 `maxDurationMinutes`（整数分钟，不小于 0，不为空，发起通话时记下的值）。详情抽屉读它，用来解释截止时间和现在的设置为什么不同（`src/pages/sessions/SessionDrawer.tsx`）；列表的九列不变。 **【部分已答（核对于 2026-11-01）：`docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 第 41 行；其余字段仍待后端回答】**

## 四、列表里怎么认出游客会话

列表的行没有 `guest` 字段，契约写"账号 ID（游客会话为空）"。

**暂定做法：** 账号 ID 为 `null` 或空串的行就是游客会话：账号列显示"游客"、没有链接，设备列显示前 8 位；否则账号 ID 链接到 `/users/:id`，设备列显示"—"。

## 五、"进行中"是不是包括"启动中"的会话

契约 §4.1 写 `agentJoinedAt` 为空的会话是"启动中"，不是进行中，也不是一次通话（失败时记录会被删除）。列表的"是否进行中"没有写它怎么对待启动中的记录。

**暂定做法：** 页面不区分，只发 `ongoing`；列表里 `endedAt` 和 `durationSeconds` 都为空的行，时长列写"进行中"。如果后端的"进行中"不含启动中的记录，不影响页面；如果含，请在契约里写明，页面才能把它们标成"启动中"。

## 六、规格需要在 main 上修改的地方（给改规格的人）

规格 5.5 会话列表一段写的是筛选的含义，没有参数名；建议把第一条的答案写进契约 §17.4 通话行后，规格不用改。规格 5.5 通话质量一段"阈值取自构建配置"已经对应 `ADMIN_QUALITY_MIN_SUCCESS_RATE`、`ADMIN_QUALITY_MAX_SLOW_SHARE`（任务 6 已加），不需要改。

核对于 2026-11-01

# 给后端的问题：用户列表的筛选参数名、用户会话的字段、账号删除任务的筛选和宽限期、封禁等写操作的响应、多开检测的时间格式

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 16（用户：列表、详情、导出、删除任务、多开检测）。下面几处契约（§2.8、§13.1、§17.4 用户管理行、认证事件行、多开检测行）和后端的四份回复里都没有写清，前端和假后端按"暂定做法"先做，后端回复后再改。已经给出字段的接口（`GET /users` 的行、`GET /users/{id}`、`GET /accounts/{id}/avatars`、`GET /users/{id}/devices`、`GET /users/{id}/auth-events`、`GET /abuse/clusters/accounts`）不在此列。

## 一、`GET /users` 和 `GET /users/export` 的筛选参数叫什么

契约 §17.4 用户管理行写"按账号 ID、邮箱、状态、注册渠道（`User.channelCode`）、流量类型（`PAID`/`ORGANIC`）、媒体来源（`AttributionRecord.mediaSource`）筛选"，另写"`GET /users` 增加按手机号筛选"，只写了含义，没有写查询参数名。`GET /users/export` 写"与 `/users` 相同的筛选"。

**我们为什么需要：** 列表页（规格 5.7）有这七个筛选；导出要带同样的参数。参数名猜错，筛选会被后端静默忽略，导出就会导出全部用户。

**问：** 七个参数名是不是 `accountId`、`email`、`phone`、`status`、`channelCode`、`trafficType`、`mediaSource`？邮箱和手机号是完整值的精确匹配（邮箱先规范化、手机号先规范化为 E.164，契约已写），其余也是精确匹配（`mediaSource` 忽略大小写吗？）？`status` 取 `ACTIVE`、`BANNED`、`PENDING_DELETION`、`DELETING`，不在其中是 400 `INVALID_REQUEST` 吗？

**暂定做法：** 页面和假后端用上面七个名字；只发有值的参数，值只去首尾空白（§1.9 的集合），不做模糊、不截取、不改大小写；假后端的 `mediaSource` 忽略大小写比较，其余精确。

## 二、`GET /users/{id}/sessions` 的响应字段和分页

契约 §17.4 写"`GET /users/{id}/sessions`（会话记录，含起止时间和时长）"，后端的回复第三节的 19 行里没有这一行。

**我们为什么需要：** 用户详情的"会话"页签（规格 5.7）。

**问：** 是 `{"items":[…],"total":N}` 并按 §17.4 通则分页吗（按 `requestedAt` 倒序）？每项是 `Session` 的哪些列？

**暂定做法：** 分页，每项只读这些字段：`id`、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`、`endReason`（都是 §18 `Session` 的列名）。进行中的会话 `endedAt`、`durationSeconds` 为 `null`，页面写"进行中"；`endReason` 取契约 15.6 的五个值，其他值原样显示。页面不显示房间名、`deadlineAt`、各个 webhook 时间。

## 三、账号删除任务：按账号筛选，以及详情页怎么知道宽限期何时结束

规格 5.7 写"取消：只在待删除（`PENDING_DELETION`）且宽限期内可用"。`PENDING_DELETION` 本身就是宽限期（宽限期满后账号是 `DELETING`，契约 13.1），所以页面用账号状态判断。但是用户详情（`GET /users/{id}`）不返回删除任务，`GET /account-deletions` 只有 `status` 筛选，页面没法告诉客服"宽限期到哪天为止""是谁发起的删除"。

**问：** 能否二选一：（a）`GET /account-deletions` 增加 `accountId` 筛选；（b）`GET /users/{id}` 在账号处于 `PENDING_DELETION` / `DELETING` 时带 `deletion: {id, status, executeAfter, requestedBy, requestedByUsername}`（其他状态为 `null`）。

**暂定做法：** 页面不显示宽限期的截止时间，只用账号状态；账号删除任务页（`/users/deletions`）照常列出所有任务，按 `status` 筛选。后端给出后，详情页的横幅里加上截止时间。

另：`GET /account-deletions` 每项我们读 `id`、`accountId`、`requestedBy`、`requestedByUsername`（后端回复第 3 条已定）、`reason`、`status`、`executeAfter`、`statusBefore`、`canceledAt`、`attempts`、`lastError`、`nextAttemptAt`、`createdAt`、`completedAt`；`stepStates` 不读，不显示。`lastError` 里会不会含用户内容或内部地址？页面把它当文字显示，长度不限。

## 四、封禁、解封、发起删除、取消删除、重试的响应

契约写了这些操作的前置状态和错误，没有写成功时 `data` 是什么。13.1 写了用户自己发起删除的响应是 `{"deletionId":"...","scheduledAt":"..."}`，取消的 `data` 为 `null`。

**暂定做法：** 页面不读这些操作的响应，成功后重新读 `GET /users/{id}`（或任务列表）。假后端：封禁、解封、取消、重试返回 `null`，发起删除返回 `{"scheduledAt": ...}`。

## 五、多开检测 `GET /abuse/clusters` 的 `from`、`to` 格式

契约 §17.4 多开行写"`from`、`to` 按 `RegistrationAudit.createdAt`"，没有写格式。同一批报表接口的 `from`、`to` 是 `YYYY-MM-DD`（§17.6），额度流水也有同样的问题（见 `2026-10-26-admin-frontend-credits.md` 第二条）。

**暂定做法：** 页面用 UTC 日历日选择（默认最近 7 个 UTC 日，含今天），发 `from=<起始日>T00:00:00Z`、`to=<结束日的后一天>T00:00:00Z`，即 `[from, to)`；假后端按这个含义过滤。`minFreeAccounts` 留空时不发，填 0 时发 `0`。

## 六、规格需要在 main 上修改的地方（给改规格的人）

1. 规格 5.7a 末尾"设备列表不在管理后台，是用户自己的功能（Java 2.9）"与规格 5.7 的"设备"页签、契约 §17.4 的 `GET /users/{id}/devices` 矛盾。前端按 5.7 和契约做了设备页签（只读，令牌只有末 6 位）。请删去 5.7a 的这句，或改成"用户自己的设备列表（登录链）在 Java 2.9，不在管理后台；管理后台看到的是推送注册"。
2. 规格 5.0 的用户详情路由没有写页签怎么选。额度账户页和额度流水页已经链接到 `/users/<id>?tab=credits`。前端把 `?tab=` 的取值定为：`overview`、`avatars`、`attribution`、`sessions`、`devices`、`authEvents`、`entitlements`、`credits`、`memory`；没有查看权限的页签、不认识的取值都打开概览。请把它写进 5.0 或 5.7。

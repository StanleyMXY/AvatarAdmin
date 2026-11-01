# 给后端的问题：推送模板、手动任务、周期推送、发送记录的请求和响应形状

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 22（推送）。契约 §8.3 到 §8.5、§17.4"推送管理"行和后端的四份文件写了实体的列、权限和业务规则，没有写下面几处的请求参数、响应形状和错误。前端和假后端按"暂定做法"先做，后端回复后再改。没有一处是阻塞：每一处都有能继续的最小做法。

## 一、模板

1. **`/push/templates/{id}` 的 `{id}` 是什么？** 契约写"`GET/POST/PUT/DELETE /push/templates`（按 `triggerReason`+`locale`）"。是路径里用实体 `id`，还是用 `(triggerReason, locale)` 定位？**暂定：** 用 `id`；`POST` 的请求体带 `triggerReason`、`locale`，`PUT` 的请求体不带这两项（它们是模板的键，建好后不改）。
2. **`GET /push/templates` 是否分页、有无筛选？** **暂定：** 分页的 `{items,total}`，没有筛选；完整性矩阵需要全部模板，前端用 `pageSize=200` 一页页读到取够 `total`。
   **现状（2026-11-01）：** 后端 2026-10-29 清单 a14 写的响应是 `{items, missingLocales}`，没有 `total`，也没有写分页。前端现在读 `missingLocales`；有数字 `total` 时读到取够为止，没有时读到空页为止（代码：`src/services/push/index.ts` 的 `listAllTemplates`）；假后端仍带 `total`。请后端确认 `total` 是否保留。
3. **请求体字段。** 暂定：`{triggerReason, locale, title, body, linkType, linkTarget, enabled, imageUploadId?}`（`PUT` 没有前两项）。图片的字段名契约没写，暂定 `imageUploadId`（同形象目录的 `previewUploadId` 命名规则）。`linkType` 为 `NONE` 时 `linkTarget` 传空字符串，是否也接受 `null`？
4. **怎样去掉模板、周期推送上已有的图片？** 契约只写了"换图"。**暂定：** 前端不提供去掉图片，`PUT` 不带 `imageUploadId` 表示图片不变。
5. **标题和正文的长度上限。** 契约 §17.4 通则第 4 条列了"通知标题和正文、任务说明"等，没有写推送的标题和正文。**暂定：** 前端只检查去掉首尾空白后不为空，长度交给后端（假后端按标题 200、正文 1000 个码点拒绝，仅为演示失败的显示）。请给出真实上限，前端再加计数。
6. **启用时缺语言的拒绝是什么错误？** 契约 §8.4 写"保存时校验"。**暂定（已过时，见下面的现状）：** 400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"enabled","reason":"OUT_OF_RANGE"}]`。如果是别的码或有专用的原因码，前端要补对应文字。前端在启用前已经按 `GET /meta` 的 `supportedLocales` 提示缺哪几种语言，但最终以后端为准。
   **现状（2026-11-01）：** 后端 2026-10-29 清单 a5、e1 已回答，并把规则改成只要求默认语言（`push.default_locale`）有启用的模板，不再要求每种语言都有。违反时答 400 `INVALID_REQUEST`，`data` 是 `{defaultLocale, reason}`，没有上面那种 `details`。前端现在显示一句按码翻译的文字；三种情形要分开说，需要后端在 `data` 里加 `case`，见 `2026-10-31-admin-frontend-push-default-language-case.md`。保存 `app.supported_locales` 不再因召回模板被拒。
7. **删除一条已启用的模板**会让该语言缺模板。后端是拒绝、允许，还是同时把该触发原因停用？**暂定：** 前端行内确认后发 `DELETE`，按后端的回答显示。
   **现状（2026-11-01）：** 已回答（清单 a5、e1）：非默认语言的模板随时可以删；默认语言那条在同一触发原因下还有别的语言启用时，`DELETE` 被拒，400 `INVALID_REQUEST`，`data` 为 `{defaultLocale, reason}`。前端按这个形状显示按码翻译的文字。
8. **同一 `(triggerReason, locale)` 再 `POST`** 是 409 `DUPLICATE_RESOURCE`（`data.field` 是什么）还是覆盖？**暂定：** 前端在发之前就拦住（页面已读到该组合时提示改那一条），后端按 409 `DUPLICATE_RESOURCE` 处理。

## 二、手动任务

1. **`GET /push/tasks` 的参数和响应。** **暂定：** 分页的 `{items,total}`，按计划时间倒序，每项是 `PushTask` 的列加 `createdByUsername`（管理员已删除时为 `null`，ID 照旧），不返回 `lockedAt`、`cursor` 之外要不要返回？前端只读 `id`、`audience`、`status`、`note`、`title`、`sentCount`、`failedCount`、`createdBy`、`createdByUsername`、`scheduledAt`。没有 `status` 等筛选（契约没写参数），请确认是否支持 `status`。
2. **立即发送。** 契约写"立即（创建时 `scheduledAt` = 创建时刻）"。**暂定：** 前端不带 `scheduledAt`，由后端填创建时刻；定时发送带 UTC 时刻（ISO-8601，`…Z`）。如果后端要求立即发送也显式带 `scheduledAt`，请说明。
3. **请求体。** 暂定：`{audience, accountIds?, platforms?, locales?, title, body, linkType, linkTarget, imageUploadId?, scheduledAt?}`；`audience=ACCOUNT_IDS` 时只带 `accountIds`，不带 `platforms`、`locales`（契约规定带了就是 400）；其他受众不带 `accountIds`；筛选为空时整项不带。`accountIds` 的条数上限和每个 ID 的格式没写，前端只去掉空项和重复项。
4. **`POST /push/tasks/{id}/cancel` 的响应和错误。** **暂定：** 成功响应 `data` 前端忽略；非 `PENDING` 返回 409 `INVALID_STATE`，`data.status` 是当前状态。

## 三、周期推送

1. **`DELETE /push/schedules/{id}` 之后**这一行还留在列表里（`enabled=false`，`nextRunAt=null`）吗？**暂定：** 留在列表里，前端删除后重新读列表，按后端返回显示。
2. **请求体。** 暂定：`{repeat, daysOfWeek?, dayOfMonth?, timeOfDay, timezone, startDate, endDate, enabled, 受众与内容字段同手动任务, imageUploadId?}`；只带所选重复方式用的那个天字段；`endDate` 不结束时传 `null`；`PUT` 带完整的字段（前端用列表里的启用开关时也是整条 `PUT`，只改 `enabled`，不带图片字段）。`PUT` 是整条替换还是可以只带改动的字段？若支持只带 `enabled`，前端可以更小。
3. 后端校验的 `ref`/`reason`：`daysOfWeek` 为空、`dayOfMonth` 越界、`timeOfDay` 格式、`timezone` 不是 IANA 名、`startDate`/`endDate` 不合法或 `endDate` 早于 `startDate`。**暂定：** `ref` 取字段名，`reason` 用 `EMPTY_NOT_ALLOWED` 或 `OUT_OF_RANGE`；前端发请求前已经按同一规则拦住。

## 四、发送记录

1. **`GET /push/records` 的筛选。** 契约只写了列。运营要查"某个账号收到过什么"和"某天的召回"，**需要**按账号 ID、触发原因、本地日期（或创建时间范围）筛选吗？**暂定：** 页面没有筛选，只分页（按创建时间倒序）。
2. **`GET /push/records/{id}` 里的数组叫什么？** 契约写"返回对每个 token 的 `PushDelivery`"。**暂定：** 响应是 `PushRecord` 的列加 `deliveries: [{id, pushId, pushTokenId, result, sentAt}]`；前端也接受数组叫 `items`；两者都没有就显示"没有记录到发送结果"。`pushTokenId` 是 token 记录的 ID，不是 token 本身，前端只显示它。要不要像 `GET /users/{id}/devices` 那样给 token 的末 6 位（`tokenSuffix`）和平台？

## 五、上传

`POST /uploads/image` 成功时"返回 `uploadId` 和地址"，地址的字段名没写；前端只用 `uploadId`，不用也不显示这个地址。`imageUrl`（实体的列）在列表里是长期地址还是短时效签名地址？**暂定：** 当作可直接显示的地址，每次读列表都用新取到的，不缓存。

## 六、推送效果的触发原因值

`GET /stats/push` 的 `triggerReason` 在契约里是 `daily_recall`、`streak_at_risk`、`admin`、`system_event`（`PushRecord.triggerReason`）。仓库共用的假后端（`mock/_core/statRange.ts` 的 `TRIGGERS`）写的是 `recall`、`announcement`、`notification`、`activity`、`admin`，这是推送的 `data.type`，不是触发原因；用契约的值筛选会得到 400。这是假后端的错误，不是契约的问题，在任务 22 的报告里作为"需要改共享文件"列出。
**现状（2026-11-01）：** 假后端的 `TRIGGERS` 已改成契约的四个值（`mock/_core/statRange.ts`），这一节不再需要处理。

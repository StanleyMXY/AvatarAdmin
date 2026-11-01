# 给后端的问题：短信渠道、模板、发送记录和邮件模板的请求体、响应和错误细节

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 28（短信管理与邮件模板）。契约 §23.4 写了短信实体的列、规则和"最后一个启用的验证码通道不能动"，§23.6 写了接口和权限，§17.4 的邮件模板行和字段表第 14 条写了邮件模板；下面几处两处都没有写请求体、参数名或错误细节。前端和假后端按"暂定做法"先做，后端回复后再改。没有一处是阻塞：每一处都有能继续的最小做法。

## 一、短信渠道 `/sms/channels`

1. **凭据在请求体里叫什么、是什么类型？** 契约写"`PUT /sms/channels/{id}`（含凭据）"和"更新时凭据字段留空表示不修改"，实体列是 `credentialsEnc`（加密存储），请求字段名没有写。**暂定（已过时，见下面的现状）：** 请求体里叫 `credentials`，是一个字符串（页面里是一个密码框）。**留空时请求体里没有这个键**（不是空串，也不是 `null`）。有的短信供应商要两三个凭据（密钥和密码）；如果要结构化的值，请说明形状，页面再改成多个输入框。
   **现状（2026-11-01）：** 后端清单 W2a 说明收的是"名称到文本值"的映射，页面已改成若干行"名称 + 值"，请求体发 `{"<名称>": "<值>"}`，没有输入时不带这个键，已保存的凭据永不回显。待后端确认的几点见 `2026-10-31-admin-frontend-sms-credentials-shape.md`。 **【已答（核对于 2026-11-01）：`docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 第 169 行：`credentials` 的值必须是非 null 的文本，名称为空或值为 null 答 400 `EMPTY_NOT_ALLOWED`，不改凭据时省略该字段或发 `{}`；还没答的细节见 `2026-10-31-admin-frontend-sms-credentials-shape.md`】**
2. **`PUT /sms/channels/{id}` 是整条替换还是只改带来的字段？** **暂定：** 页面总是发完整的可编辑字段：`name`、`providerCode`、`apiUrl`、`extConfig`、`countries`、`smsType`、`priority`，加上输入了才有的 `credentials`；不带 `channelCode`（创建后不可改）和 `enabled`（有自己的 `PUT …/enabled`）。`extConfig` 为空时发 `null`，国家为空时发 `[]`。
3. **`PUT …/enabled` 的请求体。** 契约只写了路径。**暂定：** `{"enabled": true|false}`。
4. **`POST /sms/channels` 的 `enabled` 默认值。** **暂定：** 页面总是显式发 `enabled`，新建默认 `false`（新通道在凭据和测试发送确认前不会被选中）。
5. **`extConfig` 是 JSON 对象还是 JSON 字符串？** 实体里写"JSON"。**暂定：** 请求里发对象（或 `null`）；响应里对象、字符串（页面会解析）都能读。
6. **`channelCode` 的格式和长度。** 契约写"管理员指定，唯一"，回调路径 `POST /notify/sms/{channelCode}/report` 把它放在路径里。**暂定：** 页面只接受字母、数字、连字符、下划线，1 到 64 个字符（因为它进路径）。请确认，或给出真实的规则。
7. **`providers[].allowedHosts` 的匹配规则。** 契约写"`apiUrl` 的主机必须在适配器声明的白名单内"。**暂定：** 页面按主机名（小写、不含端口）精确比较，列表为空时不检查；如果条目是后缀或通配（如 `*.example.com`），请说明，否则页面会拦住后端能接受的地址。
8. **`POST /sms/channels/{id}/test` 的响应。** **暂定：** 页面不读响应，成功就提示"测试短信已发送"并关闭对话框，随后重新读 `GET /sms/meta` 得到剩余次数。手机号参数名按契约用 `mobile`，值页面原样发（去首尾空白），不改写成 E.164。号码无效时页面期望 400 `PHONE_INVALID`，当天次数用完期望 429 `RATE_LIMITED`。
9. **删除、停用、改 `smsType` 或 `countries` 被拒绝时的错误。** 契约写返回 `INVALID_REQUEST`（条件：`auth.phone_login_enabled=true` **或存在手机号账号**）。前端不显示后端的 `message`（已定：错误码已知时只显示译文），而 `INVALID_REQUEST` 的译文是"输入内容不合法"，看不出原因。**暂定：** 页面在操作前提示这两个条件，被拒绝后在译文后面加一句固定的说明。请求：这类拒绝换一个专用的错误码（如 `LAST_OTP_CHANNEL`），或在 `data.details` 里给 `ref`（`channel`）和 `reason`，页面就不必靠"操作前提示"推断原因。
10. **页面怎样知道"存在手机号账号"？** 只有后端知道。`GET /config` 只给管理员有权编辑的键，所以没有 `CONFIG:MANAGE` 的管理员也读不到 `auth.phone_login_enabled`。**暂定：** 页面操作前读 `GET /config`：读到就写明开着还是关着，读不到就写"读不到"；两种情况都写明"存在手机号账号时后端同样拒绝，本页看不到有没有"。请求：`GET /sms/meta` 增加 `phoneLoginEnabled`（布尔）和 `phoneAccountCount`（整数），页面可以在操作前直接写出结论。
11. **"最后一个覆盖的启用验证码通道"页面怎样判断？** 契约写"改 `smsType`、`countries` 使它不再是最后一个覆盖的启用 `OTP` 通道"。**暂定：** 页面读全部通道，按国家算：一个启用的 `OTP` 通道只要有一个国家没有别的启用的 `OTP` 通道覆盖，就算最后一个（空国家表示全部国家，别的通道也是空时才算覆盖了它）。读不到全部通道时一律当作最后一个，先提示。后端的算法如果不同，以后端为准（页面只决定要不要先问）。

## 二、短信模板 `/sms/templates`

1. **列表是否分页、有没有筛选。** 契约写 `GET/POST /sms/templates`、`PUT/DELETE /sms/templates/{id}`、`PUT …/enabled`。**暂定：** 和别的列表一样按 `page`、`pageSize` 分页，响应 `{items,total}`，没有筛选参数（规格 5.18 没有写模板的筛选）。
2. **请求体。** **暂定：** 创建 `{templateCode, name, smsType, locale, country, content, providerTemplateId, enabled}`（`country`、`providerTemplateId` 空时发 `null`，`country` 写成大写），更新不带 `templateCode` 和 `enabled`，`PUT …/enabled` 是 `{"enabled": true|false}`。
3. **`{code}` 缺失时的字段明细。** **暂定假后端：** 400 `INVALID_REQUEST`，`data.details` 为 `[{ref:'content', reason:'MISSING_PLACEHOLDER'}]`。`reason.MISSING_PLACEHOLDER` 现在仍不在语言文件里（真实的原因码要等后端给出，所以没有加译文），页面遇到没有译文的原因码时，字段下写"输入内容不合法"，不显示后端的 `message`。请给出真实的原因码；邮件模板缺必含项同理。
4. **改模板的 `smsType` 能不能使"最后一个启用的 `OTP` 模板"消失。** 契约只写停用和删除。**暂定：** 页面把改类型也当作需要先问的操作；后端如果不拒绝，只是多问了一次。 **【已答（核对于 2026-11-01）：`docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 第 40、101 行：创建、修改、启用、停用、删除模板，把“启用、`OTP`、`en`、不限国家”的最后一个拿掉，答 400 `INVALID_REQUEST`】**

## 三、发送记录 `/sms/records`

1. **筛选的参数名。** 契约写了筛选项的中文名，没有写参数名。**暂定：** 记录的列名：`msgId`、`vendorMsgId`、`mobile`（完整号码，精确匹配）、`channel`（`SMS`/`PUSH`）、`channelCode`、`purpose`、`sendStatus`、`deliveryStatus`；"是否已使用"是 `used`（`true`/`false`，对应 `usedAt` 是否为空）；时间范围是 `from`、`to`。请确认。
2. **时间范围的写法。** **暂定：** 和归因明细一样：ISO-8601 时刻，`from` 含、`to` 不含，按 `createdAt` 筛；页面把所选的 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，默认最近 7 个 UTC 日，页面注明是 UTC。导出文件名契约写 `sms-records-<from>-<to>.xlsx`，页面不拼名字，用响应头里的名字。
3. **号码的掩码格式。** 页面不解析、不改写，原样显示后端给的串（契约 §23.6：默认只保留末 4 位）。号码筛选页面不做归一化，只去掉首尾空白，用户要自己写成存库的格式（E.164）。请确认存库的号码不带空格，页面的说明才对。
4. **推送行的 `vendorMsgId`、`deliveryStatus`。** 契约写推送没有供应商消息 ID，`deliveryStatus` 固定 `NOT_APPLICABLE`。**暂定：** 页面对 `channel=PUSH` 的行一律显示"—"，不管后端给了什么。
5. **导出的行数上限和错误。** 页面用共用的导出按钮：超出行数（400 `INVALID_REQUEST`）时只显示译文加"缩小筛选"的提示，不显示后端的 `message`；每小时次数用完是 429 `RATE_LIMITED`。请确认导出请求用的筛选参数和列表完全一致（页面发的就是列表的参数去掉 `page`、`pageSize`）。

## 四、邮件模板 `/email/templates`

1. **`PUT` 和 `reset` 的响应。** 契约没写。**暂定：** 页面不读响应，成功后重新读 `GET /email/templates`。
2. **缺必含占位符时 400 的 `details`。** 契约写 `message` 写明缺哪个。前端不显示 `message`，所以页面在保存前自己检查（按数组里带花括号的原样字符串在正文里找，区分大小写），并在检查通过后仍被后端拒绝时只显示 `INVALID_REQUEST` 的译文。请求：缺失时给 `data.details`（`ref: 'body'`，`reason` 一个专用的原因码），页面就能显示缺哪个。
3. **正文长度、空正文。** 契约写标题 1 到 200 个字符，正文只写"必含占位符"。**暂定：** 页面要求去首尾空白后正文不为空（通则 4：必填字段去掉空白后为空 → 400），不限制长度。
4. **页面里写的占位符说明。** 页面对已知的占位符名（`code`、`minutes`、`appName`、`resetLink`、`confirmLink`、`subscriptionNotice`、`time`）在语言文件里写了一句说明，按花括号之间的名字查；不认识的占位符只列出，不写说明。必含项的检查只用 `requiredPlaceholders`，不用这些说明。

## 五、需要改共享文件的地方（写在任务报告里，不在这里）

`src/components/JsonField.tsx` 不接收表单传来的 `id`，在 `Form.Item` 里不能和标签关联，本任务的扩展配置框改用自己的文本域；`src/components/ExportButton.tsx` 的按钮文字是"导出"，规格写"导出 Excel"。这不是契约的问题，不需要后端回复。

核对于 2026-11-01

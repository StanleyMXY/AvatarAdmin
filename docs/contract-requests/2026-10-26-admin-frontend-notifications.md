# 给后端的问题：站内通知和客户端配置的参数、错误细节和限制

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 30（站内通知与客户端配置）。契约 §25.3、§25.4 写了站内通知的规则和接口，§26.1 到 §26.3 写了客户端配置的登记、规则和接口，后端回复 2 第 1 条和第 16 条写了两个读接口的字段；下面几处三处都没有写参数的格式、`data.details` 的 `ref` 和原因码、登记里的限制。前端和假后端按"暂定做法"先做，后端回复后再改。没有一处是阻塞：每一处都有能继续的最小做法。

## 一、站内通知 `/users/notifications`

1. **`GET /notifications` 的筛选参数格式。** 契约写了 `accountId`、`category`、`isRead`、`from`、`to`，没有写格式。**暂定：** `accountId` 原样（页面去首尾空白）；`category` 取 `ADMIN`、`SYSTEM_EVENT`；`isRead` 取 `true`/`false`，没选就不发；`from`、`to` 是 ISO-8601 时刻，`from` 含、`to` 不含，按 `createdAt` 筛，页面把所选的 UTC 日变成 `[第一天 00:00:00Z, 最后一天的后一天 00:00:00Z)`，页面注明按 UTC 日期，没选时间范围就都不发。分页用 `page`、`pageSize`（后端回复 2 的通则），按 `createdAt` 倒序（同一时刻再按 `id` 倒序）。请确认。
2. **`POST /notifications/send` 被拒绝时 `data.details` 的 `ref` 和原因码。** 契约写"`data.details` 列出有问题的账号"，后端说明列了原因码 `ACCOUNT_NOT_FOUND`、`ACCOUNT_NOT_ACTIVE`。**暂定（页面和假后端按这个写）：**
   - 有问题的账号：`ref` 是账号 ID 本身（和请求里写的一字不差），`reason` 是 `ACCOUNT_NOT_FOUND` 或 `ACCOUNT_NOT_ACTIVE`；整批一条都不写。
   - 收件账号列表本身：`ref: "accountIds"`，空数组 `EMPTY_NOT_ALLOWED`，有重复项 `DUPLICATE_VALUE`，超过 `notification.max_recipients` 为 `OUT_OF_RANGE`。
   - 标题和正文：`ref` 是 `titleI18n.<语言标签>` 或 `bodyI18n.<语言标签>`，`reason` 取 `EMPTY_NOT_ALLOWED`（缺 `en` 时 `ref` 是 `titleI18n.en`）、`TOO_LONG`、`INVALID_LANGUAGE_TAG`。
   - 链接：`ref: "linkTarget"`（或 `linkType`），`reason` 用契约 1.7 的原因码（`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`），页面标识不在清单里时请给一个原因码（假后端用 `INVALID_VALUE`）。
   页面遇到不认识的 `ref` 就原样列出，遇到语言文件里没有译文的原因码就写"输入内容不合法"，不显示后端的 `message`。请给出真实的 `ref` 形式和原因码。
3. **`details` 是全部有问题的账号，还是只列前若干个？** 收件人最多 1000 个，全部有问题时是 1000 条。页面把拿到的全部列出（列表框可滚动），不会写"还有 N 个"；如果后端会截断，请在 `data` 里给总数（如 `data.total`），页面再写"另有 N 个"。
4. **没有链接时页面不发 `linkType` 和 `linkTarget`**（契约请求写 `linkType?, linkTarget?`）。请确认省略等于 `NONE`。
5. **语言标签区分大小写吗？** 页面要求英文那一项的键正好是小写 `en`，其他语言的标签按输入原样发，同一次里大小写不同的两个标签（`th` 和 `TH`）页面当作重复，不让加。请确认后端是否把 `EN` 当作 `en`。
6. **一种语言只写了标题或只写了正文。** 契约写 `titleI18n`、`bodyI18n` 各自含 `en`，没有写两边的语言集合必须相同。**暂定：** 页面要求每个添加的语言标题和正文都要填（不需要这种语言就移除它）。如果后端允许只写标题，客户端对没有正文的语言怎么取，请说明。
7. **收件账号 ID 的写法。** 页面只做：每行去首尾空白（契约 1.9 的 29 个码点）、去掉空行、同一个 ID 只留第一次出现；不检查 ID 的格式，大小写不同的两行当作两个不同的 ID。请确认后端的 ID 是否区分大小写（如果不区分，`ABC` 和 `abc` 会被后端当作重复，整批 400）。
8. **`GET /notifications/{id}` 的 `templateParams`。** 页面把它当作 JSON 对象，用缩进的 JSON 显示；不是对象时按文字显示。`sentByUsername` 在系统事件里为 `null`，在运营发送的消息里发送人账号被删除时也为 `null`：页面靠 `category` 区分，系统事件写"系统"，运营发送的写 `sentBy` 的前 8 个字符。

## 二、客户端配置 `/config/client`

1. **`PUT /client-config/{key}` 和 `POST …/reset` 的响应。** 契约没写。**暂定：** 页面不读响应，成功后重新读 `GET /client-config`。
2. **`PUT` 被拒绝时 `data.details` 的 `ref`。** 契约写"`data.details` 指出是哪个语言的值"，1.7 的例子是 `{"ref":"en","reason":"INVALID_PATH"}`。**暂定：** `ref` 是 `values` 里语言键本身，**默认值是空字符串 `""`**（假后端和页面都按这个写，页面把 `ref: ""` 放到"默认"页签下）。请确认空字符串的 `ref` 会原样到前端。原因码：
   - 值不合法：契约 1.7 的链接原因码、`EMPTY_NOT_ALLOWED`（`URL`、`EMAIL` 的空值）、`INVALID_EMAIL`、`NOT_BOOLEAN`、`NOT_AN_INTEGER`、`OUT_OF_RANGE`、`TOO_LONG`；
   - `localized` 为否的键提交了非空语言键：假后端用 `ref: <那个语言键>`、`reason: INVALID_LANGUAGE_TAG`，请给真实的原因码；
   - `inviteShareText` 含其他 `{…}` 占位符、`inviteLinkBase` 带查询或片段：契约写 `INVALID_REQUEST`，没有写原因码，假后端分别用 `INVALID_PLACEHOLDER` 和 `INVALID_PATH`，请给真实的原因码。
   语言文件里没有译文的原因码，页面写"输入内容不合法"。
3. **登记里每个键的限制不在 `GET /client-config` 里。** 整数的范围、文字的最大长度（`inviteShareText` 500、`inviteShareTitle` 200）、`inviteShareText` 的可用占位符、`inviteLinkBase` 不能带查询或片段，都只在契约 §26.2 的文字里。**暂定：** 页面只按类型检查（`URL` 按 1.7、`EMAIL` 格式、`BOOLEAN`、`INT` 是整数、`STRING` 是文字），这些限制写在各键的"说明"文字里，超限时由后端拒绝，页面按第 2 条把原因放到那个语言的页签下。请求：`GET /client-config` 每项加上 `min`、`max`（`INT`）、`maxLength`（`STRING`）、`placeholders`（允许的占位符名），页面就能在输入时检查，不必等后端。
4. **同时编辑会丢数据。** `PUT` 是整体替换这个键的全部语言值，请求里没有"我读到的版本"。两个管理员同时打开同一个键，后保存的那个会把先保存的那个新加的语言删掉，没有任何提示。**暂定：** 页面在保存前重新读取这个键，和打开时的 `updatedAt` 比较，不一致就不保存并提示"已被他人修改"（读和写之间仍有很小的时间窗，见 `2026-10-27-admin-frontend-concurrent-save.md`）。请求：`PUT` 接受 `expectedUpdatedAt`（取 `GET` 里该键的 `updatedAt`，没有行时为 `null`），与库里最近更新时间不同时返回 409 `INVALID_STATE`，页面把 409 按同一个提示处理。
5. **只读键的来源。** 页面写"由 `auth.phone_login_enabled` 配置决定，在系统配置里改"，系统配置键的名字现在写在语言文件里（`clientConfig.<键>.source`，六个键），因为 `GET /client-config` 没有给。请求：`readOnly` 为真的键加一个 `source` 字段（系统配置的键名），页面就不用自己存这份对应表。
6. **`EMAIL` 的格式规则。** 契约只写"邮箱格式"。**暂定：** 页面检查去首尾空白后不超过 254 个字符、恰好一个 `@`、`@` 前后都不空、`@` 后面有一个点、没有空白。请给后端的真实规则。
7. **预览是页面按契约 1.2 和 26.1 算的。** 页面只算"一个请求语言"（预览里选的那个标签）的结果，按契约的文字：先完整匹配（不区分大小写），再按主语言子标签匹配，同一主语言有多个条目时先取"是请求标签前缀"的，再按文字变体筛选（只对 `zh` 推断，`TW`、`HK`、`MO` 取 `Hant`），最后取"列表里靠前的第一个"，没有就取该键不带语言的值，再没有就取登记的默认值。"列表里靠前"页面按标签的字母顺序理解，契约没有说这个列表按什么排序，请确认。如果要让预览和客户端实际收到的完全一致，请求：`GET /client-config/preview?acceptLanguage=…` 返回后端按同一份缓存和同一个算法算出的该键的值与来源，页面直接显示，不再自己算。
8. **`STRING` 的空字符串是一个合法的值**（契约 26.1），页面允许保存，没有额外提示。对 `localized` 的键，某个语言保存成空字符串，客户端会拿到空文案而不是回退到默认值；页面用"移除这种语言的值"让该语言回到默认值，说明文字里写了这一点。

核对于 2026-11-01

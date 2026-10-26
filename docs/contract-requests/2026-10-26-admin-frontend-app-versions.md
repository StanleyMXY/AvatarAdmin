# 给后端的问题：应用版本和渠道包的列表形状、字段名、请求体和错误细节

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 29（应用版本与渠道包）。契约 §24.1 写了版本的列，§24.2 写了状态机、校验和接口路径，§24.7 写了渠道的列和接口；下面几处两处都没有写响应形状、字段名、请求体或错误细节。前端和假后端按"暂定做法"先做，后端回复后再改。没有一处是阻塞：每一处都有能继续的最小做法。

## 一、渠道包 `GET /channels`、`POST /channels`、`PUT /channels/{code}`

1. **列表的字段名是 `code` 还是 `channelCode`？** 契约 §24.7 的 `Channel` 实体列是 `code`，后端回复说响应字段按实体列名一字不差。但任务 9（统计筛选里的渠道下拉，`src/services/channels/getChannels.ts`）按 `channelCode` 读，并把没有 `channelCode` 的行丢掉；如果真后端返回的是 `code`，那些下拉会是空的。**暂定：** 本任务的渠道包页和版本页两个都读（先 `code`，没有再 `channelCode`），假后端两个都给。请确认字段名（`updatedAt` 也请确认有）。
2. **`data` 是 `{"items":[…]}` 还是裸数组？分不分页？** 任务 9 的问题文件已问过形状，这里补一条：渠道包页没有分页，把读到的行全部显示；如果后端分页（默认 20 条），超过 20 个渠道时页面会少显示。**暂定：** 不分页。
3. **`POST /channels` 的请求体和响应。** 契约只写了字段含义。**暂定：** 请求体 `{code, name, platform, distribution, packageName}`，`packageName` 为空时发 `null`；创建后默认启用（前端不发 `enabled`）；响应不读，成功后重新读列表。
4. **`PUT /channels/{code}` 是整条替换还是只改带来的字段？** 契约写"只能改 `name`、`packageName`、`enabled`"。**暂定：** 前端每次都发这三个字段（改名和包名时带着列表里的 `enabled`，用开关改启用时带着列表里的名称和包名），这样两种理解都行；缺点是用的是页面上一次读到的值。请确认哪一种，以及只发 `{"enabled":false}` 是否可以（那样就不会覆盖别人刚改的名称）。
5. **长度和格式。** 契约只给了渠道码的格式（`^[a-z0-9_-]{2,32}$`）。**暂定：** 名称不限长度（只要求去首尾空白后不为空）；包名可以为空，不为空时只收字母、数字、点、连字符、下划线（Android 的 `applicationId` 和 iOS 的 bundle ID 都在这个范围内）。请给真实的长度上限和包名规则，页面再对齐。
6. **错误的细节。** 渠道码重复：假后端和页面按 409 `DUPLICATE_RESOURCE`、`data.field = "code"`；渠道码是 `unknown`、渠道码格式不对、`IOS` 加 `DIRECT`：400 `INVALID_REQUEST`，`details` 的 `ref` 分别是 `code`、`code`、`distribution`；要改渠道码、平台、分发方式：400，`ref` 是被改的字段。请确认 `ref` 和原因码（页面不显示后端的 `message`，只显示错误码和原因码的译文）。

## 二、版本 `GET /app-versions`、`GET /app-versions/{id}`

1. **列表分不分页，`data` 的形状？** 契约写了查询参数 `channelCode`、`platform`、`status`，没有写 `page`、`pageSize`，也没有写响应。**暂定：** 前端发 `page`、`pageSize`（10、20、50、100）；读到 `{items,total}` 就用后端的页；读到裸数组、没有 `total` 的页、或比 `pageSize` 长的页，就当作整张表，在浏览器里切页。请确认。
2. **行里有哪些字段。** 契约 §24.1 的列加后端回复的 `…Username` 规则：`createdByUsername`、`activatedByUsername`（管理员已删除时为 `null`）。**暂定：** 行里有 `apkUrl`、`apkSizeBytes`、`apkSha256`（契约说 `apkUrl` 不存、由 `apkUploadId` 拼出，但列表要显示文件大小和 SHA-256 前 8 位，所以请确认这三个字段在列表行和详情里都有），STORE 渠道这三个为 `null`，DIRECT 渠道的 `storeUrl` 为 `null`。`changelog` 是对象，键是语言代码（`en`、`zh-Hans`…）。
3. **"生效中的排前面"。** 契约 §24.2 写了默认排序。页面在拿到的一页内再把生效中的排到前面（稳定排序，别的保持后端的顺序），不改变后端的顺序。
4. **某个渠道当前生效的版本。** 页面用 `GET /app-versions?channelCode=<码>&status=ACTIVE` 读，取其中 `status=ACTIVE` 且 `channelCode` 相同的一行，只当提示。请确认这样读是对的（页面需要 `APPVERSION:VIEW`，和列表一样）。

## 三、版本的写：`POST /app-versions`、`PUT /app-versions/{id}`、`PUT …/status`、`DELETE`

1. **请求体。** **暂定：** 创建 `{channelCode, versionName, versionCode, minVersionCode, changelog, storeUrl 或 apkUploadId}`；STORE 渠道只带 `storeUrl`，DIRECT 渠道只带 `apkUploadId`，页面不会同时带两个，也不带 `apkUrl`、`apkSizeBytes`、`apkSha256`；`changelog` 里去掉了空白的语言；修改同样，不带 `channelCode`；编辑 DIRECT 草稿时没换文件也带当前的 `apkUploadId`（契约说这视为无变化）。`PUT …/status` 是 `{status, confirmStoreLive?}`，只有 STORE 渠道激活时带 `confirmStoreLive: true`。响应页面不读，成功后重新读列表。
2. **数字的范围。** 契约只写了整数、≥ 1。**暂定：** 页面接受 1 到 2^53−1 的整数。请给 `versionCode`、`minVersionCode` 的上限（Java 的 `int`？2100000000？），页面加上限。
3. **更新说明的限制。** 契约写必须有 `en`。**暂定：** 页面不限制每种语言的长度，也不限制语言个数，语言代码用 `GET /meta` 的 `supportedLocales` 加上英文加上这条版本已有的。请给每种语言的长度上限，以及非 `supportedLocales` 的语言代码后端收不收。
4. **字段错误怎么指到字段。** 页面不显示后端的 `message`，只显示错误码和 `details[].reason` 的译文，所以请在 400 `INVALID_REQUEST` 里给 `data.details`，`ref` 是请求体的字段名：`versionName`、`versionCode`（不大于生效版本时）、`minVersionCode`、`storeUrl`、`changelog`（缺 `en`）、`apkUploadId`、`confirmStoreLive`（STORE 激活没带）、`channelCode`（渠道不存在）。`reason` 请用语言文件里已有的（`EMPTY_NOT_ALLOWED`、`OUT_OF_RANGE`、`INVALID_PATTERN`、`NOT_AN_INTEGER`、`TOO_LONG`、链接规则的五个码），要新增的请告诉我们，由负责共享语言文件的会话加译文。`storeUrl` 不符合 Android 或 iOS 的规则时，请给一个专用的原因码（现在页面在提交前自己检查并给出具体原因，后端拒绝时只能显示"输入内容不合法"）。
5. **激活 DIRECT 渠道的版本时文件校验失败。** 契约写"否则 `INVALID_REQUEST`"。请给 `details`（`ref` 是 `apkUploadId`，`reason` 是"文件不存在"或"校验和不一致"的专用码），页面才能告诉运营是哪一种。
6. **409 `INVALID_STATE` 有几种原因。** 版本不是草稿（`data.status` 是它的状态）、渠道已停用、上传记录已被别的版本使用，都是 409 `INVALID_STATE`。页面靠 `data.status` 是不是 `DRAFT`、`ACTIVE`、`ARCHIVED` 来区分"版本状态不对"和"上传不能用"，渠道已停用和上传已被使用分不开。请给 `data.status` 一个确定的取值（例如渠道停用是 `CHANNEL_DISABLED`，上传已使用是 `UPLOAD_USED`），或在 `data.details` 里给 `ref`。现在的做法：请求带了新上传的文件时，409 且 `data.status` 不是版本状态，就提示重新上传，同时显示 409 的译文。
7. **`(channelCode, versionCode)` 重复。** 契约写"数据库拒绝"。**暂定：** 409 `DUPLICATE_RESOURCE`，`data.field = "versionCode"`；页面把译文放到版本号字段下面。请确认（现在假后端这样做；先于"不大于生效版本"的检查还是之后，请一并说明）。
8. **商店链接检查用的包名。** 契约写 Android 的 `id` 等于环境变量 `GOOGLE_PLAY_PACKAGE_NAME`。页面只知道渠道包的 `packageName`（`play` 预置行由同一个环境变量填，但运营可以改）。**暂定：** 页面用所选渠道包的 `packageName` 对照；渠道没有包名时只检查 `id` 像不像应用包名。请确认后端用的是哪一个；如果以环境变量为准，请把它放进 `GET /meta`（不含机密），页面就不会和后端不一致。
9. **iOS 链接。** 契约写主机 `apps.apple.com`，路径形如 `/<国家码>/app/<名称>/id<数字>` 或 `/app/id<数字>`，并说这个形状没有核实。真实的 App Store 链接也有 `/us/app/id<数字>`（没有名称）和带 `?l=th` 之类查询参数的。**暂定：** 页面严格按契约的两种路径，查询参数和片段不限制（只要过链接规则）。请确认后端是否收 `/us/app/id<数字>` 和查询参数。

## 四、APK 上传 `POST /uploads/apk`

1. **失败的原因。** 规格 5.19 写"文件没有 v2 以上签名时显示后端的错误原因"。已定的规则是错误码已知时只显示译文，而 `INVALID_FILE` 只有一条译文（"文件为空、超出大小限制或类型不支持"），没有"缺少 v2 以上签名"。**暂定：** 上传区旁常驻一句"文件必须带 v2 及以上的签名"，失败时显示 `INVALID_FILE` 的译文，以及 `data.details` 里每条原因的译文（有的话）。请求：缺签名时给 `details: [{"ref":"file","reason":"<专用码>"}]`，并告诉我们码，由负责共享语言文件的会话加译文。
2. **503。** `upload.public_base_url` 没配置时返回 503 `DEPENDENCY_UNAVAILABLE`（后端说明里写了）。页面已按此提示"先在系统配置里设置 `upload.public_base_url`"，持有 `CONFIG:MANAGE` 的管理员带链接到 `/config`。请确认这个状态码对 APK 上传一定是 503，不会是别的。
3. **响应。** 契约写 `{"uploadId","apkUrl","apkSizeBytes","apkSha256"}`。页面只读这四个；`apkUrl` 页面只显示为文字，不做成链接。

## 五、规格需要在 main 上修改的地方

1. 5.19 DIRECT 的 APK 上传一句"文件没有 v2 以上签名时显示后端的错误原因"：与已定的"错误码已知时只显示译文"冲突，要么后端给专用的原因码并加译文，要么改成"显示 `INVALID_FILE` 的译文并在上传区旁写明需要 v2 以上签名"（现在页面是后者）。
2. 5.19 的"预置三行"一句里，渠道包的字段名在契约里是 `code`，任务 9 的读取和问题文件写的是 `channelCode`，见第一节第 1 条。

## 六、需要改共享文件的地方（写在任务报告里，不在这里）

`src/components/UploadField.tsx` 不把上传失败告诉页面，也不能藏掉表单里重新露出来的原生"选择文件"框，本任务在自己目录里放了一份 `ApkUpload`；`src/services/channels/getChannels.ts` 和 `mock/channels.mock.ts` 的字段名见第一节第 1 条。这不是契约的问题，不需要后端回复。

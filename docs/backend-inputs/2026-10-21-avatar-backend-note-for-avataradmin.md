# 给 AvatarAdmin 会话的说明：后端定下来的接口

> **写给：** AvatarAdmin 会话（管理端前端的计划和之后的代码）。
> **规则：** AvatarAdmin 还没有代码，后端和你们有差异时改你们这边。契约和管理端前端设计只在 AvatarApp `main` 上改，你们不改它们。
> **只读这一份就够。** 下面是契约和管理端前端设计没有定、后端已经定下的接口，以及已经改好的共享文档里你们要重读的部分。

## 一、先重读（AvatarApp main 上已改好，本地提交，未推送）

- **管理端前端设计 `docs/admin-frontend-design.md`**：订阅管理页的权限（页面入口 `SUBSCRIPTION:VIEW`，重处理和确认用 `SUBSCRIPTION:GRANT`，写配置用 `SUBSCRIPTION:CONFIG`）；内容审核详情页的内容区只对持有 `MODERATION:REVIEW` 的管理员显示；服装读取 `GET /accounts/{id}/cosmetics` 用 `COSMETIC:GRANT`，用户详情页的服装列表仍走 `GET /accounts/{id}/avatars`；`GET/PUT /config/{key}` 改成 `GET /config` 加 `PUT /config/{key}`；权限表补了 `USER:EMAIL_VIEW`、`USER:PHONE_VIEW`、`MEMORY:MODEL_REGISTER`、`MEMORY:MODEL_ASSIGN` 和正文里有而表里没有的接口；邮件模板是 5 个、告警类型是 14 个；删掉表情曲线上传和动作种类；删掉"不做签到和观看任务"。另加一句规则：管理端不设置只读账号，建角色时每个模块的查看权限和该模块的操作权限一起授予。
- **契约里与管理端有关的新增或改动**：
  - 游客额度统计 `/stats/guest/quota` 的 `buckets` 每档是 `{"devices":n,"converted":n}`。
  - 管理员读投诉证据：`GET /likeness-complaints/{id}/evidence/{index}`，`index` 从 0 起，权限 `COMPLAINT:VIEW`，返回 `{"url":"<短时效签名地址>","mediaType":"image/jpeg"}`，每次读取写审计日志，越界 404 `RESOURCE_NOT_FOUND`。
  - `GET /users/export` 要同时有 `USER:EXPORT` 和 `USER:VIEW`。
  - 错误响应 `INVALID_REQUEST` 的 `data.details` 是 `[{ref, reason}]`，`reason` 是代码：`ACCOUNT_NOT_FOUND`、`ACCOUNT_NOT_ACTIVE`、`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG`、`INVALID_EMAIL`、`NOT_AN_INTEGER`、`OUT_OF_RANGE`、`NOT_BOOLEAN`、`INVALID_LANGUAGE_TAG`、`EMPTY_NOT_ALLOWED`；人看的英文说明在 `message` 里。
  - 新错误码：405 `METHOD_NOT_ALLOWED`、415 `UNSUPPORTED_MEDIA_TYPE`、503 `DEPENDENCY_UNAVAILABLE`（必需的依赖或配置此刻不可用）、503 `TEMPORARILY_UNAVAILABLE`（请求合法、稍后重试会得到结果）。
  - 新配置键：`app.display_name`（默认 `AvatarApp`，邮件里的产品名）、`upload.public_base_url`（无默认值，广告素材和 APK 的对外基址，没配置时 `POST /ads/media` 和 APK 上传返回 503 `DEPENDENCY_UNAVAILABLE`，所以配置页要提示先配它）。两个键都会出现在 `GET /config` 里，编辑权限 `CONFIG:MANAGE`。

## 二、后端定下的接口（你们的计划按它改）

**1. 文件上传：先上传、后创建，创建和修改只认 `uploadId`。** 新增三个上传接口，都是 `multipart/form-data`、字段 `file`，响应 `data.uploadId`；空文件、超限、按内容判出的类型不符都是 400 `INVALID_FILE`；每次上传写审计日志；用不上的上传按 `upload.orphan_hours` 清理。
- `POST /uploads/catalog-image`（`COSMETIC:MANAGE` 或 `ACTION:MANAGE`）：服装、背景的预览图和动作图标，JPEG 或 PNG，不超过 2 MiB。
- `POST /uploads/renderer-model`（`RENDERER:MANAGE`）：渲染模型，zip，不超过配置键 `upload.render_asset_max_bytes`（默认 100 MiB），必须含 `manifest.json`。
- `POST /uploads/default-avatar-source`（`DEFAULT_AVATAR:MANAGE`）：有肖像授权的源图，JPEG 或 PNG；服务器处理后仍大于 19,000,000 字节返回 400 `INVALID_FILE`。
- 创建或修改时 `uploadId` 的错误：种类不符 400 `INVALID_REQUEST`，已被别的对象用了 409 `INVALID_STATE`，不存在 404 `RESOURCE_NOT_FOUND`。
- 已有的上传不变：广告素材 `POST /ads/media`、APK `POST /uploads/apk`、推送图片 `POST /uploads/image`。

**2. 目录、动作、渲染模型、声明的请求写法。** 文件字段传 `uploadId`，字段名同实体列名：
- `POST/PUT /cosmetics` 用 `previewUploadId`；`POST/PUT /actions` 用 `iconUploadId`。
- `POST /renderer-models` 是 JSON：`uploadId`、`rendererKind`、`version`、`platform`、`abi`、`rendererFormatVersion`、`minVersionCode`；`sha256`、`sizeBytes` 取自上传记录，请求里带了会被忽略。
- 上下架：`PUT /cosmetics/{id}/enabled {enabled}`、`PUT /actions/{id}/enabled {enabled}`、`PUT /renderer-models/{id}/enabled {enabled}`。
- 声明：`GET /declarations`、`POST /declarations {version, texts}`、`PUT /declarations/{version}/activate`。
- 动作补生成：`POST /actions/{id}/backfill`，响应 `{"scheduled":N}`（本次建的任务数）；动作不存在 404 `RESOURCE_NOT_FOUND`，已停用 409 `INVALID_STATE`；只对风格适用且缺片段或片段 `FAILED` 的外观补，重复调用只补还缺的。
- 其余请求体字段名同第 18 章该实体的列名，响应按 17.4 通则（第 18 章的列，去掉以 `Hash`、`Enc` 结尾的列）。

**3. 系统默认数字人**，权限 `DEFAULT_AVATAR:MANAGE`：
- `GET /default-avatars`（每行带 `status`）、`POST /default-avatars`（JSON：`name`、`style`、`sourceUploadId`）、`PUT /default-avatars/{id}`（只改名 `{name}`）、`POST /default-avatars/{id}/generate`、`POST /default-avatars/{id}/activate`、`DELETE /default-avatars/{id}`。
- 状态：`DRAFT` → `GENERATING` → `READY` → 生效（`isActive`）。`generate` 只对 `DRAFT` 有效；`activate` 要求 `READY`；同一时刻只有一个生效，激活新的时旧的变成非生效但保留；只有非生效且不在生成中的才能删。违反状态一律 409 `INVALID_STATE`。生成的前置配置没配好返回 503 `GENERATION_NOT_CONFIGURED`。
- `POST /default-avatars` 不收 `portraitAuthorized`：肖像授权由运营负责，契约没有这个字段。管理端界面上的确认框可以保留，只是界面。

**4. `/config`。**
- `GET /config` 响应 `data` 是 `{"items":[{"key","value","defaultValue","editPermission","updatedAt","updatedBy"}]}`，不分页，按键名升序。**只含当前管理员有权编辑的键**（契约 17.4），所以不会有只读行；`value` 在没有默认值又未配置时是 `null`，`updatedAt`、`updatedBy` 在库里没有该键的行时是 `null`。
- `PUT /config/{key}` 请求体 `{"value":<JSON 值>}`，响应 `{"key","value","warnings":[{"code","message","count"}]}`，`warnings` 不拦截保存，`count` 只有 `PHONE_LOGIN_DISABLED_ACCOUNTS` 带。
- `DELETE /config/{key}` 清除这个键、回到代码里的默认值，响应形状同 `PUT`（`value` 是默认值，`warnings` 为空数组）。
- 三个接口里键不存在 404 `RESOURCE_NOT_FOUND`，没有该键的编辑权限 403 `ADMIN_FORBIDDEN`，值不合法 400 `INVALID_REQUEST`，`data.details` 的 `ref` 是键、`reason` 是上面的代码。

**5. 归因。**
- `GET /attribution/records?source=&matchType=&from=&to=&page=&pageSize=`：`source` 取 `APPSFLYER`、`SELF`，`matchType` 取 `APK_BLOCK`、`REFERRER`、`FINGERPRINT`，不在范围内 400；`from` 含、`to` 不含，ISO-8601 时刻，按 `eventTime` 筛；响应 `{"items":[…],"total":N}`，按 `eventTime` 倒序；每项字段：`id`、`source`、`eventName`、`eventTime`、`conversionType`、`campaignType`、`mediaSource`、`campaign`、`adset`、`ad`、`installTime`、`isRetargeting`、`platform`、`countryCode`、`appVersion`、`cost`、`costCurrency`、`costModel`、`costInSelectedCurrency`、`accountId`、`registeredAt`、`matchType`、`attributionCampaignId`。设备和 AppsFlyer 的标识不返回。
- `GET /attribution/summary?groupBy=source|media_source|campaign&from=&to=`：`groupBy` 必填；`from`、`to` 是 `YYYY-MM-DD`（UTC 日，含两端），不传取最近 7 天，跨度超过 `stats.max_range_days` 返回 400；响应 `{"items":[{"source","key","installs","activations","costs":[{"currency","amount"}]}]}`，不分页，两个来源分列不相加，`costs` 按币种分别求和、不跨币种。早于事件保留期的安装，`activations` 会偏低。
- 另外：直装渠道的非 Android 下载点击不记录；归因日汇总随当天刷新（每 15 分钟），不是一天一次。

**6. 内容审核。** `GET /moderation/records/{id}/content` 的 `FILE` 响应在有配套文本时多一个 `text` 字段：`{"kind":"FILE","mediaType":"audio/wav","url":"…","text":"<转写文字>"}`，目前只有声音样本带转写；没有配套文本就没有这个字段。内容区要在播放器下方显示这段文字。`TEXT` 响应不变。

**7. 广告（应用内播放的广告，不是买量投放）。**
- 风险警告 `warnings` 的形状 `{code, message}`，`count` 只有 `PHONE_LOGIN_DISABLED_ACCOUNTS` 带，和你们计划里的一致，不用改。
- 广告报表的六个接口（`/ads/report/overview`、`/by-placement`、`/by-campaign`、`/by-creative`、`/by-country`、`/nofill`）除了 `from`、`to`、可选的 `platform`，都多一个可选参数 `channelCode`：不传 = 全部渠道，传了只含该渠道（可以传 `unknown` 看没带渠道的数据），格式不合格 400 `INVALID_REQUEST`。响应形状不变。广告报表页请加一个渠道下拉（全部、各渠道码、`unknown`）。管理端前端设计里的这一页由契约会话同步改。
- 渠道下拉的渠道码取自 `GET /channels`（任何登录的管理员可调）。
- 广告报表的导出 `GET /stats/export/ads-report` 带页面上同样的筛选（`from`、`to`、`platform`、`channelCode`），所见即所得：选了渠道再导出，导出的就是该渠道的数据。
- `/ads/report/nofill` 的响应是 `[{statDate, slotKey, reason, cnt}]`，没有平台和渠道列；不传筛选时是全部平台、全部渠道的合计，要分开看用页面上的筛选。管理端前端设计里“无广告原因分布”表原来的“平台”列由契约会话删掉。

## 三、你们回复后端的事

没有需要回复的。你们的计划按上面改完后，如果发现某个接口你们需要而这里没有，告诉后端，不要自己猜。

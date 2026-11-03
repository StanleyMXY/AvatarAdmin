# 新差异请求：c4 组（2026-11-03）

范围：任务配置的 `hasRecords`（请求 37）、广告位读取权限和 `GET /ads/meta` 的 `creativeAspectTolerancePercent`（40）、`notSkippableFullScreenCount`（122）、应用版本 409 的 `data.status`（47）、应用版本写接口 400 的 `details`（92）。后端实现说明和更新接口文档里查不到的细节如下；前端当前都按各条末尾的“最小做法”开发，不阻塞。

## 1. 应用版本 400 的 `details`：接口文档没有逐项写的几种情形，`ref` 和 `reason` 取什么

更新接口文档 3926 行写了“版本写入里由请求字段引起的 400 都带 `data.details`”，并列了 `ref` 和 `reason` 的取值范围，但下面这些具体情形没有说各自对应哪一个。假后端目前这样做（页面不依赖，只按返回的 `ref` 和 `reason` 显示）：

| 情形 | 假后端现在返回 | 依据 |
|---|---|---|
| 版本号不大于该渠道其他版本的最大值（创建、编辑草稿；激活时不大于生效过的版本） | `[{ref:"versionCode", reason:"OUT_OF_RANGE"}]` | 3926 行只写“`message` 写明 `versionCode`”，没写是否带 `details`；按“由请求字段引起的 400 都带”推断 |
| 更新说明某种语言的文字为空白 | `[{ref:"changelog.<语言键>", reason:"EMPTY_NOT_ALLOWED"}]` | 3926 行：“更新说明的某个语言出错时是 `changelog.<语言键>`” |
| 更新说明某种语言的文字超过 4000 个码点 | `[{ref:"changelog.<语言键>", reason:"OUT_OF_RANGE"}]` | 同上，“大小不允许”按 `OUT_OF_RANGE` |
| 更新说明某种语言的值不是字符串 | `[{ref:"changelog.<语言键>", reason:"INVALID_FORMAT"}]` | 112 行：`INVALID_FORMAT` 是“值的 JSON 类型不对” |
| 更新说明超过 30 种语言 | `[{ref:"changelog", reason:"OUT_OF_RANGE"}]` | 推断 |
| 更新说明不是对象 | `[{ref:"changelog", reason:"INVALID_FORMAT"}]` | 推断 |
| 更新说明里没有 `en` | `[{ref:"changelog", reason:"EMPTY_NOT_ALLOWED"}]` | 沿用旧做法 |
| `versionName` 为空白 / 不是 `x.y.z` | `EMPTY_NOT_ALLOWED` / `INVALID_FORMAT` | 112 行写了 `versionName` 不是 `x.y.z` 为 `INVALID_FORMAT`；空白推断 |
| 商店链接为空（STORE 渠道） | `[{ref:"storeUrl", reason:"EMPTY_NOT_ALLOWED"}]` | 推断 |
| 商店链接的 Play 包名 `id` 与包名不符、带了不允许的查询键、参数重复、`hl`/`gl` 值不合格、iOS 路径形状不对 | `[{ref:"storeUrl", reason:"OUT_OF_RANGE"}]`（主机不对 `INVALID_HOST`，端口 `INVALID_PORT`，路径不是 `/store/apps/details` 为 `INVALID_PATH`，非 https `NOT_HTTPS`，过长 `TOO_LONG`） | 3926 行只说 `storeUrl` 用 1.7 的链接原因代码；包名不符等 1.7 没有的情形没写原因 |
| DIRECT 渠道带非空 `storeUrl` | `[{ref:"storeUrl", reason:"OUT_OF_RANGE"}]` | 推断 |
| STORE 渠道带 `apkUploadId`；上传记录的 `kind` 不是 `APK` | `[{ref:"apkUploadId", reason:"OUT_OF_RANGE"}]` | 3926 行写了 `INVALID_REQUEST`，没写 `reason` |
| DIRECT 渠道没带 `apkUploadId` | `[{ref:"apkUploadId", reason:"EMPTY_NOT_ALLOWED"}]` | 推断 |
| `versionCode` 或 `minVersionCode` 超过 2147483647 | 400，`data` 为 `null`（读不进请求体） | 后端的回答第 91 条说没有运行确认；接口文档没写它算不算“由请求字段引起” |

- 前端现在：按返回的 `ref` 把原因放在对应的表单项下面，`changelog.<语言键>` 放在那种语言的更新说明下面，`status`、`confirmStoreLive`、`apkUploadId` 等对不到表单项的显示在表单底部，写出字段名；不认识的 `reason` 显示原因码本身；`data` 为 `null` 的 400 只显示通用句，不读 `details`。
- 想请后端确认：上表每一行的 `ref` 和 `reason`；以及超过 32 位整数的版本号是 `OUT_OF_RANGE` 的 `details` 还是读不进请求体的 `data: null`。

## 2. 应用版本 409 的 `data.status`：渠道已停用时，编辑草稿和删除草稿会不会也返回 `DISABLED`

- 接口文档 3924 行：“渠道已停用（24.7）的 409 `data` 为 `{"status":"DISABLED"}`”；后端实现说明第三节 47 号行写“渠道已停用时为 `DISABLED`”。没有写是哪几个操作检查渠道是否停用。
- 前端现在：假后端只在新建版本和激活时检查渠道是否停用（计划里写的“版本编辑不检查渠道是否停用，只有新建和激活”），页面对任何操作的 409 都按 `data.status` 显示，不依赖是哪个操作。
- 想请后端确认：编辑草稿、删除草稿、下线（`ARCHIVED`）在渠道已停用时会不会返回 409 `DISABLED`。不需要回答也能继续。

## 3. 任务配置 `POST` 不带 `status` 时的默认值：假后端和接口文档不一致（遗留，不是这次引入）

- 接口文档 4255 行：“`POST /tasks/configs` ……`status` 缺省 = `DISABLED`”。假后端 `mock/activity.mock.ts` 的创建一律是 `ENABLED`。页面创建任务时不带 `status`，所以真实后端上新建的任务是已停用，假后端上是已启用。
- 前端现在：没有改假后端（这次请求 37 只涉及 `hasRecords`），页面也没有依赖这个默认值。记在这里，供负责人决定是否同一批改假后端。

## 4. `GET /ads/meta` 的 `creativeAspectTolerancePercent` 和 `GET /meta` 的同名字段

- 后端实现说明 40 号、67 号都说了这个值：`GET /ads/meta`（任一 `ADS:*` 权限）和 `GET /meta`（任一管理员）各有一份，取自同一个配置键。
- 前端现在：素材页读 `GET /ads/meta` 的那一份（请求 40 的写法，只有 `ADS:CREATIVE` 的管理员也读得到）；读不到时素材表单不预检宽高比（规格的短边和大小仍预检），提交后按后端的 400 显示。`GET /meta` 的字段由处理请求 67 的那一组接入，两处不会冲突。
- 不需要后端回答。

## 5. `GET /ads/meta` 的 `notSkippableFullScreenCount` 在读取失败时

- 接口文档 3717 行定义了计数的口径，没有写读不到时页面该怎么办（当然是页面自己的事）。
- 前端现在：`ads.force_close_seconds` 为 0 且计数读不到（请求失败或不是非负整数）时，显示“强制可关闭兜底为 0，开屏或插屏下不可跳过的素材没有关闭按钮；刚才没能核对有多少条”，不静默。
- 不需要后端回答。

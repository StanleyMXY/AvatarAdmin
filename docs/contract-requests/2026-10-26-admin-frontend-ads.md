# 给后端的问题：应用内广告后台接口的请求体、列表形状、权限缺口和几处规则的细节

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 27（应用内广告）。契约 §22.2 到 §22.10、规格 5.17 和后端第一份回复的第 9 条、第 18 条已经给出广告位、数据模型、状态机、校验规则、报表字段和下拉选项的权限；下面几处它们都没有写清，前端和假后端按"暂定做法"先做，后端回复后再改。没有一条阻塞本任务。

## 一、五组资源的列表和单个对象的形状

契约 §22.9 只写了接口，没有写列表响应的形状和每个对象的字段（报表行除外，那是后端回复第 18 条）。

**问：**
1. `GET /ads/campaigns`、`/ads/units`、`/ads/creatives` 是不是 `{"items":[…],"total":N}`；`GET /ads/placements`（四行，不分页）是不是 `{"items":[…]}`？
2. 对象的字段是不是 §22.3 里的列名，管理员 ID 旁带 `…Username`（计划有 `createdByUsername`、`updatedByUsername`，素材有 `createdByUsername`、`reviewedByUsername`，后端回复第 3 条已经说过）？
3. 素材行里的 `type`、`width`、`height`、`bytes`、`durationSeconds`、`mediaUrl`、`thumbnailUrl` 是不是都在列表里（§22.3 说地址由 `uploadId` 拼出）？每次读列表是不是都给新地址？
4. 契约 §22.3 的单元字段 `surfaces`（按 `X-Platform`、`X-Channel` 限定，空数组表示所有端；选取时不含请求端的单元按 `TARGETING_MISS` 排除）：`GET /ads/units` 的行里带不带它？`POST /ads/units`、`PUT /ads/units/{id}` 接不接受它（§22.9 写 `PUT` 只改四个字段）？要不要在后台显示和编辑？现在后台既不显示也不发：别处创建的 `surfaces` 为 `["ANDROID"]` 的单元，列表的“定向”列写“不限”，而 iOS 请求实际被排除，运营会困惑。

**暂定做法：** 前端既收 `{items,total}` 也收裸数组，没有 `total` 时按条数算；字段名按 §22.3；缩略图只有 `https://` 开头或 `data:image/` 开头的地址才画，别的显示"—"。`surfaces` 先不显示、不发送，等后端回答。

## 二、各写接口的请求体

| 接口 | 前端发的请求体（暂定） |
|---|---|
| `POST /ads/campaigns` | `{name, description, priority, startAt, endAt}`，没填的是 `null`（不是不发） |
| `PUT /ads/campaigns/{id}` | 同样五个字段全发（Merge Patch：清空的时间、描述发 `null`） |
| `PUT /ads/campaigns/{id}/status` | `{status}`，取 `ACTIVE`、`PAUSED`、`ENDED`（恢复也是 `ACTIVE`） |
| `PUT /ads/placements/{id}` | 只发改动过的字段：`{enabled}`，或 `{frequencyCap, cooldownMinutes, rewardCredits}` 里改过的（激励广告位不发 `cooldownMinutes`，其余不发 `rewardCredits`） |
| `POST /ads/units` | `{campaignId, placementId, name, weight, dailyImpressionCap, targeting}`，`targeting` 里空的键不发 |
| `PUT /ads/units/{id}` | `{name, weight, dailyImpressionCap, targeting}`，不发 `campaignId`、`placementId`；`targeting` 里改成空的键发 `null` |
| `PUT /ads/units/{id}/status` | `{status}`，取 `ACTIVE`、`PAUSED` |
| `POST /ads/creatives` | `{adUnitId, uploadId, clickAction, clickTarget, language, weight, skippable, rewardAfterSeconds, title, body, ctaText, advertiserName}`，没填的文字是 `null`，非激励广告位的 `rewardAfterSeconds` 是 `null`；**不发**地址、尺寸、大小、时长、`type` |
| `PUT /ads/creatives/{id}` | 同样的字段（Merge Patch，全发），只有换了文件才多一个 `uploadId`；不发 `adUnitId` |
| `PUT /ads/creatives/{id}/review` | `{reviewStatus: "APPROVED"}` 或 `{reviewStatus: "REJECTED", reviewNote}` |
| `PUT /ads/creatives/{id}/serving-status` | `{servingStatus}`，取 `ACTIVE`、`PAUSED` |

**问：** 请确认这些请求体，尤其是：三个状态接口的字段名；审核接口用 `reviewStatus` 还是 `decision`；`PUT /ads/units/{id}` 的 `targeting` 是**整体替换**还是**嵌套的 Merge Patch**（契约说"更新用 JSON Merge Patch 语义"，按这个规则嵌套对象会逐键合并，要去掉一个键必须发 `null`；如果后端是整体替换，前端发的 `null` 键应该被当作"没有这个键"，请确认不会因为类型校验（"类型正确"）被拒绝）。

**暂定做法：** 如上；假后端把 `targeting` 按嵌套 Merge Patch 处理，`null` 的键被去掉。

## 三、素材表单需要的信息，只有 `ADS:CREATIVE` 的管理员读不到

后端回复第 9 条把 `GET /ads/campaigns`、`GET /ads/units` 对 `ADS:CREATIVE` 开放读取，但**没有**开放 `GET /ads/placements`，也没有让 `ADS:CREATIVE` 读到 `ads.creative_aspect_tolerance_percent`（`GET /config` 只返回当前管理员有权编辑的键，这个键属于 `ADS:PLACEMENT`）。素材表单要靠它们做三件事：对照广告位规格（比例、较短边、大小）给出"通过/不通过"和原因；知道广告位的形式（`NATIVE` 的标题和按钮文字必填，`REWARDED` 的激励阈值必填，`SPLASH`/`INTERSTITIAL` 的"不可跳过"警告）；比例的容差。

**问：** 能不能二选一：(a) `GET /ads/placements` 对 `ADS:CREATIVE` 也开放读取，并且 `GET /ads/meta` 多返回 `creativeAspectTolerancePercent`；(b) 单元的响应里带 `placementSlotKey`、`placementFormat` 和素材规格三项（`creativeAspect`、`creativeMinShortSide`、`creativeMaxBytes`）。

**暂定做法：** 读不到广告位时，页面写明"读不到这个单元所在的广告位，没法对照规格，以服务器的检查为准"，激励阈值字段照样显示（选填），`NATIVE` 的必填检查不做，交给后端的 400；读不到容差时用契约的默认值 3%。

## 四、"强制可关闭兜底为 0 且存在不可跳过素材"的警告怎么判断

规格 5.17 要求 `ads.force_close_seconds` 为 0 而开屏或插屏下存在"不可跳过"素材时警告。保存配置时后端用 `warnings` 里的 `AD_FORCE_CLOSE_DISABLED` 告诉前端（前端已经显示）；页面上要常驻的那一条，前端只能自己数：读全部单元和素材，数 `skippable=false`、不是 `REJECTED`、所在单元的广告位是开屏或插屏的素材。

**问：** 后端判断"存在"用的是哪些素材（所有状态？只数已通过且投放中的？）？能不能在 `GET /ads/meta` 里加一个 `notSkippableFullScreenCount`，让前端不用读全部素材？没有 `ADS:CREATIVE` 的管理员读不到素材列表，页面只能写"这里无法核对"。

**暂定做法：** 有 `ADS:CREATIVE` 时按上面的口径数（不数已拒绝的），没有时显示不带数字的警告。

## 五、删除计划、单元时的错误

契约写计划"删除只允许 `DRAFT` 或 `ENDED` 且名下没有单元"、单元"删除只允许 `DRAFT` 且没有素材"，没有写名下有单元或素材时返回什么。

**问：** 是 409 `INVALID_STATE`（`data.status` 是对象当前的状态，页面就看不出是"状态不对"还是"名下有单元"）吗？能不能给一个专门的原因（例如 409 `RESOURCE_IN_USE`，`data.what` 是 `units` 或 `creatives`）？草稿计划名下有单元时能不能删（契约字面是"草稿或已结束，且名下没有单元"，前端按两种状态都不能带单元处理）？

**暂定做法：** 能读到单元的管理员，页面对有单元的计划不提供删除（按钮灰掉并写明原因）；读不到时提供按钮，后端拒绝时显示 `error.INVALID_STATE` 的译文。单元的删除页面不预判（读素材需要另一个权限；§22.9 写 `GET /ads/units/{id}` 返回单元及其素材的只读列表，但素材列表的字段名没有写，所以前端不依赖它），拒绝时在 `error.INVALID_STATE` 的译文后面加一句“名下还有素材的单元不能删除，请先删除它的素材”（草稿单元被 409 拒绝只可能是这个原因）。

## 六、长度、范围和格式

契约只给了一部分：激励阈值 5 到 30、权重 ≥ 0、`frequencyCap` 激励广告位 ≥ 1、`rewardCredits` > 0、版本号"可解析"、时段 `H:mm`。没有写：计划名称、描述的长度；计划优先级的范围（页面只要求整数，不限范围）；单元名称长度；素材标题、正文、按钮文字、广告主的长度；拒绝备注（`reviewNote`）的长度（页面按 1 到 500 个码点，和其他理由框一致）；`DEEP_LINK` 的 scheme 清单（契约说"本应用声明的"，页面只检查非空和不超过 2048 个字符）；版本号能不能带后缀（页面只收"数字加点"，比如 `13`、`1.2.0`，不收 `1.2-beta`）。

**暂定做法：** 页面只做上面这些检查，其余交给后端的 400，页面把 `details` 里有译文的 `reason` 放到对应字段下面，没有对应字段的列在表单底部。请告诉我们真实的上限，前端再加实时检查。

## 七、`targeting` 校验失败时 `details` 的 `ref`

契约说保存非法 `targeting`（未知键、版本号无法解析、时间格式错误）返回 `INVALID_REQUEST`，没有写 `ref`。

**问：** `ref` 是 `targeting`、`targeting.geo`，还是 `geo`？时段第几行出错时是 `targeting.day_parts[0]` 吗？

**暂定做法：** 前端接受 `targeting`、`targeting.<键>`、`<键>`（`<键>` 是 snake_case 的 `platforms`、`geo`、`os_version_min`、`app_version_min`、`languages`、`day_parts`），键后面带 `[0]` 或 `.0.start` 都归到这一个键下面；认不出的显示在表单底部。

## 八、报表

1. `GET /ads/report/overview` 的 `daily` 是不是只返回有数据的日子（假后端是这样，页面把缺的日子在折线图上补 0）？当天（UTC 日还没结束）有没有数据？
2. `totals` 里的比率字段（`ctr`、`completionRate`、`viewableRate`、`measurableRate`、`avgWatchSeconds`）是不是和每行一样？页面对每一个比率都再检查分母：分母为 0（或不是数）一律显示"—"，不管后端给了什么。
3. `by-country` 的 `country` 是大写 ISO 3166-1 alpha-2 吗？空串是"未知"。
4. 导出 `GET /stats/export/ads-report`：页面发 `from`、`to`、可选的 `platform`、可选的 `channelCode`，和后端说明第 7 条一致；超过行数上限时 400 `INVALID_REQUEST`，页面显示译文加"请缩小范围"。

## 九、规格需要在 main 上修改的地方（给改契约的会话，不是给后端的问题）

1. 规格 5.17 素材表单写"再填类型、语言、点击动作与目标、时长、可否跳过……"。契约 §22.9 写明 `type`、`width`、`height`、`bytes`、`durationSeconds` 全部取自上传记录、请求里带了也忽略，所以类型和时长是只读的（页面显示服务器读出的值）。建议规格改成"类型、尺寸、大小、时长由上传记录给出，只读"。
2. 规格 5.17"页面上半部是'广告全局设置'，渲染 `ads.*` 键"：`ads.log_retention_days` 的编辑权限是 `CONFIG:MANAGE`，所以广告位页只渲染 `ADS:PLACEMENT` 的 9 个键，第十个只在系统配置页出现。建议规格写成"`ADS:PLACEMENT` 的全部键（9 个）"。
3. 规格 5.17 单元的"状态：草稿 → 投放中 ⇄ 暂停"没有写要不要确认；前端对激活、暂停、恢复都先问一次（和计划的"行内确认"一致）。

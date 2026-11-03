# 更新接口文档与上一版的差异（对前端的影响）

**比较的两份文件：** 上一版 `docs/backend-inputs/2026-11-02-backend-task-java-backend-e07469d1.md`（4276 行）和更新版 `docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`（4276 行，行数相同，所以两版同一行号对得上）。用 `diff` 比较：56 处改动，上一版 72 行、更新版 72 行（共 144 行差异）。下面按所在章节归类，不逐字复制；"28 个编号"指后端 2026-11-03 实现说明里已实现的 28 个请求编号（逐项落实见 `2026-11-02-requests-to-backend.md`）。行号指更新版。快照 `docs/shared-snapshots/` 不改，由负责人整份替换。

## 一、改了哪些章节

| 章节（行号） | 改了什么 | 对前端有没有影响 |
|---|---|---|
| 1.4 通用错误码，429 一行（111） | 管理员二次验证连续错误锁定的 429 带 `data.retryAfterSeconds`；APK 下载、推送图片、广告素材三个公开文件路由和 pipeline-metrics 上报的 429 也带 `retryAfterSeconds` 和 `Retry-After` 头；其余限流的 429 仍没有 | 管理员二次验证那一条有影响但不在 28 个编号里（见第二节第 1 条）；公开路由和上报接口管理端不调用，没有影响 |
| 1.4，`INVALID_REQUEST` 一行（112） | 原因代码清单新增：24.2 版本写入时 `versionName` 不是 `x.y.z` 形式（`INVALID_FORMAT` 的适用范围）；短信保护的四个值 `LAST_OTP_CHANNEL`、`COUNTRY_LOSES_OTP_CHANNEL`（`ref` 为 `SmsChannel`）、`LAST_OTP_TEMPLATE`、`LAST_ENGLISH_FALLBACK_TEMPLATE`（`ref` 为 `SmsTemplate`）；10.5 的 `NEGATIVE`、`TOO_MANY_DECIMALS`。用 `scripts/contractErrors.ts` 的 `reasonCodes` 实际数过：上一版 29 个，更新版 35 个（多出的正是后六个），错误码仍是 81 个 | 有（41 号、75 号；共用 `reason.*` 的译文和断言要从 29 个改成 35 个，批量导入对话框自己的那两条译文挪进共用的） |
| 1.4，409 `INVALID_STATE` 和 `DUPLICATE_RESOURCE` 两行（150、151） | `data` 不再一律写成 `{"status"}`：列出哪些对象带 `status`（投诉、上传 `CONSUMED`、账号删除、统计补数、客服重发、管理员账号（另带 `reason`）、签到活动、额度调整、权益撤销、登录方式、审核、价格批次、推送取消、封禁、订阅事件、应用版本）、哪些带别的字段（服装和背景默认条目带 `kind`，投放账户关联已停用渠道带 `details`），哪些 `data` 为 `null`（动作补生成、默认数字人、应用内广告、预设漏斗只读、告警已处理、删除当前外观、资料写入时账号非 `ACTIVE`）；重复的 409：管理员用户名、角色名、自定义权限码、短信渠道 `channelCode`、短信模板 `templateCode` 的 `data` 为 `null`，其他对象的 `data.field` 逐类写明 | 有（22 号、47 号在 28 个编号里；其余与上一版前端已按代码行为处理的一致，见第二节第 2 条） |
| 3.x、4.x、5.x、8.x、13.x、20.x（945–989、1685、2145–2147、2966–2982、3215、3220、1400、3066、3395、3398） | 把 LiveKit 服务端调用的写法改成不绑定具体 SDK 方法名（"查房间参与者列表"）、webhook 鉴权写全、会话结束流程的例外写明；推送执行器卡在 `RUNNING` 的条件加上"`cursor` 为空"；设备校验里 `direct` 渠道缺变量时的响应；订阅事件重试的验收文字 | 没有（管理端不调用，都是后端和客户端一侧的写法） |
| 10.5 投放（1535） | 成本批量录入的 `NEGATIVE`、`TOO_MANY_DECIMALS` 写进规则；响应 `{"count","overwritten"}`；成本行的字段清单（`id`、`campaignId`、`campaignCode`、`campaignName`、`statDate`、`amount`、`currency`、`remark`、`createdBy`、`createdByUsername`、`createdAt`、`updatedAt`） | 有（75 号；成本行字段清单与前端原来按后端的回答写的一致） |
| 14.1 管线监控（1824） | 响应多 `sources` | 有（103 号） |
| 14.2 用量与价格（1921） | `POST /usage/prices` 和 `confirm` 的校验 400 带 `data.details`；`GET /usage/models` 多 `resourceType`、`hasActivePrice` | 有（111、112、69 号） |
| 16.x 记忆（2312） | 模型冲突的 409 `data` 为 `{detail, registeredDimensions}` | 有（137 号） |
| 17.2、17.3 管理员认证与权限（2353、2357、2363） | 2353：二次验证锁定的 429 带 `retryAfterSeconds` 和 `Retry-After`；2357：管理员被删除后其已签发的令牌答 401 `ADMIN_INVALID_TOKEN`；2363：`GET /permissions` 不分页、响应 `{"items":[…]}`，每项多 `createdBy`、`createdByUsername`、`createdAt`、`updatedAt`，内置节点的创建人为 `null`，排序是根节点在前再按 `parent`、`sortOrder`、`code` | 有但不在 28 个编号里（第二节第 1、3、4 条） |
| 17.4 各模块接口（2344、2372、2377–2378、2381、2392–2395、2434–2438、2451、2457） | 2344：`GET /me` 多 `roleIds`；2372：409 的 `data.status` 写成"多数带"；2377：审核 `contentType` 筛选、`FILE` 的 `expiresAt`、`PUT /cosmetics/{id}` 的 `key`、`kind` 创建后不能改；2381：召回模板 400 的 `case`、推送记录 `from`/`to`、`deliveries` 的 `platform`/`tokenSuffix`；2392：四类授权 403 的 `data.reason`、`/admins` 409 的 `reason`、`GET /audit-logs/meta`、`GET /audit-logs/admins`；2393：`GET /meta` 二十五个字段；2394：订阅事件的购买令牌末 6 位；2395：`creditCost` 的 400 带 `details`；2434–2438：通则 1 的 `id` 类型例外、`GET /channels` 不分页、`RendererModel.fileRef` 不返回、`GET /ads/placements` 另允许 `ADS:CREATIVE`、审计 meta 与名单的权限；2451：订阅令牌末 6 位；2457：用户详情 `deletion` | 有，绝大多数在 28 个编号里（2、11、12、17、19、22、35、40、45、46、47、60、61、67、97、114、134）；不在其中的见第二节第 5、6、7 条 |
| 17.4 配置与客户端配置（2447、2469、2473、2581、2630） | 2447：`GET /client-config` 的更新人字段取各语言行里最近更新的一行，没有行（含 `readOnly` 的键）时三个字段都是 `null`；2469：价格 `unitPrice` 是字符串（最多 10 位小数）；2473：邮件模板"五个"改成"六个"；2581：`attribution.cost_currency` 的格式是整串匹配 `^[A-Z]{3}$`，不对照币种清单；2630：`moderation.text_rules` 通用 `PUT /config` 的写法要求（每个元素自带互不相同的 `id`，只含五个字段） | 有但不在 28 个编号里（第二节第 8、9、10 条）；2473 与前端按六个模板的做法一致，没有影响 |
| 17.6 统计（2762、2815） | 2762：补数"来源已过期"的判断改成：不在定时任务窗口内的日期才按日期算过期，窗口内的日期只有读取起点早于曾见到的最早事件日才算过期；2815：年份小于 1 的日期只有投放效果报表和投放汇总拒绝，其他统计接口不按年份拒绝 | 2815 与前端不依赖年份的做法一致，没有影响；2762 见第二节第 11 条 |
| 22.x 应用内广告（3643、3658–3659、3714、3717） | 3643、3658–3659：客户端下发时请求语言是一个序列，时段在账号时区为空或无法识别时的处理（客户端和后端一侧）；3714：`PUT /ads/units/{id}` 可改字段多 `surfaces`；3717：`GET /ads/meta` 多 `creativeAspectTolerancePercent`、`notSkippableFullScreenCount` | 3714 有但不在 28 个编号里（第二节第 12 条）；3717 有（40、122 号）；其余没有 |
| 23.4 短信（3833、3852、3854） | 保护性 400 的 `details` 换成四个专用 `reason`；凭据校验（名称必须恰好是 `credentialNames`，空串的值可以，`null` 或 `{}` 都当"不改"）；`GET /sms/meta` 顶层四个字段、`providers[]` 三个字段 | 有（5、41 号） |
| 24.2、24.7 应用版本与渠道（3924、3926、3984、3988） | 409 的 `data.status` 取值；版本写入的 400 带 `data.details`（三类例外只有 `message`）；`GET /channels` 不分页，`data` 直接是数组；渠道停用的 409 `data` 为 `{"status":"DISABLED"}` | 有（47、92 号）；`GET /channels` 的形状见第二节第 13 条 |
| 28.x 活动（4255） | 任务配置多 `hasRecords` | 有（37 号） |
| 其余章节（2.x–2.7、6–7、9–12、15.x、18、19、21、25、26、27） | 没有改动 | 没有 |

## 二、有影响但不在 28 个编号里的

后端实现说明只讲 28 个编号；下面是我对比两版文档时发现的、对前端有影响的其他改动。每条写了前端现在的做法是否与它一致；"我还没查清"表示没有读前端代码核对。是否需要改代码、是否进计划，由负责人决定。

1. **管理员二次验证锁定的 429 带 `retryAfterSeconds`（111、2353 行）。** 这是接口文档与后端代码矛盾清单第 1 条（`2026-11-02-contract-contradictions.md`）和 `2026-11-02-new-differences-a1.md` 第 1 条的请求，文档已采纳。前端早就按代码行为做（有字段写分钟数、没有字段用通用文字），一致，不需要改。
2. **409 `data` 哪些带 `status`（150–151 行）。** 对应矛盾清单第 8 条和 `new-differences-a5.md` 第 6 条：默认数字人、动作补生成遇已停用的动作、应用内广告模块的 409 `data` 为 `null`，文档现在与代码一致；前端读 `data.status` 前先判空，一致。重复 409 的 `data.field`（管理员用户名、角色名、自定义权限码、短信渠道和模板编码没有 `data.field`）对应矛盾清单第 2 条，前端按代码，一致。
3. **`GET /permissions` 的形状（2363 行）。** 文档现在写 `{"items":[…]}`（矛盾清单第 3 条已消除）；每项多 `createdBy`、`createdByUsername`、`createdAt`、`updatedAt`。前端读 `{items}`，一致；这四个字段权限树页目前是否显示，我还没查清（计划没有要求显示）。
4. **管理员被删除后其令牌答 401 `ADMIN_INVALID_TOKEN`（2357 行）。** 就是 `2026-10-31-admin-frontend-deleted-admin-token.md` 问的情形，后端 2026-11-02 已答，文档现在写进了契约；前端在 401 `ADMIN_INVALID_TOKEN` 时清令牌回登录页，一致。
5. **通则 1 的 `id` 类型例外（2434 行）。** 投放账户、投放成本、点击明细的 `campaignId`、归因明细的 `attributionCampaignId`、投放效果报表的 `campaignId`（含未归因的 `0`）是 JSON 数，不是字符串。这是 `2026-11-02-new-differences-a3.md` 第 3 条记下的差异，文档已采纳；前端类型和假数据是否已全部改成数，我还没查清。
6. **`GET /channels` 不分页，`data` 直接是数组（2434、3984 行）。** 矛盾清单第 9 条已消除；前端本来两种形状都接受，一致。
7. **功能开关价格 `creditCost` 的 400 带 `details`（2395 行）。** 只有 `assets.avatar_max`、`assets.voice_max` 能设非空价格，其余一律 400，`details` 为 `[{"ref":"creditCost","reason":"OUT_OF_RANGE"}]`。计划任务 11 已按回答第 105 条写成这样，一致。
8. **`GET /client-config` 的更新人字段（2447 行）。** 没有行（含 `readOnly` 的键）时 `updatedBy`、`updatedByUsername`、`updatedAt` 都是 `null`，行的管理员已不存在时只有 `updatedByUsername` 为 `null`。客户端配置页是否都按 `null` 显示"—"，我还没查清。
9. **`attribution.cost_currency` 只检查三位大写字母，不对照币种清单（2581 行）。** 与 70 号（后端不做）一致；前端提前校验"三位大写字母"，不要加 ISO 清单检查，一致。
10. **通用 `PUT /config/moderation.text_rules` 的要求（2630 行）。** 要求每个元素自带互不相同的 `id`、只含五个字段。前端的词表只通过 `/moderation/text-rules` 编辑，系统配置页不编辑这一项（计划任务 10 的 `editedElsewhere`），所以没有影响；若以后系统配置页要直接编辑，要按这条写。
11. **统计补数的"来源已过期"条件（2762 行）。** 窗口内的日期只有读取起点早于曾见到的最早事件日才算过期，以前窗口外按日期、窗口内按起点的写法被统一。页面只显示 `SOURCE_EXPIRED` 的译文，没有影响；假后端按哪条规则返回 `SOURCE_EXPIRED`，我还没查清。
12. **`PUT /ads/units/{id}` 多 `surfaces`（3714 行）。** 矛盾清单第 10 条已消除，前端本来就发送 `surfaces`，一致。
13. **`versionName` 必须是 `x.y.z` 形式的 400（112 行）。** 前端已按 `x.y.z`（ASCII 数字、至多 32 个字符）预检（计划任务 29），一致；后端的 400 现在带 `ref=versionName`、`reason=INVALID_FORMAT`（92 号）。

## 三、结论

- 56 处改动我逐处数过（行号对应本文第一节和 `diff` 输出里的 56 个改动块），归类如下：只和 28 个编号对应的 22 处（1535、1824、1921、2312、2344、2377、2381、2392、2436、2438、2451、2457、2884、3456、3717、3833、3852、3854、3924、3926、3988、4255）；同时含 28 个编号内外内容的 4 处（111–112、150–151、2372、2434）；28 个编号之外、但涉及管理端行为的 12 处（2353、2357、2363、2447、2469、2473、2581、2630、2762、2815、3714、3984，见第二节）；只是后端和客户端一侧的写法的 18 处（LiveKit、设备校验、推送执行器、订阅事件重试、广告下发语言等）。
- 第二节没有需要立刻改代码的条目（立即修 0）；第 3、5、8、11 条的"我还没查清前端是否已按它显示"没有核对，由负责人决定是否核对。
- 后端实现说明第五节的 4 条没有核实的部分与接口文档的逐条对照，以及接口文档里仍缺的几句，在 `2026-11-03-contract-gaps.md`。

核对于 2026-11-03

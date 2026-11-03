# 接口文档与后端代码互相矛盾的地方（给改契约的人）

**读者：** 改契约和规格的人。这些是给负责人的请求，**不改 `docs/shared-snapshots/` 里的快照**；由负责人决定谁在 AvatarApp 的 main 上改文档、或通知后端改代码。

**来源：** 后端 2026-11-02 的回答（`docs/backend-inputs/2026-11-02-avatar-backend-answers-to-avataradmin-questions.md`）的第五节，加各组汇总里的同类条目，加各问题小节里单独写出的矛盾。后端只做了读代码和读测试，**没有运行任何请求**；后端这次没有改任何代码。"接口文档第 N 行"指新版接口文档（`docs/backend-inputs/2026-11-02-backend-task-java-backend-e07469d1.md`，AvatarApp main 提交 e07469d1）的行号；代码路径相对 AvatarBackend 仓库根（`ADM` 是 admin 模块，`COR` 是 core 模块，`COMMON` 是 common 模块）。

**前端的原则：** 在文档和代码不一致、或后端还没改之前，前端按**后端代码的实际行为**开发（负责人 2026-11-02 的指示），并让页面对两种形状都不出错。下面每一条都写了前端现在按哪边。

## 一、接口文档与后端代码互相矛盾（共 11 条）

**1. 管理员二次验证锁定的 429 带不带 `retryAfterSeconds`（问题 10）**
- 文档：第 111 行只把"用户登录锁定、用量接口、导出最小间隔"列为带 `data.retryAfterSeconds` 和 `Retry-After` 头，并写"其他限流的 429 没有 `data`，也不带 `Retry-After`"；`ApiException.java` 的类注释也写"登录锁定不带 `Retry-After`"（指用户登录）。
- 代码：管理员二次验证锁定的 429 带整数 `data.retryAfterSeconds` 和 `Retry-After` 头（`AdminAuthService.java:412-419`，`retryAfterHeader=true`），测试 `AdminAuthIT.java:281-284` 断言了。
- 前端按代码：429 带 `retryAfterSeconds` 时写"N 秒后再试"，没有时（同一 IP 加用户名的登录限流，代码另有，没有 `data`）用通用文字。需要的修改：在文档第 111 行补上"管理员二次验证锁定"，或者改代码。

**2. 管理员用户名、角色名、权限码重复的 409 有没有 `data.field`（问题 85、86、87）**
- 文档：第 151 行写 `DUPLICATE_RESOURCE` 的 `data.field` 指出重复的字段。
- 代码：管理员用户名、角色名、自定义权限码重复的 409 `DUPLICATE_RESOURCE` 没有 `data.field`（权限码重复时 `data` 为 `null`）。
- 前端按代码：这三个表单的重复错误显示在表单整体上，不依赖 `data.field` 指到某个输入框；有 `data.field` 时仍按它对到输入框。

**3. `GET /permissions` 的外层形状（复查 3）**
- 文档：第 2363 行写返回裸数组 `[…]`，第 2434 行（通则）写 `{"items":[…]}`。
- 代码：按通则，返回 `{"items":[…]}`。
- 前端按代码（`{items}`）。需要的修改：把第 2363 行改成 `{items}`。

**4. 审计日志筛选参数的长度口径（问题 45）**
- 文档：通则第 4 条写按码点计；第 2392 行写"个字符"。
- 代码：用 UTF-16 单位数（`AuditLogFacade.java:82-83`，`requireLength`）。
- 前端按码点（输入框上限 64、对象 ID 255）；实际取值是 ASCII，无差别。

**5. 统计接口日期范围的年份下限（回答 B 组）**
- 文档：第 2815 行写"日期格式不对或年份小于 1 → `OUT_OF_RANGE`"。
- 代码：`/stats/*` 走的 `StatQueryService.range`（`CORE/stats/service/StatQueryService.java:89-95`）调用不带最小年份参数的 `StatsRange.resolve`（`CORE/shared/time/StatsRange.java:34-37`，传入 `Year.MIN_VALUE`），所以年份为 0 的日期（如 `0000-01-01`）不会按文档被拒；投放效果报表等两处调用传了最小年份 1（`CORE/attribution/service/PerformanceReportService.java:90-98`、`ADM/facade/AttributionAdminFacade.java:189-197`）。后端没有运行验证年份 0 会得到什么。
- 前端：日期选择器本来选不到年份 0，不依赖这条行为。

**6. 短信渠道凭据能不能为空串（问题 5、78）**
- 文档：第 3852 行写"`credentials` 是值为非空字符串的对象"。
- 代码：只拒 `null`，空串的值、空串的名称都接受（`SmsAdminFacade.java:438-445`）。
- 前端按代码，但自己不发空值。

**7. 邮件模板的个数（问题 138）**
- 文档：第 2473 行写"五个模板码各一项"；第 2401 行写六个。
- 代码和数据库约束：六个（`V1__schema.sql:393-395`）。
- 前端按六个（模板清单取后端返回，不写死）。需要的修改：把第 2473 行改成六个。

**8. 409 `INVALID_STATE` 的 `data` 有没有 `{status}`（问题 47、98、100）**
- 文档：第 150 行和第 2372 行写 409 `INVALID_STATE` 的 `data` 是 `{"status":"<当前状态>"}`。
- 代码：版本和渠道的状态错误（`AppVersionAdminService.java:410-412`）、动作补生成遇已停用动作（`LookFacade.java`）、默认数字人的所有 409（`DefaultAvatarFacade.java:436-441`）都**没有 `data`**；服装默认条目的 409 带的是 `data.kind`（`CatalogAdminService.java:285-288`）；渠道包相关接口里只有上传被用带 `data.status="CONSUMED"`（`DefaultAdminUploadService.java:301`）。其他模块的 409 有不少是带 `data.status` 的：投诉（`ComplaintFacade.java:565`）、删除（`DeletionAdminFacade.java:136`）、统计落地（`StatsAdminFacade.java:244`）、客服（`SupportAdminFacade.java:92`）、管理员账号（`AdminAccountService.java:428`）、签到活动（`CheckinAdminService.java:317`）、额度调整申请（`AdjustRequestService.java:92`）、权益（`EntitlementFacade.java:359`）、登录方式（`LoginMethodFacade.java:92`）、审核（`ModerationFacade.java:320`）、价格批次（`PriceTableService.java:469`）、推送任务（`PushTaskService.java:82`）、封禁（`BanService.java:70`）。
- 前端按代码：读 `error.data.status` 之前一律先判空；只在 `data.status === "CONSUMED"` 时提示重新上传；缺失时只显示通用的 `error.INVALID_STATE`。后端已建议补上（见 `2026-11-02-requests-to-backend.md` 问题 47）。

**9. `GET /channels` 的外层形状（问题 23）**
- 文档：通则 1（第 2434 行）写不分页的接口只有 `items`；第 3984 行没有单独写这个接口的外层形状。
- 代码：`GET /channels` 返回裸数组（`ChannelAdminController.java:41`），没有 `items`。
- 前端：渠道包列表的类型定义不按 `items` 写死，两种形状都接受（已有的任务 9 `getChannels` 按此处理）。

**10. 应用内广告单元的 `PUT` 能改哪些字段（问题 39）**
- 文档：第 3714 行写 `PUT /ads/units/{id}` 只改四个字段 `name`、`targeting`、`weight`、`dailyImpressionCap`。
- 代码：`updateUnit` 也接受并保存 `surfaces`（`AdAdminService.java:459`，注释 `:441-446` 写"by R22.10"）。
- 前端按代码：单元表单发送 `surfaces`。需要的修改：由改文档的人把 `surfaces` 加进文档，或者通知后端去掉；在改之前前端可以依赖代码的行为。

**11. 代码里已经过时的注释（不影响行为，仅供参考）**
- `PermissionTreeService.java:28-34` 的类注释仍写内置节点违规答 409 `INVALID_STATE`（`data.status="BUILTIN"`），实际代码（`:109-126,148-150`）和文档第 3489 行都是 400 `INVALID_REQUEST`（删除内置节点 `ref` 为 `code`）。
- `EntitlementAdminService.java:583-584` 与 `:590-592` 附近的类注释写 `entitlementKey` 不存在答 400，代码实际是 404 `RESOURCE_NOT_FOUND`（与文档第 2372 行的通用规则一致）。
- 前端按实际行为（400 / 404）。

## 二、文档没有写、但代码在做的事（文档缺口）

这些不是矛盾，但前端要依赖，建议改文档的人补上。

1. 第 112 行 `INVALID_REQUEST` 原因代码的清单里没有 `NEGATIVE`（金额为负）、`TOO_MANY_DECIMALS`（金额超过两位小数），而成本批量录入会返回它们（问题 75）。前端已在两个语言文件各补一条译文。
2. 契约对 `/api/admin/**` 没有写后端加的六个安全响应头（搜 `Content-Security-Policy`、`X-Frame-Options`、`Strict-Transport` 命中 0 处，问题 16）；后端对每一个业务端口（8080）的响应都设 `Cache-Control: no-store`，部署文档因此不能再加一个。
3. 第 3730 行附近应写明广告单元的 `targeting` 是**整体替换**，不是 RFC 7396 的嵌套合并（问题 77），避免别人按 Merge Patch 实现。
4. 客户端配置按语言排序时"取列表里靠前的第一个"，这个顺序是 Java 字符串自然顺序（按 UTF-16 码元，区分大小写），契约 1.2 和 26.3 两处都没有写（问题 130）。
5. 代码取的上界，契约没写：额度包 `credits` 1 到 1000000000、调账 `delta` 绝对值不超过 1000000000、限时权益 `durationDays` 1 到 3650（问题 30、108、106）。
6. 审核备注 `note` 最多 1000 个码点、`APPROVE` 时可不填（问题 95）；渠道名称 64 码点、包名 255（问题 90）；`versionCode` 上限 2147483647（问题 91）。这些在新版文档里有的已写，没写的请核对。

## 三、后端的回答与新版接口文档之间的不一致（前端在核对时发现）

1. 后端的回答第 56 条写：埋点四个接口缺 `from` 或 `to` 时 400 的原因代码是 `MISSING`。新版接口文档第 112 行的原因代码清单里没有 `MISSING`（`MISSING` 在新版文档里只出现在 `USAGE_PRICE_MISSING`、`GENERATION_CONFIG_MISSING` 两个告警类型里），清单里表示"缺失"的是 `REQUIRED`（10.5 投放写接口）和 `EMPTY_NOT_ALLOWED`。请后端确认到底返回哪个，并把清单补全。前端现在的处理：页面总是传 `from`、`to`，不会触发；遇到清单外的原因代码退回后端 `message`。
2. 后端的回答第 75 条说文档第 112 行的清单里没有 `NEGATIVE`、`TOO_MANY_DECIMALS`，已核对属实（新版文档里搜这两个词命中 0 处）。
3. 后端的回答说管理员二次验证锁定的 429 带 `retryAfterSeconds`，新版文档第 3484 行写"同一用户名连续 5 次验证码错误 → 5 分钟内 429 `RATE_LIMITED`"，没有提 `retryAfterSeconds`（与本文第一节第 1 条是同一件事）。

## 四、前端按哪边开发（汇总）

| 条目 | 前端按 |
|---|---|
| 一-1 二次验证锁定的 429 | 代码（带或不带 `retryAfterSeconds` 都能处理） |
| 一-2 管理员、角色、权限码重复的 409 | 代码（没有 `data.field`） |
| 一-3 `GET /permissions` | 代码（`{items}`） |
| 一-4 审计长度口径 | 码点（与实际取值无差别） |
| 一-5 统计年份下限 | 不依赖 |
| 一-6 凭据空串 | 代码，但自己不发空值 |
| 一-7 邮件模板个数 | 代码（六个，清单取后端返回） |
| 一-8 409 的 `data.status` | 代码（先判空） |
| 一-9 `GET /channels` 形状 | 代码（裸数组，两种形状都接受） |
| 一-10 广告单元 `PUT` | 代码（发送 `surfaces`） |
| 一-11 过时注释 | 实际行为 |

核对于 2026-11-02

## 2026-11-03 对照更新接口文档（`docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`）

更新接口文档采纳了上面的一部分，我逐条对过（行号指更新版）：

- 第一节已被采纳（文档改成与代码一致）：第 1 条（二次验证锁定的 429，第 111、2353 行）、第 2 条（管理员用户名、角色名、自定义权限码重复的 409 `data` 为 `null`，第 151 行）、第 3 条（`GET /permissions` 写成 `{"items":[…]}`，第 2363 行）、第 5 条（年份小于 1 只有投放效果和投放汇总拒绝，第 2815 行）、第 6 条（凭据的值可以是空字符串，第 3852 行）、第 7 条（邮件模板六个，第 2473 行）、第 8 条（409 的 `data` 哪些带 `status`，第 150、3924、3988 行）、第 9 条（`GET /channels` 的 `data` 直接是数组，第 3984 行）、第 10 条（`PUT /ads/units/{id}` 可改 `surfaces`，第 3714 行）。共 9 条。
- 第一节未被采纳：第 4 条（审计筛选长度的口径）第 2392 行仍写"超过 64 个字符"；第 11 条是后端代码里的过时注释，不在文档里。
- 第二节第 1 条（`NEGATIVE`、`TOO_MANY_DECIMALS`）已写进第 112 行。第二节其余五条没有逐条核对。
- 第三节第 2、3 条已被采纳（同上）；第 1 条（回答第 56 条写的 `MISSING` 原因代码）第 112 行的清单里仍没有 `MISSING`。

前端按哪边开发的汇总（第四节）不变：已被采纳的条目，文档和代码现在一致，前端本来就按代码做，不需要改。

核对于 2026-11-03

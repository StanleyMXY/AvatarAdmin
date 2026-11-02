# 接口文档新版与旧快照的差异（对前端的影响）

**比较的两份文件：** 旧快照 `docs/shared-snapshots/backend-task-java-backend.md`（AvatarApp main 提交 36626b12，4138 行）和新版 `docs/backend-inputs/2026-11-02-backend-task-java-backend-e07469d1.md`（提交 e07469d1，4276 行）。用 `diff` 比较，共 262 处差异；按所在章节归类如下，不逐字复制。旧快照不改，由负责人整份替换；新版的行号只用于新版。后端这次没有改代码，新版文档把已有的后端行为和 2026-10-29 清单里的内容写了进去。

## 一、改了哪些章节（概括）

| 章节 | 改了什么 | 对前端有没有影响 |
|---|---|---|
| 1.4 通用错误码 | 新增 `PAYLOAD_TOO_LARGE`（413）、`FORBIDDEN`（403，客户端框架层）；`ADMIN_FORBIDDEN` 的说明加上"要授出自己没有的权限"和"管理端框架层的 403"；原因代码清单大幅补充（见下面第二节第 1、2 条） | 有（第二节） |
| 1.5、1.6 配置与限流 | 补全环境变量（`PUBLIC_BASE_URL`、`TRUSTED_PROXY_CIDRS`、`CLIENT_IP_HEADER`、各 `*_PREVIOUS` 轮换密钥、`APPLE_APP_APPLE_ID` 等）；三个公开文件路由（APK 下载、推送图片、广告素材）加每 IP 每分钟限流，超限 429 带 `retryAfterSeconds` | 部署文档有（第二节第 9 条）；页面没有 |
| 2.x、3.x、4.x、5.x、6.x、7.x、8.1、8.4、9、12、13、16.1 | 客户端接口、聊天、事件接收、召回、账号删除执行、导出文件下载的细化（请求体检查顺序、社交令牌 `socialNonce`、导出文件名固定、`Range` 支持等） | 没有（管理端不调用） |
| 3.7、3.8、3.10 | 目录按端筛选规则统一（只带 `X-Platform` 时 `channel` 为空的项可见）；默认数字人生成失败时不删源图 | 基本没有；源图在失败后仍可用，`sourceImageUrl` 仍有效 |
| 10.1–10.5 投放 | 归因明细、汇总、投放账户、成本的参数、写入规则、转化回传细化 | 有（第 49 条里的 38、75、76、82；另见第二节第 7 条） |
| 11.2、11.3、11.6 审核与投诉 | 规则词表的形近字折叠写全；新增总开关 `moderation.model_check_enabled`；投诉的校验和 `assetIds` 规则 | 有（第二节第 3、8 条） |
| 14.1、14.2 管线与用量 | 管线查询的时间参数规则；价格批次确认时币种必须在允许列表；失败落地的退避 | 有（第二节第 10 条） |
| 15.x 订阅与额度 | `Subscription` 加 `periodOrderId`；退款乱序处理；宽限期窗口；额度重试 | 有（第二节第 6 条） |
| 16.3 记忆 | `truncated`、`totalCount` 总是出现 | 没有（计划已按此） |
| 17.2、17.3 管理员认证与权限 | 二次验证密钥轮换；`admin.totp_required` 在生产环境保存 `false` 返回 400；权限节点类型不可改写进正文；权限缓存通知所有实例 | 有（第二节第 5 条） |
| 17.4 各模块接口 | 用户筛选参数、审核内容 `text`、投诉 `status=OPEN`、模板 `missingLocales`、埋点的时间范围与明细字段、通话筛选、邀请、客服筛选、告警 `status`/`type` 取值、"不能授出自己没有的权限"四条规则、商品映射、六个邮件模板、告警类型扩充 | 大部分在 49 条里（26、33、35、54、56、59、72 等），其余见第二节 |
| 17.5 运营可调参数 | 配置键表从 225 行增加到 251 行（+26，没有删除），若干范围调整（见第二节第 3 条） | 有（第二节第 3 条） |
| 17.6 统计汇总层 | 所有统计接口（含额度、审核、邀请、广告报表和投放效果）用同一条日期范围规则和同样的错误 | 有（第二节第 4 条） |
| 22.x 应用内广告 | `store_client_ip`；后台接口的请求体写全（状态、审核）；列表形状 `{items}` | 在 49 条里（39、77） |
| 23.x 短信 | 凭据、验证码模板规则、`phone_login_enabled` 的保存规则写全 | 在 49 条里（5、41、42、78） |
| 24.x 应用版本与渠道 | 版本号规则、APK 上传和激活检查、渠道包字段限制写全 | 有（第二节第 2 条；其余在 49 条里：47、89、90、91） |
| 25.x、26.3 站内通知与客户端配置 | 通知列表的 `from`、`to` 写明为 ISO-8601 带时区偏移；`push` 必填；客户端配置的 `ETag` 与条数限制 | 小（第二节第 11 条） |
| 28.x 活动 | 签到活动 `PUT` 与 `…/status` 的响应形状；任务窗口；任务配置请求体 | 有（第二节第 12 条） |
| 二十、二十一、二十七 | 验收清单、实现依赖顺序、汇总登记 | 没有 |

## 二、有影响但不在后端回答的 49 条里的（需要前端另外处理）

按"立即修 / 记录 / 变更"分类前，先在这里列清楚；是否进计划由负责人确认。

1. **错误码文字：** 新增 `PAYLOAD_TOO_LARGE`、`FORBIDDEN` 两个错误码。任务 3 的 `errorCodes.generated.json` 按新版重新生成后，"每个码在两个语言文件里都有非空文字"的测试会因这两个码失败，需要补 `error.PAYLOAD_TOO_LARGE`、`error.FORBIDDEN` 两种语言的文字。
2. **原因代码文字：** 第 112 行的清单现在还包括 `RESOURCE_NOT_FOUND`、`DUPLICATE`、`INVALID_CHARACTER`、`INVALID_FORMAT`、`PACKAGE_NAME_NOT_CONFIGURED`、`SOURCE_EXPIRED`、`TOO_SLOW`、`TOO_MANY_EVENTS`，以及 10.5 的 `REQUIRED`、`INVALID_TYPE`、`CONTROL_CHARACTER`、`IMMUTABLE`、`NOT_FOUND`、`DISABLED`、`CURRENCY_MISMATCH`；后端代码另会返回清单里没有的 `NEGATIVE`、`TOO_MANY_DECIMALS`（49 条里的第 75 条）和 `MISSING`（回答第 56 条，清单里也没有，见 `2026-11-02-contract-contradictions.md`）。任务 3 的 `reason.*` 文字目前只有 14 个，页面遇到清单外的代码会退回后端的英文 `message`，需要补译文。
3. **配置键：** 键表增加 26 个。其中 25 个就是计划里的"契约采纳前的额外键"（`CONFIG_PRE_ADOPTION_KEYS`），契约一采纳，`check-config-keys` 脚本会按设计失败并提示从清单里删；另有 1 个计划里没有的新键 `moderation.model_check_enabled`（布尔，默认 `true`，编辑权限 `MODERATION:CONFIG`；对所有内容类型打开或关闭对外部审核服务的调用，关闭时规则词表照常检查）：`CONFIG_SCHEMA` 要加一项，审核规则页的"参数"区该码的键数相应加 1（计划里写的"11 个键"变成 12 个）。已有键的范围变化：`events.ttl_days` 的下限从"30 加落地窗口"变成"31 加落地窗口"（默认下限 34）；若干上传大小键的上限为 536870912；`recall.scan_interval_minutes` 与 `recall.window_minutes` 为 1 到 1440；`push.schedule_catchup_minutes` 为 1 到 10080 并与 `push.task_poll_seconds` 互相检查；`notification.max_recipients` 为 1 到 10000；`integrity.check_enabled` 在任何环境都可设为 `false`。
4. **统计接口的日期范围：** 新版 17.6 写明所有统计接口（含额度统计、审核统计、邀请统计、广告报表、投放效果）用同一条规则：只给一个日期时另一端取相隔 6 天（最晚到今天），`from` 晚于 `to` 时 `ref` 为 `from`，超过 `stats.max_range_days` 时 `ref` 为 `to`。计划只在投放效果一处写了这条；其余统计页的假后端和页面需要同样按 `ref` 把错误对到日期控件上。
5. **管理员认证与配置：** 在生产环境保存 `admin.totp_required=false` 会得到 400 `INVALID_REQUEST`（同 `integrity.check_enabled` 以前的做法，但 `integrity.check_enabled` 现在任何环境都可设为 `false`）。系统配置页该行的保存失败要显示按码翻译的文字。
6. **订阅：** `Subscription` 多一列 `periodOrderId`（可空，当前计费周期在商店的订单标识）。任务 11 的 `SubscriptionDetail`（"`Subscription` 的全部列"）类型要加这个字段，详情抽屉按需显示。
7. **投放管理：** 投放账户列表接口有 `keyword`（对 `code`、`name` 不区分大小写的包含匹配，最多 100 个码点）、`enabled` 两个筛选；点击明细有 `status`、`keyword` 两个筛选；归因汇总 `groupBy` 缺失或取值不对是 400。计划里这些筛选都没有列；加不加是新增页面行为，属于"变更"，要负责人确认后再进计划。
8. **照片里的人投诉：** 删除形象（`remove-avatars`）的 `assetIds` 现在有明确规则：不是数组或为空是 `EMPTY_NOT_ALLOWED`，超过 20 个、有重复（大小写不同的同一 UUID 也算重复）、元素不是 UUID 字符串是 `OUT_OF_RANGE`，找不到的形象是 404 `RESOURCE_NOT_FOUND`；投诉改成它当前状态同样是 409 `INVALID_STATE`；`note` 不得含控制字符。选择形象的控件要限制最多 20 个。
9. **部署文档：** 新版 1.5 要求反向代理后面的后端配置 `TRUSTED_PROXY_CIDRS`（受信任代理的网段），否则客户端地址取的是代理的地址，按 IP 的限流和点击记录里的 IP 都会失真；`docs/deploy.md` 应加一句提醒。同时见后端回答第 16 条：`/api/` 的 `location` 里不要再加 `Cache-Control`（计划任务 32 已改；`docs/deploy.md` 的示例配置也已不再加）。
10. **系统监控：** 管线查询只给 `from` 或只给 `to` 时取其后或其前 24 小时，`from` 晚于 `to` 或不是 ISO-8601 是 400；每个点多一个 `id`（可作行键）。
11. **站内通知：** 列表的 `from`（含）、`to`（不含）是带时区偏移的 ISO-8601 时刻；`category` 取 `ADMIN` 或 `SYSTEM_EVENT`；任一参数不合法是 400。计划里通知筛选的时间格式需要按此核对。
12. **签到活动：** `PUT /checkin/activities/{id}` 和 `…/status` 的响应是 `{applied: true|false, disabledActivities: [{id, name}], activity: <详情或 null>}`。任务 24 的 `probeActivityOverlap`（先 `confirm=false` 探测）要按 `applied` 判断是否已经写入，而不是只看 `disabledActivities` 是否非空。
13. **应用版本号规则：** 创建版本、编辑草稿时必须大于该渠道其他所有版本（含草稿、已下线）的最大版本号；激活时必须大于所有生效过的版本的最大版本号。旧快照写的是"严格大于当前生效版本"。计划任务 29 已按新规则改（并在回答第 47 条里写了检查顺序）；页面提示用列表里已读到的各版本计算，后端为准。DIRECT 渠道激活还会在服务端校验 APK 文件存在、大小和 SHA-256，`upload.public_base_url` 没配置时激活 DIRECT 版本是 400；APK 上传要有 APK Signing Block（v2 以上签名）、请求必须声明 `Content-Length`，否则 400 `INVALID_FILE`，这些前端无法预检，只显示后端的按码翻译的文字。

## 三、已经在后端回答 49 条里的差异

49 条里与文档新版有关的（这里不重复）：26、33、34、35、47、54、56、59、64、72、73、87、88、89、90、91、95、104、105、106、108、114、116 等，计划里已按后端实际行为写。

核对于 2026-11-02

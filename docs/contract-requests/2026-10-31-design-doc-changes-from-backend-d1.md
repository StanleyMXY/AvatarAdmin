# 给负责人：管理端前端设计（`admin-frontend-design.md`）需要在 AvatarApp 的 main 上做的修改（后端第一批交付引起）

> **写给：** 负责人，由他决定谁在 AvatarApp 的 `main` 上改 `docs/admin-frontend-design.md`。本仓库 `docs/shared-snapshots/admin-frontend-design.md` 是只读快照，没有改。
> **来源：** 后端写给管理端前端的清单 `docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md`（第 2 节 a1–a14、b1–b2、c1、e1–e6，以及 2026-10-31 追加的三节：W2a、GROUP A、GROUP B）。清单第 5.2 节是后端写给"改设计文档的人"的指令，这份文件把它展开成完整的变更请求（名称、行为、检查顺序、错误、测试），并加上 2026-10-31 追加的内容。后端的原始请求文件（`item-NN.md` 等）在后端仓库里，本仓库读不到；凡是清单没有写出的检查顺序，下面明写"清单没有给出"，不替后端编。
> **行号：** 都是快照 `admin-frontend-design.md`（AvatarApp main，提交 36626b12）里的行号。
> **管理端前端怎么用它：** 计划（`docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md`）已经按后端的现状改过（任务 3、7、10、11、13、14、15、16、19、20、22、25、26、28、31、32），不等设计文档改完。设计文档改完后，计划和代码不需要再动。
> **写法：** 每条是一处要改的地方：位置和现在的文字 → 应改成什么 → 行为、检查顺序、错误、测试（管理端前端和假后端怎么验证）。

## 通用说明

- 后端实现细节（密钥怎么派生、锁、内部表名、迁移编号）不写进设计文档。每条只写其他方能观察到的东西。有疑似内部机制的句子见最后一节，没有抄进来。
- 管理端界面对已知错误码只显示按码翻译的文字，不附后端 `message`（负责人已定）。所以下面每条的"错误"只写码、`data` 里的结构化字段和 `details`，后端 `message` 的英文原句不进设计文档。
- 所有数字、金额类的十进制值是字符串，不经浮点。

---

## 1. 第 3.4 节 权限判断（第 88 行）：权限变化的生效时间

- **现在：** "权限变化的生效：Java 每次请求按管理员 → 角色 → 权限码加载，缓存不超过 `admin.permission_cache_seconds`（Java §17.3）。前端的权限列表在每次进入应用时取一次，另外在收到 403 `ADMIN_FORBIDDEN` 时重新取一次；不用定时器轮询。"
- **改成：** "权限变化的生效：改角色的权限码、创建或删除角色、给管理员换角色、创建或删除管理员、删除自定义权限节点、启动时同步内置权限树，提交之后受影响管理员的下一次请求，在每个 admin 实例上都按新权限判断；缓存服务不可用时最长 `admin.permission_cache_seconds`（默认 30 秒）后生效，查权限本身不因此失败。超级管理员不受影响。前端的权限列表在每次进入应用时取一次，另外在收到 403 `ADMIN_FORBIDDEN` 时重新取一次；不用定时器轮询。"
- **行为：** 没有新接口、字段、错误码；前端做法不变。
- **检查顺序：** 不适用。
- **错误：** 无新增。
- **测试：** 前端：收到 403 `ADMIN_FORBIDDEN` 后只重取一次 `/me`，没有轮询（计划任务 7 已有）。后端：在两个 admin 实例上改一个角色的权限码，另一个实例上受影响管理员的下一次请求按新权限判断（后端自己的测试）。

## 2. 第 3.1、3.2 节（第 61–73 行）：二次验证密钥解不开

- **现在：** 第 64 行 "401 `ADMIN_TOTP_INVALID`：提示验证码错误，清空验证码框"；第 73 行 "`enrollToken` 10 分钟有效、一次性，过期则回登录页重来"。
- **改成：**
  - 第 64 行补："管理员的二次验证密钥在库里解不开（换了加密密钥没有配上一把、数据损坏、密文被复制到另一个管理员行上）时，登录同样答 401 `ADMIN_TOTP_INVALID`，并和输错验证码一样计入二次验证的锁定次数；前端分不出这两种情形，提示文字补'如果确认验证码没有输错仍然失败，请联系超级管理员重置二次验证'。恢复办法：有权限的超级管理员对该管理员做'重置二次验证'（`POST /admins/{id}/reset-totp`）。"
  - 第 73 行补："绑定时待确认的密钥解不开，`POST /api/admin/auth/totp/enroll` 答 401 `ADMIN_INVALID_TOKEN`，并且这个 `enrollToken` 作废；前端和过期时一样回登录页重来（它和登录之后令牌过期是同一个码，请求层不会把它当成别的错误）。"
- **行为：** 新增的是这两种情形的答法（以前登录解不开答 500 `INTERNAL_ERROR`）。
- **检查顺序：** 清单没有给出登录时各检查之间的顺序；只写明解不开按 `ADMIN_TOTP_INVALID` 计入锁定。
- **错误：** 401 `ADMIN_TOTP_INVALID`（登录）；401 `ADMIN_INVALID_TOKEN`（绑定）。
- **测试：** 登录：库里密钥解不开的管理员提交正确格式的验证码 → 401 `ADMIN_TOTP_INVALID`，失败次数加一，达到锁定次数后按已有的锁定答法；绑定：待确认密钥解不开 → 401 `ADMIN_INVALID_TOKEN`，同一个 `enrollToken` 再用仍是这个答法；超级管理员重置二次验证后该管理员重新走绑定流程。

## 3. 第 5.5 节 通话（第 251 行）：会话详情多一个字段

- **现在：** 会话列表的列 `id`、账号 ID、设备、`requestedAt`、`startedAt`、`endedAt`、`durationSeconds`、`modelTier`、`language`；没有详情字段的说明。
- **改成：** 在第 251 行后补："会话详情（`GET /sessions/{id}`）多一个字段 `maxDurationMinutes`：整数（分钟，不小于 0，不为空），是发起这次通话时记下的 `session.max_duration_minutes`；之后管理员改设置不影响已发起的通话。用来解释'为什么这次通话的截止时间和现在的设置不一样'。列表的九列不变。"
- **行为：** 只读字段。
- **检查顺序：** 不适用。 **错误：** 无新增。
- **测试：** 在发起通话后把 `session.max_duration_minutes` 改掉，再取详情，`maxDurationMinutes` 仍是发起时的值；列表响应没有这个字段。

## 4. 第 5.6 节 漏斗分析（第 259 行）：并发上限

- **现在：** 无并发上限的说明。
- **改成：** 补："漏斗查询有并发上限：参数合格、但这个 admin 实例同时在算的漏斗已达 `analytics.funnel_max_concurrency`（默认 2）时，立刻答 429 `RATE_LIMITED`，不排队，响应没有 `data`，也没有 `Retry-After` 头，所以页面没有倒计时可显示，提示稍后再试（第 26 行已定 429 提示稍后重试）。保存的漏斗（`/analytics/funnels`）不受这个上限。"
- **行为：** 按实例计数，不是整个集群共用；出错的计算会释放名额。
- **检查顺序：** `steps` → `windowHours` → `from`/`to` 与范围 → 并发上限（429）→ 计算（计算超时仍是 400 `INVALID_REQUEST`，原因 `TOO_SLOW`）。
- **错误：** 429 `RATE_LIMITED`（无 `data`、无 `Retry-After`）；400 `INVALID_REQUEST`（参数不合格、计算超时）。
- **测试：** 占满名额后第三个合格请求立刻得 429 且响应没有 `data`、没有 `Retry-After`；参数不合格的请求在名额满时仍先得 400（不是 429）；一次出错的计算之后名额被释放；`/analytics/funnels` 在名额满时照常。

## 5. 第 5.7 节 封禁（第 266 行）：封禁时没能立即结束的通话

- **现在：** "弹窗确认文字写明'封禁会立即结束该账号进行中的通话，不作废登录令牌，解封后原令牌继续可用'"。
- **改成：** "弹窗确认文字写明'封禁会结束该账号进行中的通话（通常立即结束；个别通话没能立即结束时，后台会在一个扫描间隔（`session.deadline_scan_seconds`）内以结束原因 `BANNED` 结束它们，通话记录页稍后会显示它们已结束），不作废登录令牌，解封后原令牌继续可用'"。
- **行为：** 封禁的答法不变（重复封禁仍是 409 `INVALID_STATE`）；新增的是：封禁已提交、但它的通话没能立即结束时，后台的到期扫描在一个扫描间隔内以 `BANNED` 结束它们。
- **检查顺序：** 不变。 **错误：** 无新增。
- **测试：** 封禁一个有进行中通话的账号，让立即结束失败，一个扫描间隔内这些会话变为已结束、`endReason=BANNED`；重复封禁仍得 409 `INVALID_STATE`。

## 6. 第 5.8 节 文本规则（第 281 行）：形近字折叠

- **现在：** "说明文字写明匹配前会做规范化（不分大小写，去掉零宽字符）、正则有执行时间预算、规则命中 `BLOCK` 时内容不会再发给审核服务"。
- **改成：** 补："`SUBSTRING` 和 `WORD` 规则在规范化之后另外做形近字折叠（把另一种文字里长得一样的字母折成同一个；只折叠另一种文字的形近字，ASCII 和同一文字内的字母不折叠）：用西里尔字母写的规则同时命中大小写两种写法；用形近字母替换了拉丁字母的文本也会命中拉丁写法的规则。`REGEX` 规则不折叠，行为不变。已知副作用：全大写的俄语词可能命中用拉丁字母写的规则，土耳其语里带无点 ı 的词可能命中对应的拉丁字母规则。"
- **行为：** 接口不变，没有新字段、新错误码。保存时 `SUBSTRING`/`WORD` 的 `pattern` 规范化并折叠后去空白为空，仍是 `EMPTY_NOT_ALLOWED`。
- **检查顺序：** 不变。 **错误：** 无新增。
- **测试：** 规则是西里尔字母写的词，文本是它的大写 → 命中；文本里把拉丁字母换成形近的西里尔字母 → 命中拉丁写法的规则；`REGEX` 规则不受折叠影响；折叠后为空的 `SUBSTRING` 规则 `pattern` → 400 `EMPTY_NOT_ALLOWED`。

## 7. 第 5.10 节 订阅统计（第 297 行）：Google 行有标价

- **现在：** "活跃订阅数、新增、续订、取消、过期、退款次数，按商店和商品分；页面用文字写明'金额是标价不是实收，沙盒订阅不计入'。"
- **改成：** 补："每行带 `listPriceAmount`（十进制字符串，例如 `\"24.99\"`，去掉尾零，不经浮点）和 `listPriceCurrency`；Google 行的值是当天该商品最后一条带价格的事件的 `recurringPrice` 和币种；当天没有任何事件带价格（例如预付计划，或事件是后端改动前处理的）时两个字段都是 `null`，页面显示'—'；苹果行不变；沙盒订阅仍不计入。"
- **行为：** 以前 Google 行恒为 `null`。
- **检查顺序：** 不适用。 **错误：** 无新增。
- **测试：** 同一天同一商品有两条带价格的事件 → 取最后一条；没有带价格的事件 → 两个字段为 `null`；价格 `24.90` 显示为 `"24.9"`（去尾零）；沙盒订阅不计入。

## 8. 第 5.11 节 推送（第 307、308 行）

### 8.1 模板规则（第 307 行）

- **现在：** "每个召回触发原因必须在列表里的每种语言上都有模板才允许启用，保存时的最终校验在后端（Java §8.4）。"
- **改成：** "每个召回触发原因（`daily_recall`、`streak_at_risk`），只要它有至少一条启用的模板，就必须有一条默认语言（`push.default_locale`，默认 `en`）的启用模板；这是唯一的硬规则，一条启用模板都没有的原因没有这个要求。其他语言的模板可选，缺的语言发送时回退到默认语言（两者都没有就跳过该账号）；语言标签区分大小写地精确比较，列表之外的语言也可以有模板。顶部的'触发原因 × 语言'矩阵，语言列仍取 `app.supported_locales`，缺的格子取自 `GET /push/templates` 的 `missingLocales`，标成'回退到默认语言'的信息，不当错误，保存也不被拒。保存时的最终校验在后端。"
- **行为：**
  - 每次写入后按'写入之后的状态'判断，不满足则整个保存被拒、什么都不写：创建（`enabled=true`）、编辑（编辑前或编辑后任一状态是启用；改原因时旧原因也判）、停用、删除模板，以及保存或恢复默认 `push.default_locale`（新默认语言下，每个有启用模板的原因都要有该语言的启用模板）。停用状态的模板不计入，也不被判断。
  - 保存 `app.supported_locales` 永远不会因为召回模板被拒绝。
  - 运营怎么用：一个原因的第一条要启用的模板必须是默认语言的，之后其他语言任意顺序；任何非默认语言随时可以停用、改、删；默认语言那条只有在同一原因下别的语言都已停用后才能停用或删除（它是唯一启用的模板时随时可以）；要整体关掉一个原因，先停其他语言，最后停默认语言；想把 `push.default_locale` 改成别的语言，先为每个有启用模板的原因启用该语言的模板；给 `app.supported_locales` 加语言不需要先动召回模板。
- **检查顺序：** 清单没有给出权限、字段校验与这条规则之间的顺序；只写明规则按'写入之后的状态'判断。
- **错误：**
  - `POST/PUT/DELETE /push/templates`：400 `INVALID_REQUEST`，什么都不写，`data` 为 `{defaultLocale, reason}`（默认语言和触发原因）。后端有三种 `message`（都写明怎么做）：该原因有别的语言启用却没有启用的默认语言模板；操作会把默认语言模板从其他启用的语言身边拿走（同一原因下还有别的语言启用）；该原因唯一启用的模板就是默认语言那条，却被改成别的语言。三种情形目前只有 `message` 能区分；管理端不显示 `message`，需要后端给结构化字段才能区分，见 `docs/contract-requests/` 里的问题文件（如果已写）。
  - `PUT/DELETE /config/push.default_locale`：400 `INVALID_REQUEST`，`details` 为 `[{"ref":"push.default_locale","reason":"OUT_OF_RANGE"}]`，另有 `data.defaultLocale`（要保存的语言）和 `data.reasons`（缺它的召回原因数组，字母序）。
  - `data.missingRecallTemplates`（以前保存 `app.supported_locales` 的错误）不再存在。
- **测试：** 一个原因只有英文启用 → 创建法语启用成功；先启用法语（该原因没有默认语言启用）→ 400；停用英文而法语仍启用 → 400；英文是唯一启用的模板时可停用、删除；把唯一启用的英文改成法语 → 400；`push.default_locale` 改成法语而某个有启用模板的原因没有法语启用模板 → 400 且 `data.reasons` 列出它；保存 `app.supported_locales` 加语言不因召回模板被拒；`missingLocales` 对停用的模板不计入，对原因下没有任何启用模板的情形是整个语言清单。

### 8.2 模板列表多一个字段 `missingLocales`

- **现在：** `GET /push/templates` 的响应 `{items:[…]}`。
- **改成：** 补："响应是 `{items:[…], missingLocales:{daily_recall:[…], streak_at_risk:[…]}}`：两个召回原因各一个数组，列出 `app.supported_locales` 里还没有启用模板的语言，按该设置的顺序，全都有则为空数组，原因下没有任何启用模板时是整个语言清单；不受 `triggerReason`、`locale` 过滤影响（过滤只缩小 `items`）。"
- **行为：** 只是信息。 **检查顺序：** 不适用。 **错误：** 无新增。
- **测试：** 过滤 `locale=fr` 后 `items` 变少、`missingLocales` 不变；无启用模板的原因给整个语言清单；全齐给空数组。

### 8.3 手动推送任务列表（第 308 行）：错过时间的任务

- **现在：** 状态 `PENDING`、`RUNNING`、`DONE`、`CANCELLED`；`PENDING` 行可取消。
- **改成：** 补："推送执行器停机超过 `push.schedule_catchup_minutes` 之后，已经开始但还没有发出任何一条的任务显示 `CANCELLED`，备注（`note`）为 `MISSED`（以前它停在 `RUNNING`，之后补发）。"
- **行为：** 见上。 **检查顺序：** 不适用。 **错误：** 无新增。
- **测试：** 停机时间超过 `push.schedule_catchup_minutes` 再恢复，已开始但没有发出任何一条的任务变 `CANCELLED`、`note=MISSED`；已经发出部分的任务不在此列（清单没有说明它们的去向：见最后一节的待确认）。

## 9. 第 5.13 节 投放管理（第 325、329、334 行）

### 9.1 成本币种锁（第 329 行投放成本页签、第 334 行归因参数）

- **现在：** 币种固定为 `attribution.cost_currency`；归因参数里有"成本币种"。
- **改成：** 补："只要有任何一条投放成本，`attribution.cost_currency` 就不能改成与当前有效值不同的币种，`DELETE`（恢复默认 `USD`）而当前不是 `USD` 时同样不能；保存与当前相同的值永远通过。要换币种：先逐行 `DELETE /attribution/costs/{id}` 删光全部成本，再改设置。批量和单条录入的 `currency` 仍必须等于这个设置。设置写入和成本写入之间没有锁，同一瞬间写入的成本行可能带旧币种（报表忽略它们，和其他币种的行一样）：这是防误操作，不是事务保证。"
- **行为：** 见上。 **检查顺序：** 清单没有给出。
- **错误：** `PUT/DELETE /config/attribution.cost_currency` 违反时 400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"attribution.cost_currency","reason":"OUT_OF_RANGE"}]`，什么都不存。
- **测试：** 没有成本行时可以改；有成本行时改成不同币种 → 400；有成本行时保存相同的值 → 成功；有成本行时 `DELETE` 回 `USD` 而当前是 `EUR` → 400；删光成本后可以改。

### 9.2 投放效果的范围错误（第 325 行，`GET /attribution/performance` 及它的导出）

- **改成：** 补："范围错误和别的统计页相同：`from` 晚于 `to` → `details[0].ref` 是 `from`；范围超过 `stats.max_range_days` → `ref` 是 `to`；日期格式不对或年份小于 1 → 原因 `OUT_OF_RANGE`（以前是 `INVALID_FORMAT`，`ref` 是 `to` 且文字不同）。"
- **检查顺序：** 清单没有给出。 **错误：** 400 `INVALID_REQUEST`，`details` 如上。
- **测试：** 三种情形各一例，包括导出接口。

### 9.3 投放账户的转化回传告警的自动关闭（第 332 行附近投放账户一段）

- **补：** "投放账户的转化回传凭证不能用时会有一条告警（见第 5.14 节）；管理员在这里重新填写访问令牌或像素编号并保存（`PUT /attribution/campaigns/{id}`）时，该账户那条打开的告警自动关闭。"

## 10. 第 5.14 节 客服、记忆服务、系统监控

### 10.1 告警类型（第 342 行）：14 种变 18 种

- **现在：** 列 14 种类型（账号删除失败、订阅未确认、额度购买未消耗、额度购买入账前已被消耗、额度余额与流水不一致、档位同步失败、短信每日总量达到上限、免费通话总分钟数过高、模型没有价格、LLM 价格同步失败、形象数据删除超时、照片里的人投诉超时、形象生成门槛未配置、外观驱动资源包准备失败）。
- **改成：** 类型表补 4 种（契约 17.4 要同时改，见 `docs/contract-requests/2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md`；等契约改完再补这 4 种的说明，不要先自己编）：
  - `SUPPORT_FORWARD_FAILED`：客服反馈转发用尽次数。`refType=SUPPORT_FEEDBACK`，`refId` 是反馈 ID，关联账号是反馈所属账号（可点进用户详情），`detail` 固定为 `attempts_exhausted`。同一个反馈同一时刻只有一条打开的。对这条反馈点'重试'（`POST /support/feedback/{id}/retry`，反馈回到 `PENDING`）时，同一操作里这条告警自动关闭；重试后又失败会开一条新的；也可以手动关闭（对反馈没有副作用）；重试没有改变任何东西（反馈不存在、反馈不是 `FAILED`）时告警保持打开。
  - `POSTBACK_CREDENTIAL_FAILED`：广告投放活动的转化回传凭证不能用。`refType=ATTRIBUTION_CAMPAIGN`，`refId` 是投放账户 ID，没有关联账号，同一账户一条打开的。`detail` 是广告平台返回的错误码（可能为空），或固定值 `token_unreadable`（存着的访问令牌解不开）、`pixel_id_malformed`（存着的像素编号格式不对）；一条已经打开的告警，后来不同原因的失败会替换它的 `detail`（不是保留第一次的）。该账户停止回传。自动关闭：管理员重新填写令牌或像素编号时，或该账户的回传发送成功时。
  - `SUBSCRIPTION_EVENT_FAILED`：后端清单只点了名，没有给 `refType`、`detail`、自动解决条件，等后端补。
  - `STAT_RELAND_FAILED`：统计日重新落地连续失败（成本回填给旧用量补了价格之后，某个统计日被标记为需要重新落地，连续失败 5 次）。英文标签 'Statistics re-landing failed'。`refType=STAT_RELAND_DAY`，`refId` 形如 `usage-cost:2026-10-10`（落地器名和统计日），没有关联账号，`detail` 只是异常类名。同一个统计日一条打开的。该日期落地成功时自动关闭；也可以手动关闭（该日期仍然失败时会再次打开）。在此期间该日期按 10、20、40 分钟这样递增的间隔重试，最长 6 小时一次。
- **行为：** `GET /alerts` 的 `status`、`type` 参数：`status` 只能是 `OPEN` 或 `RESOLVED`，`type` 只能是这 18 种之一，否则 400 `INVALID_REQUEST`；不带参数表示全部，空字符串是一个取值（也是 400）；类型筛选的选项取这 18 种。
- **检查顺序：** 清单没有给出。 **错误：** 400 `INVALID_REQUEST`，`details` 的 `ref` 是参数名。
- **测试：** `status=` 空、`status=open`、`type=UNKNOWN` 各得 400；不带参数得全部；四种新类型的写入和自动关闭条件各一例（`SUBSCRIPTION_EVENT_FAILED` 等后端补）。

### 10.2 账号记忆（第 340 行）：指派列表截断

- **改成：** 补："账号维度的记忆页签读 `GET /accounts/{id}/memory`，响应除了 `tier`、`embeddingAssignments` 还有 `truncated`（布尔，账号的指派多于最新的 200 条时为真）和 `totalCount`（该账号的全部指派数）。`truncated` 为真时页面写'只显示最新 200 条，共 N 条'。"
- **检查顺序：** 不适用。 **错误：** 无新增。
- **测试：** 指派 201 条的账号 → `embeddingAssignments` 长度 200、`truncated=true`、`totalCount=201`；200 条 → `truncated=false`。

## 11. 第 5.15 节 系统配置（第 348–350 行）

- **第 348 行：** 分组前缀清单补 `integrity.`（还有后端已有而清单没列的前缀，如 `push.`、`memory.`、`attribution.`，由改文档的人对照契约 17.5 补全）。
- **第 350 行：** "后端校验失败返回 `INVALID_REQUEST` 时在该行下展示 `message` 和 `data.details`" 改成 "展示 `data.details` 对应的按原因翻译的文字，并用下面几个新的 `data` 字段：
  - 保存 `app.supported_locales` 时有语言没有随版本发布的通知模板文件：`data.missingLanguages`（没有文件的语言标签数组，按请求里的顺序），`details` 为 `[{"ref":"app.supported_locales","reason":"OUT_OF_RANGE"}]`；比较不区分大小写、整个标签要匹配（`pt` 不能用 `pt-BR` 的文件）；`DELETE`（回到 `["en"]`）永远通过。
  - 保存或恢复默认 `push.default_locale` 时某个有启用模板的召回原因没有新语言的启用模板：`data.defaultLocale`（要保存的语言）和 `data.reasons`（缺它的召回原因，字母序）。
  - 保存 `auth.phone_login_enabled` 为 `true` 缺合格短信模板：`details` 为 `[{"ref":"SmsTemplate","reason":"EMPTY_NOT_ALLOWED"}]`——`ref` 是固定词 `SmsTemplate`，不是设置键，页面把文字显示在提交的那一行，不能丢。
  - `usage_price.default_currency` / `usage_price.allowed_currencies`：默认币种必须在允许列表里（区分大小写）；违反时 `details` 同时列两个键，保存的键在前，`reason` 都是 `OUT_OF_RANGE`，同一个错误出现在两个键的行下。`DELETE` 这两个键之一按代码里的默认值判断。
  - `attribution.cost_currency`：见第 9.1 条。
  - `chat.message_retention_days`、`guest.device_retention_days` 与 `stats.land_window_days` 的关系：保存时 400，`details` 里写出两个键，`reason` 是 `OUT_OF_RANGE`。
  - `push.schedule_catchup_minutes` 与 `push.task_poll_seconds`：`push.schedule_catchup_minutes × 60 ≥ 600 + push.task_poll_seconds`，保存或恢复默认任一个键时检查；违反时 400，`details` 先写保存的键、再写另一个键，`reason` 都是 `OUT_OF_RANGE`。页面在两个字段上都写出这条规则作提示（默认值下催补分钟数至少是 11）。"
- **补充（运营规则 e3、e5）：** 给 `app.supported_locales` 加语言的顺序是'通知模板文件随版本发布 → 把语言加进设置'，运营不能先改设置再等文件；要把 `usage_price.default_currency` 改成新币种，先把它加进 `usage_price.allowed_currencies`，要把当前默认币种从允许列表里去掉，先改默认币种。
- **补充（范围变化，2026-10-31）：** `chat.moderation_deadline_ms` 范围改为整数 100 到 2500（以前 100 到 2900）；`recall.window_minutes`、`recall.scan_interval_minutes` 整数 1 到 1440（以前没有上限）；`push.schedule_catchup_minutes` 整数 1 到 10080。在这些范围收紧之前保存的值继续有效，直到该键再被保存。
- **补充（新键清单）：** 25 个后端额外键的清单和 17.5 表项见契约变更请求；设计文档里只需要提一句'后端有一批键还没有写进契约 17.5，页面按后端返回显示，不把它们当未识别的配置项'。
- **检查顺序：** 各保存规则的先后清单没有给出；`details` 里键的先后见上。
- **测试：** 每条规则一例，包括 `details` 里键的先后，以及两个键的行下都出现错误。

## 12. 第 5.16 节 系统管理

### 12.1 管理员、角色的授予规则（第 356–357 行）

- **现在：** 管理员、角色的行操作和表单；没有关于操作者只能授出自己持有的权限的规则。
- **改成：** 补："管理员只能授出、操作自己持有的权限（'持有'指操作者各角色权限码的并集，后端保存时从数据库读）。违反时 403 `ADMIN_FORBIDDEN`，`data` 为 `null`，什么都不改：① `POST /roles`：`permissionCodes` 里有操作者没有的码；② `PUT /roles/{id}`：操作者不能改自己被分配的角色，角色原有的码和请求里的 `permissionCodes` 都必须是操作者持有的；`DELETE /roles/{id}`：角色原有的码必须是操作者持有的；③ `POST /admins`、`PUT /admins/{id}`：`roleIds` 里各角色的码合起来必须是操作者持有的；④ `PUT /admins/{id}`、`POST /admins/{id}/status`、`POST /admins/{id}/reset-password`、`POST /admins/{id}/reset-totp`、`DELETE /admins/{id}`：目标管理员当前持有的码必须是操作者持有的。`superAdmin=true` 的操作者不受这四条限制。前端不复刻规则逻辑，也不预先禁用权限树里操作者没有的节点；403 时提示无权限、不跳转（第 26 行），并按提交的操作显示原因。"
- **检查顺序：** 每个路由的检查顺序（第一个不通过的先答）清单只说'见来源'，没有给出，本仓库读不到；需要后端补一张表。前端不依赖顺序。
- **错误：** 403 `ADMIN_FORBIDDEN`，`data` 为 `null`。
- **测试：** 四类各一例；超级管理员不受限；403 后什么都没改；持有 `ADMIN:MANAGE` 但不持有目标管理员某个权限码的操作者对该管理员做五种写操作都得 403。

### 12.2 权限树（第 358 行）

- **补：** "节点的类型（菜单、功能）创建后不能改：`PUT /permissions/{code}` 请求里改 `type` 得 400（`details` 的 `ref` 是 `type`），编辑表单里类型只读。"
- **测试：** 改 `type` → 400；不改 `type` 的编辑成功。

### 12.3 审计日志（第 359 行）

- **补：** "筛选的 `action`、`targetType` 最多 64 个字符，`targetId` 最多 255 个字符，更长的值 400（输入框设 `maxLength`）。"
- **未明：** 清单只写 'characters'，没有说明按码点还是按 UTF-16 单位计，需要后端确认。
- **测试：** 64 个字符通过，65 个字符 400；`targetId` 255/256 同理。

## 13. 第 5.18、5.18a 节 短信和邮件模板

### 13.1 短信渠道凭据（第 376 行）

- **补：** "`POST/PUT /sms/channels` 的 `credentials` 里每个值必须是非空字符串；值为 `null` 或名字为 `null` → 400 `EMPTY_NOT_ALLOWED`（`ref` 是 `credentials`）。要保持凭据不变，不带 `credentials` 字段或带 `{}`。"
- **测试：** `null` 值、`null` 名字各得 400；不带字段、带 `{}` 保持不变。

### 13.2 短信模板（第 377 行）：至少一个启用的英文验证码模板

- **补：** "始终要有至少一个 `smsType=OTP`、启用、`locale` 等于 `en`（不区分大小写，`EN` 算，`en-GB`、`en-US` 不算）、`country` 为空的模板（选模板规则末尾回退到的那个）。守卫条件：`auth.phone_login_enabled` 为真，或至少有一个手机号账号。创建不受影响；写入后仍有别的合格模板就不受影响；已经缺合格模板的旧状态不拦无关的编辑，只拦'拿掉最后一个合格模板'（创建、修改、启用、停用、删除都判）。原来的'最后一个启用的 OTP 模板'守卫先判，消息不变。`PUT /config/auth.phone_login_enabled` 设为 `true` 时同样要有这个模板。没有合格模板时发验证码仍是 503 `SMS_SEND_FAILED`。"
- **检查顺序：** 原来的'最后一个 OTP 模板'守卫 → 本规则。
- **错误：** 400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"SmsTemplate","reason":"OUT_OF_RANGE"}]`；开启手机号登录时缺模板：`[{"ref":"SmsTemplate","reason":"EMPTY_NOT_ALLOWED"}]`。`ref` 是固定词 `SmsTemplate`，不是设置键。
- **测试：** 手机号登录开着，停用/删除/改语言/改国家使最后一个合格模板消失 → 400；`EN` 算合格，`en-GB` 不算；手机号登录关且没有手机号账号时不拦；已经缺合格模板时改无关字段不拦；开启手机号登录缺模板 → 400。

### 13.3 邮件模板（第 382 行）：五个变六个

- **现在：** "目前有五个模板：`REGISTER_CODE`…`LIKENESS_COMPLAINT_RECEIVED`"。
- **改成：** 六个，加 `LOGIN_METHOD_ADDED`（登录方式已添加通知）：账号新增一种登录方式后发到账号邮箱（谷歌登录的自动绑定，或用户登录后自己添加谷歌登录，`POST /api/account/login-methods/google`）。只有英文。占位符：`{method}`（登录方式名称，目前只有 `Google`）、`{time}`（添加时间，`yyyy-MM-dd HH:mm UTC`）、`{appName}`（取 `app.display_name`）；必含项：`{method}`、`{time}`（正文缺任一个，后端 400 `INVALID_REQUEST`，写明缺哪个）。用途说明：'登录方式已添加通知（账号新增一种登录方式后发到账号邮箱：Google 自动绑定，或用户登录后自己添加 Google 登录）'。路由、权限（`EMAIL:TEMPLATE`）、菜单不变。后端默认英文标题 'A new sign-in method was added to your {appName} account'，默认正文由'恢复默认'从 `defaultSubject`、`defaultBody` 显示，前端不写死。措辞以后端请求文件 `admin-frontend-design-item-03.md` 的 'Change to line 382' 一节为准（本仓库读不到；清单第 5.2 节指向它的第 45–47 行），后端依据节号加 2.7。
- **补：** 标题或正文含 NUL 字符时 400（正常表单敲不出来）。
- **检查顺序：** 不适用。 **错误：** 400 `INVALID_REQUEST`。
- **测试：** `GET /email/templates` 返回六项；`PUT` 缺 `{time}` → 400 且指明缺它；`POST …/reset` 恢复默认；含 NUL → 400。

## 14. 第 5.23 节 价格（第 429 行）：确认时的币种

- **补：** "确认（`POST /usage/price-batches/{batchId}/confirm`）时，批次最终用的币种（请求体给的 `currency`，没给就是批次自己的）必须在 `usage_price.allowed_currencies` 里，否则 400 `INVALID_REQUEST`，批次保持 `PENDING_REVIEW`，审计日志也不写。运营在请求体里给出允许列表内的 `currency` 即可确认。每日价格同步生成的批次用默认币种，'默认币种在允许列表里'的关系保证它们总能被确认。"
- **检查顺序：** 批次存在（404）→ 生效日期合法（400）→ 币种（400）→ LLM 档位规则（400）→ 条件更新 `PENDING_REVIEW → ACTIVE`（409 `INVALID_STATE`）。
- **错误：** 400 `INVALID_REQUEST`；404 `RESOURCE_NOT_FOUND`；409 `INVALID_STATE`。
- **测试：** 请求体给允许列表外的币种 → 400，批次仍待审、审计日志无新行；不给 `currency` 而批次自己的币种不在列表里 → 400；给列表内的 → 成功；五个检查的先后各一例。

## 15. 第 5.25 节 投诉（第 451 行）：状态筛选加"未结案"

- **现在：** "列表筛选状态（`RECEIVED`、`INVESTIGATING`、`RESOLVED_REMOVED`、`RESOLVED_NOT_FOUND`、`REJECTED`）"。
- **改成：** 补："`GET /likeness-complaints?status=…` 另有取值 `OPEN`（等于 `RECEIVED` 和 `INVESTIGATING` 两个状态，即未结案）。不传或传空值不过滤；区分大小写，`open`、逗号分隔的多个值、带空白的值都是 400 `INVALID_REQUEST`，`data.details` 为 `[{"ref":"status","reason":"OUT_OF_RANGE"}]`。`total` 按同一个条件计数；排序仍是 `dueAt` 升序、同时间按 `id`。"
- **检查顺序：** `page`、`pageSize` 的错误先于 `status` 检查。权限仍是 `COMPLAINT:VIEW`。
- **测试：** `OPEN` 的结果等于 `RECEIVED` 加 `INVESTIGATING` 的并集，`total` 一致；`open`、`RECEIVED,INVESTIGATING`、` OPEN` 各得 400；`page=0&status=bad` 先得分页的 400。

## 16. 第 12 节 验收清单

为上面各页各加或扩一行。现有清单（第 580–611 行）里已有行的页面：登录（扩'登录'一行）、管理员（扩'管理员'一行）、漏斗、系统配置、短信管理、成本（价格）、投放管理、投诉；没有行的页面：邮件模板（5.18a）、告警、推送模板、通话详情、订阅统计、文本规则，各新增一行。

- 登录与绑定（扩）：二次验证密钥解不开时，登录得 `ADMIN_TOTP_INVALID`、绑定得 `ADMIN_INVALID_TOKEN` 并回登录页。
- 管理员与角色（扩）：操作者只能授出、操作自己持有的权限，违反时 403 且不改任何东西；超级管理员不受限。
- 漏斗（扩）：并发上限 429，提示稍后再试，没有倒计时。
- 系统配置（扩）：新的 `data` 字段（`missingLanguages`、`defaultLocale`、`reasons`）和 `ref=SmsTemplate` 的错误都显示在对应行；关系对的键（币种两个键、催补分钟数与轮询秒数）两行都显示错误。
- 短信管理（扩）：拿掉最后一个启用的英文、不限国家的验证码模板被拒（手机号登录开着或存在手机号账号时）；渠道凭据不能有 `null` 值。
- 成本（扩）：确认价格批次时币种不在允许列表里被拒。
- 投放管理（扩）：有成本行时成本币种不能改。
- 投诉（扩）：状态筛选有'未结案'。
- 邮件模板（新增）：列出六个模板；必含占位符缺失时不能保存；恢复默认先显示默认文案；含 `LOGIN_METHOD_ADDED`。
- 告警（新增）：18 种类型都有文字；`status`、`type` 筛选不带空值；对失败的客服反馈点'重试'后对应告警自动关闭。
- 推送模板（新增）：'触发原因 × 语言'矩阵缺的格子是信息不是错误；默认语言规则违反时保存被拒，文字写明做法。
- 通话详情（新增）：显示 `maxDurationMinutes`。
- 订阅统计（新增）：Google 行的标价显示十进制字符串，没有价格时'—'。
- 文本规则（新增）：说明里有形近字折叠一句。

---

## 最后：疑似后端内部机制的句子（没有抄进设计文档，请负责人或后端确认是否需要）

清单第 5.2 节要求：像内部机制的句子不要抄，告诉对方。下面是我在清单里看到、没有抄的：

1. a13 里'用 Unicode 16.0.0 的 UTS #39 `confusables.txt` 裁出的 775 条'：实现来源和条数，设计文档只需要行为描述。
2. a10 里存储层超时的说明、d6 里'每次计算最多读 20 万条事件，约 100 MB'：存储和资源占用。
3. a2 里 `ADMIN_TOTP_ENC_KEY`、`ATTRIBUTION_TOKEN_ENC_KEY` 这类加密密钥环境变量名（b2 的 `token_unreadable` 说明里出现）：我只写了'存着的令牌解不开'。
4. a1 里'后端保存时从数据库读'持有的权限：这是一个可观察的结论（操作者的持有集合以保存时为准），我保留了一半（'后端保存时从数据库读'），可以删。
5. e6 里点名了具体的缓存服务：我写成'缓存服务不可用时'，没有点名。
6. b1、b2、STAT_RELAND 里的 `refType` 取值（`SUPPORT_FEEDBACK`、`ATTRIBUTION_CAMPAIGN`、`STAT_RELAND_DAY`）：告警表的列，契约 17.4 已经这样列别的类型，所以我抄了；如果认为是内部名，可以删。
7. 迁移编号 `V1044`、数据库约束等：没有抄。

## 待后端确认的点（本仓库读不到后端的请求文件）

1. 第 8.3 条：推送执行器停机后，已经发出一部分的任务显示什么状态，清单没有写。
2. 第 12.3 条：审计日志筛选长度按码点还是按 UTF-16 单位。
3. 第 10.1 条：`SUBSCRIPTION_EVENT_FAILED` 的 `refType`、`detail`、自动解决条件。
4. 第 12.1 条：四类授予规则各路由的检查顺序。
5. 第 8.1 条：召回模板被拒时三种情形的结构化区分字段（不读 `message` 就能区分）。

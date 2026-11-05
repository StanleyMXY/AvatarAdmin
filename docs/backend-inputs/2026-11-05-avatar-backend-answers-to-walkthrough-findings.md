# 后端对管理后台走查发现的答复：给 AvatarAdmin 前端会话

本文件自成一体，回答 `docs/backend-findings/2026-11-04-walkthrough-findings-for-backend.md` 里的 5 条发现。所有路径都以 `/api/admin` 开头，文中省略这个前缀。错误一律是 400 `INVALID_REQUEST`，`data.details` 是 `[{"ref":"...","reason":"..."}]`，和现有的相邻字段同一个形状。

## 一、概要

5 条发现，5 条都处理了。第 1 条是后端不符合合同，已改正。第 2 条的 8 类输入里 7 类改成拒绝，1 类（`milestone.days` 的上限）保持现状并写进合同。第 3 条要警告，已加。第 4 条已把 15 条说明改成管理员看得懂的英文并去掉章节号，控制台按 `key` 自己翻译。第 5 条新增字段 `ruleHits`，在命中那一刻存成快照。

走查里写的"广告优先级 1.5 被接受"，后端用真实请求复现了：`POST /ads/campaigns` 和 `PUT /ads/campaigns/{id}` 对 1.5 本来就返回 400 `OUT_OF_RANGE`（`ref` 是 `priority`），广告只有这两个接口带 `priority`。真正接受 1.5 的是**权益定义的 `priority`**，现在一并拒绝（见第 2 条第 4 点）。如果你们记录的请求不是这两个广告接口，请告诉后端是哪一个。

下面第二节是**会改变现有页面行为的改动**，请先看；第三节是逐条答复。

## 二、会改变页面行为的改动（先看）

1. 所有后台请求体里的**整数字段**收到小数（1.5、1.0、1e3）不再被悄悄截断，一律 400，`reason` 是 `NOT_AN_INTEGER`。页面把整数字段的值发成带小数点的数字会被拒，请确认表单提交的是整数。
2. `POST /ads/media` 的 `data.mediaType` 从 `image/png` 变成 `IMAGE` 或 `VIDEO`。页面可以直接用它当素材类型，不需要再处理 MIME 字符串。
3. 积分包和订阅商品的 `store` 只接受 `APPLE`、`GOOGLE`，`productId` 要符合各商店的规则；原来 `productId` 超过 255 个字符返回的 `TOO_LONG` 没有了，所有长度和字符问题现在都是 `OUT_OF_RANGE`。
4. 权益定义的 `priority` 不能小于 0；邮件模板的 `subject` 不能含控制字符；推送任务和定时推送发给不存在的账号被拒；`milestone.days` 必须从小到大；`companionship.text_burst_minutes` 限 1 到 1440。
5. `GET /moderation/records` 和 `GET /moderation/records/{id}` 每条记录多一个字段 `ruleHits`。
6. `PUT /config/integrity.check_enabled` 存为 `false` 时，回答的 `warnings` 里有一条警告。
7. `GET /feature-gates` 的 15 条 `description` 全部换成了新的英文文字，去掉了章节号。
8. 所有后台和 app 请求体里，值的 JSON 类型和字段类型不一致，一律 400：字符串给数字或布尔字段（`"12"`、`"true"`）、数字给布尔字段（`1`、`0`）、数字或布尔给字符串字段（`123`、`true`）。`data.details` 为 `[{"ref":"<字段路径>","reason":"INVALID_FORMAT"}]`，`message` 为 `<字段路径> has the wrong JSON type`，字段路径写法同上面的 `NOT_AN_INTEGER`（`credits`、`rewards[1].dayNum`）。这是后端追加的一致性要求：原来 Jackson 会悄悄把 `"12"` 当成 12，现在不会了。页面提交的值必须是字段声明的类型（数字字段发数字，不是数字字符串）；树形解析的请求体本来就逐项检查类型，没有变化。

## 三、逐条答复

### 第 1 条：`POST /ads/media` 的 `mediaType`

处理：改正。后端直接把数据库里存的 MIME 类型返回了，合同写的是 `IMAGE`、`VIDEO`。

- 字段：`data.mediaType`（字段名不变，只是值变了）。
- 新的回答：图片（jpeg、png）是 `"IMAGE"`，视频（mp4）是 `"VIDEO"`。其他字段不变：`uploadId`、`mediaUrl`、`thumbnailUrl`、`width`、`height`、`bytes`、`durationSeconds`。
- 创建素材时的 `type` 本来就是 `IMAGE` 或 `VIDEO`，两处现在是同一个值，页面可以用同一个文案 key。
- APK 上传的回答 `{uploadId, apkUrl, apkSizeBytes, apkSha256}` 没有 `mediaType`，没有改。

### 第 2 条：后端接受但看起来不对的输入

| 小项 | 结果 | 新的回答 |
|---|---|---|
| 积分包和订阅商品的 `store` 写 `STEAM` | 改成拒绝 | 只接受 `APPLE`、`GOOGLE`（大小写敏感，`google` 也拒）。`PUT/POST /credit-products`、`PUT /subscription-products`：400，`details=[{"ref":"store","reason":"OUT_OF_RANGE"}]`，message `store must be APPLE or GOOGLE` |
| `productId` 201 个字符、含空格 | 改成拒绝 | 按商店规则：Apple 允许字母、数字、`.`、`_`、`-`，最多 100；Google 第一个字符是数字或小写字母，后面是小写字母、数字、`_`、`.`，积分包最多 100、订阅商品最多 40。违反：400，`details=[{"ref":"productId","reason":"OUT_OF_RANGE"}]`，message 写出规则，例如 `productId of GOOGLE must be 1 to 40 lowercase letters, digits, '_' or '.', the first a lowercase letter or digit`。空值仍是 `EMPTY_NOT_ALLOWED`，含控制字符仍是 `OUT_OF_RANGE`。Google 一次性商品的长度上限在官方文档里没有找到，后端按 100 封顶 |
| 小数被悄悄截断（积分包 `credits` 1.5、额度调整 `delta` 1.5、广告优先级 1.5） | 改成拒绝 | 全局：后台所有请求体的整数字段收到小数，400，message `<字段> must be an integer`，`details=[{"ref":"<字段路径>","reason":"NOT_AN_INTEGER"}]`。字段路径用点和下标，例如 `credits`、`delta`、`priority`、`rewards[1].dayNum`。1.0 和 1e3 也一样被拒。已实测：积分包 `credits` 1.5、签到 `rewards[1].dayNum` 2.5、权益 `priority` 1.5 原来都被接受，额度调整 `delta` 1.5 原来能通过请求体检查。广告优先级见概要，本来就是 `OUT_OF_RANGE`，原因码和上面不同（广告的 `priority` 走另一条解析路径），两个原因码页面都按"数字不合法"显示即可 |
| 权益定义 `priority` 为 -1 | 改成拒绝 | `POST/PUT /entitlement-defs`：不能小于 0，400，`details=[{"ref":"priority","reason":"OUT_OF_RANGE"}]`，message `priority must be at least 0`。空值仍是 `EMPTY_NOT_ALLOWED`。理由：别处 -1 表示"无限"，广告优先级也不小于 0 |
| 邮件模板 `subject` 含换行 | 改成拒绝 | `PUT /email/templates/{templateCode}`：`subject` 含任何控制字符（换行、回车、制表符、NUL），400，`details=[{"ref":"subject","reason":"INVALID_CHARACTER"}]`，message `subject must not contain control characters`。首尾的换行仍会被自动去掉，不算错。`body` 的规则不变。原来 `subject` 含 NUL 的回答没有 `details`，现在有 |
| 推送任务发给不存在的账号 | 改成拒绝 | `POST /push/tasks`、`POST /push/schedules`、`PUT /push/schedules/{id}`，受众是 `ACCOUNT_IDS` 时：每个不存在的账号 id 在 `data.details` 里加一项 `{"ref":"<账号id>","reason":"ACCOUNT_NOT_FOUND"}`，按请求里的顺序，可以和其他字段的错误出现在同一个数组里；message 是 `Invalid request: <第一个 ref>`。存在但状态不是 `ACTIVE` 的账号（封禁等）仍然接受，合同规定发送时跳过 |
| `milestone.days` 乱序 | 改成拒绝 | `PUT /config/milestone.days`：必须从小到大，乱序或重复 400，`reason` 是 `OUT_OF_RANGE`，`ref` 是配置键 |
| `milestone.days` 含 100000 | 保持现状 | 允许。这个天数永远走不到，没有危害，合同里会写明"没有上限" |
| `companionship.text_burst_minutes` 100000 | 改成拒绝 | `PUT /config/companionship.text_burst_minutes`：限 1 到 1440，超出 400，`reason` 是 `OUT_OF_RANGE`，`ref` 是配置键。理由：设成 100000，第一条之后文字聊天就不再增加互动次数，阶段会停住 |

后端另外发现 Jackson 还会把字符串 `"12"` 当数字、把数字 `1` 当布尔值接受，这不在你们的清单里，本批次没有改，不影响页面。

### 第 3 条：`integrity.check_enabled` 设为 `false`

处理：要警告，已加。保存本身不会被拒。

- `PUT /config/integrity.check_enabled` 存 `false`：200，`warnings=[{"code":"INTEGRITY_CHECK_OFF","message":"Device integrity check is off: guest credentials and accounts are created without Play Integrity or App Attest verification."}]`，没有 `count` 字段。
- 存 `true`，或 `DELETE`（恢复默认 `true`）：`warnings=[]`。
- 页面显示警告时请按 `code` 用自己的中文文案，`message` 是英文兜底。

### 第 4 条：`GET /feature-gates` 的 `description`

处理：15 条说明已重写，去掉了章节号和内部术语，仍是英文（后端不写中文）。控制台请按 `key` 显示自己的中文标签，这 15 个 key 是固定的：`ads.removed`、`assets.avatar_max`、`assets.voice_max`、`avatar.look_free`、`avatar.looks_max`、`call.daily_minutes`、`call.lifetime_minutes`、`call.monthly_minutes`、`chat.daily_messages`、`chat.model_tier`、`chat.monthly_messages`、`chat.voice_reply`、`credits.period_grant`、`memory.tier`、`render.cloud`。`description` 只作为没有翻译时的兜底。已有的数据库在后端下次启动时自动更新说明。其余字段（`key`、`kind`、`limitScope`、`defaultMode`、`defaultValue`、`creditCost`）没有变。

### 第 5 条：审核记录规则命中

处理：新增字段，不改 `categories`。

- `GET /moderation/records` 和 `GET /moderation/records/{id}` 的每条记录多一个字段 `ruleHits`：`[{"ruleId":"<规则id>","pattern":"<规则的匹配内容>","matchMode":"SUBSTRING|WORD|REGEX","note":"<规则备注，可为 null>"}]`。
- `categories` 保持不变，规则命中时仍是 `["RULE:<规则id>"]`；没有规则命中的记录（模型命中、用户举报）`ruleHits` 是 `[]`。
- `ruleHits` 是命中那一刻的快照：规则之后被改或被删，审核人员看到的仍是当时命中的内容。
- 权限不变（`MODERATION:VIEW`）。`pattern` 是运营自己写的规则内容，不是用户发的原文，后端仍然不保存用户发的原文。

## 四、页面需要做什么

1. 整数字段的表单：提交前确保是整数，收到 `NOT_AN_INTEGER` 时在对应字段旁提示。
2. 素材上传后的类型文案直接用 `IMAGE`、`VIDEO`。
3. 积分包和订阅商品表单：`store` 用下拉（`APPLE`、`GOOGLE`），`productId` 按商店给出提示；`OUT_OF_RANGE` 的 message 已经写明规则，可以直接显示。
4. 权益优先级输入框限制不小于 0；邮件主题输入框不允许换行；推送任务选账号时，`ACCOUNT_NOT_FOUND` 的 `ref` 就是账号 id，按它标出哪几个账号不存在。
5. 配置页：`milestone.days` 要求升序；`companionship.text_burst_minutes` 范围 1 到 1440；`integrity.check_enabled` 存 `false` 后显示 `INTEGRITY_CHECK_OFF` 警告。
6. 功能开关页：按 `key` 显示中文标签和说明。
7. 审核队列和详情：用 `ruleHits` 显示命中的规则内容和备注，不再把 `RULE:<规则id>` 当成显示文字。

## 五、没有改的

- `mediaType` 之外，`POST /ads/media` 的其他返回字段没有变；APK 上传没有变。
- 广告 `priority` 的校验没有变（本来就拒绝小数和负数）。
- 手机号登录、短信、订阅等其他接口没有变化。

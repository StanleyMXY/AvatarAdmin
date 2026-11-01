# 给后端的问题：订阅与权益的请求体、筛选参数名、事件列表的形状

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 11（订阅与权益）。契约 §15.3、§17.4"订阅管理"行和后端 2026-10-21 的回复里写了读接口的响应形状，但下面这些写接口的请求体、筛选参数名和事件列表的形状没有写。前端和假后端按每条的"暂定做法"先做，后端回复后再改；不阻塞。

## 一、`GET /subscription-products` 和 `PUT /subscription-products` 的形状

契约只写了"商品到权益的映射与在售开关"，没有写响应和请求体。商品映射页需要列出、改在售开关和权益、新增一条映射。

**问：** 响应是不是 `{"items":[{"store","productId","entitlementKey","enabled","sortOrder","surfaces"}]}`（`SubscriptionProduct` 的列）？`PUT` 的请求体是不是同样的一条记录，按 `(store, productId)` 新增或修改一条？还是整表替换 `{"items":[…]}`？`entitlementKey` 不存在时是 400 `INVALID_REQUEST`（`details` 的 `ref` 为 `entitlementKey`）吗？

**暂定做法：** 响应 `{"items":[…]}`，按 `store`、`sortOrder`、`productId` 排；`PUT` 一条记录、按 `(store, productId)` 新增或修改，请求体带全部六个字段（`surfaces` 原样带回，页面不编辑它）；权益不存在是 400，`ref` 为 `entitlementKey`，原因 `OUT_OF_RANGE`。

## 二、`POST /entitlement-defs` 和 `PUT /entitlement-defs/{key}` 的请求体

契约写了 `GET/POST/PUT /entitlement-defs`，权益"由运营在后台创建"，但没有写请求体、`key` 的格式和长度、`name` 的长度，也没有写 `PUT` 能改什么。

**问：** 创建的请求体是不是 `{"key","name","priority"}`，修改（`PUT /entitlement-defs/{key}`）是不是 `{"name","priority"}`（`key` 不能改）？`key`、`name` 的格式和长度上限是多少？`key` 或 `priority` 重复时是 409 `DUPLICATE_RESOURCE`，`data.field` 为 `key` 或 `priority` 吗（契约 15.3 只写了 `priority` 重复）？响应是不是该权益的一项（形状同 `GET` 的一项）？

**暂定做法：** 如上；前端只检查非空（`priority` 为整数），格式和长度交给后端，把后端的 `details` 按 `ref` 放到字段旁。

## 三、`PUT /feature-gates/{key}/credit-cost` 的请求体和拒绝

契约写了接口，没有写请求体，也没有写对不能设置单价的开关（非永久的 `LIMIT`、`avatar.looks_max`、`credits.period_grant`、`BOOLEAN`、`STRING`）怎么回答。

**问：** 请求体是不是 `{"creditCost": 整数或 null}`（`null` 清除）？对不能设置单价的开关是 400 `INVALID_REQUEST` 吗？单价的取值范围是什么？

**暂定做法：** `{"creditCost": n}` 或 `{"creditCost": null}`；对不能设置的开关是 400，`ref` 为 `creditCost`；页面本身只让永久的 `LIMIT`（`avatar.looks_max` 除外）的单元格可编辑。

## 四、`GET /subscriptions` 的筛选参数名

契约写"按账号、状态、商店、商品筛选"，没有写参数名。

**问：** 参数名是不是 `accountId`（精确匹配）、`state`（实体的列名是 `state`）、`store`、`productId`（精确匹配）？

**暂定做法：** 用这四个名字，空值不发。

## 五、`GET /subscription-events` 的行、`status` 的取值，以及重处理和已处理的响应

契约写了 `GET /subscription-events?status=FAILED` 和 `needsAttention=true`，没有写行的形状、`status` 还有哪些取值、"失败"的定义，也没有写 `reprocess` 和 `ack` 的响应和错误。

**问：** 每行是不是 `SubscriptionEvent` 的列去掉 `payload`（`id`、`subscriptionId`、`accountId`、`store`、`sourceEventId`、`type`、`subtype`、`eventSignedAt`、`receivedAt`、`processedAt`、`error`、`needsAttention`），分页 `{"items","total"}`，按 `eventSignedAt` 倒序？`status` 除 `FAILED` 外还有别的值吗？"失败"是不是等于 `error` 不为空？对一个没有失败的事件重新处理，对一个不需要关注的事件点已处理，是 409 `INVALID_STATE` 吗？两个接口的响应体是什么（前端不读）？

**我们为什么需要：** 页面只在 `error` 不为空的行上显示"重新处理"，只在 `needsAttention` 的行上显示"已处理"；这取决于"失败"的定义。

**暂定做法：** 行如上；筛选只提供 `status=FAILED` 和 `needsAttention=true`；"重新处理"显示在 `error` 不为空的行；两个写接口的响应体不读，失败时按错误码显示文字，之后重新读列表。

## 六、限时权益的发放和撤销

契约写了 `POST /accounts/{id}/promo-entitlements {entitlementKey, durationDays, reason}` 和 `POST /promo-entitlements/{id}/revoke`（`SUBSCRIPTION:GRANT`）。

**问：** `durationDays` 的上限、`reason` 的长度（我们按管理端通则 1 到 500 个码点）各是多少？响应是不是 `{"id": "<新权益行的 id>"}`（前端不读）？撤销要不要请求体（比如理由）？账号不存在是 404 `RESOURCE_NOT_FOUND`，账号不是正常状态是 400 `INVALID_REQUEST` 且原因 `ACCOUNT_NOT_ACTIVE` 吗？撤销一条不是 `PROMO`、或已经 `EXPIRED` / `REVOKED` 的行是 409 `INVALID_STATE` 吗？

**暂定做法：** 发放前端预检 `durationDays` 为 1 以上的整数、理由 1 到 500 个码点，上限交给后端；撤销不带请求体；撤销按钮只在 `source=PROMO` 且 `status=ACTIVE` 的行显示。

## 七、`GET /subscriptions/stats` 里的金额类型

契约写了 `listPriceAmount`（Apple 的 `price` 除以 1000，Google 的 `recurringPrice`）和 `listPriceCurrency`，没有写 JSON 类型。

**问：** `listPriceAmount` 是数字还是十进制字符串（后端的价格批次接口用字符串）？同一天、同一商店、同一商品有两种币种时是两行吗？

**现状（2026-11-01）：** 前半句已回答（后端 2026-10-29 清单 a12）：Google 行的 `listPriceAmount` 是十进制字符串（例如 `"24.99"`，去掉尾零），没有价格的行两个字段都是 `null`，不要经过浮点。前端按字符串原样格式化（`src/pages/subscriptions/stats.tsx` 的 `formatListPrice`）。"两种币种是不是两行"还没有答复。 **【前半已答（核对于 2026-11-01）：`docs/backend-inputs/2026-10-29-avatar-backend-d1-admin-frontend-changes.md` 第 46 行；后半仍待后端回答】**

**暂定做法：** 两种都接受，用浏览器的货币格式显示；币种不是合法的币种代码时按原文写出；金额或币种缺失显示"—"。

## 八、权益功能值的上限不在 `GET /meta` 里

契约 15.3 写 `LIMIT` 取值 0 到 `entitlement.limit_max`（默认 1000000），保存时校验。这个键属于 `SUBSCRIPTION:CONFIG`，`GET /meta` 的 12 个配置值里没有它，所以只读 `SUBSCRIPTION:VIEW` 的管理员取不到上限。

**问：** 要不要把它加进 `GET /meta`？

**暂定做法：** 前端只检查"0 以上的整数"，上限交给后端，后端拒绝时在那一行旁显示按错误码和原因码翻译的文字（不显示后端的 `message`）。

## 九、后台读订阅的接口不应把完整 Google 令牌发给只有查看权限的管理员

契约 15.3 写 Google 的 `storeRef` 就是 `purchaseToken`，15.2 的绑定规则让持有购买凭证的人可以在 `google/verify` 认领订阅。`GET /subscriptions` 和 `GET /subscriptions/{id}` 现在把完整令牌发给持有 `SUBSCRIPTION:VIEW` 的管理员（`linkedPurchaseToken` 同理）。

**问：** 能否对 Google 只返回末 6 位（字段名带 `Suffix`，做法同 17.4 附表的设备推送令牌 `tokenSuffix`）？完整变更请求（行为、检查顺序、错误、测试）在 `docs/superpowers/handoff/reports/task-11-review.md` 的 C1。

**暂定做法：** 前端的订阅详情抽屉对 Google 只显示 `…` 加末 6 位，不带复制按钮；Apple 的 `originalTransactionId` 照常显示。响应 JSON 里的完整令牌前端挡不住。

核对于 2026-11-01

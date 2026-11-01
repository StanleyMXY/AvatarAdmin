# 给后端的问题：额度包的管理接口、额度相关列表的时间筛选、调账文字的长度

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 12（额度）。下面几处契约（§15.9、§17.4 额度行）和后端的四份回复里都没有写清，前端和假后端按"暂定做法"先做，后端回复后再改。其余额度接口（调账申请的列表字段、额度账户、额度流水、额度统计、账号额度）契约或后端的回复已给出字段，不在此列。

## 一、`GET/POST/PUT /credit-products`（额度包配置，`SUBSCRIPTION:CONFIG`）的响应形状、路径和请求体

契约 §17.4 额度行只写了"`GET/POST/PUT /credit-products`（额度包配置）"，§15.9 的实体表给了 `CreditProduct` 的列（`store`、`productId`、`credits`、`enabled`、`sortOrder`、`surfaces`），没有写：列表的 `data` 形状、有没有 `id`、`PUT` 的路径、`POST`/`PUT` 的请求体、重复时的错误。

**我们为什么需要：** 额度包页（规格 5.10）要列出全部额度包（含停售的），新建、改额度数和排序、切换在售开关。

**问：**
1. `GET /credit-products` 的 `data` 是 `{"items":[…]}`（不分页，同 `GET /feature-gates`）吗？每行是不是 `id`（字符串）、`store`、`productId`、`credits`、`enabled`、`sortOrder`、`surfaces`？
2. `PUT` 的路径是 `PUT /credit-products/{id}`（用上面的 `id`），还是用 `store` 加 `productId` 定位？请求体里 `store`、`productId` 创建后能改吗？
3. `POST` 的请求体是不是 `{store, productId, credits, enabled, sortOrder, surfaces}`；`(store, productId)` 重复时是 409 `DUPLICATE_RESOURCE`、`data.field` 是什么？`credits` 的取值范围（我们暂定正整数）？
4. `PUT` 里没有出现的字段（尤其是 `surfaces`）是保持不变，还是按空数组（所有端）覆盖？
5. `productId` 的长度上限是多少（商店各自的限制不同）？
6. 两个管理员同时改同一个额度包时怎么办？建议：`GET /credit-products` 每行带 `updatedAt`（UTC 时刻），`PUT` 接受可选的 `expectedUpdatedAt`，与库里的 `updatedAt` 不同时返回 409 `INVALID_STATE`（`data` 带当前的 `updatedAt`），什么都不改；不带它时行为和今天一样。同一套做法见 `2026-10-27-admin-frontend-concurrent-save.md`。

**暂定做法：**
- 前端和假后端按 1 的形状，`PUT /credit-products/{id}`，请求体 `{credits, enabled, sortOrder}`；如果列表行里带 `surfaces`，`PUT` 原样带回它，避免被覆盖；`store`、`productId` 创建后只读。
- 列表按契约 §17.4 开头的通则可能分页（`page`、`pageSize` 最大 200，响应带 `total`）：前端一页一页读到拿全，响应没有 `total` 且不满一页时就当作整张表（所以不分页的回复也能用）。
- `productId` 的长度前端不拦，由后端的 400（`details` 里 `ref` 为 `productId`）显示在输入框下。
- 同时修改：保存前（开关和编辑对话框）前端先重新读这个额度包，和列表上的 `credits`、`enabled`、`sortOrder`、`surfaces` 比，不一致就不发 `PUT`，提示"读取列表之后被别人改过"并重新读列表（同 `2026-10-27-admin-frontend-concurrent-save.md` 的做法）。读和写之间仍有时间窗，只有后端比较 `expectedUpdatedAt` 才能关上。
- `POST` 请求体 `{store, productId, credits, enabled, sortOrder}`，不带 `surfaces`（空数组，所有端）；`store` 下拉只列 `APPLE`、`GOOGLE`。
- 假后端：重复返回 409 `DUPLICATE_RESOURCE`，`data.field` 为 `productId`；`credits` 不是正整数返回 400 `INVALID_REQUEST`，`ref` 为 `credits`，原因 `OUT_OF_RANGE`。

另：规格 5.10 的额度包列只有商店、商品 ID、额度数、在售开关、排序，没有"适用的端"（`surfaces`）。如果运营需要在管理端设置额度包的适用端，需要规格补上这一列和编辑方式；现在页面不显示、不改它。

## 二、`GET /credits/transactions` 的 `from`、`to` 是什么格式

契约 §15.9 写"`from`、`to` 按 `createdAt`"，没有写格式。同一批报表接口的 `from`、`to` 是 `YYYY-MM-DD`（§17.6），事件明细、多开聚类按时间（`createdAt`）筛选也叫 `from`、`to`。

**我们为什么需要：** 流水页的时间范围筛选要发对格式，否则整个筛选失效或 400。

**问：** 是 ISO-8601 UTC 时刻（`2026-10-01T00:00:00Z`），还是 UTC 日（`2026-10-01`）？`to` 包含还是不包含？

**暂定做法：** 页面用 UTC 日历日选择，发 `from=<起始日>T00:00:00Z`、`to=<结束日的后一天>T00:00:00Z`，即 `[from, to)`，不包含 `to`（前端的 `utcDayRangeToInstants`）；假后端按这个含义过滤。

## 三、`GET /credits/stats` 的 `from`、`to` 和默认范围

§17.4 额度行写了 `GET /credits/stats?from=&to=`，"`from`、`to` 跨度同上"，我们按 §17.6 的 `YYYY-MM-DD`、含两端、跨度不超过 `stats.max_range_days` 理解（"当日"流水条数的"当日"是 UTC 日）。不传时取什么，没有写。

**暂定做法：** 页面总是传 `from`、`to`（默认最近 7 个 UTC 日，含今天），不依赖默认值。

## 四、调账申请的 `reason`、`note` 和 `delta` 的限制

§15.9 写了 `kind=GRANT` 时 `delta` 必须为正，`ADJUST` 可正可负，驳回必须带 `note`；没有写：`reason`、`note` 的长度范围，`delta` 能不能为 0、绝对值有没有上限，`ADJUST` 负数让余额低于 0 以外还有没有限制。

**我们为什么需要：** 表单要在发请求之前提示，不能全靠后端报错。

**暂定做法：** `reason` 和 `note` 去首尾空白（§1.9 的集合）后 1 到 500 个码点（驳回的 `note` 必填，通过的 `note` 可空，空则不发该字段）；`delta` 必须是整数，`ADJUST` 不能为 0，不设上限；超出时以后端的 400 `INVALID_REQUEST`（`details` 的 `ref` 为 `reason`、`note`、`delta`）为准并展示。

## 五、几个检查的先后顺序

`POST /credit-adjust-requests/{id}/approve` 同时可能触发：申请人就是审核人（403 `SELF_REVIEW_FORBIDDEN`）、申请不在 `PENDING`（409 `INVALID_STATE`）、账号待删除或删除中（403 `ACCOUNT_DELETION_SCHEDULED` / `ACCOUNT_DELETING`）。契约没有写它们的先后。

**暂定做法：** 假后端按"权限 → 申请存在（404）→ 申请人是否本人（403）→ 状态（409）→ 账号状态（403）"检查；`reject` 同样，只是没有账号状态这一步，另在最前面检查 `note`（400）。前端对每种结果都只展示后端返回的错误，不依赖先后。

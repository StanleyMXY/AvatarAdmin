# 2026-11-02 后端回答与契约文字、现有假设的新差异（组 a3）

这份文件只记录差异；前端当前按后端实际行为开发。契约（`docs/shared-snapshots/` 里的快照）不改。

## 1. 成本录入的原因码 `NEGATIVE`、`TOO_MANY_DECIMALS` 不在新版接口文档的原因码清单里（后端回答第 75 条 (d)）

- 后端回答：批量成本 400 的 `details` 里会出现 `NEGATIVE`（花费小于 0）和 `TOO_MANY_DECIMALS`（花费超过两位小数），新版接口文档第 112 行的清单和第 1535 行都没有写。同一个接口还会返回 `REQUIRED`、`INVALID_TYPE`、`INVALID_FORMAT`、`TOO_LONG`、`CONTROL_CHARACTER`、`OUT_OF_RANGE`、`CURRENCY_MISMATCH`、`NOT_FOUND`、`DUPLICATE`；第 112 行的清单里，`INVALID_FORMAT`、`TOO_LONG`、`OUT_OF_RANGE`、`DUPLICATE` 在通用部分，`REQUIRED`、`INVALID_TYPE`、`CONTROL_CHARACTER`、`NOT_FOUND`、`CURRENCY_MISMATCH` 在最后一句点名的投放接口部分，只有 `NEGATIVE`、`TOO_MANY_DECIMALS` 完全没有。
- 前端做法：批量导入对话框把这个接口会返回的原因码（上面列的十一个）的译文放在自己模块的语言文件里（`campaign.batch.refusedReason.<码>`，zh-CN 和 en-US 对称），查找顺序是模块自己的、共用的 `reason.<码>`、最后显示码本身；不显示后端的 `message`。没有往共用的 `reason.*` 里加，因为共用清单有"只能有契约里的码"的测试（读 `docs/shared-snapshots/`），而这几个码契约里没有。
- 请求（给负责人）：由负责人决定谁在 AvatarApp 的 main 上把 `NEGATIVE`、`TOO_MANY_DECIMALS`（以及上面其余几个）补进第 112 行的清单和第 1535 行；补上之后译文可以移到共用的 `reason.*`。

## 2. 批量导入后"新增几行、覆盖几行"现在写不出来（后端回答第 75 条 (a)，负责人 2026-10-27 的决定）

- 负责人 2026-10-27 的决定（`decisions-2026-10-27.md` "采用"一节）：批量导入后写"新增几行、覆盖几行"。后端现在只答 `{"count": N}`（新增和覆盖的总数），`overwritten` 是向后端提的请求，后端还没有做。
- 前端做法：只写"已导入 N 行（已存在的日期被覆盖）"，不读 `imported`、`overwritten`。后端加上 `overwritten` 之后，再改回两个数。
- 请求（给负责人）：这条决定在后端加 `overwritten` 之前做不到；是否仍然要，等后端一侧决定。

## 3. 投放账户、成本、点击、效果报表的 `id`、`campaignId` 在后端是 JSON 数，前端类型和大部分假数据仍是字符串（后端回答 F 部分"问题表没问到的坑"第 1 条，新版接口文档第 2434 行通则写的是字符串）

- 后端回答：`long` 序列化成 JSON 数，没有全局转字符串的设置（读代码得出，没有运行请求看原始响应）；文档通则说 `id` 和外键是字符串。
- 前端做法：只有负责的第 38 条（效果报表行的 `campaignId`）按数处理（`0` 是未归因行，假后端发数）。投放账户列表、成本行、点击行的 `id` 和 `campaignId` 前端类型仍是 `string`，假后端仍发字符串；页面里拿它们做比较的地方（`byId`、成本弹窗的投放账户）都先 `String()`，所以后端发数时这些页面仍然对得上，但类型声明和假数据与后端实际不一致，这一块不属于本组的编号，没有改。
- 请求（给负责人）：由负责人决定谁把这几个接口的 `id`、`campaignId` 类型和假数据一起改成数，或者让后端按文档通则发字符串。

## 4. 价格相关的 400 有的假后端仍带 `details`，后端实际没有（后端回答第 111、112、110 条，"问题表没问到的坑"第 8 条）

- 后端回答：`POST /usage/prices`、`POST /usage/price-batches/{id}/confirm`、`PUT /usage/models/{id}` 的 400 都只有英文 `message`，`data` 为 `null`，没有 `details`。
- 前端做法（第 111 条）：假后端的 `POST /usage/prices` 的全部校验失败、确认时档位不对的 400 已改成不带 `details`，页面只显示通用句。确认时币种不在允许列表（第 112 条，后端回答写"一致：被拒且无 details 时只显示通用句"）、确认时生效日期不合法、`PUT /usage/models/{id}`（第 110 条）的假后端仍带 `details`，没有在本组改（不是本组的编号）。
- 请求（给负责人）：由负责人决定谁把这三处假后端也改成不带 `details`。

## 5. 订阅商品的 `surfaces`，前端类型和假数据原先是字符串，契约是 `{platform, channel}` 对象（新版接口文档第 815 行，后端回答第 28 条）

- 契约 3.7："`surfaces` 是一个数组，每项是 `{"platform": "ANDROID"|"IOS", "channel": "<渠道码>"|null}`，空数组表示所有端"，订阅商品、额度商品按同一条规则。前端订阅商品的类型和假数据原先是 `string[]`（`['ANDROID']`）。
- 前端做法：已改成对象数组（类型 `ProductSurface`、假数据、假后端的校验：最多 50 项，`platform` 只能是 `ANDROID`、`IOS`，缺省或 `null` 是 400 `EMPTY_NOT_ALLOWED`）。页面不编辑 `surfaces`，读到什么原样回传。

## 6. 批量成本的"第 N 行"和 CSV 文件的行号差一行（后端回答第 75 条 (b)）

- 后端回答：`details` 里 `index` 从 0 起，显示"第 N 行"时用 `index + 1`。
- 页面在本地检查 CSV 时说的是文件的行号（表头是第 1 行），而 `index + 1` 是数据行的序号（表头之后的第 N 行）。同一个问题在 CSV 里本地检查会说"第 3 行"、后端会说"第 2 行"。
- 前端做法：后端的拒绝照后端回答写成"第 `index+1` 行"，没有给 CSV 另算（解析结果里没有留下每一行对应的文件行号）；本地检查拦下的行不会走到后端，所以实际出现的机会很小。
- 请求（给负责人）：若要两边一致，需要决定后端的 `index` 在 CSV 里是否按文件行号算（后端收到的是解析后的数组，没有行号，这条只能由前端在解析时留行号再换算，属于变更，等负责人定）。

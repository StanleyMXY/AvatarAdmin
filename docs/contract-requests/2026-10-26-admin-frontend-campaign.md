# 给后端的问题：投放效果、投放账户、投放成本、归因明细的请求和响应形状

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 25（投放管理）。契约 §10.3 到 §10.5、§17.4"投放管理"行、后端回复第 11 条和后端说明第 5 条写了实体的列、权限和业务规则，没有写下面几处的响应字段、请求体和错误。前端和假后端按"暂定做法"先做，后端回复后再改。没有一处是阻塞：每一处都有能继续的最小做法。

## 一、投放效果 `GET /attribution/performance`

1. **行里用什么字段指出是哪个投放账户、哪一天？** 契约写"每行是一个投放账户（或一天）"和"`campaignId=0` 是未归因行"，没有写字段名。**暂定：** 按投放账户分组的行带 `campaignId`（字符串，`"0"` 是未归因行），按日分组的行带 `statDate`（`YYYY-MM-DD`）。投放账户的编码和名称页面从 `GET /attribution/campaigns`（`ATTRIBUTION:VIEW` 也能读）里按 `campaignId` 对出来；响应里如果带了 `campaignCode`、`campaignName`，页面优先用它们。请确认字段名，也请考虑直接带上编码和名称（列表里的投放账户可能多于一页）。
2. **数的类型。** `pageViews`、`clicks`、`installs`、`registered`、`unattributedInstalls` 是整数；`clickRate`、`installRate`、`registerRate` 是 0 到 1 的小数；`cost`、`cpa`、`cpi` 是数还是十进制字符串？**暂定：** 两种都接受。页面显示的比率和每单位花费都用页面上的分子分母重新算（契约写明"用汇总后的分子分母再算"），分母为 0 或负数一律显示"—"；只有缺分子或分母时才用后端给的值。
3. **"未归因"行。** **暂定：** 只在 `groupBy=campaign` 且没有选 `campaignId` 时有一行 `campaignId=0`、只有 `unattributedInstalls`；选了 `campaignId` 时没有这一行；`groupBy=day` 的各日行里页面不读 `unattributedInstalls`。请确认，如果按日也要看自然量，需要说明字段放在哪。
4. **导出 `attribution-performance` 的参数。** 契约写"参数与对应报表相同"。**暂定：** 页面发 `from`、`to`、`campaignId`（选了才发）和 `groupBy=campaign`。导出是按投放账户汇总还是按日、是否接受 `groupBy`，请确认。
5. **成本币种怎样让只有 `ATTRIBUTION:VIEW` 的管理员读到？** `attribution.cost_currency` 的编辑权限是 `ATTRIBUTION:MANAGE`，`GET /config` 不会给只有 `ATTRIBUTION:VIEW` 的管理员。**暂定：** 页面读不到时，投放效果表头不写币种，只写数。请求：`GET /meta` 增加 `attributionCostCurrency`（与已有的 `attributionClickRetentionDays` 同理），或在 `performance` 的响应里带 `currency`。

## 二、投放账户

1. **`PUT /attribution/campaigns/{id}` 是整条替换还是只改带来的字段？** **暂定：** 页面总是发完整的字段（状态开关也一样：整条 `PUT`，只改 `enabled`），不带 `code`，令牌只在人输入了新令牌时才带。如果支持只带 `enabled`，页面可以更小。
2. **创建时 `enabled` 的默认值。** 契约只写"字段 `enabled`"。**暂定：** 页面创建时发 `enabled: true`。
3. **`POST` 一个已有的 `code`。** **暂定：** 409 `DUPLICATE_RESOURCE`，`data.field` 为 `code`；页面在发之前已经按已读到的列表拦住。
4. **怎样清除已设置的 Facebook 访问令牌？** 契约写"响应里永远不返回明文"，只说了设置。**暂定：** 页面不提供清除（留空表示不修改）；如果后端支持用 `null` 清除，请说明，页面再加一个"清除令牌"的确认操作。
5. **`GET /attribution/campaigns/{id}/link` 的两种 400 怎样区分？** 契约写缺像素编号和缺链接根地址都是 400 `INVALID_REQUEST`（后一种 `message` 写明未配置）。前端不显示后端的 `message`（已定：错误码已知时只显示译文），所以页面自己判断：缺像素时不发请求；缺根地址时读 `GET /config` 的 `attribution.link_base_url`，为空就不发请求并写明。请求：这两种都在 `data.details` 里给 `ref`（`platform`、`attribution.link_base_url`）和 `reason`（`EMPTY_NOT_ALLOWED`），页面可以据此显示专用文字，不必依赖前面的判断。
6. **落地页接口地址。** 页面显示 `POST {attribution.link_base_url}/api/attribution/click`（契约 10.4 写落地页放在 `attribution.link_base_url` 所在的域名下，由反向代理转发到后端）。请确认这个地址的写法。

## 三、投放成本

1. **`GET /attribution/costs` 的行。** 契约 §17.4 通则写"实体的列之外只有字段表和点名的字段"。**暂定：** 行是 `AttributionCost` 的列加 `createdByUsername`；没有投放账户的名称，页面用 `campaignId` 对到投放账户列表。是否加 `campaignCode`、`campaignName`？`amount` 在响应里是数还是字符串？（页面两种都接受，显示两位小数。）
2. **`from`、`to` 的写法。** **暂定：** `YYYY-MM-DD`（UTC 日，含两端），页面默认最近 30 天。
3. **单笔 `POST`、`PUT` 的请求体。** 契约没写。**暂定：** `{campaignId, statDate, amount, currency, remark}`，`campaignId` 是字符串，`amount` 是 JSON 数（页面先检查：不小于 0、最多两位小数、整数位不超过 13 位，保证 JSON 数不丢精度）；`PUT` 也带 `campaignId`、`statDate`（值不变，页面里是只读的）。页面读不到 `attribution.cost_currency` 时不带 `currency`。`remark` 为空时传 `null`。
4. **`POST /attribution/costs/batch` 的响应和错误细节。** **暂定：** 成功时页面不读响应，提示用自己的行数。失败时（400 `INVALID_REQUEST`）页面逐条显示 `data.details`：`ref` 原样显示，`reason` 显示 `reason.<码>` 的译文（没有译文就显示码本身，不显示后端的 `message`）。契约没有写 `ref` 的格式。**暂定假后端：** 某一行的问题是 `"<行下标，从 0 起>.<字段>"`（如 `"2.campaignCode"`，投放账户编码不存在用 `OUT_OF_RANGE`），批内重复的 `(campaignCode, statDate)` 是 `"<后一行的下标>"`，条数超限或不是数组是 `"body"`。请给出真实的格式和原因码；有了行号的约定，页面可以写成"第 N 行"。
5. **覆盖的结果。** 契约写批量里已存在的 `(campaignId, statDate)` 按覆盖处理。**暂定：** 页面在弹窗里一直写明这一点（提交前就可见）；成功后，如果响应是 `{"imported": n, "overwritten": m}`（`imported` 是写入的行数，其中 `m` 行覆盖了原来的花费，其余 `n - m` 行是新增；两个都是整数且 `0 <= m <= n`），提示写成"已导入 n 行：新增 n-m 行，覆盖 m 行"。响应里没有这两个数、或数不合理时，提示只写"已导入 n 行"（n 取自己提交的行数），页面不自己去数。请后端确认这两个字段名，或给出真实的字段名。
6. **页面自己加的两条保护（不是契约的要求）。** 一个 CSV 文件大于 5 MB 页面不读（读进浏览器内存之前拒绝，提示拆成几个文件）；金额整数位超过 13 位拒绝。批内行数的上限按 `attribution.cost_batch_max`（页面读 `GET /config`，读不到就不检查，由后端拒绝）。

## 四、归因明细

1. **`GET /attribution/clicks` 的 `from`、`to`。** 契约只写了名字。**暂定：** 和 `GET /attribution/records` 一样：ISO-8601 时刻，`from` 含、`to` 不含，按 `clickedAt` 筛；页面把所选的 UTC 日变成 `[from 00:00:00Z, 后一天 00:00:00Z)`。`campaignId` 是字符串。
2. **`GET /attribution/summary` 的 `key`。** 分组值缺失时（例如记录没有 `mediaSource`）是 `null` 还是空串？**暂定：** 两种都显示"—"。
3. **IP 掩码的格式。** 页面不解析、不改写，原样显示后端给的串。

## 五、需要改共享文件的地方（写在任务报告里，不在这里）

`src/pages/config/ConfigRow.tsx` 保存失败时，对没有字段明细的 `INVALID_REQUEST` 会把后端的 `message` 接在译文后面显示，与"错误码已知时只显示译文"的决定不一致。归因参数页（和所有放 `<ConfigForm>` 的页面）都受影响。这不是契约的问题，不需要后端回复。

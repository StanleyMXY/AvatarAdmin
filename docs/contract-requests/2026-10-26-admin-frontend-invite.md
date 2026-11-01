# 给后端的问题：邀请统计、裂变层级、分享统计接口的响应形状和边界

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 23（邀请与分享）。契约 §17.4 邀请管理行和后端第一份回复第 10 条给出了邀请码、邀请记录的字段，`stats`、`depth-stats`、`chain` 的主要字段，以及 `share-funnel`、`share-channels` 返回的是汇总表的行（§17.6 给了表的列）。下面几处没有写清，前端和假后端按"暂定做法"先做，后端回复后再改。这些缺口不阻塞本任务。

## 一、`GET /invites/share-funnel`、`GET /invites/share-channels` 的 `data` 形状

契约只写"返回逐日的 `StatShareFunnelDaily` 行""返回逐日逐分享渠道的 `StatShareChannelDaily` 行"，没有写外层是数组还是 `{items:[…]}`，行里的字段名是不是表的列名，没有行的日子怎么办。

**我们为什么需要：** 分享统计页（规格 5.12）用这两个接口画漏斗、趋势线、饼图和明细表。

**问：**
1. `data` 是 `{"items":[…]}`（同 `/stats/daily`）吗？
2. 行的字段名是不是 §17.6 的列名：漏斗行 `statDate`、`sharePv`、`shareUv`、`linkClickPv`、`linkClickUv`、`downloadClickPv`、`downloadClickUv`、`registered`；渠道行 `statDate`、`shareChannel`、`sharePv`、`shareUv`？日期格式是 `YYYY-MM-DD`？
3. 某一天汇总还没落地（今天、或补数之前）时，是不返回那一行，还是返回数字为 `null` 或 0 的行？
4. `from`、`to` 是含两端的 UTC 日、跨度不超过 `stats.max_range_days`，和 §17.6 的其他报表一致吗？不传时怎么办？
5. 渠道 `shareChannel` 不合格时按契约 §9.2 写成 `unknown`；没有渠道时会不会是空串或 `null`？

**暂定做法：** 前端和假后端按 1、2 的形状；没有行的日子在趋势图里补 0（规格 4.4），在合计里不算；页面总是传 `from`、`to`；行里的数字缺失、不是数字或为负数时按"不知道"显示"—"，不进合计；渠道为空时显示"—"。

## 二、`GET /invites/chain` 的节点形状、`maxDepth` 的含义和账号不存在的错误

契约写 `{root:{accountId,label,joinedAt}, children:[…], totalDescendants, maxDepth}`，`children` 里的节点没有写。

**问：**
1. `children` 里每个节点是不是 `{accountId, label, joinedAt, children:[…]}`（和 `root` 同样的三个字段加子节点）？`joinedAt` 对后代是"被邀请的时间（`InviteRecord.redeemedAt`）"吗？对根是账号创建时间还是它被邀请的时间？
2. 响应里的 `maxDepth` 是"实际到达的深度"（规格 5.12 写"头部显示后代数和实际深度"）还是"请求的深度"的回显？没有后代时是 0 吗？
3. `rootAccountId` 对应的账号不存在时是 404 `RESOURCE_NOT_FOUND` 吗？`rootAccountId` 为空时是 400 `INVALID_REQUEST`、`details` 的 `ref` 为 `rootAccountId` 吗？`maxDepth` 超出 `1..invite.chain_max_depth` 时是 400、`ref` 为 `maxDepth` 吗？
4. 节点数很多时（一个邀请人有几千个后代）会不会截断？页面现在一次画出所有后代。

**暂定做法：** 前端和假后端按 1 的形状（`children` 缺失当作没有子节点）、按 2 的"实际深度"理解（响应的 `maxDepth` 不是数字时，页面自己从树里数）、按 3 的错误；页面显示的是掩码标识（`label`）和时间，不显示 `accountId`。

## 三、`GET /invites/depth-stats` 在范围内没有被邀请人时的值

契约只写了 `avgDepth` 是平均深度、`maxDepth` 是最大深度。范围内没有任何邀请时，这两个值是 `null`、0，还是不返回？

**暂定做法：** 页面把 `null`、缺失、不是数字都显示"—"（不显示 0，不显示 `NaN`）；`depthDistribution` 为空数组时不画柱状图，写"这个范围内没有人被邀请"。假后端在这种情况下返回 `null`。

## 四、`GET /invites/stats` 的 `limit`、`registeredAccounts` 和范围

1. `limit` 超过 200 是 400 `INVALID_REQUEST`、`ref` 为 `limit`，还是静默取 200？页面只发 1 到 200 的整数，不依赖这一点。
2. `registeredAccounts` 是"截至 `to` 当天结束的账号总数"（UTC）吗？页面用它做邀请参与率（`activeInviters / registeredAccounts`）的分母，缺失或为 0 时显示"—"。
3. `daily` 是不是范围内每天一行（没有邀请的日子 `invitees`、`activeInviters` 为 0）？页面对缺的日子补 0。

## 五、`GET /invites/records`、`/invites/codes` 的字段取值

1. `rewardStatus` 的取值（`PENDING`、`REWARDED`、`NOT_ELIGIBLE`）和 `rewardReason` 的取值（`DISABLED`、`OUT_OF_WINDOW`、`ACCOUNT_STATE`、`LIMIT_REACHED`、`SAME_DEVICE`、`PRIOR_ACCOUNT`）我们按契约 §9.1 写进了页面；没有见过的取值页面原样显示。
2. 没有发放时 `inviterCreditsGranted`、`inviteeCreditsGranted` 是 0 还是 `null`？页面 0 显示 0、`null` 显示"—"，不把 `null` 当 0。
3. `GET /invites/codes` 有没有筛选参数（按所有者账号、按邀请码）？规格 5.12 没有要求，页面不提供。
4. 导出 `invite-records` 的筛选参数：页面只带当前列表在用的 `rewardStatus`（没有选时不带）。如果后端要求同时带 `from`、`to`，请说明。

## 六、对规格的一个解读（不需要后端回复，供改规格的会话确认）

规格 5.12 分享统计的"渠道分析"写了分享渠道下拉、饼图、前 5 个渠道趋势线、明细表，没有写下拉选的渠道作用在哪几块。页面的做法：下拉只筛明细表和导出（导出带 `shareChannel`）；饼图和趋势线始终是全部渠道（只选一个渠道时饼图永远是 100% 的一整块，没有意义）。如果规格的意思是下拉要筛全部三块，请告诉我们。

核对于 2026-11-01

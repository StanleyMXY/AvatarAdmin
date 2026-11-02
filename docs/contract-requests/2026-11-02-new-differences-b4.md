# 2026-11-02 新版接口文档里投放管理的筛选，文档没写清的地方（组 b4：投放账户列表与点击明细的筛选、归因汇总的 groupBy）

这份文件只记录差异和缺口；前端当前按下面写的最小做法开发。契约（`docs/shared-snapshots/` 里的快照）不改。行号是新版接口文档 `docs/backend-inputs/2026-11-02-backend-task-java-backend-e07469d1.md` 的行号。

## 1. 投放账户列表的 `keyword`、`enabled`：400 的 `details` 没有写（第 1530 行）

- 文档写：`keyword` 最多 100 个码点；`enabled` 为 `true` 或 `false`，其他 400 `INVALID_REQUEST`。没有写 `keyword` 超长时是不是 400、`data.details` 的 `ref` 和 `reason`；也没有写 `enabled` 不合法时 `details` 的内容。
- 前端现状：输入框把关键字限在 100 个码点，所以页面不会发出超长的值；假后端对超过 100 个码点的关键字答 400 `INVALID_REQUEST`，`details` 为 `keyword`、`TOO_LONG`，对 `enabled` 不是 `true`、`false` 答 `enabled`、`NOT_BOOLEAN`。这两个 `reason` 是假后端自己选的（都在第 112 行的清单里），页面不依赖它们：已知错误码只显示按码翻译的文字。
- 请求：后端说明这两种 400 的 `details`（有没有、`ref` 和 `reason` 是什么）；说明 `keyword` 前后的空白后端是否去掉（页面发之前按契约的空白定义去掉两端）。

## 2. 点击明细的 `keyword`：长度按字符还是码点，超长的 400（第 1486 行）

- 文档写：`keyword` 最多 200 个“字符”；含 U+0000 → 400 `INVALID_REQUEST`，`details` 为 `keyword`、`INVALID_FORMAT`。没有说“字符”是码点还是 UTF-16 单位，也没有写超过 200 时的 400 是什么 `reason`。投放账户列表那一处写的是“码点”。
- 前端现状：输入框按 200 个码点限制；假后端按码点数，超过 200 答 `keyword`、`TOO_LONG`（`reason` 是假后端自己选的），含 U+0000 答 `keyword`、`INVALID_FORMAT`（文档写明的）。如果后端按 UTF-16 单位数，用户输入很多表情符号（每个占两个单位）时，页面认为合法的值会被后端 400，页面此时显示“输入内容不合法”。
- 请求：后端写明“字符”的算法和超长时的 `reason`。

## 3. 点击明细的状态是现算的，选“待认领”时会出现已匹配的点击（第 1486 行）

- 文档写：`PENDING` 是未认领且未过期，`MATCHED` 是已认领；归因记录持有某点击的 `attrId` 时，这个点击也是 `MATCHED`，“所以这样的行可能出现在 `PENDING` 筛选下”。
- 前端现状：列表的状态列按后端给的 `status` 显示；页面在筛选旁写一句说明（`campaign.clicks.status.note`）。假后端的点击状态是存好的，不模拟这种情况。
- 请求：无；记录在此，是因为这个行为会让“筛选值”和“列里显示的状态”不一致，后端如果以后改成两者一致，说明可以去掉。

## 4. 归因汇总的 `groupBy` 缺失或不对：400 的 `details` 没有写（第 1487 行）

- 文档写：`groupBy` 缺失或是别的值 400。没有写 `code`（应为 `INVALID_REQUEST`）和 `details`。
- 前端现状：页面只会发 `source`、`media_source`、`campaign` 三个值，不会触发；假后端缺失答 `groupBy`、`EMPTY_NOT_ALLOWED`，取值不对答 `groupBy`、`OUT_OF_RANGE`（都在第 112 行的清单里）。页面遇到这个 400 只显示 `INVALID_REQUEST` 按码翻译的文字，并有“重试”按钮。
- 请求：后端说明这个 400 的 `details`；前端不依赖它。

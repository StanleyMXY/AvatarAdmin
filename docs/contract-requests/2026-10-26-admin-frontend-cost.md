# 给后端的问题：成本报表和价格接口的字段类型、分页、筛选和写接口的细节

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端任务 26（成本）。契约 §14.2、§17.4 成本行、§17.6 `usage-cost` 和后端第一份回复的第 12 条已经给出价格批次、待审批次、模型登记的字段；下面几处它们都没有写清，前端和假后端按"暂定做法"先做，后端回复后再改。没有一条阻塞本任务。

## 一、`GET /stats/usage-cost` 里 `costAmount` 和 `quantity` 的 JSON 类型

契约 §14.2 写费用用十进制类型、汇总费用是 `numeric(24,10)`，价格接口（第一份回复第 12 条）明确是字符串；§17.6 只列了列名，没写 `costAmount`、`quantity` 在 JSON 里是字符串还是数。JSON 数在浏览器里解析成浮点，`0.0000000001` 这样的小额、十位小数的总和会丢位或变成 `1e-10`。

**我们为什么需要：** 成本报表要把同一币种的金额精确相加、显示最多 6 位小数，不能经过浮点。

**问：** `costAmount`（和 `quantity`，秒数、分钟数可以有小数）能不能和价格一样用字符串形式的十进制数返回？

**暂定做法：** 前端两种都收：字符串原样保留，数用 JavaScript 写出的十进制文字展开（不带指数）；之后全部用文字做精确加法。如果后端回的是数，精度在 JSON 解析时已经丢了，这是前端补不回来的。

## 二、`GET /usage/prices`、`GET /usage/models` 的分页参数、默认页大小和筛选

契约只写了 `GET /usage/prices?resourceType=&provider=&model=&unit=&status=`，响应有 `total`，没有写 `page`、`pageSize` 是否支持、默认页大小、上限；`GET /usage/models` 没有写任何参数。

**我们为什么需要：** 当前价格页要把同一个模型的全部批次放在一起（按模型分组，历史批次展开），模型页要按"没有生效价格"和资源类型筛选。

**问：**
1. 两个接口是否接受 `page`、`pageSize`（同其他列表，1 到 200）？不传时默认返回多少条？
2. `GET /usage/models` 能不能加 `hasActivePrice=false`、`resourceType=` 筛选？

**暂定做法：** 前端发 `page`、`pageSize=200`，一页一页读到 `total` 为止（最多 50 页，读不全时页面写明"只读到了 N 条里的 M 条"），筛选在前端做。

## 三、`PUT /usage/models/{id}` 的请求体细节

契约写了 `{syncAdapter, syncModelId}`。没写：取消适配器时 `syncAdapter` 传 `null` 还是空字符串；`syncAdapter` 为空时 `syncModelId` 还要不要；`syncModelId` 的长度上限；对非 `LLM` 的模型设适配器返回什么错误（我们假定 400 `INVALID_REQUEST`，`details` 的 `ref` 为 `syncAdapter`）。

**暂定做法：** 取消适配器发 `null`；`syncModelId` 始终发（去首尾空白，1 到 128 个字符，页面先检查）；非 `LLM` 的模型页面不让选适配器。

## 四、`POST /usage/prices` 的响应，以及 400 的 `details` 的 `ref` 和 `reason`

契约没写成功时的 `data`（新批次？`batchId`？），也没写档位或价格不合法时 `details` 用什么 `ref`、`reason`（例如 `bands`、`bands[0].inputPrice`，`reason` 取 `OUT_OF_RANGE` 之类）。`confirm` 因档位不连续被拒绝时同样。

**我们为什么需要：** 页面在确认框里显示"为什么被拒绝"；前端只显示 `error.<码>` 和已经有译文的 `reason.<码>`，不显示后端的 `message`。

**暂定做法：** 不读成功时的 `data`；`details` 里有译文的 `reason` 逐条显示，没有译文的略去；假后端用 `ref=bands`、`ref=currency`、`ref=effectiveFrom`、`ref=unitPrice`，`reason=OUT_OF_RANGE`。需要更具体的原因（缺口还是重叠）时，请后端给出 `reason` 代码，前端再加译文。

## 五、价格上限 1000000 是否在前端检查

契约写价格"不大于 1000000"。任务书要求 `12345678.1234567890` 这样的值在读取、显示、提交中保持字符串不变，所以前端只检查格式（只有数字 0-9、最多十位小数、无符号、无指数），上限交给后端：超过时后端返回 400，页面显示 `error.INVALID_REQUEST` 的译文。请确认这个分工，或者告知前端也要检查上限。

## 六、价格页没有"自己填的不能自己确认"这样的规则

契约和规格里价格批次没有双人复核的规则：`PENDING_REVIEW` 只能由价格同步生成（`source=SYNC`），手填的批次直接是 `ACTIVE`，撤回和驳回也没有"不能是同一个管理员"的限制。所以页面没有做自我复核的拦截。如果运营要这条规则，请在契约里写成完整的规则（哪些接口、错误码），前端再按额度调账申请（`SELF_REVIEW_FORBIDDEN`）的做法加上。

## 七、告警页接受 `type` 的地址参数

价格页顶部的"未关闭告警条数"链接到 `/monitor/alerts`。告警页（任务 14 的页面）现在不读地址里的 `type`，所以不能直接带"模型没有价格"的筛选；这是前端内部的事，不需要后端回复，写在这里是因为它是规格 5.23 "点击进告警页"的落点。

## 八、非 LLM 批次的 `unitPrice` 在 JSON 里是字符串还是数

后端第一份回复第 12 条对同一件事说了两句：前面写"价格一律是字符串形式的十进制数"，后面写"其他类型 `unitPrice` 是数"。两句不能同时成立。

**我们为什么需要：** 单价最多十位小数，JSON 数在浏览器里解析成浮点，`0.0000000001` 这样的小额或十位小数的单价会丢位或变成 `1e-10`。待审批次的"当前价格对比"、当前价格页都要把单价原样显示，不能经过浮点。

**问：** 非 LLM 批次（`IMAGE_EDIT`、`IMAGE_TO_VIDEO`、`MATTING`、`DRIVING_PREP`、`AGE_ESTIMATION`、`CLOUD_RENDER`）的 `unitPrice` 在 `GET /usage/prices`、`GET /usage/price-batches/pending`（包括 `active` 里的那一份）里是字符串还是数？能不能和 LLM 的三个价格一样用字符串？

**暂定做法：** 前端两种都收：字符串原样保留，数用 JavaScript 写出的十进制文字展开（不带指数）；提交 `POST /usage/prices` 时单价始终是字符串。如果后端回的是数，精度在 JSON 解析时已经丢了，这是前端补不回来的。

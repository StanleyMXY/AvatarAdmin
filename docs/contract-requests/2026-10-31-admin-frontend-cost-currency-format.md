# 给后端的问题：`attribution.cost_currency` 收到格式不对的币种时，后端怎么答

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端处理后端清单 a9、e4（成本币种锁）时，评审指出的一个缺口：清单只写了“有成本行时改币种 → 400 `INVALID_REQUEST`，`details` 为 `[{"ref":"attribution.cost_currency","reason":"OUT_OF_RANGE"}]`”，没有写币种本身格式不对时后端答什么。契约 17.5 只说该键是“ISO 4217 三位字母”，默认 `USD`。

## 前端现在怎么做

- 系统配置页和归因参数页（`/campaign/settings`）里，这个键的输入框在提交前检查：必须正好是三位大写字母（`^[A-Z]{3}$`）。不合格时保存按钮是灰的，框下面写“币种必须是三位大写字母的币种码（ISO 4217），例如 USD”，请求不发出。
- 因此页面发给后端的值总是格式合法的；后端对这个键答 `OUT_OF_RANGE` 时，页面一律解释为“已有成本行，不能改币种”。
- 页面不检查三位大写字母是不是真实存在的 ISO 4217 币种（例如 `ZZZ`）；这一项交给后端。

## 请后端确认

1. 对格式不对的值（`usd`、`euro`、`US`、空串、带空格的值）`PUT /api/admin/config/attribution.cost_currency` 是否拒绝？拒绝时答什么：状态码、`code`、`details` 里的 `ref` 和 `reason`？若答的 `reason` 也是 `OUT_OF_RANGE`，页面无法区分“格式错”和“有成本行”，请改用不同的 `reason`（建议 `INVALID_FORMAT` 或沿用 `INVALID_REQUEST` 不带 `OUT_OF_RANGE`）。
2. 小写的 `usd` 是被拒绝，还是被改成大写后保存？页面现在要求用户自己写大写。
3. 三位大写字母但不是真实 ISO 4217 币种（`ZZZ`）是否拒绝？答什么？
4. 用量价格的币种允许列表（`usage_price.allowed_currencies`）是否也管这个键？（页面现在认为不管：成本币种与价格币种是两个设置。）

**暂定做法：** 如上；假后端目前对这个键只做“有成本行时不能改”一种拒绝。

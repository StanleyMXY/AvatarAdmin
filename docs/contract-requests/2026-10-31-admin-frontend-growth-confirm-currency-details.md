# 给后端的问题：确认待审批次时币种被拒，`details` 里要有 `currency`

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端（成本价格），后端第一批交付清单 a8 ②（`POST /api/admin/usage/price-batches/{batchId}/confirm` 的币种检查）。没有阻塞当前任务。

## 缺什么

清单只写了这次拒绝的 `message`（`currency must be one of usage_price.allowed_currencies`），没有写 `data.details`。同一个接口的日期错误、档位错误是用 `details` 的 `ref` 区分的；按负责人的规则，界面对已知错误码只显示按码翻译的文字，不显示后端 `message`，所以没有 `details` 时页面只能说"输入内容不合法"，运营看不出是币种的问题。

## 我们需要什么

币种被拒时 `data.details` 为 `[{"ref":"currency","reason":"OUT_OF_RANGE"}]`（与同一个接口的日期、档位错误同形，`ref` 取请求体里的字段名 `currency`，即使这次请求体没有给 `currency`、用的是批次自己的币种）。

## 当前做法

页面在确认前就把币种选项限制在 `GET /meta` 的 `allowedCurrencies` 里，批次自己的币种不在列表里时不让点确认；后端仍拒绝时（列表已改、列表读不到），确认框里：`details` 有 `ref=currency` 就显示"这个批次最终使用的币种不在允许币种里，批次仍待审核"；没有 `details` 就只显示"输入内容不合法，请检查后重试"。假后端按上面的形状返回，检查顺序为批次不存在（404）→ 日期 → 币种 → LLM 档位 → 状态（409）。

核对于 2026-11-01

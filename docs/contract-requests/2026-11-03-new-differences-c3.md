# 新差异请求：c3 组（2026-11-03）

范围：渲染模型的 `fileRef`（请求 11）、推送发送结果的 `platform` 和 `tokenSuffix`（12）、推送模板写入 400 的 `data.case`（35）、`PUT /cosmetics/{id}` 的 `kind`（97）。后端实现说明和更新接口文档里查不到的细节如下；前端当前都按各条写的最小做法开发，不等回答。

## 1. `PUT /cosmetics/{id}` 里 `kind` 为 `null` 或空字符串

- 接口文档（2378 行）写的是“带了且与现值不同 → 400 `INVALID_REQUEST`，`details` 为 `[{"ref":"kind","reason":"OUT_OF_RANGE"}]`；省略时保持现值”，和 `key` 的处理相同。没有写 `kind: null` 和 `kind: ""` 算“省略”还是“与现值不同”。
- 前端现在：页面编辑表单根本不发 `kind`，不受影响。假后端把 `null` 当作省略（与它对 `key` 的处理一致），`""` 和其他不同的值一律 400 `OUT_OF_RANGE`。
- 想请后端确认：`null` 和 `""` 各是什么结果。

## 2. 推送模板写入 400 的 `data.case`：改触发原因时用哪一个

- 说明里 `DEFAULT_REQUIRED_BY_OTHERS` 是“这次写入会停用或改走默认语言模板，而其他语言仍启用”。一次 `PUT` 同时把默认语言模板从原因 A 改到原因 B 时，两个原因都要检查（假后端先判原因 A）。没有写这时 `data.reason` 和 `data.case` 取哪一个原因的、哪一种情形。
- 前端现在：只按返回的 `case` 和 `reason` 显示对应文字，不推断；假后端在这种写入里按原因 A（被改走的原因）返回 `DEFAULT_REQUIRED_BY_OTHERS`，`reason` 是原因 A。
- 想请后端确认：两个原因都违规时的返回顺序。

## 3. 推送发送结果的 `tokenSuffix` 不足 6 位、`platform` 出现别的取值

- 更新接口文档写 `platform` 是 `ANDROID`、`IOS`，`tokenSuffix` 是 token 的末 6 位，没有写令牌短于 6 位时是整个令牌还是 `null`，也没有写以后加平台时取值会不会扩展。
- 前端现在：`tokenSuffix` 是什么字符串就原样显示（不补位、不截断）；`platform` 不是 `ANDROID`、`IOS` 的字符串原样显示，不是字符串显示“—”。
- 不需要后端回答也能继续；仅告知。

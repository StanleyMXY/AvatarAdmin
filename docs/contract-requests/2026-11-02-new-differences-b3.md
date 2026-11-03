# 新版接口文档里查不到的细节（组 b3：订阅、签到活动、应用版本号、照片里的人投诉）

对应 `docs/contract-requests/2026-11-02-contract-version-diff.md` 第二节的第 6、8、12、13 条。下面每一项都是新版接口文档
（`docs/backend-inputs/2026-11-02-backend-task-java-backend-e07469d1.md`）里没有写、而前端和假后端必须选一种做法的地方。当前都按最小的做法开发，
等后端回答后再改。

## 1. 删除形象 `remove-avatars` 的检查顺序（11.6）

文档写了各种错误的取值，但没写它们之间的先后：已结案的投诉（409 `INVALID_STATE`）和找不到的形象（404 `RESOURCE_NOT_FOUND`）同时出现时先答哪个；
`assetIds` 的 400 和 409 谁在前。对照同一节里状态流转的写法“投诉不存在 404 → 请求体 400 → 状态 409”，假后端取：投诉 404、请求体 400、
已结案 409、形象 404。想确认：形象 404 是否在已结案 409 之后。

## 2. 删除形象里“UUID 字符串”的写法

文档说“元素不是 UUID 字符串”是 400 `OUT_OF_RANGE`，没说是否只收 36 个字符带连字符的写法（Java 的 `UUID.fromString` 对段长要求较松，
会收下 `1-1-1-1-1` 这样的值）。前端和假后端只收 36 个字符、带连字符、大小写都可以的写法。想确认：后端是否也只收这一种；不带连字符的 32 位十六进制是否算 UUID。

## 3. 投诉状态的 `note` 含控制字符时的错误

文档只说“`note` 不得含控制字符（含换行），否则 400”，没写 `data.details`。假后端答 400 `INVALID_REQUEST`，只有 `message`，没有 `details`。
想确认：是否有 `{"ref":"note","reason":"..."}`（例如 `CONTROL_CHARACTER`，那是 10.5 的原因代码），以及“控制字符”是否指 Unicode 的 Cc 类
（U+0000 到 U+001F 和 U+007F 到 U+009F，含制表符和换行），还是只是换行和 NUL。前端按 Cc 类预检，包括在备注框里按回车产生的换行。

## 4. 版本号比较失败（400）没有指向字段的 `details`

后端回答第 47 条和 24.2 都写“400 `INVALID_REQUEST`，`message` 写明 `versionCode`”，也就是没有 `data.details`。因为已知错误码页面只显示按码翻译的
文字，用户在后端拒绝时只会看到通用的“请求不合法”，看不到要大于哪个数。前端在提交前已用列表里读到的各版本做了预检并写明要大于几，所以
正常情况不会走到这里；但列表读到之后别人又加了版本时，只能看到通用文字。建议后端补 `data.details = [{"ref":"versionCode","reason":"OUT_OF_RANGE"}]`
（页面就能把错误放到版本号输入框下面），并在 `data` 里给出要大于的最大值。这是建议，不阻塞。
- 后端已于 2026-11-03 回答/实现一部分（请求编号 92，后端实现说明第三节 92 号）：版本写接口里由请求字段引起的 400 现在带 `data.details` `[{ref, reason}]`（`ref` 含 `versionCode`，`reason` 含 `OUT_OF_RANGE`）；版本号大小比较失败这一种实现说明没有逐项写，按总规则应带 `ref=versionCode`，我还没查清，已列入 `2026-11-03-contract-gaps.md` 的 G7。要大于的最大值仍写在英文 `message` 里。

## 5. 签到活动 `PUT …/status` 停用时的响应

文档说 `PUT /checkin/activities/{id}` 与 `…/status` 都返回 `{applied, disabledActivities, activity}`，没单独写 `ACTIVE → DISABLED`（停用）的响应。
假后端对停用也答 `{applied: true, disabledActivities: [], activity: <详情>}`。想确认停用时是否确实是这个形状（前端不读停用的响应，只在成功后重新读取列表）。
另外：`confirm=false` 且没有重叠时，`applied: true` 的响应里 `disabledActivities` 是否一定为空（前端按 `applied` 判断，不看它，所以这里不影响正确性）。

## 6. 订阅列表项里的 `periodOrderId`

15.3 说 `GET /subscriptions/{id}` 返回全部列，`GET /subscriptions` 每项是 `Subscription` 的列（2451 行）；所以列表项也带 `periodOrderId`，假后端也这样做。
前端只在详情抽屉显示它，列表不显示。无需回答，只是记下这个理解。

核对于 2026-11-03

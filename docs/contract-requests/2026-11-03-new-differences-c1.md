# 2026-11-03 后端实现说明和更新接口文档里订阅令牌、短信渠道凭据、保护性 400、管线来源、记忆模型冲突，没写清的地方（组 c1：请求 2、5、41、103、137）

这份文件只记录差异和缺口；前端当前按下面写的最小做法开发。契约（`docs/shared-snapshots/` 里的快照）不改。"后端实现说明"指 `docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md`，"更新接口文档"指同目录 `2026-11-03-backend-task-java-backend-updated.md`（行号指它）。

## 1. 请求 5：同时缺名称又多名称时，`details` 是哪一项（第 3852 行）

- 文档写：给了凭据时名称必须恰好是 `credentialNames`；缺少名称 → `credentials`、`EMPTY_NOT_ALLOWED`，多出名称 → `credentials`、`OUT_OF_RANGE`。没有写一个请求既缺又多时 `details` 是两项还是只有一项、先报哪个。
- 前端现状：页面按所选供应商的 `credentialNames` 生成输入框，只在每个框都填了的时候才发 `credentials`，所以正常不会触发；假后端在既缺又多时只答一项 `EMPTY_NOT_ALLOWED`（缺的优先）。页面对这两个原因各显示一句固定的文字（`sms.channels.credentialsRefused.*`），同时出现时显示后出现的那一项。
- 请求：后端说明既缺又多时的 `details`。

## 2. 请求 5：空字符串的凭据值（第 3852 行）

- 文档写：值可以是空字符串（不检查是否为空）。
- 前端现状：页面把空白当作"没填"：只要有一个框是空白，页面就要求补全（或者全部留空表示保留已存的），所以页面不会发出空值。如果某个供应商有可以为空的凭据，页面目前没有办法为它保存空值。
- 请求：后端说明是否有这样的供应商；没有的话不必处理。

## 3. 请求 5：`credentialNames` 的顺序和重复（第 3854 行）

- 文档写：字符串数组，本地桩通道为空数组。没有写顺序有没有意义、名称会不会重复。
- 前端现状：输入框按数组给的顺序排，名称重复会让两个框用同一个键，所以前端当作不会重复；不是字符串的项被丢掉。
- 请求：后端说明名称不会重复（或者说明重复时怎么处理）。

## 4. 请求 41：`COUNTRY_LOSES_OTP_CHANNEL` 的国家范围（第 3833 行）

- 文档写：还有别的启用的 `OTP` 通道，但 `sms.allowed_country_codes` 里某个原来有通道覆盖的国家会失去覆盖。
- 前端现状：页面操作前的提示按渠道列表自己判断"是不是最后一个覆盖某国的通道"（不读 `sms.allowed_country_codes`，也读不到：需要配置权限），所以可能多问一次或少问一次；被拒绝时显示按原因代码翻译的固定文字，以后端为准。
- 请求：无；记录在此，是因为这个判断只有后端有完整信息。如果后端愿意在 `GET /sms/meta` 里给出 `allowedCountryCodes`，页面可以精确判断。

## 5. 请求 2：令牌不足 6 位、`sourceEventId` 里没有冒号（第 2394 行、第 2451 行）

- 文档写：`sourceEventId` 第一个 `:` 之前的部分截成末 6 位；`storeRefSuffix` 是 `storeRef` 的末 6 位。没有写令牌不足 6 位时给什么，也没有写 `sourceEventId` 里没有冒号时是不是整串当作"之前的部分"。
- 前端现状：页面不解析 `sourceEventId`，只在事件列表和时间线之外不显示它；`storeRefSuffix` 原样显示。假后端不足 6 位时给整串，没有冒号时把整串当作冒号之前的部分。页面不依赖这两个行为。
- 请求：后端说明这两种边界。

## 6. 请求 2：Apple 订阅的 `storeRefSuffix`（第 2451 行）

- 文档写：两个接口里都给 `storeRefSuffix`；`store` 为 `GOOGLE` 时 `storeRef` 为 `null`，其他商店的 `storeRef` 照旧完整返回。没有写 Apple 行的 `storeRefSuffix` 是不是也给。
- 前端现状：Apple 行显示完整的 `storeRef`（它是 App Store Connect 里查单用的标识，不是凭据）；GOOGLE 行只读 `storeRefSuffix`。假后端对 Apple 行也给 `storeRefSuffix`。页面不依赖 Apple 行有没有 `storeRefSuffix`。
- 请求：无。

## 7. 请求 103：`sources` 与 `truncated`（第 1824 行）

- 文档写：`sources` 是从现在往前 `monitor.max_range_days` 天内有快照的全部 `source`。没有写这个列表有没有上限，和请求没有数据时（`items` 为空）是不是仍然给。
- 前端现状：页面把 `sources` 整个放进下拉；没有这个字段（旧后端）时下拉是空的，但正在选中的来源仍然显示。假后端没有任何上报时 `sources` 为 `[]`。
- 请求：后端说明来源很多时是否有上限。

## 8. 请求 137：其他 409 里 `data` 的形状（第 2312 行）

- 实现说明写：记忆服务的其他 409 现在也是 `{detail, registeredDimensions}`，只是 `registeredDimensions` 为 `null`。更新接口文档只写了模型登记的 409。
- 前端现状：页面只对 `MEMORY_MODEL_CONFLICT` 读 `registeredDimensions`，是正整数就在译文里带上，其余（`null`、不是整数、缺失）只显示该码的译文；不读、不显示 `detail`。
- 请求：无。

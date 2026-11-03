# 2026-11-03 后端实现说明和更新接口文档里没写清的地方（组 c5：价格写入和确认的 `details`、用量模型筛选、成本批量的 `overwritten`、`GET /meta` 新增五个字段、推送记录的日期筛选）

这份文件只记录差异和缺口；前端当前按下面写的最小做法开发。契约（`docs/shared-snapshots/` 里的快照）不改。行号是更新接口文档 `docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md` 的行号。

## 1. 价格写入和确认的 `details`：路径里的下标从几起、几个字段的 `ref`、缺口和重叠落在哪个字段（第 1921 行）

- 文档写：`POST /usage/prices` 和 `confirm` 的校验 400 带 `data.details`；`ref` 是出错字段的路径（`resourceType`、`unit`、`currency`、`unitPrice`、`bands`，或具体字段如 `bands[1].inputMinTokens`），`reason` 取 `EMPTY_NOT_ALLOWED`、`OUT_OF_RANGE`、`NOT_AN_INTEGER` 之一；档位的缺口和重叠也用这三个，没有专门的代码。没有写：
  1. 路径里的下标是从 0 起还是从 1 起（例子 `bands[1]` 看不出）；
  2. `provider`、`model`、`effectiveFrom`（文档写了它们的校验：去空白后 1 到 128 个字符、有效日期）出错时 `ref` 是不是字段名本身、`reason` 是什么（超过 128 个字符是 `OUT_OF_RANGE` 还是 `TOO_LONG`；`TOO_LONG` 不在这三个里）；
  3. 缺口、重叠、第一档不从 0 起、最后一档有上限、中间一档没有上限、上限小于下限分别落在哪个字段、用哪个 `reason`；档位列表为空或超过 `usage_price.max_bands` 时 `ref` 是不是 `bands`；
  4. 价格不是数、为负、超过 10 位小数、大于 1000000 时，用 `OUT_OF_RANGE` 还是 `NOT_AN_INTEGER`（页面和假后端按前者）；`cachedInputPrice` 可空，空串算不算 `EMPTY_NOT_ALLOWED`。
- 前端现状：下标按从 0 起读（第 `n` 个档位行显示为“第 n+1 档”）；`provider`、`model`、`effectiveFrom` 按字段名读。页面不依赖具体的 `reason` 和字段：`ref` 能对到表单上的字段（`resourceType`、`unit`、`provider`、`model`、`currency`、`effectiveFrom`、`unitPrice`、`bands`、`bands[n].inputMinTokens`、`bands[n].inputMaxTokens`、`bands[n].inputPrice`、`bands[n].cachedInputPrice`、`bands[n].outputPrice`，n 不超过现有档位数）就写在那个字段下面；对不上的写在表单上方，只显示按 `reason` 翻译的文字；`reason` 没有翻译时字段下面写“后端没有接受这个值”，表单上方的行不写。假后端的选择：缺口、重叠和第一档不从 0 起落在下限字段（`OUT_OF_RANGE`），最后一档有上限落在上限字段（`OUT_OF_RANGE`），中间一档没有上限落在上限字段（`EMPTY_NOT_ALLOWED`），上限小于下限落在上限字段（`OUT_OF_RANGE`），边界不是整数 `NOT_AN_INTEGER`、为负 `OUT_OF_RANGE`，价格没给 `EMPTY_NOT_ALLOWED`、不合格 `OUT_OF_RANGE`，`provider`、`model` 为空 `EMPTY_NOT_ALLOWED`、超长 `TOO_LONG`。
- 请求：后端写明下标的起点，和上面第 2、3 点各情形的 `ref`、`reason`。

## 2. `confirm` 的档位错误：确认对话框里没有对应的输入框（第 1921 行）

- 文档写：`confirm` 重新校验档位边界，400 的 `details` 形状同手填。
- 前端现状：待审批次的档位在确认对话框里是只读对比表，没有可以挂提示的输入框，所以确认对话框把 `bands[n].<字段>` 写成一行“第 n+1 档：<字段的名字>：<原因>”，`currency` 的写法见 `2026-10-31-admin-frontend-growth-confirm-currency-details.md`。
- 请求：无。

## 3. 用量模型的 `resourceType` 取值、空参数（第 1922 行）

- 文档写：`resourceType` 取资源类型之一，`hasActivePrice` 取 `true` 或 `false`，都可省略，其他值 400 `INVALID_REQUEST`（不带 `details`）。没有逐个写出资源类型的取值，也没有写参数是空串时算不算省略、`true`/`false` 是否区分大小写。
- 前端现状：`resourceType` 按价格表的七个资源类型（`LLM`、`IMAGE_EDIT`、`IMAGE_TO_VIDEO`、`MATTING`、`DRIVING_PREP`、`AGE_ESTIMATION`、`CLOUD_RENDER`，14.2 的资源类型表）发，筛选没选时不发这个参数；`hasActivePrice` 只发小写的 `false`（“只看没有生效价格的模型”勾选时），不勾选时不发。假后端把空串当作省略，`TRUE`、`1` 之类当作非法。页面不依赖这几点。
- 请求：后端写明取值和上面两点。

## 4. 成本批量的 `overwritten` 的上下界（第 1535 行）

- 文档写：响应 `{"count":N,"overwritten":M}`，`count` 是写入的行数，`overwritten` 是其中覆盖了已存在日期的行数，整数。没有写 `overwritten` 一定在 0 到 `count` 之间（从含义推出）。
- 前端现状：`overwritten` 不是 0 到 `count` 之间的整数，或者没有（旧形状 `{count}`）时，提示退回“已导入 n 行”，不写覆盖几行。
- 请求：无。

## 5. `GET /meta` 新增的五个字段：页面里谁用、谁没用（第 2393 行）

- 前端现状：`monitorMaxRangeDays` 用在管线监控页的时间范围按钮（只提供不超过它的几档，取不到时按原来写死的 7 天）；`taskTypes` 用在任务配置页的筛选和新建/编辑对话框（取不到或为空时按原来的三个类型；清单没有的类型、但任务自己有，仍可选）；`entitlementLimitMax` 用在额度类功能值（`LIMIT`）的输入（权益的功能值和功能开关的默认值）：输入框旁写最大值，超过时不发请求（取不到时不预检）。
- 没有用的两个：`creativeAspectTolerancePercent`（素材宽高比预检在广告素材页，属于广告目录，本组不碰；该页现在读 `GET /config` 的 `ads.creative_aspect_tolerance_percent`，取不到时按 3%；可改成读 `useAdminMeta().creativeAspectTolerancePercent`，它对任一管理员可读）和 `googlePlayPackageName`（商店链接预检在应用版本目录的 `storeUrl.ts` 一带，属于应用版本，本组不碰；要改成预检用 `useAdminMeta().googlePlayPackageName`，它为 `null` 时没有可预检的包名，交给后端）。类型、`useAdminMeta`、假后端的 `GET /meta` 已提供这两个字段。
- 假后端：`monitorMaxRangeDays`、`entitlementLimitMax`、`creativeAspectTolerancePercent` 跟着 `PUT /config` 保存的 `monitor.max_range_days`、`entitlement.limit_max`、`ads.creative_aspect_tolerance_percent`；`taskTypes` 是三个固定类型，任务配置的假后端也按它校验；`googlePlayPackageName` 固定为一个包名（`null` 的情形在 `getAdminMeta` 的测试里有一例）。假后端的订阅写入仍把权益额度的上限写死为 1000000（和配置的默认值相同），没有跟着 `entitlement.limit_max` 变。
- 请求：无。

## 6. 推送记录的日期筛选：两个参数都有问题、空参数、与别的筛选一起出错（第 2381 行）

- 文档写：日期格式不对或 `to` 早于 `from` → 400 `INVALID_REQUEST`，`details` 为 `[{"ref":"from"或"to","reason":"OUT_OF_RANGE"}]`（格式不对时 `ref` 是出错的那个参数，先查 `from`；`to` 早于 `from` 时 `ref` 一律是 `to`）。没有写：两个参数都不是日期时只给 `from` 一项还是两项；参数是空串时算不算省略；同时有 `accountId` 或 `triggerReason` 不合法时 `details` 是否一起列出。
- 前端现状：页面只在勾选“只看创建日期在某个范围内的记录（UTC）”之后才发 `from`、`to`，而且总是两个一起发（共用的日期范围控件总是有两端，且不允许起点晚于终点）；所以各自省略、格式不对、`to` 早于 `from` 页面自己发不出，这几种 400 只会来自与后端的时钟、版本不一致，页面把指向 `from` 或 `to` 的错误交给日期范围控件显示。假后端：`from` 不合法只给 `from` 一项，`from` 合法而 `to` 不合法只给 `to` 一项，`to` 早于 `from` 给 `to` 一项；空串当作省略；和 `accountId`、`triggerReason` 的错误一起列出。
- 请求：后端写明上面三点。

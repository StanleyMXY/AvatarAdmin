# 后端实现说明第五节"没有核实的部分"与更新接口文档的对照，以及接口文档里还缺的几句（给负责人，转给改契约的人）

**读者：** 负责人，由他决定谁在 AvatarApp 的 `main` 上改 `docs/backend-task-java-backend.md`（接口文档）。本仓库 `docs/shared-snapshots/` 是只读快照，没有改；`docs/backend-inputs/` 里的文件也没有改。

**来源和方法：** 后端 2026-11-03 的实现说明（`docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md`）第五节有 4 条"后端没有核实的部分"。我把这 4 条逐条对照更新接口文档（`docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`，行号指它），另把实现说明第三节的每一行对照了接口文档里的措辞，看有没有互相矛盾或接口文档没写的地方。没有读到后端代码，也没有运行任何请求。

## 一、第五节 4 条的对照结果

| 第五节 | 后端说的 | 更新接口文档里有没有 | 结论 |
|---|---|---|---|
| 1 | 全量集成测试没有在后端开发环境里跑，只跑了相关测试和架构测试；全量集成测试在代码推送后由持续集成运行；应用服务和后台任务两个模块只编译、没有跑它们的测试（推送发送逻辑在这两个模块里也会运行） | 不是接口文档的内容 | 不需要改契约。要等后端告知持续集成的结果；前端对着真实后端联调时，推送发送（记录详情的 `platform`、`tokenSuffix`）和后台任务相关的页面要多看一眼。这是后端一侧的事，不算前端的阻塞 |
| 2 | 实现说明的措辞、字段名和取值以接口文档为准，有出入时以接口文档为准 | 本身是一条处理原则 | 我对照了实现说明第二、三节的每一行与接口文档对应的行（第 111、112、150、1535、1824、1921、2312、2344、2377、2381、2392–2395、2438、2451、2457、3717、3833、3852、3854、3924、3926、3988、4255 行），没有发现两者互相矛盾；有三处措辞不同但意思一致：103 号实现说明写"最近 `monitor.max_range_days` 天内有过上报"，接口文档（1824 行）写"有快照（按 `effectiveAt`）"；60 号和 12 号的字段集合一致；122 号接口文档（3717 行）写明了计数的条件。接口文档里没写的几句见第二节 |
| 3 | 41 号的四个新 `reason` 值需要扩充接口文档里原有的封闭 reason 集合；`PUT /cosmetics/{id}` 的 `kind` 规则需要补一句；若附上的接口文档没有这两处，以实现说明为准并告知后端 | **有**。第 112 行 `INVALID_REQUEST` 一行的清单已列 `LAST_OTP_CHANNEL`、`COUNTRY_LOSES_OTP_CHANNEL`（`ref` 为 `SmsChannel`）、`LAST_OTP_TEMPLATE`、`LAST_ENGLISH_FALLBACK_TEMPLATE`（`ref` 为 `SmsTemplate`），并引用 23.4（第 3833 行有各自的情形）；第 2377 行写了"`PUT /cosmetics/{id}` 的 `key` 和 `kind` 创建后都不能改：带了且与现值不同 → 400 `INVALID_REQUEST`，`details` 为 `[{"ref":"key","reason":"OUT_OF_RANGE"}]` 或 `[{"ref":"kind","reason":"OUT_OF_RANGE"}]`；省略时保持现值"。用 `scripts/contractErrors.ts` 的 `reasonCodes` 数过：更新版 1.4 的原因代码是 35 个，上一版 29 个，多出的 6 个就是这四个加 `NEGATIVE`、`TOO_MANY_DECIMALS` | 已写，不需要再请求；不需要告知后端 |
| 4 | 61 号的七种内容类型、69 号的用量资源类型的具体取值，请以接口文档为准，文档里也没有的向后端确认 | **有，但分散**。内容类型七种：第 2896 行 `ModerationRecord` 实体的 `contentType`（`AVATAR`、`VOICE`、`MESSAGE`、`PERSONA`、`COMPANION_NAME`、`AVATAR_IMAGE`、`ACTION_CLIP`）；资源类型七种：第 14.2 节"通用用量接口"的表（第 1836–1842 行，`LLM`、`IMAGE_EDIT`、`IMAGE_TO_VIDEO`、`MATTING`、`DRIVING_PREP`、`AGE_ESTIMATION`、`CLOUD_RENDER`）。筛选参数那两行（2377 行、1921 行）只写"七种内容类型之一（11.1）""取资源类型之一"，没有写出字面值，也没有写大小写是否区分 | 取值能确定，不需要问后端。把字面值补在筛选参数那两行是第二节的 G3 |

## 二、接口文档里还缺的几句（每条都是"记录"，不影响前端现在的做法；建议全部补）

每条写：名称、要补在哪里、行为、检查顺序、错误、测试。前端当前的做法写在最后，补完以后前端不需要因为这些条目改动。

### G1. 任务配置的 `PUT` 带未改的 `taskType`、`targetValue` 不算修改（28.2，第 4245、4255 行）

- **补什么：** 4245 行"已经有 `TaskRecord` 的配置不能改 `taskType` 和 `targetValue`（409 `TASK_HAS_RECORDS`）"后面补一句："`PUT` 请求体里的 `taskType`、`targetValue` 与已存的值相同不算修改，不返回 409；只有取值不同才返回。"
- **来源：** 实现说明第三节 37 号行："带未改的 `taskType`、`targetValue` 的 PUT 不算改动，不会返回 409"。接口文档只写了"不能改"，没有写"原样带回算不算改"。
- **行为：** 配置已有记录时，`PUT /tasks/configs/{id}` 的请求体带了与已存值相同的 `taskType`、`targetValue`，其余字段照常保存，返回该配置；带了不同的值 → 409 `TASK_HAS_RECORDS`。
- **检查顺序：** 实现说明没有给出；请后端补（请求体校验 400、配置存在 404、与记录有关的 409 之间的先后）。
- **错误：** 409 `TASK_HAS_RECORDS`（已有）。
- **测试：** 已有记录的配置：①原样带回两个字段并改 `rewardCredits` → 200，`rewardCredits` 已改；②`taskType` 改成别的 → 409；③`targetValue` 改成别的 → 409；④没有记录的配置改这两项 → 200。
- **前端现在：** 页面在 `hasRecords` 为真时把这两项设为只读并原样带回，不依赖这一句；仍收到 409 时提示改用停用并重新读取。

### G2. `GET /audit-logs/meta` 两张清单的排序和大小写（17.4 系统管理行，第 2392 行）

- **补什么：** 在"`GET /audit-logs/meta` → `{"actions":[…],"targetTypes":[…]}`"后面补："两张清单都按字符编码顺序（升序）排列；`targetTypes` 里 `NOTIFICATION`、`PUSH_SCHEDULE`、`PUSH_TASK`、`PUSH_TEMPLATE` 四个是全大写，其余是首字母大写的驼峰，与已有数据一致，调用方按原样使用，不改大小写。"
- **来源：** 实现说明第三节 45 号行（132 个动作、47 个对象类型；每个写入点用的值都在表里，有测试保证）。接口文档写了常量表和测试保证，没有写排序和大小写。
- **行为：** 只读，不写审计日志，权限 `AUDIT:VIEW`（接口文档已写）。
- **检查顺序：** 不适用（无参数）。
- **错误：** 没有 `AUDIT:VIEW` → 403 `ADMIN_FORBIDDEN`（通则）。
- **测试：** ①两张清单各自升序；②清单里每个值作为 `GET /audit-logs?action=` 或 `targetType=` 的参数都不返回 400；③四个全大写的对象类型出现在 `targetTypes` 里。
- **前端现在：** 下拉选项原样使用，不改大小写、不重排（按后端给的顺序）；不依赖后端排序。

### G3. 内容类型、资源类型筛选参数那两行补字面值（第 2377 行、第 1921 行）

- **补什么：** 2377 行 `contentType` 后面补出七个字面值（见第一节第 4 行），1921 行 `resourceType` 后面补出七个字面值（`LLM`、`IMAGE_EDIT`、`IMAGE_TO_VIDEO`、`MATTING`、`DRIVING_PREP`、`AGE_ESTIMATION`、`CLOUD_RENDER`），并写明区分大小写（实现说明没有写，请后端确认）。
- **行为：** 不认识的值 → 400 `INVALID_REQUEST`（`contentType` 带 `details` `[{"ref":"contentType","reason":"OUT_OF_RANGE"}]`；`resourceType` 与 `hasActivePrice` 没有 `details`，同 `GET /usage/prices`）。接口文档已写，只缺字面值。
- **检查顺序：** `contentType` 与 `status`、`source` 的先后实现说明没有给出，请后端补。
- **测试：** 七个值各一例返回对应类型；小写的值一例（预期 400，待后端确认）；`hasActivePrice=maybe` → 400。
- **前端现在：** 下拉里写这七个值；不认识的值显示原样。

### G4. 短信渠道凭据名称和值的长度、条数（23.4，第 3852 行）

- **补什么：** 补一句："凭据的名称和值没有长度和条数限制，唯一的上限是整个请求体 8 MiB（`avatar.http.max-body-bytes`）。"
- **来源：** 后端 2026-11-02 的回答（`docs/backend-inputs/2026-11-02-avatar-backend-answers-to-avataradmin-questions.md`）第 5 条，已经答过；实现说明第三节 5 号行说"来源材料里没有写"，是它自己没有重复，不是后端没答。所以**不需要再问后端**，只是接口文档没有这一句。
- **行为、检查顺序、错误：** 无变化（凭据名称必须恰好是 `credentialNames`、`null` 值或名称 → 400 `EMPTY_NOT_ALLOWED` 已在 3852 行）。
- **测试：** 一个值很长（例如 100 KB）的凭据能保存；整个请求体超过 8 MiB → `PAYLOAD_TOO_LARGE`（已有）。
- **前端现在：** 不限制名称和值的长度，只在整个请求体过大时显示 `PAYLOAD_TOO_LARGE` 的译文。

### G5. 价格写入 400 的 `ref` 路径里的下标（14.2，第 1921 行）

- **补什么：** 1921 行写了例子 `bands[1].inputMinTokens`，没有写下标是从 0 起还是从 1 起，也没有写下标指的是请求体里 `bands` 数组的位置还是按 `inputMinTokens` 排序之后的位置（手填时档位按 `inputMinTokens` 排序后再校验）。请后端确认并写出一句。
- **行为：** `ref` 要能让页面对到用户填的那一行：若下标是排序后的位置，而页面显示的是用户录入的顺序，两者可能对不上。
- **检查顺序：** 实现说明第三节 111 号行没有给出各字段的先后。
- **错误：** 400 `INVALID_REQUEST`，`details` 为 `[{ref, reason}]`（已写）。
- **测试：** 提交三档、其中第二档（录入顺序的第 2 个）的下限不是整数 → `ref` 指向哪一个；档位乱序提交时 `ref` 指向录入位置还是排序位置。
- **前端现在：** 按数组下标（从 0 起）把 `ref` 对到档位行；对不到的 `ref` 显示在表单整体上；缺口和重叠由前端自己预检。这是待后端确认的一处，所以列在这里。

### G6. 1.4 表里 `ADMIN_FORBIDDEN` 一行补 `data.reason`（第 118 行）

- **补什么：** 118 行 `ADMIN_FORBIDDEN` 的说明里加一句："要授出自己没有的权限、操作超级管理员等授权规则引起的 403，`data` 为 `{"reason":"<原因>"}`，见 17.4 系统管理。"现在只有 2392 行写了 `data.reason`，读 1.4 表的人看不到。
- **行为 / 检查顺序 / 错误 / 测试：** 无变化；各接口的检查顺序已在 2392 行写全。
- **前端现在：** 按 2392 行的六个 `reason` 显示。

### G7. 应用版本的版本号大小比较失败时的 400 有没有 `details`（24.2，第 3926 行）

- **补什么：** 3926 行写"违反 → 400 `INVALID_REQUEST`，`message` 写明 `versionCode`"，而同一行后面的总规则说"版本写入里由请求字段引起的 400 都带 `data.details`"，例外只有三类（激活时对 APK 文件的检查、`upload.public_base_url` 未配置、检查期间 APK 被改动）。版本号大小比较不在三类例外里，按总规则应是 `[{"ref":"versionCode","reason":"OUT_OF_RANGE"}]`，但实现说明没有逐项写这一种，我还没查清。请后端确认并在 3926 行写出。
- **检查顺序：** 已写（重复 409 先于大小 400）。
- **错误：** 400 `INVALID_REQUEST`；`details` 待确认。
- **测试：** 新建版本，`versionCode` 不大于该渠道其他版本的最大值 → `data.details[0].ref` 是否为 `versionCode`；编辑草稿同理。
- **前端现在：** 提交前用列表里读到的各版本预检并写明要大于几；后端 400 带 `details` 时把错误放在版本号输入框下，没有 `details` 时只显示通用句，两种都不出错。同一问题此前记在 `2026-11-02-new-differences-b3.md` 第 4 条。

### G8. 保存 `auth.phone_login_enabled` 被拒时 400 的 `details`（17.5，第 2718 行）

- **补什么：** 2718 行现在只写"否则 `INVALID_REQUEST`（`message` 逐项写出缺的内容）"。请补上后端 2026-11-02 回答第 42 条已经说明的形状：值为 `true` 时依次检查并各加一条 `details`（只加缺的，最多 4 条）：①`sms.allowed_country_codes` 没设或为空 → `{"ref":"sms.allowed_country_codes","reason":"EMPTY_NOT_ALLOWED"}`；②`sms.daily_global_cap` 没设 → `{"ref":"sms.daily_global_cap","reason":"EMPTY_NOT_ALLOWED"}`；③没有启用的验证码渠道 → `{"ref":"SmsChannel","reason":"EMPTY_NOT_ALLOWED"}`；④没有"启用、验证码类型、语言 `en`（不区分大小写）、不限国家"的模板 → `{"ref":"SmsTemplate","reason":"EMPTY_NOT_ALLOWED"}`。`ref` 是设置键时对应设置行，`SmsChannel`、`SmsTemplate` 是固定词。
- **来源：** 后端的回答（2026-11-02）第 42 条（那里还写了"文档没写 `details` 的各 `ref`"）；实现说明第四节 42 号："`details` 已经说明缺哪几项"，后端不加 `missing` 数组。2026-10-31 的 `2026-10-31-contract-17-4-17-5-changes-from-backend-d1.md` 第 2.5 节第三行是同一件事，更新接口文档没有采纳这一行（其余几行已采纳）。
- **检查顺序：** 上面①到④的顺序（回答第 42 条）。
- **错误：** 400 `INVALID_REQUEST`，`data.details` 如上；`message` 英文，不进文档。
- **测试：** 四项都缺 → 4 条 `details`，顺序如上；只缺模板 → 只有第 4 条；全满足 → 保存成功。
- **前端现在：** 逐条按 `ref` 显示：两个设置键对应设置行，`SmsChannel`、`SmsTemplate` 各一句固定文字（计划任务 10、28 已按回答第 42 条写）；不需要等文档。

## 三、数字

第一节 4 条：已写完整 1 条（第 3 条）、已写但字面值分散在别处 1 条（第 4 条）、不是接口文档的内容 1 条（第 1 条，等后端告知持续集成结果）、处理原则 1 条（第 2 条，对照后没有发现矛盾）。第二节 8 条（G1 到 G8），全部分类为"记录"，立即修 0；其中需要向后端确认的有 4 处：G1 的检查顺序、G3 的大小写和检查顺序、G5、G7；其余（G2、G4、G6、G8）只是请改契约的人补一句，后端已经答过或实现说明已经写明。

核对于 2026-11-03

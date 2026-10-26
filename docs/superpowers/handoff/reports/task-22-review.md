立即修 1、记录 8、变更 0、不是缺陷 6、阻塞 0

# 任务 22（推送）独立评审

评审对象：提交 2652b7a、7f6d465、b221f48（分支 `claude/jolly-dirac-4pq9g6`）。评审深度：页面和报表，一次独立评审，不加复审轮次（CLAUDE.md）。没有改共享检出里的任何文件；所有变异都在 `git archive HEAD` 的拷贝里做（`scratchpad/t22r/`，脚本 `t22r-mutate.py`，输出 `mutate.out`）。

## 一、先说结论

- 规格 5.11 的每一句、任务书的每一条，我逐项对着页面代码和测试读过：矩阵、手动任务、周期推送、发送记录、推送效果、召回参数都有，没有发现"规格写了而页面没有"的元素。
- 唯一的立即修：新建/修改模板、手动任务、周期推送时，图片字段在请求体里叫 `imageUploadId`，而契约、规格和任务书三处写的都是 `uploadId`。真后端按契约字段名读时，这个字段会被当作未知字段，上传了图片的推送会静默没有图片（见第三节）。
- 其余是测试缺口和小的显示问题，以及两个不属于本模块的假后端缺陷。

## 二、我自己跑的东西

| 检查 | 结果 |
|---|---|
| 拷贝里 `npx vitest run src/pages/push src/services/push mock/push.mock.test.ts config/routes/push.test.ts src/locales/parity.test.ts` | 13 个文件、232 个测试全部通过（与报告一致） |
| 拷贝里 `tests/noHardcodedText.test.ts`、`scripts/` 下的测试（路由清单、权限码、配置键） | 通过 |
| `npx biome check`（推送的全部路径） | 无问题 |
| `npx tsc --noEmit`（共享检出，只看推送路径） | 推送路径无报错（其余报错来自别的模块未提交的文件） |
| 语言文件 | zh-CN 与 en-US 键相同、占位符相同；en-US 无中日韩字符；本模块文件里没有韩文、隐藏字符、第三方产品名、`console`/`debugger` |
| 页面代码里引用的 `push.*` 键 | 全部存在；只有 `push.templates.empty` 没有被引用（见记录 8） |

## 三、立即修（1）

**1. 图片字段名不是契约写的 `uploadId`。**
- 位置：`src/services/push/types.ts:54`、`:75`；`src/pages/push/bodies.ts:26,33,79,94`；假后端 `mock/push.mock.ts:57,231,253,288,337,357`；测试 `bodies.test.ts`、`templates.test.tsx`、`tasks.test.tsx`、`schedules.test.tsx`、`push.test.ts`、`mock/push.mock.test.ts`；问题文件 `docs/contract-requests/2026-10-26-admin-frontend-push.md` 第一节第 3 条；报告里的相应句子。
- 依据：契约 §17.4 推送管理行写"模板、任务和周期推送只接受 `uploadId`"；契约验收清单（快照第 3344 行）写"模板和任务只接受 `uploadId`"；规格 5.11 写"提交模板或任务时只带上传返回的 `uploadId`"；任务书写"提交只带 `uploadId`"；后端说明（backend-inputs 第一份文件）写"创建和修改只认 `uploadId`"，并给了字段名同实体列名的两个具体例子（`previewUploadId`、`iconUploadId`，那是因为目录有两种图）。没有任何一处出现 `imageUploadId`。实现者在问题文件里写"图片的字段名契约没写，暂定 `imageUploadId`（同形象目录的命名规则）"：这是猜的，而契约写了。
- 触发：新建一条模板，上传一张 PNG，提交。请求体是 `{"title":…,"imageUploadId":"…",…}`。真后端按 `uploadId` 读，`imageUploadId` 不被认；结果是要么 400，要么（更糟）静默保存没有图片的模板，上传记录也会被 `upload.orphan_hours` 清理掉。假后端和全部测试都用 `imageUploadId`，所以测试看不出来。
- 如果带着它上线的后果：所有带图片的推送都发不出图片，而页面显示"保存成功"。
- 怎么修：请求体字段改成 `uploadId`（类型、`contentFields`、假后端、六处测试、问题文件第一节第 3 条改成"契约写的是 `uploadId`，请确认"）。页面里 `useUploadSlot` 的 `uploadId` 状态本身不用改。若后端回复另有字段名，再按回复改。

## 四、规格 5.11 / 任务书逐项对照（页面实际渲染的）

| 规格或任务书的句子 | 页面实际 | 结论 |
|---|---|---|
| 矩阵：行是触发原因，列是语言，缺的格子标红 | `TemplateMatrix.tsx`：行是 `daily_recall`、`streak_at_risk`（只有这两种有模板，契约 §18），列是 `meta.supportedLocales`，缺的格子是红色（`color="error"`）"缺失"标签，已有的是"已启用/未启用"。变异把红色改成默认色，测试变红 | 符合 |
| `supportedLocales` 缺失/null/空时不显示矩阵，只显示模板列表 | `coverage.ts:supportedLocalesOf` 对缺失、null、空数组、不是数组、含空元素都返回 null，页面显示一句说明；变异把矩阵画出来，四个测试变红 | 符合 |
| 启用时某语言缺模板：前端提示，以后端为准 | 对话框里的警告和列表开关点击前的顶部提示，都写出缺哪几种语言，请求照发 | 符合（后端 400 时列表里只有通用文字，见记录 5） |
| 图片：JPEG/PNG、上传前按 `pushImageMaxBytes` 检查、取不到不检查、上传中禁止提交 | `UploadField kind="pushImage"`，提交按钮 `disabled: pending \|\| picture.busy`；变异去掉 `busy` 测试变红 | 符合 |
| 提交只带 uploadId，没有 imageUrl | 没有 `imageUrl`（变异加上测试变红）；字段名见立即修 1 | 字段名不符 |
| 链接：NONE / SCREEN（9 个下拉）/ URL（总长 ≤ 2048），三处一样 | 三处都经 `ContentFields` → `LinkField`（`LinkTargetField` 加 `linkTargetRule`）；NONE 时 `linkTarget` 发空串（变异测试变红） | 符合 |
| 标题、正文：去首尾空白（29 个码点）；长度 | 必填检查和发送值都用 `trimSpec`（变异去掉 trim，四个测试变红）；没有上限检查 | 上限见不是缺陷 2 |
| 新建模板时该 (触发原因, 语言) 已存在：不覆盖 | 页面已读到该组合就在语言字段下提示"改那一条"，不发请求（变异去掉，测试变红）；后端的重复由 409 `DUPLICATE_RESOURCE` 译文显示 | 符合 |
| 手动任务：账号 ID 列表时平台、语言筛选不可选，请求体不带 | `AudienceFields` 的 `disabled={byIds}` 加切换时清空，`audienceFields` 在该受众不输出两项（变异：去掉任一个 `disabled`，测试变红） | 符合 |
| 只有 PENDING 行可取消 | `tasks.tsx:109` `canSend && row.status === 'PENDING'`；变异去掉状态判断，两个测试变红；取消码是 `PUSH:SEND` | 符合 |
| 周期推送：每月 31 日在短月取月末的提示 | `monthEndNote`，选"每月"时始终显示，写明"31 日在 4 月发在 30 日，在 2 月发在 28 或 29 日"（变异删掉，测试变红） | 符合 |
| 时区：IANA 下拉，默认 UTC，说明"固定时区，不是每个用户的当地时间" | 默认值 `'UTC'`（变异改成别的时区，测试变红），说明始终显示，zh-CN 与规格逐字相同 | 符合 |
| 删除等于停用，已生成的任务保留 | 行里按钮叫"停用"，确认文字 zh-CN 是"停用，已生成的任务保留"，en-US 是"Deactivate; the tasks already made are kept."；只对已启用的行显示（变异：对所有行显示，测试变红）；停用后行还在、开关关 | 符合 |
| 发送记录列：账号、类型、触发原因、本地日期、创建时间；展开行显示每个 token 的结果 | `records.tsx` 一致；展开行读 `GET /push/records/{id}`，显示 token 编号（不是 token 本身，凭据类字段无回显）、结果、时间 | 符合 |
| 推送效果：日期范围、触发原因筛选；五个数；点开率 = 点开数 ÷ 发送数，分母 0 显示"—"；列提示；趋势图加明细表；落地条 `push`；导出 `push` | `stats.tsx`：一张折线图四条线（变异删一条线，测试变红），明细表每天每个触发原因一行；`openRate` 用 `safeRatio`（变异改成直接相除，两个测试变红）；"点开数""点开率"两列提示都写"点开数记在点开当天，与发送日不一定是同一天"；`LandBar name="push"`、`ExportButton name="push"`（两个变异都变红）；导出参数用已点"查询"的筛选 | 符合 |
| 召回参数：`<ConfigForm editPermission="PUSH:CONFIG" />`，12 个键，没有该码进不了路由 | `recall.tsx` 一行；`recall.test.tsx` 断言 12 个键、只有 `PUSH:CONFIG` 的管理员也是这 12 个；路由 `access: 'PUSH:CONFIG'` | 符合 |
| 写按钮的权限码 | 模板新建/修改/删除/开关 `PUSH:TEMPLATE`；任务新建/取消、周期推送新建/修改/开关/停用 `PUSH:SEND`；三个变异（把码改成 `PUSH:VIEW`）都让权限测试变红 | 符合 |
| 路由 | 取规格 5.0 的六行，页面码 `PUSH:TEMPLATE`、`PUSH:SEND`、`PUSH:SEND`、`PUSH:VIEW`、`STATS:VIEW`、`PUSH:CONFIG`；`scripts/routeInventory` 测试通过 | 符合 |

## 五、变异检查：我自己做的 36 个变异

在 `git archive HEAD` 的拷贝里，每个变异单独一份拷贝，只改一处，跑相关测试文件。29 个变红，7 个存活。

变红（29）：三个提交表单不防重复（模板、任务、周期推送各一）、三处写按钮的权限码、列表开关不防重复、"该组合已有模板"的拦截、取消按钮不看状态、定时时间按本地时区读、平台筛选不禁用、语言筛选不禁用、每月的日字段对所有重复方式都发、停用按钮对所有行显示、点开率分母 0 不处理、落地条落错汇总、导出错报表、矩阵缺失格子不再标红、`supportedLocales` 缺失/空也画矩阵、标题不去空白、NONE 链接保留目标、请求体带 `imageUrl`、时区默认值改掉、折线图少一条线、删除不再先确认、定时时间不检查已过去、上传中提交不禁用、每月月末提示删掉、列表开关启用前不提示缺语言。

存活（7）：见记录 1、2、3。

**双重提交"原来偏弱、已加强"的说法，我核实了。** 用 `git archive 7f6d465`（加强之前）做拷贝，把三个对话框的 `useSingleFlight` 拿掉：模板（38 个测试）、任务（23 个）、周期推送（21 个）全部仍然通过，即报告说的"第一轮存活"属实。用 HEAD（b221f48）的测试做同样的变异：三个都因 `sends one request when the form is submitted again while the first request is still on its way` 变红。`holdWrites()`（`testSetup.ts`）让第一次请求停在途中，再提交两次并数发出的写请求，这个设计能证明守卫在起作用。列表开关的 `EnabledSwitch` 去掉守卫也变红。

## 六、记录（8）

1. **取回结果的过期守卫没有测试。** 位置：`src/pages/push/records.tsx:141`（列表）、`:145`、`:147`、`:63`、`:65`（展开行）；`src/pages/push/stats.tsx:71`、`:73`；`src/pages/push/templates.tsx:48`、`:52`。变异：去掉任一处 `mine !== counter.current` 判断，对应测试文件全部仍然通过（五个变异存活）。守卫本身我读了，逻辑正确；缺的是测试。触发（守卫被误删之后才出现的错误结果）：发送记录页点第 2 页再立刻点第 3 页，第 3 页的回复先到、第 2 页的回复后到，表格显示第 2 页的数据而分页器写着第 3 页；推送效果页先查 7 天再改成查 30 天点"查询"同理。
2. **换文件时清掉旧 `uploadId` 没有页面级测试。** `src/pages/push/uploadSlot.ts:25`：把 `onCleared` 改成空函数，三个对话框的测试仍通过（存活）。触发（`onCleared` 失效之后）：先上传 PNG 甲（得到 uploadId），再选 GIF 乙（上传前被拒绝），提交；请求会带甲的 `uploadId`，而界面显示的是"文件类型不对"，运营以为没有图片。当前代码是对的（`UploadField` 在换文件时调用 `onCleared`），但这条路径没有推送层的测试。
3. **发送记录里账号链接的权限判断没有测试。** `src/pages/push/records.tsx:26`：把 `access.canAccess('USER:VIEW')` 改成 `true`，11 个测试全部通过（存活）。后果（判断失效后）：没有 `USER:VIEW` 的管理员看到点了会被路由守卫拒绝的链接。
4. **列表里的时刻按浏览器时区显示，没有标时区；而新建时按 UTC 输入。** `src/pages/push/tasks.tsx:102`（计划时间）、`src/pages/push/schedules.tsx:109`（下次生成时间）。这回答你问的"算不算错误输出"：不算错误。输入的 10:00 UTC 和列表显示的 18:00（UTC+8 浏览器）是同一个时刻，`formatInstant` 对整个项目都按浏览器时区显示；对话框里"时间（UTC）"和提示都写明了 UTC，`pickedInstantUtc` 与 `sendAtPast` 的检查口径一致（`bodies.test.ts` 在 UTC+8 和 UTC-5 下断言）。问题是显示没有标注：周期推送列表里同一行，"发送时刻与时区"写 `08:30 · Asia/Bangkok`，旁边"下次生成时间"在 UTC+8 浏览器里是 `09:30`，看上去矛盾。触发：浏览器 UTC+8，新建每天 08:30 `Asia/Bangkok` 的周期推送，看列表。建议两列的列标题写上"（本机时区）"或同时显示 UTC。这与报告记录项 7 相同，我补了周期推送列表这一处。
5. **列表开关被后端 400 拒绝时只显示通用文字。** `src/pages/push/EnabledSwitch.tsx:25` 只取 `describeFailure(...).text`；模板列表里打开"启用"时，如果前端没有读到完整模板列表（`templates.tsx:94` 的 `all` 为 null，提示不会出现），后端的 `data.details`（`enabled`）不会显示，运营只看到"输入不合法"。触发：模板列表的 `GET` 失败后（矩阵处显示读取失败），在列表里打开一个缺语言的模板。与报告记录项 8 相同。
6. **假后端的触发原因值不是契约的值。** `mock/_core/statRange.ts:70`（任务 9 的共享文件）：`TRIGGERS` 是 `recall、announcement、notification、activity、admin`。我核实了：`mock/stats.mock.ts:134` 对不在这个列表里的 `triggerReason` 返回 400，所以开发用假后端打开推送效果页，选"每日召回"点查询得到 400，表里的触发原因显示成原文 `recall`。这是开发工具的缺陷，不影响真后端；在本模块不能改，需要任务 9 的归属者改。
7. **假后端 `supportedLocales` 固定 `['en']`。** `mock/_core/meta.ts:4`：开发用假后端里完整性矩阵只有一列，也不随 `PUT /config/app.supported_locales` 变化。同上，共享文件。
8. **没用到的语言键。** `src/locales/zh-CN/push.ts:81`、`src/locales/en-US/push.ts:85` 的 `push.templates.empty` 在页面里没有被引用（模板列表的空状态用的是表格默认文字）。清理或在空列表时使用它。

报告里记录项 1、2、3、5（共享组件 `PagedListTable`、`UploadField`、`LinkTargetField` 的问题，和两个模块各一份的重复小件）我没有在浏览器里复核，只确认了它们指向的代码行为存在（`ContentFields.tsx` 里包了一层 URL 错误规则、`UploadBox.tsx` 用样式盖住原生文件框）。报告的记录项 9（发送记录没有筛选）我归为不是缺陷（见下）。

## 七、不是缺陷（6）

1. **发送记录用展开行而不是抽屉。** 规格 5.11 逐字写"展开行显示对每个 token 的发送结果"；计划里"详情用抽屉"一行（计划第 39 行）的理由是"规格没给它们路由"，说的是不新增路由，不是规定详情的形式；规格明确写了形式时，以规格为准（埋点明细同样是展开行，计划第 676 行）。展示的内容（每个 token 的结果）和读取的接口（`GET /push/records/{id}`）与任务书一致，运营看到的差别只是点开的位置。实现者在报告里写明了这点，并把"任务书那句话改成没有自己的路由"列进了规格/计划需要修改的地方，做法对。`records.tsx:219`。
2. **标题和正文没有长度上限检查。** 契约 §17.4 通则第 4 条列了"通知标题和正文、任务说明……等"，没有写推送的标题和正文；契约 §18 的 `PushTemplate`/`PushTask`/`PushSchedule` 也没有长度。前端做的是 `trimSpec` 之后必填（`ContentFields.tsx:48,55`）和发送去空白后的值（`bodies.ts:29-30`）。上限已写进问题文件第一节第 5 条；假后端的 200/1000 只是为演示失败显示（`mock/push.mock.ts:34`）。没有契约值就加上限，是猜。
3. **`sumByDay` 在 `statDate` 不是字符串时会抛异常。** `src/pages/push/pushStats.ts:40`：两行以上、`statDate` 为数字或 null 时 `.localeCompare` 不是函数。契约 §17.6 的 `StatPushDaily` 以 `(statDate, triggerReason)` 为键，`statDate` 总是字符串；需要不可能的数据才触发。
4. **发送记录没有筛选。** 规格 5.11 对这一页只写了列和展开行，没有写筛选；契约没有给 `GET /push/records` 的参数。要加就是新增行为（变更），要先有契约；问题文件第四节第 1 条已向后端提问。
5. **发送记录里账号 ID 是到用户详情的链接。** `records.tsx:26`：规格 5.11 没写，但规格在额度账户、告警等页都写了"账号点开进用户详情"，同一约定，且只对有 `USER:VIEW` 的管理员出现，没有新增接口。
6. **页面没有"去掉已有图片"的操作。** 规格和契约都没有写去掉图片的机制（契约只写了换图和删除对象时随即删除上传记录），问题文件第一节第 4 条已问；`PUT` 不带 `uploadId` 表示不变是暂定做法，列表开关因此不会误删图片（假如后端的语义不同，由后端回复后再改）。

## 八、没有发现问题的地方（我查过的）

- 双重提交：新建/修改对话框、列表开关、取消、停用、删除（后三者经共用的 `DangerConfirmButton` 的 `useSingleFlight`）；请求在途时对话框的取消、遮罩关闭都禁用。
- 409/400 的显示：已知错误码只显示译文（`error.<码>`、`reason.<码>`），字段级原因放到对应字段下（`formFailure.ts`）；上传编号被拒（404/409/400）时清掉编号、换 `key` 复位上传控件、重新上传之前不再发请求。
- 非字符串值：后端来的文字字段一律经 `plainText`/`codeText`/`countText`，数字、对象、null 不作为 React 子元素；每页有对应测试。
- 版式：标题、正文、账号 ID 用 `EllipsisPopoverText`，表单里 `dir="auto"`；测试含 300 个无空格字母、泰文 200 字、阿拉伯文 300 字、100 个 emoji。
- 敏感信息：发送结果只显示 token 编号，不显示 token；没有凭据类字段。
- 写入范围：三个提交只含推送路径、问题文件和报告，没有改共享文件；假后端文件只有默认导出。
- 提交说明和报告用词：没有使用"工单""台账""阶段""里程碑"，没有把"以后"当分类；报告开头按规定写了数量。

## 九、没有运行的东西

- 没有起开发服务器，没有在真实浏览器里复核报告的截图结论（任务要求）；上面的结论来自代码、测试和变异。
- 没有对真后端验证：图片字段名、`PUT /push/templates/{id}` 的键、`deliveries` 数组名、周期推送 `DELETE` 之后的行状态，都是问题文件里的暂定做法。

## 主会话复核（分类调整）

评审把"请求体图片字段名写成 `imageUploadId`"列为立即修。我核对了快照：契约 §17.4 推送管理行写"模板、任务和周期推送只接受 `uploadId`"，实体表 `PushTemplate`、`PushTask` 的列是 `imageUrl`，后端的四份文件里没有任何一处写请求体里这个字段叫什么。"只接受 uploadId"说的是"只接受上传编号、不接受地址"，没有给字段名；其他模块里后端明确回复的名字是 `previewUploadId`、`iconUploadId`，按同一习惯是 `imageUploadId`。所以这是契约的缺口，不是已核实的契约被破坏。分类改为**记录**：问题文件第一节第 3 条已向后端提问，拿到答复后改字段名（改动涉及类型、`contentFields`、假后端和六处测试）。如果后端答复是 `uploadId`，则按立即修处理。

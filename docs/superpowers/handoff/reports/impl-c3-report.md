改了 3 处、没做 0 处、没运行 2 项、阻塞 0（另有 1 处原本就一致，只补了守住它的测试）

立即修未修 0、记录项 3（见第四节）、未运行 2（真实浏览器里点一遍、对着真后端联调）、阻塞 0。

组 c3，负责的请求编号：11、12、35、97。依据：后端实现说明（`docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md`）和更新接口文档（`docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`）。

## 一、逐条对照

| 请求 | 后端实现说明怎么说 | 前端要改什么 | 状态 | 提交与位置 |
|---|---|---|---|---|
| 11 渲染模型不再返回 `fileRef` | 第二节第 1 条（第 24 行）、第三节 11 号（第 57 行）：`GET /renderer-models` 每项没有 `fileRef`，也没有替代的地址；公开客户端下载接口不变 | 删除读取这个字段的代码、列、类型、假后端里的字段 | 原本就一致。证据：`src/`、`mock/`、`tests/`、`config/` 里搜 `fileRef` 没有任何结果；类型 `RendererModel`（`src/services/avatar/types.ts:125`）、假后端 `MockRendererModel`（`mock/_core/avatarData.ts:67`）、页面列（`src/pages/avatar/rendererModels.tsx:29` 起）都没有它。补了守住它的测试 | `4d7b328`：`src/services/avatar/avatar.test.ts`（类型里没有 `fileRef`）、`mock/avatar.mock.test.ts`（"gives each model with the fields of the table and no storage key"，列表、新建、上下架三种响应的字段集合恰好是表的字段）、`src/pages/avatar/rendererModels.test.tsx`（后端若仍发 `fileRef`，表头和页面都不显示） |
| 12 推送发送结果加 `platform`、`tokenSuffix` | 第三节 12 号（第 58 行）；更新接口文档 2381 行、2884 行：`ANDROID`/`IOS` 或 `null`，末 6 位或 `null`；旧记录两项为 `null` | 详情里的发送结果表加两列，`null` 显示"—" | 已改 | `f09329f`：`src/pages/push/records.tsx:135-144`（两列，平台用 `push.platform.*` 的译文，不认识的值原样显示，不是文字显示"—"）、`src/services/push/types.ts:179-190`、`mock/_core/pushData.ts`（较新的记录两项都有值，最旧的 4 条（第 29 到 32 条）两项都是 `null`）、两个语言文件各 2 键（`push.records.col.platform`、`push.records.col.tokenSuffix`）、`src/pages/push/records.test.tsx`、`mock/push.mock.test.ts`；计划里"推送记录详情抽屉"改成"列表里展开一行得到的发送结果表"（计划 788 行） |
| 35 推送模板写入 400 的 `data.case` | 第三节 35 号（第 62 行）；更新接口文档 2381 行：`DEFAULT_MISSING`、`DEFAULT_REQUIRED_BY_OTHERS`、`DEFAULT_MOVED_AWAY`；错误码、`message`、检查顺序不变 | 按 `data.case` 给三种不同的引导文字（中英文）；没有 `case` 时仍用通用句；假后端返回 `case` | 已改 | `94edf34`：`src/pages/push/recallRule.ts`（`recallRuleOf` 读出 `defaultCase`；`templateFailureText` 按 `push.templates.defaultCase.<case>` 选句，键不存在、非文字、空串都退回原来的通用句；用 `Object.hasOwn`，`constructor` 之类不会误命中）、两个语言文件各 3 键、`mock/push.mock.ts:268` 起（按假后端自己的判断：改走唯一启用的默认语言模板为 `DEFAULT_MOVED_AWAY`，停用/删除/改走默认语言模板而别的语言仍启用为 `DEFAULT_REQUIRED_BY_OTHERS`，其余为 `DEFAULT_MISSING`）、`recallRule.test.ts`、`templates.test.tsx`、`mock/push.mock.test.ts` |
| 97 `PUT /cosmetics/{id}` 的 `kind` | 第二节第 5 条（第 41 行）、第三节 97 号（第 75 行）；更新接口文档 2378 行：与已存不同 → 400 `INVALID_REQUEST`、`details=[{ref:'kind',reason:'OUT_OF_RANGE'}]`；不传合法，保留原值 | 编辑表单把 `kind` 当创建后只读；不再必带 `kind`（选"不传"）；其它必带项不变；假后端同步 | 已改 | `7d4707c`：`src/pages/avatar/CosmeticModal.tsx:107-110`（编辑不再发 `kind`，仍发 `enabled`）、`src/services/avatar/types.ts`（`CosmeticUpdate` 没有 `kind`）、`mock/avatar.mock.ts:185-195, 347-348`（`kind` 缺省或等于已存值接受，其他值包括 `null` 之外的空串、非文字都是 400 `OUT_OF_RANGE`；不再有 `EMPTY_NOT_ALLOWED`）、`src/pages/avatar/cosmetics.test.tsx`。假后端和服务层的测试在 `4d7b328` 里（见第四节第 1 条） |

动作部分没有变（后端实现说明第三节 97 号末句），没有改。`enabled` 仍是必带项：更新接口文档没有重述 PUT 的必带清单，沿用后端 11 月 2 日回答第 97 条第 4 点（`kind` 不再必带，`names`、`generationSpec`、`compatibleStyles`、`isFree`、`isDefault`、`enabled`、`sortOrder` 缺任何一个是 400）。

开发计划：后端实现说明对应的计划段落已由 c6 组在 `f948745` 里写好（渲染模型 623 行、服装请求体 628 行、推送模板规则 780、783 行），我核对过与实现一致，没有重复改；只改了上面第 12 条的一处措辞。

## 二、中英文与语言

- 新增语言键：`push.records.col.platform`、`push.records.col.tokenSuffix`、`push.templates.defaultCase.DEFAULT_MISSING`、`…DEFAULT_REQUIRED_BY_OTHERS`、`…DEFAULT_MOVED_AWAY`，zh-CN 与 en-US 对称。
- 已知的 `case` 只显示按码翻译的文字，不附后端 `message`（测试里 `message` 写成 "raw backend words" 并断言页面不出现）。
- 测试数据含泰语（模板标题、令牌末位 `ก๑๒x_ز` 含泰语数字和阿拉伯字母）、阿拉伯语、中文、英文；推送模板的假数据本来就含泰语、阿拉伯语、越南语。印尼语、西班牙语没有新增专门用例（令牌末位和 `case` 与语言无关）。

## 三、做过的检查

- 先写测试并看到红：12（5 条红：表头、两列内容、中文表头、假后端字段集合）、35（12 条红）；97 的测试在实现后才第一次运行，改用变异检查补证：把假后端的 `same('kind', …)` 一行删掉，"keeps the kind of the item…"变红；让编辑对话框重新发 `kind`，页面测试"shows the key and the type…"变红；11 在假后端第一行加 `fileRef`，"no storage key"变红；之后都已恢复。
- 相关快速测试（`--testTimeout=60000`）：`src/pages/push`、`src/pages/avatar`、`mock/push.mock.test.ts`、`mock/avatar.mock.test.ts`、`src/services/avatar`、`src/services/push`、`src/locales`、`tests`（含语言对称、禁止写死文字、`storedFailureText` 等扫描）的最后一次结果见下面第五节。
- `biome check` 我改过的目录与文件 0 诊断；`tsc --noEmit` 里我的文件 0 错误（整个仓库当时有别的组正在改的文件报错，不是我的：`mock/system.mock.ts`、`src/app.test.tsx`、`src/pages/system/admins.test.tsx`、`src/pages/activity/TaskFormModal.tsx`、`mock/activity.mock.ts`、`src/pages/campaign/accounts.batch.test.tsx`）。
- `src/session/review7.test.tsx` 里一条"keeps what it has when the account cannot be read"在我跑推送测试时失败（期望 `USER:BAN` 得到 `USER:VIEW`），不是我的改动引起（会话和 `/me.roleIds` 是别的组在改）；我没有碰。

## 四、记录项与说明

1. 记录项：提交 `4d7b328`（请求 11）里夹带了请求 97 的两块测试（`mock/avatar.mock.test.ts` 里"keeps the kind of the item…"等、`src/services/avatar/avatar.test.ts` 里去掉 `kind` 的调用），还夹带了别的组暂存的 `src/locales/zh-CN/reason.ts`（8 行）。原因：按项目约定用 `git commit -- <路径>`，它提交整个文件的全部改动，同一文件里两条请求的改动无法分开；`reason.ts` 是别的组同时暂存的文件被一起带进来。内容都没有丢，只是提交归属不干净；不改历史（有别的代理在同时提交）。建议主会话知悉，不需要处理。
2. 记录项：提交 `5ee63b2` 也一样带进了别的组同时暂存的 `src/locales/zh-CN/system.ts` 和 `src/pages/moderation/queue.test.tsx`（原因同上，提交时索引是共用的）。
3. 记录项：`mock/push.mock.ts` 里的推送记录列表处理函数有别的组（请求 114 的日期筛选）未提交的改动，我只暂存了自己的 `case` 部分，那部分改动仍留在工作区，由那个组提交。

## 五、没运行的

- 没有在真实浏览器里点一遍这四项（只有页面测试通过假后端）。
- 没有对着真后端联调：`platform`、`tokenSuffix`、`case` 的实际 JSON 形状全部来自接口文档和后端实现说明。

## 六、新差异请求

`docs/contract-requests/2026-11-03-new-differences-c3.md`（随 `7d4707c` 提交）：`kind` 为 `null` 或空串算不算"省略"；改触发原因时两个原因都违规，`case`/`reason` 取哪一个；`tokenSuffix` 不足 6 位、`platform` 将来出现新取值时怎么显示（前端原样显示）。都按最小做法继续，不阻塞。

另有一个事实记录：推送模板的编辑对话框里语言和触发原因是禁用的（`src/pages/push/TemplateModal.tsx:183`），所以页面自己发不出"把唯一启用的默认语言模板改成别的语言"的写入，`DEFAULT_MOVED_AWAY` 只能在后端给出时显示；页面测试用替换的后端回答覆盖，假后端的测试覆盖它的触发。

## 七、最后一次相关测试

- 第一次（`src/pages/push`、`src/pages/avatar`、两个假后端测试、两个服务层、`src/locales`、`tests`）：1313 个用例，2 个失败：（一）`src/locales/parity.test.ts`，英文的 `DEFAULT_REQUIRED_BY_OTHERS` 句里 `{reason}` 出现 3 次、中文 2 次，占位符次数不一致，已把英文改成 2 次（"while its other languages are enabled"），提交 `5ee63b2`；（二）`src/pages/avatar/cosmetics.test.tsx` 的编辑用例一次找不到行（机器负载 10 到 28 时的超时），单独重跑通过。
- 第二次（`src/locales`、`recallRule.test.ts`、`templates.test.tsx`、`cosmetics.test.tsx` 等 8 个文件）：770 个用例全部通过。

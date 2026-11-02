改了 11 处、没做 0 处、没运行 3 项、阻塞 0

# 后端回答落实报告：组 a5（第 42、61、64、95、96、97、98、100、130、135、139 号）

分支 `claude/jolly-dirac-4pq9g6`。没有推送，没有开拉取请求，没有改 `docs/shared-snapshots/` 和 `docs/superpowers/plans/`。差异另写在 `docs/contract-requests/2026-11-02-new-differences-a5.md`。

没运行的 3 项：(1) 真实浏览器（Playwright）检查没跑，本机同时有 20 多个 vitest 在跑，页面检查只靠页面测试通过假后端触发；(2) 全量测试和构建没跑（按要求只跑相关快速测试）；(3) 第 42、61、100、135、139 号没有单独做变异检查（做过的是第 64、95、96、97、98、130 号，见最后一节）。

## 每个编号

| 编号 | 答案要求前端改什么 | 状态 | 提交和位置 |
|---|---|---|---|
| 42 开启手机号登录被拒 | 逐条按 `details` 的 `ref` 显示：`sms.allowed_country_codes`、`sms.daily_global_cap` 对应设置行（表单里没有这两行时写在顶部），`SmsChannel`、`SmsTemplate` 各一句固定文字；去掉“固定写一句最常见缺项”；不把 `data.missing` 当作已存在 | 已改。`SmsTemplate` 那句没动。顶部文字按 `details` 的顺序排（原来是非设置键的先、设置键的后）。假后端按后端顺序最多答四条，不带 `missing`。向后端的“加 `missing`”后端建议不做，已在请求文件里改写成“已答复”。 | cb0ef46：`mock/config.mock.ts:200`，`src/pages/config/refusal.ts:120`，语言文件 `config.sms.allowed_country_codes.reject.EMPTY_NOT_ALLOWED`、`config.sms.daily_global_cap.reject.EMPTY_NOT_ALLOWED`、`config.refusal.SmsChannel.EMPTY_NOT_ALLOWED`（en-US/config.ts:853-857），测试 `ConfigForm.test.tsx`、`refusal.test.ts`、`mock/config.mock.test.ts` |
| 61 审核记录按内容类型筛选 | 不发 `contentType`，不要“发参数加客户端再过滤”；类型筛选只当作本页内的显示过滤并在界面上说明 | 按保守做法处理：不再发 `contentType`（服务类型里也删了）；页面常驻一句说明，选了类型后再显示“本页 N 条中有 M 条是该类型，页数和总数包含所有类型”；假后端也忽略这个参数（不是 400）。向后端的“加 `contentType` 参数”没当作已存在。另顺带改了一处：答案第 4 点说后端按创建时间从老到新排、不分状态，原来页面说明和假后端写的是“待处理的在前”，已改成后端的行为（见 35948bc）。 | b64682a：`src/pages/moderation/queue.tsx`（request 与 typeView），`mock/moderation.mock.ts`，`src/services/moderation/types.ts`，语言文件 `moderation.queue.typeNote`、`moderation.queue.typeFilter`；35948bc：`mock/moderation.mock.ts` 的 `byQueueOrder`、`moderation.queue.note` |
| 64 形象与装扮目录列表 | `/cosmetics` 只发 `kind`；“上下架状态”“适用风格”筛选在页内做并说明；假后端排序改成服装 `kind`、`sortOrder`、`key`，动作 `sortOrder`、`key` | 按保守做法处理：页内过滤并说明（同 61 的做法）；`style`、`enabled` 不再发，假后端也忽略它们；排序已改。服装目录改排序后，礼品对话框和用户详情页签的两个测试因下拉框是虚拟列表、需要搜索才能选到服装，已跟着改。 | b398722：`src/pages/avatar/cosmetics.tsx:190`，`mock/avatar.mock.ts:292,377`，`src/services/avatar/types.ts`；bada51e：`GrantCosmetic.test.tsx`、`failureLanguage.test.tsx`；6cdf5a1：`src/pages/users/detailTabs.test.tsx` |
| 95 审核判定的备注 | 备注上限 1000 码点；通过可不填，只有拒绝必填；备注错误 `ref` 为 `note`，判定非法 `ref` 为 `decision` | 已改。页面上限 500 改 1000；假后端按后端的检查顺序（判定、再备注、再读记录）只报第一个错误，判定缺失 `EMPTY_NOT_ALLOWED`、非法 `OUT_OF_RANGE`；后端对备注的拒绝显示在备注框下面，不再重复写在底部。“通过可不填”原本就一致，加了测试。 | 204e42d：`src/pages/moderation/DecisionModal.tsx:20`，`mock/moderation.mock.ts:221`，`detail.test.tsx` |
| 96 名称、文案必须含英文 | 表单里 `en` 必填；错误 `ref` 为 `names.en` 或 `texts.en` | 已改：服装、动作的名称和声明文案都要求英文，提示改成“请填写英文（en）…其他语言可不填”；后端的 `names.en`、`texts.en`（及某一语言的 `names.<语言>`）显示在名称或文案框下面；假后端对缺失或空对象答 `names`/`texts`，缺英文答 `names.en`/`texts.en`。 | 4273000：`CosmeticModal.tsx:208`、`ActionModal.tsx:174`、`DeclarationModal.tsx:93`，`localized.ts`（`textOf`、`tagAliases`），`mock/avatar.mock.ts:97` |
| 97 服装、动作写入请求体 | `PUT` 必须带 `kind`、`enabled`，服装还带 `isFree`、`isDefault`、`sortOrder`，动作带 `description`、`triggerableBy`、`sortOrder`；创建时 `enabled` 必填；服装 `kind` 创建后不可改是向后端的请求 | 已改：修改服装带 `kind` 和打开对话框时的 `enabled`，修改动作带 `enabled`，不带 `key`；创建时 `enabled` 必填（类型里也必填）；假后端缺哪个字段按那个字段的 `ref` 答 400，写入 `kind`、`enabled`，带别的 `key` 答 400，价格范围 1 到 10 亿、免费条目带价格答 `creditPrice`。`isFree`、`isDefault`、`sortOrder`、`description`、`triggerableBy` 本来就在请求里。向后端的“`kind` 创建后不可改”没当作已存在，页面本来就不改 `kind`（选择框禁用）。 | 992f73a：`CosmeticModal.tsx:110`、`ActionModal.tsx:97`，`src/services/avatar/types.ts`、`index.ts`，`mock/avatar.mock.ts:177,186` |
| 98 默认条目 | 提示改成“保存后其他默认条目会自动取消”；不假设 400 且 `ref` 为 `isDefault`；409 `INVALID_STATE` 且有 `data.kind` 时写“该种类必须保留一个启用、免费、两种风格都适用的默认条目” | 已改：提示和 409 文字已改，保存和列表开关都按这句话；假后端去掉 `isDefault` 的 400，旧默认自动取消，会让原有合格默认消失的修改（取消默认、停用、改收费、去掉一种风格、新建不合格默认）整笔回滚并答 409 与 `data.kind`；原来没有合格默认时保存成功。 | 7870267：`src/pages/avatar/catalogFailure.ts`，`CosmeticModal.tsx`，`cosmetics.tsx`，`mock/avatar.mock.ts:739`（`keepingDefaults`），语言文件 `avatar.isDefault.hint`、`avatar.cosmetics.defaultKept` |
| 100 默认数字人改名 | 改名按钮在“生成中”也显示；`data.status` 缺失时只显示通用文字（已一致） | 已改：生成中的行只提供“改名”（其余按钮仍隐藏）。第 4 点（默认数字人的 409 都没有 `data.status`）：假后端原来带，已改成不带，页面本来处理缺失。顺带把已用过的上传的 409 `data.status` 从 `USED` 改成 `CONSUMED`（第 97 条回答）。 | 575779c：`src/pages/avatar/defaultAvatars.tsx:73`，`mock/avatar.mock.ts:49`，`defaultAvatars.test.tsx` |
| 130 客户端配置预览排序 | 不能用本地化比较或忽略大小写，要按码元比较原始字符串，先排除默认值行 | 已改：原来按小写后的字符串比较，改成按写下来的标签的码元比较（大写在小写前）；默认值那一行本来就排除。 | 833b296：`src/pages/clientConfig/preview.ts:56`，`preview.test.ts` |
| 135 成功返回 null | 假后端：投诉改状态、删除形象、赠送服装成功返回 `null`；重复赠送返回成功不是 409 | 已改：三个接口答 `null`（页面本来不读响应，成功后重新读取）；重复赠送成功、不写第二行；礼品对话框遇已拥有也当作完成并关闭。声明激活、上下架答案说返回更新后的条目，假后端本来就是，页面不读。 | 4d7c971：`mock/complaints.mock.ts:150,171`，`mock/avatar.mock.ts:698,707`，`GrantCosmetic.test.tsx` |
| 139 十四个设置项说明 | 第 2 条改成“后端检查未完成生成任务的间隔”；第 3、4、5 条补“超过会被拒”；第 8、9、11、12 条补起算点、方向、按谁；`moderation.*` 把方向写回 | 已改，中英文都改：`generation.poll_interval_seconds`、`chat.history_max_limit`（超过 400、不带取 50 与它的较小者）、`events.max_batch`、`events.max_body_kb`（1 KB = 1024 字节，413）、`recall.inactive_hours`、`recall.streak_min_days`、`support.rate_limit_per_hour`、`export.min_interval_hours`、`moderation.block_score`、`moderation.review_score`（分数大于或等于阈值，范围、取值关系、未保存时不调用）；其余保持。原来“说明里不写方向”的测试改成断言新方向。 | 5d0c839：`src/locales/{en-US,zh-CN}/config.ts`（如 en-US/config.ts:213,363,426），`configSchema.test.ts` |

## 测试

- 跑过且无失败的：`mock/config.mock.test.ts`、`mock/config.rules.mock.test.ts`、`src/pages/config`（99）、`src/pages/clientConfig`（159）、`mock/moderation.mock.test.ts` 和 `src/pages/moderation` 全部（165）、`src/services/moderation`、`mock/avatar.mock.test.ts`（54）、`mock/complaints.mock.test.ts`（23）、`src/pages/avatar` 全部文件（分几批跑，含 cosmetics、actions、declarations、defaultAvatars、GrantCosmetic、failureLanguage）、`src/services/avatar`、`src/pages/complaints`、`src/pages/users/detailTabs.test.tsx` 中的相关用例。机器很忙时 `src/pages/avatar` 整目录一次跑会有 60 秒超时的用例，单独重跑都没有失败。
- `npx tsc --noEmit` 全项目无诊断（在全部代码提交之后跑的）；`biome check` 我改的路径 0 诊断。
- `mock/sms.mock.test.ts` 有 4 个失败（凭据 `null`、空名称、字符串写法），是别的组（短信渠道，第 5 条）正在改的红灯，不是本组的改动；`src/services/sms/sms.test.ts` 的类型报错同属他们。

## 变异检查（改坏规则看测试是否变红）

- 第 130 号：把比较改回按小写字符串，`preview.test.ts` 的新用例变红。
- 第 98 号：去掉回滚，三个 409 用例变红。
- 第 96 号：把英文必填改回“至少一种语言”，“只有泰语”的用例变红。
- 第 95 号：假后端上限改回 500，1000 码点的用例变红。
- 第 97 号：去掉“带别的 key 答 400”，两个用例变红。
- 第 64 号：假后端 `/cosmetics` 多按 `enabled` 过滤，排序/过滤用例变红。

## 记录项（真实但不影响正确性，建议全部修）

见 `docs/contract-requests/2026-11-02-new-differences-a5.md`：审核队列默认不带状态（第 1 条）、备注的控制字符范围未核实（第 2 条）、`/enabled` 是否同样检查默认条目未核实（第 3 条）、修改带回的 `enabled` 是打开时的值（第 4 条）、目录排序的字符串比较规则未写（第 5 条）、默认数字人的 409 不带状态（第 6 条）、种子里一件只有泰语名称的服装（第 7 条）。

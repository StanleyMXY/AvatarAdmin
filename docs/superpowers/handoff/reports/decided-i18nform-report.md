立即修未修 0、记录项 2、未运行 0、阻塞 0

# 区域 i18nform：表单校验文字切换语言后跟着变（决定表第 5 条）

## 做了什么

1. 共用钩子 `useRevalidateOnLocaleChange(form)` 和挂载用的 `<RevalidateOnLocaleChange />`，在 `src/hooks/useRevalidateOnLocaleChange.tsx`。
   - 语言（`useIntl().locale`）变化时，对这个表单里"当前带错误的字段"（`getFieldsError()` 里 `errors` 非空的）调用 `validateFields(这些字段)`，用新语言的规则重新生成文字。表单不重挂载，所以输入不丢；没有错误的字段不会被校验、不会被标成"已触碰"。
   - 如果某个字段原来带的错误不是规则产生的（例如用 `setFields` 放进去的后端拒绝原因），重新校验会把它清掉；钩子在校验结束后，对"规则现在通过、但原来有错误"的字段把原来的错误原样放回，不让后端给的原因因为切语言而消失。
   - 语言没变（只是重新渲染）时什么都不做。
   - 挂载方式：`<RevalidateOnLocaleChange />` 放在 `<Form>` 里面当第一个子元素，内部用 `Form.useFormInstance()` 取表单再调钩子。不直接在页面里写 `useRevalidateOnLocaleChange(form)` 的原因：很多弹窗里的 `<Form>` 在弹窗关闭时不存在（`destroyOnHidden`），而页面组件一直在；对一个从未连接到 `<Form>` 的 `useForm` 实例调用 `getFieldsError` 等方法，rc-field-form 会在控制台报"Instance created by `useForm` is not connected to any Form element"。放在 `<Form>` 里面则只在表单存在时才存在，没有这个警告（`useRevalidateOnLocaleChange.test.tsx` 第 119 行锁住）。钩子本身也导出，直接拿 `FormInstance` 用也行。
2. 接入 43 个文件，每个文件只加两行：一行 import，一行 `<RevalidateOnLocaleChange />`（脚本用 TypeScript 语法树插在 `<Form …>` 开标签之后，再用 biome 格式化；除这两行外没有任何改动）。清单见下面"接入的文件"。
3. 防回退的扫描测试 `src/hooks/revalidateCoverage.test.ts`：凡是含 `<Form` 的 `src/**/*.tsx`（非测试），只要文件里有 `rules=`/`rules:`/`validator`/`linkRule`/`linkTargetRule`，就必须含 `<RevalidateOnLocaleChange />`；没有校验的 6 个表单写在清单里并写明理由，清单双向检查（列了的必须真没有校验，没列的有校验就必须接入）。
4. `src/locales/switch.test.tsx`：把记录残留的 `it.fails` 改成普通 `it`（第 57 行），并把"旧语言文字已消失"改成 `waitFor`（antd 的错误提示离场有动画，立刻断言会误报）；新增一条用理由弹窗（`ReasonModalForm`）验证"已显示的文字换成新语言且输入不丢"（第 67 行）。

## 接入的文件（43）

src/components/ReasonModalForm.tsx、src/components/layout/ChangePasswordForm.tsx、src/pages/activity/{ActivityFormModal,TaskFormModal}.tsx、src/pages/ads/{CampaignModal,CreativeModal,PlacementModal,UnitModal}.tsx、src/pages/analytics/FunnelNameModal.tsx、src/pages/appVersions/VersionModal.tsx、src/pages/avatar/{ActionModal,CosmeticModal,DeclarationModal,GrantCosmetic,NewDefaultAvatarModal,RenameDefaultAvatarModal,RendererModelModal}.tsx、src/pages/campaign/{CampaignModal,CostModal}.tsx、src/pages/channels/ChannelModal.tsx、src/pages/credits/{AdjustRequestModal,ApproveModal,ProductModal}.tsx、src/pages/email/TemplateEditor.tsx、src/pages/memory/{ModelForm,TierForm}.tsx、src/pages/moderation/DecisionModal.tsx、src/pages/notifications/SendModal.tsx、src/pages/push/{ScheduleModal,TaskModal,TemplateModal}.tsx、src/pages/sms/{ChannelModal,TemplateModal,TestSendModal}.tsx、src/pages/subscriptions/{AccountEntitlementsPanel,entitlements,products}.tsx、src/pages/system/{AdminFormModal,PermissionNodeModal,ResetPasswordModal,RoleModal}.tsx、src/pages/user/enroll/index.tsx、src/pages/user/login/index.tsx。

任务里估的"57 个文件左右"：先 grep 出带 `useForm`/ProForm 类的有 60 多个，其中一部分只是引用 `ReasonModalForm`（它内部已接入，所以使用它的 `users/BanUserModal`、`users/StartDeletionModal`、`credits/requests`、`cost/PendingTab`、`cost/CurrentTab`、`ads/creatives` 自动跟着变，不需另改）、`ConfigForm`（见下）或把 `form` 当参数传入的子组件（`push/AudienceFields`、`push/ContentFields`，在 `TaskModal`/`TemplateModal`/`ScheduleModal` 的 `<Form>` 里，已覆盖）。真正自己有 `<Form>` 且有校验规则的是 43 个。

不需要接入的：
- `src/pages/config/ConfigForm.tsx`、`ConfigRow.tsx`：不用 antd 规则，错误文字是每次渲染时由 `validateValue` 算出来的，语言一变自然是新语言。
- 6 个没有任何规则的 `<Form>`：`analytics/detail.tsx`、`analytics/funnel.tsx`、`campaign/LinkModal.tsx`、`companionship/index.tsx`、`complaints/ComplaintDrawer.tsx`、`invite/FissionTab.tsx`（其中 `FissionTab` 把"问题的键"存在状态里再翻译，语言一变自然跟着变；`companionship` 的情况见记录项 2）。

## 测试与命令

RED（实现之前）：
- 命令：`npx vitest run src/hooks/useRevalidateOnLocaleChange.test.tsx src/locales/switch.test.tsx`
- 结果：`switch.test.tsx` 里去掉 `.fails` 的那条失败：`Unable to find an element with the text: 请输入用户名`（旧语言的文字还在，新语言的文字没有出现）——因为功能不存在而失败；`useRevalidateOnLocaleChange.test.tsx` 因 `Failed to resolve import "./useRevalidateOnLocaleChange"` 整个文件无法加载。（两个测试文件 2 failed。）

GREEN：
- `npx vitest run src/hooks/useRevalidateOnLocaleChange.test.tsx`：7 个测试全过（`useRevalidateOnLocaleChange.test.tsx` 第 55 行起：换语言后已显示的文字换成新语言且输入不丢，英文到中文再到泰语；没有错误的字段不被标记；没有错误时什么也不显示；后端放进去的文字规则通过时原样保留；语言不变不校验；弹窗关闭时无控制台错误；不接入时文字停留在旧语言，作为对照）。
- `npx vitest run src/hooks/revalidateCoverage.test.ts`：3 个测试全过。
- `npx vitest run src/locales/switch.test.tsx`：4 个测试全过（连续跑 3 次都过）。
- 相关范围：`npx vitest run src/hooks src/locales/switch.test.tsx src/locales/parity.test.ts tests/noHardcodedText.test.ts` 加上被接入文件所在的 21 个目录（src/components、src/components/layout、src/locales、src/pages 下的 activity、ads、analytics、appVersions、avatar、campaign、channels、credits、email、memory、moderation、notifications、push、sms、subscriptions、system、user/enroll、user/login）：153 个测试文件、2944 个测试，2939 过，5 失败。5 个失败：`switch.test.tsx` 那条（"旧语言文字已消失"立刻断言遇到离场动画，已改 `waitFor`，之后 3 次全过），另外 4 个是 `campaign/accounts.batch.test.tsx`（5420ms）、`campaign/accounts.campaigns.test.tsx`、`campaign/accounts.costs.test.tsx`（5792ms）、`channels/channels.test.tsx`，是同一台机器上多个代理同时跑测试时超过 5 秒的超时；单独重跑这四个文件 131 个测试全过。没有跑全量测试和构建（按约定）。
- parity 测试和"禁止写死文字"扫描在上面的范围里，通过。本次没有新增界面文字，所以不涉及 zh-CN、en-US 语言文件。
- `npx biome check` 对改动的文件通过；类型检查由提交前钩子（暂存文件的 tsc）执行。

变异检查：
- 把 `TestSendModal.tsx` 里的 `<RevalidateOnLocaleChange />` 删掉：`revalidateCoverage.test.ts` 第 33 行那条变红（`expected [ 'src/pages/sms/TestSendModal.tsx' ] to deeply equal []`），恢复后变绿。
- 把钩子改成直接 `return`（不重新校验）：`useRevalidateOnLocaleChange.test.tsx` 的前两条和 `switch.test.tsx` 的"已在屏幕上"那条变红，恢复后变绿。
- 去掉"把后端放进去的文字放回"的那一步（`if (false) form.setFields`）：第 92 行那条变红（第一次断言只看屏幕文字没红，因为 antd 错误提示有离场动画，改成同时断言 `form.getFieldError('name')` 后变红），恢复后变绿。

语言覆盖：钩子测试用英语、中文、泰语三种语言的文字；`switch.test.tsx` 用 zh-CN 和 en-US 的真实语言文件。没有覆盖阿拉伯语、印尼语、越南语、西班牙语（该钩子只比较语言标识并重新校验，行为与具体语言无关，但按约定写明：这里的检查只覆盖中、英、泰）。

没有做真实浏览器检查：本次没有新增页面，也没有改页面行为，只是在表单里加了一个不渲染任何东西的子组件；表单行为由上面的测试在 happy-dom 里覆盖。

## 没做的和原因

- 未改共享的 `src/hooks/*` 以外的任何共用文件；`src/hooks/` 里新增文件是本任务要求的共用钩子。
- 没有改任何页面里的其他部分。

## 新发现的问题（按 CLAUDE.md 分类）

记录 1：用 `setFields` 放进表单的文字，切语言后仍是旧语言，直到用户再次提交或改这个字段。
- 触发步骤：英文界面下提交一个会被后端拒绝的表单（例如重复的编号，`subscriptions/products.tsx:95` 把 `t('subscriptions.products.exists')` 放进字段），不关弹窗直接切到中文；字段下的文字仍是英文。钩子按设计把它原样放回（它不是规则产生的，没有可靠的办法重新生成），所以这是钩子的边界，不是钩子的缺陷。
- 位置：所有把译好的文字存进字段错误的 `setFields` 调用：`src/components/layout/ChangePasswordForm.tsx:65,70`、`src/pages/system/PermissionNodeModal.tsx:103`、`src/pages/system/formFailure.ts:23,36`、`src/pages/subscriptions/products.tsx:95,114`、`src/pages/subscriptions/entitlements.tsx:201,205`、`src/pages/subscriptions/AccountEntitlementsPanel.tsx:105`、`src/pages/credits/ProductModal.tsx:69`、`src/pages/credits/AdjustRequestModal.tsx:50`、`src/pages/memory/ModelForm.tsx:66`、`src/pages/channels/ChannelModal.tsx:91`、`src/pages/appVersions/VersionModal.tsx:219`、`src/pages/ads/CreativeModal.tsx:242`、`src/pages/ads/UnitModal.tsx:128`，以及 `src/pages/{campaign,activity,sms,avatar,email,push,ads}/formFailure.ts` 里同类的调用。
- 后果：只影响提交失败后马上切语言这一个窗口里的一条文字，内容是对的但语言不对；用户再提交或改动该字段就恢复。建议修（和其他记录项一起）：失败时把"错误的键和参数"存起来，用校验器（`validator` 读状态）在重新校验时生成文字——这会改每个页面的失败处理，属于对这些页面的改动，所以没有放进本次"只加钩子几行"的范围。

记录 2：`src/pages/companionship/index.tsx:50,97,111` 的 `errors` 状态存的是已经翻译好的文字（`reason(problem)`、`fields.find(...).text`），不是键；校验失败后切语言，文字停留在旧语言，直到再次提交。
- 触发步骤：英文界面下把阶段阈值填成不合法的值并保存，出现错误提示，再切到中文，提示仍是英文。
- 这个页面不是 antd 规则校验，钩子管不到；修法是存键和参数，渲染时翻译（像 `invite/FissionTab.tsx` 那样）。

契约缺口、需要改共享文件、规格需要在 main 上修改的地方：无。

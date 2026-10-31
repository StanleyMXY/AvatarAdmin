立即修未修 2、记录项 4、未运行 2、阻塞 0

# 区域 i18nform（表单校验文字切换语言后跟着变）评审

评审对象：提交 `dcd6186`（共用钩子 `useRevalidateOnLocaleChange` 和挂载用的 `<RevalidateOnLocaleChange />`、接入 43 个表单文件、防回退扫描 `revalidateCoverage.test.ts`、`switch.test.tsx` 去掉 `it.fails`），报告 `reports/decided-i18nform-report.md`；对照 `decisions-2026-10-27.md` 的第 5 条。一次独立评审，没有加复审轮次。评审者没有改任何实现代码：变异检查只在我放在草稿目录里的 HEAD 副本上做；临时探针测试文件已从仓库删除，`git status` 无差异；我起的开发服务器按进程号停掉，端口已关。

## 四个数字怎么来的

- **立即修未修 2**：第一节。第 1 条是这个区域该做到、实现者的报告没提到的：养成管理页切换语言会丢掉还没保存的输入。第 2 条在区域外，是我在真实浏览器里为了复现第 1 条打开同一个页面时看到的。
- **记录项 4**：第三节。实现者报告里的两条记录项我都核实了（并补了真实浏览器的复现和漏掉的位置），另外两条是它没发现的测试缺口和一处写错的理由。
- **未运行 2**：（a）全量测试和构建，按约定留到全部任务做完后跑一次；（b）弹窗和抽屉里那 40 个表单没有在真实浏览器里切换过语言（原因在第四节第 1 条：弹窗的遮罩盖住了页头的语言选择，界面上做不到，我只在三个不在弹窗里的表单上做了真实浏览器检查：登录页、强制改密码页，和养成管理页）。
- **阻塞 0**。

## 我跑了什么

| 项 | 方法 | 结果 |
|---|---|---|
| 相关测试 | `npx vitest run src/hooks/useRevalidateOnLocaleChange.test.tsx src/hooks/revalidateCoverage.test.ts src/locales/switch.test.tsx` | 3 个文件 14 个测试，0 失败 |
| 覆盖核对（我自己数的） | 对 `src` 下所有含 `<Form` 开标签（含 `<Form<Values>` 这种带泛型的）的非测试 `.tsx` 文件逐个数 `<Form` 个数、`<RevalidateOnLocaleChange />` 个数、有没有规则文字 | 43 个有规则的文件每个都正好一个表单、一个挂载；没挂的 6 个（加上钩子文件本身）都没有规则文字。没有一个文件有两个 `<Form`，所以"文件里有一个挂载"就等于"表单里有挂载" |
| 变异检查 | 在草稿目录的 HEAD 副本里改一处，只跑守这条的测试，立刻还原 | 3 个变异里 1 个被抓住，2 个没有，见下 |
| 真实浏览器 | 草稿目录里 `max dev`（假后端），Playwright 的 Chromium，1280 宽，真实点击 | 登录页、强制改密码页、养成管理页，结果见下 |
| 读代码 | 钩子、挂载组件、43 处接入的 diff（每处只多两行）、扫描测试、`ChangePasswordForm`、`LinkInput`、`ConfigForm`、`ConfigRow`、养成管理页、`LangSwitch`、antd 的 `ErrorList` | 见下 |

变异检查明细：

| 变异 | 改了什么 | 结果 |
|---|---|---|
| M1 | 把 `sms/TestSendModal.tsx` 里的 `<RevalidateOnLocaleChange />` 移到 `<Form>` 外面（兄弟节点） | `revalidateCoverage.test.ts` 仍 3 个全过，没有变红。见记录 3 |
| M2 | 同一处改成注释 `{/* <RevalidateOnLocaleChange /> */}` | 仍 3 个全过，没有变红。见记录 3 |
| M3 | 钩子里 `validateFields(这些字段)` 改成 `validateFields()`（校验全部字段） | `does not mark a field that showed no message` 变红，被抓住 |

本机 Node 是 22.22.0，低于 `execution-conventions.md` 要求的 `^22.22.1`；测试能跑，我没有去换版本，只在这里写一句。

## 一、立即修（2）

**1. 养成管理页切换语言会丢掉还没保存的输入。**
- 位置：`src/pages/companionship/index.tsx:52-62`（`load` 是 `useCallback(..., [intl])`，里面 `:57` 的 `setDraft(draftOf(mine))` 把输入框的草稿重置成服务器的值），`:64-66`（`useEffect` 以 `load` 为依赖，语言一换 `intl` 变了，`load` 变了，副作用重新跑）。
- 触发步骤（我在真实 Chromium 里做的）：英文界面，登录后打开 `/companionship`，把"一次互动的间隔（分钟）"从 77 改成 99 但不保存，在页头的语言选择里选"简体中文"。读输入框的值：切换前 `['50','150','99']`，切换后 `['50','150','77']`。
- 错误结果：用户输入的值被静默换回服务器的值，没有提示。这正是决定第 5 条写的"不用整页重新挂载（会丢输入）"想避免的事，只是这个页面是自己重新读数据造成的，钩子管不到。报告里把这个页面只当成"错误文字存的是译文"（它的记录项 2），没看到草稿也会丢。
- 为什么是立即修：属于"数据丢失"（用户已输入、尚未保存的内容）；决定明确要求"保留输入"；这个页面是页头语言选择够得着的（不在弹窗里）。不是这次提交引入的，但这个区域要做到的句子在这里没有做到。
- 怎么修（我不改实现代码，交给主会话）：`load` 不要依赖 `intl`（失败文字的做法是存失败对象、渲染时翻译，像 `ChangePasswordForm.tsx` 的 `alert` 状态那样），这样语言一换不会重新读数据。同样的写法我读过的其余几处（`config/ConfigForm.tsx:49`、`subscriptions/gates.tsx:181`、`activity/ActivityFormModal.tsx:93`、`avatar/GrantCosmetic.tsx:62`）：`ConfigForm` 的每一行（`ConfigRow`）自己持有草稿且按键作 `key`，重新读只换 `items`，不丢输入；`gates` 页的编辑在弹窗里；`ActivityFormModal` 和 `GrantCosmetic` 是弹窗，语言选择在遮罩后面，够不着（第四节第 1 条）。`moderation/queue.tsx:59`、`push/templates.tsx:54`、`memory/tiers.tsx:30`、`memory/models.tsx:29`、`subscriptions/products.tsx:275`、`subscriptions/entitlements.tsx:292` 我没有逐个读，不下结论，主会话修第 1 条时可以顺手看一眼它们的草稿状态在不在 `load` 里被重置。

**2. （区域外）养成管理页的"阶段起点"两个数字框在 Chromium 里几乎看不见：BONDING 那一个宽度为 0，CLOSE 那一个被截成 "CLOSE 15"。**
- 位置：`src/pages/companionship/index.tsx:134-147`（两个带 `prefix="BONDING"` / `prefix="CLOSE"` 的 `InputNumber`，没有给宽度，放在 `<Flex gap={12} wrap>` 里）。
- 触发步骤：英文界面，暗色主题，1280 宽，打开 `/companionship`。截图里 BONDING 只剩前缀文字，输入框 `getBoundingClientRect().width` 是 0（Playwright 报"元素不可见"，`fill` 超时）；CLOSE 显示成 "CLOSE 15"，值被截断。前缀文字是固定的拉丁字母，和界面语言无关。
- 错误结果：管理员看不到、也改不了 BONDING 阶段的起点值，另一个也读不全。
- 范围：不是这个区域的内容，我只在 Chromium 一个浏览器一个宽度一个主题上看到，没有查根因（猜测是 antd 的 `InputNumber` 默认宽度被前缀占满）。按"输出错误"归立即修，请主会话单独处理或另派。任务 32 的浏览器走查只"打开、看、读"，没有操作这个页面的输入框，所以没发现。

## 二、决定写的每个句子，界面和代码里是不是真的做到了

决定第 5 条原文："表单校验文字切换语言后仍是旧语言 ｜ 做一个共用钩子：语言切换时，对已挂载表单里'当前带错误的字段'重新校验；各表单接入。不用整页重新挂载（会丢输入） ｜ 国际化表单的通行做法：保留输入，只刷新提示"。

| 句子 | 做到了吗 | 位置和依据 |
|---|---|---|
| 做一个共用钩子 | 做到 | `src/hooks/useRevalidateOnLocaleChange.tsx`：钩子加一个放进 `<Form>` 里的无界面组件（用 `Form.useFormInstance()` 取表单）。选这个形式的理由（弹窗关着时没有 `<Form>`，对没连上的表单实例调用会在控制台报警）我读了，成立，测试 `useRevalidateOnLocaleChange.test.tsx` 的"is silent while the form is not on screen"守着 |
| 语言切换时 | 做到 | 钩子里 `useIntl().locale` 变了才跑；语言没变只重新渲染时不跑（有测试，`validateFields` 的间谍断言没被调用）。真实浏览器：页头选语言后，登录页和强制改密码页的错误文字当场换了 |
| 对已挂载表单里"当前带错误的字段"重新校验 | 做到，边界见记录 1、2 | 钩子只取 `getFieldsError()` 里 `errors` 非空的字段，用 `validateFields(这些字段)` 重新校验；没有错误的字段不被校验、不被标成"已触碰"（有测试，变异 M3 被抓住）。在真实浏览器里的强制改密码页：两次新密码不一致的错误，英文 "The two new passwords are not the same" 切到中文后是 "两次输入的新密码不一致"，其余两个没错误的字段没有出现提示 |
| 各表单接入 | 做到（有规则的 43 个都接入） | 我自己数的（见上表）。没接入的 6 个没有规则文字，但其中 `campaign/LinkModal` 的理由写错了，见记录 4；还有不走表单规则、把译文存在状态里的错误文字没有被管到，见记录 2 |
| 不用整页重新挂载（会丢输入） | 钩子做到，养成管理页没做到 | 钩子不重新挂载，真实浏览器里强制改密码页切换语言后确认框里输入的 "different-pass" 还在。养成管理页自己重新读数据把草稿丢了，见立即修 1 |
| 依据：保留输入，只刷新提示 | 同上 | 同上 |

不在决定里、实现者另加的一项：规则通过但原来有错误的字段（例如用 `setFields` 放进去的后端拒绝原因），钩子把原来的错误原样放回，不让它因为切语言而消失。这是对的，防止后端的原因被校验清掉；它带来的边界见记录 1。我读过代码：先 `validateFields`，再对"校验后没有错误但校验前有"的字段 `setFields` 放回，有测试，实现者做过变异。

## 三、记录（4）

**1. 用 `setFields` 放进字段的译文，切语言后仍是旧语言（实现者的记录项 1，我在真实浏览器里复现了）。**
- 位置：报告列出的 `setFields` 调用（我核对了 `src/components/layout/ChangePasswordForm.tsx:65,70`），以及各页 `formFailure.ts`。
- 触发步骤（真实 Chromium，不在弹窗里的页面）：新建的账号 `newhire` 登录后被送到 `/user/change-password`；界面选中文，"旧密码"填一个错的，提交，字段下显示 "旧密码不对"；在页头把语言切到 English。字段下仍是 "旧密码不对"。
- 错误结果：内容是对的，语言不对；用户再提交或改这个字段才恢复。影响一个很短的窗口。
- 修法：失败时存"键和参数"（或失败对象），让校验器在重新校验时读状态再生成文字。`ChangePasswordForm` 自己的提示条已经是这样做的（`alert` 存 `{ failure }`），`module-task-brief.md` 也规定提示条存键不存译文，所以做法在项目里已有。建议和第 2 条一起全部修。
- 实际能触发的范围比报告写的小：弹窗里的表单切不了语言（第四节第 1 条），够得着的只有登录、绑定验证器、强制改密码这三个不在弹窗里的页面。

**2. 不是 antd 规则、把译文存在状态里的校验和失败文字，切语言后仍是旧语言（实现者的记录项 2 只写了养成管理页，实际不止）。**
- 位置（我读代码核对的，除第一处外没有逐个在浏览器里复现）：
  - 养成管理页 `src/pages/companionship/index.tsx:50,97,111`（报告已列）。
  - 后端参数每一行 `src/pages/config/ConfigRow.tsx:41-42,69-75,187-192`：`fieldError`、`alert` 存的是 `describeFailure(...).text`。这一页在页面里（不在弹窗），语言选择够得着。
  - 存译文的状态，位置在弹窗和抽屉里：`src/pages/clientConfig/ClientConfigEditor.tsx:89,113,457`（`languageProblem`）、`src/pages/notifications/SendModal.tsx:83,142,413`（`languageProblem`）、`src/pages/avatar/ActionModal.tsx:72,80,103,192`（`iconProblem`）、`CosmeticModal.tsx:82,90,119,224`（`pictureProblem`）、`NewDefaultAvatarModal.tsx:31,38,51,99`（`sourceProblem`）、`RendererModelModal.tsx:52,59,76,138`（`fileProblem`）、`src/pages/appVersions/ApkUpload.tsx:54,63-124,207`（`problem`）、`src/pages/campaign/LinkModal.tsx:39,56,67,156`（`problem`）。
  - 失败提示条：`setFailure(describeFailure(...).text)` 在 38 处。
- 触发步骤（页面里的那一处，ConfigRow）：英文界面打开一个后端参数页，保存一个后端会拒绝的值，行下出现英文的原因；切到中文，原因仍是英文。
- 错误结果：同第 1 条，文字内容对、语言不对。
- 为什么是记录不是立即修：文字对，只影响提交失败后马上切语言的那一小段；弹窗和抽屉里的这些在界面上切不了语言。
- 修法：存键和参数（或失败对象），渲染时翻译；和 `invite/FissionTab.tsx`、`analytics/funnel.tsx` 的写法一致。

**3. 测试缺口：防回退扫描挡不住"挂载位置不对"和"只剩注释"。**
- 位置：`src/hooks/revalidateCoverage.test.ts:33-39`（只检查文件文本里含 `<RevalidateOnLocaleChange />`）。
- 触发步骤：变异 M1（把组件移到 `<Form>` 外面）和 M2（改成注释），`npx vitest run src/hooks/revalidateCoverage.test.ts` 仍 3 个全过。放在 `<Form>` 外面时 `Form.useFormInstance()` 拿到的是默认的空实例，什么也不会重新校验，文字就停在旧语言。
- 错误结果（如果以后有人改坏）：扫描通过，表单实际没接入，没有测试变红。
- 修法：扫描里用语法树或正则要求它出现在 `<Form` 开标签之后、`</Form>` 之前，并去掉注释再查。

**4. 测试里的一条理由写错了。**
- 位置：`src/hooks/revalidateCoverage.test.ts:11`：`'src/pages/campaign/LinkModal.tsx': 'fields with no rule, the text is built from keys'`。
- 事实：`src/pages/campaign/LinkModal.tsx:39,56,67,156` 的 `problem` 存的是译好的文字（`t('campaign.link.noPixel')`、`describeFailure(...).text`），不是键。字段确实没有规则，所以放在没有校验的清单里是对的，但"文字是由键生成的"这句话不对，会让以后的人以为它切语言会跟着变。报告里同样写了"`FissionTab` ... 语言一变自然跟着变"，那一条我核对了，`FissionTab` 和 `funnel` 的问题是存键的，成立。
- 修法：改写理由，并按记录 2 一起处理。

## 四、不是缺陷

1. **弹窗和抽屉打开时，页头的语言选择够不着。** 我在真实浏览器里试了：改密码对话框打开着，对页头选择框点击，Playwright 报"`.ant-modal-wrap` 拦截了点击"。所以弹窗里 40 个表单的接入，用户在界面上用不到；它们要在弹窗打开期间切语言只能靠不走界面的手段。这不让接入变成错的（成本只有两行，将来有别的切换方式时就有用），但意味着这个区域真正能被用户触发的范围是：登录页、绑定验证器页、强制改密码页，和页面里的表单（养成管理页）。报告没有写这一点。
2. **happy-dom 里已显示错误的文字有时不换，真实浏览器里换。** 我写的探针（真实的 `ChangePasswordForm`，英文到中文）在 happy-dom 里，表单状态已经是中文（`getFieldsError()` 返回 "两次输入的新密码不一致"），但 DOM 里留着一个动画离场中的英文元素，不出现新的文字；同一个表单在真实 Chromium 里当场换了。原因是 antd 的 `ErrorList` 用错误文字当 key，文字一变就是"旧的离场、新的进场"，happy-dom 里离场动画不结束。实现者的单元测试用 `findByText` 和 `waitFor`，在它们的两个表单上是稳的。这是测试环境的差别，不是代码缺陷；但意味着 happy-dom 里关于"错误文字换了"的断言要小心，真实浏览器的检查不能省（本次我补做了三处）。
3. **规则通过但原来有错误的字段，钩子原样放回旧错误。** 这是设计选择（只有规则能重新生成文字），后果在记录 1。
4. **没挂载的 6 个表单**（`analytics/detail`、`analytics/funnel`、`campaign/LinkModal`、`companionship/index`、`complaints/ComplaintDrawer`、`invite/FissionTab`）确实没有 antd 规则：我读了文件，`rules=`、`rules:`、`validator` 都没有，也没有通过 `LinkInput`、`LinkTargetField` 引入规则（这两个组件只在 `ConfigRow`、`SendModal`、`push/LinkField`、`push/ContentFields`、`ads/CreativeModal` 里被用）。扫描的"双向检查"成立。
5. **`config/ConfigForm.tsx`、`ConfigRow.tsx` 不接入钩子**：它们不用 antd 规则，`problem` 在渲染时由 `validateValue` 现算，语言一变自然跟着变（这一点成立；它存译文的错误状态见记录 2）。
6. **钩子在校验期间的竞态**：同一毫秒级的窗口里连续切两次语言，第二次的 `getFieldsError()` 可能读到第一次校验刚清空的错误。要用程序连续切换才会遇到，人用页头选择做不到，不记。

## 五、语言覆盖

钩子的测试用英语、中文、泰语的文字（`useRevalidateOnLocaleChange.test.tsx`），`switch.test.tsx` 用 zh-CN 和 en-US 真实语言文件。钩子只比较语言标识并重新校验，行为与具体语言无关，所以阿拉伯语、印尼语、越南语、西班牙语没有单独的测试，这一点和报告一致；界面只有 zh-CN 和 en-US 两种，我的真实浏览器检查也只覆盖这两种，结论只覆盖中文和英文。

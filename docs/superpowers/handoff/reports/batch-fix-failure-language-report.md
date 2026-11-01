立即修未修 0、记录项 1、未运行 1、阻塞 0

# 失败提示按界面语言现算：结果

分支 `claude/jolly-dirac-4pq9g6`。开始时工作区没有未提交的改动。代码和测试一共 28 个提交（外加这份报告的一个），没有推送。起因是上一份报告（`batch-fix-last-report.md`）的记录项 1：页面把失败原因按“当时的语言”写成字符串存进状态，切换界面语言后提示还是旧语言。

## 先纠正上一份报告的一句话

任务说明里写“共用的 `PagedListTable` 已经是存失败对象、渲染时现算”。我读了代码，不是这样：`src/components/PagedListTable.tsx` 原来存的是 `{ text, code }`，文字已经是旧语言。只有 `useLatestRead` 和 `useServerPage` 是对的。`UploadField` 也存了文字。这两个共用组件一并改了，所以所有用 `PagedListTable` 的列表页在失败时也跟着语言变（这是之前最大的一块遗漏）。

## 清单：不是 41 处，而是 108 处、77 个文件

用 grep 只能找到 41 处 `setXxx(describeFailure(...).text)`。同一类问题还有几种写法，grep 找不全，所以我写了一个按语法树的扫描（`tests/storedFailureText.scan.ts`），在修改前的代码上跑出来：108 处、77 个文件（扫描结果存在草稿目录，下面列出文件和处数）：

- 41 处 `setXxx(describeFailure(intl, error).text)`。
- 约 30 处 `setXxx(failureToForm(...).text)` 或 `result.text`（表单对话框底部的提示条）。
- 约 20 处经过帮手函数：`actionFailure`、`templateFailureText`、`guardedFailureText`、`withScopeHint`、`protectedFailureText`、`chainFailureText`、`defaultAvatarFailure`、`failureLine`、`failureLines`，以及页面文件里自己写的返回文字的函数（`moderation/DecisionModal.tsx` 的 `failureText`）。
- 页面把整个提示条的内容存成 `{ text, more }`、`{ kind: 'failed', text }`、`{ phase: 'failed', text }` 这类结构。
- 同类的第二批：存起来的不是服务端失败，而是页面自己按当时语言写的“问题”文字：头像的四个上传对话框（`setIconProblem(t('…'))` 等）、`ClientConfigEditor.tsx` 与 `notifications/SendModal.tsx` 的“语言标签重复/无效”、`campaign/LinkModal.tsx` 的“没有像素编号”、`complaints/ComplaintDrawer.tsx` 的备注过长、`ClientConfigEditor.tsx` 的 `serverErrors`、`subscriptions/entitlements.tsx` 的 `errors`、`campaign/BatchModal.tsx` 的 `refused`。这些现在存语言文件的键或原因代码，画的时候再翻译。

修改前各文件的处数：PagedListTable(1)、UploadField(2)、activity/ActivityFormModal、ActivityViewModal、TaskFormModal 各 1、ads 四个对话框各 1、analytics 2 个文件各 1、appVersions 2 个文件各 1、avatar 7 个文件共 16、campaign 5 个文件共 7、channels/ChannelModal 1、clientConfig 2 个文件共 7、complaints 2 个文件共 4、config/ConfigForm 1、cost/ActionModal 1、credits 5 个文件各 1、email/TemplateEditor 1、invite/FissionTab 1、memory 5 个文件共 8、moderation 6 个文件共 12（其中 `rules.tsx` 7）、monitor/pipeline 1、notifications 2 个文件共 3、push 6 个文件共 8、sms 3 个文件各 1、stat 2 个文件各 1、subscriptions 6 个文件共 8、support/FeedbackDrawer 1、system 4 个文件各 1、users 2 个文件各 1。

## 做法

新增 `src/hooks/useFailure.ts`，页面不再存文字，而是存失败本身（或一个“拿到翻译器就能写出文字”的小函数），画的时候用当前语言现算：

- `useFailure()`：返回 `text`、`fail(error)`、`failWith(写法)`、`clear()`。用在“一行失败提示”。
- `useFailureView<V>()`：同样的做法，但提示条有多行（`{ text, more }`）。
- `wordsOf(error)`、`Words`、`FailureLines`：上面两个用到的类型和函数。
- `failureWords(...)`（`src/utils/failureToForm.ts`）：把“提示条文字和没有落到字段上的细节”从 `failureToForm` 里拆成不碰表单的纯函数；`failureToForm` 仍然负责把原因写到表单字段下面。`system/formFailure.ts` 里有同样的 `failureView`。
- `failureCode(error)`（`src/session/describe.ts`）：只要错误码、不要文字的地方用，不依赖语言。
- 能直接换成 `useLatestRead`/`useLatestCall` 的我没有硬换：这批页面的读取逻辑各有特点（保持旧数据、重试、清空顺序），换成共用钩子会改行为；它们保持原来的读取逻辑，只把失败改成存失败本身。

结构比较复杂的几处单独说明：

- `moderation/rules.tsx`：保存被拒绝后存 `{ error, 行数, 折叠后为空的行, 已编辑的行, 是否已删行 }`，提示条、每行下面的红字、表格上方的红字都在画的时候现算；行为（编辑某行后该行红字消失、删行后行和表格的红字消失而提示条留着）与原来一致。
- `notifications/SendModal.tsx`：同样存失败和账号列表，画的时候现算提示条、账号行、语言标签下的红字。
- `subscriptions/entitlements.tsx`：服务端返回的字段原因从存下来的失败里现读，自己检查出的问题存原因代码。
- `ads/UnitModal.tsx`、`ads/CreativeModal.tsx`、`appVersions/VersionModal.tsx`、`channels/ChannelModal.tsx`：把“按位置分类失败细节”抽成纯函数，写表单字段用当时的语言（见记录项），提示条画的时候现算。
- `campaign/stats.tsx`：失败和日期范围提示都从存下来的失败现算。

## 行为上的一处差别（请负责人知道）

22 个页面原来会在切换界面语言时重新请求一次数据，原因只是它们读取函数的依赖里放了 `intl`（为了在出错时写当时语言的文字）。文字改成画的时候现算后，这个依赖没有用了，biome 的依赖检查也要求去掉，所以这些页面现在切换语言不再重新请求（与 `stat/daily`、`stat/retention`、`credits/stats` 等已经这样做的页面一致，文件里原来就写着“切换语言不是重新读取的理由”）。数据本身不受语言影响，所以没有看得见的变化；失败提示也不会在切换语言时被清空再重来。

受影响的页面：activity 查看对话框、avatar 赠送物品对话框、campaign 效果页、complaints 抽屉、config 参数表单、invite 裂变层级、memory（档位列表、档位编辑、模型列表、账号记忆）、monitor 流水线、notifications 抽屉、push（统计、发送记录、记录行详情、模板矩阵）、subscriptions（统计、开关、产品、权益、账号权益、订阅抽屉）、support 反馈抽屉。如果负责人想保留原来的“切语言就重读”，在这些页面的读取函数依赖里加回 `intl` 即可，但那样失败提示条会先消失再出现，并且每个页面多一次请求。

## 测试

- 共用助手 `tests/failureLanguage.tsx`：`renderWithLocaleSwitch`（可在页面挂着的时候切语言）、`failRequests`/`failEverything`（让指定请求回 500）、`expectFailureFollowsLanguage`。它做五件事：英文下出现失败文字；切到中文；中文文字出现；英文文字在整页上消失；带这段文字的元素里没有任何拉丁字母（`allowed` 可放行单位等）；并且从看到英文起数 `fetch`，切换语言后一次请求都不能有。
  - 我第一版是用 `useMockBackend` 的请求列表数请求，发现被我自己拦截的失败请求不会进这个列表，检查是瞎的，所以改成在助手里直接包 `fetch` 来数。
- 每页一条（或几条）“切换语言后提示跟着变”的测试：26 个 `failureLanguage.test.tsx`，共 87 条，覆盖每个改过的页面和对话框（带细节的拒绝也各有一条：规则列表的行与表格、通知发送的账号与语言、权益开关的原因）。
- 扫描测试 `src/session/storedFailureText.test.ts`：扫 `src` 下所有非测试文件，禁止把 `describeFailure(...)`（以及基于它的函数、同文件里返回这类文字的函数）的结果存进 `useState` 的设值函数，也禁止给名字带 problem/failure/error/refus/reject 的状态直接放语言文件里翻译出来的文字。附 6 条自测，防止扫描什么都找不到。
- 红绿：把改过的源码暂时还原到修改前（`git stash`，测试文件不动），27 个文件全部失败：87 条语言测试全红，扫描测试红并列出 108 处/77 个文件；其中 22 条红是因为“切换语言发了请求”，其余是文字仍是英文。改回后 98 条（28 个文件）全部成功。
- 变异检查（改后恢复，恢复后用 `diff` 核对过）：
  1. 把 `useFailureView` 的依赖里去掉 `intl`：`useFailure.test.tsx` 与 stat、clientConfig、credits 的语言测试共 12 条变红。
  2. 把 `describeFailure` 从扫描的函数名单里去掉：扫描的 3 条自测变红。
  3. 把 `support/FeedbackDrawer.tsx` 还原成修改前：扫描测试红，列出这个文件；它的语言测试也红。
  4. 在 `clientConfig/useItems.ts` 的读取依赖里重新放进 `intl`：该模块的 2 条测试因“切换语言发了请求”变红。
  5. 一个把文字存进状态的小组件（`useFailure.test.tsx` 里的 `KeepsText`）：共用助手对它报错，这条自测要求助手必须报错。
- 测试数据：含泰语、阿拉伯语、越南语等的数据沿用各模块已有的假数据；失败文字本身只检查英文和简体中文两种界面语言（项目只有这两种），所以这批测试的结论只覆盖这两种界面语言。

## 真实浏览器（Playwright Chromium）

在草稿目录拷贝里起 `dev:mock`（端口 8461），登录 `root`，用页面路由让请求回 500，真的切换界面语言（点右上角语言选择）：

- `/credits/stats`：英文 “Failed to load: Server error. Please try again later.” → 中文 “加载失败：服务端出错，请稍后重试”，中文提示里没有拉丁字母。
- `/push/templates`（共用的 `PagedListTable` 条和矩阵条同时出现）：两条都从英文变成中文（“矩阵用的模板没有读到：服务端出错，请稍后重试”、“加载失败：服务端出错，请稍后重试”），没有英文残留。
- `/moderation/rules`（保存被拒绝，带行号的细节）：提示条 “1 rows need to be corrected first; nothing was saved.” 与行下红字 “The value is too long.” → “有 1 行需要先改正，什么都没有保存。” 与 “内容过长”，没有英文残留。
- 控制台没有错误；截图在草稿目录，没有放进仓库。
- 另外一处我想看的页面（带遮罩的对话框）在浏览器里无法在对话框打开时切换语言（遮罩盖住了顶栏），所以对话框里的场景只由单元测试覆盖。

## 记录项（1 条）

1. **表单字段下面的“服务端给的原因”仍是写入时的语言。** 触发：以英文打开任一编辑对话框，让后端对某个字段回 400（`INVALID_REQUEST`，细节 `{ ref: 'name', reason: 'TOO_LONG' }`），字段下面出现 “The value is too long.”，把界面切到简体中文，对话框底部的提示条已经变成中文，字段下面仍是 “The value is too long.”（我用一条临时测试量过，在 `campaign/CampaignModal.tsx` 的编辑对话框上，已删除，没有进仓库）。原因：这些文字是用 `form.setFields(...)` 交给 antd 表单保管的，不在页面的状态里；`src/hooks/useRevalidateOnLocaleChange.tsx:12` 的注释写明“服务端给的原因原样放回”。位置：`src/utils/failureToForm.ts:73`、`src/pages/system/formFailure.ts:44`、`src/pages/ads/UnitModal.tsx:140`、`CreativeModal.tsx:250`、`src/pages/appVersions/VersionModal.tsx:234`、`src/pages/channels/ChannelModal.tsx:100`、`src/pages/credits/ProductModal.tsx:77`、`AdjustRequestModal.tsx:50`、`src/pages/subscriptions/products.tsx:119`、`entitlements.tsx:228`、`AccountEntitlementsPanel.tsx:108`、`src/pages/memory/ModelForm.tsx:50`、`src/components/layout/ChangePasswordForm.tsx:72` 等，约 30 个对话框。后果：运营在字段红字还在屏幕上时切换语言，字段下面是旧语言、底部提示条是新语言。建议修（不分批）：让 `failureToForm` 和上面几处手写的 `setFields` 把“怎么写这条文字”按表单实例登记，`RevalidateOnLocaleChange` 在语言切换时对仍显示着这条文字的字段用新语言重写；扫描测试再加一条禁止裸 `setFields` 放翻译后的文字。这次没有改，因为它不是“存进页面状态”而是 antd 表单状态，机制不同，范围也比这次的清单大一倍。

## 不是缺陷

- `message.error(describeFailure(intl, error).text)` 这类一次性提示（约 30 处，例如 `src/pages/channels/channels.tsx:47`、`src/pages/avatar/actions.tsx:41`、`src/components/stat/LandBar.tsx:50`）：它是几秒后自己消失的提示，写的就是出错那一刻的语言，没有存进状态，扫描也不列。
- `src/components/ReasonModalForm.tsx:55`、`src/pages/dashboard/*`、`src/pages/companionship/index.tsx:80`、`src/pages/user/login/index.tsx`：已经是存失败、画的时候现算，扫描和读代码都确认过。

## 未运行（1 条）

- `npm run build`：约定留到全部任务做完后跑一次，这次没有跑。

## 检查

- `npx tsc --noEmit`：0 个错误。`npx biome check .`：0 条诊断。提交前钩子（lint-staged 与暂存文件的类型检查）每次都成功，没有绕过。
- 全量测试（`npx vitest run --testTimeout=60000`，所有文件）：440 个文件，7878 条成功，1 条跳过（`scripts/typecheck-staged.test.ts:293` 只在 Windows 上跑的那一条）。这是在全部源码改动之后跑的，提交时的内容与跑测试时一致（提交只是把同一批文件按模块分开）。
- 中英文语言文件没有改动，所以对称性不变（对称检查在全量测试里，成功）。
- 机器环境：Node 是 22.22.0，低于 `package.json` 要求的 `^22.22.1`，装依赖时已有这个警告，测试不受影响。

## 提交

共用部分
- `45e8ea9` 共用钩子、`failureWords`、`failureCode`、共用测试助手
- `bb73660` `PagedListTable` 与 `UploadField`

页面模块（每个提交含该模块的源码改动和它的 `failureLanguage.test.tsx`）
- `bc21e04` clientConfig
- `7a690f8` campaign
- `b026927` activity
- `648835a` ads
- `fa8d814` analytics
- `b9820cd` appVersions
- `f584dad` avatar
- `cffdf7a` channels
- `1f74f31` complaints
- `dc49fc2` config
- `97be78a` cost
- `6495b33` email
- `91ae589` invite
- `4da09da` memory
- `b793217` moderation
- `4def208` monitor
- `bdc1197` credits（同时删除 `credits/localeHost.tsx`，它的可切换语言的测试外壳挪到 `tests/failureLanguage.tsx`）
- `a17197d` notifications
- `a7365dd` push
- `22c6598` sms
- `5150c98` stat
- `0d086b9` subscriptions
- `2c5b379` support
- `83687bc` system
- `1ba07c6` users

扫描
- `69dae7e` 扫描测试

## 浏览器与进程

开发服务器 `npm run dev:mock` 在草稿目录拷贝里启动（端口 8461），用完按监听进程的进程号（4971）停掉，之后端口已无监听；没有用 `pkill`，没有杀过 vitest；Chromium 由脚本自己关。

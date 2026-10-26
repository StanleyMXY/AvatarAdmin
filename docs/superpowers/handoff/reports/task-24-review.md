立即修 1、记录 7、变更 0、不是缺陷 7、阻塞 0

# 任务 24 独立评审：活动管理（签到、每日任务）

评审对象：提交 `83e826d`、`0893189`（分支 `claude/jolly-dirac-4pq9g6`）。评审深度：页面、报表、新增测试，一次独立评审（但按要求对两步探测、确认框、变异做了专项核对）。没有改仓库里的任何源文件、没有提交；所有变异和复现都在 `scratchpad/t24r/app`、`app2`、`app3` 三份 `git archive` 拷贝里做（`node_modules` 软链、`src/.umi` 拷自共享检出）。没有起开发服务器，所以"真实浏览器里确认框的样子"没有亲眼看，是按代码和 Provider 顺序推断的（见记录 4）。

## 一、核对方式

- 逐句对照规格 5.22、契约 §28、任务书与页面实际渲染：列、筛选、说明文字、本地日提示、落地条名、三个导出名、权限按钮、`daily_login` 目标固定为 1、通话时长单位秒、说明 500 码点计数、领取倒计时空的含义、任务记录显示任务名称。没有发现"规格或任务书写了、页面没有"的元素（唯一的例外见立即修 1，那是行为而不是元素）。
- 基线：拷贝里 `npx vitest run src/pages/activity src/services/activity mock/activity.mock.test.ts config/routes/activity.test.ts` 为 11 个文件、239 个测试全部通过；`tests/noHardcodedText.test.ts`、`src/locales` 通过；`npx biome check`（36 个文件）无报错；`npx tsc --noEmit` 在 `activity` 路径下无报错。
- 第三方名称、韩文、调试日志：对两个提交改动的全部文件扫描，没有。中英文键一致由共用的 parity 测试保证（通过）。
- 变异：共跑 57 次（按下面第六节列出），每次只改一处、只跑相关测试文件。

## 二、立即修（1）

### 立即修 1：编辑签到活动时，是否先探测按"列表行里的旧状态"判断；行已过期时，不探测的那一次 PUT 被后端回 `applied:false`，页面却显示"已保存"并关闭弹窗，实际什么都没保存

位置：`src/pages/activity/ActivityFormModal.tsx:143-153`（`row.status === 'ACTIVE' && rangeChanged` 取自列表行；`updateCheckinActivity` 的返回值 `:153` 被丢弃）；`src/services/activity/index.ts` 的 `updateCheckinActivity`（返回 `unknown`，不看 `applied`）。

触发步骤：
1. 管理员 A 打开签到配置，列表里活动 X 是草稿（或已停用）。
2. 管理员 B 把 X 发布（存储状态变成 `ACTIVE`），而 X 的日期范围和另一个进行中的活动 Y 重叠。
3. A（列表没刷新）点 X 的"编辑"，表单读到的详情是新的，把结束日改成更晚的日期，提交。
4. 页面因为 `row.status` 是旧的 `DRAFT`，走"不探测"分支，发一次不带 `confirm` 的 `PUT`。契约 §28.1："编辑一个 ACTIVE 活动的日期范围……范围改后与其他 ACTIVE 活动重叠时不执行，返回 200 `{"applied":false,"disabledActivities":[…]}`"。

错误结果：页面提示"签到活动已保存"、弹窗关闭，但后端没有执行；重叠确认框从头到尾没出现；列表重读后日期还是旧的。两步探测协议被绕过，用户被告知成功。

复现：我在拷贝里用现有的假后端和页面写了一个一次性测试（已删除）：渲染列表，把假后端里活动 5 改成 `ACTIVE`（模拟 B 的操作），然后点编辑、改结束日为 2040-01-01、提交。结果：出现"Check-in activity saved"；只有 1 个 PUT，请求体没有 `confirm`；假后端里该活动的结束日仍是 `2026-12-15`。

修法（两处一起）：① 用刚读到的详情 `detail.status` 判断，不用列表行的 `row.status`；② 不探测的那一次 PUT 也要看响应：`applied === false`（或带 `disabledActivities`）时按重叠处理（弹确认框或至少报失败），不能当成功。带测试：行是旧状态、详情是新状态的用例。现有的 47 个 `signinConfig` 测试在把 `row.status` 换成 `detail.status` 之后全部仍然通过（变异 `edit-status-from-detail-fix-check`），所以这个改动不会破坏现有行为，也说明现有测试没有钉住这一点。

为什么算立即修而不是记录：这是契约里写明的协议（`applied:false` 的含义）被页面忽略，结果是写操作被报告为成功而实际没做；触发条件只要两个管理员在同一页面上交错操作，或者后端对没有 `confirm` 的 PUT 回 `applied:false`（问题文件第三节第 2 条自己就承认没有确认过这一点）。

## 三、记录（7）

1. **测试缺口：活动模块的页面测试全在容器默认时区（UTC）下跑，没有一个用 `tests/withTimeZone.ts`，而执行约定要求时区测试用它。** 我把"选中的日期转成发出的字符串"和"读回日期"各变异成经过 UTC 的写法：`LocalDayRange.tsx` 的 `pickedDay(range[0])`→`toISOString().slice(0,10)`（变异 `range-pickedDay-utc`）、`ActivityFormModal.tsx` 的开始日同样改法（`form-pickedDay-utc`）、`LocalDayLandBar.tsx` 的落地日同样改法（`land-pickedDay-utc`）、`ActivityFormModal.tsx` 的 `dayOf` 解析加 `Z`（`form-dayOf-utc-parse`）：4 个变异全部存活（signinStats、taskStats、signinConfig 全绿）。当前代码本身是对的：我另写一次性测试在 `Pacific/Kiritimati`（UTC+14）、`Etc/GMT+12`、`America/Los_Angeles` 下编辑进行中的活动、不改日期：表单显示 `2026-10-06 / 2026-12-05`（和存储一致），发出的请求体日期不变且没有探测。触发步骤：以后有人把这几处改成经过 UTC 的写法，在 UTC+8 的浏览器里选 10 月 20 日会发出 10 月 19 日，现有测试看不到。位置：`src/pages/activity/signinStats.test.tsx`、`taskStats.test.tsx`、`signinConfig.test.tsx`（缺用例）。这正是本次评审要求核对的"发本地日字符串、不做 UTC 转换"，目前只靠读代码保证。
2. **测试缺口：任务统计的导出范围没有"用上次查询的范围，不是正在编辑的范围"的用例。** 变异 `stats-export-stale-range`（`taskStats.tsx:117` 附近 `params` 的 `applied` 改成 `draft`）存活：`taskStats.test.tsx:225` 的导出用例在没有改过范围的情况下断言范围，草稿和已查询的范围相同。签到统计有这个用例（`signinStats.test.tsx:238`，对应变异红），任务统计没有。触发：以后导出改用草稿范围，用户改了日期但没点查询就导出，文件范围和页面上显示的不一致，测试不报。
3. **测试缺口：奖励阶梯里"添加一天"新增的一行，额外额度默认 0 没有被钉住。** 变异（`ActivityFormModal.tsx:338` 的 `add({ rewardCredits: null, bonusCredits: 0 })` 改成 `bonusCredits: null`）存活，因为只有第一行（新建表单的初始值，`signinConfig.test.tsx:573`）断言了默认 0；提交时的 `?? 0` 也会把 null 补成 0，所以请求体看不出差别，只是输入框会空着并且校验报"请填写不小于 0 的整数"。规格写"额外额度不小于 0、默认 0"。当前代码是对的。
4. **测试缺口：页面测试的 Provider 顺序和真实应用相反，原来的缺陷（确认框内容里用 `useIntl`）在页面测试里测不出来；现在只有一个针对 `OverlapNames` 的单元测试守着。** 真实应用里 `ThemeRoot`（含 `<App>`）在最外层（`src/app.tsx:48`、`src/theme/ThemeRoot.tsx:10`），Umi 的语言上下文在它里面；`tests/renderPage.tsx` 是 `IntlProvider` 在外、`App` 在内。变异：在 `OverlapNames` 里加一行 `useIntl()`（`names-uses-useIntl-hook`）：整个 `signinConfig.test.tsx` 47 个测试全绿，只有 `useOverlapFlow.test.tsx`（变异 `names-uses-useIntl-hook-unit`）变红。结论：**修复本身成立**——`modal.confirm` 的内容 `OverlapNames` 只收字符串属性、不调用任何钩子，标题、按钮文字在调用时用页面的 `intl` 算好；主题来自 `ThemeRoot` 的 `ConfigProvider`（`App` 的 holder 在它里面），所以主题和语言都对；但守卫只覆盖这一个组件。触发：以后有人把确认框内容换成另一个用 `useIntl` 的组件，页面测试全绿，真实应用里一打开确认框整页报 `Could not find required intl object`。位置：`useOverlapFlow.tsx:28-52`、`:73-80`。共用的 `tests/renderPage.tsx` 不归本任务改，需要时由地基任务给一个"App 在语言上下文外面"的渲染辅助。
5. **跨目录导入：`src/pages/activity/signinStats.tsx:13-14`、`taskStats.tsx:12-13` 从 `../stat/guest/` 导入 `useReport`、`ReportState`。** 目前 `stat/guest` 自己的 4 个页签也用这两个文件，所以不会悄悄坏：文件改名或移动时，`tsc` 和这两个页面的测试会立刻编译失败（响亮而不是静默）。但这两个文件是通用的"读一张报表并处理迟到的答案"，位置属于 `src/hooks` 或 `src/components/stat`，让别的模块依赖"游客统计页"的内部文件是错的归属。同意报告里的记录 2，不是现在的错误结果；移动属于地基文件，本任务不能改。
6. **复制了共用组件：`LocalDayRange.tsx`（全文，与 `components/stat/DateRangeUtc.tsx` 逐行相同，只少了"今天""昨天"两个预设）、`LocalDayLandBar.tsx`（与 `components/stat/LandBar.tsx` 相同，少了多名称支持，日期标签换了）。** 触发：以后共用的 `DateRangeUtc`/`LandBar` 改了（超长范围、落地失败的处理），这两个副本不跟着变，两个统计页和别的统计页行为不一致。复制的理由成立（共用组件的文字写 "UTC"，放在"本地日"页面上自相矛盾），做法是对的；根治要给共用组件加一个"本地日"属性（需要改共享文件）。同意报告里的记录 1。
7. **共用文字 `error.TASK_HAS_RECORDS` 只说"不能删除，只能停用"**（`src/locales/zh-CN/error.ts:46`、`en-US/error.ts:47`），而契约错误表里这个码也用于"改有记录的任务的类型或目标值"。本模块编辑时用自己的文字，不受影响；触发：以后别的页面在编辑场景显示这个码，文字只提删除。同意报告里的记录 3；文件不归本任务。

## 四、不是缺陷（7）

1. **"已有记录的配置，类型和目标值只读"只在后端回 409 之后才生效。** 位置 `TaskFormModal.tsx:68`（`hasRecords` 读取）、`:107-117`（409 后锁定并还原）。回答你问的两点：用户在拿到 409 之前**可以**改一个有记录的任务的类型和目标值，并且会发出一次 PUT；但这不会写错数据——后端对有记录的配置改这两项返回 409 `TASK_HAS_RECORDS`（契约 §28.2，假后端和 `taskConfig.test.tsx:574` 都验证），页面把两个字段还原成原值并变成只读、提示换新任务；用户同时改的名称、奖励等保留在表单里，再提交一次就行。没有数据来源（契约和后端回复都没有"有没有记录"的字段，`GET /tasks/records` 也没有按任务筛选），按 CLAUDE.md"契约的缺口不是阻塞"，已写成问题文件第一节并列在报告里；`hasRecords` 的读取是留的口子，当前后端不返回，等价于不存在。
2. **`useOverlapFlow.tsx:91` 的 `if (sent) return;` 是多余的第二道保险。** 变异 `overlap-flow-sent-guard`（去掉它）存活：antd 的 `modal.confirm` 在 `onOk` 返回 Promise 时自带加载态并忽略再次点击，`signinConfig.test.tsx` "a second press on Confirm sends one request" 仍由它保证。等价变异。
3. **`TaskFormModal.tsx:103` 里发送时再把登录类型的目标值强制成 1 是多余的第二道保险。** 变异 `login-target-not-fixed` 存活：`onValuesChange`（`:134` 附近）已经在类型切到登录时把输入框改成 1 并禁用；把这一层去掉（变异 `login-target-ui-not-forced`）则变红。表单里没有任何路径能让登录类型带着不是 1 的值提交。
4. **"统计数字不为负数"：页面没有任何计算会产生负数，后端的计数不会是负数。** `texts.ts` 的 `countText` 对数字原样显示、对非数字显示 "—"（变异 `count-null-zero` 变红，说明 "—" 被钉住）；`signinRecord.tsx:28` 的 `Math.max(0, reward + bonus)` 没有测试钉住（变异 `negative-count-shown` 存活），但两个加数来自后端的非负整数，等价变异。把后端万一发来的负数改成 0 反而会掩盖后端错误，不应加。
5. **统计页默认范围和预设以 UTC 今天为终点（`StatsBar.tsx:13`、`LocalDayRange.tsx:55-56` 的 `lastNDaysUtc`）。** 日期本身是用户本地日，UTC+14 的本地日可以比 UTC 今天晚一天，"最近 7 天"看不到那一天；已写成问题文件第五节第 1 条（报表的 `to`、落地的 `date` 最晚到哪天，请后端说明），页面发出的始终是选中的日历日原样（变异 `range-utc-instant` 变红，说明没有被转成时刻）。
6. **领取倒计时输入框 `InputNumber min={1}`（`TaskFormModal.tsx:263`）把键入的 0 收回 1。** 契约对 `claimTimeoutSeconds` 的下限没有写，问题文件第四节第 1 条已向后端提问；页面选了最小做法，并由 `taskConfig.test.tsx:453` 钉住。`rewardCredits`、`targetValue` 的下限收回同理，是 antd 标准行为，提交值总是合法。
7. **签到统计的导出跟着页签（`signinStats.tsx:105`）。** 规格只写"导出 Excel"，契约有两个导出名、任务书两个都要求；做法写进了报告和问题文件，变异 `export-always-daily` 变红。如果负责人想要别的布局（两个按钮、一个按钮出两张表）才是变更。

## 五、专项核对结果

**两步探测（发布、启用、编辑进行中活动的日期范围）。** 三条路径都做了变异：`probe-publish-skipped`（发布不探测，直接 `confirm=true`）红 5；`probe-enable-skipped` 红 1；`probe-update-skipped` 红 3。取消不发第二次：`cancel-sends-second` 红 3。确认后发 `confirm=true`：`confirm-sends-false` 红 4（含服务测试）。确认框列出被停用的活动名：`overlap-names-not-listed` 红 4。草稿以外无删除：`delete-for-all` 红 7。无重叠直接成功、有重叠才问：由 `range-changed-always`（总是探测，红 1）、`range-changed-never`（从不探测，红 3）钉住。例外就是立即修 1：判断"进行中"用的是行里的旧状态。

**奖励阶梯。** 至少一行（`last-ladder-row-removable` 红 1，只剩一行时没有删除按钮）；"第 N 天"按行序号（`dayNum-zero-based` 红 8）；整数且不小于 0、必填；额外额度默认 0（第一行钉住，新增的行没钉住，见记录 3）。`InputNumber` 的 `min` 和 `precision` 使负数和小数在页面上打不出来，校验只管空值，后端仍会对负数返回 400（假后端测试有）。

**确认框的渲染环境。** 见记录 4：真实应用里 `App` 在语言上下文外面，修复（内容组件无钩子、字符串在调用处算好）成立。

**`TASK_HAS_RECORDS`。** 删除时显示"改用停用"的文字、行保留（`delete-task-error-swallowed` 红 1）；编辑时 409 之后锁定（`records-lock-ignored` 红 2）；只靠 409 才锁见不是缺陷 1。

**防重复提交。** 活动表单（把 `useSingleFlight` 换成直通：红 2）、任务表单（红 1）、行内操作（`RowActions` 的 `runOnce`，发布在"更多"菜单里也由它拦住）、落地条（`LocalDayLandBar` 有 `useSingleFlight`，测试钉住）都有。注意：我第一次写的"任务表单不防重复"变异本身写错了（没有真的去掉保护），存活是我的变异的问题，不是页面的；换成直通写法后变红。

**迟到的响应。** `ActivityViewModal`、`ActivityFormModal` 的 `counter` 和 `useReport` 的 `counter` 都只接受最新一次（`view-stale-accepted` 红 1；统计页有"早的答案不覆盖晚的"两个用例）。

**非字符串值作为 React 子元素。** 所有后端来的文字经 `plainText`；`name-as-react-child`（去掉 `plainText` 直接渲染）红 1。

**统计数字与空值。** 空值、非数字显示 "—"（`count-null-zero` 红 2，`rate-null-zero` 红 2）；完成率固定一位小数（`rate-two-decimals` 红 1）；见不是缺陷 4 关于负数。

**本地日与 UTC。** 页面注明"日期是用户的本地日，不是 UTC 日"（`local-notice-removed` 红 2）；任务统计另注明领奖在第二天的也计入所属日（`stats-notice-task-note-removed` 红 1）；请求里的 `from`/`to` 是选中的日历日字符串（`range-utc-instant` 红 1）；落地条 `checkin-daily`/`task-daily`（`land-name-wrong`、`task-land-name` 各红 1，`land-without-permission` 红 1）；三个导出名（`export-always-daily`、`task-export-name` 各红 1）。没有 UTC 转换，但没有非 UTC 时区的测试（记录 1）。

**长文字和多语言布局。** 名称、说明、账号 ID、确认框里的活动名都经 `EllipsisPopoverText`/`CopyableId` 或 `overflow-wrap: anywhere`，300 字符无空格串、泰语、阿拉伯语、emoji 有断言；`dir="auto"` 在名称输入框、确认框列表项上。5000 字符与 300 字符走同一条代码路径，没有另外发现不同的路径。

**文字与键。** 中英文键相同（共用 parity 测试通过）；`src` 下没有写死文字（`tests/noHardcodedText.test.ts` 通过）；没有第三方名称、韩文、调试日志。

**权限按钮。** 没有 `CHECKIN:MANAGE`/`TASK:MANAGE` 时无新建、无编辑（`signin-manage-always` 红 1、`task-manage-always` 红 1）。只读用户在任务配置页仍有一个空的"操作"列（`taskConfig.tsx:216`，内容为 `null`），不影响行为。

**按钮、筛选、确认问题。** 行内确认：停用签到活动、删除草稿、启用/停用/删除任务各一个变异，全部红（`disable-signin-no-confirm`、`delete-signin-no-confirm`、`enable-no-confirm-task`、`delete-task-no-confirm`）。任务记录显示名称不是 ID（`task-record-id` 红 5）；记录页缺名称显示 "—" 和 ID（`record-name-null-not-dash` 红 1）；进度含目标值（`task-progress-no-target` 红 1）；筛选参数（`records-filter-account-dropped`、`taskcfg-filter-type-dropped` 各红 1）；说明计数按码点（`desc-utf16-count` 红 1、`desc-limit-501` 红 4）；通话时长的单位旁注（`seconds-note-removed` 红 1）；领取倒计时说明（`claim-help-removed` 红 1）。

**页面测试和页面同时写、没有红的那一步，测试是否钉得住行为。** 钉得住。针对这五个页面（任务配置、签到记录、任务记录、签到统计、任务统计）的变异共 33 个，其中存活 6 个：2 个是时区测试缺口（`range-pickedDay-utc`、`land-pickedDay-utc`，记录 1）、1 个是任务统计导出范围缺口（记录 2）、2 个是等价变异（不是缺陷 3、4）、1 个是我自己写错的无效变异（见上）；没有一个存活是"页面行为被去掉而测试不知道"的真缺陷（其余 27 个全红）。实现者事后"把页面文件挪走重跑"得到的"红"只证明测试依赖页面文件存在，不是"因为行为不对而红"；真正的证明是上面的变异。这个出入报告里如实写了，不另算缺陷。

## 六、变异清单（我跑的 57 次；"红"= 相关测试变红，"存活"= 全绿）

探测与确认：probe-publish-skipped 红；probe-enable-skipped 红；probe-update-skipped 红；cancel-sends-second 红；confirm-sends-false 红；overlap-names-not-listed 红；overlap-flow-sent-guard 存活（等价）；range-changed-always 红；range-changed-never 红；edit-status-from-detail-fix-check 存活（说明修法兼容，见立即修 1）。

签到表单与列表：delete-for-all 红；last-ladder-row-removable 红；dayNum-zero-based 红；bonus-default-null 存活（记录 3）；singleflight-activity-form-removed 红；view-stale-accepted 红；name-as-react-child 红；signin-manage-always 红；disable-signin-no-confirm 红；delete-signin-no-confirm 红；names-uses-useIntl-hook 存活、names-uses-useIntl-hook-unit 红（记录 4）。

任务：login-target-not-fixed 存活（等价）；login-target-ui-not-forced 红；desc-utf16-count 红；desc-limit-501 红；seconds-note-removed 红；claim-help-removed 红；task-manage-always 红；task-form-no-singleflight 存活（我的变异写错，无效）；singleflight-task-form-removed 红；records-lock-ignored 红；delete-task-error-swallowed 红；enable-no-confirm-task 红；delete-task-no-confirm 红；taskcfg-filter-type-dropped 红。

记录页与统计页：task-record-id 红；record-name-null-not-dash 红；task-progress-no-target 红；records-filter-account-dropped 红；negative-count-shown 存活（等价）；count-null-zero 红；rate-null-zero 红；rate-two-decimals 红；local-notice-removed 红；stats-notice-task-note-removed 红；land-name-wrong 红；task-land-name 红；land-without-permission 红；export-always-daily 红；task-export-name 红；stats-export-stale-range 存活（记录 2）；range-utc-instant 红。

时区：range-pickedDay-utc、form-pickedDay-utc、land-pickedDay-utc、form-dayOf-utc-parse 全部存活（记录 1）。

## 七、其他

- 契约问题文件 `docs/contract-requests/2026-10-26-admin-frontend-activity.md` 覆盖了本次发现的契约缺口（`hasRecords`、四个列表的分页和筛选、写接口请求体和 `confirm` 处理、任务类型来源、日期上限）；唯一没有写但应该补一句的是：不带 `confirm` 的 `PUT` 在范围会造成重叠时后端是否也回 `applied:false`（立即修 1 的第二个触发条件，问题文件第三节第 2 条只问了"没有重叠时是否直接执行"）。
- 本评审没有改动任何源文件，只写了这份文件。

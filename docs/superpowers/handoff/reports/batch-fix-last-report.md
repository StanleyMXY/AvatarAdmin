立即修未修 0、记录项 1、未运行 2、阻塞 0

# 最后一批记录项：五件事的结果

分支 `claude/jolly-dirac-4pq9g6`。开始时工作区干净。五件事各一个提交，都没有推送。

| 事项 | 状态 | 提交 |
|---|---|---|
| 1 实心红色按钮白字对比度不到 4.5:1 | 已修 | `1932f02` |
| 2 管理员、角色、权限三页的操作列改用共用定义 | 已修 | `3cdd957` |
| 3 等待时间默认值放进 `tests/setup.ts` | 已修 | `fb3b1fa` |
| 4 推送与站内通知的链接摘要并成一个函数 | 已修 | `4733285` |
| 5 页面里各自写的“只留最新一次读取”计数器 | 已修（全部换掉，没有需要保留的） | `785a758` |

## 1 实心红色按钮（`1932f02`）

- 现象：antd 的实心红色按钮（“离开”确认、删除确认）白字对红底，浅色 3.27:1，暗蓝和深青 4.24:1；悬停时 antd 把红色调亮，更差：浅色 2.56:1、暗蓝和深青 3.06:1。按下态 4.6 到 6.1，本来就够。
- 做法：`src/theme/modes.ts` 新增 `getErrorSolidColors(mode)`：静止色 = antd 的错误红朝黑色移动到白字刚好 4.5:1（沿用 `contrast.ts` 的 `readableText`）；悬停、按下继续朝黑色移（用链接已有的 0.18、0.32 两个幅度），所以三态都够且肉眼分得出。`applyModeToDocument` 把三个颜色放到 `--avatar-error-solid`、`-hover`、`-active`；`src/global.css` 用 `html[data-theme] .ant-btn-color-dangerous.ant-btn-variant-solid:not(:disabled):not(.ant-btn-disabled)` 及 `:hover`、`:active` 套上（禁用的按钮不动）。
- 先红后绿：`src/theme/modes.test.ts` 新增每种主题 4 条（三态对白字 >= 4.5；仍是红色且悬停比静止暗、按下比悬停暗；静止色是“朝黑色的第一档够的颜色”；三个变量写到文档上）加样式表 1 条。写实现前 13 条红（函数不存在）。
- 变异检查：6 个变异全部被抓住（去掉静止色的调整、悬停不变暗、按下反向变亮、不写悬停变量、悬停规则用成静止变量、样式选择器去掉 `:not(:disabled)`）。
- 真实浏览器（Playwright Chromium，草稿目录拷贝里 `dev:mock`，用 `getComputedStyle` 量，真实悬停和按下）：
  - 修前：浅色静止 3.27、悬停 2.56、按下 4.62；暗蓝和深青静止 4.24、悬停 3.06、按下 6.13。
  - 修后（“离开”确认对话框，在 `/moderation/rules`）：浅色 4.55 / 6.28 / 8.13；暗蓝和深青 4.56 / 6.29 / 8.18。
  - 删除确认（`/sms/templates` 行上的“删除”弹出的确认，同一类按钮）三种主题的三态数字与上面一致。
- 静止态余量很薄（4.55、4.56 对 4.5），因为取的就是“刚好够的第一档”，与项目里其他颜色的做法一致。

## 2 操作列（`3cdd957`）

- 先清空 `src/components/actionsColumn.test.tsx` 里的 `LATER` 例外：测试红，列出 `admins.tsx:223`、`permissions.tsx:126`、`roles.tsx:86`。
- 三页的操作列改成 `...ACTIONS_COLUMN`（管理员、角色原来手写 `fixed: 'right'`，现在也来自共用定义）。权限页新增一条测试读渲染结果：表头和每行最后一格带 `ant-table-cell-fix-end`，第一格不带；暂时还原权限页的改动时这条红，改回后绿。
- 真实浏览器：权限页修前在 800 宽度下“操作”表头右边缘比表格容器右边缘多出 256 像素（`position: relative`，要横向滚动才看得到）；修后 1440 与 800 宽度三页都是 `position: sticky`、差 0。
- 测试：`src/pages/system`（13 个文件，527 条）和 `actionsColumn.test.tsx` 全绿。

## 3 等待时间默认值（`fb3b1fa`）

- `tests/setup.ts` 由 `vitest.config.ts` 的 `setupFiles` 加载，所以对所有测试生效。别的模块原来是库默认的 1 秒，现在也是 8 秒：8000 是七处里最大也是唯一的值，注释里写明了。用的是 `@testing-library/dom` 的 `configure`（和 `@testing-library/react` 共用同一份配置，只有一份拷贝；不在 setup 里引入 react 库，免得给不用 React 的测试加自动清理）。
- 先红后绿：新增 `tests/setup.test.ts`：默认值是 8000（修前得 1000），模块的 `testSetup.ts` 里不再有 `asyncUtilTimeout`（修前列出七个文件）。
- 删掉七个模块里的重复（avatar、credits、users、memory、monitor、support、subscriptions）。`subscriptions/testSetup.ts` 删掉后只剩副作用导入，所以文件删除，八个测试文件里的 `import './testSetup'` 一并去掉。
- 这样改会影响别的测试，查到并处理了两处：
  1. `tests/pageHelpers.test.tsx` 里“有对话框时 `dialogsClosed()` 应当报错”的用例依赖库默认 1 秒才超时；默认 8 秒后这条用例要等 8 秒，撞上单条测试的 5 秒上限，改默认后实测红（`Test timed out in 5000ms`）。做法：`dialogsClosed` 新增可选 `{ timeout }`，这条用例传 300。其余测试里没有用“等超时”来断言的（查过 `.rejects`、`catch` 与 `findBy`、`waitFor` 的组合）。
  2. `src/pages/sms/templates.test.tsx`、`src/pages/push/templates.test.tsx` 各自把等待改成 6 秒、结束后复原成 1 秒：新默认下会把后面的用例降到 1 秒，删掉。
- 取舍要知道：一个等待落空的测试现在要 8 秒才报错；单条测试超时仍是 5 秒（没设更长的文件）时，报出的会是“测试超时”而不是 `waitFor` 的具体断言。页面测试几乎都设了 30 秒以上。
- 前后同一批测试（用户、头像、额度、记忆、监控、客服、订阅、短信、推送、站内通知、`src/utils`、`tests`）：改前（`HEAD` 拷贝）74 个文件 1223 条全绿（`tests/noHardcodedText.test.ts` 在无 `.git` 的拷贝里跑不了，不是代码问题）；改后 97 个文件 1659 条全绿（多出的是通知、工具和新增的测试）。

## 4 链接摘要（`4733285`）

- 共用函数 `describeLink(intl, linkType, linkTarget, { summaryId, empty, writeOut? })` 放进 `src/utils/displayText.ts`。差别用参数表达：推送 `{ summaryId: 'push.link.summary', empty: '' }`；站内通知 `{ summaryId: 'notifications.link.summary', empty: DASH, writeOut: true }`（链接类型不是文字时，通知把它写出来，推送当作空）。语言文件里两个键各保留。
- 整理类：先写新测试 `src/utils/describeLink.test.ts` 钉住两个旧函数的行为（22 条，旧代码上全绿），再整理，同一批测试全绿；然后把两个摘要文字在测试里改成不同的连接符，使“用错键”也能被看见。变异：去掉 `writeOut`、空类型写成 `''`、`NONE` 不特殊处理、固定用推送的键，4 个全部被抓住（第 4 个先存活，改了测试后被抓住）。
- 两处旧函数删除（`src/pages/push/texts.ts` 整个文件只剩它，一并删除）。推送页和通知抽屉的页面测试（`src/pages/push`、`src/pages/notifications`）全绿。

## 5 “只留最新一次读取”计数器（`785a758`）

逐个读过 29 个文件里的计数器。结论：除一个以外全部换成共用钩子，行为相同，唯一的不同写在后面。

换成 `useLatestCall` 的 28 处（卸载后不更新、失败也只认最新，两条钩子都满足：卸载时计数加一，成功和失败的收尾都用 `isCurrent()` 判断）：
`clientConfig/useItems.ts`、`campaign/stats.tsx`、`campaign/useCampaigns.ts`、`campaign/CampaignModal.tsx`、`campaign/LinkModal.tsx`、`activity/ActivityViewModal.tsx`、`activity/ActivityFormModal.tsx`、`moderation/detail.tsx`、`moderation/stats.tsx`、`moderation/ContentPanel.tsx`、`moderation/queue.tsx`、`stat/daily.tsx`、`stat/retention.tsx`、`push/stats.tsx`、`push/records.tsx`（两处）、`push/templates.tsx`、`complaints/ComplaintDrawer.tsx`、`complaints/EvidenceViewer.tsx`、`credits/stats.tsx`、`credits/AccountCreditsPanel.tsx`、`dashboard/useSource.ts`、`subscriptions/stats.tsx`、`invite/FissionTab.tsx`、`analytics/funnel.tsx`、`cost/prices.tsx`、`ads/useOptions.ts`、`ads/AdsWarnings.tsx`，另有共用的 `components/PagedListTable.tsx`（不是页面文件，写法相同，一并换）。

- “关闭或换条目时作废还在路上的读取”（原来是 `counter.current += 1`）：在 effect 清理里或关闭分支里直接调用 `begin()`，不用它的返回值；有注释（`ContentPanel`、`AdsWarnings`），其余在原位置。
- `campaign/LinkModal.tsx`：原来的计数器数的不是读取，是“字段改动次数”，请求发出后字段改了就丢弃答案。换成钩子后改字段时调 `begin()`、发请求时 `isCurrent = begin()`，丢弃条件一样（请求防重复由 `useSingleFlight` 保证，不会有两个请求同时在路上）。
- 原来没有“卸载时作废”的那些（如 `campaign/stats.tsx`、`stat/daily.tsx`），换后卸载后的答案也被丢；它们的分支里只有 `setState`，卸载后本来就是空操作，所以看得见的行为不变。
- `sessions/useStatRead.ts` 是 `useLatestRead` 的一份缩水拷贝（返回 `data`、`failure`、`reload`）：先把它的 5 条测试改成对 `useLatestRead` 跑，全绿；然后三个页面（`analytics`、`SessionDrawer`、`quality`）直接用 `useLatestRead`，删除 `useStatRead.ts` 和它的测试（同样的语义在 `useLatestRead.test.tsx` 里都有）。**这是唯一一处看得见的行为差别**：这三个页面的失败提示原来在失败那一刻写成字符串，现在和 `useLatestRead` 一样按当前语言画，切换语言后跟着变（项目规则要求的做法）。
- 没有换成 `useLatestRead` 的页面（改用 `useLatestCall`）原因：它们的请求函数依赖 `intl`（语言一变就重新读，`useLatestRead` 的请求函数不依赖语言），或者状态不是“数据空再填、失败清数据”（保留旧行、有单独的加载标记、一次发两个请求、成功后才写另一个状态等）。硬换会改变请求次数或页面状态。
- 不是这种计数器、保留不动：`invite/stats.tsx` 的 `nonce`（给图表一个新身份以强制重新读取，不是用来丢旧答案）。`cost/ManualTab.tsx:73`、`cost/AlertsLine.tsx:25`、`cost/report.tsx:99` 用 `let alive` 布尔值，只管卸载，不是“最新一次”，不是缺陷，没改。
- 先红后绿的替代：整理类，同一批测试前后对比：改前（`HEAD` 拷贝）16 个目录 166 个文件，2813 条成功、1 条失败（`sessions/list.test.tsx` 的“5000 字符”用例，负载高时的等待超时，同批里别的都过；另一个失败文件是 `revalidateCoverage.test.ts`，拷贝里没有 `.git`）；改后在工作区同一批 166 个文件 2814 条全部成功，两个文件都是绿的。另新增 `src/hooks/ownCounters.test.ts`：扫描 `src` 里不允许再出现 `const mine = ++x.current` 或 `mine === x.current`（修前列出 30 个文件，修后为空；钩子自己除外）。

## 新发现

- 记录项 1：**页面里把失败原因按“当时的语言”写成字符串存下来，切换语言后提示还是旧语言。** 触发：以英文打开 `/credits/stats`，让 `GET /credits/stats` 返回 500，提示条是“Failed to load: Server error. Please try again later.”，把界面切到简体中文，外壳变成“加载失败：”，后半句仍是英文 “Server error. Please try again later.”（我用一条临时测试量过，已删除，没有进仓库）。位置：约 41 处 `setXxx(describeFailure(intl, error).text)`，如 `src/pages/credits/stats.tsx:45`、`src/pages/stat/daily.tsx:86`、`src/pages/stat/retention.tsx:84`、`src/pages/moderation/stats.tsx:39`、`src/pages/push/stats.tsx:73`、`src/pages/push/records.tsx`、`src/pages/subscriptions/stats.tsx:90`、`src/pages/campaign/stats.tsx` 等共约 63 个文件含 `describeFailure(...).text`。共用的 `useLatestRead` 和 `PagedListTable` 已经是“存错误、画的时候再取文字”，这些页面还没有。后果：运营在出错提示还在屏幕上时切换语言，看到半中半英的提示。建议全部修：改成保存错误本身、画的时候取文字（或换成 `useLatestRead`），每页一条“切换语言后提示跟着变”的测试。这次没有改，因为 5 件事里没有它，且要改的页面很多。

## 检查

- `npx tsc --noEmit`：0 个错误。`npx biome check .`：0 条诊断。提交前钩子每次都通过，没有绕过。
- 各提交前跑的测试（`--testTimeout=60000`）：`src/theme`（5 个文件 244 条）；`src/pages/system` 加 `actionsColumn.test.tsx`（13 个文件 527 条）；第 3、4 件的批次 97 个文件 1659 条；第 5 件的批次 166 个文件 2814 条，全部成功。
- 机器环境：Node 是 22.22.0，低于 `package.json` 要求的 `^22.22.1`，安装时已有这个警告，测试不受影响。

## 未运行

1. 全量测试：约定留到全部任务做完后跑一次。第 3 件改了所有测试的默认等待，所以这次最需要全量跑一遍；我只跑了与五件事有关的目录（见上）。
2. `npm run build`：同上，没有跑。

## 浏览器与进程

开发服务器 `npm run dev:mock` 在草稿目录拷贝里启动（端口 8431），用完按监听进程的进程号（11352）停掉，之后端口已无监听，npm 父进程也已退出；没有用 `kill -f`/`pkill`，没有杀过 vitest；Chromium 由脚本自己关。

立即修未修 0、记录项 3、未运行 0、阻塞 0

# 把各模块里重复的小件并入共用件

## 做了什么

先加共用件（提交 `5bdf1ea`），再逐个模块把引用改过去，删掉模块里的副本文件和它们专属的测试；每个模块一个提交，钩子（lint-staged 和暂存文件的类型检查）都通过，没有 `--no-verify`，没有推送。每个模块合并后跑了该模块的测试（`--testTimeout=60000`）。

共用件新增或扩展（都带测试，并做了变异检查，存活的变异只有等价变异，见下）：

- `src/utils/failureToForm.ts`：返回值多了 `unplaced`（没有字段接住的原因文字）和 `code`；选项 `{ generalReason: true }` 表示"语言文件不认识的原因写成『输入无效』"。
- `src/utils/displayText.ts`：新增 `adminText`；`codeText` 加选项 `{ writeOut: true }`（不是文字的代码写成文字）。
- `src/hooks/useUploadSlot.ts`（新）。
- `src/hooks/useLatestRead.ts`：多返回 `error`，加选项 `refreshKey`；`useLatestRead` 和 `useServerPage` 改为用 `useLatestCall` 判断"是不是最新一次"，不再各写一个计数器（这就是 `useLatestCall` 与 `useLatestRead` 同类写法的合并）。
- `src/hooks/useServerPage.ts`：加选项 `{ backToLastPage: true }`；`src/components/PagedTable.tsx`：加 `toolbar`，`rowKey` 可以是字段名，`emptyText` 可省。
- `tests/pageHelpers.ts`、`tests/signInAsAdmin.ts`（新，各模块 `testSetup.ts` 原来各抄一份的测试助手），各有测试。

## 副本到共用件对照

| 副本 | 合并到 | 提交 | 行为差别 |
|---|---|---|---|
| `avatar/EnabledSwitch.tsx`、`push/EnabledSwitch.tsx` | `src/components/EnabledSwitch.tsx`（已有） | `09c0421`、`e189c4d` | 无（三份逐行相同，只差一个可选的 `failureText`，共用件本来就有） |
| `sms/StatusSwitch.tsx` | 同上（组件改名 `EnabledSwitch`） | `902aedc` | 无 |
| `ads/placements.tsx` 里的 `EnabledSwitch` | 同上，用 `onToggle={updatePlacement…}` | `cd2b84f` | 无（标签、已选状态、失败文字、完成后重读都一样） |
| `avatar/formFailure.ts`、`push/formFailure.ts`、`ads/formFailure.ts`、`activity/formFailure.ts` | `src/utils/failureToForm.ts` | `09c0421`、`e189c4d`、`6a69b80`、`e1ed083` | 返回值是各份的并集（多出来的字段调用方不读）；push 的别名（`linkTarget`→`link`）原来就是共用件的参数 |
| `sms/formFailure.ts`、`email/formFailure.ts` | 同上，调用处传 `{ generalReason: true }` | `902aedc`、`796bd94` | 保留差别：语言文件不认识的原因仍写"输入无效"，不显示原因码或后端的话（用选项表达） |
| `system/formFailure.ts` | 同上，传 `{ generalReason: true }`；文件缩成只剩"409 重复放到 `data.field` 指的字段下面、此时没有条形条文字" | `7844ceb` | 保留差别：这条是系统页独有的行为，留在薄包装里，并新加 `formFailure.test.tsx`（变异检查全部变红） |
| `ads/texts.ts`、`email/texts.ts`、`sms/texts.ts`、`appVersions/texts.ts` | `src/utils/displayText.ts`（`codeText`、`instantText`、`countText`、`orDash`、`adminText`、`Translator`），四个文件删除 | `6a69b80`、`796bd94`、`902aedc`、`0bf8b19` | 无；通道包页（`channels/`）原来从应用版本的 `texts.ts` 取这两个函数，一并改过去 |
| `avatar/texts.ts` 的 `codeText` | 同上（文件里只留 `describeSurfaces`） | `09c0421` | 无（对字符串，两份结果相同） |
| `push/texts.ts` 的 `codeText`、`instantText`、`countText` | 同上（文件里只留 `describeLink`） | `e189c4d` | 无 |
| `activity/texts.ts` 的 `codeText`、`instantText`、`countText`、`plainOrDash` | 同上（`plainOrDash`→`orDash`；文件里只留 `lifecycleOptions`） | `e1ed083` | 保留差别：活动页的 `codeText` 把不是文字的代码写成文字，调用处传 `{ writeOut: true }`。原来用 `Object.hasOwn` 查语言文件，共用件用"有值"判断：id 带前缀、语言文件里没有空字符串的文本，所以没有可观察的差别 |
| `notifications/texts.ts` 的 `codeText`、`instantText`、`orDash`、`adminText`；`clientConfig/texts.ts` 对它们的转出 | 同上 | `1e94895` | 保留差别：这两个目录的 `codeText` 也把不是文字的代码写成文字，传 `{ writeOut: true }` |
| `system/texts.ts` 的 `instantText`、`orDash`、`adminLabel` | 同上（`adminLabel`→`adminText`，逻辑相同） | `7844ceb` | 无 |
| `ads/uploadSlot.ts`、`appVersions/uploadSlot.ts` | `src/hooks/useUploadSlot.ts` | `6a69b80`、`0bf8b19` | 无（共用件就是这份） |
| `avatar/uploadSlot.ts`、`push/uploadSlot.ts` | 同上 | `09c0421`、`e189c4d` | 共用件多保存整条上传记录（`upload`），avatar 的还多一个 `version`（重置时变化）；这两个目录不读它们，没有可见差别 |
| `ads/useRead.ts` | `src/hooks/useLatestRead.ts`，调用处传 `{ keepWhileReading: true }` | `6a69b80` | 离开页面后，在途的读取结果被丢弃（原来没有这一步，原来也不会有可见后果） |
| `analytics/useRead.ts` | 同上 | `8951006` | 同上 |
| `users/useRead.ts` + `users/useRead.test.tsx` | 同上，`keep`→`keepWhileReading`；`error` 现在由共用钩子给 | `514b7ab` | 原来的 `keep` 是个 ref，改它不会重读；共用的 `keepWhileReading` 在依赖里，改它会重读。四个调用处传的都是常量，没有差别。原测试的五个用例（读一次、新的盖旧的、旧的失败被丢弃、错误对象加文字、保留旧行）都已在共用钩子的测试里（新加了 `error` 和 `refreshKey` 的用例） |
| `stat/guest/useReport.ts` | 同上，`refreshKey` 选项 | `23f7639` | 无（另有离开页面丢弃在途结果，同上） |
| `system/useRead.ts` + `system/useRead.test.tsx` | 同上；调用处按 `loading`、`failure`、`error`、`data` 改写 | `7844ceb` | 失败文字仍在渲染时用 `error` 现算（切换语言会跟着变）；原来的 `key` 参数只有分页表用，分页表见下 |
| `analytics/ReadState.tsx`、`stat/guest/ReportState.tsx` | `src/components/ReadState.tsx`（已有） | `8951006`、`23f7639` | 无（三份逐行相同） |
| `campaign/FailureBar.tsx` | `src/components/FailureBar.tsx` | `7629db4` | 无 |
| `campaign/useServerPage.ts`、`campaign/PagedTable.tsx` | `src/hooks/useServerPage.ts`、`src/components/PagedTable.tsx` | `7629db4` | 无（共用的多一个 `onRow`、`toolbar`，不传就一样）。`src/pages/pagedTables.test.tsx` 不再画已删除的那份 |
| `system/PagedTable.tsx`（自己读自己分页） | 缩成 `useServerPage(load, {}, { backToLastPage: true })` + 共用 `PagedTable` 的薄组件（保留 `reloadRef`、`toolbar` 这两个系统页的用法） | `7844ceb` | 三处小差别：（1）失败条文字在失败那一刻定下，之后切换语言不会变，重试后才变（原来渲染时现算）；（2）删除最后一页的最后一行后，到最后一页的读取期间表一直是"加载中"，没有"无数据"闪一下；（3）外层从 `div`+外边距变成纵向 `Flex`（间距 12，视觉相同） |
| 各目录 `testSetup.ts` 里的 `signIn` 主体（19 份） | `tests/signInAsAdmin.ts` | 对应各模块的提交 | 无；各模块自己的"先重置哪些数据"和默认 `meta` 仍留在自己的 `signIn` 里。`cost` 的 `signIn`（用 `holds`、没有 `support` 预设时的特殊处理）和 `holds` 不同，保留 |
| `chooseOption`（12 份）、`dialogsClosed`（12 份）、`writesOf`（10 份）、`holdWrites`（7 份）、`overrideFetch`（5 份）、`jsonAnswer`（5 份）、`settled`（4 份）、`uploads` + `uploadModule`（4 份）、`stubObjectUrls`（2 份）、`expandSearch`（5 份中 4 份）、`withExportSheet`（2 份）、`sheetAnswer`（3 份） | `tests/pageHelpers.ts`，各 `testSetup.ts` 转出，测试文件的引用不变 | 对应各模块的提交（`09c0421`、`e189c4d`、`902aedc`、`e1ed083`、`6a69b80`、`0bf8b19`、`1e94895`、`7844ceb`、`514b7ab`、`8951006`、`7629db4`、`24ce395`、`5e86f56`、`8795308`、`42b0194`、`363bbfc`、`756b268`、`1c87c62`） | `chooseOption` 取并集（`string \| RegExp`、可带 `within`）；`writesOf` 有两种：`avatar`、`push` 不算上传（`writesExceptUploads`），其余算全部非 GET，各自保持；`holdWrites` 取 `activity` 带 `only` 的那份（不传就是全部写请求）；`sheetAnswer` 的默认文件名各模块不同（`sms-records`、`attribution-performance`），所以 `sms`、`ads`、`campaign` 各留一行带默认名的包装；`credits` 的 `expandSearch`（表单已展开时不点）和别的不同，保留 |
| `src/pages/push/UploadBox.tsx`、`src/pages/ads/UploadBox.tsx` | `UploadField` | 开始前已经删了（`0e88fb2`、`35f50ea`） | 本次开工时这两个文件已不存在，没有动作 |
| `useLatestCall` 与 `useLatestRead`、`useServerPage` 的计数器 | `useLatestRead`、`useServerPage` 改用 `useLatestCall` | `4e45a04` | `useServerPage` 离开页面后丢弃在途结果（原来没有，没有可见后果） |

## 没有并入的（各有原因）

- 不是缺陷（行为不同，并入要改行为）：`channels/channels.tsx` 的开关（关闭前要先问、成功有提示）；`subscriptions/products.tsx` 的开关（只有成功才通知页面、失败文字走自己的函数）；`push/texts.ts` 与 `notifications/texts.ts` 的 `describeLink`（摘要文字的键不同、无类型时一个返回空、一个返回破折号）；`notifications` 的 `reasonText` 与 `clientConfig` 的 `problemText`（后者多查本页自己的原因文字）；`avatar` 的 `describeSurfaces`、`system` 的 `withScopeHint`、`protectedFailureText`、`activity` 的 `lifecycleOptions`（各页独有）。
- 记录（最后三条，建议全部修）：
  1. 约 24 个页面文件里还有自己写的"只留最新一次读取"计数器（`src/pages/subscriptions/*.tsx`、`moderation/*`、`push/stats.tsx`、`push/records.tsx`、`push/templates.tsx`、`campaign/stats.tsx`、`campaign/useCampaigns.ts`、`credits/*`、`stat/daily.tsx`、`stat/retention.tsx`、`sessions/useStatRead.ts`、`invite/FissionTab.tsx`、`analytics/funnel.tsx`、`ads/useOptions.ts`、`ads/AdsWarnings.tsx`、`clientConfig/useItems.ts` 等，用 `grep -rn "counter.current\|latest.current" src/pages` 可列出）。后果：以后"只留最新一次"的规则要改时这些不会跟着变，现在没有错误输出。它们不是上面列的重复小件（形状各不相同），改成 `useLatestCall` 或 `useLatestRead` 要逐个看，所以没有在这次动。
  2. `configure({ asyncUtilTimeout: 8000 })` 在 `avatar`、`credits`、`users`、`memory`、`monitor`、`support`、`subscriptions` 的 `testSetup.ts` 里各写一遍，应当放进 `tests/setup.ts`（地基文件，按约定不由模块任务改；这次范围是小件副本，没有动）。后果：多一份重复配置，没有错误输出。
  3. `push` 与 `notifications` 的 `describeLink` 可以用参数（摘要键、空类型时的写法）并成一个共用函数；这次因为要给它们的参数起名、写测试，没有并。

## 验证

- 每个模块合并后的测试：avatar（avatar、complaints、services/avatar 191 条）、push 219、sms 203（email 的 45 同跑）、email 49、activity（含 invite 和共用助手 292）、ads（289，最后一次 273 + 服务）、appVersions + channels（153 + 56）、notifications + clientConfig 273、system 387、users 220、analytics + stat 272、campaign 269、其余测试助手模块（memory、monitor、support、credits、cost、invite、moderation、subscriptions 共 839）。
- 共用件的变异检查：`failureToForm`（6 个全红）、`displayText`（`codeText`、`adminText`、`countText`；存活的两个都是等价变异：在原判断前再加一个同义判断，以及把 `typeof value === 'number'` 换成 `value !== null`，因为 `formatCount` 对非有限数本来就返回破折号）、`useUploadSlot`（7 个，补了一条"重置后重置函数不变"的用例后全红）、`useLatestRead`（`error`、`refreshKey`、新旧判断，全红）、`useServerPage`（13 个，`page > 1` 是等价条件已删，`Number.isFinite` 是冗余已删，其余全红）、`PagedTable`（全红）、`tests/pageHelpers.ts`（补了"相同文字出现在两个选择框里"的用例后全红）、`tests/signInAsAdmin.ts`（全红）、`system/formFailure.ts`（全红）。
- 一次中断：容器重启打断了一轮变异检查，`tests/signInAsAdmin.ts` 里被变异掉的 `signInAs(username)` 一行没有恢复；恢复后跑测试确认红变绿，之后重做了这个文件的变异检查。
- 收尾：`npx tsc --noEmit` 无诊断；`npx biome check`（整个仓库 1107 个文件）0 诊断；`tests/noHardcodedText.test.ts` 和 `src/locales` 6 个文件 448 条通过；全量测试结果见下一节。

## 全量测试

全部提交之后跑了一次全量：`npx vitest run --testTimeout=60000`，404 个文件、7442 条通过、1 条原有的跳过，0 失败。（开头出现的一行 `ECONNREFUSED 127.0.0.1:3000` 在这次改动之前就有，与本次无关。）

## 更正与后续

这一节是独立评审（`final-consolidation-review.md`）之后追加的，前面各节没有改。

**更正“验证”段的变异检查说法。** 上面写 `useServerPage`“其余全红”、`PagedTable`“全红”，与事实不符：独立评审用另一批变异复现出 4 处在共用件自己的测试里存活（页面测试也守不住）：`useServerPage.ts` 里 `Math.ceil` 改成 `Math.floor`（总数不是页大小整数倍时，回最后一页算错）；成功时 `setFailure(null)` 删掉（失败后重试成功，失败条不消失）；`PagedTable.tsx` 里 `current: state.page` 删掉（筛选变了回到第 1 页，表格仍高亮旧页码）；`EnabledSwitch.tsx` 里 `loading={pending}` 删掉（保存期间开关不转圈）。所以那两处“全红”只对当时列出的那批变异成立，`EnabledSwitch` 的“变异检查”也没有覆盖加载态。这 4 处现在各补了一条用例，并逐个重做变异确认变红：

- 总数 19、页大小 10、从第 3 页回第 2 页（`useServerPage.test.tsx`）：`Math.floor` 变异时红。
- 失败后读取成功，失败消失（`useServerPage.test.tsx`）：删掉 `setFailed(null)`（该行在第 1 条修复后的写法）时红。
- 当前页高亮跟着状态走（`PagedTable.test.tsx`）：删掉 `current` 时红。
- 保存期间开关带 `ant-switch-loading`，结束后去掉（`EnabledSwitch.test.tsx`）：删掉 `loading` 时红。

**补写 system 分页表的第四处差别。** 上面“system/PagedTable.tsx”一行写了三处小差别，漏了第四处：共用 `PagedTable` 写死了 `size="small"`，系统管理的管理员页和角色页的表比原来矮（同样的数据，第一行高度 57 px 变成 41 px），“视觉相同”不成立。已修复：共用 `PagedTable` 加 `size` 参数（默认仍是 `small`，其余调用方不变），系统页传 `large`（这就是不写 `size` 时表格自己的高度；逐字节比对过两种写法画出的 DOM 相同），并有测试：共用件的默认和三种取值，以及系统页的表没有 `ant-table-small`、`ant-table-medium`。

**第一处差别（失败条文字不跟着语言变）也已修复。** `useServerPage` 和 `useLatestRead` 现在保存失败对象，`failure` 文字在渲染时用当前语言现算；对外的返回值不变，所以所有用到这两个钩子的页面一并修好，不只是系统页。测试：两个钩子各一条（英文失败后切中文，再切回英文），和系统角色页一条（拦截 403，条上先是英文，切换后整句是中文，没有英文残留）。同时更正上面“system/useRead.ts”一行的说法“失败文字仍在渲染时用 error 现算”——那一行说的是 `useRead` 钩子，在这次之前并入的 `useServerPage` 没有做到；现在两处都做到了。

**并入两处没并入的测试助手。** `sessions/list.test.tsx` 的 `signIn` 主体改为调用 `tests/signInAsAdmin.ts`（构造的 `me`、初始状态、默认 `meta` 与原来逐项相同，原来的 `codes` 覆盖也保留）；`clientConfig/list.test.tsx` 自己的 `writesOf` 删除，改用 `testSetup.ts` 转出的共用 `writesOf`（两份函数体逐字相同）。这两处是测试代码的整理，没有可先红后绿的行为，两个文件改前改后的测试结果相同（改前改后 `sessions/list.test.tsx` 都有一条 5000 字符抽屉用例在机器负载高时超时，单独跑或负载低时通过，与本改动无关）。

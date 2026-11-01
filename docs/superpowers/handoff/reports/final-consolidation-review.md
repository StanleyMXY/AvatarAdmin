立即修未修 0、记录项 5、未运行 3、阻塞 0

# 评审：把各模块重复小件并入共用件（提交 5bdf1ea 到 cc89d91）

评审对象是 `batch-fix-consolidation-report.md` 的大表，声称“只改引用、不改行为”（有说明的差别除外）。评审者是独立上下文，只读实现代码：在草稿目录里放了 HEAD 和 5bdf1ea 之前（eb666ff）两份检出，没有改共享检出里的任何实现文件，评审结束时 `git status` 里没有我的改动（共享检出里别的会话的未提交改动不是我的）。

结论先说：没有发现输出错误、崩溃、数据丢失或契约被破坏的差别；表里“无差别”的各行，我逐行对照删除前的副本和共用件后都成立。有 5 条记录项（其中两条是报告说“视觉相同”或“可接受”的地方，我复现后认为应该登记并建议修）。

## 1. 逐项对照结果（副本 → 共用件）

做法：`git show eb666ff:<副本>` 和 HEAD 的共用件逐行比；再按调用处看它们传的参数。

- 开关（avatar、push 的 `EnabledSwitch`，sms 的 `StatusSwitch`，ads 的 `placements.tsx` 里的内部开关）：三份文件逐行相同，只差 `failureText`；共用件有这个参数。ads 的开关：标签（`ads.placements.enabledOf`）、选中状态（`row.enabled === true`）、失败文字（错误码的话）、完成后重读都一样。sms 的“最后一个短信验证码渠道要先问”仍在 `src/pages/sms/channels.tsx:179-183` 的 `onToggle` 里，问了被拒就不发请求、仍然 `onDone`，和原来一样。无差别。
- `failureToForm`：avatar、push、ads、activity 四份是共用件的子集，共用件多返回的 `unplaced`、`code` 调用方不读；push 的别名原本就是参数。sms、email、system 三份“不认识的原因写输入无效”用 `{ generalReason: true }` 表达，逻辑与原文逐行等价（先查 `reason.<码>`，没有就用 `error.INVALID_REQUEST`）。system 的“409 重复放到 `data.field` 指的字段下面”留在薄包装里，行为不变。无差别。
- 文字函数：ads、email、sms、appVersions、avatar、push 的 `codeText`、`instantText`、`countText`、`orDash`、`adminText` 与 `src/utils/displayText.ts` 逐行相同。activity、notifications、clientConfig 的 `codeText` 会把不是文字的代码写成文字：我把这三个目录里所有 `codeText` 调用逐个查了（`activity/taskConfig.tsx:117`，`notifications/texts.ts:7,12`，`notifications/NotificationDrawer.tsx:88`，`notifications/list.tsx:92`，`clientConfig/texts.ts:27`），都传了 `{ writeOut: true }`，没有漏的；别的目录没有传，原来也是“不是文字就是空”。`Object.hasOwn` 改成“有值”：键恒为 `前缀.码`，不可能等于 `Object.prototype` 上的名字，只有“语言文件里有空字符串文本”才会不同，语言文件里没有，等价。`adminLabel`→`adminText`、`plainOrDash`→`orDash` 逐行相同。
- 上传槽 `useUploadSlot`：ads、appVersions 的两份与共用件逐行相同；avatar 的少 `version`，push 的少 `upload`；这两个目录的表单不读多出来的字段，也没有给上传控件 `key={version}`，所以没有可见差别。`reset` 仍是稳定函数（共用件测试守着）。
- 读取钩子：`ads/useRead`、`analytics/useRead`、`users/useRead`、`stat/guest/useReport`、`system/useRead` 都并入 `useLatestRead`。看了所有调用处：`keep` 全是常量 `true`（共用的 `keepWhileReading` 在依赖里，常量不会多读一次）；`useReport` 的第二个参数 `landedTick` 变成 `{ refreshKey: landedTick }`；`useRead(fetcher, key)` 的 `key` 只有分页表用。新的钩子要求读函数稳定：所有转过来的调用处都是模块级函数或 `useCallback`（`loadAllRoles`、`loadAllAdmins`、`listPermissions`、`readTolerance`、`getAdsMeta` 等）。“只认最新一次”：`useLatestCall` 用计数器，`begin()` 先加一，旧读取的 `isCurrent()` 变假；成功和失败两个分支都判断；卸载时 `useLatestCall` 的清理再加一，所以卸载后不更新。React 严格模式下“模拟卸载再挂载”也成立（先清理再重跑，第一次读取作废，第二次有效）。差别只有报告已写的“离开页面后丢弃在途结果”，无可见后果。`reload` 原来 system 的是稳定函数、现在每次渲染都是新函数：查了所有转过来的页面，没有把 `reload` 放进依赖数组的，不影响。
- 分页：campaign 的 `useServerPage`、`PagedTable`、`FailureBar` 与共用件逐行相同（`FailureBar` 用 `diff` 确认字节相同；`useServerPage` 只多 `useLatestCall`、`backToLastPage`；`PagedTable` 多 `onRow`、`toolbar`、字符串 `rowKey`，不传时一样）。
- 导出表格助手：`withExportSheet` 两份与共用件相同，保存的文件名都是 `export.xlsx`；`sheetAnswer` 默认文件名 `sms-records`、`attribution-performance` 由 sms、ads、campaign 各自的一行包装保留，调用点（`sms/records.test.tsx:397,475`、`ads/report.test.tsx:779`、`campaign/stats.test.tsx:296`）取到的默认名与原来相同。`XLSX_TYPE` 与原来各自的 `SHEET_TYPE` 是同一个字符串。
- 测试助手：`chooseOption`（取最后一个同名选项，并集签名）、`dialogsClosed`、`holdWrites`（不传 `only` 就是全部写请求）、`overrideFetch`、`jsonAnswer`、`settled`、`uploads`/`uploadModule`、`stubObjectUrls` 逐行相同；avatar、push 的 `writesOf` 在两处 `testSetup.ts` 里仍转出 `writesExceptUploads as writesOf`（不算上传），其余转出全部非 GET，与原来各自一致。`signIn` 主体：抽查 avatar、users、system、invite、credits、moderation、analytics、memory、cost 九处，合并前后构造出的 `me`、初始状态和各模块自己的重置都一致；system 的 `minLength === null` 用 `meExtra: {}` 表达，正确。

## 2. 报告承认的差别（system 分页表三处）

- （2）删除最后一页最后一行后到最后一页的读取期间一直“加载中”：在真实浏览器里验证（见第 4 节），可接受，比原来的“无数据闪一下”更好。不是缺陷。
- （3）外层 `div`+外边距 → 纵向 `Flex`（间距 12）：失败条、工具栏、表之间的间距都是 12，与原来相同。不是缺陷。
- （1）失败条文字在失败那一刻定下，切换语言不会变：可以接受，但应该登记，见记录项一。
- 报告没有写的第四处差别：表变矮，见记录项二。

## 3. 报告说“没有并入”的几项

- `channels/channels.tsx` 的开关：关闭前有确认气泡，成功有提示，开着时开关被气泡包住（`channels.tsx:20-80`）；共用件没有这些。行为确实不同，不是缺陷。
- `subscriptions/products.tsx` 的开关（`products.tsx:221-250`）：只有成功才通知页面（`onSaved`），失败直接 `return`；共用件无论成败都会 `onDone`。行为确实不同，不是缺陷。
- `push` 与 `notifications` 的 `describeLink`：摘要键 `push.link.summary` / `notifications.link.summary` 不同，没有类型时一个返回空串、一个返回破折号。确实不同；报告建议的“用参数并成一个”可行，仍是报告里已有的记录项，不重复登记。
- `notifications.reasonText` 与 `clientConfig.problemText`：后者多查 `clientConfig.problem.<码>`，确实不同。
- 报告没提的两处相近函数，也都是行为不同，不是缺陷：`src/pages/complaints/ComplaintDrawer.tsx:51` 的 `adminLabel`（名字是空串时显示空串，不退回 id 前 8 位）；`src/pages/users/text.ts:68` 的 `countText(value, locale)`（参数顺序相反，负数写破折号）。

## 4. 真实浏览器（Playwright Chromium，草稿目录里起 `dev:mock`，端口 8321，原来的树另起 8322 做对比；两个都按进程号停掉，端口已确认关闭）

用泰语、西班牙语（José）、中文混合的名字造数据。点过：

1. 系统管理·角色（`/system/roles`，共用 `useServerPage` 的 `backToLastPage`）：造到 11 个角色，每页 10，翻到第 2 页只剩一行，删除这一行（先把占用它的管理员的角色清掉）：表立即回到第 1 页，10 行，没有“无数据”（每 150 ms 取样，没出现 `.ant-empty`，也没有停在第 2 页）。管理员页同样的表，第 2 页正常。
2. 用户列表（`/users/list`，58 个用户）：翻到第 3 页（18 行，“41-58 of 58”）；改成每页 50，回到第 1 页，请求是 `page=1&pageSize=50`。用户详情各标签（形象、设备、会话）无报错；`/users/does-not-exist` 显示“This account does not exist.”（用到共用钩子给出的 `error`）。
3. 开关：广告位（`/ads/placements`，带“Enabled: app_open”标签的开关，点一下发 `PUT /ads/placements/1 {"enabled":false}`，重读后状态变）；短信渠道（`/sms/channels`，关一个发 `PUT …/enabled`）；形象·服装（`/avatar/cosmetics`）和推送模板（`/push/templates`）各点一个开关，请求正确；再用拦截让写请求回 409，弹出的是错误码的话（“The current state of the item does not allow this action.”），不是后端原话，开关回到原状态。
4. 上传（`/ads/creatives` 新建）：选文件后上传成功，表单显示“Uploaded: pic.png”和尺寸；提交带 `uploadId`；成功则弹窗关闭；后端回 400 `uploadId` 时显示“The backend did not accept the uploaded file. Upload it again.”（`uploadRejected` 路径）。
5. 搜索（`/sms/records`）：同样的筛选连点两次“Search”，各读一次（共 2 次）；翻到第 2 页再点 Search 回到第 1 页。
6. 导出：`/stat/daily`、`/ads/report`、`/sms/records`、`/campaign/stats` 各点导出，都下载到 `.xlsx`，文件名带日期区间。
7. 访客统计各标签（`/stat/guest`）：五个标签都读到数据，没有错误条；活动、广告页面的控制台只有一个登录前的 401。

## 5. 共用件自己的测试能不能守住原来的行为（变异检查）

在草稿目录的 HEAD 拷贝里改，每次改完立刻还原（还原后与 `git show HEAD:<文件>` 逐字节比对过）。共 81 个变异：72 个在共用件自己的测试里变红，9 个存活（逐个见下和记录项三）。

- `useLatestRead`/`useLatestCall`（14 个：新旧判断两处、`keepWhileReading`、失败清数据、`error`、`refreshKey`、`loading` 三处、卸载作废、失败文字用后端原话）：全红。
- `failureToForm`（10 个）、`useUploadSlot`（7 个）、`system/formFailure.ts`（4 个）：全红。
- `displayText`（9 个）：8 个红，存活 1 个是等价变异（`in` 代替真值判断，键总带前缀，等价）。
- `useServerPage`（17 个）、`PagedTable`（13 个）、`EnabledSwitch`（7 个）：共 8 个存活。其中“回到最后一页时丢掉页大小”和“同样筛选再点 Search 不重读”只在 hook 自己的测试里存活，页面测试（`system/roles.test.tsx`、`sms/records.test.tsx`）会让它们变红，所以实际是守住的；表格 `scroll`、工具栏靠右是样式，happy-dom 看不到；其余 4 个见记录项三。

原副本（avatar、push、sms 等）没有自己的测试，被删的测试只有 `system/useRead.test.tsx`、`users/useRead.test.tsx`；它们的用例（读一次、新盖旧、旧失败被丢弃、保留旧行、失败时清空、卸载后丢弃、错误对象加文字）在 `useLatestRead.test.tsx` 里都有对应并被变异检查守着；`activity/texts.test.ts` 里的 `constructor` 用例搬到了 `displayText.test.ts`。

## 6. 死代码和孤儿语言键

- 语言键：zh-CN 4292 个键，合并前后一个不多一个不少；字面量被引用的键，没有一个因为合并而变成没人引用（脚本比对合并前后的引用）。没有孤儿键。
- 死代码：`git diff` 涉及的非测试文件里，没有因合并而变成无人引用的导出；各 `testSetup.ts` 里没有新增没人用的转出（`resetAll`、`scoped`、`PASSWORD_MIN` 合并前就是这样）。引用已删除文件名的地方（`StatusSwitch`、`useReport`、`uploadSlot` 等）只剩 `ledger.md` 里的历史行，不是死链。
- `npx tsc --noEmit` 和 `npx biome check src tests mock`（1015 个文件）在 HEAD 拷贝里都无诊断。

## 发现（分类）

### 立即修
无。

### 记录

1. 系统管理的分页表在切换语言后，失败条的文字停在旧语言（报告说“可接受”，我登记并建议修）。文件：`src/hooks/useServerPage.ts:84`（失败那一刻 `describeFailure(...).text` 存成字符串）；经 `src/pages/system/PagedTable.tsx:30-32` 用到管理员页和角色页。步骤：用拦截让 `GET /api/admin/roles` 回 403，打开 `/system/roles`，条上是“Failed to load: You do not have permission to do this.”；用右上角语言选择切到中文，表头、按钮都变了，条上变成“加载失败：You do not have permission to do this.”（中英混排，原来在渲染时现算，会整句变中文）。后果：这两页失败时语言混着，重试成功后才恢复。`useLatestRead.ts:46`（`failure` 字符串）和别的用 `useServerPage` 的页面（sms、ads、campaign 等）本来就这样，不是这批引入的，但这批把管理员页和角色页也带进来了。建议：钩子里保存 `error` 对象，文字在 `FailureBar` 渲染时用当前语言现算（`useLatestRead` 已经有 `error`），一并解决所有页面。
2. 报告说“视觉相同”，但管理员页和角色页的表变矮了。文件：`src/components/PagedTable.tsx:33`（`size="small"`），原来的 `system/PagedTable.tsx`（eb666ff）的 `<Table>` 没有 `size`。步骤：同一个 Chromium、同样数据，打开 `/system/roles`，第一行高度：合并前 57 px，合并后 41 px（`ant-table-small`）。后果：这两页行更紧凑，和 sms、ads、campaign 的表一致；没有数据或操作丢失，但报告的“视觉相同”不成立。建议：要么给共用的 `PagedTable` 加 `size` 参数、系统页传默认，要么接受并改正报告里那句话（由负责人定，因为这是视觉决定，所以先登记）。
3. 共用件的测试有 4 处守不住（变异在共用件自己的测试和相关页面测试里都存活）。
   - `src/hooks/useServerPage.ts:67`：`Math.ceil` 改 `Math.floor` 全部测试通过（含 `roles.test.tsx` 50 条）。触发：停在第 3 页（每页 10 行），别的管理员同时删了好几行，总数变成 19，第 3 页空了；正确是回第 2 页，错的写法回第 1 页。现有用例的总数都是页大小的整数倍。
   - `src/hooks/useServerPage.ts:66`：成功时 `setFailure(null)` 删掉，hook 测试加 `system/roles`、`system/admins` 共 133 条仍通过。触发：失败条出现后点重试成功，条应当消失；现有测试只测失败，没测“失败后成功”。
   - `src/components/PagedTable.tsx:42`：`current: state.page` 删掉，hook、组件、system、sms 共 75 条仍通过。触发：筛选变了，钩子回到第 1 页，表却还高亮旧页码。
   - `src/components/EnabledSwitch.tsx:38`：`loading={pending}` 删掉，27 条通过（sms、push、avatar 页测试加组件测试）。触发：保存期间开关应显示转圈，防止再点。
   - 不是缺陷：`PagedTable.tsx` 的 `scroll` 和工具栏靠右是样式，happy-dom 看不到；工具栏靠右我在浏览器里看到了（管理员页“New administrator”靠右）。
   报告说共用件的变异检查“全红”，只对它自己列的那批变异成立。后果：以后有人改这些行，不会有测试变红。建议：每处补一条用例（`useServerPage.test.tsx` 补总数 19 页大小 10 从第 3 页回第 2 页、失败后重试成功；`PagedTable.test.tsx` 补页码跟随；`EnabledSwitch.test.tsx` 补保存期间的 `ant-switch-loading`）。
4. 还留着两处没并入、报告大表也没列：`src/pages/sessions/list.test.tsx:22` 自己的 `signIn` 主体（与 `tests/signInAsAdmin.ts` 相同的 `adminOf`、`signInAs`、`access`、初始状态那一套）；`src/pages/clientConfig/list.test.tsx:342` 自己的 `writesOf`。后果：以后改共用助手时这两处不会跟着变，没有错误输出。建议并入（各改一行引用）。
5. 报告“验证”段把 `useServerPage` 的变异写成“其余全红”，`PagedTable` 写成“全红”，但上面记录项三的 `Math.floor`、`setFailure(null)`、`current` 三处变异存活；需要在报告里更正说法（与记录项三一起处理）。

### 变更
无。（`size`、失败文字跟语言变，都是把行为恢复到原样或一并修，不新增行为。）

### 不是缺陷
- 报告承认的第（2）（3）处：见第 2 节。
- `channels`、`products` 两个开关不并入：行为不同，理由与报告相同，且我读了两处代码（第 3 节）。
- `ComplaintDrawer.adminLabel`、`users/text.countText` 与共用件行为不同，不并入。
- `codeText` 里 `Object.hasOwn` 改“有值”判断：键总带前缀，等价（变异 `in` 存活也是同一理由）。

### 未运行（3）
1. 全量 `npx vitest run`：没有重跑（报告里是 404 个文件、7442 条通过）；我只跑了共用件的测试（hooks、PagedTable、EnabledSwitch、failureToForm、displayText、system/formFailure，91 条）和变异检查用到的页面测试（`system/roles`、`system/admins`、`sms/records`、`sms/channels`），没有别的页面测试的结果。
2. 真实后端：全部在 `dev:mock` 的假后端上点的，后端回复格式对不对没验证。
3. 非 Chromium 浏览器（Firefox、Safari）、窄屏（390 宽）：没有点。

### 阻塞
无。

立即修未修 0、记录项 0、未运行 4、阻塞 0

# 批次修复 g2 报告：任务 6 到 10 的记录项，加上 backend-d1-cfg、decided-global、session-unavailable 三份评审里仍开着的记录项

范围：主题、语言文件、外壳、403 和 404、"禁止写死文字"扫描（任务 6）；登录、绑定认证器、强制改密码、会话（任务 7）；共用组件（任务 8）；统计共用组件与统计接口（任务 9）；配置键 schema、配置表单、系统配置页（任务 10）；`backend-d1-cfg-report/review`、`decided-global-report/review`、`session-unavailable-review` 里的记录项。分支 `claude/jolly-dirac-4pq9g6`，环境 Node 22.22.0（比 `package.json` 里的 22.22.1 低一个补丁号，相关测试照常通过）。

做法：每条先读当前代码核对是否还在；还在的先写会失败的测试并看到红，再修；测试缺口类用变异检查（改坏代码，新测试必须变红）。变异检查共 80 余个，除下面写明的"等价变异"外全部变红。登录和会话相关的改动（匿名登录请求、`/me` 的 403、会话读取竞态、通知条的读请求记录）做了深度自检，见"深度自检"一节。

## 核对后的结论

- 我名下的记录项共 65 条（报告里写的记录项，加上评审里标成"记录"的）：已修 37 条；核对时已不存在 20 条；改判为不是缺陷 4 条（写了理由）；写成问题文件 4 条；仍未修 0 条。
- 新发现 3 条（分类见最后一节），都已修。

## 表：每条记录项的状态

| 来源 | 记录项 | 状态 | 提交或证据 |
|---|---|---|---|
| 任务 6 | 浏览器禁用站点数据时，语言下拉选了新语言，界面变了但下拉框和 `Accept-Language` 还是旧的（Umi 自己读写 localStorage）。 | 已修 | 5d4eb2b：语言放进 `src/locales/activeLocale.ts`（内存里一份，localStorage 只是下次访问用，写失败也不影响）；`app.tsx` 里 `export const locale = { getLocale }` 把它交给 Umi；`config/localeConfig.ts` 把 Umi 自己的 localStorage 读写关掉。测试：`activeLocale.test.ts`、`app.test.tsx`、`layout.test.tsx`（存储全部拒绝时选语言），变异 5 个全红。 |
| 任务 6 | 受限账号打开无权限页面时，403 页没有标签栏（标签管理器被卸载再挂载）。 | 已修 | 25f9b3d：`app.tsx` 的 `unAccessible` 也包进 `TabManager`；`app.test.tsx` "keeps the tab bar above the 403 page"。 |
| 任务 6 | 标签页的右键菜单只有鼠标能开：键盘没有"刷新""关闭其他"的入口，触屏不触发右键。 | 已修 | 25f9b3d、8914f18：菜单键、Shift+F10 打开，长按 500 毫秒打开（移动超过 10 像素算滚动，长按后抬手不当作点击标签），打开后焦点进菜单；`TabManager.test.tsx` 新增 7 条，变异 6 个全红。 |
| 任务 6 | "禁止写死文字"扫描的覆盖缺口：哈希只认 md5；不拦协议相对地址 `//host`；`api.error('…')` 这类经变量调用的通知漏报；`.ts` 里拼的界面文字不扫；只拦参照项目的两个名字。 | 已修 | 2db552c：新增规则"哈希调用或库"（`sha256(…)`、`bcrypt.…(`、`crypto.subtle`、`createHash`、`crypto-js` 等，只管 `src/` 的非测试文件；界面里写"SHA-256"这个词不算）、"`//host` 地址"；`message`/`notification` 之外，任何变量上的 `success/error/warning/info/loading/confirm` 调用也扫；`.ts` 按 TypeScript 读并纳入扫描（请求层的 `message` 是给开发者的失败描述，页面显示的是错误码对应的文字，所以跳过 `src/request/`）；共用放行清单加 `trendChart.ts` 的数据字段名 `value`。变异 4 个全红。其中"其他第三方产品名"一项改判为不是缺陷，见表中"扫描只拦参照项目的两个名字"一行。 |
| 任务 6 | 浏览器加载 JS 前是空白页：暗色用户看到默认的白底闪烁。 | 已修 | 00b1113：`public/preload-theme.js`（从自己的源加载，部署文档里的 CSP 是 `script-src 'self'`，内联脚本会被拦）在页面画出前按已存的主题设背景色和 `color-scheme`；`config/preloadTheme.ts` 经 `headScripts` 挂上；切换主题时 `applyModeToDocument` 同步改背景。测试 `preloadTheme.test.ts` 逐档对着 `modes.ts` 的 `colorBgLayout`，变异 4 个全红。部署文档一句话由另一组在 8c17b86 里补了。**生产包里是否真的带上这个脚本没有构建验证**，见"未运行"。 |
| 任务 6 | 日期选择器选中日、`Radio.Button` 选中、可选 `Tag`、`Steps`、`Badge` 等实心主色元素的文字对 `#0ABAB5` 只有约 2.4:1。 | 已修 | 62ac944：日期选择器选中日和范围两端改用主按钮的文字色（`src/global.css`）；圆形单选的选中和悬停改用可读链接色，实心单选用组件 token `buttonSolidCheckedColor`。`Tag` 的可选形态、`Steps`、`Badge` 当前没有任何页面使用（`grep CheckableTag|<Steps|<Badge` 在 `src/pages` 无命中），不写没人用的样式；以后用到时再加。`modes.test.ts` 读 `global.css` 逐条断言，变异全红（有两处多余代码在变异中存活，已删除，见"变异检查里的等价变异"）。 |
| 任务 6 | 会话过期（不经 `signOut`）时 `localStorage` 里的标签路径不会清。 | 已不存在 | `src/session/SessionBridge.tsx:28` 的 `onExpired` 调 `forgetTabs()`；`src/session/loadSession.ts` 令牌被服务端拒绝时也清。 |
| 任务 7 | 未登录时壳外框（没有菜单项的布局）短暂存在。 | 已修 | 25f9b3d：`app.tsx` 的 `layout()` 在没有账号时一律 `pure: true`（读取中、未登录、读不到账号都不画壳）；`app.test.tsx` 逐种状态断言。真实浏览器里"肉眼可见的一帧"没有拍到过，也没有再看。 |
| 任务 7 | 登录请求在 `sessionStorage` 里已有仍有效的令牌时会带 `Authorization` 头。 | 已修 | 87a2cf1（服务）加 d968a72（请求层一并提交，另一组在同一文件里提交了它）：`apiRequest` 新增 `anonymous`，不带令牌头、不把应答当作会话信号；登录和绑定认证器两个请求用它。`auth.test.ts`、`apiClient.test.ts` 共 4 条，变异 4 个全红。 |
| 任务 7 | 绑定页的二维码下没有"无法扫描"的备用办法。 | 已修 | 7aa6dea：二维码下"无法扫描二维码？"，点开才在页面上显示密钥（默认不在页面文字里，原来的"密钥只在二维码里"测试保持成立），四个一组、从左到右读、带复制按钮；密钥从服务器给的 `otpauth://` 地址里取，不是合法 base32 就不提供。`otpauth.test.ts`、`enroll.test.tsx`，变异 5 个全红。 |
| 任务 7 | 强制改密码页没有退出登录入口。 | 已不存在 | `13dddb6` 已加：`src/pages/user/change-password/index.tsx:34`；`decided-global-review` 在真实浏览器里确认过。 |
| 任务 7 | 已登录的人打开 `/user/login` 看到的是登录表单，不会被送走。 | 已不存在 | `src/pages/user/login/index.tsx:34-39` 已登录就 `history.replace`；`login.test.tsx` 第 383 行起的"someone who is already signed in opens the sign-in page"。 |
| 任务 7 | 绑定页对 429 之外的错误没有自己的提示变体（和登录页共用文字）。 | 改判为不是缺陷 | 共用 `failureNotice` 是对的：绑定页的"验证码错误"应说"验证码错误、已使用或已过期"（`error.ADMIN_TOTP_INVALID`），而登录页特有的那句（"或者你的二次验证无法校验，请联系超级管理员重置"）对正在绑定的人反而不对。`src/pages/user/enroll/index.tsx` 的 catch 用通用文字，`src/pages/user/login/index.tsx:67-72` 才有登录页特有的分支。 |
| 任务 8 | `PagedListTable`：请求失败后表里仍留着上一次的旧行，红色错误条旁边是别的筛选条件下的数据。 | 已修 | 0d1ce10：行由组件自己持有（`dataSource` 受控），最新一次请求失败就清空；较旧的请求迟到失败不动它。`PagedListTable.test.tsx` "does not leave the rows of the last good answer beside the error of the next one"（修前红）。 |
| 任务 8 | `PagedListTable` 缺规格 4.1 的列设置和骨架屏。 | 已修 | 0d1ce10：工具栏常驻"列设置"（页面自己的按钮排在前面；不加刷新、密度、全屏）；第一页读回来之前表体显示骨架屏，之后不再出现；3 条新测试，修前红。 |
| 任务 8 | `PagedListTable` 的测试缺口：页大小选择、选项列表、搜索区默认折叠、"只有最新请求才改错误条"。 | 已修 | 0d1ce10：新增选 50 条后以第 1 页重读、四个选项、旧请求迟到失败/成功都不动错误条（两个方向）；"搜索区默认折叠"早已有测试（第 180 行起），变异（默认改成展开）本来就红。变异：页大小选项、默认页大小、两处 `mine === counter.current` 守卫，全红（修前后者存活）。 |
| 任务 8 | `ExportButton`：后端 400 超行数的提示被泛化成"输入不合法"，运营不知道要缩小范围。 | 已不存在 | `src/components/ExportButton.tsx:83` 对不点名日期的 400 加 `pages.export.narrowRange`（"请缩小日期范围或筛选条件"），不显示后端 message；`ExportButton.test.tsx` "keeps the general words for a ref that is not a date"。 |
| 任务 8 | `ExportButton` 的进度字节数没有测试。 | 已修 | fceba45：用分块的响应流断言按钮上依次是 "Received 1.5 KB"、"Received 3 KB"，完成后恢复 "Export"；中文 "已接收 2.38 MB"。变异（不传进度回调、不格式化字节）全红。 |
| 任务 8 | `ReasonModalForm` 只显示错误文字、忽略 `details`；确认中仍允许取消、关闭后不重置表单、关闭后不清失败，没有测试守住。 | 已修 | 9c0c064：失败对象存进状态、渲染时翻译（切换语言跟着变），错误文字下列出各字段被拒的原因（同一原因只写一次，不用后端的英文 message）；确认中取消键禁用、Esc 不关、关闭后重开是空表单且没有旧失败，都有测试；变异 6 个全红。 |
| 任务 8 | `StatusTag` 的 `hasOwn` 保护在测试里观察不到；`MaskedText` 的权限名测试偏弱。 | 已修 | fceba45：给 `Object.prototype` 临时放一个同名键，断言 `StatusTag` 不取它的标签和颜色；`MaskedText` 断言完整句子（中英文）和"没有名字的码就显示码本身"。变异（去掉 `hasOwn`、直接显示码、不判断有没有名字）全红。 |
| 任务 8 | 多语言覆盖仍不足：界面文字的测试几乎全是 en-US。 | 已修 | 93f17de：新增 `inChinese.test.tsx` 13 条：`RowActions`、`DangerConfirmButton`、`PagedListTable`（失败条和重试）、`EllipsisPopoverText`、`JsonField`、`LinkInput`、`StatusTag` 用 zh-CN 语言文件的文字，数据含泰语、阿拉伯语、越南语、印尼语、西班牙语、中文、英文各一；`LinkTargetField`、`ExportButton`、`MaskedText` 另有中文用例。变异（把语言键换成写死的英文）4 个全红。 |
| 任务 8 | `UploadField` 其余测试缺口：`revokeObjectURL`、同一文件连选两次、`file.type` 分支、16 MP 边界、"读不出宽高时不生成预览"的测试名与正文不符。 | 已修 | 9c0c064：`UploadField.preview.test.tsx` 8 条：上传失败/换文件/卸载时都归还预览地址；同一文件再选一次会再传并通知表单忘掉第一次的 `uploadId`（断言原生输入框被清空）；类型或名字结尾二者有一即预览、都没有不预览；视频不预览；正好 16 MP 预览、多一个像素不预览；头部读不出宽高就不预览但照常上传。变异 6 个全红。 |
| 任务 8 | `RowActions` 菜单操作"守卫永不释放"的变异没有测试守住；`DangerConfirmButton`/链接目标的原因文字用错键没有测试守住。 | 已修 | fceba45：菜单操作成功、失败后都能再点（变异：去掉释放 → 红）；`LinkTargetField.reasons.test.tsx`：五种原因码、两种语言，每种错链接显示自己的文字（变异：固定用 `NOT_HTTPS` 的键 → 12 条红）。 |
| 任务 8 | `JsonField` 在父组件用内联回调时每次渲染多一次中间的 `true` 上报。 | 已修 | fceba45：回调经 ref 调用，只在有效性变化时上报；测试里父组件每次渲染换新函数，上报序列恰是 `[true]`、`[true,false]`、`[true,false,true]`。变异（回调进依赖）红。 |
| 任务 8 | `PagedListTable` 日期范围搜索字段的参数形状没有测。 | 已修 | 0d1ce10：`transform` 成 `fromDay/toDay` 的日期范围，在搜索区输入两个日期后请求收到 `YYYY-MM-DD`（守卫测试，本来就对）。 |
| 任务 8 | `UploadField` 在表单清掉 `uploadId` 后仍显示"已上传"，要换 `key` 才复位。 | 改判为不是缺陷 | 这是约定，不是缺陷：控件不知道表单把 `uploadId` 清了，复位由页面用 `useUploadSlot().version` 当 `key` 完成（`src/pages/appVersions/uploadSlot.ts:19`，`VersionModal.tsx:492`、`push/ContentFields.tsx:64`、`ads/CreativeModal.tsx:460` 都在用，对应页面在 400、404、409 后调 `reset()`）。控件自己要知道表单状态就得多一个受控属性，所有页面都要改，没有收益。 |
| 任务 8 | 屏幕阅读器读 `EllipsisPopoverText` 的单元格只用代码看过，没有用读屏软件验证。 | 已修 | fceba45（代码层）：弹出层是 `role="tooltip"`，原来按钮却声明 `aria-haspopup="dialog"`，两者不符；改成 `aria-expanded`（打开时为真）并去掉错误的声明，测试断言可访问名字、展开状态、复制按钮可按名字找到。**读屏软件本身没有可用的**，见"未运行"。 |
| 任务 9 | `RetentionTrendChart` 纵轴没有百分号，提示框也没格式化，而矩阵里同一个量显示百分比。 | 已修 | 73aba5f：纵轴早已有百分号；提示框现在也按语言的数字格式写百分比（33.3% 保留一位小数）。新增 `RetentionTrendChart.test.tsx`，变异 2 个全红。 |
| 任务 9 | `RetentionMatrix` 规格要"各 Dn 的人数和百分比"，现在只有百分比。 | 已不存在 | `src/components/stat/RetentionMatrix.tsx:58` 每格写 "人数 · 百分比"；`RetentionMatrix.test.tsx` 断言。 |
| 任务 9 | `RetentionMatrix` 的表头"注册日""人数"写死，游客留存的标签不同；`LandBar` 没有标签和提示的入口（留存页要写"检查日"和提示）。 | 已不存在 | 留存页用自己的组合：`LandBar` 现在有 `dateLabelId`、`hintId`（`src/components/stat/LandBar.tsx:21,30,78`，`retention.tsx:212` 传 `stat.retention.land.hint`）；游客留存用自己的 `DeviceCohortMatrix`（`GuestRetentionTab.tsx:109` 传 `dateLabel`）；用户留存矩阵的"注册日""人数"就是用户留存的正确名字。e13377b：顺手删掉了没有页面使用的默认提示键 `stat.common.land.hint`（两种语言）。 |
| 任务 9 | 测试缺口：`statRange.ts` 的上限差一天、`ReportHelper` 的 `setItem` 去掉容错，现有测试都不变红。 | 已修 | 73aba5f：`mock/_core/statRange.test.ts` 正好等于上限通过、多一天 400 且点名 `to`（变异 `>` 改 `>=` 红）；`ReportHelper.test.tsx` 现在收集 React 事件处理器里抛出的异常（它们只报告给 window，不让测试失败），去掉 `try/catch` 即红。 |
| 任务 9 | 假后端缺口：usage-cost 只处理 `currency`，忽略 `resourceType/provider/model/source/tier`；范围上限用固定值，不跟 `/config` 里 `stats.max_range_days`。 | 已修 | 范围上限 73aba5f：`rangeOf` 读保存后的 `stats.max_range_days`；usage-cost 的六个筛选由另一组在改 `mock/stats.mock.ts`（工作区里已有，见该组的提交），我没有重复写。`/meta` 里的 `statsMaxRangeDays` 同步见下面 `/meta` 一条。 |
| 任务 9 | 渠道码和渠道名里的应用商店名要不要列入禁用词。 | 改判为不是缺陷 | 仓库里本来就有这些词出于业务：应用版本页的商店链接说明（`src/locales/en-US/appVersions.ts:75`）、广告政策提示（`ads.ts:88`）。把它们列入禁用词会让正常的业务文字过不了扫描；假数据里的渠道名已是中性名字（任务 9 评审时已换）。 |
| 任务 10 | 假后端对契约还有几条校验没做：`invite.reward_start_at` 早于 `reward_end_at`、`app.display_name` 1 到 100 个字符、`auth.phone_login_enabled=true` 的前置条件、`SMS_COUNTRY_UNCOVERED` 警告。 | 已修 | 74167d2（范围和长度，页面和假后端共用同一个 `validateValue`）、0a3f5cf 和 b839a1b（开始早于结束：400 且两个键都点名；`SMS_COUNTRY_UNCOVERED`：保存 `sms.allowed_country_codes` 后警告里列出没有启用 OTP 通道覆盖的国家，通道的 `countries` 为空表示全部；两处代码由另一组在 0a3f5cf 里一并提交，测试在 b839a1b）。手机号登录的前置条件早已有（`mock/config.mock.ts:200` 起，缺启用的英文 OTP 模板时 400 点名 `SmsTemplate`）。`mock/config.rules.mock.test.ts` 13 条，变异 7 个全红（其中一个先存活，补测试后红）。 |
| 任务 10 | 前端 schema 缺契约写了范围的键：`moderation.face_min_det_score`（0.1 到 1）、`generation.mouth_open_min_area`（大于 0）、`generation.mouth_open_min_brightness`（0 到 255）、`app.display_name`、`invite.reward_trigger`（只有 `REGISTER`、`FIRST_CALL`）。 | 已修 | 74167d2：`number` 类型支持 `min`/`max`/`greaterThan`，字符串类型也走键自己的校验；`configSchema.test.ts` 新增 3 组，变异 5 个全红。输入框的范围同步（`ConfigRow` 本来就读 `spec.min/max`）。 |
| 任务 10 | 约 25 个键的说明文字是按键名推的，`moderation.block_score`/`review_score` 的"达到这个值就拦截/复核"和 `complaint.likeness_due_hours` 风险文字里的"改大会更晚发现"超出契约原文。 | 已修 | 74167d2：三处说明改回契约的话（"把服务返回的分数映射为拦截/复核级别的阈值，复核分数是更低的那个"；"必须在这个时间内处理，默认 48 小时，超过写告警"），测试断言不再出现"达到""更晚发现"。契约说明栏为空的 14 个键，前端按键名写的话请后端核对：写成问题文件 `docs/contract-requests/2026-11-01-admin-frontend-config-key-descriptions.md`（每个键一行，附前端现在的英文）。 |
| 任务 10 | 测试缺口：`ConfigRow` 里多条 `details` 按 `ref` 对到行（改成取第一条）测试不变红。 | 已不存在 | `d01a225` 补了：把 `refusal.ts` 的 `error.details.forEach` 改成只取第一条，`refusal.test.ts` 和 `ConfigForm.test.tsx` 共 8 条变红（本次重做了变异）。 |
| 任务 10 | `config.jsonInvalid` 这个文字键没有组件使用（`ConfigRow` 用的是 `pages.json.invalid`）。 | 已修 | 462ebf8：两种语言里都删掉；`parity.test.ts` 通过。 |
| 任务 10 | `usage_price.source_url` 在假后端里没有默认值（契约的默认值是第三方服务的地址），页面显示"未配置"。 | 已修 | 462ebf8：`mock/_core/configStore.ts` 给这个键一个示例域名的默认值（`https://example.com/model-prices`），页面能看到默认值、改值和恢复默认三种状态；第三方地址仍不进仓库。`configStore.test.ts` 3 条。 |
| backend-d1-cfg-report | 开启手机号登录被拒时缺的是哪几项，只能给固定的一句话（契约缺口）。 | 写成问题文件 | `docs/contract-requests/2026-10-31-admin-frontend-config-refusal-reasons.md` 第一节（核对：文件在，三节都在）。前端按最小做法继续，不是阻塞。 |
| backend-d1-cfg-report | `attribution.facebook_graph_version` 格式不对时的原因码清单没写，前端按 `OUT_OF_RANGE`。 | 写成问题文件 | 同一文件第二节。 |
| backend-d1-cfg-report | 旧的两键关系后端是否也在 `details` 里列两个键没写，假后端仍只列保存的键。 | 写成问题文件 | 同一文件第三节；前端对两种形状都能处理（`refusal.ts` 逐条处理 `details`）。 |
| backend-d1-cfg-review | 未知原因码或错误码时后端英文 message 显示在界面上。 | 已不存在 | `d01a225`：`src/pages/config/refusal.ts:94-100` 和 `refusalAlertText`（第 78 行起）；`ConfigForm.test.tsx` 暗号测试。 |
| backend-d1-cfg-review | 点名本表单不显示的键、非设置键且被保存行自己有文字的路径，测试缺口。 | 已不存在 | `d01a225`，`refusal.test.ts` 四个用例；本次再做变异（只取第一条细节）8 条红。 |
| backend-d1-cfg-review | 轮询秒数那一行在"保存的是 catch-up 分钟数"被拒时，文字说错了原因。 | 已不存在 | `d01a225`：`refusal.ts:37` 的 `OWN_VALUE_WORDS`。 |
| backend-d1-cfg-review | 支持语言被拒的文字里"列表里必须保留 en""现在只有英文"没有依据。 | 已不存在 | `d01a225`：只留"先让文件随版本发布，再把语言加进来"；`ConfigForm.test.tsx` 断言不再出现旧句子。 |
| backend-d1-cfg-review | 旧测试名没跟着风险键从 6 个改成 7 个。 | 已不存在 | `src/pages/config/ConfigForm.test.tsx:94` 已叫 "the seven risk keys"。 |
| backend-d1-cfg-review | 设备校验四个键的文字里有第三方产品名。 | 已不存在 | `d01a225`：`src/locales/{en-US,zh-CN}/config.ts` 里已无这些词（`grep -c "App Attest\|Apple"` 为 0）；`configSchema.test.ts` 的"名字扫描"守着。 |
| decided-global-report 与 review | 浅色模式下选中的圆角单选按钮文字仍是原主色（2.41:1）。 | 已修 | 62ac944：`src/global.css`，见任务 6 第 6 条。 |
| decided-global-report 与 review | 浅色模式下查询表单的"展开/收起"链接文字仍是原主色（2.41:1）。 | 已修 | 62ac944：`.ant-pro-query-filter-collapse-button` 改用可读链接色。 |
| decided-global-report 与 review | 次要文字和占位文字低于 4.5:1（浅色 3.35、暗蓝 4.09、占位 1.8 到 2.3）。 | 已修 | 62ac944：`colorTextTertiary`、`colorTextPlaceholder`（`colorTextDescription` 跟随）改成同一个提示色，三个背景上都达到 4.5:1，仍弱于正文；`modes.test.ts` 三种主题逐个断言。 |
| decided-global-report 与 review | 网关页时列表页出现两个"重试"（全局警告条和表格自己的错误条）。 | 已修 | 0d1ce10：全局通知条在时，表格不再重复说网关那句话（通知条没起来时表格仍自己说并带重试，两种情形各有测试）。 |
| decided-global-review | 页面标题标识里方向控制字符清得不全（缺阿拉伯字母标记 U+061C）。 | 已修 | 9b127d1：`pageIndex.ts` 的 `BIDI_CONTROLS` 加 `\u061C`；测试逐个断言 12 个方向控制字符。文件名那一份（`download.ts`）另一组已在请求层批次里含 U+061C。 |
| decided-global-review | "GET 遇到网关页"标志后到先得：一个读请求 504、另一个成功，警告条就收起。 | 已修 | 9b127d1：`serviceStatus.ts` 按"方法 + 路径"记每个遇到网关页的读，只有那个读成功、离开页面或按重试才清；别的请求成功或回后端错误不清。`serviceStatus.test.ts` 新增 2 条、改 1 条，变异 4 个全红（含"后端错误应答也只清自己的键"，先存活后补测试）。 |
| decided-global-report 与 review | 假后端 `GET /config` 里 `app.supported_locales` 默认是 `["en"]`，和 `GET /meta` 的七种语言不一致，`PUT` 也不影响 `GET /meta`。 | 已修 | b839a1b：`GET /meta` 里重复设置的字段（语言、币种、最长报表范围、各上传上限等 16 个）在设置被保存后跟着变，重置后回到默认（`mock/_core/meta.ts` 的 `currentMeta`，`config.rules.mock.test.ts` 4 条）；README 一句话更新。默认值差异保留：未保存前 `/meta` 仍是七种语言（决定"假后端改成多语言"，便于验证排版），`/config` 仍报契约的 `["en"]`，因为"只有英文有通知模板文件"的规则要用它演示；注释和 README 写明。 |
| session-unavailable-review | 读 `/me` 得到 403 时提示页多弹一条"无权限"并多发一次 `/me`。 | 已不存在 | `b76b9e6` 之后的 `11085f2`：`getMe` 传 `reportForbidden: false`（`src/services/auth/index.ts`）。 |
| session-unavailable-review | 管理员被删除时后端对 `/me` 答什么，契约没写。 | 写成问题文件 | `docs/contract-requests/2026-10-31-admin-frontend-deleted-admin-token.md`（核对：文件在，含名称、行为、检查顺序、错误、测试）。 |
| session-unavailable-review | 登录或绑定失败后状态里残留 `unavailable`，门页在没有令牌时显示"服务不可用"。 | 已不存在 | `11085f2`：`useSession.establish` 失败时清令牌并把状态置 `{}`（`src/session/useSession.ts:37-43`），`establish.test.tsx`。 |
| session-unavailable-review | 门页的退出测试只断言令牌为空，换成"只清令牌"仍通过。 | 已不存在 | `11085f2`：`SessionGate.test.tsx` 断言令牌、标签页、跳转、状态。 |
| session-unavailable-review | "读不到账号"时是否保留标签页没有测试。 | 已不存在 | `11085f2`：`loadSession.test.tsx`。 |
| session-unavailable-review | 登录后读不到账号时绑定页的提示没有测试。 | 已不存在 | `11085f2`：`enroll.test.tsx` "does not stay signed in when the account cannot be read after the code was accepted"。 |
| session-unavailable-review | 注释和测试名仍写"服务不可达"，`isServiceUnreachable` 没有生产调用。 | 已不存在 | `11085f2`：函数已删（`grep -rn isServiceUnreachable src` 无命中）。 |
| session-unavailable-review（修复节末尾） | "另外看到的"：`onForbidden` 和 `refreshPermissions` 读完 `/me` 后不核对令牌，退出时在途的读取理论上会把账号写回已退出的状态。 | 已不存在 | `196ac0e`：`readMeAgain` 在令牌变了时返回 `undefined`（`src/session/loadSession.ts:55-60`），`useSession.refreshPermissions` 和 `SessionBridge.onForbidden` 只在有账号时才写。 |
| 任务 6 | 扫描只拦参照项目的两个名字，不含其他第三方产品名。 | 改判为不是缺陷 | 第三方产品名没法列举成一份禁用词表；而仓库里本来就有业务上必须出现的商店和广告平台的名字（上面任务 9 最后一条的证据），列进去会拦住正常文字。能做的已做：参照项目的名字照拦，其余靠评审（执行约定里评审者逐条检查）。 |
| decided-global-review 第二条的"别的区域" | "临时值"标签黄字 1.83:1、绿色"正常"标签 3.37:1、增减百分点绿字 2.28:1、页头头像白字 1.83:1（评审划给别的区域，没有人接）。 | 已修 | 93f17de、5cd3f9b、9fe421d、bc85d82：增减的绿和红按主题移到 4.5:1（统计卡、总览卡、额度流水；图表颜色不动）；页头头像用主按钮的文字色；四种状态（成功、警告、危险、信息）的标签和文字色按各自标签底色和三种页面底色移到 4.5:1，修前是 1.8 到 4.0。 |

（表里的哈希是提交的短哈希，用 `git show <哈希>` 看。`d968a72`、`0a3f5cf` 是另一组的提交，其中带上了我写在同一文件里的几行，已在对应行说明。）

## 变异检查里的等价变异

主题的第一版里有两处代码在 Ant Design 的暗色算法下并不需要（`colorTextDescription` 是 `colorTextTertiary` 的别名；占位文字色是别名令牌，不会被算法覆盖），删掉它们测试仍绿；这两处代码已删，不是测试漏洞。其余 80 余个变异全部变红；中途存活过的 5 个（`PagedListTable` 的两处守卫、检查"空国家列表"、后端错误应答的键、旧请求迟到的成功）都已补了测试再变红。

## 深度自检（登录和会话相关的改动）

1. **匿名登录请求**：`anonymous` 让 `buildHeaders` 的 `sentToken` 为 `null`，所以：(a) 不发 `Authorization`（测试：令牌在时仍不带头）；(b) 401 `ADMIN_INVALID_TOKEN` 不触发 `onExpired`、不清令牌（测试：有令牌和没有令牌两种）；(c) 绑定认证器的令牌仍在请求体里，原来的"绑定令牌过期不当作会话过期"靠 `reportSession: false`，现在由 `anonymous` 一并给出，行为不变（`enroll.test.tsx` 原有用例全绿）。没有新增日志，令牌不进任何错误对象。
2. **绑定页显示密钥**：密钥是服务器给 `otpauth://` 地址里的 `secret`，本来就在二维码里；默认不在页面文字里，点"无法扫描二维码？"才渲染；不写日志、不进 `localStorage`、不进地址；`pendingEnroll` 仍只在内存。测试断言默认状态下页面文字里没有密钥，隐藏后也没有。
3. **壳外框**：`pure: !me`。门页 `SessionGate` 的跳转逻辑没动；`unAccessible` 外包一层 `TabManager` 不改变谁能进页面（`TabManager` 只管标签，不管权限）。
4. **通知条按读请求记**：`readKey` 只用方法和路径（不含查询串），不含令牌或文件地址，也不写日志；`serviceStatus` 里只有这些键名。
5. **语言**：`rememberLocale` 只写 `umi_locale` 这一个键（原来 Umi 写的就是它），写失败吞掉。

## 最后一次合并跑的相关测试

`npx vitest run src/components src/theme src/session src/request src/app.test.tsx src/locales tests/noHardcodedText.test.ts mock/config.rules.mock.test.ts mock/config.mock.test.ts mock/auth.mock.test.ts mock/_core src/pages/config src/pages/user src/pages/credits/ledgerColumns.test.tsx src/services/auth src/pages/dashboard/overview.test.tsx`：100 个文件、2057 条全部通过。`npx tsc --noEmit` 对我改的文件没有诊断（别的会话未提交文件里的诊断不是我的）。

## 未运行

1. 真实浏览器里的核对：`global.css` 的颜色覆盖是否压过 Ant Design 运行时注入的样式（我读了源码里的选择器并用 `html[data-theme]` 抬高了优先级，测试只能断言规则本身）、预加载脚本的第一帧、禁用站点数据时的语言切换、手指长按标签、键盘菜单键。这个环境没有浏览器。
2. `max build` / 开发服务器：`headScripts: [{ src: '/preload-theme.js' }]` 和 `src/global.css` 是否被 Umi 按预期打进页面没有构建验证（约定是全部任务做完后构建一次）。
3. 用屏幕阅读器读 `EllipsisPopoverText` 的单元格：没有读屏软件；代码层的可访问名字和展开状态已有测试。
4. 全量测试：按约定没有跑；只跑了各改动相关的文件（见各行）。另外 20 个用 `PagedListTable` 的页面目录一起跑，在多个会话同时占用机器的负载下一个文件要 450 秒、会超时，得不出结论；改为挑了依赖表格空状态、工具栏按钮、旧行的页面文件逐个跑：`pagedTables`、`users/detailTabs`、`moderation/queue`、`credits/requests`、`credits/accounts`、`invite/stats` 通过；`activity/signinConfig`（1 条）、`system/roles`（2 条）在高负载下超时失败，单独重跑都通过；`reportLoading.test.tsx` 有 1 条失败，是另一组正在写的测试（它依赖的 `useKeptState` 还没提交），与本次改动无关。

## 新发现

1. 增减的绿、红文字和页头头像的字对比度不足（`decided-global-review` 第二条划给"别的区域"但没人接）：分类"记录"，已修（见表最后一行）。
2. 四种状态色（成功、警告、危险、信息）作文字时的对比度：浅色里 1.8 到 3.0，暗色里 3.3 到 4.0；分类"记录"，已修（同一行）。图表颜色、填充色、边框不动。
3. 弹出层的语义（`role="tooltip"` 却声明 `aria-haspopup="dialog"`）：分类"记录"，已修（任务 8 的读屏一行）。

没有新的"立即修"，没有"变更"，没有"阻塞"。

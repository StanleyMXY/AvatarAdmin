立即修未修 1、记录项 4、未运行 3、阻塞 0。

# 组 c2 独立评审：管理员、角色、审计、用户、审核（请求 17、19、22、45、46、60、61、134）

评审对象：`origin/main..HEAD` 里 297c0be、029e87e、86b7a12、6e08ce3、c56e75a、0e9b703 六个提交（实现者报告 `reports/impl-c2-report.md`）。深度评审（权限判断、审计、被审核内容地址）。依据 `docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md` 和 `2026-11-03-backend-task-java-backend-updated.md`（第 2377、2392、2438 行）。没有采信实现者的结论：代码和测试都自己读了，缺陷用草稿目录里的 HEAD 拷贝复现，变异检查只在拷贝里做，共享检出里没有改实现代码（共享检出里 `git status` 看到的 `src/pages/sms/` 三个已修改文件是别的会话的，不是本评审的）。

## 一、立即修（1 项）

### 1. 浏览器时钟比服务器快（或签名地址有效期很短）时，审核详情页每隔几秒重新取一次内容地址，一直取下去，每次都写一条审计记录

- 位置：`src/pages/moderation/ContentPanel.tsx` 第 27 到 35 行（`renewDelay`）和第 172 到 203 行（定时器 effect）。
- 触发步骤：浏览器时钟比服务器快 N 秒，且 N 小于有效期（默认 `moderation.content_url_ttl_seconds` 为 300）。例如快 292 秒：打开一条 `FILE` 类记录的详情页，保持标签页可见、不播放。每次回答的 `expiresAt` 都是服务器时刻加 300 秒，用浏览器时钟算只剩 8 秒；`renewDelay` 取 `max(剩余 - 30 秒, 剩余 / 2, 1 秒)` 得 4 秒；4 秒后重取，新回答的 `expiresAt` 是另一个字符串，effect 依赖变了，又安排下一次，如此循环。快 240 秒到 299 秒之间周期是 30 秒到 0.5 秒（下限 1 秒）。
- 错误结果：只要页面开着，就按这个周期不停地发 `GET /moderation/records/{id}/content`。后端说明（134 号）明说这个接口每次读都写审计记录，这条请求的目的就是“少产生审计记录”，现在反而一个审核员开一页就能灌满审计日志；每次换地址还会让图片重新加载（闪一下），暂停的视频回到开头（见记录项 1）。
- 复现（草稿目录拷贝里加了一个测试，假后端每次都答 `expiresAt` 为当前时刻加 8 秒，等价于快 292 秒；用假时钟一秒一秒推进 60 秒）：读了 16 次，也就是每约 4 秒一次，没有停。测试在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/c2/src/pages/moderation/ContentPanel.test.tsx` 里，名字含 `REPRO`。现有测试没有覆盖：“重取失败不再自动重试”只覆盖失败；“已过去不安排”只覆盖 `left <= 0`；“每个地址只取一次”只覆盖剩余时间正常（5 分钟）的回答。
- 同一代码路径还有：配置页允许把 `moderation.content_url_ttl_seconds` 设成 1 以上的任何整数（`src/pages/config/configSchema.ts:1329`，`min: 1`），设成 20 秒时同样每 10 秒读一次。这一半是“有效期短就该常换”的设计结果，不算缺陷；但要不要给周期设下限，是负责人的取舍，写进下面的修法里。
- 实现者在 `docs/contract-requests/2026-11-03-new-differences-c2.md` 第 5 条只写了“偏早（多一条审计记录）”，没有看到会无限重复。
- 建议修法（带测试，不在本评审里改）：重取之后如果新回答用浏览器时钟算剩余仍不足两倍的提前量（60 秒），说明时钟偏差或有效期很短，这个地址不再安排下一次重取，退回到“播放器失败后重取一次”的兜底；再加测试：回答的 `expiresAt` 总是当前时刻加 8 秒，推进 10 分钟，读的次数不超过 2。同时把新差异文件第 5 条的说法改成“会反复重取，直到加上这条保护”。变异检查：去掉这条保护，新测试必须变红。
- 如果带着它上线：时钟偏差本身常见（虚拟机、手动改过时间的电脑）；偏差 4 到 5 分钟的机器上，每个开着审核详情页的人产生每几秒一条审计记录和一次请求。

## 二、记录（4 项）

1. 重取地址会让暂停中的视频或声音回到开头（`ContentPanel.tsx:40-83` 的 `src={content.url}`，换地址在 `:161` `setContent(answer)`）。触发步骤：详情页打开一个 `video/*` 记录，播放到 1 分 20 秒后暂停（`playing()` 为假，所以不拦），等到地址过期前 30 秒（默认约 4 分 30 秒后）。结果：`src` 属性变了，浏览器重新加载媒体，进度回到 0:00，审核员要重新拖。`playing()`（`:178-181`）只拦“正在播放”，不拦“暂停在中间”。这一条来自 HTML 规范里换 `src` 要重新加载的规则，我没有在真实浏览器里验证（实现者报告也把“换地址时图片是否闪、声音是否被打断”列为未运行）。建议：换地址前记下 `currentTime`，新地址 `loadedmetadata` 后恢复；或者对 `currentTime > 0` 的媒体当作播放中，推迟到切走或播完后再换。
2. 标签页不可见时登记的 `visibilitychange` 监听，在组件卸载时有清理（`ContentPanel.tsx:201`），但没有测试盯着它。变异检查：删掉 `:201` 那一行，`ContentPanel.test.tsx` 13 个用例仍全部通过（变异存活）。触发步骤：定时器到点时标签页不可见（监听已登记），不回到这个标签页的情况下详情页被卸载（例如登录失效触发的跳转），之后切回标签页：残留监听触发 `attempt()` → `renew()`，对已离开的记录再发一次内容读取，写一条审计记录。正常使用下很难碰到（卸载要有脚本触发），所以只是测试缺口。建议加一个用例：不可见时卸载，再设为可见并派发 `visibilitychange`，读取次数不增加。
3. `docs/superpowers/handoff/decisions-2026-10-27.md` 第 19 行仍写“审计的‘管理员’筛选无权限时一律隐藏”。请求 46 起这条规则被后端的新接口取代（现在只有 `AUDIT:VIEW` 也能看到下拉，数据来自 `GET /audit-logs/admins`），代码和测试已改（`src/pages/system/AuditAdminFilter.tsx`、`audit.test.tsx:433`），但决定文件没有加一句“已被请求 46 取代”。后果：以后有人按决定文件“修回去”，会让只有 `AUDIT:VIEW` 的人又看不到筛选。同一文件没有别的条目与本组冲突（见第四节）。
4. 英文界面两处文字写了没有依据的话：`src/locales/en-US/users.ts:123` 的 `users.overview.deletionByUser` 写“The user, in the app or on the web”（后端只说 `requestedBy` 为 null 表示用户自己发起，没有说渠道，中文版只写“用户自己”）；`src/locales/en-US/system.ts:119` 的 `system.roles.ownRoleReason` 末尾“Another administrator can.”（不一定对：另一个管理员也要持有该角色的全部权限码才能改，中文版没有这句）。后果：英文界面说了后端没承诺的事；两种语言说法不一致。建议删去这两处多出来的半句。

另外一个已有的现象，不单列：`src/pages/system/roles.test.tsx:25` 把单个用例超时写死在 30 秒，机器负载高时（本次评审同时有十几个 vitest 进程）权限树相关的 3 个用例超时，单独重跑 59 个全过。实现者报告里已写明，属于已知的负载下超时，不重复计数。

## 三、不是缺陷（附理由，供核对）

- 只有 `AUDIT:VIEW` 的人能用审计下拉且不依赖 `/admins`：`AuditAdminFilter.tsx` 不再调用 `useAccess`，数据来自 `listAuditAdmins`（`src/services/system/index.ts:209`）；`audit.test.tsx:289`、`:433` 断言整页没有 `/api/admin/admins` 请求。动作和对象类型选项取自 `/audit-logs/meta`（`audit.tsx:41` 页内读一次）。两个接口读失败时退回输入框（`ChoiceOrTyped` 的 `unavailable`），有测试。
- 有 `ADMIN:MANAGE` 无 `AUDIT:VIEW` 的人：路由 `config/routes/system.ts:32` 仍是 `access: 'AUDIT:VIEW'`，本组没有改路由、菜单和 `access.ts`（`git diff 297c0be^ HEAD --stat -- config src/access.ts` 为空），页面进不去，所以 `meta`、`admins` 两个读也不会发出。没有回退。
- 选项很长的下拉：值原样使用（`AuditValueFilter` 的 `value: text`，标签过 `plainText`），“其他（手动输入）”保留旧值；提交前对值只做 `trimSpec`（`audit.tsx:136`），和“大小写原样”一致；变异“选中值转小写”实现者已测红。输入框长度 64 按 UTF-16 单位，后端也按 UTF-16 单位数（`contract-contradictions.md` 第 4 条），无差别。
- 重置筛选后“其他”的状态：担心 `ChoiceOrTyped` 的内部 `typing` 在表单重置后残留。在拷贝里写了用例（选“其他”、输入、查询、点重置）：重置后请求不再带 `action`，输入框消失，通过，不是缺陷。
- 角色页禁用“编辑自己持有的角色”：超级管理员不禁用（`roles.tsx:32` 在 `superAdmin === true` 时用空集合）；`roleIds` 缺失时 `normalizeMe` 给 `[]`，不禁用，后端仍会答 403 `OWN_ROLE` 并按 reason 显示（`roles.test.tsx:700`、`:773`）。变异检查：去掉超级管理员判断，`does not switch Edit off for a super administrator` 变红。`/roles` 与 `/me` 的竞态不存在：`me` 在会话加载完成之前页面不会渲染（`SessionGate`），之后每行按当前 `me` 现算。`roleIds` 里非文本的编号被 `normalizeMe` 过滤掉（`auth/index.ts:66`），契约写的是文本数组，所以只在后端不按契约时才会漏禁用，后端的 403 兜底。“删除”不禁用符合契约（`OWN_ROLE` 只在 `PUT /roles/{id}`）。
- 403 和 409 的 reason：`texts.ts` 的 `reasonOf` 要求错误码对、`data.reason` 是文本，且在已知列表内才取译文；缺失或不认识时只显示按错误码翻译的文字，不附后端 `message`。变异检查：去掉 `error.code !== code` 判断，`texts.test.ts` 两个用例变红。`grep` `src/pages/system`、`src/pages/moderation`、`src/pages/users/OverviewTab.tsx` 里没有显示 `error.message` 的地方。
- 与此前决定的关系：超级管理员行对非超管整行关闭（`admins.tsx:81`、`:106`、`:231` 的 `isClosedTo` 没动）、自己那行禁用重置（`disabled: own` 没动）、审计详情遮蔽（`auditDetail.ts` 本组没碰）都没有回退。唯一与旧决定字面冲突的是记录项 3，是后端新接口带来的有意变更。
- 134 的地址不进日志和错误文字：`ContentPanel.tsx` 里 `content.url` 只出现在三个媒体元素的 `src`（`:52`、`:66`、`:78`）；`failure` 由 `describeFailure` 按错误码生成；`src` 下除 `src/request/session.ts:61` 的会话处理错误日志外没有 `console`（那一处只打印处理器名字和错误，与内容地址无关）；服务层注释写明不记地址，请求带 `cache: 'no-store'`。`expiresAt` 不是文本、不是时间或已过去时不安排（`renewDelay`），时间字符串不带时区时按本地时区解析，只会让重取不安排或推迟，不会多取。
- 134 的清理：卸载时定时器被清除（变异检查：去掉 `clearTimeout`，`plans nothing after the panel is left` 变红）；切换记录靠 `detail.tsx:251` 的 `key={record.id}` 整个重建；标签页隐藏时不取，可见后取；播放中每 5 秒再看；`load` 与 `renew` 共用 `useLatestCall`，旧答案不会覆盖新答案。
- 60：`requestedBy` 为 null 显示“用户自己”，`requestedBy` 有值而 `requestedByUsername` 为 null 或空显示“已被删除的管理员（编号前 8 位）”，两种显示都对；编号和名字都先过 `plainText` 再作为文字节点显示（`OverviewTab.tsx:35-39`），不会按标记解析。`requestedBy` 缺失而名字有值只会出现在后端违反契约时，不算缺陷。`deletion` 缺失按没有处理。只有 `USER:VIEW` 的人能看到发起管理员的名字，这是后端 `GET /users/{id}` 的响应内容，不是前端决定。
- 61：`queue.tsx:194-203` 把三个筛选原样发给服务端，页内过滤、`typeView` 状态和说明都删了，分页和总数全部来自服务端回答；`ModerationContentType` 七个值与契约一致。切换类型时旧的 HTTP 请求没有取消，旧答案被 `ProTable` 丢弃（`PagedListTable.test.tsx:113`、`:233`、`:260` 覆盖了“旧答案晚到不覆盖新答案”和“旧错误不覆盖新结果”），页内以前自己写的 `beginList` 不再需要。这是所有列表共用的行为，不是本组引入的。

## 四、检查结果

- 在草稿目录拷贝里跑了相关 32 个测试文件（`src/pages/system`、`src/pages/moderation`、`src/pages/users/detailDeletion.test.tsx`、`mock/{system,moderation,auth,users}.mock.test.ts`、`src/services/{system,auth}`），加 `--testTimeout=60000`：1047 个用例，1043 通过；4 个失败里 1 个是我自己加的、故意写成会失败的复现用例，3 个是 `roles.test.tsx` 里写死 30 秒超时的用例在机器负载高时超时，该文件单独重跑 59 个全过。
- 变异检查（只在拷贝里改，改完立刻还原并用 `diff` 确认）：删 `visibilitychange` 清理（存活，见记录项 2）；删 `clearTimeout`（变红）；角色页对超级管理员也禁用（变红）；`reasonOf` 不查错误码（变红）。实现者报告里其余变异（17/22、45/46、60、61、134 的各条）我没有逐条重做，只核对了它们的测试存在。
- 共享检出里没有留下改动；本评审只新增并提交这一个文件。

## 五、未运行（3 项）

1. 对着真实后端联调（`npm run dev:api`）：本评审的结论都来自假后端、接口文档和代码，后端没有运行过任何请求。
2. 真实浏览器里点一遍：特别是记录项 1（暂停的视频换地址后是否回到开头）和第一节的重复重取（改系统时钟后观察网络面板）；本评审只在测试环境里用假时钟复现了第一节。
3. 全量测试、`npm run tsc`、`npm run lint`：按约定全部任务完成后跑一次，本评审只跑了上面相关的 32 个文件。

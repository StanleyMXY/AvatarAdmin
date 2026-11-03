立即修未修 1、记录项 1、未运行 3、阻塞 0

# 组 c1 评审：订阅令牌、短信渠道凭据、短信保护性 400、监控来源、记忆模型冲突（请求 2、5、41、103、137）

评审对象：分支 `claude/jolly-dirac-4pq9g6` 相对 `origin/main` 里这五个请求的改动（提交 `94edf34`、`b82f345`、`24fe845`、`ba636a4`、`3fbaf1a`，实现者报告 `docs/superpowers/handoff/reports/impl-c1-report.md`）。我没有采信报告的结论：逐个读了代码和提交，对照 `docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md` 和 `…-backend-task-java-backend-updated.md`（第 112、1824、2312、2394、3833、3854 行一带），在草稿目录里（`git archive HEAD` 的拷贝，位于会话草稿目录 `draft/`）跑测试、写伪造响应的测试、做变异检查。共享检出里没有留下任何改动（`git status` 干净，只多这一份评审文件）。

这是凭据类字段和令牌相关的改动，按 `CLAUDE.md` 做的是深度评审。

## 结论先说

- 立即修 1 项：短信渠道和模板在"手机号登录关且没有手机号账号"时，删除最后一个验证码渠道或模板不再有任何确认，一次点击就删（渠道的已存凭据随之丢失且无法找回）。这是本批改动（请求 41 的"该情形不再弹确认"）带来的回退，而且旧的确认恰好是这个删除的唯一确认。详见发现 1。
- 记录项 1：订阅事件的 `error` 文字里会不会带购买令牌，我还没查清（发现 2）。
- 凭据、令牌、记忆冲突、监控来源四块，我没有找到会泄露、误发、崩溃或显示错误的缺陷。逐项证据在下面。
- 与 `decisions-2026-10-27.md`（凭据永不回显、已知错误码只显示按码翻译的文字）没有冲突，也没有回退（第五节）。

## 发现

### 发现 1（立即修）：关闭的守卫让"删除最后一个验证码渠道或模板"变成无确认的一击删除

- 位置：`src/pages/sms/useLastOtpPrompt.tsx:77`（`if (guardOff(guard)) return true;`）、`src/pages/sms/channels.tsx:96`（`if (await ask('delete', 'channel')) await remove(row);`）、`src/pages/sms/templates.tsx:100`（`if (question !== null && (await ask('delete', question))) { await remove(row); }`）。锁住这个行为的测试：`src/pages/sms/channels.test.tsx:584`（"deletes the last channel without a question when the meta says that the backend does not guard it"，断言 `screen.queryByRole('dialog')` 为空）。
- 原因：行操作里，不是"最后一个"的行，删除带 `confirmText`（行内"确定删除吗"一问）；是"最后一个"的行，删除不带 `confirmText`，只靠 `ask` 弹出的守卫对话框当作确认。本批改动让 `ask` 在 meta 说"手机号登录关且账号数为 0"时直接返回 true、不弹任何东西，于是最后一行的删除既没有守卫对话框，也没有行内确认。改动前 `ask` 无条件弹框，这一问同时是删除的确认。
- 触发步骤（已复现）：
  1. 手机号登录关、手机号账号数 0（`GET /sms/meta` 给 `phoneLoginEnabled: false, phoneAccountCount: 0`）。
  2. 渠道页：只有一个启用的验证码渠道（假后端的 `gw_th_otp` 把别的渠道停用），点它那一行的"删除"。
  3. 请求 `DELETE /sms/channels/{id}` 立即发出，没有任何对话框，列表里这一行消失。模板页同理：只留一个启用的英文不限国家验证码模板 `otp_en`，点"删除"，`DELETE` 立即发出。我在草稿目录写了模板页的复现测试（`src/pages/sms/zzreview.test.tsx`，`phoneAccounts = 0`，`only('otp_en')`），断言发出一个 `DELETE` 且没有 `dialog`、没有 `OK` 按钮，通过，即缺陷成立。渠道页由现有测试 `channels.test.tsx:584` 直接证明。
- 错误结果：删除是不可撤销的；渠道的凭据是只写的，删掉就找不回，要重新去供应商处取。同一页上其它行的删除都要先确认，只有"最后一个"这一行例外，而这一行恰好是最重要的那个（运营删了它，之后想开手机号登录会被后端的"至少一个启用通道"校验拦住，要重新建渠道并重填全部凭据）。属于 `CLAUDE.md` 的"数据丢失"一类。
- 为什么不是"不是缺陷"：后端不拦并不等于前端可以省掉确认；其它行的确认并不是因为后端守卫才有的。
- 建议的修法（实现者做，我不改实现代码）：`ask` 在 `action === 'delete'` 且守卫关闭时，不要直接返回 true，而是弹一个普通的删除确认（用各自已有的 `sms.channels.deleteAsk`、`sms.templates.deleteAsk` 文字，`danger` 的确定按钮）；或者最后一行的删除在守卫关闭时退回走带 `confirmText` 的那一条。守卫开着时不能再叠一个行内确认（两问）。`disable` 和 `change` 不需要补：其它行的停用本来就是直接写，保存对话框本身就是确认。测试：把 `channels.test.tsx:584` 改成断言出现确认、点确认后才发 `DELETE`、取消则不发；模板页补一条同样的；变异检查：`guardOff` 之后直接 `return true` 的版本必须红。
- 与旧测试预期的关系：旧测试（改动前）在同一场景点的是守卫的"Continue"（见 `git diff 3fbaf1a^ 3fbaf1a -- src/pages/sms/channels.test.tsx` 最后一段），所以旧预期是"有一问"；实现者把预期改成"无问"，是他自己改的预期，不是旧预期。

### 发现 2（记录）：订阅事件的 `error` 文字是否可能带购买令牌，我还没查清

- 位置：`src/pages/subscriptions/events.tsx:~118`（`EllipsisPopoverText text={row.error}`，带"复制"按钮）、`src/pages/subscriptions/SubscriptionDrawer.tsx:~197`（时间线里的 `event.error`）。
- 事实：后端实现说明只说 `sourceEventId` 和 `payload` 改名/截断，没有说 `error` 字段。更新接口文档第 1991、2041 行把 `error` 描述成"处理失败的记录"，没有说它不含令牌。我读不到后端代码（本仓库只读，也不去读别的仓库），所以不知道失败原因文字会不会拼进令牌（例如"验证购买令牌 xxx 失败"）。假后端的错误文字里没有令牌。
- 触发步骤（假设）：Google 事件处理失败，后端把含完整令牌的异常信息写进 `error`；运营在事件列表或抽屉里点开这一行的错误，浮层里是完整文字，还带"复制"按钮。
- 分类：记录（需要后端回答，不是阻塞，当前页面按最小做法继续）。建议写一条给后端的问题：`SubscriptionEvent.error` 是否保证不含购买令牌；若可能含，请后端在写入处遮蔽。本评审只提交评审文件，所以问题文件没有写，由主会话决定是否补写到 `docs/contract-requests/`。

## 逐项核对（没有发现缺陷的部分，附证据）

### 一、凭据（请求 5）

读了 `ChannelModal.tsx`、`CredentialFields.tsx`、`channelRules.ts`、`services/sms/index.ts`、`channels.tsx` 和假后端 `mock/sms.mock.ts` 的 `credentialsDetail`。

- 打开时没有任何已存的值：`ChannelModal.tsx` 的 `initialValues.credentials` 固定是 `{}`，从不读 `channel.credentials`；`SmsChannel` 类型里没有 `credentials` 字段，列表只读 `hasCredentials`（`channels.tsx:187` 起）。现有测试 `channels.form.test.tsx:137、149` 用"后端误带 `credentials`"的响应验证列表、提示、属性都不出现。
- 保存后不回显：对话框关闭即卸载（父组件只在打开时挂载），`createChannel`/`updateChannel` 的返回值不被使用。
- 不进日志、错误文字、sessionStorage、localStorage：`grep -rn "console\." src mock` 没有与此相关的输出；`sessionStorage`/`localStorage` 在 `src` 里只用于令牌（`request/session.ts`）、语言、主题、标签页列表、报表提示，与凭据无关；`request/errors.ts` 的 `ApiError` 不保存请求体；失败文字走 `guardedFailureText`/`describeFailure`/固定译文（`sms.channels.credentialsRefused.*`），不含 `message` 和请求体。测试 `channels.form.test.tsx:255`（失败后密文不在页面上）、`:434`。
- 浏览器自动填充：每个框是 `Input.Password`，`autoComplete="new-password"`、`visibilityToggle={false}`、`spellCheck={false}`，表单 `autoComplete="off"`；与改动前的写法相同，没有变差。真实浏览器的密码管理器行为我没有验证（未运行 1）。
- 切换供应商清空：`ChannelModal.tsx:245` 的 `onValuesChange` 在 `providerCode` 变化时 `form.resetFields(['credentials'])`，`CredentialFields` 还按 `providerCode` 加了 `key`。变异检查（在草稿拷贝里把 `resetFields` 去掉）：`channels.form.test.tsx` 的"does not carry what was typed for one provider to another"变红。去掉 `resetFields` 之所以重要：两家供应商若有同名凭据（例如都有 `apiKey`），只靠 `key` 会让框看起来是空的而表单里还留着旧值，旧值会被当作新供应商的值发出去。
- 只发该供应商声明的名称：`buildChannelBody` 用 `credentialNames` 取值，不遍历表单里的条目。变异检查（改成遍历 `Object.entries(values.credentials)`）：`channelRules.test.ts` 的"sends no name the provider does not declare…"变红。
- 全空不带 `credentials`：`whole` 只在每个声明的名称都填了（去掉两端空白后非空）时才为真，否则不放 `credentials` 键；更新请求从不放 `null`/`{}`。`channelRules.test.ts:60` 覆盖。
- 部分填写拦截：`credentialsProblem` 给 `INCOMPLETE` 并列出缺的名称；换成需要凭据的供应商（编辑时 `switched`）全空给 `REQUIRED`，与后端 `EMPTY_NOT_ALLOWED`（更新接口文档第 3852 行）一致。后端两种 400（缺名称 `EMPTY_NOT_ALLOWED`、多名称 `OUT_OF_RANGE`，`ref` 为 `credentials`）各有固定文字放在凭据区（`ChannelModal.tsx:~158`），不显示 `message`；测试 `channels.form.test.tsx:416、424`。
- 空字符串值：后端接受空值（第 3852 行"值可以是空字符串"），页面要求每个声明的名称非空。声明了的名称是适配器需要的，空值没有用处，所以这是页面比后端严，不是缺陷；实现者已把它写在 `new-differences-c1`。
- 极端名称（如 `constructor`、`__proto__`）：`value?.[name]` 会取到继承属性；需要供应商声明这样的名称才会触发，实际适配器名称是 `apiKey` 一类，不是缺陷（需要不可能的条件）。
- 本地桩（无名称）：不显示框，写"不需要凭据"，不发 `credentials`。
- 测试：草稿拷贝上 `src/pages/sms`、`src/services/sms`、`mock/sms.mock.test.ts` 共 14 个文件 319 个用例全部通过（`--testTimeout=60000 --maxWorkers=3`）。

### 二、令牌（请求 2）

- 伪造响应测试（草稿拷贝，`src/pages/subscriptions/zzreview.test.tsx`）：事件和订阅响应里同时带完整令牌 `FULLTOKEN-ABCDEFGHIJKLMNOP-xyz123`，放在旧字段 `storeRef`、`linkedPurchaseToken`、事件的 `sourceEventId`（`<令牌>:777`）、`payload.subscriptionNotification.purchaseToken`、`payload.voided.pendingRefundToken`、事件顶层的 `purchaseToken`、`linkedPurchaseToken`。事件列表页和订阅抽屉（Google）渲染后 `document.body.innerHTML` 里既没有 `ABCDEFGHIJKLMNOP` 也没有 `FULLTOKEN`；抽屉显示 `…xyz123`。两个用例通过。
- 为什么页面里没有路径：`grep` 确认 `payload`、`sourceEventId`、`linkedPurchaseToken*` 在 `src` 的非测试代码里只出现在类型文件（`services/subscriptions/types.ts`）；事件列表（`events.tsx`）的列、抽屉时间线都不读它们；没有原始 JSON 展示、没有"事件详情"页。`storeRef` 只在抽屉里读（`SubscriptionDrawer.tsx:124` 起），`store === 'GOOGLE'` 时只读 `storeRefSuffix`，即使响应里还带着 `storeRef` 也不显示；`store` 不是 `GOOGLE` 时显示完整 `storeRef`。后端对 Google 把 `storeRef` 置 `null`，所以 `store` 的大小写问题不会漏出令牌。
- Apple 的 `originalTransactionId`（即 Apple 订阅的 `storeRef`）保留：`list.test.tsx` 有"shows the whole Apple original transaction ID"用例，仍通过。Apple 行的 `storeRef` 走 `EllipsisPopoverText`，带复制按钮，这是预期的（Apple 的值单独不能认领订阅）。
- 复制按钮：Google 分支是纯文本，没有按钮、没有复制图标；测试断言了这两点。
- 变异检查（草稿拷贝把 Google 分支关掉，Google 也走 `storeRef` 分支）：`list.test.tsx` 两个用例和我的伪造响应用例变红（共 3 个变红）。
- 假后端：库里存完整令牌、应答里遮掉的做法与后端实现说明一致（`sourceEventId` 第一个 `:` 之前的部分取末 6 位，没有冒号时整段取末 6 位；`payload` 任意层级的 `purchaseToken`、`pendingRefundToken` 改名为 `…Suffix`）；`mock/subscriptions.mock.test.ts` 覆盖，Apple 不遮。
- 审计日志页（`pages/system/auditDetail.ts`）对键名含 `token` 的字符串值已经遮蔽，`purchaseTokenSuffix` 一类也会被遮，无泄露。
- `linkedPurchaseTokenSuffix` 在页面里没有被显示。后端实现说明只要求"显示或复制完整令牌的代码要改成末 6 位"，本来就没有显示它，不是缺陷。

### 三、请求 41：四个保护性原因、操作前提示

- 四个 `reason` 与 `ref`、文字对得上：`lastChannelReason` 只认 `ref === 'SmsChannel'` 加 `LAST_OTP_CHANNEL`/`COUNTRY_LOSES_OTP_CHANNEL`，`lastTemplateReason` 只认 `ref === 'SmsTemplate'` 加 `LAST_OTP_TEMPLATE`/`LAST_ENGLISH_FALLBACK_TEMPLATE`，都要求 `INVALID_REQUEST`；文字取 `reason.<原因>`（`src/locales/{zh-CN,en-US}/reason.ts`），四条各自一句，且都写出"手机号登录开启或存在手机号账号"这个条件；`OUT_OF_RANGE` 不再被当成这四种情形（有测试 `channelFailure.test.ts`、`templateFailure.test.ts`）。后端的 `message` 从不显示（测试里用 `SECRET BACKEND WORDS` 验证）。
- 守卫关闭时不再弹确认：这与后端行为一致，也与计划里 c6 写的"操作前的提示读 meta 精确判断，触发条件是 `phoneLoginEnabled` 为真或 `phoneAccountCount` 大于 0"一致（后端此时不拦，更新接口文档第 3833 行）。meta 读不到时仍然询问（`guardOff` 要求两个值都是明确的 `false`/`0`），询问对话框里写"读不到"。读 meta 的权限是任一 `SMS:*`，只有渠道权限的管理员也读得到（有测试）。
- 运营误删最后一个渠道而后端又拒绝时：`channels.tsx:80`、`:181` 和 `templates.tsx:87、179` 都走 `guardedFailureText`/`templateFailureText`，显示按码文字；测试"says the fixed text of the reason also for a channel that the page did not take for the last one"覆盖。meta 读取和写入之间守卫变开的竞态，也是同一条路径，文字正确。
- 唯一的问题是上面的发现 1：守卫关闭时的"无询问"把删除的确认也一起省掉了。
- 行操作里"停用一个不是最后一个、但独占某个国家的渠道"不会事先询问（`isLast` 只判断最后一个），后端答 `COUNTRY_LOSES_OTP_CHANNEL`，页面显示固定文字。这是改动前就有的范围（保存对话框里的 `keepsCoverage` 才判国家），不属于本批，不是缺陷。

### 四、请求 103：监控来源

- 下拉取自最新一次应答的 `sources`（`pipeline.tsx:~87`），再并上当前选中的来源；后端说明 `sources` 不受 `from`、`to`、`source` 影响，所以选中一个来源后下拉不会收缩，已停止上报的来源也能选。测试 `pipeline.test.tsx` 两条，另有假后端测试。
- 应答没有 `sources`（非数组）时下拉是空的，不再用点里的来源补；后端已实现 `sources`，这只在后端回退到旧版本时才出现，不是缺陷。`sources` 的元素没有逐个检查是不是字符串，同样依赖后端遵守契约；不是缺陷（需要后端违反契约）。
- `sources` 有没有条数上限，是实现者写进 `new-differences-c1` 的缺口，本评审不重复。

### 五、请求 137：记忆模型冲突

- `registeredDimensionsOf`（`services/memory/index.ts:~85`）只在 `code === 'MEMORY_MODEL_CONFLICT'` 且 `registeredDimensions` 是正整数时返回数字，其余全部返回 `undefined`，页面退回按码译文（`fail(error)`）；`detail` 从不被读取。
- 取值：`null`、缺失、字符串 `'1024'`、`0`、`-3`、`12.5` 都显示不带维度的按码文字，且页面上没有 `null|undefined|NaN`（`models.test.tsx` 六个用例）。变异检查（草稿拷贝去掉 `Number.isInteger`）：非整数用例变红。
- 超大值：`8193`、`123456789012` 原样显示；大于 `2^53` 的数 JSON 解析后本来就已经失真；`1e21` 起 JS 会显示成 `1e+21`（我用 `intl-messageformat` 实测了 `1e+21 dimensions`）。登记时维度被限制在 1 到 8192，同一接口登记的名字不可能有更大的维度，所以不是缺陷（需要不可能的条件）。
- 中英文各一句，切换语言时跟着变（`failureLanguage.test.tsx`）。

## 与此前的决定有无冲突（第五项）

- "凭据永不回显"：保持，且更严（框永远空、不读任何已存值、测试覆盖误带 `credentials` 的响应）。
- "已知错误码只显示按码翻译的文字，不附后端 `message`"：保持。凭据两种 400、四个保护原因、记忆冲突都显示固定译文；未知码仍退回 `message`（`describeFailure` 没改）。后端文档对记忆冲突写的是"原样展示其 `detail`"，页面没有照做，这是按负责人的决定（`detail` 是记忆服务的单一语言句子）而不是回退；实现者也在类型注释里写明。
- "令牌只放内存和 sessionStorage"、"被审核内容的文件地址不写日志"：本批没有触碰。
- 没有回退：订阅抽屉以前自己截取末 6 位的代码已被后端的 `*Suffix` 字段取代，行为只更严。

## 测试与检查

- 在草稿拷贝（`git archive HEAD`）里跑：`src/pages/sms`、`src/services/sms`、`mock/sms.mock.test.ts`：14 个文件、319 个用例通过。`src/pages/monitor/pipeline.test.tsx`、`src/pages/subscriptions/events.test.tsx`、`list.test.tsx`、`src/pages/memory/models.test.tsx` 的结果见下面"补充"一行。
- 变异检查共 4 项，每一项都在草稿拷贝里做、做完还原并 `diff` 核对：不重置凭据（红）、发所有条目（红）、记忆维度不要求整数（红）、Google 订阅也读 `storeRef`（红 3 个）。`CredentialFields` 上的 `key` 的变异我没有单独做，因为 `resetFields` 才是决定性的一层。
- 我自己加的两个测试文件（`zzreview.test.tsx`，伪造完整令牌；模板删除无确认复现）只在草稿拷贝里，没有进仓库。

## 未运行（3 项）

1. 真实浏览器里的自动填充和"保存密码"提示（Chrome、Safari、Firefox）：只靠属性和 happy-dom 里的测试，没有在真实浏览器里验证；沿用改动前相同的属性。
2. 对着真实后端：所有结论来自假后端和伪造响应；真实的 Google 订阅和事件响应是否真的不含完整令牌、真实的 `error` 文字里有什么，都没有运行过。
3. 全量测试、`tsc`、`lint`、三个一致性检查：按约定只跑了相关的快速测试。

## 补充：其余相关测试的结果

草稿拷贝上 `pipeline.test.tsx`、`events.test.tsx`、`list.test.tsx`（订阅）、`models.test.tsx`（记忆）4 个文件、82 个用例全部通过。

## 修复

立即修未修 0、记录项 0（发现 2 的前端防御已做，问为题已写成问题文件，等后端回答，不阻塞）、未运行 3（仍是上面的三项）、阻塞 0

### 发现 1（立即修）：已修，提交 `6258688`

- 改动：`src/pages/sms/useLastOtpPrompt.tsx` 的 `ask` 在守卫关闭时，对 `delete` 弹一个普通的删除确认（标题用已有的 `sms.channels.deleteAsk` 或 `sms.templates.deleteAsk`，确定按钮是危险色的"删除"，取消不发请求）；`disable`、`change` 守卫关闭时仍直接放行。守卫开着时仍只有守卫对话框，没有叠加行内确认。
- 测试：先写了会失败的测试并看到红（对话框没有出现），再改。`channels.test.tsx` 里原来断言"没有对话框、一次点击就发 DELETE"的那条改成：出现确认且只有一个对话框、不出现守卫的"手机号登录"两行、取消后没有写请求且行还在、再点删除并确认后恰好一个 DELETE 且行消失；`templates.test.tsx` 加了同样一条（只留英文不限国家验证码模板 `otp_en`，手机号账号 0）。
- 变异检查：把守卫关闭时的分支改成直接 `return true`（即原来的行为），两条新测试都变红；已还原并用 `diff` 核对。
- 同目录 `src/pages/sms` 全部测试通过（见下面的数字）。

### 发现 2（记录）：已处理，提交 `e27c584`

- (a) 问题文件：`docs/contract-requests/2026-11-03-subscription-event-error-text.md`，问后端 `SubscriptionEvent.error` 是否保证不含购买令牌，写明我们为什么需要和现在怎么处理。待后端回答，不阻塞。
- (b) 前端防御：新的纯函数 `src/utils/maskTokenLikeText.ts`（没有复用 `auditDetail.ts` 的遮蔽：那边按键名和上下文找凭据，对一段没有键名的失败文字不适用，而且整段是星号，不留末 6 位）。连续 20 个以上字母、数字和 `-`、`_`、`.` 的串遮成"前 4 个字符、省略号、末 6 位"，结尾的句号和短横线留在串外。字符集只含 ASCII，所以泰语、阿拉伯语、中文、越南语、西班牙语、印尼语的普通文字不会被遮；代价是 20 个字符以上的类名或路径也会被遮，这是有意的（宁可多遮）。用在 `events.tsx` 的错误列和 `SubscriptionDrawer.tsx` 的时间线，两处都是先 `plainText` 再遮，浮层里的完整文字和复制按钮复制的都是遮过的文字。
- 测试：`src/utils/maskTokenLikeText.test.ts` 7 条（遮蔽形状、多处、20 与 19 的边界、七种语言的普通文字原样、ASCII 长串后面的泰语不动、空文字、八种形状的 200000 字符各在 500 毫秒内）；`events.test.tsx` 和 `list.test.tsx` 各一条页面测试（泰语加阿拉伯语、印尼语文字里带完整令牌：格子里、浮层里、复制出去的内容都只有遮过的文字，页面其余部分也没有令牌中段）。
- 变异检查（每项改完立即还原并用 `diff` 核对）：阈值 20 改 40，工具测试红 2 条；遮蔽函数不改任何东西，红 4 条；字符集改成 Unicode 字母，红 1 条；事件列表页去掉遮蔽，页面测试红；抽屉去掉遮蔽，页面测试红。线性时间那条没有单独做变异（正则只有一个贪心的字符类，没有嵌套量词，尾部的短横线和句号用循环去掉）。

### 检查

- 相关测试：`src/pages/sms`、`src/pages/subscriptions`、`src/utils`、`tests/noHardcodedText.test.ts`、`src/locales`：49 个文件、1451 个用例，提交前跑的一次只有一条失败，是我自己新写的抽屉页面测试里模拟剪贴板被 `userEvent.setup()` 换掉了（测试写法的问题，不是代码），改成在打开抽屉之后再设模拟剪贴板；之后 `src/pages/subscriptions` 加 `maskTokenLikeText.test.ts` 重跑 13 个文件、230 个用例全部通过，`src/pages/sms` 两个改过的文件的用例通过。语言文件没有改（用了已有的文字），所以中英文仍然对称（`src/locales` 的测试在上面那次跑里通过）。
- `npx tsc --noEmit` 0 错误；`npx biome check src mock tests` 0 诊断。提交钩子（lint-staged 加暂存文件的类型检查）两次都通过，没有用 `--no-verify`。
- 只覆盖了哪些：遮蔽函数的测试覆盖了泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文；页面测试用了泰语、阿拉伯语、印尼语；界面语言只跑了英文。
- 未运行：全量测试和构建（按约定在整批做完后跑）；真实后端的 `error` 文字长什么样（等后端回答）。

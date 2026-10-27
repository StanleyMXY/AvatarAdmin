立即修未修 0、记录项 0、未运行 0、阻塞 0（第九节：重置的版本检查已做，规则页第 145 行测试超时已修；全量测试和构建按约定没有跑，留到全部任务做完后统一跑）

# 已定变更项 3：客户端配置和审核规则词表的并发保存（区域 conflict）

依据：`docs/superpowers/handoff/decisions-2026-10-27.md` 第 3 条。做法：保存前重新读取，和打开时读到的版本比较；不一致就不保存，提示"已被他人修改"，给"重新载入"。后端加 `expectedUpdatedAt` 的请求保留在问题文件。

## 一、做了什么

1. **客户端配置抽屉**（`src/pages/clientConfig/ClientConfigEditor.tsx`）
   - 点保存，字段检查通过后，先读一次 `GET /client-config` 取出这个键，用 `sameVersion` 和抽屉打开时读到的那一份比较；一致才发 `PUT`。
   - 比较规则（`src/pages/clientConfig/version.ts`）：两次读到的都有 `updatedAt` 就比 `updatedAt`；任何一边没有就比各语言的值（语言顺序不影响结果）。键已经不在回复里，算不一致。
   - 不一致：不发 `PUT`，抽屉里出现警告条"已被他人修改"，说明你的修改没有保存，带"重新载入"按钮；输入框里已填的内容保持不动，直到点"重新载入"。
   - "重新载入"：重新读这个键，用最新的内容重建草稿和语言页签，清掉各语言的错误标记，并让列表也刷新；读取失败时显示错误码对应的文字，页面和已填内容保持不动。
   - 保存前这次读取失败（403、断网等）：不保存，显示错误码对应的文字（不显示后端原话），已填内容保持不动。
   - 双击、三击保存仍然只发一次检查读取和一次写入（沿用 `useSingleFlight`）。
2. **审核规则词表**（`src/pages/moderation/rules.tsx`、`src/pages/moderation/ruleRows.ts`）
   - 点保存，行检查通过后，先读一次 `GET /moderation/text-rules`，用 `sameRules` 和上一次载入或保存后的那一份比较：每条规则的 `id`、`pattern`、`matchMode`、`level`、`note` 和顺序（`GET` 目前没有时间字段，所以比内容；`note` 缺失按空串）。
   - 不一致：不发 `PUT`，出现同样的警告条和"重新载入"；"重新载入"把整张表换成最新的，放弃本地改动；读取失败时页面和已填内容保持不动。
3. **服务**：`src/services/clientConfig/index.ts` 新增 `readClientConfigKey(key)`（没有读单个键的接口，所以是 `GET /client-config` 再取出这个键，没有时返回 `undefined`）。规则词表用已有的 `getTextRules`。
4. **假后端**
   - `mock/clientConfig.mock.ts`：`PUT /client-config/:key` 接受 `expectedUpdatedAt`（问题文件 4.4 的行为：与键当前的最近更新时间不同，含 `null` 的两种情形，返回 409 `INVALID_STATE`，`data` 带当前的 `updatedAt`，什么都不改；不带该字段和以前一样）。每次保存的 `updatedAt` 保证晚于上一次，同一毫秒内连续保存也不会相同。
   - `mock/_core/clientConfigData.ts`：`simulateOtherAdminEdit(key, values, byAdminId?)`，模拟别人在中间保存了这个键，返回新的 `updatedAt`；另有 `latestUpdatedAt`、`instantAfter`。
   - `mock/_core/moderationData.ts`：`simulateOtherRuleListEdit(change)`，模拟别人在中间保存了整张词表。
   - 前端现在不把 `expectedUpdatedAt` 放进请求体：后端还没承诺接受，发未知字段可能让保存整个被拒。假后端先支持，后端接受后前端加一行即可。
5. **语言文字**（zh-CN、en-US 都加，键相同）：`clientConfig.editor.conflict`、`clientConfig.editor.conflictDetail`、`clientConfig.editor.conflictReload`，`moderation.rules.conflict`、`moderation.rules.conflictDetail`、`moderation.rules.conflictReload`。
6. **问题文件**
   - 客户端配置：`docs/contract-requests/2026-10-21-admin-frontend.md` 第 4.4 条已经有完整的 `expectedUpdatedAt` 请求，保留；只把它的"前端配合"一行改成现在的做法。
   - 规则词表没有这条请求，新写在 `docs/contract-requests/2026-10-27-admin-frontend-concurrent-save.md`（`GET` 返回 `updatedAt`，`PUT` 接受 `expectedUpdatedAt`，409 `INVALID_STATE`，检查顺序、测试清单），同一个文件里也写了前端现在做到哪一层、读写之间仍有时间窗、以及希望重置也接受 `expectedUpdatedAt`。
   - `docs/contract-requests/2026-10-26-admin-frontend-notifications.md` 第二部分第 4 条的"暂定：页面不防护"改成现在的做法。

## 二、测试文件和行号

- `src/pages/clientConfig/version.test.ts`（新）：`sameVersion` 8 个用例，含时间相同或不同、重置和新配置、都没有时间比值、泰语和阿拉伯语值、语言顺序、键不在回复里。
- `src/pages/clientConfig/conflict.test.tsx`（新）：
  - 54 别人在中间保存后：不发 `PUT`、提示、已填内容保持、别人的值原样留在库里。
  - 77 "重新载入"后显示别人的版本（泰语、阿拉伯语、日语的值）、保存按钮禁用，再改再存时请求里带着别人新加的语言。
  - 112、124 别人重置了键；别人给没有值的键配了值。
  - 139 没人改时顺序是读、写（再加保存后列表的那次读）。
  - 154 连按三次保存只一次检查读、一次写。
  - 174 保存前读取返回 403：不保存，显示错误码文字，不显示后端原话，已填内容保持。
  - 189 回复里没有这个键算不一致。
  - 227、239 后端没给时间时比值：值相同保存，值不同提示。
- `src/pages/moderation/ruleRows.conflict.test.ts`（新）：`sameRules` 的 10 个用例（相同、note 缺失按空串、改了 pattern、mode、level、note、id、少一条、多一条、顺序变了）。
- `src/pages/moderation/rules.conflict.test.tsx`（新）：44 别人加了两条规则（泰语、阿拉伯语）后保存被拦；58 别人删了一条；68 重新载入后别人的规则在、已填的没了，再保存时请求里带着别人的规则和新的一条；93 没人改时顺序是读、写；106 三连击只一次检查读、一次写；121 note 缺失不算改动；136 保存前读取 403；153 重新载入读取失败时页面和已填内容保持。
- `mock/clientConfig.mock.test.ts`（209 起 5 个用例）：`expectedUpdatedAt` 相同成功、别人先保存得 409 且数据是别人的、`null` 的两种情形、不带字段兼容、模拟的编辑时间严格递增。
- `mock/moderation.mock.test.ts`（末尾 1 个用例）：`simulateOtherRuleListEdit`。
- `src/services/clientConfig/clientConfig.test.ts`：`readClientConfigKey`（取键、没有时返回 undefined、读的是同一个列表接口）。
- 改了一个已有测试：`src/pages/clientConfig/list.test.tsx` 里"保存后重新读取，旧回复晚到不覆盖新回复"按读取次数挑第二次读来拖延；现在保存前多一次检查读取，被拖延的是第三次读，已按此改并写了注释（测试意图不变）。

## 三、红到绿

先写测试，确认是因"功能不存在"而红：

- `mock/clientConfig.mock.test.ts` 加了新用例后：`Tests 4 failed | 14 passed (18)`；失败原因是 `simulateOtherAdminEdit is not a function` 和假后端忽略 `expectedUpdatedAt`（带了旧时间照样返回 200）。
- `npx vitest run src/pages/clientConfig/conflict.test.tsx src/pages/clientConfig/version.test.ts`：`Test Files 2 failed`，`Tests 9 failed`（页面用例全部找不到"Modified by someone else"、找不到"Reload"、`PUT` 前没有读取），`version.test.ts` 因 `Failed to resolve import "./version"` 整个文件红。
- `npx vitest run src/pages/moderation/rules.conflict.test.tsx src/pages/moderation/ruleRows.conflict.test.ts`：`Tests 17 failed | 1 passed (18)`（`sameRules is not a function`，页面用例没有提示、没有检查读取；唯一过的是"note 缺失不算改动"，它是防回退的用例，变异检查 M7 对应的是 `ruleRows` 里的 note 用例）。

实现后：

- `npx vitest run src/locales/parity.test.ts tests/noHardcodedText.test.ts src/pages/clientConfig src/pages/moderation src/services/clientConfig src/services/moderation mock/clientConfig.mock.test.ts mock/moderation.mock.test.ts config/routes`：结果见第七节。
- `npx biome check <我改的全部路径>`：`Checked 51 files ... No fixes applied`。
- `npx tsc --noEmit`：只看 clientConfig、moderation、conflict、mock 路径，没有报错。

## 四、变异检查

| 变异 | 结果 |
|---|---|
| `sameVersion` 一律返回一致 | 18 个用例里 12 个红 |
| `sameVersion` 没有时间时不比值（直接当一致） | 7 个红 |
| 抽屉保存前跳过检查 | 10 个里 9 个红 |
| 保存前读取失败时吞掉错误继续保存 | 1 个红（403 用例） |
| "重新载入"不更新作为比较基准的那一份 | 1 个红（重新载入后再存） |
| `sameRules` 一律返回一致 | 18 个里 12 个红 |
| `sameRules` 不比 note | 1 个红（"改了 note"） |
| 规则页保存前跳过检查 | 8 个里 7 个红 |

每次变异后都把文件还原并确认和备份一致，之后重跑：4 个测试文件 36 个用例全过。

## 五、真实浏览器检查

在端口 8741 起 `npm run dev:mock`，用 Playwright 开两个都登录 `root` 的会话（A、B），都走真实的假后端：

- 客户端配置：A、B 都打开 `inviteShareTitle`，B 改默认值并保存，A 再保存 → A 的抽屉出现警告条"已被他人修改"和"重新载入"，A 填的内容还在；点"重新载入"后 A 看到 B 保存的值，警告条消失。
- 规则词表：A、B 都加一条规则，B 保存，A 再保存 → 页面出现同样的警告条，A 填的规则还在；点"重新载入"后看到 B 的规则，再加一条保存成功（"The list is saved"）。
- 两个页面的控制台没有错误；截图看了布局（警告条在抽屉的描述下面、在规则表格上方，泰语、阿拉伯语的规则行排版正常）。
- 只看了英文界面；中文文字靠语言文件对等测试（键和占位符相同）保证，没有在浏览器里切到中文看。
- 服务按监听进程的 PID 停掉，没有用 `pkill -f`。

## 六、没做的和原因，发现的问题

- **变更候选（不是遗留项）：客户端配置的"重置"没有版本检查。** 重置会删掉这个键的全部语言值，包括别人刚保存的。决定里只写了保存，所以没有加；重置本身已经有行内确认，确认文字写明"删除这个键所有语言的值"。要加的话设计点是：重置前也读一次比较，不一致时同样提示"已被他人修改"。问题文件里已经写了希望后端的重置也接受 `expectedUpdatedAt`。需要负责人定要不要做。
- **读和写之间的时间窗**：前端的检查是"先读再写"两个请求，两次之间别人保存仍会被覆盖。只有后端在 `PUT` 里比较（`expectedUpdatedAt`）才能关上，问题文件已写（不是阻塞：当前任务按最小的做法完成了前端能做的一层）。
- **规则词表的假后端没有 `updatedAt` 和 `expectedUpdatedAt`**：因为规则词表那条问题文件还没有得到后端回复，假后端保持和现有后端输入一致（`GET` 只有 `items`）；"别人在中间改了"靠 `simulateOtherRuleListEdit` 模拟。
- 没有读单个键的接口，所以检查读取要拉回全部 19 个键；键数很少，没有处理，后端若有单键读取可以换。
- **记录项：`src/pages/moderation/rules.test.tsx` 第 145 行的"can save an empty list"在机器负载高时会超过 30 秒超时。** 触发步骤：和 40 多个测试文件并行跑（同时别的代理也在跑测试），这个用例要连点 8 次"删除"再确认，耗时 32375 ms，超过测试的 30 秒超时，用例变红，实际逻辑没有错；单独跑 69 秒内全过。错误结果：全量跑时可能出现假红。这是原来就有的用例，不是这次改动引入的（这次只在它最后的保存前多了一次读取）；建议把这个用例的超时放宽或把 8 次删除换成直接清空的做法，一并修。

## 七、最终相关测试结果

- 一起跑 47 个测试文件（和别的代理同时在这台机器上跑）：`Test Files 1 failed | 46 passed (47)`，`Tests 1 failed | 597 passed (598)`。失败的是 `src/pages/moderation/rules.test.tsx` 的"can save an empty list"（原有用例，连点 8 次删除），耗时 32375 ms，超过它 30 秒的超时，不是断言失败。单独重跑这个文件：`Test Files 1 passed (1)`，`Tests 21 passed (21)`。
- 我新增和改动的文件（`conflict.test.tsx`、`version.test.ts`、`rules.conflict.test.tsx`、`ruleRows.conflict.test.ts`、`list.test.tsx`、两个假后端测试、服务测试）在两次运行里都是全绿。

## 八、改了哪些文件

`src/pages/clientConfig/ClientConfigEditor.tsx`、`src/pages/clientConfig/version.ts`、`src/pages/clientConfig/version.test.ts`、`src/pages/clientConfig/conflict.test.tsx`、`src/pages/clientConfig/list.test.tsx`、`src/services/clientConfig/index.ts`、`src/services/clientConfig/clientConfig.test.ts`、`src/pages/moderation/rules.tsx`、`src/pages/moderation/ruleRows.ts`、`src/pages/moderation/ruleRows.conflict.test.ts`、`src/pages/moderation/rules.conflict.test.tsx`、`src/locales/{zh-CN,en-US}/clientConfig.ts`、`src/locales/{zh-CN,en-US}/moderation.ts`、`mock/clientConfig.mock.ts`、`mock/clientConfig.mock.test.ts`、`mock/moderation.mock.test.ts`、`mock/_core/clientConfigData.ts`、`mock/_core/moderationData.ts`、`docs/contract-requests/2026-10-27-admin-frontend-concurrent-save.md`（新）、`docs/contract-requests/2026-10-21-admin-frontend.md`（一行）、`docs/contract-requests/2026-10-26-admin-frontend-notifications.md`（一行）、本报告。

覆盖的语言：测试里的值含泰语、阿拉伯语、日语、英语、emoji、中文（规则种子数据里的西班牙语、印尼语、越南语也在页面测试的列表里出现）；界面文字只验证了 en-US 的显示，zh-CN 只验证了键对等。

## 九、追加：客户端配置的"重置"也做版本检查，和规则页测试超时

负责人按业界通行做法补充决定：客户端配置的"重置"要做版本检查，和保存同一套规则。同时把第六节里的记录项（`src/pages/moderation/rules.test.tsx` 第 145 行测试超时）修掉。第六节里"重置没有版本检查"那条变更候选因此已经做完，不再是待定。

### 做了什么

1. **重置的版本检查**（`src/pages/clientConfig/ClientConfigEditor.tsx`，`resetKey`）：行内确认之后、发 `POST …/reset` 之前，先读一次 `GET /client-config` 取出这个键，用 `sameVersion` 和抽屉打开时（或上次"重新载入"后）的那一份比较。
   - 一致才发重置。
   - 不一致（含键已不在回复里）：不发重置，抽屉里出现和保存同一条警告"已被他人修改"，带"重新载入"，什么都不删；"重新载入"沿用保存的那一个（重读、重建草稿、更新比较基准）。重载之后再点重置，以新版本为基准通过。
   - 检查读取失败（403、断网）：不重置，显示错误码对应的文字（不显示后端原话），不出现"已被他人修改"。
   - 三击确认只发一次检查读取和一次重置（行内确认按钮自带防重复）。
   - 没有新增语言文字：沿用保存的 `clientConfig.editor.conflict`、`conflictDetail`、`conflictReload`。
2. **假后端**（`mock/clientConfig.mock.ts`）：`POST /client-config/:key/reset` 接受 `expectedUpdatedAt`，规则与 `PUT` 相同（抽成同一个 `checkExpectedVersion`）：与键当前的最近更新时间不同（含 `null` 的两种情形）返回 409 `INVALID_STATE`，`data` 带当前的 `updatedAt`，什么都不删；不带该字段和以前一样。前端现在不把 `expectedUpdatedAt` 放进重置请求（原因同保存：后端还没承诺接受）。
3. **问题文件**：`docs/contract-requests/2026-10-27-admin-frontend-concurrent-save.md` 第二节，把"前端的重置现在没有版本检查"改成现在的做法，并写明希望后端重置也接受 `expectedUpdatedAt` 及其规则。
4. **规则页测试超时**（`src/pages/moderation/rules.test.tsx`，"can save an empty list"）：给这一个用例加 60000 ms 的超时。说明：同文件其他用例的上限已经是 30000 ms（来自 `describe` 的 `{ timeout: 30000 }`），而这个用例在机器负载高时耗时 32375 ms，超过的正是这个值，所以"和同文件其他用例一致"（30000）不会让它变绿；我取了仓库里最慢用例已经在用的 60000（`describe('the form: creating', { timeout: 60000 })`）。单独跑这个用例 17.2 s，没有改它的步骤和断言。这一条是超时数值，没有写"会失败的测试"（没有一个能稳定复现负载的测试），也没有做变异检查。

### 测试文件和行号

- `src/pages/clientConfig/conflict.test.tsx`（新增 `describe` 在文件末尾，约 245 行起）：
  - 别人在中间保存后重置：不发重置、提示、别人的值原样留在库里、没有"Reset done"。
  - "重新载入"后显示别人的版本（泰语、阿拉伯语），再重置通过（一次写入，键被删）。
  - 别人先重置了键、回复里没有这个键：都算不一致，不发重置。
  - 没人改时顺序是读、重置、读（列表刷新）；三击确认一次检查读、一次重置。
  - 检查读取返回 403：不重置，显示错误码文字，不显示后端原话，没有"已被他人修改"。
  - 测试里一个注意点：antd 的行内确认在测试 DOM 里没有动画结束事件，第二次打开时确认按钮的名字带加载图标，所以第二次重置按 `/OK$/` 找按钮（已在测试里写了注释）。这只是测试 DOM 的表现，不是页面问题。
- `mock/clientConfig.mock.test.ts` 末尾（4 个用例）：时间相同成功；别人先保存得 409、`data` 是当前时间、库里是别人的值；`null` 的情形；不带字段兼容。

### 红到绿

先写测试，实现前：`npx vitest run mock/clientConfig.mock.test.ts src/pages/clientConfig/conflict.test.tsx` → `Tests 9 failed | 30 passed (39)`。失败原因是"功能不存在"：假后端对带旧时间的重置照样返回 200（2 个）；页面在重置时没有读取、没有警告条（找不到"Modified by someone else"，顺序是 `POST, GET` 而不是 `GET, POST, GET`，403 时没有错误文字）（7 个）。其余 2 个假后端用例（时间相同成功、不带字段兼容）本来就该过，是防回退。

实现后：`npx vitest run mock/clientConfig.mock.test.ts src/pages/clientConfig` → `Test Files 9 passed (9)`，`Tests 168 passed (168)`。

### 变异检查（跑 `conflict.test.tsx` 和 `clientConfig.mock.test.ts`，共 39 个用例）

| 变异 | 结果 |
|---|---|
| 重置前不做检查 | 7 个红 |
| 检查读取失败时吞掉错误继续重置 | 1 个红（403 用例） |
| 不一致时静默返回，不显示警告 | 4 个红 |
| 键不在回复里时放行重置 | 1 个红 |
| "重新载入"不更新比较基准 | 2 个红（含新的"重载后再重置"） |
| 假后端重置不看 `expectedUpdatedAt` | 2 个红 |
| 假后端的检查永不失败 | 5 个红（保存和重置共用） |
| 假后端 409 不带当前时间 | 2 个红 |

每次变异后文件都还原，并用 `cmp` 确认和备份逐字节相同；之后重跑全绿。

### 其余检查

- `npx biome check`（clientConfig、假后端、规则页测试）：`Checked 22 files ... No fixes applied`；类型检查由提交钩子跑。
- 最终相关测试：`npx vitest run src/pages/clientConfig src/pages/moderation/rules.test.tsx src/pages/moderation/rules.conflict.test.tsx mock/clientConfig.mock.test.ts src/services/clientConfig src/locales/parity.test.ts tests/noHardcodedText.test.ts` → `Test Files 14 passed (14)`，`Tests 269 passed (269)`。全量测试和构建没有跑（约定留到全部任务做完后统一跑）。
- 只用英文界面验证了显示；中文文字沿用已有的语言文件对等测试（没有新增键）。测试里的值含泰语、阿拉伯语、日语、英语、emoji。

### 文件

`src/pages/clientConfig/ClientConfigEditor.tsx`、`src/pages/clientConfig/conflict.test.tsx`、`mock/clientConfig.mock.ts`、`mock/clientConfig.mock.test.ts`、`src/pages/moderation/rules.test.tsx`、`docs/contract-requests/2026-10-27-admin-frontend-concurrent-save.md`、本报告。

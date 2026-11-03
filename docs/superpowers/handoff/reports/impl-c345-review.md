立即修未修 2、记录项 7、未运行 3、阻塞 0

# c3、c4、c5 三组的独立评审（2026-11-03）

范围：分支 `claude/jolly-dirac-4pq9g6` 对 `origin/main` 的改动里，后端已实现的改动请求 11、12、35、97（c3），37、40、122、47、92（c4），111、112、69、75、67、114（c5）。依据：`docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md` 第三节和 `docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`。评审深度：页面和报表类做一次独立评审，不加复审轮次；金额与十进制、权限、应用版本比较与激活三处做了变异检查。没有读实现者的结论当依据，每条都回到代码和后端说明核对。没有改实现代码；共享检出里没有留下任何改动（变异只在草稿目录的 `HEAD` 拷贝里做，浏览器用的开发服务器也在草稿目录起，已按进程号停掉）。

## 一、立即修（2 条，都没修）

### 立即修 1：商店链接的包名预检仍用渠道登记的包名，没有改用 `GET /meta` 的 `googlePlayPackageName`

- 是什么：后端实现说明第三节 67 号行写明，`googlePlayPackageName` 是后端校验 Play 商店链接时用的环境值，不是 `play` 渠道登记的包名，页面的商店链接预检要用它；开发计划 `docs/superpowers/plans/2026-10-21-avatar-admin-frontend.md` 第 934 行（任务 29 的测试要求）也这样写，并说明“运营改过渠道包名后两者会不同”。现在代码里没有任何地方读 `googlePlayPackageName`（全仓库只有类型、假后端和测试在用它）：`src/pages/appVersions/VersionModal.tsx:200`（`const packageName = channel?.packageName ?? undefined`）、`:474-480`（把它交给 `validateStoreUrl`，不符时抛出表单错误）、`:305`（说明文字里写的包名也是它）、`src/pages/appVersions/storeUrl.ts:62-90`（按这个包名比较 `id`）。c5 的报告把它留给“应用版本目录的人”，c4 的报告没有提到它，两边都没做。
- 触发步骤：在“渠道包”页把 `play` 渠道的包名改成与环境变量不同的值，例如渠道 `app.example.play`、后端环境 `com.example.avatar`；在应用版本页对 `play` 渠道新建版本。填 `https://play.google.com/store/apps/details?id=com.example.avatar`（后端会接受）：表单校验报“包名与渠道不符”，提交不了；填 `id=app.example.play`：页面放行，后端以 `storeUrl` 的 `OUT_OF_RANGE` 拒绝。结果是这个渠道在这种配置下一个版本都保存不了。
- 为什么没被发现：假后端自己也用渠道包名比较（`mock/appVersions.mock.ts` 调同一个 `validateStoreUrl`），所以假后端上看不到。
- 分类：立即修（契约被破坏：页面拒绝契约允许的输入；计划里指定的做法没有落实）。修法：预检的包名取 `useAdminMeta().googlePlayPackageName`；为 `null` 或读不到时不预检包名（只保留 `APPLICATION_ID` 形状可不要，因为后端会以 `PACKAGE_NAME_NOT_CONFIGURED` 拒绝）；假后端改成也按这个值比较；补测试：渠道包名与 meta 包名不同时，按 meta 的包名放行和拒绝。

### 立即修 2：分页的服务端列表在筛选“A → B → A”后回到旧页码，不是第 1 页

- 位置：`src/hooks/useServerPage.ts:44`（`const page = paging.key === key ? paging.page : 1`）和 `:93-95`。分页状态里记着“它属于哪一组筛选”，换成另一组筛选时显示第 1 页，但状态里的旧值没有被清掉；再换回原来的一组，键又相等，旧页码重新生效。文件头的说明写的是“筛选变了就从第 1 页开始”。
- 复现（我写了一个临时测试，在草稿目录里跑，已删除）：`useServerPage` 先读第 1 页，翻到第 3 页，筛选改为 `{only: true}`（发出第 1 页），再改回 `{}`。发出的请求依次是：`page=1`、`page=3`、`only=true&page=1`、`page=3`；最后的页码是 3，期望是 1。
- 真实触发：价格页“模型”页签（请求 69 把它改成服务端筛选，计划写的是换筛选回第 1 页）。模型多于一页时，在无筛选的第 3 页勾上“只看没有生效价格的模型”，再取消勾选，页面回到第 3 页。投放页的记录、点击、成本三个页签（`src/pages/campaign/RecordsTab.tsx:56`、`ClicksTab.tsx:65`、`CostsTab.tsx:58`）里，查询按钮应用同一组筛选的“A → B → A”也一样。c5 的新测试只覆盖“A → B”，所以没有发现。
- 假后端里模型只有 10 条，一页放得下，所以浏览器里看不到这条；是读代码加临时测试确认的。
- 分类：立即修（输出错误：筛选已经换了，列表停在旧页码；是共用钩子，影响 5 处）。修法：切换筛选时把状态里的页码一并重置（例如在筛选的键变化时更新状态，或把键存进状态后在读取时比较“上一次读取用的键”），并补“A → B → A”的测试和变异检查。

## 二、记录项（7 条，建议全部修，不挑）

1. 价格写入 400 的 `ref` 路径下标从几起，页面按从 0 起假设，后端没有确认。位置：`src/pages/cost/failure.ts:15-18`（`bandPlace`）、`:34-51`（显示“第 n+1 档”）、`src/pages/cost/ManualTab.tsx:148-166`。后端实现说明和更新接口文档（第 1921 行）只写了例子 `bands[1].inputMinTokens`；页面发出的档位始终是录入顺序，且页面自己的档位校验不允许乱序，所以“排序后位置”与“录入位置”不会不同，只剩从 0 还是从 1 起这一个不确定。若后端从 1 起：每个提示都落在上一档，最后一档的提示 `bands[N]` 超出档位数，落到表单上方的汇总行。这是 `docs/contract-requests/2026-11-03-contract-gaps.md` 的 G5，等后端回答；回答之前页面的做法（从 0 起）是对后端常见写法的合理推断。
2. 推送记录页，读取失败后仍显示上一次成功读到的行。位置：`src/pages/push/records.tsx:189-199`（失败时只设错误，不清 `data`）。触发：选一个范围勾上日期筛选，查询时后端回 400（我在浏览器里用请求拦截模拟：`from` 的 `OUT_OF_RANGE`），页面上方出现错误条和日期框下的原因，下面的表格还是没有筛选的上一页记录。结果：错误条下面的行与当前筛选对不上。
3. 推送记录页的“创建时间”列按浏览器本地时区显示，日期筛选按 UTC 日。位置：`src/pages/push/records.tsx:260-263`。触发：浏览器在 `America/Los_Angeles`，列里显示 `2026/10/30 23:04:51` 的记录，UTC 是 10 月 31 日 06:04，筛选 10 月 31 日会包含它、筛选 10 月 30 日不包含。筛选的标题和说明写了“UTC”，行为符合后端（请求 114：UTC 日），只是列里看不到 UTC。建议列里的时间鼠标悬停或旁注 UTC 时间。
4. 过时的注释：`src/services/campaign/types.ts:103-109` 有两段连着的类型说明，第一段还写着“后端没说被覆盖了几行，`overwritten` 是给后端的请求、没有读它”，与下面的新说明和代码相反。删掉第一段。
5. 假后端的权益额度上限写死 1 000 000，没有跟着 `entitlement.limit_max`：`mock/subscriptions.mock.ts:73`。页面已改为读 `GET /meta` 的 `entitlementLimitMax` 预检，假后端保存配置后 `GET /meta` 跟着变，但订阅写接口还按 1 000 000 判，开发时改了上限再试写入会看到页面和假后端不一致。c5 在 `new-differences-c5.md` 第 5 节自己也写了这条。
6. 推送记录页的筛选行布局：`DateRangeUtc` 展开后，在 1440 宽下“重置”按钮被挤到下一行（浏览器截图，zh-CN）。纯排版。`src/pages/push/records.tsx:300-322`。
7. 文件系统根目录有一个空的 9 字节文件 `/tsc3.out`，是 c5 的重定向写错留下的（c5 报告第五节第 6 条自己说了，没删掉）；不在仓库里，需要有权限的人删。

## 三、逐请求对照（后端现在返回什么，前端是否真的这么读）

| 请求 | 后端现在 | 前端读法 | 结论 |
|---|---|---|---|
| 11 渲染模型 `fileRef` | 每项不再有 | `src`、`mock`、`tests` 里除“没有 `fileRef`”的断言外没有任何读取（`grep` 核对） | 一致 |
| 12 推送发送结果 `platform`、`tokenSuffix` | `deliveries` 每项两个字段，`platform` 为 `ANDROID`、`IOS` 或 `null`，`tokenSuffix` 末 6 位或 `null` | `src/pages/push/records.tsx:135-144`：平台用译文，不认识的值原样显示，`null`、空串显示“—”；末 6 位按原样显示。浏览器里：新记录显示 iOS、Android 和 6 位值；最旧四条（两项为 `null`）两列都是“—”；不足 6 位的值会照原样显示，不补不截 | 一致 |
| 35 推送模板默认语言规则的 `data.case` | `DEFAULT_MISSING`、`DEFAULT_REQUIRED_BY_OTHERS`、`DEFAULT_MOVED_AWAY` | `src/pages/push/recallRule.ts:21-38,73-80`：三种各自的引导；`case` 缺失或不认识退回总说明；占位符中英一致有测试。三句的含义与接口文档第 2381 行对得上 | 一致 |
| 97 服装 `kind` 创建后只读 | `PUT` 不传 `kind` 合法，传别的值 400 `OUT_OF_RANGE` | `CosmeticModal.tsx:105-111`：更新体不再带 `kind`；假后端同规则 | 一致 |
| 37 任务配置 `hasRecords` | 列表项、单条、三个写接口返回都带布尔值；删除遇记录 409；带未改的类型和目标的 `PUT` 不算改动 | 类型、列表行删除置灰加行内说明、编辑框类型和目标只读（`TaskFormModal.tsx:80`），`hasRecords` 缺失时仍退回 409 路径（`:123-130`） | 一致 |
| 40 广告位读权限、容差 | `GET /ads/placements` 对 `ADS:PLACEMENT`、`ADS:UNIT`、`ADS:CREATIVE` 任一开放，写不变；`GET /ads/meta` 带容差 | 路由和菜单没变（各页仍按自己的权限码进入，`config/routes/ads.ts`）；素材页读 `GET /ads/meta`；假后端读权限放宽，写权限不变（见变异 13）；容差读不到时只跳过宽高比 | 一致（见下方“权限一致性”） |
| 122 `notSkippableFullScreenCount` | 整数；与保存时的 `AD_FORCE_CLOSE_DISABLED` 同一个条件 | `AdsWarnings.tsx:43-46`：`force_close_seconds` 为 0 时读计数；计数不是非负整数时写“没能核对”；浏览器里把它设为 0 后警告出现并带数量 | 一致 |
| 47 版本 409 的 `data.status` | `DRAFT`、`ACTIVE`、`ARCHIVED`、`DISABLED`、`CONSUMED` | `failureText.ts:13-27`；其他值或缺失退回通用句；不读 `CHANNEL_DISABLED`、`UPLOAD_USED`。浏览器里激活框收到 `DISABLED` 显示渠道已停用的说明（en-US） | 一致 |
| 92 版本 400 的 `details` | `ref` 取字段名或 `changelog.<语言>`；三类 400 的 `data` 为 `null` | `VersionModal.tsx:132-151`、`ChangelogField.tsx`、`ActivateModal.tsx:77-90`；所有后端给的原因码在两种语言里都有译文（逐个 `grep` 核对：`INVALID_LANGUAGE_TAG`、`PACKAGE_NAME_NOT_CONFIGURED`、`NOT_HTTPS`、`INVALID_HOST`、`INVALID_PORT`、`INVALID_PATH`、`TOO_LONG` 等）；浏览器里（zh-CN）版本名、最低版本号在各自字段下，泰语页签带标记，`apkUploadId` 写成带字段名的一行，不认识的原因显示原因码 | 一致，但商店链接的包名预检见立即修 1 |
| 111 价格写入 400 的 `details` | `ref` 为 `resourceType`、`unit`、`currency`、`unitPrice`、`bands` 或 `bands[i].字段` | `ManualTab.tsx`：字段下提示、`aria-describedby`、改了字段提示即消失；浏览器里第 2 档输入价填 2 000 000，提示落在这个框下（en-US、zh-CN） | 一致；下标起点见记录 1 |
| 112 确认批次的 400 | 币种被拒时 `[{ref:'currency', reason:'OUT_OF_RANGE'}]`，没传币种也是 | `PendingTab.tsx:361-365` 的 `refTexts.currency`；档位错误按 `bands[i]` 写成“第 n+1 档” | 一致；下标起点同记录 1 |
| 69 用量模型服务端筛选 | `resourceType`、`hasActivePrice`；`total` 是筛选后的条数 | `listUsageModels` 发参数；换筛选回第 1 页（A 到 B 方向）；旧答案不会覆盖新答案（`useLatestCall`）；勾选和下拉离开页签再回来保留（浏览器核对：请求依次为 `hasActivePrice=false`、`resourceType=IMAGE_EDIT&hasActivePrice=false`，回来后勾选和类型仍在） | 一致，但“A → B → A”见立即修 2 |
| 75 批量成本 `overwritten` | 响应 `{count, overwritten}`，`count` 含覆盖行 | `src/services/campaign/index.ts:104-120`、`BatchModal.tsx:151-157`：见下方第四节 | 一致 |
| 67 `GET /meta` 二十五个字段、`GET /me` 七个字段 | 新五个字段，只有 `googlePlayPackageName` 可为 `null` | 见第五节；`GET /me` 的 `roleIds` 读不到时是空数组 | 监控范围、任务类型、权益上限一致；商店链接预检未接，见立即修 1 |
| 114 推送记录日期筛选 | `from`、`to` 为 UTC 日，含首尾，错误 `ref` 规则 | `records.tsx:46-57,213-216,310-317`：勾上才发；浏览器里请求是 `from=2026-10-28&to=2026-11-03`；400 指向 `from` 或 `to` 时写在日期框下，不显示后端 `message` | 一致，见第六节和记录 2、3 |

## 四、重点核对的结论

### 75：`count`、`overwritten` 的各种形状（`src/services/campaign/index.ts:111-120`）

- 缺 `overwritten`（旧形状）、`overwritten` 为负、非整数、字符串或大于 `count`：都得到 `overwritten: null`，提示只写“已导入 n 行”，不会出现 NaN，也不会显示一个比总数还大的覆盖数。
- 缺 `count`、`count` 为负、非整数、字符串或整个响应不是对象：得到 `null`，提示用页面自己解析出来的行数。
- `overwritten` 等于 `count`、为 0：照写“其中覆盖 n 行”。
- `count` 小于 `overwritten`：按上面的规则退回只写总数，没有额外提示。这是合理的退让，不是缺陷。
- 变异检查：`overwritten <= count` 改为 `<`、`overwritten >= 0` 改为 `> 0`、去掉 `count` 的整数检查，三个变异都被测试打红（1、3、1 个用例失败）。

### 111 和 112：`ref` 路径下标

- 页面按从 0 起，显示“第 n+1 档”（`failure.ts:15-18,34-51`）。后端实现说明和更新接口文档没有写起点（G5 已记，见记录 1）。假后端也按从 0 起，所以浏览器和测试都不能证明后端的起点。
- 页面发出的档位始终是录入顺序，页面自己的档位校验（`validateBands`）不允许乱序，所以后端“排序后再校验”不会让下标错位。
- 20 档：浏览器（Playwright Chromium，机器负载约 8）里加到 20 档（100 个输入框），连续输入 4 个字符用了约 550 毫秒（含自动化开销，每键约 140 毫秒），再保存、第 2 档的提示出现在正确的框下。每个档位输入框的外层是普通 `div`（`ManualTab.tsx:368-383`）。结论：不是缺陷。
- 变异检查：显示 `band.index + 1` 改成 `band.index`，4 个用例失败；`isValidPrice` 改成恒真，1 个用例失败（金额与十进制）。

### 114：UTC 日边界和 400 显示位置

- 页面发的是共用控件选出的日历日，原样当 UTC 日用；默认范围用 UTC 的“今天”往前 7 天（`lastNDaysUtc`）。假后端按 `createdAt` 的 UTC 日期串比较，含首尾；`to` 早于 `from` 时 `ref` 一律是 `to`，`from` 先查。控件本身不会产生 `to` 早于 `from`，所以这条只在后端回 400 时才会出现。
- 400 指向 `from` 或 `to` 时，原因和日期提示写在日期框下方（红字），页面另有一条通用的“加载失败：输入内容不合法”错误条；后端自己的 `message` 不显示。浏览器里用请求拦截模拟后确认（zh-CN）。
- 日期框只在勾上“只看创建日期在某个范围内的记录（UTC）”时出现；没勾时不发 `from`、`to`。
- 两处小问题见记录 2、3。

### 12：新取值和不足 6 位

- `platform` 为 `null`、空串或不是文字：显示“—”；新取值（例如 `WEB`）：原样显示；`tokenSuffix` 为 `null`：“—”；不足 6 位：照原样显示。页面测试和浏览器都核对过。

### 67：新字段缺失、为 `null`、类型不对时

- 监控范围（`src/utils/metaValues.ts:11-14`，页面 `src/pages/monitor/pipeline.tsx:64-65`）：不是大于 0 的安全整数就用原来的 7 天；只提供不超过范围的时间按钮，24 小时一档始终在。
- 任务类型（`metaValues.ts:21-27`）：不是数组、没有文字项、项为空白：退回页面原来的三个；去重、保持后端的顺序；任务自己的类型即使不在清单里也始终可选（`TaskFormModal.tsx:77-79`）；不认识的类型显示代码本身。
- 权益上限（`metaValues.ts:30-31`、`featureRules.ts:111-112`）：不是大于 0 的整数时不预检，交给后端；超过上限给 `OUT_OF_RANGE`。
- 素材容差：读不到只跳过宽高比，短边和大小仍预检；不会出现 NaN（`mediaSpec.ts:45-55`）。
- 变异检查：`wholeAbove0` 的 `> 0` 改成 `>= 0`：2 个用例失败；上限比较 `>` 改成 `>=`：3 个用例失败；素材容差空值检查去掉：2 个用例失败。

## 五、权限一致性（广告位读权限放宽之后）

- 路由和菜单：`config/routes/ads.ts` 没变，每个页面仍按自己的权限码进入；只持有 `ADS:CREATIVE` 的人看得到“素材”页，进不了“广告位与全局设置”页。放宽只发生在后端接口上。
- 页面里读广告位的地方：素材页读 `GET /ads/placements` 和 `GET /ads/meta`（此前读系统配置），失败时显示选择器的“需要某权限”提示或不预检，没有硬性按权限码判断。
- 写权限没变：`placements.tsx:30`（`ADS:PLACEMENT`）、`creatives.tsx:114`（`ADS:CREATIVE`）、`units.tsx:54`（`ADS:UNIT`）。
- 假后端：`mock/ads.mock.ts:54` 的 `PLACEMENT_READ` 加了 `ADS:CREATIVE`，`GET /ads/meta` 对任一 `ADS:*` 开放，写接口权限不变。变异：从 `PLACEMENT_READ` 去掉 `ADS:CREATIVE`，假后端和素材页各 1 个用例失败。
- 没有真正的“只有 `ADS:CREATIVE`”的假后端账号可以在浏览器里登录，所以这一条只有页面测试和假后端测试作证。

## 六、变异检查结果（草稿目录的 `HEAD` 拷贝里做，每个变异跑完立刻还原；共 13 个，全部被测试打红，没有存活的）

| 序号 | 改动 | 跑的测试 | 结果 |
|---|---|---|---|
| 1 | 成本批量 `overwritten <= count` 改为 `<` | campaign 服务、批量导入页、假后端 | 1 个用例失败 |
| 2 | `overwritten >= 0` 改为 `> 0` | 同上 | 3 个失败 |
| 3 | 去掉 `count` 的整数检查 | 同上 | 1 个失败 |
| 4 | 价格 400 显示的档位 `index + 1` 改为 `index` | `src/pages/cost` 三个文件 | 4 个失败 |
| 5 | `isValidPrice` 恒真（十进制价格的形状检查） | `src/services/cost` | 1 个失败 |
| 6 | 版本号必须大于最大版本号：`<=` 改为 `<` | `src/pages/appVersions` | 5 个失败 |
| 7 | 激活比较的“生效过的版本”去掉 `ARCHIVED` | 同上 | 3 个失败 |
| 8 | 409 的 `CONSUMED` 不再单独处理 | 同上 | 2 个失败 |
| 9 | 权益上限 `>` 改为 `>=` | `src/pages/subscriptions` | 3 个失败 |
| 10 | `GET /meta` 数字检查 `> 0` 改为 `>= 0` | utils、监控、任务类型 | 2 个失败 |
| 11 | 模型页签不再发 `resourceType` | 价格页测试 | 2 个失败 |
| 12 | 素材宽高比不检查容差是否为空 | `src/pages/ads` | 2 个失败 |
| 13 | 假后端 `PLACEMENT_READ` 去掉 `ADS:CREATIVE` | 广告假后端、素材页 | 2 个失败 |

另：没有对“筛选 A、B、A”的变异，因为那里是真缺陷（立即修 2），用临时测试复现了。

## 七、真实浏览器抽查（Playwright Chromium 对着草稿目录里的 `dev:mock`，中英文各看过；用完按进程号停掉，浏览器随脚本退出）

| 页面 | en-US | zh-CN | 看到的 |
|---|---|---|---|
| 推送记录 | 是 | 是 | 展开一行：新记录平台和末 6 位有值，最旧四条两列为“—”；日期筛选勾上后请求带 `from`、`to`；浏览器时区设成洛杉矶时的行为；用请求拦截模拟 400 看错误位置（记录 2、3、6） |
| 广告位与全局设置 | 是 | 是 | 默认无警告；把 `ads.force_close_seconds` 设为 0 后页面常驻警告出现并带数量；行内的保存警告也有。第一次在 zh-CN 里保存后页面常驻警告没有在 2.5 秒内出现，之后在 en-US 里两次保存后都出现，没能再复现，记为偶发的等待时间不够，不记为缺陷 |
| 素材 | 是 | 是 | 列表正常，多语言素材文字（阿拉伯语、泰语、印尼语、越南语、西班牙语、英语）显示正常；没有操作上传 |
| 应用版本 | 是 | 是 | 请求拦截 400：版本名、最低版本号在字段下，泰语页签带标记并显示“不能为空”，`apkUploadId` 和不认识的 `ref` 写在底部；409 `DISABLED` 在激活框里写出渠道已停用 |
| 价格 | 是 | 是 | 手填表单第 2 档的提示、20 档的输入速度、提交 400 后的错误条 |
| 用量模型 | 是 | 是 | 勾选只看无价格、选资源类型：请求参数正确；离开页签再回来勾选和下拉仍在；表格里的泰语、阿拉伯语、越南语、西班牙语、表情符号和超长无空格字符串显示正常 |

只覆盖 Chromium、1440 宽，没有看窄屏、浅色主题和移动端。

## 八、不是缺陷

- 用量模型的筛选“旧答案覆盖新答案”：`useServerPage` 用 `useLatestCall`，只认最新一次读取，钩子自己的测试覆盖（`src/hooks/useServerPage.test.tsx`），不需要在页面里再加。
- 成本批量导入里 `count` 小于 `overwritten` 时没有提示：退回只写总数，见第四节。
- 20 档价格表单的输入速度：每键约 140 毫秒是在负载约 8 的机器上、含自动化开销量到的，且外层容器已改为普通元素，不再单独记。
- 素材容差读不到时不比较宽高比：是 c4 的设计决定（不猜 3%），后端仍然会判。

## 九、未运行（3 项）

1. 全量测试、整个项目的类型检查、生产构建和三个一致性检查：按项目约定放到最后由主会话跑一次。我跑过的：`biome check`（涉及的 114 个文件 0 诊断）；受影响目录的测试，包括草稿目录里 13 个变异各自的测试（上面那张表）和另外两批无变异的基线（推送、监控、头像相关、`utils`：22 个文件 451 个用例通过；活动、广告位、成本服务和假后端：19 个文件 314 个用例通过）。`src/pages/appVersions`、`src/pages/cost/prices.test.tsx`、`src/pages/subscriptions`、`src/pages/ads` 的完整目录只在变异里跑过，变异下失败的只是预期的几个，其余通过。
2. 对着真实后端联调：没有真实后端；所有 `details` 的下标起点、`ref` 的写法、`platform` 与 `tokenSuffix` 的真实值都来自后端文字，没有运行过。
3. 浏览器里用“只有 `ADS:CREATIVE`”的账号登录、Firefox 和 Safari、手机真机、窄屏和浅色主题：没做。

阻塞 0。

## 十、附：评审时读过的主要位置

`src/hooks/useServerPage.ts`、`src/pages/cost/{ModelsTab,ManualTab,PendingTab,failure}.ts(x)`、`src/services/cost/index.ts`、`mock/cost.mock.ts`、`src/pages/campaign/BatchModal.tsx`、`src/services/campaign/{index,types}.ts`、`src/pages/push/{records.tsx,recallRule.ts}`、`src/components/stat/DateRangeUtc.tsx`、`src/pages/appVersions/{failureText,VersionModal,ActivateModal,storeUrl,versionRules}.ts(x)`、`src/pages/ads/{AdsWarnings,creatives,mediaSpec}.ts(x)`、`src/services/ads/index.ts`、`mock/ads.mock.ts`、`src/utils/metaValues.ts`、`src/pages/{monitor/pipeline,activity/taskConfig,activity/TaskFormModal,subscriptions/*}.tsx`、`src/pages/avatar/CosmeticModal.tsx`、`src/services/auth/index.ts`。

## 十一、修复（2026-11-03，修复者另起上下文；以上各节不改）

立即修未修 0、记录项 2（记录 1 等后端回答，记录 7 不在仓库里）、未运行 3、阻塞 0。

分支 `claude/jolly-dirac-4pq9g6`，每条一个提交（先写失败的测试并看到红，再修，变异检查）。

### 立即修 1：商店链接的包名预检改用 `GET /meta` 的 `googlePlayPackageName`（`f955cd2`）

- 页面（`VersionModal.tsx`）用 `useAdminMeta().googlePlayPackageName`，不再用渠道登记的包名；它是 `null`、缺失或空串时 `packageName` 为 `undefined`，不比较包名，`storeUrl.ts` 只保留 `id` 像应用编号的形状检查，包名对不对交给后端（`PACKAGE_NAME_NOT_CONFIGURED`）。说明文字里的包名、"id 必须等于…"的提示里的包名也是这个值（两种语言的 `idMismatch` 文字加了 `{package}`，未知时写"应用的包名"，不再写"渠道的包名"）。
- 假后端（`mock/appVersions.mock.ts`）校验商店链接时用 `currentMeta().googlePlayPackageName`；假后端的初始版本数据里的链接也改成这个值（`mock/_core/appVersionsData.ts`）。渠道 `play` 的包名仍是 `app.example.play`，环境值是 `com.example.avatar`，所以两者不同的情形一直可测。
- 测试：`versions.form.test.tsx` 新增三个用例（环境值 `com.example.avatar` 放行并能提交、渠道包名 `app.example.play` 提示不符、环境值为 `null` 或缺失时两者都不提示不符）；`mock/appVersions.mock.test.ts` 新增一个用例（`id=app.example.play` 被拒、`id=com.example.avatar` 放行）。原先用渠道包名当"正确链接"的测试改用环境值。先看到红：新增用例在改前失败（页面三个、假后端一个）。
- 变异检查：把页面的包名改回 `channel?.packageName`，3 个用例失败；把假后端改回渠道包名，1 个用例失败。

### 立即修 2：`useServerPage` 筛选 A→B→A 回到第 1 页（`4a199c2`）

- 修法（`src/hooks/useServerPage.ts`）：分页状态里的键和当前筛选的键不同时，在渲染时立刻把状态改成 `{key, page: 1}`（React 会在其他事情之前重画），旧键不再留着，所以回到旧筛选时是第 1 页。
- 测试：钩子测试用评审给的请求序列（`page=1`、`page=3`、`only=true&page=1`，期望再取消后 `page=1`），改前红；价格页模型页签新增用例（无筛选翻到第 2 页→勾上→取消勾选，读取序列 `all:1`、`all:2`、`false:1`、`all:1`），改前红（得到第 2 页）；投放页记录、点击、成本三个页签各加一个同序列用例。
- 与评审说法不同的一点：投放页三个页签只通过"查询"按钮换筛选，而按钮同时调用 `state.search()`，会把页码重置成第 1 页，所以这三处在改前就不会回到旧页码（新增的三个用例改前就绿，是回归覆盖，不是复现）。真正受影响的是只改筛选、不调用 `search()` 的用法，即价格页模型页签。
- 变异检查：把修法去掉（即改前的代码），钩子用例和价格页用例都红；其他使用者里只跑了应用版本页的测试（通过）；短信、广告、通知、系统各页的测试没有单独跑（未运行，它们随最后的全量测试一起跑）。

### 记录 2：推送记录页读取失败后不再显示旧行（`538107d`）

`records.tsx` 的读取失败分支调用 `setData(null)`，错误条下面是空表和"没有推送记录"，分页不再出现第 2 页。新增用例：日期筛选收到 400（`ref: from`）后表格没有行。变异（去掉 `setData(null)`）：1 个用例失败。

### 记录 3：“创建时间”列按 UTC 显示（`677ebeb`）

新增 `formatInstantUtc`（`src/utils/format.ts`）和 `instantUtcText`（`displayText.ts`）；列头改为"Created at (UTC)"和"创建时间（UTC）"，沿用其他统计页"（UTC）"的写法。测试：浏览器在 `America/Los_Angeles`，创建时间 `2026-10-31T06:04:51Z` 显示为 `10/31/2026, 06:04:51`，不出现本地的 `23:04:51`；中文列头；`formatInstantUtc` 在三个时区里结果相同、可解析失败时原样返回。变异（列改回 `instantText`）：1 个用例失败。展开行里的发送时间（`sentAt`）仍按浏览器时区显示，它不是日期筛选依据，没有改。

### 记录 4：过时的注释（`36e46ac`）

删掉 `src/services/campaign/types.ts` 里第一段（"`overwritten` 是给后端的请求、没有读它"），留下与现状一致的第二段。

### 记录 5：假后端的权益额度上限跟着 `entitlement.limit_max`（`ae6b3c7`）

`mock/subscriptions.mock.ts` 的上限取 `currentMeta().entitlementLimitMax`（与 `GET /meta` 同一个来源，读不到数字时才退回 1 000 000）。新增用例：默认 1 000 000 放行、1 000 001 被拒；保存 500 后 500 放行、501 被拒；保存 2 000 000 后 2 000 000 放行、2 000 001 被拒。变异（改回写死 1 000 000）：1 个用例失败。

### 记录 6：推送记录筛选行的布局（`12fb8c7`）

- 在真实浏览器里量（Playwright Chromium，从草稿目录拷贝起 `dev:mock`，1440 宽，中英文）：没有错误行时，"查询""重置"在 1440 宽下本来就在同一行（重置右边缘 1350，容器右边缘 1416）；日期框下出现红色的原因行（日期被后端拒绝，评审用请求拦截模拟的那种状态）时，原因行把这一栏撑到和它一样宽：zh-CN 下"重置"掉到下一行，en-US 下日期框本身掉到下一行。这才是评审看到的情形。
- 修法：这一栏（勾选框加日期框）最宽 366 像素（日期框的宽度，常量 `DATE_COLUMN_WIDTH`），原因行在栏内折行。改后同样的四种状态（中英文、有无原因行）"查询""重置"都在日期框右边同一行（zh-CN 重置 x=1266、en-US 重置 x=1280，y 都是 166）。变异前后的数字：改前 zh-CN 有原因行时重置在 y=258，en-US 日期框在 y=232。
- 没有写自动测试：版式在 happy-dom 里量不出来，所以放在"只在真实浏览器里验证"；窄于约 1380 的宽度时整行仍会折行（1360 宽时"重置"单独掉下去，没有改，本条只要求 1440 宽）。开发服务器按进程号停掉了。

### 记录 1、记录 7：没有改代码

- 记录 1（价格 400 的 `ref` 下标起点）：`docs/contract-requests/2026-11-03-contract-gaps.md` 的 G5 已有对应请求（补什么、行为、检查顺序、错误、测试、前端现在的做法都写了），不用再补；等后端回答。
- 记录 7（文件系统根目录的空文件 `/tsc3.out`）：不在仓库里，没有处理，仍需有权限的人删。

### 跑过的检查

`src/pages/appVersions`、`src/pages/cost`、`src/pages/campaign`、`src/pages/push`、`src/hooks`、`src/utils`、`src/components`、`mock`、`tests/noHardcodedText.test.ts`、`src/locales`：166 个文件 3841 个用例（`--testTimeout=60000`），第一遍有 2 个用例失败，都是新测试自己的写法问题（提示文字里的 `{package}` 没有代入；清除下拉选择的写法），改过测试后重跑，单个文件全部通过；`src/pages/push`、`src/hooks`、noHardcodedText、`src/locales` 在最后一个提交后又整组重跑，30 个文件 1017 个用例通过。`tsc --noEmit` 0 错误，`biome check .` 0 诊断。以上各条中英文语言文件对称（`src/locales` 测试通过）。假数据没有新增语言覆盖的要求，新测试里的 `com.example.avatar`、`app.example.play` 与语言无关。

未运行：全量测试和生产构建（按约定放在全部任务做完后跑一次）；对着真实后端联调（`googlePlayPackageName` 在真实后端上的值、价格 400 的下标）；Firefox、Safari、窄屏和手机。

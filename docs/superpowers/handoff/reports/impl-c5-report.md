改了 6 处、没做 2 处、没运行 2 项、阻塞 0

组 c5，负责请求编号 111、112、69、75、67、114。后端实现说明指 `docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md`（下称"实现说明"，行号是它的行），更新接口文档指 `docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`（下称"接口文档"）。立即修未修 0、记录项 0（有两处是别的目录该改的事，在"没做"里）。

## 一、对照表

| 请求 | 实现说明怎么说 | 前端要改什么 | 状态 | 提交与位置 |
|---|---|---|---|---|
| 111 价格写入的 400 带 `details` | 第三节 111 号行（第 63 行附近）；接口文档 1921 行：`ref` 是出错字段的路径，`reason` 只有 `EMPTY_NOT_ALLOWED`、`OUT_OF_RANGE`、`NOT_AN_INTEGER`，缺口和重叠没有专门的原因 | 手填价格表单按 `ref` 把原因写在对应档位字段下面；对不到字段的写在表单上方；档位缺口、重叠仍由前端自己检查；去掉"后端没有 details，只显示通用句" | 已改。表单存的是失败本身，文字在渲染时按当前语言现算，切换语言会跟着变；字段下的提示用 `aria-describedby` 和 `aria-invalid` 连到输入框；改了某个字段，它的提示就消失，其他字段的留着；不带 `details` 的失败仍留在对话框里。假后端按接口文档返回路径形式的 `details`。真实浏览器（Playwright Chromium，开发服务器加假后端）里看过：第 2 档的输入价填 2000000，保存后提示出现在那个输入框下面 | 5c56625：`mock/cost.mock.ts:74`（`bandsDetails`）、`:111`（`priceReason`）、`:255`（`POST /usage/prices`）；`src/pages/cost/ManualTab.tsx:150`（`refusals`）、`:190`（`refusedProps`）、`:465`（表单上方的提示）、`:499`（把失败存下来）；a631122 把每个档位输入框外面的容器换成普通 `div`（二十档的用例比改之前还快）；`src/pages/cost/failure.ts:16`（`bandPlace`）、`:34`（`refusalLine`）；测试 `src/pages/cost/prices.test.tsx`（"field by field" 一组）、`failureLanguage.test.tsx`（切换语言）、`failure.test.ts`、`mock/cost.mock.test.ts` |
| 112 确认批次的 400 | 第三节 112 号行；接口文档 1921 行：币种被拒是 `[{ref:'currency', reason:'OUT_OF_RANGE'}]`，请求没带 `currency` 也是（按批次自己的币种） | 确认对话框收到 `ref=currency` 提示"该批次的币种不在允许列表内"；growth 组加的 `refTexts` 和问题文件里"请后端给 ref:currency"的说法对齐 | 已改。`refTexts`（`PendingTab.tsx:361`）和两句译文原本就是为 `ref=currency` 写的，保留不动；假后端原本就按这个形状返回，现在对批次自己的币种被移出允许列表的情形有测试（`mock/cost.mock.test.ts` 的"keeps the batch exactly as it was"一组）；新增：确认时档位错误也带路径，对话框写成"第 n+1 档：字段名：原因"（`failure.ts:34`）；问题文件 `docs/contract-requests/2026-10-31-admin-frontend-growth-confirm-currency-details.md` 末尾加了"后端已做"一段，说明"没有 details 就只显示通用句"不再适用；计划任务 26 的句子改成与实现一致（确认对话框里显示，不是币种下拉下面）。这一条和 111 共用档位规则，所以和 111 在同一个提交里 | 5c56625：`mock/cost.mock.ts:319`（确认的检查顺序和 `details`）、`src/pages/cost/failure.ts`、`src/pages/cost/prices.test.tsx`（"names the band field"）、上面的问题文件；计划的改动在 24fe845 里（见第三节第 4 条） |
| 69 用量模型的服务端筛选 | 第三节 69 号行；接口文档 1922 行：`resourceType`、`hasActivePrice`（`true`/`false`），非法值 400 没有 `details`，`total` 是筛选后的条数 | "只看没有有效价格的模型"改由服务端筛选，去掉逐页读取再过滤 | 已改。模型页签改成 `useServerPage` 加 `PagedTable`：勾选框发 `hasActivePrice=false`，类型下拉发 `resourceType`，换筛选回第 1 页，两个筛选在离开页签再回来时保留；从地址 `?tab=models&hasPrice=false` 进来第一次读就带筛选。`report.tsx` 里给模型名输入框做建议的那一处 `loadAllPages(listUsageModels)` 与这条无关（不是筛选），没动。假后端同样筛选并在非法值时给 400 且没有 `details` | d3f334a：`src/services/cost/index.ts:117`（`listUsageModels`）、`src/pages/cost/ModelsTab.tsx:142`、`mock/cost.mock.ts:226`；测试 `src/pages/cost/prices.test.tsx`（models 一组：发的参数、分页、两个筛选一起、保留筛选、失败重试）、`mock/cost.mock.test.ts`（"filters on the server"）、`src/services/cost/cost.test.ts` |
| 75 批量成本的 `overwritten` | 第三节 75 号行；接口文档 1535 行：响应 `{count, overwritten}`，`count` 含被覆盖的行 | 提示改成"已导入 n 行，其中覆盖 m 行"；没有 `overwritten`（旧形状）退回"已导入 n 行" | 已改。`overwritten` 不是 0 到 `count` 之间的整数时也按旧形状处理（`BatchCostsResult.overwritten` 为 `null`）；新增 = `count - overwritten`，提示里不单列；假后端返回 `overwritten`；旧的"（已存在的日期被覆盖）"那句译文去掉（导入前的说明"已存在的成本会被这一行覆盖"仍在） | 1798594：`src/services/campaign/index.ts:104`、`src/pages/campaign/BatchModal.tsx:151`、`mock/campaign.mock.ts:614`、语言文件 `campaign.batch.imported`、`campaign.batch.importedOverwritten`；测试 `src/pages/campaign/accounts.batch.test.tsx`、`src/services/campaign/campaign.test.ts`、`mock/campaign.mock.test.ts` |
| 67 `GET /meta` 多五个字段，`GET /me` 六变七 | 第二节第 9 条、第三节 67 号行；接口文档 2393 行 | 类型、`useAdminMeta`、假后端提供五个字段；监控范围、任务类型、权益上限处使用；读不到退回写死值；严格校验字段集合的类型和测试同步更新 | 已改（`/me` 的 `roleIds` 见下）。(a) 类型 `AdminMeta` 加五个字段，`useAdminMeta` 原本就返回整个 `meta` 对象；(b) 假后端 `GET /meta` 二十五个字段，三个数跟着 `PUT /config` 保存的值走；(c) 管线监控页只提供不超过 `monitorMaxRangeDays` 天的时间范围按钮（24 小时一档始终在，读不到按原来的 7 天）；(d) 任务配置页的筛选和新建/编辑对话框的类型取自 `taskTypes`（读不到或为空按原来的三个，不认识的类型显示代码，任务自己的类型始终可选）；(e) 额度类功能值（权益的功能值和功能开关默认值）：输入框旁写"最大值：N"，超过不发请求，读不到不预检；(f) 严格校验：`mock/auth.mock.test.ts` 的"恰好 25 个字段"和类型测试，`getAdminMeta` 的测试里有 `googlePlayPackageName` 为 `null` 的一例。**`GET /me` 的 `roleIds`**：这是请求 19 的那一组在做（工作区里 `src/services/auth/index.ts` 的 `Me`、`mock/auth.mock.ts`、`mock/auth.mock.test.ts` 的"七个字段"断言已有，我提交时还没提交，不是我的改动，我没有碰） | b72a7d6：`src/services/auth/index.ts:105-116`（类型）、`mock/_core/meta.ts:32`（假后端）、`src/utils/metaValues.ts`（三个取值函数）、`src/pages/monitor/pipeline.tsx:64`（这几行当时被别组的提交 b82f345 带进去了，见第三节第 2 条）、`src/pages/activity/taskConfig.tsx:44`、`src/pages/activity/TaskFormModal.tsx:77`、`src/pages/subscriptions/FeatureValueEditor.tsx:43`、`gates.tsx:72`、`entitlements.tsx:74`、`featureRules.ts:111`；测试 `src/pages/subscriptions/limitMax.test.tsx`、`src/pages/activity/taskTypes.test.tsx`、`src/pages/monitor/pipeline.test.tsx`（"monitorMaxRangeDays"）、`src/utils/metaValues.test.ts`、`mock/auth.mock.test.ts` |
| 114 推送记录的日期筛选 | 第三节 114 号行；接口文档 2381 行：`from`、`to`（UTC 日，含首尾，各自可省略），错误 `details` 的 `ref` 规则 | 记录页加日期范围筛选，用共用的 `DateRangeUtc` 并把 400 传给它的 `refused`；原有筛选不变 | 已改。"只看创建日期在某个范围内的记录（UTC）"复选框，默认关闭，勾上后出现 `DateRangeUtc`（默认最近 7 天），按"查询"才发，重置会关掉；页面总是两端一起发（共用控件总有两端）；400 指向 `from` 或 `to` 时写在日期控件下面，不显示后端 `message`。假后端按文档：`from` 先查，`to` 早于 `from` 时 `ref` 一律是 `to`，空串当作省略。真实浏览器里看过：勾上后请求带 `from=…&to=…`。`push.records.filter.note` 那句"后端不能按日期"的话已改 | cd1ab6a：`src/pages/push/records.tsx:46`、`:310`、`mock/push.mock.ts:532`、`src/services/push/types.ts:199`；测试 `src/pages/push/recordsDate.test.tsx`、`mock/push.records.mock.test.ts`、`src/services/push/push.test.ts`、`src/pages/push/records.test.tsx` 里原来那条"没有日期"的断言 |

## 二、没做和没运行

没做 2 处，都是任务说明里要求交给别的目录的人做的，写在 `docs/contract-requests/2026-11-03-new-differences-c5.md` 第 5 节（提交 34477c2）：

1. 素材宽高比的容差改读 `useAdminMeta().creativeAspectTolerancePercent`：在广告目录（`src/pages/ads/creatives.tsx`、`mediaSpec.ts`），我不碰。类型、`useAdminMeta`、假后端已提供这个字段。广告那一组的提交 b0954f9 已让素材表单读 `GET /ads/meta` 的同名字段（`src/services/ads/index.ts:120`），两处是同一个值，所以这一条实际上不需要再有人做。
2. 商店链接预检改用 `useAdminMeta().googlePlayPackageName`（`src/pages/appVersions/storeUrl.ts` 一带）：在应用版本目录，我不碰。字段已提供，值为 `null` 时没有可预检的包名，交给后端。

没运行 2 项：

1. 全量测试和生产构建：按项目约定在全部任务做完后由主会话跑一次。我只跑了相关目录（见下）。
2. 对着真实后端联调（`npm run dev:api`）：没有真实后端；所有 `details` 的路径下标从几起、`provider`、`model`、`effectiveFrom` 的 `ref` 都是按最小做法定的（见差异文件第 1 节）。

## 三、运行了什么

- 相关快速测试：`src/pages/cost`、`src/services/cost`、`mock/cost.mock.test.ts`、`src/services/campaign`、`mock/campaign.mock.test.ts`、`src/pages/campaign/accounts.batch.test.tsx`、`src/pages/push`、`src/services/push`、`mock/push.mock.test.ts`、`mock/push.records.mock.test.ts`、`src/pages/monitor`、`src/pages/activity`、`src/pages/subscriptions`（五个相关文件）、`src/utils`、`src/locales`、`src/services/auth`、`mock/auth.mock.test.ts`、`src/session`。结果见下面第 4 节。
- `npx tsc --noEmit`：整个项目 0 错误（提交后跑的）。
- `biome check`：我碰过的文件 0 诊断（每次提交的钩子也跑了）。
- 变异检查（故意改坏代码，新测试必须变红，改完已恢复）：`bandsDetails` 的第一档必须从 0（`mock/cost.mock.ts`）；`listUsageModels` 不发 `hasActivePrice`；`batchCosts` 丢掉 `overwritten`；`monitorMaxRangeDaysOf` 的默认值；`valueProblem` 的上限比较（`>` 改 `>=`）；推送假后端 `to` 早于 `from` 的检查和 `to` 的上界；记录页不发 `from`、`to`；管线页不按范围过滤；任务页不读 `taskTypes`；订阅默认值页不传上限；`BatchModal` 不用 `overwritten`。全部变红。
- 真实浏览器：Playwright Chromium 对着复制出来的开发服务器（`max dev` 加假后端，用完已按进程号停掉、副本已删）：价格表单的字段下提示（文字、`aria-describedby`、表单上方的句子）、模型页签勾选后的请求（`hasActivePrice=false`，3 行）、推送记录的日期范围请求（`from=2026-10-28&to=2026-11-03`）。只在英文、深色主题、1400 宽下看过，没看中文、浅色和手机宽度（中文的文字由测试覆盖）。

## 四、测试结果

- 最后一次相关目录的合并运行（机器上同时有很多别人的测试在跑，负载 8 到 10）：71 个文件、1955 个用例，1939 通过、16 失败。16 个失败全部是超时，不是断言不成立：15 个在 30 到 53 秒处超时（这些用例各自写死 30 秒，或用默认 5 秒），1 个在 5.6 秒处。负载降到 3 到 5 以后逐个重跑：`accounts.batch.test.tsx` 整个文件 35 过 1 失败，那一条（默认 5 秒超时）单独重跑通过；`prices.test.tsx` 整个文件 101 过 2 失败，两条单独重跑都通过（其中"stops at the number of bands"一条加二十档很慢，在提交前的旧版 `ManualTab.tsx` 上要 27 秒，我的第一版要 30 秒以上，a631122 之后 23 秒）；另外两条不是我的文件里的用例（`src/pages/activity/signinConfig.test.tsx` 的"a new form after an edit starts empty"、`src/pages/push/templates.test.tsx` 的"updates the matrix when a template is added"）单独重跑也都通过。
- `npx tsc --noEmit` 整个项目 0 错误；`src/locales/parity.test.ts` 有一条中英占位符一致的检查在我跑的时候因别组还没提交完的 `push.templates.defaultCase.*` 失败，之后 5ee63b2 已修，与我的键无关。
- 假后端的两个新用例文件 `mock/push.records.mock.test.ts`（10 条）、`mock/cost.mock.test.ts`（39 条）、`mock/auth.mock.test.ts`（60 条，含二十五个字段）、`src/utils/metaValues.test.ts`（6 条）、`src/pages/subscriptions/limitMax.test.tsx`（8 条）、`src/pages/activity/taskTypes.test.tsx`（5 条）、`src/pages/push/recordsDate.test.tsx`（8 条）全部通过。

## 五、需要说一声的事（别的组的提交和我的改动互相带进去）

1. 提交 b72a7d6（请求 67）里带进了 `src/locales/zh-CN/system.ts` 的 32 行，是系统管理那一组还没提交的改动，我的清单里没有这个文件；我没法解释它怎么进来的（我用的是单独的暂存区，钩子是 lint-staged 加暂存文件的类型检查，没有绕过）。它的英文对应文件 `src/locales/en-US/system.ts` 那一组还没提交，所以在那一组提交之前，仓库里这两个语言文件暂时不对称（有一条检查中英占位符一致的测试会因别组的 `push.templates.defaultCase.*` 和这个而失败，不是我的键）。
2. 别组的提交 b82f345（请求 103，管线监控）把我写的 `src/pages/monitor/pipeline.tsx` 的几行（读 `monitorMaxRangeDays`）和 `pipeline.test.tsx` 里我写的几条测试一起带进去了，那时 `src/utils/metaValues.ts` 还没提交，提交 b72a7d6 补上。
3. 提交 b72a7d6 里的 `src/pages/activity/TaskFormModal.tsx` 带进了活动组紧挨着我改动的几行（`row?.hasRecords`、去掉一行 `extra`），它们依赖活动组还没提交的 `TaskConfig.hasRecords` 类型；活动组提交之后就一致了。
4. 计划里我改的几句（任务 13 管线页的时间范围、任务 25 的批量导入提示、任务 26 的确认对话框和模型页签、任务 22 的记录页日期筛选、任务 11 的额度上限）被记忆组的提交 24fe845 带进去了，没有单独成提交。
5. 假后端 `mock/subscriptions.mock.ts` 把权益额度的上限写死为 1000000，没有跟着 `entitlement.limit_max` 变（那是订阅组的文件，我没改；写在差异文件第 5 节）。
6. 我把一个空文件 `/tsc3.out` 误写到了文件系统根目录（重定向时少了变量），想删但删除被安全检查拒绝了，需要你删。

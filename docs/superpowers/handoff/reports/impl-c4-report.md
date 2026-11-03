改了 5 处（请求 37、40、122、47、92）、没做 1 处（任务配置单条读取没有加前端读取函数）、没运行 3 项（全量测试、真实浏览器走查、对着真实后端联调）、阻塞 0

# c4 组报告：任务配置 hasRecords、广告位读取与广告元数据、应用版本的 409 和 400

分支 `claude/jolly-dirac-4pq9g6`。后端实现说明指 `docs/backend-inputs/2026-11-03-avatar-backend-admin-change-requests-implemented.md`，更新接口文档指 `docs/backend-inputs/2026-11-03-backend-task-java-backend-updated.md`。

## 一、对照表

| 请求 | 后端实现说明怎么说 | 前端要改什么 | 状态 | 提交和位置 |
|---|---|---|---|---|
| 37 任务配置 `hasRecords` | 第三节 37 号行（`GET /tasks/configs` 每项、`GET /tasks/configs/{id}`、`POST`/`PUT`/`PUT status` 的返回都带布尔 `hasRecords`；带未改的 `taskType`、`targetValue` 的 `PUT` 不算改动，不会 409）；更新接口文档第 4255 行 | 类型加 `hasRecords`；有记录时编辑对话框直接把类型和目标值设为只读并写明原因，不再等 409；列表行里“删除”置灰并在行内写“已有任务记录：不能删除，请改用停用”；每条任务都先写一句“已有记录则不能改”的旧提示去掉；假后端同步 | 已改 | `4c7a0df`。`src/pages/activity/TaskFormModal.tsx:80`（只读来自 `row.hasRecords`）、`:129`（收到 409 时退回已存的值并重读列表）；`src/pages/activity/taskConfig.tsx:88`（删除置灰）、`:215`（行内说明）；`src/services/activity/types.ts:93`；`mock/activity.mock.ts:158-161`（各接口都带 `hasRecords`）、新增 `GET /tasks/configs/:id`；语言文件 `activity.task.hasRecordsRow`，删除 `activity.task.form.hasRecordsNote` |
| 40 广告位读取权限、`creativeAspectTolerancePercent` | 第二节第 8 条、第三节 40 号行；更新接口文档第 3717 行 | 假后端让 `ADS:CREATIVE` 能读 `GET /ads/placements`（写入权限不变）；`GET /ads/meta` 加 `creativeAspectTolerancePercent`；素材页的容差改读 `GET /ads/meta`（原来读系统配置，只有 `ADS:CREATIVE` 的管理员读不到）；容差读不到时不比较宽高比（原来用猜的 3%），短边和大小仍按规格预检 | 已改 | `b0954f9`。`mock/ads.mock.ts`（`PLACEMENT_READ` 加 `ADS:CREATIVE`，meta 路由）；`src/services/ads/index.ts:117`（`getAdsMeta`）；`src/pages/ads/creatives.tsx:66`；`src/pages/ads/mediaSpec.ts`（去掉默认 3%） |
| 122 `notSkippableFullScreenCount` | 第三节 122 号行（对任一 `ADS:*` 开放；与保存时的 `AD_FORCE_CLOSE_DISABLED` 同一个条件）；更新接口文档第 3717 行 | 广告位页常驻警告改读这个计数：`ads.force_close_seconds` 为 0 且计数大于 0 时显示，所以只有 `ADS:PLACEMENT` 的管理员也看得到；不再翻遍所有单元和素材去数；计数读不到时写明“没能核对”，不静默；假后端的计数和保存时警告用同一个函数 | 已改 | `b0954f9`。`src/pages/ads/AdsWarnings.tsx:43-46`；`mock/_core/adsData.ts`（`notSkippableFullScreenCount`）、`mock/config.mock.ts`（保存警告改用它）；语言文件 `ads.placements.warn.forceCloseUnknown` 改成“刚才没能核对”（不再说缺 `ADS:CREATIVE`） |
| 47 版本 409 的 `data.status` | 第二节第 7 条、第三节 47 号行；更新接口文档第 150 行、3924 行 | 按 `data.status` 逐值提示：`DISABLED` 渠道已停用，`DRAFT`/`ACTIVE`/`ARCHIVED` 写出版本当前状态，`CONSUMED` 说明上传已被使用并要求重新上传；其他值、不是文字、`data` 缺失仍是通用的 `error.INVALID_STATE`；不读 `CHANNEL_DISABLED`、`UPLOAD_USED`；用在版本表单、激活对话框、列表上的删除和下线；假后端的 409 都带状态 | 已改 | `bc38f1a`。`src/pages/appVersions/failureText.ts:13`（`invalidStateText`）、`:30`（`describeVersionFailure`）；`VersionModal.tsx`、`ActivateModal.tsx`、`versions.tsx` 都改用它；`mock/appVersions.mock.ts:43`（`invalidState(status, …)`，渠道关闭是 `DISABLED`） |
| 92 版本写接口 400 的 `details` | 第三节 92 号行；更新接口文档第 112 行、3926 行 | 版本表单按 `ref` 逐字段提示：`channelCode`、`versionName`、`versionCode`、`minVersionCode`、`storeUrl` 在各自表单项下；`changelog` 在更新说明区；`changelog.<语言>` 放在那种语言的页签下，页签带标记并转到第一个被拒绝的语言，改了文字就撤掉那条原因，没有页签的语言写在页签下面；对不到表单项的（`apkUploadId`、`status`、`confirmStoreLive`）写成带字段名的一行，`confirmStoreLive` 写成“请勾选确认”；不认识的原因显示原因码；三类 `data` 为 `null` 的 400（激活时对已存 APK 文件的检查、`upload.public_base_url` 未配置、检查期间 APK 被改动）只显示通用句，不读 `details`；假后端按契约的原因码返回（`versionName` 为 `INVALID_FORMAT`，链接类原因，`changelog.<语言>`），并有一个触发“已存 APK 文件检查失败”的开关 | 已改 | `bc38f1a`。`src/pages/appVersions/VersionModal.tsx:132`（`splitRefusal`）、`ChangelogField.tsx`、`ActivateModal.tsx`、`failureText.ts:56`（`refusalLine`）；`mock/appVersions.mock.ts:95`（`storeUrlReason`）、`:372`（`storedFileFault`）；`mock/_core/appVersionsData.ts` |

47 和 92 两条在同一个提交里，40 和 122 也在同一个提交里：两对改的是同一个函数、同一批文件（`getAdsMeta`、版本对话框、假后端的版本接口），按条拆开要拆开同一个函数里的几行，拆出来的两半都不能单独通过测试。

另有文档提交 `5ecf207`：`docs/contract-requests/2026-11-03-new-differences-c4.md`（五节，后端没写清、前端按最小做法的细节）和开发计划里自己条目的四处措辞（任务配置、广告素材预检、版本号 400）。

## 二、没做和没运行

- **没做 1**：`GET /tasks/configs/{id}` 没有加前端读取函数。页面不读单条（列表项已带 `hasRecords`），加了会是没人用的函数；假后端已有这个接口并带 `hasRecords`，将来要用时只加一个函数。
- **没运行 3**：
  1. 全量测试和构建（按项目约定放到全部任务做完后跑一次）。
  2. 真实浏览器（Playwright Chromium）走查：机器负载一直在 12 到 30（4 核，同时跑着别的组的测试），没有起 `dev:mock`。以下几处只靠页面测试验证，没在真实浏览器里看过：更新说明的页签带标记并转到被拒绝的语言、任务列表行里“删除”下面的小字在窄屏的排版、`zh-CN` 下的几句新文字。
  3. 对着真实后端联调（`dev:api`）。
- 语言覆盖：新增断言的界面文字是 en-US 和 zh-CN 各测了一遍（版本 409/400、行内说明）；数据里的多语言只在已有的假数据（泰语、阿拉伯语、印尼语等的任务名和更新说明）和 `changelog.zz-ä` 这样的非 ASCII 语言键上出现，新增的拒绝用例的数据多数是英文，所以数据的多语言覆盖只是部分。

## 三、跑过的测试

全部在本组涉及的目录里跑，`--testTimeout=60000`，一次一个文件组（机器负载高时同时跑多个文件会有 30 秒的单个用例超时，和代码无关，分开重跑都过）：

- 任务配置：`src/pages/activity`（`taskConfig`、`taskTypes`、`failureLanguage`、`taskRecord`、`signinRecord`、`signinConfig`）、`src/services/activity`、`mock/activity.mock.test.ts`：全部通过。
- 广告：`src/pages/ads/placements.test.tsx`、`creatives.test.tsx`、`units.test.tsx`、`mediaSpec.test.ts`、`src/services/ads`、`mock/ads.mock.test.ts`、`mock/config.mock.test.ts`：全部通过。
- 应用版本：`src/pages/appVersions` 下 `versions.refusals.test.tsx`（新增 45 个）、`versions.form`、`versions.activate`、`versions.upload`、`versions.test`、`messages`、`failureLanguage`，`src/services/appVersions`，`mock/appVersions.mock.test.ts`：全部通过。
- 扫描和一致性：`tests/noHardcodedText.test.ts`、`src/session/storedFailureText.test.ts`、`src/components/actionsColumn.test.tsx`、`src/hooks/ownCounters.test.ts`、`src/hooks/revalidateCoverage.test.ts`、`src/utils/fieldReasons.scan.test.ts`、`src/locales`（语言文件对称）通过；`check:routes`、`check:codes`、`check:config-keys` 通过。
- `tsc --noEmit`：本组涉及的文件 0 错误（整个仓库当时还有别的组改到一半的文件报错，不是本组的）。`biome check`：本组涉及的目录 0 诊断。提交钩子（lint-staged 和暂存文件的类型检查）三次都通过。

**变异检查**（改坏代码，新测试必须变红，改完已还原）：
- 任务配置：把只读判断改成只看 409、把删除置灰改成不置灰：3 个新用例变红。
- 广告：把计数改成恒为 `null`、把容差改成恒为 `null`：4 个新用例变红。
- 广告位读取权限和计数：把假后端的 `PLACEMENT_READ` 去掉 `ADS:CREATIVE`、把计数写死成 0：2 个假后端用例变红。
- 应用版本：测试先写后改（假后端和页面改完之前，新用例按旧行为是红的：第一轮跑 25 个失败，修了测试里一个粘贴位置的错误后才转绿）。

## 四、决定（没有规格依据，按通行做法定的）

- 删除按钮置灰并在行内写原因，不放悬停提示（与 2026-10-27 决定里“禁用按钮的原因写成行内小字”一致）。
- 容差读不到时只跳过宽高比，不跳过短边和大小：计划写的是“读不到规格或容差时不预检”，规格读不到时整个不预检，容差读不到时只有宽高比依赖它。
- 假后端对没有逐项写明的 400 情形（版本号不大于其他版本、各种更新说明错误、商店链接的包名不符等）的 `ref` 和 `reason` 是推断的，全部列在 `new-differences-c4.md` 第 1 节，页面只读返回的 `ref` 和 `reason`，不依赖这些推断。
- 假后端 `POST /tasks/configs` 不带 `status` 时是已启用，接口文档 4255 行写缺省为已停用；这是遗留的不一致，没有在这次改（只涉及 `hasRecords`），写在 `new-differences-c4.md` 第 3 节。
- 假后端里广告上传“已被使用”的 409 原来写的是 `USED`，改成契约的 `CONSUMED`（页面本来就不看这个值）。

## 五、没有改的别人的东西

没有改 `docs/shared-snapshots/`；没有碰 `GET /meta` 相关的文件（请求 67 另一组）；`mock/config.mock.ts` 只改了保存警告里数素材的那几行（改用同一个函数）。

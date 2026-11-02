改了 4 处、没做 0 处、没运行 2 项、阻塞 0

# 组 b3 报告：第二节第 6、8、12、13 条

新版接口文档指 `docs/backend-inputs/2026-11-02-backend-task-java-backend-e07469d1.md`。新版里查不到的细节在
`docs/contract-requests/2026-11-02-new-differences-b3.md`（6 项，当前都按最小的做法开发，不阻塞）。

| 条目 | 新版接口文档怎么说（行号） | 状态 | 提交与位置 |
|---|---|---|---|
| 6 订阅多一列 `periodOrderId` | 1990 行：`Subscription` 多 `periodOrderId`（可空，当前计费周期的商店订单标识）；2451 行：详情返回全部列，列表项是 `Subscription` 的列 | 已改。类型加字段；详情抽屉新增一行“当前计费周期订单号”，用 `plainText`，空显示“—”，任何文字（泰语、阿拉伯语）原样、数字也写成文字；假后端的列表和详情都带它（待处理的订阅为 null） | `3e97a8d`：`src/services/subscriptions/types.ts:73`、`src/pages/subscriptions/SubscriptionDrawer.tsx:149-162`、`mock/_core/subscriptionsData.ts:51,263`、两种语言文件 `subscriptions.detail.periodOrderId`；测试 `src/pages/subscriptions/list.test.tsx`（空、多文字、非字符串三例）、`mock/subscriptions.mock.test.ts`；计划任务 11 的类型一句 |
| 12 签到活动写入的响应 | 4231 行：`PUT /checkin/activities/{id}` 与 `…/status` 返回 `{applied, disabledActivities:[{id,name}], activity:<详情>\|null}`；4229 行：`applied:false` 才是重叠探测，确认后 `confirm=true` 执行并停用它们 | 已改。`probeActivityOverlap` 先看 `applied`：`true` 是已写入（返回 null，即使列表非空，不再询问）；`false` 才是询问（列表可为空）；没有布尔 `applied` 的不合契约的答案才退回看列表。服务层的写入函数有了响应类型 `ActivityWriteReply`。`ActivityFormModal` 的“普通保存没写入就继续探测”原来就按 `applied === false`，只去掉强转。假后端所有写入都按新形状答（写入后带当前详情，探测时 `activity:null`，确认时列出被停用的活动） | `5c4eff3`：`src/services/activity/index.ts:92-112`、`types.ts`（`ActivityWriteReply`）、`src/pages/activity/ActivityFormModal.tsx:156-160`、`mock/activity.mock.ts:136-146,258-300`；测试 `src/services/activity/activity.test.ts`、`mock/activity.mock.test.ts`、`src/pages/activity/signinConfig.test.tsx`（通过假后端把写入答成 `applied:true` 且带名单，页面不弹询问）；计划任务 24 一句 |
| 13 应用版本号规则 | 3926 行：创建、编辑草稿且版本号改动时，必须大于该渠道其他所有版本（含 DRAFT、ARCHIVED）的最大版本号；激活时必须大于所有生效过的版本（ACTIVE、ARCHIVED）的最大版本号；重复 409 先于大小 400；3930 行：激活检查顺序是状态 409、`confirmStoreLive` 400、版本号 400、渠道停用 409；后端的回答第 47 条：大小比较的 400 只有 `message`，没有 `details` | 已改。旧规则（严格大于当前生效版本）全部换掉：表单读该渠道全部版本（`readChannelVersions`，分页读完），新建要大于最大的、编辑草稿要大于除自己以外最大的，号码没改不比较；激活对话框用 ACTIVE、ARCHIVED 的最大值（草稿不算，没有生效版本但有下线版本时也提示），读取失败退回页面列表；提示文字和规则文字两种语言都说明“其他所有版本（含草稿、已下线）”“生效过的版本（含已下线）”。假后端：重复 409，再大小 400（无 `details`），再渠道停用 409（创建）；激活时确认商店可见、版本号、渠道停用的顺序；编辑未改号码不比较。`useActiveVersion` 换成 `useChannelVersions` | `c725091`：`src/pages/appVersions/versionRules.ts:42-75`（`checkVersionCode`、`highestOtherCode`、`highestLiveCode`）、`VersionModal.tsx:190-197,268-270`、`ActivateModal.tsx:57-63`、`useChannelVersions.ts`、`src/services/appVersions/index.ts`（`readChannelVersions`）、`mock/appVersions.mock.ts:112-135` 起、两种语言文件；测试 `versionRules.test.ts`、`versions.form.test.tsx`、`versions.activate.test.tsx`、`appVersions.test.ts`、`mock/appVersions.mock.test.ts`；计划任务 29 |
| 8 照片里的人投诉 | 1635 行：`assetIds` 不是数组或为空 `EMPTY_NOT_ALLOWED`；超过 20 个、重复（大小写不同的同一 UUID 也算）、元素不是 UUID 字符串 `OUT_OF_RANGE`；找不到的形象 404 `RESOURCE_NOT_FOUND`（`details` 每个 ID 一项）；已结案 409；1631 行：改成当前状态同样 409 `INVALID_STATE`，`note` 不得含控制字符（含换行），顺序 404、400、409 | 已改。页面：形象 ID 输入框最多 20 个（再多的不保留并写明）、大小写不同的同一 UUID 只留一个、不是 UUID 的指名说明并禁用删除、不发请求；状态下拉里当前状态灰掉，按钮也不发同状态；备注含控制字符（含按回车产生的换行）不发请求并写明原因；失败只显示按码翻译的文字，404 的每个 ID 单独一行（ID 加原因文字）；失败条放在抽屉顶部，因为投诉被别人结案后操作区会消失。假后端按文档检查和排序，成功时删除形象；它的样本形象 ID 原来不是合法 UUID（最后一段 16 位），改成真正的 UUID | `b6006db`：`src/pages/complaints/assetIds.ts`（新）、`ComplaintDrawer.tsx:158,189,355`、`mock/complaints.mock.ts:167` 起、`mock/_core/avatarData.ts`（`uuid` 辅助）、两种语言文件；测试 `src/pages/complaints/likeness.test.tsx`、`mock/complaints.mock.test.ts`；计划任务 14 一条；请求文件 `docs/contract-requests/2026-11-02-new-differences-b3.md` |

## 验证

- 红再绿：第 6 条（先写测试，看到列表键、抽屉两处红）、第 12 条（9 个红）看到了红再改。第 13、8 条的测试先写完，但没有单独跑出红就接着改了代码，这两条靠下面的变异检查证明测试有牙。
- 变异检查：12 去掉按 `applied` 的判断，3 个测试红；13 激活的最大值把草稿也算进去，3 个红，编辑时号码没改也比较，1 个红；8 去掉大小写合并、20 个上限、当前状态灰掉，4 个红；6 去掉“—”，1 个红。每次都恢复了。
- 通过：`src/pages/subscriptions`、`src/services/subscriptions`、`mock/subscriptions.mock.test.ts`（260）；`src/services/activity`、`mock/activity.mock.test.ts`、`src/pages/activity`（244）；`src/pages/appVersions`（169）、`versionRules`、`src/services/appVersions`、`mock/appVersions.mock.test.ts`（101）；`src/pages/complaints`、`src/pages/avatar`、`src/services/complaints`、`mock/avatar.mock.test.ts`、`mock/complaints.mock.test.ts`、`src/locales`（930，含两种语言对称）；`tests`（107，含禁止写死文字扫描）、`src/pages/users/detailTabs.test.tsx`。`npx tsc --noEmit` 无报错，改过的文件 `biome check` 0 诊断；提交前钩子都通过。
- 多语言：假数据和测试含泰语、阿拉伯语、越南语、西班牙语、印尼语（活动名）、英语、中文；订单号、备注用泰语、阿拉伯语、中文、表情。

## 没运行的 2 项

1. 真实浏览器（Playwright Chromium + dev:mock）看一遍四个页面：没做，只有 happy-dom 里的页面测试，没有真实浏览器的排版和键盘验证。
2. 全量测试和构建：按约定留到全部任务做完后由主会话跑一次。

## 要主会话知道的

- 提交方式：计划文件里同时有别的组的改动，所以每次提交用私有索引，只放自己的文件和计划里自己的那一段（`git apply --cached` 同效），再把自己路径在真实索引里复位；没有碰别人的文件，也没有绕过钩子。
- 第 8 条把假后端样本形象 ID 改成合法 UUID，会影响所有用这些 ID 的页面测试，已跑 `src/pages/avatar`、`src/pages/users/detailTabs`、`mock/avatar`，都通过。
- 第 13 条的版本号比较失败只有 `message`，没有 `details`（回答第 47 条），页面因此只显示通用的“请求不合法”；我已在请求文件第 4 项建议后端补 `details`。

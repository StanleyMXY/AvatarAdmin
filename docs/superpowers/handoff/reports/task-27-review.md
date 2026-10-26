立即修 1、记录 9、变更 1、不是缺陷 10、阻塞 0

# 任务 27（应用内广告）独立评审

评审对象：提交 `15c5983`、`1f5eead`（分支 `claude/jolly-dirac-4pq9g6`）。依据：`CLAUDE.md`、`execution-conventions.md`、`module-task-brief.md`、任务 27 任务书（`bash docs/superpowers/handoff/brief.sh 27`）、规格 5.17 和 5.0（`docs/shared-snapshots/admin-frontend-design.md`）、契约 §22 全节（`backend-task-java-backend.md`）、`docs/backend-inputs/` 四份文件。只读本仓库；没有改任何源文件，没有提交，没有起开发服务器。变异和临时测试都在 `git archive 1f5eead` 解出的拷贝里做（scratchpad 下的 `t27r/app`，`node_modules` 是链接，`src/.umi` 是复制的）。

评审深度：页面、报表、新增测试，按 `CLAUDE.md` 做一次独立评审；任务书点名的"上传先于创建、已通过的素材不可编辑、按钮权限、弹窗再次打开"用变异检查验证。

## 一、结论

- 立即修 1 条：广告位页常驻的两条警告（`ads.skip_after_seconds` 过大、`ads.force_close_seconds` 为 0）只在页面载入时读一次配置。保存以后它们不跟着变：把值改回合规并保存，"倒计时过长"的警告仍挂在页面上（已用临时测试复现，见"立即修 A"）。
- 规格 5.17 和任务书逐句对照（见二）：其余每一句页面都做了，没有发现"规格写了、页面没有"的元素。
- 变异检查：实现者报告的 53 个里，我独立重做了 17 个，结论全部一致；另加我自己想的 20 个，共 37 个，34 个变红，3 个存活。存活的三个都是测试缺口，被变异的页面代码本身是对的（记录 1、2、3）。
- 实现者报告写"`npx biome check` 对本模块没有诊断"与事实不符：现在有 34 条警告（记录 4）。
- 整个项目 `npx tsc --noEmit`（拷贝里）0 个错误；`src/locales` 的语言文件测试和 `tests/noHardcodedText.test.ts`（在拷贝里 `git init` 之后）通过；本模块 12 个测试文件 329 个测试在拷贝里全部通过。

## 二、规格 5.17、任务书、契约 §22 的逐句对照

"页面"一列是读代码得到的（文件在 `src/pages/ads/`）；"验证"一列写用什么确认过。编号 R、N、Q 是第四节的变异。

| 要求 | 页面做了什么 | 验证 |
|---|---|---|
| 每个广告页顶部可折叠的投放检查清单，五层按顺序；游客只有 `app_open`、`call_end` | `Checklist.tsx` 在五个页面顶部，默认展开；五层，加"去广告权益、激励次数用完"一条、游客一条 | R17（四层）变红 |
| 计划列：名称、状态、优先级、起止时间、创建人、更新时间；筛选名称、状态 | `campaigns.tsx` 列和筛选一致；创建人用 `createdByUsername`，没有时显示 id 前 8 位 | 读码 |
| 计划表单：名称、描述、优先级（默认 100）、起止时间、结束不得早于开始 | `CampaignModal.tsx`；结束早于开始才拦、相等允许；未改的时间原样回传，清空发 `null` | R3 变红 |
| 计划状态按钮激活、暂停、恢复、结束，行内确认；已结束不可编辑 | `campaigns.tsx` 每个状态按钮都有 `confirmText`；已结束没有编辑 | R1、R2 变红 |
| 计划删除只对草稿或已结束且没有单元；到期自动结束的标注 | 能读到单元时，有单元的计划删除灰掉并写明原因；顶部 Alert 和结束时间列的图标说明自动结束 | R4 变红 |
| 广告位列：键、形式、名称、启用开关、频控、冷却（激励为"—"）、奖励额度、素材规格（只读）；不能新增删除 | `placements.tsx` 的列、`PlacementModal.tsx`；没有新增和删除入口 | 读码 |
| 激励广告位频控不能为 0，表单直接标注；奖励额度必须大于 0；旁边显示"频控 × 奖励额度" | `PlacementModal.tsx` 校验、`placementRows.ts` 的 `dailyMax`；表里和表单里都有，表单里随输入变 | R5、R6 变红 |
| 全局设置 `<ConfigForm editPermission="ADS:PLACEMENT" />` 九个键，第十个 `ads.log_retention_days` 不显示也不警告 | `placements.tsx:187` | R7 变红 |
| 三条提示：总开关默认关、联调时频控冷却可改 0 测完改回、频控按展示计数 | `placements.tsx` 顶部 Alert 三条 | 读码和现有测试 |
| 警告：`ads.skip_after_seconds` 大于 5；`ads.force_close_seconds` 为 0 且开屏或插屏下存在不可跳过素材；不阻止保存，读取 `warnings` | 保存时 `ConfigRow` 行内显示后端 `warnings`；页面常驻警告由 `AdsWarnings.tsx` 数素材 | R8、N5、Q12 变红；**常驻警告不随保存更新，见立即修 A** |
| 单元列：名称、所属计划、广告位、状态、权重、单元日上限、定向摘要；权重 ≥ 0，0 表示不会被选中 | `units.tsx`、`UnitModal.tsx`；权重 0 标"不会被选中" | Q5 变红 |
| 定向编辑器：平台、国家、系统最低版本、App 最低版本、语言、时段列表（用户本地时间）；空 = 不限 | `TargetingEditor.tsx`、`targeting.ts`：空键不发送，编辑时清空的键发 `null`；`day_parts` 为 `[{start,end}]`、`H:mm`；说明写"游客按 UTC""开始晚于结束表示跨午夜""留空表示不限" | N8 变红；N4 存活（记录 2） |
| `geoConfigured=false` 时国家旁提示 | `TargetingEditor.tsx` 的 `geoConfigured === false` | 读码（实现者的变异 17 我没有重跑） |
| 单元的计划和广告位选项来自两个接口，403 时选择器禁用并写明缺哪个权限 | `Picker.tsx` | 读码 |
| 单元状态：草稿 → 投放中 ⇄ 暂停，激活、暂停、恢复先问；删除只给草稿 | `units.tsx` | Q8 变红 |
| 素材列：缩略图、所属单元、类型、语言、审核状态、投放状态、权重；两个状态分开显示 | `creatives.tsx`；投放状态只有已通过的有开关，别的"—" | 读码 |
| 先上传再创建，提交只带 `uploadId`，不带地址、尺寸、大小、时长、类型 | `CreativeModal.tsx` 的 `fields` 加 `adUnitId`、`uploadId`；类型、尺寸、大小、时长在 `Descriptions` 里只读 | R10 变红 |
| 上传前检查类型 JPEG / PNG / MP4、大小 `adMediaMaxBytes`、图片像素 `adImageMaxPixels`、视频没有像素检查，限制来自 `useAdminMeta()` | `AdMediaUpload.tsx` 调共用的 `checkUploadFile('adMedia', …)` 和 `describeUploadLimits` | R11 变红 |
| 503 `DEPENDENCY_UNAVAILABLE` 时控件旁提示先设置 `upload.public_base_url`；`CONFIG:MANAGE` 才有到 `/config` 的链接 | `CreativeModal.tsx` 的 `onFailed`；`/config` 是 `config/routes/config.ts:8` 的真实路径 | R12 变红 |
| 规格不符时给出原因（比例、较短边、大小；容差读配置，读不到用 3%） | `mediaSpec.ts`，比例按相对误差 | N6 变红 |
| 已通过的素材没有编辑、删除，只有暂停，提示"要换内容请新建一条，再暂停旧的"；权重说明 | `creatives.tsx` 操作列、顶部 Alert | R9 变红 |
| 拒绝必须填备注；通过前先问 | `ReasonModalForm`（1 到 500 个码点）；`approveAsk` | Q7 变红 |
| 开屏或插屏选"不可跳过"出现政策警告，不阻止；激励阈值 5..30、视频不超过时长、不能清空；`IN_APP_ROUTE` 目标是下拉；原生广告位标题和按钮文字必填 | `CreativeModal.tsx` | 读码；Q10 存活（记录 3） |
| 报表筛选：UTC 日期（默认 7 天）、平台、渠道（全部、各渠道码、`unknown`），"全部"不传；六个接口都带 | `report.tsx` | N2、R15、Q11 变红 |
| 落地条 `ad-daily`；导出 `ads-report` 带页面上相同筛选 | `LandBar name="ad-daily"`、`ExportButton` 用已点查询的筛选 | Q6 变红 |
| 14 张卡片（含游客展示、没有独立用户），每张带公式图标，比率两位小数百分比，分母为 0 显示"—" | `ReportCards.tsx` 14 张，顺序与规格一致 | R14 变红；N1 存活（记录 1） |
| 一张折线图（展示与点击）加按日明细 | `TrendChart` 两个系列、同一纵轴，缺的日子补 0；明细表五列 | N3 变红 |
| 无广告原因表四列（日期、广告位、原因、次数），11 种原因都有本地化说明，写明合计的范围 | `report.tsx`；中英文各 11 条 | 读码；语言键一致由语言测试守 |
| 四个下钻页签共用一张表，切到哪个才读哪个 | `DrillTable.tsx`、`report.tsx` | 读码（实现者的变异 41 我没有重跑） |

其余合规项：`.tsx` 里没有写死的界面文字（只有"–"、`placeholder="13"`、`"1.2.0"` 这类示例字面量，文字扫描通过）；没有调试日志；被审核内容的地址（`mediaUrl`、`thumbnailUrl`）只放进 `<img src>`，不写日志、不进链接（`Thumb.tsx` 只画 `https://` 和 `data:image/`）；源码、注释、标识符里没有参照项目名或其他第三方产品名（只有规格逐字要求的警告文字里的"Google Play"，见不是缺陷 8）；本模块没有凭据类字段（自建广告，没有广告网络的密钥或令牌），"写入不回显"不适用；权限：写按钮都用各页自己的码（计划 `ADS:CAMPAIGN`、广告位 `ADS:PLACEMENT`、单元 `ADS:UNIT`、素材 `ADS:CREATIVE`），读别的资源（选项）用对方接口自己的权限，403 时降级；导出要 `STATS:EXPORT` 加 `ADS:REPORT`，落地条要 `STATS:LAND`（共用组件）。

文字内容也核对过：长字串（阿拉伯语、泰语、emoji、5000 字符无空格）在表格里用 `EllipsisPopoverText` 或 `overflowWrap: anywhere`，表单里的固定文字用 `overflowWrap: anywhere`；后端给的字段显示前都过 `plainText`，没有把非字符串直接当 React 子节点的地方（我 grep 过 `{row.xxx}` 一类写法，没有）。

## 三、发现

### 立即修（1）

**A. 广告位页的常驻警告不随保存更新，改回合规值后警告还挂着**
- 位置：`src/pages/ads/AdsWarnings.tsx:46-70`（`useEffect` 只依赖 `placements`、`canReadCreatives`，只在载入时读一次 `listConfig()`）；`src/pages/ads/placements.tsx:186`（`<AdsWarnings placements={data} />`）。
- 触发步骤：打开广告位页，`ads.skip_after_seconds` 当前是 8，页面出现"倒计时过长有违反 Google Play 广告政策的风险"。把它改成 5 并点保存（后端已存成 5，`ConfigRow` 行内的后端警告消失）。
- 错误结果：页面上方的警告仍在，要刷新整页才消失。我在拷贝里写了临时测试复现：保存后等 500 ms，`saved.get('ads.skip_after_seconds').value === 5`，而 `ads-placements-warnings` 仍然存在（输出 `saved value=5; standing warning still shown=true`）。反方向同样：存成 8 以后常驻警告不出现，只有行内那一条（实现者的记录项 2 只写了这个方向）。`ads.force_close_seconds` 走同一个读取，同样。
- 为什么是立即修：规格 5.17 写的是"`ads.skip_after_seconds` 填大于 5 的值时显示警告……`ads.force_close_seconds` 为 0 而……存在'不可跳过'的素材时，同样警告"，条件已经不成立，警告还在，是输出错误（说了一句已经不成立的话，而且说的是商店政策风险）；带着它上线，运营改好配置后仍看到警告，可能反复去查，也可能把它当成永远在的噪声而忽略下一次真实的警告。
- 修法：`ConfigForm` 加可选的 `onChanged`（实现者"需要改共享文件"第 2 条已提出），广告位页收到后让 `AdsWarnings` 重新读；这是共享文件，由主会话或地基任务改。修好后要带的测试：值从 8 存成 5 后警告消失；`ads.force_close_seconds` 存成 0 后出现、存回 15 后消失。

### 记录（9）

1. **测试缺口：报表比率的分母没有被逐个守住。** `src/pages/ads/ReportCards.tsx:36`、`DrillTable.tsx:110`（以及完播率、可见率、可测量率、平均观看时长）。触发：我把点击率的分母从 `totals.impressions` 改成 `totals.starts`，`report.test.tsx` 35 个测试全部通过（变异 N1）。若真是这个错：纯图片广告（`starts` 为 0、`impressions` 大于 0）的点击率会错误地显示"—"。现有零分母测试只覆盖"所有数都是 0"和"所有数都正常"，没有"只有一个分母为 0"。五个比率的卡片和下钻列都该各有一条。页面代码现在是对的。
2. **测试缺口：去掉最后一个时段时 `day_parts` 发 `null` 没有被守住。** `src/pages/ads/targeting.ts:92-99`（`KEY_OF`）、`targeting.test.ts`。触发：我把 `dayParts: 'day_parts'` 改成 `dayParts: 'dayParts'`，`targeting.test.ts` 12 个测试通过（变异 N4）。若真是这个错：编辑单元、删光时段后，请求里没有 `day_parts: null`，后端按 Merge Patch 保留旧时段，运营以为取消了。其余五个键有这条测试，时段没有。页面代码现在是对的。
3. **测试缺口：换到非激励广告位后，隐藏的激励阈值要被丢掉，没有测试守。** `src/pages/ads/CreativeModal.tsx:211`（`showReward && typeof values.rewardAfterSeconds === 'number' ? … : null`）。触发：我去掉 `showReward &&`，`creatives.test.tsx` 70 个测试通过（变异 Q10）。若真是这个错：先选激励单元、填阈值，再换成原生单元，字段隐藏了，请求仍带 `rewardAfterSeconds`，非激励素材带上激励阈值。页面代码现在是对的。
4. **实现者报告写"`npx biome check` 对本模块没有诊断"，实际有 34 条警告。** 例：`src/pages/ads/creatives.test.tsx:21`（`uploadModule` 导入未使用，`noUnusedImports`）；`mock/ads.mock.ts:257,263,275,284`（`useOptionalChain`）；`units.test.tsx`、`placements.test.tsx`、`report.test.tsx`、`creatives.test.tsx`、`campaigns.test.tsx`、`mock/ads.mock.test.ts` 里 29 处 `noNonNullAssertion`。都是警告，提交钩子不拦，不影响正确性；命令：`npx biome check --max-diagnostics=100 <本模块路径>`。报告里"没有诊断"要改。
5. **单元删除被拒时的提示不对症。** `src/pages/ads/units.tsx:143-146`。触发：删除一个名下有素材的草稿单元。结果：先问一次，再看到"当前状态不允许这个操作"（`error.INVALID_STATE`），但单元就是草稿，真实原因是名下有素材。实现者记录项 6 写"预判要读素材，需要另一个权限"，与契约不完全一致：§22.9 写 `GET /ads/units/{id}` 返回"单元及其素材的只读列表"，权限是 `ADS:UNIT`，所以持有 `ADS:UNIT` 的管理员可以在点删除时先读详情再决定；但素材列表的字段名两处文件都没有写，要先补进问题文件第一节再做。目前按"后端拒绝后显示译文"处理，不算错，只是提示不准。
6. **广告位表在每次保存或拨开关之后整块消失再重建。** `src/pages/ads/useRead.ts:22`（`reload` 先 `setData(null)`）、`placements.tsx:194`（`data ? <Table/> : null`）、`placements.tsx:68`。触发：在广告位表里拨一个启用开关，或保存广告位对话框。结果：`onDone` → `reload`，整张表换成 `Spin` 再重建；开关的键盘焦点丢失，表格滚动位置回到顶部；`AdsWarnings` 还因为 `placements` 变成 `null` 再变回来而重读三个接口（配置、单元、素材）。不影响数字正确。
7. **契约 §22.3 的单元字段 `surfaces`（按 `X-Platform`、`X-Channel` 限定，空数组表示所有端）页面没有显示，问题文件也没有提。** `src/services/ads/types.ts` 的 `AdUnit` 没有这个字段，`summarizeTargeting` 不含它。触发：别处（或后端迁移）创建了 `surfaces` 为 `["ANDROID"]` 的单元，列表"定向"列显示"不限"，而选取时 iOS 请求按 `TARGETING_MISS` 排除。§22.9 的 `PUT /ads/units/{id}` 只改四个字段，规格 5.17 没有这一项，所以不是页面少做了规格里的东西；缺的是问题文件里该问一句（后端是否在列表响应里带 `surfaces`、`POST` 是否接受，要不要在后台显示）。按 `CLAUDE.md`，契约的缺口写问题文件。
8. **共用控件副本（实现者记录项 1 和 5）：维护风险的判断。** `src/pages/ads/AdMediaUpload.tsx`（210 行）与 `src/components/UploadField.tsx` 逐行几乎相同，差别只有 `onStart`、`onFailed`、去掉了预览图。共用控件以后在文件检查、限制文字、取消逻辑上的任何修复，这份不会跟着改；任务书写的是 `UploadField kind="adMedia"`，以后读代码的人会以为用的是共用的。另有一批小文件在别的模块里各有一份：`uploadSlot.ts`、`UploadBox.tsx`（形象、推送）；`useServerPage.ts`、`PagedTable.tsx`、`FailureBar.tsx`（投放）；`useLatestRead.ts`（成本）；`useRead.ts`（数据分析、投放、邀请、用户）；`texts.ts`、`formFailure.ts`（活动、形象、投放、推送）；它们之间已经有差异（我只用 `diff` 粗略比较过，没有逐行核对）。判断：现在不是错误；`UploadField` 加可选的 `onFailed`、把 `UploadBox` 的样式修到共用组件里是共享文件的小改动，做完删 `AdMediaUpload.tsx` 和 `UploadBox.tsx`；其余副本建议按实现者说的移到共用目录后删。
9. **实现者的"需要改共享文件"第 3、4 条我核对属实，同意记录。** `src/pages/config/ConfigRow.tsx:72`：对没有字段明细的 `INVALID_REQUEST`，译文后面接后端 `message`，与"错误只显示译文"不一致（触发：广告位页给一个键存一个被后端以 `INVALID_REQUEST` 且无明细拒绝的值，译文后面多一段后端英文）；`mock/config.mock.ts` 的 `warningsFor` 只有 `AD_SKIP_AFTER_TOO_LONG`，没有 `AD_FORCE_CLOSE_DISABLED`（触发：开发用假后端把 `ads.force_close_seconds` 存成 0，行内没有警告）。两处都是共享文件，由主会话处理。

### 变更（1）

**补数响应里的 `nofillSkipped` 没有告诉运营。** `src/components/stat/LandBar.tsx`（共享）、`src/services/stats/land.ts`（`landStat` 丢掉了响应）。契约 §22.8、§22.12：对早于最近 7 个 UTC 日的日期补 `ad-daily`，后端只重算 `StatAdDaily`，在响应里写 `nofillSkipped=true`，"无广告原因"表这一天不变。现在页面提示"已重新落地某日"，运营会以为无广告原因表也重算了。规格 5.17 和任务书只写"落地条 `ad-daily`"，没有写这条提示，所以这是新增行为，不是遗留项，要先给负责人确认设计要点：落地成功后若响应带 `nofillSkipped=true`，追加一句"无广告原因表没有重算（早于最近 7 天）"；需要改共享的 `landStat`（返回响应）和 `LandBar`（按名称给出额外说明）。

### 不是缺陷（10）

1. 计划优先级没有下限和上限（`CampaignModal.tsx` 的 `InputNumber precision={0}`）：契约和规格都没有给范围，问题文件第六节已经问了后端；非整数、空值已经拦住。
2. 新建单元时已结束的计划选项是灰的（`UnitModal.tsx:223-226`）：已结束的计划不可编辑、不再投放，往里加单元没有用；这是页面的保守做法，不会出错。
3. 国家定向用"输入两位国家码回车"的标签框，不是带国家名的下拉（`TargetingEditor.tsx`）：规格写"国家多选"，标签框是多选；大写转换、去重、格式检查都有。我另用临时测试确认：输入 `TH` 后不按回车直接点别处，`TH` 也会被收进列表（`GEO [["TH"]]`，语言框同样），不会悄悄丢掉。
4. 折线图里展示和点击在同一条纵轴（`report.tsx`）：规格 5.17 写"折线图（展示与点击）"，没有写双轴；点击远小于展示时线贴近底部，是呈现问题，不是数字错误。
5. 常驻"强制关闭为 0"警告的数法（`AdsWarnings.tsx:15-27`）不数已拒绝的素材、数草稿和已暂停的：规格只写"存在不可跳过素材"，实现者已在问题文件第四节写明口径并问了后端；没有 `ADS:CREATIVE` 的管理员得到不带数字的警告。
6. "素材弹窗再次打开"的测试在页面修好之后才加（报告："素材的同样测试随后加入"）：我把 `creatives.tsx` 改回旧写法（弹窗一直挂着）后，该测试变红（变异 Q1），计划、单元、广告位同样（Q3、Q2、Q4）。测试有效，缺的只是"先红后绿"的记录，没有影响。
7. 四个弹窗"只在打开时挂载"的修复：计划、广告位、单元、素材都改成了 `editing !== null ? <Modal open …/> : null`；定向编辑器和素材弹窗里的上传槽（`useUploadSlot`、`AdMediaUpload` 的 `key`）都在弹窗里面，随弹窗一起重新创建，所以没有同样的残留值；拒绝备注用共享的 `ReasonModalForm`（没有 `initialValues`，关闭后重置为空）。本模块带 `initialValues` 的 `Form` 只有这四个。
8. 警告文字里的"Google Play"：规格 5.17 和任务书逐字要求的警告文字，不是第三方产品名的使用；除此之外源码、注释、标识符里没有广告网络或参照项目的名字（我 grep 了 `dramabox`、`dramaverse`、`admob`、`applovin`、`facebook`、`appsflyer`、`tiktok` 等）。
9. 读不到广告位的管理员（只有 `ADS:CREATIVE`）在素材弹窗里没有政策警告和原生必填检查（`CreativeModal.tsx`）：契约没有给 `ADS:CREATIVE` 读广告位的权限（后端回复第 9 条的表），页面写明"没法对照规格，以服务器的检查为准"，激励阈值字段照样显示；问题文件第三节已经问了后端，不是页面少做。
10. 未知警告码时弹窗用后端的 `message`（`ads.creatives.warning.UNKNOWN`）：只在后端发了前端没有译文的警告码时才出现；已知的两个码（`AD_NOT_SKIPPABLE`、`AD_SKIP_AFTER_TOO_LONG`）都有两种语言的译文。

### 阻塞（0）

没有。

## 四、变异检查（我自己做的，在拷贝里，每个变异只跑守这条判断的测试，跑完还原）

脚本：scratchpad 的 `t27r/t27r-mutate.py`（R、N）、`t27r-mutate2.py`（Q）；日志 `t27r-mut.log`、`t27r-mut2.log`。命令形如 `npx vitest run --bail 1 <测试文件>`，以退出码判定（变红 = 被杀死）；Q 组的日志里带着变红的测试名，我看过变红的 11 个，测试名都与被变异的判断相关。跑完核对过拷贝与共享检出 `src/pages/ads` 一致。

| 编号 | 变异 | 结果 |
|---|---|---|
| R1 | 计划写按钮对所有人显示 | 变红 |
| R2 | 已结束的计划可编辑 | 变红 |
| R3 | 结束早于开始被接受 | 变红 |
| R4 | 有单元的计划仍可删（不灰掉） | 变红 |
| R5 | 激励广告位频控 0 被接受 | 变红 |
| R6 | 每天最多额度乘改成加 | 变红 |
| R7 | 全局设置显示所有键（去掉 `editPermission`） | 变红 |
| R8 | 跳过警告阈值 > 5 改成 >= 5 | 变红 |
| R9 | 已通过的素材可编辑（操作列渲染条件） | 变红 |
| R10 | 创建请求带 `mediaUrl` | 变红 |
| R11 | 上传前不检查 | 变红 |
| R12 | 没有 `CONFIG:MANAGE` 也有 `/config` 链接 | 变红 |
| R13 | 不上传文件也能提交 | 变红 |
| R14 | 比率分母 0 不显示"—" | 变红 |
| R15 | 渠道筛选不发 | 变红 |
| R16 | 旧回答盖新回答（报表） | 变红 |
| R17 | 检查清单只有四层 | 变红 |
| N1 | 点击率分母改成视频开始播放 | **存活**（记录 1） |
| N2 | 平台"全部"也发 `platform=ALL` | 变红 |
| N3 | 折线图去掉点击系列 | 变红 |
| N4 | `day_parts` 清空时的键名写错 | **存活**（记录 2） |
| N5 | 强制关闭警告在 0 条素材时也出现 | 变红 |
| N6 | 宽高比容差改成绝对误差 | 变红 |
| N7 | 编辑素材时多发 `adUnitId` | 变红 |
| N8 | 时段空行也发送 | 变红 |
| Q1 | 素材弹窗改回一直挂载的旧写法 | 变红（"再次打开"测试） |
| Q2 | 单元弹窗改回旧写法 | 变红 |
| Q3 | 计划弹窗改回旧写法 | 变红 |
| Q4 | 广告位弹窗改回旧写法 | 变红 |
| Q5 | 单元权重允许负数 | 变红 |
| Q6 | 导出用没点查询的草稿筛选 | 变红 |
| Q7 | 通过素材不先问 | 变红 |
| Q8 | 激活单元不先问 | 变红 |
| Q9 | 广告位保存时连没改的字段也发 | 变红 |
| Q10 | 非激励素材也发激励阈值 | **存活**（记录 3） |
| Q11 | 无广告原因表不带筛选 | 变红 |
| Q12 | 强制关闭警告在值不为 0 时也出现 | 变红 |

37 个里 34 个变红、3 个存活。实现者报告里的 53 个我重做了对应的 17 个（它的编号 1、2、3、8、9、11、13、14、22、25、26、28、33、34、36、40、43），结论都与它一致；它说"第一轮存活的'已通过的素材能编辑'已改成会变红"，我重做后确实变红（R9）。其余 36 个它的变异我没有重做，不能背书。

## 五、对实现者报告的核对

- "做了什么"的表格与代码一致；五个页面的路由、权限码、列、筛选与规格 5.0 和 5.17 一致；提交 `15c5983` 的 53 个文件都在本模块路径内，没有碰共享文件。
- "需要改共享文件"四条：1（`UploadField` 加 `onFailed`）、3、4 属实；2（`ConfigForm` 加 `onChanged`）它放在记录项 2，我升为立即修（A）。
- "规格需要在 main 上修改的地方"三条：前两条与契约 §22.9、§22.10 一致；第三条（单元状态是否要确认）规格确实没写。
- 报告开头"立即修未修 0、记录项 7"：按我的核对应为立即修未修 1、记录项 9、变更 1。
- 真实浏览器检查：我没有起开发服务器，不能重现；它写的条目与代码一致，没有发现矛盾。

## 六、我没有做、没查清的

- 没有在真实浏览器里点过页面（任务书不允许起开发服务器）。"弹窗只在打开时挂载"修复我用把旧写法放回去、看测试变红的办法验证，没有在真实浏览器里重现原来的缺陷。
- 没有对着真后端；没有跑全量测试。
- 我第一次一次性跑本模块 12 个测试文件时，输出顶部出现过一行 `Error: connect ECONNREFUSED 127.0.0.1:3000`，329 个测试全过。之后把 9 个测试文件逐个单独重跑，没有一个再出现这行；我没查清它从哪里来，不作为发现。

## 主会话复核（处理结果）

评审的立即修 1（保存全局设置后，页面常驻的两条警告不更新）成立，已修：共用的 `ConfigForm` 加了可选属性 `onChanged`（保存或重置一项之后调用），广告位页用它让 `AdsWarnings` 重新读取配置值。新测试在 `ads.skip_after_seconds` 为 8 时有警告，保存为 5 后警告消失，再保存为 9 后警告出现；去掉 `ConfigForm` 里调用 `onChanged` 的那一行后变红。这是对共享文件 `ConfigForm` 的一处向后兼容的小改（属性可选，原有调用方不受影响）。

其余记录项（测试缺口 3 条、biome 警告 34 条、单元删除被拒时的提示、广告位表整块重建、`surfaces` 未显示、本地副本、`ConfigRow.tsx:72`、共用假后端缺警告）进批量修复。变更 1 条（补数响应的 `nofillSkipped` 要不要告诉运营）等负责人确认。

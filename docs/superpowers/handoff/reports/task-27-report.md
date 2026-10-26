立即修未修 0、记录项 7、未运行 4、阻塞 0。

# 任务 27 报告：应用内广告

环境：Node 24.22.1，分支 `claude/jolly-dirac-4pq9g6`。提交：`15c5983`（服务、假后端、五个页面、定向编辑器、路由、文字、测试、问题文件），本报告所在的提交（浏览器检查后修正：弹窗只在打开时挂载，加三条测试）。本模块 12 个测试文件共 329 个测试；加上语言文件的两边键一致检查和文字扫描，一次跑 16 个文件 743 个全部通过。`npx biome check` 和整个项目的 `npx tsc --noEmit`（0 个错误）对本模块没有诊断；没有 `hardcodedText.allow.json`（扫描没有需要放行的条目）。

## 做了什么

五个页面，路由取规格 5.0"应用内广告"五行，每页顶部都有可折叠的"投放检查清单"（五层条件按顺序列出，另有"去广告权益、激励次数用完"和"游客只有 `app_open`、`call_end`"两条说明）：

| 路由 | 权限 | 内容 |
|---|---|---|
| `/ads/campaigns` 计划 | `ADS:CAMPAIGN` | 列名称、状态、优先级、开始时间、结束时间、创建人、更新时间；按名称、状态筛选；新建、编辑（已结束的计划没有编辑）；激活、暂停、恢复、结束都先问一次；删除只给草稿或已结束的，能读到单元的管理员看到有单元的计划删除是灰的并写明原因；结束时间旁和表上方标注"到期后端自动结束"；时间按浏览器时区输入，编辑时没改的时间原样回传，清空的时间发 `null` |
| `/ads/placements` 广告位与全局设置 | `ADS:PLACEMENT` | `<ConfigForm editPermission="ADS:PLACEMENT" />`（浏览器里数到 9 个键，页面上没有 `ads.log_retention_days`，也没有关于它的警告）；总开关默认关闭、联调时可把频控和冷却改成 0 测完改回、频控按展示计数的三条提示；`ads.skip_after_seconds` 大于 5、`ads.force_close_seconds` 为 0 且开屏或插屏下有不可跳过素材时的常驻警告（保存时行内显示后端 `warnings`，不阻止保存）；四个预置广告位的表（没有新增、删除；启用开关立即提交；激励广告位冷却显示"—"、频控不能是 0；"每账号每天最多通过广告得到 = 频控 × 奖励额度"在表里和表单里都有，表单里随输入变化）；素材规格只读 |
| `/ads/units` 单元 | `ADS:UNIT` | 列名称、计划、广告位、状态、权重（0 标"不会被选中"）、单元日上限（0 写"不限"）、定向摘要；四个筛选；新建、编辑（计划和广告位创建后只读）；激活、暂停、恢复先问；删除只给草稿；计划和广告位选择器读 `GET /ads/campaigns`、`GET /ads/placements`，收到 403 时禁用并写明缺哪个权限；`GET /ads/meta` 的 `geoConfigured=false` 时国家旁写"地理定向尚未配置，设置了也不会匹配"；`TargetingEditor`（平台、国家、系统最低版本、App 最低版本、语言、时段列表，时段按用户本地时间，开始晚于结束标"跨午夜"，每个字段自己说错在哪，后端指到的字段显示在字段下面） |
| `/ads/creatives` 素材 | `ADS:CREATIVE` | 列缩略图、所属单元、类型、语言、审核状态、投放状态（只有已通过的有开关，别的显示"—"，两个状态分开）、权重；五个筛选；新建先上传文件（`POST /ads/media`）再填表，提交只带 `uploadId`，服务器读出的类型、尺寸、大小、时长和缩略图只读显示，并对照广告位规格给出"符合"或"不符合"和原因（比例、较短边、大小）；上传前检查类型、大小、图片像素（视频没有像素检查）；上传返回 503 时写"先在系统配置里设置 `upload.public_base_url`"，只有 `CONFIG:MANAGE` 的管理员带到 `/config` 的链接；点击动作三种（网址只收 https，应用内页面是九个页面标识的下拉，深度链接是文字）；开屏或插屏选"不可跳过"显示政策警告（不阻止）；激励阈值 5 到 30、视频不超过时长、编辑时不能清空；原生广告位标题和按钮文字必填；通过（先问）、拒绝（备注必填）；已通过的素材没有编辑和删除，只有暂停开关，并写"要换内容请新建一条，再暂停旧的"，页面顶部解释权重和 A/B 测试；保存后后端的 `warnings` 显示出来 |
| `/ads/report` 广告报表 | `ADS:REPORT` | UTC 日期范围（默认 7 天）、平台、渠道（全部、`GET /channels` 的渠道码、`unknown`），都传给六个报表接口，"全部"不传；落地条 `ad-daily`；导出 `ads-report`（带页面上搜索时的筛选）；14 张卡片（含游客展示、没有"独立用户"），每张带说明公式的图标，比率两位小数的百分比、分母为 0 或数不对一律"—"；一张折线图（展示和点击两条线，缺的日子补 0）加按日明细；四个页签（按广告位、计划、素材、国家）共用一张表，切到哪个才读哪个；"无广告原因分布"表四列（日期、广告位、原因、次数），十一个原因都有两种语言的说明，旁边写明它是全部平台、全部渠道的合计或筛选范围内的合计 |

文件：
- 服务：`src/services/ads/{index,types,ads.test}.ts`
- 页面：`src/pages/ads/` 下 `campaigns`、`placements`、`units`、`creatives`、`report`，对话框 `CampaignModal`、`PlacementModal`、`UnitModal`、`CreativeModal`，`TargetingEditor` 和纯函数 `targeting`、`mediaSpec`、`reportFigures`、`placementRows`，`AdMediaUpload`、`Checklist`、`AdsWarnings`、`ReportCards`、`DrillTable`、`Picker`、`Thumb`，以及本地的小件（见记录项 5），各自的测试和 `testSetup.ts`
- 假后端：`mock/ads.mock.ts`、`mock/ads.mock.test.ts`、`mock/_core/adsData.ts`（状态挂在 `globalThis`，`resetAdsStore` 重置）、`mock/_core/adsReport.ts`（报表数字由同一个函数算出，总数、按日、四张表彼此对得上）
- 路由和文字：`config/routes/ads.ts`、`config/routes/ads.test.ts`、`src/locales/{zh-CN,en-US}/ads.ts`
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-ads.md`

## 与任务书和规格的出入

1. 规格写素材表单"再填类型……时长"；契约 §22.9 写明类型、尺寸、大小、时长全部取自上传记录，所以这几项只读显示（见问题文件第九节第 1 条）。
2. 上传控件没有直接用 `UploadField`：共用控件不把上传失败告诉页面，而 503 时页面必须在控件旁写提示。`AdMediaUpload` 做的是同样的事（同一份限制、同一个 `checkUploadFile`、同样的文字），多一个 `onFailed`（见"需要改共享文件"）。
3. 页面常驻的"强制关闭为 0 且存在不可跳过素材"警告要自己数素材（读单元和素材）；口径（不数已拒绝的）是我定的，已写进问题文件第四节。没有 `ADS:CREATIVE` 的管理员得到不带数字的警告。
4. 素材表单在读不到广告位（只有 `ADS:CREATIVE`）时不能对照规格、不知道广告位形式，页面写明并交给后端（问题文件第三节）。
5. `DEEP_LINK` 契约里有、规格没写：做成文字输入，只检查非空和 2048 字符。
6. 计划的删除：规格"只允许草稿或已结束且名下没有单元"，我把"没有单元"对两种状态都要求（契约字面如此）。

## 红到绿

先写测试，确认因"功能不存在"而红（`Failed to resolve import …` 或路由数组为空），再实现，再绿。命令都是 `npx vitest run <文件>`（先 `export PATH=$HOME/.local/node24/node_modules/.bin:$PATH`）。输出留在 `/tmp/claude-0/-home-user-AvatarAdmin/430adf2a-3186-5642-af52-8b3912cf69c3/scratchpad/task27/` 的 `red-*.txt`、`green-*.txt`。

| 文件 | 红 | 绿 |
|---|---|---|
| `src/services/ads/ads.test.ts` | `Failed to resolve import "./index"` | 16 |
| `mock/ads.mock.test.ts` | `Failed to resolve import "./_core/adsData"` | 47 |
| `config/routes/ads.test.ts` | 路由数组为空，4 个断言失败 | 5 |
| `src/pages/ads/campaigns.test.tsx` | `Failed to resolve import "./campaigns"` | 37 |
| `placements.test.tsx` | `Failed to resolve import "./placements"` | 40 |
| `targeting.test.ts` | `Failed to resolve import "./targeting"` | 12 |
| `TargetingEditor.test.tsx` | `Failed to resolve import "./TargetingEditor"` | 13 |
| `units.test.tsx` | `Failed to resolve import "./units"` | 37 |
| `mediaSpec.test.ts` | `Failed to resolve import "./mediaSpec"` | 7 |
| `creatives.test.tsx` | `Failed to resolve import "./creatives"` | 70 |
| `reportFigures.test.ts` | `Failed to resolve import "./reportFigures"` | 10 |
| `report.test.tsx` | `Failed to resolve import "./report"` | 35 |

后加的两处红：
- "弹窗再次打开"的三条测试（计划、广告位、单元）先在旧写法上红了（3 failed），改成弹窗只在打开时挂载后绿（`red-reopen.txt`、`green-reopen.txt`）；素材的同样测试随后加入。
- 删除计划的"有单元时不提供"是在初版全绿之后加的行为（先改测试再改页面）。

最终一次：`npx vitest run src/pages/ads src/services/ads mock/ads.mock.test.ts config/routes/ads.test.ts src/locales tests/noHardcodedText.test.ts` → 16 个文件 743 个测试全部通过（`final-run.txt`）。

## 真实浏览器检查

Playwright（Chromium，浏览器时区 `Pacific/Auckland`，en-US，然后 zh-CN）对着 `PORT=8327` 的 `npm run dev:mock`，在 `scratchpad/task27/app` 的一份拷贝里跑（拷贝里的 `config/config.ts` 关了 MFSU、换了缓存目录，`node_modules` 是链接，`src/.umi` 一起复制；没有路由指向不存在的页面）。脚本 `t27-browser.cjs`、日志 `t27-browser.log`、截图 `t27-*.png` 在同一目录。服务按监听进程的 PID（19539，检查了它的工作目录是我的拷贝）停掉，端口 8327 已空。看到的：

- 菜单"应用内广告"下五个页面。检查清单五条，折叠后层列表隐藏、再点开。
- 计划：结束早于开始被拦；`2031-03-04 21:45`（新西兰时间）发出的是 `2031-03-04T08:45:00.000Z`；创建、激活、暂停、结束、删除各一个请求；有单元的已结束计划删除是灰的并写明原因。
- 广告位：9 个配置键、没有 `log_retention`；开关一个请求；激励广告位频控填 0 被拦，"每账号每天最多……"随输入变成 `4 × 15 = 60`，保存只发 `{"frequencyCap":4,"rewardCredits":15}`；`ads.skip_after_seconds` 存 8，行内出现后端警告，重载后页面常驻警告出现；`force_close_seconds` 存 0 后重载，常驻警告写"有 1 条没有跳过的素材"；设置已恢复默认。
- 单元：新建时国家旁有地理提示；`THA`、`13.x` 各自在字段下面说错在哪，提交被拦；改对后创建，请求里 `targeting` 只有填了的键；激活、暂停；编辑时 iOS、国家、系统版本、时段都恢复，去掉国家后请求里是 `"geo":null`。
- 素材：十张缩略图全部解码成功；不出现原生"选择文件"框；GIF 和声明 20000×20000 的 PNG 在上传前被拦（媒体请求数 0）；把 `POST /ads/media` 拦成 503 后出现提示和 `/config` 链接；上传 1080×1920 的 PNG 后显示类型、尺寸、大小、时长和符合规格；创建请求是 `{"clickAction":…,"uploadId":"up-000001",…}`，没有地址、尺寸、大小；"不可跳过"出现政策警告，保存后后端的警告也出现；MP4 显示 12 秒；通过先问、拒绝备注为空被拦、带泰语阿拉伯语 emoji 的备注保存后显示在行里；已通过的行只有暂停开关和"要换内容……"。
- 报表：14 张卡片，折线图画出（1 个 canvas），三张表的表头与规格一致；筛选平台 Android、渠道 `unknown` 后，三个接口都带 `platform=ANDROID&channelCode=unknown`；导出文件名 `ads-report-2026-10-20-2026-10-26.xlsx`，导出请求带同样的筛选；重新落地提示 `Re-landed 2026-10-25`。
- 390 像素宽：五个页面都没有页面级横向滚动。zh-CN：表头是中文，没有把语言键当文字显示出来。
- 控制台：只有登录第一步的 401 和我故意拦成 503 的上传，没有别的错误。
- **发现并已修一个缺陷**：编辑单元时定向（iOS、国家……）是空的。原因：四个对话框一直挂在页面上，`Form.useForm` 的数据在关闭再打开之间留着（关闭动画结束时的重置把"新建"的初值留在了表单里，盖住下一次的 `initialValues`）；happy-dom 从不触发关闭动画的结束事件，所以单元测试看不到。改成只在打开时才挂载对话框，并加了"先新建再取消、再编辑"的测试（计划、广告位、单元、素材各一条，先红后绿）。

## 变异检查

脚本 `t27-mutate.py`，日志 `mutations.log`、`mutate-run1.out` 到 `mutate-run3.out`。每个变异改一处判断，只跑守这条判断的测试文件（`--bail 1`），确认变红再还原。53 个，全部被杀死（红）。第一轮活下来两个，处理如下：

- "计划对话框连按提交发两次"（以及广告位、单元、素材的同类）：初版测试在表单校验未结束时连点，antd 把重叠的校验合并成一次提交，所以没有守卫也只发一个请求。改成"点一次、等请求在途、再触发一次表单提交（相当于再按回车）"，并在所有"连按"测试里先等一小段再数请求；之后四个都变红。
- "已通过的素材能编辑"：我改的那一处在列表里永远走不到（已通过的行在操作列里直接换成提示文字），是等价变异；换成改操作列的渲染条件后变红。

变异清单（结果都是变红）：计划写按钮对所有人显示；已结束的计划可编辑；结束早于开始被接受；清空的时间不发 `null`；删除对运行中的计划也给；结束不先问；连按提交发两次；有单元的计划仍可删；广告位激励频控 0 被接受；奖励 0 被接受；每天最多额度乘改成加；没有 `ADS:PLACEMENT` 开关仍可点；全局设置显示所有键；跳过警告阈值改成 5；原生广告位的素材被算进强制关闭警告；单元权重 0 被拒；未知时也显示地理提示；清空的定向键不发 `null`；编辑单元时发计划；国家不转大写；单元删除对所有状态给；已通过的素材可编辑；所有素材都有投放开关；拒绝不带备注；创建请求带文件地址；上传前不检查；503 提示不出现；没有 `CONFIG:MANAGE` 也有链接；激励阈值下限改成 1；阈值可超过视频；政策警告对所有广告位出现；后端拒绝的上传编号被保留；不上传文件也能提交；分母 0 不显示"—"；百分比一位小数；渠道筛选不发；导出换成别的报表；落地换成别的汇总；未判定可视可为负；旧回答盖新回答（报表）；页签永远读按广告位；旧一页盖新一页（列表）；检查清单只有四层；开关连按发两次（广告位、素材各一）；以及假后端的五个（激励频控 0、已通过的素材可改、已结束的计划可改、上传可用两次、渠道码不检查）。

## 覆盖的语言

界面只有 zh-CN 和 en-US：每个页面各有一个中文渲染测试（表头、按钮、说明），两边键相同由语言文件的检查守住，en-US 里没有中日韩字符。假数据和测试含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文：计划名称和描述、单元名称、素材标题、广告主、拒绝备注、报表里的计划名称；另有 300 个字母无空格的名称、5000 个泰文字符的名称和备注（表格里用 `EllipsisPopoverText`，测试断言 `overflow-wrap: anywhere`；表单里 5000 字的标题能填入）、emoji、阿拉伯语加 emoji 的备注、新西兰时区下的时间转换。只覆盖英文的部分：对话框里各字段的校验文字（中文只看了渲染没逐条点）。

## 问题文件

`docs/contract-requests/2026-10-26-admin-frontend-ads.md`：列表和对象的形状、各写接口的请求体（含三个状态接口、审核接口、`targeting` 是整体替换还是嵌套的 Merge Patch）、只有 `ADS:CREATIVE` 的管理员读不到广告位和容差、"强制关闭为 0"警告的口径、删除计划和单元被拒时的错误、长度范围格式、`targeting` 校验失败时 `details` 的 `ref`、报表的几个细节、规格需要改的三处。没有一处是阻塞。

## 需要改共享文件

1. `src/components/UploadField.tsx`：加可选的 `onFailed(error)`（返回 `true` 表示页面自己说这个失败），页面才能在 503 时写"先设置 `upload.public_base_url`"；同时在 antd 表单里原生"选择文件"框会露出来（`hidden` 被表单样式盖掉，形象、推送模块已报告过，本模块的 `UploadBox` 是第三份副本）。改好后删 `src/pages/ads/AdMediaUpload.tsx` 和 `UploadBox.tsx`。
2. `src/pages/config/ConfigForm.tsx`：加可选的 `onChanged`，保存或重置后通知页面。现在广告位页的常驻警告只在载入时读一次配置，保存 `ads.skip_after_seconds` 后要重载才出现（行内的后端警告是马上出现的）。
3. `src/pages/config/ConfigRow.tsx` 第 72 到 73 行：对没有字段明细的 `INVALID_REQUEST` 把后端 `message` 接在译文后面，与"错误码已知时只显示译文"不一致（任务 25 报告已写过，广告位页的 9 个键同样受影响）。
4. `mock/config.mock.ts` 的 `warningsFor`：只有 `AD_SKIP_AFTER_TOO_LONG`，没有 `AD_FORCE_CLOSE_DISABLED`；开发用假后端保存 `ads.force_close_seconds` 为 0 时行内没有警告（浏览器检查里 `force row:` 为空）。本模块的测试用 `overrideFetch` 补了这个回答。

## 规格需要在 main 上修改的地方

1. 5.17 素材表单：类型、尺寸、大小、时长由上传记录给出，只读（现在写的是"再填类型……时长"）。
2. 5.17 广告位页："渲染 `ads.*` 键"应写成"`ADS:PLACEMENT` 的全部键（9 个）"，第十个 `ads.log_retention_days` 属于 `CONFIG:MANAGE`，只在系统配置页。
3. 5.17 单元状态：写明激活、暂停、恢复是否要确认（页面按和计划一致先问一次）。

## 记录项（7）

1. `src/pages/ads/AdMediaUpload.tsx` 和 `UploadBox.tsx`：共用 `UploadField` 的副本，见"需要改共享文件"第 1 条。触发：以后共用控件改了限制文字或检查，这份不会跟着变。
2. `src/pages/ads/AdsWarnings.tsx`（读配置的 `useEffect`）：常驻警告只在载入时读一次。触发：在广告位页把 `ads.skip_after_seconds` 存成 8，行内立刻有后端警告，页面常驻那一条要重载才出现。
3. `src/pages/config/ConfigRow.tsx:72`：见"需要改共享文件"第 3 条。触发：广告位页保存一个没有字段明细的错误值。结果：译文后面多一段后端英文。
4. `mock/config.mock.ts` 的 `warningsFor`：见"需要改共享文件"第 4 条。
5. 本模块有一批共用事情的本地副本：`useServerPage.ts`、`PagedTable.tsx`、`FailureBar.tsx`（来自 `pages/campaign/`）、`useLatestRead.ts`（`pages/cost/`）、`useRead.ts`、`texts.ts`、`formFailure.ts`、`uploadSlot.ts`、`UploadBox.tsx`（形象、推送、投放、成本模块各有同样的）。不是错误，是重复；建议移到共用目录后删副本。
6. `src/pages/ads/units.tsx`：单元的删除对草稿都给按钮，名下有素材时才由后端拒绝（预判要读素材，需要另一个权限）。触发：删除一个有素材的草稿单元。结果：先问一次、再看到"当前状态不允许这个操作"。计划页能预判（读得到单元时灰掉）。
7. `src/pages/ads/AdsWarnings.tsx` 里"强制关闭为 0"的数素材口径（不数已拒绝的素材）是我定的，后端的口径见问题文件第四节。触发：只有已拒绝的素材不可跳过时页面不警告，而后端可能警告。

## 变更候选

没有。

## 未运行（4）

- 非 Chromium 浏览器（Firefox、Safari）：时间选择器、时段选择器、上传控件的文件头读取。
- 对着真后端：请求体（见问题文件第二节）、列表形状、`targeting` 的 `details`、`POST /ads/media` 的真实返回和 503、保存素材的 `warnings` 形状，都是按假后端和契约做的。
- 真实的大文件上传（50 MB 的视频、几万像素的图片）：只用了只有文件头的小文件，假后端不读文件内容；进度条在假后端上一闪而过。
- 真实的 `.xlsx` 导出内容（假后端只给样例工作簿），以及手机真机（只在 390 像素宽的 Chromium 里看了）。

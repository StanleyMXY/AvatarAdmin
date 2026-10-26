立即修未修 0、记录项 5、未运行 3、阻塞 0

# 任务 14：形象与装扮、照片里的人投诉 报告

提交：`83ef514`（实现）、`62b1d53`（抽屉里丢弃过期的回答，补变异检查发现的测试缺口）、`c814e11`（藏掉表单样式让它重新露出来的原生选文件框），报告随最后一个提交。环境：Node 24.22.1。

- 记录项：见下面"记录项"五条（两条要改共享文件：上传控件的原生输入框、表格没有行样式口子）。
- 未运行：见"未运行"三条（PDF 证据在无头浏览器里没有渲染、`GrantCosmeticButton` 和 `getAccountAvatars` 没有页面挂载、zh-CN 只看了渲染没点操作）。
- 阻塞：无。契约和后端文件没写的点写成了问题文件，本任务按最小做法继续。

## 改了哪些文件（都在任务 14 的路径内）

- 接口：`src/services/avatar/{index,types}.ts`、`avatar.test.ts`（14 个测试）；`src/services/complaints/index.ts`、`complaints.test.ts`（5 个）。任务 16 要用的导出都在 `src/services/avatar`：`getAccountAvatars(id)`、`grantCosmetic(id, { itemId, reason })`、类型 `DefaultAvatarStatus = 'DRAFT' | 'GENERATING' | 'READY'`、`DefaultAvatarFailureReason`（六个值的联合类型，另导出常量 `DEFAULT_AVATAR_FAILURE_REASONS`）、`AccountAvatars` 等。
- `SurfacesPicker`：`src/pages/avatar/SurfacesPicker.tsx`（属性 `value?: Surface[]`、`onChange?`、`disabled?`，能直接放进 Ant Design 的 `Form.Item`；序列化在 `surfaces.ts`）。
- 额外给任务 16 的：`src/pages/avatar/GrantCosmetic.tsx` 导出 `GrantCosmeticButton`（只对 `COSMETIC:GRANT` 渲染，属性 `accountId`、`ownedItemIds?`、`onGranted`、`disabled?`）和 `GrantCosmeticModal`。任务书"赠送服装的选择框"的要求（来自 `GET /cosmetics`、403 时禁用并写明要哪个权限）都在里面。任务 16 可以用，也可以不用。
- 页面：`src/pages/avatar/` 下 `cosmetics.tsx`（服装与背景目录）、`CosmeticModal.tsx`、`actions.tsx`、`ActionModal.tsx`、`declarations.tsx`、`DeclarationModal.tsx`、`rendererModels.tsx`、`RendererModelModal.tsx`、`generationTasks.tsx`、`defaultAvatars.tsx`、`NewDefaultAvatarModal.tsx`、`RenameDefaultAvatarModal.tsx`、`defaultAvatarFailure.ts`、`avatarName.ts`、`LocalizedTextsField.tsx`、`localized.ts`、`Thumb.tsx`、`EnabledSwitch.tsx`、`UploadBox.tsx`、`uploadSlot.ts`、`formFailure.ts`、`texts.ts`、`surfaces.ts`、`testSetup.ts` 和各自的测试；`src/pages/complaints/` 下 `likeness.tsx`、`ComplaintDrawer.tsx`、`EvidenceViewer.tsx`、`statusOptions.ts` 和测试。
- 假后端：`mock/avatar.mock.ts`（目录、上传三步、声明、渲染模型、生成任务、默认数字人、账号形象和赠送、带签名地址的文件）、`mock/complaints.mock.ts`、`mock/_core/avatarData.ts`（状态挂在 `globalThis`，`resetAvatarStore` 重置）、`mock/avatar.mock.test.ts`（38 个）、`mock/complaints.mock.test.ts`（13 个）。
- 路由：`config/routes/avatar.ts`（六个页面）、`config/routes/complaints.ts`（一个页面）、`config/routes/avatarComplaints.test.ts`（4 个）。
- 语言：`src/locales/{zh-CN,en-US}/avatar.ts`、`complaints.ts`。
- 问题文件：`docs/contract-requests/2026-10-26-admin-frontend-cosmetics-complaints.md`。

## 测试数量

任务 14 路径下 17 个测试文件、234 个测试：接口 19、假后端 51、路由 4、`surfaces` 9、`localized` 6、`avatarName` 4、`SurfacesPicker` 5、服装目录 25、动作目录 16、声明 8、渲染模型 8、生成任务 4、默认数字人 31、赠送 8、投诉页 36。另跑了 `src/locales` 和 `tests/noHardcodedText.test.ts`：648 个里 647 个绿，1 个红，红的是别人文件里的一个不可见字符（`mock/push.mock.test.ts:156`，推送模块），不是本任务的；本任务的文件在这条扫描里没有诊断。`npx biome check` 本任务路径无诊断；`npx tsc --noEmit` 本任务路径无错误（全项目现在有一条别人的：`src/pages/push/tasks.test.tsx` 找不到 `./tasks`）。

## 红到绿

要照实写：不是每个文件都先红后绿。

- 接口：先写测试。`npx vitest run src/services/avatar src/services/complaints` → 两个文件都是 `Failed to resolve import "./index"`（0 个测试）；实现后 19 个绿。
- `surfaces.test.ts`、`localized.test.ts`：实现先于测试写；把实现文件挪走再跑，两个文件都是 `Failed to resolve import "./surfaces"` / `"./localized"`；挪回后 15 个绿。
- 假后端：实现先于测试写（第 5 个任务的先例）；把 `mock/avatar.mock.ts` 挪走再跑 → `Failed to resolve import "./avatar.mock"`；挪回后 38 个绿（投诉假后端 13 个绿）。
- 页面测试和路由测试：页面先于测试写，没有单独跑红。靠下面 40 个变异检查证明测试会变红（初次 39 个，其中 3 个活下来，补测试后把一个等价变异换成真变异，并加了一个迟到回答的变异）。
- 绿的过程里修过的测试问题（不是功能问题）：假后端的上传也是 POST，写操作计数要去掉上传；Ant Design 按钮加载中名字带 "loading"（证据按钮改成加载中禁用，不用 `loading`）；复合表格有两个 `table` 角色（读 `.ant-table-tbody`）；所有选择框在测试里 id 相同，要按"没有在关闭动画里的下拉"找；列表里复选框的名称、第一页放不下的投诉（改了假数据的到期时间）。

## 真实浏览器检查（Playwright，端口 8314，登录 root，en-US，一次完整跑下来）

脚本在我自己的临时目录，不进仓库。七个页面全部打开并点了主要操作：

- 服装目录：19 张预览图全部解码成功（没有坏图），第 20 行以后分页；新建条目（选"该平台全部渠道"加一个具体渠道、上传真实 PNG、提交）后行里出现 `Android · All channels of the platform, iOS · appstore`；超过 2 MiB 的图片在页面上被拦下，**没有发出上传请求**；行内开关改完以后读回新状态；第二页能翻。
- 动作目录：补生成的确认框写明"会产生生成费用"，确认后提示"已安排 7 个生成任务"；已停用的动作按钮是禁用的。
- 上传声明：新建版本、设为生效（确认框文字在），提示"版本 2027-v1 已生效"。
- 渲染模型：不是 zip 的文件被页面拦下；上传真实 zip，填版本和 ABI，提交后列表出现新行。
- 生成任务：系统任务显示"系统"、失败原因是文字、空原因是"—"；按"动作片段"筛选后只剩这一种。
- 系统默认数字人：新建（没勾确认时提示、勾上提交）→ 草稿 → 生成（生成中，等 3 秒后点"刷新"变成已就绪）→ 设为生效（确认框写明游客会立刻看到它）→ 删除原来生效的那个（它变成非生效后才有"删除"）。
- 投诉：两行到期未结案的行整行是红底（`overdue rows marked: 2`）；证据文件图片解码成功，PDF 在框里；改状态后处理记录多一行；删除形象后投诉变成已结案，按钮消失；参数卡片里有 `complaint.likeness_due_hours`、`complaint.retention_days` 两个键。
- 控制台：只有登录第一步的 401（认证流程自己的，不是本任务）。没有别的错误。
- 宽度：1360 宽下七个页面都没有横向溢出（抽屉打开时整页 `scrollWidth` 1368，比 1360 多 8，见记录项）；390 宽的手机尺寸下服装目录、默认数字人、投诉三页都没有横向溢出。
- zh-CN：七个页面都渲染出中文，没有把语言键当文字显示出来。
- 过程中发现并修了：**上传控件在表单里会同时显示浏览器自带的"选择文件"框**（见记录项 1），在本模块的四个对话框里用 `UploadBox` 藏掉了，截图确认。
- 过程中遇到：同一个检出里的几个开发服务器共用 `src/.umi` 和打包缓存，别人的服务器会让我的页面白屏（`Module ... does not exist in container`），重启自己的服务器就恢复（任务 11 报告里也写过）。已停掉自己的服务器（按监听进程）。

## 变异检查（改一处判断，看测试是否变红；每个检查后还原）

40 个。**被杀死（红）**：
1. 服装页的写控件权限反过来 → 18 个红
2. 服装表单不发 `previewUploadId` → 2 个红
3. 创建时不再要求预览图 → 2 个红
4. 生成描述按 UTF-16 长度算 → 1 个红
5. 生成描述发送前不去首尾空白 → 1 个红
6. 创建后 `key` 还能改 → 1 个红
7. 行内开关没有防重复 → 2 个红
8. 动作补生成按钮对已停用动作不禁用 → 1 个红
9. 补生成返回 0 也显示成功数 → 1 个红
10. 补生成没有确认问题 → 5 个红
11. 声明提示在 meta 没有值时也显示 → 1 个红
12. 已生效的声明版本也有"设为生效" → 1 个红
13. 渲染模型上传中还能提交 → 1 个红
14. 渲染模型请求带 `sha256` → 1 个红
15. 已生效的默认数字人也有"删除" → 2 个红
16. 生成中的默认数字人也有按钮 → 3 个红
17. 草稿也有"设为生效" → 5 个红
18. 失败原因在任何状态旁都显示 → 1 个红
19. 不检查肖像授权勾选 → 2 个红
20. 请求带 `portraitAuthorized` → 1 个红
21. 409 不再显示当前状态 → 4 个红
22. 503 不再显示前置配置没配好 → 1 个红
23. 名字长度限制放宽 → 2 个红
24. "该平台全部渠道"写成 `*` 而不是 `null` → 5 个红
25. 选"全部渠道"时不清掉单个渠道 → 1 个红
26. 没有 `total` 的列表不在前端切页 → 1 个红
27. 生成任务不发 `status=FAILED` → 3 个红
28. 到期标记也加在已结案的行上 → 1 个红
29. 抽屉里已结案的投诉也显示处理控件 → 3 个红
30. 抽屉里不看 `COMPLAINT:MANAGE` → 2 个红
31. 状态下拉里出现 `RESOLVED_REMOVED` → 1 个红
32. 证据下标从 1 起 → 2 个红
33. 已显示的证据不再重新取 → 1 个红
34. 证据地址任何协议都打开 → 2 个红
35. 备注长度按 UTF-16 算 → 1 个红
36. 没有形象 ID 时"删除形象"也能点 → 1 个红
37. "删除形象"的确认文字没了 → 1 个红
38. 没有 `COSMETIC:GRANT` 也显示赠送按钮 → 1 个红
39. 列表 403 时选择器不禁用 → 1 个红
40. 抽屉里较早打开的投诉的迟到回答覆盖当前的 → 1 个红（这条是评审自己发现后加的守卫和测试）

**第一轮活下来的 3 个，处理**：
- "到期标记加在已结案的行上"：假后端本来就不给已结案的行 `overdue: true`，所以测试看不出；补了一个让后端把已结案的行也标 `overdue: true` 的测试，之后变红（第 28 条）。
- "失败原因在任何状态旁都显示"：没有测试给非草稿的行带原因；补测试后变红（第 18 条）。
- "READY 才有设为生效改成非生效的都有"：原来的改法被前面"生成中的没有按钮"的判断挡住，是等价变异；换成"草稿也有设为生效"后变红（第 17 条）。
- 第四个是迟到回答的变异：第一版测试用固定延时，在机器忙时漏掉了（活下来），改成由测试放行被扣住的回答后变红（第 40 条）。

## 覆盖了哪些语言

假数据和测试含泰语、阿拉伯语、印尼语、越南语、西班牙语、英语、中文（目录名称、动作名称、声明文案、投诉说明、处理备注、默认数字人名字），另有 300 个无空格字母的名称、5000 个无空格字符的投诉说明（泰语加拉丁加阿拉伯）、emoji（2000 个 emoji 的生成描述、1000 个 emoji 的备注、30 个 emoji 的名字）。码点计数的边界都用阿拉伯语和 emoji 各测过。界面只有 zh-CN 和 en-US，两种都看过；zh-CN 在真实浏览器里只看了渲染（见未运行）。

## 问题文件清单

- `docs/contract-requests/2026-10-26-admin-frontend-cosmetics-complaints.md`：各列表分不分页、筛选参数名；目录条目的响应字段（渲染模型的 `fileRef`、`names` 语言标签和 `en` 是否必填）、创建和修改的请求体（图片必填、`enabled`、`kind` 不带、整体替换）、默认条目换手；长度和格式；声明版本格式；几个写操作的成功响应；`INVALID_STATE` 的 `data.status`；`isCurrent` 含义。

## 需要改共享文件

1. `src/components/UploadField.tsx` 的 `<input hidden>`：在 Ant Design 表单里，表单样式会把文件输入框重新显示出来（`.ant-form input[type='file']` 的 `display` 盖过了 `hidden`），按钮旁出现浏览器自带的"选择文件"框。建议输入框改用 `style={{ display: 'none' }}`（或测试里 `data-testid` 保留）。本任务用 `src/pages/avatar/UploadBox.tsx` 在自己的四个对话框里藏掉，别的模块的上传表单（推送、广告、应用版本、短信）会碰到同一个问题。
2. `src/components/PagedListTable.tsx` 没有把 `rowClassName` 传给 `ProTable`。投诉页"到期未结案的行高亮"本任务用每列的 `onCell` 给整行每个单元格同样的背景，结果等价，但换成一个 `rowClassName` 属性会更干净。

## 规格需要在 main 上修改的地方

无。（规格 5.24 动作目录和默认数字人的写法与契约一致；声明页只列了版本、生效时间、是否生效三列，没有看文案的地方，见变更候选。）

## 记录项

1. `src/components/UploadField.tsx`（`hidden` 的输入框）：任何放在 Ant Design 表单里的上传控件都会露出原生选文件框。触发：在任一对话框里打开上传控件。后果：界面上有两个选文件的入口，原生那个没有限制说明。建议修。本模块已绕过（`UploadBox`），不影响正确性。
2. `src/components/PagedListTable.tsx`：没有 `rowClassName`，见上。触发：想给整行加样式。后果：只能逐列 `onCell`。
3. `src/components/ChannelSelect.tsx` 的 `loadChannels` 一次页面加载只读一次渠道：`SurfacesPicker` 用它，在另一个页面新增渠道包后，这个页面要刷新才能在"适用的端"里选到。触发：先开服装目录、再到渠道包页新增渠道、回来新建条目。后果：新渠道不在下拉里（已存的值仍会显示）。
4. 抽屉打开时整页 `scrollWidth` 比窗口宽 8（1368 对 1360）：我还没查清原因（猜是抽屉打开时的滚动条补偿），抽屉关着时没有溢出。
5. `src/pages/complaints/likeness.test.tsx` 的 PDF 证据测试：happy-dom 的 `iframe` 真的去取 `src`，测试输出里有一行 `connect ECONNREFUSED 127.0.0.1:3000`，不影响结果，但吵。

## 未运行

1. PDF 证据在真实浏览器里只看到框，内容没有渲染：无头 Chromium 没有 PDF 查看器，页面用的是 `iframe`，有头浏览器里没有验证。图片证据解码成功已验证。
2. `GrantCosmeticButton`、`GrantCosmeticModal`、`getAccountAvatars` 没有在真实浏览器里看过，因为现在没有页面挂载它们（任务 16 的用户详情才会用）；只有单元测试和对着假后端的页面测试。`GET /accounts/{id}/avatars` 里"用户的脸"的占位图和"每次重新取"由接口测试和 `Thumb` 的服装目录用法覆盖。
3. zh-CN 在真实浏览器里只看了七个页面渲染出中文，没有点操作；中文文字靠两边键一致的测试保证存在。

## 变更候选

- 声明页：规格只列了版本、生效时间、是否生效，列表里没有看各语言文案的地方（我只加了"语言"一列，列出有哪几种）。运营想核对律师给的文案时没有办法在页面上看。要加"查看文案"需要负责人确认。
- 动作和服装表单里"适用风格"目前允许一个都不选（交给后端 400）；如果要在前端要求至少选一个，是新增行为。
- 默认数字人"生成中"目前靠"刷新"按钮看结果，没有自动轮询；加轮询是新增行为。

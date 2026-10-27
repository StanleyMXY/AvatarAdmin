立即修 0、记录 8、变更 0、不是缺陷 6、阻塞 0

# 任务 29 评审：应用版本与渠道包（提交 671a056，含 0201f1c 之后的状态）

评审方式：一次独立评审（页面、报表类，不加复审轮次；商店链接校验按重点做了对抗检查）。未运行：非 Chromium 浏览器、对着真后端、真实浏览器里的版式（没有起开发服务，下面凡是版式判断都写明"按样式推断"）。

## 做了什么

- 逐句对照规格 5.19、5.0 和任务书，逐个元素对照两个页面渲染的内容：版本列表的筛选和九列、顶部四句判定规则、表单的每个字段和旁注、STORE 与 DIRECT 的分支、激活对话框、下线与删除的行内确认、渠道包的七列、创建弹窗五个字段、编辑只改名称和包名、没有删除。没有发现规格或任务书写了而页面没有的元素。
- 在 `git archive` 出来的副本（链接了 node_modules，复制了 `src/.umi`）里跑任务相关的 421 条测试：420 通过、1 条偶发失败（见记录 1）；单独重跑全部通过。`npx biome check` 本任务路径只有测试文件里的 `noNonNullAssertion` 警告（实现者已记录）；`tsc --noEmit` 在本任务路径下无报错；`tests/noHardcodedText` 在共享检出里 31 条通过。
- 源码里没有原始的隐藏字符或双向控制字符（用 Python 按 Unicode 类别扫了本提交所有文件）；没有 `console`/`debugger`；没有第三方产品名（除规格要求的 Google Play 与 App Store 主机名）；en-US 键与 zh-CN 键一致由已有测试守住。
- 渠道码字段名与 0201f1c 的一致性：任务 29 的页面读渠道包只用自己的 `listChannelPackages`，先读 `code`、没有再读 `channelCode`；版本行里的 `channelCode` 是契约 §24.1 的列，页面读的是它。共享的假渠道列表只给 `code`，`mock/channels.mock.ts` 的写接口（POST/PUT、内存状态在 `mock/_core/channelsData.ts`）都用 `code`，与 0201f1c 一致；任务 29 的页面在只给 `code` 的假后端上正常（渠道包页、版本页的渠道下拉、激活对话框的渠道名都用 `code`）。`mock/channels.mock.test.ts` 在 0201f1c 之后通过。对共享文件的改动符合执行约定裁决 7。

## 商店链接校验 `validateStoreUrl`

- 写了一份独立的参照实现（只按契约 §24.2 的文字，用正则整串解析，不看实现）和随机对照：安卓 40 万条变异输入（从合法链接出发做插入、删除、替换、大小写、百分号编码、反斜杠、不可见字符、`@`、端口、片段、重复参数、`referrer`、尾随空白等）里 13.9 万条是合法的，另有 20 万条纯随机拼接；iOS 20 万条。实现与参照的差异为 0。
- 手工对抗的链接都按预期被拒：`play.google.com.evil.com`、`evilplay.google.com`、`play.google.com@evil.com`、`user:pw@play.google.com`、`:443`、`:`、片段（含空片段 `#`）、`http://`、`//play...`、`HTTPS://`、反斜杠、百分号编码的路径、`id` 带尾随空格或零宽字符、包名不符、`ID=`、`referrer`、重复的 `id`/`hl`/`gl`、尾随 `&`、西里尔字母混入的主机、`xn--` 主机、末尾带点的主机。大小写混写的主机（`PLAY.Google.COM`）按契约接受。`hl`、`gl` 的值用契约的正则。iOS 主机、两种路径、`apps.apple.com:443` 被拒、`apps.apple.com.evil.com` 被拒。
- 它先过 `validateServerLink`（长度、非 ASCII、空格都在那一步被拒），表单里再用 `trimSpec` 去首尾后校验、发出的也是去首尾后的值。
- 变异：12 个里我复查了 6 个（片段、主机大小写、`referrer`、重复参数、不过链接规则、iOS 短路径），全部变红。

## 其余重点逐条结论

- (b) 顶部四句：中英文措辞与规格一致，次序一致，等于最低版本号时是可选更新单独一句。页面没有任何"预览/计算"客户端判定的地方，所以不存在与契约 24.3 比较方式不一致的计算；激活处的"最低版本号大于当前生效版本号"用的是 `min > activeCode`，与契约 24.2 相同（相等不算，变异 `>=` 变红）。
- (c) 版本号：创建、编辑草稿（表单规则）和激活（对话框警告，不拦截，后端为准）三处都比较，严格大于；最低版本号 ≥ 1 且不超过版本号（变异变红）；更新说明缺 `en`（含只有空白）不能保存。
- (d) 激活：STORE 要勾选并发 `confirmStoreLive=true`，DIRECT 不发（变异 DIRECT 也发、服务函数总发，均变红）；新最低版本号大于生效版本号时红色强提示，读不到生效版本时黄色提示；已归档没有操作；激活和下线只按 `APPVERSION:ACTIVATE`，新建、编辑、删除只按 `APPVERSION:MANAGE`（把激活改成按 MANAGE、把归档加上下线、新建按钮对所有人，均变红）；下线、删除是行内确认；对话框只在打开时挂载。
- (e) APK：只有 DIRECT 渠道有控件，STORE 没有也不发 `apkUploadId`；上传前检查类型和大小（去掉检查变红）；上传中提交按钮灰掉且表单提交也不发（去掉变红）；只发 `apkUploadId`；地址、大小、SHA-256 是文字；503 提示加 `/config` 链接只对 `CONFIG:MANAGE`（对所有人显示变红）；已知错误码只显示译文（见不是缺陷 2）。
- (f) 渠道包：渠道码、平台、分发方式创建后是文字；iOS 的 DIRECT 灰掉并在换成 iOS 时清掉；没有删除；开关关闭前有问句；`unknown` 保留；渠道码 `^[a-z0-9_-]{2,32}$`（与任务 28 的模块不同，以契约 24.7 为准，这里是对的）；编辑发 `{name, packageName, enabled}`，已停用的渠道编辑后 `enabled` 仍为 `false`（变异改成 `true` 变红）；`packageName` 为空发 `null`。
- (g) 过期响应：版本列表、渠道读取、生效版本读取都有"最新读取才算"的计数，切换渠道时旧的生效版本提示被丢弃（有测试，变异变红）。`readActiveVersion` 只读第一页：见不是缺陷 4。弹窗只在打开时挂载；双击防重复在激活、删除、下线、渠道包提交、开关五处都有测试。长串布局：表格里的名称、包名、商店链接走 `EllipsisPopoverText`，渠道码、版本名、创建人用 `overflowWrap: anywhere`，不会撑破表格（按样式和测试判断，未在浏览器里复验）。非字符串的值：服务层和列表一律过 `plainText`，见记录 4 的一处例外。
- 变异抽查：共 30 个，其中 28 个变红，2 个存活（见不是缺陷 6）。包含：商店链接 6、版本规则 3、激活对话框 2、版本列表权限和确认 5、版本表单 4、服务函数 2、渠道包 7、假后端 1。每个变异改一处判断，只跑守这条判断的测试，随后还原（副本里还原后与检出逐字相同）。

## 记录

1. `src/pages/channels/channels.test.tsx:309-324`：全套任务测试并行（37 个文件同时）时，"refuses a code that was made by somebody else meanwhile" 偶发失败（`expect(field).toBeTruthy()` 为 `undefined`）：`findAllByText` 先找到了对话框顶部提示条里的同一句话，这时字段下面的那一条还没渲染。触发：重负载下跑全量或多文件测试。结果：测试偶发红，单独跑 3 次、整个文件跑 2 次都绿。改法：先等字段下面的那一条出现再断言。
2. `src/pages/appVersions/VersionModal.tsx:101-110`（`uploadRefused`，由 219 行调用）：400 `INVALID_REQUEST` 且 `details` 为空时当作"上传编号不能用"。契约 §24.2 只写"出错返回 `INVALID_REQUEST`，`message` 写明字段"，没承诺 `details`。触发（我在副本里用测试复现了）：新建 DIRECT 版本，上传 APK 成功，提交时后端回 400 且 `details: []`（例如有人刚激活了更高的版本号，后端只在 `message` 里写 `versionCode`）。结果：已经传好的文件被清掉，显示"服务器没有接受这个文件，请重新上传"，运营要重新传最多 100 MB，真正的原因只在上方提示条里。改法：只在 `details` 里有 `apkUploadId` 时清文件；没有 `details` 的 400 保留文件。需要后端确认 400 是否总带 `details`（问题文件第三节第 4 条已问字段指向，可补问这一点）。
3. `src/pages/appVersions/ActivateModal.tsx:53,85`：生效版本还在读取时（`hint.state === 'loading'`）`settled` 为假，强提示不出现，而"激活"按钮没被灰掉（STORE 勾上框就能点）。触发：网络慢时打开对话框、立刻勾选并点"激活"。结果：最低版本号高于当前生效版本号的草稿在没看到强提示的情况下被激活（后端仍会按契约处理，所以只是提示缺席）。改法：读取完成前灰掉"激活"，或读取中显示"正在读取当前生效版本"。
4. `src/pages/appVersions/VersionModal.tsx:448,468`（及 `apkUrl` 同处）：刚上传成功的 `apkUrl`、`apkSha256` 是直接当 React 子节点渲染的，没过 `plainText`（列表和草稿已有的文件值过了）。触发：后端对 `POST /uploads/apk` 返回的这两个字段是对象或数组。结果：渲染抛错，弹窗所在页面白屏。契约写的是字符串，所以只在后端违约时出现。
5. `src/pages/channels/ChannelModal.tsx:63` 与 `src/pages/channels/channels.tsx:40`：编辑弹窗把打开时列表里的 `enabled` 一起发，开关把列表里的名称和包名一起发。触发：管理员甲打开渠道 X 的编辑弹窗，管理员乙把 X 停用，甲保存新名称。结果：甲的请求把 X 重新启用（并使版本检查重新下发更新）；反过来，开关会把乙刚改的名称改回旧值。问题文件第一节第 4 条已问后端能否只发 `{"enabled":false}`；后端答复前这是已知的出入。
6. `src/pages/appVersions/useLatestRead.ts:21` 与 `src/pages/channels/channels.tsx:91`：每次重读先把数据清成 `null`，渠道包页的表格 `rows = read.data ?? []` 随之变空。触发：在渠道包页拨一次启用开关、保存一次编辑，或点重试。结果：成功之后整张表闪成"没有渠道包"加转圈再回来，滚动位置丢失（版本列表用 `useServerPage`，重读时保留旧行，没有这个问题）。
7. `src/pages/channels/channels.tsx:64`：关闭开关的问句把渠道名放进 Popconfirm 的标题；antd 的气泡（`maxWidth: 100vw`，没有 `overflow-wrap`）里一个 5000 字符无空格的名称会越出气泡。触发：渠道名为 5000 个无断点字符，点关闭。结果：问句文字溢出气泡，按钮仍在气泡内可点。按样式推断，未在浏览器验证；测试里的 5000 字符渠道名只验证了表格。
8. `src/pages/channels/channelRules.ts:9`：注释"\n is a character of its own for `$` in some engines"在 JavaScript 里不成立（`/^a$/.test('a\n')` 为 `false`），正则本身没问题。

## 不是缺陷

1. 渠道包编辑弹窗里没有"启用"控件（`src/pages/channels/ChannelModal.tsx`）：任务书写"只有启用开关；编辑只能改名称、包名、启用"，列表里的开关就是改启用的唯一入口，弹窗保留原值发出（已停用的保持停用，有测试）。实现者在报告里把"弹窗里再放一个"列为变更候选，我同意这是新增行为而不是遗漏。
2. APK 缺 v2 签名时只显示 `INVALID_FILE` 的译文（`src/pages/appVersions/ApkUpload.tsx:150-156`）：这是负责人已定的规则（已知错误码只显示译文）；译文没有提到签名，页面在控件旁常驻一句"必须带 v2 及以上的签名"（`appVersions.apk.help`）。问题文件第四节第 1 条和"规格需要在 main 上修改的地方"已写明。
3. `src/pages/appVersions/ApkUpload.tsx` 代替 `UploadField kind="apk"`、`useServerPage` 等小件的又一份副本：执行约定禁止模块任务改 `src/components/*`；报告已写"需要改共享文件"。功能与共用控件一致（类型、大小、进度、单次飞行都经过变异或测试）。
4. `readActiveVersion` 只读第一页（`src/services/appVersions/index.ts:60-63`）：请求带 `channelCode` 和 `status=ACTIVE`，契约 §24.1 的部分唯一索引保证每个渠道至多一行 `ACTIVE`，一页 20 条足够；后端要是忽略过滤，页面还会再按 `status` 和 `channelCode` 在返回的行里找，找不到时按"读不到"处理的只是提示，后端为准。
5. 校验比后端更严的地方：大写 `HTTPS://`（链接规则 1.7 要求小写，`reason.NOT_HTTPS` 的译文明说了）、百分号编码的 `id`/`hl`、尾随 `&`、末尾带点的主机。这些都是拒绝而不是放过，真实的商店链接不会这样写；iOS 路径的限制按契约原样（"这个形状是我的印象"，问题文件第三节第 9 条已问）。
6. 两个存活的变异：把 `ChannelPackage` 的读取改成"优先 `channelCode`"（`src/services/channelPackages/index.ts`）存活，因为只有一行同时带两个且不同的键才会出现差别，后端不会这样发；把"编辑时渠道取自表单值"（`VersionModal.tsx:143`）存活是等价变异，编辑时表单里没有这个字段。

## 阻塞

无。契约的缺口都已写进 `docs/contract-requests/2026-10-26-admin-frontend-app-versions.md`，我没有发现需要补的新缺口，除了记录 2 里可以补问的"400 是否总带 `details`"。

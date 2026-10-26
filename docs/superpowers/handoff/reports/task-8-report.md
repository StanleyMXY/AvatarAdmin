# 任务 8 报告：共用界面组件

立即修未修 0、记录项 14、未运行 3、阻塞 0。

提交：`f709a03`（实现）、`4d766b1`（评审后的修复）。环境：Node 24.22.1。深度评审一轮加一次复审（约 150 个变异、Chromium 探针）。

## 做了什么

`src/components/`：`PagedListTable`（ProTable，服务端分页，10/20/50/100，默认 20，失败显示错误条和重试）、`EllipsisPopoverText`（长文字截断、点开看全文、复制；任意文字不撑破）、`RowActions`（3 个以内全显示，4 个起前 2 个加"更多"）、`DangerConfirmButton`、`ReasonModalForm`（理由按契约 §1.9 去空白后按码点数 1..500）、`LinkInput`/`linkRule`、`LinkTargetField`/`linkTargetRule`、`UploadField`（先检查再上传，只读文件头不解码图片）、`MaskedText`、`StatusTag`、`JsonField`、`Can`、`ExportButton`；`src/hooks/useSingleFlight.ts`；`src/utils/screenTargets.ts`（契约 §8.3 的 9 个页面标识）、`uploadErrors.ts`（`isUploadIdRejection`）。语言键在 `src/locales/*/pages.ts` 的 `pages.common/link/upload/export/masked/json`。

## 红到绿

先写测试再实现。组件和钩子相关测试 281 个全部通过；`tsc`、`biome` 通过。

## 评审（深度，一轮加复审）

立即修 4，**复审确认全部已修（Chromium 重测加变异检查）**：

1. 上传预览的 `<img>` 会让浏览器解码整张大图：一张 439 KB、声明 20000×20000 的 PNG 在"推送图片"入口通过检查后主线程停顿 9 秒、内存涨约 2 GB。**已修**：只有文件头读出宽高且不超过 1600 万像素才生成预览（重测：最大停顿 123 ms）。
2. 上传中卸载组件，`XMLHttpRequest` 不取消，之后迟到的回调把错误的 `uploadId` 交给父表单并提前把"忙"置为假。**已修**：卸载时取消，之后不再回调，只补一次"不忙"。
3. 重选文件被拒绝或失败后，父表单仍留着上一个文件的 `uploadId`。**已修**：新增可选属性 `onCleared`（换文件时若之前有成功的上传就先调用一次）。
4. `LinkTargetField` 作为表单控件不拦非法链接。**已修**：导出 `linkTargetRule`。

记录项已一并修掉的：上传超像素提示里"（只对图片）"出现三次；读不了文件和父回调抛错的两条错误路径；权限码参数类型改为 `PermissionCode`；菜单里的操作防重复；`JsonField` 改用 `trimSpec` 并在卸载时上报有效；文字弹窗用 `dir="auto"`、去掉已弃用的 `Space direction`、按钮的可读名字改为单元格文字；必填的空链接框触碰前不标红；删掉 `PagedListTable` 里的死代码；补了一批测试（含 ExportButton 的中文、ReasonModalForm 的六种语言理由）。

## 仍然记录的 14 项（建议全部修，由你定什么时候；修共用组件要等模块任务不再依赖它们变动的那一刻）

1. `PagedListTable`：请求失败后表里仍留着上一次的旧行，红色错误条旁边是别的筛选条件下的数据（`PagedListTable.tsx` 失败分支）。
2. `PagedListTable`：缺规格 4.1 的列设置和骨架屏（`options={false}`，加载是旋转图标）。
3. `PagedListTable` 的测试缺口：页大小选择、选项列表、搜索区默认折叠、"只有最新请求才改错误条"都没有测试守住（评审者的探针能杀掉这些变异，仓库测试杀不掉）。
4. `ExportButton`：后端 400 超行数的提示被泛化成"输入不合法"，运营不知道要缩小范围（规格 4.4 写"显示后端的提示"，计划又写后端 `message` 只作兜底，两处有张力；与任务 3 的变更候选"已知错误码是否附后端 `message`"是同一个决定）。
5. `ExportButton` 的进度字节数没有测试（计划列了这一条）。
6. `ReasonModalForm` 只显示 `describeFailure().text`，忽略 `details`；确认中仍允许取消、关闭后不重置表单、关闭后不清失败，没有测试守住。
7. `StatusTag` 的 `hasOwn` 保护在测试里观察不到；`MaskedText` 的权限名测试偏弱。
8. 多语言覆盖仍不足：界面文字的测试几乎全是 en-US。
9. `UploadField` 其余测试缺口：`revokeObjectURL`、同一文件连选两次、`file.type` 分支、16 MP 边界、"读不出宽高时不生成预览"的测试名与正文不符。
10. `RowActions` 菜单操作"守卫永不释放"的变异没有测试守住；`DangerConfirmButton` 的 `linkTargetRule` 原因文字用错键没有测试守住。
11. `JsonField` 在父组件用内联回调时每次渲染多一次中间的 `true` 上报（最终状态对，不循环）。
12. `PagedListTable` 的泛型约束已放宽，但日期范围搜索字段的参数形状没有测。
13. `UploadField` 在表单清掉 `uploadId` 后仍显示"已上传"，要换 `key` 才复位（写页面的任务要留意）。
14. 屏幕阅读器读 `EllipsisPopoverText` 的单元格只用代码看过，没有用读屏软件验证。

## 未运行（3）

- 非 Chromium 浏览器（大图解码行为、`-webkit-line-clamp`、剪贴板）。
- 真后端的上传和导出响应头、分块行为。
- 小于 1 MB 的超大像素 JPEG 的预览（造不出这样的文件，只测了 PNG）。

## 给后面任务的提醒

- 行内操作的失败要自己显示（`DangerConfirmButton` 和 `RowActions` 吞掉拒绝，这是约定）。
- 表单里用 `UploadField` 时，`onCleared` 要清 `uploadId`，409/400/404 后要给它换 `key`。

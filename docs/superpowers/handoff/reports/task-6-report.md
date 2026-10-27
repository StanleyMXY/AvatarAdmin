# 任务 6 报告：主题、语言文件、外壳（标签页、主题和语言切换、头像菜单、403 和 404 页）与"禁止写死文字"扫描

立即修未修 0、记录项 7、未运行 3、阻塞 0。另有 3 项变更等你决定（见后面），不影响任务 7 开始。

提交：`3cf59c0`（实现）、`b835ce6`（评审后的修复）、下一个提交（复审后补的测试和页面标题）。环境：Node 24.22.1。

## 做了什么

- 主题：`dim`（默认）、`deep`、`light` 三档，值取规格第 7 节；换档不重载页面；选择存在 `localStorage`（读写失败时只在本次页面有效）。Ant Design 主题、图表主题、`<html data-theme>` 和 `color-scheme` 跟着档位变。
- 构建变量：`ADMIN_*` 经 `src/buildVars.ts` 读取，`config/buildVars.ts` 注入。修了任务 1 留下的错误：注入值多带了一层引号（浏览器里产品名变成 `"Admin"`）。
- 语言文件：`src/locales/{zh-CN,en-US}.ts` 汇总 29 个模块文件加 `error`、`reason`、`permission`、`pages`、`menu`；初始语言按"已保存值，其次浏览器语言，其余用英文"，泰语、阿拉伯语等浏览器得到英文；`<html lang>` 同步。
- 外壳：`mix` 布局（侧栏 240、顶栏 56、内边距 24）、标签页（总览固定、右键菜单：刷新、关闭、关闭其他、关闭全部、关闭左侧、关闭右侧；只存路径到 `localStorage`，读回时按权限过滤）、语言和主题切换、头像菜单（改密码、退出登录）、403 和 404 页。
- 扫描（`tests/noHardcodedText.*`）：用 TypeScript 编译器读 `src/**/*.tsx`，找不经语言文件的字面量（JSX 子节点和属性、对象里的 `title`/`label` 等、`message.*`/`notification.*`/`Modal.*` 调用、模板字符串、`String()`、`as`）；全仓库规则：固定 token、浏览器里哈希、公共 CDN、外部地址（含 IP、`ws(s)`）、参照项目名、隐藏字符和非 ASCII 空格、韩文。放行清单：共用一份，模块任务把自己页面的条目放在自己目录下的 `hardcodedText.allow.json`（写进了 `execution-conventions.md` 第 6a 条）。

## 红到绿

- 红：先写测试再实现；每个新文件先因"模块不存在"失败。
- 绿：全量 `npx vitest run` → 49 个文件、1129 个通过、1 个跳过（原有的）；`tsc --noEmit` 退出 0；`biome check .` 无输出；`max build` 成功，`dist/index.html` 的 `<title>` 是 `Admin`。
- 真实浏览器（Playwright 对 `npm run dev:mock`）：三档主题、语言切换、标签右键菜单、溢出标签、键盘操作、403 和 404 页都看过，评审者独立又看了一遍。

## 评审

一次独立评审加一次复审，共约 40 个变异加真实浏览器探针。评审者给出：立即修 4、记录 11、变更 3、不是缺陷 2；复审又给出记录 3。

立即修 4 条，**全部已修，复审确认且变异检查通过**：

1. 扫描遇到"开头带字母的模板字符串"会以编译器内部异常崩溃，且漏掉对象属性、`message.*`、`Modal.confirm`、`String()` 等最常见的写法。已重写，每种写法有测试；去掉任一处修复都有测试变红。
2. 暗色两档里主色实际渲染成 `#0CA19D`，不是规格的 `#0ABAB5`（Ant Design 的暗色算法会改主色）。已修：算法数组 `[darkAlgorithm, keepPrimary]`；测试用 `theme.getDesignToken` 断言三档的主色、悬停、按下都是规格值，且按钮文字对主色的对比度不低于 4.5。浏览器里三档主按钮背景都是 `rgb(10,186,181)`。
3. `ThemeRoot` 没有包 Ant Design 的 `App`：`App.useApp().modal.confirm` 会抛 `TypeError`，静态确认框在暗色下是白底。已修，测试覆盖"能用"和"弹窗与页面是同一套主题"（把 `App` 挪到 `ConfigProvider` 外面，测试变红）。
4. 同上的第一条之外：扫描对"已列出但已删除"的文件抛 `ENOENT`。已修（与第 1 条同一批）。

记录项（评审第一轮 11 条）：已修 8 条——头像菜单改成可聚焦的按钮（浏览器里 Tab 聚焦、回车打开）；`TabManager` 补了"权限收回时丢标签"和"末尾斜杠"两个测试（去掉对应代码都变红）；语言文件检查补了"目录与清单一致"和"英文里没有中文字符"，删掉恒真的断言；隐藏字符规则扩到 `\p{Cf}`、行和段分隔符、U+3164 和所有非 ASCII 空格，仓库里残留的原始字符改成转义；放行清单归属写进约定；点文件和 `.husky/*` 纳入扫描；IP 和 `ws(s)` 加进外部地址规则；删掉重复的 `src/typings.d.ts`；`<title>` 取 `ADMIN_PRODUCT_NAME`。
复审的 3 条新记录项里 A（扫描新增部分没有测试守护）和 B（`ThemeRoot` 测试名与断言不符）**已修**并做了变异检查；C 留下，见下。

## 仍然记录的 7 项（建议全部修，由你定什么时候）

1. 浏览器禁用 cookie 且 `localStorage` 抛错时，语言选择失效：界面语言变了，下拉框仍显示旧值，请求的 `Accept-Language` 不跟着变。触发：禁用站点数据后在语言下拉里选"简体中文"。位置：Umi 生成的 `getLocale`，`src/locales/initLocale.ts`、`src/components/layout/LangSwitch.tsx` 没有应对。
2. 受限账号访问无权限的页面时，403 页没有标签栏（`unAccessible` 替换了包着标签栏的 `children`），标签管理器被卸载再挂载，靠 `localStorage` 恢复。404 页有标签栏。位置：`src/app.tsx` 的 `unAccessible`。
3. 标签页的右键菜单只有鼠标能打开，键盘没有"刷新""关闭其他"的入口（Delete 键能关标签）；触摸设备（iPad）不触发右键事件，也打不开。位置：`src/components/layout/TabManager.tsx`。
4. 扫描规则的覆盖缺口：哈希规则只认 `md5`，不含 sha 系列和 `crypto.subtle.digest`；只拦参照项目的两个名字，不含其他第三方产品名；不拦协议相对地址（`//host`）；`message.*` 的识别只认标识符 `message`、`notification`，`api.error('...')` 这类漏报；`.ts` 里拼出的界面文字不扫。
5. 浏览器加载 JS 前和 `getInitialState` 期间是空白页，暗色用户会看到默认画布色（白底闪烁）。位置：`src/.umi` 生成的 HTML，我们没有设背景。
6. 日期选择器选中日、`Radio.Button` 选中、可选 `Tag` 选中、`Steps`、`Badge` 等实心主色元素的文字仍是白色，对 `#0ABAB5` 约 2.41:1；只有 `Button` 用了 `pickOnPrimary`。规格第 7 节写"主按钮等实心主色元素"。位置：`src/theme/modes.ts` 的 `components`。
7. 会话过期（不经 `signOut`）时，`localStorage` 里的标签路径（可能含用户编号）不会被清；这属于任务 7 的会话处理，任务 7 要清它。

## 未运行（3）

- 真实登录后的菜单和标签页（权限过滤、受限账号的菜单）：登录页在任务 7 才做，现在只用单元测试加手改初始状态看过。任务 7 做完后在真实浏览器里重跑。
- 生产包里缺失翻译键时 `react-intl` 是否静默：开发环境每次渲染打一条错误，生产包我没有实际跑。
- `Accept-Language` 请求头在真实浏览器里的值：只读了代码（`setLocaleProvider(() => getLocale())`）和单测。

## 变更（等你决定，不阻塞）

- 浅色模式下"主色文字放在白底上"只有 2.4:1，暗色下链接蓝色对容器只有 2.7:1 到 3.1:1，且和青色主色不搭：要不要加 `colorLink` 和浅色专用的文字主色。规格第 7 节没有规定。
- 标签页保活：现在切换标签会重新加载页面，筛选条件和未提交的表单丢失，查询串也丢；要不要保活、怎么处理查询串，涉及内存和数据陈旧。
- 参数页的标签标题：`/users/1` 和 `/users/2` 两个标签都叫"用户详情"，要不要在标题里带参数。

## 不是缺陷

- `ADMIN_LOGO_URL` 写成 `/\evil.com/x.png` 能绕过同源检查：该变量来自部署者的环境，是受信任输入。
- `app.tsx` 和 403 页直接引用 `config/routes`：打包器接受，约束是 `config/routes` 以后不能引入 `node:` 模块。

## 给后面任务的提醒

- 弹窗和提示用 `App.useApp()` 的 `modal`、`message`，不要用静态的 `Modal.confirm`、`message.*`。
- 页面里不写死文字；确实需要的字面量（单位、产品名）放进自己目录下的 `hardcodedText.allow.json` 并写理由，不用的条目会让测试失败。
- 任务 7：登录页是 `layout: false`，语言和主题切换要在登录页单独放；头像菜单依赖 `me.username`；会话过期要清 `avatar-admin.tabs`；`getInitialState` 现在返回 `{}`，由任务 7 接管。

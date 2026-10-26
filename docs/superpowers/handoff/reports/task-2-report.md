# 任务 2 报告：纯函数工具

立即修未修 0、记录项 6、未运行 0、阻塞 0。（下面的"不是缺陷"5 条已写理由，"变更"0 条。）

提交：`64bcea6`（代码和测试）。环境：Node 24.22.1（默认的 22.22.0 低于下限 22.22.1，见下）。

## 文件

新增 `src/utils/`：`trimSpec.ts`、`codePoints.ts`、`linkRule.ts`、`utcDay.ts`、`ratio.ts`、`format.ts`、`resolveLocale.ts`、`imageHeader.ts`、`uploadLimits.ts`；`src/theme/contrast.ts`；每个都有同名 `*.test.ts`。另有共用的测试字节构造 `tests/imageBytes.ts`（手工拼 PNG、JPEG、MP4、ZIP 的文件头，不解码）。

## 红到绿

- 红：`npx vitest run src`，10 个测试文件都报 `Failed to resolve import "./xxx" ... Does the file exist?`，没有一个测试运行，原因是模块不存在。
- 绿：实现后第一次运行 196 个里 2 个失败，都有明确原因：
  - 实现错误：`https://user:pw@example.com/x` 被按第一个冒号拆成主机和端口，得到 `INVALID_PORT`，应先判用户信息为 `INVALID_HOST`。已修。
  - 测试写错：三个 EXIF 段合计 71041 字节，不到 70 KiB。已改成合计约 72 KB，让文件头确实跨过 64 KiB 的第一块。
- 修后：`npx vitest run src` → 10 个文件、196 个测试全过；`npx tsc --noEmit` 退出 0；`npm run lint` 无问题。

## 覆盖的语言

测试里有泰语、阿拉伯语（含 lam-alef 连字字符）、印尼语、越南语、西班牙语、英语、中文，以及 emoji、旗帜、ZWJ 序列；文件名测了泰语、阿拉伯语和 emoji。

## 环境确认（接手时做的）

- 规格和契约在 `docs/shared-snapshots/`，能读。
- 默认 Node 是 v22.22.0，低于项目要求的 `^22.22.1 || >=24.0.0`。`npm install` 报 EBADENGINE 警告（项目本身和 lint-staged）但能装、39 个测试全过。按说明装了 Node 24.22.1（`npm install --prefix "$HOME/.local/node24" node@24`，4 秒），换后无警告，测试、tsc、biome 全过。每条命令前需要 `export PATH="$HOME/.local/node24/node_modules/.bin:$PATH"`。建议把固定 Node 版本写进云端环境的 setup script。
- 子代理可用。提交钩子可用（钩子测试 24 通过 1 跳过；两次提交都走了完整钩子）。
- `npm install` 把 `package-lock.json` 的 `engines` 从 `>=20` 同步成与 `package.json` 相同的值，单独提交 `43f7d30`。

## 评审（一次独立评审，不同上下文，含约 45 处变异）

结论：对照任务书和契约 §1.7、§1.9 没有找到错误输出。立即修 0；以下 6 条是"记录"，建议最后一批全部修。

1. **文件头读取的测试拦不住"整文件读入"。** `src/utils/imageHeader.test.ts:74-78、:71、:109-116、:179`，被测代码 `src/utils/imageHeader.ts:41-46、:9`。步骤：把 `readImageSize` 开头的 `readRange(file,0,24)` 改成 `await file.arrayBuffer()`，22 个用例全过（测试只记录 `slice` 的字节数，整文件读入时记录值是 0，`≤ 64` 和 `≤ 4 MiB` 反而成立）；块大小改成 1 或 8 MiB 也全过。后果：以后有人整文件读入，上传校验把几十到几百 MB 读进内存，运营选文件时页面卡住。补法：对 `arrayBuffer`、`stream`、`FileReader` 加抛错桩，并断言记录的字节数大于 0。
2. **`yesterdayUtc` 没有夏令时用例。** `src/utils/utcDay.test.ts:33`，被测 `src/utils/utcDay.ts:30`。步骤：把实现换成本地时区的 `setDate(getDate()-1)`，20 个用例全过；在 `America/Los_Angeles`、`now=2026-11-02T00:30Z` 时变异版返回 `2026-10-31`，正确是 `2026-11-01`。后果：以后改成本地算术，洛杉矶用户在夏令时前后会得到多一天或少一天的统计日（Review Focus 第 2 条）。补法：加 2026-03-08 和 2026-11-01 前后的 `yesterdayUtc`、`lastNDaysUtc(30)` 用例。
3. **`formatBytes` 在 1024 倍数附近取整，实际大小和上限显示成同一个值。** `src/utils/format.ts:25-34`。我复现了：`formatBytes(1048575)` 得 "1,024 KB"；上限 1 MB、文件 1048577 字节时两者都显示 "1 MB"。后果：后面任务若写"文件 X，上限 Y"，会出现"文件 1 MB，超过上限 1 MB"（提示文字让人困惑，不影响拦截对错）。补法：提高小数位，或两值显示相同时多给一位，并加边界测试。
4. **文件签名检查被削弱时测试不变红。** `src/utils/imageHeader.ts:21-24、:129、:126`。步骤（各自单独做，22 个用例全过）：PNG 签名只比前 4 字节；去掉 IHDR 长度必须为 13；JPEG 只比 `FF D8`；ZIP 只比 `PK`；SOF 去掉 `length < 7`；去掉 `length < 2`。后果：非 PNG/JPEG/ZIP 的文件可能被判为合法类型，畸形文件读出垃圾宽高（服务端兜底，所以是拦截变宽，不是数据损坏）。补法：每项加一个"差一位就拒绝"的用例。
5. **`formatInstant` 的严格 ISO 正则没有测试守着。** `src/utils/format.ts:4、:30`，测试 `src/utils/format.test.ts:30`。步骤：删掉 `if (!ISO_INSTANT.test(iso)) return iso;`，9 个用例全过。我复现了当前行为：`'2026-10-21'` 和 `'2026-10-21T10:00:00'` 原样返回；去掉正则后会被当 UTC 时刻按浏览器时区显示，新加坡显示 `10/21/2026, 08:00:00`。后果：统计日被显示成带时刻的错误值。补法：加这两个输入原样返回的断言。
6. **IPv6 主机比真 IPv6 宽，且无法对照权威正则。** `src/utils/linkRule.ts:18`。我复现了：`https://[:]` 通过，`https://[1.2.3.4]` 和 `[fe80::1%25eth0]` 被拒。契约 §1.7 只给文字版，Android 的 `HttpsLink.PATTERN` 不在快照里，也不在 `docs/backend-inputs/` 和计划里，我还没查清真正写法。后果：若客户端更严，后台表单会放过客户端会隐藏的畸形 IPv6 链接（要有人手输畸形 IPv6 才触发）。处理：已写问题文件 `docs/contract-requests/2026-10-26-admin-frontend-link-pattern.md`，拿到原文后让测试逐字对照。

### 不是缺陷（已核对）

1. 链接原因的先后（协议、主机、端口、路径，最后才是长度）：契约和计划都没规定后端的顺序，400 的结果一致，只有显示的原因文字可能不同；`linkRule.test.ts` 固定了这个顺序。
2. 图片头读不出宽高时跳过像素检查、放行：依据后端回复三第 4 条（取不到就不做提前检查，服务端是最终把关），`uploadLimits.test.ts` 有用例。
3. `describeUploadLimits` 里的中英文像素单位写在 `.ts` 里：任务书明确要该函数按 locale 返回这类文字；"不写死文字"的规则管 `.tsx`。其他 locale 退回英文，界面只有两种语言。
4. `-0%`、`-0`（需要负分母或 -0 才出现，统计里取不到），`lastNDaysUtc(0)`/小数/负数不校验（目前没有调用方，计划里固定 7 或 30）：都不出现 NaN、Infinity、`null%`。若后面页面把用户输入直接传进去，那时按"变更"处理。
5. 其余按任务书逐项核对均正确：29 个码点在整个 BMP 上"当且仅当"检查；链接规则探针、UTC 日（两个时区、月年闰日夏令时）、零分母、敌意文件（6 MiB 填充字节只读 4 MiB）、检查顺序、对比度（白对 `#0ABAB5` 约 2.4，`#06201F` 约 7）。

## 我自己做的取舍（请确认）

- `resolveInitialLocale` 只看浏览器第一语言：`['th-TH','zh-CN']` 得 en-US。任务书写"任何 zh 开头归 zh-CN"，没说是第一语言还是任一语言。
- `formatBytes` 按 1024 进制、标签写 MB（后端的限制值都是 1024 的倍数：1048576、2097152、209715200）。
- 图片头读不出宽高：跳过像素检查（见上"不是缺陷"第 2 条）。
- 链接规则的 IPv6 字符集：十六进制数字、冒号、点，至少一个冒号（见记录第 6 条）。

## 未完成项

立即修未修 0、记录项 6（上面 1 到 6）、未运行 0、阻塞 0。

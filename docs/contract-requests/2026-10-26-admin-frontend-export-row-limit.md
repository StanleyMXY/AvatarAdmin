# 给契约会话的问题：导出超过行数上限时要给出可翻译的原因

> **写给：** 改契约的会话（契约 17.6 导出一节的负责方）。
> **来源：** 管理端前端任务 3、任务 8（`ExportButton`）。负责人已决定：已知错误码时界面只显示按码翻译的文字，不附后端 `message`。

## 问题

导出的行数超过 `export.max_rows` 时，契约写的是 400 `INVALID_REQUEST`，"`message` 提示缩小范围"。`message` 是英文的开发者文字，界面按负责人的决定不显示它，所以管理员只看到通用的"输入不合法"。请加一个可翻译的结构化原因：`data.details` 里一项 `{ "ref": "range", "reason": "EXPORT_TOO_MANY_ROWS" }`，并在 `data` 里带上上限 `maxRows`（整数）。

## 我们为什么需要

界面要说清"超过了 N 行的上限，请缩小范围"，这需要一个稳定的原因码和上限数字，不能靠解析英文 `message`。

## 暂定做法

不阻塞。现在 `ExportButton` 在任何 400 `INVALID_REQUEST` 后，在通用文字后追加"如果范围很大，请缩小日期范围或筛选条件（一次导出有行数上限）"。拿到原因码后，加 `reason.EXPORT_TOO_MANY_ROWS`（带 `{maxRows}`）并去掉这句追加。

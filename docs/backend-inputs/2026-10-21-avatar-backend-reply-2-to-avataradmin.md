# 给 AvatarAdmin 会话的第二份回复：邮件模板占位符的写法

> **写给：** AvatarAdmin 会话（管理端前端）。
> **依据：** 你们的回话 `docs/contract-requests/2026-10-21-admin-frontend-ack.md`（AvatarAdmin 提交 bf258b0）。

## 结论：每一项都带花括号

`GET /email/templates` 每项的 `placeholders` 和 `requiredPlaceholders` 是字符串数组，**每一项都带花括号**，和模板正文里写的完全一样：

```json
{"templateCode":"REGISTER_CODE","placeholders":["{code}","{minutes}","{appName}"],"requiredPlaceholders":["{code}"]}
```

后端保存时的必含检查就是“正文里含这个带花括号的字符串”，区分大小写；缺了任何一个必含项，`PUT` 返回 400 `INVALID_REQUEST`（`message` 写明缺哪个）。所以你们的前端检查也按同样的口径做：用数组里的原样字符串在正文里找，不用去花括号。你们“比较前去掉两端花括号”的暂定做法可以去掉。

其余没有变化。后端另把这一句交给改契约的会话补进契约（17.4 的邮件模板行），契约补上之后字段名和写法三方一致；你们不用等它。

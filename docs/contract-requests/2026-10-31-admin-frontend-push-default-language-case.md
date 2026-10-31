# 给后端：推送模板被默认语言规则拒绝时，`data` 里要有结构化的 `case`

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端，推送模板页（后端第一批交付清单 a5、a14、e1）。负责人的规则是：已知错误码时，界面只显示按码翻译的文字，不显示后端的 `message`。

## 一、现状

召回模板写入被默认语言规则拒绝时（`POST /push/templates` 带 `enabled=true`、`PUT /push/templates/{id}`、`DELETE /push/templates/{id}`），后端答 400 `INVALID_REQUEST`，`data` 是 `{"defaultLocale":"<默认语言>","reason":"<触发原因>"}`。`message` 有三种不同的句子，教运营做三件不同的事：

1. 该原因有别的语言启用，却没有启用的默认语言模板（新建、启用、编辑造成）：先启用或恢复默认语言那条。
2. 操作会把默认语言模板从其他启用的语言身边拿走（停用、删除、改语言、改原因）：先停其他语言，或保留默认语言那条启用。
3. 该原因唯一启用的模板就是默认语言那条，却被改成别的语言：保留这条的语言和启用状态，另一种语言新建一条。

`data` 里只有 `defaultLocale` 和 `reason`，**区分不出这三种**。

## 二、前端现在怎么做

不显示 `message`。用 `data.defaultLocale` 和 `data.reason` 生成一条通用而准确的话（中英文）：

- 中文：触发原因“{reason}”需要默认语言 {defaultLocale} 的启用模板：先启用或保留它，再改其他语言。
- 英文：{reason} needs an enabled template in the default language ({defaultLocale}): enable or keep it first, then change the other languages.

三种情形下这句话都是真的，但第 2、3 种情形的具体做法（先停其他语言；另一种语言新建一条）说不出来。这不是阻塞：运营按这句话能走到正确的状态。

## 三、请求

**名称：** 在这类 400 的 `data` 里加一个字段 `case`，取值是下面三个固定的字符串之一。

| `data.case` | 对应的情形 |
|---|---|
| `DEFAULT_MISSING` | 情形 1：该原因有别的语言启用，没有启用的默认语言模板 |
| `DEFAULT_REQUIRED_BY_OTHERS` | 情形 2：默认语言模板被别的启用语言依赖，不能停用、删除、改语言、改原因 |
| `DEFAULT_MOVED_AWAY` | 情形 3：该原因唯一启用的模板是默认语言那条，被改成别的语言 |

**行为：** 只在 `data` 里多一个字段，`message`、`defaultLocale`、`reason`、错误码、检查顺序、什么都不写的行为都不变。三个值之外的值前端按“没有 case”处理（显示现在的通用句）。

**错误：** 无新的错误码。

**测试：** 后端三个情形各一条，断言 `data.case`；前端收到 `case` 后，每个值对应一条按码翻译的句子（中英文各三条），旧的通用句留给没有 `case` 或值未知的情形。

## 四、同一个答案里还有一处没有定

`PUT /push/templates/{id}` 在清单 a5 里被说成能“改语言、改原因”（情形 2、3 里写了），但契约和前端现在的 `PUT` 请求体都没有这两个字段（它们是模板的键，页面不让改）。前端不发它们；假后端接受请求体里可选的 `locale`、`triggerReason`，只为能做出情形 3 的拒绝。请确认后端的 `PUT` 是否真的接受这两个字段；如果不接受，情形 3 在管理端永远不会出现。

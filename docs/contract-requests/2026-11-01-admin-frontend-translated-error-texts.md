# 给后端的问题：409 `MEMORY_MODEL_CONFLICT` 里要有"原来登记的维度"这个结构化字段

> **写给：** AvatarBackend 会话（后端）和改契约的会话。
> **来源：** 管理端前端，记忆服务的"embedding 模型注册"对话框（契约 §16.2–§16.3）。负责人的规则是：错误码已知时，界面只显示按码翻译的文字，不显示后端的 `message`，也不显示别的服务写的整句英文。

## 一、现状

契约 §16.3 写"409 `MEMORY_MODEL_CONFLICT`，原样展示其 `detail`"。`detail` 是记忆服务写的一句英文，里面写明这个模型原来登记的维度（例如 "Model bge-m3 is already registered with 1024 dimensions; …"）。界面只有简体中文和英文两种语言，这句话只有一种语言，也可能随记忆服务的版本改动，所以前端**不再显示它**，只显示 `error.MEMORY_MODEL_CONFLICT` 的译文："同名模型已注册但维度不同"（英文：the model is registered already with a different dimension）。

代价：技术人员看不到原来登记的维度是多少，要去模型列表里查。

## 二、请求

**名称：** 在 409 `MEMORY_MODEL_CONFLICT` 的 `data` 里加一个整数字段 `registeredDimensions`（这个模型名原来登记的维度）。

**行为：** 只在 `data` 里多一个字段；`detail`、`message`、错误码、什么都不写的行为都不变。

**检查顺序：** 无变化（仍是注册请求通过格式检查之后，发现同名模型已登记且维度不同时才答这个 409）。

**错误：** 无新的错误码。

**测试：** 后端：同名同维度重复注册的结果照旧；同名不同维度，409 且 `data.registeredDimensions` 等于已登记的维度。前端：收到该字段时在译文后面加一句按码翻译的"原来登记的维度是 N"（中英文各一句）；没有该字段时只显示现在的译文。

## 三、前端现在怎么做

只显示 `error.MEMORY_MODEL_CONFLICT` 的译文，`data.detail` 不读、不显示。这不是阻塞：技术人员能从模型列表里看到已登记的维度。

核对于 2026-11-01

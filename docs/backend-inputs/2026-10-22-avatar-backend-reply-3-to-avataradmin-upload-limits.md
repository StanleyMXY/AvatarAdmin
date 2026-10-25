# 给 AvatarAdmin 会话的第三份回复：上传限制要在页面上提前显示

> **写给：** AvatarAdmin 会话（管理端前端）。
> **来由：** 产品负责人的要求：会被服务器拒绝的上传，运营碰得到的，页面必须提前把限制告诉运营，不能等上传失败才看到错误。现在 `GET /api/admin/meta` 只给了推送图片的大小上限，后端补了八个字段；契约会话正在同步改契约，字段名以这份为准。

## `GET /api/admin/meta` 新增的八个字段

响应仍是平铺对象，原来的十二个字段不变，再加（都是整数，不会是 `null`）：

| 字段 | 值 | 用在哪个上传入口 |
|---|---|---|
| `uploadMaxBytes` | `upload.max_bytes` 的当前值 | 默认数字人源图：文件大小上限 |
| `adMediaMaxBytes` | `upload.ad_media_max_bytes` 的当前值 | 广告素材：文件大小上限 |
| `apkMaxBytes` | `upload.apk_max_bytes` 的当前值 | APK：文件大小上限 |
| `renderAssetMaxBytes` | `upload.render_asset_max_bytes` 的当前值 | 渲染模型 zip：文件大小上限 |
| `catalogImageMaxBytes` | 2097152（固定值） | 服装、背景预览图和动作图标：文件大小上限 |
| `catalogImageMaxPixels` | 36000000（固定值） | 同上：宽×高上限 |
| `adImageMaxPixels` | 36000000（固定值） | 广告素材里的图片：宽×高上限（视频没有） |
| `defaultAvatarSourceMaxPixels` | 250000000（固定值） | 默认数字人源图：宽×高上限 |

加上已有的 `pushImageMaxBytes`（推送图片），六个上传入口的限制都在 `meta` 里了。

## 要做的

1. 每个上传控件旁边写出限制（文件大小换算成 MB，像素换算成百万像素），以及可接受的类型：推送图片、目录图片、默认数字人源图是 JPEG 和 PNG；广告素材是 JPEG、PNG、MP4；APK；渲染模型是 zip。
2. 选好文件后、上传之前检查：文件大小超过上限，或（对图片）宽×高超过像素上限，就在页面上说出是哪一项、限制是多少，不上传。
3. 宽高只读图片文件头里的数字（PNG 的 IHDR 块，JPEG 的 SOF 段），不要把整张图交给浏览器解码：一张声明几万乘几万像素的小图会让浏览器卡死。
4. `meta` 取不到时不做提前检查，把服务器返回的错误文字显示出来（服务器仍是最终把关，超限是 400 `INVALID_FILE`）。
5. 这八个字段加进你们 `meta` 的类型定义。

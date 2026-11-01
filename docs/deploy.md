# 部署说明

后台前端是一个纯静态的单页应用：`npm run build` 生成 `dist/`，由 Web 服务器在**和后端同一个域名**下提供，`/api/` 转发给后端，其余路径回退到 `index.html`。

同域的原因：请求层把接口写成相对路径 `/api/admin/...`（`src/request/apiClient.ts`），令牌放在内存和 `sessionStorage`，不用 Cookie，也不带固定令牌；没有跨域配置，也不需要后端开 CORS。如果前端和后端必须不同域，需要在构建前改请求层，本文不涉及。

## 构建

要求 Node `^22.22.1 || >=24.0.0`，用仓库根目录的 `package-lock.json` 安装：

```sh
npm ci            # 或 npm install；postinstall 会运行 max setup
npm run build     # max build，产物在 dist/
```

构建前可以在环境变量或 `.env.local` 里设置下面的构建变量。它们在**构建时**写进产物，运行时改不了；改了要重新构建。非法的值（不是 6 位十六进制的颜色、不是同域路径的 Logo、超出 0 到 1 的阈值）会让构建失败。仓库里没有任何密钥。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ADMIN_PRODUCT_NAME` | `Admin` | 浏览器标签页标题和顶栏的产品名 |
| `ADMIN_LOGO_URL` | `/logo.svg` | Logo，必须是以单个 `/` 开头的同域路径（文件放在 `public/` 下），不能是外部地址 |
| `ADMIN_PRIMARY_COLOR` | `#0ABAB5` | 主色（6 位十六进制） |
| `ADMIN_PRIMARY_HOVER` | `#3DCBC7` | 主色悬停 |
| `ADMIN_PRIMARY_ACTIVE` | `#089A96` | 主色按下 |
| `ADMIN_QUALITY_MIN_SUCCESS_RATE` | `0.95` | 通话质量页：接通成功率低于它时卡片画红框（0 到 1 的小数） |
| `ADMIN_QUALITY_MAX_SLOW_SHARE` | `0.05` | 通话质量页：超过 10 秒才接通的占比高于它时卡片画红框（0 到 1 的小数） |

`ADMIN_API_PROXY_TARGET` 只用于开发（`npm run dev:api` 把 `/api/` 代理到它），**不进产物**，部署时不用设置。

产物里没有 `mock/` 的任何内容（假后端只在开发服务器里运行）。

## 产物的缓存规则

`dist/` 里的脚本和样式文件名带内容哈希（例如 `umi.adf3beea.js`、`p__users__list.61538c69.async.js`），内容变了文件名就变，所以可以长期缓存。三个例外：

- `index.html`：不带哈希，它指向当前版本的脚本，**不能缓存**（`no-cache`），否则发布后用户拿着旧入口，找不到已被清掉的旧文件。
- `logo.svg` 和 `public/` 下的其他文件：不带哈希，用短缓存或让浏览器每次校验。其中 `preload-theme.js` 在 `index.html` 的 `<head>` 里引用、在页面绘制之前运行（先把保存的主题底色铺好，避免打开时闪一下别的颜色）：它和 `index.html` 一起发布；下面的 nginx 示例里它落在最后一个 `location /`，响应带 `no-cache`；它是同域脚本，所以后面的内容安全策略 `script-src 'self'` 允许它。
- 发布时先上传带哈希的新文件，最后再换 `index.html`；旧的哈希文件至少保留一段时间（正在使用的页面还会按需加载旧的分块），之后再清理。

## nginx 示例

下面是一份完整的站点配置，后端假设监听在 `127.0.0.1:8080`，前端文件放在 `/srv/avatar-admin`（把 `dist/` 的内容放进去）。域名、证书路径和后端地址按实际情况改。

```nginx
server {
    listen 443 ssl http2;
    server_name admin.example.com;

    ssl_certificate     /etc/ssl/admin.example.com/fullchain.pem;
    ssl_certificate_key /etc/ssl/admin.example.com/privkey.pem;

    root  /srv/avatar-admin;
    index index.html;

    # 这一级不写 add_header：只要某个 location 自己写了 add_header，就不会再继承这一级的，写在这里的头会在
    # 部分 location 里悄悄消失，在 /api/ 里又可能和后端自己加的头重复。每个 location 自己写它需要的头。
    # Referrer-Policy 用 no-referrer：被审核内容的文件地址是带签名的短时效地址，不要通过 Referer 发出去。

    # 接口：原样转发给后端（保留 /api/ 前缀）。后端已经在响应里自己加了安全响应头（X-Content-Type-Options
    # 等），这里不要再给 /api/ 加它们（否则同一个头出现两次）：这个 location 只加 Cache-Control。
    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # 导出和上传可能较大、较慢；上传的上限也要和后端的上传上限一致（最大的是 APK，100 MB）。
        client_max_body_size 110m;
        proxy_read_timeout   120s;
        proxy_send_timeout   120s;
        # 接口响应不要被中间层缓存（里面有个人数据和签名地址）。
        add_header Cache-Control "no-store" always;
    }

    # 带内容哈希的脚本和样式：长期缓存。
    # 正则里有花括号，必须加引号，否则 nginx -t 报 unknown directive。Cache-Control 不加 always：
    # 找不到文件的 404 不能带一年的缓存期，否则发布中途（新入口已换、新文件还没传完）被浏览器记住 404。
    location ~* "\.[0-9a-f]{8}\.(?:[a-z]+\.)?(?:js|css)$" {
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
        try_files $uri =404;
    }

    # 入口页：不缓存。
    location = /index.html {
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
    }

    # 其余静态文件（logo.svg 等没有哈希的）：每次校验。
    location ~* \.(?:svg|png|ico|woff2?)$ {
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
        try_files $uri =404;
    }

    # 单页应用：浏览器路由的地址（/users/42、/stat/daily ...）回退到 index.html。
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "no-referrer" always;
    }
}

server {
    listen 80;
    server_name admin.example.com;
    return 301 https://$host$request_uri;
}
```

注意：

- nginx 里 `add_header` 写在某个 `location` 里时，会**覆盖**（不是叠加）外层 `server` 里的 `add_header`。所以上面 `server` 一级没有 `add_header`，每个 `location` 自己写需要的头；改配置时不要在 `server` 一级加头，也不要漏掉某个 `location`。
- **`/api/` 的响应不会重复这些安全头。** 后端在它的响应里自己加了一组安全响应头（后端清单的第 4 节第 10 条说是六个，只点名了 `Content-Security-Policy: default-src 'none'`），nginx 转发时原样带上；`/api/` 的 `location` 里只有一条 `add_header Cache-Control`，所以 nginx 自己不会再给 `/api/` 加这些头（用 nginx 1.24 和一个返回 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Content-Security-Policy` 的假后端实测：`/api/` 响应里它们各出现一次，都来自后端）。如果有人在 `server` 一级加了 `add_header`，又把 `/api/` 里的 `add_header` 去掉，这些头就会在 `/api/` 的响应里出现两次（同样实测过）；`/api/` 里加了 `Cache-Control` 之后，如果后端自己也发 `Cache-Control`，响应里会有两个值，发布后用 `curl -i` 看一次（见"发布后的检查"）。
- **前端的静态文件要由上面的 nginx（或别的静态文件服务器）提供，不要由后端的 admin 应用提供。** 后端给响应加的内容安全策略是 `default-src 'none'`（后端清单第 4 节第 10 条；它加在哪些响应上还没有答复），如果静态页面也经过那条规则，脚本和样式都加载不出来。后端会不会这样处理自己提供的页面，本仓库核实不了，已写成给后端的问题（`docs/contract-requests/2026-10-31-backend-question-static-files-and-security-headers.md`）。
- 找不到的文件（例如旧的哈希文件）要返回 404，不要回退到 `index.html`，否则浏览器会把 HTML 当脚本解析，页面白屏；上面哈希文件的 `location` 用了 `try_files $uri =404`。
- 这份配置的语法和响应头已在 nginx 1.24 上验证过（`nginx -t` 通过；用一个固定返回安全头的假后端，逐个 `location` 用 `curl -i` 看响应头）；没有验证的是证书、HTTP/2 和真实后端。上线前仍用 `nginx -t` 检查语法，并在预发环境走一遍：登录、刷新一个深层地址（例如 `/users/42`）、导出一个文件、上传一张图。

### 内容安全策略（可选，需要先在预发环境验证）

产物的 `index.html` 里没有内联脚本，脚本都来自同域，所以可以收紧 `script-src`。Ant Design 的样式在运行时写成 `<style>`，所以 `style-src` 要允许 `'unsafe-inline'`。被审核内容（图片、音频、视频）和上传素材的地址是后端给的 https 地址（可能是另一个域名的对象存储），要加进 `img-src` 和 `media-src`。一个起点（**没有验证过，上线前务必在预发环境的真实页面上逐页检查浏览器控制台**）：

这一行要写在 `location = /index.html` 和 `location /` 里（和那里的其他 `add_header` 放一起），**不要**写在 `server` 一级：`server` 一级的 `add_header` 不会被这些 `location` 继承（实测：写在 `server` 一级，`/` 的响应里没有这个头），也不要写进 `/api/`（后端自己已经带了内容安全策略）。

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self'; frame-src https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
```

`frame-src https:` 是投诉证据里的 PDF 用 `iframe` 显示；如果不需要显示 PDF，可以去掉。

## 发布后的检查

1. 打开 `https://<域名>/`，登录（用户名、密码、验证码三步）。
2. 直接在地址栏打开一个深层地址（例如 `/users/list`）并刷新，应该回到该页面（没登录时跳到登录页，登录后回到原地址）。
3. 浏览器开发者工具的网络面板：接口请求都是 `/api/admin/...`，没有跨域请求，没有请求带固定令牌；令牌只在 `Authorization` 头里。再用 `curl -i https://<域名>/api/admin/meta`（带或不带令牌都行，401 也有响应头）看响应头：`X-Content-Type-Options`、`Content-Security-Policy` 等安全头各只出现一次，`Cache-Control` 只出现一次；`curl -i https://<域名>/` 的响应有 `X-Frame-Options: DENY`。
4. 搜索产物：`grep -r "mock-password" dist/` 应该没有结果。
5. 登出后再按浏览器的后退，应该停在登录页（令牌放在 `sessionStorage`，关闭标签页即清除）。

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
- `logo.svg` 和 `public/` 下的其他文件：不带哈希，用短缓存或让浏览器每次校验。
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

    # 通用安全头。Referrer-Policy 用 no-referrer：被审核内容的文件地址是带签名的短时效地址，不要通过 Referer 发出去。
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;

    # 接口：原样转发给后端（保留 /api/ 前缀）。
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
    location ~* \.[0-9a-f]{8}\.(?:[a-z]+\.)?(?:js|css)$ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
        try_files $uri =404;
    }

    # 入口页：不缓存。
    location = /index.html {
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer" always;
    }

    # 其余静态文件（logo.svg 等没有哈希的）：每次校验。
    location ~* \.(?:svg|png|ico|woff2?)$ {
        add_header Cache-Control "no-cache" always;
        try_files $uri =404;
    }

    # 单页应用：浏览器路由的地址（/users/42、/stat/daily ...）回退到 index.html。
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
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

- nginx 里 `add_header` 写在某个 `location` 里时，会**覆盖**外层 `server` 里的 `add_header`，所以上面每个 `location` 里重复写了需要的头。改配置时不要漏。
- 找不到的文件（例如旧的哈希文件）要返回 404，不要回退到 `index.html`，否则浏览器会把 HTML 当脚本解析，页面白屏；上面哈希文件的 `location` 用了 `try_files $uri =404`。
- 这份配置没有在 nginx 里实际运行验证过（写文档的环境里没有 nginx）；上线前用 `nginx -t` 检查语法，并在预发环境走一遍：登录、刷新一个深层地址（例如 `/users/42`）、导出一个文件、上传一张图。

### 内容安全策略（可选，需要先在预发环境验证）

产物的 `index.html` 里没有内联脚本，脚本都来自同域，所以可以收紧 `script-src`。Ant Design 的样式在运行时写成 `<style>`，所以 `style-src` 要允许 `'unsafe-inline'`。被审核内容（图片、音频、视频）和上传素材的地址是后端给的 https 地址（可能是另一个域名的对象存储），要加进 `img-src` 和 `media-src`。一个起点（**没有验证过，上线前务必在预发环境的真实页面上逐页检查浏览器控制台**）：

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self'; frame-src https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
```

`frame-src https:` 是投诉证据里的 PDF 用 `iframe` 显示；如果不需要显示 PDF，可以去掉。

## 发布后的检查

1. 打开 `https://<域名>/`，登录（用户名、密码、验证码三步）。
2. 直接在地址栏打开一个深层地址（例如 `/users/list`）并刷新，应该回到该页面（没登录时跳到登录页，登录后回到原地址）。
3. 浏览器开发者工具的网络面板：接口请求都是 `/api/admin/...`，没有跨域请求，没有请求带固定令牌；令牌只在 `Authorization` 头里。
4. 搜索产物：`grep -r "mock-password" dist/` 应该没有结果。
5. 登出后再按浏览器的后退，应该停在登录页（令牌放在 `sessionStorage`，关闭标签页即清除）。

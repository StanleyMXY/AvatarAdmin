# 部署说明

后台前端是一个纯静态的单页应用：`npm run build` 生成 `dist/`，由 Web 服务器在 **Admin 站点自己的域名**下提供；同一个域名下，`/api/` 转发给后端的 admin 应用，其余路径回退到 `index.html`。

同域的原因：请求层把接口写成相对路径 `/api/admin/...`（`src/request/apiClient.ts`）；登录后后端签发一个令牌，前端把它放在内存和 `sessionStorage`，每个请求用 `Authorization: Bearer` 头带上它，不用 Cookie。所以没有跨域配置，也不需要后端开 CORS。如果前端和后端必须不同域，需要在构建前改请求层，本文不涉及。

## 取得代码

你需要的只有一个 GitLab 私有库：部署副本 `http://172.16.118.106/mxy/AvatarAdmin.git`（代码、配置、测试和本文档）。选一个工作目录（下面用 `~/avatar`），把它克隆进去。这个库是私有库，克隆和以后的 `git pull` 都需要凭据：

1. 在 GitLab 上建一个个人访问令牌（用户设置里的“访问令牌”页），权限只勾选 `read_repository`（只读仓库）。这个账号要对 `AvatarAdmin` 项目有读权限。
2. 用 git 的 credential helper 保存令牌，二选一：
   - 只在内存里缓存一段时间：`git config --global credential.helper 'cache --timeout=3600'`。过了超时（这里是 3600 秒）再用 git 会重新询问。
   - 保存到磁盘：`git config --global credential.helper store`。令牌会以明文写进 `~/.git-credentials`，所以先限权 `chmod 600 ~/.git-credentials`（文件在第一次认证后才生成，生成后立即执行），不再需要时删除该文件，并执行 `git config --global --unset credential.helper`。
3. 第一次克隆时 git 会询问用户名和密码：用户名填 GitLab 用户名，密码填令牌。填过之后 helper 会记住，以后的 `git pull` 不会再问（`cache` 超时后会再问一次）。
4. 不要把令牌写进克隆地址（`http://用户:令牌@...`），那样令牌会留在仓库的 `.git/config` 里。内网地址是 HTTP，令牌在网络上不加密传输。

```sh
mkdir -p ~/avatar && cd ~/avatar
git clone http://172.16.118.106/mxy/AvatarAdmin.git
cd AvatarAdmin
```

后面的命令都在 `AvatarAdmin` 目录（仓库根目录）里执行。升级和回滚见最后一节。`.env.local`、`dist/` 被 git 忽略，`public/` 里自己加的文件（例如自定义 Logo）是未跟踪文件，它们都不会挡住 `git pull --ff-only`。

## 构建

先用 `node -v` 确认版本满足 `^22.22.1 || >=24.0.0`。`.npmrc` 没开 engine-strict，版本不够时 `npm ci` 只给警告，之后在别处才报错；没有合适的版本时，用 nvm（`nvm install 24`）或 Node 官方的 22.22.1 以上、24 的安装包装一个。`@umijs/max` 在 devDependencies 里：主机若设了 `NODE_ENV=production`（`echo $NODE_ENV` 查看），`npm ci` 会跳过它，之后安装或构建就找不到 `max` 而失败，要先 `unset NODE_ENV`，或者用 `npm ci --include=dev`。构建机要能访问 npm 仓库 `registry.npmjs.org`（`package-lock.json` 里的包都从它下载）。

```sh
npm ci            # 严格按 package-lock.json 安装，不改动它；postinstall 会运行 max setup
npm run build     # max build，产物在 dist/
```

`npm ci` 还会运行 `prepare` 脚本（`husky`），它只给这个克隆配置本地的提交钩子，部署用不到，也不用处理。

构建前可以在环境变量或 `.env.local`（`cp .env.example .env.local` 后编辑）里设置下面的构建变量。它们在**构建时**写进产物，运行时改不了；改了要重新构建。同名的变量在 `.env.local` 和环境变量里都有时，以 `.env.local` 为准。非法的值（不是 6 位十六进制的颜色、不是同域路径的 Logo、超出 0 到 1 的阈值）会让构建失败，而且失败发生在 `npm ci`（它的 postinstall 就会加载配置），不是等到 `npm run build`；改正后重新 `npm ci`。仓库里没有任何密钥。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `ADMIN_PRODUCT_NAME` | `Admin` | 浏览器标签页标题和顶栏的产品名 |
| `ADMIN_LOGO_URL` | `/logo.svg` | Logo，必须是以单个 `/` 开头的同域路径，不能是外部地址。自定义 Logo 时把文件放进 `public/`，这里填 `/文件名` |
| `ADMIN_PRIMARY_COLOR` | `#0ABAB5` | 主色（6 位十六进制） |
| `ADMIN_PRIMARY_HOVER` | `#3DCBC7` | 主色悬停 |
| `ADMIN_PRIMARY_ACTIVE` | `#089A96` | 主色按下 |
| `ADMIN_QUALITY_MIN_SUCCESS_RATE` | `0.95` | 通话质量页：接通成功率低于它时卡片画红框（0 到 1 的小数） |
| `ADMIN_QUALITY_MAX_SLOW_SHARE` | `0.05` | 通话质量页：超过 10 秒才接通的占比高于它时卡片画红框（0 到 1 的小数） |

`.env.local` 里值带 `#` 时**必须加双引号**：读取环境文件时，不带引号的 `#` 是注释的开头，`ADMIN_PRIMARY_COLOR=#123456` 会被读成空值，构建不报错，主色静默回退成默认色（产品名里有 `#` 同理）。

```sh
ADMIN_PRODUCT_NAME=Acme Admin
ADMIN_PRIMARY_COLOR="#123456"
ADMIN_PRIMARY_HOVER="#2F5A85"
ADMIN_PRIMARY_ACTIVE="#0E2D4D"
```

构建并发布后，用浏览器打开登录页，确认主按钮的颜色是你设的值，不是默认的青色 `#0ABAB5`；如果还是默认色，说明这个值没有读进去，检查引号。

`ADMIN_API_PROXY_TARGET` 只用于开发（`npm run dev:api` 把 `/api/` 代理到它），**不进产物**，部署时不用设置。

## 产物的缓存规则

`dist/` 里的脚本和样式文件名带内容哈希（例如 `umi.adf3beea.js`、`p__users__list.61538c69.async.js`），内容变了文件名就变，所以可以长期缓存。两个例外：

- `index.html`：不带哈希，它指向当前版本的脚本，**不能缓存**（`no-cache`），否则发布后用户拿着旧入口，找不到已被清掉的旧文件。
- `logo.svg` 和 `public/` 下的其他文件：不带哈希，用短缓存或让浏览器每次校验。其中 `preload-theme.js` 在 `index.html` 的 `<head>` 里引用、在页面绘制之前运行（先把保存的主题底色铺好，避免打开时闪一下别的颜色）；下面的 nginx 示例里它落在最后一个 `location /`，响应带 `no-cache`。

发布顺序：先上传带哈希的新文件和其他资源，**最后**再换 `index.html`；旧的哈希文件至少保留到下一次发布之后（正在使用的页面还会按需加载旧的分块）。

## 发布

`dist/` 的内容放进 `/srv/avatar-admin`（nginx 的 `root`）。两步，顺序不能换：

```sh
rsync -a --exclude index.html dist/ /srv/avatar-admin/    # 第一步：所有哈希文件和其他资源
rsync -a dist/index.html /srv/avatar-admin/               # 第二步：最后换入口
```

没有 rsync 时，等价的写法：

```sh
(cd dist && find . -type f ! -name index.html -exec cp --parents -p {} /srv/avatar-admin/ \;)
cp -p dist/index.html /srv/avatar-admin/
```

**不要**用会清掉旧文件的同步方式（`rsync --delete`、先清空 `/srv/avatar-admin` 再复制）：旧哈希文件一没，还开着旧页面的用户就会加载分块失败。

每次发布后，把这一版的文件清单记下来，清理时用：

```sh
mkdir -p ~/avatar/releases
(cd dist && find . -type f | LC_ALL=C sort) > ~/avatar/releases/$(git rev-parse --short HEAD).txt
```

清理旧文件在**下一次发布成功之后**做，只删最近两次发布都不再用的文件（本版和上一版的文件都保留）：

```sh
cd ~/avatar/releases
ls -t *.txt | head -2 | xargs cat | LC_ALL=C sort -u > /tmp/keep.txt     # 最近两次发布的清单
cd /srv/avatar-admin
find . -type f | LC_ALL=C sort | LC_ALL=C comm -23 - /tmp/keep.txt > /tmp/stale.txt
cat /tmp/stale.txt                                                       # 先看一遍要删的文件
xargs -d '\n' -r rm -- < /tmp/stale.txt                                  # 确认后删除
```

## nginx 示例

下面是 **Admin 站点自己的域名**（示例里的 `admin.example.com`）的 server 块。后端对外的 API 站点是另一个域名、另一个 server 块（见后端部署文档的“反向代理”，那里 `/api/admin/` 返回 404，管理接口只走 Admin 站点）。如果这个域名下已有 server 块，把下面各 `location`（和 `gzip` 设置）加进那个块，不要再建第二个同名的 `server`。

`proxy_pass` 的地址默认是 `127.0.0.1:8080`，即后端 admin 应用的业务端口，适用于它和 nginx 在同一台机器上；不在同一台机器时，改成它的内网地址和端口（端口见后端部署文档的端口表）。前端文件放在 `/srv/avatar-admin`。域名、证书路径按实际情况改。

```nginx
server {
    listen 443 ssl;
    http2 on;                       # nginx 1.25.1 及以后；更早的版本不认识 http2 指令，删掉这一行，上一行改成 listen 443 ssl http2;
    server_name admin.example.com;

    ssl_certificate     /etc/ssl/admin.example.com/fullchain.pem;
    ssl_certificate_key /etc/ssl/admin.example.com/privkey.pem;

    root  /srv/avatar-admin;
    index index.html;

    gzip       on;
    gzip_vary  on;
    gzip_types text/css text/javascript application/javascript image/svg+xml;   # index.html（text/html）默认就压缩

    # 这一级不写 add_header：只要某个 location 自己写了 add_header，就不会再继承这一级的，写在这里的头会在
    # 部分 location 里悄悄消失。每个 location 自己写它需要的头。
    # Referrer-Policy 用 no-referrer：被审核内容的文件地址是带签名的短时效地址，不要通过 Referer 发出去。

    # 接口：原样转发（保留 /api/ 前缀）。响应头由后端设置，这个 location 里一个 add_header 也不写
    # （nginx 的 add_header 是追加，不是替换，再写就会出现重复的头）。
    # ^~ 让它不会被后面按扩展名匹配的正则抢走。
    location ^~ /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # 导出和上传可能较大、较慢；上传的上限也要和后端的上传上限一致（最大的是 APK，后端默认 100 MB）。nginx 默认先缓冲整个请求体再转发，后端要求上传带 `Content-Length`，所以不要给 `/api/` 加 `proxy_request_buffering off;`。
        client_max_body_size 110m;
        proxy_read_timeout   120s;
        proxy_send_timeout   120s;
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

怎么装上去：

1. 配置文件：Debian/Ubuntu 放 `/etc/nginx/sites-available/avatar-admin`，再 `ln -s` 到 `/etc/nginx/sites-enabled/`，并删掉 `sites-enabled/default`；RHEL 系放 `/etc/nginx/conf.d/avatar-admin.conf`，并去掉默认站点（`conf.d/default.conf` 或 `nginx.conf` 里的默认 `server`）。域名下已有 80 端口的 server 块时，不要再建第二个。
2. 证书和私钥放到示例里的路径（`fullchain.pem` 是证书加中间证书链，`privkey.pem` 是私钥，属主 root，权限 600），或把路径改成你的。
3. nginx 的工作进程要能读 `/srv/avatar-admin`：`sudo mkdir -p /srv/avatar-admin && sudo chown $USER /srv/avatar-admin`（让发布命令不需要 sudo），发布后 `chmod -R a+rX /srv/avatar-admin`。
4. `sudo nginx -t && sudo nginx -s reload`。

注意：

- nginx 里 `add_header` 写在某个 `location` 里时，会**覆盖**（不是叠加）外层 `server` 里的 `add_header`。所以 `server` 一级没有 `add_header`，每个 `location` 自己写需要的头；改配置时不要在 `server` 一级加头，也不要漏掉某个 `location`。
- `/api/` 响应的安全头（含 `Cache-Control: no-store`）由后端设置，见后端部署文档；后端部署文档里也有反向代理后面后端要做的配置（受信任代理的网段等）。
- 前端的静态文件要由上面的 nginx（或别的静态文件服务器）提供，`/api/` 以外的路径不要转给后端的 admin 应用。
- 找不到的文件（例如旧的哈希文件）要返回 404，不要回退到 `index.html`，否则浏览器会把 HTML 当脚本解析，页面白屏；上面哈希文件的 `location` 用了 `try_files $uri =404`。

### 内容安全策略

要不要加内容安全策略由你决定；加之前必须拿真实的 `dist/index.html` 核对有没有内联脚本：`grep -o '<script[^>]*>' dist/index.html`，每个 `<script` 都应带 `src=`。有内联脚本时，下面的 `script-src 'self'` 会把它拦掉，不能直接加。

Ant Design 的样式在运行时写成 `<style>`，所以 `style-src` 要允许 `'unsafe-inline'`。被审核内容（图片、音频、视频）和上传素材的地址是后端给的 https 地址（可能是另一个域名的对象存储），要加进 `img-src` 和 `media-src`。下面这一行写在 `location = /index.html` 和 `location /` 里（和那里的其他 `add_header` 放一起），不要写在 `server` 一级（不会被这些 `location` 继承），也不要写进 `/api/`（后端自己已经带了内容安全策略）。加上之后逐页看浏览器控制台有没有被拦截的报告。

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self'; frame-src https:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
```

`frame-src https:` 是投诉证据里的 PDF 用 `iframe` 显示；如果不需要显示 PDF，可以去掉。

## 发布后的检查

`<域名>` 换成 Admin 站点的域名；站点用自签或预发证书时，下面的 `curl` 都加 `-k`。

1. 打开 `https://<域名>/`，登录。已经绑定过第二因素的管理员：输入用户名、密码，页面再要动态验证码，输入后进入。**第一次登录**的新管理员：用户名和密码通过后，页面带着二维码进入“绑定第二因素”，用验证器应用扫码、输入验证码完成绑定；账号被要求改密码时，再进入“修改密码”页，改完才能用其他页面。首个管理员账号由后端创建，用户名和初始密码就是后端部署文档里的 `ADMIN_BOOTSTRAP_USERNAME`、`ADMIN_BOOTSTRAP_PASSWORD`（见其“第一次登录，然后删除引导变量”一步）。
2. 直接在地址栏打开一个深层地址（例如 `/users/list`）并刷新，应该回到该页面（没登录时跳到登录页，登录后回到原地址）。再导出一个文件、上传一张图，确认 `/api/` 的大小限制和超时没挡住。
3. 浏览器开发者工具的网络面板：接口请求都是 `/api/admin/...`，没有跨域请求；登录后的请求带 `Authorization: Bearer <令牌>`，令牌是登录时后端签发的，不是写死在前端里的值。再用 `curl -i https://<域名>/api/admin/meta`（401 也有响应头）看一次：各个安全头只出现一次，`Cache-Control: no-store` 只出现一次。
4. 产物里没有假后端：构建后在仓库根目录执行 `find dist -ipath '*mock*'`，应该没有输出；发布后用下面的命令取 `index.html` 引用的每个文件，状态码应该全是 200：

   ```sh
   curl -s https://<域名>/ | grep -oE '(src|href)="/[^"]+"' | sed -E 's/^[a-z]+="//; s/"$//' | while read -r p; do curl -s -o /dev/null -w "%{http_code} $p\n" "https://<域名>$p"; done
   ```

5. 缓存和 404，各看响应头（`<hash文件>` 是 `ls dist` 里的 `umi.xxxxxxxx.js`）：

   ```sh
   curl -sI https://<域名>/<hash文件>        # 200，Cache-Control: public, max-age=31536000, immutable
   curl -sI https://<域名>/                   # 200，Cache-Control: no-cache
   curl -sI https://<域名>/umi.00000000.js    # 404（状态行是 404，不是回退到 index.html 的 200）
   curl -sI https://<域名>/preload-theme.js   # 200，Content-Type 是 javascript，Cache-Control: no-cache
   ```

6. 登出后再按浏览器的后退，应该停在登录页（令牌放在 `sessionStorage`，关闭标签页即清除）。

## 升级与回滚

升级（先 `cd ~/avatar/AvatarAdmin`）：

```sh
git pull --ff-only
npm ci
npm run build
```

然后按“发布”的两步命令发布，记下文件清单，最后做“发布后的检查”。

回滚：`git log --oneline` 找到要回到的提交，然后

```sh
git checkout <提交>
npm ci
npm run build
```

按“发布”的两步命令发布。旧版本的哈希文件还在 `/srv/avatar-admin` 里，所以回滚也是先传哈希文件、最后换 `index.html`。回滚之后回到最新：`git checkout main`（停在某个提交上时 `git pull --ff-only` 不能用）。

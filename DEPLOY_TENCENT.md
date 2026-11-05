# 腾讯云部署指南（Personal AI Agent Platform）

> 目标：把本项目部署到一台腾讯云服务器上，得到一个可公网访问的网址，
> 支持注册、上传简历、创建 Agent、公开分享链接，并接真实大模型。
>
> 说明：本机的 Windows 环境没有 Docker，所以 `docker compose` 这套栈**没有在本机实际跑过**。
> 为此我按正式部署要求修掉了会直接导致失败的地方（见下面「本仓库为部署做的改动」），
> 并在首次部署时给出验证清单。若首次 `docker compose up` 报错，把日志发我即可。

---

## 0. 先决条件与决策

| 事项 | 建议 |
| --- | --- |
| 云产品 | **轻量应用服务器 Lighthouse**（比 CVM 简单、便宜，自带防火墙面板） |
| 系统镜像 | Ubuntu 22.04 LTS 64位 |
| 规格 | **2 核 4 GB**（构建 Next.js 前端需要内存；预算紧可用 2C2G + 2GB swap） |
| 系统盘 | 60 GB 起 |
| 地域 | 有已备案域名 → 广州/上海/北京；**没有备案域名 → 中国香港/新加坡**（免备案，可马上绑域名） |
| 域名 | 可选。先用 `http://公网IP:3000` 也能完整使用；上域名后走 HTTPS |

> **备案提醒**：大陆地域的服务器绑定域名必须完成 ICP 备案（腾讯云可代办，通常 1–3 周）。
> 不想等就选香港地域（免备案，国内访问延迟略高，约 30–60ms，完全可用）。

登录方式：在轻量应用服务器控制台「重置密码」设置 root 密码，或用 SSH 密钥。
下文命令都以 root 执行（`ssh root@公网IP`）。

---

## 1. 放通端口

轻量应用服务器控制台 → 实例 → **防火墙**，添加/确认规则：

| 端口 | 用途 |
| --- | --- |
| 22/tcp | SSH |
| 80/tcp | HTTP（证书签发需要） |
| 443/tcp | HTTPS |
| 3000/tcp | 可选。若不去防火墙加这条，就在 `.env` 里设 `HTTP_PORT=80`，直接复用 80 |

---

## 2. 上传代码到服务器

代码在本地 `E:\个人简历agent项目`。两种方式，任选其一。

### 方式 A：Git（推荐，后续更新方便）

先在本地把项目推到一个 **私有** 仓库（GitHub / Gitee 都行，注意别把 `.env`、`storage/` 传上去），
然后服务器上：

```bash
mkdir -p /opt && cd /opt
git clone https://github.com/<你的账号>/personal-ai-agent.git
cd personal-ai-agent
```

### 方式 B：打包上传（不建仓库）

在 **本地 Windows PowerShell** 里（项目根目录执行）：

```powershell
cd "E:\个人简历agent项目"
tar --exclude=frontend/node_modules --exclude=frontend/.next --exclude=backend/.venv `
    --exclude=backend/storage --exclude=storage --exclude=.git --exclude=.env `
    -czf pai.tgz .
scp pai.tgz root@公网IP:/opt/
```

服务器上：

```bash
mkdir -p /opt/personal-ai-agent && cd /opt/personal-ai-agent
tar xzf /opt/pai.tgz
```

---

## 3. 安装 Docker

仓库里带了脚本，直接跑：

```bash
cd /opt/personal-ai-agent
sudo bash deploy/tencent/setup-docker.sh
```

脚本做三件事：用腾讯云镜像源装 Docker Engine + compose 插件、配置 `mirror.ccs.tencentyun.com`
镜像加速（国内拉镜像快很多）、设置开机自启。装完确认：

```bash
docker --version
docker compose version
```

如果用的是 2C2G 机器，先加 2GB swap，避免构建时被 OOM kill：

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## 4. 写环境变量

```bash
cd /opt/personal-ai-agent
cp .env.example .env
openssl rand -hex 32   # → 填到 SECRET_KEY
openssl rand -hex 16   # → 填到 POSTGRES_PASSWORD
nano .env
```

`.env` 里必须改的：

```ini
APP_ENV=production
DEBUG=false
SECRET_KEY=<上面 64 位 hex>
POSTGRES_PASSWORD=<上面 32 位 hex>

# 浏览器访问的地址。先用 IP 调试就写 http://公网IP；上域名后改成 https://你的域名
PUBLIC_ORIGIN=http://公网IP

# 前端容器发布到宿主机哪个端口。防火墙没开 3000 时设为 80，直接复用已放通的 80；
# 上了 nginx 反代就把这一行删掉（或设回 3000），让 nginx 独占 80。
HTTP_PORT=80

# 只有 HTTPS 跑通后才改 true，否则浏览器会丢弃登录 cookie
COOKIE_SECURE=false
```

> `SECRET_KEY` 一旦确定就不要改：它同时用于签发 JWT 和加密用户 API Key，改了等于所有登录态失效、
> 已保存的 Key 无法解密。请把它和数据库备份一起保管。

**可选：配置平台级 DeepSeek（所有人都能用真实模型，访客不用自己填 Key）**

```ini
LLM_PROVIDER=openai_compatible
PLATFORM_LLM_BASE_URL=https://api.deepseek.com/v1
PLATFORM_LLM_API_KEY=sk-你的DeepSeekKey
PLATFORM_LLM_MODEL=deepseek-chat
```

注意：DeepSeek 没有 `/embeddings` 接口，**向量模型留空**，检索继续用内置词面向量；
小知识库的兜底逻辑（`FALLBACK_CONTEXT_MAX_CHUNKS=20`）会让回答照常工作。
平台级 Key 意味着公开页访客也在消耗你的额度，已有每 IP 每分钟 20 次的限流。

---

## 5. 构建并启动

```bash
cd /opt/personal-ai-agent
docker compose config >/dev/null && echo "compose ok"   # 语法与变量检查
docker compose up -d --build                            # 首次 5–10 分钟
docker compose ps                                       # 3 个服务应为 healthy
```

首次验证：

```bash
curl -fsS http://127.0.0.1:3000/api/health   # 应返回 status=ok, dialect=postgresql
docker compose logs --tail=50 backend        # 应看到 alembic 迁移完成、uvicorn 启动
```

浏览器打开 `http://公网IP:3000` → 注册 → 创建 Agent → 上传简历 → 对话测试 → 发布 →
用无痕窗口打开 `/a/<slug>` 匿名提问。

---

## 6. 绑定域名 + HTTPS

1. 域名 DNS 添加 A 记录，指向服务器公网 IP。
2. 服务器安装 nginx 与 certbot：

```bash
apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
cp /opt/personal-ai-agent/deploy/nginx/pai.conf /etc/nginx/sites-available/pai
sed -i 's/twin.example.com/你的域名/g' /etc/nginx/sites-available/pai
ln -sf /etc/nginx/sites-available/pai /etc/nginx/sites-enabled/pai
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot --nginx -d 你的域名 --redirect      # 自动签发 + 续期 + 80 跳 443
```

3. 改 `.env` 并重启应用：

```bash
cd /opt/personal-ai-agent
sed -i 's#^PUBLIC_ORIGIN=.*#PUBLIC_ORIGIN=https://你的域名#' .env
sed -i 's#^COOKIE_SECURE=.*#COOKIE_SECURE=true#' .env
docker compose up -d
```

4. 验证：`https://你的域名` 打开，登录后刷新仍是登录状态（cookie 生效）。
5. 跑通后去防火墙删掉 3000 端口规则，只保留 80/443/22。

---

## 7. 备份（很重要）

数据库和上传文件都在 Docker volume 里，容器删了数据还在，但**整机丢了就没了**。建议每日 cron：

```bash
cat >/etc/cron.daily/pai-backup <<'EOF'
#!/bin/bash
set -e
cd /opt/personal-ai-agent
mkdir -p /root/backups
docker compose exec -T db pg_dump -U pai -d pai | gzip > /root/backups/db-$(date +%F).sql.gz
docker compose exec -T backend tar czf - -C /data storage > /root/backups/storage-$(date +%F).tgz
find /root/backups -type f -mtime +14 -delete
EOF
chmod +x /etc/cron.daily/pai-backup
```

同时把 `.env`（尤其 `SECRET_KEY`）复制到本地保存一份。

---

## 8. 更新发布

```bash
cd /opt/personal-ai-agent
git pull                          # 方式 B 上传的则重新覆盖文件
docker compose up -d --build      # 会自动执行 alembic upgrade head
```

---

## 9. 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| 构建被 kill（exit 137） | 内存不足。加 swap 或升到 4GB |
| `docker compose up` 报 `POSTGRES_PASSWORD` 未设置 | `.env` 没写或不在项目根目录 |
| 页面能开，但登录/接口 502 | 后端没起来：`docker compose logs backend`；多半是 DB 未 healthy 或迁移失败 |
| 登录成功但刷新就退出 | `COOKIE_SECURE=true` 却在用 http 访问。https 未就绪时先设 false |
| 上传大文件 413 | nginx 的 `client_max_body_size`（配置里已给 12m） |
| 公开页所有访客被当成同一个 IP 限流 | 反代没传 `X-Forwarded-For`，或后端没加 `--proxy-headers`（compose 已处理） |
| 拉镜像超时 | 确认 `/etc/docker/daemon.json` 有腾讯云镜像加速并 `systemctl restart docker` |
| 迁移报 `extension "vector" is not available` | 必须用 `pgvector/pgvector:pg16` 镜像，不能用官方 `postgres:16` |
| 域名打不开 | 大陆服务器先查备案；再查 DNS 解析、防火墙 80/443 |

---

## 10. 安全清单

- [ ] `SECRET_KEY`、`POSTGRES_PASSWORD` 用随机值，不提交仓库
- [ ] 只开 22/80/443；SSH 建议改密钥登录、禁用密码
- [ ] HTTPS 后 `COOKIE_SECURE=true`，nftables/安全组不留 5432、3000 外网入口
- [ ] 定期备份并异地保存 `.env` 与数据库 dump
- [ ] 平台级 Key 有额度上限，注意公开页被刷（已有 IP 限流，可按需调低 `PUBLIC_RATE_LIMIT_PER_MINUTE`）
- [ ] 服务器系统定期 `apt upgrade`

---

## 11. 本仓库为部署做的改动（相对之前本地版本）

1. **前端 `BACKEND_URL` 改为构建参数**。Next.js 的 `rewrites()` 会在 `next build` 时固化进
   `.next/routes-manifest.json`，只在运行时设环境变量是**不生效**的（本机实测：用不同
   `BACKEND_URL` 启动，`/api/health` 仍走旧的 8000）。现在 `frontend/Dockerfile` 用
   `ARG BACKEND_URL=http://backend:8000`，compose 用 `build.args` 传入，容器内
   `/api/*` 才会正确代理到 backend。
2. **compose 生产化**：数据库不对外暴露端口；所有服务 `restart: unless-stopped`、healthcheck、
   日志轮转；后端启动命令加 `--proxy-headers --forwarded-allow-ips='*'`，反代后限流按真实访客 IP；
   密码改为从 `.env` 读取（不再硬编码）。
3. **前端镜像构建更稳**：直接用 `node node_modules/next/dist/bin/next build`，绕开 pnpm 的前置安装；
   运行用 `next start` 而不是 `pnpm start`。
4. **新增** `deploy/nginx/pai.conf`、`deploy/tencent/setup-docker.sh`、本文件。
5. `.env.example` 增加 `POSTGRES_PASSWORD`、`PUBLIC_ORIGIN` 与 `COOKIE_SECURE` 说明。

---

## 12. 首次部署验证清单（部署完逐条打勾）

- [ ] `docker compose ps` 三个服务 healthy
- [ ] `curl http://127.0.0.1:3000/api/health` 返回 `"dialect":"postgresql"`
- [ ] 注册 → 登录 → 刷新仍登录
- [ ] 创建 Agent → 上传 PDF → 状态变成「就绪」
- [ ] 对话测试能根据简历回答，不知道的问题会说没有
- [ ] 发布后无痕窗口 `/a/<slug>` 可匿名对话
- [ ] 关闭公开后原链接立即 404
- [ ] HTTPS 开启后登录仍然正常
- [ ] 重启服务器后服务自动恢复（`systemctl reboot` 后访问）

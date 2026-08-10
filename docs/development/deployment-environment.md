# 部署环境与在线预览（kkFileView）

覆盖三件事：①上线服务器需要安装的语言库与软件；②上线前如何在本地完整运行；③kkFileView 在线文件预览的接入方案。技术栈依据 [ADR-0003](../architecture/adr/0003-technology-stack.md) 与 [开发文档](development-guide.md)。

## 1. 生产服务器软件清单

### 1.1 推荐路线：Docker 容器化（强烈推荐）

服务器上只需装三样，其余全部跑容器，升级、回滚、迁移都简单：

| 软件 | 版本 | 用途 |
| --- | --- | --- |
| Ubuntu Server（或 Debian） | 22.04/24.04 LTS | 操作系统 |
| Docker Engine + Compose 插件 | Docker 24+ | 运行全部服务容器 |
| Nginx | 1.24+（宿主机装或跑容器） | 反向代理、TLS、托管前端静态文件 |

容器清单（镜像即"要装的软件"）：

| 容器 | 镜像 | 端口 | 用途 |
| --- | --- | --- | --- |
| PostgreSQL | `postgres:16-alpine` | 5432（仅内网） | 主数据库 |
| Redis | `redis:7-alpine` | 6379（仅内网） | 缓存、会话、队列 |
| MinIO | `minio/minio` | 9000/9001（仅内网） | 对象存储：图纸、附件、导出文件 |
| kkFileView | `keking/kkfileview:4.4.0` | 8012（仅内网，经 Nginx 暴露 `/preview`） | 在线文件预览引擎（自带 JDK、LibreOffice、中文字体） |
| API | 自建镜像（`node:20-alpine` 基础） | 3000（仅内网） | NestJS 后端 |
| 前端 | 构建产物（静态文件） | — | `apps/web`、`apps/portal` 构建后由 Nginx 托管 |

构建机（可以就是这台服务器，也可以是 CI）：Node.js ≥ 20.11 LTS ＋ pnpm 10（仓库 `packageManager` 已固定 `pnpm@10.28.0`）。

配套运维：
- 证书：内网自签或 mkcert；公网域名用 certbot（Let's Encrypt）。
- 备份：`pg_dump` 每日定时 ＋ MinIO 数据目录（或 `mc mirror`）同步到第二块盘/NAS；备份文件异机存放。
- 时区统一 `Asia/Shanghai`；服务器开启 NTP。

硬件参考：起步 4核/8G/SSD 200GB（图纸和预览缓存会持续增长，磁盘留足）；全部门上线后建议 8核/16G。

### 1.2 备选路线：裸机直装（不推荐，仅列出）

Node.js ≥ 20.11 ＋ pnpm 10、PostgreSQL 16、Redis 7、MinIO、Nginx、JDK 8 ＋ LibreOffice ＋ 中文字体（kkFileView 裸装依赖，配置繁琐，这是推荐用 Docker 的主要原因）、pm2 或 systemd 管理 Node 进程。

## 2. 上线前本地完整运行

本地跑通与上线同构的完整栈（含预览），步骤：

```bash
# 0. 前置：本机装好 Node ≥20.11、pnpm 10、Docker Desktop（或 Docker Engine）
pnpm install

# 1. 环境变量：复制模板并按需修改（密钥不进仓库）
cp infra/.env.example infra/.env
cp infra/.env.example services/api/.env

# 2. 起基础设施（数据库+缓存+对象存储+kkFileView 预览）
docker compose -f infra/docker-compose.local.yml up -d

# 3. 建库与种子数据
pnpm -F services/api prisma migrate dev
pnpm -F services/api prisma db seed

# 4. 起后端与前端
pnpm -F services/api start:dev        # http://localhost:3000/api/v1
pnpm -F apps/web dev                  # http://localhost:5173
```

- 后端未就绪的模块前端自动走 mock（`isMockEnabled()`），不阻塞演示。
- `infra/docker-compose.dev.yml` 仍可用（不含 kkFileView）；`docker-compose.local.yml` 是它的超集。
- 局域网演示：`pnpm -F apps/web dev --host` 后，同事用 `http://<你的IP>:5173` 访问。

## 3. kkFileView 在线预览接入方案

[kkFileView](https://github.com/kekingcn/kkFileView) 是开源文件预览服务（Spring Boot），支持 PDF、Word/Excel/PPT、图片、压缩包、**CAD（dwg/dxf）**等——正好覆盖图纸库、客户订单原件、质量文件的在线预览需求。

### 3.1 部署形态

独立容器（见 `docker-compose.local.yml` 的 `kkfileview` 服务），**只在内网暴露**；生产经 Nginx 以 `/preview/` 路径反代，禁止直接对外开放 8012。关闭其自带演示上传页（`KK_FILE_UPLOAD_DISABLE=true`，按所用版本核对变量名）。

### 3.2 集成模式（权限在我方后端，kkFileView 只做渲染）

```
前端点"预览" → 我方 API GET /files/:id/preview-url（校验登录与数据权限）
  → 后端对 MinIO 中该文件签发短时效预签名 URL（端点须为 kkFileView 可达地址，
     compose 内为 http://minio:9000，生产为内网地址）
  → 后端拼出预览地址返回：
     {KK_BASE_URL}/onlinePreview?url=encodeURIComponent(base64(签名URL))
     （kkFileView 4.x 要求文件 URL 先 Base64 再 URL 编码）
  → 前端以 iframe/新标签打开该地址
```

要点：
- **权限收口在我方后端**：kkFileView 拿到的只是几分钟内有效的一次性签名 URL，预签名过期即失效；不给它任何存储凭证。
- **水印**：预览地址追加 `watermarkTxt=用户名+工号` 等参数，落实方案里"文件水印与下载日志"的要求；预览动作写审计日志。
- **文件名**：预签名 URL 建议带 `response-content-disposition` 或在 url 参数后附 `&fullfilename=xxx.dwg`，确保 kkFileView 按正确扩展名选择渲染器。
- **预览缓存**：kkFileView 会缓存转换产物（`kkfileview-cache` 卷）；图纸新版本务必用新对象键（版本号入键名），避免命中旧缓存。
- 代码落点：平台层新增 `file-preview` 能力（`services/api/src/platform/` 或独立小模块），前端做一个通用 `FilePreviewDialog` 组件，报价、BOM、ECN、订单附件、质量文件各页面复用。

### 3.3 生产 Nginx 反代示例

```nginx
location /preview/ {
    proxy_pass http://127.0.0.1:8012/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 200m;
}
# 此时 kkFileView 环境变量 KK_BASE_URL=https://<域名>/preview
```

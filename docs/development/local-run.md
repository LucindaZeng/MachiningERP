# 本地运行手册

> 目的：**上线前任何人拿到这个仓库，都能在浏览器里把系统跑起来。**
> 最后一次实测：2026-08-12（Node 22 / pnpm 10 / Chromium）。
> 文中标「✅ 已实测」的步骤是在干净环境里真跑过并用无头浏览器验证过的；
> 标「⚠️ 未在本环境实测」的，会写清楚为什么以及该怎么自测。

---

## 零、先看这一段：你要哪一种「跑起来」

| | 路径 A：纯前端演示 | 路径 B：全栈联调 |
| --- | --- | --- |
| 装什么 | 只装 Node + pnpm | 还要 Docker |
| 数据从哪来 | `apps/web/src/api/mock/` 的固件 | Postgres + 种子数据 |
| 能做什么 | 十五个页面全部可点，单据流转、闸门拦截、错误文案全真 | 加上真实鉴权、文件上传、在线预览、Excel 出具 |
| 起步时间 | 约 1 分钟 | 约 5 分钟 |
| 适合谁 | 给业务演示、界面走查、新人上手 | 联调、验收、上线前彩排 |

**给业务演示、给老板看、新人第一天——一律走路径 A。**
它不需要数据库，也不会因为某个容器没起来就卡住。

> 只想把**业务部十三个功能**逐个点一遍（含每页有哪些演示单据、点哪个按钮、
> 什么算对），走 **[业务部本地走查手册](业务部本地走查手册.md)**，那份是操作级的。
> 本文管的是环境怎么搭、坏了怎么查。

---

## 一、路径 A：纯前端演示 ✅ 已实测

```bash
pnpm install
pnpm dev:web
```

打开 <http://localhost:5173>，用 **`admin` / `Wfx@2026`** 登录。

不需要复制任何 `.env` 文件。`.env*` 全被 `.gitignore` 忽略，克隆下来是没有的；
mock 开关的默认值就是「开发态开、生产构建关」（见 `apps/web/src/api/mock-switch.ts`
的 `MOCK_ENABLED`），所以**新同事克隆完直接 `pnpm dev:web` 就能跑**。

### 实测覆盖

十五条路由全部渲染、零 console error：

```
/sales  /sales/quotations  /sales/cost-analysis  /sales/orders  /sales/orders/create
/sales/tracking  /sales/customers  /sales/bom-requests  /sales/ecn  /sales/shipments
/sales/returns  /sales/statements  /sales/invoices  /sales/customs  /sales/analytics
```

单据流转也在浏览器里走通过，以 ECN 生产影响分类为例（`ECN-20260720-0015`）：
转入执行 → 结案被拦（「必须先由 PMC 录入受影响数量」）→ 录入 1000 件 →
结案再被拦（「必须先发起返工才能结案」）→ 发起返工（二次确认）→ 数量锁死、录入入口收起 →
结案放行。判为「无影响」的 `ECN-20260716-0012` 则不出现清点区，直接结案。

### 想看打包产物

```bash
VITE_USE_MOCK=true pnpm -F @machining-erp/web build
pnpm -F @machining-erp/web preview          # http://localhost:4173
```

⚠️ **`VITE_USE_MOCK=true` 不能省。** 生产构建下 mock 默认是关的，
不带这个变量打出来的包会去请求 `/api/v1`，没有后端时登录点下去毫无反应
（连报错都没有，因为静态服务器把 404 兜成了 HTML）。这是刻意的——
真正发布的包不该带着假数据。

---

## 二、路径 B：全栈联调 ⚠️ 未在本环境实测

沙箱里没有 Docker，Prisma 的引擎下载站点也不可达，因此下面的步骤**没有在本环境跑过**。
每一步都标注了「怎么确认这步成了」，照着自测即可。

### 1. 起依赖容器

```bash
cp infra/.env.example infra/.env
pnpm stack:up        # Postgres + Redis + MinIO + 建桶 + kkFileView
# 只要数据库、不需要在线预览时，可以用更轻的一套：
# pnpm db:up         # Postgres + Redis + MinIO + 建桶（无 kkFileView）
```

**确认**：`docker compose -f infra/docker-compose.local.yml ps` 里
`machining-erp-createbuckets` 状态是 `Exited (0)`，日志末尾有「桶已就绪：machining-erp」。

> **这一步曾经是坑。** 两个 compose 文件原来都只起 MinIO、不建桶，
> 于是 `pnpm db:seed` 会在写预览样例文件时死在 `NoSuchBucket` 上，
> 而错误只说「桶不存在」，不会告诉你桶本来该由谁建。现已加 `createbuckets` 初始化容器。

### 2. 建表与灌数

```bash
cp services/api/.env.example services/api/.env
pnpm db:migrate      # prisma migrate dev
pnpm db:seed
```

⚠️ **迁移落后于 schema 三批。** `prisma/migrations/` 里现有两份
（`20260808161040_machining_erp`、`20260810163805_machining_erp_dev`），
覆盖到 customs 与 sales-return 为止；此后新增的 **docgen（`generated_documents`）、
ecn-request（3 表 + 4 枚举）、生产影响分类（`ecn_affected_lines` + 枚举 + 3 列）
都还没有对应迁移**。`migrate dev` 会据 `schema.prisma` 生成补齐，本地没问题；
但生产用的 `prisma migrate deploy` 只认已提交的迁移文件——**生成完必须提交进仓库**。见第四节。

**确认**：`pnpm db:seed` 输出以「种子数据写入完成。」结尾。

### 3. 起后端与前端

```bash
pnpm dev:api         # http://localhost:3000/api/v1，接口文档 /api/v1/docs
cp apps/web/.env.example apps/web/.env.development   # 把 VITE_USE_MOCK 改成 false
pnpm dev:web
```

**确认**：浏览器 Network 里登录请求打到 `/api/v1/auth/login` 且返回 200；
`/api/v1/docs` 能打开 Swagger。

### 演示账号（密码统一 `Wfx@2026`）

| 账号 | 角色 | 能验什么 |
| --- | --- | --- |
| `admin` | 系统管理员 | 全部 |
| `lucinda` | 总经办 | 审批与看板 |
| `luoxiaolin` | 业务主管 | 报价审批、订单评审 |
| `chenzhiqiang` | 业务员 | 建单、提 ECN |
| `wugong` | 报价工程师 | 核价、ECN 影响评估与批准 |
| `pmc01` | PMC 计划员 | **ECN 受影响数量清点、发起返工**（持 `order.tracking.view`） |

---

## 三、两个端点不是一个（在线预览专属坑）

`S3_ENDPOINT` 是**浏览器**可达地址（本机 `http://localhost:9000`），
`S3_PREVIEW_ENDPOINT` 是 **kkFileView 容器**可达地址（compose 内是 `http://minio:9000`）。

预签名 URL 是交给 kkFileView 去取文件的。签在 `localhost` 上，
容器里的 `localhost` 是它自己，必然取不到——现象是预览页一直转圈或报「文件下载失败」。
代码里两者是分开的配置项且**不互相回落**，就是为了让这个错配在配置阶段就暴露。

---

## 四、上线前还差什么

1. **补齐并提交 migration 文件**。现有迁移只到 2026-08-10，覆盖 customs 与 sales-return；
   docgen、ecn-request、生产影响分类三批尚无迁移。本地跑一次 `pnpm db:migrate` 生成后**提交进仓库**——
   `migrate deploy` 只认仓库里的迁移文件，schema.prisma 改了不算数。
2. **`JWT_SECRET` 换强随机值**。`NODE_ENV=production` 且长度 < 32 时 API 会直接拒绝启动（有意为之），
   但 `.env.example` 里那句 `change-me-in-production-at-least-32-characters` 有 46 位，
   **能大摇大摆通过校验**——它是模板不是密钥，必须真换。
3. **MinIO / Postgres 口令换掉**。`erp_dev_password` 在两份 `.env.example` 里是明写的。
4. ✅ **mock 已不再进生产包**（2026-08-12 修复）。开关是构建期常量
   （`apps/web/src/api/mock-switch.ts` 的 `MOCK_ENABLED`），`http.ts` 用条件动态 import
   引 mock，因此关闭时整棵假数据依赖树被 Rollup 摇掉。
   **发布前请顺手复验一次**：`pnpm -F @machining-erp/web build` 后
   `grep -rl 'mock 未实现的接口' dist/assets/` 应为 0 个文件。
   > 修复前实测是 8 个 chunk 带着演示客户名；真正的风险不是包体，而是万一某个环境
   > 把 `VITE_USE_MOCK` 配成 `true`，线上会**静默地**用假数据服务、界面无任何提示。
5. ⚠️ **十个页面把三个演示客户名硬编码成了筛选下拉选项**
   （`QuotationTable.vue`、`InvoiceRequestPage.vue`、`ShipmentListPage.vue`、
   `StatementPage.vue`、`SalesOrderListPage.vue`、`OrderTrackingPage.vue` 等）。
   这不是 mock 固件，是页面代码——接了真实客户后这些筛选器直接是错的。
   修法是抽一个吃客户接口的 `useCustomerOptions`，涉及十个文件，**尚未处理**。
6. `tools/build_erp_plan.py` 的 `DOC_VERSION` 停在 `V2.1`，而 Word 方案已出到 V2.5；
   `check_repository.py` 里恰好也断言它等于 V2.1，于是双方**一起过期地通过**。
   需要重新生成 Word 方案时一并处理。
7. 仓库根目录的历史 tarball（`*.tgz`）需删除——远程会话无删除权限。

---

## 五、跑不起来时按这个顺序查

| 现象 | 多半是 |
| --- | --- |
| 页面能开，但点按钮毫无反应 | 走的是打包产物且没带 `VITE_USE_MOCK=true`；或后端没起 |
| `pnpm db:seed` 报 `NoSuchBucket` | `createbuckets` 容器没跑成功，`docker logs machining-erp-createbuckets` |
| 登录返回 401 但账号没错 | 种子没灌（`pnpm db:seed`），或连到了另一个库 |
| 预览一直转圈 | `S3_PREVIEW_ENDPOINT` 签成了 `localhost`，见第三节 |
| `prisma generate` 报 403 | 网络到 `binaries.prisma.sh` 不通，换网络或配 `PRISMA_ENGINES_MIRROR` |
| `pnpm stack:up` 报 `unknown shorthand flag: 'f' in -f` | **Docker CLI 没装 compose 插件**。`compose` 没被识别成子命令，才退回去把 `-f` 当顶层 flag 解析——错误信息与真实原因完全不搭。用 `docker compose version` 确认；见下方「Docker compose 插件缺失」 |
| `docker compose` 拉镜像报 `docker-credential-desktop ... not found in $PATH` | `~/.docker/config.json` 里残留 `"credsStore": "desktop"`（Docker Desktop 卸载后留下的），而拉公共镜像**本来不需要凭据**。删掉该键即可；见下方「凭据助手残留」 |
| `pnpm install` 提示 `The "pnpm" field in package.json is no longer read` | pnpm 10 起 `onlyBuiltDependencies` 搬到了 `pnpm-workspace.yaml`。留在旧位置会**静默跳过 prisma / esbuild / @swc 的构建脚本**，故障要到 `pnpm dev:api` 才以不相干的形式冒出来 |
| 5173 端口被占 | `pnpm dev:web -- --port 5174` |

### Docker compose 插件缺失（macOS）

```bash
docker --version          # CLI 在不在
docker compose version    # 插件在不在 —— 报错就是它
docker info > /dev/null && echo "守护进程在跑" || echo "守护进程没起"
ls ~/.docker/cli-plugins/ /opt/homebrew/lib/docker/cli-plugins/ 2>/dev/null
```

- **用 Docker Desktop / OrbStack**：把它装上并启动即可，插件随之而来。注意 Homebrew 装的
  `docker` 可能**盖住** Desktop 的 CLI，`which -a docker` 看到两个时以 Desktop 那个为准。
- **只用 Homebrew 的 docker CLI**：插件要单独装并手动挂到插件目录——
  ```bash
  brew install docker-compose
  mkdir -p ~/.docker/cli-plugins
  ln -sfn "$(brew --prefix)/opt/docker-compose/bin/docker-compose" ~/.docker/cli-plugins/docker-compose
  docker compose version   # 应打印 Docker Compose version v2.x
  ```
  仅 `brew install docker-compose` 而不做软链，`docker compose` 依旧不认。

### 凭据助手残留（卸载过 Docker Desktop 的机器）

现象：`docker compose ... up` 一开始拉镜像就死在
`error getting credentials - err: exec: "docker-credential-desktop": executable file not found`。

原因是 `~/.docker/config.json` 里还写着 Desktop 时代的 `"credsStore": "desktop"`。
本项目用到的镜像（postgres / redis / minio / minio-mc / kkfileview）全是公共镜像，
**不需要登录**，所以直接把这个键删掉就行：

```bash
cp ~/.docker/config.json ~/.docker/config.json.bak
python3 - <<'EOF'
import json, os, pathlib
p = pathlib.Path(os.path.expanduser('~/.docker/config.json'))
d = json.loads(p.read_text().strip() or '{}')
removed = d.pop('credsStore', None)
p.write_text(json.dumps(d, indent=2) + '\n')
print('已移除 credsStore =', removed)
EOF
docker compose -f infra/docker-compose.local.yml pull   # 应能正常拉取
```

> 只删 `credsStore`，不动 `auths` / `credHelpers`——那两处可能有你私有仓库的真实配置。
> 备份在 `~/.docker/config.json.bak`，改坏了可以还原。

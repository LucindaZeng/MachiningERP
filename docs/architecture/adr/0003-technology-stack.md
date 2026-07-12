# ADR-0003：应用与数据技术栈

- 状态：Proposed（待项目委员会确认后转 Accepted）
- 日期：2026-07-12

## 背景

ADR-0001 约定技术栈必须通过后续 ADR 决定。开发文档、接口文档和开发进度表需要一个具体技术基线才能编写。本 ADR 给出推荐组合；若最终走"采购成熟 ERP + 定制"路线（ADR-0002），本栈用于定制部分和门户。

## 决策

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 后端 | Node.js 20 + NestJS 10（TypeScript） | 模块化架构与"一文件一职责"天然契合（module/controller/service/repository 分层）；前后端同语言降低小团队成本 |
| ORM | Prisma | 类型安全、迁移可审计 |
| 数据库 | PostgreSQL 16 | 事务与 JSONB 兼顾单据快照；行级安全支持门户隔离 |
| 缓存/队列 | Redis 7 + BullMQ | MRP、预警扫描、报表生成等异步任务 |
| 对象存储 | MinIO（S3 协议） | 图纸、PDF、照片、报关资料私有化存储 |
| 内部前端 | Vue 3 + TypeScript + Vite + Pinia + Element Plus | 国内生态成熟、表格/表单密集型界面开发效率高 |
| 外部门户 | 同栈独立应用（apps/portal），独立域名与账号体系 | 客户/供应商数据物理隔离部署 |
| 文件生成 | 服务端 exceljs（Excel）、Puppeteer/pdfmake（PDF 报价单、送货单、报关资料） | "所有文件由系统生成"需求 |
| 扫码/移动端 | PWA（车间平板/手机浏览器）+ USB/蓝牙扫码枪键盘模式 | 傻瓜式操作，免装 App |
| AI | DeepSeek V4 Pro API + 指标语义层（只读查询服务） | 见 finance-executive-ai.md |
| 行情 | 定时抓取持牌行情源 → 行情服务缓存 | 见 metal-price-center.md |
| 身份 | 自建 OIDC（如 Keycloak）或 NestJS + JWT + RBAC/行级权限 | 内外账号分域 |
| 部署 | Docker Compose（试点）→ K3s（多节点） | 私有化机房/云主机皆可 |
| CI/CD | GitHub Actions：lint、typecheck、unit、e2e、构建镜像 | 复用现有 repository-check 工作流 |
| 可观测 | pino 结构化日志 + Prometheus/Grafana + 审计表 | 节点计时与审计需求 |

## 架构形态

模块化单体（modular monolith）起步：一个 NestJS 应用内按业务域划分模块，模块间只能通过公开接口（service 导出/领域事件）交互，禁止跨模块直连数据表。确有独立伸缩需求（行情抓取、文件生成、AI 网关）时拆为独立 service，符合 ADR-0001 第 6 条。

## 结果

优点：单语言栈、类型端到端、模块边界清晰、可平滑演进到服务拆分。
代价：Node 不擅长重计算（APS 高级排程如需大规模优化，可后续以 Python/OR-Tools 独立服务接入）；团队需具备 TypeScript 工程化能力。

## 关联

- 开发规范与目录结构：docs/development/development-guide.md
- 接口规范：docs/api/api-conventions.md

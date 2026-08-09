# 开发文档（Development Guide）

技术栈依据 [ADR-0003](../architecture/adr/0003-technology-stack.md)。本文约束仓库结构、模块划分、单一职责规范、编码规范和环境搭建。所有 PR 必须符合本文，违反视为评审不通过。

## 1. 仓库结构（pnpm monorepo）

```
apps/
  web/          # 内部十三部门前端（Vue 3）
  portal/       # 客户/供应商门户前端（独立账号体系）
services/
  api/          # 核心后端（NestJS 模块化单体）
  market-feed/  # 金属行情抓取与缓存服务
  doc-render/   # PDF/Excel 文件生成服务（Puppeteer/exceljs）
  ai-gateway/   # DeepSeek V4 Pro 问答网关（语义层只读查询）
packages/
  shared/       # 类型、DTO、枚举、错误码（前后端共享）
  ui/           # 内部组件库（表格、单据、扫码组件）
infra/          # docker-compose、K3s manifests、数据库迁移脚本
tests/          # e2e 与验收场景脚本（对应 V2.2 端到端验收场景）
docs/           # 本目录
tools/          # 文档/方案生成脚本
```

## 2. 业务模块划分（services/api/src/modules/）

模块与需求 Epic 一一对应，模块间禁止互相 import 内部文件，只能引用对方 `index.ts` 导出的公共 service 或订阅领域事件。

| 模块 | Epic | 职责 |
| --- | --- | --- |
| auth | SEC | 登录、JWT、会话（不含用户管理） |
| identity | ORG | 用户、角色、岗位、数据权限、内外账号分域 |
| org | ORG | 组织、部门、工作中心、班次日历 |
| masterdata | MDM | 物料、客户、供应商、图纸、BOM、工艺路线、设备、工装刀具 |
| quotation | QTN | 询价、核价、相似产品检索、报价审批与 PDF |
| contract-order | OTL | 合同评审、三类业务订单、阶梯价格、订单变更 |
| hk-pricing | HKO | 香港代生产客户 70% 价格规则与审计 |
| pmc | PMC | MRP、齐套、周/日计划、交付优先级 |
| aps-loading | PMC | 架机表生成/调整、资源冲突、平衡化生产 |
| procurement | SRM | 采购申请、采购订单、到货、采购对账 |
| outsourcing | SRM | 委外发出/回厂、供应商进度、委外对账 |
| supplier-portal | SRM | 供应商在线报价、ASN、送货单打印 |
| customer-portal | CUS | 客户项目进度、交货计划、文件下发 |
| metal-price | MKT | 行情、供应商价、落地价、快照（读 market-feed） |
| wms | WMS | 收发存、库位、仓位图、余料、盘点、呆滞 |
| mes | MES | 工单、派工、扫码报工、工序防跳、数量交接 |
| rework | MES | 跨工序返工路线 A/B、返工子订单、尾数返工与入库 |
| qms | QMS | IQC、首检、巡检、末件、FAI、异常、8D、冻结放行 |
| costing | OPC | 工序成本卡、累计成本、标准/实际差异、返工成本归集 |
| finance | FIN | 总账、应收应付、凭证、月结、业财对账 |
| hr-attendance | ADM | 考勤、异常、多劳务结算 |
| docgen | DOC | 单据模板、编号、版本、快照（调 doc-render） |
| alerts | ALT | 统一预警、SLA、升级、未完结工单账龄监控 |
| timing | OTL | 节点计时（T0 起）、审批耗时、时效分析 |
| bi | BI | 指标字典、驾驶舱、钻取 |
| ai-qa | AIX | 财务/老板问答会话、引用、审计（调 ai-gateway） |

## 3. 单一职责与文件规范（强制）

1. 一个文件只做一件事：禁止一个文件同时处理登录和查询、同时包含 controller 和 service。每个类/每组同主题纯函数一个文件。
2. 模块内固定分层，命名即职责：
   ```
   modules/quotation/
     index.ts                    # 唯一对外出口
     quotation.module.ts
     controllers/quotation.controller.ts      # 仅 HTTP 编解码，无业务逻辑
     controllers/quotation-approval.controller.ts
     services/quotation.service.ts            # 业务用例编排
     services/quotation-pricing.service.ts    # 核价计算
     services/similar-product.service.ts      # 相似产品检索
     repositories/quotation.repository.ts     # 仅数据访问，无业务规则
     dto/create-quotation.dto.ts              # 一个 DTO 一个文件
     events/quotation-approved.event.ts
     __tests__/quotation-pricing.service.spec.ts
   ```
3. 尺寸红线：单文件 ≤ 400 行、单函数 ≤ 60 行、单 controller ≤ 8 个路由；超出必须拆分。
4. controller 不写业务、service 不写 SQL、repository 不发事件、DTO 不含逻辑。
5. 跨模块调用只走对方 `index.ts` 导出或领域事件（如 `order.approved`、`grn.received`），ESLint `import/no-internal-modules` 强制。
6. 前端同理：一个页面组件只编排，取数逻辑在 `composables/`，API 调用在 `api/` 按模块一文件，公共组件入 `packages/ui`。

## 4. 编码规范

- TypeScript strict 模式；禁止 `any` 出现在模块公共接口。
- 命名：文件 kebab-case，类 PascalCase，数据库表 snake_case 复数。
- 所有金额用整数分/最小货币单位 + 币种字段；数量用 decimal 字符串，禁止浮点。
- 所有业务表必备字段：`id`、`created_at/by`、`updated_at/by`、`version`（乐观锁）、软删除仅用于主数据。
- 单据类表额外必备：`doc_no`（统一编号规则）、`status` 状态机、审计事件表记录每次状态迁移（谁、何时、耗时 —— 支撑节点计时需求）。
- 错误处理：业务错误抛 `BizError(code)`，错误码见接口文档；禁止吞异常。
- 测试：service 层单元测试必写；返工路线、HK 70% 价格、工序成本累计、MRP 公式属核心算法，要求分支覆盖 ≥ 90%。
- 提交：Conventional Commits（`feat(rework): ...`）；PR 必须关联需求编号（如 MES-05）。

## 5. 环境搭建

```bash
pnpm install
docker compose -f infra/docker-compose.dev.yml up -d   # postgres redis minio
pnpm -F services/api prisma migrate dev
pnpm -F services/api start:dev
pnpm -F apps/web dev
```

- 环境变量模板 `infra/.env.example`；密钥（DeepSeek API Key、行情源、S3）不进仓库。
- CI 门槛：eslint + typecheck + unit + prisma migrate diff 校验 + `tools/check_repository.py`。

## 6. 文档同步规则

改动影响金额、库存、工艺、放行、外部可见数据或财务口径时，先改 Word 方案（tools/build_erp_plan.py 重新生成）与 docs/ Markdown，再改代码（见 docs/README.md 维护规则）。

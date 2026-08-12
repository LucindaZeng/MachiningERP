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
  doc-render/   # 预留：重型 PDF 渲染的独立抽取目标。**当前尚未建立**——
                # 文档生成由 api 内 docgen 模块承担（ExcelJS 模板填充，见该模块 README）。
                # 抽取时机：采用 Puppeteer 级别的 PDF 引擎，或渲染负载明显拖慢 api 时延，
                # 二者先到为准。届时经 DocumentRenderer 端口换 provider，调用方零改动。
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
| contract-order | OTL | 合同评审、五种下单动作、阶梯价格、备料领用、订单变更、订单追踪 |
| bom-request | ENG | BOM 申请：引用报价产品、图纸不重复上传、BOM 与程序双状态回传 |
| ecn-request | ENG | 工程变更（ECN-01~05）：**只受理产品本身的变更**——改图、改材料、改表面处理，以及随之同步的工艺路线变更；改数量/交期/包装推回订单修改申请（ORC），改价格推回报价单修改申请（QRC），样品阶段的产品变更推回报价变更（4.3），三条边界由服务端点名拒绝。新版图纸走 quotation 既有的上传/版本通道（对象键带版本、写入不可覆盖），不另建上传路径。ECN 串起图纸版本 ↔ BOM ↔ 报价版本；影响评估四项（在制/已采购/已完工/已发货）齐全才允许送会签；**改图未同步工艺路线、改工序未指定生效批次一律不许批准**；驳回中文理由必填并随通知送达业务员。跨部门会签五个部门模块未上线，现由工程代签并逐条标记 proxied |
| shipment | SHP | 多行出货（7 态 SHP-01~06）、品质放行与财务信用双闸门、尾数四路径与结案数量平衡、订单状态回写、客户对账单（源单汇总 + 版本化） |
| invoice-request | INV | 发票申请：金额税率抬头全自动带出、三方金额一致性闸门、开票即完成（寄出/签收为时间线事件）、作废与红冲同表同编号流 |
| sales-return | RMA | 多行 RMA（6 态 RMA-01~05）：**责任归属与处置逐行判定**，单头为派生视图；业务登记 / 品质判定 / 财务审批三方分权；退货入库与 8D 是与处置正交的两条轨道；结案即锁死金额并按结案期间计入对账单的退货折让 |
| customs | EXP | 报关资料（5 态 EXP-01~04）：**五种文件**（形式发票 / 商业发票 / 装箱单 / 出口合同 / 报关数据包），形式发票出货前开、商业发票按实发数出货后开；要素齐套为服务端硬闸门；每份文件独立版本链且各留出具时的汇率快照；**申报冻结清单快照**，此后更正须填理由并重报；关务复核不可跳过 |
| sales-analytics | BI | **只读聚合**（无表、无写端点）：每日接单/出货/未完成订单、报价转化、准交率、在手订单、客户排行与流失、客诉按行统计、审核时效、工作台。依赖 costing / finance / wms / mes 的面板经四个 STUB 读端口返回**空行集 + `pending` 中文说明**——「无数据」与「测得为零」在类型上就是两回事，绝不零填 |
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
| docgen | DOC | **按受控模板出具对外单据**：国内/国外报价单、CNC 成本分析、对账单、报关四件套，以及报价与成本分析的多选合并比较表。版式的唯一真相是 `templates/` 下的 .xlsx，代码只填数（`{{标记}}` 语法，改版式不改代码）；每次出具留模板版本与生成记录，可在线预览与下载。**边界**：客户端 SheetJS 继续负责「把当前列表另存为 Excel」，不搬服务端。当前只出 Excel，PDF 路线见该模块 README |
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
- 测试：service 层单元测试必写；返工路线、工序成本累计、MRP 公式、报关版本与申报快照、分析聚合、单据模板标记引擎与合并导出、ECN 影响评估属核心算法，要求分支覆盖 ≥ 90%。
- **非 TS 资产**放在所属模块的 `templates/` 下，随模块走；tsc 不会把它们带进 dist，
  需在 `nest-cli.json` 的 `assets` 规则里登记复制。
  当前唯一一处是 **docgen 的十份受控模板**：
  `services/api/src/modules/docgen/templates/*.xlsx`
  （国内/国外报价单、CNC 成本分析、对账单、报关四件套、报价与成本分析两张合并比较表）。
  版式的唯一真相就是这些文件，改版式改文件不改代码；改完把
  `constants/template-registry.ts` 里对应的 `version` 加一，该版本号会随每份出具记录落库。
  派生脚本留档在 `tools/docgen/`。

### 4.1 注释与文案一律中文

- **所有注释、JSDoc、TODO 用中文写**，并且写「**为什么**」而不是「做了什么」，附上规则出处，例如 「结案锁定金额，见规格 §8」。代码在讲它自己做了什么，注释要讲它凭什么这么做。
- **标识符保持英文**：类名、函数名、变量名、文件名不变。
- **所有面向使用者的文案用中文**：`BizError` 消息、通知标题与正文、审计描述、校验提示。
- **错误码保持英文常量**（`ORD_2805`、`LINES_REQUIRED`）——它们是对外契约的一部分，前端按码分支。

### 4.2 错误可追溯到「哪个文件抛了什么」

- 业务错误一律抛 `BizError(code)`，错误码见接口文档；**禁止吞异常**，禁止抛字符串或 `HttpException`。
- `BizError` 在构造时**自动捕获抛出点**（`common/errors/error-source.ts`），形如 `modules/customs/services/customs-document.service.ts:87`。原因：错误码是分类不是位置，同一个码在仓库里常有多处抛出点。
- 每个请求由 `traceContextMiddleware` 分配 `traceId`，贯穿结构化日志、审计与错误响应。
- 统一错误体：`{ code, message(中文), traceId }`。**`source` 与 `stack` 只在开发/测试环境随响应下发**，生产环境只进服务端日志——排障要得到，攻击者要不到。
- 抛出点写进**每一条**错误日志，不只是 5xx：4xx 不带堆栈，恰恰是最难定位的一类。
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

### 6.1 全系统在线预览是每个模块的 DoD，不是选做

模块只要引入**一种新的文件种类**（上传的或系统生成的），就必须在同一步里：

1. 在 `platform/file-preview` 的 `PREVIEW_OWNER_TYPES` 里登记归属类型；
2. 实现并注册对应的 `FilePreviewSource` resolver——**先判权限，再返回文件位置**，无权一律返回 null（由服务层统一抛 404，让「无权」与「不存在」对外不可区分）；
3. 前端接上 `FilePreviewDialog`，含 415 不可预览时回落下载。

理由：预览能力是横切的，靠各模块「以后补」的结果就是永远补不齐。文件能被生成却看不了，等于没生成。

**关于统一 `FileObject` 表（docgen 落地后的结论：不建了）**。

原计划是「等 docgen 把生成类文件的形态定下来，再一次性迁到统一 `FileObject` 表」。
docgen 已落地，形态定了，复核后的结论是**取消这次迁移**：

- **生成侧已经统一了**，就是 `generated_documents` 那张表——`(source_type, source_id)` 指回来源单据，
  `object_key` 指向对象存储，一次出具一行、写下即不可变。再套一层 `FileObject` 只会得到一张同义表。
  （报关文件是唯一例外：它落在自己的版本链行 `customs_documents` 上，因为版本链本身就是它的登记簿，
  两处登记等于两份真相。）
- **上传侧不该并进来**。图纸与客户订单原件要去重、要查重、要按扩展名放行；
  生成物不需要其中任何一条，却需要模板版本与出具留痕。硬并成一张表是把两件事搅在一起，
  换来的只是「表少了一张」。

因此定为：**生成侧统一到 `generated_documents`，上传侧维持 `(ownerType, ownerId)`**。
两侧都继续走同一套 `FilePreviewSource` registry 与同一组端点，对前端毫无差别。

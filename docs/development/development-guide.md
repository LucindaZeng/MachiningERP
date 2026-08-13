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
- **注释一律使用中文**：代码注释、JSDoc/文档注释、TODO/FIXME、README 说明均用中文书写，解释"为什么这样做"而非复述代码在做什么；关键业务规则的注释附口径来源（如"结案锁定金额，见规格§8"）。代码标识符（变量/函数/类/文件名）保持英文。
- 面向用户的文本同样中文：BizError 消息、通知文案、审计描述、校验提示；错误码保持英文常量。
- 命名：文件 kebab-case，类 PascalCase，数据库表 snake_case 复数。
- 所有金额用整数分/最小货币单位 + 币种字段；数量用 decimal 字符串，禁止浮点。
- 所有业务表必备字段：`id`、`created_at/by`、`updated_at/by`、`version`（乐观锁）、软删除仅用于主数据。
- 单据类表额外必备：`doc_no`（统一编号规则）、`status` 状态机、审计事件表记录每次状态迁移（谁、何时、耗时 —— 支撑节点计时需求）。
- **错误处理与可定位性（强制）**：任何报错必须能追到"哪个文件报的什么错"。
  - 业务错误抛 `BizError(code)`（错误码见接口文档），构造时自动捕获抛出位置（模块名＋文件名＋方法名）；禁止吞异常、禁止空 catch。
  - 每个请求带 `traceId`（入口中间件生成，响应头与错误体均返回）；服务端日志为结构化 JSON，必含 traceId、module、file、method、code、中文消息与堆栈。
  - API 错误响应体统一为 `{ code, message(中文), traceId }`；**开发/测试环境额外返回 `source`（文件+行号）与堆栈，生产环境不返回**（防泄露），生产排错用 traceId 反查日志。
  - 前端 http.ts 统一拦截：错误提示展示中文 message 与 traceId（可复制）；console.error 输出完整错误体；前端自身异常经全局 errorHandler 上报，同样带组件名与 traceId。
  - 未捕获异常由全局 ExceptionFilter 兜底：记完整堆栈日志后返回统一错误体，绝不把原始堆栈直接透给用户界面。
- 测试：service 层单元测试必写；返工路线、备料加权成本、工序成本累计、MRP 公式属核心算法，要求分支覆盖 ≥ 90%。
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

## 6. 在线文件预览（kkFileView）——全系统嵌入

**在线预览是 ERP 的系统级基础能力，嵌入整个系统**：13 个部门的任何模块，凡出现文件的地方（列表附件列、详情页、审批单、时间轴附件）都必须提供在线预览入口，由 [kkFileView](https://github.com/kekingcn/kkFileView) 渲染（PDF/Word/Excel/PPT/图片/压缩包/CAD dwg-dxf 等），用户不下载文件即可查看。部署与集成设计见 [部署环境与在线预览](deployment-environment.md) §3。

**覆盖范围（随模块上线逐步接入，均走同一能力）**：报价图纸与成本分析附件、客户订单原件（PO）、BOM/工艺文件、ECN 新旧版图纸、出货单证、报关单证（形式/商业发票、装箱单）、发票扫描件、质量文件（检验报告/FAI/8D）、合同与对账单回签件、采购与委外附件、设备与人事档案附件等——**未来任何新增文件类型默认必须可预览**。

架构与开发约束：

- 预览由平台层 `file-preview` 统一提供（`GET /files/:ownerType/:ownerId/preview-url`，resolver registry 判归属单据权限后签发 ≤5 分钟预签名 URL，Base64+URL 编码拼 kkFileView 地址，附 `fullfilename` 与姓名工号水印，每次签发写审计）。
- **每个引入新文件类型的模块，必须同步注册对应 resolver 并接入 `FilePreviewDialog`——这是该模块 DoD 的一部分**，不做视为功能不完整。
- 业务模块不得自行拼预览地址、不得暴露对象存储 URL；前端不得各页面自造预览组件。
- kkFileView 只在内网（本地 `docker-compose.local.yml` 的 `kkfileview` 服务，生产经 Nginx `/preview/` 反代），只拿短时效签名 URL，不接触存储凭证。
- 文件对象键携带版本号，保证转换缓存不会吐出旧版本。
- 当文件类型增长到需要统一管理时，迁移到通用 FileObject 表（registry 接口不变，见 TODO 架构决策点）。

## 7. 安全要求（强制）

系统含公网协同门户（供应商/客户）与内部核心，安全需求以 [《ERP系统安全需求规格说明书》](../security/security-requirements.md) 为**权威基线**（SEC-编号体系，P0 未实现不得上线、验收一票否决）。本节提炼开发者日常必须执行的子集，写代码与评审时逐条对照；完整条款、威胁模型与上线验收清单见原文。

### 7.1 架构红线（SEC-ARCH）

- 协同门户与 ERP 核心是**两套独立部署的服务**；门户不得直连核心数据库，只能走白名单化的内部 API（SEC-ARCH-001/002/004）。
- ERP 核心、数据库、Redis、MinIO 一律只监听内网；员工从公网访问必须经 VPN/零信任（SEC-ARCH-003/006、SEC-NET-007）。
- 测试环境严禁使用生产真实数据，必须脱敏（SEC-ARCH-007）。

### 7.2 多租户隔离——最高风险区（SEC-AUTHZ）

- 门户侧租户隔离**不得靠各接口自写 where 条件**：统一在数据访问层强制过滤（ORM 全局过滤器或 PG RLS）；`partner_id` 非空+索引；**partner_id 只能从服务端会话推导**，严禁读请求参数/Header/Cookie（SEC-AUTHZ-001~003）。
- 绕过租户过滤必须走显式命名方法（如 `withoutTenantScope()`）并逐调用点评审留档（SEC-AUTHZ-004）。
- **越权测试是 CI 强制门禁**：租户 A 查租户 B 资源必须 404/403，失败阻断合并（SEC-AUTHZ-005、SEC-SDLC-004）。
- 权限校验在服务端每个接口执行，前端隐藏按钮不算权限控制；新接口默认无人可访问，须显式配权限点（SEC-AUTHZ-011/012）。
- 对外资源标识符用 UUID/不可预测 ID，不得暴露自增整数；批量接口对列表中每个 ID 逐一校验归属；越权统一返回 404（SEC-AUTHZ-020/022/023）。

### 7.3 数据最小化（SEC-DATA）

- 门户 API 响应**白名单字段序列化**，严禁直接序列化数据库实体；L4 级字段（成本价、毛利、BOM 明细、工艺、其他供应商报价）**绝不进入门户服务的内存与日志**（SEC-DATA-001/002）。
- 后端不返回才算屏蔽——前端 CSS/JS 过滤不构成防护（SEC-DATA-003）。
- L3 字段（手机号、银行账号）展示默认脱敏；明文查看单独授权+二次验证+审计（SEC-DATA-004/005）。
- 导出：单独授权、行数上限、频率限流、审计（含文件哈希）、水印（SEC-DATA-020~024，已有 docgen/导出能力须对照补齐）。

### 7.4 输入与文件（SEC-INPUT / SEC-FILE / SEC-IMEX）

- 全部参数化查询，动态 ORDER BY/表名走白名单映射；服务端白名单校验一切外部输入；价格、数量、金额**不得由前端传入决定**（SEC-INPUT-001/002/011——与既有"金额服务端计算"约定一致）。
- 状态变更请求校验 CSRF 或 SameSite+Origin；SSRF 防护（URL 白名单、禁内网段）；禁 `../` 穿越（SEC-INPUT-006~008）。
- 上传：扩展名白名单**加 Magic Number 内容校验**；存储对象随机命名；存储位置不可执行；下载走短时效签名 URL（现有 file-preview ≤5 分钟已优于要求）+ `Content-Disposition: attachment`（下载端点；kkFileView 预览由服务端拉取不受此限）；病毒扫描列入 P1（SEC-FILE-001~007）。
- **CSV/Excel 公式注入防护**：导出时 `=` `+` `-` `@` 开头的单元格前置单引号或强制文本——docgen 与客户端 SheetJS 导出都必须做（SEC-IMEX-001）。
- 导入不得指定目标租户，一律写入当前会话租户（SEC-IMEX-005）。

### 7.5 认证与会话（SEC-AUTH / SEC-SESS）

- 口令 bcrypt(cost≥12)/Argon2id 存储；最小 12 位；初始口令随机+首登强改；重置链接一次性≤30分钟；登录失败提示不区分"账号不存在/密码错误"（SEC-AUTH-010~016/032）。
- 失败锁定（5次锁15分钟递增）、IP 封禁、3 次后验证码（现有登录已实现验证码与锁定，按此对照校准阈值）（SEC-AUTH-030~033）。
- **MFA**：管理员、财务、采购、销售主管、全部外部账号强制启用（TOTP 首选）；敏感操作（改银行账号、批量导出、权限变更）二次验证（SEC-AUTH-020/024）——当前未实现，列入平台任务。
- 外部账号禁止自助注册，邀请制+绑定唯一租户不可改；停用即全会话强制下线（SEC-AUTH-001~003）——注意与内部"申请账户"功能区分：申请账户仅限内部员工。
- 会话：登录后重生成会话 ID；HttpOnly/Secure/SameSite；空闲 30 分钟、绝对 8 小时；登出服务端销毁；改密/停用/变更权限后全会话失效；JWT 须短有效期+服务端吊销列表（SEC-SESS-001~008——现有 JWT 8h 有效期须按此改造）。

### 7.6 密钥、日志与依赖（SEC-CRYPTO / SEC-LOG / SEC-DEP）

- 严禁硬编码任何密钥/口令/连接串；`.env` 入 `.gitignore` 并配 gitleaks 类提交前扫描；安全随机值用 CSPRNG（SEC-CRYPTO-003~005）。
- 审计日志含租户 ID、Request ID（traceId 已有，贯穿门户与核心）、Before/After 值；**留存≥6个月**（网安法）；Append-Only；严禁记录明文口令/完整卡号/Token（SEC-LOG-001~005）。
- 依赖 lockfile 入库、禁 latest 部署生产；每周漏洞扫描，高危 48h、严重 24h 处置（SEC-DEP-002/003）。

### 7.7 评审与 CI 接入（SEC-SDLC）

代码评审必须逐条过安全规格 §17.1 检查清单（权限点默认拒绝、租户过滤、参数化、字段白名单、无硬编码密钥、审计覆盖等十项）。CI 集成 SAST+依赖扫描+密钥泄露扫描，高危阻断合并；越权用例是强制门禁。**每个新模块的任务书 DoD 自动包含：对照本节自查 + 附录 B 执行状态表登记本模块涉及的 SEC 条目。**

### 7.8 演示账号（Demo Account）——特殊账号类型

账号体系必须支持一种**演示专用账号**，用于对外部人员做软件展示与审核：只展示整个软件的应用与使用方式，**不暴露任何真实敏感数据**。

- **账号类型**：`accountKind: 'demo'`，仅系统管理员可创建；界面全程显示「演示模式」横幅标识；按外部账号等级管理（强制 MFA、账号有效期短设默认 ≤ 30 天、到期自动停用，见 SEC-AUTH-005/020）。
- **数据隔离是根本手段**：演示账号一律绑定**独立演示数据集**（seed 生成的虚构客户/订单/产品数据），在数据访问层与真实业务数据强制隔离——机制与租户隔离同族（SEC-AUTHZ-001）：靠统一过滤层，不靠各接口自觉。演示账号的增删改只作用于演示数据集，可完整走通报价→订单→出货流程供演示。
- **必须不可见的内容（服务端不返回，前端隐藏不算，SEC-DATA-003）**：
  真实客户信息、**数据分析模块**（整个模块对演示账号隐藏）、**调机时间/加工时间等工时数据**、员工信息（姓名/工号/绩效）、**价格/金额/成本/毛利类全部字段**、供应商信息、财务数据。演示序列化采用专用白名单（在演示数据集之上再做一层字段裁剪，纵深防御）。
- **能力限制**：演示账号禁止导出、禁止下载原文件（预览加「演示」水印）、禁止调用管理与配置接口；全部操作照常写审计日志。
- 演示数据集由专门 seed 维护（`prisma db seed --demo` 类入口），内容全部虚构且不得由真实数据脱敏派生（防脱敏不彻底）。

### 7.9 现状差距（截至 2026-08-16，开工前须知）

已满足或部分满足：traceId 全链路、生产不回堆栈（SEC-API-003）、上传扩展名白名单、签名 URL ≤5min、导出水印、审计体系、登录验证码与锁定。**已知缺口（按优先级列入 TODO）**：MFA（P0）、上传 Magic Number 校验（P0）、CSV 公式注入防护（P0）、JWT 吊销列表与短有效期（P0）、租户强制过滤层（门户开工前必须就位，P0）、口令策略完整落地（P0）、导出行数/频率限制（P1）、病毒扫描（P1）。

## 8. 文档同步规则

改动影响金额、库存、工艺、放行、外部可见数据或财务口径时，先改 Word 方案（tools/build_erp_plan.py 重新生成）与 docs/ Markdown，再改代码（见 docs/README.md 维护规则）。

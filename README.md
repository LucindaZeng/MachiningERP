# MachiningERP

面向订单驱动型机加工与零部件制造企业的 ERP、PLM、MRP、APS、MES、QMS、WMS、SRM、客户门户、BI 与 AI 分析一体化项目。

> 当前阶段：产品规划与需求基线。仓库尚不是可用于生产的 ERP 软件。

## 项目目标

- 打通客户询价、报价、合同、订单、工程、计划、采购、委外、生产、质量、仓储、交付、财务和经营分析。
- 通过一码到底、工序防跳、跨工序返工、质量冻结和批次追溯控制制造现场。
- 让供应商在线报价、确认订单、维护进度、创建 ASN、打印送货单并完成质量与对账协同。
- 让客户在受控门户查看自己的项目里程碑、交货计划、发货和质量文件。
- 由系统生成报价单、成本分析、外贸资料、进度表、对账单和经营分析。
- 建立实时金属材料价格中心，为采购、财务和业务提供按权限隔离的行情、报价和成本影响视图。
- 为财务和老板提供有数据口径、来源引用、权限隔离和审计记录的 AI 分析问答。
- 从业务订单提交开始量化业务经理/财务审核、订单评审、MRP、采购、收料、检验、生产、委外和包装的节点耗时与超期责任。
- 区分模具订单、样品订单和正式业务订单；模具/样品允许按审批免费，正式业务订单强制收费，三类订单均完整核算成本。
- 每次返工拆出独立子订单，重新核算全部重复工序；区分正常二次委外应付与供应商责任无偿返工，并计算责任毛损失、追偿和企业净损失。
- 每一道实际工艺独立核算成本：保存本工序新增成本、转入累计成本、单位成本、标准/实际差异，并汇总到订单、产品和客户毛利。

## 需求基线

当前详细规划基线为 [《制造业 ERP 软件规划方案 V2.3》](docs/制造业ERP软件规划方案_V2.3.docx)。Word 文档用于 ERP 选型、RFP、实施范围和验收；仓库内 Markdown 文档用于研发协作和版本化决策。

重点专题：

- [产品范围与模块边界](docs/product/vision-and-scope.md)
- [十三部门组织与应用蓝图](docs/product/department-operating-model.md)
- [十三部门功能、权限、预警与报表矩阵](docs/product/department-control-matrix.md)
- [需求基线与 Epic 映射](docs/product/requirements-baseline.md)
- [跨工序返工流程](docs/workflows/cross-operation-rework.md)
- [返工子订单、重复成本与责任归集](docs/workflows/rework-cost-accounting.md)
- [工序级制造成本核算](docs/features/operation-level-costing.md)
- [报价到全检包装的订单全生命周期](docs/workflows/order-to-pack-lifecycle.md)
- [实时金属材料价格中心](docs/features/metal-price-center.md)
- [财务与老板 AI 分析问答（DeepSeek V4 Pro）](docs/features/finance-executive-ai.md)
- [尾数返工与入库](docs/workflows/tail-quantity-rework.md)
- [长时间工单未完结监控](docs/features/aged-work-order-monitoring.md)
- [架机表与机台负荷管理](docs/features/machine-loading-plan.md)
- [开发文档](docs/development/development-guide.md)、[接口文档](docs/api/api-reference.md)、[开发进度表](docs/development/development-schedule.md)与 [TODO](TODO.md)
- [系统上下文与集成边界](docs/architecture/system-context.md)
- [数据与安全治理](docs/architecture/data-and-security.md)
- [实施路线图](docs/roadmap.md)

## 业务模块

| 领域 | 主要能力 |
| --- | --- |
| 报价与订单 | 图纸询价、相似产品、材料与工序成本、审批、合同评审、订单变更、客户协同 |
| 工程与 PLM | 物料、图纸、BOM、工艺、工装刀具、检验标准、版本与工程变更 |
| PMC/MRP/APS | 净需求、动态齐套、采购/生产/委外建议、有限排程、资源冲突和交期模拟 |
| 采购/SRM | 供应商在线报价、比价定标、订单确认、进度、ASN、送货、质量和对账 |
| 金属价格中心 | 许可行情、供应商报价、历史成交、落地价、价格快照、预警和成本影响 |
| MES | 一码到底、扫码执行、工序防跳、跨序返工、异常、人员设备绩效与 OEE |
| 后工序与组装 | 清洗、丝印、镭雕、打磨、振磨、全检包装，以及独立组装BOM、工单、测试和组件谱系 |
| QMS | IQC、首检、巡检、末件、FAI、完工/出货检验、MRB、CAPA、8D、质量成本与追溯 |
| WMS | ASN 收货、状态库存、库位、余料、备料、拣配、盘点、仓位图和呆滞料 |
| 财务与成本 | 总账、应收应付、资金、费用、资产、税务、预算、存货和制造成本、月结 |
| 工序级成本 | 切料至包装每道工艺独立成本卡、成本累计流转、标准实际差异、在制与返工成本 |
| 行政考勤 | 人员、班次、打卡、请假加班、异常分析、考勤报告和多劳务结算 |
| 门户与报表 | 客户/供应商门户、系统生成文件、预警升级、BI 驾驶舱和指标治理 |
| AI 分析 | 财务和老板自然语言问答、原因下钻、情景模拟、单据引用、权限和审计 |

## 仓库结构

pnpm monorepo（workspace 定义见 `pnpm-workspace.yaml`，目录约束见 [开发文档第 1 节](docs/development/development-guide.md)）：

```text
.
├── .github/                 # Issue、PR、Actions 与依赖更新配置
├── apps/
│   └── web/                 # 内部十三部门前端（Vue 3 + Vite + Pinia + Element Plus）
├── services/
│   └── api/                 # 核心后端（NestJS 模块化单体 + Prisma）
├── packages/
│   └── shared/              # 前后端共享契约：类型、错误码、金额与数量计算原语
├── infra/                   # docker-compose、环境模板、部署与监控
├── tests/                   # 端到端验收、集成、权限与性能测试
├── docs/                    # 产品、架构、流程、路线图和 Word 规划方案
└── tools/                   # 文档生成、仓库质量与模块边界检查工具
```

### 模块化铁律

「一个文件只做一件事、跨模块只走 `index.ts`、单文件 ≤ 400 行、单函数 ≤ 60 行、单 controller ≤ 8 个路由」不是口号，它由三层自动化把关：ESLint 尺寸红线与分层依赖约束、`tools/check-module-boundaries.mjs` 的结构化校验、以及编译全量 AppModule 的依赖注入测试。任何一条不过，`pnpm lint` 与 `pnpm test` 就是红的。

## 工作方式

1. 任何功能先关联 Word 基线中的需求编号或创建新的需求编号。
2. Issue 必须说明角色、业务场景、规则、数据、权限、预警、报表和验收证据。
3. 影响接口、数据模型、安全或关键流程的变更先提交 ADR。
4. 使用真实但脱敏的订单、批次和财务数据进行验收；禁止把生产敏感数据提交到仓库。
5. 财务、总经办、生产、品质、后工序、工程、PMC、采购、委外和行政使用独立工作台与权限范围。
6. 报价、库存、成本、财务、考勤和 AI 结果必须可追溯到源单据与数据截止时间。

## 本地开发

**只想在浏览器里把系统点一遍**（不装数据库、不起后端）：

```bash
pnpm install
pnpm dev:web          # http://localhost:5173，用 admin / Wfx@2026 登录
```

开发态默认走前端 mock，无需任何环境变量——`.env*` 全被 .gitignore 忽略，克隆下来直接能跑。

**接真后端联调**：

```bash
cp infra/.env.example infra/.env
cp services/api/.env.example services/api/.env
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev:api          # http://localhost:3000/api/v1（接口文档 /api/v1/docs）

cp apps/web/.env.example apps/web/.env.development   # 把 VITE_USE_MOCK 改成 false
pnpm dev:web
```

两条路径的完整步骤、验证方法与已知坑，见 **[本地运行手册](docs/development/local-run.md)**；
要把业务部十三个功能逐个点一遍或给人演示，见 **[业务部本地走查手册](docs/development/业务部本地走查手册.md)**。

演示账号密码统一 `Wfx@2026`：`admin`（IT）、`lucinda`（总经办）、`luoxiaolin`（业务主管）、`chenzhiqiang`（业务员）、`wugong`（报价工程师）、`pmc01`（PMC 计划员，ECN 受影响数量清点与返工发起）。后端能力清单见 [services/api/README.md](services/api/README.md)。

## 本地检查

```bash
pnpm lint                            # ESLint（含模块化尺寸红线与分层约束）
pnpm typecheck                       # 三个包全量类型检查
pnpm test                            # 单元测试
pnpm test:cov                        # 覆盖率（核心算法目录门槛 90% 分支）
node tools/check-module-boundaries.mjs   # 模块目录约定、controller 路由数、DTO 单一导出
python3 tools/check_repository.py        # 仓库基线检查（只用 Python 标准库）
```

Word 规划方案由 `tools/build_erp_plan.py` 生成。正式交付前必须渲染并逐页检查，不能只依赖文本或 OOXML 校验。

## 贡献与安全

提交变更前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题和敏感数据处理要求见 [SECURITY.md](SECURITY.md)。

## License

[MIT](LICENSE)

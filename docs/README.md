# 文档中心

## 规划基线

- [制造业 ERP 软件规划方案 V2.3](制造业ERP软件规划方案_V2.3.docx)：选型、RFP、实施范围和验收的详细基线（V2.3 增补订单四分类——新增备料订单总经办审批与加权成本结转，及客户对账单功能；V2.2 增补13部门蓝图与「模块开发顺序」章节）。
- [产品范围](product/vision-and-scope.md)：目标、角色、系统边界和不在当前范围内的事项。
- [十三部门组织与应用蓝图](product/department-operating-model.md)：工作台、数据归属、权限、流程和交接。
- [十三部门功能、权限、预警与报表矩阵](product/department-control-matrix.md)：逐部门功能、审批边界、预警和系统报表详细清单。
- [业务部模块需求规格](product/business-department-modules.md)：11个模块——工作台、报价（成本分析/修改申请）、订单（四类+订单追踪）、客户、BOM/ECN、出货退货、发票申请、报关与数据分析。
- [需求基线](product/requirements-baseline.md)：Epic、需求编号与研发交付映射。
- [路线图](roadmap.md)：从需求确认到试点上线的阶段门。
- [术语表](glossary.md)：跨部门统一业务语言。

## 关键专题

- [跨工序返工](workflows/cross-operation-rework.md)
- [返工子订单、重复成本与责任归集](workflows/rework-cost-accounting.md)
- [香港代生产客户正式订单70%价格规则](workflows/hong-kong-manufacturing-orders.md)
- [工序级制造成本核算](features/operation-level-costing.md)
- [报价到全检包装的订单全生命周期](workflows/order-to-pack-lifecycle.md)
- [实时金属材料价格中心](features/metal-price-center.md)
- [财务与老板 AI 分析问答（DeepSeek V4 Pro）](features/finance-executive-ai.md)
- [尾数返工与入库](workflows/tail-quantity-rework.md)
- [长时间工单未完结监控](features/aged-work-order-monitoring.md)
- [架机表与机台负荷管理](features/machine-loading-plan.md)

## 研发文档

- [开发文档：目录结构、模块划分与单一职责规范](development/development-guide.md)
- [项目开发顺序进度表](development/development-schedule.md)
- [接口规范](api/api-conventions.md)与[接口文档](api/api-reference.md)
- [TODO 清单](../TODO.md)

## 架构与治理

- [系统上下文](architecture/system-context.md)
- [数据与安全治理](architecture/data-and-security.md)
- [ADR-0001：仓库与架构基线](architecture/adr/0001-repository-and-architecture-baseline.md)
- [ADR-0003：应用与数据技术栈](architecture/adr/0003-technology-stack.md)

## 文档维护规则

1. Word 规划方案保存完整业务需求、选型和验收内容。
2. Markdown 保存研发需要频繁评审的范围、架构、流程和决策。
3. 两者发生冲突时，先创建 Issue 明确差异；经业务负责人批准后同时更新，不允许长期双轨。
4. 每项功能应使用稳定需求编号，并在 Issue、PR、测试和发布说明中保持一致。
5. 图纸、报价、供应商、成本和财务真实数据不得进入仓库。

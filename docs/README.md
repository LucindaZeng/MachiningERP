# 文档中心

## 规划基线

- [制造业 ERP 软件规划方案 V1.2](制造业ERP软件规划方案_V1.2.docx)：选型、RFP、实施范围和验收的详细基线。
- [产品范围](product/vision-and-scope.md)：目标、角色、系统边界和不在当前范围内的事项。
- [需求基线](product/requirements-baseline.md)：Epic、需求编号与研发交付映射。
- [路线图](roadmap.md)：从需求确认到试点上线的阶段门。
- [术语表](glossary.md)：跨部门统一业务语言。

## 关键专题

- [跨工序返工](workflows/cross-operation-rework.md)
- [实时金属材料价格中心](features/metal-price-center.md)
- [财务与老板 AI 分析问答](features/finance-executive-ai.md)

## 架构与治理

- [系统上下文](architecture/system-context.md)
- [数据与安全治理](architecture/data-and-security.md)
- [ADR-0001：仓库与架构基线](architecture/adr/0001-repository-and-architecture-baseline.md)

## 文档维护规则

1. Word 规划方案保存完整业务需求、选型和验收内容。
2. Markdown 保存研发需要频繁评审的范围、架构、流程和决策。
3. 两者发生冲突时，先创建 Issue 明确差异；经业务负责人批准后同时更新，不允许长期双轨。
4. 每项功能应使用稳定需求编号，并在 Issue、PR、测试和发布说明中保持一致。
5. 图纸、报价、供应商、成本和财务真实数据不得进入仓库。

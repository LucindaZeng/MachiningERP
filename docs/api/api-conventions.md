# 接口规范（API Conventions）

适用于 services/api 全部 REST 接口。资源清单见 [api-reference.md](api-reference.md)。

## 基础

- Base URL：内部 `https://erp.example.com/api/v1`，门户 `https://portal.example.com/api/v1`（独立网关与账号域，不共享会话）。
- 格式：JSON，UTF-8；日期时间 ISO 8601 带时区；金额 `{ "amount": "1234.56", "currency": "CNY" }` 字符串定点数；数量同为字符串定点数。
- 版本：路径版本 `/v1`；破坏性变更升 `/v2` 并保留旧版一个阶段。

## 认证与权限

- `Authorization: Bearer <JWT>`；内部用户经 OIDC 登录，门户账号（客户/供应商）独立签发，token 内含 `audience`。
- RBAC + 数据权限：角色决定功能，数据范围（部门/客户/供应商/字段级）由 identity 模块在查询层强制；门户请求自动注入 `supplier_id`/`customer_id` 过滤，越权返回 404 而非 403。
- 敏感字段（费率、工资、供应商底价）按字段权限在序列化层裁剪。

## 请求约定

- 列表：`GET /orders?page=1&pageSize=50&sort=-createdAt&status=approved&q=关键词`；`pageSize` ≤ 200。
- 响应包裹：
  ```json
  { "data": [...], "meta": { "page": 1, "pageSize": 50, "total": 1234 } }
  ```
- 写操作幂等：POST 创建单据须带 `Idempotency-Key` 头，重复请求返回首个结果。
- 乐观锁：更新须带 `version`，冲突返回 409。
- 状态迁移用动作端点而非 PATCH status：`POST /sales-orders/{id}/submit`、`/approve`、`/reject`，便于记录审批耗时。

## 错误

```json
{ "error": { "code": "ORD_2003", "message": "正式业务订单价格不能为零", "traceId": "..." } }
```

| 段 | 含义 |
| --- | --- |
| AUTH_1xxx | 认证/权限 |
| ORD_2xxx | 报价/订单/合同（含 HK 价格规则 ORD_25xx） |
| PMC_3xxx | MRP/计划/架机 |
| PUR_4xxx | 采购/委外/供应商 |
| WMS_5xxx | 仓储/批次 |
| MES_6xxx | 工单/报工/防跳/返工（防跳拦截 MES_66xx） |
| QMS_7xxx | 检验/冻结/放行 |
| FIN_8xxx | 财务/成本/月结 |
| SYS_9xxx | 系统/校验/幂等/乐观锁 |

HTTP 语义：400 校验、401/403 认证权限、404 不存在或越权、409 冲突/状态机非法、422 业务规则拒绝、429 限流。

## 事件（Webhook / 内部领域事件）

- 命名 `domain.entity.action`：`order.sales-order.approved`、`mes.handoff.quantity-mismatch`、`alert.escalated`。
- 载荷含 `eventId`、`occurredAt`、`traceId`、实体快照关键字段；消费方幂等。
- 预警中心、节点计时、BI 均以事件为事实来源，业务模块不得直接写预警表。

## 审计与计时

- 所有写请求记录审计（用户、IP、前后值摘要、traceId）。
- 单据状态迁移自动写入 `doc_timeline`（节点、进入/离开时间、责任人），支撑"每个环节花了多长时间"的需求，接口 `GET /timelines/{docType}/{id}`。

## 文件

- 系统生成文件（报价单 PDF、送货单、对账单、报关资料等）由 docgen 统一出：`POST /documents/{templateCode}/render` → 返回受权限控制的下载 URL（MinIO 预签名，短时效）；每次生成留版本快照。

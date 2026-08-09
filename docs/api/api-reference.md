# 接口文档（API Reference）

规范见 [api-conventions.md](api-conventions.md)。按模块列出核心资源与端点；字段细节在开发时由 DTO（packages/shared）生成 OpenAPI 作为唯一权威，本文维护业务语义。

## auth / identity / org

> 本段已在 `services/api` 落地，实现细节见 [services/api/README.md](../../services/api/README.md)。标 ✅ 的为已上线端点。

| 端点 | 说明 |
| --- | --- |
| ✅ GET /auth/captcha | 图形验证码挑战；连续登录失败 3 次后必填，8 次临时锁定 |
| ✅ POST /auth/login · /auth/logout | 登录签发 JWT、注销即撤销（门户独立账号域，token 内含 audience） |
| ✅ GET /auth/me | 当前用户与权限点集合；前端不再自行推导权限 |
| ✅ POST /auth/account-availability | 登录页「申请账户」的用户名可用性校验；离职释放的用户名可重新登记并提示原使用人 |
| ✅ POST /auth/account-requests | 提交账户申请；**注册即发放唯一编码**，终身不变、永不复用 |
| ✅ POST /auth/password-reset-requests | 忘记密码：派单给 IT 系统管理员重置，不发邮件/短信重置链接 |
| POST /auth/refresh | 续签（待实现） |
| GET/POST/PUT /users, /roles, /permissions | 用户与 RBAC；数据权限规则 `/data-scopes` |
| ✅ GET /departments | 十三部门清单（申请账户的部门下拉需要，未登录可读） |
| POST/PUT /departments, /work-centers, /shift-calendars | 组织维护、工作中心、班次日历（待实现） |

## masterdata（主数据与工程）

| 端点 | 说明 |
| --- | --- |
| /materials, /customers, /suppliers | 物料/客户/供应商主数据；客户含 `hkPricingEnabled` 勾选 |
| /drawings, /drawings/{id}/versions | 图纸与版本、水印预览、下载日志 |
| /boms, /boms/{id}/versions, POST /bom-requests | BOM、版本、业务提交新建 BOM 申请（ENG-02） |
| /routings | 工艺路线：工序、机台、夹位、每夹位时间、准备时间 |
| /equipment, /toolings, /gauges, /programs | 设备、工装夹具模具刀具、检具、CNC 程序 |
| /engineering-changes | 工程变更（改图必改工艺路线联动、中途改工序入口） |

## quotation（报价）

| 端点 | 说明 |
| --- | --- |
| POST /inquiries | 客户询价与资料上传 |
| GET /quotations/similar?drawing=…&material=… | 相似产品与历史报价检索 |
| POST /quotations · /quotations/{id}/cost-analysis | 建报价、成本分析表（可引用金属价格快照） |
| POST /quotations/{id}/submit /approve | 报价审批 |
| POST /quotations/{id}/render-pdf | 生成客户报价单 PDF |

## contract-order（合同与订单）

| 端点 | 说明 |
| --- | --- |
| POST /contracts, POST /contracts/{id}/review | 合同上传与跨部门合同评审 |
| POST /sales-orders | 建业务订单，`type`: mold/sample/formal；阶梯价格行 |
| POST /sales-orders/{id}/submit /manager-approve /finance-approve /review | 业务经理审核→财务审核→订单评审（逐节点计时） |
| POST /sales-orders/{id}/tail-plan | 交付后尾数处理路径（返工补交/入库/直接入库/报废） |
| GET /sales-orders/{id}/timeline | 订单全生命周期时间轴 |

## hk-pricing

| 端点 | 说明 |
| --- | --- |
| POST /hk-pricing/calculate | 输入价×70% 试算与适用性校验（仅 formal 且客户勾选） |
| GET /hk-pricing/audits?orderId=… | 原价/计算价版本与审计表 |

## pmc / aps-loading

| 端点 | 说明 |
| --- | --- |
| POST /mrp/runs, GET /mrp/runs/{id}/suggestions | 跑 MRP、净需求与采购/生产/委外建议 |
| GET /kitting?orderId=… | 动态成品备料与齐套（滚动库存−订单需求=还需采购） |
| GET/PUT /delivery-plans | 周/日交货计划与优先级 |
| POST /loading-plans/generate | 自动生成初版架机表 |
| PUT /loading-plans/{id}/slots/{slotId} | 调整架机（留痕+交期模拟） |
| GET /loading-plans/conflicts, /loading-plans/utilization | 共用资源冲突、架机率与负荷平衡 |

## procurement / outsourcing / supplier-portal

| 端点 | 说明 |
| --- | --- |
| POST /purchase-orders, POST /purchase-orders/{id}/finance-approve | 采购下单与财务审核 |
| GET /purchase-orders/{id}/progress | 供应商确认/备货/发运节点 |
| POST /outsourcing-orders, /outsourcing-orders/{id}/dispatch /receive | 委外发出与回厂 |
| GET/POST /statements/purchase, /statements/outsourcing | 采购/委外对账单（含返工二次委外应付、供应商责任零应付控制） |
| 门户：POST /portal/rfq-responses | 供应商在线报价 |
| 门户：GET /portal/orders, PUT /portal/orders/{id}/progress | 供应商查单、维护进度 |
| 门户：POST /portal/asn, POST /portal/asn/{id}/delivery-note | 创建 ASN、打印送货单 PDF |

## metal-price

| 端点 | 说明 |
| --- | --- |
| GET /metal-prices/board | 实时行情看板（采购/财务/业务分视图授权） |
| POST /metal-prices/snapshots | 报价/核价引用的价格快照 |
| GET /metal-prices/alerts | 涨跌超阈值预警配置 |

## wms

| 端点 | 说明 |
| --- | --- |
| POST /receipts（收料）· /issues（发料）· /transfers | 出入库与移库，批次一码到底 |
| GET /bin-map | 仓位图；`PUT /bins/{id}` 摆放标准 |
| GET /stocks?view=remnant|dull | 余料、呆滞物料 |
| POST /stocktakes | 盘点 |

## mes / rework

| 端点 | 说明 |
| --- | --- |
| POST /work-orders, POST /work-orders/{id}/dispatch | 工单与派工（来源含架机表） |
| POST /scan/start /pause /report /handoff | 扫码开工、暂停、报工、转序（防跳校验，条件跳序走 /skip-requests） |
| POST /handoffs/{id}/confirm | 数量交接：接收方实点，差异自动预警给上道（94/100 场景） |
| POST /quality-issues/{id}/rework-orders | 拆返工子订单：路线 A/B、数量拆分子批次 |
| GET /rework-orders/{id}/route | 返工重流路线与复检要求 |
| GET /work-orders/aging | 未完结工单账龄分层（长时间未完结监控） |
| POST /work-orders/{id}/close-review | 疑似死单强制完结评审 |
| GET /machines/{id}/oee, /downtimes | 设备绩效、停机原因 |

## qms

| 端点 | 说明 |
| --- | --- |
| POST /inspections（type: iqc/first/patrol/last/fai/oqc） | 各类检验，含点数、原始测量值、照片 |
| POST /quality-issues, /quality-issues/{id}/disposition | 异常上报（同步照片）、评审处置、责任判定 |
| POST /holds, /holds/{id}/release | 质量冻结与放行 |
| GET /fai-reports/{id} | FAI 报告生成与受控下载 |

## costing / finance

| 端点 | 说明 |
| --- | --- |
| GET /op-costs?workOrderId=… | 工序成本卡：转入/新增/累计/单位成本 |
| GET /op-costs/variance | 标准/实际差异分析 |
| GET /rework-costs?orderId=…&responsible=… | 返工成本按责任方（CNC/委外供应商）归集、供应商质量损失 |
| POST /vouchers/auto | 业务单据自动凭证 |
| /ar, /ap, /statements/reconcile | 应收应付与对账 |
| POST /period-close/checks | 月结检查（含工序成本完整性、应关未关工单） |

## hr-attendance

| 端点 | 说明 |
| --- | --- |
| POST /attendance/imports | 考勤机数据采集 |
| GET /attendance/reports?period=… | 日报/月报、与 MES 工时差异 |
| POST /labor-settlements | 多劳务单位结算与对账 |

## docgen / alerts / timing / bi / ai-qa

| 端点 | 说明 |
| --- | --- |
| POST /documents/{templateCode}/render | 生成全部系统文件（报价单、发票、报关资料、各进度表、对账单、仓位图、各分析表） |
| GET /alerts?level=…&domain=… · POST /alerts/{id}/ack /close | 统一预警与闭环 |
| GET /timelines/{docType}/{id} · GET /sla-analytics | 节点耗时、审批时效分析（T0 起量化） |
| GET /dashboards/{code}, GET /metrics/{code}/drilldown | 驾驶舱与钻取 |
| POST /ai/sessions, POST /ai/sessions/{id}/ask | 财务/老板 AI 问答（DeepSeek V4 Pro，引用+审计） |
| POST /ai/sessions/{id}/export | 保存/导出 AI 分析报告 |

## customer-portal（客户）

| 端点 | 说明 |
| --- | --- |
| GET /portal/projects, /portal/projects/{id}/milestones | 项目进度 |
| GET /portal/delivery-plans, /portal/shipments | 交货计划与发货 |
| GET /portal/documents | 质量文件/对账文件下发（数据完全隔离） |

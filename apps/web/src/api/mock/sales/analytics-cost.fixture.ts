/**
 * 类型已迁到 `@machining-erp/shared`（development-guide §1：packages/shared 承载前后端共享契约）。
 * 本文件只保留 **mock 数据**——真实接口未接通时的回落数据源，形状由 shared 保证与后端一致。
 */
import type {
  CostReports,
} from '@machining-erp/shared'


/**
 * 报价成本偏差分析 + 成本参考值反馈 + 审核时效（含备料订单总经办审批时效）。
 * 偏差口径：实际成本取生产订单工序报工 / 领料 / 委外对账，报价成本取核价单同工序预估值；
 * 领用备料的订单一律按加权平均成本口径参与偏差计算。
 */


export const COST_REPORTS: CostReports = {
  threshold: {
    warn: 0.03,
    alert: 0.05,
    note: '单项偏差 ≥3% 预警、≥5% 报警；报警项在修正成本参考值前，同类产品新报价会强制提示复核。',
  },

  elementVariance: [
    {
      element: '材料',
      quoted: 41.8,
      actual: 44.1,
      gapRate: 0.055,
      orders: 46,
      share: 0.472,
      mainReason: '棒料损耗率实际 9.2%，核价按 8% 假设；7075 / TC4 采购价环比上涨',
    },
    {
      element: '加工时间',
      quoted: 32.6,
      actual: 35.9,
      gapRate: 0.101,
      orders: 46,
      share: 0.368,
      mainReason: '换刀与调机工时未计入标准工时；四轴精加工实际比假设多 1.0～2.5min/件',
    },
    {
      element: '工艺',
      quoted: 14.2,
      actual: 14.6,
      gapRate: 0.028,
      orders: 46,
      share: 0.16,
      mainReason: '刀具工装分摊基数按报价数量，实投数量偏离；委外表处单价基本稳定',
    },
  ],

  drill: [
    {
      dimension: '产品',
      name: '光学镜筒 RX-4102',
      orders: 4,
      materialGap: 0.049,
      timeGap: 0.101,
      processGap: 0.121,
      totalGap: 0.054,
      level: 'alert',
      action: '钛涂层刀具寿命低于假设，四轴工时上调至 22min，刀具分摊按实投数量重算',
    },
    {
      dimension: '产品',
      name: '导轨压板 MT-7601',
      orders: 3,
      materialGap: 0.02,
      timeGap: 0.146,
      processGap: 0.185,
      totalGap: 0.052,
      level: 'alert',
      action: '平面度 0.02 需二次光刀，精铣工时补 1.5min；专用夹具分摊改按最小批量 600 件',
    },
    {
      dimension: '产品',
      name: '连接器底座 HS-4102-B',
      orders: 6,
      materialGap: 0.048,
      timeGap: 0.092,
      processGap: -0.045,
      totalGap: 0.034,
      level: 'watch',
      action: '走心机换刀频次纳入标准工时；材料损耗率按 9% 修正',
    },
    {
      dimension: '材质',
      name: '7075-T651 铝合金',
      orders: 9,
      materialGap: 0.062,
      timeGap: 0.088,
      processGap: 0.09,
      totalGap: 0.07,
      level: 'alert',
      action: '原材料价格表 7075 单价上调，硬质阳极委外单价同步复核',
    },
    {
      dimension: '材质',
      name: '45# 钢',
      orders: 11,
      materialGap: 0.018,
      timeGap: 0.132,
      processGap: 0.06,
      totalGap: 0.046,
      level: 'watch',
      action: '铣削工时假设偏乐观，按 VMC-03 实际报工重算费率',
    },
    {
      dimension: '材质',
      name: '6061-T6 铝合金',
      orders: 18,
      materialGap: 0.041,
      timeGap: 0.05,
      processGap: -0.02,
      totalGap: 0.031,
      level: 'watch',
      action: '损耗率修正为 9%，其余维持',
    },
    {
      dimension: '材质',
      name: '316L / 304 不锈钢',
      orders: 8,
      materialGap: 0.012,
      timeGap: 0.021,
      processGap: 0.008,
      totalGap: 0.015,
      level: 'ok',
      action: '偏差在阈值内，成本参考值维持',
    },
    {
      dimension: '报价工程师',
      name: '陈志强',
      orders: 21,
      materialGap: 0.058,
      timeGap: 0.096,
      processGap: 0.085,
      totalGap: 0.062,
      level: 'alert',
      action: '难加工材料工时假设普遍偏低，需按机台实际报工库取值而非经验值',
    },
    {
      dimension: '报价工程师',
      name: '罗晓琳',
      orders: 25,
      materialGap: 0.033,
      timeGap: 0.042,
      processGap: 0.011,
      totalGap: 0.031,
      level: 'watch',
      action: '整体可控，材料损耗率统一按新值取数',
    },
  ],

  operationVariance: [
    { operation: 'CNC 走心', element: '加工时间', orders: 12, quoted: 3.25, actual: 3.55, gapRate: 0.092, reason: '换刀频次高于假设，单件多 0.9min' },
    { operation: '加工中心精铣', element: '加工时间', orders: 9, quoted: 4.4, actual: 4.9, gapRate: 0.114, reason: '平面度要求触发二次光刀' },
    { operation: '四轴粗加工', element: '加工时间', orders: 6, quoted: 10.5, actual: 11.55, gapRate: 0.1, reason: '7075 硬料进给下调' },
    { operation: '切料', element: '材料', orders: 24, quoted: 4.54, actual: 4.76, gapRate: 0.048, reason: '实际损耗 9.2% 高于假设 8%' },
    { operation: '刀具工装分摊', element: '工艺', orders: 15, quoted: 1.6, actual: 2.06, gapRate: 0.288, reason: '实投数量低于报价数量，分摊上升' },
    { operation: '委外阳极氧化', element: '工艺', orders: 18, quoted: 2.05, actual: 2.05, gapRate: 0, reason: '按框架协议价结算，无偏差' },
    { operation: '钳工去毛刺', element: '加工时间', orders: 21, quoted: 2.4, actual: 2.48, gapRate: 0.033, reason: '毛刺量与批次来料有关' },
    { operation: '包装', element: '工艺', orders: 26, quoted: 0.7, actual: 0.42, gapRate: -0.4, reason: '改用通用箱型，包材成本下降' },
  ],

  costRef: [
    {
      item: '铝合金棒料损耗率',
      scope: '6061 / 6063 / 7075 全系',
      current: '8.0%',
      suggested: '9.0%',
      basis: '近 46 张成交订单领料实测均值 9.2%，剔除异常批次后 9.0%',
      status: '待确认',
    },
    {
      item: '走心机 SW 系列标准工时',
      scope: '含换刀与调机摊销',
      current: '9.5 min/件',
      suggested: '10.4 min/件',
      basis: '工序报工实际均值，含换刀频次修正',
      status: '待确认',
    },
    {
      item: '专用夹具分摊基数',
      scope: '小批量（＜1000 件）订单',
      current: '按报价数量分摊',
      suggested: '按最小投产批量分摊，尾差在结案时冲销',
      basis: 'MT-7601 报价 800 件实投 600 件，分摊偏差 +33%',
      status: '已采纳',
    },
    {
      item: '7075-T651 原材料单价',
      scope: '原材料价格表',
      current: '38.60 元/kg',
      suggested: '41.20 元/kg',
      basis: '近 3 个月采购到货均价，供应商已发调价函',
      status: '已采纳',
    },
    {
      item: '包装工序成本',
      scope: '通用箱型产品',
      current: '0.70 元/件',
      suggested: '0.45 元/件',
      basis: '后工序改通用箱型后实际 0.42 元/件',
      status: '待确认',
    },
    {
      item: '硬质阳极委外单价',
      scope: '7075 硬质阳极（黑）',
      current: '5.60 元/件',
      suggested: '维持',
      basis: '框架协议有效期至 2026-12-31，无偏差',
      status: '已驳回',
    },
  ],

  slaNodes: [
    { doc: '报价单', node: '询价登记 → 分派核价', owner: '业务部', avgHours: 3.2, p90Hours: 6.5, slaHours: 8, overdueRate: 0.04 },
    { doc: '报价单', node: '核价（成本分析）', owner: '工程 / 报价工程师', avgHours: 17.4, p90Hours: 34.0, slaHours: 24, overdueRate: 0.21 },
    { doc: '报价单', node: '报价审批（毛利达标）', owner: '业务经理', avgHours: 5.1, p90Hours: 11.0, slaHours: 12, overdueRate: 0.07 },
    { doc: '报价单', node: '低毛利会签 + 总经办批准', owner: '会签 / 总经办', avgHours: 26.8, p90Hours: 52.0, slaHours: 36, overdueRate: 0.29 },
    { doc: '正式订单', node: '订单评审（业务 / 工程 / PMC）', owner: '多部门', avgHours: 14.6, p90Hours: 28.0, slaHours: 24, overdueRate: 0.13 },
    { doc: '正式订单', node: '财务信用与账期确认', owner: '财务部', avgHours: 6.4, p90Hours: 15.0, slaHours: 12, overdueRate: 0.09 },
    { doc: '备料订单', node: '业务提交 → PMC 产能确认', owner: 'PMC', avgHours: 9.8, p90Hours: 19.0, slaHours: 16, overdueRate: 0.12 },
    { doc: '备料订单', node: '总经办审批（占用资金）', owner: '总经办', avgHours: 31.5, p90Hours: 62.0, slaHours: 24, overdueRate: 0.38 },
    { doc: 'BOM 申请', node: '工程确认 BOM 可下单', owner: '工程部', avgHours: 12.1, p90Hours: 22.0, slaHours: 24, overdueRate: 0.06 },
    { doc: 'ECN 申请', node: '变更评估 → 工艺路线同步', owner: '工程 / PMC', avgHours: 20.3, p90Hours: 40.0, slaHours: 24, overdueRate: 0.18 },
  ],

  stockApproval: [
    { docNo: 'STK-20260706-0004', productName: '连接器底座 HS-4102-B', qty: 2000, amount: 2.5, submittedAt: '2026-07-06 09:20', approvedAt: '2026-07-07 16:40', hours: 31.3, slaHours: 24, approver: '总经办 · 王总' },
    { docNo: 'STK-20260618-0003', productName: '屏蔽罩 HS-3980-A', qty: 8000, amount: 4.3, submittedAt: '2026-06-18 14:05', approvedAt: '2026-06-19 10:30', hours: 20.4, slaHours: 24, approver: '总经办 · 王总' },
    { docNo: 'STK-20260527-0002', productName: '光学镜筒 RX-4102', qty: 480, amount: 1.9, submittedAt: '2026-05-27 11:10', approvedAt: '2026-05-30 09:15', hours: 70.1, slaHours: 24, approver: '总经办 · 王总' },
    { docNo: 'STK-20260412-0001', productName: '散热底板 DX-3311', qty: 1500, amount: 2.6, submittedAt: '2026-04-12 08:40', approvedAt: '2026-04-12 17:50', hours: 9.2, slaHours: 24, approver: '总经办 · 王总' },
  ],
}

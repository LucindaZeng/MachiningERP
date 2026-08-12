/**
 * 类型已迁到 `@machining-erp/shared`（development-guide §1：packages/shared 承载前后端共享契约）。
 * 本文件只保留 **mock 数据**——真实接口未接通时的回落数据源，形状由 shared 保证与后端一致。
 */
import type {
  MarketReports,
} from '@machining-erp/shared'


/**
 * 客户流失预警（含跟进结果）、产品与材质工艺分析、出货达成明细（部分出货 / 尾数 / 阻断原因）、
 * 退货质量分析（责任归属与损失金额）。
 */

export const MARKET_REPORTS: MarketReports = {
  churn: [
    {
      customer: '深圳兆丰医疗',
      grade: 'B',
      lastOrderAt: '2025-11-10',
      daysSince: 260,
      avgIntervalDays: 62,
      amountChange: -1,
      level: 'churn',
      owner: '罗晓琳',
      followedAt: '2026-06-18',
      followResult: '客户改用钛合金一体件，转向有真空钎焊能力的供应商',
      nextAction: '已判定流失；若引入钎焊工艺可重新接触，列入年度设备评估输入',
    },
    {
      customer: '苏州明泰自动化',
      grade: 'B',
      lastOrderAt: '2026-04-29',
      daysSince: 90,
      avgIntervalDays: 34,
      amountChange: -0.62,
      level: 'risk',
      owner: '罗晓琳',
      followedAt: '2026-07-16',
      followResult: '客户反馈上一批导轨压板平面度超差返工，暂缓下单',
      nextAction: '品质部出 8D，业务带改善报告拜访；8 月前恢复下单否则降级为 C',
    },
    {
      customer: '东莞德信电子',
      grade: 'A',
      lastOrderAt: '2026-07-01',
      daysSince: 27,
      avgIntervalDays: 18,
      amountChange: -0.28,
      level: 'watch',
      owner: '罗晓琳',
      followedAt: '2026-07-22',
      followResult: '客户年中去库存，Q3 预测下调 25%，未转移供应商',
      nextAction: '按新预测调整备料计划，避免呆滞；9 月复评',
    },
    {
      customer: 'Radex Instruments Inc.',
      grade: 'A',
      lastOrderAt: '2026-07-08',
      daysSince: 20,
      avgIntervalDays: 22,
      amountChange: 0.14,
      level: 'watch',
      owner: '陈志强',
      followedAt: '2026-07-20',
      followResult: '正常，探头支架新版 ECN 导致节奏波动',
      nextAction: '推进新版量产报价，回收旧版备料',
    },
  ],

  productProcess: [
    { productName: '光学镜筒', drawingNo: 'RX-4102', material: '7075-T651 铝合金', processRoute: '切料 → 四轴粗 → 四轴精 → 委外硬阳 → 镭雕 → 包装', orders: 9, amount: 186.2, marginRate: 0.298, machineHours: 412, difficulty: '难加工', note: '四轴机时占比高，是 Q4 产能瓶颈来源' },
    { productName: '液压阀座', drawingNo: 'BR-2104', material: '304 不锈钢', processRoute: '切料 → 车 → 加工中心 → 钝化 → 清洗 → 包装', orders: 8, amount: 214.6, marginRate: 0.311, machineHours: 268, difficulty: '较难', note: '毛利最高，欧洲客户认证壁垒高，优先保交期' },
    { productName: '连接器底座', drawingNo: 'HS-4102-B', material: '6061-T6 铝合金', processRoute: '切料 → CNC 走心 → 去毛刺 → 委外阳极 → 包装', orders: 12, amount: 268.4, marginRate: 0.196, machineHours: 356, difficulty: '常规', note: '量最大但毛利低于报价 2.2pt，走心机工时需修正' },
    { productName: '手术器械夹持件', drawingNo: 'ZF-7710', material: 'TC4 钛合金', processRoute: '切料 → 加工中心 → 慢走丝 → 喷砂钝化 → 清洗', orders: 3, amount: 85.8, marginRate: 0.244, machineHours: 96, difficulty: '难加工', note: '刀具消耗大，实际毛利低于报价 5.3pt，需重定刀具分摊' },
    { productName: '导轨压板', drawingNo: 'MT-7601', material: '45# 钢', processRoute: '切料 → 粗铣 → 精铣 → 去毛刺 → 委外发黑 → 包装', orders: 3, amount: 31.8, marginRate: 0.151, machineHours: 88, difficulty: '常规', note: '精度要求触发二次光刀，毛利最差，建议调价或退出' },
    { productName: '屏蔽罩', drawingNo: 'HS-3980-A', material: '6063-T5 铝合金', processRoute: '切料 → 走心 → 去毛刺 → 喷砂阳极 → 包装', orders: 10, amount: 142.8, marginRate: 0.142, machineHours: 194, difficulty: '常规', note: '大批量薄利，靠稼动率维持，不宜再降价' },
  ],

  materialProcess: [
    { material: '6061-T6 铝合金', turning: 186, milling: 242, fourAxis: 64, outsource: 128 },
    { material: '6063-T5 铝合金', turning: 142, milling: 88, fourAxis: 12, outsource: 96 },
    { material: '7075-T651 铝合金', turning: 46, milling: 118, fourAxis: 286, outsource: 74 },
    { material: '304 / 316L 不锈钢', turning: 96, milling: 204, fourAxis: 38, outsource: 52 },
    { material: '45# 钢', turning: 68, milling: 156, fourAxis: 6, outsource: 44 },
    { material: 'TC4 钛合金', turning: 22, milling: 74, fourAxis: 18, outsource: 26 },
  ],

  partialShip: [
    { orderNo: 'SO-20260612-0074', customer: 'Radex Instruments Inc.', productName: '探头支架 RX-3390-C', orderQty: 800, shippedQty: 620, remainQty: 180, tailPath: '补做（客户要求足额）', dueDate: '2026-07-28', note: '委外表处不良 180 件返工，补做后一次性出清' },
    { orderNo: 'SO-20260625-0081', customer: '香港宏晟精密（代生产）', productName: '连接器底座 HS-4102-B', orderQty: 5000, shippedQty: 3400, remainQty: 1600, tailPath: '分批出货', dueDate: '2026-08-02', note: '客户同意分两批，第二批 8/06 前出' },
    { orderNo: 'SO-20260508-0052', customer: '东莞德信电子', productName: '散热底板 DX-3311', orderQty: 1500, shippedQty: 1476, remainQty: 24, tailPath: '尾数取消（在允收范围）', dueDate: '2026-07-20', note: '±2% 允收，尾数 24 件取消并关单' },
    { orderNo: 'SO-20260530-0066', customer: '苏州明泰自动化', productName: '导轨压板 MT-7601', orderQty: 800, shippedQty: 0, remainQty: 800, tailPath: '待定', dueDate: '2026-07-25', note: '原材料未到，全单未出，需与客户书面改期' },
  ],

  shipBlockers: [
    { reason: '报关资料未齐套（箱单 / 发票 / 产地证）', count: 9, qtyAffected: 12400, share: 0.281, avgDelayDays: 2.4, owner: '业务部' },
    { reason: '品质终检未放行 / 待判定', count: 8, qtyAffected: 9800, share: 0.25, avgDelayDays: 1.8, owner: '品质部' },
    { reason: '委外表处未回厂', count: 6, qtyAffected: 7600, share: 0.188, avgDelayDays: 3.6, owner: 'PMC / 采购' },
    { reason: '客户未确认出货通知 / 未指定货代', count: 5, qtyAffected: 5200, share: 0.156, avgDelayDays: 1.2, owner: '客户' },
    { reason: '信用额度超限，财务暂停发货', count: 3, qtyAffected: 3100, share: 0.094, avgDelayDays: 4.1, owner: '财务部' },
    { reason: '包材缺料', count: 1, qtyAffected: 900, share: 0.031, avgDelayDays: 0.8, owner: '后工序' },
  ],

  rmaResponsibility: [
    { responsibility: '本厂加工不良（尺寸 / 外观）', batches: 11, quantity: 3240, lossAmount: 14.6, share: 0.468, handled: '返工 8 批、报废 3 批，已出 8D 并修正工艺参数' },
    { responsibility: '委外表处不良', batches: 5, quantity: 1860, lossAmount: 7.2, share: 0.231, handled: '向供应商索赔 4.1 万，已在对账单抵扣' },
    { responsibility: '来料 / 原材料缺陷', batches: 3, quantity: 980, lossAmount: 4.4, share: 0.141, handled: '供应商换料并承担运费' },
    { responsibility: '客户图纸变更未同步', batches: 3, quantity: 720, lossAmount: 3.1, share: 0.099, handled: '客户承担，已开变更订单补差' },
    { responsibility: '包装 / 运输损伤', batches: 2, quantity: 420, lossAmount: 1.6, share: 0.061, handled: '改用加强箱型，货代赔付部分' },
  ],
}

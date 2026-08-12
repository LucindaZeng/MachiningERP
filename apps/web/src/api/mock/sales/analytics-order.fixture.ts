/**
 * 类型已迁到 `@machining-erp/shared`（development-guide §1：packages/shared 承载前后端共享契约）。
 * 本文件只保留 **mock 数据**——真实接口未接通时的回落数据源，形状由 shared 保证与后端一致。
 */
import type {
  OrderExtraReports,
} from '@machining-erp/shared'


/**
 * 订单结构（五类）、在手订单 Backlog、样品转化率、备料分析。
 * 备料订单不向客户交货，全部入库即视为完成；正式订单可关联消耗，成本按加权平均口径计入。
 */

export const ORDER_EXTRA_REPORTS: OrderExtraReports = {
  orderType5: [
    { type: '正式订单', count: 96, quantity: 184600, amount: 1268.4, share: 0.742, marginRate: 0.214, note: '主营量产订单，交期与毛利均以此为考核基准' },
    { type: '模具订单', count: 14, quantity: 14, amount: 186.0, share: 0.109, marginRate: 0.268, note: '一次性收费，验收后转量产，需跟踪模具寿命与维修责任' },
    { type: '备料订单', count: 9, quantity: 21600, amount: 123.5, share: 0.072, marginRate: null, note: '不向客户交货，全部入库即完成；毛利在被正式订单领用时才实现' },
    { type: '样品订单', count: 41, quantity: 386, amount: 68.2, share: 0.04, marginRate: 0.061, note: '含免费与收费两类，考核转化率而非毛利' },
    { type: '变更订单', count: 23, quantity: 9200, amount: 63.4, share: 0.037, marginRate: 0.152, note: 'ECN 触发的数量 / 图纸 / 交期变更，需回溯原单并同步工艺路线' },
  ],

  backlogMonth: [
    { month: '2026-08', orders: 34, quantity: 62400, amount: 418.6, capacityLoad: 0.92, risk: 'tight' },
    { month: '2026-09', orders: 28, quantity: 51800, amount: 356.2, capacityLoad: 0.81, risk: 'ok' },
    { month: '2026-10', orders: 19, quantity: 36200, amount: 262.4, capacityLoad: 1.08, risk: 'over' },
    { month: '2026-11', orders: 11, quantity: 18900, amount: 141.8, capacityLoad: 0.63, risk: 'ok' },
    { month: '2026-12 及以后', orders: 6, quantity: 9600, amount: 88.4, capacityLoad: 0.34, risk: 'ok' },
  ],

  backlogCustomer: [
    { name: '香港宏晟精密（代生产）', orders: 26, amount: 402.6, share: 0.322, nearestDue: '2026-08-06' },
    { name: 'Brenner Maschinenbau GmbH', orders: 14, amount: 286.4, share: 0.229, nearestDue: '2026-08-14' },
    { name: 'Radex Instruments Inc.', orders: 17, amount: 231.8, share: 0.185, nearestDue: '2026-08-02' },
    { name: '东莞德信电子', orders: 21, amount: 168.2, share: 0.135, nearestDue: '2026-08-09' },
    { name: '苏州明泰自动化', orders: 12, amount: 96.4, share: 0.077, nearestDue: '2026-08-21' },
    { name: '深圳兆丰医疗', orders: 8, amount: 66.0, share: 0.052, nearestDue: '2026-09-03' },
  ],

  backlogProduct: [
    { name: '连接器底座 HS-4102-B', orders: 12, amount: 268.4, share: 0.215, nearestDue: '2026-08-06' },
    { name: '液压阀座 BR-2104', orders: 8, amount: 214.6, share: 0.172, nearestDue: '2026-08-14' },
    { name: '光学镜筒 RX-4102', orders: 9, amount: 186.2, share: 0.149, nearestDue: '2026-08-02' },
    { name: '屏蔽罩 HS-3980-A', orders: 10, amount: 142.8, share: 0.114, nearestDue: '2026-08-11' },
    { name: '散热底板 DX-3311', orders: 11, amount: 118.4, share: 0.095, nearestDue: '2026-08-09' },
    { name: '其他 27 项', orders: 48, amount: 317.0, share: 0.255, nearestDue: '2026-08-04' },
  ],

  backlogAlerts: [
    { orderNo: 'SO-20260612-0074', customer: 'Radex Instruments Inc.', productName: '探头支架 RX-3390-C', dueDate: '2026-07-28', daysLeft: -3, stage: '委外表处（东莞华表）', level: 'late', owner: '陈志强', action: '委外已逾期 3 天，需 PMC 协调加急并向客户发出延期通知' },
    { orderNo: 'SO-20260625-0081', customer: '香港宏晟精密（代生产）', productName: '连接器底座 HS-4102-B', dueDate: '2026-08-02', daysLeft: 2, stage: 'CNC 加工', level: 'due', owner: '罗晓琳', action: '剩余 2 天，产出进度 68%，需插单或分批出货' },
    { orderNo: 'SO-20260701-0088', customer: '东莞德信电子', productName: '散热底板 DX-3311', dueDate: '2026-08-04', daysLeft: 4, stage: '品质检（首件）', level: 'due', owner: '罗晓琳', action: '首件待判定，逾 24h 未判需升级品质经理' },
    { orderNo: 'SO-20260530-0066', customer: '苏州明泰自动化', productName: '导轨压板 MT-7601', dueDate: '2026-07-25', daysLeft: -6, stage: '原材料到料', level: 'late', owner: '罗晓琳', action: '45# 钢到料延迟，采购需给出到货承诺，同步改期已获客户口头同意，待书面确认' },
    { orderNo: 'SO-20260708-0092', customer: 'Brenner Maschinenbau GmbH', productName: '液压阀座 BR-2104', dueDate: '2026-08-06', daysLeft: 6, stage: '机加工（粗铣）', level: 'due', owner: '陈志强', action: '进度正常，提醒提前准备报关资料' },
  ],

  sampleCycle: [
    { month: '2026-02', samples: 6, converted: 3, rate: 0.5, avgDays: 42 },
    { month: '2026-03', samples: 8, converted: 3, rate: 0.375, avgDays: 51 },
    { month: '2026-04', samples: 7, converted: 4, rate: 0.571, avgDays: 38 },
    { month: '2026-05', samples: 9, converted: 3, rate: 0.333, avgDays: 63 },
    { month: '2026-06', samples: 6, converted: 2, rate: 0.333, avgDays: 47 },
    { month: '2026-07', samples: 5, converted: 1, rate: 0.2, avgDays: 29 },
  ],

  sampleCharge: [
    { mode: '收费样品', samples: 18, converted: 11, rate: 0.611, avgAmount: 2.4, note: '客户已付费，意向明确；转化周期平均 39 天' },
    { mode: '免费样品', samples: 23, converted: 5, rate: 0.217, avgAmount: 0, note: '转化率不足收费样品的 1/2，建议对新客户一律先收样品费' },
  ],

  samplePending: [
    { docNo: 'SP-20260118-0006', customer: '深圳兆丰医疗', productName: '内窥镜手柄壳体 ZF-8802', sampleAt: '2026-01-18', daysSince: 191, charged: false, lastFollow: '2026-04-02 客户称项目暂停', suggestion: '超 180 天未转化，建议关闭机会并回收样品成本' },
    { docNo: 'SP-20260226-0011', customer: 'Radex Instruments Inc.', productName: '探头支架（新版）RX-3390-C', sampleAt: '2026-02-26', daysSince: 152, charged: true, lastFollow: '2026-07-10 客户在做可靠性测试', suggestion: '有明确进展，8 月再跟进一次' },
    { docNo: 'SP-20260305-0014', customer: '东莞德信电子', productName: '屏蔽罩（薄壁）DX-4102', sampleAt: '2026-03-05', daysSince: 145, charged: false, lastFollow: '2026-05-20 无回复', suggestion: '连续 2 个月无回应，转入低优先级并停止免费打样' },
    { docNo: 'SP-20260420-0022', customer: '苏州明泰自动化', productName: '定位销座（改款）MT-7420-B', sampleAt: '2026-04-20', daysSince: 99, charged: true, lastFollow: '2026-07-18 等客户主机验证', suggestion: '正常跟进' },
  ],

  stockProgress: [
    { docNo: 'STK-20260706-0004', productName: '连接器底座', drawingNo: 'HS-4102-B', planQty: 2000, finishedQty: 1240, stockedQty: 1100, rate: 0.55, eta: '2026-08-12', status: '生产中' },
    { docNo: 'STK-20260618-0003', productName: '屏蔽罩', drawingNo: 'HS-3980-A', planQty: 8000, finishedQty: 8000, stockedQty: 8000, rate: 1, eta: '已完成', status: '已入库' },
    { docNo: 'STK-20260527-0002', productName: '光学镜筒', drawingNo: 'RX-4102', planQty: 480, finishedQty: 480, stockedQty: 480, rate: 1, eta: '已完成', status: '已入库' },
    { docNo: 'STK-20260412-0001', productName: '散热底板', drawingNo: 'DX-3311', planQty: 1500, finishedQty: 1500, stockedQty: 0, rate: 1, eta: '已完成', status: '已耗尽' },
  ],

  stockAging: [
    { bucket: '≤30 天', batches: 1, quantity: 1100, amount: 1.4, share: 0.237 },
    { bucket: '31～60 天', batches: 1, quantity: 4800, amount: 2.6, share: 0.441 },
    { bucket: '61～90 天', batches: 0, quantity: 0, amount: 0, share: 0 },
    { bucket: '＞90 天', batches: 1, quantity: 480, amount: 1.9, share: 0.322 },
  ],

  stockConsume: [
    { date: '2026-02-19', stockNo: 'STK-20260127-0009', orderNo: 'SO-20260219-0021', usedQty: 120, stockUnitCost: 40.2, produceQty: 380, produceUnitCost: 46.62, blendedUnitCost: 45.08, remaining: 0 },
    { date: '2026-05-08', stockNo: 'STK-20260412-0001', orderNo: 'SO-20260508-0052', usedQty: 900, stockUnitCost: 17.2, produceQty: 600, produceUnitCost: 18.4, blendedUnitCost: 17.68, remaining: 600 },
    { date: '2026-06-24', stockNo: 'STK-20260412-0001', orderNo: 'SO-20260624-0079', usedQty: 600, stockUnitCost: 17.2, produceQty: 400, produceUnitCost: 18.9, blendedUnitCost: 17.88, remaining: 0 },
    { date: '2026-07-15', stockNo: 'STK-20260618-0003', orderNo: 'SO-20260715-0095', usedQty: 3200, stockUnitCost: 5.42, produceQty: 0, produceUnitCost: 0, blendedUnitCost: 5.42, remaining: 4800 },
  ],

  stockIdle: [
    { stockNo: 'STK-20260527-0002', productName: '光学镜筒 RX-4102', remainingQty: 480, ageDays: 94, amount: 1.9, level: 'idle', suggestion: '客户新版图纸已发 ECN，旧版备料存在报废风险，需与客户确认是否消化' },
    { stockNo: 'STK-20260618-0003', productName: '屏蔽罩 HS-3980-A', remainingQty: 4800, ageDays: 43, amount: 2.6, level: 'watch', suggestion: '按客户滚动预测，9 月前可消化完，维持观察' },
  ],

  stockCapital: {
    totalAmount: 5.9,
    idleAmount: 1.9,
    turnoverDays: 58,
    note: '备料占用资金 = 已入库未领用数量 × 备料单件生产成本；呆滞（＞90 天）部分需在月度经营会说明处置方案。',
  },
}

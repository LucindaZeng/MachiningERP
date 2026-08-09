/**
 * 状态与枚举的显示字典：标签文案 + Element Plus 语义色。
 * 组件只负责渲染，文案集中在此，便于后续接后端字典或做多语言。
 */
export type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger'

export interface TagMeta {
  label: string
  type: TagType
}

export const DOC_STATUS: Record<string, TagMeta> = {
  draft: { label: '草稿', type: 'info' },
  submitted: { label: '已提交', type: 'primary' },
  reviewing: { label: '审核中', type: 'warning' },
  approved: { label: '已批准', type: 'success' },
  executing: { label: '执行中', type: 'primary' },
  completed: { label: '已完成', type: 'success' },
  closed: { label: '已关闭', type: 'info' },
  rejected: { label: '已驳回', type: 'danger' },
  void: { label: '已作废', type: 'info' },
}

export const SHIPMENT_STATUS: Record<string, TagMeta> = {
  planned: { label: '待出库', type: 'info' },
  picking: { label: '拣配中', type: 'primary' },
  packed: { label: '已包装', type: 'warning' },
  shipped: { label: '已发货', type: 'primary' },
  signed: { label: '已签收', type: 'success' },
  invoiced: { label: '已开票', type: 'success' },
  closed: { label: '已结案', type: 'info' },
}

export const RETURN_STATUS: Record<string, TagMeta> = {
  registered: { label: '已登记', type: 'info' },
  'quality-judging': { label: '品质判定中', type: 'warning' },
  disposition: { label: '处置审批中', type: 'warning' },
  executing: { label: '执行中', type: 'primary' },
  closed: { label: '已结案', type: 'success' },
  rejected: { label: '不成立', type: 'info' },
}

export const CUSTOMS_STATUS: Record<string, TagMeta> = {
  draft: { label: '草稿', type: 'info' },
  checking: { label: '关务复核中', type: 'warning' },
  generated: { label: '资料已生成', type: 'primary' },
  declared: { label: '已申报', type: 'success' },
  released: { label: '已放行', type: 'success' },
}

export const CUSTOMER_STATUS: Record<string, TagMeta> = {
  draft: { label: '草稿', type: 'info' },
  pending: { label: '待审批', type: 'warning' },
  active: { label: '已生效', type: 'success' },
  suspended: { label: '已停用', type: 'danger' },
}

export const ALERT_LEVEL: Record<string, TagMeta> = {
  info: { label: '提示', type: 'info' },
  due: { label: '临期', type: 'warning' },
  overdue: { label: '超期', type: 'danger' },
  severe: { label: '严重', type: 'danger' },
  blocking: { label: '阻断', type: 'danger' },
}

export const ORDER_TYPE: Record<string, TagMeta> = {
  mold: { label: '模具订单', type: 'warning' },
  sample: { label: '样品订单', type: 'info' },
  formal: { label: '正式业务订单', type: 'primary' },
  stock: { label: '备料订单', type: 'success' },
}

export const CHARGE_MODE: Record<string, string> = {
  charged: '收费',
  free: '免费',
  partial: '部分收费',
  deferred: '递延至正式订单分摊',
  deposit: '押金 / 达量返还',
  internal: '内部备料（不计客户应收）',
}

export const RESPONSIBILITY: Record<string, TagMeta> = {
  company: { label: '公司责任', type: 'danger' },
  customer: { label: '客户责任', type: 'info' },
  supplier: { label: '供应商责任', type: 'warning' },
  undecided: { label: '待判定', type: 'warning' },
}

export const DISPOSITION: Record<string, string> = {
  refund: '退款',
  replacement: '补货',
  rework: '返工重交',
  concession: '让步接收',
  scrap: '报废',
  undecided: '待定',
}

export const TAIL_PLAN: Record<string, string> = {
  rework: '返工补交',
  stock: '入库待后续订单',
  'direct-stock': '直接入库',
  scrap: '报废',
}

export function tagOf(dict: Record<string, TagMeta>, key: string): TagMeta {
  return dict[key] ?? { label: key, type: 'info' }
}

export const FRESHNESS: Record<string, TagMeta> = {
  realtime: { label: '实时', type: 'success' },
  delayed: { label: '延时 15 分', type: 'primary' },
  daily: { label: '日结价', type: 'info' },
  manual: { label: '人工审批价', type: 'warning' },
}

export const BOM_REQUEST_STATUS: Record<string, TagMeta> = {
  draft: { label: '草稿', type: 'info' },
  submitted: { label: '待工程领取', type: 'warning' },
  claimed: { label: '工程处理中', type: 'primary' },
  returned: { label: '已退回补充', type: 'danger' },
  'bom-done': { label: 'BOM 已完成', type: 'primary' },
  'all-done': { label: '可下单', type: 'success' },
  ordered: { label: '已下单', type: 'success' },
}

export const ECN_STATUS: Record<string, TagMeta> = {
  draft: { label: '草稿', type: 'info' },
  submitted: { label: '已提交', type: 'primary' },
  assessing: { label: '工程评估中', type: 'warning' },
  reviewing: { label: '会签中', type: 'warning' },
  approved: { label: '已批准', type: 'success' },
  executing: { label: '执行中', type: 'primary' },
  closed: { label: '已关闭', type: 'info' },
  rejected: { label: '已驳回', type: 'danger' },
}

/**
 * ECN 只受理「产品本身」的变更：改图、改材料、改表面处理，
 * 以及由此必须同步的工艺路线变更。
 * 数量 / 交期 / 价格等订单信息变更走「订单管理 → 订单修改申请」（ORC）。
 */
export const ECN_CHANGE_TYPE: Record<string, string> = {
  drawing: '图纸版本',
  material: '材料牌号',
  surface: '表面处理',
  process: '工艺 / 工序（随图纸同步）',
}

/**
 * 订单修改申请：只改订单信息，且**价格与下单产品不可修改**。
 * 需要改价 → 走「报价管理 → 报价单修改申请（QRC）」，由报价工程师改成本分析后重新报价；
 * 需要换产品 → 取消原单重下，或走 ECN 改产品定义。
 */
export const ORDER_CHANGE_TYPE: Record<string, string> = {
  quantity: '数量',
  delivery: '交期',
  shipTo: '收货信息',
  packing: '包装要求',
  cancel: '取消订单',
}

export const ORDER_CHANGE_STATUS: Record<string, TagMeta> = {
  draft: { label: '草稿', type: 'info' },
  submitted: { label: '待评估', type: 'warning' },
  reviewing: { label: '会签中', type: 'primary' },
  approved: { label: '已批准', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
  executing: { label: '执行中', type: 'primary' },
  completed: { label: '已生效', type: 'success' },
}

export const STATEMENT_STATUS: Record<string, TagMeta> = {
  draft: { label: '草稿', type: 'info' },
  sent: { label: '已发出待确认', type: 'primary' },
  confirmed: { label: '客户已确认', type: 'success' },
  disputed: { label: '有差异待处理', type: 'danger' },
  settled: { label: '已结清', type: 'success' },
}

/** 发票类型 */
export const INVOICE_TYPE: Record<string, string> = {
  special: '增值税专用发票',
  general: '增值税普通发票',
  export: '出口发票（零税率）',
  proforma: '形式发票 Proforma',
}

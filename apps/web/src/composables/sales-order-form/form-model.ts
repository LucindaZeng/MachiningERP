import type { ChargeMode, OrderLine, OrderType } from '@/types/sales.types'

export interface SalesOrderFormModel {
  customerCode: string
  orderType: OrderType
  chargeMode: ChargeMode
  productName: string
  drawingNo: string
  quantity: string
  originalUnitPrice: string
  currency: string
  taxRate: string
  deliveryDate: string
  quotationNo: string
  bomRequestNo: string
  itemCode: string
  customerPoNo: string
  costOwner: string
  freeReason: string
  estimatedCost: string
  /** 关联的备料订单单号（正式订单可领用备料） */
  stockOrderNo: string
  /** 新投产部分的单件生产成本 */
  produceUnitCost: string
  /** 客户订单原件附件名（模具 / 正式订单强制；样品订单有价格时强制） */
  poFile: string
  /** 上传得到的对象键；建单请求以此写入 customerPoFile */
  poFileKey: string
  /** 一张单多项产品的明细行 */
  lines: OrderLine[]
}

/** 明细行空模板：金额先给 0.00，避免表格首次渲染出现空列宽跳动 */
export function createEmptyLine(seq: number): OrderLine {
  return {
    seq,
    productName: '',
    drawingNo: '',
    itemCode: '',
    quantity: '',
    unitPrice: '',
    amount: '0.00',
    deliveryDate: '',
  }
}

/**
 * 建单默认值：默认按正式订单 + 收费起手，因为这是占比最高且规则最严的一类，
 * 先按最严口径初始化，切到其它类型时再由 applyOrderTypeDefaults 放宽。
 */
export function createEmptyForm(): SalesOrderFormModel {
  return {
    customerCode: '',
    orderType: 'formal',
    chargeMode: 'charged',
    productName: '',
    drawingNo: '',
    quantity: '',
    originalUnitPrice: '',
    currency: 'CNY',
    taxRate: '0.13',
    deliveryDate: '',
    quotationNo: '',
    bomRequestNo: '',
    itemCode: '',
    customerPoNo: '',
    costOwner: '',
    freeReason: '',
    estimatedCost: '',
    stockOrderNo: '',
    produceUnitCost: '',
    poFile: '',
    poFileKey: '',
    lines: [createEmptyLine(1)],
  }
}

/**
 * 切换订单类型时的强制联动：
 * 正式订单不允许免费或零价绕过（ORD_2003 / ORD_2004），收费方式锁死为收费；
 * 备料订单无客户应收，价格清零，并断开上一次选中的备料单（备料订单自己不能再领用备料）。
 */
export function applyOrderTypeDefaults(form: SalesOrderFormModel, value: OrderType): void {
  form.orderType = value
  if (value === 'formal') {
    form.chargeMode = 'charged'
  } else if (value === 'stock') {
    form.chargeMode = 'internal'
    form.originalUnitPrice = '0'
    form.stockOrderNo = ''
  }
}

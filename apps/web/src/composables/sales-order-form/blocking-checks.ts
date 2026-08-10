import type { SalesOrderFormModel } from './form-model'
import type { OrderLine } from '@/types/sales.types'

export interface BlockingCheck {
  label: string
  passed: boolean
  hint: string
}

/**
 * 阻断清单的输入快照：全部是已求值的普通值。
 * 刻意不接收 ref —— 规则本身是纯判断，脱离 Vue 也能单测，界面只负责把当下的值喂进来。
 */
export interface BlockingCheckContext {
  form: SalesOrderFormModel
  isFormal: boolean
  isStock: boolean
  isSample: boolean
  needFreeFields: boolean
  needPoFile: boolean
  engineeringGaps: string[]
  /** 领用备料时加权成本是否已试算出来 */
  stockUsageReady: boolean
}

/** 提交前的阻断清单：界面上逐条可见，未全绿不允许提交。顺序即界面展示顺序。 */
export function buildBlockingChecks(ctx: BlockingCheckContext): BlockingCheck[] {
  return [...documentChecks(ctx), ...priceChecks(ctx), itemCodeCheck(ctx), ...stockChecks(ctx)]
}

/** 单据要素：明细、工程资料、交期、客户订单原件 */
function documentChecks(ctx: BlockingCheckContext): BlockingCheck[] {
  const { form, engineeringGaps } = ctx
  return [
    {
      label: '产品明细至少一行且数量、单价完整',
      passed: form.lines.every((line) => isLineComplete(line, ctx)),
      hint: '一张订单可下多项产品；每一行必须有产品名称、图号与数量，正式订单还必须有非零单价',
    },
    {
      label: '工程资料齐套（报价 / 成本分析 / 品号 / BOM / 图纸）',
      passed: engineeringGaps.length === 0,
      hint:
        engineeringGaps.length === 0
          ? '该产品的报价单、成本分析、品号、BOM 与图纸均已齐套，可以下单'
          : `缺少：${engineeringGaps.join('、')}。缺任一项一律不能下单，请先补齐后再提交。`,
    },
    {
      label: '客户交期已填写',
      passed: Boolean(form.deliveryDate),
      hint: '客户交期为必填项，交期直接决定 PMC 排产与在手订单预警',
    },
    {
      label: ctx.needPoFile ? '客户订单原件已上传' : '本类型无需上传客户订单原件',
      // 认对象键而不是文件名——只有真上传成功才算数
      passed: !ctx.needPoFile || Boolean(form.poFileKey),
      hint: '模具订单与正式业务订单必须上传客户订单原件；样品订单只要收费也必须上传，免费样品可豁免',
    },
  ]
}

/** 明细行完整性：备料订单与非正式订单不强制单价 */
function isLineComplete(line: OrderLine, ctx: BlockingCheckContext): boolean {
  return Boolean(
    line.productName.trim() &&
    line.drawingNo.trim() &&
    Number(line.quantity || '0') > 0 &&
    (ctx.isStock || Number(line.unitPrice || '0') > 0 || !ctx.isFormal),
  )
}

/** 价格与收费要素：客户 PO、报价、非零价、免费四要素 */
function priceChecks(ctx: BlockingCheckContext): BlockingCheck[] {
  const { form, isFormal } = ctx
  return [
    {
      label: '关联客户原始订单',
      passed: !isFormal || Boolean(form.customerPoNo.trim()),
      hint: '正式业务订单必须上传或关联客户 PO，缺失时财务审核会立即阻断退回',
    },
    {
      label: '关联已确认报价 / 核价',
      passed: !isFormal || Boolean(form.quotationNo.trim()),
      hint: '订单与报价差异超阈值需强制说明并重新核价',
    },
    {
      label: '正式订单强制收费且价格非零',
      passed: !isFormal || (form.chargeMode === 'charged' && Number(form.originalUnitPrice) > 0),
      hint: '正式业务订单不允许免费或零价绕过（ORD_2003 / ORD_2004）',
    },
    {
      label: '免费 / 部分收费四项要素完整',
      passed:
        !ctx.needFreeFields || Boolean(form.costOwner && form.estimatedCost && form.freeReason),
      hint: '模具 / 样品免费或部分收费必须填费用承担方、预计成本、原因并完成审批',
    },
  ]
}

/** 品号口径按订单类型分三种：样品免、备料引用既有、正式与模具必须新建 */
function itemCodeCheck(ctx: BlockingCheckContext): BlockingCheck {
  const { form, isFormal } = ctx
  if (ctx.isSample) {
    return {
      label: '样品订单免品号、免 BOM',
      passed: true,
      hint: '品号只发给正式订单的产品；样品按客户来图编制临时工艺路线试做，全程以「图号 + 样品单号」标识，转量产时才建品号与 BOM',
    }
  }
  if (ctx.isStock) {
    return {
      label: '引用已量产产品的既有品号',
      passed: Boolean(form.itemCode.trim()),
      hint: '备料订单不新建品号，必须引用该图号已量产的品号；无品号说明该产品尚未正式量产，不允许备料',
    }
  }
  return {
    label: isFormal ? '品号与 BOM 已确认可下单' : '模具编号已建立',
    passed: Boolean(form.itemCode.trim()) && (!isFormal || Boolean(form.bomRequestNo.trim())),
    hint: isFormal
      ? '正式订单必须有工程建立的品号，并关联回传「BOM 可下单」的申请单号；程序可开工是另一状态，不可合并判定'
      : '模具订单建的是模具编号而不是品号，由 BOM 申请（模具用途）回传',
  }
}

/** 备料相关的条件项：只在备料订单或已选备料单时才出现在清单里 */
function stockChecks(ctx: BlockingCheckContext): BlockingCheck[] {
  const { form } = ctx
  const checks: BlockingCheck[] = []
  if (ctx.isStock) {
    checks.push({
      label: '备料订单预计成本与备料原因',
      passed: Boolean(form.estimatedCost && form.freeReason),
      hint: '备料订单无客户应收，必须填写预计成本与备料原因供财务审核占用资金',
    })
  }
  if (form.stockOrderNo) {
    checks.push({
      label: '备料领用与加权成本已试算',
      passed: ctx.stockUsageReady,
      hint: '领用备料时必须录入新投产部分的单件成本，系统按加权平均计入订单成本',
    })
  }
  return checks
}

import type { SalesOrderFormModel } from './form-model'

/**
 * 工程资料齐套检查：缺任一项一律不允许下单。
 * 样品订单直接豁免——样品按客户来图编制临时工艺路线试做，本来就没有报价、品号与 BOM。
 */
export function collectEngineeringGaps(form: SalesOrderFormModel): string[] {
  const gaps: string[] = []
  if (form.orderType === 'sample') {
    return gaps
  }
  if (!form.quotationNo.trim()) {
    gaps.push('已确认报价单')
  }
  if (!form.quotationNo.trim() || !form.itemCode.trim()) {
    gaps.push('对应的成本分析（核价单）')
  }
  if (!form.itemCode.trim()) {
    gaps.push(form.orderType === 'mold' ? '模具编号' : '品号')
  }
  if (form.orderType === 'formal' && !form.bomRequestNo.trim()) {
    gaps.push('BOM 可下单确认')
  }
  if (form.orderType === 'formal' && !form.drawingNo.trim()) {
    gaps.push('图纸与图号')
  }
  return gaps
}

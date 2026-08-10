/** 尾数处理回执，形状与前端 `submitTailPlan` 的返回一致，另带结清数量便于核对。 */
export interface TailPlanResultView {
  docNo: string
  plan: string
  resolvedQty: string
  resolvedLines: number
}

/**
 * 工单进度条的口径：圈内显示「完成数 / 工单数」。
 * 工单数 = 该环节的投入数（未投入时取订单数量）；完成数 = 该环节的合格数。
 * 只有在环节自身没有数量记录时，才用 progress 百分比 × 工单数折算，保证界面永远给出件数而不是百分比。
 */
import type { TrackStage } from '@/types/sales.types'

export interface StageCount {
  done: number
  total: number
}

export function stageCounts(stage: TrackStage, orderQty: string): StageCount {
  const total = Number(stage.qtyIn ?? orderQty ?? '0') || 0

  if (stage.status === 'pending') {
    return { done: 0, total }
  }
  if (stage.status === 'done') {
    return { done: Number(stage.qtyOk ?? stage.qtyIn ?? orderQty ?? '0') || total, total }
  }

  const ok = Number(stage.qtyOk ?? '0')
  if (ok > 0) {
    return { done: ok, total }
  }
  const ratio = (stage.progress ?? 50) / 100
  return { done: Math.round(total * ratio), total }
}

/** 整单完成度：已完成环节 + 当前环节的完成比例，用于行尾的汇总 */
export function stageRatio(count: StageCount): number {
  return count.total ? count.done / count.total : 0
}

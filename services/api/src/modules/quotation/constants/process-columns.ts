/**
 * 工艺成本列。列可自由加减，顺序即展示顺序（业务规格 2.3）。
 *
 * 放在 constants/ 而不是 services/ 或 repositories/：它同时是
 * 计算引擎的入参形状和 cost_analyses.process_columns 的落库形状，
 * 两层都要用，放任一层都会造成反向依赖。
 */
export interface ProcessColumn {
  key: string
  label: string
}

/** 默认工艺列，取自 example/成本分析/CNC成本分析.xls 的表头。 */
export const DEFAULT_PROCESS_COLUMNS: readonly ProcessColumn[] = [
  { key: 'deburring', label: '打磨去毛刺' },
  { key: 'polishing', label: '抛光' },
  { key: 'surfaceTreatment', label: '表面处理' },
  { key: 'markingPrinting', label: '镭雕丝印' },
  { key: 'assembly', label: '组合安装销钉' },
  { key: 'inspectionPacking', label: '全检包装运输' },
]

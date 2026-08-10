/**
 * 标准订单追踪链（业务规格 4.7）。
 *
 * > 订单评审 → PMC跑生产计划 → 采购计划 → 到料 → 原材料品质检(IQC) → 切料 → 调机
 * > → 首件检测 → 车床 → 品质检 → CNC → 品质检 → 打磨 → 品质检 → 仓库(交接)
 * > → 委外表处 → 仓库(回料) → 品质检 → 镭雕丝印 → 品质检 → 包装 → 出货报告 → 入库
 *
 * **追踪起点是订单评审**，不是下单。
 *
 * 节点分三类，决定「按产品工艺路线自动裁剪」时谁去谁留：
 *
 * - `fixed`：与工艺无关的固定节点（订单评审、PMC 计划、采购、到料、IQC、出货报告、入库），永远保留；
 * - `processCodes`：绑定工艺基础表编号，产品工艺路线里出现任一编号才保留；
 * - `follows`：检验节点，跟随它前面那个工艺节点的去留——前道工艺被裁掉，它对应的品质检也不该留下。
 *
 * 部门名取自 example/基础资料工艺车间仓库ByCoder.xls 的部门清单，不自造名称。
 */
export interface TrackingRouteNode {
  key: string
  node: string
  /** 所属阶段，前端进度条按此分组 */
  phase: string
  department: string
  /** 命中其中任一工艺编号即保留该节点 */
  processCodes?: readonly string[]
  /** 检验节点跟随的工艺节点 key */
  follows?: string
}

const PHASE = {
  PLAN: '计划与采购',
  INCOMING: '来料与检验',
  MACHINING: '机加工',
  POST: '后处理与委外',
  DELIVERY: '交付入库',
} as const

/** 委外表处类工艺编号（工艺性质=2:委外 且生产单位=委外表处） */
export const SURFACE_TREATMENT_CODES = [
  '21', '22', '23', '24', '25', '26', '38', '42', '43', '44', '45', '46', '47',
  '53', '58', '60', '61', '62', '64', '68', '69', '70', '72',
] as const

export const STANDARD_TRACKING_ROUTE: readonly TrackingRouteNode[] = [
  { key: 'order-review', node: '订单评审', phase: PHASE.PLAN, department: '业务部' },
  { key: 'pmc-plan', node: 'PMC跑生产计划', phase: PHASE.PLAN, department: '企划课' },
  { key: 'purchase-plan', node: '采购计划', phase: PHASE.PLAN, department: '采购课' },
  { key: 'material-arrival', node: '到料', phase: PHASE.INCOMING, department: '仓库' },
  { key: 'iqc', node: '原材料品质检(IQC)', phase: PHASE.INCOMING, department: '品质部' },

  { key: 'cutting', node: '切料', phase: PHASE.MACHINING, department: '仓库', processCodes: ['12'] },
  { key: 'setup', node: '调机', phase: PHASE.MACHINING, department: '生产一部', processCodes: ['10', '11'] },
  { key: 'fai', node: '首件检测', phase: PHASE.MACHINING, department: '品质部', follows: 'setup' },
  { key: 'lathe', node: '车床', phase: PHASE.MACHINING, department: '车床部', processCodes: ['11'] },
  { key: 'lathe-qc', node: '品质检', phase: PHASE.MACHINING, department: '品质部', follows: 'lathe' },
  { key: 'cnc', node: 'CNC', phase: PHASE.MACHINING, department: '生产一部', processCodes: ['10'] },
  { key: 'cnc-qc', node: '品质检', phase: PHASE.MACHINING, department: '品质部', follows: 'cnc' },

  {
    key: 'deburring',
    node: '打磨',
    phase: PHASE.POST,
    department: '后工序',
    // 去毛刺 14 / 振磨 15 / 抛光 52 / 研磨 63 都归到「打磨」这一节点
    processCodes: ['14', '15', '52', '63'],
  },
  { key: 'deburring-qc', node: '品质检', phase: PHASE.POST, department: '品质部', follows: 'deburring' },
  {
    key: 'handover-out',
    node: '仓库(交接)',
    phase: PHASE.POST,
    department: '仓库',
    processCodes: SURFACE_TREATMENT_CODES,
  },
  {
    key: 'surface-treatment',
    node: '委外表处',
    phase: PHASE.POST,
    department: '外协课',
    processCodes: SURFACE_TREATMENT_CODES,
  },
  {
    key: 'handover-in',
    node: '仓库(回料)',
    phase: PHASE.POST,
    department: '仓库',
    follows: 'surface-treatment',
  },
  {
    key: 'surface-qc',
    node: '品质检',
    phase: PHASE.POST,
    department: '品质部',
    follows: 'surface-treatment',
  },
  {
    key: 'marking',
    node: '镭雕丝印',
    phase: PHASE.POST,
    department: '后工序',
    processCodes: ['17', '19'],
  },
  { key: 'marking-qc', node: '品质检', phase: PHASE.POST, department: '品质部', follows: 'marking' },
  { key: 'packing', node: '包装', phase: PHASE.DELIVERY, department: '后工序', processCodes: ['16'] },

  { key: 'shipment-report', node: '出货报告', phase: PHASE.DELIVERY, department: '业务部' },
  { key: 'stock-in', node: '入库', phase: PHASE.DELIVERY, department: '仓库' },
]

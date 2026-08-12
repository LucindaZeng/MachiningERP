/**
 * 面板数据可用性标记。
 *
 * **这是本模块最要紧的一条约定：「无数据」与「测得为零」必须分得开。**
 *
 * 报表里大量指标是比率、均值与排名。一个尚未上线的模块如果被填成 0，
 * 界面上呈现出来的是「报废率 0%」「偏差 0 元」——那读起来是**优异的经营表现**，
 * 而不是「这块还没接上」。管理层照着这种数字做决策，比看不到数字糟得多。
 *
 * 因此约定：
 * - 数据来源尚未上线的面板，**行集为空**（`[]`），绝不零填；
 * - 报表容器上带一张 `pending` 表，键是那个空数组的字段名，值是中文说明；
 * - 真实来源接上之后，provider 一换，键自然消失，聚合逻辑一行不动。
 *
 * 为什么标记挂在容器上而不是数组上：线上契约里的数组就是数组，
 * 往数组对象上挂属性过不了 JSON，也过不了类型。
 */
export interface PanelAvailability {
  /**
   * 面板键 → 未上线说明。键取本报表里那个**数组字段的名字**（如 `elementVariance`）。
   * 键存在 ⇒ 该面板的空行集是「没有数据」，不是「统计结果为零」。
   */
  pending?: Record<string, string>
}

/** 尚未上线的上游模块，与四个读端口一一对应。文案直接面向用户，故为中文。 */
export const PENDING_SOURCES = {
  COSTING: '成本模块未上线，实际成本与偏差暂无数据',
  FINANCE: '财务模块未上线，回款与应收账龄暂无数据',
  WMS: '仓储模块未上线，备料库存与呆滞暂无数据',
  MES: '制造执行模块未上线，工序与材质工艺分析暂无数据',
} as const

export type PendingSource = (typeof PENDING_SOURCES)[keyof typeof PENDING_SOURCES]

/**
 * 把若干面板标成「数据源未上线」。
 *
 * 只登记**行集确实为空**的面板：真有数据却标着未上线，是另一种形式的说谎。
 * 因此本函数要求调用方把行集一并传进来自证。
 */
export function markPending(
  entries: ReadonlyArray<{ key: string; rows: readonly unknown[]; source: PendingSource }>,
): Record<string, string> | undefined {
  const pending: Record<string, string> = {}
  for (const entry of entries) {
    if (entry.rows.length === 0) pending[entry.key] = entry.source
  }
  return Object.keys(pending).length > 0 ? pending : undefined
}

/** 某个面板是否处于「数据源未上线」状态——前端空状态与测试都读这一个判断。 */
export function isPanelPending(availability: PanelAvailability | null | undefined, key: string): boolean {
  return typeof availability?.pending?.[key] === 'string'
}

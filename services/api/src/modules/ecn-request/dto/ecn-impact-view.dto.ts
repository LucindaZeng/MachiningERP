/** 一条影响评估的对外形状。金额为 '—' 表示评不出钱，与 '0.00' 含义不同。 */
export interface EcnImpactView {
  scope: string
  quantity: string
  amount: string
  note: string
}

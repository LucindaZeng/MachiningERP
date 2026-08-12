/**
 * 影响评估的提交形状。
 *
 * 单独一个文件而不是写在 dialog 的 `<script setup>` 里：
 * `<script setup>` 不能 export 类型，而页面那一侧要用同一个形状把它转发给接口。
 */
export interface AssessPayload {
  impacts: Array<{ scope: string; quantity: string; amountMinor: string | null; note: string }>
  routingUpdated: boolean
  /** 中途改工序的生效批次版本 */
  effectiveBatch: string | null
  needRequote: boolean
  needOrderReapproval: boolean
}

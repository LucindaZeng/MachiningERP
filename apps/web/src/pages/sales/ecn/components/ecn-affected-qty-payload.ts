/**
 * PMC 清点结果的提交形状。
 *
 * 与 ecn-assess-payload 同一个理由单独成文件：`<script setup>` 不能 export 类型，
 * 而页面那一侧要用同一个形状把它转发给接口。
 */
export interface AffectedQtyPayload {
  /** 整表提交：这一次录入即为清点的全部结果，服务端整表替换。 */
  lines: Array<{
    productName: string
    drawingNo: string
    /** 定点字符串，非负——数量口径全系统一致，不用 number */
    affectedQty: string
    note: string | null
  }>
}

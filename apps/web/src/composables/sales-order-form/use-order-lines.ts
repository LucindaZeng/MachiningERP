import { computed, watch } from 'vue'

import { createEmptyLine } from './form-model'
import { lineAmount, sumLineAmount, sumLineQty } from './order-pricing'

import type { SalesOrderFormModel } from './form-model'
import type { ComputedRef } from 'vue'

/** 一张单多项产品：明细行的增删、合计与主字段联动 */
export function useOrderLines(form: SalesOrderFormModel) {
  /** 明细行合计：数量与金额 */
  const totalQty = computed(() => sumLineQty(form.lines))
  const totalAmount = computed(() => sumLineAmount(form.lines))

  function addLine(): void {
    form.lines.push(createEmptyLine(form.lines.length + 1))
  }

  function removeLine(index: number): void {
    if (form.lines.length <= 1) {
      return
    }
    form.lines.splice(index, 1)
    form.lines.forEach((line, seq) => {
      line.seq = seq + 1
    })
  }

  watchFirstLineSync(form, totalQty)
  watchDeliveryDate(form)

  return { totalQty, totalAmount, addLine, removeLine }
}

/** 第一项产品同步到订单主字段：HK 试算、备料领用与校验沿用主字段口径 */
function watchFirstLineSync(form: SalesOrderFormModel, totalQty: ComputedRef<number>): void {
  watch(
    () => form.lines.map(lineFingerprint).join(),
    () => {
      const first = form.lines[0]
      form.productName = first.productName
      form.drawingNo = first.drawingNo
      form.itemCode = first.itemCode ?? ''
      form.quantity = String(totalQty.value || '')
      form.originalUnitPrice = first.unitPrice
      form.lines.forEach((line) => {
        line.amount = lineAmount(line)
      })
    },
  )
}

/** 把明细行压成字符串做 watch 源：数组内元素改动不会触发浅层 watch，靠指纹兜住 */
function lineFingerprint(line: SalesOrderFormModel['lines'][number]): string {
  return `${line.productName}|${line.drawingNo}|${line.itemCode}|${line.quantity}|${line.unitPrice}`
}

/** 交期：订单级交期回填到未单独指定交期的明细行 */
function watchDeliveryDate(form: SalesOrderFormModel): void {
  watch(
    () => form.deliveryDate,
    (value) => {
      form.lines.forEach((line) => {
        if (!line.deliveryDate) {
          line.deliveryDate = value
        }
      })
    },
  )
}

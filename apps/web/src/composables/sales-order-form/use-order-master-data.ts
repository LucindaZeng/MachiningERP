import { computed, onMounted, ref } from 'vue'

import { fetchCustomers } from '@/api/sales/customer.api'
import { fetchStockOrders } from '@/api/sales/stock-order.api'

import type { SalesOrderFormModel } from './form-model'
import type { Customer, StockOrder } from '@/types/sales.types'

/** 建单页的基础档案：客户与可领用的备料订单 */
export function useOrderMasterData(form: SalesOrderFormModel) {
  const customers = ref<Customer[]>([])
  const stockOrders = ref<StockOrder[]>([])

  const selectedCustomer = computed(() =>
    customers.value.find((item) => item.code === form.customerCode),
  )

  /** 同图号且仍有余量的备料订单 */
  const availableStock = computed(() =>
    stockOrders.value.filter((item) => isUsableStock(item, form.drawingNo)),
  )

  const selectedStock = computed(() =>
    stockOrders.value.find((item) => item.docNo === form.stockOrderNo),
  )

  onMounted(async () => {
    customers.value = await fetchCustomers()
    stockOrders.value = await fetchStockOrders()
  })

  return { customers, stockOrders, selectedCustomer, availableStock, selectedStock }
}

/** 只有已完工入库且仍有余量的备料单能被领用；图号为空时不过滤，方便先挑备料再回填图号 */
function isUsableStock(stock: StockOrder, drawingNo: string): boolean {
  return (
    stock.status === 'stocked' &&
    Number(stock.remainingQty) > 0 &&
    (!drawingNo || stock.drawingNo === drawingNo)
  )
}

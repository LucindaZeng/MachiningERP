/**
 * 类型已迁到 `@machining-erp/shared`（development-guide §1：packages/shared 承载前后端共享契约）。
 * 本文件只保留 **mock 数据**——真实接口未接通时的回落数据源，形状由 shared 保证与后端一致。
 */
import type {
  DailyOpsReport,
} from '@machining-erp/shared'


/**
 * 每日经营量：接单 / 出货 / 未完成订单。
 * 口径：
 * - 接单量 = 当日业务经理审核通过（ORD-02）的订单，按张数、件数与合同金额统计；备料订单件数计入、金额按预计生产成本计；
 * - 出货量 = 当日实际发货（SHP-04 出货）的发货单，按张数、件数与出货金额统计；
 * - 未完成订单 = 截至当日日终，已评审通过但尚未全部出货的订单存量（张数与未交件数），是存量指标而非当日发生额。
 */

/** 近 30 天（2026-06-29 ~ 2026-07-28） */
export const DAILY_OPS: DailyOpsReport = {
  caliber:
    '接单按 ORD-02 审核通过日归集，出货按实际发货日归集，未完成订单为当日日终存量（已评审未出清）。周日不排产，接单与出货为 0 属正常。',
  updatedAt: '2026-07-28 23:59',
  rows: [
    { date: '2026-06-29', receivedOrders: 4, receivedQty: 6200, receivedAmount: 48.6, shippedOrders: 3, shippedQty: 4800, shippedAmount: 36.2, openOrders: 92, openQty: 168400, openAmount: 1186.4 },
    { date: '2026-06-30', receivedOrders: 6, receivedQty: 9400, receivedAmount: 71.2, shippedOrders: 5, shippedQty: 7600, shippedAmount: 58.4, openOrders: 93, openQty: 170200, openAmount: 1199.2 },
    { date: '2026-07-01', receivedOrders: 5, receivedQty: 7800, receivedAmount: 62.4, shippedOrders: 4, shippedQty: 6100, shippedAmount: 47.6, openOrders: 94, openQty: 171900, openAmount: 1214.0 },
    { date: '2026-07-02', receivedOrders: 3, receivedQty: 4600, receivedAmount: 34.8, shippedOrders: 6, shippedQty: 9200, shippedAmount: 70.1, openOrders: 91, openQty: 167300, openAmount: 1178.7 },
    { date: '2026-07-03', receivedOrders: 7, receivedQty: 11200, receivedAmount: 86.4, shippedOrders: 4, shippedQty: 6400, shippedAmount: 49.2, openOrders: 94, openQty: 172100, openAmount: 1215.9 },
    { date: '2026-07-04', receivedOrders: 2, receivedQty: 3100, receivedAmount: 23.6, shippedOrders: 3, shippedQty: 4500, shippedAmount: 34.4, openOrders: 93, openQty: 170700, openAmount: 1205.1 },
    { date: '2026-07-05', receivedOrders: 0, receivedQty: 0, receivedAmount: 0, shippedOrders: 0, shippedQty: 0, shippedAmount: 0, openOrders: 93, openQty: 170700, openAmount: 1205.1 },
    { date: '2026-07-06', receivedOrders: 6, receivedQty: 9800, receivedAmount: 74.6, shippedOrders: 5, shippedQty: 7900, shippedAmount: 60.8, openOrders: 94, openQty: 172600, openAmount: 1218.9 },
    { date: '2026-07-07', receivedOrders: 4, receivedQty: 6400, receivedAmount: 49.8, shippedOrders: 6, shippedQty: 9600, shippedAmount: 73.4, openOrders: 92, openQty: 169400, openAmount: 1195.3 },
    { date: '2026-07-08', receivedOrders: 5, receivedQty: 8200, receivedAmount: 63.2, shippedOrders: 4, shippedQty: 6200, shippedAmount: 48.1, openOrders: 93, openQty: 171400, openAmount: 1210.4 },
    { date: '2026-07-09', receivedOrders: 8, receivedQty: 13400, receivedAmount: 102.6, shippedOrders: 5, shippedQty: 8100, shippedAmount: 62.3, openOrders: 96, openQty: 176700, openAmount: 1250.7 },
    { date: '2026-07-10', receivedOrders: 6, receivedQty: 9600, receivedAmount: 73.8, shippedOrders: 7, shippedQty: 11400, shippedAmount: 87.2, openOrders: 95, openQty: 174900, openAmount: 1237.3 },
    { date: '2026-07-11', receivedOrders: 3, receivedQty: 4800, receivedAmount: 36.4, shippedOrders: 4, shippedQty: 6300, shippedAmount: 48.6, openOrders: 94, openQty: 173400, openAmount: 1225.1 },
    { date: '2026-07-12', receivedOrders: 0, receivedQty: 0, receivedAmount: 0, shippedOrders: 0, shippedQty: 0, shippedAmount: 0, openOrders: 94, openQty: 173400, openAmount: 1225.1 },
    { date: '2026-07-13', receivedOrders: 7, receivedQty: 11600, receivedAmount: 88.9, shippedOrders: 5, shippedQty: 8000, shippedAmount: 61.4, openOrders: 96, openQty: 177000, openAmount: 1252.6 },
    { date: '2026-07-14', receivedOrders: 5, receivedQty: 7900, receivedAmount: 60.2, shippedOrders: 6, shippedQty: 9800, shippedAmount: 75.1, openOrders: 95, openQty: 175100, openAmount: 1237.7 },
    { date: '2026-07-15', receivedOrders: 6, receivedQty: 10200, receivedAmount: 78.4, shippedOrders: 8, shippedQty: 13200, shippedAmount: 101.2, openOrders: 93, openQty: 172100, openAmount: 1214.9 },
    { date: '2026-07-16', receivedOrders: 4, receivedQty: 6600, receivedAmount: 50.8, shippedOrders: 5, shippedQty: 8200, shippedAmount: 63.0, openOrders: 92, openQty: 170500, openAmount: 1202.7 },
    { date: '2026-07-17', receivedOrders: 9, receivedQty: 15100, receivedAmount: 115.6, shippedOrders: 4, shippedQty: 6500, shippedAmount: 50.2, openOrders: 97, openQty: 179100, openAmount: 1268.1 },
    { date: '2026-07-18', receivedOrders: 3, receivedQty: 5000, receivedAmount: 38.2, shippedOrders: 6, shippedQty: 9400, shippedAmount: 72.4, openOrders: 94, openQty: 174700, openAmount: 1233.9 },
    { date: '2026-07-19', receivedOrders: 0, receivedQty: 0, receivedAmount: 0, shippedOrders: 0, shippedQty: 0, shippedAmount: 0, openOrders: 94, openQty: 174700, openAmount: 1233.9 },
    { date: '2026-07-20', receivedOrders: 8, receivedQty: 12800, receivedAmount: 98.2, shippedOrders: 5, shippedQty: 8100, shippedAmount: 62.4, openOrders: 97, openQty: 179400, openAmount: 1269.7 },
    { date: '2026-07-21', receivedOrders: 5, receivedQty: 8400, receivedAmount: 64.6, shippedOrders: 7, shippedQty: 11600, shippedAmount: 89.1, openOrders: 95, openQty: 176200, openAmount: 1245.2 },
    { date: '2026-07-22', receivedOrders: 6, receivedQty: 9900, receivedAmount: 76.1, shippedOrders: 6, shippedQty: 9700, shippedAmount: 74.6, openOrders: 95, openQty: 176400, openAmount: 1246.7 },
    { date: '2026-07-23', receivedOrders: 4, receivedQty: 6800, receivedAmount: 52.3, shippedOrders: 8, shippedQty: 13400, shippedAmount: 103.0, openOrders: 91, openQty: 169800, openAmount: 1196.0 },
    { date: '2026-07-24', receivedOrders: 7, receivedQty: 11400, receivedAmount: 87.6, shippedOrders: 5, shippedQty: 8300, shippedAmount: 63.8, openOrders: 93, openQty: 172900, openAmount: 1219.8 },
    { date: '2026-07-25', receivedOrders: 5, receivedQty: 8600, receivedAmount: 66.2, shippedOrders: 6, shippedQty: 9900, shippedAmount: 76.2, openOrders: 92, openQty: 171600, openAmount: 1209.8 },
    { date: '2026-07-26', receivedOrders: 3, receivedQty: 5200, receivedAmount: 39.8, shippedOrders: 4, shippedQty: 6700, shippedAmount: 51.6, openOrders: 91, openQty: 170100, openAmount: 1198.0 },
    { date: '2026-07-27', receivedOrders: 0, receivedQty: 0, receivedAmount: 0, shippedOrders: 0, shippedQty: 0, shippedAmount: 0, openOrders: 91, openQty: 170100, openAmount: 1198.0 },
    { date: '2026-07-28', receivedOrders: 9, receivedQty: 14600, receivedAmount: 112.4, shippedOrders: 6, shippedQty: 9800, shippedAmount: 75.4, openOrders: 94, openQty: 174900, openAmount: 1235.0 },
  ],
}

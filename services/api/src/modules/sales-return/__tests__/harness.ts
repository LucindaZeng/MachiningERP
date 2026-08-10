import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { DomainEventPublisher } from '../../../platform/events'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { ReturnContextService } from '../services/return-context.service'
import { ReturnFlowService } from '../services/return-flow.service'
import { ReturnReadService } from '../services/return-read.service'
import { SalesReturnService } from '../services/sales-return.service'

import { FakeReturnSettlementPort, FakeSalesReturnRepository } from './fakes'

import type { ShippedLineFacts } from '../services/return-context.service'
import type { ReturnActor } from '../services/sales-return.service'

export const SALES: ReturnActor = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.SALES_OPERATE],
}
export const QUALITY: ReturnActor = {
  userCode: 'WFX-2019-0088',
  permissions: [PERMISSION_CODES.QUALITY_RMA_JUDGE],
}
export const FINANCE: ReturnActor = {
  userCode: 'WFX-2017-0011',
  permissions: [PERMISSION_CODES.ORDER_FINANCE_REVIEW],
}
export const OUTSIDER: ReturnActor = { userCode: 'WFX-2019-0200', permissions: [] }

/** fixture RT1 的两行：本厂平面度超差 + 疑似委外镀锌不良——正是「一单两责任」的原型。 */
export const SHIPPED_LINES: ShippedLineFacts[] = [
  {
    shipmentLineId: 'SL1',
    orderLineId: 'OL1',
    productName: '导轨压板',
    drawingNo: 'MT-7601',
    batchNo: 'B26070901',
    shippedQty: '1200.000000',
    unitPriceMinor: 3_980n,
  },
  {
    shipmentLineId: 'SL2',
    orderLineId: 'OL2',
    productName: '定位销座',
    drawingNo: 'MT-7420',
    batchNo: 'B26070902',
    shippedQty: '300.000000',
    unitPriceMinor: 2_160n,
  },
]

let docSeq = 0

export interface Harness {
  returns: SalesReturnService
  flow: ReturnFlowService
  reads: ReturnReadService
  repo: FakeSalesReturnRepository
  settlement: FakeReturnSettlementPort
  publish: jest.Mock
  notify: jest.Mock
  audit: jest.Mock
  timelineEnter: jest.Mock
  timelineList: jest.Mock
}

/**
 * 一套假件搭起整条 RMA 链路。
 * 跨模块的四个依赖（出货、订单、客户、用户目录）在这里换成可编程的假对象——
 * 本模块的测试不该因为 shipment 改了个字段就红。
 */
export function buildHarness(): Harness {
  const repo = new FakeSalesReturnRepository()
  const settlement = new FakeReturnSettlementPort()

  const publish = jest.fn().mockResolvedValue(undefined)
  const notify = jest.fn().mockResolvedValue(undefined)
  const auditRecord = jest.fn().mockResolvedValue(undefined)
  const timelineEnter = jest.fn().mockResolvedValue(undefined)
  const timelineList = jest.fn().mockResolvedValue([])

  const docNumber = {
    next: jest.fn(async () => `RMA-20260726-${String((docSeq += 1)).padStart(4, '0')}`),
  } as unknown as DocNumberService
  const audit = { record: auditRecord } as unknown as AuditService
  const notifications = { notify } as unknown as NotificationService
  const timeline = {
    enter: timelineEnter,
    close: jest.fn().mockResolvedValue(undefined),
    list: timelineList,
  } as unknown as DocTimelineService
  const events = { publish } as unknown as DomainEventPublisher

  const context = {
    shipmentContext: jest.fn(async () => ({
      shipmentId: 'SH1',
      shipmentNo: 'SHP-20260702-0043',
      orderId: 'O1',
      customerId: 'C1',
      currency: 'CNY',
      lines: SHIPPED_LINES,
    })),
    customerName: jest.fn(async () => '苏州明泰自动化'),
    displayName: jest.fn(async () => '罗晓琳'),
    namingFor: jest.fn(async () => ({
      orderNo: 'SO-20260620-0071',
      shipmentNo: 'SHP-20260702-0043',
      customerName: '苏州明泰自动化',
      ownerName: '罗晓琳',
    })),
  } as unknown as ReturnContextService

  const returns = new SalesReturnService(docNumber, audit, timeline, repo)
  const flow = new ReturnFlowService(
    audit,
    timeline,
    events,
    notifications,
    returns,
    repo,
    settlement,
  )
  const reads = new ReturnReadService(returns, context, timeline)

  return { returns, flow, reads, repo, settlement, publish, notify, audit: auditRecord, timelineEnter, timelineList }
}

/** 登记一张两行的 RMA，回到「已登记」这个起点。 */
export async function registerTwoLine(harness: Harness) {
  return harness.returns.register(
    {
      orderId: 'O1',
      shipmentId: 'SH1',
      customerId: 'C1',
      currency: 'CNY',
      reason: '孔位尺寸超差（+0.06mm）',
      eightDNo: '8D-26-0031',
      eightDRequired: true,
      complaintAt: new Date('2026-07-26T09:20:00Z'),
      lines: [
        {
          sequence: 1,
          shipmentLineId: 'SL1',
          orderLineId: 'OL1',
          productName: '导轨压板',
          drawingNo: 'MT-7601',
          batchNo: 'B26070901',
          returnQty: '120.000000',
          unitPriceMinor: 3_980n,
          amountMinor: 477_600n,
          reason: '平面度超差',
        },
        {
          sequence: 2,
          shipmentLineId: 'SL2',
          orderLineId: 'OL2',
          productName: '定位销座',
          drawingNo: 'MT-7420',
          batchNo: 'B26070902',
          returnQty: '30.000000',
          unitPriceMinor: 2_160n,
          amountMinor: 64_800n,
          reason: '镀锌层附着力不良',
        },
      ],
    },
    SALES,
    SHIPPED_LINES,
  )
}

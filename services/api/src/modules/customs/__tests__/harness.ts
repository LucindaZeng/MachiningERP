import { PERMISSION_CODES } from '@machining-erp/shared'

import { AuditService } from '../../../platform/audit'
import { NotificationService } from '../../../platform/notification'
import { DocNumberService } from '../../../platform/numbering'
import { DocTimelineService } from '../../../platform/timeline'
import { CustomsContextService } from '../services/customs-context.service'
import { CustomsDeclarationService } from '../services/customs-declaration.service'
import { CustomsDocumentFacade } from '../services/customs-document.facade'
import { CustomsDocumentService } from '../services/customs-document.service'
import { CustomsReadService } from '../services/customs-read.service'
import { CustomsService } from '../services/customs.service'

import { FakeCustomsRepository, FakeDocumentRenderPort } from './fakes'

import type { CreateCustomsDossierData } from '../repositories/customs.repository.port'
import type { CustomsActor } from '../services/customs.service'

export const SALES: CustomsActor = {
  userCode: 'WFX-2018-0042',
  permissions: [PERMISSION_CODES.SALES_OPERATE],
}
export const BROKER: CustomsActor = {
  userCode: 'WFX-2016-0007',
  permissions: [PERMISSION_CODES.CUSTOMS_DECLARE],
}
export const OUTSIDER: CustomsActor = { userCode: 'WFX-2019-0200', permissions: [] }

let docSeq = 0

export interface Harness {
  customs: CustomsService
  documents: CustomsDocumentService
  declarations: CustomsDeclarationService
  facade: CustomsDocumentFacade
  reads: CustomsReadService
  repo: FakeCustomsRepository
  renderer: FakeDocumentRenderPort
  notify: jest.Mock
  audit: jest.Mock
  timelineEnter: jest.Mock
  setShipmentPosted: (posted: boolean) => void
}

/** 齐套的一份要素——测试要构造「缺项」时按需挖掉某个字段。 */
export const COMPLETE_FACTS: Omit<
  CreateCustomsDossierData,
  'docNo' | 'createdBy' | 'shipmentId' | 'orderId' | 'customerId'
> = {
  tradeMode: '一般贸易',
  incoterm: 'FOB 盐田',
  portOfLoading: '深圳盐田港',
  destination: 'Los Angeles, USA',
  destinationPortCode: 'USLAX',
  shippingMarks: 'RADEX/LA/2026-07/NO.1-12',
  hsCode: '8302410000',
  goodsNameCn: '铝合金探头支架',
  goodsNameEn: 'Aluminium Probe Bracket',
  quantity: '1486.000000',
  unit: 'PCS',
  netWeight: '104.020',
  grossWeight: '128.500',
  packages: 12,
  currency: 'USD',
  unitPriceMinor: 2_490n,
  totalAmountMinor: 3_700_140n,
  exchangeRate: '7.152000',
  ownerUserCode: SALES.userCode,
}

export function buildHarness(): Harness {
  const repo = new FakeCustomsRepository()
  const renderer = new FakeDocumentRenderPort()

  const notify = jest.fn().mockResolvedValue(undefined)
  const auditRecord = jest.fn().mockResolvedValue(undefined)
  const timelineEnter = jest.fn().mockResolvedValue(undefined)

  const docNumber = {
    next: jest.fn(async () => `EXP-20260727-${String((docSeq += 1)).padStart(4, '0')}`),
  } as unknown as DocNumberService
  const audit = { record: auditRecord } as unknown as AuditService
  const notifications = { notify } as unknown as NotificationService
  const timeline = {
    enter: timelineEnter,
    close: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
  } as unknown as DocTimelineService

  let posted = true
  const context = {
    shipmentContext: jest.fn(async () => ({
      shipmentId: 'SH1',
      shipmentNo: 'SHP-20260727-0064',
      orderId: 'O1',
      customerId: 'C1',
      currency: 'USD',
      posted,
      quantity: '1486.000000',
      productName: '铝合金探头支架',
      drawingNo: 'MT-9001',
    })),
    displayName: jest.fn(async () => '陈志强'),
    namingFor: jest.fn(async () => ({
      shipmentNo: 'SHP-20260727-0064',
      orderNo: 'SO-20260710-0085',
      customerName: 'Radex Instruments Inc.',
      ownerName: '陈志强',
    })),
  } as unknown as CustomsContextService

  const customs = new CustomsService(docNumber, audit, timeline, repo)
  const documents = new CustomsDocumentService(audit, customs, repo, renderer)
  const declarations = new CustomsDeclarationService(
    audit,
    timeline,
    notifications,
    customs,
    repo,
  )
  const reads = new CustomsReadService(customs, context, timeline)
  const facade = new CustomsDocumentFacade(customs, documents, context, reads)

  return {
    customs,
    documents,
    declarations,
    facade,
    reads,
    repo,
    renderer,
    notify,
    audit: auditRecord,
    timelineEnter,
    setShipmentPosted: (value: boolean) => {
      posted = value
    },
  }
}

/** 建一份要素齐全的资料包，落在「草稿」这个起点。 */
export async function createDossier(
  harness: Harness,
  overrides: Partial<typeof COMPLETE_FACTS> = {},
) {
  return harness.customs.create(
    {
      ...COMPLETE_FACTS,
      ...overrides,
      shipmentId: 'SH1',
      orderId: 'O1',
      customerId: 'C1',
    },
    SALES,
  )
}

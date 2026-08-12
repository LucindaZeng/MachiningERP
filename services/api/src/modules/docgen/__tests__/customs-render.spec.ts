import { Workbook } from 'exceljs'

import { DocumentRenderRegistry, StubDocumentRenderAdapter } from '../../customs'
import { toCustomsPayload } from '../services/customs-payload.mapper'
import { CustomsRenderAdapter } from '../services/customs-render.adapter'
import { DocgenContextService } from '../services/docgen-context.service'
import { DocumentIssueService } from '../services/document-issue.service'
import { TemplateRendererService } from '../services/template-renderer.service'

import { FakeStorage } from './harness'

import type { CustomsDossierRecord } from '../../customs'
import type { Worksheet } from 'exceljs'

function dossier(overrides: Partial<CustomsDossierRecord> = {}): CustomsDossierRecord {
  return {
    id: 'CD1',
    docNo: 'EXP-20260811-0001',
    shipmentId: 'SH1',
    orderId: 'SO1',
    customerId: 'C1',
    tradeMode: '一般贸易',
    incoterm: 'FOB',
    portOfLoading: '深圳盐田',
    destination: 'Melbourne, Australia',
    destinationPortCode: 'AUMEL',
    shippingMarks: 'BMD/MEL/2026',
    hsCode: '8466939000',
    goodsNameCn: '数控机床零件',
    goodsNameEn: 'CNC machine parts',
    quantity: '500.000000',
    unit: 'PCS',
    netWeight: '120.500000',
    grossWeight: '135.000000',
    packages: 12,
    currency: 'USD',
    unitPriceMinor: 1250n,
    totalAmountMinor: 625_000n,
    exchangeRate: '7.180000',
    status: 'GENERATED',
    ownerUserCode: 'WFX-2018-0042',
    checkedBy: null,
    checkedAt: null,
    declarationVersion: 0,
    declaredAt: null,
    releasedAt: null,
    versionLock: 0,
    documents: [
      {
        id: 'DOC1',
        kind: 'COMMERCIAL_INVOICE',
        version: 1,
        objectKey: 'k',
        fileName: 'f',
        exchangeRate: '7.180000',
        currency: 'USD',
        generatedAt: new Date(2026, 7, 1),
        generatedBy: 'WFX-2018-0042',
      },
      {
        id: 'DOC2',
        kind: 'PACKING_LIST',
        version: 2,
        objectKey: 'k',
        fileName: 'f',
        exchangeRate: '7.180000',
        currency: 'USD',
        generatedAt: new Date(2026, 7, 2),
        generatedBy: 'WFX-2018-0042',
      },
    ],
    declarations: [],
    corrections: [],
    ...overrides,
  } as CustomsDossierRecord
}

function buildAdapter(record = dossier()): {
  adapter: CustomsRenderAdapter
  registry: DocumentRenderRegistry
  storage: FakeStorage
} {
  const storage = new FakeStorage()
  const registry = new DocumentRenderRegistry(new StubDocumentRenderAdapter())
  const context = new DocgenContextService(
    {
      profileFor: async () => ({ name: '客户全称' }),
      invoiceProfileFor: async () => ({
        name: 'Blackmagic Design Australia',
        invoiceAddress: '180 Bank Street, South Melbourne',
        paymentTerm: 'T/T 30 days',
      }),
    } as never,
    { findByUserCode: async () => ({ displayName: '任存冲' }) } as never,
    { load: async () => ({ docNo: 'SHP-20260720-0001' }) } as never,
    { load: async () => ({ docNo: 'SO-20260701-0001' }) } as never,
  )

  const adapter = new CustomsRenderAdapter(
    registry,
    { load: async () => record } as never,
    new DocumentIssueService(new TemplateRendererService(), storage as never),
    context,
  )

  return { adapter, registry, storage }
}

async function sheetOf(storage: FakeStorage, name: string): Promise<Worksheet> {
  const [stored] = [...storage.objects.values()]
  const book = new Workbook()
  await book.xlsx.load(
    Buffer.from(stored!.bytes) as unknown as Parameters<typeof book.xlsx.load>[0],
  )
  return book.getWorksheet(name)!
}

const REQUEST = {
  dossierId: 'CD1',
  docNo: 'EXP-20260811-0001',
  templateCode: 'EXP-INV',
  version: 2,
  exchangeRate: '7.200000',
  currency: 'USD',
} as const

describe('报关文件出具（docgen 接管 customs 的渲染端口）', () => {
  it('启动时把自己登记进注册表——登记前退回 STUB，登记后出真文件', async () => {
    const { adapter, registry, storage } = buildAdapter()

    expect(registry.wired).toBe(false)
    // 未登记时走 STUB：只登记版本，不出文件
    expect(await registry.render({ ...REQUEST, kind: 'COMMERCIAL_INVOICE' })).toMatchObject({
      objectKey: null,
      fileName: null,
    })

    adapter.onModuleInit()
    expect(registry.wired).toBe(true)

    const result = await registry.render({ ...REQUEST, kind: 'COMMERCIAL_INVOICE' })
    expect(result.objectKey).toBe('customs/EXP-20260811-0001/COMMERCIAL_INVOICE-v2.xlsx')
    expect(result.fileName).toContain('商业发票-V2')
    expect(storage.objects.size).toBe(1)
  })

  it('商业发票：抬头、要素与金额都落位，汇率取本版快照而非资料包表头', async () => {
    const { adapter, storage } = buildAdapter()
    await adapter.render({ ...REQUEST, kind: 'COMMERCIAL_INVOICE' })
    const sheet = await sheetOf(storage, 'INVOICE')

    expect(String(sheet.getCell('A2').value)).toContain('商业发票')
    expect(String(sheet.getCell('A2').value)).toContain('Commercial Invoice')
    expect(String(sheet.getCell('A6').value)).toContain('Blackmagic Design Australia')
    expect(sheet.getCell('D10').value).toBe(500)
    expect(sheet.getCell('G10').value).toBe(6250)
    // 资料包表头是 7.18，本版快照是 7.20——印出去的必须是后者
    const footer = [13, 14, 15, 16].map((row) => String(sheet.getCell(`A${row}`).value)).join(' ')
    expect(footer).toContain('7.200000')
    expect(footer).not.toContain('7.180000')
  })

  it('形式发票与商业发票共用版式，只有抬头不同', async () => {
    const { adapter, storage } = buildAdapter()
    await adapter.render({ ...REQUEST, kind: 'PROFORMA_INVOICE', version: 1 })
    const sheet = await sheetOf(storage, 'INVOICE')

    expect(String(sheet.getCell('A2').value)).toContain('形式发票')
    expect(String(sheet.getCell('A2').value)).toContain('Proforma Invoice')
  })

  it('装箱单与出口合同各出各的版式', async () => {
    const packing = buildAdapter()
    await packing.adapter.render({ ...REQUEST, kind: 'PACKING_LIST', version: 3 })
    expect(String((await sheetOf(packing.storage, 'PACKING LIST')).getCell('A2').value)).toContain(
      '装箱单',
    )

    const contract = buildAdapter()
    await contract.adapter.render({ ...REQUEST, kind: 'CONTRACT', version: 1 })
    const sheet = await sheetOf(contract.storage, 'CONTRACT')
    expect(String(sheet.getCell('A2').value)).toContain('出口销售合同')
    // 付款方式取自客户档案
    const footer = [11, 12, 13, 14, 15].map((row) => String(sheet.getCell(`A${row}`).value)).join(' ')
    expect(footer).toContain('T/T 30 days')
  })

  it('数据包：随附清单取各种文件的当前最高版，且不列自己', async () => {
    const { adapter, storage } = buildAdapter()
    await adapter.render({ ...REQUEST, kind: 'DATA_PACK', version: 1 })
    const sheet = await sheetOf(storage, '报关数据包')

    // 要素表 13 行（行 8 起），随附清单表头在其后
    const manifestRows: string[] = []
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const first = String(row.getCell(2).value ?? '')
      if (first === 'COMMERCIAL_INVOICE' || first === 'PACKING_LIST' || first === 'DATA_PACK') {
        manifestRows.push(`${first}:${String(row.getCell(4).value ?? '')}`)
      }
    })

    expect(manifestRows).toEqual(['COMMERCIAL_INVOICE:V1', 'PACKING_LIST:V2'])
  })

  it('未登记模板的文件种类退回「只登记版本」，不让整条出具链断掉', async () => {
    const { adapter, storage } = buildAdapter()
    const result = await adapter.render({ ...REQUEST, kind: 'UNKNOWN_KIND' as never })

    expect(result).toMatchObject({ objectKey: null, fileName: null })
    expect(storage.objects.size).toBe(0)
  })

  it('重复登记以最后一次为准', () => {
    const { adapter, registry } = buildAdapter()
    adapter.onModuleInit()
    adapter.onModuleInit()
    expect(registry.wired).toBe(true)
  })
})

describe('报关模板数据映射', () => {
  it('只有中文品名时不留下孤零零的换行', () => {
    const payload = toCustomsPayload(
      dossier({ goodsNameEn: null }),
      { kind: 'COMMERCIAL_INVOICE', version: 1, exchangeRate: '7.1', issuedOn: new Date() },
      {
        customerName: 'X',
        customerAddress: 'Y',
        shipmentNo: 'S',
        orderNo: 'O',
        paymentTerms: 'P',
      },
    )
    const lines = payload.lines as Array<{ description: string }>
    expect(lines[0]!.description).toBe('数控机床零件')
  })

  it('缺失的可选要素出空串而不是 undefined——单据上不该出现 undefined', () => {
    const payload = toCustomsPayload(
      dossier({ destinationPortCode: null, shippingMarks: null }),
      { kind: 'DATA_PACK', version: 1, exchangeRate: '7.1', issuedOn: new Date() },
      {
        customerName: 'X',
        customerAddress: 'Y',
        shipmentNo: 'S',
        orderNo: 'O',
        paymentTerms: 'P',
      },
    )

    expect(payload.destinationPortCode).toBe('')
    expect(payload.shippingMarks).toBe('')
    const elements = payload.elements as Array<{ label: string; value: unknown }>
    expect(elements.find((item) => item.label === '目的港代码')!.value).toBe('')
  })
})

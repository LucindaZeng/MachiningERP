import { Workbook } from 'exceljs'

import { STATEMENT_LINE_TYPE_LABEL } from '../../shipment'
import { DOCGEN_TEMPLATES } from '../constants/template-registry'
import { toCostAnalysisPayload } from '../services/cost-analysis-payload.mapper'
import { DocgenContextService } from '../services/docgen-context.service'
import { toRateText } from '../services/money-format'
import { toQuotationPayload } from '../services/quotation-payload.mapper'
import { toStatementPayload } from '../services/statement-payload.mapper'
import { TemplateRendererService } from '../services/template-renderer.service'
import { fillWorksheet } from '../services/worksheet-filler'

import { costAnalysis, quotation, statement } from './fixtures'

import type { Worksheet } from 'exceljs'

const ISSUED_ON = new Date(2026, 7, 11)

/** 上游查不到时该退回什么。这几条分支平时不走，出事时全靠它们兜住。 */
describe('取名字的兜底', () => {
  function context(overrides: {
    profileFor?: () => Promise<unknown>
    invoiceProfileFor?: () => Promise<unknown>
    findByUserCode?: () => Promise<unknown>
    loadShipment?: () => Promise<unknown>
    loadOrder?: () => Promise<unknown>
  }): DocgenContextService {
    return new DocgenContextService(
      {
        profileFor: overrides.profileFor ?? (async () => ({ name: '客户全称' })),
        invoiceProfileFor: overrides.invoiceProfileFor ?? (async () => ({ name: '客户全称' })),
      } as never,
      { findByUserCode: overrides.findByUserCode ?? (async () => ({ displayName: '姓名' })) } as never,
      { load: overrides.loadShipment ?? (async () => ({ docNo: 'SHP-1' })) } as never,
      { load: overrides.loadOrder ?? (async () => ({ docNo: 'SO-1' })) } as never,
    )
  }

  it('客户档案查不到时退回客户 id——历史单据不该因为客户停用就出不来', async () => {
    const service = context({
      profileFor: async () => {
        throw new Error('客户已停用')
      },
    })
    expect(await service.customerName('C-DEAD')).toBe('C-DEAD')
  })

  it('用户查不到时退回工号——宁可印工号也不要印一片空白', async () => {
    const service = context({ findByUserCode: async () => null })
    expect(await service.displayName('WFX-9999')).toBe('WFX-9999')
  })

  it('报价抬头：开票档案取不到时，客户名回落到基础档案，联系方式留空', async () => {
    const service = context({
      invoiceProfileFor: async () => {
        throw new Error('无开票档案')
      },
      findByUserCode: async () => null,
    })
    const naming = await service.quotationNaming('C1', 'WFX-1')

    expect(naming).toMatchObject({
      customerName: '客户全称',
      customerEmail: null,
      customerAddress: null,
      ownerName: 'WFX-1',
    })
  })

  it('报关抬头：出货单与订单查不到时留空号，不让整份文件出不来', async () => {
    const service = context({
      invoiceProfileFor: async () => {
        throw new Error('无档案')
      },
      loadShipment: async () => {
        throw new Error('出货单已删')
      },
      loadOrder: async () => {
        throw new Error('订单已删')
      },
    })
    const naming = await service.customsNaming({
      customerId: 'C7',
      shipmentId: 'S1',
      orderId: 'O1',
    } as never)

    expect(naming).toEqual({
      customerName: 'C7',
      customerAddress: '',
      shipmentNo: '',
      orderNo: '',
      paymentTerms: '',
    })
  })
})

describe('报价单模板数据', () => {
  it('档数比模板列数少时，多出来的列给 null 而不是 0', () => {
    const payload = toQuotationPayload(
      quotation(),
      naming(),
      DOCGEN_TEMPLATES.QUOTATION_OVERSEAS,
      ISSUED_ON,
    )

    expect(payload.tierLabel1).toBe(100)
    expect(payload.tierLabel2).toBe(5000)
    // 国外模板有五列，记录只有两档
    expect(payload.tierLabel3).toBeNull()
    expect(payload.tierLabel5).toBeNull()

    const [item] = payload.items as Array<Record<string, unknown>>
    expect(item!.tier1).toBe(25)
    expect(item!.tier3).toBeNull()
  })

  it('档位有自定义标签时优先用标签（如 Sample）', () => {
    const record = quotation()
    record.items[0]!.tiers[0]!.label = 'Sample'
    const payload = toQuotationPayload(
      record,
      naming(),
      DOCGEN_TEMPLATES.QUOTATION_DOMESTIC,
      ISSUED_ON,
    )
    expect(payload.tierLabel1).toBe('Sample')
  })

  it('一条明细都没有时，档位表头全给 null', () => {
    const payload = toQuotationPayload(
      quotation({ items: [] }),
      naming(),
      DOCGEN_TEMPLATES.QUOTATION_DOMESTIC,
      ISSUED_ON,
    )
    expect(payload.tierLabel1).toBeNull()
  })

  it('没有条款与有效期时，勾选与天数都落到空——不勾任何一个', () => {
    const payload = toQuotationPayload(
      quotation({ terms: null, validUntil: null }),
      naming(),
      DOCGEN_TEMPLATES.QUOTATION_DOMESTIC,
      ISSUED_ON,
    )

    expect(payload.validDays).toBe('')
    expect(payload.terms).toMatchObject({ processingMode: '', allowedScrapBps: '', scrapReturned: 'false' })
  })

  it('有效期换算成天数，供 15/30/60 勾选', () => {
    const payload = toQuotationPayload(
      quotation(),
      naming(),
      DOCGEN_TEMPLATES.QUOTATION_DOMESTIC,
      ISSUED_ON,
    )
    expect(payload.validDays).toBe(30)
  })

  function naming() {
    return {
      customerName: '客户',
      customerContact: null,
      customerPhone: null,
      customerFax: null,
      customerEmail: null,
      customerAddress: null,
      ownerName: '业务',
      ownerPhone: null,
      ownerEmail: null,
    }
  }
})

describe('成本分析模板数据', () => {
  const totals = {
    lines: [
      {
        materialAmount: { minor: 2987n, currency: 'CNY' },
        processTotal: { minor: 150n, currency: 'CNY' },
        subtotal: { minor: 21_137n, currency: 'CNY' },
        loss: { minor: 1057n, currency: 'CNY' },
        overhead: { minor: 1110n, currency: 'CNY' },
        total: { minor: 23_304n, currency: 'CNY' },
        totalWithVat: { minor: 26_334n, currency: 'CNY' },
        exact: { total: '0', totalWithVat: '0' },
      },
    ],
    total: { minor: 23_304n, currency: 'CNY' },
    totalWithVat: { minor: 26_334n, currency: 'CNY' },
    exact: { total: '0', totalWithVat: '0' },
  }

  it('税额由含税减不含税得出，不另立一套算法', () => {
    const payload = toCostAnalysisPayload(
      costAnalysis(),
      totals as never,
      { customerName: '安费诺' },
      ISSUED_ON,
    )
    const [line] = payload.lines as Array<Record<string, unknown>>
    expect(line!.taxAmount).toBe(30.3)
    expect(line!.totalWithTax).toBe(263.34)
  })

  it('记录里没有的工艺列给 null，且已登记但本行没花钱的列给 0', () => {
    const payload = toCostAnalysisPayload(
      costAnalysis(),
      totals as never,
      { customerName: '安费诺' },
      ISSUED_ON,
    )
    const [line] = payload.lines as Array<Record<string, unknown>>

    expect(line!.process1).toBe(1.5)
    // polishing 在列表里但本行是 0 → 0 是「测得为零」
    expect(line!.process2).toBe(0)
    // 第三列根本没登记 → null 是「没有这一列」
    expect(line!.process3).toBeNull()
    expect(payload.processLabel3).toBeNull()
  })

  it('合计缺失时整行金额落 null，而不是把 0 印在成本表上', () => {
    const payload = toCostAnalysisPayload(
      costAnalysis(),
      { lines: [], total: { minor: 0n }, totalWithVat: { minor: 0n } } as never,
      { customerName: '安费诺' },
      ISSUED_ON,
    )
    const [line] = payload.lines as Array<Record<string, unknown>>
    expect(line!.subtotal).toBeNull()
    expect(line!.taxAmount).toBeNull()
  })

  it('费率按记录里的万分比出表头文字', () => {
    const payload = toCostAnalysisPayload(
      costAnalysis({ lossBps: 350, vatBps: 900 }),
      totals as never,
      { customerName: 'X' },
      ISSUED_ON,
    )
    expect(payload.lossPercent).toBe('3.5%')
    expect(payload.vatPercent).toBe('9%')
  })
})

describe('对账单模板数据', () => {
  it('行类型用 shipment 那一套中文名，不另起一套说法', () => {
    const payload = toStatementPayload(statement(), {
      customerName: '安费诺',
      ownerName: '曾跃文',
      basisLabel: '按出货',
    })
    const lines = payload.lines as Array<Record<string, unknown>>
    // 取的是 shipment 导出的字典，因此这里断言的就是那份字典里的字
    expect(lines.map((line) => line.typeLabel)).toEqual([
      STATEMENT_LINE_TYPE_LABEL.SHIPMENT,
      STATEMENT_LINE_TYPE_LABEL.RETURN,
    ])
  })

  it('有差异说明时口径文字会提示去看说明', () => {
    const withNote = toStatementPayload(statement({ differenceNote: '客户少记一张' }), {
      customerName: 'X',
      ownerName: 'Y',
      basisLabel: '按出货',
    })
    expect(withNote.differenceNote).toBe('客户少记一张')
    expect((withNote.totals as Record<string, unknown>).difference).toBe(0)
  })
})

describe('渲染引擎的失败路径', () => {
  const renderer = new TemplateRendererService()

  it('未登记的模板报 TEMPLATE_NOT_FOUND，并点名是哪个', async () => {
    await expect(renderer.render('NOT_A_TEMPLATE' as never, {})).rejects.toMatchObject({
      code: 'SYS_9050',
    })
  })

  it('模板引用的集合不是数组时报 REPEAT_SOURCE_MISSING，并点名集合名', async () => {
    await expect(
      renderer.render(DOCGEN_TEMPLATES.STATEMENT, { lines: '不是数组' }),
    ).rejects.toMatchObject({ code: 'SYS_9053' })
  })

  it('第二次出具不会串上一次的数据——缓存的是字节不是工作簿', async () => {
    const first = await renderer.render(DOCGEN_TEMPLATES.STATEMENT, {
      docNo: 'A',
      lines: [{ docNo: 'L1' }],
    })
    const second = await renderer.render(DOCGEN_TEMPLATES.STATEMENT, {
      docNo: 'B',
      lines: [{ docNo: 'L2' }],
    })

    expect(await cellText(first.bytes, '对账单', 'C9')).toBe('L1')
    expect(await cellText(second.bytes, '对账单', 'C9')).toBe('L2')
  })
})

describe('多行重复区域', () => {
  it('两行一块的区域按 ABAB 展开，而不是 AABB', async () => {
    const book = new Workbook()
    const sheet = book.addWorksheet('多行')
    sheet.getCell('A1').value = '{{*rows.name}}'
    sheet.getCell('A2').value = '说明：{{*rows.note}}'

    fillWorksheet(sheet, {
      rows: [
        { name: '甲', note: '一' },
        { name: '乙', note: '二' },
        { name: '丙', note: '三' },
      ],
    })

    expect([1, 2, 3, 4, 5, 6].map((row) => String(sheet.getCell(`A${row}`).value))).toEqual([
      '甲',
      '说明：一',
      '乙',
      '说明：二',
      '丙',
      '说明：三',
    ])
  })

  it('两个独立区域各自展开，行号不会互相推错', async () => {
    const book = new Workbook()
    const sheet = book.addWorksheet('两块')
    sheet.getCell('A1').value = '{{*a.v}}'
    sheet.getCell('A2').value = '分隔'
    sheet.getCell('A3').value = '{{*b.v}}'

    fillWorksheet(sheet, { a: [{ v: 1 }, { v: 2 }], b: [{ v: 8 }, { v: 9 }] })

    expect([1, 2, 3, 4, 5].map((row) => sheet.getCell(`A${row}`).value)).toEqual([
      1,
      2,
      '分隔',
      8,
      9,
    ])
  })
})

describe('汇率等高精度小数保持字符串', () => {
  it('不做数字化——它是快照，不参与表内计算', () => {
    expect(toRateText('7.180000')).toBe('7.180000')
    expect(toRateText(null)).toBe('')
    expect(toRateText(undefined)).toBe('')
  })
})

async function cellText(bytes: Uint8Array, sheetName: string, address: string): Promise<string> {
  const book = new Workbook()
  await book.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof book.xlsx.load>[0])
  const sheet = book.getWorksheet(sheetName) as Worksheet
  return String(sheet.getCell(address).value ?? '')
}

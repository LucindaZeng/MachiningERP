import { Workbook } from 'exceljs'

import { BizError } from '../../../common/errors/biz-error'
import { MERGE_EXPORT_LIMIT } from '../constants/template-registry'
import {
  composeCustomsObjectKey,
  composeFileName,
  composeGeneratedObjectKey,
  sanitizeSegment,
} from '../services/document-object-key'
import { bpsToPercent, decimalToNumber, minorToNumber, toDateText } from '../services/money-format'

import { costAnalysis, quotation, statement } from './fixtures'
import { buildHarness } from './harness'

import type { Worksheet } from 'exceljs'

async function sheetOf(bytes: Uint8Array, name: string): Promise<Worksheet> {
  const book = new Workbook()
  await book.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof book.xlsx.load>[0])
  return book.getWorksheet(name)!
}

describe('单份出具', () => {
  it('报价单：落存储、登记记录、写审计，三件事都做到', async () => {
    const harness = buildHarness({ quotations: [quotation()] })
    const record = await harness.docgen.issueQuotation('Q1', { userCode: 'WFX-2018-0042' })

    expect(harness.storage.objects.has(record.objectKey)).toBe(true)
    expect(harness.storage.objects.size).toBe(1)
    expect(record.templateId).toBe('QUOTATION_DOMESTIC')
    expect(record.sourceDocNo).toBe('QTN-20260811-0001')
    expect(record.fileName).toContain('报价单')
    expect(record.sizeBytes).toBeGreaterThan(0)

    expect(harness.audits).toHaveLength(1)
    expect(harness.audits[0]).toMatchObject({
      action: 'docgen.issue',
      entityType: 'Quotation',
      entityId: 'QTN-20260811-0001',
    })
  })

  it('报价单：国外单据自动换成英文版式', async () => {
    const harness = buildHarness({ quotations: [quotation({ template: 'OVERSEAS' })] })
    const record = await harness.docgen.issueQuotation('Q1', { userCode: 'WFX-2018-0042' })
    expect(record.templateId).toBe('QUOTATION_OVERSEAS')
  })

  it('报价单：阶梯价与客户名真的落进了格子', async () => {
    const harness = buildHarness({ quotations: [quotation()] })
    await harness.docgen.issueQuotation('Q1', { userCode: 'WFX-2018-0042' })

    const [stored] = [...harness.storage.objects.values()]
    const sheet = await sheetOf(stored!.bytes, '报价单')
    expect(String(sheet.getCell('C5').value)).toBe('客户-C1')
    expect(sheet.getCell('I12').value).toBe(25)
    expect(sheet.getCell('J12').value).toBe(4)
    // 档位表头取自第一条明细的起订量
    expect(String(sheet.getCell('I11').value)).toBe('MOQ:100')
  })

  it('成本分析：金额取后端算好的值，工艺列按记录里的列名出表头', async () => {
    const harness = buildHarness({ costAnalyses: [costAnalysis()] })
    await harness.docgen.issueCostAnalysis('CA1', { userCode: 'WFX-2019-0011' })

    const [stored] = [...harness.storage.objects.values()]
    const sheet = await sheetOf(stored!.bytes, '成本分析')
    expect(String(sheet.getCell('Q4').value)).toBe('打磨去毛刺')
    expect(String(sheet.getCell('R4').value)).toBe('抛光')
    // 记录里只有两列工艺，第三列起留空
    expect(sheet.getCell('S4').value ?? '').toBe('')
    expect(sheet.getCell('M5').value).toBe(10)
    expect(sheet.getCell('AA5').value).toBe(25.99)
    // 费率表头跟着记录走，不是模板里写死的 5%
    expect(String(sheet.getCell('Z4').value)).toBe('含税（13%）')
  })

  it('对账单：退货折让在明细里是负数、在合计里取绝对值', async () => {
    const harness = buildHarness({ statements: [statement()] })
    await harness.docgen.issueStatement('ST1', { userCode: 'WFX-2018-0042' })

    const [stored] = [...harness.storage.objects.values()]
    const sheet = await sheetOf(stored!.bytes, '对账单')
    // 明细：出货 +5000，退货 −300
    expect(sheet.getCell('G9').value).toBe(5000)
    expect(sheet.getCell('G10').value).toBe(-300)
    // 合计区在明细展开一行后下移；「退货与折让」那一格取绝对值，负号由列名承担
    expect(sheet.getCell('G11').value).toBe(5000)
    expect(sheet.getCell('G12').value).toBe(300)
    expect(sheet.getCell('G13').value).toBe(4700)
  })

  it('同一份单据连出两次得到两个不同的对象键——已出具的文件不可覆盖', async () => {
    const harness = buildHarness({ quotations: [quotation()] })
    const first = await harness.docgen.issueQuotation('Q1', { userCode: 'A' })
    const second = await harness.docgen.issueQuotation('Q1', { userCode: 'A' })

    expect(first.objectKey).not.toBe(second.objectKey)
    expect(harness.storage.objects.size).toBe(2)
    expect(harness.repository.rows).toHaveLength(2)
  })

  it('查得回某张单据出过哪些文件；查不到的 id 报 404 码', async () => {
    const harness = buildHarness({ quotations: [quotation()] })
    const issued = await harness.docgen.issueQuotation('Q1', { userCode: 'A' })

    expect(await harness.docgen.list('Quotation', 'Q1')).toHaveLength(1)
    expect((await harness.docgen.detail(issued.id)).fileName).toBe(issued.fileName)
    await expect(harness.docgen.detail('不存在')).rejects.toMatchObject({ code: 'SYS_9057' })
  })
})

describe('多选合并导出', () => {
  it('报价合并：一个档位一行，份数与行数都记在表头', async () => {
    const harness = buildHarness({
      quotations: [quotation(), quotation({ id: 'Q2', docNo: 'QTN-2', customerId: 'C2' })],
    })
    const record = await harness.merge.exportQuotations(['Q1', 'Q2'], { userCode: 'WFX-1' })

    expect(record.documentCount).toBe(2)
    const [stored] = [...harness.storage.objects.values()]
    const sheet = await sheetOf(stored!.bytes, '报价合并比较')

    // 两份单据 × 每份 1 个产品 × 2 个档位 = 4 行
    const docNos = [8, 9, 10, 11].map((row) => String(sheet.getCell(`A${row}`).value))
    expect(docNos).toEqual(['QTN-20260811-0001', 'QTN-20260811-0001', 'QTN-2', 'QTN-2'])
    expect(sheet.getCell('H8').value).toBe(100)
    expect(sheet.getCell('H9').value).toBe(5000)
    expect(sheet.getCell('I8').value).toBe(25)
  })

  it('成本分析合并：份数正确，客户名逐份取', async () => {
    const harness = buildHarness({
      costAnalyses: [costAnalysis(), costAnalysis({ id: 'CA2', docNo: 'CST-2', customerId: 'C9' })],
    })
    const record = await harness.merge.exportCostAnalyses(['CA1', 'CA2'], { userCode: 'WFX-1' })

    expect(record.documentCount).toBe(2)
    expect(record.templateId).toBe('COST_ANALYSIS_MERGE')

    const [stored] = [...harness.storage.objects.values()]
    const sheet = await sheetOf(stored!.bytes, '成本分析合并比较')
    expect(String(sheet.getCell('C8').value)).toBe('客户-C1')
    expect(String(sheet.getCell('C9').value)).toBe('客户-C9')
  })

  it('一份都没选时拒绝，并给出可读的码', async () => {
    const harness = buildHarness()
    await expect(harness.merge.exportQuotations([], { userCode: 'A' })).rejects.toMatchObject({
      code: 'SYS_9055',
    })
    await expect(harness.merge.exportCostAnalyses([], { userCode: 'A' })).rejects.toMatchObject({
      code: 'SYS_9055',
    })
  })

  it('超过上限时拒绝，并在消息里报出实际份数', async () => {
    const harness = buildHarness()
    const tooMany = Array.from({ length: MERGE_EXPORT_LIMIT + 1 }, (_, index) => `Q${index}`)

    try {
      await harness.merge.exportQuotations(tooMany, { userCode: 'A' })
      throw new Error('应当抛出')
    } catch (error) {
      expect(BizError.is(error)).toBe(true)
      expect((error as BizError).code).toBe('SYS_9056')
      expect((error as BizError).message).toContain(String(MERGE_EXPORT_LIMIT + 1))
    }
  })

  it('恰好等于上限时放行', async () => {
    const harness = buildHarness({ quotations: [quotation()] })
    const ids = Array.from({ length: MERGE_EXPORT_LIMIT }, () => 'Q1')
    const record = await harness.merge.exportQuotations(ids, { userCode: 'A' })
    expect(record.documentCount).toBe(MERGE_EXPORT_LIMIT)
  })
})

describe('对象键与文件名', () => {
  it('报关文件的键带版本——历史版本要能各自留在存储上', () => {
    expect(composeCustomsObjectKey('EXP-20260811-0001', 'COMMERCIAL_INVOICE', 2)).toBe(
      'customs/EXP-20260811-0001/COMMERCIAL_INVOICE-v2.xlsx',
    )
  })

  it('生成物的键每次都不同——同一秒连点两次导出不该撞键', () => {
    const input = {
      sourceType: 'Quotation',
      sourceDocNo: 'QTN-1',
      templateId: 'QUOTATION_DOMESTIC',
      templateVersion: 1,
    }
    const first = composeGeneratedObjectKey(input)
    const second = composeGeneratedObjectKey(input)

    expect(first).not.toBe(second)
    expect(first.startsWith('documents/Quotation/QTN-1/QUOTATION_DOMESTIC-v1-')).toBe(true)
  })

  it('键里的危险字符被压掉，中文保留', () => {
    expect(sanitizeSegment('报价单 / 2026?')).toBe('报价单-2026')
    expect(sanitizeSegment('///')).toBe('unnamed')
    expect(sanitizeSegment('normal-name.v1')).toBe('normal-name.v1')
  })

  it('文件名带单号与日期', () => {
    expect(composeFileName('报价单', 'QTN-1', new Date(2026, 7, 9))).toBe(
      '报价单-QTN-1-20260809.xlsx',
    )
  })
})

describe('金额与数量转换', () => {
  it('整数分 → 元；空值原样透传而不是 0', () => {
    expect(minorToNumber(123_456n)).toBe(1234.56)
    expect(minorToNumber(-5n)).toBe(-0.05)
    expect(minorToNumber(null)).toBeNull()
    expect(minorToNumber(undefined)).toBeNull()
  })

  it('decimal 字符串 → 数字；解析不了给 null 而不是 0', () => {
    expect(decimalToNumber('1.500000')).toBe(1.5)
    expect(decimalToNumber('')).toBeNull()
    expect(decimalToNumber('   ')).toBeNull()
    expect(decimalToNumber('N/A')).toBeNull()
    expect(decimalToNumber(null)).toBeNull()
  })

  it('万分比 → 百分比文字', () => {
    expect(bpsToPercent(1300)).toBe('13%')
    expect(bpsToPercent(350)).toBe('3.5%')
    expect(bpsToPercent(0)).toBe('0%')
    expect(bpsToPercent(null)).toBe('')
  })

  it('日期取本地 YYYY-MM-DD，空值出空串', () => {
    expect(toDateText(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toDateText(null)).toBe('')
  })
})

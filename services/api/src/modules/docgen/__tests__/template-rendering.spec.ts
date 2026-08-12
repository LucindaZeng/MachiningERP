import { Workbook } from 'exceljs'

import { DOCGEN_TEMPLATES, TEMPLATE_DEFINITIONS } from '../constants/template-registry'
import { TemplateRendererService } from '../services/template-renderer.service'

import type { Worksheet } from 'exceljs'

/**
 * 对**真实模板文件**的黄金往返测试：填一遍 → 重新打开 → 断言关键格。
 *
 * 不用桩工作簿的理由：这个模块最可能出错的地方恰恰在真实模板上——
 * 合并区丢失、图片丢失、行高塌掉、公式被抄成错行。这些都只有拿
 * templates/ 下那几份真文件跑一遍才看得见。
 */

async function reopen(bytes: Uint8Array): Promise<Workbook> {
  const book = new Workbook()
  await book.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof book.xlsx.load>[0])
  return book
}

function textOf(sheet: Worksheet, address: string): string {
  const value = sheet.getCell(address).value
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: Array<{ text: string }> }).richText
      .map((part) => part.text)
      .join('')
  }
  return String(value)
}

/** 某一行是否还有 `{{}}` 残留——填漏了的最直接信号。 */
function hasLeftoverMarkers(sheet: Worksheet): string[] {
  const leftovers: string[] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const text = typeof cell.value === 'string' ? cell.value : ''
      if (text.includes('{{')) leftovers.push(`${cell.address}=${text}`)
    })
  })
  return leftovers
}

describe('模板渲染（真实模板文件）', () => {
  const renderer = new TemplateRendererService()

  const domesticPayload = {
    quotedOn: '2026-08-11',
    currency: 'CNY',
    validDays: 30,
    customer: {
      name: '深圳市美思先端电子有限公司',
      contact: '刘工',
      phone: '0755-1234567',
      fax: '0755-7654321',
      email: 'liu@example.com',
      address: '深圳市南山区',
    },
    owner: { name: '任存冲', phone: '13580990562', email: 'WL@wanfuxin.com' },
    terms: {
      processingMode: '包工包料',
      paymentTerms: '月结30天',
      allowedScrapBps: 300,
      scrapReturned: false,
      remark: '含运费',
    },
    tierLabel1: 100,
    tierLabel2: 5000,
    items: [
      { productName: '金属壳体1', process: '机加工', tier1: 25, tier2: 4, remark: '' },
      { productName: '金属壳体2', process: '机加工', tier1: 30, tier2: 6, remark: '含阳极' },
      { productName: '金属壳体3', process: '机加工', tier1: 18, tier2: 3.5, remark: '' },
    ],
  }

  it('国内报价单：明细展开三行，合并区与 logo 都还在', async () => {
    const rendered = await renderer.render(DOCGEN_TEMPLATES.QUOTATION_DOMESTIC, domesticPayload)
    const sheet = (await reopen(rendered.bytes)).getWorksheet('报价单')!

    expect(rendered.templateVersion).toBe(TEMPLATE_DEFINITIONS.QUOTATION_DOMESTIC.version)
    // 三行明细各就各位，序号是引擎给的 1 基下标
    expect([textOf(sheet, 'A12'), textOf(sheet, 'A13'), textOf(sheet, 'A14')]).toEqual(['1', '2', '3'])
    expect(textOf(sheet, 'B14')).toBe('金属壳体3')
    expect(sheet.getCell('I14').value).toBe(18)

    // 合并区必须逐行重建——丢了的话产品名会被右边的列盖住
    const merges = sheet.model.merges
    expect(merges).toContain('B12:G12')
    expect(merges).toContain('B13:G13')
    expect(merges).toContain('B14:G14')

    // 模板自带的 logo 不能在往返中掉
    expect(sheet.getImages().length).toBeGreaterThan(0)
  })

  /**
   * 这条是拿真模板出样张目检出来的，不是想出来的：
   * 明细多一行，下方条款区的合并区若不跟着搬，「币别」会印成「币别 币别」，
   * 付款方式那一行糊成一格一个字。值是对的，所以只看值的断言全都过。
   */
  it('明细区下方的合并区跟着一起下移', async () => {
    const rendered = await renderer.render(DOCGEN_TEMPLATES.QUOTATION_DOMESTIC, domesticPayload)
    const sheet = (await reopen(rendered.bytes)).getWorksheet('报价单')!
    const merges = sheet.model.merges

    // 模板里「币别」标签是 B13:C13、付款方式值区是 D15:L15；三行明细把它们推下两行
    expect(merges).toContain('B15:C15')
    expect(merges).toContain('D17:L17')
    // 备注列那个跨 9 行的竖向合并（A13:A21）也要整体下移
    expect(merges).toContain('A15:A23')
    expect(merges).not.toContain('A13:A21')
  })

  it('明细为空、模板行被删掉时，下方合并区跟着上移', async () => {
    const rendered = await renderer.render(DOCGEN_TEMPLATES.QUOTATION_DOMESTIC, {
      ...domesticPayload,
      items: [],
    })
    const sheet = (await reopen(rendered.bytes)).getWorksheet('报价单')!

    // 条款区整体上移一行；被删掉那一行自己的合并（B12:G12）必须清掉，
    // 否则搬上来的 B12:C12 会与它撞上而被静默丢弃
    expect(sheet.model.merges).toContain('B12:C12')
    expect(sheet.model.merges).toContain('A12:A20')
    expect(sheet.model.merges).not.toContain('B12:G12')
  })

  it('国内报价单：勾选标记只点亮命中的那一个', async () => {
    const rendered = await renderer.render(DOCGEN_TEMPLATES.QUOTATION_DOMESTIC, domesticPayload)
    const sheet = (await reopen(rendered.bytes)).getWorksheet('报价单')!

    // 模板里条款区从第 13 行起；三行明细把它整体推下两行
    expect(textOf(sheet, 'D15')).toBe('⊙RMB')
    expect(textOf(sheet, 'H15')).toBe('○USD')
    expect(textOf(sheet, 'K15')).toBe('○HKD')
    expect(textOf(sheet, 'D18')).toBe('○5%')
    expect(textOf(sheet, 'F18')).toBe('⊙3%')
    expect(textOf(sheet, 'D19')).toBe('⊙不退还')
    expect(textOf(sheet, 'F20')).toBe('⊙30天')
    // 一格里三个勾选标记混排也要各判各的
    expect(textOf(sheet, 'D17')).toBe('○现金　⊙月结30天　○预付货款')
  })

  it('国内报价单：填完不留任何标记', async () => {
    const rendered = await renderer.render(DOCGEN_TEMPLATES.QUOTATION_DOMESTIC, domesticPayload)
    const sheet = (await reopen(rendered.bytes)).getWorksheet('报价单')!
    expect(hasLeftoverMarkers(sheet)).toEqual([])
  })

  it('国外报价单：五档阶梯与模具费列都能落位', async () => {
    const rendered = await renderer.render(DOCGEN_TEMPLATES.QUOTATION_OVERSEAS, {
      quotedOn: '2026-08-11',
      customer: { name: 'Blackmagic Design', address: '180 Bank Street' },
      tierLabel1: 'Sample',
      tierLabel2: 100,
      tierLabel3: 500,
      tierLabel4: 1000,
      tierLabel5: null,
      items: [
        {
          productName: 'FLD-2014',
          revision: '1',
          material: 'AL6063',
          finishing: 'BLACK ANODISE',
          tier1: 13.5,
          tier2: 8.44,
          tier3: 7.09,
          tier4: 6.75,
          tier5: null,
          moldFee: 1200,
          remark: '',
        },
      ],
    })
    const sheet = (await reopen(rendered.bytes)).getWorksheet('Quotation')!

    expect(textOf(sheet, 'A13')).toBe('FLD-2014')
    expect(sheet.getCell('F13').value).toBe(13.5)
    expect(sheet.getCell('K13').value).toBe(1200)
    // 用不到的档位清空，而不是留下 {{tier5}}
    expect(textOf(sheet, 'J13')).toBe('')
    expect(hasLeftoverMarkers(sheet)).toEqual([])
  })

  it('成本分析：金额来自后端，模板里不再留公式', async () => {
    const rendered = await renderer.render(DOCGEN_TEMPLATES.COST_ANALYSIS_CNC, {
      customer: { name: '安费诺' },
      productModel: 'M26-P09',
      preparedOn: '2026-08-11',
      lossPercent: '5%',
      overheadPercent: '5%',
      vatPercent: '13%',
      processLabel1: '打磨去毛刺',
      processLabel2: '抛光',
      processLabel3: '表面处理',
      processLabel4: '镭雕丝印',
      processLabel5: '组合安装销钉',
      processLabel6: '全检包装运输',
      lines: [
        {
          blankType: '铝板料',
          drawingNo: 'BCM-2607',
          spec: '115*106*19',
          quantity: '1.000000',
          material: 'AL6061-T6',
          materialAmount: 29.87,
          machiningAmount: 180,
          subtotal: 246.5,
          totalWithTax: 278.55,
        },
      ],
    })
    const sheet = (await reopen(rendered.bytes)).getWorksheet('成本分析')!

    expect(textOf(sheet, 'A3')).toBe('客户名称：安费诺')
    expect(textOf(sheet, 'W4')).toBe('损耗（5%）')
    expect(sheet.getCell('M5').value).toBe(29.87)
    expect(sheet.getCell('AA5').value).toBe(278.55)
    // 明细行不能残留公式对象——复制行时行号不会跟着走，那会算出错数
    expect(typeof sheet.getCell('Y5').value).not.toBe('object')
  })

  it('一份明细都没有时，模板行被删掉而不是留一行标记', async () => {
    const rendered = await renderer.render(DOCGEN_TEMPLATES.STATEMENT, {
      docNo: 'STM-20260811-0001',
      customer: { name: '安费诺' },
      periodFrom: '2026-07-01',
      periodTo: '2026-07-31',
      basisLabel: '按出货',
      currency: 'CNY',
      owner: { name: '曾跃文' },
      lines: [],
      totals: {
        shipped: 0,
        deduction: 0,
        receivable: 0,
        customerClosing: 0,
        difference: 0,
      },
      differenceNote: '无差异',
    })
    const sheet = (await reopen(rendered.bytes)).getWorksheet('对账单')!
    expect(hasLeftoverMarkers(sheet)).toEqual([])
  })

  it('每一份登记的模板都读得开，且填完不留标记', async () => {
    for (const templateId of Object.keys(TEMPLATE_DEFINITIONS)) {
      const rendered = await renderer.render(templateId as never, {
        // 全部集合给空数组：模板行会被删掉，剩下的标记应全部落到空值
        items: [],
        lines: [],
        rows: [],
        elements: [],
        manifest: [],
      })
      expect(rendered.bytes.byteLength).toBeGreaterThan(0)

      const book = await reopen(rendered.bytes)
      for (const sheet of book.worksheets) {
        expect({ templateId, leftovers: hasLeftoverMarkers(sheet) }).toEqual({
          templateId,
          leftovers: [],
        })
      }
    }
  })
})

import {
  COMPLETENESS_MANIFEST,
  missingFieldsFor,
  missingFieldsForDossier,
  type CompletenessFacts,
} from '../constants/customs-completeness'
import {
  CUSTOMS_DOC_KIND_VALUES,
  DOC_KIND_BY_TEMPLATE,
  DOC_KIND_LABEL,
  DOC_KIND_TO_TEMPLATE,
  REQUIRED_FOR_DATA_PACK,
  isCustomsTemplateCode,
  requiresPostedShipment,
} from '../constants/customs-doc-kinds'

function complete(overrides: Partial<CompletenessFacts> = {}): CompletenessFacts {
  return {
    hsCode: '8302410000',
    goodsNameCn: '铝合金探头支架',
    goodsNameEn: 'Aluminium Probe Bracket',
    quantity: '1486.000000',
    unit: 'PCS',
    netWeight: '104.020',
    grossWeight: '128.500',
    packages: 12,
    incoterm: 'FOB 盐田',
    portOfLoading: '深圳盐田港',
    destination: 'Los Angeles, USA',
    destinationPortCode: 'USLAX',
    shippingMarks: 'RADEX/LA/2026-07/NO.1-12',
    exchangeRate: '7.152000',
    totalAmountMinor: 3_700_140n,
    ...overrides,
  }
}

describe('要素齐套清单', () => {
  it('五种文件都有各自的必填清单，一种不漏', () => {
    for (const kind of CUSTOMS_DOC_KIND_VALUES) {
      expect(COMPLETENESS_MANIFEST[kind].length).toBeGreaterThan(0)
    }
  })

  it('要素齐全时任何一种文件都不缺项', () => {
    for (const kind of CUSTOMS_DOC_KIND_VALUES) {
      expect(missingFieldsFor(kind, complete())).toEqual([])
    }
  })

  it('fixture CD1 缺的那两项正是唛头与目的港代码', () => {
    const missing = missingFieldsForDossier(
      ['DATA_PACK'],
      complete({ shippingMarks: null, destinationPortCode: null }),
    )
    expect(missing).toEqual(['目的港代码', '唛头 Shipping Marks'])
  })

  it('缺项报的是中文标签，不是英文字段名——这份清单要直接给业务员看', () => {
    const missing = missingFieldsFor('COMMERCIAL_INVOICE', complete({ hsCode: null }))
    expect(missing).toEqual(['HS 编码'])
  })

  it('空串与全空白都算没填', () => {
    expect(missingFieldsFor('CONTRACT', complete({ goodsNameEn: '' }))).toContain('英文品名')
    expect(missingFieldsFor('CONTRACT', complete({ goodsNameEn: '   ' }))).toContain('英文品名')
  })

  it('件数为 0 算没填——一票货不可能零件', () => {
    expect(missingFieldsFor('PACKING_LIST', complete({ packages: 0 }))).toContain('件数')
    expect(missingFieldsFor('PACKING_LIST', complete({ packages: -1 }))).toContain('件数')
  })

  it('总金额为 0 算没填', () => {
    expect(missingFieldsFor('CONTRACT', complete({ totalAmountMinor: 0n }))).toContain('总金额')
  })

  it('形式发票的清单最松：它在出货前开，那时重量与件数本来就还不知道', () => {
    const beforeShipping = complete({ netWeight: null, grossWeight: null, packages: null })
    expect(missingFieldsFor('PROFORMA_INVOICE', beforeShipping)).toEqual([])
    expect(missingFieldsFor('PACKING_LIST', beforeShipping)).toEqual(
      expect.arrayContaining(['净重', '毛重', '件数']),
    )
  })

  it('装箱单点名要唛头——没唛头的箱单到口岸对不上货', () => {
    expect(missingFieldsFor('PACKING_LIST', complete({ shippingMarks: null }))).toEqual([
      '唛头 Shipping Marks',
    ])
  })

  it('整包缺项去重，同一个字段不重复报三遍', () => {
    const missing = missingFieldsForDossier(
      ['COMMERCIAL_INVOICE', 'PACKING_LIST', 'CONTRACT'],
      complete({ quantity: null }),
    )
    expect(missing).toEqual(['数量'])
  })

  it('整包缺项保持清单里的原始顺序，便于逐项对照补齐', () => {
    const missing = missingFieldsForDossier(
      ['DATA_PACK'],
      complete({ hsCode: null, exchangeRate: null, shippingMarks: null }),
    )
    expect(missing).toEqual(['HS 编码', '唛头 Shipping Marks', '汇率'])
  })
})

describe('文件种类字典', () => {
  it('五种模板编码与枚举一一对应，来回转换不丢', () => {
    for (const kind of CUSTOMS_DOC_KIND_VALUES) {
      const template = DOC_KIND_TO_TEMPLATE[kind]
      expect(DOC_KIND_BY_TEMPLATE[template]).toBe(kind)
      expect(isCustomsTemplateCode(template)).toBe(true)
    }
  })

  it('形式发票与商业发票是两份不同的单据，不共用一个编码', () => {
    expect(DOC_KIND_TO_TEMPLATE.PROFORMA_INVOICE).not.toBe(DOC_KIND_TO_TEMPLATE.COMMERCIAL_INVOICE)
    expect(DOC_KIND_LABEL.PROFORMA_INVOICE).toContain('Proforma')
    expect(DOC_KIND_LABEL.COMMERCIAL_INVOICE).toContain('Commercial')
  })

  it('不认识的模板编码不放行', () => {
    expect(isCustomsTemplateCode('EXP-XXX')).toBe(false)
  })

  it('数据包必需件不含形式发票——它是收款工具，不是清关材料', () => {
    expect(REQUIRED_FOR_DATA_PACK).toEqual([
      'COMMERCIAL_INVOICE',
      'PACKING_LIST',
      'CONTRACT',
    ])
    expect(REQUIRED_FOR_DATA_PACK).not.toContain('PROFORMA_INVOICE')
  })

  it.each([
    ['COMMERCIAL_INVOICE', true],
    ['PACKING_LIST', true],
    ['DATA_PACK', true],
    ['PROFORMA_INVOICE', false],
    ['CONTRACT', false],
  ] as const)('%s 是否要求已过账 → %s', (kind, expected) => {
    expect(requiresPostedShipment(kind)).toBe(expected)
  })
})

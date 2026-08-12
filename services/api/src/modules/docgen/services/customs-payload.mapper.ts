import { DOC_KIND_LABEL } from '../../customs'

import { decimalToNumber, minorToNumber, toDateText } from './money-format'

import type { CustomsDossierRecord } from '../../customs'
import type { CustomsDocKind } from '@prisma/client'

/**
 * 报关资料 → 四份文件的模板数据。
 *
 * 一份资料包一条商品明细（`CustomsDossierRecord` 上的 hsCode / 品名 / 数量都是单条），
 * 因此 `lines` 恒为一行。仍然做成数组而不是摊平到表头：报关明细多行是迟早的事
 * （一票多品名的拼柜），到那天改的是取数，模板与引擎一行都不用动。
 *
 * 汇率一律取**这一版文件自己的快照**，不取资料包表头上的当前汇率——
 * 同一个包里先后出的两份文件汇率本来就可以不同，那不是 bug。
 */

export interface CustomsNaming {
  customerName: string
  customerAddress: string
  shipmentNo: string
  orderNo: string
  paymentTerms: string
}

/** 出具某一版文件所需的版本级事实。 */
export interface CustomsDocumentFacts {
  kind: CustomsDocKind
  version: number
  /** 该版出具时的汇率快照 */
  exchangeRate: string
  issuedOn: Date
}

export function toCustomsPayload(
  record: CustomsDossierRecord,
  facts: CustomsDocumentFacts,
  naming: CustomsNaming,
): Record<string, unknown> {
  const label = DOC_KIND_LABEL[facts.kind]
  const [chinese, ...english] = label.split(' ')

  return {
    docNo: record.docNo,
    docTitleCn: chinese ?? label,
    docTitleEn: english.join(' '),
    version: facts.version,
    issuedOn: toDateText(facts.issuedOn),
    currency: record.currency,
    exchangeRate: facts.exchangeRate,
    tradeMode: record.tradeMode,
    incoterm: record.incoterm,
    portOfLoading: record.portOfLoading,
    destination: record.destination,
    destinationPortCode: record.destinationPortCode ?? '',
    shippingMarks: record.shippingMarks ?? '',
    netWeight: decimalToNumber(record.netWeight),
    grossWeight: decimalToNumber(record.grossWeight),
    packages: record.packages,
    totalAmount: minorToNumber(record.totalAmountMinor),
    shipmentNo: naming.shipmentNo,
    orderNo: naming.orderNo,
    paymentTerms: naming.paymentTerms,
    declarationVersion: record.declarationVersion,
    customer: { name: naming.customerName, address: naming.customerAddress },
    lines: [
      {
        description: descriptionOf(record),
        hsCode: record.hsCode,
        quantity: decimalToNumber(record.quantity),
        unit: record.unit,
        unitPrice: minorToNumber(record.unitPriceMinor),
        amount: minorToNumber(record.totalAmountMinor),
        packages: record.packages,
        netWeight: decimalToNumber(record.netWeight),
        grossWeight: decimalToNumber(record.grossWeight),
        measurement: '',
        remark: '',
      },
    ],
    elements: declarationElements(record),
    manifest: manifestRows(record),
  }
}

/** 中英双语品名。只有中文时不留一个孤零零的分隔符。 */
function descriptionOf(record: CustomsDossierRecord): string {
  return record.goodsNameEn ? `${record.goodsNameCn}\n${record.goodsNameEn}` : record.goodsNameCn
}

/** 报关单要素表的要素行。标签用中文，与服务端齐套清单同一套说法。 */
function declarationElements(record: CustomsDossierRecord): Array<Record<string, unknown>> {
  return [
    { label: 'HS 编码', value: record.hsCode, unit: '', amount: null, remark: '' },
    { label: '中文品名', value: record.goodsNameCn, unit: '', amount: null, remark: '' },
    { label: '英文品名', value: record.goodsNameEn ?? '', unit: '', amount: null, remark: '' },
    { label: '贸易方式', value: record.tradeMode, unit: '', amount: null, remark: '' },
    { label: '成交方式', value: record.incoterm, unit: '', amount: null, remark: '' },
    { label: '启运港', value: record.portOfLoading, unit: '', amount: null, remark: '' },
    {
      label: '目的港代码',
      value: record.destinationPortCode ?? '',
      unit: '',
      amount: null,
      remark: record.destination,
    },
    {
      label: '唛头 Shipping Marks',
      value: record.shippingMarks ?? '',
      unit: '',
      amount: null,
      remark: '',
    },
    {
      label: '数量',
      value: '',
      unit: record.unit,
      amount: decimalToNumber(record.quantity),
      remark: '',
    },
    { label: '净重', value: '', unit: 'KG', amount: decimalToNumber(record.netWeight), remark: '' },
    {
      label: '毛重',
      value: '',
      unit: 'KG',
      amount: decimalToNumber(record.grossWeight),
      remark: '',
    },
    { label: '件数', value: '', unit: '件', amount: record.packages, remark: '' },
    {
      label: '总价',
      value: record.currency,
      unit: '',
      amount: minorToNumber(record.totalAmountMinor),
      remark: `汇率 ${record.exchangeRate}`,
    },
  ]
}

/**
 * 随附单证清单：**取各种文件的当前最高版**。
 *
 * 不取申报快照里的清单，因为数据包是在申报**之前**出的——
 * 申报冻结的正是这份数据包所列的内容，顺序反过来就成了循环引用。
 */
function manifestRows(record: CustomsDossierRecord): Array<Record<string, unknown>> {
  const latest = new Map<CustomsDocKind, CustomsDossierRecord['documents'][number]>()
  for (const document of record.documents) {
    const current = latest.get(document.kind)
    if (!current || document.version > current.version) latest.set(document.kind, document)
  }

  return [...latest.values()]
    .filter((document) => document.kind !== 'DATA_PACK')
    .sort((left, right) => left.kind.localeCompare(right.kind))
    .map((document) => ({
      templateCode: document.kind,
      name: DOC_KIND_LABEL[document.kind],
      version: `V${document.version}`,
      issuedOn: toDateText(document.generatedAt),
      remark: '',
    }))
}

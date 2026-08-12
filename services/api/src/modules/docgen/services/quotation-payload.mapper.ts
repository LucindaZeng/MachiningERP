import { TEMPLATE_DEFINITIONS, type DocgenTemplateId } from '../constants/template-registry'

import { decimalToNumber, minorToNumber, toDateText } from './money-format'

import type { QuotationRecord, QuotationItemRecord } from '../../quotation'

/**
 * 报价单记录 → 模板数据。
 *
 * 阶梯价是这里唯一有点绕的地方：数据模型里档数不限，而模板上的列数是**固定的**
 * （国内两列、国外五列，见 template-registry 的 `tierColumns`）。
 * 超出的档位**不出现在这份模板上**——这是模板的限制不是引擎的限制，
 * 所以判断留在这里，并在出具记录之外原样保留完整档位供页面查看。
 */

/** 出具报价单需要的周边信息，由调用方（facade）从各自模块取好传进来。 */
export interface QuotationNaming {
  customerName: string
  customerContact: string | null
  customerPhone: string | null
  customerFax: string | null
  customerEmail: string | null
  customerAddress: string | null
  ownerName: string
  ownerPhone: string | null
  ownerEmail: string | null
}

export function toQuotationPayload(
  record: QuotationRecord,
  naming: QuotationNaming,
  templateId: DocgenTemplateId,
  issuedOn: Date,
): Record<string, unknown> {
  const columns = TEMPLATE_DEFINITIONS[templateId].tierColumns ?? 0
  const labels = tierLabels(record, columns)

  return {
    docNo: record.docNo,
    version: record.version,
    quotedOn: toDateText(issuedOn),
    currency: record.currency,
    validDays: validDaysOf(record, issuedOn),
    validUntil: toDateText(record.validUntil),
    customer: {
      name: naming.customerName,
      contact: naming.customerContact ?? '',
      phone: naming.customerPhone ?? '',
      fax: naming.customerFax ?? '',
      email: naming.customerEmail ?? '',
      address: naming.customerAddress ?? '',
    },
    owner: {
      name: naming.ownerName,
      phone: naming.ownerPhone ?? '',
      email: naming.ownerEmail ?? '',
    },
    terms: {
      processingMode: record.terms?.processingMode ?? '',
      paymentTerms: record.terms?.paymentTerms ?? '',
      allowedScrapBps: record.terms?.allowedScrapBps ?? '',
      // 布尔要按字符串比：勾选标记的期望值写在模板里，是文本
      scrapReturned: String(record.terms?.scrapReturned ?? false),
      leadTime: record.terms?.leadTime ?? '',
      remark: record.terms?.remark ?? '',
    },
    ...labels,
    items: record.items.map((item) => toItemRow(item, record, columns)),
  }
}

/** 档位表头：`MOQ:{{tierLabel1}}`。取第一条明细的档位——同一份报价的档位是齐的。 */
function tierLabels(record: QuotationRecord, columns: number): Record<string, unknown> {
  const first = record.items[0]
  const labels: Record<string, unknown> = {}
  for (let index = 0; index < columns; index += 1) {
    const tier = first?.tiers[index]
    labels[`tierLabel${index + 1}`] =
      tier === undefined ? null : (tier.label ?? decimalToNumber(tier.minQuantity))
  }
  return labels
}

function toItemRow(
  item: QuotationItemRecord,
  record: QuotationRecord,
  columns: number,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    productName: item.productName,
    drawingNo: item.drawingNo,
    revision: item.revision ?? '',
    material: item.material ?? '',
    finishing: item.finishing ?? '',
    process: item.process ?? '',
    remark: item.remark ?? '',
    // 模具费单列、不摊进单价（quotation 的既定口径），因此挂在每一行上原样带出
    moldFee: minorToNumber(record.moldFeeMinor),
  }

  for (let index = 0; index < columns; index += 1) {
    const tier = item.tiers[index]
    row[`tier${index + 1}`] = tier === undefined ? null : minorToNumber(tier.unitPriceMinor)
  }

  return row
}

/** 有效期天数，用于条款区的 15/30/60 勾选。没写 validUntil 时不勾任何一个。 */
function validDaysOf(record: QuotationRecord, issuedOn: Date): number | '' {
  if (!record.validUntil) return ''
  const days = Math.round((record.validUntil.getTime() - issuedOn.getTime()) / 86_400_000)
  return days
}

/** 合并比较表用的摊平行：一个档位一行。 */
export function toQuotationMergeRows(
  record: QuotationRecord,
  customerName: string,
  statusLabel: string,
): Array<Record<string, unknown>> {
  return record.items.flatMap((item) =>
    item.tiers.map((tier) => ({
      docNo: record.docNo,
      version: record.version,
      customerName,
      statusLabel,
      productName: item.productName,
      drawingNo: item.drawingNo,
      material: item.material ?? '',
      minQuantity: decimalToNumber(tier.minQuantity),
      unitPrice: minorToNumber(tier.unitPriceMinor),
      currency: record.currency,
      moldFee: minorToNumber(record.moldFeeMinor),
      validUntil: toDateText(record.validUntil),
    })),
  )
}

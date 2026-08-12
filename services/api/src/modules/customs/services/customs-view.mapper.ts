import { fromMinor, type CurrencyCode } from '@machining-erp/shared'

import { missingFieldsForDossier } from '../constants/customs-completeness'
import {
  CUSTOMS_DOC_KIND_VALUES,
  DOC_KIND_LABEL,
  DOC_KIND_TO_TEMPLATE,
} from '../constants/customs-doc-kinds'
import { CUSTOMS_STATUS_TO_WIRE } from '../constants/customs-filters'

import { currentVersionOf } from './customs-version.rules'
import { completenessFactsOf } from './customs.service'

import type { DocTimelineNodeView } from '../../shipment'
import type { CustomsCorrectionView } from '../dto/customs-correction-view.dto'
import type { CustomsDeclarationView } from '../dto/customs-declaration-view.dto'
import type { CustomsDocumentView } from '../dto/customs-document-view.dto'
import type { CustomsDossierView } from '../dto/customs-dossier-view.dto'
import type {
  CustomsDocumentRecord,
  CustomsDossierRecord,
} from '../repositories/customs.repository.port'
import type { CustomsDocKind } from '@prisma/client'

/** 单据号、客户名、业务员姓名都在别的模块里，由调用方查好传进来。 */
export interface CustomsNaming {
  shipmentNo: string
  orderNo: string
  customerName: string
  ownerName: string
}

/** fixture 用 '—' 表示尚未生成；照它来，前端不用为空值另写分支。 */
const NOT_GENERATED = '—'

function latestOf(
  documents: readonly CustomsDocumentRecord[],
  kind: CustomsDocKind,
): CustomsDocumentRecord | null {
  const version = currentVersionOf(documents, kind)
  return documents.find((doc) => doc.kind === kind && doc.version === version) ?? null
}

/**
 * 五种文件**恒定各占一格**，没生成过的显示 '—'。
 *
 * 为什么不只列已生成的：界面上这张表同时是一份「还差什么」的清单。
 * 只列已生成的，缺哪份就得靠人对照记忆去数。
 */
function toDocumentViews(documents: readonly CustomsDocumentRecord[]): CustomsDocumentView[] {
  return CUSTOMS_DOC_KIND_VALUES.map((kind) => {
    const latest = latestOf(documents, kind)
    const view: CustomsDocumentView = {
      templateCode: DOC_KIND_TO_TEMPLATE[kind],
      name: DOC_KIND_LABEL[kind],
      version: latest ? `V${latest.version}` : NOT_GENERATED,
    }

    if (!latest) return view

    view.versionNo = latest.version
    view.documentId = latest.id
    view.exchangeRate = latest.exchangeRate
    view.generatedAt = latest.generatedAt.toISOString()
    // 版本已登记但文件还没出来（docgen 接入前）——前端据此禁用下载与预览
    if (!latest.objectKey) view.pending = true

    return view
  })
}

function toDeclarationViews(record: CustomsDossierRecord): CustomsDeclarationView[] {
  return record.declarations
    .map((declaration) => {
      const view: CustomsDeclarationView = {
        version: declaration.version,
        declaredAt: declaration.declaredAt.toISOString(),
        declaredBy: declaration.declaredBy,
        manifest: declaration.lines.map((line) => ({
          templateCode: DOC_KIND_TO_TEMPLATE[line.kind],
          name: DOC_KIND_LABEL[line.kind],
          version: line.version,
        })),
      }
      if (declaration.receiptNo) view.receiptNo = declaration.receiptNo
      if (declaration.receiptAt) view.receiptAt = declaration.receiptAt.toISOString()
      return view
    })
    .sort((left, right) => left.version - right.version)
}

function toCorrectionViews(record: CustomsDossierRecord): CustomsCorrectionView[] {
  return record.corrections
    .map((correction) => ({
      seq: correction.sequence,
      reason: correction.reason,
      affectedDocuments: correction.lines.map((line) => ({
        templateCode: DOC_KIND_TO_TEMPLATE[line.kind],
        name: DOC_KIND_LABEL[line.kind],
        fromVersion: line.fromVersion,
        toVersion: line.toVersion,
      })),
      resultingDeclarationVersion: correction.resultingDeclarationVersion,
      createdBy: correction.createdBy,
      createdAt: correction.createdAt.toISOString(),
    }))
    .sort((left, right) => left.seq - right.seq)
}

/**
 * `missingFields` 在这里**现算，不落库**。
 *
 * 落一份下来就会腐坏：改了目的港代码而没重算，界面就还挂着一条已经补上的缺项，
 * 或者更糟——已经不齐套了却还显示齐套。取数据包所需要素的并集，
 * 与生成端点那道硬闸门读的是同一张清单。
 */
export function toCustomsDossierView(
  record: CustomsDossierRecord,
  naming: CustomsNaming,
  timeline: DocTimelineNodeView[] = [],
): CustomsDossierView {
  const currency = record.currency as CurrencyCode

  const view: CustomsDossierView = {
    id: record.id,
    docNo: record.docNo,
    shipmentNo: naming.shipmentNo,
    orderNo: naming.orderNo,
    customerName: naming.customerName,
    tradeMode: record.tradeMode,
    incoterm: record.incoterm,
    portOfLoading: record.portOfLoading,
    destination: record.destination,
    hsCode: record.hsCode,
    goodsNameCn: record.goodsNameCn,
    goodsNameEn: record.goodsNameEn ?? '',
    quantity: record.quantity,
    unit: record.unit,
    netWeight: record.netWeight,
    grossWeight: record.grossWeight,
    packages: String(record.packages),
    unitPrice: fromMinor({ minor: record.unitPriceMinor, currency }).amount,
    totalAmount: fromMinor({ minor: record.totalAmountMinor, currency }),
    exchangeRate: record.exchangeRate,
    status: CUSTOMS_STATUS_TO_WIRE[record.status],
    owner: naming.ownerName,
    documents: toDocumentViews(record.documents),
    missingFields: missingFieldsForDossier(['DATA_PACK'], completenessFactsOf(record)),
    versionLock: record.versionLock,
  }

  if (record.checkedBy) view.checkedBy = record.checkedBy
  if (record.shippingMarks) view.shippingMarks = record.shippingMarks
  if (record.destinationPortCode) view.destinationPortCode = record.destinationPortCode
  if (record.declarationVersion > 0) view.declarationVersion = record.declarationVersion
  if (record.declarations.length > 0) view.declarations = toDeclarationViews(record)
  if (record.corrections.length > 0) view.corrections = toCorrectionViews(record)
  if (timeline.length > 0) view.timeline = timeline

  return view
}

import { BizError } from '../../biz-error'

import { CUSTOMS_DOSSIERS } from './fulfilment.fixture'

import type { CustomsDossier } from '@/types/sales.types'

/**
 * 报关资料的 mock 路由。规则与后端保持镜像，尤其是那两道硬闸门：
 * 要素不齐禁止生成、关务未复核禁止申报——**mock 通过不代表真实环境通过**，
 * 但至少不让明显不该放行的操作在原型上过去。
 */

/** 模板编码 ↔ 文件种类，与后端 DOC_KIND_TO_TEMPLATE 同一张表。 */
const TEMPLATE_BY_KIND: Record<string, string> = {
  PROFORMA_INVOICE: 'EXP-PIN',
  COMMERCIAL_INVOICE: 'EXP-INV',
  PACKING_LIST: 'EXP-PKL',
  CONTRACT: 'EXP-CON',
  DATA_PACK: 'EXP-DEC',
}

/** 数据包必需件；形式发票不在其中——它是按需出具的收款工具，不是清关材料。 */
const REQUIRED_FOR_PACK = ['EXP-INV', 'EXP-PKL', 'EXP-CON']

function findDossier(id: string | undefined): CustomsDossier {
  const record = CUSTOMS_DOSSIERS.find((item) => item.id === id || item.docNo === id)
  if (!record) {
    throw new BizError({ code: 'ORD_2900', message: '报关资料不存在', status: 404 })
  }
  return record
}

function patchDossier(id: string | undefined, patch: Partial<CustomsDossier>): CustomsDossier {
  const record = findDossier(id)
  Object.assign(record, patch)
  return record
}

/** 要素齐套是硬闸门，与后端 assertFieldsComplete 同一条规则。 */
function assertComplete(record: CustomsDossier): void {
  if (record.missingFields.length === 0) return
  throw new BizError({
    code: 'ORD_2904',
    message: `报关要素未齐套，缺失：${record.missingFields.join('、')}`,
    status: 422,
  })
}

/**
 * 出具一份文件的新版本。**永远是追加**：mock 下就地把版本号 +1，
 * 与后端「旧版原样留着」的语义一致（原型不展示历史版本，故只更新展示值）。
 */
function generateDocument(id: string | undefined, body: { kind?: string }): CustomsDossier {
  const record = findDossier(id)
  assertComplete(record)

  const templateCode = TEMPLATE_BY_KIND[body.kind ?? '']
  const doc = record.documents.find((item) => item.templateCode === templateCode)
  if (!doc) {
    throw new BizError({ code: 'ORD_2906', message: '该报关文件尚未定义', status: 404 })
  }

  if (templateCode === 'EXP-DEC') {
    const missing = REQUIRED_FOR_PACK.filter(
      (code) => !record.documents.find((item) => item.templateCode === code)?.generatedAt,
    )
    if (missing.length > 0) {
      throw new BizError({
        code: 'ORD_2907',
        message: '商业发票、装箱单、出口合同齐备后才能生成报关数据包',
        status: 422,
      })
    }
  }

  const current = Number(doc.version.replace('V', '')) || 0
  doc.versionNo = current + 1
  doc.version = `V${doc.versionNo}`
  doc.generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ')
  doc.exchangeRate = record.exchangeRate
  // mock 下不真的出文件——与 docgen 未接入时的后端语义一致
  doc.pending = true

  record.status = 'generated'
  return record
}

/** 关务复核不可跳过：没有复核人就不许申报，与后端 assertReviewed 同一条规则。 */
function declareDossier(id: string | undefined): CustomsDossier {
  const record = findDossier(id)
  if (!record.checkedBy) {
    throw new BizError({
      code: 'ORD_2908',
      message: '报关资料必须经关务复核后才能申报',
      status: 409,
    })
  }

  const version = (record.declarationVersion ?? 0) + 1
  record.declarationVersion = version
  record.declarations = [
    ...(record.declarations ?? []),
    {
      version,
      declaredAt: new Date().toISOString(),
      declaredBy: '关务 · 吴敏',
      manifest: record.documents
        .filter((doc) => doc.generatedAt)
        .map((doc) => ({
          templateCode: doc.templateCode,
          name: doc.name,
          version: doc.versionNo ?? 1,
        })),
    },
  ]
  record.status = 'declared'
  return record
}

/** 更正必须写理由——已申报资料是对海关的正式陈述。 */
function correctDossier(id: string | undefined, body: { reason?: string }): CustomsDossier {
  const record = findDossier(id)
  const reason = body.reason?.trim()
  if (!reason) {
    throw new BizError({
      code: 'ORD_2910',
      message: '更正已申报的报关资料必须写明理由',
      status: 422,
    })
  }
  if (!record.declarationVersion) {
    throw new BizError({
      code: 'ORD_2911',
      message: '尚未申报的资料无需走更正流程，直接重新生成即可',
      status: 409,
    })
  }

  const version = record.declarationVersion + 1
  record.corrections = [
    ...(record.corrections ?? []),
    {
      seq: (record.corrections?.length ?? 0) + 1,
      reason,
      affectedDocuments: [],
      resultingDeclarationVersion: version,
      createdBy: '关务 · 吴敏',
      createdAt: new Date().toISOString(),
    },
  ]
  record.declarationVersion = version
  return record
}

/**
 * EXP-01 建档的本地兜底。客户、订单与币种在真实环境里由服务端从出货单带出，
 * 本地没有出货单可查，因此填成占位值并写明——**不要**让原型看起来像是
 * 真的从出货单带出来了，那会让人以为这条链路已经验证过。
 */
function createDossier(body: unknown): CustomsDossier {
  const input = (body ?? {}) as Record<string, string | number | undefined>
  const sequence = CUSTOMS_DOSSIERS.length + 1
  const record: CustomsDossier = {
    id: `CD-LOCAL-${sequence}`,
    docNo: `EXP-LOCAL-${String(sequence).padStart(4, '0')}`,
    shipmentNo: String(input.shipmentId ?? '（本地占位）'),
    orderNo: '（本地占位，真实环境由出货单带出）',
    customerName: '（本地占位，真实环境由出货单带出）',
    tradeMode: String(input.tradeMode ?? ''),
    incoterm: String(input.incoterm ?? ''),
    portOfLoading: String(input.portOfLoading ?? ''),
    destination: String(input.destination ?? ''),
    destinationPortCode: input.destinationPortCode ? String(input.destinationPortCode) : undefined,
    shippingMarks: input.shippingMarks ? String(input.shippingMarks) : undefined,
    hsCode: String(input.hsCode ?? ''),
    goodsNameCn: String(input.goodsNameCn ?? ''),
    goodsNameEn: String(input.goodsNameEn ?? ''),
    quantity: String(input.quantity ?? '0'),
    unit: String(input.unit ?? 'PCS'),
    netWeight: String(input.netWeight ?? '0'),
    grossWeight: String(input.grossWeight ?? '0'),
    packages: String(input.packages ?? '0'),
    unitPrice: String(input.unitPriceMinor ?? '0'),
    totalAmount: { amount: String(input.totalAmountMinor ?? '0'), currency: 'USD' },
    exchangeRate: String(input.exchangeRate ?? ''),
    status: 'draft',
    owner: '业务 · 本地',
    documents: Object.values(TEMPLATE_BY_KIND).map((templateCode) => ({
      templateCode,
      name: DOC_NAME_BY_TEMPLATE[templateCode] ?? templateCode,
      version: '—',
    })),
    // 齐套判定与后端同一套：目的港代码与唛头缺一不可
    missingFields: [
      ...(input.destinationPortCode ? [] : ['目的港代码']),
      ...(input.shippingMarks ? [] : ['唛头 Shipping Marks']),
    ],
    declarationVersion: 0,
    declarations: [],
    corrections: [],
    versionLock: 0,
  }
  CUSTOMS_DOSSIERS.push(record)
  return record
}

/** 五个文件位的中文名，与 fixture 里的写法一致（形式发票与商业发票是两份不同的单据）。 */
const DOC_NAME_BY_TEMPLATE: Record<string, string> = {
  'EXP-PIN': '形式发票 Proforma Invoice',
  'EXP-INV': '商业发票 Commercial Invoice',
  'EXP-PKL': '装箱单 Packing List',
  'EXP-CON': '出口合同 Sales Contract',
  'EXP-DEC': '报关单要素表',
}

export const CUSTOMS_ROUTES: Array<{
  path: string
  handle: (params: string[], body: unknown) => unknown
}> = [
  { path: 'GET /customs-dossiers/:id', handle: ([id]) => findDossier(id) },
  { path: 'POST /customs-dossiers', handle: (_params, body) => createDossier(body) },
  {
    path: 'POST /customs-dossiers/:id/documents',
    handle: ([id], body) => generateDocument(id, body as { kind?: string }),
  },
  {
    path: 'POST /customs-dossiers/:id/submit-review',
    handle: ([id]) => patchDossier(id, { status: 'checking' }),
  },
  {
    path: 'POST /customs-dossiers/:id/approve-review',
    handle: ([id]) => patchDossier(id, { status: 'generated', checkedBy: '关务 · 吴敏' }),
  },
  {
    path: 'POST /customs-dossiers/:id/return-for-fix',
    handle: ([id]) => patchDossier(id, { status: 'checking', checkedBy: undefined }),
  },
  { path: 'POST /customs-dossiers/:id/declare', handle: ([id]) => declareDossier(id) },
  {
    path: 'POST /customs-dossiers/:id/correct',
    handle: ([id], body) => correctDossier(id, body as { reason?: string }),
  },
  {
    path: 'POST /customs-dossiers/:id/receipt',
    handle: ([id], body) => {
      const record = findDossier(id)
      const target = record.declarations?.find((item) => item.version === record.declarationVersion)
      if (target) {
        target.receiptNo = (body as { receiptNo?: string }).receiptNo
        target.receiptAt = new Date().toISOString()
      }
      return record
    },
  },
  {
    path: 'POST /customs-dossiers/:id/release',
    handle: ([id]) => patchDossier(id, { status: 'released' }),
  },
]

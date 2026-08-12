import type { CustomsDocKind } from '@prisma/client'

/**
 * 要素齐套清单（业务规格第 10 章 · 外贸主数据）。
 *
 * **这是一道服务端硬闸门**，不是给界面看的提示：页面拿到 `missingFields` 只是提前
 * 把生成按钮灰掉，真正拦人的是生成端点自己再查一遍。理由与图纸必传那条一样——
 * 前端能算的东西，前端就能绕过。
 *
 * 字段名用中文标签而不是英文 key：这份清单会原样显示给业务员看
 * （development-guide §4「面向使用者的文案一律中文」）。
 */

/** 齐套校验读的事实。只列校验要用的字段，与仓储记录解耦，便于单测。 */
export interface CompletenessFacts {
  hsCode: string | null
  goodsNameCn: string | null
  goodsNameEn: string | null
  quantity: string | null
  unit: string | null
  netWeight: string | null
  grossWeight: string | null
  packages: number | null
  incoterm: string | null
  portOfLoading: string | null
  destination: string | null
  destinationPortCode: string | null
  shippingMarks: string | null
  exchangeRate: string | null
  totalAmountMinor: bigint | null
}

type FactKey = keyof CompletenessFacts

interface RequiredField {
  key: FactKey
  label: string
}

/** 所有可能被点名的字段与它们的中文标签，集中一处，避免同一字段两处两种叫法。 */
const FIELD_LABELS = {
  hsCode: 'HS 编码',
  goodsNameCn: '中文品名',
  goodsNameEn: '英文品名',
  quantity: '数量',
  unit: '单位',
  netWeight: '净重',
  grossWeight: '毛重',
  packages: '件数',
  incoterm: '贸易术语',
  portOfLoading: '启运港',
  destination: '目的地',
  destinationPortCode: '目的港代码',
  shippingMarks: '唛头 Shipping Marks',
  exchangeRate: '汇率',
  totalAmountMinor: '总金额',
} as const satisfies Record<FactKey, string>

function fields(...keys: FactKey[]): RequiredField[] {
  return keys.map((key) => ({ key, label: FIELD_LABELS[key] }))
}

/**
 * 逐种文件各有各的必填清单——一份合同用不着毛重，一份箱单离了毛重没法清关。
 *
 * 形式发票的清单最松（决策一）：它在出货前开，重量与件数那时本来就还不知道。
 */
export const COMPLETENESS_MANIFEST: Record<CustomsDocKind, readonly RequiredField[]> = {
  PROFORMA_INVOICE: fields(
    'goodsNameEn',
    'quantity',
    'unit',
    'incoterm',
    'exchangeRate',
    'totalAmountMinor',
  ),
  COMMERCIAL_INVOICE: fields(
    'hsCode',
    'goodsNameCn',
    'goodsNameEn',
    'quantity',
    'unit',
    'incoterm',
    'destination',
    'exchangeRate',
    'totalAmountMinor',
  ),
  PACKING_LIST: fields(
    'goodsNameEn',
    'quantity',
    'unit',
    'netWeight',
    'grossWeight',
    'packages',
    'shippingMarks',
  ),
  CONTRACT: fields('goodsNameEn', 'quantity', 'unit', 'incoterm', 'totalAmountMinor'),
  DATA_PACK: fields(
    'hsCode',
    'goodsNameCn',
    'goodsNameEn',
    'quantity',
    'unit',
    'netWeight',
    'grossWeight',
    'packages',
    'incoterm',
    'portOfLoading',
    'destination',
    'destinationPortCode',
    'shippingMarks',
    'exchangeRate',
  ),
}

/** 空串、空白串、null 一律算没填；0 件数同样算没填（一票货不可能零件）。 */
function isBlank(value: CompletenessFacts[FactKey]): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (typeof value === 'number') return value <= 0
  if (typeof value === 'bigint') return value <= 0n
  return false
}

/** 某一种文件还缺哪些要素（中文标签）。齐套时返回空数组。 */
export function missingFieldsFor(
  kind: CustomsDocKind,
  facts: CompletenessFacts,
): string[] {
  return COMPLETENESS_MANIFEST[kind]
    .filter((field) => isBlank(facts[field.key]))
    .map((field) => field.label)
}

/**
 * 整包资料还缺哪些要素——取数据包所需文件的并集，**去重后保持清单里的原始顺序**。
 *
 * 用并集而不是取最严那一份：业务员要的是「把这些补齐我就能出整包」，
 * 逐份文件报一遍会让同一个字段出现三次。
 */
export function missingFieldsForDossier(
  kinds: readonly CustomsDocKind[],
  facts: CompletenessFacts,
): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const kind of kinds) {
    for (const label of missingFieldsFor(kind, facts)) {
      if (seen.has(label)) continue
      seen.add(label)
      result.push(label)
    }
  }

  return result
}

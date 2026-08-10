import { AUTH_ERRORS } from '../auth-error-codes'
import { BOM_ERRORS } from '../bom-error-codes'
import { CUSTOMER_ERRORS } from '../customer-error-codes'
import { ERROR_SEGMENTS } from '../error-segment'
import { FILE_PREVIEW_ERRORS } from '../file-preview-error-codes'
import { INVOICE_ERRORS } from '../invoice-error-codes'
import { ORDER_ERRORS } from '../order-error-codes'
import { QUOTATION_ERRORS } from '../quotation-error-codes'
import { SALES_RETURN_ERRORS } from '../sales-return-error-codes'
import { SHIPMENT_ERRORS, STATEMENT_ERRORS } from '../shipment-error-codes'
import { SYSTEM_ERRORS } from '../system-error-codes'
import { UPLOAD_ERRORS } from '../upload-error-codes'

import type { BizErrorDefinition } from '../error-segment'

/**
 * 错误码是对外契约的一部分：前端按 code 分支，重复码等于两件不同的事共用一个身份。
 *
 * 这条测试是在真出过一次重号之后补的——出货模块开在 ORD_22xx，
 * 与报价模块既有的 ORD_22xx 撞了整整五个码，而两边各自的单测都是绿的，
 * 因为谁都只看自己那一段。全局唯一性只能全局校验。
 */
const ALL_DICTIONARIES: ReadonlyArray<[string, Record<string, BizErrorDefinition>]> = [
  ['AUTH_ERRORS', AUTH_ERRORS],
  ['CUSTOMER_ERRORS', CUSTOMER_ERRORS],
  ['QUOTATION_ERRORS', QUOTATION_ERRORS],
  ['ORDER_ERRORS', ORDER_ERRORS],
  ['BOM_ERRORS', BOM_ERRORS],
  ['INVOICE_ERRORS', INVOICE_ERRORS],
  ['SALES_RETURN_ERRORS', SALES_RETURN_ERRORS],
  ['SHIPMENT_ERRORS', SHIPMENT_ERRORS],
  ['STATEMENT_ERRORS', STATEMENT_ERRORS],
  ['FILE_PREVIEW_ERRORS', FILE_PREVIEW_ERRORS],
  ['UPLOAD_ERRORS', UPLOAD_ERRORS],
  ['SYSTEM_ERRORS', SYSTEM_ERRORS],
]

function allEntries(): Array<{ dictionary: string; key: string; definition: BizErrorDefinition }> {
  return ALL_DICTIONARIES.flatMap(([dictionary, dict]) =>
    Object.entries(dict).map(([key, definition]) => ({ dictionary, key, definition })),
  )
}

describe('错误码全局唯一', () => {
  it('没有任何一个 code 被两个字典同时占用', () => {
    const owners = new Map<string, string[]>()

    for (const entry of allEntries()) {
      const list = owners.get(entry.definition.code) ?? []
      list.push(`${entry.dictionary}.${entry.key}`)
      owners.set(entry.definition.code, list)
    }

    const collisions = [...owners.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([code, list]) => `${code} 被 ${list.join(' 与 ')} 同时占用`)

    expect(collisions).toEqual([])
  })
})

describe('错误码格式与分段', () => {
  const SEGMENTS = new Set<string>(Object.values(ERROR_SEGMENTS))

  it('一律是「分段_四位数字」', () => {
    const malformed = allEntries()
      .filter((entry) => !/^[A-Z]+_\d{4}$/.test(entry.definition.code))
      .map((entry) => `${entry.dictionary}.${entry.key} = ${entry.definition.code}`)

    expect(malformed).toEqual([])
  })

  it('分段前缀必须在 ERROR_SEGMENTS 里注册过', () => {
    const unknown = allEntries()
      .filter((entry) => !SEGMENTS.has(entry.definition.code.split('_')[0] ?? ''))
      .map((entry) => `${entry.dictionary}.${entry.key} = ${entry.definition.code}`)

    expect(unknown).toEqual([])
  })

  /**
   * 只校验「是个合法的 HTTP 状态码」，不写死允许清单——
   * 202（变更已受理待审批）、423（账户锁定）都是有意为之的选择，
   * 一份手写白名单只会逼着后来人为了过测试去改本来正确的语义。
   */
  it('HTTP 状态码是合法值', () => {
    const odd = allEntries()
      .filter((entry) => !Number.isInteger(entry.definition.status))
      .concat(allEntries().filter((entry) => entry.definition.status < 200 || entry.definition.status > 599))
      .map((entry) => `${entry.dictionary}.${entry.key} = ${entry.definition.status}`)

    expect(odd).toEqual([])
  })

  it('每条都有非空中文文案', () => {
    const blank = allEntries()
      .filter((entry) => entry.definition.message.trim().length === 0)
      .map((entry) => `${entry.dictionary}.${entry.key}`)

    expect(blank).toEqual([])
  })
})

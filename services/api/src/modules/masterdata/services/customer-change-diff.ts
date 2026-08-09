import {
  isSensitiveField,
  labelOfSensitiveField,
  type SensitiveCustomerField,
} from '../constants/customer-sensitive-fields'
import {
  type FieldChange,
  type FieldValue,
} from '../repositories/customer-change-request.repository.port'

export type { FieldChange, FieldValue }

export interface SplitChanges {
  /** 可以直接落库的常规字段变更 */
  direct: Record<string, FieldValue>
  /** 命中敏感字段、需要走审批的变更 */
  sensitive: FieldChange[]
}

function normalize(value: unknown): FieldValue {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  return String(value)
}

/**
 * 把一次改档拆成「直接生效」与「需审批」两堆。
 *
 * 只比对**实际发生变化**的字段：把值改成和原来一样不应该凭空生成一张审批单。
 */
export function splitCustomerChanges(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): SplitChanges {
  const direct: Record<string, FieldValue> = {}
  const sensitive: FieldChange[] = []

  for (const [field, rawAfter] of Object.entries(patch)) {
    if (rawAfter === undefined) continue

    const after = normalize(rawAfter)
    const previous = normalize(before[field])
    if (after === previous) continue

    if (isSensitiveField(field)) {
      sensitive.push({
        field,
        label: labelOfSensitiveField(field as SensitiveCustomerField),
        before: previous,
        after,
      })
    } else {
      direct[field] = after
    }
  }

  return { direct, sensitive }
}

/** 审批通过时把变更清单还原成可落库的 patch。 */
export function changesToPatch(changes: readonly FieldChange[]): Record<string, FieldValue> {
  return Object.fromEntries(changes.map((change) => [change.field, change.after]))
}

export function describeChanges(changes: readonly FieldChange[]): string {
  return changes
    .map((change) => `${change.label}：${change.before ?? '（空）'} → ${change.after ?? '（空）'}`)
    .join('；')
}

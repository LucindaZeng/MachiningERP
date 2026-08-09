import type { NumberResetPolicy } from '@prisma/client'

export interface DocNumberPattern {
  prefix: string
  /** '' | yyyy | yyyyMM | yyyyMMdd */
  datePattern: string
  padding: number
  separator: string
  resetPolicy: NumberResetPolicy
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

/** 统一用本地时区的日历日切分周期，避免跨时区把同一天算成两天。 */
export function formatDateSegment(pattern: string, at: Date): string {
  const year = at.getFullYear().toString()
  const month = pad2(at.getMonth() + 1)
  const day = pad2(at.getDate())

  switch (pattern) {
    case 'yyyy':
      return year
    case 'yyyyMM':
      return `${year}${month}`
    case 'yyyyMMdd':
      return `${year}${month}${day}`
    case '':
      return ''
    default:
      throw new RangeError(`不支持的日期段格式：${pattern}`)
  }
}

/** 序号重置周期键：同一个周期键内序号连续，跨周期重新从 1 开始。 */
export function periodKeyFor(policy: NumberResetPolicy, at: Date): string {
  switch (policy) {
    case 'NONE':
      return '-'
    case 'YEARLY':
      return formatDateSegment('yyyy', at)
    case 'MONTHLY':
      return formatDateSegment('yyyyMM', at)
    case 'DAILY':
      return formatDateSegment('yyyyMMdd', at)
    default:
      throw new RangeError(`不支持的编号重置策略：${String(policy)}`)
  }
}

export function formatDocNumber(pattern: DocNumberPattern, sequence: number, at: Date): string {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new RangeError(`单据序号必须是正整数：${sequence}`)
  }

  const dateSegment = formatDateSegment(pattern.datePattern, at)
  const serial = sequence.toString().padStart(pattern.padding, '0')
  if (serial.length > pattern.padding) {
    throw new RangeError(`单据序号 ${sequence} 超出 ${pattern.padding} 位容量，请调整编号规则`)
  }

  return [pattern.prefix, dateSegment, serial].filter(Boolean).join(pattern.separator)
}

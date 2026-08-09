import { RATE_BPS_MAX, type CostRates } from '../constants/cost-rates'

export interface CostRateIssue {
  field: string
  message: string
}

const LABELS: Record<keyof CostRates, string> = {
  lossBps: '损耗率',
  overheadBps: '管理费利润率',
  vatBps: '增值税率',
}

/**
 * 费率校验。
 *
 * 业务口径：**5% / 5% 只是默认值，不是固定值**——报价工程师按产品与客户情况自行调整，
 * 7% 损耗 + 10% 管理费同样是合法组合。所以这里不锁定具体档位，只挡住
 * 结构上不可能成立的取值：
 *
 * - 必须是整数（万分比本来就是为了避开浮点，收到 5.5 这种值说明调用方口径错了）
 * - 不能为负（负损耗、负管理费没有业务含义，多半是符号写反）
 * - 不超过 100%（10000 bps）
 *
 * 上限 100% 是保守取值：现实中管理费利润率到不了这个量级，写成上限是为了拦住
 * 「把 7% 误填成 700%」这类少打一个小数点的输入。若确有超过 100% 的业务场景，
 * 改这里一个常量即可，不要绕过校验。
 */
export function validateCostRates(rates: CostRates): CostRateIssue[] {
  const issues: CostRateIssue[] = []

  for (const field of Object.keys(LABELS) as Array<keyof CostRates>) {
    const value = rates[field]
    const label = LABELS[field]

    if (!Number.isInteger(value)) {
      issues.push({ field, message: `${label}必须是万分比整数（5% 填 500，7% 填 700）` })
      continue
    }
    if (value < 0) {
      issues.push({ field, message: `${label}不能为负` })
      continue
    }
    if (value > RATE_BPS_MAX) {
      issues.push({ field, message: `${label}不能超过 100%，请确认是否少打了小数点` })
    }
  }

  return issues
}

/** 万分比 → 展示用百分数字符串，用于留痕与提示文案。 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, '')}%`
}

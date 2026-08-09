import { computed, onMounted, ref } from 'vue'

import { fetchCostAnalyses } from '@/api/sales/quotation.api'

import type { CostAnalysis } from '@/types/sales.types'

/** 核价（QTN-02）：成本测算、毛利试算与行情快照校验。 */
export function useCostAnalysis() {
  const analyses = ref<Record<string, CostAnalysis>>({})
  const currentKey = ref('')
  const loading = ref(false)
  const quotedUnitPrice = ref('0')

  const current = computed<CostAnalysis | null>(() => analyses.value[currentKey.value] ?? null)

  const options = computed(() =>
    Object.values(analyses.value).map((item) => ({
      value: item.quotationNo,
      label: `${item.quotationNo} · ${item.productName}`,
    })),
  )

  const totalCost = computed(() =>
    (current.value?.lines ?? []).reduce((sum, line) => sum + Number(line.amount || '0'), 0),
  )

  const marginAmount = computed(() => Number(quotedUnitPrice.value || '0') - totalCost.value)

  const marginRate = computed(() => {
    const price = Number(quotedUnitPrice.value || '0')
    return price ? marginAmount.value / price : 0
  })

  const belowTarget = computed(
    () => !!current.value && marginRate.value < current.value.targetMarginRate,
  )

  function select(key: string): void {
    currentKey.value = key
    quotedUnitPrice.value = analyses.value[key]?.quotedUnitPrice ?? '0'
  }

  onMounted(async () => {
    loading.value = true
    try {
      analyses.value = await fetchCostAnalyses()
      const first = Object.keys(analyses.value)[0]
      if (first) {
        select(first)
      }
    } finally {
      loading.value = false
    }
  })

  const all = computed<CostAnalysis[]>(() => Object.values(analyses.value))

  return {
    all,
    analyses,
    options,
    current,
    currentKey,
    loading,
    quotedUnitPrice,
    totalCost,
    marginAmount,
    marginRate,
    belowTarget,
    select,
  }
}

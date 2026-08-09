import { computed, onMounted, ref } from 'vue'

import { isBizError } from '@/api/biz-error'
import { emptyFilters, type FilterField, type FilterValues } from '@/components/filter-helpers'

export interface ResourceListOptions<T> {
  /** 条件筛选字段定义，用于生成 FilterBar 与初始值 */
  fields?: FilterField[]
  /** 条件匹配函数：返回 true 表示该行通过筛选 */
  predicate?: (row: T, filters: FilterValues) => boolean
}

/**
 * 列表页通用取数：加载、关键词搜索、条件筛选、错误提示。
 * 页面组件只声明「怎么取」「按哪些字段搜」「条件怎么匹配」，不重复写 loading/try-catch。
 */
export function useResourceList<T>(
  loader: () => Promise<T[]>,
  searchFields: (row: T) => string[],
  options: ResourceListOptions<T> = {},
) {
  const fields = options.fields ?? []
  const rows = ref<T[]>([]) as { value: T[] }
  const loading = ref(false)
  const keyword = ref('')
  const filters = ref<FilterValues>(emptyFilters(fields))
  const errorMessage = ref('')

  const filtered = computed(() => {
    const text = keyword.value.trim().toLowerCase()
    return rows.value.filter((row) => {
      const hitKeyword =
        !text || searchFields(row).some((field) => field?.toLowerCase().includes(text))
      const hitFilters = !options.predicate || options.predicate(row, filters.value)
      return hitKeyword && hitFilters
    })
  })

  async function reload(): Promise<void> {
    loading.value = true
    errorMessage.value = ''
    try {
      rows.value = await loader()
    } catch (error) {
      errorMessage.value = isBizError(error) ? error.message : '数据加载失败，请稍后重试'
    } finally {
      loading.value = false
    }
  }

  function resetFilters(): void {
    keyword.value = ''
    filters.value = emptyFilters(fields)
  }

  onMounted(reload)

  return { rows, filtered, loading, keyword, filters, errorMessage, reload, resetFilters }
}

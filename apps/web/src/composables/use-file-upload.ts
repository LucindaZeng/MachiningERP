import { ref, type Ref } from 'vue'

import { isBizError } from '@/api/biz-error'

export interface UseFileUpload<T> {
  uploading: Ref<boolean>
  percent: Ref<number>
  errorMessage: Ref<string>
  result: Ref<T | null>
  run: (task: (onProgress: (percent: number) => void) => Promise<T>) => Promise<T | null>
  reset: () => void
}

/**
 * 上传的通用状态机：进行中 / 进度 / 失败原因 / 结果。
 *
 * 失败**不抛给调用方**，而是落进 `errorMessage` 并返回 null——
 * 上传失败是常规分支（类型不对、超大、网络断），不该让每个页面都写 try/catch。
 */
export function useFileUpload<T>(): UseFileUpload<T> {
  const uploading = ref(false)
  const percent = ref(0)
  const errorMessage = ref('')
  const result = ref<T | null>(null) as Ref<T | null>

  async function run(task: (onProgress: (value: number) => void) => Promise<T>): Promise<T | null> {
    uploading.value = true
    percent.value = 0
    errorMessage.value = ''

    try {
      const value = await task((next) => {
        percent.value = next
      })
      result.value = value
      percent.value = 100
      return value
    } catch (error) {
      errorMessage.value = isBizError(error)
        ? error.message
        : error instanceof Error
          ? error.message
          : '上传失败'
      return null
    } finally {
      uploading.value = false
    }
  }

  function reset(): void {
    uploading.value = false
    percent.value = 0
    errorMessage.value = ''
    result.value = null
  }

  return { uploading, percent, errorMessage, result, run, reset }
}

import { ref, type Ref } from 'vue'

import { BizError } from '@/api/biz-error'
import { fetchDownloadUrl, fetchPreviewUrl } from '@/api/file-preview.api'

import type { PreviewOwnerType, PreviewUrlView } from '@/api/file-preview.api'

export interface UseFilePreview {
  visible: Ref<boolean>
  loading: Ref<boolean>
  preview: Ref<PreviewUrlView | null>
  /** 415 时后端明说渲染不了，此时只给下载 */
  unsupported: Ref<boolean>
  errorMessage: Ref<string>
  open: (ownerType: PreviewOwnerType, ownerId: string) => Promise<void>
  close: () => void
  download: () => Promise<void>
}

/**
 * 预览对话框的状态与取数。逻辑住在 composable 里，页面只管点开——
 * 报价、BOM、订单三处复用同一份，不各写一遍。
 *
 * 预览地址带短时效签名，因此**每次打开都重新取**，不缓存。
 */
export function useFilePreview(): UseFilePreview {
  const visible = ref(false)
  const loading = ref(false)
  const preview = ref<PreviewUrlView | null>(null)
  const unsupported = ref(false)
  const errorMessage = ref('')

  let current: { ownerType: PreviewOwnerType; ownerId: string } | null = null

  async function open(ownerType: PreviewOwnerType, ownerId: string): Promise<void> {
    current = { ownerType, ownerId }
    visible.value = true
    loading.value = true
    unsupported.value = false
    errorMessage.value = ''
    preview.value = null

    try {
      preview.value = await fetchPreviewUrl(ownerType, ownerId)
    } catch (error) {
      // 415 不是失败，是「这个类型只能下载」——对话框据此换成下载引导
      if (error instanceof BizError && error.status === 415) {
        unsupported.value = true
        errorMessage.value = error.message
      } else {
        errorMessage.value = error instanceof Error ? error.message : '预览地址获取失败'
      }
    } finally {
      loading.value = false
    }
  }

  function close(): void {
    visible.value = false
    // 立刻丢掉带签名的地址，别让它留在内存里等着过期
    preview.value = null
    current = null
  }

  async function download(): Promise<void> {
    if (!current) return

    const view = await fetchDownloadUrl(current.ownerType, current.ownerId)
    window.open(view.previewUrl, '_blank', 'noopener')
  }

  return { visible, loading, preview, unsupported, errorMessage, open, close, download }
}

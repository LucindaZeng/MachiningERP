import { ElMessage } from 'element-plus'
import { ref, type Ref } from 'vue'

import { fetchDownloadUrl } from '@/api/file-preview.api'

import type { GeneratedDocument } from '@/api/sales/docgen.api'

export interface UseDocumentExport {
  /** 出具中——按钮据此转 loading，避免重复点出两份文件 */
  issuing: Ref<boolean>
  /** 最近一次出具的记录，供页面显示文件名与预览入口 */
  latest: Ref<GeneratedDocument | null>
  issue: (action: () => Promise<GeneratedDocument>, label: string) => Promise<GeneratedDocument | null>
}

/**
 * 「按受控模板出具一份单据」的通用交互。
 *
 * 出具完**自动弹下载**：用户点「出具报价单」想要的是拿到那份文件，
 * 而不是先拿到一条生成记录再自己去找下载入口。预览另走 `useFilePreview`——
 * 两件事分开，因为出具是写动作、预览是读动作，失败时要给的话也不一样。
 *
 * 重复点击由 `issuing` 挡住：每点一次都会真的多出一份文件（生成物不可覆盖，
 * 每次都是新键新记录），连点三下就是三份，事后没人说得清哪份发给了客户。
 */
export function useDocumentExport(): UseDocumentExport {
  const issuing = ref(false)
  const latest = ref<GeneratedDocument | null>(null)

  async function issue(
    action: () => Promise<GeneratedDocument>,
    label: string,
  ): Promise<GeneratedDocument | null> {
    if (issuing.value) return null
    issuing.value = true

    try {
      const record = await action()
      latest.value = record
      ElMessage.success(`${label}已出具：${record.fileName}`)
      await openDownload(record.id)
      return record
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : `${label}出具失败`)
      return null
    } finally {
      issuing.value = false
    }
  }

  return { issuing, latest, issue }
}

/**
 * 取下载地址并打开。
 *
 * 单独一段并吞掉异常：文件**已经出具成功**了，取下载地址失败只是这一次没弹出来，
 * 用户仍可从生成记录里再点一次。让它把整个出具动作报成失败，
 * 会让人以为要重出一份——于是真的多出一份。
 */
async function openDownload(generatedId: string): Promise<void> {
  try {
    const view = await fetchDownloadUrl('generated-document', generatedId)
    window.open(view.previewUrl, '_blank', 'noopener')
  } catch {
    ElMessage.warning('文件已出具，但下载地址获取失败，请在生成记录里重试下载')
  }
}

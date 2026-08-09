import { ElMessage, ElMessageBox } from 'element-plus'
import { ref, shallowRef } from 'vue'

export interface FormDraft<T> {
  id: string
  name: string
  savedAt: string
  data: T
}

const PREFIX = 'erp.draft.'

/**
 * 表单草稿：保存 / 调用 / 删除。
 * 当前落在 localStorage（按表单 key 分组），接后端后改为
 * POST /drafts、GET /drafts?formKey=、DELETE /drafts/{id}，草稿滞留超时会触发预警。
 */
export function useFormDraft<T extends object>(formKey: string, formState: T) {
  const drafts = shallowRef<FormDraft<T>[]>(read())
  const lastSavedAt = ref('')

  function read(): FormDraft<T>[] {
    try {
      return JSON.parse(localStorage.getItem(PREFIX + formKey) ?? '[]') as FormDraft<T>[]
    } catch {
      return []
    }
  }

  function persist(list: FormDraft<T>[]): void {
    drafts.value = list
    localStorage.setItem(PREFIX + formKey, JSON.stringify(list))
  }

  function stamp(): string {
    const now = new Date()
    const pad = (value: number) => `${value}`.padStart(2, '0')
    return (
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}`
    )
  }

  async function save(): Promise<void> {
    const result = await ElMessageBox.prompt('给草稿起个名字，便于以后调用', '保存草稿', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: `草稿 ${stamp()}`,
      inputValidator: (value: string) => (value?.trim() ? true : '请输入草稿名称'),
    }).catch(() => null)

    if (!result) {
      return
    }

    const draft: FormDraft<T> = {
      id: `D${Date.now().toString(36).toUpperCase()}`,
      name: result.value.trim(),
      savedAt: stamp(),
      data: JSON.parse(JSON.stringify(formState)) as T,
    }

    persist([draft, ...drafts.value].slice(0, 20))
    lastSavedAt.value = draft.savedAt
    ElMessage.success(`草稿「${draft.name}」已保存，可随时调用；草稿不启动 SLA 计时`)
  }

  /** 调用草稿：把草稿内容写回表单对象（保持响应式，不替换引用） */
  function load(draft: FormDraft<T>): void {
    Object.assign(formState, draft.data)
    ElMessage.success(`已载入草稿「${draft.name}」`)
  }

  async function remove(draft: FormDraft<T>): Promise<void> {
    const confirmed = await ElMessageBox.confirm(
      `确认删除草稿「${draft.name}」？删除后不可恢复。`,
      '删除草稿',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    ).catch(() => null)

    if (!confirmed) {
      return
    }

    persist(drafts.value.filter((item) => item.id !== draft.id))
    ElMessage.success('草稿已删除')
  }

  return { drafts, lastSavedAt, save, load, remove }
}

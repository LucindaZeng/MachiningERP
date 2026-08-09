import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { isBizError } from '@/api/biz-error'
import { createSalesOrder } from '@/api/sales/sales-order.api'

import type { SalesOrderFormModel } from './form-model'
import type { FormInstance } from 'element-plus'
import type { ComputedRef, Ref } from 'vue'

/** 未通过阻断校验时的统一提示：清单已在界面右侧逐条标红，这里只给一句总述 */
const BLOCKED_HINT = '存在未通过的阻断校验项，请按右侧清单补齐后再提交'

export interface OrderSubmitInput {
  form: SalesOrderFormModel
  formRef: Ref<FormInstance | undefined>
  canSubmit: ComputedRef<boolean>
}

/** 建单提交：表单校验与阻断清单必须同时通过，任一不过都不发请求 */
export function useOrderSubmit(input: OrderSubmitInput) {
  const router = useRouter()
  const submitting = ref(false)
  const errorMessage = ref('')

  async function submit(): Promise<void> {
    const valid = await input.formRef.value?.validate().catch(() => false)
    if (!valid || !input.canSubmit.value) {
      errorMessage.value = BLOCKED_HINT
      return
    }

    submitting.value = true
    errorMessage.value = ''
    try {
      const order = await createSalesOrder({ ...input.form })
      ElMessage.success(`订单 ${order.docNo} 已提交业务经理审核，T0 已起算`)
      await router.push('/sales/orders')
    } catch (error) {
      errorMessage.value = isBizError(error) ? error.message : '提交失败，请稍后重试'
    } finally {
      submitting.value = false
    }
  }

  return { submitting, errorMessage, submit }
}

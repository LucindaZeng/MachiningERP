import { ElMessage, ElMessageBox } from 'element-plus'
import { ref, type Ref } from 'vue'

import {
  approveCustomsReview,
  archiveCustomsReceipt,
  correctCustoms,
  declareCustoms,
  releaseCustoms,
  returnCustomsForFix,
  submitCustomsForReview,
} from '@/api/sales/customs.api'

import type { CustomsDossier } from '@/types/sales.types'

/**
 * 报关资料的流转动作（EXP-02 ~ EXP-04）。
 *
 * 集中在一支 composable 里而不是散在页面上，理由有三条，都不是「看着整齐」：
 *
 * 1. **乐观锁**。每个动作都要带上当前的 `versionLock`，回来的新记录又要立刻
 *    替换掉手里那份。散写的话，早晚有一个动作用了过期的版本号，
 *    用户看到的是「已被他人修改」，其实是自己上一步没刷新。
 * 2. **服务端才是闸门**。页面上的禁用只是提前把按钮灰掉；要素不齐、未复核、
 *    未过账这些都会被服务端再拦一次，错误文案要原样端给用户，不许吞。
 * 3. **申报之后的改动一律要理由**。这条规矩必须只有一个实现。
 */
export interface UseCustomsFlow {
  /** 动作进行中——按钮转 loading，避免连点提交两次 */
  busy: Ref<boolean>
  submitReview: (dossier: CustomsDossier) => Promise<CustomsDossier | null>
  approveReview: (dossier: CustomsDossier) => Promise<CustomsDossier | null>
  returnForFix: (dossier: CustomsDossier) => Promise<CustomsDossier | null>
  declare: (dossier: CustomsDossier) => Promise<CustomsDossier | null>
  correct: (dossier: CustomsDossier, reason: string) => Promise<CustomsDossier | null>
  archiveReceipt: (dossier: CustomsDossier) => Promise<CustomsDossier | null>
  release: (dossier: CustomsDossier) => Promise<CustomsDossier | null>
}

export function useCustomsFlow(): UseCustomsFlow {
  const busy = ref(false)

  /**
   * 统一跑一个流转动作。
   *
   * 失败时**原样显示服务端文案**：报关的闸门消息本身就是给业务看的
   * （「缺少：目的港代码、唛头 Shipping Marks」），换成「操作失败」等于把
   * 唯一有用的信息丢掉。
   */
  async function run(
    action: () => Promise<CustomsDossier>,
    success: string,
  ): Promise<CustomsDossier | null> {
    if (busy.value) return null
    busy.value = true
    try {
      const updated = await action()
      ElMessage.success(success)
      return updated
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '操作失败')
      return null
    } finally {
      busy.value = false
    }
  }

  function lockOf(dossier: CustomsDossier): number {
    return dossier.versionLock ?? 0
  }

  return {
    busy,

    submitReview: (dossier) =>
      run(() => submitCustomsForReview(dossier.id, lockOf(dossier)), '已送关务复核'),

    approveReview: (dossier) =>
      run(() => approveCustomsReview(dossier.id, lockOf(dossier)), '关务复核通过，可以申报'),

    returnForFix: (dossier) =>
      run(() => returnCustomsForFix(dossier.id, lockOf(dossier)), '已退回业务修改'),

    declare: async (dossier) =>
      (await confirmDeclare())
        ? run(() => declareCustoms(dossier.id, lockOf(dossier)), '已申报，清单快照已冻结')
        : null,

    /** 更正理由必填——已申报资料是对海关的正式陈述，改了什么、为什么改要留得下来。 */
    correct: (dossier, reason) =>
      run(() => correctCustoms(dossier.id, lockOf(dossier), reason), '更正已提交并重新申报'),

    archiveReceipt: async (dossier) => {
      const receiptNo = await askReceiptNo()
      return receiptNo === null
        ? null
        : run(() => archiveCustomsReceipt(dossier.id, lockOf(dossier), receiptNo), '回执已归档')
    },

    release: (dossier) => run(() => releaseCustoms(dossier.id, lockOf(dossier)), '已放行'),
  }
}

/**
 * 申报即**冻结清单快照**，此后任何改动都要走带理由的更正并重报。
 * 这道二次确认不是防手滑，是让人意识到边界就在这一步。
 */
async function confirmDeclare(): Promise<boolean> {
  try {
    await ElMessageBox.confirm(
      '申报后本版清单将被冻结，之后任何改动都必须填写理由并重新申报。确认现在申报？',
      '确认申报',
      { type: 'warning', confirmButtonText: '确认申报', cancelButtonText: '再看看' },
    )
    return true
  } catch {
    // 用户取消
    return false
  }
}

/** 取消时返回 null，与「填了空字符串」区分开。 */
async function askReceiptNo(): Promise<string | null> {
  try {
    const { value } = await ElMessageBox.prompt('请输入海关回执编号', '归档回执', {
      confirmButtonText: '归档',
      cancelButtonText: '取消',
      inputPattern: /\S/,
      inputErrorMessage: '回执编号不能为空',
    })
    return value
  } catch {
    return null
  }
}

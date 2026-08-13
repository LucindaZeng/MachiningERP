import { ElMessage, ElMessageBox } from 'element-plus'
import { ref, type Ref } from 'vue'

import {
  approveEcn,
  closeEcn,
  executeEcn,
  initiateEcnRework,
  rejectEcn,
  returnEcnForDetail,
  signoffEcn,
  startEcnAssessment,
  submitEcnForSignoff,
} from '@/api/sales/ecn.api'

import type { EngineeringChange } from '@/types/sales.types'

/**
 * ECN 的流转动作（ECN-02 ~ ECN-05）。
 *
 * 与报关那支 composable 同一套理由：乐观锁必须集中管，
 * **服务端错误文案必须原样端出去**——ECN 的闸门消息本身就是给人看的
 * （「改数量请走订单修改申请（ORC）」「影响评估尚缺：已发货批次」），
 * 换成「操作失败」等于把唯一有用的信息丢掉。
 */
export interface UseEcnFlow {
  busy: Ref<boolean>
  startAssessment: (ecn: EngineeringChange) => Promise<EngineeringChange | null>
  returnForDetail: (ecn: EngineeringChange) => Promise<EngineeringChange | null>
  submitForSignoff: (ecn: EngineeringChange) => Promise<EngineeringChange | null>
  signoff: (ecn: EngineeringChange) => Promise<EngineeringChange | null>
  approve: (ecn: EngineeringChange) => Promise<EngineeringChange | null>
  reject: (ecn: EngineeringChange, reason: string) => Promise<EngineeringChange | null>
  execute: (ecn: EngineeringChange) => Promise<EngineeringChange | null>
  close: (ecn: EngineeringChange) => Promise<EngineeringChange | null>
  /** PMC 发起返工。确认后数量锁死，因此与批准一样加一道二次确认。 */
  initiateRework: (ecn: EngineeringChange) => Promise<EngineeringChange | null>
}

export function useEcnFlow(): UseEcnFlow {
  const busy = ref(false)

  async function run(
    action: () => Promise<EngineeringChange>,
    success: string,
  ): Promise<EngineeringChange | null> {
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

  function lockOf(ecn: EngineeringChange): number {
    return ecn.versionLock ?? 0
  }

  return {
    busy,

    startAssessment: (ecn) => run(() => startEcnAssessment(ecn.id, lockOf(ecn)), '已开始工程评估'),

    returnForDetail: (ecn) =>
      run(() => returnEcnForDetail(ecn.id, lockOf(ecn)), '已退回业务补充说明'),

    submitForSignoff: (ecn) =>
      run(() => submitEcnForSignoff(ecn.id, lockOf(ecn)), '已送跨部门会签'),

    signoff: async (ecn) => {
      const opinion = await askOpinion()
      return opinion === null
        ? null
        : run(() => signoffEcn(ecn.id, lockOf(ecn), opinion), '会签已记录')
    },

    /**
     * 批准即发布新版本，此后要改只能另开一张 ECN——因此加一道二次确认。
     * 它不是防手滑，是让人意识到边界就在这一步。
     */
    approve: async (ecn) =>
      (await confirmApprove())
        ? run(() => approveEcn(ecn.id, lockOf(ecn)), '变更已批准发布，已通知业务员')
        : null,

    reject: (ecn, reason) =>
      run(() => rejectEcn(ecn.id, lockOf(ecn), reason), '已驳回，理由已通知业务员'),

    execute: (ecn) => run(() => executeEcn(ecn.id, lockOf(ecn)), '已转入执行与批次切换'),

    close: (ecn) => run(() => closeEcn(ecn.id, lockOf(ecn)), '变更已结案'),

    initiateRework: async (ecn) =>
      (await confirmRework())
        ? run(
            () => initiateEcnRework(ecn.id, lockOf(ecn)),
            '返工已发起，受影响数量已锁定',
          )
        : null,
  }
}

async function confirmApprove(): Promise<boolean> {
  try {
    await ElMessageBox.confirm(
      '批准后关联的图纸／工艺版本将发布生效，此后任何调整都必须另开一张 ECN。确认批准？',
      '确认批准发布',
      { type: 'warning', confirmButtonText: '确认批准', cancelButtonText: '再看看' },
    )
    return true
  } catch {
    return false
  }
}

/**
 * 返工确认。与批准那道确认同一个用意：**这一步之后数量改不了**，
 * 返工工单是按这个数拆的，事后再改，车间手上的工单与系统里的数就对不上。
 */
async function confirmRework(): Promise<boolean> {
  try {
    await ElMessageBox.confirm(
      '发起返工后，本单的受影响数量将被锁定，不可再修改；如需调整只能另开一张变更单。确认发起？',
      '确认发起返工',
      { type: 'warning', confirmButtonText: '确认发起', cancelButtonText: '再核一遍' },
    )
    return true
  } catch {
    return false
  }
}

/** 会签意见可留空（服务端会落默认的代签说明）；取消时返回 null。 */
async function askOpinion(): Promise<string | null> {
  try {
    const { value } = await ElMessageBox.prompt(
      '各部门模块尚未上线，本次由工程岗代签并留痕。可填写会签意见（可留空）',
      '记录跨部门会签',
      { confirmButtonText: '记录会签', cancelButtonText: '取消', inputValue: '' },
    )
    return value ?? ''
  } catch {
    return null
  }
}

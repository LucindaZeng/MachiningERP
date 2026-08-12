<script setup lang="ts">
import { ref } from 'vue'

import { assessEcnImpact, fetchEngineeringChange } from '@/api/sales/ecn.api'
import PageHeader from '@/components/PageHeader.vue'
import { useEcnFlow } from '@/composables/use-ecn-flow'

import EcnAssessDialog from './components/EcnAssessDialog.vue'
import EcnCreateDialog from './components/EcnCreateDialog.vue'
import EcnDetailDrawer from './components/EcnDetailDrawer.vue'
import EcnRejectDialog from './components/EcnRejectDialog.vue'
import EcnRequestTable from './components/EcnRequestTable.vue'

import type { AssessPayload } from './components/ecn-assess-payload'
import type { EngineeringChange } from '@/types/sales.types'

const detailVisible = ref(false)
const createVisible = ref(false)
const assessVisible = ref(false)
const rejectVisible = ref(false)
const current = ref<EngineeringChange | null>(null)
const tableRef = ref<InstanceType<typeof EcnRequestTable> | null>(null)
const flow = useEcnFlow()

/**
 * 表格只负责选出一行，抽屉开关与当前单据由页面统一编排。
 *
 * 打开时**再取一次单条**：列表里那份可能已经放了几分钟，而每个流转动作都要带
 * `versionLock` 出去——拿旧版本号去批准，换来的是一句「已被他人修改」，而其实没有别人。
 */
async function openDetail(row: EngineeringChange): Promise<void> {
  current.value = row
  detailVisible.value = true
  try {
    current.value = await fetchEngineeringChange(row.id)
  } catch {
    // 保持列表里那份，不打断查看
  }
}

/** 每个动作回来的都是新记录，必须立刻换掉手里那份，并刷新列表。 */
async function apply(action: Promise<EngineeringChange | null>): Promise<void> {
  const updated = await action
  if (!updated) return
  current.value = updated
  await tableRef.value?.reload()
}

async function onAssess(payload: AssessPayload): Promise<void> {
  const ecn = current.value
  if (!ecn) return
  try {
    const updated = await assessEcnImpact(ecn.id, ecn.versionLock ?? 0, payload)
    current.value = updated
    assessVisible.value = false
    await tableRef.value?.reload()
  } catch (error) {
    // 服务端的闸门文案原样端出去
    const { ElMessage } = await import('element-plus')
    ElMessage.error(error instanceof Error ? error.message : '保存评估失败')
  }
}

async function onReject(reason: string): Promise<void> {
  if (!current.value) return
  await apply(flow.reject(current.value, reason))
  rejectVisible.value = false
}

function onCreated(change: EngineeringChange): void {
  current.value = change
  detailVisible.value = true
  void tableRef.value?.reload()
}
</script>

<template>
  <div>
    <PageHeader
      title="ECN 申请（工程变更）"
      requirement-code="ECN-01 ~ ECN-05"
      subtitle="ECN 只受理产品本身的变更：改图纸、改材料、改表面处理，以及随之必须同步的工艺路线。改图强制联动改工艺路线，未同步禁止发布新版本；中途改工序只对指定批次版本生效；影响价格或交期的变更同时触发重新核价与订单重新审批。"
    >
      <template #actions>
        <el-button type="primary" @click="createVisible = true">新建 ECN 申请</el-button>
      </template>
    </PageHeader>

    <el-alert
      class="scope-alert"
      type="warning"
      :closable="false"
      show-icon
      title="改数量 / 改交期 / 改价格不走 ECN"
      description="ECN = 产品变更（图纸、材料、表面处理、工艺路线）。数量、交期、单价、收费方式、收货信息、包装要求与取消订单属于订单信息变更，请到「订单管理 → 订单修改申请（ORC）」提交，避免两条流程互相覆盖。"
    />

    <EcnRequestTable ref="tableRef" @detail="openDetail" />

    <EcnDetailDrawer
      v-model="detailVisible"
      :change="current"
      :busy="flow.busy.value"
      @start-assessment="current && apply(flow.startAssessment(current))"
      @return-for-detail="current && apply(flow.returnForDetail(current))"
      @assess="assessVisible = true"
      @submit-signoff="current && apply(flow.submitForSignoff(current))"
      @signoff="current && apply(flow.signoff(current))"
      @approve="current && apply(flow.approve(current))"
      @reject="rejectVisible = true"
      @execute="current && apply(flow.execute(current))"
      @close="current && apply(flow.close(current))"
    />

    <EcnAssessDialog
      v-model="assessVisible"
      :change="current"
      :busy="flow.busy.value"
      @confirm="onAssess"
    />

    <EcnRejectDialog v-model="rejectVisible" :busy="flow.busy.value" @confirm="onReject" />

    <EcnCreateDialog v-model="createVisible" @created="onCreated" />
  </div>
</template>

<style scoped>
.scope-alert {
  margin-bottom: 14px;
}
</style>

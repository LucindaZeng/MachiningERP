<script setup lang="ts">
import { ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'

import EcnCreateDialog from './components/EcnCreateDialog.vue'
import EcnDetailDrawer from './components/EcnDetailDrawer.vue'
import EcnRequestTable from './components/EcnRequestTable.vue'

import type { EngineeringChange } from '@/types/sales.types'

const detailVisible = ref(false)
const createVisible = ref(false)
const current = ref<EngineeringChange | null>(null)

/** 表格只负责选出一行，抽屉开关与当前单据由页面统一编排 */
function openDetail(row: EngineeringChange): void {
  current.value = row
  detailVisible.value = true
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

    <EcnRequestTable @detail="openDetail" />

    <EcnDetailDrawer v-model="detailVisible" :change="current" />

    <EcnCreateDialog v-model="createVisible" />
  </div>
</template>

<style scoped>
.scope-alert {
  margin-bottom: 14px;
}
</style>

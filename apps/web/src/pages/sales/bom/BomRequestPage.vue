<script setup lang="ts">
import { ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'

import BomRequestCreateDialog from './components/BomRequestCreateDialog.vue'
import BomRequestDetailDrawer from './components/BomRequestDetailDrawer.vue'
import BomRequestTable from './components/BomRequestTable.vue'

import type { BomRequest } from '@/types/sales.types'

const detailVisible = ref(false)
const createVisible = ref(false)
const current = ref<BomRequest | null>(null)

/** 表格只负责选出一行，抽屉开关与当前单据由页面统一编排 */
function openDetail(row: BomRequest): void {
  current.value = row
  detailVisible.value = true
}
</script>

<template>
  <div>
    <PageHeader
      title="BOM 申请"
      requirement-code="ENG-02 / ENG-05"
      subtitle="业务把已确认的客户资料提交工程建品号、BOM 与工艺路线。只受理正式量产产品（建品号）与模具（建模具编号）；样品订单既无 BOM 也无品号，备料订单引用已有品号、不新建。必须关联客户原始资料与已确认报价；工程退回时记录退回等待时间。回传结果分「BOM 可下单」与「程序可开工」两个状态，不合并显示。"
    >
      <template #actions>
        <el-button type="primary" @click="createVisible = true">新建 BOM 申请</el-button>
      </template>
    </PageHeader>

    <el-alert
      class="scope-alert"
      type="info"
      :closable="false"
      show-icon
      title="样品既没有 BOM，也没有品号"
      description="品号（产品编码）只发给正式订单的产品。样品按客户来图编制临时工艺路线试做，不建品号、不建 BOM、不做程序可开工确认，全程只以「图号 + 样品单号」标识。样品转量产时才由业务提交 BOM 申请，此时工程才建立品号、BOM 与工艺路线，并回填对应样品单号。模具订单建的是模具编号，不是品号；备料订单不新建品号，必须引用已量产产品的既有品号。"
    />

    <BomRequestTable @detail="openDetail" />

    <BomRequestDetailDrawer v-model="detailVisible" :request="current" />

    <BomRequestCreateDialog v-model="createVisible" />
  </div>
</template>

<style scoped>
.scope-alert {
  margin-bottom: 14px;
}
</style>

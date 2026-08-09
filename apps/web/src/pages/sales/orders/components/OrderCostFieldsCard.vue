<script setup lang="ts">
/**
 * 成本要素补录：备料订单专项与免费 / 部分收费专项合在一个组件里，
 * 因为两者写的是同一组字段（预计成本 + 原因），只是口径不同，
 * 且互斥出现（备料订单收费方式锁死为内部，不会触发免费四要素）。
 */
defineProps<{
  isStock: boolean
  needFreeFields: boolean
}>()

const costOwner = defineModel<string>('costOwner', { required: true })
const estimatedCost = defineModel<string>('estimatedCost', { required: true })
const freeReason = defineModel<string>('freeReason', { required: true })
</script>

<template>
  <el-card v-if="isStock" shadow="never">
    <template #header><span class="card-title">备料订单专项</span></template>
    <el-form-item label="预计生产成本">
      <el-input v-model="estimatedCost" placeholder="备料订单不产生客户应收，但全额核算成本" />
    </el-form-item>
    <el-form-item label="备料原因">
      <el-input
        v-model="freeReason"
        type="textarea"
        :rows="2"
        placeholder="如：客户滚动需求，提前备料压缩交期"
      />
    </el-form-item>
  </el-card>

  <el-card v-if="needFreeFields" shadow="never">
    <template #header>
      <span class="card-title">免费 / 部分收费专项（四项要素缺一不可）</span>
    </template>

    <el-form-item label="费用承担方">
      <el-input v-model="costOwner" placeholder="如：客户承担 60% / 公司承担 40%" />
    </el-form-item>
    <el-form-item label="预计成本">
      <el-input v-model="estimatedCost" placeholder="免费不等于无成本，仍需全额核算" />
    </el-form-item>
    <el-form-item label="免费 / 减免原因">
      <el-input
        v-model="freeReason"
        type="textarea"
        :rows="2"
        placeholder="如：量产订单达 5 万件后返还公司承担部分"
      />
    </el-form-item>
  </el-card>
</template>

<style scoped>
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}
</style>

<script setup lang="ts">
defineProps<{
  /** 卡片序号随「备料领用」卡片是否出现而变，由父页编排，组件不判断订单类型 */
  title: string
}>()

const originalUnitPrice = defineModel<string>('originalUnitPrice', { required: true })
const currency = defineModel<string>('currency', { required: true })
const taxRate = defineModel<string>('taxRate', { required: true })
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <span class="card-title">{{ title }}</span>
    </template>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-form-item label="原始输入单价" prop="originalUnitPrice">
          <el-input v-model="originalUnitPrice" placeholder="按客户确认价录入" />
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="币种">
          <el-select v-model="currency" style="width: 100%">
            <el-option label="CNY" value="CNY" />
            <el-option label="USD" value="USD" />
            <el-option label="EUR" value="EUR" />
            <el-option label="HKD" value="HKD" />
          </el-select>
        </el-form-item>
      </el-col>
      <el-col :span="8">
        <el-form-item label="税率">
          <el-select v-model="taxRate" style="width: 100%">
            <el-option label="13%（内销）" value="0.13" />
            <el-option label="0%（出口）" value="0" />
            <el-option label="6%" value="0.06" />
          </el-select>
        </el-form-item>
      </el-col>
    </el-row>
  </el-card>
</template>

<style scoped>
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}
</style>

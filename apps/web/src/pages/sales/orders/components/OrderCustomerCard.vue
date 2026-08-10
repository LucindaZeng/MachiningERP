<script setup lang="ts">
import { PAYMENT_TERM_LABELS } from '@machining-erp/shared'

import { CHARGE_MODE } from '@/components/status-dictionary'

import type { ChargeMode, Customer, OrderType } from '@/types/sales.types'

defineProps<{
  orderType: OrderType
  customers: Customer[]
  /** 未选客户时为 undefined，付款条件不展示 */
  selectedCustomer?: Customer
  isFormal: boolean
  isStock: boolean
}>()

/**
 * 订单类型不走 v-model：切换类型要连带重置收费方式与价格（正式强制收费、备料清零），
 * 这些联动规则属于建单编排，只能由父页的 onOrderTypeChange 统一执行。
 */
const emit = defineEmits<{ 'order-type-change': [OrderType] }>()

const customerCode = defineModel<string>('customerCode', { required: true })
const chargeMode = defineModel<ChargeMode>('chargeMode', { required: true })

const CHARGE_OPTIONS = [
  { value: 'charged', label: CHARGE_MODE.charged },
  { value: 'free', label: CHARGE_MODE.free },
  { value: 'partial', label: CHARGE_MODE.partial },
  { value: 'deferred', label: CHARGE_MODE.deferred },
  { value: 'deposit', label: CHARGE_MODE.deposit },
  { value: 'internal', label: CHARGE_MODE.internal },
]
</script>

<template>
  <el-card shadow="never">
    <template #header><span class="card-title">一、客户与订单类型</span></template>

    <el-form-item label="客户" prop="customerCode">
      <el-select v-model="customerCode" placeholder="选择客户" filterable style="width: 100%">
        <el-option
          v-for="item in customers"
          :key="item.code"
          :label="`${item.code} · ${item.name}`"
          :value="item.code"
          :disabled="item.status !== 'ACTIVE'"
        />
      </el-select>
      <p v-if="selectedCustomer" class="field-hint">
        付款条件 {{ PAYMENT_TERM_LABELS[selectedCustomer.paymentTerm] }} · 结算币种
        {{ selectedCustomer.currency }}
      </p>
    </el-form-item>

    <el-form-item label="订单类型">
      <el-radio-group
        :model-value="orderType"
        @update:model-value="emit('order-type-change', $event as OrderType)"
      >
        <el-radio-button value="formal">正式业务订单</el-radio-button>
        <el-radio-button value="mold">模具订单</el-radio-button>
        <el-radio-button value="sample">样品订单</el-radio-button>
        <el-radio-button value="stock">备料订单</el-radio-button>
      </el-radio-group>
      <p v-if="isStock" class="field-hint">
        备料订单不向客户交货，完工全部入库即视为订单完成；后续正式订单可关联领用，直到备料用完。
      </p>
    </el-form-item>

    <el-form-item label="收费方式">
      <el-select
        v-model="chargeMode"
        style="width: 260px"
        :disabled="isFormal || isStock"
      >
        <el-option
          v-for="item in CHARGE_OPTIONS"
          :key="item.value"
          v-bind="item"
          :disabled="(isFormal && item.value !== 'charged') || (isStock && item.value !== 'internal')"
        />
      </el-select>
      <p class="field-hint">
        {{
          isFormal
            ? '正式业务订单强制收费，系统以合同应收义务判断，不允许免费或零价绕过'
            : isStock
              ? '备料订单为内部备料，不产生客户应收，但全额核算生产成本'
              : '模具 / 样品可收费、免费、部分收费、递延分摊或押金返还，均需按预计成本分级审批'
        }}
      </p>
    </el-form-item>
  </el-card>
</template>

<style scoped>
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.field-hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--wfx-text-muted);
}
</style>

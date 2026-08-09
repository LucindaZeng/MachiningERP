<script setup lang="ts">
import { computed } from 'vue'

import { usePermission } from '@/composables/use-permission'

import type { HkPricing } from '@/types/sales.types'

const { canViewHkPrice, role } = usePermission()

const props = defineProps<{ hk: HkPricing; currency: string; quantity: string }>()

/** 防重复折算校验：原始价 × 适用系数 必须等于计算后价格 */
const consistent = computed(() => {
  const expected = Number(props.hk.originalUnitPrice) * props.hk.factor
  return Math.abs(expected - Number(props.hk.finalUnitPrice)) < 0.005
})

const total = computed(() =>
  (Number(props.hk.finalUnitPrice) * Number(props.quantity || '0')).toFixed(2),
)
</script>

<template>
  <div v-if="!canViewHkPrice" class="hk-masked">
    <p class="hk-masked__title">香港 70% 价格设定不可见</p>
    <p class="hk-masked__desc">
      当前角色「{{ role.name }}」没有 sales.hk-price.view 权限。香港代生产客户的 70% 价格规则、
      系数与折算过程仅业务部权限可见；本单只显示系统计算后的订单单价
      <b>{{ hk.finalUnitPrice }} {{ currency }}</b>，金额合计 {{ total }} {{ currency }}。
    </p>
  </div>

  <div v-else class="hk-breakdown" :class="{ 'is-applied': hk.applied }">
    <div class="hk-breakdown__row">
      <div class="hk-breakdown__cell">
        <span>原始输入单价</span>
        <b>{{ hk.originalUnitPrice }}</b>
        <em>{{ currency }}</em>
      </div>
      <span class="hk-breakdown__op">×</span>
      <div class="hk-breakdown__cell">
        <span>价格系数</span>
        <b>{{ hk.factor }}</b>
        <em>{{ hk.applied ? '香港代生产 70%' : '不适用，按 100%' }}</em>
      </div>
      <span class="hk-breakdown__op">=</span>
      <div class="hk-breakdown__cell is-final">
        <span>计算后订单单价</span>
        <b>{{ hk.finalUnitPrice }}</b>
        <em>金额合计 {{ total }} {{ currency }}</em>
      </div>
    </div>

    <p class="hk-breakdown__meta">
      触发条件：{{ hk.customerFlagSnapshot ? '客户已勾选' : '客户未勾选' }} ·
      订单类型快照 {{ hk.orderTypeSnapshot === 'formal' ? '正式业务订单' : '模具 / 样品' }} ·
      {{ hk.applied ? '条件成立，已应用 70%' : '条件不成立，原价直接生效' }}
    </p>
    <p class="hk-breakdown__meta">
      舍入规则：{{ hk.roundingRule }} · 价格版本 {{ hk.priceVersion }}
      <template v-if="hk.calculatedAt"> · 计算时间 {{ hk.calculatedAt }}</template>
    </p>

    <el-alert
      v-if="!consistent"
      class="hk-breakdown__alert"
      type="error"
      :closable="false"
      show-icon
      title="价格校验不通过：原始价 × 系数 ≠ 计算后价格"
      description="疑似重复折算或人工覆盖，禁止提交审核。请检查是否已手工按 70% 录入原价。"
    />
  </div>
</template>

<style scoped>
.hk-masked {
  padding: 14px 16px;
  background: var(--wfx-surface-alt);
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
}

.hk-masked__title {
  margin: 0 0 6px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.hk-masked__desc {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
}

.hk-breakdown {
  padding: 16px 18px;
  background: var(--wfx-surface-alt);
  border: 1px solid var(--wfx-border);
  border-radius: var(--wfx-radius-md);
}

.hk-breakdown.is-applied {
  background: #fff8ec;
  border-color: #f5d8a4;
}

.hk-breakdown__row {
  display: flex;
  gap: 14px;
  align-items: center;
}

.hk-breakdown__cell {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid var(--wfx-border);
  border-radius: 8px;
}

.hk-breakdown__cell span {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.hk-breakdown__cell b {
  font-size: 22px;
  color: var(--wfx-text-strong);
}

.hk-breakdown__cell em {
  font-size: 11.5px;
  font-style: normal;
  color: var(--wfx-text-muted);
}

.hk-breakdown__cell.is-final b {
  color: var(--wfx-navy);
}

.hk-breakdown__op {
  font-size: 18px;
  font-weight: 700;
  color: var(--wfx-text-muted);
}

.hk-breakdown__meta {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.hk-breakdown__alert {
  margin-top: 12px;
}
</style>

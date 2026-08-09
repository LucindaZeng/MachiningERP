<script setup lang="ts">
import { money, percent, signed, type ElementSummary, type TraceTotals } from './quote-cost-trace'

defineProps<{ items: ElementSummary[]; totals: TraceTotals; currency: string }>()

const HINT: Record<string, string> = {
  材料: '材料 = 棒料 / 板料单重 × 单价 × (1 + 损耗率)，偏差主要来自损耗率与采购价波动。',
  加工时间: '加工时间 = 单件工时 × 机台费率，偏差主要来自工时假设、换刀与调机。',
  工艺: '工艺 = 委外单价 + 刀具工装分摊 + 包装等，偏差主要来自分摊基数与委外调价。',
}
</script>

<template>
  <div class="elem">
    <div v-for="item in items" :key="item.element" class="elem__card">
      <div class="elem__head">
        <span class="elem__name">{{ item.element }}</span>
        <span class="elem__share">占报价成本 {{ (item.share * 100).toFixed(1) }}%</span>
      </div>
      <div class="elem__track">
        <span class="elem__bar" :style="{ width: `${item.share * 100}%` }" />
      </div>
      <div class="elem__row">
        <span>报价</span>
        <b>{{ money(item.quoted) }} {{ currency }}</b>
      </div>
      <div class="elem__row">
        <span>实际</span>
        <b>{{ money(item.actual) }} {{ item.actual === null ? '' : currency }}</b>
      </div>
      <div class="elem__row">
        <span>偏差</span>
        <b :class="item.diff !== null && item.diff > 0 ? 'is-bad' : 'is-good'">
          {{ signed(item.diff) }}（{{ percent(item.diffRate) }}）
        </b>
      </div>
      <p class="elem__hint">{{ HINT[item.element] }}</p>
    </div>

    <div class="elem__card is-total">
      <div class="elem__head">
        <span class="elem__name">单件合计</span>
        <span class="elem__share">{{ totals.hasActual ? '已回溯' : '无实际成本' }}</span>
      </div>
      <div class="elem__total">{{ money(totals.actual ?? totals.quoted) }} {{ currency }}</div>
      <div class="elem__row">
        <span>报价成本</span>
        <b>{{ money(totals.quoted) }}</b>
      </div>
      <div class="elem__row">
        <span>实际成本</span>
        <b>{{ money(totals.actual) }}</b>
      </div>
      <div class="elem__row">
        <span>偏差</span>
        <b :class="totals.diff !== null && totals.diff > 0 ? 'is-bad' : 'is-good'">
          {{ signed(totals.diff) }}（{{ percent(totals.diffRate) }}）
        </b>
      </div>
      <p class="elem__hint">合计偏差超过 ±5% 时，本产品的成本参考值需回写修正后方可用于新报价。</p>
    </div>
  </div>
</template>

<style scoped>
.elem {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.elem__card {
  padding: 12px 14px;
  background: var(--wfx-surface-alt);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}

.elem__card.is-total {
  background: var(--wfx-surface);
  border-color: var(--wfx-navy);
}

.elem__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.elem__name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.elem__share {
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.elem__track {
  height: 6px;
  margin: 8px 0 10px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 3px;
}

.elem__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
}

.elem__total {
  margin: 8px 0 10px;
  font-size: 22px;
  font-weight: 700;
  color: var(--wfx-navy);
}

.elem__row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  font-size: 12.5px;
  color: var(--wfx-text-muted);
}

.elem__row b {
  color: var(--wfx-text-strong);
}

.elem__hint {
  margin: 10px 0 0;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--wfx-text-muted);
}

.is-bad {
  color: var(--el-color-danger);
}

.is-good {
  color: var(--el-color-success);
}

@media (max-width: 1400px) {
  .elem {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

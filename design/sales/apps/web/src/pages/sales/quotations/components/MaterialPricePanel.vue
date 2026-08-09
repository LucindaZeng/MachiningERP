<script setup lang="ts">
import { Lock } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed } from 'vue'

import { fetchMaterialPrices } from '@/api/sales/material-price.api'
import FilterBar from '@/components/FilterBar.vue'
import SparkLine from '@/components/charts/SparkLine.vue'
import StatusTag from '@/components/StatusTag.vue'
import { FRESHNESS } from '@/components/status-dictionary'
import { matchEq, matchNumberRange, type FilterField } from '@/components/filter-helpers'
import { useResourceList } from '@/composables/use-resource-list'
import type { MaterialPrice } from '@/types/sales.types'

const EXPORT_COLUMNS = [
  { label: '材料', value: 'name' },
  { label: '牌号', value: 'grade' },
  { label: '规格', value: 'spec' },
  { label: '单位', value: 'unit' },
  { label: '价格', value: 'price' },
  { label: '币种', value: 'currency' },
  { label: '涨跌', value: 'change' },
  { label: '行情来源', value: 'source' },
  { label: '快照时间', value: 'snapshotAt' },
]

const FILTER_FIELDS: FilterField[] = [
  {
    key: 'materialName',
    label: '材料',
    type: 'select',
    options: [
      { label: '6061-T6 铝合金', value: '6061-T6 铝合金' },
      { label: '7075-T651 铝合金', value: '7075-T651 铝合金' },
      { label: '304 不锈钢', value: '304 不锈钢' },
      { label: '45# 碳钢', value: '45# 碳钢' },
      { label: 'H62 黄铜', value: 'H62 黄铜' },
      { label: 'TC4 钛合金', value: 'TC4 钛合金' },
    ],
    width: 180,
  },
  {
    key: 'freshness',
    label: '实时性',
    type: 'select',
    options: [
      { label: '实时', value: 'realtime' },
      { label: '延时 15 分', value: 'delayed' },
      { label: '日结价', value: 'daily' },
      { label: '人工审批价', value: 'manual' },
    ],
    width: 150,
  },
  {
    key: 'snapshotExpired',
    label: '快照状态',
    type: 'select',
    options: [
      { label: '快照有效', value: 'false' },
      { label: '快照已过期', value: 'true' },
    ],
    width: 150,
  },
  { key: 'monthChange', label: '月涨跌%', type: 'number-range', width: 190 },
]

const { filtered, loading, keyword, filters, resetFilters, reload } =
  useResourceList<MaterialPrice>(
    fetchMaterialPrices,
    (row) => [row.materialCode, row.materialName, row.form, row.instrument],
    {
      fields: FILTER_FIELDS,
      predicate: (row, f) =>
        matchEq(row.materialName, f.materialName) &&
        matchEq(row.freshness, f.freshness) &&
        matchEq(row.snapshotExpired, f.snapshotExpired) &&
        matchNumberRange(row.monthChange, f.monthChange),
    },
  )

const expiredCount = computed(() => filtered.value.filter((row) => row.snapshotExpired).length)
const surgeCount = computed(() => filtered.value.filter((row) => row.monthChange >= 5).length)

function changeClass(value: number): string {
  if (value > 0) {
    return 'is-up'
  }
  return value < 0 ? 'is-down' : ''
}

function format(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function snapshot(row: MaterialPrice): void {
  ElMessage.success(
    `已为 ${row.materialName} 生成价格快照（含行情源、行情时间、币种、单位、汇率与公式版本），可在核价中引用`,
  )
}
</script>

<template>
  <div>
    <el-alert
      v-if="expiredCount || surgeCount"
      class="panel-alert"
      type="warning"
      :closable="false"
      show-icon
      :title="`${expiredCount} 种材料的报价快照已过期，${surgeCount} 种材料月涨幅超过 5% 阈值`"
      description="快照过期不得用于送审核价；涨幅超阈值的材料，相关报价需重新核价并评估有效期。"
    />

    <FilterBar
      v-model="filters"
      v-model:keyword="keyword"
      :fields="FILTER_FIELDS"
      keyword-placeholder="搜索材料牌号 / 名称 / 形态 / 基准品种"
      :total="filtered.length"
      export-name="原材料价格表"
      :export-columns="EXPORT_COLUMNS"
      :export-rows="filtered"
      @reset="resetFilters"
      @search="reload"
    >
      <template #extra>
        <span class="permission-hint">
          <el-icon><Lock /></el-icon>
          业务视图：不含供应商身份与底价
        </span>
      </template>
    </FilterBar>

    <el-table :data="filtered" v-loading="loading" style="width: 100%">
      <el-table-column label="材料" min-width="170">
        <template #default="{ row }">
          <span class="material">{{ row.materialName }}</span>
          <span class="material__code">{{ row.materialCode }}</span>
        </template>
      </el-table-column>
      <el-table-column label="形态 / 规格" width="150">
        <template #default="{ row }">{{ row.form }} · {{ row.spec }}</template>
      </el-table-column>
      <el-table-column prop="instrument" label="基准品种" min-width="180" show-overflow-tooltip />
      <el-table-column label="市场基准价" width="120" align="right">
        <template #default="{ row }">{{ row.basePrice }}</template>
      </el-table-column>
      <el-table-column label="企业落地参考价" width="140" align="right">
        <template #default="{ row }">
          <b class="landed">{{ row.landedPrice }}</b>
          <span class="unit">{{ row.unit }}</span>
        </template>
      </el-table-column>
      <el-table-column label="日 / 周 / 月涨跌" width="180" align="center">
        <template #default="{ row }">
          <span :class="changeClass(row.dayChange)">{{ format(row.dayChange) }}</span>
          <span class="sep">/</span>
          <span :class="changeClass(row.weekChange)">{{ format(row.weekChange) }}</span>
          <span class="sep">/</span>
          <span :class="changeClass(row.monthChange)">{{ format(row.monthChange) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="近 30 日" width="110">
        <template #default="{ row }">
          <SparkLine :values="row.history" :positive="row.monthChange > 0" />
        </template>
      </el-table-column>
      <el-table-column label="行情时间 / 实时性" width="190">
        <template #default="{ row }">
          <div class="freshness">
            <StatusTag :dict="FRESHNESS" :value="row.freshness" />
            <span>{{ row.quotedAt }}</span>
          </div>
          <p class="source">{{ row.source }}</p>
        </template>
      </el-table-column>
      <el-table-column label="快照" width="90">
        <template #default="{ row }">
          <el-tag v-if="row.snapshotExpired" type="danger" size="small">已过期</el-tag>
          <el-tag v-else type="success" size="small">有效</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link type="primary" @click="snapshot(row)">生成价格快照</el-button>
        </template>
      </el-table-column>
    </el-table>

    <p class="panel-note">
      企业落地参考价 = 市场基准价 × 汇率 × 单位换算 + 升贴水 + 加工 / 切割费 + 包装运输保险 +
      关税及不可抵扣税费；公式按材料、形态、产地走受控版本，不允许所有材料套用同一比例。
      非实时价（日结、上一交易日、人工审批价）不得用于自动核价，须按规则回退或人工审批。
    </p>
  </div>
</template>

<style scoped>
.panel-alert {
  margin-bottom: 16px;
}

.permission-hint {
  display: flex;
  gap: 4px;
  align-items: center;
}

.material {
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.material__code {
  display: block;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.landed {
  font-size: 15px;
  color: var(--wfx-navy);
}

.unit {
  margin-left: 4px;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.is-up {
  color: var(--el-color-danger);
}

.is-down {
  color: var(--el-color-success);
}

.sep {
  margin: 0 4px;
  color: var(--wfx-border);
}

.freshness {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--wfx-text);
}

.source {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.panel-note {
  margin: 16px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}
</style>

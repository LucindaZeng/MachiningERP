<script setup lang="ts">
import ReportCard from './ReportCard.vue'
import { levelTag, signedPct } from './report-format'
import type { MarketReports } from '@/api/mock/sales/analytics-market.fixture'

defineProps<{ reports: MarketReports }>()

const LEVEL_LABEL: Record<string, string> = { watch: '观察', risk: '流失风险', churn: '已流失' }
</script>

<template>
  <ReportCard
    title="客户流失预警"
    caliber="触发规则：距上次下单天数 ＞ 该客户平均下单间隔的 2 倍，或近 3 个月金额同比下滑 ＞30%。A 级客户触发即当日推送业务经理，跟进结果必须回填后才能关闭预警。"
    wide
      :export-rows="reports.churn"
    >
    <el-table :data="reports.churn" size="small" style="width: 100%">
      <el-table-column prop="customer" label="客户" min-width="180" />
      <el-table-column label="等级" width="75">
        <template #default="{ row }">
          <el-tag size="small" effect="plain">{{ row.grade }} 级</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastOrderAt" label="上次下单" width="110" />
      <el-table-column label="已过天数" width="100" align="right">
        <template #default="{ row }">
          <b :class="row.daysSince > row.avgIntervalDays * 2 ? 'is-bad' : ''">{{ row.daysSince }}</b>
        </template>
      </el-table-column>
      <el-table-column label="平均间隔" width="95" align="right">
        <template #default="{ row }">{{ row.avgIntervalDays }} 天</template>
      </el-table-column>
      <el-table-column label="金额变化" width="100" align="right">
        <template #default="{ row }">
          <span :class="row.amountChange < 0 ? 'is-bad' : 'is-good'">
            {{ signedPct(row.amountChange, 0) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="预警等级" width="105">
        <template #default="{ row }">
          <el-tag size="small" :type="levelTag(row.level)">{{ LEVEL_LABEL[row.level] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="owner" label="业务" width="80" />
      <el-table-column prop="followedAt" label="跟进日期" width="105" />
      <el-table-column prop="followResult" label="跟进结果" min-width="280" />
      <el-table-column prop="nextAction" label="下一步" min-width="280" />
    </el-table>

    <p class="note">
      跟进结果按四类归档：价格因素、质量因素、交期因素、客户自身因素（项目停止 / 转移产线）。
      质量与交期因素的流失会自动关联退货质量分析与准时交付率，作为月度经营会的改善输入。
    </p>
  </ReportCard>
</template>

<style scoped>
.note {
  margin: 14px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}

.is-bad {
  color: var(--el-color-danger);
}

.is-good {
  color: var(--el-color-success);
}
</style>

<script setup lang="ts">
import { computed } from 'vue'

import CostElementSummary from './CostElementSummary.vue'
import {
  buildElementSummary,
  buildTotals,
  buildTraceRows,
  money,
  percent,
  signed,
  unitGross,
} from './quote-cost-trace'
import type { HistoricalQuote } from '@/types/sales.types'

const props = defineProps<{ modelValue: boolean; quote: HistoricalQuote | null }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; reuse: [HistoricalQuote] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const rows = computed(() => buildTraceRows(props.quote?.operationCosts ?? []))
const elements = computed(() => buildElementSummary(rows.value))
const totals = computed(() => buildTotals(rows.value))
const traced = computed(() => rows.value.length > 0)

const OUTCOME: Record<string, { label: string; type: 'success' | 'info' | 'warning' }> = {
  won: { label: '已成交', type: 'success' },
  lost: { label: '未成交', type: 'info' },
  expired: { label: '已失效', type: 'warning' },
}

/** 偏差超过 ±5% 的工序需要在新报价前修正成本参考值 */
const abnormal = computed(() =>
  rows.value.filter((row) => row.diffRate !== null && Math.abs(row.diffRate) >= 0.05),
)

const abnormalText = computed(() =>
  abnormal.value.map((row) => `${row.line.operation}（${percent(row.diffRate)}）`).join('、'),
)

function minutes(row: { line: { stdMinutes?: string; actMinutes?: string } }): string {
  const std = row.line.stdMinutes ?? '—'
  const act = row.line.actMinutes ?? '—'
  return `${std} / ${act}`
}
</script>

<template>
  <el-drawer v-model="visible" size="1180px" :title="quote ? `${quote.docNo} · 报价与成本回溯` : ''">
    <template v-if="quote">
      <h3 class="block-title">一、当时的报价</h3>
      <el-descriptions :column="4" border size="small">
        <el-descriptions-item label="报价日期">{{ quote.quotedAt }}</el-descriptions-item>
        <el-descriptions-item label="业务员">{{ quote.owner }}</el-descriptions-item>
        <el-descriptions-item label="成交结果">
          <el-tag :type="OUTCOME[quote.outcome].type" size="small">
            {{ OUTCOME[quote.outcome].label }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="关联订单">{{ quote.orderNo ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="客户" :span="2">{{ quote.customerName }}</el-descriptions-item>
        <el-descriptions-item label="产品">{{ quote.productName }}</el-descriptions-item>
        <el-descriptions-item label="图号">{{ quote.drawingNo }}</el-descriptions-item>
        <el-descriptions-item label="材料">{{ quote.material }}</el-descriptions-item>
        <el-descriptions-item label="表面处理">{{ quote.surfaceTreatment }}</el-descriptions-item>
        <el-descriptions-item label="报价数量">{{ quote.quantity }} 件</el-descriptions-item>
        <el-descriptions-item label="报价单价">
          <b class="price">{{ quote.unitPrice }} {{ quote.currency }}</b>
        </el-descriptions-item>
        <el-descriptions-item label="报价单位成本">
          {{ quote.quotedUnitCost ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="报价单件毛利">
          {{ unitGross(quote, quote.quotedUnitCost) }}
        </el-descriptions-item>
        <el-descriptions-item label="报价毛利率">
          {{ (quote.marginRate * 100).toFixed(1) }}%
        </el-descriptions-item>
        <el-descriptions-item label="实际毛利率">
          <span :class="(quote.actualMarginRate ?? 1) < quote.marginRate ? 'is-bad' : 'is-good'">
            {{ quote.actualMarginRate === undefined ? '—' : (quote.actualMarginRate * 100).toFixed(1) + '%' }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="关联成本分析" :span="2">
          <span class="cost-no">{{ quote.costAnalysisNo }}</span>
          <span class="muted">（报价强制关联，作废需同步作废报价单）</span>
        </el-descriptions-item>
        <el-descriptions-item label="实际成本来源" :span="2">
          {{ quote.costOrderNo ?? '未成交 / 未投产，无实际成本' }}
        </el-descriptions-item>
      </el-descriptions>

      <el-empty
        v-if="!traced"
        class="empty"
        :image-size="70"
        description="该报价的成本分析未做工序级拆分（早期版本），仅有汇总口径；新版核价单已强制按工序录入。"
      />

      <template v-else>
        <h3 class="block-title">二、当时的成本分析（按工序预估）</h3>
        <p class="block-desc">
          核价单 {{ quote.costAnalysisNo }} 的工序展开，逐道工序独立核算并按 材料 / 加工时间 / 工艺 归集；
          「转出累计」为该工序完工时的单件累计成本，用于判断价值在哪一道工序形成。
        </p>
        <el-table :data="rows" size="small" border style="width: 100%">
          <el-table-column label="工序" width="200">
            <template #default="{ row }">
              <b class="seq">{{ row.line.seq }}</b> {{ row.line.operation }}
            </template>
          </el-table-column>
          <el-table-column label="机台 / 供应商" width="150">
            <template #default="{ row }">{{ row.line.workCenter }}</template>
          </el-table-column>
          <el-table-column label="分项" width="90">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">{{ row.line.element }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="标准工时(min)" width="120" align="right">
            <template #default="{ row }">{{ row.line.stdMinutes ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="单件成本" width="100" align="right">
            <template #default="{ row }">{{ money(row.quoted) }}</template>
          </el-table-column>
          <el-table-column label="占比" width="130">
            <template #default="{ row }">
              <div class="share">
                <span class="share__track">
                  <span class="share__bar" :style="{ width: `${row.share * 100}%` }" />
                </span>
                <em>{{ (row.share * 100).toFixed(1) }}%</em>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="转入累计" width="100" align="right">
            <template #default="{ row }">{{ money(row.quotedIn) }}</template>
          </el-table-column>
          <el-table-column label="转出累计" width="100" align="right">
            <template #default="{ row }">
              <b>{{ money(row.quotedOut) }}</b>
            </template>
          </el-table-column>
        </el-table>

        <h3 class="block-title">三、实际成本回溯（按工序实际）</h3>
        <p class="block-desc">
          实际成本取自 {{ quote.costOrderNo ?? '生产订单' }} 的工序报工、领料与委外对账，逐道工序与报价假设对照；
          单道工序偏差 ≥ ±5% 会进入「报价成本偏差分析」并推送报价工程师修正成本参考值。
        </p>

        <el-alert
          v-if="quote.blendedNote"
          class="alert"
          type="info"
          :closable="false"
          show-icon
          title="本单含备料领用，实际成本按加权平均口径"
          :description="quote.blendedNote"
        />

        <el-alert
          v-if="abnormal.length"
          class="alert"
          type="warning"
          :closable="false"
          show-icon
          :title="`${abnormal.length} 道工序偏差超过 ±5%，需修正成本参考值`"
          :description="abnormalText"
        />

        <el-table :data="rows" size="small" border style="width: 100%">
          <el-table-column label="工序" width="165">
            <template #default="{ row }">
              <b class="seq">{{ row.line.seq }}</b> {{ row.line.operation }}
            </template>
          </el-table-column>
          <el-table-column label="分项" width="82">
            <template #default="{ row }">{{ row.line.element }}</template>
          </el-table-column>
          <el-table-column label="转入累计" width="88" align="right">
            <template #default="{ row }">{{ money(row.actualIn) }}</template>
          </el-table-column>
          <el-table-column label="报价" width="80" align="right">
            <template #default="{ row }">{{ money(row.quoted) }}</template>
          </el-table-column>
          <el-table-column label="实际" width="80" align="right">
            <template #default="{ row }">
              <b>{{ money(row.actual) }}</b>
            </template>
          </el-table-column>
          <el-table-column label="偏差" width="128" align="right">
            <template #default="{ row }">
              <span :class="row.diff !== null && row.diff > 0 ? 'is-bad' : 'is-good'">
                {{ signed(row.diff) }} <em class="rate">{{ percent(row.diffRate) }}</em>
              </span>
            </template>
          </el-table-column>
          <el-table-column label="工时 标/实" width="102" align="right">
            <template #default="{ row }">{{ minutes(row) }}</template>
          </el-table-column>
          <el-table-column label="工时偏差" width="88" align="right">
            <template #default="{ row }">
              <span :class="row.minuteDiff !== null && row.minuteDiff > 0 ? 'is-bad' : ''">
                {{ signed(row.minuteDiff, 1) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="转出累计" width="88" align="right">
            <template #default="{ row }">
              <b>{{ money(row.actualOut) }}</b>
            </template>
          </el-table-column>
          <el-table-column label="偏差原因" min-width="195">
            <template #default="{ row }">
              <span class="muted">{{ row.line.note ?? (row.diff === null ? '未投产' : '与假设一致') }}</span>
            </template>
          </el-table-column>
        </el-table>

        <h3 class="block-title">四、分项汇总与结论</h3>
        <CostElementSummary :items="elements" :totals="totals" :currency="quote.currency" />

        <p class="conclusion">
          结论口径：单件报价成本 {{ money(totals.quoted) }}，实际 {{ money(totals.actual) }}，
          偏差 {{ signed(totals.diff) }}（{{ percent(totals.diffRate) }}）。
          偏差来源按工序定位后回写到该产品的成本参考值：工时类偏差修正机台工时假设，
          材料类偏差修正损耗率与原材料价格表，工艺类偏差修正委外单价与分摊基数。
        </p>
      </template>
    </template>

    <template #footer>
      <template v-if="quote">
        <el-button>导出成本回溯（Excel）</el-button>
        <el-button type="primary" @click="emit('reuse', quote)">引用新建报价</el-button>
      </template>
    </template>
  </el-drawer>
</template>

<style scoped>
.block-title {
  margin: 24px 0 10px;
  padding-left: 9px;
  font-size: 14.5px;
  color: var(--wfx-text-strong);
  border-left: 3px solid var(--wfx-navy);
}

.block-title:first-child {
  margin-top: 0;
}

.block-desc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
}

.price {
  color: var(--wfx-navy);
}

.cost-no {
  font-size: 12.5px;
  color: var(--el-color-success);
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.seq {
  display: inline-block;
  min-width: 26px;
  margin-right: 4px;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.share {
  display: flex;
  gap: 8px;
  align-items: center;
}

.share__track {
  flex: 1;
  height: 8px;
  overflow: hidden;
  background: var(--viz-grid);
  border-radius: 3px;
}

.share__bar {
  display: block;
  height: 100%;
  background: var(--viz-series-1);
}

.share em {
  font-size: 11.5px;
  font-style: normal;
  color: var(--wfx-text-muted);
}

.rate {
  font-size: 11.5px;
  font-style: normal;
}

.alert {
  margin-bottom: 12px;
}

.empty {
  margin-top: 10px;
}

.conclusion {
  margin: 16px 0 0;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.9;
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

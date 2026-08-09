<script setup lang="ts">
import { Download } from '@element-plus/icons-vue'

import FunnelChart from '@/components/charts/FunnelChart.vue'
import RankBarChart from '@/components/charts/RankBarChart.vue'
import ShareStackedBar from '@/components/charts/ShareStackedBar.vue'
import TrendAreaChart from '@/components/charts/TrendAreaChart.vue'
import { exportNotes, exportSheet } from '@/utils/export-excel'

import { FIELD_LABELS } from './report-fields'

import type { SalesAnalytics } from '@/api/mock/sales/analytics.fixture'

defineProps<{ data: SalesAnalytics; showTable: boolean }>()

/** 经营总览的每张卡片各自可下载：列头按字段映射中文，口径写进表头说明 */
function download(title: string, rows: readonly unknown[], caliber: string): void {
  const list = rows as Array<Record<string, unknown>>
  if (!list.length) {
    return
  }
  const keys = Object.keys(list[0]).filter((key) => typeof list[0][key] !== 'object')
  exportSheet(
    {
      name: title,
      columns: keys.map((key) => ({ label: FIELD_LABELS[key] ?? key, value: key })),
      rows: list,
      notes: exportNotes(title, [`口径：${caliber}`]),
    },
    title,
  )
}

const SOURCES = [
  {
    metric: '订单额',
    caliber: '业务经理审核通过的订单，按合同应收金额（含税口径另列），模具与样品按约定收费金额计入，备料订单按预计生产成本单列',
    source: 'sales_orders · doc_timeline(ORD-02 批准)',
  },
  {
    metric: '毛利率',
    caliber: '（订单额 − 工序级实际成本）/ 订单额，未完工订单用标准成本暂估并标注；领用备料的订单按加权平均成本计算',
    source: 'op_costs · quotations.cost_analysis · stock_orders',
  },
  {
    metric: '报价转化率',
    caliber: '统计期内客户确认的报价数 / 发出的报价数，多版本按最终确认版本去重',
    source: 'quotations · quotation_versions',
  },
  {
    metric: '准时交付率',
    caliber: '实际发货日 ≤ 客户交期的发货单数 / 应交发货单数，受控暂停不扣减',
    source: 'shipments · sales_orders.delivery_date',
  },
  {
    metric: '逾期应收',
    caliber: '超过账期未回款金额，争议款单列不计入逾期',
    source: 'ar_invoices（财务部口径）',
  },
]
</script>

<template>
  <div>
      <section class="headline">
      <article class="headline__item">
        <p>年初至今订单额</p>
        <b>{{ data.headline.ytdAmount }}<em>万元</em></b>
        <span class="is-up">同比 {{ data.headline.ytdGrowth }}</span>
      </article>
      <article class="headline__item">
        <p>订单毛利率</p>
        <b>{{ data.headline.marginRate }}<em>%</em></b>
        <span class="is-down">低于目标 {{ data.headline.marginTarget }}%</span>
      </article>
      <article class="headline__item">
        <p>准时交付率</p>
        <b>{{ data.headline.onTimeRate }}<em>%</em></b>
        <span>3 张订单存在交期风险</span>
      </article>
      <article class="headline__item">
        <p>逾期应收</p>
        <b>{{ data.headline.overdueAr }}<em>万元</em></b>
        <span class="is-down">苏州明泰逾期 11 天</span>
      </article>
    </section>

    <div class="analytics-grid">
      <el-card shadow="never" class="analytics-card is-wide">
        <template #header>
          <div class="card-head">
            <span>月度订单额趋势</span>
            <span class="card-head__right">
              <span class="card-head__hint">数据截止 2026-07-28 17:30</span>
            <el-button
              link
              type="primary"
              size="small"
              :icon="Download"
              @click="download('月度订单额趋势', data.trend, '按月统计已批准订单的合同应收金额与订单张数')"
            >
              下载
            </el-button>
            </span>
          </div>
        </template>
        <TrendAreaChart :points="data.trend" unit="万元" />
      </el-card>

      <el-card shadow="never" class="analytics-card">
        <template #header>
          <div class="card-head">
            <span>客户订单额 Top 5</span>
            <span class="card-head__right">
              <span class="card-head__hint">年初至今</span>
            <el-button
              link
              type="primary"
              size="small"
              :icon="Download"
              @click="download('客户订单额Top5', data.topCustomers, '年初至今按客户汇总订单额，取前 5 名')"
            >
              下载
            </el-button>
            </span>
          </div>
        </template>
        <RankBarChart :items="data.topCustomers" unit="万元" />
      </el-card>

      <el-card shadow="never" class="analytics-card">
        <template #header>
          <div class="card-head">
            <span>三类订单结构</span>
            <span class="card-head__right">
              <span class="card-head__hint">正式 / 模具 / 样品</span>
            <el-button
              link
              type="primary"
              size="small"
              :icon="Download"
              @click="download('三类订单结构', data.orderMix, '按订单类型统计金额与结构占比')"
            >
              下载
            </el-button>
            </span>
          </div>
        </template>
        <ShareStackedBar :items="data.orderMix" unit="万元" />
        <p class="card-note">
          模具与样品即使免费也全额核算成本；免费部分计入「免费与减免订单成本报告」。
        </p>
      </el-card>

      <el-card shadow="never" class="analytics-card">
        <template #header>
          <div class="card-head">
            <span>询价到订单转化漏斗</span>
            <span class="card-head__right">
              <span class="card-head__hint">近 90 天</span>
            <el-button
              link
              type="primary"
              size="small"
              :icon="Download"
              @click="download('询价到订单转化漏斗', data.funnel, '近 90 天询价 → 已核价 → 已报出 → 客户确认 → 转订单的逐级转化')"
            >
              下载
            </el-button>
            </span>
          </div>
        </template>
        <FunnelChart :stages="data.funnel" />
      </el-card>

      <el-card shadow="never" class="analytics-card is-wide">
        <template #header>
          <div class="card-head">
            <span>客户毛利：报价 vs 实际</span>
            <span class="card-head__right">
              <span class="card-head__hint">差异为负表示实际毛利低于报价核算</span>
            <el-button
              link
              type="primary"
              size="small"
              :icon="Download"
              @click="download('客户毛利报价vs实际', data.margins, '按客户对照报价毛利率与工序级实际毛利率，差异为负表示实际低于报价')"
            >
              下载
            </el-button>
            </span>
          </div>
        </template>

        <el-table :data="data.margins" size="small" style="width: 100%">
          <el-table-column prop="customer" label="客户" min-width="160" />
          <el-table-column label="订单额（万元）" width="130" align="right">
            <template #default="{ row }">{{ row.amount }}</template>
          </el-table-column>
          <el-table-column label="报价毛利率" width="110" align="right">
            <template #default="{ row }">{{ (row.quotedMargin * 100).toFixed(1) }}%</template>
          </el-table-column>
          <el-table-column label="实际毛利率" width="110" align="right">
            <template #default="{ row }">{{ (row.actualMargin * 100).toFixed(1) }}%</template>
          </el-table-column>
          <el-table-column label="差异" width="90" align="right">
            <template #default="{ row }">
              <span :class="row.gap < 0 ? 'is-down' : 'is-up'">
                {{ (row.gap * 100).toFixed(1) }}pt
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="risk" label="风险提示" min-width="260" show-overflow-tooltip />
        </el-table>
      </el-card>
    </div>

    <el-card v-if="showTable" shadow="never" class="analytics-card is-full">
      <template #header>
        <div class="card-head">
          <span>趋势数据表（图表的表格视图）</span>
            <el-button
              link
              type="primary"
              size="small"
              :icon="Download"
              @click="download('月度订单额趋势数据表', data.trend, '图表的表格视图，字段与图表一致')"
            >
              下载
            </el-button>
        </div>
      </template>
      <el-table :data="data.trend" size="small" style="width: 100%">
        <el-table-column prop="label" label="月份" width="120" />
        <el-table-column label="订单额（万元）" width="150" align="right">
          <template #default="{ row }">{{ row.amount.toFixed(1) }}</template>
        </el-table-column>
        <el-table-column prop="orders" label="订单数（张）" width="130" align="right" />
      </el-table>
    </el-card>

    <el-card shadow="never" class="analytics-card is-full">
      <template #header>
        <div class="card-head">
          <span>指标口径与数据来源</span>
            <el-button
              link
              type="primary"
              size="small"
              :icon="Download"
              @click="download('指标口径与数据来源', SOURCES, '每个指标的计算口径与来源单据')"
            >
              下载
            </el-button>
        </div>
      </template>
      <el-table :data="SOURCES" size="small" style="width: 100%">
        <el-table-column prop="metric" label="指标" width="120" />
        <el-table-column prop="caliber" label="计算口径" min-width="420" />
        <el-table-column prop="source" label="来源单据 / 表" min-width="260" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.card-head__right {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.headline {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

.headline__item {
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--wfx-border);
  border-radius: var(--wfx-radius-md);
}

.headline__item p {
  margin: 0;
  font-size: 12.5px;
  color: var(--wfx-text-muted);
}

.headline__item b {
  display: block;
  margin: 6px 0 4px;
  font-size: 30px;
  color: var(--wfx-navy);
}

.headline__item b em {
  margin-left: 4px;
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  color: var(--wfx-text-muted);
}

.headline__item span {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.is-up {
  color: var(--el-color-success);
}

.is-down {
  color: var(--el-color-danger);
}

.analytics-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

.analytics-card.is-wide {
  grid-column: 1 / -1;
}

.analytics-card.is-full {
  margin-top: 16px;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.card-head__hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--wfx-text-muted);
}

.card-note {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wfx-text-muted);
}

@media (max-width: 1400px) {
  .headline {
    grid-template-columns: repeat(2, 1fr);
  }

  .analytics-grid {
    grid-template-columns: 1fr;
  }
}
</style>

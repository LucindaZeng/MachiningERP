<script setup lang="ts">
import { Bottom, Top } from '@element-plus/icons-vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { fetchSalesWorkbench, type SalesWorkbench } from '@/api/sales/workbench.api'
import PageHeader from '@/components/PageHeader.vue'
import StatusTag from '@/components/StatusTag.vue'
import { ALERT_LEVEL } from '@/components/status-dictionary'

const router = useRouter()
const loading = ref(false)
const data = ref<SalesWorkbench | null>(null)

onMounted(async () => {
  loading.value = true
  try {
    data.value = await fetchSalesWorkbench()
  } finally {
    loading.value = false
  }
})

function openTodo(route: string): void {
  void router.push(route)
}
</script>

<template>
  <div v-loading="loading">
    <PageHeader
      title="业务工作台"
      subtitle="按 T0 起算的节点计时、五级预警与经营指标；数据口径与来源单据可逐条下钻。"
    >
      <template #actions>
        <el-button type="primary" @click="router.push('/sales/orders/create')">新建业务订单</el-button>
      </template>
    </PageHeader>

    <section class="kpi-grid">
      <article v-for="kpi in data?.kpis ?? []" :key="kpi.key" class="kpi-card">
        <p class="kpi-card__label">{{ kpi.label }}</p>
        <p class="kpi-card__value">
          {{ kpi.value }}<em>{{ kpi.unit }}</em>
          <span class="kpi-card__trend" :class="kpi.trendUp ? 'is-up' : 'is-down'">
            <el-icon><component :is="kpi.trendUp ? Top : Bottom" /></el-icon>{{ kpi.trend }}
          </span>
        </p>
        <p class="kpi-card__hint">{{ kpi.hint }}</p>
      </article>
    </section>

    <div class="dashboard-grid">
      <el-card shadow="never" class="dashboard-card">
        <template #header>
          <div class="dashboard-card__head">
            <span>我的待办（{{ data?.todos.length ?? 0 }}）</span>
            <span class="dashboard-card__hint">按截止时间排序，点击直达单据</span>
          </div>
        </template>

        <ul class="todo-list">
          <li v-for="todo in data?.todos ?? []" :key="todo.id" @click="openTodo(todo.route)">
            <div class="todo-list__top">
              <StatusTag :dict="ALERT_LEVEL" :value="todo.level" />
              <span class="todo-list__category">{{ todo.category }}</span>
              <span class="todo-list__doc">{{ todo.docNo }}</span>
            </div>
            <p class="todo-list__title">{{ todo.title }}</p>
            <p class="todo-list__meta">{{ todo.customer }} · 截止 {{ todo.dueAt }}</p>
          </li>
        </ul>
      </el-card>

      <div class="dashboard-side">
        <el-card shadow="never" class="dashboard-card">
          <template #header>
            <div class="dashboard-card__head">
              <span>预警中心</span>
              <span class="dashboard-card__hint">五级：提示 / 临期 / 超期 / 严重 / 阻断</span>
            </div>
          </template>

          <div v-for="alert in data?.alerts ?? []" :key="alert.id" class="alert-item">
            <div class="alert-item__head">
              <StatusTag :dict="ALERT_LEVEL" :value="alert.level" />
              <span class="alert-item__subject">{{ alert.subject }}</span>
            </div>
            <p class="alert-item__meta">
              {{ alert.domain }} · {{ alert.relatedDocNo }} · 触发值 {{ alert.triggerValue }} /
              阈值 {{ alert.threshold }}
            </p>
            <p class="alert-item__meta">
              责任人 {{ alert.owner }} · 升级至 {{ alert.escalateTo }} · 截止 {{ alert.dueAt }}
            </p>
            <p class="alert-item__suggestion">建议：{{ alert.suggestion }}</p>
          </div>
        </el-card>

        <el-card shadow="never" class="dashboard-card">
          <template #header>
            <div class="dashboard-card__head">
              <span>审批时效分析</span>
              <span class="dashboard-card__hint">近 30 天，含 P90 与退回率</span>
            </div>
          </template>

          <el-table :data="data?.approvals ?? []" size="small" style="width: 100%">
            <el-table-column prop="node" label="节点" min-width="150" />
            <el-table-column prop="median" label="中位数" width="80" />
            <el-table-column prop="p90" label="P90" width="80" />
            <el-table-column label="按时率" width="80">
              <template #default="{ row }">{{ (row.onTimeRate * 100).toFixed(0) }}%</template>
            </el-table-column>
            <el-table-column label="退回率" width="80">
              <template #default="{ row }">{{ (row.returnRate * 100).toFixed(0) }}%</template>
            </el-table-column>
            <el-table-column prop="backlog" label="积压" width="60" />
          </el-table>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin-bottom: 18px;
}

.kpi-card {
  padding: 16px 18px;
  background: #fff;
  border: 1px solid var(--wfx-border);
  border-radius: var(--wfx-radius-md);
}

.kpi-card__label {
  margin: 0;
  font-size: 12.5px;
  color: var(--wfx-text-muted);
}

.kpi-card__value {
  display: flex;
  gap: 4px;
  align-items: baseline;
  margin: 8px 0 6px;
  font-size: 26px;
  font-weight: 700;
  color: var(--wfx-navy);
}

.kpi-card__value em {
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
  color: var(--wfx-text-muted);
}

.kpi-card__trend {
  display: inline-flex;
  gap: 2px;
  align-items: center;
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
}

.kpi-card__trend.is-up {
  color: var(--el-color-success);
}

.kpi-card__trend.is-down {
  color: var(--el-color-danger);
}

.kpi-card__hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--wfx-text-muted);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1.25fr;
  gap: 16px;
  align-items: start;
}

.dashboard-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.dashboard-card__hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--wfx-text-muted);
}

.todo-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.todo-list li {
  padding: 12px 10px;
  cursor: pointer;
  border-bottom: 1px solid var(--wfx-border);
  border-radius: 6px;
}

.todo-list li:hover {
  background: var(--wfx-surface-alt);
}

.todo-list__top {
  display: flex;
  gap: 8px;
  align-items: center;
}

.todo-list__category {
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.todo-list__doc {
  margin-left: auto;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.todo-list__title {
  margin: 6px 0 2px;
  font-size: 13px;
  color: var(--wfx-text);
}

.todo-list__meta {
  margin: 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.alert-item {
  padding: 10px 0;
  border-bottom: 1px dashed var(--wfx-border);
}

.alert-item:last-child {
  border-bottom: none;
}

.alert-item__head {
  display: flex;
  gap: 8px;
  align-items: center;
}

.alert-item__subject {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.alert-item__meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.alert-item__suggestion {
  margin: 6px 0 0;
  padding: 6px 10px;
  font-size: 12.5px;
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}

@media (max-width: 1440px) {
  .kpi-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
